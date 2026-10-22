// Couleurs des six caractéristiques (et des compétences qui en dépendent), des six postures et des neuf alignements (demande du propriétaire). Fonctions
// pures. La valeur de chaque couleur est ici (la règle) ; une page n'en pose que la classe (lib/palette-css.mjs, familles `caracteristique`, `posture`,
// `alignement`, plus la classe `par-defaut` de chacune, de valeur COULEUR_NEUTRE : choix du propriétaire du 2026-10-22, « Module JS → classe »).
//
// Repère visuel sans valeur de règle, comme la couleur d'une magie (sort-format.mjs#couleurDeMagie) ou d'une catégorie de classe
// (class-groups.mjs#classColor) : une compétence prend la couleur de sa caractéristique (competence.caracteristique_id). Clés = identifiants
// de la base : `caracteristique.id`, et la fin de `posture.id` (« guide/postures#posture:offensif » → « offensif »). Toutes ces couleurs sont
// claires : un texte posé dessus est presque noir (sort-format.mjs#texteSurCouleur, posé par la classe), dans les deux thèmes. Sans import.

export const COULEURS_CARACTERISTIQUES = {
  force: '#ff6666',
  volonte: '#ff99ff',
  intelligence: '#66ccff',
  perception: '#ffcc00',
  social: '#dddddd',
  agilite: '#99ff66',
};

export const COULEURS_POSTURES = {
  offensif: '#ff6666',
  neutre: '#eeeeee',
  defensif: '#99ff99',
  focus: '#9999ff',
  vigilance: '#ffff66',
  symbiose: '#cc66ff',
};

/**
 * Couleurs des neuf alignements (demande du propriétaire) : celles de leur titre dans « Les neuf alignements » du Google Doc « Règle du jeu/Guide pour
 * MJ - Maverick » (couleur du texte des titres, lue le 2026-10-14). Clé = le nom que donne fiche-moteur.mjs#alignementDe. Couleurs foncées ou vives :
 * le texte posé dessus est choisi par texteSurCouleur.
 */
export const COULEURS_ALIGNEMENTS = {
  'Loyal Bon': '#45818e',
  'Loyal Neutre': '#3c78d8',
  'Loyal Mauvais': '#674ea7',
  'Neutre Bon': '#6aa84f',
  Neutre: '#999999',
  'Neutre Mauvais': '#783f04',
  'Chaotique Bon': '#f1c232',
  'Chaotique Neutre': '#e69138',
  'Chaotique Mauvais': '#cc0000',
};

/**
 * Couleur d'une caractéristique, d'une posture ou d'un alignement absent des listes (aucun aujourd'hui : test/caracteristiques-postures.test.mjs) ; sa
 * classe est `couleur-<famille>-par-defaut` (lib/palette-css.mjs).
 */
export const COULEUR_NEUTRE = '#cccccc';

/** Couleur d'une caractéristique, d'après son id (« force ») ; celle d'une compétence est celle de sa caractéristique. */
export const couleurDeCaracteristique = (id) => COULEURS_CARACTERISTIQUES[id] ?? COULEUR_NEUTRE;

/** La clé d'une posture (« offensif »), d'après son id dans la base (« guide/postures#posture:offensif ») ou sa clé. */
export const cleDePosture = (id) => String(id).slice(String(id).lastIndexOf(':') + 1);

/** Couleur d'une posture, d'après son id dans la base (« guide/postures#posture:offensif ») ou sa clé (« offensif »). */
export const couleurDePosture = (id) => COULEURS_POSTURES[cleDePosture(id)] ?? COULEUR_NEUTRE;

/** Couleur d'un alignement, d'après son nom (« Loyal Bon »). */
export const couleurDAlignement = (nom) => COULEURS_ALIGNEMENTS[nom] ?? COULEUR_NEUTRE;
