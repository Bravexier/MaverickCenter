// Les lots de changements (lot 6 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/serveur.md, « Lots de changements » ;
// format : src/lib/lot-de-changements.mjs). Une session de Claude DÉPOSE une proposition avec la clé de lecture (rien n'est écrit dans le contenu : elle est
// essayée à blanc sur une COPIE de la base) ; le propriétaire l'APPLIQUE ou la REFUSE d'un clic (mot de passe), avec l'aperçu avant et après (R275, question 4 a).
//
//   déposer      contrôle du format (controlerLeLot : le refus dit l'opération à corriger), enregistre l'état « propose », lance l'essai à blanc ;
//   essayer      une copie de la base (VACUUM INTO, dans un fil à part : le service ne s'arrête pas), le lot appliqué par LE MÊME code que l'application, puis les
//                contrôles du contenu de `db:check` (serveur/controles-du-contenu.mjs) avant et après : seuls les problèmes qui naissent du lot comptent ;
//   appliquer    d'un seul bloc, dans la transaction et sous le verrou d'écrivain de `enregistrer` (edition.mjs#appliquerUnLot) : la comparaison est refaite
//                au clic (une valeur changée entre-temps n'est pas écrite : le site prime, elle est listée avec la valeur trouvée), les numéros sont donnés, les
//                contrôles du contenu rejoués, puis `lot_de_changements` passe à « applique » ;
//   refuser      l'état « refuse » : la proposition reste, rien n'est écrit.
//
// Les écritures passent par le service d'édition dès que la table lui est connue (risque du lot 6 : une écriture générique contourne les contrôles de
// chaque domaine) : voir `traduire`. Le service ne crée pas une ligne d'une table qu'il crée lui-même (identifiant tiré du nom, page, clés recalculées) :
// l'insertion y est refusée. Une colonne qu'il ne sait pas écrire sur une table connue passe par le journal (voie générique), jugée par l'essai.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { colonneMasquee, nomDeColonne, nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
import { comparerAvecLaBase, controlerLeLot, donnerLesNumeros, FORMAT_DU_LOT, lireUnLot } from '../src/lib/lot-de-changements.mjs';
import { controlerLeContenu } from './controles-du-contenu.mjs';
import { ErreurEdition, appliquerUnLot } from './edition.mjs';
import { libelleDeLigne } from './edition-conflits.mjs';
import { lireLigne, nouveauLot, structure } from './edition-journal.mjs';

/** Le format de l'essai enregistré (`lot_de_changements.essai`). */
export const FORMAT_DE_L_ESSAI = 1;
/** Au plus autant d'opérations par lot (comme un lot de l'édition). */
const OPERATIONS_MAX = 2000;
/** Une valeur de l'aperçu plus longue est coupée (le lot déposé garde tout). */
const VALEUR_MAX = 1500;
/** Les problèmes d'avant l'essai gardés pour le contrôle de l'application. */
const PROBLEMES_MAX = 1000;
const FORME_D_UN_NUMERO_DE_DECISION = /^R[0-9]+$/;

const nombreDe = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const instantMaintenant = () => nouveauLot().instant;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La base
// ---------------------------------------------------------------------------------------------------------------------------------------------

function tableExiste(db, nom) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom);
}

/** Refuse (409) une base d'avant la migration 0128 : les lots de changements n'y ont pas leur table. */
function exigerLesTables(db) {
  if (!tableExiste(db, 'lot_de_changements') || !tableExiste(db, 'numero_donne')) {
    throw new ErreurEdition(409, 'Cette base n’a pas encore les lots de changements (migration 0128) : attendez la prochaine mise à jour du site de dev.');
  }
}

/** La structure d'une table pour `controlerLeLot` : colonnes, types et clé ; null si la table n'existe pas. */
const structureDe = (db) => (table) => {
  try {
    return structure(db, table);
  } catch {
    return null;
  }
};

/** Le fichier de la base ouverte (« » pour une base en mémoire). */
const fichierDe = (db) => db.prepare('PRAGMA database_list').all().find((b) => b.name === 'main')?.file ?? '';

