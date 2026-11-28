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
