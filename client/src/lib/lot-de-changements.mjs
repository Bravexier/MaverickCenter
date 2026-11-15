// Le format d'un lot de changements (lot 6 du chantier « la base du site de dev devient la source de vérité » : docs/chantier-base-de-dev.md, R274, R275 ;
// docs/serveur.md, « Lots de changements »). Un lot est un fichier d'opérations : table, ligne, valeur attendue avant, valeur après. Il vaut pour toute
// colonne que le site ne sait pas écrire, pas seulement pour les tables hors de l'édition ; il est essayé à blanc puis appliqué d'un bloc par le service
// (la suite du chantier) : ce module ne fait que le DÉCRIRE et le VALIDER, sans rien écrire ni ouvrir de base.
//
//   {
//     "format": "maverick-lot/1",                    // facultatif ; s'il est là, il vaut FORMAT_DU_LOT
//     "titre": "Redonner à la Corruption sa couleur", // lisible : c'est le résumé du lot au journal
//     "nature": "decision",                           // source | decision | migration | code (jamais « saisie » : un lot n'est pas une saisie du site)
//     "decision": "R275",                             // le numéro de la décision : présent si et seulement si nature = « decision »
//     "auteur": "…",                                  // libre, facultatif
//     "operations": [                                 // ordonnée ; le rang d'une opération (1, 2…) est sa place dans cette liste
//       { "table": "mot_cle", "cle": { "id": 12 }, "operation": "modifier", "avant": { "couleur": "rouge" }, "apres": { "couleur": "violet" } },
//       { "table": "page_tag", "cle": { "page_id": "a", "tag_id": 12 }, "operation": "inserer", "apres": { "page_id": "a", "tag_id": 12 } },
//       { "table": "alias", "cle": { "alias": "x" }, "operation": "supprimer", "avant": { "alias": "x", "page_id": "a" } }
//     ]
//   }
// `cle` : l'objet de la clé primaire (toutes ses colonnes). `avant` : les valeurs attendues des colonnes touchées (la ligne entière pour « supprimer »,
// absent pour « inserer »). `apres` : les valeurs écrites (absent pour « supprimer »). Même forme que `avant` / `apres` d'une ligne de `modification`
// (serveur/edition-journal.mjs) : les colonnes touchées seulement pour « modifier », la ligne entière pour « inserer ».
//
// Pur : aucune dépendance au navigateur, à Astro ni à node:… (skill site-version-portable). La structure d'une table (colonnes, clé) vient de l'appelant,
// qui la lit dans sa base (PRAGMA table_info : serveur/edition-journal.mjs#structure) ; les valeurs actuelles aussi (comparerAvecLaBase).
import { CLASSES_DE_TABLES, classeDeLaTable, TABLES_HORS_REGLES } from './tables-de-la-base.mjs';
import { ENTITES, TABLES } from './edition-modele.mjs';

/** Le format du fichier (un lot est refusé s'il en annonce un autre). */
export const FORMAT_DU_LOT = 'maverick-lot/1';

/**
 * Les natures d'une trace, au journal et à l'historique (migration 0127) : « saisie » (faite sur le site de dev), « source » (réimport d'une source),
 * « decision » (application d'une décision du propriétaire, avec son numéro), « migration » (changement de données du dépôt), « code » (recalcul après un
 * changement de code). La même liste que le CHECK de `modification_lot.nature` et de `historique_modification.nature` (test `lot-de-changements`).
 */
export const NATURES = Object.freeze(['saisie', 'source', 'decision', 'migration', 'code']);

/** La nature d'un lot de changements : toutes sauf « saisie », qui est une modification du site de dev, pas un fichier. */
export const NATURES_D_UN_LOT = Object.freeze(NATURES.filter((n) => n !== 'saisie'));

/** Les trois opérations d'un lot. */
export const OPERATIONS = Object.freeze(['inserer', 'modifier', 'supprimer']);

/**
 * Le lot reste ÉTEINT pour les tables que le service d'édition ne sait pas écrire (« Elle passe par le service d'édition dès que la table lui est
 * connue », chantier de la base de dev, lot 6, risque ; « Le lot reste éteint pour les tables hors édition jusqu'au lot 8 »). Elle passe à `true` au
 * lot 8, avec l'accord du propriétaire, et pas avant : `controlerLeLot` refuse alors seulement ce que les contrôles de structure refusent.
 */
