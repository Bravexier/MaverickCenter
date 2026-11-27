// Les segments d'adresse renommés (décision R316, « l'adresse d'une page suit son titre » ; colonne page.slug_adresse, migration 0133), installés une fois
// par celui qui charge les pages : le build (lib/wiki.ts, astro.config.mjs) et la chaîne de l'édition du navigateur. lib/metiers.mjs et lib/livres.mjs
// les lisent quand on ne leur donne pas le segment (second argument `undefined`). Le service ne les installe jamais : il passe à chaque fois le segment
// lu dans la base vivante (`null` : pas de segment renommé ; lib/adresses-db.mjs#adresseDeLaPageEnBase). Deux lectures, jamais mêlées.
// Sans aucun import : lib/livres.mjs, qui entre dans la chaîne de l'édition du navigateur, l'importe.

/** id → segment renommé. */
let segments = new Map();
/** `<type>/<segment>` → id (l'inverse, par type de page : « guide » pour une page du guide). */
let pages = new Map();

/** Le type d'un id (« guide » de « guide/x ») ; un id sans « / » est son propre type, jamais tronqué de sa dernière lettre. */
const typeDe = (id) => {
  const i = id.indexOf('/');
  return i < 0 ? id : id.slice(0, i);
};

/** Remplace l'état installé par `paires` ([id, segment], lib/adresses-db.mjs#slugsDAdresse) ; rend le nombre de paires installées. */
export function installerLesAdresses(paires) {
  const parId = new Map();
  const parSegment = new Map();
  for (const [id, segment] of paires) {
    parId.set(id, segment);
    parSegment.set(`${typeDe(id)}/${segment}`, id);
  }
  segments = parId;
  pages = parSegment;
  return parId.size;
}

/**
 * Les segments renommés installés en JSON `{ "<id>": "<segment>" }`, que layouts/Base.astro pose dans chaque page (`#adresses-renommees`) pour les scripts du
 * navigateur ; null quand aucune page n'est renommée (la page n'écrit alors rien). Le « < » est écrit `<` : le JSON entre dans du HTML, `</script>` ne le ferme pas.
 */
export function jsonDesAdressesRenommees() {
  if (segments.size === 0) return null;
  return JSON.stringify(Object.fromEntries(segments)).replaceAll('<', '\\u003c');
}

/**
 * Installe l'état que la page porte (`#adresses-renommees`, jsonDesAdressesRenommees) : le contenu de la balise, `undefined` quand elle est absente (aucune page
 * n'est renommée). Un contenu absent, illisible ou qui n'est pas un objet { id: segment } installe un état vide. Rend le nombre de segments installés.
 */
export function installerLesAdressesDeLaPage(texte) {
  let objet = null;
  try {
    objet = JSON.parse(texte ?? 'null');
  } catch {
    objet = null;
  }
  const paires = objet && typeof objet === 'object' && !Array.isArray(objet)
    ? Object.entries(objet).filter(([id, segment]) => id.includes('/') && typeof segment === 'string' && segment)
    : [];
  return installerLesAdresses(paires);
}

/** Le segment renommé installé de la page `id`, ou null. */
export const slugRenomme = (id) => segments.get(id) ?? null;

/** La page de type `type` dont le segment renommé installé est `slug` (« guide » pour une page du guide), ou null. */
export const pageAuSlug = (type, slug) => pages.get(`${type}/${slug}`) ?? null;
