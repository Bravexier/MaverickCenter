// L'outil générique « lot de nature `source` » (lot 12 du chantier « la base du site de dev devient la source de vérité », R274, R275 (4), R278) : ce que
// ne fait plus `data/rows` (l'importeur ou `db:sync-pages` y écrivait ; il n'y écrit plus) se PROPOSE au site de dev. Depuis une base réimportée (« après »,
// bâtie par l'importeur) et l'extrait du jour du site de dev (« avant », `npm run db:extrait`), l'outil écrit un lot de changements « maverick-lot/1 »
// de nature `source`, de ce qui diffère (tables de contenu seulement : serveur/epreuve-des-lots.mjs#differences, #lotDeLaDifference), contrôlé comme au dépôt
// (lib/lot-de-changements.mjs#controlerLaNature, #controlerLeLot, toutes les tables ouvertes comme sur une base dont le service est la source).
//   node scripts/lot-de-source.mjs --apres <base.db> --lot <lot.json> --titre <titre> [--avant <extrait.db>] [--auteur <nom>]
// `--avant` : défaut var/extrait/maverick-dev.db. L'outil n'envoie RIEN, jamais, et n'a pas d'option d'envoi : le lot se PROPOSE au site de dev par un humain
// (`POST /api/edition/lots/`, skill modifier-une-page-wiki) et n'entre dans la base qu'au clic du propriétaire (ou, avec une clé de dépôt, s'il passe les contrôles :
// R291). Sortie : le lot dans `--lot` (rien d'écrit quand les deux bases ne diffèrent pas : code 0, « aucune différence »), un bilan par table sur la sortie standard.
// Code de sortie : 0 (lot écrit, ou aucune différence), 1 (lot refusé par les contrôles ; bases incompatibles), 2 (usage).
// Les deux bases doivent être comparables, sans quoi l'outil refuse (jamais un lot qui mélangerait l'import et l'écart de structure) :
//   - même structure (`PRAGMA user_version`). L'« avant » de la ligne de commande est une COPIE de l'extrait, préparée comme celle du build (scripts/db-preparer-contenu.mjs :
//     vue de l'extrait retirée, migrations du dépôt manquantes appliquées ; jamais le fichier fourni) ; l'« après » doit déjà avoir la structure du dépôt ;
//   - mêmes pages d'exemple : le site de dev n'en a aucune (des fixtures, pas du lore), l'« après » se bâtit donc sans elles (db-derive --sans-exemples). Un « après » qui en
//     porte, face à un « avant » qui n'en a pas, ferait proposer des fixtures au site : refusé.
// Les opérations (serveur/epreuve-des-lots.mjs) : modifications, puis insertions (parents d'abord, un numéro à donner `{ "$numero": … }` pour une clé entière), puis
// suppressions (enfants d'abord). Ici s'ajoutent deux règles du service (comme `scripts/baliser-mot-cle.mjs`, qui s'en sert) : les colonnes dérivées
// (serveur/edition.mjs#colonneDerivee : corps et résumé des pages typées…) sont refaites par le service, le lot ne les porte pas ; les mots-clés créés passent d'abord (un
// texte balisé cite la clé d'un mot-clé que le vocabulaire doit déjà porter).
// API : `lotDeSource(avant, apres, { titre, auteur? })` sur deux bases ouvertes ; `ecrireLeLotDeSource({ avant, apres, titre, auteur?, sortie })` sur deux fichiers ;
// `lotDeSourceParModification(avant, modifier, { titre, auteur? })` pour un outil qui retouche la base lui-même (`scripts/autolink.mjs --lot`) : `avant` est un fichier déjà préparé,
// `modifier(db)` s'applique à sa copie temporaire (ouverte en écriture), le lot est la différence.
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { colonneDerivee } from '../serveur/edition.mjs';
import { structure } from '../serveur/edition-journal.mjs';
import { differences, lotDeLaDifference } from '../serveur/epreuve-des-lots.mjs';
import { controlerLaNature, controlerLeLot } from '../src/lib/lot-de-changements.mjs';
import { preparerLeContenu } from './db-preparer-contenu.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** L'extrait du jour du site de dev (scripts/db-extrait.mjs : var/extrait/maverick-dev.db), l'« avant » par défaut de la ligne de commande. */
export const EXTRAIT_PAR_DEFAUT = join(RACINE, 'var', 'extrait', 'maverick-dev.db');

