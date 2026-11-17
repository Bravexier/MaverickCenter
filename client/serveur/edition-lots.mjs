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
//   refuser      l'état « refuse » : la proposition reste, rien n'est écrit ;
//   annuler      un lot appliqué : `avant` est remis là où la valeur vaut encore ce que le lot a écrit (le site prime), d'un bloc, par le même code que l'application ; son
//                aperçu se calcule sur une copie ;
//   recalculer   « tout recalculer » : les écarts des colonnes dérivées, calculés sur une copie, sont DÉPOSÉS comme un lot de nature « code » (jamais écrits d'office).
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
import { TABLES_DE_LA_PAGE_DES_ARMES } from '../src/lib/corps-armes.mjs';
import { TABLES_DES_PAGES_DES_ARMURES } from '../src/lib/corps-armures.mjs';
import { TABLES_DES_COMPOSANTS } from '../src/lib/corps-composants.mjs';
import { PAGE_DE_LA_LIGNE } from '../src/lib/corps-magies.mjs';
import { TABLES_DES_POTIONS } from '../src/lib/corps-potions.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { colonneMasquee, nomDeColonne, nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
import { comparerAvecLaBase, controlerLeLot, donnerLesNumeros, effetNetDuLot, FORMAT_DU_LOT, jugerLAnnulation, lireUnLot } from '../src/lib/lot-de-changements.mjs';
import { controlerLeContenu } from './controles-du-contenu.mjs';
import { ErreurEdition, appliquerUnLot, colonneDerivee, recalculerLesPages } from './edition.mjs';
import { libelleDeLigne } from './edition-conflits.mjs';
import { lireLigne, monterLePlafond, nouveauLot, plusHautNumero, structure } from './edition-journal.mjs';

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
    const s = structure(db, table);
    const etrangeres = Object.fromEntries(db.prepare(`PRAGMA foreign_key_list("${table}")`).all().map((f) => [f.from, f.table]));
    return { ...s, etrangeres };
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

// Les numéros (un numéro n'est jamais redonné) : edition-journal.mjs#plusHautNumero, #monterLePlafond, #donnerUnNumero, une seule règle pour les lots et
// pour l'édition des mots-clés.
export { plusHautNumero };

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les écritures : par le service d'édition dès que la table lui est connue
// ---------------------------------------------------------------------------------------------------------------------------------------------

const entiteDeLaTable = (table) => Object.entries(ENTITES).find(([, e]) => e.table === table) ?? null;
const sous = (valeurs, colonnes) => Object.fromEntries(colonnes.map((c) => [c, valeurs[c]]));

/**
 * Les opérations du service qui écrivent une opération du lot : { ops } ou { refus } (le message dit pourquoi, la correction se fait dans le lot).
 *   - « modifier » : les colonnes que le service sait écrire (celles de `TABLES`, hors colonnes dérivées) par son opération « modifier » (validation, forme
 *     canonique, colonnes calculées, pages refaites, gel) ; les autres colonnes de la même ligne par la voie générique du journal, dans la même opération du lot ;
 *   - « supprimer » : par l'opération « supprimer » de l'entité de la table quand elle en a une (refus du service comprises : liens rompus, fiches,
 *     R42…) ; une entité sans suppression (familles d'armes, R159) est refusée, jamais supprimée en douce ; une table sans entité : voie générique ;
 *   - « inserer » : un mot-clé se crée par le service (`traduireLaCreationDUnMotCle` : id suivant, clé, puis vérification que la ligne créée est celle du
 *     lot) ; refusée sur les autres tables que le service crée lui-même (son identifiant, sa page, ses clés recalculées ne se donnent pas d'un bloc) ;
 *     voie générique sinon.
 */
export function traduire(o) {
  const entite = entiteDeLaTable(o.table);
  if (o.operation === 'modifier') {
    const colonnes = Object.keys(o.apres);
    const connues = TABLES[o.table]?.colonnes ?? {};
    // une colonne dérivée (le corps d'une page typée : le service la refait depuis les tables et refuse qu'on l'écrive) passe par le journal, comme celles qu'il ne connaît pas
    const duService = colonnes.filter((c) => Object.hasOwn(connues, c) && !colonneDerivee(o.table, o.cle, c));
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
    if (o.table === 'mot_cle') return traduireLaCreationDUnMotCle(o);
    return { refus: `« ${nomDeTable(o.table) ?? o.table} » : le service d’édition crée lui-même cette ligne (identifiant tiré du nom, page, clés recalculées) : un lot ne l’insère pas, elle se crée par le service` };
  }
  return { ops: [{ op: 'ecrire_inserer', table: o.table, valeurs: o.apres }] };
}

