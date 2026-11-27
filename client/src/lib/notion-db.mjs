// Ce que la base sait d'une notion (décision R309 (7), docs/chantier-pages-de-notion.md §2) : le contenu du bloc `<!-- guide:notion -->`
// (components/guide/BlocNotion.astro) d'une page de notion, c'est-à-dire d'une page des Règles qui ancre un mot-clé (`page.mot_cle_id`). Calculé au build,
// jamais écrit : ni phrase de règle, ni définition inventée, seulement ce que la base porte déjà.
// Pur : la base est passée par l'appelant. Le vocabulaire est lu par `chargerVocabulaire` (en cache par base : le build rend des centaines de pages),
// jamais par `motsClesDeLaBase`, qui relirait toute la table à chaque page.

import { adresseDeLaPage, adresseDuSort, slugsDAdresse } from './adresses-db.mjs';
import { chargerVocabulaire, categoriesDesMotsCles } from './mots-cles-db.mjs';
import { definitionDuMotCle } from './mots-cles-balises.mjs';
import { TYPES } from './types.mjs';

/** La Recherche d'un mot-clé : les pages qui le citent dans leur texte (la page de notion ne refait pas cette liste). */
const rechercheDe = (cle) => `/recherche/?mot-cle=${encodeURIComponent(cle)}`;

/** Le rang d'un type de page dans `TYPES` ; un type inconnu passe après les autres. */
const rangDuType = (type) => {
  const rang = Object.keys(TYPES).indexOf(type);
  return rang === -1 ? Object.keys(TYPES).length : rang;
};

const parTexte = (a, b) => a.localeCompare(b, 'fr');

/**
 * Les sorts liés au mot-clé `motCleId` : ceux qu'il étiquette (`sort_mot_cle`) et, s'il est celui d'un type de sort (`type_sort.mot_cle_id`), ceux de ce
 * type (`sort_type`) ; un sort présent des deux côtés n'apparaît qu'une fois. Groupés par magie (par nom), les sorts dans l'ordre de leur magie
 * (`sort.ordre`), puis par nom. [{ magie: { id, nom, adresse }, sorts: [{ id, nom, adresse }] }].
 */
function sortsLies(db, motCleId, segments) {
  const lignes = db.prepare(
    `SELECT s.id, s.nom, s.ordre, s.magie_id, m.nom AS magie_nom
       FROM sort s JOIN magie m ON m.id = s.magie_id
      WHERE s.id IN (SELECT sort_id FROM sort_mot_cle WHERE mot_cle_id = ?)
         OR s.id IN (SELECT st.sort_id FROM sort_type st JOIN type_sort t ON t.id = st.type WHERE t.mot_cle_id = ?)`,
  ).all(motCleId, motCleId);
  const parMagie = new Map();
  for (const l of lignes) {
    if (!parMagie.has(l.magie_id)) parMagie.set(l.magie_id, { nom: l.magie_nom, sorts: [] });
    parMagie.get(l.magie_id).sorts.push(l);
  }
  return [...parMagie.entries()]
    .sort(([, a], [, b]) => parTexte(a.nom, b.nom))
    .map(([id, g]) => ({
      magie: { id, nom: g.nom, adresse: adresseDeLaPage(id, segments.get(id) ?? null) },
      sorts: g.sorts
        .sort((a, b) => a.ordre - b.ordre || parTexte(a.nom, b.nom))
        .map((s) => ({ id: s.id, nom: s.nom, adresse: adresseDuSort(s.id, segments.get(id) ?? null) })),
    }));
}

/**
 * Les pages qui portent le mot-clé en étiquette (`page_tag`), sans la page `pageId` elle-même ni une page d'exemple : groupées par rubrique (`page.type`,
 * dans l'ordre de lib/types.mjs#TYPES), par titre dans un groupe. [{ rubrique, pages: [{ id, titre, adresse }] }].
 */
function pagesEtiquetees(db, motCleId, pageId, segments) {
  const lignes = db.prepare(
    `SELECT p.id, p.titre, p.type FROM page p JOIN page_tag t ON t.page_id = p.id
      WHERE t.tag_id = ? AND p.id <> ? AND p.statut <> 'example'`,
  ).all(motCleId, pageId);
  const parType = new Map();
  for (const p of lignes) {
    if (!parType.has(p.type)) parType.set(p.type, []);
    parType.get(p.type).push({ id: p.id, titre: p.titre, adresse: adresseDeLaPage(p.id, segments.get(p.id) ?? null) });
  }
  return [...parType.entries()]
    .sort(([a], [b]) => rangDuType(a) - rangDuType(b) || parTexte(a, b))
    .map(([rubrique, pages]) => ({ rubrique, pages: pages.sort((a, b) => parTexte(a.titre, b.titre) || a.id.localeCompare(b.id)) }));
}

/**
 * La notion qu'ancre la page `pageId`, ou null (page inconnue, ou sans `mot_cle_id`) :
 * `{ mot_cle: { id, cle, libelle }, definition (écrite, sinon le texte de l'élément du mot-clé : lib/mots-cles-balises.mjs#definitionDuMotCle ; null
 * sans), type (le libellé de sa catégorie s'il en a exactement une, sinon null), synonymes (dans leur ordre), sorts, pages, recherche }`.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} pageId
 */
export function chargerNotion(db, pageId) {
  const motCleId = db.prepare('SELECT mot_cle_id FROM page WHERE id = ?').get(pageId)?.mot_cle_id ?? null;
  if (motCleId === null) return null;
  const m = chargerVocabulaire(db).find((v) => v.id === motCleId);
  if (!m) return null;
  const segments = slugsDAdresse(db);
  const categorie = m.categories.length === 1 ? categoriesDesMotsCles(db).find((c) => c.id === m.categories[0]) : undefined;
  return {
    mot_cle: { id: m.id, cle: m.cle, libelle: m.libelle },
    definition: definitionDuMotCle(m),
    type: categorie?.libelle ?? null,
    synonymes: [...m.synonymes],
    sorts: sortsLies(db, motCleId, segments),
    pages: pagesEtiquetees(db, motCleId, pageId, segments),
    recherche: rechercheDe(m.cle),
  };
}
