// Les mots-clés du glossaire dans l'éditeur en place (src/scripts/edition/texte-en-place.mjs : guide, Codex, chronologie, panneaux de règles, des textes
// mis en forme), dans un faux navigateur (test/aide-faux-dom.mjs) ; demande du propriétaire du 2026-10-17 : « Quand je passe en mode édition le texte
// devrai remettre le texte en mode Markdown […] je ne vois pas {{Recharge Longue}} ». À l'entrée (rendreModifiable), chaque mot-clé rendu redevient sa
// balise écrite, « {{id}} », « {{id|texte}} », « {{id:}} » (lib/markdown-edition.mjs#baliseEcrite), que le Markdown relit telle quelle ; les outils
// « Mot-clé » et « Définition » écrivent la balise (execCommand insertText) ou, le curseur dans une balise, en changent le mot-clé ; puis la forme
// canonique que le service enregistre (lib/mots-cles-balises.mjs#formeCanonique). Et la hauteur de la barre d'outils (hauteurDeLaBarre).
//   node --test test/texte-en-place-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arbreDuDom, baliseEcrite, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { formeCanonique } from '../src/lib/mots-cles-balises.mjs';
import { attendre, domVivant, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const VOCABULAIRE = [
  { id: 'non-mort', libelle: 'Non-mort', libelle_cle: 'non-mort', description: 'Une créature revenue de la mort.' },
  { id: 'mordhau', libelle: 'Mordhau', libelle_cle: 'mordhau', description: 'Une prise de l’épée par la lame.' },
];

const motCle = (id, texte, balise = `{{${id}}}`) => el('strong', { class: 'mot-cle', 'data-mot-cle': id, 'data-balise': balise, tabindex: '0' }, texte);
const definitionRendue = (id, libelle, texte) => el('span', { class: 'mot-cle-definition', 'data-mot-cle': id, 'data-balise': `{{${id}:}}` },
  el('strong', { class: 'mot-cle-definition__nom' }, libelle), ' : ', el('span', { class: 'mot-cle-definition__texte' }, texte));
// la zone telle que le build la rend : un mot-clé avec un autre texte, un au libellé, un dans un lien, le mode complet
const zone = el('div', { class: 'prose' },
  el('p', {}, 'Voir ', motCle('non-mort', 'les morts', '{{non-mort|les morts}}'), ', ', motCle('mordhau', 'Mordhau'), ' et ',
    el('a', { href: '/x/' }, motCle('non-mort', 'Non-mort')), '.'),
  el('p', {}, definitionRendue('mordhau', 'Mordhau', 'Une prise de l’épée par la lame.')));
const document = fauxDocument(zone);
const { MutationObserver, NodeFilter } = domVivant(document);
let selection = null; // la plage de la sélection : { startContainer, endContainer, startOffset, endOffset, collapsed, toString }
const insertions = [];
document.execCommand = (nom, _ui, valeur) => insertions.push([nom, valeur]);
Element.prototype.select = () => {};
Object.assign(globalThis, {
  document, MutationObserver, NodeFilter,
  Option: function Option(texte) { return el('option', {}, texte); },
  getSelection: () => ({ rangeCount: selection ? 1 : 0, getRangeAt: () => selection, removeAllRanges: () => {}, addRange: (r) => { selection = r; } }),
});
const { editeurEnPlace, hauteurDeLaBarre } = await import('../src/scripts/edition/texte-en-place.mjs');
const texte = editeurEnPlace(() => [zone]);
let modifie = 0;
const ed = { listes: { motsCles: VOCABULAIRE }, marquerModifie: () => { modifie += 1; }, annoncer: (m) => { throw new Error(m); } };
const markdown = () => versMarkdown(arbreDuDom(zone).enfants);
const premierTexte = () => zone.querySelector('p').childNodes[0];

/** Place la sélection dans le nœud de texte `noeud`, de `debut` à `fin` (le curseur si égaux), lance l'outil, choisit `choix` et l'envoie. */
async function poser(outil, noeud, debut, fin, choix) {
  selection = { startContainer: noeud, endContainer: noeud, startOffset: debut, endOffset: fin, collapsed: debut === fin, toString: () => noeud.nodeValue.slice(debut, fin) };
  await outil(ed);
  const dialogue = document.body.querySelector('dialog');
  assert.ok(dialogue, 'la petite boîte du choix');
  assert.ok(dialogue.hasAttribute('data-mots-cles-bruts'), 'ses textes d’aide (qui citent la syntaxe des balises) restent tels qu’écrits');
  dialogue.querySelector('input').value = choix;
  dialogue.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await attendre();
}

test('baliseEcrite : la balise écrite d’un mot-clé rendu (l’id, son texte écrit, jamais le libellé affiché) ; le mode complet ; rien pour un autre nœud', () => {
  const arbre = (n) => arbreDuDom(n);
  assert.equal(baliseEcrite(arbre(motCle('non-mort', 'les morts', '{{non-mort|les morts}}'))), '{{non-mort|les morts}}');
  assert.equal(baliseEcrite(arbre(motCle('mordhau', 'Mordhau'))), '{{mordhau}}', 'au libellé : l’id seul (le libellé affiché suit le vocabulaire)');
  assert.equal(baliseEcrite(arbre(motCle('mordhau', 'Mordhau, renommé', '{{mordhau}}'))), '{{mordhau}}', 'un libellé vivant n’est pas un texte écrit');
  assert.equal(baliseEcrite(arbre(el('strong', { class: 'mot-cle', 'data-mot-cle': 'mordhau' }, 'la prise'))), '{{mordhau|la prise}}', 'sans data-balise : le texte affiché');
  assert.equal(baliseEcrite(arbre(definitionRendue('mordhau', 'Mordhau', 'Une prise.'))), '{{mordhau:}}');
  assert.equal(baliseEcrite(arbre(el('strong', {}, 'gras'))), null);
  assert.equal(baliseEcrite({ type: 'texte', valeur: '{{mordhau}}' }), null);
});

test('à l’entrée en mode modification, les mots-clés rendus redeviennent leurs balises écrites, que le Markdown relit telles quelles', () => {
  const avant = markdown();
  texte.rendreModifiable(ed, zone, new AbortController().signal);
  assert.equal(zone.contentEditable, 'true');
  assert.equal(zone.querySelectorAll('.mot-cle, .mot-cle-definition').length, 0, 'plus de mot-clé rendu dans la zone');
  assert.equal(zone.querySelector('p').textContent, 'Voir {{non-mort|les morts}}, {{mordhau}} et {{non-mort}}.');
  assert.equal(zone.querySelectorAll('p')[1].textContent, '{{mordhau:}}');
  assert.equal(markdown(), 'Voir {{non-mort|les morts}}, {{mordhau}} et [{{non-mort}}](/x/).\n\n{{mordhau:}}\n');
  // le rendu relu d'un mot-clé au libellé l'écrit avec son texte (le service en refait « {{id}} ») : relu à l'entrée, il serait une fausse modification
  assert.equal(avant, 'Voir {{non-mort|les morts}}, {{mordhau|Mordhau}} et [{{non-mort|Non-mort}}](/x/).\n\n{{mordhau:}}\n');
  assert.equal(formeCanonique(markdown(), VOCABULAIRE, { markdown: true }).texte, markdown(), 'déjà la forme canonique');
});

test('« Mot-clé » sur le texte choisi : sa balise s’écrit à sa place (insertText), « {{id}} » quand c’est le libellé', async () => {
  const n = premierTexte(); // « Voir {{non-mort|les morts}}, … »
  await poser(texte.motCle, n, 0, 4, 'Mordhau — mordhau');
  assert.deepEqual(insertions.at(-1), ['insertText', '{{mordhau|Voir}}']);
  await poser(texte.motCle, n, 0, 4, 'non-mort');
  assert.deepEqual(insertions.at(-1), ['insertText', '{{non-mort|Voir}}']);
  const libelle = el('p', {}, 'Le Mordhau.');
  zone.append(libelle);
  await poser(texte.motCle, libelle.childNodes[0], 3, 10, 'mordhau');
  assert.deepEqual(insertions.at(-1), ['insertText', '{{mordhau}}'], 'le texte choisi est le libellé : l’id seul, il le suivra');
  libelle.remove();
  // le vocabulaire vivant, lu par l'outil, ne rend rien dans une zone en cours de saisie (mots-cles-vivants.mjs) : les balises y restent écrites
  assert.equal(zone.querySelectorAll('.mot-cle, .mot-cle-definition').length, 0);
});

test('« Mot-clé », le curseur dans une balise : son mot-clé change, son texte écrit reste ; le mode complet devient « {{id}} »', async () => {
  const n = premierTexte();
  const avant = modifie;
  const dans = n.nodeValue.indexOf('les morts');
  await poser(texte.motCle, n, dans, dans, 'Mordhau — mordhau');
  assert.equal(n.nodeValue, 'Voir {{mordhau|les morts}}, {{mordhau}} et ');
  const ici = n.nodeValue.indexOf('{{mordhau}}') + 3;
  await poser(texte.motCle, n, ici, ici, 'Non-mort — non-mort');
  assert.equal(n.nodeValue, 'Voir {{mordhau|les morts}}, {{non-mort}} et ', 'sans texte écrit : l’id seul');
  // le curseur juste avant « {{ » n'est pas dans la balise : un nouveau mot-clé s'insère à côté
  const bord = n.nodeValue.indexOf('{{non-mort}}');
  await poser(texte.motCle, n, bord, bord, 'mordhau');
  assert.deepEqual(insertions.at(-1), ['insertText', '{{mordhau}}']);
  assert.equal(n.nodeValue, 'Voir {{mordhau|les morts}}, {{non-mort}} et ', 'rien de remplacé');
  const complet = zone.querySelectorAll('p')[1].childNodes[0];
  await poser(texte.motCle, complet, 4, 4, 'non-mort');
  assert.equal(complet.nodeValue, '{{non-mort}}');
  assert.equal(modifie, avant + 4);
});

test('« Définition » : la balise du mode complet écrite au curseur, ou à la place de la balise où est le curseur', async () => {
  const n = premierTexte();
  await poser(texte.definition, n, 2, 2, 'Non-mort — non-mort');
  assert.deepEqual(insertions.at(-1), ['insertText', '{{non-mort:}}']);
  const complet = zone.querySelectorAll('p')[1].childNodes[0];
  await poser(texte.definition, complet, 3, 3, 'mordhau');
  assert.equal(complet.nodeValue, '{{mordhau:}}');
  assert.equal(versMarkdown(arbreDuDom(zone.querySelectorAll('p')[1]).enfants), '{{mordhau:}}\n');
});

test('un mot-clé introuvable : la boîte reste ouverte et le dit', async () => {
  const n = premierTexte();
  selection = { startContainer: n, endContainer: n, startOffset: 0, endOffset: 0, collapsed: true, toString: () => '' };
  await texte.motCle(ed);
  const dialogue = document.body.querySelector('dialog');
  dialogue.querySelector('input').value = 'aucun mot-clé de ce nom';
  dialogue.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.match(dialogue.querySelector('.ed-erreur').textContent, /Mot-clé introuvable/);
  assert.equal(dialogue.querySelector('.ed-erreur').hidden, false);
  dialogue.close();
});

test('hauteurDeLaBarre : à la hauteur de la zone, toujours entière à l’écran', () => {
  const ecran = 800;
  assert.equal(hauteurDeLaBarre({ top: 300, bottom: 360 }, 200, ecran), 300, 'le haut de la zone');
  assert.equal(hauteurDeLaBarre({ top: 300, bottom: 1400 }, 200, ecran), 300);
  assert.equal(hauteurDeLaBarre({ top: -500, bottom: 1400 }, 200, ecran), 8, 'le haut de la zone passé au-dessus de l’écran : le haut de l’écran');
  assert.equal(hauteurDeLaBarre({ top: -900, bottom: 150 }, 200, ecran), 8);
  assert.equal(hauteurDeLaBarre({ top: 750, bottom: 900 }, 200, ecran), 592, 'une zone en bas de l’écran : la barre remonte pour y tenir');
  assert.equal(hauteurDeLaBarre({ top: 1200, bottom: 1300 }, 200, ecran), 592, 'une zone sous l’écran : en bas de l’écran');
  assert.equal(hauteurDeLaBarre({ top: 300, bottom: 400 }, 900, ecran), 8, 'une barre plus haute que l’écran : en haut (elle défile)');
});
