import assert from 'node:assert/strict';
import { test } from 'node:test';
import { magieIndex, magiesOfRace, racesOfMagie, relationsOfMagie, accessMatrix, relationMatrix, unresolvedNames } from '../src/lib/magie-relations.mjs';

const magie = (slug, nom, extra = {}) => ({ id: `magies/${slug}`, data: { title: `Magie ${nom}`, nom_court: nom, ...extra } });
const race = (slug, title, magies) => ({ id: `races/${slug}`, data: { title, ...(magies ? { magies_innees: magies } : {}) } });
const ids = (list) => list.map((e) => e.id);

const feu = magie('feu', 'Feu', { resiste_a: ['Feu', 'Glace'], vulnerable_a: ['Eau'], incompatible_avec: [] });
const eau = magie('eau', 'Eau', { resiste_a: ['Eau', 'Feu'], vulnerable_a: [], incompatible_avec: [] });
const glace = magie('glace', 'Glace', { resiste_a: ['Glace'], vulnerable_a: ['Feu'], incompatible_avec: ['Espace/Temps'] });
const temps = magie('espace-temps', 'Espace/Temps', { resiste_a: ['Espace/Temps'], vulnerable_a: ['Vide'] });
const pi = magie('potentiel-illimite', 'Potentiel Illimité', { resiste_a: [], vulnerable_a: [], incompatible_avec: [] });
const corruption = magie('corruption', 'Corruption'); // phrase libre dans la source : aucune liste
const MAGIES = [feu, eau, glace, temps, pi, corruption];

test('magieIndex retrouve une magie par son nom court, sans casse ni accents', () => {
  const index = magieIndex([...MAGIES, race('r', 'R', ['Feu'])]);
  assert.equal(index.get('espace-temps').id, 'magies/espace-temps');
  assert.equal(index.get('potentiel-illimite').id, 'magies/potentiel-illimite');
  assert.equal(index.size, MAGIES.length, 'seules les pages de magies avec un nom court sont indexées');
});

test('magiesOfRace garde l’ordre de la source, signale les noms inconnus et dit si la race a toutes les magies', () => {
  const entries = [...MAGIES, race('orios', 'Orios', ['Feu', 'Eau']), race('humain', 'Humain', MAGIES.map((m) => m.data.nom_court)), race('x', 'X', ['Feu', 'Magie inconnue'])];
  const orios = magiesOfRace(entries, entries.find((e) => e.id === 'races/orios'));
  assert.deepEqual(ids(orios.magies), ['magies/feu', 'magies/eau'], 'ordre de la source, pas alphabétique');
  assert.equal(orios.total, MAGIES.length);
  assert.equal(orios.toutes, false);
  assert.equal(magiesOfRace(entries, entries.find((e) => e.id === 'races/humain')).toutes, true);
  const x = magiesOfRace(entries, entries.find((e) => e.id === 'races/x'));
  assert.deepEqual(x.missing, ['Magie inconnue']);
  assert.deepEqual(ids(x.magies), ['magies/feu']);
});

test('une race sans données (champ absent) n’a ni magies ni exclusion : null', () => {
  const entries = [...MAGIES, race('exemple', 'Exemple')];
  assert.equal(magiesOfRace(entries, entries.at(-1)), null);
});

test('racesOfMagie sépare les races qui peuvent l’avoir en magie innée et celles qui ne le peuvent pas, dans l’ordre de la liste /races/', () => {
  const entries = [
    ...MAGIES,
    race('orios', 'Orios', ['Eau', 'Feu']),
    race('elfe-noir', 'Elfe Noir', ['Glace']),
    race('anansi', 'Anansi', ['Feu', 'Glace']),
    race('humain', 'Humain', ['Feu']),
    race('zzz', 'Absente de la liste', ['Feu']),
    race('aaa', 'Aussi absente', ['Feu']),
    race('exemple', 'Exemple'),
  ];
  const result = racesOfMagie(entries, feu);
  // ORDRE_DES_RACES (lib/race-kinds.mjs) : Humain… puis Orios… puis Anansi ; pures et hybrides mêlées dans une seule liste ; une race absente de l'ordre vient après, par titre
  assert.deepEqual(ids(result.avec), ['races/humain', 'races/orios', 'races/anansi', 'races/zzz', 'races/aaa']);
  assert.deepEqual(ids(result.sans), ['races/elfe-noir']);
  assert.ok(!ids([...result.avec, ...result.sans]).includes('races/exemple'), 'une race sans données n’est dans aucune des deux listes');
});

test('relationsOfMagie : fort contre = résiste à, faible contre = vulnérable à, dans l’ordre de la source ; une magie qui se cite est signalée', () => {
  const rel = relationsOfMagie(MAGIES, feu);
  assert.deepEqual(rel.fortContre.map((r) => [r.entry.id, r.self]), [['magies/feu', true], ['magies/glace', false]]);
  assert.deepEqual(rel.faibleContre.map((r) => [r.entry.id, r.self]), [['magies/eau', false]]);
  assert.deepEqual(rel.manquants, []);
});

test('« Aucune » (liste vide) se distingue d’une donnée absente (null)', () => {
  const vide = relationsOfMagie(MAGIES, pi);
  assert.deepEqual([vide.fortContre, vide.faibleContre, vide.incompatible], [[], [], []]);
  const absente = relationsOfMagie(MAGIES, corruption);
  assert.equal(absente.fortContre, null);
  assert.equal(absente.faibleContre, null);
});

