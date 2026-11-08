// Le script de /recherche/ (src/scripts/recherche.mjs), exécuté dans un faux navigateur : un mot-clé cliqué affiche ses pages (jamais un événement de la
// chronologie, qui n'a pas de mot-clé mais des catégories), l'adresse suit (?mot-cle=<clé>, pushState ; décision R232 (3)) et le retour arrière ramène la
// liste ; ?mot-cle= est lu au chargement, une clé quittée (un ancien id texte, un renommage) mène au mot-clé (idDeLaCle) ; une clé inconnue
// (« sans-categorie » compris) « n'existe plus » ; la liste se filtre par le libellé et les synonymes des mots-clés (R233 (1)) ; un événement se
// trouve par une catégorie ; taper depuis la vue d'un mot-clé ouverte par un clic revient en arrière (pas deux entrées identiques dans l'historique).
// Depuis la migration 0056, la liste est le glossaire : tous les mots-clés, même sans page, et la vue d'un mot-clé montre sa définition. La liste est
// rendue au build et lue au chargement : plus aucun script ne la redessine (la gestion du vocabulaire est sur le Glossaire, évènement
// « glossaire:mots-cles »), et plus personne n'émet ni n'écoute « recherche:mots-cles ».
//   node --test test/recherche-script.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { htmlDeLaDefinition, htmlDeLaPastille } from '../src/lib/mots-cles-balises.mjs';
import { normalize } from '../src/lib/text.mjs';
import { attendre, cliquer, el, fauxDocument } from './aide-faux-dom.mjs';

// l'index (lib/recherche-index.ts) : les ids entiers des mots-clés d'une page ; un événement n'a aucun mot-clé, les libellés de ses catégories sont ses `tags`
const index = [
  { title: 'Elfe', type: 'Race', path: 'races/elfe/', summary: 'Un peuple', aliases: [], tags: ['peuple'], text: 'forêt', motsCles: [1] },
  { title: 'Feu', type: 'Magie', path: 'magies/feu/', summary: '', aliases: [], tags: ['magie élémentaire'], text: 'flammes', motsCles: [2] },
  { title: 'Grande croisade', type: 'Événement', path: 'chronologie/grande-croisade/', summary: 'An 12', aliases: [], tags: ['Peuple', 'Guerres saintes'], text: '', motsCles: [] },
  { title: 'Fondation', type: 'Événement', path: 'chronologie/fondation/', summary: 'An 1', aliases: [], tags: [], text: '', motsCles: [] },
];
// un mot-clé de la liste (pages/recherche.astro) : son id entier, sa clé (celle de l'adresse)
const motCle = (id, cle, n, libelle, extra = {}) => el('li', { 'data-id': String(id), 'data-cle': cle, 'data-n': String(n), 'data-libelle': libelle, ...extra }, el('a', { href: `/recherche/?mot-cle=${cle}` }));

let numero = 0;
/**
 * Charge la page /recherche/ à l'adresse `adresse` et y lance le script ; rend les éléments utiles et l'historique (`pile()` : les adresses jusqu'à
 * l'entrée actuelle ; `retour()` : le bouton Précédent). `avant(document)` complète la page construite avant le script (il la lit au chargement).
 */
