// Le script des onglets partagés (components/Onglets.astro), tel que le build l'écrit dans la page Armes (dist/ : se saute sans le site construit,
// npm run build), exécuté dans un faux navigateur (test/aide-faux-dom.mjs), sur une page d'essai à deux niveaux d'onglets (une barre de page, Armes et
// Boucliers, et dans Armes les deux menus des familles : la forme de l'ancienne page « Équipement », jusqu'au 2026-10-29 ; aujourd'hui, deux niveaux
// sur la page Ceinture, ses sous-onglets et les familles des consommables) : choisir un onglet écrit son ancre dans l'adresse, les menus des familles
// d'armes compris (`#famille-<id>` : demande du propriétaire, 2026-10-23, « On peut retenir l'onglet ouvert #epee par exemple »), sauf dans un groupe
// `data-onglets-sans-adresse` (option gardée, sans usage aujourd'hui) ; une adresse `#famille-…` au chargement ouvre l'onglet Armes puis la famille, et
// `#boucliers` ensuite l'onglet Boucliers ; les flèches, Début et Fin sautent un onglet caché (`hidden` : une famille d'armes que le filtre vide) ;
// « onglets:ouvrir » ouvre tous les niveaux qui contiennent l'élément, ou seulement les groupes dont les panneaux sont dans `detail.dans`
// (src/scripts/armes.mjs : l'onglet de la famille d'une arme, sans changer l'onglet de la page) ; « onglets:brancher » est ré-entrant (une famille
// créée en mode modification : décision R159).
// Le faux navigateur ne fait pas remonter les évènements : un clic ou une touche s'envoie sur l'onglet, « onglets:ouvrir » et « onglets:brancher » sur
// le document, leur cible posée à la main.
//   node --test test/onglets-script.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const fichier = fileURLToPath(new URL('../dist/ressources/armes/index.html', import.meta.url));
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
// le script des onglets, écrit en ligne dans la page (un seul par page : test/equipement-html.test.mjs)
const script = present ? [...readFileSync(fichier, 'utf8').matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('onglets:brancher')) : '';

