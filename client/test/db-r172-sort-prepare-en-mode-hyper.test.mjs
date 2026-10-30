// Décision R172 du propriétaire, lot F : « un sort préparé pendant le Mode Hyper 100 % reste "préparé au 100 %", même après la sortie du 100 % »
// (« Aussi le +15/+7 ») ; réponse à Q82 (docs/sql/a-valider.md) : préparé pendant le Mode Hyper normal, il garde aussi son +15 (ou +7), « Oui : 2d6+20 ».
// Migration data/migrations/0086-r172-sort-prepare-en-mode-hyper.sql : personnage_sort.prepare_hyper et prepare_cent (0/1, 0 par défaut), calquées
// sur personnage.mode_hyper et mode_hyper_100 (0084) : prepare_hyper seulement sur le sort préparé (contrainte personnage_sort_prepare_hyper_avec_prepare),
// prepare_cent seulement sur un sort préparé en Mode Hyper (contrainte personnage_sort_prepare_cent_avec_prepare_hyper), comme prepare_jet et
// prepare_posture_id (R115, migration 0067). Les écritures se font dans une COPIE de la base construite, jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';

const MIGRATION = '0086-r172-sort-prepare-en-mode-hyper.sql';
const HYPER = 'personnage_sort_prepare_hyper_avec_prepare';
const CENT = 'personnage_sort_prepare_cent_avec_prepare_hyper';
const CLAUSES = [
  'CHECK (prepare_hyper IN (0, 1))', `CONSTRAINT ${HYPER} CHECK (prepare_hyper = 0 OR prepare = 1)`,
  'CHECK (prepare_cent IN (0, 1))', `CONSTRAINT ${CENT} CHECK (prepare_cent = 0 OR prepare_hyper = 1)`,
];
const INSTANT = '2026-10-30T12:00:00Z';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const sqlDeLaTable = (db) => db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage_sort'").get().sql;

/** Une copie de la base construite, ouverte en écriture, fermée à la fin du test `t`, avec un prétiré minimal `p`. */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'r172-prepare', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  t.after(() => db.close());
  db.prepare(`INSERT INTO personnage (id, nature, proprietaire_id, visibilite, nom, mode_classe, xp, alignement_loyal, alignement_chaotique,
    alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le)
    VALUES ('p', 'pretire', NULL, 'tous', 'Essai R172 sort préparé', 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)`).run(INSTANT, INSTANT);
  return db;
}

/** Deux sorts quelconques de la base (les colonnes ne dépendent pas du sort). */
const deuxSorts = (db) => db.prepare('SELECT id FROM sort ORDER BY id LIMIT 2').all().map((s) => s.id);

