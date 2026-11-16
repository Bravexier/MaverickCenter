// L'attestation de la production (lot 5 du chantier « la base du site de dev devient la source de vérité », docs/chantier-base-de-dev.md ; R274) :
// ce que la production dit d'elle-même, sans nom ni fiche, et ce que le site de dev en fait.
//
// Production : au démarrage du service, après la préparation de la base vivante, et après chaque reconstruction, le service écrit (par rename)
// <dossier des métriques>/attestation-<instance>.json — le dossier que les deux instances se partagent sur le VPS (MAVERICK_DOSSIER_METRIQUES : la
// production y écrit prod.db, le site de dev y lit prod.db). Elle contient :
//   - la version du service qui tourne et le schéma de la base vivante ;
//   - l'empreinte globale et celle de chaque table de contenu de la base vivante (serveur/empreintes.mjs : le calcul de l'extrait) ;
//   - l'empreinte globale du contenu du fichier de règles publié (site/donnees/maverick.db) ;
//   - l'état de la dernière préparation de la base vivante : appliquée ou non, le NOMBRE de problèmes (jamais leur texte, qui cite des noms de fiches) ;
//   - pour chaque élément de règle cité par des fiches (clé étrangère d'une table de fiche vers une table de contenu), le nombre de fiches DISTINCTES
//     qui le citent : table, identifiant de l'élément, nombre. Ni nom, ni identifiant de fiche, de compte ou de groupe.
// Un échec d'écriture n'empêche jamais le service de démarrer et ne touche pas aux fiches (service.mjs ; la lecture de la base vivante seule).
//
// Site de dev : la page « Mise à jour » compare cette attestation au contenu que la production publie (son maverick.db et son _serveur/version.json,
// montés en lecture seule sur /production : serveur/notes-de-version.mjs#lireReference) : `etatDeLaProduction`. Les empreintes ne se recalculent pas à
// chaque requête : elles sont gardées par signature du fichier (taille, date, inode).
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { CLASSES_DE_TABLES, classeDeLaTable } from '../src/lib/tables-de-la-base.mjs';
import { signature } from './base-vivante.mjs';
import { colonnesDeLaTable, empreintesDuContenu, identifiant } from './empreintes.mjs';
import { instant as ecrireInstant } from './instant.mjs';
import { productionPubliee } from './notes-de-version.mjs';

export const FORMAT_ATTESTATION = 'maverick-attestation/1';
export const INSTANCE_DE_PRODUCTION = 'prod';
/**
 * Tolérance après une livraison (demande de leader-technique) : si la version ou le contenu diffère, que le fichier publié par la production a changé il y a
 * moins de cette durée (ms) et que l'attestation est plus ancienne que lui, la production est en train d'appliquer sa mise à jour : état `inconnue`, raison
 * `en_cours`, sans alerte. Au-delà, `pas_appliquee`.
 */
export const TOLERANCE_DE_LA_MISE_A_JOUR_MS = 10 * 60 * 1000;
/**
 * La production réécrit aussi son attestation toutes les heures (décision de leader-technique, lot 8) : une fiche enregistrée depuis le démarrage compte
 * alors dans `citations` (information ; une mise à jour n'est jamais refusée pour elles, décision R280). Même fonction, même écriture.
 */
export const INTERVALLE_DE_L_ATTESTATION_MS = 60 * 60 * 1000;
/** Le nom du fichier d'une instance, dans le dossier partagé des métriques. */
export const fichierAttestation = (instance) => `attestation-${instance}.json`;

/**
 * Les éléments de règle que des fiches citent : [{ table, id, fiches }] trié par table puis identifiant. Une clé étrangère d'une table de fiche
 * (TABLES_FICHES) vers une table de contenu ; `fiches` = le nombre de fiches distinctes qui citent l'élément, toutes colonnes confondues. Une clé
 * composée (spécialité : classe + spécialité) donne un identifiant « a+b » (ses colonnes dans l'ordre de la clé étrangère). Une table de fiche sans
 * `personnage_id` (ni `personnage`, dont la fiche est la ligne) ne compte pas : elle ne cite pas de fiche. Aucun identifiant de fiche n'en sort.
 */
export function citationsDesFiches(db) {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name));
  const selections = [];
  for (const table of TABLES_FICHES) {
    if (!tables.has(table)) continue;
    const colonnes = colonnesDeLaTable(db, table).map((c) => c.nom);
    const fiche = table === 'personnage' ? 'id' : colonnes.includes('personnage_id') ? 'personnage_id' : null;
    if (!fiche) continue;
    const liaisons = new Map();
    for (const f of db.prepare(`PRAGMA foreign_key_list(${identifiant(table)})`).all()) {
      if (!liaisons.has(f.id)) liaisons.set(f.id, []);
      liaisons.get(f.id).push(f);
    }
    for (const liaison of liaisons.values()) {
      liaison.sort((a, b) => a.seq - b.seq);
      const cible = liaison[0].table;
      if (classeDeLaTable(cible) !== CLASSES_DE_TABLES.CONTENU || !tables.has(cible)) continue;
      const de = liaison.map((f) => identifiant(f.from));
      const valeur = de.map((c) => `CAST(${c} AS TEXT)`).join(" || '+' || ");
      selections.push(`SELECT '${cible}' AS t, ${valeur} AS id, ${identifiant(fiche)} AS f FROM ${identifiant(table)} WHERE ${de.map((c) => `${c} IS NOT NULL`).join(' AND ')}`);
    }
  }
  if (!selections.length) return [];
  return db.prepare(`SELECT t, id, count(DISTINCT f) AS n FROM (${selections.join(' UNION ALL ')}) GROUP BY t, id ORDER BY t, id`).all()
    .map((l) => ({ table: l.t, id: l.id, fiches: l.n }));
}

