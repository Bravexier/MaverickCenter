// Découpages des cases des onglets « Armures » et « Bouclier » (lib/armure-champs.mjs) : rejoués sur toute la base, ils redonnent chaque colonne tirée
// (prix, AP, AM d'une armure, d'un bouclier, d'une matière ; résistances et faiblesses ; coût en RF d'une pièce ; prix d'une forme ; Force d'un poids ;
// coût et effet d'une amélioration ; ligne TOTAL). Un changement du découpage qui ne redonne plus la base demande une migration. Le site de dev, qui
// modifie ces cases, refait ces colonnes par les mêmes découpages (serveur/edition-armures.mjs) : l'égalité vaut aussi après ses modifications.
// Depuis la demande du propriétaire du 2026-10-17, l'AP et l'AM d'une armure et d'un bouclier, et les quatre cases d'une amélioration de bouclier, sont
// saisis, et leurs textes en sont refaits : chaque texte de la base se lit EXACTEMENT en ces valeurs (defenseExacte, ameliorationDeBouclierExacte), si
// bien qu'aucune valeur n'a eu à être réécrite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ameliorationDeBouclierExacte, analyserAmeliorationDeProtection, CASES_D_AMELIORATION_DE_BOUCLIER, colonnesDeLArmure, colonnesDuBouclier, coutDeLaPiece,
  defenseEcrite, defenseExacte, degatsDeLArmure, forceDuPoids, nombreEcrit, prixDeLaForme, statsDeProtection, textesDeBouclierEcrits,
  textesDeLAmeliorationDeBouclier, texteDeLaDefense, totalDesAmeliorationsDeProtection, TYPES_D_ARMURE,
} from '../src/lib/armure-champs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase();
const lignes = (sql, ...p) => db.prepare(sql).all(...p);
const egal = (a, b) => (a ?? null) === (b ?? null);

test('écritures : nombres, stats, résistances et faiblesses, coût d’une pièce, amélioration (« + matériaux » d’un bouclier : décision R76)', () => {
  assert.deepEqual([nombreEcrit('2 050'), nombreEcrit('1,5'), nombreEcrit('1207,5'), nombreEcrit('100.0'), nombreEcrit('????'), nombreEcrit('')], [2050, 1.5, 1207.5, 100, null, null]);
  assert.deepEqual(statsDeProtection('+13AP+12AM'), { ap: 13, am: 12 });
  assert.deepEqual(statsDeProtection('+2AM'), { ap: null, am: 2 });
  assert.deepEqual(statsDeProtection('Aucune'), { ap: null, am: null });
  assert.deepEqual(degatsDeLArmure('x2 Frappe', 'Estoc/Taille'), [
    { sens: 'resistance', sens_brut: 'Résistance', type_degats: 'frappe', multiplicateur: 2 },
    { sens: 'vulnerabilite', sens_brut: 'Faiblesse', type_degats: 'estoc', multiplicateur: null },
    { sens: 'vulnerabilite', sens_brut: 'Faiblesse', type_degats: 'taille', multiplicateur: null },
  ]);
  assert.deepEqual(degatsDeLArmure(null, ''), []);
  assert.deepEqual([coutDeLaPiece('1 000 RF / 10 RO'), coutDeLaPiece('100 RF / 1 R0'), coutDeLaPiece('250 RF / Classe')], [1000, 100, null]);
  assert.deepEqual(analyserAmeliorationDeProtection('armure', '100 + 1 Matériau', '+8 AP/AM, +1 cran de solidité'),
    { cout_ro: 100, cout_materiaux: 1, bonus_ap: 8, bonus_am: 8, bonus_cran: 1 });
  assert.deepEqual(analyserAmeliorationDeProtection('bouclier', '1000', '+4 AP + matériaux'), { cout_ro: 1000, cout_materiaux: 1, bonus_ap: 4, bonus_am: null, bonus_cran: null });
  assert.deepEqual(analyserAmeliorationDeProtection('armure', '1000', '+4 AP + matériaux').cout_materiaux, null, '« + matériaux » ne compte que pour un bouclier (R76)');
  assert.equal(analyserAmeliorationDeProtection('bouclier', '1000', '+4 AP + 2 matériaux').cout_materiaux, 2, 'un nombre écrit dans l’effet compte');
  assert.equal(analyserAmeliorationDeProtection('bouclier', '1000 + 1 Matériau', '+4 AP + matériaux').cout_materiaux, 2, 'le coût et l’effet s’ajoutent');
  assert.equal(analyserAmeliorationDeProtection('armure', '100 + 0 Matériau', '+2 AP/AM').cout_materiaux, null, '0 matériau : aucun (la colonne n’admet que 1 et plus)');
  assert.equal(totalDesAmeliorationsDeProtection('armure', [{ cout_ro: 100, cout_materiaux: null }, { cout_ro: 1200, cout_materiaux: null }]), '1 300 Ro', 'sans matériau, pas de « + 0 Matériau »');
  assert.equal(forceDuPoids('3 de Force minimum'), 3);
  assert.equal(prixDeLaForme('12,5'), 12.5);
});

