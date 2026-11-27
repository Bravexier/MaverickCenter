// Migration data/migrations/0132-connexion-discord.sql (décision R310 ; feuille de route E7 : le compte local, `discord_id` NULL, se retire) : la table
// utilisateur reconstruite pour la connexion par Discord. discord_id obligatoire ; niveau, avatar_url, banniere_url, serveur_rejoint_le et
// derniere_connexion_le en dernier ; rien d'autre (R310 (5) : ni e-mail, ni jeton, ni rôles bruts). Migration de structure seule : la table est vide
// partout (aucune connexion avant ce lot) ; une ligne trouvée la fait échouer plutôt que de perdre un compte ou d'inventer ses valeurs.
// Le test lit la structure sur une base neuve du schéma, puis rejoue la migration sur une base neuve ramenée à la forme d'avant (celle de la 0011).
//   node --test test/db-0132-connexion-discord.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const MIGRATION = readFileSync(new URL('../../data/migrations/0132-connexion-discord.sql', import.meta.url), 'utf8');

/** R310 (5) : ce que la table garde, dans l'ordre (les colonnes d'avant, puis les nouvelles en dernier). */
const COLONNES = ['id', 'discord_id', 'nom_affichage', 'cree_le', 'niveau', 'avatar_url', 'banniere_url', 'serveur_rejoint_le', 'derniere_connexion_le'];
const OBLIGATOIRES = ['id', 'discord_id', 'nom_affichage', 'cree_le', 'niveau', 'avatar_url', 'derniere_connexion_le'];
/** R310 (2) : les quatre niveaux. */
const NIVEAUX = ['observateur', 'joueur', 'mj', 'createur'];
/** La forme d'avant (migration 0011, inchangée jusqu'à la 0131) : discord_id NULL = compte local de secours. */
const FORME_D_AVANT = `CREATE TABLE utilisateur (
  id             TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
  discord_id     TEXT    UNIQUE CHECK (discord_id IS NULL OR (length(discord_id) > 0 AND discord_id NOT GLOB '*[^0-9]*')),
  nom_affichage  TEXT    NOT NULL CHECK (length(nom_affichage) > 0),
  cree_le        TEXT    NOT NULL CHECK (cree_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z')
) STRICT;`;
/** Les tables qui citent utilisateur(id). */
const CITANTES = ['utilisateur_role', 'personnage', 'personnage_partage', 'groupe_membre', 'modification_lot'];

const INSTANT = '2026-11-27T10:00:00Z';
const ligne = (x = {}) => ({
  id: 'u1', discord_id: '80351110224678912', nom_affichage: 'Essai', cree_le: INSTANT, niveau: 'joueur',
  avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png', banniere_url: null, serveur_rejoint_le: INSTANT, derniere_connexion_le: INSTANT, ...x,
});

/** Une base neuve du schéma (clés étrangères actives : aucune ligne citante n'est posée par les essais de contraintes). */
function baseNeuve() {
  const essai = new DatabaseSync(':memory:');
  essai.exec(SCHEMA);
  return essai;
}

function poser(db, l) {
  db.prepare(`INSERT INTO utilisateur (${COLONNES.join(', ')}) VALUES (${COLONNES.map(() => '?').join(', ')})`).run(...COLONNES.map((c) => l[c]));
}

/** Une base neuve ramenée à la forme d'avant de la table (la vue qui la lit refaite dessus), clés étrangères coupées comme dans migrer(). */
function baseDAvant() {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  db.exec(SCHEMA);
  const vue = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'v_personnage_visible'").get().sql;
  db.exec('DROP VIEW v_personnage_visible; DROP TABLE utilisateur;');
  db.exec(FORME_D_AVANT);
  db.exec(vue);
  return db;
}

const forme = (db) => db.prepare("SELECT name, type, \"notnull\" AS nn, dflt_value AS defaut, pk FROM pragma_table_info('utilisateur') ORDER BY cid").all().map((c) => ({ ...c }));

test('0132 (R310 (5)) : utilisateur garde exactement l’identifiant Discord, le nom, les images, les dates et le niveau — les nouvelles colonnes en dernier', () => {
  const db = baseNeuve();
  const colonnes = forme(db);
  assert.deepEqual(colonnes.map((c) => c.name), COLONNES);
  assert.deepEqual(colonnes.filter((c) => c.nn).map((c) => c.name), OBLIGATOIRES, 'obligatoires : tout sauf la bannière et la date d’arrivée');
  assert.ok(colonnes.every((c) => c.defaut === null), 'aucune valeur par défaut : le service écrit chaque colonne');
  db.close();
});

test('0132 (E7, R310) : discord_id obligatoire, unique, en chiffres — plus de compte local', () => {
  const db = baseNeuve();
  assert.doesNotThrow(() => poser(db, ligne()));
  assert.throws(() => poser(db, ligne({ id: 'u2', discord_id: null })), /NOT NULL/, 'compte local refusé');
  for (const discord of ['', '8035abc', ' 80351110224678912', '-1']) assert.throws(() => poser(db, ligne({ id: 'u2', discord_id: discord })), /CHECK/, discord);
  assert.throws(() => poser(db, ligne({ id: 'u2' })), /UNIQUE/, 'un identifiant Discord, un compte');
  db.close();
});

