// Le paquet de la base source (lot 8 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md, garde-fous 4, 8, 9, 10 ;
// R274, R275 ; docs/serveur.md, « Mise à jour depuis la base source (lot 8) »). Seulement avec le marqueur db/source (serveur/base-source.mjs) : sans lui,
// « Effectuer la mise à jour » fige toujours un lot du journal (serveur/notes-de-version.mjs#figerLot), rejoué par GitHub.
//
// Avec lui, « Effectuer la mise à jour », « Simulation de mise à jour » et « Copier vers le dépôt » figent un PAQUET : un fichier SQLite neuf tiré de la
// base source comme l'extrait (serveur/extrait.mjs : sans fiche, compte, groupe ni journal ; les modifications en attente versées dans
// historique_modification, avec leur nature), où le service écrit
//   - pour une mise à jour (ou sa simulation) : la note de version de la prochaine version X.Y (X+1.0 case « Version majeure » cochée ; la même règle que
//     l'ancien circuit : la production comparée au contenu du paquet, lib/notes-de-version.mjs#comparerBases), son champ libre, et la version de cette note
//     sur les lignes d'historique qu'il verse ; les notes d'exemple retirées ;
//   - pour une copie vers le dépôt : rien de plus (les modifications versées gardent une version vide, comme `npm run db:appliquer-edition` ; elles restent
//     en attente dans la base source, pour la prochaine note).
// Une vue `paquet_meta` dit ce qu'il est (format, lot, mode, version, tables de contenu…). La base source N'EST PAS modifiée (garde-fou 8 : « préparée, pas
// livrée »). Avant l'envoi, le paquet est comparé à l'attestation de la production : un élément de règle que des fiches citent et qui manque au paquet le fait
// refuser (question 9 du plan, réponse par défaut « refuser avant l'envoi ») — sauf ce que la décision R42 retire des fiches sans bloquer
// (serveur/fiches-retraits.mjs#RETRAITS) ; une attestation absente, ou qui ne décrit pas le contenu publié par la production, aussi.
//
// Le paquet est servi tel quel à /api/mise-a-jour/lots/<lot>/ (serveur/notes-de-version.mjs#lireLot), son empreinte part avec le workflow
// mise-a-jour.yml, qui le recontrôle et en tire data/rows (scripts/mise-a-jour-paquet.mjs). Quand la production publie la note de ce lot, le service la
// reporte dans sa base avec l'historique du paquet, d'une transaction, une seule fois (reporterPaquet), et sort du journal en attente ce qui a été livré.
// Node seulement (node:…), sans dépendance.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { installerLePlan } from '../src/lib/livres.mjs';
import { comparerBases, versionCourte } from '../src/lib/notes-de-version.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
import { CLASSES_DE_TABLES } from '../src/lib/tables-de-la-base.mjs';
import { etatDeLaProduction, lireAttestation } from './attestation.mjs';
import { FICHIER_BASE, integrerLivrees, viderBrouillonLivre } from './base-vivante.mjs';
import { colonnesDeLaTable, empreintesDuContenu, identifiant, tablesDeLaBase } from './empreintes.mjs';
import { fabriquerExtrait } from './extrait.mjs';
import { RETRAITS } from './fiches-retraits.mjs';
import { instant as ecrireInstant } from './instant.mjs';
import {
  actualiserLancement, CONFIRMATION, controlerLeLancement, dossierDesLots, ecrireLancement, ErreurNotes, fichierPaquet, lireBrouillon, lireLancement,
  lireTables, LIMITES_DES_LANCEMENTS, modifierLancement,
} from './notes-de-version.mjs';

export const FORMAT_PAQUET = 'maverick-paquet/1';
/** La vue qui décrit le paquet (une ligne). */
export const VUE_DU_PAQUET = 'paquet_meta';
/** Les trois usages d'un paquet : la mise à jour (livrée en production), sa simulation (rien n'est poussé), la copie vers le dépôt (dev seulement). */
export const MODES_DU_PAQUET = Object.freeze(['mise-a-jour', 'simulation', 'copie']);
/** Le mot à taper pour « Copier vers le dépôt » (celui de la mise à jour reste CONFIRMATION). */
export const CONFIRMATION_COPIE = 'COPIER VERS LE DEPOT';
/** Les tables de règles qu'une suppression retire des fiches sans bloquer la production (décision R42 et suivantes : serveur/fiches-retraits.mjs#RETRAITS). */
export const TABLES_RETIREES_DES_FICHES = Object.freeze([...new Set(RETRAITS.map((r) => r.vise))].sort());
/** Les débuts de fichier d'un paquet (SQLite) : le workflow s'en sert pour distinguer un paquet d'un lot figé (JSON). */
export const ENTETE_SQLITE = 'SQLite format 3\0';

