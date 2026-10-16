// Le script de /recherche/ (src/scripts/recherche.mjs), exécuté dans un faux navigateur : un mot-clé cliqué affiche ses pages (jamais un événement de la
// chronologie, qui n'a pas de mot-clé mais des catégories), l'adresse suit (?mot-cle=<id>, pushState) et le retour arrière ramène la liste ; ?mot-cle= est
// lu au chargement ; un id inconnu (« sans-categorie » compris) « n'existe plus » ; la liste se filtre par l'écriture des mots-clés ; un événement se
// trouve par une catégorie ; taper depuis la vue d'un mot-clé ouverte par un clic revient en arrière (pas deux entrées identiques dans l'historique) ;
// la liste redessinée par l'éditeur (évènement « recherche:mots-cles ») est relue. Depuis la migration 0055, la liste est le glossaire : tous les
// mots-clés, même sans page, et la vue d'un mot-clé montre sa définition.
//   node --test test/recherche-script.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendre, cliquer, el, fauxDocument } from './aide-faux-dom.mjs';

// l'index (lib/recherche-index.ts) : un événement n'a aucun mot-clé, les libellés de ses catégories sont ses `tags`
const index = [
  { title: 'Elfe', type: 'Race', path: 'races/elfe/', summary: 'Un peuple', aliases: [], tags: ['peuple'], text: 'forêt', motsCles: ['peuple'] },
  { title: 'Feu', type: 'Magie', path: 'magies/feu/', summary: '', aliases: [], tags: ['magie élémentaire'], text: 'flammes', motsCles: ['magie-elementaire'] },
  { title: 'Grande croisade', type: 'Événement', path: 'chronologie/grande-croisade/', summary: 'An 12', aliases: [], tags: ['Peuple', 'Guerres saintes'], text: '', motsCles: [] },
  { title: 'Fondation', type: 'Événement', path: 'chronologie/fondation/', summary: 'An 1', aliases: [], tags: [], text: '', motsCles: [] },
];
const motCle = (id, cle, n, libelle, extra = {}) => el('li', { 'data-id': id, 'data-cle': cle, 'data-n': String(n), 'data-libelle': libelle, ...extra }, el('a', { href: `/recherche/?mot-cle=${id}` }));

let numero = 0;
/**
 * Charge la page /recherche/ à l'adresse `adresse` et y lance le script ; rend les éléments utiles et l'historique (`pile()` : les adresses jusqu'à
 * l'entrée actuelle ; `retour()` : le bouton Précédent).
 */
