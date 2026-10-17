// Couleurs de la page « Mise à jour » (lib/notes-de-version-sens.mjs, décision R29 de docs/decisions-regles.md) : les exemples du propriétaire,
// chaque critère dans les deux sens, les cas laissés neutres, et un balayage des 322 sorts et des dons de la base (aucune erreur, une valeur
// inchangée est neutre, inverser avant et après inverse le sens). Les lectures analyserDegats et analyserDuree (lib/sort-analyse.mjs) sur les
// cases réelles.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { analyserDegats, analyserDuree } from '../src/lib/sort-analyse.mjs';
import { SENS, sensDuChangement } from '../src/lib/notes-de-version-sens.mjs';

const db = ouvrirBase({ sansExemples: false });
const sorts = db.prepare('SELECT * FROM sort ORDER BY id').all();
const sort = (nom) => sorts.find((s) => s.nom === nom);
const dons = db.prepare('SELECT id, nom, type_brut FROM capacite ORDER BY id').all();
const sens = (table, colonne, avant, apres) => sensDuChangement(table, colonne, avant, apres).sens;
const INVERSE = { amelioration: 'affaiblissement', affaiblissement: 'amelioration', neutre: 'neutre' };
const COLONNES_DE_SORT = ['nom', 'type_brut', 'cout_brut', 'portee_brut', 'zone_brut', 'dsb_brut', 'effets', 'remarque', 'texte_niveau5'];

// --- Lectures ----------------------------------------------------------------------------------------------------------------------------------

test('analyserDegats : sommes de dés et de nombres suivies d’un seul effet', () => {
  assert.equal(sort('Javelot sombre').dsb_brut, '7d6 + 15 dégâts');
  assert.deepEqual(analyserDegats(sort('Javelot sombre').dsb_brut), {
    lisible: true, des: [{ nombre: 7, faces: 6 }], fixe: 15, pourcent: false, signe: 1, queue: 'dégâts', moyenne: 39.5,
  });
  assert.deepEqual(analyserDegats('3D6 dégâts'), { lisible: true, des: [{ nombre: 3, faces: 6 }], fixe: 0, pourcent: false, signe: 1, queue: 'dégâts', moyenne: 10.5 });
  assert.deepEqual(analyserDegats('+5 soin'), { lisible: true, des: [], fixe: 5, pourcent: false, signe: 1, queue: 'soin', moyenne: 5 });
  assert.deepEqual(analyserDegats('-6 dégâts magiques (-2/NM)'), { lisible: true, des: [], fixe: 6, pourcent: false, signe: -1, queue: 'dégâts magiques', moyenne: -6 });
  assert.deepEqual(analyserDegats('20% de soin'), { lisible: true, des: [], fixe: 20, pourcent: true, signe: 1, queue: 'soin', moyenne: 20 });
  // la valeur de base seulement ; « de » de tête, espaces autour de « / » et point final ne comptent pas
  assert.equal(analyserDegats('10d6 + 80 (+10/NM) dégâts').moyenne, 115);
  assert.equal(analyserDegats('4d6 de soin/tour').queue, analyserDegats('4d6 (+1d/NM) soin / tour').queue);
  assert.equal(analyserDegats('3d8 + 4 dégâts.').queue, 'dégâts');
  assert.deepEqual(analyserDegats('2d6 + 1d4 + 3 dégâts').des, [{ nombre: 2, faces: 6 }, { nombre: 1, faces: 4 }]);
  assert.equal(analyserDegats('2d6 + 1d4 + 3 dégâts').moyenne, 12.5);
  // un dé sans faces (« 1d ») : lu, sans moyenne
  assert.deepEqual(analyserDegats('-1d (-1d/3NM) de dégâts'), { lisible: true, des: [{ nombre: 1, faces: null }], fixe: 0, pourcent: false, signe: -1, queue: 'dégâts', moyenne: null });
});

