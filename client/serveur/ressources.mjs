// API REST /api/v1/ (demande du propriétaire : « une entrée pour TOUS les éléments possibles, avec une API REST et un CRUD » ; docs/serveur.md, « API
// REST ») : chaque élément du jeu que décrit le registre lib/ressources.mjs, lu dans la base vivante, écrit par le service d'édition — un lot du journal
// (serveur/edition.mjs#enregistrer), rejoué à chaque reconstruction et livré dans data/rows par la mise à jour —, jamais en SQL direct.
//
// Décision du propriétaire (2026-10-15) : « En prod la db doit rester fermée et ouverte par le front exclusivement pour le moment. Laisse le ouverte sur
// la dev pour qu'on puisse tester des trucs. » → TOUT /api/v1/ (catalogue, description OpenAPI, lectures et écritures) répond 403 quand le service n'est
// pas celui du site de dev (service.edition faux, MAVERICK_EDITION=1 absent), avant tout 404 ou 405, comme /api/edition/. Le téléchargement de la base
// par le site (/donnees/maverick.db) n'est pas concerné.
//
//   GET    /api/v1/                                       le catalogue : modules, ressources (capacités, colonnes et celles qui se modifient, champs de
//                                                         création, enfants, dérivées, nombre de lignes)
//   GET    /api/v1/openapi.json                           la description OpenAPI 3.1 de tout le service (serveur/openapi.mjs)
//   GET    /api/v1/<res>/                                 liste paginée { ressource, total, limite, decalage, elements: [{ cle, adresse, …colonnes }] } :
//                                                         ?q= (recherche sans accents ni majuscules, lib/text.mjs#normalize), ?tri=col,-col (« - » :
//                                                         décroissant ; la clé départage toujours), ?limite= (50 ; 500 au plus), ?decalage=, et
//                                                         ?<colonne>=<valeur> (égalité ; répété : l'une OU l'autre ; vide : colonne vide) — colonne
//                                                         inconnue : 400 ; la condition de la ressource s'applique toujours
//   POST   /api/v1/<res>/                                 crée (l'entité ENTITES de la ressource, ses champs) → 201, Location, ETag, le détail créé
//   GET    /api/v1/<res>/<cle>/                           { ressource, cle, adresse, element, extensions, enfants, derivees, version } + ETag ; 304 sur
//                                                         If-None-Match ; 404 si la ligne n'existe pas ou sort de la condition de la ressource ; la
//                                                         version (l'ETag) est l'empreinte de TOUTE la représentation : élément, extensions, enfants
//                                                         et dérivées (un enfant modifié change la version de son parent)
//   PATCH  /api/v1/<res>/<cle>/                           { <colonne>: valeur, <table d'extension>: { <colonne>: valeur } } : une opération `modifier`
//                                                         par table touchée (colonnes de TABLES seulement) ; If-Match facultatif : égal à la version,
//                                                         les valeurs lues partent en `avant` ; périmé : 409 { erreur, element, extensions, version }
//   DELETE /api/v1/<res>/<cle>/                           supprime (ENTITES, avec les retraits des fiches : R42) → { supprime, adresse, lot, fiches } ;
//                                                         If-Match facultatif (409 si périmé : la suppression emporte les enfants, leur version compte)
//   GET|POST /api/v1/<res>/<cle>/<enfant>/               sous-ressource : la liste (mêmes paramètres), la création (le parent vient de l'adresse)
//   GET|PATCH|DELETE /api/v1/<res>/<cle>/<enfant>/<c>/   une ligne de la sous-ressource
//   POST   /api/v1/<res>/<cle>/<action>/                  une action du registre sur l'élément (fusionner un mot-clé dans un autre…)
// Une méthode qu'une ressource ou un enfant déclare dans `operations` (relations entre peuples, magies innées d'une race, catégories d'un événement,
// valeurs propres d'une capacité de monstre) passe par l'opération du lot nommée, que TRADUCTIONS construit d'après l'adresse et le corps (ses champs
// sont au catalogue) : POST → 201 + Location (ou 200 sans élément si l'opération n'a rien créé : une valeur égale à la valeur commune), PATCH → le
// détail (ou `element: null` si l'opération a retiré la ligne), DELETE → { supprime, adresse, lot }.
// La clé d'une ligne dans l'adresse est le segment de lib/ressources.mjs#segmentDeCle : les colonnes de la clé primaire (pour un enfant, sans celles
// que le parent donne), chaque valeur encodée (« / » → %2F, « # » → %23), jointes par « , ». Une méthode qu'une ressource n'a pas : 405 avec Allow
// (la liste exacte) et la raison (lecture seule, ou pas encore d'entité de création / de suppression dans le service). PUT n'existe pas.
// Les gardes des écritures sont celles d'api.mjs (Content-Type: application/json, Sec-Fetch-Site) ; un DELETE peut venir sans corps.
//
// Jamais : une table des fiches (section 13) ni du journal (section 14), ni en lecture ni en écriture (les notes de version et l'historique, section
// 15, en lecture seulement) ; une image entière (portrait : son résumé, edition-modele.mjs#ligneSansImage ; l'image passe par
// POST /api/edition/portrait/). Une colonne de la table qui s'appelle `cle` ou `adresse` (alias, historique…) se lit `colonne_cle` / `colonne_adresse`
// dans une liste ou une ligne d'enfant (le détail, `element`, la garde sous son nom).
// Chaque écriture réussie est notée au journal du service : « api v1 : <MÉTHODE> <adresse> → lot <id> » (catégorie edition), avec le nombre de fiches
// adaptées, jamais leurs noms.
// N'importe que node: et des modules de client/ (serveur/livraison.mjs#modulesDuServeur).
import { ENTITES, ErreurValeur, TABLES, ligneSansImage, valeurDuChamp } from '../src/lib/edition-modele.mjs';
import {
  actionDe, capacitesDe, champFige, cleDuSegment, colonneFigee, enfantDe, MODULES, operationDe, RESSOURCES, ressourceDe, segmentDeCle, tablesDe,
  tablesModifiables,
} from '../src/lib/ressources.mjs';
import { normalize } from '../src/lib/text.mjs';
import { ErreurEdition, enregistrer, listes } from './edition.mjs';
import { ErreurHttp, empreinteCourte, entierDeLAdresse, segmentDecode } from './partage.mjs';
import { cleDe, lireLigne, structure, TABLES_INTERDITES } from './edition-journal.mjs';
import { descriptionOpenApi } from './openapi.mjs';

export const PREFIXE_V1 = '/api/v1/';
export const LIMITE_PAR_DEFAUT = 50;
export const LIMITE_MAX = 500;
/** Les paramètres d'une liste qui ne sont pas des filtres de colonne. */
export const PARAMETRES_DE_LISTE = ['q', 'tri', 'limite', 'decalage'];

/** Message du 403 hors du site de dev (décision du propriétaire du 2026-10-15). */
export const FERMEE_EN_PRODUCTION =
  'L’API REST /api/v1/ n’est ouverte que sur le site de dev : en production, la base ne se lit que par les pages du site (décision du propriétaire, 2026-10-15).';

/** Tables des sections 13 et 14 (fiches, comptes, groupes, journal de l'édition) : jamais servies ici. La section 15 se lit (notes de version, historique). */
export const TABLES_JAMAIS_SERVIES = new Set([...TABLES_INTERDITES].filter((t) => !['note_version', 'note_version_ligne', 'historique_modification'].includes(t)));

/** Les ressources servies : celles du registre qui ne touchent aucune table de TABLES_JAMAIS_SERVIES (le test du registre l'assure déjà). */
export const RESSOURCES_SERVIES = RESSOURCES.filter((r) => !tablesDe(r).some((t) => TABLES_JAMAIS_SERVIES.has(t)));
const SERVIE = new Set(RESSOURCES_SERVIES.map((r) => r.cle));

/** Erreur d'une requête de l'API : statut HTTP, message en français, détails ajoutés au corps. */
export class ErreurApi extends ErreurHttp {}

const json = (statut, corps, entetes = {}) => ({ statut, corps, entetes });
const erreur = (statut, message, details = {}) => json(statut, { erreur: message, ...details });

/**
 * Ce qu'une ressource (ou un enfant) sait faire ici : capacitesDe du registre, sans aucune écriture si l'une de ses tables écrites est interdite au
 * journal (TABLES_INTERDITES : le service d'édition la refuserait de toute façon).
 */