export const LOT_OUVERT_AUX_TABLES_HORS_EDITION = false;

/** Le numéro d'une décision : « R » et des chiffres (le CHECK de `modification_lot.decision`). */
const FORME_D_UNE_DECISION = /^R[0-9]+$/;

const CLES_DU_LOT = Object.freeze(['format', 'titre', 'nature', 'decision', 'auteur', 'operations']);
const CLES_D_UNE_OPERATION = Object.freeze(['table', 'cle', 'operation', 'avant', 'apres']);
const TITRE_MAX = 200;

const estUnObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const estAbsent = (v) => v === undefined || v === null;
const egal = (a, b) => (a ?? null) === (b ?? null);
const valeurSimple = (v) => v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
const liste = (noms) => noms.map((n) => `« ${n} »`).join(', ');

/**
 * Les tables que le service d'édition sait écrire : celles de `TABLES` (colonnes modifiables) et d'`ENTITES` (création, suppression) de
 * `lib/edition-modele.mjs`, la seule liste : elle n'est pas recopiée ici.
 * @returns {Set<string>}
 */
export function tablesDeLEdition() {
  return new Set([...Object.keys(TABLES), ...Object.values(ENTITES).map((e) => e.table)]);
}

/**
 * Contrôle une nature et son numéro de décision (un lot, ou une trace du journal). Rend les messages (vide : valide). `saisie` : la nature « saisie »
 * est admise (une trace du journal) ; refusée pour un lot de changements.
 * @param {{ nature?: unknown, decision?: unknown }} trace
 * @param {{ saisie?: boolean }} [options]
 * @returns {string[]}
 */
export function controlerLaNature({ nature, decision } = {}, { saisie = false } = {}) {
  if (typeof nature !== 'string' || !NATURES.includes(nature)) return [`nature ${JSON.stringify(nature)} inconnue (attendu : ${liste(NATURES)})`];
  if (nature === 'saisie' && !saisie) {
    return [`nature « saisie » refusée : un lot de changements n'est pas une saisie du site de dev (attendu : ${liste(NATURES_D_UN_LOT)})`];
  }
  if (nature === 'decision') {
    if (typeof decision !== 'string' || !FORME_D_UNE_DECISION.test(decision)) {
      return [`nature « decision » : le numéro de la décision est attendu (« R » suivi de chiffres, ex. « R275 »), reçu ${JSON.stringify(decision ?? null)}`];
    }
    return [];
  }
  if (!estAbsent(decision)) return [`decision ${JSON.stringify(decision)} : un numéro de décision n'accompagne que la nature « decision » (reçu : « ${nature} »)`];
  return [];
}

/** Lit le texte d'un fichier de lot. Rend l'objet, ou lève une `Error` qui dit pourquoi le texte n'est pas du JSON. */
export function lireUnLot(texte) {
  try {
    return JSON.parse(texte);
  } catch (e) {
    throw new Error(`lot illisible : ce n'est pas du JSON (${e.message})`);
  }
}

/**
 * Valide un lot de changements, sans rien écrire. Rend toutes les erreurs d'un coup, chacune avec le rang de l'opération à corriger (1 = la première ;
 * `null` : l'en-tête ou la liste).
 * @param {unknown} lot le lot (objet lu du fichier)
 * @param {object} options
 * @param {(table: string) => ({ colonnes: string[], cle: string[] } | null | undefined)} options.structure colonnes d'une table (dans l'ordre) et colonnes
 *   de sa clé primaire (dans l'ordre) ; rend null pour une table qui n'existe pas
 * @param {Set<string>} [options.tablesEdition] les tables que le service d'édition sait écrire (défaut : `tablesDeLEdition()`)
 * @param {boolean} [options.ouvertHorsEdition] défaut `LOT_OUVERT_AUX_TABLES_HORS_EDITION`
 * @returns {{ valide: boolean, erreurs: { rang: number | null, message: string }[] }}
 */
