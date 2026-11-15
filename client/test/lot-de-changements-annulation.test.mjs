// L'effet net d'un lot du journal et le jugement de son annulation (lot 6 du chantier de la base de dev, R274, R275, garde-fou 11 ; module pur
// src/lib/lot-de-changements.mjs : effetNetDuLot, jugerLAnnulation) : une valeur n'est remise que si elle vaut encore ce que le lot a écrit.
//   node --test test/lot-de-changements-annulation.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effetNetDuLot, jugerLAnnulation } from '../src/lib/lot-de-changements.mjs';

const l = (rang, table, cle, operation, avant, apres) => ({ rang, table, cle, operation, avant, apres });

test('effet net : une colonne écrite deux fois garde la première valeur d’avant et la dernière d’après ; revenue à sa valeur, elle n’est pas rendue', () => {
  const nets = effetNetDuLot([
    l(2, 't', { id: 1 }, 'modifier', { a: 'b' }, { a: 'c' }),
    l(1, 't', { id: 1 }, 'modifier', { a: 'a', x: 1 }, { a: 'b', x: 2 }),
    l(3, 't', { id: 2 }, 'modifier', { a: 'a' }, { a: 'b' }),
    l(4, 't', { id: 2 }, 'modifier', { a: 'b' }, { a: 'a' }),
  ]);
  assert.deepEqual(nets, [{ rang: 1, table: 't', cle: { id: 1 }, genre: 'modifier', origine: { a: 'a', x: 1 }, fin: { a: 'c', x: 2 } }]);
});

test('effet net : une ligne créée puis retouchée par le lot vaut sa dernière forme ; créée puis supprimée, elle n’existe pas ; supprimée puis recréée, elle se compare', () => {
  const nets = effetNetDuLot([
    l(1, 't', { id: 1 }, 'inserer', null, { id: 1, a: 'a', cle: 'x' }),
    l(2, 't', { id: 1 }, 'modifier', { cle: 'x' }, { cle: 'y' }),
    l(3, 't', { id: 2 }, 'inserer', null, { id: 2, a: 'a' }),
    l(4, 't', { id: 2 }, 'supprimer', { id: 2, a: 'a' }, null),
    l(5, 't', { id: 3 }, 'supprimer', { id: 3, a: 'a', b: 'b' }, null),
    l(6, 't', { id: 3 }, 'inserer', null, { id: 3, a: 'a', b: 'autre' }),
    l(7, 't', { id: 4 }, 'modifier', { a: 'a' }, { a: 'b' }),
    l(8, 't', { id: 4 }, 'supprimer', { id: 4, a: 'b', b: 'b' }, null),
  ]);
  assert.deepEqual(nets.map((n) => [n.cle.id, n.genre]), [[1, 'inserer'], [3, 'modifier'], [4, 'supprimer']]);
  assert.deepEqual(nets[0].fin, { id: 1, a: 'a', cle: 'y' });
  assert.deepEqual([nets[1].origine, nets[1].fin], [{ b: 'b' }, { b: 'autre' }]);
  assert.deepEqual(nets[2].origine, { id: 4, a: 'a', b: 'b' }, 'la ligne telle qu’elle était avant le lot : la valeur d’avant la première modification');
});

test('juger une modification : remise si la valeur vaut encore ce que le lot a écrit, déjà si elle a sa valeur d’avant, gardée sinon (avec la valeur trouvée)', () => {
  const net = { genre: 'modifier', origine: { a: 'a', b: 'b', c: 'c' }, fin: { a: 'A', b: 'B', c: 'C' } };
  const j = jugerLAnnulation(net, { id: 1, a: 'A', b: 'b', c: 'ailleurs' });
  assert.deepEqual([j.etat, j.remises, j.deja], ['remise', ['a'], ['b']]);
  assert.deepEqual(j.gardees, [{ colonne: 'c', ecrite: 'C', avant: 'c', trouvee: 'ailleurs' }]);
  assert.equal(jugerLAnnulation(net, { a: 'x', b: 'b', c: 'c' }).etat, 'gardee');
  assert.equal(jugerLAnnulation(net, { a: 'a', b: 'b', c: 'c' }).etat, 'deja');
  const absente = jugerLAnnulation(net, null);
  assert.deepEqual([absente.etat, absente.raison, absente.gardees.length], ['gardee', 'ligne_absente', 3]);
  // null et absent sont la même valeur
  assert.equal(jugerLAnnulation({ genre: 'modifier', origine: { a: null }, fin: { a: 'x' } }, { a: 'x' }).etat, 'remise');
  assert.equal(jugerLAnnulation({ genre: 'modifier', origine: { a: 'x' }, fin: { a: null } }, {}).etat, 'remise');
});

test('juger une insertion : supprimée seulement si elle vaut encore, en entier, ce que le lot a inséré ; une ligne déjà partie est « déjà »', () => {
  const net = { genre: 'inserer', origine: null, fin: { id: 1, a: 'a', b: 'b' } };
  assert.equal(jugerLAnnulation(net, { id: 1, a: 'a', b: 'b' }).etat, 'remise');
  const changee = jugerLAnnulation(net, { id: 1, a: 'a', b: 'autre' });
  assert.deepEqual([changee.etat, changee.raison], ['gardee', 'ligne_changee']);
  assert.deepEqual(changee.gardees, [{ colonne: 'b', ecrite: 'b', avant: null, trouvee: 'autre' }]);
  assert.deepEqual([jugerLAnnulation(net, null).etat, jugerLAnnulation(net, null).raison], ['deja', 'ligne_absente']);
});

test('juger une suppression : réinsérée seulement si elle est encore absente ; présente, elle est gardée (ou déjà revenue à l’identique)', () => {
  const net = { genre: 'supprimer', origine: { id: 1, a: 'a' }, fin: null };
  assert.deepEqual([jugerLAnnulation(net, null).etat, jugerLAnnulation(net, null).remises], ['remise', ['id', 'a']]);
  assert.equal(jugerLAnnulation(net, { id: 1, a: 'a' }).etat, 'deja');
  const recreee = jugerLAnnulation(net, { id: 1, a: 'autre' });
  assert.deepEqual([recreee.etat, recreee.raison], ['gardee', 'ligne_existante']);
  assert.deepEqual(recreee.gardees, [{ colonne: 'a', ecrite: null, avant: 'a', trouvee: 'autre' }]);
});
