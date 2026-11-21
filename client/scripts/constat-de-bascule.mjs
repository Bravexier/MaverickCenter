#!/usr/bin/env node
// Le constat d'égalité du jour de la bascule 1 (lot 8 du chantier « la base du site de dev devient la source de vérité », garde-fou 3 ; docs/serveur.md,
// « Base source (lot 8) »). Livré avec le service dans _serveur/scripts/ (serveur/livraison.mjs#FICHIERS_JOINTS) : deploy/installateur/bascule.sh le lance
// DANS le conteneur du service du site de dev (l'hôte n'a pas forcément Node), écritures gelées. Il compare, TABLE DE CONTENU PAR TABLE DE CONTENU :
//   - la base de la production, lue par son attestation (serveur/attestation.mjs : l'empreinte de chaque table de contenu de sa base vivante) ;
//   - la base vivante du site de dev ;
//   - le fichier des règles installé sur le site de dev (le dépôt).
// Hors du compte : les tables propres au site et calculées (serveur/empreintes.mjs ne lit que le contenu), et les pages d'exemple (`page.statut = 'example'`
// et les lignes qui les citent) : une table qui ne diffère entre le site de dev et le dépôt que par elles compte comme égale si la production a l'un des deux.
// Il n'écrit rien (bases ouvertes en lecture seule) et ne sort que des noms de tables et des nombres de lignes, jamais un contenu.
//
//   node constat-de-bascule.mjs --base <vivante.db> --regles <maverick.db> --attestation <attestation-prod.json> [--production <site de la production>] [--json]
// Sortie : « EGALITE … » (code 0), ou « DIFFERENCES … » puis une ligne par écart (code 1) ; « EMPREINTE <sha256> » : l'empreinte globale du contenu de la base
// du site de dev (celle que bascule.sh écrit dans le marqueur). Code 2 : usage ou fichier illisible.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { colonnesDeLaTable, empreintesDuContenu, identifiant } from '../serveur/empreintes.mjs';
import { compterLesConflits } from '../serveur/edition-conflits.mjs';

export const FORMAT_DU_CONSTAT = 'maverick-constat-bascule/1';

const lire = (chemin) => new DatabaseSync(chemin, { readOnly: true });
const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));

/** Les ids des pages d'exemple d'une base (aucune sans table `page`). */
function pagesDExemple(db) {
  if (!tableExiste(db, 'page')) return [];
  return db.prepare("SELECT id FROM page WHERE statut = 'example' ORDER BY id").all().map((l) => l.id);
}

/**
 * Une empreinte de la table SANS les pages d'exemple (`exemples`) : la table `page` sans elles, une table qui cite `page` sans les lignes qui les citent.
 * Rend null pour une table sans rapport avec les pages (rien à retirer). Ne sert qu'à comparer deux bases lues ici (format propre à ce constat).
 */
function empreinteSansExemples(db, table, exemples) {
  if (!tableExiste(db, table)) return null;
  const versLaPage = table === 'page' ? ['id']
    : db.prepare(`PRAGMA foreign_key_list(${identifiant(table)})`).all().filter((f) => f.table === 'page').map((f) => f.from);
  if (!versLaPage.length) return null;
  const colonnes = colonnesDeLaTable(db, table).map((c) => c.nom).sort();
  const filtre = versLaPage.map((c) => `(${identifiant(c)} IS NULL OR ${identifiant(c)} NOT IN (SELECT value FROM json_each(?)))`).join(' AND ');
  const liste = JSON.stringify(exemples);
  const lignes = db.prepare(`SELECT ${colonnes.map(identifiant).join(', ')} FROM ${identifiant(table)} WHERE ${filtre}`).all(...versLaPage.map(() => liste))
    .map((l) => JSON.stringify(colonnes.map((c) => {
      const v = l[c];
      return v instanceof Uint8Array ? `B${Buffer.from(v).toString('hex')}` : [typeof v, v];
    })))
    .sort();
  const h = createHash('sha256');
  for (const l of lignes) h.update(`${l}\n`);
  return { empreinte: h.digest('hex'), lignes: lignes.length };
}

