// Instant ISO 8601 en UTC à la seconde : le format des colonnes `cree_le` / `modifie_le` / `*_le` et des annonces. Un seul endroit pour l'écrire.
export const instant = (date = new Date()) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');
