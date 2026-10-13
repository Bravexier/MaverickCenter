// L'arme forgée de la page /ressources/armes/ (lib/arme-forge.mjs) : l'exemple du propriétaire, avec des valeurs écrites ici (pas lues dans la base :
// le site de dev peut les modifier) — Espadon (deux mains) en titane, amélioration +5.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ameliorationCumulee, forgerArme, nombre, notationDesDegats } from '../src/lib/arme-forge.mjs';

// le tableau des améliorations d'arme de l'onglet (coût, effet)
const AMELIORATIONS = [
  [1, 20, null, 2, null], [2, 50, 1, 4, null], [3, 100, null, 6, null], [4, 150, 1, 8, null], [5, 200, null, 10, 1],
  [6, 200, 1, 12, 1], [7, 200, null, 14, 1], [8, 200, 1, 16, 1], [9, 200, null, 18, 1], [10, 200, 1, 20, 2],
].map(([niveau, cout_ro, cout_materiaux, bonus_degats, bonus_cran]) => ({ niveau, cout_ro, cout_materiaux, bonus_degats, bonus_cran }));
const ESPADON = { de: 'D10', bonus_degats: 10, durabilite: 2, cout_ro: 100 };
const TITANE = { nom: 'Titane', bonus_degats: 9, cran_solidite: 1, prix_ro: 200 };

test('exemple du propriétaire : Espadon en titane +5 = D10+29 ; 620 RO et 3 titanes, ou 1 220 RO', () => {
  const f = forgerArme(ESPADON, TITANE, AMELIORATIONS, 5);
  assert.equal(f.degats, 'D10+29');
  assert.deepEqual(f.bonus, { arme: 10, materiau: 9, amelioration: 10, total: 29 });
  assert.deepEqual(f.cout, { arme: 100, amelioration: 520, materiaux: 3, prix_materiau: 200, ro_materiaux_fournis: 620, ro_total: 1220 });
});

test('amélioration +N : les coûts des niveaux 1 à N, l’effet du niveau N (pas la somme des effets)', () => {
  assert.deepEqual(ameliorationCumulee(AMELIORATIONS, 5), { niveau: 5, ro: 520, materiaux: 2, bonus_degats: 10, bonus_cran: 1 });
  assert.deepEqual(ameliorationCumulee(AMELIORATIONS, 10), { niveau: 10, ro: 1520, materiaux: 5, bonus_degats: 20, bonus_cran: 2 }, 'la ligne TOTAL de l’onglet');
  assert.deepEqual(ameliorationCumulee(AMELIORATIONS, 0), { niveau: 0, ro: 0, materiaux: 0, bonus_degats: 0, bonus_cran: 0 });
});

test('durabilité (décision R51) : celle de l’arme, plus le cran du matériau et celui de l’amélioration, jamais moins de 1', () => {
  assert.deepEqual(forgerArme(ESPADON, TITANE, AMELIORATIONS, 10).durabilite, { arme: 2, materiau: 1, amelioration: 2, total: 5 });
  // un Katana (1 seul cran) en fonte (−1 cran) : 1, pas 0
  assert.equal(forgerArme({ ...ESPADON, durabilite: 1 }, { nom: 'Fonte', bonus_degats: 7, cran_solidite: -1, prix_ro: 40 }, AMELIORATIONS, 0).durabilite.total, 1);
  assert.equal(forgerArme({ ...ESPADON, durabilite: 1 }, { nom: 'Fonte', bonus_degats: 7, cran_solidite: -1, prix_ro: 40 }, AMELIORATIONS, 5).durabilite.total, 1);
});

test('sans amélioration, en fer (aucun bonus) : le dé seul, le coût de l’arme et un matériau', () => {
  const f = forgerArme({ de: 'D8', bonus_degats: null, durabilite: 2, cout_ro: 7 }, { nom: 'Fer', bonus_degats: null, cran_solidite: null, prix_ro: 10 }, AMELIORATIONS, 0);
  assert.equal(f.degats, 'D8');
  assert.deepEqual(f.cout, { arme: 7, amelioration: 0, materiaux: 1, prix_materiau: 10, ro_materiaux_fournis: 7, ro_total: 17 });
});

test('écritures : malus de dégâts avec le signe moins, milliers séparés', () => {
  assert.equal(notationDesDegats('D10', -2), 'D10−2');
  assert.equal(notationDesDegats('D6/D8/D10', 5), 'D6/D8/D10+5');
  assert.equal(nombre(1220), '1 220');
  assert.equal(nombre(620), '620');
});
