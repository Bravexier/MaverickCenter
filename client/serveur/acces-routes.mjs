// Classement des routes du service pour l'accès au site de dev (docs/serveur.md, « Accès au site de dev » ; R275, R310). Sans état et sans dépendance :
// api.mjs le consulte, le test `serveur-acces-routes` le compare à la liste des routes d'en-tête d'api.mjs (une route nouvelle non classée échoue).
//
// Le site de dev est FERMÉ (R310 (3)) : plus rien sans une session Discord de niveau MJ au moins, ou une clé. Quatre classes, du moins au plus fermé :
//   ouverte      sans rien, même sur le site de dev : la connexion elle-même (page de connexion, routes /api/connexion/…, /api/moi/, /api/acces/…) et ce qu'un
//                service extérieur doit joindre sans connexion : le lot figé de la mise à jour (le workflow GitHub le télécharge), l'état du service
//                (`/api/etat/` : les contrôles de santé de l'activation et de la bascule le lisent dans le conteneur, sans la liste des fiches adaptées) et la relève de
//                la maintenance ;
//   lecture      une session MJ au moins, OU la clé de lecture (en-tête X-Maverick-Cle ou X-Maverick-Key) : tout le reste de la lecture (prétirés, ce que les
//                pages lisent pour montrer la base vivante, le journal des modifications, la page Debug et ses tables (fiches, comptes et groupes compris),
//                l'API /api/v1/ en lecture, les lots en conflit de la page « Mise à jour », les lots de changements déposés) ;
//   proposition  les routes de DÉPÔT : déposer un lot de changements, refaire son essai, « tout recalculer ». Tant que les clés ne posent pas de clé de dépôt
//                (état sûr, R275 (4)), la porte est la clé de lecture OU une session Créateur, et un dépôt n'écrit que dans `lot_de_changements` (la proposition
//                et son essai à blanc, sur une copie) : rien du contenu ne change avant le clic (« appliquer », classé `ecriture`). Une fois la clé de dépôt posée
//                (R291, qui remplace R275 (4)), la porte demande la clé de dépôt OU une session Créateur : la clé de lecture, que détient aussi la CI, ne dépose
//                plus, et le lot déposé est appliqué aussitôt (serveur/acces.mjs#controler, api.mjs#traiterLots) ;
//   ecriture     une session Créateur seule : toute écriture (édition, prétirés, /api/v1/, appliquer, refuser ou annuler un lot de changements, ou une seule de
//                ses lignes), « Effectuer la mise à jour », la simulation, lever la maintenance.
// Une route absente de cette table (inconnue) se classe `ecriture` : fermée par défaut.
//
// Sur la production, il n'y a aucune porte (R307 : rien de plus qu'avant) : la table ne sert que le site de dev. Les routes de connexion y existent, ouvertes.
//
// Aucune route ouverte ne montre une fiche de joueur, un compte ou un groupe : l'état masque la liste des fiches adaptées (`retraits`) quand l'appelant n'a pas
// la lecture (api.mjs), et `/api/moi/` ne rend que le profil de la session de l'appelant.

export const CLASSES = Object.freeze(['ouverte', 'lecture', 'proposition', 'ecriture']);

