// Les mots-clés vivants du site de dev (src/scripts/edition/mots-cles-vivants.mjs) dans un faux navigateur (test/aide-faux-dom.mjs#domVivant) : la page
// suit le vocabulaire vivant (libellé, bulle refaite, mot-clé supprimé réduit à son texte), le HTML posé ensuite a ses balises rendues comme par le
// middleware (zones exclues et brutes, bulle, bouton, attributs), et l'observateur ne boucle pas sur ses propres écritures (un « {{ » seul n'est pas une
// balise : ni réécrit, ni relu).
//   node --test test/mots-cles-vivants.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendre, domVivant, el, fauxDocument } from './aide-faux-dom.mjs';

const VOCABULAIRE = [
  { id: 'non-mort', libelle: 'Non-mort', libelle_cle: 'non-mort', description: 'Une créature revenue de la mort.' },
  { id: 'mordhau', libelle: 'Mordhau', libelle_cle: 'mordhau', description: 'Une prise de l’épée par la lame.' },
  { id: 'recharge-longue', libelle: 'Recharge longue', libelle_cle: 'recharge-longue', description: null },
];

const paragraphe = el('p', { id: 'p' }, 'Voir {{non-mort}} et {{inconnu|x}}.');
const incomplet = el('span', { id: 'incomplet', title: 'a {{ b' }, 'texte {{ seul');
const code = el('code', { id: 'code', title: '{{mordhau}}' }, '{{non-mort}}');
const brut = el('div', { id: 'brut', 'data-mots-cles-bruts': '' }, el('p', { title: '{{mordhau}}' }, '{{non-mort}}'));
const bouton = el('button', { id: 'bouton', type: 'button' }, '{{non-mort}}');
const bulle = el('span', { class: 'bulle', id: 'une-bulle', role: 'tooltip' }, '{{non-mort}}');
const lien = el('a', { id: 'lien', href: '/x/' }, '{{mordhau|la prise}}');
const ancien = el('strong', { class: 'mot-cle', 'data-mot-cle': 'mordhau', 'data-balise': '{{mordhau}}', id: 'ancien' }, 'Ancien libellé');
const disparu = el('strong', { class: 'mot-cle', 'data-mot-cle': 'perdu', 'data-balise': '{{perdu|le perdu}}', id: 'disparu' }, 'le perdu');
const document = fauxDocument(paragraphe, incomplet, code, brut, bouton, bulle, lien, el('p', { id: 'conteneurs' }, ancien, ' ', disparu));
const { MutationObserver, NodeFilter } = domVivant(document);
Object.assign(globalThis, { document, MutationObserver, NodeFilter });
const { assurerLaBulle, definirLeVocabulaire, glossaireVivant } = await import('../src/scripts/edition/mots-cles-vivants.mjs');
await glossaireVivant({ listes: { motsCles: VOCABULAIRE } });

const html = (id) => document.getElementById(id).outerHTML;

test('au chargement : les balises de la page rendues avec le vocabulaire vivant, une bulle par mot-clé décrit ; les zones exclues et brutes gardées', () => {
  assert.match(html('p'), /<strong class="mot-cle" data-mot-cle="non-mort" data-bulle="mot-cle-non-mort" aria-describedby="mot-cle-non-mort" tabindex="0" data-balise="\{\{non-mort\}\}">Non-mort<\/strong> et x\./);
  assert.equal(html('code'), '<code id="code" title="{{mordhau}}">{{non-mort}}</code>', 'un code : texte et attributs tels qu’écrits');
  assert.equal(html('brut'), '<div id="brut" data-mots-cles-bruts=""><p title="{{mordhau}}">{{non-mort}}</p></div>');
  assert.match(html('bouton'), /<button id="bouton" type="button"><strong class="mot-cle" data-mot-cle="non-mort" data-balise="\{\{non-mort\}\}">Non-mort<\/strong><\/button>/,
    'dans un bouton : le gras seul');
  assert.match(html('une-bulle'), /<span class="bulle" id="une-bulle" role="tooltip"><strong class="mot-cle" data-mot-cle="non-mort" data-balise="\{\{non-mort\}\}">Non-mort<\/strong><\/span>/,
    'dans une bulle : ni bulle ni focus');
  assert.match(html('lien'), /data-bulle="mot-cle-mordhau" aria-describedby="mot-cle-mordhau" data-balise="\{\{mordhau\|la prise\}\}">la prise<\/strong><\/a>/, 'dans un lien : sans tabindex');
  assert.ok(document.getElementById('mot-cle-non-mort'), 'la bulle de « Non-mort »');
  assert.ok(document.getElementById('mot-cle-mordhau'), 'la bulle de « Mordhau »');
  assert.equal(document.getElementById('mot-cle-recharge-longue'), null, 'pas de bulle sans définition');
  // déjà rendus au build : refaits d'après le vocabulaire vivant
  assert.match(document.getElementById('conteneurs').innerHTML, /data-balise="\{\{mordhau\}\}">Mordhau<\/strong> le perdu$/, 'libellé vivant ; un mot-clé disparu : son texte');
  assert.equal(html('incomplet'), '<span id="incomplet" title="a {{ b">texte {{ seul</span>', '« {{ » seul : rien n’est écrit');
});