test('défense : lue exactement en AP et AM, écrite depuis eux, gardée telle qu’écrite tant qu’elle dit la même chose (demande du propriétaire, 2026-10-17)', () => {
  assert.deepEqual(defenseExacte('+10AP +14AM'), { ap: 10, am: 14 });
  assert.deepEqual(defenseExacte('+13AP+12AM'), { ap: 13, am: 12 }, 'sans espace');
  assert.deepEqual(defenseExacte('+2AM'), { ap: null, am: 2 });
  assert.deepEqual(defenseExacte('+3AM +2AP'), { ap: 2, am: 3 }, 'dans un ordre ou dans l’autre');
  assert.deepEqual(defenseExacte('Aucune'), { ap: null, am: null });
  assert.deepEqual(defenseExacte('-2 ap'), { ap: -2, am: null });
  for (const x of ['', '+5AP environ', '+5AP +6AP', '+2AP/+2AM', 'Voir effet', '+5APM', '+5']) assert.equal(defenseExacte(x), null, JSON.stringify(x));
  assert.deepEqual([texteDeLaDefense(10, 14), texteDeLaDefense(null, 2), texteDeLaDefense(3, null), texteDeLaDefense(null, null), texteDeLaDefense(-1, 0)],
    ['+10AP +14AM', '+2AM', '+3AP', 'Aucune', '-1AP +0AM']);
  assert.equal(defenseEcrite(13, 12, '+13AP+12AM'), '+13AP+12AM', 'l’écriture de la source reste');
  assert.equal(defenseEcrite(13, 11, '+13AP+12AM'), '+13AP +11AM', 'une autre défense : refaite');
  assert.equal(defenseEcrite(null, null, '+1AP'), 'Aucune');
  assert.equal(defenseEcrite(4, null, '+4AP (lourd)'), '+4AP', 'un texte qui dit autre chose que l’AP et l’AM : refait');
});

