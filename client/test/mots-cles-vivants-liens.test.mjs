// Les mots-clés vivants du site de dev (src/scripts/edition/mots-cles-vivants.mjs) et la migration 0098, dans un faux navigateur : un mot-clé à adresse
// est un lien préfixé de la base du site (`ed.base`), sauf dans un lien, un bouton, une étiquette ou une bulle (le gras seul) ; un mot-clé coloré porte
// sa classe, sa bulle aussi ; la feuille des couleurs (`<style data-couleurs-mots-cles>`) est relue au service quand une classe y manque, et réécrite
// avec celle que donne le glossaire (definirLeVocabulaire(liste, { css })). R232 (4), qui remplace R191 : deux homonymes (la race et la classe
// raciale « Orios ») s'affichent sous le même libellé sur toutes les pages, leurs clés les distinguent.
//   node --test test/mots-cles-vivants-liens.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendre, domVivant, el, fauxDocument } from './aide-faux-dom.mjs';

const VOCABULAIRE = [
  { id: 1, cle: 'elfe', libelle: 'Elfe', description: 'Un peuple.', url: '/races/elfe/', couleur: 'race:pure' },
  { id: 2, cle: 'feu', libelle: 'Feu', description: null, url: '/magies/magie-du-feu/', couleur: '#ff4500' },
  { id: 3, cle: 'mordhau', libelle: 'Mordhau', description: 'Une prise.', url: null, couleur: null },
  // R232 (4) : des homonymes d'essai, la race et la classe raciale (leurs catégories, Race et Classe, font leurs clés)
  { id: 4, cle: 'orios-classe', libelle: 'Orios', categories: [6], description: 'Classe raciale.', url: '/classes/orios/', couleur: null },
  { id: 5, cle: 'orios-race', libelle: 'Orios', categories: [3], description: 'Une race.', url: '/races/orios/', couleur: null },
];
// la classe d'une couleur écrite : couleur-mot-cle-<id entier>
const CSS = '.couleur-mot-cle-2{--couleur:#ff4500;--couleur-texte:#171210}.couleur-race-pure{--couleur:#2f6a6a;--couleur-texte:#ffffff}';

const document = fauxDocument(
  el('p', { id: 'texte' }, 'Les {{elfe|elfes}}, le {{feu}} et {{mordhau}}.'),
  el('a', { id: 'lien', href: '/x/' }, '{{elfe}}'),
  el('label', { id: 'etiquette' }, '{{elfe}}'),
  el('button', { id: 'bouton', type: 'button' }, '{{elfe}}'),
  el('span', { id: 'case', tabindex: '0' }, '{{elfe}}'),
  // rendu au build (vocabulaire d'avant : sans adresse ni couleur), refait d'après le vocabulaire vivant
  el('p', { id: 'construit' }, el('strong', { class: 'mot-cle', 'data-mot-cle': 'elfe', 'data-balise': '{{elfe}}' }, 'Elfe')),
  el('p', { id: 'classe', title: 'la {{orios-classe}}' }, 'La {{orios-classe}}, {{orios-classe:}}, {{orios-race}}'),
);
document.head.append(el('style', { 'data-couleurs-mots-cles': '' }, '.couleur-race-pure{--couleur:#2f6a6a;--couleur-texte:#ffffff}'));
const { MutationObserver, NodeFilter } = domVivant(document);
// une page sous la base du site
const location = { pathname: '/MaverickCenter/classes/orios/' };
Object.assign(globalThis, { document, MutationObserver, NodeFilter, location });
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
  assert.match(html('texte'), /le <a class="mot-cle couleur-mot-cle-2" href="\/MaverickCenter\/magies\/magie-du-feu\/" data-mot-cle="feu" data-balise="\{\{feu\}\}">Feu<\/a>/, 'sans définition : cliquable, sans bulle (Q11)');
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
  assert.deepEqual(appels, [['GET', 'edition/mots-cles/']], '« couleur-mot-cle-2 » manquait à la feuille construite');
  const feuille = () => document.querySelector('style[data-couleurs-mots-cles]').textContent;
  assert.equal(feuille(), CSS);
  // le glossaire relu après un enregistrement : la couleur de « Feu » a changé, et sa bulle suit celle d'« Elfe » retirée
  definirLeVocabulaire([{ ...VOCABULAIRE[0], couleur: null }, ...VOCABULAIRE.slice(1)], { css: '.couleur-mot-cle-2{--couleur:#00ff00}' });
  await attendre();
  assert.equal(feuille(), '.couleur-mot-cle-2{--couleur:#00ff00}');
  assert.match(document.getElementById('mot-cle-elfe').outerHTML, /^<span class="bulle" role="tooltip"/, 'la bulle : sans couleur');
  assert.match(html('construit'), /^<a class="mot-cle" href="\/MaverickCenter\/races\/elfe\/"/);
});

test('R232 (4) : deux homonymes sous le même libellé, sur toutes les pages (balise, tuile, attribut, titre de la bulle), plus de « (classe) » ; leurs clés les distinguent', async () => {
  const { assurerLaBulle } = await import('../src/scripts/edition/mots-cles-vivants.mjs');
  assert.match(html('classe'), /^La <a class="mot-cle" href="\/MaverickCenter\/classes\/orios\/" data-mot-cle="orios-classe"[^>]*>Orios<\/a>, <span class="mot-cle-definition" data-mot-cle="orios-classe"[^>]*><a class="mot-cle-definition__nom" href="[^"]*">Orios<\/a>/);
  assert.match(html('classe'), /<a class="mot-cle" href="\/MaverickCenter\/races\/orios\/" data-mot-cle="orios-race"[^>]*>Orios<\/a>$/);
  assert.equal(document.getElementById('classe').getAttribute('title'), 'la Orios');
  assert.match(document.getElementById('mot-cle-orios-classe').outerHTML, /<strong class="bulle__titre">Orios<\/strong>/);
  assert.match(document.getElementById('mot-cle-orios-race').outerHTML, /<strong class="bulle__titre">Orios<\/strong>/);
  // sur le Glossaire (sous la base du site) : rien ne change
  location.pathname = '/MaverickCenter/regles/glossaire/';
  assurerLaBulle('orios-classe');
  assert.match(document.getElementById('mot-cle-orios-classe').outerHTML, /<strong class="bulle__titre">Orios<\/strong>/);
  definirLeVocabulaire(VOCABULAIRE);
  await attendre();
  assert.doesNotMatch(document.body.innerHTML.replace(/data-balise="[^"]*"/g, ''), /\(classe\)/i);
  location.pathname = '/MaverickCenter/classes/orios/';
});
