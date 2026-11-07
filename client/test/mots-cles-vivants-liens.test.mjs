// Les mots-clés vivants du site de dev (src/scripts/edition/mots-cles-vivants.mjs) et la migration 0096, dans un faux navigateur : un mot-clé à adresse
// est un lien préfixé de la base du site (`ed.base`), sauf dans un lien, un bouton, une étiquette ou une bulle (le gras seul) ; un mot-clé coloré porte
// sa classe, sa bulle aussi ; la feuille des couleurs (`<style data-couleurs-mots-cles>`) est relue au service quand une classe y manque, et réécrite
// avec celle que donne le glossaire (definirLeVocabulaire(liste, { css })).
//   node --test test/mots-cles-vivants-liens.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendre, domVivant, el, fauxDocument } from './aide-faux-dom.mjs';

const VOCABULAIRE = [
  { id: 'elfe', libelle: 'Elfe', libelle_cle: 'elfe', description: 'Un peuple.', url: '/races/elfe/', couleur: 'race:pure' },
  { id: 'feu', libelle: 'Feu', libelle_cle: 'feu', description: null, url: '/magies/magie-du-feu/', couleur: '#ff4500' },
  { id: 'mordhau', libelle: 'Mordhau', libelle_cle: 'mordhau', description: 'Une prise.', url: null, couleur: null },
];
const CSS = '.couleur-mot-cle-feu{--couleur:#ff4500;--couleur-texte:#171210}.couleur-race-pure{--couleur:#2f6a6a;--couleur-texte:#ffffff}';

const document = fauxDocument(
  el('p', { id: 'texte' }, 'Les {{elfe|elfes}}, le {{feu}} et {{mordhau}}.'),
  el('a', { id: 'lien', href: '/x/' }, '{{elfe}}'),
  el('label', { id: 'etiquette' }, '{{elfe}}'),
  el('button', { id: 'bouton', type: 'button' }, '{{elfe}}'),
  el('span', { id: 'case', tabindex: '0' }, '{{elfe}}'),
  // rendu au build (vocabulaire d'avant : sans adresse ni couleur), refait d'après le vocabulaire vivant
  el('p', { id: 'construit' }, el('strong', { class: 'mot-cle', 'data-mot-cle': 'elfe', 'data-balise': '{{elfe}}' }, 'Elfe')),
);
document.head.append(el('style', { 'data-couleurs-mots-cles': '' }, '.couleur-race-pure{--couleur:#2f6a6a;--couleur-texte:#ffffff}'));
const { MutationObserver, NodeFilter } = domVivant(document);
Object.assign(globalThis, { document, MutationObserver, NodeFilter });
const { definirLeVocabulaire, glossaireVivant } = await import('../src/scripts/edition/mots-cles-vivants.mjs');
const appels = [];
await glossaireVivant({
  base: '/MaverickCenter/',
  listes: { motsCles: VOCABULAIRE },
  async appel(methode, chemin) {
    appels.push([methode, chemin]);
    return { motsCles: VOCABULAIRE, css: CSS };
  },
});
await attendre();

const html = (id) => document.getElementById(id).innerHTML;

test('un mot-clé à adresse : un lien préfixé de la base du site (sans tabindex) ; sans adresse, le gras ; la classe de sa couleur', () => {
  assert.match(html('texte'), /^Les <a class="mot-cle couleur-race-pure" href="\/MaverickCenter\/races\/elfe\/" data-mot-cle="elfe" data-bulle="mot-cle-elfe" aria-describedby="mot-cle-elfe" data-balise="\{\{elfe\|elfes\}\}">elfes<\/a>/);
  assert.match(html('texte'), /le <a class="mot-cle couleur-mot-cle-feu" href="\/MaverickCenter\/magies\/magie-du-feu\/" data-mot-cle="feu" data-balise="\{\{feu\}\}">Feu<\/a>/, 'sans définition : cliquable, sans bulle (Q11)');
  assert.match(html('texte'), /<strong class="mot-cle" data-mot-cle="mordhau" data-bulle="mot-cle-mordhau" aria-describedby="mot-cle-mordhau" tabindex="0"/);
  assert.match(html('case'), /^<a class="mot-cle couleur-race-pure" href=/, 'un élément [tabindex] garde le lien');
  assert.match(html('construit'), /^<a class="mot-cle couleur-race-pure" href="\/MaverickCenter\/races\/elfe\/" data-mot-cle="elfe"/, 'un mot-clé construit suit le vocabulaire vivant');
});

test('pas de lien dans un lien, une étiquette ni un bouton (le gras seul) ; la bulle d’un mot-clé coloré porte sa classe', () => {
  for (const id of ['lien', 'etiquette', 'bouton']) {
    assert.match(html(id), /^<strong class="mot-cle couleur-race-pure" data-mot-cle="elfe"/, id);
    assert.doesNotMatch(html(id), /href=/, id);
  }
  assert.match(document.getElementById('mot-cle-elfe').outerHTML, /^<span class="bulle couleur-race-pure" role="tooltip" id="mot-cle-elfe"/);
});

test('la feuille des couleurs : relue au service quand une classe du vocabulaire y manque, puis réécrite avec celle du glossaire', async () => {
  assert.deepEqual(appels, [['GET', 'edition/mots-cles/']], '« couleur-mot-cle-feu » manquait à la feuille construite');
  const feuille = () => document.querySelector('style[data-couleurs-mots-cles]').textContent;
  assert.equal(feuille(), CSS);
  // le glossaire relu après un enregistrement : la couleur de « Feu » a changé, et sa bulle suit celle d'« Elfe » retirée
  definirLeVocabulaire([{ ...VOCABULAIRE[0], couleur: null }, VOCABULAIRE[1], VOCABULAIRE[2]], { css: '.couleur-mot-cle-feu{--couleur:#00ff00}' });
  await attendre();
  assert.equal(feuille(), '.couleur-mot-cle-feu{--couleur:#00ff00}');
  assert.match(document.getElementById('mot-cle-elfe').outerHTML, /^<span class="bulle" role="tooltip"/, 'la bulle : sans couleur');
  assert.match(html('construit'), /^<a class="mot-cle" href="\/MaverickCenter\/races\/elfe\/"/);
});