async function charger(adresse, { avant } = {}) {
  let url = new URL(adresse, 'http://site/');
  // l'historique de session : des entrées { href, state }, la position actuelle ; back() est asynchrone (popstate au tour suivant), comme dans un navigateur
  let entrees = [{ href: url.href, state: null }];
  let position = 0;
  const pile = () => entrees.slice(0, position + 1).map((e) => e.href);
  const window = new EventTarget();
  const liste = el('ul', { id: 'liste-mots-cles' },
    motCle(1, 'peuple', 2, 'Peuple'),
    motCle(2, 'magie-elementaire', 1, 'magie élémentaire', { 'data-anciennes-cles': '["elementaire","magie-elem"]' }),
    motCle(3, 'demo', 0, 'démo', { 'data-definition': 'Un mot-clé du glossaire qu’aucune page ne porte encore.' }));
  const vue = el('section', { id: 'vue-du-mot-cle', hidden: '' },
    el('a', { id: 'tous-les-mots-cles', href: '/recherche/' }), el('h2', { id: 'titre-mot-cle' }), el('p', { id: 'vue-du-mot-cle-definition', hidden: '' }),
    el('p', { id: 'vue-du-mot-cle-compte' }),
    el('ul', { id: 'vue-du-mot-cle-pages', hidden: '' }),
    el('div', { id: 'definitions-des-mots-cles', hidden: '' }));
  const document = fauxDocument(el('div', { 'data-recherche': '', 'data-lien-mot-cle': '/recherche/?mot-cle=' },
    el('form', { id: 'search-form', 'data-index-url': '/search-index.json', 'data-base': '/', 'data-suffix': '' }, el('input', { id: 'q' })),
    el('p', { id: 'status' }),
    el('section', { id: 'mots-cles' }, el('small', { id: 'nombre-mots-cles' }), liste, el('p', { id: 'aucun-mot-cle', hidden: '' })),
    vue,
    el('section', { id: 'pages-trouvees', hidden: '' }, el('ul', { id: 'results' }))));
  document.title = 'Recherche — Maverick Center';
  avant?.(document);
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
  assert.deepEqual(p.liste.children.filter((li) => !li.hidden).map((li) => li.dataset.cle), ['peuple', 'magie-elementaire', 'demo']);
  assert.equal(p.$('nombre-mots-cles').textContent, '(3)');
  assert.equal(p.chargements.n, 0, 'l’index n’est chargé qu’à la demande');
  const q = p.$('q');
  q.value = 'élémentaire';
  q.dispatchEvent(new Event('input'));
  await attendre();
  assert.deepEqual(p.liste.children.filter((li) => !li.hidden).map((li) => li.dataset.cle), ['magie-elementaire']);
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
  assert.deepEqual(p.liste.children.filter((li) => !li.hidden).map((li) => li.dataset.cle), ['demo'], 'un mot-clé sans page est dans le glossaire');
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

test('?mot-cle= lu au chargement (la clé ; R232 (3) : une clé quittée, un ancien id texte, y mène encore) ; une clé inconnue « n’existe plus », « sans-categorie » (filtre de la frise, plus de la recherche) compris', async () => {
  const deux = await charger('/recherche/?mot-cle=magie-elementaire');
  assert.equal(deux.vue.hidden, false);
  assert.equal(deux.$('titre-mot-cle').textContent, 'Mot-clé « magie élémentaire »');
  assert.deepEqual(titres(deux.$('vue-du-mot-cle-pages')), ['Feu']);
  for (const quittee of ['elementaire', 'magie-elem']) {
    const ancienne = await charger(`/recherche/?mot-cle=${quittee}`);
    assert.equal(ancienne.$('titre-mot-cle').textContent, 'Mot-clé « magie élémentaire »', quittee);
    assert.deepEqual(titres(ancienne.$('vue-du-mot-cle-pages')), ['Feu'], quittee);
  }
  const parId = await charger('/recherche/?mot-cle=2');
  assert.equal(parId.$('titre-mot-cle').textContent, 'Ce mot-clé n’existe plus', 'l’id entier n’est pas une adresse : la clé l’est');
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

test('clic sur un mot-clé puis saisie (ou recherche) : retour arrière, jamais deux entrées identiques de la liste', async () => {
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
  // la soumission du formulaire : de même
  cliquer(p.liste.children[0].children[0], p.liste);
  await attendre();
  p.$('search-form').dispatchEvent(new Event('submit', { cancelable: true }));
  await attendre();
  await attendre();
  assert.deepEqual(p.pile().map((a) => new URL(a).search), ['', '?mot-cle=magie-elementaire', ''], 'Chercher');
  assert.equal(p.vue.hidden, true);
});

test('plus aucun script n’émet ni n’écoute « recherche:mots-cles » : la gestion du vocabulaire est sur le Glossaire (« glossaire:mots-cles »)', () => {
  const src = fileURLToPath(new URL('../src/', import.meta.url));
  const fichiers = readdirSync(src, { recursive: true }).filter((f) => /\.(mjs|js|ts|astro)$/.test(f));
  assert.deepEqual(fichiers.filter((f) => readFileSync(join(src, f), 'utf8').includes('recherche:mots-cles')), []);
  assert.ok(fichiers.some((f) => readFileSync(join(src, f), 'utf8').includes('glossaire:mots-cles')), 'l’évènement du Glossaire existe');
});

test('R233 (1), (9) : un synonyme d’un mot-clé (l’ancienne abréviation comprise) le fait trouver (« AM » → « Armure magique ») ; sa pastille et la vue montrent le libellé seul, la définition rendue par la page (monnaies en icônes, R63)', async () => {
  // la liste et les définitions rendues au build (lib/mots-cles-balises.mjs#htmlDeLaPastille, #htmlDeLaDefinition), lues par le script au chargement
  const pastille = (id, libelle, extra, html) => {
    const li = motCle(id, normalize(libelle), 0, libelle, extra);
    li.children[0].innerHTML = html;
    return li;
  };
  const p = await charger('/recherche/', {
    avant(document) {
      document.getElementById('liste-mots-cles').append(
        pastille(10, 'Armure magique', { 'data-synonymes': '["AM","Bouclier de mana"]', 'data-definition': 'Protège des sorts.' }, htmlDeLaPastille({ libelle: 'Armure magique', n: 0 })),
        pastille(11, 'Ricken d’or', { 'data-synonymes': '["RO"]', 'data-definition': '1 RO = 100 RF.' }, htmlDeLaPastille({ libelle: 'Ricken d’or', icone: 'monnaie:ro', n: 0 })));
      const definitions = document.getElementById('definitions-des-mots-cles');
      for (const [id, texte] of [[10, 'Protège des sorts.'], [11, '1 RO = 100 RF.']]) {
        const d = el('div', { 'data-definition-de': String(id) });
        d.innerHTML = htmlDeLaDefinition(texte);
        definitions.append(d);
      }
    },
  });
  const visibles = () => p.liste.children.filter((li) => !li.hidden).map((li) => li.dataset.id);
  const q = p.$('q');
  for (const saisie of ['AM', 'am', 'armure', 'bouclier de mana']) {
    q.value = saisie;
    q.dispatchEvent(new Event('input'));
    await attendre();
    assert.deepEqual(visibles(), ['10'], saisie);
  }
  q.value = '';
  q.dispatchEvent(new Event('input'));
  await attendre();
  cliquer(p.liste.children.at(-2).children[0], p.liste);
  await attendre();
  assert.equal(p.adresse(), '/recherche/?mot-cle=armure-magique', 'la clé dans l’adresse');
  assert.equal(p.$('titre-mot-cle').textContent, 'Mot-clé « Armure magique »', 'le libellé seul (R233 (9))');
  assert.equal(p.document.title, 'Mot-clé « Armure magique » — Recherche — Maverick Center');
  assert.equal(p.$('vue-du-mot-cle-definition').textContent, 'Protège des sorts.');
  // une monnaie (R183) : « Ricken d’or » et son icône, au titre comme dans la définition ; aucune abréviation visible (R63)
  cliquer(p.$('tous-les-mots-cles'), p.vue);
  await attendre();
  cliquer(p.liste.children.at(-1).children[0], p.liste);
  await attendre();
  assert.ok(p.$('titre-mot-cle').querySelector('.piece.piece--ro'), 'l’icône au titre');
  assert.equal(p.$('titre-mot-cle').textContent, 'Mot-clé « Ricken d’or  »');
  assert.equal(p.document.title, 'Mot-clé « Ricken d’or » — Recherche — Maverick Center', 'le titre de l’onglet : sans icône ni abréviation');
  const definition = p.$('vue-du-mot-cle-definition');
  assert.equal(definition.hidden, false);
  assert.ok(definition.querySelector('.piece.piece--ro') && definition.querySelector('.piece.piece--rf'), 'les monnaies de la définition en icônes');
  assert.doesNotMatch(definition.textContent, /R[OF]/);
  // sans synonyme ni définition rendue : le libellé seul
  cliquer(p.$('tous-les-mots-cles'), p.vue);
  await attendre();
  cliquer(p.liste.children[0].children[0], p.liste);
  await attendre();
  assert.equal(p.$('titre-mot-cle').textContent, 'Mot-clé « Peuple »');
  // une définition sans rendu dans #definitions-des-mots-cles : son texte tel quel
  cliquer(p.$('tous-les-mots-cles'), p.vue);
  await attendre();
  cliquer(p.liste.children[2].children[0], p.liste);
  await attendre();
  assert.equal(p.$('vue-du-mot-cle-definition').textContent, 'Un mot-clé du glossaire qu’aucune page ne porte encore.');
});
