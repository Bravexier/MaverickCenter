// Applique à data/rows un lot figé par « Effectuer la mise à jour » (page /mise-a-jour/ du site de dev ; serveur/notes-de-version.mjs#figerLot) :
//   node scripts/mise-a-jour-regles.mjs --lot <lot.json> [--reference origin/master] [--date AAAA-MM-JJ] [--resume <resume.json>] [--rows <dossier>]
// Lancé par le workflow .github/workflows/mise-a-jour.yml (scripts/mise-a-jour-github.mjs), sur une branche feature/… partie de dev :
//   1. une base est reconstruite depuis data/rows, le journal du lot y est rejoué (serveur/edition-journal.mjs#rejouer) : un conflit arrête tout ;
//   2. la note de version est calculée : la production (master, scripts/db-reference.mjs) comparée à cette base (lib/notes-de-version.mjs) ;
//   3. elle est écrite (note_version, note_version_ligne : version X.Y de la prochaine livraison, champ libre du lot), les notes d'exemple (lorem
//      ipsum) sont retirées, le journal du lot passe dans historique_modification, les tables du journal sont vidées ;
//   4. data/rows est réécrit par l'exporteur des importeurs (tools/db/exporter.py) — dans une copie d'abord : seuls les fichiers des tables que
//      le journal a touchées et ceux des notes de version peuvent changer (demande du propriétaire : aucune autre table), sinon rien n'est écrit.
// Rend (et écrit dans --resume) : { version, depuis, lignes, bilan, fichiers, markdown, conflits }.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { construireReference } from './db-reference.mjs';
import { TABLES_FICHES } from '../serveur/base-vivante.mjs';
import { chargerJournal, rejouer, TABLES_INTERDITES } from '../serveur/edition-journal.mjs';
import { lireTables } from '../serveur/notes-de-version.mjs';
import { bilan, comparerBases, versionCourte, versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import { markdownDeLaNote } from '../src/lib/notes-de-version-rendu.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));
/** Tables de la note de version, que la mise à jour écrit toujours. */
export const TABLES_DE_LA_NOTE = ['note_version', 'note_version_ligne', 'historique_modification'];

export class ErreurMiseAJour extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** Contrôle la forme d'un lot (format, identifiant, journal). */
export function verifierLot(lot) {
  if (lot?.format !== 'maverick-mise-a-jour/1') throw new ErreurMiseAJour(2, 'lot illisible (format « maverick-mise-a-jour/1 » attendu)');
  if (!/^[0-9a-f-]{36}$/.test(String(lot.id))) throw new ErreurMiseAJour(2, 'lot : identifiant invalide');
  if (lot.journal?.format !== 'maverick-edition/1' || !Array.isArray(lot.journal.lots)) throw new ErreurMiseAJour(2, 'lot : journal illisible');
  if (lot.texte !== null && lot.texte !== undefined && typeof lot.texte !== 'string') throw new ErreurMiseAJour(2, 'lot : texte invalide');
  // l'édition ne touche que les règles : ni les fiches de personnages (section 13, leur propre API), ni le journal, ni les notes de version
  const interdites = new Set([...TABLES_FICHES, ...TABLES_INTERDITES]);
  const touchees = [...new Set(lot.journal.lots.flatMap((l) => (l.modifications ?? []).map((m) => m.table)))];
  const horsRegles = touchees.filter((t) => typeof t !== 'string' || interdites.has(t));
  if (horsRegles.length) throw new ErreurMiseAJour(2, `lot : tables hors des règles (${horsRegles.join(', ')}) : refusé`);
}

const lireDossier = (dossier) => Object.fromEntries(readdirSync(dossier).map((f) => [f, readFileSync(join(dossier, f), 'utf8')]));

/**
 * Applique le lot. `rows` : data/rows à réécrire ; `reference` : la révision git de la production ; `versionDev` : la version de dev (package.json).
 * Lève ErreurMiseAJour (code 3 : conflit, 4 : table hors liste, 5 : clés étrangères, 2 : lot illisible).
 */
export function appliquerMiseAJour(lot, { rows = join(RACINE, 'data', 'rows'), reference = 'origin/master', date, versionDev } = {}) {
  verifierLot(lot);
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-mise-a-jour-'));
  try {
    const ref = construireReference({ sortie: join(tmp, 'reference.db'), ref: reference });
    if (!ref.chemin) throw new ErreurMiseAJour(6, `base de production introuvable : ${ref.raison}`);
    const chemin = join(tmp, 'dev.db');
    const construction = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-build.mjs'), '--out', chemin, '--rows', rows], { encoding: 'utf8' });
    if (construction.status !== 0) throw new Error(`data/rows ne se reconstruit pas : ${construction.stderr || construction.stdout}`);
    const version = versionDeLivraison(versionDev, ref.version);
    const depuis = ref.version ? versionCourte(ref.version) : null;
    const db = new DatabaseSync(chemin);
    let lignes;
    let touchees;
    try {
      db.exec('PRAGMA foreign_keys = OFF'); // rejouer contrôle les clés étrangères lot par lot ; contrôle complet à la fin
      db.exec('BEGIN');
      chargerJournal(db, lot.journal);
      const rejeu = rejouer(db);
      const conflits = db.prepare(`SELECT l.id AS lot, l.resume, m.detail FROM modification m JOIN modification_lot l ON l.id = m.lot_id
        WHERE m.etat = 'conflit' GROUP BY l.id ORDER BY l.fait_le`).all().map((c) => ({ ...c }));
      if (conflits.length) {
        db.exec('ROLLBACK');
        throw new ErreurMiseAJour(3, `${conflits.length} lot(s) en conflit avec dev : ${conflits.map((c) => `« ${c.resume} » (${c.detail})`).join(' ; ')}`, { conflits, rejeu });
      }
      const production = new DatabaseSync(ref.chemin, { readOnly: true });
      try {
        lignes = comparerBases(lireTables(production), lireTables(db));
      } finally {
        production.close();
      }
      // tout le journal sans conflit : réécrit par le rejeu (resté « en_attente ») ou déjà dans les règles (« integree »)
      const historique = db.prepare(`SELECT m.*, l.fait_le, l.resume FROM modification m JOIN modification_lot l ON l.id = m.lot_id
        WHERE m.etat <> 'conflit' ORDER BY l.fait_le, l.id, m.rang`).all();
      touchees = new Set(historique.map((m) => m.table_nom));
      // notes d'exemple (lorem ipsum) retirées par la première vraie mise à jour ; une note de la même version (relance) est refaite
      const remplacees = db.prepare('SELECT version FROM note_version WHERE exemple = 1 OR version = ?').all(version).map((n) => n.version);
      for (const v of remplacees) {
        db.prepare('DELETE FROM note_version_ligne WHERE version = ?').run(v);
        db.prepare('DELETE FROM historique_modification WHERE version = ?').run(v);
        db.prepare('DELETE FROM note_version WHERE version = ?').run(v);
      }
      db.prepare('INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, ?, ?, ?, ?, 0)')
        .run(version, date, depuis, lot.texte?.trim() || null, lot.id);
      const insererLigne = db.prepare(`INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties,
        table_nom, cle, colonne) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const l of lignes) {
        insererLigne.run(version, l.rang, l.domaine, l.groupe, l.entite, l.champ, l.nature, l.avant, l.apres, l.sens,
          l.parties ? JSON.stringify(l.parties) : null, l.table_nom, l.cle ? JSON.stringify(l.cle) : null, l.colonne);
      }
      const insererHistorique = db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const m of historique) insererHistorique.run(m.lot_id, m.rang, m.fait_le, m.resume, version, m.table_nom, m.cle, m.operation, m.avant, m.apres);
      db.exec('DELETE FROM modification; DELETE FROM modification_lot; DELETE FROM note_version_brouillon');
      const rompues = db.prepare('PRAGMA foreign_key_check').all();
      if (rompues.length) {
        db.exec('ROLLBACK');
        throw new ErreurMiseAJour(5, `clés étrangères rompues : ${rompues.slice(0, 5).map((r) => `${r.table} → ${r.parent}`).join(', ')}`);
      }
      db.exec('COMMIT');
    } finally {
      db.close();
    }
    // export dans une copie, puis contrôle de la liste des fichiers changés avant d'écrire data/rows
    const copie = join(tmp, 'rows');
    cpSync(rows, copie, { recursive: true });
    const exp = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), chemin, '--rows', copie], { encoding: 'utf8' });
    if (exp.status !== 0) throw new Error(`export refusé : ${exp.stderr || exp.stdout}`);
    const avant = lireDossier(rows);
    const apres = lireDossier(copie);
    const fichiers = [...new Set([...Object.keys(avant), ...Object.keys(apres)])].filter((f) => avant[f] !== apres[f]).sort();
    const permis = new Set([...touchees, ...TABLES_DE_LA_NOTE].map((t) => `${t}.sql`));
    const horsListe = fichiers.filter((f) => !permis.has(f));
    if (horsListe.length) throw new ErreurMiseAJour(4, `fichiers hors des tables de la mise à jour : ${horsListe.join(', ')}`, { fichiers, horsListe });
    for (const f of fichiers) {
      if (apres[f] === undefined) rmSync(join(rows, f));
      else writeFileSync(join(rows, f), apres[f]);
    }
    const note = { version, depuis, texte: lot.texte?.trim() || null, publiee_le: date };
    return { version, depuis, lignes: lignes.length, bilan: bilan(lignes), fichiers, markdown: markdownDeLaNote(note, lignes), conflits: [] };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
  const fichierLot = option('--lot');
  if (!fichierLot) {
    console.error('usage : node scripts/mise-a-jour-regles.mjs --lot <lot.json> [--reference origin/master] [--date AAAA-MM-JJ] [--resume <resume.json>] [--rows <dossier>]');
    process.exit(2);
  }
  const resume = option('--resume');
  try {
    const lot = JSON.parse(readFileSync(resolve(fichierLot), 'utf8'));
    const versionDev = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')).version;
    const r = appliquerMiseAJour(lot, {
      rows: option('--rows') ? resolve(option('--rows')) : undefined, reference: option('--reference', 'origin/master'),
      date: option('--date', new Date().toISOString().slice(0, 10)), versionDev,
    });
    if (resume) writeFileSync(resolve(resume), `${JSON.stringify(r, null, 2)}\n`);
    console.log(`V${r.version} (depuis V${r.depuis}) : ${r.lignes} ligne(s) dans la note ; fichiers : ${r.fichiers.join(', ') || 'aucun'}`);
  } catch (e) {
    if (resume) writeFileSync(resolve(resume), `${JSON.stringify({ erreur: e.message, code: e.code ?? 1, ...(e.details ?? {}) }, null, 2)}\n`);
    console.error(e.message);
    process.exit(e instanceof ErreurMiseAJour ? e.code : 1);
  }
}