// ce que le script lit d'un lien et d'un élément, absent du faux navigateur
Object.defineProperties(Element.prototype, {
  hash: { get() { return (this.getAttribute('href') ?? '').replace(/^[^#]*/, ''); } },
  pathname: { get() { return '/ressources/equipement/'; } },
  isConnected: { get() { return true; } },
});

let numero = 0;

/**
 * La page d'essai : une barre de page « Équipement » (Armes, Boucliers) ; dans Armes, deux menus (mêlée : Épées, Dagues, Hache ; distance : Arc, Bombes), dont Épées et
 * Arc ouverts ; `sansAdresse` : le menu des armes de mêlée porte `data-onglets-sans-adresse` ; l'adresse `hash` au chargement. Rend les onglets, les
 * panneaux, l'adresse écrite et de quoi la changer (`naviguer` : une nouvelle ancre, évènement hashchange).
 */
async function charger(hash = '', { sansAdresse = false } = {}) {
  const onglet = (id, actif) => el('a', { class: `onglet${actif ? ' is-active' : ''}`, id: `onglet-${id}`, href: `#${id}` });
  const panneau = (id, actif, ...enfants) => el('section', { class: actif ? 'is-active' : '', id }, ...enfants);
  const o = {};
  const p = {};
  for (const [id, actif] of [['famille-epees', true], ['famille-dagues', false], ['famille-hache', false], ['famille-arc', true], ['famille-bombes', false]]) {
    o[id] = onglet(id, actif);
    p[id] = panneau(id, actif, el('table', {}, el('tr', { id: `arme-${id}` })));
  }
  o.armes = onglet('armes', true);
  o.boucliers = onglet('boucliers', false);
  const barres = {
    contact: el('nav', { 'data-onglets': 'Armes de mêlée', ...(sansAdresse ? { 'data-onglets-sans-adresse': '' } : {}) }, o['famille-epees'], o['famille-dagues'], o['famille-hache']),
    distance: el('nav', { 'data-onglets': 'Armes à distance' }, o['famille-arc'], o['famille-bombes']),
  };
  const racine = el('div', { 'data-armes': '' },
    barres.contact, p['famille-epees'], p['famille-dagues'], p['famille-hache'],
    barres.distance, p['famille-arc'], p['famille-bombes']);
  p.armes = panneau('armes', true, racine);
  p.boucliers = panneau('boucliers', false);
  const document = fauxDocument(el('nav', { 'data-onglets': 'Équipement' }, o.armes, o.boucliers), p.armes, p.boucliers);
  let url = new URL(`/ressources/equipement/${hash}`, 'http://site/');
  const ecritures = [];
  const window = new EventTarget();
  Object.assign(globalThis, {
    document,
    Element,
    HTMLElement: Element,
    window,
    location: { get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { state: null, replaceState: (_, __, a) => { ecritures.push(a); url = new URL(a, url); } },
  });
  await import(`data:text/javascript,${encodeURIComponent(`${script}\n// ${(numero += 1)}`)}`);
  const touche = (cible, key) => {
    const e = new Event('keydown', { cancelable: true });
    Object.defineProperty(e, 'key', { value: key });
    cible.dispatchEvent(e);
  };
  const envoyer = (type, cible, detail) => {
    const e = new CustomEvent(type, { detail });
    Object.defineProperty(e, 'target', { value: cible });
    document.dispatchEvent(e);
  };
  const ouvrir = (cible, detail) => envoyer('onglets:ouvrir', cible, detail);
  const naviguer = (ancre) => {
    url = new URL(ancre, url);
    window.dispatchEvent(new Event('hashchange'));
  };
  const actifs = (...ids) => ids.filter((id) => o[id].classList.contains('is-active'));
  return { o, p, barres, racine, ecritures, touche, ouvrir, envoyer, naviguer, actifs, onglet, panneau, adresse: () => url.hash };
}

test('le script des onglets est dans la page construite', options, () => {
  assert.ok(script.includes('data-onglets-sans-adresse'));
});

test('choisir l’onglet d’une famille (clic, flèche) écrit son ancre #famille-<id> ; la barre de la page écrit la sienne', options, async () => {
  const p = await charger('#armes');
  assert.equal(cliquer(p.o['famille-dagues']).defaultPrevented, true);
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues'), ['famille-dagues']);
  assert.equal(p.adresse(), '#famille-dagues', '« On peut retenir l’onglet ouvert #epee par exemple »');
  p.touche(p.o['famille-dagues'], 'ArrowRight');
  assert.deepEqual(p.actifs('famille-dagues', 'famille-hache'), ['famille-hache']);
  assert.equal(p.adresse(), '#famille-hache');
  cliquer(p.o['famille-bombes']);
  assert.equal(p.adresse(), '#famille-bombes', 'l’autre menu aussi');
  cliquer(p.o.boucliers);
  assert.deepEqual(p.ecritures, ['#famille-dagues', '#famille-hache', '#famille-bombes', '#boucliers']);
});

test('l’option data-onglets-sans-adresse reste : un tel groupe n’écrit pas l’onglet choisi, les autres si', options, async () => {
  const p = await charger('#armes', { sansAdresse: true });
  cliquer(p.o['famille-dagues']);
  p.touche(p.o['famille-dagues'], 'ArrowRight');
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-hache']);
  assert.deepEqual(p.ecritures, [], 'le groupe sans adresse n’écrit rien');
  assert.equal(p.adresse(), '#armes');
  cliquer(p.o['famille-bombes']);
  assert.deepEqual(p.ecritures, ['#famille-bombes'], 'le menu sans l’option écrit le sien');
});

test('une adresse #famille-… au chargement ouvre l’onglet Armes puis la famille ; #boucliers ensuite ouvre Boucliers, la famille gardée', options, async () => {
  const p = await charger('#famille-dagues');
  assert.deepEqual(p.actifs('armes', 'boucliers'), ['armes']);
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-dagues']);
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes'), ['famille-arc'], 'l’autre menu ne change pas');
  assert.deepEqual(p.ecritures, [], 'le chargement n’écrit rien');
  p.naviguer('#boucliers');
  assert.deepEqual(p.actifs('armes', 'boucliers'), ['boucliers'], '#boucliers reste l’onglet de la page Équipement');
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-dagues']);
  p.naviguer('#famille-bombes');
  assert.deepEqual(p.actifs('armes', 'boucliers'), ['armes']);
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes'), ['famille-bombes']);
});

test('« onglets:brancher » ré-entrant : un onglet ajouté à un groupe branché est pris, l’onglet ouvert reste, aucun écouteur en double', options, async () => {
  const p = await charger('#armes');
  cliquer(p.o['famille-bombes']);
  // une famille créée en mode modification (src/scripts/edition/armes.mjs) : son onglet à la fin de la barre, son panneau après le dernier
  const onglet = p.onglet('famille-frondes', false);
  const panneau = p.panneau('famille-frondes', false, el('table', {}, el('tr', { id: 'arme-frondes' })));
  p.o['famille-frondes'] = onglet;
  p.barres.distance.append(onglet);
  p.p['famille-bombes'].after(panneau);
  p.envoyer('onglets:brancher', p.barres.distance);
  assert.equal(onglet.getAttribute('role'), 'tab');
  assert.equal(onglet.getAttribute('aria-controls'), 'famille-frondes');
  assert.equal(panneau.getAttribute('role'), 'tabpanel');
  assert.equal(panneau.getAttribute('aria-labelledby'), 'onglet-famille-frondes');
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes', 'famille-frondes'), ['famille-bombes'], 'l’onglet ouvert reste');
  assert.equal(onglet.getAttribute('aria-selected'), 'false');
  // le nouvel onglet se choisit et s'écrit dans l'adresse ; les anciens, une seule fois chacun
  p.ecritures.length = 0;
  cliquer(onglet);
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes', 'famille-frondes'), ['famille-frondes']);
  assert.equal(panneau.classList.contains('is-active'), true);
  assert.equal(p.p['famille-bombes'].classList.contains('is-active'), false);
  cliquer(p.o['famille-arc']);
  assert.deepEqual(p.ecritures, ['#famille-frondes', '#famille-arc'], 'un clic, une écriture');
  // les flèches et « onglets:ouvrir » le connaissent
  p.touche(p.o['famille-arc'], 'End');
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes', 'famille-frondes'), ['famille-frondes']);
  p.ouvrir(p.p['famille-arc']);
  p.ouvrir(panneau);
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes', 'famille-frondes'), ['famille-frondes']);
  // rebrancher sans rien d'ajouter ne change rien
  p.envoyer('onglets:brancher', p.racine);
  p.ecritures.length = 0;
  cliquer(p.o['famille-dagues']);
  assert.deepEqual(p.ecritures, ['#famille-dagues']);
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes', 'famille-frondes'), ['famille-frondes']);
});

test('les flèches, Début et Fin sautent un onglet caché (hidden)', options, async () => {
  const p = await charger();
  p.o['famille-dagues'].hidden = true;
  p.touche(p.o['famille-epees'], 'ArrowRight');
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-hache'], 'Dagues sautée');
  p.touche(p.o['famille-hache'], 'ArrowRight');
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-epees'], 'retour au premier affiché');
  p.touche(p.o['famille-epees'], 'ArrowLeft');
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-hache']);
  p.o['famille-hache'].hidden = true;
  p.touche(p.o['famille-hache'], 'ArrowRight');
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-hache'], 'depuis un onglet caché : rien');
  p.touche(p.o['famille-arc'], 'End');
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes'), ['famille-bombes']);
  p.touche(p.o['famille-bombes'], 'Home');
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes'), ['famille-arc']);
});

test('« onglets:ouvrir » : tous les niveaux, ou seulement les groupes dans detail.dans ; une adresse #famille-… ouvre l’onglet de la page et la famille', options, async () => {
  const p = await charger('#boucliers');
  assert.deepEqual(p.actifs('armes', 'boucliers'), ['boucliers']);
  // limité à l'onglet Armes : la famille s'ouvre, l'onglet de la page ne change pas
  p.ouvrir(p.p['famille-bombes'], { dans: p.racine });
  assert.deepEqual(p.actifs('famille-arc', 'famille-bombes'), ['famille-bombes']);
  assert.deepEqual(p.actifs('armes', 'boucliers'), ['boucliers']);
  // sans limite : tous les niveaux (une arme créée en mode modification)
  p.ouvrir(p.p['famille-dagues']);
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-dagues']);
  assert.deepEqual(p.actifs('armes', 'boucliers'), ['armes']);
  assert.deepEqual(p.ecritures, [], 'sans toucher à l’adresse');
  // une adresse partagée vers une famille (le lien #famille-bombes de la Ceinture, l'onglet retenu)
  const q = await charger('#famille-bombes');
  assert.deepEqual(q.actifs('armes', 'boucliers'), ['armes']);
  assert.deepEqual(q.actifs('famille-arc', 'famille-bombes'), ['famille-bombes']);
  assert.deepEqual(q.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-epees'], 'l’autre menu ne change pas');
});
