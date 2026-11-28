// « Copier le prétiré » sur la fiche (R320) : la règle du bouton, l'adresse de la copie et le message d'un refus. Module pur, importé par le navigateur
// et seulement par `scripts/fiche.mjs` : la page /personnages/ a sa propre copie de la règle (`lib/personnages-liste.mjs#peutCopier`), car deux scripts
// de page n'importent jamais le même module (skill site-version-portable) ; `test/copie-du-pretire.test.mjs` vérifie qu'elles s'accordent.

/** Les niveaux qui copient un prétiré (R320 (2) : Joueur, MJ et Créateur, comme « Mes personnages », R319). */
export const NIVEAUX_QUI_COPIENT = Object.freeze(['joueur', 'mj', 'createur']);

/**
 * Le niveau de la session d'après la réponse de `GET /api/moi/` (publiée par `scripts/compte.mjs`) : 'observateur', 'joueur', 'mj' ou 'createur' ;
 * null sans session lisible (déconnecté, non-membre, service muet, version portable sans compte).
 */
export function niveauDeLaSession(moi) {
  if (!moi || typeof moi !== 'object' || moi.connecte !== true) return null;
  const niveau = moi.utilisateur?.niveau;
  return typeof niveau === 'string' && ['observateur', ...NIVEAUX_QUI_COPIENT].includes(niveau) ? niveau : null;
}

/** Le bouton « Copier le prétiré » est-il proposé ? Sur un prétiré enregistré (`fiche.nature`, jamais une fiche de joueur ni une fiche neuve) et à une session Joueur, MJ ou Créateur. */
export const peutCopier = (niveau, fiche) => fiche?.nature === 'pretire' && NIVEAUX_QUI_COPIENT.includes(niveau);

/** L'adresse de la fiche qu'une copie vient de créer, `adresseFiche` étant celle de `/fiche/` ; null sans identifiant. */
export const adresseDeLaCopie = (adresseFiche, copie) => (typeof copie?.id === 'string' && copie.id ? `${adresseFiche}?id=${encodeURIComponent(copie.id)}` : null);

const LIBELLES_DE_NIVEAU = Object.freeze({ observateur: 'Observateur', joueur: 'Joueur', mj: 'MJ', createur: 'Créateur' });

/**
 * La porte du site de dev (403 `acces: 'niveau'`) : le niveau que la porte demande est celui de `niveau_requis` dans la réponse (`serveur/acces.mjs#refus`) ;
 * sans lui, ou d'un niveau inconnu, la phrase ne nomme aucun niveau. Même formule que `lib/personnages-liste.mjs#phraseDeLaPorte` (test/copie-du-pretire.test.mjs).
 */
export function phraseDeLaPorte(corps) {
  const requis = typeof corps?.niveau_requis === 'string' && Object.hasOwn(LIBELLES_DE_NIVEAU, corps.niveau_requis) ? corps.niveau_requis : null;
  if (requis === null) return 'votre niveau ne suffit pas pour cette action sur ce site.';
  return `votre niveau ne suffit pas sur ce site (niveau ${LIBELLES_DE_NIVEAU[requis]}${requis === 'createur' ? '' : ' au moins'} nécessaire).`;
}

// « Nouvelle fiche de joueur » (R322) : `/fiche/?nouvelle=joueur` ouvre le générateur vierge ; la fiche n'existe au compte qu'au premier « Enregistrer »
// (`POST /api/personnages/?nature=joueur`), puis la page bascule sur `?id=<id>` et les enregistrements suivants sont des PUT. Même module que la copie :
// la règle des niveaux est la même (R322 : Joueur, MJ, Créateur) et seul `scripts/fiche.mjs` l'importe.

/** La valeur de `?nouvelle=` qui ouvre une fiche de joueur vierge (R322). */
export const NATURE_NOUVELLE_FICHE = 'joueur';

/** Le mode « nouvelle fiche de joueur » d'après la chaîne de requête de la page : 'joueur', ou null (un `?id=` l'emporte : la fiche existe déjà). */
export function nouvelleFicheDemandee(recherche) {
  const demande = new URLSearchParams(recherche ?? '');
  return !demande.get('id') && demande.get('nouvelle') === NATURE_NOUVELLE_FICHE ? NATURE_NOUVELLE_FICHE : null;
}

/** Le niveau peut-il créer une fiche de joueur (R322) ? Les mêmes que pour copier un prétiré ; `personnages-liste.mjs#peutCreerUneFiche` en a la copie (test/nouvelle-fiche-de-joueur.test.mjs). */
export const peutCreerUneFiche = (niveau) => NIVEAUX_QUI_COPIENT.includes(niveau);

