// Migration data/migrations/0129-migrations-recues.sql (chantier « la base du site de dev devient la source de vérité », R274, R275 ; lot 7 : « Une
// table note ce que la base a reçu ») : la table migration_recue, section 14, propre à chaque base, vide dans data/rows.
// Les contraintes se vérifient sur une base neuve en mémoire (data/schema.sql), jamais sur la base ; la migration se rejoue sur une base d'où la table
// est retirée. Règle du lot 7 : un changement de structure ne porte aucun texte de règle ni donnée de contenu.
//   node --test test/db-0129-migrations-recues.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { lignesDuContenu } from './aide-base-de-depart.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';
import { CLASSES_DE_TABLES, classeDeLaTable, TABLES_DU_JOURNAL } from '../src/lib/tables-de-la-base.mjs';
import { TABLES_VIVANTES } from '../serveur/base-vivante.mjs';

const RACINE = new URL('../../', import.meta.url);
const MIGRATIONS = new URL('data/migrations/', RACINE);
const SCHEMA = readFileSync(new URL('data/schema.sql', RACINE), 'utf8');
const FICHIER = '0129-migrations-recues.sql';
const TABLE = 'migration_recue';
const RECUE = '2026-11-15T10:00:00Z';

const empreinte = (fichier) => createHash('sha256').update(readFileSync(new URL(fichier, MIGRATIONS))).digest('hex');

function baseNeuve() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

/** Une ligne valide (la migration 0129 reçue sur place), retouchée par `autres`. */
const ligne = (autres = {}) => ({ numero: 129, fichier: FICHIER, empreinte: empreinte(FICHIER), recue_le: RECUE, mode: 'sur_place', version_du_site: '0.4.89', ...autres });

function poser(db, l) {
  const colonnes = Object.keys(l);
  db.prepare(`INSERT INTO ${TABLE} (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...Object.values(l));
}

/** Pose la ligne dans une base neuve : rend null si elle passe, sinon le message de l'erreur. */
function essayer(l) {
  const db = baseNeuve();
  try {
    poser(db, l);
    return null;
  } catch (e) {
    return e.message;
  } finally {
    db.close();
  }
}

test('structure : une table STRICT à la fin de la section 14, « propre au site », recopiée par la base vivante, vide dans le contenu qui fait foi (contenu fourni, sinon data/rows)', () => {
  const debut14 = SCHEMA.indexOf('-- 14. ÉDITION');
  const debut15 = SCHEMA.indexOf('-- 15. NOTES DE VERSION');
  const section14 = [...SCHEMA.slice(debut14, debut15).matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]);
  assert.equal(section14.at(-1), TABLE);
  assert.deepEqual([...TABLES_DU_JOURNAL], section14, 'lib/tables-de-la-base.mjs#TABLES_DU_JOURNAL, dans l’ordre du schéma');
  assert.equal(classeDeLaTable(TABLE), CLASSES_DE_TABLES.PROPRE_AU_SITE, 'jamais dans un extrait ni un paquet');
  assert.ok(TABLES_VIVANTES.includes(TABLE), 'serveur/base-vivante.mjs#TABLES_VIVANTES : recopiée à la reconstruction');
  const { source, lignes } = lignesDuContenu(TABLE);
  assert.equal(lignes, 0, `aucune migration reçue dans ${source} : un contenu ne porte pas ce qu’une base a reçu`);
  const db = baseNeuve();
  try {
    assert.equal(db.prepare('SELECT strict FROM pragma_table_list WHERE name = ?').get(TABLE).strict, 1);
    assert.deepEqual(db.prepare(`SELECT name FROM pragma_table_info(?) ORDER BY cid`).all(TABLE).map((c) => c.name),
      ['numero', 'fichier', 'empreinte', 'recue_le', 'mode', 'version_du_site']);
    assert.deepEqual(db.prepare('SELECT name FROM pragma_table_info(?) WHERE pk = 1').all(TABLE).map((c) => c.name), ['numero']);
    assert.deepEqual(db.prepare('SELECT * FROM pragma_foreign_key_list(?)').all(TABLE), [], 'sans clé étrangère');
  } finally {
    db.close();
  }
});

test('la migration 0129 est un pur changement de structure : ni INSERT, ni UPDATE, ni DELETE (règle du lot 7)', () => {
  const sql = readFileSync(new URL(FICHIER, MIGRATIONS), 'utf8').replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i);
});

test('chaque migration du dépôt se note « reconstruction » : son numéro, son fichier et l’empreinte sha256 de ses octets passent les CHECK', () => {
  const fichiers = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(fichiers.includes(FICHIER));
  const db = baseNeuve();
  try {
    for (const f of fichiers) poser(db, { numero: Number(f.slice(0, 4)), fichier: f, empreinte: empreinte(f), recue_le: RECUE, mode: 'reconstruction', version_du_site: null });
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${TABLE}`).get().n, fichiers.length);
  } finally {
    db.close();
  }
});

test('CHECK : numéro, fichier, empreinte, instant, mode et version', () => {
  assert.equal(essayer(ligne()), null, 'ligne valide (sur place, version dite)');
  assert.equal(essayer(ligne({ mode: 'reconstruction', version_du_site: null })), null, 'reconstruction, version non dite');
  const refusees = {
    'numéro nul': { numero: 0, fichier: '0000-rien.sql' },
    'fichier d’un autre numéro': { fichier: '0128-lots-de-changements.sql' },
    'fichier sans nom': { fichier: '0129-.sql' },
    'fichier en majuscules': { fichier: '0129-Migrations.sql' },
    'registre .json': { fichier: '0129-migrations-recues.json' },
    'empreinte en majuscules': { empreinte: empreinte(FICHIER).toUpperCase() },
    'empreinte courte': { empreinte: empreinte(FICHIER).slice(0, 12) },
    'instant sans fuseau': { recue_le: '2026-11-15T10:00:00' },
    'mode inconnu': { mode: 'restauration' },
    'version X.Y': { version_du_site: '0.4' },
    'version X.Y.Z.W': { version_du_site: '0.4.89.1' },
    'version de développement': { version_du_site: '0.4.89-dev' },
    'version à composante vide': { version_du_site: '0..489' },
  };
  for (const [cas, autres] of Object.entries(refusees)) assert.match(essayer(ligne(autres)) ?? 'acceptée', /CHECK constraint failed/, cas);
  const db = baseNeuve();
  try {
    poser(db, ligne());
    assert.throws(() => poser(db, ligne({ mode: 'reconstruction' })), /UNIQUE constraint failed/, 'une migration se reçoit une fois');
  } finally {
    db.close();
  }
});

test('migration rejouée : la table reprend la forme de data/schema.sql', () => {
  const db = baseNeuve();
  try {
    const forme = () => ({
      sql: db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(TABLE).sql.replace(/\s+/g, ' '),
      colonnes: db.prepare(`PRAGMA table_xinfo(${TABLE})`).all().map((c) => ({ ...c })),
      index: db.prepare('SELECT name, "unique", partial FROM pragma_index_list(?) ORDER BY name').all(TABLE).map((i) => ({ ...i })),
    });
    const attendu = forme();
    db.exec(`DROP TABLE ${TABLE}`);
    db.exec('BEGIN');
    rejouerLaMigration(db, FICHIER);
    db.exec('COMMIT');
    assert.deepEqual(forme(), attendu);
  } finally {
    db.close();
  }
});
