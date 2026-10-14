// Les mots-clés de la page Recherche (/recherche/ ; demande du propriétaire : « En mode normal, cliquer sur un mot clé lance une recherche sur ce mot clé
// et liste les éléments qui ont ce mot clé ») : un mot-clé se désigne par son id (mot_cle.id, figé : un renommage ne change pas son adresse), dans
// l'adresse `?mot-cle=<id>` ; ses éléments sont les pages de l'index de recherche qui le portent (pages/search-index.json.ts, lib/recherche-index.ts :
// `motsCles` = les ids de leurs mots-clés). Les événements de la chronologie n'ont pas de mot-clé (`motsCles` vide) : ils ont des catégories, que filtre la
// frise (lib/chronologie.mjs), et n'entrent jamais dans la vue d'un mot-clé.
// Fonctions pures, sans dépendance navigateur ni Astro : le script de /recherche/ (src/scripts/recherche.mjs, seul script de page à l'importer) et la page
// construite (le nombre de pages de chaque mot-clé : le même calcul des deux côtés).
import { filtrerMotsCles } from './search.mjs';

/** Le paramètre de l'adresse qui désigne un mot-clé : /recherche/?mot-cle=<id>. */
export const PARAMETRE_MOT_CLE = 'mot-cle';

/** L'id du mot-clé que demande l'adresse (`location.search`), ou null. */
export function motCleDeLAdresse(search) {
  const id = new URLSearchParams(search ?? '').get(PARAMETRE_MOT_CLE)?.trim();
  return id || null;
}

/**
 * La partie « ?… » de l'adresse avec ce mot-clé (`id` null : sans mot-clé), les autres paramètres gardés ; '' quand il n'en reste aucun (l'adresse de la
 * page seule).
 */
export function adresseAvecMotCle(search, id) {
  const parametres = new URLSearchParams(search ?? '');
  if (id) parametres.set(PARAMETRE_MOT_CLE, id);
  else parametres.delete(PARAMETRE_MOT_CLE);
  const texte = parametres.toString();
  return texte ? `?${texte}` : '';
}

/** Les mots-clés d'un élément de l'index (ids) ; aucun pour un événement de la chronologie (il a des catégories) ou une page sans mot-clé. */
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
 * Ce que la page montre pour le mot-clé `id` de l'adresse : `{ existe: false }` pour un id que le vocabulaire n'a pas (un mot-clé supprimé ou fusionné
 * depuis, une adresse mal écrite), sinon `{ existe: true, libelle, pages }`.
 * @param {Map<string, string>} libelles les mots-clés du vocabulaire : id → libellé (ceux qui n'ont aucune page visible compris)
 */
export function vueDuMotCle(index, id, libelles) {
  if (!libelles.has(id)) return { existe: false };
  return { existe: true, libelle: libelles.get(id), pages: elementsDuMotCle(index, id) };
}

/**
 * Les mots-clés de la liste que la page affiche : ceux dont l'écriture (`cle` : normalize du libellé, jamais l'id) contient chaque mot cherché
 * (lib/search.mjs#filtrerMotsCles) et que porte au moins une page visible (`n`) ; `tous` : aussi ceux qu'aucune ne porte (mode modification).
 * @param {{ cle: string, n: number }[]} motsCles
 */
export function motsClesAffiches(motsCles, query, { tous = false } = {}) {
  const gardes = new Set(filtrerMotsCles(motsCles.map((m) => m.cle), query));
  return motsCles.filter((m) => gardes.has(m.cle) && (tous || m.n > 0));
}
