// Accès au site de dev (docs/serveur.md, « Accès au site de dev » ; décision R310, qui retire le mot de passe de R275). Le site de dev est FERMÉ : plus rien
// sans une session Discord de niveau MJ au moins (lecture) ou Créateur (tout ce que protégeait le mot de passe), page de connexion et routes de connexion
// exceptées (serveur/acces-routes.mjs). Les CLÉS de lecture et de dépôt (R275, R291 : sessions de Claude, CI, workflows ; ce ne sont pas des connexions de
// personnes) gardent exactement leur comportement.
//
// Ce module tient la porte : les clés (fichier `secrets/acces.json`, relu quand il change) et le niveau de la session (lu par `serveur/discord.mjs#session`,
// injecté : le niveau de la porte est celui du cookie). Le fichier ne contient aucun secret en clair : l'empreinte SHA-256 de la clé de lecture et celle de
// la clé de dépôt quand elle est posée. Absent : aucune clé, le site reste fermé. Illisible ou invalide : de même, les clés ne marchent plus jusqu'à ce que la
// commande de l'hôte (deploy/installateur/acces/acces.sh) le refasse. Un fichier d'avant R310 (qui porte encore l'empreinte d'un mot de passe, une portée, un
// secret de session) reste lisible : ces champs sont ignorés, jamais une fermeture.
//
// La clé de dépôt (R291, qui remplace R275 (4)) : tant qu'elle n'est pas posée, la clé de lecture dépose une proposition qui attend le clic d'un Créateur
// (état sûr). Une fois posée, seule elle (ou une session Créateur) dépose, et le lot est appliqué aussitôt ; la clé de lecture, que détient aussi la CI, ne
// dépose plus. Elle voyage dans les mêmes en-têtes que la clé de lecture (le formulaire sûr des sessions de Claude n'en accepte pas d'autres) ; le service
// les distingue par leur empreinte. Elle permet tout ce que permet la lecture, jamais le reste des écritures.
//
// Le service ne voit jamais d'en-tête Authorization (Caddy le remplace, nginx l'efface : docs/serveur.md, « Hébergement ») : les clés voyagent dans
// X-Maverick-Cle (ou son second nom X-Maverick-Key), la session du navigateur dans un cookie. Jamais dans l'adresse (le journal la noterait).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { classer } from './acces-routes.mjs';

/** Le fichier des clés dans le conteneur (le dossier secrets/ de l'instance y est monté en lecture seule). */
export const FICHIER_PAR_DEFAUT = '/secrets/acces.json';
export const ENTETE_CLE = 'x-maverick-cle';
/**
 * Les seuls en-têtes qui portent une clé : X-Maverick-Cle, et son second nom X-Maverick-Key (le formulaire sûr qui remet la clé aux sessions
 * de Claude n'accepte qu'un nom d'en-tête finissant par « key », « token »…). Tout autre en-tête, ou l'adresse, n'ouvre rien.
 */
export const ENTETES_CLE = Object.freeze([ENTETE_CLE, 'x-maverick-key']);
export const PREFIXE_DE_LA_CLE = 'mvk_';
export const PREFIXE_DE_LA_CLE_DE_DEPOT = 'mvd_';
/** Les droits d'une requête, du plus petit au plus grand : `lecture` (clé de lecture ou session MJ), `depot` (clé de dépôt), `ecriture` (session Créateur). */
export const DROITS = Object.freeze(['aucun', 'lecture', 'depot', 'ecriture']);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Secrets : clés de lecture et de dépôt
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Égalité à temps constant de deux textes (comparés par leur empreinte : la longueur ne fuit pas). */
export function egaux(a, b) {
  const h = (x) => createHash('sha256').update(String(x)).digest();
  return timingSafeEqual(h(a), h(b));
}

/** Une clé de lecture neuve : 32 octets au hasard (assez pour qu'un SHA-256 suffise : rien à deviner). */
export const nouvelleCle = () => `${PREFIXE_DE_LA_CLE}${randomBytes(32).toString('base64url')}`;
/** Une clé de dépôt neuve : même force, un autre préfixe (on ne confond pas les deux en la lisant). */
export const nouvelleCleDeDepot = () => `${PREFIXE_DE_LA_CLE_DE_DEPOT}${randomBytes(32).toString('base64url')}`;
export const empreinteDeLaCle = (cle) => createHash('sha256').update(String(cle)).digest('hex');

/** Les valeurs du cookie `nom` d'un en-tête Cookie (un navigateur peut en envoyer plusieurs de même nom, de chemins différents). */
export function valeursDuCookie(entete, nom) {
  const valeurs = [];
  for (const morceau of String(entete ?? '').split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0 && morceau.slice(0, i).trim() === nom) valeurs.push(morceau.slice(i + 1).trim());
  }
  return valeurs;
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

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le fichier des clés (secrets/acces.json)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const HEX64 = /^[0-9a-f]{64}$/;

