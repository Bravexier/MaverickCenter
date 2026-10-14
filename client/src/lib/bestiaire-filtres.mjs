// Recherche, filtres et tri des tableaux de /bestiaire/ (demande du propriétaire : « Un tableau immense, avec menu de recherche et filtre. On peut
// choisir filtrer plusieurs champs »). Une ligne garde ses valeurs de filtre (`facettes` : clé -> valeurs) et de tri (`tri` : clé -> nombre ou texte),
// posées au build par lib/bestiaire-db.mjs, et son texte (`texte` : tout ce que la ligne et sa fiche affichent).
//   * Dans un même filtre, plusieurs valeurs cochées : l'une OU l'autre ; entre deux filtres (et la recherche) : l'un ET l'autre.
//   * Recherche : tous les mots, sans casse ni accents, où qu'ils soient dans le texte de la ligne.
//   * Tri : par une colonne, croissant ou décroissant ; une valeur absente va toujours à la fin ; égalité : l'ordre du doc.
// L'état tient dans l'adresse (?q=golem&categorie=boss&categorie=mini_boss&tri=sante&sens=desc), chaque tableau sous son préfixe (« i- » pour les créatures
// invoquées) : un tableau n'efface pas les paramètres de l'autre. Fonctions pures, SANS AUCUN import (le script de la page, src/scripts/bestiaire.mjs,
// est le seul à l'importer côté navigateur : la version portable refuse un module partagé entre deux scripts).

