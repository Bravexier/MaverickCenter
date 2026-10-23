// L'armure et le bouclier forgés de la page /ressources/equipement/ (lib/armure-forge.mjs), décisions R75 à R80 et R93, avec des valeurs écrites ici (pas lues dans
// la base : le site de dev peut les modifier) — les tableaux d'amélioration des onglets « Armures » et « Bouclier », des armures et des matières de la grille.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ameliorationDArmure, ameliorationDeBouclier, ameliorationElementaire, choixDArmureApres, coutDeLaLigneElementaire, coutElementaireEcrit, deLaGemme,
  estElementaire, forgerArmure, forgerArmureElementaire, forgerBouclier, nombre, piecesDuMontant, prixDeLArmure, QUALITES_DES_GEMMES, UNITES_PAR_MATERIAU,
} from '../src/lib/armure-forge.mjs';
import { montantDecompose, MONNAIES_DU_JEU } from '../src/lib/monnaies.mjs';

// [niveau, coût RO, matériaux, AP, AM, crans] : « Armures (L'entièreté) » de l'onglet
const AMELIORATIONS_D_ARMURE = [[1, 100, null, 2, 2, null], [2, 100, 1, 4, 4, null], [3, 300, null, 6, 6, null], [4, 300, 1, 8, 8, 1], [5, 500, null, 10, 10, 1]]
  .map(([niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran]) => ({ niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }));
// « Bouclier » : « +4 AP + matériaux » compte 1 matériau (décision R76, migration 0046) ; coûts de 50 à 800 RO, total 1 550, depuis la mise à jour du
// classeur (Bouclier!BJ4:BJ12, migration 0048 ; 500 à 8 000 avant)
const AMELIORATIONS_DE_BOUCLIER = [[1, 50, null, 2, null, 1], [2, 100, 1, 4, null, null], [3, 200, null, 6, null, null], [4, 400, 1, 8, null, null], [5, 800, null, 10, null, 1]]
  .map(([niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran]) => ({ niveau, cout_ro, cout_materiaux, bonus_ap, bonus_am, bonus_cran }));
// « Armure Cuir/Peau » de la grille : Prix 28, Léger, +3AP, Solidité 1 ; Cuir 2 RO, Peau 1 RO ; fabrication de l'armure complète : « 1 000 RF / 10 RO »
const CUIR_PEAU = { ap: 3, am: null, solidite: 1, prix: 28 };
const CUIR = { nom: 'Cuir', prix_ro: 2 };
const PEAU = { nom: 'Peau', prix_ro: 1 };
const FABRICATION = 10;

test('décision R93 : le prix d’une armure de la grille = 10 RO de fabrication + 6 unités de chaque matériau, achetées (ou fournies : la fabrication seule)', () => {
  assert.equal(UNITES_PAR_MATERIAU, 6);
  // « Armure Cuir/Peau » : 10 + 6 × 2 + 6 × 1 = 28, le prix écrit dans la grille (comme 213 des 231 armures)
  assert.deepEqual(prixDeLArmure(FABRICATION, [2, 1]), { fabrication: 10, materiaux: 18, achetes: 28, fournis: 10 });
  // « Armure Peau/Bois » : 10 + 6 + 6 × 1,5 = 25 ; « Armure Peau/Mythril » : 10 + 6 + 1 200 = 1 216
  assert.equal(prixDeLArmure(FABRICATION, [1, 1.5]).achetes, 25);
  assert.equal(prixDeLArmure(FABRICATION, [1, 200]).achetes, 1216);
  // « Armure Corne/Bronze » : la grille écrit 800, le calcul donne 10 + 180 + 510 = 700 (« le prix est toujours de 6 unités… »)
  assert.equal(prixDeLArmure(FABRICATION, [30, 85]).achetes, 700);
  // un prix inconnu (matériau ou fabrication) : pas de prix, rien n'est deviné
  assert.equal(prixDeLArmure(FABRICATION, [2, null]).achetes, null);
  assert.deepEqual(prixDeLArmure(null, [2, 1]), { fabrication: null, materiaux: 18, achetes: null, fournis: null });
});

