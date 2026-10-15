// Métriques du service (demande du propriétaire, 2026-10-15 : « isole les informations de temps de réponse. Ainsi on aura de la métrique pour voir
// quels sont les appels les plus lents en moyenne. Le but est d'extraire absolument tout ce qui est possible d'extraire dans un but de suivi,
// maintenance et évolutions. Si une question de volume se pose par contre, préviens-moi » ; puis « deux jeux de données séparés entre la prod et le
// dev » et « Active-le aussi en prod dans un premier temps » ; docs/serveur.md, « Métriques et volume »).
//
// UNE BASE SQLITE PAR INSTANCE, distincte de la base vivante (jamais dans data/rows ni dans le journal de l'édition) : <dossier>/<instance>.db, le
// dossier étant MAVERICK_DOSSIER_METRIQUES (le même pour les deux instances sur le VPS, comme celui de la maintenance), sinon <db>/metriques/ ; instance
// = « dev » quand l'édition est ouverte, « prod » sinon (MAVERICK_INSTANCE la nomme autrement). Chaque instance n'écrit QUE son fichier ; le site de dev
// lit aussi celui de la production, en lecture seule, pour l'afficher (page Debug : l'un OU l'autre, jamais mélangés).
//
// Ce qui est mesuré (les deux instances, en mémoire bornée, sans une écriture par requête) :
//   - chaque requête /api/ : méthode, route normalisée (routeNormalisee : un gabarit sans identifiant ni chaîne de requête), statut, durée totale et
//     phases (lecture du corps, traitement, envoi ; performance.now), octets reçus et envoyés (corps), requêtes SQL (nombre, temps, la plus lente :
//     serveur/metriques-sql.mjs), 304, page d'origine (chemin du Referer du même site), famille de navigateur et appareil (navigateurDe ; le
//     User-Agent n'est pas gardé), requêtes simultanées ;
//   - chaque minute : mémoire (RSS, tas, externe), délai de la boucle d'événements (p50, p99, max), CPU, charge, disque libre du dossier de la base
//     vivante, tailles (base vivante et son WAL, archives/, mise-a-jour/, métriques), requêtes en cours, entrées du journal ;
//   - toutes les 10 minutes : la répartition du disque par type de données (demande du propriétaire du 2026-10-15 : « la place occupée sur le serveur
//     sur la place totale sous forme de jauge, colorée en fonction du type de données ») — REPARTITION, releverRepartition, repartitionDu : base de
//     données, images importées, mises à jour, métriques, code, données, images et autres fichiers du site, système et autres, réservé au système
//     (la réserve de root, à part : « occupé » = Used de df), libre ; la somme fait exactement la taille du disque (statfs du dossier de la base
//     vivante) ; le parcours des fichiers est mis en cache 10 minutes et borné (PARCOURS) ;
//     sur le VPS, le relevé de l'hôte (deploy/vps/volume.sh → volume-hote.json du dossier des métriques, toutes les 15 minutes : lireReleveDeLHote)
//     y ajoute ce que le conteneur ne voit pas — Docker, journaux, installations (REPARTITION_HOTE) et l'autre instance ;
//   - les évènements du service avec leur durée (démarrage, base vivante, rejeu du journal, lots d'édition, mise à jour, appels GitHub, maintenance,
//     erreurs 5xx avec l'empreinte de leur pile, purge) ;
//   - les pages vues mesurées par le navigateur (POST /api/metriques/page/ : temps jusqu'au premier octet, DOMContentLoaded, chargement, LCP), ouverte
//     sur les deux instances (décision du propriétaire), fermée par MAVERICK_METRIQUES_PAGES=0.
// JAMAIS : adresse IP, corps, chaîne de requête, identifiant de fiche, Authorization ou cookie, User-Agent entier.
//
// Agrégats persistés (tables ci-dessous) : par heure × route × méthode (et par tranche de 5 minutes, gardée 2 jours, pour la période « 1h ») : n,
// erreurs 4xx et 5xx, 304, somme et somme des carrés, min, max, histogramme à bornes fixes (BORNES_MS) d'où sortent les quantiles (quantileDetaille :
// interpolation linéaire dans la classe, jamais dans la dernière, sans borne haute : une borne basse marquée `au_dela`), octets, requêtes et temps
// SQL, la requête SQL la plus lente ; pages vues par heure × page (histogrammes à leurs propres bornes : BORNES_PAGE_MS) ; navigateurs et origines
// par heure. Versement : une transaction par minute (et à l'arrêt). Rétention : RETENTION, purge et VACUUM incrémental une fois par jour.
// Cardinalité bornée quel que soit le trafic, même fabriqué : routes = gabarits du code (routeNormalisee), refus avant tout traitement (403, 405)
// regroupés par premier segment (routeGardee) ; pages = celles du site construit (pagesDuSite), PAGES_PAR_HEURE et ORIGINES_PAR_HEURE par heure ;
// et un plafond dur (PLAFOND_METRIQUES_OCTETS, ou disque bas) au-delà duquel la collecte est restreinte. Les lectures lourdes sont classées et
// coupées par SQLite (LIGNES_LUES_MAX) et gardées CACHE_LECTURE_MS ; l'export s'arrête à EXPORT_LIGNES_MAX lignes.
// Requêtes brutes : jamais persistées par défaut (les CAPACITE_REQUETES dernières en mémoire, site de dev) ; MAVERICK_METRIQUES_BRUTES=1 les garde
// 30 jours (environ 145 octets chacune : 1,4 Mo par jour pour 10 000 requêtes).
//
// Volume (mesuré le 2026-10-15 avec le vrai collecteur, une minute simulée après l'autre ; docs/serveur.md, « Volume estimé des métriques ») : il
// suit le nombre de routes et surtout de PAGES DISTINCTES vues par heure (page_heure, origine_heure), pas le nombre de requêtes. Trois chiffres
// (volume) : ce qui s'écrit par jour (purgé vite compris : échantillons par minute ~140 Ko par jour gardés 14 jours, agrégats de 5 minutes), la
// croissance en régime (estimée sur les tables gardées un an ou plus, ou mesurée sur la TAILLE LOGIQUE de la base, jamais sur le WAL), la taille
// dans un an et à rétention pleine (table par table). Par instance : 1 000 requêtes par jour (20 routes, 40 pages) ~0,28 Mo écrits et ~57 Ko de
// croissance par jour, ~25 Mo à 400 jours ; 20 000 (40 routes, 100 pages) ~0,36 Mo par jour, ~150 Mo ; 50 000 (40 routes, 400 pages) ~1,2 Mo par
// jour : le plafond vers le 9ᵉ mois. Une alerte prévient au-delà de 200 Mio, mesurés ou attendus à rétention pleine.
//
// Une panne de la base des métriques (disque plein, fichier verrouillé, dossier absent) ne fait jamais échouer une requête ni le démarrage : elle est
// notée une fois au journal (« ERREUR métriques : … »), la collecte continue en mémoire (bornée : MAX_EN_ATTENTE) et le versement suivant réessaie.
// Node seulement (node:sqlite, node:perf_hooks…), sans dépendance ; le registre des ressources (pur) donne les routes de /api/v1/, le modèle de
// l'édition et le format des fiches les colonnes d'image de la base vivante (octetsDesImages).
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statfsSync, statSync } from 'node:fs';
import { loadavg, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { colonnesImage, TABLES } from '../src/lib/edition-modele.mjs';
import { TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { RESSOURCES } from '../src/lib/ressources.mjs';

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Bornes hautes (ms) des classes de l'histogramme des durées ; une dernière classe va au-delà de 5 000 ms (+∞). Fixes : les agrégats s'additionnent. */
export const BORNES_MS = Object.freeze([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]);
/** Nombre de classes de l'histogramme (les bornes, plus +∞). */
export const CLASSES = BORNES_MS.length + 1;
/**
 * Bornes hautes (ms) de l'histogramme des temps d'une page vue (premier octet, DOMContentLoaded, chargement, LCP : de quelques dizaines de ms à
 * plusieurs secondes sur téléphone ; 2 500 et 4 000 : les seuils du LCP) ; une dernière classe va au-delà de 60 000 ms (la balise s'arrête à 120 000).
 */
export const BORNES_PAGE_MS = Object.freeze([10, 20, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 60000]);
/** Nombre de classes de l'histogramme d'une page vue. */
export const CLASSES_PAGE = BORNES_PAGE_MS.length + 1;

/** Rétention, en jours (purge une fois par jour). */
export const RETENTION = Object.freeze({
  agregats_heure: 400, // requêtes par heure × route × méthode
  agregats_5min: 2, // requêtes par tranche de 5 minutes × route × méthode (période « 1h » et sa série)
  pages: 400, // pages vues mesurées par le navigateur, par heure × page
  navigateurs: 400, // familles de navigateur et appareils, par heure
  origines: 400, // page d'origine × route, par heure
  echantillons_minute: 14, // échantillons système par minute…
  echantillons_heure: 400, // … puis résumés par heure
  repartition_10min: 14, // répartition du disque, toutes les 10 minutes…
  repartition_jour: 400, // … puis la dernière de chaque jour
  evenements: 400,
  requetes_brutes: 30, // seulement si MAVERICK_METRIQUES_BRUTES=1
});

/** Versement des agrégats dans la base : une fois par minute (et à l'arrêt). */
export const INTERVALLE_VERSEMENT = 60_000;
/** Purge (rétention) et VACUUM incrémental : une fois par jour. */
export const INTERVALLE_PURGE = 86_400_000;
/** Requêtes gardées en mémoire, une à une (site de dev : GET /api/debug/metriques/requetes/). */
export const CAPACITE_REQUETES = 2000;
/** Bornes de la mémoire tant que la base ne reçoit rien (panne) : au-delà, les plus anciennes entrées sont perdues (comptées). */
export const MAX_EN_ATTENTE = Object.freeze({
  agregats: 20_000, pages: 20_000, navigateurs: 5_000, origines: 20_000, minutes: 2_880, repartitions: 288, evenements: 2_000, brutes: 50_000,
});
/**
 * Pages distinctes gardées par heure (balise ; et, à part, pages d'origine du Referer) : au-delà, « {autres} ». Une page n'est d'ailleurs gardée
 * que si le site construit l'a (pagesDuSite, pageDuSite : sinon « {autres} »), quand le service connaît son dossier.
 */
export const PAGES_PAR_HEURE = 300;
/** Couples (page d'origine, route) gardés par heure : au-delà, la page devient « {autres} ». */
export const ORIGINES_PAR_HEURE = 1000;
/** La page (ou l'origine) qui regroupe tout ce qui dépasse une borne, n'est pas une page du site, ou arrive pendant la restriction. */
export const PAGE_AUTRES = '{autres}';
/**
 * Plafond dur de la base des métriques d'une instance (fichier + WAL) : au-delà — ou quand le disque n'a plus que SEUILS.disque_libre_octets libres
 * — la collecte est RESTREINTE : plus aucune nouvelle page ni page d'origine (tout va dans « {autres} »), plus de requêtes brutes ; les agrégats des
 * routes continuent (leur nombre est borné par le code : routeNormalisee, routeGardee ; en production, ~80 lignes par heure au pire, ~9 Mio par
 * mois). Un évènement et une alerte le disent ; la restriction se lève d'elle-même quand la purge repasse sous le plafond. Avec la rétention, la
 * base ne dépasse donc le plafond que de ce que ces routes ajoutent, quel que soit le trafic (même fabriqué).
 */
export const PLAFOND_METRIQUES_OCTETS = 300 * 1024 ** 2;
/** Lignes au plus d'un export (les plus récentes ; au-delà, l'export le dit : `tronque`). */
export const EXPORT_LIGNES_MAX = 100_000;
/**
 * Les lectures lourdes (période de 7 jours ou plus, ou fichier de l'autre instance) sont gardées CACHE_LECTURE_MS (par instance et période) : une
 * page Debug ouverte, ou des appels répétés, ne refont pas le calcul plus d'une fois par minute.
 */
export const CACHE_LECTURE_MS = 60_000;
/** Balise des pages : corps de 2 Kio au plus, valeurs de 0 à 120 000 ms, 600 balises par minute au plus (toutes pages confondues). */
export const BALISE = Object.freeze({ octets_max: 2048, ms_max: 120_000, par_minute: 600, page_max: 200 });
/** Les mesures d'une page vue envoyées par le navigateur. */
export const MESURES_PAGE = Object.freeze(['ttfb', 'dom', 'charge', 'lcp']);
/** Périodes de lecture : durée en secondes (« tout » : depuis la première donnée) et pas de la série. */
export const PERIODES = Object.freeze({
  '1h': { duree: 3600, pas: 300, table: 'cinq' },
  '24h': { duree: 86_400, pas: 3600, table: 'heure' },
  '7j': { duree: 7 * 86_400, pas: 3600, table: 'heure' },
  '30j': { duree: 30 * 86_400, pas: 86_400, table: 'heure' },
  '365j': { duree: 365 * 86_400, pas: 86_400, table: 'heure' },
  tout: { duree: null, pas: 86_400, table: 'heure' },
});
/** Tris de la liste des routes (décroissants). */
export const TRIS = Object.freeze(['moyenne', 'mediane', 'p95', 'p99', 'max', 'n', 'erreurs', 'total', 'sql']);
/** Seuils des alertes de GET /api/debug/systeme/. */
export const SEUILS = Object.freeze({
  disque_part_libre: 0.10,
  disque_libre_octets: 2 * 1024 ** 3,
  disque_part_libre_grave: 0.05,
  disque_libre_octets_grave: 1024 ** 3,
  base_metriques_octets: 200 * 1024 ** 2,
  archives_croissance_part: 0.25,
  archives_croissance_octets: 50 * 1024 ** 2,
  boucle_p99_ms: 100,
  memoire_part: 0.8,
});
/**
 * Version du schéma de la base des métriques (PRAGMA user_version) ; 2 : table disque_repartition (créée dans une base plus ancienne à l'ouverture) ;
 * 3 : sa colonne `reserve` (la réserve de root, ajoutée à l'ouverture d'une base plus ancienne ; absente, la réserve reste dans « Système et autres ») ;
 * 4 : histogrammes des pages vues à leurs propres bornes (BORNES_PAGE_MS : colonnes `<mesure>_c<i>` de page_heure, refaite à l'ouverture d'une base
 * plus ancienne : migrerPagesVues), taille logique de la base des métriques (systeme_minute.taille_logique, systeme_heure.taille_logique_max :
 * croissance mesurée sans le WAL) et octets des images de la base vivante (disque_repartition.images_base : lus par l'autre instance).
 */
export const SCHEMA_METRIQUES = 4;

/**
 * La répartition du disque (GET /api/debug/systeme/, `disque.repartition` ; demande du propriétaire du 2026-10-15 : « la métrique de la place
 * occupée sur le serveur sur la place totale sous forme de jauge, colorée en fonction du type de données (DB, Code, Import images, etc.) ») : les
 * catégories, dans l'ordre de la jauge (clés figées : la page Debug en tire ses couleurs).
 *   base          base vivante (+ -wal, -shm) et archives/ de ses anciennes versions (fiches comprises), moins les images qu'elle contient
 *   images        octets des colonnes d'image de la base vivante (portraits des prétirés et du bestiaire : octetsDesImages) et portraits publiés du site
 *   mises-a-jour  lots figés de la page « Mise à jour » (db/mise-a-jour/)
 *   metriques     le dossier des métriques (les fichiers des deux instances quand il est partagé)
 *   site-code     _serveur/ (le service livré), .html, .js, .mjs, .css, .json (hors données) et .map du site
 *   site-donnees  donnees/ du site hors pages (.db des règles et de la production, reference.json), index de recherche, règles de la fiche
 *   site-images   .png .webp .jpg .jpeg .gif .svg .ico .avif hors portraits
 *   site-autres   le reste du site (polices, textes…)
 *   (docker, journaux, installations : REPARTITION_HOTE, seulement avec le relevé de l'hôte, juste avant « autres »)
 *   autres        « Système et autres » : la place prise que rien de ce qui précède n'explique — système, et sans relevé de l'hôte Docker et ses
 *                 journaux, l'autre instance, les autres fichiers de db/
 *   reserve       « Réservé au système » : les blocs libres que le système de fichiers garde pour root (statfs : bfree − bavail ; ext4 : 5 % par
 *                 défaut), ni pris ni disponibles pour le service — à part, pour que « occupé » soit la place prise de `df` (Used) et « libre » sa
 *                 place disponible (Avail)
 *   libre         la place libre pour le service (statfs : blocs disponibles), la même que `disque.libre`
 */
export const REPARTITION = Object.freeze([
  { cle: 'base', libelle: 'Base de données' },
  { cle: 'images', libelle: 'Images importées' },
  { cle: 'mises-a-jour', libelle: 'Mises à jour' },
  { cle: 'metriques', libelle: 'Métriques' },
  { cle: 'site-code', libelle: 'Code du site' },
  { cle: 'site-donnees', libelle: 'Données du site' },
  { cle: 'site-images', libelle: 'Images du site' },
  { cle: 'site-autres', libelle: 'Autres fichiers du site' },
  { cle: 'autres', libelle: 'Système et autres' },
  { cle: 'reserve', libelle: 'Réservé au système' },
  { cle: 'libre', libelle: 'Libre' },
].map((c) => Object.freeze(c)));
/** Les catégories que le disque donne (statfs), sans compter de fichiers : « Système et autres » (le reste), la réserve de root et le libre. */
const CATEGORIES_DU_DISQUE = 3;
/** Les catégories comptées fichier par fichier (toutes sauf « autres », « reserve » et « libre », qui se déduisent du disque). */
export const CATEGORIES_COMPTEES = Object.freeze(REPARTITION.slice(0, -CATEGORIES_DU_DISQUE).map((c) => c.cle));
/**
 * Les catégories que seul l'hôte voit (relevé de deploy/vps/volume.sh, `volume-hote.json` du dossier des métriques : lireReleveDeLHote), rangées
 * juste avant « Système et autres » ; présentes dans la répartition seulement quand un relevé de l'hôte est pris en compte (sinon leur place reste
 * dans « Système et autres » : jamais un « 0 » qui ferait croire à un disque sans Docker ni journaux).
 *   docker         le dossier de Docker (images, conteneurs, volumes), moins les journaux des conteneurs
 *   journaux       journaux des conteneurs (docker logs), /var/log (journal de systemd, Caddy), journaux des scripts des instances
 *   installations  restes d'une installation (.installation.*, .db.copie.*), téléchargements des mises à jour, installateurs copiés à la main
 */
export const REPARTITION_HOTE = Object.freeze([
  { cle: 'docker', libelle: 'Docker (images et conteneurs)' },
  { cle: 'journaux', libelle: 'Journaux' },
  { cle: 'installations', libelle: 'Installations et copies' },
].map((c) => Object.freeze(c)));
/** Les clés de REPARTITION_HOTE. */
export const CATEGORIES_HOTE = Object.freeze(REPARTITION_HOTE.map((c) => c.cle));
/**
 * Le relevé de l'hôte (deploy/vps/volume.sh, toutes les 15 minutes) : `fichier` dans le dossier des métriques ; périmé au-delà de `perime_ms` (le
 * minuteur ne tourne plus) ; ignoré si le disque qu'il décrit n'a pas la taille de celui du service (à `ecart_total` près : un autre disque).
 */
export const RELEVE_HOTE = Object.freeze({ fichier: 'volume-hote.json', format: 1, perime_ms: 3_600_000, ecart_total: 0.01 });
/**
 * Les éléments du relevé de l'hôte que le service de l'instance mesure déjà lui-même (base vivante, archives, lots de mise à jour, site : chemins
 * écrits par volume.sh) : pour sa propre instance, ils ne sont pas repris (les images de sa base y sont séparées, à l'octet près).
 */
const DEJA_MESURES_PAR_LE_SERVICE = /\/db\/vivante\.db$|\/db\/archives$|\/db\/mise-a-jour$|\/site$/;
/**
 * Parcours des fichiers de la répartition : au plus une fois toutes les 10 minutes (le résultat est gardé), arrêté après `fichiers_max` fichiers ou
 * `duree_max_ms` (le reste tombe dans « Système et autres », et une alerte le dit) ; les liens symboliques ne sont jamais suivis. Le site construit
 * compte environ 1 800 fichiers : quelques dizaines de ms.
 */
export const PARCOURS = Object.freeze({ intervalle_ms: 600_000, fichiers_max: 50_000, duree_max_ms: 1_000 });
/** Extensions des images du site. */
const EXTENSIONS_IMAGES = new Set(['png', 'webp', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'avif']);
/** Extensions du code du site. */
const EXTENSIONS_CODE = new Set(['html', 'js', 'mjs', 'cjs', 'css', 'json', 'map']);
/** Résolution du moniteur de la boucle d'événements (ms) : Node mesure l'intervalle entre deux réveils, la résolution en est retirée. */
const RESOLUTION_BOUCLE = 20;

/** Erreur d'une lecture des métriques : statut HTTP et message en français. */
export class ErreurMetriques extends Error {
  constructor(statut, message) {
    super(message);
    this.name = 'ErreurMetriques';
    this.statut = statut;
    this.details = {};
  }
}

const arrondi = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const iso = (secondes) => new Date(secondes * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const isoMs = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const tranche = (secondes, pas) => Math.floor(secondes / pas) * pas;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Routes normalisées
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** La route d'une adresse que le service ne connaît pas (toutes, quel que soit le chemin) : la cardinalité reste bornée. */
export const ROUTE_INCONNUE = '/api/{inconnue}';
/** Méthodes gardées telles quelles ; toute autre devient « AUTRE ». */
export const METHODES = Object.freeze(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

const ACTIONS_EDITION = new Set(['en-attente', 'lignes', 'listes', 'pages', 'mots-cles', 'chronologie', 'journal', 'race', 'classe', 'bestiaire', 'portrait', 'evenement']);
const ACTIONS_MISE_A_JOUR = new Set(['brouillon', 'lancer', 'liberer', 'lancement']);
const V1 = new Map(RESSOURCES.map((r) => [r.cle, { enfants: new Set((r.enfants ?? []).map((e) => e.cle)), actions: new Set((r.actions ?? []).map((a) => a.cle)) }]));

/** La méthode HTTP gardée : l'une de METHODES, sinon « AUTRE ». */
export function methodeNormalisee(methode) {
  const m = String(methode ?? '').toUpperCase();
  return METHODES.includes(m) ? m : 'AUTRE';
}

/** Le chemin d'une adresse, sans sa chaîne de requête ni son fragment. */
export function cheminSeul(adresse) {
  const texte = String(adresse ?? '');
  const fin = texte.search(/[?#]/);
  return fin >= 0 ? texte.slice(0, fin) : texte;
}

/**
 * Le gabarit d'une adresse du service (api.mjs, ressources.mjs) : « /api/personnages/{id}/ », « /api/v1/metiers/{cle}/ »,
 * « /api/v1/races/{cle}/dons/{cle}/ », « /api/mise-a-jour/lots/{lot}/ »… — toujours avec la « / » finale, jamais un identifiant ni la chaîne de
 * requête. Une adresse que le service ne sert pas (ressource, sous-ressource ou action inconnue, segment de trop) : ROUTE_INCONNUE. Le nombre de
 * routes est donc borné par le code (api.mjs) et le registre (lib/ressources.mjs), quel que soit le trafic.
 */
export function routeNormalisee(adresse) {
  const chemin = cheminSeul(adresse);
  if (!chemin.startsWith('/api/')) return ROUTE_INCONNUE;
  const s = chemin.slice('/api/'.length).split('/');
  if (s.at(-1) === '') s.pop();
  if (!s.length || s.some((x) => x === '')) return ROUTE_INCONNUE;
  const [a, b, c, d] = s;
  const r = (...morceaux) => `/api/${morceaux.join('/')}/`;
  const seul = (n) => s.length === n;
  switch (a) {
    case 'etat':
      return seul(1) ? r('etat') : ROUTE_INCONNUE;
    case 'maintenance':
      if (seul(1)) return r('maintenance');
      return seul(2) && b === 'lever' ? r('maintenance', 'lever') : ROUTE_INCONNUE;
    case 'personnages':
      if (seul(1)) return r('personnages');
      if (seul(2)) return r('personnages', '{id}');
      return seul(3) && c === 'portrait' ? r('personnages', '{id}', 'portrait') : ROUTE_INCONNUE;
    case 'edition':
      if (seul(1)) return r('edition');
      return seul(2) && ACTIONS_EDITION.has(b) ? r('edition', b) : ROUTE_INCONNUE;
    case 'mise-a-jour':
      if (seul(1)) return r('mise-a-jour');
      if (b === 'lots') return seul(3) ? r('mise-a-jour', 'lots', '{lot}') : ROUTE_INCONNUE;
      return seul(2) && ACTIONS_MISE_A_JOUR.has(b) ? r('mise-a-jour', b) : ROUTE_INCONNUE;
    case 'debug':
      if (seul(2) && (b === 'journal' || b === 'systeme' || b === 'metriques' || b === 'tables' || b === 'base')) return r('debug', b);
      // le contenu d'une table (serveur/debug-tables.mjs) : un gabarit, quel que soit le nom demandé (connu ou non)
      if (seul(3) && b === 'tables') return r('debug', 'tables', '{table}');
      return seul(3) && b === 'metriques' && (c === 'requetes' || c === 'export') ? r('debug', 'metriques', c) : ROUTE_INCONNUE;
    case 'metriques':
      return seul(2) && b === 'page' ? r('metriques', 'page') : ROUTE_INCONNUE;
    case 'classeur':
      return seul(1) ? r('classeur') : ROUTE_INCONNUE;
    case 'v1': {
      if (seul(1)) return r('v1');
      if (b === 'openapi.json') return seul(2) ? '/api/v1/openapi.json' : ROUTE_INCONNUE;
      const res = V1.get(b);
      if (!res || s.length > 5) return ROUTE_INCONNUE;
      if (seul(2)) return r('v1', b);
      if (seul(3)) return r('v1', b, '{cle}');
      if (res.enfants.has(d)) return seul(4) ? r('v1', b, '{cle}', d) : r('v1', b, '{cle}', d, '{cle}');
      return seul(4) && res.actions.has(d) ? r('v1', b, '{cle}', d) : ROUTE_INCONNUE;
    }
    default:
      return ROUTE_INCONNUE;
  }
}

/**
 * Les routes que les pages relèvent sans cesse, en GET : état de maintenance (chaque page, toutes les 30 s), journal (2 s), version de la base (2 s,
 * menu « DB » de la page Debug ouvert : serveur/debug-tables.mjs#versionDeLaBase), métriques et système (30 s).
 */
const RELEVES_GET = new Set(['/api/maintenance/', '/api/debug/journal/', '/api/debug/base/', '/api/debug/metriques/', '/api/debug/metriques/requetes/', '/api/debug/systeme/']);

/**
 * Vrai pour une route × méthode de relève automatique (RELEVES_GET, et la balise des pages vues en POST) : comptée dans sa ligne du tableau des
 * routes, mais ni dans le « global » ni dans la série de la période (lire : elles feraient l'essentiel des appels et mesureraient surtout la page
 * Debug elle-même), ni, réussie, dans la mémoire des requêtes (estUnSuivi).
 */
export function estUneReleve(methode, route) {
  if (methode === 'POST') return route === '/api/metriques/page/';
  return methode === 'GET' && RELEVES_GET.has(route);
}

/** La même règle que estUneReleve, en SQL (colonnes `methode` et `route` des tables d'agrégats). */
const SQL_RELEVE = `(methode = 'POST' AND route = '/api/metriques/page/') OR (methode = 'GET' AND route IN (${[...RELEVES_GET].map((r) => `'${r}'`).join(', ')}))`;
/** Lignes au plus des listes lues (pages vues, origines) : les plus nombreuses, classées et coupées par SQLite. */
export const LIGNES_LUES_MAX = 500;

/**
 * Vrai pour une relève réussie que les pages font sans cesse (estUneReleve, statut 2xx ou 304) : comptée dans les agrégats, mais pas gardée une à
 * une dans la mémoire des requêtes (elle la noierait).
 */
export function estUnSuivi(methode, route, statut) {
  const reussi = (statut >= 200 && statut < 300) || statut === 304;
  return reussi && estUneReleve(methode, route);
}

/**
 * La route gardée pour une requête REFUSÉE avant tout traitement — 403 (en production : /api/v1/, /api/debug/, l'édition, la mise à jour… ; une
 * page d'un autre site) ou 405 (méthode que la route ne sert pas) : « /api/<premier segment>/{refusee}/ » (« /api/v1/{refusee}/ »…), la méthode
 * gardée. Sans cela, n'importe qui pourrait créer chaque heure une ligne par gabarit × méthode (331 × 8, même refusées). Les autres statuts gardent
 * leur gabarit (un 404 d'une fiche absente reste « /api/personnages/{id}/ ») ; ROUTE_INCONNUE reste elle-même.
 */
export function routeGardee(route, statut) {
  if ((statut !== 403 && statut !== 405) || route === ROUTE_INCONNUE) return route;
  const segment = /^\/api\/([^/]+)\//.exec(String(route))?.[1];
  return segment ? `/api/${segment}/{refusee}/` : ROUTE_INCONNUE;
}

/**
 * L'adresse d'une requête telle que la garde la mémoire des requêtes (site de dev) : son chemin, sans chaîne de requête ; sous /api/personnages/,
 * jamais l'identifiant d'une fiche — le gabarit de la route si elle est connue (« /api/personnages/{id}/portrait/ »), sinon
 * « /api/personnages/… » (une adresse inconnue sous les fiches).
 */
export function adresseGardee(chemin, route) {
  const c = cheminSeul(chemin);
  if (!/^\/api\/personnages\/[^/]/.test(c)) return c;
  return route.startsWith('/api/personnages/') ? route : '/api/personnages/…';
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Navigateur, page d'origine
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les appareils (sans accents : des clés). */
export const APPAREILS = Object.freeze(['ordinateur', 'telephone', 'tablette', 'robot']);

const ROBOT = /bot\b|bot\/|crawler|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pingdom|uptime|monitor/i;
const OUTIL = /^(curl|wget|python|node|undici|go-http|java|okhttp|postman|insomnia|httpie|axios|libwww|php|ruby|deno|bun|powershell)\b/i;

/**
 * La famille de navigateur et l'appareil d'un User-Agent (le texte entier n'est jamais gardé) : famille = Chrome, Edge, Firefox, Safari, Opera,
 * Samsung Internet, Robot (robots d'indexation, navigateurs sans tête), Outil (curl, Node, Python…), Autre, Inconnu (pas d'en-tête) ; appareil =
 * ordinateur, telephone, tablette ou robot (un iPad récent se dit Macintosh : compté ordinateur).
 */
export function navigateurDe(userAgent) {
  const ua = String(userAgent ?? '').slice(0, 512);
  if (!ua.trim()) return { famille: 'Inconnu', appareil: 'robot' };
  if (ROBOT.test(ua)) return { famille: 'Robot', appareil: 'robot' };
  if (OUTIL.test(ua.trim())) return { famille: 'Outil', appareil: 'robot' };
  let famille = 'Autre';
  if (/\bEdg(e|A|iOS)?\//.test(ua)) famille = 'Edge';
  else if (/\bOPR\/|\bOpera\b/.test(ua)) famille = 'Opera';
  else if (/SamsungBrowser\//.test(ua)) famille = 'Samsung Internet';
  else if (/\bFirefox\/|\bFxiOS\//.test(ua)) famille = 'Firefox';
  else if (/\bCriOS\/|\bChrome\/|\bChromium\//.test(ua)) famille = 'Chrome';
  else if (/\bSafari\//.test(ua) && /\bVersion\/|iPhone|iPad|Macintosh/.test(ua)) famille = 'Safari';
  let appareil = 'ordinateur';
  if (/iPad|Tablet|PlayBook|Silk\/|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) appareil = 'tablette';
  else if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) appareil = 'telephone';
  return { famille, appareil };
}

/** Un chemin de page du site, tel que gardé : commence par « / », sans requête ni fragment, sans blanc ni caractère de contrôle ; null sinon. */
export function cheminDePage(valeur, { couper = false } = {}) {
  if (typeof valeur !== 'string') return null;
  const chemin = cheminSeul(valeur);
  if (!chemin.startsWith('/') || chemin.startsWith('//') || /[\s\u0000-\u001f\u007f]/.test(chemin)) return null;
  if (chemin.length > BALISE.page_max) return couper ? chemin.slice(0, BALISE.page_max) : null;
  return chemin;
}

/**
 * Les pages du site construit (`site` : son dossier) : le chemin de chaque page HTML — « <dossier>/index.html » → « /<dossier>/ », « a/b.html » →
 * « /a/b/ », « /a/b » et « /a/b.html » (la page 404). null sans dossier lisible (le service ne connaît pas le site : toute page est acceptée).
 * Parcours borné (`fichiersMax`), liens symboliques jamais suivis, sans _serveur/ ni _astro/. Le service sert le site à la racine (NAS, VPS) : la
 * page qu'envoie la balise (Astro.url.pathname) et celle du Referer sont donc ces chemins mêmes.
 */
export function pagesDuSite(site, { fichiersMax = PARCOURS.fichiers_max } = {}) {
  if (!site) return null;
  const pages = new Set();
  const pile = [''];
  let restants = fichiersMax;
  let lu = false;
  while (pile.length && restants > 0) {
    const rel = pile.pop();
    let noms;
    try {
      noms = readdirSync(rel ? join(site, rel) : site, { withFileTypes: true });
      lu = true;
    } catch {
      continue;
    }
    for (const n of noms) {
      if (restants-- <= 0) break;
      const relatif = rel ? `${rel}/${n.name}` : n.name;
      if (n.isDirectory()) {
        if (!(rel === '' && (n.name === '_serveur' || n.name === '_astro'))) pile.push(relatif);
        continue;
      }
      if (!n.isFile() || !n.name.endsWith('.html')) continue;
      if (n.name === 'index.html') pages.add(rel ? `/${rel}/` : '/');
      else {
        const sans = relatif.slice(0, -'.html'.length);
        pages.add(`/${sans}/`).add(`/${sans}`).add(`/${relatif}`);
      }
    }
  }
  return lu ? pages : null;
}

/**
 * Une page gardée telle quelle si le site construit l'a (`pages` : pagesDuSite ; la « / » finale ajoutée au besoin), null sinon (elle comptera dans
 * « {autres} ») ; sans liste des pages (null), le chemin tel quel. Une page fabriquée (balise ou Referer d'un script) ne crée donc jamais de clé.
 */
export function pageDuSite(chemin, pages) {
  if (!chemin) return null;
  if (!pages) return chemin;
  if (pages.has(chemin)) return chemin;
  const avecBarre = chemin.endsWith('/') ? null : `${chemin}/`;
  return avecBarre && pages.has(avecBarre) ? avecBarre : null;
}

/** La page d'origine d'une requête : le chemin du Referer s'il vient du même site (même hôte que la requête), sinon null. */
export function pageDuReferent(referent, hote) {
  if (!referent || !hote) return null;
  try {
    const url = new URL(String(referent));
    if (url.host !== String(hote).split(',')[0].trim()) return null;
    return cheminDePage(url.pathname, { couper: true });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Histogrammes, quantiles, statistiques
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** La classe d'une durée : la première borne qui la contient (classe i = ]borne i-1, borne i]), la dernière au-delà de la dernière borne. */
export function classeDe(ms, bornes = BORNES_MS) {
  for (let i = 0; i < bornes.length; i++) if (ms <= bornes[i]) return i;
  return bornes.length;
}

/**
 * Le quantile `q` (0 à 1) d'un histogramme : { valeur, au_dela } — la classe qui contient le rang q × n, puis une interpolation linéaire dans la
 * classe, bornée par le minimum et le maximum observés. La dernière classe (au-delà de la dernière borne : ]5 000 ms, +∞[ pour les requêtes) n'a pas
 * de borne haute : on n'y interpole JAMAIS jusqu'au maximum (une seule valeur extrême ferait la médiane, le p95 et le p99) ; la valeur est alors la
 * borne basse de la classe (ou le minimum observé, s'il est plus haut) et `au_dela` vaut vrai : le quantile est « > valeur » (la page Debug l'écrit
 * ainsi), sauf si toutes les valeurs de la classe sont égales (min = max : la valeur exacte). { valeur: null } sans valeur.
 */
export function quantileDetaille(histogramme, q, min, max, bornes = BORNES_MS) {
  const n = histogramme.reduce((s, c) => s + c, 0);
  if (!n) return { valeur: null, au_dela: false };
  const derniere = bornes.length;
  // q = 0 : le minimum ; q = 1 : le maximum observé (s'il est dans la dernière classe, il est exact : c'est une valeur vue)
  if (q <= 0) return { valeur: min, au_dela: false };
  if (q >= 1) return { valeur: max, au_dela: false };
  const rang = q * n;
  let avant = 0;
  for (let i = 0; i < histogramme.length; i++) {
    const c = histogramme[i];
    if (!c) continue;
    if (avant + c >= rang) {
      const bas = Math.max(i === 0 ? 0 : bornes[i - 1], min);
      if (i >= derniere) return { valeur: Math.min(bas, max), au_dela: max > bas };
      const haut = Math.min(bornes[i], max);
      if (haut <= bas) return { valeur: Math.min(Math.max(bas, min), max), au_dela: false };
      return { valeur: bas + ((rang - avant) / c) * (haut - bas), au_dela: false };
    }
    avant += c;
  }
  return { valeur: max, au_dela: false };
}

/** La valeur seule de quantileDetaille (une borne basse quand le rang tombe dans la dernière classe). */
export function quantile(histogramme, q, min, max, bornes = BORNES_MS) {
  return quantileDetaille(histogramme, q, min, max, bornes).valeur;
}

const H = Array.from({ length: CLASSES }, (_, i) => `h${i}`);

/** Un agrégat de requêtes vide (mêmes champs que les colonnes des tables agregat_*). */
function nouvelAgregat() {
  return {
    n: 0, erreurs_4xx: 0, erreurs_5xx: 0, n_304: 0, somme_ms: 0, somme2_ms: 0, min_ms: Infinity, max_ms: -Infinity, h: new Array(CLASSES).fill(0),
    octets_entree: 0, octets_sortie: 0, sql_requetes: 0, sql_ms: 0, corps_ms: 0, traitement_ms: 0, envoi_ms: 0, sql_max_ms: null, sql_max: null,
  };
}

function ajouterRequete(a, r) {
  a.n += 1;
  if (r.statut >= 500) a.erreurs_5xx += 1;
  else if (r.statut >= 400) a.erreurs_4xx += 1;
  if (r.statut === 304) a.n_304 += 1;
  a.somme_ms += r.duree;
  a.somme2_ms += r.duree * r.duree;
  if (r.duree < a.min_ms) a.min_ms = r.duree;
  if (r.duree > a.max_ms) a.max_ms = r.duree;
  a.h[classeDe(r.duree)] += 1;
  a.octets_entree += r.octets_entree;
  a.octets_sortie += r.octets_sortie;
  a.sql_requetes += r.sql_n;
  a.sql_ms += r.sql_ms;
  a.corps_ms += r.corps;
  a.traitement_ms += r.traitement;
  a.envoi_ms += r.envoi;
  if (r.sql_lente && (a.sql_max_ms === null || r.sql_lente.ms > a.sql_max_ms)) {
    a.sql_max_ms = r.sql_lente.ms;
    a.sql_max = r.sql_lente.sql;
  }
}

/** Ajoute l'agrégat `b` à `a` (sommes, min, max, histogramme, requête SQL la plus lente). */
function fusionnerAgregats(a, b) {
  for (const k of ['n', 'erreurs_4xx', 'erreurs_5xx', 'n_304', 'somme_ms', 'somme2_ms', 'octets_entree', 'octets_sortie', 'sql_requetes', 'sql_ms', 'corps_ms', 'traitement_ms', 'envoi_ms']) a[k] += b[k] ?? 0;
  if (b.min_ms < a.min_ms) a.min_ms = b.min_ms;
  if (b.max_ms > a.max_ms) a.max_ms = b.max_ms;
  for (let i = 0; i < CLASSES; i++) a.h[i] += b.h[i] ?? 0;
  if (b.sql_max_ms !== null && b.sql_max_ms !== undefined && (a.sql_max_ms === null || b.sql_max_ms > a.sql_max_ms)) {
    a.sql_max_ms = b.sql_max_ms;
    a.sql_max = b.sql_max;
  }
  return a;
}

/**
 * Les statistiques d'un agrégat (STATS du contrat) : { n, erreurs_4xx, erreurs_5xx, part_304, moyenne_ms, mediane_ms, p95_ms, p99_ms, min_ms,
 * max_ms, ecart_type_ms, total_ms, octets_entree, octets_sortie, sql_requetes_moyen, sql_ms_moyen, phases: { corps_ms, traitement_ms, envoi_ms }
 * (moyennes), sql_plus_lente: { sql, ms } | null, au_dela: [] } ; quantiles tirés de l'histogramme, valeurs arrondies au centième ; `au_dela` : les
 * quantiles (« mediane_ms », « p95_ms », « p99_ms ») qui tombent au-delà de la dernière borne (5 000 ms) et ne sont qu'une borne basse (« > 5 000 ms » :
 * quantileDetaille).
 */
export function statistiques(a) {
  const n = a.n;
  if (!n) {
    return {
      n: 0, erreurs_4xx: 0, erreurs_5xx: 0, part_304: 0, moyenne_ms: null, mediane_ms: null, p95_ms: null, p99_ms: null, min_ms: null, max_ms: null,
      ecart_type_ms: null, total_ms: 0, octets_entree: 0, octets_sortie: 0, sql_requetes_moyen: 0, sql_ms_moyen: 0,
      phases: { corps_ms: null, traitement_ms: null, envoi_ms: null }, sql_plus_lente: null, au_dela: [],
    };
  }
  const moyenne = a.somme_ms / n;
  const quantiles = { mediane_ms: 0.5, p95_ms: 0.95, p99_ms: 0.99 };
  const q = Object.fromEntries(Object.entries(quantiles).map(([cle, x]) => [cle, quantileDetaille(a.h, x, a.min_ms, a.max_ms)]));
  return {
    n,
    erreurs_4xx: a.erreurs_4xx,
    erreurs_5xx: a.erreurs_5xx,
    part_304: Math.round((a.n_304 / n) * 10_000) / 10_000,
    moyenne_ms: arrondi(moyenne),
    mediane_ms: arrondi(q.mediane_ms.valeur),
    p95_ms: arrondi(q.p95_ms.valeur),
    p99_ms: arrondi(q.p99_ms.valeur),
    min_ms: arrondi(a.min_ms),
    max_ms: arrondi(a.max_ms),
    ecart_type_ms: arrondi(Math.sqrt(Math.max(0, a.somme2_ms / n - moyenne * moyenne))),
    total_ms: arrondi(a.somme_ms),
    octets_entree: a.octets_entree,
    octets_sortie: a.octets_sortie,
    sql_requetes_moyen: arrondi(a.sql_requetes / n),
    sql_ms_moyen: arrondi(a.sql_ms / n),
    phases: { corps_ms: arrondi(a.corps_ms / n), traitement_ms: arrondi(a.traitement_ms / n), envoi_ms: arrondi(a.envoi_ms / n) },
    sql_plus_lente: a.sql_max === null || a.sql_max === undefined ? null : { sql: a.sql_max, ms: arrondi(a.sql_max_ms) },
    au_dela: Object.keys(quantiles).filter((cle) => q[cle].au_dela),
  };
}

/** La valeur de tri d'une route (décroissant) ; les routes sans valeur viennent en dernier. */
function valeurDeTri(s, tri) {
  switch (tri) {
    case 'moyenne': return s.moyenne_ms;
    case 'mediane': return s.mediane_ms;
    case 'p95': return s.p95_ms;
    case 'p99': return s.p99_ms;
    case 'max': return s.max_ms;
    case 'n': return s.n;
    case 'erreurs': return s.erreurs_5xx * 1e9 + s.erreurs_4xx;
    case 'total': return s.total_ms;
    case 'sql': return s.sql_ms_moyen;
    default: return s.moyenne_ms;
  }
}

/** Une mesure de page vide (même forme pour les quatre mesures de MESURES_PAGE ; histogramme à BORNES_PAGE_MS). */
const nouvelleMesure = () => ({ n: 0, somme: 0, somme2: 0, min: Infinity, max: -Infinity, h: new Array(CLASSES_PAGE).fill(0) });
function ajouterMesure(m, v) {
  m.n += 1;
  m.somme += v;
  m.somme2 += v * v;
  if (v < m.min) m.min = v;
  if (v > m.max) m.max = v;
  m.h[classeDe(v, BORNES_PAGE_MS)] += 1;
}
function fusionnerMesures(a, b) {
  a.n += b.n;
  a.somme += b.somme;
  a.somme2 += b.somme2;
  if (b.min < a.min) a.min = b.min;
  if (b.max > a.max) a.max = b.max;
  for (let i = 0; i < CLASSES_PAGE; i++) a.h[i] += b.h[i] ?? 0;
}
const nouvellePage = () => ({ n: 0, ...Object.fromEntries(MESURES_PAGE.map((m) => [m, nouvelleMesure()])) });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Schéma de la base des métriques
// ---------------------------------------------------------------------------------------------------------------------------------------------

const COLONNES_SOMMES = ['n', 'erreurs_4xx', 'erreurs_5xx', 'n_304', 'somme_ms', 'somme2_ms', ...H, 'octets_entree', 'octets_sortie', 'sql_requetes', 'sql_ms', 'corps_ms', 'traitement_ms', 'envoi_ms'];
const TYPE_AGREGAT = (c) => (/_ms$/.test(c) ? 'REAL' : 'INTEGER');
const tableAgregat = (nom) => `CREATE TABLE IF NOT EXISTS ${nom} (
  debut INTEGER NOT NULL, route TEXT NOT NULL, methode TEXT NOT NULL,
  ${COLONNES_SOMMES.map((c) => `${c} ${TYPE_AGREGAT(c)} NOT NULL DEFAULT 0`).join(', ')},
  min_ms REAL NOT NULL, max_ms REAL NOT NULL, sql_max_ms REAL, sql_max_id INTEGER,
  PRIMARY KEY (debut, route, methode)) STRICT, WITHOUT ROWID;`;
/** Les classes de l'histogramme d'une page vue (BORNES_PAGE_MS) : colonnes `<mesure>_c0` à `<mesure>_c21` (schéma 4 ; avant : `_h0` à `_h12`, aux bornes des requêtes). */
const HP = Array.from({ length: CLASSES_PAGE }, (_, i) => `c${i}`);
const COLONNES_PAGE = MESURES_PAGE.flatMap((m) => [`${m}_n`, `${m}_somme`, `${m}_somme2`, `${m}_min`, `${m}_max`, ...HP.map((h) => `${m}_${h}`)]);
const TYPE_PAGE = (c) => (/_(somme2?|min|max)$/.test(c) ? 'REAL' : 'INTEGER');
const COLONNES_MINUTE = [
  'rss', 'tas_utilise', 'tas_total', 'externe', 'boucle_p50_ms', 'boucle_p99_ms', 'boucle_max_ms', 'cpu_utilisateur_pct', 'cpu_systeme_pct',
  'charge_1', 'charge_5', 'charge_15', 'duree_s', 'en_cours', 'simultanees_max', 'requetes', 'erreurs_5xx', 'journal_entrees', 'disque_libre',
  'disque_total', 'taille_vivante', 'taille_archives', 'taille_mise_a_jour', 'taille_metriques',
  // schéma 4 : la taille logique de la base des métriques ((page_count − freelist_count) × page_size), sans le WAL : sa croissance mesurée
  'taille_logique',
];
const REEL_MINUTE = new Set(['boucle_p50_ms', 'boucle_p99_ms', 'boucle_max_ms', 'cpu_utilisateur_pct', 'cpu_systeme_pct', 'charge_1', 'charge_5', 'charge_15']);
const COLONNES_BRUTES = [
  'instant_ms', 'methode', 'route', 'statut', 'duree_ms', 'corps_ms', 'traitement_ms', 'envoi_ms', 'octets_entree', 'octets_sortie', 'sql_requetes',
  'sql_ms', 'sql_lente_id', 'sql_lente_ms', 'page', 'navigateur', 'appareil', 'simultanees',
];

/** Le schéma (créé s'il manque ; une base neuve est d'abord passée en auto_vacuum INCREMENTAL, puis en WAL). */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT) STRICT, WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS sql_texte (id INTEGER PRIMARY KEY, texte TEXT NOT NULL UNIQUE) STRICT;
${tableAgregat('agregat_heure')}
${tableAgregat('agregat_5min')}
CREATE TABLE IF NOT EXISTS page_heure (debut INTEGER NOT NULL, page TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
  ${COLONNES_PAGE.map((c) => `${c} ${TYPE_PAGE(c)}`).join(', ')}, PRIMARY KEY (debut, page)) STRICT, WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS navigateur_heure (debut INTEGER NOT NULL, famille TEXT NOT NULL, appareil TEXT NOT NULL,
  requetes INTEGER NOT NULL DEFAULT 0, pages INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (debut, famille, appareil)) STRICT, WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS origine_heure (debut INTEGER NOT NULL, page TEXT NOT NULL, route TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (debut, page, route)) STRICT, WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS systeme_minute (instant INTEGER PRIMARY KEY, ${COLONNES_MINUTE.map((c) => `${c} ${REEL_MINUTE.has(c) ? 'REAL' : 'INTEGER'}`).join(', ')}) STRICT;
CREATE TABLE IF NOT EXISTS systeme_heure (debut INTEGER PRIMARY KEY, echantillons INTEGER NOT NULL, rss_moyen REAL, rss_max INTEGER,
  tas_utilise_moyen REAL, tas_utilise_max INTEGER, boucle_p99_moyen_ms REAL, boucle_p99_max_ms REAL, boucle_max_ms REAL, cpu_moyen_pct REAL,
  cpu_max_pct REAL, charge_1_moyenne REAL, en_cours_max INTEGER, simultanees_max INTEGER, requetes INTEGER, erreurs_5xx INTEGER,
  disque_libre_min INTEGER, disque_total INTEGER, taille_vivante_max INTEGER, taille_archives_max INTEGER, taille_mise_a_jour_max INTEGER,
  taille_metriques_max INTEGER, taille_logique_max INTEGER) STRICT;
CREATE TABLE IF NOT EXISTS disque_repartition (instant INTEGER PRIMARY KEY, total INTEGER NOT NULL, libre INTEGER NOT NULL, comptes TEXT NOT NULL,
  partiel INTEGER NOT NULL DEFAULT 0, reserve INTEGER, images_base INTEGER) STRICT;
CREATE TABLE IF NOT EXISTS evenement (id INTEGER PRIMARY KEY, instant_ms INTEGER NOT NULL, type TEXT NOT NULL, duree_ms REAL, detail TEXT) STRICT;
CREATE INDEX IF NOT EXISTS evenement_instant ON evenement (instant_ms);
CREATE TABLE IF NOT EXISTS requete_brute (id INTEGER PRIMARY KEY, instant_ms INTEGER NOT NULL, methode TEXT NOT NULL, route TEXT NOT NULL,
  statut INTEGER NOT NULL, duree_ms REAL NOT NULL, corps_ms REAL, traitement_ms REAL, envoi_ms REAL, octets_entree INTEGER, octets_sortie INTEGER,
  sql_requetes INTEGER, sql_ms REAL, sql_lente_id INTEGER, sql_lente_ms REAL, page TEXT, navigateur TEXT, appareil TEXT, simultanees INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS requete_brute_instant ON requete_brute (instant_ms);
`;

/** Les tables et leur colonne de temps (secondes, sauf `_ms`) : purge, estimation du volume. */
const TABLES_DATEES = Object.freeze([
  { table: 'agregat_heure', colonne: 'debut', retention: 'agregats_heure' },
  { table: 'agregat_5min', colonne: 'debut', retention: 'agregats_5min' },
  { table: 'page_heure', colonne: 'debut', retention: 'pages' },
  { table: 'navigateur_heure', colonne: 'debut', retention: 'navigateurs' },
  { table: 'origine_heure', colonne: 'debut', retention: 'origines' },
  { table: 'systeme_minute', colonne: 'instant', retention: 'echantillons_minute' },
  { table: 'systeme_heure', colonne: 'debut', retention: 'echantillons_heure' },
  // toutes les 10 minutes pendant 14 jours (purger : la dernière de chaque jour reste au-delà), puis 400 jours
  { table: 'disque_repartition', colonne: 'instant', retention: 'repartition_jour' },
  { table: 'evenement', colonne: 'instant_ms', retention: 'evenements', ms: true },
  { table: 'requete_brute', colonne: 'instant_ms', retention: 'requetes_brutes', ms: true },
]);

function upsertAgregat(table) {
  const colonnes = ['debut', 'route', 'methode', ...COLONNES_SOMMES, 'min_ms', 'max_ms', 'sql_max_ms', 'sql_max_id'];
  const plusLente = 'excluded.sql_max_ms IS NOT NULL AND (sql_max_ms IS NULL OR excluded.sql_max_ms > sql_max_ms)';
  return `INSERT INTO ${table} (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})
    ON CONFLICT (debut, route, methode) DO UPDATE SET ${COLONNES_SOMMES.map((c) => `${c} = ${c} + excluded.${c}`).join(', ')},
    min_ms = min(min_ms, excluded.min_ms), max_ms = max(max_ms, excluded.max_ms),
    sql_max_id = CASE WHEN ${plusLente} THEN excluded.sql_max_id ELSE sql_max_id END,
    sql_max_ms = CASE WHEN ${plusLente} THEN excluded.sql_max_ms ELSE sql_max_ms END`;
}

/**
 * L'écriture d'un échantillon par minute (systeme_minute, clé : la seconde) : un second échantillon de la même seconde (arrêt du service juste après
 * la minute) s'ajoute au premier — requêtes, erreurs 5xx et entrées du journal additionnées, simultanées au plus haut — et prend sa place pour le
 * reste (l'état le plus récent) : ni requête ni erreur perdue (résumé par heure, alerte des 5xx de la dernière heure).
 */
function instructionMinute() {
  const additionnees = new Set(['requetes', 'erreurs_5xx', 'journal_entrees']);
  const maj = COLONNES_MINUTE.map((c) => {
    if (additionnees.has(c)) return `${c} = coalesce(${c}, 0) + coalesce(excluded.${c}, 0)`;
    if (c === 'simultanees_max') return `${c} = max(coalesce(${c}, 0), coalesce(excluded.${c}, 0))`;
    return `${c} = excluded.${c}`;
  });
  return `INSERT INTO systeme_minute (instant, ${COLONNES_MINUTE.join(', ')}) VALUES (?, ${COLONNES_MINUTE.map(() => '?').join(', ')})
    ON CONFLICT (instant) DO UPDATE SET ${maj.join(', ')}`;
}

function upsertPage() {
  const colonnes = ['debut', 'page', 'n', ...COLONNES_PAGE];
  const maj = ['n = n + excluded.n'];
  for (const m of MESURES_PAGE) {
    maj.push(`${m}_n = coalesce(${m}_n, 0) + coalesce(excluded.${m}_n, 0)`, `${m}_somme = coalesce(${m}_somme, 0) + coalesce(excluded.${m}_somme, 0)`,
      `${m}_somme2 = coalesce(${m}_somme2, 0) + coalesce(excluded.${m}_somme2, 0)`, `${m}_min = min(coalesce(${m}_min, excluded.${m}_min), coalesce(excluded.${m}_min, ${m}_min))`,
      `${m}_max = max(coalesce(${m}_max, excluded.${m}_max), coalesce(excluded.${m}_max, ${m}_max))`, ...HP.map((h) => `${m}_${h} = coalesce(${m}_${h}, 0) + coalesce(excluded.${m}_${h}, 0)`));
  }
  return `INSERT INTO page_heure (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')}) ON CONFLICT (debut, page) DO UPDATE SET ${maj.join(', ')}`;
}

/** Lecture groupée d'une table d'agrégats : les sommes, min, max et l'histogramme, par les colonnes données. */
const SOMMES_AGREGAT = [...COLONNES_SOMMES.map((c) => `sum(${c}) AS ${c}`), 'min(min_ms) AS min_ms', 'max(max_ms) AS max_ms'].join(', ');

/** Un agrégat d'après une ligne lue (colonnes h0…h12 → h). */
function agregatDeLigne(l) {
  const a = nouvelAgregat();
  for (const c of COLONNES_SOMMES) if (!/^h\d+$/.test(c)) a[c] = Number(l[c] ?? 0);
  a.h = H.map((h) => Number(l[h] ?? 0));
  a.min_ms = l.min_ms ?? Infinity;
  a.max_ms = l.max_ms ?? -Infinity;
  return a;
}

/** Une mesure de page d'après une ligne lue. */
function mesureDeLigne(l, m) {
  const r = nouvelleMesure();
  r.n = Number(l[`${m}_n`] ?? 0);
  r.somme = Number(l[`${m}_somme`] ?? 0);
  r.somme2 = Number(l[`${m}_somme2`] ?? 0);
  r.min = l[`${m}_min`] ?? Infinity;
  r.max = l[`${m}_max`] ?? -Infinity;
  r.h = HP.map((h) => Number(l[`${m}_${h}`] ?? 0));
  return r;
}

const SOMMES_PAGE = ['sum(n) AS n', ...MESURES_PAGE.flatMap((m) => [`sum(${m}_n) AS ${m}_n`, `sum(${m}_somme) AS ${m}_somme`, `sum(${m}_somme2) AS ${m}_somme2`,
  `min(${m}_min) AS ${m}_min`, `max(${m}_max) AS ${m}_max`, ...HP.map((h) => `sum(${m}_${h}) AS ${m}_${h}`)])].join(', ');
/** La même lecture sur une table page_heure d'avant le schéma 4 (fichier de l'autre instance, en lecture seule) : sans les histogrammes. */
const SOMMES_PAGE_SANS_HISTOGRAMME = ['sum(n) AS n', ...MESURES_PAGE.flatMap((m) => [`sum(${m}_n) AS ${m}_n`, `sum(${m}_somme) AS ${m}_somme`,
  `sum(${m}_somme2) AS ${m}_somme2`, `min(${m}_min) AS ${m}_min`, `max(${m}_max) AS ${m}_max`])].join(', ');

/** L'expression SQL de la classe d'une valeur (`expression`) parmi `bornes` (0 à bornes.length). */
const classeSql = (expression, bornes) => `CASE ${bornes.map((b, i) => `WHEN ${expression} <= ${b} THEN ${i}`).join(' ')} ELSE ${bornes.length} END`;

/**
 * Migration du schéma 4 (une base plus ancienne, à l'ouverture) : page_heure est refaite avec les histogrammes à BORNES_PAGE_MS. Chaque ligne garde
 * son nombre de vues, ses sommes, son minimum et son maximum (les moyennes restent exactes) ; une classe ancienne (bornes des requêtes) contenue
 * dans une nouvelle y est reportée telle quelle ; une classe ancienne plus large que les nouvelles (]200, 500], ]500, 1 000], ]1 000, 2 000],
 * ]2 000, 5 000], ]5 000, +∞[) l'est dans la nouvelle classe qui contient la plus petite de sa borne haute et du maximum observé de la ligne :
 * une estimation par excès, jamais au-delà de ce qui a été mesuré. Dans une transaction ; rien si la table est déjà au schéma 4.
 */
function migrerPagesVues(d) {
  const colonnes = new Set(d.prepare('PRAGMA table_info(page_heure)').all().map((c) => c.name));
  if (colonnes.has(`${MESURES_PAGE[0]}_c0`) || !colonnes.has(`${MESURES_PAGE[0]}_h0`)) return false;
  const anciennes = BORNES_MS.length + 1;
  const expressions = MESURES_PAGE.flatMap((m) => {
    const parClasse = HP.map(() => []);
    for (let i = 0; i < anciennes; i++) {
      const bas = i === 0 ? 0 : BORNES_MS[i - 1];
      const haut = i < BORNES_MS.length ? BORNES_MS[i] : Infinity;
      // k : la nouvelle classe des valeurs juste au-dessus de la borne basse ; j : celle de la borne haute (la dernière pour ]5 000, +∞[)
      const k = classeDe(bas + 1e-9, BORNES_PAGE_MS);
      const j = haut === Infinity ? CLASSES_PAGE - 1 : classeDe(haut, BORNES_PAGE_MS);
      const ancienne = `coalesce(${m}_h${i}, 0)`;
      if (j === k) parClasse[j].push(ancienne);
      else {
        const cible = haut === Infinity ? `coalesce(${m}_max, ${bas + 1})` : `min(${haut}, coalesce(${m}_max, ${haut}))`;
        const classe = classeSql(`max(${bas + 1e-6}, ${cible})`, BORNES_PAGE_MS);
        for (let x = k; x <= j; x++) parClasse[x].push(`CASE WHEN ${classe} = ${x} THEN ${ancienne} ELSE 0 END`);
      }
    }
    return [`${m}_n`, `${m}_somme`, `${m}_somme2`, `${m}_min`, `${m}_max`, ...parClasse.map((termes) => (termes.length ? termes.join(' + ') : '0'))];
  });
  d.exec('BEGIN IMMEDIATE');
  try {
    d.exec(`CREATE TABLE page_heure_schema_4 (debut INTEGER NOT NULL, page TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
      ${COLONNES_PAGE.map((c) => `${c} ${TYPE_PAGE(c)}`).join(', ')}, PRIMARY KEY (debut, page)) STRICT, WITHOUT ROWID`);
    d.exec(`INSERT INTO page_heure_schema_4 (debut, page, n, ${COLONNES_PAGE.join(', ')}) SELECT debut, page, n, ${expressions.join(', ')} FROM page_heure`);
    d.exec('DROP TABLE page_heure');
    d.exec('ALTER TABLE page_heure_schema_4 RENAME TO page_heure');
    d.exec('COMMIT');
  } catch (e) {
    try {
      d.exec('ROLLBACK');
    } catch {
      // déjà annulée
    }
    throw e;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Système : disque, tailles, mémoire
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Taille d'un fichier (0 s'il n'existe pas). */
function tailleFichier(chemin) {
  try {
    return statSync(chemin).size;
  } catch {
    return 0;
  }
}

/** Taille d'un dossier : ses fichiers et ceux de ses sous-dossiers (deux niveaux au plus) ; 0 s'il n'existe pas. */
export function tailleDossier(chemin, profondeur = 2) {
  let total = 0;
  let noms;
  try {
    noms = readdirSync(chemin, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const n of noms) {
    const c = join(chemin, n.name);
    if (n.isFile()) total += tailleFichier(c);
    else if (n.isDirectory() && profondeur > 0) total += tailleDossier(c, profondeur - 1);
  }
  return total;
}

/**
 * Le disque d'un dossier : { dossier, libre, total, utilise, reserve, part_libre } (statfs : `libre` = place disponible pour le service, `reserve` =
 * blocs libres gardés pour root ; total = utilise + reserve + libre) ; null si illisible.
 */
export function disqueDe(dossier) {
  if (!dossier) return null;
  try {
    const s = statfsSync(dossier);
    const total = s.blocks * s.bsize;
    const libre = s.bavail * s.bsize;
    return {
      dossier, libre, total, utilise: total - s.bfree * s.bsize, reserve: Math.max(0, (s.bfree - s.bavail) * s.bsize),
      part_libre: total ? Math.round((libre / total) * 10_000) / 10_000 : null,
    };
  } catch {
    return null;
  }
}

/** Les octets qu'un fichier occupe sur le disque : ses blocs alloués (st_blocks × 512) quand le système les donne, sinon sa taille (Windows). */
export function octetsSurDisque(stat) {
  if (!stat) return 0;
  return Number.isFinite(stat.blocks) && stat.blocks > 0 ? stat.blocks * 512 : Number(stat.size) || 0;
}

/**
 * La catégorie d'un fichier du site construit (REPARTITION), d'après son chemin relatif au dossier du site (« / » comme séparateur) :
 * _serveur/… → site-code ; une image sous un dossier « portraits » (bestiaire/portraits/<empreinte>.webp : lib/portraits-publies.mjs) → images
 * (importées) ; donnees/ hors pages .html, un .db, search-index.json, fiche/regles.json → site-donnees ; une autre image → site-images ; .html, .js,
 * .mjs, .cjs, .css, .json, .map → site-code ; le reste → site-autres.
 */
export function categorieDuFichierDuSite(relatif) {
  const chemin = String(relatif ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (chemin.startsWith('_serveur/')) return 'site-code';
  const nomFichier = chemin.slice(chemin.lastIndexOf('/') + 1);
  const point = nomFichier.lastIndexOf('.');
  const extension = point > 0 ? nomFichier.slice(point + 1).toLowerCase() : '';
  if (EXTENSIONS_IMAGES.has(extension) && /(^|\/)portraits\//.test(chemin)) return 'images';
  if ((chemin.startsWith('donnees/') && extension !== 'html') || extension === 'db' || nomFichier === 'search-index.json' || chemin === 'fiche/regles.json') return 'site-donnees';
  if (EXTENSIONS_IMAGES.has(extension)) return 'site-images';
  if (EXTENSIONS_CODE.has(extension)) return 'site-code';
  return 'site-autres';
}

/**
 * Parcourt un dossier sans jamais suivre un lien symbolique : `compter(relatif, octets)` pour chaque fichier ordinaire (relatif avec « / »), et
 * `compterDossier(octets)` pour chaque dossier lu, la racine comprise (les blocs d'un dossier lui-même : comme `du`, et comme deploy/vps/volume.sh,
 * pour que les deux mesures tombent à l'octet près).
 * `borne` = { fichiers (restants), fin (performance.now() limite), exclus (dossiers absolus à sauter : déjà comptés ailleurs), partiel } est partagée
 * par les parcours d'un même relevé ; une borne atteinte arrête le parcours et pose `partiel`.
 */
function parcourir(racine, compter, borne, compterDossier = () => {}) {
  const pile = [''];
  while (pile.length) {
    const rel = pile.pop();
    const dossier = rel ? join(racine, rel) : racine;
    let noms;
    try {
      noms = readdirSync(dossier, { withFileTypes: true });
      compterDossier(octetsSurDisque(lstatSync(dossier)));
    } catch {
      continue; // absent ou illisible
    }
    for (const n of noms) {
      if (borne.fichiers <= 0 || performance.now() > borne.fin) {
        borne.partiel = true;
        return;
      }
      const relatif = rel ? `${rel}/${n.name}` : n.name;
      const absolu = join(racine, relatif);
      if (n.isDirectory()) {
        if (!borne.exclus.has(resolve(absolu))) pile.push(relatif);
        continue;
      }
      if (!n.isFile()) continue; // lien symbolique (jamais suivi), socket, tube…
      borne.fichiers -= 1;
      try {
        compter(relatif, octetsSurDisque(lstatSync(absolu)));
      } catch {
        // disparu entre la lecture du dossier et la mesure
      }
    }
  }
}

/**
 * Le relevé des catégories comptées de la répartition du disque (CATEGORIES_COMPTEES) : base vivante (+ -wal, -shm) et archives/ moins les images
 * qu'elle contient (`imagesDeLaBase`, octets : octetsDesImages), images (celles-ci + les portraits publiés du site), lots de mise à jour, dossier des
 * métriques, fichiers du site (categorieDuFichierDuSite). Un dossier déjà compté n'est pas recompté sous un autre (ni db/ s'il était dans le site).
 * Octets alloués sur le disque (octetsSurDisque), les blocs des dossiers eux-mêmes compris (avec leur contenu ; ceux du site avec ses autres
 * fichiers), comme `du` et deploy/vps/volume.sh. Rend { comptes: { cle: octets }, partiel, fichiers (nombre mesuré), duree_ms,
 * images_base (les images de la base vivante comptées, sans les portraits publiés du site) }. Jamais d'exception.
 * @param {{ vivante?: string|null, archives?: string|null, miseAJour?: string|null, metriques?: string|null, site?: string|null,
 *   imagesDeLaBase?: number, bornes?: typeof PARCOURS }} o
 */
export function releverRepartition({ vivante = null, archives = null, miseAJour = null, metriques = null, site = null, imagesDeLaBase = 0, bornes = PARCOURS } = {}) {
  const t0 = performance.now();
  const comptes = Object.fromEntries(CATEGORIES_COMPTEES.map((c) => [c, 0]));
  const exclus = new Set([archives, miseAJour, metriques, vivante ? dirname(vivante) : null].filter(Boolean).map((d) => resolve(d)));
  const borne = { fichiers: bornes.fichiers_max, fin: t0 + bornes.duree_max_ms, exclus, partiel: false };
  const octetsDe = (chemin) => {
    try {
      return octetsSurDisque(statSync(chemin));
    } catch {
      return 0;
    }
  };
  let base = 0;
  if (vivante) for (const suffixe of ['', '-wal', '-shm']) base += octetsDe(`${vivante}${suffixe}`);
  const dans = (cle) => (_, o) => { comptes[cle] += o; };
  if (archives) parcourir(archives, (_, o) => { base += o; }, borne, (o) => { base += o; });
  const images = Math.max(0, Math.min(Math.round(Number(imagesDeLaBase) || 0), base));
  comptes.base = base - images;
  comptes.images = images;
  if (miseAJour) parcourir(miseAJour, dans('mises-a-jour'), borne, (o) => dans('mises-a-jour')(null, o));
  if (metriques) parcourir(metriques, dans('metriques'), borne, (o) => dans('metriques')(null, o));
  // les dossiers du site (leurs blocs) : avec ses autres fichiers, comme l'hôte (« réglages, scripts et dossiers de l'instance »)
  if (site && !exclus.has(resolve(site))) parcourir(site, (rel, o) => { comptes[categorieDuFichierDuSite(rel)] += o; }, borne, (o) => dans('site-autres')(null, o));
  return { comptes, partiel: borne.partiel, fichiers: bornes.fichiers_max - borne.fichiers, duree_ms: arrondi(performance.now() - t0), images_base: images };
}

/**
 * La répartition d'un disque : { repartition: [{ cle, libelle, octets }] dans l'ordre de REPARTITION, depasse } — la somme fait EXACTEMENT `total`.
 * « libre » = `libre` (borné à [0, total]) ; « reserve » = `reserve` (la réserve de root, bornée à ce qui reste ; 0 si inconnue : elle tombe alors
 * dans « autres ») ; « autres » = total − libre − réserve − les catégories comptées (place prise que rien n'explique), jamais négatif : si les
 * catégories comptées dépassent la place prise (un dossier sur un autre disque, un fichier compté deux fois…), elles y sont ramenées au prorata (à
 * l'octet près, le reste aux plus grandes) et `depasse` = { compte, occupe } le dit (alerte) ; sinon `depasse` = null. La place prise (`df` : Used)
 * est donc la somme de tout sauf « reserve » et « libre ».
 * Les catégories de l'hôte (REPARTITION_HOTE) n'y sont, juste avant « autres », que si `comptes` en porte au moins une (relevé de l'hôte pris en
 * compte : comptesAvecLHote).
 */
export function repartitionDu({ total, libre, reserve = 0, comptes = {} }) {
  const t = Math.max(0, Math.round(Number(total) || 0));
  const l = Math.min(t, Math.max(0, Math.round(Number(libre) || 0)));
  const r = Math.min(t - l, Math.max(0, Math.round(Number(reserve) || 0)));
  const occupe = t - l - r;
  const avecHote = CATEGORIES_HOTE.some((c) => Object.hasOwn(comptes ?? {}, c));
  const categories = avecHote ? [...CATEGORIES_COMPTEES, ...CATEGORIES_HOTE] : CATEGORIES_COMPTEES;
  const libelles = avecHote ? [...REPARTITION.slice(0, -CATEGORIES_DU_DISQUE), ...REPARTITION_HOTE, ...REPARTITION.slice(-CATEGORIES_DU_DISQUE)] : REPARTITION;
  let valeurs = categories.map((c) => Math.max(0, Math.round(Number(comptes?.[c]) || 0)));
  const somme = valeurs.reduce((a, b) => a + b, 0);
  let depasse = null;
  if (somme > occupe) {
    depasse = { compte: somme, occupe };
    const reduites = valeurs.map((v) => Math.floor((v / somme) * occupe));
    const ordre = valeurs.map((_, i) => i).sort((a, b) => valeurs[b] - valeurs[a] || a - b);
    let ecart = occupe - reduites.reduce((a, b) => a + b, 0);
    // l'arrondi laisse quelques octets (moins d'un par catégorie) : aux plus grandes ; jamais en dessous de zéro
    for (let j = 0; ecart !== 0 && j < 10 * ordre.length; j += 1) {
      const i = ordre[j % ordre.length];
      if (ecart > 0) {
        reduites[i] += 1;
        ecart -= 1;
      } else if (reduites[i] > 0) {
        reduites[i] -= 1;
        ecart += 1;
      }
    }
    valeurs = reduites;
  }
  const autres = occupe - valeurs.reduce((a, b) => a + b, 0);
  const octets = [...valeurs, autres, r, l];
  return { repartition: libelles.map((c, i) => ({ cle: c.cle, libelle: c.libelle, octets: octets[i] })), depasse };
}

/**
 * Le relevé de l'hôte (deploy/vps/volume.sh : `volume-hote.json` du dossier des métriques, format 1 ; docs/serveur.md, « Jauge de l'espace
 * disque ») vu par l'instance `instance` : rend null sans fichier (NAS, développement), sinon { instant (ms), utilise, raison, comptes } —
 * `utilise` faux avec sa `raison` s'il est illisible, d'un autre format, périmé (plus d'une heure : RELEVE_HOTE.perime_ms) ou s'il décrit un autre
 * disque (taille à plus de 1 % de `total`, celle que mesure le service) ; `comptes` = { cle: octets } des éléments à AJOUTER aux mesures du
 * service : ceux d'une autre instance ou d'aucune (Docker, journaux du système, sauvegardes…), et ceux de cette instance que le service ne voit pas
 * (autres fichiers de db/, réglages et scripts du dossier de l'instance, ses journaux, restes d'installation : DEJA_MESURES_PAR_LE_SERVICE) ;
 * jamais `metriques` (le service compte déjà tout le dossier partagé) ni `hors_disque` ; une clé inconnue est laissée à « Système et autres ».
 * La base vivante d'une AUTRE instance (élément « base » de son db/vivante.db) contient ses portraits : `imagesDesInstances(nom)` (les octets des
 * images de sa base, qu'elle note avec sa répartition dans <nom>.db ; null si inconnus) les en retire pour les ranger dans « images », comme chez
 * elle — les deux jauges du même disque s'accordent sur ce que le propriétaire appelle « Import images ».
 */
export function lireReleveDeLHote(chemin, { instance, maintenant = Date.now(), total = null, imagesDesInstances = null } = {}) {
  let texte;
  try {
    texte = readFileSync(chemin, 'utf8');
  } catch {
    return null;
  }
  const refus = (raison, instant = null) => ({ instant, utilise: false, raison, comptes: {} });
  let r;
  try {
    r = JSON.parse(texte);
  } catch {
    return refus('relevé de l’hôte illisible (JSON invalide)');
  }
  if (!r || typeof r !== 'object' || r.format !== RELEVE_HOTE.format || !Array.isArray(r.elements)) return refus(`relevé de l’hôte d’un format inconnu (${r?.format ?? '?'})`);
  const instant = Date.parse(r.instant);
  if (!Number.isFinite(instant)) return refus('relevé de l’hôte sans instant');
  if (maintenant - instant > RELEVE_HOTE.perime_ms) return refus(`relevé de l’hôte périmé (${isoMs(instant)}) : le minuteur maverick-volume.timer ne tourne plus`, instant);
  const totalHote = Number(r.disque?.total);
  if (total && (!Number.isFinite(totalHote) || Math.abs(totalHote - total) > RELEVE_HOTE.ecart_total * total)) {
    return refus('relevé de l’hôte fait sur un autre disque que celui du service', instant);
  }
  const connues = new Set([...CATEGORIES_COMPTEES, ...CATEGORIES_HOTE]);
  const comptes = Object.fromEntries(CATEGORIES_HOTE.map((c) => [c, 0]));
  for (const e of r.elements) {
    if (!e || typeof e !== 'object' || !connues.has(e.cle) || e.cle === 'metriques') continue;
    const octets = Math.max(0, Math.round(Number(e.octets) || 0));
    if (!octets) continue;
    if (e.instance === instance && DEJA_MESURES_PAR_LE_SERVICE.test(String(e.chemin ?? ''))) continue;
    if (e.cle === 'base' && e.instance && e.instance !== instance && /\/db\/vivante\.db$/.test(String(e.chemin ?? '')) && imagesDesInstances) {
      let images = 0;
      try {
        images = Math.max(0, Math.min(octets, Math.round(Number(imagesDesInstances(String(e.instance))) || 0)));
      } catch {
        images = 0; // le fichier des métriques de l'autre instance est illisible : sa base reste entière dans « base »
      }
      comptes.base = (comptes.base ?? 0) + octets - images;
      comptes.images = (comptes.images ?? 0) + images;
      continue;
    }
    comptes[e.cle] = (comptes[e.cle] ?? 0) + octets;
  }
  return { instant, utilise: true, raison: null, comptes };
}

/** Les comptes du service et ceux du relevé de l'hôte additionnés (lireReleveDeLHote ; les catégories de l'hôte toujours présentes, même à 0). */
export function comptesAvecLHote(comptes, hote) {
  if (!hote?.utilise) return comptes;
  const somme = { ...comptes };
  for (const [cle, octets] of Object.entries(hote.comptes)) somme[cle] = (somme[cle] ?? 0) + octets;
  return somme;
}

/**
 * Les colonnes d'image de la base vivante : celles de lib/edition-modele.mjs#colonnesImage (portraits des cartes et des espèces du bestiaire) et le
 * « portrait » des tables de la section 13 (fiches de personnages) — seulement celles que la base a. [{ table, colonne }].
 */
export function colonnesImagesDe(db) {
  const candidates = [
    ...Object.keys(TABLES).flatMap((table) => colonnesImage(table).map((colonne) => ({ table, colonne }))),
    ...TABLES_FICHES.map((table) => ({ table, colonne: 'portrait' })),
  ];
  const vues = new Set();
  return candidates.filter(({ table, colonne }) => {
    const k = `${table}.${colonne}`;
    if (vues.has(k)) return false;
    vues.add(k);
    return db.prepare(`PRAGMA table_info("${table}")`).all().some((c) => c.name === colonne);
  });
}

/** Les octets des images stockées dans la base vivante (colonnesImagesDe ; octet_length : sans lire les images) ; 0 sans base. */
export function octetsDesImages(db) {
  if (!db) return 0;
  let total = 0;
  for (const { table, colonne } of colonnesImagesDe(db)) total += Number(db.prepare(`SELECT coalesce(sum(octet_length("${colonne}")), 0) AS n FROM "${table}"`).get().n);
  return total;
}

/** La mémoire dont le processus dispose : la limite du conteneur (cgroup) si elle est connue, sinon la mémoire de la machine. */
export function limiteMemoire() {
  const totale = totalmem();
  const contrainte = typeof process.constrainedMemory === 'function' ? Number(process.constrainedMemory()) : 0;
  return contrainte > 0 && contrainte < totale ? contrainte : totale;
}

/** Empreinte d'une pile d'erreur : nom + cadres (sans numéros de ligne ni de colonne), 12 caractères ; et le premier cadre (fichier seul). */
export function empreinteDePile(erreur) {
  const pile = String(erreur?.stack ?? '');
  const cadres = pile.split('\n').filter((l) => /^\s*at /.test(l)).slice(0, 8).map((l) => l.trim().replace(/:\d+:\d+\)?$/, '').replace(/\(?(?:file:\/\/)?\/[^\s()]*\//, ''));
  const empreinte = createHash('sha256').update(`${erreur?.name ?? 'Error'}\n${cadres.join('\n')}`).digest('hex').slice(0, 12);
  return { empreinte, nom: String(erreur?.name ?? 'Error').slice(0, 60), origine: cadres[0]?.replace(/^at /, '').slice(0, 120) ?? null };
}

/**
 * Octets occupés par ligne, table par table (index compris), estimés sur la base : contenu des cellules des pages feuilles (dbstat) + 4 octets par
 * cellule, × 1,25 (remplissage des pages) ; une table encore vide prend OCTETS_PAR_LIGNE_ESTIMES.
 */
export const OCTETS_PAR_LIGNE_ESTIMES = Object.freeze({
  // mesurés le 2026-10-15 (pages SQLite comprises) sur trois jours simulés de 3 000 requêtes : docs/serveur.md, « Métriques et volume »
  agregat_heure: 150, agregat_5min: 150, page_heure: 255, navigateur_heure: 56, origine_heure: 56, systeme_minute: 100, systeme_heure: 140,
  disque_repartition: 160, evenement: 200, requete_brute: 145,
});
const INDEX_DES_TABLES = { evenement: ['evenement_instant'], requete_brute: ['requete_brute_instant'] };

function octetsParLigne(db) {
  const parNom = new Map();
  try {
    for (const l of db.prepare("SELECT name, sum(payload) AS payload, sum(ncell) AS cellules FROM dbstat WHERE pagetype = 'leaf' GROUP BY name").all()) parNom.set(l.name, l);
  } catch {
    // SQLite sans dbstat : les estimations
  }
  const resultat = {};
  for (const t of TABLES_DATEES) {
    let lignes = 0;
    try {
      lignes = Number(db.prepare(`SELECT count(*) AS n FROM ${t.table}`).get().n);
    } catch {
      // table absente d'une base plus ancienne (lue en lecture seule) : l'estimation
    }
    const noms = [t.table, ...(INDEX_DES_TABLES[t.table] ?? [])];
    const octets = noms.reduce((n, nom) => n + Number(parNom.get(nom)?.payload ?? 0) + 4 * Number(parNom.get(nom)?.cellules ?? 0), 0);
    resultat[t.table] = lignes >= 20 && octets ? Math.round((octets / lignes) * 1.25) : OCTETS_PAR_LIGNE_ESTIMES[t.table];
  }
  return resultat;
}

/**
 * Lignes écrites par jour dans une table : sur les dernières 24 heures quand la base a au moins un jour ; avant, les tables par tranche (heure, 5
 * minutes) comptent les lignes d'une tranche vue × les tranches d'un jour (borne haute : comme si chaque tranche était active), les autres au fil du
 * temps écoulé. Échantillons : 1 440 par jour (un par minute), puis 24 résumés.
 */
function lignesParJour(db, t, maintenantS, age) {
  if (t.table === 'systeme_minute') return 1440;
  if (t.table === 'systeme_heure') return 24;
  if (t.table === 'disque_repartition') return 86_400_000 / PARCOURS.intervalle_ms;
  const pas = { agregat_5min: 300, agregat_heure: 3600, page_heure: 3600, navigateur_heure: 3600, origine_heure: 3600 }[t.table];
  if (age >= 86_400 || !pas) {
    const fenetre = Math.min(86_400, Math.max(age, 600));
    const depuis = maintenantS - fenetre;
    const n = Number(db.prepare(`SELECT count(*) AS n FROM ${t.table} WHERE ${t.colonne} >= ?`).get(t.ms ? depuis * 1000 : depuis).n);
    return (n * 86_400) / fenetre;
  }
  const l = db.prepare(`SELECT count(*) AS n, count(DISTINCT ${t.colonne}) AS tranches FROM ${t.table}`).get();
  return l.tranches ? (Number(l.n) / Number(l.tranches)) * (86_400 / pas) : 0;
}

/**
 * Les alertes de l'état du système (GET /api/debug/systeme/) : [{ niveau: info | avertissement | erreur, message }], d'après SEUILS — disque libre
 * (moins de 10 % ou de 2 Gio ; grave sous 5 % ou 1 Gio), base des métriques de plus de 200 Mio (ou qui les atteindra à rétention pleine), archives
 * qui grossissent, boucle d'événements lente (p99), mémoire au-delà de 80 % de la limite connue, réponses 5xx de la dernière heure, panne de la
 * base des métriques, requêtes brutes gardées, collecte restreinte (`restriction` = { raison, depuis } : PLAFOND_METRIQUES_OCTETS ou disque bas) ;
 * répartition du disque (`repartition` = { depasse, partiel, hote }) : fichiers comptés au-delà de la place prise (ramenés à elle dans la jauge),
 * parcours arrêté à sa borne, relevé de l'hôte présent mais écarté (périmé, illisible, autre disque).
 */
export function alertesDu({
  disque = null, processus = null, volume = {}, erreursRecentes = 0, panne = null, brutes = false, croissanceArchives = null, repartition = null, restriction = null,
} = {}) {
  const liste = [];
  const gio = (o) => `${(o / 1024 ** 3).toFixed(1)} Gio`;
  const mio = (o) => `${(o / 1024 ** 2).toFixed(1)} Mio`;
  const lisible = (o) => (o >= 1024 ** 3 ? gio(o) : o >= 1024 ** 2 ? mio(o) : `${Math.round(o / 1024)} Kio`);
  if (repartition?.depasse) {
    liste.push({
      niveau: 'avertissement',
      message: `Répartition du disque : les fichiers comptés (${lisible(repartition.depasse.compte)}) dépassent la place prise sur le disque (${lisible(repartition.depasse.occupe)}) — un dossier est sans doute sur un autre disque, ou compté deux fois ; la jauge les ramène à la place prise.`,
    });
  }
  if (repartition?.partiel) {
    liste.push({
      niveau: 'info',
      message: `Répartition du disque partielle : le parcours des fichiers s’est arrêté à sa borne (${PARCOURS.fichiers_max} fichiers ou ${PARCOURS.duree_max_ms} ms) ; le reste est compté dans « Système et autres ».`,
    });
  }
  if (repartition?.hote && !repartition.hote.utilise) {
    liste.push({
      niveau: 'info',
      message: `Répartition du disque sans le relevé de l’hôte (${repartition.hote.raison}) : Docker, les journaux et l’autre instance restent dans « Système et autres ».`,
    });
  }
  if (panne) liste.push({ niveau: 'erreur', message: `La base des métriques est en panne (${panne}) : la collecte continue en mémoire.` });
  if (restriction) {
    liste.push({
      niveau: 'avertissement',
      message: `Métriques restreintes depuis ${isoMs(restriction.depuis)} (${restriction.raison}) : plus aucune nouvelle page ni page d’origine (tout va dans « {autres} »), plus de requêtes brutes ; les routes continuent.`,
    });
  }
  if (disque?.total) {
    const part = `${Math.round(disque.part_libre * 100)} %`;
    if (disque.part_libre < SEUILS.disque_part_libre_grave || disque.libre < SEUILS.disque_libre_octets_grave) {
      liste.push({ niveau: 'erreur', message: `Disque presque plein : ${gio(disque.libre)} libres (${part}).` });
    } else if (disque.part_libre < SEUILS.disque_part_libre || disque.libre < SEUILS.disque_libre_octets) {
      liste.push({ niveau: 'avertissement', message: `Peu de place sur le disque : ${gio(disque.libre)} libres (${part}).` });
    }
  }
  if (volume.metriques_octets > SEUILS.base_metriques_octets) {
    liste.push({ niveau: 'avertissement', message: `La base des métriques dépasse ${mio(SEUILS.base_metriques_octets)} : ${mio(volume.metriques_octets)}.` });
  } else if (volume.taille_a_terme_octets > SEUILS.base_metriques_octets) {
    liste.push({ niveau: 'avertissement', message: `À ce rythme, la base des métriques atteindra ${mio(volume.taille_a_terme_octets)} une fois la rétention pleine.` });
  }
  if (croissanceArchives) {
    liste.push({ niveau: 'avertissement', message: `Les archives de la base vivante ont grossi de ${mio(croissanceArchives.octets)} en ${croissanceArchives.jours} jour(s) (${mio(croissanceArchives.taille)} aujourd’hui).` });
  }
  if (processus?.boucle_p99_ms > SEUILS.boucle_p99_ms) liste.push({ niveau: 'avertissement', message: `La boucle d’événements est lente : p99 ${processus.boucle_p99_ms} ms (seuil ${SEUILS.boucle_p99_ms} ms).` });
  const limite = processus?.memoire_limite ?? null;
  if (limite && processus.rss > SEUILS.memoire_part * limite) liste.push({ niveau: 'avertissement', message: `Mémoire : ${mio(processus.rss)} sur ${mio(limite)} (plus de ${SEUILS.memoire_part * 100} %).` });
  if (erreursRecentes) liste.push({ niveau: 'avertissement', message: `${erreursRecentes} réponse(s) 5xx dans la dernière heure.` });
  if (brutes) liste.push({ niveau: 'info', message: `Les requêtes brutes sont gardées ${RETENTION.requetes_brutes} jours (MAVERICK_METRIQUES_BRUTES=1) : environ 145 octets par requête.` });
  return liste;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le collecteur
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Un nom d'instance valable (fichier <instance>.db) : minuscules, chiffres, tirets, 32 caractères au plus. */
export const NOM_D_INSTANCE = /^[a-z0-9-]{1,32}$/;

/** L'instance d'un service : MAVERICK_INSTANCE si elle est posée et valable, sinon « dev » (édition ouverte) ou « prod ». */
export function instanceDuService({ edition, instance = null }) {
  const donnee = String(instance ?? '').trim().toLowerCase();
  return NOM_D_INSTANCE.test(donnee) ? donnee : edition ? 'dev' : 'prod';
}

/**
 * Crée le collecteur des métriques d'une instance.
 * @param {object} o
 * @param {string} o.dossier dossier des métriques (créé s'il manque) ; le fichier est <dossier>/<instance>.db
 * @param {string} o.instance « dev », « prod »…
 * @param {() => number} [o.horloge] l'instant en ms (tests : rétention, tranches)
 * @param {boolean} [o.brutes] requêtes brutes persistées 30 jours (MAVERICK_METRIQUES_BRUTES=1)
 * @param {boolean} [o.pages] balise des pages vues acceptée (MAVERICK_METRIQUES_PAGES=0 la ferme)
 * @param {number} [o.memoireRequetes] requêtes gardées une à une en mémoire (CAPACITE_REQUETES sur le site de dev, 0 en production)
 * @param {number} [o.intervalle] versement et échantillonnage, en ms ; 0 = aucune minuterie (tests : verser() et echantillonner() à la main)
 * @param {(message: string, options?: object) => void} [o.journal] le journal du service (une panne y est notée une fois)
 * @param {{ version?: string, code?: string|null }} [o.identite] version et code du service (évènement de démarrage, état du processus)
 * @param {{ vivante?: string, archives?: string, miseAJour?: string, disque?: string, site?: string|null }} [o.fichiers] ce dont la taille et le
 *   disque sont mesurés ; `site` : le dossier du site construit (répartition du disque : code, données, images du site)
 * @param {() => number|null} [o.imagesDeLaBase] les octets des images de la base vivante (octetsDesImages ; appelé au plus toutes les 10 minutes)
 * @param {() => number} [o.compteurJournal] le numéro de la dernière entrée du journal (entrées par minute)
 * @param {typeof PARCOURS} [o.parcours] bornes du parcours des fichiers de la répartition (tests)
 * @param {number} [o.plafond] plafond de la base des métriques (PLAFOND_METRIQUES_OCTETS) : au-delà, la collecte est restreinte (tests : plus petit)
 * @param {number} [o.disqueMinimum] place libre sous laquelle la collecte est restreinte (SEUILS.disque_libre_octets ; tests : 0)
 */
export function creerMetriques({
  dossier, instance, horloge = () => Date.now(), brutes = false, pages = true, memoireRequetes = 0, intervalle = INTERVALLE_VERSEMENT,
  journal = () => {}, identite = {}, fichiers = {}, compteurJournal = null, imagesDeLaBase = null, parcours = PARCOURS,
  plafond = PLAFOND_METRIQUES_OCTETS, disqueMinimum = SEUILS.disque_libre_octets,
}) {
  const nom = instanceDuService({ edition: false, instance });
  if (nom !== String(instance ?? '').trim().toLowerCase()) throw new ErreurMetriques(500, `Nom d’instance des métriques invalide : « ${instance} ».`);
  const fichier = join(dossier, `${nom}.db`);
  const capacite = Math.max(0, Math.floor(Number(memoireRequetes) || 0));
  const secondes = () => Math.floor(horloge() / 1000);

  let db = null;
  let instructions = null;
  let panne = null;
  let dernierePurge = null;
  const idsSql = new Map();
  const attente = { heure: new Map(), cinq: new Map(), pages: new Map(), navigateurs: new Map(), origines: new Map(), minutes: [], repartitions: [], evenements: [], brutes: [] };
  let releve = null; // le dernier relevé de la répartition du disque : { instant (ms), comptes, partiel, fichiers, duree_ms } (au plus toutes les 10 minutes)
  let releveNote = null; // l'instant (ms) de la dernière répartition gardée dans les échantillons
  let perdues = 0;
  const anneau = [];
  let enCours = 0;
  let simultaneesMax = 0;
  let requetesMinute = 0;
  let erreursMinute = 0;
  const debutProcessus = horloge() - process.uptime() * 1000;
  const boucle = monitorEventLoopDelay({ resolution: RESOLUTION_BOUCLE });
  boucle.enable();
  let cpuPrecedent = process.cpuUsage();
  let tempsPrecedent = performance.now();
  let journalPrecedent = Number(compteurJournal?.() ?? 0);
  let dernierEchantillon = null;
  const derniersErreurs = new Map(); // clé d'un évènement d'erreur → { instant, omis }
  const balises = { minute: -1, n: 0 };
  // les clés créées dans l'heure : pages vues (balise), pages d'origine (Referer) et couples (page d'origine, route) — bornées (PAGES_PAR_HEURE…)
  const clesDeLHeure = { heure: -1, pages: new Set(), origines: new Set(), couples: new Set() };
  const cacheNavigateurs = new Map();
  const volumes = new Map(); // instance → { instant, valeur } : volume() calculé au plus toutes les 10 minutes
  const lectures = new Map(); // lectures lourdes gardées CACHE_LECTURE_MS (lire)
  let versements = 0; // versements qui ont écrit quelque chose : une lecture gardée de cette instance n'est valable que s'il n'y en a pas eu depuis
  let restriction = null; // { raison, depuis (ms) } : collecte restreinte (PLAFOND_METRIQUES_OCTETS, disque bas)
  let pagesConnues = { instant: -Infinity, pages: null }; // les pages du site construit (pagesDuSite), relues toutes les 10 minutes
  let minuterie = null;
  let arrete = false;

  /** Note une panne de la base une fois (même message : rien de plus). */
  function noterPanne(e) {
    const message = e?.message ?? String(e);
    if (panne !== message) {
      try {
        journal(`ERREUR métriques : ${fichier} : ${message} (la collecte continue en mémoire)`, { categorie: 'metriques' });
      } catch {
        // le journal ne doit pas faire échouer la collecte
      }
    }
    panne = message;
  }

  /** Exécute `f` sans jamais laisser passer une exception (notée comme une panne). */
  function sur(f, defaut = null) {
    try {
      return f();
    } catch (e) {
      noterPanne(e);
      return defaut;
    }
  }

  function ouvrir() {
    if (db) return true;
    try {
      mkdirSync(dossier, { recursive: true });
      const d = new DatabaseSync(fichier);
      try {
        d.exec('PRAGMA busy_timeout = 500');
        const neuve = !d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();
        if (neuve) d.exec('PRAGMA auto_vacuum = INCREMENTAL');
        d.exec('PRAGMA journal_mode = WAL');
        d.exec('PRAGMA synchronous = NORMAL');
        // le WAL (jusqu'à ~4 Mio entre deux points de contrôle automatiques) est ramené à 1 Mio au plus après chacun : la place qu'il garde reste petite
        d.exec('PRAGMA journal_size_limit = 1048576');
        d.exec(SCHEMA_SQL);
        // une base plus ancienne : les colonnes ajoutées depuis (version 3 : la réserve de root ; version 4 : taille logique, images de la base
        // vivante) et les histogrammes des pages vues à leurs propres bornes (migrerPagesVues)
        const ajouterColonne = (table, colonne) => {
          if (!d.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === colonne)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne} INTEGER`);
        };
        ajouterColonne('disque_repartition', 'reserve');
        ajouterColonne('disque_repartition', 'images_base');
        ajouterColonne('systeme_minute', 'taille_logique');
        ajouterColonne('systeme_heure', 'taille_logique_max');
        migrerPagesVues(d);
        d.exec(`PRAGMA user_version = ${SCHEMA_METRIQUES}`);
        const maintenant = String(horloge());
        d.prepare("INSERT OR IGNORE INTO meta (cle, valeur) VALUES ('instance', ?), ('cree_le_ms', ?), ('derniere_purge_ms', ?)").run(nom, maintenant, maintenant);
        dernierePurge = Number(d.prepare("SELECT valeur FROM meta WHERE cle = 'derniere_purge_ms'").get()?.valeur ?? horloge());
        instructions = {
          heure: d.prepare(upsertAgregat('agregat_heure')),
          cinq: d.prepare(upsertAgregat('agregat_5min')),
          page: d.prepare(upsertPage()),
          navigateur: d.prepare(`INSERT INTO navigateur_heure (debut, famille, appareil, requetes, pages) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (debut, famille, appareil) DO UPDATE SET requetes = requetes + excluded.requetes, pages = pages + excluded.pages`),
          origine: d.prepare('INSERT INTO origine_heure (debut, page, route, n) VALUES (?, ?, ?, ?) ON CONFLICT (debut, page, route) DO UPDATE SET n = n + excluded.n'),
          // deux échantillons de la même seconde (l'arrêt juste après la minute) : fusionnés, jamais l'un à la place de l'autre (instructionMinute)
          minute: d.prepare(instructionMinute()),
          repartition: d.prepare('INSERT OR REPLACE INTO disque_repartition (instant, total, libre, comptes, partiel, reserve, images_base) VALUES (?, ?, ?, ?, ?, ?, ?)'),
          evenement: d.prepare('INSERT INTO evenement (instant_ms, type, duree_ms, detail) VALUES (?, ?, ?, ?)'),
          brute: d.prepare(`INSERT INTO requete_brute (${COLONNES_BRUTES.join(', ')}) VALUES (${COLONNES_BRUTES.map(() => '?').join(', ')})`),
          sqlId: d.prepare('SELECT id FROM sql_texte WHERE texte = ?'),
          sqlAjout: d.prepare('INSERT INTO sql_texte (texte) VALUES (?)'),
        };
      } catch (e) {
        d.close();
        throw e;
      }
      db = d;
      idsSql.clear();
      if (panne) {
        journal(`métriques : ${fichier} de nouveau disponible`, { categorie: 'metriques' });
        pousserEvenement('metriques', null, { reprise: true, panne });
      }
      panne = null;
      return true;
    } catch (e) {
      noterPanne(e);
      return false;
    }
  }

  // ----- collecte -----------------------------------------------------------------------------------------------------------------------------

  /** Garde une clé dans une Map bornée : au-delà de `max`, la plus ancienne sort (comptée dans `perdues`). */
  function cle(map, k, fabriquer, max) {
    let v = map.get(k);
    if (!v) {
      if (map.size >= max) {
        map.delete(map.keys().next().value);
        perdues += 1;
      }
      v = fabriquer();
      map.set(k, v);
    }
    return v;
  }

  function pousser(liste, valeur, max) {
    if (liste.length >= max) {
      liste.shift();
      perdues += 1;
    }
    liste.push(valeur);
  }

  /** Les pages du site construit (pagesDuSite), relues au plus toutes les 10 minutes ; null si le service ne connaît pas le site. */
  function pagesDuSiteConnues() {
    const maintenant = horloge();
    if (!fichiers.site) return null;
    if (maintenant - pagesConnues.instant >= parcours.intervalle_ms || maintenant < pagesConnues.instant) {
      pagesConnues = { instant: maintenant, pages: pagesDuSite(fichiers.site, { fichiersMax: parcours.fichiers_max }) };
    }
    return pagesConnues.pages;
  }

  function clesDe(heure) {
    if (clesDeLHeure.heure !== heure) {
      clesDeLHeure.heure = heure;
      clesDeLHeure.pages.clear();
      clesDeLHeure.origines.clear();
      clesDeLHeure.couples.clear();
    }
    return clesDeLHeure;
  }

  /**
   * La page gardée pour cette heure (`quoi` : « pages », la balise ; « origines », le Referer) : « {autres} » si le site construit ne l'a pas
   * (pageDuSite), au-delà de PAGES_PAR_HEURE pages distinctes, ou pendant la restriction (sauf une page déjà vue dans l'heure).
   */
  function pageBornee(page, heure, quoi = 'pages') {
    const connue = pageDuSite(page, pagesDuSiteConnues());
    if (!connue) return PAGE_AUTRES;
    const ensemble = clesDe(heure)[quoi];
    if (ensemble.has(connue)) return connue;
    if (restriction || ensemble.size >= PAGES_PAR_HEURE) return PAGE_AUTRES;
    ensemble.add(connue);
    return connue;
  }

  /** La page d'origine gardée pour une route, cette heure : au-delà de ORIGINES_PAR_HEURE couples (page, route), « {autres} ». */
  function origineBornee(page, route, heure) {
    const gardee = pageBornee(page, heure, 'origines');
    const couples = clesDe(heure).couples;
    const k = `${gardee}\u0000${route}`;
    if (couples.has(k)) return gardee;
    if (couples.size >= ORIGINES_PAR_HEURE) return PAGE_AUTRES;
    couples.add(k);
    return gardee;
  }

  const cacheOrigines = new Map();
  function origine(referent, hote) {
    if (!referent || !hote) return null;
    const k = `${hote}\u0000${referent}`;
    if (cacheOrigines.has(k)) return cacheOrigines.get(k);
    if (cacheOrigines.size >= 256) cacheOrigines.clear();
    const page = pageDuReferent(referent, hote);
    cacheOrigines.set(k, page);
    return page;
  }

  function navigateur(ua) {
    const texte = String(ua ?? '');
    let n = cacheNavigateurs.get(texte);
    if (!n) {
      if (cacheNavigateurs.size >= 256) cacheNavigateurs.clear();
      n = navigateurDe(texte);
      cacheNavigateurs.set(texte, n);
    }
    return n;
  }

  /**
   * Le début d'une requête : rend sa mesure (à passer à `fin`). `entetes` : ceux de la requête (seuls Referer, Host et User-Agent sont lus, et
   * jamais gardés tels quels).
   */
  function debut(methode, adresse, entetes = {}) {
    enCours += 1;
    if (enCours > simultaneesMax) simultaneesMax = enCours;
    const chemin = cheminSeul(adresse);
    return {
      t0: performance.now(), tCorps: null, tTraite: null, methode: methodeNormalisee(methode), chemin, route: routeNormalisee(chemin),
      octets_entree: 0, sql: null, referent: entetes.referer ?? null, hote: entetes['x-forwarded-host'] ?? entetes.host ?? null,
      ua: entetes['user-agent'] ?? '', simultanees: enCours, fini: false,
    };
  }

  /**
   * La fin d'une requête (réponse partie, ou connexion coupée) : ajoute la requête aux agrégats en mémoire. Rend la requête mesurée (ce que garde la
   * mémoire des requêtes), ou null si elle était déjà notée.
   */
  function fin(m, { statut, octets_sortie = 0 } = {}) {
    if (!m || m.fini) return null;
    m.fini = true;
    enCours = Math.max(0, enCours - 1);
    const t = performance.now();
    const duree = t - m.t0;
    const tCorps = m.tCorps ?? t;
    const tTraite = m.tTraite ?? tCorps;
    const s = Number(statut) || 0;
    const sql = m.sql ?? { n: 0, ms: 0, plus_lente: null };
    const r = {
      duree, corps: tCorps - m.t0, traitement: Math.max(0, tTraite - tCorps), envoi: Math.max(0, t - tTraite), statut: s,
      octets_entree: m.octets_entree, octets_sortie: Number(octets_sortie) || 0, sql_n: sql.n, sql_ms: sql.ms, sql_lente: sql.plus_lente,
    };
    const instantMs = horloge();
    const sec = Math.floor(instantMs / 1000);
    const heure = tranche(sec, 3600);
    const cinq = tranche(sec, 300);
    // une requête refusée avant tout traitement (403, 405) : sous « /api/<premier segment>/{refusee}/ » (cardinalité bornée : routeGardee)
    const route = routeGardee(m.route, s);
    ajouterRequete(cle(attente.heure, `${heure}\u0000${route}\u0000${m.methode}`, () => ({ debut: heure, route, methode: m.methode, a: nouvelAgregat() }), MAX_EN_ATTENTE.agregats).a, r);
    ajouterRequete(cle(attente.cinq, `${cinq}\u0000${route}\u0000${m.methode}`, () => ({ debut: cinq, route, methode: m.methode, a: nouvelAgregat() }), MAX_EN_ATTENTE.agregats).a, r);
    const nav = navigateur(m.ua);
    cle(attente.navigateurs, `${heure}\u0000${nav.famille}\u0000${nav.appareil}`, () => ({ debut: heure, ...nav, requetes: 0, pages: 0 }), MAX_EN_ATTENTE.navigateurs).requetes += 1;
    let page = origine(m.referent, m.hote);
    if (page) {
      page = origineBornee(page, route, heure);
      cle(attente.origines, `${heure}\u0000${page}\u0000${route}`, () => ({ debut: heure, page, route, n: 0 }), MAX_EN_ATTENTE.origines).n += 1;
    }
    requetesMinute += 1;
    if (s >= 500) erreursMinute += 1;
    const requete = {
      instant: isoMs(instantMs), methode: m.methode, route,
      // le chemin seulement, jamais l'identifiant d'une fiche (adresseGardee)
      adresse: adresseGardee(m.chemin, route),
      statut: s, duree_ms: arrondi(duree),
      phases: { corps_ms: arrondi(r.corps), traitement_ms: arrondi(r.traitement), envoi_ms: arrondi(r.envoi) },
      octets_entree: r.octets_entree, octets_sortie: r.octets_sortie,
      sql: { n: sql.n, ms: arrondi(sql.ms), plus_lente: sql.plus_lente ? { sql: sql.plus_lente.sql, ms: arrondi(sql.plus_lente.ms) } : null },
      page, navigateur: nav.famille, appareil: nav.appareil, simultanees: m.simultanees,
    };
    if (capacite && !estUnSuivi(m.methode, route, s)) {
      anneau.push(requete);
      if (anneau.length > capacite) anneau.splice(0, anneau.length - capacite);
    }
    if (brutes && !restriction) pousser(attente.brutes, { instant_ms: instantMs, ...requete }, MAX_EN_ATTENTE.brutes);
    return requete;
  }

  /**
   * Note un évènement du service : { type, duree_ms, detail } (detail : un objet court, jamais de donnée personnelle). Les évènements d'erreur d'une
   * même empreinte ne sont gardés qu'une fois par minute (les suivants sont comptés dans `repetitions_omises` du prochain).
   */
  function evenement(type, { duree_ms = null, detail = null } = {}) {
    return sur(() => {
      if (type === 'erreur_5xx') {
        const k = `${detail?.empreinte ?? ''}\u0000${detail?.route ?? ''}\u0000${detail?.statut ?? ''}`;
        const precedent = derniersErreurs.get(k);
        const maintenant = horloge();
        if (precedent && maintenant - precedent.instant < 60_000) {
          precedent.omis += 1;
          return false;
        }
        if (derniersErreurs.size > 500) derniersErreurs.clear();
        derniersErreurs.set(k, { instant: maintenant, omis: 0 });
        if (precedent?.omis) detail = { ...detail, repetitions_omises: precedent.omis };
      }
      pousserEvenement(type, duree_ms, detail);
      return true;
    }, false);
  }

  function pousserEvenement(type, duree_ms, detail) {
    let texte = detail === null || detail === undefined ? null : JSON.stringify(detail);
    if (texte && texte.length > 2000) texte = JSON.stringify({ tronque: true, debut: texte.slice(0, 1900) });
    pousser(attente.evenements, { instant_ms: horloge(), type: String(type).slice(0, 40), duree_ms: arrondi(duree_ms), detail: texte }, MAX_EN_ATTENTE.evenements);
  }

  /**
   * POST /api/metriques/page/ : les mesures d'une page vue envoyées par le navigateur ({ page, ttfb_ms, dom_ms, charge_ms, lcp_ms }), validées et
   * ajoutées aux agrégats en mémoire de CETTE instance. Lève ErreurMetriques (403 fermée, 400 invalide, 429 débit dépassé).
   */
  function recevoirPage(valeur, entetes = {}) {
    if (!pages) throw new ErreurMetriques(403, 'La mesure des pages est fermée sur ce serveur (MAVERICK_METRIQUES_PAGES=0).');
    const minute = Math.floor(horloge() / 60_000);
    if (balises.minute !== minute) {
      balises.minute = minute;
      balises.n = 0;
    }
    if (balises.n >= BALISE.par_minute) throw new ErreurMetriques(429, 'Trop de mesures de pages reçues cette minute.');
    if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) throw new ErreurMetriques(400, 'Mesure de page attendue : { page, ttfb_ms, dom_ms, charge_ms, lcp_ms }.');
    const page = cheminDePage(valeur.page);
    if (!page) throw new ErreurMetriques(400, `« page » : le chemin d’une page du site est attendu (« / » au début, sans requête, ${BALISE.page_max} caractères au plus).`);
    const mesures = {};
    for (const m of MESURES_PAGE) {
      const v = valeur[`${m}_ms`];
      if (v === undefined || v === null) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > BALISE.ms_max) throw new ErreurMetriques(400, `« ${m}_ms » : un nombre de 0 à ${BALISE.ms_max} ms est attendu.`);
      mesures[m] = v;
    }
    if (!Object.keys(mesures).length) throw new ErreurMetriques(400, 'Aucune mesure : ttfb_ms, dom_ms, charge_ms ou lcp_ms est attendu.');
    balises.n += 1;
    const heure = tranche(secondes(), 3600);
    const gardee = pageBornee(page, heure, 'pages');
    const p = cle(attente.pages, `${heure}\u0000${gardee}`, () => ({ debut: heure, page: gardee, p: nouvellePage() }), MAX_EN_ATTENTE.pages).p;
    p.n += 1;
    for (const [m, v] of Object.entries(mesures)) ajouterMesure(p[m], v);
    const nav = navigateur(entetes['user-agent']);
    cle(attente.navigateurs, `${heure}\u0000${nav.famille}\u0000${nav.appareil}`, () => ({ debut: heure, ...nav, requetes: 0, pages: 0 }), MAX_EN_ATTENTE.navigateurs).pages += 1;
    return { page: gardee, mesures };
  }

  // ----- échantillons système -----------------------------------------------------------------------------------------------------------------

  /**
   * La taille logique de la base des métriques : (page_count − freelist_count) × page_size — les pages qui portent des données, WAL compris (SQLite
   * y lit la dernière version), sans les pages libres ni la place que le WAL garde : ce qui grossit vraiment (croissance mesurée : volume). null si
   * la base est fermée.
   */
  function tailleLogique() {
    if (!db) return null;
    try {
      const pragma = (nom) => Number(Object.values(db.prepare(`PRAGMA ${nom}`).get())[0]);
      return Math.max(0, (pragma('page_count') - pragma('freelist_count')) * pragma('page_size'));
    } catch {
      return null;
    }
  }

  /** Les tailles mesurées : base vivante (+ WAL et mémoire partagée), archives/, mise-a-jour/, métriques de cette instance (+ WAL ; et logique). */
  function tailles() {
    const vivante = fichiers.vivante ? tailleFichier(fichiers.vivante) + tailleFichier(`${fichiers.vivante}-wal`) + tailleFichier(`${fichiers.vivante}-shm`) : 0;
    return {
      taille_vivante: vivante,
      taille_archives: fichiers.archives ? tailleDossier(fichiers.archives) : 0,
      taille_mise_a_jour: fichiers.miseAJour ? tailleDossier(fichiers.miseAJour) : 0,
      taille_metriques: tailleFichier(fichier) + tailleFichier(`${fichier}-wal`),
      taille_logique: tailleLogique(),
    };
  }

  /**
   * La collecte restreinte ou non, d'après la taille de la base des métriques (fichier + WAL, PLAFOND_METRIQUES_OCTETS) et la place libre du disque
   * (SEUILS.disque_libre_octets) : un changement est noté (évènement « metriques_restreintes », journal) ; voir PLAFOND_METRIQUES_OCTETS.
   */
  function evaluerRestriction(disque, taille) {
    const mio = (o) => `${(o / 1024 ** 2).toFixed(1)} Mio`;
    let raison = null;
    if (Number.isFinite(taille) && taille >= plafond) raison = `la base des métriques fait ${mio(taille)}, plafond ${mio(plafond)}`;
    else if (Number.isFinite(disque?.libre) && disque.libre < disqueMinimum) raison = `le disque n’a plus que ${mio(disque.libre)} libres`;
    if (raison && !restriction) {
      restriction = { raison, depuis: horloge() };
      pousserEvenement('metriques_restreintes', null, { actif: true, raison });
      try {
        journal(`métriques restreintes (${raison}) : plus de nouvelle page ni page d’origine, plus de requêtes brutes`, { categorie: 'metriques' });
      } catch {
        // le journal ne doit pas faire échouer la collecte
      }
    } else if (!raison && restriction) {
      pousserEvenement('metriques_restreintes', null, { actif: false, depuis: isoMs(restriction.depuis) });
      restriction = null;
    } else if (raison) restriction.raison = raison;
    return restriction;
  }

  /** Les octets des images de la base vivante d'une autre instance, notés avec sa dernière répartition dans <nom>.db (lecture seule) ; null sinon. */
  function imagesDeLInstance(nomAutre) {
    if (!NOM_D_INSTANCE.test(nomAutre) || nomAutre === nom) return null;
    const chemin = join(dossier, `${nomAutre}.db`);
    if (!existsSync(chemin)) return null;
    let autre = null;
    try {
      autre = new DatabaseSync(chemin, { readOnly: true });
      autre.exec('PRAGMA busy_timeout = 200');
      if (!autre.prepare('PRAGMA table_info(disque_repartition)').all().some((c) => c.name === 'images_base')) return null;
      const l = autre.prepare('SELECT images_base FROM disque_repartition WHERE images_base IS NOT NULL ORDER BY instant DESC LIMIT 1').get();
      return l ? Number(l.images_base) : null;
    } catch {
      return null;
    } finally {
      try {
        autre?.close();
      } catch {
        // déjà fermée
      }
    }
  }

  /**
   * Le relevé de la répartition du disque (releverRepartition) : refait au plus toutes les `parcours.intervalle_ms` (10 minutes), sinon celui gardé.
   * `frais` : refait s'il a plus de la moitié de cet intervalle (échantillon noté dans la base).
   */
  function releveActuel({ frais = false, disque = null } = {}) {
    const maintenant = horloge();
    const age = releve ? maintenant - releve.instant : Infinity;
    if (age >= 0 && age < (frais ? parcours.intervalle_ms / 2 : parcours.intervalle_ms)) return releve;
    let images = 0;
    try {
      images = Number(imagesDeLaBase?.() ?? 0) || 0;
    } catch {
      images = 0; // base vivante fermée ou en cours de reconstruction : comptée dans « base »
    }
    const r = releverRepartition({
      vivante: fichiers.vivante ?? null, archives: fichiers.archives ?? null, miseAJour: fichiers.miseAJour ?? null, metriques: dossier, site: fichiers.site ?? null,
      imagesDeLaBase: images, bornes: parcours,
    });
    // le relevé de l'hôte (VPS : deploy/vps/volume.sh), s'il est là : ce que le conteneur ne voit pas (Docker, journaux, l'autre instance — dont
    // les images de la base, lues dans son fichier des métriques…)
    const hote = lireReleveDeLHote(join(dossier, RELEVE_HOTE.fichier), { instance: nom, maintenant, total: disque?.total ?? null, imagesDesInstances: imagesDeLInstance });
    // `images_base` : les images de SA base vivante (bornées par ce que la base occupe), notées avec la répartition pour l'autre instance
    releve = { instant: maintenant, ...r, comptes: comptesAvecLHote(r.comptes, hote), hote, images_base: r.images_base };
    return releve;
  }

  /** La répartition d'un disque mesuré maintenant (disqueDe) d'après le relevé gardé : { repartition, depasse, releve } ; null sans disque. */
  function repartitionActuelle(disque) {
    if (!disque?.total) return null;
    const r = releveActuel({ disque });
    return { ...repartitionDu({ total: disque.total, libre: disque.libre, reserve: disque.reserve, comptes: r.comptes }), releve: r };
  }

  /** L'état du processus en ce moment (sans remettre les compteurs à zéro). */
  function processusEnCeMoment() {
    const memoire = process.memoryUsage();
    const ecoule = Math.max(1, performance.now() - tempsPrecedent);
    const cpu = process.cpuUsage(cpuPrecedent);
    const boucleMs = (v) => (Number.isFinite(v) && boucle.count ? Math.max(0, v / 1e6 - RESOLUTION_BOUCLE) : null);
    return {
      rss: memoire.rss, tas_utilise: memoire.heapUsed, tas_total: memoire.heapTotal, externe: memoire.external,
      cpu_utilisateur_pct: arrondi((cpu.user / 1000 / ecoule) * 100), cpu_systeme_pct: arrondi((cpu.system / 1000 / ecoule) * 100),
      boucle_p50_ms: arrondi(boucleMs(boucle.percentile(50))), boucle_p99_ms: arrondi(boucleMs(boucle.percentile(99))), boucle_max_ms: arrondi(boucleMs(boucle.max)),
      charge: loadavg().map((x) => arrondi(x)),
    };
  }

  /** Un échantillon système (chaque minute) : gardé en mémoire jusqu'au versement ; les compteurs de la minute repartent de zéro. */
  function echantillonner() {
    return sur(() => {
      const p = processusEnCeMoment();
      const disque = disqueDe(fichiers.disque ?? dossier);
      const journalActuel = Number(compteurJournal?.() ?? 0);
      const e = {
        instant: secondes(), rss: p.rss, tas_utilise: p.tas_utilise, tas_total: p.tas_total, externe: p.externe,
        boucle_p50_ms: p.boucle_p50_ms, boucle_p99_ms: p.boucle_p99_ms, boucle_max_ms: p.boucle_max_ms,
        cpu_utilisateur_pct: p.cpu_utilisateur_pct, cpu_systeme_pct: p.cpu_systeme_pct, charge_1: p.charge[0], charge_5: p.charge[1], charge_15: p.charge[2],
        duree_s: Math.round(process.uptime()), en_cours: enCours, simultanees_max: simultaneesMax, requetes: requetesMinute, erreurs_5xx: erreursMinute,
        journal_entrees: Math.max(0, journalActuel - journalPrecedent), disque_libre: disque?.libre ?? null, disque_total: disque?.total ?? null, ...tailles(),
      };
      boucle.reset();
      cpuPrecedent = process.cpuUsage();
      tempsPrecedent = performance.now();
      journalPrecedent = journalActuel;
      simultaneesMax = enCours;
      requetesMinute = 0;
      erreursMinute = 0;
      dernierEchantillon = e;
      pousser(attente.minutes, e, MAX_EN_ATTENTE.minutes);
      evaluerRestriction(disque, e.taille_metriques);
      // la répartition du disque, une fois toutes les 10 minutes : le site de dev affiche celle de la production en lisant prod.db
      const maintenant = horloge();
      if (disque?.total && (releveNote === null || maintenant - releveNote >= parcours.intervalle_ms || maintenant < releveNote)) {
        const r = releveActuel({ frais: true, disque });
        pousser(attente.repartitions, {
          instant: e.instant, total: disque.total, libre: disque.libre, reserve: disque.reserve ?? null, comptes: JSON.stringify(r.comptes), partiel: r.partiel ? 1 : 0,
          images_base: r.images_base ?? null,
        }, MAX_EN_ATTENTE.repartitions);
        releveNote = maintenant;
      }
      return e;
    });
  }

  // ----- versement ----------------------------------------------------------------------------------------------------------------------------

  const enAttente = () => attente.heure.size + attente.cinq.size + attente.pages.size + attente.navigateurs.size + attente.origines.size
    + attente.minutes.length + attente.repartitions.length + attente.evenements.length + attente.brutes.length;

  /** L'identifiant d'un texte SQL normalisé (table sql_texte), dans la transaction du versement. */
  function idSql(texte) {
    if (texte === null || texte === undefined) return null;
    let id = idsSql.get(texte);
    if (id === undefined) {
      id = instructions.sqlId.get(texte)?.id ?? Number(instructions.sqlAjout.run(texte).lastInsertRowid);
      idsSql.set(texte, id);
    }
    return id;
  }

  const ligneAgregat = (e) => [e.debut, e.route, e.methode, ...COLONNES_SOMMES.map((c) => (/^h\d+$/.test(c) ? e.a.h[Number(c.slice(1))] : e.a[c])), e.a.min_ms, e.a.max_ms,
    e.a.sql_max_ms, idSql(e.a.sql_max)];
  const lignePage = (e) => [e.debut, e.page, e.p.n, ...MESURES_PAGE.flatMap((m) => {
    const x = e.p[m];
    return x.n ? [x.n, x.somme, x.somme2, x.min, x.max, ...x.h] : [0, 0, 0, null, null, ...x.h];
  })];

  /**
   * Verse les agrégats en mémoire dans la base, en une transaction (une fois par minute, et à l'arrêt). Rend vrai si tout est versé ; en cas de
   * panne, rien n'est perdu (la mémoire est gardée, bornée) et l'erreur est notée une fois.
   */
  function verser() {
    if (!enAttente()) return true;
    if (!ouvrir()) return false;
    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const e of attente.heure.values()) instructions.heure.run(...ligneAgregat(e));
        for (const e of attente.cinq.values()) instructions.cinq.run(...ligneAgregat(e));
        for (const e of attente.pages.values()) instructions.page.run(...lignePage(e));
        for (const e of attente.navigateurs.values()) instructions.navigateur.run(e.debut, e.famille, e.appareil, e.requetes, e.pages);
        for (const e of attente.origines.values()) instructions.origine.run(e.debut, e.page, e.route, e.n);
        for (const e of attente.minutes) instructions.minute.run(e.instant, ...COLONNES_MINUTE.map((c) => e[c] ?? null));
        for (const e of attente.repartitions) instructions.repartition.run(e.instant, e.total, e.libre, e.comptes, e.partiel, e.reserve ?? null, e.images_base ?? null);
        for (const e of attente.evenements) instructions.evenement.run(e.instant_ms, e.type, e.duree_ms, e.detail);
        for (const e of attente.brutes) {
          instructions.brute.run(e.instant_ms, e.methode, e.route, e.statut, e.duree_ms, e.phases.corps_ms, e.phases.traitement_ms, e.phases.envoi_ms,
            e.octets_entree, e.octets_sortie, e.sql.n, e.sql.ms, idSql(e.sql.plus_lente?.sql), e.sql.plus_lente?.ms ?? null, e.page, e.navigateur, e.appareil, e.simultanees);
        }
        db.exec('COMMIT');
      } catch (e) {
        idsSql.clear();
        try {
          db.exec('ROLLBACK');
        } catch {
          // déjà annulée par SQLite
        }
        throw e;
      }
    } catch (e) {
      noterPanne(e);
      return false;
    }
    for (const m of [attente.heure, attente.cinq, attente.pages, attente.navigateurs, attente.origines]) m.clear();
    versements += 1;
    attente.minutes.length = 0;
    attente.repartitions.length = 0;
    attente.evenements.length = 0;
    attente.brutes.length = 0;
    if (panne) {
      const ancienne = panne;
      panne = null;
      journal(`métriques : ${fichier} de nouveau disponible`, { categorie: 'metriques' });
      pousserEvenement('metriques', null, { reprise: true, panne: ancienne });
    }
    return true;
  }

  /**
   * Purge : ce qui dépasse RETENTION est supprimé ; les échantillons par minute de plus de 14 jours sont d'abord résumés par heure ; puis VACUUM
   * incrémental (auto_vacuum INCREMENTAL : les pages libérées rendent la place au disque). Rend { lignes: { table: n }, duree_ms } ou null (panne).
   */
  function purger() {
    if (!ouvrir()) return null;
    const t0 = performance.now();
    const maintenant = horloge();
    const s = Math.floor(maintenant / 1000);
    const lignes = {};
    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        const limiteMinutes = tranche(s - RETENTION.echantillons_minute * 86_400, 3600);
        db.prepare(`INSERT OR REPLACE INTO systeme_heure SELECT (instant / 3600) * 3600, count(*), avg(rss), max(rss), avg(tas_utilise), max(tas_utilise),
          avg(boucle_p99_ms), max(boucle_p99_ms), max(boucle_max_ms), avg(coalesce(cpu_utilisateur_pct, 0) + coalesce(cpu_systeme_pct, 0)),
          max(coalesce(cpu_utilisateur_pct, 0) + coalesce(cpu_systeme_pct, 0)), avg(charge_1), max(en_cours), max(simultanees_max), sum(requetes),
          sum(erreurs_5xx), min(disque_libre), max(disque_total), max(taille_vivante), max(taille_archives), max(taille_mise_a_jour), max(taille_metriques),
          max(taille_logique) FROM systeme_minute WHERE instant < ? GROUP BY instant / 3600`).run(limiteMinutes);
        // répartition du disque : au-delà de 14 jours, seulement la dernière de chaque jour (UTC)
        const limiteRepartitions = s - RETENTION.repartition_10min * 86_400;
        const eclaircies = Number(db.prepare(`DELETE FROM disque_repartition WHERE instant < ? AND instant NOT IN
          (SELECT max(instant) FROM disque_repartition WHERE instant < ? GROUP BY instant / 86400)`).run(limiteRepartitions, limiteRepartitions).changes);
        for (const t of TABLES_DATEES) {
          const limite = t.table === 'systeme_minute' ? limiteMinutes : s - RETENTION[t.retention] * 86_400;
          lignes[t.table] = Number(db.prepare(`DELETE FROM ${t.table} WHERE ${t.colonne} < ?`).run(t.ms ? limite * 1000 : limite).changes);
        }
        lignes.disque_repartition += eclaircies;
        lignes.sql_texte = Number(db.prepare(`DELETE FROM sql_texte WHERE id NOT IN (SELECT sql_max_id FROM agregat_heure WHERE sql_max_id IS NOT NULL
          UNION SELECT sql_max_id FROM agregat_5min WHERE sql_max_id IS NOT NULL UNION SELECT sql_lente_id FROM requete_brute WHERE sql_lente_id IS NOT NULL)`).run().changes);
        db.prepare("INSERT OR REPLACE INTO meta (cle, valeur) VALUES ('derniere_purge_ms', ?)").run(String(maintenant));
        db.exec('COMMIT');
      } catch (e) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // déjà annulée
        }
        throw e;
      }
      idsSql.clear();
      db.exec('PRAGMA incremental_vacuum');
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      dernierePurge = maintenant;
    } catch (e) {
      noterPanne(e);
      return null;
    }
    const resultat = { lignes, duree_ms: arrondi(performance.now() - t0) };
    pousserEvenement('purge_metriques', resultat.duree_ms, { lignes });
    return resultat;
  }

  /** Une minute : échantillon, versement, et la purge si la dernière a plus d'un jour. */
  function minute() {
    sur(() => {
      echantillonner();
      if (ouvrir() && dernierePurge !== null && horloge() - dernierePurge >= INTERVALLE_PURGE) purger();
      verser();
    });
  }

  if (intervalle > 0) {
    minuterie = setInterval(minute, intervalle);
    minuterie.unref?.();
  }
  sur(() => ouvrir());
  // une base déjà au plafond (ou un disque déjà bas) au démarrage : restreinte tout de suite, sans attendre le premier échantillon
  sur(() => evaluerRestriction(disqueDe(fichiers.disque ?? dossier), tailleFichier(fichier) + tailleFichier(`${fichier}-wal`)));

  /**
   * Arrête la collecte : un dernier échantillon (les requêtes de la minute entamée ne sont pas perdues ; la répartition du disque, si aucune n'est
   * encore notée, pour que le site de dev en ait une), un dernier versement, puis la base est fermée.
   */
  function arreter() {
    if (arrete) return;
    arrete = true;
    if (minuterie) clearInterval(minuterie);
    echantillonner();
    boucle.disable();
    sur(() => verser());
    if (db) {
      sur(() => db.close());
      db = null;
    }
  }

  // ----- lecture ------------------------------------------------------------------------------------------------------------------------------

  /** Les instances dont le fichier existe dans le dossier des métriques (celle-ci toujours en tête). */
  function instances() {
    let noms = [];
    try {
      noms = readdirSync(dossier).filter((n) => /\.db$/.test(n)).map((n) => n.slice(0, -3)).filter((n) => NOM_D_INSTANCE.test(n));
    } catch {
      // dossier absent : seulement celle-ci
    }
    return [nom, ...noms.filter((n) => n !== nom).sort()];
  }

  /**
   * Exécute `lire(source)` sur les données d'une instance : celle-ci (versement d'abord ; la mémoire s'y ajoute si la base est en panne) ou une
   * autre, ouverte en LECTURE SEULE le temps de la lecture. 404 si l'autre instance n'a pas de fichier, 400 si le nom est invalide.
   */
  function avecSource(demandee, lire) {
    const nomLu = demandee === undefined || demandee === null || demandee === '' ? nom : String(demandee);
    if (!NOM_D_INSTANCE.test(nomLu)) throw new ErreurMetriques(400, `Instance invalide : « ${nomLu} » (dev, prod…).`);
    if (nomLu === nom) {
      sur(() => verser());
      // la mémoire n'a plus rien après un versement réussi ; en panne, elle garde ce que la base n'a pas reçu (jamais compté deux fois)
      return lire({ nom: nomLu, db, memoire: true, propre: true });
    }
    const chemin = join(dossier, `${nomLu}.db`);
    if (!existsSync(chemin)) throw new ErreurMetriques(404, `Pas de métriques pour l’instance « ${nomLu} » : ${nomLu}.db est absent de ${dossier}.`);
    let autre;
    try {
      autre = new DatabaseSync(chemin, { readOnly: true });
      autre.exec('PRAGMA busy_timeout = 500');
      if (!autre.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'agregat_heure'").get()) {
        throw new ErreurMetriques(404, `Le fichier des métriques de « ${nomLu} » n’a pas encore de données.`);
      }
    } catch (e) {
      try {
        autre?.close();
      } catch {
        // déjà fermée
      }
      if (e instanceof ErreurMetriques) throw e;
      throw new ErreurMetriques(503, `Métriques de « ${nomLu} » illisibles pour le moment : ${e.message}`);
    }
    try {
      return lire({ nom: nomLu, db: autre, memoire: false, propre: false });
    } finally {
      autre.close();
    }
  }

  const texteSql = (src, id) => (id === null || id === undefined ? null : src.db?.prepare('SELECT texte FROM sql_texte WHERE id = ?').get(id)?.texte ?? null);

  /** Les agrégats d'une table par route × méthode depuis `depuis` (secondes), base et mémoire fusionnées. */
  function agregatsParRoute(src, table, depuis) {
    const groupes = new Map();
    const groupe = (route, methode) => cle(groupes, `${route}\u0000${methode}`, () => ({ route, methode, a: nouvelAgregat() }), Infinity).a;
    if (src.db) {
      const nomTable = table === 'cinq' ? 'agregat_5min' : 'agregat_heure';
      for (const l of src.db.prepare(`SELECT route, methode, ${SOMMES_AGREGAT} FROM ${nomTable} WHERE debut >= ? GROUP BY route, methode`).all(depuis)) {
        fusionnerAgregats(groupe(l.route, l.methode), agregatDeLigne(l));
      }
      // la requête SQL la plus lente de chaque route (une seule agrégation max : SQLite prend les autres colonnes sur sa ligne)
      for (const l of src.db.prepare(`SELECT route, methode, sql_max_id, max(sql_max_ms) AS sql_max_ms FROM ${nomTable} WHERE debut >= ? AND sql_max_ms IS NOT NULL GROUP BY route, methode`).all(depuis)) {
        const a = groupe(l.route, l.methode);
        if (a.sql_max_ms === null || l.sql_max_ms > a.sql_max_ms) {
          a.sql_max_ms = l.sql_max_ms;
          a.sql_max = texteSql(src, l.sql_max_id);
        }
      }
    }
    if (src.memoire) for (const e of attente[table].values()) if (e.debut >= depuis) fusionnerAgregats(groupe(e.route, e.methode), e.a);
    return groupes;
  }

  /** La série d'une période : un point par pas, de `depuis` à `jusqua` (pas vides compris), sans les relèves automatiques (estUneReleve). */
  function serie(src, table, depuis, jusqua, pas) {
    const points = new Map();
    const point = (t) => cle(points, t, () => nouvelAgregat(), Infinity);
    if (src.db) {
      const nomTable = table === 'cinq' ? 'agregat_5min' : 'agregat_heure';
      for (const l of src.db.prepare(`SELECT (debut / ${pas}) * ${pas} AS t, ${SOMMES_AGREGAT} FROM ${nomTable} WHERE debut >= ? AND NOT (${SQL_RELEVE}) GROUP BY t`).all(depuis)) {
        fusionnerAgregats(point(l.t), agregatDeLigne(l));
      }
    }
    if (src.memoire) for (const e of attente[table].values()) if (e.debut >= depuis && !estUneReleve(e.methode, e.route)) fusionnerAgregats(point(tranche(e.debut, pas)), e.a);
    const resultat = [];
    for (let t = tranche(depuis, pas); t <= jusqua; t += pas) {
      const a = points.get(t) ?? nouvelAgregat();
      const s = statistiques(a);
      resultat.push({ debut: iso(t), n: s.n, moyenne_ms: s.moyenne_ms, p95_ms: s.p95_ms, erreurs: s.erreurs_4xx + s.erreurs_5xx, erreurs_5xx: s.erreurs_5xx });
    }
    return resultat;
  }

  /**
   * Les pages vues d'une période (les LIGNES_LUES_MAX plus vues : classées par SQLite, seules leurs sommes et leurs histogrammes sont lus), avec la
   * moyenne et le p95 de chaque mesure (BORNES_PAGE_MS ; `au_dela` : les p95 qui ne sont qu'une borne basse, au-delà de 60 000 ms). Le fichier d'une
   * autre instance d'avant le schéma 4 (lecture seule) : sans histogramme, les moyennes seules.
   */
  function pagesVues(src, depuis) {
    const groupes = new Map();
    const groupe = (page) => cle(groupes, page, () => nouvellePage(), Infinity);
    if (src.db) {
      const avecHistogramme = src.db.prepare('PRAGMA table_info(page_heure)').all().some((c) => c.name === `${MESURES_PAGE[0]}_c0`);
      const plusVues = `SELECT page FROM page_heure WHERE debut >= ? GROUP BY page ORDER BY sum(n) DESC, page LIMIT ${LIGNES_LUES_MAX}`;
      for (const l of src.db.prepare(`SELECT page, ${avecHistogramme ? SOMMES_PAGE : SOMMES_PAGE_SANS_HISTOGRAMME} FROM page_heure WHERE debut >= ? AND page IN (${plusVues}) GROUP BY page`).all(depuis, depuis)) {
        const p = groupe(l.page);
        p.n += Number(l.n ?? 0);
        for (const m of MESURES_PAGE) fusionnerMesures(p[m], mesureDeLigne(l, m));
      }
    }
    if (src.memoire) {
      for (const e of attente.pages.values()) {
        if (e.debut < depuis) continue;
        const p = groupe(e.page);
        p.n += e.p.n;
        for (const m of MESURES_PAGE) fusionnerMesures(p[m], e.p[m]);
      }
    }
    return [...groupes].map(([page, p]) => {
      const ligne = { page, n: p.n };
      const auDela = [];
      for (const m of MESURES_PAGE) {
        const x = p[m];
        const q = quantileDetaille(x.h, 0.95, x.min, x.max, BORNES_PAGE_MS);
        ligne[`${m}_ms`] = x.n ? arrondi(x.somme / x.n) : null;
        ligne[`${m}_p95_ms`] = x.n ? arrondi(q.valeur) : null;
        ligne[`${m}_n`] = x.n;
        if (x.n && q.au_dela) auDela.push(`${m}_p95_ms`);
      }
      ligne.au_dela = auDela;
      return ligne;
    }).sort((a, b) => b.n - a.n || a.page.localeCompare(b.page)).slice(0, LIGNES_LUES_MAX);
  }

  function navigateurs(src, depuis) {
    const groupes = new Map();
    if (src.db) {
      for (const l of src.db.prepare('SELECT famille, appareil, sum(requetes) AS requetes, sum(pages) AS pages FROM navigateur_heure WHERE debut >= ? GROUP BY famille, appareil').all(depuis)) {
        const g = cle(groupes, `${l.famille}\u0000${l.appareil}`, () => ({ famille: l.famille, appareil: l.appareil, n: 0, pages: 0 }), Infinity);
        g.n += Number(l.requetes);
        g.pages += Number(l.pages);
      }
    }
    if (src.memoire) {
      for (const e of attente.navigateurs.values()) {
        if (e.debut < depuis) continue;
        const g = cle(groupes, `${e.famille}\u0000${e.appareil}`, () => ({ famille: e.famille, appareil: e.appareil, n: 0, pages: 0 }), Infinity);
        g.n += e.requetes;
        g.pages += e.pages;
      }
    }
    return [...groupes.values()].sort((a, b) => b.n - a.n || b.pages - a.pages || a.famille.localeCompare(b.famille));
  }

  function origines(src, depuis) {
    const groupes = new Map();
    const ajouter = (page, route, n) => {
      cle(groupes, `${page}\u0000${route}`, () => ({ page, route, n: 0 }), Infinity).n += n;
    };
    // classées et coupées par SQLite : jamais toutes les lignes de la période en mémoire
    if (src.db) {
      for (const l of src.db.prepare(`SELECT page, route, sum(n) AS n FROM origine_heure WHERE debut >= ? GROUP BY page, route ORDER BY n DESC, page, route LIMIT ${LIGNES_LUES_MAX}`).all(depuis)) {
        ajouter(l.page, l.route, Number(l.n));
      }
    }
    if (src.memoire) for (const e of attente.origines.values()) if (e.debut >= depuis) ajouter(e.page, e.route, e.n);
    return [...groupes.values()].sort((a, b) => b.n - a.n || a.page.localeCompare(b.page) || a.route.localeCompare(b.route)).slice(0, LIGNES_LUES_MAX);
  }

  /** Le début d'une période (secondes, début d'une tranche du pas) ; « tout » : la première donnée. */
  function bornes(src, periode, maintenant) {
    const p = PERIODES[periode];
    if (!p) throw new ErreurMetriques(400, `Période inconnue : « ${periode} » (${Object.keys(PERIODES).join(', ')}).`);
    let depuis;
    if (p.duree === null) {
      const premiere = src.db?.prepare('SELECT min(debut) AS d FROM agregat_heure').get()?.d ?? null;
      let enMemoire = Infinity;
      if (src.memoire) for (const e of attente.heure.values()) if (e.debut < enMemoire) enMemoire = e.debut;
      depuis = Math.min(premiere ?? Infinity, enMemoire);
      if (!Number.isFinite(depuis)) depuis = maintenant;
      depuis = tranche(depuis, p.pas);
    } else depuis = tranche(maintenant, p.pas) - p.duree + p.pas; // la tranche en cours et les précédentes : 12 × 5 min, 24 h, 168 h, 30 jours…
    return { ...p, depuis, jusqua: maintenant };
  }

  /**
   * La clé de la lecture gardée d'une période (CACHE_LECTURE_MS), ou null quand elle n'est pas gardée : les périodes de 7 jours et plus de cette
   * instance (valables tant qu'aucun versement n'a rien écrit depuis) ; toutes celles d'une autre instance (valables tant que son fichier et son
   * WAL n'ont pas changé).
   */
  function cleDeLecture(src, periode, tri) {
    if (src.propre) return ['24h', '1h'].includes(periode) ? null : `${src.nom}\u0000${periode}\u0000${tri}\u0000${versements}\u0000${enAttente()}`;
    const chemin = join(dossier, `${src.nom}.db`);
    const date = (c) => {
      try {
        return statSync(c).mtimeMs;
      } catch {
        return 0;
      }
    };
    return `${src.nom}\u0000${periode}\u0000${tri}\u0000${date(chemin)}\u0000${date(`${chemin}-wal`)}`;
  }

  /**
   * GET /api/debug/metriques/ : les statistiques d'une instance sur une période (voir l'en-tête du module et docs/api.md). `global` et `serie` sont
   * SANS les relèves automatiques (estUneReleve : journal, version de la base, métriques et système de la page Debug, maintenance, balise), qui
   * restent chacune sur sa ligne de `routes` ; `global_avec_releves` les compte, `releves` = { n, routes } les nomme. Les pages vues, navigateurs
   * et origines n'existent que par heure : leur fenêtre commence à `depuis_horaire` (le début de l'heure de `depuis` : une heure de plus au plus
   * pour « 1h »).
   */
  function lire({ instance: demandee, periode = '24h', tri = 'moyenne' } = {}) {
    if (!TRIS.includes(tri)) throw new ErreurMetriques(400, `Tri inconnu : « ${tri} » (${TRIS.join(', ')}).`);
    if (!PERIODES[periode]) throw new ErreurMetriques(400, `Période inconnue : « ${periode} » (${Object.keys(PERIODES).join(', ')}).`);
    return avecSource(demandee, (src) => {
      const maintenant = secondes();
      const k = cleDeLecture(src, periode, tri);
      const gardee = k === null ? null : lectures.get(k);
      if (gardee && horloge() - gardee.instant < CACHE_LECTURE_MS && horloge() >= gardee.instant) return structuredClone(gardee.valeur);
      const b = bornes(src, periode, maintenant);
      const groupes = agregatsParRoute(src, b.table, b.depuis);
      const global = nouvelAgregat();
      const avecReleves = nouvelAgregat();
      const releves = [];
      const routes = [];
      for (const g of groupes.values()) {
        fusionnerAgregats(avecReleves, g.a);
        if (estUneReleve(g.methode, g.route)) releves.push({ methode: g.methode, route: g.route, n: g.a.n });
        else fusionnerAgregats(global, g.a);
        routes.push({ route: g.route, methode: g.methode, ...statistiques(g.a) });
      }
      routes.sort((x, y) => (valeurDeTri(y, tri) ?? -Infinity) - (valeurDeTri(x, tri) ?? -Infinity) || x.route.localeCompare(y.route) || x.methode.localeCompare(y.methode));
      const horaire = tranche(b.depuis, 3600);
      const valeur = {
        instance: src.nom, instances: instances(), periode, tri, depuis: iso(b.depuis), jusqua: iso(b.jusqua), depuis_horaire: iso(horaire),
        pas: b.pas === 300 ? '5min' : b.pas === 3600 ? 'heure' : 'jour', bornes_ms: BORNES_MS, bornes_page_ms: BORNES_PAGE_MS,
        global: statistiques(global), global_avec_releves: statistiques(avecReleves),
        releves: { n: releves.reduce((n, r) => n + r.n, 0), routes: releves.sort((x, y) => y.n - x.n).map((r) => `${r.methode} ${r.route}`) },
        routes, serie: serie(src, b.table, b.depuis, b.jusqua, b.pas),
        pages: pagesVues(src, horaire), navigateurs: navigateurs(src, horaire), origines: origines(src, horaire),
        ...(src.propre ? { panne, perdues, restreintes: restriction ? { raison: restriction.raison, depuis: isoMs(restriction.depuis) } : null } : {}),
      };
      if (k !== null) {
        if (lectures.size >= 32) lectures.clear();
        lectures.set(k, { instant: horloge(), valeur: structuredClone(valeur) });
      }
      return valeur;
    });
  }

  /**
   * GET /api/debug/metriques/requetes/ : les dernières requêtes gardées en mémoire (les plus récentes d'abord), filtrées : `route` (le gabarit
   * contient ce texte), `route_exacte` (le gabarit est exactement celui-ci : la liste « Route » de la page Debug), `min_ms`, `statut`.
   */
  function requetes({ limite, route, route_exacte: routeExacte, min_ms: minMs, statut } = {}) {
    const max = Math.min(capacite || CAPACITE_REQUETES, Math.max(1, Math.floor(Number(limite) || 200)));
    const seuil = Number(minMs);
    const filtreStatut = String(statut ?? '').trim().toLowerCase();
    const classe = /^[1-5]xx$/.test(filtreStatut) ? Number(filtreStatut[0]) : null;
    const exact = /^\d{3}$/.test(filtreStatut) ? Number(filtreStatut) : null;
    if (filtreStatut && classe === null && exact === null) throw new ErreurMetriques(400, `Statut : un code (« 404 ») ou une classe (« 5xx ») est attendu, pas « ${statut} ».`);
    const resultat = [];
    for (let i = anneau.length - 1; i >= 0 && resultat.length < max; i--) {
      const r = anneau[i];
      if (route && !r.route.includes(String(route))) continue;
      if (routeExacte && r.route !== String(routeExacte)) continue;
      if (Number.isFinite(seuil) && minMs !== undefined && minMs !== '' && r.duree_ms < seuil) continue;
      if (classe !== null && Math.floor(r.statut / 100) !== classe) continue;
      if (exact !== null && r.statut !== exact) continue;
      resultat.push(structuredClone(r));
    }
    return { instance: nom, capacite, requetes: resultat };
  }

  /** Les tailles et le disque, d'après le dernier échantillon d'une autre instance (son processus n'est pas lisible d'ici). */
  function fichiersDe(src, echantillon) {
    if (src.propre) {
      const liste = [];
      const ajouter = (nomFichier, chemin, octets) => liste.push({ nom: nomFichier, chemin, octets });
      if (fichiers.vivante) {
        for (const suffixe of ['', '-wal', '-shm']) if (existsSync(`${fichiers.vivante}${suffixe}`)) ajouter(`base vivante${suffixe}`, `${fichiers.vivante}${suffixe}`, tailleFichier(`${fichiers.vivante}${suffixe}`));
      }
      if (fichiers.archives) ajouter('archives/', fichiers.archives, tailleDossier(fichiers.archives));
      if (fichiers.miseAJour) ajouter('mise-a-jour/', fichiers.miseAJour, tailleDossier(fichiers.miseAJour));
      for (const n of instances()) {
        const c = join(dossier, `${n}.db`);
        if (existsSync(c)) ajouter(`métriques ${n}`, c, tailleFichier(c) + tailleFichier(`${c}-wal`));
      }
      return liste;
    }
    if (!echantillon) return [];
    return [
      { nom: 'base vivante', chemin: null, octets: echantillon.taille_vivante },
      { nom: 'archives/', chemin: null, octets: echantillon.taille_archives },
      { nom: 'mise-a-jour/', chemin: null, octets: echantillon.taille_mise_a_jour },
      { nom: `métriques ${src.nom}`, chemin: join(dossier, `${src.nom}.db`), octets: tailleFichier(join(dossier, `${src.nom}.db`)) + tailleFichier(join(dossier, `${src.nom}.db-wal`)) },
    ];
  }

  function echantillons(src, depuis, parHeure) {
    const champs = ['rss', 'tas_utilise', 'boucle_p99_ms', 'cpu_utilisateur_pct', 'cpu_systeme_pct', 'disque_libre', 'en_cours', 'requetes', 'erreurs_5xx', 'taille_vivante', 'taille_archives', 'taille_metriques'];
    const lignes = [];
    if (src.db) {
      if (parHeure) {
        const resumees = src.db.prepare(`SELECT debut AS instant, rss_moyen AS rss, tas_utilise_moyen AS tas_utilise, boucle_p99_moyen_ms AS boucle_p99_ms,
          cpu_moyen_pct AS cpu_pct, disque_libre_min AS disque_libre, en_cours_max AS en_cours, requetes, erreurs_5xx, taille_vivante_max AS taille_vivante,
          taille_archives_max AS taille_archives, taille_metriques_max AS taille_metriques FROM systeme_heure WHERE debut >= ?`).all(depuis);
        const recentes = src.db.prepare(`SELECT (instant / 3600) * 3600 AS instant, avg(rss) AS rss, avg(tas_utilise) AS tas_utilise, avg(boucle_p99_ms) AS boucle_p99_ms,
          avg(coalesce(cpu_utilisateur_pct, 0) + coalesce(cpu_systeme_pct, 0)) AS cpu_pct, min(disque_libre) AS disque_libre, max(en_cours) AS en_cours,
          sum(requetes) AS requetes, sum(erreurs_5xx) AS erreurs_5xx, max(taille_vivante) AS taille_vivante, max(taille_archives) AS taille_archives,
          max(taille_metriques) AS taille_metriques FROM systeme_minute WHERE instant >= ? GROUP BY instant / 3600`).all(depuis);
        const vues = new Set(recentes.map((l) => l.instant));
        lignes.push(...resumees.filter((l) => !vues.has(l.instant)), ...recentes);
      } else {
        for (const l of src.db.prepare(`SELECT instant, ${champs.join(', ')} FROM systeme_minute WHERE instant >= ? ORDER BY instant`).all(depuis)) {
          lignes.push({ ...l, cpu_pct: (l.cpu_utilisateur_pct ?? 0) + (l.cpu_systeme_pct ?? 0) });
        }
      }
    }
    if (src.memoire) for (const e of attente.minutes) if (e.instant >= depuis) lignes.push({ ...e, cpu_pct: (e.cpu_utilisateur_pct ?? 0) + (e.cpu_systeme_pct ?? 0) });
    return lignes.sort((a, b) => a.instant - b.instant).map((l) => ({
      instant: iso(l.instant), rss: l.rss === null ? null : Math.round(l.rss), tas_utilise: l.tas_utilise === null ? null : Math.round(l.tas_utilise),
      boucle_p99_ms: arrondi(l.boucle_p99_ms), cpu_pct: arrondi(l.cpu_pct), disque_libre: l.disque_libre ?? null, en_cours: l.en_cours ?? null,
      requetes: l.requetes ?? null, erreurs_5xx: l.erreurs_5xx ?? null, taille_vivante: l.taille_vivante ?? null, taille_archives: l.taille_archives ?? null,
      taille_metriques: l.taille_metriques ?? null,
    }));
  }

  function evenements(src, depuisMs, limite = 500) {
    const lignes = [];
    if (src.db) lignes.push(...src.db.prepare('SELECT id, instant_ms, type, duree_ms, detail FROM evenement WHERE instant_ms >= ? ORDER BY instant_ms DESC, id DESC LIMIT ?').all(depuisMs, limite));
    if (src.memoire) lignes.push(...attente.evenements.filter((e) => e.instant_ms >= depuisMs));
    return lignes.sort((a, b) => b.instant_ms - a.instant_ms).slice(0, limite).map((e) => {
      let detail = null;
      try {
        detail = e.detail ? JSON.parse(e.detail) : null;
      } catch {
        detail = { texte: e.detail };
      }
      return { instant: isoMs(e.instant_ms), type: e.type, duree_ms: e.duree_ms ?? null, detail };
    });
  }

  /**
   * Le volume de la base des métriques d'une instance (GET /api/debug/systeme/, `volume`) — calculé au plus une fois toutes les 10 minutes par
   * instance (dbstat lit toute la base) :
   *   metriques_octets            la taille actuelle : fichier + WAL ;
   *   taille_logique_octets       les pages qui portent des données ((page_count − freelist_count) × page_size), sans le WAL ni les pages libres ;
   *   debit_ecriture_octets_par_jour  ce qui s'écrit par jour, toutes tables (lignes par jour × octets par ligne), y compris ce que la rétention
   *                               purge vite (5 minutes : 2 jours ; échantillons par minute : 14 jours) — un débit, pas une croissance ;
   *   croissance_estimee_octets_par_jour  la croissance EN RÉGIME : les seules tables gardées un an ou plus (agrégats horaires, pages, navigateurs,
   *                               origines, résumés par heure, une répartition par jour, évènements) ;
   *   croissance_mesuree_octets_par_jour  la taille LOGIQUE d'aujourd'hui comparée à celle d'il y a au moins 7 jours (jamais le WAL, qui va de 0 à
   *                               ~4 Mio au fil des points de contrôle ; null avant 7 jours de mesures) ;
   *   croissance_octets_par_jour  celle qu'on retient : la mesurée si elle porte sur 7 jours au moins et ne s'écarte pas de l'estimée de plus d'un
   *                               facteur 2 (sinon l'estimée : les premières semaines, la mesure compte encore le remplissage des tables courtes) ;
   *                               `croissance_source` = « mesuree » ou « estimee » ;
   *   projection_un_an_octets     la taille dans un an, table par table, chaque table à sa rétention (min(rétention, âge + 365 jours)) ;
   *   taille_a_terme_octets       la taille à rétention pleine (400 jours), table par table ;
   *   lignes_par_jour, octets_par_ligne, retention, brutes, pages (les réglages de l'instance : ceux d'une autre lus dans son dernier démarrage).
   */
  function volume(src, maintenantS) {
    const chemin = join(dossier, `${src.nom}.db`);
    const octets = tailleFichier(chemin) + tailleFichier(`${chemin}-wal`);
    const deja = volumes.get(src.nom);
    if (deja && maintenantS - deja.instant < 600 && maintenantS >= deja.instant) return { ...deja.valeur, metriques_octets: octets };
    let reglages = { brutes: src.propre ? Boolean(brutes) : null, pages: src.propre ? Boolean(pages) : null };
    if (!src.propre && src.db) {
      try {
        const d = JSON.parse(src.db.prepare("SELECT detail FROM evenement WHERE type = 'demarrage' ORDER BY instant_ms DESC, id DESC LIMIT 1").get()?.detail ?? '{}');
        reglages = { brutes: typeof d.brutes === 'boolean' ? d.brutes : null, pages: typeof d.pages === 'boolean' ? d.pages : null };
      } catch {
        // pas de démarrage lisible : réglages inconnus
      }
    }
    const resultat = {
      metriques_octets: octets, taille_logique_octets: null, croissance_octets_par_jour: null, croissance_source: null,
      croissance_mesuree_octets_par_jour: null, croissance_mesuree_jours: null, croissance_estimee_octets_par_jour: null, debit_ecriture_octets_par_jour: null,
      projection_un_an_octets: null, taille_a_terme_octets: null, lignes_par_jour: {}, octets_par_ligne: {}, retention: RETENTION, ...reglages,
    };
    if (!src.db) return resultat;
    try {
      const colonnes = new Set(src.db.prepare('PRAGMA table_info(systeme_minute)').all().map((c) => c.name));
      if (colonnes.has('taille_logique')) {
        const logique = src.propre ? tailleLogique() : null;
        const recent = src.db.prepare('SELECT instant, taille_logique AS t FROM systeme_minute WHERE taille_logique IS NOT NULL ORDER BY instant DESC LIMIT 1').get();
        resultat.taille_logique_octets = logique ?? (recent ? Number(recent.t) : null);
        const limite = (recent?.instant ?? maintenantS) - 7 * 86_400;
        const ancien = src.db.prepare('SELECT instant, taille_logique AS t FROM systeme_minute WHERE instant <= ? AND taille_logique IS NOT NULL ORDER BY instant DESC LIMIT 1').get(limite)
          ?? src.db.prepare('SELECT debut AS instant, taille_logique_max AS t FROM systeme_heure WHERE debut <= ? AND taille_logique_max IS NOT NULL ORDER BY debut DESC LIMIT 1').get(limite);
        if (ancien && recent && recent.instant > ancien.instant) {
          resultat.croissance_mesuree_octets_par_jour = Math.round(((Number(recent.t) - Number(ancien.t)) * 86_400) / (recent.instant - ancien.instant));
          resultat.croissance_mesuree_jours = Math.round(((recent.instant - ancien.instant) / 86_400) * 10) / 10;
        }
      }
      const parLigne = octetsParLigne(src.db);
      const creeLe = Number(src.db.prepare("SELECT valeur FROM meta WHERE cle = 'cree_le_ms'").get()?.valeur ?? maintenantS * 1000) / 1000;
      const age = Math.max(60, maintenantS - creeLe);
      const ageJours = age / 86_400;
      let debit = 0;
      let regime = 0;
      let unAn = 0;
      let aTerme = 0;
      for (const t of TABLES_DATEES) {
        let jour = 0;
        try {
          jour = lignesParJour(src.db, t, maintenantS, age);
        } catch {
          // table absente d'une base plus ancienne (lue en lecture seule)
        }
        resultat.lignes_par_jour[t.table] = Math.round(jour);
        resultat.octets_par_ligne[t.table] = parLigne[t.table];
        debit += jour * parLigne[t.table];
        // la taille d'une table après `jours` de collecte : chacune à sa rétention ; la répartition du disque : 144 par jour pendant 14 jours, puis
        // une par jour jusqu'à 400 jours ; les échantillons par minute ne vivent que 14 jours (puis 24 résumés par jour : systeme_heure)
        const apres = (jours) => (t.table === 'disque_repartition'
          ? parLigne[t.table] * (jour * Math.min(jours, RETENTION.repartition_10min) + Math.max(0, Math.min(jours, RETENTION.repartition_jour) - RETENTION.repartition_10min))
          : jour * parLigne[t.table] * Math.min(jours, RETENTION[t.retention]));
        unAn += apres(ageJours + 365);
        aTerme += apres(Infinity);
        // en régime : les tables gardées un an ou plus (la répartition : une ligne par jour)
        if (t.table === 'disque_repartition') regime += parLigne[t.table];
        else if (RETENTION[t.retention] >= 365) regime += jour * parLigne[t.table];
      }
      resultat.debit_ecriture_octets_par_jour = Math.round(debit);
      resultat.croissance_estimee_octets_par_jour = Math.round(regime);
      resultat.projection_un_an_octets = Math.round(unAn);
      resultat.taille_a_terme_octets = Math.round(aTerme);
    } catch {
      // une base plus ancienne ou verrouillée : le volume reste partiel
    }
    const estimee = resultat.croissance_estimee_octets_par_jour;
    const mesuree = resultat.croissance_mesuree_octets_par_jour;
    const accord = mesuree !== null && resultat.croissance_mesuree_jours >= 7
      && (estimee === null || estimee <= 0 ? true : mesuree >= estimee / 2 && mesuree <= estimee * 2);
    resultat.croissance_octets_par_jour = accord ? mesuree : estimee ?? mesuree;
    resultat.croissance_source = resultat.croissance_octets_par_jour === null ? null : accord ? 'mesuree' : 'estimee';
    volumes.set(src.nom, { instant: maintenantS, valeur: resultat });
    return resultat;
  }

  /** La restriction d'une autre instance, d'après son dernier évènement « metriques_restreintes » (actif : { raison, depuis }) ; null sinon. */
  function restrictionDe(src) {
    try {
      const l = src.db?.prepare("SELECT instant_ms, detail FROM evenement WHERE type = 'metriques_restreintes' ORDER BY instant_ms DESC, id DESC LIMIT 1").get();
      const d = l?.detail ? JSON.parse(l.detail) : null;
      return d?.actif ? { raison: String(d.raison ?? ''), depuis: Number(l.instant_ms) } : null;
    } catch {
      return null;
    }
  }

  /** GET /api/debug/systeme/ : l'état du processus, du disque et des fichiers, les échantillons, les évènements, le volume et les alertes. */
  function systeme({ instance: demandee, periode = '24h' } = {}) {
    const p = PERIODES[periode];
    if (!p) throw new ErreurMetriques(400, `Période inconnue : « ${periode} » (${Object.keys(PERIODES).join(', ')}).`);
    return avecSource(demandee, (src) => {
      const maintenantMs = horloge();
      const maintenantS = Math.floor(maintenantMs / 1000);
      const depuis = p.duree === null ? 0 : maintenantS - p.duree;
      const dernier = src.propre ? dernierEchantillon : src.db?.prepare('SELECT * FROM systeme_minute ORDER BY instant DESC LIMIT 1').get() ?? null;
      let processus;
      let disque;
      if (src.propre) {
        const pr = processusEnCeMoment();
        processus = {
          version: identite.version ?? null, code: identite.code ?? null, node: process.version, pid: process.pid, depuis: isoMs(debutProcessus),
          duree_s: Math.round(process.uptime()), ...pr, memoire_limite: limiteMemoire(), en_cours: enCours, mesure_le: isoMs(maintenantMs),
        };
        disque = disqueDe(fichiers.disque ?? dossier);
      } else {
        const demarrage = src.db.prepare("SELECT instant_ms, detail FROM evenement WHERE type = 'demarrage' ORDER BY instant_ms DESC, id DESC LIMIT 1").get();
        let d = {};
        try {
          d = demarrage?.detail ? JSON.parse(demarrage.detail) : {};
        } catch {
          d = {};
        }
        processus = {
          version: d.version ?? null, code: d.code ?? null, node: d.node ?? null, pid: d.pid ?? null, depuis: demarrage ? isoMs(demarrage.instant_ms) : null,
          duree_s: dernier?.duree_s ?? null, rss: dernier?.rss ?? null, tas_utilise: dernier?.tas_utilise ?? null, tas_total: dernier?.tas_total ?? null,
          externe: dernier?.externe ?? null, cpu_utilisateur_pct: dernier?.cpu_utilisateur_pct ?? null, cpu_systeme_pct: dernier?.cpu_systeme_pct ?? null,
          boucle_p50_ms: dernier?.boucle_p50_ms ?? null, boucle_p99_ms: dernier?.boucle_p99_ms ?? null, boucle_max_ms: dernier?.boucle_max_ms ?? null,
          charge: dernier ? [dernier.charge_1, dernier.charge_5, dernier.charge_15] : null, memoire_limite: d.memoire_limite ?? null,
          en_cours: dernier?.en_cours ?? null, mesure_le: dernier ? iso(dernier.instant) : null,
        };
        disque = dernier?.disque_total ? {
          dossier: null, libre: dernier.disque_libre, total: dernier.disque_total, utilise: null, reserve: null,
          part_libre: Math.round((dernier.disque_libre / dernier.disque_total) * 10_000) / 10_000,
        } : null;
      }
      // la répartition du disque (jauge de la page Debug) : celle de cette instance d'après son relevé (10 minutes au plus), celle d'une autre
      // d'après sa dernière notée dans son fichier, rapportée à son dernier échantillon du disque (la somme fait toujours `disque.total`)
      let repartition = null;
      if (disque) {
        if (src.propre) {
          const r = repartitionActuelle(disque);
          if (r) repartition = { ...r, instant: r.releve.instant, partiel: r.releve.partiel, hote: r.releve.hote ?? null };
        } else {
          try {
            // `SELECT *` : le fichier d'une version 2 n'a pas la colonne de la réserve (elle reste alors dans « Système et autres »)
            const l = src.db.prepare('SELECT * FROM disque_repartition ORDER BY instant DESC LIMIT 1').get();
            if (l) {
              const reserve = l.reserve ?? null;
              repartition = { ...repartitionDu({ total: disque.total, libre: disque.libre, reserve, comptes: JSON.parse(l.comptes) }), instant: l.instant * 1000, partiel: Boolean(l.partiel) };
              if (reserve !== null) disque = { ...disque, reserve, utilise: Math.max(0, disque.total - disque.libre - reserve) };
            }
          } catch {
            // fichier d'une version plus ancienne (sans répartition) ou illisible : pas de jauge
          }
        }
        // `repartition_hote` : le relevé de l'hôte (VPS) pris en compte ou non, et pourquoi ; null sans relevé (NAS, développement) ou quand la
        // répartition vient du fichier d'une autre instance (ses catégories de l'hôte, si elle en avait, sont dans `repartition`)
        const hote = repartition?.hote ?? null;
        disque = {
          ...disque, repartition: repartition?.repartition ?? null, repartition_le: repartition ? isoMs(repartition.instant) : null,
          repartition_partielle: repartition ? Boolean(repartition.partiel) : null,
          repartition_hote: hote ? { releve_le: hote.instant === null ? null : isoMs(hote.instant), utilise: hote.utilise, raison: hote.raison } : null,
        };
      }
      const vol = volume(src, maintenantS);
      const liste = echantillons(src, depuis, p.duree === null || p.duree > 86_400);
      const recents = echantillons(src, maintenantS - 3600, false);
      // archives : la taille d'il y a au moins six jours, comparée à celle d'aujourd'hui
      let croissanceArchives = null;
      if (src.db) {
        const avant = src.db.prepare('SELECT instant, taille_archives FROM systeme_minute WHERE instant <= ? AND taille_archives IS NOT NULL ORDER BY instant DESC LIMIT 1').get(maintenantS - 6 * 86_400)
          ?? src.db.prepare('SELECT debut AS instant, taille_archives_max AS taille_archives FROM systeme_heure WHERE debut <= ? ORDER BY debut DESC LIMIT 1').get(maintenantS - 6 * 86_400);
        const apres = dernier?.taille_archives;
        if (avant && apres && apres - avant.taille_archives > SEUILS.archives_croissance_octets && apres > avant.taille_archives * (1 + SEUILS.archives_croissance_part)) {
          croissanceArchives = { octets: apres - avant.taille_archives, jours: Math.round((maintenantS - avant.instant) / 86_400), taille: apres };
        }
      }
      return {
        instance: src.nom, instances: instances(), maintenant: isoMs(maintenantMs), periode, processus, disque, fichiers: fichiersDe(src, dernier),
        echantillons: liste, evenements: evenements(src, depuis * 1000), volume: vol,
        alertes: alertesDu({
          disque, processus, volume: vol, erreursRecentes: recents.reduce((n, e) => n + (e.erreurs_5xx ?? 0), 0), panne: src.propre ? panne : null,
          brutes: src.propre ? Boolean(brutes) && !restriction : vol.brutes === true, croissanceArchives,
          repartition: repartition ? { depasse: repartition.depasse, partiel: repartition.partiel, hote: repartition.hote ?? null } : null,
          restriction: src.propre ? restriction : restrictionDe(src),
        }),
        ...(src.propre ? { panne, perdues } : {}),
      };
    });
  }

  /**
   * GET /api/debug/metriques/export/ : les agrégats bruts d'une période, en CSV ou en JSON (pièce jointe) — la MÊME fenêtre que lire() (bornes) :
   * pour « 1h », les tranches de 5 minutes (agregat_5min, `pas` = « 5min ») ; sinon les heures (agregat_heure). Au plus EXPORT_LIGNES_MAX lignes,
   * les plus récentes (`tronque` le dit : en-tête de la réponse et champ du JSON), lues une à une (iterate) et écrites ligne à ligne.
   */
  function exporter({ instance: demandee, periode = 'tout', format = 'csv' } = {}) {
    if (!['csv', 'json'].includes(format)) throw new ErreurMetriques(400, `Format inconnu : « ${format} » (csv, json).`);
    if (!PERIODES[periode]) throw new ErreurMetriques(400, `Période inconnue : « ${periode} » (${Object.keys(PERIODES).join(', ')}).`);
    return avecSource(demandee, (src) => {
      const maintenant = secondes();
      const b = bornes(src, periode, maintenant);
      const cinq = b.table === 'cinq';
      const depuis = b.depuis;
      const lignes = [];
      const ajouter = (debut, route, methode, a) => {
        const st = statistiques(a);
        lignes.push({
          debut: iso(debut), route, methode, n: a.n, erreurs_4xx: a.erreurs_4xx, erreurs_5xx: a.erreurs_5xx, n_304: a.n_304, somme_ms: arrondi(a.somme_ms),
          somme2_ms: arrondi(a.somme2_ms), min_ms: arrondi(a.min_ms), max_ms: arrondi(a.max_ms),
          ...Object.fromEntries(a.h.map((c, i) => [i < BORNES_MS.length ? `h_le_${BORNES_MS[i]}ms` : `h_plus_${BORNES_MS.at(-1)}ms`, c])),
          octets_entree: a.octets_entree, octets_sortie: a.octets_sortie, sql_requetes: a.sql_requetes, sql_ms: arrondi(a.sql_ms), corps_ms: arrondi(a.corps_ms),
          traitement_ms: arrondi(a.traitement_ms), envoi_ms: arrondi(a.envoi_ms), sql_max_ms: arrondi(a.sql_max_ms), sql_max: a.sql_max ?? null,
          moyenne_ms: st.moyenne_ms, mediane_ms: st.mediane_ms, p95_ms: st.p95_ms, p99_ms: st.p99_ms, au_dela: st.au_dela.join(' '),
        });
      };
      let tronque = false;
      if (src.db) {
        const table = cinq ? 'agregat_5min' : 'agregat_heure';
        // les plus récentes d'abord (pour couper à EXPORT_LIGNES_MAX), remises dans l'ordre ensuite ; une ligne de plus dit qu'il y en avait trop
        const lues = [];
        for (const l of src.db.prepare(`SELECT * FROM ${table} WHERE debut >= ? ORDER BY debut DESC, route DESC, methode DESC LIMIT ?`).iterate(depuis, EXPORT_LIGNES_MAX + 1)) {
          if (lues.length >= EXPORT_LIGNES_MAX) {
            tronque = true;
            break;
          }
          const a = agregatDeLigne(l);
          a.sql_max_ms = l.sql_max_ms ?? null;
          a.sql_max = texteSql(src, l.sql_max_id);
          lues.push([l.debut, l.route, l.methode, a]);
        }
        for (let i = lues.length - 1; i >= 0; i--) ajouter(...lues[i]);
      }
      if (src.memoire) for (const e of attente[cinq ? 'cinq' : 'heure'].values()) if (e.debut >= depuis && lignes.length < EXPORT_LIGNES_MAX) ajouter(e.debut, e.route, e.methode, e.a);
      const jour = isoMs(horloge()).slice(0, 10);
      const nomFichier = `metriques-${src.nom}-${periode}-${jour}.${format}`;
      const pas = cinq ? '5min' : 'heure';
      if (format === 'json') {
        const tete = JSON.stringify({ instance: src.nom, periode, pas, depuis: iso(depuis), jusqua: iso(maintenant), bornes_ms: BORNES_MS, tronque, lignes_max: EXPORT_LIGNES_MAX });
        const morceaux = [`${tete.slice(0, -1)},"lignes":[`];
        lignes.forEach((l, i) => morceaux.push(`${i ? ',' : ''}\n${JSON.stringify(l)}`));
        morceaux.push('\n]}\n');
        return { type: 'application/json; charset=utf-8', nom: nomFichier, contenu: morceaux.join(''), tronque };
      }
      const colonnes = lignes.length ? Object.keys(lignes[0]) : ['debut', 'route', 'methode', 'n'];
      const cellule = (v) => {
        if (v === null || v === undefined) return '';
        const t = String(v);
        return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      const morceaux = [colonnes.join(',')];
      for (const l of lignes) morceaux.push(colonnes.map((c) => cellule(l[c])).join(','));
      return { type: 'text/csv; charset=utf-8', nom: nomFichier, contenu: `${morceaux.join('\r\n')}\r\n`, tronque };
    });
  }

  return {
    instance: nom,
    fichier,
    dossier,
    pagesOuvertes: Boolean(pages),
    brutes: Boolean(brutes),
    debut,
    fin,
    evenement,
    recevoirPage,
    echantillonner,
    verser,
    purger,
    minute,
    arreter,
    lire,
    requetes,
    systeme,
    exporter,
    instances,
    /** L'état de la collecte : { instance, fichier, panne, en_attente, perdues, en_cours } (tests, état du service). */
    etat: () => ({ instance: nom, fichier, panne, en_attente: enAttente(), perdues, en_cours: enCours, ouverte: Boolean(db) }),
  };
}
