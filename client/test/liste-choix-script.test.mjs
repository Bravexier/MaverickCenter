// La liste de choix dessinée par le site à la place d'un menu de la fiche (src/scripts/liste-choix.mjs, demande du propriétaire : l'infobulle de chaque
// option, ce qu'elle apporte), exécutée dans un faux navigateur (test/aide-faux-dom.mjs, avec ce qu'un <select> a de plus : options, groupes,
// `value`, `selectedIndex`, `disabled` reflété en attribut ; le focus, `document.activeElement`). Elle épingle ce qui garantit que la fiche ne voit
// aucune différence de valeurs : le <select> caché garde la valeur, dans les deux sens (choix dans la liste → le <select> la prend et annonce `input`
// puis `change` ; valeur posée par la fiche → le bouton suit, sans évènement) ; Échap ne change rien ; Tab et Espace choisissent ; les marques du
// <select> passent au bouton ; la clé `{ cle }` rend le focus au bouton d'une liste que la fiche refait après un choix.
// Le faux navigateur ne fait pas remonter les évènements : une touche s'envoie sur le bouton ou sur la liste (le script lit l'option active dans
// `document.activeElement`), un clic sur la liste avec l'option pour cible.
//   node --test test/liste-choix-script.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listeDeChoix } from '../src/scripts/liste-choix.mjs';
import { attendre, cliquer, domVivant, el, Element, fauxDocument } from './aide-faux-dom.mjs';

/** Le focus de la page : un élément détaché le perd (le document le rend à `body`, comme un navigateur). */
let focus = null;
/** Un élément du faux navigateur, avec ce que la liste emploie en plus : le focus, `style`, les mesures (un écran de 1000 × 800). */
class ElementDeTest extends Element {
  constructor(...a) {
    super(...a);
    this.style = {};
    this.tabIndex = -1;
    this.offsetTop = 0;
    this.offsetHeight = 20;
    this.scrollTop = 0;
    this.scrollHeight = 100;
    this.clientHeight = 100;
  }
  focus() { focus = this; }
  getBoundingClientRect() { return { left: 10, top: 100, right: 210, bottom: 120, width: 200, height: 20 }; }
}
/** Une option : `value` (son attribut, sinon son texte), `selected` (lue dans son <select>), `disabled` reflété en attribut (`pret` : pas pendant la
 *  construction, où l'élément de l'aide pose `value` et `disabled` par défaut). */
