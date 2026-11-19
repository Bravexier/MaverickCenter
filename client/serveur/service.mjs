// Le service des personnages (mode client / serveur, docs/serveur.md) : un serveur HTTP sans dépendance qui répond sous /api/ (api.mjs) avec la
// base vivante de l'instance (base-vivante.mjs). nginx lui transmet /api/ derrière le mot de passe du site (deploy/nginx.conf).
//
// Il surveille trois fichiers (toutes les `intervalle` ms ; un changement compte quand il a été vu deux fois de suite, pour ne pas agir au
// milieu d'une copie) :
//   - la base des règles publiée par le site : quand une livraison la change, la base vivante est refaite (fiches reprises) ;
//   - la base vivante : remplacée de l'extérieur (une restauration, ou la copie de la production posée par l'installateur de test sur demande), elle est rouverte ;
//   - version.json du service livré : une nouvelle version arrête le processus (code 0), que Docker relance (restart: unless-stopped).
// Sur le site de dev, la même minuterie suit aussi une vraie mise à jour en cours (run GitHub, note arrivée) et publie l'annonce de maintenance que
// lisent les deux serveurs (maintenance.mjs).
// Journal : chaque ligne part sur la sortie (horodatée, ce que montre `docker logs`). Sur le site de dev seulement (`edition`), elle va aussi dans le
// journal gardé en mémoire (journal-du-service.mjs) que lit la page Debug (GET /api/debug/journal/), et chaque requête /api/ y est notée (catégorie
// http : méthode, adresse avec sa chaîne de requête, statut, durée ; jamais les corps), sauf les relèves du journal lui-même et de l'état de
// maintenance. En production, la page Debug n'existe pas (403) : pas de mémoire, et une requête n'est notée que si elle échoue côté service (5xx) —
// la sortie garde ses seuls événements d'avant (démarrage, base, écritures, erreurs), sans une ligne par visite (le log du conteneur n'a pas de
// rotation : deploy/…/docker-compose.yml).
// Métriques (serveur/metriques.mjs ; docs/serveur.md, « Métriques et volume ») : sur les deux instances, chaque requête /api/ est mesurée (route
// normalisée, durée et phases, octets, requêtes SQL par l'enveloppe de la base vivante de serveur/metriques-sql.mjs…), un échantillon système est
// pris chaque minute et les évènements du service (démarrage, base vivante, rejeu, lots, mise à jour, GitHub, maintenance, erreurs 5xx) sont notés
// avec leur durée, dans la base des métriques de l'instance (<MAVERICK_DOSSIER_METRIQUES ou db/metriques>/<instance>.db), jamais dans la base
// vivante. Une panne des métriques ne fait jamais échouer une requête ni le démarrage. L'entrée http du journal en mémoire porte ses champs
// isolés (duree_ms, methode, route, statut, octets_sortie). La répartition du disque (jauge de la page Debug) compte aussi le site construit
// (dossierDuSite) et les images de la base vivante (metriques.mjs#octetsDesImages).
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { creerAcces } from './acces.mjs';
import { CORPS_MAX, traiter } from './api.mjs';
import { creerJournalDuService, estUneReleve } from './journal-du-service.mjs';
import { instant as maintenant } from './instant.mjs';
import { DOSSIER_ARCHIVES, FICHIER_BASE, lireEtat, ouvrirBaseVivante, preparerBaseVivante, signature } from './base-vivante.mjs';
import { ErreurBaseSource, estEnBascule2, estUneBaseSource, etatDeLaBaseSource, preparerBaseSource } from './base-source.mjs';
import { annonceDuLancement, DUREE_MAX_MAINTENANCE, etatDeMaintenance, lireAnnonce, publierAnnonce } from './maintenance.mjs';
import { creerLesInterrupteursDeGithub } from './bascule-2-etat.mjs';
import { creerGithub, lireLancement, lireReference, sansNouvelles, SUIVIS } from './notes-de-version.mjs';
import { actualiser } from './paquet.mjs';
import {
  CAPACITE_REQUETES, creerMetriques, empreinteDePile, instanceDuService, INTERVALLE_VERSEMENT, limiteMemoire, methodeNormalisee, octetsDesImages, routeNormalisee,
} from './metriques.mjs';
import { creerMesureSql } from './metriques-sql.mjs';
import { creerClasseurEnLigne } from './classeur.mjs';
import { creerTipeee } from './tipeee.mjs';
import { compterLesConflits } from './edition-conflits.mjs';
import { ecrireAttestation, fabriquerAttestation, INTERVALLE_DE_L_ATTESTATION_MS } from './attestation.mjs';
import { creerAtelier } from './atelier.mjs';
import { creerGel } from './gel.mjs';
import { creerExtrait } from './extrait.mjs';
import { purgerLesEssais } from './edition-lots.mjs';
import { creerOmbre } from './essai-dans-l-ombre.mjs';
import { INTERVALLE_DES_DEMANDES_MS, creerEssaiDeStructure } from './essai-de-structure.mjs';

/** La ligne de la sortie console (`docker logs`) : « <instant> <message> », la même que celle du journal en mémoire (journal-du-service.mjs). */
const horodater = (ligne) => `${maintenant()} ${ligne}`;

/** Le chemin d'un appel à l'API GitHub, sans le dépôt ni les identifiants (évènement « github » des métriques). */
function cheminGithub(adresse) {
  try {
    return new URL(adresse).pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '').replace(/\/\d+(?=\/|$)/g, '/{id}');
  } catch {
    return null;
  }
}

/**
 * Le dossier du site construit (répartition du disque des métriques : code, données et images du site), d'après les chemins que le service connaît :
 * la base des règles publiée (<site>/donnees/maverick.db) ou version.json du service livré (<site>/_serveur/version.json) ; null en développement
 * (règles dans var/, sans version.json).
 */
export function dossierDuSite({ regles = null, fichierVersion = null } = {}) {
  if (regles && basename(dirname(regles)) === 'donnees') return dirname(dirname(regles));
  if (fichierVersion && basename(dirname(fichierVersion)) === '_serveur') return dirname(dirname(fichierVersion));
  return null;
}

/** Rend une fonction qui dit, pour chaque valeur observée, s'il faut agir : la valeur a changé et elle était déjà la même à l'observation précédente. */
export function guetteur(initiale) {
  let appliquee = initiale;
  let candidate;
  return (vue) => {
    if (vue === appliquee) {
      candidate = undefined;
      return false;
    }
    if (vue === candidate) {
      appliquee = vue;
      candidate = undefined;
      return true;
    }
    candidate = vue;
    return false;
  };
}