/** Insère le sort `sortId` au rang `rang` de la fiche `p`, avec les colonnes de `plus`. */
function inserer(db, sortId, rang, plus = {}) {
  const ligne = { personnage_id: 'p', sort_id: sortId, rang, niveau_maitrise: 0, ...plus };
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO personnage_sort (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
const etat = (db, sortId) => ({
  ...db.prepare('SELECT prepare, prepare_hyper, prepare_cent FROM personnage_sort WHERE personnage_id = ? AND sort_id = ?').get('p', sortId),
});
const REPOS = { prepare: 0, prepare_hyper: 0, prepare_cent: 0 };

test('R172 : personnage_sort finit par prepare_hyper et prepare_cent (0/1, 0 par défaut, NOT NULL), sans ligne dans data/rows', () => {
  const db = ouvrirBase({ sansExemples: false });
  const colonnes = db.prepare('PRAGMA table_xinfo(personnage_sort)').all();
  assert.deepEqual(colonnes.slice(-2).map(({ name, type, notnull, dflt_value: defaut }) => ({ name, type, notnull, defaut })), [
    { name: 'prepare_hyper', type: 'INTEGER', notnull: 1, defaut: '0' },
    { name: 'prepare_cent', type: 'INTEGER', notnull: 1, defaut: '0' },
  ]);
  assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 86, 'schéma d’au moins la version de la migration 0086');
  // section 13 : data/rows garde la table des fiches vide
  assert.equal(db.prepare('SELECT count(*) AS n FROM personnage_sort').get().n, 0);
  for (const [nom, sql] of [['data/schema.sql', lire('data/schema.sql')], ['migration 0086', lire(`data/migrations/${MIGRATION}`)],
    ['base construite', sqlDeLaTable(db)]]) {
    for (const clause of CLAUSES) assert.ok(sql.includes(clause), `${nom} : ${clause}`);
  }
});

test('R172 (Q82) : « préparé en Mode Hyper » seulement sur le sort préparé, « au 100 % » seulement sur un sort préparé en Mode Hyper', (t) => {
  const db = copie(t);
  const [a, b] = deuxSorts(db);
  inserer(db, a, 1);
  assert.deepEqual(etat(db, a), REPOS, 'défauts : ni préparé, ni en Mode Hyper, ni au 100 %');

  const refusee = (plus, message, quoi) => assert.throws(() => inserer(db, b, 2, plus), { message }, quoi);
  refusee({ prepare_hyper: 1 }, `CHECK constraint failed: ${HYPER}`, 'en Mode Hyper sans être préparé');
  refusee({ prepare: 1, prepare_cent: 1 }, `CHECK constraint failed: ${CENT}`, 'au 100 % sans Mode Hyper');
  refusee({ prepare_hyper: 1, prepare_cent: 1 }, `CHECK constraint failed: ${HYPER}`, 'au 100 % sans être préparé');
  refusee({ prepare: 1, prepare_hyper: 2 }, /CHECK constraint failed: prepare_hyper IN/, 'case Mode Hyper à 2');
  refusee({ prepare: 1, prepare_hyper: 1, prepare_cent: 2 }, /CHECK constraint failed: prepare_cent IN/, 'case 100 % à 2');
  refusee({ prepare: 1, prepare_hyper: null }, /NOT NULL constraint failed: personnage_sort\.prepare_hyper/, 'case Mode Hyper nulle');
  refusee({ prepare: 1, prepare_cent: null }, /NOT NULL constraint failed: personnage_sort\.prepare_cent/, 'case 100 % nulle');

  // témoins : préparé au 100 % ; « Lâcher le sort » sans remettre les cases à 0 est refusé, tout ensemble passe
  inserer(db, b, 2, { prepare: 1, prepare_hyper: 1, prepare_cent: 1, prepare_jet: 42 });
  assert.deepEqual(etat(db, b), { prepare: 1, prepare_hyper: 1, prepare_cent: 1 });
  const lacher = (sql) => db.prepare(`UPDATE personnage_sort SET prepare = 0, prepare_jet = NULL${sql} WHERE sort_id = ?`).run(b);
  assert.throws(() => lacher(''), { message: `CHECK constraint failed: ${HYPER}` });
  assert.throws(() => lacher(', prepare_hyper = 0'), { message: `CHECK constraint failed: ${CENT}` });
  lacher(', prepare_hyper = 0, prepare_cent = 0');
  assert.deepEqual(etat(db, b), REPOS);
  // préparé en Mode Hyper normal (2d6+20 : Q82), puis hors du Mode Hyper : les deux sont permis
  db.prepare('UPDATE personnage_sort SET prepare = 1, prepare_hyper = 1 WHERE sort_id = ?').run(a);
  assert.deepEqual(etat(db, a), { prepare: 1, prepare_hyper: 1, prepare_cent: 0 });
  db.prepare('UPDATE personnage_sort SET prepare_hyper = 0 WHERE sort_id = ?').run(a);
  assert.deepEqual(etat(db, a), { prepare: 1, prepare_hyper: 0, prepare_cent: 0 });
});

test('R172 : la migration 0086 donne au sort préparé d\'une fiche d\'avant prepare_hyper = prepare_cent = 0 et la table de data/schema.sql', (t) => {
  const db = copie(t);
  const attendu = sqlDeLaTable(db);
  const [a, b] = deuxSorts(db);
  // la table d'avant 0086 : sans les deux colonnes (prepare_cent d'abord : sa contrainte lit prepare_hyper)
  for (const c of ['prepare_cent', 'prepare_hyper']) db.exec(`ALTER TABLE personnage_sort DROP COLUMN ${c}`);
  assert.ok(!db.prepare('PRAGMA table_xinfo(personnage_sort)').all().some((c) => ['prepare_hyper', 'prepare_cent'].includes(c.name)));
  inserer(db, a, 1);
  inserer(db, b, 2, { prepare: 1, prepare_jet: 87 });
  rejouerLaMigration(db, MIGRATION);
  assert.deepEqual([etat(db, a), etat(db, b)], [REPOS, { prepare: 1, prepare_hyper: 0, prepare_cent: 0 }],
    'aucun sort préparé d’avant ne l’a été en Mode Hyper');
  const normal = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([,()]) ?/g, '$1').trim();
  assert.equal(normal(sqlDeLaTable(db)), normal(attendu));
});
