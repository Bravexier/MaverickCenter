// Chargeur de la chronologie (/chronologie/, docs/chronologie.md) : les tables `evenement` et `evenement_extrait` (data/schema.sql, section 5 bis) lues
// dans la base construite au build (lib/donnees.mjs#ouvrirBase), dans l'ordre de lecture et vérifiées (lib/chronologie.mjs#ordonner).
// Sans dépendance Astro ni navigateur : la base est passée par l'appelant (pages, tests).
import { ordonner } from './chronologie.mjs';
import { normalize } from './text.mjs';

const caches = new WeakMap(); // base -> événements chargés (l'accueil et chaque page d'événement les relisent)

/**
 * Les événements dans l'ordre de lecture : [{ id, rang, titre, epoque, annee, annee_fin, portee, lieu, lieu_page_id, extraits: [{ rang, page_id,
 * page_titre, section, texte, date_brut }] }]. `lieu_page_id` : la page du Codex qui porte exactement le nom du lieu (« Erisia », « Mrode »), sinon
 * null. Une base sans table `evenement` (antérieure à la migration 0035) donne une liste vide.
 */
export function chargerChronologie(db) {
  if (caches.has(db)) return caches.get(db);
  const existe = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'evenement'").get();
  const evenements = existe
    ? db.prepare('SELECT id, rang, titre, epoque, annee, annee_fin, portee, lieu FROM evenement ORDER BY rang').all().map((e) => ({ ...e, extraits: [] }))
    : [];
  if (existe) {
    const pagesDuCodex = new Map(db.prepare("SELECT titre_cle, id FROM page WHERE type = 'lore'").all().map((p) => [p.titre_cle, p.id]));
    for (const e of evenements) e.lieu_page_id = e.lieu ? (pagesDuCodex.get(normalize(e.lieu)) ?? null) : null;
    const parId = new Map(evenements.map((e) => [e.id, e]));
    const extraits = db
      .prepare(
        `SELECT x.evenement_id, x.rang, x.page_id, p.titre AS page_titre, x.section, x.texte, x.date_brut
           FROM evenement_extrait x JOIN page p ON p.id = x.page_id
          ORDER BY x.evenement_id, x.rang`,
      )
      .all();
    for (const { evenement_id: id, ...x } of extraits) parId.get(id).extraits.push({ ...x });
  }
  const liste = ordonner(evenements);
  caches.set(db, liste);
  return liste;
}