const jsonOuNull = (texte) => {
  if (texte === null || texte === undefined) return null;
  try {
    return JSON.parse(texte);
  } catch {
    return null;
  }
};

/** Une proposition telle que les routes la rendent (le contenu déposé et l'essai lus en objets). `resume` : sans contenu ni aperçu, pour la liste. */
function presenter(ligne, { resume = false } = {}) {
  const essai = jsonOuNull(ligne.essai);
  const base = {
    id: ligne.id, depose_le: ligne.depose_le, titre: ligne.titre, nature: ligne.nature, decision: ligne.decision ?? null, auteur: ligne.auteur ?? null,
    etat: ligne.etat, essaye_le: ligne.essaye_le ?? null, decide_le: ligne.decide_le ?? null, lot_id: ligne.lot_id ?? null,
    annule_le: ligne.annule_le ?? null, annulation_lot_id: ligne.annulation_lot_id ?? null,
    operations: jsonOuNull(ligne.contenu)?.operations?.length ?? 0,
    verdict: essai?.verdict ?? null,
  };
  if (resume) return base;
  return { ...base, contenu: jsonOuNull(ligne.contenu), essai, bilan: jsonOuNull(ligne.bilan), verrous_ouverts: jsonOuNull(ligne.verrous_ouverts) };
}

const ligneDuLot = (db, id) => db.prepare('SELECT * FROM lot_de_changements WHERE id = ?').get(id) ?? null;

