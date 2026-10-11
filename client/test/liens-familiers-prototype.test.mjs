// Plus aucun lien vers les classeurs Google « Familiers » et « Prototype » (demande du propriétaire, migration data/migrations/0019-liens-familiers-prototype.sql) :
// ni dans la base (hyperliens de cellule du Mage Bleu et de la page des familiers, avec la phrase qui portait le second), ni dans le manifeste ou les
// extracteurs ; la page des archives ne les montre pas (test/archives.test.mjs).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const racine = (chemin) => fileURLToPath(new URL(`../../${chemin}`, import.meta.url));
const lire = (chemin) => readFileSync(racine(chemin), 'utf8');
const registre = JSON.parse(lire('data/migrations/0014-sources-copies-drive.json'));
const retires = registre.copies.filter((c) => ['Familiers', 'Prototype'].includes(c.titre));
const ids = retires.flatMap((c) => [c.avant, c.apres]);
const db = ouvrirBase({ sansExemples: false });

test('registre : les deux classeurs retirés sont des copies connues', () => {
  assert.deepEqual(retires.map((c) => [c.titre, c.genre]), [['Familiers', 'sheet'], ['Prototype', 'sheet']]);
});

test('base : aucune colonne de texte ne cite plus « Familiers » ni « Prototype » (copie ou original)', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all();
  for (const { name } of tables) {
    for (const { name: col } of db.prepare('SELECT name FROM pragma_table_info(?) WHERE type = ?').all(name, 'TEXT')) {
      for (const id of ids) assert.equal(db.prepare(`SELECT count(*) AS n FROM "${name}" WHERE instr("${col}", ?) > 0`).get(id).n, 0, `${name}.${col} cite ${id}`);
    }
  }
});

test('Mage Bleu : plus de lien sous « CHOSE A SAVOIR », le texte reste', () => {
  const classe = db.prepare("SELECT chose_a_savoir, chose_a_savoir_lien FROM classe WHERE id = 'classes/mage-bleu'").get();
  assert.equal(classe.chose_a_savoir_lien, null);
  assert.match(classe.chose_a_savoir, /Cette classe commence avec un gros familier\.$/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM classe WHERE chose_a_savoir_lien IS NOT NULL').get().n, 0);
  const page = db.prepare("SELECT corps_md FROM page WHERE id = 'classes/mage-bleu'").get().corps_md;
  assert.ok(page.includes('Cette classe commence avec un gros familier.\n\n## Don de départ'), 'la ligne « Lien hypertexte… » est retirée');
});

test('page des familiers : la phrase « Ici pour les fiches : Familiers » part avec son lien, la présentation et le tableau restent', () => {
  const page = db.prepare("SELECT corps_md FROM page WHERE id = 'ressources/familiers'").get().corps_md;
  assert.doesNotMatch(page, /Ici pour les fiches|Lien hypertexte/);
  assert.ok(page.includes('qu’elles soient magiques ou matérielles.\n\n| Nom | Description |'), 'le tableau des gros familiers suit la présentation');
});

test('manifeste et extracteurs : aucun identifiant des deux classeurs', () => {
  const textes = [['sources/sources.json', lire('sources/sources.json')]];
  for (const f of readdirSync(racine('tools/sheets')).filter((x) => x.endsWith('.py'))) textes.push([`tools/sheets/${f}`, lire(`tools/sheets/${f}`)]);
  for (const [chemin, texte] of textes) for (const id of ids) assert.ok(!texte.includes(id), `${chemin} cite ${id}`);
});
