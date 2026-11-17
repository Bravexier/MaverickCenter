// Décision R172 du propriétaire : le Mode Hyper et le Mode Hyper 100 % deviennent deux cases activables de la fiche, « comme pour les posture » (état
// enregistré avec la fiche), le Mode Hyper 100 % « activable que quand le mode hyper l'est déjà », et « une fois par semaine » un « compteur manuel ».
// Migration data/migrations/0084-r172-mode-hyper-activable.sql : personnage.mode_hyper et mode_hyper_100 (0/1, 0 par défaut ; contrainte nommée
// personnage_mode_hyper_100_avec_mode_hyper), personnage.mode_hyper_semaine (utilisations restantes, >= 0 ; NULL = au maximum). Les niveaux qui les
// débloquent restent des règles du moteur : la base ne refuse pas une case cochée sous le niveau. Les écritures se font dans une COPIE de la base
// construite, jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';

const MIGRATION = '0084-r172-mode-hyper-activable.sql';
const CONTRAINTE = 'personnage_mode_hyper_100_avec_mode_hyper';
const COLONNES = ['mode_hyper', 'mode_hyper_100', 'mode_hyper_semaine'];
const INSTANT = '2026-10-29T12:00:00Z';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');

/** Une copie de la base construite, ouverte en écriture, fermée à la fin du test `t`. */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'r172', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  t.after(() => db.close());
  return db;
}

/** Un prétiré minimal (aucune colonne du Mode Hyper sauf celles de `plus`). */
function inserer(db, id, plus = {}) {
  const ligne = {
    id, nature: 'pretire', proprietaire_id: null, visibilite: 'tous', nom: `Essai ${id}`, mode_classe: 'mono', xp: 0,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT, ...plus,
  };
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO personnage (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
const etat = (db, id) => ({ ...db.prepare(`SELECT ${COLONNES.join(', ')} FROM personnage WHERE id = ?`).get(id) });

test('R172 : personnage finit par mode_hyper, mode_hyper_100 (0/1, 0 par défaut) et mode_hyper_semaine (NULL par défaut), sans ligne dans data/rows', () => {
  const db = ouvrirBase({ sansExemples: false });
  const colonnes = db.prepare('PRAGMA table_xinfo(personnage)').all();
  assert.deepEqual(colonnes.slice(-3).map(({ name, type, notnull, dflt_value: defaut }) => ({ name, type, notnull, defaut })), [
    { name: 'mode_hyper', type: 'INTEGER', notnull: 1, defaut: '0' },
    { name: 'mode_hyper_100', type: 'INTEGER', notnull: 1, defaut: '0' },
    { name: 'mode_hyper_semaine', type: 'INTEGER', notnull: 0, defaut: null },
  ]);
  assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 84, 'schéma d’au moins la version de la migration 0084');
  // section 13 : data/rows garde la table des fiches vide
  assert.equal(db.prepare('SELECT count(*) AS n FROM personnage').get().n, 0);
  const clause = `CONSTRAINT ${CONTRAINTE} CHECK (mode_hyper_100 = 0 OR mode_hyper = 1)`;
  for (const [nom, sql] of [['data/schema.sql', lire('data/schema.sql')], ['migration 0084', lire(`data/migrations/${MIGRATION}`)],
    ['base construite', db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage'").get().sql]]) {
    assert.ok(sql.includes(clause), `${nom} : ${clause}`);
    assert.ok(sql.includes('CHECK (mode_hyper_semaine IS NULL OR mode_hyper_semaine >= 0)'), `${nom} : mode_hyper_semaine`);
  }
});

test('R172 : le Mode Hyper 100 % ne s\'enregistre qu\'avec le Mode Hyper ; cases à 0 ou 1, compteur entier positif ou nul', (t) => {
  const db = copie(t);
  inserer(db, 'r172-defaut');
  assert.deepEqual(etat(db, 'r172-defaut'), { mode_hyper: 0, mode_hyper_100: 0, mode_hyper_semaine: null }, 'défauts : rien d’actif, compteur au maximum');

  const refusee = (plus, message, quoi) => assert.throws(() => inserer(db, `r172-${quoi}`, plus), { message }, quoi);
  refusee({ mode_hyper_100: 1 }, `CHECK constraint failed: ${CONTRAINTE}`, '100-seul');
  refusee({ mode_hyper: 2 }, /CHECK constraint failed: mode_hyper IN/, 'case-2');
  refusee({ mode_hyper: 1, mode_hyper_100: 2 }, /CHECK constraint failed: mode_hyper_100 IN/, 'case-100-2');
  refusee({ mode_hyper_semaine: -1 }, /CHECK constraint failed: mode_hyper_semaine IS NULL OR/, 'compteur-negatif');
  refusee({ mode_hyper: null }, /NOT NULL constraint failed: personnage\.mode_hyper/, 'case-nulle');

  // témoins : Mode Hyper seul, puis les deux, compteur consommé
  inserer(db, 'r172-hyper', { mode_hyper: 1, mode_hyper_semaine: 0 });
  inserer(db, 'r172-cent', { mode_hyper: 1, mode_hyper_100: 1, mode_hyper_semaine: 0 });
  assert.deepEqual(etat(db, 'r172-cent'), { mode_hyper: 1, mode_hyper_100: 1, mode_hyper_semaine: 0 });
  // la base ne décoche pas d'elle-même : décocher le Mode Hyper sans le 100 % est refusé, les deux ensemble passent
  assert.throws(() => db.prepare('UPDATE personnage SET mode_hyper = 0 WHERE id = ?').run('r172-cent'), { message: `CHECK constraint failed: ${CONTRAINTE}` });
  db.prepare('UPDATE personnage SET mode_hyper = 0, mode_hyper_100 = 0, mode_hyper_semaine = NULL WHERE id = ?').run('r172-cent');
  assert.deepEqual(etat(db, 'r172-cent'), { mode_hyper: 0, mode_hyper_100: 0, mode_hyper_semaine: null });
});

test('R172 : la migration 0084 donne à une fiche d\'avant les valeurs par défaut (rien d\'actif, compteur au maximum) et la table de data/schema.sql', (t) => {
  const db = copie(t);
  const attendu = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage'").get().sql;
  // la table d'avant 0084 : sans les trois colonnes (mode_hyper_100 d'abord : sa contrainte lit mode_hyper)
  for (const c of ['mode_hyper_100', 'mode_hyper', 'mode_hyper_semaine']) db.exec(`ALTER TABLE personnage DROP COLUMN ${c}`);
  assert.ok(!db.prepare('PRAGMA table_xinfo(personnage)').all().some((c) => COLONNES.includes(c.name)));
  inserer(db, 'r172-avant');
  rejouerLaMigration(db, MIGRATION);
  assert.deepEqual(etat(db, 'r172-avant'), { mode_hyper: 0, mode_hyper_100: 0, mode_hyper_semaine: null });
  const normal = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([,()]) ?/g, '$1').trim();
  assert.equal(normal(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'personnage'").get().sql), normal(attendu));
});
