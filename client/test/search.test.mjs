import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchIndex } from '../src/lib/search.mjs';

const doc = (title, extra = {}) => ({ title, aliases: [], tags: [], summary: '', text: '', ...extra });
const index = [
  doc('Magie du feu', { text: 'Une école de flammes.' }),
  doc('Elfe', { aliases: ['Haut-Elfe'], tags: ['peuple'], text: 'Parle de la magie.' }),
  doc('Bestiaire des forêts', { summary: 'Créatures sylvestres' }),
];

test('un titre pèse plus qu’une occurrence dans le texte', () => {
  assert.deepEqual(searchIndex(index, 'magie').map((d) => d.title), ['Magie du feu', 'Elfe']);
});

test('tous les mots doivent correspondre, accents et casse ignorés', () => {
  assert.deepEqual(searchIndex(index, 'ÉLFE magie').map((d) => d.title), ['Elfe']);
  assert.deepEqual(searchIndex(index, 'elfe feu').map((d) => d.title), []);
  assert.deepEqual(searchIndex(index, 'creatures').map((d) => d.title), ['Bestiaire des forêts']);
});

test('alias et tags sont cherchés, requête vide = aucun résultat', () => {
  assert.deepEqual(searchIndex(index, 'haut elfe').map((d) => d.title), ['Elfe']);
  assert.deepEqual(searchIndex(index, 'peuple').map((d) => d.title), ['Elfe']);
  assert.deepEqual(searchIndex(index, '   '), []);
});
