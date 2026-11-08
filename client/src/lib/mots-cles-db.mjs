// Le vocabulaire des mots-clés lu dans la base construite (table mot_cle, migrations 0043, 0056 et 0113 à 0115) : le Glossaire, la Recherche, l'adresse
// des pastilles des pages du wiki (/recherche/?mot-cle=<clé>) et les balises des textes (lib/mots-cles-balises.mjs : le middleware du site, la
// recherche, les règles de la fiche). Un mot-clé : son id (entier, figé, migration 0113), son libellé (pas unique), sa clé (`cle` : celle que citent
// les balises et les adresses, recalculée : lib/mots-cles-cles.mjs, décision R232), sa définition (`description` : NULL tant qu'il n'est pas décrit,
// ici comme dans la base, le service et GET /api/edition/mots-cles/ ; qui l'affiche écrit `?? ''`), sa couleur et son adresse (`couleur`, `url`,
// migration 0098 : NULL sans elles), son verrou (0 ou 1, migration 0110), la monnaie dont il est le mot-clé (`monnaie_id`, migration 0113 : NULL
// sinon ; un mot-clé de monnaie se reconnaît par elle, jamais par son id ni par un synonyme), ses synonymes (`synonymes` : leurs écritures dans
// l'ordre, migration 0115, décision R233 ; l'ancienne abréviation en est un), ses catégories (`categories` : leurs ids, croissants, migration 0113) et
// les clés qu'il a quittées (`anciennes_cles`, mot_cle_ancienne_cle : une balise ou une adresse d'avant un renommage mène encore à lui). Les pages
// portent l'écriture de leurs mots-clés (front matter `tags`, fabriqué par db:export-pages : le libellé, ou la clé d'un homonyme).
// Et les textes de la base où une balise peut s'écrire (textesDeLaBase : db:check, le rejeu du journal ; hors tables de lib/tables-de-la-base.mjs).
// Sans dépendance Astro ni navigateur : la base est passée par l'appelant (pages, middleware, service, scripts, tests).
import { indexDesAdresses, pageDeLAdresse } from './adresses-db.mjs';
import { typeDeTexte } from './edition-modele.mjs';
import { parLibelle } from './mots-cles.mjs';
import { motCleDeLaRef, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { TABLES_DERIVEES, TABLES_HORS_REGLES, TRACES_TELLES_QUELLES } from './tables-de-la-base.mjs';

const caches = new WeakMap(); // base -> { vocabulaire, pret }

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
const colonnesDe = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);

