// Le texte de la partie « Bienvenue » de Tipeee, relu en direct par le service (réponse du propriétaire du 2026-10-22 : « En direct par le serveur » —
// « Le serveur de production relit Tipeee lui-même, avec un cache de quelques heures, et garde le dernier texte si Tipeee ne répond pas ») :
// GET /api/tipeee/ (serveur/api.mjs) → { paragraphes, lu_le, origine }, que la page Bienvenue met à la place de l'instantané du build s'il diffère.
//
// C'est une sortie du service sur Internet, sur les deux instances (docs/serveur.md, « Hébergement ») ; d'où ses bornes :
//   - une adresse fixe (lib/tipeee.mjs#URL_API) : rien de la requête du visiteur n'entre dans l'appel ; GET sans cookie, sans redirection suivie ;
//   - un cache (CACHE_MS, MAVERICK_TIPEEE_CACHE_MIN) : pendant sa durée, aucune requête ; après un échec, pas de nouvel essai avant REESSAI_MS ;
//   - une seule requête à la fois, quel que soit le nombre de visiteurs : les appels simultanés attendent la même ;
//   - DELAI_MS pour toute la lecture, OCTETS_MAX (taille annoncée, puis lecture par morceaux arrêtée au-delà) ;
//   - du texte seulement (lib/tipeee.mjs#bienvenueDeTipeee) : jamais de HTML de Tipeee servi.
// Le dernier texte valide est gardé dans <dossier de la base vivante>/tipeee.json (FICHIER, le format de l'instantané : { url, lu_le, paragraphes },
// écrit d'un coup) et relu au démarrage ; le premier repli est l'instantané livré avec le site (lib/tipeee.mjs#CHEMIN_INSTANTANE, copié dans
// _serveur/ par serveur/livraison.mjs) ; le plus récent des deux est servi. Tipeee injoignable, lent, en erreur, réponse trop grosse ou sans le
// repère : le dernier texte connu reste servi (origine « repli ») et une alerte va au journal du service (« ATTENTION Tipeee : … », niveau
// avertissement) ; une lecture est aussi un évènement « tipeee » des métriques (statut, durée, octets, raison).
// `fetch` et `horloge` sont injectables : les tests ne joignent pas Tipeee. Node seulement, sans paquet npm.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bienvenueDeTipeee, instantaneValide, memesParagraphes, URL_API } from '../src/lib/tipeee.mjs';

/** Durée du cache par défaut : 6 heures (« un cache de quelques heures »). */
export const CACHE_MS = 6 * 60 * 60_000;
/** Après un échec, pas de nouvel essai avant 15 minutes (un visiteur n'attend pas Tipeee à chaque page). */
export const REESSAI_MS = 15 * 60_000;
/** Durée maximale d'une lecture (sous le délai de 60 s de nginx ; le visiteur voit déjà l'instantané). */
export const DELAI_MS = 8_000;
/** Taille maximale de la réponse (celle du 2026-10-22 : 18 Kio). */
export const OCTETS_MAX = 512 * 1024;
/** Le dernier texte valide, à côté de la base vivante. */
export const FICHIER = 'tipeee.json';

/**
 * Les réglages du lecteur d'après l'environnement du service (serveur/index.mjs, serveur/dev.mjs) : MAVERICK_TIPEEE=0, Tipeee n'est jamais joint ;
 * MAVERICK_TIPEEE_CACHE_MIN, la durée du cache en minutes (un nombre de 1 à 10 080, sinon CACHE_MS) ; `instantane` : le chemin de l'instantané.
 * @param {Record<string, string|undefined>} env
 * @param {string|null} instantane
 */
export function reglagesTipeee(env, instantane) {
  const minutes = Number(env.MAVERICK_TIPEEE_CACHE_MIN);
  const cache = env.MAVERICK_TIPEEE_CACHE_MIN && Number.isFinite(minutes) && minutes >= 1 && minutes <= 7 * 24 * 60 ? minutes * 60_000 : CACHE_MS;
  return { actif: env.MAVERICK_TIPEEE !== '0', cache, instantane };
}

/** Un échec de la lecture : sa raison (métriques) et son message (journal). */
class EchecTipeee extends Error {
  constructor(raison, message) {
    super(message);
    this.raison = raison;
  }
}

/** La promesse, ou un rejet dès que `signal` s'arrête (un fetch ou un flux qui ignorerait le signal ne bloque pas la lecture). */
function avant(promesse, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((ok, ko) => {
    const arreter = () => ko(signal.reason);
    signal.addEventListener('abort', arreter, { once: true });
    promesse.then(
      (v) => {
        signal.removeEventListener('abort', arreter);
        ok(v);
      },
      (e) => {
        signal.removeEventListener('abort', arreter);
        ko(e);
      },
    );
  });
}

