// Le coût d'un sort en deux colonnes, « Coût » et « Coût secondaire » (décision R105 du propriétaire, migration 0063 ; data/schema.sql, table sort) : le
// passage de l'écriture du classeur, en une seule case (« 3 + 1 Sang »), aux deux colonnes, et le retour (corps Markdown des pages de magie, fiche en
// tableur, coût d'invocation d'une créature).
// Module pur, sans aucun import : importé par le service (serveur/edition.mjs), les modules de la fiche en tableur (que le seul script de la fiche
// importe) et les pages ; lib/corps-magies.mjs, qui n'importe rien, en recopie coutEnUneCase (test/sort-cout-secondaire.test.mjs compare les deux).

// Le coût d'un sort tel que le classeur l'écrit dans une seule case (« 3 + 1 Sang ») : deux formes seulement se répartissent sans doute possible entre « Coût »
// et « Coût secondaire » (décision R105) — un nombre de chakra (avec son expression de NM) suivi de « + » et d'un second coût qui n'est que des Sang, des âmes
// ou un pourcentage de santé (« 10 (–1/NM) + 2 âmes », « 50 + 20% PV ») ; ou des Sang, des âmes seuls (« 2 Sang », « X Sang » : le sort ne consomme pas de
// chakra, son coût est « 0 » : décision R106). Une autre écriture (« 5 + 1 âme (xNPM de créature) », « 3xN/tour ») n'est pas répartie par cette règle : le
// propriétaire a tranché les 26 de la base, sort par sort (décision R106, migration 0065).
const CHAKRA_PUIS_SECOND = /^(\d+(?: \([-–]\d+\/NM\))?) \+ ((?:\d+|X) (?:Sang|âmes?)|\d+% \p{L}+)$/u;
const SECOND_SEUL = /^(?:\d+|X) (?:Sang|âmes?)$/;

/**
 * Le coût écrit en une case, réparti entre « Coût » et « Coût secondaire » : { cout_brut, cout_secondaire } ; null quand l'écriture n'a pas de second
 * coût ou ne se répartit pas sans doute possible. Lue par la migration 0063 et par le rejeu d'un lot du site de dev noté avant elle.
 */
export function repartirLeCout(cout) {
  const texte = String(cout ?? '');
  const m = CHAKRA_PUIS_SECOND.exec(texte);
  if (m) return { cout_brut: m[1], cout_secondaire: m[2] };
  if (SECOND_SEUL.test(texte)) return { cout_brut: '0', cout_secondaire: texte };
  return null;
}

/**
 * Les deux coûts écrits en une case, comme le classeur et les fiches en tableur les écrivent : un second coût chiffré après « + » (« 3 + 1 Sang », « 50 +
 * 20% PV ») ; une précision (décision R106 : « Par tour et par cible », « Pour 1 barrière », « Par NPM de la créature invoquée ») à la suite du coût, sa
 * première lettre en minuscule (« 3 par tour et par cible ») ; le coût secondaire seul quand le sort n'a pas de coût en chakra (« 0 » et « 2 Sang » :
 * « 2 Sang » ; « N/A » et « Aléatoire » : « Aléatoire »). L'inverse de repartirLeCout pour les écritures qu'elle répartit.
 */
export function coutEnUneCase(cout, secondaire) {
  const c = String(cout ?? '');
  if (!secondaire) return c;
  if (c === '' || c === '0' || c === 'N/A') return secondaire;
  return /^(?:\d|X\b)/.test(secondaire) ? `${c} + ${secondaire}` : `${c} ${secondaire.replace(/^\p{Lu}(?=\p{Ll})/u, (l) => l.toLowerCase())}`;
}

// Un second coût écrit dans « Coût » sans la forme exacte du classeur (casse, espaces, accents : « 3+1 sang », « 3 + 2 ames », « X + 2 Sang ») : le service
// le refuse dans une valeur modifiée (serveur/edition.mjs).
const SECOND_COUT_ECRIT = /\+\s*(?:\d+|x)\s*%?\s*(?:sang|[aâ]mes?|pv|sant[ée]|ba)(?!\p{L})/iu;
const RESSOURCE_ECRITE_SEULE = /^(?:\d+|x)\s*(?:sang|[aâ]mes?)$/iu;

/** « Coût » écrit-il un second coût (Sang, âmes, % de santé ou de barrière) ? Plus large que repartirLeCout, qui ne lit que la forme du classeur. */
export function ecritUnSecondCout(cout) {
  const texte = String(cout ?? '').trim();
  return repartirLeCout(texte) !== null || SECOND_COUT_ECRIT.test(texte) || RESSOURCE_ECRITE_SEULE.test(texte);
}
