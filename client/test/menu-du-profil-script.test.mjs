// Le script en ligne du menu du profil (components/MenuDuProfil.astro, R319 (1)), exécuté dans un faux navigateur tel qu'écrit : le bouton ouvre et ferme le panneau
// (`aria-expanded`), Échap le ferme et rend le focus au bouton visible, un clic dehors ou le focus qui sort le ferme, le choix d'un lien le ferme ; il se ferme quand le
// tiroir du menu latéral s'ouvre, et annonce son ouverture à ce dernier (événement `menu-du-profil:ouvert`). Le bouton du compte connecté est créé après coup par
// scripts/compte.mjs : le clic est délégué.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const SCRIPT = readFileSync(new URL('../src/components/MenuDuProfil.astro', import.meta.url), 'utf8').match(/<script is:inline>([\s\S]*?)<\/script>/)[1];

class Element {
  constructor(attributs = {}, parent = null) { this.attributs = new Map(Object.entries(attributs)); this.parentNode = parent; this.ecouteurs = {}; this.hidden = false; this.enfants = []; this.focuse = 0; }
  getAttribute(n) { return this.attributs.has(n) ? this.attributs.get(n) : null; }
  setAttribute(n, v) { this.attributs.set(n, String(v)); }
  addEventListener(type, f) { (this.ecouteurs[type] ??= []).push(f); }
  contains(autre) { for (let e = autre; e; e = e.parentNode) if (e === this) return true; return false; }
  closest(sel) {
    const attr = sel.match(/^\[([a-z-]+)\]$/)?.[1];
    for (let e = this; e; e = e.parentNode) if ((attr && e.attributs.has(attr)) || (sel === 'a[href]' && e.etiquette === 'a' && e.attributs.has('href'))) return e;
    return null;
  }
  focus() { this.focuse += 1; }
  emettre(type, evenement) { for (const f of this.ecouteurs[type] ?? []) f(evenement); }
}

function monter() {
  const zone = new Element({ 'data-compte': '' });
  const panneau = new Element({}, zone);
  panneau.hidden = true;
  const petit = new Element({ 'data-profil-ouvrir': '', 'aria-expanded': 'false' }, zone);
  const lien = new Element({ href: '/regles/glossaire/' }, panneau);
  lien.etiquette = 'a';
  const dehors = new Element();
  zone.querySelector = (sel) => (sel === '.site-compte__panneau' ? panneau : null);
  const declencheurs = [petit];
  zone.querySelectorAll = (sel) => (sel === '[data-profil-ouvrir]' ? declencheurs : []);
  const document = new Element();
  document.querySelector = (sel) => (sel === '[data-compte]' ? zone : null);
  const evenements = [];
  document.dispatchEvent = (e) => { evenements.push(e.type); document.emettre(e.type, e); };
  vm.runInNewContext(SCRIPT, { document, Event: class { constructor(type) { this.type = type; } }, Array });
  const grand = new Element({ 'data-profil-ouvrir': '', 'aria-expanded': 'false' }, zone); // créé par scripts/compte.mjs après le chargement
  return { zone, panneau, petit, lien, dehors, document, evenements, grand, declencheurs,
    cliquer: (cible) => { const e = { target: cible }; zone.emettre('click', e); document.emettre('click', e); } };
}

test('le bouton ouvre et ferme le panneau (aria-expanded) et annonce l’ouverture ; un bouton créé après coup marche (clic délégué)', () => {
  const m = monter();
  assert.equal(m.panneau.hidden, true);
  m.cliquer(m.petit);
  assert.deepEqual([m.panneau.hidden, m.petit.getAttribute('aria-expanded')], [false, 'true']);
  assert.deepEqual(m.evenements, ['menu-du-profil:ouvert']);
  m.cliquer(m.petit);
  assert.deepEqual([m.panneau.hidden, m.petit.getAttribute('aria-expanded')], [true, 'false']);
  assert.equal(m.petit.focuse, 1, 'le focus revient au bouton');
  m.declencheurs.push(m.grand);
  m.cliquer(m.grand);
  assert.equal(m.panneau.hidden, false);
  assert.equal(m.grand.getAttribute('aria-expanded'), 'true');
});

test('Échap, un clic dehors, le focus qui sort et le choix d’un lien referment le panneau ; seul Échap rend le focus', () => {
  const m = monter();
  const ouvrir = () => { m.panneau.hidden = true; m.cliquer(m.petit); assert.equal(m.panneau.hidden, false); };
  ouvrir();
  m.document.emettre('keydown', { key: 'Escape' });
  assert.equal(m.panneau.hidden, true);
  assert.equal(m.petit.focuse, 1);
  ouvrir();
  m.document.emettre('keydown', { key: 'a' });
  assert.equal(m.panneau.hidden, false, 'une autre touche ne ferme pas');
  m.document.emettre('click', { target: m.dehors });
  assert.equal(m.panneau.hidden, true, 'clic dehors');
  assert.equal(m.petit.focuse, 1, 'sans rendre le focus');
  ouvrir();
  m.zone.emettre('focusout', { relatedTarget: m.dehors });
  assert.equal(m.panneau.hidden, true, 'le focus sort');
  ouvrir();
  m.zone.emettre('focusout', { relatedTarget: m.lien });
  assert.equal(m.panneau.hidden, false, 'le focus reste dans la zone');
  m.cliquer(m.lien);
  assert.equal(m.panneau.hidden, true, 'un lien choisi');
});

test('il se referme quand le tiroir du menu latéral s’ouvre', () => {
  const m = monter();
  m.cliquer(m.petit);
  m.document.emettre('menu-du-site:tiroir-ouvert', {});
  assert.equal(m.panneau.hidden, true);
  m.document.emettre('menu-du-site:tiroir-ouvert', {});
  assert.equal(m.panneau.hidden, true, 'déjà fermé : rien');
});
