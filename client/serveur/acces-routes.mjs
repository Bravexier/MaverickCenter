// Classement des routes du service pour l'accès au site de dev (docs/serveur.md, « Accès au site de dev » ; R275). Sans état et sans dépendance :
// api.mjs le consulte, le test `serveur-acces-routes` le compare à la liste des routes d'en-tête d'api.mjs (une route nouvelle non classée échoue).
//
// Trois classes, du moins au plus fermé :
//   ouverte    sans rien : ce dont les pages ont besoin pour se lire (la lecture du site de dev reste libre) et la connexion elle-même ;
//   lecture    la clé de lecture (en-tête X-Maverick-Cle ou X-Maverick-Key) OU le mot de passe (cookie de session) : ce qui montre le journal des modifications, la page
//              Debug et ses tables (fiches, comptes et groupes compris), l'API /api/v1/ en lecture, les lots en conflit de la page « Mise à jour » ;
//   ecriture   le mot de passe seul : toute écriture (édition, prétirés, /api/v1/), « Effectuer la mise à jour », la simulation, lever la maintenance.
// Une route absente de cette table (inconnue) se classe `ecriture` : fermée par défaut.
//
// Portée « tout » (option c du propriétaire, un seul mot de passe pour tout le site) : chaque route `ouverte` qui n'est pas `essentielle` passe en
// `lecture`. Restent ouvertes, en plus de la connexion, celles qu'un service extérieur doit joindre sans mot de passe : le lot figé de la mise à jour (le
// workflow GitHub le télécharge).
//
// Aucune route ouverte ne montre une fiche de joueur, un compte ou un groupe : `/api/personnages/` ne sert que les prétirés (nature = 'pretire'), l'état
// masque la liste des fiches adaptées (`retraits`) et la route `classe` ses libellés de fiches quand l'appelant n'a pas la lecture (api.mjs).

export const CLASSES = Object.freeze(['ouverte', 'lecture', 'ecriture']);
export const PORTEES = Object.freeze(['ecriture', 'tout']);

const LECTURE = ['GET'];
const ECRITURE_V1 = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** [méthodes, chemin sans « / » finale, classe, essentielle (reste ouverte en portée « tout »)] */
const TABLE = [
  // service et pages
  [LECTURE, /^\/api\/etat$/, 'ouverte'],
  [LECTURE, /^\/api\/maintenance$/, 'ouverte'],
  [['POST'], /^\/api\/maintenance\/lever$/, 'ecriture'],
  [LECTURE, /^\/api\/tipeee$/, 'ouverte'],
  [['POST'], /^\/api\/classeur$/, 'ouverte'],
  [['POST'], /^\/api\/metriques\/page$/, 'ouverte'],
  // prétirés : « Importer » et la page /personnages/ se lisent sans connexion ; les créer, les modifier et les supprimer demande le mot de passe
  [LECTURE, /^\/api\/personnages$/, 'ouverte'],
  [LECTURE, /^\/api\/personnages\/[^/]+$/, 'ouverte'],
  [LECTURE, /^\/api\/personnages\/[^/]+\/portrait$/, 'ouverte'],
  [['POST'], /^\/api\/personnages$/, 'ecriture'],
  [['PUT', 'DELETE'], /^\/api\/personnages\/[^/]+$/, 'ecriture'],
  // édition : ce que les pages lisent au chargement pour montrer la base vivante (surcouche), puis les écritures
  [LECTURE, /^\/api\/edition\/(en-attente|listes|pages|mots-cles|chronologie|plan)$/, 'ouverte'],
  [['POST'], /^\/api\/edition\/(lignes|race|classe|bestiaire|portrait|evenement)$/, 'ouverte'],
  [LECTURE, /^\/api\/edition\/journal$/, 'lecture'],
  // l'extrait du contenu pour les sessions de Claude (serveur/extrait.mjs) : règles, notes et historique ; les tables des fiches, comptes, groupes et du journal y sont vides
  [LECTURE, /^\/api\/edition\/extrait(\/meta)?$/, 'lecture'],
  [['POST'], /^\/api\/edition$/, 'ecriture'],
  // page « Mise à jour »
  [LECTURE, /^\/api\/mise-a-jour\/lots\/[0-9a-f-]{36}$/, 'ouverte', true],
  // la note en préparation et l'état du lancement s'affichent sans connexion (la page /mise-a-jour/ les relève ; /api/maintenance/, ouverte, donne déjà le
  // lot pendant une maintenance) ; les lots en conflit, eux, sont l'outil de résolution
  [LECTURE, /^\/api\/mise-a-jour(\/lancement)?$/, 'ouverte'],
  [LECTURE, /^\/api\/mise-a-jour\/conflits$/, 'lecture'],
  [['POST'], /^\/api\/mise-a-jour\/(brouillon|majeure|lancer|liberer|conflits)$/, 'ecriture'],
  // page Debug : le contenu de toutes les tables, fiches, comptes et groupes compris
  [LECTURE, /^\/api\/debug\/(journal|systeme|base|metriques|metriques\/(requetes|export)|tables|tables\/[^/]+)$/, 'lecture'],
  // API REST
  [LECTURE, /^\/api\/v1(\/.*)?$/, 'lecture'],
  [ECRITURE_V1, /^\/api\/v1(\/.*)?$/, 'ecriture'],
  // l'accès lui-même : se connecter, se déconnecter, savoir où l'on en est, et la vérification d'un mandataire (forward_auth de Caddy)
  [LECTURE, /^\/api\/acces$/, 'ouverte', true],
  [['POST', 'DELETE'], /^\/api\/acces$/, 'ouverte', true],
  [LECTURE, /^\/api\/acces\/verifier$/, 'ouverte', true],
];

/** Le chemin d'une adresse du service : sans chaîne de requête, sans « / » finale (« /api/etat/ » et « /api/etat » sont la même route). */
export function cheminSansFin(adresse) {
  const texte = String(adresse ?? '');
  const fin = texte.search(/[?#]/);
  const chemin = fin >= 0 ? texte.slice(0, fin) : texte;
  return chemin.length > 1 && chemin.endsWith('/') ? chemin.slice(0, -1) : chemin;
}

/**
 * La classe d'une route : { classe, connue, essentielle }. `connue` est faux pour une route que la table ne nomme pas (elle se classe `ecriture`).
 * `portee` « tout » : une route ouverte non essentielle est classée `lecture`.
 */
export function classer(methode, adresse, portee = 'ecriture') {
  const m = String(methode ?? '').toUpperCase();
  const chemin = cheminSansFin(adresse);
  for (const [methodes, motif, classe, essentielle = false] of TABLE) {
    if (!methodes.includes(m) || !motif.test(chemin)) continue;
    return { classe: classe === 'ouverte' && portee === 'tout' && !essentielle ? 'lecture' : classe, connue: true, essentielle };
  }
  return { classe: 'ecriture', connue: false, essentielle: false };
}

/** Toutes les lignes de la table (méthodes, motif, classe) : pour les tests. */
export const ROUTES_CLASSEES = Object.freeze(TABLE.map(([methodes, motif, classe, essentielle = false]) => Object.freeze({ methodes, motif, classe, essentielle })));
