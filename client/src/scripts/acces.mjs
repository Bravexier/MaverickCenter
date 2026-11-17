// L'accès au site de dev, côté navigateur : UN mécanisme pour toutes les pages (décision du propriétaire, R275 option b : « Un mot de passe pour modifier
// et pour lancer une mise à jour ; la lecture reste ouverte. » ; serveur/acces.mjs, docs/serveur.md « Accès au site de dev »). Chargé une fois par
// layouts/Base.astro (components/Acces.astro), AVANT les scripts de page : il enveloppe `fetch` pour les adresses du service (`/api/…`).
//   - Une réponse 401 qui porte `acces` (le refus de la porte : 'mot_de_passe' pour une écriture, 'cle' pour une lecture protégée) ouvre une petite
//     fenêtre qui demande le MOT DE PASSE (jamais la clé de lecture, réservée aux programmes), le poste (POST /api/acces/ : le service pose le cookie
//     `maverick_acces`, HttpOnly, que le script ne voit pas), puis REJOUE l'appel refusé. La session dure 12 h côté service : si elle expire, la demande
//     revient d'elle-même.
//   - UNE seule saisie : les appels refusés pendant qu'une fenêtre est ouverte attendent la même fenêtre ; un appel refusé avant la connexion d'un autre
//     (il avait été envoyé sans cookie) est rejoué sans redemander. L'option c (mot de passe pour tout le site) n'a rien à changer ici : même mot de
//     passe, même cookie, même fenêtre.
//   - Annuler (ou Échap) rend à l'appelant sa réponse 401 d'origine : sa page dit son propre refus. Un appel de lecture (GET) refusé de nouveau dans les
//     60 s qui suivent une annulation ne rouvre pas la fenêtre (les relèves de la page Debug la rouvriraient toutes les 2 s) ; une écriture, toujours
//     faite à la main, la rouvre.
//   - Ne passent jamais par la demande : `/api/acces/…` (la connexion elle-même), `/api/metriques/…` (la balise) et la lecture de `/api/maintenance/`
//     (la relève de chaque page, toutes les 30 s) : aucun n'est écrit par un visiteur.
//   - Un lien de téléchargement du service (`<a download href="…/api/…">` : le journal de l'édition, les exports de la page Debug) devient un appel
//     `fetch` (donc avec la demande si besoin) puis un enregistrement du fichier : une navigation sans session téléchargerait le texte du refus.
//     Seulement quand le serveur est connu comme protégé (un refus déjà vu, une connexion, ou GET /api/acces/ au premier clic) : sans mot de passe posé ni en
//     production, le lien suit son cours natif.
//   - Sans mot de passe posé sur le serveur, ou sans refus, rien n'est ajouté à l'écran. Une fois connecté, une mention discrète du pied de page
//     (« Connecté · Se déconnecter ») ; elle revient sur les pages suivantes de la visite (sessionStorage, vérifiée par GET /api/acces/).
// Ce script n'importe rien : aucun module partagé entre pages (skill site-version-portable, tools/build-artifact.mjs ; la version portable n'a pas de
// service et ne le charge pas).

const CLE_DE_LA_VISITE = 'maverick-acces';
const SILENCE_APRES_ANNULATION_MS = 60000;

const originale = globalThis.fetch.bind(globalThis);
const meta = document.querySelector('meta[name="maverick-api"]');
const API = meta?.getAttribute('content') || '/api/';
const ADRESSE_ACCES = `${API}acces/`;

let epoque = 0; // augmente à chaque connexion réussie : un appel envoyé avant elle se rejoue sans redemander
let saisie = null; // la saisie en cours (Promise<boolean>), partagée par tous les appels refusés
let annuleLe = -Infinity;
let protege = null; // le serveur demande-t-il un mot de passe ? null : pas encore su (appris d'un refus, d'une connexion ou de GET /api/acces/)
let contourne = null; // le lien de téléchargement que l'on laisse suivre son cours natif (serveur non protégé)

function memoire() {
  try { return globalThis.sessionStorage ?? null; } catch { return null; }
}

/** Les parties de l'adresse d'un appel qui nous intéressent, ou null s'il ne vise pas le service de cette origine. */
function viseLeService(entree, init) {
  let adresse;
  try { adresse = new URL(typeof entree === 'string' || entree instanceof URL ? String(entree) : entree.url, location.href); } catch { return null; }
  if (adresse.origin !== new URL(location.href).origin) return null;
  const base = new URL(API, location.href).pathname;
  if (!adresse.pathname.startsWith(base)) return null;
  const reste = adresse.pathname.slice(base.length);
  const methode = String(init?.method ?? (typeof entree === 'object' ? entree.method : undefined) ?? 'GET').toUpperCase();
  return { reste, methode };
}

