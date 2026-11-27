// L'accès au site de dev, côté navigateur : UN mécanisme pour toutes les pages (R310 : la connexion par Discord remplace le mot de passe de R275 ;
// serveur/acces.mjs, docs/serveur.md « Accès au site de dev »). Chargé une fois par layouts/Base.astro (components/Acces.astro), AVANT les scripts de page :
// il enveloppe `fetch` pour les adresses du service (`/api/…`) et rend toujours sa réponse d'origine.
//   - Une réponse 401 qui porte `acces: 'connexion'` (ni session ni clé : la session de 12 h du site de dev a expiré, ou l'on n'est pas connecté) affiche un
//     avis qui PROPOSE de se connecter : un lien vers `/connexion/?retour=<la page>` (jamais d'envoi automatique : la page peut porter un travail en cours).
//   - Une réponse 403 qui porte `acces: 'niveau'` (session de niveau trop bas : `niveau`, `niveau_requis`) le dit : « Votre niveau (Joueur) ne suffit pas :
//     cette action demande le niveau Créateur. ». Les refus de clé (`cle`, `cle_de_depot`) ne regardent que les programmes : rien à l'écran.
//   - Sans boucle ni rafale : sur la page de connexion elle-même, rien (on y est) ; un seul avis à la fois (un refus de plus le met à jour) ; l'avis fermé, un appel
//     de lecture (GET) refusé de nouveau dans les 60 s qui suivent ne le rouvre pas (la relève de la page Debug se ferait refuser toutes les 2 s) ; une écriture,
//     toujours faite à la main, le rouvre.
//   - Ne passent jamais par l'avis : `/api/acces/…`, `/api/moi/`, `/api/connexion/…`, `/api/deconnexion/` (la connexion elle-même : scripts/compte.mjs),
//     `/api/metriques/…` (la balise) et la lecture de `/api/maintenance/` (la relève de chaque page, toutes les 30 s).
//   - Un lien de téléchargement du service (`<a download href="…/api/…">` : le journal de l'édition, les exports de la page Debug) devient un appel `fetch`
//     (donc avec l'avis si besoin) puis un enregistrement du fichier : une navigation sans session téléchargerait le texte du refus. Seulement quand le serveur
//     est connu comme protégé (un refus déjà vu, ou GET /api/acces/ au premier clic) : en production, le lien suit son cours natif.
// Ce script n'importe rien : aucun module partagé entre pages (skill site-version-portable, tools/build-artifact.mjs ; la version portable n'a pas de
// service et ne le charge pas). Il recopie donc la table des libellés de niveau de lib/compte.mjs (`test/acces-navigateur.test.mjs` vérifie l'accord).

const SILENCE_APRES_FERMETURE_MS = 60000;
/** Les niveaux d'accès et leurs libellés (copie de lib/compte.mjs#LIBELLES_DES_NIVEAUX). */
const NIVEAUX = { observateur: 'Observateur', joueur: 'Joueur', mj: 'MJ', createur: 'Créateur' };

const originale = globalThis.fetch.bind(globalThis);
const meta = (nom) => document.querySelector(`meta[name="${nom}"]`)?.getAttribute('content');
const API = meta('maverick-api') || '/api/';
const PAGE_DE_CONNEXION = meta('maverick-connexion') || '/connexion/';
const ADRESSE_ACCES = `${API}acces/`;

let ferme = -Infinity; // l'instant de la dernière fermeture de l'avis
let avis = null; // l'avis affiché (élément) ou null
let protege = null; // le serveur est-il fermé par une connexion ? null : pas encore su (appris d'un refus ou de GET /api/acces/)
let contourne = null; // le lien de téléchargement que l'on laisse suivre son cours natif (serveur non protégé)

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

/** Un refus de la porte doit-il être dit ? (Pas pour la connexion, la balise des pages, ni la relève de la maintenance.) */
function peutDire({ reste, methode }) {
  if (['acces/', 'moi/', 'connexion/', 'deconnexion/', 'metriques/'].some((debut) => reste.startsWith(debut))) return false;
  if (methode === 'GET' && reste === 'maintenance/') return false;
  return true;
}

/** Sommes-nous sur la page de connexion ? (Un refus n'y propose pas de se connecter : on y est.) */
const surLaPageDeConnexion = () => new URL(location.href).pathname.replace(/\/?$/, '/') === new URL(PAGE_DE_CONNEXION, location.href).pathname.replace(/\/?$/, '/');

