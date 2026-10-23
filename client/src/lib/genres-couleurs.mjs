// Couleurs des genres de sort et des types de don : la valeur de chaque couleur est ici (la règle) ; une page n'en pose que la classe (lib/palette-css.mjs,
// familles `genre` et `don` : `.couleur-genre-<id>`, `.couleur-don-<id>`). Réponse du propriétaire du 2026-10-23 à « Sur les pages des magies, chaque sort
// affiche son genre (attaque, entrave, soin, amplification, protection, placement, invocation, construction, météo, aléatoire) dans une étiquette teintée.
// Sur les pages de classe, chaque don affiche son type (passif, actif, action, réaction, variable) de la même façon. Ces teintes ont été choisies par le
// site : aucune source connue (Docs, Sheets, Discord) ne donne de couleur à un genre de sort ni à un type de don. Elles sont aujourd'hui calculées dans la
// feuille par une teinte écrite en dur (`hsl(…)`), ce qui contredit « Aucune couleur en dur ». Que faire ? » : « Garder les teintes actuelles
// (Recommandé) » ; option : « Garder les teintes actuelles comme couleurs du site : chaque genre et chaque type de don reçoit sa classe du site, avec la
// teinte qu'il a aujourd'hui, comme les parties du guide. Le rendu ne change pas, dans les deux thèmes. Aucune couleur nouvelle. »
// Chaque valeur est l'ancienne `hsl(<teinte> <saturation> 50%)` en hex (genres : saturation 60 % ; types : 55 %, Passif 30 % ; Aléatoire et Variable :
// 0 %, le gris). Les clés sont celles des CHECK de sort_type.type et capacite.type (listes fermées : pas de `par-defaut`). Sans import.

/** Les genres de sort (sort_type.type, lib/sort-analyse.mjs#TYPES_DE_SORT) → leur couleur. */
export const COULEURS_DES_GENRES = Object.freeze({
  attaque: '#cc4033',
  entrave: '#8c33cc',
  soin: '#ccbf33',
  amplification: '#33cc33',
  protection: '#33bfcc',
  placement: '#cc9e33',
  invocation: '#cc3399',
  construction: '#cc6b33',
  meteo: '#3347cc',
  aleatoire: '#808080',
});

/** Les types de don (capacite.type, lib/classe-champs.mjs#TYPES_DE_DON) → leur couleur. */
export const COULEURS_DES_TYPES_DE_DON = Object.freeze({
  passif: '#5980a6',
  actif: '#c68439',
  action: '#c64539',
  reaction: '#8b39c6',
  variable: '#808080',
});