/** Les colonnes d'un mot-clé que le service écrit à la création (ENTITES.mot_cle.champs), qu'il tire lui-même (id, clé) ou qu'il tient (verrou, R218 (4)). */
const COLONNES_D_UN_MOT_CLE_CREE = Object.freeze(['id', 'libelle', 'cle', 'description', 'url', 'couleur', 'icone', 'verrou']);

/**
 * L'insertion d'un mot-clé par le lot : le service le CRÉE (`creer` de l'entité : id suivant, clé de la règle R232, adresse, couleur et icône contrôlées),
 * puis `verrou` à 1 par la voie générique quand le lot le veut (colonne tenue par le service : le verrou R218 la gèle, le propriétaire l'ouvre au clic),
 * enfin le lot VÉRIFIE que la ligne créée est celle qu'il décrit (identifiant donné à l'application, clé, valeurs) : sinon l'opération est refusée.
 * Ses catégories sont des lignes de `mot_cle_categorie` (opérations du lot à part : table hors édition, lot 8). Un mot-clé d'une monnaie (`monnaie_id`) ou
 * une colonne que le service ne sait pas écrire à la création : refus.
 */
function traduireLaCreationDUnMotCle(o) {
  const a = o.apres;
  const autres = Object.keys(a).filter((c) => !COLONNES_D_UN_MOT_CLE_CREE.includes(c) && a[c] !== null && a[c] !== undefined);
  if (autres.length) return { refus: `« Mot-clé » : le service d’édition ne crée pas un mot-clé avec ${autres.map((c) => `« ${c} »`).join(', ')}` };
  if (![0, 1, null, undefined].includes(a.verrou)) return { refus: '« Mot-clé » : « verrou » vaut 0 ou 1' };
  const valeurs = Object.fromEntries(['libelle', 'description', 'url', 'couleur', 'icone'].filter((c) => a[c] !== null && a[c] !== undefined).map((c) => [c, a[c]]));
  const cle = { id: a.id };
  const ops = [{ op: 'creer', entite: 'mot_cle', valeurs }];
  if (a.verrou === 1) ops.push({ op: 'ecrire_modifier', table: 'mot_cle', cle, valeurs: { verrou: 1 } });
  // le lot attend ce qu'il dit : seules les colonnes qu'il écrit se vérifient (l'identifiant, la clé, les valeurs données)
  ops.push({ op: 'verifier_ligne', table: 'mot_cle', cle, attendu: Object.fromEntries(Object.keys(a).filter((c) => COLONNES_D_UN_MOT_CLE_CREE.includes(c)).map((c) => [c, a[c]])) });
  return { ops };
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
 * Écrit les opérations `ops` d'une opération du lot par l'hôte d'`appliquerUnLot`, isolées (un refus n'écrit rien) et sous le gel ; un refus qui cite une
 * décision que le gel lève est « verrouillée » : il ne s'écrit que si le propriétaire a ouvert tous ses numéros (`ouverts`, au clic), sous un gel ouvert pour
 * cette seule opération. Sert à l'application et à l'annulation d'un lot (une seule règle des verrous).
 * @param {{ ecrite: string, verrouillee: string }} etats ce que `noter` reçoit quand l'opération s'écrit (ou pourrait s'écrire, à l'essai) sans, puis avec verrou
 * @param {((op: object) => object | null) | null} [adapter] relit l'état du moment avant chaque opération : l'opération à jouer, ou null (rien à faire)
 * @param {{ rang: number, table: string, cle: object }} o l'opération (pour le message d'un refus)
 */
function ecrireLesOperations(hote, ops, { essai, ouverts, verrous, rang, o, noter, refuser, etats, adapter = null }) {
  const jouer = (gel) => hote.isoler(() => {
    const avant = hote.ecrites();
    for (const op of ops) {
      const aJouer = adapter ? adapter(op) : op;
      if (aJouer) hote.executer(aJouer, { gel });
    }
    // le service peut ramener une valeur à celle qui est déjà en place (forme canonique, choix inconnu) : l'opération n'a alors rien changé, ce n'est pas
    // ce que le lot demandait
    if (hote.ecrites() === avant) throw new ErreurEdition(409, 'le service d’édition n’a rien écrit pour cette opération (la valeur donnée est ramenée à celle qui est déjà en place, ou il ne la retient pas)');
  });
  try {
    jouer(true);
    return noter(etats.ecrite);
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
    return noter(etats.verrouillee, { decisions, message: e1.message });
  }
}

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
      return ecrireLesOperations(hote, ops, { essai, ouverts, verrous, rang, o, noter, refuser, etats: { ecrite: essai ? 'applicable' : 'ecrite', verrouillee: essai ? 'verrouillee' : 'ecrite' } });
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
 * @param {{ source: string, dossier: string, depose: { id: string, titre: string, nature: string, decision: string | null, lot: object } }} o
 * @returns {object} l'essai tel qu'il s'enregistre (`lot_de_changements.essai`)
 */
