// Le compte du visiteur, côté pages (R310 : connexion par Discord, quatre niveaux d'accès) : ce que le menu, la page /profil/ et la page /connexion/ décident
// à partir de la réponse de `GET /api/moi/` (serveur/discord.mjs, docs/serveur.md « Connexion par Discord »). Module pur, sans navigateur ni Astro ;
// seul `scripts/compte.mjs` l'importe (skill site-version-portable : jamais deux scripts de page sur le même module). `scripts/acces.mjs` n'importe rien :
// il recopie la table des libellés de niveau, et `test/compte.test.mjs` vérifie l'accord.

/** Les quatre niveaux d'accès (R310 (2)) et leur libellé d'affichage (libellés du propriétaire : Observateur, Joueur, MJ, Créateur). */
export const LIBELLES_DES_NIVEAUX = Object.freeze({ observateur: 'Observateur', joueur: 'Joueur', mj: 'MJ', createur: 'Créateur' });

/** Le libellé d'un niveau, ou null s'il est inconnu. */
export function libelleDuNiveau(niveau) {
  return typeof niveau === 'string' && Object.hasOwn(LIBELLES_DES_NIVEAUX, niveau) ? LIBELLES_DES_NIVEAUX[niveau] : null;
}

/**
 * Un chemin où revenir après la connexion : un chemin du site seulement, sinon null. Même règle que le service (serveur/discord.mjs#retourValide) :
 * « / » au début, jamais « // », ni antislash, ni caractère de contrôle, ni autre origine ; 500 caractères au plus ; rendu normalisé, encodé, sans ancre.
 * @param {unknown} retour
 * @returns {string|null}
 */
export function retourValide(retour) {
  if (typeof retour !== 'string' || !retour || retour.length > 500) return null;
  if (!retour.startsWith('/') || retour.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(retour)) return null;
  try {
    const u = new URL(retour, 'https://exemple.invalid');
    if (u.origin !== 'https://exemple.invalid') return null;
    // comme le service : le chemin normalisé et encodé, sans l'ancre ; « /.//hote » devient « //hote » : refusé
    const sur = `${u.pathname}${u.search}`;
    return sur.startsWith('/') && !sur.startsWith('//') ? sur : null;
  } catch {
    return null;
  }
}

const avecSlash = (chemin) => String(chemin).replace(/\/?$/, '/');

/**
 * Où revenir après la connexion depuis la page courante. Sur la page de connexion elle-même, le `retour` qu'elle a reçu (jamais elle-même : on ne
 * reste pas sur la page de connexion), sinon rien ; ailleurs, la page courante avec sa recherche.
 * @param {{ chemin: string, recherche?: string, pageConnexion: string }} page
 * @returns {string|null}
 */
