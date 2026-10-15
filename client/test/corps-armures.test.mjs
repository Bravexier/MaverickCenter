// Corps des pages « Armures » et « Bouclier » suivi depuis les tables (lib/corps-armures.mjs) : chaque armure, bouclier, forme, poids, pièce et
// amélioration de la base retrouve sa ligne dans le corps de sa page, et une modification ne change que cette ligne (et le titre du tableau d'une forme
// renommée) ; une modification qui ne change rien de visible laisse la ligne telle que l'importeur l'a écrite. Une ligne introuvable lève une erreur.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  corpsDesArmuresApres, ErreurCorpsArmures, finDeLigneDArmure, finDeLigneDeBouclier, ligneDAmelioration, ligneDeForme, ligneDePoids, ligneDuTotal,
  PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS, pageDeLaLigne,
} from '../src/lib/corps-armures.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase();
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
/** Les lignes qui diffèrent entre deux corps de même longueur. */
const differences = (a, b) => {
  const x = a.split('\n');
  const y = b.split('\n');
  assert.equal(x.length, y.length);
  return x.map((l, i) => [l, y[i]]).filter(([l, m]) => l !== m);
};

test('chaque armure, bouclier, forme et poids de la base retrouve sa ligne dans le corps de sa page', () => {
  const armures = corps(PAGE_DES_ARMURES).split('\n');
  for (const a of lignes('SELECT * FROM armure')) {
    assert.equal(armures.filter((l) => l.endsWith(finDeLigneDArmure(a))).length, 1, a.id);
  }
  const boucliers = corps(PAGE_DES_BOUCLIERS).split('\n');
  for (const b of lignes('SELECT * FROM bouclier')) assert.equal(boucliers.filter((l) => l.endsWith(finDeLigneDeBouclier(b))).length, 1, b.id);
  for (const f of lignes('SELECT * FROM bouclier_classe')) assert.ok(boucliers.includes(ligneDeForme(f)), f.id);
  for (const p of lignes('SELECT * FROM bouclier_poids')) assert.ok(boucliers.includes(ligneDePoids(p)), p.id);
  for (const cible of ['armure', 'bouclier']) {
    const page = cible === 'armure' ? armures : boucliers;
    assert.ok(page.includes(ligneDuTotal(db.prepare('SELECT total_brut FROM amelioration_total WHERE cible = ?').get(cible).total_brut)), `TOTAL ${cible}`);
  }
});

test('une modification ne change que sa ligne ; une forme renommée change aussi le titre de son tableau', () => {
  const essais = [
    ['armure', lignes("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 1")[0], { stats_brut: '+99AP', prix_brut: '12' }, 1],
    ['armure', lignes("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre LIMIT 1")[0], { effet: 'Un effet' }, 1],
    ['bouclier', lignes('SELECT * FROM bouclier ORDER BY id LIMIT 1')[0], { defense_brut: '+1AP' }, 1],
    ['bouclier_poids', lignes('SELECT * FROM bouclier_poids ORDER BY ordre LIMIT 1')[0], { force_brut: '9 de Force minimum' }, 1],
    ['armure_emplacement', lignes('SELECT * FROM armure_emplacement ORDER BY ordre LIMIT 1 OFFSET 1')[0], { cout_brut: '200 RF / 2 RO' }, 1],
    ['amelioration_equipement', lignes("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 3")[0], { effet_brut: '+7 AP' }, 1],
    ['amelioration_total', lignes("SELECT * FROM amelioration_total WHERE cible = 'armure'")[0], { total_brut: '1 Ro + 1 Matériau' }, 1],
    ['bouclier_classe', lignes("SELECT * FROM bouclier_classe WHERE classe = 1")[0], { nom: 'Bocle X' }, 2],
  ];
  for (const [table, avant, changes, n] of essais) {
    const id = pageDeLaLigne(table, avant);
    const apres = corpsDesArmuresApres(corps(id), table, avant, { ...avant, ...changes });
    assert.equal(differences(corps(id), apres).length, n, `${table} ${avant.id ?? avant.cible}`);
    if (table === 'amelioration_equipement') assert.ok(apres.split('\n').includes(ligneDAmelioration({ ...avant, ...changes })));
  }
});

test('rien de visible ne change : la ligne d’une pièce ou d’une amélioration reste telle que l’importeur l’a écrite', () => {
  for (const [table, l] of [
    ['armure_emplacement', lignes('SELECT * FROM armure_emplacement ORDER BY ordre')],
    ['amelioration_equipement', lignes("SELECT * FROM amelioration_equipement WHERE cible IN ('armure', 'bouclier')")],
    ['armure', lignes('SELECT * FROM armure')],
    ['bouclier', lignes('SELECT * FROM bouclier')],
  ]) {
    for (const avant of l) {
      const id = pageDeLaLigne(table, avant);
      assert.equal(corpsDesArmuresApres(corps(id), table, avant, { ...avant }), corps(id), `${table} ${avant.id}`);
    }
  }
});

test('ligne introuvable, création ou suppression : ErreurCorpsArmures ; une amélioration d’une autre cible n’a pas de page ici', () => {
  const a = lignes('SELECT * FROM armure ORDER BY ordre LIMIT 1')[0];
  assert.throws(() => corpsDesArmuresApres(corps(PAGE_DES_ARMURES), 'armure', { ...a, nom: 'Inconnue' }, a), ErreurCorpsArmures);
  assert.throws(() => corpsDesArmuresApres(corps(PAGE_DES_ARMURES), 'armure', null, a), ErreurCorpsArmures);
  assert.throws(() => corpsDesArmuresApres('', 'armure', a, a), ErreurCorpsArmures);
  assert.equal(pageDeLaLigne('amelioration_equipement', { cible: 'arme' }), null);
  assert.equal(pageDeLaLigne('amelioration_equipement', { cible: 'bouclier' }), PAGE_DES_BOUCLIERS);
});
