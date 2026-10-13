import { chargerInvocations } from './bestiaire-db.mjs';
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
/**
 * La carte d'une créature invoquée, telle que le bestiaire la montre (lib/bestiaire-db.mjs#chargerInvocations) : sur une page de magie, elle sert
 * d'infobulle à son nom (components/bestiaire/CarteInvoquee.astro, `bulle`). Chargées une fois par build.
 */
export type CarteDeCreature = ReturnType<typeof chargerInvocations>['lignes'][number];
let cartes: Map<string, CarteDeCreature> | undefined;
export const carteDeCreature = (id: string) => (cartes ??= new Map(chargerInvocations(ouvrirBase()).lignes.map((l) => [l.id, l]))).get(id);
/** L'infobulle d'une créature sur une page de magie : une par créature et par page (tous ses déclencheurs la visent). */
export const bulleDeCreature = (id: string) => `bulle-creature-${id.slice(id.indexOf('/') + 1)}`;
/** Le texte de repli d'une infobulle de créature (attribut `title`, sans JavaScript) : ses valeurs telles qu'écrites, une par ligne. */
export const titreDeCreature = (l: CarteDeCreature) =>
  [
    `Santé : ${l.sante}`,
    l.chakra && `Chakra : ${l.chakra}`,
    l.barriere && `Barrière : ${l.barriere}`,
    l.defense && `Défense : ${l.defense}`,
    l.vitesse && `Vitesse : ${l.vitesse}`,
    ...l.attaques.map((a) => `Dégâts : ${a.brut}`),
  ]
    .filter(Boolean)
    .join('\n');

/** Ids des pages de magie dans l'ordre du classeur (magie.ordre : 1 = Potentiel Illimité), pour les tableaux des races et des relations. */
export const ordreDesMagies = () => [...loadMagies().magies.values()].sort((a, b) => a.ordre - b.ordre).map((m) => m.id);

/** Lien vers une page du wiki d'après son id (« bestiaire/golem-de-boue ») ; pour un métier, sa ligne du tableau de /metiers/. */
export const pageHref = (pageId: string) => url(cheminDePage(pageId));
/** Lien vers la section d'une altération d'état sur la page « Liste des altérations d'état ». */
export const etatHref = (etat: { pageId: string; nom: string }) => `${pageHref(etat.pageId)}#${ancreDeTitre(etat.nom)}`;
/**
 * Identifiant HTML d'un sort (lien profond : `…/magie-du-feu/#sort-boule-de-feu`). `prefixe` distingue les magies d'une page qui en montre
 * plusieurs (`…/potentiel-illimite/#sort-feu-boule-de-feu`) : deux magies peuvent avoir un sort du même nom.
 */
export const sortAncre = (sort: { slug: string }, prefixe = '') => `sort-${prefixe}${sort.slug}`;
/** Identifiant HTML unique (par exécution du build) d'une infobulle : le déclencheur le cite par `aria-describedby`. */
let compteurBulles = 0;
export const idBulle = (prefixe: string) => `${prefixe}-${++compteurBulles}`;
