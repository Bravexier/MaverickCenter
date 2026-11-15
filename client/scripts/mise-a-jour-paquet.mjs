// Tire data/rows d'un PAQUET de la base source (lot 8 : serveur/paquet.mjs ; docs/serveur.md, « Mise à jour depuis la base source (lot 8) ») :
//   node scripts/mise-a-jour-paquet.mjs --paquet <paquet.db> --lot <uuid> --mode <mise-a-jour|simulation|copie> [--reference origin/master] [--resume <resume.json>]
//     [--rows <dossier>]
// Lancé par le job preparer du workflow .github/workflows/mise-a-jour.yml (scripts/mise-a-jour-github.mjs), à la place du rejeu d'un lot du journal
// (scripts/mise-a-jour-regles.mjs) quand le lot téléchargé est un paquet. Le paquet est RECONTRÔLÉ avant que data/rows ne change :
//   1. sa vue paquet_meta dit le lot et le mode attendus ; sa structure est celle de data/rows (VERSION) ; la note de version est celle de ce lot, à la version
//      que donnent dev et master (la même règle que le bot : versionDeLivraison), et une copie n'en apporte aucune ;
//   2. aucune ligne dans une table de fiches, de comptes, de groupes ni du journal (tout ce qui n'est ni du contenu ni calculé : lib/tables-de-la-base.mjs) ;
//   3. ni HTML brut ni lien non sûr AJOUTÉ par rapport à data/rows (pages, annonces, blocs : texteNonSurApresLeRejeu, la règle du rejeu et de db:appliquer-edition) ;
//   4. data/rows est réécrit depuis le paquet par l'exporteur des importeurs (tools/db/exporter.py), dans une copie d'abord : toute table de contenu changée a au
//      moins une trace NOUVELLE dans historique_modification (une ligne absente de celui de data/rows), ou en découle comme au rejeu d'un lot
//      (mise-a-jour-github.mjs#tablesDuLot, et les pages typées refaites) ; les tables des notes en sont exemptées ;
//   5. puis seuls les fichiers changés sont écrits.
// Rend (et écrit dans --resume) : { version, depuis, lignes, fichiers, markdown, tables, traces, mode }. Codes de sortie : 2 paquet refusé (forme, tables propres
// au site, note), 3 HTML brut ou lien non sûr ajouté, 4 table changée sans trace, 5 structure différente de data/rows, 6 version de la note différente.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { CLASSES_DE_TABLES, TABLES_DES_NOTES } from '../src/lib/tables-de-la-base.mjs';
import { versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import { markdownDeLaNote } from '../src/lib/notes-de-version-rendu.mjs';
import { identifiant, tablesDeLaBase } from '../serveur/empreintes.mjs';
import { FORMAT_PAQUET, MODES_DU_PAQUET, lireMetaDuPaquet } from '../serveur/paquet.mjs';
import { tablesDuLot } from './mise-a-jour-github.mjs';
import { messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { textesAvantLeRejeu, texteNonSurApresLeRejeu } from './mise-a-jour-regles.mjs';
import { colonneDerivee } from '../serveur/edition.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

export class ErreurPaquet extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const memeValeur = (a, b) => (a instanceof Uint8Array && b instanceof Uint8Array ? Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0 : (a ?? null) === (b ?? null));

/**
 * Les pages changées entre `avant` (data/rows reconstruit) et `paquet` sans trace qui les justifie (`traces` : les traces nouvelles { table_nom, cle, operation }) :
 * une page est justifiée par une trace de sa propre ligne, par le retrait d'un mot-clé (ses balises quittent tous les textes : tablesDuLot), ou — seulement pour
 * une page typée que le code refait depuis ses tables (serveur/edition.mjs#colonneDerivee : corps et résumé hors guide/ et lore/, données d'un don) — par une
 * trace d'une autre table, quand seules ces colonnes dérivées changent. Une page libre (guide, lore) changée sans trace de sa ligne est refusée. Rend les ids.
 */
export function pagesSansTrace(avant, paquet, traces) {
  const tracees = new Set(traces.filter((h) => h.table_nom === 'page').map((h) => {
    try {
      return JSON.parse(h.cle)?.id ?? null;
    } catch {
      return null;
    }
  }));
  const motCleRetire = traces.some((h) => h.table_nom === 'mot_cle' && h.operation === 'supprimer');
  const autreTable = traces.some((h) => h.table_nom !== 'page');
  const lire = (db) => new Map(db.prepare('SELECT * FROM page').all().map((p) => [p.id, p]));
  const a = lire(avant);
  const b = lire(paquet);
  const refusees = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id);
    const y = b.get(id);
    if (x && y) {
      const colonnes = Object.keys(y).filter((c) => !memeValeur(x[c], y[c]));
      if (!colonnes.length || tracees.has(id) || motCleRetire) continue;
      if (autreTable && colonnes.every((c) => colonneDerivee('page', { id }, c))) continue;
      refusees.push(id);
    } else if (!tracees.has(id)) refusees.push(id);
  }
  return refusees.sort();
}

