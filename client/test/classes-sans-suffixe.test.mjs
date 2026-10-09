// « (classe) » supprimé de partout, base comprise (demande du propriétaire, migration data/migrations/0009-classes-sans-suffixe.sql) : une classe raciale
// porte le nom de sa race, comme toute classe porte le nom de son onglet ; le chemin (classes/orios, races/orios) distingue les deux pages.
// Le site construit est contrôlé par test/classes-html.test.mjs (aucune page n'écrit « (classe) »).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase({ sansExemples: false });

test('aucune colonne de texte d’aucune table ne contient « (classe) »', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '*_fts*'").all().map((r) => r.name);
  const trouves = [];
  for (const t of tables) {
    for (const c of db.prepare(`PRAGMA table_info("${t}")`).all().filter((c) => /TEXT/i.test(c.type))) {
      const n = db.prepare(`SELECT count(*) AS n FROM "${t}" WHERE "${c.name}" LIKE '%(classe)%'`).get().n;
      if (n) trouves.push(`${t}.${c.name} : ${n}`);
    }
  }
  assert.deepEqual(trouves, []);
});

test('les 13 classes raciales : titre de la page = nom de la classe = titre de la page de la race', () => {
  const lignes = db
    .prepare(
      `SELECT c.id, c.nom, p.titre, p.titre_cle, r.titre AS titre_race FROM classe c JOIN page p ON p.id = c.id
       LEFT JOIN page r ON r.id = 'races/' || c.nom_cle WHERE c.categorie_id = 'classe-hybride-animal' ORDER BY c.id`,
    )
    .all();
  assert.equal(lignes.length, 13);
  for (const l of lignes) {
    assert.equal(l.titre, l.nom, l.id);
    assert.equal(l.titre_cle, l.id.slice('classes/'.length), l.id);
    assert.ok(l.titre_race, `${l.id} : la race du même nom existe`);
  }
});
