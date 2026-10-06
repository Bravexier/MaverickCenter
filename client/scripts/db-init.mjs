// Crée une base SQLite VIDE à partir de data/schema.sql : `npm run db:init` (client/) ou
//   node scripts/db-init.mjs [--out <fichier.db>] [--schema <schema.sql>] [--force]
// Par défaut : var/maverick.db à la racine du dépôt (dossier ignoré par git). Refuse d'écraser un fichier existant sans --force.
// Aucune dépendance : node:sqlite (Node >= 22.13). Le schéma est la seule source de la structure (voir docs/sql/structure.md).
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
const schema = resolve(option('--schema', resolve(racine, 'data', 'schema.sql')));
const sortie = resolve(option('--out', resolve(racine, 'var', 'maverick.db')));
const force = args.includes('--force');

if (existsSync(sortie) && !force) {
  console.error(`${sortie} existe déjà : relancer avec --force pour le recréer (la base est une copie reconstruite, rien n'y est perdu).`);
  process.exit(1);
}
const texte = readFileSync(schema, 'utf8');
mkdirSync(dirname(sortie), { recursive: true });
rmSync(sortie, { force: true });
const db = new DatabaseSync(sortie);
try {
  db.exec(texte);
  db.exec('PRAGMA foreign_keys = ON');
  const violations = db.prepare('PRAGMA foreign_key_check').all();
  if (violations.length) throw new Error(`clés étrangères rompues : ${JSON.stringify(violations.slice(0, 3))}`);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const nb = (type) => db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'").get(type).n;
  console.log(`${sortie} : schéma version ${version}, ${nb('table')} tables (ombres FTS5 comprises), ${nb('view')} vues, ${nb('index')} index.`);
} catch (e) {
  db.close();
  rmSync(sortie, { force: true });
  console.error(`schéma refusé : ${e.message}`);
  process.exit(1);
}
db.close();
