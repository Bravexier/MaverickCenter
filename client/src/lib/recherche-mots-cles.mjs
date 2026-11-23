// Les mots-clés de la page Recherche (/recherche/ ; demande du propriétaire : « En mode normal, cliquer sur un mot clé lance une recherche sur ce mot clé
// et liste les éléments qui ont ce mot clé ») : un mot-clé se désigne par sa clé dans l'adresse `?mot-cle=<clé>` (mot_cle.cle, migration 0113 ;
// décision R232 (3) : les adresses citent la clé, qui suit le libellé et les catégories, « et casse les adresses déjà partagées » ; une clé quittée
// mène encore à lui : idDeLaCle) ; ses éléments sont les pages de l'index de recherche qui le portent ou le citent (pages/search-index.json.ts,
// lib/recherche-index.ts : `motsCles` = les ids entiers de leurs étiquettes et des mots-clés que citent leurs balises du glossaire, « {{cle}} » ; un événement
// de la chronologie n'a que les seconds : ses catégories, que filtre la frise, ne sont pas des mots-clés). Depuis la migration 0056, la liste est le
// glossaire : tous les mots-clés, avec leur définition (demande du propriétaire du 2026-10-16).
// Fonctions pures, sans dépendance navigateur ni Astro : le script de /recherche/ (src/scripts/recherche.mjs, seul script de page à l'importer) et la page
// construite (le nombre de pages de chaque mot-clé : le même calcul des deux côtés).
import { cleDeRecherche, filtrerMotsCles } from './search.mjs';

/** Le nombre de pastilles par page de la Recherche (R309, §9). */
export const TAILLE_DE_PAGE_DE_LA_RECHERCHE = 100;

// Les quatre fonctions de page qui suivent sont la recopie, à l'identique, de celles de lib/glossaire-filtre.mjs (deux scripts de page n'importent jamais le
// même module : la version portable le refuse) ; test/recherche-mots-cles.test.mjs compare leur code et leurs résultats.

/**
 * Une page d'une liste de `total` lignes coupée par `taille` : { page (ramenée dans [1, pages]), pages (au moins 1), debut (indice de la première ligne,
 * à partir de 0), fin (indice après la dernière : `slice(debut, fin)`) }.
 */
export function pageDeLaListe(total, page, taille) {
  const t = Math.max(1, Math.floor(Number(taille)) || 1);
  const n = Math.max(0, Math.floor(Number(total)) || 0);
  const pages = Math.max(1, Math.ceil(n / t));
  const p = Math.min(pages, Math.max(1, Math.floor(Number(page)) || 1));
  return { page: p, pages, debut: Math.min(n, (p - 1) * t), fin: Math.min(n, p * t) };
}

/** La page demandée par une adresse (`search` : « ?page=2 ») : le paramètre `page`, un entier à partir de 1 ; 1 s'il manque ou n'en est pas un. */
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

/** Le paramètre de l'adresse qui désigne un mot-clé : /recherche/?mot-cle=<clé>. */
export const PARAMETRE_MOT_CLE = 'mot-cle';

/** La clé du mot-clé que demande l'adresse (`location.search`), ou null. */
export function motCleDeLAdresse(search) {
  const cle = new URLSearchParams(search ?? '').get(PARAMETRE_MOT_CLE)?.trim();
  return cle || null;
}

/**
 * L'id du mot-clé qu'une clé d'adresse désigne : celui dont c'est la clé, sinon celui qui l'a quittée (`anciennes_cles` : un renommage, une catégorie
 * changée, un ancien id texte d'avant la migration 0113) ; null sinon. `motsCles` : [{ id, cle, anciennes_cles? }].
 */
export function idDeLaCle(motsCles, cle) {
  if (!cle) return null;
  const liste = [...(motsCles ?? [])];
  return liste.find((m) => m.cle === cle)?.id ?? liste.find((m) => (m.anciennes_cles ?? []).includes(cle))?.id ?? null;
}

/**
 * La partie « ?… » de l'adresse avec ce mot-clé (sa clé ; null : sans mot-clé), les autres paramètres gardés ; '' quand il n'en reste aucun (l'adresse
 * de la page seule).
 */
