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
// La session est un cookie signé (HMAC-SHA256) `maverick_session` : « v1.<charge base64url { u, n, exp }>.<signature> », sans révocation côté serveur
// (se déconnecter = retirer le cookie ; `discord.sh --nouvelle-session` change le secret et ferme toutes les sessions). Le niveau de la porte du site de dev
// est celui du cookie (docs/serveur.md, « Accès au site de dev »). 12 h sur le site de dev (le niveau donne des droits), 7 jours en production.
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
export const RETOUR_PAR_DEFAUT = '/profil/';
/** Les codes d'erreur de `/connexion/?erreur=<code>` : refus (l'utilisateur a refusé), indisponible, discord (Discord a échoué), etat (état OAuth faux ou périmé). */
export const CODES_D_ERREUR = Object.freeze(['refus', 'indisponible', 'discord', 'etat']);

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

/** Le jeton d'une session : `u` l'identifiant de l'utilisateur du site, `n` son niveau, `exp` l'expiration (secondes depuis 1970). */
export const creerJetonDeSession = (secret, { u, n, exp }) => signer(secret, 'session', { u, n, exp });

/** La session d'un jeton bien signé, valide et pas encore expiré : { u, n, exp } (`u` null : sans compte), sinon null. */
export function lireJetonDeSession(secret, jeton, maintenantS) {
  const c = lireSigne(secret, 'session', jeton);
  // `u` : l'identifiant du site, ou null pour un non-membre du serveur (R312 : aucun compte n'est gardé, la session n'est qu'Observateur)
  if (!c || !(c.u === null || (typeof c.u === 'string' && c.u && c.u.length <= 100)) || !estUnNiveau(c.n) || !Number.isInteger(c.exp) || c.exp <= maintenantS) return null;
  return { u: c.u, n: c.n, exp: c.exp };
}

const attributs = (chemin, securise, duree) => `; Path=${chemin}; HttpOnly; SameSite=Lax${duree === null ? '' : `; Max-Age=${duree}`}${securise ? '; Secure' : ''}`;
const RETIRE = '; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
/** L'en-tête Set-Cookie d'une session ouverte. */
export const cookieDeSession = (jeton, { securise, dureeS }) => `${COOKIE_SESSION}=${jeton}${attributs('/', securise, dureeS)}`;
/** L'en-tête Set-Cookie qui retire la session. */
export const cookieDeSessionRetire = ({ securise }) => `${COOKIE_SESSION}=; Max-Age=0${RETIRE}${attributs('/', securise, null)}`;
/** Le cookie de l'état OAuth : court (10 min), limité aux routes de connexion ; SameSite=Lax le laisse accompagner le retour de Discord (navigation de haut niveau). */
export const cookieDeLEtat = (jeton, { securise }) => `${COOKIE_ETAT}=${jeton}${attributs('/api/connexion/', securise, DUREE_DE_L_ETAT_S)}`;
export const cookieDeLEtatRetire = ({ securise }) => `${COOKIE_ETAT}=; Max-Age=0${RETIRE}${attributs('/api/connexion/', securise, null)}`;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le réglage (secrets/discord.json)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const HEX64 = /^[0-9a-f]{64}$/;

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
  return {
    version: 1,
    client_id: String(o.client_id),
    client_secret: secret,
    serveur: String(o.serveur),
    adresse_de_retour: adresse,
    roles,
    secret_de_session: o.secret_de_session,
    pose_le: typeof o.pose_le === 'string' ? o.pose_le.slice(0, 40) : null,
  };
}

/**
 * Le réglage qui suit une commande de l'hôte. `definir` (identifiant, secret, adresse de retour, serveur) pose ou change l'application et garde les rôles et
 * les sessions ; `role` / `sansRole` changent la correspondance ; `serveur` en change l'identifiant ; `nouvelleSession` renouvelle le secret des sessions.
 * @param {{ ancien?: object|null, definir?: { clientId: string, clientSecret: string, adresseDeRetour: string, serveur?: string }, role?: { id?: string, ids?: string[], niveau: string },
 *   sansRole?: string, serveur?: string, nouvelleSession?: boolean, maintenant?: Date }} o
 */
export function reglageApres({ ancien = null, definir = null, role = null, sansRole = null, serveur = null, nouvelleSession = false, maintenant = new Date() }) {
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
  if (nouvelleSession || !base.secret_de_session) suivant.secret_de_session = randomBytes(32).toString('hex');
  suivant.pose_le = maintenant.toISOString();
  return validerReglage(suivant);
}

/** Le réglage résumé SANS secret : pour `--etat` et les journaux. */
export function resumeDuReglage(reglage) {
  return { client_id: reglage.client_id, serveur: reglage.serveur, adresse_de_retour: reglage.adresse_de_retour, roles: { ...reglage.roles }, pose_le: reglage.pose_le };
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
      journal?.(`connexion : réglage Discord relu (serveur ${reglage.serveur}, ${Object.keys(reglage.roles).length} rôle(s) de niveau)`);
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

  /** La session portée par les en-têtes d'une requête : { u, n, exp } ou null. */
  function session(entetes = {}) {
    const secret = reglage()?.secret_de_session;
    if (!secret) return null;
    for (const jeton of valeursDuCookie(entetes.cookie, COOKIE_SESSION)) {
      const s = lireJetonDeSession(secret, jeton, maintenantS());
      if (s) return s;
    }
    return null;
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
    return { statut: reponse.status, corps };
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
      const poser = (u, niveauDeLaSession) => ({ location: retour, cookies: [cookieDeSession(creerJetonDeSession(r.secret_de_session, { u, n: niveauDeLaSession, exp }), { securise, dureeS }), ...retire] });
      // R312 : le compte d'un non-membre ne se garde pas. Il est effacé s'il existe (jamais sur une panne : on n'arrive ici que sur un 200, 404 ou 403 de l'appel membre),
      // jamais créé ; la session reste celle d'un Observateur, sans identifiant de compte. Un effacement refusé (référence sans cascade) ou en échec laisse le compte,
      // est noté au journal (identifiant du site seulement) et ne bloque pas la connexion.
      if (!objetMembre) {
        try {
          const e = effacer ? effacer(String(utilisateur.id)) : { id: null, efface: false, bloque: [] };
          if (e.efface) journal?.(`connexion : non-membre, compte ${e.id} effacé (R312)`);
          else if (e.bloque.length) journal?.(`connexion : non-membre, compte ${e.id} NON effacé : référencé par ${e.bloque.join(', ')} (R312, R313 : état provisoire jusqu'à E8, où les fiches resteront sans propriétaire)`);
        } catch (e) {
          journal?.(`connexion : non-membre, effacement du compte impossible (${e?.message ?? e})`);
        }
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
      return poser(id, niveau);
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

  return { lire, disponible, session, commencer, terminer, dureeS, maintenantS };
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
 *   | `serveur <identifiant>` | `nouvelle-session`
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
    } else {
      throw new Error('commande inconnue (definir, role, sans-role, serveur, nouvelle-session)');
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