/**
 * Les catégories des mots-clés (table categorie_mot_cle, migration 0113) : [{ id, libelle, libelle_cle, mots_cles (le nombre de mots-clés qui la
 * portent) }], dans l'ordre de leur id ; vide pour une base qui n'a pas la table.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function categoriesDesMotsCles(db) {
  if (!tableExiste(db, 'categorie_mot_cle')) return [];
  const compte = tableExiste(db, 'mot_cle_categorie') ? '(SELECT count(*) FROM mot_cle_categorie l WHERE l.categorie_id = c.id)' : '0';
  return db.prepare(`SELECT c.id, c.libelle, c.libelle_cle, ${compte} AS mots_cles FROM categorie_mot_cle c ORDER BY c.id`).all().map((c) => ({ ...c }));
}

/**
 * Les mots-clés de la base, lus à chaque appel (sans cache : le service, dont la base change d'un lot à l'autre) : [{ id, libelle, cle, description,
 * couleur, url, verrou, monnaie_id, icone, synonymes, categories, anciennes_cles }], dans l'ordre de leur id (`icone` : migration 0116, décision
 * R235, lib/icones.mjs). Une base d'avant la migration 0113 (le service peut y retomber si la reconstruction de sa base vivante échoue) : `cle` =
 * libelle_cle, ni catégorie ni clé quittée, et son abréviation (0090) pour seul synonyme ; d'avant la 0056, la 0098, la 0110 ou la 0116 : NULL (0 pour
 * le verrou) ; vide sans table mot_cle (avant la 0043).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function motsClesDeLaBase(db) {
  if (!tableExiste(db, 'mot_cle')) return [];
  const enPlace = colonnesDe(db, 'mot_cle');
  // un nom de colonne n'est écrit que s'il est l'un de ceux-ci, présent dans la table (PRAGMA table_info) ; sinon sa valeur par défaut
  const colonne = (c, defaut = 'NULL') => (enPlace.includes(c) ? `"${c}"` : `${defaut} AS "${c}"`);
  const cle = enPlace.includes('cle') ? '"cle"' : '"libelle_cle" AS "cle"';
  const optionnelles = [...['description', 'couleur', 'url', 'monnaie_id', 'icone'].map((c) => colonne(c)), colonne('verrou', '0')].join(', ');
  const abreviation = !tableExiste(db, 'mot_cle_synonyme') && enPlace.includes('abreviation');
  const lignes = db.prepare(`SELECT id, libelle, ${cle}, ${optionnelles}${abreviation ? ', "abreviation"' : ''} FROM mot_cle ORDER BY id`).all();
  const parId = new Map(lignes.map((l) => [l.id, { ...l, synonymes: [], categories: [], anciennes_cles: [] }]));
  for (const m of parId.values()) {
    if (abreviation) {
      if (typeof m.abreviation === 'string' && m.abreviation) m.synonymes.push(m.abreviation);
      delete m.abreviation;
    }
  }
  if (tableExiste(db, 'mot_cle_synonyme')) {
    for (const s of db.prepare('SELECT mot_cle_id, libelle FROM mot_cle_synonyme ORDER BY mot_cle_id, ordre, id').all()) parId.get(s.mot_cle_id)?.synonymes.push(s.libelle);
  }
  if (tableExiste(db, 'mot_cle_categorie')) {
    for (const c of db.prepare('SELECT mot_cle_id, categorie_id FROM mot_cle_categorie ORDER BY mot_cle_id, categorie_id').all()) parId.get(c.mot_cle_id)?.categories.push(c.categorie_id);
  }
  if (tableExiste(db, 'mot_cle_ancienne_cle')) {
    for (const a of db.prepare('SELECT mot_cle_id, cle FROM mot_cle_ancienne_cle ORDER BY mot_cle_id, cle').all()) parId.get(a.mot_cle_id)?.anciennes_cles.push(a.cle);
  }
  return [...parId.values()];
}

/**
 * La page où mène l'adresse de chaque mot-clé qui en a une (la colonne Lien du tableau du Glossaire, décision R234 (2), réponse T5 : « le titre de la
 * page ») : Map(id du mot-clé → { page, titre }, ou null quand l'adresse ne mène à aucune page de la base : une rubrique, une route sans page, que le
 * Glossaire montre telle quelle) ; lib/adresses-db.mjs#pageDeLAdresse (ancre comprise, sinon le chemin ; pages d'exemple exclues). `motsCles` : ceux
 * de motsClesDeLaBase par défaut.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function pagesDesLiens(db, motsCles = motsClesDeLaBase(db)) {
  const sortie = new Map();
  const avecAdresse = [...motsCles].filter((m) => typeof m.url === 'string' && m.url);
  if (!avecAdresse.length) return sortie;
  const index = indexDesAdresses(db);
  const titres = tableExiste(db, 'page') ? new Map(db.prepare('SELECT id, titre FROM page').all().map((p) => [p.id, p.titre])) : new Map();
  for (const m of avecAdresse) {
    const page = pageDeLAdresse(index, m.url);
    sortie.set(m.id, page && titres.has(page) ? { page, titre: titres.get(page) } : null);
  }
  return sortie;
}

function lire(db) {
  if (caches.has(db)) return caches.get(db);
  const vocabulaire = motsClesDeLaBase(db).sort(parLibelle);
  const lu = { vocabulaire, pret: vocabulaireDesMotsCles(vocabulaire) };
  caches.set(db, lu);
  return lu;
}

/**
 * Le vocabulaire (motsClesDeLaBase), trié par libellé ; vide pour une base sans table mot_cle (antérieure à la migration 0043). Lu une fois par base
 * (la base construite : pages, middleware).
 */
export const chargerVocabulaire = (db) => lire(db).vocabulaire;

/**
 * L'id du mot-clé qu'une écriture du `tags:` d'une page désigne (sa clé, son libellé quand un seul mot-clé le porte, un synonyme, une clé quittée :
 * lib/mots-cles-balises.mjs#motCleDeLaRef, l'ordre de tools/db/maverick.py#trouver_mot_cle), ou null (inconnue, ou libellé ambigu).
 */
export function idDuMotCle(db, ecriture) {
  return motCleDeLaRef(lire(db).pret, String(ecriture ?? ''))?.id ?? null;
}

/**
 * Les colonnes de texte de la base où une balise du glossaire peut s'écrire : toutes les colonnes TEXT des tables de règles et des pages (sections 1 à
 * 10 et 12 de data/schema.sql), sauf (lib/tables-de-la-base.mjs, la seule source) les tables hors des règles (sections 13 à 15 : fiches, journal, notes de
 * version), les tables dérivées (section 11 : `lien.ancre` reprend le texte d'un lien du Markdown, que le build recalcule), les traces gardées telles
 * quelles (notes de cellule, écarts, corrections, commentaires orphelins, alias, sources) et les tables de recherche plein texte (FTS5 et leurs tables
 * internes) : ce que db:check contrôle et que le rejeu du journal réécrit. Rend [{ table, colonne, cle (colonnes de la clé primaire, ou rowid), markdown
 * (lib/edition-modele.mjs#typeDeTexte : un texte mis en forme) }], dans l'ordre des tables.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function textesDeLaBase(db) {
  const exclues = new Set([...TABLES_HORS_REGLES, ...TABLES_DERIVEES, ...TRACES_TELLES_QUELLES]);
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const virtuelles = tables.filter((t) => /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(t.sql ?? '')).map((t) => t.name);
  const sortie = [];
  for (const { name: table } of tables) {
    if (exclues.has(table) || virtuelles.some((v) => table === v || table.startsWith(`${v}_`))) continue;
    const colonnes = db.prepare(`PRAGMA table_info("${table}")`).all();
    const pk = colonnes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    for (const c of colonnes) {
      if (!/TEXT/i.test(c.type)) continue;
      sortie.push({ table, colonne: c.name, cle: pk.length ? pk : ['rowid'], markdown: typeDeTexte(table, c.name) === 'markdown' });
    }
  }
  return sortie;
}