export function controlerLeLot(lot, { structure, tablesEdition = tablesDeLEdition(), ouvertHorsEdition = LOT_OUVERT_AUX_TABLES_HORS_EDITION } = {}) {
  const erreurs = [];
  const refuser = (rang, message) => erreurs.push({ rang, message });
  const termine = () => ({ valide: erreurs.length === 0, erreurs });
  if (!estUnObjet(lot)) {
    refuser(null, 'le lot doit être un objet (titre, nature, operations)');
    return termine();
  }
  for (const cle of Object.keys(lot)) if (!CLES_DU_LOT.includes(cle)) refuser(null, `clé « ${cle} » inconnue dans l'en-tête (attendu : ${liste(CLES_DU_LOT)})`);
  if (lot.format !== undefined && lot.format !== FORMAT_DU_LOT) refuser(null, `format ${JSON.stringify(lot.format)} inconnu (attendu : « ${FORMAT_DU_LOT} »)`);
  if (typeof lot.titre !== 'string' || !lot.titre.trim()) refuser(null, 'titre : un texte lisible est attendu');
  else if (lot.titre.length > TITRE_MAX) refuser(null, `titre : ${TITRE_MAX} caractères au plus (reçu ${lot.titre.length})`);
  if (!estAbsent(lot.auteur) && (typeof lot.auteur !== 'string' || lot.auteur.length > TITRE_MAX)) refuser(null, `auteur : un texte de ${TITRE_MAX} caractères au plus, ou rien`);
  for (const message of controlerLaNature(lot)) refuser(null, message);
  if (!Array.isArray(lot.operations) || !lot.operations.length) {
    refuser(null, 'operations : une liste d\'au moins une opération est attendue');
    return termine();
  }

  const lignes = new Map(); // ligne (table + clé) → les opérations déjà vues dessus : { rang, operation, colonnes }
  lot.operations.forEach((o, i) => {
    const rang = i + 1;
    const dit = (message) => refuser(rang, `opération ${rang} : ${message}`);
    if (!estUnObjet(o)) return dit('un objet est attendu (table, cle, operation…)');
    for (const cle of Object.keys(o)) if (!CLES_D_UNE_OPERATION.includes(cle)) dit(`clé « ${cle} » inconnue (attendu : ${liste(CLES_D_UNE_OPERATION)})`);
    if (!OPERATIONS.includes(o.operation)) dit(`operation ${JSON.stringify(o.operation ?? null)} inconnue (attendu : ${liste(OPERATIONS)})`);
    if (typeof o.table !== 'string' || !o.table) return dit('table : le nom d\'une table est attendu');
    const s = structure(o.table);
    if (!s) return dit(`table « ${o.table} » inexistante`);
    const classe = classeDeLaTable(o.table);
    if (classe !== CLASSES_DE_TABLES.CONTENU) return dit(`table « ${o.table} » : seules les tables de contenu se modifient par un lot (celle-ci est ${classe === null ? 'hors classement' : `« ${classe} »`})`);
    if (TABLES_HORS_REGLES.includes(o.table)) return dit(`table « ${o.table} » : les notes de version et l'historique sont des traces, jamais modifiées par un lot`);
    if (!ouvertHorsEdition && !tablesEdition.has(o.table)) {
      return dit(`table « ${o.table} » : le service d'édition ne sait pas encore l'écrire, et un lot ne vaut pour les tables hors édition qu'à partir du lot 8 du chantier de la base de dev`);
    }
    if (!s.cle.length) return dit(`table « ${o.table} » : sans clé primaire, une ligne ne peut pas être désignée`);

    // la clé : toutes les colonnes de la clé primaire, et elles seules, de valeurs simples et non nulles
    let cleValide = false;
    if (!estUnObjet(o.cle)) dit(`cle : l'objet de la clé primaire de « ${o.table} » est attendu (${liste(s.cle)})`);
    else {
      const manque = s.cle.filter((c) => !(c in o.cle));
      const enTrop = Object.keys(o.cle).filter((c) => !s.cle.includes(c));
      if (manque.length) dit(`cle : la clé primaire de « ${o.table} » est incomplète (manque ${liste(manque)})`);
      if (enTrop.length) dit(`cle : ${liste(enTrop)} ne ${enTrop.length > 1 ? 'sont' : 'est'} pas dans la clé primaire de « ${o.table} » (${liste(s.cle)})`);
      const nulles = s.cle.filter((c) => c in o.cle && (o.cle[c] === null || !valeurSimple(o.cle[c])));
      if (nulles.length) dit(`cle : ${liste(nulles)} doit être un texte ou un nombre`);
      cleValide = !manque.length && !enTrop.length && !nulles.length;
    }

    // les valeurs, selon l'opération
    const colonnesTouchees = controlerLesValeurs(o, s, dit);
    if (!cleValide || !colonnesTouchees) return;

    // deux opérations ne touchent pas la même ligne et colonne (une insertion ou une suppression touche toute la ligne)
    const ligne = JSON.stringify([o.table, ...s.cle.map((c) => o.cle[c])]);
    for (const vue of lignes.get(ligne) ?? []) {
      const commune = [...colonnesTouchees].find((c) => vue.colonnes.has(c));
      if (vue.operation !== 'modifier' || o.operation !== 'modifier') {
        dit(`la ligne de « ${o.table} » ${JSON.stringify(o.cle)} est déjà touchée par l'opération ${vue.rang} (${vue.operation}) : une seule opération par ligne, hors deux « modifier » de colonnes différentes`);
      } else if (commune !== undefined) {
        dit(`la colonne « ${commune} » de « ${o.table} » ${JSON.stringify(o.cle)} est déjà modifiée par l'opération ${vue.rang}`);
      }
    }
    if (!lignes.has(ligne)) lignes.set(ligne, []);
    lignes.get(ligne).push({ rang, operation: o.operation, colonnes: colonnesTouchees });
  });
  return termine();
}