async function charger(adresse) {
  let url = new URL(adresse, 'http://site/');
  // l'historique de session : des entrées { href, state }, la position actuelle ; back() est asynchrone (popstate au tour suivant), comme dans un navigateur
  let entrees = [{ href: url.href, state: null }];
  let position = 0;
  const pile = () => entrees.slice(0, position + 1).map((e) => e.href);
  const window = new EventTarget();
  const liste = el('ul', { id: 'liste-mots-cles' },
    motCle('peuple', 'peuple', 2, 'Peuple'),
    motCle('magie-elementaire', 'magie-elementaire', 1, 'magie élémentaire'),
    motCle('demo', 'demo', 0, 'démo', { 'data-definition': 'Un mot-clé du glossaire qu’aucune page ne porte encore.' }));
  const vue = el('section', { id: 'vue-du-mot-cle', hidden: '' },
    el('a', { id: 'tous-les-mots-cles', href: '/recherche/' }), el('h2', { id: 'titre-mot-cle' }), el('p', { id: 'vue-du-mot-cle-definition', hidden: '' }),
    el('p', { id: 'vue-du-mot-cle-compte' }),
    el('ul', { id: 'vue-du-mot-cle-pages', hidden: '' }));
  const document = fauxDocument(el('div', { 'data-recherche': '', 'data-lien-mot-cle': '/recherche/?mot-cle=' },
    el('form', { id: 'search-form', 'data-index-url': '/search-index.json', 'data-base': '/', 'data-suffix': '' }, el('input', { id: 'q' })),
    el('p', { id: 'status' }),
    el('section', { id: 'mots-cles' }, el('small', { id: 'nombre-mots-cles' }), liste, el('p', { id: 'aucun-mot-cle', hidden: '' })),
    vue,
    el('section', { id: 'pages-trouvees', hidden: '' }, el('ul', { id: 'results' }))));
  document.title = 'Recherche — Maverick Center';
  const chargements = { n: 0 };
  Object.assign(globalThis, {
    window,
    document,
    location: { get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: {
      get state() { return entrees[position].state; },
      pushState(state, _, a) {
        url = new URL(a, url);
        entrees = [...entrees.slice(0, position + 1), { href: url.href, state: structuredClone(state) }];
        position += 1;
      },
      replaceState(state, _, a) {
        url = new URL(a, url);
        entrees[position] = { href: url.href, state: structuredClone(state) };
      },
      back() {
        // tout change au tour suivant (position, état, adresse), puis popstate ; à la première entrée, le navigateur quitterait la page
        setTimeout(() => {
          if (position === 0) return;
          position -= 1;
          url = new URL(entrees[position].href);
          window.dispatchEvent(new Event('popstate'));
        }, 0);
      },
    },
    fetch: async () => {
      chargements.n += 1;
      return { ok: true, json: async () => index };
    },
  });
  const retour = () => globalThis.history.back();
  await import(`../src/scripts/recherche.mjs?page=${(numero += 1)}`);
  await attendre();
  const $ = (id) => document.getElementById(id);
  return { $, liste, vue, adresse: () => url.pathname + url.search, pile, retour, chargements, document };
}
const titres = (ul) => ul.children.map((li) => li.children[0].textContent);

test('sans mot-clé dans l’adresse : le glossaire, tous les mots-clés (même sans page) ; filtrer par l’écriture ; un événement trouvé par sa catégorie', async () => {
  const p = await charger('/recherche/');
  assert.equal(p.vue.hidden, true);
  assert.equal(p.$('mots-cles').hidden, false);
  assert.deepEqual(p.liste.children.filter((li) => !li.hidden).map((li) => li.dataset.id), ['peuple', 'magie-elementaire', 'demo']);
  assert.equal(p.$('nombre-mots-cles').textContent, '(3)');
  assert.equal(p.chargements.n, 0, 'l’index n’est chargé qu’à la demande');
  const q = p.$('q');
  q.value = 'élémentaire';
  q.dispatchEvent(new Event('input'));
  await attendre();
  assert.deepEqual(p.liste.children.filter((li) => !li.hidden).map((li) => li.dataset.id), ['magie-elementaire']);
  assert.match(p.$('status').textContent, /^1 résultat, 1 mot-clé$/);
  assert.deepEqual(p.$('results').children.map((li) => li.children[0].textContent), ['Feu']);
  // un événement se trouve par l'une de ses catégories (ses `tags`), sans qu'elle soit un mot-clé de la liste
  q.value = 'guerres saintes';
  q.dispatchEvent(new Event('input'));
  await attendre();
  assert.deepEqual(p.$('results').children.map((li) => li.children[0].textContent), ['Grande croisade']);
  assert.equal(p.$('results').children[0].children[0].href, '/chronologie/grande-croisade/');
  assert.match(p.$('status').textContent, /^1 résultat, 0 mot-clé$/);
  q.value = 'demo';
  q.dispatchEvent(new Event('input'));
  await attendre();
  assert.deepEqual(p.liste.children.filter((li) => !li.hidden).map((li) => li.dataset.id), ['demo'], 'un mot-clé sans page est dans le glossaire');
  q.value = 'aucun mot de ce genre';
  q.dispatchEvent(new Event('input'));
  await attendre();
  assert.equal(p.$('aucun-mot-cle').hidden, false);
});

test('un clic sur un mot-clé : ses pages (aucun événement), l’adresse suit ; le retour arrière ramène la liste', async () => {
  const p = await charger('/recherche/');
  const lien = p.liste.children[0].children[0];
  const e = cliquer(lien, p.liste);
  assert.equal(e.defaultPrevented, true);
  await attendre();
  assert.equal(p.adresse(), '/recherche/?mot-cle=peuple');
  assert.equal(p.vue.hidden, false);
  assert.equal(p.$('mots-cles').hidden, true);
  assert.equal(p.$('titre-mot-cle').textContent, 'Mot-clé « Peuple »');
  assert.deepEqual(titres(p.$('vue-du-mot-cle-pages')), ['Elfe'], 'pas « Grande croisade » : sa catégorie « Peuple » n’est pas le mot-clé');
  assert.equal(p.$('vue-du-mot-cle-pages').hidden, false);
  assert.equal(p.$('vue-du-mot-cle-compte').textContent, '1 page.');
  assert.equal(p.$('vue-du-mot-cle-pages').children[0].children[0].href, '/races/elfe/');
  assert.equal(p.$('vue-du-mot-cle-definition').hidden, true, 'pas encore décrit : pas de définition');
  assert.equal(p.document.title, 'Mot-clé « Peuple » — Recherche — Maverick Center');
  p.retour();
  await attendre();
  assert.equal(p.adresse(), '/recherche/');
  assert.equal(p.vue.hidden, true);
  assert.equal(p.$('mots-cles').hidden, false);
  assert.equal(p.document.title, 'Recherche — Maverick Center');
  // « Tous les mots-clés » : la liste, une entrée de plus dans l'historique
  cliquer(p.liste.children[1].children[0], p.liste);
  await attendre();
  cliquer(p.$('tous-les-mots-cles'));
  await attendre();
  assert.deepEqual(p.pile().map((a) => new URL(a).search), ['', '?mot-cle=magie-elementaire', '']);
  assert.equal(p.vue.hidden, true);
});

test('?mot-cle= lu au chargement ; un id inconnu « n’existe plus », « sans-categorie » (filtre de la frise, plus de la recherche) compris', async () => {
  const deux = await charger('/recherche/?mot-cle=magie-elementaire');
  assert.equal(deux.vue.hidden, false);
  assert.equal(deux.$('titre-mot-cle').textContent, 'Mot-clé « magie élémentaire »');
  assert.deepEqual(titres(deux.$('vue-du-mot-cle-pages')), ['Feu']);
  const inconnu = await charger('/recherche/?mot-cle=fusionne-depuis');
  assert.equal(inconnu.$('titre-mot-cle').textContent, 'Ce mot-clé n’existe plus');
  assert.equal(inconnu.$('vue-du-mot-cle-pages').hidden, true);
  const sans = await charger('/recherche/?mot-cle=sans-categorie');
  assert.equal(sans.$('titre-mot-cle').textContent, 'Ce mot-clé n’existe plus');
  assert.equal(sans.$('vue-du-mot-cle-pages').hidden, true);
  const vide = await charger('/recherche/?mot-cle=demo');
  assert.equal(vide.$('titre-mot-cle').textContent, 'Mot-clé « démo »', 'sans page, il existe');
  assert.equal(vide.$('vue-du-mot-cle-definition').hidden, false);
  assert.equal(vide.$('vue-du-mot-cle-definition').textContent, 'Un mot-clé du glossaire qu’aucune page ne porte encore.', 'sa définition sous son titre');
  assert.equal(vide.$('vue-du-mot-cle-compte').textContent, 'Aucune page ne porte ni ne cite ce mot-clé.');
  assert.equal(vide.$('vue-du-mot-cle-pages').hidden, true);
  // taper reprend la recherche : la liste revient, sans nouvelle entrée dans l'historique
  const q = vide.$('q');
  q.value = 'peu';
  q.dispatchEvent(new Event('input'));
  await attendre();
  assert.equal(vide.adresse(), '/recherche/');
  assert.equal(vide.pile().length, 1, 'ouverte par son adresse : la vue est remplacée');
  assert.equal(vide.vue.hidden, true);
});

test('clic sur un mot-clé puis saisie (ou recherche, ou liste de gestion) : retour arrière, jamais deux entrées identiques de la liste', async () => {
  const p = await charger('/recherche/');
  cliquer(p.liste.children[0].children[0], p.liste);
  await attendre();
  assert.deepEqual(p.pile().map((a) => new URL(a).search), ['', '?mot-cle=peuple']);
  const q = p.$('q');
  q.value = 'for';
  q.dispatchEvent(new Event('input'));
  assert.equal(p.vue.hidden, true, 'la liste revient tout de suite');
  q.value = 'forê';
  q.dispatchEvent(new Event('input')); // une seconde frappe avant le popstate : pas un second retour arrière
  await attendre();
  await attendre();
  assert.deepEqual(p.pile().map((a) => new URL(a).search), [''], 'l’entrée du clic retirée, pas doublée');
  assert.equal(p.adresse(), '/recherche/');
  assert.equal(p.vue.hidden, true);
  assert.equal(p.$('mots-cles').hidden, false);
  assert.equal(q.value, 'forê', 'la saisie en cours gardée');
  assert.deepEqual(p.$('results').children.map((li) => li.children[0].textContent), ['Elfe']);
  // plus haut dans l'historique : un seul retour arrière, même après deux frappes
  cliquer(p.liste.children[1].children[0], p.liste);
  await attendre();
  cliquer(p.$('tous-les-mots-cles'));
  await attendre();
  cliquer(p.liste.children[0].children[0], p.liste);
  await attendre();
  assert.equal(p.pile().length, 4);
  q.value = 'e';
  q.dispatchEvent(new Event('input'));
  q.value = 'el';
  q.dispatchEvent(new Event('input'));
  await attendre();
  await attendre();
  assert.deepEqual(p.pile().map((a) => new URL(a).search), ['', '?mot-cle=magie-elementaire', '']);
  // la soumission du formulaire, puis la liste de gestion de l'éditeur : de même
  cliquer(p.liste.children[0].children[0], p.liste);
  await attendre();
  p.$('search-form').dispatchEvent(new Event('submit', { cancelable: true }));
  await attendre();
  await attendre();
  assert.deepEqual(p.pile().map((a) => new URL(a).search), ['', '?mot-cle=magie-elementaire', ''], 'Chercher');
  cliquer(p.liste.children[1].children[0], p.liste);
  await attendre();
  p.liste.setAttribute('data-gestion', '');
  p.document.dispatchEvent(new CustomEvent('recherche:mots-cles', { detail: { gestion: true } }));
  await attendre();
  await attendre();
  assert.deepEqual(p.pile().map((a) => new URL(a).search), ['', '?mot-cle=magie-elementaire', ''], 'liste de gestion');
  assert.equal(p.vue.hidden, true);
});

test('la liste redessinée par l’éditeur (site de dev) est relue : nouveaux mots-clés, liste de gestion qui remplace la vue d’un mot-clé', async () => {
  const p = await charger('/recherche/?mot-cle=nouveau');
  assert.equal(p.$('titre-mot-cle').textContent, 'Ce mot-clé n’existe plus', 'pas encore dans la page construite');
  p.liste.append(motCle('nouveau', 'nouveau', 0, 'Nouveau'));
  p.document.dispatchEvent(new CustomEvent('recherche:mots-cles', { detail: { gestion: false } }));
  await attendre();
  assert.equal(p.$('titre-mot-cle').textContent, 'Mot-clé « Nouveau »', 'créé sur le site de dev : il existe');
  p.liste.setAttribute('data-gestion', '');
  p.document.dispatchEvent(new CustomEvent('recherche:mots-cles', { detail: { gestion: true } }));
  await attendre();
  assert.equal(p.adresse(), '/recherche/');
  assert.equal(p.pile().length, 1, 'ouverte par son adresse : remplacée');
  assert.equal(p.vue.hidden, true);
  assert.ok(p.liste.children.every((li) => !li.hidden), 'en mode modification, tous les mots-clés, même sans élément');
});
