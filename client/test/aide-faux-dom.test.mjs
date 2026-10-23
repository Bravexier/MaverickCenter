// Le faux navigateur des tests de scripts de page (test/aide-faux-dom.mjs) : ses sélecteurs — liste « a, b », descendant « a b », et une valeur
// d'attribut qui porte espaces ou virgules, jamais découpée.
//   node --test test/aide-faux-dom.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { el } from './aide-faux-dom.mjs';

test('sélecteurs : liste, descendant, valeur d’attribut avec espace ou virgule', () => {
  const fermer = el('button', { 'aria-label': 'Fermer la fenêtre', class: 'x' });
  const titre = el('span', { 'data-titre': 'Or, argent et fer' });
  const racine = el('div', { class: 'boite' }, el('p', {}, fermer, titre));
  assert.equal(racine.querySelector('[aria-label="Fermer la fenêtre"]'), fermer);
  assert.equal(racine.querySelector('[data-titre="Or, argent et fer"]'), titre);
  assert.deepEqual(racine.querySelectorAll('.boite [aria-label="Fermer la fenêtre"], [data-titre="Or, argent et fer"]'), [fermer, titre]);
  assert.equal(racine.querySelector('.boite  p   .x'), fermer, 'descendant, espaces répétés');
  assert.equal(fermer.closest('p, .boite').tagName, 'P');
  assert.ok(fermer.matches('button.x'));
  assert.equal(racine.querySelector('.ailleurs .x'), null);
  assert.throws(() => racine.querySelector('a > b'), /sélecteur non pris en charge/);
});