function ligneOuErreur(db, id) {
  const ligne = ligneDuLot(db, id);
  if (!ligne) throw new ErreurEdition(404, `Lot de changements introuvable : ${id}`);
  return ligne;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les numéros : un numéro n'est jamais redonné
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Le plus haut numéro connu pour la clé entière d'une table : le plafond déjà donné (`numero_donne`, jamais diminué), le maximum de la colonne, et le plus
 * haut trouvé dans les traces du journal (`modification`) et de l'historique (`historique_modification`) : une ligne retirée, un lot annulé ou une base
 * restaurée (sans `numero_donne`) ne font pas redonner un numéro. La table et la colonne sont vérifiées par PRAGMA table_info avant d'entrer dans le SQL.
 */
export function plusHautNumero(db, table, colonne) {
  const { colonnes } = structure(db, table);
  if (!colonnes.includes(colonne)) throw new ErreurEdition(400, `${table} : colonne inconnue « ${colonne} »`);
  const plafond = db.prepare('SELECT plafond FROM numero_donne WHERE table_nom = ? AND colonne = ?').get(table, colonne)?.plafond ?? 0;
  const dansLaTable = db.prepare(`SELECT max("${colonne}") AS m FROM "${table}"`).get().m ?? 0;
  const chemin = `$."${colonne}"`;
  const dansLaTrace = (trace) => db.prepare(`SELECT max(CAST(json_extract(cle, ?) AS INTEGER)) AS m FROM ${trace} WHERE table_nom = ?`).get(chemin, table).m ?? 0;
  return Math.max(plafond, dansLaTable, dansLaTrace('modification'), dansLaTrace('historique_modification'));
}

/** Monte le plafond d'une colonne (jamais il ne diminue). */
function monterLePlafond(db, table, colonne, plafond) {
  db.prepare('INSERT INTO numero_donne (table_nom, colonne, plafond) VALUES (?, ?, ?) ON CONFLICT (table_nom, colonne) DO UPDATE SET plafond = max(plafond, excluded.plafond)')
    .run(table, colonne, plafond);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les écritures : par le service d'édition dès que la table lui est connue
// ---------------------------------------------------------------------------------------------------------------------------------------------

const entiteDeLaTable = (table) => Object.entries(ENTITES).find(([, e]) => e.table === table) ?? null;
const sous = (valeurs, colonnes) => Object.fromEntries(colonnes.map((c) => [c, valeurs[c]]));

/**
 * Les opérations du service qui écrivent une opération du lot : { ops } ou { refus } (le message dit pourquoi, la correction se fait dans le lot).
 *   - « modifier » : les colonnes que le service sait écrire (celles de `TABLES`) par son opération « modifier » (validation, forme canonique, colonnes
 *     calculées, pages refaites, gel) ; les autres colonnes de la même ligne par la voie générique du journal, dans la même opération du lot ;
 *   - « supprimer » : par l'opération « supprimer » de l'entité de la table quand elle en a une (refus du service comprises : liens rompus, fiches,
 *     R42…) ; une entité sans suppression (familles d'armes, R159) est refusée, jamais supprimée en douce ; une table sans entité : voie générique ;
 *   - « inserer » : refusée sur une table que le service crée lui-même (son identifiant, sa page, ses clés recalculées ne se donnent pas d'un bloc) ;
 *     voie générique sinon.
 */
export function traduire(o) {
  const entite = entiteDeLaTable(o.table);
  if (o.operation === 'modifier') {
    const colonnes = Object.keys(o.apres);
    const connues = TABLES[o.table]?.colonnes ?? {};
    const duService = colonnes.filter((c) => Object.hasOwn(connues, c));
    const autres = colonnes.filter((c) => !duService.includes(c));
    const ops = [];
    if (duService.length) ops.push({ op: 'modifier', table: o.table, cle: o.cle, valeurs: sous(o.apres, duService) });
    if (autres.length) ops.push({ op: 'ecrire_modifier', table: o.table, cle: o.cle, valeurs: sous(o.apres, autres) });
    return { ops };
  }
  if (o.operation === 'supprimer') {
    if (!entite) return { ops: [{ op: 'ecrire_supprimer', table: o.table, cle: o.cle }] };
    if (!entite[1].suppression) return { refus: `« ${nomDeTable(o.table) ?? o.table} » : le service d’édition ne supprime pas cette ligne (la création y est permise, pas la suppression)` };
    return { ops: [{ op: 'supprimer', entite: entite[0], cle: o.cle }] };
  }
  if (entite) {
    return { refus: `« ${nomDeTable(o.table) ?? o.table} » : le service d’édition crée lui-même cette ligne (identifiant tiré du nom, page, clés recalculées) : un lot ne l’insère pas, elle se crée par le service` };
  }
  return { ops: [{ op: 'ecrire_inserer', table: o.table, valeurs: o.apres }] };
}

/** Les numéros de décision que cite un refus du service (« décision R218 », « décisions R218, R219 ») : ce qu'il verrouille au nom du propriétaire. */
export const decisionsCitees = (message) => [...new Set(String(message ?? '').match(/\bR[0-9]+\b/g) ?? [])];

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'aperçu
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une valeur pour l'aperçu : coupée si elle est longue (`tronquee`). */
function valeurCourte(v) {
  if (typeof v === 'string' && v.length > VALEUR_MAX) return { valeur: `${v.slice(0, VALEUR_MAX)}…`, tronquee: true };
  return { valeur: v ?? null, tronquee: false };
}

/** L'aperçu d'une opération : la table et la ligne par leurs noms, chaque colonne par son libellé, avec la valeur d'avant (celle de la base) et d'après. */
function apercuDe(db, o, ligne) {
  const colonnes = Object.keys(o.operation === 'supprimer' ? o.avant : o.apres).filter((c) => !colonneMasquee(o.table, c));
  let libelle;
  try {
    libelle = libelleDeLigne(o.table, ligne ?? o.apres ?? o.avant, o.cle, db);
  } catch {
    libelle = JSON.stringify(o.cle);
  }
  return {
    table: nomDeTable(o.table) ?? o.table,
    ligne: libelle,
    colonnes: colonnes.map((c) => {
      const avant = o.operation === 'inserer' ? { valeur: null, tronquee: false } : valeurCourte(ligne?.[c]);
      const apres = o.operation === 'supprimer' ? { valeur: null, tronquee: false } : valeurCourte(o.apres[c]);
      return { colonne: c, libelle: nomDeColonne(o.table, c) ?? c, avant: avant.valeur, apres: apres.valeur, ...(avant.tronquee || apres.tronquee ? { tronquee: true } : {}) };
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le travail d'un lot : le même code pour l'essai (sur la copie) et l'application (sur la base vivante)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Applique le lot par le service d'édition, d'un bloc (edition.mjs#appliquerUnLot), et rend chaque opération jugée.
 * @param {import('node:sqlite').DatabaseSync} db la copie (essai) ou la base vivante (application)
 * @param {{ id: string, titre: string, nature: string, decision: string | null, lot: object }} depose la proposition (`lot` : le contenu déposé)
 * @param {{ essai: boolean, ouverts?: Set<string>, baseline?: Set<string>, enregistrer?: (db: object, sorties: object) => void }} o
 *   `essai` : chaque opération est jugée à part (une refusée n'arrête pas les autres) ; sinon la première refusée arrête tout (rien n'est écrit) ;
 *   `ouverts` : les décisions que le propriétaire accepte d'ouvrir ; `baseline` : les problèmes du contenu d'avant (application : ceux qui naissent du lot
 *   refusent l'application) ; `enregistrer` : ce qui s'écrit de la proposition dans la même transaction (application)
 * @returns {{ lot: string | null, sorties: { operations: object[], numeros: object[], verrous: string[] } }}
 */
function appliquerLeLot(db, depose, { essai, ouverts = new Set(), baseline = new Set(), enregistrer = null }) {
  const sorties = { operations: [], numeros: [], verrous: [] };
  const travail = (hote) => {
    const { lot: resolu, numeros } = donnerLesNumeros(depose.lot, (table, colonne) => plusHautNumero(db, table, colonne));
    sorties.numeros = numeros;
    const comparaison = comparerAvecLaBase(resolu, (table, cle) => lireLigne(db, table, cle));
    const verrous = new Set();
    resolu.operations.forEach((o, i) => {
      const rang = i + 1;
      const c = comparaison.operations[i];
      const ligne = lireLigne(db, o.table, o.cle);
      const base = { rang, table: o.table, cle: o.cle, operation: o.operation, apercu: apercuDe(db, o, ligne) };
      const noter = (etat, plus = {}) => sorties.operations.push({ ...base, etat, ...plus });
      const refuser = (message, plus = {}) => {
        if (essai) return noter('refusee', { message, ...plus });
        throw new ErreurEdition(409, `Opération ${rang} refusée : ${message}`, { rang, table: o.table, cle: o.cle, ...plus });
      };
      if (c.etat === 'changee') return noter('changee', { raison: c.raison, ecarts: c.ecarts });
      const { ops, refus } = traduire(o);
      if (refus) return refuser(refus);
      const jouer = (gel) => hote.isoler(() => {
        const avant = hote.ecrites();
        ops.forEach((op) => hote.executer(op, { gel }));
        // le service peut ramener une valeur à celle qui est déjà en place (forme canonique, choix inconnu) : l'opération n'a alors rien changé, ce n'est pas
        // ce que le lot demandait
        if (hote.ecrites() === avant) throw new ErreurEdition(409, 'le service d’édition n’a rien écrit pour cette opération (la valeur donnée est ramenée à celle qui est déjà en place, ou il ne la retient pas)');
      });
      try {
        jouer(true);
        return noter(essai ? 'applicable' : 'ecrite');
      } catch (e1) {
        if (!(e1 instanceof ErreurEdition)) {
          if (!essai) throw e1;
          return refuser(`erreur inattendue : ${e1?.message ?? e1}`);
        }
        const decisions = decisionsCitees(e1.message);
        if (!decisions.length) return refuser(e1.message, { statut: e1.statut });
        // le refus cite une décision : un verrou du propriétaire si l'ouvrir (le gel des mots-clés verrouillés et des monnaies, R218, R219) le lève, une
        // règle sinon (R105…) : on ne sait ce qu'une décision verrouille que par ce que le service accepte quand le gel est ouvert
        if (!essai && !decisions.every((d) => ouverts.has(d))) {
          throw new ErreurEdition(409, `Opération ${rang} verrouillée par ${decisions.join(', ')} : ${e1.message}`, { rang, table: o.table, cle: o.cle, verrous: decisions });
        }
        try {
          jouer(false);
        } catch (e2) {
          if (!(e2 instanceof ErreurEdition)) throw e2;
          return refuser(e1.message, { statut: e1.statut, decisions });
        }
        decisions.forEach((d) => verrous.add(d));
        return noter(essai ? 'verrouillee' : 'ecrite', { decisions, message: e1.message });
      }
    });
    sorties.verrous = [...verrous].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    if (!essai) {
      if (!hote.ecrites()) {
        throw new ErreurEdition(409, 'Rien à écrire : chaque opération du lot a changé entre-temps (le site prime). Le lot reste proposé : refusez-le, ou déposez-en un nouveau.', { operations: sorties.operations.map(resumerLOperation) });
      }
      // les contrôles du contenu, dans la transaction : un problème né du lot refuse l'application (rien n'est écrit)
      const nouveaux = controlerLeContenu(db).problemes.filter((p) => !baseline.has(p));
      if (nouveaux.length) {
        throw new ErreurEdition(409, `Les contrôles du contenu refusent le lot depuis l’essai (${nombreDe(nouveaux.length, 'problème', 'problèmes')}) : ${nouveaux.slice(0, 5).join(' ; ')}. Refaites l’essai.`, { problemes: nouveaux.slice(0, 40) });
      }
      for (const n of numeros) monterLePlafond(db, n.table, n.colonne, n.numero);
      enregistrer?.(db, sorties, hote);
    }
  };
  const resultat = appliquerUnLot(db, { titre: depose.titre, nature: depose.nature, decision: depose.decision, travail });
  return { lot: resultat.lot, sorties };
}

/** Une opération pour le bilan : ce qui s'est passé, sans l'aperçu ni les valeurs du lot (celles-ci restent dans le contenu déposé). */
function resumerLOperation(o) {
  const { apercu: _apercu, ...reste } = o;
  return reste;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'essai à blanc, sur une copie
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le verdict d'un essai : `a_corriger` (une opération refusée, un problème né du lot, rien à écrire), `verrous` (il faut l'accord du propriétaire), `applicable`. */
function verdictDe(comptes, verrous, nouveaux) {
  if (comptes.refusees || nouveaux.length) return 'a_corriger';
  if (!comptes.applicables && !comptes.verrouillees) return 'rien_a_ecrire';
  return verrous.length ? 'verrous' : 'applicable';
}

/**
 * Essaie un lot sur une copie de la base (jamais la base elle-même) : une copie du fichier `source` (VACUUM INTO, lu en lecture seule) dans `dossier`,
 * le lot appliqué par `appliquerLeLot`, puis les contrôles du contenu avant et après : seuls les problèmes qui naissent du lot comptent. La copie est
 * supprimée à la fin, même en cas d'échec. Synchrone (un fil à part dans le service : `essayerEnArrierePlan`).
 * @param {{ source: string, dossier: string, depose: { id: string, titre: string, nature: string, decision: string | null, lot: object }, instant?: string }} o
 * @returns {object} l'essai tel qu'il s'enregistre (`lot_de_changements.essai`)
 */
export function essayerLeLot({ source, dossier, depose, instant = instantMaintenant() }) {
  const t0 = performance.now();
  mkdirSync(dossier, { recursive: true });
  const copie = join(dossier, `essai-${process.pid}-${randomUUID()}.db`);
  let db = null;
  try {
    const lecture = new DatabaseSync(source, { readOnly: true });
    try {
      lecture.prepare('VACUUM INTO ?').run(copie);
    } finally {
      lecture.close();
    }
    db = new DatabaseSync(copie);
    db.exec('PRAGMA foreign_keys = ON');
    const avant = controlerLeContenu(db).problemes;
    const connus = new Set(avant);
    let sorties = { operations: [], numeros: [], verrous: [] };
    let refusDeLApplication = null;
    try {
      sorties = appliquerLeLot(db, depose, { essai: true }).sorties;
    } catch (e) {
      // ce que la base refuse à la validation de la transaction (clé étrangère différée…) : le lot entier est à corriger
      if (!(e instanceof ErreurEdition)) throw e;
      refusDeLApplication = e.message;
    }
    const apres = refusDeLApplication ? [] : controlerLeContenu(db).problemes;
    const nouveaux = apres.filter((p) => !connus.has(p));
    const comptes = { applicables: 0, changees: 0, verrouillees: 0, refusees: 0 };
    for (const o of sorties.operations) comptes[{ applicable: 'applicables', changee: 'changees', verrouillee: 'verrouillees', refusee: 'refusees' }[o.etat]] += 1;
    if (refusDeLApplication) comptes.refusees += 1;
    const verdict = refusDeLApplication ? 'a_corriger' : verdictDe(comptes, sorties.verrous, nouveaux);
    return {
      format: FORMAT_DE_L_ESSAI,
      verdict,
      comptes,
      verrous_a_ouvrir: sorties.verrous,
      ...(refusDeLApplication ? { refus_de_l_application: refusDeLApplication } : {}),
      operations: sorties.operations,
      // les numéros que l'application donnerait maintenant : provisoires, l'application les donne au clic (jamais un numéro redonné)
      numeros: sorties.numeros,
      problemes_nouveaux: nouveaux.slice(0, 40),
      problemes_nouveaux_total: nouveaux.length,
      problemes_avant: avant.slice(0, PROBLEMES_MAX),
      problemes_avant_total: avant.length,
      duree_ms: Math.round(performance.now() - t0),
    };
  } finally {
    db?.close();
    for (const suffixe of ['', '-wal', '-shm', '-journal']) rmSync(`${copie}${suffixe}`, { force: true });
  }
}

/**
 * Supprime les copies d'essai restées dans `<dossier>/essais/` (un service arrêté en plein essai : `essayerLeLot` les supprime sinon). À l'ouverture du
 * service, avant tout essai : aucun n'est en cours. Rend le nombre de fichiers retirés.
 */
export function purgerLesEssais(dossier) {
  const essais = join(dossier, 'essais');
  if (!existsSync(essais)) return 0;
  let n = 0;
  for (const nom of readdirSync(essais)) {
    if (!/^essai-[0-9]+-[0-9a-f-]{36}\.db/.test(nom)) continue;
    rmSync(join(essais, nom), { force: true });
    n += 1;
  }
  return n;
}

// Le même module sert de fil de travail : l'essai y tourne sans bloquer le service (comme l'extrait, serveur/extrait.mjs)
if (!isMainThread && workerData?.maverickEssaiDuLot) {
  try {
    parentPort.postMessage({ essai: essayerLeLot(workerData.maverickEssaiDuLot) });
  } catch (e) {
    parentPort.postMessage({ erreur: String(e?.message ?? e) });
  }
}

/** L'essai dans un fil à part : une promesse de l'essai. */
function essayerEnArrierePlan(options) {
  return new Promise((ok, ko) => {
    const fil = new Worker(fileURLToPath(import.meta.url), { workerData: { maverickEssaiDuLot: options } });
    let reponse = null;
    fil.once('message', (m) => { reponse = m; });
    fil.once('error', ko);
    fil.once('exit', (code) => {
      if (reponse?.essai) ok(reponse.essai);
      else ko(new Error(reponse?.erreur ?? `le fil de l’essai s’est arrêté (code ${code})`));
    });
  });
}

let file = Promise.resolve(); // un essai à la fois : une copie de la base et deux contrôles complets chacun
const enFile = (travail) => {
  const suite = file.then(travail, travail);
  file = suite.catch(() => {});
  return suite;
};

/**
 * Essaie la proposition `id` et enregistre l'essai (`essai`, `essaye_le` : rien d'autre ne change). Une promesse de la proposition. Un échec de l'essai
 * lui-même (copie impossible…) s'enregistre comme un essai « en_echec » : le dépôt n'est jamais perdu.
 * @param {() => import('node:sqlite').DatabaseSync | null} base la base vivante (relue après l'attente : elle peut avoir été refaite)
 * @param {{ enArrierePlan?: boolean, dossier?: string }} [o]
 */
export function essayerLaProposition(base, id, { enArrierePlan = true, dossier = null } = {}) {
  const db0 = base();
  if (!db0) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
  exigerLesTables(db0);
  const ligne = ligneOuErreur(db0, id);
  if (ligne.etat !== 'propose') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot proposé s’essaie.`);
  const source = fichierDe(db0);
  if (!source) throw new ErreurEdition(503, 'La base vivante n’est pas un fichier : l’essai à blanc a besoin d’une copie.');
  const options = {
    source,
    dossier: dossier ?? join(dirname(source), 'essais'),
    depose: { id, titre: ligne.titre, nature: ligne.nature, decision: ligne.decision ?? null, lot: lireUnLot(ligne.contenu) },
  };
  return enFile(async () => {
    let essai;
    try {
      essai = enArrierePlan ? await essayerEnArrierePlan(options) : essayerLeLot(options);
    } catch (e) {
      essai = { format: FORMAT_DE_L_ESSAI, verdict: 'en_echec', erreur: String(e?.message ?? e), operations: [], numeros: [] };
    }
    const db = base();
    if (!db) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
    const maintenant = instantMaintenant();
    // la proposition a pu être appliquée ou refusée pendant l'essai : son essai ne change plus
    db.prepare("UPDATE lot_de_changements SET essai = ?, essaye_le = max(?, depose_le) WHERE id = ? AND etat = 'propose'").run(JSON.stringify(essai), maintenant, id);
    return presenter(ligneOuErreur(db, id));
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les routes
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les erreurs de format d'un lot, en un message qui dit les opérations à corriger. */
function messageDesErreurs(erreurs) {
  return `Le lot est refusé (${nombreDe(erreurs.length, 'erreur', 'erreurs')}) : ${erreurs.slice(0, 5).map((e) => e.message).join(' ; ')}${erreurs.length > 5 ? ` ; … (${erreurs.length - 5} de plus)` : ''}`;
}

/**
 * Dépose une proposition : contrôle le format (`controlerLeLot`), l'enregistre « propose » et lance son essai. N'écrit rien dans le contenu.
 * @param {() => import('node:sqlite').DatabaseSync | null} base
 * @param {unknown} corps le lot (objet : `format`, `titre`, `nature`, `decision`, `auteur`, `operations`)
 * @param {{ instant?: string, id?: string, controle?: object, enArrierePlan?: boolean, dossier?: string }} [options] `controle` : des options de
 *   `controlerLeLot` (les tests ouvrent `ouvertHorsEdition` pour éprouver les numéros ; aucune route ne le donne : le lot reste éteint hors édition)
 * @returns {Promise<object>} la proposition avec son essai
 */
export function deposer(base, corps, { instant = instantMaintenant(), id = randomUUID(), controle = {}, ...options } = {}) {
  const db = base();
  if (!db) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
  exigerLesTables(db);
  const { valide, erreurs } = controlerLeLot(corps, { structure: structureDe(db), ...controle });
  if (!valide) throw new ErreurEdition(400, messageDesErreurs(erreurs), { format: FORMAT_DU_LOT, erreurs });
  if (corps.operations.length > OPERATIONS_MAX) throw new ErreurEdition(400, `Trop d’opérations dans un lot (au plus ${OPERATIONS_MAX}).`);
  const contenu = JSON.stringify(corps);
  db.prepare("INSERT INTO lot_de_changements (id, depose_le, titre, nature, decision, auteur, contenu, etat) VALUES (?, ?, ?, ?, ?, ?, ?, 'propose')")
    .run(id, instant, corps.titre.trim(), corps.nature, corps.decision ?? null, typeof corps.auteur === 'string' && corps.auteur.trim() ? corps.auteur.trim() : null, contenu);
  return essayerLaProposition(base, id, options);
}

/** Les propositions, la plus récente d'abord (sans contenu ni aperçu : `lire` les rend). */
export function lister(db) {
  exigerLesTables(db);
  return db.prepare('SELECT * FROM lot_de_changements ORDER BY depose_le DESC, id').all().map((l) => presenter(l, { resume: true }));
}

/** Une proposition en entier : le contenu déposé, l'essai (aperçu avant et après), le bilan de l'application. */
export function lire(db, id) {
  exigerLesTables(db);
  return presenter(ligneOuErreur(db, id));
}

/** `verrous_ouverts` du clic d'application : une liste de numéros « R… » (vide ou absente : aucun). */
function verrousDuClic(valeur) {
  if (valeur === undefined || valeur === null) return new Set();
  if (!Array.isArray(valeur) || valeur.some((v) => typeof v !== 'string' || !FORME_D_UN_NUMERO_DE_DECISION.test(v))) {
    throw new ErreurEdition(400, 'verrous_ouverts : une liste de numéros de décision est attendue (ex. ["R218"]).');
  }
  return new Set(valeur);
}

/**
 * Applique la proposition d'un clic du propriétaire (mot de passe) : d'un seul bloc, par le service d'édition. Refusée (409, rien n'est écrit) si l'essai
 * a des opérations refusées, si les contrôles du contenu échouent, si un verrou de décision n'est pas ouvert dans `corps.verrous_ouverts`, ou si rien ne
 * reste à écrire. Une valeur changée depuis l'essai n'est pas écrite : elle est listée dans le bilan avec la valeur trouvée (le site prime).
 * @param {import('node:sqlite').DatabaseSync} db la base vivante
 * @param {string} id
 * @param {{ verrous_ouverts?: string[] }} [corps]
 */
export function appliquer(db, id, corps = {}) {
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  if (ligne.etat !== 'propose') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot proposé s’applique.`);
  const ouverts = verrousDuClic(corps?.verrous_ouverts);
  const essai = jsonOuNull(ligne.essai);
  if (!essai || essai.format !== FORMAT_DE_L_ESSAI || essai.verdict === 'en_echec') {
    throw new ErreurEdition(409, 'Ce lot n’a pas d’essai à blanc valide : refaites l’essai avant de l’appliquer.');
  }
  if (essai.verdict === 'a_corriger') {
    const refusees = (essai.operations ?? []).filter((o) => o.etat === 'refusee').map((o) => `opération ${o.rang} : ${o.message}`);
    const raisons = [...refusees, ...(essai.refus_de_l_application ? [essai.refus_de_l_application] : []), ...(essai.problemes_nouveaux ?? []).slice(0, 5)];
    throw new ErreurEdition(409, `L’essai du lot a des refus à corriger : ${raisons.slice(0, 5).join(' ; ')}`, { verdict: essai.verdict, operations: refusees });
  }
  const manquants = (essai.verrous_a_ouvrir ?? []).filter((d) => !ouverts.has(d));
  if (manquants.length) {
    throw new ErreurEdition(409, `Ce lot touche ce que ${manquants.join(', ')} verrouille${manquants.length > 1 ? 'nt' : ''} : ouvrez-le${manquants.length > 1 ? 's' : ''} au clic (verrous_ouverts) pour l’appliquer.`, { verrous: manquants });
  }
  const depose = { id, titre: ligne.titre, nature: ligne.nature, decision: ligne.decision ?? null, lot: lireUnLot(ligne.contenu) };
  // dans la transaction du service, une fois les écritures faites et contrôlées : la proposition passe à « applique », avec son lot du journal et son bilan
  const enregistrer = (base, sorties, hote) => {
    const bilan = {
      operations: sorties.operations.map(resumerLOperation),
      ecrites: sorties.operations.filter((o) => o.etat === 'ecrite').length,
      changees: sorties.operations.filter((o) => o.etat === 'changee').length,
      numeros: sorties.numeros,
      verrous_ouverts: sorties.verrous,
    };
    base.prepare("UPDATE lot_de_changements SET etat = 'applique', decide_le = max(?, depose_le), lot_id = ?, verrous_ouverts = ?, bilan = ? WHERE id = ? AND etat = 'propose'")
      .run(hote.instant, hote.id, sorties.verrous.length ? JSON.stringify(sorties.verrous) : null, JSON.stringify(bilan), id);
  };
  appliquerLeLot(db, depose, { essai: false, ouverts, baseline: new Set(essai.problemes_avant ?? []), enregistrer });
  return presenter(ligneOuErreur(db, id));
}

/** Refuse la proposition (mot de passe) : l'état « refuse », rien d'écrit dans le contenu. Elle reste lisible. */
export function refuser(db, id) {
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  if (ligne.etat !== 'propose') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot proposé se refuse.`);
  db.prepare("UPDATE lot_de_changements SET etat = 'refuse', decide_le = max(?, depose_le) WHERE id = ? AND etat = 'propose'").run(instantMaintenant(), id);
  return presenter(ligneOuErreur(db, id));
}
