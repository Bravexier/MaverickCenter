// Migration data/migrations/0134-visibilite-par-niveau.sql (décision R318 ; feuille de route E8) : la vue v_personnage_visible lit le niveau du compte
// (utilisateur.niveau, R310 (2)) au lieu de utilisateur_role. Menu « Visible par » d'une fiche de joueur : « Tous (Joueurs et +) », « MJ (MJ et
// Créateur) », « Privé (Utilisateur et Créateur) ». Mêmes colonnes, mêmes motifs. Le prétiré ouvert à tout visiteur (R307) relève du service, pas de la vue.
// Base en mémoire du schéma : quatre comptes, un par niveau, et des fiches de chaque visibilité ; puis la migration rejouée sur la vue d'avant (0132).
//   node --test test/db-0134-visibilite-par-niveau.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { poserUnCompte } from './aide-compte-d-essai.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const MIGRATION = readFileSync(new URL('../../data/migrations/0134-visibilite-par-niveau.sql', import.meta.url), 'utf8');
const MIGRATION_0132 = readFileSync(new URL('../../data/migrations/0132-connexion-discord.sql', import.meta.url), 'utf8');

const INSTANT = '2026-11-27T10:00:00Z';
/** Un compte par niveau (R310 (2)), et un deuxième joueur, propriétaire des fiches. */
const COMPTES = { obs: 'observateur', jo: 'joueur', mj: 'mj', cre: 'createur', proprio: 'joueur' };
const TOUS = Object.keys(COMPTES).sort();

function baseNeuve() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  db.exec('PRAGMA foreign_keys = ON');
  for (const [id, niveau] of Object.entries(COMPTES)) poserUnCompte(db, id, id, INSTANT, { niveau });
  return db;
}

