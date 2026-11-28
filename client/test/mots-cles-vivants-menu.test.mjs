// Les mots-clés vivants du site de dev (src/scripts/edition/mots-cles-vivants.mjs) ne refont pas les liens du menu latéral du site (R319 (4)) : un lien d'entrée porte
// `aria-current` (la page courante) et `data-placement="cote"` (la bulle sur le côté), que la balise du mot-clé ne dit pas ; refait d'après le vocabulaire, il les perdrait.
// Un mot-clé d'un texte de la même page, lui, suit le vocabulaire vivant comme avant.
//   node --test test/mots-cles-vivants-menu.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendre, domVivant, el, fauxDocument } from './aide-faux-dom.mjs';

const VOCABULAIRE = [{ id: 1, cle: 'elfe', libelle: 'Elfe', description: 'Un peuple.', url: '/races/elfe/', couleur: null }];
const lien = (extra = {}) => el('a', { class: 'mot-cle', href: '/races/elfe/', 'data-mot-cle': 'elfe', 'data-balise': '{{elfe}}', ...extra }, 'Elfe');
const document = fauxDocument(
  el('nav', { class: 'menu-site', 'data-menu-site': '' }, el('ul', {}, el('li', { id: 'entree' }, lien({ 'aria-current': 'page', 'data-placement': 'cote' })))),
  el('p', { id: 'texte' }, lien()),
);
const { MutationObserver, NodeFilter } = domVivant(document);
Object.assign(globalThis, { document, MutationObserver, NodeFilter, location: { pathname: '/races/elfe/' } });
const { definirLeVocabulaire } = await import('../src/scripts/edition/mots-cles-vivants.mjs');

test('le lien d’une entrée du menu latéral garde sa page courante et le côté de sa bulle quand le vocabulaire vivant est relu ; un mot-clé du texte est refait', async () => {
  definirLeVocabulaire(VOCABULAIRE);
  await attendre();
  assert.match(document.getElementById('entree').innerHTML, /^<a class="mot-cle" href="\/races\/elfe\/" data-mot-cle="elfe" data-balise="\{\{elfe\}\}" aria-current="page" data-placement="cote">Elfe<\/a>$/);
  assert.match(document.getElementById('texte').innerHTML, /^<a class="mot-cle" href="\/races\/elfe\/" data-mot-cle="elfe" data-bulle="mot-cle-elfe" aria-describedby="mot-cle-elfe" data-balise="\{\{elfe\}\}">Elfe<\/a>$/, 'un lien de texte : refait d’après le vocabulaire (sa bulle)');
});