/** Abandonne le corps d'une réponse qu'on ne lit pas. */
function jeter(reponse) {
  try {
    reponse.body?.cancel().catch(() => {});
  } catch {
    // corps déjà lu ou verrouillé
  }
}

/** Lit un fichier JSON au format de l'instantané ; null s'il manque ou ne l'est pas. */
function lireTexteGarde(chemin) {
  if (!chemin) return null;
  try {
    return instantaneValide(JSON.parse(readFileSync(chemin, 'utf8')));
  } catch {
    return null;
  }
}

/** Un instant ISO 8601 en UTC à la seconde (l'écriture de serveur/instant.mjs), d'après l'horloge en ms. */
const aLaSeconde = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Le lecteur de Tipeee du service (un par service : son cache et sa requête en cours valent pour tous les visiteurs).
 * @param {object} [o]
 * @param {typeof fetch} [o.fetch] (injectable : les tests ne joignent pas Tipeee)
 * @param {string|null} [o.dossier] où garder le dernier texte valide (FICHIER) : le dossier de la base vivante ; null : en mémoire seulement
 * @param {string|null} [o.instantane] l'instantané livré avec le site (premier repli)
 * @param {boolean} [o.actif] false : Tipeee n'est jamais joint (MAVERICK_TIPEEE=0), le dernier texte connu est servi (origine « repli »)
 * @param {() => number} [o.horloge] en ms (Date.now)
 * @param {number} [o.cache] CACHE_MS
 * @param {number} [o.reessai] REESSAI_MS
 * @param {number} [o.delai] DELAI_MS
 * @param {number} [o.octetsMax] OCTETS_MAX
 * @param {(message: string, options?: object) => void} [o.journal] journal du service
 * @param {(type: string, o: object) => void} [o.evenement] métriques (évènement « tipeee »)
 * @returns {{ lire: () => Promise<{ paragraphes: string[], lu_le: string|null, origine: 'tipeee'|'repli' }>, actuel: () => object }}
 */
