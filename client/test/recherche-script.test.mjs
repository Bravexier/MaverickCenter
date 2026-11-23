// Le script de /recherche/ (src/scripts/recherche.mjs), exécuté dans un faux navigateur : un mot-clé cliqué affiche ses pages (jamais un événement de la
// chronologie, qui n'a pas de mot-clé mais des catégories), l'adresse suit (?mot-cle=<clé>, pushState ; décision R232 (3)) et le retour arrière ramène la
// liste ; ?mot-cle= est lu au chargement, une clé quittée (un ancien id texte, un renommage) mène au mot-clé (idDeLaCle) ; une clé inconnue
// (« sans-categorie » compris) « n'existe plus » ; la liste se filtre par le libellé et les synonymes des mots-clés (R233 (1)) ; un événement se
// trouve par une catégorie ; taper depuis la vue d'un mot-clé ouverte par un clic revient en arrière (pas deux entrées identiques dans l'historique).
// Depuis la migration 0056, la liste est le glossaire : tous les mots-clés, même sans page, et la vue d'un mot-clé montre sa définition. La liste est
// rendue au build et lue au chargement : plus aucun script ne la redessine (la gestion du vocabulaire est sur le Glossaire, évènement
// « glossaire:mots-cles »), et plus personne n'émet ni n'écoute « recherche:mots-cles ».
// Décision R309 (§8, §9) : la liste est paginée par 100 pastilles (`?page=`, la navigation créée par le script, les filtres sur tout le registre puis la page,
// un filtre qui change revient à la page 1) et la vue d'un mot-clé montre d'abord son élément (search-elements.json, chargé avec l'index), puis ses pages.
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
// les éléments des mots-clés ancrés (lib/recherche-index.ts#elementsDesMotsCles, /search-elements.json) : par id ; `texte` seulement sans définition écrite
const elements = {
  1: { nom: 'Peuple', type: 'Page', adresse: 'regles/peuple/', texte: 'Le résumé de la page du peuple.' },
  4: { nom: 'Boule de feu', type: 'Sort', adresse: 'magies/feu/#sort-boule-de-feu', texte: 'Inflige 3 dégâts.\nPorte à 10 mètres.' },
  5: { nom: 'Zone', type: 'Type de sort' },
  6: { nom: 'Page écrite', type: 'Page', adresse: 'guide/page-ecrite/' },
};
// un mot-clé de la liste (pages/recherche.astro) : son id entier, sa clé (celle de l'adresse)
const motCle = (id, cle, n, libelle, extra = {}) => el('li', { 'data-id': String(id), 'data-cle': cle, 'data-n': String(n), 'data-libelle': libelle, ...extra }, el('a', { href: `/recherche/?mot-cle=${cle}` }));

let numero = 0;
/**
 * Charge la page /recherche/ à l'adresse `adresse` et y lance le script ; rend les éléments utiles et l'historique (`pile()` : les adresses jusqu'à
 * l'entrée actuelle ; `retour()` : le bouton Précédent). `avant(document)` complète la page construite avant le script (il la lit au chargement) ; `elementsHs` : le fichier des éléments ne se charge pas.
 */
