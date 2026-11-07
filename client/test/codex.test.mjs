// Codex : le Google Doc « CODEX Maverick » (copie du propriétaire, 2026-10-11) découpé en pages `lore/` par tools/docs/codex.py (docs/codex.md).
// Le texte des pages est celui du document, aux corrections du registre près (tools/docs/codex-corrections.json : décision R21, fautes déjà corrigées
// dans toute la base) ; le vérificateur du script relit l'export ligne par ligne, sans le découpage, et compare les pages fabriquées depuis data/rows.
// Les pages se modifient depuis le site de dev (demande du propriétaire) : ce qui épingle l'import (fidélité au document, R21, registre) lit l'état
// d'avant toute édition (lib/historique-site.mjs, et pages_du_site pour le vérificateur) ; le reste contrôle l'état courant.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { NAV } from '../src/lib/nav.mjs';
import { normalize } from '../src/lib/text.mjs';
import { buildIndex, resolve } from '../src/lib/wikilinks-resolution.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

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

test('une page modifiée par le site de dev : contrôlée dans son état d’import (historique), gardée telle quelle par une nouvelle écriture', (t) => {
  // La page d'essai part de son état d'import (titre, texte, alias : lib/historique-site.mjs), quoi que le site de dev en ait fait depuis : seul
  // l'historique réel de ses titre, texte et alias est remplacé par celui du test (celui des autres pages, et de ses mots-clés, reste le vrai).
  const tmp = dossierTemporaire('codex', { t });
  cpSync(join(racine, 'client', 'src', 'content', 'wiki', 'lore'), join(tmp, 'lore'), { recursive: true });
  const id = 'lore/les-divinites';
  const fichier = join(tmp, 'lore', 'les-divinites.md');
  // les pages comptées comme modifiées par le site, lues par le script lui-même (codex.py#pages_du_site) sur la copie : la page d'essai y est-elle déjà ?
  const duSiteReel = JSON.parse(spawnSync('python3', ['-I', '-c',
    'import json, sys; sys.path.insert(0, sys.argv[1]); import codex; print(json.dumps(sorted(codex.pages_du_site(sur_disque=codex.pages_sur_disque(sys.argv[2])))))',
    join(racine, 'tools', 'docs'), tmp], { encoding: 'utf8', cwd: racine }).stdout);
  const { titre, corps_md: corpsDImport } = pagesDImport.find((p) => p.id === id);
  const aliasDImport = historique.lignesDImport('alias').filter((a) => a.page_id === id).map((a) => a.texte);
  const [, entete] = readFileSync(fichier, 'utf8').match(/^(---\n[\s\S]*?\n---\n)\n([\s\S]*)$/);
  assert.match(entete, /^aliases: \[.*\]$/m, 'l’en-tête écrit ses alias (tools/db/pages_md.py#emit_frontmatter)');
  // ce que ferait le site depuis l'import : un titre et un texte réécrits, l'ancien titre en alias (serveur/edition.mjs, domaine PAGE)
  const modifiee = `${entete.replace(/^title: .*$/m, 'title: "Les dieux"').replace(/^aliases: \[.*\]$/m, () => `aliases: [${[...aliasDImport, titre].map((a) => JSON.stringify(a)).join(', ')}]`)}\nUn texte réécrit sur le site.\n`;
  writeFileSync(fichier, modifiee);
  const sql = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  const ligne = (rang, table, cle, operation, avant, apres) =>
    `INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES ('lot-essai', ${rang}, '2026-10-11T20:00:00Z', 'essai', NULL, '${table}', ${sql(JSON.stringify(cle))}, '${operation}', ${sql(avant && JSON.stringify(avant))}, ${sql(apres && JSON.stringify(apres))});`;
  // l'historique réel (le site de dev modifie des pages : textes, titres, balises du glossaire), sauf les titre, texte et alias de la page d'essai
  const toutes = readFileSync(join(racine, 'data', 'rows', 'historique_modification.sql'), 'utf8').split('\n').filter((l) => l.startsWith('INSERT'));
  const cleDe = (l) => /, '(page|alias)', '(\{[^']*\})', '(?:inserer|modifier|supprimer)'/.exec(l);
  const reel = toutes.filter((l) => { const m = cleDe(l); return !m || (JSON.parse(m[2]).id ?? JSON.parse(m[2]).page_id) !== id; });
  // les pages comptées comme modifiées par le site : celles de l'historique réel, plus celle-ci si elle n'y est pas
  const nDuSite = (sortie) => Number(/\((\d+) modifiées depuis par le site de dev/.exec(sortie)?.[1] ?? 0);
  const attendues = nDuSite(codexPy('--verifier').stdout) + (duSiteReel.includes('les-divinites') ? 0 : 1);
  const ecrireHistorique = (corpsDImport) => {
    const chemin = join(tmp, 'historique.sql');
    writeFileSync(chemin, [
      ...reel,
      ligne(1, 'page', { id }, 'modifier', { titre, corps_md: corpsDImport }, { titre: 'Les dieux', corps_md: 'Un texte réécrit sur le site.\n' }),
      ligne(2, 'alias', { page_id: id, ordre: 99 }, 'inserer', null, { page_id: id, ordre: 99, texte: titre, cle: 'x' }),
    ].join('\n'));
    return chemin;
  };
  // fidèle à l'import : conforme, et la page est comptée parmi celles du site
  let r = codexPy('--verifier', '--out', tmp, '--historique', ecrireHistorique(corpsDImport));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /116 pages du Codex conformes au document \(\d+ modifiées depuis par le site de dev/);
  assert.equal(nDuSite(r.stdout), attendues);
  // sans l'historique, la page diffère du document
  r = codexPy('--verifier', '--out', tmp, '--historique', join(tmp, 'absent.sql'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /\(3\) page différente du découpage : lore\/les-divinites/);
  // un état d'import qui n'est pas le document : signalé
  r = codexPy('--verifier', '--out', tmp, '--historique', ecrireHistorique('Un texte inventé.\n'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /\(3\) page modifiée par le site de dev, différente du découpage dans son état d'import : lore\/les-divinites/);
  // une nouvelle écriture des pages ne touche pas celle que le site a modifiée
  r = codexPy('--out', tmp, '--historique', ecrireHistorique(corpsDImport));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /gardée telle que le site de dev l'a modifiée : lore\/les-divinites/);
  assert.equal(readFileSync(fichier, 'utf8'), modifiee);
});

test('mots-clés du Codex : seuls ceux du vocabulaire, dans son écriture (un import n’en crée pas : migration 0056) ; un mot-clé renommé, fusionné ou retiré par le site (migration 0043) : ses pages comptent comme modifiées, sans comparer leurs mots-clés', (t) => {
  const tmp = dossierTemporaire('codex-mots', { t });
  cpSync(join(racine, 'client', 'src', 'content', 'wiki', 'lore'), join(tmp, 'lore'), { recursive: true });
  const sql = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  const ligne = (rang, table, cle, operation, avant, apres) =>
    `INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES ('lot-mots', ${rang}, '2026-10-14T20:00:00Z', 'essai', NULL, '${table}', ${sql(JSON.stringify(cle))}, '${operation}', ${sql(avant && JSON.stringify(avant))}, ${sql(apres && JSON.stringify(apres))});`;
  const vocabulaire = join(tmp, 'mot_cle.sql');
  const ecrireVocabulaire = (feu) => writeFileSync(vocabulaire, `INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES ('codex', 'codex', 'codex', NULL), ('feu', ${sql(feu)}, ${sql(normalize(feu))}, NULL);\n`);
  const avec = (...args) => codexPy(...args, '--out', tmp, '--vocabulaire', vocabulaire);
  const absent = join(tmp, 'absent.sql');
  const tagsDe = (f) => readFileSync(join(tmp, 'lore', f), 'utf8').match(/^tags: (.*)$/m)[1];
  // le site de dev a un mot-clé « Feu » : l'écriture des pages le pose, dans son écriture, sur celles que le découpage range sous le feu (rien d'autre)
  ecrireVocabulaire('Feu');
  let r = avec('--historique', absent);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const fichiers = readdirSync(join(tmp, 'lore')).filter((f) => f.endsWith('.md') && readFileSync(join(tmp, 'lore', f), 'utf8').includes(`sources: ["${SOURCE}"`));
  assert.equal(fichiers.length, 116);
  const porteuses = fichiers.filter((f) => tagsDe(f) === '["codex", "Feu"]');
  assert.ok(porteuses.length >= 2, porteuses.join(', '));
  assert.deepEqual(fichiers.filter((f) => !porteuses.includes(f)).map(tagsDe).filter((t) => t !== '["codex"]'), [], 'les autres : « codex » seul');
  r = avec('--verifier', '--historique', absent);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // un mot-clé du glossaire qui porte le nom d'une magie dans un autre sens (« Corruption », la jauge : MAGIES_HOMONYMES) n'est pas posé sur ses temples
  writeFileSync(vocabulaire, `INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES ('codex', 'codex', 'codex', NULL), ('corruption', 'Corruption', 'corruption', 'Poison du chakra.');\n`);
  const cache = join(tmp, 'corruption');
  cpSync(join(tmp, 'lore'), join(cache, 'lore'), { recursive: true });
  assert.equal(codexPy('--out', cache, '--vocabulaire', vocabulaire, '--historique', absent).status, 0);
  assert.deepEqual(readdirSync(join(cache, 'lore')).filter((f) => f.endsWith('.md') && /^tags: .*Corruption/m.test(readFileSync(join(cache, 'lore', f), 'utf8'))), []);
  ecrireVocabulaire('Feu');
  // avec le vocabulaire de data/rows (sans « Feu ») : ces pages ne sont plus celles du découpage
  r = codexPy('--verifier', '--out', tmp, '--historique', absent);
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`\\(3\\) page différente du découpage : lore/${porteuses[0].slice(0, -3)}`));
  // « Feu » renommé « Flammes » sur le site : les pages qui le portent l'écrivent désormais ainsi
  for (const f of porteuses) writeFileSync(join(tmp, 'lore', f), readFileSync(join(tmp, 'lore', f), 'utf8').replace(/^(tags: \[.*)"Feu"(.*\])$/m, '$1"Flammes"$2'));
  ecrireVocabulaire('Flammes');
  // et un mot-clé retiré d'une autre page (page_tag supprimé : suppression ou fusion)
  const autre = 'les-divinites.md';
  assert.ok(!porteuses.includes(autre));
  const historique = join(tmp, 'historique.sql');
  writeFileSync(historique, [
    ligne(1, 'mot_cle', { id: 'feu' }, 'modifier', { libelle: 'Feu' }, { libelle: 'Flammes' }),
    ligne(2, 'page_tag', { page_id: 'lore/les-divinites', ordre: 1 }, 'supprimer', { page_id: 'lore/les-divinites', ordre: 1, tag_id: 'x' }, null),
  ].join('\n'));
  r = avec('--verifier', '--historique', historique);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`116 pages du Codex conformes au document \\(${porteuses.length + 1} modifiées depuis par le site de dev`));
  // sans l'historique : les pages diffèrent du découpage
  r = avec('--verifier', '--historique', absent);
  assert.equal(r.status, 1);
  // une nouvelle écriture les garde telles quelles (sinon l'ancienne écriture reviendrait)
  r = avec('--historique', historique);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const f of porteuses) assert.equal(tagsDe(f), '["codex", "Flammes"]', f);
});

