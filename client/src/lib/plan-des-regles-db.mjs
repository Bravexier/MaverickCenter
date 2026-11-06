// Le plan des onglets de la rubrique Règles (migration 0091, décisions R184 et R185) : « Fiche de personnage », « Mécaniques générales », « Les combats »,
// « Exploration », après Découvrir et L'univers (que le site écrit lui-même), chacun avec son menu latéral. Le plan est une donnée de la base (tables
// regles_onglet et regles_onglet_entree, section 1 de data/schema.sql), lue ici et passée à lib/livres.mjs, qui reste sans import et range les pages
// d'après lui. Pas encore modifiable sur le site de dev (hors de lib/edition-modele.mjs#TABLES) ; en lecture à /api/v1/onglets-des-regles/.
// Une entrée de page ne porte que l'id de la page : son libellé est le titre de la page, que l'appelant a déjà par les entrées du wiki (une page
// renommée sur le site de dev change donc son entrée sans toucher au plan).
// Pur, sans dépendance : la base est passée par l'appelant (lib/donnees.mjs#ouvrirBase au build, en lecture seule ; la base vivante pour le service).

/** Vrai si la base a les tables du plan (une base d'avant la migration 0091 ne les a pas). */
const aLePlan = (db) =>
  db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('regles_onglet', 'regles_onglet_entree')").get().n === 2;

/**
 * Une ligne de regles_onglet_entree dans la forme du plan : `{ page }` (l'id d'une page `guide/…`), `{ libelle, adresse }` (un lien vers une adresse du
 * site, relative à sa racine, sans la base ni la barre initiale : « regles/artisanat/ ») ou `{ bientot }` (le libellé d'une entrée grisée « bientôt »).
 * La table n'admet que ces trois formes (ses CHECK) : une ligne qui n'en serait aucune arrête la lecture.
 */
export function entreeDuPlan({ id, page_id: page, libelle, adresse }) {
  if (page !== null) return Object.freeze({ page });
  if (adresse !== null) return Object.freeze({ libelle, adresse });
  if (String(id).startsWith('bientot:')) return Object.freeze({ bientot: libelle });
  throw new Error(`[plan des règles] entrée illisible : ${id}`);
}

/**
 * Le plan des Règles : les onglets dans l'ordre (`ordre`, puis l'id à égalité), chacun
 * `{ id, titre, ouverture, entrees }` — `ouverture` : l'id de la page montrée à l'adresse de l'onglet ; `entrees` : son menu latéral dans l'ordre
 * (`rang`, puis l'id à égalité), chacune au format d'entreeDuPlan. Tout est gelé. [] pour une base d'avant la migration 0091.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function chargerPlanDesRegles(db) {
  if (!aLePlan(db)) return [];
  const entrees = db.prepare('SELECT id, page_id, libelle, adresse FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id');
  return Object.freeze(db.prepare('SELECT id, titre, ouverture_page_id FROM regles_onglet ORDER BY ordre, id').all().map((o) => Object.freeze({
    id: o.id,
    titre: o.titre,
    ouverture: o.ouverture_page_id,
    entrees: Object.freeze(entrees.all(o.id).map(entreeDuPlan)),
  })));
}
