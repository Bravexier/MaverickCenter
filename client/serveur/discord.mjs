// Connexion par Discord (décision R310 ; docs/serveur.md, « Connexion par Discord »). OAuth 2.0 « code d'autorisation », portées `identify` et
// `guilds.members.read` SEULEMENT ; le service ne garde ni jeton ni e-mail ni liste de serveurs : il lit le profil et l'appartenance au serveur Discord du
// jeu, en déduit un NIVEAU (observateur, joueur, mj, createur), écrit la ligne de `utilisateur` (serveur/utilisateurs.mjs) et révoque le jeton aussitôt.
//
// Ce module tient :
//   - les fonctions pures (niveau d'un membre, nom affiché, adresses des images, dates, réglage, chemin de retour, session signée) ;
//   - le réglage de l'instance (`secrets/discord.json`, relu quand il change), posé par la commande de l'hôte (deploy/installateur/discord/discord.sh,
//     `commandeDiscord` ci-dessous) : l'identifiant et le secret de l'application Discord, le serveur, l'adresse de retour, la correspondance
//     « identifiant de rôle Discord -> niveau » (jamais dans le code) et le secret des sessions ;
//   - le flux (`creerConnexion`) avec un `fetch` injecté : aucun appel réseau dans les tests, un délai d'attente borné sur chaque appel.
//
// La session est un cookie signé (HMAC-SHA256) `maverick_session` : « v1.<charge base64url { u, n, exp, v }>.<signature> », sans révocation côté serveur
// (se déconnecter = retirer le cookie ; `discord.sh --nouvelle-session` change le secret et ferme toutes les sessions). Le niveau de la porte du site de dev
// est celui du cookie (docs/serveur.md, « Accès au site de dev »). 12 h sur le site de dev (le niveau donne des droits), 7 jours en production.
// `v` : l'instant (secondes) de la dernière vérification du niveau auprès de Discord.
//
// Revérification pendant la session (R314) : avec le jeton du BOT de l'application (`jeton_du_bot` du réglage, secret de l'instance), `reverifier` relit le membre
// par l'API REST de Discord, au plus toutes les 5 minutes par personne, lors de ses visites ; sans jeton de bot, rien ne change. Une panne de Discord ou un bot mal
// réglé ne change jamais un niveau ni n'efface un compte (la session garde son dernier niveau vérifié, au plus jusqu'à son expiration).
//
// Connexion commune (R315) : avec `domaine_commun` dans le réglage (le même sur le site de dev et la production, avec le même secret de session), le cookie de
// session est posé sur ce domaine et vaut pour les deux sites ; il porte alors `d` (l'identifiant Discord d'un membre) et `i` (le site qui a calculé `n` : dev ou
// prod). Un site ne croit jamais le niveau calculé par l'autre : `session` ignore le cookie de l'autre site, et `reverifier` le convertit en session de ce site (le bot
// est exigé) : le membre est relu, son compte retrouvé ou créé par son identifiant Discord, son niveau calculé avec la correspondance des rôles de ce site.
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { connexionSecurisee, egaux, valeursDuCookie } from './acces.mjs';

/** Le fichier de réglage dans le conteneur (le dossier secrets/ de l'instance y est monté en lecture seule). */
export const FICHIER_PAR_DEFAUT = '/secrets/discord.json';
export const COOKIE_SESSION = 'maverick_session';
export const COOKIE_ETAT = 'maverick_etat';
/** Les seules autorisations demandées à Discord (R310 (6)). */
export const PORTEES_OAUTH = 'identify guilds.members.read';
export const SERVEUR_PAR_DEFAUT = '374464159254839298';
export const API_DISCORD = 'https://discord.com/api/v10';
export const CDN_DISCORD = 'https://cdn.discordapp.com';
export const NIVEAUX = Object.freeze(['observateur', 'joueur', 'mj', 'createur']);
/** Les niveaux qu'une correspondance de rôle peut donner (R311) ; l'Observateur ne se donne pas : c'est ce qu'est un membre sans rôle correspondant. */
export const NIVEAUX_DES_ROLES = Object.freeze(['joueur', 'mj', 'createur']);
export const DUREE_SESSION_DEV_S = 12 * 3600;
export const DUREE_SESSION_PROD_S = 7 * 24 * 3600;
export const DUREE_DE_L_ETAT_S = 600;
/** Délai d'attente de chaque appel à Discord. */
export const DELAI_DISCORD_MS = 8000;
const TAILLE_MAX_REPONSE = 256 * 1024;
/** R314 : le niveau d'une session se revérifie au plus toutes les 5 minutes par personne. */
export const INTERVALLE_DE_REVERIFICATION_S = 300;
/** R314 : après un échec de la revérification (Discord ou bot), aucun nouvel appel pendant au moins 5 minutes (au plus 1 h pour une limite d'appels demandée par Discord). */
export const PAUSE_APRES_ECHEC_S = 300;
export const PAUSE_MAX_S = 3600;
/** Le nombre de résultats récents gardés en mémoire (un par personne revérifiée dans les 5 dernières minutes). */
const RESULTATS_RECENTS_MAX = 1000;
export const RETOUR_PAR_DEFAUT = '/profil/';
/** Les codes d'erreur de `/connexion/?erreur=<code>` : refus (l'utilisateur a refusé), indisponible, discord (Discord a échoué), etat (état OAuth faux ou périmé). */
export const CODES_D_ERREUR = Object.freeze(['refus', 'indisponible', 'discord', 'etat']);
/** R315 : les deux sites de la connexion commune ; `i` du cookie de session dit lequel a calculé le niveau (le site de dev : celui qui a l'édition). */
export const SITES = Object.freeze(['dev', 'prod']);

export const rangDuNiveau = (niveau) => NIVEAUX.indexOf(niveau);
export const estUnNiveau = (valeur) => NIVEAUX.includes(valeur);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fonctions pures : niveau, nom, images, dates
// ---------------------------------------------------------------------------------------------------------------------------------------------

const SNOWFLAKE = /^[0-9]{5,25}$/;
const HASH_D_IMAGE = /^(a_)?[0-9a-f]{32}$/;

/**
 * Le niveau d'un compte (R310 (2), amendée par R311). `membre` : l'objet « membre du serveur » de Discord, ou null quand l'appel a échoué (non membre) ; `roles` :
 * la correspondance « identifiant de rôle Discord -> niveau » (joueur, mj, createur) de l'instance. Observateur : non membre, adhésion en attente (`pending`), exclusion
 * temporaire en cours (`communication_disabled_until` dans le futur), et **tout membre sans rôle correspondant** ; sinon le plus haut des niveaux que donnent ses rôles.
 * @param {{ membre: object|null, roles?: Record<string, string>, maintenant?: number }} o `maintenant` en ms
 */
export function niveauDuMembre({ membre, roles = {}, maintenant = Date.now() }) {
  if (!membre || typeof membre !== 'object') return 'observateur';
  if (membre.pending === true) return 'observateur';
  const jusqua = membre.communication_disabled_until;
  if (typeof jusqua === 'string' && jusqua) {
    const t = Date.parse(jusqua);
    if (!Number.isFinite(t) || t > maintenant) return 'observateur'; // une date illisible compte comme une exclusion : le doute profite au moins de droits
  }
  let niveau = 'observateur';
  for (const role of Array.isArray(membre.roles) ? membre.roles : []) {
    const donne = Object.hasOwn(roles, String(role)) ? roles[String(role)] : null;
    if (NIVEAUX_DES_ROLES.includes(donne) && rangDuNiveau(donne) > rangDuNiveau(niveau)) niveau = donne;
  }
  return niveau;
}

