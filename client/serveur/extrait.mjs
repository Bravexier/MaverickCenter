// L'extrait du contenu du site de dev (lot 5 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md ;
// R274, R275 (3)) : un fichier SQLite NEUF que les sessions de Claude téléchargent (GET /api/edition/extrait/, `npm run db:extrait`) pour lire le vrai
// contenu du site — les mots-clés et les textes créés sur le site compris — sans fiche, sans compte, sans journal.
//
// Fabriqué à la main, jamais par copie de la base vivante puis suppression : un fichier neuf (aucune page libre héritée) où
//   - le schéma est celui de la base vivante, tables, index et vues ;
//   - les tables de classe « contenu » (lib/tables-de-la-base.mjs : règles, notes de version, historique) sont recopiées depuis la base vivante,
//     donc avec les modifications du site ;
//   - les tables « calculées » (liens, recherche plein texte) sont recopiées telles que la base vivante les porte : le service ne les recalcule pas, elles
//     peuvent retarder sur une édition faite depuis (le contenu, lui, ne retarde jamais) ;
//   - les tables « propres au site » (fiches, comptes, groupes, journal, brouillon de la note) sont VIDES, et une table que le classement ne connaît pas
//     aussi : un contrôle refuse le fichier si l'une contient une ligne ;
//   - les modifications en attente du journal sont versées dans historique_modification, sans leur auteur (garde-fou 10 : sinon les tests prennent une
//     saisie récente pour le texte d'origine ; la même règle que `npm run db:appliquer-edition`, serveur/historique.mjs) ;
//   - une vue `extrait_meta` (format, date UTC, version du site, empreinte globale) dit d'où vient le fichier ; à côté, extrait.json garde la même chose
//     avec l'empreinte de chaque table (le même calcul que l'attestation de la production : serveur/empreintes.mjs).
//
// Il est refait une fois par changement, pas à chaque téléchargement : rangé dans <dossier de la base vivante>/extrait/, réutilisé tant que la clé de
// changement (cleDeChangement) ne bouge pas, refait au premier téléchargement qui suit, dans un fil à part (Worker) pour ne pas bloquer le service, puis
// posé par rename (extrait.db, puis extrait.json qui fait foi). La clé bouge avec la base vivante refaite, ou avec le journal de l'édition (nouveau lot,
// lot résolu, abandonné ou passé en conflit) ; jamais avec une fiche enregistrée.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { CLASSES_DE_TABLES, OMBRES_DE_RECHERCHE, TABLES_CALCULEES, TABLES_DE_RECHERCHE } from '../src/lib/tables-de-la-base.mjs';
import { FICHIER_BASE, lireEtat } from './base-vivante.mjs';
import { colonnesDeLaTable, empreintesDuContenu, identifiant, tablesDeLaBase } from './empreintes.mjs';
import { historiser } from './historique.mjs';
import { instant as ecrireInstant } from './instant.mjs';

export const DOSSIER_EXTRAIT = 'extrait';
export const FICHIER_EXTRAIT = 'extrait.db';
export const FICHIER_META = 'extrait.json';
export const FORMAT_EXTRAIT = 'maverick-extrait/1';

export class ErreurExtrait extends Error {
  /** @param {number} statut @param {string} message */
  constructor(statut, message) {
    super(message);
    this.name = 'ErreurExtrait';
    this.statut = statut;
  }
}

const sha256 = (donnees) => createHash('sha256').update(donnees).digest('hex');

/**
 * La clé de changement du contenu de la base vivante : un texte qui ne bouge qu'avec le contenu. Elle lit l'état de la base vivante (vivante.json :
 * règles, schéma, date de la dernière reconstruction), le schéma, l'état de chaque modification du journal et de chaque lot (nouvelle saisie, conflit,
 * lot résolu ou abandonné) et le nombre de lignes de l'historique et des notes ; aucune table de fiche. Quelques requêtes sur le journal (de quoi lire
 * une dizaine de milliers de lignes en quelques millisecondes), jamais le contenu.
 * @param {import('node:sqlite').DatabaseSync} db la base vivante
 * @param {string} dossier le dossier de la base vivante (vivante.json)
 */
