import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleDeRecherche, filtrerMotsCles, searchIndex } from '../src/lib/search.mjs';

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

test('mots-clés de la page de recherche : tous sans recherche, sinon ceux qui contiennent chaque mot (casse et accents ignorés)', () => {
  const cles = ['alchimie', 'armure-magique', 'armure-physique', 'feu', 'magie-du-feu'];
  assert.deepEqual(filtrerMotsCles(cles, ''), cles);
  assert.deepEqual(filtrerMotsCles(cles, '  '), cles);
  assert.deepEqual(filtrerMotsCles(cles, 'Feu'), ['feu', 'magie-du-feu']);
  assert.deepEqual(filtrerMotsCles(cles, 'armure MAGIQUE'), ['armure-magique']);
  assert.deepEqual(filtrerMotsCles(cles, 'Alchîmie'), ['alchimie']);
  assert.deepEqual(filtrerMotsCles(cles, 'glace'), []);
});

test('cleDeRecherche : le libellé d’un mot-clé, suivi de ses synonymes normalisés (R233 (1) : « AM » trouve « Armure magique »), jamais sa clé', () => {
  assert.equal(cleDeRecherche({ libelle: 'Armure magique', cle: 'armure-magique', synonymes: ['AM'] }), 'armure-magique|am');
  assert.equal(cleDeRecherche({ libelle: 'Nature', synonymes: ['Nat.', 'Naturel'] }), 'nature|nat|naturel');
  assert.equal(cleDeRecherche({ libelle: 'Namazu', cle: 'namazu-race', synonymes: [] }), 'namazu', 'la clé d’un homonyme (ses catégories) n’est pas cherchée');
  assert.equal(cleDeRecherche({ cle: 'feu' }), 'feu', 'sans libellé : la clé');
  assert.equal(cleDeRecherche({ libelle: 'Feu', synonymes: ['…'] }), 'feu', 'un synonyme sans lettre ni chiffre : rien à chercher');
  assert.deepEqual(filtrerMotsCles([cleDeRecherche({ libelle: 'Armure magique', synonymes: ['AM'] }), 'feu'], 'am'), ['armure-magique|am']);
});
