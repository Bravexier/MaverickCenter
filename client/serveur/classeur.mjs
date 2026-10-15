// « Importer (en ligne) » de la fiche de personnage (demande du propriétaire, 2026-10-15 : « [Importer(EnLigne)] Demande l'url d'un Google Sheet » ;
// précision choisie : « Feuille partagée par lien ») : le service télécharge lui-même, au format .xlsx, une feuille Google Sheets partagée à « Tous les
// utilisateurs disposant du lien » (POST /api/classeur/ { url }, serveur/api.mjs), et la page l'importe comme un classeur choisi sur l'ordinateur.
// Une page ne peut pas le faire seule : Google ne permet pas à un autre site de lire la feuille (CORS).
//
// C'est la seule route qui fait sortir le service sur Internet, à la demande de n'importe quel visiteur (le site est public) ; d'où ses bornes :
//   - seulement un lien https://docs.google.com/spreadsheets/d/<id>… (lib/google-sheets.mjs#idDeFeuille) : l'adresse téléchargée est construite
//     d'après l'identifiant (adresseDExport), jamais recopiée ;
//   - redirections suivies une à une (REDIRECTIONS_MAX), vers docs.google.com ou un hôte de googleusercontent.com seulement (redirectionPermise) ;
//     la page de connexion de Google (accounts.google.com), une réponse 401 ou 403, ou une page HTML au lieu d'un .xlsx (« PK\x03\x04 ») : la
//     feuille n'est pas partagée par lien (403) ;
//   - OCTETS_MAX (taille annoncée, puis lecture par morceaux arrêtée au-delà), DELAI_MS pour tout le téléchargement (sous le délai de 60 s de
//     nginx), SIMULTANES téléchargements à la fois et PAR_MINUTE par minute pour tout le service (429 au-delà) ;
//   - annulé si le visiteur part (`signal`) ;
//   - 4xx pour ce que le visiteur peut corriger (lien, partage, taille, débit), 502 et 504 pour une panne de Google (comptées comme erreurs du
//     service : journal, métriques) ;
//   - rien de l'adresse ni de l'identifiant de la feuille, ni de son contenu, au journal ou aux métriques (évènement « classeur » : statut, durée,
//     octets, redirections).
// `fetch` est injectable : les tests ne joignent pas Google (le réseau de la session le bloque). Node seulement, sans paquet npm.
import { adresseDExport, estUnZip, idDeFeuille, nomDuClasseur, pageDeConnexion, redirectionPermise } from '../src/lib/google-sheets.mjs';

/** Taille maximale d'un classeur (l'ordre de la borne d'une partie d'archive que lit la page : lib/zip.mjs). */
export const OCTETS_MAX = 16 * 1024 * 1024;
/** Durée maximale de tout le téléchargement (redirections comprises), en ms : sous le délai de lecture de nginx (60 s). */
export const DELAI_MS = 20_000;
/** Redirections suivies au plus. */
export const REDIRECTIONS_MAX = 5;
/** Téléchargements en même temps au plus, pour tout le service. */
export const SIMULTANES = 2;
/** Téléchargements commencés par minute au plus, pour tout le service. */
export const PAR_MINUTE = 30;
/** Le nom du classeur quand Google n'en donne pas. */
export const NOM_PAR_DEFAUT = 'Google Sheets.xlsx';

export const LIEN_ATTENDU = 'Lien d’une feuille Google Sheets attendu (https://docs.google.com/spreadsheets/d/…).';
export const NON_PARTAGEE = 'Cette feuille n’est pas partagée par lien : dans Google Sheets, « Partager », puis Accès général « Tous les utilisateurs disposant du lien ».';
export const INTROUVABLE = 'Feuille introuvable : vérifiez le lien.';
export const TROP_GROSSE = `Feuille trop volumineuse (${OCTETS_MAX / 1024 / 1024} Mio au plus une fois au format .xlsx).`;
export const TROP_A_LA_FOIS = 'Trop d’imports en ligne en même temps : réessayez dans un instant.';
export const TROP_PAR_MINUTE = 'Trop d’imports en ligne cette minute : réessayez dans un instant.';
export const GOOGLE_LIMITE = 'Google limite les téléchargements pour le moment : réessayez dans quelques minutes.';
export const GOOGLE_LENT = 'Google ne répond pas : réessayez plus tard.';
export const GOOGLE_INJOIGNABLE = 'Google n’a pas pu être joint : réessayez plus tard.';
export const ANNULE = 'Import annulé : la page a été quittée.';