/**
 * Les valeurs `avant` et `apres` d'une opération contre les colonnes de la table. Rend l'ensemble des colonnes touchées (toutes, pour une insertion ou une
 * suppression), ou null si une erreur a été dite.
 */
function controlerLesValeurs(o, s, dit) {
  const { operation } = o;
  const decrire = (valeurs, nom) => {
    if (!estUnObjet(valeurs) || !Object.keys(valeurs).length) {
      dit(`${nom} : un objet de valeurs est attendu (les colonnes de « ${o.table} »)`);
      return null;
    }
    let bon = true;
    const inconnues = Object.keys(valeurs).filter((c) => !s.colonnes.includes(c));
    if (inconnues.length) {
      dit(`${nom} : colonne ${liste(inconnues)} inexistante dans « ${o.table} »`);
      bon = false;
    }
    const mal = Object.keys(valeurs).filter((c) => !valeurSimple(valeurs[c]));
    if (mal.length) {
      dit(`${nom} : ${liste(mal)} doit valoir un texte, un nombre ou null`);
      bon = false;
    }
    return bon ? Object.keys(valeurs) : null;
  };
  const cleEgale = (valeurs, nom) => {
    const autres = s.cle.filter((c) => estUnObjet(o.cle) && c in o.cle && c in valeurs && !egal(valeurs[c], o.cle[c]));
    if (autres.length) dit(`${nom} : ${liste(autres)} ne valent pas la clé de l'opération`);
    return !autres.length;
  };
  if (operation === 'inserer') {
    if (!estAbsent(o.avant)) dit('avant : une insertion n\'a pas de valeur attendue avant (à retirer)');
    const colonnes = decrire(o.apres, 'apres');
    if (!colonnes) return null;
    const manque = s.cle.filter((c) => !colonnes.includes(c));
    if (manque.length) {
      dit(`apres : la ligne insérée doit porter sa clé (manque ${liste(manque)})`);
      return null;
    }
    return cleEgale(o.apres, 'apres') && estAbsent(o.avant) ? new Set(s.colonnes) : null;
  }
  if (operation === 'supprimer') {
    if (!estAbsent(o.apres)) dit('apres : une suppression n\'a pas de valeur après (à retirer)');
    const colonnes = decrire(o.avant, 'avant');
    if (!colonnes) return null;
    const manque = s.colonnes.filter((c) => !colonnes.includes(c));
    if (manque.length) {
      dit(`avant : la ligne supprimée est attendue en entier (manque ${liste(manque)})`);
      return null;
    }
    return cleEgale(o.avant, 'avant') && estAbsent(o.apres) ? new Set(s.colonnes) : null;
  }
  if (operation === 'modifier') {
    const colonnesAvant = decrire(o.avant, 'avant');
    const colonnesApres = decrire(o.apres, 'apres');
    if (!colonnesAvant || !colonnesApres) return null;
    const sansAvant = colonnesApres.filter((c) => !colonnesAvant.includes(c));
    const sansApres = colonnesAvant.filter((c) => !colonnesApres.includes(c));
    if (sansAvant.length) dit(`avant : la valeur attendue de ${liste(sansAvant)} manque (chaque colonne de apres a la sienne)`);
    if (sansApres.length) dit(`apres : la valeur écrite de ${liste(sansApres)} manque (chaque colonne de avant a la sienne)`);
    const dansLaCle = colonnesApres.filter((c) => s.cle.includes(c));
    if (dansLaCle.length) dit(`apres : ${liste(dansLaCle)} fait partie de la clé primaire, qui ne change pas`);
    const inchangees = colonnesApres.filter((c) => colonnesAvant.includes(c) && egal(o.avant[c], o.apres[c]));
    if (inchangees.length) dit(`${liste(inchangees)} : avant et apres sont identiques, il n'y a rien à modifier`);
    return sansAvant.length || sansApres.length || dansLaCle.length || inchangees.length ? null : new Set(colonnesApres);
  }
  return null; // operation inconnue : déjà dite
}

