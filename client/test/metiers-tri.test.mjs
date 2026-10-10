// Filtres et tri du tableau de /metiers/ (lib/metiers-tri.mjs) : par colonne, sur le texte affiché, état dans l'adresse.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adresseDeEtat, correspond, etatDepuisAdresse, filtrerEtTrier } from '../src/lib/metiers-tri.mjs';

const L = [
  { id: 'a', cellules: { nom: 'Alchimiste', bonus: '+3% Connaissance', artisanat: 'Peut fabriquer les fioles INTELLIGENCE + PERCEPTION', equipement: 'Kit d’alchimiste' } },
  { id: 'b', cellules: { nom: 'Boulanger', bonus: '+2% Vigueur', artisanat: 'Fabriquer du pain', equipement: '—' } },
  { id: 'c', cellules: { nom: 'Écuyer', bonus: '+3% Parade', artisanat: '—', equipement: 'Selle' } },
];
const ids = (l) => l.map((x) => x.id);

test('filtre : tous les mots, sans casse ni accents, colonne par colonne ; vide = tout', () => {
  assert.equal(correspond('Kit d’alchimiste', 'ALCHIM kit'), true);
  assert.equal(correspond('Écuyer', 'ecu'), true);
  assert.equal(correspond('Selle', ''), true);
  assert.equal(correspond('Selle', 'cheval'), false);
  assert.deepEqual(ids(filtrerEtTrier(L, { filtres: { bonus: '3%' } })), ['a', 'c']);
  assert.deepEqual(ids(filtrerEtTrier(L, { filtres: { bonus: '3', nom: 'ecuy' } })), ['c']);
});

test('tri : par colonne, dans les deux sens ; une cellule vide (« — ») toujours après ; égalité par nom', () => {
  assert.deepEqual(ids(filtrerEtTrier(L, { tri: 'nom', sens: 'desc' })), ['c', 'b', 'a']);
  assert.deepEqual(ids(filtrerEtTrier(L, { tri: 'artisanat' })), ['b', 'a', 'c']);
  assert.deepEqual(ids(filtrerEtTrier(L, { tri: 'artisanat', sens: 'desc' })), ['a', 'b', 'c']);
  assert.deepEqual(ids(filtrerEtTrier(L, { tri: 'equipement' })), ['a', 'c', 'b']);
  assert.deepEqual(ids(filtrerEtTrier(L, {})), ['a', 'b', 'c'], 'sans tri : ordre reçu');
  assert.deepEqual(ids(filtrerEtTrier(L, { tri: 'inconnue' })), ['a', 'b', 'c']);
});

test('adresse : aller-retour ; valeurs inconnues ignorées', () => {
  const etat = { tri: 'bonus', sens: 'desc', filtres: { nom: 'forg', artisanat: 'arme' } };
  assert.equal(adresseDeEtat(etat), '?tri=bonus&sens=desc&nom=forg&artisanat=arme');
  assert.deepEqual(etatDepuisAdresse(adresseDeEtat(etat)), etat);
  assert.deepEqual(etatDepuisAdresse('?tri=x&sens=desc&autre=1'), { tri: null, sens: 'asc', filtres: {} });
  assert.equal(adresseDeEtat({ filtres: { nom: '  ' } }), '');
});
