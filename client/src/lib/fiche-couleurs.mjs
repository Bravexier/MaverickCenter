// Couleurs de deux règles de la fiche de personnage qui n'en avaient que dans sa feuille (styles/fiche/fiche.css) : les six paliers de résistance et
// le Mode Hyper (demande du propriétaire du 2026-10-22 : « Aucune couleur en dur. » ; choix « Module JS → classe »). La valeur de chaque couleur est
// ici (la règle) ; une page n'en pose que la classe (lib/palette-css.mjs, familles `palier` et `mode`, émises par pages/fiche/index.astro), que
// regles.json nomme (lib/fiche-regles.mjs). Repères visuels sans valeur de règle, repris tels que la fiche les montrait. Sans import.

/**
 * Le trait de chaque palier du tableau « Résistance / Faiblesse » (clé = `resistance_palier.id`) : du vert foncé de l'immunité au rouge foncé de la
 * sensibilité. Un id inconnu n'a pas de couleur (sa ligne garde le trait de la zone).
 */
export const COULEURS_DES_PALIERS = Object.freeze({
  immunite: '#1b5e20',
  grande_resistance: '#2e7d32',
  resistance: '#66bb6a',
  vulnerabilite: '#ef9a9a',
  grande_vulnerabilite: '#e53935',
  sensibilite: '#8e0000',
});

/** Les cases du Mode Hyper et du Mode Hyper 100 %, à côté des postures (ce ne sont pas des postures : elles n'en ont pas la famille). */
export const COULEURS_DU_MODE_HYPER = Object.freeze({
  hyper: '#7c3aed',
  cent: '#c026d3',
});