test('analyserDegats : illisible plutôt que deviné', () => {
  for (const t of ['Bloque la posture Neutre', 'Variable', '+5AP, +10AM', '=>', 'X dégâts', '+X dégâts magiques', 'Soigne 6d6 (+7/NM)', '15 - 30 - 15',
    '6 Initiative et +2 Vitesse', '5d6 dégâts + 10 /tour', '-20% Réussite / +1D dégâts', '+8 dégâts, +2AM, +5% à tous les jets', 'Vitesse x2', '2d6 + 5%',
    'Donne 2d6 + 3 Barrière et 12 dégâts', '2 x 1d6 dégâts', '10/3 dégâts', '5d6 dégâts 1d4 feu', '5d6 (IC) dégâts', '', null, undefined]) {
    assert.equal(analyserDegats(t).lisible, false, JSON.stringify(t));
    assert.equal(analyserDegats(t).moyenne, null, JSON.stringify(t));
  }
});

test('analyserDegats sur les 322 sorts : 178 cases D/S/B lisibles sur 218 écrites, chacune d’un seul effet', () => {
  const ecrites = sorts.filter((s) => s.dsb_brut !== null);
  const lues = ecrites.map((s) => ({ s, a: analyserDegats(s.dsb_brut) })).filter(({ a }) => a.lisible);
  assert.equal(sorts.length, 322);
  // seuils et non égalités : la base change ; un recul net dirait qu’une lecture s’est perdue
  assert.ok(ecrites.length >= 200, `${ecrites.length} cases écrites`);
  assert.ok(lues.length >= 170, `${lues.length} cases lisibles`);
  for (const { s, a } of lues) {
    assert.ok(!/[+,=]/.test(a.queue), `${s.id} : ${s.dsb_brut}`);
    assert.ok(a.des.length > 0 || a.fixe > 0, `${s.id} : une quantité`);
    if (a.moyenne !== null) assert.equal(Math.sign(a.moyenne), a.signe, s.id);
  }
});

test('analyserDuree : une seule durée « Dure N tour(s) » ou « pendant N tour(s) »', () => {
  assert.deepEqual(analyserDuree(sort('Régénération').effets), { tours: 3 });
  assert.deepEqual(analyserDuree('Une créature dite mécanique agit de manière incohérente pendant 1 tour (+1 tour/NM).'), { tours: 1 });
  assert.deepEqual(analyserDuree('DURE 2 TOURS'), { tours: 2 });
  assert.deepEqual(analyserDuree('Pendant 4 tours, la cible saigne.'), { tours: 4 });
  assert.equal(analyserDuree('Dure 2 tours. Puis pendant 3 tours, brûle.'), null);
  assert.equal(analyserDuree('Invoque la météo « Neige » pour 3 tours (+1/NM).'), null);
  assert.equal(analyserDuree('Durent 3 tours.'), null);
  assert.equal(analyserDuree(null), null);
  const avecDuree = sorts.filter((s) => analyserDuree(s.effets) !== null);
  assert.ok(avecDuree.length >= 75, `${avecDuree.length} sorts avec une durée`);
  for (const s of avecDuree) assert.ok(Number.isInteger(analyserDuree(s.effets).tours), s.id);
});

// --- Exemples du propriétaire ------------------------------------------------------------------------------------------------------------------

test('Flash : coût « 6 » → « 8 (-1/NM) » = valeur affaiblie et NM ajouté qui baisse le coût, donc neutre', () => {
  assert.equal(sort('Flash').cout_brut, '6');
  assert.deepEqual(sensDuChangement('sort', 'cout_brut', '6', '8 (-1/NM)'), {
    sens: 'neutre',
    parties: [
      { partie: 'valeur', avant: '6', apres: '8', sens: 'affaiblissement' },
      { partie: 'nm', avant: null, apres: '-1/NM', sens: 'amelioration' },
    ],
  });
});

test('Flash : portée « 6 (+1/NM) » → « 6 » = NM retiré, affaiblissement (valeur égale : aucune partie)', () => {
  assert.equal(sort('Flash').portee_brut, '6 (+1/NM)');
  assert.deepEqual(sensDuChangement('sort', 'portee_brut', '6 (+1/NM)', '6'), {
    sens: 'affaiblissement',
    parties: [{ partie: 'nm', avant: '+1/NM', apres: null, sens: 'affaiblissement' }],
  });
});

