// Les filtres du tableau des mots-clés du Glossaire (/regles/glossaire/, src/scripts/glossaire.mjs ; décision R234 (4), réponse T4 du propriétaire : un
// filtre texte et un filtre par catégorie) : un mot-clé correspond quand le texte tapé se trouve dans son libellé, l'un de ses synonymes (R233 (1)) ou sa
// définition (balises lues comme leur texte), sans tenir compte de la casse, des accents ni de la ponctuation, et, si une catégorie est choisie, quand il
// la porte (R232 (5)).
// Sans aucun import : le script de la page l'importe seul (skill site-version-portable : deux scripts de page n'importent jamais le même module) ;
// `normaliser` est la règle de lib/text.mjs#normalize, recopiée (test/glossaire-filtre.test.mjs les compare).

/** Clé de comparaison : minuscules, sans accents, sans apostrophes, tirets pour le reste (lib/text.mjs#normalize). */
export function normaliser(valeur) {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Un texte dont les balises du glossaire (« {{cle}} », « {{cle|texte}} », « {{cle:}} ») sont lues comme leur texte écrit, sinon leur ref. */
export const sansBalises = (texte) => String(texte ?? '')
  .replace(/\{\{([^{}|\n]+?)(?:\\?\|([^{}\n]*?))?\}\}/g, (_, ref, ecrit) => (ecrit?.trim() || ref.trim().replace(/\s*:$/, '')));

/** Une liste lue dans un attribut JSON (data-synonymes, data-categories) ; [] s'il est absent ou illisible. */
const listeJson = (valeur) => {
  if (typeof valeur !== 'string' || !valeur) return [];
  try {
    const v = JSON.parse(valeur);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

/**
 * Le mot-clé que décrit une ligne du tableau (`dataset` du `<tbody>` : lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire) : { libelle, synonymes,
 * definition, categories (ids entiers) }.
 */
export const motCleDeLaLigne = (dataset = {}) => ({
  libelle: dataset.libelle ?? '',
  synonymes: listeJson(dataset.synonymes).filter((s) => typeof s === 'string'),
  definition: dataset.definition ?? '',
  categories: listeJson(dataset.categories).map(Number).filter(Number.isInteger),
});

/** Le texte où se cherche un mot-clé ({ libelle, synonymes, definition }), normalisé ; « | » sépare ses écritures (normaliser ne le produit pas). */
export const texteDuMotCle = ({ libelle = '', synonymes = [], definition = '' } = {}) =>
  [libelle, ...(synonymes ?? []), sansBalises(definition)].map(normaliser).join('|');

/** La valeur de l'option « Sans catégorie » du filtre (R234 (4), réponse du propriétaire : les mots-clés à classer). */
export const SANS_CATEGORIE = 'sans';

/** La catégorie choisie dans le filtre (la valeur de la liste : '' pour toutes), en id entier ; SANS_CATEGORIE ; null : toutes. */
export function categorieChoisie(valeur) {
  const v = String(valeur ?? '').trim();
  if (v === SANS_CATEGORIE) return SANS_CATEGORIE;
  return /^\d+$/.test(v) ? Number(v) : null;
}

/**
 * Vrai si le mot-clé `m` correspond à la saisie `requete` (une saisie vide : tous) et à la catégorie `categorie` (un id ; SANS_CATEGORIE : un mot-clé
 * sans catégorie ; null : toutes) : le texte
 * tapé se trouve dans son libellé, l'un de ses synonymes ou sa définition.
 */
export function correspond(m, requete, { categorie = null } = {}) {
  if (categorie === SANS_CATEGORIE) {
    if ((m.categories ?? []).length) return false;
  } else if (categorie !== null && !(m.categories ?? []).map(Number).includes(categorie)) return false;
  const q = normaliser(requete);
  return !q || texteDuMotCle(m).includes(q);
}

/** Le compte affiché sous les filtres : « 379 mots-clés » sans filtre, « 3 sur 379 » sinon. */
export function compteDuFiltre(visibles, total, requete, { categorie = null } = {}) {
  if (!normaliser(requete) && categorie === null) return `${total} mot${total > 1 ? 's' : ''}-clé${total > 1 ? 's' : ''}`;
  return `${visibles} sur ${total}`;
}