// Les empreintes d'un fichier de règles, gardées par signature : le fichier publié ne change qu'avec une livraison.
const empreintesGardees = new Map(); // chemin -> { cle, empreintes }

/** Les empreintes du contenu d'une base lue en lecture seule, gardées tant que le fichier garde sa signature. */
export function empreintesDuFichier(chemin) {
  const cle = signature(chemin);
  const deja = empreintesGardees.get(chemin);
  if (cle && deja?.cle === cle) return deja.empreintes;
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    const empreintes = { ...empreintesDuContenu(db), schema: db.prepare('PRAGMA user_version').get().user_version };
    if (cle) empreintesGardees.set(chemin, { cle, empreintes });
    return empreintes;
  } finally {
    db.close();
  }
}

/**
 * L'attestation d'une instance.
 * @param {object} o
 * @param {import('node:sqlite').DatabaseSync | null} o.db la base vivante (null : indisponible)
 * @param {string | null} o.regles le fichier de règles publié (site/donnees/maverick.db)
 * @param {{ version?: string|null, code?: string|null }} o.version la version du service qui tourne
 * @param {{ appliquee: boolean, problemes?: number, refaite_le?: string|null, regles?: string|null }} o.preparation l'état de la dernière préparation
 */
export function fabriquerAttestation({ db, regles = null, version = {}, preparation, instance = INSTANCE_DE_PRODUCTION, instant = new Date() }) {
  const t0 = performance.now();
  let vivante = null;
  let citations = [];
  let schema = null;
  if (db) {
    const e = empreintesDuContenu(db);
    vivante = { empreinte: e.global, tables: e.tables, non_classees: e.nonClassees };
    schema = db.prepare('PRAGMA user_version').get().user_version;
    citations = citationsDesFiches(db);
  }
  let publiees = null;
  if (regles && existsSync(regles)) {
    try {
      const e = empreintesDuFichier(regles);
      publiees = { empreinte: e.global, schema: e.schema };
    } catch {
      publiees = null; // un fichier de règles illisible : l'attestation le dit par son absence
    }
  }
  return {
    format: FORMAT_ATTESTATION,
    instance,
    ecrite_le: ecrireInstant(instant),
    version: { service: version.version ?? null, code: version.code ?? null },
    schema,
    base_vivante: vivante,
    regles_publiees: publiees,
    preparation: {
      appliquee: Boolean(preparation?.appliquee),
      problemes: Math.max(0, Math.trunc(Number(preparation?.problemes) || 0)),
      refaite_le: preparation?.refaite_le ?? null,
      regles: preparation?.regles ?? null,
    },
    citations,
    duree_ms: Math.round(performance.now() - t0),
  };
}

/** Écrit l'attestation dans le dossier (créé s'il manque) : un fichier provisoire, puis rename. Rend le chemin. */
export function ecrireAttestation(dossier, attestation, instance = attestation.instance) {
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, fichierAttestation(instance));
  const provisoire = join(dossier, `.${fichierAttestation(instance)}.${process.pid}`);
  try {
    writeFileSync(provisoire, `${JSON.stringify(attestation)}\n`);
    renameSync(provisoire, chemin);
  } catch (e) {
    rmSync(provisoire, { force: true });
    throw e;
  }
  return chemin;
}

const attestationsGardees = new Map(); // chemin -> { cle, lue }

/** L'attestation d'une instance : { attestation } ou { raison: 'absente' | 'illisible' }. Gardée par signature du fichier. */
export function lireAttestation(dossier, instance = INSTANCE_DE_PRODUCTION) {
  const chemin = join(dossier, fichierAttestation(instance));
  const cle = signature(chemin);
  if (!cle) return { raison: 'absente' };
  const deja = attestationsGardees.get(chemin);
  if (deja?.cle === cle) return deja.lue;
  let lue;
  try {
    const a = JSON.parse(readFileSync(chemin, 'utf8'));
    lue = a?.format === FORMAT_ATTESTATION && a.preparation && typeof a.preparation === 'object' ? { attestation: a } : { raison: 'illisible' };
  } catch {
    lue = { raison: 'illisible' };
  }
  attestationsGardees.set(chemin, { cle, lue });
  return lue;
}

