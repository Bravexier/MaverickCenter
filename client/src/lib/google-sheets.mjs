// La fiche de personnage et Google Sheets (demande du propriétaire, 2026-10-15 : « [Exporter(Json)] => [Exporter] Exporte sous le format Google
// Sheet » ; « [Imprimer] => [Importer(EnLigne)] Demande l'url d'un Google Sheet » ; précisions choisies : « Créer un Google Sheet en ligne », « Feuille
// partagée par lien ») — ce qui ne touche ni au DOM ni au réseau :
//   - « Exporter » (src/scripts/fiche.mjs) : la page se connecte à Google (Google Identity Services, chargé par la page : SCRIPT_GOOGLE ; droit
//     PORTEE_DRIVE, qui ne donne accès qu'aux fichiers que le site crée) puis envoie le classeur de « Télécharger » à l'API Drive (ADRESSE_D_ENVOI, corps
//     corpsMultipart), qui le convertit en feuille Google Sheets (TYPE_FEUILLE_GOOGLE) ; lienDeFeuille donne le lien de la feuille créée.
//     L'identifiant client OAuth vient du build (variable SITE_GOOGLE_CLIENT_ID : clientGoogle) ; sans lui, le bouton est grisé.
//   - « Importer (en ligne) » : le lien d'une feuille partagée par lien (idDeFeuille), que le service télécharge lui-même au format .xlsx
//     (serveur/classeur.mjs, POST /api/classeur/) : adresse d'export construite (adresseDExport, jamais l'adresse reçue), redirections vérifiées
//     (redirectionPermise ; pageDeConnexion = la feuille n'est pas partagée), octets d'une archive zip (estUnZip), nom du classeur (nomDuClasseur).
// Pur, sans DOM ni module de Node, sans lib/text.mjs : parmi les scripts de page, seul src/scripts/fiche.mjs l'importe (la version portable refuse
// un module partagé entre deux scripts de page) ; la page /fiche/ (au build) et le service (serveur/classeur.mjs) l'importent aussi.

/** Le droit demandé à Google : créer des fichiers dans le Drive de la personne et n'accéder qu'à ceux que le site a créés. */
export const PORTEE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
/** Google Identity Services : le script que la page charge (document.createElement, jamais une balise du HTML ni un import). */
export const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';
/** Création d'un fichier par l'API Drive (envoi « multipart » : métadonnées puis contenu), qui rend l'identifiant et le lien de la feuille. */
export const ADRESSE_D_ENVOI = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
/** Le type d'une feuille Google Sheets : un .xlsx envoyé sous ce type est converti par Google. */
export const TYPE_FEUILLE_GOOGLE = 'application/vnd.google-apps.spreadsheet';
/** Le type d'un classeur .xlsx. */
export const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** L'hôte des feuilles Google Sheets. */
export const HOTE_DES_FEUILLES = 'docs.google.com';
/** L'hôte où Google renvoie quand il faut se connecter (feuille qui n'est pas partagée par lien). */
export const HOTE_DE_CONNEXION = 'accounts.google.com';

/** Un identifiant client OAuth de Google : « <numéro du projet>-<texte>.apps.googleusercontent.com ». */
const CLIENT_GOOGLE = /^\d{1,30}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$/;
/** L'identifiant d'une feuille dans son adresse. */
const ID_DE_FEUILLE = /^[A-Za-z0-9_-]{20,100}$/;
/** « /spreadsheets/d/<id> » ou « /spreadsheets/u/<n>/d/<id> » (compte choisi), suivi ou non de « /edit… ». */
const CHEMIN_DE_FEUILLE = /^\/spreadsheets\/(?:u\/\d{1,3}\/)?d\/([^/]+)(?:\/|$)/;
/** Au-delà, une adresse n'est pas lue (une adresse de feuille fait une centaine de caractères). */
const LONGUEUR_MAX_D_ADRESSE = 2048;

/** L'adresse, si elle se lit (https seulement, sans nom d'utilisateur ni mot de passe, sur le port par défaut) ; null sinon. */
function adresseHttps(adresse) {
  if (typeof adresse !== 'string') return null;
  const texte = adresse.trim();
  if (!texte || texte.length > LONGUEUR_MAX_D_ADRESSE) return null;
  let u;
  try {
    u = new URL(texte);
  } catch {
    return null;
  }
  return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u : null;
}

/**
 * L'identifiant client OAuth de la page (variable de build SITE_GOOGLE_CLIENT_ID, dans `env`), s'il a la forme d'un identifiant de Google ; '' sinon
 * (absent, vide ou mal formé : le bouton « Exporter » reste grisé).
 */
export function clientGoogle(env) {
  const valeur = String(env?.SITE_GOOGLE_CLIENT_ID ?? '').trim();
  return CLIENT_GOOGLE.test(valeur) ? valeur : '';
}

/**
 * L'identifiant de la feuille d'un lien Google Sheets (« https://docs.google.com/spreadsheets/d/<id>/edit?usp=sharing », « …/u/1/d/<id>/… », avec ou
 * sans « #gid=… ») ; null pour toute autre adresse (http, autre hôte, feuille « publiée sur le Web » /d/e/…, fichier de Google Drive…).
 */
export function idDeFeuille(adresse) {
  const u = adresseHttps(adresse);
  if (!u || u.hostname !== HOTE_DES_FEUILLES) return null;
  const id = CHEMIN_DE_FEUILLE.exec(u.pathname)?.[1];
  return id && ID_DE_FEUILLE.test(id) ? id : null;
}