/** Le réglage vérifié (champs inconnus retirés : l'empreinte d'un ancien mot de passe, la portée et le secret de session d'avant R310 sont ignorés), ou une erreur. */
export function validerReglage(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  if (!o) throw new Error('réglage illisible');
  if (o.version !== 1) throw new Error(`version de réglage inconnue (${JSON.stringify(o.version)})`);
  const cle = o.cle_de_lecture;
  if (cle !== null && cle !== undefined && !HEX64.test(cle.empreinte ?? '')) throw new Error('empreinte de la clé de lecture invalide');
  const depot = o.cle_de_depot;
  if (depot !== null && depot !== undefined && !HEX64.test(depot.empreinte ?? '')) throw new Error('empreinte de la clé de dépôt invalide');
  if (depot && cle && depot.empreinte === cle.empreinte) throw new Error('la clé de dépôt doit différer de la clé de lecture');
  return {
    version: 1,
    cle_de_lecture: cle ? { empreinte: cle.empreinte } : null,
    cle_de_depot: depot ? { empreinte: depot.empreinte } : null,
    pose_le: typeof o.pose_le === 'string' ? o.pose_le.slice(0, 40) : null,
  };
}

/**
 * Le réglage qui suit une commande de l'hôte : { reglage, cle, cleDeDepot } (`cle` : la clé de lecture neuve en clair, à montrer une seule fois, sinon
 * null ; `cleDeDepot` : de même pour la clé de dépôt). `refaireLaCle` en fabrique une neuve (l'ancienne ne marche plus) ; `refaireLaCleDeDepot` pose (ou refait)
 * la clé de dépôt, `retirerLaCleDeDepot` la retire (retour à l'état sûr : la clé de lecture dépose de nouveau une proposition) ; les autres clés sont gardées.
 */