export function cleDeChangement(db, dossier) {
  const etat = lireEtat(dossier) ?? {};
  const hachage = createHash('sha256');
  hachage.update(`${etat.regles ?? ''}|${etat.schema ?? ''}|${etat.refaite_le ?? ''}|${db.prepare('PRAGMA user_version').get().user_version}\n`);
  const lignes = (sql) => {
    for (const l of db.prepare(sql).iterate()) hachage.update(`${Object.values(l).join('|')}\n`);
    hachage.update('--\n');
  };
  lignes('SELECT lot_id, rang, etat, length(avant), length(apres), length(detail) FROM modification ORDER BY lot_id, rang');
  lignes('SELECT id, fait_le, resolu_le, resolu_par, length(resolution) FROM modification_lot ORDER BY id');
  lignes('SELECT (SELECT count(*) FROM historique_modification), (SELECT count(*) FROM note_version), (SELECT count(*) FROM note_version_ligne)');
  return hachage.digest('hex').slice(0, 32);
}

/**
 * Les définitions des objets de `src` : les tables d'abord (les ombres du FTS5 se créent avec leur table), puis index, vues et déclencheurs, que
 * `fabriquerExtrait` crée APRÈS la recopie des lignes (un déclencheur ne se déclenche pas pendant la recopie, un index se construit une fois).
 */
