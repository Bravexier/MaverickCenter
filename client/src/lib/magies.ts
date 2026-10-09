import { ouvrirBase } from './donnees.mjs';
import { chargerMagies } from './magies-db.mjs';
import { ancreDeTitre } from './sort-format.mjs';
import { cheminDePage } from './metiers.mjs';
import { url } from './wiki';

// Magies et sorts de la base (lib/magies-db.mjs), chargés une fois par build.
export type Magies = ReturnType<typeof chargerMagies>;
export type MagieDb = Magies['magies'] extends Map<string, infer M> ? M : never;
export type SortDb = Magies['sorts'] extends Map<string, infer S> ? S : never;

let cache: Magies | undefined;
export const loadMagies = () => (cache ??= chargerMagies(ouvrirBase()));
/** Ids des pages de magie dans l'ordre du classeur (magie.ordre : 1 = Potentiel Illimité), pour les tableaux des races et des relations. */
export const ordreDesMagies = () => [...loadMagies().magies.values()].sort((a, b) => a.ordre - b.ordre).map((m) => m.id);

/** Lien vers une page du wiki d'après son id (« bestiaire/golem-de-boue ») ; pour un métier, sa ligne du tableau de /wiki/metiers/. */
export const pageHref = (pageId: string) => url(cheminDePage(pageId));
/** Lien vers la section d'une altération d'état sur la page « Liste des altérations d'état ». */
export const etatHref = (etat: { pageId: string; nom: string }) => `${pageHref(etat.pageId)}#${ancreDeTitre(etat.nom)}`;
/** Identifiant HTML du détail d'un sort (lien profond : `…/magie-du-feu/#sort-boule-de-feu`). */
export const sortAncre = (sort: { slug: string }) => `sort-${sort.slug}`;
/** Identifiant HTML unique (par exécution du build) d'une infobulle : le déclencheur le cite par `aria-describedby`. */
let compteurBulles = 0;
export const idBulle = (prefixe: string) => `${prefixe}-${++compteurBulles}`;
