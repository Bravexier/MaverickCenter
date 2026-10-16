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

/** Empreinte courte (16 caractères hex d'un sha256) d'un texte : la version (ETag, sans guillemets) d'une représentation. */
export const empreinteCourte = (texte) => createHash('sha256').update(texte).digest('hex').slice(0, 16);

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