const lireDossier = (dossier) => Object.fromEntries(readdirSync(dossier).map((f) => [f, readFileSync(join(dossier, f), 'utf8')]));

/** La version du schéma de data/rows (fichier VERSION : « schema_version=N »), null s'il ne se lit pas. */
function versionDesLignes(rows) {
  try {
    return Number(/^schema_version=(\d+)\n$/.exec(readFileSync(join(rows, 'VERSION'), 'utf8'))?.[1] ?? Number.NaN);
  } catch {
    return Number.NaN;
  }
}

/**
 * La version X.Y de la note qu'une mise à jour livre, d'après dev (client/package.json de l'arbre de travail) et master (`reference`), comme le bot
 * (lib/notes-de-version.mjs#versionDeLivraison). null si master ne se lit pas.
 */
export function versionAttendue({ racine = RACINE, reference = 'origin/master', majeure = false } = {}) {
  const dev = JSON.parse(readFileSync(join(racine, 'client', 'package.json'), 'utf8')).version;
  const r = spawnSync('git', ['show', `${reference}:client/package.json`], { cwd: racine, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return versionDeLivraison(dev, JSON.parse(r.stdout).version, { majeure });
}

/** Les tables dont le fichier de data/rows contient une balise du glossaire (« {{ ») : celles que le retrait d'un mot-clé peut réécrire (tablesDuLot). */
const tablesAvecBalises = (rows) => readdirSync(rows).filter((f) => f.endsWith('.sql') && readFileSync(join(rows, f), 'utf8').includes('{{')).map((f) => f.slice(0, -4));

/**
 * Recontrôle le paquet `chemin` et en tire data/rows (`rows`). `lot`, `mode` : ceux de l'entrée du workflow ; `version` : la version X.Y attendue de la note
 * (versionAttendue ; undefined : non vérifiée). Lève ErreurPaquet.
 */
export function appliquerPaquet(chemin, { lot, mode, rows = join(RACINE, 'data', 'rows'), version } = {}) {
  let meta;
  try {
    meta = lireMetaDuPaquet(chemin);
  } catch (e) {
    throw new ErreurPaquet(2, `paquet illisible (${e.message})`);
  }
  if (meta?.format !== FORMAT_PAQUET || meta.id !== lot || !MODES_DU_PAQUET.includes(meta.mode)) {
    throw new ErreurPaquet(2, `paquet illisible (format « ${FORMAT_PAQUET} » et identifiant du lot attendus)`);
  }
  if (meta.mode !== mode) throw new ErreurPaquet(2, `paquet de mode « ${meta.mode} », le workflow attend « ${mode} »`);
  const copie = mode === 'copie';
  if (copie ? meta.version !== null : !/^\d+\.\d+$/.test(String(meta.version))) throw new ErreurPaquet(2, 'paquet : version de la note incohérente avec son mode');
  if (!Array.isArray(meta.tables_de_contenu) || !meta.tables_de_contenu.every((t) => typeof t === 'string' && /^[a-z0-9_]+$/.test(t))) {
    throw new ErreurPaquet(2, 'paquet : liste des tables de contenu illisible');
  }
  // la structure du fichier (user_version), pas seulement celle que dit sa vue
  const lecture = new DatabaseSync(chemin, { readOnly: true });
  let structure;
  try {
    structure = lecture.prepare('PRAGMA user_version').get().user_version;
  } finally {
    lecture.close();
  }
  const schema = versionDesLignes(rows);
  if (structure !== schema || meta.schema !== structure) {
    throw new ErreurPaquet(5, `paquet de structure ${structure}, data/rows est en ${schema} : le site de dev et dev n'ont pas les mêmes migrations`);
  }
  if (!copie && version !== undefined && version !== meta.version) {
    throw new ErreurPaquet(6, `la note du paquet est la V${meta.version}, dev et master donnent la V${version} : relancer la mise à jour depuis la page`);
  }

  const tmp = mkdtempSync(join(tmpdir(), 'maverick-paquet-'));
  try {
    const paquet = new DatabaseSync(chemin, { readOnly: true });
    let note;
    let lignes = [];
    let historique;
    let nonSur;
    let pagesNonTracees = [];
    try {
      // 2. rien de propre au site (fiches, comptes, groupes, journal, brouillon) ni d'une table que le classement ne connaît pas
      const pleines = tablesDeLaBase(paquet).filter((t) => t.classe !== CLASSES_DE_TABLES.CONTENU && t.classe !== CLASSES_DE_TABLES.CALCULEE)
        .filter((t) => paquet.prepare(`SELECT count(*) AS n FROM ${identifiant(t.nom)}`).get().n > 0).map((t) => t.nom);
      if (pleines.length) throw new ErreurPaquet(2, `le paquet porte des lignes propres au site (${pleines.join(', ')}) : refusé`);
      // 1. la note : celle de ce lot à la version annoncée ; aucune pour une copie
      note = paquet.prepare('SELECT version, depuis, texte FROM note_version WHERE lot = ? AND exemple = 0').get(lot);
      if (copie && note) throw new ErreurPaquet(2, 'une copie vers le dépôt n\'apporte pas de note de version');
      if (!copie && note?.version !== meta.version) throw new ErreurPaquet(2, `le paquet n'a pas la note de version V${meta.version} de ce lot`);
      if (note) lignes = paquet.prepare('SELECT * FROM note_version_ligne WHERE version = ? ORDER BY rang').all(note.version).map((l) => ({ ...l }));
      historique = paquet.prepare('SELECT lot_id, rang, table_nom, cle, operation, avant, apres FROM historique_modification').all();
      // 3. le Markdown d'avant : data/rows reconstruit
      const avant = join(tmp, 'avant.db');
      const b = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-build.mjs'), '--out', avant, '--rows', rows], { encoding: 'utf8' });
      if (b.status !== 0) throw new Error(`data/rows ne se reconstruit pas : ${b.stderr || b.stdout}`);
      const base = new DatabaseSync(avant, { readOnly: true });
      let textes;
      try {
        textes = textesAvantLeRejeu(base);
        const anciennes = new Set(base.prepare('SELECT lot_id, rang FROM historique_modification').all().map((h) => `${h.lot_id}\u0000${h.rang}`));
        historique = historique.filter((h) => !anciennes.has(`${h.lot_id}\u0000${h.rang}`));
        pagesNonTracees = pagesSansTrace(base, paquet, historique);
      } finally {
        base.close();
      }
      nonSur = texteNonSurApresLeRejeu(paquet, textes);
    } finally {
      paquet.close();
    }
    if (nonSur) throw new ErreurPaquet(3, `paquet : ${nonSur.quoi} ${nonSur.id} : ${messageDeRefus(nonSur.fragments)}`);

    // 4. data/rows tiré du paquet, dans une copie
    const copieDesLignes = join(tmp, 'rows');
    cpSync(rows, copieDesLignes, { recursive: true });
    const exp = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), chemin, '--rows', copieDesLignes], { encoding: 'utf8' });
    if (exp.status !== 0) throw new Error(`export refusé : ${exp.stderr || exp.stdout}`);
    const avant = lireDossier(rows);
    const apres = lireDossier(copieDesLignes);
    const fichiers = [...new Set([...Object.keys(avant), ...Object.keys(apres)])].filter((f) => avant[f] !== apres[f]).sort();
    const autres = fichiers.filter((f) => !/^[a-z0-9_]+\.sql$/.test(f));
    if (autres.length) throw new ErreurPaquet(2, `fichiers de data/rows inattendus : ${autres.join(', ')}`);
    const tables = fichiers.map((f) => f.slice(0, -4));
    const horsContenu = tables.filter((t) => !meta.tables_de_contenu.includes(t));
    if (horsContenu.length) throw new ErreurPaquet(2, `tables hors du contenu changées : ${horsContenu.join(', ')}`);
    // toute table changée a une trace nouvelle (ou en découle comme au rejeu d'un lot : tablesDuLot) ; la table des pages, page par page (pagesSansTrace : une
    // page typée refaite depuis ses tables est admise, une page libre jamais sans la trace de sa ligne)
    const pseudo = { journal: { lots: [{ modifications: historique.map((h) => ({ table: h.table_nom, operation: h.operation, avant: JSON.parse(h.avant ?? 'null'), apres: JSON.parse(h.apres ?? 'null') })) }] } };
    const tracees = new Set([...tablesDuLot(pseudo, { tablesAvecBalises: () => tablesAvecBalises(rows) }), ...TABLES_DES_NOTES, 'page']);
    const sansTrace = [...tables.filter((t) => !tracees.has(t)), ...(tables.includes('page') && pagesNonTracees.length ? ['page'] : [])].sort();
    if (sansTrace.length) {
      const pages = sansTrace.includes('page') ? ` (pages : ${pagesNonTracees.slice(0, 10).join(', ')}${pagesNonTracees.length > 10 ? '…' : ''})` : '';
      throw new ErreurPaquet(4, `tables changées sans trace nouvelle dans historique_modification : ${sansTrace.join(', ')}${pages} (toute modification du contenu passe par le journal du site de dev)`,
        { sansTrace, pages: pagesNonTracees });
    }
    // 5. seuls les fichiers changés
    for (const f of fichiers) {
      if (apres[f] === undefined) rmSync(join(rows, f));
      else writeFileSync(join(rows, f), apres[f]);
    }
    const markdown = note ? markdownDeLaNote({ version: note.version, depuis: note.depuis, texte: note.texte }, lignes) : '';
    return { mode, version: note?.version ?? null, depuis: note?.depuis ?? null, lignes: lignes.length, fichiers, markdown, tables, traces: historique.length };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
  const fichier = option('--paquet');
  const resume = option('--resume');
  if (!fichier || !option('--lot') || !option('--mode')) {
    console.error('usage : node scripts/mise-a-jour-paquet.mjs --paquet <paquet.db> --lot <uuid> --mode <mise-a-jour|simulation|copie> [--reference origin/master] [--resume <resume.json>] [--rows <dossier>]');
    process.exit(2);
  }
  try {
    const chemin = resolve(fichier);
    const meta = lireMetaDuPaquet(chemin);
    const version = option('--mode') === 'copie' ? undefined : versionAttendue({ reference: option('--reference', 'origin/master'), majeure: meta?.majeure === true });
    if (version === null) throw new ErreurPaquet(6, 'la version de master ne se lit pas (git show) : la version de la note ne peut pas être vérifiée');
    const r = appliquerPaquet(chemin, { lot: option('--lot'), mode: option('--mode'), rows: option('--rows') ? resolve(option('--rows')) : undefined, version });
    if (resume) writeFileSync(resolve(resume), `${JSON.stringify(r, null, 2)}\n`);
    console.log(`${r.version ? `V${r.version}` : 'copie'} : ${r.lignes} ligne(s) dans la note, ${r.traces} trace(s) nouvelle(s) ; fichiers : ${r.fichiers.join(', ') || 'aucun'}`);
  } catch (e) {
    if (resume) writeFileSync(resolve(resume), `${JSON.stringify({ erreur: e.message, code: e.code ?? 1, ...(e.details ?? {}) }, null, 2)}\n`);
    console.error(e.message);
    process.exit(e instanceof ErreurPaquet ? e.code : 1);
  }
}
