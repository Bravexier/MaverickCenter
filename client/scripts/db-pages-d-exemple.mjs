#!/usr/bin/env node
// Les pages d'exemple (`page.statut = 'example'`) : des fixtures, pas du lore (CLAUDE.md). Le site de dev ne les a pas ; data/rows les a encore. Ce script
// les copie, avec leurs dépendants, dans data/pages-d-exemple.sql (lib/contenu-fourni.mjs#FICHIER_DES_PAGES_D_EXEMPLE), gardé dans le dépôt quand data/rows
// en sortira (lot 12 du chantier de la base de dev). Une copie de travail d'un contenu fourni (MAVERICK_CONTENU) qui n'a aucune page d'exemple les reçoit
// (scripts/db-preparer-contenu.mjs#injecterLesPagesDExemple) : les tests qui les attendent lisent l'extrait du site de dev comme ils lisaient data/rows.
//   node scripts/db-pages-d-exemple.mjs              écrit data/pages-d-exemple.sql depuis la base reconstruite de data/rows (db-build)
//   node scripts/db-pages-d-exemple.mjs --verifier   n'écrit rien : code 1 si le fichier diffère de ce que data/rows porte
// Fabrication mécanique, sans rien choisir à la main : exactement ce que la variante sans exemples retire (scripts/db-derive.mjs --sans-exemples, celle
// de HIDE_EXAMPLES=1 : les pages d'exemple, leurs enfants par cascade, les sources qu'elles seules citaient), table par table, par clé primaire.
// Ajouter ce fichier à un contenu sans exemples, c'est donc défaire ce retrait, et HIDE_EXAMPLES=1 le refait. Les tables dérivées (`-- @derivee`, recalculées
// par db-derive : lien, page_fts…) n'y sont jamais. Les instructions sont écrites comme l'exporteur de data/rows (tools/db/maverick.py#exporter_table : colonnes
// nommées, littéraux de maverick.py#litteral), les parents d'abord, chaque table triée par sa clé primaire : chacune est une ligne de data/rows
// (test/pages-d-exemple.test.mjs).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { FICHIER_DES_PAGES_D_EXEMPLE } from '../src/lib/contenu-fourni.mjs';
import { lireSchema } from '../src/lib/schema-doc.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

export const EN_TETE = `-- ${FICHIER_DES_PAGES_D_EXEMPLE.join('/')} : les pages d'exemple (statut 'example') et leurs dépendants, des fixtures et non du lore.
-- Fabriqué depuis data/rows par client/scripts/db-pages-d-exemple.mjs. NE PAS ÉDITER À LA MAIN.
-- Inséré dans la copie de travail d'un contenu fourni qui n'a aucune page d'exemple (scripts/db-preparer-contenu.mjs#injecterLesPagesDExemple).
`;

/** Les tables dérivées du schéma (`-- @derivee`) : recalculées par db-derive, jamais copiées. */
export function tablesDerivees(texteDuSchema) {
  return new Set(lireSchema(texteDuSchema).flatMap((s) => s.objets).filter((o) => o.derivee).map((o) => o.nom));
}

const guillemets = (c) => `"${String(c).replace(/"/g, '""')}"`;
const CONTROLES = /[\x00-\x08\x0b-\x1f\x7f]/g;

/** Le littéral SQL d'une valeur, écrit comme tools/db/maverick.py#litteral (retours à la ligne gardés, autres caractères de contrôle par char()). */
export function litteral(valeur, type) {
  if (valeur === null || type === 'null') return 'NULL';
  if (type === 'integer') return String(valeur);
  if (type === 'real') {
    // repr() de Python : « 1.0 » pour un entier ; hors de [1e-4, 1e16[, les deux langages n'écrivent plus l'exposant pareil
    const a = Math.abs(valeur);
    if (!Number.isFinite(valeur) || (a !== 0 && (a < 1e-4 || a >= 1e16))) throw new Error(`réel ${valeur} : écriture de maverick.py#litteral non garantie`);
    return Number.isInteger(valeur) ? `${valeur}.0` : String(valeur);
  }
  if (type !== 'text') throw new Error(`type non exportable : ${type}`);
  const morceaux = [];
  let dernier = 0;
  for (const m of valeur.matchAll(CONTROLES)) {
    if (m.index > dernier) morceaux.push(`'${valeur.slice(dernier, m.index).replace(/'/g, "''")}'`);
    morceaux.push(`char(${m[0].codePointAt(0)})`);
    dernier = m.index + 1;
  }
  if (dernier < valeur.length || !morceaux.length) morceaux.push(`'${valeur.slice(dernier).replace(/'/g, "''")}'`);
  return morceaux.join('||');
}

/**
 * Les lignes que la variante sans exemples retire : celles de `avec` (une base reconstruite depuis data/rows, sans tables dérivées) dont la clé primaire
 * manque dans la base attachée `sans` (la même, passée par scripts/db-derive.mjs --sans-exemples : pages d'exemple supprimées, cascade sur leurs enfants,
 * sources orphelines retirées). Rend [{ table, colonnes, lignes: [{ valeurs, types }] }], parents d'abord, chaque table triée par sa clé primaire.
 * @param {import('node:sqlite').DatabaseSync} db la base `avec`, où `sans` est attachée
 * @param {{ derivees?: Set<string> }} [o]
 */
