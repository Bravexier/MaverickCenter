import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupRaces, HYBRIDES_SANS_CLASSE_RACIALE, ORDRE_DES_RACES, raceKind, racialClassOf, raceOfClass } from '../src/lib/race-kinds.mjs';

const race = (title, slug = title.toLowerCase()) => ({ id: `races/${slug}`, data: { title, tags: ['race'] } });
const cls = (title, ...tags) => ({ id: `classes/${title.toLowerCase()}`, data: { title, tags: ['classe', ...tags] } });
const ids = (list) => list.map((e) => e.id);

const orios = race('Orios');
const medusain = race('Médusain', 'medusain');
const humain = race('Humain');
const lamia = race('Lamia');
const drassahthac = race("Drassah'thac", 'drassahthac');
const CLASSES = [
  cls('Orios', 'hybride animal'),
  cls('Médusain', 'hybride animal'),
  cls('Guerrier', 'càc'),
  cls('Lamia', 'spéciale'), // une classe qui porte le nom d'une race mais n'est pas une classe raciale
  cls('Humain', 'magique'),
];
const ALL = [orios, medusain, humain, lamia, drassahthac, ...CLASSES];

test('une race est hybride quand une classe « hybride animal » porte son nom (le titre de la page de la classe), accents ignorés', () => {
  assert.equal(raceKind(ALL, orios), 'hybride');
  assert.equal(raceKind(ALL, medusain), 'hybride');
  assert.equal(raceKind(ALL, humain), 'pure');
});

test('une classe qui porte le nom d’une race sans être une classe raciale ne rend pas la race hybride', () => {
  assert.equal(raceKind(ALL, lamia), 'pure');
  assert.equal(racialClassOf(ALL, lamia), null);
  assert.equal(racialClassOf(ALL, humain), null);
});

test('décision R14 : le Drassah’thac est une race hybride sans classe raciale', () => {
  assert.deepEqual([...HYBRIDES_SANS_CLASSE_RACIALE], ['races/drassahthac']);
  assert.equal(raceKind(ALL, drassahthac), 'hybride');
  assert.equal(racialClassOf(ALL, drassahthac), null);
});

test('racialClassOf rend la page de la classe raciale, raceOfClass la race à laquelle elle appartient', () => {
  assert.equal(racialClassOf(ALL, orios).id, 'classes/orios');
  assert.equal(raceOfClass(ALL, CLASSES[0]).id, 'races/orios');
  assert.equal(raceOfClass(ALL, CLASSES[1]).id, 'races/medusain');
  assert.equal(raceOfClass(ALL, CLASSES[2]), null, 'le Guerrier n’est la classe d’aucune race');
  assert.equal(raceOfClass(ALL, CLASSES[3]), null);
});

test('groupRaces : races pures puis races hybrides, chacune dans l’ordre du propriétaire', () => {
  const groups = groupRaces([medusain, orios, lamia, humain, drassahthac, ...CLASSES]);
  assert.deepEqual(groups.map((g) => [g.key, g.label, ids(g.entries)]), [
    ['pures', 'Races pures', ['races/humain', 'races/lamia']],
    ['hybrides', 'Races hybrides', ['races/drassahthac', 'races/orios', 'races/medusain']],
  ]);
});

test('groupRaces : une race absente de l’ordre du propriétaire vient après les autres, par titre sans tenir compte des accents', () => {
  const groups = groupRaces([race('Zébu'), race('Écureuil', 'ecureuil'), lamia, humain, ...CLASSES]);
  assert.deepEqual(ids(groups[0].entries), ['races/humain', 'races/lamia', 'races/ecureuil', 'races/zébu']);
});

test('ORDRE_DES_RACES : 27 races, chacune une seule fois', () => {
  assert.equal(ORDRE_DES_RACES.length, 27);
  assert.equal(new Set(ORDRE_DES_RACES).size, 27);
  assert.ok(ORDRE_DES_RACES.every((id) => /^races\/[a-z-]+$/.test(id)));
});

test('un groupe vide est omis ; aucune race : aucun groupe', () => {
  assert.deepEqual(groupRaces([humain, ...CLASSES]).map((g) => g.key), ['pures']);
  assert.deepEqual(groupRaces([orios, ...CLASSES]).map((g) => g.key), ['hybrides']);
  assert.deepEqual(groupRaces(CLASSES), []);
});

test('chaque race est rangée une seule fois et la liste d’origine n’est pas modifiée', () => {
  const input = [orios, humain, medusain];
  const copy = [...input];
  const groups = groupRaces([...input, ...CLASSES]);
  assert.equal(groups.flatMap((g) => g.entries).length, 3);
  assert.deepEqual(input, copy);
});