/** La structure d'une table pour contrôler un lot (lib/lot-de-changements.mjs#controlerLeLot) : null pour une table inconnue. */
const structurePourLeLot = (db) => (table) => {
  try {
    const { colonnes, cle } = structure(db, table);
    return { colonnes, cle };
  } catch {
    return null;
  }
};

/** Les colonnes du repère et les champs logiques du mot-clé qu'elles portent (migration 0136, docs/chantier-retrait-des-colonnes.md §1). */
const CHAMPS_DU_REPERE = Object.freeze({ nom: 'libelle', adresse: 'url', definition: 'description', couleur: 'couleur', icone: 'icone' });

/**
 * Depuis la migration 0136, un mot-clé créé nu naît avec son repère (son nom, sa définition…) : la différence en fait deux insertions, `mot_cle` (sans nom)
 * puis `repere`. Le lot dit la création en une seule, comme avant le retrait des colonnes : l'insertion du mot-clé reçoit les valeurs de son repère sous
 * ses champs logiques (`libelle`, `url`, `description`, `couleur`, `icone` : ce qu'un lot `maverick-lot/1` écrit pour créer un mot-clé, dont le service
 * crée le repère), et celle du repère part. Le repère d'un mot-clé qui existait déjà garde son opération. Le repère d'un mot-clé créé cite le numéro à
 * donner de son mot-clé (serveur/epreuve-des-lots.mjs#lotDeLaDifference : sa clé est celle du mot-clé).
 */
function sansLeRepereDesCrees(operations) {
  const id = (v) => JSON.stringify(v);
  const crees = new Map(operations.filter((o) => o.table === 'mot_cle' && o.operation === 'inserer').map((o) => [id(o.cle.id), o]));
  const fondus = new Set();
  for (const o of operations) {
    const m = o.table === 'repere' && o.operation === 'inserer' ? crees.get(id(o.cle.mot_cle_id)) : null;
    if (!m) continue;
    m.apres = { ...m.apres, ...Object.fromEntries(Object.entries(CHAMPS_DU_REPERE).filter(([c]) => (o.apres[c] ?? null) !== null).map(([c, champ]) => [champ, o.apres[c]])) };
    fondus.add(o);
  }
  return operations.filter((o) => !fondus.has(o));
}

/**
 * Le lot de changements (« maverick-lot/1 ») de ce qui diffère entre `avant` et `apres` (tables de contenu), d'en-tête `entete` ({ titre, nature, decision?, auteur? }),
 * contrôlé comme au dépôt sur une base où le service est la source (toutes les tables ouvertes) : lève une Error qui dit les erreurs, avec leur rang, si le service
 * le refuserait. Sert aussi `scripts/baliser-mot-cle.mjs`.
 * @param {import('node:sqlite').DatabaseSync} avant
 * @param {import('node:sqlite').DatabaseSync} apres
 * @param {{ titre: string, nature: string, decision?: string, auteur?: string }} entete
 */
