// Codex : le Google Doc « CODEX Maverick » (copie du propriétaire, 2026-10-11) découpé en pages `lore/` par tools/docs/codex.py (docs/codex.md).
// Le texte des pages est celui du document, aux corrections du registre près (tools/docs/codex-corrections.json : décision R21, fautes déjà corrigées
// dans toute la base) ; le vérificateur du script relit l'export ligne par ligne, sans le découpage, et compare les pages fabriquées depuis data/rows.
// Les pages se modifient depuis le site de dev (demande du propriétaire) : ce qui épingle l'import (fidélité au document, R21, registre) lit l'état
// d'avant toute édition (lib/historique-site.mjs, et pages_du_site pour le vérificateur) ; le reste contrôle l'état courant.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { NAV } from '../src/lib/nav.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = trouverRacine();
const db = ouvrirBase({ sansExemples: false });
const SOURCE = 'Google Doc « CODEX Maverick »';
const ID = '1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg';
const pagesDuCodex = db
  .prepare("SELECT p.id, p.titre, p.statut, p.origine, p.corps_md FROM page p JOIN page_source ps ON ps.page_id = p.id AND ps.ordre = 0 JOIN source s ON s.id = ps.source_id WHERE s.texte = ? ORDER BY p.id")
  .all(SOURCE);
// les mêmes pages telles que l'import les a laissées (titre et texte d'avant les modifications du site de dev)
const historique = historiqueSite(db);
const pagesDImport = pagesDuCodex.map((p) => ({
  ...p,
  titre: historique.valeurDImport('page', { id: p.id }, 'titre', p.titre),
  corps_md: historique.valeurDImport('page', { id: p.id }, 'corps_md', p.corps_md),
}));
const codexPy = (...args) => spawnSync('python3', ['-I', join(racine, 'tools', 'docs', 'codex.py'), ...args], { encoding: 'utf8', cwd: racine });

