// La base et les lignes de départ des tests qui fabriquent leur propre base de règles (lot 10 du chantier « la base du site de dev devient la source de
// vérité », R274, R278). Sans MAVERICK_CONTENU, rien ne change : la base se reconstruit depuis data/rows (scripts/db-build.mjs) et les lignes sont data/rows.
// Avec MAVERICK_CONTENU (lib/contenu-fourni.mjs : l'extrait du site de dev, que la CI fournit), elles viennent du contenu fourni, par la même voie que
// lib/donnees.mjs#ouvrirBase : une copie (jamais le fichier fourni), préparée par scripts/db-preparer-contenu.mjs#preparerLeContenu (vue de l'extrait
// retirée, migrations du dépôt manquantes appliquées, pages d'exemple du dépôt ajoutées s'il n'en a aucune) ; les lignes sont l'export de cette copie
// (tools/db/exporter.py, l'exporteur de « Copier vers le dépôt »), fait une fois par processus. Module sans test propre (n'est pas un *.test.mjs).
import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { preparerLeContenu } from '../scripts/db-preparer-contenu.mjs';
import { contenuFourni, copierLeContenu } from '../src/lib/contenu-fourni.mjs';
import { TABLES_CALCULEES } from '../src/lib/tables-de-la-base.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS_DU_DEPOT = join(RACINE, 'data', 'rows');

/** Vrai quand les tests lisent le contenu fourni (MAVERICK_CONTENU posée) au lieu de data/rows. */
export const contenuDuSite = () => contenuFourni() !== null;

const lancer = (script, args) => {
  const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', script), ...args], { encoding: 'utf8', cwd: RACINE });
  if (r.status !== 0) throw new Error(`${script} a échoué : ${r.stderr || r.stdout}`);
};

/**
 * Écrit en `destination` la base de règles de départ, NON dérivée (tables calculées vides, comme db-build) : depuis `rows` (data/rows par défaut) sans
 * MAVERICK_CONTENU, sinon une copie préparée du contenu fourni (ses tables calculées vidées : l'extrait les porte). `deriver` : db-derive ensuite
 * (`sansExemples` : sans les pages d'exemple, comme le site de dev). Rend `destination`.
 * @param {string} destination
 * @param {{ deriver?: boolean, sansExemples?: boolean, rows?: string }} [o]
 */
export function baseDeDepart(destination, { deriver = false, sansExemples = false, rows } = {}) {
  const contenu = rows ? null : contenuFourni();
  if (contenu) {
    copierLeContenu(contenu, destination);
    preparerLeContenu(destination, { racine: RACINE });
    const db = new DatabaseSync(destination);
    try {
      for (const table of TABLES_CALCULEES) db.exec(`DELETE FROM "${table}"`); // noms tirés d'une liste figée du code
    } finally {
      db.close();
    }
  } else lancer('db-build.mjs', ['--out', destination, ...(rows ? ['--rows', rows] : [])]);
  if (deriver) lancer('db-derive.mjs', [destination, ...(sansExemples ? ['--sans-exemples'] : [])]);
  return destination;
}

let rowsExportees = null;

/**
 * Les lignes de départ, EN LECTURE (à copier, jamais à écrire) : data/rows sans MAVERICK_CONTENU ; sinon l'export de la base de départ (baseDeDepart)
 * par tools/db/exporter.py, fait une fois par processus — les lignes que « Copier vers le dépôt » écrirait depuis le contenu fourni.
 */
export function rowsDeDepart() {
  if (!contenuDuSite()) return ROWS_DU_DEPOT;
  if (rowsExportees) return rowsExportees;
  const dossier = dossierTemporaire('rows-de-depart');
  const base = baseDeDepart(join(dossier, 'depart.db'));
  const rows = join(dossier, 'rows');
  const e = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), base, '--rows', rows], { encoding: 'utf8' });
  if (e.status !== 0) throw new Error(`export du contenu fourni refusé : ${e.stderr || e.stdout}`);
  rowsExportees = rows;
  return rows;
}

/** Une copie des lignes de départ (rowsDeDepart) dans `destination`, que le test peut écrire. Rend `destination`. */
export function copieDesRowsDeDepart(destination) {
  cpSync(rowsDeDepart(), destination, { recursive: true });
  return destination;
}