export function lignesDesPagesDExemple(db, { derivees = new Set() } = {}) {
  const tables = db.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL TABLE%' ORDER BY rowid").all()
    .map((t) => t.name).filter((t) => !derivees.has(t) && !/_fts(?:_\w+)?$/.test(t));
  const blocs = new Map();
  for (const t of tables) {
    const cols = db.prepare('SELECT name, pk FROM main.pragma_table_info(?)').all(t);
    const pk = cols.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    if (!pk.length) throw new Error(`${t} : pas de clé primaire (elle fixe l'ordre, comme l'export de data/rows)`);
    const colonnes = cols.map((c) => c.name);
    const sql = `SELECT ${colonnes.map((c) => `a.${guillemets(c)}, typeof(a.${guillemets(c)}) AS ${guillemets(`typeof:${c}`)}`).join(', ')} FROM main.${guillemets(t)} AS a
      WHERE NOT EXISTS (SELECT 1 FROM sans.${guillemets(t)} AS b WHERE ${pk.map((c) => `b.${guillemets(c)} IS a.${guillemets(c)}`).join(' AND ')})
      ORDER BY ${pk.map((c) => `a.${guillemets(c)}`).join(', ')}`;
    const lignes = db.prepare(sql).all().map((l) => ({
      valeurs: Object.fromEntries(colonnes.map((c) => [c, l[c]])), types: Object.fromEntries(colonnes.map((c) => [c, l[`typeof:${c}`]])),
    }));
    if (!lignes.length) continue;
    const parents = new Set(db.prepare('SELECT "table" AS parent FROM main.pragma_foreign_key_list(?)').all(t).map((f) => f.parent).filter((p) => p !== t));
    blocs.set(t, { table: t, colonnes, lignes, parents });
  }
  // parents d'abord (ordre topologique des tables retenues), à défaut l'ordre du schéma
  const ordre = [];
  while (ordre.length < blocs.size) {
    const suivante = [...blocs.values()].find((b) => !ordre.includes(b) && [...b.parents].every((p) => !blocs.has(p) || ordre.includes(blocs.get(p))));
    if (!suivante) throw new Error(`clés étrangères circulaires entre ${[...blocs.keys()].filter((t) => !ordre.includes(blocs.get(t))).join(', ')}`);
    ordre.push(suivante);
  }
  return ordre.map(({ table, colonnes, lignes }) => ({ table, colonnes, lignes }));
}

/** Les instructions INSERT d'une table, une par ligne, écrites comme tools/db/maverick.py#exporter_table. */
export function instructions({ table, colonnes, lignes }) {
  const tete = `INSERT INTO ${table} (${colonnes.join(', ')}) VALUES (`;
  return lignes.map((l) => `${tete}${colonnes.map((c) => litteral(l.valeurs[c], l.types[c])).join(', ')});\n`);
}

/** Le texte du fichier des pages d'exemple et ses blocs, pour `db`. Sans page d'exemple : une erreur (le fichier ne se vide jamais en silence). */
export function pagesDExemple(db, o) {
  const blocs = lignesDesPagesDExemple(db, o);
  if (!blocs.some((b) => b.table === 'page' && b.lignes.length)) throw new Error('aucune page d’exemple (statut « example ») dans la base : le fichier des pages d’exemple ne se fabrique pas');
  return { texte: EN_TETE + blocs.map((b) => `\n-- ${b.table} (${b.lignes.length})\n${instructions(b).join('')}`).join(''), blocs };
}

/**
 * Le fichier que data/rows donne, { texte, blocs } : la base est reconstruite (scripts/db-build.mjs), puis une copie passe par scripts/db-derive.mjs --sans-exemples (ce que
 * HIDE_EXAMPLES=1 retire, et rien d'autre) ; le dossier temporaire est supprimé ensuite.
 */
export function depuisLesLignes({ racine = RACINE } = {}) {
  const rows = join(racine, 'data', 'rows');
  if (!existsSync(rows)) throw new Error(`${rows} est introuvable : le fichier des pages d’exemple se fabrique depuis data/rows`);
  const dossier = mkdtempSync(join(tmpdir(), 'maverick-pages-d-exemple-'));
  const lancer = (script, args) => {
    const r = spawnSync(process.execPath, ['--no-warnings', join(racine, 'client', 'scripts', script), ...args], { encoding: 'utf8', cwd: racine });
    if (r.status !== 0) throw new Error(`${script} a échoué : ${r.stderr || r.stdout}`);
  };
  try {
    const avec = join(dossier, 'avec.db');
    const sans = join(dossier, 'sans.db');
    const schema = join(racine, 'data', 'schema.sql');
    lancer('db-build.mjs', ['--out', avec, '--schema', schema, '--rows', rows]);
    copyFileSync(avec, sans);
    lancer('db-derive.mjs', [sans, '--sans-exemples', '--derive-sql', join(racine, 'data', 'derive.sql')]);
    const db = new DatabaseSync(avec, { readOnly: true });
    try {
      db.prepare('ATTACH DATABASE ? AS sans').run(sans);
      return pagesDExemple(db, { derivees: tablesDerivees(readFileSync(schema, 'utf8')) });
    } finally {
      db.close();
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  const verifier = process.argv.includes('--verifier');
  const cible = join(RACINE, ...FICHIER_DES_PAGES_D_EXEMPLE);
  try {
    const { texte } = depuisLesLignes();
    if (verifier) {
      const egal = existsSync(cible) && readFileSync(cible, 'utf8') === texte;
      console.log(egal ? `${FICHIER_DES_PAGES_D_EXEMPLE.join('/')} égale data/rows` : `${FICHIER_DES_PAGES_D_EXEMPLE.join('/')} diffère de data/rows : node scripts/db-pages-d-exemple.mjs`);
      process.exitCode = egal ? 0 : 1;
    } else {
      writeFileSync(cible, texte);
      console.log(`${FICHIER_DES_PAGES_D_EXEMPLE.join('/')} écrit`);
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
