// La lecture de l'interrupteur de la bascule 2 (tools/flux-git/bascule-2.json), seule, SANS AUCUN IMPORT : le script du job `livrer` de mise-a-jour.yml
// (client/scripts/mise-a-jour-github.mjs), qui tourne avec des jetons, ne dépend que de modules sans import (test mise-a-jour-github). Reprise par
// tools/flux-git/bascule-2.mjs (livraison) et client/scripts/controler-le-contenu-ecrit.mjs : une seule lecture partout.

/** L'interrupteur, relatif à la racine du dépôt. */
export const INTERRUPTEUR = 'tools/flux-git/bascule-2.json';
/** Lit l'interrupteur (le texte du fichier, ou null s'il est absent : éteint). Lève une Error sur un fichier illisible. */
export function lireLInterrupteur(texte) {
  if (texte === null || texte === undefined) return false;
  let v;
  try {
    v = JSON.parse(texte);
  } catch {
    throw new Error(`${INTERRUPTEUR} illisible (JSON attendu : { "actif": false } ou { "actif": true })`);
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${INTERRUPTEUR} : un objet JSON est attendu, avec « actif » à true ou false`);
  // « actif » seul gouverne la publication ; « gel_des_fusions » est l'autre clé du fichier (client/scripts/gel-des-fusions-lib.mjs). Absent : éteint.
  if (v.actif === undefined) return false;
  if (typeof v.actif !== 'boolean') throw new Error(`${INTERRUPTEUR} : « actif » doit valoir true ou false`);
  return v.actif;
}
