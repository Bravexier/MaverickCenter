// Le refus commun des services d'édition quand le corps d'une page n'a plus la forme de l'importeur (serveur/edition-armes.mjs, edition-armures.mjs,
// edition-composants.mjs, edition-consommables.mjs). ErreurEdition est donnée par l'appelant (serveur/edition.mjs), sans import en retour.

/**
 * Calcule le nouveau corps d'une page ; si le calcul lève `ErreurCorps` (corps sans la forme de l'importeur), le lot est refusé (500) et rien n'est
 * enregistré. Toute autre erreur remonte telle quelle.
 * @param {Function} ErreurEdition
 * @param {Function} ErreurCorps la classe d'erreur du module lib/corps-….mjs
 * @param {string} id la page
 * @param {() => string} calculer
 */
export function corpsOuRefus(ErreurEdition, ErreurCorps, id, calculer) {
  try {
    return calculer();
  } catch (e) {
    if (e instanceof ErreurCorps) throw new ErreurEdition(500, `Page ${id} : corps illisible (${e.message}) ; rien n’est enregistré.`);
    throw e;
  }
}
