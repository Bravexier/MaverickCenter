// Aides des tests du changement de structure sur place (serveur/structure-sur-place.mjs ; lot 7 du chantier de la base de dev) : la base de règles du
// dépôt (db-build, sans la dérivation : les tables calculées n'y comptent pas ; avec MAVERICK_CONTENU, le contenu fourni : test/aide-base-de-depart.mjs), la même ramenée
// à la version d'avant `NUMERO` (sans `migration_recue` ni rien de ce que les migrations livrées depuis ont ajouté)
// et REMPLIE — fiches, journal de l'édition et historique —, et l'état d'une base (empreinte de chaque table, structure, version) pour prouver qu'un refus
// ne laisse rien. Module sans test propre (n'est pas un *.test.mjs).
// La livraison des tests (`LIVRAISON` : dossier des migrations et schema.sql) est celle du dépôt tant que les migrations mixtes y sont ; sorties
// (mixtesSorties()), le schema.sql est le plancher et la livraison d'essai remet une vraie migration au-dessus (livraisonDesTests).
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { empreinteDeLaTable } from '../serveur/empreintes.mjs';
import { versionDuSchemaSql } from '../serveur/structure-sur-place.mjs';
import { trouverRacine } from '../src/lib/donnees.mjs';
import { mixtesSorties } from '../src/lib/sortie-du-contenu.mjs';
import { OMBRES_DE_RECHERCHE } from '../src/lib/tables-de-la-base.mjs';
import { remplirUneBase } from '../scripts/base-remplie-lib.mjs';
import { baseDeDepart } from './aide-base-de-depart.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

export const RACINE = trouverRacine();
const dossier = dossierTemporaire('structure-sur-place');
const MIGRATION = /^\d{4}-.*\.sql$/;
const CREE_MIGRATION_RECUE = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?migration_recue\b/i;
const sansCommentaires = (sql) => sql.replace(/--[^\n]*/g, '');
const avecLaVersion = (schema, version) => schema.replace(/^PRAGMA user_version\s*=\s*\d+;/m, `PRAGMA user_version = ${version};`);

/**
 * La livraison des tests du changement de structure : { migrations (dossier), schema (fichier) }. Tant que les migrations mixtes sont dans le dépôt
 * (aujourd'hui) : data/migrations et data/schema.sql eux-mêmes, rien ne change. Sorties (mixtesSorties() : la passe S --avec-mixtes, puis le jour où elles
 * quittent le dépôt), le schema.sql est le PLANCHER (serveur/structure-sur-place.mjs#versionLivree) : la base qu'il décrit ne reçoit que les migrations
 * de numéro supérieur, et la migration qui crée `migration_recue` (structure seule, elle reste) est en dessous. La livraison d'essai est alors une copie :
 * les migrations du dépôt jusqu'au plancher, cette migration reprise telle quelle au numéro plancher + 1, puis celles du dépôt au-dessus du plancher,
 * chacune décalée d'un numéro ; le schema.sql à la version de la dernière. Les tests appliquent ainsi sur place, à la base d'avant (le plancher, sans
 * `migration_recue` : annulerLesMigrations), une vraie migration au-dessus du plancher, comme le service appliquera la suivante.
 */
function livraisonDesTests() {
  const depot = { migrations: join(RACINE, 'data', 'migrations'), schema: join(RACINE, 'data', 'schema.sql') };
  if (!mixtesSorties()) return depot;
  const schema = readFileSync(depot.schema, 'utf8');
  const plancher = versionDuSchemaSql(schema);
  const fichiers = readdirSync(depot.migrations).filter((f) => MIGRATION.test(f)).sort();
  const lire = (f) => readFileSync(join(depot.migrations, f), 'utf8');
  const recue = fichiers.find((f) => Number(f.slice(0, 4)) <= plancher && CREE_MIGRATION_RECUE.test(sansCommentaires(lire(f))));
  if (!recue) throw new Error('aide-structure-sur-place : aucune migration du dépôt sous le plancher ne crée migration_recue');
  const sortie = join(dossier, 'livraison');
  mkdirSync(join(sortie, 'migrations'), { recursive: true });
  const N = (n) => String(n).padStart(4, '0');
  for (const f of fichiers) {
    const n = Number(f.slice(0, 4));
    writeFileSync(join(sortie, 'migrations', n <= plancher ? f : `${N(n + 1)}${f.slice(4)}`), lire(f));
  }
  writeFileSync(join(sortie, 'migrations', `${N(plancher + 1)}${recue.slice(4)}`), lire(recue));
  const derniere = Math.max(plancher + 1, ...fichiers.map((f) => Number(f.slice(0, 4)) + 1).filter((n) => n > plancher + 1));
  writeFileSync(join(sortie, 'schema.sql'), avecLaVersion(schema, derniere));
  return { migrations: join(sortie, 'migrations'), schema: join(sortie, 'schema.sql') };
}

