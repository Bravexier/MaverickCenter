// `npm run db:check` (dans client/) : contrôles d'intégrité que SQLite ne sait pas exprimer.
//   node scripts/db-check.mjs [<base.db>] [--types client/src/lib/types.mjs]   (défauts : voir ci-dessous et client/src/lib/types.mjs)   -> JSON { base, ok, problemes[], bilan } ; code de sortie 1 au moindre problème
// La base contrôlée (`choisirLaBase`, clé `base` du JSON : origine et chemin) : 1. la base donnée en argument ; 2. sinon, MAVERICK_CONTENU posée (lib/contenu-fourni.mjs :
// le contenu du site de dev que la CI fournit) : la COPIE préparée de ce contenu, par la voie du build (lib/donnees.mjs#ouvrirBase : vue de l'extrait retirée,
// migrations manquantes du dépôt, pages d'exemple, tables calculées), jamais le fichier fourni ; 3. sinon var/maverick.db (bâtie depuis data/rows par db:build).
// La CI ne pose pas la variable aux étapes qui lancent db:check (job de simulation de mise à jour et job preparer de mise-a-jour.yml : elles contrôlent data/rows
// qu'elles viennent d'écrire) : rien n'y change.
// Les contrôles eux-mêmes sont dans client/serveur/controles-du-contenu.mjs (le service d'édition les lance aussi, sur la copie où il essaie un lot de
// changements) : ce script n'ouvre que la base et dit le résultat.
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { lireHeritage } from './db-lib.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { contenuFourni } from '../src/lib/contenu-fourni.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));   // racine du dépôt

/**
 * Quelle base contrôler : l'argument (une base donnée), sinon le contenu fourni (`MAVERICK_CONTENU`), sinon `var/maverick.db`.
 * Rend { origine: 'argument' | 'contenu' | 'defaut', chemin } ; pour `contenu`, `chemin` est le fichier fourni (jamais modifié : la copie préparée est ailleurs).
 * Une variable posée sur un fichier introuvable est une erreur (jamais un repli sur var/maverick.db : on contrôlerait une autre base que celle demandée).
 * @param {string[]} argv les arguments après le nom du script
 * @param {Record<string, string|undefined>} [env]
 * @param {string} [racine]
 */
export function choisirLaBase(argv, env = process.env, racine = RACINE) {
  if (argv[0] && !argv[0].startsWith('--')) return { origine: 'argument', chemin: resolve(argv[0]) };
  const contenu = contenuFourni(env);
  if (contenu) return { origine: 'contenu', chemin: contenu };
  return { origine: 'defaut', chemin: resolve(racine, 'var', 'maverick.db') };
}

// realpath : le script peut être lancé par un lien (le kit, les tests) ; importé par un test, il ne contrôle rien
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) await main();

async function main() {
  const base = choisirLaBase(process.argv.slice(2));
  // contenu fourni : la copie préparée et dérivée par la voie du build (ouvrirBase, en lecture seule, supprimée à la sortie) ; sinon le fichier, ouvert en lecture seule
  const db = base.origine === 'contenu' ? ouvrirBase({ sansExemples: false }) : new DatabaseSync(base.chemin, { readOnly: true });
  db.exec('PRAGMA foreign_keys = ON');
  // Clés étrangères : celles qui visent une famille encore « héritée » (data/heritage.json) sont tolérées et comptées, les autres sont des problèmes.
  const iHer = process.argv.indexOf('--heritage');
  const heritees = lireHeritage(iHer > 0 ? process.argv[iHer + 1] : null);
  // Types de page : la table type_page est le miroir de client/src/lib/types.mjs (le site garde ce fichier : libellés, salons Discord, ordre des rubriques).
  const iTypes = process.argv.indexOf('--types');
  const types = iTypes > 0 ? (await import(pathToFileURL(resolve(process.argv[iTypes + 1])).href)).TYPES : undefined;

  const { problemes, avertissements, bilan } = controlerLeContenu(db, { heritees, ...(types ? { types } : {}) });
  process.stdout.write(JSON.stringify({ base, ok: problemes.length === 0, problemes: problemes.slice(0, 40), nbProblemes: problemes.length, avertissements, bilan }) + '\n');
  process.exit(problemes.length ? 1 : 0);
}
