// Routes de l'API du service (docs/serveur.md, « API ») : une requête déjà lue (méthode, chemin, en-têtes, corps) → une réponse JSON.
// Sans réseau ni état propre : service.mjs lit la requête HTTP et fournit la base vivante ; les tests appellent `traiter` directement.
//
//   GET  /api/etat/                 état du service et de la base vivante
//   GET  /api/maintenance/          ce serveur est-il en maintenance (vraie mise à jour en cours, nouvelle version pas encore ici) ? — maintenance.mjs
//   POST /api/maintenance/lever/    { lot } → lève la maintenance des deux serveurs (site de dev seulement : il tient le lancement)
//   GET  /api/personnages/          résumé de chaque prétiré (recherche)
//   POST /api/personnages/          crée un prétiré                       → 201, { personnage, controles, niveau }
//   GET  /api/personnages/<id>/     une fiche                             → { personnage, controles, niveau }
//   PUT  /api/personnages/<id>/     modifie une fiche (avec sa `version`) → { personnage, controles, niveau } ; 409 si elle a changé entre-temps
//   DELETE /api/personnages/<id>/   supprime une fiche (corps { version })  → { supprime } ; 409 si elle a changé entre-temps
// Édition des règles, sur le site de dev seulement (service lancé avec MAVERICK_EDITION=1 ; ailleurs 403) — serveur/edition.mjs :
//   GET  /api/edition/en-attente/   lignes modifiées depuis la construction des pages (ce que les pages statiques doivent montrer à la place)
//   POST /api/edition/lignes/       { lignes: [{ table, cle }] } → la ligne actuelle de chacune (passage en mode modification)
//   GET  /api/edition/listes/       listes des formulaires (compétences, catégories de classe, races hybrides…)
//   GET  /api/edition/pages/        les pages du wiki (id, titre) : cibles d'un lien posé dans le texte du guide
//   POST /api/edition/race/         { race } → magies innées et relations de la race, dans la base vivante
//   POST /api/edition/classe/       { classe } → spécialités, dons, choix et fiches qui les citent (ajout et suppression depuis sa page)
//   POST /api/edition/bestiaire/    { connues, logo } → l'ordre des lignes du tableau des monstres, et la ligne et la carte de celles que la page n'a pas
//   POST /api/edition/portrait/     { table, cle } → le portrait d'une carte de monstre ou d'une espèce, en entier, et son cadrage (les autres réponses
//                                   ne donnent d'une image que son empreinte : ligneSansImage)
//   POST /api/edition/              { page, operations } → applique un lot d'un bloc et le note au journal
//   GET  /api/edition/journal/      le journal des modifications en attente, à rapatrier dans data/rows (npm run db:appliquer-edition)
// Page « Mise à jour », sur le site de dev seulement (même garde) — serveur/notes-de-version.mjs :
//   GET  /api/mise-a-jour/              la note en préparation : modifications production → dev (calculées), brouillon, état du lancement
//   POST /api/mise-a-jour/brouillon/    { texte, avant } → enregistre le champ libre des admins
//   POST /api/mise-a-jour/lancer/       { confirmation, simulation? } → fige le lot et déclenche le workflow GitHub de mise à jour → 202
//                                       (simulation : true = simulation de mise à jour, le workflow vérifie tout sans rien pousser)
//   POST /api/mise-a-jour/liberer/      { lot } → annule ce lancement s'il n'est pas parti, a échoué avant dev, ou se lance à la main : le brouillon
//                                       redevient modifiable, le lot n'est plus servi (et son run est annulé sur GitHub)
//   GET  /api/mise-a-jour/lancement/    état du lancement (suivi du run GitHub)
//   GET  /api/mise-a-jour/lots/<id>/    un lot figé, tel quel (le workflow le télécharge et vérifie son empreinte)
// Les adresses finissent par « / », comme celles du site (en développement, Astro refuse une adresse sans « / » finale avant de la transmettre) ;
// le service accepte aussi la forme sans « / ».
//
// Avant la 1.0, pas de comptes : quiconque a le mot de passe du site (nginx) lit et écrit les prétirés. Les écritures exigent un corps JSON
// (Content-Type: application/json) et refusent une requête qu'un navigateur dit venir d'un autre site (Sec-Fetch-Site) : un formulaire ou un
// script d'un autre site ne peut pas écrire à la place de quelqu'un de connecté.
import { ErreurEdition, donneesDeClasse, donneesDeRace, enregistrer, lignesDuBestiaire, listes, lireLignes, pagesDuWiki, portraitDe } from './edition.mjs';
import { ligneSansImage } from '../src/lib/edition-modele.mjs';
import { journalExporte, lignesEnAttente } from './edition-journal.mjs';
import {
  actualiserLancement, CONFIRMATION, enregistrerBrouillon, ErreurNotes, estLiberable, figerLot, leverMaintenance, libererLot, lireLot, lireReference,
  noteEnPreparation, occupe,
} from './notes-de-version.mjs';
import { ErreurFiche, controlesDe, enregistrerFiche, lireFiche, listerFiches, niveauDe, supprimerFiche } from './fiches.mjs';
import { CHAMP_VERSION } from '../src/lib/fiche-format.mjs';

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