/** La livraison des tests (livraisonDesTests) : `lireLesMigrations(LIVRAISON)`, et le service d'essai lit ces chemins. */
export const LIVRAISON = Object.freeze(livraisonDesTests());

/** Les migrations livrées, numérotées : [{ numero, sql }] sans leurs commentaires, dans l'ordre. */
const migrationsLivrees = () => readdirSync(LIVRAISON.migrations).filter((f) => MIGRATION.test(f)).sort()
  .map((f) => ({ numero: Number(f.slice(0, 4)), sql: sansCommentaires(readFileSync(join(LIVRAISON.migrations, f), 'utf8')) }));
/**
 * Le numéro de la migration que les tests appliquent sur place : la dernière qui crée `migration_recue` (calculé, jamais figé : la 0129 du dépôt, ou
 * sa reprise au-dessus du plancher) ; celles qui la suivent s'appliquent avec elle.
 */
export const NUMERO = migrationsLivrees().filter((m) => CREE_MIGRATION_RECUE.test(m.sql)).at(-1).numero;
let construite = null;

/** Le SQL du schema.sql de la livraison des tests (data/schema.sql : la structure attendue de la version courante ; au-dessus du plancher s'il le faut). */
export const schemaDuDepot = () => readFileSync(LIVRAISON.schema, 'utf8');

/**
 * La base de règles construite depuis data/rows, ou tirée du contenu fourni (MAVERICK_CONTENU) — version courante, sans dérivation —, une fois par
 * processus : le chemin du fichier (à copier, jamais à écrire).
 */
export function baseDesRegles() {
  if (construite) return construite;
  construite = baseDeDepart(join(dossier, 'regles.db'));
  const db = new DatabaseSync(construite);
  try {
    viderLesAjoutsDesMigrations(db);
    // les mixtes sorties : la base courante a la structure de la livraison d'essai (la reprise de la migration de `migration_recue` ne change que la version)
    if (mixtesSorties()) db.exec(`PRAGMA user_version = ${versionDuSchemaSql(schemaDuDepot())}`);
  } finally {
    db.close();
  }
  return construite;
}

const NOM_SQL = '["`]?([A-Za-z_][A-Za-z0-9_]*)["`]?';
/**
 * Ce qu'une migration ajoute et que `annulerLesMigrations` retire : les colonnes ajoutées ([table, colonne]) et les tables créées qu'elle ne supprime pas
 * elle-même (une table reconstruite, x_NNNN renommée, n'en est pas : elle garde ses lignes).
 */
function ajoutsDeLaMigration(m) {
  const trouve = (motif) => [...m.sql.matchAll(new RegExp(motif, 'gi'))].map((x) => x.slice(1));
  const supprimees = new Set(trouve(`DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${NOM_SQL}`).map(([t]) => t));
  return {
    trouve,
    colonnes: trouve(`ALTER\\s+TABLE\\s+${NOM_SQL}\\s+ADD\\s+(?:COLUMN\\s+)?${NOM_SQL}`),
    tables: trouve(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${NOM_SQL}`).map(([t]) => t).filter((t) => !supprimees.has(t)),
  };
}

/**
 * La base de règles telle que la livraison la refait juste après les migrations depuis `NUMERO` : leurs tables créées vides, leurs colonnes ajoutées à
 * leur valeur par défaut. Le site de dev peut les avoir remplies depuis (ex. une table de la 0130, remplie par un lot) : `annulerLesMigrations` les
 * retire de la base d'avant, la migration les rend vides, et la base refaite ne doit pas porter ce que le circuit ne peut pas refaire (essai dans l'ombre :
 * un verdict `ecart` qui viendrait du contenu du jour, pas du service). Règle générale : aucune table ni colonne nommée.
 */
function viderLesAjoutsDesMigrations(db) {
  db.exec('PRAGMA foreign_keys = OFF');
  const existe = (nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
  for (const m of migrationsLivrees().filter((x) => x.numero >= NUMERO).reverse()) {
    const { colonnes, tables } = ajoutsDeLaMigration(m);
    for (const [table, colonne] of colonnes) {
      const c = existe(table) && db.prepare('SELECT dflt_value AS defaut FROM pragma_table_info(?) WHERE name = ?').get(table, colonne);
      if (c) db.exec(`UPDATE "${table}" SET "${colonne}" = ${c.defaut ?? 'NULL'}`);
    }
    for (const table of tables) {
      if (!existe(table)) continue;
      db.exec(`DELETE FROM "${table}"`);
      // les lignes que la migration pose elle-même (0131 : les dix types de sort) sont refaites telles qu'elle les pose : le circuit les refait de même
      for (const [insert] of m.sql.matchAll(new RegExp(`INSERT\\s+INTO\\s+["\`]?${table}["\`]?\\s*(?:\\(|VALUES|SELECT)[^;]*;`, 'gi'))) db.exec(insert);
    }
  }
  db.exec('PRAGMA foreign_keys = ON');
}