/** Faut-il, sur un refus, demander le mot de passe ? (Pas pour la connexion, la balise des pages, ni la relève de la maintenance.) */
function peutDemander({ reste, methode }) {
  if (reste.startsWith('acces/') || reste.startsWith('metriques/')) return false;
  if (methode === 'GET' && reste === 'maintenance/') return false;
  return true;
}

// --- La fenêtre ---------------------------------------------------------------------------------------------------------------------------------

/** Une seule fenêtre à la fois : l'appelant reçoit la même promesse (true : connecté ; false : annulé). */
function demander(refus) {
  saisie ??= ouvrirLaFenetre(refus).finally(() => { saisie = null; });
  return saisie;
}

function ouvrirLaFenetre(refus) {
  return new Promise((resoudre) => {
    const expiree = Boolean(memoire()?.getItem(CLE_DE_LA_VISITE));
    const dialogue = document.createElement('dialog');
    dialogue.className = 'acces-dialogue';
    dialogue.setAttribute('aria-labelledby', 'acces-titre');
    const form = document.createElement('form');
    form.method = 'dialog';
    const titre = document.createElement('h2');
    titre.id = 'acces-titre';
    titre.textContent = 'Mot de passe du site de dev';
    const aide = document.createElement('p');
    aide.className = 'acces-aide';
    aide.id = 'acces-aide';
    aide.textContent = (expiree ? 'Votre session a expiré. ' : '')
      + (refus?.acces === 'cle' ? 'Ces informations sont protégées. ' : 'Cette action est protégée. ')
      + 'Le mot de passe n’est demandé qu’une fois pour la visite ; la lecture des pages reste libre.';
    const label = document.createElement('label');
    label.textContent = 'Mot de passe';
    const champ = document.createElement('input');
    champ.name = 'mot_de_passe';
    champ.setAttribute('type', 'password');
    champ.setAttribute('autocomplete', 'current-password');
    champ.setAttribute('aria-describedby', 'acces-aide acces-erreur');
    champ.required = true;
    label.append(champ);
    const erreur = document.createElement('p');
    erreur.className = 'acces-erreur';
    erreur.id = 'acces-erreur';
    erreur.setAttribute('role', 'alert');
    erreur.hidden = true;
    const boutons = document.createElement('div');
    boutons.className = 'acces-boutons';
    const annuler = document.createElement('button');
    annuler.setAttribute('type', 'button');
    annuler.className = 'acces-annuler';
    annuler.textContent = 'Annuler';
    const envoyer = document.createElement('button');
    envoyer.setAttribute('type', 'submit');
    envoyer.className = 'acces-envoyer';
    envoyer.textContent = 'Se connecter';
    boutons.append(annuler, envoyer);
    form.append(titre, aide, label, erreur, boutons);
    dialogue.append(form);
    document.body.append(dialogue);

    let fini = false;
    const terminer = (connecte) => {
      if (fini) return;
      fini = true;
      if (!connecte) annuleLe = Date.now();
      dialogue.close();
      dialogue.remove();
      resoudre(connecte);
    };
    annuler.addEventListener('click', () => terminer(false));
    // Échap (évènement « cancel » du <dialog>) ou fermeture par un autre moyen : annulé
    dialogue.addEventListener('cancel', () => terminer(false));
    dialogue.addEventListener('close', () => terminer(false));
    const dire = (texte) => { erreur.textContent = texte; erreur.hidden = false; };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (fini || envoyer.disabled) return;
      envoyer.disabled = true;
      erreur.hidden = true;
      try {
        const r = await originale(ADRESSE_ACCES, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ mot_de_passe: champ.value }),
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const corps = await r.json().catch(() => null);
        if (r.ok) {
          epoque += 1;
          protege = true;
          memoire()?.setItem(CLE_DE_LA_VISITE, '1');
          montrerLEtat();
          terminer(true);
          return;
        }
        if (r.status === 401) dire('Mot de passe incorrect.');
        else if (r.status === 429) dire(messageDAttente(corps?.attente_s ?? Number(r.headers?.get?.('Retry-After'))));
        else if (r.status === 409) dire('Aucun mot de passe n’est posé sur ce serveur.');
        else dire(corps?.erreur ?? `Connexion impossible (le service a répondu ${r.status}).`);
        champ.value = '';
        champ.focus();
      } catch {
        dire('Le service ne répond pas.');
      } finally {
        envoyer.disabled = false;
      }
    });
    dialogue.showModal();
    champ.focus();
  });
}

