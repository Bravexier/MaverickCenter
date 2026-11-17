// Accès au site de dev (docs/serveur.md, « Accès au site de dev » ; chantier docs/chantier-base-de-dev.md, lot 4 ; décision R275, question 2, option b) :
// « Un mot de passe pour modifier et pour lancer une mise à jour ; la lecture reste ouverte. » La portée « tout » (option c : un mot de passe pour tout le
// site) est le même réglage, un autre mot : même mot de passe, une seule saisie.
//
// Le réglage est un fichier du dossier secrets/ de l'instance (monté en lecture seule dans le conteneur, comme le jeton GitHub) : acces.json, écrit par
// la commande de l'hôte (deploy/installateur/acces/acces.sh, qui appelle `commandeAcces` ci-dessous dans le conteneur pour hacher le mot de passe sans
// qu'il passe jamais en argument). Absent : tout reste ouvert, comme avant. Présent : seul le site de dev (édition) le lit ; la production n'est jamais
// concernée. Présent mais illisible ou invalide : le site de dev reste FERMÉ (aucune connexion possible) jusqu'à ce que la commande de l'hôte le refasse.
//
// Le fichier ne contient aucun secret en clair : l'empreinte scrypt du mot de passe (avec son sel), l'empreinte SHA-256 de la clé de lecture, et un secret
// de session (renouvelé à chaque changement de mot de passe ou de portée : les sessions ouvertes tombent). Les comparaisons se font à temps constant.
//
// Le service ne voit jamais d'en-tête Authorization (Caddy le remplace, nginx l'efface : docs/serveur.md, « Hébergement ») : la clé de lecture voyage dans
// X-Maverick-Cle (ou son second nom X-Maverick-Key), la session du navigateur dans un cookie. Jamais dans l'adresse (le journal la noterait).
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { classer } from './acces-routes.mjs';

/** Le fichier de réglage dans le conteneur (le dossier secrets/ de l'instance y est monté en lecture seule). */
export const FICHIER_PAR_DEFAUT = '/secrets/acces.json';
export const COOKIE = 'maverick_acces';
export const ENTETE_CLE = 'x-maverick-cle';
/**
 * Les seuls en-têtes qui portent la clé de lecture : X-Maverick-Cle, et son second nom X-Maverick-Key (le formulaire sûr qui remet la clé aux sessions
 * de Claude n'accepte qu'un nom d'en-tête finissant par « key », « token »…). Tout autre en-tête, ou l'adresse, n'ouvre rien.
 */
export const ENTETES_CLE = Object.freeze([ENTETE_CLE, 'x-maverick-key']);
export const PREFIXE_DE_LA_CLE = 'mvk_';
/** Durée d'une session ouverte par le mot de passe. Le cookie n'a pas de date : il part avec le navigateur ; le jeton, lui, expire. */
export const DUREE_SESSION_S = 12 * 3600;
export const MOT_DE_PASSE_MIN = 10;
export const MOT_DE_PASSE_MAX = 200;
/** Essais de mot de passe ratés : par source (première adresse de X-Forwarded-For), puis tous ensemble ; au-delà, 429 jusqu'à la fin de la fenêtre. */
export const LIMITES = Object.freeze({ essais: 5, global: 60, fenetre_s: 600, sources_max: 500 });
const SCRYPT = Object.freeze({ n: 16384, r: 8, p: 1, longueur: 32, memoire: 64 * 1024 * 1024 });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Secrets : mot de passe, clé de lecture, jeton de session
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Égalité à temps constant de deux textes (comparés par leur empreinte : la longueur ne fuit pas). */
export function egaux(a, b) {
  const h = (x) => createHash('sha256').update(String(x)).digest();
  return timingSafeEqual(h(a), h(b));
}

/** L'empreinte scrypt d'un mot de passe : { algo, n, r, p, sel, empreinte } (sel tiré au hasard sauf s'il est donné). */
export function empreinteDuMotDePasse(motDePasse, { sel = randomBytes(16).toString('hex'), n = SCRYPT.n, r = SCRYPT.r, p = SCRYPT.p } = {}) {
  const e = scryptSync(String(motDePasse).normalize('NFC'), Buffer.from(sel, 'hex'), SCRYPT.longueur, { N: n, r, p, maxmem: SCRYPT.memoire });
  return { algo: 'scrypt', n, r, p, sel, empreinte: e.toString('hex') };
}

