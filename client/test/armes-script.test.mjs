// Le script de la page Armes, /ressources/armes/ (src/scripts/armes.mjs), exécuté dans un faux navigateur (test/aide-faux-dom.mjs), pour le menu
// latéral des familles et le seul tableau affiché (demandes du propriétaire, 2026-11-05 : « plutôt que 2 tableaux à onglet j'aimerai que tu n'affiche
// qu'un seul tableau et que tu ajoute un menu lattéral sur la gauche comme pour la page chronologie et les bases » ; « Liste unique ») : une entrée
// choisie montre le tableau de sa famille (`is-active`), seul, marque son entrée (`aria-current`), écrit `#famille-<id>` dans l'adresse (« On peut
// retenir l'onglet ouvert #epee par exemple ») et le nom dans le résumé du menu replié ; l'adresse (chargement, retour arrière) et l'évènement
// « armes:afficher » (src/scripts/edition/armes.mjs) choisissent aussi la famille ; sous le filtre, l'entrée d'une famille sans arme affichée se cache,
// la famille affichée qui n'a plus d'arme laisse la place à la première qui en a (mêlée et distance dans une seule liste), et l'adresse la suit ;
// l'entrée dit « N armes sur M » ; ouvrir une arme (?arme=, clic) affiche sa famille sans écrire l'adresse ; en mode modification, rien ne se cache ;
// une famille sans arme (créée sur le site de dev, décision R159) garde son entrée sans filtre. Le faux navigateur ne fait pas remonter les évènements :
// un clic s'envoie sur la racine des armes, que le script écoute.
// La logique pure (familleARouvrir, texteDuCompte, ancreApresLeFiltre) : test/armes-filtres.test.mjs ; le HTML construit : test/armes-html.test.mjs.
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

/**
 * Le tableau d'une famille (components/armes/TableauArmes.astro : `famille-<id>`, `is-active` s'il est affiché) et son entrée du menu
 * (components/armes/EntreeDeFamille.astro : `li` > `a#armes-menu-famille-<id>`, `aria-current` si elle est affichée).
 */
function famille(id, actif, ...armes) {
  const n = armes.length;
  const panneau = el('section', { class: `tableau armes-famille${actif ? ' is-active' : ''}`, id: `famille-${id}` },
    el('h3', { class: 'armes-famille__titre' }, el('span', { class: 'armes-famille__compte' }, `${n} armes`)),
    el('table', {}, el('tbody', {}, ...armes.flat())));
  const lien = el('a', { class: 'armes-menu__lien', id: `armes-menu-famille-${id}`, href: `#famille-${id}`, ...(actif ? { 'aria-current': 'true' } : {}) },
    el('span', { class: 'armes-menu__nom' }, id.toUpperCase()),
    el('span', { class: 'armes-menu__compte', 'data-armes-menu-compte': '' }, `${n} armes`));
  return { panneau, lien, entree: el('li', { class: 'armes-menu__entree' }, lien) };
}

/** Un clic de la souris sur `cible`, avec ses touches (`ctrlKey`…), envoyé sur la racine des armes. */
function cliquerAvec(cible, racine, touches) {
  const e = new Event('click', { cancelable: true });
  Object.defineProperties(e, { target: { value: cible }, button: { value: 0 }, ...Object.fromEntries(Object.entries(touches).map(([k, v]) => [k, { value: v }])) });
  racine.dispatchEvent(e);
  return e;
}

/**
 * La page à l'adresse `recherche` : le menu, une seule liste, mêlée puis distance — Épées (deux armes lourdes, dont une de départ, affichée au départ),
 * Dagues (une légère), puis Arc (un arc), Arbalète (une arbalète) ; avec `vide`, une famille sans arme (Frondes, créée sur le site de dev, R159) à la fin
 * des familles de mêlée, affichée au départ. Rend les familles, le résumé du menu, les boutons du filtre, l'adresse.
 */
