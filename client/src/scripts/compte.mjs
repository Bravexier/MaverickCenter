// Le compte du visiteur dans les pages (R310 : « Dans le menu en haut à droite je veux un lien vers le profil. Si non connecté, le bouton "connexion via
// Discord". ») : UN seul script, posé par layouts/Base.astro (components/Compte.astro), qui demande UNE fois `GET /api/moi/` (docs/serveur.md « Connexion
// par Discord ») et en tire trois choses selon ce que la page porte :
//   - le menu (`[data-compte]`, à droite de l'en-tête) : connecté, l'avatar et le nom (lien vers /profil/) ; sinon le bouton « Connexion via Discord » ;
//     la requête échoue ou la connexion n'est pas réglée : rien, pas de bouton mort ;
//   - la page /profil/ (`[data-profil-page]`) : avatar, bannière, nom, niveau, date d'arrivée sur le serveur, « Se déconnecter » ; ou l'invitation à se connecter ;
//   - la page /connexion/ (`[data-connexion-page]`) : le message du code `?erreur=`, le bouton de connexion qui garde `retour`, et, si l'on est connecté,
//     de quoi se déconnecter (un niveau trop bas n'est pas une impasse).
// Les images (avatar, bannière) sont chargées depuis cdn.discordapp.com par le navigateur (R310 (5)), jamais copiées. La logique (choix du menu, `retour`
// filtré, messages, dates) est dans lib/compte.mjs, que ce script est seul à importer (skill site-version-portable). Absent de la version portable (le
// composant n'est pas posé) et de la page de maintenance.
import { adresseDeConnexion, choixDuMenu, etatDuCompte, messageDErreur, profilAAfficher, retourDeLaPage } from '../lib/compte.mjs';

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

function image(src, classe) {
  const img = document.createElement('img');
  img.className = classe;
  img.setAttribute('src', src);
  img.setAttribute('alt', '');
  img.setAttribute('referrerpolicy', 'no-referrer');
  return img;
}

function afficherLeMenu(choix) {
  if (choix.type === 'rien') return;
  const lien = document.createElement('a');
  if (choix.type === 'compte') {
    lien.className = 'site-compte__lien';
    lien.setAttribute('href', choix.href);
    lien.title = 'Mon profil';
    const rond = choix.avatar ? image(choix.avatar, 'site-compte__avatar') : document.createElement('span');
    if (!choix.avatar) { rond.className = 'site-compte__avatar site-compte__avatar--vide'; rond.textContent = [...choix.nom][0] ?? ''; }
    rond.setAttribute('width', '32');
    rond.setAttribute('height', '32');
    const nom = document.createElement('span');
    nom.className = 'site-compte__nom';
    nom.textContent = choix.nom;
    lien.append(rond, nom);
  } else {
    lien.className = 'site-compte__connexion';
    lien.setAttribute('href', choix.href);
    lien.textContent = 'Connexion via Discord';
  }
  zone.append(lien);
  zone.hidden = false;
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
  montrer('indisponible', etat === 'indisponible');
  const lien = page.querySelector('[data-lien-connexion]');
  if (lien) lien.setAttribute('href', adresseDeConnexion(config.api, retourDeLaPage({ chemin: location.pathname, recherche: location.search ?? '', pageConnexion: config.pageConnexion })));
  const dire = (texte) => { const e = montrer('erreur', true); if (e) e.textContent = texte; };
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
  if (!zone) return;
  const config = {
    api: zone.getAttribute('data-api') || '/api/',
    pageProfil: zone.getAttribute('data-page-profil') || '/profil/',
    pageConnexion: zone.getAttribute('data-page-connexion') || '/connexion/',
    accueil: zone.getAttribute('data-accueil') || '/',
  };
  const moi = await lireMoi(config.api);
  afficherLeMenu(choixDuMenu(moi, { ...config, chemin: location.pathname, recherche: location.search ?? '' }));
  const profil = document.querySelector('[data-profil-page]');
  if (profil) afficherLeProfil(profil, moi, config);
  const connexion = document.querySelector('[data-connexion-page]');
  if (connexion) afficherLaConnexion(connexion, moi, config);
}

/** Terminée quand la page est remplie (les tests l'attendent). */
export const pret = demarrer();
