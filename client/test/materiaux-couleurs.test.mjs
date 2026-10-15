// Couleurs des matériaux d'arme (lib/materiaux-couleurs.mjs, demande du propriétaire : « Chaque matériau a sa couleur comme dans l'onglet Arme ») :
// chaque matériau du tableau des matériaux d'arme de la base en a une, lue dans l'onglet ; aucune clé ne vise un matériau absent.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cleDeMateriau, COULEURS_DES_MATERIAUX, couleurDeMateriau } from '../src/lib/materiaux-couleurs.mjs';

const db = ouvrirBase({ sansExemples: false });
const materiaux = db.prepare('SELECT ressource_id FROM materiau_arme ORDER BY ordre').all().map((m) => m.ressource_id);

test('chaque matériau d’arme a sa couleur (fond et texte) ; chaque couleur vise un matériau de la base', () => {
  for (const id of materiaux) assert.ok(COULEURS_DES_MATERIAUX[cleDeMateriau(id)], id);
  assert.deepEqual(Object.keys(COULEURS_DES_MATERIAUX).sort(), materiaux.map(cleDeMateriau).sort());
  for (const c of Object.values(COULEURS_DES_MATERIAUX)) for (const v of [c.fond, c.texte]) assert.match(v, /^#[0-9a-f]{6}$/);
});

test('quelques couleurs de l’onglet : Fer gris, Fer noir noir au texte blanc, Titane bleu, Or doré', () => {
  assert.deepEqual(couleurDeMateriau('ressources/armures#materiau:fer'), { fond: '#7f7f7f', texte: '#000000' });
  assert.deepEqual(couleurDeMateriau('ressources/armures#materiau:fer-noir'), { fond: '#000000', texte: '#ffffff' });
  assert.equal(couleurDeMateriau('ressources/armures#materiau:titane').fond, '#3c78d8');
  assert.equal(couleurDeMateriau('ressources/armures#materiau:or').fond, '#ffd700');
});
