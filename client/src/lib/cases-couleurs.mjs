// Couleurs des cases de tableau du Markdown des pages (« {couleur:vert} » en tête de case : lib/markdown-couleurs.mjs, modifiables depuis le site de dev) :
// la valeur de chaque couleur est ici (la règle) ; une case n'en porte que la classe (lib/palette-css.mjs, famille `case` : `.couleur-case-<id>`, que
// lit styles/global/wiki.css). Aucune source ne donne ces couleurs : ce sont celles que le site avait (styles/global/wiki.css, avant le lot 11), gardées
// telles quelles (« Si le site n'a pas de règle il ajoute une nouvelle couleur au site »), chacune sous son nom même quand une autre famille a une teinte
// proche (« Garder séparées »). Aucun texte n'est posé sur la couleur pure : la case la mêle à 26 % à la surface, texte du site (famille sans texte,
// palette-css.mjs#FAMILLES_SANS_TEXTE ; contraste mesuré par test/palette-css.test.mjs dans les deux thèmes).
// Les clés sont celles de lib/markdown-edition.mjs#COULEURS_DE_CASE (la liste qu'écrit et relit l'éditeur, sans couleur : le navigateur la reçoit),
// dans le même ordre (testé). Pas de `par-defaut` : une case sans couleur connue n'a pas de classe. Sans import.

/** Les couleurs des cases de tableau (« {couleur:x} ») → leur couleur. */
export const COULEURS_DES_CASES = Object.freeze({
  rouge: '#c0392b',
  orange: '#e07b24',
  jaune: '#d4ac0d',
  vert: '#2e8b57',
  bleu: '#2a6fb0',
  violet: '#7b4fb0',
  gris: '#8a8a8a',
});
