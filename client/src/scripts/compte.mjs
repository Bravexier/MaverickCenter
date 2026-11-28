// Le compte du visiteur dans les pages (R310 : « Dans le menu en haut à droite je veux un lien vers le profil. Si non connecté, le bouton "connexion via
// Discord". ») : UN seul script, posé par layouts/Base.astro (components/Compte.astro), qui demande UNE fois `GET /api/moi/` (docs/serveur.md « Connexion
// par Discord ») et en tire trois choses selon ce que la page porte :
//   - le menu (`[data-compte]`, à droite de l'en-tête) : connecté, l'avatar et le pseudo, qui ouvrent le menu du profil (R319 (1) : Mon profil, Se déconnecter…) ; sinon le
//     bouton « Connexion via Discord » à côté du petit menu (Glossaire, Recherche) ; la requête échoue ou la connexion n'est pas réglée : le petit menu seul, pas de bouton mort ;
//   - la page /profil/ (`[data-profil-page]`) : avatar, bannière, nom, niveau, date d'arrivée sur le serveur, « Se déconnecter » ; ou l'invitation à se connecter ;
//   - la page /connexion/ (`[data-connexion-page]`) : le message du code `?erreur=`, le bouton de connexion qui garde `retour`, et, si l'on est connecté,
//     de quoi se déconnecter (un niveau trop bas n'est pas une impasse).
// Publication de la réponse (contrat avec scripts/personnages.mjs, qui n'a pas le droit de refaire la demande ni de partager un module : skill
// site-version-portable) : `window.maverickMoi` garde la réponse de `GET /api/moi/` (undefined avant son arrivée, null si la demande a échoué), puis
// l'événement `maverick:moi` est émis sur `document` avec la même réponse en `detail`. Un script de page lit la propriété si l'événement a déjà eu lieu,
// sinon il attend l'événement.
// Les niveaux du menu (R319 (3), lot 4) : après cette unique réponse, le niveau du compte (Observateur sans réponse, hors ligne, non connecté ou non-membre) donne le niveau VU,
// qui s'applique aux seuls éléments du menu à `data-niveau-menu` (boutons des rubriques de l'en-tête, entrées du menu latéral, entrées du menu du profil croisées avec leur
// `data-categorie`) : montré quand le niveau vu suffit. Aucun autre élément du document n'est touché (d'autres pages ont leurs `data-niveau` et `data-categorie`) ; les listes et
// titres du menu latéral ne sont pas touchés non plus : le script en ligne de components/MenuDuSite.astro en décide seul. Le build a écrit le menu d'un Observateur (ces éléments `hidden`). « Voir le site en tant que… » : un Créateur choisit un niveau inférieur (`<select>`
// du menu du profil, gardé en localStorage sous `CLE_DU_NIVEAU_VU`, déclaré sur la page Confidentialité) ; l'entrée se lit au niveau réel (`data-niveau-reel`), le bouton du compte
// porte une marque quand un niveau inférieur est vu. Le niveau vu est annoncé : `window.maverickNiveau` et l'événement `maverick:niveau` sur `document` (le script en ligne du menu
// latéral l'écoute, sans module commun). Cela ne change que ce que le menu montre : une page cachée du menu reste servie comme avant (R310 (3), la porte du serveur).
// Les images (avatar, bannière) sont chargées depuis cdn.discordapp.com par le navigateur (R310 (5)), jamais copiées. La logique (choix du menu, `retour`
// filtré, messages, dates) est dans lib/compte.mjs, que ce script est seul à importer (skill site-version-portable). Absent de la version portable (le
// composant n'est pas posé) et de la page de maintenance.
import {
  CLE_DU_NIVEAU_VU, EVENEMENT_DU_NIVEAU, LIBELLES_DES_NIVEAUX, MESSAGE_DU_NON_MEMBRE, adresseDeConnexion, categoriesVisibles, choixDuMenu, etatDuCompte, messageDErreur, niveauDuCompte,
  niveauSuffit, niveauVu, profilAAfficher, retourDeLaPage,
} from '../lib/compte.mjs';

const zone = document.querySelector('[data-compte]');

