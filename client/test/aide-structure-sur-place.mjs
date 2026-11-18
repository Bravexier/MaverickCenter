// Aides des tests du changement de structure sur place (serveur/structure-sur-place.mjs ; lot 7 du chantier de la base de dev) : la base de règles du
// dépôt (db-build, sans la dérivation : les tables calculées n'y comptent pas), la même ramenée à la version d'avant `NUMERO` (sans `migration_recue` ni rien de ce que les migrations livrées depuis ont ajouté)
// et REMPLIE — fiches, journal de l'édition et historique —, et l'état d'une base (empreinte de chaque table, structure, version) pour prouver qu'un refus
// ne laisse rien. Module sans test propre (n'est pas un *.test.mjs).
import { spawnSync } from 'node:child_process';
import { copyFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { empreinteDeLaTable } from '../serveur/empreintes.mjs';
import { trouverRacine } from '../src/lib/donnees.mjs';
import { OMBRES_DE_RECHERCHE } from '../src/lib/tables-de-la-base.mjs';
import { remplirUneBase } from '../scripts/base-remplie-lib.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

export const RACINE = trouverRacine();
const MIGRATIONS = join(RACINE, 'data', 'migrations');
/** Les migrations livrées, numérotées : [{ numero, sql }] sans leurs commentaires, dans l'ordre. */
const migrationsLivrees = () => readdirSync(MIGRATIONS).filter((f) => /^\d{4}-.*\.sql$/.test(f)).sort()
  .map((f) => ({ numero: Number(f.slice(0, 4)), sql: readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--[^\n]*/g, '') }));
/** Le numéro de la migration que les tests appliquent sur place : celle qui crée `migration_recue` (calculé, jamais figé) ; celles qui la suivent s'appliquent avec elle. */
export const NUMERO = migrationsLivrees().find((m) => /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?migration_recue\b/i.test(m.sql)).numero;
const dossier = dossierTemporaire('structure-sur-place');
let construite = null;

/** Le SQL de data/schema.sql (la structure attendue de la version courante). */
export const schemaDuDepot = () => readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8');

/** La base de règles construite depuis data/rows (version courante, sans dérivation), une fois par processus : le chemin du fichier (à copier, jamais à écrire). */
export function baseDesRegles() {
  if (construite) return construite;
  construite = join(dossier, 'regles.db');
  const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', construite], { encoding: 'utf8', cwd: RACINE });
  if (r.status !== 0) throw new Error(`db-build a échoué : ${r.stderr || r.stdout}`);
  return construite;
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
  const nom = '["`]?([A-Za-z_][A-Za-z0-9_]*)["`]?';
  for (const m of migrationsLivrees().filter((x) => x.numero >= NUMERO).reverse()) {
    const supprimees = new Set([...m.sql.matchAll(new RegExp(`DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${nom}`, 'gi'))].map((x) => x[1]));
    const trouve = (motif) => [...m.sql.matchAll(new RegExp(motif, 'gi'))].map((x) => x.slice(1));
    for (const [colonne, table] of trouve(`ALTER\\s+TABLE\\s+${nom}\\s+ADD\\s+(?:COLUMN\\s+)?${nom}`).map(([t, c]) => [c, t]).reverse()) {
      if (existe('table', table) && colonnes(table).includes(colonne)) db.exec(`ALTER TABLE "${table}" DROP COLUMN "${colonne}"`);
    }
    for (const [type, motif] of [['trigger', 'TRIGGER'], ['view', 'VIEW'], ['index', 'INDEX']]) {
      for (const [objet] of trouve(`CREATE\\s+(?:UNIQUE\\s+)?${motif}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${nom}`).reverse()) {
        if (existe(type, objet)) db.exec(`DROP ${motif} "${objet}"`);
      }
    }
    for (const [table] of trouve(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${nom}`).reverse()) {
      if (!supprimees.has(table) && existe('table', table)) db.exec(`DROP TABLE "${table}"`);
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
