// Le script de l'onglet Armes de /ressources/equipement/ (src/scripts/armes.mjs), exécuté dans un faux navigateur (test/aide-faux-dom.mjs), pour les
// deux menus à onglets, mêlée et distance (demande du propriétaire, 2026-10-23 : « Il faudrai réduire çà en deux menus à onglet. Un pour les armes de
// mêlée l'autre pour les armes à distances. Le fonctionnement interne des tableaux reste inchangé ») : sous le filtre, l'onglet d'une famille sans arme
// affichée se cache, un menu sans aucune famille affichée aussi, l'onglet ouvert qui n'a plus d'arme laisse la place au premier qui en a (évènement
// « onglets:ouvrir », limité aux menus de l'onglet Armes : `detail.dans`), l'onglet dit « N armes sur M » ; ouvrir une arme (?arme=, clic) ouvre
// l'onglet de sa famille de la même façon ; en mode modification, aucun onglet ne se cache. Le faux navigateur ne fait pas remonter les évènements :
// « onglets:ouvrir » s'écoute sur la famille qui le reçoit (components/Onglets.astro, qui l'écoute sur le document, n'est pas chargé ici).
// La logique pure (ongletARouvrir, texteDuCompte) : test/armes-filtres.test.mjs ; le HTML construit : test/armes-html.test.mjs.
//   node --test test/armes-script.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

let numero = 0;

/** Une arme (ses deux lignes, comme lib/armes-rendu.mjs#htmlDeLigneDArme, réduites à ce que le script lit) : ses compétences, arme de départ ou non. */
const arme = (id, competences, depart = false) => [
  el('tr', { class: `arme${depart ? ' arme--depart' : ''}`, id: `arme-${id}`, 'data-arme': id },
    el('th', { class: 'arme__nom' }, el('button', { class: 'arme__choisir' }, id)),
    el('td', { class: 'arme__competence' }, el('span', { class: 'arme-comp', 'data-competences': competences }))),
  el('tr', { class: 'arme-suite' }, el('td', { class: 'arme__effets' })),
];

/** Le tableau d'une famille (components/armes/TableauArmes.astro : `famille-<id>`, `is-active` s'il est ouvert) et son onglet (`onglet-famille-<id>`). */
function famille(id, actif, ...armes) {
  const n = armes.length;
  const panneau = el('section', { class: `tableau armes-famille${actif ? ' is-active' : ''}`, id: `famille-${id}` },
    el('h4', { class: 'armes-famille__titre' }, el('span', { class: 'armes-famille__compte' }, `${n} armes`)),
    el('table', {}, el('tbody', {}, ...armes.flat())));
  const onglet = el('a', { class: `onglet${actif ? ' is-active' : ''}`, id: `onglet-famille-${id}`, href: `#famille-${id}` },
    el('span', { class: 'onglet__detail', 'data-armes-onglet-compte': '' }, `${n} armes`));
  return { panneau, onglet };
}

/** Un menu (components/armes/ArmesPage.astro : `section.armes-bloc`, sa barre, ses panneaux). */
const menu = (categorie, ...familles) =>
  el('section', { class: 'armes-bloc', id: `armes-${categorie}`, 'data-armes-bloc': categorie },
    el('nav', { class: 'armes-onglets', 'data-onglets': categorie }, ...familles.map((f) => f.onglet)), ...familles.map((f) => f.panneau));

/**
 * La page à l'adresse `recherche` : Armes de mêlée = Épées (deux armes lourdes, dont une de départ, ouverte au départ), Dagues (une légère) ; Armes à
 * distance = Arc (un arc, ouvert au départ), Arbalète (une arbalète). Rend les familles, les menus, les boutons du filtre et les « onglets:ouvrir »
 * reçus (`ouvertures` : [id de la famille, detail.dans est la racine]).
 */
