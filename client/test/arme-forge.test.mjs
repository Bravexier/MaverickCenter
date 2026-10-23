// L'arme forgée de l'onglet Armes de /ressources/equipement/ (lib/arme-forge.mjs) : l'exemple du propriétaire, avec des valeurs écrites ici (pas lues dans la base :
// le site de dev peut les modifier) — Espadon (deux mains) en titane, amélioration +5.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ameliorationCumulee, coutElementaireCumule, forgerArme, forgerArmeElementaire, nombre, notationDesDegats, QUALITES_DES_GEMMES, texteDuCoutElementaire,
} from '../src/lib/arme-forge.mjs';
import { coutsElementairesCumules, QUALITES_DES_GEMMES as QUALITES_DB } from '../src/lib/armes-db.mjs';

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

// Armes élémentaires (décision R167) : le tableau d'amélioration fondu (« Niveau | Coût matériel | Coût élémentaire | Effet », migration 0081), son coût
// élémentaire tel que l'onglet « Pièces élémentaires » l'écrit (A60:F78), valeurs écrites ici comme ci-dessus.
const AMELIORATIONS_FONDUES = AMELIORATIONS.map((a, i) => ({
  ...a,
  ...[[1, 'commune'], [2, 'commune'], [3, 'commune'], [1, 'raffinee'], [2, 'raffinee'], [3, 'raffinee'], [1, 'parfaite'], [2, 'parfaite'], [3, 'parfaite'], [null, null]]
    .map(([cout_gemmes, cout_gemmes_qualite]) => ({ cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires: cout_gemmes ? null : 1 }))[i],
}));
// l'Arc de Sang : le dé et la portée de son type (Arc : D8, 2-10), « +8 Dégâts », la solidité de base d'une arme élémentaire (4 crans)
const ARC_DE_SANG = { de: 'D8', bonus_degats: 8, solidite: 4 };

test('R167 : arme élémentaire sans amélioration — dé du type + 8, solidité 4, aucune gemme', () => {
  const f = forgerArmeElementaire(ARC_DE_SANG, AMELIORATIONS_FONDUES, 0);
  assert.equal(f.degats, 'D8+8');
  assert.deepEqual(f.durabilite, { arme: 4, amelioration: 0, total: 4 });
  assert.deepEqual(f.cout, { gemmes: { commune: 0, raffinee: 0, parfaite: 0 }, pieces_elementaires: 0 });
  assert.equal(texteDuCoutElementaire(f.cout, 'Grenat'), '');
  assert.ok(!('ro_total' in f.cout) && !('materiaux' in f.cout), 'ni RO ni matériau');
});

test('R167 : Arc de Sang +5 = D8+18, solidité 5, 6 communes + 3 raffinées de Grenat (le coût est cumulatif, l’effet celui de la ligne)', () => {
  const f = forgerArmeElementaire(ARC_DE_SANG, AMELIORATIONS_FONDUES, 5);
  assert.equal(f.degats, 'D8+18');
  assert.deepEqual(f.bonus, { arme: 8, amelioration: 10, total: 18 });
  assert.equal(f.durabilite.total, 5);
  assert.deepEqual(f.cout.gemmes, { commune: 6, raffinee: 3, parfaite: 0 });
  assert.equal(texteDuCoutElementaire(f.cout, 'Grenat'), '6 communes + 3 raffinées de Grenat');
  // « passer du 0 au 2 demande 1+2 = 3 gemmes communes »
  assert.equal(texteDuCoutElementaire(forgerArmeElementaire(ARC_DE_SANG, AMELIORATIONS_FONDUES, 2).cout, 'Grenat'), '3 communes de Grenat');
  assert.equal(texteDuCoutElementaire(forgerArmeElementaire(ARC_DE_SANG, AMELIORATIONS_FONDUES, 1).cout, 'Grenat'), '1 commune de Grenat');
});

test('R167 : la solidité est 4 + les crans de LA ligne (pas leur somme) — 4 du +1 au +4, 5 du +5 au +9, 6 au +10', () => {
  const solidites = Array.from({ length: 11 }, (_, n) => forgerArmeElementaire(ARC_DE_SANG, AMELIORATIONS_FONDUES, n).durabilite.total);
  assert.deepEqual(solidites, [4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6]);
});

test('R167 : au +10, le total de la ligne TOTAL de l’onglet (B80:F80) — 6 communes, 6 raffinées, 6 parfaites et 1 pièce élémentaire ; D8+28', () => {
  const f = forgerArmeElementaire(ARC_DE_SANG, AMELIORATIONS_FONDUES, 10);
  assert.deepEqual(f.cout, { gemmes: { commune: 6, raffinee: 6, parfaite: 6 }, pieces_elementaires: 1 });
  assert.equal(f.degats, 'D8+28');
  assert.equal(f.durabilite.total, 6);
  assert.equal(texteDuCoutElementaire(f.cout, 'Grenat'), '6 communes + 6 raffinées + 6 parfaites de Grenat + 1 pièce élémentaire');
  assert.equal(texteDuCoutElementaire(f.cout, null), '6 gemmes communes + 6 gemmes raffinées + 6 gemmes parfaites + 1 pièce élémentaire', 'sans gemme connue');
});

test('R167 : Pugilat élémentaire — les dés selon la Force + 8', () => {
  assert.equal(forgerArmeElementaire({ de: 'D6/D8/D10', bonus_degats: 8, solidite: 4 }, AMELIORATIONS_FONDUES, 3).degats, 'D6/D8/D10+14');
});

test('le cumul du coût élémentaire est celui de lib/armes-db.mjs#coutsElementairesCumules (que le script de la page ne peut pas importer)', () => {
  assert.deepEqual(QUALITES_DES_GEMMES, QUALITES_DB);
  const db = coutsElementairesCumules(AMELIORATIONS_FONDUES);
  for (let n = 1; n <= 10; n += 1) {
    const { gemmes, pieces_elementaires } = coutElementaireCumule(AMELIORATIONS_FONDUES, n);
    assert.deepEqual({ niveau: n, gemmes, pieces_elementaires }, db[n - 1], `+${n}`);
  }
});