function fiche(db, id, surcharge) {
  const ligne = {
    id, nature: 'joueur', proprietaire_id: 'proprio', visibilite: 'privee', nom: id, mode_classe: 'mono', xp: 0,
    alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
    bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT, ...surcharge,
  };
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO personnage (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}

const spectateurs = (db, personnage) => [...new Set(db.prepare('SELECT utilisateur_id FROM v_personnage_visible WHERE personnage_id = ?')
  .all(personnage).map((r) => r.utilisateur_id))].sort();
const motifs = (db, utilisateur, personnage) => db.prepare('SELECT motif FROM v_personnage_visible WHERE utilisateur_id = ? AND personnage_id = ? ORDER BY motif')
  .all(utilisateur, personnage).map((r) => r.motif);

/** Les trois fiches de joueur (une par visibilité) et un prétiré. */
function avecLesFiches(db) {
  fiche(db, 'privee', { visibilite: 'privee' });
  fiche(db, 'mj', { visibilite: 'mj' });
  fiche(db, 'tous', { visibilite: 'tous' });
  fiche(db, 'pretire', { nature: 'pretire', proprietaire_id: null, visibilite: 'tous' });
  return db;
}

test('R318 : « Privé (Utilisateur et Créateur) » — le propriétaire et les comptes de niveau createur', () => {
  const db = avecLesFiches(baseNeuve());
  assert.deepEqual(spectateurs(db, 'privee'), ['cre', 'proprio']);
  assert.deepEqual(motifs(db, 'proprio', 'privee'), ['proprietaire']);
  assert.deepEqual(motifs(db, 'cre', 'privee'), ['admin']);
  db.close();
});

test('R318 : « MJ (MJ et Créateur) » — le propriétaire, les niveaux mj et createur ; ni joueur ni observateur', () => {
  const db = avecLesFiches(baseNeuve());
  assert.deepEqual(spectateurs(db, 'mj'), ['cre', 'mj', 'proprio']);
  assert.deepEqual(motifs(db, 'mj', 'mj'), ['mj']);
  assert.deepEqual(motifs(db, 'cre', 'mj'), ['admin', 'mj']);
  assert.deepEqual(motifs(db, 'jo', 'mj'), []);
  db.close();
});

test('R318 : « Tous (Joueurs et +) » — les niveaux joueur, mj et createur ; jamais l’Observateur', () => {
  const db = avecLesFiches(baseNeuve());
  assert.deepEqual(spectateurs(db, 'tous'), TOUS.filter((u) => u !== 'obs'));
  for (const u of ['jo', 'mj']) assert.deepEqual(motifs(db, u, 'tous'), ['tous'], u);
  assert.deepEqual(motifs(db, 'cre', 'tous'), ['admin', 'tous']);
  assert.deepEqual(motifs(db, 'obs', 'tous'), []);
  db.close();
});

test('R318, R307 : le prétiré (visibilité tous) n’ouvre pas la vue à l’Observateur — c’est le service qui ouvre le prétiré à tout visiteur', () => {
  const db = avecLesFiches(baseNeuve());
  assert.deepEqual(spectateurs(db, 'pretire'), TOUS.filter((u) => u !== 'obs'));
  assert.deepEqual(motifs(db, 'proprio', 'pretire'), ['tous'], 'un prétiré n’a pas de propriétaire');
  assert.deepEqual(motifs(db, 'obs', 'pretire'), []);
  db.close();
});

test('R318 : la vue suit le niveau, plus utilisateur_role — un rôle posé ne change rien, un niveau changé change tout', () => {
  const db = avecLesFiches(baseNeuve());
  const avant = Object.fromEntries(['privee', 'mj', 'tous', 'pretire'].map((p) => [p, spectateurs(db, p)]));
  for (const role of ['admin', 'mj', 'editeur']) db.prepare('INSERT INTO utilisateur_role (utilisateur_id, role) VALUES (?, ?)').run('obs', role);
  for (const p of Object.keys(avant)) assert.deepEqual(spectateurs(db, p), avant[p], `${p} : utilisateur_role n’est plus lue`);
  db.prepare("UPDATE utilisateur SET niveau = 'createur' WHERE id = 'obs'").run();
  assert.deepEqual(motifs(db, 'obs', 'privee'), ['admin']);
  db.prepare("UPDATE utilisateur SET niveau = 'mj' WHERE id = 'obs'").run();
  assert.deepEqual(motifs(db, 'obs', 'mj'), ['mj']);
  assert.deepEqual(motifs(db, 'obs', 'privee'), []);
  db.close();
});

test('R318 : groupe et partage inchangés, quel que soit le niveau (Observateur compris)', () => {
  const db = avecLesFiches(baseNeuve());
  db.prepare("INSERT INTO personnage_partage (personnage_id, utilisateur_id) VALUES ('privee', 'obs')").run();
  assert.deepEqual(motifs(db, 'obs', 'privee'), ['partage']);
  db.prepare("INSERT INTO groupe (id, nom, nature, cree_le) VALUES ('g', 'G', 'campagne', ?)").run(INSTANT);
  db.prepare("INSERT INTO groupe_membre (groupe_id, utilisateur_id, role, personnage_id, rejoint_le) VALUES ('g', 'proprio', 'joueur', 'mj', ?)").run(INSTANT);
  db.prepare("INSERT INTO groupe_membre (groupe_id, utilisateur_id, role, personnage_id, rejoint_le) VALUES ('g', 'jo', 'joueur', NULL, ?)").run(INSTANT);
  assert.deepEqual(motifs(db, 'jo', 'mj'), ['groupe']);
  assert.equal(db.prepare("SELECT groupe_id FROM v_personnage_visible WHERE personnage_id = 'mj' AND utilisateur_id = 'jo'").get().groupe_id, 'g');
  db.close();
});

test('0134 rejouée sur la vue d’avant (celle de la 0132) : la vue de data/schema.sql, mêmes colonnes', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const attendue = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_visible'").get().sql;
  const colonnes = () => db.prepare("SELECT name FROM pragma_table_info('v_personnage_visible')").all().map((c) => c.name);
  db.exec('DROP VIEW v_personnage_visible');
  db.exec(MIGRATION_0132.match(/CREATE VIEW v_personnage_visible AS[\s\S]*?;/)[0]);
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_visible'").get().sql, /utilisateur_role/, 'la vue d’avant lit les rôles');
  const colonnesDAvant = colonnes();
  db.exec(MIGRATION);
  assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_visible'").get().sql, attendue);
  assert.deepEqual(colonnes(), colonnesDAvant);
  assert.deepEqual(colonnes(), ['personnage_id', 'utilisateur_id', 'motif', 'groupe_id']);
  db.close();
});

test('0134 : migration de structure seule — aucune écriture, utilisateur_role n’est pas supprimée', () => {
  const sql = MIGRATION.replace(/--.*$/gm, '');
  assert.equal([...sql.matchAll(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/gim)].length, 0);
  assert.doesNotMatch(sql, /DROP\s+TABLE/i);
  assert.match(SCHEMA, /CREATE TABLE utilisateur_role\b/);
});