const MESSAGES = Object.freeze({
  a_jour: (o) => `La production a appliqué la dernière mise à jour${o.version_publiee ? ` (version ${o.version_publiee})` : ''}.`,
  version: (o) => `La production n’a pas appliqué sa dernière mise à jour : elle fait tourner la version ${o.version_attestee ?? 'inconnue'}, la dernière livrée est la ${o.version_publiee}.`,
  contenu: (o) => `La production n’a pas appliqué sa dernière mise à jour : le contenu de sa base n’est pas celui qu’elle publie (${o.tables_differentes.length} table(s) diffèrent).`,
  en_cours: () => 'La production applique sa mise à jour : son état sera connu dans quelques minutes.',
  preparation: (o) => `La production n’a pas appliqué sa dernière mise à jour : la préparation de sa base a échoué (${o.problemes} problème(s) relevé(s) sur ses fiches).`,
  absente: () => 'L’état de la production n’est pas connu : elle n’a pas encore publié son attestation (elle le fait après sa prochaine livraison).',
  illisible: () => 'L’état de la production n’est pas connu : son attestation est illisible.',
  production_illisible: () => 'L’état de la production n’est pas connu : le contenu qu’elle publie n’est pas lisible depuis ce site.',
  non_configuree: () => 'L’état de la production n’est pas connu : ce site ne lit pas la production.',
});

/**
 * Où en est la production : a-t-elle appliqué sa dernière mise à jour ? Compare son attestation au contenu qu'elle publie (version de
 * _serveur/version.json, empreinte du contenu de donnees/maverick.db).
 * @param {{ dossier: string | null, production: string | null, propre?: string | null, instance?: string }} o `dossier` : celui des métriques ;
 *   `production` : le site de la production monté en lecture seule ; `propre` : la base des règles de ce site (une « production » qui est ce même fichier ne sert pas)
 * @returns {{ etat: 'a_jour'|'pas_appliquee'|'inconnue', raison: string|null, message: string, version_publiee: string|null, version_attestee: string|null,
 *   attestee_le: string|null, problemes: number|null, tables_differentes: string[] }} `inconnue` : sans alerte (la production n'écrit son attestation
 *   qu'après sa prochaine livraison) ; `raison` : `version`, `contenu`, `preparation` (pas_appliquee), `en_cours` (inconnue : livraison de moins de TOLERANCE_DE_LA_MISE_A_JOUR_MS), `absente`, `illisible`, `production_illisible`, `non_configuree`
 */
export function etatDeLaProduction(options) {
  try {
    return calculerLEtat(options);
  } catch {
    // la page « Mise à jour » ne doit jamais tomber pour cela : un état inconnu, sans alerte
    return { etat: 'inconnue', raison: 'illisible', message: MESSAGES.illisible(), version_publiee: null, version_attestee: null, attestee_le: null, problemes: null, tables_differentes: [] };
  }
}

function calculerLEtat({ dossier, production, propre = null, instance = INSTANCE_DE_PRODUCTION, instant = new Date() }) {
  const rendre = (etat, raison, plus = {}) => {
    const o = { version_publiee: null, version_attestee: null, attestee_le: null, problemes: null, tables_differentes: [], ...plus };
    return { etat, raison, message: MESSAGES[raison ?? 'a_jour'](o), ...o };
  };
  if (!production || !dossier) return rendre('inconnue', 'non_configuree');
  const publiee = existsSync(production) ? productionPubliee(production, propre) : { raison: 'non montee' };
  if (!publiee.chemin) return rendre('inconnue', 'production_illisible');
  const lue = lireAttestation(dossier, instance);
  if (!lue.attestation) return rendre('inconnue', lue.raison, { version_publiee: publiee.version });
  const a = lue.attestation;
  const base = { version_publiee: publiee.version, version_attestee: a.version?.service ?? null, attestee_le: a.ecrite_le ?? null, problemes: a.preparation.problemes ?? 0 };
  if (!a.preparation.appliquee) return rendre('pas_appliquee', 'preparation', base);
  // un fichier publié tout récent, plus neuf que l'attestation : la livraison vient d'avoir lieu, la production n'a pas fini (les secondes seules : `ecrite_le`)
  const enCours = () => {
    const modifie = Math.floor(statSync(publiee.chemin).mtimeMs / 1000) * 1000;
    return modifie > Date.parse(a.ecrite_le) && new Date(instant).getTime() - modifie < TOLERANCE_DE_LA_MISE_A_JOUR_MS;
  };
  if (a.version?.service !== publiee.version) return enCours() ? rendre('inconnue', 'en_cours', base) : rendre('pas_appliquee', 'version', base);
  let publies;
  try {
    publies = empreintesDuFichier(publiee.chemin);
  } catch {
    return rendre('inconnue', 'production_illisible', base);
  }
  if (a.base_vivante?.empreinte !== publies.global) {
    const attestees = a.base_vivante?.tables ?? {};
    const noms = new Set([...Object.keys(attestees), ...Object.keys(publies.tables)]);
    const differentes = [...noms].filter((t) => attestees[t]?.empreinte !== publies.tables[t]?.empreinte).sort();
    return enCours() ? rendre('inconnue', 'en_cours', base) : rendre('pas_appliquee', 'contenu', { ...base, tables_differentes: differentes });
  }
  return rendre('a_jour', null, base);
}