test('HTML posé ensuite : rendu dès qu’il est posé (texte et attributs), comme le middleware', async () => {
  document.body.insertAdjacentHTML('beforeend', '<section id="pose"><p title="Avec {{mordhau}}">{{recharge-longue}} et {{mordhau:}}</p><pre>{{mordhau}}</pre></section>');
  await attendre();
  const pose = document.getElementById('pose').innerHTML;
  assert.match(pose, /<p title="Avec Mordhau"><strong class="mot-cle" data-mot-cle="recharge-longue" data-balise="\{\{recharge-longue\}\}">Recharge longue<\/strong> et <span class="mot-cle-definition"/);
  assert.match(pose, /<strong class="mot-cle-definition__nom">Mordhau<\/strong> : <span class="mot-cle-definition__texte">Une prise de l’épée par la lame\.<\/span>/);
  assert.match(pose, /<pre>\{\{mordhau\}\}<\/pre>/);
  // un texte changé, un attribut posé
  const p = document.getElementById('pose').querySelector('pre').previousElementSibling;
  p.setAttribute('data-infobulle', 'Voir {{non-mort|les morts}}');
  await attendre();
  assert.equal(p.getAttribute('data-infobulle'), 'Voir les morts');
});

test('pas de boucle : un attribut ou un texte où « {{ » n’ouvre aucune balise n’est ni réécrit ni relu ; une page rendue ne change plus', async () => {
  await attendre();
  const avant = MutationObserver.nombre;
  const span = document.getElementById('incomplet');
  span.setAttribute('title', 'Encore {{ incomplet');
  span.firstElementChild?.remove();
  span.append(' et {{ toujours');
  for (let i = 0; i < 20; i += 1) await attendre();
  assert.ok(MutationObserver.nombre - avant <= 2, `remises : ${MutationObserver.nombre - avant}`);
  assert.equal(span.getAttribute('title'), 'Encore {{ incomplet');
  const stable = document.body.innerHTML;
  const nombre = MutationObserver.nombre;
  for (let i = 0; i < 5; i += 1) await attendre();
  assert.equal(MutationObserver.nombre, nombre, 'plus rien ne bouge');
  assert.equal(document.body.innerHTML, stable);
});

test('le vocabulaire change (glossaire relu) : libellés, mode complet et bulles suivent ; un mot-clé supprimé redevient son texte', async () => {
  definirLeVocabulaire([
    { id: 'non-mort', libelle: 'Mort-vivant', libelle_cle: 'mort-vivant', description: 'Définition revue.' },
    { id: 'recharge-longue', libelle: 'Recharge longue', libelle_cle: 'recharge-longue', description: 'Désormais décrite.' },
  ]);
  await attendre();
  assert.match(html('p'), />Mort-vivant<\/strong>/, 'une balise sans texte écrit : le nouveau libellé');
  assert.equal(document.getElementById('mot-cle-non-mort').textContent, 'Mort-vivantDéfinition revue.', 'la bulle refaite');
  assert.equal(document.getElementById('mot-cle-mordhau'), null, 'Mordhau supprimé : plus de bulle');
  assert.match(html('lien'), /<a id="lien" href="\/x\/">la prise<\/a>/, 'son texte simple');
  assert.ok(document.getElementById('mot-cle-recharge-longue'), 'décrit : sa bulle est posée');
  assert.match(document.getElementById('pose').innerHTML, /data-bulle="mot-cle-recharge-longue"/, 'et ses déclencheurs');
  assurerLaBulle('non-mort');
  assert.equal(document.querySelectorAll('#mot-cle-non-mort').length, 1, 'une seule bulle par mot-clé');
});
