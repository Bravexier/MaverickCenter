// `npm run db:appliquer-edition -- <journal.json> [--ignorer-conflits] [--rows <dossier>]` (dans client/) : rapatrie dans data/rows les modifications
// faites sur le site de dev (docs/serveur.md, « Édition »). Le journal se télécharge depuis le site de dev (lien « N modifications à rapatrier » à côté
// du crayon, GET /api/edition/journal/). Étapes :
//   1. une base est reconstruite depuis data/rows (scripts/db-build.mjs, dans un dossier temporaire) ;
//   2. le journal y est chargé puis rejoué, lot par lot, exactement comme le service le rejoue sur des règles neuves (serveur/edition-journal.mjs#rejouer) :
//      une modification déjà présente est « intégrée », un lot dont une modification contredit data/rows est en conflit (le lot entier est écarté) ;
//   3. s'il y a un conflit, rien n'est écrit (sauf --ignorer-conflits : les autres lots le sont) ; sinon les tables du journal sont vidées (elles restent
//      vides dans data/rows) et data/rows est réécrit par l'exporteur des importeurs (tools/db/exporter.py : même format, octet pour octet).
// Ensuite : `npm run db:build && npm run db:check`, puis `npm test` (les tests qui épinglent les données importées — effectifs, fidélité des pages de
// race à leur onglet — disent ce que les modifications ont changé) et un commit de data/rows. Le service, lui, verra ces modifications « intégrées ».
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { chargerJournal, rejouer } from '../serveur/edition-journal.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Applique un journal (« maverick-edition/1 ») à un dossier de lignes. Rend { bilan, conflits: [{ lot, resume, detail }] (un par lot), ecrit } ; lève une erreur si la
 * base ne se reconstruit pas ou si l'export échoue.
 */
export function appliquerJournal(journal, { rows = join(RACINE, 'data', 'rows'), ignorerConflits = false } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-appliquer-'));
  try {
    const chemin = join(tmp, 'base.db');
    const construction = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-build.mjs'), '--out', chemin, '--rows', rows], { encoding: 'utf8' });
    if (construction.status !== 0) throw new Error(`data/rows ne se reconstruit pas : ${construction.stderr || construction.stdout}`);
    const db = new DatabaseSync(chemin);
    let bilan;
    let conflits;
    try {
      db.exec('PRAGMA foreign_keys = OFF'); // rejouer contrôle les clés étrangères lot par lot
      db.exec('BEGIN');
      chargerJournal(db, journal);
      bilan = rejouer(db);
      conflits = db
        .prepare(
          `SELECT l.id AS lot, l.resume, (SELECT detail FROM modification WHERE lot_id = l.id AND etat = 'conflit' ORDER BY rang LIMIT 1) AS detail
           FROM modification_lot l WHERE EXISTS (SELECT 1 FROM modification WHERE lot_id = l.id AND etat = 'conflit') ORDER BY l.fait_le, l.id`,
        )
        .all()
        .map((c) => ({ ...c }));
      if (conflits.length && !ignorerConflits) {
        db.exec('ROLLBACK');
        return { bilan, conflits, ecrit: false };
      }
      db.exec('DELETE FROM modification; DELETE FROM modification_lot');
      db.exec('COMMIT');
    } finally {
      db.close();
    }
    const exp = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), chemin, '--rows', rows], { encoding: 'utf8' });
    if (exp.status !== 0) throw new Error(`export refusé : ${exp.stderr || exp.stdout}`);
    return { bilan, conflits, ecrit: true };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fichier = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--rows');
  if (!fichier) {
    console.error('usage : npm run db:appliquer-edition -- <journal.json> [--ignorer-conflits] [--rows <dossier>]');
    process.exit(2);
  }
  const rows = args.includes('--rows') ? resolve(args[args.indexOf('--rows') + 1]) : undefined;
  let journal;
  try {
    journal = JSON.parse(readFileSync(resolve(fichier), 'utf8'));
  } catch (e) {
    console.error(`${fichier} : journal illisible (${e.message})`);
    process.exit(2);
  }
  try {
    const { bilan, conflits, ecrit } = appliquerJournal(journal, { rows, ignorerConflits: args.includes('--ignorer-conflits') });
    console.log(`${bilan.lots} lot(s) : ${bilan.appliquees} modification(s) appliquée(s), ${bilan.integrees} déjà présente(s), ${bilan.conflits} en conflit`);
    for (const c of conflits) console.log(`  conflit — lot ${c.lot} (« ${c.resume} ») : ${c.detail}`);
    if (!ecrit) {
      console.error('Rien n’a été écrit : réglez les conflits (ou relancez avec --ignorer-conflits pour écrire les autres lots).');
      process.exit(1);
    }
    console.log('data/rows réécrit. Ensuite : npm run db:build && npm run db:check, npm test, puis commit de data/rows.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
