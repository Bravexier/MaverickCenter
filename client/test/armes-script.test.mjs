// Le script de la page Armes, /ressources/armes/ (src/scripts/armes.mjs), exécuté dans un faux navigateur (test/aide-faux-dom.mjs), pour les
// deux menus à onglets, mêlée et distance (demande du propriétaire, 2026-10-23 : « Il faudrai réduire çà en deux menus à onglet. Un pour les armes de
// mêlée l'autre pour les armes à distances. Le fonctionnement interne des tableaux reste inchangé ») : sous le filtre, l'onglet d'une famille sans arme
// affichée se cache, un menu sans aucune famille affichée aussi, l'onglet ouvert qui n'a plus d'arme laisse la place au premier qui en a (évènement
// « onglets:ouvrir », limité aux menus de l'onglet Armes : `detail.dans`), l'onglet dit « N armes sur M » ; ouvrir une arme (?arme=, clic) ouvre
// l'onglet de sa famille de la même façon ; en mode modification, aucun onglet ne se cache. L'onglet choisi est écrit dans l'adresse (`#famille-<id>`,
// par components/Onglets.astro : « On peut retenir l'onglet ouvert #epee par exemple ») : quand le filtre ferme l'onglet que l'adresse désigne, elle
// suit celui qui s'ouvre ; une famille sans arme (créée sur le site de dev, décision R159) garde son onglet sans filtre. Le faux navigateur ne fait pas remonter les évènements :
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
async function charger(recherche = '', { edition = false, vide = false } = {}) {
  const f = {
    epees: famille('epees', !vide, arme('espadon', 'arme-lourde', true), arme('glaive', 'arme-lourde')),
    dagues: famille('dagues', false, arme('stylet', 'arme-legere')),
    arc: famille('arc', true, arme('arc-court', 'arc')),
    arbalete: famille('arbalete', false, arme('arbalete-legere', 'arbalete')),
    // `vide` : une famille sans arme (créée sur le site de dev, R159), ouverte dans le menu des armes de mêlée
    ...(vide ? { frondes: famille('frondes', true) } : {}),
  };
  const menus = { contact: menu('contact', f.epees, f.dagues, ...(vide ? [f.frondes] : [])), distance: menu('distance', f.arc, f.arbalete) };
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
  let url = new URL(`/ressources/armes/${recherche}`, 'http://site/');
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
  // l'adresse n'écrit que le filtre : ce script n'écrit pas l'onglet (components/Onglets.astro l'écrit quand on le choisit)
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

test('l’adresse retient l’onglet : quand le filtre ferme l’onglet qu’elle désigne, elle suit celui qui s’ouvre ; une autre ancre reste', async () => {
  // « On peut retenir l'onglet ouvert #epee par exemple » : Épées choisi (#famille-epees), puis « Légère » : Dagues s'ouvre, l'adresse le suit
  const p = await charger('#famille-epees');
  p.clic(p.filtre['arme-legere']);
  assert.deepEqual(p.ouvertures, [['dagues', true]]);
  assert.equal(p.adresse(), '?competence=arme-legere#famille-dagues');
  // au chargement aussi : le filtre de l'adresse ferme l'onglet qu'elle retient
  const q = await charger('?competence=arme-legere#famille-epees');
  assert.equal(q.adresse(), '?competence=arme-legere#famille-dagues');
  // une ligne d'arme de l'onglet fermé, que le filtre écarte (elle ne s'ouvre donc pas : ?arme= ne la remplace pas) : l'adresse suit aussi
  const r = await charger('?competence=arme-legere#arme-glaive');
  assert.equal(r.adresse(), '?competence=arme-legere#famille-dagues');
  // une autre ancre de la page (#ameliorations-arme) ou l'onglet de l'autre menu reste
  for (const ancre of ['#ameliorations-arme', '#famille-arc']) {
    const s = await charger(ancre);
    s.clic(s.filtre['arme-legere']);
    assert.deepEqual(s.ouvertures, [['dagues', true]]);
    assert.equal(s.adresse(), `?competence=arme-legere${ancre}`, ancre);
  }
  // un onglet qui garde ses armes : rien ne bouge
  const t = await charger('#famille-epees');
  t.clic(t.filtre['arme-lourde']);
  assert.deepEqual(t.ouvertures, []);
  assert.equal(t.adresse(), '?competence=arme-lourde#famille-epees');
});

test('R159 : une famille sans arme (créée sur le site de dev) garde son onglet et reste ouverte tant qu’aucun filtre n’est actif', async () => {
  const p = await charger('', { vide: true });
  assert.deepEqual(p.caches(), [], 'son onglet n’est pas caché');
  assert.deepEqual(p.ouvertures, [], 'aucun autre onglet ne s’ouvre à sa place');
  assert.equal(p.comptesDesOnglets().frondes, '0 arme');
  assert.equal(p.f.frondes.panneau.classList.contains('est-filtree'), false);
  // après un enregistrement ou une création (« armes:rafraichir ») : rien ne change
  p.document.dispatchEvent(new Event('armes:rafraichir'));
  assert.deepEqual(p.caches(), []);
  assert.deepEqual(p.ouvertures, []);
  // sous un filtre, elle se cache comme les autres, et le premier onglet qui a des armes s'ouvre
  p.clic(p.filtre['arme-lourde']);
  assert.deepEqual(p.caches(), ['dagues', 'arc', 'arbalete', 'frondes']);
  assert.deepEqual(p.ouvertures, [['epees', true]]);
  // en mode modification, jamais
  const q = await charger('?competence=arme-lourde', { vide: true, edition: true });
  assert.deepEqual(q.caches(), []);
  assert.deepEqual(q.ouvertures, []);
});

// Armes élémentaires (décision R167 ; design du propriétaire : « en sélectionnant l'arme élémentaire en question ça affichera ou non la bonne colone du
// tableau "amélioration" et grisera le "matériau" ») : la page avec ses matériaux (fer par défaut, titane) et ses améliorations (coût matériel et coût
// élémentaire de chaque niveau, comme components/armes/ArmesPage.astro), une arme du catalogue (Arc court) et une arme élémentaire (Arc de Sang).
const NIVEAUX = [
  [1, 20, null, 1, 'commune', null, 2, null], [2, 50, 1, 2, 'commune', null, 4, null], [3, 100, null, 3, 'commune', null, 6, null],
  [4, 150, 1, 1, 'raffinee', null, 8, null], [5, 200, null, 2, 'raffinee', null, 10, 1], [6, 200, 1, 3, 'raffinee', null, 12, 1],
  [7, 200, null, 1, 'parfaite', null, 14, 1], [8, 200, 1, 2, 'parfaite', null, 16, 1], [9, 200, null, 3, 'parfaite', null, 18, 1],
  [10, 200, 1, null, null, 1, 20, 2],
];

async function chargerLaForge(recherche = '') {
  const sans = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));
  const materiau = (id, defaut, bonus, cran, prix) =>
    el('tr', sans({ class: `materiau ligne-couleur couleur-materiau-${id}`, id: `materiau-${id}`, 'data-materiau': id, 'data-defaut': defaut ? '1' : null }),
      el('th', {}, el('button', { class: 'materiau__choisir' }, id)),
      el('td', {}, el('span', { class: 'materiau-prix', 'data-ro': String(prix) })),
      el('td', {}, el('span', { class: 'materiau-effet', 'data-bonus': String(bonus), 'data-cran': String(cran) })));
  const materiaux = [materiau('fer', true, 0, 0, 10), materiau('titane', false, 9, 1, 200)];
  const ameliorations = [
    el('tr', { class: 'amelioration amelioration--aucune', 'data-niveau': '0' }, el('th', {}, el('button', { class: 'amelioration__choisir' }, 'Aucune'))),
    ...NIVEAUX.map(([niveau, ro, mat, gemmes, qualite, pieces, bonus, cran]) => el('tr', { class: 'amelioration', id: `amelioration-${niveau}`, 'data-niveau': String(niveau) },
      el('th', {}, el('button', { class: 'amelioration__choisir' }, `+${niveau}`)),
      el('td', { class: 'amelioration__cout' }, el('span', { class: 'amelioration-cout', 'data-ro': String(ro), 'data-materiaux': String(mat ?? 0) })),
      el('td', { class: 'amelioration__cout-elementaire' }, el('span', sans({ class: 'amelioration-cout-elementaire', 'data-gemmes': gemmes && String(gemmes), 'data-qualite': qualite, 'data-pieces': pieces && String(pieces) }),
        ...(gemmes ? [el('span', { class: 'amelioration-cout__gemme', 'data-armes-gemme': '' })] : []))),
      el('td', {}, el('span', sans({ class: 'amelioration-effet', 'data-bonus': String(bonus), 'data-cran': cran && String(cran) }))))),
  ];
  // les mains (lib/armes-rendu.mjs) : une arme élémentaire, « une ou deux mains », comme une arme `une_ou_deux` du catalogue (R167)
  const ligneDArme = (id, classes, attrs, de, bonus, durabilite, competences, mains = 'deux mains') => [
    el('tr', { class: `arme ${classes}`.trim(), id, 'data-arme': id, ...attrs },
      el('th', { class: 'arme__nom' }, el('button', { class: 'arme__choisir' }, id), el('span', { class: 'arme__mains' }, mains)),
      el('td', { class: 'arme__competence' }, el('span', { class: 'arme-comp', 'data-competences': competences })),
      el('td', { class: 'arme__type' }, 'Arc'),
      el('td', {}, el('span', { class: 'arme-degats', 'data-de': de, 'data-bonus': String(bonus) })),
      el('td', {}, el('span', { class: 'arme-portee', 'data-portee': '2-10' })),
      el('td', {}, el('span', { 'data-durabilite': String(durabilite) })),
      el('td', {}, el('span', { class: 'arme-cout', 'data-ro': '15' }))),
    el('tr', { class: `arme-suite${classes ? ' arme-suite--elementaire couleur-magie-sang' : ''}` }, el('td', { class: 'arme__effets' }, el('span', { class: 'arme-effet' }, 'Pointe bordeaux'))),
  ];
  const famille = el('section', { class: 'tableau armes-famille is-active', id: 'famille-arc' },
    el('h4', { class: 'armes-famille__titre' }, el('span', { class: 'armes-famille__compte' }, '2 armes')),
    el('table', {}, el('tbody', {},
      ...ligneDArme('arme-arc-arc-court', '', {}, 'D8', 0, 2, 'arc'),
      ...ligneDArme('arme-elementaire-arc-sang', 'arme--elementaire couleur-magie-sang', { 'data-elementaire': 'Sang', 'data-gemme': 'Grenat' }, 'D8', 8, 4, 'arc arme-legere', 'une ou deux mains'))));
  const racine = el('div', { class: 'armes', 'data-armes': '' },
    el('div', { 'data-armes-filtre': '' }, el('button', { class: 'armes-filtre__choix', 'data-competence': 'arc', 'aria-pressed': 'false' })),
    el('div', { class: 'armes-vue' },
      el('div', { class: 'armes-tableaux' }, el('section', { class: 'armes-bloc', 'data-armes-bloc': 'distance' },
        el('nav', { class: 'armes-onglets' }, el('a', { class: 'onglet is-active', id: 'onglet-famille-arc', href: '#famille-arc' })), famille)),
      el('aside', { class: 'armes-cote' }, el('section', { class: 'arme-fiche' }, el('p', { class: 'arme-fiche__vide' }, 'Choisissez une arme')),
        el('details', { class: 'tableau armes-materiaux' }, el('table', {}, el('tbody', {}, ...materiaux))),
        el('details', { class: 'tableau armes-ameliorations' }, el('table', {}, el('tbody', {}, ...ameliorations))))),
    el('div', { 'data-armes-bulles': '' }));
  racine.querySelector('.armes-cote').scrollTo = () => {};
  let url = new URL(`/ressources/armes/${recherche}`, 'http://site/');
  const document = fauxDocument(el('section', { class: 'equipement-panneau', id: 'armes' }, racine));
  Object.assign(globalThis, {
    document,
    Element,
    location: { get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { state: null, replaceState: (_, __, a) => (url = new URL(a, url)) },
  });
  await import(`../src/scripts/armes.mjs?page=${(numero += 1)}`);
  const q = (s) => racine.querySelector(s);
  return {
    racine, document, q,
    clic: (x) => cliquer(typeof x === 'string' ? q(x) : x, racine),
    adresse: () => `${url.search}${url.hash}`,
    elementaire: () => racine.classList.contains('armes--elementaire'),
    materiauxGrises: () => racine.querySelectorAll('.materiau__choisir').every((b) => b.disabled),
    gemmes: () => racine.querySelectorAll('[data-armes-gemme]').map((g) => g.textContent),
    tuiles: () => racine.querySelectorAll('.arme-fiche__tuile-val').map((t) => t.textContent),
    fiche: () => q('.arme-fiche').textContent,
    choisi: (s) => q(s).classList.contains('est-choisie'),
  };
}

