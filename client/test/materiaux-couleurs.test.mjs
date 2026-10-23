// Couleurs des matériaux d'arme (lib/materiaux-couleurs.mjs, demande du propriétaire : « Chaque matériau a sa couleur comme dans l'onglet Arme ») :
// chaque matériau du tableau des matériaux d'arme de la base en a une, lue dans l'onglet ; aucune clé ne vise un matériau absent. Les pages n'en posent
// que la classe (lib/palette-css.mjs, famille `materiau` : test/palette-css.test.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { cleDeMateriau, COULEURS_DES_MATERIAUX, couleurDeMateriau } from '../src/lib/materiaux-couleurs.mjs';
import { classeDeMateriau, FAMILLES_DE_LA_PALETTE, PAR_DEFAUT } from '../src/lib/palette-css.mjs';

const db = ouvrirBase({ sansExemples: false });
const materiaux = db.prepare('SELECT ressource_id FROM materiau_arme ORDER BY ordre').all().map((m) => m.ressource_id);

test('chaque matériau d’arme a sa couleur ; chaque couleur vise un matériau de la base', () => {
  for (const id of materiaux) assert.ok(COULEURS_DES_MATERIAUX[cleDeMateriau(id)], id);
  assert.deepEqual(Object.keys(COULEURS_DES_MATERIAUX).sort(), materiaux.map(cleDeMateriau).sort());
  for (const c of Object.values(COULEURS_DES_MATERIAUX)) assert.match(c, /^#[0-9a-f]{6}$/);
});

test('quelques couleurs de l’onglet : Fer gris, Fer noir noir, Titane bleu, Or doré ; un matériau sans couleur, la classe par défaut de la famille', () => {
  assert.equal(couleurDeMateriau('ressources/armures#materiau:fer'), '#7f7f7f');
  assert.equal(couleurDeMateriau('ressources/armures#materiau:fer-noir'), '#000000');
  assert.equal(couleurDeMateriau('ressources/armures#materiau:titane'), '#3c78d8');
  assert.equal(couleurDeMateriau('ressources/armures#materiau:or'), '#ffd700');
  assert.equal(couleurDeMateriau('ressources/armures#materiau:cuir'), null, 'un matériau d’armure seulement : pas de couleur dans l’onglet Armes');
  // chaque matériau d'arme : la classe de sa clé ; un autre : `par-defaut`
  for (const id of materiaux) assert.equal(classeDeMateriau(id), `couleur-materiau-${cleDeMateriau(id)}`, id);
  assert.equal(classeDeMateriau('ressources/armures#materiau:cuir'), `couleur-materiau-${PAR_DEFAUT}`);
  assert.equal(FAMILLES_DE_LA_PALETTE.materiau.fer, COULEURS_DES_MATERIAUX.fer, 'la palette lit la règle');
});
