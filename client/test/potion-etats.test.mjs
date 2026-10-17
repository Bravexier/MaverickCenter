// Altérations d'état d'une potion (lib/potion-etats.mjs : la règle de l'import, refaite pour l'édition des consommables de l'onglet Ceinture depuis le
// site de dev) : rejouée sur toutes les potions de la base, elle redonne les lignes de potion_etat (le service les refait à chaque effet modifié :
// l'invariant tient aussi après des modifications) ; puis des cas choisis.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { etatsDeLaPotion, formesDesEtatsDePotion } from '../src/lib/potion-etats.mjs';

const db = ouvrirBase({ sansExemples: false });
const etats = db.prepare('SELECT id, nom FROM etat').all();
const formes = formesDesEtatsDePotion(etats);
const id = (nom) => etats.find((e) => e.nom === nom).id;
const trier = (l) => [...l].sort((a, b) => `${a.etat_id}\u0000${a.action}`.localeCompare(`${b.etat_id}\u0000${b.action}`));

test('rejouée sur toutes les potions de la base, la règle redonne les lignes de potion_etat', () => {
  const potions = db.prepare('SELECT ressource_id, effet FROM potion ORDER BY ressource_id').all();
  assert.ok(potions.length > 150);
  let lignes = 0;
  for (const p of potions) {
    const attendu = db.prepare('SELECT etat_id, action, valeur, texte FROM potion_etat WHERE ressource_id = ?').all(p.ressource_id).map((l) => ({ ...l }));
    assert.deepEqual(trier(etatsDeLaPotion(p.effet, formes)), trier(attendu), p.ressource_id);
    lignes += attendu.length;
  }
  assert.equal(lignes, db.prepare('SELECT count(*) AS n FROM potion_etat').get().n, 'chaque ligne de potion_etat a sa potion');
  assert.ok(lignes >= 60, 'les huiles infligent, les remèdes réduisent ou soignent');
});

test('les trois tournures : « Inflige <état> <n> », « Réduit d’un cran / de deux crans <état> », « Soigne totalement <état> »', () => {
  assert.deepEqual(etatsDeLaPotion('1 utilisation\nOblige un jet de vigueur, si raté : Inflige gel 1', etats), [
    { etat_id: id('Gel'), action: 'inflige', valeur: 1, texte: 'Oblige un jet de vigueur, si raté : Inflige gel 1' },
  ]);
  assert.deepEqual(etatsDeLaPotion('Réduit d’un cran la brûlure', etats), [{ etat_id: id('Brûlure'), action: 'reduit', valeur: 1, texte: 'Réduit d’un cran la brûlure' }]);
  assert.deepEqual(etatsDeLaPotion("Réduit de deux crans l’aveuglement", etats).map((l) => [l.etat_id, l.valeur]), [[id('Aveuglement'), 2]]);
  assert.deepEqual(etatsDeLaPotion('Soigne totalement la surcharge magique', etats).map((l) => [l.etat_id, l.action, l.valeur]), [[id('Surcharge Magique'), 'soigne', null]]);
  // l'écriture que l'import rapproche d'un état : « la pétrification » (Pétrifié)
  assert.deepEqual(etatsDeLaPotion('Réduit d’un cran la pétrification', etats).map((l) => l.etat_id), [id('Pétrifié')]);
  assert.deepEqual(etatsDeLaPotion('Réduit d’un cran enragé', etats).map((l) => l.etat_id), [id('Enragé')]);
});

test('une autre mention n’en est pas une ; une ligne par état et par action ; les balises du glossaire sont lues par leur texte', () => {
  for (const effet of ['Soigne le coma, remonte la santé à 0', 'Réduit d’un cran les altérations d’états', 'Inflige gel', 'Inflige une douleur 2', '', null]) {
    assert.deepEqual(etatsDeLaPotion(effet, etats), [], String(effet));
  }
  assert.deepEqual(etatsDeLaPotion('Inflige poison 1\nInflige poison 2\nSoigne totalement le poison', etats).map((l) => [l.action, l.valeur]), [['inflige', 1], ['soigne', null]]);
  const balise = etatsDeLaPotion('Inflige {{essai|gel}} 2', etats);
  assert.deepEqual(balise.map((l) => [l.etat_id, l.valeur, l.texte]), [[id('Gel'), 2, 'Inflige gel 2']]);
});