test('Régénération : effets reformulés = neutre', () => {
  const avant = sort('Régénération').effets;
  assert.equal(avant, 'Dure 3 tours (+1/NM). Vu que c\'est une régénération, la santé récupérée par tour se détermine au premier jet.');
  const apres = 'Dure 3 tours (+1/NM). La santé récupérée par tour se détermine au premier jet, car c\'est une régénération.';
  assert.deepEqual(sensDuChangement('sort', 'effets', avant, apres), {
    sens: 'neutre',
    parties: [{
      partie: 'valeur',
      avant: 'Vu que c\'est une régénération, la santé récupérée par tour se détermine au premier jet.',
      apres: 'La santé récupérée par tour se détermine au premier jet, car c\'est une régénération.',
      sens: 'neutre',
    }],
  });
});

test('Javelot sombre : « 7D6 + 15 dégâts » → « 6D6 + 20 dégâts » = moyenne 39,5 → 41, amélioration', () => {
  assert.equal(analyserDegats('7D6 + 15 dégâts').moyenne, 39.5);
  assert.equal(analyserDegats('6D6 + 20 dégâts').moyenne, 41);
  assert.deepEqual(sensDuChangement('sort', 'dsb_brut', '7D6 + 15 dégâts', '6D6 + 20 dégâts'), {
    sens: 'amelioration',
    parties: [{ partie: 'valeur', avant: '7D6 + 15 dégâts', apres: '6D6 + 20 dégâts', sens: 'amelioration' }],
  });
  assert.equal(sens('sort', 'dsb_brut', '6D6 + 20 dégâts', '7D6 + 15 dégâts'), 'affaiblissement');
});

test('Contesté ! : « Réaction (3 fois/combat) » → « Réaction (2 fois/combat) » = moins d’utilisations, affaiblissement', () => {
  const conteste = dons.find((d) => d.nom === 'Contesté !');
  assert.equal(conteste.type_brut, 'Réaction (3 fois/combat)');
  assert.deepEqual(sensDuChangement('capacite', 'type_brut', conteste.type_brut, 'Réaction (2 fois/combat)'), { sens: 'affaiblissement', parties: null });
  assert.equal(sens('capacite', 'type_brut', 'Réaction (2 fois/combat)', 'Réaction (3 fois/combat)'), 'amelioration');
  // « (2/ Fois par combat) » : période « combat »
  assert.equal(sens('capacite', 'type_brut', conteste.type_brut, 'Réaction (2/ Fois par combat)'), 'affaiblissement');
  assert.equal(sens('capacite', 'type_brut', 'Action (1 fois/Combat)', 'Action (2/ Fois par combat)'), 'amelioration');
});

// --- Chaque critère dans les deux sens ---------------------------------------------------------------------------------------------------------

/** Un critère : avant → après donne `attendu`, et après → avant l'inverse. */
const deuxSens = (table, colonne, avant, apres, attendu) => {
  assert.equal(sens(table, colonne, avant, apres), attendu, `${colonne} : ${avant} → ${apres}`);
  assert.equal(sens(table, colonne, apres, avant), INVERSE[attendu], `${colonne} : ${apres} → ${avant}`);
};

test('coût : réduit = amélioration, augmenté = affaiblissement (chakra, Sang, âmes, NM)', () => {
  deuxSens('sort', 'cout_brut', '20', '15', 'amelioration');
  deuxSens('sort', 'cout_brut', '2 + 3 Sang', '2 + 2 Sang', 'amelioration');
  deuxSens('sort', 'cout_brut', '9 + 2 âmes', '7 + 2 âmes', 'amelioration');
  deuxSens('sort', 'cout_brut', '7 (–1/NM) + 1 âme', '6 (–1/NM) + 1 âme', 'amelioration');
  deuxSens('sort', 'cout_brut', '55 (-2/NM)', '55 (-5/NM)', 'amelioration');
  deuxSens('sort', 'cout_brut', '55', '55 (-5/NM)', 'amelioration');
  deuxSens('sort', 'cout_brut', '20 (-2/NM)', '15 (-2/NM)', 'amelioration');
  deuxSens('sort', 'cout_brut', '20 (-2/NM)', '15 (-1/NM)', 'neutre');
});

test('portée : augmentée = amélioration, réduite = affaiblissement (nombre, NM)', () => {
  deuxSens('sort', 'portee_brut', '4', '5', 'amelioration');
  deuxSens('sort', 'portee_brut', '3 (+1/NM)', '3 (+2/NM)', 'amelioration');
  deuxSens('sort', 'portee_brut', '3', '3 (+1/NM)', 'amelioration');
  deuxSens('sort', 'portee_brut', '10 (+2 / NM)', '12 (+2/NM)', 'amelioration');
});

