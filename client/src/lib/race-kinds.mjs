// Races « pures » et races « hybrides ». Fonctions pures.
//
// Une race hybride est une race qui a accès à sa propre classe raciale (une classe « Hybride Animal » du classeur des
// classes, qui porte le nom de la race : « Orios (classe) » pour la race Orios) ; les autres races sont pures. La
// distinction ne se déduit pas du texte des pages : elle suit l'existence de la page de la classe raciale. Le fait que
// les races hybrides n'aient que 3 magies innées est vérifié par un test sur le contenu réel (test/races-magies-content.test.mjs).
import { normalize } from './text.mjs';

const CLASS_SUFFIX = / \(classe\)$/i;
const isRacialClass = (entry) => entry.id.startsWith('classes/') && (entry.data.tags ?? []).some((t) => normalize(t) === 'hybride-animal');
const baseName = (title) => normalize(title.replace(CLASS_SUFFIX, ''));

/** Page de la classe raciale d'une race, ou null si la race n'en a pas (race pure). */
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
export const raceKind = (entries, race) => (racialClassOf(entries, race) ? 'hybride' : 'pure');

export const RACE_GROUPS = [
  { key: 'pures', kind: 'pure', label: 'Races pures' },
  { key: 'hybrides', kind: 'hybride', label: 'Races hybrides' },
];

const byTitle = (a, b) => a.data.title.localeCompare(b.data.title, 'fr');

/**
 * Range les races en groupes (pures puis hybrides), chacun trié par titre ; un groupe vide est omis.
 * `entries` contient les pages de races ET de classes (les classes servent à reconnaître les hybrides).
 */
export function groupRaces(entries) {
  const races = entries.filter((e) => e.id.startsWith('races/'));
  return RACE_GROUPS.map((g) => ({ key: g.key, label: g.label, entries: races.filter((r) => raceKind(entries, r) === g.kind).sort(byTitle) })).filter(
    (g) => g.entries.length > 0,
  );
}