/**
 * @param {{ methode: string, chemin: string, entetes: Record<string, string>, corps?: string }} requete chemin sans paramètres (« /api/… »)
 * @param {{ base: () => import('node:sqlite').DatabaseSync | null, etat: () => object, journal?: (ligne: string) => void }} service
 * @returns {{ statut: number, corps: object, entetes: Record<string, string> }}
 */
export function traiter(requete, service) {
  const { methode, chemin, entetes = {} } = requete;
  if (!chemin.startsWith(PREFIXE)) return erreur(404, 'Adresse inconnue.');
  const morceaux = chemin.slice(PREFIXE.length).split('/');
  if (morceaux.at(-1) === '') morceaux.pop(); // « /api/personnages/ » = « /api/personnages »
  const [ressource, brut, ...reste] = morceaux;
  const permis = (...methodes) => (methodes.includes(methode) ? null : json(405, { erreur: `Méthode ${methode} non permise ici.` }, { Allow: methodes.join(', ') }));

  if (ressource === 'etat' && brut === undefined) return permis('GET') ?? json(200, service.etat());
  if (ressource === 'maintenance') return traiterMaintenance(requete, service, brut, reste, permis);
  if (ressource === 'edition') return traiterEdition(requete, service, brut, reste, permis);
  if (ressource === 'mise-a-jour') return traiterMiseAJour(requete, service, brut, reste, permis);
  if (ressource !== 'personnages' || reste.length) return erreur(404, 'Adresse inconnue.');

  let id = null;
  if (brut !== undefined) {
    try {
      id = decodeURIComponent(brut);
    } catch {
      return erreur(404, 'Fiche introuvable.');
    }
    if (!id || id.length > 200) return erreur(404, 'Fiche introuvable.');
  }
  const refus = id === null ? permis('GET', 'POST') : permis('GET', 'PUT', 'DELETE');
  if (refus) return refus;

  const db = service.base();
  if (!db) return erreur(503, 'La base des fiches n’est pas disponible pour le moment.', { etat: service.etat() });

  if (methode === 'GET') {
    if (id === null) return json(200, { personnages: listerFiches(db) });
    const personnage = lireFiche(db, id);
    if (!personnage) return erreur(404, 'Fiche introuvable.');
    return json(200, { personnage, controles: controlesDe(db, id), niveau: niveauDe(db, id) });
  }

  const interdit = refusEcriture(entetes);
  if (interdit) return interdit;
  const { valeur, refus: illisible } = lireCorps(requete.corps);
  if (illisible) return illisible;
  try {
    if (methode === 'DELETE') {
      supprimerFiche(db, id, valeur?.[CHAMP_VERSION]);
      service.journal?.(`suppression du prétiré ${id}`);
      return json(200, { supprime: id });
    }
    const resultat = enregistrerFiche(db, valeur, { id });
    service.journal?.(`${id === null ? 'création' : 'modification'} du prétiré ${resultat.personnage.id}`);
    if (id === null) return json(201, resultat, { Location: `${PREFIXE}personnages/${encodeURIComponent(resultat.personnage.id)}/` });
    return json(200, resultat);
  } catch (e) {
    if (e instanceof ErreurFiche) return erreur(e.statut, e.message, e.details);
    throw e;
  }
}

