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
 * mot-clé supprimé ou fusionné depuis, une adresse mal écrite), sinon `{ existe: true, libelle, synonymes, definition, pages }` (`definition` : ''
 * tant qu'il n'est pas décrit ; `synonymes` : [] sans synonyme, R233). Son nom affiché (le libellé seul, R233 (9) ; l'icône d'une monnaie) et sa
 * définition rendue viennent de la page construite (lib/mots-cles-balises.mjs#htmlDeLaPastille, #htmlDeLaDefinition) : ce module ne lit aucune monnaie.
 * @param {Map<number, string | { libelle: string, synonymes?: string[], definition?: string | null }>} vocabulaire les mots-clés : id → libellé,
 *   ou { libelle, synonymes, definition } (ceux qui n'ont aucune page visible compris)
 */
export function vueDuMotCle(index, id, vocabulaire) {
  if (!vocabulaire.has(id)) return { existe: false };
  const m = vocabulaire.get(id);
  const { libelle, synonymes = [], definition } = typeof m === 'string' ? { libelle: m, definition: '' } : m;
  return { existe: true, libelle, synonymes: [...(synonymes ?? [])], definition: definition ?? '', pages: elementsDuMotCle(index, id) };
}

/**
 * Les mots-clés de la liste que la page affiche : ceux dont une écriture (le libellé ou un synonyme, R233 (1) : lib/search.mjs#cleDeRecherche) contient
 * chaque mot cherché (lib/search.mjs#filtrerMotsCles) et que porte au moins une page visible (`n`) ; `tous` : aussi ceux qu'aucune ne porte (le
 * glossaire de /recherche/, qui les montre tous depuis la migration 0056).
 * @param {{ libelle: string, synonymes?: string[], n: number }[]} motsCles
 */
export function motsClesAffiches(motsCles, query, { tous = false } = {}) {
  const gardes = new Set(filtrerMotsCles(motsCles.map(cleDeRecherche), query));
  return motsCles.filter((m) => gardes.has(cleDeRecherche(m)) && (tous || m.n > 0));
}