test('amélioration de bouclier : coût et effet lus exactement en quatre cases, écrits depuis elles, gardés tant qu’ils disent la même chose', () => {
  assert.deepEqual(CASES_D_AMELIORATION_DE_BOUCLIER, ['cout_ro', 'cout_materiaux', 'bonus_ap', 'bonus_cran']);
  assert.deepEqual(ameliorationDeBouclierExacte('50', '+2 AP, +1 cran de solidité'), { cout_ro: 50, cout_materiaux: null, bonus_ap: 2, bonus_am: null, bonus_cran: 1 });
  assert.deepEqual(ameliorationDeBouclierExacte('100', '+4 AP + matériaux'), { cout_ro: 100, cout_materiaux: 1, bonus_ap: 4, bonus_am: null, bonus_cran: null }, '« + matériaux » : 1 (R76)');
  assert.deepEqual(ameliorationDeBouclierExacte('100 + 1 Matériau', '+4 AP'), { cout_ro: 100, cout_materiaux: 1, bonus_ap: 4, bonus_am: null, bonus_cran: null }, 'le matériau du côté du coût');
  assert.deepEqual(ameliorationDeBouclierExacte('1 000', 'Aucun'), { cout_ro: 1000, cout_materiaux: null, bonus_ap: null, bonus_am: null, bonus_cran: null });
  for (const [cout, effet] of [
    ['100 + 1 Matériau', '+4 AP + matériaux'], // deux matériaux en tout : une case oui / non ne les dit pas
    ['100', '+4 AP + 2 matériaux'], ['100', '+4 AP/AM'], ['100', '+4 AP, +2 AM'], ['100', '+4 AP, +2 crans de solidité'], ['100', '+4 AP, brille'],
    ['100,5', '+4 AP'], ['1 Matériau', '+4 AP'], ['20 RO + 1 gemme', '+2 AP'], ['100', '+10 dégâts'],
  ]) assert.equal(ameliorationDeBouclierExacte(cout, effet), null, `${cout} | ${effet}`);
  assert.deepEqual(textesDeLAmeliorationDeBouclier({ cout_ro: 100, cout_materiaux: 1, bonus_ap: 4, bonus_cran: null }), { cout_brut: '100 + 1 Matériau', effet_brut: '+4 AP' });
  assert.deepEqual(textesDeLAmeliorationDeBouclier({ cout_ro: 50, cout_materiaux: null, bonus_ap: 2, bonus_cran: 1 }), { cout_brut: '50', effet_brut: '+2 AP, +1 cran de solidité' });
  assert.deepEqual(textesDeLAmeliorationDeBouclier({ cout_ro: 0, cout_materiaux: null, bonus_ap: null, bonus_cran: null }), { cout_brut: '0', effet_brut: 'Aucun' });
  const source = { cout_brut: '100', effet_brut: '+4 AP + matériaux' };
  assert.deepEqual(textesDeBouclierEcrits({ cout_ro: 100, cout_materiaux: 1, bonus_ap: 4, bonus_cran: null }, source), source, 'l’écriture de la source reste');
  assert.deepEqual(textesDeBouclierEcrits({ cout_ro: 100, cout_materiaux: 1, bonus_ap: 5, bonus_cran: null }, source), { cout_brut: '100 + 1 Matériau', effet_brut: '+5 AP' });
  // chaque écriture refaite se relit en ses cases
  for (const cases of [{ cout_ro: 800, cout_materiaux: 1, bonus_ap: 10, bonus_cran: 1 }, { cout_ro: 0, cout_materiaux: null, bonus_ap: -1, bonus_cran: null }]) {
    const t = textesDeLAmeliorationDeBouclier(cases);
    assert.deepEqual(ameliorationDeBouclierExacte(t.cout_brut, t.effet_brut), { ...cases, bonus_am: null }, JSON.stringify(t));
  }
});

test('armures : prix, AP, AM, clé du nom et résistances refaits depuis leurs cases, sur toute la base ; un type de la liste', () => {
  const armures = lignes('SELECT * FROM armure');
  assert.ok(armures.length > 200, 'les armures de la grille et les particulières');
  for (const a of armures) {
    // la défense écrite se lit exactement en l'AP et l'AM de la ligne : rien n'est perdu à les saisir à part (demande du propriétaire, 2026-10-17)
    assert.deepEqual(defenseExacte(a.stats_brut), { ap: a.ap, am: a.am }, `${a.id} : « ${a.stats_brut} »`);
    const c = colonnesDeLArmure(a);
    assert.deepEqual(Object.keys(c), ['nom_cle', 'prix', 'stats_brut']);
    for (const k of Object.keys(c)) assert.ok(egal(c[k], a[k]), `${a.id} : ${k} ${c[k]} ≠ ${a[k]}`);
    assert.ok(TYPES_D_ARMURE.includes(a.type), `${a.id} : type ${a.type}`);
    const attendu = degatsDeLArmure(a.resistance_brut, a.faiblesse_brut).map((d) => `${d.sens}|${d.sens_brut}|${d.type_degats}|${d.multiplicateur}`).sort();
    const enBase = lignes('SELECT * FROM armure_degats WHERE armure_id = ?', a.id).map((d) => `${d.sens}|${d.sens_brut}|${d.type_degats}|${d.multiplicateur}`).sort();
    assert.deepEqual(attendu, enBase, `${a.id} : résistances et faiblesses`);
  }
});