export function motDePasseValable(motDePasse, enregistre) {
  if (typeof motDePasse !== 'string' || !motDePasse || motDePasse.length > MOT_DE_PASSE_MAX) return false;
  try {
    return egaux(empreinteDuMotDePasse(motDePasse, enregistre).empreinte, enregistre.empreinte);
  } catch {
    return false;
  }
}

/** Une clé de lecture neuve : 32 octets au hasard (assez pour qu'un SHA-256 suffise : rien à deviner). */
export const nouvelleCle = () => `${PREFIXE_DE_LA_CLE}${randomBytes(32).toString('base64url')}`;
export const empreinteDeLaCle = (cle) => createHash('sha256').update(String(cle)).digest('hex');

const signature = (secret, exp) => createHmac('sha256', secret).update(`v1.${exp}`).digest('hex');
/** Le jeton d'une session qui expire à `exp` (secondes depuis 1970) : « v1.<exp>.<HMAC-SHA256> ». */
export const creerJeton = (secret, exp) => `v1.${exp}.${signature(secret, exp)}`;
/** L'expiration (secondes) d'un jeton bien signé et pas encore expiré, sinon null. */
export function lireJeton(secret, jeton, maintenantS) {
  const m = /^v1\.(\d{1,12})\.([0-9a-f]{64})$/.exec(String(jeton ?? ''));
  if (!m || !secret) return null;
  const exp = Number(m[1]);
  return egaux(signature(secret, exp), m[2]) && exp > maintenantS ? exp : null;
}

/** Les valeurs du cookie `nom` d'un en-tête Cookie (un navigateur peut en envoyer plusieurs de même nom, de chemins différents). */
export function valeursDuCookie(entete, nom = COOKIE) {
  const valeurs = [];
  for (const morceau of String(entete ?? '').split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) valeurs.push(morceau.slice(i + 1).trim());
  }
  return valeurs;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le réglage (secrets/acces.json)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const HEX = (n) => new RegExp(`^[0-9a-f]{${n}}$`);

/** Le réglage vérifié (même forme, champs inconnus retirés), ou une erreur qui dit ce qui ne va pas. */
export function validerReglage(brut) {
  const o = brut && typeof brut === 'object' ? brut : null;
  if (!o) throw new Error('réglage illisible');
  if (o.version !== 1) throw new Error(`version de réglage inconnue (${JSON.stringify(o.version)})`);
  if (!['ecriture', 'tout'].includes(o.portee)) throw new Error('portée inconnue (ecriture ou tout)');
  const m = o.mot_de_passe;
  if (!m || m.algo !== 'scrypt' || !HEX(32).test(m.sel ?? '') || !HEX(64).test(m.empreinte ?? '')
    || ![m.n, m.r, m.p].every((x) => Number.isInteger(x) && x > 0 && x <= 1 << 20)) throw new Error('empreinte du mot de passe invalide');
  if (!HEX(64).test(o.secret_de_session ?? '')) throw new Error('secret de session invalide');
  const cle = o.cle_de_lecture;
  if (cle !== null && cle !== undefined && !HEX(64).test(cle.empreinte ?? '')) throw new Error('empreinte de la clé de lecture invalide');
  return {
    version: 1,
    portee: o.portee,
    mot_de_passe: { algo: 'scrypt', n: m.n, r: m.r, p: m.p, sel: m.sel, empreinte: m.empreinte },
    cle_de_lecture: cle ? { empreinte: cle.empreinte } : null,
    secret_de_session: o.secret_de_session,
    pose_le: typeof o.pose_le === 'string' ? o.pose_le.slice(0, 40) : null,
  };
}

/**
 * Le réglage qui suit une commande de l'hôte : { reglage, cle } (`cle` : la clé de lecture neuve en clair, à montrer une seule fois, sinon null).
 * Avec un mot de passe : il est posé (ou changé), le secret de session est renouvelé, la portée et la clé de lecture sont gardées ; sans clé de lecture
 * encore, une est faite. Sans mot de passe : `ancien` est requis ; `refaireLaCle` en fabrique une neuve (l'ancienne ne marche plus) ; changer la
 * portée renouvelle le secret de session (un cookie d'un autre chemin ne survit pas).
 */
