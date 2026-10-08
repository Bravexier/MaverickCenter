// `npm run db:build` (dans client/) = schéma data/schema.sql + lignes data/rows/<table>.sql -> base var/maverick.db ; les tables dérivées viennent après
// (db-derive.mjs, enchaîné par le script npm). Aucune dépendance : node:sqlite (Node >= 22.13).
//   node scripts/db-build.mjs [--out <sortie.db>] [--schema <schema.sql>] [--rows <dossier-rows>] [--heritage <data/heritage.json>]
//
// La version du schéma vient d'UN fichier, <dossier-rows>/VERSION (« schema_version=N »). Les clés étrangères sont contrôlées APRÈS le chargement (l'ordre des
// fichiers est sans importance) ; une clé étrangère vers une table que SEULES des familles « héritées » (data/heritage.json : importeur non livré, tables vides par
// construction) écrivent est tolérée et comptée : le noyau des règles se livre en plusieurs PR (design.md §11).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controleCles, lireHeritage } from './db-lib.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));   // racine du dépôt
const args = process.argv.slice(2);
const option = (nom, defaut) => resolve(args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const sortie = option('--out', join(RACINE, 'var', 'maverick.db'));
const schema = option('--schema', join(RACINE, 'data', 'schema.sql'));
const rows = option('--rows', join(RACINE, 'data', 'rows'));
mkdirSync(dirname(sortie), { recursive: true });
const heritageChemin = args.includes('--heritage') ? args[args.indexOf('--heritage') + 1] : join(dirname(rows), 'heritage.json');
const heritees = lireHeritage(heritageChemin);

const texte = readFileSync(schema, 'utf8');
// Tables de base = tables du schéma (hors tables d'ombre FTS5) qui ne sont pas précédées de « -- @derivee » (même règle que tools/db/__init__.py).
const derivees = new Set([...texte.matchAll(/^-- @derivee[^\n]*\n(?:--[^\n]*\n)*\s*CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(\w+)/gm)].map((m) => m[1]));
const test = new DatabaseSync(':memory:');
test.exec(texte);
const tables = test.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all();
const fts = tables.filter((t) => /VIRTUAL TABLE/i.test(t.sql)).map((t) => t.name);
const ombre = (n) => fts.some((f) => /^(.+)_(data|idx|content|docsize|config)$/.exec(n)?.[1] === f);
const base = tables.map((t) => t.name).filter((n) => !fts.includes(n) && !ombre(n) && !derivees.has(n));
test.close();
const version = Number(texte.match(/^PRAGMA user_version\s*=\s*(\d+)/m)[1]);
if (!existsSync(join(rows, 'VERSION'))) { console.error(`${rows}/VERSION absent : jeu de lignes incomplet`); process.exit(1); }
const v = readFileSync(join(rows, 'VERSION'), 'utf8').match(/^schema_version=(\d+)\r?\n$/);
if (!v || Number(v[1]) !== version) { console.error(`${rows}/VERSION : version ${v?.[1]} != schéma ${version} (migration de schéma à écrire : docs/sql/conception.md §10.1)`); process.exit(1); }
const fichiers = new Set(readdirSync(rows).filter((f) => f.endsWith('.sql')).map((f) => f.slice(0, -4)));
const manquants = base.filter((t) => !fichiers.has(t));
const enTrop = [...fichiers].filter((t) => !base.includes(t));
if (manquants.length || enTrop.length) { console.error(`data/rows/ ne correspond pas au schéma : manquants ${manquants}, en trop ${enTrop}`); process.exit(1); }

rmSync(sortie, { force: true });
const db = new DatabaseSync(sortie);
db.exec(texte);
db.exec('PRAGMA foreign_keys = OFF'); // l'ordre des fichiers est sans importance : contrôle après chargement
db.exec('BEGIN');
for (const t of base) db.exec(readFileSync(join(rows, `${t}.sql`), 'utf8'));
db.exec('COMMIT');

const { violations, tolerees } = controleCles(db, db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all(), heritees);
if (violations.length) { console.error('clés étrangères violées :', violations.slice(0, 10), `(${violations.length} liaison(s))`); process.exit(1); }
db.exec('PRAGMA foreign_keys = ON');
console.log(JSON.stringify({ tables: base.length, version, heritees: [...heritees], clesToleres: tolerees }));
db.close();