export function capacitesServies(o) {
  const c = capacitesDe(o);
  const ecrites = [o.table, ...(o.extensions ?? []).map((e) => e.table), ENTITES[o.ecriture?.creer]?.table, ENTITES[o.ecriture?.supprimer]?.table];
  if (ecrites.some((t) => t && TABLES_INTERDITES.has(t))) return { lire: true, creer: false, modifier: false, supprimer: false };
  return c;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Opérations du lot (lib/ressources.mjs#OPERATIONS_DU_LOT) : une requête REST traduite en l'opération que le site de dev emploie déjà
// ---------------------------------------------------------------------------------------------------------------------------------------------

const selectionner = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
/** Les magies que l'onglet d'une race limite (race_magie_onglet, dans son ordre), vide s'il ne limite pas (la matrice de la fiche fait foi : R8). */
const magiesDeLOnglet = (db, raceId) => selectionner(db, 'SELECT magie_id FROM race_magie_onglet WHERE race_id = ? ORDER BY rang', raceId).map((l) => l.magie_id);
const nomDeRace = (db, raceId) => lireLigne(db, 'race', { id: raceId })?.nom ?? raceId;

/**
 * Pour chaque opération du lot et chaque méthode (ACTION : une action du registre) : la table qu'elle sert (le registre doit la poser sur cette table :
 * test/serveur-api-v1.test.mjs), ses champs (format de TABLES : décrits au catalogue, contrôlés par valeurDuChamp ; DELETE : aucun),
 * traduire({ db, ligne, parent, valeurs }) → { operations, cle? } (POST : la clé de la ligne que l'opération crée) et, pour un POST, exemple({ db })
 * → un corps qui passerait, ou null (sans elle : pas de corps d'exemple, les valeurs dépendent de l'élément). Rien n'est déduit : chaque traduction
 * écrit ce que la page du site de dev écrirait (mêmes opérations, mêmes refus du service).
 */
export const TRADUCTIONS = {
  relations: {
    POST: {
      table: 'relation_peuple',
      champs: {
        ligne_peuple_id: { type: 'choix', libelle: 'Le peuple qui voit (ligne de la matrice, décision R12)', requis: true, liste: 'peuples' },
        colonne_peuple_id: { type: 'choix', libelle: 'Le peuple vu (colonne de la matrice)', requis: true, liste: 'peuples' },
        echelle_id: { type: 'choix', libelle: 'Niveau de relation', requis: true, liste: 'echelle' },
      },
      // l'exemple de la documentation : la première case vide de la matrice hors diagonale (aucune : la matrice est complète, pas d'exemple)
      exemple({ db }) {
        const libre = db.prepare(`SELECT a.id AS voit, b.id AS vu FROM peuple a JOIN peuple b ON a.id <> b.id
          WHERE NOT EXISTS (SELECT 1 FROM relation_peuple r WHERE r.ligne_peuple_id = a.id AND r.colonne_peuple_id = b.id) ORDER BY a.ordre, b.ordre LIMIT 1`).get();
        const echelle = db.prepare('SELECT id FROM echelle_relation ORDER BY ordre DESC LIMIT 1').get();
        return libre && echelle ? { ligne_peuple_id: libre.voit, colonne_peuple_id: libre.vu, echelle_id: echelle.id } : null;
      },
      traduire({ db, valeurs }) {
        const cle = { ligne_peuple_id: valeurs.ligne_peuple_id, colonne_peuple_id: valeurs.colonne_peuple_id };
        if (cle.ligne_peuple_id === cle.colonne_peuple_id) throw new ErreurApi(400, 'La case d’un peuple face à lui-même (« Même peuple ») ne se pose pas : elle vient avec le peuple.');
        if (lireLigne(db, 'relation_peuple', cle)) throw new ErreurApi(409, 'Cette case de la matrice existe déjà : modifiez-la (PATCH) ou retirez-la (DELETE).');
        return { operations: [{ op: 'relations', cases: [{ voit: cle.ligne_peuple_id, vu: cle.colonne_peuple_id, echelle: valeurs.echelle_id }] }], cle };
      },
    },
    PATCH: {
      table: 'relation_peuple',
      champs: { echelle_id: { type: 'choix', libelle: 'Niveau de relation', requis: true, liste: 'echelle' } },
      traduire({ ligne, valeurs }) {
        if (ligne.ligne_peuple_id === ligne.colonne_peuple_id) throw new ErreurApi(400, 'La case d’un peuple face à lui-même (« Même peuple ») ne se change pas.');
        return { operations: [{ op: 'relations', cases: [{ voit: ligne.ligne_peuple_id, vu: ligne.colonne_peuple_id, echelle: valeurs.echelle_id }] }] };
      },
    },
    DELETE: {
      table: 'relation_peuple',
      traduire({ ligne }) {
        if (ligne.ligne_peuple_id === ligne.colonne_peuple_id) throw new ErreurApi(400, 'La case d’un peuple face à lui-même (« Même peuple ») ne se retire pas.');
        return { operations: [{ op: 'relations', cases: [{ voit: ligne.ligne_peuple_id, vu: ligne.colonne_peuple_id, echelle: null }] }] };
      },
    },
  },
  magies_innees: {
    // la liste de l'onglet (décisions R11, R31) : une magie s'y ajoute (à la fin) ou s'en retire ; vide, la matrice de la fiche fait foi (R8)
    POST: {
      table: 'race_magie_onglet',
      champs: { magie_id: { type: 'choix', libelle: 'Magie innée ajoutée à la liste de l’onglet', requis: true, liste: 'magies' } },
      traduire({ db, parent, valeurs }) {
        const race = parent.ligne.id;
        const onglet = magiesDeLOnglet(db, race);
        if (!onglet.length) {
          throw new ErreurApi(409, `L’onglet de ${nomDeRace(db, race)} ne limite pas ses magies innées : la matrice de la fiche fait foi (décision R8) — modifiez-la par PATCH ${PREFIXE_V1}races/${parent.segment}/acces-aux-magies/<magie>/ { "accessible": 1 }.`);
        }
        if (onglet.includes(valeurs.magie_id)) throw new ErreurApi(409, `${nomDeRace(db, race)} : cette magie est déjà dans la liste de l’onglet.`);
        return { operations: [{ op: 'magies_innees', race, magies: [...onglet, valeurs.magie_id] }], cle: { magie_id: valeurs.magie_id } };
      },
    },
    DELETE: {
      table: 'race_magie_onglet',
      traduire({ db, parent, ligne }) {
        return { operations: [{ op: 'magies_innees', race: parent.ligne.id, magies: magiesDeLOnglet(db, parent.ligne.id).filter((m) => m !== ligne.magie_id) }] };
      },
    },
    // la matrice de la fiche (R8), quand l'onglet ne limite pas : une case accessible ou non
    PATCH: {
      table: 'race_magie',
      champs: { accessible: { type: 'entier', libelle: 'Accessible en magie innée (1 : oui, 0 : non)', requis: true, min: 0, max: 1 } },
      traduire({ db, parent, ligne, valeurs }) {
        const race = parent.ligne.id;
        if (magiesDeLOnglet(db, race).length) {
          throw new ErreurApi(409, `L’onglet de ${nomDeRace(db, race)} limite ses magies innées (décision R11) : la liste se change par ${PREFIXE_V1}races/${parent.segment}/magies-innees-de-l-onglet/ (POST, DELETE).`);
        }
        const accessibles = selectionner(db, 'SELECT magie_id FROM race_magie WHERE race_id = ? AND accessible = 1', race).map((l) => l.magie_id);
        const magies = valeurs.accessible ? [...new Set([...accessibles, ligne.magie_id])] : accessibles.filter((m) => m !== ligne.magie_id);
        return { operations: [{ op: 'magies_innees', race, magies }] };
      },
    },
  },
  categories: {
    POST: {
      table: 'evenement_categorie',
      champs: { categorie_id: { type: 'choix', libelle: 'Catégorie posée sur l’événement', requis: true, liste: 'categoriesChronologie' } },
      traduire({ db, parent, valeurs }) {
        const evenement = parent.ligne.id;
        const avant = selectionner(db, 'SELECT categorie_id FROM evenement_categorie WHERE evenement_id = ?', evenement).map((l) => l.categorie_id);
        if (avant.includes(valeurs.categorie_id)) throw new ErreurApi(409, 'L’événement porte déjà cette catégorie.');
        return { operations: [{ op: 'categories', evenement, categories: [...avant, valeurs.categorie_id], avant }], cle: { categorie_id: valeurs.categorie_id } };
      },
    },
    DELETE: {
      table: 'evenement_categorie',
      traduire({ db, parent, ligne }) {
        const evenement = parent.ligne.id;
        const avant = selectionner(db, 'SELECT categorie_id FROM evenement_categorie WHERE evenement_id = ?', evenement).map((l) => l.categorie_id);
        return { operations: [{ op: 'categories', evenement, categories: avant.filter((c) => c !== ligne.categorie_id), avant }] };
      },
    },
  },
  valeurs_de_capacite: {
    // décision R69 : seule une valeur qui n'est pas la valeur commune de l'emplacement s'écrit ; la valeur commune (ou rien) retire la ligne
    POST: {
      table: 'monstre_capacite_valeur',
      champs: {
        rang: { type: 'entier', libelle: 'Rang de la capacité sur la carte', requis: true, min: 1 },
        numero: { type: 'entier', libelle: 'Emplacement « {N} » de la description (1 = le premier)', requis: true, min: 1 },
        valeur: { type: 'entier', libelle: 'Valeur propre de la carte (la valeur commune : rien ne s’écrit)', requis: true, min: 0 },
      },
      traduire({ db, parent, valeurs }) {
        const cle = { rang: valeurs.rang, numero: valeurs.numero };
        if (lireLigne(db, 'monstre_capacite_valeur', { monstre_id: parent.ligne.id, ...cle })) throw new ErreurApi(409, 'Cette valeur existe déjà : modifiez-la (PATCH).');
        return { operations: [{ op: 'valeurs_de_capacite', monstre_id: parent.ligne.id, rang: valeurs.rang, valeurs: { [valeurs.numero]: valeurs.valeur } }], cle };
      },
    },
    PATCH: {
      table: 'monstre_capacite_valeur',
      champs: { valeur: { type: 'entier', libelle: 'Valeur propre de la carte (la valeur commune, ou null : la carte suit de nouveau la valeur commune)', min: 0 } },
      traduire({ parent, ligne, valeurs }) {
        return { operations: [{ op: 'valeurs_de_capacite', monstre_id: parent.ligne.id, rang: ligne.rang, valeurs: { [ligne.numero]: valeurs.valeur ?? null } }] };
      },
    },
    DELETE: {
      table: 'monstre_capacite_valeur',
      traduire({ parent, ligne }) {
        return { operations: [{ op: 'valeurs_de_capacite', monstre_id: parent.ligne.id, rang: ligne.rang, valeurs: { [ligne.numero]: null } }] };
      },
    },
  },
  fusionner_mots_cles: {
    ACTION: {
      table: 'mot_cle',
      champs: { dans: { type: 'ligne', libelle: 'Le mot-clé qui reçoit les pages (son identifiant)', requis: true } },
      traduire({ ligne, valeurs }) {
        return { operations: [{ op: 'fusionner_mots_cles', mot_cle: ligne.id, dans: valeurs.dans }] };
      },
    },
  },
};

/** La traduction d'une méthode (ou d'une action : 'ACTION') d'un objet du registre, ou null. */
function traductionDe(o, methode) {
  const op = methode === 'ACTION' ? o.op : operationDe(o, methode);
  return op ? { op, ...TRADUCTIONS[op]?.[methode] } : null;
}

/** Les valeurs du corps d'une opération d'après ses champs : chacun contrôlé (valeurDuChamp) ; un champ inconnu ou manquant : 400. */
function valeursDuCorps(champs, corps, quoi, { tous = true } = {}) {
  const valeurs = {};
  for (const k of Object.keys(corps)) {
    if (!champs[k]) throw new ErreurApi(400, `${quoi} : « ${k} » n’est pas un champ (${Object.keys(champs).join(', ')}).`);
  }
  for (const [nom, champ] of Object.entries(champs)) {
    if (!(nom in corps)) {
      if (champ.requis || tous) throw new ErreurApi(400, `${quoi} : « ${nom} » manquant.`);
      continue;
    }
    try {
      valeurs[nom] = valeurDuChamp(champ, corps[nom], nom);
    } catch (e) {
      if (e instanceof ErreurValeur) throw new ErreurApi(400, `${quoi} : ${e.message}`);
      throw e;
    }
  }
  return valeurs;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Vues : une ressource ou un enfant, avec la structure de sa table dans la base vivante
// ---------------------------------------------------------------------------------------------------------------------------------------------

const unique = (liste) => [...new Set(liste.filter((x) => x !== null && x !== undefined))];
const COLONNES_D_IMAGE = /^portrait(_|$)/;

/**
 * La vue d'une ressource (enfant = null) ou de l'un de ses enfants : table, colonnes et types (PRAGMA table_info : la seule liste blanche des noms de
 * colonnes qui entrent dans une requête), clé primaire, colonnes de la clé d'adresse, libellé, colonnes de liste, de recherche et tri par défaut.
 */
export function vueDe(db, ressource, enfant = null) {
  const o = enfant ?? ressource;
  const { colonnes, types, cle } = structure(db, o.table);
  const parent = enfant?.parent ?? {};
  const cleAdresse = cle.filter((c) => !(c in parent));
  const libelle = o.libelle ?? ['nom', 'titre', 'libelle'].find((c) => colonnes.includes(c)) ?? null;
  const courtes = colonnes.filter((c) => ['INTEGER', 'REAL'].includes(types[c]) && !COLONNES_D_IMAGE.test(c));
  const liste = enfant ? colonnes : o.liste ?? unique([...cleAdresse, libelle, ...courtes]).slice(0, 10);
  const textes = colonnes.filter((c) => types[c] === 'TEXT' && !COLONNES_D_IMAGE.test(c));
  const recherche = o.recherche ?? (libelle ? [libelle] : enfant ? textes : cleAdresse);
  const tri = o.tri ?? libelle ?? null;
  return { ressource, enfant, objet: o, table: o.table, colonnes, types, clePrimaire: cle, cle: cleAdresse, parent, libelle, liste, recherche, tri };
}

/** La valeur d'une colonne lue dans l'adresse : nombre pour une colonne INTEGER ou REAL (sinon 400), texte sinon. */
function valeurDeColonne(vue, colonne, texte, quoi) {
  const type = vue.types[colonne];
  if (type === 'INTEGER') {
    if (!/^-?\d+$/.test(texte)) throw new ErreurApi(400, `${quoi} : « ${colonne} » attend un nombre entier (reçu « ${texte} »).`);
    return Number(texte);
  }
  if (type === 'REAL') {
    const n = Number(texte);
    if (texte.trim() === '' || !Number.isFinite(n)) throw new ErreurApi(400, `${quoi} : « ${colonne} » attend un nombre (reçu « ${texte} »).`);
    return n;
  }
  return texte;
}

/** Les morceaux SQL d'une condition de ressource ({ col: [valeurs] } ou { col: { sauf: [valeurs] } }), avec la même lecture de NULL que le test du registre. */
function conditionSql(vue, condition) {
  const morceaux = [];
  const valeurs = [];
  for (const [c, v] of Object.entries(condition ?? {})) {
    if (!vue.colonnes.includes(c)) throw new Error(`condition de ${vue.ressource.cle} : colonne inconnue ${c}`);
    const citees = Array.isArray(v) ? v : v.sauf;
    const nonNulles = citees.filter((x) => x !== null && x !== undefined);
    const nulle = nonNulles.length !== citees.length;
    const dans = nonNulles.length ? `"${c}" IN (${nonNulles.map(() => '?').join(', ')})` : null;
    if (Array.isArray(v)) morceaux.push(`(${[dans ?? '0', nulle ? `"${c}" IS NULL` : null].filter(Boolean).join(' OR ')})`);
    else morceaux.push(nulle ? `("${c}" IS NOT NULL${dans ? ` AND NOT ${dans}` : ''})` : `("${c}" IS NULL${dans ? ` OR NOT ${dans}` : ' OR 1'})`);
    valeurs.push(...nonNulles);
  }
  return { morceaux, valeurs };
}

/** Le filtre du parent sur les lignes d'un enfant : { <colonne de l'enfant>: valeur lue dans la ligne du parent }. */
const filtreDuParent = (vue, parentLigne) => Object.fromEntries(Object.entries(vue.parent).map(([ce, cp]) => [ce, parentLigne[cp] ?? null]));

const COLLATION = new Intl.Collator('fr', { numeric: true, sensitivity: 'variant' });

/** Ordre de deux valeurs : NULL d'abord, puis les nombres, puis les textes (ordre français, nombres dans le texte compris). */
function comparerValeurs(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  const x = String(a);
  const y = String(b);
  return COLLATION.compare(x, y) || (x < y ? -1 : x > y ? 1 : 0);
}

/** Le tri d'une liste : [{ colonne, decroissant }] d'après « col,-col » (ou le tri par défaut de la vue), puis la clé primaire. */
function triDe(vue, texte) {
  const demande = texte === null || texte === undefined || String(texte).trim() === '' ? (vue.tri ? [vue.tri] : []) : String(texte).split(',');
  const tri = [];
  for (const brut of demande) {
    const m = String(brut).trim();
    const decroissant = m.startsWith('-');
    const colonne = decroissant ? m.slice(1) : m;
    if (!vue.colonnes.includes(colonne)) {
      throw new ErreurApi(400, `tri : colonne inconnue « ${colonne} » (colonnes de ${vue.table} : ${vue.colonnes.join(', ')}).`);
    }
    tri.push({ colonne, decroissant });
  }
  for (const c of vue.clePrimaire) if (!tri.some((t) => t.colonne === c)) tri.push({ colonne: c, decroissant: false });
  return tri;
}

const comparateur = (tri) => (a, b) => {
  for (const { colonne, decroissant } of tri) {
    const r = comparerValeurs(a[colonne], b[colonne]);
    if (r) return decroissant ? -r : r;
  }
  return 0;
};

/** Un entier lu dans l'adresse, entre `min` et `max` ; `defaut` s'il manque ; 400 sinon. */
const entierDe = (texte, defaut, min, max, nom) => entierDeLAdresse(texte, defaut, min, max, nom, ErreurApi);

/** Les colonnes `cle` et `adresse` d'une table (alias, historique…) cèdent la place aux métadonnées de l'API dans une liste : `colonne_cle`… */
function avecAdresse(colonnes, cle, adresse) {
  const sortie = { cle, adresse };
  for (const [c, v] of Object.entries(colonnes)) sortie[c === 'cle' || c === 'adresse' ? `colonne_${c}` : c] = v;
  return sortie;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Adresses
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** L'adresse d'une ligne : celle d'un élément, ou d'une ligne d'enfant sous l'élément `parentSegment` (null : la ligne n'a pas de clé d'adresse). */
function adresseDe(vue, ligne, parentSegment = null) {
  if (!vue.cle.length) return null;
  const segment = segmentDeCle(ligne, vue.cle);
  return vue.enfant ? `${PREFIXE_V1}${vue.ressource.cle}/${parentSegment}/${vue.enfant.cle}/${segment}/` : `${PREFIXE_V1}${vue.ressource.cle}/${segment}/`;
}
const adresseDeLaListe = (vue, parentSegment = null) =>
  (vue.enfant ? `${PREFIXE_V1}${vue.ressource.cle}/${parentSegment}/${vue.enfant.cle}/` : `${PREFIXE_V1}${vue.ressource.cle}/`);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les lignes d'une vue qui passent `filtres` ({ colonne: valeur }) et la condition de la ressource (une ressource, pas un enfant), colonnes `lues`. */
function lignesDe(db, vue, filtres = {}, lues = null, autres = { morceaux: [], valeurs: [] }) {
  const ou = [...autres.morceaux];
  const valeurs = [...autres.valeurs];
  if (!vue.enfant) {
    const c = conditionSql(vue, vue.ressource.condition);
    ou.push(...c.morceaux);
    valeurs.push(...c.valeurs);
  }
  for (const [c, v] of Object.entries(filtres)) {
    if (!vue.colonnes.includes(c)) throw new Error(`${vue.table} : colonne inconnue ${c}`);
    if (v === null) ou.push(`"${c}" IS NULL`);
    else {
      ou.push(`"${c}" = ?`);
      valeurs.push(v);
    }
  }
  const colonnes = lues ? unique(lues).filter((c) => vue.colonnes.includes(c)).map((c) => `"${c}"`).join(', ') : '*';
  const sql = `SELECT ${colonnes} FROM "${vue.table}"${ou.length ? ` WHERE ${ou.join(' AND ')}` : ''}`;
  return db.prepare(sql).all(...valeurs).map((l) => ({ ...l }));
}

/**
 * Une liste paginée (GET /api/v1/<res>/ et /api/v1/<res>/<cle>/<enfant>/) : { ressource, enfant?, parent?, total, limite, decalage, tri, elements }.
 * `params` : URLSearchParams de l'adresse ; `parent` : { ligne, segment } pour un enfant.
 */
export function lister(db, vue, params, parent = null) {
  const filtres = { morceaux: [], valeurs: [] };
  for (const nom of new Set(params.keys())) {
    if (PARAMETRES_DE_LISTE.includes(nom)) continue;
    if (!vue.colonnes.includes(nom)) {
      throw new ErreurApi(400, `Paramètre inconnu « ${nom} » : ni ${PARAMETRES_DE_LISTE.join(', ')}, ni une colonne de ${vue.table} (${vue.colonnes.join(', ')}).`);
    }
    // une valeur vide : la colonne est vide (NULL, ou '' pour un texte) ; plusieurs valeurs : l'une OU l'autre
    const ou = params.getAll(nom).map((texte) => {
      if (texte === '') return vue.types[nom] === 'TEXT' ? `("${nom}" IS NULL OR "${nom}" = '')` : `"${nom}" IS NULL`;
      filtres.valeurs.push(valeurDeColonne(vue, nom, texte, `filtre ${nom}`));
      return `"${nom}" = ?`;
    });
    filtres.morceaux.push(`(${ou.join(' OR ')})`);
  }
  const limite = entierDe(params.get('limite'), LIMITE_PAR_DEFAUT, 1, LIMITE_MAX, 'limite');
  const decalage = entierDe(params.get('decalage'), 0, 0, Infinity, 'decalage');
  const tri = triDe(vue, params.get('tri'));
  const q = normalize(params.get('q') ?? '');
  const lues = vue.enfant ? null : [...vue.clePrimaire, ...vue.cle, ...vue.liste, ...vue.recherche, ...tri.map((t) => t.colonne)];
  let lignes = lignesDe(db, vue, parent ? filtreDuParent(vue, parent.ligne) : {}, lues, filtres);
  if (q) lignes = lignes.filter((l) => vue.recherche.some((c) => l[c] !== null && l[c] !== undefined && normalize(l[c]).includes(q)));
  lignes.sort(comparateur(tri));
  const page = lignes.slice(decalage, decalage + limite);
  const colonnes = vue.enfant ? vue.colonnes : vue.liste;
  return {
    ressource: vue.ressource.cle,
    ...(vue.enfant ? { enfant: vue.enfant.cle, parent: { cle: parent.segment, adresse: `${PREFIXE_V1}${vue.ressource.cle}/${parent.segment}/` } } : {}),
    adresse: adresseDeLaListe(vue, parent?.segment),
    total: lignes.length,
    limite,
    decalage,
    tri: tri.map((t) => `${t.decroissant ? '-' : ''}${t.colonne}`).join(','),
    elements: page.map((l) => {
      const sansImage = ligneSansImage(vue.table, l);
      return avecAdresse(Object.fromEntries(colonnes.map((c) => [c, sansImage[c] ?? null])), vue.cle.length ? segmentDeCle(l, vue.cle) : null, adresseDe(vue, l, parent?.segment));
    }),
  };
}

/** La ligne d'une vue d'après le segment de sa clé (et la ligne du parent pour un enfant), ou null : absente, ou hors de la condition de la ressource. */
export function trouver(db, vue, segment, parentLigne = null) {
  const cle = cleDuSegment(segment, vue.cle, vue.cle.filter((c) => vue.types[c] === 'INTEGER'));
  if (!cle) return null;
  return trouverParCle(db, vue, cle, parentLigne);
}

function trouverParCle(db, vue, cle, parentLigne = null) {
  const filtres = { ...cle, ...(parentLigne ? filtreDuParent(vue, parentLigne) : {}) };
  const [ligne] = lignesDe(db, vue, filtres);
  return ligne ?? null;
}

/** La ligne d'une extension (table 1:1) d'un élément, ou null. */
function ligneDExtension(db, extension, ligne) {
  const filtres = Object.entries(extension.parent);
  const sql = `SELECT * FROM "${extension.table}" WHERE ${filtres.map(([c]) => `"${c}" = ?`).join(' AND ')}`;
  const { colonnes } = structure(db, extension.table);
  for (const [c] of filtres) if (!colonnes.includes(c)) throw new Error(`extension ${extension.table} : colonne inconnue ${c}`);
  const trouvee = db.prepare(sql).get(...filtres.map(([, cp]) => ligne[cp] ?? null));
  return trouvee ? { ...trouvee } : null;
}

/** Les lignes d'une table liée (enfant, dérivée) d'un élément, triées (tri de l'enfant, puis sa clé primaire). */
function lignesLiees(db, vue, parentLigne) {
  const lignes = lignesDe(db, vue, filtreDuParent(vue, parentLigne));
  return lignes.sort(comparateur(triDe(vue, null)));
}

/** La version d'une représentation (ETag) : 16 caractères d'un sha256 du JSON, comme les fiches (serveur/fiches.mjs#versionDe). */
const versionDe = (objet) => empreinteCourte(JSON.stringify(objet));

/**
 * Le détail d'un élément : { ressource, cle, adresse, element, extensions, enfants, derivees, version } ; d'une ligne d'enfant : { ressource, enfant,
 * parent, cle, adresse, element, version }. La version (l'ETag) porte sur toute la représentation rendue — élément, extensions, enfants et dérivées :
 * un enfant modifié sans toucher la ligne parente (bloc d'un événement, don d'une race…) change la version du parent, sinon un client qui revalide
 * (If-None-Match) garderait l'ancienne liste et un DELETE avec If-Match emporterait un enfant réécrit entre-temps.
 */
export function detail(db, vue, ligne, parentSegment = null) {
  const element = ligneSansImage(vue.table, ligne);
  const cle = vue.cle.length ? segmentDeCle(ligne, vue.cle) : null;
  const adresse = adresseDe(vue, ligne, parentSegment);
  if (vue.enfant) {
    const parent = { cle: parentSegment, adresse: `${PREFIXE_V1}${vue.ressource.cle}/${parentSegment}/` };
    return { ressource: vue.ressource.cle, enfant: vue.enfant.cle, parent, cle, adresse, element, version: versionDe({ element }) };
  }
  const extensions = {};
  for (const e of vue.ressource.extensions ?? []) extensions[e.table] = ligneSansImage(e.table, ligneDExtension(db, e, ligne));
  const enfants = {};
  for (const e of vue.ressource.enfants ?? []) {
    const ve = vueDe(db, vue.ressource, e);
    enfants[e.cle] = lignesLiees(db, ve, ligne).map((l) => avecAdresse(ligneSansImage(e.table, l), ve.cle.length ? segmentDeCle(l, ve.cle) : null, adresseDe(ve, l, cle)));
  }
  const derivees = {};
  for (const d of vue.ressource.derivees ?? []) {
    const vd = vueDe(db, vue.ressource, { ...d, cle: d.table, nom: d.table, noms: d.table });
    derivees[d.table] = lignesLiees(db, vd, ligne).map((l) => ligneSansImage(d.table, l));
  }
  return { ressource: vue.ressource.cle, cle, adresse, element, extensions, enfants, derivees, version: versionDe({ element, extensions, enfants, derivees }) };
}

/** Les étiquettes d'un en-tête If-Match / If-None-Match (« "a", W/"b" », ou « * ») : ['a', 'b'] ou ['*']. */
export function etiquettesDe(entete) {
  if (entete === undefined || entete === null) return null;
  return String(entete).split(',').map((t) => t.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1')).filter(Boolean);
}
const correspond = (etiquettes, version) => etiquettes.includes('*') || etiquettes.includes(version);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les valeurs d'une liste de GET /api/edition/listes/ : [{ valeur, libelle }]. */
const valeursDeListe = (liste) => (Array.isArray(liste) ? liste.map((x) => ({ valeur: x.valeur ?? x.id, libelle: x.libelle ?? x.nom ?? String(x.valeur ?? x.id) })) : null);

/** Un champ de saisie (TABLES ou ENTITES) décrit pour le catalogue. */
function champDecrit(nom, champ, lesListes) {
  return {
    nom,
    type: champ.type,
    libelle: champ.libelle,
    ...(champ.requis ? { requis: true } : {}),
    ...(champ.choix ? { valeurs: champ.choix.map((c) => ({ valeur: c.valeur, libelle: c.libelle })) } : {}),
    ...(champ.liste ? { liste: champ.liste, ...(lesListes?.[champ.liste] ? { valeurs: valeursDeListe(lesListes[champ.liste]) } : {}) } : {}),
    ...(champ.min !== undefined ? { min: champ.min } : {}),
    ...(champ.max !== undefined && champ.type !== 'image' ? { max: champ.max } : {}),
    ...(champ.vide !== undefined ? { vide: champ.vide } : {}),
    ...(champ.aide ? { aide: champ.aide } : {}),
  };
}

/**
 * Les colonnes d'une table : { nom, type, cle, obligatoire, modifiable, champ?, figee? } — modifiable : dans TABLES et la vue écrit cette table, sauf
 * une colonne figée pour toutes les lignes (`colonnesFigees` de `o`, table principale) ; `figee` : { raison, si } d'une colonne figée pour certaines
 * lignes seulement. `parOperation` : les champs d'un PATCH traduit en opération du lot (ils remplacent TABLES).
 */
function colonnesDecrites(db, table, ecrit, lesListes, { o = null, parOperation = null } = {}) {
  const { types, cle } = structure(db, table);
  const notNull = new Map(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => [c.name, Boolean(c.notnull)]));
  const principale = o && table === o.table;
  return Object.keys(types).map((c) => {
    const figee = principale ? o.colonnesFigees?.[c] : null;
    const champ = parOperation ? parOperation[c] : ecrit && !(figee && typeof figee === 'string') ? TABLES[table]?.colonnes[c] : null;
    return {
      nom: c,
      type: types[c],
      ...(cle.includes(c) ? { cle: true } : {}),
      obligatoire: notNull.get(c) || cle.includes(c),
      modifiable: Boolean(champ),
      ...(champ ? { champ: champDecrit(c, champ, lesListes) } : {}),
      ...(champ && figee && typeof figee !== 'string' ? { figee: { raison: figee.raison, si: figee.si } } : {}),
    };
  });
}

/** La ligne de `limite.table` la plus récente qui a moins de `limite.nombre` lignes de la ressource (son identifiant), ou null. */
function ligneSousLaLimite(db, o, limite) {
  try {
    return db.prepare(`SELECT t.id FROM "${limite.table}" t WHERE (SELECT count(*) FROM "${o.table}" x WHERE x."${limite.champ}" = t.id) < ? ORDER BY t.rowid DESC LIMIT 1`)
      .get(limite.nombre)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Les champs de création d'une ressource ou d'un enfant : ceux de l'entité ENTITES (ceux que l'adresse donne marqués, ceux que le service exige hors
 * d'un cas avec `exige`, ceux que l'API refuse pour certaines valeurs avec `fige` ; un champ toujours refusé n'y est pas) et sa limite (`limite` :
 * { champ, nombre, regle, disponible }) ; ou ceux de l'opération du lot qui crée.
 */
function creationDecrite(db, o, lesListes) {
  if (!capacitesServies(o).creer) return null;
  const t = traductionDe(o, 'POST');
  if (t) {
    let exemple = null;
    try {
      exemple = t.exemple?.({ db }) ?? null;
    } catch {
      exemple = null;
    }
    return { operation: t.op, libelle: `${o.nom} (opération « ${t.op} » du lot)`, champs: Object.entries(t.champs).map(([nom, champ]) => champDecrit(nom, champ, lesListes)), exemple };
  }
  const entite = o.ecriture.creer;
  const parAdresse = o.ecriture.parentCreation ?? {};
  const exiges = o.ecriture.exiges ?? {};
  const limite = o.ecriture.limite;
  return {
    entite,
    libelle: ENTITES[entite].nouveau ?? `Nouveau ${ENTITES[entite].libelle}`,
    champs: Object.entries(ENTITES[entite].champs).filter(([nom]) => !champFige(o, nom)).map(([nom, champ]) => {
      const fige = o.ecriture.champsFiges?.[nom];
      return {
        ...champDecrit(nom, champ, lesListes),
        ...(nom in parAdresse ? { par_l_adresse: true } : {}),
        ...(exiges[nom] ? { exige: exiges[nom] } : {}),
        ...(fige ? { fige: { raison: fige.raison, si: fige.si } } : {}),
      };
    }),
    ...(limite ? { limite: { champ: limite.champ, table: limite.table, nombre: limite.nombre, regle: limite.regle, disponible: ligneSousLaLimite(db, o, limite) } } : {}),
  };
}

/** La suppression d'une ressource ou d'un enfant au catalogue : { entite } ou { operation }, null sans suppression. */
function suppressionDecrite(o) {
  if (!capacitesServies(o).supprimer) return null;
  const op = operationDe(o, 'DELETE');
  return op ? { operation: op } : { entite: o.ecriture.supprimer };
}

/**
 * Vrai si le PATCH d'exemple de cette ligne (ses valeurs actuelles) passerait la traduction en opération du lot (rien n'est écrit : traduire ne fait
 * que lire) ; toujours vrai sans opération. Un exemple ne prend jamais une ligne que l'opération refuse (la case « Même peuple », la matrice d'une
 * race dont l'onglet limite les magies…).
 */
function exempleAccepte(db, vue, ligne, parent = null) {
  const t = traductionDe(vue.objet, 'PATCH');
  if (!t) return true;
  try {
    t.traduire({ db, ligne, parent, valeurs: Object.fromEntries(Object.keys(t.champs).map((c) => [c, ligne[c] ?? null])) });
    return true;
  } catch {
    return false;
  }
}

/** Un exemple de ligne d'une ressource pour la documentation : la première dans l'ordre par défaut de sa liste qu'accepte son PATCH (null : aucune). */
function exempleDe(db, vue) {
  try {
    const params = new URLSearchParams({ limite: '200' });
    for (const element of lister(db, vue, params).elements) {
      const ligne = trouver(db, vue, element.cle);
      if (ligne && exempleAccepte(db, vue, ligne)) return exempleDeLigne(vue, ligne);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * La clé d'une ligne telle qu'on la saisit (valeurs brutes jointes par « , » : un client encode chacune) et ses valeurs modifiables
 * (colonnes de TABLES, ou champs d'un PATCH traduit en opération du lot ; jamais une colonne figée pour cette ligne).
 */
function exempleDeLigne(vue, ligne, parentSegmentBrut = null) {
  const valeurs = {};
  const t = traductionDe(vue.objet, 'PATCH');
  const colonnes = t ? t.champs : tablesModifiables(vue.objet).includes(vue.table) ? TABLES[vue.table].colonnes : {};
  for (const [c, champ] of Object.entries(colonnes)) {
    if (champ.type !== 'image' && !colonneFigee(vue.objet, c, ligne)) valeurs[c] = ligne[c] ?? null;
  }
  const ids = Object.fromEntries(Object.entries(ligne).filter(([c, v]) => c.endsWith('_id') && v !== null));
  return { cle: vue.cle.map((c) => String(ligne[c])).join(','), ...(parentSegmentBrut !== null ? { parent: parentSegmentBrut } : {}), valeurs, ids };
}

/** Exemple d'une ligne d'enfant : une ligne qui existe (n'importe quel parent) et qu'accepte son PATCH, avec la clé de son parent. */
function exempleDEnfant(db, vueParent, vueEnfant) {
  try {
    for (const l of db.prepare(`SELECT * FROM "${vueEnfant.table}" LIMIT 2000`).all()) {
      const ligne = { ...l };
      const [parent] = lignesDe(db, vueParent, Object.fromEntries(Object.entries(vueEnfant.parent).map(([ce, cp]) => [cp, ligne[ce] ?? null])));
      if (!parent || !exempleAccepte(db, vueEnfant, ligne, { ligne: parent, segment: segmentDeCle(parent, vueParent.cle) })) continue;
      return exempleDeLigne(vueEnfant, ligne, vueParent.cle.map((c) => String(parent[c])).join(','));
    }
    return null;
  } catch {
    return null;
  }
}

/** Le nombre de lignes d'une ressource (sa condition appliquée). */
function nombreDeLignes(db, vue) {
  const c = conditionSql(vue, vue.ressource.condition);
  return db.prepare(`SELECT count(*) AS n FROM "${vue.table}"${c.morceaux.length ? ` WHERE ${c.morceaux.join(' AND ')}` : ''}`).get(...c.valeurs).n;
}

/** Ce que fait une ressource, pour le catalogue (et la description OpenAPI, qui le reprend). */
function ressourceDecrite(db, r, { lesListes, exemples }) {
  const vue = vueDe(db, r);
  const capacites = capacitesServies(r);
  const ecrites = new Set(tablesModifiables(r));
  const patch = traductionDe(r, 'PATCH');
  return {
    cle: r.cle,
    module: r.module,
    nom: r.nom,
    noms: r.noms,
    description: r.description,
    adresse: `${PREFIXE_V1}${r.cle}/`,
    table: r.table,
    ...(r.condition ? { condition: r.condition } : {}),
    cle_primaire: vue.clePrimaire,
    libelle: vue.libelle,
    liste: vue.liste,
    recherche: vue.recherche,
    tri: vue.tri,
    capacites,
    colonnes: colonnesDecrites(db, r.table, capacites.modifier && ecrites.has(r.table), lesListes, { o: r, parOperation: patch?.champs }),
    extensions: (r.extensions ?? []).map((e) => ({
      table: e.table, parent: e.parent, colonnes: colonnesDecrites(db, e.table, capacites.modifier && !patch && ecrites.has(e.table), lesListes),
    })),
    creation: creationDecrite(db, r, lesListes),
    suppression: suppressionDecrite(r),
    ...(patch ? { modification: { operation: patch.op } } : {}),
    actions: (r.lectureSeule ? [] : r.actions ?? []).map((a) => ({
      cle: a.cle, nom: a.nom, description: a.description, operation: a.op, adresse: `${PREFIXE_V1}${r.cle}/{cle}/${a.cle}/`,
      champs: Object.entries(TRADUCTIONS[a.op].ACTION.champs).map(([nom, champ]) => champDecrit(nom, champ, lesListes)),
    })),
    enfants: (r.enfants ?? []).map((e) => {
      const ve = vueDe(db, r, e);
      const ce = capacitesServies(e);
      const patchEnfant = traductionDe(e, 'PATCH');
      return {
        cle: e.cle,
        nom: e.nom,
        noms: e.noms,
        description: e.description ?? null,
        adresse: `${PREFIXE_V1}${r.cle}/{cle}/${e.cle}/`,
        table: e.table,
        parent: e.parent,
        cle_primaire: ve.clePrimaire,
        cle_adresse: ve.cle,
        tri: ve.tri,
        capacites: ce,
        colonnes: colonnesDecrites(db, e.table, ce.modifier, lesListes, { o: e, parOperation: patchEnfant?.champs }),
        creation: creationDecrite(db, e, lesListes),
        suppression: suppressionDecrite(e),
        ...(patchEnfant ? { modification: { operation: patchEnfant.op } } : {}),
        ...(exemples ? { exemple: exempleDEnfant(db, vue, ve) } : {}),
      };
    }),
    derivees: (r.derivees ?? []).map((d) => ({ table: d.table, parent: d.parent })),
    lignes: nombreDeLignes(db, vue),
    ...(exemples ? { exemple: exempleDe(db, vue) } : {}),
  };
}

/**
 * Le catalogue de l'API (GET /api/v1/) : { api, version, documentation, modules, ressources }. `exemples` : une clé et des valeurs réelles par
 * ressource (pour la description OpenAPI : les exemples de ses paramètres et de ses corps).
 */
export function catalogue(db, { version = null, exemples = false } = {}) {
  const lesListes = listes(db);
  return {
    api: 'Maverick Center — API REST v1 (site de dev)',
    version,
    documentation: `${PREFIXE_V1}openapi.json`,
    modules: MODULES.map((m) => ({ cle: m.cle, libelle: m.libelle, ressources: m.ressources.map((r) => r.cle).filter((c) => SERVIE.has(c)) })),
    ressources: RESSOURCES_SERVIES.map((r) => ressourceDecrite(db, r, { lesListes, exemples })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Écritures : un lot du service d'édition, jamais du SQL direct
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le corps d'une écriture : un objet JSON (pas un tableau) ; 400 sinon. */
function objetAttendu(valeur, quoi) {
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) throw new ErreurApi(400, `${quoi} : corps attendu, un objet JSON { … }.`);
  return valeur;
}

/** Le message d'une erreur du service d'édition, sans le « operations[i] : » du lot (l'API n'envoie qu'une opération par table). */
const sansRang = (message) => String(message).replace(/^operations\[\d+\] : /, '');

/** Applique un lot par le service d'édition (journal, retraits des fiches) et le note au journal du service. */
function ecrire(db, service, { methode, adresse, page, operations }) {
  let resultat;
  try {
    resultat = enregistrer(db, { page, operations });
  } catch (e) {
    if (e instanceof ErreurEdition) throw new ErreurApi(e.statut, sansRang(e.message), e.details);
    throw e;
  }
  if (resultat.lot) {
    // les fiches dont le lot a retiré un élément supprimé (R42) : un compte, jamais leurs noms (le journal du service n'est pas la réponse)
    const adaptees = resultat.fiches?.length ? ` ; ${resultat.fiches.length} fiche(s) de personnage adaptée(s)` : '';
    service.journal?.(`api v1 : ${methode} ${adresse} → lot ${resultat.lot} (${resultat.modifications} ligne(s))${adaptees}`, { categorie: 'edition' });
  }
  return resultat;
}

/** La clé de la ligne créée d'après `crees[].id` du lot : une clé JSON entière, « <parent>#<rang> », ou la valeur de la seule colonne de clé. */
function cleDeLaLigneCreee(vue, id) {
  if (id === undefined || id === null) return null;
  const texte = String(id);
  if (texte.startsWith('{')) {
    try {
      const o = JSON.parse(texte);
      if (o && typeof o === 'object' && vue.cle.every((c) => c in o)) return Object.fromEntries(vue.cle.map((c) => [c, o[c]]));
    } catch {
      // pas du JSON : une valeur simple
    }
  }
  const colonne = vue.objet.ecriture?.cleCreee ?? (vue.cle.length === 1 ? vue.cle[0] : null);
  if (!colonne || vue.cle.length !== 1 || colonne !== vue.cle[0]) return null;
  if (vue.types[colonne] === 'INTEGER') {
    const fin = texte.includes('#') ? texte.slice(texte.lastIndexOf('#') + 1) : texte;
    return /^-?\d+$/.test(fin) ? { [colonne]: Number(fin) } : null;
  }
  return { [colonne]: texte };
}

const pageDuLot = (vue) => `api/v1/${vue.ressource.cle}${vue.enfant ? `/${vue.enfant.cle}` : ''}`;

/**
 * Une écriture traduite en opération du lot (TRADUCTIONS) : POST → 201 + Location (200 sans élément si l'opération n'a rien créé), PATCH → le détail
 * relu (`element: null` si l'opération a retiré la ligne), DELETE → { supprime, adresse, lot, fiches }. If-Match comme ailleurs.
 */
function ecrireParOperation(db, service, vue, methode, { t, corps, ligne = null, parent = null, adresse, etiquettes = null }) {
  const quoi = `${vue.objet.nom} (opération « ${t.op} » du lot)`;
  let valeurs = {};
  if (methode !== 'DELETE') {
    objetAttendu(corps, quoi);
    if (!Object.keys(corps).length) throw new ErreurApi(400, `${quoi} : corps vide (${Object.keys(t.champs).join(', ')}).`);
    valeurs = valeursDuCorps(t.champs, corps, quoi);
  }
  if (ligne && etiquettes) {
    const avant = detail(db, vue, ligne, parent?.segment ?? null);
    if (!correspond(etiquettes, avant.version)) throw perimee(avant);
  }
  const { operations, cle } = t.traduire({ db, ligne, parent, valeurs });
  const resultat = ecrire(db, service, { methode, adresse, page: pageDuLot(vue), operations });
  const { lot, fiches } = resultat;
  if (methode === 'DELETE') return json(200, { supprime: segmentDeCle(ligne, vue.cle), adresse, lot, fiches });
  const relue = trouverParCle(db, vue, methode === 'POST' ? cle : Object.fromEntries(vue.cle.map((c) => [c, ligne[c]])), parent?.ligne ?? null);
  if (!relue) return json(200, { lot, fiches, adresse: methode === 'POST' ? null : adresse, element: null });
  const d = detail(db, vue, relue, parent?.segment ?? null);
  if (methode === 'POST') return json(201, { ...d, lot, fiches }, { Location: d.adresse, ETag: `"${d.version}"` });
  return json(200, { ...d, lot, fiches }, { ETag: `"${d.version}"` });
}

/** POST /api/v1/<res>/<cle>/<action>/ : l'opération du lot de l'action sur l'élément → { action, element: { cle, adresse, existe }, lot, fiches }. */
function agir(db, service, vue, action, ligne, corps, adresse) {
  const t = { op: action.op, ...TRADUCTIONS[action.op].ACTION };
  const quoi = `${action.nom} (opération « ${t.op} » du lot)`;
  const valeurs = valeursDuCorps(t.champs, objetAttendu(corps, quoi), quoi);
  const { operations } = t.traduire({ db, ligne, parent: null, valeurs });
  const resultat = ecrire(db, service, { methode: 'POST', adresse, page: `${pageDuLot(vue)}/${action.cle}`, operations });
  const cle = segmentDeCle(ligne, vue.cle);
  return json(200, {
    action: action.cle, element: { cle, adresse: adresseDe(vue, ligne), existe: Boolean(trouver(db, vue, cle)) }, lot: resultat.lot, fiches: resultat.fiches,
  });
}

/** POST : crée par l'entité de la vue ; le parent d'un enfant vient de l'adresse (parentCreation) ; un champ figé pour ce corps : 400. */
function creer(db, service, vue, corps, parent, adresse) {
  const t = traductionDe(vue.objet, 'POST');
  if (t) return ecrireParOperation(db, service, vue, 'POST', { t, corps, parent, adresse });
  const valeurs = { ...objetAttendu(corps, `Créer ${vue.objet.nom.toLowerCase()}`) };
  for (const champ of Object.keys(valeurs)) {
    const raison = champFige(vue.objet, champ, valeurs);
    if (raison) throw new ErreurApi(400, `« ${champ} » ne se donne pas ici : ${raison}.`);
  }
  for (const [champ, colonne] of Object.entries(parent ? vue.objet.ecriture.parentCreation ?? {} : {})) {
    const v = parent.ligne[colonne];
    if (champ in valeurs && valeurs[champ] !== v) throw new ErreurApi(400, `« ${champ} » vient de l’adresse (${v}) : ne le donnez pas dans le corps.`);
    valeurs[champ] = v;
  }
  const resultat = ecrire(db, service, { methode: 'POST', adresse, page: pageDuLot(vue), operations: [{ op: 'creer', entite: vue.objet.ecriture.creer, valeurs }] });
  const cree = resultat.crees.find((c) => c.operation === 0) ?? resultat.crees[0];
  const cle = cleDeLaLigneCreee(vue, cree?.id);
  const ligne = cle ? trouverParCle(db, vue, cle, parent?.ligne ?? null) : null;
  if (!ligne) return json(201, { lot: resultat.lot, crees: resultat.crees, fiches: resultat.fiches });
  const d = detail(db, vue, ligne, parent?.segment ?? null);
  return json(201, { ...d, lot: resultat.lot, fiches: resultat.fiches }, { Location: d.adresse, ETag: `"${d.version}"` });
}

/** Le 409 d'une version périmée : la représentation à jour, pour recommencer. */
function perimee(d) {
  return new ErreurApi(409, 'Modifié entre-temps : la version envoyée (If-Match) n’est plus celle de la base. Relisez l’élément, puis recommencez.', {
    element: d.element, ...(d.extensions ? { extensions: d.extensions } : {}), version: d.version,
  });
}

/**
 * PATCH : une opération `modifier` par table touchée (la principale, puis les extensions), colonnes de TABLES seulement, sauf une colonne figée pour
 * cette ligne (`colonnesFigees` : 400, avec la raison) ; ou l'opération du lot qui sert le PATCH de la vue.
 */
function modifier(db, service, vue, ligne, corps, etiquettes, parent, adresse) {
  const t = traductionDe(vue.objet, 'PATCH');
  if (t) return ecrireParOperation(db, service, vue, 'PATCH', { t, corps, ligne, parent, adresse, etiquettes });
  const valeurs = objetAttendu(corps, `Modifier ${vue.objet.nom.toLowerCase()}`);
  if (!Object.keys(valeurs).length) throw new ErreurApi(400, 'Aucune colonne à modifier.');
  const ecrites = tablesModifiables(vue.objet);
  const extensions = vue.enfant ? [] : vue.ressource.extensions ?? [];
  const parTable = new Map();
  const ajouter = (table, colonne, v) => {
    if (!ecrites.includes(table)) throw new ErreurApi(400, `${table} : en lecture seule ici (rien ne s’y modifie par l’API).`);
    if (!TABLES[table].colonnes[colonne]) {
      throw new ErreurApi(400, `« ${colonne} » ne se modifie pas (${table} : ${Object.keys(TABLES[table].colonnes).join(', ')}).`);
    }
    const figee = table === vue.table ? colonneFigee(vue.objet, colonne, ligne) : null;
    if (figee) throw new ErreurApi(400, `« ${colonne} » ne se modifie pas ici : ${figee}.`);
    (parTable.get(table) ?? parTable.set(table, {}).get(table))[colonne] = v;
  };
  for (const [k, v] of Object.entries(valeurs)) {
    const extension = extensions.find((e) => e.table === k);
    if (extension && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [c, x] of Object.entries(v)) ajouter(k, c, x);
    } else if (vue.colonnes.includes(k)) ajouter(vue.table, k, v);
    else {
      const noms = extensions.map((e) => e.table);
      throw new ErreurApi(400, `« ${k} » : ni une colonne de ${vue.table}${noms.length ? `, ni une extension (${noms.join(', ')})` : ''}.`);
    }
  }
  const avant = detail(db, vue, ligne, parent?.segment ?? null);
  if (etiquettes && !correspond(etiquettes, avant.version)) throw perimee(avant);
  const operations = [];
  for (const [table, v] of parTable) {
    const extension = extensions.find((e) => e.table === table);
    const ligneDeTable = extension ? ligneDExtension(db, extension, ligne) : ligne;
    if (!ligneDeTable) throw new ErreurApi(404, `${table} : cet élément n’en a pas de ligne (l’API n’en crée pas) ; rien n’a été modifié.`);
    const op = { op: 'modifier', table, cle: cleDe(db, table, ligneDeTable), valeurs: v };
    if (etiquettes) {
      const lue = ligneSansImage(table, ligneDeTable);
      op.avant = Object.fromEntries(Object.keys(v).map((c) => [c, lue[c] ?? null]));
    }
    operations.push(op);
  }
  let resultat;
  try {
    resultat = ecrire(db, service, { methode: 'PATCH', adresse, page: pageDuLot(vue), operations });
  } catch (e) {
    // le service propose une opération (un renommage vers l'écriture d'un autre mot-clé : la fusion) que la ressource sait faire par une action
    const fusion = e instanceof ErreurApi ? e.details?.fusion : null;
    const action = fusion && !vue.enfant ? (vue.ressource.actions ?? []).find((a) => a.op === 'fusionner_mots_cles') : null;
    if (action) e.details.action = { methode: 'POST', adresse: `${PREFIXE_V1}${vue.ressource.cle}/${segmentDeCle(ligne, vue.cle)}/${action.cle}/`, corps: { dans: fusion.dans } };
    throw e;
  }
  const relue = trouverParCle(db, vue, cleDe(db, vue.table, ligne), parent?.ligne ?? null);
  if (!relue) return json(200, { lot: resultat.lot, fiches: resultat.fiches });
  const d = detail(db, vue, relue, parent?.segment ?? null);
  return json(200, { ...d, lot: resultat.lot, fiches: resultat.fiches }, { ETag: `"${d.version}"` });
}

/** DELETE : l'entité de suppression de la vue, avec sa clé (cleSuppression, sinon la clé primaire de la ligne) ; ou l'opération du lot du DELETE. */
function supprimer(db, service, vue, ligne, etiquettes, parent, adresse) {
  const t = traductionDe(vue.objet, 'DELETE');
  if (t) return ecrireParOperation(db, service, vue, 'DELETE', { t, ligne, parent, adresse, etiquettes });
  if (etiquettes) {
    const avant = detail(db, vue, ligne, parent?.segment ?? null);
    if (!correspond(etiquettes, avant.version)) throw perimee(avant);
  }
  const ecriture = vue.objet.ecriture;
  const cle = ecriture.cleSuppression ? Object.fromEntries(Object.entries(ecriture.cleSuppression).map(([ce, cl]) => [ce, ligne[cl]])) : cleDe(db, vue.table, ligne);
  const resultat = ecrire(db, service, { methode: 'DELETE', adresse, page: pageDuLot(vue), operations: [{ op: 'supprimer', entite: ecriture.supprimer, cle }] });
  return json(200, { supprime: vue.cle.length ? segmentDeCle(ligne, vue.cle) : null, adresse, lot: resultat.lot, fiches: resultat.fiches });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Routeur
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les méthodes d'une adresse et la raison de chaque absente : { methodes: ['GET', …], raisons: { POST: '…' } }. La raison dit ce qui manque au service
 * (ni entité ENTITES, ni colonne de TABLES, ni opération du lot : test/ressources-registre.test.mjs assure que tout ce que le site de dev écrit est
 * joignable) et, quand l'objet s'écrit autrement, par quelles méthodes.
 */
function methodesDe(o, adresse) {
  const c = capacitesServies(o);
  const nom = `${o.noms ?? o.nom}`;
  const autrement = Object.entries(o.lectureSeule ? {} : o.operations ?? {}).map(([m, op]) => `${m} par l’opération « ${op} » du lot`);
  const pourquoi = (quoi) => (o.lectureSeule ? 'en lecture seule' : `ni le service d’édition (${quoi}) ni une opération du lot ne le font${autrement.length ? ` ; ici : ${autrement.join(', ')}` : ''}`);
  if (adresse === 'liste') {
    return {
      methodes: ['GET', ...(c.creer ? ['POST'] : [])],
      raisons: c.creer ? {} : { POST: `${nom} : pas de création par l’API (${pourquoi('entité de création, ENTITES')}).` },
    };
  }
  const raisons = {};
  if (!c.modifier) raisons.PATCH = `${nom} : pas de modification par l’API (${pourquoi('colonnes de TABLES')}).`;
  if (!c.supprimer) raisons.DELETE = `${nom} : pas de suppression par l’API (${pourquoi('entité de suppression, ENTITES')}).`;
  raisons.PUT = 'PUT n’existe pas : PATCH modifie les colonnes envoyées, les autres restent.';
  return { methodes: ['GET', ...(c.modifier ? ['PATCH'] : []), ...(c.supprimer ? ['DELETE'] : [])], raisons };
}

/** 405 : la méthode n'est pas permise à cette adresse ; Allow = la liste exacte, le corps dit pourquoi. */
function nonPermise(methode, { methodes, raisons }, capacites = null) {
  const raison = raisons[methode] ?? `Méthode ${methode} non permise ici.`;
  return json(405, { erreur: raison, methodes, ...(capacites ? { capacites } : {}) }, { Allow: methodes.join(', ') });
}

/**
 * Les routes /api/v1/… : `segments` = les morceaux de l'adresse après « /api/v1/ » (encodés, sans le dernier vide), `params` = URLSearchParams,
 * `refusEcriture(entetes)` = la garde des écritures d'api.mjs (Content-Type, Sec-Fetch-Site), null si elle passe.
 */
export function traiterApiV1(requete, service, { segments, params = new URLSearchParams(), refusEcriture }) {
  // décision du propriétaire (2026-10-15) : fermée en production, lectures comprises, avant tout le reste
  if (!service.edition) return erreur(403, FERMEE_EN_PRODUCTION);
  const { methode } = requete;
  try {
    return router(requete, service, segments, params, refusEcriture, methode);
  } catch (e) {
    if (e instanceof ErreurApi || e instanceof ErreurEdition) return erreur(e.statut, sansRang(e.message), e.details ?? {});
    throw e;
  }
}

function router(requete, service, segments, params, refusEcriture, methode) {
  const entetes = requete.entetes ?? {};
  const base = () => {
    const db = service.base();
    if (!db) throw new ErreurApi(503, 'La base n’est pas disponible pour le moment.', { etat: service.etat() });
    return db;
  };
  const [cleRessource, segment, cleEnfant, segmentEnfant, ...reste] = segments;

  if (cleRessource === undefined) {
    if (methode !== 'GET') return nonPermise(methode, { methodes: ['GET'], raisons: {} });
    return json(200, catalogue(base(), { version: service.etat?.()?.version ?? null }));
  }
  if (cleRessource === 'openapi.json' && segment === undefined) {
    if (methode !== 'GET') return nonPermise(methode, { methodes: ['GET'], raisons: {} });
    return json(200, descriptionOpenApi(catalogue(base(), { version: service.etat?.()?.version ?? null, exemples: true })));
  }
  const ressource = SERVIE.has(cleRessource) ? ressourceDe(cleRessource) : null;
  if (!ressource || reste.length) return erreur(404, `Adresse inconnue${ressource ? '' : ` : pas de ressource « ${decodeURIComponentSur(cleRessource)} » (le catalogue : GET ${PREFIXE_V1})`}.`);
  const enfant = cleEnfant === undefined ? null : enfantDe(ressource, cleEnfant);
  const action = cleEnfant !== undefined && !enfant ? actionDe(ressource, cleEnfant) : null;
  if (cleEnfant !== undefined && !enfant && !action) return erreur(404, `Adresse inconnue : ${ressource.noms} n’ont pas de sous-ressource « ${decodeURIComponentSur(cleEnfant)} ».`);
  if (action) {
    // une action sur un élément : POST seulement, sans clé après elle
    if (segmentEnfant !== undefined) return erreur(404, `Adresse inconnue : « ${action.cle} » est une action, sans ligne à lire.`);
    if (methode !== 'POST') return nonPermise(methode, { methodes: ['POST'], raisons: { [methode]: `${action.nom} : une action, seulement par POST.` } });
    const refus = refusEcriture(entetes);
    if (refus) return refus;
    let corpsAction;
    try {
      corpsAction = JSON.parse(String(requete.corps ?? '').trim() || 'null');
    } catch {
      return erreur(400, 'Corps JSON illisible.');
    }
    const db = base();
    const vue = vueDe(db, ressource);
    const ligne = trouver(db, vue, segment);
    if (!ligne) return erreur(404, `${ressource.nom} introuvable : ${decodeURIComponentSur(segment)}.`);
    return agir(db, service, vue, action, ligne, corpsAction, `${adresseDe(vue, ligne)}${action.cle}/`);
  }

  const objet = enfant ?? ressource;
  const versListe = enfant ? segmentEnfant === undefined : segment === undefined;
  const permises = methodesDe(objet, versListe ? 'liste' : 'element');
  if (!permises.methodes.includes(methode)) return nonPermise(methode, permises, capacitesServies(objet));

  const db = base();
  const ecriture = methode !== 'GET';
  let corps;
  if (ecriture) {
    const refus = refusEcriture(entetes);
    if (refus) return refus;
    const texte = requete.corps ?? '';
    if (String(texte).trim() !== '') {
      try {
        corps = JSON.parse(texte);
      } catch {
        return erreur(400, 'Corps JSON illisible.');
      }
    } else if (methode !== 'DELETE') return erreur(400, 'Corps JSON attendu.');
  }
  const etiquettes = etiquettesDe(entetes['if-match']);

  // le parent (ressource) : sa ligne, d'après le segment
  const vueRessource = vueDe(db, ressource);
  let parent = null;
  if (segment !== undefined) {
    const ligne = trouver(db, vueRessource, segment);
    if (!ligne) return erreur(404, `${ressource.nom} introuvable : ${decodeURIComponentSur(segment)}.`);
    parent = { ligne, segment: segmentDeCle(ligne, vueRessource.cle) };
  }
  const vue = enfant ? vueDe(db, ressource, enfant) : vueRessource;

  if (versListe) {
    if (methode === 'GET') return json(200, lister(db, vue, params, enfant ? parent : null));
    return creer(db, service, vue, corps, enfant ? parent : null, adresseDeLaListe(vue, parent?.segment));
  }
  // un élément (ressource) ou une ligne d'enfant
  let ligne = parent.ligne;
  let parentDeLaVue = null;
  if (enfant) {
    ligne = trouver(db, vue, segmentEnfant, parent.ligne);
    if (!ligne) return erreur(404, `${enfant.nom} introuvable : ${decodeURIComponentSur(segmentEnfant)} (sous ${ressource.nom.toLowerCase()} ${decodeURIComponentSur(segment)}).`);
    parentDeLaVue = parent;
  }
  // l'adresse canonique de la ligne (chaque valeur encodée comme segmentDeCle), notée au journal et rendue par DELETE
  const adresse = adresseDe(vue, ligne, parentDeLaVue?.segment ?? null);
  if (methode === 'GET') {
    const d = detail(db, vue, ligne, parentDeLaVue?.segment ?? null);
    const etiquette = `"${d.version}"`;
    const cache = { ETag: etiquette, 'Cache-Control': 'private, no-cache' };
    const connues = etiquettesDe(entetes['if-none-match']);
    if (connues && correspond(connues, d.version)) return { statut: 304, corps: null, brut: '', entetes: cache };
    return json(200, d, cache);
  }
  if (methode === 'PATCH') return modifier(db, service, vue, ligne, corps, etiquettes, parentDeLaVue, adresse);
  return supprimer(db, service, vue, ligne, etiquettes, parentDeLaVue, adresse);
}

/** Un segment d'adresse décodé pour un message (tel quel s'il est mal encodé). */
const decodeURIComponentSur = (segment) => segmentDecode(segment, segment);
