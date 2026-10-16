// L'armure et le bouclier forgés de la page /ressources/equipement/ (lib/armure-forge.mjs), décisions R75 à R80 et R93, avec des valeurs écrites ici (pas lues dans
// la base : le site de dev peut les modifier) — les tableaux d'amélioration des onglets « Armures » et « Bouclier », des armures et des matières de la grille.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ameliorationDArmure, ameliorationDeBouclier, forgerArmure, forgerBouclier, nombre, piecesDuMontant } from '../src/lib/armure-forge.mjs';
import { montantDecompose, MONNAIES_DU_JEU } from '../src/lib/monnaies.mjs';

// [niveau, coût RO, matériaux, AP, AM, crans] : « Armures (L'entièreté) » de l'onglet
const AMELIORATIONS_D_ARMURE = [[1, 100, null, 2, 2, null], [2, 100, 1, 4, 4, null], [3, 300, null, 6, 6, null], [4, 300, 1, 8, 8, 1], [5, 500, null, 10, 10, 1]]
  .map(([niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran]) => ({ niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }));
// « Bouclier » : « +4 AP + matériaux » compte 1 matériau (décision R76, migration 0046) ; coûts de 50 à 800 RO, total 1 550, depuis la mise à jour du
// classeur (Bouclier!BJ4:BJ12, migration 0048 ; 500 à 8 000 avant)
const AMELIORATIONS_DE_BOUCLIER = [[1, 50, null, 2, null, 1], [2, 100, 1, 4, null, null], [3, 200, null, 6, null, null], [4, 400, 1, 8, null, null], [5, 800, null, 10, null, 1]]
  .map(([niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran]) => ({ niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }));
// « Armure Cuir/Peau » de la grille : Prix 28, Léger, +3AP, Solidité 1
const CUIR_PEAU = { ap: 3, am: null, solidite: 1, prix: 28 };

test('décision R93 : une armure ne se fabrique que complète, au prix écrit dans la grille (R75) ; plus de prix par pièce', () => {
  const f = forgerArmure(CUIR_PEAU, AMELIORATIONS_D_ARMURE, 0);
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total], [3, 0, 1]);
  assert.deepEqual(f.cout, { prix: 28, amelioration: 0, materiaux_amelioration: 0, total: 28 });
  assert.ok(!('piece' in f.cout) && !('amelioration_possible' in f), 'ni pièce ni amélioration retirée');
  // un prix « ???? » (Armure montagne) : pas de total
  assert.equal(forgerArmure({ ap: 30, am: 30, solidite: 5, prix: null }, AMELIORATIONS_D_ARMURE, 2).cout.total, null);
});

test('décision R77 : une amélioration d’armure +N coûte les niveaux +1 à +N et donne l’AP, l’AM et les crans écrits au niveau N (+1 cran au +4 et au +5)', () => {
  assert.deepEqual(ameliorationDArmure(AMELIORATIONS_D_ARMURE, 4), { niveau: 4, ro: 800, materiaux: 2, bonus_ap: 8, bonus_am: 8, bonus_cran: 1 });
  assert.deepEqual(ameliorationDArmure(AMELIORATIONS_D_ARMURE, 5), { niveau: 5, ro: 1300, materiaux: 2, bonus_ap: 10, bonus_am: 10, bonus_cran: 1 }, 'la ligne TOTAL : 1 300 Ro + 2 Matériaux');
  assert.deepEqual(ameliorationDArmure(AMELIORATIONS_D_ARMURE, 0), { niveau: 0, ro: 0, materiaux: 0, bonus_ap: 0, bonus_am: 0, bonus_cran: 0 });
  const f = forgerArmure(CUIR_PEAU, AMELIORATIONS_D_ARMURE, 5);
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total], [13, 10, 2]);
  // le coût : le prix de la grille et les RO des niveaux ; les matériaux de l'amélioration comptés sans prix (la source ne dit pas lequel des deux)
  assert.deepEqual([f.cout.total, f.cout.materiaux_amelioration], [1328, 2]);
});

test('décision R80 : une armure particulière a le prix de l’armure entière et s’améliore', () => {
  // « Vêtement renforcé » : Prix 80, +2AP +2AM, Solidité uni 2
  const f = forgerArmure({ ap: 2, am: 2, solidite: 2, prix: 80 }, AMELIORATIONS_D_ARMURE, 2);
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total, f.cout.total, f.cout.materiaux_amelioration], [6, 6, 2, 280, 1]);
});

test('décision R78 : un bouclier = une forme + une matière ; sa solidité est celle de la matière ; prix et défense ceux du bouclier préfabriqué', () => {
  // « Écu Titane » : Prix 810, +28AP +16AM ; Titane (boucliers) : Solidité 4, 200 RO
  const titane = { nom: 'Titane', solidite: 4, prix_ro: 200 };
  const f = forgerBouclier({ ap: 28, am: 16, prix: 810 }, titane, AMELIORATIONS_DE_BOUCLIER, 0);
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total, f.cout.ro_total], [28, 16, 4, 810]);
  // « Bouclier Rond Argent » : prix vide dans la source
  assert.equal(forgerBouclier({ ap: 15, am: null, prix: null }, { nom: 'Argent', solidite: 3, prix_ro: 35 }, AMELIORATIONS_DE_BOUCLIER, 1).cout.ro_total, null);
});

test('décision R76 : amélioration de bouclier, crans cumulés (+1 du +1 au +4, +2 au +5), « + matériaux » = 1 matériau de la matière aux +2 et +4, AP du niveau N', () => {
  for (const [n, crans] of [[1, 1], [2, 1], [3, 1], [4, 1], [5, 2]]) assert.equal(ameliorationDeBouclier(AMELIORATIONS_DE_BOUCLIER, n).bonus_cran, crans, `+${n}`);
  assert.deepEqual(ameliorationDeBouclier(AMELIORATIONS_DE_BOUCLIER, 5), { niveau: 5, ro: 1550, materiaux: 2, bonus_ap: 10, bonus_am: 0, bonus_cran: 2 }, 'la ligne TOTAL : 1550');
  const titane = { nom: 'Titane', solidite: 4, prix_ro: 200 };
  const f = forgerBouclier({ ap: 28, am: 16, prix: 810 }, titane, AMELIORATIONS_DE_BOUCLIER, 5);
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total], [38, 16, 6]);
  // 810 + 1 550 RO et 2 titanes fournis, ou 2 760 RO en les achetant
  assert.deepEqual([f.cout.ro_materiaux_fournis, f.cout.materiaux, f.cout.ro_total], [2360, 2, 2760]);
});

test('montants (décision R79 : les prix de la grille sont des RO) : la même décomposition en PP / RO / RF que lib/monnaies.mjs (décision R63), nombres à la française', () => {
  for (const ro of [0.5, 1, 4, 28, 810, 1245.5, 16710]) {
    const attendu = montantDecompose(Math.round(ro * MONNAIES_DU_JEU.RO.valeur_rf));
    assert.deepEqual(piecesDuMontant(ro), attendu.length ? attendu : [{ nombre: 0, abr: 'RO' }], String(ro));
  }
  assert.deepEqual(piecesDuMontant(0), [{ nombre: 0, abr: 'RO' }]);
  assert.equal(nombre(16710), '16 710');
  assert.equal(nombre(1.5), '1,5');
});
