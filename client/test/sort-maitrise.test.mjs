// Niveaux de maîtrise (NM) : fonctions pures de lib/sort-maitrise.mjs (lecture « à N NM », valeur de base d'une cellule, pastille de NM à l'écran, texte de la colonne « Bonus Maîtrise »).
// Les liens avec les vraies données (extraction des 322 sorts, accord avec la vue SQL) sont dans maitrise-sorts.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { segments } from '../src/lib/sort-format.mjs';
import { applications, bonusAuNm, lignesDeBonus, LIBELLES_CHAMP_NM, marquerBonus, NM_MAX, ORDRE_CHAMPS_NM, sansBonus, texteDeBonus, valeurAuNm } from '../src/lib/sort-maitrise.mjs';

const parNm = (champ, texteBrut, pasNm = 1, extra = {}) => ({ champ, nature: 'par_nm', texteBrut, contexte: texteBrut, pasNm, seuilNm: null, ...extra });
const palier = (champ, texteBrut, seuilNm = 3, extra = {}) => ({ champ, nature: 'palier', texteBrut, contexte: texteBrut, pasNm: null, seuilNm, ...extra });
const texte = (champ, texteBrut) => ({ champ, nature: 'texte', texteBrut, contexte: texteBrut, pasNm: null, seuilNm: null });

test('applications : « /NM » une fois par NM, « /3NM » par tranche de 3, un palier à partir de son seuil, un texte sans valeur', () => {
  const parUn = parNm('dsb', '+1d6/NM');
  assert.deepEqual([0, 1, 2, 3].map((nm) => applications(parUn, nm)), [0, 1, 2, 3]);
  const parTrois = parNm('dsb', '+1d/3NM', 3);
  assert.deepEqual([0, 1, 2, 3].map((nm) => applications(parTrois, nm)), [0, 0, 0, 1]);
  const p3 = palier('type', 'IC pour 3 NM', 3);
  assert.deepEqual([0, 1, 2, 3].map((nm) => applications(p3, nm)), [0, 0, 0, 1]);
  const p1 = palier('effets', '1NM = +3 dégâts', 1);
  assert.deepEqual([0, 1, 2, 3].map((nm) => applications(p1, nm)), [0, 1, 1, 1]);
  assert.equal(applications(texte('effets', 'Les NM sont utiles'), 2), null);
});

test('applications : un niveau de maîtrise hors de 0 à 3 est refusé (un sort cumule 3 NM au plus)', () => {
  assert.equal(NM_MAX, 3);
  assert.throws(() => applications(parNm('cout', '-5/NM'), 4), RangeError);
  assert.throws(() => applications(parNm('cout', '-5/NM'), -1), RangeError);
  assert.throws(() => applications(parNm('cout', '-5/NM'), 1.5), RangeError);
});

test('bonusAuNm : ce qui s’applique à N NM, sans ce qui vaut 0 ; les mentions sans valeur typée restent', () => {
  const bonus = [palier('type', 'IC pour 3 NM'), parNm('cout', '-5/NM'), texte('effets', 'Les NM sont utiles')];
  assert.deepEqual(bonusAuNm(bonus, 0).map((b) => b.texteBrut), ['Les NM sont utiles']);
  assert.deepEqual(bonusAuNm(bonus, 2).map((b) => [b.texteBrut, b.applications]), [['-5/NM', 2], ['Les NM sont utiles', null]]);
  assert.deepEqual(bonusAuNm(bonus, 3).map((b) => [b.texteBrut, b.applications]), [['IC pour 3 NM', 1], ['-5/NM', 3], ['Les NM sont utiles', null]]);
});

test('sansBonus : seule l’expression exacte d’un bonus reconnu, entre parenthèses, est retirée de sa cellule', () => {
  assert.equal(sansBonus('55 (-5/NM)', [parNm('cout', '-5/NM')], 'cout'), '55');
  assert.equal(sansBonus('5d6 (+3/NM) dégâts sonores', [parNm('dsb', '+3/NM')], 'dsb'), '5d6 dégâts sonores');
  assert.equal(sansBonus('7 (–1/NM) + 1 âme', [parNm('cout', '–1/NM')], 'cout'), '7 + 1 âme', 'tiret demi-cadratin de la source conservé tel quel dans l’expression');
  assert.equal(sansBonus('10 (+2 / NM)', [parNm('portee', '+2 / NM')], 'portee'), '10');
  assert.equal(sansBonus('Cercle de 2 (+1/NM)', [parNm('zone', '+1/NM')], 'zone'), 'Cercle de 2');
  // une autre colonne, ou une expression qui n'est pas isolée dans ses parenthèses : la cellule reste telle qu'écrite
  assert.equal(sansBonus('55 (-5/NM)', [parNm('dsb', '-5/NM')], 'cout'), '55 (-5/NM)');
  assert.equal(sansBonus('3 cases horizontales devant (ou verticales/3NM)', [palier('zone', '/3NM')], 'zone'), '3 cases horizontales devant (ou verticales/3NM)');
  assert.equal(sansBonus('Soi-même', [], 'portee'), 'Soi-même');
  assert.equal(sansBonus(null, [], 'dsb'), null);
});

