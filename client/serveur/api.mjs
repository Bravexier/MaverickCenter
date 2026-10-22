// Routes de l'API du service (docs/serveur.md, « API ») : une requête déjà lue (méthode, chemin, en-têtes, corps) → une réponse JSON.
// Sans réseau ni état propre : service.mjs lit la requête HTTP et fournit la base vivante (et le téléchargeur de /api/classeur/, la seule route
// qui rend une promesse) ; les tests appellent `traiter` directement.
//
//   GET  /api/etat/                 état du service et de la base vivante
//   GET  /api/maintenance/          ce serveur est-il en maintenance (vraie mise à jour en cours, nouvelle version pas encore ici) ? — maintenance.mjs
//   POST /api/maintenance/lever/    { lot } → lève la maintenance des deux serveurs (site de dev seulement : il tient le lancement)
//   GET  /api/personnages/          résumé de chaque prétiré (recherche ; du portrait, son empreinte et son cadrage seulement)
//   POST /api/personnages/          crée un prétiré                       → 201, { personnage, controles, niveau }
//   GET  /api/personnages/<id>/     une fiche                             → { personnage, controles, niveau }
//   PUT  /api/personnages/<id>/     modifie une fiche (avec sa `version`) → { personnage, controles, niveau } ; 409 si elle a changé entre-temps
//   DELETE /api/personnages/<id>/   supprime une fiche (corps { version })  → { supprime } ; 409 si elle a changé entre-temps
//   GET  /api/personnages/<id>/portrait/   l'image du portrait (ses octets, pas du JSON) ; 304 si l'empreinte est celle qu'a le navigateur (ETag)
//   POST /api/classeur/             { url } → les octets .xlsx d'une feuille Google Sheets partagée par lien (« Importer (en ligne) » de /fiche/ ;
//                                   serveur/classeur.mjs, la seule route qui sort sur Internet à la demande de tout visiteur ; en production, la seule
//                                   sortie : le site de dev joint aussi l'API GitHub, routes /api/mise-a-jour/) ; les deux instances, sans la base ; la
//                                   réponse est une PROMESSE (seule route asynchrone : service.mjs l'attend)
// Édition des règles, sur le site de dev seulement (service lancé avec MAVERICK_EDITION=1 ; ailleurs 403) — serveur/edition.mjs :
//   GET  /api/edition/en-attente/   lignes modifiées depuis la construction des pages (ce que les pages statiques doivent montrer à la place)
//   POST /api/edition/lignes/       { lignes: [{ table, cle }] } → la ligne actuelle de chacune (passage en mode modification)
//   GET  /api/edition/listes/       listes des formulaires (compétences, catégories de classe, races hybrides…)
//   GET  /api/edition/pages/        les pages du wiki (id, titre) : cibles d'un lien posé dans le texte du guide
//   GET  /api/edition/mots-cles/    le vocabulaire des mots-clés, avec leurs pages et ceux dont le site se sert (/recherche/ en mode modification)
//   GET  /api/edition/chronologie/  les événements de la chronologie dans l'ordre de lecture avec leurs catégories, et les catégories (surcouche de la frise)
//   POST /api/edition/race/         { race } → magies innées et relations de la race, dans la base vivante
//   POST /api/edition/classe/       { classe } → spécialités, dons, choix et fiches qui les citent (ajout et suppression depuis sa page)
//   POST /api/edition/bestiaire/    { connues, logo } → l'ordre des lignes du tableau des monstres, et la ligne et la carte de celles que la page n'a pas
//   POST /api/edition/evenement/    { evenement } → un événement de la chronologie, ses blocs de description et ses catégories, dans la base vivante
//   POST /api/edition/portrait/     { table, cle } → le portrait d'une carte de monstre ou d'une espèce, en entier, et son cadrage (les autres réponses
//                                   de l'édition ne donnent d'une image que son empreinte : ligneSansImage ; le journal la porte en entier)
//   POST /api/edition/              { page, operations } → applique un lot d'un bloc et le note au journal
//   GET  /api/edition/journal/      le journal des modifications en attente, à rapatrier dans data/rows (npm run db:appliquer-edition)
// Page « Mise à jour », sur le site de dev seulement (même garde) — serveur/notes-de-version.mjs :
//   GET  /api/mise-a-jour/              la note en préparation : modifications production → dev (calculées), brouillon, état du lancement
//   POST /api/mise-a-jour/brouillon/    { texte, avant } → enregistre le champ libre des admins
//   POST /api/mise-a-jour/majeure/      { majeure } → la case « Version majeure » (true : la prochaine mise à jour est la X+1.0) ; rien n'est
//                                       déclenché ; rend la note en préparation
//   POST /api/mise-a-jour/lancer/       { confirmation, simulation?, version_cible? } → fige le lot et déclenche le workflow GitHub de mise à jour →
//                                       202 (simulation : true = simulation de mise à jour, le workflow vérifie tout sans rien pousser ; version_cible :
//                                       celle que la page a montrée, 409 si ce n'est plus celle qui serait livrée)
//   POST /api/mise-a-jour/liberer/      { lot } → annule ce lancement s'il n'est pas parti, a échoué avant dev, ou se lance à la main : le brouillon
//                                       redevient modifiable, le lot n'est plus servi (et son run est annulé sur GitHub)
//   GET  /api/mise-a-jour/lancement/    état du lancement (suivi du run GitHub)
//   GET  /api/mise-a-jour/lots/<id>/    un lot figé, tel quel (le workflow le télécharge et vérifie son empreinte)
// API REST /api/v1/ et page Debug, sur le site de dev seulement (même garde ; décision du propriétaire du 2026-10-15 : en production, tout /api/v1/
// répond 403, lectures comprises) :
//   GET  /api/v1/ , /api/v1/openapi.json, /api/v1/<ressource>/[<cle>/[<enfant>/[<cle>/]]]   le CRUD des éléments du jeu (serveur/ressources.mjs,
//                                   registre lib/ressources.mjs ; description OpenAPI : serveur/openapi.mjs) ; POST, PATCH, DELETE par le service d'édition
//   GET  /api/debug/journal/        le journal du service gardé en mémoire (serveur/journal-du-service.mjs) : ?depuis=&niveau=&categorie=&q=&limite=&min_ms=
//   GET  /api/debug/metriques/      les métriques d'une instance (serveur/metriques.mjs#lire) : ?instance=dev|prod&periode=1h|24h|7j|30j|365j|tout&tri=
//                                   moyenne|mediane|p95|p99|max|n|erreurs|total|sql — statistiques globales et par route, série, pages vues,
//                                   navigateurs, origines ; le site de dev lit aussi le fichier de la production (lecture seule) ; instance absente : 404
//   GET  /api/debug/metriques/requetes/   les dernières requêtes une à une, gardées en mémoire (site de dev) : ?limite=&route=&route_exacte=&min_ms=&statut=
//   GET  /api/debug/metriques/export/     les agrégats bruts en pièce jointe (la fenêtre de la page ; « 1h » : par 5 minutes ; 100 000 lignes au plus,
//                                   X-Export-Tronque sinon) : ?instance=&periode=&format=csv|json
//   GET  /api/debug/systeme/        processus, disque et sa répartition par type de données (jauge), fichiers, échantillons par minute, évènements,
//                                   volume des métriques et alertes : ?instance=&periode=
//   GET  /api/debug/tables/         chaque table et vue de la base vivante : { tables: [{ nom, genre, lignes }] } (menu « DB » de la page Debug ;
//                                   serveur/debug-tables.mjs, ni tables internes sqlite_… ni tables FTS5)
//   GET  /api/debug/tables/<nom>/   une page de ses lignes, en lecture seule : ?limite=1..500 (100)&decalage=&tri=<colonne>&ordre=asc|desc →
//                                   { table, genre, colonnes, total, limite, decalage, tri, ordre, lignes } (images et textes longs résumés) ; toutes les
//                                   tables et vues, fiches (section 13) comprises (décision du propriétaire du 2026-10-15 : « Il faut tout rendre
//                                   ouvert. Ce qui est fermé c'est que la base du serveur de prod. ») ; ETag (empreinte du corps), 304 sur If-None-Match
//   GET  /api/debug/base/           { version } : la version de la base vivante, qui change à chaque écriture validée (coût fixe, aucune table lue) ;
//                                   la page la relève toutes les 2 s, menu « DB » ouvert, pour suivre les tables en direct (une relève : ni au journal
//                                   du service ni dans la mémoire des requêtes)
// Mesure des pages vues, sur les DEUX instances (décision du propriétaire du 2026-10-15 : « Active-le aussi en prod dans un premier temps » ;
// MAVERICK_METRIQUES_PAGES=0 la ferme : 403) — chaque instance l'écrit dans SA base des métriques, jamais dans la base vivante :
//   POST /api/metriques/page/       { page, ttfb_ms, dom_ms, charge_ms, lcp_ms } (navigator.sendBeacon : Content-Type application/json ou text/plain,
//                                   2 Kio au plus, Sec-Fetch-Site same-origin, sinon Origin du même hôte) → 204 ; 400 invalide, 413 trop gros,
//                                   429 trop de balises cette minute
// Les adresses finissent par « / », comme celles du site (en développement, Astro refuse une adresse sans « / » finale avant de la transmettre) ;
// le service accepte aussi la forme sans « / ». La chaîne de requête (« ?q=… ») vient dans `requete.recherche`, ou à la suite du chemin.
//
// Pas de comptes : quiconque a le mot de passe du site (nginx) lit et écrit les prétirés. Les écritures exigent un corps JSON
// (Content-Type: application/json) et refusent une requête qu'un navigateur dit venir d'un autre site (Sec-Fetch-Site) : un formulaire ou un
// script d'un autre site ne peut pas écrire à la place de quelqu'un de connecté.
import { ErreurEdition, donneesDeClasse, donneesDeRace, enregistrer, lignesDuBestiaire, listes, lireLignes, pagesDuWiki, portraitDe } from './edition.mjs';
import { ligneSansImage } from '../src/lib/edition-modele.mjs';
import { journalExporte, lignesEnAttente } from './edition-journal.mjs';
import { chronologieVivante, donneesDEvenement, vocabulaire } from './edition-chronologie.mjs';
import {
  actualiserLancement, CONFIRMATION, enregistrerBrouillon, enregistrerMajeure, ErreurNotes, estLiberable, figerLot, leverMaintenance, libererLot, lireLot,
  lireReference, noteEnPreparation, occupe,
} from './notes-de-version.mjs';
import { ErreurFiche, controlesDe, enregistrerFiche, lireFiche, listerFiches, niveauDe, portraitDeFiche, supprimerFiche } from './fiches.mjs';
import { CHAMP_VERSION } from '../src/lib/fiche-format.mjs';
import { instant } from './instant.mjs';
import { traiterApiV1 } from './ressources.mjs';
import { BALISE, ErreurMetriques } from './metriques.mjs';
import { ErreurTables, lireTable, listerTables, versionDeLaBase, versionDuContenu } from './debug-tables.mjs';
import { ErreurClasseur } from './classeur.mjs';
import { TYPE_XLSX } from '../src/lib/google-sheets.mjs';
import { reponseVersionnee, segmentDecode } from './partage.mjs';