test('R167 : choisir une arme élémentaire montre la colonne des gemmes de sa magie et grise le matériau ; une arme ordinaire, non', async () => {
  const p = await chargerLaForge();
  assert.equal(p.elementaire(), false);
  assert.ok(p.gemmes().every((g) => g === ''));
  // une arme ordinaire : le coût matériel, le fer par défaut (R49)
  p.clic('#arme-arc-arc-court .arme__choisir');
  assert.equal(p.elementaire(), false, 'arme ordinaire : la colonne du coût matériel');
  assert.equal(p.materiauxGrises(), false);
  assert.ok(p.choisi('#materiau-fer'), 'le fer par défaut');
  // l'arme élémentaire : la colonne du coût élémentaire, le nom de la gemme de sa magie, les matériaux grisés et aucun marqué
  p.clic('#arme-elementaire-arc-sang .arme__choisir');
  assert.equal(p.elementaire(), true);
  assert.equal(p.materiauxGrises(), true);
  assert.ok(!p.choisi('#materiau-fer'), 'aucun matériau ne compte (pas de fer par défaut)');
  assert.deepEqual(p.gemmes(), Array(9).fill(' de Grenat'), 'le nom de la gemme dans chaque ligne qui en demande');
  // le matériau grisé ne se choisit pas
  p.clic('#materiau-titane .materiau__choisir');
  assert.ok(!p.choisi('#materiau-titane'));
  assert.equal(p.adresse(), '?arme=arme-elementaire-arc-sang');
  // sans amélioration : dé du type + 8, solidité 4, pas de coût
  assert.deepEqual(p.tuiles(), ['D8+8', '4', '—']);
  assert.ok(p.fiche().includes('Arme élémentaire') && p.fiche().includes('Sang'));
  // ses mains, à la place de celles d'une arme du catalogue (après le type ; choix du leader-technique, R167 : « l'arme s'adapte au porteur »)
  assert.equal(p.q('.arme-fiche__sous-titre').textContent, 'Arc · une ou deux mains · Arme élémentaire');
  assert.ok(!p.fiche().includes('Forgée en'), 'pas de matériau');
  // au +5 : D8+18, solidité 5, 6 communes + 3 raffinées de Grenat, sans RO
  p.clic('#amelioration-5 .amelioration__choisir');
  assert.deepEqual(p.tuiles(), ['D8+18', '5', '6 communes + 3 raffinées de Grenat']);
  assert.ok(!p.q('.arme-fiche').innerHTML.includes('piece'), 'pas de RO');
  assert.equal(p.adresse(), '?arme=arme-elementaire-arc-sang&amelioration=5');
  p.clic('#amelioration-10 .amelioration__choisir');
  assert.deepEqual(p.tuiles(), ['D8+28', '6', '6 communes + 6 raffinées + 6 parfaites de Grenat + 1 pièce élémentaire']);
  // retour à l'arme ordinaire : la colonne du coût matériel, les matériaux, le fer
  p.clic('#arme-arc-arc-court .arme__choisir');
  assert.equal(p.elementaire(), false);
  assert.equal(p.materiauxGrises(), false);
  assert.ok(p.choisi('#materiau-fer'));
  assert.ok(p.gemmes().every((g) => g === ''));
  // fermer : plus d'arme, plus de colonne élémentaire
  p.clic('#arme-elementaire-arc-sang .arme__choisir');
  p.clic('#arme-elementaire-arc-sang .arme__choisir');
  assert.equal(p.elementaire(), false, 'fermée');
});