export function essayerLeLot({ source, dossier, depose }) {
  const t0 = performance.now();
  return surUneCopie({ source, dossier }, (db) => {
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
  });
}

/**
 * Une copie de la base `source` (VACUUM INTO, lue en lecture seule) dans `dossier`, ouverte en écriture avec les clés étrangères contrôlées, que `faire`
 * reçoit ; la copie est supprimée à la fin, même en cas d'échec. Jamais la base elle-même : l'essai d'un lot et l'aperçu d'une annulation s'y font.
 */
function surUneCopie({ source, dossier }, faire) {
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
    return faire(db);
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

/** Un travail dans un fil à part (`cle` : une clé de `TRAVAUX`) : une promesse de son résultat. */
function enArrierePlan(cle, options) {
  return new Promise((ok, ko) => {
    const fil = new Worker(fileURLToPath(import.meta.url), { workerData: { [cle]: options } });
    let reponse = null;
    fil.once('message', (m) => { reponse = m; });
    fil.once('error', ko);
    fil.once('exit', (code) => {
      if (reponse?.essai) ok(reponse.essai);
      else ko(new Error(reponse?.erreur ?? `le fil de l’essai s’est arrêté (code ${code})`));
    });
  });
}
const essayerEnArrierePlan = (options) => enArrierePlan('maverickEssaiDuLot', options);

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
// Annuler un lot appliqué : remettre `avant` là où la valeur vaut encore ce que le lot a écrit
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les lignes du lot du journal (`lot_id`), dans l'ordre des rangs : celles de `modification` (le lot est au journal), à défaut celles de
 * `historique_modification` (le lot a été rapatrié depuis). Refus (409) d'un lot qui n'y est plus, ou en conflit (il se règle d'abord sur la page « Mise à jour »).
 */
function lignesDuLot(db, lotId) {
  const lire = (table, etat) => db.prepare(`SELECT rang, table_nom, cle, operation, avant, apres${etat} FROM ${table} WHERE lot_id = ? ORDER BY rang`).all(lotId);
  let lignes = lire('modification', ', etat');
  if (lignes.some((l) => l.etat === 'conflit')) {
    throw new ErreurEdition(409, 'Le lot du journal de ce lot est en conflit avec les règles livrées : résolvez-le d’abord sur la page « Mise à jour ». Il reste appliqué.');
  }
  if (!lignes.length && tableExiste(db, 'historique_modification')) lignes = lire('historique_modification', '');
  if (!lignes.length) throw new ErreurEdition(409, 'Le lot du journal de ce lot n’a plus de ligne (il a été retiré du journal) : rien à remettre. Il reste appliqué.');
  return lignes.map((l) => ({ rang: l.rang, table: l.table_nom, cle: JSON.parse(l.cle), operation: l.operation, avant: jsonOuNull(l.avant), apres: jsonOuNull(l.apres) }));
}

/**
 * Ce que l'annulation défait, dans l'ordre où elle le fait : d'abord les lignes que le lot a retirées (réinsérées, la dernière retirée d'abord : un parent
 * avant ses enfants), puis les colonnes qu'il a changées (dans l'ordre du lot : le service recalcule ce qui en dépend, une clé, une page ; la remise d'une
 * colonne dérivée qu'il recalculait déjà la trouve remise : `deja`), enfin les lignes qu'il a créées (supprimées, la dernière créée d'abord : un enfant avant
 * son parent).
 */
function planDeLAnnulation(db, lotId) {
  const nets = effetNetDuLot(lignesDuLot(db, lotId));
  return [
    ...nets.filter((n) => n.genre === 'supprimer').reverse(),
    ...nets.filter((n) => n.genre === 'modifier'),
    ...nets.filter((n) => n.genre === 'inserer').reverse(),
  ];
}

/** Les opérations du service qui remettent une ligne : { ops } ou { refus }. La réinsertion d'une ligne retirée par le lot est une restauration à l'identique. */
function operationsDeLAnnulation(db, net, jugement) {
  if (net.genre === 'modifier') return traduire({ table: net.table, cle: net.cle, operation: 'modifier', apres: sous(net.origine, jugement.remises) });
  if (net.genre === 'inserer') return traduire({ table: net.table, cle: net.cle, operation: 'supprimer' });
  const { colonnes } = structure(db, net.table);
  return { ops: [{ op: 'ecrire_inserer', table: net.table, valeurs: sous(net.origine, Object.keys(net.origine).filter((c) => colonnes.includes(c))), restaurer: true }] };
}

/**
 * L'écriture générique d'une remise, réduite aux colonnes qui valent encore ce que le lot a écrit (la ligne actuelle, relue : une remise précédente du service a pu
 * en ramener une) ; null s'il n'en reste aucune. Une colonne que le service a recalculée vers une valeur qui n'est ni celle du lot ni celle d'avant n'est pas
 * écrasée : elle est notée dans `imprevues` (colonne → écart), pour être listée « gardée » avec la valeur trouvée.
 */
function valeursEncoreARemettre(db, net, op, imprevues) {
  const actuelle = lireLigne(db, net.table, net.cle);
  const valeur = (c) => (actuelle?.[c] ?? null);
  const encore = [];
  for (const c of Object.keys(op.valeurs)) {
    if (valeur(c) === (net.fin[c] ?? null)) {
      encore.push(c);
      imprevues.delete(c);
    } else if (valeur(c) !== (net.origine[c] ?? null)) {
      imprevues.set(c, { colonne: c, ecrite: net.fin[c] ?? null, avant: net.origine[c] ?? null, trouvee: valeur(c) });
    } else imprevues.delete(c);
  }
  return encore.length ? { ...op, valeurs: sous(op.valeurs, encore) } : null;
}

/** L'aperçu d'une remise : chaque colonne avec la valeur actuelle (avant) et celle que l'annulation remet (après) ; une ligne réinsérée n'a pas d'avant, une supprimée pas d'après. */
function apercuDeLAnnulation(db, net, actuelle) {
  const o = net.genre === 'modifier' ? { table: net.table, cle: net.cle, operation: 'modifier', apres: net.origine }
    : net.genre === 'inserer' ? { table: net.table, cle: net.cle, operation: 'supprimer', avant: net.fin }
      : { table: net.table, cle: net.cle, operation: 'inserer', apres: net.origine };
  return apercuDe(db, o, actuelle);
}

/**
 * Annule le lot du journal `depose.lot_id` par le service d'édition, d'un bloc (edition.mjs#appliquerUnLot), et rend chaque ligne jugée. Le même code pour
 * l'aperçu (sur une copie, `essai`) et pour le clic (sur la base vivante) : la comparaison est refaite à chaque ligne, sur l'état du moment (ce qu'une remise
 * précédente a recalculé n'est pas remis deux fois).
 * Chaque ligne est `remise` (la valeur vaut encore ce que le lot a écrit), `gardee` (le site l'a changée depuis : listée avec la valeur trouvée), `deja`
 * (elle a déjà sa valeur d'avant), `verrouillee` (une décision du propriétaire : à ouvrir au clic) ou `refusee` (le service refuse).
 * Au clic, la première ligne refusée arrête tout (rien n'est écrit) et un lot dont aucune ligne ne se remet est refusé (409) : il reste appliqué.
 * @param {import('node:sqlite').DatabaseSync} db la copie (aperçu) ou la base vivante (clic)
 * @param {{ lot_id: string, titre: string, nature: string, decision: string | null }} depose `titre` : celui du lot du journal d'annulation
 * @param {{ essai: boolean, ouverts?: Set<string>, baseline?: Set<string>, enregistrer?: Function }} o comme `appliquerLeLot`
 */
function annulerLeLot(db, depose, { essai, ouverts = new Set(), baseline = new Set(), enregistrer = null }) {
  const sorties = { operations: [], verrous: [] };
  const travail = (hote) => {
    const verrous = new Set();
    planDeLAnnulation(db, depose.lot_id).forEach((net, i) => {
      const rang = i + 1;
      let actuelle = null;
      let illisible = null;
      try {
        actuelle = lireLigne(db, net.table, net.cle);
      } catch (e) {
        illisible = e?.message ?? String(e);
      }
      const base = { rang, rang_du_lot: net.rang, table: net.table, cle: net.cle, genre: net.genre };
      if (illisible) {
        if (!essai) throw new ErreurEdition(409, `Ligne ${rang} refusée : ${illisible}`, { rang, table: net.table, cle: net.cle });
        return sorties.operations.push({ ...base, etat: 'refusee', message: illisible });
      }
      const jugement = jugerLAnnulation(net, actuelle);
      const imprevues = new Map(); // colonnes que le service a recalculées vers une troisième valeur pendant la remise : gardées aussi
      const plus = () => {
        const ecarts = [...jugement.gardees, ...imprevues.values()];
        return ecarts.length ? { raison: jugement.raison, ecarts } : {};
      };
      const apercu = apercuDeLAnnulation(db, net, actuelle); // avant l'écriture : la valeur actuelle est celle d'avant la remise
      const noter = (etat, reste = {}) => sorties.operations.push({ ...base, apercu, etat, ...plus(), ...reste });
      if (jugement.etat === 'deja') return noter('deja');
      if (jugement.etat === 'gardee') return noter('gardee');
      const refuser = (message, reste = {}) => {
        if (essai) return noter('refusee', { message, ...reste });
        throw new ErreurEdition(409, `Ligne ${rang} refusée : ${message}`, { rang, table: net.table, cle: net.cle, ...reste });
      };
      const { ops, refus } = operationsDeLAnnulation(db, net, jugement);
      if (refus) return refuser(refus);
      // une colonne que le service recalcule depuis une autre (la clé d'un mot-clé, après son libellé) est déjà revenue quand on la remet : on ne l'écrit pas
      const adapter = (op) => (op.op === 'ecrire_modifier' ? valeursEncoreARemettre(db, net, op, imprevues) : op);
      return ecrireLesOperations(hote, ops, { essai, ouverts, verrous, rang, o: { table: net.table, cle: net.cle }, noter, refuser, adapter, etats: { ecrite: 'remise', verrouillee: essai ? 'verrouillee' : 'remise' } });
    });
    sorties.verrous = [...verrous].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    if (!essai) {
      if (!hote.ecrites()) {
        throw new ErreurEdition(409, 'Rien à remettre : chaque valeur du lot a changé depuis (le site prime), ou est déjà revenue à ce qu’elle était. Le lot reste appliqué.', { operations: sorties.operations.map(resumerLOperation) });
      }
      const nouveaux = controlerLeContenu(db).problemes.filter((p) => !baseline.has(p));
      if (nouveaux.length) {
        throw new ErreurEdition(409, `Les contrôles du contenu refusent l’annulation (${nombreDe(nouveaux.length, 'problème', 'problèmes')}) : ${nouveaux.slice(0, 5).join(' ; ')}. Le lot reste appliqué.`, { problemes: nouveaux.slice(0, 40) });
      }
      enregistrer?.(db, sorties, hote);
    }
  };
  const resultat = appliquerUnLot(db, { titre: depose.titre, nature: depose.nature, decision: depose.decision, travail });
  return { lot: resultat.lot, sorties };
}

/** Le verdict de l'aperçu d'une annulation : `refusee` (une ligne refusée, un problème né de l'annulation), `rien_a_remettre`, `verrous` (à ouvrir au clic), `applicable`. */
function verdictDeLAnnulation(comptes, verrous, nouveaux) {
  if (comptes.refusees || nouveaux.length) return 'refusee';
  if (!comptes.remises && !comptes.verrouillees) return 'rien_a_remettre';
  return verrous.length ? 'verrous' : 'applicable';
}

/** Le lot d'un lot de changements appliqué, tel que l'annulation le demande : le lot du journal, le titre de son annulation, sa nature et sa décision. */
const aAnnuler = (ligne) => ({ id: ligne.id, lot_id: ligne.lot_id, titre: `Annulation de « ${ligne.titre} »`, nature: ligne.nature, decision: ligne.decision ?? null });

/**
 * L'aperçu d'une annulation sur une copie de la base (jamais la base elle-même) : ce que le clic remettrait (`remise`), garderait parce que la valeur a
 * changé depuis (`gardee`, avec la valeur trouvée : le site prime) ou ne touche pas (`deja`), avec l'aperçu avant et après de chaque ligne, puis les
 * contrôles du contenu avant et après (seuls les problèmes nés de l'annulation comptent). Rien n'est enregistré. Synchrone (un fil à part dans le service).
 * @param {{ source: string, dossier: string, depose: { id: string, lot_id: string, titre: string, nature: string, decision: string | null } }} o
 */
export function essayerLAnnulation({ source, dossier, depose }) {
  const t0 = performance.now();
  return surUneCopie({ source, dossier }, (db) => {
    const avant = controlerLeContenu(db).problemes;
    const connus = new Set(avant);
    let sorties = { operations: [], verrous: [] };
    let refus = null;
    try {
      sorties = annulerLeLot(db, depose, { essai: true }).sorties;
    } catch (e) {
      if (!(e instanceof ErreurEdition)) throw e;
      refus = e.message; // un lot qui n'est plus au journal, en conflit, une clé étrangère refusée à la validation
    }
    const nouveaux = refus ? [] : controlerLeContenu(db).problemes.filter((p) => !connus.has(p));
    const comptes = { remises: 0, gardees: 0, deja: 0, verrouillees: 0, refusees: 0 };
    for (const o of sorties.operations) comptes[{ remise: 'remises', gardee: 'gardees', deja: 'deja', verrouillee: 'verrouillees', refusee: 'refusees' }[o.etat]] += 1;
    if (refus) comptes.refusees += 1;
    return {
      format: FORMAT_DE_L_ESSAI,
      lot: depose.id,
      titre: depose.titre,
      verdict: refus ? 'refusee' : verdictDeLAnnulation(comptes, sorties.verrous, nouveaux),
      comptes,
      verrous_a_ouvrir: sorties.verrous,
      ...(refus ? { refus_de_l_annulation: refus } : {}),
      operations: sorties.operations,
      problemes_nouveaux: nouveaux.slice(0, 40),
      problemes_nouveaux_total: nouveaux.length,
      duree_ms: Math.round(performance.now() - t0),
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Tout recalculer : ce que le code dérive du contenu, déposé comme un lot de nature « code »
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les pages dont le corps, le résumé ou les données sont dérivés des tables et que `recalculerLesPages` (edition.mjs) refait depuis elles sans qu'on lui
 * dise ce qui a changé : races, classes, fiches de dons (D11) et métiers.
 */
export const TYPES_DE_PAGES_RECALCULEES = Object.freeze(['races', 'classes', 'capacites', 'metiers']);
/**
 * Les tables dont chaque ligne a sa place dans le corps d'une page qui n'est refaite que morceau par morceau (le rendu remplace la ligne qu'une modification
 * touche ; un morceau déjà d'accord avec sa ligne reste tel quel) : pages des magies (lib/corps-magies.mjs), des armes, des armures et des boucliers, des
 * composants, des consommables de la ceinture. Le recalcul rejoue chacune de leurs lignes telle quelle (avant = après) : chaque morceau est réécrit par le
 * code d'aujourd'hui (rapport du lot 8 : « Tout recalculer » étendu après la bascule 1).
 */
export const TABLES_DES_PAGES_PAR_MORCEAUX = Object.freeze([...new Set([...Object.keys(PAGE_DE_LA_LIGNE), ...TABLES_DE_LA_PAGE_DES_ARMES,
  ...TABLES_DES_PAGES_DES_ARMURES, ...TABLES_DES_COMPOSANTS, ...TABLES_DES_POTIONS])]);
const COLONNES_RECALCULEES = Object.freeze(['corps_md', 'resume', 'donnees']);

/**
 * Les écarts entre ce que les pages portent et ce que le code d'aujourd'hui en dérive : sur la copie `db` (écrite : le service n'y touche pas), chaque page
 * des types ci-dessus est refaite par `recalculerLesPages`, et chaque ligne des tables des pages par morceaux y est rejouée telle quelle ; puis toutes les
 * pages sont comparées à ce qu'elles portaient (`examinees` : les pages qui ont des colonnes dérivées).
 * @returns {{ examinees: number, ecarts: { id: string, colonnes: { colonne: string, avant: unknown, apres: unknown }[] }[], illisibles: { page: string, raison: string }[] }}
 */
export function ecartsDuRecalcul(db) {
  const colonnes = structure(db, 'page').colonnes.filter((c) => COLONNES_RECALCULEES.includes(c));
  const lire = () => db.prepare(`SELECT id, ${colonnes.map((c) => `"${c}"`).join(', ')} FROM page ORDER BY id`).all()
    .filter((p) => colonneDerivee('page', { id: p.id }, 'corps_md')).map((p) => ({ ...p }));
  const avant = lire();
  // chaque page des types recalculés est marquée comme le journal marque une page dont seules des colonnes dérivées ont été notées (edition.mjs#lignesRejouees)
  const marques = avant.filter((p) => TYPES_DE_PAGES_RECALCULEES.includes(p.id.slice(0, p.id.indexOf('/'))))
    .map((p) => ({ table: 'page', cle: { id: p.id }, operation: 'modifier', avant: { corps_md: null }, apres: { corps_md: null } }));
  // chaque ligne des pages par morceaux, rejouée telle quelle (edition.mjs#lignesRejouees : avant = la ligne en place, après = la même)
  for (const table of TABLES_DES_PAGES_PAR_MORCEAUX) {
    let cle;
    try {
      ({ cle } = structure(db, table));
    } catch {
      continue; // une table absente de cette base
    }
    if (!cle.length) continue;
    for (const l of db.prepare(`SELECT ${cle.map((c) => `"${c}"`).join(', ')} FROM "${table}"`).all()) {
      marques.push({ table, cle: Object.fromEntries(cle.map((c) => [c, l[c]])), operation: 'modifier', avant: {}, apres: {} });
    }
  }
  const { illisibles } = recalculerLesPages(db, marques);
  const apres = new Map(lire().map((p) => [p.id, p]));
  const ecarts = [];
  for (const p of avant) {
    const refaite = apres.get(p.id);
    const changees = colonnes.filter((c) => (p[c] ?? null) !== (refaite[c] ?? null)).map((c) => ({ colonne: c, avant: p[c] ?? null, apres: refaite[c] ?? null }));
    if (changees.length) ecarts.push({ id: p.id, colonnes: changees });
  }
  return { examinees: avant.length, ecarts, illisibles };
}

/** `ecartsDuRecalcul` sur une copie de la base (jamais la base elle-même), supprimée ensuite. Synchrone (un fil à part dans le service). */
export function ecartsDuRecalculSurUneCopie({ source, dossier }) {
  const t0 = performance.now();
  const resultat = surUneCopie({ source, dossier }, (db) => ecartsDuRecalcul(db));
  return { ...resultat, duree_ms: Math.round(performance.now() - t0) };
}

/** Le titre du lot d'un recalcul : le nombre de pages refaites. */
const titreDuRecalcul = (n) => `Recalcul après un changement de code : ${nombreDe(n, 'page refaite', 'pages refaites')}`;

/**
 * Fabrique le lot de changements d'un recalcul : une opération « modifier » par page écartée (la valeur stockée en `avant`, la valeur recalculée en `apres`),
 * de nature « code » (le plan : « une opération `tout recalculer` sert après un changement de code »).
 */
export function lotDuRecalcul({ ecarts }) {
  return {
    format: FORMAT_DU_LOT,
    titre: titreDuRecalcul(ecarts.length),
    nature: 'code',
    auteur: 'tout recalculer',
    operations: ecarts.map((e) => ({
      table: 'page', cle: { id: e.id }, operation: 'modifier',
      avant: Object.fromEntries(e.colonnes.map((c) => [c.colonne, c.avant])), apres: Object.fromEntries(e.colonnes.map((c) => [c.colonne, c.apres])),
    })),
  };
}

/**
 * « Tout recalculer » (classe d'accès `proposition` : il n'écrit que `lot_de_changements`, jamais le contenu — R275 : rien n'entre sans le clic du propriétaire) :
 * calcule sur une copie les écarts entre les colonnes dérivées stockées et recalculées par le code d'aujourd'hui (`ecartsDuRecalcul`), et les DÉPOSE comme un
 * lot de changements de nature « code » : il passe ensuite par le même essai à blanc et le même clic que tout lot. Rien à recalculer : aucun lot n'est déposé.
 * Une promesse de `{ lot, recalcul }` : `lot` est la proposition avec son essai (null sans écart), `recalcul` les comptes (pages examinées, écarts, pages illisibles).
 * @param {() => import('node:sqlite').DatabaseSync | null} base
 * @param {{ enArrierePlan?: boolean, dossier?: string, instant?: string, id?: string }} [options] les options de `deposer`
 */
export async function recalculerTout(base, { enArrierePlan: dansUnFil = true, dossier = null, ...options } = {}) {
  const db = base();
  if (!db) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
  exigerLesTables(db);
  const source = fichierDe(db);
  if (!source) throw new ErreurEdition(503, 'La base vivante n’est pas un fichier : le recalcul a besoin d’une copie.');
  const copie = { source, dossier: dossier ?? join(dirname(source), 'essais') };
  const calcul = await enFile(async () => (dansUnFil ? enArrierePlan('maverickRecalcul', copie) : ecartsDuRecalculSurUneCopie(copie)));
  const recalcul = { pages_examinees: calcul.examinees, ecarts: calcul.ecarts.length, pages_illisibles: calcul.illisibles, duree_ms: calcul.duree_ms };
  if (!calcul.ecarts.length) return { lot: null, recalcul };
  if (calcul.ecarts.length > OPERATIONS_MAX) {
    throw new ErreurEdition(409, `Le recalcul écarte ${calcul.ecarts.length} pages, plus que ce qu’un lot porte (${OPERATIONS_MAX}) : refaites-le après en avoir appliqué une partie.`, { recalcul });
  }
  const lot = await deposer(base, lotDuRecalcul(calcul), { enArrierePlan: dansUnFil, dossier: copie.dossier, ...options });
  return { lot, recalcul };
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
 *   `controlerLeLot` : la route le donne `{ ouvertHorsEdition: true }` quand la base est la source (db/source, lot 8 : serveur/api.mjs#traiterLots), sinon
 *   rien (le lot reste éteint hors édition) ; les tests l'ouvrent aussi pour éprouver les numéros
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

/**
 * L'aperçu de l'annulation du lot appliqué `id` (route de lecture : rien n'est écrit, ni dans le contenu ni dans `lot_de_changements`) : calculé sur une
 * copie de la base comme l'essai (un fil à part, un à la fois). Une promesse de l'aperçu (`essayerLAnnulation`).
 * @param {() => import('node:sqlite').DatabaseSync | null} base la base vivante
 * @param {{ enArrierePlan?: boolean, dossier?: string }} [o]
 */
export function previsualiserLAnnulation(base, id, { enArrierePlan: dansUnFil = true, dossier = null } = {}) {
  const db = base();
  if (!db) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  if (ligne.etat !== 'applique') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot appliqué s’annule.`);
  const source = fichierDe(db);
  if (!source) throw new ErreurEdition(503, 'La base vivante n’est pas un fichier : l’aperçu a besoin d’une copie.');
  const options = { source, dossier: dossier ?? join(dirname(source), 'essais'), depose: aAnnuler(ligne) };
  return enFile(async () => (dansUnFil ? enArrierePlan('maverickApercuDeLAnnulation', options) : essayerLAnnulation(options)));
}

/**
 * Annule le lot appliqué `id` d'un clic du propriétaire (mot de passe) : refait la comparaison et, d'un seul bloc, sous le même verrou que l'édition, remet
 * `avant` là où la valeur vaut encore ce que le lot a écrit (le site prime : une valeur changée depuis est gardée, listée avec la valeur trouvée). Une ligne
 * créée par le lot n'est supprimée que si elle vaut encore, en entier, ce que le lot a inséré ; une ligne retirée n'est réinsérée que si elle est encore
 * absente. Écrit par le service d'édition dès qu'il connaît la colonne, rejoue les contrôles du contenu, note un lot du journal « Annulation de … » de la
 * même nature et du même numéro de décision que le lot annulé, puis passe la proposition à « annule » (`annule_le`, `annulation_lot_id`). Les numéros donnés
 * restent dans `numero_donne` : une annulation ne les rend jamais. Refus (409, rien n'est écrit, le lot reste appliqué) : rien à remettre, une ligne
 * refusée par le service, un verrou de décision pas ouvert dans `corps.verrous_ouverts`, un contrôle du contenu qui échoue, un lot du journal en conflit.
 * @param {import('node:sqlite').DatabaseSync} db la base vivante
 * @param {string} id
 * @param {{ verrous_ouverts?: string[] }} [corps]
 */
export function annuler(db, id, corps = {}) {
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  if (ligne.etat !== 'applique') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot appliqué s’annule.`);
  const ouverts = verrousDuClic(corps?.verrous_ouverts);
  // les problèmes du contenu d'avant : seuls ceux qui naissent de l'annulation la refusent (le service est un seul fil : rien ne change entre ce calcul et la transaction)
  const baseline = new Set(controlerLeContenu(db).problemes);
  const enregistrer = (base, sorties, hote) => {
    const compte = (etat) => sorties.operations.filter((o) => o.etat === etat).length;
    const annulation = {
      remises: compte('remise'), gardees: compte('gardee'), deja: compte('deja'),
      operations: sorties.operations.map(resumerLOperation), verrous_ouverts: sorties.verrous,
    };
    const bilan = { ...jsonOuNull(ligne.bilan), annulation };
    base.prepare("UPDATE lot_de_changements SET etat = 'annule', annule_le = max(?, decide_le), annulation_lot_id = ?, bilan = ? WHERE id = ? AND etat = 'applique'")
      .run(hote.instant, hote.id, JSON.stringify(bilan), id);
  };
  annulerLeLot(db, aAnnuler(ligne), { essai: false, ouverts, baseline, enregistrer });
  return presenter(ligneOuErreur(db, id));
}

// Le même module sert de fil de travail : l'essai d'un lot, l'aperçu d'une annulation et le calcul d'un recalcul y tournent sans bloquer le service (comme
// l'extrait, serveur/extrait.mjs)
// (en fin de module : le fil exécute le travail dès qu'il charge le module, après les constantes dont celui-ci se sert)
const TRAVAUX = { maverickEssaiDuLot: (o) => essayerLeLot(o), maverickApercuDeLAnnulation: (o) => essayerLAnnulation(o), maverickRecalcul: (o) => ecartsDuRecalculSurUneCopie(o) };
if (!isMainThread) {
  const cle = Object.keys(TRAVAUX).find((c) => workerData?.[c]);
  if (cle) {
    try {
      parentPort.postMessage({ essai: TRAVAUX[cle](workerData[cle]) });
    } catch (e) {
      parentPort.postMessage({ erreur: String(e?.message ?? e) });
    }
  }
}