test('lignesDeBonus et texteDeBonus : une ligne « <Colonne> : <passage> » par bonus, dans l’ordre de lecture ; null sans bonus', () => {
  const bonus = [palier('type', 'IC pour 3 NM'), parNm('cout', '-5/NM'), parNm('effets', '+1/NM', 1, { contexte: 'Dure 2 tours (+1/NM)' })];
  assert.deepEqual(lignesDeBonus(bonus).map((l) => [l.libelle, l.texte]), [['Type', 'IC pour 3 NM'], ['Coût', '-5/NM'], ['Effets', 'Dure 2 tours (+1/NM)']]);
  assert.equal(texteDeBonus(bonus), 'Type : IC pour 3 NM\nCoût : -5/NM\nEffets : Dure 2 tours (+1/NM)');
  assert.equal(texteDeBonus([]), null);
});

test('lignesDeBonus : la note de cellule (champ remarque) garde l’étiquette de sa colonne, « Remarque »', () => {
  const bonus = [palier('remarque', '3NM = x'), palier('effets', '3NM = y')];
  assert.deepEqual(lignesDeBonus(bonus).map((l) => l.libelle), ['Remarque', 'Effets']);
  assert.equal(texteDeBonus(bonus), 'Remarque : 3NM = x\nEffets : 3NM = y');
});

test('marquerBonus : l’expression d’un bonus de la colonne, entre parenthèses, devient une pastille à sa place ; le reste de la cellule ne change pas', () => {
  const nm = (groupes) => groupes.map((g) => g.map((m) => (m.nm ? `[${m.texte}]` : m.modif ? `(${m.texte})` : m.texte)).join(' '));
  assert.deepEqual(nm(marquerBonus([segments('55 (-5/NM)')], [parNm('cout', '-5/NM')], 'cout')), ['55 [-5/NM]']);
  assert.deepEqual(nm(marquerBonus([segments('5d6 (+3/NM) dégâts sonores')], [parNm('dsb', '+3/NM')], 'dsb')), ['5d6 [+3/NM] dégâts sonores'], 'à sa place, pas en fin de cellule');
  assert.deepEqual(nm(marquerBonus([segments('10 ( +2 / NM )')], [parNm('portee', '+2 / NM')], 'portee')), ['10 [+2 / NM]']);
  assert.deepEqual(nm(marquerBonus([segments('7'), segments('1 âme (–1/NM)')], [parNm('cout', '–1/NM')], 'cout')), ['7', '1 âme [–1/NM]'], 'dans la partie du coût qui l’écrit');
  // une autre précision, un bonus d'une autre colonne, une expression qui n'est pas isolée dans ses parenthèses : rien n'est marqué
  assert.deepEqual(nm(marquerBonus([segments('7 (xNP de créature)')], [parNm('cout', '-1/NM')], 'cout')), ['7 (xNP de créature)']);
  assert.deepEqual(nm(marquerBonus([segments('55 (-5/NM)')], [parNm('dsb', '-5/NM')], 'cout')), ['55 (-5/NM)']);
  assert.deepEqual(nm(marquerBonus([segments('3 cases horizontales devant (ou verticales/3NM)')], [palier('zone', '/3NM')], 'zone')), ['3 cases horizontales devant (ou verticales/3NM)']);
  // un bonus marque un seul morceau : deux écritures identiques ont deux lignes
  const deux = [segments('2d6 (+1/NM)'), segments('+2 AP (+1/NM)')];
  assert.deepEqual(nm(marquerBonus(deux, [parNm('dsb', '+1/NM')], 'dsb')), ['2d6 [+1/NM]', '+2 AP (+1/NM)']);
  assert.deepEqual(nm(marquerBonus(deux, [parNm('dsb', '+1/NM'), parNm('dsb', '+1/NM')], 'dsb')), ['2d6 [+1/NM]', '+2 AP [+1/NM]']);
  assert.deepEqual(marquerBonus([], [parNm('cout', '-5/NM')], 'cout'), []);
});

test('colonnes : chaque colonne où un bonus peut être écrit a son libellé, dans l’ordre de lecture du tableau', () => {
  assert.deepEqual(ORDRE_CHAMPS_NM, ['type', 'cout', 'portee', 'zone', 'dsb', 'effets', 'remarque']);
  assert.deepEqual(Object.keys(LIBELLES_CHAMP_NM), ORDRE_CHAMPS_NM);
});

