// Base vivante d'une instance (dossier db/, voir docs/serveur.md) : une copie de la base des règles que publie le site (site/donnees/maverick.db,
// construite depuis data/rows), dans laquelle le service écrit les fiches de personnages, les utilisateurs et les groupes (section 13 de
// data/schema.sql) et, sur le site de dev, les modifications des règles et leur journal (section 14). Quand une livraison change les règles, la base
// vivante est refaite : nouvelle copie des règles, puis les lignes des sections 13 et 14 y sont recopiées, colonne par colonne, et les modifications
// en attente du journal sont rejouées sur les nouvelles règles (serveur/edition-journal.mjs). Rien ne se perd : si une ligne ne passe pas (une fiche cite une règle disparue, une colonne
// remplie n'existe plus, une contrainte a changé), la base en place est gardée telle quelle et l'erreur dit pourquoi ; une base remplacée qui
// avait des lignes est d'abord archivée (db/archives/, les ARCHIVES_GARDEES dernières).
// Node seulement (node:sqlite), sans dépendance.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { rejouer } from './edition-journal.mjs';

/** Tables de la section 13 (« PERSONNAGES ») de data/schema.sql, chacune après celles qu'elle cite (test serveur-base-vivante). */
export const TABLES_FICHES = Object.freeze([
  'utilisateur', 'utilisateur_role', 'personnage', 'personnage_partage', 'personnage_classe', 'personnage_caracteristique', 'personnage_competence',
  'personnage_progression', 'personnage_capacite', 'personnage_sort', 'personnage_maitrise_arme', 'personnage_arme', 'personnage_armure',
  'personnage_bouclier_materiau', 'personnage_accessoire', 'personnage_inventaire', 'groupe', 'groupe_membre',
]);
/**
 * Tables de la section 14 (« ÉDITION ») : le journal des modifications faites depuis le site de dev (serveur/edition-journal.mjs) et le brouillon de
 * la note de version (page /mise-a-jour/, serveur/notes-de-version.mjs).
 */
export const TABLES_EDITION = Object.freeze(['modification_lot', 'modification', 'note_version_brouillon']);
/** Ce que le service écrit et qui survit à un changement de règles : les fiches, puis le journal des modifications. */
export const TABLES_VIVANTES = Object.freeze([...TABLES_FICHES, ...TABLES_EDITION]);

export const FICHIER_BASE = 'vivante.db';
/** À côté de la base : l'empreinte des règles dont elle est faite (refaite quand elle diffère de celle de la base publiée). */
export const FICHIER_ETAT = 'vivante.json';
export const DOSSIER_ARCHIVES = 'archives';
export const ARCHIVES_GARDEES = 5;

export class ErreurBaseVivante extends Error {
  /** @param {string} message @param {string[]} problemes */
  constructor(message, problemes = []) {
    super(message);
    this.name = 'ErreurBaseVivante';
    this.problemes = problemes;
  }
}

/** Empreinte SHA-256 d'un fichier. */
export function empreinteFichier(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex');
}

/** Signature d'un fichier sans le lire (change quand il est remplacé ou réécrit) ; null s'il n'existe pas. */
export function signature(chemin) {
  try {
    const s = statSync(chemin);
    return `${s.ino}:${s.size}:${s.mtimeMs}`;
  } catch {
    return null;
  }
}

/** Contenu de vivante.json ({ regles, schema, refaite_le }), null s'il est absent ou illisible. */
export function lireEtat(dossier) {
  try {
    return JSON.parse(readFileSync(join(dossier, FICHIER_ETAT), 'utf8'));
  } catch {
    return null;
  }
}

function ecrireEtat(dossier, etat) {
  const provisoire = join(dossier, `.${FICHIER_ETAT}.${process.pid}`);
  writeFileSync(provisoire, `${JSON.stringify(etat, null, 2)}\n`);
  renameSync(provisoire, join(dossier, FICHIER_ETAT));
}

const colonnes = (db, schema, table) => db.prepare(`PRAGMA "${schema}".table_info("${table}")`).all().map((c) => c.name);
const compter = (db, schema, table) => db.prepare(`SELECT count(*) AS n FROM "${schema}"."${table}"`).get().n;

/**
 * Clés étrangères rompues d'une table : une entrée par (colonnes, valeur citée absente de la table visée), avec le nombre de lignes.
 * `ou` restreint les lignes contrôlées (« personnage_id = ? », avec `valeurs`).
 */
