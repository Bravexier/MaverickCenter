// Petits outils communs aux routes du service (fiches, API /api/v1/, tables de la page Debug) : une seule écriture de chacun.
// N'importe que node:… (serveur/livraison.mjs#modulesDuServeur).
import { createHash } from 'node:crypto';

/** Erreur d'une requête : statut HTTP, message en français, détails ajoutés au corps. Chaque route a sa sous-classe (`instanceof`). */
export class ErreurHttp extends Error {
  constructor(statut, message, details = {}) {
    super(message);
    this.name = new.target.name;
    this.statut = statut;
    this.details = details;
  }
}

/** Empreinte SHA-256 (hex) d'un texte ou d'octets. */
export const sha256 = (donnees) => createHash('sha256').update(donnees).digest('hex');

/** Empreinte courte (16 caractères hex d'un sha256) d'un texte : la version (ETag, sans guillemets) d'une représentation. */
export const empreinteCourte = (texte) => sha256(texte).slice(0, 16);

/** Le JSON d'une colonne texte (journal, historique), ou null si elle est NULL. */
export const jsonOuNull = (texte) => (texte === null || texte === undefined ? null : JSON.parse(texte));

/** Les étiquettes d'un en-tête If-Match / If-None-Match (« "a", W/"b" », ou « * ») : ['a', 'b'] ou ['*'] ; null si l'en-tête est absent. */
export function etiquettesDe(entete) {
  if (entete === undefined || entete === null) return null;
  return String(entete).split(',').map((t) => t.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1')).filter(Boolean);
}

/** Vrai si `version` est l'une des étiquettes données (ou « * »). */
export const etiquetteCorrespond = (etiquettes, version) => etiquettes.includes('*') || etiquettes.includes(version);

/**
 * Une réponse GET versionnée : 304 sans corps si l'If-None-Match du navigateur contient `version`, sinon `produire(entetes)` (les en-têtes ETag et
 * Cache-Control à joindre à la réponse). Le seul endroit où le service décide d'un 304.
 */
export function reponseVersionnee(entetes, version, produire, controleDuCache = 'private, no-cache') {
  const cache = { ETag: `"${version}"`, 'Cache-Control': controleDuCache };
  const connues = etiquettesDe(entetes?.['if-none-match']);
  if (connues && etiquetteCorrespond(connues, version)) return { statut: 304, corps: null, brut: '', entetes: cache };
  return produire(cache);
}

/** Un segment d'adresse décodé ; `siIllisible` s'il est mal encodé. */
export function segmentDecode(segment, siIllisible = null) {
  try {
    return decodeURIComponent(String(segment ?? ''));
  } catch {
    return siIllisible;
  }
}

/** Un entier lu dans l'adresse, de `min` à `max` ; `defaut` s'il est absent ou vide ; sinon l'erreur 400 que fabrique `Erreur`. */
export function entierDeLAdresse(texte, defaut, min, max, nom, Erreur) {
  if (texte === null || texte === undefined || String(texte).trim() === '') return defaut;
  const brut = String(texte).trim();
  const n = Number(brut);
  if (!/^\d+$/.test(brut) || n < min || n > max) {
    throw new Erreur(400, `${nom} : nombre entier attendu, de ${min} à ${max >= Number.MAX_SAFE_INTEGER ? 'plus' : max} (reçu « ${texte} »).`);
  }
  return n;
}