export function lotDesChangements(avant, apres, entete) {
  const { lot } = lotDeLaDifference(differences(avant, apres), apres, entete);
  // les mots-clés créés d'abord : lotDeLaDifference range les modifications avant les insertions, or un texte balisé cite la clé d'un mot-clé que le
  // vocabulaire doit déjà porter (sinon l'essai à blanc refuse : « ne cite aucun mot-clé du vocabulaire »)
  const motCle = (o) => o.operation === 'inserer' && /^mot_cle(_|$)/.test(o.table);
  // les colonnes dérivées (corps et résumé des pages typées, `donnees` des fiches de dons : serveur/edition.mjs#colonneDerivee) sont refaites par le service
  // quand il applique les lignes balisées : le lot ne les porte pas (le service n'écrirait rien, et l'essai refuserait l'opération)
  const sansDerivees = (o) => {
    if (o.operation !== 'modifier') return o;
    const colonnes = Object.keys(o.apres).filter((c) => !colonneDerivee(o.table, o.cle, c));
    return colonnes.length ? { ...o, avant: Object.fromEntries(colonnes.map((c) => [c, o.avant[c]])), apres: Object.fromEntries(colonnes.map((c) => [c, o.apres[c]])) } : null;
  };
  const operations = sansLeRepereDesCrees(lot.operations.map(sansDerivees).filter(Boolean));
  lot.operations = [...operations.filter(motCle), ...operations.filter((o) => !motCle(o))];
  const { valide, erreurs } = controlerLeLot(lot, { structure: structurePourLeLot(apres), ouvertHorsEdition: true });
  if (!valide) throw new Error(`lot refusé : ${erreurs.map((e) => `${e.rang ?? 'en-tête'} : ${e.message}`).join(' ; ')}`);
  return lot;
}

const versionDe = (db) => db.prepare('PRAGMA user_version').get().user_version;
const exemplesDe = (db) => db.prepare("SELECT count(*) AS n FROM page WHERE statut = 'example'").get().n;

/** Le décompte du lot : { operations, tables: { table: { inserer, modifier, supprimer } } }. */
function bilanDuLot(lot) {
  const tables = {};
  for (const o of lot.operations) (tables[o.table] ??= { inserer: 0, modifier: 0, supprimer: 0 })[o.operation] += 1;
  return { operations: lot.operations.length, tables };
}

/**
 * Le lot de nature `source` de ce qui diffère entre `avant` (l'extrait du jour, préparé) et `apres` (la base réimportée). Rien n'est écrit, rien n'est envoyé.
 * Rend { lot, bilan } ; `lot` est null quand les deux bases ne diffèrent pas (aucune opération à proposer). Lève une Error : en-tête refusé, bases incomparables
 * (structure ou pages d'exemple différentes), table sans clé primaire qui diffère (un lot ne saurait pas la désigner), lot refusé par les contrôles.
 * @param {import('node:sqlite').DatabaseSync} avant
 * @param {import('node:sqlite').DatabaseSync} apres
 * @param {{ titre: string, auteur?: string }} entete
 * @returns {{ lot: object|null, bilan: { operations: number, tables: Record<string, { inserer: number, modifier: number, supprimer: number }> } }}
 */
export function lotDeSource(avant, apres, { titre, auteur } = {}) {
  if (typeof titre !== 'string' || !titre.trim()) throw new Error('titre : un texte lisible est attendu');
  const entete = { titre, nature: 'source', ...(auteur ? { auteur } : {}) };
  const nature = controlerLaNature(entete);
  if (nature.length) throw new Error(`lot : ${nature.join(' ; ')}`);
  if (versionDe(avant) !== versionDe(apres)) {
    throw new Error(`les deux bases n'ont pas la même structure (user_version ${versionDe(avant)} et ${versionDe(apres)}) : l'« avant » est l'extrait préparé (db-preparer-contenu.mjs), l'« après » doit avoir la structure du dépôt`);
  }
  if (exemplesDe(avant) !== exemplesDe(apres)) {
    throw new Error(`les deux bases n'ont pas les mêmes pages d'exemple (${exemplesDe(avant)} et ${exemplesDe(apres)}) : des fixtures ne se proposent pas au site de dev ; bâtir l'« après » sans elles (db-derive --sans-exemples)`);
  }
  const diff = differences(avant, apres);
  if (diff.sans_cle) throw new Error(`table(s) sans clé primaire qui diffère(nt) : ${diff.sans_cle.join(', ')} (un lot ne saurait pas les désigner)`);
  if (!Object.keys(diff).length) return { lot: null, bilan: { operations: 0, tables: {} } };
  const lot = lotDesChangements(avant, apres, entete);
  return { lot, bilan: bilanDuLot(lot) };
}

