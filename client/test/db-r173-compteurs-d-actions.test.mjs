// Décision R173 du propriétaire : la fiche liste les actions utilisables ; « Il faudrai pouvoir les sélectionner pour les "consommer" (et griser si
// plus utilisable) », « fin de combat » remet les compteurs « par combat » au maximum, les autres ne remontent qu'à la main, et les compteurs
// s'enregistrent avec la fiche. Migration data/migrations/0085-r173-compteurs-d-actions.sql : personnage_action_usage (personnage_id, action_id,
// restants), clé primaire (personnage_id, action_id), sans clé étrangère sur action_id (clé opaque du moteur de la fiche), restants >= 0, une ligne
// absente = compteur au maximum (rien de stocké pour une fiche neuve), lignes supprimées avec la fiche. Les écritures se font dans une COPIE de la base
// construite, jamais dans var/maverick.db ni dans data/rows.
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';

const TABLE = 'personnage_action_usage';
const MIGRATION = '0085-r173-compteurs-d-actions.sql';
const INSTANT = '2026-10-30T12:00:00Z';
const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const sqlDeLaTable = (db) => db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(TABLE)?.sql;

/** Une copie de la base construite, ouverte en écriture, fermée à la fin du test `t`. */
function copie(t) {
  const chemin = fichierTemporaire('maverick.db', 'r173', { t });
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  t.after(() => db.close());
  return db;
}

/** Un prétiré minimal. */
function fiche(db, id) {
  const ligne = {
    id, nature: 'pretire', proprietaire_id: null, visibilite: 'tous', nom: `Essai ${id}`, mode_classe: 'mono', xp: 0,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT,
  };
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO personnage (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
const usage = (db, personnage_id, action_id, restants) =>
  db.prepare(`INSERT INTO ${TABLE} (personnage_id, action_id, restants) VALUES (?, ?, ?)`).run(personnage_id, action_id, restants);
const compteurs = (db, id) => db.prepare(`SELECT action_id, restants FROM ${TABLE} WHERE personnage_id = ? ORDER BY action_id`).all(id).map((r) => ({ ...r }));

test('R173 : personnage_action_usage — trois colonnes NOT NULL, clé primaire (personnage_id, action_id), STRICT et WITHOUT ROWID, vide dans data/rows', () => {
  const db = ouvrirBase({ sansExemples: false });
  assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 85, 'schéma d’au moins la version de la migration 0085');
  assert.deepEqual(db.prepare(`PRAGMA table_xinfo(${TABLE})`).all().map(({ name, type, notnull, pk, dflt_value: defaut }) => ({ name, type, notnull, pk, defaut })), [
    { name: 'personnage_id', type: 'TEXT', notnull: 1, pk: 1, defaut: null },
    { name: 'action_id', type: 'TEXT', notnull: 1, pk: 2, defaut: null },
    { name: 'restants', type: 'INTEGER', notnull: 1, pk: 0, defaut: null },
  ]);
  const liste = db.prepare('SELECT strict, wr FROM pragma_table_list WHERE name = ?').get(TABLE);
  assert.deepEqual({ ...liste }, { strict: 1, wr: 1 });
  // une seule clé étrangère, vers la fiche, supprimée avec elle ; action_id n'en a pas (l'action dépend de l'équipement et de l'état de la fiche)
  assert.deepEqual(db.prepare(`PRAGMA foreign_key_list(${TABLE})`).all().map(({ table, from, to, on_delete }) => ({ table, from, to, on_delete })), [
    { table: 'personnage', from: 'personnage_id', to: 'id', on_delete: 'CASCADE' },
  ]);
  assert.equal(db.prepare(`SELECT count(*) AS n FROM ${TABLE}`).get().n, 0);
  assert.equal(lire(`data/rows/${TABLE}.sql`).trim().split('\n').length, 1, 'data/rows : en-tête seul');
  // la table de la base construite est celle de data/schema.sql et de la migration (au caractère près hors commentaires)
  const normal = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([,()]) ?/g, '$1').trim();
  const extrait = (texte) => texte.slice(texte.indexOf(`CREATE TABLE ${TABLE} (`)).split(/\) STRICT, WITHOUT ROWID;/)[0] + ') STRICT, WITHOUT ROWID';
  for (const [nom, texte] of [['data/schema.sql', lire('data/schema.sql')], ['migration 0085', lire(`data/migrations/${MIGRATION}`)]]) {
    assert.equal(normal(extrait(texte)), normal(`${sqlDeLaTable(db)}`), nom);
  }
});

