// Les deux menus à onglets de l'onglet Armes de /ressources/equipement/ (demande du propriétaire, 2026-10-23 : « Il faudrai réduire çà en deux menus à
// onglet. Un pour les armes de mêlée l'autre pour les armes à distances. ») : lib/armes-rendu.mjs#menusDesArmes range les familles de chargerArmes par
// leur catégorie (arme_famille.categorie, décision R127), mêlée (`contact`) puis distance, chaque menu dans l'ordre de l'onglet ; une famille sans menu
// arrête le build. D'abord la catégorie que chargerArmes donne (lib/armes-db.mjs, colonne arme_famille.categorie, ordre de arme_famille.ordre), puis
// les menus sur toute la base et sur des familles d'essai. Le rendu (barres, onglets, panneaux) : test/armes-html.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chargerArmes } from '../src/lib/armes-db.mjs';
import { MENUS_DES_ARMES, menusDesArmes } from '../src/lib/armes-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const db = ouvrirBase();

test('les intitulés des menus, dans l’ordre de la page : les mots du propriétaire (mêlée, distance) ; les catégories de R127', () => {
  assert.deepEqual(MENUS_DES_ARMES.map((m) => [m.categorie, m.titre]), [['contact', 'Armes de mêlée'], ['distance', 'Armes à distance']]);
});

test('décision R127 : chaque famille de l’onglet (chargerArmes) a sa catégorie, celle de arme_famille, contact ou distance ; à distance, exactement Arc, Arbalète, Arme de jet et Bombes ; l’ordre de arme_famille.ordre', () => {
  // « Arc / arbalète / arme de jet ou Bombe sont bien les 4 types d'armes à distance. » (R127, migration 0069) : chargerArmes garde l'ordre de
  // l'onglet et ne regroupe rien ; les menus groupent
  const { familles } = chargerArmes(db);
  assert.ok(familles.length > 0);
  for (const f of familles) {
    assert.ok(['contact', 'distance'].includes(f.categorie), `${f.id} : ${f.categorie}`);
    assert.equal(f.categorie, db.prepare('SELECT categorie FROM arme_famille WHERE id = ?').get(f.id).categorie, f.id);
  }
  assert.deepEqual(familles.filter((f) => f.categorie === 'distance').map((f) => f.id).sort(), ['arbalete', 'arc', 'arme-de-jet', 'bombes']);
  const ordre = db.prepare('SELECT id FROM arme_famille WHERE maitrisable = 1 ORDER BY ordre').all().map((r) => r.id);
  assert.deepEqual(familles.map((f) => f.id), ordre.filter((id) => familles.some((f) => f.id === id)), 'l’ordre de l’onglet (arme_famille.ordre)');
});

test('R127 : sur toute la base, chaque famille de l’onglet est dans le menu de sa catégorie, une seule fois, dans l’ordre de l’onglet', () => {
  const { familles } = chargerArmes(db);
  const menus = menusDesArmes(familles);
  assert.deepEqual(menus.map((m) => m.categorie), ['contact', 'distance']);
  for (const m of menus) {
    assert.ok(m.familles.length > 0, m.titre);
    assert.ok(m.familles.every((f) => f.categorie === m.categorie), m.titre);
    // l'ordre de l'onglet (celui de chargerArmes), sans regroupement
    assert.deepEqual(m.familles.map((f) => f.id), familles.filter((f) => f.categorie === m.categorie).map((f) => f.id), m.titre);
  }
  assert.deepEqual(menus.flatMap((m) => m.familles.map((f) => f.id)).sort(), familles.map((f) => f.id).sort(), 'chaque famille une fois');
});

test('familles d’essai : l’ordre donné est gardé dans chaque menu, un menu vide est omis, une famille sans menu arrête le build', () => {
  const f = (id, categorie) => ({ id, categorie, armes: [{}] });
  const menus = menusDesArmes([f('b', 'distance'), f('a', 'contact'), f('d', 'distance'), f('c', 'contact')]);
  assert.deepEqual(menus.map((m) => [m.titre, m.familles.map((x) => x.id)]), [['Armes de mêlée', ['a', 'c']], ['Armes à distance', ['b', 'd']]]);
  assert.deepEqual(menusDesArmes([f('a', 'contact')]).map((m) => m.categorie), ['contact'], 'sans famille à distance, un seul menu');
  assert.deepEqual(menusDesArmes([]), []);
  assert.throws(() => menusDesArmes([f('a', 'contact'), f('x', null)]), /x \(null\)/);
  assert.throws(() => menusDesArmes([f('y', 'jet')]), /y \(jet\)/);
});