const sha256 = (donnees) => createHash('sha256').update(donnees).digest('hex');
const texteSql = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const SUFFIXE_NEUF = '.neuf';

/**
 * Fabrique le paquet `destination` d'après la base source `source` (un fichier neuf : fabriquerExtrait, puis la note et la vue `paquet_meta`). Rend son méta :
 * { format, id, mode, version, depuis, lots, modifications, lignes, tables_de_contenu, empreinte, fichier: { octets, sha256 }, duree_ms }.
 * @param {{ source: string, destination: string, production?: string | null, id: string, mode: string, version?: string | null, depuis?: string | null,
 *   date?: string, texte?: string | null, majeure?: boolean, versionDuSite?: string | null, instant?: Date }} o `production` : la base publiée par la production
 *   (référence de la note ; inutile à une copie) ; `date` : AAAA-MM-JJ de la note.
 */
export function fabriquerPaquet(o) {
  const t0 = performance.now();
  if (!MODES_DU_PAQUET.includes(o.mode)) throw new Error(`mode de paquet inconnu : ${o.mode}`);
  const avecNote = o.mode !== 'copie';
  if (avecNote && !/^\d+\.\d+$/.test(String(o.version))) throw new Error('version X.Y attendue pour la note du paquet');
  if (avecNote && (!o.production || !existsSync(o.production))) throw new Error('la base de la production (référence de la note) est introuvable');
  const instant = o.instant ?? new Date();
  // le fichier neuf, les tables propres au site vides, les modifications en attente versées (version NULL, sans auteur, avec leur nature)
  const extrait = fabriquerExtrait({ source: o.source, destination: o.destination, version: o.versionDuSite ?? null, instant });
  const db = new DatabaseSync(o.destination);
  let meta;
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('DROP VIEW IF EXISTS extrait_meta');
    // les lots versés par la fabrication : dans l'historique du paquet, pas dans celui de la base source
    db.exec(`ATTACH DATABASE '${pathToFileURL(o.source).href.replace(/'/g, "''")}?mode=ro' AS src`);
    let lots;
    try {
      lots = db.prepare(`SELECT DISTINCT h.lot_id AS lot FROM main.historique_modification h
        WHERE NOT EXISTS (SELECT 1 FROM src.historique_modification s WHERE s.lot_id = h.lot_id) ORDER BY h.lot_id`).all().map((l) => l.lot);
    } finally {
      db.exec('DETACH DATABASE src');
    }
    const modifications = db.prepare('SELECT count(*) AS n FROM historique_modification WHERE lot_id IN (SELECT value FROM json_each(?))').get(JSON.stringify(lots)).n;
    let lignes = 0;
    if (avecNote) {
      db.exec('BEGIN');
      try {
        const deja = db.prepare('SELECT lot FROM note_version WHERE version = ? AND exemple = 0').get(o.version);
        if (deja) throw new ErreurNotes(409, `La V${o.version} a déjà une note de version (lot ${deja.lot ?? 'inconnu'}) dans la base : rien n’est préparé.`);
        // les notes d'exemple (lorem ipsum) : retirées par la première vraie mise à jour (ou sa simulation, qui fait tout pareil)
        for (const { version } of db.prepare('SELECT version FROM note_version WHERE exemple = 1').all()) {
          for (const t of ['note_version_ligne', 'historique_modification', 'note_version']) db.prepare(`DELETE FROM ${t} WHERE version = ?`).run(version);
        }
        db.prepare('INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, ?, ?, ?, ?, 0)')
          .run(o.version, o.date ?? ecrireInstant(instant).slice(0, 10), o.depuis ?? null, o.texte?.trim() || null, o.id);
        // la note : la production comparée au contenu du paquet, les pages du guide rangées par le plan des Règles du paquet (R184, R185)
        const production = new DatabaseSync(o.production, { readOnly: true });
        let calculees;
        try {
          installerLePlan(chargerPlanDesRegles(db));
          calculees = comparerBases(lireTables(production), lireTables(db));
        } finally {
          production.close();
        }
        const inserer = db.prepare(`INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties,
          table_nom, cle, colonne) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const l of calculees) {
          inserer.run(o.version, l.rang, l.domaine, l.groupe, l.entite, l.champ, l.nature, l.avant, l.apres, l.sens, l.parties ? JSON.stringify(l.parties) : null,
            l.table_nom, l.cle ? JSON.stringify(l.cle) : null, l.colonne);
        }
        lignes = calculees.length;
        // l'historique que ce paquet verse est livré par cette note
        db.prepare('UPDATE historique_modification SET version = ? WHERE version IS NULL AND lot_id IN (SELECT value FROM json_each(?))').run(o.version, JSON.stringify(lots));
        const rompues = db.prepare('PRAGMA foreign_key_check').all();
        if (rompues.length) throw new Error(`clés étrangères rompues dans le paquet : ${rompues.slice(0, 5).map((r) => `${r.table} → ${r.parent}`).join(', ')}`);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }
    const tablesDeContenu = tablesDeLaBase(db).filter((t) => t.classe === CLASSES_DE_TABLES.CONTENU).map((t) => t.nom);
    const empreintes = empreintesDuContenu(db);
    const fabriqueLe = ecrireInstant(instant);
    meta = {
      format: FORMAT_PAQUET, id: o.id, mode: o.mode, version: avecNote ? o.version : null, depuis: avecNote ? (o.depuis ?? null) : null,
      majeure: avecNote && o.majeure === true, fabrique_le: fabriqueLe, version_du_site: o.versionDuSite ?? null, schema: extrait.schema,
      empreinte: empreintes.global, lots, modifications, lignes, tables_de_contenu: tablesDeContenu,
    };
    db.exec(`CREATE VIEW ${VUE_DU_PAQUET} AS SELECT ${texteSql(meta.format)} AS format, ${texteSql(meta.id)} AS id, ${texteSql(meta.mode)} AS mode,
      ${texteSql(meta.version)} AS version, ${texteSql(meta.depuis)} AS depuis, ${meta.majeure ? 1 : 0} AS majeure, ${texteSql(fabriqueLe)} AS fabrique_le,
      ${texteSql(meta.version_du_site)} AS version_du_site, ${Number(meta.schema)} AS schema, ${texteSql(meta.empreinte)} AS empreinte,
      ${texteSql(JSON.stringify(lots))} AS lots, ${Number(modifications)} AS modifications, ${Number(lignes)} AS lignes,
      ${texteSql(JSON.stringify(tablesDeContenu))} AS tables_de_contenu`);
    if (db.prepare('PRAGMA freelist_count').get().freelist_count > 0) db.exec('VACUUM');
  } finally {
    db.close();
  }
  const octets = readFileSync(o.destination);
  return { ...meta, fichier: { octets: octets.length, sha256: sha256(octets) }, duree_ms: Math.round(performance.now() - t0) };
}

// Le même module sert de fil de travail : la fabrication ne bloque pas le service (comme l'extrait)
if (!isMainThread && workerData?.maverickPaquet) {
  try {
    parentPort.postMessage({ meta: fabriquerPaquet(workerData.maverickPaquet) });
  } catch (e) {
    parentPort.postMessage({ erreur: String(e?.message ?? e), statut: e instanceof ErreurNotes ? e.statut : null });
  }
}

/** Fabrique le paquet dans un fil à part : une promesse du méta. */
export function fabriquerPaquetEnArrierePlan(options) {
  return new Promise((ok, ko) => {
    const fil = new Worker(fileURLToPath(import.meta.url), { workerData: { maverickPaquet: { ...options, instant: options.instant ?? new Date() } } });
    let reponse = null;
    fil.once('message', (m) => { reponse = m; });
    fil.once('error', ko);
    fil.once('exit', (code) => {
      if (reponse?.meta) ok(reponse.meta);
      else if (reponse?.statut) ko(new ErreurNotes(reponse.statut, reponse.erreur));
      else ko(new Error(reponse?.erreur ?? `le fil du paquet s’est arrêté (code ${code})`));
    });
  });
}

/** Le méta d'un paquet (sa vue `paquet_meta`), lu en lecture seule ; null s'il n'en a pas. Les listes (lots, tables) sont rendues décodées. */
export function lireMetaDuPaquet(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'view' AND name = ?").get(VUE_DU_PAQUET)) return null;
    const m = { ...db.prepare(`SELECT * FROM ${VUE_DU_PAQUET}`).get() };
    return { ...m, majeure: m.majeure === 1, lots: JSON.parse(m.lots), tables_de_contenu: JSON.parse(m.tables_de_contenu) };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Refus avant l'envoi : les éléments que des fiches de la production citent
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les éléments cités par des fiches de la production (attestation : [{ table, id, fiches }]) qui manquent au paquet `db`, hors ceux que la décision R42 retire
 * des fiches sans bloquer (TABLES_RETIREES_DES_FICHES). Un élément se cherche par les colonnes que visent les clés étrangères des tables de fiches du paquet
 * (vides, mais leur structure y est), dans l'ordre de la clé ; un id composé est « a+b » (serveur/attestation.mjs#citationsDesFiches).
 * Rend { elements, fiches, tables: [{ table, elements, fiches }] } — `fiches` additionne les fiches de chaque élément (une fiche qui cite deux éléments
 * manquants compte deux fois) ; jamais un nom de fiche, ni un identifiant d'élément.
 */
export function citationsManquantes(db, citations) {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name));
  const cleDe = (table) => colonnesDeLaTable(db, table).filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.nom);
  // table visée → les listes de colonnes que les fiches y visent
  const visees = new Map();
  for (const fiche of TABLES_FICHES) {
    if (!tables.has(fiche)) continue;
    const liaisons = new Map();
    for (const f of db.prepare(`PRAGMA foreign_key_list(${identifiant(fiche)})`).all()) {
      if (!liaisons.has(f.id)) liaisons.set(f.id, []);
      liaisons.get(f.id).push(f);
    }
    for (const liaison of liaisons.values()) {
      liaison.sort((a, b) => a.seq - b.seq);
      const cible = liaison[0].table;
      if (!tables.has(cible)) continue;
      const colonnes = liaison.some((f) => f.to === null) ? cleDe(cible) : liaison.map((f) => f.to);
      if (!visees.has(cible)) visees.set(cible, new Map());
      visees.get(cible).set(colonnes.join(','), colonnes);
    }
  }
  const presents = new Map(); // `${table}|${colonnes}` → Set des ids
  const ensemble = (table, colonnes) => {
    const cle = `${table}|${colonnes.join(',')}`;
    if (!presents.has(cle)) {
      const valeur = colonnes.map((c) => `CAST(${identifiant(c)} AS TEXT)`).join(" || '+' || ");
      presents.set(cle, new Set(db.prepare(`SELECT ${valeur} AS k FROM ${identifiant(table)}`).all().map((l) => l.k)));
    }
    return presents.get(cle);
  };
  const parTable = new Map();
  for (const c of Array.isArray(citations) ? citations : []) {
    if (!c || typeof c.table !== 'string' || TABLES_RETIREES_DES_FICHES.includes(c.table)) continue;
    const id = String(c.id);
    let present = false;
    if (tables.has(c.table) && /^[A-Za-z0-9_]+$/.test(c.table)) {
      const variantes = visees.has(c.table) ? [...visees.get(c.table).values()] : [cleDe(c.table)];
      const parties = id.split('+').length;
      present = variantes.some((colonnes) => colonnes.length === parties && ensemble(c.table, colonnes).has(id))
        // un id simple qui contient « + » : la clé entière, d'un seul morceau
        || variantes.some((colonnes) => colonnes.length === 1 && ensemble(c.table, colonnes).has(id));
    }
    if (present) continue;
    const t = parTable.get(c.table) ?? { table: c.table, elements: 0, fiches: 0 };
    t.elements += 1;
    t.fiches += Math.max(0, Math.trunc(Number(c.fiches) || 0));
    parTable.set(c.table, t);
  }
  const liste = [...parTable.values()].sort((a, b) => (a.table < b.table ? -1 : 1));
  return { elements: liste.reduce((n, t) => n + t.elements, 0), fiches: liste.reduce((n, t) => n + t.fiches, 0), tables: liste };
}

/** Le message d'un refus pour des fiches (des nombres et des noms de tables, jamais un nom de fiche). */
export const messageDesCitations = (m) => `Refusé avant l’envoi : ${m.elements} élément(s) de règle que des fiches de la production utilisent manquent au contenu `
  + `(${m.tables.map((t) => `${t.table} : ${t.elements} élément(s), ${t.fiches} fiche(s)`).join(' ; ')}). Remettez-les sur le site de dev, ou faites corriger `
  + 'ces fiches, puis relancez (question 9 du plan : sans réponse, la mise à jour est refusée).';

/**
 * L'attestation de la production, si elle permet de juger le paquet : { attestation } quand elle décrit le contenu que la production publie
 * (etatDeLaProduction : `a_jour`) ; sinon { refus: { raison: 'attestation', etat, message } } — absente, illisible, ou périmée (la production n'a pas appliqué
 * sa dernière mise à jour, ou la livraison est en cours).
 */
export function attestationUtilisable({ attestations = null, production = null, propre = null, instant = new Date() } = {}) {
  const etat = etatDeLaProduction({ dossier: attestations, production, propre, instant });
  const lue = attestations ? lireAttestation(attestations) : { raison: 'absente' };
  if (etat.etat === 'a_jour' && lue.attestation) return { attestation: lue.attestation };
  const message = `Refusé avant l’envoi : l’attestation de la production ne permet pas de vérifier les fiches (${etat.message})`;
  return { refus: { raison: 'attestation', etat: etat.etat, raison_production: etat.raison, message } };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Figer un paquet (« Effectuer la mise à jour », sa simulation, « Copier vers le dépôt »)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const enFabrication = new Set(); // dossiers dont un paquet est en cours : un seul à la fois

/** Retire les paquets à moitié faits qu'un arrêt a laissés (`.<id>.db.neuf`). */
function purgerLesPaquetsNeufs(dossierLots) {
  if (!existsSync(dossierLots)) return;
  for (const f of readdirSync(dossierLots)) if (f.startsWith('.') && f.endsWith(SUFFIXE_NEUF)) rmSync(join(dossierLots, f), { force: true });
}

/**
 * Fige un paquet et note le lancement (états et verrous de figerLot : `envoi` ou `manuel`, brouillon tenu pour une mise à jour et sa simulation, jamais pour une
 * copie). Une promesse de l'état du lancement ; lève une ErreurNotes (400, 409, 429, 500), `details.refus` pour un refus avant l'envoi (attestation, citations).
 * La base source n'est jamais écrite, sauf `note_version_brouillon.lot` (le verrou du texte), posé quand le paquet est prêt.
 * @param {import('node:sqlite').DatabaseSync} db la base source
 * @param {string} dossier le dossier de la base source (le paquet est rangé dans <dossier>/mise-a-jour/<lot>.db)
 * @param {{ mode: string, versionDev?: string | null, versionCible?: string | null, instant: string, confirmation?: string, adresse?: string, etat?: string,
 *   aLivrer?: number | null, limites?: object, reference?: object, production?: { attestations?: string | null, production?: string | null, propre?: string | null },
 *   enArrierePlan?: boolean }} o `reference` : lireReference(…) ; `production` : de quoi lire l'attestation (etatDeLaProduction).
 */
export async function figerPaquet(db, dossier, { mode, versionDev = null, versionCible = null, instant, confirmation, adresse, etat = 'envoi', aLivrer = null,
  limites = LIMITES_DES_LANCEMENTS, reference = null, production = {}, enArrierePlan = true }) {
  if (!MODES_DU_PAQUET.includes(mode)) throw new ErreurNotes(400, 'Mode de paquet inconnu.');
  if (enFabrication.has(dossier)) throw new ErreurNotes(409, 'Un paquet est déjà en préparation : attendez qu’il soit prêt.');
  const copie = mode === 'copie';
  const simulation = mode === 'simulation';
  const { recents } = controlerLeLancement(db, dossier, {
    instant, confirmation, adresse, simulation, aLivrer, limites, attendue: copie ? CONFIRMATION_COPIE : CONFIRMATION, rienARefuser: !copie,
  });
  if (!copie && !(reference?.disponible && reference.chemin)) {
    throw new ErreurNotes(409, `La note de version se calcule contre la production, qui n’est pas lisible${reference?.raison ? ` (${reference.raison})` : ''} : rien n’est préparé.`);
  }
  if (!copie && !/^\d+\.\d+$/.test(String(versionCible))) throw new ErreurNotes(409, 'Version en préparation inconnue : rechargez la page.');
  // l'attestation d'abord (rien n'est fabriqué si elle ne permet pas de juger)
  const lue = attestationUtilisable({ ...production, instant: new Date(instant) });
  if (lue.refus) throw new ErreurNotes(409, lue.refus.message, { refus: lue.refus });
  const brouillon = lireBrouillon(db);
  enFabrication.add(dossier);
  const lots = dossierDesLots(dossier);
  const id = randomUUID();
  const neuf = join(lots, `.${id}.db${SUFFIXE_NEUF}`);
  try {
    mkdirSync(lots, { recursive: true });
    purgerLesPaquetsNeufs(lots);
    const options = {
      source: join(dossier, FICHIER_BASE), destination: neuf, production: copie ? null : reference.chemin, id, mode, version: copie ? null : versionCible,
      depuis: !copie && reference.version ? versionCourte(reference.version) : null, date: String(instant).slice(0, 10), texte: copie ? null : brouillon.texte,
      majeure: !copie && brouillon.majeure, versionDuSite: versionDev, instant: new Date(instant),
    };
    const meta = enArrierePlan ? await fabriquerPaquetEnArrierePlan(options) : fabriquerPaquet(options);
    // le refus avant l'envoi : un élément cité par des fiches de la production absent du paquet
    const lecture = new DatabaseSync(neuf, { readOnly: true });
    let manquants;
    try {
      manquants = citationsManquantes(lecture, lue.attestation.citations);
    } finally {
      lecture.close();
    }
    if (manquants.elements) {
      const refus = { raison: 'citations', ...manquants };
      throw new ErreurNotes(409, messageDesCitations(manquants), { refus });
    }
    // le texte et la case « Version majeure » sont ceux qui sont partis dans la note (changés pendant la fabrication : on recommence)
    const maintenant = lireBrouillon(db);
    if (!copie && (maintenant.lot || maintenant.texte !== brouillon.texte || maintenant.majeure !== brouillon.majeure)) {
      throw new ErreurNotes(409, 'Le texte de la note ou la case « Version majeure » a changé pendant la préparation du paquet : rechargez la page et relancez.');
    }
    renameSync(neuf, fichierPaquet(dossier, id));
    try {
      purgerLesPaquets(db, dossier);
    } catch {
      // le ménage n'empêche jamais un lancement
    }
    if (!copie) {
      db.prepare(`INSERT INTO note_version_brouillon (id, texte, modifie_le, lot) VALUES (1, NULL, NULL, ?)
                  ON CONFLICT (id) DO UPDATE SET lot = excluded.lot`).run(id);
    }
    return ecrireLancement(dossier, {
      lot: id, empreinte: meta.fichier.sha256, lance_le: instant, version_cible: copie ? null : versionCible, majeure: !copie && brouillon.majeure,
      modifications: meta.modifications, adresse: `${adresse}/api/mise-a-jour/lots/${id}/`, etat, simulation, copie, paquet: true, mode,
      octets: meta.fichier.octets, lignes: meta.lignes, run: null, erreur: null, suivi_le: null, lancements_recents: recents,
    });
  } finally {
    rmSync(neuf, { force: true });
    enFabrication.delete(dossier);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Après la confirmation de la production : la note et l'historique reportés dans la base source
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * La production publie-t-elle la note du lot `lot` ? `reference` : lireReference(…). La base publiée par la production fait foi ; la copie de master
 * (repli) seulement quand la production n'est pas configurée sur ce site (sans `raison`) : une production configurée mais illisible fait attendre.
 */
export function noteLivree(reference, lot) {
  if (!reference?.disponible || !reference.chemin) return null;
  if (reference.source !== 'production' && reference.raison) return null;
  try {
    const db = new DatabaseSync(reference.chemin, { readOnly: true });
    try {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'note_version'").get()) return null;
      return db.prepare('SELECT version FROM note_version WHERE lot = ? AND exemple = 0').get(lot)?.version ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/**
 * Reporte dans la base source `db` la note de version du paquet `chemin` (lot `lot`), ses lignes et l'historique qu'il a livré, d'une transaction : les
 * notes d'exemple retirées, les modifications livrées sorties du journal en attente (integrerLivrees : `integree`), le brouillon de ce lot vidé
 * (viderBrouillonLivre). Idempotent : une note déjà là (un redémarrage entre le report et l'état) n'est pas réécrite. Refusé (Error, rien d'écrit) quand la base n'a pas
 * un lot que le paquet a versé dans l'historique, ni dans son journal ni dans sa trace : une base restaurée plus ancienne que le paquet. Rend { version, deja, historique, integrees }.
 */
export function reporterPaquet(db, chemin, { lot }) {
  const paquet = new DatabaseSync(chemin, { readOnly: true });
  let note;
  let lignes;
  let historique;
  try {
    note = paquet.prepare('SELECT version, publiee_le, depuis, texte, lot FROM note_version WHERE lot = ? AND exemple = 0').get(lot);
    if (!note) throw new Error(`le paquet ${lot} n’a pas de note de version`);
    lignes = paquet.prepare(`SELECT version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle, colonne
      FROM note_version_ligne WHERE version = ? ORDER BY rang`).all(note.version);
    historique = paquet.prepare(`SELECT lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres, nature, decision
      FROM historique_modification WHERE version = ? ORDER BY lot_id, rang`).all(note.version);
  } finally {
    paquet.close();
  }
  db.exec('BEGIN');
  try {
    const deja = Boolean(db.prepare('SELECT 1 FROM note_version WHERE lot = ? AND exemple = 0').get(lot));
    if (!deja) {
      // la base porte-t-elle le contenu du paquet ? Chaque lot qu'il a versé dans l'historique venait du journal de cette base (fabriquerPaquet) : une base
      // qui n'a ni ce lot dans son journal ni sa trace est plus ancienne que le paquet (une restauration). Reporter la note y dirait livré un contenu absent.
      const connu = db.prepare('SELECT EXISTS (SELECT 1 FROM modification_lot WHERE id = ?) OR EXISTS (SELECT 1 FROM historique_modification WHERE lot_id = ?) AS ok');
      const manquants = [...new Set(historique.map((h) => h.lot_id))].filter((id) => !connu.get(id, id).ok);
      if (manquants.length) {
        throw new Error(`la base n’a pas ${manquants.length} lot(s) de modifications que le paquet a livrés : elle est plus ancienne que lui (une restauration ?) ; rien n’est reporté. `
          + 'Son contenu est à refaire sur le site de dev, sa note dit quoi (docs/serveur.md, « Restauration de la base du site de dev »)');
      }
      const autre = db.prepare('SELECT lot FROM note_version WHERE version = ? AND exemple = 0').get(note.version);
      if (autre) throw new Error(`la V${note.version} a déjà une note de version d’un autre lot (${autre.lot ?? 'inconnu'}) dans la base`);
      for (const { version } of db.prepare('SELECT version FROM note_version WHERE exemple = 1').all()) {
        for (const t of ['note_version_ligne', 'historique_modification', 'note_version']) db.prepare(`DELETE FROM ${t} WHERE version = ?`).run(version);
      }
      db.prepare('INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES (?, ?, ?, ?, ?, 0)')
        .run(note.version, note.publiee_le, note.depuis, note.texte, note.lot);
      const ligne = db.prepare(`INSERT INTO note_version_ligne (version, rang, domaine, groupe, entite, champ, nature, avant, apres, sens, parties, table_nom, cle,
        colonne) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const l of lignes) ligne.run(l.version, l.rang, l.domaine, l.groupe, l.entite, l.champ, l.nature, l.avant, l.apres, l.sens, l.parties, l.table_nom, l.cle, l.colonne);
      // une ligne déjà là sans version (versée à la main avant la bascule) prend celle de la note qui l'a livrée
      const trace = db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres, nature, decision)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (lot_id, rang) DO UPDATE SET version = excluded.version WHERE historique_modification.version IS NULL`);
      for (const h of historique) trace.run(h.lot_id, h.rang, h.fait_le, h.resume, h.version, h.table_nom, h.cle, h.operation, h.avant, h.apres, h.nature, h.decision);
    }
    const integrees = integrerLivrees(db);
    viderBrouillonLivre(db);
    db.exec('COMMIT');
    return { version: note.version, deja, historique: historique.length, integrees };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const PAQUET_EN_JEU = /^[0-9a-f-]{36}\.db$/;

/** Les paquets rangés (ni retirés, ni à moitié faits) dont la note n'est pas dans la base source : ceux qu'un report attend peut-être. */
function paquetsNonReportes(db, dossier) {
  const lots = dossierDesLots(dossier);
  if (!existsSync(lots)) return [];
  const dejaLa = db.prepare('SELECT 1 FROM note_version WHERE lot = ? AND exemple = 0');
  return readdirSync(lots).filter((f) => PAQUET_EN_JEU.test(f)).map((f) => f.slice(0, -3)).filter((id) => !dejaLa.get(id));
}

/**
 * Le suivi d'un lancement, paquet compris (à appeler à la place de notes-de-version.mjs#actualiserLancement) : tout paquet rangé dont la production publie la
 * note (noteLivree) est d'abord reporté dans la base source (reporterPaquet) — celui du lancement, ou un plus ancien que la production n'avait pas encore installé
 * quand un autre lancement a pris la place ; le lancement d'un paquet reporté passe « terminé ». Un lot figé, une simulation ou une copie suivent les règles
 * d'avant (une copie se termine avec son run et n'écrit rien dans la base source). Un report qui échoue garde l'état et dit l'erreur (`erreur_report`) ; il est
 * retenté au prochain suivi. Rend l'état du lancement.
 */
export function actualiser(db, dossier, { reference = null, journal = () => {} } = {}) {
  const l = lireLancement(dossier);
  for (const id of paquetsNonReportes(db, dossier)) {
    if (!noteLivree(reference, id)) continue;
    try {
      const r = reporterPaquet(db, fichierPaquet(dossier, id), { lot: id });
      journal(`mise à jour : V${r.version} confirmée par la production ; note et historique reportés dans la base (${r.historique} trace(s), ${r.integrees} modification(s) livrée(s))`);
      if (l?.lot === id) {
        modifierLancement(dossier, id, null, () => ({
          etat: 'termine', version_livree: r.version, reporte_le: ecrireInstant(), erreur_report: null, report: { historique: r.historique, integrees: r.integrees, deja: r.deja },
        }));
      }
    } catch (e) {
      journal(`ERREUR mise à jour : report de la note du lot ${id} : ${e.message}`);
      if (l?.lot === id) modifierLancement(dossier, id, null, () => ({ erreur_report: String(e.message).slice(0, 300) }));
    }
  }
  const actuel = lireLancement(dossier);
  if (!actuel?.paquet || actuel.simulation || actuel.copie) return actualiserLancement(db, dossier, { reference });
  if (actuel.reporte_le) return actuel;
  // reporté, mais l'état ne le dit pas (un redémarrage entre le report et l'état) : rien n'est réécrit, le lancement est terminé
  const note = db.prepare('SELECT version FROM note_version WHERE lot = ? AND exemple = 0').get(actuel.lot);
  if (!note) return actuel;
  return modifierLancement(dossier, actuel.lot, null, (a) => ({
    etat: 'termine', version_livree: note.version, reporte_le: ecrireInstant(), erreur_report: null, report: { ...(a.report ?? {}), deja: true },
  }));
}

/** Combien de paquets garder dans db/mise-a-jour/ (les plus récents) ; un paquet de mise à jour pas encore reporté n'est jamais effacé. */
export const PAQUETS_GARDES = 3;

/** Efface les paquets au-delà des PAQUETS_GARDES plus récents, sauf un paquet de mise à jour dont la note n'est pas encore dans la base (son report l'attend). */
function purgerLesPaquets(db, dossier) {
  const lots = dossierDesLots(dossier);
  const attendus = new Set(paquetsNonReportes(db, dossier));
  const tous = readdirSync(lots).filter((f) => /^[0-9a-f-]{36}(\.[a-z]+)?\.db$/.test(f))
    .map((f) => ({ f, quand: statSync(join(lots, f)).mtimeMs })).sort((a, b) => b.quand - a.quand);
  for (const { f } of tous.slice(PAQUETS_GARDES)) {
    const id = f.slice(0, 36);
    if (PAQUET_EN_JEU.test(f) && attendus.has(id)) {
      let mode = null;
      try {
        mode = lireMetaDuPaquet(join(lots, f))?.mode ?? null;
      } catch {
        mode = null;
      }
      if (mode === 'mise-a-jour' || mode === null) continue;
    }
    rmSync(join(lots, f), { force: true });
  }
}
