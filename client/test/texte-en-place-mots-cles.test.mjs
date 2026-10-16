// Les outils « Mot-clé » et « Définition » de l'éditeur en place (src/scripts/edition/texte-en-place.mjs : guide, Codex, chronologie, panneaux de règles,
// des textes mis en forme) dans un faux navigateur (test/aide-faux-dom.mjs) : ce qui se teste sans execCommand — changer un mot-clé déjà posé (le texte
// choisi garde son texte : « {{id|texte}} », « {{id}} » quand c'est le libellé), sans focus dans un lien, sa bulle posée ; la définition insérée (le HTML
// passé à execCommand : le mode complet, bloc insécable) ; puis le Markdown que l'éditeur en tire (lib/markdown-edition.mjs) et la forme canonique que
// le service enregistre (lib/mots-cles-balises.mjs#formeCanonique : « {{id}} » pour le libellé).
//   node --test test/texte-en-place-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arbreDuDom, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { formeCanonique } from '../src/lib/mots-cles-balises.mjs';
import { attendre, domVivant, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const VOCABULAIRE = [
  { id: 'non-mort', libelle: 'Non-mort', libelle_cle: 'non-mort', description: 'Une créature revenue de la mort.' },
  { id: 'mordhau', libelle: 'Mordhau', libelle_cle: 'mordhau', description: 'Une prise de l’épée par la lame.' },
];

const motCle = (id, texte, balise = `{{${id}}}`) => el('strong', { class: 'mot-cle', 'data-mot-cle': id, 'data-balise': balise }, texte);
const premier = motCle('non-mort', 'les morts', '{{non-mort|les morts}}');
const second = motCle('non-mort', 'Mordhau', '{{non-mort|Mordhau}}');
const dansLeLien = motCle('non-mort', 'Non-mort');
const zone = el('div', { class: 'ed-texte-guide', contenteditable: 'true' }, el('p', {}, 'Voir ', premier, ', ', second, ' et ', el('a', { href: '/x/' }, dansLeLien), '.'));
const document = fauxDocument(zone);
const { MutationObserver, NodeFilter } = domVivant(document);
let selection = null; // la plage de la sélection : { startContainer, endContainer, toString }
const insertions = [];
document.execCommand = (nom, _ui, valeur) => insertions.push([nom, valeur]);
Element.prototype.select = () => {};
Object.assign(globalThis, {
  document, MutationObserver, NodeFilter,
  Option: function Option(texte) { return el('option', {}, texte); },
  getSelection: () => ({ rangeCount: selection ? 1 : 0, getRangeAt: () => selection, removeAllRanges: () => {}, addRange: (r) => { selection = r; } }),
});
const { editeurEnPlace } = await import('../src/scripts/edition/texte-en-place.mjs');
const texte = editeurEnPlace(() => [zone]);
let modifie = 0;
const ed = { listes: { motsCles: VOCABULAIRE }, marquerModifie: () => { modifie += 1; }, annoncer: (m) => { throw new Error(m); } };

/** Place la sélection dans `noeud` (un texte vide pour « le texte choisi »), lance l'outil, choisit `choix` dans la petite boîte et l'envoie. */
async function poser(outil, noeud, choix) {
  selection = { startContainer: noeud, endContainer: noeud, toString: () => '' };
  await outil(ed);
  const dialogue = document.body.querySelector('dialog');
  assert.ok(dialogue, 'la petite boîte du choix');
  assert.ok(dialogue.hasAttribute('data-mots-cles-bruts'), 'ses textes d’aide restent tels qu’écrits');
  dialogue.querySelector('input').value = choix;
  dialogue.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await attendre();
}

test('« Mot-clé » sur un mot-clé posé : le texte choisi garde son texte (« {{id|texte}} »), « {{id}} » quand c’est le libellé ; sa bulle posée, pas de focus dans un lien', async () => {
  await poser(texte.motCle, premier.firstChild ?? premier.childNodes[0], 'Mordhau — mordhau');
  const p = zone.querySelector('p');
  assert.match(p.innerHTML, /<strong class="mot-cle" data-mot-cle="mordhau" data-bulle="mot-cle-mordhau" aria-describedby="mot-cle-mordhau" tabindex="0" data-balise="\{\{mordhau\|les morts\}\}">les morts<\/strong>/);
  assert.ok(document.getElementById('mot-cle-mordhau'), 'la bulle du mot-clé posé');
  await poser(texte.motCle, second.childNodes[0], 'mordhau');
  assert.match(p.innerHTML, /data-balise="\{\{mordhau\}\}">Mordhau<\/strong>/, 'son libellé : l’id seul, il le suivra');
  await poser(texte.motCle, dansLeLien.childNodes[0], 'Mordhau — mordhau');
  assert.match(p.innerHTML, /<a href="\/x\/"><strong class="mot-cle" data-mot-cle="mordhau" data-bulle="mot-cle-mordhau" aria-describedby="mot-cle-mordhau" data-balise="\{\{mordhau\|Non-mort\}\}">Non-mort<\/strong><\/a>/,
    'dans un lien : sans tabindex');
  assert.equal(modifie, 3);
  // le Markdown de la zone, puis la forme canonique du service
  const markdown = versMarkdown(arbreDuDom(zone).enfants);
  assert.equal(markdown, 'Voir {{mordhau|les morts}}, {{mordhau|Mordhau}} et [{{mordhau|Non-mort}}](/x/).\n');
  assert.equal(formeCanonique(markdown, VOCABULAIRE, { markdown: true }).texte, 'Voir {{mordhau|les morts}}, {{mordhau}} et [{{mordhau|Non-mort}}](/x/).\n');
});

test('« Définition » : le mode complet inséré (execCommand), un bloc insécable que le Markdown relit « {{id:}} »', async () => {
  const p = zone.querySelector('p');
  await poser(texte.definition, p.childNodes[0], 'Non-mort — non-mort');
  const [nom, html] = insertions.at(-1);
  assert.equal(nom, 'insertHTML');
  assert.match(html, /^<span class="mot-cle-definition" contenteditable="false" data-mot-cle="non-mort" data-balise="\{\{non-mort:\}\}"><strong class="mot-cle-definition__nom">Non-mort<\/strong> : <span class="mot-cle-definition__texte">Une créature revenue de la mort\.<\/span><\/span>$/);
  const bloc = el('div', {});
  bloc.innerHTML = `<p>${html}</p>`;
  assert.equal(versMarkdown(arbreDuDom(bloc).enfants), '{{non-mort:}}\n');
});

test('un mot-clé introuvable : la boîte reste ouverte et le dit', async () => {
  selection = { startContainer: zone.querySelector('p').childNodes[0], endContainer: zone.querySelector('p').childNodes[0], toString: () => '' };
  await texte.motCle(ed);
  const dialogue = document.body.querySelector('dialog');
  dialogue.querySelector('input').value = 'aucun mot-clé de ce nom';
  dialogue.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.match(dialogue.querySelector('.ed-erreur').textContent, /Mot-clé introuvable/);
  assert.equal(dialogue.querySelector('.ed-erreur').hidden, false);
  dialogue.close();
});
