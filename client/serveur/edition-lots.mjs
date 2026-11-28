// Les lots de changements (lot 6 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/serveur.md, « Lots de changements » ;
// format : src/lib/lot-de-changements.mjs). Une session de Claude DÉPOSE une proposition avec la clé de lecture (rien n'est écrit dans le contenu : elle est
// essayée à blanc sur une COPIE de la base) ; le propriétaire l'APPLIQUE ou la REFUSE d'un clic (session Créateur), avec l'aperçu avant et après (R275, question 4 a).
//
//   déposer      contrôle du format (controlerLeLot : le refus dit l'opération à corriger), enregistre l'état « propose », lance l'essai à blanc ;
//   essayer      une copie de la base (VACUUM INTO, dans un fil à part : le service ne s'arrête pas), le lot appliqué par LE MÊME code que l'application, puis les
//                contrôles du contenu de `db:check` (serveur/controles-du-contenu.mjs) avant et après : seuls les problèmes qui naissent du lot comptent ;
//   appliquer    d'un seul bloc, dans la transaction et sous le verrou d'écrivain de `enregistrer` (edition.mjs#appliquerUnLot) : la comparaison est refaite
//                au clic (une valeur changée entre-temps n'est pas écrite : le site prime, elle est listée avec la valeur trouvée), les numéros sont donnés, les
//                contrôles du contenu rejoués, puis `lot_de_changements` passe à « applique » ;
//   refuser      l'état « refuse » : la proposition reste, rien n'est écrit ;
//   deposerEtAppliquer  R291 (qui remplace R275 (4)) : une fois la clé de dépôt posée (serveur/acces.mjs), le dépôt par cette clé ou une session Créateur est essayé à
//                blanc puis APPLIQUÉ aussitôt, par le même code que le clic ; refusé aux contrôles, le lot est enregistré « refuse » avec ses motifs et rien n'entre ;
//   annuler      un lot appliqué : `avant` est remis là où la valeur vaut encore ce que le lot a écrit (le site prime), d'un bloc, par le même code que l'application ; son
//                aperçu se calcule sur une copie ; une seule LIGNE du lot (une ligne de table de son effet net) s'annule de même (R291), si aucune autre ligne du lot
//                encore en place ne la tient ;
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
import { isDeepStrictEqual } from 'node:util';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { adresseDeLaPage, adresseQuiSuit, adressesDuSite, indexDesAdresses } from '../src/lib/adresses-db.mjs';
import { ErreurCorpsArmes, PAGE_DES_ARMES } from '../src/lib/corps-armes.mjs';
import { ErreurCorpsArmures } from '../src/lib/corps-armures.mjs';
import {
  ErreurCorpsComposants, PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS, PAGES_DES_COMPOSANTS_AU_CORPS_ENTIER,
} from '../src/lib/corps-composants.mjs';
import { PAGE_DE_LA_LIGNE } from '../src/lib/corps-magies.mjs';
import { corpsDesPotionsEntier, ErreurCorpsPotions } from '../src/lib/corps-potions.mjs';
import { ENTITES, TABLES, typeDeTexte } from '../src/lib/edition-modele.mjs';
import { CORPS_D_UNE_PAGE_DE_NOTION } from '../src/lib/guide.mjs';
import { colonneMasquee, nomDeColonne, nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
import {
  COLONNES_LOGIQUES_DU_MOT_CLE, comparerAvecLaBase, controlerLeLot, donnerLesNumeros, effetNetDuLot, FORMAT_DU_LOT, jugerLAnnulation, lireUnLot, neResteRienARemettre,
  sansLesColonnesRetirees, TABLES_ANCRABLES,
} from '../src/lib/lot-de-changements.mjs';
import { estUnLotDAncrage } from '../src/lib/lots-d-ancrage.mjs';
import { lecteurDesMentions } from '../src/lib/mentions-des-mots-cles.mjs';
import { refusDuLienDeLAncre } from '../src/lib/mots-cles-ancrage.mjs';
import { elementDuMotCle, lireUnMotCle, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { controlerLeContenu } from './controles-du-contenu.mjs';
import { ErreurEdition, appliquerUnLot, colonneDerivee, recalculerLesPages } from './edition.mjs';
import { tableDeLElement } from './edition-adresses.mjs';
import { lectureDesBalises } from './edition-ancrage.mjs';
import { COLONNES_DE_LA_PAGE, COLONNES_DU_REPERE } from './edition-mots-cles.mjs';
import { libelleDeLigne, ligneDuMotCle } from './edition-conflits.mjs';
import { corpsEntierDesArmes } from './edition-armes.mjs';
import { corpsEntierDesArmures } from './edition-armures.mjs';
import { corpsEntierDeLaPageDesComposants } from './edition-composants.mjs';
import { contexteDuCorpsDesPotions, potionsParPage } from './edition-consommables.mjs';
import { lireLigne, monterLePlafond, nouveauLot, plusHautNumero, structure } from './edition-journal.mjs';
import { tenirLIndexDesPages } from './index-des-pages.mjs';

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

/**
 * La ligne actuelle d'une table telle qu'un lot la compare et la montre : celle de la base ; d'un mot-clé, l'objet lu sur son élément (migration 0136,
 * lib/mots-cles-db.mjs#lireUnMotCle : `libelle`, `url`, `description`, `couleur`, `icone`, ses colonnes logiques, avec `id`, `cle`, `verrou`, `monnaie_id`),
 * pour qu'un `avant` qui les nomme ne soit pas « changé entre-temps » ; null si la ligne n'existe pas.
 */
function lireLaLigne(db, table, cle) {
  if (table !== 'mot_cle') return lireLigne(db, table, cle);
  const m = Number.isInteger(cle?.id) ? lireUnMotCle(db, cle.id) : null;
  if (!m) return null;
  const { element: _element, ...ligne } = m;
  return ligne;
}

/** Les colonnes logiques que `mot_cle` n'a plus dans cette base (toutes depuis la migration 0136, aucune avant) : celles que l'annulation ignore. */
function colonnesRetirees(db) {
  if (!tableExiste(db, 'mot_cle')) return [];
  const { colonnes } = structure(db, 'mot_cle');
  return COLONNES_LOGIQUES_DU_MOT_CLE.filter((c) => !colonnes.includes(c));
}

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
  const bilan = jsonOuNull(ligne.bilan);
  // R291 : comment le lot est entré (dépôt appliqué aussitôt par la clé de dépôt ou une session Créateur, ou clic du propriétaire) et combien de ses lignes sont annulées
  base.application = bilan?.application ?? null;
  base.refus = essai?.refus_du_depot ?? null; // un dépôt appliqué aussitôt que l'essai ou l'application a refusé : ses motifs (jamais dans `bilan`, vide pour un lot refusé)
  base.lignes_annulees = Object.keys(bilan?.lignes_annulees ?? {}).length;
  if (resume) return base;
  return { ...base, contenu: jsonOuNull(ligne.contenu), essai, bilan, verrous_ouverts: jsonOuNull(ligne.verrous_ouverts) };
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
 *     lot) ; une page de notion aussi (`ancrage: { notion: true }`, `traduireLaPageDeNotion` : la page d'un mot-clé existant ou créé plus haut dans le lot,
 *     docs/chantier-pages-de-notion.md, §3) ; refusée sur les autres tables que le service crée lui-même (son identifiant, sa page, ses clés recalculées ne
 *     se donnent pas d'un bloc) ; voie générique sinon.
 * L'ancrage des mots-clés (décision R309, serveur/edition-ancrage.mjs) : une création ancrée (`ancrage`) passe par `ancrer_nouveau`, un alignement par
 * `aligner_mot_cle`, chacun suivi de `verifier_ligne` ; le `mot_cle_id` d'une page, d'un sort ou d'un type de sort par `ancrer_element` ; une catégorie se crée par le service.
 * Depuis la migration 0136, `libelle`, `url`, `description`, `couleur` et `icone` d'un mot-clé sont des colonnes LOGIQUES (lib/lot-de-changements.mjs, en-tête) :
 * celles de `TABLES.mot_cle`, que l'opération « modifier » du service écrit sur l'élément du mot-clé (sa page, son repère ; refus pour un sort, et pour le nom
 * ou l'adresse d'un mot-clé de page ou de sort) ; un alignement (lots d'avant) ne recopie plus rien et ne fait que vérifier. Un lot nouveau écrit `page.definition`,
 * `page.couleur`, `page.icone` ou `repere.*` par la même voie que toute colonne.
 */
export function traduire(o) {
  const entite = entiteDeLaTable(o.table);
  if (o.operation === 'modifier') {
    if (o.table === 'mot_cle' && o.ancrage?.aligner === true) {
      return { ops: [{ op: 'aligner_mot_cle', id: o.cle.id }, { op: 'verifier_ligne', table: 'mot_cle', cle: o.cle, attendu: o.apres }] };
    }
    const ancre = TABLES_ANCRABLES.includes(o.table) && Object.hasOwn(o.apres, 'mot_cle_id');
    const colonnes = Object.keys(o.apres).filter((c) => !(ancre && c === 'mot_cle_id'));
    const connues = TABLES[o.table]?.colonnes ?? {};
    // une colonne dérivée (le corps d'une page typée : le service la refait depuis les tables et refuse qu'on l'écrive) passe par le journal, comme celles qu'il ne connaît pas
    const duService = colonnes.filter((c) => Object.hasOwn(connues, c) && !colonneDerivee(o.table, o.cle, c));
    const autres = colonnes.filter((c) => !duService.includes(c));
    const ops = [];
    if (ancre) ops.push({ op: 'ancrer_element', table: o.table, id: o.cle.id, mot_cle_id: o.apres.mot_cle_id });
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
    if (o.table === 'mot_cle') return o.ancrage ? traduireLaCreationAncree(o) : traduireLaCreationDUnMotCle(o);
    if (o.table === 'categorie_mot_cle') return traduireLaCreationDUneCategorie(o);
    if (o.table === 'page' && o.ancrage?.notion === true) return traduireLaPageDeNotion(o);
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

/**
 * La création du mot-clé d'un élément (décision R309) : le service le crée avec son type et son ancre, puis le lot vérifie la ligne créée. Depuis la migration
 * 0136, son nom et son adresse se lisent sur l'élément : `apres` se réduit à `id` ; un lot d'avant y donne aussi `libelle` et `url`, que la vérification compare
 * à ceux de l'élément (sans rien recopier).
 */
function traduireLaCreationAncree(o) {
  const { id } = o.apres;
  const { table, id: element, type } = o.ancrage;
  const donnes = ['libelle', 'url'].filter((c) => Object.hasOwn(o.apres, c));
  return { ops: [
    { op: 'ancrer_nouveau', table, id: element, type, ...sous(o.apres, donnes) },
    { op: 'verifier_ligne', table: 'mot_cle', cle: { id }, attendu: sous(o.apres, ['id', ...donnes]) },
  ] };
}

/**
 * La page de notion d'un mot-clé (serveur/edition-notions.mjs#creerLaPageDeNotion) : le service la crée (provenance, adresse du mot-clé), puis le lot vérifie la
 * ligne créée : son id, son titre, son mot-clé, sans résumé, le bloc `notion` pour texte.
 */
function traduireLaPageDeNotion(o) {
  const { id, titre, mot_cle_id } = o.apres;
  return { ops: [
    { op: 'creer_page_de_notion', id, titre, mot_cle_id },
    { op: 'verifier_ligne', table: 'page', cle: { id }, attendu: { id, titre, resume: null, corps_md: CORPS_D_UNE_PAGE_DE_NOTION, mot_cle_id } },
  ] };
}

/** L'insertion d'une catégorie de mots-clés : le service la crée (id suivant, écriture unique, R232 (5)), puis le lot vérifie la ligne créée. */
function traduireLaCreationDUneCategorie(o) {
  const autres = Object.keys(o.apres).filter((c) => !['id', 'libelle'].includes(c));
  if (autres.length) return { refus: `« Catégorie de mot-clé » : le service d’édition crée lui-même cette ligne depuis son libellé, un lot ne lui donne pas ${autres.map((c) => `« ${c} »`).join(', ')}` };
  const { id, libelle } = o.apres;
  return { ops: [
    { op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle } },
    { op: 'verifier_ligne', table: 'categorie_mot_cle', cle: { id }, attendu: { id, libelle } },
  ] };
}

/**
 * Cette opération du lot change-t-elle une clé sans passer par la création d'un mot-clé ? Une ligne de `mot_cle_categorie`, un alignement, une ancre (celle d'un
 * sort donne son parent) : la clé n'est pas recalculée sur le moment, mais une fois après la dernière opération (un état entre deux lignes n'a pas à satisfaire la règle).
 */
const changeUneCle = (o) => o.table === 'mot_cle_categorie' || o.ancrage?.aligner === true
  || (o.operation === 'modifier' && TABLES_ANCRABLES.includes(o.table) && Object.hasOwn(o.apres, 'mot_cle_id'))
  // le nom d'un mot-clé à repère (migration 0136) : sa clé se calcule d'après lui
  || (o.operation === 'modifier' && o.table === 'repere' && Object.hasOwn(o.apres, 'nom'));

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

/** Le mot-clé d'une ligne de `mot_cle`, lu sur son élément (lib/mots-cles-db.mjs#lireUnMotCle), pour la nommer ; null pour une autre table ou un mot-clé parti. */
const motCleLu = (db, table, cle) => (table === 'mot_cle' && Number.isInteger(cle?.id) ? lireUnMotCle(db, cle.id) : null);

/** L'aperçu d'une opération : la table et la ligne par leurs noms, chaque colonne par son libellé, avec la valeur d'avant (celle de la base) et d'après. */
function apercuDe(db, o, ligne, ligneDuLibelle = ligne) {
  const colonnes = Object.keys(o.operation === 'supprimer' ? o.avant : o.apres).filter((c) => !colonneMasquee(o.table, c));
  let libelle;
  try {
    // un mot-clé par le nom qu'il lit sur son élément (migration 0136), même quand la ligne donnée est la sienne, brute
    libelle = libelleDeLigne(o.table, ligneDuMotCle(o.table, ligneDuLibelle ?? o.apres ?? o.avant, motCleLu(db, o.table, o.cle)), o.cle, db);
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
    // un mot-clé se lit sur son élément (lireLaLigne) : un `avant` qui nomme ses colonnes logiques se compare à elles
    const comparaison = comparerAvecLaBase(resolu, (table, cle) => lireLaLigne(db, table, cle));
    const verrous = new Set();
    let adresses = null; // les adresses du site, lues à la première création ancrée
    resolu.operations.forEach((o, i) => {
      const rang = i + 1;
      const c = comparaison.operations[i];
      const ligne = lireLaLigne(db, o.table, o.cle);
      const base = { rang, table: o.table, cle: o.cle, operation: o.operation, apercu: apercuDe(db, o, ligne) };
      const noter = (etat, plus = {}) => sorties.operations.push({ ...base, etat, ...plus });
      const refuser = (message, plus = {}) => {
        if (essai) return noter('refusee', { message, ...plus });
        throw new ErreurEdition(409, `Opération ${rang} refusée : ${message}`, { rang, table: o.table, cle: o.cle, ...plus });
      };
      if (c.etat === 'changee') return noter('changee', { raison: c.raison, ecarts: c.ecarts });
      const { ops, refus } = traduire(o);
      if (refus) return refuser(refus);
      // le mot-clé créé pour une page ou un sort lit son lien sur l'élément (migration 0136) : un lien qui ne mène à aucune page refuse sa ligne, comme avant
      // (les adresses lues valent pour une suite de créations ancrées, qui ne changent aucune page : toute autre ligne les fait relire)
      const creationAncree = o.table === 'mot_cle' && o.operation === 'inserer' && ['page', 'sort'].includes(o.ancrage?.table);
      if (!creationAncree) adresses = null;
      const lien = creationAncree ? refusDuLienDeLAncre(db, o.ancrage, (adresses ??= adressesDuSite(db))) : null;
      if (lien) return refuser(lien);
      return ecrireLesOperations(hote, ops, { essai, ouverts, verrous, rang, o, noter, refuser, etats: { ecrite: essai ? 'applicable' : 'ecrite', verrouillee: essai ? 'verrouillee' : 'ecrite' } });
    });
    sorties.verrous = [...verrous].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    // R309 : un type unique ; seul l'état de fin se juge, sur les mots-clés auxquels ce lot a ajouté une catégorie (le refus ne cite aucun numéro : ce n'est pas un verrou)
    for (const { id, message } of hote.secondesCategories()) {
      const lignes = sorties.operations.filter((s) => s.table === 'mot_cle_categorie' && s.operation === 'inserer' && s.cle.mot_cle_id === id && ['ecrite', 'applicable', 'verrouillee'].includes(s.etat));
      if (!essai || !lignes.length) throw new ErreurEdition(409, lignes.length ? `Opération ${lignes[0].rang} refusée : ${message}` : message, { table: 'mot_cle_categorie', mot_cle: id });
      for (const s of lignes) Object.assign(s, { etat: 'refusee', message });
    }
    // le recalcul différé : une fois, sur l'état final ; à l'essai, une opération refusée dit déjà ce qu'il faut corriger. Son refus n'est pas un verrou (il ne passe pas par ecrireLesOperations)
    const ecrites = sorties.operations.filter((s) => ['ecrite', 'applicable', 'verrouillee'].includes(s.etat));
    const sansRefus = !sorties.operations.some((s) => s.etat === 'refusee');
    // le mot-clé suit son élément (R309) avant ce recalcul : s'il a déjà recalculé les clés, on ne le refait pas
    if (sansRefus && !hote.suivreLesElements() && ecrites.some((s) => changeUneCle(resolu.operations[s.rang - 1]))) hote.executer({ op: 'recalculer_les_cles' });
    if (!essai) {
      if (!hote.ecrites()) {
        throw new ErreurEdition(409, 'Rien à écrire : chaque opération du lot a changé entre-temps (le site prime). Le lot reste proposé : refusez-le, ou déposez-en un nouveau.', { operations: sorties.operations.map(resumerLOperation) });
      }
      // les contrôles du contenu, dans la transaction : un problème né du lot refuse l'application (rien n'est écrit)
      const nouveaux = problemesNes(db, baseline);
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

/**
 * Les problèmes du contenu de `db` qui ne sont pas dans `connus` (ceux d'avant le lot, ou d'avant l'annulation), après les écritures du lot. L'index de recherche
 * des pages est d'abord tenu (serveur/index-des-pages.mjs : la ligne d'une page créée, plus celle d'une page partie), dans la transaction en cours : les contrôles
 * jugent la base telle qu'elle sera validée. Tout problème né du lot compte.
 */
function problemesNes(db, connus) {
  tenirLIndexDesPages(db);
  return controlerLeContenu(db).problemes.filter((p) => !connus.has(p));
}

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
    const nouveaux = refusDeLApplication ? [] : problemesNes(db, connus);
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
function planDeLAnnulation(db, lotId, lignes = null) {
  const journal = lignesDuLot(db, lotId);
  const nets = netsDuJournal(db, journal);
  const choisis = lignes ? nets.filter((n) => lignes.includes(n.rang)) : nets;
  if (lignes && choisis.length !== lignes.length) {
    throw new ErreurEdition(404, `Ligne introuvable dans ce lot : ${lignes.filter((n) => !nets.some((x) => x.rang === n)).join(', ')}`);
  }
  // le rang de son retrait, pas de sa première écriture : un mot-clé dont l'adresse s'est vidée avant qu'il parte revient avant ses catégories
  const retraits = new Map(journal.filter((l) => l.operation === 'supprimer').map((l) => [JSON.stringify([l.table, l.cle]), l.rang]));
  const rangDuRetrait = (n) => retraits.get(JSON.stringify([n.table, n.cle]));
  return [
    ...choisis.filter((n) => n.genre === 'supprimer').sort((a, b) => rangDuRetrait(b) - rangDuRetrait(a)),
    ...choisis.filter((n) => n.genre === 'modifier'),
    ...choisis.filter((n) => n.genre === 'inserer').reverse(),
  ];
}

/**
 * L'effet net de lignes du journal sur cette base : une ligne d'avant la migration 0136 qui note des colonnes que `mot_cle` n'a plus y est ramenée aux colonnes
 * de la table, avec `retirees` et `brut` (lib/lot-de-changements.mjs#sansLesColonnesRetirees ; docs/chantier-retrait-des-colonnes.md, §6 : le journal n'est
 * jamais réécrit, la comparaison et l'écriture de l'annulation les ignorent).
 */
const netsDuJournal = (db, journal) => sansLesColonnesRetirees(effetNetDuLot(journal), colonnesRetirees(db));

/** L'effet net du lot du journal : une ligne par ligne de table touchée, numérotée par le rang de sa première écriture au journal (stable : c'est « la ligne n » des routes). */
export const netsDuLot = (db, lotId) => netsDuJournal(db, lignesDuLot(db, lotId));

/**
 * Les opérations du service qui remettent une ligne : { ops } ou { refus }. La réinsertion d'une ligne retirée par le lot est une restauration à l'identique.
 * Depuis la migration 0136 (docs/chantier-retrait-des-colonnes.md, §2 et §6 ; `nets` : l'effet net du lot) :
 *   - un mot-clé retiré par un lot d'avant la migration revient sans nom : son repère revient avec lui depuis ce que le journal en note (`brut`), sauf si le
 *     même lot remet sa page ou son sort, qui lui rendent son nom ;
 *   - une page ou un sort ancré qui revient reprend le repère que son mot-clé a reçu entre-temps (la migration, ou le site quand l'élément est parti : un
 *     repère ne double jamais une page ni un sort) : le repère part ; sa définition, sa couleur et son icône passent sur la page quand le journal ne les
 *     note pas (lot d'avant la migration), ou viennent du mot-clé que ce lot avait retiré ; un sort n'en porte pas (refus si le repère en a) ;
 *   - l'ancre retirée d'un mot-clé dont le lot avait supprimé le repère (il ancrait un mot-clé existant) : ce repère revient tel qu'il était (`repereDeLAncreRetiree`).
 */
function operationsDeLAnnulation(db, net, jugement, nets = []) {
  if (net.genre === 'modifier') {
    const traduite = traduire({ table: net.table, cle: net.cle, operation: 'modifier', apres: sous(net.aEcrire ?? net.origine, jugement.remises) });
    const repere = jugement.remises.includes('mot_cle_id') ? repereDeLAncreRetiree(db, net, nets) : null;
    return repere && traduite.ops ? { ops: [repere, ...traduite.ops] } : traduite;
  }
  if (net.genre === 'inserer') return traduire({ table: net.table, cle: net.cle, operation: 'supprimer' });
  const { colonnes } = structure(db, net.table);
  const valeurs = sous(net.origine, Object.keys(net.origine).filter((c) => colonnes.includes(c)));
  const ops = [{ op: 'ecrire_inserer', table: net.table, valeurs, restaurer: true }];
  if (!tableExiste(db, 'repere')) return { ops };
  const elementRemis = (k) => nets.some((n) => estUnElementAncreRetire(n) && ['page', 'sort'].includes(n.table) && n.origine.mot_cle_id === k);
  if (net.table === 'mot_cle' && net.brut?.origine && !elementRemis(net.cle.id) && !lireLigne(db, 'repere', { mot_cle_id: net.cle.id })) {
    const r = Object.fromEntries(Object.entries(COLONNES_DU_REPERE).map(([logique, colonne]) => [colonne, net.brut.origine[logique] ?? null]));
    if (r.nom !== null) ops.push({ op: 'ecrire_inserer', table: 'repere', valeurs: { mot_cle_id: net.cle.id, ...r }, restaurer: true });
  }
  if (['page', 'sort'].includes(net.table) && Number.isInteger(net.origine.mot_cle_id)) {
    const k = net.origine.mot_cle_id;
    const repere = nets.some((n) => n.table === 'repere' && n.genre === 'inserer' && n.cle.mot_cle_id === k) ? null : lireLigne(db, 'repere', { mot_cle_id: k });
    const parti = nets.find((n) => n.table === 'mot_cle' && n.genre === 'supprimer' && n.cle.id === k && n.brut?.origine);
    // les champs que le journal ne note pas sur la page : ceux du repère d'aujourd'hui, sinon ceux du mot-clé retiré par ce lot
    const source = repere ? Object.fromEntries(Object.values(COLONNES_DE_LA_PAGE).map((c) => [c, repere[c] ?? null]))
      : parti ? Object.fromEntries(Object.entries(COLONNES_DE_LA_PAGE).map(([logique, c]) => [c, parti.brut.origine[logique] ?? null])) : {};
    const portes = Object.entries(source).filter(([c, v]) => v !== null && !Object.hasOwn(net.origine, c));
    if (net.table === 'sort' && repere && portes.length) {
      return { refus: `le mot-clé de ce sort porte sur son repère une définition, une couleur ou une icône, qu’un mot-clé de sort n’a pas : retirez-les d’abord au Glossaire.` };
    }
    if (net.table === 'page' && portes.length && portes.every(([c]) => colonnes.includes(c))) Object.assign(valeurs, Object.fromEntries(portes));
    if (repere) ops.push({ op: 'ecrire_supprimer', table: 'repere', cle: { mot_cle_id: k } });
  }
  return { ops };
}

/**
 * L'annulation retire l'ancre `net` (une ligne de l'effet net qui a posé le `mot_cle_id` d'une page, d'un sort ou d'un type de sort) : quand ce même lot a
 * supprimé le repère du mot-clé ancré (l'ancre d'un mot-clé existant le lui fait perdre, migration 0136), ce repère revient tel que le journal le note (son
 * nom d'avant, son adresse, sa définition, sa couleur, son icône), avant l'ancre ; le service ne le refait alors pas de la page (décision B3-4 du chantier 4 :
 * « si le lot ne remet pas lui-même un repère »). Rend l'opération, ou null : pas d'ancre retirée, repère que le lot n'a pas supprimé, ou déjà revenu
 * (le lot entier le remet d'abord, `planDeLAnnulation`).
 */
function repereDeLAncreRetiree(db, net, nets) {
  if (!estUneAncre(net) || !tableExiste(db, 'repere')) return null;
  const k = net.fin.mot_cle_id;
  if (!Number.isInteger(k) || net.origine.mot_cle_id === k) return null;
  const retire = nets.find((n) => n.table === 'repere' && n.genre === 'supprimer' && n.cle.mot_cle_id === k);
  if (!retire || lireLigne(db, 'repere', { mot_cle_id: k })) return null;
  const { colonnes } = structure(db, 'repere');
  return { op: 'ecrire_inserer', table: 'repere', valeurs: sous(retire.origine, Object.keys(retire.origine).filter((c) => colonnes.includes(c))), restaurer: true };
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
    // une clé se calcule : l'annulation ne l'écrit jamais, elle reste celle que le recalcul a faite (gardée si ce n'est pas celle d'avant)
    if (net.table === 'mot_cle' && c === 'cle') {
      if (valeur(c) === (net.origine[c] ?? null)) imprevues.delete(c);
      else imprevues.set(c, { colonne: c, ecrite: net.fin[c] ?? null, avant: net.origine[c] ?? null, trouvee: valeur(c) });
    } else if (valeur(c) === (net.fin[c] ?? null)) {
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
 * @param {{ id?: string, lot_id: string, titre: string, nature: string, decision: string | null, lignes?: number[] }} depose `titre` : celui du lot du journal
 *   d'annulation ; `lignes` (R291) : les seules lignes à remettre (rangs de `effetNetDuLot`), sinon le lot entier
 * @param {{ essai: boolean, ouverts?: Set<string>, baseline?: Set<string>, enregistrer?: Function }} o comme `appliquerLeLot`
 */
function annulerLeLot(db, depose, { essai, ouverts = new Set(), baseline = new Set(), enregistrer = null }) {
  const sorties = { operations: [], verrous: [] };
  const travail = (hote) => {
    const verrous = new Set();
    // une ligne que tient une autre ligne du lot encore en place ne s'annule pas seule : chaque refus a son motif
    const dependances = depose.lignes ? dependancesDuLot(db, depose) : null;
    const plan = planDeLAnnulation(db, depose.lot_id, depose.lignes ?? null);
    const nets = netsDuLot(db, depose.lot_id);
    const juge = jugeDesLignes(db, nets);
    const gardes = groupesGardes(db, nets, ligneOuErreur(db, depose.id), lignesDejaAnnulees(ligneOuErreur(db, depose.id))); // un groupe s'annule entier ou reste en place
    let lectureFinale = null; // les balises sur le vocabulaire d'après le recalcul différé
    let place = 0;
    let mentions = null; // au recalcul différé : les mentions lues une fois pour les mots-clés que le lot a créés (`lecteurDesMentions`)
    // `complet` : la ligne entière, quand `net` n'en porte qu'une partie ; `suite` : le second passage d'une ligne, après le recalcul différé
    const remettre = (net, { complet = net, suite = false } = {}) => {
      if (!laisseLesMentions(net)) mentions?.oublier();
      const premiere = suite ? sorties.operations.find((s) => s.rang_du_lot === net.rang) : null;
      const rang = premiere?.rang ?? (place += 1);
      let actuelle = null;
      let illisible = null;
      try {
        actuelle = lireLaLigne(db, net.table, net.cle);
      } catch (e) {
        illisible = e?.message ?? String(e);
      }
      const base = { rang, rang_du_lot: net.rang, table: net.table, cle: net.cle, genre: net.genre };
      const consigner = (sortie) => (premiere ? completerLaLigne(premiere, sortie) : sorties.operations.push(sortie));
      if (illisible) {
        if (!essai) throw new ErreurEdition(409, `Ligne ${rang} refusée : ${illisible}`, { rang, table: net.table, cle: net.cle });
        return consigner({ ...base, etat: 'refusee', message: illisible });
      }
      const vu = suite ? net : juge.vu(net, actuelle); // la ligne à la forme actuelle de ses balises : l'écriture compare à ce que le juge a vu
      const jugement = suite && net.genre === 'modifier' ? jugerApresLeRecalcul(net, actuelle, lectureFinale) : jugerLAnnulation(vu, actuelle);
      const imprevues = new Map(); // colonnes que le service a recalculées vers une troisième valeur pendant la remise : gardées aussi
      const plus = () => {
        const ecarts = [...jugement.gardees, ...imprevues.values()];
        return ecarts.length ? { raison: jugement.raison, ecarts } : {};
      };
      const apercu = apercuDeLAnnulation(db, complet, actuelle); // avant l'écriture : la valeur actuelle est celle d'avant la remise
      const noter = (etat, reste = {}) => consigner({ ...base, apercu, etat, ...plus(), ...reste });
      if (!suite && gardes.has(net.rang)) return noter('gardee', { raison: 'groupe_change', message: gardes.get(net.rang) });
      // une ligne emportée avec elle ne la tient pas (`lignesEmportees`)
      const tenue = (dependances?.get(net.rang) ?? []).filter((d) => d.rangs.some((r) => !depose.lignes.includes(r)));
      if (tenue.length) {
        const message = `cette ligne ne s’annule pas seule : ${tenue.map((d) => d.raison).join(' ; ')}`;
        if (!essai) throw new ErreurEdition(409, `Ligne ${net.rang} refusée : ${message}`, { rang: net.rang, table: net.table, cle: net.cle, depend_de: [...new Set(tenue.flatMap((d) => d.rangs))] });
        return noter('refusee', { message, depend_de: [...new Set(tenue.flatMap((d) => d.rangs))] });
      }
      const refuser = (message, reste = {}) => {
        if (essai) return noter('refusee', { message, ...reste });
        throw new ErreurEdition(409, `Ligne ${rang} refusée : ${message}`, { rang, table: net.table, cle: net.cle, ...reste });
      };
      // une ligne d'avant la migration 0136 qui n'écrivait que des colonnes que le mot-clé n'a plus : rien à remettre ici, le champ se corrige sur son élément ;
      // demandée seule, elle est refusée ; dans le lot entier (ou emportée avec une autre), elle est gardée et n'empêche pas le reste
      if (neResteRienARemettre(net)) {
        const message = motifDesColonnesRetirees(db, net);
        return depose.ligne === net.rang ? refuser(message) : noter('gardee', { raison: 'colonnes_retirees', message });
      }
      if (jugement.etat === 'deja') return noter('deja');
      if (jugement.etat === 'gardee') return noter('gardee');
      // une clé se calcule (R232) : demandée seule, elle n'a rien à écrire ; sans numéro de décision, ce n'est pas un verrou à ouvrir. Emportée avec la ligne
      // qui l'a causée (le titre de la page dont le mot-clé lit son nom, `groupesDesAdresses`), elle se juge après le recalcul
      if (depose.lignes?.length === 1 && estUneCleRecalculee(net)) return refuser(MOTIF_DE_LA_CLE_RECALCULEE);
      // le nom a changé depuis sans changer la clé : il ne reste que la clé à remettre, et elle ne s'écrit pas (aucun verrou à proposer) ; elle est gardée
      if (resteSeulementLaCle(net, jugement)) {
        imprevues.set('cle', { colonne: 'cle', ecrite: net.fin.cle ?? null, avant: net.origine.cle ?? null, trouvee: actuelle.cle ?? null });
        return noter('gardee');
      }
      if (estUnRenvoiDeCle(nets, net)) return noter('gardee', { raison: 'cle_gardee', message: MOTIF_DU_RENVOI }); // encore là : sa clé n'est pas revenue
      const { ops, refus } = operationsDeLAnnulation(db, vu, jugement, nets);
      if (refus) return refuser(refus);
      // une colonne que le service recalcule depuis une autre (la clé d'un mot-clé, après son libellé) est déjà revenue quand on la remet : on ne l'écrit pas
      const adapter = (op) => (op.op === 'ecrire_modifier' ? valeursEncoreARemettre(db, vu, op, imprevues) : op);
      return ecrireLesOperations(hote, ops, { essai, ouverts, verrous, rang, o: { table: net.table, cle: net.cle }, noter, refuser, adapter, etats: { ecrite: 'remise', verrouillee: essai ? 'verrouillee' : 'remise' } });
    };
    if (!annulationAuRecalculDiffere(db, depose, plan)) {
      plan.forEach((net) => remettre(juge.enClesDuMoment(net)));
      // le titre remis d'une page ancrée (le nom d'un sort, d'un repère) rend son nom au mot-clé (migration 0136) : sa clé le suit avant les contrôles, comme à
      // l'aller (edition-ancrage.mjs#suivreLesElements, qui ne joue pas en annulation) ; un nom que la règle ne sait pas distinguer garde sa clé (B3-1)
      if (hote.ecrites() && plan.some(nomRemis)) {
        try {
          hote.isoler(() => hote.executer({ op: 'recalculer_les_cles' }));
        } catch (e) {
          if (!(e instanceof ErreurEdition)) throw e;
        }
      }
    } else {
      // l'état entre deux lignes n'a pas à satisfaire la règle des clés : on remet d'abord ce qui les fait (les textes avant les suppressions : un mot-clé cité ne se
      // supprime pas), on recalcule une fois, puis on juge ce que le recalcul a réécrit lui-même (la clé, les balises)
      hote.differerLesCles();
      mentions = lecteurDesMentions(db);
      hote.lireLesMentionsPar(mentions);
      plan.filter((n) => n.genre === 'supprimer').forEach((net) => remettre(net));
      const lecture = lectureDesBalises(motsClesDeLaBase(db, { elements: false }), clesDAvantLeLot(nets)); // après les réinsertions : leurs mots-clés sont de nouveau cités
      // une ligne d'un groupe gardé ne se coupe pas en deux : elle est notée une fois, entière
      // le renvoi d'une clé quittée se juge après le recalcul, qui le retire si la clé revient
      const parties = plan.filter((n) => n.genre !== 'supprimer').map((net) => (gardes.has(net.rang) || neResteRienARemettre(net) ? { net, dabord: net, ensuite: null }
        : estUnRenvoiDeCle(nets, net) ? { net, dabord: null, ensuite: net } : { net, ...partiesDeLaRemise(net, lecture) }));
      for (const { net, dabord } of parties) if (dabord) remettre(dabord, { complet: net });
      hote.executer({ op: 'recalculer_les_cles' });
      mentions.oublier(); // le recalcul a pu réécrire des balises
      lectureFinale = lectureDesBalises(motsClesDeLaBase(db, { elements: false }));
      for (const { net, ensuite } of parties) if (ensuite) remettre(ensuite, { complet: net, suite: true });
    }
    sorties.verrous = [...verrous].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    if (!essai) {
      if (!hote.ecrites()) {
        throw new ErreurEdition(409, depose.lignes
          ? 'Rien à remettre pour cette ligne : ses valeurs ont changé depuis (le site prime), ou sont déjà revenues à ce qu’elles étaient. Le lot reste appliqué.'
          : 'Rien à remettre : chaque valeur du lot a changé depuis (le site prime), ou est déjà revenue à ce qu’elle était. Le lot reste appliqué.', { operations: sorties.operations.map(resumerLOperation) });
      }
      const nouveaux = problemesNes(db, baseline);
      if (nouveaux.length) {
        throw new ErreurEdition(409, `Les contrôles du contenu refusent l’annulation (${nombreDe(nouveaux.length, 'problème', 'problèmes')}) : ${nouveaux.slice(0, 5).join(' ; ')}. Le lot reste appliqué.`, { problemes: nouveaux.slice(0, 40) });
      }
      enregistrer?.(db, sorties, hote);
    }
  };
  const resultat = appliquerUnLot(db, { titre: depose.titre, nature: depose.nature, decision: depose.decision, annulation: true, travail });
  return { lot: resultat.lot, sorties };
}

/**
 * Retirer cette ligne insérée par le lot laisse-t-il les mentions des autres mots-clés comme elles sont ? Un mot-clé (le lecteur écarte sa définition), une catégorie et son
 * rangement : ni texte, ni étiquette, ni synonyme, ni clé quittée d'un mot-clé qui reste. Toute autre ligne fait relire les mentions.
 */
const laisseLesMentions = (n) => n.genre === 'inserer' && ['mot_cle', 'mot_cle_categorie', 'categorie_mot_cle', 'repere'].includes(n.table);

/** Une ligne de l'effet net qui a changé le nom que lit un mot-clé (migration 0136) : le titre d'une page, le nom d'un sort ou d'un repère. */
const nomRemis = (n) => n.genre === 'modifier' && ((n.table === 'page' && Object.hasOwn(n.fin, 'titre')) || (['sort', 'repere'].includes(n.table) && Object.hasOwn(n.fin, 'nom')));

/**
 * L'annulation remet-elle ce qui fait les clés sans passer par le service qui les recalcule ? Une ligne de `mot_cle_categorie`, une ancre, le nom d'une magie dont des sorts
 * sont ancrés, une ligne de `mot_cle` qui porte sa clé sans son nom (Ruling T8-annulation-recalcul), ou le nom d'un mot-clé dans un lot qui a aligné : ses lignes se remettent
 * alors sans recalcul, et les clés une seule fois ensuite (`changeUneCle`, à l'aller). La clé n'est jamais écrite.
 */
function annulationAuRecalculDiffere(db, depose, plan) {
  if (plan.some((n) => n.table === 'mot_cle_categorie' || estUneAncre(n))) return true;
  // une ligne de clé seule, demandée seule, est refusée dans `remettre` : elle n'a rien à recalculer
  if (plan.some((n) => porteLaCleSansLeNom(n) && !(depose.lignes?.length === 1 && estUneCleRecalculee(n)))) return true;
  // même condition que `parentChange` à l'aller (edition-ancrage.mjs#suivreLesElements) : la clé des sorts homonymes dépend du nom de leur magie
  if (plan.some((n) => n.table === 'magie' && n.genre === 'modifier' && Object.hasOwn(n.fin, 'nom')
    && db.prepare('SELECT 1 FROM sort WHERE magie_id = ? AND mot_cle_id IS NOT NULL LIMIT 1').get(n.cle.id))) return true;
  // le nom d'un mot-clé : celui de son repère (migration 0136), ou sa colonne dans une ligne d'avant (seuls les lots d'avant ont aligné)
  const renomme = (n) => n.genre === 'modifier' && ((n.table === 'repere' && Object.hasOwn(n.fin, 'nom')) || (n.table === 'mot_cle' && Object.hasOwn(n.brut?.fin ?? n.fin, 'libelle')));
  if (!plan.some(renomme)) return false;
  return (jsonOuNull(ligneDuLot(db, depose.id)?.contenu)?.operations ?? []).some((o) => o.ancrage?.aligner === true);
}

/**
 * Une ligne de `mot_cle` dont seule la clé a changé : celle d'un voisin, recalculée. Elle revient avec la ligne qui l'a causée, ou avec l'annulation du lot. Pas une
 * ligne d'avant la migration 0136 qui écrivait aussi des colonnes retirées (son nom : `neResteRienARemettre`).
 */
const estUneCleRecalculee = (n) => n.table === 'mot_cle' && n.genre === 'modifier' && !n.retirees?.length && Object.keys(n.fin).length === 1 && Object.hasOwn(n.fin, 'cle');
const MOTIF_DE_LA_CLE_RECALCULEE = 'Seule sa clé a changé, recalculée par le site : elle revient avec la ligne qui l’a causée, ou avec l’annulation du lot.';
/** Une ligne de `mot_cle` qui portait plus que la clé, et dont il ne reste que la clé à remettre : son nom a changé depuis, la clé suit le nom du moment. */
const resteSeulementLaCle = (n, jugement) => n.table === 'mot_cle' && n.genre === 'modifier' && !estUneCleRecalculee(n) && jugement.remises.length === 1 && jugement.remises[0] === 'cle';
/** Une ligne de `mot_cle` dont la clé a changé sans son nom : un voisin ou un parent l'a causé, seul le recalcul la ramène. */
const porteLaCleSansLeNom = (n) => n.table === 'mot_cle' && n.genre === 'modifier' && Object.hasOwn(n.fin, 'cle') && !Object.hasOwn(n.brut?.fin ?? n.fin, 'libelle');

/** Ce que les colonnes retirées par la migration 0136 deviennent dans un motif : le champ du mot-clé, lu sur son élément. */
const CHAMPS_RETIRES = Object.freeze({ libelle: 'son nom', url: 'son adresse', description: 'sa définition', couleur: 'sa couleur', icone: 'son icône' });

/**
 * Pourquoi une ligne de `mot_cle` d'avant la migration 0136 n'a rien à remettre (`neResteRienARemettre`) : elle n'écrivait que des champs que le mot-clé ne porte
 * plus lui-même, et où ils se corrigent désormais (docs/chantier-retrait-des-colonnes.md, §6) : sur sa page, son sort ou son repère (au Glossaire).
 */
function motifDesColonnesRetirees(db, net) {
  const champs = net.retirees.map((c) => CHAMPS_RETIRES[c]);
  const liste = champs.length > 1 ? `${champs.slice(0, -1).join(', ')} et ${champs.at(-1)}` : champs[0];
  const pluriel = champs.length > 1;
  const element = tableExiste(db, 'repere') ? elementDuMotCle(db, net.cle.id) : null;
  const se = pluriel ? 'ces champs se corrigent' : 'ce champ se corrige';
  const ou = !element ? (lireLigne(db, 'mot_cle', { id: net.cle.id }) ? 'ce mot-clé n’a plus d’élément.' : 'ce mot-clé n’existe plus.')
    : element.table === 'page' ? `${se} désormais sur sa page « ${element.id} ».`
      : element.table === 'sort' ? `${se} désormais sur son sort « ${element.id} » (un mot-clé de sort n’a ni définition, ni couleur, ni icône).`
        : `${se} désormais au Glossaire, sur son repère.`;
  return `Cette ligne ne change que ${liste} du mot-clé, qu’il ne porte plus lui-même mais lit sur son élément : ${ou}`;
}

/**
 * Le renvoi noté par le recalcul quand un mot-clé du lot a quitté la clé qu'il avait avant le lot. Il suit cette clé : le recalcul le retire quand elle revient ; tant qu'il est
 * là, le mot-clé ne l'a pas retrouvée et le renvoi reste utile. Toute autre ligne insérée dans `mot_cle_ancienne_cle` (écrite par le lot pour elle-même, ou clé intermédiaire
 * du lot) n'en est pas un : elle part avec l'annulation.
 */
const estUnRenvoiDeCle = (nets, net) => net.table === 'mot_cle_ancienne_cle' && net.genre === 'inserer'
  && nets.some((n) => n.table === 'mot_cle' && n.genre === 'modifier' && n.cle.id === net.fin.mot_cle_id && Object.hasOwn(n.fin, 'cle') && n.origine.cle === net.fin.cle);
const MOTIF_DU_RENVOI = 'Ce renvoi suit la clé du mot-clé : il part quand elle revient, et reste tant qu’elle n’est pas revenue.';

/** Une ligne de l'effet net qui a posé l'ancre d'une page, d'un sort ou d'un type de sort. */
const estUneAncre = (n) => n.genre === 'modifier' && TABLES_ANCRABLES.includes(n.table) && Object.hasOwn(n.fin, 'mot_cle_id');
/** Une ligne de l'effet net : un élément ancré que le lot a retiré, son mot-clé parti avec lui ou gardé par un autre (R289). */
const estUnElementAncreRetire = (n) => n.genre === 'supprimer' && TABLES_ANCRABLES.includes(n.table) && n.origine?.mot_cle_id != null;

/** Les mots-clés que le lot a créés ET ancrés : leur clé suit la règle des clés, qu'un homonyme parti change sans que le site y ait touché. */
function motsClesCreesEtAncres(nets) {
  const crees = new Set(nets.filter((n) => n.table === 'mot_cle' && n.genre === 'inserer').map((n) => n.cle.id));
  return new Set(nets.filter((n) => estUneAncre(n) && crees.has(n.fin.mot_cle_id)).map((n) => n.fin.mot_cle_id));
}

/** Les clés que les mots-clés du lot portaient avant lui : Map(clé → id). */
const clesDAvantLeLot = (nets) => new Map(nets.filter((n) => n.table === 'mot_cle' && typeof n.origine?.cle === 'string').map((n) => [n.origine.cle, n.cle.id]));
/** Les clés que les mots-clés du lot portaient à sa fin : Map(clé → id). */
const clesDeFinDuLot = (nets) => new Map(nets.filter((n) => n.table === 'mot_cle' && typeof n.fin?.cle === 'string').map((n) => [n.fin.cle, n.cle.id]));
const aDesBalises = (valeur) => typeof valeur === 'string' && valeur.includes('{{');

/**
 * Juge les lignes du lot sans compter comme un changement du site ce que le recalcul des clés a réécrit : la clé d'un mot-clé créé et ancré, la clé d'une balise.
 *   - `vu(net, actuelle)` : la ligne, ses valeurs d'avant ou de fin prises à la forme actuelle quand le texte n'en diffère que par la clé d'une balise ;
 *   - `juger(net, actuelle)` : `jugerLAnnulation` de cette ligne ; un texte vraiment changé reste gardé ;
 *   - `seuleLaCle(net, actuelle)` : la ligne n'a rien à remettre et ne diffère de sa valeur d'avant que par la clé d'une balise ;
 *   - `enClesDuMoment(net)` : la ligne, avec ses textes d'avant à écrire aux clés actuelles.
 * Le vocabulaire est relu après chaque écriture de la connexion, seulement si un texte le demande.
 */
function jugeDesLignes(db, nets) {
  const creesEtAncres = motsClesCreesEtAncres(nets);
  const [avant, deFin] = [clesDAvantLeLot(nets), clesDeFinDuLot(nets)];
  let memoire = null;
  let ecritures = -1;
  const lecture = () => {
    const { n } = db.prepare('SELECT total_changes() AS n').get();
    if (n !== ecritures) [memoire, ecritures] = [lectureDesBalises(motsClesDeLaBase(db, { elements: false }), avant, deFin), n];
    return memoire;
  };
  const vu = (net, actuelle) => {
    if (!actuelle || !net.fin) return net;
    const fin = { ...net.fin };
    const origine = net.origine ? { ...net.origine } : net.origine;
    if (net.table === 'mot_cle' && net.genre === 'inserer' && creesEtAncres.has(net.cle.id)) fin.cle = actuelle.cle;
    for (const c of Object.keys(fin)) {
      const valeur = actuelle[c];
      if (!aDesBalises(valeur) || valeur === origine?.[c]) continue;
      const markdown = enMarkdown(net.table, c);
      if (net.genre === 'modifier' && lecture().reecriturePure(origine[c], valeur, markdown)) {
        // le texte d'avant, à la clé près : rien à remettre, le recalcul seul fait sa clé (`jugerLAnnulation` le classe `deja`)
        origine[c] = valeur;
        fin[c] = null;
      } else if (valeur !== fin[c] && lecture().commeFin(fin[c], valeur, markdown)) fin[c] = valeur;
    }
    return { ...net, origine, fin };
  };
  return {
    vu,
    juger: (net, actuelle) => jugerLAnnulation(vu(net, actuelle), actuelle),
    seuleLaCle(net, actuelle) {
      if (net.genre !== 'modifier' || !actuelle) return false;
      const vue = vu(net, actuelle);
      const { remises, gardees } = jugerLAnnulation(vue, actuelle);
      return !remises.length && !gardees.length && Object.keys(net.fin).some((c) => vue.origine[c] !== net.origine[c]);
    },
    enClesDuMoment: (net) => (net.genre === 'modifier' && Object.values(net.origine).some(aDesBalises) ? avecClesDuMoment(net, lecture()) : net),
  };
}

const enMarkdown = (table, colonne) => typeDeTexte(table, colonne) === 'markdown';

/** Une ligne modifiée, avec ce que sa remise écrit : ses valeurs d'avant, chaque balise à la clé actuelle de son mot-clé (la clé d'avant peut être devenue ambiguë). */
const avecClesDuMoment = (net, lecture) => (net.genre !== 'modifier' ? net
  : { ...net, aEcrire: Object.fromEntries(Object.entries(net.origine).map(([c, v]) => [c, lecture.enClesDuMoment(v, enMarkdown(net.table, c))])) });

/**
 * Une ligne de l'effet net en deux parties. `dabord`, ce que l'annulation remet avant le recalcul : les textes dont le contenu change y sont, écrits avec les clés
 * du moment (`aEcrire`), et le recalcul les ramène aux clés finales. `ensuite`, ce qu'il réécrit lui-même : la clé d'un mot-clé, un texte dont seule la clé d'une
 * balise a changé ; ces colonnes ne s'écrivent pas, elles se jugent après lui.
 */
function partiesDeLaRemise(net, lecture) {
  if (net.genre !== 'modifier') return { dabord: net, ensuite: null };
  const colonnes = Object.keys(net.fin);
  const suivent = colonnes.filter((c) => (net.table === 'mot_cle' && c === 'cle') || lecture.reecriturePure(net.origine[c], net.fin[c], enMarkdown(net.table, c)));
  const partie = (cs) => (cs.length ? { ...net, origine: sous(net.origine, cs), fin: sous(net.fin, cs) } : null);
  const dabord = partie(colonnes.filter((c) => !suivent.includes(c)));
  return { dabord: dabord && avecClesDuMoment(dabord, lecture), ensuite: partie(suivent) };
}

/**
 * Le jugement, après le recalcul, d'une colonne qu'il réécrit : revenue à sa valeur d'avant (au besoin à la forme près d'une balise qui cite le même mot-clé),
 * elle est `deja` ; sinon elle est gardée, jamais réécrite à la main : la règle maintient la clé, ou le site a changé la valeur.
 */
function jugerApresLeRecalcul(net, actuelle, lecture) {
  const jugement = jugerLAnnulation(net, actuelle);
  if (!actuelle) return jugement;
  const deja = [];
  const gardees = [];
  for (const c of Object.keys(net.fin)) {
    const valeur = actuelle[c] ?? null;
    if (valeur === (net.origine[c] ?? null) || lecture.revenu(net.origine[c], valeur, enMarkdown(net.table, c))) deja.push(c);
    else gardees.push({ colonne: c, ecrite: net.fin[c] ?? null, avant: net.origine[c] ?? null, trouvee: valeur });
  }
  return { etat: gardees.length ? 'gardee' : 'deja', remises: [], deja, gardees, raison: jugement.raison };
}

/** Cette ligne de l'effet net tient-elle au mot-clé `k` : sa ligne, une de ses catégories, une clé qu'il a quittée, une ancre qui le cite, son repère ? */
const tientAuMotCle = (n, k) => (n.table === 'mot_cle' && n.cle.id === k) || (n.table === 'mot_cle_categorie' && n.cle.mot_cle_id === k)
  || (n.table === 'mot_cle_ancienne_cle' && (n.fin ?? n.origine)?.mot_cle_id === k) || (estUneAncre(n) && n.fin.mot_cle_id === k)
  || (n.table === 'repere' && n.cle.mot_cle_id === k);

/**
 * Les lignes qu'annuler une ligne emporte, parce que seule elle n'a pas de sens : Map(rang → les rangs du groupe, croissants), sans entrée pour une ligne qui reste
 * seule. Un mot-clé créé et ancré par le lot : sa ligne, ses catégories, ses clés quittées et les ancres qui le citent. Dans un lot de l'action « Préparer l'ancrage »
 * (`lot` : sa décision et son auteur, lib/lots-d-ancrage.mjs#estUnLotDAncrage ; un lot de l'équipe qui cite R309 n'en est pas un), le
 * reclassement d'un mot-clé : toutes ses lignes de `mot_cle_categorie`. Par mot-clé, les éléments ancrés retirés avec lui : eux, sa ligne, ses catégories, synonymes et clés
 * quittées ; s'il est gardé par un autre élément (R289) et que son adresse s'est vidée : eux et sa ligne. Par page dont le lot a déplacé l'adresse (R316,
 * `groupesDesAdresses`) : sa ligne, la ligne de l'élément dont elle tire son segment s'il a changé (don, métier, race, classe), ses anciennes adresses et les
 * mots-clés dont l'adresse l'a suivie ; ce groupe s'unit à ceux qu'il recoupe. Par page de notion insérée par le lot (`groupesDesPagesDeNotion`) : sa ligne,
 * ses sources, l'ancienne adresse qu'elle a reprise et la ligne de son mot-clé si le lot l'a écrite (son adresse ; créé par le lot, avec ses catégories,
 * synonymes et clés quittées) ; la source du jour, partagée, reste seule ; ce groupe s'unit aussi à ceux qu'il recoupe.
 * Rien d'autre : un renommage qui ne déplace pas l'adresse, l'ancre d'un mot-clé existant, un lot sans ancrage restent ligne à ligne.
 */
function lignesEmportees(nets, lot, db) {
  const groupes = new Map();
  const grouper = (lignes) => {
    const rangs = lignes.map((n) => n.rang).sort((a, b) => a - b);
    for (const r of rangs) groupes.set(r, rangs);
  };
  const crees = motsClesCreesEtAncres(nets);
  for (const k of crees) grouper(nets.filter((n) => tientAuMotCle(n, k)));
  // un mot-clé créé nu et le repère qui naît avec lui (migration 0136) : l'un sans l'autre n'a pas de sens
  for (const m of nets.filter((n) => n.table === 'mot_cle' && n.genre === 'inserer' && !crees.has(n.cle.id) && !groupes.has(n.rang))) {
    const repere = nets.find((n) => n.table === 'repere' && n.genre === 'inserer' && n.cle.mot_cle_id === m.cle.id);
    if (repere) grouper([m, repere]);
  }
  if (estUnLotDAncrage(lot)) {
    const reclasses = new Set(nets.filter((n) => n.table === 'mot_cle_categorie' && !crees.has(n.cle.mot_cle_id)).map((n) => n.cle.mot_cle_id));
    for (const k of reclasses) grouper(nets.filter((n) => n.table === 'mot_cle_categorie' && n.cle.mot_cle_id === k));
  }
  // les éléments retirés et leur mot-clé reviennent ensemble, un groupe par mot-clé (après les reclassements : ce groupe contient le leur)
  for (const [k, elements] of Map.groupBy(nets.filter(estUnElementAncreRetire), (n) => n.origine.mot_cle_id)) {
    const motCle = nets.find((n) => n.table === 'mot_cle' && n.cle.id === k);
    // gardé, il a reçu un repère (migration 0136) ; dans un lot d'avant, son adresse s'est vidée
    const repere = nets.find((n) => n.table === 'repere' && n.genre === 'inserer' && n.cle.mot_cle_id === k);
    if (motCle?.genre === 'supprimer') grouper([...elements, ...nets.filter((n) => tientAuMotCle(n, k) || (n.table === 'mot_cle_synonyme' && n.origine?.mot_cle_id === k))]);
    else if (repere) grouper([...elements, repere]);
    else if (motCle?.genre === 'modifier' && Object.hasOwn(motCle.brut?.fin ?? motCle.fin, 'url') && (motCle.brut?.fin ?? motCle.fin).url === null) grouper([...elements, motCle]);
  }
  // les pages de notion, puis les adresses en dernier : un groupe qui recoupe un groupe déjà fait l'absorbe (la ligne de la page peut être l'ancre d'un mot-clé
  // créé, ou la page de notion de ce mot-clé)
  for (const lignes of [...groupesDesPagesDeNotion(nets), ...groupesDesAdresses(nets, db)]) {
    const rangs = new Set(lignes.flatMap((n) => groupes.get(n.rang) ?? [n.rang]));
    grouper([...rangs].map((r) => ({ rang: r })));
  }
  return groupes;
}

/** Une ligne de l'effet net : une page de notion insérée par le lot (son mot-clé pour ancre, le bloc `notion` pour texte : serveur/edition-notions.mjs). */
const estUnePageDeNotionInseree = (n) => n.table === 'page' && n.genre === 'inserer' && n.fin?.mot_cle_id != null && n.fin.corps_md === CORPS_D_UNE_PAGE_DE_NOTION;

/**
 * Les lignes de l'effet net qu'une page de notion insérée par le lot lie, une liste par page : la page ; ses lignes de `page_source` ; l'ancienne adresse
 * (`page_ancienne_adresse`) qu'elle a reprise en naissant (R316, décision 3 de docs/chantier-adresses.md) ; la ligne de son mot-clé si le lot l'a écrite (un
 * mot-clé existant : son adresse ; un mot-clé créé par le lot : sa ligne, ses catégories, synonymes et clés quittées). La ligne `source` du jour, que d'autres
 * pages du lot citent, n'en est pas.
 */
function groupesDesPagesDeNotion(nets) {
  return nets.filter(estUnePageDeNotionInseree).map((p) => {
    const k = p.fin.mot_cle_id;
    const adresse = adresseDeLaPage(p.cle.id, null);
    const motCle = nets.find((n) => n.table === 'mot_cle' && n.cle.id === k);
    const duMotCle = motCle?.genre === 'inserer'
      ? nets.filter((n) => n !== p && (tientAuMotCle(n, k) || (n.table === 'mot_cle_synonyme' && n.fin?.mot_cle_id === k)))
      : motCle?.genre === 'modifier' && Object.hasOwn(motCle.brut?.fin ?? motCle.fin, 'url') ? [motCle] : [];
    // le repère que la page a repris (migration 0136) : il revient quand elle part (l'annulation le remet d'abord, le contrôle du contenu juge l'état final)
    const repere = nets.filter((n) => n.table === 'repere' && n.genre === 'supprimer' && n.cle.mot_cle_id === k && !duMotCle.includes(n));
    return [
      p, ...nets.filter((n) => n.table === 'page_source' && n.cle.page_id === p.cle.id),
      ...nets.filter((n) => n.table === 'page_ancienne_adresse' && n.genre === 'supprimer' && avecBarre(n.cle.adresse) === adresse), ...duMotCle, ...repere,
    ];
  });
}

/** `page_ancienne_adresse.adresse` (sans barre initiale) en adresse de `mot_cle.url`. */
const avecBarre = (adresse) => `/${adresse}`;

/**
 * Les lignes de l'effet net qu'un déplacement d'adresse lie (R316, serveur/edition-adresses.mjs#suivreLesTitres), une liste par page déplacée, deux lignes au
 * moins : la page dont le lot a changé `slug_adresse` (ou qui a reçu une ancienne adresse : son segment, null avant comme après, n'est pas dans l'effet net) ; la
 * ligne de l'élément dont elle tire son segment, s'il a changé (un don, un métier, une race, une classe : edition-adresses.mjs#tableDeLElement ; remis en premier,
 * dans l'ordre du lot, il ramène le titre de la page, que l'annulation ne remet pas elle-même) ; les lignes de `page_ancienne_adresse` écrites pour elle
 * (insérées ou reprises à son nom) et celle retirée de sa nouvelle adresse ; les mots-clés dont le lot a fait passer l'adresse de l'adresse quittée à la nouvelle
 * (lib/adresses-db.mjs#adresseQuiSuit) ; depuis la migration 0136, la ligne du mot-clé ancré sur la page renommée qui ne change que sa clé (son nom se lit sur
 * le titre : sa clé le suit ; `db` lit l'ancre). Une page créée par le lot n'en a pas : sa ligne est entière.
 */
function groupesDesAdresses(nets, db) {
  const anciennes = nets.filter((n) => n.table === 'page_ancienne_adresse');
  // le mot-clé dont la page est l'élément lit son nom sur elle (migration 0136) : sa clé suit le titre, et la ligne qui ne change qu'elle va avec l'adresse
  const ancreDe = (id) => (db && tableExiste(db, 'repere') ? db.prepare('SELECT mot_cle_id FROM page WHERE id = ?').get(id)?.mot_cle_id ?? null : null);
  const pages = new Map();
  for (const n of nets) {
    if (n.table === 'page' && n.genre === 'modifier' && Object.hasOwn(n.fin, 'slug_adresse') && !memeValeur(n.origine.slug_adresse ?? null, n.fin.slug_adresse ?? null)) pages.set(n.cle.id, n);
  }
  for (const a of anciennes) {
    const id = a.genre === 'supprimer' ? null : a.fin.page_id;
    if (id != null && !pages.has(id)) pages.set(id, nets.find((n) => n.table === 'page' && n.genre === 'modifier' && n.cle.id === id) ?? null);
  }
  const sortie = [];
  for (const [id, page] of pages) {
    const segment = (cote) => (page && Object.hasOwn(page[cote], 'slug_adresse') ? page[cote].slug_adresse ?? null : null);
    const adresse = adresseDeLaPage(id, segment('fin'));
    const ecrites = anciennes.filter((a) => a.genre !== 'supprimer' && a.fin.page_id === id);
    const retiree = anciennes.filter((a) => a.genre === 'supprimer' && avecBarre(a.cle.adresse) === adresse);
    // l'adresse quittée : celle du segment d'avant, et chaque ancienne adresse écrite pour la page
    const quittees = new Set([...(page && Object.hasOwn(page.origine, 'slug_adresse') ? [adresseDeLaPage(id, segment('origine'))] : []), ...ecrites.map((a) => avecBarre(a.cle.adresse))]);
    quittees.delete(adresse);
    // les repères dont l'adresse a suivi (migration 0136), et les mots-clés d'un lot d'avant, dont la colonne `url` suivait
    const suit = (avant, apres) => [...quittees].some((quittee) => adresseQuiSuit(avant, { quittee, adresse }) === apres);
    const motsCles = nets.filter((n) => n.genre === 'modifier' && (
      (n.table === 'repere' && Object.hasOwn(n.fin, 'adresse') && suit(n.origine.adresse, n.fin.adresse))
      || (n.table === 'mot_cle' && Object.hasOwn(n.brut?.fin ?? n.fin, 'url') && suit((n.brut?.origine ?? n.origine).url, (n.brut?.fin ?? n.fin).url))));
    const element = nets.find((n) => n.genre === 'modifier' && n.table === tableDeLElement(id) && n.cle.id === id);
    const k = page && Object.hasOwn(page.fin, 'titre') ? ancreDe(id) : null;
    const cle = k === null ? [] : nets.filter((n) => estUneCleRecalculee(n) && n.cle.id === k);
    const lignes = [...(element ? [element] : []), ...(page ? [page] : []), ...ecrites, ...retiree, ...motsCles, ...cle];
    if (lignes.length > 1) sortie.push(lignes);
  }
  return sortie;
}

const MOTIF_DU_GROUPE_GARDE = 'Ce mot-clé a changé depuis le lot : ses lignes restent toutes en place.';
/**
 * L'adresse que la page d'un groupe d'adresse avait avant le lot est-elle aujourd'hui celle d'une autre page (R316, choix 12) ? La même adresse, ancre comprise
 * (l'ancre d'un métier n'est pas tenue par la page servie à son chemin). `index` : rend indexDesAdresses(db, { exemples: true }), lu une fois par appelant.
 */
function adresseDAvantReprise(index, lignes) {
  const page = lignes.find((n) => n.table === 'page' && n.genre === 'modifier' && Object.hasOwn(n.origine, 'slug_adresse'));
  if (!page) return false;
  const tenante = index().exactes.get(adresseDeLaPage(page.cle.id, page.origine.slug_adresse ?? null)) ?? null;
  return tenante !== null && tenante !== page.cle.id;
}

const MOTIF_DE_L_ADRESSE_GARDEE = 'Cette page, son adresse ou un mot-clé qui la suit a changé depuis le lot : les lignes de son adresse restent toutes en place.';
const MOTIF_DE_LA_PAGE_DE_NOTION_GARDEE = 'Cette page de notion, ou son mot-clé, a changé depuis le lot : ses lignes restent toutes en place.';
const MOTIF_DE_LA_CATEGORIE_GARDEE = 'Cette catégorie range encore un mot-clé qui a changé depuis le lot : elle reste en place.';

/** Où en est une ligne d'un groupe : `en_place`, `revenue` (comme avant le lot) ou `changee`. D'une ancre, seule `mot_cle_id` compte (le lot a pu réécrire une balise de la même ligne). */
function etatDansLeGroupe(net, actuelle, juge) {
  const temoin = estUneAncre(net) ? { ...net, origine: sous(net.origine, ['mot_cle_id']), fin: sous(net.fin, ['mot_cle_id']) } : net;
  const { gardees, remises } = juge.juger(temoin, actuelle);
  return gardees.length ? 'changee' : remises.length ? 'en_place' : 'revenue';
}

/** Les champs d'un mot-clé que son élément porte et qu'aucune autre ligne du groupe ne dit : sa définition, sa couleur, son icône. */
const CHAMPS_DE_L_ELEMENT = Object.freeze(['description', 'couleur', 'icone']);

/**
 * La définition, la couleur ou l'icône du mot-clé que la ligne `net` a créé ont-elles changé depuis le lot ? Depuis la migration 0136, elles se lisent sur son
 * élément (lib/mots-cles-db.mjs#lireUnMotCle) et la ligne du mot-clé ne les note plus : leur valeur à la fin du lot est celle que le lot a écrite sur son repère
 * ou sur la page qu'il lui a donnée, sinon aucune (un mot-clé créé n'en a pas d'autre) ; une ligne d'avant la migration les note elle-même (`brut`).
 * Faux pour toute autre ligne, et pour un mot-clé parti depuis (le groupe se juge sans lui).
 */
function champsDeLElementChanges(db, nets, net) {
  if (net.table !== 'mot_cle' || net.genre !== 'inserer' || !tableExiste(db, 'repere')) return false;
  const k = net.cle.id;
  const m = Number.isInteger(k) ? lireUnMotCle(db, k) : null;
  if (!m) return false;
  const repere = nets.find((n) => n.table === 'repere' && n.genre !== 'supprimer' && n.cle.mot_cle_id === k);
  const page = nets.find((n) => n.table === 'page' && n.genre !== 'supprimer' && n.fin?.mot_cle_id === k);
  const deFin = (c) => (net.brut?.fin ? net.brut.fin[c]
    : repere ? repere.fin[COLONNES_DU_REPERE[c]] : page ? page.fin[COLONNES_DE_LA_PAGE[c]] : null) ?? null;
  return CHAMPS_DE_L_ELEMENT.some((c) => (m[c] ?? null) !== deFin(c));
}

/**
 * Les mots-clés créés des `groupes` qu'une ligne de la base cite sans être ce que le lot a laissé, comparée par identité. Une ligne n'est du lot que si l'effet net porte
 * sa clé avec cette même valeur de clé étrangère à `fin` ; sinon elle a été ajoutée depuis. Une ligne du lot hors du groupe et retouchée depuis compte aussi : la
 * CASCADE l'emporterait. Une ligne du lot retirée depuis ne compte pas, une ligne du groupe se juge dans `etatDansLeGroupe`, les clés quittées sont écrites par le recalcul.
 */
function fillesAjoutees(db, nets, groupes, juge) {
  const duGroupe = new Set(groupes.flat());
  const motsCles = nets.filter((n) => n.table === 'mot_cle' && n.genre === 'inserer' && duGroupe.has(n.rang)).map((n) => n.cle.id);
  // le repère que la migration 0136 a posé au mot-clé créé par un lot d'avant (sa ligne porte les colonnes retirées) n'a pas été ajouté depuis : sinon sa
  // création ne s'annulerait plus
  const reperesDeLaMigration = new Set(nets.filter((n) => n.table === 'mot_cle' && n.genre === 'inserer' && n.retirees?.length).map((n) => n.cle.id));
  const trouves = new Set();
  if (!motsCles.length) return trouves;
  const idDeLigne = (cle, valeurs) => JSON.stringify(cle.map((c) => String(valeurs[c])));
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'mot_cle_ancienne_cle'").all()) {
    for (const g of etrangeresDe(db, name)) {
      if (g.table !== 'mot_cle' || g.paires.length !== 1) continue;
      const colonne = g.paires[0].de;
      const { cle } = structure(db, name);
      const duLot = new Map(nets.filter((n) => n.table === name).map((n) => [idDeLigne(cle, n.cle), n]));
      const lues = [...new Set([...cle, colonne])].map((c) => `"${c}"`).join(', ');
      for (const l of db.prepare(`SELECT ${lues} FROM "${name}" WHERE "${colonne}" IN (${motsCles.map(() => '?').join(', ')})`).all(...motsCles)) {
        const net = duLot.get(idDeLigne(cle, l));
        if (!net && name === 'repere' && reperesDeLaMigration.has(l[colonne])) continue;
        const ecriteParLeLot = net && memeValeur(net.fin?.[colonne], l[colonne]);
        if (!ecriteParLeLot || (!duGroupe.has(net.rang) && juge.juger(net, lireLigne(db, name, net.cle)).gardees.length)) trouves.add(l[colonne]);
      }
    }
  }
  return trouves;
}

/**
 * Les lignes des groupes (`lignesEmportees`) qui ne s'annulent pas, car un groupe s'annule entier ou reste en place : Map(rang → motif). Un groupe est gardé si une de ses
 * lignes n'est plus telle que le lot l'a laissée (la clé d'un mot-clé créé et ancré mise à part, ainsi que ses clés quittées : le recalcul les réécrit), ou si une
 * ligne fille a été ajoutée à son mot-clé créé, ou retouchée depuis (`fillesAjoutees`). Un groupe déjà revenu en entier, ou déjà annulé (`annulees`), n'a plus rien à garder. Une catégorie créée par le lot
 * qui range encore un mot-clé gardé est gardée avec lui. Pour un mot-clé existant reclassé, le journal ne dit pas quelles catégories il avait : seules ses lignes du lot se comparent.
 */
function groupesGardes(db, nets, lot, annulees = new Set()) {
  const gardes = new Map();
  const groupes = [...new Set(lignesEmportees(nets, lot, db).values())].filter((rangs) => !rangs.every((r) => annulees.has(r)));
  if (!groupes.length) return gardes;
  const parRang = new Map(nets.map((n) => [n.rang, n]));
  const juge = jugeDesLignes(db, nets);
  const avecFilles = fillesAjoutees(db, nets, groupes, juge);
  let lu = null;
  const index = () => (lu ??= indexDesAdresses(db, { exemples: true })); // les adresses d'aujourd'hui, lues au premier groupe d'adresse jugé
  const lue = (n) => {
    try {
      return lireLigne(db, n.table, n.cle);
    } catch {
      return null;
    }
  };
  for (const rangs of groupes) {
    const lignes = rangs.map((r) => parRang.get(r));
    // une ligne d'avant la migration 0136 qui n'écrivait que des colonnes retirées n'a rien à remettre : elle ne dit rien de l'état du groupe
    const etats = lignes.filter((n) => n.table !== 'mot_cle_ancienne_cle' && !neResteRienARemettre(n)).map((n) => etatDansLeGroupe(n, lue(n), juge));
    // la définition, la couleur ou l'icône d'un mot-clé créé, écrites depuis sur son élément (migration 0136) : la ligne du mot-clé ne les porte plus
    if (lignes.some((n) => champsDeLElementChanges(db, nets, n))) etats.push('changee');
    const enPlace = etats.filter((e) => e === 'en_place').length;
    if (!enPlace && !etats.includes('changee')) continue;
    const motCle = lignes.find((n) => n.table === 'mot_cle');
    // le groupe d'une page de notion dit le sien ; celui d'une adresse déplacée (sans mot-clé créé) aussi
    const motif = lignes.some(estUnePageDeNotionInseree) ? MOTIF_DE_LA_PAGE_DE_NOTION_GARDEE
      : lignes.some((n) => n.table === 'page_ancienne_adresse' || (n.table === 'page' && Object.hasOwn(n.fin ?? {}, 'slug_adresse')))
        && !lignes.some((n) => n.table === 'mot_cle' && n.genre === 'inserer') ? MOTIF_DE_L_ADRESSE_GARDEE : MOTIF_DU_GROUPE_GARDE;
    // l'adresse d'avant reprise par une autre page n'est pas une retouche : l'annulation se tente, et la refuse en nommant cette page (R316, choix 12)
    if (motif === MOTIF_DE_L_ADRESSE_GARDEE && adresseDAvantReprise(index, lignes)) continue;
    if (enPlace < etats.length || (motCle && avecFilles.has(motCle.cle.id))) for (const r of rangs) gardes.set(r, motif);
  }
  const rangees = nets.filter((n) => gardes.has(n.rang) && n.table === 'mot_cle_categorie' && n.fin);
  for (const n of nets) {
    if (n.table === 'categorie_mot_cle' && n.genre === 'inserer' && rangees.some((x) => x.fin.categorie_id === n.cle.id)) gardes.set(n.rang, MOTIF_DE_LA_CATEGORIE_GARDEE);
  }
  return gardes;
}

const PRIORITE_DES_ETATS = Object.freeze(['refusee', 'verrouillee', 'remise', 'gardee', 'deja']);

/** Le second passage d'une ligne s'ajoute au premier : une seule sortie par ligne du lot, de l'état le plus fort, avec tous ses écarts. */
function completerLaLigne(sortie, suite) {
  const ecarts = [...(sortie.ecarts ?? []), ...(suite.ecarts ?? [])];
  if (ecarts.length) {
    sortie.ecarts = ecarts;
    sortie.raison ??= suite.raison ?? null;
  }
  if (PRIORITE_DES_ETATS.indexOf(suite.etat) < PRIORITE_DES_ETATS.indexOf(sortie.etat)) {
    sortie.etat = suite.etat;
    if (suite.message) sortie.message = suite.message;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Une seule ligne d'un lot appliqué (R291) : « annuler cette modification »
// ---------------------------------------------------------------------------------------------------------------------------------------------
// Une « ligne » est une ligne de l'effet net du lot (`effetNetDuLot`) : une ligne de table avec les colonnes que le lot en a changées (modifiée), la ligne qu'il
// a créée (insérée) ou celle qu'il a retirée (supprimée). C'est la granularité la plus sûre : le service écrit plusieurs fois la même ligne (clé recalculée,
// page refaite), et remettre une seule colonne d'une ligne de table laisserait ces recalculs en désaccord. Son numéro est le rang de sa première écriture au
// journal du lot : stable, jamais renuméroté quand une autre ligne est annulée.

const memeValeur = (a, b) => (a === null || a === undefined ? b === null || b === undefined : b !== null && b !== undefined && (a === b || String(a) === String(b)));

/** Les clés étrangères d'une table, par groupe (une clé composée en est un) : [{ table, paires: [{ de, vers }] }] ; la table est vérifiée avant d'entrer dans le SQL. */
function etrangeresDe(db, table) {
  if (!tableExiste(db, table)) return [];
  const groupes = new Map();
  for (const f of db.prepare(`PRAGMA foreign_key_list("${table}")`).all()) {
    const g = groupes.get(f.id) ?? { table: f.table, paires: [] };
    g.paires[f.seq] = { de: f.from, vers: f.to };
    groupes.set(f.id, g);
  }
  return [...groupes.values()].map((g) => {
    let cle = null;
    return { table: g.table, paires: g.paires.map((p, i) => ({ de: p.de, vers: p.vers ?? (cle ??= (tableExiste(db, g.table) ? structure(db, g.table).cle : []))[i] })) };
  });
}

/** Chaque ligne du lot par son nom lisible (la ligne actuelle, sinon ce que le lot en a écrit ou retiré). */
function etiquettesDesLignes(db, nets) {
  return new Map(nets.map((net) => {
    let libelle;
    try {
      // un mot-clé par son nom, lu sur son élément ; parti, par ce que le journal en note (une ligne d'avant la migration 0136 porte encore son libellé)
      const actuelle = lireLaLigne(db, net.table, net.cle);
      const notee = { ...(net.brut?.origine ?? net.origine), ...(net.brut?.fin ?? net.fin) };
      libelle = libelleDeLigne(net.table, ligneDuMotCle(net.table, actuelle ?? notee, motCleLu(db, net.table, net.cle)), net.cle, db);
    } catch {
      libelle = `${nomDeTable(net.table) ?? net.table}`;
    }
    return [net.rang, libelle];
  }));
}

/**
 * Ce qui empêche d'annuler seule une ligne : les AUTRES lignes du lot encore EN PLACE (qui ont encore quelque chose à remettre, d'après la base d'aujourd'hui) qui la tiennent.
 * Rend Map(rang → [{ rangs, raison }]), vide pour une ligne libre. Une ligne que le site a supprimée, changée ou déjà fait revenir ne tient plus rien : sinon deux
 * lignes se bloqueraient l'une l'autre.
 *   - une ligne insérée est citée par une clé étrangère (lue sur la ligne actuelle) d'une autre ligne du lot, insérée ou dont la colonne a été modifiée par le lot : la
 *     supprimer rompt ce lien, la citante d'abord ;
 *   - une ligne retirée dont le parent a été retiré par le même lot (et manque encore) : le parent d'abord, sinon la réinsertion rompt sa clé étrangère ;
 *   - le corps d'une page refaite par le site (colonnes dérivées seules) est tenu par les autres lignes du lot : elles le refont, ou le lot entier.
 * Ce qui n'est pas lié par une clé étrangère (un renvoi dans un texte, une règle de contenu) est laissé aux contrôles du contenu, qui refusent avec leur motif.
 * @param {Set<number>} annulees les lignes déjà annulées (elles ne tiennent plus rien)
 * @param {Map<number, string>} etiquettes
 */
export function dependancesDesLignes(db, nets, annulees = new Set(), etiquettes = new Map()) {
  const etrangeres = memoriser((table) => etrangeresDe(db, table));
  const actuelle = memoriser((rang) => {
    const net = nets.find((n) => n.rang === rang);
    try {
      return lireLigne(db, net.table, net.cle);
    } catch {
      return null;
    }
  });
  const juge = jugeDesLignes(db, nets);
  const enPlace = new Set(nets.filter((n) => !annulees.has(n.rang) && juge.juger(n, actuelle(n.rang)).remises.length > 0).map((n) => n.rang));
  const actives = nets.filter((n) => enPlace.has(n.rang));
  const dependances = new Map(nets.map((n) => [n.rang, []]));
  const nom = (n) => etiquettes.get(n.rang) ?? `${nomDeTable(n.table) ?? n.table}`;
  // les lignes insérées ou modifiées qui citent une ligne : (table citée, colonnes citées, valeurs) → les citantes ; la valeur est lue sur la ligne actuelle
  const citantes = new Map();
  const colonnesCitees = new Map(); // table citée → les listes de colonnes citées
  for (const b of actives) {
    if (b.genre === 'supprimer') continue;
    const ligne = actuelle(b.rang);
    for (const g of etrangeres(b.table)) {
      if (!g.paires.every((p) => p.de in b.fin) || !ligne) continue;
      const valeurs = g.paires.map((p) => ligne[p.de]);
      if (valeurs.some((v) => v === null || v === undefined)) continue;
      const vers = g.paires.map((p) => p.vers);
      const cle = JSON.stringify([g.table, vers, valeurs.map(String)]);
      citantes.set(cle, [...(citantes.get(cle) ?? []), b]);
      const listes = colonnesCitees.get(g.table) ?? new Map();
      listes.set(JSON.stringify(vers), vers);
      colonnesCitees.set(g.table, listes);
    }
  }
  for (const a of actives) {
    if (a.genre === 'inserer') {
      const mienne = { ...a.cle, ...a.fin };
      for (const vers of (colonnesCitees.get(a.table) ?? new Map()).values()) {
        const cle = JSON.stringify([a.table, vers, vers.map((c) => String(mienne[c]))]);
        for (const b of citantes.get(cle) ?? []) {
          if (b !== a) dependances.get(a.rang).push({ rangs: [b.rang], raison: `la ligne ${b.rang} du lot (${nom(b)}) la cite : annulez celle-là d’abord` });
        }
      }
    } else if (a.genre === 'supprimer') {
      for (const g of etrangeres(a.table)) {
        const attendu = g.paires.map((p) => a.origine[p.de]);
        if (attendu.some((v) => v === null || v === undefined)) continue;
        const parent = actives.find((c) => c !== a && c.genre === 'supprimer' && c.table === g.table && g.paires.every((p, i) => memeValeur(c.origine[p.vers], attendu[i])));
        if (!parent || !tableExiste(db, g.table)) continue;
        const present = db.prepare(`SELECT 1 FROM "${g.table}" WHERE ${g.paires.map((p) => `"${p.vers}" = ?`).join(' AND ')}`).get(...attendu);
        if (!present) dependances.get(a.rang).push({ rangs: [parent.rang], raison: `la ligne ${parent.rang} du lot (${nom(parent)}), qu’elle cite, a été retirée aussi : remettez celle-là d’abord` });
      }
    }
  }
  const derivee = (n) => n.genre === 'modifier' && Object.keys(n.fin).every((c) => { try { return colonneDerivee(n.table, n.cle, c); } catch { return false; } });
  const tenantes = actives.filter((n) => !derivee(n));
  for (const a of actives.filter(derivee)) {
    if (tenantes.length) {
      const rangs = tenantes.map((t) => t.rang);
      const liste = rangs.length > 8 ? `${rangs.slice(0, 8).join(', ')}…` : rangs.join(', ');
      dependances.get(a.rang).push({
        rangs,
        raison: rangs.length === 1 ? `cette page est refaite par le site d’après la ligne ${rangs[0]} du lot (${nom(tenantes[0])}) : annulez celle-là, la page suit`
          : `cette page est refaite par le site d’après les autres lignes du lot (${liste}) : annulez celles dont elle dépend, la page suit`,
      });
    }
  }
  return dependances;
}

/** Une fonction à un argument dont chaque résultat est gardé (un calcul par valeur). */
function memoriser(f) {
  const gardes = new Map();
  return (x) => {
    if (!gardes.has(x)) gardes.set(x, f(x));
    return gardes.get(x);
  };
}

/** Pourquoi une ligne qui n'a rien à remettre ne s'annule pas : déjà revenue à sa valeur d'avant, ou changée depuis par le site. */
const motifSansRemise = (etat) => (etat === 'comme_avant' ? 'Cette ligne a déjà sa valeur d’avant le lot : rien à remettre.' : 'Toutes ses valeurs ont changé depuis : le site prime, rien n’est remis.');
const MOTIF_DE_LA_CLE_SEULE = 'Seule la clé d’un mot-clé y a changé : ce texte revient avec lui.';

/** Les lignes déjà annulées d'un lot appliqué (`bilan.lignes_annulees`, clé = numéro de la ligne). */
const lignesDejaAnnulees = (ligne) => new Set(Object.keys(jsonOuNull(ligne.bilan)?.lignes_annulees ?? {}).map(Number));

/** Les dépendances des lignes du lot `depose` (R291), sur la base `db` (la copie de l'aperçu ou la base vivante). */
function dependancesDuLot(db, depose) {
  const nets = netsDuLot(db, depose.lot_id);
  return dependancesDesLignes(db, nets, lignesDejaAnnulees(ligneOuErreur(db, depose.id)), etiquettesDesLignes(db, nets));
}

/**
 * Cette ligne du lot diffère-t-elle de la production ? (demande du propriétaire du 2026-11-21 : « Je ne dois voir ici QUE la liste de ce qui change par rapport à la
 * prod, car sert pour le patch note. ») On compare la ligne d'ici à celle de la production, sur les colonnes que le lot a écrites : le journal ne suffit pas, un lot
 * livré, annulé puis redéposé à l'identique n'est pas dans l'historique et ne change pourtant rien. Une ligne ou une table absente d'un seul côté est un écart.
 */
function differeDeLaProduction(db, production, net) {
  const lue = (base) => {
    try {
      return ligneComparable(base, net.table, net.cle);
    } catch {
      return null;
    }
  };
  const ici = lue(db);
  const enProduction = lue(production);
  if (!ici || !enProduction) return Boolean(ici) !== Boolean(enProduction);
  // une ligne d'avant la migration 0136 : les colonnes logiques qu'elle a écrites comptent aussi
  return Object.keys({ ...(net.brut?.origine ?? net.origine), ...(net.brut?.fin ?? net.fin) }).some((c) => !isDeepStrictEqual(ici[c] ?? null, enProduction[c] ?? null));
}

/**
 * Une ligne telle que `differeDeLaProduction` la compare, sur une base de l'une ou l'autre structure (la production reste à celle d'avant la migration 0136
 * tant qu'elle n'est pas livrée) : une valeur seulement déplacée du mot-clé vers son élément n'est pas un écart (docs/chantier-retrait-des-colonnes.md, §4 :
 * l'objet de lib/mots-cles-db.mjs, des deux côtés).
 *   - `mot_cle` : l'objet du mot-clé (lireUnMotCle : ses colonnes logiques comprises, lues dans ses colonnes ou sur son élément) ;
 *   - `repere` : ses colonnes, lues dans l'objet du mot-clé (`nom` = libelle…) ; absent si le mot-clé n'a ni repère ni (avant la migration) de place pour
 *     ses champs : un mot-clé qui a une page ou un sort, ou qui n'existe pas ;
 *   - `page` : la ligne ; sur une base d'avant la migration, `definition`, `couleur` et `icone` sont ceux du mot-clé qu'elle désigne ;
 *   - toute autre table : la ligne.
 */
function ligneComparable(base, table, cle) {
  const ancienne = !colonnesRetirees(base).length;
  if (table === 'mot_cle') return lireLaLigne(base, table, cle);
  if (table === 'repere') {
    if (!ancienne) return lireLigne(base, table, cle);
    const m = Number.isInteger(cle?.mot_cle_id) ? lireUnMotCle(base, cle.mot_cle_id) : null;
    if (!m || (m.element && m.element.table !== 'repere')) return null;
    return { mot_cle_id: m.id, ...Object.fromEntries(Object.entries(COLONNES_DU_REPERE).map(([logique, colonne]) => [colonne, m[logique] ?? null])) };
  }
  const ligne = lireLigne(base, table, cle);
  if (table !== 'page' || !ligne || !ancienne) return ligne;
  const m = Number.isInteger(ligne.mot_cle_id) ? lireUnMotCle(base, ligne.mot_cle_id) : null;
  return { ...ligne, ...Object.fromEntries(Object.entries(COLONNES_DE_LA_PAGE).map(([logique, colonne]) => [colonne, m?.[logique] ?? null])) };
}

/** Le lot appliqué (ses lignes nettes `nets`) change-t-il encore quelque chose par rapport à la production ? */
const lotDiffereDeLaProduction = (db, production, nets) => nets.some((net) => differeDeLaProduction(db, production, net));

/** Les lignes nettes d'un lot appliqué, ou null quand son journal est illisible (`ErreurEdition` : on ne peut rien en dire). */
function netsOuNull(db, ligne) {
  try {
    return netsDuLot(db, ligne.lot_id);
  } catch (e) {
    if (e instanceof ErreurEdition) return null;
    throw e;
  }
}

/** `faire(base)` avec la base de la production ouverte en lecture seule ; `faire(null)` sans référence ou si elle ne s'ouvre pas (rien n'est alors retiré de la liste). */
function avecLaProduction(chemin, faire) {
  let base = null;
  try {
    if (chemin) base = new DatabaseSync(chemin, { readOnly: true });
  } catch {
    base = null;
  }
  try {
    return faire(base);
  } finally {
    base?.close();
  }
}

/**
 * Les lignes d'un lot appliqué ou annulé, pour la page (« comme les notes de version ») : chacune avec ses colonnes avant → après, son état et si elle s'annule seule.
 * `etat` : `en_place` (le lot l'a écrite et rien n'y a touché ; dans un lot appliqué, aussi un texte dont seule la clé d'une balise a changé : il revient avec son
 * mot-clé, sans s'annuler seul), `annulee` (par ce clic, ou par l'annulation du lot entier), `modifiee_depuis` (le site a changé une valeur
 * que le lot avait écrite : le site prime, `colonnes_modifiees`), `comme_avant` (la ligne a déjà sa valeur d'avant le lot). `annulable_seule` est faux avec un `motif` :
 * lot pas appliqué, ligne déjà annulée ou comme avant, tout modifié depuis, ou une autre ligne du lot la tient (`depend_de`). Avec `production` (la base ouverte),
 * chaque ligne dit aussi `ecart_production` : vrai si elle diffère de la production.
 * @returns {{ lignes: object[] } | { lignes: null, indisponible: string }}
 */
export function lignesDuLotApplique(db, ligne, { production = null } = {}) {
  let nets;
  try {
    nets = netsDuLot(db, ligne.lot_id);
  } catch (e) {
    if (e instanceof ErreurEdition) return { lignes: null, indisponible: e.message };
    throw e;
  }
  const bilan = jsonOuNull(ligne.bilan) ?? {};
  const annulees = bilan.lignes_annulees ?? {};
  const duLotEntier = new Map((bilan.annulation?.operations ?? []).map((o) => [o.rang_du_lot, o]));
  const etiquettes = etiquettesDesLignes(db, nets);
  const dependances = ligne.etat === 'applique' ? dependancesDesLignes(db, nets, new Set(Object.keys(annulees).map(Number)), etiquettes) : new Map();
  const juge = jugeDesLignes(db, nets);
  const groupes = lignesEmportees(nets, ligne, db);
  const gardes = ligne.etat === 'applique' ? groupesGardes(db, nets, ligne, new Set(Object.keys(annulees).map(Number))) : new Map();
  // ce qui tient une ligne : ce qui tient son groupe, hors du groupe lui-même (il s'annule d'un bloc)
  const tenueDe = (rang) => {
    const groupe = groupes.get(rang) ?? [rang];
    return groupe.flatMap((r) => dependances.get(r) ?? []).filter((d) => d.rangs.some((r) => !groupe.includes(r)));
  };
  return {
    lignes: nets.map((net) => {
      let actuelle = null;
      try {
        actuelle = lireLaLigne(db, net.table, net.cle);
      } catch {
        actuelle = null;
      }
      // une ligne d'avant la migration 0136 se montre telle que le journal la note (`brut`), colonnes retirées comprises ; elle se juge sans elles
      const [origine, fin] = [net.brut?.origine ?? net.origine, net.brut?.fin ?? net.fin];
      const retiree = neResteRienARemettre(net);
      const jugement = retiree ? jugerLAnnulation({ ...net, origine: sous(origine, net.retirees), fin: sous(fin, net.retirees) }, actuelle) : juge.juger(net, actuelle);
      const descr = apercuDe(db, { table: net.table, cle: net.cle, operation: net.genre, avant: origine, apres: fin }, net.genre === 'inserer' ? null : origine, actuelle ?? { ...origine, ...fin });
      const sortie = { n: net.rang, table: descr.table, ligne: descr.ligne, genre: net.genre, colonnes: descr.colonnes, ...(production ? { ecart_production: differeDeLaProduction(db, production, net) } : {}) };
      const finie = annulees[net.rang] ?? null;
      const duLot = duLotEntier.get(net.rang);
      if (finie) return { ...sortie, etat: 'annulee', annulee: { annule_le: finie.annule_le, lot_id: finie.lot_id }, annulable_seule: false, motif: 'Cette ligne est déjà annulée.', depend_de: [] };
      if (ligne.etat === 'annule' && duLot) {
        const etat = duLot.etat === 'remise' ? 'annulee' : duLot.etat === 'gardee' ? 'modifiee_depuis' : 'comme_avant';
        return { ...sortie, etat, ...(etat === 'annulee' ? { annulee: { annule_le: ligne.annule_le, lot_id: ligne.annulation_lot_id } } : {}), annulable_seule: false, motif: etat === 'annulee' ? 'Le lot entier est annulé.' : duLot.message ?? motifSansRemise(etat), depend_de: [] };
      }
      const colonnesModifiees = jugement.gardees.map((g) => ({ colonne: g.colonne, libelle: nomDeColonne(net.table, g.colonne) ?? g.colonne, ecrite: g.ecrite, trouvee: g.trouvee }));
      const motifDuGroupe = gardes.get(net.rang) ?? null;
      const cleSeule = ligne.etat === 'applique' && !motifDuGroupe && juge.seuleLaCle(net, actuelle);
      // emportée avec la ligne qui l'a causée (`lignesEmportees`), une clé recalculée s'annule avec son groupe
      const cleRecalculee = ligne.etat === 'applique' && !motifDuGroupe && !groupes.has(net.rang) && jugement.remises.length > 0 && estUneCleRecalculee(net);
      const etat = motifDuGroupe || jugement.gardees.length ? 'modifiee_depuis' : jugement.remises.length || cleSeule ? 'en_place' : 'comme_avant';
      const sansRemise = !jugement.remises.length || resteSeulementLaCle(net, jugement); // une clé ne se remet pas : il ne reste rien à remettre sur cette ligne
      const renvoiGarde = ligne.etat === 'applique' && !motifDuGroupe && Boolean(actuelle) && estUnRenvoiDeCle(nets, net);
      const tenue = motifDuGroupe || cleSeule || cleRecalculee || renvoiGarde ? [] : tenueDe(net.rang);
      let motif = null;
      if (retiree) motif = motifDesColonnesRetirees(db, net); // rien ne s'y remet : le champ se corrige sur l'élément
      else if (motifDuGroupe) motif = motifDuGroupe;
      else if (cleSeule) motif = MOTIF_DE_LA_CLE_SEULE;
      else if (cleRecalculee) motif = MOTIF_DE_LA_CLE_RECALCULEE;
      else if (renvoiGarde) motif = MOTIF_DU_RENVOI;
      else if (sansRemise) motif = motifSansRemise(etat);
      else if (ligne.etat !== 'applique') motif = ligne.etat === 'annule' ? 'Le lot est annulé.' : 'Ce lot n’est pas appliqué.';
      else if (tenue.length) motif = `Cette ligne ne s’annule pas seule : ${tenue.map((d) => d.raison).join(' ; ')}.`;
      return { ...sortie, etat, ...(colonnesModifiees.length ? { colonnes_modifiees: colonnesModifiees } : {}), annulable_seule: motif === null, motif, depend_de: [...new Set(tenue.flatMap((d) => d.rangs))] };
    }),
  };
}

/** Le verdict de l'aperçu d'une annulation : `refusee` (une ligne refusée, un problème né de l'annulation), `rien_a_remettre`, `verrous` (à ouvrir au clic), `applicable`. */
function verdictDeLAnnulation(comptes, verrous, nouveaux) {
  if (comptes.refusees || nouveaux.length) return 'refusee';
  if (!comptes.remises && !comptes.verrouillees) return 'rien_a_remettre';
  return verrous.length ? 'verrous' : 'applicable';
}

/** Le lot d'un lot de changements appliqué, tel que l'annulation le demande : le lot du journal, le titre de son annulation, sa nature et sa décision. */
const aAnnuler = (db, ligne, lignes = null) => ({
  id: ligne.id, lot_id: ligne.lot_id, titre: `Annulation de « ${ligne.titre} »`, nature: ligne.nature, decision: ligne.decision ?? null,
  problemes_toleres: problemesToleres(db, ligne, lignes),
});

/**
 * Les problèmes du contenu que cette annulation peut ramener : ceux d'avant le lot (son essai), seulement si elle remet un élément ancré qu'il a retiré, encore absent et
 * hors d'un groupe gardé (il revient avec ses anciens textes). Toute autre annulation que refusent les contrôles reste refusée : un lot
 * correctif ne ramène pas le défaut qu'il a corrigé. `lignes` : les lignes réellement annulées (groupe compris), sinon le lot entier.
 */
function problemesToleres(db, ligne, lignes = null) {
  const avant = jsonOuNull(ligne.essai)?.problemes_avant ?? [];
  if (!avant.length || !ligne.lot_id) return [];
  let nets;
  try {
    nets = netsDuLot(db, ligne.lot_id);
  } catch (e) {
    if (e instanceof ErreurEdition) return []; // un lot qui n'est plus au journal, ou en conflit : l'annulation le refuse avec son motif
    throw e;
  }
  const gardes = groupesGardes(db, nets, ligne, lignesDejaAnnulees(ligne));
  const remet = nets.some((n) => estUnElementAncreRetire(n) && (!lignes || lignes.includes(n.rang)) && !gardes.has(n.rang) && !lireLigne(db, n.table, n.cle));
  return remet ? avant : [];
}

/**
 * Comme `aAnnuler`, pour la seule ligne `numero` du lot (R291) : le titre du lot du journal d'annulation dit laquelle (le nom lisible de la ligne), la nature et la
 * décision sont celles du lot. `ligne` : la ligne demandée ; `lignes` : elle et celles qu'elle emporte (`lignesEmportees`). Une ligne qui n'existe pas : 404 ; un
 * numéro qui n'est pas un entier positif : 404.
 */
function aAnnulerUneLigne(db, ligne, numero) {
  if (!Number.isInteger(numero) || numero < 1) throw new ErreurEdition(404, `Ligne introuvable dans ce lot : ${numero}`);
  if (!ligne.lot_id) throw new ErreurEdition(409, 'Ce lot n’a pas de lot du journal : rien à remettre.');
  const nets = netsDuLot(db, ligne.lot_id);
  const net = nets.find((n) => n.rang === numero);
  if (!net) throw new ErreurEdition(404, `Ligne introuvable dans ce lot : ${numero}`);
  const libelle = etiquettesDesLignes(db, [net]).get(net.rang);
  const lignes = lignesEmportees(nets, ligne, db).get(numero) ?? [numero];
  return { ...aAnnuler(db, ligne, lignes), titre: `Annulation d’une ligne de « ${ligne.titre} » : ${libelle}`.slice(0, 300), ligne: numero, lignes };
}

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
    const connus = new Set([...avant, ...depose.problemes_toleres]);
    let sorties = { operations: [], verrous: [] };
    let refus = null;
    try {
      sorties = annulerLeLot(db, depose, { essai: true }).sorties;
    } catch (e) {
      if (!(e instanceof ErreurEdition)) throw e;
      refus = e.message; // un lot qui n'est plus au journal, en conflit, une clé étrangère refusée à la validation
    }
    const nouveaux = refus ? [] : problemesNes(db, connus);
    const comptes = { remises: 0, gardees: 0, deja: 0, verrouillees: 0, refusees: 0 };
    for (const o of sorties.operations) comptes[{ remise: 'remises', gardee: 'gardees', deja: 'deja', verrouillee: 'verrouillees', refusee: 'refusees' }[o.etat]] += 1;
    if (refus) comptes.refusees += 1;
    return {
      format: FORMAT_DE_L_ESSAI,
      lot: depose.id,
      ...(depose.lignes ? { ligne: depose.ligne } : {}),
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
 * Les tables dont chaque ligne a sa place dans le corps d'une page de magie, qui n'est refaite que morceau par morceau (le rendu remplace le morceau qu'une
 * modification touche, repéré par sa place : lib/corps-magies.mjs) : le recalcul rejoue chacune de leurs lignes telle quelle (avant = après), si bien que chaque
 * morceau est réécrit par le code d'aujourd'hui (rapport du lot 8 : « Tout recalculer » étendu après la bascule 1).
 */
export const TABLES_DES_PAGES_PAR_MORCEAUX = Object.freeze([...Object.keys(PAGE_DE_LA_LIGNE)]);
/**
 * Les lignes de composants qui restent rejouées telles quelles, comme avant le rendu entier : les matériaux, les gemmes et les bois, que le site crée sans que leur
 * ligne existe dans les pages de l'armurerie, des bâtons et des accessoires. Sans marqueur « créé par le site », un rendu entier par rang (ressource.ordre)
 * apparierait, après une suppression suivie d'une création (qui reprend le même rang), la dernière ligne du corps à un autre élément, sans erreur : ces tableaux
 * ne se refont donc pas en entier. Table → condition SQL sur ses lignes (null : toutes).
 */
export const TABLES_REJOUEES_DES_COMPOSANTS = Object.freeze({ materiau: null, gemme: null, ressource: "genre IN ('materiau', 'gemme', 'bois')" });
const COLONNES_RECALCULEES = Object.freeze(['corps_md', 'resume', 'donnees']);

/**
 * Refait le CORPS ENTIER des pages des armes, des armures et des boucliers, des composants et des potions depuis l'état des tables (lib/corps-armes.mjs,
 * corps-armures.mjs, corps-composants.mjs, corps-potions.mjs : `corpsDesArmesEntier`…) : un recalcul sert quand le code change, donc quand le corps n'écrit
 * plus une ligne comme le code d'aujourd'hui la rend, et une ligne retrouvée par son ancien texte ne se retrouve plus. Chaque tableau est repéré par sa
 * section et ses lignes de données sont remplacées en bloc par celles de la table (pages des composants : « Équipement inventaire » et « Liste
 * d'ingrédients » seulement ; matériaux, gemmes et bois restent rejoués ligne à ligne : TABLES_REJOUEES_DES_COMPOSANTS) ; la prose reste. Une page dont
 * le corps n'a plus la forme de l'importeur (section ou tableau introuvable, ou, pour les armures et boucliers, nombre de lignes qui n'est plus celui de
 * la base) reste telle quelle et est dite dans `illisibles`. Écrit dans `db` (une copie : le service n'y touche pas).
 * @returns {{ page: string, raison: string }[]} les pages illisibles
 */
export function refaireLesCorpsEntiers(db) {
  const illisibles = [];
  const ecrire = (id, rendus) => {
    const page = lireLigne(db, 'page', { id });
    if (!page) return;
    try {
      const corps = rendus.reduce((c, rendu) => rendu(c), page.corps_md);
      if (corps !== page.corps_md) db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(corps, id);
    } catch (e) {
      if (![ErreurCorpsArmes, ErreurCorpsArmures, ErreurCorpsComposants, ErreurCorpsPotions].some((E) => e instanceof E)) throw e;
      illisibles.push({ page: id, raison: e.message });
    }
  };
  const avec = (tables, travail) => {
    if (tables.every((t) => tableExiste(db, t))) travail();
  };
  avec(['arme', 'arme_famille', 'materiau_arme', 'amelioration_equipement', 'amelioration_total', 'ressource'], () => {
    ecrire(PAGE_DES_ARMES, [(c) => corpsEntierDesArmes(db, c)]);
  });
  avec(['armure', 'armure_emplacement', 'bouclier', 'bouclier_classe', 'bouclier_poids', 'amelioration_equipement', 'amelioration_total'], () => {
    for (const id of [PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS]) ecrire(id, [(c) => corpsEntierDesArmures(db, id, c)]);
  });
  // seules les pages des composants dont le site ne crée pas de ligne hors de leur tableau : « Équipement inventaire » et « Liste d'ingrédients » (le tableau des
  // matériaux, des gemmes et des bois reste suivi ligne à ligne : voir TABLES_REJOUEES_DES_COMPOSANTS)
  avec(['monnaie', 'ressource', 'ingredient_alchimie'], () => {
    for (const id of PAGES_DES_COMPOSANTS_AU_CORPS_ENTIER) ecrire(id, [(c) => corpsEntierDeLaPageDesComposants(db, id, c)]);
  });
  avec(['potion', 'ressource'], () => {
    const contexte = contexteDuCorpsDesPotions(db);
    for (const [id, potions] of potionsParPage(db)) ecrire(id, [(c) => corpsDesPotionsEntier(c, potions, contexte)]);
  });
  return illisibles;
}

/**
 * Les écarts entre ce que les pages portent et ce que le code d'aujourd'hui en dérive : sur la copie `db` (écrite : le service n'y touche pas), chaque page
 * des types ci-dessus est refaite par `recalculerLesPages`, chaque ligne des tables des pages de magie (et les matériaux, gemmes et bois : `TABLES_REJOUEES_DES_COMPOSANTS`)
 * y est rejouée telle quelle, et les pages des armes, des armures et des boucliers, de l'inventaire, des ingrédients et des potions sont refaites en entier
 * (`refaireLesCorpsEntiers`) ; puis toutes les pages sont comparées à ce
 * qu'elles portaient (`examinees` : les pages qui ont des colonnes dérivées).
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
  // chaque ligne des pages de magie (par morceaux), rejouée telle quelle (edition.mjs#lignesRejouees : avant = la ligne en place, après = la même)
  const rejouees = [...TABLES_DES_PAGES_PAR_MORCEAUX.map((t) => [t, null]), ...Object.entries(TABLES_REJOUEES_DES_COMPOSANTS)];
  for (const [table, ou] of rejouees) {
    let cle;
    try {
      ({ cle } = structure(db, table));
    } catch {
      continue; // une table absente de cette base
    }
    if (!cle.length) continue;
    for (const l of db.prepare(`SELECT ${cle.map((c) => `"${c}"`).join(', ')} FROM "${table}"${ou ? ` WHERE ${ou}` : ''}`).all()) {
      marques.push({ table, cle: Object.fromEntries(cle.map((c) => [c, l[c]])), operation: 'modifier', avant: {}, apres: {} });
    }
  }
  const { illisibles } = recalculerLesPages(db, marques);
  illisibles.push(...refaireLesCorpsEntiers(db));
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
 * @param {{ enArrierePlan?: boolean, dossier?: string, instant?: string, id?: string, par?: string }} [options] les options de `deposer` ; `par` : dépose et applique aussitôt
 */
export async function recalculerTout(base, { enArrierePlan: dansUnFil = true, dossier = null, par = null, ...options } = {}) {
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
  // `par` (R291) : la clé de dépôt ou une session Créateur, la clé de dépôt posée : le lot de nature « code » s'applique aussitôt, comme tout dépôt
  try {
    const lot = await (par ? deposerEtAppliquer(base, lotDuRecalcul(calcul), { par, enArrierePlan: dansUnFil, dossier: copie.dossier, ...options })
      : deposer(base, lotDuRecalcul(calcul), { enArrierePlan: dansUnFil, dossier: copie.dossier, ...options }));
    return { lot, recalcul };
  } catch (e) {
    if (e instanceof ErreurEdition && par) throw new ErreurEdition(e.statut, e.message, { ...e.details, recalcul });
    throw e;
  }
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

/** Les motifs d'un essai qui ne peut pas s'appliquer (opérations refusées, refus de l'application, problèmes du contenu nés du lot), pour la réponse d'un dépôt refusé. */
export function motifsDeLEssai(essai) {
  if (!essai || essai.verdict === 'en_echec') return [`l’essai à blanc a échoué : ${essai?.erreur ?? 'sans raison donnée'}`];
  const refusees = (essai.operations ?? []).filter((o) => o.etat === 'refusee').map((o) => `opération ${o.rang} : ${o.message}`);
  const changees = (essai.operations ?? []).filter((o) => o.etat === 'changee').map((o) => `opération ${o.rang} : la valeur a changé depuis le lot (le site prime)`);
  if (essai.verdict === 'rien_a_ecrire') return [`rien à écrire : chaque opération du lot a déjà été changée sur le site${changees.length ? ` (${changees.slice(0, 5).join(' ; ')})` : ''}`];
  return [...refusees, ...(essai.refus_de_l_application ? [essai.refus_de_l_application] : []), ...(essai.problemes_nouveaux ?? []).slice(0, 5).map((p) => `contrôle du contenu : ${p}`)];
}

/**
 * Dépose un lot et l'APPLIQUE aussitôt (R291, qui remplace R275 (4) : « Direct »). Réservé à la clé de dépôt et à une session Créateur, une fois la clé de dépôt posée
 * (serveur/acces.mjs#depot) ; c'est le même chemin qu'un clic : `deposer` (contrôle du format : 400 motivé, rien n'est enregistré), essai à blanc sur une copie, puis
 * `appliquer` dans une seule transaction, les contrôles du contenu rejoués. Si l'essai ou l'application refuse, RIEN n'entre : le lot est enregistré « refuse » avec ses
 * motifs (`essai.refus_du_depot`, lus dans `refus` : la base veut un bilan vide pour un lot refusé) et l'erreur 409 les dit, avec le lot. Limite : un arrêt du service ou une erreur inattendue entre le dépôt et la décision laisse le lot « propose » (le propriétaire le décide alors par le clic).
 * Verrous : réservés à une session Créateur. `corps.verrous_ouverts` (liste de « R… », la règle du clic : `verrousDuClic`) ouvre ce que le gel lève (R218, R219, R232 (2)),
 * enregistré dans le lot (`verrous_ouverts`) ; avec la clé de dépôt il est refusé (403, rien n'enregistré) et un lot que l'essai rend « verrous » est enregistré
 * « refuse » avec les R… à ouvrir ; un refus de règle (R105, R181…) reste refusé.
 * @param {() => import('node:sqlite').DatabaseSync | null} base
 * @param {unknown} corps le lot, avec en plus `verrous_ouverts` facultatif (retiré avant le contrôle du format : il n'est pas dans le lot déposé)
 * @param {{ par: 'cle_de_depot' | 'createur', instant?: string, id?: string, controle?: object, enArrierePlan?: boolean, dossier?: string }} options
 * @returns {Promise<object>} le lot appliqué (état « applique », `bilan.application`)
 */
export async function deposerEtAppliquer(base, corps, { par = 'cle_de_depot', ...options } = {}) {
  let lot = corps;
  let verrousDemandes = [];
  if (corps && typeof corps === 'object' && !Array.isArray(corps) && 'verrous_ouverts' in corps) {
    const { verrous_ouverts: demandes, ...reste } = corps;
    // ouvrir un verrou de décision est le geste du propriétaire : la clé de dépôt ne le fait pas (rien n'est enregistré)
    if (par === 'cle_de_depot') {
      throw new ErreurEdition(403, 'Dépôt refusé, rien n’est écrit : ouvrir un verrou de décision (R218, R219, R232 (2)) demande une session Créateur, pas la clé de dépôt (verrous_ouverts).', { acces: 'niveau' });
    }
    verrousDemandes = [...verrousDuClic(demandes)];
    lot = reste;
  }
  const proposition = await deposer(base, lot, options);
  const db = base();
  if (!db) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
  const id = proposition.id;
  const refuserLeDepot = (motifs, details = {}) => {
    // la base veut un bilan vide pour un lot refusé (CHECK) : les motifs se rangent avec l'essai, dans `essai.refus_du_depot`, sans migration
    const ligne = ligneOuErreur(db, id);
    const essaiDuLot = { ...jsonOuNull(ligne.essai), refus_du_depot: { motifs, par, ...details } };
    db.prepare("UPDATE lot_de_changements SET etat = 'refuse', decide_le = max(?, depose_le), essai = ? WHERE id = ? AND etat = 'propose'").run(instantMaintenant(), JSON.stringify(essaiDuLot), id);
    throw new ErreurEdition(409, `Le lot est refusé, rien n’est écrit : ${motifs.slice(0, 5).join(' ; ')}`, { lot: presenter(ligneOuErreur(db, id)), motifs });
  };
  const essai = proposition.essai;
  if (!essai || essai.verdict === 'en_echec' || essai.verdict === 'a_corriger' || essai.verdict === 'rien_a_ecrire') return refuserLeDepot(motifsDeLEssai(essai), { verdict: essai?.verdict ?? null });
  const manquants = (essai.verrous_a_ouvrir ?? []).filter((d) => !verrousDemandes.includes(d));
  if (manquants.length) {
    const qui = par === 'cle_de_depot' ? 'une session Créateur est nécessaire pour l’ouvrir (la clé de dépôt ne le fait pas)' : 'le dépôt doit l’ouvrir (verrous_ouverts)';
    return refuserLeDepot([`ce lot touche ce que ${manquants.join(', ')} verrouille${manquants.length > 1 ? 'nt' : ''} : ${qui} ; sans cela, rien n’est écrit`], { verdict: essai.verdict, verrous: manquants });
  }
  try {
    return appliquer(db, id, { verrous_ouverts: verrousDemandes }, { par, directe: true });
  } catch (e) {
    if (!(e instanceof ErreurEdition)) throw e;
    return refuserLeDepot([e.message], { statut: e.statut, ...(e.details?.operations ? { operations: e.details.operations } : {}) });
  }
}

/**
 * Les propositions, la plus récente d'abord (sans contenu ni aperçu : `lire` les rend). `production` : le chemin de la base de référence ; un lot appliqué dit alors
 * `ecart_production` (vrai s'il change encore quelque chose par rapport à elle, null si on ne peut pas le dire).
 */
export function lister(db, { production = null } = {}) {
  exigerLesTables(db);
  const lots = db.prepare('SELECT * FROM lot_de_changements ORDER BY depose_le DESC, id').all();
  return avecLaProduction(production, (base) => lots.map((l) => {
    const lot = presenter(l, { resume: true });
    if (l.etat !== 'applique') return lot;
    // les lignes nettes, calculées une fois : leur nombre (le titre d'un changement replié le dit sans lire son détail) et, avec la production, l'écart ;
    // `ecart_production` vaut null (on ne peut pas dire) et `lignes_nettes` est absent quand le journal est illisible
    const nets = netsOuNull(db, l);
    return {
      ...lot, ...(nets ? { lignes_nettes: nets.length } : {}),
      ...(base ? { ecart_production: nets ? lotDiffereDeLaProduction(db, base, nets) : null } : {}),
    };
  }));
}

/**
 * Une proposition en entier : le contenu déposé, l'essai (aperçu avant et après), le bilan de l'application et, pour un lot appliqué, ses lignes (R291).
 * `production` : le chemin de la base de référence ; chaque ligne dit alors `ecart_production`.
 */
export function lire(db, id, { production = null } = {}) {
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  const lot = presenter(ligne);
  // R291 : un lot appliqué (ou annulé) montre ses lignes, chacune avec son état et si elle s'annule seule
  if (ligne.etat === 'applique' || ligne.etat === 'annule') {
    const { lignes, indisponible } = avecLaProduction(production, (base) => lignesDuLotApplique(db, ligne, { production: base }));
    return { ...lot, lignes, ...(indisponible ? { lignes_indisponibles: indisponible } : {}) };
  }
  return lot;
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
 * Applique la proposition d'un clic du propriétaire (session Créateur) : d'un seul bloc, par le service d'édition. Refusée (409, rien n'est écrit) si l'essai
 * a des opérations refusées, si les contrôles du contenu échouent, si un verrou de décision n'est pas ouvert dans `corps.verrous_ouverts`, ou si rien ne
 * reste à écrire. Une valeur changée depuis l'essai n'est pas écrite : elle est listée dans le bilan avec la valeur trouvée (le site prime).
 * @param {import('node:sqlite').DatabaseSync} db la base vivante
 * @param {string} id
 * @param {{ verrous_ouverts?: string[] }} [corps]
 * @param {{ par?: string, directe?: boolean }} [origine] ce qui a ouvert le droit d'appliquer (`cle_de_depot`, `createur`) et si le lot s'applique à son dépôt (R291) :
 *   gardé dans `bilan.application`, pour savoir comment le lot est entré
 */
export function appliquer(db, id, corps = {}, origine = {}) {
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
      ...(origine.par ? { application: { directe: Boolean(origine.directe), par: origine.par } } : {}),
    };
    base.prepare("UPDATE lot_de_changements SET etat = 'applique', decide_le = max(?, depose_le), lot_id = ?, verrous_ouverts = ?, bilan = ? WHERE id = ? AND etat = 'propose'")
      .run(hote.instant, hote.id, sorties.verrous.length ? JSON.stringify(sorties.verrous) : null, JSON.stringify(bilan), id);
  };
  appliquerLeLot(db, depose, { essai: false, ouverts, baseline: new Set(essai.problemes_avant ?? []), enregistrer });
  return presenter(ligneOuErreur(db, id));
}

/** Refuse la proposition (session Créateur) : l'état « refuse », rien d'écrit dans le contenu. Elle reste lisible. */
export function refuser(db, id) {
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  if (ligne.etat !== 'propose') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot proposé se refuse.`);
  db.prepare("UPDATE lot_de_changements SET etat = 'refuse', decide_le = max(?, depose_le) WHERE id = ? AND etat = 'propose'").run(instantMaintenant(), id);
  return presenter(ligneOuErreur(db, id));
}

/**
 * L'aperçu de l'annulation du lot appliqué `id` (route de lecture : rien n'est écrit, ni dans le contenu ni dans `lot_de_changements`) : calculé sur une
 * copie de la base comme l'essai (un fil à part, un à la fois). Une promesse de l'aperçu (`essayerLAnnulation`). `ligne` (R291) : l'aperçu de cette seule ligne.
 * @param {() => import('node:sqlite').DatabaseSync | null} base la base vivante
 * @param {{ enArrierePlan?: boolean, dossier?: string, ligne?: number }} [o]
 */
export function previsualiserLAnnulation(base, id, { enArrierePlan: dansUnFil = true, dossier = null, ligne: numero = null } = {}) {
  const db = base();
  if (!db) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  if (ligne.etat !== 'applique') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot appliqué s’annule.`);
  const source = fichierDe(db);
  if (!source) throw new ErreurEdition(503, 'La base vivante n’est pas un fichier : l’aperçu a besoin d’une copie.');
  const options = { source, dossier: dossier ?? join(dirname(source), 'essais'), depose: numero === null ? aAnnuler(db, ligne) : aAnnulerUneLigne(db, ligne, numero) };
  return enFile(async () => (dansUnFil ? enArrierePlan('maverickApercuDeLAnnulation', options) : essayerLAnnulation(options)));
}

/**
 * Annule le lot appliqué `id` d'un clic du propriétaire (session Créateur) : refait la comparaison et, d'un seul bloc, sous le même verrou que l'édition, remet
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
  const depose = aAnnuler(db, ligne);
  // les problèmes du contenu d'avant : seuls ceux qui naissent de l'annulation la refusent (le service est un seul fil : rien ne change entre ce calcul et la transaction)
  const baseline = new Set([...controlerLeContenu(db).problemes, ...depose.problemes_toleres]);
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
  annulerLeLot(db, depose, { essai: false, ouverts, baseline, enregistrer });
  return presenter(ligneOuErreur(db, id));
}

/**
 * Annule UNE ligne du lot appliqué `id` (R291 : « annuler cette modification », session Créateur) : le même code que le lot entier (`annulerLeLot`, filtré sur cette
 * ligne), sous le même `BEGIN IMMEDIATE`, les contrôles du contenu rejoués. Une valeur n'est remise que si elle vaut encore ce que le lot a écrit ; une ligne insérée
 * n'est supprimée qu'intacte ; une ligne retirée n'est réinsérée que si elle est absente ; un numéro n'est jamais rendu. Une ligne que tient une autre ligne du lot
 * encore en place est refusée avec son motif. Un lot du journal « Annulation d’une ligne de … » de la même nature et du même numéro de décision ; l'état de la
 * ligne est gardé dans `bilan.lignes_annulees` (annule_le, lot du journal) ; quand plus aucune ligne n'est en place, le lot passe « annule ».
 * @param {import('node:sqlite').DatabaseSync} db la base vivante
 * @param {string} id
 * @param {number} numero le numéro de la ligne (`lignesDuLotApplique`)
 * @param {{ verrous_ouverts?: string[] }} [corps]
 */
export function annulerUneLigne(db, id, numero, corps = {}) {
  exigerLesTables(db);
  const ligne = ligneOuErreur(db, id);
  if (ligne.etat !== 'applique') throw new ErreurEdition(409, `Ce lot est « ${ligne.etat} » : seul un lot appliqué s’annule.`);
  const depose = aAnnulerUneLigne(db, ligne, numero);
  const ouverts = verrousDuClic(corps?.verrous_ouverts);
  const baseline = new Set([...controlerLeContenu(db).problemes, ...depose.problemes_toleres]);
  const enregistrer = (base, sorties, hote) => {
    const bilan = jsonOuNull(ligne.bilan) ?? {};
    // la ligne demandée et celles qu'elle emporte, chacune notée (une ligne déjà annulée garde sa note)
    const notes = depose.lignes.filter((n) => !bilan.lignes_annulees?.[n]).map((n) => {
      const operation = sorties.operations.find((o) => o.rang_du_lot === n);
      return [n, { annule_le: hote.instant, lot_id: hote.id, colonnes: (operation?.apercu?.colonnes ?? []).map((c) => c.colonne), gardees: operation?.ecarts?.length ?? 0 }];
    });
    bilan.lignes_annulees = { ...bilan.lignes_annulees, ...Object.fromEntries(notes) };
    // plus rien à remettre dans le lot : il passe « annulé » (comme l'annulation du lot entier)
    const annulees = new Set(Object.keys(bilan.lignes_annulees).map(Number));
    const nets = netsDuLot(base, ligne.lot_id);
    const juge = jugeDesLignes(base, nets);
    const gardes = groupesGardes(base, nets, ligne, annulees); // un groupe gardé n'a plus rien à remettre
    const reste = nets.some((net) => {
      if (annulees.has(net.rang) || gardes.has(net.rang)) return false;
      let actuelle = null;
      try {
        actuelle = lireLigne(base, net.table, net.cle);
      } catch {
        actuelle = null;
      }
      return juge.juger(net, actuelle).remises.length > 0;
    });
    if (reste) base.prepare("UPDATE lot_de_changements SET bilan = ? WHERE id = ? AND etat = 'applique'").run(JSON.stringify(bilan), id);
    else {
      base.prepare("UPDATE lot_de_changements SET etat = 'annule', annule_le = max(?, decide_le), annulation_lot_id = ?, bilan = ? WHERE id = ? AND etat = 'applique'")
        .run(hote.instant, hote.id, JSON.stringify(bilan), id);
    }
  };
  annulerLeLot(db, depose, { essai: false, ouverts, baseline, enregistrer });
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
