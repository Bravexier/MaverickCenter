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
 * le texte posé dessus est choisi par texteSurCouleur. Ce sont les couleurs de référence : la classe de deux d'entre elles a un fond à peine éclairci
 * (lib/palette-css.mjs#fondDeClasse ; réponse du propriétaire du 2026-10-23 à « Deux couleurs d'alignement du guide pour MJ, Loyal Bon (#45818e) et
 * Loyal Neutre (#3c78d8), n'atteignent pas le contraste minimal de lisibilité (4,5:1), ni avec le texte foncé ni avec le blanc (4,2:1 au mieux). Que
 * faire ? » : « Éclaircir (Recommandé) » ; option : « Fond à peine éclairci (#4e8794 et #467fda), texte foncé : lisible ; les couleurs de référence du
 * guide restent dans le code. »).
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

// La règle d'un id : sa couleur, ou COULEUR_NEUTRE s'il est inconnu. Aucune page ne pose ces couleurs (elles posent la classe : lib/palette-css.mjs,
// dont classeDeCaracteristique, classeDePosture et classeDAlignement suivent la même règle, l'inconnu ayant la classe `par-defaut`) ; ces fonctions
// sont la référence que les tests comparent (test/caracteristiques-postures.test.mjs, test/palette-css.test.mjs).

/** Couleur d'une caractéristique, d'après son id (« force ») ; celle d'une compétence est celle de sa caractéristique. */
export const couleurDeCaracteristique = (id) => COULEURS_CARACTERISTIQUES[id] ?? COULEUR_NEUTRE;

/** La clé d'une posture (« offensif »), d'après son id dans la base (« guide/postures#posture:offensif ») ou sa clé. */
export const cleDePosture = (id) => String(id).slice(String(id).lastIndexOf(':') + 1);

/** Couleur d'une posture, d'après son id dans la base (« guide/postures#posture:offensif ») ou sa clé (« offensif »). */
export const couleurDePosture = (id) => COULEURS_POSTURES[cleDePosture(id)] ?? COULEUR_NEUTRE;

/** Couleur d'un alignement, d'après son nom (« Loyal Bon »). */
export const couleurDAlignement = (nom) => COULEURS_ALIGNEMENTS[nom] ?? COULEUR_NEUTRE;