/** Une réponse de la route : `statut` (4xx, 502, 504 ; 499 si le visiteur est parti) et un message pour la page. */
export class ErreurClasseur extends Error {
  constructor(statut, message) {
    super(message);
    this.name = 'ErreurClasseur';
    this.statut = statut;
  }
}

/** La promesse, ou un rejet dès que `signal` s'arrête (un fetch ou un flux qui ignorerait le signal ne bloque pas la route). */
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

/** Abandonne le corps d'une réponse qu'on ne lit pas (redirection, refus). */
function jeter(reponse) {
  try {
    reponse.body?.cancel().catch(() => {});
  } catch {
    // corps déjà lu ou verrouillé
  }
}

/**
 * Le téléchargeur du service (un par service : ses bornes de débit et de simultanéité valent pour tous les visiteurs).
 * @param {object} [o]
 * @param {typeof fetch} [o.fetch] (injectable : les tests ne joignent pas Google)
 * @param {() => number} [o.horloge] en ms (débit par minute)
 * @param {number} [o.delai] DELAI_MS
 * @param {number} [o.octetsMax] OCTETS_MAX
 * @param {number} [o.simultanes] SIMULTANES
 * @param {number} [o.parMinute] PAR_MINUTE
 * @param {(type: string, o: object) => void} [o.evenement] métriques (évènement « classeur »)
 * @param {(message: string) => void} [o.journal] journal du service
 * @returns {{ telecharger: (url: unknown, o?: { signal?: AbortSignal }) => Promise<{ octets: Buffer, nom: string }> }}
 */