let compteur = 0;
/** Un chemin neuf dans le dossier des tests. */
export const nouveauChemin = (prefixe, extension = '.db') => join(dossier, `${prefixe}-${(compteur += 1)}${extension}`);
/** Un dossier neuf (vide), supprimé à la fin du test `t` (ou du processus). */
export const nouveauDossier = (prefixe, t) => dossierTemporaire(prefixe, { t, dans: dossier });

/**
 * Défait la structure que les migrations livrées depuis `NUMERO` (comprise) ont ajoutée à la base de règles courante, pour que le service les applique sur place
 * (la base d'avant) sans que la dernière migration ne casse ces tests : tables, vues, index et déclencheurs créés (CREATE) sont supprimés, une colonne ajoutée
 * (ALTER TABLE … ADD COLUMN) est retirée. Une table reconstruite (CREATE TABLE x_NNNN, DROP TABLE x, RENAME) garde sa forme courante : la migration la refait
 * sans erreur ; seule une migration qui change des lignes ne se défait pas ici (la base d'avant garde les lignes de la courante).
 */
export function annulerLesMigrations(db) {
  db.exec('PRAGMA foreign_keys = OFF');
  const existe = (type, nom) => Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?').get(type, nom));
  const colonnes = (table) => db.prepare('SELECT name FROM pragma_table_info(?)').all(table).map((c) => c.name);
  for (const m of migrationsLivrees().filter((x) => x.numero >= NUMERO).reverse()) {
    const ajouts = ajoutsDeLaMigration(m);
    // les objets d'abord, les colonnes ensuite : SQLite refuse de retirer une colonne qu'un index (0131 : page_ancre_mot_cle), une vue ou un déclencheur cite encore.
    // Un objet que la migration retire elle-même avant de le recréer (0132 : v_personnage_visible, autour de la table reconstruite) existait avant elle : il reste.
    for (const [type, motif] of [['trigger', 'TRIGGER'], ['view', 'VIEW'], ['index', 'INDEX']]) {
      const recrees = new Set(ajouts.trouve(`DROP\\s+${motif}\\s+(?:IF\\s+EXISTS\\s+)?${NOM_SQL}`).map(([objet]) => objet));
      for (const [objet] of ajouts.trouve(`CREATE\\s+(?:UNIQUE\\s+)?${motif}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${NOM_SQL}`).reverse()) {
        if (!recrees.has(objet) && existe(type, objet)) db.exec(`DROP ${motif} "${objet}"`);
      }
    }
    for (const [table, colonne] of [...ajouts.colonnes].reverse()) {
      if (existe('table', table) && colonnes(table).includes(colonne)) db.exec(`ALTER TABLE "${table}" DROP COLUMN "${colonne}"`);
    }
    for (const table of [...ajouts.tables].reverse()) {
      if (existe('table', table)) db.exec(`DROP TABLE "${table}"`);
    }
  }
  db.exec('PRAGMA foreign_keys = ON');
}

/**
 * Une base REMPLIE : la base de règles, puis `scripts/base-remplie-lib.mjs#remplirUneBase` (fiches, journal de l'édition, historique des modifications, lot de
 * changements et plafond de numéro ; le même générateur que le contrôle des migrations de la CI). `anterieure` : ramenée à la version
 * `NUMERO - 1`, sans `migration_recue` (la migration `NUMERO` la crée) ni la structure que les migrations suivantes ont ajoutée (`annulerLesMigrations`) — la base que le service avait avant. Rend { chemin, poses }.
 */
export function baseRemplie({ anterieure = false } = {}) {
  const chemin = nouveauChemin(anterieure ? 'v128' : 'courante');
  copyFileSync(baseDesRegles(), chemin);
  const db = new DatabaseSync(chemin);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    if (anterieure) {
      annulerLesMigrations(db);
      db.exec(`PRAGMA user_version = ${NUMERO - 1}`);
    }
    const poses = remplirUneBase(db);
    return { chemin, poses };
  } finally {
    db.close();
  }
}

/** Les tables « de données » d'une base : hors tables internes, d'ombre du plein texte et virtuelles. */
export function tablesDeDonnees(db) {
  return db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
    .filter((t) => !/^sqlite_/.test(t.name) && !OMBRES_DE_RECHERCHE.test(t.name) && !/^\s*CREATE\s+VIRTUAL\s/i.test(t.sql ?? '')).map((t) => t.name);
}

/** L'état d'une base : { version, structure (tous les objets), tables: { nom → empreinte et lignes } } — deux états égaux : rien n'a changé. */
export function etatDeLaBase(db) {
  const tables = {};
  for (const nom of tablesDeDonnees(db)) tables[nom] = empreinteDeLaTable(db, nom);
  return {
    version: db.prepare('PRAGMA user_version').get().user_version,
    structure: db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name').all().map((o) => ({ ...o })),
    tables,
  };
}

/** L'état d'un fichier (ouvert en lecture seule). */
export function etatDuFichier(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return etatDeLaBase(db);
  } finally {
    db.close();
  }
}
