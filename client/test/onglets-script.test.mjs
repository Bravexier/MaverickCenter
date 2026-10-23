// Le script des onglets partagés (components/Onglets.astro), tel que le build l'écrit dans la page Équipement (dist/ : se saute sans le site construit,
// npm run build), exécuté dans un faux navigateur (test/aide-faux-dom.mjs) : choisir un onglet écrit son ancre dans l'adresse, sauf dans un groupe
// `data-onglets-sans-adresse` (les deux menus des familles d'armes : demande du propriétaire, 2026-10-23) ; les flèches, Début et Fin sautent un onglet
// caché (`hidden` : une famille d'armes que le filtre vide) ; « onglets:ouvrir » ouvre tous les niveaux qui contiennent l'élément, ou seulement les
// groupes dont les panneaux sont dans `detail.dans` (src/scripts/armes.mjs : l'onglet de la famille d'une arme, sans changer l'onglet de la page).
// Le faux navigateur ne fait pas remonter les évènements : un clic ou une touche s'envoie sur l'onglet, « onglets:ouvrir » sur le document, sa cible
// posée à la main.
//   node --test test/onglets-script.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cliquer, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const fichier = fileURLToPath(new URL('../dist/ressources/equipement/index.html', import.meta.url));
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
// le script des onglets, écrit en ligne dans la page (un seul : test/equipement-html.test.mjs)
const script = present ? [...readFileSync(fichier, 'utf8').matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('onglets:brancher')) : '';

// ce que le script lit d'un lien et d'un élément, absent du faux navigateur
Object.defineProperties(Element.prototype, {
  hash: { get() { return (this.getAttribute('href') ?? '').replace(/^[^#]*/, ''); } },
  pathname: { get() { return '/ressources/equipement/'; } },
  isConnected: { get() { return true; } },
});

let numero = 0;

/**
 * La page : la barre « Équipement » (Armes, Boucliers) ; dans Armes, deux menus sans adresse (mêlée : Épées, Dagues, Hache ; distance : Arc, Bombes),
 * dont Épées et Arc ouverts ; l'adresse `hash` au chargement. Rend les onglets, les panneaux et l'adresse écrite.
 */
async function charger(hash = '') {
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
  const racine = el('div', { 'data-armes': '' },
    el('nav', { 'data-onglets': 'Armes de mêlée', 'data-onglets-sans-adresse': '' }, o['famille-epees'], o['famille-dagues'], o['famille-hache']),
    p['famille-epees'], p['famille-dagues'], p['famille-hache'],
    el('nav', { 'data-onglets': 'Armes à distance', 'data-onglets-sans-adresse': '' }, o['famille-arc'], o['famille-bombes']),
    p['famille-arc'], p['famille-bombes']);
  p.armes = panneau('armes', true, racine);
  p.boucliers = panneau('boucliers', false);
  const document = fauxDocument(el('nav', { 'data-onglets': 'Équipement' }, o.armes, o.boucliers), p.armes, p.boucliers);
  let url = new URL(`/ressources/equipement/${hash}`, 'http://site/');
  const ecritures = [];
  Object.assign(globalThis, {
    document,
    Element,
    HTMLElement: Element,
    window: new EventTarget(),
    location: { get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { state: null, replaceState: (_, __, a) => { ecritures.push(a); url = new URL(a, url); } },
  });
  await import(`data:text/javascript,${encodeURIComponent(`${script}\n// ${(numero += 1)}`)}`);
  const touche = (cible, key) => {
    const e = new Event('keydown', { cancelable: true });
    Object.defineProperty(e, 'key', { value: key });
    cible.dispatchEvent(e);
  };
  const ouvrir = (cible, detail) => {
    const e = new CustomEvent('onglets:ouvrir', { detail });
    Object.defineProperty(e, 'target', { value: cible });
    document.dispatchEvent(e);
  };
  const actifs = (...ids) => ids.filter((id) => o[id].classList.contains('is-active'));
  return { o, p, racine, ecritures, touche, ouvrir, actifs, adresse: () => url.hash };
}

test('le script des onglets est dans la page construite', options, () => {
  assert.ok(script.includes('data-onglets-sans-adresse'));
});

test('un groupe sans adresse : choisir un onglet (clic, flèche) ne l’écrit pas ; les autres groupes écrivent leur ancre', options, async () => {
  const p = await charger('#armes');
  assert.equal(cliquer(p.o['famille-dagues']).defaultPrevented, true);
  assert.deepEqual(p.actifs('famille-epees', 'famille-dagues'), ['famille-dagues']);
  p.touche(p.o['famille-dagues'], 'ArrowRight');
  assert.deepEqual(p.actifs('famille-dagues', 'famille-hache'), ['famille-hache']);
  assert.deepEqual(p.ecritures, [], 'l’onglet de la famille n’est pas écrit');
  assert.equal(p.adresse(), '#armes');
  cliquer(p.o.boucliers);
  assert.deepEqual(p.ecritures, ['#boucliers'], 'la barre de la page écrit le sien');
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
  // une adresse partagée vers une famille (le lien #famille-bombes de la Ceinture)
  const q = await charger('#famille-bombes');
  assert.deepEqual(q.actifs('armes', 'boucliers'), ['armes']);
  assert.deepEqual(q.actifs('famille-arc', 'famille-bombes'), ['famille-bombes']);
  assert.deepEqual(q.actifs('famille-epees', 'famille-dagues', 'famille-hache'), ['famille-epees'], 'l’autre menu ne change pas');
});