/** La réponse de `GET /api/moi/`, ou null si la requête échoue (service absent, statut d'erreur, corps illisible). Une seule demande par page. */
async function lireMoi(api) {
  try {
    const r = await fetch(`${api}moi/`, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Le niveau gardé par un Créateur (localStorage) ; null sans stockage ou sans valeur. */
function niveauGarde() {
  try {
    return globalThis.localStorage?.getItem(CLE_DU_NIVEAU_VU) ?? null;
  } catch {
    return null;
  }
}

/** Garde le niveau choisi (`null` : l'oublie : on revoit le niveau réel) ; un stockage absent ou refusé est toléré. */
function garderLeNiveau(niveau) {
  try {
    if (niveau === null) globalThis.localStorage?.removeItem(CLE_DU_NIVEAU_VU);
    else globalThis.localStorage?.setItem(CLE_DU_NIVEAU_VU, niveau);
  } catch {
    // le choix ne survit pas à la page : toléré
  }
}

/**
 * Montre les éléments du menu que `etat` (catégorie) et les niveaux permettent : une entrée du menu du profil, selon sa catégorie ET son niveau (celui de `reel` pour « Voir le site
 * en tant que… », `vu` pour les autres) ; les boutons de rubrique et les entrées du menu latéral à `data-niveau-menu`, selon `vu` ; puis les blocs du menu du profil sans entrée montrée
 * sont cachés. Rien d'autre dans le document.
 */
function appliquerLesNiveaux(etat, { reel, vu }) {
  const visibles = new Set(categoriesVisibles(etat));
  const parNiveau = (e) => niveauSuffit(e.getAttribute('data-niveau-menu'), e.hasAttribute('data-niveau-reel') ? reel : vu);
  for (const e of document.querySelectorAll('.nav-group__toggle[data-niveau-menu], [data-menu-site] [data-niveau-menu]')) e.hidden = !parNiveau(e);
  for (const li of zone.querySelectorAll('[data-categorie]')) li.hidden = !visibles.has(li.getAttribute('data-categorie')) || !parNiveau(li);
  for (const bloc of zone.querySelectorAll('.site-compte__bloc')) bloc.hidden = ![...bloc.querySelectorAll('[data-categorie]')].some((li) => !li.hidden);
}

/** Annonce le niveau vu : propriété `window.maverickNiveau`, puis événement `maverick:niveau` (`detail`) sur `document`. */
function annoncerLeNiveau(vu) {
  globalThis.maverickNiveau = vu;
  document.dispatchEvent(new CustomEvent(EVENEMENT_DU_NIVEAU, { detail: vu }));
}

/** La marque du bouton du compte : le niveau vu quand il est inférieur au niveau réel, sinon rien. */
function marquerLeNiveauVu({ reel, vu }) {
  const marque = zone.querySelector('.site-compte__vue');
  if (!marque) return;
  marque.hidden = vu === reel;
  marque.textContent = LIBELLES_DES_NIVEAUX[vu] ?? '';
  marque.title = vu === reel ? '' : `Menu vu en tant que : ${LIBELLES_DES_NIVEAUX[vu]}`;
}

/** « Voir le site en tant que… » : le choix d'un Créateur s'applique aussitôt, se garde, et se retrouve d'une page à l'autre. */
function brancherLeChoixDuNiveau(etat, niveaux) {
  const choix = zone.querySelector('[data-voir-en-tant-que]');
  if (!choix) return;
  choix.value = niveaux.vu;
  choix.addEventListener('change', () => {
    niveaux.vu = niveauVu(niveaux.reel, choix.value);
    choix.value = niveaux.vu;
    garderLeNiveau(niveaux.vu === niveaux.reel ? null : niveaux.vu);
    appliquerLesNiveaux(etat, niveaux);
    marquerLeNiveauVu(niveaux);
    annoncerLeNiveau(niveaux.vu);
  });
}

/** Publie la réponse de `GET /api/moi/` (ou null) : propriété `window.maverickMoi`, puis événement `maverick:moi` (`detail`) sur `document`. */
function publier(moi) {
  globalThis.maverickMoi = moi;
  document.dispatchEvent(new CustomEvent('maverick:moi', { detail: moi }));
}

function image(src, classe) {
  const img = document.createElement('img');
  img.className = classe;
  img.setAttribute('src', src);
  img.setAttribute('alt', '');
  img.setAttribute('referrerpolicy', 'no-referrer');
  return img;
}

/**
 * Le menu du compte (R310 (7), R319 (1)) : le panneau du menu du profil est déjà dans la zone (components/MenuDuProfil.astro, le public seulement) ; on y montre les
 * entrées que l'état du compte permet (lib/compte.mjs#categoriesVisibles), et les blocs qui en ont. Connecté : l'avatar et le pseudo (un bouton) ouvrent le menu à la place
 * du petit bouton ; sinon le bouton « Connexion via Discord » s'ajoute au petit bouton ; la requête échoue ou la connexion n'est pas réglée : le petit menu seul,
 * pas de bouton mort. Le script en ligne du composant ouvre et ferme le panneau (`[data-profil-ouvrir]`, délégué : ce bouton-ci est créé ici).
 */
function afficherLeMenu(choix, etat, config, niveaux) {
  appliquerLesNiveaux(etat, niveaux);
  zone.setAttribute('data-etat', etat);
  brancherLaDeconnexion(zone, config, (texte) => { const e = zone.querySelector('[data-profil-erreur]'); if (e) { e.textContent = texte; e.hidden = false; } });
  zone.removeAttribute('data-attente');
  const petit = zone.querySelector('.site-compte__petit');
  if (choix.type === 'rien') return;
  if (choix.type === 'compte') {
    const bouton = document.createElement('button');
    bouton.setAttribute('type', 'button');
    bouton.className = 'site-compte__lien';
    bouton.setAttribute('aria-expanded', 'false');
    bouton.setAttribute('aria-controls', 'menu-du-profil');
    bouton.setAttribute('data-profil-ouvrir', '');
    bouton.title = `Menu du profil : ${choix.nom}`;
    const rond = choix.avatar ? image(choix.avatar, 'site-compte__avatar') : document.createElement('span');
    if (!choix.avatar) { rond.className = 'site-compte__avatar site-compte__avatar--vide'; rond.textContent = [...choix.nom][0] ?? ''; }
    rond.setAttribute('width', '32');
    rond.setAttribute('height', '32');
    const nom = document.createElement('span');
    nom.className = 'site-compte__nom';
    nom.textContent = choix.nom;
    const chevron = document.createElement('span');
    chevron.className = 'site-compte__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    const marque = document.createElement('span');
    marque.className = 'site-compte__vue';
    bouton.append(rond, nom, marque, chevron);
    zone.prepend(bouton);
    marquerLeNiveauVu(niveaux);
    if (petit) petit.hidden = true;
  } else {
    const lien = document.createElement('a');
    lien.className = 'site-compte__connexion';
    lien.setAttribute('href', choix.href);
    const icone = document.createElement('span');
    icone.className = 'site-compte__icone';
    icone.setAttribute('aria-hidden', 'true');
    const libelle = document.createElement('span');
    libelle.className = 'site-compte__libelle';
    libelle.textContent = 'Connexion via Discord';
    lien.title = 'Connexion via Discord';
    lien.append(icone, libelle);
    zone.prepend(lien);
  }
}

/** « Se déconnecter » : le service retire le cookie, puis retour à l'accueil. */
function brancherLaDeconnexion(racine, { api, accueil }, dire) {
  for (const bouton of racine.querySelectorAll('[data-deconnexion]')) {
    bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        const r = await fetch(`${api}deconnexion/`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}', credentials: 'same-origin' });
        if (!r.ok) throw new Error(String(r.status));
        location.assign(accueil);
      } catch {
        bouton.disabled = false;
        dire('La déconnexion n’a pas abouti : le service ne répond pas. Réessayez.');
      }
    });
  }
}

