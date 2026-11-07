// Présentation des classes par catégorie (page /classes/ et fil d'Ariane d'une classe). Fonctions pures.
//
// La catégorie vient de l'import : le Sommaire du classeur « Classe Maverick V7 » range chaque classe sous un intitulé
// (« Classe Physique Corps à Corps », « Classe Physique Distance », « Classe Magique », « Classe Hybride Animal »,
// « Classe Hybride », « Classe spéciale »), et l'extracteur le pose en mot-clé sur la page (page_tag). On regroupe d'après ces mots-clés, reconnus
// par leur id (figé), jamais par leur écriture : un mot-clé renommé sur le site de dev ne déplace aucune classe (décision R195) ; aucune catégorie
// n'est déduite du contenu d'une classe.
//
// Les cinq catégories demandées par le propriétaire du projet, dans l'ordre des colonnes de /classes/ :
//   Physiques Mêlée     = « Classe Physique Corps à Corps »
//   Physiques Distance  = « Classe Physique Distance »
//   Magiques            = « Classe Magique »
//   Raciales            = « Classe Hybride Animal » (ces classes portent le nom d'une race)
//   Spéciales           = « Classe Hybride » (Flagelleur) et « Classe spéciale » (Archimage)
// Exception décidée par le propriétaire : le Parleur, rangé « Physique Corps à Corps » par le classeur, est présenté
// sous « Spéciales » (voir CLASS_OVERRIDES). Une classe sans catégorie reconnue n'est jamais perdue : elle va dans
// « Non classées », sous « Spéciales ».
/**
 * key = ancre HTML ; motsCles = ids des mots-clés que l'import pose (page_tag.tag_id : « càc », « distance », « magique », « hybride animal »,
 * « hybride », « spéciale » à l'import), lus dans `data.mots_cles` d'une page (lib/wiki.ts, lib/pages-db.mjs#motsClesDesPages).
 */
export const CLASS_GROUPS = [
  { key: 'melee', label: 'Physiques Mêlée', motsCles: ['cac'] },
  { key: 'distance', label: 'Physiques Distance', motsCles: ['distance'] },
  { key: 'magiques', label: 'Magiques', motsCles: ['magique'] },
  { key: 'raciales', label: 'Raciales', motsCles: ['hybride-animal'] },
  { key: 'speciales', label: 'Spéciales', motsCles: ['hybride', 'speciale'] },
];

/** Pages présentées ailleurs que dans la catégorie de leur tag : id de page -> clé de catégorie. */
export const CLASS_OVERRIDES = { 'classes/parleur': 'speciales' };

const LAST = CLASS_GROUPS.at(-1);
const UNCLASSIFIED = { key: 'non-classees', label: 'Non classées' };

const byLabel = (a, b) => a.data.title.localeCompare(b.data.title, 'fr');

// Catégorie d'une page : l'exception éventuelle, sinon la première catégorie (dans l'ordre d'affichage) dont un mot-clé (son id) figure sur la page.
function findGroup(entry) {
  const forced = CLASS_GROUPS.find((g) => g.key === CLASS_OVERRIDES[entry.id]);
  if (forced) return forced;
  return groupeDesMotsCles(entry.data?.mots_cles ?? []);
}

/** La catégorie de /classes/ que donnent des mots-clés (leurs ids, page_tag.tag_id), sans l'exception du Parleur : la première dans l'ordre d'affichage ; null sinon. */
export function groupeDesMotsCles(ids) {
  const poses = new Set(ids);
  return CLASS_GROUPS.find((group) => group.motsCles.some((id) => poses.has(id))) ?? null;
}

/**
 * Range des pages de classes dans les cinq catégories, dans l'ordre, sans catégorie vide ; chaque liste est triée par nom.
 * Une catégorie a une section (label null) ; « Spéciales » en a une seconde, « Non classées », s'il reste des classes sans catégorie.
 * @param {{ id: string, data: { title: string, mots_cles?: string[] } }[]} entries
 * @returns {{ key: string, label: string, sections: { key: string, label: string | null, entries: object[] }[] }[]}
 */
export function groupClasses(entries) {
  const buckets = new Map(CLASS_GROUPS.map((g) => [g.key, []]));
  const lost = [];
  for (const entry of entries) {
    const group = findGroup(entry);
    if (group) buckets.get(group.key).push(entry);
    else lost.push(entry);
  }

  const groups = [];
  for (const group of CLASS_GROUPS) {
    const sections = buckets.get(group.key).length ? [{ key: group.key, label: null, entries: [...buckets.get(group.key)].sort(byLabel) }] : [];
    if (group === LAST && lost.length) sections.push({ ...UNCLASSIFIED, entries: [...lost].sort(byLabel) });
    if (sections.length) groups.push({ key: group.key, label: group.label, sections });
  }
  return groups;
}

/**
 * Couleur d'une classe, d'après sa catégorie (demande du propriétaire) : rouge pour les physiques de mêlée, vert pour les physiques à distance,
 * bleu pour les magiques, violet pour les raciales (hybrides), jaune pour les spéciales (et les non classées). Repère visuel sans valeur de règle,
 * comme la couleur d'une magie ; elle suit la catégorie de /classes/, exception du Parleur comprise. La valeur est ici (la règle) ; une page n'en pose
 * que la classe (lib/palette-css.mjs, famille `classe` : `couleur-classe-melee`… ; choix du propriétaire du 2026-10-22, « Module JS → classe »).
 */
export const CLASS_COLORS = { melee: '#c62828', distance: '#2e7d32', magiques: '#1e5bb8', raciales: '#7b3fa6', speciales: '#e3b104' };

/**
 * La catégorie dont une classe prend la couleur (clé de CLASS_COLORS) : celle de /classes/, exception du Parleur comprise ; « Spéciales » pour une classe
 * non classée. Une page pose la classe de cette couleur (lib/palette-css.mjs#classeDUneClasse, famille `classe`), jamais la couleur.
 */
export const groupeDeCouleur = (entry) => findGroup(entry)?.key ?? LAST.key;

/** La couleur d'une classe (la règle, que les tests comparent) : celle de sa catégorie (groupeDeCouleur). */
export function classColor(entry) {
  return CLASS_COLORS[groupeDeCouleur(entry)];
}

/** Catégorie d'une page de classe ({ key, label }), ou null si aucune n'est reconnue. */
export function classCategory(entry) {
  const group = findGroup(entry);
  return group ? { key: group.key, label: group.label } : null;
}