async function charger(adresse, { avant, elementsHs = false } = {}) {
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
    el('div', { id: 'vue-du-mot-cle-element', hidden: '' }, el('h3', {}, 'Élément'), el('ul', { id: 'vue-du-mot-cle-element-liste', class: 'entry-list' })),
    el('p', { id: 'vue-du-mot-cle-compte' }),
    el('ul', { id: 'vue-du-mot-cle-pages', hidden: '' }),
    el('div', { id: 'definitions-des-mots-cles', hidden: '' }));
  const document = fauxDocument(el('div', { 'data-recherche': '', 'data-lien-mot-cle': '/recherche/?mot-cle=' },
    el('form', { id: 'search-form', 'data-index-url': '/search-index.json', 'data-elements-url': '/search-elements.json', 'data-base': '/', 'data-suffix': '' }, el('input', { id: 'q' })),
    el('p', { id: 'status' }),
    el('section', { id: 'mots-cles' }, el('small', { id: 'nombre-mots-cles' }), liste, el('p', { id: 'aucun-mot-cle', hidden: '' })),
    vue,
    el('section', { id: 'pages-trouvees', hidden: '' }, el('ul', { id: 'results' }))));
  document.title = 'Recherche — Maverick Center';
  avant?.(document);
  const chargements = { n: 0, elements: 0 };
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
    fetch: async (adresseDemandee) => {
      if (adresseDemandee === '/search-elements.json') {
        chargements.elements += 1;
        return elementsHs ? { ok: false, status: 404 } : { ok: true, json: async () => elements };
      }
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

// --- R309 §8 : l'élément d'un mot-clé ---------------------------------------------------------------------------------------------------------------
/** Des mots-clés ancrés de plus dans la liste (ids 4 à 6 : un sort, un type de sort, une page à définition écrite), sans page qui les cite. */
const ancres = (document) => {
  const liste = document.getElementById('liste-mots-cles');
  liste.append(
    motCle(4, 'boule-de-feu', 0, 'Boule de feu'),
    motCle(5, 'zone', 0, 'Zone'),
    motCle(6, 'page-ecrite', 0, 'Page écrite', { 'data-definition': 'Définition écrite à la main.' }));
};

test('R309 §8 : la vue d’un mot-clé montre d’abord son élément (son nom en lien, son type, son texte), puis les pages qui le portent ou le citent', async () => {
  const p = await charger('/recherche/', { avant: ancres });
  assert.equal(p.chargements.elements, 0, 'les éléments ne sont chargés qu’avec la vue d’un mot-clé');
  cliquer(p.liste.children[0].children[0], p.liste);
  await attendre();
  assert.equal(p.chargements.elements, 1);
  assert.equal(p.$('vue-du-mot-cle-element').hidden, false);
  assert.equal(p.$('vue-du-mot-cle-element-liste').children.length, 1);
  const [ligne] = p.$('vue-du-mot-cle-element-liste').children;
  assert.equal(ligne.children[0].textContent, 'Peuple');
  assert.equal(ligne.children[0].href, '/regles/peuple/', 'le lien vers l’élément');
  assert.equal(ligne.querySelector('.badge').textContent, 'Page');
  assert.equal(ligne.querySelector('.muted').textContent, 'Le résumé de la page du peuple.', 'son texte, à défaut de définition écrite');
  // l'ordre à l'écran : le titre, l'élément, puis le compte et les pages
  const ordre = p.vue.children.map((e) => e.id || e.tagName.toLowerCase());
  assert.ok(ordre.indexOf('vue-du-mot-cle-element') > ordre.indexOf('titre-mot-cle'), ordre.join());
  assert.ok(ordre.indexOf('vue-du-mot-cle-element') < ordre.indexOf('vue-du-mot-cle-compte'), ordre.join());
  assert.ok(ordre.indexOf('vue-du-mot-cle-element') < ordre.indexOf('vue-du-mot-cle-pages'), ordre.join());
  assert.deepEqual(titres(p.$('vue-du-mot-cle-pages')), ['Elfe'], 'puis ses pages');
  assert.equal(p.$('vue-du-mot-cle-compte').textContent, '1 page.');
  // un mot-clé dont la définition est écrite : l'élément (nom et lien) sans son texte
  cliquer(p.$('tous-les-mots-cles'), p.vue);
  await attendre();
  cliquer(p.liste.children.find((li) => li.dataset.id === '6').children[0], p.liste);
  await attendre();
  assert.equal(p.chargements.elements, 1, 'chargés une fois');
  assert.equal(p.$('vue-du-mot-cle-definition').textContent, 'Définition écrite à la main.');
  const ecrite = p.$('vue-du-mot-cle-element-liste').children[0];
  assert.equal(ecrite.children[0].href, '/guide/page-ecrite/');
  assert.equal(ecrite.querySelector('.muted'), null, 'la définition écrite est montrée une fois, pas le texte de l’élément');
});

test('R309 §8 : un mot-clé de sort sans page qui le cite montre son élément, son lien et son texte, et ne dit plus « Aucune page »', async () => {
  const p = await charger('/recherche/?mot-cle=boule-de-feu', { avant: ancres });
  assert.equal(p.$('titre-mot-cle').textContent, 'Mot-clé « Boule de feu »');
  assert.equal(p.$('vue-du-mot-cle-element').hidden, false);
  const ligne = p.$('vue-du-mot-cle-element-liste').children[0];
  assert.equal(ligne.children[0].textContent, 'Boule de feu');
  assert.equal(ligne.children[0].href, '/magies/feu/#sort-boule-de-feu', 'l’ancre de son sort');
  assert.equal(ligne.querySelector('.badge').textContent, 'Sort');
  assert.equal(ligne.querySelector('.muted').textContent, 'Inflige 3 dégâts.\nPorte à 10 mètres.', 'son texte, ses retours à la ligne gardés');
  assert.equal(p.$('vue-du-mot-cle-pages').hidden, true);
  assert.doesNotMatch(p.vue.textContent, /Aucune page/);
  assert.equal(p.$('vue-du-mot-cle-compte').hidden, true, 'rien à compter : l’élément suffit');
  assert.equal(p.document.title, 'Mot-clé « Boule de feu » — Recherche — Maverick Center');
  // un type de sort : un nom, sans adresse ni texte
  const zone = await charger('/recherche/?mot-cle=zone', { avant: ancres });
  const type = zone.$('vue-du-mot-cle-element-liste').children[0];
  assert.equal(type.querySelector('a'), null, 'pas d’adresse : pas de lien');
  assert.equal(type.textContent, 'Zone Type de sort');
  assert.doesNotMatch(zone.vue.textContent, /Aucune page/);
  // un mot-clé sans élément ni page garde son message ; un qui a un élément et des pages compte ses pages
  const demo = await charger('/recherche/?mot-cle=demo', { avant: ancres });
  assert.equal(demo.$('vue-du-mot-cle-element').hidden, true);
  assert.equal(demo.$('vue-du-mot-cle-compte').hidden, false);
  assert.equal(demo.$('vue-du-mot-cle-compte').textContent, 'Aucune page ne porte ni ne cite ce mot-clé.');
  const peuple = await charger('/recherche/?mot-cle=peuple');
  assert.equal(peuple.$('vue-du-mot-cle-compte').hidden, false);
  assert.equal(peuple.$('vue-du-mot-cle-compte').textContent, '1 page.');
  // un autre mot-clé n'hérite pas de l'élément d'avant
  cliquer(peuple.$('tous-les-mots-cles'), peuple.vue);
  await attendre();
  cliquer(peuple.liste.children[2].children[0], peuple.liste);
  await attendre();
  assert.equal(peuple.$('vue-du-mot-cle-element').hidden, true);
  assert.equal(peuple.$('vue-du-mot-cle-element-liste').children.length, 0);
});

test('R309 §8 : des éléments qui ne se chargent pas : la vue le dit, sans inventer d’élément ni de « Aucune page »', async () => {
  const p = await charger('/recherche/?mot-cle=peuple', { elementsHs: true });
  assert.equal(p.$('vue-du-mot-cle-compte').textContent, 'Impossible de charger l’index de recherche.');
  assert.equal(p.$('vue-du-mot-cle-element').hidden, true);
  assert.equal(p.$('vue-du-mot-cle-pages').hidden, true);
});

test('R309 §8 : la pastille mène à ?mot-cle=, jamais à l’adresse de l’élément du mot-clé (Q12)', async () => {
  const p = await charger('/recherche/', { avant: ancres });
  const li = p.liste.children.find((x) => x.dataset.id === '4');
  assert.equal(li.children[0].href, '/recherche/?mot-cle=boule-de-feu', 'le lien de la pastille');
  const e = cliquer(li.children[0], p.liste);
  assert.equal(e.defaultPrevented, true, 'la page ne navigue pas : la vue s’ouvre');
  await attendre();
  assert.equal(p.adresse(), '/recherche/?mot-cle=boule-de-feu', 'jamais /magies/feu/');
  assert.equal(p.$('vue-du-mot-cle-element-liste').children[0].children[0].href, '/magies/feu/#sort-boule-de-feu', 'l’élément se lit dans la vue, par son propre lien');
});

// --- R309 §9 : 100 pastilles par page ----------------------------------------------------------------------------------------------------------------
/** `n` pastilles de plus (ids 4 à n + 3 : « Mot 004 »…), rangées comme la page construite : seules les 100 premières sont visibles, les autres portent `hidden`. */
const pastilles = (n) => (document) => {
  const liste = document.getElementById('liste-mots-cles');
  for (let i = 4; i < 4 + n; i += 1) {
    const libelle = `Mot ${String(i).padStart(3, '0')}`;
    liste.append(motCle(i, normalize(libelle), 0, libelle));
  }
  liste.children.forEach((li, i) => { li.hidden = i >= 100; });
};
const plage = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** Les ids des pastilles « Mot nnn » (4 à 250) dont le numéro écrit sur trois chiffres contient `chiffres` : ce que « mot <chiffres> » trouve. */
const motsAvec = (chiffres) => plage(4, 250).filter((i) => String(i).padStart(3, '0').includes(chiffres));

async function chargerLaListe(adresse, n = 247) {
  const p = await charger(adresse, { avant: pastilles(n) });
  const defilements = [];
  p.$('mots-cles').scrollIntoView = (o) => defilements.push(o);
  const visibles = () => p.liste.children.filter((li) => !li.hidden).map((li) => Number(li.dataset.id));
  const nav = () => p.document.querySelector('nav.recherche-navigation');
  const bouton = (nom) => nav().querySelectorAll('button').find((b) => b.dataset.nav === nom || b.dataset.page === String(nom));
  const saisir = async (texte) => {
    p.$('q').value = texte;
    p.$('q').dispatchEvent(new Event('input'));
    await attendre();
  };
  return { ...p, defilements, visibles, nav, bouton, saisir };
}

test('R309 §9 : 100 pastilles par page, la navigation (créée par le script) sous la liste, avec ses attributs d’accessibilité ; le compteur reste le total', async () => {
  const p = await chargerLaListe('/recherche/');
  assert.deepEqual(p.visibles(), plage(1, 100));
  assert.equal(p.$('nombre-mots-cles').textContent, '(250)', 'le total, pas la page');
  assert.equal(p.nav().getAttribute('aria-label'), 'Pages des mots-clés');
  assert.equal(p.nav().hidden, false);
  assert.equal(p.liste.nextElementSibling, p.nav(), 'sous la liste des pastilles');
  const courante = p.nav().querySelectorAll('[aria-current="page"]');
  assert.deepEqual([courante.length, courante[0].textContent, courante[0].getAttribute('aria-label')], [1, '1', 'Page 1']);
  assert.equal(p.bouton('precedent').disabled, true);
  assert.equal(p.bouton('suivant').disabled, false);
  assert.equal(p.nav().querySelector('.recherche-navigation__etat').textContent, 'Page 1 sur 3');
  assert.equal(p.nav().querySelector('.recherche-navigation__etat').getAttribute('aria-live'), 'polite');
  assert.equal(p.adresse(), '/recherche/', 'la page 1 : l’adresse ne change pas');
  assert.equal(p.defilements.length, 0, 'rien ne défile au chargement');
  // sans assez de pastilles pour une seconde page : pas de navigation
  const peu = await charger('/recherche/');
  assert.equal(peu.document.querySelector('nav.recherche-navigation').hidden, true);
  assert.equal(peu.liste.children.filter((li) => !li.hidden).length, 3);
});

test('R309 §9 : Suivant, Précédent et les numéros changent de page ; l’adresse suit sans nouvelle entrée, la page 1 retire « page » ; le haut de la liste est ramené à l’écran', async () => {
  const p = await chargerLaListe('/recherche/?x=1#haut');
  cliquer(p.bouton('suivant'), p.nav());
  assert.deepEqual(p.visibles(), plage(101, 200));
  assert.equal(p.adresse(), '/recherche/?x=1&page=2');
  assert.match(p.pile().at(-1), /#haut$/, 'le fragment est gardé');
  assert.equal(p.pile().length, 1, 'replaceState : le retour arrière ne repasse pas par chaque page');
  assert.deepEqual(p.defilements, [{ block: 'start' }], 'le haut de la liste ramené à l’écran');
  assert.equal(p.nav().querySelector('[aria-current="page"]').textContent, '2');
  cliquer(p.bouton(3), p.nav());
  assert.deepEqual(p.visibles(), plage(201, 250));
  assert.equal(p.adresse(), '/recherche/?x=1&page=3');
  assert.equal(p.bouton('suivant').disabled, true);
  cliquer(p.bouton('precedent'), p.nav());
  assert.deepEqual(p.visibles(), plage(101, 200));
  cliquer(p.bouton(1), p.nav());
  assert.deepEqual(p.visibles(), plage(1, 100));
  assert.equal(p.adresse(), '/recherche/?x=1', 'la page 1 : « page » retiré, les autres paramètres gardés');
  assert.equal(p.defilements.length, 4);
  cliquer(p.bouton(1), p.nav());
  assert.equal(p.defilements.length, 4, 'la page courante ne fait rien');
});

test('R309 §9 : ?page= est lu au chargement (une page trop haute est ramenée à la dernière et l’adresse corrigée, une page invalide disparaît)', async () => {
  const deux = await chargerLaListe('/recherche/?page=2');
  assert.deepEqual(deux.visibles(), plage(101, 200));
  assert.equal(deux.nav().querySelector('[aria-current="page"]').textContent, '2');
  assert.equal(deux.adresse(), '/recherche/?page=2');
  const neuf = await chargerLaListe('/recherche/?page=9');
  assert.deepEqual(neuf.visibles(), plage(201, 250), 'la page 9 est ramenée à 3');
  assert.equal(neuf.adresse(), '/recherche/?page=3');
  const faux = await chargerLaListe('/recherche/?q=&page=abc');
  assert.deepEqual(faux.visibles(), plage(1, 100));
  assert.equal(faux.adresse(), '/recherche/?q=', 'un « page » invalide est retiré, les autres paramètres restent');
});

test('R309 §9 : 100 pastilles par page, filtre sur tout le registre, retour à la page 1', async () => {
  const p = await chargerLaListe('/recherche/?page=3');
  assert.deepEqual(p.visibles(), plage(201, 250));
  // « Mot 150 » est sur la page 2 : le filtre le trouve, et c'est la page 1 qui l'affiche
  await p.saisir('mot 150');
  assert.deepEqual(p.visibles(), [150]);
  assert.equal(p.adresse(), '/recherche/', 'revenu à la page 1 : « page » retiré');
  assert.equal(p.$('nombre-mots-cles').textContent, '(1)');
  assert.equal(p.nav().hidden, true, 'une seule page : pas de navigation');
  // 112 correspondances : la page 1 en montre 100, le compteur reste le total filtré
  const avec1 = motsAvec('1');
  assert.ok(avec1.length > 100, `${avec1.length} correspondances`);
  await p.saisir('mot 1');
  assert.deepEqual(p.visibles(), avec1.slice(0, 100));
  assert.equal(p.$('nombre-mots-cles').textContent, `(${avec1.length})`);
  assert.equal(p.nav().querySelector('.recherche-navigation__etat').textContent, 'Page 1 sur 2');
  cliquer(p.bouton(2), p.nav());
  assert.equal(p.adresse(), '/recherche/?page=2');
  assert.deepEqual(p.visibles(), avec1.slice(100));
  // un autre filtre : la page 1
  await p.saisir('mot 15');
  assert.equal(p.adresse(), '/recherche/');
  assert.deepEqual(p.visibles(), motsAvec('15'));
  await p.saisir('zzz');
  assert.deepEqual(p.visibles(), []);
  assert.equal(p.$('aucun-mot-cle').hidden, false);
  assert.equal(p.nav().hidden, true);
  await p.saisir('');
  assert.deepEqual(p.visibles(), plage(1, 100));
  assert.equal(p.$('aucun-mot-cle').hidden, true);
  // le statut compte les mots-clés trouvés, pas ceux de la page
  await p.saisir('mot 1');
  assert.match(p.$('status').textContent, new RegExp(`, ${avec1.length} mots-clés$`));
});

test('R309 §9 : le texte à chercher de chaque pastille est calculé une fois, et `hidden` n’est écrit que s’il change', async () => {
  const p = await charger('/recherche/', { avant: pastilles(247) });
  const ecritures = [];
  for (const li of p.liste.children) {
    let valeur = li.hidden;
    Object.defineProperty(li, 'hidden', { get: () => valeur, set: (v) => { valeur = v; ecritures.push(li.dataset.id); if (v) li.setAttribute('hidden', ''); else li.removeAttribute('hidden'); } });
  }
  const q = p.$('q');
  q.value = 'mot 2';
  q.dispatchEvent(new Event('input'));
  await attendre();
  const apres = ecritures.length;
  assert.ok(apres > 0 && apres <= 250);
  q.value = 'mot 2';
  q.dispatchEvent(new Event('input'));
  await attendre();
  assert.equal(ecritures.length, apres, 'la même saisie : aucune écriture');
});

test('R309 §9 : ouvrir un mot-clé depuis la page 2 garde la page dans l’adresse ; « Tous les mots-clés » et le retour arrière retrouvent la page 2 ; une saisie depuis la vue ramène à la page 1', async () => {
  const p = await chargerLaListe('/recherche/?page=2');
  const pastille = (id) => p.liste.children.find((li) => li.dataset.id === String(id)).children[0];
  cliquer(pastille(150), p.liste);
  await attendre();
  assert.equal(p.adresse(), '/recherche/?page=2&mot-cle=mot-150');
  assert.equal(p.vue.hidden, false);
  p.retour();
  await attendre();
  assert.equal(p.adresse(), '/recherche/?page=2');
  assert.deepEqual(p.visibles(), plage(101, 200), 'la même page de la liste');
  assert.equal(p.nav().querySelector('[aria-current="page"]').textContent, '2');
  // « Tous les mots-clés » depuis la vue
  cliquer(pastille(150), p.liste);
  await attendre();
  cliquer(p.$('tous-les-mots-cles'));
  await attendre();
  assert.equal(p.adresse(), '/recherche/?page=2');
  assert.deepEqual(p.visibles(), plage(101, 200));
  // la saisie depuis la vue ouverte par un clic : retour arrière, et la liste filtrée est à la page 1 (la page d'avant ne vaut pas pour une autre saisie)
  cliquer(pastille(150), p.liste);
  await attendre();
  await p.saisir('mot 1');
  await attendre();
  assert.equal(p.vue.hidden, true);
  assert.equal(p.$('mots-cles').hidden, false);
  assert.equal(p.adresse(), '/recherche/');
  assert.deepEqual(p.visibles(), motsAvec('1').slice(0, 100));
  assert.deepEqual(p.pile().map((a) => new URL(a).search), ['?page=2', '?page=2&mot-cle=mot-150', ''], 'l’entrée du dernier clic est retirée, pas doublée');
});

test('R309 §9 : la navigation de 18 pages ne montre pas 18 numéros (première, dernière, courante et voisines, « … »)', async () => {
  const p = await chargerLaListe('/recherche/?page=9', 1764);
  const numeros = () => p.nav().querySelectorAll('button').filter((b) => b.dataset.page).map((b) => b.dataset.page);
  assert.deepEqual(numeros(), ['1', '8', '9', '10', '18']);
  assert.equal(p.nav().querySelectorAll('.recherche-navigation__trou').length, 2);
  assert.equal(p.nav().querySelector('.recherche-navigation__trou').textContent, '…');
  assert.match(p.nav().querySelector('.recherche-navigation__etat').textContent, /^Page 9 sur 18$/);
  assert.deepEqual(p.visibles(), plage(801, 900));
  cliquer(p.bouton(18), p.nav());
  assert.deepEqual(p.visibles(), plage(1701, 1767));
  assert.deepEqual(numeros(), ['1', '17', '18']);
  const css = readFileSync(new URL('../src/styles/recherche/recherche.css', import.meta.url), 'utf8');
  assert.match(css, /\.recherche-navigation \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.recherche-navigation__numeros \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.recherche-navigation\[hidden\] \{ display: none; \}/);
});
