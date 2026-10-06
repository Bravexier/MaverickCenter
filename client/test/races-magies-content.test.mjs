// Intégrité du contenu RÉEL : les champs structurés que l'import pose sur les pages de races et de magies
// (magies_innees, nom_court, resiste_a, vulnerable_a, incompatible_avec) doivent
//   - nommer des magies qui existent,
//   - concorder avec le texte de la même page (section « Magies accessibles », bloc « Données »),
//   - respecter les effectifs connus (27 races ; races hybrides = 13 races à 3 magies et à classe raciale).
// Les listes attendues viennent de l'onglet « Accessibilité Magie » du classeur (voir sources: des pages).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { magieIndex, relationsOfMagie, unresolvedNames } from '../src/lib/magie-relations.mjs';
import { groupRaces, raceKind, racialClassOf } from '../src/lib/race-kinds.mjs';
import { normalize } from '../src/lib/text.mjs';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';

const dir = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const load = (type) =>
  readdirSync(`${dir}/${type}`)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ id: `${type}/${f.replace(/\.md$/, '')}`, ...splitFrontmatter(readFileSync(`${dir}/${type}/${f}`, 'utf8')) }))
    .filter((e) => e.data.status !== 'example')
    .map((e) => ({ id: e.id, data: e.data, body: e.body }));

const races = load('races');
const magies = load('magies');
const classes = load('classes');
const all = [...races, ...magies, ...classes];
const race = (slug) => races.find((r) => r.id === `races/${slug}`);
const names = (slug) => race(slug).data.magies_innees;

const NOMS = ['Potentiel Illimité', 'Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre'];
const HYBRIDES = {
  orios: ['Sang', 'Eau', 'Terre'],
  fenrir: ['Glace', 'Foudre', 'Ombre'],
  kitsune: ['Feu', 'Vent', 'Lumière'],
  olwman: ['Espace/Temps', 'Vent', 'Ombre'],
  rokh: ['Vent', 'Foudre', 'Lumière'],
  namazu: ['Sang', 'Eau', 'Ombre'],
  minotaure: ['Sang', 'Terre', 'Ombre'],
  satyre: ['Feu', 'Terre', 'Foudre'],
  medusain: ['Eau', 'Foudre', 'Lumière'],
  jackalope: ['Vide', 'Terre', 'Foudre'],
  marcass: ['Nécromancie', 'Feu', 'Terre'],
  anansi: ['Arcane', 'Nécromancie', 'Ombre'],
  goleois: ['Sang', 'Glace', 'Lumière'],
};
const TOUTES = ['humain', 'elfe-forestier', 'elfe-noir', 'elfe-argente', 'elfe-dore', 'farfadet', 'felfe', 'nain', 'hujin', 'drakos'];
const SANS_PI = ['majin', 'mort-vivant', 'drassahthac'];

test('les 15 magies ont un nom court unique, dans l’orthographe des en-têtes du classeur', () => {
  assert.equal(magies.length, 15);
  assert.deepEqual([...magieIndex(all).values()].map((m) => m.data.nom_court).sort(), [...NOMS].sort());
});

test('les 27 races portent la liste de leurs magies innées, et tous les noms désignent une magie existante', () => {
  assert.equal(races.length, 27);
  for (const r of races) assert.ok(Array.isArray(r.data.magies_innees), `${r.id} : magies_innees absent`);
  assert.deepEqual(unresolvedNames(all), []);
});

test('10 races ont les 15 magies, 3 races les 14 magies sans Potentiel Illimité, la Lamia 13 (sans Potentiel Illimité ni Corruption)', () => {
  for (const slug of TOUTES) assert.deepEqual([...names(slug)].sort(), [...NOMS].sort(), slug);
  for (const slug of SANS_PI) assert.deepEqual([...names(slug)].sort(), NOMS.filter((n) => n !== 'Potentiel Illimité').sort(), slug);
  assert.deepEqual([...names('lamia')].sort(), NOMS.filter((n) => n !== 'Potentiel Illimité' && n !== 'Corruption').sort());
});

test('les 13 races restreintes ont exactement les 3 magies de l’onglet « Accessibilité Magie », dans l’ordre des colonnes', () => {
  for (const [slug, expected] of Object.entries(HYBRIDES)) assert.deepEqual(names(slug), expected, slug);
});