/** Le chemin où revenir : la page courante, filtré comme le service le fait (chemin du site seulement : jamais « // », antislash ni caractère de contrôle). */
function retourDeLaPage() {
  const u = new URL(location.href);
  const chemin = `${u.pathname}${u.search}`;
  return chemin.startsWith('/') && !chemin.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(chemin) && chemin.length <= 500 ? chemin : null;
}

/** L'adresse de la page de connexion, qui garde la page courante pour y revenir. */
export function adresseDeLaConnexion(page = PAGE_DE_CONNEXION, retour = retourDeLaPage()) {
  return `${page}${retour ? `?retour=${encodeURIComponent(retour)}` : ''}`;
}

/** Ce que dit l'avis pour un refus de la porte : { texte, connexion } (`connexion` : proposer le lien), ou null quand il n'y a rien à dire. */
export function texteDuRefus(refus) {
  if (refus?.acces === 'connexion') return { texte: 'Cette page demande une connexion : votre session a expiré, ou vous n’êtes pas connecté.', connexion: true };
  if (refus?.acces === 'niveau') {
    const requis = NIVEAUX[refus.niveau_requis];
    const actuel = NIVEAUX[refus.niveau];
    return {
      texte: `Votre niveau${actuel ? ` (${actuel})` : ''} ne suffit pas${requis ? ` : cette action demande le niveau ${requis}` : ''}.`,
      connexion: false,
    };
  }
  return null;
}

// --- L'avis ------------------------------------------------------------------------------------------------------------------------------------

function fermerLAvis() {
  if (!avis) return;
  avis.remove();
  avis = null;
  ferme = Date.now();
}

function direLeRefus(refus, methode) {
  const dit = texteDuRefus(refus);
  if (!dit || surLaPageDeConnexion()) return;
  if (!avis && methode === 'GET' && Date.now() - ferme < SILENCE_APRES_FERMETURE_MS) return;
  if (!avis) {
    avis = document.createElement('div');
    avis.className = 'acces-avis';
    avis.setAttribute('role', 'alert');
    const texte = document.createElement('p');
    texte.className = 'acces-avis__texte';
    const lien = document.createElement('a');
    lien.className = 'acces-avis__lien';
    const fermer = document.createElement('button');
    fermer.setAttribute('type', 'button');
    fermer.className = 'acces-avis__fermer';
    fermer.textContent = 'Fermer';
    fermer.addEventListener('click', fermerLAvis);
    avis.append(texte, lien, fermer);
    document.body.append(avis);
  }
  avis.querySelector('.acces-avis__texte').textContent = dit.texte;
  const lien = avis.querySelector('.acces-avis__lien');
  lien.hidden = !dit.connexion;
  if (dit.connexion) {
    lien.setAttribute('href', adresseDeLaConnexion());
    lien.textContent = 'Se connecter via Discord';
  }
}

// --- fetch enveloppé ----------------------------------------------------------------------------------------------------------------------------

async function lireLeRefus(reponse) {
  const corps = await reponse.clone().json().catch(() => null);
  return corps && typeof corps === 'object' && typeof corps.acces === 'string' ? corps : null;
}

globalThis.fetch = async function fetchAvecAcces(entree, init) {
  const cible = viseLeService(entree, init);
  const reponse = await originale(entree, init);
  if (!cible || !peutDire(cible) || (reponse.status !== 401 && reponse.status !== 403)) return reponse;
  const refus = await lireLeRefus(reponse);
  if (!refus) return reponse;
  if (refus.acces === 'connexion' || refus.acces === 'niveau') {
    protege = true;
    direLeRefus(refus, cible.methode);
  }
  return reponse;
};

// --- Téléchargements du service -----------------------------------------------------------------------------------------------------------------

/** Le nom du fichier de l'en-tête Content-Disposition (filename*= puis filename=), sinon `repli`. */
export function nomDuFichier(entete, repli) {
  const etendu = /filename\*=UTF-8''([^;]+)/i.exec(entete ?? '');
  if (etendu) { try { return decodeURIComponent(etendu[1].trim()); } catch { /* repli ci-dessous */ } }
  const simple = /filename="?([^";]+)"?/i.exec(entete ?? '');
  return simple ? simple[1].trim() : repli;
}

/** Le serveur est-il fermé par une connexion ? Appris au premier besoin (un téléchargement), jamais au chargement : sans réponse du service, non. */
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
  if (!cible || !peutDire(cible)) return;
  // en production (ou sans porte), le lien garde son cours natif, comme avant
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
    if (r.status === 401 || r.status === 403) return; // refusé : l'avis l'a dit, rien à enregistrer
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