test('boucliers, matières, formes, poids, pièces : colonnes tirées refaites sur toute la base', () => {
  for (const b of lignes('SELECT * FROM bouclier')) {
    assert.deepEqual(defenseExacte(b.defense_brut), { ap: b.ap, am: b.am }, `${b.id} : « ${b.defense_brut} »`);
    const c = colonnesDuBouclier(b);
    assert.deepEqual(Object.keys(c), ['prix', 'defense_brut']);
    for (const k of Object.keys(c)) assert.ok(egal(c[k], b[k]), `${b.id} : ${k}`);
  }
  // les matières : en lecture sur la page (décision R62), leur AP et leur AM aussi lus exactement dans leur défense écrite
  for (const t of ['materiau_armure', 'materiau_bouclier']) {
    for (const m of lignes(`SELECT * FROM ${t}`)) {
      const s = statsDeProtection(m.stats_brut);
      assert.ok(egal(s.ap, m.ap) && egal(s.am, m.am), `${t} ${m.ressource_id}`);
      assert.deepEqual(defenseExacte(m.stats_brut), { ap: m.ap, am: m.am }, `${t} ${m.ressource_id} : « ${m.stats_brut} »`);
    }
  }
  for (const f of lignes('SELECT * FROM bouclier_classe')) assert.equal(prixDeLaForme(f.prix_brut), f.prix, f.id);
  for (const p of lignes('SELECT * FROM bouclier_poids')) assert.equal(forceDuPoids(p.force_brut), p.force_min, p.id);
  for (const e of lignes('SELECT * FROM armure_emplacement')) assert.ok(egal(coutDeLaPiece(e.cout_brut), e.cout_rf), e.id);
});

test('améliorations d’armure et de bouclier : coût et effet refaits sur toute la base, et la ligne TOTAL de chaque tableau', () => {
  for (const cible of ['armure', 'bouclier']) {
    const niveaux = lignes('SELECT * FROM amelioration_equipement WHERE cible = ? ORDER BY niveau', cible);
    assert.ok(niveaux.length, cible);
    for (const a of niveaux) {
      const c = analyserAmeliorationDeProtection(cible, a.cout_brut, a.effet_brut);
      for (const k of Object.keys(c)) assert.ok(egal(c[k], a[k]), `${a.id} : ${k} ${c[k]} ≠ ${a[k]}`);
      // une amélioration de bouclier : son coût et son effet écrits se lisent exactement en ses quatre cases, sans AM (demande du propriétaire, 2026-10-17)
      if (cible === 'bouclier') {
        assert.deepEqual(ameliorationDeBouclierExacte(a.cout_brut, a.effet_brut), { cout_ro: a.cout_ro, cout_materiaux: a.cout_materiaux, bonus_ap: a.bonus_ap, bonus_am: a.bonus_am, bonus_cran: a.bonus_cran }, a.id);
        assert.deepEqual(textesDeBouclierEcrits(a, a), { cout_brut: a.cout_brut, effet_brut: a.effet_brut }, `${a.id} : gardés tels qu’écrits`);
      }
    }
    assert.equal(totalDesAmeliorationsDeProtection(cible, niveaux), db.prepare('SELECT total_brut FROM amelioration_total WHERE cible = ?').get(cible).total_brut, cible);
  }
});