// R145 (demande du propriétaire du 2026-10-18 : « Seulement là où il est pertinent ») et R183 (migration 0090 : « Sang », la quatrième barre de la
// magie du Sang, mot-clé du glossaire venu du Lexique) : la magie du Sang est un homonyme (tools/db/homonymes.py#MAGIES_HOMONYMES), l'import ne pose
// pas le mot-clé « Sang » sur ses temples. Sur l'export du Codex du dépôt (sources/raw/), sans dump.
test('R145, R183 : l’import du Codex ne pose pas le mot-clé « Sang » sur les temples de la magie du Sang (Confrérie du Sang, Pointe de Sang)', (t) => {
  // les deux pages sont bien celles que le découpage range sous « Magie de Sang » (codex.py#MAGIES : 'Magie de Sang' -> 'sang')
  const doc = readFileSync(join(racine, 'sources', 'raw', `${ID}.md`), 'utf8');
  const section = doc.slice(doc.indexOf('\n## Magie de Sang\n'), doc.indexOf('\n## ', doc.indexOf('\n## Magie de Sang\n') + 1));
  assert.match(section, /^### Confrérie du Sang \(Temple du sang\)$/m);
  assert.match(section, /La Pointe de Sang/);
  // le mot-clé « Sang » de la base (0090), cherché par son identifiant figé : le site de dev peut le renommer, ses deux écritures sont refusées
  // (il n'est pas protégé : supprimé par le site, le vocabulaire de data/rows ne l'a plus, et l'import ne peut pas davantage le poser)
  const sang = db.prepare("SELECT libelle FROM mot_cle WHERE id = 'sang'").get();
  if (!sang) assert.ok(historique.supprimee('mot_cle', { id: 'sang' }), 'le mot-clé « Sang » (0090) manque sans que le site de dev l’ait supprimé');
  const ecrituresDuSang = new Set(['sang', ...(sang ? [normalize(sang.libelle)] : [])]);
  for (const [nom, vocabulaire] of [
    ['un vocabulaire d’essai', "INSERT INTO mot_cle (id, libelle, libelle_cle, description) VALUES ('codex', 'codex', 'codex', NULL), ('sang', 'Sang', 'sang', 'La quatrième barre.');\n"],
    ['le vocabulaire de data/rows', null],
  ]) {
    const tmp = dossierTemporaire('codex-sang', { t });
    const args = ['--out', tmp, '--historique', join(tmp, 'absent.sql')];
    if (vocabulaire) {
      writeFileSync(join(tmp, 'mot_cle.sql'), vocabulaire);
      args.push('--vocabulaire', join(tmp, 'mot_cle.sql'));
    }
    const r = codexPy(...args);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const tags = (f) => JSON.parse(readFileSync(join(tmp, 'lore', f), 'utf8').match(/^tags: (.*)$/m)[1]);
    for (const page of ['confrerie-du-sang', 'la-pointe-de-sang']) assert.deepEqual(tags(`${page}.md`), ['codex'], `${nom} : lore/${page}`);
    assert.deepEqual(readdirSync(join(tmp, 'lore')).filter((f) => f.endsWith('.md') && tags(f).some((e) => ecrituresDuSang.has(normalize(e)))), [], nom);
  }
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

// La sortie de l'import (le texte des pages tel que codex.py l'a écrit), lue dans la base d'import (aide-base-d-import.mjs) : un renvoi est la balise du
// mot-clé dont l'adresse (mot_cle.url) mène à une page de la même base (migration des liens en mots-clés : « tous les liens deviendront des mots-clés et
// tous les mots-clés deviendront des liens ») ; un [[lien]] encore présent dans l'état d'import d'une page modifiée avant cette migration se résout par
// le slug, le titre ou un alias (lib/wikilinks-resolution.mjs). Un titre renommé par le site de dev ou une page supprimée depuis n'en fait pas un renvoi cassé.
test('les renvois du Codex mènent tous à une page (les sommaires ne citent que des pages produites)', () => {
  const base = baseDImport();
  const alias = Map.groupBy(base.prepare('SELECT page_id, texte FROM alias').all(), (a) => a.page_id);
  const index = buildIndex(base.prepare('SELECT id, type, slug, titre FROM page').all()
    .map((p) => ({ id: p.id, type: p.type, slug: p.slug, title: p.titre, aliases: (alias.get(p.id) ?? []).map((a) => a.texte) })));
  const adresses = indexDesAdresses(base);
  const motsCles = new Map(base.prepare('SELECT id, url FROM mot_cle').all().map((m) => [m.id, m]));
  const codex = base.prepare('SELECT p.id, p.corps_md FROM page p JOIN page_source ps ON ps.page_id = p.id AND ps.ordre = 0 JOIN source s ON s.id = ps.source_id WHERE s.texte = ? ORDER BY p.id').all(SOURCE);
  assert.equal(codex.length, 116);
  for (const p of codex) {
    for (const [, cible] of p.corps_md.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      assert.ok(resolve(index, cible), `${p.id} : [[${cible}]] ne mène à aucune page`);
    }
    for (const [, id] of p.corps_md.matchAll(/\{\{([a-z0-9-]+)(?:\\?\|[^{}]*)?\}\}/g)) {
      const m = motsCles.get(id);
      assert.ok(m, `${p.id} : {{${id}}} n’est pas un mot-clé`);
      if (m.url) assert.ok(pageDeLAdresse(adresses, m.url), `${p.id} : {{${id}}} (${m.url}) ne mène à aucune page`);
    }
  }
});

// L'état courant de la base : plus aucun lien dans les pages du Codex, chaque renvoi est la balise d'un mot-clé à adresse ; l'import ne crée jamais de
// mot-clé (règle de la 0056).
test('les renvois du Codex : des balises de mots-clés qui mènent chacun à une page, jamais un [[lien]] ni un lien Markdown', () => {
  /** Les renvois des pages du Codex dans `base` (chacun vérifié) : leur nombre. */
  const renvoisDe = (base) => {
    const index = indexDesAdresses(base);
    const motsCles = new Map(base.prepare('SELECT id, libelle, url FROM mot_cle').all().map((m) => [m.id, m]));
    const corps = base.prepare('SELECT corps_md FROM page WHERE id = ?');
    let renvois = 0;
    for (const p of pagesDuCodex) {
      const texte = corps.get(p.id)?.corps_md ?? '';
      assert.doesNotMatch(texte, /\[\[|\]\(\//, `${p.id} : un lien est resté`);
      for (const [, id] of texte.matchAll(/\{\{([a-z0-9-]+)(?:\\?\|[^{}]*)?\}\}/g)) {
        const m = motsCles.get(id);
        assert.ok(m, `${p.id} : {{${id}}} n’est pas un mot-clé`);
        if (!m.url) continue;   // un mot-clé du glossaire posé par le site de dev ou une migration (« chakra »)
        assert.ok(pageDeLAdresse(index, m.url), `${p.id} : {{${id}}} (${m.url}) ne mène à aucune page`);
        renvois += 1;
      }
    }
    return renvois;
  };
  // sur l'état courant, chaque renvoi (le site de dev supprime des mots-clés à adresse : leurs balises deviennent du texte) ; leur nombre, à l'import
  renvoisDe(db);
  const aLImport = renvoisDe(baseDImport());
  assert.ok(aLImport >= 200, `${aLImport} renvois à l’import`);
});

test('idempotence : une nouvelle écriture des pages du Codex sur la base actuelle n’en change aucune, et chaque renvoi a son mot-clé', (t) => {
  const tmp = dossierTemporaire('codex-idem', { t });
  cpSync(join(racine, 'client', 'src', 'content', 'wiki', 'lore'), join(tmp, 'lore'), { recursive: true });
  const r = codexPy('--out', tmp);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^116 pages du Codex \(0 écrites\)/m);
  assert.doesNotMatch(r.stdout, /renvoi sans mot-clé/);
  for (const f of readdirSync(join(tmp, 'lore'))) assert.equal(readFileSync(join(tmp, 'lore', f), 'utf8'), readFileSync(join(racine, 'client', 'src', 'content', 'wiki', 'lore', f), 'utf8'), f);
});

test('un renvoi sans exactement un mot-clé pour sa page : le texte simple, signalé (un import ne crée jamais de mot-clé) ; « {{id|texte}} » quand le texte n’est pas le libellé (d’import : un renommage du site garde « {{id}} ») ; le mot-clé d’une page n’étiquette pas sa partie', (t) => {
  const tmp = dossierTemporaire('codex-renvois', { t });
  const vocabulaire = join(tmp, 'mot_cle.sql');
  writeFileSync(vocabulaire, `INSERT INTO mot_cle (id, libelle, libelle_cle, description, url) VALUES ${[
    "('codex', 'codex', 'codex', NULL, '/lore/codex/')",
    "('mrode', 'Mrode', 'mrode', NULL, '/lore/mrode/')",
    "('erisia', 'Continent d’Erisia', 'continent-derisia', NULL, '/lore/erisia/')",
    "('temple-de-vent', 'Temple de Vent', 'temple-de-vent', NULL, '/lore/temple-de-vent/')",
    "('balogne', 'Balogne', 'balogne', NULL, '/lore/balogne/')",
    "('balogne-bis', 'Balogne bis', 'balogne-bis', NULL, '/lore/balogne/')",
    "('epee', 'Épée', 'epee', NULL, '/lore/mrode/#epee')",
  ].join(', ')};\n`);
  const args = ['--out', tmp, '--vocabulaire', vocabulaire, '--historique', join(tmp, 'absent.sql')];
  const r = codexPy(...args);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const page = (slug) => readFileSync(join(tmp, 'lore', `${slug}.md`), 'utf8');
  const civilisations = page('les-civilisations');
  assert.match(civilisations, /^- \{\{mrode\}\}$/m, 'le texte affiché est le libellé : la balise seule');
  assert.match(civilisations, /^- \{\{erisia\|Erisia\}\}$/m, 'un autre texte que le libellé : « {{id|texte}} »');
  const mrode = page('mrode');
  assert.match(mrode, /^- \{\{temple-de-vent\|Temple du Vent\}\}$/m, 'le renvoi « Voir “Temple du Vent” » du document, vers la page « Temple de Vent »');
  assert.match(mrode, /^ {2}- Saugnane$/m, 'aucun mot-clé pour la page : le texte simple');
  assert.match(mrode, /^ {2}- Balogne$/m, 'deux mots-clés pour la page : le texte simple');
  assert.match(mrode, /^tags: \["codex"\]$/m, 'le mot-clé « Mrode » (une adresse) n’étiquette pas les pages du continent');
  assert.match(page('saugnane'), /^tags: \["codex"\]$/m);
  for (const f of readdirSync(join(tmp, 'lore')).filter((f) => f.endsWith('.md'))) assert.doesNotMatch(page(f.slice(0, -3)), /\[\[|\]\(\//, f);
  assert.match(r.stdout, /renvoi sans mot-clé, écrit en texte simple : « Saugnane » \(0 mot\(s\)-clé\(s\) à l’adresse \/lore\/saugnane\/\)/);
  assert.match(r.stdout, /renvoi sans mot-clé, écrit en texte simple : « Balogne » \(2 mot\(s\)-clé\(s\) à l’adresse \/lore\/balogne\/ \(balogne, balogne-bis\)\)/);
  // le vérificateur relit les mêmes renvois (même vocabulaire) et les signale aussi
  const v = codexPy('--verifier', ...args);
  assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.match(v.stdout, /renvoi sans mot-clé, écrit en texte simple : « Saugnane »/);
  // « Mrode » renommé sur le site de dev (renommer ne réécrit aucun texte : « {{mrode}} » suit le libellé) : la page redonnée est la même, « {{mrode}} »
  writeFileSync(vocabulaire, readFileSync(vocabulaire, 'utf8').replace("('mrode', 'Mrode', 'mrode',", "('mrode', 'Mrode (continent)', 'mrode-continent',"));
  const historique = join(tmp, 'historique.sql');
  writeFileSync(historique, "INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES "
    + `('lot-renomme', 1, '2026-11-07T10:00:00Z', 'essai', NULL, 'mot_cle', '{"id":"mrode"}', 'modifier', '{"libelle":"Mrode","libelle_cle":"mrode"}', '{"libelle":"Mrode (continent)","libelle_cle":"mrode-continent"}');\n`);
  const renomme = ['--out', tmp, '--vocabulaire', vocabulaire, '--historique', historique];
  const w = codexPy(...renomme);
  assert.equal(w.status, 0, w.stdout + w.stderr);
  assert.match(w.stdout, /\(0 écrites\)/);
  assert.match(page('les-civilisations'), /^- \{\{mrode\}\}$/m);
  assert.equal(codexPy('--verifier', ...renomme).status, 0);
  // sans l'historique, le libellé courant n'est plus le texte du document : « {{mrode|Mrode}} »
  assert.equal(codexPy(...args).status, 0);
  assert.match(page('les-civilisations'), /^- \{\{mrode\|Mrode\}\}$/m);
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

// Le contrôle par mutation (suppressions du site de dev, lot 3) : --verifier refaisait le découpage avec le vocabulaire courant. Un mot-clé que le site
// a supprimé sans qu'il soit mentionné (R196), créé, ou dont il a changé l'adresse changeait les renvois attendus (« Balogne » : deux mots-clés pour la
// page, texte simple ; un seul après la suppression, sa balise), et les pages écrites par l'import devenaient des écarts. Le vérificateur relit le
// vocabulaire de l'état d'import (Vocabulaire(…, etat_d_import=True)) ; un vocabulaire d'import différent de celui des pages reste un écart.
test('--verifier : les renvois attendus se refont avec le vocabulaire de l’état d’import (mot-clé non mentionné supprimé, créé ou déplacé par le site, R196)', (t) => {
  const tmp = dossierTemporaire('codex-vocabulaire', { t });
  const sql = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
  const motsCles = (lignes) => `INSERT INTO mot_cle (id, libelle, libelle_cle, description, url) VALUES ${lignes.map((m) => `(${[m.id, m.libelle, m.libelle_cle, null, m.url].map(sql).join(', ')})`).join(', ')};\n`;
  const mc = (id, libelle, url) => ({ id, libelle, libelle_cle: id, url });
  const dImport = [mc('codex', 'codex', '/lore/codex/'), mc('mrode', 'Mrode', '/lore/mrode/'), mc('balogne', 'Balogne', '/lore/balogne/'), mc('balogne-bis', 'Balogne bis', '/lore/balogne/')];
  const vocabulaire = join(tmp, 'mot_cle.sql');
  const historique = join(tmp, 'historique.sql');
  writeFileSync(vocabulaire, motsCles(dImport));
  // les pages écrites par l'import (aucun historique)
  const ecrites = codexPy('--out', tmp, '--vocabulaire', vocabulaire, '--historique', join(tmp, 'absent.sql'));
  assert.equal(ecrites.status, 0, ecrites.stdout + ecrites.stderr);
  assert.match(ecrites.stdout, /renvoi sans mot-clé, écrit en texte simple : « Balogne » \(2 mot\(s\)-clé\(s\)/);
  const verifier = () => codexPy('--verifier', '--out', tmp, '--vocabulaire', vocabulaire, '--historique', historique);
  const op = (rang, id, operation, avant, apres) => `INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES `
    + `('lot-${rang}', 1, '2026-11-07T10:0${rang}:00Z', 'essai', NULL, 'mot_cle', ${sql(JSON.stringify({ id }))}, '${operation}', ${sql(avant && JSON.stringify(avant))}, ${sql(apres && JSON.stringify(apres))});`;
  const [, mrode, , bis] = dImport;
  const cree = mc('mrode-bis', 'Mrode bis', '/lore/mrode/');
  // le site supprime « Balogne bis » (aucune balise ne le cite), crée un second mot-clé vers « Mrode », puis déplace « Mrode » et le remet
  const courant = [...dImport.filter((m) => m !== bis), cree];
  const cas = [
    ['supprimé', dImport.filter((m) => m !== bis), [op(1, bis.id, 'supprimer', { ...bis, description: null }, null)]],
    ['créé', [...dImport, cree], [op(1, cree.id, 'inserer', null, { ...cree, description: null })]],
    ['déplacé', dImport.map((m) => (m === mrode ? { ...m, url: '/lore/ailleurs/' } : m)), [op(1, mrode.id, 'modifier', { url: mrode.url }, { url: '/lore/ailleurs/' })]],
    ['les trois', courant.map((m) => (m === mrode ? { ...m, url: '/lore/ailleurs/' } : m)), [
      op(1, bis.id, 'supprimer', { ...bis, description: null }, null), op(2, cree.id, 'inserer', null, { ...cree, description: null }),
      op(3, mrode.id, 'modifier', { url: mrode.url }, { url: '/lore/ailleurs/' }),
    ]],
  ];
  for (const [nom, actuel, lignes] of cas) {
    writeFileSync(vocabulaire, motsCles(actuel));
    writeFileSync(historique, `${lignes.join('\n')}\n`);
    const r = verifier();
    assert.equal(r.status, 0, `${nom} : ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /^116 pages du Codex conformes au document/m, nom);
    // sans l'historique, le vocabulaire courant passe pour celui de l'import : les renvois attendus changent, un écart
    writeFileSync(historique, '');
    const sans = verifier();
    assert.equal(sans.status, 1, `${nom} sans historique : ${sans.stdout}`);
    assert.match(sans.stdout, /\(3\) page différente du découpage : lore\//, nom);
  }
});
