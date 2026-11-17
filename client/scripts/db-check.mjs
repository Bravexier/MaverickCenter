// `npm run db:check` (dans client/) : contrôles d'intégrité que SQLite ne sait pas exprimer.
//   node scripts/db-check.mjs [<base.db>] [--types client/src/lib/types.mjs]   (défauts : var/maverick.db et client/src/lib/types.mjs)   -> JSON { ok, problemes[], bilan } ; code de sortie 1 au moindre problème
// Les contrôles eux-mêmes sont dans client/serveur/controles-du-contenu.mjs (le service d'édition les lance aussi, sur la copie où il essaie un lot de
// changements) : ce script n'ouvre que la base et dit le résultat.
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { lireHeritage } from './db-lib.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));   // racine du dépôt
const dbPath = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : resolve(RACINE, 'var', 'maverick.db'));
const db = new DatabaseSync(dbPath, { readOnly: true });
db.exec('PRAGMA foreign_keys = ON');
// Clés étrangères : celles qui visent une famille encore « héritée » (data/heritage.json) sont tolérées et comptées, les autres sont des problèmes.
const iHer = process.argv.indexOf('--heritage');
const heritees = lireHeritage(iHer > 0 ? process.argv[iHer + 1] : null);
// Types de page : la table type_page est le miroir de client/src/lib/types.mjs (le site garde ce fichier : libellés, salons Discord, ordre des rubriques).
const iTypes = process.argv.indexOf('--types');
const types = iTypes > 0 ? (await import(pathToFileURL(resolve(process.argv[iTypes + 1])).href)).TYPES : undefined;

const { problemes, avertissements, bilan } = controlerLeContenu(db, { heritees, ...(types ? { types } : {}) });
process.stdout.write(JSON.stringify({ ok: problemes.length === 0, problemes: problemes.slice(0, 40), nbProblemes: problemes.length, avertissements, bilan }) + '\n');
process.exit(problemes.length ? 1 : 0);