export function reglageApres({ ancien = null, refaireLaCle = false, refaireLaCleDeDepot = false, retirerLaCleDeDepot = false, maintenant = new Date() }) {
  const garde = ancien ? validerReglage(ancien) : null;
  if (refaireLaCleDeDepot && retirerLaCleDeDepot) throw new Error('poser et retirer la clé de dépôt en même temps');
  if (retirerLaCleDeDepot && !garde?.cle_de_depot) throw new Error('aucune clé de dépôt n’est posée');
  const nouvelleCleEnClair = refaireLaCle ? nouvelleCle() : null;
  const nouvelleCleDeDepotEnClair = refaireLaCleDeDepot ? nouvelleCleDeDepot() : null;
  return {
    reglage: {
      version: 1,
      cle_de_lecture: nouvelleCleEnClair ? { empreinte: empreinteDeLaCle(nouvelleCleEnClair) } : garde?.cle_de_lecture ?? null,
      cle_de_depot: nouvelleCleDeDepotEnClair ? { empreinte: empreinteDeLaCle(nouvelleCleDeDepotEnClair) } : retirerLaCleDeDepot ? null : garde?.cle_de_depot ?? null,
      pose_le: nouvelleCleEnClair || nouvelleCleDeDepotEnClair || retirerLaCleDeDepot ? maintenant.toISOString() : garde?.pose_le ?? null,
    },
    cle: nouvelleCleEnClair,
    cleDeDepot: nouvelleCleDeDepotEnClair,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La porte
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * La porte du site de dev : relit le fichier des clés `fichier` quand il change (date, inode, taille : jamais un redémarrage), juge chaque requête.
 * `session(entetes)` rend la session du cookie ({ u, n, exp } ou null : serveur/discord.mjs) ; sans elle, seules les clés ouvrent. `journal` reçoit des lignes
 * sans secret.
 * @param {{ fichier: string, session?: ((entetes: object) => { u: string, n: string, exp: number } | null) | null, journal?: ((message: string) => void) | null }} o
 */
export function creerAcces({ fichier, session = null, journal = null }) {
  let vu = null; // { cle, etat }

  /** Les clés courantes : { reglage } posées, { invalide } illisibles, null absentes. */
  function lire() {
    let s;
    try {
      s = statSync(fichier);
    } catch (e) {
      if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') {
        if (vu) journal?.('accès : clés retirées, le site de dev n’a plus que les sessions Discord');
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
      journal?.(`accès : clés relues (lecture : ${reglage.cle_de_lecture ? 'oui' : 'non'}, dépôt : ${reglage.cle_de_depot ? 'oui' : 'non'})`);
    } catch (e) {
      vu = { cle, etat: { invalide: e?.message ?? 'réglage invalide' } };
      journal?.(`accès : clés illisibles (${vu.etat.invalide}) : aucune clé ne marche jusqu'à ce que la commande de l'hôte les refasse`);
    }
    return vu.etat;
  }
  function noter(cle, raison) {
    if (vu?.cle !== cle) journal?.(`accès : clés ${raison} : aucune clé ne marche jusqu'à ce que la commande de l'hôte les refasse`);
    vu = { cle, etat: { invalide: raison } };
    return vu.etat;
  }

  /**
   * Le droit d'une requête : `droit` (`ecriture` : session Créateur ; `depot` : clé de dépôt ; `lecture` : clé de lecture ou session MJ ; `aucun`), `session`
   * (une session valide, de quelque niveau), `niveau` (celui du cookie), `cle` (la meilleure clé présentée : `depot`, `lecture` ou null), `expire_s`.
   * `depot` vaut tout ce que vaut `lecture`, plus le dépôt d'un lot appliqué aussitôt (R291) ; il n'existe que si les clés posent une clé de dépôt.
   */
  function droit(entetes = {}, etat = lire()) {
    const s = session?.(entetes) ?? null;
    let cle = null;
    const r = etat?.reglage;
    if (r) {
      for (const nom of ENTETES_CLE) {
        const valeur = entetes[nom];
        if (typeof valeur !== 'string' || !valeur) continue;
        const empreinte = empreinteDeLaCle(valeur);
        if (r.cle_de_depot && egaux(empreinte, r.cle_de_depot.empreinte)) cle = 'depot';
        else if (r.cle_de_lecture && egaux(empreinte, r.cle_de_lecture.empreinte) && cle === null) cle = 'lecture';
      }
    }
    const parSession = s?.n === 'createur' ? 'ecriture' : s?.n === 'mj' ? 'lecture' : 'aucun';
    const parCle = cle ?? 'aucun';
    const d = DROITS[Math.max(DROITS.indexOf(parSession), DROITS.indexOf(parCle))];
    return { droit: d, session: Boolean(s), niveau: s?.n ?? null, cle, expire_s: s?.exp ?? null };
  }

  /** Vrai si la clé de dépôt est posée : le dépôt d'un lot demande alors elle ou une session Créateur, et s'applique aussitôt (R291). */
  const depotDirectPose = () => Boolean(lire()?.reglage?.cle_de_depot);

  /**
   * Le dépôt de cette requête s'applique-t-il aussitôt ? Oui seulement quand les clés posent une clé de dépôt ET que la requête porte cette clé ou une
   * session Créateur. Sinon : non, le dépôt reste une proposition qui attend le clic (état sûr). Rend `{ direct, par }` : `par` dit ce qui a ouvert ce droit
   * (`cle_de_depot`, `createur`).
   */
  function depot(entetes = {}) {
    const etat = lire();
    if (!etat?.reglage?.cle_de_depot) return { direct: false, par: null };
    const d = droit(entetes, etat);
    if (d.droit === 'ecriture') return { direct: true, par: 'createur' };
    if (d.cle === 'depot') return { direct: true, par: 'cle_de_depot' };
    return { direct: false, par: null };
  }

  /** Le classement d'une requête (méthode, adresse). */
  const classement = (methode, adresse) => classer(methode, adresse);

  /**
   * null si la requête a le droit que demande sa route, sinon la réponse de refus : 401 `acces: 'connexion'` sans session ni clé, 403 `acces: 'niveau'`
   * avec une session de niveau trop bas, 403 `acces: 'cle'` avec une clé qui ne suffit pas (jamais une valeur de secret). Une route `proposition` (déposer
   * un lot, refaire son essai, tout recalculer) demande une clé (de lecture, ou de dépôt une fois posée) ou une session Créateur : une fois la clé de dépôt
   * posée, la clé de lecture est refusée (403 `cle_de_depot`) pour qu'elle ne devienne pas une clé d'écriture (R291).
   */
  function controler(requete) {
    const etat = lire();
    const { classe } = classer(requete.methode, requete.chemin);
    if (classe === 'ouverte') return null;
    const d = droit(requete.entetes ?? {}, etat);
    if (d.droit === 'ecriture') return null;
    if (classe === 'proposition' && etat?.reglage?.cle_de_depot) {
      if (d.cle === 'depot') return null;
      return refus(classe, { ...d, depot: true });
    }
    if (classe === 'proposition' && d.cle) return null;
    if (classe === 'lecture' && d.droit !== 'aucun') return null;
    return refus(classe, d);
  }

  return { lire, droit, depot, depotDirectPose, controler, classement };
}

const NIVEAU_REQUIS = { lecture: 'mj', proposition: 'createur', ecriture: 'createur' };

/**
 * La réponse d'une route fermée, sans jamais une valeur de secret. `acces` dit ce qui manque : `connexion` (401 : aucune session ni clé), `niveau` (403 : une
 * session de niveau trop bas ; `niveau` et `niveau_requis` le disent), `cle` (403 : une clé de lecture qui ne suffit pas), `cle_de_depot` (la clé de dépôt ou une
 * session Créateur, quand la clé de dépôt est posée : 401 sans rien, 403 avec la clé de lecture, qui ne dépose plus, R291).
 * @param {string} classe
 * @param {{ session?: boolean, niveau?: string|null, cle?: string|null, depot?: boolean }} [d]
 */
export function refus(classe, { session = false, niveau = null, cle = null, depot = false } = {}) {
  const requis = NIVEAU_REQUIS[classe] ?? 'createur';
  const libelleRequis = requis === 'createur' ? 'Créateur' : 'MJ au moins';
  if (session) {
    return {
      statut: 403,
      corps: { erreur: `Accès refusé : votre niveau (${niveau ?? 'inconnu'}) ne permet pas cette action (niveau ${libelleRequis} nécessaire).`, acces: 'niveau', niveau, niveau_requis: requis },
      entetes: {},
    };
  }
  if (classe === 'proposition' && depot) {
    return {
      statut: cle === 'lecture' ? 403 : 401,
      corps: {
        erreur: cle === 'lecture'
          ? 'Accès refusé : la clé de dépôt est nécessaire (la clé de lecture ne dépose plus : un lot déposé s’applique aussitôt).'
          : 'Accès refusé : la clé de dépôt ou une session Créateur est nécessaire.',
        acces: 'cle_de_depot',
      },
      entetes: {},
    };
  }
  if (cle) {
    return { statut: 403, corps: { erreur: 'Accès refusé : cette clé ne permet pas cette action (la clé de lecture ne fait que lire et déposer une proposition).', acces: 'cle' }, entetes: {} };
  }
  return { statut: 401, corps: { erreur: 'Accès refusé : connectez-vous (le site de dev demande une connexion Discord de niveau MJ au moins).', acces: 'connexion' }, entetes: {} };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La commande de l'hôte (deploy/installateur/acces/acces.sh), exécutée dans le conteneur : `node -e "import(…acces.mjs).then((m) => m.lancerLaCommande(…))"`.
// Le fichier est écrit par l'hôte (secrets/ est en lecture seule ici). Sortie : « REGLAGE <json> » (le contenu du fichier à écrire) puis « CLE <clé> » (la clé
// de lecture neuve, à montrer une seule fois) ou « CLE_DE_DEPOT <clé> » (la clé de dépôt neuve, de même).
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * @param {string[]} argv `cle` (une clé de lecture neuve) | `cle-de-depot` (pose ou refait la clé de dépôt : le dépôt s'applique aussitôt, R291)
 *   | `sans-cle-de-depot` (la retire : retour au dépôt qui attend le clic)
 * @param {{ sortie?: (ligne: string) => void, erreur?: (ligne: string) => void, fichier?: string }} [o]
 * @returns {Promise<number>} le code de sortie
 */
export async function commandeAcces(argv, { sortie = (l) => console.log(l), erreur = (l) => process.stderr.write(`${l}\n`), fichier = process.env.MAVERICK_ACCES_FICHIER || FICHIER_PAR_DEFAUT } = {}) {
  const [action] = argv;
  const dire = (l) => sortie(l);
  let ancien = null;
  try {
    ancien = JSON.parse(readFileSync(fichier, 'utf8'));
  } catch (e) {
    if (e?.code !== 'ENOENT') ancien = { illisible: true };
  }
  // un fichier illisible ou d'une forme inconnue ne s'améliore pas : les commandes repartent d'un réglage vide (les clés d'avant ne marchaient plus)
  const intact = ancien && !ancien.illisible ? (() => { try { return validerReglage(ancien); } catch { return null; } })() : null;
  try {
    let demande;
    if (action === 'cle') demande = { ancien: intact, refaireLaCle: true };
    else if (action === 'cle-de-depot') demande = { ancien: intact, refaireLaCleDeDepot: true };
    else if (action === 'sans-cle-de-depot') demande = { ancien: intact, retirerLaCleDeDepot: true };
    else throw new Error('commande inconnue (cle, cle-de-depot, sans-cle-de-depot)');
    const { reglage, cle, cleDeDepot } = reglageApres(demande);
    dire(`REGLAGE ${JSON.stringify(reglage)}`);
    if (cle) dire(`CLE ${cle}`);
    if (cleDeDepot) dire(`CLE_DE_DEPOT ${cleDeDepot}`);
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