function definitions(db) {
  const objets = db.prepare("SELECT type, name, sql FROM src.sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all()
    .filter((o) => !OMBRES_DE_RECHERCHE.test(o.name));
  const rang = { index: 0, view: 1, trigger: 2 };
  return {
    tables: objets.filter((o) => o.type === 'table'),
    apres: objets.filter((o) => o.type !== 'table').sort((a, b) => (rang[a.type] ?? 9) - (rang[b.type] ?? 9)),
  };
}

/**
 * Fabrique l'extrait : un fichier neuf `destination` d'après la base vivante `source`. Rend le méta (le contenu d'extrait.json, sans `cle`).
 * Le schéma, puis les tables de contenu et les tables calculées, sont recopiés dans une seule transaction de lecture de `source` (un instantané).
 * @param {{ source: string, destination: string, version?: string|null, instant?: Date }} o
 */
export function fabriquerExtrait({ source, destination, version = null, instant = new Date() }) {
  const t0 = performance.now();
  rmSync(destination, { force: true });
  const db = new DatabaseSync(destination);
  let meta;
  try {
    db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 10000');
    db.exec(`ATTACH DATABASE '${pathToFileURL(source).href.replace(/'/g, "''")}?mode=ro' AS src`);
    db.exec('BEGIN');
    const { tables: definies, apres } = definitions(db);
    for (const o of definies) db.exec(o.sql);

    const recopiees = [];
    const calculees = {};
    for (const { nom, classe } of tablesDeLaBase(db, 'src')) {
      if (classe !== CLASSES_DE_TABLES.CONTENU && !TABLES_CALCULEES.includes(nom)) continue;
      if (!colonnesDeLaTable(db, nom, 'main').length) continue;
      const colonnes = colonnesDeLaTable(db, nom, 'main').map((c) => identifiant(c.nom));
      const recherche = TABLES_DE_RECHERCHE.includes(nom);
      // une table de recherche plein texte garde le numéro de ses lignes (rowid) : l'index le cite
      const liste = (recherche ? ['rowid', ...colonnes] : colonnes).join(', ');
      db.exec(`INSERT INTO main.${identifiant(nom)} (${liste}) SELECT ${liste} FROM src.${identifiant(nom)}`);
      if (classe === CLASSES_DE_TABLES.CONTENU) recopiees.push(nom);
      else calculees[nom] = db.prepare(`SELECT count(*) AS n FROM main.${identifiant(nom)}`).get().n;
    }

    // les modifications en attente (sans leur auteur) passent par les tables du journal, le temps de les verser dans l'historique, puis elles en repartent
    let historisees = 0;
    if (colonnesDeLaTable(db, 'modification', 'src').length && colonnesDeLaTable(db, 'modification_lot', 'src').length) {
      db.exec(`INSERT INTO main.modification_lot (id, fait_le, page_id, resume)
        SELECT id, fait_le, page_id, resume FROM src.modification_lot WHERE id IN (SELECT lot_id FROM src.modification WHERE etat <> 'conflit')`);
      db.exec(`INSERT INTO main.modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu)
        SELECT lot_id, rang, table_nom, cle, operation, avant, apres, etat, NULL, NULL FROM src.modification WHERE etat <> 'conflit'`);
      historisees = historiser(db);
      db.exec('DELETE FROM main.modification; DELETE FROM main.modification_lot');
    }
    // index, vues et déclencheurs : après la recopie (et le versement de l'historique, qui n'en déclenche aucun)
    for (const o of apres) db.exec(o.sql);
    const schema = db.prepare('PRAGMA src.user_version').get().user_version;
    db.exec(`PRAGMA main.user_version = ${Number(schema)}`);
    db.exec('COMMIT');
    db.exec('DETACH DATABASE src');
    db.exec('PRAGMA foreign_keys = ON');

    // contrôle : aucune ligne d'une table propre au site ni d'une table inconnue ; clés étrangères intactes
    const rejetees = tablesDeLaBase(db).filter((t) => t.classe !== CLASSES_DE_TABLES.CONTENU && t.classe !== CLASSES_DE_TABLES.CALCULEE);
    const nonVides = rejetees.filter((t) => db.prepare(`SELECT count(*) AS n FROM main.${identifiant(t.nom)}`).get().n > 0);
    if (nonVides.length) throw new ErreurExtrait(500, `L’extrait refusé : ${nonVides.length} table(s) propre(s) au site ou inconnue(s) ne sont pas vides.`);
    const clesRompues = db.prepare('PRAGMA foreign_key_check').all().length;

    const empreintes = empreintesDuContenu(db);
    const fabriqueLe = ecrireInstant(instant);
    const texte = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
    db.exec(`CREATE VIEW extrait_meta AS SELECT ${texte(FORMAT_EXTRAIT)} AS format, ${texte(fabriqueLe)} AS fabrique_le, ${texte(version)} AS version_du_site,
      ${Number(schema)} AS schema, ${texte(empreintes.global)} AS empreinte`);
    if (db.prepare('PRAGMA freelist_count').get().freelist_count > 0) db.exec('VACUUM');
    meta = {
      format: FORMAT_EXTRAIT,
      fabrique_le: fabriqueLe,
      version_du_site: version,
      schema: Number(schema),
      empreinte: empreintes.global,
      tables: empreintes.tables,
      calculees,
      propres_au_site: rejetees.length,
      non_classees: empreintes.nonClassees,
      modifications_versees: historisees,
      cles_etrangeres_rompues: clesRompues,
    };
  } finally {
    db.close();
  }
  const octets = readFileSync(destination);
  meta.fichier = { octets: octets.length, sha256: sha256(octets) };
  meta.duree_ms = Math.round(performance.now() - t0);
  return meta;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le même module sert de fil de travail : fabriquerEnArrierePlan le lance, pour ne pas bloquer le service pendant la recopie
// ---------------------------------------------------------------------------------------------------------------------------------------------

if (!isMainThread && workerData?.maverickExtrait) {
  try {
    parentPort.postMessage({ meta: fabriquerExtrait(workerData.maverickExtrait) });
  } catch (e) {
    parentPort.postMessage({ erreur: String(e?.message ?? e) });
  }
}

/** Fabrique l'extrait dans un fil à part : une promesse du méta. */
export function fabriquerEnArrierePlan(options) {
  return new Promise((ok, ko) => {
    const fil = new Worker(fileURLToPath(import.meta.url), { workerData: { maverickExtrait: { ...options, instant: options.instant ?? new Date() } } });
    let reponse = null;
    fil.once('message', (m) => { reponse = m; });
    fil.once('error', ko);
    fil.once('exit', (code) => {
      if (reponse?.meta) ok(reponse.meta);
      else ko(new Error(reponse?.erreur ?? `le fil de l’extrait s’est arrêté (code ${code})`));
    });
  });
}

/** Le méta enregistré (extrait.json), ou null s'il manque ou ne se lit pas. */
export function lireMeta(dossier) {
  try {
    const meta = JSON.parse(readFileSync(join(dossier, DOSSIER_EXTRAIT, FICHIER_META), 'utf8'));
    return meta?.format === FORMAT_EXTRAIT && typeof meta.cle === 'string' ? meta : null;
  } catch {
    return null;
  }
}

/**
 * Le gestionnaire de l'extrait d'un service : rend le méta de l'extrait à jour (le fabrique si le contenu a changé depuis le dernier) et ses octets.
 * @param {{ dossier: string, base: () => import('node:sqlite').DatabaseSync | null, version?: () => string|null, enArrierePlan?: boolean,
 *   instant?: () => Date, journal?: (m: string) => void, evenement?: (type: string, o: object) => void }} o
 *   `dossier` : celui de la base vivante ; l'extrait est rangé dans <dossier>/extrait/.
 */
export function creerExtrait({ dossier, base, version = () => null, enArrierePlan = true, instant = () => new Date(), journal = () => {}, evenement = () => {} }) {
  const dossierExtrait = join(dossier, DOSSIER_EXTRAIT);
  const chemin = join(dossierExtrait, FICHIER_EXTRAIT);
  const source = join(dossier, FICHIER_BASE);
  let enCours = null; // { cle, promesse } : une seule fabrication à la fois, les téléchargements qui arrivent pendant ce temps l'attendent

  const valide = (meta, cle) => {
    if (!meta || meta.cle !== cle || !existsSync(chemin)) return false;
    try {
      return statSync(chemin).size === meta.fichier?.octets;
    } catch {
      return false;
    }
  };

  async function fabriquer(cle) {
    mkdirSync(dossierExtrait, { recursive: true });
    const neuf = join(dossierExtrait, `.${FICHIER_EXTRAIT}.${process.pid}.neuf`);
    const options = { source, destination: neuf, version: version(), instant: instant() };
    try {
      const meta = { ...(enArrierePlan ? await fabriquerEnArrierePlan(options) : fabriquerExtrait(options)), cle };
      renameSync(neuf, chemin);
      const provisoire = join(dossierExtrait, `.${FICHIER_META}.${process.pid}`);
      writeFileSync(provisoire, `${JSON.stringify(meta, null, 2)}\n`);
      renameSync(provisoire, join(dossierExtrait, FICHIER_META));
      journal(`extrait du contenu refait (${(meta.fichier.octets / 1048576).toFixed(1)} Mo, ${meta.duree_ms} ms ; ${meta.modifications_versees} modification(s) en attente versée(s))`);
      evenement('extrait', { duree_ms: meta.duree_ms, detail: { octets: meta.fichier.octets, modifications: meta.modifications_versees, tables: Object.keys(meta.tables).length } });
      return meta;
    } catch (e) {
      rmSync(neuf, { force: true });
      journal(`ERREUR extrait du contenu : ${e.message}`);
      evenement('extrait', { detail: { erreur: String(e.message).slice(0, 300) } });
      throw e instanceof ErreurExtrait ? e : new ErreurExtrait(500, 'L’extrait du contenu n’a pas pu être fabriqué.');
    }
  }

  /** Le méta de l'extrait à jour (fabriqué ici si le contenu a changé depuis la dernière fois). */
  async function meta() {
    for (let essai = 0; ; essai += 1) {
      const db = base();
      if (!db) throw new ErreurExtrait(503, 'La base n’est pas disponible pour le moment.');
      const cle = cleDeChangement(db, dossier);
      const actuel = lireMeta(dossier);
      if (valide(actuel, cle)) return actuel;
      if (!enCours) {
        const promesse = fabriquer(cle).finally(() => { enCours = null; });
        enCours = { cle, promesse };
      }
      const fait = await enCours.promesse;
      // une fabrication commencée pour une clé plus ancienne : le contenu a changé pendant ce temps, on la refait (au plus deux fois, puis on rend ce qu'on a)
      if (fait.cle === cle || essai >= 2) return fait;
    }
  }

  /** L'extrait à jour : { meta, octets } ; refait s'il ne correspond pas à son méta. */
  async function lire(essai = 0) {
    const m = await meta();
    const octets = readFileSync(chemin);
    if (sha256(octets) !== m.fichier.sha256) {
      if (essai >= 2) throw new ErreurExtrait(500, 'L’extrait du contenu est abîmé.');
      rmSync(join(dossierExtrait, FICHIER_META), { force: true });
      return lire(essai + 1);
    }
    return { meta: m, octets };
  }

  return { meta, lire, chemin, cle: () => cleDeChangement(base(), dossier) };
}