const texteUtile = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Le nom affiché (R310 (5)) : le surnom du membre sur le serveur, sinon le `global_name` du compte, sinon son nom d'utilisateur. */
export function nomAffiche({ membre = null, utilisateur }) {
  const nom = texteUtile(membre?.nick) ?? texteUtile(utilisateur?.global_name) ?? texteUtile(utilisateur?.username);
  if (!nom) throw new Error('aucun nom à afficher');
  return nom.slice(0, 100);
}

/** L'avatar par défaut de Discord pour un compte sans avatar : `(id >> 22) % 6`. */
export const avatarParDefaut = (id) => `${CDN_DISCORD}/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;

/**
 * L'avatar : celui du membre sur le serveur s'il y en a un, sinon celui du compte, sinon l'avatar par défaut (format « Image Formatting » de la
 * documentation de Discord). Un hachage qui n'a pas la forme d'un hachage d'image est ignoré (jamais recopié dans une adresse).
 */
export function adresseDAvatar({ membre = null, utilisateur, serveur }) {
  const id = String(utilisateur?.id ?? '');
  if (!SNOWFLAKE.test(id)) throw new Error('identifiant Discord invalide');
  if (HASH_D_IMAGE.test(membre?.avatar ?? '') && SNOWFLAKE.test(String(serveur))) return `${CDN_DISCORD}/guilds/${serveur}/users/${id}/avatars/${membre.avatar}.png`;
  if (HASH_D_IMAGE.test(utilisateur?.avatar ?? '')) return `${CDN_DISCORD}/avatars/${id}/${utilisateur.avatar}.png`;
  return avatarParDefaut(id);
}

/** La bannière : celle du membre sur le serveur, sinon celle du compte, sinon null. */
export function adresseDeBanniere({ membre = null, utilisateur, serveur }) {
  const id = String(utilisateur?.id ?? '');
  if (!SNOWFLAKE.test(id)) throw new Error('identifiant Discord invalide');
  if (HASH_D_IMAGE.test(membre?.banner ?? '') && SNOWFLAKE.test(String(serveur))) return `${CDN_DISCORD}/guilds/${serveur}/users/${id}/banners/${membre.banner}.png`;
  if (HASH_D_IMAGE.test(utilisateur?.banner ?? '')) return `${CDN_DISCORD}/banners/${id}/${utilisateur.banner}.png`;
  return null;
}

/** Une date de Discord (ISO 8601, millisecondes et décalage) au format de la base « AAAA-MM-JJTHH:MM:SSZ », ou null si elle est absente ou illisible. */
export function instantDeDiscord(texte) {
  if (typeof texte !== 'string' || !texte) return null;
  const t = Date.parse(texte);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
}

/**
 * Le chemin où revenir après la connexion : un chemin du site seulement (« /… », jamais « // » ni une autre origine), sinon `RETOUR_PAR_DEFAUT`.
 * @param {unknown} retour
 */
export function retourValide(retour) {
  if (typeof retour !== 'string' || !retour || retour.length > 500) return RETOUR_PAR_DEFAUT;
  if (!retour.startsWith('/') || retour.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(retour)) return RETOUR_PAR_DEFAUT;
  try {
    const u = new URL(retour, 'https://exemple.invalid');
    if (u.origin !== 'https://exemple.invalid') return RETOUR_PAR_DEFAUT;
    // le chemin NORMALISÉ et encodé par l'analyseur d'adresses (un caractère hors latin-1 y devient « %xx » : jamais un en-tête Location invalide, qui ferait échouer la
    // réponse après l'écriture du compte) ; l'ancre est retirée ; « /.//hote » se normalise en « //hote » : refusé comme « // »
    const sur = `${u.pathname}${u.search}`;
    return sur.startsWith('/') && !sur.startsWith('//') ? sur : RETOUR_PAR_DEFAUT;
  } catch {
    return RETOUR_PAR_DEFAUT;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Sessions et état OAuth : jetons signés
// ---------------------------------------------------------------------------------------------------------------------------------------------

const signature = (secret, type, charge) => createHmac('sha256', secret).update(`${type}.v1.${charge}`).digest('base64url');

/** Un jeton signé « v1.<charge>.<signature> » : `type` (« session », « etat ») sépare les usages, un jeton de l'un ne vaut jamais pour l'autre. */
export function signer(secret, type, charge) {
  const corps = Buffer.from(JSON.stringify(charge)).toString('base64url');
  return `v1.${corps}.${signature(secret, type, corps)}`;
}

/** La charge d'un jeton bien signé pour `type`, sinon null (forme, signature, secret absent). L'expiration se juge à part. */
export function lireSigne(secret, type, jeton) {
  const m = /^v1\.([A-Za-z0-9_-]{1,1500})\.([A-Za-z0-9_-]{43})$/.exec(String(jeton ?? ''));
  if (!m || !secret || !egaux(signature(secret, type, m[1]), m[2])) return null;
  try {
    const charge = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
    return charge && typeof charge === 'object' && !Array.isArray(charge) ? charge : null;
  } catch {
    return null;
  }
}

/**
 * Le jeton d'une session : `u` l'identifiant de l'utilisateur du site, `n` son niveau, `exp` l'expiration (secondes depuis 1970), `v` (facultatif) l'instant de la
 * dernière vérification du niveau auprès de Discord (R314) ; sans `v`, la session est à revérifier. Connexion commune (R315) : `d` l'identifiant Discord d'un membre,
 * `i` le site qui a calculé `n` (`dev` ou `prod`).
 */
export const creerJetonDeSession = (secret, { u, n, exp, v, d, i }) => signer(secret, 'session', {
  u, n, exp,
  ...(Number.isInteger(v) ? { v } : {}),
  ...(typeof d === 'string' && d ? { d } : {}),
  ...(SITES.includes(i) ? { i } : {}),
});

/** La session d'un jeton bien signé, valide et pas encore expiré : { u, n, exp, v? } (`u` null : sans compte ; `v` absent d'un ancien cookie), sinon null. */
export function lireJetonDeSession(secret, jeton, maintenantS) {
  const c = lireSigne(secret, 'session', jeton);
  // `u` : l'identifiant du site, ou null pour un non-membre du serveur (R312 : aucun compte n'est gardé, la session n'est qu'Observateur)
  if (!c || !(c.u === null || (typeof c.u === 'string' && c.u && c.u.length <= 100)) || !estUnNiveau(c.n) || !Number.isInteger(c.exp) || c.exp <= maintenantS) return null;
  return {
    u: c.u, n: c.n, exp: c.exp,
    ...(Number.isInteger(c.v) && c.v >= 0 ? { v: c.v } : {}),
    ...(typeof c.d === 'string' && SNOWFLAKE.test(c.d) ? { d: c.d } : {}),
    ...(SITES.includes(c.i) ? { i: c.i } : {}),
  };
}

const attributs = (chemin, securise, duree, domaine = null) => `; Path=${chemin}${domaine ? `; Domain=${domaine}` : ''}; HttpOnly; SameSite=Lax${duree === null ? '' : `; Max-Age=${duree}`}${securise ? '; Secure' : ''}`;
const RETIRE = '; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
/** L'en-tête Set-Cookie d'une session ouverte ; `domaine` (R315) : le domaine commun aux deux sites. */
export const cookieDeSession = (jeton, { securise, dureeS, domaine = null }) => `${COOKIE_SESSION}=${jeton}${attributs('/', securise, dureeS, domaine)}`;
/** L'en-tête Set-Cookie qui retire la session (`domaine` : le cookie commun, R315 ; sans lui, le cookie propre à l'hôte). */
export const cookieDeSessionRetire = ({ securise, domaine = null }) => `${COOKIE_SESSION}=; Max-Age=0${RETIRE}${attributs('/', securise, null, domaine)}`;
/**
 * Les en-têtes Set-Cookie d'une session, le cookie de session en premier. Avec un domaine commun (R315), le cookie vaut pour les deux sites, et l'ancien cookie propre à
 * l'hôte, de même nom, est retiré (passage des sessions ouvertes avant la connexion commune).
 */
export const cookiesDeSession = (jeton, { securise, dureeS, domaine = null }) => [
  cookieDeSession(jeton, { securise, dureeS, domaine }),
  ...(domaine ? [cookieDeSessionRetire({ securise })] : []),
];
/** Le cookie de l'état OAuth : court (10 min), limité aux routes de connexion ; SameSite=Lax le laisse accompagner le retour de Discord (navigation de haut niveau). */
export const cookieDeLEtat = (jeton, { securise }) => `${COOKIE_ETAT}=${jeton}${attributs('/api/connexion/', securise, DUREE_DE_L_ETAT_S)}`;
export const cookieDeLEtatRetire = ({ securise }) => `${COOKIE_ETAT}=; Max-Age=0${RETIRE}${attributs('/api/connexion/', securise, null)}`;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le réglage (secrets/discord.json)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const HEX64 = /^[0-9a-f]{64}$/;
/** Un nom de domaine (R315 : le domaine commun aux deux sites), en minuscules, d'au moins deux étiquettes. */
const DOMAINE = /^(?=.{3,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** L'adresse de retour : une adresse complète en HTTPS, sans identifiants, ni fragment, ni chaîne de requête. */
export function adresseDeRetourValide(texte) {
  let u;
  try {
    u = new URL(String(texte));
  } catch {
    throw new Error('adresse de retour illisible (une adresse complète : https://…)');
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.hash || u.search || !u.host) throw new Error('adresse de retour : https://<site>/chemin/, sans identifiants, ni « ? », ni « # »');
  if (String(texte).length > 300) throw new Error('adresse de retour trop longue');
  return u.href;
}

/** Le réglage vérifié (même forme, champs inconnus retirés), ou une erreur qui dit ce qui ne va pas. */
export function validerReglage(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  if (!o) throw new Error('réglage illisible');
  if (o.version !== 1) throw new Error(`version de réglage inconnue (${JSON.stringify(o.version)})`);
  if (!SNOWFLAKE.test(String(o.client_id ?? ''))) throw new Error('identifiant de l’application Discord invalide (des chiffres)');
  const secret = o.client_secret;
  if (typeof secret !== 'string' || secret.length < 10 || secret.length > 200 || /\s/.test(secret)) throw new Error('secret de l’application Discord invalide');
  if (!SNOWFLAKE.test(String(o.serveur ?? ''))) throw new Error('identifiant du serveur Discord invalide (des chiffres)');
  const adresse = adresseDeRetourValide(o.adresse_de_retour);
  const roles = {};
  if (o.roles !== undefined && (!o.roles || typeof o.roles !== 'object' || Array.isArray(o.roles))) throw new Error('correspondance des rôles invalide');
  for (const [id, niveau] of Object.entries(o.roles ?? {})) {
    if (!SNOWFLAKE.test(id)) throw new Error(`identifiant de rôle invalide (${JSON.stringify(id.slice(0, 30))})`);
    if (!NIVEAUX_DES_ROLES.includes(niveau)) throw new Error(`niveau de rôle inconnu pour ${id} (joueur, mj ou createur)`);
    roles[id] = niveau;
  }
  if (!HEX64.test(o.secret_de_session ?? '')) throw new Error('secret de session invalide');
  // le jeton du bot de l'application (R314), facultatif : absent, le niveau n'est pas revérifié pendant la session
  const bot = o.jeton_du_bot;
  if (bot !== undefined && (typeof bot !== 'string' || bot.length < 20 || bot.length > 200 || /\s/.test(bot))) throw new Error('jeton du bot invalide (20 à 200 caractères, sans espace)');
  // la connexion commune (R315), facultative : le domaine commun aux deux sites. Elle exige le bot (chaque site recalcule le niveau avec sa propre correspondance) et
  // une adresse de retour dans ce domaine (le cookie posé au retour de Discord doit valoir pour ce site)
  const commun = o.domaine_commun;
  if (commun !== undefined) {
    if (typeof commun !== 'string' || !DOMAINE.test(commun)) throw new Error('domaine commun invalide (par exemple maverick-jdr.com : minuscules, sans point au début)');
    if (bot === undefined) throw new Error('la connexion commune (R315) demande le bot (--bot) : chaque site recalcule le niveau avec ses propres rôles');
    const hote = new URL(adresse).hostname;
    if (hote !== commun && !hote.endsWith(`.${commun}`)) throw new Error(`l’adresse de retour (${hote}) n’est pas dans le domaine commun ${commun}`);
  }
  return {
    version: 1,
    client_id: String(o.client_id),
    client_secret: secret,
    serveur: String(o.serveur),
    adresse_de_retour: adresse,
    roles,
    secret_de_session: o.secret_de_session,
    ...(bot === undefined ? {} : { jeton_du_bot: bot }),
    ...(commun === undefined ? {} : { domaine_commun: commun }),
    pose_le: typeof o.pose_le === 'string' ? o.pose_le.slice(0, 40) : null,
  };
}

/**
 * Le réglage qui suit une commande de l'hôte. `definir` (identifiant, secret, adresse de retour, serveur) pose ou change l'application et garde les rôles et
 * les sessions et le jeton du bot ; `role` / `sansRole` changent la correspondance ; `serveur` en change l'identifiant ; `nouvelleSession` renouvelle le secret des
 * sessions ; `jetonDuBot` pose le jeton du bot de l'application (R314), `sansBot` le retire ; `domaineCommun` et `secretDeSession` posent la connexion commune
 * (R315 : le domaine des deux sites, le secret de session de l'autre), `sansDomaineCommun` la retire.
 * @param {{ ancien?: object|null, definir?: { clientId: string, clientSecret: string, adresseDeRetour: string, serveur?: string }, role?: { id?: string, ids?: string[], niveau: string },
 *   sansRole?: string, serveur?: string, nouvelleSession?: boolean, jetonDuBot?: string|null, sansBot?: boolean, domaineCommun?: string|null, secretDeSession?: string|null,
 *   sansDomaineCommun?: boolean, maintenant?: Date }} o
 */
export function reglageApres({ ancien = null, definir = null, role = null, sansRole = null, serveur = null, nouvelleSession = false, jetonDuBot = null, sansBot = false, domaineCommun = null,
  secretDeSession = null, sansDomaineCommun = false, maintenant = new Date() }) {
  const garde = ancien ? validerReglage(ancien) : null;
  if (!definir && !garde) throw new Error('aucune application Discord n’est posée : lancez d’abord la commande sans option');
  const base = garde ?? { version: 1, roles: {}, secret_de_session: randomBytes(32).toString('hex'), serveur: SERVEUR_PAR_DEFAUT };
  const suivant = { ...base, roles: { ...base.roles } };
  if (definir) {
    suivant.client_id = String(definir.clientId ?? '').trim();
    suivant.client_secret = String(definir.clientSecret ?? '');
    suivant.adresse_de_retour = String(definir.adresseDeRetour ?? '').trim();
    if (definir.serveur) suivant.serveur = String(definir.serveur).trim();
  }
  if (serveur !== null) suivant.serveur = String(serveur).trim();
  if (role) {
    const ids = (role.ids ?? [role.id]).map(String);
    if (!ids.length) throw new Error('aucun identifiant de rôle');
    if (!ids.every((id) => SNOWFLAKE.test(id))) throw new Error('identifiant de rôle invalide (des chiffres : Discord, clic droit sur le rôle, « Copier l’identifiant »)');
    if (!NIVEAUX_DES_ROLES.includes(role.niveau)) throw new Error('niveau inconnu (joueur, mj ou createur)');
    for (const id of ids) suivant.roles[id] = role.niveau;
  }
  if (sansRole !== null) {
    if (!Object.hasOwn(suivant.roles, String(sansRole))) throw new Error(`le rôle ${String(sansRole).slice(0, 30)} n’a aucun niveau posé`);
    delete suivant.roles[String(sansRole)];
  }
  if (jetonDuBot !== null) suivant.jeton_du_bot = String(jetonDuBot).trim();
  if (sansBot) {
    if (!Object.hasOwn(suivant, 'jeton_du_bot')) throw new Error('aucun jeton de bot n’est posé');
    delete suivant.jeton_du_bot;
  }
  if (domaineCommun !== null) suivant.domaine_commun = String(domaineCommun).trim().toLowerCase();
  if (sansDomaineCommun) {
    if (!Object.hasOwn(suivant, 'domaine_commun')) throw new Error('aucune connexion commune n’est posée');
    delete suivant.domaine_commun;
  }
  if (secretDeSession !== null) suivant.secret_de_session = String(secretDeSession).trim();
  if (nouvelleSession || !base.secret_de_session) suivant.secret_de_session = randomBytes(32).toString('hex');
  suivant.pose_le = maintenant.toISOString();
  return validerReglage(suivant);
}

/** Le réglage résumé SANS secret : pour `--etat` et les journaux (`bot` : un jeton de bot est posé, jamais sa valeur). */
export function resumeDuReglage(reglage) {
  return {
    client_id: reglage.client_id, serveur: reglage.serveur, adresse_de_retour: reglage.adresse_de_retour, roles: { ...reglage.roles }, bot: Boolean(reglage.jeton_du_bot),
    ...(reglage.domaine_commun ? { domaine_commun: reglage.domaine_commun } : {}),
    pose_le: reglage.pose_le,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le flux : adresse d'autorisation, retour, lecture du profil et du membre, révocation
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une erreur du flux : `code` est un de CODES_D_ERREUR. */
export class ErreurDeConnexion extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ErreurDeConnexion';
    this.code = code;
  }
}

/**
 * La connexion d'une instance : relit `fichier` quand il change, mène le flux OAuth avec `fetch`, lit la session du cookie.
 * @param {{ fichier: string, fetch?: typeof fetch, horloge?: () => number, journal?: ((message: string) => void) | null, edition?: boolean,
 *   aleatoire?: () => string, delai?: number }} o `edition` : le site de dev (sessions de 12 h au lieu de 7 jours) ; `aleatoire` : l'état OAuth (tests)
 */
export function creerConnexion({ fichier, fetch: appelHttp = globalThis.fetch, horloge = () => Date.now(), journal = null, edition = false, aleatoire = () => randomBytes(32).toString('base64url'), delai = DELAI_DISCORD_MS }) {
  let vu = null; // { cle, etat }
  const maintenantS = () => Math.floor(horloge() / 1000);
  const dureeS = edition ? DUREE_SESSION_DEV_S : DUREE_SESSION_PROD_S;
  /** R315 : ce site, pour la connexion commune (le site de dev est celui qui a l'édition). */
  const instance = edition ? 'dev' : 'prod';

  /** Le réglage courant : { reglage } posé, { invalide } illisible, null absent. */
  function lire() {
    let s;
    try {
      s = statSync(fichier);
    } catch (e) {
      if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') {
        if (vu) journal?.('connexion : réglage Discord retiré, la connexion n’est plus disponible');
        vu = null;
        return null;
      }
      return noter(`illisible:${e?.code ?? 'erreur'}`, `fichier illisible (${e?.code ?? 'erreur'})`);
    }
    const cle = `${s.mtimeMs}:${s.ino}:${s.size}`;
    if (vu?.cle === cle) return vu.etat;
    try {
      const reglage = validerReglage(JSON.parse(readFileSync(fichier, 'utf8')));
      vu = { cle, etat: { reglage } };
      journal?.(`connexion : réglage Discord relu (serveur ${reglage.serveur}, ${Object.keys(reglage.roles).length} rôle(s) de niveau, ${reglage.jeton_du_bot ? 'bot de revérification posé' : 'sans bot'})`);
    } catch (e) {
      vu = { cle, etat: { invalide: e?.message ?? 'réglage invalide' } };
      journal?.(`connexion : réglage Discord invalide (${vu.etat.invalide}) : la connexion est indisponible jusqu'à ce que la commande de l'hôte le refasse`);
    }
    return vu.etat;
  }
  function noter(cle, raison) {
    if (vu?.cle !== cle) journal?.(`connexion : réglage Discord ${raison} : la connexion est indisponible`);
    vu = { cle, etat: { invalide: raison } };
    return vu.etat;
  }
  const reglage = () => lire()?.reglage ?? null;
  const disponible = () => reglage() !== null;

  /** Les sessions valides des en-têtes : tous les cookies `maverick_session` (R315 : celui du domaine commun et l'ancien, propre à l'hôte, peuvent coexister). */
  function sessionsValides(entetes = {}) {
    const secret = reglage()?.secret_de_session;
    if (!secret) return [];
    const maintenant = maintenantS();
    return valeursDuCookie(entetes.cookie, COOKIE_SESSION).map((jeton) => lireJetonDeSession(secret, jeton, maintenant)).filter(Boolean);
  }
  /** La session la plus récemment vérifiée (`v` le plus haut ; à égalité, la première). */
  const plusRecente = (liste) => liste.reduce((a, b) => (a === null || (b.v ?? -1) > (a.v ?? -1) ? b : a), null);

  /**
   * La session de ce site portée par les en-têtes d'une requête : { u, n, exp, v?, d?, i? } ou null. R315 : une session dont l'autre site a calculé le niveau (`i`)
   * n'en est pas une ici tant que `reverifier` ne l'a pas convertie ; celle d'un non-membre (`u` null : Observateur sans compte) vaut pour les deux sites.
   */
  function session(entetes = {}) {
    return plusRecente(sessionsValides(entetes).filter((s) => s.u === null || s.i === undefined || s.i === instance));
  }

  /** R315 : la session d'un membre ouverte ou revérifiée par l'autre site (connexion commune), que `reverifier` convertit. */
  function sessionDeLAutreSite(entetes = {}) {
    return plusRecente(sessionsValides(entetes).filter((s) => s.u !== null && s.i !== undefined && s.i !== instance && s.d !== undefined));
  }

  /** R315 : avec la connexion commune, la session dit quel site a calculé son niveau (`i`) et, pour un membre, son identifiant Discord (`d`, que l'autre site relit). */
  const marquer = (r, s, d = null) => (r.domaine_commun ? { ...s, i: instance, ...(d ? { d: String(d) } : {}) } : s);
  /** Les cookies d'une session de ce site, sur le domaine commun quand il est posé (R315). */
  const cookiesPour = (r, jeton, securise, duree) => cookiesDeSession(jeton, { securise, dureeS: duree, domaine: r.domaine_commun ?? null });

  /** Les cookies qui retirent la session (POST /api/deconnexion/) : celui de l'hôte et, avec la connexion commune (R315 (3)), celui du domaine : déconnecté des deux sites. */
  function cookiesDeDeconnexion(entetes = {}) {
    const securise = connexionSecurisee(entetes);
    const domaine = reglage()?.domaine_commun ?? null;
    return [cookieDeSessionRetire({ securise }), ...(domaine ? [cookieDeSessionRetire({ securise, domaine })] : [])];
  }

  /** Le début de la connexion : { location, cookies } (302 vers Discord), ou { erreur } si la connexion n'est pas disponible. */
  function commencer({ retour, entetes = {} }) {
    const r = reglage();
    if (!r) return { erreur: 'indisponible' };
    const etat = aleatoire();
    const jeton = signer(r.secret_de_session, 'etat', { e: etat, r: retourValide(retour), exp: maintenantS() + DUREE_DE_L_ETAT_S });
    const adresse = new URL('https://discord.com/oauth2/authorize');
    adresse.searchParams.set('client_id', r.client_id);
    adresse.searchParams.set('response_type', 'code');
    adresse.searchParams.set('scope', PORTEES_OAUTH);
    adresse.searchParams.set('redirect_uri', r.adresse_de_retour);
    adresse.searchParams.set('state', etat);
    return { location: adresse.href, cookies: [cookieDeLEtat(jeton, { securise: connexionSecurisee(entetes) })] };
  }

  const entetesBasic = (r) => ({ Authorization: `Basic ${Buffer.from(`${r.client_id}:${r.client_secret}`).toString('base64')}`, 'User-Agent': 'MaverickCenter (connexion)' });

  /** Un appel à Discord : { statut, corps } (corps JSON, ou null s'il est vide ou illisible) ; une panne réseau ou un délai dépassé lève ErreurDeConnexion('discord'). */
  async function appeler(url, { methode = 'GET', entetes = {}, formulaire = null } = {}) {
    let reponse;
    let texte;
    try {
      reponse = await appelHttp(url, {
        method: methode,
        headers: { Accept: 'application/json', ...(formulaire ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...entetes },
        body: formulaire ? new URLSearchParams(formulaire).toString() : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(delai),
      });
      texte = await reponse.text();
    } catch (e) {
      throw new ErreurDeConnexion('discord', `appel à Discord impossible (${e?.name ?? 'erreur'})`);
    }
    if (texte.length > TAILLE_MAX_REPONSE) throw new ErreurDeConnexion('discord', 'réponse de Discord trop grosse');
    let corps = null;
    try {
      corps = texte ? JSON.parse(texte) : null;
    } catch {
      corps = null;
    }
    return { statut: reponse.status, corps, retryApres: reponse.headers?.get?.('retry-after') ?? null };
  }

  /**
   * R312 : le compte d'un non-membre ne se garde pas. Il est effacé s'il existe (jamais sur une panne : les appelants n'arrivent ici que sur un constat de Discord), jamais
   * créé. Un effacement refusé (référence sans cascade) ou en échec laisse le compte, est noté au journal (identifiant du site seulement) et ne bloque rien.
   */
  function effacerLeNonMembre(effacer, discordId, origine) {
    try {
      const e = effacer ? effacer(String(discordId)) : { id: null, efface: false, bloque: [] };
      if (e.efface) journal?.(`connexion : ${origine}, compte ${e.id} effacé (R312)`);
      else if (e.bloque.length) journal?.(`connexion : ${origine}, compte ${e.id} NON effacé : référencé par ${e.bloque.join(', ')} (R312, R313 : état provisoire jusqu'à E8, où les fiches resteront sans propriétaire)`);
    } catch (e) {
      journal?.(`connexion : ${origine}, effacement du compte impossible (${e?.message ?? e})`);
    }
  }

  /** Révoque les jetons : sans jamais bloquer la connexion (une panne est notée, sans le jeton). */
  async function revoquer(r, jetons) {
    const aRevoquer = jetons.filter((j) => j?.valeur);
    await Promise.all(aRevoquer.map(async ({ valeur, indice }) => {
      try {
        const rep = await appeler(`${API_DISCORD}/oauth2/token/revoke`, { methode: 'POST', entetes: entetesBasic(r), formulaire: { token: valeur, token_type_hint: indice } });
        if (rep.statut < 200 || rep.statut >= 300) journal?.(`connexion : révocation du jeton Discord refusée (${rep.statut})`);
      } catch {
        journal?.('connexion : révocation du jeton Discord impossible (sans effet sur la connexion)');
      }
    }));
  }

  /**
   * Le retour de Discord. `enregistrer(profil)` écrit la ligne de `utilisateur` (serveur/utilisateurs.mjs) et rend l'identifiant du site ; rien n'est écrit si le
   * flux échoue avant. Rend { location, cookies } (302 : retour demandé, ou /connexion/?erreur=<code>), ou { interdit: true } pour un compte bot ou système (403,
   * R310 (2)).
   * `effacer(discordId)` (R312) : efface le compte d'un non-membre s'il existe, rend { id, efface, bloque } (serveur/utilisateurs.mjs#effacerLeCompte).
   * @param {{ code?: string|null, etat?: string|null, erreur?: string|null, entetes?: object, enregistrer: (profil: object) => string, effacer?: ((discordId: string) => { id: string|null, efface: boolean, bloque: string[] }) | null }} o
   */
  async function terminer({ code = null, etat = null, erreur = null, entetes = {}, enregistrer, effacer = null }) {
    const securise = connexionSecurisee(entetes);
    const retire = [cookieDeLEtatRetire({ securise })];
    const echec = (c) => ({ location: `/connexion/?erreur=${c}`, cookies: retire });
    const r = reglage();
    if (!r) return echec('indisponible');
    // l'état : le cookie signé (court) doit porter celui que Discord renvoie ; sans cela, rien n'est demandé à Discord
    let charge = null;
    for (const jeton of valeursDuCookie(entetes.cookie, COOKIE_ETAT)) {
      const c = lireSigne(r.secret_de_session, 'etat', jeton);
      if (c && typeof c.e === 'string' && Number.isInteger(c.exp) && c.exp > maintenantS() && typeof etat === 'string' && etat && egaux(c.e, etat)) {
        charge = c;
        break;
      }
    }
    if (!charge) return echec('etat');
    const retour = retourValide(charge.r);
    if (erreur) return echec('refus');
    if (typeof code !== 'string' || !code || code.length > 500) return echec('etat');
    let jetons = [];
    try {
      const jeton = await appeler(`${API_DISCORD}/oauth2/token`, {
        methode: 'POST',
        entetes: entetesBasic(r),
        formulaire: { grant_type: 'authorization_code', code, redirect_uri: r.adresse_de_retour },
      });
      if (jeton.statut !== 200 || typeof jeton.corps?.access_token !== 'string' || !jeton.corps.access_token) {
        journal?.(`connexion : échange du code refusé par Discord (${jeton.statut})`);
        // 400 : code périmé, déjà utilisé ou refusé (le visiteur recommence) ; toute autre réponse (secret refusé, panne) est un échec côté Discord ou de l'instance
        return echec(jeton.statut === 400 ? 'refus' : 'discord');
      }
      jetons = [{ valeur: jeton.corps.access_token, indice: 'access_token' }, { valeur: jeton.corps.refresh_token, indice: 'refresh_token' }];
      // Discord répond aussi 403 à l'appel membre quand le jeton n'a pas la portée `guilds.members.read` : sans elle, ce 403 ne dit rien de l'appartenance, et chaque compte serait
      // effacé à sa connexion (R312). La portée accordée est donc vérifiée AVANT tout appel membre : absente, la connexion s'arrête comme sur une panne, rien d'effacé ni d'écrit.
      const accordees = typeof jeton.corps.scope === 'string' ? jeton.corps.scope.split(/[\s,]+/) : [];
      if (!accordees.includes('guilds.members.read')) {
        journal?.('connexion : la portée guilds.members.read n’a pas été accordée par Discord : connexion arrêtée, rien d’effacé');
        return echec('discord');
      }
      const acces = { Authorization: `Bearer ${jeton.corps.access_token}`, 'User-Agent': 'MaverickCenter (connexion)' };
      const moi = await appeler(`${API_DISCORD}/users/@me`, { entetes: acces });
      const utilisateur = moi.corps;
      if (moi.statut !== 200 || !utilisateur || typeof utilisateur !== 'object' || !SNOWFLAKE.test(String(utilisateur.id ?? ''))) {
        journal?.(`connexion : profil refusé par Discord (${moi.statut})`);
        return echec('discord');
      }
      // un compte bot ou système n'est jamais écrit (R310 (2))
      if (utilisateur.bot === true || utilisateur.system === true) {
        journal?.('connexion : compte bot ou système refusé (403), rien d’écrit');
        return { interdit: true, cookies: retire };
      }
      // l'appartenance : 404 ou 403 = non membre (observateur) ; toute autre panne (Discord, délai, limite d'appels) arrête la connexion : jamais un niveau
      // déduit d'une panne, jamais une ligne écrite d'après elle
      const membre = await appeler(`${API_DISCORD}/users/@me/guilds/${r.serveur}/member`, { entetes: acces });
      let objetMembre = null;
      if (membre.statut === 200 && membre.corps && typeof membre.corps === 'object') objetMembre = membre.corps;
      else if (membre.statut !== 404 && membre.statut !== 403) {
        journal?.(`connexion : appartenance au serveur illisible (${membre.statut})`);
        return echec('discord');
      }
      const maintenant = horloge();
      const niveau = niveauDuMembre({ membre: objetMembre, roles: r.roles, maintenant });
      const instant = new Date(maintenant).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const exp = maintenantS() + dureeS;
      // `v` : le niveau vient d'être vérifié (R314) ; `d` : l'identifiant Discord d'un membre, pour l'autre site (R315)
      const poser = (u, niveauDeLaSession, d = null) => ({
        location: retour,
        cookies: [...cookiesPour(r, creerJetonDeSession(r.secret_de_session, marquer(r, { u, n: niveauDeLaSession, exp, v: maintenantS() }, d)), securise, dureeS), ...retire],
      });
      // R312 : on n'arrive ici que sur un 200, 404 ou 403 de l'appel membre ; la session d'un non-membre reste celle d'un Observateur, sans identifiant de compte.
      if (!objetMembre) {
        effacerLeNonMembre(effacer, utilisateur.id, 'non-membre');
        journal?.(`connexion : observateur sans compte (non-membre, session de ${dureeS / 3600} h)`);
        return poser(null, 'observateur');
      }
      const profil = {
        discord_id: String(utilisateur.id),
        nom_affichage: nomAffiche({ membre: objetMembre, utilisateur }),
        niveau,
        avatar_url: adresseDAvatar({ membre: objetMembre, utilisateur, serveur: r.serveur }),
        banniere_url: adresseDeBanniere({ membre: objetMembre, utilisateur, serveur: r.serveur }),
        serveur_rejoint_le: instantDeDiscord(objetMembre.joined_at),
        instant,
      };
      let id;
      try {
        id = enregistrer(profil);
      } catch (e) {
        journal?.(`connexion : compte non écrit (${e?.message ?? e})`);
        return echec('indisponible');
      }
      journal?.(`connexion : ${niveau} (utilisateur ${id}, session de ${dureeS / 3600} h)`);
      return poser(id, niveau, utilisateur.id);
    } catch (e) {
      if (e instanceof ErreurDeConnexion) {
        journal?.(`connexion : ${e.message}`);
        return echec(e.code);
      }
      throw e;
    } finally {
      await revoquer(r, jetons); // le jeton Discord ne sert qu'à cette connexion (R310 (5))
    }
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------
  // La revérification du niveau pendant la session (R314)
  // -------------------------------------------------------------------------------------------------------------------------------------------
  let pauseJusqua = 0; // ms : aucun appel au bot avant cet instant (échec récent)
  let dernierEchec = null; // la cause du dernier échec noté au journal : une ligne par épisode, pas une par requête
  const recents = new Map(); // u -> { session, jeton } : le dernier résultat réussi (≤ 5 min), pour les requêtes qui arrivent avec l'ancien cookie
  const enCours = new Map(); // u -> promesse partagée : une seule revérification à la fois par personne

  function oublierLesPerimes() {
    const limite = maintenantS() - INTERVALLE_DE_REVERIFICATION_S;
    for (const [u, r] of recents) if (r.session.v <= limite) recents.delete(u);
    while (recents.size > RESULTATS_RECENTS_MAX) recents.delete(recents.keys().next().value);
  }

  /**
   * Un échec : le niveau de la session est gardé, une pause globale avant tout nouvel appel, une ligne au journal par épisode (jamais le jeton ni l'identifiant Discord).
   * `qui` : la session en cause, pour le journal (« utilisateur <id du site> », ou une session venue de l'autre site, R315).
   */
  function echecDeLaVerification(qui, cle, texte, pauseS = PAUSE_APRES_ECHEC_S) {
    const s = Math.min(Math.max(pauseS, PAUSE_APRES_ECHEC_S), PAUSE_MAX_S);
    pauseJusqua = Math.max(pauseJusqua, horloge() + s * 1000);
    if (dernierEchec !== cle) journal?.(`connexion : revérification du niveau impossible (${texte}, ${qui}) : le niveau de la session est gardé, aucun nouvel appel avant ${Math.round(s / 60)} min`);
    dernierEchec = cle;
    return null;
  }

  /**
   * L'appel au bot pour le membre `discordId` : { membre } (200 : l'objet membre), { depart: true } (404 de code 10007 : le seul constat de départ), ou null après un
   * échec (noté, pause posée).
   */
  async function membreParLeBot(r, discordId, qui) {
    let rep;
    try {
      rep = await appeler(`${API_DISCORD}/guilds/${r.serveur}/members/${discordId}`, { entetes: { Authorization: `Bot ${r.jeton_du_bot}`, 'User-Agent': 'MaverickCenter (niveaux)' } });
    } catch (e) {
      return echecDeLaVerification(qui, 'reseau', e instanceof ErreurDeConnexion ? e.message : 'appel à Discord impossible');
    }
    // Codes d'erreur JSON de Discord : https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
    //   10007 Unknown Member (la personne a quitté le serveur : le seul constat de départ), 10004 Unknown Guild (serveur mal réglé), 10013 Unknown User,
    //   50001 Missing Access (le bot n'est pas dans le serveur) ; 401 jeton du bot refusé ; 429 limite d'appels (`retry_after` en secondes).
    const code = rep.corps && typeof rep.corps === 'object' ? rep.corps.code : null;
    if (rep.statut === 200 && rep.corps && typeof rep.corps === 'object' && !Array.isArray(rep.corps) && (rep.corps.user?.id === undefined || String(rep.corps.user.id) === String(discordId))) {
      if (dernierEchec) journal?.('connexion : revérification du niveau rétablie');
      dernierEchec = null;
      return { membre: rep.corps };
    }
    if (rep.statut === 404 && code === 10007) {
      dernierEchec = null;
      return { depart: true };
    }
    if (rep.statut === 401) return echecDeLaVerification(qui, '401', 'jeton du bot refusé par Discord (401)');
    if (rep.statut === 403) return echecDeLaVerification(qui, `403:${code}`, `accès refusé (403, code ${code ?? '?'} : le bot est-il dans le serveur ?)`);
    if (rep.statut === 404) return echecDeLaVerification(qui, `404:${code}`, `réponse 404 sans départ constaté (code ${code ?? '?'})`);
    if (rep.statut === 429) {
      const attente = Math.ceil(Number(rep.corps?.retry_after ?? rep.retryApres));
      return echecDeLaVerification(qui, '429', 'limite d’appels (429)', Number.isFinite(attente) ? attente : PAUSE_APRES_ECHEC_S);
    }
    if (rep.statut >= 500) return echecDeLaVerification(qui, '5xx', `Discord indisponible (${rep.statut})`);
    return echecDeLaVerification(qui, `reponse:${rep.statut}`, `réponse inattendue (${rep.statut})`);
  }

  /** L'appel au bot pour une session ; rend { session, jeton } (nouvelle session signée) ou null (rien ne change). Ne rejette jamais. */
  async function verifier(s, r, { discordIdDe, mettreAJour, effacer }) {
    const qui = `utilisateur ${s.u}`;
    try {
      const discordId = discordIdDe(s.u);
      if (!discordId) {
        // compte introuvable : effacé depuis (départ constaté sur un autre appareil, R312) : la session devient Observateur sans compte, sans appel à Discord (R314)
        const v = Math.floor(horloge() / 1000);
        if (s.exp <= v) return null;
        journal?.(`connexion : observateur sans compte (utilisateur ${s.u} introuvable, compte effacé depuis, session gardée jusqu'à son terme)`);
        const session = marquer(r, { u: null, n: 'observateur', exp: s.exp, v });
        return { session, jeton: creerJetonDeSession(r.secret_de_session, session) };
      }
      if (!SNOWFLAKE.test(String(discordId))) return null; // identifiant Discord invalide : rien ne change
      const lu = await membreParLeBot(r, discordId, qui);
      if (!lu) return null;
      const maintenant = horloge();
      const nouvelle = (u, n, d = null) => {
        const session = marquer(r, { u, n, exp: s.exp, v: Math.floor(maintenant / 1000) }, d);
        return session.exp > session.v ? { session, jeton: creerJetonDeSession(r.secret_de_session, session) } : null;
      };
      if (lu.membre) {
        const niveau = niveauDuMembre({ membre: lu.membre, roles: r.roles, maintenant });
        try {
          mettreAJour(s.u, niveau);
        } catch (e) {
          journal?.(`connexion : niveau revérifié non écrit (utilisateur ${s.u} : ${e?.message ?? e})`);
        }
        if (niveau !== s.n) journal?.(`connexion : niveau revérifié ${s.n} -> ${niveau} (utilisateur ${s.u})`);
        return nouvelle(s.u, niveau, discordId);
      }
      effacerLeNonMembre(effacer, discordId, 'départ du serveur constaté');
      journal?.(`connexion : observateur sans compte (utilisateur ${s.u} a quitté le serveur, session gardée jusqu'à son terme)`);
      return nouvelle(null, 'observateur');
    } catch (e) {
      return echecDeLaVerification(qui, 'exception', `erreur inattendue : ${e?.message ?? e}`);
    }
  }

  /**
   * R315 : la session d'un membre venue de l'autre site devient une session de ce site. Le bot relit le membre ; son compte est retrouvé ou créé par son identifiant
   * Discord (`enregistrer`, comme au retour de Discord) et son niveau calculé avec la correspondance des rôles de CE site ; un départ constaté se traite comme à la
   * connexion (R312 (1)). L'expiration est gardée, sans dépasser la durée des sessions de ce site. Rend { session, jeton } ou null (la session ne vaut rien ici). Ne
   * rejette jamais.
   */
  async function accueillir(a, r, { enregistrer, effacer }) {
    const qui = 'session venue de l’autre site';
    try {
      const lu = await membreParLeBot(r, a.d, qui);
      if (!lu) return null;
      const maintenant = horloge();
      const v = Math.floor(maintenant / 1000);
      const exp = Math.min(a.exp, v + dureeS);
      if (exp <= v) return null;
      const nouvelle = (u, n, d = null) => {
        const session = marquer(r, { u, n, exp, v }, d);
        return { session, jeton: creerJetonDeSession(r.secret_de_session, session) };
      };
      if (lu.depart) {
        effacerLeNonMembre(effacer, a.d, 'départ du serveur constaté');
        journal?.(`connexion : observateur sans compte (${qui} : départ du serveur constaté)`);
        return nouvelle(null, 'observateur');
      }
      const membre = lu.membre;
      const utilisateur = membre.user;
      // le profil se lit comme au retour de Discord ; un compte bot ou système n'est jamais écrit (R310 (2))
      if (!utilisateur || typeof utilisateur !== 'object' || String(utilisateur.id) !== a.d) {
        journal?.(`connexion : ${qui} non acceptée (membre lu sans son compte Discord)`);
        return null;
      }
      if (utilisateur.bot === true || utilisateur.system === true) {
        journal?.(`connexion : ${qui} non acceptée (compte bot ou système), rien d’écrit`);
        return null;
      }
      const niveau = niveauDuMembre({ membre, roles: r.roles, maintenant });
      let id;
      try {
        id = enregistrer({
          discord_id: a.d,
          nom_affichage: nomAffiche({ membre, utilisateur }),
          niveau,
          avatar_url: adresseDAvatar({ membre, utilisateur, serveur: r.serveur }),
          banniere_url: adresseDeBanniere({ membre, utilisateur, serveur: r.serveur }),
          serveur_rejoint_le: instantDeDiscord(membre.joined_at),
          instant: new Date(maintenant).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        });
      } catch (e) {
        journal?.(`connexion : ${qui}, compte non écrit (${e?.message ?? e})`);
        return null;
      }
      journal?.(`connexion : ${niveau} (utilisateur ${id}, ${qui})`);
      return nouvelle(id, niveau, a.d);
    } catch (e) {
      return echecDeLaVerification(qui, 'exception', `erreur inattendue : ${e?.message ?? e}`);
    }
  }

  /**
   * R315 : la conversion de la session venue de l'autre site, si elle existe. Mêmes garde-fous que `reverifier` (pause après un échec, base absente ou gelée) ; une
   * conversion récente (≤ 5 min) de la même session se redonne sans nouvel appel (les requêtes parties avec l'ancien cookie, le forward_auth du site de dev).
   */
  function convertir(entetes, r, rappels) {
    const a = sessionDeLAutreSite(entetes);
    if (!a || typeof rappels.enregistrer !== 'function') return null;
    const securise = connexionSecurisee(entetes);
    const cle = `d:${a.d}`;
    const source = `${a.i}:${a.exp}:${a.v ?? ''}`;
    const fin = (res) => {
      const reste = res ? res.session.exp - maintenantS() : 0;
      return reste > 0 ? { session: res.session, jeton: res.jeton, cookies: cookiesPour(r, res.jeton, securise, reste) } : null;
    };
    const recent = recents.get(cle);
    if (recent && recent.source === source && maintenantS() - recent.session.v < INTERVALLE_DE_REVERIFICATION_S) return fin(recent);
    if (horloge() < pauseJusqua) return null;
    if (rappels.permis && !rappels.permis()) return null;
    let promesse = enCours.get(cle);
    if (!promesse) {
      promesse = accueillir(a, r, rappels).then((res) => {
        if (res) {
          recents.delete(cle);
          recents.set(cle, { ...res, source });
          oublierLesPerimes();
        }
        return res;
      }).finally(() => enCours.delete(cle));
      enCours.set(cle, promesse);
    }
    return promesse.then(fin);
  }

  /**
   * R314 : revérifie le niveau de la session des en-têtes auprès de Discord, par le bot de l'application. Rend `null` tout de suite (sans promesse) quand il n'y a rien à
   * faire : pas de jeton de bot, pas de session, session sans compte, session vérifiée il y a moins de 5 minutes, pause après un échec. Sinon un résultat
   * `{ session, jeton, cookies }` (le cookie réémis, même `exp`), ou une promesse qui n'est jamais rejetée et rend ce résultat ou `null` (rien ne change : le niveau est gardé).
   * R315 : sans session de ce site, la session d'un membre venue de l'autre site (connexion commune) est convertie (`convertir`).
   * @param {object} entetes les en-têtes de la requête
   * @param {{ discordIdDe: (u: string) => string|null, mettreAJour: (u: string, niveau: string) => void, effacer: (discordId: string) => object, permis?: () => boolean,
   *   enregistrer?: (profil: object) => string }} rappels
   *   `permis` : faux quand la base est absente ou que les écritures sont gelées (rien ne se fait alors) ; `enregistrer` : comme au retour de Discord (R315)
   */
  function reverifier(entetes = {}, rappels) {
    const r = reglage();
    if (!r?.jeton_du_bot) return null;
    const s = session(entetes);
    if (!s) return r.domaine_commun ? convertir(entetes, r, rappels) : null;
    if (s.u === null) return null;
    const maintenant = maintenantS();
    const securise = connexionSecurisee(entetes);
    // le résultat appliqué à une session garde toujours SON expiration : la promesse est partagée par les sessions d'une même personne (autres appareils)
    const fin = (res) => {
      if (!res) return null;
      let { session, jeton } = res;
      if (session.exp !== s.exp) {
        if (s.exp <= session.v) return null;
        session = { ...session, exp: s.exp };
        jeton = creerJetonDeSession(r.secret_de_session, session);
      }
      return { session, jeton, cookies: cookiesPour(r, jeton, securise, session.exp - maintenantS()) };
    };
    const recent = recents.get(s.u);
    // une revérification récente de cette session : une requête qui arrive avec l'ancien cookie reçoit son résultat, sans nouvel appel
    if (recent && recent.session.exp === s.exp && recent.session.v > (s.v ?? -1) && maintenant - recent.session.v < INTERVALLE_DE_REVERIFICATION_S) return fin(recent);
    if (s.v !== undefined && maintenant - s.v < INTERVALLE_DE_REVERIFICATION_S) return null;
    if (horloge() < pauseJusqua) return null;
    if (rappels.permis && !rappels.permis()) return null; // la base est absente ou gelée : ni appel à Discord ni écriture
    let promesse = enCours.get(s.u);
    if (!promesse) {
      promesse = verifier(s, r, rappels).then((res) => {
        if (res) {
          recents.delete(s.u); // réinsérée en dernier : l'ordre de la Map est celui des résultats
          recents.set(s.u, res);
          oublierLesPerimes();
        }
        return res;
      }).finally(() => enCours.delete(s.u));
      enCours.set(s.u, promesse);
    }
    return promesse.then(fin);
  }

  return { lire, disponible, session, commencer, terminer, reverifier, cookiesDeDeconnexion, dureeS, maintenantS, instance };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La commande de l'hôte (deploy/installateur/discord/discord.sh), exécutée dans le conteneur :
// `node -e "import(…discord.mjs).then((m) => m.lancerLaCommande(process.argv.slice(1)))" -- <action> …`.
// Le secret de l'application arrive par l'entrée standard (première ligne), jamais en argument ; le fichier est écrit par l'hôte (secrets/ est en lecture
// seule ici). Sortie : « REGLAGE <json> » (le contenu du fichier à écrire).
// ---------------------------------------------------------------------------------------------------------------------------------------------

async function lireEntree(entree) {
  const morceaux = [];
  for await (const m of entree) morceaux.push(m);
  return Buffer.concat(morceaux).toString('utf8');
}

/**
 * @param {string[]} argv `definir <identifiant> <adresse de retour> [<serveur>]` (le secret sur l'entrée) | `role <identifiant de rôle>… joueur|mj|createur` (un ou plusieurs rôles, le niveau en dernier) | `sans-role <identifiant>`
 *   | `serveur <identifiant>` | `nouvelle-session` | `bot` (le jeton du bot sur l'entrée, R314) | `sans-bot`
 *   | `commune <domaine>` (R315 : le secret de session de l'autre site sur l'entrée) | `sans-commune`
 * @param {{ entree?: AsyncIterable<Buffer>, sortie?: (ligne: string) => void, erreur?: (ligne: string) => void, fichier?: string, maintenant?: Date }} [o]
 * @returns {Promise<number>} le code de sortie
 */
export async function commandeDiscord(argv, { entree = process.stdin, sortie = (l) => console.log(l), erreur = (l) => process.stderr.write(`${l}\n`), fichier = process.env.MAVERICK_DISCORD_FICHIER || FICHIER_PAR_DEFAUT, maintenant = new Date() } = {}) {
  const [action, ...options] = argv;
  let ancien = null;
  let illisible = false;
  try {
    ancien = JSON.parse(readFileSync(fichier, 'utf8'));
  } catch (e) {
    if (e?.code !== 'ENOENT') illisible = true;
  }
  const intact = (() => {
    try {
      return ancien ? validerReglage(ancien) : null;
    } catch {
      return null;
    }
  })();
  try {
    let demande;
    if (action === 'definir') {
      const [clientId, adresseDeRetour, serveur] = options;
      const secret = (await lireEntree(entree)).split('\n')[0].replace(/\r$/, '');
      demande = { ancien: intact, definir: { clientId, clientSecret: secret, adresseDeRetour, serveur: serveur || undefined } };
    } else if (action === 'role') {
      demande = { ancien: intact, role: { ids: options.slice(0, -1), niveau: options.at(-1) } };
    } else if (action === 'sans-role') {
      demande = { ancien: intact, sansRole: options[0] ?? '' };
    } else if (action === 'serveur') {
      demande = { ancien: intact, serveur: options[0] ?? '' };
    } else if (action === 'nouvelle-session') {
      demande = { ancien: intact, nouvelleSession: true };
    } else if (action === 'bot') {
      // R314 : le jeton du bot arrive sur l'entrée standard (première ligne), jamais en argument, comme le secret de l'application
      demande = { ancien: intact, jetonDuBot: (await lireEntree(entree)).split('\n')[0].replace(/\r$/, '') };
    } else if (action === 'sans-bot') {
      demande = { ancien: intact, sansBot: true };
    } else if (action === 'commune') {
      // R315 : le secret de session de l'autre site arrive sur l'entrée standard (première ligne), jamais en argument, comme les autres secrets : le cookie commun se lit
      // alors sur les deux sites
      demande = { ancien: intact, domaineCommun: options[0] ?? '', secretDeSession: (await lireEntree(entree)).split('\n')[0].replace(/\r$/, '') };
    } else if (action === 'sans-commune') {
      demande = { ancien: intact, sansDomaineCommun: true };
    } else {
      throw new Error('commande inconnue (definir, role, sans-role, serveur, nouvelle-session, bot, sans-bot, commune, sans-commune)');
    }
    if ((ancien || illisible) && !intact && action !== 'definir') throw new Error('le réglage actuel est illisible : posez-le de nouveau (commande sans option)');
    sortie(`REGLAGE ${JSON.stringify(reglageApres({ ...demande, maintenant }))}`);
    return 0;
  } catch (e) {
    erreur(`ERREUR : ${e.message}`);
    return 1;
  }
}

/** Pour `node -e` : lance la commande avec les arguments de la ligne, et fixe le code de sortie du processus. */
export async function lancerLaCommande(argv) {
  process.exitCode = await commandeDiscord(argv);
}