export function clesRompues(db, table, { schema = 'main', ou = null, valeurs = [] } = {}) {
  const liaisons = new Map();
  for (const f of db.prepare(`PRAGMA "${schema}".foreign_key_list("${table}")`).all()) {
    if (!liaisons.has(f.id)) liaisons.set(f.id, []);
    liaisons.get(f.id).push(f);
  }
  const rompues = [];
  for (const liaison of liaisons.values()) {
    liaison.sort((a, b) => a.seq - b.seq);
    const parent = liaison[0].table;
    const clePrimaire = db.prepare(`PRAGMA "${schema}".table_info("${parent}")`).all().filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
    const de = liaison.map((f) => f.from);
    const vers = liaison.map((f, i) => f.to ?? clePrimaire[i]);
    const conditions = [...de.map((c) => `t."${c}" IS NOT NULL`), ...(ou ? [`(${ou})`] : [])].join(' AND ');
    const egalites = de.map((c, i) => `p."${vers[i]}" = t."${c}"`).join(' AND ');
    const valeur = de.map((c) => `t."${c}"`).join(` || ' / ' || `);
    const lignes = db.prepare(`SELECT ${valeur} AS valeur, count(*) AS n FROM "${schema}"."${table}" t
      WHERE ${conditions} AND NOT EXISTS (SELECT 1 FROM "${schema}"."${parent}" p WHERE ${egalites})
      GROUP BY valeur ORDER BY valeur`).all(...valeurs);
    for (const l of lignes) rompues.push({ table, colonnes: de, parent, valeur: l.valeur, lignes: l.n });
  }
  return rompues;
}

/** Les tables des sections 13 et 14 existent dans la copie des règles, et elles y sont vides (data/rows les garde vides : jamais de fiche ni de journal dans git). */
function verifierRegles(db) {
  const problemes = [];
  for (const t of TABLES_VIVANTES) {
    if (!colonnes(db, 'main', t).length) problemes.push(`table ${t} absente`);
    else if (compter(db, 'main', t)) problemes.push(`table ${t} non vide`);
  }
  if (problemes.length) throw new ErreurBaseVivante(`base des règles inattendue : ${problemes.join(', ')}`, problemes);
  const controle = db.prepare('PRAGMA quick_check').all().map((r) => Object.values(r)[0]);
  if (controle.join() !== 'ok') throw new ErreurBaseVivante(`base des règles abîmée : ${controle.slice(0, 3).join(' ; ')}`);
}

/**
 * Recopie dans `db` (la copie neuve des règles) les lignes des sections 13 et 14 de la base `ancienne`, puis rejoue les modifications en attente du
 * journal sur les nouvelles règles (avant le contrôle des fiches : une fiche peut citer une ligne créée par l'édition) ; rien n'est écrit si une seule
 * ligne de fiche ne passe pas. Une modification que les nouvelles règles contredisent n'empêche rien : elle passe « conflit ». Rend le bilan du rejeu.
 */
function transferer(db, ancienne) {
  let rejeu = null;
  const problemes = [];
  db.prepare('ATTACH DATABASE ? AS ancienne').run(ancienne);
  try {
    db.exec('PRAGMA foreign_keys = OFF'); // contrôle explicite après la copie, avec le détail de chaque référence rompue
    db.exec('BEGIN');
    let ouverte = true;
    try {
      for (const t of TABLES_VIVANTES) {
        const avant = colonnes(db, 'ancienne', t);
        if (!avant.length) continue; // table que l'ancienne base n'avait pas encore
        const lignes = compter(db, 'ancienne', t);
        if (!lignes) continue;
        const apres = colonnes(db, 'main', t);
        const perdues = avant.filter((c) => !apres.includes(c))
          .filter((c) => db.prepare(`SELECT count(*) AS n FROM ancienne."${t}" WHERE "${c}" IS NOT NULL`).get().n > 0);
        if (perdues.length) {
          problemes.push(`${t} : ${perdues.join(', ')} rempli(e)s mais absente(s) des nouvelles règles`);
          continue;
        }
        const communes = avant.filter((c) => apres.includes(c)).map((c) => `"${c}"`).join(', ');
        try {
          db.exec(`INSERT INTO main."${t}" (${communes}) SELECT ${communes} FROM ancienne."${t}"`);
        } catch (e) {
          problemes.push(`${t} : ${e.message}`);
        }
      }
      if (!problemes.length) rejeu = rejouer(db);
      // le brouillon de la note de version d'un lot que les nouvelles règles ont livré est vidé (son texte est dans note_version)
      if (!problemes.length) viderBrouillonLivre(db);
      if (!problemes.length) {
        for (const t of TABLES_VIVANTES) {
          for (const r of clesRompues(db, t)) problemes.push(`${t}.${r.colonnes.join('+')} = « ${r.valeur} » absent de ${r.parent} (${r.lignes} ligne(s))`);
        }
      }
      if (problemes.length) {
        throw new ErreurBaseVivante(`les fiches ne passent pas dans les nouvelles règles, la base vivante est gardée telle quelle : ${problemes.join(' ; ')}`, problemes);
      }
      db.exec('COMMIT');
      ouverte = false;
    } finally {
      if (ouverte) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // déjà annulée par SQLite
        }
      }
    }
  } finally {
    db.exec('DETACH DATABASE ancienne');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return rejeu;
}

