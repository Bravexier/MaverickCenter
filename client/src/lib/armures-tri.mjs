// Tri de la liste des boucliers de l'onglet Boucliers de /ressources/equipement/ (demande du propriétaire, 2026-10-16 : « La liste complète des
// boucliers doit être sur un seul tableau, replié par défaut et triable par toutes les colonnes ») : la part pure, que le script de la page
// (src/scripts/armures.mjs) applique aux lignes du tableau et que test/armures-tri.test.mjs vérifie.
//   * Un clic sur un en-tête : croissant, puis décroissant, puis l'ordre de l'onglet (triSuivant).
//   * Un nombre se compare aux nombres, un texte aux textes (ordre français, nombres dans le texte lus comme des nombres, sans casse ni accents).
//   * Une valeur absente (prix « ???? », AP ou AM non écrit, bouclier sans poids) va toujours à la fin, quel que soit le sens ; à égalité, l'ordre
//     de l'onglet.
// Module pur, sans import : seul le script de la page l'importe (deux scripts de page ne partagent jamais un module).

/** Le tri suivant après un clic sur l'en-tête `cle` : croissant, puis décroissant, puis l'ordre de l'onglet ({ cle: null }). */
export const triSuivant = (tri, cle) => (tri?.cle !== cle ? { cle, sens: 'asc' } : tri.sens === 'asc' ? { cle, sens: 'desc' } : { cle: null, sens: 'asc' });

/** Une valeur qui ne se trie pas : absente, ou un nombre qui n'en est pas. */
export const absente = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

/** Compare deux valeurs présentes : nombres entre eux, sinon textes (ordre français). */
export const comparerValeurs = (a, b) =>
  (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' }));

/**
 * Les lignes dans l'ordre du tri : `tri` = { cle, sens } (cle null : l'ordre de l'onglet) ; `valeur(ligne, cle)` lit la valeur de la colonne,
 * `ordre(ligne)` le rang dans l'onglet. Rend un nouveau tableau ; une valeur absente à la fin quel que soit le sens, égalités dans l'ordre de l'onglet.
 */
export function ordonner(lignes, tri, { valeur, ordre }) {
  const parDefaut = (a, b) => ordre(a) - ordre(b);
  if (!tri?.cle) return [...lignes].sort(parDefaut);
  const inverse = tri.sens === 'desc' ? -1 : 1;
  return [...lignes].sort((a, b) => {
    const [va, vb] = [valeur(a, tri.cle), valeur(b, tri.cle)];
    if (absente(va) || absente(vb)) return absente(va) && absente(vb) ? parDefaut(a, b) : absente(va) ? 1 : -1;
    const c = comparerValeurs(va, vb);
    return c === 0 ? parDefaut(a, b) : inverse * c;
  });
}
