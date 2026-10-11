// Bloc « Magie non compatible » des pages de magie (lib/magie-non-compatible.mjs, décision R15 du propriétaire) : « Mono-magie uniquement » pour une magie
// mono-magie, avec ses ethnies d'exception ; le Potentiel Illimité n'est cité dans le bloc d'aucune autre magie. Cas limites, puis contenu réel de la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { blocNonCompatible, MONO_MAGIE } from '../src/lib/magie-non-compatible.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';

const magie = (extra) => ({ monoMagie: false, incompatibles: [], incompatibiliteNote: null, ethniesSecondaires: [], ...extra });

test('libellé du propriétaire', () => {
  assert.equal(MONO_MAGIE, 'Mono-magie uniquement');
});

test('magie mono-magie : ni liste ni phrase libre, seulement les ethnies d’exception', () => {
  const ethnies = [{ nom: 'Elfe Noir Charbon', pageId: 'races/elfe-noir' }];
  const bloc = blocNonCompatible(magie({ monoMagie: true, incompatibles: ['magies/sang'], incompatibiliteNote: 'phrase de la source', ethniesSecondaires: ethnies }));
  assert.deepEqual(bloc, { mono: true, magies: [], note: null, ethnies });
});

test('autre magie : sa liste dans l’ordre reçu, sans le Potentiel Illimité ; la phrase libre est gardée', () => {
  const bloc = blocNonCompatible(magie({ incompatibles: [POTENTIEL_ILLIMITE, 'magies/arcane', 'magies/sang'], incompatibiliteNote: 'note' }));
  assert.deepEqual(bloc, { mono: false, magies: ['magies/arcane', 'magies/sang'], note: 'note', ethnies: [] });
  assert.deepEqual(blocNonCompatible(magie({ incompatibles: [POTENTIEL_ILLIMITE] })).magies, [], 'une magie qui ne cite que le Potentiel Illimité : liste vide (« Aucune »)');
});

test('contenu réel : Potentiel Illimité et Corruption en mono-magie, Potentiel Illimité absent de toutes les listes', () => {
  const { magies } = chargerMagies(ouvrirBase({ sansExemples: false }));
  const blocs = new Map([...magies.values()].map((m) => [m.id, blocNonCompatible(m)]));
  assert.deepEqual([...blocs].filter(([, b]) => b.mono).map(([id]) => id), [POTENTIEL_ILLIMITE, 'magies/magie-de-la-corruption']);
  assert.deepEqual(blocs.get(POTENTIEL_ILLIMITE).ethnies, []);
  assert.deepEqual(blocs.get('magies/magie-de-la-corruption').ethnies.map((e) => e.nom), ['Elfe Noir Charbon', 'Felfe Noir']);
  for (const [id, b] of blocs) assert.ok(!b.magies.includes(POTENTIEL_ILLIMITE), `${id} cite le Potentiel Illimité`);
  assert.deepEqual(blocs.get('magies/magie-du-sang').magies, ['magies/magie-de-larcane', 'magies/magie-de-la-corruption', 'magies/magie-de-lespace-temps', 'magies/magie-de-la-necromancie']);
  assert.deepEqual(blocs.get('magies/magie-du-feu').magies, [], 'le Feu ne citait que le Potentiel Illimité');
  assert.ok([...blocs.values()].every((b) => b.note === null), 'aucune phrase libre affichée (celle de la Corruption, mono-magie, reste dans la base)');
});
