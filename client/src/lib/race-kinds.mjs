// Races « pures » et races « hybrides ». Fonctions pures.
//
// Une race hybride est une race qui a accès à sa propre classe raciale (une classe « Hybride Animal » du classeur des
// classes, qui porte le nom de la race : « Orios (classe) » pour la race Orios) ; les autres races sont pures. La
// distinction ne se déduit pas du texte des pages : elle suit l'existence de la page de la classe raciale, sauf pour les
// races de HYBRIDES_SANS_CLASSE_RACIALE (décision R14 du propriétaire). Le fait que les races hybrides à classe raciale
// n'aient que 3 magies innées est vérifié par un test sur le contenu réel (test/races-magies-content.test.mjs).
import { normalize } from './text.mjs';

const CLASS_SUFFIX = / \(classe\)$/i;
const isRacialClass = (entry) => entry.id.startsWith('classes/') && (entry.data.tags ?? []).some((t) => normalize(t) === 'hybride-animal');
const baseName = (title) => normalize(title.replace(CLASS_SUFFIX, ''));

/**
 * Races hybrides qui n'ont pas de classe raciale. Décision R14 du propriétaire : « Le drassah'thac est considéré comme
 * race hybride, c'est la seule race hybride à avoir toutes les magies. »
 */
export const HYBRIDES_SANS_CLASSE_RACIALE = new Set(['races/drassahthac']);

/**
 * Ordre d'affichage des races, races pures puis hybrides (demande du propriétaire, liste de /wiki/races/). Ce n'est pas
 * l'ordre de l'onglet « Race » de la fiche (race.ordre dans la base). Une race absente de la liste vient après, par titre.
 */
export const ORDRE_DES_RACES = [
  // pures
  'humain', 'nain', 'elfe-forestier', 'elfe-dore', 'elfe-argente', 'elfe-noir', 'farfadet', 'felfe', 'majin', 'hujin', 'drakos', 'lamia', 'mort-vivant',
  // hybrides
  'drassahthac', 'orios', 'fenrir', 'kitsune', 'olwman', 'rokh', 'namazu', 'minotaure', 'satyre', 'medusain', 'jackalope', 'marcass', 'anansi', 'goleois',
].map((slug) => `races/${slug}`);

/** Page de la classe raciale d'une race, ou null si la race n'en a pas. */
export function racialClassOf(entries, race) {
  const name = normalize(race.data.title);
  return entries.find((e) => isRacialClass(e) && baseName(e.data.title) === name) ?? null;
}

/** Page de la race à laquelle appartient une classe raciale, ou null si la classe n'est la classe d'aucune race. */
export function raceOfClass(entries, cls) {
  if (!isRacialClass(cls)) return null;
  const name = baseName(cls.data.title);
  return entries.find((e) => e.id.startsWith('races/') && normalize(e.data.title) === name) ?? null;
}

/** @returns {'hybride' | 'pure'} */
export const raceKind = (entries, race) => (HYBRIDES_SANS_CLASSE_RACIALE.has(race.id) || racialClassOf(entries, race) ? 'hybride' : 'pure');

export const RACE_GROUPS = [
  { key: 'pures', kind: 'pure', label: 'Races pures' },
  { key: 'hybrides', kind: 'hybride', label: 'Races hybrides' },
];

const rang = (race) => {
  const i = ORDRE_DES_RACES.indexOf(race.id);
  return i < 0 ? ORDRE_DES_RACES.length : i;
};
const byOrdre = (a, b) => rang(a) - rang(b) || a.data.title.localeCompare(b.data.title, 'fr');

/**
 * Range les races en groupes (pures puis hybrides), chacun dans l'ordre de ORDRE_DES_RACES ; un groupe vide est omis.
 * `entries` contient les pages de races ET de classes (les classes servent à reconnaître les hybrides).
 */
export function groupRaces(entries) {
  const races = entries.filter((e) => e.id.startsWith('races/'));
  return RACE_GROUPS.map((g) => ({ key: g.key, label: g.label, entries: races.filter((r) => raceKind(entries, r) === g.kind).sort(byOrdre) })).filter(
    (g) => g.entries.length > 0,
  );
}