/** L'adresse où Google rend la feuille au format .xlsx : construite d'après l'identifiant (jamais recopiée de l'adresse reçue). */
export function adresseDExport(id) {
  if (!ID_DE_FEUILLE.test(String(id ?? ''))) throw new Error('identifiant de feuille invalide');
  return `https://${HOTE_DES_FEUILLES}/spreadsheets/d/${id}/export?format=xlsx`;
}

/**
 * Vrai si le service peut suivre une redirection de Google vers cette adresse : https, sur docs.google.com ou un hôte de googleusercontent.com (où
 * Google sert le fichier) — le suffixe avec son point : « evilgoogleusercontent.com » n'en est pas un.
 */
export function redirectionPermise(adresse) {
  const u = adresseHttps(adresse);
  return Boolean(u) && (u.hostname === HOTE_DES_FEUILLES || u.hostname.endsWith('.googleusercontent.com'));
}

/** Vrai pour la page de connexion de Google : la feuille n'est pas partagée par lien (il faudrait être connecté et y avoir accès). */
export function pageDeConnexion(adresse) {
  return adresseHttps(adresse)?.hostname === HOTE_DE_CONNEXION;
}

/** Vrai si les octets commencent comme une archive zip (« PK\x03\x04 ») : un .xlsx, et non une page HTML. */
export function estUnZip(octets) {
  return Boolean(octets) && octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04;
}

/** Les caractères de contrôle d'un nom de fichier. */
const CONTROLE = /[\u0000-\u001f\u007f]/g;
/** Une moitié de paire de substitution seule (en mode `u`, une paire entière est un seul caractère, hors de cet intervalle). */
const DEMI_PAIRE = /[\uD800-\uDFFF]/gu;

/** Longueur maximale d'un nom de classeur, en caractères (points de code : un emoji compte pour un). */
const NOM_MAX = 200;

/**
 * Le nom du fichier d'un en-tête Content-Disposition : « filename*=UTF-8''… » (RFC 5987, le nom de la feuille chez Google), sinon « filename="…" »,
 * sans chemin ni caractère de contrôle, coupé à NOM_MAX caractères (jamais au milieu d'un caractère hors du plan de base, un emoji : la moitié
 * restante rendrait le nom mal formé, que encodeURIComponent refuse) et bien formé (une demi-paire seule devient « � », comme toWellFormed) ;
 * null s'il n'y en a pas.
 */
export function nomDuClasseur(contentDisposition) {
  const texte = String(contentDisposition ?? '').slice(0, 1024);
  let nom = null;
  const etendu = /filename\*\s*=\s*([^;]*)/i.exec(texte)?.[1]?.trim();
  if (etendu) {
    const morceaux = /^([A-Za-z0-9_-]*)'[^']*'(.*)$/.exec(etendu);
    if (morceaux && (!morceaux[1] || /^utf-8$/i.test(morceaux[1]))) {
      try {
        nom = decodeURIComponent(morceaux[2]);
      } catch {
        nom = null;
      }
    }
  }
  if (nom === null) {
    const simple = /filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/i.exec(texte)?.[1]?.trim();
    if (simple) nom = simple.length >= 2 && simple.startsWith('"') && simple.endsWith('"') ? simple.slice(1, -1).replace(/\\(.)/g, '$1') : simple;
  }
  if (nom === null) return null;
  nom = Array.from(nom.replace(CONTROLE, '').replace(DEMI_PAIRE, '\uFFFD').split(/[\\/]/).at(-1).trim()).slice(0, NOM_MAX).join('');
  return nom || null;
}

/**
 * Le corps de la création d'une feuille par l'API Drive (envoi « multipart/related ») : les métadonnées (nom de la feuille, type Google Sheets, qui
 * demande la conversion) puis les octets du classeur .xlsx, tels quels. { type (l'en-tête Content-Type, avec la frontière), corps: Uint8Array }.
 * `frontiere` : un texte au hasard (la page prend « maverick-<uuid> »), qui ne doit pas se trouver dans les octets.
 */
export function corpsMultipart({ nom, octets, frontiere }) {
  if (!/^[A-Za-z0-9'()+_,./:=?-]{1,70}$/.test(String(frontiere ?? ''))) throw new Error('frontière de l’envoi invalide');
  const encodeur = new TextEncoder();
  const metadonnees = JSON.stringify({ name: String(nom ?? '').trim() || 'Personnage', mimeType: TYPE_FEUILLE_GOOGLE });
  const avant = encodeur.encode(`--${frontiere}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadonnees}\r\n`
    + `--${frontiere}\r\nContent-Type: ${TYPE_XLSX}\r\n\r\n`);
  const apres = encodeur.encode(`\r\n--${frontiere}--\r\n`);
  const contenu = octets instanceof Uint8Array ? octets : new Uint8Array(octets ?? []);
  const corps = new Uint8Array(avant.length + contenu.length + apres.length);
  corps.set(avant, 0);
  corps.set(contenu, avant.length);
  corps.set(apres, avant.length + contenu.length);
  return { type: `multipart/related; boundary=${frontiere}`, corps };
}

/**
 * Le lien d'une feuille que l'API Drive vient de créer (sa réponse : { id, webViewLink }) : webViewLink s'il mène à docs.google.com en https, sinon
 * l'adresse de la feuille d'après son identifiant ; null si la réponse n'en donne aucun (la page ne met jamais dans un lien une adresse d'ailleurs).
 */
export function lienDeFeuille(reponse) {
  const lien = reponse?.webViewLink;
  if (typeof lien === 'string' && adresseHttps(lien)?.hostname === HOTE_DES_FEUILLES) return adresseHttps(lien).href;
  return ID_DE_FEUILLE.test(String(reponse?.id ?? '')) ? `https://${HOTE_DES_FEUILLES}/spreadsheets/d/${reponse.id}/edit` : null;
}
