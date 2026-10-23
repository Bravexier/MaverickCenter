// Les couleurs de la frise refaite par l'éditeur du site de dev (src/scripts/edition/chronologie.mjs : refaireLaFrise, ecrireLesCouleurs,
// poserCouleur), exécutées dans un faux navigateur (juste ce qu'elles emploient : un arbre d'éléments, des sélecteurs simples, l'adresse) : la feuille
// `<style data-couleurs-chronologie>` réécrite d'après la base vivante, les classes de la palette posées sur chaque ligne, sa barre (le précédent) et
// son morceau de barre (le suivant), jamais un style (skill ui-couleurs, lot 7 ; skill zone-chronologie).
//   node --test test/chronologie-editeur.test.mjs
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ordonner } from '../src/lib/chronologie.mjs';
import { couleursDesEvenements } from '../src/lib/chronologie-couleurs.mjs';
import { classeDEvenement, cssDesEvenements } from '../src/lib/palette-css.mjs';
import { ecrireLesCouleurs, poserCouleur, refaireLaFrise } from '../src/scripts/edition/chronologie.mjs';

// --- Le faux navigateur -------------------------------------------------------------------------------------------------------------------------
/** Un sélecteur simple : `tag.classe[attr][attr="v"]`, éventuellement plusieurs, séparés par un espace (descendant). */
function correspond(el, selecteur) {
  const parties = selecteur.trim().split(/\s+/);
  const simple = (e, s) => {
    const tag = s.match(/^[a-z]+/)?.[0];
    if (tag && e.tagName !== tag.toUpperCase()) return false;
    for (const [, c] of s.matchAll(/\.([\w-]+)/g)) if (!e.classList.contains(c)) return false;
    for (const [, nom, , valeur] of s.matchAll(/\[([\w-]+)(=(?:"([^"]*)"))?\]/g)) {
      if (!e.hasAttribute(nom) || (valeur !== undefined && e.getAttribute(nom) !== valeur)) return false;
    }
    return true;
  };
  if (!simple(el, parties.at(-1))) return false;
  if (parties.length === 1) return true;
  for (let p = el.parentElement; p; p = p.parentElement) if (correspond(p, parties.slice(0, -1).join(' '))) return true;
  return false;
}

class Element {
  constructor(tag, attributs = {}, enfants = []) {
    this.tagName = tag.toUpperCase();
    this.attributs = new Map(Object.entries(attributs).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, String(v)]));
    this.enfants = [];
    this.parentElement = null;
    this.texte = '';
    const el = this;
    const classes = () => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    this.classList = {
      contains: (c) => classes().includes(c),
      add: (...cs) => el.setAttribute('class', [...new Set([...classes(), ...cs])].join(' ')),
      remove: (...cs) => el.setAttribute('class', classes().filter((c) => !cs.includes(c)).join(' ')),
      [Symbol.iterator]: () => classes()[Symbol.iterator](),
    };
    this.dataset = new Proxy({}, {
      get: (_, k) => el.getAttribute(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`) ?? undefined,
      set: (_, k, v) => { el.setAttribute(`data-${String(k).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, v); return true; },
    });
    for (const e of enfants) this.append(e);
  }
  getAttribute(n) { return this.attributs.has(n) ? this.attributs.get(n) : null; }
  hasAttribute(n) { return this.attributs.has(n); }
  setAttribute(n, v) { this.attributs.set(n, String(v)); }
  removeAttribute(n) { this.attributs.delete(n); }
  get id() { return this.getAttribute('id') ?? ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(v) { this.setAttribute('class', v); }
  get textContent() { return this.texte + this.enfants.map((e) => e.textContent).join(''); }
  set textContent(v) { this.enfants = []; this.texte = String(v); }
  /** Le HTML que l'éditeur écrit (balises et attributs entre guillemets doubles) : assez pour une ligne de la frise. */
  set innerHTML(html) {
    this.enfants = [];
    const pile = [this];
    for (const [, fin, tag, attributs] of html.matchAll(/<(\/?)([a-z]+)([^>]*)>/g)) {
      if (fin) { pile.pop(); continue; }
      const e = new Element(tag, Object.fromEntries([...attributs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])));
      pile.at(-1).append(e);
      pile.push(e);
    }
  }
  append(...es) {
    for (const e of es) {
      e.remove();
      e.parentElement = this;
      this.enfants.push(e);
    }
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.enfants = this.parentElement.enfants.filter((x) => x !== this);
    this.parentElement = null;
  }
  descendants() { return this.enfants.flatMap((e) => [e, ...e.descendants()]); }
  querySelectorAll(s) { return this.descendants().filter((e) => correspond(e, s)); }
  querySelector(s) { return this.querySelectorAll(s)[0] ?? null; }
}
const h = (tag, attributs, ...enfants) => new Element(tag, attributs, enfants);