/** Les routes /api/edition/… (site de dev seulement). */
function traiterEdition(requete, service, action, reste, permis) {
  if (!service.edition) return erreur(403, 'L’édition des règles n’est ouverte que sur le site de dev.');
  if (reste.length || !['en-attente', 'lignes', 'listes', 'pages', 'journal', 'race', 'classe', 'bestiaire', 'portrait', undefined].includes(action)) return erreur(404, 'Adresse inconnue.');
  const refus = action === undefined || ['lignes', 'race', 'classe', 'bestiaire', 'portrait'].includes(action) ? permis('POST') : permis('GET');
  if (refus) return refus;
  const db = service.base();
  if (!db) return erreur(503, 'La base n’est pas disponible pour le moment.', { etat: service.etat() });

  if (action === 'en-attente') return json(200, { lignes: lignesEnAttente(db).map((l) => ({ ...l, ligne: ligneSansImage(l.table, l.ligne) })) });
  if (action === 'listes') return json(200, listes(db));
  if (action === 'pages') return json(200, { pages: pagesDuWiki(db) });
  if (action === 'journal') {
    const jour = new Date().toISOString().slice(0, 10);
    return json(200, journalExporte(db), { 'Content-Disposition': `attachment; filename="journal-edition-${jour}.json"` });
  }
  const interdit = refusEcriture(requete.entetes ?? {});
  if (interdit) return interdit;
  const { valeur, refus: illisible } = lireCorps(requete.corps);
  if (illisible) return illisible;
  try {
    if (action === 'lignes') return json(200, { lignes: lireLignes(db, valeur?.lignes) });
    if (action === 'race') return json(200, donneesDeRace(db, valeur?.race));
    if (action === 'classe') return json(200, donneesDeClasse(db, valeur?.classe));
    if (action === 'bestiaire') return json(200, lignesDuBestiaire(db, valeur));
    if (action === 'portrait') return json(200, portraitDe(db, valeur));
    const resultat = enregistrer(db, valeur);
    // les fiches dont le lot a retiré un élément supprimé (R42) : un compte, jamais leurs noms (le journal du service n'est pas la réponse)
    const adaptees = resultat.fiches?.length ? ` ; ${resultat.fiches.length} fiche(s) de personnage adaptée(s)` : '';
    if (resultat.lot) service.journal?.(`édition : lot ${resultat.lot} (${resultat.modifications} ligne(s)) depuis ${valeur.page ?? '?'}${adaptees}`);
    return json(200, resultat);
  } catch (e) {
    if (e instanceof ErreurEdition) return erreur(e.statut, e.message, e.details);
    throw e;
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
  const interdit = refusEcriture(requete.entetes ?? {});
  if (interdit) return interdit;
  const { valeur, refus: illisible } = lireCorps(requete.corps);
  if (illisible) return illisible;
  try {
    const lancement = leverMaintenance(service.dossier, { lot: valeur?.lot, instant: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') });
    service.journal?.(`maintenance levée depuis la page (lot ${lancement.lot})`);
    return json(200, service.maintenance?.() ?? sansMaintenance);
  } catch (e) {
    if (e instanceof ErreurNotes) return erreur(e.statut, e.message, e.details);
    throw e;
  }
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
  if (reste.length || ![undefined, 'brouillon', 'lancer', 'liberer', 'lancement'].includes(action)) return erreur(404, 'Adresse inconnue.');
  const refus = action === undefined || action === 'lancement' ? permis('GET') : permis('POST');
  if (refus) return refus;
  const db = service.base();
  if (!db) return erreur(503, 'La base n’est pas disponible pour le moment.', { etat: service.etat() });
  const versionDev = service.etat().version ?? null;
  const github = { configure: Boolean(service.github?.configure()), depot: service.depot ?? null };
  const instant = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (action === undefined || action === 'lancement') {
    service.github?.suivre().catch(() => {}); // en arrière-plan : la réponse suivante aura l'état à jour
    const lancement = actualiserLancement(db, service.dossier, { reference: lireReference(service.reference) });
    // mêmes règles que le service pour la page : annulable, et place occupée (un nouveau lancement serait refusé)
    const regles = { liberable: estLiberable(lancement, instant), occupe: occupe(lancement, instant) };
    if (action === 'lancement') return json(200, { lancement, ...regles, github });
    return json(200, { ...noteEnPreparation(db, { reference: service.reference, versionDev }), lancement, ...regles, github, confirmation: CONFIRMATION });
  }
  const interdit = refusEcriture(requete.entetes ?? {});
  if (interdit) return interdit;
  const { valeur, refus: illisible } = lireCorps(requete.corps);
  if (illisible) return illisible;
  try {
    if (action === 'brouillon') return json(200, { brouillon: enregistrerBrouillon(db, valeur ?? {}, { instant }) });
    if (action === 'liberer') {
      // `lot` : le lancement que la page affiche (un onglet périmé n'annule pas le suivant) ; le run éventuel est annulé sur GitHub
      const lancement = libererLot(db, service.dossier, { instant, lot: valeur?.lot, annulerRun: service.github?.annulerRun ?? null });
      service.maintenance?.(); // annulé : l'annonce de maintenance est retirée tout de suite (les deux serveurs rouvrent)
      return json(200, { lancement, liberable: estLiberable(lancement, instant), occupe: occupe(lancement, instant) });
    }
    const note = noteEnPreparation(db, { reference: service.reference, versionDev });
    // sans jeton GitHub sur ce serveur : le lot est figé quand même, la page dit comment lancer le workflow à la main
    const lancement = figerLot(db, service.dossier, {
      versionDev, versionCible: note.version_cible, instant, confirmation: valeur?.confirmation, adresse: adressePublique(service, requete.entetes ?? {}),
      etat: github.configure ? 'envoi' : 'manuel', simulation: valeur?.simulation === true, aLivrer: note.lignes ? note.lignes.length : null,
      ...(service.limites ? { limites: service.limites } : {}),
    });
    service.journal?.(`${lancement.simulation ? 'simulation de mise à jour' : 'mise à jour'} : lot ${lancement.lot} figé (${lancement.modifications} modification(s), V${note.version_cible})`);
    // vraie mise à jour : l'annonce de maintenance part tout de suite (les deux serveurs passent en maintenance), et suit le déclenchement
    service.maintenance?.();
    if (github.configure) service.github.declencher().then(() => service.maintenance?.()).catch(() => {});
    return json(202, { lancement, github });
  } catch (e) {
    if (e instanceof ErreurNotes) return erreur(e.statut, e.message, e.details);
    throw e;
  }
}