test('zone : augmentée = amélioration, réduite = affaiblissement (même forme, NM)', () => {
  deuxSens('sort', 'zone_brut', 'Cercle de 2', 'Cercle de 3', 'amelioration');
  deuxSens('sort', 'zone_brut', 'Carré 4x4', 'Carré de 5', 'amelioration');
  deuxSens('sort', 'zone_brut', '4 cibles', '5 cibles', 'amelioration');
  deuxSens('sort', 'zone_brut', 'Cercle de 2 (+1/NM)', 'Cercle de 2 (+2/NM)', 'amelioration');
  deuxSens('sort', 'zone_brut', 'Cercle de 6', 'Cercle de 6 (+1/NM)', 'amelioration');
});

test('D/S/B : augmentés = amélioration, réduits = affaiblissement (par la moyenne, NM de même unité)', () => {
  deuxSens('sort', 'dsb_brut', '5d6 dégâts', '6d6 dégâts', 'amelioration');
  deuxSens('sort', 'dsb_brut', '8d6 + 10 dégâts', '7d6 + 15 dégâts', 'amelioration'); // 38 → 39,5
  deuxSens('sort', 'dsb_brut', '2d4 soin (+3/NM)', '2d6 soin (+3/NM)', 'amelioration');
  deuxSens('sort', 'dsb_brut', '-6 dégâts magiques', '-8 dégâts magiques', 'amelioration');
  deuxSens('sort', 'dsb_brut', '-20% dégâts magiques', '-50% dégâts magiques', 'amelioration');
  deuxSens('sort', 'dsb_brut', '2d6 dégâts (+1d6/NM)', '2d6 dégâts (+2d6/NM)', 'amelioration');
  deuxSens('sort', 'dsb_brut', '5d6 dégâts (+3/NM)', '5d6 dégâts (+5/NM)', 'amelioration');
  deuxSens('sort', 'dsb_brut', '2d6 dégâts', '2d6 dégâts (+1d6/NM)', 'amelioration');
  deuxSens('sort', 'dsb_brut', '-6 dégâts magiques (-2/NM)', '-6 dégâts magiques (-3/NM)', 'amelioration');
  deuxSens('sort', 'dsb_brut', '+2AP (+1AP/NM)', '+2AP (+2AP/NM)', 'amelioration');
  assert.equal(sens('sort', 'dsb_brut', '7d6 dégâts', '7d6 + 0 dégâts'), 'neutre'); // même moyenne
});

test('nombre de tours : augmenté = amélioration, réduit = affaiblissement (durée, NM sur la durée)', () => {
  deuxSens('sort', 'effets', 'Dure 2 tours.', 'Dure 3 tours.', 'amelioration');
  deuxSens('sort', 'effets', 'Augmente l\'armure magique pendant 3 tours.', 'Augmente l\'armure magique pendant 4 tours.', 'amelioration');
  deuxSens('sort', 'effets', 'Dure 2 tours (+1/NM)', 'Dure 2 tours (+2/NM)', 'amelioration');
  deuxSens('sort', 'effets', 'Dure 2 tours', 'Dure 2 tours (+1/NM)', 'amelioration');
  deuxSens('sort', 'effets', 'Invoque l\'orage pour 3 tours.', 'Invoque l\'orage pour 3 tours (+1/NM).', 'amelioration');
  deuxSens('sort', 'effets', 'Agit de manière incohérente pendant 1 tour (+1 tour/NM).', 'Agit de manière incohérente pendant 1 tour (+2 tours/NM).', 'amelioration');
  assert.deepEqual(sensDuChangement('sort', 'effets', 'Dure 2 tours (+1/NM). Brûle la cible.', 'Dure 3 tours (+1/NM). Brûle la cible.'), {
    sens: 'amelioration',
    parties: [{ partie: 'valeur', avant: '2 tours', apres: '3 tours', sens: 'amelioration' }],
  });
});

