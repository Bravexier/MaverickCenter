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
 * 'connecte', 'non_membre' (R313 (1) : une session sans compte, la personne n'est pas membre du serveur Discord ; le service ne garde rien d'elle, `non_membre`
 * n'existe que s'il vaut `true`) ou 'deconnecte'.
 * @returns {'indisponible'|'connecte'|'non_membre'|'deconnecte'}
 */
export function etatDuCompte(moi) {
  if (!moi || typeof moi !== 'object' || moi.connexion_disponible !== true) return 'indisponible';
  if (moi.connecte === true && profilAAfficher(moi.utilisateur)) return 'connecte';
  return moi.non_membre === true ? 'non_membre' : 'deconnecte';
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

/** Ce que dit la page à une personne connectée qui n'est pas membre du serveur Discord du jeu (R313 (1)) : aucun niveau, rien de gardé. */
export const MESSAGE_DU_NON_MEMBRE = 'Vous êtes connecté, mais vous n’êtes pas membre du serveur Discord : aucun niveau n’est donné.';

/** Le message d'un code d'erreur de la page de connexion, ou null (code absent ou inconnu : aucun message). */
export function messageDErreur(code) {
  return typeof code === 'string' && Object.hasOwn(MESSAGES_DES_ERREURS, code) ? MESSAGES_DES_ERREURS[code] : null;
}

/**
 * Ce qu'une entrée du menu du profil demande (lib/nav.mjs#MENU_DU_PROFIL, R319 (1)) : 'public' (Glossaire, Recherche : tout visiteur) ou 'connecte' (tout le reste : Mon
 * profil, les espaces, Site de dev, Voir le site en tant que…, Se déconnecter). Un compte connecté, membre ou non, a la catégorie 'connecte' ; le niveau d'une entrée (`niveau`,
 * R319 (3)) se lit à part (niveauSuffit : lot 4), et « Se déconnecter » vaut pour tout compte connecté (la page /profil/ dit au non-membre qu'il n'a aucun niveau).
 * @returns {'public'|'connecte'}
 */
export function categorieDeLEntreeDuProfil(entree) {
  return entree?.action || entree?.niveau || entree?.prodSeulement || entree?.externe || entree?.connecte ? 'connecte' : 'public';
}

/** Les catégories d'entrées du menu du profil que montre un état du compte (etatDuCompte) : un compte connecté (membre ou non-membre), les deux ; sinon le public. */
export function categoriesVisibles(etat) {
  return etat === 'connecte' || etat === 'non_membre' ? ['public', 'connecte'] : ['public'];
}

// --- Les niveaux d'accès appliqués au menu (R319 (3), lot 4) -----------------------------------------------------------------------------------------------
// Masquer un lien du menu ne protège pas la page : l'accès aux pages et au service reste celui du serveur (R310 (3)). Le niveau ne change que ce que le menu montre.

/** Les quatre niveaux, du plus bas au plus haut (R310 (2)) : Créateur ⊃ MJ ⊃ Joueur ⊃ Observateur. `lib/nav.mjs#NIVEAUX_DU_MENU` en est la suite sans Observateur (`test/compte.test.mjs`). */
export const ORDRE_DES_NIVEAUX = Object.freeze(['observateur', 'joueur', 'mj', 'createur']);

/** La clé du stockage local où un Créateur garde le niveau sous lequel il voit le menu (« Voir le site en tant que… »), déclarée sur la page Confidentialité. */
export const CLE_DU_NIVEAU_VU = 'menu-du-profil:niveau-vu';

/** Le nom de l'événement par lequel scripts/compte.mjs annonce à la page le niveau sous lequel le menu est vu (`detail` : ce niveau) ; le script du menu latéral l'écoute. */
export const EVENEMENT_DU_NIVEAU = 'maverick:niveau';

const rangDuNiveau = (niveau) => (typeof niveau === 'string' ? ORDRE_DES_NIVEAUX.indexOf(niveau) : -1);

/**
 * Le niveau réel du visiteur d'après `GET /api/moi/` : celui du compte connecté ; Observateur sans réponse, hors ligne, non connecté, non-membre (R313 (1)), banni ou
 * niveau inconnu.
 * @returns {'observateur'|'joueur'|'mj'|'createur'}
 */
export function niveauDuCompte(moi) {
  if (etatDuCompte(moi) !== 'connecte') return 'observateur';
  const niveau = moi.utilisateur.niveau;
  return rangDuNiveau(niveau) >= 0 ? niveau : 'observateur';
}

/**
 * Un lecteur de niveau `niveau` voit-il ce qui demande `requis` ? Rien de demandé (absent, null, vide) : oui ; un niveau demandé inconnu : non (on n'ouvre pas sur une
 * faute de frappe) ; un lecteur de niveau inconnu est un Observateur. Accès cumulatif : un niveau voit tout ce que voient les niveaux au-dessous.
 */
export function niveauSuffit(requis, niveau) {
  if (requis === undefined || requis === null || requis === '') return true;
  const demande = rangDuNiveau(requis);
  if (demande < 0) return false;
  return Math.max(rangDuNiveau(niveau), 0) >= demande;
}

/** Les niveaux sous lesquels un compte de niveau réel `reel` peut voir le menu, du plus haut au plus bas, le sien compris : seul un Créateur en choisit un (« Voir le site en tant que… »). */
export function niveauxProposes(reel) {
  return reel === 'createur' ? [...ORDRE_DES_NIVEAUX].reverse() : [];
}

/**
 * Le niveau sous lequel le menu est vu : le choix gardé (`choix`) quand le compte est Créateur et que ce niveau est connu et strictement plus bas que le sien, sinon le
 * niveau réel (un choix périmé ou inventé ne donne jamais plus que le niveau réel, ni quoi que ce soit à un autre qu'un Créateur).
 */
export function niveauVu(reel, choix) {
  if (reel !== 'createur') return reel;
  const rang = rangDuNiveau(choix);
  return rang >= 0 && rang < rangDuNiveau(reel) ? choix : reel;
}