const inode = (chemin) => {
  try {
    return statSync(chemin).ino;
  } catch {
    return null;
  }
};

/**
 * Démarre le service. Rend { url, port, arreter() } une fois le port ouvert.
 * @param {object} o
 * @param {string} o.regles base des règles publiée par le site (site/donnees/maverick.db)
 * @param {string} o.dossier dossier de la base vivante (db/ de l'instance)
 * @param {string} [o.hote] adresse d'écoute (127.0.0.1 ; 0.0.0.0 dans le conteneur)
 * @param {number} [o.port] 0 = un port libre au hasard (tests)
 * @param {number} [o.intervalle] surveillance des fichiers en ms ; 0 = aucune
 * @param {string|null} [o.fichierVersion] version.json du service livré (null en développement)
 * @param {boolean} [o.edition] édition des règles ouverte (site de dev seulement : MAVERICK_EDITION=1)
 * @param {string|{production: string|null, depot: string|null}|null} [o.reference] page « Mise à jour » : le dossier de la production (monté en lecture seule), puis la copie tirée du dépôt (site/donnees/reference.db)
 * @param {string} [o.depot] dépôt GitHub du workflow de mise à jour
 * @param {string|null} [o.adresse] adresse publique du site (https://dev.<domaine>) ; sinon l'hôte de la requête
 * @param {string|null} [o.jetonFichier] fichier du jeton GitHub (permission Actions) ; sans lui, le workflow se lance à la main
 * @param {string|{ controler: Function, droit: Function, protege: Function, portee: Function, connecter: Function }|null} [o.acces] accès au site de dev
 *   (serveur/acces.mjs, docs/serveur.md, « Accès au site de dev ») : le fichier de réglage (secrets/acces.json ; MAVERICK_ACCES_FICHIER), relu quand il
 *   change ; absent ou sans fichier, rien n'est protégé ; jamais lu sans l'édition (la production n'est pas concernée)
 * @param {string|null} [o.maintenance] dossier partagé de l'annonce de maintenance (MAVERICK_MAINTENANCE : le même pour les deux serveurs) ;
 *   sans lui, le site de dev se met en maintenance d'après son seul lancement et la production ne l'est jamais
 * @param {string|null} [o.paquets] dossier partagé des paquets de la production (MAVERICK_PAQUETS ; lot 11, PR 5a, serveur/paquets-de-la-production.mjs) : le site de dev y dépose le paquet
 *   de la mise à jour et y lit le rapport de l'activation (`activation_production`), seulement avec le marqueur db/bascule-2 ; sans lui, rien n'y est écrit, et le rapport n'est lu que pour
 *   l'état en lecture seule `bascule_2` de la page Mise à jour (serveur/bascule-2-etat.mjs)
 * @param {string} [o.versionParDefaut] version annoncée sans version.json (développement : celle de package.json)
 * @param {((message: string, options?: object) => void) | null} [o.journal] reçoit chaque ligne notée (sans horodatage) ; donné, la sortie console se tait
 *   (tests) ; sinon les lignes partent sur la console, horodatées
 * @param {ReturnType<typeof creerJournalDuService>} [o.journalDuService] le journal gardé en mémoire (par défaut, un neuf sur le site de dev, aucun
 *   en production : personne ne peut l'y lire)
 * @param {() => void} [o.relancer] appelé après l'arrêt quand une nouvelle version du service est livrée
 * @param {typeof fetch} [o.fetch] les téléchargements de « Importer (en ligne) » (POST /api/classeur/, serveur/classeur.mjs) : le fetch de Node par
 *   défaut, un faux dans les tests (le réseau de la session ne joint pas Google)
 * @param {false | { fetch?: typeof fetch, instantane?: string|null, actif?: boolean, cache?: number, reessai?: number, delai?: number,
 *   octetsMax?: number, horloge?: () => number }} [o.tipeee] la partie « Bienvenue » de Tipeee relue en direct (GET /api/tipeee/, serveur/tipeee.mjs) :
 *   l'instantané livré avec le site (premier repli ; aucun par défaut), Tipeee joint ou non (MAVERICK_TIPEEE=0 : jamais), la durée du cache
 *   (MAVERICK_TIPEEE_CACHE_MIN) ; le dernier texte valide est gardé dans `dossier` ; `fetch` : celui de Node par défaut, un faux dans les tests ;
 *   false : pas de route (503)
 * @param {false | { dossier?: string, instance?: string, brutes?: boolean, pages?: boolean, intervalle?: number, horloge?: () => number,
 *   site?: string|null }} [o.metriques]
 *   la collecte des métriques (serveur/metriques.mjs) ; chaque réglage absent vient de l'environnement : MAVERICK_DOSSIER_METRIQUES (sinon
 *   <dossier>/metriques), MAVERICK_INSTANCE (sinon « dev » avec l'édition, « prod » sans), MAVERICK_METRIQUES_BRUTES=1 (requêtes brutes gardées 30
 *   jours), MAVERICK_METRIQUES_PAGES=0 (balise des pages vues fermée ; ouverte par défaut, décision du propriétaire) ; `site` : le dossier du site
 *   construit (répartition du disque ; par défaut dossierDuSite) ; false : aucune collecte
 * @param {false | { intervalle?: number, essayer?: Function, espaceLibre?: Function, ombre?: false | object }} [o.essaiDeStructure] l'essai d'une livraison avant son
 *   installation (serveur/essai-de-structure.mjs) : `intervalle` du passage sur db/essai-de-structure/ en ms (par défaut 3 s, sans dépasser `intervalle` ; 0 = aucun passage,
 *   les tests l'appellent), `essayer` et `espaceLibre` remplacent l'essai et la mesure du disque (tests) ; false : aucun essai, une demande reste sans réponse ;
 *   `ombre` : l'essai dans l'ombre (serveur/essai-dans-l-ombre.mjs, site de dev seulement : à chaque installation, la base d'avant migrée sur place comparée à la base
 *   refaite), ses réglages (`executer`, `espaceLibre`, `migrations`, `schema` : tests), false : aucun
 * @param {false | { rapports?: string|null, delai?: number, intervalle?: number, fabriquer?: Function }} [o.atelier] l'atelier du site de dev (serveur/atelier.mjs, site de dev seulement) :
 *   `rapports` le dossier des rapports de root monté en lecture seule (par défaut MAVERICK_ATELIER, sinon aucun), `depot` le dépôt de l'atelier monté en lecture-écriture (par défaut MAVERICK_ATELIER_DEPOT, sinon aucun : pas d'extrait), `delai` entre un contenu changé et son extrait
 *   refait, `intervalle` des passages (0 : aucun, les tests appellent `atelier.passer()`), `fabriquer` remplace la fabrication de l'extrait (tests) ; false : aucun atelier
 * @param {false | { dossier?: string|null, publier?: boolean, intervalle?: number }} [o.attestation] l'attestation de la production (serveur/attestation.mjs) : `publier`
 *   (par défaut : sans l'édition, c'est-à-dire en production) l'écrit dans `dossier` (par défaut le dossier des métriques, partagé entre les deux
 *   instances du VPS) au démarrage, après chaque reconstruction de la base vivante, et toutes les `intervalle` ms (par défaut
 *   INTERVALLE_DE_L_ATTESTATION_MS, une heure ; 0 : jamais) ; le site de dev y lit celle de la production (page « Mise à
 *   jour ») ; false : ni écriture ni lecture
 * @param {{ migrations?: string|null, schema?: string|null }} [o.structure] la base source (fichier `source` dans `dossier` : serveur/base-source.mjs) : les
 *   migrations et le schema.sql appliqués sur place au démarrage (undefined : ceux de la livraison, _serveur/data/ ; tests). Une base source absente, refusée
 *   par l'essai, ou d'une autre structure que le schema.sql livré : la promesse est rejetée, le service ne démarre pas
 */