const APPLICABLE = 'applicable';
const CHANGEE = 'changee';
/** Ce que `comparerAvecLaBase` rend pour chaque opération : écrivable telle quelle, ou « changée entre-temps » (le site prime : elle n'est pas écrite). */
export const ETATS_D_UNE_OPERATION = Object.freeze({ APPLICABLE, CHANGEE });

/**
 * Compare les valeurs attendues d'un lot (`avant`) à la base actuelle : c'est ce que l'essai à blanc montrera. Le site prime : une opération dont la
 * ligne ou la valeur a changé depuis n'est pas écrite, elle est listée avec ce que la base porte maintenant. Le lot est supposé valide (`controlerLeLot`).
 *   - « inserer » : applicable si la ligne n'existe pas, sinon changée (`raison: 'ligne_existante'`) ;
 *   - « modifier » : applicable si la ligne existe et que chaque colonne de `avant` vaut ce qui est attendu, sinon changée (`ligne_absente` ou
 *     `valeur_changee`, avec `ecarts`) ;
 *   - « supprimer » : applicable si la ligne existe et vaut encore `avant` en entier, sinon changée.
 * @param {{ operations: object[] }} lot
 * @param {(table: string, cle: object) => (object | null | undefined)} lireLigne la ligne actuelle de la table (null si elle n'existe pas)
 * @returns {{ operations: { rang: number, table: string, cle: object, operation: string, etat: string, raison: string | null,
 *   ecarts: { colonne: string, attendue: unknown, actuelle: unknown }[] }[], applicables: number, changees: number }}
 */
export function comparerAvecLaBase(lot, lireLigne) {
  const operations = lot.operations.map((o, i) => {
    const actuelle = lireLigne(o.table, o.cle) ?? null;
    const sortie = { rang: i + 1, table: o.table, cle: o.cle, operation: o.operation, etat: APPLICABLE, raison: null, ecarts: [] };
    const changee = (raison) => ({ ...sortie, etat: CHANGEE, raison });
    if (o.operation === 'inserer') return actuelle ? changee('ligne_existante') : sortie;
    if (!actuelle) return changee('ligne_absente');
    for (const [colonne, attendue] of Object.entries(o.avant)) {
      if (!egal(actuelle[colonne], attendue)) sortie.ecarts.push({ colonne, attendue, actuelle: actuelle[colonne] ?? null });
    }
    return sortie.ecarts.length ? changee('valeur_changee') : sortie;
  });
  const changees = operations.filter((o) => o.etat === CHANGEE).length;
  return { operations, applicables: operations.length - changees, changees };
}