/**
 * Le journal du site de dev à résoudre avant la bascule, compté comme /api/etat (serveur/service.mjs) : toute modification « en_attente », et les
 * « conflit » des seuls lots pas encore résolus (edition-conflits.mjs#compterLesConflits) ; un lot résolu sur /mise-a-jour/ garde ses lignes « conflit »
 * comme trace, comptées à part (conflit_lot_resolu) sans faire refuser. null sans journal. Sans table des lots (base ancienne), tout conflit compte.
 */
function journalDuSiteDeDev(db) {
  if (!tableExiste(db, 'modification')) return null;
  const n = (etat) => db.prepare('SELECT count(*) AS n FROM modification WHERE etat = ?').get(etat).n;
  const enAttente = n('en_attente');
  if (!tableExiste(db, 'modification_lot')) return { en_attente: enAttente, en_attente_lot_resolu: 0, conflit: n('conflit'), lots_en_conflit: null, conflit_lot_resolu: 0 };
  const resolu = (etat) => db.prepare(`SELECT count(*) AS n FROM modification m JOIN modification_lot l ON l.id = m.lot_id
    WHERE m.etat = ? AND l.resolu_le IS NOT NULL`).get(etat).n;
  const conflits = compterLesConflits(db);
  return { en_attente: enAttente, en_attente_lot_resolu: resolu('en_attente'), conflit: conflits.modifications, lots_en_conflit: conflits.lots, conflit_lot_resolu: resolu('conflit') };
}

/**
 * Le constat : { format, egalite, tables_comparees, egales, hors_exemples (tables égales hors des pages d'exemple), differences: [{ table, raison, production,
 * dev, depot }] (des nombres de lignes, null si la table manque), problemes (attestation, journal), empreinte (globale du contenu du site de dev) }.
 * @param {{ base: string, regles: string, attestation: object | null, versionProduction?: string | null }} o
 */
export function constater({ base, regles, attestation, versionProduction = null }) {
  const problemes = [];
  if (!attestation || attestation.format !== 'maverick-attestation/1' || !attestation.base_vivante?.tables) {
    problemes.push('attestation de la production absente ou illisible : sa base ne peut pas être comparée');
  } else {
    if (!attestation.preparation?.appliquee) problemes.push('la production n’a pas appliqué sa dernière préparation (attestation) : son contenu n’est pas sûr');
    if (versionProduction && attestation.version?.service !== versionProduction) {
      problemes.push(`attestation périmée : elle a été écrite par la version ${attestation.version?.service ?? 'inconnue'}, la production publie la ${versionProduction}`);
    }
  }
  const dbDev = lire(base);
  const dbDepot = lire(regles);
  try {
    const dev = empreintesDuContenu(dbDev);
    const depot = empreintesDuContenu(dbDepot);
    const prod = attestation?.base_vivante?.tables ?? {};
    for (const t of [...new Set([...dev.nonClassees, ...depot.nonClassees])].sort()) problemes.push(`table « ${t} » inconnue du classement (lib/tables-de-la-base.mjs) : non comparée`);
    const j = journalDuSiteDeDev(dbDev);
    if (j && j.en_attente + j.conflit) {
      problemes.push(`${j.en_attente + j.conflit} modification(s) du journal du site de dev en attente ou en conflit non résolu : à résoudre avant la bascule `
        + `(en attente : ${j.en_attente}, dont ${j.en_attente_lot_resolu} dans un lot résolu ; en conflit non résolu : ${j.conflit} dans ${j.lots_en_conflit} lot(s) ; `
        + `en conflit dans un lot résolu, gardées comme trace et non comptées : ${j.conflit_lot_resolu})`);
    }
    const exemples = [...new Set([...pagesDExemple(dbDev), ...pagesDExemple(dbDepot)])].sort();
    const noms = [...new Set([...Object.keys(dev.tables), ...Object.keys(depot.tables), ...Object.keys(prod)])].sort();
    const differences = [];
    let egales = 0;
    const horsExemples = [];
    for (const table of noms) {
      const p = prod[table]?.empreinte ?? null;
      const d = dev.tables[table]?.empreinte ?? null;
      const r = depot.tables[table]?.empreinte ?? null;
      const lignes = { production: prod[table]?.lignes ?? null, dev: dev.tables[table]?.lignes ?? null, depot: depot.tables[table]?.lignes ?? null };
      if (p && d && r && p === d && d === r) {
        egales += 1;
        continue;
      }
      if (p && d && r && (p === d || p === r)) {
        const sd = empreinteSansExemples(dbDev, table, exemples);
        const sr = empreinteSansExemples(dbDepot, table, exemples);
        if (sd && sr && sd.empreinte === sr.empreinte) {
          egales += 1;
          horsExemples.push(table);
          continue;
        }
      }
      const raison = !p || !d || !r ? 'table absente d’un côté' : p !== d && d === r ? 'la production diffère' : p === d ? 'le dépôt diffère' : p === r ? 'le site de dev diffère' : 'les trois diffèrent';
      differences.push({ table, raison, ...lignes });
    }
    return {
      format: FORMAT_DU_CONSTAT, egalite: !differences.length && !problemes.length, tables_comparees: noms.length, egales, hors_exemples: horsExemples,
      differences, problemes, empreinte: dev.global,
    };
  } finally {
    dbDev.close();
    dbDepot.close();
  }
}