export function creerClasseurEnLigne({ fetch = globalThis.fetch, horloge = Date.now, delai = DELAI_MS, octetsMax = OCTETS_MAX, simultanes = SIMULTANES,
  parMinute = PAR_MINUTE, evenement = null, journal = null } = {}) {
  let enCours = 0;
  const debuts = []; // instants (horloge) des téléchargements commencés dans la dernière minute

  /** Lit le corps d'une réponse 200, par morceaux : au-delà d'`octetsMax`, 413 ; ce qui ne commence pas comme une archive zip, 403. */
  async function lireCorps(reponse, signal, suivi) {
    if (!reponse.body) return Buffer.alloc(0);
    const lecteur = reponse.body.getReader();
    const morceaux = [];
    let total = 0;
    let verifie = false;
    try {
      for (;;) {
        const { done, value } = await avant(lecteur.read(), signal);
        if (done) break;
        total += value.byteLength;
        suivi.octets = total;
        if (total > octetsMax) throw new ErreurClasseur(413, TROP_GROSSE);
        morceaux.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
        if (!verifie && total >= 4) {
          // une page HTML (connexion, accès refusé) au lieu du classeur : inutile de la lire jusqu'au bout
          if (!estUnZip(Buffer.concat(morceaux).subarray(0, 4))) throw new ErreurClasseur(403, NON_PARTAGEE);
          verifie = true;
        }
      }
    } finally {
      lecteur.cancel().catch(() => {});
    }
    const octets = Buffer.concat(morceaux);
    if (!estUnZip(octets)) throw new ErreurClasseur(403, NON_PARTAGEE);
    return octets;
  }

  /** Suit l'adresse d'export et ses redirections jusqu'au classeur. */
  async function suivre(depart, signal, suivi) {
    let adresse = depart;
    for (;;) {
      const reponse = await avant(fetch(adresse, { method: 'GET', redirect: 'manual', credentials: 'omit', signal }), signal);
      const statut = reponse.status;
      if (statut >= 300 && statut < 400) {
        jeter(reponse);
        let suivante = null;
        try {
          suivante = new URL(reponse.headers.get('location') ?? '', adresse).href;
        } catch {
          suivante = null;
        }
        if (!reponse.headers.get('location') || !suivante) throw new ErreurClasseur(502, 'Google a rendu une redirection sans adresse.');
        if (pageDeConnexion(suivante)) throw new ErreurClasseur(403, NON_PARTAGEE);
        if (!redirectionPermise(suivante)) throw new ErreurClasseur(502, 'Google a renvoyé vers une adresse inattendue.');
        suivi.redirections += 1;
        if (suivi.redirections > REDIRECTIONS_MAX) throw new ErreurClasseur(502, 'Trop de redirections de Google.');
        adresse = suivante;
        continue;
      }
      if (statut !== 200) {
        jeter(reponse);
        if (statut === 401 || statut === 403) throw new ErreurClasseur(403, NON_PARTAGEE);
        if (statut === 404 || statut === 410) throw new ErreurClasseur(404, INTROUVABLE);
        if (statut === 429) throw new ErreurClasseur(429, GOOGLE_LIMITE);
        throw new ErreurClasseur(502, `Google n’a pas rendu la feuille (HTTP ${statut}).`);
      }
      const annoncee = Number(reponse.headers.get('content-length'));
      if (Number.isFinite(annoncee) && annoncee > octetsMax) {
        jeter(reponse);
        throw new ErreurClasseur(413, TROP_GROSSE);
      }
      if (/^text\/html\b/i.test(reponse.headers.get('content-type') ?? '')) {
        jeter(reponse);
        throw new ErreurClasseur(403, NON_PARTAGEE);
      }
      const octets = await lireCorps(reponse, signal, suivi);
      return { octets, nom: nomDuClasseur(reponse.headers.get('content-disposition')) ?? NOM_PAR_DEFAUT };
    }
  }

  /**
   * Télécharge la feuille d'un lien Google Sheets (partagée par lien) au format .xlsx → { octets, nom } ; ErreurClasseur sinon (son statut et
   * son message vont tels quels au visiteur). `signal` : le visiteur est parti (499).
   */
  async function telecharger(url, { signal: signalDuVisiteur = null } = {}) {
    const id = idDeFeuille(url);
    if (!id) throw new ErreurClasseur(400, LIEN_ATTENDU);
    const maintenant = horloge();
    while (debuts.length && maintenant - debuts[0] >= 60_000) debuts.shift();
    if (enCours >= simultanes) throw new ErreurClasseur(429, TROP_A_LA_FOIS);
    if (debuts.length >= parMinute) throw new ErreurClasseur(429, TROP_PAR_MINUTE);
    debuts.push(maintenant);
    enCours += 1;
    const t0 = performance.now();
    const suivi = { redirections: 0, octets: 0 };
    // le délai : une minuterie à soi (celle d'AbortSignal.timeout ne retient pas le processus), arrêtée à la fin
    const minuterie = new AbortController();
    const chrono = setTimeout(() => minuterie.abort(new DOMException('Délai dépassé.', 'TimeoutError')), delai);
    const signal = AbortSignal.any([minuterie.signal, ...(signalDuVisiteur ? [signalDuVisiteur] : [])]);
    // le compte rendu : jamais l'adresse ni l'identifiant de la feuille
    const noter = (statut, message = null) => {
      const duree = performance.now() - t0;
      try {
        evenement?.('classeur', { duree_ms: duree, detail: { statut, octets: suivi.octets, redirections: suivi.redirections } });
      } catch {
        // les métriques ne font jamais échouer la route
      }
      const kio = Math.round(suivi.octets / 1024);
      journal?.(message === null
        ? `fiches : import en ligne, feuille Google Sheets téléchargée (${kio} Kio, ${suivi.redirections} redirection(s), ${Math.round(duree)} ms)`
        : `fiches : import en ligne, feuille Google Sheets non téléchargée (${statut}, ${Math.round(duree)} ms) : ${message}`);
    };
    try {
      const resultat = await suivre(adresseDExport(id), signal, suivi);
      noter(200);
      return resultat;
    } catch (e) {
      let erreur = e;
      if (!(e instanceof ErreurClasseur)) {
        if (signalDuVisiteur?.aborted) erreur = new ErreurClasseur(499, ANNULE);
        else if (signal.aborted) erreur = new ErreurClasseur(504, GOOGLE_LENT);
        else erreur = new ErreurClasseur(502, GOOGLE_INJOIGNABLE);
      }
      noter(erreur.statut, erreur.message);
      throw erreur;
    } finally {
      clearTimeout(chrono);
      enCours -= 1;
    }
  }

  return { telecharger };
}