function afficherLeProfil(page, moi, config) {
  const montrer = (nom, oui) => { const e = page.querySelector(`[data-profil-${nom}]`); if (e) e.hidden = !oui; return e; };
  montrer('chargement', false);
  const etat = etatDuCompte(moi);
  montrer('connecte', etat === 'connecte');
  montrer('invite', etat === 'deconnecte');
  const nonMembre = montrer('non-membre', etat === 'non_membre');
  if (nonMembre) nonMembre.querySelector('[data-message-non-membre]').textContent = MESSAGE_DU_NON_MEMBRE;
  montrer('indisponible', etat === 'indisponible');
  const lien = page.querySelector('[data-lien-connexion]');
  if (lien) lien.setAttribute('href', adresseDeConnexion(config.api, retourDeLaPage({ chemin: location.pathname, recherche: location.search ?? '', pageConnexion: config.pageConnexion })));
  const dire = (texte) => { const e = montrer('erreur', true); if (e) e.textContent = texte; };
  if (etat === 'non_membre') brancherLaDeconnexion(page, config, dire);
  if (etat !== 'connecte') return;
  const profil = profilAAfficher(moi.utilisateur);
  page.querySelector('[data-profil-nom]').textContent = profil.nom;
  page.querySelector('[data-profil-niveau]').textContent = profil.niveau ?? '';
  const arrivee = page.querySelector('[data-profil-arrivee]');
  arrivee.textContent = profil.arrivee ?? '';
  const ligne = page.querySelector('[data-profil-ligne-arrivee]');
  if (ligne) ligne.hidden = !profil.arrivee;
  const avatar = page.querySelector('[data-profil-avatar]');
  if (profil.avatar) { avatar.setAttribute('src', profil.avatar); avatar.hidden = false; } else avatar.hidden = true;
  const banniere = page.querySelector('[data-profil-banniere]');
  if (profil.banniere) { banniere.querySelector('img').setAttribute('src', profil.banniere); banniere.hidden = false; } else banniere.hidden = true;
  brancherLaDeconnexion(page, config, dire);
}