test('effet secondaire : ajouté = amélioration, retiré = affaiblissement, reformulé = neutre', () => {
  const avant = sort('Flash').effets;
  const apres = `${avant} Inflige Brûlure stade 1.`;
  assert.deepEqual(sensDuChangement('sort', 'effets', avant, apres), {
    sens: 'amelioration',
    parties: [{ partie: 'valeur', avant: null, apres: 'Inflige Brûlure stade 1.', sens: 'amelioration' }],
  });
  deuxSens('sort', 'effets', avant, apres, 'amelioration');
  deuxSens('sort', 'effets', 'Brûle la cible.', 'Brûle la cible.\nSi CR : brûle aussi ses voisins.', 'amelioration');
  deuxSens('sort', 'effets', 'Si jet de vigueur raté = Inflige brûlure 1.', 'Si jet de vigueur raté = Inflige brûlure 1. (3 NM = Inflige brûlure stade 2)', 'amelioration');
  // casse, accents et ponctuation ne font pas une reformulation
  assert.equal(sens('sort', 'effets', 'Brûle la cible.', 'brule la cible ! Gèle la cible.'), 'amelioration');
  assert.equal(sens('sort', 'effets', 'Brûle la cible.', 'Gèle la cible.'), 'neutre');
});

test('plusieurs morceaux : d’accord = leur sens, en désaccord = neutre (les parties gardent le détail)', () => {
  assert.equal(sens('sort', 'effets', 'Dure 2 tours. Brûle la cible.', 'Dure 3 tours. Brûle la cible. Gèle la cible.'), 'amelioration');
  assert.deepEqual(sensDuChangement('sort', 'effets', 'Dure 3 tours.', 'Dure 2 tours. Gèle la cible.'), {
    sens: 'neutre',
    parties: [
      { partie: 'valeur', avant: '3 tours', apres: '2 tours', sens: 'affaiblissement' },
      { partie: 'valeur', avant: null, apres: 'Gèle la cible.', sens: 'amelioration' },
    ],
  });
  assert.equal(sens('sort', 'cout_brut', '20 (-1/NM)', '15'), 'neutre'); // coût réduit, NM retiré
});

