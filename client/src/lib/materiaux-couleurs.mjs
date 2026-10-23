// Couleurs des matériaux d'arme (demande du propriétaire : « Chaque matériau a sa couleur comme dans l'onglet Arme des Ressources et craft ») : le fond de
// la case « Matière » du tableau MATERIAUX de l'onglet « Armes » (Google Sheet « Ressources et Craft », Armes!O3:O30), lu dans le classeur le
// 2026-10-13 (les mêmes que sur la capture fournie par le propriétaire). Repère visuel sans valeur de règle, comme la couleur d'une caractéristique
// (caracteristiques-postures.mjs). Clés = fin de l'identifiant du matériau dans la base (ressource.id « ressources/armures#materiau:fer-noir » →
// « fer-noir ») ; test/materiaux-couleurs.test.mjs vérifie que chaque matériau d'arme en a une.
//
// La valeur de chaque couleur est ici (la règle) ; une page n'en pose que la classe (lib/palette-css.mjs, famille `materiau`, `classeDeMateriau` ; choix
// du propriétaire du 2026-10-22, « Module JS → classe »). Le texte posé dessus suit la règle du site (sort-format.mjs#texteSurCouleur, « Privilégé la
// lisibilité. ») et non plus celle du classeur (noir partout, blanc sur Fer noir et Fonte) : blanc sur Bronze et Maverium (le noir n'y atteignait que
// 3,6:1) ; le fond du Titane, trop moyen pour un texte foncé, est à peine éclairci par la palette (alchimie-couleurs.mjs#lisible) ; sa couleur de
// référence reste ici. Un matériau sans couleur (ceux des armures seulement, un matériau ajouté) a la classe `par-defaut` (COULEUR_NEUTRE). Sans import.

export const COULEURS_DES_MATERIAUX = {
  fer: '#7f7f7f',
  acier: '#afafaf',
  'fer-noir': '#000000',
  argent: '#c0c0c0',
  fonte: '#434343',
  cuivre: '#ba7746',
  bronze: '#666655',
  os: '#ffffff',
  laiton: '#d8a952',
  or: '#ffd700',
  'vif-argent': '#efefef',
  mythril: '#9fc5e8',
  titane: '#3c78d8',
  maverium: '#666666',
};

/** Clé d'un matériau : « fer-noir » pour « ressources/armures#materiau:fer-noir ». */
export const cleDeMateriau = (ressourceId) => String(ressourceId).slice(String(ressourceId).lastIndexOf(':') + 1);

/** La couleur d'un matériau (« #rrggbb »), d'après son identifiant dans la base ; null s'il n'en a pas (sa classe est alors `par-defaut`). */
export const couleurDeMateriau = (ressourceId) => COULEURS_DES_MATERIAUX[cleDeMateriau(ressourceId)] ?? null;