export function reglageApres({ ancien = null, motDePasse = null, portee = null, refaireLaCle = false, maintenant = new Date() }) {
  if (portee !== null && !['ecriture', 'tout'].includes(portee)) throw new Error('portée inconnue (ecriture ou tout)');
  if (motDePasse === null && !ancien) throw new Error('aucun mot de passe n’est posé : lancez d’abord la commande sans option pour en poser un');
  if (motDePasse !== null) {
    if (typeof motDePasse !== 'string' || motDePasse.length < MOT_DE_PASSE_MIN) throw new Error(`mot de passe trop court (${MOT_DE_PASSE_MIN} caractères au moins)`);
    if (motDePasse.length > MOT_DE_PASSE_MAX || /[\r\n\0]/.test(motDePasse)) throw new Error(`mot de passe refusé (${MOT_DE_PASSE_MAX} caractères au plus, sur une seule ligne)`);
  }
  const garde = ancien ? validerReglage(ancien) : null;
  const nouvelleCleEnClair = refaireLaCle || !garde?.cle_de_lecture ? nouvelleCle() : null;
  const portee2 = portee ?? garde?.portee ?? 'ecriture';
  const renouveler = motDePasse !== null || (garde && portee2 !== garde.portee);
  return {
    reglage: {
      version: 1,
      portee: portee2,
      mot_de_passe: motDePasse !== null ? empreinteDuMotDePasse(motDePasse) : garde.mot_de_passe,
      cle_de_lecture: nouvelleCleEnClair ? { empreinte: empreinteDeLaCle(nouvelleCleEnClair) } : garde.cle_de_lecture,
      secret_de_session: renouveler ? randomBytes(32).toString('hex') : garde.secret_de_session,
      pose_le: renouveler || nouvelleCleEnClair ? maintenant.toISOString() : garde.pose_le,
    },
    cle: nouvelleCleEnClair,
  };
}

/**
 * Le contrôle d'accès d'un service (site de dev) : relit le fichier `fichier` quand il change (date, inode, taille : jamais un redémarrage), garde les
 * essais ratés en mémoire, juge chaque requête. `journal` reçoit des lignes sans secret.
 * @param {{ fichier: string, horloge?: () => number, journal?: ((message: string) => void) | null }} o
 */