class Option extends ElementDeTest {
  pret = true;
  get value() { return this.getAttribute('value') ?? this.textContent; }
  set value(v) { if (this.pret) this.setAttribute('value', v); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (!this.pret) return; if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get select() { return this.closest('select'); }
  get selected() { return Boolean(this.select) && this.select.options.indexOf(this) === this.select.selectedIndex; }
}
/** Un <select> simple : l'option choisie par son index (la première sans choix, -1 pour une valeur absente), `disabled` reflété en attribut. */
class Select extends ElementDeTest {
  pret = true;
  choix = null;
  get options() { return [...this.descendants()].filter((e) => e.tagName === 'OPTION'); }
  get selectedOptions() { return this.selectedIndex >= 0 ? [this.options[this.selectedIndex]] : []; }
  get selectedIndex() {
    const n = this.options.length;
    if (this.choix === null) return n ? 0 : -1;
    return this.choix < n ? this.choix : -1;
  }
  set selectedIndex(i) { if (this.pret) this.choix = Number.isInteger(i) && i >= 0 && i < this.options.length ? i : -1; }
  get value() { return this.selectedOptions[0]?.value ?? ''; }
  set value(v) { if (this.pret) this.choix = this.options.findIndex((o) => o.value === String(v)); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (!this.pret) return; if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  /** Le <label> qui l'entoure nomme le bouton de la liste (son premier élément étiquetable) : plus le <select>. */
  get labels() { return []; }
}

const option = (valeur, texte, attributs = {}) => new Option('option', { value: valeur, ...attributs }, [texte]);
const groupe = (label, ...options) => Object.assign(new ElementDeTest('optgroup', { label }, options), { label });

/** Le faux navigateur : le document, ses globales (celles que lit la liste) ; rend le document. */
function navigateur(...contenu) {
  const document = fauxDocument(...contenu);
  const { MutationObserver } = domVivant(document);
  document.createElement = (balise) => new ElementDeTest(balise);
  document.documentElement = document;
  document.clientWidth = 1000;
  document.clientHeight = 800;
  focus = null;
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => (focus?.isConnected ? focus : document.body) });
  Object.assign(globalThis, {
    document, MutationObserver, Element, Node: Element, HTMLSelectElement: Select,
    getComputedStyle: () => ({ fontSize: '16px' }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
  });
  return document;
}

/** Une touche, envoyée sur `cible` ; rend l'évènement (defaultPrevented). */
function touche(cible, key, { alt = false, ctrl = false } = {}) {
  const e = new Event('keydown', { cancelable: true });
  Object.defineProperties(e, { key: { value: key }, altKey: { value: alt }, ctrlKey: { value: ctrl }, metaKey: { value: false }, shiftKey: { value: false } });
  cible.dispatchEvent(e);
  return e;
}

/**
 * Le menu du métier comme la page l'écrit (`<label><span>Métier</span><select>`), remplacé par la liste : une option vide, un groupe de trois options
 * (une teintée, une désactivée), une dernière ; deux avec une infobulle. Rend la liste, son bouton, sa liste ouverte et les évènements que le <select>
 * annonce (type, valeur lue à ce moment).
 */
function menu({ cle = 'essai' } = {}) {
  const select = new Select('select', { id: 'metiers', 'data-champ': 'metier_id' }, [
    option('', 'Sans métier (facultatif)', { class: 'option-vide' }),
    groupe('Groupe',
      option('a', 'Acrobate', { title: 'Bonus : +3% Esquive' }),
      option('b', 'Brasseur', { class: 'teinte-palette couleur-magie-feu', title: 'Artisanat possible : la bière' }),
      option('c', 'Charpentier', { disabled: '' })),
    option('d', 'Domestique'),
  ]);
  const label = el('label', { class: 'choix-liste' }, el('span', {}, 'Métier'), select);
  navigateur(label);
  const evenements = [];
  for (const type of ['input', 'change']) select.addEventListener(type, () => evenements.push([type, select.value]));
  const enveloppe = listeDeChoix(select, { cle });
  const bouton = enveloppe.querySelector('.liste-choix__bouton');
  const liste = enveloppe.querySelector('.liste-choix__liste');
  const lignes = () => liste.querySelectorAll('[role="option"]');
  return { select, label, enveloppe, bouton, liste, lignes, evenements, texte: () => bouton.querySelector('.liste-choix__valeur').textContent };
}

test('la liste prend la place du menu : le <select> reste dans l’enveloppe, caché et hors du parcours au clavier ; le bouton montre l’option choisie et le nom du menu', () => {
  const { select, label, enveloppe, bouton, liste, texte } = menu();
  assert.equal(enveloppe.parentElement, label, 'à la place du <select>, dans son <label>');
  assert.equal(select.parentElement, enveloppe);
  assert.ok(select.hidden);
  assert.equal(select.tabIndex, -1);
  assert.equal(texte(), 'Sans métier (facultatif)');
  assert.equal(bouton.getAttribute('aria-haspopup'), 'listbox');
  assert.equal(bouton.getAttribute('aria-expanded'), 'false');
  assert.ok(liste.hidden);
  assert.equal(enveloppe.querySelector(`#${bouton.getAttribute('aria-labelledby').split(' ')[0]}`).textContent, 'Métier', 'le nom vient du <label>');
});

test('valeur posée par la fiche (`value`, `selectedIndex`) : le bouton suit aussitôt, sans évènement ; une valeur absente le vide', () => {
  const { select, texte, evenements } = menu();
  select.value = 'b';
  assert.equal(texte(), 'Brasseur', 'sans attendre : la valeur posée ne fait aucune mutation');
  assert.equal(select.value, 'b');
  assert.equal(select.selectedIndex, 2);
  select.selectedIndex = 4;
  assert.equal(texte(), 'Domestique');
  assert.equal(select.value, 'd');
  select.value = 'inconnue';
  assert.equal(texte(), '');
  assert.equal(select.value, '');
  assert.deepEqual(evenements, [], 'la fiche qui pose sa valeur n’annonce rien');
});

test('ouverte : une ligne par option, dans l’ordre, avec sa classe, son infobulle à côté (aucune sans texte), l’option choisie active et focalisée', () => {
  const { select, bouton, liste, lignes } = menu();
  select.value = 'a';
  cliquer(bouton);
  assert.ok(!liste.hidden);
  assert.equal(bouton.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(lignes().map((l) => l.textContent), ['Sans métier (facultatif)', 'Acrobate', 'Brasseur', 'Charpentier', 'Domestique']);
  assert.equal(liste.querySelector('.liste-choix__titre').textContent, 'Groupe');
  const [vide, a, b, c, d] = lignes();
  assert.equal(document.activeElement, a, 'le focus réel sur l’option choisie (Infobulles.astro n’ouvre au clavier que la bulle du focus)');
  assert.equal(a.getAttribute('aria-selected'), 'true');
  assert.equal(b.getAttribute('aria-selected'), 'false');
  assert.equal(a.getAttribute('data-infobulle'), 'Bonus : +3% Esquive');
  assert.equal(a.getAttribute('aria-description'), 'Bonus : +3% Esquive');
  assert.equal(a.getAttribute('data-placement'), 'cote');
  assert.ok(b.classList.contains('teinte-palette') && b.classList.contains('couleur-magie-feu'), 'la classe de la palette de l’option');
  assert.ok(vide.classList.contains('option-vide'));
  assert.equal(c.getAttribute('aria-disabled'), 'true');
  for (const l of [vide, c, d]) {
    assert.equal(l.getAttribute('data-infobulle'), null, `${l.textContent} : pas d’infobulle sans texte`);
    assert.equal(l.getAttribute('data-placement'), null);
  }
});

test('choix dans la liste (un clic) : le <select> prend la valeur et annonce `input` puis `change` ; la liste se ferme, le focus revient au bouton ; la même option ou une option désactivée : rien', () => {
  const { select, bouton, liste, lignes, evenements, texte } = menu();
  cliquer(bouton);
  const clic = cliquer(lignes()[2], liste);
  assert.ok(clic.defaultPrevented, 'le clic ne remonte pas au <label> (il cliquerait le bouton)');
  assert.deepEqual(evenements, [['input', 'b'], ['change', 'b']], 'la valeur est prise avant les évènements, dans l’ordre d’un menu natif');
  assert.equal(select.value, 'b');
  assert.equal(texte(), 'Brasseur');
  assert.ok(liste.hidden);
  assert.equal(bouton.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, bouton);
  cliquer(bouton);
  cliquer(lignes()[2], liste);
  cliquer(bouton);
  cliquer(lignes()[3], liste);
  assert.deepEqual(evenements, [['input', 'b'], ['change', 'b']], 'ni la même option ni une option désactivée');
  assert.equal(select.value, 'b');
});

test('clavier : ↓ sur le bouton ouvre (sans défilement de la page) ; ↓ ↑ Début Fin déplacent ; Entrée choisit', () => {
  const { select, bouton, liste, lignes, evenements } = menu();
  assert.ok(touche(bouton, 'ArrowDown').defaultPrevented);
  assert.ok(!liste.hidden);
  assert.equal(document.activeElement, lignes()[0]);
  touche(liste, 'ArrowDown');
  assert.equal(document.activeElement, lignes()[1]);
  touche(liste, 'End');
  assert.equal(document.activeElement, lignes()[4]);
  touche(liste, 'ArrowUp');
  assert.equal(document.activeElement, lignes()[3]);
  touche(liste, 'Home');
  touche(liste, 'ArrowDown');
  assert.ok(touche(liste, 'Enter').defaultPrevented);
  assert.deepEqual(evenements, [['input', 'a'], ['change', 'a']]);
  assert.equal(select.value, 'a');
  assert.ok(liste.hidden);
  assert.equal(document.activeElement, bouton);
});

test('Échap : la liste se ferme sans rien changer (ni valeur ni évènement), le focus revient au bouton, la touche ne va pas plus loin', () => {
  const { select, bouton, liste, evenements, texte } = menu();
  select.value = 'a';
  touche(bouton, 'Enter');
  touche(liste, 'ArrowDown');
  touche(liste, 'ArrowDown');
  let arretee = false;
  const e = new Event('keydown', { cancelable: true });
  Object.defineProperties(e, { key: { value: 'Escape' }, altKey: { value: false }, ctrlKey: { value: false }, metaKey: { value: false } });
  e.stopPropagation = () => { arretee = true; };
  liste.dispatchEvent(e);
  assert.ok(liste.hidden);
  assert.equal(select.value, 'a');
  assert.equal(texte(), 'Acrobate');
  assert.deepEqual(evenements, []);
  assert.equal(document.activeElement, bouton);
  assert.ok(arretee, 'Échap ne remonte pas (un tiroir ou un panneau ne se ferme pas avec la liste)');
  assert.ok(e.defaultPrevented, 'ni l’action par défaut (la fermeture d’un <dialog>)');
});

test('Tab : l’option active est choisie et le focus rendu au bouton, sans empêcher le navigateur de passer au champ suivant', () => {
  const { select, bouton, liste, evenements } = menu();
  touche(bouton, 'ArrowDown');
  touche(liste, 'End');
  const e = touche(liste, 'Tab');
  assert.ok(!e.defaultPrevented, 'le navigateur avance depuis le bouton');
  assert.deepEqual(evenements, [['input', 'd'], ['change', 'd']]);
  assert.equal(select.value, 'd');
  assert.ok(liste.hidden);
  assert.equal(document.activeElement, bouton);
});

test('Espace : sur le bouton, ouvre sans laisser au navigateur le clic du relâché ; dans la liste, choisit et ferme ; pendant une frappe, continue la recherche au lieu de choisir', () => {
  const { select, bouton, liste, evenements } = menu();
  assert.ok(touche(bouton, ' ').defaultPrevented, 'Espace empêché sur le bouton : son relâché ne le clique pas (il refermerait la liste)');
  assert.ok(!liste.hidden);
  touche(liste, 'ArrowDown');
  touche(liste, 'ArrowDown');
  assert.ok(touche(liste, ' ').defaultPrevented);
  assert.deepEqual(evenements, [['input', 'b'], ['change', 'b']]);
  assert.ok(liste.hidden);
  assert.equal(bouton.getAttribute('aria-expanded'), 'false', 'refermée, et la touche n’a pas rouvert la liste');
  assert.equal(document.activeElement, bouton);
  touche(bouton, 'Enter');
  touche(liste, 'd');
  touche(liste, ' ');
  assert.ok(!liste.hidden, 'Espace juste après une lettre : la recherche continue');
  assert.deepEqual(evenements, [['input', 'b'], ['change', 'b']]);
  assert.equal(select.value, 'b');
});

test('frappe : fermée, une lettre ouvre et passe à l’option suivante qui commence par elle, l’option choisie exclue ; ouverte, plusieurs lettres à la suite', () => {
  const { select, bouton, liste, lignes } = menu();
  select.value = 'a';
  touche(bouton, 'a');
  assert.ok(!liste.hidden);
  assert.equal(document.activeElement, lignes()[1], 'Acrobate est la seule option en « a » : on y reste');
  touche(liste, 'Escape');
  select.value = '';
  touche(bouton, 'd');
  assert.equal(document.activeElement, lignes()[4]);
});

test('marques du <select> recopiées sur le bouton (fiche.css les lit sur lui) : classes de la palette, `data-couleur`, `aria-invalid`, `data-a-choisir`, `data-vide`, `disabled` ; retirées avec elles', async () => {
  const { select, bouton, liste } = menu();
  select.className = 'teinte-palette couleur-magie-feu';
  for (const [nom, valeur] of [['data-couleur', ''], ['aria-invalid', 'true'], ['data-a-choisir', ''], ['data-vide', '']]) select.setAttribute(nom, valeur);
  select.disabled = true;
  await attendre();
  assert.ok(bouton.classList.contains('liste-choix__bouton') && bouton.classList.contains('teinte-palette') && bouton.classList.contains('couleur-magie-feu'));
  for (const [nom, valeur] of [['data-couleur', ''], ['aria-invalid', 'true'], ['data-a-choisir', ''], ['data-vide', '']]) assert.equal(bouton.getAttribute(nom), valeur, nom);
  assert.equal(bouton.disabled, true, 'grisé avec le <select>');
  touche(bouton, 'ArrowDown');
  cliquer(bouton);
  assert.ok(liste.hidden, 'grisée, elle ne s’ouvre pas');
  select.className = '';
  for (const nom of ['data-couleur', 'aria-invalid', 'data-a-choisir', 'data-vide']) select.removeAttribute(nom);
  select.disabled = false;
  await attendre();
  assert.equal(bouton.className, 'liste-choix__bouton');
  for (const nom of ['data-couleur', 'aria-invalid', 'data-a-choisir', 'data-vide']) assert.equal(bouton.getAttribute(nom), null, nom);
  assert.equal(bouton.disabled, false);
  cliquer(bouton);
  select.disabled = true;
  await attendre();
  assert.ok(liste.hidden, 'grisée pendant qu’elle est ouverte : refermée');
});

test('options refaites par la fiche pendant que la liste est ouverte : les lignes suivent, l’option active garde le focus', async () => {
  const { select, bouton, liste, lignes } = menu();
  cliquer(bouton);
  touche(liste, 'End');
  select.insertBefore(option('0', 'Archer'), select.children[1]);
  await attendre();
  assert.equal(lignes().length, 6);
  assert.equal(lignes()[1].textContent, 'Archer');
  assert.equal(document.activeElement.textContent, 'Domestique');
});

test('clé `{ cle }` : la fiche refait le bloc après un choix (le tableau des sorts, un livre dont l’aria-label nomme le sort) ; le focus va au nouveau bouton de même clé, jamais d’après le libellé', () => {
  for (const [cle, attendu] of [['livre-1', 'nouveau bouton'], [null, 'body']]) {
    const conteneur = el('div', {});
    navigateur(conteneur);
    const construire = (valeur) => {
      const nom = { x: 'Boule de feu', y: 'Cautérisation' }[valeur];
      const select = new Select('select', { 'aria-label': `Livre de sort : le sort (${nom})` }, [option('x', 'Boule de feu'), option('y', 'Cautérisation')]);
      select.value = valeur;
      // comme la fiche : un autre sort refait la ligne (son aria-label change avec lui)
      select.addEventListener('change', () => conteneur.replaceChildren(construire(select.value)));
      return listeDeChoix(select, { cle });
    };
    conteneur.append(construire('x'));
    const bouton = conteneur.querySelector('.liste-choix__bouton');
    touche(bouton, 'ArrowDown');
    touche(conteneur.querySelector('.liste-choix__liste'), 'ArrowDown');
    touche(conteneur.querySelector('.liste-choix__liste'), 'Enter');
    const nouveau = conteneur.querySelector('.liste-choix__bouton');
    assert.notEqual(nouveau, bouton, 'la ligne est refaite');
    assert.ok(!bouton.isConnected);
    assert.equal(nouveau.querySelector('.liste-choix__valeur').textContent, 'Cautérisation');
    assert.equal(document.activeElement === nouveau ? 'nouveau bouton' : document.activeElement === document.body ? 'body' : 'autre', attendu, `clé ${cle}`);
  }
});
