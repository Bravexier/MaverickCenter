// Couleurs de la page Accessoires (/ressources/accessoires/) : la valeur de chaque couleur est ici (la règle) ; une page n'en pose que la classe
// (lib/palette-css.mjs, famille `niveau` : `.couleur-niveau-<n>` ; choix du propriétaire du 2026-10-22, « Module JS → classe », et sa réponse : « La
// classe CSS du site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la couleur du classeur. »).
// Sans import (le module de la palette l'importe) ; à part de lib/accessoires-generateur.mjs, la logique du générateur que le script de la page importe :
// le navigateur ne reçoit aucune de ces couleurs, seulement les noms des classes que la page pose.

/**
 * Couleurs des niveaux (demande du propriétaire : « coloriser les lignes des effets et du produit final par le niveau de la même manière que l'Excel
 * d'origine ») : fond des cases « Niveau 1 » à « Niveau 5 » du tableau « Monture » de l'onglet « Accessoires » (capture fournie par le propriétaire le
 * 2026-10-14). Repère visuel sans valeur de règle ; des fonds clairs, sous le texte de la règle du site (sort-format.mjs#texteSurCouleur : le texte
 * foncé), en thème sombre aussi. Les niveaux 1, 2 et 4 ont la valeur des types d'armure Léger, Intermédiaire et Lourd (lib/equipement-couleurs.mjs), le 2
 * aussi celle de la magie Lumière : chaque couleur garde son nom et sa classe (choix « Garder séparées »).
 */
export const COULEURS_DES_NIVEAUX = Object.freeze({ 1: '#d9ead3', 2: '#fff2cc', 3: '#fce5cd', 4: '#f4cccc', 5: '#e6b8af' });
