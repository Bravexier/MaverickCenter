import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corpsOuRefus } from '../serveur/edition-corps.mjs';

class ErreurEdition extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}
class ErreurCorps extends Error {}

test('corpsOuRefus rend le corps calculé', () => {
  assert.equal(corpsOuRefus(ErreurEdition, ErreurCorps, 'armes', () => 'nouveau'), 'nouveau');
});

test('corpsOuRefus refuse le lot (500) quand le corps est illisible', () => {
  assert.throws(
    () => corpsOuRefus(ErreurEdition, ErreurCorps, 'armes', () => { throw new ErreurCorps('tableau absent'); }),
    (e) => e instanceof ErreurEdition && e.statut === 500 && e.message === 'Page armes : corps illisible (tableau absent) ; rien n’est enregistré.',
  );
});

test('corpsOuRefus laisse remonter toute autre erreur', () => {
  const autre = new TypeError('bug');
  assert.throws(() => corpsOuRefus(ErreurEdition, ErreurCorps, 'armes', () => { throw autre; }), (e) => e === autre);
});