test('les incompatibilités sont symétriques : une magie citée par une autre page l’est aussi, marquée « déduite »', () => {
  const corr = relationsOfMagie(MAGIES, temps);
  assert.deepEqual(corr.incompatible.map((r) => [r.entry.id, r.source]), [['magies/glace', 'deduite']], 'l’Espace/Temps n’en déclare aucune, la Glace le cite');
  const direct = relationsOfMagie(MAGIES, glace);
  assert.deepEqual(direct.incompatible.map((r) => [r.entry.id, r.source]), [['magies/espace-temps', 'directe']]);
  const deux = [magie('a', 'A', { incompatible_avec: ['B'] }), magie('b', 'B', { incompatible_avec: ['A'] })];
  assert.deepEqual(relationsOfMagie(deux, deux[0]).incompatible.map((r) => [r.entry.id, r.source]), [['magies/b', 'directe']], 'pas de doublon quand les deux pages se citent');
});

test('une magie sans aucune incompatibilité connue donne une liste vide, pas null, si une autre page peut la citer', () => {
  assert.deepEqual(relationsOfMagie(MAGIES, feu).incompatible, []);
});

test('un nom de magie inconnu dans une relation est rapporté, sans faire échouer le rendu', () => {
  const faux = magie('faux', 'Faux', { resiste_a: ['Feu', 'Pas une magie'] });
  const rel = relationsOfMagie([...MAGIES, faux], faux);
  assert.deepEqual(ids(rel.fortContre.map((r) => r.entry)), ['magies/feu']);
  assert.deepEqual(rel.manquants, ['Pas une magie']);
});

test('accessMatrix : une ligne par race avec données, une colonne par magie, case vraie si la race peut l’avoir', () => {
  const entries = [...MAGIES, race('orios', 'Orios', ['Eau', 'Feu']), race('anansi', 'Anansi', ['Glace']), race('exemple', 'Exemple')];
  const m = accessMatrix(entries);
  assert.deepEqual(ids(m.races), ['races/anansi', 'races/orios'], 'triées par titre ; la race sans données est absente');
  assert.deepEqual(m.magies.map((e) => e.data.nom_court), ['Corruption', 'Eau', 'Espace/Temps', 'Feu', 'Glace', 'Potentiel Illimité'].sort((a, b) => a.localeCompare(b, 'fr')));
  const eauCol = m.magies.findIndex((e) => e.id === 'magies/eau');
  assert.equal(m.cells[1][eauCol], true, 'Orios peut avoir l’Eau');
  assert.equal(m.cells[0][eauCol], false, 'Anansi ne le peut pas');
});

test('relationMatrix : symboles croisés, ligne = la magie décrite', () => {
  const m = relationMatrix(MAGIES);
  const at = (a, b) => m.cells[m.magies.findIndex((e) => e.id === a)][m.magies.findIndex((e) => e.id === b)];
  assert.deepEqual(at('magies/feu', 'magies/glace'), { fort: true, faible: false, incompatible: false });
  assert.deepEqual(at('magies/feu', 'magies/eau'), { fort: false, faible: true, incompatible: false });
  assert.deepEqual(at('magies/glace', 'magies/espace-temps'), { fort: false, faible: false, incompatible: true });
  assert.deepEqual(at('magies/espace-temps', 'magies/glace'), { fort: false, faible: false, incompatible: true }, 'symétrique');
  assert.equal(at('magies/corruption', 'magies/feu'), null, 'aucune donnée pour la Corruption : case vide, pas « aucune relation »');
});

test('accessMatrix et relationMatrix : colonnes dans l’ordre donné (celui du classeur), une magie hors de l’ordre vient après, par nom', () => {
  const ordre = ['magies/potentiel-illimite', 'magies/corruption', 'magies/espace-temps', 'magies/feu'];
  const entries = [...MAGIES, race('orios', 'Orios', ['Eau', 'Feu'])];
  const attendu = ['Potentiel Illimité', 'Corruption', 'Espace/Temps', 'Feu', 'Eau', 'Glace'];
  const acces = accessMatrix(entries, ordre);
  assert.deepEqual(acces.magies.map((e) => e.data.nom_court), attendu);
  assert.deepEqual(acces.cells[0], [false, false, false, true, true, false], 'les cases suivent les colonnes');
  const rel = relationMatrix(MAGIES, ordre);
  assert.deepEqual(rel.magies.map((e) => e.data.nom_court), attendu, 'lignes et colonnes dans le même ordre');
  assert.deepEqual(rel.cells[3][4], { fort: false, faible: true, incompatible: false }, 'Feu (ligne 4) faible contre Eau (colonne 5)');
});

test('unresolvedNames liste, par page, les noms de magies qui ne correspondent à aucune magie', () => {
  const a = magie('a', 'A', { resiste_a: ['A', 'B'], incompatible_avec: ['Fantôme'] });
  const b = magie('b', 'B', { vulnerable_a: ['Nulle part'] });
  const entries = [a, b, race('x', 'X', ['A', 'Inconnue']), race('ok', 'Ok', ['a', 'B'])];
  assert.deepEqual(unresolvedNames(entries), [
    { id: 'magies/a', field: 'incompatible_avec', name: 'Fantôme' },
    { id: 'magies/b', field: 'vulnerable_a', name: 'Nulle part' },
    { id: 'races/x', field: 'magies_innees', name: 'Inconnue' },
  ]);
  assert.deepEqual(unresolvedNames([a, b, race('ok', 'Ok', ['a', 'B'])]).filter((u) => u.id === 'races/ok'), [], 'noms comparés sans casse');
});