/** Vide le brouillon de la note de version si les règles contiennent la note de version de son lot (livré par « Effectuer la mise à jour »). */
export function viderBrouillonLivre(db) {
  const b = db.prepare('SELECT lot FROM note_version_brouillon WHERE id = 1').get();
  if (b?.lot && db.prepare('SELECT 1 FROM note_version WHERE lot = ?').get(b.lot)) db.exec('DELETE FROM note_version_brouillon');
}

/** Nom d'archive horodaté (l'ordre alphabétique est l'ordre chronologique). */
const horodatage = (instant) => instant.toISOString().replace(/[:.]/g, '-');

/** Archive la base vivante si elle a des lignes de la section 13 ; garde les ARCHIVES_GARDEES dernières. */
function archiver(dossier, chemin, instant) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  let lignes = 0;
  try {
    for (const t of TABLES_VIVANTES) if (colonnes(db, 'main', t).length) lignes += compter(db, 'main', t);
  } finally {
    db.close();
  }
  if (!lignes) return null;
  const archives = join(dossier, DOSSIER_ARCHIVES);
  mkdirSync(archives, { recursive: true });
  const fichier = join(archives, `vivante-${horodatage(instant)}.db`);
  copyFileSync(chemin, fichier);
  const toutes = readdirSync(archives).filter((f) => /^vivante-.+\.db$/.test(f)).sort();
  for (const f of toutes.slice(0, -ARCHIVES_GARDEES)) rmSync(join(archives, f), { force: true });
  return fichier;
}

/**
 * Prépare la base vivante du dossier `dossier` pour la base des règles `regles` (celle que publie le site) : la crée au premier lancement, la
 * refait quand les règles ont changé, ne touche à rien sinon. Rend { chemin, refaite, archive, empreinte, schema, rejeu } (rejeu : bilan des
 * modifications du journal rejouées, null sans base précédente). En cas d'échec, lève une
 * erreur (ErreurBaseVivante quand les fiches ne passent pas) et la base en place reste intacte.
 */
export function preparerBaseVivante({ regles, dossier, instant = new Date() }) {
  if (!existsSync(regles)) throw new ErreurBaseVivante(`base des règles introuvable : ${regles} (le site est-il installé ?)`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, FICHIER_BASE);
  const etat = lireEtat(dossier);
  if (existsSync(chemin) && etat?.regles && etat.regles === empreinteFichier(regles)) {
    return { chemin, refaite: false, archive: null, empreinte: etat.regles, schema: etat.schema ?? null };
  }

  const neuve = join(dossier, `.${FICHIER_BASE}.${process.pid}.neuve`);
  rmSync(neuve, { force: true });
  copyFileSync(regles, neuve);
  let archive = null;
  let schema;
  let rejeu = null;
  try {
    const empreinte = empreinteFichier(neuve); // celle de la copie : les règles peuvent être remplacées pendant qu'on les copie
    const db = new DatabaseSync(neuve);
    try {
      verifierRegles(db);
      if (existsSync(chemin)) rejeu = transferer(db, chemin);
      schema = db.prepare('PRAGMA user_version').get().user_version;
    } finally {
      db.close();
    }
    if (existsSync(chemin)) archive = archiver(dossier, chemin, instant);
    renameSync(neuve, chemin);
    ecrireEtat(dossier, { regles: empreinte, schema, refaite_le: instant.toISOString().replace(/\.\d{3}Z$/, 'Z') });
    return { chemin, refaite: true, archive, empreinte, schema, rejeu };
  } catch (e) {
    rmSync(neuve, { force: true });
    throw e;
  }
}

/** Ouvre la base vivante pour le service : clés étrangères contrôlées, attente courte si une copie (sqlite3 .backup) la verrouille. */
export function ouvrirBaseVivante(chemin) {
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}
