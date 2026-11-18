// L'alerte des retraits bloquants (R292) : ce que dit `affichageDesRetraits` (src/lib/notes-de-version-rendu.mjs) de `retraits_bloquants`, la réponse de
// GET /api/mise-a-jour/ (serveur/attestation.mjs#retraitsBloquantsPourLaProduction). Aucun texte figé : la présence ou l'absence de l'alerte, les nombres et
// les noms que le service donne.
//   node --test test/notes-de-version-retraits.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affichageDesRetraits } from '../src/lib/notes-de-version-rendu.mjs';

const element = (table, nom, fiches) => ({ table, id: `${table}-1`, nom, libelle: `Élément « ${nom} »`, fiches });
const retraits = (plus = {}) => ({ connu: true, attestee_le: '2026-11-17T10:00:00Z', elements: [element('race', 'Alpha', 3), element('magie', 'Bêta', 1)], fiches_au_moins: 3, fiches_au_plus: 4, message: 'Un message du service.', ...plus });

test('R292 : des éléments retirés que des fiches citent donnent une alerte : le message du service, une ligne par élément (son libellé et son nombre de fiches), l’encadrement des fiches touchées', () => {
  const a = affichageDesRetraits(retraits());
  assert.equal(a.message, 'Un message du service.');
  assert.equal(a.elements.length, 2);
  assert.ok(a.elements[0].includes('Alpha') && a.elements[0].includes('3'));
  assert.ok(a.elements[1].includes('Bêta') && a.elements[1].includes('1'));
  assert.ok(a.total.includes('3') && a.total.includes('4'));
  // le pluriel suit le nombre de fiches
  assert.match(a.elements[0], /fiches/);
  assert.doesNotMatch(a.elements[1], /fiches/);
  // un seul nombre quand le plus et le moins s'accordent
  const egal = affichageDesRetraits(retraits({ fiches_au_moins: 3, fiches_au_plus: 3 }));
  assert.ok(egal.total.includes('3'));
  assert.equal((egal.total.match(/\d+/g) ?? []).length, 1);
});

test('R292 : rien à dire quand l’attestation n’est pas lue, quand aucun élément ne bloque, ou quand la réponse n’a pas le champ (ancien service) ; une valeur de mauvais type ne casse rien', () => {
  assert.equal(affichageDesRetraits(retraits({ connu: false })), null);
  assert.equal(affichageDesRetraits(retraits({ elements: [] })), null);
  for (const v of [undefined, null, 'x', 3, [], {}, { connu: true }, { connu: true, elements: 'x' }, { connu: true, elements: [null, 4, {}] }]) assert.equal(affichageDesRetraits(v), null, JSON.stringify(v));
  // les champs douteux sont ignorés : ni nombre inventé ni texte vide
  const a = affichageDesRetraits(retraits({ message: 3, fiches_au_moins: 'x', fiches_au_plus: null, elements: [{ libelle: 'Seul', fiches: 'beaucoup' }] }));
  assert.equal(a.message, '');
  assert.deepEqual(a.elements, ['Seul']);
  assert.equal(a.total, '');
});