const ev = (id, rang, epoque, annee = null) => ({ id, rang, titre: id.toUpperCase(), epoque, annee, annee_fin: null, portee: null, lieu: null, categories: [] });
/** Quatre événements construits : a (au début), b (an 10), c (an 20), d (date inconnue). */
const CONSTRUITS = ordonner([ev('a', 1, 'debut'), ev('b', 2, 'datee', 10), ev('c', 3, 'datee', 20), ev('d', 4, 'inconnue')]);
const ED = { base: '/' };

/** Une ligne de la frise telle que Frise.astro la construit. */
const ligne = (e, i, liste) => h('li', { class: `frise__evenement frise__evenement--${e.epoque} ${classeDEvenement(e.id)}`, id: `evenement-${e.id}`, 'data-categories': '', 'data-etiquette': e.titre },
  h('a', { class: 'frise__lien', href: `/chronologie/${e.id}/` },
    h('span', { class: 'frise__date' }, h('span', { 'data-ed-lecture': '' })),
    h('span', { class: ['frise__barre', liste[i - 1] && classeDEvenement(liste[i - 1].id)].filter(Boolean).join(' ') },
      h('span', { class: ['frise__morceau', liste[i + 1] && classeDEvenement(liste[i + 1].id)].filter(Boolean).join(' ') }), h('span', { class: 'frise__repere' })),
    h('span', { class: 'frise__titre' }, h('span', { 'data-ed-lecture': '' }))));

/** La page construite de l'événement `affiche` : la feuille des couleurs, `.chrono` à sa classe, la frise des événements construits. */
function page(affiche) {
  const racine = h('html', {}, h('body', {},
    h('style', { 'data-couleurs-chronologie': '' }),
    h('div', { class: `chrono chrono--evenement ${classeDEvenement(affiche)}`, 'data-chrono': '' },
      h('nav', { class: 'frise', 'data-frise': '' }, h('ol', { class: 'frise__liste' }, ...CONSTRUITS.map(ligne))),
      h('article', { class: 'chrono-page', 'data-chrono-evenement': affiche }))));
  racine.querySelector('style').textContent = cssDesEvenements(couleursDesEvenements(CONSTRUITS));
  globalThis.document = { querySelector: (s) => racine.querySelector(s), querySelectorAll: (s) => racine.querySelectorAll(s), createElement: (tag) => new Element(tag) };
  globalThis.location = { search: '', href: `https://site.test/chronologie/${affiche}/` };
  return racine;
}
afterEach(() => {
  delete globalThis.document;
  delete globalThis.location;
});

const feuille = (racine) => racine.querySelector('style[data-couleurs-chronologie]').textContent;
const couleursDe = (el) => [...el.classList].filter((c) => c.startsWith('couleur-'));
/** Pour chaque ligne, dans l'ordre : [id, classes de la ligne, de sa barre, de son morceau] (aucun style nulle part). */
const lignes = (racine) => racine.querySelectorAll('.frise__evenement').map((li) => {
  for (const el of [li, ...li.descendants()]) assert.equal(el.getAttribute('style'), null, `${li.id} : aucun style`);
  return [li.id.replace('evenement-', ''), couleursDe(li), couleursDe(li.querySelector('.frise__barre')), couleursDe(li.querySelector('.frise__morceau'))];
});
const c = (id) => classeDEvenement(id);

