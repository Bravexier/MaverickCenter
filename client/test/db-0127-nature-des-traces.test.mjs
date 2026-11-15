// Migration data/migrations/0127-nature-des-traces.sql (chantier « la base du site de dev devient la source de vérité », R274, R275 ; lot 6,
// garde-fou 11 : « Chaque trace porte sa nature ») : modification_lot et historique_modification gagnent `nature` (saisie, source, decision,
// migration, code ; 'saisie' par défaut) et `decision` (le numéro « R… » de la décision, présent si et seulement si nature = 'decision').
// Les contraintes se vérifient sur une base neuve en mémoire (data/schema.sql), jamais sur la base ; la migration se rejoue sur des tables
// remises dans leur forme d'avant (les deux colonnes retirées), avec une ligne d'avant.
//   node --test test/db-0127-nature-des-traces.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const TABLES = ['modification_lot', 'historique_modification'];
const NATURES = ['saisie', 'source', 'decision', 'migration', 'code'];
const FAIT_LE = '2026-11-14T10:00:00Z';

function baseNeuve() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return db;
}

/** Pose une trace de chaque table ; `nature` absente : la colonne prend sa valeur par défaut. */
function poser(db, table, { nature, decision = null } = {}) {
  const avecNature = nature === undefined ? '' : ', nature';
  const valeurNature = nature === undefined ? '' : ', ?';
  const params = nature === undefined ? [decision] : [decision, nature];
  if (table === 'modification_lot') {
    db.prepare(`INSERT INTO modification_lot (id, fait_le, resume, decision${avecNature}) VALUES ('lot-essai', '${FAIT_LE}', 'essai', ?${valeurNature})`).run(...params);
  } else {
    db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, table_nom, cle, operation, avant, apres, decision${avecNature})
      VALUES ('lot-essai', 1, '${FAIT_LE}', 'essai', 'page', '{"id":"x"}', 'modifier', '{}', '{}', ?${valeurNature})`).run(...params);
  }
}

test('structure (data/schema.sql) : nature puis decision, en dernier, dans les deux tables', () => {
  const db = baseNeuve();
  try {
    for (const table of TABLES) {
      const colonnes = db.prepare(`PRAGMA table_info(${table})`).all();
      const [nature, decision] = colonnes.slice(-2);
      assert.deepEqual([nature.name, nature.type, nature.notnull, nature.dflt_value], ['nature', 'TEXT', 1, "'saisie'"], table);
      assert.deepEqual([decision.name, decision.type, decision.notnull, decision.dflt_value], ['decision', 'TEXT', 0, null], table);
    }
  } finally {
    db.close();
  }
});

test('contrainte (base neuve) : une des cinq natures, saisie par défaut ; le numéro « R… » si et seulement si decision (R275)', () => {
  const db = baseNeuve();
  try {
    for (const table of TABLES) {
      const vider = () => db.exec(`DELETE FROM ${table}`);
      poser(db, table);
      assert.deepEqual({ ...db.prepare(`SELECT nature, decision FROM ${table}`).get() }, { nature: 'saisie', decision: null }, table);
      vider();
      for (const nature of NATURES.filter((n) => n !== 'decision')) {
        assert.doesNotThrow(() => poser(db, table, { nature }), `${table} ${nature}`);
        vider();
        assert.throws(() => poser(db, table, { nature, decision: 'R275' }), /CHECK/, `${table} ${nature} avec un numéro`);
      }
      for (const decision of ['R1', 'R275', 'R1000']) {
        assert.doesNotThrow(() => poser(db, table, { nature: 'decision', decision }), `${table} ${decision}`);
        vider();
      }
      for (const decision of [null, '', 'R', '275', 'r275', 'R27a', 'R 275', 'R275 ', 'R275(2)', 'RR275']) {
        assert.throws(() => poser(db, table, { nature: 'decision', decision }), /CHECK/, `${table} ${JSON.stringify(decision)}`);
      }
      for (const nature of ['', 'Saisie', 'décision', 'import', 'site']) {
        assert.throws(() => poser(db, table, { nature }), /CHECK/, `${table} ${JSON.stringify(nature)}`);
      }
      assert.throws(() => poser(db, table, { nature: null }), /NOT NULL/, `${table} nature NULL`);
    }
  } finally {
    db.close();
  }
});

test('migration rejouée : les traces d’avant valent « saisie », sans numéro ; les tables reprennent la forme de data/schema.sql', () => {
  const db = baseNeuve();
  try {
    const attendu = Object.fromEntries(TABLES.map((t) => [t, db.prepare(`PRAGMA table_xinfo(${t})`).all().map((c) => ({ ...c }))]));
    for (const table of TABLES) {
      // forme d'avant la 0127 : decision d'abord (sa contrainte lit nature)
      db.exec(`ALTER TABLE ${table} DROP COLUMN decision; ALTER TABLE ${table} DROP COLUMN nature`);
    }
    db.prepare(`INSERT INTO modification_lot (id, fait_le, resume) VALUES ('lot-avant', '${FAIT_LE}', 'avant')`).run();
    db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, table_nom, cle, operation, avant, apres)
      VALUES ('lot-avant', 1, '${FAIT_LE}', 'avant', 'page', '{"id":"x"}', 'modifier', '{}', '{}')`).run();
    db.exec('BEGIN');
    rejouerLaMigration(db, '0127-nature-des-traces.sql');
    db.exec('COMMIT');
    for (const table of TABLES) {
      assert.deepEqual(db.prepare(`PRAGMA table_xinfo(${table})`).all().map((c) => ({ ...c })), attendu[table], table);
      assert.deepEqual(db.prepare(`SELECT nature, decision FROM ${table}`).all().map((r) => ({ ...r })), [{ nature: 'saisie', decision: null }], table);
      assert.throws(() => db.prepare(`UPDATE ${table} SET nature = 'decision'`).run(), /CHECK/, `${table} : decision sans numéro`);
    }
  } finally {
    db.close();
  }
});
