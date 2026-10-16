// Tri de la liste des boucliers (lib/armures-tri.mjs ; demande du propriétaire, 2026-10-16 : « triable par toutes les colonnes ») : le cycle d'un
// en-tête, la comparaison des nombres et des textes, les valeurs absentes toujours à la fin, les égalités dans l'ordre de l'onglet.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { absente, comparerValeurs, ordonner, triSuivant } from '../src/lib/armures-tri.mjs';

test('triSuivant : croissant, puis décroissant, puis l’ordre de l’onglet ; un autre en-tête repart croissant', () => {
  let tri = { cle: null, sens: 'asc' };
  tri = triSuivant(tri, 'prix');
  assert.deepEqual(tri, { cle: 'prix', sens: 'asc' });
  tri = triSuivant(tri, 'prix');
  assert.deepEqual(tri, { cle: 'prix', sens: 'desc' });
  assert.deepEqual(triSuivant(tri, 'nom'), { cle: 'nom', sens: 'asc' }, 'un autre en-tête pendant le décroissant');
  tri = triSuivant(tri, 'prix');
  assert.deepEqual(tri, { cle: null, sens: 'asc' });
  assert.deepEqual(triSuivant(undefined, 'ap'), { cle: 'ap', sens: 'asc' });
});

test('comparerValeurs : nombres entre eux (12,5 avant 100), textes à la française (sans casse ni accents, nombres lus), absente()', () => {
  assert.ok(comparerValeurs(12.5, 100) < 0 && comparerValeurs(100, 12.5) > 0 && comparerValeurs(3, 3) === 0);
  assert.ok(comparerValeurs('Écu', 'fer') < 0 && comparerValeurs('écailles', 'Ecailles') === 0);
  assert.ok(comparerValeurs('Targe 2', 'Targe 10') < 0, 'les nombres d’un texte se lisent comme des nombres');
  for (const v of [null, undefined, '', Number.NaN]) assert.ok(absente(v), String(v));
  for (const v of [0, 'a', -1]) assert.ok(!absente(v), String(v));
});

const lignes = [
  { ordre: 0, nom: 'Bocle Cuir', prix: 4.5, ap: 1, poids: 1 },
  { ordre: 1, nom: 'Bocle Bois', prix: 4, ap: 1, poids: 1 },
  { ordre: 2, nom: 'Bouclier Rond Argent', prix: null, ap: 9, poids: 3 }, // « Prix : » vide dans la source
  { ordre: 3, nom: 'Écu Titane', prix: 810, ap: 28, poids: null },
  { ordre: 4, nom: 'Pavois Maverium', prix: 2012.5, ap: 50, poids: 4 },
];
const lecture = { valeur: (l, cle) => l[cle], ordre: (l) => l.ordre };
const noms = (liste) => liste.map((l) => l.nom);

test('ordonner : croissant puis décroissant par colonne, une valeur absente toujours à la fin, égalités dans l’ordre de l’onglet, l’entrée intacte', () => {
  const melange = [lignes[3], lignes[1], lignes[4], lignes[0], lignes[2]];
  assert.deepEqual(noms(ordonner(melange, { cle: null, sens: 'asc' }, lecture)), noms(lignes), 'sans tri : l’ordre de l’onglet');
  assert.deepEqual(noms(ordonner(melange, { cle: 'prix', sens: 'asc' }, lecture)), ['Bocle Bois', 'Bocle Cuir', 'Écu Titane', 'Pavois Maverium', 'Bouclier Rond Argent']);
  assert.deepEqual(noms(ordonner(melange, { cle: 'prix', sens: 'desc' }, lecture)), ['Pavois Maverium', 'Écu Titane', 'Bocle Cuir', 'Bocle Bois', 'Bouclier Rond Argent'], 'le prix absent reste à la fin en décroissant');
  assert.deepEqual(noms(ordonner(melange, { cle: 'ap', sens: 'asc', }, lecture)), ['Bocle Cuir', 'Bocle Bois', 'Bouclier Rond Argent', 'Écu Titane', 'Pavois Maverium'], 'à égalité (1 AP), l’ordre de l’onglet');
  assert.deepEqual(noms(ordonner(melange, { cle: 'poids', sens: 'desc' }, lecture)), ['Pavois Maverium', 'Bouclier Rond Argent', 'Bocle Cuir', 'Bocle Bois', 'Écu Titane']);
  assert.deepEqual(noms(ordonner(melange, { cle: 'nom', sens: 'asc' }, lecture)), ['Bocle Bois', 'Bocle Cuir', 'Bouclier Rond Argent', 'Écu Titane', 'Pavois Maverium']);
  assert.deepEqual(noms(melange), ['Écu Titane', 'Bocle Bois', 'Pavois Maverium', 'Bocle Cuir', 'Bouclier Rond Argent'], 'l’entrée n’est pas modifiée');
});