export function retourDeLaPage({ chemin, recherche = '', pageConnexion }) {
  if (avecSlash(chemin) === avecSlash(pageConnexion)) {
    const retour = new URLSearchParams(recherche).get('retour');
    const valide = retourValide(retour);
    return valide && avecSlash(valide.split(/[?#]/)[0]) !== avecSlash(pageConnexion) ? valide : null;
  }
  return retourValide(`${chemin}${recherche}`);
}

/** L'adresse qui lance la connexion (le service répond par un 302 vers Discord), avec `retour` quand il est valide. */
export function adresseDeConnexion(api, retour) {
  const valide = retourValide(retour);
  return `${api}connexion/discord/${valide ? `?retour=${encodeURIComponent(valide)}` : ''}`;
}

/** Une image d'avatar ou de bannière : seulement une adresse https de `cdn.discordapp.com` (R310 (5) : chargée depuis Discord par le navigateur), sinon null. */
export function adresseDImage(valeur) {
  if (typeof valeur !== 'string' || !valeur) return null;
  try {
    const u = new URL(valeur);
    return u.protocol === 'https:' && u.hostname === 'cdn.discordapp.com' && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

/** Une date (ISO 8601) en français, « 5 mars 2024 » (jour de Paris) ; null si elle est absente ou illisible. */
export function dateFrancaise(valeur) {
  if (typeof valeur !== 'string' || !valeur) return null;
  const t = Date.parse(valeur);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : null;
}

const texteNonVide = (v) => (typeof v === 'string' && v.trim() ? v : null);

/**
 * L'utilisateur d'une réponse de `GET /api/moi/` prêt à l'affichage, ou null s'il n'est pas lisible.
 * @returns {{ nom: string, niveau: string|null, avatar: string|null, banniere: string|null, arrivee: string|null }|null}
 */
export function profilAAfficher(utilisateur) {
  if (!utilisateur || typeof utilisateur !== 'object') return null;
  const nom = texteNonVide(utilisateur.nom);
  if (!nom) return null;
  return {
    nom,
    niveau: libelleDuNiveau(utilisateur.niveau),
    avatar: adresseDImage(utilisateur.avatar_url),
    banniere: adresseDImage(utilisateur.banniere_url),
    arrivee: dateFrancaise(utilisateur.serveur_rejoint_le),
  };
}

/**
 * L'état du compte d'après `GET /api/moi/` : 'indisponible' (la requête a échoué ou la connexion n'est pas réglée : rien à montrer, pas de bouton mort),
 * 'connecte' ou 'deconnecte'.
 * @returns {'indisponible'|'connecte'|'deconnecte'}
 */
export function etatDuCompte(moi) {
  if (!moi || typeof moi !== 'object' || moi.connexion_disponible !== true) return 'indisponible';
  return moi.connecte === true && profilAAfficher(moi.utilisateur) ? 'connecte' : 'deconnecte';
}

/**
 * Ce que le menu montre à droite de l'en-tête (R310 (7)) : le compte (avatar et nom, lien vers le profil), ou le bouton de connexion, ou rien. Rien aussi
 * sur la page de connexion, qui porte elle-même son bouton.
 * @param {unknown} moi la réponse de `GET /api/moi/` (null si la requête a échoué)
 * @param {{ api: string, pageProfil: string, pageConnexion: string, chemin: string, recherche?: string }} lieu
 * @returns {{ type: 'rien' } | { type: 'compte', nom: string, avatar: string|null, href: string } | { type: 'connexion', href: string }}
 */
export function choixDuMenu(moi, { api, pageProfil, pageConnexion, chemin, recherche = '' }) {
  const etat = etatDuCompte(moi);
  if (etat === 'indisponible') return { type: 'rien' };
  if (avecSlash(chemin) === avecSlash(pageConnexion)) return { type: 'rien' };
  if (etat === 'connecte') {
    const { nom, avatar } = profilAAfficher(moi.utilisateur);
    return { type: 'compte', nom, avatar, href: pageProfil };
  }
  return { type: 'connexion', href: adresseDeConnexion(api, retourDeLaPage({ chemin, recherche, pageConnexion })) };
}

/** Les messages de la page de connexion selon `?erreur=` (codes du service : docs/serveur.md « Connexion par Discord » ; `niveau` : la porte du site de dev). */
export const MESSAGES_DES_ERREURS = Object.freeze({
  refus: 'La connexion a été refusée ou a expiré. Vous pouvez recommencer.',
  indisponible: 'La connexion par Discord n’est pas disponible pour le moment.',
  discord: 'Discord n’a pas répondu comme prévu. Réessayez dans un instant.',
  etat: 'La connexion n’a pas pu être vérifiée (la demande est périmée ou inconnue). Recommencez.',
  niveau: `Votre niveau d’accès ne suffit pas pour ce site : il faut au moins le niveau ${LIBELLES_DES_NIVEAUX.mj}.`,
});

/** Le message d'un code d'erreur de la page de connexion, ou null (code absent ou inconnu : aucun message). */
export function messageDErreur(code) {
  return typeof code === 'string' && Object.hasOwn(MESSAGES_DES_ERREURS, code) ? MESSAGES_DES_ERREURS[code] : null;
}