/** « Trop d’essais : réessayez dans 2 min. » (la durée en secondes vient du service). */
export function messageDAttente(secondes) {
  const s = Math.ceil(Number(secondes));
  if (!Number.isFinite(s) || s <= 0) return 'Trop d’essais : réessayez dans un instant.';
  return `Trop d’essais : réessayez dans ${s >= 90 ? `${Math.ceil(s / 60)} min` : `${s} s`}.`;
}

// --- fetch enveloppé ----------------------------------------------------------------------------------------------------------------------------

async function lireLeRefus(reponse) {
  const corps = await reponse.clone().json().catch(() => null);
  return corps && typeof corps === 'object' && typeof corps.acces === 'string' ? corps : null;
}

globalThis.fetch = async function fetchAvecAcces(entree, init) {
  const cible = viseLeService(entree, init);
  if (!cible || !peutDemander(cible)) return originale(entree, init);
  const copie = typeof Request === 'function' && entree instanceof Request ? entree.clone() : null; // un corps ne se relit pas
  const avant = epoque;
  const reponse = await originale(entree, init);
  if (reponse.status !== 401) return reponse;
  const refus = await lireLeRefus(reponse);
  if (!refus) return reponse;
  protege = true;
  if (epoque === avant) {
    if (cible.methode === 'GET' && Date.now() - annuleLe < SILENCE_APRES_ANNULATION_MS) return reponse;
    if (!(await demander(refus))) return reponse;
  }
  return originale(copie ?? entree, init);
};

// --- Mention « connecté » -----------------------------------------------------------------------------------------------------------------------

function montrerLEtat() {
  if (document.querySelector('.acces-etat')) return;
  const bouton = document.createElement('button');
  bouton.setAttribute('type', 'button');
  bouton.className = 'acces-etat';
  bouton.textContent = 'Connecté · Se déconnecter';
  bouton.title = 'Fermer la session du mot de passe sur ce navigateur';
  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    try {
      await originale(ADRESSE_ACCES, { method: 'DELETE', headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
    } catch { /* le service ne répond pas : la session expirera d'elle-même */ }
    memoire()?.removeItem(CLE_DE_LA_VISITE);
    bouton.remove();
  });
  const pied = document.querySelector('.site-footer');
  const version = pied?.querySelector('.site-footer__version');
  if (version) pied.insertBefore(bouton, version);
  else (pied ?? document.body).append(bouton);
}

// la visite a déjà une session : la mention revient (confirmée par le service ; une session expirée ou fermée l'efface)
if (memoire()?.getItem(CLE_DE_LA_VISITE)) {
  originale(ADRESSE_ACCES, { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((etat) => {
      if (etat) protege = etat.protege === true;
      if (etat?.protege && etat.droit === 'ecriture') montrerLEtat();
      else memoire()?.removeItem(CLE_DE_LA_VISITE);
    })
    .catch(() => {});
}

// --- Téléchargements du service -----------------------------------------------------------------------------------------------------------------

/** Le nom du fichier de l'en-tête Content-Disposition (filename*= puis filename=), sinon `repli`. */
export function nomDuFichier(entete, repli) {
  const etendu = /filename\*=UTF-8''([^;]+)/i.exec(entete ?? '');
  if (etendu) { try { return decodeURIComponent(etendu[1].trim()); } catch { /* repli ci-dessous */ } }
  const simple = /filename="?([^";]+)"?/i.exec(entete ?? '');
  return simple ? simple[1].trim() : repli;
}

/** Le serveur est-il protégé ? Appris au premier besoin (un téléchargement), jamais au chargement : sans réponse du service, non. */
async function serveurProtege() {
  if (protege !== null) return protege;
  try {
    const r = await originale(ADRESSE_ACCES, { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
    const etat = r.ok ? await r.json().catch(() => null) : null;
    protege = etat?.protege === true;
    return protege;
  } catch {
    return false;
  }
}

document.addEventListener('click', async (e) => {
  if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const lien = e.target?.closest?.('a[download][href]');
  if (!lien || lien === contourne) return;
  const cible = viseLeService(lien.href, { method: 'GET' });
  if (!cible || !peutDemander(cible)) return;
  // sans mot de passe posé (ou en production), le lien garde son cours natif, comme avant
  if (protege === false) return;
  e.preventDefault();
  if (protege === null && !(await serveurProtege())) {
    contourne = lien;
    lien.click();
    contourne = null;
    return;
  }
  try {
    const r = await fetch(lien.href, { cache: 'no-store', credentials: 'same-origin' });
    if (r.status === 401) return; // mot de passe annulé : rien à dire de plus
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.setAttribute('download', nomDuFichier(r.headers.get('Content-Disposition'), lien.getAttribute('download') || cible.reste.split('/').filter(Boolean).pop() || 'fichier'));
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch {
    alert('Téléchargement impossible : le service ne répond pas.');
  }
});