/** L'avis posé à l'ouverture de `?nouvelle=joueur` quand le niveau de la session est connu et ne suffit pas (un Observateur) ; null sinon, et tant que le niveau est inconnu. Le service reste juge. */
export const avisDeNouvelleFiche = (niveau) => (typeof niveau === 'string' && !peutCreerUneFiche(niveau)
  ? 'Seul un compte de niveau Joueur, MJ ou Créateur peut créer une fiche : vous pouvez la remplir et la télécharger, mais pas l’enregistrer.'
  : null);

/**
 * Le mode d'une fiche vierge ouverte par « Nouveau » (R322) : un joueur parti du « + » (mode en cours, ou fiche à l'écran de nature 'joueur' : enregistrée depuis le
 * « + », ouverte par `?id=`) ne crée jamais un prétiré par mégarde ; sinon null (prétiré, comme avant). `mode` : le mode en cours, `ficheAffichee` : la fiche à l'écran.
 */
export const modeDeLaFicheVierge = (mode, ficheAffichee) => (mode === NATURE_NOUVELLE_FICHE || ficheAffichee?.nature === NATURE_NOUVELLE_FICHE ? NATURE_NOUVELLE_FICHE : null);

/** Ce que dit le message après l'import d'un classeur : « Enregistrez pour mettre à jour « X » », ou pour créer la fiche (le prétiré, ou la fiche de joueur en mode R322). */
export const suiteDeLImport = (cible, nom, mode = null) => `Enregistrez pour ${cible === 'creer' ? (mode ? 'créer la fiche' : 'créer le prétiré') : `mettre à jour « ${nom} »`}.`;

/** Le libellé du choix « créer » du dialogue d'import : un nouveau prétiré, ou, en mode fiche de joueur (R322), une nouvelle fiche de joueur. */
export const libelleDuChoixCreer = (mode) => (mode ? 'Créer une nouvelle fiche de joueur' : 'Créer un nouveau prétiré');

/** L'adresse de la page après « Nouveau » : `/fiche/?nouvelle=joueur` dans le mode de fiche de joueur, `/fiche/` sinon (`adresseFiche` : celle de `/fiche/`). */
export const adresseDeLaFicheVierge = (adresseFiche, mode) => (mode ? `${adresseFiche}?nouvelle=${encodeURIComponent(mode)}` : adresseFiche);

/**
 * La requête d'« Enregistrer » : un PUT sur la fiche enregistrée (`id`), sinon un POST de création, qui porte `?nature=joueur` dans le mode « nouvelle fiche de
 * joueur » (`nouvelle`), et rien de plus pour un prétiré. `api` : la racine de l'API (`/api/`).
 */
export function requeteDEnregistrement(api, id, nouvelle = null) {
  if (id) return { methode: 'PUT', adresse: `${api}personnages/${encodeURIComponent(id)}/` };
  return { methode: 'POST', adresse: `${api}personnages/${nouvelle ? `?nature=${encodeURIComponent(nouvelle)}` : ''}` };
}

/**
 * Le message d'un enregistrement refusé par la porte ou par le droit (401, 403) en mode « nouvelle fiche de joueur » : la saisie reste à l'écran, rien n'est
 * créé. `corps` : la réponse JSON (`erreur`, `acces`, `niveau_requis`) ; null pour tout autre statut (les autres refus gardent le message de l'enregistrement).
 */
export function messageDeNouvelleFiche(statut, corps = null) {
  const debut = 'Fiche non créée';
  const fin = 'Votre saisie reste à l’écran : téléchargez la fiche pour ne rien perdre.';
  const service = typeof corps?.erreur === 'string' && corps.erreur ? ` (${corps.erreur})` : '';
  if (statut === 401) return `${debut} : votre session a expiré, reconnectez-vous. ${fin}`;
  if (statut !== 403) return null;
  return corps?.acces === 'niveau'
    ? `${debut} : ${phraseDeLaPorte(corps)} ${fin}`
    : `${debut} : seul un compte de niveau Joueur, MJ ou Créateur peut créer une fiche${service}. ${fin}`;
}

/**
 * Le message d'une copie qui n'a pas abouti. `statut` : le code HTTP (null si le service n'a pas répondu), `corps` : la réponse JSON (`erreur`, `acces`,
 * `niveau_requis`). Dit toujours que rien n'a été copié.
 */
export function messageDeCopie(statut, corps = null) {
  const debut = 'Le prétiré n’a pas été copié';
  const service = typeof corps?.erreur === 'string' && corps.erreur ? ` (${corps.erreur})` : '';
  if (statut === null || statut === undefined) return `${debut} : le service ne répond pas.`;
  if (statut === 401) return `${debut} : votre session a expiré, reconnectez-vous.`;
  if (statut === 403) {
    return corps?.acces === 'niveau'
      ? `${debut} : ${phraseDeLaPorte(corps)}`
      : `${debut} : votre compte n’a pas le droit de faire ce changement${service}.`;
  }
  if (statut === 404) return `${debut} : la fiche n’existe plus.`;
  if (statut === 400) return `${debut} : demande refusée${service}.`;
  return `${debut} : le service a répondu ${statut}${service}.`;
}
