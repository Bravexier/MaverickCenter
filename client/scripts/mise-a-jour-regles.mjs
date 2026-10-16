// Applique à data/rows un lot figé par « Effectuer la mise à jour » (page /mise-a-jour/ du site de dev ; serveur/notes-de-version.mjs#figerLot) :
//   node scripts/mise-a-jour-regles.mjs --lot <lot.json> [--reference origin/master] [--date AAAA-MM-JJ] [--resume <resume.json>] [--rows <dossier>]
// Lancé par le workflow .github/workflows/mise-a-jour.yml (scripts/mise-a-jour-github.mjs), sur une branche feature/… partie de dev :
//   1. une base est reconstruite depuis data/rows, le journal du lot y est rejoué (serveur/edition.mjs#rejouerLeJournal : le corps des pages
//      typées est refait depuis les tables rejouées) : un conflit arrête tout, comme du HTML brut ou un lien non sûr ajouté au Markdown d'une
//      page, d'un bloc de description de la chronologie ou d'un bloc d'un panneau de règles, dans le lot ou après le rejeu (lib/markdown-sur.mjs ;
//      ici TEXTES_EN_MARKDOWN, texteNonSurApresLeRejeu, que db:appliquer-edition emploie aussi après son rejeu) ;
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
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, ORDRE_DE_REJEU, TABLES_INTERDITES } from '../serveur/edition-journal.mjs';
import { lireTables } from '../serveur/notes-de-version.mjs';
import { journalSansImage } from '../src/lib/edition-modele.mjs';
import { fragmentsAjoutes, messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { bilan, comparerBases, TABLES_DES_NOTES, versionCourte, versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import { markdownDeLaNote } from '../src/lib/notes-de-version-rendu.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));
/** Tables de la note de version, que la mise à jour écrit toujours (section 15 de data/schema.sql). */
export const TABLES_DE_LA_NOTE = TABLES_DES_NOTES;

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
  // ni HTML brut ni lien non sûr ajouté au Markdown que le build rend tel quel (le service le refuse déjà : lib/markdown-sur.mjs) ; le lot vient du site de dev
  for (const l of lot.journal.lots) {
    for (const m of l.modifications ?? []) {
      const t = TEXTES_EN_MARKDOWN[m.table];
      if (!t || typeof m.apres?.[t.colonne] !== 'string') continue;
      const ajoutes = fragmentsAjoutes(typeof m.avant?.[t.colonne] === 'string' ? m.avant[t.colonne] : '', m.apres[t.colonne]);
      if (ajoutes.length) throw new ErreurMiseAJour(2, `lot : ${t.nom} ${t.cle(m.cle ?? m.apres)} : ${messageDeRefus(ajoutes)}`);
    }
  }
}

/**
 * Les blocs dont le texte est du Markdown que le build rend tel quel, par table : la colonne de leur parent (leur clé est parent + rang) et leur nom dans
 * un message. Les blocs de description de la chronologie (migration 0043) et ceux des panneaux de règles (migration 0056 ; le titre d'une tuile est du
 * texte simple, échappé au rendu : lib/panneaux-regles-rendu.mjs).
 */
export const BLOCS_EN_MARKDOWN = Object.freeze({
  evenement_extrait: Object.freeze({ parent: 'evenement_id', nom: 'description' }),
  panneau_regles_bloc: Object.freeze({ parent: 'panneau_id', nom: 'bloc de règles' }),
});

/**
 * Les colonnes de Markdown d'un lot, par table : le texte d'une page (guide, Codex) et celui d'un bloc (BLOCS_EN_MARKDOWN) ; `cle(cle)` : la ligne
 * nommée dans un message (« guide/bienvenue », « armes#3 »).
 */
export const TEXTES_EN_MARKDOWN = Object.freeze({
  page: { colonne: 'corps_md', nom: 'page', cle: (c) => c?.id ?? JSON.stringify(c) },
  ...Object.fromEntries(Object.entries(BLOCS_EN_MARKDOWN).map(([table, b]) => [table, { colonne: 'texte', nom: b.nom, cle: (c) => `${c?.[b.parent]}#${c?.rang}` }])),
});

/** Les textes des blocs d'une table de BLOCS_EN_MARKDOWN (Map « parent#rang » → texte ; les descriptions de la chronologie par défaut), pour blocNonSur. */
export function textesDesBlocs(db, table = 'evenement_extrait') {
  const { parent } = BLOCS_EN_MARKDOWN[table];
  return new Map(db.prepare(`SELECT "${parent}" AS parent, rang, texte FROM "${table}"`).all().map((b) => [`${b.parent}#${b.rang}`, b.texte]));
}

/** Le premier bloc de `table` dont le texte a gagné du HTML brut ou un lien non sûr depuis `avant` (textesDesBlocs) : { id, fragments } ; sinon null. */
export function blocNonSur(db, avant, table = 'evenement_extrait') {
  for (const [id, texte] of textesDesBlocs(db, table)) {
    if (avant.get(id) === texte) continue;
    const fragments = fragmentsAjoutes(avant.get(id) ?? '', texte);
    if (fragments.length) return { id, fragments };
  }
  return null;
}

/** La première page dont le corps a gagné du HTML brut ou un lien non sûr depuis `corpsAvant` (Map id → corps_md) : { id, fragments } ; sinon null. */
export function pageNonSure(db, corpsAvant) {
  for (const p of db.prepare('SELECT id, corps_md FROM page ORDER BY id').all()) {
    if (corpsAvant.get(p.id) === p.corps_md) continue;
    const fragments = fragmentsAjoutes(corpsAvant.get(p.id) ?? '', p.corps_md);
    if (fragments.length) return { id: p.id, fragments };
  }
  return null;
}

/** Le Markdown de la base avant un rejeu, pour texteNonSurApresLeRejeu : le corps des pages, le texte des blocs (BLOCS_EN_MARKDOWN). */
export const textesAvantLeRejeu = (db) => ({
  pages: new Map(db.prepare('SELECT id, corps_md FROM page').all().map((p) => [p.id, p.corps_md])),
  blocs: Object.fromEntries(Object.keys(BLOCS_EN_MARKDOWN).map((table) => [table, textesDesBlocs(db, table)])),
});

/**
 * Le premier texte (corps d'une page, puis bloc de chaque table de BLOCS_EN_MARKDOWN) qui a gagné du HTML brut ou un lien non sûr depuis `avant`
 * (textesAvantLeRejeu) : { quoi (« page », « description », « bloc de règles »), id, fragments } ; sinon null. Lu après le rejeu d'un journal : par la mise
 * à jour (appliquerMiseAJour) et par le rapatriement (scripts/db-appliquer-edition.mjs).
 */
export function texteNonSurApresLeRejeu(db, avant) {
  const page = pageNonSure(db, avant.pages);
  if (page) return { quoi: 'page', ...page };
  for (const [table, textes] of Object.entries(avant.blocs)) {
    const bloc = blocNonSur(db, textes, table);
    if (bloc) return { quoi: BLOCS_EN_MARKDOWN[table].nom, ...bloc };
  }
  return null;
}

const versionNumerique = (v) => String(v ?? '').split('.').slice(0, 2).map((n) => Number.parseInt(n, 10) || 0);
/** La version `a` (X.Y ou X.Y.Z) est-elle au moins `b` (X.Y) ? (une note de version X.Y est livrée quand master est en X.Y ou plus) */
const auMoins = (a, b) => {
  const [x1, y1] = versionNumerique(a);
  const [x2, y2] = versionNumerique(b);
  return x1 > x2 || (x1 === x2 && y1 >= y2);
};

/**
 * Les notes de version de la base `db` (ouverte, ou le chemin de son fichier) qu'aucune livraison n'a apportées à la production (`versionProduction` :
 * la version de master, X.Y.Z), hors celle du lot `lot` : une mise à jour ne les écrase jamais (code 7). Rend [{ version, lot }]. Lu aussi par
 * scripts/mise-a-jour-simulation.mjs (CI) et par les tests qui appliquent un lot à une copie de data/rows.
 */
export function notesEnAttente(db, { versionProduction = null, lot = null } = {}) {
  const base = typeof db === 'string' ? new DatabaseSync(db, { readOnly: true }) : db;
  try {
    return base.prepare('SELECT version, lot FROM note_version WHERE exemple = 0 AND lot IS NOT NULL AND (? IS NULL OR lot <> ?)').all(lot, lot)
      .map((n) => ({ version: n.version, lot: n.lot }))
      .filter((n) => !(versionProduction && auMoins(versionProduction, n.version)));
  } finally {
    if (base !== db) base.close();
  }
}

const lireDossier = (dossier) => Object.fromEntries(readdirSync(dossier).map((f) => [f, readFileSync(join(dossier, f), 'utf8')]));

/**
 * Applique le lot. `rows` : data/rows à réécrire ; `reference` : la révision git de la production ; `versionDev` : la version de dev (package.json).
 * Lève ErreurMiseAJour (code 3 : conflit, 4 : table hors liste, 5 : clés étrangères, 2 : lot illisible, 6 : production introuvable, 7 : une note de
 * version d'un AUTRE lot est dans dev sans être livrée sur master — elle ne doit jamais être écrasée : livrer d'abord ce lot).
 * Les lots du journal déjà livrés (présents dans historique_modification de dev) sont écartés du rejeu : rejoués d'après leurs valeurs, ils
 * remettraient une valeur annulée depuis (A → B → A) ; rendus dans `deja_livres`.
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
    let dejaLivres = [];
    try {
      // une note de version d'un autre lot, dans dev mais pas encore sur master (sa livraison a échoué) : on ne l'écrase jamais
      const enAttenteDeLivraison = notesEnAttente(db, { versionProduction: ref.version, lot: lot.id });
      if (enAttenteDeLivraison.length) {
        const n = enAttenteDeLivraison[0];
        throw new ErreurMiseAJour(7, `la V${n.version} du lot ${n.lot} est dans dev mais pas encore livrée sur master : relancez le run de ce lot (« Re-run all jobs » : il reprend à la livraison) ou livrez dev → master, puis relancez cette mise à jour`, { lot: n.lot, version: n.version });
      }
      // lots déjà livrés (mise à jour précédente ou rapatriement) : écartés en entier
      const livres = new Set(db.prepare('SELECT DISTINCT lot_id FROM historique_modification').all().map((h) => h.lot_id));
      dejaLivres = lot.journal.lots.filter((l) => livres.has(l.id)).map((l) => l.id);
      const journal = { ...lot.journal, lots: lot.journal.lots.filter((l) => !livres.has(l.id)) };
      const textesAvant = textesAvantLeRejeu(db);
      db.exec('PRAGMA foreign_keys = OFF'); // rejouer contrôle les clés étrangères lot par lot ; contrôle complet à la fin
      db.exec('BEGIN');
      chargerJournal(db, journal);
      const recalcul = {}; // corps des pages typées refaits depuis les tables rejouées (serveur/edition.mjs#rejouerLeJournal)
      const rejeu = rejouerLeJournal(db, recalcul);
      const conflits = db.prepare(`SELECT l.id AS lot, l.resume, m.detail FROM modification m JOIN modification_lot l ON l.id = m.lot_id
        WHERE m.etat = 'conflit' GROUP BY l.id ORDER BY l.fait_le, l.id`).all().map((c) => ({ ...c }));
      if (conflits.length) {
        db.exec('ROLLBACK');
        throw new ErreurMiseAJour(3, `${conflits.length} lot(s) en conflit avec dev : ${conflits.map((c) => `« ${c.resume} » (${c.detail})`).join(' ; ')}`, { conflits, rejeu });
      }
      // le corps de chaque page changée par le rejeu (texte du guide, ou refait depuis les tables) et le texte de chaque bloc (chronologie, panneaux de
      // règles) : ni HTML brut ni lien non sûr ajouté
      const nonSur = texteNonSurApresLeRejeu(db, textesAvant);
      if (nonSur) {
        db.exec('ROLLBACK');
        throw new ErreurMiseAJour(2, `lot : ${nonSur.quoi} ${nonSur.id} après le rejeu : ${messageDeRefus(nonSur.fragments)}`);
      }
      const production = new DatabaseSync(ref.chemin, { readOnly: true });
      try {
        lignes = comparerBases(lireTables(production), lireTables(db));
      } finally {
        production.close();
      }
      // tout le journal sans conflit : réécrit par le rejeu (resté « en_attente ») ou déjà dans les règles (« integree »)
      const historique = db.prepare(`SELECT m.*, l.fait_le, l.resume FROM modification m JOIN modification_lot l ON l.id = m.lot_id
        WHERE m.etat <> 'conflit' ORDER BY ${ORDRE_DE_REJEU}`).all();
      touchees = new Set(historique.map((m) => m.table_nom));
      if (recalcul.pages.length) touchees.add('page');
      for (const t of recalcul.tablesCompletees ?? []) touchees.add(t); // liens de règle des métiers refaits après le rejeu (décisions R33, R35)
      // notes d'exemple (lorem ipsum) retirées par la première vraie mise à jour ; la note de ce même lot (relance) est refaite — celle d'un autre
      // lot à la même version n'existe pas ici (refusé plus haut : code 7)
      const remplacees = db.prepare('SELECT version FROM note_version WHERE exemple = 1 OR (version = ? AND lot = ?)').all(version, lot.id).map((n) => n.version);
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
      // une image (portrait) n'y est que résumée : la ligne de sa table la garde
      for (const m of historique) {
        insererHistorique.run(m.lot_id, m.rang, m.fait_le, m.resume, version, m.table_nom, m.cle, m.operation, journalSansImage(m.table_nom, m.avant),
          journalSansImage(m.table_nom, m.apres));
      }
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
    return { version, depuis, lignes: lignes.length, bilan: bilan(lignes), fichiers, markdown: markdownDeLaNote(note, lignes), conflits: [], deja_livres: dejaLivres };
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
