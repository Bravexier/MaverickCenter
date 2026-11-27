// Les adresses du site lues dans la base : où une adresse de mot-clé (mot_cle.url, migration 0098 : lib/mots-cles-liens.mjs) peut mener, et la page
// à laquelle elle mène. Une adresse est relative à la racine du site, sans le préfixe de déploiement, avec la barre finale (« /races/elfe/ »).
//   - adressesDuSite : le chemin (sans ancre) de chaque page qui n'est pas d'exemple (lib/metiers.mjs#cheminDePage : un métier mène à /metiers/, une
//     page de l'équipement à la page qui la sert, une page du guide à son adresse dans le plan), la rubrique de chaque type de page (« /magies/ » :
//     pages/[type]/index.astro) et les routes fixes du site (ADRESSES_FIXES) ;
//   - indexDesAdresses / pageDeLAdresse : la page à laquelle mène une adresse — celle dont l'adresse est la même (ancre comprise : « /metiers/#metier-
//     mineur »), sinon celle dont l'adresse sans ancre est le chemin (« /races/elfe/#peuples » → races/elfe) ; null pour une rubrique ou une route
//     sans page (« /fiche/ »).
//   - slugsDAdresse, anciennesAdresses, pageDeLAncienneAdresse : les segments renommés et les anciennes adresses des pages (R316 : page.slug_adresse,
//     page_ancienne_adresse, migration 0133) ; vides sur une base d'avant la migration.
// L'adresse d'une page dont la base a renommé le segment se lit toujours ici dans la base (adresseDeLaPageEnBase, adresseDuSortEnBase, adressesDuSite,
// indexDesAdresses), jamais dans l'état installé (lib/adresses-renommees.mjs : le build et le navigateur) : le service n'installe rien.
// Pur, sans dépendance navigateur ni Astro : la base est passée par l'appelant (le service, db:check, db-derive, les tests).
import { cheminDePage } from './metiers.mjs';
import { cheminDeLAdresse, decouperLAdresse } from './mots-cles-liens.mjs';

/**
 * Les routes fixes du site (fichiers de src/pages hors des pages tirées de la base : test/adresses-db.test.mjs les compare au dossier), où un mot-clé
 * peut mener : l'accueil, la fiche, les rubriques et pages à part. Les pages du site de dev seulement (Debug, Maintenance, Mise à jour) et les pages du compte (Connexion, Profil : R310) n'y sont pas.
 * « /regles/glossaire/ » : la page du Glossaire, que les refus du service citent (créée par le même lot, côté pages).
 */
export const ADRESSES_FIXES = Object.freeze([
  '/',
  '/archives/',
  '/bestiaire/',
  '/chronologie/',
  '/classes/',
  '/confidentialite/',
  '/donnees/',
  '/fiche/',
  '/galeries/',
  '/magies/',
  '/metiers/',
  '/mj/',
  '/pages/',
  '/personnages/',
  '/races/',
  '/recherche/',
  '/regles/',
  '/regles/artisanat/',
  '/regles/glossaire/',
  '/ressources/accessoires/',
  '/ressources/armes/',
  '/ressources/armures/',
  '/ressources/bouclier/',
  '/ressources/composants/',
  '/ressources/objets-a-la-ceinture/',
]);

/** L'adresse de la page du Glossaire (que les refus du service citent). */
export const ADRESSE_DU_GLOSSAIRE = '/regles/glossaire/';

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
/** Vrai si la base a la colonne page.slug_adresse (migration 0133). */
const aDesSegments = (db) => Boolean(db.prepare("SELECT 1 FROM pragma_table_info('page') WHERE name = 'slug_adresse'").get());
/** Les colonnes lues d'une page : son id et son segment renommé (null avant la migration 0133). */
const colonnesDeLaPage = (db) => (aDesSegments(db) ? 'id, slug_adresse' : 'id, NULL AS slug_adresse');

/**
 * L'adresse d'une page (« /metiers/#metier-mineur », « /races/elfe/ ») : cheminDePage, depuis la racine du site. `slug` : son segment renommé lu en
 * base (R316 ; null : aucun) ; sans lui, l'état installé (vide dans le service).
 */
export const adresseDeLaPage = (id, slug) => `/${cheminDePage(id, slug)}`;

/** Le segment renommé de la page `id` lu en base (page.slug_adresse), ou null. */
const segmentEnBase = (db, id) => (aDesSegments(db) ? (db.prepare('SELECT slug_adresse FROM page WHERE id = ?').get(id)?.slug_adresse ?? null) : null);

/** L'adresse d'aujourd'hui de la page `id`, son segment lu dans la base vivante (R316), jamais dans l'état installé. */
export const adresseDeLaPageEnBase = (db, id) => adresseDeLaPage(id, segmentEnBase(db, id));

/**
 * L'adresse d'un sort (`<magie.id>#sort:<slug>`, gelé) : la page de sa magie, à l'ancre de sa ligne (`lib/magies.ts#sortAncre`). `slugDeLaMagie` : le
 * segment renommé de la page de la magie (R316), comme le `slug` d'adresseDeLaPage.
 */
export function adresseDuSort(sortId, slugDeLaMagie) {
  const [magieId, slug] = String(sortId).split('#sort:');
  return `${adresseDeLaPage(magieId, slugDeLaMagie)}#sort-${slug}`;
}

/** L'adresse d'un sort, le segment de sa magie lu dans la base vivante (R316). */
export const adresseDuSortEnBase = (db, sortId) => adresseDuSort(sortId, segmentEnBase(db, String(sortId).split('#sort:')[0]));