export const PREFIXE = '/api/';
/** Taille maximale d'un corps de requête (une fiche fait quelques kilo-octets). */
export const CORPS_MAX = 1024 * 1024;

const json = (statut, corps, entetes = {}) => ({ statut, corps, entetes });
const erreur = (statut, message, details = {}) => json(statut, { erreur: message, ...details });

/** Une écriture doit être du JSON, envoyé par une page de ce site (pas par un autre site ouvert dans le navigateur). */
function refusEcriture(entetes) {
  const type = String(entetes['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return erreur(415, 'Corps JSON attendu (Content-Type: application/json).');
  const site = String(entetes['sec-fetch-site'] ?? '').toLowerCase();
  if (site && site !== 'same-origin' && site !== 'none') return erreur(403, 'Requête refusée : elle ne vient pas d’une page de ce site.');
  return null;
}

function lireCorps(corps) {
  try {
    return { valeur: JSON.parse(corps ?? '') };
  } catch {
    return { refus: erreur(400, 'Corps JSON illisible.') };
  }
}

/** Une écriture : { valeur } = le corps JSON, ou { refus } = la réponse à rendre (mauvais type, autre site, JSON illisible). */
function lireEcriture(requete) {
  const interdit = refusEcriture(requete.entetes ?? {});
  return interdit ? { refus: interdit } : lireCorps(requete.corps);
}

/** La base vivante, ou { refus: 503 } tant qu'elle n'est pas disponible. */
function baseOuRefus(service, message) {
  const db = service.base();
  return db ? { db } : { refus: erreur(503, message, { etat: service.etat() }) };
}

/** Exécute `agir` ; une erreur métier de la classe `Erreur` devient sa réponse (statut, message, détails), toute autre remonte. */
function repondre(Erreur, agir) {
  try {
    return agir();
  } catch (e) {
    if (e instanceof Erreur) return erreur(e.statut, e.message, e.details);
    throw e;
  }
}

/** L'identifiant d'une fiche dans l'adresse, décodé ; null s'il est illisible, vide ou trop long. */
function idDeFiche(brut) {
  const id = segmentDecode(brut);
  return id && id.length <= 200 ? id : null;
}

/**
 * @param {{ methode: string, chemin: string, recherche?: string, entetes: Record<string, string>, corps?: string }} requete chemin (« /api/… »), avec
 *   ou sans sa chaîne de requête (« ?q=… », sinon dans `recherche`)
 * @param {{ base: () => import('node:sqlite').DatabaseSync | null, etat: () => object, journal?: (message: string, options?: object) => void,
 *   journalDuService?: { lire: (filtres: object) => object } }} service
 * @returns {{ statut: number, corps: object, entetes: Record<string, string> } | Promise<object>} la réponse ; une promesse de réponse pour
 *   POST /api/classeur/ seulement (requete.signal : le visiteur est parti ; service.classeur : serveur/classeur.mjs#creerClasseurEnLigne)
 */
export function traiter(requete, service) {
  const { methode, entetes = {} } = requete;
  const separation = requete.chemin.indexOf('?');
  const chemin = separation >= 0 ? requete.chemin.slice(0, separation) : requete.chemin;
  const params = new URLSearchParams(requete.recherche ?? (separation >= 0 ? requete.chemin.slice(separation) : ''));
  if (!chemin.startsWith(PREFIXE)) return erreur(404, 'Adresse inconnue.');
  const morceaux = chemin.slice(PREFIXE.length).split('/');
  if (morceaux.at(-1) === '') morceaux.pop(); // « /api/personnages/ » = « /api/personnages »
  const [ressource, brut, ...reste] = morceaux;
  const permis = (...methodes) => (methodes.includes(methode) ? null : json(405, { erreur: `Méthode ${methode} non permise ici.` }, { Allow: methodes.join(', ') }));

  if (ressource === 'etat' && brut === undefined) return permis('GET') ?? json(200, service.etat());
  if (ressource === 'maintenance') return traiterMaintenance(requete, service, brut, reste, permis);
  if (ressource === 'edition') return traiterEdition(requete, service, brut, reste, permis);
  if (ressource === 'mise-a-jour') return traiterMiseAJour(requete, service, brut, reste, permis);
  if (ressource === 'v1') return traiterApiV1(requete, service, { segments: morceaux.slice(1), params, refusEcriture });
  if (ressource === 'debug') return traiterDebug(requete, service, brut, reste, permis, params);
  if (ressource === 'metriques') return traiterMetriques(requete, service, brut, reste, permis);
  if (ressource === 'classeur') return traiterClasseur(requete, service, brut, reste, permis);
  if (ressource !== 'personnages') return erreur(404, 'Adresse inconnue.');
  if (reste.length) return reste.length === 1 && reste[0] === 'portrait' && brut !== undefined ? traiterPortrait(requete, service, brut, permis) : erreur(404, 'Adresse inconnue.');

  let id = null;
  if (brut !== undefined) {
    id = idDeFiche(brut);
    if (id === null) return erreur(404, 'Fiche introuvable.');
  }
  const refus = id === null ? permis('GET', 'POST') : permis('GET', 'PUT', 'DELETE');
  if (refus) return refus;

  const { db, refus: indisponible } = baseOuRefus(service, 'La base des fiches n’est pas disponible pour le moment.');
  if (indisponible) return indisponible;

  if (methode === 'GET') {
    if (id === null) return json(200, { personnages: listerFiches(db) });
    const personnage = lireFiche(db, id);
    if (!personnage) return erreur(404, 'Fiche introuvable.');
    return json(200, { personnage, controles: controlesDe(db, id), niveau: niveauDe(db, id) });
  }

  const { valeur, refus: interdit } = lireEcriture(requete);
  if (interdit) return interdit;
  return repondre(ErreurFiche, () => {
    const t0 = performance.now();
    if (methode === 'DELETE') {
      supprimerFiche(db, id, valeur?.[CHAMP_VERSION]);
      service.journal?.(`suppression du prétiré ${id}`);
      // métriques : l'écriture et sa durée, jamais l'identifiant de la fiche
      service.evenement?.('fiche', { duree_ms: performance.now() - t0, detail: { action: 'suppression' } });
      return json(200, { supprime: id });
    }
    const resultat = enregistrerFiche(db, valeur, { id });
    service.journal?.(`${id === null ? 'création' : 'modification'} du prétiré ${resultat.personnage.id}`);
    service.evenement?.('fiche', { duree_ms: performance.now() - t0, detail: { action: id === null ? 'creation' : 'modification' } });
    if (id === null) return json(201, resultat, { Location: `${PREFIXE}personnages/${encodeURIComponent(resultat.personnage.id)}/` });
    return json(200, resultat);
  });
}

/**
 * GET /api/personnages/<id>/portrait/ : l'image du portrait d'un prétiré, telle quelle (la liste des personnages n'en reçoit que l'empreinte). Le
 * navigateur la garde et la redemande avec son empreinte (ETag, If-None-Match) : 304 tant qu'elle n'a pas changé. 404 sans fiche ou sans portrait.
 */
function traiterPortrait(requete, service, brut, permis) {
  const refus = permis('GET');
  if (refus) return refus;
  const id = idDeFiche(brut);
  if (id === null) return erreur(404, 'Fiche introuvable.');
  const { db, refus: indisponible } = baseOuRefus(service, 'La base des fiches n’est pas disponible pour le moment.');
  if (indisponible) return indisponible;
  const portrait = portraitDeFiche(db, id);
  if (!portrait) return erreur(404, 'Pas de portrait pour cette fiche.');
  return reponseVersionnee(requete.entetes, portrait.empreinte, (cache) => {
    const octets = portrait.octets();
    if (!octets) return erreur(404, 'Pas de portrait pour cette fiche.');
    return { statut: 200, corps: null, brut: octets, entetes: { ...cache, 'Content-Type': portrait.type } };
  });
}

/**
 * L'en-tête Content-Disposition d'un classeur : le nom en ASCII (repli), puis en entier (RFC 5987). Rendu bien formé d'abord (toWellFormed : une
 * demi-paire de substitution seule devient « � ») : encodeURIComponent lèverait une URIError, que le service changerait en 500.
 */
function pieceJointe(brut) {
  const nom = String(brut).toWellFormed();
  const ascii = nom.replace(/[^\x20-\x7e]|["\\]/gu, '_'); // un caractère, un « _ » (un emoji aussi : mode u)
  const encode = encodeURIComponent(nom).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encode}`;
}

/**
 * POST /api/classeur/ { url } (« Importer (en ligne) » de /fiche/) : la feuille Google Sheets d'un lien partagé, au format .xlsx (ses octets, pas du
 * JSON), téléchargée par serveur/classeur.mjs (bornes de taille, de délai et de débit, redirections vérifiées). Sur les deux instances, sans la base
 * (répond pendant qu'elle se refait). Même garde que les écritures (JSON, page de ce site). Rend une PROMESSE (la seule route asynchrone).
 */
function traiterClasseur(requete, service, brut, reste, permis) {
  if (brut !== undefined || reste.length) return erreur(404, 'Adresse inconnue.');
  const refus = permis('POST');
  if (refus) return refus;
  const { valeur, refus: interdit } = lireEcriture(requete);
  if (interdit) return interdit;
  if (!service.classeur) return erreur(503, 'L’import en ligne n’est pas disponible sur ce service.');
  return service.classeur.telecharger(valeur?.url, { signal: requete.signal ?? null }).then(
    ({ octets, nom }) => ({ statut: 200, corps: null, brut: octets, entetes: { 'Content-Type': TYPE_XLSX, 'Content-Disposition': pieceJointe(nom) } }),
    (e) => {
      if (e instanceof ErreurClasseur) return erreur(e.statut, e.message);
      throw e;
    },
  );
}

/** Les routes /api/edition/… (site de dev seulement). */
function traiterEdition(requete, service, action, reste, permis) {
  if (!service.edition) return erreur(403, 'L’édition des règles n’est ouverte que sur le site de dev.');
  if (reste.length || !['en-attente', 'lignes', 'listes', 'pages', 'mots-cles', 'chronologie', 'journal', 'race', 'classe', 'bestiaire', 'portrait', 'evenement', undefined].includes(action)) {
    return erreur(404, 'Adresse inconnue.');
  }
  const refus = action === undefined || ['lignes', 'race', 'classe', 'bestiaire', 'portrait', 'evenement'].includes(action) ? permis('POST') : permis('GET');
  if (refus) return refus;
  const { db, refus: indisponible } = baseOuRefus(service, 'La base n’est pas disponible pour le moment.');
  if (indisponible) return indisponible;

  if (action === 'en-attente') return json(200, { lignes: lignesEnAttente(db).map((l) => ({ ...l, ligne: ligneSansImage(l.table, l.ligne) })) });
  if (action === 'listes') return json(200, listes(db));
  if (action === 'pages') return json(200, { pages: pagesDuWiki(db) });
  if (action === 'mots-cles') return json(200, { motsCles: vocabulaire(db) });
  if (action === 'chronologie') return json(200, chronologieVivante(db));
  if (action === 'journal') {
    const jour = new Date().toISOString().slice(0, 10);
    return json(200, journalExporte(db), { 'Content-Disposition': `attachment; filename="journal-edition-${jour}.json"` });
  }
  const { valeur, refus: interdit } = lireEcriture(requete);
  if (interdit) return interdit;
  return repondre(ErreurEdition, () => {
    if (action === 'lignes') return json(200, { lignes: lireLignes(db, valeur?.lignes) });
    if (action === 'race') return json(200, donneesDeRace(db, valeur?.race));
    if (action === 'classe') return json(200, donneesDeClasse(db, valeur?.classe));
    if (action === 'bestiaire') return json(200, lignesDuBestiaire(db, valeur));
    if (action === 'portrait') return json(200, portraitDe(db, valeur));
    if (action === 'evenement') {
      const donnees = donneesDEvenement(db, valeur?.evenement);
      return donnees ? json(200, donnees) : erreur(404, `Événement introuvable : ${valeur?.evenement}`);
    }
    const t0 = performance.now();
    const resultat = enregistrer(db, valeur);
    // les fiches dont le lot a retiré un élément supprimé (R42) : un compte, jamais leurs noms (le journal du service n'est pas la réponse)
    const adaptees = resultat.fiches?.length ? ` ; ${resultat.fiches.length} fiche(s) de personnage adaptée(s)` : '';
    if (resultat.lot) service.journal?.(`édition : lot ${resultat.lot} (${resultat.modifications} ligne(s)) depuis ${valeur.page ?? '?'}${adaptees}`);
    service.evenement?.('lot_edition', {
      duree_ms: performance.now() - t0,
      detail: { lot: resultat.lot ?? null, operations: Array.isArray(valeur?.operations) ? valeur.operations.length : null, modifications: resultat.modifications ?? 0,
        page: typeof valeur?.page === 'string' ? valeur.page.slice(0, 200) : null, fiches_adaptees: resultat.fiches?.length ?? 0 },
    });
    return json(200, resultat);
  });
}

/** Les paramètres d'adresse nommés : leur première valeur, s'ils sont donnés. */
function parametres(params, noms) {
  const o = {};
  for (const nom of noms) if (params.has(nom)) o[nom] = params.get(nom);
  return o;
}

/**
 * Les routes /api/debug/… (page Debug, site de dev seulement ; 403 ailleurs, avant tout 404 et 405) :
 *   GET /api/debug/journal/ : les entrées du journal du service gardé en mémoire qui suivent ?depuis=<n>, filtrées (?niveau=, ?categorie= : une
 *     valeur, « a,b » ou répétée ; ?q= ; ?limite= ; ?min_ms=) — journal-du-service.mjs#lire, tel quel ;
 *   GET /api/debug/metriques/, …/requetes/, …/export/ et /api/debug/systeme/ : les métriques (serveur/metriques.mjs) ;
 *   GET /api/debug/tables/ et /api/debug/tables/<nom>/ : le contenu des tables de la base vivante, en lecture seule, toutes les tables et vues
 *     (serveur/debug-tables.mjs) ; le contenu d'une table porte son ETag (versionDuContenu : l'empreinte du JSON du corps) et répond 304 sans corps
 *     à un If-None-Match qui la contient ;
 *   GET /api/debug/base/ : { version } de la base vivante (debug-tables.mjs#versionDeLaBase), Cache-Control: no-store.
 * En production, tout répond 403 : c'est la base du serveur de prod qui reste fermée (décisions du propriétaire du 2026-10-15).
 */
function traiterDebug(requete, service, action, reste, permis, params) {
  if (!service.edition) {
    const quoi = action === 'journal' ? 'Le journal du service ne se lit'
      : action === 'tables' ? 'Le contenu des tables ne se lit'
        : action === 'base' ? 'La version de la base ne se lit' : 'Les métriques ne se lisent';
    // décision du propriétaire (2026-10-15) : en production, la base ne s'ouvre que par les pages du site
    return erreur(403, `${quoi} que sur le site de dev (page Debug).`);
  }
  const metriques = action === 'metriques' && (!reste.length || (reste.length === 1 && ['requetes', 'export'].includes(reste[0])));
  const tables = action === 'tables' && reste.length <= 1;
  const base = action === 'base' && !reste.length;
  if (!(action === 'journal' && !reste.length) && !metriques && !(action === 'systeme' && !reste.length) && !tables && !base) return erreur(404, 'Adresse inconnue.');
  const refus = permis('GET');
  if (refus) return refus;
  if (tables || base) {
    const { db, refus: indisponible } = baseOuRefus(service, 'La base n’est pas disponible pour le moment.');
    if (indisponible) return indisponible;
    // la relève de la page (toutes les 2 s, menu « DB » ouvert) : jamais gardée par un cache
    if (base) return json(200, { version: versionDeLaBase(db) }, { 'Cache-Control': 'no-store' });
    return repondre(ErreurTables, () => {
      if (!reste.length) return json(200, { tables: listerTables(db) });
      const page = lireTable(db, reste[0], params);
      // le texte servi tel quel (`brut`) : son empreinte est l'ETag, le service ne le refait pas ; `corps` reste pour qui appelle `traiter` (tests)
      const texte = JSON.stringify(page);
      return reponseVersionnee(requete.entetes, versionDuContenu(texte), (cache) => ({ statut: 200, corps: page, brut: texte, entetes: cache }), 'no-cache');
    });
  }
  if (action === 'journal') {
    if (!service.journalDuService) return erreur(503, 'Le journal du service n’est pas disponible.');
    const filtres = {};
    for (const nom of ['depuis', 'niveau', 'categorie', 'q', 'limite', 'min_ms']) {
      const valeurs = params.getAll(nom);
      if (valeurs.length) filtres[nom] = valeurs.length > 1 ? valeurs : valeurs[0];
    }
    return json(200, service.journalDuService.lire(filtres));
  }
  if (!service.metriques) return erreur(503, 'Les métriques ne sont pas disponibles sur ce service.');
  return repondre(ErreurMetriques, () => {
    if (action === 'systeme') return json(200, service.metriques.systeme(parametres(params, ['instance', 'periode'])));
    if (!reste.length) return json(200, service.metriques.lire(parametres(params, ['instance', 'periode', 'tri'])));
    if (reste[0] === 'requetes') return json(200, service.metriques.requetes(parametres(params, ['limite', 'route', 'route_exacte', 'min_ms', 'statut'])));
    const e = service.metriques.exporter(parametres(params, ['instance', 'periode', 'format']));
    // X-Export-Tronque : l'export s'est arrêté aux EXPORT_LIGNES_MAX lignes les plus récentes
    const entetes = { 'Content-Type': e.type, 'Content-Disposition': `attachment; filename="${e.nom}"`, ...(e.tronque ? { 'X-Export-Tronque': '1' } : {}) };
    return { statut: 200, corps: null, brut: e.contenu, entetes };
  });
}

/**
 * POST /api/metriques/page/ : la balise d'une page vue (navigator.sendBeacon), sur les deux instances (décision du propriétaire du 2026-10-15) ;
 * MAVERICK_METRIQUES_PAGES=0 la ferme (403). Corps JSON de BALISE.octets_max au plus, en application/json ou text/plain (ce qu'envoie sendBeacon avec
 * une chaîne), d'une page de ce site : Sec-Fetch-Site same-origin quand le navigateur le donne ; sans lui (navigateur sans Fetch Metadata), un en-tête
 * Origin d'un autre hôte que la requête est refusé (memeOrigine : un POST text/plain est une requête « simple », qu'une page tierce peut envoyer sans
 * requête préalable). Rien n'est écrit dans la base vivante : la mesure va aux agrégats de la base des métriques de CETTE instance
 * (serveur/metriques.mjs#recevoirPage). → 204 sans corps.
 */
function traiterMetriques(requete, service, action, reste, permis) {
  if (action !== 'page' || reste.length) return erreur(404, 'Adresse inconnue.');
  const refus = permis('POST');
  if (refus) return refus;
  if (!service.metriques) return erreur(503, 'Les métriques ne sont pas disponibles sur ce service.');
  if (!service.metriques.pagesOuvertes) return erreur(403, 'La mesure des pages est fermée sur ce serveur (MAVERICK_METRIQUES_PAGES=0).');
  const entetes = requete.entetes ?? {};
  const type = String(entetes['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json' && type !== 'text/plain') return erreur(415, 'Corps JSON attendu (Content-Type: application/json ou text/plain).');
  const site = String(entetes['sec-fetch-site'] ?? '').toLowerCase();
  if (site ? site !== 'same-origin' : !memeOrigine(entetes)) return erreur(403, 'Requête refusée : elle ne vient pas d’une page de ce site.');
  if (Buffer.byteLength(String(requete.corps ?? '')) > BALISE.octets_max) return erreur(413, `Mesure trop volumineuse (${BALISE.octets_max} octets au plus).`);
  const { valeur, refus: illisible } = lireCorps(requete.corps);
  if (illisible) return illisible;
  return repondre(ErreurMetriques, () => {
    service.metriques.recevoirPage(valeur, entetes);
    return { statut: 204, corps: null, entetes: {} };
  });
}

/**
 * Vrai si l'en-tête Origin est absent (un outil, un vieux navigateur sur une requête du même site) ou désigne l'hôte de la requête
 * (X-Forwarded-Host derrière le mandataire, sinon Host) ; « null » (page sans origine : fichier, cadre isolé) ou un autre hôte : faux.
 */
export function memeOrigine(entetes) {
  const origine = entetes.origin;
  if (origine === undefined || origine === '') return true;
  const hote = String(entetes['x-forwarded-host'] ?? entetes.host ?? '').split(',')[0].trim().toLowerCase();
  try {
    return Boolean(hote) && new URL(String(origine)).host.toLowerCase() === hote;
  } catch {
    return false;
  }
}

const sansMaintenance = { active: false };

/**
 * Les routes /api/maintenance/… : l'état de maintenance de ce serveur (lu par chaque page du site, sans la base : il répond même pendant qu'elle
 * se refait), et « Lever la maintenance » sur le site de dev.
 */
function traiterMaintenance(requete, service, action, reste, permis) {
  if (reste.length || ![undefined, 'lever'].includes(action)) return erreur(404, 'Adresse inconnue.');
  if (action === undefined) return permis('GET') ?? json(200, service.maintenance?.() ?? sansMaintenance);
  const refus = permis('POST');
  if (refus) return refus;
  if (!service.edition) return erreur(403, 'La maintenance ne se lève que depuis le site de dev.');
  const { valeur, refus: interdit } = lireEcriture(requete);
  if (interdit) return interdit;
  return repondre(ErreurNotes, () => {
    const lancement = leverMaintenance(service.dossier, { lot: valeur?.lot, instant: instant() });
    service.journal?.(`maintenance levée depuis la page (lot ${lancement.lot})`);
    service.evenement?.('maintenance', { detail: { action: 'levee', lot: lancement.lot } });
    return json(200, service.maintenance?.() ?? sansMaintenance);
  });
}

/** L'adresse publique du site (le workflow GitHub y télécharge le lot figé) : MAVERICK_ADRESSE_PUBLIQUE, sinon d'après la requête. */
function adressePublique(service, entetes) {
  if (service.adresse) return String(service.adresse).replace(/\/+$/, '');
  const hote = String(entetes['x-forwarded-host'] ?? entetes.host ?? '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(hote)) return null;
  // derrière Caddy (TLS) puis nginx, la requête arrive en http : un hôte public se joint en https
  const local = /^(localhost|127\.|\[::1\])/.test(hote);
  return `${local ? String(entetes['x-forwarded-proto'] ?? 'http').split(',')[0].trim() : 'https'}://${hote}`;
}

/** Les routes /api/mise-a-jour/… (site de dev seulement). */
function traiterMiseAJour(requete, service, action, reste, permis) {
  if (!service.edition) return erreur(403, 'La page Mise à jour ne se prépare que sur le site de dev.');
  if (action === 'lots') {
    if (reste.length !== 1) return erreur(404, 'Adresse inconnue.');
    const refus = permis('GET');
    if (refus) return refus;
    if (!/^[0-9a-f-]{36}$/.test(reste[0])) return erreur(404, 'Lot introuvable.');
    // seul le lot du lancement actuel, toujours en jeu, est servi : un lot annulé, remplacé ou de simulation finie ne peut plus être livré
    const lot = lireLot(service.dossier, reste[0]);
    return lot === null ? erreur(410, 'Lot introuvable, annulé ou remplacé : il ne peut plus être livré.') : { statut: 200, corps: null, brut: lot, entetes: {} };
  }
  if (reste.length || ![undefined, 'brouillon', 'majeure', 'lancer', 'liberer', 'lancement'].includes(action)) return erreur(404, 'Adresse inconnue.');
  const refus = action === undefined || action === 'lancement' ? permis('GET') : permis('POST');
  if (refus) return refus;
  const { db, refus: indisponible } = baseOuRefus(service, 'La base n’est pas disponible pour le moment.');
  if (indisponible) return indisponible;
  const versionDev = service.etat().version ?? null;
  const github = { configure: Boolean(service.github?.configure()), depot: service.depot ?? null };
  const maintenant = instant();
  if (action === undefined || action === 'lancement') {
    service.github?.suivre().catch(() => {}); // en arrière-plan : la réponse suivante aura l'état à jour
    const lancement = actualiserLancement(db, service.dossier, { reference: lireReference(service.reference) });
    // mêmes règles que le service pour la page : annulable, et place occupée (un nouveau lancement serait refusé)
    const regles = { liberable: estLiberable(lancement, maintenant), occupe: occupe(lancement, maintenant) };
    if (action === 'lancement') return json(200, { lancement, ...regles, github });
    return json(200, { ...noteEnPreparation(db, { reference: service.reference, versionDev }), lancement, ...regles, github, confirmation: CONFIRMATION });
  }
  const interdit = refusEcriture(requete.entetes ?? {});
  if (interdit) return interdit;
  const { valeur, refus: illisible } = lireCorps(requete.corps);
  if (illisible) return illisible;
  try {
    if (action === 'brouillon') return json(200, { brouillon: enregistrerBrouillon(db, valeur ?? {}, { instant: maintenant }) });
    if (action === 'majeure') {
      // la case « Version majeure » : rien n'est déclenché, seule la note en préparation change de version cible (rendue entière pour la page)
      const brouillon = enregistrerMajeure(db, valeur ?? {});
      service.journal?.(`mise à jour : prochaine version ${brouillon.majeure ? 'majeure' : 'mineure'}`);
      return json(200, noteEnPreparation(db, { reference: service.reference, versionDev }));
    }
    if (action === 'liberer') {
      // `lot` : le lancement que la page affiche (un onglet périmé n'annule pas le suivant) ; le run éventuel est annulé sur GitHub
      const lancement = libererLot(db, service.dossier, { instant: maintenant, lot: valeur?.lot, annulerRun: service.github?.annulerRun ?? null });
      service.evenement?.('mise_a_jour', { detail: { etape: 'liberer', lot: lancement?.lot ?? null, etat: lancement?.etat ?? null } });
      service.maintenance?.(); // annulé : l'annonce de maintenance est retirée tout de suite (les deux serveurs rouvrent)
      return json(200, { lancement, liberable: estLiberable(lancement, maintenant), occupe: occupe(lancement, maintenant) });
    }
    const t0 = performance.now();
    const note = noteEnPreparation(db, { reference: service.reference, versionDev });
    // la version que la page a montrée (et confirmée) doit être celle qui partirait : la case « Version majeure » cochée ou décochée depuis un
    // autre onglet (ou une nouvelle version de master) ne fait jamais partir une autre version que celle qu'on a vue
    if (valeur?.version_cible !== undefined && valeur.version_cible !== note.version_cible) {
      return erreur(409, `La version en préparation est maintenant la V${note.version_cible} (la page montrait la V${valeur.version_cible}) : rechargez la page.`, { version_cible: note.version_cible });
    }
    // sans jeton GitHub sur ce serveur : le lot est figé quand même, la page dit comment lancer le workflow à la main
    const lancement = figerLot(db, service.dossier, {
      versionDev, versionCible: note.version_cible, instant: maintenant, confirmation: valeur?.confirmation, adresse: adressePublique(service, requete.entetes ?? {}),
      etat: github.configure ? 'envoi' : 'manuel', simulation: valeur?.simulation === true, aLivrer: note.lignes ? note.lignes.length : null,
      ...(service.limites ? { limites: service.limites } : {}),
    });
    service.journal?.(`${lancement.simulation ? 'simulation de mise à jour' : 'mise à jour'} : lot ${lancement.lot} figé (${lancement.modifications} modification(s), V${note.version_cible})`);
    service.evenement?.('mise_a_jour', {
      duree_ms: performance.now() - t0,
      detail: { etape: 'figer', lot: lancement.lot, simulation: Boolean(lancement.simulation), modifications: lancement.modifications ?? null, version_cible: note.version_cible ?? null, etat: lancement.etat },
    });
    // vraie mise à jour : l'annonce de maintenance part tout de suite (les deux serveurs passent en maintenance), et suit le déclenchement
    service.maintenance?.();
    if (github.configure) service.github.declencher().then(() => service.maintenance?.()).catch(() => {});
    return json(202, { lancement, github });
  } catch (e) {
    if (e instanceof ErreurNotes) return erreur(e.statut, e.message, e.details);
    throw e;
  }
}
