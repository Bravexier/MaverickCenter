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

/**
 * Le nom d'un bâton magique pas encore réglé, dans le sac (décision R101 ; demande du propriétaire du 2026-10-17 : « pouvoir configurer correctement un
 * "bâton magique" avec la magie et le niveau de ce dernier avant de pouvoir l'assigner à un emplacement de ceinture ») : la fiche le propose seul, sa
 * magie et son niveau se choisissent dans sa ligne, qui prend alors le nom du bâton (nomDeBaton).
 */
export const BATON_A_REGLER = 'Bâton magique';

/**
 * Les effets passifs d'un bâton magique, lus dans son texte (baton_magique.bonus_brut, une ligne par effet), décision R101 : [{ cle, valeur, texte }].
 * `cle` nomme ce qu'il amplifie : deux bâtons au même `cle` ne se cumulent pas (« Il n'est pas possible d'accumuler […] les mêmes effets même si c'est
 * différents niveaux ou gemmes ») ; `valeur` : le nombre écrit, négatif pour une réduction de coût ou un malus. Une ligne d'une autre écriture est
 * rendue avec `cle` null (rappelée, jamais comptée).
 */
export function effetsDeBaton(bonus) {
  const lectures = [
    ['cout', /^co[uû]t sort -(\d+)$/, -1],
    ['cout_corruption', /^co[uû]t corruption -(\d+)$/, -1],
    ['degats', /^d[ée]g[âa]ts sort \+(\d+)$/, 1],
    ['soin', /^soin magique \+(\d+)$/, 1],
    ['portee', /^port[ée]e sort \+(\d+)$/, 1],
    ['ampli_degats', /^sort qui amplifie d[ée]g[âa]ts = \+(\d+) aux d[ée]g[âa]ts$/, 1],
    ['ampli_am', /^ampli am = \+(\d+) am donn[ée]$/, 1],
    ['ampli_ap', /^ampli ap = \+(\d+) ap donn[ée]$/, 1],
    ['protection', /^protection = \+(\d+) d[ée]g[âa]ts bloqu[ée]s$/, 1],
    ['invocation', /^invocation \+(\d+) sant[ée]$/, 1],
    ['malus_esquive', /^malus de (\d+)% pour esquiver effet secondaire$/, -1],
  ];
  return String(bonus ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((texte) => {
    const t = texte.toLowerCase().replace(/\s+/g, ' ');
    for (const [cle, re, signe] of lectures) {
      const m = re.exec(t);
      if (m) return { cle, valeur: signe * Number(m[1]), texte };
    }
    return { cle: null, valeur: null, texte };
  });
}