test('valeur à N NM (fiche de personnage, demande du propriétaire) : le bonus ajouté au terme qui le précède, sinon écrit appliqué ; un palier « 3NM = » au seuil', () => {
  const inc = (champ, texteBrut, incrementBrut, pasNm = 1) => parNm(champ, texteBrut, pasNm, { incrementBrut });
  const a = (brut, bonus, nm) => valeurAuNm(brut, [bonus], bonus.champ, nm);
  // un nombre : la somme
  assert.deepEqual([0, 1, 2, 3].map((nm) => a('45 (-5/NM)', inc('cout', '-5/NM', '-5'), nm)), ['45', '40', '35', '30']);
  assert.equal(a('10 (–1/NM) + 2 âmes', inc('cout', '–1/NM', '–1'), 2), '8 + 2 âmes', 'tiret long, et ce qui suit reste');
  assert.equal(a('20Km (+20/NM)', inc('portee', '+20/NM', '+20'), 2), '60Km', 'unité collée');
  assert.equal(a('+4AM (+2AM/NM)', inc('dsb', '+2AM/NM', '+2AM'), 2), '+8AM', 'signe et unité gardés');
  assert.equal(a('-6 dégâts magiques (-2/NM)', inc('dsb', '-2/NM', '-2'), 2), '-10 dégâts magiques');
  // des dés : du même dé, le nombre de dés ; un autre dé ou un fixe, ajouté
  assert.equal(a('2d6 dégâts (+1d6/NM)', inc('dsb', '+1d6/NM', '+1d6'), 2), '4d6 dégâts');
  assert.equal(a('2d6 cr (+1d/NM)', inc('dsb', '+1d/NM', '+1d'), 1), '3d6 cr', '« +1d » : un dé de plus du même type');
  assert.equal(a('Vole 4d10 (+1d/3NM) chakra', inc('dsb', '+1d/3NM', '+1d', 3), 2), 'Vole 4d10 chakra', 'pas avant 3 NM');
  assert.equal(a('Vole 4d10 (+1d/3NM) chakra', inc('dsb', '+1d/3NM', '+1d', 3), 3), 'Vole 5d10 chakra');
  assert.equal(a('3d6 dégâts (+1d4/NM)', inc('dsb', '+1d4/NM', '+1d4'), 2), '3d6 + 2d4 dégâts');
  assert.equal(a('5d6 dégâts (+3/NM)', inc('dsb', '+3/NM', '+3'), 2), '5d6 + 6 dégâts');
  assert.equal(a('10d6 + 80 (+10/NM) dégâts', inc('dsb', '+10/NM', '+10'), 2), '10d6 + 100 dégâts', 'le fixe d’un calcul, écriture gardée');
  // pas sûr : le bonus appliqué à la place de son expression ; illisible : tel qu'écrit
  assert.equal(a('Invoque 1 ou 2 clones (+1/NM) passifs.', inc('effets', '+1/NM', '+1'), 2), 'Invoque 1 ou 2 clones (+2) passifs.');
  assert.equal(a('Malus de 25% pour 1 tour (-10%/NM)', inc('effets', '-10%/NM', '-10%'), 2), 'Malus de 25% pour 1 tour (-20%)');
  assert.equal(a('pendant 1 tour (+1 tour/NM).', inc('effets', '+1 tour/NM', '+1 tour'), 2), 'pendant 1 tour (+2 tours).');
  assert.equal(a('X sang x3 dégâts (x4/3NM)', inc('dsb', 'x4/3NM', 'x4', 3), 3), 'X sang x3 dégâts (x4/3NM)');
  assert.equal(a('Dure 2 tours (+1/NM)\nSi CR : recule.', inc('effets', '+1/NM', '+1'), 0), 'Dure 2 tours\nSi CR : recule.', 'à 0 NM, l’expression part');
  // hors parenthèses : sa valeur
  assert.equal(a('Augmente la réussite critique de 1%/NM.', inc('effets', '1%/NM', '1%'), 2), 'Augmente la réussite critique de 2%.');
  // palier « 3NM = » : l'effet seul au seuil, rien avant ; un autre palier reste tel qu'écrit
  const p3 = palier('effets', '3NM = La grenade colle la cible');
  assert.equal(a('Explose dans 1 tour. (3NM = La grenade colle la cible)', p3, 2), 'Explose dans 1 tour.');
  assert.equal(a('Explose dans 1 tour. (3NM = La grenade colle la cible)', p3, 3), 'Explose dans 1 tour. (La grenade colle la cible)');
  const libre = palier('effets', '3NM = Sur un coup critique, gel 1');
  assert.equal(a('Une simple attaque. 3NM = Sur un coup critique, gel 1.', libre, 0), 'Une simple attaque.');
  assert.equal(a('Une simple attaque. 3NM = Sur un coup critique, gel 1.', libre, 3), 'Une simple attaque. Sur un coup critique, gel 1.');
  assert.equal(a('Vampirise 25%. (50% au niveau 3 de maîtrise)', palier('effets', 'au niveau 3 de maîtrise'), 3), 'Vampirise 25%. (50% au niveau 3 de maîtrise)');
  // sans bonus, ou NM hors bornes
  assert.equal(valeurAuNm('5', [], 'portee', 2), '5');
  assert.equal(valeurAuNm(null, [], 'dsb', 1), null);
  assert.equal(a('5 (+1/NM)', inc('portee', '+1/NM', '+1'), 9), '8', 'au plus 3 NM');
});