export function creerAcces({ fichier, horloge = () => Date.now(), journal = null }) {
  let vu = null; // { cle, reglage, invalide }
  const echecs = new Map(); // source → instants (ms) des essais ratés
  let echecsGlobaux = [];

  /** Le réglage courant : { reglage } posé, { invalide } illisible, null absent. */
  function lire() {
    let s;
    try {
      s = statSync(fichier);
    } catch (e) {
      if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') {
        if (vu) journal?.('accès : réglage retiré, le site de dev est ouvert');
        vu = null;
        return null;
      }
      return noter('illisible', `fichier illisible (${e?.code ?? 'erreur'})`);
    }
    const cle = `${s.mtimeMs}:${s.ino}:${s.size}`;
    if (vu?.cle === cle) return vu.etat;
    try {
      const reglage = validerReglage(JSON.parse(readFileSync(fichier, 'utf8')));
      vu = { cle, etat: { reglage } };
      journal?.(`accès : réglage relu (protégé, portée « ${reglage.portee} »)`);
    } catch (e) {
      vu = { cle, etat: { invalide: e?.message ?? 'réglage invalide' } };
      journal?.(`accès : réglage invalide (${vu.etat.invalide}) : le site de dev reste fermé jusqu'à ce que la commande de l'hôte le refasse`);
    }
    return vu.etat;
  }
  function noter(cle, raison) {
    if (vu?.cle !== cle) journal?.(`accès : réglage ${raison} : le site de dev reste fermé jusqu'à ce que la commande de l'hôte le refasse`);
    vu = { cle, etat: { invalide: raison } };
    return vu.etat;
  }

  const protege = () => lire() !== null;
  const portee = () => lire()?.reglage?.portee ?? 'ecriture';
  const maintenantS = () => Math.floor(horloge() / 1000);

  /** Le droit d'une requête : { droit: 'ecriture' (session) | 'lecture' (clé) | 'aucun', expire_s } ; sans réglage, tout est permis. */
  function droit(entetes = {}, etat = lire()) {
    if (etat === null) return { droit: 'ecriture', session: false, expire_s: null };
    const r = etat.reglage;
    if (!r) return { droit: 'aucun', session: false, expire_s: null };
    for (const jeton of valeursDuCookie(entetes.cookie)) {
      const exp = lireJeton(r.secret_de_session, jeton, maintenantS());
      if (exp) return { droit: 'ecriture', session: true, expire_s: exp };
    }
    for (const nom of ENTETES_CLE) {
      const cle = entetes[nom];
      if (typeof cle === 'string' && cle && r.cle_de_lecture && egaux(empreinteDeLaCle(cle), r.cle_de_lecture.empreinte)) return { droit: 'lecture', session: false, expire_s: null };
    }
    return { droit: 'aucun', session: false, expire_s: null };
  }

  /** Le classement d'une requête (méthode, adresse) d'après la portée posée. */
  const classement = (methode, adresse) => classer(methode, adresse, portee());

  /** null si la requête a le droit que demande sa route, sinon la réponse 401 qui dit ce qui manque (jamais une valeur de secret). */
  function controler(requete) {
    const etat = lire();
    if (etat === null) return null;
    const { classe } = classer(requete.methode, requete.chemin, etat.reglage?.portee ?? 'ecriture');
    if (classe === 'ouverte') return null;
    const { droit: d } = droit(requete.entetes ?? {}, etat);
    if (d === 'ecriture' || (d === 'lecture' && (classe === 'lecture' || classe === 'proposition'))) return null;
    return refus401(classe);
  }

  // --- connexion ---------------------------------------------------------------------------------------------------------------------------
  const source = (entetes = {}) => String(entetes['x-forwarded-for'] ?? '').split(',')[0].trim().slice(0, 64) || 'direct';
  const fenetre = () => horloge() - LIMITES.fenetre_s * 1000;
  function purger() {
    const limite = fenetre();
    for (const [cle, instants] of echecs) {
      const gardes = instants.filter((t) => t > limite);
      if (gardes.length) echecs.set(cle, gardes);
      else echecs.delete(cle);
    }
    echecsGlobaux = echecsGlobaux.filter((t) => t > limite);
  }
  /** Secondes à attendre si trop d'essais ont raté (source ou ensemble), sinon 0. */
  function attente(cle) {
    purger();
    const t = horloge();
    const d = (instants, max) => (instants.length >= max ? Math.max(1, Math.ceil((instants[0] + LIMITES.fenetre_s * 1000 - t) / 1000)) : 0);
    return Math.max(d(echecs.get(cle) ?? [], LIMITES.essais), d(echecsGlobaux, LIMITES.global));
  }

  /**
   * Un essai de connexion : { ok: true, jeton, expire_s } ou { ok: false, raison: 'mot_de_passe' | 'limite' | 'ferme' | 'ouvert', attente_s? }.
   * Un mot de passe faux compte contre sa source et contre l'ensemble.
   */
  function connecter(motDePasse, entetes = {}) {
    const etat = lire();
    if (etat === null) return { ok: false, raison: 'ouvert' };
    if (!etat.reglage) return { ok: false, raison: 'ferme' };
    const cle = source(entetes);
    const attendre = attente(cle);
    if (attendre) {
      journal?.('accès : trop d’essais refusés, connexion mise en attente');
      return { ok: false, raison: 'limite', attente_s: attendre };
    }
    if (!motDePasseValable(motDePasse, etat.reglage.mot_de_passe)) {
      if (!echecs.has(cle) && echecs.size >= LIMITES.sources_max) echecs.delete(echecs.keys().next().value);
      echecs.set(cle, [...(echecs.get(cle) ?? []), horloge()]);
      echecsGlobaux.push(horloge());
      journal?.('accès : mot de passe refusé');
      return { ok: false, raison: 'mot_de_passe' };
    }
    echecs.delete(cle);
    const exp = maintenantS() + DUREE_SESSION_S;
    journal?.(`accès : session ouverte (${DUREE_SESSION_S / 3600} h)`);
    return { ok: true, jeton: creerJeton(etat.reglage.secret_de_session, exp), expire_s: exp };
  }

  return { protege, portee, droit, controler, classement, connecter, lire };
}

/** La réponse 401 d'une route fermée : `acces` dit ce qui manque (« cle » : la clé de lecture OU le mot de passe ; « mot_de_passe » : lui seul). */
export function refus401(classe) {
  const lecture = classe === 'lecture' || classe === 'proposition';
  return {
    statut: 401,
    corps: { erreur: lecture ? 'Accès refusé : la clé de lecture ou le mot de passe est nécessaire.' : 'Accès refusé : le mot de passe est nécessaire.', acces: lecture ? 'cle' : 'mot_de_passe' },
    entetes: {},
  };
}