/** Les segments renommés de la base (R316) : Map(id → page.slug_adresse), vide avant la migration 0133. Ce que le build installe. */
export function slugsDAdresse(db) {
  if (!aDesSegments(db)) return new Map();
  return new Map(db.prepare('SELECT id, slug_adresse FROM page WHERE slug_adresse IS NOT NULL ORDER BY id').all().map((p) => [p.id, p.slug_adresse]));
}

/** Les anciennes adresses des pages renommées (R316) : [{ adresse, page_id }] de page_ancienne_adresse, relatives à la racine du site, sans barre initiale. */
export function anciennesAdresses(db) {
  if (!tableExiste(db, 'page_ancienne_adresse')) return [];
  return db.prepare('SELECT adresse, page_id FROM page_ancienne_adresse ORDER BY adresse').all().map((a) => ({ adresse: a.adresse, page_id: a.page_id }));
}

/**
 * La page dont `adresse` est une ancienne adresse (page_ancienne_adresse, R316), ou null : la même adresse, ancre comprise (« metiers/#metier-forgeron »),
 * sinon son chemin ; barre initiale, requête et barre finale ne comptent pas.
 */
export function pageDeLAncienneAdresse(db, adresse) {
  if (typeof adresse !== 'string' || !tableExiste(db, 'page_ancienne_adresse')) return null;
  const chemin = cheminDeLAdresse(adresse).slice(1);
  if (!chemin) return null;
  const { ancre } = decouperLAdresse(adresse);
  const lire = db.prepare('SELECT page_id FROM page_ancienne_adresse WHERE adresse = ?');
  return (ancre ? lire.get(`${chemin}#${ancre}`) : undefined)?.page_id ?? lire.get(chemin)?.page_id ?? null;
}

/**
 * L'adresse que prend un lien `url` (forme de `mot_cle.url`) quand la page qu'il vise passe de `quittee` à `adresse` (R316), ou null s'il ne la vise pas : une
 * adresse à ancre (un métier) se compare entière ; sinon le chemin complété comme pour trouver la page (cheminDeLAdresse : barres initiale et finale ; un lien
 * peut mener à une section de la page), la requête et l'ancre gardées. La règle du renommage (serveur/edition-adresses.mjs), de l'annulation d'une de ses
 * lignes (serveur/edition-lots.mjs#lignesEmportees) et de la note de version (lib/notes-de-version.mjs).
 */
export function adresseQuiSuit(url, { quittee, adresse }) {
  if (typeof url !== 'string') return null;
  if (decouperLAdresse(quittee).ancre) return url === quittee ? adresse : null;
  return cheminDeLAdresse(url) === quittee ? `${adresse}${url.slice(decouperLAdresse(url).chemin.length)}` : null;
}

/**
 * Les adresses du site (un Set de chemins, sans ancre ni requête) : chaque page qui n'est pas d'exemple (à son segment lu en base, R316), chaque
 * rubrique (`type_page`) et ADRESSES_FIXES.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function adressesDuSite(db) {
  const adresses = new Set(ADRESSES_FIXES);
  if (tableExiste(db, 'page')) {
    for (const p of db.prepare(`SELECT ${colonnesDeLaPage(db)} FROM page WHERE statut <> 'example'`).all()) {
      adresses.add(cheminDeLAdresse(adresseDeLaPage(p.id, p.slug_adresse)));
    }
  }
  if (tableExiste(db, 'type_page')) for (const t of db.prepare('SELECT id FROM type_page').all()) adresses.add(`/${t.id}/`);
  return adresses;
}

/**
 * L'index des pages par adresse : { exactes: Map(adresse avec ancre → id), chemins: Map(chemin → id, pages dont l'adresse n'a pas d'ancre) } ; les
 * pages d'exemple n'y sont pas (sauf `exemples`). Une page est à l'adresse de son segment lu en base (R316). `enPlus` : des ids de pages qui ne sont
 * plus dans la base (une page qu'un lot rejoué vient de supprimer : lib/citations-db.mjs, option `absentes`), indexées après celles de la base, à
 * l'adresse tirée de leur id (une page de la base garde la sienne).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ exemples?: boolean, enPlus?: Iterable<string> }} [options]
 */
export function indexDesAdresses(db, { exemples = false, enPlus = [] } = {}) {
  const exactes = new Map();
  const chemins = new Map();
  const indexer = (id, slug) => {
    const adresse = adresseDeLaPage(id, slug);
    if (!exactes.has(adresse)) exactes.set(adresse, id);
    if (!decouperLAdresse(adresse).ancre && !chemins.has(adresse)) chemins.set(adresse, id);
  };
  if (tableExiste(db, 'page')) {
    const pages = db.prepare(`SELECT ${colonnesDeLaPage(db)} FROM page${exemples ? '' : " WHERE statut <> 'example'"} ORDER BY id`).all();
    for (const p of pages) indexer(p.id, p.slug_adresse);
  }
  for (const id of enPlus) indexer(id, null);
  return { exactes, chemins };
}

/**
 * L'id de la page à laquelle mène `adresse` (une adresse de mot-clé), ou null (une rubrique, une route sans page, une adresse inconnue) : la page de
 * même adresse (requête ignorée, ancre comprise), sinon celle dont l'adresse est le chemin de `adresse`. `index` : indexDesAdresses.
 */
export function pageDeLAdresse(index, adresse) {
  if (typeof adresse !== 'string' || !adresse) return null;
  const { chemin, ancre } = decouperLAdresse(adresse);
  const normal = cheminDeLAdresse(chemin);
  if (!normal) return null;
  return index.exactes.get(ancre ? `${normal}#${ancre}` : normal) ?? index.chemins.get(normal) ?? null;
}