export function creerTipeee({ fetch = globalThis.fetch, dossier = null, instantane = null, actif = true, horloge = Date.now, cache = CACHE_MS,
  reessai = REESSAI_MS, delai = DELAI_MS, octetsMax = OCTETS_MAX, journal = null, evenement = null } = {}) {
  const fichier = dossier ? join(dossier, FICHIER) : null;
  // le texte servi : le dernier lu de Tipeee (gardé sur disque) ou l'instantané du site, le plus récent des deux
  const garde = lireTexteGarde(fichier);
  const livre = lireTexteGarde(instantane);
  let connu = null; // { url, lu_le, paragraphes, de: 'tipeee' | 'instantane' }
  if (garde && (!livre || Date.parse(garde.lu_le) >= Date.parse(livre.lu_le))) connu = { ...garde, de: 'tipeee' };
  else if (livre) connu = { ...livre, de: 'instantane' };
  if (!livre && instantane) journal?.(`ATTENTION Tipeee : l’instantané livré avec le site est absent ou illisible (${instantane})`, { niveau: 'avertissement' });
  // l'instant (horloge) de la dernière lecture réussie : celle du texte gardé, s'il est servi (un redémarrage pendant le cache ne relit pas Tipeee)
  let luA = connu?.de === 'tipeee' ? Date.parse(connu.lu_le) : null;
  let echecA = null; // l'instant du dernier échec, s'il suit la dernière lecture réussie
  let enCours = null; // la lecture en cours, partagée par tous les appels

  /** Frais : lu de Tipeee il y a moins que la durée du cache. */
  const frais = (t) => connu?.de === 'tipeee' && luA !== null && t - luA >= 0 && t - luA < cache;

  /**
   * La réponse de la route : le texte connu (aucun : une liste vide), sa date et son origine. Fermé (MAVERICK_TIPEEE=0), toujours « repli » : le
   * dernier texte connu, même gardé d'une lecture encore dans la durée du cache (Tipeee n'est plus joint, ce texte n'est plus tenu à jour).
   */
  const reponse = () => ({ paragraphes: connu ? [...connu.paragraphes] : [], lu_le: connu?.lu_le ?? null, origine: actif && frais(horloge()) ? 'tipeee' : 'repli' });

  /** Lit le corps, par morceaux : au-delà d'`octetsMax`, un échec. */
  async function lireCorps(r, signal, suivi) {
    if (!r.body) return '';
    const lecteur = r.body.getReader();
    const morceaux = [];
    try {
      for (;;) {
        const { done, value } = await avant(lecteur.read(), signal);
        if (done) break;
        suivi.octets += value.byteLength;
        if (suivi.octets > octetsMax) throw new EchecTipeee('trop-gros', `réponse de plus de ${octetsMax} octets`);
        morceaux.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
      }
    } finally {
      lecteur.cancel().catch(() => {});
    }
    return Buffer.concat(morceaux).toString('utf8');
  }

  /** Garde le texte lu sur disque, d'un coup (fichier temporaire renommé) ; une panne du disque est notée, la lecture reste valable. */
  function garder(texte) {
    if (!fichier) return;
    try {
      mkdirSync(dossier, { recursive: true });
      const provisoire = `${fichier}.${process.pid}.tmp`;
      writeFileSync(provisoire, `${JSON.stringify(texte, null, 2)}\n`);
      renameSync(provisoire, fichier);
    } catch (e) {
      journal?.(`ERREUR Tipeee : le texte lu n’a pas pu être gardé dans ${fichier} : ${e.message}`);
    }
  }

  /** Une lecture de Tipeee (jamais d'exception) : le texte connu change si elle réussit ; sinon il reste, et une alerte est notée. */
  async function relire() {
    const t0 = performance.now();
    const suivi = { statut: null, octets: 0 };
    const minuterie = new AbortController();
    const chrono = setTimeout(() => minuterie.abort(new DOMException('Délai dépassé.', 'TimeoutError')), delai);
    const noter = (detail) => {
      try {
        evenement?.('tipeee', { duree_ms: performance.now() - t0, detail: { statut: suivi.statut, octets: suivi.octets, ...detail } });
      } catch {
        // les métriques ne font jamais échouer la lecture
      }
    };
    try {
      const r = await avant(fetch(URL_API, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { accept: 'application/json' }, signal: minuterie.signal }), minuterie.signal);
      suivi.statut = r.status;
      if (r.status !== 200) {
        jeter(r);
        throw new EchecTipeee('http', `Tipeee a répondu HTTP ${r.status}`);
      }
      const annoncee = Number(r.headers.get('content-length'));
      if (Number.isFinite(annoncee) && annoncee > octetsMax) {
        jeter(r);
        throw new EchecTipeee('trop-gros', `réponse annoncée de ${annoncee} octets (${octetsMax} au plus)`);
      }
      const corps = await lireCorps(r, minuterie.signal, suivi);
      const lu = bienvenueDeTipeee(corps);
      if ('raison' in lu) throw new EchecTipeee(lu.raison, lu.message);
      const change = !memesParagraphes(connu?.paragraphes, lu.paragraphes);
      const maintenant = horloge();
      connu = { url: URL_API, lu_le: aLaSeconde(maintenant), paragraphes: lu.paragraphes, de: 'tipeee' };
      luA = maintenant;
      echecA = null;
      garder({ url: connu.url, lu_le: connu.lu_le, paragraphes: connu.paragraphes });
      noter({ paragraphes: lu.paragraphes.length, change });
      journal?.(`Tipeee : partie « Bienvenue » relue (${lu.paragraphes.length} paragraphe(s), ${Math.round(performance.now() - t0)} ms)${change ? ', texte changé' : ''}`);
    } catch (e) {
      echecA = horloge();
      const raison = e instanceof EchecTipeee ? e.raison : minuterie.signal.aborted ? 'delai' : 'injoignable';
      const message = e instanceof EchecTipeee ? e.message : raison === 'delai' ? `pas de réponse en ${Math.round(delai / 1000)} s` : `injoignable (${e?.message ?? e})`;
      noter({ raison });
      const reste = connu ? (connu.de === 'tipeee' ? `le texte lu le ${connu.lu_le} reste servi` : `l’instantané du site (lu le ${connu.lu_le}) reste servi`) : 'aucun texte à servir';
      journal?.(`ATTENTION Tipeee : ${message} ; ${reste} (nouvel essai dans ${Math.round(reessai / 60_000)} min)`, { niveau: 'avertissement' });
    } finally {
      clearTimeout(chrono);
    }
  }

  /**
   * Le texte à servir : tout de suite pendant le cache ou après un échec récent ; sinon après une lecture de Tipeee (la même pour tous les appels
   * simultanés). Jamais de rejet.
   */
  function lire() {
    const t = horloge();
    const attendre = actif && !frais(t) && !(echecA !== null && t - echecA >= 0 && t - echecA < reessai);
    if (!attendre) return Promise.resolve(reponse());
    if (!enCours) enCours = relire().finally(() => { enCours = null; });
    return enCours.then(reponse);
  }

  return { lire, actuel: reponse };
}
