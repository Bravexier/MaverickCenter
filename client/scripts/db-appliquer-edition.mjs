// `npm run db:appliquer-edition -- <journal.json> --rows <copie> [--ignorer-conflits]` (dans client/ ; `--rows` est exigé depuis le lot 12 : data/rows n'est plus écrit) : rapatrie dans une copie de data/rows les modifications
// faites sur le site de dev (docs/serveur.md, « Édition »). Le journal se télécharge depuis le site de dev (lien « N modifications à rapatrier » à côté
// du crayon, GET /api/edition/journal/). Étapes :
//   1. une base est reconstruite depuis data/rows (scripts/db-build.mjs, dans un dossier temporaire) ;
//   2. le journal y est chargé puis rejoué, lot par lot, exactement comme le service le rejoue sur des règles neuves (serveur/edition.mjs#rejouerLeJournal) :
//      une modification déjà présente est « intégrée », un lot dont une modification contredit data/rows est en conflit (le lot entier est écarté) ; le
//      corps des pages typées n'est pas recopié du journal mais refait depuis les tables rejouées (lots notés avant que l'édition ne le suive compris) ;
//      Après le rejeu, comme pour « Effectuer la mise à jour » : un texte (corps d'une page, bloc de description de la chronologie, bloc d'un panneau
//      de règles) qui a gagné du HTML brut ou un lien non sûr arrête tout, rien n'est écrit (scripts/mise-a-jour-regles.mjs#texteNonSurApresLeRejeu,
//      lib/markdown-sur.mjs : le build rend ce Markdown tel quel) ;
//   3. s'il y a un conflit, rien n'est écrit (sauf --ignorer-conflits : les autres lots le sont) ; sinon les modifications rejouées (réappliquées ou
//      déjà présentes, « intégrées ») sont versées dans historique_modification, version NULL (rapatriées à la main ; un lot qui y est déjà n'est pas
//      repris), les tables du journal sont vidées (elles restent vides dans data/rows) et data/rows est réécrit par l'exporteur des importeurs
//      (tools/db/exporter.py : même format, octet pour octet).
// Rien n'est commité de la copie : data/rows est écrit par le workflow seul (R274, R278). Le site est la source des données qu'il modifie
// (décision du propriétaire) : les tests qui épinglent l'import (effectifs, textes cités) le lisent dans historique_modification
// (src/lib/historique-site.mjs) et contrôlent la cohérence de l'état courant. Le service, lui, verra ces modifications « intégrées ».
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { integrerLivrees } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal } from '../serveur/edition-journal.mjs';
import { historiser } from '../serveur/historique.mjs';
import { messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { textesAvantLeRejeu, texteNonSurApresLeRejeu } from './mise-a-jour-regles.mjs';

export { historiser }; // la règle vit dans serveur/historique.mjs (livré avec le service) ; réexportée pour qui l'importait d'ici

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Applique un journal (« maverick-edition/1 ») à un dossier de lignes. Rend { bilan, conflits: [{ lot, resume, detail }] (un par lot), ecrit, historisees } ; lève une erreur si la
 * base ne se reconstruit pas, si le rejeu ajoute du HTML brut ou un lien non sûr à un texte en Markdown (rien n'est écrit, même avec `ignorerConflits`)
 * ou si l'export échoue.
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
    let historisees = 0;
    try {
      db.exec('PRAGMA foreign_keys = OFF'); // rejouer contrôle les clés étrangères lot par lot
      db.exec('BEGIN');
      chargerJournal(db, journal);
      // les lots déjà rapatriés ou livrés (dans historique_modification) ne sont pas rejoués : d'après leurs valeurs, une suite qui revient sur
      // elle-même (A → B, puis B → A avec une autre ligne qui a bougé depuis) remettrait une valeur annulée
      const dejaLivrees = integrerLivrees(db);
      const textesAvant = textesAvantLeRejeu(db);
      bilan = rejouerLeJournal(db); // corps des pages typées touchées refaits depuis les tables rejouées
      bilan.integrees += dejaLivrees;
      // ni HTML brut ni lien non sûr ajouté à un texte que le build rend tel quel (le service le refuse déjà ; un journal se modifie à la main)
      const nonSur = texteNonSurApresLeRejeu(db, textesAvant);
      if (nonSur) {
        db.exec('ROLLBACK');
        throw new Error(`journal refusé : ${nonSur.quoi} ${nonSur.id} après le rejeu : ${messageDeRefus(nonSur.fragments)}`);
      }
      conflits = db
        .prepare(
          `SELECT l.id AS lot, l.resume, (SELECT detail FROM modification WHERE lot_id = l.id AND etat = 'conflit' ORDER BY rang LIMIT 1) AS detail
           FROM modification_lot l WHERE EXISTS (SELECT 1 FROM modification WHERE lot_id = l.id AND etat = 'conflit') ORDER BY l.fait_le, l.id`,
        )
        .all()
        .map((c) => ({ ...c }));
      if (conflits.length && !ignorerConflits) {
        db.exec('ROLLBACK');
        return { bilan, conflits, ecrit: false, historisees: 0 };
      }
      historisees = historiser(db);
      db.exec('DELETE FROM modification; DELETE FROM modification_lot');
      db.exec('COMMIT');
    } finally {
      db.close();
    }
    const exp = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), chemin, '--rows', rows], { encoding: 'utf8' });
    if (exp.status !== 0) throw new Error(`export refusé : ${exp.stderr || exp.stdout}`);
    return { bilan, conflits, ecrit: true, historisees };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fichier = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--rows');
  // lot 12 : data/rows n'est plus écrit par un outil (R274) ; l'exporteur (tools/db/exporter.py) refuse aussi de l'écrire sans `--rows`. Refus net, avant tout rejeu.
  if (!args.includes('--rows') || !args[args.indexOf('--rows') + 1] || args[args.indexOf('--rows') + 1].startsWith('--')) {
    console.error('db:appliquer-edition n\'écrit plus data/rows (la base du site de dev fait foi, R274) : donner une copie de travail, `-- <journal.json> --rows <copie>`. Rien n\'a été rejoué.');
    process.exit(2);
  }
  if (!fichier) {
    console.error('usage : npm run db:appliquer-edition -- <journal.json> --rows <copie> [--ignorer-conflits]');
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
    const { bilan, conflits, ecrit, historisees } = appliquerJournal(journal, { rows, ignorerConflits: args.includes('--ignorer-conflits') });
    console.log(`${bilan.lots} lot(s) : ${bilan.appliquees} modification(s) appliquée(s), ${bilan.integrees} déjà présente(s), ${bilan.conflits} en conflit`);
    for (const c of conflits) console.log(`  conflit — lot ${c.lot} (« ${c.resume} ») : ${c.detail}`);
    if (!ecrit) {
      console.error('Rien n’a été écrit : réglez les conflits (ou relancez avec --ignorer-conflits pour écrire les autres lots).');
      process.exit(1);
    }
    console.log(`${rows} réécrit (${historisees} modification(s) versée(s) dans historique_modification). Cette copie sert aux tests ; data/rows n'est pas commité à la main.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
