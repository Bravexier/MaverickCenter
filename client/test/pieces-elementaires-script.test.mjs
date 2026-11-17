// Le script du texte « Pièces élémentaires » des pages Armes et Armures (src/scripts/pieces-elementaires.mjs ; components/equipement/PiecesElementaires.astro),
// exécuté dans un faux navigateur : une adresse qui vise le `<details>` replié (`#pieces-elementaires`, où mènent les liens de la page d'avant), ou un
// élément qu'il contient, l'ouvre au chargement et sur hashchange ; un élément du bloc est amené à l'écran ; toute autre adresse (ou une adresse mal
// formée) ne le touche pas, et un bloc que le lecteur a refermé ne se rouvre que si l'ancre le vise de nouveau, ou qu'un lien de la page mène à
// l'ancre que l'adresse a déjà (pas de hashchange : le clic l'ouvre).
//   node --test test/pieces-elementaires-script.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cliquer, el, fauxDocument } from './aide-faux-dom.mjs';
import { ANCRE_DES_PIECES_ELEMENTAIRES } from '../src/lib/equipement.mjs';

let numero = 0;

/** La page réduite à ce que le script lit : le bloc replié (avec un intertitre `#armes-elementaires` dedans), et un tableau hors du bloc ; l'adresse `hash`. */
async function charger(hash = '') {
  const defilements = [];
  const intertitre = el('h3', { id: 'armes-elementaires' });
  intertitre.scrollIntoView = () => defilements.push(intertitre.id);
  const bloc = el('details', { class: 'preg preg--pieces-elementaires', id: ANCRE_DES_PIECES_ELEMENTAIRES },
    el('summary', { class: 'preg__titre' }), el('div', { class: 'prose preg__corps' }, intertitre));
  bloc.scrollIntoView = () => defilements.push(bloc.id);
  const document = fauxDocument(el('section', { id: 'armes' }, bloc, el('div', { id: 'famille-epees' })));
  let ancre = hash;
  const window = new EventTarget();
  const location = { get hash() { return ancre; }, get href() { return `https://maverick-jdr.com/ressources/armes/${ancre}`; } };
  Object.assign(globalThis, { document, window, location });
  await import(`../src/scripts/pieces-elementaires.mjs?page=${(numero += 1)}`);
  const naviguer = (nouvelle) => {
    ancre = nouvelle;
    window.dispatchEvent(new Event('hashchange'));
  };
  /** Un clic sur un lien `href` de la page (hors du bloc), écouté sur le document ; `touches` : { ctrlKey… }. */
  const cliquerSur = (href, touches = {}) => {
    const lien = el('a', { href });
    document.body.append(lien);
    const e = new Event('click', { cancelable: true });
    Object.defineProperties(e, { target: { value: lien }, button: { value: 0 }, ...Object.fromEntries(Object.entries(touches).map(([k, v]) => [k, { value: v }])) });
    document.dispatchEvent(e);
  };
  return { bloc, defilements, naviguer, cliquerSur, document };
}

test('l’ancre du bloc au chargement l’ouvre (le navigateur y défile lui-même) ; sans ancre, il reste replié', async () => {
  const vise = await charger(`#${ANCRE_DES_PIECES_ELEMENTAIRES}`);
  assert.equal(vise.bloc.open, true);
  assert.deepEqual(vise.defilements, []);
  const sans = await charger('');
  assert.equal(sans.bloc.open, false);
});

test('une ancre d’un élément du bloc l’ouvre et amène l’élément à l’écran ; une ancre encodée est lue', async () => {
  const { bloc, defilements } = await charger('#armes%2Delementaires');
  assert.equal(bloc.open, true);
  assert.deepEqual(defilements, ['armes-elementaires']);
});

test('hashchange : l’ancre du bloc l’ouvre, une autre ancre ou une ancre mal formée ne le touche pas ; refermé, il se rouvre si l’ancre le vise de nouveau', async () => {
  const { bloc, naviguer } = await charger('#famille-epees');
  assert.equal(bloc.open, false, 'une ancre hors du bloc');
  naviguer('#%E0%A4%A');
  assert.equal(bloc.open, false, 'une ancre mal formée');
  naviguer(`#${ANCRE_DES_PIECES_ELEMENTAIRES}`);
  assert.equal(bloc.open, true);
  naviguer('#famille-epees');
  assert.equal(bloc.open, true, 'une autre ancre ne le referme pas');
  bloc.open = false;
  naviguer('#armes-elementaires');
  assert.equal(bloc.open, true, 'rouvert par une ancre qu’il contient');
});

test('un lien vers l’ancre que l’adresse a déjà (pas de hashchange) rouvre le bloc refermé ; un lien vers une autre ancre ou une autre page ne le touche pas', async () => {
  const { bloc, defilements, cliquerSur } = await charger('#armes-elementaires');
  assert.equal(bloc.open, true);
  bloc.open = false;
  defilements.length = 0;
  cliquerSur('#famille-epees');
  assert.equal(bloc.open, false, 'une autre ancre : le hashchange s’en charge');
  cliquerSur('/ressources/armures/#armes-elementaires');
  assert.equal(bloc.open, false, 'la même ancre sur une autre page');
  cliquerSur('#armes-elementaires', { ctrlKey: true });
  assert.equal(bloc.open, false, 'un clic qui ouvre un autre onglet');
  cliquerSur('#armes-elementaires');
  assert.equal(bloc.open, true, 'la même ancre, sans hashchange : le clic l’ouvre');
  assert.deepEqual(defilements, ['armes-elementaires'], 'l’élément amené à l’écran');
  bloc.open = false;
  cliquerSur('/ressources/armes/#armes-elementaires');
  assert.equal(bloc.open, true, 'la même adresse écrite en entier');
  // l'ancre du bloc lui-même, par un lien qu'il contient (cliquer : un évènement qui remonte jusqu'au document)
  const visant = await charger(`#${ANCRE_DES_PIECES_ELEMENTAIRES}`);
  visant.bloc.open = false;
  const dedans = el('a', { href: `#${ANCRE_DES_PIECES_ELEMENTAIRES}` });
  visant.bloc.append(dedans);
  cliquer(dedans, visant.document);
  assert.equal(visant.bloc.open, true, 'l’ancre du bloc lui-même');
});

test('une page sans le bloc : le script n’écoute rien', async () => {
  const document = fauxDocument(el('section', { id: 'boucliers' }));
  const window = new EventTarget();
  let ecoutes = 0;
  window.addEventListener = () => { ecoutes += 1; };
  Object.assign(globalThis, { document, window, location: { hash: '#boucliers' } });
  await import(`../src/scripts/pieces-elementaires.mjs?page=${(numero += 1)}`);
  assert.equal(ecoutes, 0);
});
