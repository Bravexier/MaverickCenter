// Le contenu fourni au build (lot 9 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md ; docs/serveur.md,
// « Fabriquer le site depuis un fichier de contenu ») : la variable MAVERICK_CONTENU=<fichier SQLite> (un extrait du contenu du site de dev,
// serveur/extrait.mjs) remplace, pour tout ce qui lit la base au build, la reconstruction depuis data/rows. Posée, le build n'a plus besoin de data/rows ;
// le fichier fourni n'est jamais modifié (chaque lecteur en prend une copie dans son dossier temporaire). Absente (ou vide), rien ne change : le build
// par défaut reconstruit la base depuis data/rows, comme avant.
// Module Node seulement (node:fs, node:path), sans dépendance navigateur ni Astro.
import { copyFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

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
