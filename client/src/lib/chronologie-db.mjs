// Chargeur de la chronologie (/chronologie/, docs/chronologie.md) : les tables `evenement` et `evenement_extrait` (data/schema.sql, section 5 bis) lues
// dans la base construite au build (lib/donnees.mjs#ouvrirBase), dans l'ordre de lecture et vérifiées (lib/chronologie.mjs#ordonner).
// Sans dépendance Astro ni navigateur : la base est passée par l'appelant (pages, tests).
import { ordonner } from './chronologie.mjs';
import { normalize } from './text.mjs';

const caches = new WeakMap(); // base -> événements chargés (l'accueil et chaque page d'événement les relisent)

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));

/**
 * Les événements dans l'ordre de lecture : [{ id, rang, titre, epoque, annee, annee_fin, portee, lieu, lieu_page_id, extraits: [{ rang, page_id,
 * page_titre, section, texte, date_brut }], categories: [{ id, libelle }] }]. `lieu_page_id` : la page du Codex qui porte exactement le nom du lieu
 * (« Erisia », « Mrode »), sinon null. Un bloc de description sans lien (écrit sur le site de dev) a page_id et page_titre null. Les catégories (table
 * categorie_chronologie, migration 0042) sont triées par libellé ; aucune : « Sans catégorie (à trier) ». Une base sans table `evenement` (antérieure à la
 * migration 0035) donne une liste vide ; sans `evenement_categorie` (antérieure à 0042), aucune catégorie.
 */
export function chargerChronologie(db) {
  if (caches.has(db)) return caches.get(db);
  const existe = tableExiste(db, 'evenement');
  const evenements = existe
    ? db.prepare('SELECT id, rang, titre, epoque, annee, annee_fin, portee, lieu FROM evenement ORDER BY rang').all().map((e) => ({ ...e, extraits: [], categories: [] }))
    : [];
  if (existe) {
    const pagesDuCodex = new Map(db.prepare("SELECT titre_cle, id FROM page WHERE type = 'lore'").all().map((p) => [p.titre_cle, p.id]));
    for (const e of evenements) e.lieu_page_id = e.lieu ? (pagesDuCodex.get(normalize(e.lieu)) ?? null) : null;
    const parId = new Map(evenements.map((e) => [e.id, e]));
    const extraits = db
      .prepare(
        `SELECT x.evenement_id, x.rang, x.page_id, p.titre AS page_titre, x.section, x.texte, x.date_brut
           FROM evenement_extrait x LEFT JOIN page p ON p.id = x.page_id
          ORDER BY x.evenement_id, x.rang`,
      )
      .all();
    for (const { evenement_id: id, ...x } of extraits) parId.get(id).extraits.push({ ...x });
    if (tableExiste(db, 'evenement_categorie')) {
      const categories = db.prepare(`SELECT e.evenement_id, c.id, c.libelle FROM evenement_categorie e JOIN categorie_chronologie c ON c.id = e.categorie_id
        ORDER BY c.libelle_cle, c.id`).all();
      for (const { evenement_id: id, ...c } of categories) parId.get(id).categories.push({ ...c });
    }
  }
  const liste = ordonner(evenements);
  caches.set(db, liste);
  return liste;
}

/** Ordre d'affichage des catégories : leur libellé (sans tenir compte des accents ni de la casse), puis leur id. */
export const parLibelle = (a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id);

/**
 * Les choix du filtre de la frise (demande du propriétaire : « Le filtre sera donc sous forme de liste déroulante sur un champ catégorie ») : les catégories
 * que porte au moins un événement, triées par libellé, avec leur nombre d'événements : [{ id, libelle, nombre }] ; et le nombre d'événements sans
 * catégorie (« Sans catégorie (à trier) », proposé sur le site de dev seulement).
 */
export function choixDuFiltre(evenements) {
  const parId = new Map();
  for (const e of evenements) for (const c of e.categories ?? []) (parId.get(c.id) ?? parId.set(c.id, { ...c, nombre: 0 }).get(c.id)).nombre += 1;
  return { categories: [...parId.values()].sort(parLibelle), sansCategorie: evenements.filter((e) => !e.categories?.length).length };
}