async function charger(recherche = '', { edition = false } = {}) {
  const f = {
    epees: famille('epees', true, arme('espadon', 'arme-lourde', true), arme('glaive', 'arme-lourde')),
    dagues: famille('dagues', false, arme('stylet', 'arme-legere')),
    arc: famille('arc', true, arme('arc-court', 'arc')),
    arbalete: famille('arbalete', false, arme('arbalete-legere', 'arbalete')),
  };
  const menus = { contact: menu('contact', f.epees, f.dagues), distance: menu('distance', f.arc, f.arbalete) };
  const bouton = (id) => el('button', { class: 'armes-filtre__choix', 'data-competence': id, 'aria-pressed': 'false' });
  const filtre = {
    'arme-lourde': bouton('arme-lourde'), 'arme-legere': bouton('arme-legere'), arc: bouton('arc'), arbalete: bouton('arbalete'),
    depart: el('button', { 'data-armes-filtre-depart': '', 'aria-pressed': 'false' }),
    tout: el('button', { 'data-armes-filtre-tout': '', hidden: '' }),
  };
  const compte = el('span', { 'data-armes-compte': '' });
  const racine = el('div', { class: 'armes', 'data-armes': '' },
    el('div', { 'data-armes-filtre': '' }, ...Object.values(filtre)), compte,
    el('div', { class: 'armes-vue' }, el('div', { class: 'armes-tableaux' }, menus.contact, menus.distance),
      el('aside', { class: 'armes-cote' }, el('section', { class: 'arme-fiche' }, el('p', { class: 'arme-fiche__vide' }, 'Choisissez une arme')))),
    el('div', { 'data-armes-bulles': '' }));
  racine.querySelector('.armes-cote').scrollTo = () => {};
  const ouvertures = [];
  for (const { panneau } of Object.values(f)) {
    panneau.addEventListener('onglets:ouvrir', (e) => ouvertures.push([panneau.id.replace('famille-', ''), e.detail?.dans === racine]));
  }
  let url = new URL(`/ressources/equipement/${recherche}`, 'http://site/');
  const document = fauxDocument(el('section', { class: 'equipement-panneau', id: 'armes' }, racine));
  if (edition) document.body.classList.add('ed-mode');
  Object.assign(globalThis, {
    document,
    Element,
    location: { get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { state: null, replaceState: (_, __, a) => (url = new URL(a, url)) },
  });
  await import(`../src/scripts/armes.mjs?page=${(numero += 1)}`);
  const ongletCache = (id) => f[id].onglet.hidden;
  return {
    f, menus, filtre, compte, ouvertures, document,
    clic: (x) => cliquer(x, racine),
    adresse: () => `${url.search}${url.hash}`,
    caches: () => Object.keys(f).filter(ongletCache),
    comptesDesOnglets: () => Object.fromEntries(Object.entries(f).map(([id, x]) => [id, x.onglet.querySelector('[data-armes-onglet-compte]').textContent])),
  };
}

test('sans filtre : aucun onglet ni menu caché, les comptes de la base, aucun onglet rouvert', async () => {
  const p = await charger();
  assert.deepEqual(p.caches(), []);
  assert.equal(p.menus.contact.hidden || p.menus.distance.hidden, false);
  assert.deepEqual(p.comptesDesOnglets(), { epees: '2 armes', dagues: '1 arme', arc: '1 arme', arbalete: '1 arme' });
  assert.equal(p.compte.textContent, '5 armes');
  assert.deepEqual(p.ouvertures, []);
});

test('filtre : l’onglet d’une famille vidée se cache, un menu vide aussi ; l’onglet ouvert vidé laisse la place au premier qui a des armes', async () => {
  const p = await charger();
  p.clic(p.filtre['arme-legere']);
  // Épées n'a pas d'arme légère : son onglet se cache, Dagues s'ouvre (« onglets:ouvrir » limité aux menus de l'onglet Armes)
  assert.deepEqual(p.caches(), ['epees', 'arc', 'arbalete']);
  assert.deepEqual(p.ouvertures, [['dagues', true]]);
  assert.equal(p.menus.contact.hidden, false);
  assert.equal(p.menus.distance.hidden, true, 'aucune arme légère à distance : le menu se cache');
  assert.equal(p.comptesDesOnglets().dagues, '1 arme');
  assert.equal(p.compte.textContent, '1 arme sur 5');
  // « Toutes » : tout revient
  p.clic(p.filtre.tout);
  assert.deepEqual(p.caches(), []);
  assert.equal(p.menus.distance.hidden, false);
  // l'adresse n'écrit que le filtre, jamais l'onglet
  assert.equal(p.adresse(), '');
  // toutes les compétences choisies : rien d'écarté ; le compte de l'onglet Armes dit « sur » dès que le filtre est actif (comme avant les menus), ceux
  // des tableaux et des onglets le total
  for (const id of ['arme-lourde', 'arme-legere', 'arc', 'arbalete']) p.clic(p.filtre[id]);
  assert.equal(p.compte.textContent, '5 armes sur 5');
  assert.deepEqual(p.comptesDesOnglets(), { epees: '2 armes', dagues: '1 arme', arc: '1 arme', arbalete: '1 arme' });
  assert.equal(p.f.epees.panneau.querySelector('.armes-famille__compte').textContent, '2 armes');
});

test('filtre : l’onglet ouvert qui garde des armes reste ; l’onglet dit « N armes sur M »', async () => {
  const p = await charger('?depart=1');
  // seule l'Espadon (Épées) est de départ : Épées reste ouvert, aucun onglet rouvert ; le menu à distance se cache
  assert.deepEqual(p.caches(), ['dagues', 'arc', 'arbalete']);
  assert.deepEqual(p.ouvertures, []);
  assert.equal(p.comptesDesOnglets().epees, '1 arme sur 2');
  assert.equal(p.f.epees.panneau.querySelector('.armes-famille__compte').textContent, '1 arme sur 2', 'le compte du tableau, inchangé');
  assert.equal(p.menus.distance.hidden, true);
  assert.equal(p.adresse(), '?depart=1');
});

test('une arme ouverte (?arme=, clic) ouvre l’onglet de sa famille, sans toucher à l’onglet de la page ni écrire l’onglet dans l’adresse', async () => {
  const p = await charger('?arme=arme-arbalete-legere');
  assert.deepEqual(p.ouvertures, [['arbalete', true]]);
  assert.equal(p.adresse(), '?arme=arme-arbalete-legere');
  p.clic(p.f.dagues.panneau.querySelector('.arme__choisir'));
  assert.deepEqual(p.ouvertures.at(-1), ['dagues', true]);
  assert.equal(p.adresse(), '?arme=arme-stylet');
});

test('mode modification : pas de filtre, aucun onglet ni menu caché, même avec un filtre dans l’adresse', async () => {
  const p = await charger('?competence=arc', { edition: true });
  assert.deepEqual(p.caches(), []);
  assert.equal(p.menus.contact.hidden, false);
  assert.deepEqual(p.ouvertures, []);
  // à l'entrée en mode modification (src/scripts/edition/armes.mjs) : le filtre se lève
  const q = await charger('?competence=arc');
  assert.deepEqual(q.caches(), ['epees', 'dagues', 'arbalete']);
  q.document.body.classList.add('ed-mode');
  q.document.dispatchEvent(new Event('armes:rafraichir'));
  assert.deepEqual(q.caches(), []);
  assert.equal(q.menus.contact.hidden, false);
});