test('poserCouleur : la classe d’un événement à la place de l’ancienne, les autres classes gardées ; aucune : plus de couleur', () => {
  const el = h('span', { class: 'frise__barre couleur-evenement-a autre' });
  poserCouleur(el, c('b'));
  assert.deepEqual([...el.classList], ['frise__barre', 'autre', c('b')]);
  poserCouleur(el, c('b'));
  assert.deepEqual([...el.classList], ['frise__barre', 'autre', c('b')], 'déjà posée : inchangée');
  poserCouleur(el, null);
  assert.deepEqual([...el.classList], ['frise__barre', 'autre']);
  assert.doesNotThrow(() => poserCouleur(null, c('a')));
});

test('un événement créé sur le site de dev : la feuille réécrite d’après la liste vivante, la nouvelle ligne et ses voisines à leur classe, rien aux bords', () => {
  const racine = page('b');
  const vivante = ordonner([...CONSTRUITS, ev('x', 5, 'datee', 15)]);
  assert.deepEqual(vivante.map((e) => e.id), ['a', 'b', 'x', 'c', 'd']);
  refaireLaFrise(ED, vivante);
  // toutes les teintes se décalent : la feuille est celle de la liste vivante (b existe toujours : rien n'est gardé de l'ancienne)
  assert.equal(feuille(racine), cssDesEvenements(couleursDesEvenements(vivante)));
  assert.notEqual(feuille(racine), cssDesEvenements(couleursDesEvenements(CONSTRUITS)), 'les teintes ont changé');
  assert.deepEqual(lignes(racine), [
    ['a', [c('a')], [], [c('b')]],
    ['b', [c('b')], [c('a')], [c('x')]],
    ['x', [c('x')], [c('b')], [c('c')]],
    ['c', [c('c')], [c('x')], [c('d')]],
    ['d', [c('d')], [c('c')], []],
  ]);
  // la ligne créée : la structure du build (le morceau dans la barre, avant le repère), menée à ?evenement=
  const x = racine.querySelectorAll('.frise__evenement').find((li) => li.id === 'evenement-x');
  assert.deepEqual(x.querySelector('.frise__barre').enfants.map((e) => e.className.split(' ')[0]), ['frise__morceau', 'frise__repere']);
  assert.equal(x.querySelector('.frise__lien').getAttribute('href'), '/chronologie/?evenement=x');
  // la page affichée suit la teinte recalculée de sa ligne (la classe ne change pas, sa règle si)
  assert.ok(racine.querySelector('[data-chrono]').classList.contains(c('b')));
});

test('l’événement affiché supprimé sur le site de dev : sa dernière règle gardée dans la feuille ; une réécriture suivante donne la même feuille', () => {
  const racine = page('b');
  const avant = feuille(racine);
  const regleDeB = avant.match(new RegExp(`\\.${c('b')}\\{[^}]*\\}`))[0];
  const vivante = CONSTRUITS.filter((e) => e.id !== 'b');
  refaireLaFrise(ED, vivante);
  assert.equal(feuille(racine), cssDesEvenements(couleursDesEvenements(vivante)) + regleDeB, 'la règle de la page affichée, après celles de la base vivante');
  assert.deepEqual(lignes(racine), [
    ['a', [c('a')], [], [c('c')]],
    ['c', [c('c')], [c('a')], [c('d')]],
    ['d', [c('d')], [c('c')], []],
  ]);
  assert.ok(racine.querySelector('[data-chrono]').classList.contains(c('b')), 'la page garde sa classe, donc sa teinte');
  // la surcouche suivante (la même base) : la même feuille, la règle gardée une fois
  const une = feuille(racine);
  ecrireLesCouleurs(vivante);
  assert.equal(feuille(racine), une);
  refaireLaFrise(ED, vivante);
  assert.equal(feuille(racine), une);
  assert.equal(feuille(racine).split(`.${c('b')}{`).length, 2, 'une seule règle de b');
});
