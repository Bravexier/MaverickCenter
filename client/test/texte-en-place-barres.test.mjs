// Plusieurs éditeurs en place sur une même page (le cas de Bienvenue jusqu'au 2026-10-23 : le texte de la page, src/scripts/edition/guide.mjs, et
// l'annonce de l'encart « Notre prochaine rencontre IRL » sous lui, src/scripts/edition/annonces.mjs, aujourd'hui sur l'accueil) : une seule barre
// d'outils se montre, celle de l'éditeur où est le curseur, sinon la dernière qui l'a eu, sinon la première posée (texte-en-place.mjs#choisirLaBarre).
//   node --test test/texte-en-place-barres.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { el, fauxDocument } from './aide-faux-dom.mjs';

globalThis.document ??= fauxDocument();
const { choisirLaBarre } = await import('../src/scripts/edition/texte-en-place.mjs');

test('une seule barre d’outils à la fois : celle de l’éditeur où est le curseur', () => {
  const texte = el('div', { class: 'ed-barre-guide' });
  const annonce = el('div', { class: 'ed-barre-guide' });
  const document = fauxDocument(texte, annonce);
  assert.ok(texte.isConnected && document);
  let curseur = null; // l'éditeur où est le curseur
  const barres = new Set([{ el: texte, aLeCurseur: () => curseur === 'texte' }, { el: annonce, aLeCurseur: () => curseur === 'annonce' }]);
  const [b1, b2] = [...barres];
  // personne n'a le curseur : la première posée
  assert.equal(choisirLaBarre(barres), b1);
  assert.deepEqual([texte.hidden, annonce.hidden], [false, true]);
  // le curseur dans l'annonce : sa barre seulement
  curseur = 'annonce';
  assert.equal(choisirLaBarre(barres), b2);
  assert.deepEqual([texte.hidden, annonce.hidden], [true, false]);
  // le curseur sorti des zones (un clic sur la barre, ailleurs dans la page) : la dernière qui l'a eu reste
  curseur = null;
  assert.equal(choisirLaBarre(barres), b2);
  assert.deepEqual([texte.hidden, annonce.hidden], [true, false]);
  // la barre de l'annonce retirée (fin du mode modification) : l'autre, seule, se montre
  annonce.remove();
  assert.equal(choisirLaBarre(barres), b1);
  assert.equal(texte.hidden, false);
});

test('une barre seule n’est jamais cachée', () => {
  const seule = el('div', { class: 'ed-barre-guide' });
  fauxDocument(seule);
  assert.ok(choisirLaBarre(new Set([{ el: seule, aLeCurseur: () => false }])));
  assert.equal(seule.hidden, false);
});
