// La ceinture et le sac de la fiche de personnage (décisions R88, R89), lus dans les textes de la base pour la fiche (lib/fiche-regles.mjs, au build) : la
// contenance d'un carquois ou d'un sac (« pouvant accueillir jusqu’à 10 flèches ou carreaux », ressource.description), le nombre d'exemplaires du même
// objet qu'un don permet sur un emplacement de ceinture (« Permet d'avoir 4 fois le même objet sur un emplacement de ceinture », capacite.effet), le don
// qui donne n'importe quel sac quelle que soit la Force (« Permet d'utiliser n'importe quel sac quels que soient la Force ou les malus »), et le nom sous
// lequel la fiche propose un bâton magique, qui n'a pas de nom propre dans la source. Rien n'est déduit : seul ce que le texte écrit compte.
// Pur, sans dépendance.

const plier = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’‘]/g, "'").toLowerCase();

/** La contenance qu'écrit la description d'un contenant (« jusqu’à 10 flèches », « contenant jusqu’à 10 pierres ») ; null quand elle n'en écrit pas. */
export function contenanceEcrite(description) {
  const m = /\bjusqu'a\s+(\d+)\b/.exec(plier(description));
  return m ? Number(m[1]) : null;
}

/** Le nombre d'exemplaires du même objet qu'un don permet sur un emplacement de ceinture (« Permet d'avoir 4 fois le même objet… ») ; null sinon. */
export function exemplairesDeCeintureEcrits(effet) {
  const m = /\bpermet d'avoir\s+(\d+)\s+fois le meme objet sur un emplacement de ceinture\b/.exec(plier(effet));
  return m ? Number(m[1]) : null;
}

/**
 * Vrai quand le texte d'un don donne n'importe quel sac quelle que soit la Force (« Permet d'utiliser n'importe quel sac quels que soient la Force ou
 * les malus », Mercenaire « Organisé » : le sac de la Force qui donne tout l'inventaire, décision R88).
 */
export const sacSansForceEcrit = (effet) => /\bpermet d'utiliser n'importe quel sac quels? que soi(?:en)?t la force\b/.test(plier(effet));

/**
 * Le nom d'un bâton magique dans la fiche : la source ne leur en donne pas (« La source ne leur donne pas de nom propre », table baton_magique) ; la
 * fiche les propose sous « Bâton magique <magie>, niveau <n> », d'après l'exemple de la page (« un bâton magique 1 feu et un bâton magique foudre 2 »).
 */
export const nomDeBaton = (magie, niveau) => `Bâton magique ${magie}, niveau ${niveau}`;
