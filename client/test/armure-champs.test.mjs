// Découpages des cases des onglets « Armures » et « Bouclier » (lib/armure-champs.mjs) : rejoués sur toute la base, ils redonnent chaque colonne tirée
// (prix, AP, AM d'une armure, d'un bouclier, d'une matière ; résistances et faiblesses ; coût en RF d'une pièce ; prix d'une forme ; Force d'un poids ;
// coût et effet d'une amélioration ; ligne TOTAL). Un changement du découpage qui ne redonne plus la base demande une migration. Le site de dev, qui
// modifie ces cases, refait ces colonnes par les mêmes découpages (serveur/edition-armures.mjs) : l'égalité vaut aussi après ses modifications.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyserAmeliorationDeProtection, colonnesDeLArmure, colonnesDuBouclier, coutDeLaPiece, degatsDeLArmure, forceDuPoids, nombreEcrit, prixDeLaForme,
  statsDeProtection, totalDesAmeliorationsDeProtection, TYPES_D_ARMURE,
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

test('armures : prix, AP, AM, clé du nom et résistances refaits depuis leurs cases, sur toute la base ; un type de la liste', () => {
  const armures = lignes('SELECT * FROM armure');
  assert.ok(armures.length > 200, 'les armures de la grille et les particulières');
  for (const a of armures) {
    const c = colonnesDeLArmure(a);
    for (const k of Object.keys(c)) assert.ok(egal(c[k], a[k]), `${a.id} : ${k} ${c[k]} ≠ ${a[k]}`);
    assert.ok(TYPES_D_ARMURE.includes(a.type), `${a.id} : type ${a.type}`);
    const attendu = degatsDeLArmure(a.resistance_brut, a.faiblesse_brut).map((d) => `${d.sens}|${d.sens_brut}|${d.type_degats}|${d.multiplicateur}`).sort();
    const enBase = lignes('SELECT * FROM armure_degats WHERE armure_id = ?', a.id).map((d) => `${d.sens}|${d.sens_brut}|${d.type_degats}|${d.multiplicateur}`).sort();
    assert.deepEqual(attendu, enBase, `${a.id} : résistances et faiblesses`);
  }
});

test('boucliers, matières, formes, poids, pièces : colonnes tirées refaites sur toute la base', () => {
  for (const b of lignes('SELECT * FROM bouclier')) {
    const c = colonnesDuBouclier(b);
    for (const k of Object.keys(c)) assert.ok(egal(c[k], b[k]), `${b.id} : ${k}`);
  }
  for (const t of ['materiau_armure', 'materiau_bouclier']) {
    for (const m of lignes(`SELECT * FROM ${t}`)) {
      const s = statsDeProtection(m.stats_brut);
      assert.ok(egal(s.ap, m.ap) && egal(s.am, m.am), `${t} ${m.ressource_id}`);
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
    }
    assert.equal(totalDesAmeliorationsDeProtection(cible, niveaux), db.prepare('SELECT total_brut FROM amelioration_total WHERE cible = ?').get(cible).total_brut, cible);
  }
});
