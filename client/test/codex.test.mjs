// Codex : le Google Doc « CODEX Maverick » (copie du propriétaire, 2026-10-11) découpé en pages `lore/` par tools/docs/codex.py (docs/codex.md).
// Le texte des pages est celui du document, aux corrections du registre près (tools/docs/codex-corrections.json : décision R21, fautes déjà corrigées
// dans toute la base) ; le vérificateur du script relit l'export ligne par ligne, sans le découpage, et compare les pages fabriquées depuis data/rows.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { NAV } from '../src/lib/nav.mjs';
import { normalize } from '../src/lib/text.mjs';

const racine = trouverRacine();
const db = ouvrirBase({ sansExemples: false });
const SOURCE = 'Google Doc « CODEX Maverick »';
const ID = '1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg';
const pagesDuCodex = db
  .prepare("SELECT p.id, p.titre, p.statut, p.origine, p.corps_md FROM page p JOIN page_source ps ON ps.page_id = p.id AND ps.ordre = 0 JOIN source s ON s.id = ps.source_id WHERE s.texte = ? ORDER BY p.id")
  .all(SOURCE);

test('chaque ligne du document est dans une page, et les pages sont celles du découpage (tools/docs/codex.py --verifier)', () => {
  const r = spawnSync('python3', ['-I', join(racine, 'tools', 'docs', 'codex.py'), '--verifier'], { encoding: 'utf8', cwd: racine });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^116 pages du Codex conformes au document$/m);
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
  for (const p of pagesDuCodex) {
    for (const [, cible] of p.corps_md.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      assert.ok(titres.has(normalize(cible)) || alias.has(normalize(cible)), `${p.id} : [[${cible}]] ne mène à aucune page`);
    }
  }
});

test('décision R21 : la divinité de la Corruption s’appelle Eaunoire, la graphie du document « Eaunoir » reste en alias', () => {
  const page = db.prepare("SELECT titre, corps_md FROM page WHERE id = 'lore/eaunoire'").get();
  assert.equal(page.titre, 'Eaunoire');
  assert.deepEqual(db.prepare("SELECT texte FROM alias WHERE page_id = 'lore/eaunoire'").all().map((a) => a.texte), ['Eaunoir']);
  for (const p of pagesDuCodex) assert.doesNotMatch(p.corps_md, /Eaunoir(?!e)|mon d[’']eau noire/i, p.id);
  assert.equal(db.prepare('SELECT nom FROM dieu WHERE id = ?').get('demon-deau-noire').nom, 'Eaunoire', 'le même nom que la liste des dieux');
});

test('registre de corrections : décrit, appliqué à l’export (qui reste tel quel), sans toucher un chiffre', () => {
  const registre = JSON.parse(readFileSync(join(racine, 'tools', 'docs', 'codex-corrections.json'), 'utf8'));
  const brut = readFileSync(join(racine, 'sources', 'raw', `${ID}.md`), 'utf8');
  const corps = pagesDuCodex.map((p) => p.corps_md).join('\n');
  for (const c of registre.corrections) {
    assert.ok(c.avant && c.apres && c.raison && c.nature && Number.isInteger(c.occurrences), JSON.stringify(c));
    assert.equal(c.avant.replace(/\D/g, ''), c.apres.replace(/\D/g, ''), `${c.avant} : un chiffre changerait`);
    assert.ok(brut.includes(c.avant), `« ${c.avant} » : l’export garde le texte du document`);
    assert.ok(corps.includes(c.apres), `« ${c.apres} » : absent des pages`);
  }
});
