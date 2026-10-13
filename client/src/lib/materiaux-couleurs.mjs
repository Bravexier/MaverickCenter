// Couleurs des matériaux d'arme (demande du propriétaire : « Chaque matériau a sa couleur comme dans l'onglet Arme des Ressources et craft ») : le fond de
// la case « Matière » du tableau MATERIAUX de l'onglet « Armes » (Google Sheet « Ressources et Craft », Armes!O3:O30), et la couleur de son texte, lus
// dans le classeur le 2026-10-13 (les mêmes que sur la capture fournie par le propriétaire). Repère visuel sans valeur de règle, comme
// la couleur d'une caractéristique (caracteristiques-postures.mjs). Clés = fin de l'identifiant du matériau dans la base (ressource.id
// « ressources/armures#materiau:fer-noir » → « fer-noir ») ; test/materiaux-couleurs.test.mjs vérifie que chaque matériau d'arme en a une.

export const COULEURS_DES_MATERIAUX = {
  fer: { fond: '#7f7f7f', texte: '#000000' },
  acier: { fond: '#afafaf', texte: '#000000' },
  'fer-noir': { fond: '#000000', texte: '#ffffff' },
  argent: { fond: '#c0c0c0', texte: '#000000' },
  fonte: { fond: '#434343', texte: '#ffffff' },
  cuivre: { fond: '#ba7746', texte: '#000000' },
  bronze: { fond: '#666655', texte: '#000000' },
  os: { fond: '#ffffff', texte: '#000000' },
  laiton: { fond: '#d8a952', texte: '#000000' },
  or: { fond: '#ffd700', texte: '#000000' },
  'vif-argent': { fond: '#efefef', texte: '#000000' },
  mythril: { fond: '#9fc5e8', texte: '#000000' },
  titane: { fond: '#3c78d8', texte: '#000000' },
  maverium: { fond: '#666666', texte: '#000000' },
};

/** Couleur d'un matériau absent de la liste (un matériau ajouté plus tard) : neutre. */
export const COULEUR_DE_MATERIAU_NEUTRE = { fond: '#cccccc', texte: '#000000' };

/** Clé d'un matériau : « fer-noir » pour « ressources/armures#materiau:fer-noir ». */
export const cleDeMateriau = (ressourceId) => String(ressourceId).slice(String(ressourceId).lastIndexOf(':') + 1);

/** { fond, texte } d'un matériau, d'après son identifiant dans la base. */
export const couleurDeMateriau = (ressourceId) => COULEURS_DES_MATERIAUX[cleDeMateriau(ressourceId)] ?? COULEUR_DE_MATERIAU_NEUTRE;

/** Variables CSS d'une case teintée d'un matériau : `--mat` (fond) et `--mat-texte`. */
export const styleDeMateriau = (ressourceId) => {
  const c = couleurDeMateriau(ressourceId);
  return `--mat: ${c.fond}; --mat-texte: ${c.texte}`;
};
