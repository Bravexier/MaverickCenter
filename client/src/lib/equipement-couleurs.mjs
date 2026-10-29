// Couleurs des pages Armes, Armures et Boucliers : la valeur de chaque couleur est ici (la règle) ; une page n'en pose que
// la classe (lib/palette-css.mjs, familles `armure`, `poids` et `arme` ; choix du propriétaire du 2026-10-22, « Module JS → classe », et sa réponse :
// « La classe CSS du site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la couleur du
// classeur. »). Repères visuels sans valeur de règle, relevés dans le classeur « Ressources et Craft ». Sans import (le module de la palette l'importe :
// lib/armures-rendu.mjs, qui importe la palette, ne peut pas être importé par elle).

/**
 * Couleur de chaque type d'armure et de matière : le fond des cases « Matière » du tableau MATERIAUX de l'onglet « Armures » (vert léger, jaune
 * intermédiaire, rouge lourd), relevé sur la capture du propriétaire (2026-10-15) ; la légende de la grille de l'onglet nomme ces trois types (ses clés
 * sont aussi la liste des types de la grille : components/armures/ArmuresPage.astro). Les vêtements, armures de familiers et matériaux « Autres » n'en
 * ont pas dans la source : COULEUR_SANS_TYPE.
 */
export const COULEURS_DES_TYPES = {
  'Léger': '#d9ead3',
  'Intermédiaire': '#fff2cc',
  'Lourd': '#f4cccc',
};

/**
 * Couleur de chaque poids de bouclier : le fond de la case du poids dans la liste de l'onglet « Bouclier » du classeur original (B35 Léger vert, B37
 * Moyen jaune, B39 Lourd orange, B41 Très lourd rouge), la même que porte la case de chaque bouclier de la grille, d'où son poids est tiré
 * (bouclier.poids_id : migration 0054, décision R92 ; demande du propriétaire, 2026-10-16 : « base toi sur la couleur du tableau d'orignie et
 * affiche le dans le résultat final », sic). Sur le site, la couleur n'est qu'un repère : la règle est la Force minimum du poids. Clé = bouclier_poids.id.
 */
export const COULEURS_DES_POIDS = {
  'leger': '#93c47d',
  'moyen': '#ffd966',
  'lourd': '#f6b26b',
  'tres-lourd': '#e06666',
};

/** Le gris d'un type ou d'un poids sans couleur dans la source (la classe `par-defaut` des familles `armure` et `poids`). */
export const COULEUR_SANS_TYPE = '#eeeeee';

/**
 * Couleur des armes de départ : « Les armes en bleu sont les armes possibles en arme de départ » (panneau de règles de l'onglet Armes : la phrase et
 * les lignes de ces armes sont en bleu dans le classeur). Aucun texte n'est posé sur ce bleu en fond : les lignes, le filtre, la légende et la phrase en
 * tirent une nuance sur la surface et un filet, et la phrase la couleur de son texte, mêlée au texte du site (styles/armes/armes.css, `--depart`).
 */
export const COULEURS_DES_ARMES = {
  depart: '#3c78d8',
};
