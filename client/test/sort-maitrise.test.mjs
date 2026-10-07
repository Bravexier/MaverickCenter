// Niveaux de maîtrise (NM) : fonctions pures de lib/sort-maitrise.mjs (lecture « à N NM », valeur de base d'une cellule, texte de la colonne « Bonus Maîtrise »).
// Les liens avec les vraies données (extraction des 322 sorts, accord avec la vue SQL) sont dans maitrise-sorts.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applications, bonusAuNm, lignesDeBonus, LIBELLES_CHAMP_NM, NM_MAX, ORDRE_CHAMPS_NM, sansBonus, texteDeBonus } from '../src/lib/sort-maitrise.mjs';

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

test('lignesDeBonus à l’écran : la note de cellule (champ remarque) est lue sous « Effets » ; la colonne de la base garde « Remarque »', () => {
  const bonus = [palier('remarque', '3NM = x'), palier('effets', '3NM = y')];
  assert.deepEqual(lignesDeBonus(bonus, { affiche: true }).map((l) => l.libelle), ['Effets', 'Effets']);
  assert.deepEqual(lignesDeBonus(bonus).map((l) => l.libelle), ['Remarque', 'Effets']);
  assert.equal(texteDeBonus(bonus), 'Remarque : 3NM = x\nEffets : 3NM = y', 'le texte de sort.bonus_maitrise ne change pas');
});

test('colonnes : chaque colonne où un bonus peut être écrit a son libellé, dans l’ordre de lecture du tableau', () => {
  assert.deepEqual(ORDRE_CHAMPS_NM, ['type', 'cout', 'portee', 'zone', 'dsb', 'effets', 'remarque']);
  assert.deepEqual(Object.keys(LIBELLES_CHAMP_NM), ORDRE_CHAMPS_NM);
});