/**
 * Comme `lotDeSource`, sur deux fichiers : `avant` (un extrait du site de dev, jamais modifié : l'outil en prend une copie préparée comme celle du build, migrations
 * manquantes du dépôt appliquées, sans pages d'exemple) et `apres` (une base de la structure du dépôt, ouverte en lecture seule). Écrit le lot dans `sortie`
 * quand il y en a un. N'envoie rien.
 * @param {{ avant: string, apres: string, titre: string, auteur?: string, sortie: string, racine?: string }} o
 */
export function ecrireLeLotDeSource({ avant, apres, titre, auteur, sortie, racine = RACINE }) {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-lot-source-'));
  try {
    const copie = join(tmp, 'avant.db');
    copyFileSync(resolve(avant), copie);
    preparerLeContenu(copie, { racine, exemples: false });
    const a = new DatabaseSync(copie, { readOnly: true });
    const b = new DatabaseSync(resolve(apres), { readOnly: true });
    try {
      const r = lotDeSource(a, b, { titre, auteur });
      if (r.lot) writeFileSync(resolve(sortie), `${JSON.stringify(r.lot, null, 2)}\n`);
      return r;
    } finally {
      a.close();
      b.close();
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Le lot de nature `source` de ce qu'un outil change dans une COPIE de la base `avant` (un fichier de la structure du dépôt, déjà préparé : pas d'extrait brut) : la copie
 * est faite dans un dossier temporaire, `modifier(db)` la retouche (base ouverte en écriture), puis `lotDeSource`. Le fichier `avant` n'est jamais modifié.
 * @param {string} avant
 * @param {(db: import('node:sqlite').DatabaseSync) => void} modifier
 * @param {{ titre: string, auteur?: string }} entete
 */
export function lotDeSourceParModification(avant, modifier, entete) {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-lot-source-'));
  try {
    const copie = join(tmp, 'apres.db');
    copyFileSync(resolve(avant), copie);
    const ecriture = new DatabaseSync(copie);
    try {
      ecriture.exec('PRAGMA foreign_keys = ON');
      modifier(ecriture);
    } finally {
      ecriture.close();
    }
    const a = new DatabaseSync(resolve(avant), { readOnly: true });
    const b = new DatabaseSync(copie, { readOnly: true });
    try {
      return lotDeSource(a, b, entete);
    } finally {
      a.close();
      b.close();
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
  if (args.includes('--envoyer') || args.includes('--deposer')) {
    console.error('Aucune option d\'envoi : le lot se propose au site de dev par un humain (POST /api/edition/lots/, skill modifier-une-page-wiki).');
    process.exit(2);
  }
  const [apres, sortie, titre] = [option('--apres'), option('--lot'), option('--titre')];
  if (!apres || !sortie || !titre) {
    console.error('usage : node scripts/lot-de-source.mjs --apres <base.db> --lot <lot.json> --titre <titre> [--avant <extrait.db>] [--auteur <nom>]');
    process.exit(2);
  }
  const avant = resolve(option('--avant') ?? EXTRAIT_PAR_DEFAUT);
  try {
    const { lot, bilan } = ecrireLeLotDeSource({ avant, apres, titre, auteur: option('--auteur'), sortie });
    if (!lot) {
      console.log(`aucune différence entre ${avant} et ${resolve(apres)} : rien à proposer, aucun fichier écrit.`);
    } else {
      for (const [table, n] of Object.entries(bilan.tables)) console.log(`${table} : ${n.inserer} insérée(s), ${n.modifier} modifiée(s), ${n.supprimer} supprimée(s)`);
      console.log(`lot « ${titre} » (source) : ${bilan.operations} opération(s) -> ${resolve(sortie)}`);
      console.log('à PROPOSER au site de dev par un humain : POST /api/edition/lots/ (skill modifier-une-page-wiki) ; l\'outil n\'envoie rien.');
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