test('chaque ligne du document est dans une page, et les pages sont celles du découpage (tools/docs/codex.py --verifier)', () => {
  const r = codexPy('--verifier');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^116 pages du Codex conformes au document( \(\d+ modifiées depuis par le site de dev, contrôlées dans leur état d'import\))?$/m);
});

test('une page modifiée par le site de dev : contrôlée dans son état d’import (historique), gardée telle quelle par une nouvelle écriture', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-codex-'));
  after(() => rmSync(tmp, { recursive: true, force: true }));
  cpSync(join(racine, 'client', 'src', 'content', 'wiki', 'lore'), join(tmp, 'lore'), { recursive: true });
  const fichier = join(tmp, 'lore', 'les-divinites.md');
  const original = readFileSync(fichier, 'utf8');
  const [, entete, corps] = original.match(/^(---\n[\s\S]*?\n---\n)\n([\s\S]*)$/);
  const titre = JSON.parse(entete.match(/^title: (.*)$/m)[1]);
  // ce que ferait le site : un titre et un texte réécrits, l'ancien titre en alias (serveur/edition.mjs, domaine PAGE)
  const modifiee = `${entete.replace(/^title: .*$/m, 'title: "Les dieux"').replace(/^aliases: \[(.*)\]$/m, (_, a) => `aliases: [${a ? `${a}, ` : ''}${JSON.stringify(titre)}]`)}\nUn texte réécrit sur le site.\n`;
  writeFileSync(fichier, modifiee);
  const sql = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  const ligne = (rang, table, cle, operation, avant, apres) =>
    `INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES ('lot-essai', ${rang}, '2026-10-11T20:00:00Z', 'essai', NULL, '${table}', ${sql(JSON.stringify(cle))}, '${operation}', ${sql(avant && JSON.stringify(avant))}, ${sql(apres && JSON.stringify(apres))});`;
  const ecrireHistorique = (corpsDImport) => {
    const chemin = join(tmp, 'historique.sql');
    writeFileSync(chemin, [
      ligne(1, 'page', { id: 'lore/les-divinites' }, 'modifier', { titre, corps_md: corpsDImport }, { titre: 'Les dieux', corps_md: 'Un texte réécrit sur le site.\n' }),
      ligne(2, 'alias', { page_id: 'lore/les-divinites', ordre: 9 }, 'inserer', null, { page_id: 'lore/les-divinites', ordre: 9, texte: titre, cle: 'x' }),
    ].join('\n'));
    return chemin;
  };
  // fidèle à l'import : conforme, et la page est comptée parmi celles du site
  let r = codexPy('--verifier', '--out', tmp, '--historique', ecrireHistorique(corps));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /116 pages du Codex conformes au document \(1 modifiées depuis par le site de dev/);
  // sans l'historique, la page diffère du document
  r = codexPy('--verifier', '--out', tmp, '--historique', join(tmp, 'absent.sql'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /\(3\) page différente du découpage : lore\/les-divinites/);
  // un état d'import qui n'est pas le document : signalé
  r = codexPy('--verifier', '--out', tmp, '--historique', ecrireHistorique('Un texte inventé.\n'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /\(3\) page modifiée par le site de dev, différente du découpage dans son état d'import : lore\/les-divinites/);
  // une nouvelle écriture des pages ne touche pas celle que le site a modifiée
  r = codexPy('--out', tmp, '--historique', ecrireHistorique(corps));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /gardée telle que le site de dev l'a modifiée : lore\/les-divinites/);
  assert.equal(readFileSync(fichier, 'utf8'), modifiee);
});

test('un mot-clé renommé, fusionné ou retiré par le site (vocabulaire, migration 0042) : ses pages du Codex comptent comme modifiées, sans comparer leurs mots-clés', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-codex-mots-'));
  after(() => rmSync(tmp, { recursive: true, force: true }));
  cpSync(join(racine, 'client', 'src', 'content', 'wiki', 'lore'), join(tmp, 'lore'), { recursive: true });
  const sql = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  const ligne = (rang, table, cle, operation, avant, apres) =>
    `INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES ('lot-mots', ${rang}, '2026-10-14T20:00:00Z', 'essai', NULL, '${table}', ${sql(JSON.stringify(cle))}, '${operation}', ${sql(avant && JSON.stringify(avant))}, ${sql(apres && JSON.stringify(apres))});`;
  // « feu » renommé « Flammes » : les pages qui le portent l'écrivent désormais ainsi
  const porteuses = readdirSync(join(tmp, 'lore')).filter((f) => /^tags: \[.*"feu".*\]$/m.test(readFileSync(join(tmp, 'lore', f), 'utf8')));
  assert.ok(porteuses.length >= 2, porteuses.join(', '));
  for (const f of porteuses) writeFileSync(join(tmp, 'lore', f), readFileSync(join(tmp, 'lore', f), 'utf8').replace(/^(tags: \[.*)"feu"(.*\])$/m, '$1"Flammes"$2'));
  // et un mot-clé retiré d'une autre page (page_tag supprimé : suppression ou fusion)
  const autre = 'les-divinites.md';
  const avantRetrait = readFileSync(join(tmp, 'lore', autre), 'utf8');
  writeFileSync(join(tmp, 'lore', autre), avantRetrait.replace(/^tags: \[("codex")(?:, [^\]]*)?\]$/m, 'tags: [$1]'));
  const historique = join(tmp, 'historique.sql');
  writeFileSync(historique, [
    ligne(1, 'mot_cle', { id: 'feu' }, 'modifier', { libelle: 'feu' }, { libelle: 'Flammes' }),
    ligne(2, 'page_tag', { page_id: 'lore/les-divinites', ordre: 1 }, 'supprimer', { page_id: 'lore/les-divinites', ordre: 1, tag_id: 'x' }, null),
  ].join('\n'));
  let r = codexPy('--verifier', '--out', tmp, '--historique', historique);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const comptees = new Set([...porteuses, autre]).size;
  assert.match(r.stdout, new RegExp(`116 pages du Codex conformes au document \\(${comptees} modifiées depuis par le site de dev`));
  // sans l'historique : les pages diffèrent du découpage
  r = codexPy('--verifier', '--out', tmp, '--historique', join(tmp, 'absent.sql'));
  assert.equal(r.status, 1);
  // une nouvelle écriture les garde telles quelles (sinon « feu » reviendrait, et db:sync-pages en ferait un second mot-clé)
  r = codexPy('--out', tmp, '--historique', historique);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of porteuses) assert.match(readFileSync(join(tmp, 'lore', f), 'utf8'), /"Flammes"/, f);
});

test('pages du Codex : type lore, famille docs, brouillon, la copie du propriétaire en seconde source, le mot-clé « codex »', () => {
  assert.equal(pagesDuCodex.length, 116);
  for (const p of pagesDuCodex) {
    assert.match(p.id, /^lore\//, p.id);
    assert.equal(p.origine, 'docs', p.id);
    assert.equal(p.statut, 'draft', p.id);
    const sources = db.prepare('SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ? ORDER BY ps.ordre').all(p.id).map((s) => s.texte);
    assert.deepEqual(sources, [SOURCE, `https://docs.google.com/document/d/${ID}/edit`], p.id);
    assert.ok(db.prepare("SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = 'codex'").get(p.id), `${p.id} : mot-clé « codex »`);
    assert.doesNotMatch(p.corps_md, /!\[|\[image\d+\]/, `${p.id} : pas d’image du document dans la page`);
  }
  // sommaires : le Codex entier, puis une page par partie à plusieurs pages ; le menu Codex y mène
  for (const id of ['lore/codex', 'lore/les-divinites', 'lore/temples-cultes-guildes', 'lore/les-races-non-jouable', 'lore/les-civilisations', 'lore/erisia', 'lore/mrode',
    'lore/les-outils-legendaires-uniques', 'lore/glossaire']) {
    assert.ok(pagesDuCodex.some((p) => p.id === id), id);
  }
  const codex = NAV.find((g) => g.key === 'codex').items;
  assert.equal(codex.find((i) => i.label === 'Mythologie').path, 'lore/les-divinites/');
  assert.equal(codex.find((i) => i.label === 'Factions').path, 'lore/temples-cultes-guildes/');
});

test('les liens du Codex mènent tous à une page (les sommaires ne citent que des pages produites)', () => {
  const titres = new Map(db.prepare('SELECT titre_cle, id FROM page').all().map((p) => [p.titre_cle, p.id]));
  const alias = new Set(db.prepare('SELECT cle FROM alias').all().map((a) => a.cle));
  for (const p of pagesDImport) {
    for (const [, cible] of p.corps_md.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      assert.ok(titres.has(normalize(cible)) || alias.has(normalize(cible)), `${p.id} : [[${cible}]] ne mène à aucune page`);
    }
  }
});

test('décision R21 : la divinité de la Corruption s’appelle Eaunoire, la graphie du document « Eaunoir » reste en alias', () => {
  const page = pagesDImport.find((p) => p.id === 'lore/eaunoire');
  assert.equal(page.titre, 'Eaunoire');
  const alias = historique.lignesDImport('alias').filter((a) => a.page_id === 'lore/eaunoire').map((a) => a.texte);
  assert.deepEqual(alias, ['Eaunoir']);
  for (const p of pagesDImport) assert.doesNotMatch(p.corps_md, /Eaunoir(?!e)|mon d[’']eau noire/i, p.id);
  assert.equal(db.prepare('SELECT nom FROM dieu WHERE id = ?').get('demon-deau-noire').nom, 'Eaunoire', 'le même nom que la liste des dieux');
});

test('registre de corrections : décrit, appliqué à l’export (qui reste tel quel), sans toucher un chiffre', () => {
  const registre = JSON.parse(readFileSync(join(racine, 'tools', 'docs', 'codex-corrections.json'), 'utf8'));
  const brut = readFileSync(join(racine, 'sources', 'raw', `${ID}.md`), 'utf8');
  const corps = pagesDImport.map((p) => p.corps_md).join('\n');
  for (const c of registre.corrections) {
    assert.ok(c.avant && c.apres && c.raison && c.nature && Number.isInteger(c.occurrences), JSON.stringify(c));
    assert.equal(c.avant.replace(/\D/g, ''), c.apres.replace(/\D/g, ''), `${c.avant} : un chiffre changerait`);
    assert.ok(brut.includes(c.avant), `« ${c.avant} » : l’export garde le texte du document`);
    assert.ok(corps.includes(c.apres), `« ${c.apres} » : absent des pages`);
  }
});
