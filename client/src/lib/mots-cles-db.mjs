// Le vocabulaire des mots-clés lu dans la base construite (table mot_cle, migrations 0043 et 0055) : le glossaire de la page Recherche, l'adresse des
// pastilles des pages du wiki (/recherche/?mot-cle=<id>) et les balises des textes (lib/mots-cles-balises.mjs : le middleware du site, la recherche, les
// règles de la fiche). Un mot-clé : son id (figé), son libellé, son écriture (libelle_cle = normalize du libellé) et sa définition (`description` : NULL
// tant qu'il n'est pas décrit, ici comme dans la base, le service et GET /api/edition/mots-cles/ ; qui l'affiche écrit `?? ''`). Les pages portent les
// LIBELLÉS de leurs mots-clés (front matter `tags`, fabriqué par db:export-pages) : l'id d'un libellé est celui du mot-clé qui s'écrit pareil.
// Et les textes de la base où une balise peut s'écrire (textesDeLaBase : db:check, le rejeu du journal ; hors tables de lib/tables-de-la-base.mjs).
// Sans dépendance Astro ni navigateur : la base est passée par l'appelant (pages, middleware, service, scripts, tests).
import { typeDeTexte } from './edition-modele.mjs';
import { parLibelle } from './mots-cles.mjs';
import { TABLES_DERIVEES, TABLES_HORS_REGLES, TRACES_TELLES_QUELLES } from './tables-de-la-base.mjs';
import { normalize } from './text.mjs';

const caches = new WeakMap(); // base -> { vocabulaire, ids }

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
const colonneExiste = (db, table, colonne) => db.prepare(`PRAGMA table_info("${table}")`).all().some((c) => c.name === colonne);

function lire(db) {
  if (caches.has(db)) return caches.get(db);
  // une base d'avant la migration 0055 n'a pas de définitions : NULL (pas encore décrit)
  const description = tableExiste(db, 'mot_cle') && colonneExiste(db, 'mot_cle', 'description') ? 'description' : 'NULL AS description';
  const vocabulaire = tableExiste(db, 'mot_cle')
    ? db.prepare(`SELECT id, libelle, libelle_cle, ${description} FROM mot_cle`).all().map((m) => ({ ...m })).sort(parLibelle)
    : [];
  const lu = { vocabulaire, ids: new Map(vocabulaire.map((m) => [m.libelle_cle, m.id])) };
  caches.set(db, lu);
  return lu;
}

/**
 * Le vocabulaire : [{ id, libelle, libelle_cle, description }] (description NULL tant qu'il n'est pas décrit), trié par libellé ; vide pour une base sans
 * table mot_cle (antérieure à la migration 0043).
 */
export const chargerVocabulaire = (db) => lire(db).vocabulaire;

/**
 * L'id du mot-clé qui s'écrit `libelle` ; à défaut (une page écrite à la main et pas encore versée dans la base), son écriture même : les ids de la
 * migration 0043 sont les anciennes clés des adresses /tags/<clé>/.
 */
export function idDuMotCle(db, libelle) {
  const cle = normalize(libelle);
  return lire(db).ids.get(cle) ?? cle;
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
