// Maîtrises d'armes écrites en toutes lettres dans la base, lues pour la fiche de personnage (lib/fiche-regles.mjs, au build) : le dé d'une famille
// d'armes qui dépend de la Force (Pugilat : « D6 1-2 Force, D8 3-4 Force, D10 5 Force », arme_famille.note_brut) et les points de maîtrise qu'un don
// donne (« +2 points de maîtrise à répartir », « +1 maîtrise Dague », capacite.effet). Rien n'est déduit : seul ce que le texte écrit compte.
// Pur, sans dépendance.

const plier = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Paliers du dé selon la Force écrits dans une note (« D6 1-2 Force, D8 3-4 Force, D10 5 Force ») : [{ de: 'D6', min: 1, max: 2 }, …], dans l'ordre
 * du texte ; null quand la note n'en écrit aucun.
 */
export function desSelonLaForce(note) {
  const paliers = [...plier(note).matchAll(/\b(d\d+)\s+(\d+)(?:\s*-\s*(\d+))?\s+force\b/g)]
    .map((m) => ({ de: m[1].toUpperCase(), min: Number(m[2]), max: Number(m[3] ?? m[2]) }));
  return paliers.length ? paliers : null;
}

/**
 * Points de maîtrise d'arme que donne le texte d'un don : la somme de ses « N point(s) de maîtrise … » et « N maîtrise(s) … », chacun avec son signe
 * (« -1 point de maîtrise de l'autre arme choisie » de l'Épéiste en retire un). Une limite (« pas plus de 2 points de maîtrise répartis dans la même
 * catégorie ») n'est pas un gain ; un niveau de maîtrise de sort (« 4 niveaux de maîtrise (NM) ») ne s'écrit pas ainsi. 0 quand le texte n'en donne pas.
 */
export function pointsDeMaitriseDArme(texte) {
  const t = plier(texte);
  let total = 0;
  for (const m of t.matchAll(/([+\-−]?)\s*(\d+)\s+(?:points?\s+de\s+)?maitrises?\b/g)) {
    if (/plus de\s*$/.test(t.slice(0, m.index))) continue;
    total += (m[1] && m[1] !== '+' ? -1 : 1) * Number(m[2]);
  }
  return total;
}