test('décision R93 : l’armure forgée est toujours complète ; son coût suit les matériaux (achetés ou fournis), pas le prix écrit dans la grille', () => {
  const f = forgerArmure({ ...CUIR_PEAU, prix: 9999 }, AMELIORATIONS_D_ARMURE, 0, { fabrication: FABRICATION, materiaux: [CUIR, PEAU] });
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total], [3, 0, 1]);
  assert.deepEqual(f.cout, {
    prix: 28, fabrication: 10, materiaux: [{ nom: 'Cuir', prix_ro: 2, unites: 6, total: 12 }, { nom: 'Peau', prix_ro: 1, unites: 6, total: 6 }],
    amelioration: 0, materiaux_amelioration: 0, total: 28, total_fournis: 10,
  });
  // une armure d'un seul matériau : 12 unités de ce matériau (« Armure de Cuir complète » : 10 + 24 = 34)
  const cuir = forgerArmure(CUIR_PEAU, AMELIORATIONS_D_ARMURE, 0, { fabrication: FABRICATION, materiaux: [CUIR, CUIR] });
  assert.deepEqual([cuir.cout.materiaux, cuir.cout.total], [[{ nom: 'Cuir', prix_ro: 2, unites: 12, total: 24 }], 34]);
  // un prix de matériau inconnu : pas de total acheté, le total fourni reste
  const inconnu = forgerArmure(CUIR_PEAU, AMELIORATIONS_D_ARMURE, 0, { fabrication: FABRICATION, materiaux: [CUIR, { nom: 'Peau', prix_ro: null }] });
  assert.deepEqual([inconnu.cout.total, inconnu.cout.total_fournis], [null, 10]);
});

test('décision R77 : une amélioration d’armure +N coûte les niveaux +1 à +N et donne l’AP, l’AM et les crans écrits au niveau N (+1 cran au +4 et au +5)', () => {
  assert.deepEqual(ameliorationDArmure(AMELIORATIONS_D_ARMURE, 4), { niveau: 4, ro: 800, materiaux: 2, bonus_ap: 8, bonus_am: 8, bonus_cran: 1 });
  assert.deepEqual(ameliorationDArmure(AMELIORATIONS_D_ARMURE, 5), { niveau: 5, ro: 1300, materiaux: 2, bonus_ap: 10, bonus_am: 10, bonus_cran: 1 }, 'la ligne TOTAL : 1 300 Ro + 2 Matériaux');
  assert.deepEqual(ameliorationDArmure(AMELIORATIONS_D_ARMURE, 0), { niveau: 0, ro: 0, materiaux: 0, bonus_ap: 0, bonus_am: 0, bonus_cran: 0 });
  const f = forgerArmure(CUIR_PEAU, AMELIORATIONS_D_ARMURE, 5, { fabrication: FABRICATION, materiaux: [CUIR, PEAU] });
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total], [13, 10, 2]);
  // le coût : le prix de l'armure et les RO des niveaux ; les matériaux de l'amélioration comptés sans prix (la source ne dit pas lequel des deux)
  assert.deepEqual([f.cout.total, f.cout.total_fournis, f.cout.materiaux_amelioration], [1328, 1310, 2]);
});

