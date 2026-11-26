// Ce qui fait d'un lot de changements un lot de l'action « Préparer l'ancrage » (décision R309, docs/chantier-ancrage-mots-cles.md, §5) : sa décision ET son auteur.
// Un lot de correction de l'équipe qui cite R309 (décision 17 : le type ou la couleur d'un mot-clé ancré) est un lot ordinaire : ni replié sur la page Mise à jour, ni
// annulé par groupes de reclassement, ni lu comme des lignes écartées du plan. Sans dépendance : lu par le service, le plan et la page (src/scripts/mise-a-jour.mjs).

/** La décision des lots de l'ancrage. */
export const DECISION_DE_L_ANCRAGE = 'R309';
/** L'auteur qu'écrit l'action dans chacun de ses lots (lib/mots-cles-ancrage.mjs#planDeLAncrage). */
export const AUTEUR_DE_L_ANCRAGE = 'préparer l’ancrage';

/** Le lot (`{ decision, auteur }` : une ligne de lot_de_changements, un lot présenté ou déposé) vient-il de l'action « Préparer l'ancrage » ? */
export const estUnLotDAncrage = (lot) => lot?.decision === DECISION_DE_L_ANCRAGE && lot?.auteur === AUTEUR_DE_L_ANCRAGE;
