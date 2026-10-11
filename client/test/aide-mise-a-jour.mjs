// Aide des tests qui appliquent un lot de mise à jour à une copie de data/rows ou écrivent une note de version dans une base tirée de data/rows.
// Convention (docs/serveur.md, « Mise à jour ») : un test qui lit data/rows doit tenir quand data/rows porte une note de version en attente de
// livraison — pendant une mise à jour (le job preparer de .github/workflows/mise-a-jour.yml lance npm test APRÈS avoir écrit la note du lot, qui
// n'est pas encore sur master), sur dev avant la livraison, et dans le job simulation-de-mise-a-jour de ci.yml. Le run 38151792080 (simulation du
// 2026-10-11) a échoué parce que des tests supposaient le contraire : refus « code 7 » d'un second lot, version « 0.2 » déjà prise.
// Rien n'est supposé de data/rows : les notes en attente et les versions prises sont lues. Module sans test (n'est pas un *.test.mjs).
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { notesEnAttente } from '../scripts/mise-a-jour-regles.mjs';
import { trierVersions } from '../src/lib/notes-de-version.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
/** data/rows du dépôt. */
export const ROWS = join(RACINE, 'data', 'rows');

/** La version de client/package.json à la révision git `ref` (HEAD : la production que ces tests donnent à scripts/mise-a-jour-regles.mjs). */
export function versionALaRevision(ref = 'HEAD') {
  const r = spawnSync('git', ['show', `${ref}:client/package.json`], { cwd: RACINE, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`client/package.json introuvable à ${ref} : ${r.stderr}`);
  return JSON.parse(r.stdout).version;
}

const modeles = new Map(); // `${rows}\0${version}` -> { rows, retirees } : préparé une fois par processus
let dossierDesModeles = null;

function preparerModele(rows, versionProduction) {
  if (!dossierDesModeles) {
    dossierDesModeles = mkdtempSync(join(tmpdir(), 'maverick-sans-note-en-attente-'));
    process.on('exit', () => rmSync(dossierDesModeles, { recursive: true, force: true }));
  }
  const dossier = mkdtempSync(join(dossierDesModeles, 'modele-'));
  const base = join(dossier, 'base.db');
  const b = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', base, '--rows', rows], { encoding: 'utf8' });
  if (b.status !== 0) throw new Error(`${rows} ne se reconstruit pas : ${b.stderr || b.stdout}`);
  const retirees = notesEnAttente(base, { versionProduction });
  if (!retirees.length) return { rows, retirees };
  // la note, ses lignes et l'historique qu'elle a livré retirés ; data/rows réécrit par l'exporteur des importeurs (seuls ces trois fichiers changent)
  const db = new DatabaseSync(base);
  try {
    for (const { version } of retirees) {
      for (const table of ['note_version_ligne', 'historique_modification', 'note_version']) db.prepare(`DELETE FROM ${table} WHERE version = ?`).run(version);
    }
  } finally {
    db.close();
  }
  const copie = join(dossier, 'rows');
  cpSync(rows, copie, { recursive: true });
  const e = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), base, '--rows', copie], { encoding: 'utf8' });
  if (e.status !== 0) throw new Error(`export refusé : ${e.stderr || e.stdout}`);
  return { rows: copie, retirees };
}

/**
 * Copie `rows` (data/rows par défaut) dans `dest` sans les notes de version qu'aucune livraison n'a apportées à la production — celles qui font
 * refuser un autre lot (scripts/mise-a-jour-regles.mjs#notesEnAttente, code 7) —, ni leurs lignes, ni l'historique qu'elles ont livré :
 * data/rows tel qu'une mise à jour le trouve quand rien n'attend sa livraison. `versionProduction` : la version de la révision que le test donne
 * pour production (`reference`). Sans note en attente, la copie est `rows` à l'octet près. Rend { rows: dest, retirees: [{ version, lot }] }.
 */
export function copieSansNoteEnAttente(dest, { rows = ROWS, versionProduction }) {
  const cle = `${rows}\0${versionProduction}`;
  if (!modeles.has(cle)) modeles.set(cle, preparerModele(rows, versionProduction));
  const modele = modeles.get(cle);
  cpSync(modele.rows, dest, { recursive: true });
  return { rows: dest, retirees: modele.retirees };
}

/**
 * Une version X.Y qu'aucune note de la base `db` ne porte, au-dessus de toutes et au moins `plancher` : la note qu'un test écrit dans une base tirée
 * de data/rows ne heurte jamais une note déjà livrée ou en attente de livraison (clé primaire note_version.version).
 */
export function versionLibre(db, plancher = '0.2') {
  const prises = db.prepare('SELECT version FROM note_version').all().map((n) => n.version);
  const haute = trierVersions([...prises, plancher])[0];
  if (!prises.includes(haute)) return haute;
  const [x, y] = haute.split('.').map(Number);
  return `${x}.${y + 1}`;
}