async function charger(recherche = '', { edition = false, vide = false } = {}) {
  const f = {
    epees: famille('epees', !vide, arme('espadon', 'arme-lourde', true), arme('glaive', 'arme-lourde')),
    dagues: famille('dagues', false, arme('stylet', 'arme-legere')),
    ...(vide ? { frondes: famille('frondes', true) } : {}),
    arc: famille('arc', false, arme('arc-court', 'arc')),
    arbalete: famille('arbalete', false, arme('arbalete-legere', 'arbalete')),
  };
  const bouton = (id) => el('button', { class: 'armes-filtre__choix', 'data-competence': id, 'aria-pressed': 'false' });
  const filtre = {
    'arme-lourde': bouton('arme-lourde'), 'arme-legere': bouton('arme-legere'), arc: bouton('arc'), arbalete: bouton('arbalete'),
    depart: el('button', { 'data-armes-filtre-depart': '', 'aria-pressed': 'false' }),
    tout: el('button', { 'data-armes-filtre-tout': '', hidden: '' }),
  };
  const compte = el('span', { 'data-armes-compte': '' });
  const resume = el('span', { class: 'armes-menu__resume-famille', 'data-armes-menu-affichee': '' }, vide ? 'FRONDES' : 'EPEES');
  const menu = el('nav', { class: 'armes-menu', 'data-armes-menu': '' },
    el('details', { class: 'armes-menu__repli', open: '', 'data-armes-repli': '' }, el('summary', { class: 'armes-menu__resume' }, resume),
      el('ul', { class: 'armes-menu__liste' }, ...Object.values(f).map((x) => x.entree))));
  const racine = el('div', { class: 'armes', 'data-armes': '' },
    el('div', { 'data-armes-filtre': '' }, ...Object.values(filtre)), compte,
    el('div', { class: 'armes-vue' }, menu, el('div', { class: 'armes-tableaux' }, ...Object.values(f).map((x) => x.panneau)),
      el('aside', { class: 'armes-cote' }, el('section', { class: 'arme-fiche' }, el('p', { class: 'arme-fiche__vide' }, 'Choisissez une arme')))),
    el('div', { 'data-armes-bulles': '' }));
  racine.querySelector('.armes-cote').scrollTo = () => {};
  let url = new URL(`/ressources/armes/${recherche}`, 'http://site/');
  const document = fauxDocument(el('section', { class: 'equipement-panneau', id: 'armes' }, racine));
  if (edition) document.body.classList.add('ed-mode');
  const window = new EventTarget();
  const ecritures = [];
  Object.assign(globalThis, {
    document,
    window,
    Element,
    location: { get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { state: null, replaceState: (_, __, a) => { ecritures.push(a); url = new URL(a, url); } },
  });
  await import(`../src/scripts/armes.mjs?page=${(numero += 1)}`);
  return {
    f, filtre, compte, resume, document, window, racine, ecritures,
    clic: (x) => cliquer(x, racine),
    clicAvec: (x, touches) => cliquerAvec(x, racine, touches),
    adresse: () => `${url.search}${url.hash}`,
    /** une adresse tapée ou un retour arrière : l'ancre change, puis « hashchange » */
    allerA: (hash) => {
      url = new URL(hash, url);
      window.dispatchEvent(new Event('hashchange'));
    },
    caches: () => Object.keys(f).filter((id) => f[id].entree.hidden),
    /** la famille affichée : les tableaux `is-active` et les entrées `aria-current` (une seule de chaque, la même) */
    affichee: () => {
      const tableaux = Object.keys(f).filter((id) => f[id].panneau.classList.contains('is-active'));
      const entrees = Object.keys(f).filter((id) => f[id].lien.getAttribute('aria-current') === 'true');
      assert.deepEqual(entrees, tableaux, 'l’entrée marquée est celle du tableau affiché');
      assert.equal(tableaux.length, 1, 'un seul tableau affiché');
      return tableaux[0];
    },
    comptesDuMenu: () => Object.fromEntries(Object.entries(f).map(([id, x]) => [id, x.entree.querySelector('[data-armes-menu-compte]').textContent])),
  };
}

test('sans filtre : aucune entrée cachée, les comptes de la base, la première famille affichée', async () => {
  const p = await charger();
  assert.deepEqual(p.caches(), []);
  assert.deepEqual(p.comptesDuMenu(), { epees: '2 armes', dagues: '1 arme', arc: '1 arme', arbalete: '1 arme' });
  assert.equal(p.compte.textContent, '5 armes');
  assert.equal(p.affichee(), 'epees');
  assert.equal(p.adresse(), '', 'rien d’écrit dans l’adresse');
});

test('une entrée du menu choisie : sa famille seule s’affiche, son entrée marquée, son nom dans le résumé, #famille-<id> dans l’adresse (filtre gardé)', async () => {
  const p = await charger('?competence=arc');
  const e = p.clic(p.f.arbalete.lien.querySelector('.armes-menu__nom'));
  assert.equal(e.defaultPrevented, true, 'pas de saut du navigateur vers l’ancre');
  assert.equal(p.affichee(), 'arbalete');
  assert.equal(p.resume.textContent, 'ARBALETE', 'le résumé du menu replié');
  assert.equal(p.adresse(), '?competence=arc#famille-arbalete', '« On peut retenir l’onglet ouvert #epee par exemple »');
  // de la mêlée à la distance et retour : une seule liste
  p.clic(p.f.dagues.lien);
  assert.equal(p.affichee(), 'dagues');
  assert.equal(p.adresse(), '?competence=arc#famille-dagues');
  // un clic avec Ctrl (ou ⌘, Maj) : celui du navigateur (nouvel onglet), rien ne change
  const f = p.clicAvec(p.f.arc.lien, { ctrlKey: true });
  assert.equal(f.defaultPrevented, false);
  assert.equal(p.affichee(), 'dagues');
  // en mode modification aussi
  p.document.body.classList.add('ed-mode');
  p.clic(p.f.epees.lien);
  assert.equal(p.affichee(), 'epees');
});

test('l’adresse choisit la famille : au chargement (#famille-<id>, l’entrée du menu, une ligne d’arme) et à chaque changement (retour arrière) ; une autre ancre ne change rien', async () => {
  for (const [ancre, attendue] of [['#famille-arbalete', 'arbalete'], ['#armes-menu-famille-dagues', 'dagues'], ['#arme-glaive', 'epees'], ['#materiaux-armes', 'epees'], ['#famille-inconnue', 'epees']]) {
    const p = await charger(ancre);
    assert.equal(p.affichee(), attendue, ancre);
  }
  const p = await charger('#famille-arc');
  assert.equal(p.resume.textContent, 'ARC');
  p.allerA('#famille-dagues');
  assert.equal(p.affichee(), 'dagues');
  p.allerA('#ameliorations-arme');
  assert.equal(p.affichee(), 'dagues', 'une autre ancre de la page');
  p.allerA('#%E0%A4%A');
  assert.equal(p.affichee(), 'dagues', 'une ancre mal formée');
  assert.deepEqual(p.ecritures, [], 'l’adresse n’est pas réécrite');
});

test('une ancienne ancre des menus à onglets (#onglet-famille-<id>, du 2026-10-29 au 2026-11-05) affiche sa famille ; l’adresse prend la forme #famille-<id>', async () => {
  const p = await charger('?competence=arc#onglet-famille-arc');
  assert.equal(p.affichee(), 'arc');
  assert.equal(p.adresse(), '?competence=arc#famille-arc', 'réécrite, filtre gardé');
  // au retour arrière ou par un lien de la page aussi
  p.allerA('#onglet-famille-arbalete');
  assert.equal(p.affichee(), 'arbalete');
  assert.equal(p.adresse(), '?competence=arc#famille-arbalete');
  // une famille inconnue : rien ne change, l'adresse non plus
  p.allerA('#onglet-famille-inconnue');
  assert.equal(p.affichee(), 'arbalete');
  assert.equal(p.adresse(), '?competence=arc#onglet-famille-inconnue');
  // sous un filtre qui la vide, l'ancienne ancre mène à sa famille, puis l'adresse suit celle qui s'affiche
  const q = await charger('?competence=arme-legere#onglet-famille-epees');
  assert.equal(q.affichee(), 'dagues');
  assert.equal(q.adresse(), '?competence=arme-legere#famille-dagues');
});

test('un filtre qui ne laisse aucune arme cache aussi le menu ; « Toutes » le rend', async () => {
  const p = await charger('?depart=1&competence=arc');
  const menu = p.racine.querySelector('[data-armes-menu]');
  assert.deepEqual(p.caches(), ['epees', 'dagues', 'arc', 'arbalete']);
  assert.equal(menu.hidden, true);
  assert.equal(p.compte.textContent, '0 arme sur 5');
  p.clic(p.filtre.tout);
  assert.equal(menu.hidden, false);
  // un filtre qui garde une arme : le menu reste
  p.clic(p.filtre.arc);
  assert.equal(menu.hidden, false);
  // en mode modification, jamais caché
  const q = await charger('?depart=1&competence=arc', { edition: true });
  assert.equal(q.racine.querySelector('[data-armes-menu]').hidden, false);
});

test('« armes:afficher » (le mode modification : une famille ou une arme créée) affiche la famille, sans écrire l’adresse', async () => {
  const p = await charger('#famille-epees');
  p.document.dispatchEvent(new CustomEvent('armes:afficher', { detail: { famille: 'famille-arc' } }));
  assert.equal(p.affichee(), 'arc');
  p.document.dispatchEvent(new CustomEvent('armes:afficher', { detail: { famille: 'famille-absente' } }));
  assert.equal(p.affichee(), 'arc', 'une famille absente : rien');
  assert.equal(p.adresse(), '#famille-epees');
});

test('filtre : l’entrée d’une famille vidée se cache ; la famille affichée vidée laisse la place à la première qui a des armes', async () => {
  const p = await charger();
  p.clic(p.filtre['arme-legere']);
  // Épées n'a pas d'arme légère : son entrée se cache, Dagues s'affiche
  assert.deepEqual(p.caches(), ['epees', 'arc', 'arbalete']);
  assert.equal(p.affichee(), 'dagues');
  assert.equal(p.resume.textContent, 'DAGUES');
  assert.equal(p.comptesDuMenu().dagues, '1 arme');
  assert.equal(p.compte.textContent, '1 arme sur 5');
  // « Toutes » : tout revient, Dagues reste affichée
  p.clic(p.filtre.tout);
  assert.deepEqual(p.caches(), []);
  assert.equal(p.affichee(), 'dagues');
  // sans ancre dans l'adresse, le filtre n'en écrit pas
  assert.equal(p.adresse(), '');
  // toutes les compétences choisies : rien d'écarté ; le compte de la page dit « sur » dès que le filtre est actif, ceux des tableaux et du menu le total
  for (const id of ['arme-lourde', 'arme-legere', 'arc', 'arbalete']) p.clic(p.filtre[id]);
  assert.equal(p.compte.textContent, '5 armes sur 5');
  assert.deepEqual(p.comptesDuMenu(), { epees: '2 armes', dagues: '1 arme', arc: '1 arme', arbalete: '1 arme' });
  assert.equal(p.f.epees.panneau.querySelector('.armes-famille__compte').textContent, '2 armes');
});

test('filtre : la famille affichée qui garde des armes reste ; l’entrée dit « N armes sur M » ; d’une catégorie à l’autre dans la même liste', async () => {
  const p = await charger('?depart=1');
  // seule l'Espadon (Épées) est de départ : Épées reste affichée
  assert.deepEqual(p.caches(), ['dagues', 'arc', 'arbalete']);
  assert.equal(p.affichee(), 'epees');
  assert.equal(p.comptesDuMenu().epees, '1 arme sur 2');
  assert.equal(p.f.epees.panneau.querySelector('.armes-famille__compte').textContent, '1 arme sur 2', 'le compte du tableau, inchangé');
  assert.equal(p.adresse(), '?depart=1');
  // une famille à distance affichée, puis « Lourde » : la première famille de mêlée qui en a s'affiche
  const q = await charger('#famille-arbalete');
  q.clic(q.filtre['arme-lourde']);
  assert.equal(q.affichee(), 'epees');
});

test('une arme ouverte (?arme=, clic) affiche sa famille, sans écrire la famille dans l’adresse', async () => {
  const p = await charger('?arme=arme-arbalete-legere');
  assert.equal(p.affichee(), 'arbalete');
  assert.equal(p.adresse(), '?arme=arme-arbalete-legere');
  p.clic(p.f.dagues.panneau.querySelector('.arme__choisir'));
  assert.equal(p.affichee(), 'dagues');
  assert.equal(p.adresse(), '?arme=arme-stylet');
});

test('mode modification : pas de filtre, aucune entrée cachée, même avec un filtre dans l’adresse', async () => {
  const p = await charger('?competence=arc', { edition: true });
  assert.deepEqual(p.caches(), []);
  assert.equal(p.affichee(), 'epees');
  // à l'entrée en mode modification (src/scripts/edition/armes.mjs) : le filtre se lève
  const q = await charger('?competence=arc');
  assert.deepEqual(q.caches(), ['epees', 'dagues', 'arbalete']);
  assert.equal(q.affichee(), 'arc');
  q.document.body.classList.add('ed-mode');
  q.document.dispatchEvent(new Event('armes:rafraichir'));
  assert.deepEqual(q.caches(), []);
  assert.equal(q.affichee(), 'arc', 'la famille affichée reste');
});

test('l’adresse retient la famille : quand le filtre ferme celle qu’elle désigne, elle suit celle qui s’affiche ; une autre ancre reste', async () => {
  // « On peut retenir l'onglet ouvert #epee par exemple » : Épées choisie (#famille-epees), puis « Légère » : Dagues s'affiche, l'adresse la suit
  const p = await charger('#famille-epees');
  p.clic(p.filtre['arme-legere']);
  assert.equal(p.affichee(), 'dagues');
  assert.equal(p.adresse(), '?competence=arme-legere#famille-dagues');
  // au chargement aussi : le filtre de l'adresse ferme la famille qu'elle retient
  const q = await charger('?competence=arme-legere#famille-epees');
  assert.equal(q.affichee(), 'dagues');
  assert.equal(q.adresse(), '?competence=arme-legere#famille-dagues');
  // une ligne d'arme de la famille fermée, que le filtre écarte (elle ne s'ouvre donc pas : ?arme= ne la remplace pas) : l'adresse suit aussi
  const r = await charger('?competence=arme-legere#arme-glaive');
  assert.equal(r.adresse(), '?competence=arme-legere#famille-dagues');
  // une famille à distance affichée et vidée : la seule liste mène à Dagues, l'adresse suit
  const s = await charger('#famille-arc');
  s.clic(s.filtre['arme-legere']);
  assert.equal(s.adresse(), '?competence=arme-legere#famille-dagues');
  // une autre ancre de la page (#ameliorations-arme) reste
  const t = await charger('#ameliorations-arme');
  t.clic(t.filtre['arme-legere']);
  assert.equal(t.affichee(), 'dagues');
  assert.equal(t.adresse(), '?competence=arme-legere#ameliorations-arme');
  // une famille qui garde ses armes : rien ne bouge
  const u = await charger('#famille-epees');
  u.clic(u.filtre['arme-lourde']);
  assert.equal(u.affichee(), 'epees');
  assert.equal(u.adresse(), '?competence=arme-lourde#famille-epees');
});

test('R159 : une famille sans arme (créée sur le site de dev) garde son entrée et reste affichée tant qu’aucun filtre n’est actif', async () => {
  const p = await charger('', { vide: true });
  assert.deepEqual(p.caches(), [], 'son entrée n’est pas cachée');
  assert.equal(p.affichee(), 'frondes', 'aucune autre famille ne s’affiche à sa place');
  assert.equal(p.comptesDuMenu().frondes, '0 arme');
  assert.equal(p.f.frondes.panneau.classList.contains('est-filtree'), false);
  // après un enregistrement ou une création (« armes:rafraichir ») : rien ne change
  p.document.dispatchEvent(new Event('armes:rafraichir'));
  assert.deepEqual(p.caches(), []);
  assert.equal(p.affichee(), 'frondes');
  // sous un filtre, elle se cache comme les autres, et la première famille qui a des armes s'affiche
  p.clic(p.filtre['arme-lourde']);
  assert.deepEqual(p.caches(), ['dagues', 'frondes', 'arc', 'arbalete']);
  assert.equal(p.affichee(), 'epees');
  // en mode modification, jamais
  const q = await charger('?competence=arme-lourde', { vide: true, edition: true });
  assert.deepEqual(q.caches(), []);
  assert.equal(q.affichee(), 'frondes');
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
      el('nav', { class: 'armes-menu', 'data-armes-menu': '' }, el('ul', { class: 'armes-menu__liste' },
        el('li', { class: 'armes-menu__entree' }, el('a', { class: 'armes-menu__lien', id: 'armes-menu-famille-arc', href: '#famille-arc', 'aria-current': 'true' })))),
      el('div', { class: 'armes-tableaux' }, famille),
      el('aside', { class: 'armes-cote' }, el('section', { class: 'arme-fiche' }, el('p', { class: 'arme-fiche__vide' }, 'Choisissez une arme')),
        el('details', { class: 'tableau armes-materiaux' }, el('table', {}, el('tbody', {}, ...materiaux))),
        el('details', { class: 'tableau armes-ameliorations' }, el('table', {}, el('tbody', {}, ...ameliorations))))),
    el('div', { 'data-armes-bulles': '' }));
  racine.querySelector('.armes-cote').scrollTo = () => {};
  let url = new URL(`/ressources/armes/${recherche}`, 'http://site/');
  const document = fauxDocument(el('section', { class: 'equipement-panneau', id: 'armes' }, racine));
  Object.assign(globalThis, {
    document,
    window: new EventTarget(),
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

test('la ligne à part d’un matériau ou d’une amélioration (son effet secondaire, demande du propriétaire du 2026-11-05) se choisit comme la sienne ; grisée avec une arme élémentaire (R167)', async () => {
  const p = await chargerLaForge('?arme=arme-arc-arc-court');
  const suite = (classe) => el('tr', { class: classe }, el('td', {}), el('td', { class: `${classe}__effet` }, el('span', {}, 'effet secondaire')));
  p.q('#materiau-titane').after(suite('materiau-suite'));
  p.q('#amelioration-5').after(suite('amelioration-suite'));
  p.clic(p.q('#materiau-titane').nextElementSibling.querySelector('span'));
  assert.ok(p.choisi('#materiau-titane'), 'le matériau de la ligne d’au-dessus');
  p.clic(p.q('#amelioration-5').nextElementSibling.querySelector('span'));
  assert.ok(p.choisi('#amelioration-5'), 'l’amélioration de la ligne d’au-dessus');
  assert.equal(p.adresse(), '?arme=arme-arc-arc-court&materiau=materiau-titane&amelioration=5');
  // la fiche : le calcul de lib/arme-forge.mjs, sur le titane et le +5
  assert.deepEqual(p.tuiles().slice(0, 2), ['D8+19', '4']);
  // un second clic sur la ligne à part de l'amélioration la retire, comme sur la sienne
  p.clic(p.q('#amelioration-5').nextElementSibling.querySelector('span'));
  assert.ok(p.choisi('.amelioration--aucune'));
  // une arme élémentaire : la ligne à part d'un matériau ne le choisit pas (R167, matériaux grisés)
  p.clic('#arme-elementaire-arc-sang .arme__choisir');
  p.clic(p.q('#materiau-titane').nextElementSibling.querySelector('span'));
  assert.ok(!p.choisi('#materiau-titane'));
});
