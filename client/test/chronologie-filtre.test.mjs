// Filtre de la frise par catégorie (demandes du propriétaire : « filtrer la chronologie de façon à ne voir qu'un type d'évènement », « liste déroulante
// sur un champ catégorie ») et
// chevrons qui le suivent : les scripts en ligne de components/chronologie/Frise.astro et Chronologie.astro, exécutés dans un faux navigateur (juste ce
// qu'ils emploient : un arbre d'éléments, des sélecteurs simples, l'adresse, l'historique, des évènements).
//   node --test test/chronologie-filtre.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = (fichier) => readFileSync(fileURLToPath(new URL(`../src/components/chronologie/${fichier}`, import.meta.url)), 'utf8');
const scriptDeLaFrise = source('Frise.astro').match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
const scriptDesChevrons = [...source('Chronologie.astro').matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((c) => c.includes('chronologie:frise-filtree'));

// --- Le faux navigateur -------------------------------------------------------------------------------------------------------------------------
/** Un sélecteur simple : `tag#id.classe[attr][attr="v"]`, éventuellement plusieurs, séparés par un espace (descendant). */
function correspond(el, selecteur) {
  const parties = selecteur.trim().split(/\s+/);
  const simple = (e, s) => {
    const tag = s.match(/^[a-z]+/)?.[0];
    if (tag && e.tagName !== tag.toUpperCase()) return false;
    for (const [, id] of s.matchAll(/#([\w-]+)/g)) if (e.getAttribute('id') !== id) return false;
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

function navigateur(adresse, construire) {
  const ecouteurs = new Map();
  const historique = [];
  class Element {
    constructor(tag, attributs = {}, enfants = []) {
      this.tagName = tag.toUpperCase();
      this.attributs = new Map(Object.entries(attributs).map(([k, v]) => [k, String(v)]));
      this.enfants = [];
      this.parentElement = null;
      this.hidden = false;
      this.textContent = '';
      this.vars = new Map();
      for (const [k, v] of (this.getAttribute('style') ?? '').split(';').map((d) => d.split(':').map((x) => x.trim())).filter(([k]) => k)) this.vars.set(k, v);
      this.style = { getPropertyValue: (p) => this.vars.get(p) ?? '', setProperty: (p, v) => this.vars.set(p, v) };
      const classes = () => new Set((this.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
      const ecrire = (s) => this.setAttribute('class', [...s].join(' '));
      this.classList = {
        contains: (c) => classes().has(c),
        add: (...cs) => ecrire(new Set([...classes(), ...cs])),
        remove: (...cs) => ecrire(new Set([...classes()].filter((c) => !cs.includes(c)))),
        toggle: (c, oui) => ((oui ?? !classes().has(c)) ? ecrire(new Set([...classes(), c])) : ecrire(new Set([...classes()].filter((x) => x !== c)))),
      };
      for (const e of enfants) this.append(e);
    }
    getAttribute(n) { return this.attributs.has(n) ? this.attributs.get(n) : null; }
    hasAttribute(n) { return this.attributs.has(n); }
    setAttribute(n, v) { this.attributs.set(n, String(v)); }
    removeAttribute(n) { this.attributs.delete(n); }
    get href() { return this.hasAttribute('href') ? new URL(this.getAttribute('href'), adresse.href).href : ''; }
    set href(v) { this.setAttribute('href', v); }
    set rel(v) { this.setAttribute('rel', v); }
    set title(v) { this.setAttribute('title', v); }
    get value() { return this.valeur ?? ''; }
    set value(v) { this.valeur = v; }
    get options() { return this.enfants.filter((e) => e.tagName === 'OPTION').map((o) => ({ value: o.getAttribute('value') })); }
    append(e) { e.parentElement = this; this.enfants.push(e); }
    descendants() { return this.enfants.flatMap((e) => [e, ...e.descendants()]); }
    querySelectorAll(s) { return this.descendants().filter((e) => correspond(e, s)); }
    querySelector(s) { return this.querySelectorAll(s)[0] ?? null; }
    closest(s) { for (let e = this; e; e = e.parentElement) if (correspond(e, s)) return e; return null; }
    getBoundingClientRect() { return { top: 0, bottom: 800, height: 800 }; }
    addEventListener(type, f) { (this.ecouteurs ??= new Map()).set(type, [...(this.ecouteurs.get(type) ?? []), f]); }
    declencher(type) { for (const f of this.ecouteurs?.get(type) ?? []) f({ type }); }
  }
  const h = (tag, attributs, ...enfants) => new Element(tag, attributs, enfants);
  const racine = h('html', {}, h('body', {}, construire(h)));
  const document = {
    documentElement: racine,
    querySelector: (s) => racine.querySelector(s),
    querySelectorAll: (s) => racine.querySelectorAll(s),
    addEventListener: (type, f) => ecouteurs.set(type, [...(ecouteurs.get(type) ?? []), f]),
    dispatchEvent: (e) => { for (const f of ecouteurs.get(e.type) ?? []) f(e); },
  };
  const location = adresse;
  const contexte = {
    document, location, URL, URLSearchParams,
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o?.detail; } },
    history: { state: null, replaceState: (_s, _t, url) => { historique.push(url); location.href = url; } },
    getComputedStyle: () => ({ overflowY: 'visible' }), // petit écran : pas de défilement propre à la frise à rétablir
    sessionStorage: { getItem: () => null, setItem() {} },
    addEventListener() {},
    window: { scrollY: 0, innerHeight: 800 },
    innerHeight: 800,
  };
  vm.createContext(contexte);
  return { document, racine, historique, executer: (code) => vm.runInContext(code, contexte) };
}

// Cinq événements et leurs catégories : a (guerre), b (guerre, paix), c (aucune), d (paix), e (guerre).
const EVENEMENTS = [
  { id: 'a', categories: 'guerre', c: '#111111' }, { id: 'b', categories: 'guerre paix', c: '#222222' }, { id: 'c', categories: '', c: '#333333' },
  { id: 'd', categories: 'paix', c: '#444444' }, { id: 'e', categories: 'guerre', c: '#555555' },
];
function page(courant, adresse) {
  const nav = navigateur(new URL(adresse), (h) => h('div', { class: 'chrono', 'data-chrono': '' },
    h('nav', { class: 'frise', 'data-frise': '' },
      h('small', { 'data-frise-compte-tiroir': '' }),
      h('div', { class: 'frise__tete' }, h('select', { 'data-frise-choix': '' }, ...['', 'guerre', 'paix', 'sans-categorie'].map((v) => h('option', { value: v })))),
      h('p', { 'data-frise-compte': '' }),
      h('ol', { class: 'frise__liste' }, ...EVENEMENTS.map((e) => h('li', { class: 'frise__evenement', id: `evenement-${e.id}`, style: `--c: ${e.c}; --c-avant: ${e.c}; --c-apres: ${e.c}`, 'data-categories': e.categories, 'data-etiquette': `An ${e.id} : ${e.id.toUpperCase()}` },
        h('a', { class: 'frise__lien', href: `/chronologie/${e.id}/`, ...(e.id === courant ? { 'aria-current': 'page' } : {}) },
          h('span', { class: 'frise__titre' }, h('span', { 'data-ed-lecture': '' })))))),
    ),
    h('a', { class: 'chrono-commencer', 'data-chrono-commencer': '', href: '/chronologie/a/' }, h('span', { 'data-chrono-commencer-titre': '' })),
    h('nav', { class: 'chrono-chevrons' },
      h('a', { class: 'chrono-chevron', 'data-chrono-chevron': 'precedent', href: '/x/', 'data-chrono-precedent': '' }, h('span', { 'data-chrono-bord': '' })),
      h('a', { class: 'chrono-chevron', 'data-chrono-chevron': 'suivant', href: '/x/', 'data-chrono-suivant': '' }, h('span', { 'data-chrono-bord': '' })),
    ),
  ));
  nav.executer(scriptDeLaFrise);
  nav.executer(scriptDesChevrons);
  return nav;
}
const lignes = (nav) => nav.document.querySelectorAll('.frise__evenement');
const visibles = (nav) => lignes(nav).filter((l) => !l.hidden).map((l) => l.getAttribute('id').replace('evenement-', ''));
const chevron = (nav, sens) => {
  const a = nav.document.querySelector(`[data-chrono-chevron="${sens}"]`);
  return a.hasAttribute('href') ? { href: new URL(a.getAttribute('href')).pathname + new URL(a.getAttribute('href')).search, titre: a.getAttribute('title'), clavier: a.hasAttribute(`data-chrono-${sens}`) } : { grise: a.getAttribute('aria-disabled'), clavier: a.hasAttribute(`data-chrono-${sens}`) };
};

test('sans filtre : tout est affiché, les chevrons vont aux voisins de la frise', () => {
  const nav = page('c', 'https://site.test/chronologie/c/');
  assert.deepEqual(visibles(nav), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(chevron(nav, 'precedent'), { href: '/chronologie/b/', titre: 'An b : B', clavier: true });
  assert.deepEqual(chevron(nav, 'suivant'), { href: '/chronologie/d/', titre: 'An d : D', clavier: true });
  assert.ok(lignes(nav)[0].classList.contains('est-premier') && lignes(nav)[4].classList.contains('est-dernier'));
});

test('?filtre=guerre : seules les lignes de la catégorie restent (et l’événement affiché, « hors filtre ») ; dégradé, bouts de barre, liens et chevrons suivent', () => {
  const nav = page('d', 'https://site.test/chronologie/d/?filtre=guerre');
  assert.equal(nav.document.querySelector('[data-frise-choix]').value, 'guerre');
  assert.deepEqual(visibles(nav), ['a', 'b', 'd', 'e'], 'd reste : c’est la page affichée');
  const d = nav.document.querySelector('#evenement-d');
  assert.ok(d.classList.contains('est-hors-filtre'));
  assert.ok(!nav.document.querySelector('#evenement-b').classList.contains('est-hors-filtre'));
  // le dégradé entre lignes visibles : b → d (c est caché)
  assert.equal(nav.document.querySelector('#evenement-b').style.getPropertyValue('--c-apres'), '#444444');
  assert.equal(d.style.getPropertyValue('--c-avant'), '#222222');
  assert.ok(nav.document.querySelector('#evenement-a').classList.contains('est-premier'));
  assert.ok(nav.document.querySelector('#evenement-e').classList.contains('est-dernier'));
  // les liens de la frise gardent le filtre ; les chevrons vont aux voisins visibles
  assert.equal(new URL(nav.document.querySelector('#evenement-a .frise__lien').getAttribute('href')).search, '?filtre=guerre');
  assert.deepEqual(chevron(nav, 'precedent'), { href: '/chronologie/b/?filtre=guerre', titre: 'An b : B', clavier: true });
  assert.deepEqual(chevron(nav, 'suivant'), { href: '/chronologie/e/?filtre=guerre', titre: 'An e : E', clavier: true });
  assert.equal(nav.document.querySelector('[data-frise-compte]').textContent, '3 événements dans cette catégorie');
});

test('au bord de la catégorie choisie, le chevron est grisé (ni adresse ni raccourci clavier) ; « Sans catégorie (à trier) » : les événements sans catégorie', () => {
  const nav = page('a', 'https://site.test/chronologie/a/?filtre=guerre');
  assert.deepEqual(chevron(nav, 'precedent'), { grise: 'true', clavier: false });
  assert.deepEqual(chevron(nav, 'suivant'), { href: '/chronologie/b/?filtre=guerre', titre: 'An b : B', clavier: true });
  const sans = page('c', 'https://site.test/chronologie/c/?filtre=sans-categorie');
  assert.deepEqual(visibles(sans), ['c']);
  assert.deepEqual([chevron(sans, 'precedent').grise, chevron(sans, 'suivant').grise], ['true', 'true']);
  assert.equal(sans.document.querySelector('[data-frise-compte-tiroir]').textContent, '1 événement sans catégorie');
});

test('un filtre inconnu (catégorie supprimée depuis, ou « sans catégorie » en production, où le choix ne le propose pas) : tout est affiché', () => {
  const nav = page('c', 'https://site.test/chronologie/c/?filtre=disparu');
  assert.equal(nav.document.querySelector('[data-frise-choix]').value, '');
  assert.deepEqual(visibles(nav), ['a', 'b', 'c', 'd', 'e']);
});

test('changer le choix réécrit l’adresse (sans recharger), refiltre et réécrit les chevrons ; une frise complétée par le site de dev est refiltrée', () => {
  const nav = page('b', 'https://site.test/chronologie/b/');
  const choix = nav.document.querySelector('[data-frise-choix]');
  choix.value = 'paix';
  choix.declencher('change');
  assert.equal(new URL(nav.historique.at(-1)).search, '?filtre=paix');
  assert.deepEqual(visibles(nav), ['b', 'd']);
  assert.deepEqual(chevron(nav, 'suivant'), { href: '/chronologie/d/?filtre=paix', titre: 'An d : D', clavier: true });
  assert.deepEqual(chevron(nav, 'precedent'), { grise: 'true', clavier: false });
  // le site de dev retire d de la frise (supprimé) : la frise est refiltrée, le chevron suit
  const d = nav.document.querySelector('#evenement-d');
  d.parentElement.enfants.splice(d.parentElement.enfants.indexOf(d), 1);
  nav.document.dispatchEvent({ type: 'chronologie:frise-changee' });
  assert.deepEqual(visibles(nav), ['b']);
  assert.deepEqual(chevron(nav, 'suivant'), { grise: 'true', clavier: false });
});

test('la frise refaite par le site de dev sans la catégorie choisie (supprimée) : son choix revenu à « Toutes », la frise et l’adresse suivent', () => {
  const nav = page('b', 'https://site.test/chronologie/b/?filtre=paix');
  assert.deepEqual(visibles(nav), ['b', 'd']);
  // l'extension refait les options et remet le choix à « Toutes » (src/scripts/edition/chronologie.mjs#refaireLaFrise)
  nav.document.querySelector('[data-frise-choix]').value = '';
  nav.document.dispatchEvent({ type: 'chronologie:frise-changee' });
  assert.deepEqual(visibles(nav), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(new URL(nav.historique.at(-1)).search, '');
  assert.deepEqual(chevron(nav, 'suivant'), { href: '/chronologie/c/', titre: 'An c : C', clavier: true });
});

test('/chronologie/ (aucun événement affiché) : « Suivant » et « Commencer » mènent au premier événement visible de la catégorie', () => {
  const nav = page(null, 'https://site.test/chronologie/?filtre=paix');
  assert.deepEqual(chevron(nav, 'precedent'), { grise: 'true', clavier: false });
  assert.deepEqual(chevron(nav, 'suivant'), { href: '/chronologie/b/?filtre=paix', titre: 'An b : B', clavier: true });
  assert.equal(new URL(nav.document.querySelector('[data-chrono-commencer]').getAttribute('href')).pathname, '/chronologie/b/');
});
