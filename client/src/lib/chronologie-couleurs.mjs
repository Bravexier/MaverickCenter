// Couleurs de la chronologie (/chronologie/, docs/chronologie.md) : la règle du site qui donne une teinte à chaque événement, la valeur de chaque couleur
// est ici ; une page n'en pose que la classe (lib/palette-css.mjs : `.couleur-evenement-<id>`, classeDEvenement, cssDesEvenements ; choix du
// propriétaire du 2026-10-22, « Module JS → classe », et sa réponse : « La classe CSS du site qui va avec la couleur de base, comme pour les magies. Si
// elle n'existe pas, créer une classe CSS avec la couleur du classeur. »). Aucune source ne donne de couleur à un événement, une époque ni un Impact :
// cette règle est celle du site, un repère visuel.
// Sans import (comme les autres modules des couleurs) : lu au build par components/chronologie/Chronologie.astro et, sur le site de dev, par l'éditeur
// (src/scripts/edition/chronologie.mjs), qui recalcule les teintes d'après la base vivante ; la palette ne l'importe pas (les couleurs dépendent de la
// liste des événements : elle reçoit la Map que rend couleursDesEvenements).

/** Contraste WCAG entre deux couleurs « #rrggbb » (1 à 21). */
export function contraste(a, b) {
  const luminance = (hex) => {
    const [r, g, v] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * v;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** « #rrggbb » d'une teinte TSL (t en degrés, s et l de 0 à 1). */
function hexDeTsl(t, s, l) {
  const f = (n) => {
    const k = (n + t / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${[f(0), f(8), f(4)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** « Date inconnue » : gris. */
export const COULEUR_INCONNUE = '#5a6470';
/** « Aujourd'hui » : vert sombre. */
export const COULEUR_AUJOURDHUI = '#24715a';
/** La roue des couleurs, dans l'ordre de lecture : du violet (les origines) au rouge (les derniers siècles). */
const TEINTE_DU_DEBUT = 285;
const TEINTE_DE_LA_FIN = 5;
/** Le blanc du texte posé sur chaque teinte : le contraste que vise la règle (marge sur le seuil de 4,5:1). */
const BLANC = '#ffffff';
const CONTRASTE_VISE = 4.6;

/**
 * Couleurs de la frise et des pages, une par événement (demande du propriétaire : la chronologie en une immense barre verticale avec un dégradé).
 * Les événements « Au début » et datés suivent la roue des couleurs dans l'ordre de lecture, du violet (les origines) au rouge (les derniers siècles),
 * en passant par le bleu, le vert et l'or ; « Date inconnue » est gris, « Aujourd'hui » vert sombre. Chaque teinte est assez foncée pour un texte blanc
 * dessus (4,5:1). Pur repère visuel : aucune époque du lore n'en est déduite. Rend une Map(id -> « #rrggbb »).
 */
export function couleursDesEvenements(evenements) {
  const roue = evenements.filter((e) => e.epoque === 'debut' || e.epoque === 'datee');
  const couleurs = new Map();
  roue.forEach((e, i) => {
    const t = TEINTE_DU_DEBUT - (roue.length > 1 ? i / (roue.length - 1) : 0) * (TEINTE_DU_DEBUT - TEINTE_DE_LA_FIN);
    // la plus claire des teintes qui gardent 4,5:1 (marge : 4,6) avec le blanc
    let l = 0.4;
    while (contraste(hexDeTsl(t, 0.58, l), BLANC) < CONTRASTE_VISE) l -= 0.01;
    couleurs.set(e.id, hexDeTsl(t, 0.58, l));
  });
  for (const e of evenements) {
    if (e.epoque === 'inconnue') couleurs.set(e.id, COULEUR_INCONNUE);
    if (e.epoque === 'aujourdhui') couleurs.set(e.id, COULEUR_AUJOURDHUI);
  }
  return couleurs;
}