test('décision R80 : une armure particulière a le prix écrit de l’armure entière et s’améliore', () => {
  // « Vêtement renforcé » : Prix 80, +2AP +2AM, Solidité uni 2
  const f = forgerArmure({ ap: 2, am: 2, solidite: 2, prix: 80 }, AMELIORATIONS_D_ARMURE, 2);
  assert.deepEqual([f.ap.total, f.am.total, f.solidite.total, f.cout.total, f.cout.materiaux_amelioration], [6, 6, 2, 280, 1]);
  assert.deepEqual([f.cout.fabrication, f.cout.materiaux, f.cout.total_fournis], [null, [], null], 'ni fabrication ni matériaux');
  // un prix « ???? » (Armure montagne) : pas de total
  assert.equal(forgerArmure({ ap: 30, am: 30, solidite: 5, prix: null }, AMELIORATIONS_D_ARMURE, 2).cout.total, null);
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

// Décision R165 (2), (3) : le tableau « Armure » de l'onglet « Pièces élémentaires » (+1 : 2 gemmes communes, +2 AP/AM ; +2 : 2 gemmes raffinées, +4 ;
// +3 : 2 gemmes parfaites, +6 ; +4 : 3 gemmes parfaites, +8, +1 cran ; +5 : 1 pièce élémentaire, +10, +1 cran), écrit ici comme dans la décision.
// [niveau, gemmes, qualité, pièces élémentaires, AP, AM, crans]
const AMELIORATIONS_ELEMENTAIRES = [[1, 2, 'commune', null, 2, 2, null], [2, 2, 'raffinee', null, 4, 4, null], [3, 2, 'parfaite', null, 6, 6, null],
  [4, 3, 'parfaite', null, 8, 8, 1], [5, null, null, 1, 10, 10, 1]]
  .map(([niveau, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires, bonus_ap, bonus_am, bonus_cran]) => ({
    niveau, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires, bonus_ap, bonus_am, bonus_cran, cout_ro: null, cout_materiaux: null,
  }));
// « Garde braise » (Léger, Feu : AP 5, AM 5) ; la gemme du Feu, le Rubis (table gemme)
const GARDE_BRAISE = { ap: 5, am: 5 };
const RUBIS = 'Rubis';

test('R165 (2) : le coût cumulé d’une armure élémentaire — 0 → +2 : 2 gemmes communes + 2 raffinées ; +5 : 2 communes + 2 raffinées + 5 parfaites + 1 pièce élémentaire, en gemmes de la magie', () => {
  assert.deepEqual(ameliorationElementaire(AMELIORATIONS_ELEMENTAIRES, 0), { niveau: 0, gemmes: [], pieces_elementaires: 0, bonus_ap: 0, bonus_am: 0, bonus_cran: 0 });
  const plus2 = ameliorationElementaire(AMELIORATIONS_ELEMENTAIRES, 2);
  assert.deepEqual(plus2.gemmes, [{ qualite: 'commune', nombre: 2 }, { qualite: 'raffinee', nombre: 2 }]);
  assert.equal(plus2.pieces_elementaires, 0);
  assert.deepEqual(coutElementaireEcrit(plus2, RUBIS), ['2 gemmes communes de Rubis', '2 gemmes raffinées de Rubis']);
  // « 5 parfaites » au +5 = 2 (+3) + 3 (+4)
  const plus5 = ameliorationElementaire(AMELIORATIONS_ELEMENTAIRES, 5);
  assert.deepEqual(plus5.gemmes, [{ qualite: 'commune', nombre: 2 }, { qualite: 'raffinee', nombre: 2 }, { qualite: 'parfaite', nombre: 5 }]);
  assert.equal(plus5.pieces_elementaires, 1);
  assert.deepEqual(coutElementaireEcrit(plus5, RUBIS), ['2 gemmes communes de Rubis', '2 gemmes raffinées de Rubis', '5 gemmes parfaites de Rubis', '1 pièce élémentaire']);
  // sans gemme nommée : les mots de la source ; la pièce du +5 « 1 pièce élémentaire », comme la source ; jamais de RO
  assert.deepEqual(coutElementaireEcrit(coutDeLaLigneElementaire(AMELIORATIONS_ELEMENTAIRES[0])), ['2 gemmes communes']);
  assert.deepEqual(coutElementaireEcrit(coutDeLaLigneElementaire(AMELIORATIONS_ELEMENTAIRES[4])), ['1 pièce élémentaire']);
  assert.deepEqual(coutElementaireEcrit({ gemmes: [{ qualite: 'parfaite', nombre: 1 }], pieces_elementaires: 2 }, 'Ambre'), ['1 gemme parfaite d’Ambre', '2 pièces élémentaires']);
  assert.ok(!coutElementaireEcrit(plus5, RUBIS).join(' ').match(/\bRO\b|Ricken/), 'aucune conversion en RO');
  assert.deepEqual(Object.keys(QUALITES_DES_GEMMES), ['commune', 'raffinee', 'parfaite']);
  assert.equal(deLaGemme('Émeraude'), 'd’Émeraude');
  assert.equal(deLaGemme('Diamant rose'), 'de Diamant rose');
});

test('R165 (2), (3) : l’armure élémentaire forgée — effet de la ligne (sans cumul : au +5, +10 AP/AM et +1 cran), solidité 4 puis 5 au +4 et au +5, aucun prix', () => {
  const attendus = [[0, 5, 5, 4], [1, 7, 7, 4], [2, 9, 9, 4], [3, 11, 11, 4], [4, 13, 13, 5], [5, 15, 15, 5]];
  for (const [niveau, ap, am, solidite] of attendus) {
    const f = forgerArmureElementaire(GARDE_BRAISE, AMELIORATIONS_ELEMENTAIRES, niveau, 4);
    assert.deepEqual([f.ap.total, f.am.total, f.solidite.total], [ap, am, solidite], `+${niveau}`);
    assert.equal(f.cout.prix, null, `+${niveau} : « inestimable »`);
    assert.ok(!('total' in f.cout) && !('amelioration' in f.cout), 'aucun montant en RO');
  }
  const plus5 = forgerArmureElementaire(GARDE_BRAISE, AMELIORATIONS_ELEMENTAIRES, 5, 4);
  assert.deepEqual([plus5.ap.amelioration, plus5.am.amelioration, plus5.solidite.amelioration], [10, 10, 1], 'la ligne +5 seule, pas 2 + 4 + 6 + 8 + 10');
  assert.deepEqual(plus5.solidite, { base: 4, amelioration: 1, total: 5 });
});

test('R165 (4) : le choix de la page — élément et poids choisis, les matériaux se désélectionnent ; choisir de nouveau un matériau vide l’élément et le poids', () => {
  const vide = { m1: null, m2: null, particuliere: null, element: null, poids: null, niveau: 2 };
  let e = choixDArmureApres(vide, { genre: 'm1', valeur: 'cuir' });
  e = choixDArmureApres(e, { genre: 'm2', valeur: 'peau' });
  // un seul des deux : les matériaux restent
  e = choixDArmureApres(e, { genre: 'element', valeur: 'feu' });
  assert.deepEqual([e.m1, e.m2, e.element, e.poids, estElementaire(e)], ['cuir', 'peau', 'feu', null, false]);
  // les deux : les matériaux se désélectionnent
  e = choixDArmureApres(e, { genre: 'poids', valeur: 'leger' });
  assert.deepEqual([e.m1, e.m2, e.particuliere, e.element, e.poids, estElementaire(e)], [null, null, null, 'feu', 'leger', true]);
  assert.equal(e.niveau, 2, 'le reste de l’état est gardé');
  // un autre élément remplace le premier ; recliquer le retire
  assert.equal(choixDArmureApres(e, { genre: 'element', valeur: 'eau' }).element, 'eau');
  assert.equal(choixDArmureApres(e, { genre: 'poids', valeur: 'leger' }).poids, null);
  // revenir aux matériaux : le choix élément/poids se vide
  const retour = choixDArmureApres(e, { genre: 'm1', valeur: 'cuir' });
  assert.deepEqual([retour.m1, retour.element, retour.poids], ['cuir', null, null]);
  // une armure de la liste (de la grille ou particulière) aussi
  assert.deepEqual(Object.values(choixDArmureApres(e, { genre: 'armure', m1: 'cuir', m2: 'peau' })).slice(0, 5), ['cuir', 'peau', null, null, null]);
  assert.deepEqual(Object.values(choixDArmureApres(e, { genre: 'particuliere', valeur: 'robe' })).slice(0, 5), [null, null, 'robe', null, null]);
  assert.deepEqual(Object.values(choixDArmureApres(e, { genre: 'fermer' })).slice(0, 5), [null, null, null, null, null]);
  assert.equal(e.element, 'feu', 'l’état d’avant n’est pas modifié');
});

test('R165 : les armures ordinaires et les boucliers ne changent pas (le tableau élémentaire n’a ni RO ni matériaux)', () => {
  // une armure ordinaire ignore les colonnes des gemmes : son amélioration ne lit que RO et matériaux
  assert.deepEqual(ameliorationDArmure(AMELIORATIONS_ELEMENTAIRES, 5), { niveau: 5, ro: 0, materiaux: 0, bonus_ap: 10, bonus_am: 10, bonus_cran: 1 });
  assert.deepEqual(forgerArmure(CUIR_PEAU, AMELIORATIONS_D_ARMURE, 2, { fabrication: FABRICATION, materiaux: [CUIR, PEAU] }).cout.total, 228);
});