const LECTURE = ['GET'];
const ECRITURE_V1 = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** [méthodes, chemin sans « / » finale, classe] */
const TABLE = [
  // service et pages : l'état sert aux contrôles de santé de l'activation et de la bascule (lu dans le conteneur, sans cookie) et reste masqué sans la lecture ;
  // la relève de la maintenance, que chaque page demande ; le reste de la lecture demande une session MJ ou une clé
  [LECTURE, /^\/api\/etat$/, 'ouverte'],
  [LECTURE, /^\/api\/maintenance$/, 'ouverte'],
  [['POST'], /^\/api\/maintenance\/lever$/, 'ecriture'],
  [LECTURE, /^\/api\/tipeee$/, 'lecture'],
  [['POST'], /^\/api\/classeur$/, 'lecture'],
  [['POST'], /^\/api\/metriques\/page$/, 'lecture'],
  // prétirés et fiches de joueur : « Importer » et la page /personnages/ se lisent avec la lecture (MJ au moins ; le service montre à chacun ce que
  // v_personnage_visible lui ouvre, R318) ; les créer, les modifier et les supprimer demande un Créateur
  [LECTURE, /^\/api\/personnages$/, 'lecture'],
  [LECTURE, /^\/api\/personnages\/[^/]+$/, 'lecture'],
  [LECTURE, /^\/api\/personnages\/[^/]+\/portrait$/, 'lecture'],
  [['POST'], /^\/api\/personnages$/, 'ecriture'],
  [['PUT', 'DELETE'], /^\/api\/personnages\/[^/]+$/, 'ecriture'],
  // R318 : ranger une fiche à un compte et régler son « Visible par » (écritures : un Créateur à la porte ; le service exige en plus le Créateur pour le transfert,
  // le propriétaire ou un Créateur pour la visibilité), et la liste des comptes du menu de transfert (la lecture à la porte ; le service exige une session Créateur)
  [['PUT'], /^\/api\/personnages\/[^/]+\/(proprietaire|visibilite)$/, 'ecriture'],
  [LECTURE, /^\/api\/utilisateurs$/, 'lecture'],
  // R320 et R310 (3) : « Copier le prétiré » est faite par un Joueur, un MJ ou un Créateur en production (sans porte : le service exige la session et son niveau, jamais une clé) ;
  // sur le site de dev, seul le Créateur écrit, copie comprise (le MJ y lit seulement) : la porte la classe `ecriture`, comme toute écriture de fiche
  [['POST'], /^\/api\/personnages\/[^/]+\/copie$/, 'ecriture'],
  // édition : ce que les pages lisent au chargement pour montrer la base vivante (surcouche), puis les écritures
  [LECTURE, /^\/api\/edition\/(en-attente|listes|pages|mots-cles|chronologie|plan|page-de-l-adresse)$/, 'lecture'],
  [['POST'], /^\/api\/edition\/(lignes|race|classe|bestiaire|portrait|evenement)$/, 'lecture'],
  [LECTURE, /^\/api\/edition\/journal$/, 'lecture'],
  // l'extrait du contenu pour les sessions de Claude (serveur/extrait.mjs) : règles, notes et historique ; les tables des fiches, comptes, groupes et du journal y sont vides
  [LECTURE, /^\/api\/edition\/extrait(\/meta)?$/, 'lecture'],
  [['POST'], /^\/api\/edition$/, 'ecriture'],
  // « le bouton » de l'atelier du site de dev : l'extrait refait tout de suite (serveur/atelier.mjs) ; ce n'est pas un dépôt de contenu : un Créateur seul
  [['POST'], /^\/api\/edition\/atelier$/, 'ecriture'],
  // les lots de changements (serveur/edition-lots.mjs) : se lisent avec la lecture ; un Créateur dépose (classe `proposition` : la clé de lecture tant que la clé
  // de dépôt n'est pas posée, puis la clé de dépôt, R291) ; appliquer, refuser et annuler, qui décident, demandent un Créateur, comme l'aperçu et le clic
  // d'une annulation ligne par ligne (R291)
  [LECTURE, /^\/api\/edition\/lots(\/[0-9a-f-]{36}(\/annulation)?)?$/, 'lecture'],
  [['POST'], /^\/api\/edition\/lots$/, 'proposition'],
  [['POST'], /^\/api\/edition\/lots\/[0-9a-f-]{36}\/essai$/, 'proposition'],
  [['POST'], /^\/api\/edition\/lots\/recalcul$/, 'proposition'], // « tout recalculer » : dépose un lot de nature « code » (aucune écriture du contenu)
  [['POST'], /^\/api\/edition\/lots\/ancrage$/, 'proposition'], // « préparer l'ancrage » (R309) : dépose ses lots, appliqués seulement avec la clé de dépôt ou une session Créateur (R291)
  [LECTURE, /^\/api\/edition\/lots\/ancrage$/, 'lecture'], // son état (en cours, dernier résultat)
  [['POST'], /^\/api\/edition\/lots\/[0-9a-f-]{36}\/(appliquer|refuser|annuler)$/, 'ecriture'],
  [LECTURE, /^\/api\/edition\/lots\/[0-9a-f-]{36}\/lignes\/[0-9]+\/annulation$/, 'ecriture'], // l'aperçu d'une seule ligne : une copie de la base, comme un clic
  [['POST'], /^\/api\/edition\/lots\/[0-9a-f-]{36}\/lignes\/[0-9]+\/annuler$/, 'ecriture'],
  // page « Mise à jour » : le lot figé que le workflow GitHub télécharge (adresse à uuid aléatoire, ni fiche ni compte) reste ouvert ; la note en préparation et
  // l'état du lancement se lisent avec la lecture (la page /mise-a-jour/ est elle-même fermée)
  [LECTURE, /^\/api\/mise-a-jour\/lots\/[0-9a-f-]{36}$/, 'ouverte'],
  [LECTURE, /^\/api\/mise-a-jour(\/lancement)?$/, 'lecture'],
  [LECTURE, /^\/api\/mise-a-jour\/conflits$/, 'lecture'],
  [['POST'], /^\/api\/mise-a-jour\/(brouillon|majeure|lancer|liberer|conflits|copier)$/, 'ecriture'],
  // page Debug : le contenu de toutes les tables, fiches, comptes et groupes compris
  [LECTURE, /^\/api\/debug\/(journal|systeme|base|structure|atelier|metriques|metriques\/(requetes|export)|tables|tables\/[^/]+)$/, 'lecture'],
  // API REST
  [LECTURE, /^\/api\/v1(\/.*)?$/, 'lecture'],
  [ECRITURE_V1, /^\/api\/v1(\/.*)?$/, 'ecriture'],
  // l'accès lui-même : savoir où l'on en est, la vérification d'un mandataire (forward_auth de Caddy), la connexion par Discord (R310), le profil de la session, la déconnexion
  [LECTURE, /^\/api\/acces$/, 'ouverte'],
  [LECTURE, /^\/api\/acces\/verifier$/, 'ouverte'],
  [LECTURE, /^\/api\/moi$/, 'ouverte'],
  [LECTURE, /^\/api\/connexion\/discord$/, 'ouverte'],
  [LECTURE, /^\/api\/connexion\/discord\/retour$/, 'ouverte'],
  [['POST'], /^\/api\/deconnexion$/, 'ouverte'],
];

/** Le chemin d'une adresse du service : sans chaîne de requête, sans « / » finale (« /api/etat/ » et « /api/etat » sont la même route). */
export function cheminSansFin(adresse) {
  const texte = String(adresse ?? '');
  const fin = texte.search(/[?#]/);
  const chemin = fin >= 0 ? texte.slice(0, fin) : texte;
  return chemin.length > 1 && chemin.endsWith('/') ? chemin.slice(0, -1) : chemin;
}

/** La classe d'une route : { classe, connue }. `connue` est faux pour une route que la table ne nomme pas (elle se classe `ecriture`). */
export function classer(methode, adresse) {
  const m = String(methode ?? '').toUpperCase();
  const chemin = cheminSansFin(adresse);
  for (const [methodes, motif, classe] of TABLE) {
    if (methodes.includes(m) && motif.test(chemin)) return { classe, connue: true };
  }
  return { classe: 'ecriture', connue: false };
}

/** Toutes les lignes de la table (méthodes, motif, classe) : pour les tests. */
export const ROUTES_CLASSEES = Object.freeze(TABLE.map(([methodes, motif, classe]) => Object.freeze({ methodes, motif, classe })));
