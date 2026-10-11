// Filtres et tri du tableau de /metiers/ (demande du propriétaire : filtrer et trier les métiers pour chaque colonne), lus sur le texte affiché de
// chaque cellule ; l'état tient dans l'adresse (?tri=bonus&sens=desc&nom=forg), comme la recherche des personnages. Fonctions pures, sans aucune
// dépendance (comme lib/personnages-liste.mjs : un module partagé avec le script de la recherche, text.mjs, deviendrait un module commun que la version
// portable ne sait pas mettre en ligne) : importées par le seul script de components/metier/MetiersTableau.astro et par les tests.

/** Texte comparable : sans accents ni casse, blancs réduits. */
const normaliser = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Colonnes du tableau, dans l'ordre : clé (paramètre d'adresse), libellé. */
export const COLONNES_METIERS = [
  { cle: 'nom', libelle: 'Nom' },
  { cle: 'bonus', libelle: 'Bonus' },
  { cle: 'artisanat', libelle: 'Artisanat' },
  { cle: 'caracteristiques', libelle: 'Caractéristiques' },
  { cle: 'equipement', libelle: 'Équipement supplémentaire' },
];
const CLES = COLONNES_METIERS.map((c) => c.cle);

/** Cellule sans contenu (« — » affiché pour « Rien ») : triée après les autres, quel que soit le sens. */
const estVide = (texte) => /^[\s—–-]*$/u.test(String(texte ?? ''));

/** Vrai si le texte d'une cellule contient tous les mots du filtre (sans casse ni accents ; filtre vide : toujours vrai). */
export function correspond(texte, filtre) {
  const mots = normaliser(filtre).split(' ').filter(Boolean);
  if (!mots.length) return true;
  const cible = normaliser(texte);
  return mots.every((m) => cible.includes(m));
}

/**
 * Lignes visibles et dans l'ordre : `lignes` = [{ id, cellules: { nom, bonus, artisanat, caracteristiques, equipement } }] (texte affiché), `etat` = { tri, sens, filtres }.
 * Sans tri : l'ordre reçu (alphabétique). Égalité : ordre du nom.
 */
export function filtrerEtTrier(lignes, { tri = null, sens = 'asc', filtres = {} } = {}) {
  const gardees = lignes.filter((l) => CLES.every((c) => correspond(l.cellules[c] ?? '', filtres[c] ?? '')));
  if (!tri || !CLES.includes(tri)) return gardees;
  const signe = sens === 'desc' ? -1 : 1;
  const comparer = new Intl.Collator('fr', { sensitivity: 'base', numeric: true }).compare;
  return [...gardees].sort((a, b) => {
    const va = a.cellules[tri] ?? '';
    const vb = b.cellules[tri] ?? '';
    if (estVide(va) !== estVide(vb)) return estVide(va) ? 1 : -1;
    return signe * comparer(va, vb) || comparer(a.cellules.nom ?? '', b.cellules.nom ?? '');
  });
}

/** État lu dans les paramètres de l'adresse (URLSearchParams ou chaîne « ?… ») ; une valeur inconnue est ignorée. */
export function etatDepuisAdresse(recherche) {
  const p = new URLSearchParams(recherche);
  const tri = CLES.includes(p.get('tri')) ? p.get('tri') : null;
  return {
    tri,
    sens: tri && p.get('sens') === 'desc' ? 'desc' : 'asc',
    filtres: Object.fromEntries(CLES.filter((c) => p.get(c)).map((c) => [c, p.get(c)])),
  };
}

/** Paramètres d'adresse d'un état (« » s'il n'y a ni tri ni filtre) : l'inverse de etatDepuisAdresse. */
export function adresseDeEtat({ tri = null, sens = 'asc', filtres = {} }) {
  const p = new URLSearchParams();
  if (tri) {
    p.set('tri', tri);
    if (sens === 'desc') p.set('sens', 'desc');
  }
  for (const c of CLES) if (filtres[c]?.trim()) p.set(c, filtres[c].trim());
  const texte = p.toString();
  return texte ? `?${texte}` : '';
}
