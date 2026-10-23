// Décision R160 du propriétaire (2026-10-23) : « Il n'existe aucune gemme ni aucune piece élémentaire du PI. » ; « La base refuse : la base elle-même
// interdit une gemme, un bâton ou une pièce élémentaire du PI : une migration ou une édition du site de dev qui en ajoute une échoue, et un test
// l'épingle. » Étendue au bois par le propriétaire : « Oui, aucun bois du PI ». Migration data/migrations/0078-r160-potentiel-illimite-sans-gemme.sql :
// une contrainte CHECK nommée <table>_sans_potentiel_illimite sur gemme, bois, baton_magique, arme_elementaire et armure_elementaire. Les écritures se font dans une COPIE de la base construite, jamais dans
// var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const PI = 'magies/potentiel-illimite';
// table -> sa clé primaire (une colonne)
const TABLES = { gemme: 'ressource_id', bois: 'ressource_id', baton_magique: 'id', arme_elementaire: 'id', armure_elementaire: 'id' };
const contrainte = (table) => `${table}_sans_potentiel_illimite`;
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');

const db = ouvrirBase({ sansExemples: false });
const copie = fichierTemporaire('maverick.db', 'r160');
copyFileSync(cheminBase({ sansExemples: false }), copie);
const ecrite = new DatabaseSync(copie);
ecrite.exec('PRAGMA foreign_keys = ON');
after(() => ecrite.close());

test('R160 : aucune gemme, aucun bois, aucun bâton, aucune pièce élémentaire du Potentiel Illimité dans la base', () => {
  assert.ok(db.prepare('SELECT 1 FROM magie WHERE id = ?').get(PI), 'la magie du Potentiel Illimité existe');
  for (const table of Object.keys(TABLES)) {
    assert.deepEqual(db.prepare(`SELECT * FROM ${table} WHERE magie_id = ?`).all(PI), [], table);
    assert.ok(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n > 0, `${table} n'est pas vide`);
  }
});

test('R160 : le schéma et la migration 0078 portent la contrainte nommée de chaque table, en SQL standard', () => {
  const schema = lire('data/schema.sql');
  const migration = lire('data/migrations/0078-r160-potentiel-illimite-sans-gemme.sql');
  for (const table of Object.keys(TABLES)) {
    const clause = `CONSTRAINT ${contrainte(table)} CHECK (magie_id <> '${PI}')`;
    assert.ok(schema.includes(clause), `data/schema.sql : ${clause}`);
    assert.ok(migration.includes(clause), `migration 0078 : ${clause}`);
    assert.ok(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table).sql.includes(clause), `base construite : ${table}`);
  }
});

test('R160 : une ligne du Potentiel Illimité est refusée par la base dans chacune des cinq tables (insertion et modification)', () => {
  for (const [table, cle] of Object.entries(TABLES)) {
    const ligne = ecrite.prepare(`SELECT * FROM ${table} ORDER BY ${cle} LIMIT 1`).get();
    const colonnes = Object.keys(ligne);
    const inserer = (valeurs) => ecrite.prepare(`INSERT INTO ${table} (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`)
      .run(...colonnes.map((c) => valeurs[c]));
    ecrite.exec('BEGIN');
    try {
      ecrite.exec('PRAGMA defer_foreign_keys = ON');   // armure_elementaire_effet cite la ligne retirée le temps du test (transaction annulée)
      ecrite.prepare(`DELETE FROM ${table} WHERE ${cle} = ?`).run(ligne[cle]);
      // la même ligne, au seul magie_id près : refusée par la contrainte nommée, et par elle seule
      assert.throws(() => inserer({ ...ligne, magie_id: PI }), { message: `CHECK constraint failed: ${contrainte(table)}` }, table);
      inserer(ligne);   // témoin : la ligne d'origine se réinsère
      assert.throws(() => ecrite.prepare(`UPDATE ${table} SET magie_id = ? WHERE ${cle} = ?`).run(PI, ligne[cle]),
        { message: `CHECK constraint failed: ${contrainte(table)}` }, `${table} (modification)`);
    } finally {
      ecrite.exec('ROLLBACK');
    }
    assert.equal(ecrite.prepare(`SELECT count(*) AS n FROM ${table} WHERE magie_id = ?`).get(PI).n, 0, table);
  }
});
