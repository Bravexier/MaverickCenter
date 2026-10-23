// Couleurs des parties du guide : la valeur de chaque couleur est ici (la règle) ; une page n'en pose que la classe (lib/palette-css.mjs, famille
// `partie` : `.couleur-partie-<id>` ; choix du propriétaire du 2026-10-22, « Module JS → classe », et sa réponse : « La classe CSS du site qui va avec la
// couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la couleur du classeur. »).
// Sans import (le module de la palette l'importe) ; à part de lib/livres.mjs, le plan du site, qui entre dans la chaîne de l'édition du navigateur (par
// lib/metiers.mjs) : le navigateur ne reçoit aucune de ces couleurs, seulement les ids des parties (`partie` d'un groupe du plan) et les noms des classes
// que les pages posent.

/**
 * Les couleurs des parties de l'ancien guide (clé = l'id de la partie, celui de lib/livres.mjs#PARTIES), assez foncées pour un texte blanc dessus. Elles
 * colorent les groupes de Découvrir et des Bases (leurs pages, leurs cartes « Par où commencer ? » de l'accueil, leurs groupes dans le sommaire des Bases)
 * et les quatre zones de la fiche de personnage (pages/fiche/index.astro). Une couleur d'interface du site, d'aucune source.
 */
export const COULEURS_DES_PARTIES = Object.freeze({
  decouvrir: '#2a6f97',
  creer: '#2e7d4f',
  jouer: '#b03030',
  progresser: '#6a4a9c',
  'plus-loin': '#5a6470',
});