test('R167 : une arme élémentaire choisie repart de « Aucune » ; l’adresse fait l’aller-retour, ?materiau= est ignoré', async () => {
  const p = await chargerLaForge('?arme=arme-arc-arc-court&materiau=materiau-titane&amelioration=3');
  assert.ok(p.choisi('#materiau-titane') && p.choisi('#amelioration-3'));
  p.clic('#arme-elementaire-arc-sang .arme__choisir');
  assert.ok(p.choisi('.amelioration--aucune'), 'l’amélioration repart de « Aucune »');
  assert.equal(p.adresse(), '?arme=arme-elementaire-arc-sang', 'ni matériau ni amélioration');
  // l'adresse d'une arme élémentaire améliorée, avec un matériau : le matériau est ignoré, le niveau gardé
  const q = await chargerLaForge('?arme=arme-elementaire-arc-sang&materiau=materiau-titane&amelioration=5');
  assert.equal(q.elementaire(), true);
  assert.ok(q.choisi('#amelioration-5'));
  assert.ok(!q.choisi('#materiau-titane'));
  assert.deepEqual(q.tuiles(), ['D8+18', '5', '6 communes + 3 raffinées de Grenat']);
  assert.equal(q.adresse(), '?arme=arme-elementaire-arc-sang&amelioration=5', '?materiau= retiré');
  // en revenant à l'arme ordinaire, le fer (le titane de l'adresse a été ignoré)
  q.clic('#arme-arc-arc-court .arme__choisir');
  assert.ok(q.choisi('#materiau-fer'));
  assert.equal(q.adresse(), '?arme=arme-arc-arc-court&amelioration=5');
});

test('R167 : le filtre garde une arme élémentaire sous chacune de ses compétences, jamais sous « Arme de départ »', async () => {
  const p = await chargerLaForge('?competence=arc');
  assert.equal(p.q('#arme-elementaire-arc-sang').classList.contains('est-filtree'), false);
  const q = await chargerLaForge('?depart=1');
  assert.equal(q.q('#arme-elementaire-arc-sang').classList.contains('est-filtree'), true);
});