function afficherLaConnexion(page, moi, config) {
  const code = new URLSearchParams(location.search ?? '').get('erreur');
  const message = messageDErreur(code);
  const erreur = page.querySelector('[data-connexion-erreur]');
  if (erreur && message) { erreur.textContent = message; erreur.hidden = false; }
  const lien = page.querySelector('[data-lien-connexion]');
  const etat = etatDuCompte(moi);
  const nonReglee = moi?.connexion_disponible === false;
  if (lien) {
    lien.setAttribute('href', adresseDeConnexion(config.api, retourDeLaPage({ chemin: location.pathname, recherche: location.search ?? '', pageConnexion: config.pageConnexion })));
    // la connexion n'est pas réglée sur ce serveur : pas de bouton mort
    if (nonReglee) lien.hidden = true;
  }
  const indisponible = page.querySelector('[data-connexion-indisponible]');
  if (indisponible) indisponible.hidden = !nonReglee;
  const nonMembre = page.querySelector('[data-connexion-non-membre]');
  if (nonMembre && etat === 'non_membre') {
    nonMembre.querySelector('[data-message-non-membre]').textContent = MESSAGE_DU_NON_MEMBRE;
    nonMembre.hidden = false;
    brancherLaDeconnexion(page, config, (texte) => { const e = page.querySelector('[data-connexion-erreur]'); if (e) { e.textContent = texte; e.hidden = false; } });
  }
  const connecte = page.querySelector('[data-connexion-connecte]');
  if (connecte && etat === 'connecte') {
    const profil = profilAAfficher(moi.utilisateur);
    page.querySelector('[data-connexion-nom]').textContent = profil.nom;
    page.querySelector('[data-connexion-niveau]').textContent = profil.niveau ?? '';
    connecte.hidden = false;
    brancherLaDeconnexion(page, config, (texte) => { const e = page.querySelector('[data-connexion-erreur]'); if (e) { e.textContent = texte; e.hidden = false; } });
  }
}

async function demarrer() {
  if (!zone) {
    publier(null); // pas de zone de compte : aucune demande, et les scripts de page qui attendent la réponse ne restent pas en suspens
    return;
  }
  const config = {
    api: zone.getAttribute('data-api') || '/api/',
    pageProfil: zone.getAttribute('data-page-profil') || '/profil/',
    pageConnexion: zone.getAttribute('data-page-connexion') || '/connexion/',
    accueil: zone.getAttribute('data-accueil') || '/',
  };
  const moi = await lireMoi(config.api);
  publier(moi);
  const etat = etatDuCompte(moi);
  const reel = niveauDuCompte(moi);
  const niveaux = { reel, vu: niveauVu(reel, niveauGarde()) };
  afficherLeMenu(choixDuMenu(moi, { ...config, chemin: location.pathname, recherche: location.search ?? '' }), etat, config, niveaux);
  brancherLeChoixDuNiveau(etat, niveaux);
  annoncerLeNiveau(niveaux.vu);
  const profil = document.querySelector('[data-profil-page]');
  if (profil) afficherLeProfil(profil, moi, config);
  const connexion = document.querySelector('[data-connexion-page]');
  if (connexion) afficherLaConnexion(connexion, moi, config);
}

/** Terminée quand la page est remplie (les tests l'attendent). */
export const pret = demarrer();
