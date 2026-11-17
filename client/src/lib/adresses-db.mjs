// Les adresses du site lues dans la base : où une adresse de mot-clé (mot_cle.url, migration 0098 : lib/mots-cles-liens.mjs) peut mener, et la page
// à laquelle elle mène. Une adresse est relative à la racine du site, sans le préfixe de déploiement, avec la barre finale (« /races/elfe/ »).
//   - adressesDuSite : le chemin (sans ancre) de chaque page qui n'est pas d'exemple (lib/metiers.mjs#cheminDePage : un métier mène à /metiers/, une
//     page de l'équipement à la page qui la sert, une page du guide à son adresse dans le plan), la rubrique de chaque type de page (« /magies/ » :
//     pages/[type]/index.astro) et les routes fixes du site (ADRESSES_FIXES) ;
//   - indexDesAdresses / pageDeLAdresse : la page à laquelle mène une adresse — celle dont l'adresse est la même (ancre comprise : « /metiers/#metier-
//     mineur »), sinon celle dont l'adresse sans ancre est le chemin (« /races/elfe/#peuples » → races/elfe) ; null pour une rubrique ou une route
//     sans page (« /fiche/ »).
// Pur, sans dépendance navigateur ni Astro : la base est passée par l'appelant (le service, db:check, db-derive, les tests).
import { cheminDePage } from './metiers.mjs';
import { cheminDeLAdresse, decouperLAdresse } from './mots-cles-liens.mjs';

/**
 * Les routes fixes du site (fichiers de src/pages hors des pages tirées de la base : test/adresses-db.test.mjs les compare au dossier), où un mot-clé
 * peut mener : l'accueil, la fiche, les rubriques et pages à part. Les pages du site de dev seulement (Debug, Maintenance, Mise à jour) n'y sont pas.
 * « /regles/glossaire/ » : la page du Glossaire, que les refus du service citent (créée par le même lot, côté pages).
 */
export const ADRESSES_FIXES = Object.freeze([
  '/',
  '/archives/',
  '/bestiaire/',
  '/chronologie/',
  '/classes/',
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

/** L'adresse d'une page (« /metiers/#metier-mineur », « /races/elfe/ ») : cheminDePage, depuis la racine du site. */
export const adresseDeLaPage = (id) => `/${cheminDePage(id)}`;

/**
 * Les adresses du site (un Set de chemins, sans ancre ni requête) : chaque page qui n'est pas d'exemple, chaque rubrique (`type_page`) et ADRESSES_FIXES.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function adressesDuSite(db) {
  const adresses = new Set(ADRESSES_FIXES);
  if (tableExiste(db, 'page')) {
    for (const p of db.prepare("SELECT id FROM page WHERE statut <> 'example'").all()) adresses.add(cheminDeLAdresse(adresseDeLaPage(p.id)));
  }
  if (tableExiste(db, 'type_page')) for (const t of db.prepare('SELECT id FROM type_page').all()) adresses.add(`/${t.id}/`);
  return adresses;
}

/**
 * L'index des pages par adresse : { exactes: Map(adresse avec ancre → id), chemins: Map(chemin → id, pages dont l'adresse n'a pas d'ancre) } ; les
 * pages d'exemple n'y sont pas (sauf `exemples`). `enPlus` : des ids de pages qui ne sont plus dans la base (une page qu'un lot rejoué vient de
 * supprimer : lib/citations-db.mjs, option `absentes`), indexées après celles de la base, à leur adresse (une page de la base garde la sienne).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ exemples?: boolean, enPlus?: Iterable<string> }} [options]
 */
export function indexDesAdresses(db, { exemples = false, enPlus = [] } = {}) {
  const exactes = new Map();
  const chemins = new Map();
  const indexer = (id) => {
    const adresse = adresseDeLaPage(id);
    if (!exactes.has(adresse)) exactes.set(adresse, id);
    if (!decouperLAdresse(adresse).ancre && !chemins.has(adresse)) chemins.set(adresse, id);
  };
  if (tableExiste(db, 'page')) {
    for (const p of db.prepare(`SELECT id FROM page${exemples ? '' : " WHERE statut <> 'example'"} ORDER BY id`).all()) indexer(p.id);
  }
  for (const id of enPlus) indexer(id);
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