test('R173 : compteur entier >= 0 (0 = action grisée), clé d’action non vide, un compteur par fiche et par action, une fiche inconnue refusée', (t) => {
  const db = copie(t);
  fiche(db, 'r173-a');
  assert.deepEqual(compteurs(db, 'r173-a'), [], 'fiche neuve : aucune ligne, tous les compteurs au maximum');
  // bi-classé (R173 : un compteur par classe) : un don de chaque classe a son identifiant de capacité (capacite.classe_id), donc sa ligne
  usage(db, 'r173-a', 'capacite:essai-classe-1', 0);
  usage(db, 'r173-a', 'capacite:essai-classe-2', 1);
  usage(db, 'r173-a', 'race:don-de-base', 2);
  assert.deepEqual(compteurs(db, 'r173-a'), [
    { action_id: 'capacite:essai-classe-1', restants: 0 },
    { action_id: 'capacite:essai-classe-2', restants: 1 },
    { action_id: 'race:don-de-base', restants: 2 },
  ]);
  // aucune clé étrangère sur action_id : une clé sans action correspondante s'enregistre (la page l'ignore)
  usage(db, 'r173-a', 'arme:1:capacite-disparue', 1);

  assert.throws(() => usage(db, 'r173-a', 'race:don-de-base', 1), /UNIQUE constraint failed|PRIMARY KEY/, 'un compteur par action');
  assert.throws(() => usage(db, 'r173-a', 'accessoire:chef', -1), /CHECK constraint failed: restants >= 0/);
  assert.throws(() => usage(db, 'r173-a', '', 1), /CHECK constraint failed: length\(action_id\) > 0/);
  assert.throws(() => usage(db, 'r173-a', 'accessoire:chef', null), /NOT NULL constraint failed: personnage_action_usage\.restants/);
  assert.throws(() => usage(db, 'r173-a', 'accessoire:chef', 1.5), /cannot store REAL value in INTEGER column/, 'STRICT : un entier');
  assert.throws(() => usage(db, 'r173-absent', 'accessoire:chef', 1), /FOREIGN KEY constraint failed/);
  assert.throws(() => db.prepare(`UPDATE ${TABLE} SET restants = restants - 1 WHERE personnage_id = 'r173-a' AND action_id = ?`)
    .run('capacite:essai-classe-1'), /CHECK constraint failed/, 'un compteur à 0 ne descend plus');
});

test('R173 : la fiche supprimée emporte ses compteurs, ceux d’une autre fiche restent', (t) => {
  const db = copie(t);
  fiche(db, 'r173-part');
  fiche(db, 'r173-reste');
  usage(db, 'r173-part', 'accessoire:bague-1', 0);
  usage(db, 'r173-part', 'armure:effet', 1);
  usage(db, 'r173-reste', 'accessoire:bague-1', 0);
  db.prepare("DELETE FROM personnage WHERE id = 'r173-part'").run();
  assert.deepEqual(compteurs(db, 'r173-part'), []);
  assert.deepEqual(compteurs(db, 'r173-reste'), [{ action_id: 'accessoire:bague-1', restants: 0 }]);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('R173 : la migration 0085 crée la table vide sur une base d’avant, sans toucher aux fiches', (t) => {
  const db = copie(t);
  const attendu = sqlDeLaTable(db);
  db.exec(`DROP TABLE ${TABLE}`);
  fiche(db, 'r173-avant');
  rejouerLaMigration(db, MIGRATION);
  assert.equal(sqlDeLaTable(db), attendu, 'la table de data/schema.sql');
  assert.deepEqual(compteurs(db, 'r173-avant'), [], 'fiche d’avant : tous les compteurs au maximum');
  assert.equal(db.prepare("SELECT count(*) AS n FROM personnage WHERE id = 'r173-avant'").get().n, 1);
});
