import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { groupRaces, HYBRIDES_SANS_CLASSE_RACIALE, ORDRE_DES_RACES, RACE_COLORS, raceKind, racialClassOf, raceOfClass, TAG_RACE_HYBRIDE } from '../src/lib/race-kinds.mjs';

// les mots-clés d'une page par leur id (`data.mots_cles` : lib/wiki.ts), jamais par leur écriture (décision R195)
const race = (title, slug = title.toLowerCase(), ...ids) => ({ id: `races/${slug}`, data: { title, mots_cles: ['race', ...ids] } });
const cls = (title, ...ids) => ({ id: `classes/${title.toLowerCase()}`, data: { title, mots_cles: ['classe', ...ids] } });
const ids = (list) => list.map((e) => e.id);

const orios = race('Orios');
const medusain = race('Médusain', 'medusain');
const humain = race('Humain');
const lamia = race('Lamia');
const drassahthac = race("Drassah'thac", 'drassahthac');
const CLASSES = [
  cls('Orios', 'hybride-animal'),
  cls('Médusain', 'hybride-animal'),
  cls('Guerrier', 'cac'),
  cls('Lamia', 'speciale'), // une classe qui porte le nom d'une race mais n'est pas une classe raciale
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

test('groupRaces sans ordre : races pures puis races hybrides, chacune dans l’ordre figé du propriétaire (ORDRE_DES_RACES : la fiche, /magies/)', () => {
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

// Réponse du propriétaire « /races/ suit, le reste figé » (migration 0092) : le menu latéral des races, /races/ et le tableau des magies innées passent
// l'ordre de la liste (race.rang_liste, lib/races.ts#ordreDeLaListeDesRaces) ; groupRaces garde les groupes par nature, l'ordre vient de l'appelant
test('groupRaces avec un ordre : toujours pures puis hybrides, chaque groupe trié par le comparateur reçu (rang_liste), jamais mêlés', () => {
  const rangs = new Map([['races/medusain', 1], ['races/orios', 2], ['races/drassahthac', 3], ['races/lamia', 4], ['races/humain', 5]]);
  const ordre = (a, b) => rangs.get(a.id) - rangs.get(b.id);
  const groups = groupRaces([humain, orios, lamia, medusain, drassahthac, ...CLASSES], ordre);
  assert.deepEqual(groups.map((g) => [g.key, ids(g.entries)]), [
    ['pures', ['races/lamia', 'races/humain']],
    ['hybrides', ['races/medusain', 'races/orios', 'races/drassahthac']],
  ]);
});

test('groupRaces : chaque groupe porte sa nature, dont la page pose la classe de couleur (celle du bandeau des pages de race)', () => {
  const groups = groupRaces([humain, orios, ...CLASSES]);
  assert.deepEqual(groups.map((g) => [g.key, g.nature]), [['pures', 'pure'], ['hybrides', 'hybride']]);
  assert.ok(groups.every((g) => !('couleur' in g)), 'plus de couleur : la classe de la nature (lib/palette-css.mjs#classeDeRace)');
  assert.deepEqual(Object.keys(RACE_COLORS), ['pure', 'hybride'], 'une couleur par nature (raceKind)');
  assert.notEqual(RACE_COLORS.pure, RACE_COLORS.hybride);
});

test('R195 : la classe raciale et la race créée hybride se lisent par l’id du mot-clé, jamais par son écriture', () => {
  // « race hybride » (TAG_RACE_HYBRIDE) sous un autre libellé : la race reste hybride ; son écriture d'origine sans l'id : pure
  assert.equal(raceKind([], { id: 'races/lycan', data: { title: 'Lycan', tags: ['Race', 'Hybride (à classe)'], mots_cles: ['race', TAG_RACE_HYBRIDE] } }), 'hybride');
  assert.equal(raceKind([], { id: 'races/lycan', data: { title: 'Lycan', tags: ['race', 'race hybride'], mots_cles: ['race'] } }), 'pure');
  // la classe raciale : l'id `hybride-animal`, pas le libellé « hybride animal »
  const parLibelle = { id: 'classes/orios', data: { title: 'Orios', tags: ['classe', 'hybride animal'], mots_cles: ['classe'] } };
  assert.equal(racialClassOf([parLibelle], orios), null);
  assert.equal(racialClassOf([cls('Orios', 'hybride-animal')], orios)?.id, 'classes/orios');
});

test('ORDRE_DES_RACES : les races de l’import (R1, R239 : 29 avec Fongoïde et Gémidien), chacune une seule fois', () => {
  // l'effectif se lit à l'import (le site de dev crée des races, qui viennent après la liste, par titre)
  const db = ouvrirBase();
  try {
    const importees = historiqueSite(db).lignesDImport('race').map((r) => r.id);
    assert.deepEqual([...ORDRE_DES_RACES].sort(), [...importees].sort());
  } finally {
    db.close();
  }
  assert.equal(new Set(ORDRE_DES_RACES).size, ORDRE_DES_RACES.length);
  assert.ok(ORDRE_DES_RACES.every((id) => /^races\/[a-z-]+$/.test(id)));
  // R239 (1) : Fongoïde et Gémidien, races pures, à la fin des pures (avant le Drassah'thac, première hybride)
  const i = ORDRE_DES_RACES.indexOf('races/drassahthac');
  assert.deepEqual(ORDRE_DES_RACES.slice(i - 2, i), ['races/fongoide', 'races/gemidien']);
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