/**
 * Vrai si la requête est arrivée par https. Caddy termine le TLS puis nginx réécrit `X-Forwarded-Proto` en « http » (`$scheme`, deploy/nginx.conf) :
 * derrière eux le service ne voit jamais « https », et un cookie `Secure` n'y serait donc jamais posé. Le `Secure` suit l'hôte, comme `adressePublique` :
 * un nom d'hôte (ni localhost, ni adresse IP) est servi en https par Caddy (HSTS) ; seul « https » déclaré le force pour le reste.
 */
export function connexionSecurisee(entetes = {}) {
  const hote = String(entetes['x-forwarded-host'] ?? entetes.host ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  const local = /^(localhost|\[?::1\]?|\d{1,3}(\.\d{1,3}){3})$/.test(hote);
  return String(entetes['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase() === 'https' || !local;
}

/** Les en-têtes Set-Cookie d'une session ouverte (`jeton`) ou fermée (null : le cookie est retiré, sous les deux chemins possibles). */
export function cookiesDeSession(jeton, { portee, securise }) {
  const attributs = (chemin, lax) => `; Path=${chemin}; HttpOnly; SameSite=${lax ? 'Lax' : 'Strict'}${securise ? '; Secure' : ''}`;
  // portée « tout » : le cookie doit accompagner aussi les pages (la vérification d'un mandataire les voit) ; SameSite=Lax laisse entrer par un lien
  const chemin = portee === 'tout' ? '/' : '/api/';
  if (jeton) return [`${COOKIE}=${jeton}${attributs(chemin, portee === 'tout')}`];
  return ['/api/', '/'].map((c) => `${COOKIE}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${attributs(c, c === '/')}`);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La commande de l'hôte (deploy/installateur/acces/acces.sh), exécutée dans le conteneur : `node -e "import(…acces.mjs).then((m) => m.commandeAcces(…))"`.
// Le mot de passe arrive par l'entrée standard (première ligne), jamais en argument ; le fichier est écrit par l'hôte (secrets/ est en lecture seule ici).
// Sortie : « REGLAGE <json> » (le contenu du fichier à écrire) puis « CLE <clé> » (la clé de lecture neuve, à montrer une seule fois).
// ---------------------------------------------------------------------------------------------------------------------------------------------

async function lireEntree(entree) {
  const morceaux = [];
  for await (const m of entree) morceaux.push(m);
  return Buffer.concat(morceaux).toString('utf8');
}

/**
 * @param {string[]} argv `definir` (le mot de passe sur l'entrée : garde la portée et la clé de lecture, en fait une si besoin) | `cle` (une clé neuve) | `portee <valeur>`
 * @param {{ entree?: AsyncIterable<Buffer>, sortie?: (ligne: string) => void, erreur?: (ligne: string) => void, fichier?: string }} [o]
 * @returns {Promise<number>} le code de sortie
 */
export async function commandeAcces(argv, { entree = process.stdin, sortie = (l) => console.log(l), erreur = (l) => process.stderr.write(`${l}\n`), fichier = process.env.MAVERICK_ACCES_FICHIER || FICHIER_PAR_DEFAUT } = {}) {
  const [action, ...options] = argv;
  const dire = (l) => sortie(l);
  let ancien = null;
  try {
    ancien = JSON.parse(readFileSync(fichier, 'utf8'));
  } catch (e) {
    if (e?.code !== 'ENOENT') ancien = { illisible: true };
  }
  const intact = ancien && !ancien.illisible ? (() => { try { return validerReglage(ancien); } catch { return null; } })() : null;
  try {
    let demande;
    if (action === 'definir') {
      const mot = (await lireEntree(entree)).split('\n')[0].replace(/\r$/, '');
      demande = { ancien: intact, motDePasse: mot };
    } else if (action === 'cle') {
      demande = { ancien: intact, refaireLaCle: true };
    } else if (action === 'portee') {
      demande = { ancien: intact, portee: options[0] ?? '' };
    } else {
      throw new Error('commande inconnue (definir, cle, portee)');
    }
    if (ancien && !intact && action !== 'definir') throw new Error('le réglage actuel est illisible : posez un nouveau mot de passe (commande sans option)');
    const { reglage, cle } = reglageApres(demande);
    dire(`REGLAGE ${JSON.stringify(reglage)}`);
    if (cle) dire(`CLE ${cle}`);
    return 0;
  } catch (e) {
    erreur(`ERREUR : ${e.message}`);
    return 1;
  }
}

/** Pour `node -e` : lance la commande avec les arguments de la ligne, et fixe le code de sortie du processus. */
export async function lancerLaCommande(argv) {
  process.exitCode = await commandeAcces(argv);
}