test('0132 (R310 (2)) : niveau parmi les quatre, jamais absent', () => {
  const db = baseNeuve();
  NIVEAUX.forEach((niveau, i) => assert.doesNotThrow(() => poser(db, ligne({ id: `n${i}`, discord_id: String(1000 + i), niveau })), niveau));
  for (const niveau of ['admin', 'Joueur', 'touriste', '']) assert.throws(() => poser(db, ligne({ niveau })), /CHECK/, niveau);
  assert.throws(() => poser(db, ligne({ niveau: null })), /NOT NULL/);
  db.close();
});

test('0132 (R310 (5)) : avatar et bannière sont des adresses complètes du CDN de Discord ; la bannière peut manquer, l’avatar jamais', () => {
  const db = baseNeuve();
  assert.doesNotThrow(() => poser(db, ligne({ banniere_url: 'https://cdn.discordapp.com/banners/80351110224678912/a_1.gif' })));
  db.exec('DELETE FROM utilisateur');
  for (const mauvaise of ['http://cdn.discordapp.com/embed/avatars/0.png', 'https://cdn.discordapp.com/', 'https://exemple.org/a.png', 'avatars/1/2.png', '']) {
    assert.throws(() => poser(db, ligne({ avatar_url: mauvaise })), /CHECK/, `avatar ${mauvaise}`);
    assert.throws(() => poser(db, ligne({ banniere_url: mauvaise })), /CHECK/, `bannière ${mauvaise}`);
  }
  assert.throws(() => poser(db, ligne({ avatar_url: null })), /NOT NULL/);
  db.close();
});

test('0132 : dates ISO 8601 UTC à la seconde ; l’arrivée sur le serveur peut manquer, la dernière connexion jamais', () => {
  const db = baseNeuve();
  assert.doesNotThrow(() => poser(db, ligne({ serveur_rejoint_le: null })));
  db.exec('DELETE FROM utilisateur');
  for (const date of ['2026-11-27T10:00:00.123Z', '2026-11-27T10:00:00+00:00', '2026-11-27 10:00:00', '2026-11-27']) {
    assert.throws(() => poser(db, ligne({ serveur_rejoint_le: date })), /CHECK/, `arrivée ${date}`);
    assert.throws(() => poser(db, ligne({ derniere_connexion_le: date })), /CHECK/, `connexion ${date}`);
  }
  assert.throws(() => poser(db, ligne({ derniere_connexion_le: null })), /NOT NULL/);
  db.close();
});

test('0132 rejouée sur la forme d’avant : la table de data/schema.sql, la vue v_personnage_visible inchangée, les clés étrangères suivent', () => {
  const db = baseDAvant();
  const attendu = baseNeuve();
  const vueAvant = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_visible'").get().sql;
  db.exec(MIGRATION);
  assert.deepEqual(forme(db), forme(attendu));
  assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_visible'").get().sql, vueAvant, 'la vue est recréée à l’identique');
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'utilisateur_0132%'").get().n, 0, 'la table de passage est renommée');
  for (const t of CITANTES) {
    assert.ok(db.prepare(`SELECT 1 FROM pragma_foreign_key_list('${t}') WHERE "table" = 'utilisateur'`).get(), `${t} cite toujours utilisateur`);
  }
  // les clés étrangères jouent sur la table neuve : un partage cite un compte posé, jamais un compte absent
  db.exec('PRAGMA foreign_keys = ON');
  poser(db, ligne());
  db.prepare("INSERT INTO groupe (id, nom, nature, cree_le) VALUES ('g', 'G', 'campagne', ?)").run(INSTANT);
  assert.doesNotThrow(() => db.prepare("INSERT INTO groupe_membre (groupe_id, utilisateur_id, role, rejoint_le) VALUES ('g', 'u1', 'joueur', ?)").run(INSTANT));
  assert.throws(() => db.prepare("INSERT INTO groupe_membre (groupe_id, utilisateur_id, role, rejoint_le) VALUES ('g', 'absent', 'joueur', ?)").run(INSTANT), /FOREIGN KEY/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();
  attendu.close();
});

test('0132 : une ligne trouvée fait échouer la migration — ni compte perdu, ni valeur inventée (avec ou sans identifiant Discord)', () => {
  for (const discord of [null, '80351110224678912']) {
    const db = baseDAvant();
    db.prepare('INSERT INTO utilisateur (id, discord_id, nom_affichage, cree_le) VALUES (?, ?, ?, ?)').run('ancien', discord, 'Ancien', INSTANT);
    db.exec('BEGIN');
    assert.throws(() => db.exec(MIGRATION), /NOT NULL/, `discord_id ${discord}`);
    db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT count(*) AS n FROM utilisateur').get().n, 1, 'la transaction annulée, le compte est intact');
    db.close();
  }
});

test('0132 : migration de structure seule — sa seule écriture est la recopie de la table, sans aucune valeur', () => {
  const sql = MIGRATION.replace(/--.*$/gm, '');
  const ecritures = [...sql.matchAll(/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b[^;]*;/gim)].map((m) => m[0]);
  assert.equal(ecritures.length, 1);
  assert.match(ecritures[0], /INSERT INTO utilisateur_0132\b[^;]*SELECT id, discord_id, nom_affichage, cree_le, NULL, NULL, NULL, NULL, NULL FROM utilisateur;/);
});
