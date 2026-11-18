// Le contenu fourni au build (lot 9 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md ; docs/serveur.md,
// « Fabriquer le site depuis un fichier de contenu ») : la variable MAVERICK_CONTENU=<fichier SQLite> (un extrait du contenu du site de dev,
// serveur/extrait.mjs) remplace, pour tout ce qui lit la base au build, la reconstruction depuis data/rows. Posée, le build n'a plus besoin de data/rows ;
// le fichier fourni n'est jamais modifié (chaque lecteur en prend une copie dans son dossier temporaire). Absente (ou vide), rien ne change : le build
// par défaut reconstruit la base depuis data/rows, comme avant.
// La copie de travail est préparée (lot 10, `preparerLaCopie`) : la vue `extrait_meta` d'un extrait en est retirée (jamais du fichier fourni), et un
// contenu d'une structure plus ancienne que celle du dépôt (une PR qui ajoute une migration) reçoit les migrations manquantes du dépôt
// (scripts/db-preparer-contenu.mjs, le code du service : serveur/structure-sur-place.mjs#appliquerSurPlace) ; plus récente : une erreur (« rebasez sur dev »).
// Module Node seulement (node:fs, node:path, node:sqlite), sans dépendance navigateur ni Astro.
import { copyFileSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const VARIABLE_DU_CONTENU = 'MAVERICK_CONTENU';
/**
 * Variable interne de la fabrication « en deux temps » (serveur/fabrication-depuis-contenu.mjs) : le fichier fourni a déjà passé db-derive, dans son propre processus
 * (mémoire mesurée à part). Sa valeur dit pour quelle variante : `complete` ou `sans-exemples` (HIDE_EXAMPLES=1). `ouvrirBase` le copie alors tel quel, sans relancer db-derive,
 * mais seulement pour la variante demandée (sinon une erreur : une base sans ses pages d'exemple ne redevient pas complète).
 */
export const VARIABLE_DU_CONTENU_DERIVE = 'MAVERICK_CONTENU_DERIVE';

/**
 * Le chemin absolu du fichier de contenu posé par la variable, ou null quand elle est absente ou vide. Une variable posée sur un fichier qui n'existe
 * pas est une erreur (jamais un repli silencieux sur data/rows : on fabriquerait un autre site que celui qu'on a demandé).
 * @param {Record<string, string|undefined>} [env]
 * @returns {string|null}
 */
export function contenuFourni(env = process.env) {
  const brut = env[VARIABLE_DU_CONTENU];
  if (brut === undefined || String(brut).trim() === '') return null;
  const chemin = resolve(String(brut).trim());
  let fichier;
  try {
    fichier = statSync(chemin);
  } catch {
    throw new Error(`${VARIABLE_DU_CONTENU} : le fichier de contenu « ${chemin} » est introuvable.`);
  }
  if (!fichier.isFile()) throw new Error(`${VARIABLE_DU_CONTENU} : « ${chemin} » n’est pas un fichier.`);
  return chemin;
}

/** La variante du fichier fourni quand il est déjà dérivé (`complete` ou `sans-exemples`), ou null. Une autre valeur est une erreur. */
export function contenuDejaDerive(env = process.env) {
  const brut = env[VARIABLE_DU_CONTENU_DERIVE];
  if (brut === undefined || String(brut).trim() === '') return null;
  if (brut !== 'complete' && brut !== 'sans-exemples') throw new Error(`${VARIABLE_DU_CONTENU_DERIVE} : « ${brut} » n’est ni « complete » ni « sans-exemples ».`);
  return brut;
}

/** Copie le contenu fourni vers `destination` (un fichier d'un dossier temporaire du lecteur) : l'original n'est jamais ouvert en écriture. */
export function copierLeContenu(fichier, destination) {
  copyFileSync(fichier, destination);
}

/** La vue que porte un extrait du site de dev (serveur/extrait.mjs) : elle dit d'où vient le fichier, et n'est pas du schéma (data/schema.sql ne l'a pas). */
export const VUE_DE_L_EXTRAIT = 'extrait_meta';

export class ErreurContenuFourni extends Error {}

/** Le numéro de structure (`PRAGMA user_version = N`) d'un texte de data/schema.sql. */
export function versionDuSchemaSql(sql) {
  const m = /^PRAGMA user_version\s*=\s*(\d+)/m.exec(sql);
  if (!m) throw new ErreurContenuFourni('data/schema.sql ne porte pas « PRAGMA user_version = N »');
  return Number(m[1]);
}

/**
 * Prépare la COPIE de travail d'un contenu fourni (jamais le fichier fourni lui-même) pour qu'elle ait la structure du dépôt `racine` :
 *   - la vue `extrait_meta` est retirée (les lecteurs qui listent les vues ou refont un extrait la refuseraient) ;
 *   - structure plus ancienne que data/schema.sql : `migrer(copie)` applique les migrations manquantes (scripts/db-preparer-contenu.mjs#migrerLaCopie) ;
 *   - plus récente : ErreurContenuFourni (le site de dev a reçu des migrations que la branche n'a pas : rebaser sur dev).
 * @param {string} copie
 * @param {{ racine: string, migrer: (copie: string) => void }} o
 * @returns {{ vue_retiree: boolean, avant: number, apres: number }}
 */
export function preparerLaCopie(copie, { racine, migrer }) {
  const attendu = versionDuSchemaSql(readFileSync(join(racine, 'data', 'schema.sql'), 'utf8'));
  const db = new DatabaseSync(copie);
  let avant;
  let vue;
  try {
    vue = Boolean(db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'view' AND name = ?").get(VUE_DE_L_EXTRAIT));
    if (vue) db.exec(`DROP VIEW "${VUE_DE_L_EXTRAIT}"`);
    avant = db.prepare('PRAGMA user_version').get().user_version;
  } finally {
    db.close();
  }
  if (avant > attendu) {
    throw new ErreurContenuFourni(`${VARIABLE_DU_CONTENU} : le contenu fourni a la structure ${avant}, ce dépôt la structure ${attendu} : le site de dev a reçu des migrations `
      + 'que cette branche n’a pas. Rebasez la branche sur dev.');
  }
  if (avant < attendu) {
    migrer(copie);
    const relue = new DatabaseSync(copie, { readOnly: true });
    let apres;
    try {
      apres = relue.prepare('PRAGMA user_version').get().user_version;
    } finally {
      relue.close();
    }
    if (apres !== attendu) throw new ErreurContenuFourni(`${VARIABLE_DU_CONTENU} : la copie du contenu fourni est restée à la structure ${apres} après les migrations (attendu : ${attendu})`);
  }
  return { vue_retiree: vue, avant, apres: attendu };
}