export async function demarrerService({ regles, dossier, hote = '127.0.0.1', port = 8787, intervalle = 15000, fichierVersion = null, edition = false,
  reference = null, depot = 'Bravexier/MaverickCenter', adresse = null, jetonFichier = null, acces: reglageAcces = null, maintenance = null, paquets = null, versionParDefaut = 'développement',
  journal: ecouteur = null, journalDuService = null, relancer = () => process.exit(0), metriques: reglagesMetriques = {}, fetch: fetchDuClasseur = globalThis.fetch,
  tipeee: reglagesTipeee = {}, attestation: reglagesAttestation = {}, essaiDeStructure: reglagesEssai = {}, atelier: reglagesAtelier = {}, structure: reglagesStructure = {} }) {
  const lancementDuService = performance.now();
  // la production sert de référence à la page « Mise à jour » sauf si c'est la base de ce site même (lireReference compare les fichiers)
  const referenceDuSite = reference && typeof reference === 'object' ? { propre: regles, ...reference } : reference;
  const chemin = join(dossier, FICHIER_BASE);
  // la mémoire de la page Debug (site de dev seulement) et la sortie de toujours (console, horodatée ; l'écouteur à sa place dans les tests) ; une
  // relève (estUneReleve) n'est notée nulle part
  const memoire = journalDuService ?? (edition ? creerJournalDuService({ sortie: null }) : null);
  let lignesNotees = 0; // compteur des lignes notées (entrées du journal par minute, métriques)
  const journal = (message, options) => {
    if (estUneReleve(message)) return null;
    const entree = memoire ? memoire.ecrire(message, options) : { message: String(message ?? '') };
    if (!entree) return null;
    lignesNotees += 1;
    if (ecouteur) ecouteur(message, options);
    else console.log(horodater(message));
    return entree;
  };
  const version = (() => {
    try {
      return JSON.parse(readFileSync(fichierVersion, 'utf8'));
    } catch {
      return { version: versionParDefaut, empreinte: null };
    }
  })();
  // accès au site de dev (serveur/acces.mjs) : le réglage est relu quand le fichier change ; lu une fois ici pour que le démarrage le note au journal
  const acces = edition && reglageAcces ? (typeof reglageAcces === 'string' ? creerAcces({ fichier: reglageAcces, journal }) : reglageAcces) : null;
  acces?.protege();
  // page « Mise à jour » (site de dev) : le jeton GitHub du serveur, relu à chaque appel (fichier monté dans le conteneur, jamais dans site/)
  const lireJeton = () => {
    if (!jetonFichier) return null;
    try {
      return readFileSync(jetonFichier, 'utf8').trim() || null;
    } catch {
      return null;
    }
  };
  // les métriques de cette instance (serveur/metriques.mjs) : créées avant tout le reste, pour noter aussi la préparation de la base vivante
  let metriques = null;
  const reglesDesMetriques = reglagesMetriques === false ? null : (reglagesMetriques ?? {});
  const dossierDesMetriques = reglesDesMetriques ? (reglesDesMetriques.dossier ?? (process.env.MAVERICK_DOSSIER_METRIQUES || join(dossier, 'metriques'))) : null;
  const nomDInstance = instanceDuService({ edition, instance: reglesDesMetriques?.instance ?? process.env.MAVERICK_INSTANCE });
  if (reglesDesMetriques) {
    const r = reglesDesMetriques;
    try {
      metriques = creerMetriques({
        dossier: dossierDesMetriques,
        instance: nomDInstance,
        brutes: r.brutes ?? process.env.MAVERICK_METRIQUES_BRUTES === '1',
        pages: r.pages ?? process.env.MAVERICK_METRIQUES_PAGES !== '0',
        intervalle: r.intervalle ?? INTERVALLE_VERSEMENT,
        ...(r.horloge ? { horloge: r.horloge } : {}),
        memoireRequetes: edition ? CAPACITE_REQUETES : 0,
        journal,
        identite: { version: version.version, code: version.empreinte ?? null },
        // DOSSIER_LOTS de notes-de-version.mjs : les lots figés de la page « Mise à jour » ; le site construit (répartition du disque)
        fichiers: {
          vivante: chemin, archives: join(dossier, DOSSIER_ARCHIVES), miseAJour: join(dossier, 'mise-a-jour'), disque: dossier,
          site: r.site !== undefined ? r.site : dossierDuSite({ regles, fichierVersion }),
        },
        // les images de la base vivante (portraits des prétirés et du bestiaire), comptées à part de la base : au plus toutes les 10 minutes, sur la
        // vraie base et non sur son enveloppe mesurée (rien n'est compté dans les requêtes SQL d'une requête HTTP) ; base fermée ou en reconstruction : 0
        imagesDeLaBase: () => {
          try {
            return octetsDesImages(etat.db);
          } catch {
            return 0;
          }
        },
        compteurJournal: () => lignesNotees,
      });
    } catch (e) {
      journal(`ERREUR métriques : collecte désactivée : ${e.message}`);
    }
  }
  // l'attestation de la production : écrite (sans l'édition) dans le dossier partagé des métriques, lue par le site de dev (page « Mise à jour »)
  const dossierDesAttestations = reglagesAttestation === false ? null : (reglagesAttestation?.dossier ?? dossierDesMetriques);
  const publierAttestation = Boolean(dossierDesAttestations) && (reglagesAttestation?.publier ?? !edition);
  /** Note un évènement du service dans les métriques (jamais d'exception). */
  const evenement = (type, o) => {
    try {
      return metriques?.evenement(type, o) ?? false;
    } catch {
      return false;
    }
  };
  /** La base vivante enveloppée : chaque requête SQL faite pendant une requête HTTP est comptée (serveur/metriques-sql.mjs). */
  const sql = creerMesureSql();
  const baseMesuree = () => sql.envelopper(etat.db);
  // appels à l'API GitHub chronométrés (évènement « github ») : le reste de notes-de-version.mjs ne change pas
  const fetchMesure = async (adresseGithub, options = {}) => {
    const t0 = performance.now();
    const detail = { methode: String(options.method ?? 'GET').toUpperCase(), chemin: cheminGithub(adresseGithub) };
    try {
      const r = await globalThis.fetch(adresseGithub, options);
      evenement('github', { duree_ms: performance.now() - t0, detail: { ...detail, statut: r.status } });
      return r;
    } catch (e) {
      evenement('github', { duree_ms: performance.now() - t0, detail: { ...detail, erreur: e?.name ?? 'Error' } });
      throw e;
    }
  };
  const github = edition ? creerGithub({ dossier, depot, lireJeton, journal, fetch: fetchMesure }) : null;
  // les interrupteurs de la bascule 2 que GitHub porte (page Mise à jour, `bascule_2`) : lus en arrière-plan, en cache (serveur/bascule-2-etat.mjs)
  const interrupteursGithub = github ? creerLesInterrupteursDeGithub({ github }) : null;
  // « Importer (en ligne) » de /fiche/ (POST /api/classeur/) : sur les deux instances ; ses bornes de débit valent pour tout le service
  const classeur = creerClasseurEnLigne({ fetch: fetchDuClasseur, journal, evenement });
  // la partie « Bienvenue » de Tipeee (GET /api/tipeee/) : sur les deux instances ; son cache et sa requête en cours valent pour tout le service, le
  // dernier texte valide est gardé à côté de la base vivante
  const tipeee = reglagesTipeee === false ? null : creerTipeee({ dossier, journal, evenement, ...(reglagesTipeee ?? {}) });
  const etat = { db: null, inode: null, erreur: null, demarre_le: maintenant() };
  // la base source (lot 8 : serveur/base-source.mjs) : le fichier `source` dans le dossier de la base, relu à chaque fois (bascule.sh le pose, puis relance le
  // service) ; avec lui, la base n'est jamais refaite depuis les règles, ses migrations sont appliquées sur place, et un lot de changements vaut pour toutes les tables
  const estSource = () => estUneBaseSource(dossier);
  const sourceAuDemarrage = estSource();
  // la bascule 2 (lot 11 : le marqueur db/bascule-2, posé plus tard par un script de root) : relue à chaque fois, comme le marqueur de la base source
  const enBascule2 = () => estEnBascule2(dossier);
  // le gel des écritures (lot 11, garde-fou 16 : serveur/gel.mjs) : le fichier db/gel.json, posé par root (deploy/installateur/gel.sh), relu quand il change ; les deux instances
  const gel = creerGel({ dossier, instance: nomDInstance, journal, evenement });
  // les copies d'essai d'un lot de changements qu'un arrêt a laissées (serveur/edition-lots.mjs)
  if (edition) {
    try {
      const n = purgerLesEssais(dossier);
      if (n) journal(`lots : ${n} copie(s) d’essai restée(s) supprimée(s)`);
    } catch (e) {
      journal(`lots : copies d’essai non purgées : ${e?.message ?? e}`);
    }
  }
  // l'essai d'une livraison avant son installation (serveur/essai-de-structure.mjs) : sur les deux instances, la production comprise. Les copies qu'un arrêt a
  // laissées sont retirées avant tout essai.
  // l'essai dans l'ombre, lui, est propre au site de dev (`edition`) : la production n'en fait jamais
  // (sans objet pour une base source : elle n'est jamais refaite, il n'y a rien à comparer à sa migration sur place)
  const ombre = reglagesEssai === false || !edition || reglagesEssai?.ombre === false || sourceAuDemarrage ? null
    : creerOmbre({ dossier, instance: nomDInstance, journal, evenement, ...(reglagesEssai?.ombre ?? {}) });
  const essaiDeStructure = reglagesEssai === false ? null
    : creerEssaiDeStructure({ dossier, source: chemin, instance: nomDInstance, journal, evenement, ...(reglagesEssai ?? {}), ombre, baseSource: () => etatDeLaBaseSource(dossier) });
  if (essaiDeStructure) {
    try {
      const n = essaiDeStructure.purger();
      if (n) journal(`structure : ${n} reste(s) d’essai supprimé(s) (copies d’une base, demandes abandonnées)`, { categorie: 'base' });
    } catch (e) {
      journal(`structure : restes d’essai non purgés : ${e?.message ?? e}`, { categorie: 'base' });
    }
  }
  // l'extrait du contenu pour les sessions de Claude (GET /api/edition/extrait/) : site de dev seulement, fabriqué au premier téléchargement qui suit un changement
  const extrait = edition ? creerExtrait({ dossier, base: () => etat.db, version: () => version.version, journal, evenement }) : null;

  // l'atelier du site de dev (serveur/atelier.mjs) : l'extrait de son contenu, tenu à jour une fois qu'il est installé, et ses rapports, lus en lecture seule ; jamais en production
  const atelier = reglagesAtelier === false || !edition ? null : creerAtelier({
    dossier, edition: true, rapports: reglagesAtelier?.rapports !== undefined ? reglagesAtelier.rapports : (process.env.MAVERICK_ATELIER || null),
    depot: reglagesAtelier?.depot !== undefined ? reglagesAtelier.depot : (process.env.MAVERICK_ATELIER_DEPOT || null),
    base: () => etat.db, version: () => version.version, journal, evenement, ...(reglagesAtelier ?? {}),
  });

  function fermer() {
    if (etat.db) {
      etat.db.close();
      etat.db = null;
    }
  }

  let serviceOuvert = false;
  /** (Re)prépare puis ouvre la base vivante ; en cas d'échec, l'erreur est gardée et la base en place, si elle existe, reste servie telle quelle. */
  function ouvrir() {
    if (estSource()) {
      ouvrirLaBaseSource();
      return;
    }
    fermer();
    const t0 = performance.now();
    const preparation = { appliquee: true, problemes: 0 }; // dit à l'attestation de la production si la dernière préparation a réussi
    try {
      const r = preparerBaseVivante({ regles, dossier, evenement, version: version.version, journal, ombre });
      evenement('base_vivante', {
        duree_ms: performance.now() - t0,
        detail: {
          refaite: Boolean(r.refaite), identique: Boolean(r.identique), regles: r.empreinte?.slice(0, 12) ?? null, schema: r.schema ?? null, archive: Boolean(r.archive), fiches_adaptees: r.fiches?.length ?? 0,
          ...(r.rejeu ? { rejeu: { lots: r.rejeu.lots ?? 0, appliquees: r.rejeu.appliquees ?? 0, integrees: r.rejeu.integrees ?? 0, conflits: r.rejeu.conflits ?? 0 } } : {}),
        },
      });
      if (r.refaite) journal(`base vivante faite pour les règles ${r.empreinte.slice(0, 12)} (schéma ${r.schema})${r.archive ? ` ; l’ancienne est archivée : ${basename(r.archive)}` : ''}`);
      if (r.ombre?.erreur) journal(`ERREUR structure : les copies de l’essai dans l’ombre n’ont pas pu être préparées : ${r.ombre.erreur}`, { categorie: 'base' });
      // l'essai dans l'ombre (serveur/essai-dans-l-ombre.mjs) ne part qu'une fois le service ouvert, jamais pendant son démarrage
      if (r.ombre?.programme && serviceOuvert) setImmediate(() => ombre.demarrer());
      if (r.identique) journal(`base vivante gardée : le fichier des règles ${r.empreinte.slice(0, 12)} a changé, pas ce qu'il apporte (schéma et lignes) ; rien n'est refait`);
      if (r.rejeu?.lots) journal(`journal des modifications rejoué : ${r.rejeu.appliquees} réappliquée(s), ${r.rejeu.integrees} déjà dans les règles, ${r.rejeu.conflits} en conflit`);
      // R42 : un don, une spécialité, un sort ou un métier disparu des règles a été retiré de ces fiches (prétirés nommés, fiches de joueur anonymes)
      if (r.fiches?.length) {
        journal(`fiches adaptées aux nouvelles règles : ${r.fiches.length} (${r.fiches.map((f) => f.fiche).join(', ')}) ; une note datée le rappelle dans chacune`);
      }
      etat.erreur = null;
    } catch (e) {
      etat.erreur = e.message;
      preparation.appliquee = false;
      preparation.problemes = e.problemes?.length || 1; // le nombre seulement : le texte d'un problème cite des fiches
      evenement('base_vivante', { duree_ms: performance.now() - t0, detail: { erreur: String(e.message).slice(0, 300) } });
      journal(`ERREUR base vivante : ${e.message}`);
    }
    etat.inode = inode(chemin);
    if (etat.inode === null) return;
    try {
      etat.db = ouvrirBaseVivante(chemin);
    } catch (e) {
      etat.erreur = `${etat.erreur ? `${etat.erreur} ; ` : ''}base vivante illisible : ${e.message}`;
      journal(`ERREUR ouverture de la base vivante : ${e.message}`);
    }
    attester(preparation);
  }

  /**
   * La base source (serveur/base-source.mjs ; docs/serveur.md, « Base source (lot 8) ») : jamais refaite depuis les règles ; les migrations livrées essayées sur
   * une copie puis appliquées sur place, la structure comparée au schema.sql livré, AVANT toute écriture. Au démarrage (`auDemarrage`), un refus est levé : le
   * service ne démarre pas. Ensuite (base remplacée : une restauration ; base retirée), la base reste fermée et /api/etat dit pourquoi. Le journal et
   * l'évènement `base_source` ne portent jamais un texte de contenu.
   */
  function ouvrirLaBaseSource({ auDemarrage = false } = {}) {
    fermer();
    const t0 = performance.now();
    try {
      const r = preparerBaseSource({ dossier, version: version.version, migrations: reglagesStructure?.migrations, schema: reglagesStructure?.schema });
      evenement('base_source', { duree_ms: performance.now() - t0, detail: { appliquees: r.appliquees.length, avant: r.avant, apres: r.apres, sauvegarde: Boolean(r.sauvegarde) } });
      if (r.appliquees.length) {
        journal(`structure : base source migrée sur place, version ${r.avant} → ${r.apres} (${r.appliquees.map((m) => m.fichier).join(', ')}) ; sauvegarde d’avant : ${r.sauvegarde ? basename(r.sauvegarde) : 'aucune'}`, { categorie: 'base' });
      } else journal(`base source ouverte telle quelle (schéma ${r.apres}) : rien n’est refait depuis les règles`, { categorie: 'base' });
      etat.erreur = null;
    } catch (e) {
      const etape = e instanceof ErreurBaseSource ? e.etape : 'panne';
      evenement('base_source', { duree_ms: performance.now() - t0, detail: { erreur: etape, ...(e?.refus?.etape ? { refus: e.refus.etape } : {}), ...(e?.refus?.migration ? { migration: e.refus.migration } : {}) } });
      journal(`ATTENTION ${e.message}${e?.details?.length ? ` : ${e.details.slice(0, 5).join(' ; ')}` : ''}`, { categorie: 'base' });
      etat.erreur = e.message;
      etat.inode = inode(chemin);
      if (auDemarrage) throw e;
      return;
    }
    etat.inode = inode(chemin);
    try {
      etat.db = ouvrirBaseVivante(chemin);
    } catch (e) {
      etat.erreur = `base source illisible : ${e.message}`;
      journal(`ERREUR ouverture de la base source : ${e.message}`, { categorie: 'base' });
      if (auDemarrage) throw e;
      return;
    }
    attester({ appliquee: true, problemes: 0 });
  }

  /**
   * L'attestation de la production (serveur/attestation.mjs), écrite après chaque préparation de la base vivante. Un échec n'empêche rien : le service
   * démarre, les fiches ne sont pas touchées (la base vivante n'est que lue), l'échec est noté.
   */
  let dernierePreparation = null; // la dernière préparation de la base vivante : la réécriture de chaque heure la redit telle quelle
  function attester(preparation) {
    if (!publierAttestation) return;
    dernierePreparation = preparation;
    const t0 = performance.now();
    try {
      const enregistre = lireEtat(dossier);
      const a = fabriquerAttestation({
        db: etat.db, regles, version: { version: version.version, code: version.empreinte ?? null }, instance: nomDInstance,
        preparation: { ...preparation, refaite_le: enregistre?.refaite_le ?? null, regles: enregistre?.regles?.slice(0, 12) ?? null },
      });
      ecrireAttestation(dossierDesAttestations, a);
      evenement('attestation', { duree_ms: performance.now() - t0, detail: { appliquee: a.preparation.appliquee, citations: a.citations.length, tables: Object.keys(a.base_vivante?.tables ?? {}).length } });
    } catch (e) {
      journal(`ERREUR attestation : ${e.message}`);
      evenement('attestation', { duree_ms: performance.now() - t0, detail: { erreur: String(e.message).slice(0, 300) } });
    }
  }

  function decrire() {
    const enregistre = lireEtat(dossier);
    let personnages = null;
    let modifications = null;
    try {
      const db = baseMesuree();
      personnages = db?.prepare("SELECT count(*) AS n FROM personnage WHERE nature = 'pretire'").get().n ?? null;
      if (edition && db) {
        // les conflits à résoudre seulement : un lot résolu sur /mise-a-jour/ garde ses lignes « conflit » comme trace (serveur/edition-conflits.mjs)
        const conflits = compterLesConflits(db);
        modifications = { en_attente: db.prepare("SELECT count(*) AS n FROM modification WHERE etat = 'en_attente'").get().n, conflit: conflits.modifications, lots_en_conflit: conflits.lots };
      }
    } catch {
      // base rouverte entre-temps : les comptes sont facultatifs
    }
    return {
      service: 'maverick-center',
      version: version.version,
      code: version.empreinte,
      demarre_le: etat.demarre_le,
      // édition des règles depuis les pages : site de dev seulement (docs/serveur.md, « Édition »)
      edition: Boolean(edition),
      ...(edition ? { modifications } : {}),
      // le gel des écritures (db/gel.json, non échu) : { pose_le, jusqu_a, motif, geste, illisible, plafonne } ; null sans gel
      gel: gel.etat(),
      base: {
        disponible: Boolean(etat.db),
        a_jour: Boolean(etat.db) && !etat.erreur,
        erreur: etat.erreur,
        regles: enregistre?.regles?.slice(0, 12) ?? null,
        schema: enregistre?.schema ?? null,
        refaite_le: enregistre?.refaite_le ?? null,
        // les fiches adaptées par la dernière reconstruction qui a retiré quelque chose (R42) : { le, fiches: [{ fiche, retraits }] }
        retraits: enregistre?.retraits ?? null,
        pretires: personnages,
        // la base source (lot 8) : le marqueur db/source, et la dernière application des migrations sur place (null sans elle)
        source: estSource(),
        sur_place: enregistre?.sur_place ?? null,
      },
    };
  }

  let erreurMaintenance = null; // dernière erreur de publication de l'annonce, notée une fois

  /**
   * L'état de maintenance de CE serveur (maintenance.mjs) : sur le site de dev, l'annonce vient de son lancement et elle est d'abord publiée dans le
   * dossier partagé (la production la lit) ; ailleurs, l'annonce publiée. Site de dev en maintenance : le lot et le run, pour la page.
   */
  function etatMaintenance() {
    const instant = maintenant();
    const lancement = edition ? lireLancement(dossier) : null;
    let annonce = edition ? annonceDuLancement(lancement, { instant }) : undefined;
    if (annonce !== undefined && maintenance) {
      try {
        if (publierAnnonce(maintenance, annonce)) {
          journal(annonce ? `maintenance : annonce publiée (V${annonce.version_cible}, ${annonce.etat})` : 'maintenance : annonce retirée');
          evenement('maintenance', { detail: { action: annonce ? 'publiee' : 'retiree', version_cible: annonce?.version_cible ?? null, etat: annonce?.etat ?? null } });
        }
        erreurMaintenance = null;
      } catch (e) {
        if (erreurMaintenance !== e.message) journal(`ERREUR maintenance : publication de l’annonce dans ${maintenance} : ${e.message}`);
        erreurMaintenance = e.message;
      }
    }
    if (annonce === undefined) annonce = lireAnnonce(maintenance);
    const m = etatDeMaintenance({ annonce, version: version.version, instant });
    if (!m.active || !edition || annonce?.lot !== lancement?.lot) return m;
    return { ...m, lot: lancement.lot, run: lancement.run?.url ?? null, levable: true };
  }

  /** Site de dev : chaque changement d'état du lancement de la mise à jour (lot, état) devient un évènement « mise_a_jour » des métriques. */
  const cleDuLancement = (l) => (l?.lot ? `${l.lot}:${l.etat}` : null);
  let lancementVu = edition ? cleDuLancement(lireLancement(dossier)) : null;
  function suivreLeLancement() {
    if (!edition) return;
    try {
      const l = lireLancement(dossier);
      const k = cleDuLancement(l);
      if (k === lancementVu) return;
      lancementVu = k;
      if (l?.lot) {
        evenement('mise_a_jour', {
          detail: { etape: 'etat', lot: l.lot, etat: l.etat, simulation: Boolean(l.simulation), modifications: l.modifications ?? null, version_cible: l.version_cible ?? null,
            run: l.run?.conclusion ?? l.run?.statut ?? null },
        });
      }
    } catch {
      // l'état du lancement est facultatif ici
    }
  }

  /**
   * Site de dev : une vraie mise à jour se suit aussi sans personne sur la page « Mise à jour » (ses pages renvoient vers /maintenance/) — note
   * arrivée dans les règles, livrée sur master, run GitHub fini ou relancé —, puis l'annonce de maintenance est republiée.
   */
  function suivreLaMiseAJour() {
    if (!edition) return;
    const recent = (l) => Boolean(l?.lot) && Date.now() - Date.parse(l.lance_le) <= DUREE_MAX_MAINTENANCE; // au-delà, plus rien à suivre ici
    try {
      if (etat.db && recent(lireLancement(dossier))) actualiser(etat.db, dossier, { reference: lireReference(referenceDuSite), journal });
    } catch (e) {
      journal(`ERREUR maintenance : suivi du lancement : ${e.message}`);
    }
    etatMaintenance();
    suivreLeLancement();
    const l = lireLancement(dossier);
    if (github?.configure() && l && !l.simulation && SUIVIS.includes(l.etat) && !sansNouvelles(l, maintenant())) {
      github.suivre().then(() => {
        etatMaintenance();
        suivreLeLancement();
      }).catch(() => {});
    }
  }

  /** GET /api/maintenance/ : sans minuterie (développement, tests), c'est la page de maintenance, qui interroge sans cesse, qui fait avancer le suivi. */
  function maintenanceDemandee() {
    if (intervalle <= 0) suivreLaMiseAJour();
    return etatMaintenance();
  }

  if (sourceAuDemarrage) {
    try {
      ouvrirLaBaseSource({ auDemarrage: true });
    } catch (e) {
      // le service ne démarre pas (garde-fou 5) : les métriques versent l'évènement, puis l'erreur remonte (index.mjs sort avec un code non nul)
      try {
        metriques?.arreter();
      } catch {
        // rien de plus à noter
      }
      essaiDeStructure?.arreter();
      throw e;
    }
  } else ouvrir();

  /** Exécute une étape des métriques sans jamais faire échouer la requête (une panne est notée une fois par le collecteur). */
  const sansEchec = (f) => {
    try {
      return f();
    } catch {
      return null;
    }
  };

  const serveur = createServer((req, res) => {
    // la mesure de la requête (serveur/metriques.mjs) : route normalisée, phases, octets, requêtes SQL, page d'origine, navigateur
    const mesure = metriques ? sansEchec(() => metriques.debut(req.method, req.url, req.headers)) : null;
    const debut = mesure?.t0 ?? performance.now();
    const route = mesure?.route ?? routeNormalisee(req.url);
    let envoyee = null; // { statut, octets } de la réponse partie
    let exception = false; // une erreur du traitement (son évènement est déjà noté, avec l'empreinte de la pile)
    let gelee = false; // une écriture refusée par le gel (503 voulu, pas une panne : ni évènement erreur_5xx ni ligne de la production)
    // chaque requête /api/ au journal (catégorie http, avec ses champs isolés), sans son corps, sur le site de dev ; en production, seulement un
    // échec du service (5xx) ; les relèves du journal, de la version de la base, des métriques et de la maintenance n'y vont pas (journal-du-service.mjs)
    const noterLaRequete = (statut, octets) => {
      const adresse = req.url ?? '/';
      if (!adresse.startsWith('/api/') || (!edition && (statut < 500 || gelee))) return;
      const duree = performance.now() - debut;
      journal(`${req.method} ${adresse} ${statut} ${Math.round(duree)} ms`, {
        categorie: 'http', champs: { duree_ms: Math.round(duree * 100) / 100, methode: methodeNormalisee(req.method), route, statut, octets_sortie: octets },
      });
    };
    // la fin de la requête : réponse partie (finish) ou connexion coupée avant (close, statut 499 si rien n'est parti)
    let terminee = false;
    const terminer = () => {
      if (terminee) return;
      terminee = true;
      const statut = envoyee?.statut ?? (res.headersSent ? res.statusCode : 499);
      const octets = envoyee?.octets ?? 0;
      noterLaRequete(statut, octets);
      if (mesure) sansEchec(() => metriques.fin(mesure, { statut, octets_sortie: octets }));
      if (statut >= 500 && !exception && !gelee) evenement('erreur_5xx', { detail: { methode: methodeNormalisee(req.method), route, statut } });
      if (edition && route.startsWith('/api/mise-a-jour/')) suivreLeLancement();
    };
    res.once('finish', terminer);
    res.once('close', terminer);
    const envoyer = ({ statut, corps, brut, entetes = {} }) => {
      // le visiteur est parti pendant une réponse attendue (POST /api/classeur/, GET /api/tipeee/) : terminer() a déjà noté 499, rien à écrire
      if (res.destroyed || res.writableEnded) return;
      // un 304 n'a pas de corps : ni Content-Type ni Content-Length (RFC 9110 § 15.4.5 ; un cache recopierait le type sur l'image qu'il garde) ;
      // un 204 (balise des pages vues) non plus
      if (statut === 304 || statut === 204) {
        if (mesure) mesure.tTraite = performance.now();
        envoyee = { statut, octets: 0 };
        res.writeHead(statut, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...entetes });
        res.end();
        return;
      }
      // `brut` : un document servi tel quel (lot figé de la mise à jour, dont l'empreinte se vérifie ; image d'un portrait, dont `entetes` donne le type)
      const texte = brut ?? JSON.stringify(corps);
      const octets = Buffer.byteLength(texte);
      if (mesure) mesure.tTraite = performance.now();
      envoyee = { statut, octets };
      res.writeHead(statut, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': octets,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...entetes,
      });
      res.end(texte);
    };
    const morceaux = [];
    let taille = 0;
    let trop = false;
    req.on('data', (m) => {
      if (mesure) mesure.octets_entree += m.length;
      if (trop) return;
      taille += m.length;
      if (taille > CORPS_MAX) {
        trop = true;
        morceaux.length = 0;
        if (mesure) mesure.tCorps = performance.now();
        res.once('finish', () => req.destroy());
        envoyer({ statut: 413, corps: { erreur: 'Requête trop volumineuse.' }, entetes: { Connection: 'close' } });
        return;
      }
      morceaux.push(m);
    });
    // le visiteur part avant la réponse : ce qui l'attend encore s'arrête (téléchargement de POST /api/classeur/)
    const abandon = new AbortController();
    res.once('close', () => {
      if (!res.writableFinished) abandon.abort(new Error('requête abandonnée par le visiteur'));
    });
    /** Un échec du traitement : journal, évènement erreur_5xx (avec l'empreinte de la pile), réponse 500. */
    const echec = (e) => {
      exception = true;
      journal(`ERREUR ${req.method} ${req.url} : ${e?.stack ?? e?.message ?? e}`);
      evenement('erreur_5xx', { detail: { methode: methodeNormalisee(req.method), route, statut: 500, ...empreinteDePile(e) } });
      return { statut: 500, corps: { erreur: 'Erreur interne du service.' } };
    };
    req.on('end', () => {
      if (trop) return;
      if (mesure) mesure.tCorps = performance.now();
      let reponse;
      try {
        const url = new URL(req.url ?? '/', 'http://service');
        sql.debuter();
        try {
          reponse = traiter({ methode: req.method ?? 'GET', chemin: url.pathname, recherche: url.search, entetes: req.headers, corps: Buffer.concat(morceaux).toString('utf8'),
            signal: abandon.signal },
          { base: baseMesuree, etat: decrire, journal, journalDuService: memoire, edition: Boolean(edition), dossier, reference: referenceDuSite, depot, adresse, github, interrupteursGithub,
            maintenance: maintenanceDemandee, metriques, evenement, classeur, tipeee, extrait, attestations: dossierDesAttestations, acces, essaiDeStructure, atelier, source: estSource,
            bascule2: enBascule2, paquets, gel, codeDuService: () => ({ commit: typeof version.commit === 'string' ? version.commit : null, empreinte: version.empreinte ?? null }) });
        } finally {
          const mesureSql = sql.terminer();
          if (mesure) mesure.sql = mesureSql;
        }
      } catch (e) {
        reponse = echec(e);
      }
      if (reponse?.gel === true) gelee = true;
      // une promesse (POST /api/classeur/, GET /api/tipeee/ : les routes asynchrones ; la mesure SQL, synchrone, est déjà prise) : la réponse part
      // quand elle arrive
      if (typeof reponse?.then === 'function') {
        reponse.then((r) => r, echec).then(envoyer).catch((e) => journal(`ERREUR ${req.method} ${req.url} : envoi de la réponse : ${e?.message ?? e}`));
        return;
      }
      envoyer(reponse);
    });
  });

  // un client qui ouvre une connexion et envoie ses en-têtes ou son corps au goutte-à-goutte (slowloris) ne garde pas un socket 5 minutes
  // (défaut de Node) : les corps du service (1 Mio au plus) arrivent en quelques secondes
  serveur.headersTimeout = 15_000;
  serveur.requestTimeout = 30_000;
  await new Promise((ok, ko) => {
    serveur.once('error', ko);
    serveur.listen(port, hote, ok);
  });
  const ecoute = serveur.address();
  serviceOuvert = true;
  setImmediate(() => ombre?.demarrer());
  atelier?.demarrer();
  journal(`service des personnages ${version.version} : http://${hote}:${ecoute.port}/api/ (règles ${regles}, base ${chemin})${edition ? ' ; édition des règles OUVERTE (site de dev)' : ''}${maintenance ? ` ; annonce de maintenance : ${maintenance}` : ''}${metriques ? ` ; métriques : ${metriques.fichier}${metriques.pagesOuvertes ? '' : ' (pages vues fermées)'}` : ''}`);
  evenement('demarrage', {
    duree_ms: performance.now() - lancementDuService,
    detail: { version: version.version, code: version.empreinte ?? null, node: process.version, pid: process.pid, edition: Boolean(edition), instance: metriques?.instance ?? null,
      memoire_limite: limiteMemoire(), pages: metriques?.pagesOuvertes ?? null, brutes: metriques?.brutes ?? null },
  });

  let minuterie = null;
  let veilleDesDemandes = null;
  let reattestation = null;
  let arrete = false;
  async function arreter() {
    if (arrete) return;
    arrete = true;
    if (minuterie) clearInterval(minuterie);
    if (veilleDesDemandes) clearInterval(veilleDesDemandes);
    if (reattestation) clearInterval(reattestation);
    essaiDeStructure?.arreter();
    const ombreFinie = ombre?.arreter();
    const atelierFini = atelier?.arreter();
    await new Promise((ok) => {
      serveur.close(() => ok());
      serveur.closeAllConnections?.();
    });
    // dernier échantillon et dernier versement des métriques (l'arrêt en est un évènement), puis leur base est fermée ; avant la base vivante, que
    // la répartition du disque lit encore (octets de ses images)
    evenement('arret', { detail: { duree_s: Math.round((performance.now() - lancementDuService) / 1000) } });
    if (metriques) sansEchec(() => metriques.arreter());
    fermer();
    await ombreFinie; // le fil de l'essai dans l'ombre efface ses copies avant que le service rende la main
    await atelierFini;
  }

  // les demandes d'essai de l'installateur : un `readdir` d'un dossier presque toujours absent, plus souvent que la surveillance des fichiers (l'installateur
  // attend la réponse) ; l'essai lui-même tourne dans un fil à part
  const passageDesDemandes = reglagesEssai === false ? 0 : (reglagesEssai?.intervalle ?? (intervalle > 0 ? Math.min(INTERVALLE_DES_DEMANDES_MS, intervalle) : 0));
  if (essaiDeStructure && passageDesDemandes > 0) {
    veilleDesDemandes = setInterval(() => {
      try {
        essaiDeStructure.surveiller().catch((e) => journal(`ERREUR structure : ${e?.message ?? e}`, { categorie: 'base' }));
      } catch (e) {
        journal(`ERREUR structure : ${e?.message ?? e}`, { categorie: 'base' });
      }
    }, passageDesDemandes);
    veilleDesDemandes.unref?.();
  }

  // l'attestation réécrite toutes les heures (production) : les fiches enregistrées depuis comptent ; un échec est noté, rien d'autre (attester)
  const periodeDeLAttestation = reglagesAttestation?.intervalle ?? INTERVALLE_DE_L_ATTESTATION_MS;
  if (publierAttestation && periodeDeLAttestation > 0) {
    reattestation = setInterval(() => {
      if (dernierePreparation) attester(dernierePreparation);
    }, periodeDeLAttestation);
    reattestation.unref?.();
  }

  if (intervalle > 0) {
    const nouvelleVersion = guetteur(fichierVersion ? signature(fichierVersion) : null);
    const nouvellesRegles = guetteur(signature(regles));
    let autreBase; // inode vu à la place de celui de la base ouverte, à confirmer à l'observation suivante
    minuterie = setInterval(() => {
      if (fichierVersion && nouvelleVersion(signature(fichierVersion))) {
        journal('nouvelle version du service livrée : arrêt pour relance');
        evenement('nouvelle_version', { detail: { version_actuelle: version.version } });
        arreter().then(relancer);
        return;
      }
      const vue = inode(chemin);
      if (vue === etat.inode) autreBase = undefined;
      else if (vue !== autreBase) autreBase = vue;
      else {
        autreBase = undefined;
        const source = estSource(); // une base source absente n'est jamais recréée : ouvrir() le dit et la laisse fermée
        journal(vue === null ? (source ? 'base source absente' : 'base vivante absente : recréation') : 'base vivante remplacée : réouverture');
        evenement('base_vivante_remplacee', { detail: { absente: vue === null, ...(source ? { source: true } : {}) } });
        ouvrir();
      }
      if (nouvellesRegles(signature(regles))) {
        if (estSource()) {
          journal('base des règles changée : la base est la source (db/source), elle n’est pas refaite', { categorie: 'base' });
          evenement('regles_changees', { detail: { source: true } });
        } else {
          journal('base des règles changée');
          evenement('regles_changees', {});
          ouvrir();
        }
      }
      suivreLaMiseAJour();
      try {
        gel.verifier(); // un gel posé ou échu se note au journal sans attendre une requête (un `stat`)
      } catch (e) {
        journal(`ERREUR gel : ${e?.message ?? e}`, { categorie: 'gel' });
      }
    }, intervalle);
    minuterie.unref?.();
  }

  return { url: `http://${hote}:${ecoute.port}`, port: ecoute.port, arreter, etat: decrire, maintenance: etatMaintenance, journalDuService: memoire, metriques, essaiDeStructure, ombre, atelier };
}
