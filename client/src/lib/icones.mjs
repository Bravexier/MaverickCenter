// La liste des icônes du site qu'un mot-clé peut porter (mot_cle.icone, migration 0116 ; décision R235 : « tu peux mettre une colonne supplémentaire
// avec "icone" [...] Pour le moment, seul les monnaies vont l'utiliser » ; l'icône se choisit sur le site de dev dans la liste des icônes du site).
// La seule liste : db:check (client/scripts/db-check.mjs), le service (serveur/edition.mjs#refuserLIcone, GET /api/edition/mots-cles/, l'API v1) et le
// menu du site de dev la lisent. Une icône s'écrit « <famille>:<id> », sur le modèle de mot_cle.couleur (le CHECK de la colonne ne lit que cette
// forme) ; famille « monnaie » : les trois monnaies du jeu (lib/monnaies.mjs#MONNAIES_DU_JEU), dessinées par la classe « piece piece--<id> »
// (styles/global/monnaies.css). C'est un dessin du site, pas une ligne de la base : une monnaie supprimée ne retire pas son icône.
// Pur, sans dépendance navigateur ni Astro (un module feuille, avec lib/monnaies.mjs).
import { MONNAIES_DU_JEU } from './monnaies.mjs';

/** Les familles d'icônes : id → libellé du groupe dans le menu. */
export const FAMILLES_D_ICONES = Object.freeze({ monnaie: 'Monnaies' });

/**
 * Les icônes du site, dans l'ordre du menu : [{ valeur: 'famille:id', famille, id, libelle, classe }] — `classe` : les classes CSS du dessin (une
 * monnaie : « piece piece--rf »), `libelle` : son nom (celui de la monnaie).
 */
export const ICONES = Object.freeze(Object.values(MONNAIES_DU_JEU)
  .sort((a, b) => a.valeur_rf - b.valeur_rf)
  .map((m) => Object.freeze({ valeur: `monnaie:${m.id}`, famille: 'monnaie', id: m.id, libelle: m.nom, classe: `piece piece--${m.id}` })));

const PAR_VALEUR = new Map(ICONES.map((i) => [i.valeur, i]));

/** L'icône de valeur `valeur` (« monnaie:ro »), ou null. */
export const icone = (valeur) => (typeof valeur === 'string' ? PAR_VALEUR.get(valeur) ?? null : null);

/** La faute d'une icône écrite (une chaîne qui n'est pas dans ICONES), ou null quand elle convient ; NULL (aucune icône) convient toujours. */
export function fauteDeLIcone(valeur) {
  if (valeur === null || valeur === undefined) return null;
  if (typeof valeur !== 'string') return 'une icône s’écrit « famille:id »';
  if (PAR_VALEUR.has(valeur)) return null;
  return `ce n’est pas une icône du site (${ICONES.map((i) => i.valeur).join(', ')})`;
}