test('NM d’une valeur de base qui change de nature (forme de zone, effet de D/S/B, coût illisible) : neutre, comme le changement lui-même', () => {
  assert.deepEqual(sensDuChangement('sort', 'zone_brut', '1', 'Cercle de 2 (+1/NM)'), {
    sens: 'neutre',
    parties: [
      { partie: 'valeur', avant: '1', apres: 'Cercle de 2', sens: 'neutre' },
      { partie: 'nm', avant: null, apres: '+1/NM', sens: 'neutre' },
    ],
  });
  assert.equal(sens('sort', 'zone_brut', 'Cercle de 2 (+1/NM)', 'Ligne de 5 (+2/NM)'), 'neutre');
  assert.equal(sens('sort', 'zone_brut', 'Cercle de 2 (+1/NM)', 'Cercle de 3 (+2/NM)'), 'amelioration'); // même forme
  assert.equal(sens('sort', 'dsb_brut', '2d6 soin (+3/NM)', '2d6 dégâts (+5/NM)'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '2d6 soin', '2d6 dégâts (+1d6/NM)'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '+6 dégâts (+2/NM)', '-6 dégâts (+3/NM)'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', 'Soigne 2d6 (+2/NM)', 'Soigne 2d6 (+3/NM)'), 'amelioration'); // même case, illisible : seul le NM change
  assert.equal(sens('sort', 'dsb_brut', 'Soigne 2d6 (+2/NM)', 'Soigne 3d6 (+3/NM)'), 'neutre');
  assert.equal(sens('sort', 'portee_brut', '6 (+1/NM)', 'Vue (+2/NM)'), 'neutre');
  assert.equal(sens('sort', 'cout_brut', 'Variable', '8 (-1/NM)'), 'neutre');
  assert.equal(sens('sort', 'cout_brut', 'Variable', 'Variable (-1/NM)'), 'amelioration');
  assert.equal(sens('sort', 'cout_brut', '10 + X Sang', '10 + 4 Sang (-1/NM)'), 'neutre');
});

test('plus d’utilisations, de santé ou de chakra = amélioration, moins = affaiblissement', () => {
  deuxSens('capacite', 'type_brut', 'Actif (1 fois/combat)', 'Actif (2 fois/combat)', 'amelioration');
  deuxSens('capacite', 'type_brut', 'Action (1 fois/24h)', 'Action (3 fois/24h)', 'amelioration');
  deuxSens('capacite', 'type_brut', 'Actif (2 fois/Combat)', 'Actif (3 fois/combat)', 'amelioration');
  for (const [table, colonne] of [['classe', 'sante_depart'], ['classe', 'chakra_depart'], ['race_onglet', 'sante_depart'], ['race_onglet', 'chakra_depart'],
    ['magie', 'sante_offerte'], ['magie', 'chakra_offert']]) {
    deuxSens(table, colonne, 20, 25, 'amelioration');
    deuxSens(table, colonne, '10', '8', 'affaiblissement');
    assert.deepEqual(sensDuChangement(table, colonne, 20, 25), { sens: 'amelioration', parties: null });
  }
});

// --- Neutre ------------------------------------------------------------------------------------------------------------------------------------

test('neutre : forme de zone, nature de portée, D/S/B d’effets différents, NM incomparables', () => {
  assert.equal(sens('sort', 'zone_brut', 'Cercle de 2', 'Cône'), 'neutre');
  assert.equal(sens('sort', 'zone_brut', 'Cercle de 3', 'Carré de 4'), 'neutre');
  assert.equal(sens('sort', 'zone_brut', 'Rectangle 5x2', 'Rectangle 6x2'), 'neutre'); // taille non lue
  assert.equal(sens('sort', 'zone_brut', 'Cercle de 2 (+1/NM)', 'Cercle de 2 (+1/3NM)'), 'neutre'); // pas différent : rien n'est calculé
  assert.equal(sens('sort', 'portee_brut', '6', 'Vue'), 'neutre');
  assert.equal(sens('sort', 'portee_brut', 'Soi-même', '1'), 'neutre');
  assert.equal(sens('sort', 'portee_brut', '10km', '20Km'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '2d6 dégâts', '3d6 soin'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '+5AP', '+6AM'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '+6 dégâts', '-6 dégâts'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '20 dégâts', '20% dégâts'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', 'Variable', '5d6 dégâts'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '+1d de dégâts', '+2d de dégâts'), 'neutre'); // pas de moyenne sans faces
  assert.equal(sens('sort', 'dsb_brut', '2d6 dégâts (+1d6/NM)', '2d6 dégâts (+1d4/NM)'), 'neutre');
  assert.equal(sens('sort', 'dsb_brut', '5d6 dégâts (+3/NM)', '5d6 dégâts (+1d6/NM)'), 'neutre');
  assert.equal(sens('sort', 'cout_brut', '2 + 3 Sang', '2 + 3 âmes'), 'neutre');
  assert.equal(sens('sort', 'cout_brut', 'Variable', '5'), 'neutre');
  assert.equal(sens('sort', 'cout_brut', '13 (-1/NM)', '13 (xNP de créature)'), 'neutre'); // coût devenu illisible : son NM ne se compare plus
});

test('neutre : NM des effets qui ne porte pas sur la durée, durée illisible', () => {
  assert.deepEqual(sensDuChangement('sort', 'effets', '1 boule (+1/NM) va apparaître.', '1 boule (+2/NM) va apparaître.'), {
    sens: 'neutre',
    parties: [{ partie: 'nm', avant: '+1/NM', apres: '+2/NM', sens: 'neutre' }],
  });
  assert.equal(sens('sort', 'effets', 'Permet d\'infliger un bonus de +2 (+1/NM) dégâts pendant 2 tours.', 'Permet d\'infliger un bonus de +2 (+2/NM) dégâts pendant 2 tours.'), 'neutre');
  assert.equal(sens('sort', 'effets', 'Malus de 25% pour 1 tour (-10%/NM).', 'Malus de 25% pour 1 tour (-5%/NM).'), 'neutre');
  assert.equal(sens('sort', 'effets', 'Dure 2 tours. Puis pendant 3 tours, brûle.', 'Dure 2 tours. Puis pendant 4 tours, brûle.'), 'neutre');
  // « pour N tours » n'est pas une durée lue (« Dure » ou « pendant » seulement) : reformulation
  assert.equal(sens('sort', 'effets', 'Invoque le brouillard obscur pour 3 tours (+1/NM).', 'Invoque le brouillard obscur pour 4 tours (+1/NM).'), 'neutre');
});

test('effets : chaque expression de NM est lue à sa place (une boule et une durée dans la même phrase)', () => {
  // le NM de la boule change, celui de la durée non : neutre (et non « NM de la durée retiré »)
  assert.deepEqual(sensDuChangement('sort', 'effets', '1 boule (+1/NM) va apparaître pendant 2 tours (+1/NM).', '1 boule (+2/NM) va apparaître pendant 2 tours (+1/NM).'), {
    sens: 'neutre',
    parties: [{ partie: 'nm', avant: '+1/NM', apres: '+2/NM', sens: 'neutre' }],
  });
  assert.deepEqual(sensDuChangement('sort', 'effets', '1 boule (+1/NM) va apparaître pendant 2 tours (+1/NM).', '1 boule (+1/NM) va apparaître pendant 2 tours (+2/NM).'), {
    sens: 'amelioration',
    parties: [{ partie: 'nm', avant: '+1/NM', apres: '+2/NM', sens: 'amelioration' }],
  });
  // une durée écrite dans un palier de NM n'est pas celle de la case : son changement reste visible
  assert.deepEqual(sensDuChangement('sort', 'effets', 'Dure 2 tours. (3NM = brûle pendant 2 tours)', 'Dure 3 tours. (3NM = brûle pendant 1 tour)'), {
    sens: 'amelioration',
    parties: [
      { partie: 'valeur', avant: '2 tours', apres: '3 tours', sens: 'amelioration' },
      { partie: 'valeur', avant: '(3NM = brûle pendant 2 tours)', apres: '(3NM = brûle pendant 1 tour)', sens: 'neutre' },
    ],
  });
});

test('neutre : textes libres, type, mode, barrière, vitesses, autres tables, valeurs égales', () => {
  assert.equal(sens('sort', 'type_brut', 'Attaque', 'Attaque (IC)'), 'neutre');
  assert.equal(sens('sort', 'type_brut', 'Attaque', 'Attaque/ Entrave (Imparable)'), 'neutre');
  assert.equal(sens('sort', 'nom', 'Flash', 'Grand flash'), 'neutre');
  assert.equal(sens('sort', 'remarque', null, 'Ne marche pas sous l\'eau.'), 'neutre');
  assert.equal(sens('sort', 'texte_niveau5', 'a', 'b'), 'neutre');
  assert.equal(sens('capacite', 'type_brut', 'Réaction (2 fois/combat)', 'Action (3 fois/combat)'), 'neutre');
  assert.equal(sens('capacite', 'type_brut', 'Actif (1 fois/combat)', 'Actif (2 fois/24h)'), 'neutre');
  assert.equal(sens('capacite', 'type_brut', 'Passif', 'Passif (1 fois/combat)'), 'neutre');
  assert.equal(sens('capacite', 'type_brut', 'Actif (2 CK/Case)', 'Actif (3 CK/Case)'), 'neutre');
  assert.equal(sens('capacite', 'description', 'Court.', 'Plus long.'), 'neutre');
  assert.equal(sens('classe', 'barriere_depart', 10, 20), 'neutre');
  assert.equal(sens('race_onglet', 'barriere_bonus', 1, 2), 'neutre');
  assert.equal(sens('race_onglet', 'vitesse_sol', 4, 6), 'neutre');
  assert.equal(sens('race_onglet', 'vitesse_nage', 2, 3), 'neutre');
  assert.equal(sens('classe', 'sante_depart', null, 20), 'neutre');
  assert.equal(sens('metier', 'bonus', '+1', '+2'), 'neutre');
  assert.equal(sens('page', 'corps_md', 'Lorem.', 'Lorem ipsum.'), 'neutre');
  assert.deepEqual(sensDuChangement('sort', 'cout_brut', '55 (-5/NM)', '55 (-5/NM)'), { sens: 'neutre', parties: null });
  assert.deepEqual(sensDuChangement('classe', 'sante_depart', 20, '20'), { sens: 'neutre', parties: null });
  assert.deepEqual(sensDuChangement('sort', 'dsb_brut', null, null), { sens: 'neutre', parties: null });
  assert.deepEqual(SENS, ['amelioration', 'affaiblissement', 'neutre']);
});

// --- Balayage de la base -----------------------------------------------------------------------------------------------------------------------

/** Forme d'un résultat : un sens connu, des parties null ou un tableau non vide de { partie, avant, apres, sens }. */
const formeValide = (r, message) => {
  assert.ok(SENS.includes(r.sens), message);
  if (r.parties === null) return;
  assert.ok(Array.isArray(r.parties) && r.parties.length > 0, message);
  for (const p of r.parties) {
    assert.deepEqual(Object.keys(p), ['partie', 'avant', 'apres', 'sens'], message);
    assert.ok(['valeur', 'nm'].includes(p.partie), message);
    assert.ok(SENS.includes(p.sens), message);
    for (const v of [p.avant, p.apres]) assert.ok(v === null || (typeof v === 'string' && v.length > 0), message);
    assert.ok(p.avant !== null || p.apres !== null, message);
  }
};

test('322 sorts : une valeur réelle inchangée est neutre ; chaque case comparée à celle du sort suivant ne lève rien, et l’inverse inverse le sens', () => {
  assert.equal(sorts.length, 322);
  const compte = Object.fromEntries(SENS.map((s) => [s, 0]));
  for (const c of COLONNES_DE_SORT) {
    for (let i = 0; i < sorts.length; i++) {
      const a = sorts[i][c];
      const b = sorts[(i + 1) % sorts.length][c];
      assert.deepEqual(sensDuChangement('sort', c, a, a), { sens: 'neutre', parties: null }, `${sorts[i].id} : ${c}`);
      const r = sensDuChangement('sort', c, a, b);
      const r2 = sensDuChangement('sort', c, b, a);
      formeValide(r, `${sorts[i].id} : ${c}`);
      formeValide(r2, `${sorts[i].id} : ${c} (inverse)`);
      assert.equal(r2.sens, INVERSE[r.sens], `${sorts[i].id} : ${c} : ${JSON.stringify(a)} ⇄ ${JSON.stringify(b)}`);
      compte[r.sens] += 1;
    }
  }
  // les colonnes lues donnent des couleurs, les autres jamais
  assert.ok(compte.amelioration > 100 && compte.affaiblissement > 100, JSON.stringify(compte));
  for (const c of ['nom', 'type_brut', 'remarque', 'texte_niveau5']) {
    for (let i = 0; i < sorts.length; i++) assert.equal(sens('sort', c, sorts[i][c], sorts[(i + 1) % sorts.length][c]), 'neutre');
  }
});

test('dons : un type réel inchangé est neutre ; chaque type comparé au suivant ne lève rien, et l’inverse inverse le sens', () => {
  assert.ok(dons.length > 600);
  for (let i = 0; i < dons.length; i++) {
    const a = dons[i].type_brut;
    const b = dons[(i + 1) % dons.length].type_brut;
    assert.deepEqual(sensDuChangement('capacite', 'type_brut', a, a), { sens: 'neutre', parties: null }, dons[i].id);
    const r = sensDuChangement('capacite', 'type_brut', a, b);
    formeValide(r, dons[i].id);
    assert.equal(r.parties, null);
    assert.equal(sens('capacite', 'type_brut', b, a), INVERSE[r.sens], `${dons[i].id} : ${a} ⇄ ${b}`);
  }
});

test('balises du glossaire : une case se lit sans elles (le texte affiché) ; une balise posée ne change pas le sens', () => {
  assert.deepEqual(analyserDegats('2d6 + 3 {{barriere|Barrière}}'), analyserDegats('2d6 + 3 Barrière'));
  assert.equal(analyserDegats('+5% de {{chakra|chakra}}').lisible, analyserDegats('+5% de chakra').lisible);
  assert.deepEqual(analyserDuree('Régénère 5 {{chakra|chakra}}. Dure 3 tours.'), { tours: 3 });
  assert.deepEqual(sensDuChangement('sort', 'dsb_brut', '+5% de chakra', '+5% de {{chakra|chakra}}'), { sens: 'neutre', parties: null });
  assert.deepEqual(sensDuChangement('sort', 'effets', 'Vole 10 chakra.', 'Vole 10 {{chakra|chakra}}.'), { sens: 'neutre', parties: null });
  assert.equal(sens('sort', 'dsb_brut', '2d6 + 3 {{barriere|Barrière}}', '3d6 + 3 {{barriere|Barrière}}'), 'amelioration');
  assert.equal(sens('sort', 'effets', 'Dure 2 tours, vole du {{chakra|chakra}}.', 'Dure 3 tours, vole du {{chakra|chakra}}.'), 'amelioration');
});
