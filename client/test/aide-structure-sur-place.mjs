// Aides des tests du changement de structure sur place (serveur/structure-sur-place.mjs ; lot 7 du chantier de la base de dev) : la base de règles du
// dépôt (db-build, sans la dérivation : les tables calculées n'y comptent pas), la même ramenée à la version 128 (sans `migration_recue`, migration 0129)
// et REMPLIE — fiches, journal de l'édition et historique —, et l'état d'une base (empreinte de chaque table, structure, version) pour prouver qu'un refus
// ne laisse rien. Module sans test propre (n'est pas un *.test.mjs).
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { empreinteDeLaTable } from '../serveur/empreintes.mjs';
import { trouverRacine } from '../src/lib/donnees.mjs';
import { OMBRES_DE_RECHERCHE } from '../src/lib/tables-de-la-base.mjs';
import { remplirUneBase } from '../scripts/base-remplie-lib.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

export const RACINE = trouverRacine();
/** Le numéro de la migration que les tests appliquent sur place (celle qui crée `migration_recue`). */
export const NUMERO = 129;
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
 * Une base REMPLIE : la base de règles, puis `scripts/base-remplie-lib.mjs#remplirUneBase` (fiches, journal de l'édition, historique des modifications, lot de
 * changements et plafond de numéro ; le même générateur que le contrôle des migrations de la CI). `anterieure` : ramenée à la version
 * `NUMERO - 1`, sans `migration_recue` (la migration 0129 la crée) — la base que le service avait avant cette migration. Rend { chemin, poses }.
 */
export function baseRemplie({ anterieure = false } = {}) {
  const chemin = nouveauChemin(anterieure ? 'v128' : 'courante');
  copyFileSync(baseDesRegles(), chemin);
  const db = new DatabaseSync(chemin);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    if (anterieure) {
      db.exec('DROP TABLE migration_recue');
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