test('races hybrides = les 13 races qui ont leur classe raciale ; elles ont exactement 3 magies innées, les races pures au moins 13', () => {
  const hybrides = races.filter((r) => raceKind(all, r) === 'hybride').map((r) => r.id.split('/')[1]).sort();
  assert.deepEqual(hybrides, Object.keys(HYBRIDES).sort());
  for (const r of races) {
    const n = r.data.magies_innees.length;
    if (raceKind(all, r) === 'hybride') {
      assert.equal(n, 3, `${r.id} : une race hybride a 3 magies innées`);
      assert.ok(racialClassOf(all, r), r.id);
    } else assert.ok(n >= 13, `${r.id} : une race pure a ${n} magies`);
  }
  const groups = groupRaces(all);
  assert.deepEqual(groups.map((g) => [g.key, g.entries.length]), [['pures', 14], ['hybrides', 13]]);
});

test('la liste structurée d’une race concorde avec la section « Magies accessibles » de sa propre page', () => {
  for (const r of races) {
    const section = r.body.split(/^## Magies accessibles\s*$/m)[1];
    assert.ok(section, `${r.id} : section absente`);
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
    const count = lines[0].match(/^Nombre : (\d+) sur (\d+)\.$/);
    assert.ok(count, `${r.id} : ligne « Nombre » absente`);
    const listed = lines[1].split(',').map((n) => n.trim());
    assert.equal(Number(count[1]), r.data.magies_innees.length, r.id);
    assert.equal(Number(count[2]), 15, r.id);
    assert.deepEqual(listed.map(normalize), r.data.magies_innees.map(normalize), `${r.id} : liste et ordre`);
  }
});

const FIELDS = [
  ['resiste_a', 'Résistance magique'],
  ['vulnerable_a', 'Vulnérabilité magique'],
  ['incompatible_avec', 'Magie non compatible'],
];

test('les relations structurées d’une magie concordent avec le bloc « Données » de sa propre page ; une phrase libre n’est jamais devinée', () => {
  const known = new Set(NOMS.map(normalize));
  for (const m of magies) {
    for (const [field, label] of FIELDS) {
      const line = m.body.split('\n').find((l) => l.startsWith(`- **${label}** :`));
      const value = line?.replace(`- **${label}** :`, '').trim();
      if (value === undefined) {
        assert.ok(!(field in m.data) || m.data[field] === undefined, `${m.id} : ${field} sans ligne « ${label} »`);
      } else if (/^aucune?s?$/i.test(value)) {
        assert.deepEqual(m.data[field], [], `${m.id} : ${field} (« Aucune »)`);
      } else {
        const parts = value.split(',').map((p) => p.trim());
        if (parts.every((p) => known.has(normalize(p)))) assert.deepEqual(m.data[field].map(normalize), parts.map(normalize), `${m.id} : ${field}`);
        else assert.ok(!(field in m.data), `${m.id} : ${field} est une phrase libre, la clé doit être omise`);
      }
    }
  }
});

test('contenu connu : le Sang résiste à Sang, Eau, Terre, est vulnérable à Glace, Nécromancie ; la Corruption n’a pas de liste d’incompatibilités propre mais est déduite des pages Arcane, Sang, Espace/Temps', () => {
  const sang = relationsOfMagie(all, magies.find((m) => m.data.nom_court === 'Sang'));
  assert.deepEqual(sang.fortContre.map((r) => r.entry.data.nom_court), ['Sang', 'Eau', 'Terre']);
  assert.deepEqual(sang.faibleContre.map((r) => r.entry.data.nom_court), ['Glace', 'Nécromancie']);
  assert.deepEqual(sang.incompatible.map((r) => r.entry.data.nom_court), ['Arcane', 'Espace/Temps', 'Corruption', 'Nécromancie']);
  const corruption = relationsOfMagie(all, magies.find((m) => m.data.nom_court === 'Corruption'));
  assert.deepEqual(corruption.incompatible.map((r) => [r.entry.data.nom_court, r.source]).sort(), [['Arcane', 'deduite'], ['Espace/Temps', 'deduite'], ['Sang', 'deduite']]);
});
