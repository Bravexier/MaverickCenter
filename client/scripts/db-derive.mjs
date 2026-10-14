// `npm run db:build` l'enchaîne après db-build.mjs : recalcule les tables DÉRIVÉES (lien, lien_candidat, page_fts, puis data/derive.sql -> entite_fts)
// à partir des tables de base. Réutilise le code du site (wikilinks.mjs, text.mjs) : les règles de résolution ne sont écrites qu'une fois.
//
//   node scripts/db-derive.mjs [<base.db>] [--sans-exemples] [--derive-sql <chemin>]     (défauts : var/maverick.db, data/derive.sql)
//
//   --sans-exemples   équivalent de HIDE_EXAMPLES=1 : supprime les pages `statut = 'example'` AVANT le calcul (cascade sur alias, mots-clés, sources,
//                     page_entite…), puis les sources orphelines. Les deux endroits du site qui filtraient (scanContent et loadWiki) n'en font plus qu'un.
//
// Sortie : un JSON de comptes sur stdout. Code de sortie 1 si une garde échoue (clé normalisée incohérente…).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve as chemin } from 'node:path';
import { controleNomCle } from './db-lib.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));   // racine du dépôt
const LIB = process.env.MAVERICK_LIB ?? fileURLToPath(new URL('../src/lib', import.meta.url));   // client/src/lib : les règles de résolution des liens ne sont écrites qu'une fois
const { buildIndex, extractLinks, resolve } = await import(pathToFileURL(`${LIB}/wikilinks.mjs`).href);
const { normalize } = await import(pathToFileURL(`${LIB}/text.mjs`).href);

const args = process.argv.slice(2);
const dbPath = chemin(args[0] && !args[0].startsWith('--') ? args[0] : chemin(RACINE, 'var', 'maverick.db'));
const deriveSql = chemin(args.includes('--derive-sql') ? args[args.indexOf('--derive-sql') + 1] : chemin(RACINE, 'data', 'derive.sql'));

/** Texte brut pour la recherche : même nettoyage que client/src/pages/search-index.json.ts, sans la coupe à 4000 caractères. */
function textePlein(corps) {
  return corps
    .replace(/\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g, (_, cible, ancre) => ancre ?? cible)
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
const sansExemples = args.includes('--sans-exemples');
const bilan = { sansExemples, pagesSupprimees: 0 };
const problemes = [];

db.exec('BEGIN');
try {
  if (sansExemples) {
    bilan.pagesSupprimees = db.prepare("SELECT count(*) AS n FROM page WHERE statut = 'example'").get().n;
    db.exec("DELETE FROM page WHERE statut = 'example'");
    db.exec('DELETE FROM source WHERE id NOT IN (SELECT source_id FROM page_source)'); // dictionnaire partagé : pas d'orphelin
  }
  db.exec('DELETE FROM lien_candidat; DELETE FROM lien; DELETE FROM page_fts');

  const pages = db.prepare('SELECT id, type, slug, titre, titre_cle, resume, corps_md FROM page ORDER BY id').all();
  const aliasParPage = new Map();
  const alias = db.prepare('SELECT page_id, texte, cle FROM alias ORDER BY page_id, ordre').all();
  for (const r of alias) (aliasParPage.get(r.page_id) ?? aliasParPage.set(r.page_id, []).get(r.page_id)).push(r.texte);
  const tagsParPage = new Map();
  for (const r of db.prepare('SELECT t.page_id, m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id ORDER BY t.page_id, t.ordre').all()) {
    (tagsParPage.get(r.page_id) ?? tagsParPage.set(r.page_id, []).get(r.page_id)).push(r.libelle);
  }

  // Gardes : les clés calculées par les importeurs (Python) doivent être celles du site (JavaScript).
  for (const p of pages) {
    if (normalize(p.titre) !== p.titre_cle) problemes.push(`page ${p.id} : titre_cle=${JSON.stringify(p.titre_cle)} != normalize(titre)=${JSON.stringify(normalize(p.titre))}`);
    if (normalize(p.slug) !== p.slug) problemes.push(`page ${p.id} : normalize(slug)=${JSON.stringify(normalize(p.slug))} != slug`);
  }
  for (const a of alias) {
    if (normalize(a.texte) !== a.cle) problemes.push(`alias ${a.page_id} ${JSON.stringify(a.texte)} : cle=${JSON.stringify(a.cle)} != normalize(texte)`);
  }
  // Toute colonne `X_cle` (24 colonnes, dont mot_cle.libelle_cle) vaut normalize(X) : même garde pour toutes (la copie Python de normalize ne peut pas dériver en silence).
  const cles = controleNomCle(db, db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all(), normalize);
  problemes.push(...cles.problemes);
  bilan.colonnesCle = cles.colonnesVerifiees;
  if (problemes.length) throw new Error(`gardes en échec (${problemes.length}) :\n  ${problemes.slice(0, 20).join('\n  ')}`);

  // Index de résolution : exactement buildIndex() du site.
  const entrees = pages.map((p) => ({ id: p.id, type: p.type, slug: p.slug, title: p.titre, aliases: aliasParPage.get(p.id) ?? [] }));
  const index = buildIndex(entrees);

  const insLien = db.prepare('INSERT INTO lien (page_id, position, cible, ancre, etat, cible_page_id) VALUES (?, ?, ?, ?, ?, ?)');
  const insCand = db.prepare('INSERT INTO lien_candidat (page_id, position, candidat_page_id) VALUES (?, ?, ?)');
  const etats = { resolu: 0, introuvable: 0, ambigu: 0 };
  for (const p of pages) {
    extractLinks(p.corps_md).forEach(({ target, label }, position) => {
      const r = resolve(index, target);
      const etat = r?.entry ? 'resolu' : r?.ambiguous ? 'ambigu' : 'introuvable';
      insLien.run(p.id, position, target, label, etat, r?.entry?.id ?? null);
      for (const c of r?.ambiguous ?? []) insCand.run(p.id, position, c.id);
      etats[etat] += 1;
    });
  }

  const insFts = db.prepare('INSERT INTO page_fts (page_id, titre, alias, tag, resume, texte) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of pages) {
    insFts.run(p.id, p.titre, (aliasParPage.get(p.id) ?? []).join('\n'), (tagsParPage.get(p.id) ?? []).join('\n'), p.resume ?? '', textePlein(p.corps_md));
  }

  const nbCles = db.prepare('SELECT count(*) AS n, count(DISTINCT cle) AS d FROM cle_page').get();
  if (nbCles.d !== index.keys.size) throw new Error(`vue cle_page : ${nbCles.d} clés distinctes != buildIndex() ${index.keys.size}`);
  Object.assign(bilan, { pages: pages.length, cles: nbCles.n, clesDistinctes: nbCles.d, liens: etats, pageFts: pages.length });

  if (deriveSql) {
    db.exec(readFileSync(deriveSql, 'utf8'));
    bilan.entiteFts = db.prepare('SELECT count(*) AS n FROM entite_fts').get().n;
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error(String(err.message ?? err));
  process.exit(1);
}
process.stdout.write(JSON.stringify(bilan) + '\n');
