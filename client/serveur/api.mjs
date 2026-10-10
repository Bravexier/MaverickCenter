// Routes de l'API du service (docs/serveur.md, « API ») : une requête déjà lue (méthode, chemin, en-têtes, corps) → une réponse JSON.
// Sans réseau ni état propre : service.mjs lit la requête HTTP et fournit la base vivante ; les tests appellent `traiter` directement.
//
//   GET  /api/etat/                 état du service et de la base vivante
//   GET  /api/personnages/          résumé de chaque prétiré (recherche)
//   POST /api/personnages/          crée un prétiré                       → 201, { personnage, controles, niveau }
//   GET  /api/personnages/<id>/     une fiche                             → { personnage, controles, niveau }
//   PUT  /api/personnages/<id>/     modifie une fiche (avec sa `version`) → { personnage, controles, niveau } ; 409 si elle a changé entre-temps
// Les adresses finissent par « / », comme celles du site (en développement, Astro refuse une adresse sans « / » finale avant de la transmettre) ;
// le service accepte aussi la forme sans « / ».
//
// Avant la 1.0, pas de comptes : quiconque a le mot de passe du site (nginx) lit et écrit les prétirés. Les écritures exigent un corps JSON
// (Content-Type: application/json) et refusent une requête qu'un navigateur dit venir d'un autre site (Sec-Fetch-Site) : un formulaire ou un
// script d'un autre site ne peut pas écrire à la place de quelqu'un de connecté.
import { ErreurFiche, controlesDe, enregistrerFiche, lireFiche, listerFiches, niveauDe } from './fiches.mjs';

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
  const refus = id === null ? permis('GET', 'POST') : permis('GET', 'PUT');
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
    const resultat = enregistrerFiche(db, valeur, { id });
    service.journal?.(`${id === null ? 'création' : 'modification'} du prétiré ${resultat.personnage.id}`);
    if (id === null) return json(201, resultat, { Location: `${PREFIXE}personnages/${encodeURIComponent(resultat.personnage.id)}/` });
    return json(200, resultat);
  } catch (e) {
    if (e instanceof ErreurFiche) return erreur(e.statut, e.message, e.details);
    throw e;
  }
}