export function adresseAvecMotCle(search, cle) {
  const parametres = new URLSearchParams(search ?? '');
  if (cle) parametres.set(PARAMETRE_MOT_CLE, cle);
  else parametres.delete(PARAMETRE_MOT_CLE);
  const texte = parametres.toString();
  return texte ? `?${texte}` : '';
}

/** Les mots-clés d'un élément de l'index (ids entiers) : ceux qu'il porte et ceux qu'il cite ; aucun pour un élément qui n'en a ni n'en cite. */
export function motsClesDeLElement(element) {
  return element.motsCles ?? [];
}

/** Le nombre d'éléments de l'index (des pages) qui portent chaque mot-clé : Map id → nombre. */
export function comptesDesMotsCles(index) {
  const comptes = new Map();
  for (const element of index) for (const id of new Set(motsClesDeLElement(element))) comptes.set(id, (comptes.get(id) ?? 0) + 1);
  return comptes;
}

/** Les pages de l'index qui portent le mot-clé `id`, dans l'ordre de l'index. */
export function elementsDuMotCle(index, id) {
  return index.filter((element) => motsClesDeLElement(element).includes(id));
}

/**
 * Ce que la page montre pour le mot-clé `id` (l'id entier, idDeLaCle) de l'adresse : `{ existe: false }` pour un id que le vocabulaire n'a pas (un
 * mot-clé supprimé ou fusionné depuis, une adresse mal écrite), sinon `{ existe: true, libelle, synonymes, definition, element, pages }` (`definition` : ''
 * tant qu'il n'est pas décrit ; `synonymes` : [] sans synonyme, R233 ; `element` : l'élément qu'il ancre, `{ nom, type, adresse?, texte? }`, ou null : décision
 * R309 §8, la vue le montre avant ses pages ; `texte` n'y est que si la définition n'est pas écrite). Son nom affiché (le libellé seul, R233 (9) ; l'icône
 * d'une monnaie) et sa définition rendue viennent de la page construite (lib/mots-cles-balises.mjs#htmlDeLaPastille, #htmlDeLaDefinition) : ce module ne
 * lit aucune monnaie.
 * @param {Map<number, string | { libelle: string, synonymes?: string[], definition?: string | null, element?: { nom: string, type: string, adresse?: string, texte?: string } | null }>} vocabulaire
 *   les mots-clés : id → libellé, ou { libelle, synonymes, definition, element } (ceux qui n'ont aucune page visible compris)
 */
export function vueDuMotCle(index, id, vocabulaire) {
  if (!vocabulaire.has(id)) return { existe: false };
  const m = vocabulaire.get(id);
  const { libelle, synonymes = [], definition, element = null } = typeof m === 'string' ? { libelle: m, definition: '' } : m;
  return { existe: true, libelle, synonymes: [...(synonymes ?? [])], definition: definition ?? '', element: element ?? null, pages: elementsDuMotCle(index, id) };
}

/**
 * Les mots-clés de la liste que la page affiche : ceux dont une écriture (le libellé ou un synonyme, R233 (1) : lib/search.mjs#cleDeRecherche) contient
 * chaque mot cherché (lib/search.mjs#filtrerMotsCles) et que porte au moins une page visible (`n`) ; `tous` : aussi ceux qu'aucune ne porte (le
 * glossaire de /recherche/, qui les montre tous depuis la migration 0056). `recherche` : la clé de recherche d'un mot-clé déjà calculée (le script de la
 * page la calcule une fois, au chargement : 1 764 mots-clés à chaque frappe sinon).
 * @param {{ libelle: string, synonymes?: string[], n: number, recherche?: string }[]} motsCles
 */
export function motsClesAffiches(motsCles, query, { tous = false } = {}) {
  const cles = motsCles.map((m) => m.recherche ?? cleDeRecherche(m));
  const gardes = new Set(filtrerMotsCles(cles, query));
  return motsCles.filter((m, i) => gardes.has(cles[i]) && (tous || m.n > 0));
}