/** Le texte du constat : la première ligne dit EGALITE ou DIFFERENCES ; puis l'empreinte ; puis un écart par ligne. */
export function texteDuConstat(c) {
  const lignes = [c.egalite
    ? `EGALITE ${c.tables_comparees} table(s) de contenu identiques (production, site de dev, dépôt)${c.hors_exemples.length ? `, dont ${c.hors_exemples.length} hors pages d’exemple (${c.hors_exemples.join(', ')})` : ''}`
    : `DIFFERENCES ${c.differences.length} table(s) sur ${c.tables_comparees}${c.problemes.length ? `, ${c.problemes.length} problème(s)` : ''}`];
  lignes.push(`EMPREINTE ${c.empreinte}`);
  const n = (v) => (v === null ? 'absente' : `${v} ligne(s)`);
  for (const d of c.differences) lignes.push(`table ${d.table} : ${d.raison} (production ${n(d.production)}, site de dev ${n(d.dev)}, dépôt ${n(d.depot)})`);
  for (const p of c.problemes) lignes.push(`problème : ${p}`);
  return lignes.join('\n');
}

function principal(args) {
  const o = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--json') o.json = true;
    else if (['--base', '--regles', '--attestation', '--production'].includes(a) && i + 1 < args.length) o[a.slice(2)] = args[(i += 1)];
    else {
      console.error(`option inconnue : ${a}\nUsage : node constat-de-bascule.mjs --base <vivante.db> --regles <maverick.db> --attestation <attestation-prod.json> [--production <site>] [--json]`);
      return 2;
    }
  }
  for (const cle of ['base', 'regles']) {
    if (!o[cle] || !existsSync(o[cle])) {
      console.error(`constat impossible : --${cle} ${o[cle] ?? '(absent)'} introuvable`);
      return 2;
    }
  }
  let attestation = null;
  try {
    if (o.attestation) attestation = JSON.parse(readFileSync(o.attestation, 'utf8'));
  } catch {
    attestation = null;
  }
  let versionProduction = null;
  try {
    if (o.production) versionProduction = JSON.parse(readFileSync(join(o.production, '_serveur', 'version.json'), 'utf8')).version ?? null;
  } catch {
    versionProduction = null;
  }
  const c = constater({ base: o.base, regles: o.regles, attestation, versionProduction });
  console.log(o.json ? JSON.stringify(c) : texteDuConstat(c));
  return c.egalite ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    console.error(`constat impossible : ${e?.message ?? e}`);
    process.exitCode = 2;
  }
}