/** Texte comparable : sans accents ni casse, apostrophes droites, blancs réduits. */
export const normaliser = (texte) =>
  String(texte ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** État lu dans l'adresse ; `config` = { prefixe, facettes: [clés], tris: [clés] } ; une clé ou une valeur inconnue est ignorée. */
export function etatDepuisAdresse(recherche, { prefixe = '', facettes = [], tris = [], valeurs = {} } = {}) {
  const p = new URLSearchParams(recherche);
  const tri = tris.includes(p.get(`${prefixe}tri`)) ? p.get(`${prefixe}tri`) : null;
  const etat = { q: (p.get(`${prefixe}q`) ?? '').trim(), facettes: {}, tri, sens: tri && p.get(`${prefixe}sens`) === 'desc' ? 'desc' : 'asc' };
  for (const cle of facettes) {
    const permises = valeurs[cle];
    const choisies = [...new Set(p.getAll(`${prefixe}${cle}`))].filter((v) => v && (!permises || permises.includes(v)));
    if (choisies.length) etat.facettes[cle] = choisies;
  }
  return etat;
}

/** Paramètres d'adresse avec l'état d'un tableau (ceux de l'autre tableau, et tout paramètre étranger, sont gardés) : « ?… » ou « ». */
export function adresseAvecEtat(recherche, etat, { prefixe = '', facettes = [] } = {}) {
  const p = new URLSearchParams(recherche);
  for (const cle of ['q', 'tri', 'sens', ...facettes]) p.delete(`${prefixe}${cle}`);
  if (etat.q?.trim()) p.set(`${prefixe}q`, etat.q.trim());
  for (const cle of facettes) for (const v of etat.facettes?.[cle] ?? []) p.append(`${prefixe}${cle}`, v);
  if (etat.tri) {
    p.set(`${prefixe}tri`, etat.tri);
    if (etat.sens === 'desc') p.set(`${prefixe}sens`, 'desc');
  }
  const texte = p.toString();
  return texte ? `?${texte}` : '';
}

/**
 * Les cases d'une ligne gardée que la recherche désigne (une combinaison de magies a deux créatures : celle que la recherche ne trouve pas est estompée,
 * et n'est pas comptée) : celles dont le texte (`texteNormalise` : la case et sa carte) contient tous les mots ; si aucune ne les contient seule (les mots
 * sont dans l'en-tête de la ligne, la combinaison, ou répartis entre les deux), toutes. Sans recherche : toutes.
 */
export function casesTrouvees(ligne, etat) {
  const mots = normaliser(etat.q).split(' ').filter(Boolean);
  if (!mots.length) return ligne.cases;
  const trouvees = ligne.cases.filter((c) => mots.every((m) => (c.texteNormalise ?? normaliser(c.texte)).includes(m)));
  return trouvees.length ? trouvees : ligne.cases;
}

/** Vrai si la ligne passe la recherche et tous les filtres, sauf celui de clé `sauf` (pour compter les options d'un filtre). */
export function garder(ligne, etat, sauf = null) {
  for (const [cle, choisies] of Object.entries(etat.facettes ?? {})) {
    if (cle === sauf || !choisies?.length) continue;
    const siennes = ligne.facettes?.[cle] ?? [];
    if (!choisies.some((v) => siennes.includes(v))) return false;
  }
  const mots = normaliser(etat.q).split(' ').filter(Boolean);
  if (!mots.length) return true;
  const texte = ligne.texteNormalise ?? normaliser(ligne.texte);
  return mots.every((m) => texte.includes(m));
}

const vide = (v) => v === null || v === undefined || v === '';
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Compare deux valeurs de tri (nombres entre eux, textes entre eux ; un nombre avant un texte). */
export function comparer(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return collator.compare(String(a), String(b));
}

/** Lignes visibles, dans l'ordre : `lignes` = [{ ordre, facettes, tri, texte }], dans l'ordre du doc (`ordre`). */
export function filtrerEtTrier(lignes, etat) {
  const gardees = lignes.filter((l) => garder(l, etat));
  if (!etat.tri) return gardees;
  const signe = etat.sens === 'desc' ? -1 : 1;
  return [...gardees].sort((a, b) => {
    const va = a.tri?.[etat.tri];
    const vb = b.tri?.[etat.tri];
    if (vide(va) !== vide(vb)) return vide(va) ? 1 : -1;
    return (vide(va) ? 0 : signe * comparer(va, vb)) || (a.ordre ?? 0) - (b.ordre ?? 0);
  });
}

/** Effectif de chaque valeur d'un filtre parmi les lignes qui passent la recherche et les AUTRES filtres : Map(valeur -> nombre). */
export function effectifs(lignes, etat, cle) {
  const compte = new Map();
  for (const l of lignes) {
    if (!garder(l, etat, cle)) continue;
    // une ligne à cases compte pour celles que la recherche trouve (casesTrouvees), comme le compte de la page
    const poids = l.cases ? casesTrouvees(l, etat).length : 1;
    for (const v of new Set(l.facettes?.[cle] ?? [])) compte.set(v, (compte.get(v) ?? 0) + poids);
  }
  return compte;
}

/** Ajoute ou retire une valeur d'un filtre (nouvel état). */
export function basculer(etat, cle, valeur, coche) {
  const avant = etat.facettes?.[cle] ?? [];
  const apres = coche ? [...new Set([...avant, valeur])] : avant.filter((v) => v !== valeur);
  const facettes = { ...etat.facettes, [cle]: apres };
  if (!apres.length) delete facettes[cle];
  return { ...etat, facettes };
}

/** Tri suivant après un clic sur l'en-tête `cle` : croissant, puis décroissant, puis l'ordre du doc. */
export function triSuivant(etat, cle) {
  if (etat.tri !== cle) return { ...etat, tri: cle, sens: 'asc' };
  if (etat.sens === 'asc') return { ...etat, sens: 'desc' };
  return { ...etat, tri: null, sens: 'asc' };
}

// ---- Défilement de la vue (le tableau et la carte, côte à côte ; demande du propriétaire : « corriger le fait de ne pas avoir de scroll bar, que ce soit
// pour le tableau ou la tuile », qui « reste toujours affichée à l'écran ») : la carte tient dans la partie visible de sa vue, et la molette fait d'abord
// défiler la page jusqu'à ce que la vue soit calée en haut de l'écran (ensuite, le tableau ou la carte défilent dans leur cadre).

/** Hauteur de la partie visible d'une vue (haut et bas à l'écran) dans une fenêtre de hauteur `h`, à `marge` des bords ; au moins `plancher`. */
export const hauteurVisible = (haut, bas, h, marge = 12, plancher = 160) => Math.max(Math.round(Math.min(bas, h - marge) - Math.max(haut, marge)), plancher);

/** La molette (`dy`, en pixels) sur une vue dont le haut est à `haut` : ce que la page défile d'abord pour la caler à `marge` du haut de l'écran,
 *  sans dépasser `reste`, ce que la page peut encore défiler dans ce sens (0 : la vue est calée, ou la page est au bout : son cadre défile). */
export const defilementDAbord = (haut, dy, reste = Infinity, marge = 12) => {
  const r = Math.max(0, Math.floor(reste));
  if (dy > 0 && haut > marge + 1) return Math.min(dy, haut - marge, r);
  if (dy < 0 && haut < marge - 1) return Math.max(dy, haut - marge, -r) || 0;
  return 0;
};

// ---- Échelle de puissance d'une carte (curseur de la carte d'un monstre qui en a plusieurs : lib/monstre-rendu.mjs#htmlDeLEchelle)

/** L'échelle montrée à l'ouverture d'une carte (`echelles` : celles qu'elle écrit) : la plus petite des échelles cochées dans le filtre EP (« 5 », texte de
 *  l'adresse) que la carte écrit, sinon la première qu'elle écrit. */
export function echelleParDefaut(echelles, cochees = []) {
  const siennes = (cochees ?? []).map(Number).filter((n) => echelles.includes(n));
  return siennes.length ? Math.min(...siennes) : echelles[0];
}
