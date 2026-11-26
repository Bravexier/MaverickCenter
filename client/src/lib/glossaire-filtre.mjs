// Les filtres du tableau des mots-clés du Glossaire (/regles/glossaire/, src/scripts/glossaire.mjs ; décision R234 (4), réponse T4 du propriétaire : un
// filtre texte et un filtre par catégorie) : un mot-clé correspond quand le texte tapé se trouve dans son libellé, l'un de ses synonymes (R233 (1)), sa
// définition (balises lues comme leur texte) ou, sans définition écrite, le texte de son élément que la sous-ligne montre (R309), sans tenir compte de la
// casse, des accents ni de la ponctuation, et, si une catégorie est choisie (le « type » du mot-clé), quand il la porte (R232 (5)). Puis la pagination du
// tableau (R309, §9 : 50 lignes par page, `?page=` dans l'adresse) : pageDeLaListe, pageDeLAdresse, rechercheAvecPage, numerosDePage.
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

/** Le nombre de mots-clés par page du Glossaire (R309, §9). */
export const TAILLE_DE_PAGE_DU_GLOSSAIRE = 50;

/**
 * Une page d'une liste de `total` lignes coupée par `taille` : { page (ramenée dans [1, pages]), pages (au moins 1), debut (indice de la première ligne,
 * à partir de 0), fin (indice après la dernière : `slice(debut, fin)`) }. À recopier à l'identique dans lib/recherche-mots-cles.mjs (la Recherche : deux scripts de page n'importent jamais le même module ; un test compare les deux).
 */
export function pageDeLaListe(total, page, taille) {
  const t = Math.max(1, Math.floor(Number(taille)) || 1);
  const n = Math.max(0, Math.floor(Number(total)) || 0);
  const pages = Math.max(1, Math.ceil(n / t));
  const p = Math.min(pages, Math.max(1, Math.floor(Number(page)) || 1));
  return { page: p, pages, debut: Math.min(n, (p - 1) * t), fin: Math.min(n, p * t) };
}

/** La page demandée par une adresse (`search` : « ?page=2 ») : le paramètre `page`, un entier à partir de 1 ; 1 s'il manque ou n'en est pas un. À recopier comme pageDeLaListe. */
export function pageDeLAdresse(search) {
  const valeur = new URLSearchParams(String(search ?? '')).get('page');
  if (valeur === null || !/^\d+$/.test(valeur)) return 1;
  const n = Number(valeur);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

/**
 * La recherche d'une adresse (« ?q=feu&page=2 ») avec la page `page` : les autres paramètres restent tels qu'ils étaient écrits, `page` est remplacé, et
 * retiré à la page 1 ; '' sans paramètre.
 */
export function rechercheAvecPage(search, page) {
  const autres = String(search ?? '').replace(/^\?/, '').split('&').filter((x) => x && x.split('=')[0] !== 'page');
  if (page > 1) autres.push(`page=${page}`);
  return autres.length ? `?${autres.join('&')}` : '';
}

/**
 * Les numéros que montre la navigation d'une liste de `pages` pages quand `page` est affichée : la première, la dernière, la page courante et ses voisines ;
 * `null` pour un trou de deux numéros ou plus (« … »), un trou d'un seul numéro est écrit. Au plus 7 entrées.
 */
export function numerosDePage(page, pages) {
  const dernier = Math.max(1, Math.floor(Number(pages)) || 1);
  const p = Math.min(dernier, Math.max(1, Math.floor(Number(page)) || 1));
  const gardes = [...new Set([1, p - 1, p, p + 1, dernier].filter((n) => n >= 1 && n <= dernier))].sort((a, b) => a - b);
  const sortie = [];
  for (const [i, n] of gardes.entries()) {
    if (i > 0) {
      const ecart = n - gardes[i - 1];
      if (ecart === 2) sortie.push(n - 1);
      else if (ecart > 2) sortie.push(null);
    }
    sortie.push(n);
  }
  return sortie;
}

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

/**
 * Le texte où se cherche un mot-clé ({ libelle, synonymes, definition, element }), normalisé ; « | » sépare ses écritures (normaliser ne le produit pas).
 * `definition` : sa définition écrite ; `element` : le texte de son élément que la sous-ligne montre à défaut de définition (R309), balises lues comme leur
 * texte ; vide : rien. La mention d'une sous-ligne vide (« Pas encore de définition. ») n'est jamais un texte du mot-clé.
 */
export const texteDuMotCle = ({ libelle = '', synonymes = [], definition = '', element = '' } = {}) =>
  [libelle, ...(synonymes ?? []), sansBalises(definition), ...(element ? [sansBalises(element)] : [])].map(normaliser).join('|');

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
 * sans catégorie ; null : toutes) : le texte tapé se trouve dans son libellé, l'un de ses synonymes, sa définition ou le texte de son élément
 * (texteDuMotCle).
 */
export function correspond(m, requete, { categorie = null } = {}) {
  if (categorie === SANS_CATEGORIE) {
    if ((m.categories ?? []).length) return false;
  } else if (categorie !== null && !(m.categories ?? []).map(Number).includes(categorie)) return false;
  const q = normaliser(requete);
  // `recherche` : le texte déjà normalisé d'une ligne du tableau (le script de la page le calcule une fois, à la relecture du tableau)
  return !q || (m.recherche ?? texteDuMotCle(m)).includes(q);
}

/** Le compte affiché sous les filtres : « 379 mots-clés » sans filtre, « 3 sur 379 » sinon. */
export function compteDuFiltre(visibles, total, requete, { categorie = null } = {}) {
  if (!normaliser(requete) && categorie === null) return `${total} mot${total > 1 ? 's' : ''}-clé${total > 1 ? 's' : ''}`;
  return `${visibles} sur ${total}`;
}
