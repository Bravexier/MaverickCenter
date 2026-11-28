// Le script du menu latéral du site (components/MenuDuSite.astro, R319 (2)) : exécuté dans un faux navigateur, tel qu'écrit dans le composant (en ligne, sans import).
//   - écran étroit : le tiroir (bouton à trois barres, voile, page inerte, Échap, focus piégé et rendu, une rubrique touchée l'ouvre) ;
//   - le bouton réduit et rouvre le menu ; cliquer une rubrique de l'en-tête change la liste montrée sans changer de page, et rouvre un menu réduit ;
//   - une entrée à sous-pages se plie et se déplie, ouverte d'office si la page courante est dedans ;
//   - l'état (réduit, entrées repliées) est gardé en localStorage (`menu-du-site:etat`), le stockage absent ou illisible est toléré ;
//   - le menu démarre réduit, sans l'écrire, sur une page qui a déjà son menu de gauche et sur un écran étroit ;
//   - les animations ne commencent qu'après le premier affichage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const composant = readFileSync(new URL('../src/components/MenuDuSite.astro', import.meta.url), 'utf8');
const SCRIPT = composant.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
const CLE = 'menu-du-site:etat';

class Element {
  constructor(attributs = {}, parent = null) {
    this.attributs = new Map(Object.entries(attributs));
    this.parentNode = parent;
    this.ecouteurs = {};
    this.hidden = false;
    this.inert = false;
    this.focuse = 0;
  }
  getAttribute(n) { return this.attributs.has(n) ? this.attributs.get(n) : null; }
  setAttribute(n, v) { this.attributs.set(n, String(v)); }
  hasAttribute(n) { return this.attributs.has(n); }
  addEventListener(type, f) { (this.ecouteurs[type] ??= []).push(f); }
  emettre(type, evenement = {}) { for (const f of this.ecouteurs[type] ?? []) f(evenement); }
  clic(cible = this) { this.emettre('click', { target: cible }); }
  closest(sel) { return sel === 'a[href]' && this.lien ? this : null; }
  getClientRects() { return [1]; }
  focus() { this.focuse += 1; this.document.activeElement = this; }
  scrollIntoView() {}
}

/**
 * Un menu : deux rubriques (jeu, regles), une entrée à sous-pages `jeu/introduction` (contient la page quand `dedans`), une autre `regles/avancees` ; `proprePage` : la
 * page a son menu de gauche ; `etroit` : écran étroit ; `stockage` : le contenu de localStorage (`null` : absent, 'casse' : illisible, 'refuse' : il lève).
 */
function ouvrir({ stockage = {}, proprePage = false, etroit = false, dedans = false } = {}) {
  const document = { activeElement: null };
  const nouveau = (attributs, parent) => Object.assign(new Element(attributs, parent), { document });
  const menu = nouveau({ 'data-menu-site': '' });
  const bouton = nouveau({ 'data-menu-reduire': '', 'aria-expanded': 'true', 'aria-label': 'Réduire le menu latéral' }, menu);
  const burger = nouveau({ 'data-menu-burger': '', 'aria-expanded': 'false' });
  burger.hidden = true;
  const voile = nouveau({ 'data-menu-voile': '' });
  voile.hidden = true;
  const groupe = (cle, contient = false) => {
    const li = nouveau({ 'data-cle': cle, ...(contient ? { 'data-contient-la-page': '' } : {}) }, menu);
    const b = nouveau({ 'data-menu-replier': cle, 'aria-expanded': 'true' }, li);
    return { li, b };
  };
  const intro = groupe('jeu/introduction', dedans);
  const avancees = groupe('regles/avancees');
  const groupes = [intro, avancees];
  const titreJeu = nouveau({ 'data-group': 'jeu' }, menu);
  const titreRegles = nouveau({ 'data-group': 'regles' }, menu);
  titreRegles.hidden = true;
  const listeJeu = nouveau({ 'data-group': 'jeu' }, menu);
  const listeRegles = nouveau({ 'data-group': 'regles' }, menu);
  listeRegles.hidden = true;
  const lienDuMenu = nouveau({ href: '/races/' }, menu);
  lienDuMenu.lien = true;
  const courante = nouveau({ 'aria-current': 'page' }, menu);
  const rubriqueJeu = nouveau({ 'data-group': 'jeu', 'aria-pressed': 'true' });
  const rubriqueRegles = nouveau({ 'data-group': 'regles', 'aria-pressed': 'false' });
  const entete = nouveau({});
  entete.getBoundingClientRect = () => ({ bottom: 133 });
  entete.querySelectorAll = () => [burger, rubriqueJeu];
  menu.querySelector = (sel) => {
    if (sel === '[data-menu-reduire]') return bouton;
    if (sel === '[aria-current="page"]') return dedans ? courante : null;
    const m = sel.match(/^\[data-cle="([^"]+)"\]$/);
    return m ? groupes.find((g) => g.li.getAttribute('data-cle') === m[1])?.li ?? null : null;
  };
  menu.querySelectorAll = (sel) => (sel === '[data-menu-replier]' ? groupes.map((g) => g.b) : sel === '[data-group]' ? [titreJeu, titreRegles, listeJeu, listeRegles] : []);
  menu.getBoundingClientRect = () => ({ bottom: 800 });
  // le reste de la page, que le tiroir rend inerte
  const principal = nouveau({});
  const pied = nouveau({});
  const ecrits = [];
  const memoire = { ...stockage };
  const frames = [];
  const classes = new Set();
  const proprietes = {};
  const racine = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) }, style: { setProperty: (n, v) => { proprietes[n] = v; } } };
  const changements = [];
  const mq = { matches: etroit, addEventListener: (type, f) => changements.push(f) };
  const fenetre = {
    localStorage: stockage === null ? undefined : {
      getItem: (k) => {
        if (stockage === 'refuse') throw new Error('stockage refusé');
        return stockage === 'casse' ? '{pas du json' : memoire[k] ?? null;
      },
      setItem: (k, v) => { if (stockage === 'refuse') throw new Error('stockage refusé'); ecrits.push([k, v]); memoire[k] = v; },
    },
    matchMedia: () => mq,
    requestAnimationFrame: (f) => frames.push(f),
    getComputedStyle: () => ({ visibility: 'visible' }),
    addEventListener: () => {},
  };
  if (stockage === null) Object.defineProperty(fenetre, 'localStorage', { get() { throw new Error('pas de stockage'); } });
  const evenements = [];
  Object.assign(document, {
    documentElement: racine,
    querySelector: (sel) => {
      if (sel === '[data-menu-site]') return menu;
      if (sel === '[data-menu-burger]') return burger;
      if (sel === '[data-menu-voile]') return voile;
      if (sel === '.site-header') return entete;
      return sel.includes('main >') ? (proprePage ? nouveau({}) : null) : null;
    },
    querySelectorAll: (sel) => (sel === '.nav-group__toggle' ? [rubriqueJeu, rubriqueRegles] : sel.startsWith('.site-corps') ? [principal, pied] : []),
    addEventListener: (type, f) => { (document.ecouteurs ??= {})[type] ??= []; document.ecouteurs[type].push(f); },
    dispatchEvent: (e) => { evenements.push(e.type); for (const f of document.ecouteurs?.[e.type] ?? []) f(e); },
    emettre: (type, e = {}) => { for (const f of document.ecouteurs?.[type] ?? []) f(e); },
  });
  vm.runInNewContext(SCRIPT, { window: fenetre, document, Event: class { constructor(type) { this.type = type; } }, setTimeout: (f) => frames.push(f), Array });
  const etat = () => JSON.parse(memoire[CLE] ?? 'null');
  const affiche = () => ({ reduit: menu.getAttribute('data-reduit'), bouton: [bouton.getAttribute('aria-expanded'), bouton.getAttribute('aria-label')] });
  return {
    menu, bouton, burger, voile, intro, avancees, rubriqueJeu, rubriqueRegles, titreJeu, titreRegles, listeJeu, listeRegles, ecrits, etat, affiche, frames, principal, pied,
    document, classes, proprietes, evenements, changements, mq, lienDuMenu, courante, entete,
  };
}

test('R319 (2) : le bouton réduit puis rouvre le menu (aria-expanded et nom du bouton à jour) et l’état est gardé en localStorage', () => {
  const m = ouvrir();
  assert.deepEqual(m.affiche(), { reduit: 'non', bouton: ['true', 'Réduire le menu latéral'] }, 'ouvert au départ');
  m.bouton.clic();
  assert.deepEqual(m.affiche(), { reduit: 'oui', bouton: ['false', 'Afficher le menu latéral'] });
  assert.equal(m.etat().reduit, true, 'gardé d’une page à l’autre');
  m.bouton.clic();
  assert.deepEqual(m.affiche(), { reduit: 'non', bouton: ['true', 'Réduire le menu latéral'] });
  assert.equal(m.etat().reduit, false);
  // une autre page : l'état gardé est relu, sans rien écrire
  m.bouton.clic();
  const suite = ouvrir({ stockage: { [CLE]: JSON.stringify({ reduit: true, replie: [] }) } });
  assert.equal(suite.affiche().reduit, 'oui', 'réduit comme on l’avait laissé');
  assert.deepEqual(suite.ecrits, [], 'rien n’est écrit au chargement');
});

test('R319 (2) : cliquer une rubrique change la liste montrée (sans changer de page), marque la rubrique enfoncée, et rouvre un menu réduit', () => {
  const m = ouvrir({ stockage: { [CLE]: JSON.stringify({ reduit: true, replie: [] }) } });
  assert.equal(m.affiche().reduit, 'oui');
  m.rubriqueRegles.clic();
  assert.deepEqual([m.rubriqueJeu.getAttribute('aria-pressed'), m.rubriqueRegles.getAttribute('aria-pressed')], ['false', 'true'], 'la rubrique dont le menu est montré est enfoncée');
  assert.deepEqual([m.listeJeu.hidden, m.listeRegles.hidden, m.titreJeu.hidden, m.titreRegles.hidden], [true, false, true, false], 'la liste et le nom de la rubrique');
  assert.equal(m.affiche().reduit, 'non', 'rouvert');
  assert.equal(m.etat().reduit, false, 'et gardé');
  // une rubrique cliquée quand le menu est ouvert : il reste ouvert
  m.rubriqueJeu.clic();
  assert.deepEqual([m.listeJeu.hidden, m.listeRegles.hidden], [false, true]);
  assert.equal(m.affiche().reduit, 'non');
});

test('R319 (2) : une entrée à sous-pages se plie et se déplie, son état est gardé ; ouverte d’office quand la page courante est dedans', () => {
  const m = ouvrir();
  m.intro.b.clic();
  assert.deepEqual([m.intro.b.getAttribute('aria-expanded'), m.intro.li.getAttribute('data-replie')], ['false', 'oui']);
  assert.deepEqual(m.etat().replie, ['jeu/introduction']);
  m.avancees.b.clic();
  assert.deepEqual(m.etat().replie, ['jeu/introduction', 'regles/avancees']);
  m.intro.b.clic();
  assert.deepEqual([m.intro.b.getAttribute('aria-expanded'), m.intro.li.getAttribute('data-replie')], ['true', 'non']);
  assert.deepEqual(m.etat().replie, ['regles/avancees']);
  // une autre page : l'entrée gardée repliée l'est, sauf si la page courante est dedans
  const replie = JSON.stringify({ reduit: false, replie: ['jeu/introduction', 'regles/avancees'] });
  const ailleurs = ouvrir({ stockage: { [CLE]: replie } });
  assert.deepEqual([ailleurs.intro.li.getAttribute('data-replie'), ailleurs.avancees.li.getAttribute('data-replie')], ['oui', 'oui']);
  const dedans = ouvrir({ stockage: { [CLE]: replie }, dedans: true });
  assert.deepEqual([dedans.intro.li.getAttribute('data-replie'), dedans.intro.b.getAttribute('aria-expanded')], ['non', 'true'], 'ouverte d’office');
  assert.equal(dedans.avancees.li.getAttribute('data-replie'), 'oui');
  assert.deepEqual(dedans.ecrits, [], 'rien n’est écrit au chargement');
});

test('R319 (2) : sur une page qui a déjà son menu de gauche, et sur écran étroit, le menu démarre réduit sans que cela s’écrive ; la mémoire ne garde pas un choix fait là', () => {
  for (const [nom, options] of [['page à menu propre', { proprePage: true }], ['écran étroit', { etroit: true }]]) {
    const m = ouvrir({ ...options, stockage: { [CLE]: JSON.stringify({ reduit: false, replie: [] }) } });
    assert.equal(m.affiche().reduit, 'oui', `${nom} : réduit, quoi que dise la mémoire`);
    assert.deepEqual(m.ecrits, [], `${nom} : rien d’écrit`);
    m.bouton.clic();
    assert.equal(m.affiche().reduit, 'non', `${nom} : on peut l’ouvrir`);
    m.bouton.clic();
    m.rubriqueRegles.clic();
    assert.equal(m.affiche().reduit, 'non', `${nom} : une rubrique le rouvre`);
    assert.deepEqual(m.ecrits, [], `${nom} : ce choix n’est pas gardé (les autres pages gardent le leur)`);
    // mais les entrées repliées, elles, se gardent
    m.intro.b.clic();
    assert.equal(m.etat().reduit, false, `${nom} : la préférence de réduction n’a pas bougé`);
    assert.deepEqual(m.etat().replie, ['jeu/introduction']);
  }
});

test('le stockage absent, refusé ou illisible est toléré : le menu marche, ouvert, sans rien garder', () => {
  for (const stockage of [null, 'refuse', 'casse', { [CLE]: '"texte"' }, { [CLE]: JSON.stringify({ reduit: 'oui', replie: 'x' }) }]) {
    const m = ouvrir({ stockage });
    assert.equal(m.affiche().reduit, 'non', JSON.stringify(stockage));
    m.bouton.clic();
    assert.equal(m.affiche().reduit, 'oui', 'le bouton marche quand même');
    m.intro.b.clic();
    assert.equal(m.intro.li.getAttribute('data-replie'), 'oui');
  }
});

test('les animations ne commencent qu’après le premier affichage (le menu ne se referme pas sous les yeux au chargement)', () => {
  const m = ouvrir({ stockage: { [CLE]: JSON.stringify({ reduit: true, replie: [] }) } });
  assert.equal(m.menu.hasAttribute('data-anime'), false, 'au chargement : pas d’animation');
  assert.equal(m.frames.length, 1);
  m.frames.shift()();
  assert.equal(m.menu.hasAttribute('data-anime'), false, 'pas avant le second affichage');
  m.frames.shift()();
  assert.equal(m.menu.hasAttribute('data-anime'), true);
});

test('le script est en ligne dans le composant, sans import, et ne touche qu’à ce qu’il pose (skill site-version-portable)', () => {
  assert.doesNotMatch(SCRIPT, /\bimport\b|\brequire\(|\bfetch\(/);
  assert.match(composant, /<script is:inline>/);
  assert.ok(!/<script(?![^>]*is:inline)[^>]*>/.test(composant.replace(/<script is:inline>[\s\S]*?<\/script>/, '')), 'un seul script');
  assert.match(SCRIPT, /menu-du-site:etat/, 'la clé du localStorage (à dire sur la page Confidentialité)');
});

// --- le tiroir (écran étroit, R319 (2)) -----------------------------------------------------------------------------------------------------------

test('écran étroit : le bouton à trois barres est montré ; il ouvre le tiroir (page inerte, voile, défilement bloqué, sous l’en-tête), le focus va à l’entrée courante, ou au bouton de fermeture', () => {
  const m = ouvrir({ etroit: true });
  assert.equal(m.menu.hasAttribute('data-js'), true, 'le tiroir demande JavaScript : sans lui, le menu est un bloc ouvert');
  assert.equal(m.burger.hidden, false);
  assert.deepEqual([m.affiche().reduit, m.burger.getAttribute('aria-expanded'), m.voile.hidden, m.classes.has('menu-ouvert')], ['oui', 'false', true, false], 'fermé au départ');
  m.burger.clic();
  assert.deepEqual([m.affiche().reduit, m.burger.getAttribute('aria-expanded'), m.burger.getAttribute('aria-label')], ['non', 'true', 'Fermer le menu latéral']);
  assert.equal(m.voile.hidden, false);
  assert.equal(m.classes.has('menu-ouvert'), true, 'le défilement de la page est bloqué');
  assert.equal(m.proprietes['--entete-bas'], '133px', 'sous l’en-tête');
  assert.deepEqual([m.principal.inert, m.pied.inert], [true, true], 'le reste de la page est inerte');
  assert.equal(m.entete.inert, false, 'l’en-tête, dont les rubriques se touchent, ne l’est pas');
  assert.equal(m.bouton.focuse, 1, 'le focus au bouton de fermeture (pas d’entrée courante)');
  assert.equal(m.bouton.getAttribute('aria-label'), 'Fermer le menu latéral');
  assert.deepEqual(m.evenements, ['menu-du-site:tiroir-ouvert'], 'annoncé (le menu du profil se referme)');
  assert.deepEqual(m.ecrits, [], 'rien d’écrit : un tiroir n’est pas une préférence');
  const courante = ouvrir({ etroit: true, dedans: true });
  courante.burger.clic();
  assert.equal(courante.courante.focuse, 1, 'le focus sur l’entrée courante');
});

test('le tiroir se ferme par le bouton à trois barres, son bouton, le voile, Échap ou le choix d’une entrée, rend le focus au bouton qui l’a ouvert et libère la page', () => {
  const fermetures = [
    ['le bouton à trois barres', (m) => m.burger.clic()],
    ['son bouton', (m) => m.bouton.clic()],
    ['le voile', (m) => m.voile.clic()],
    ['Échap', (m) => m.document.emettre('keydown', { key: 'Escape' })],
    ['le choix d’une entrée', (m) => m.menu.emettre('click', { target: m.lienDuMenu })],
  ];
  for (const [nom, fermer] of fermetures) {
    const m = ouvrir({ etroit: true });
    m.burger.document.activeElement = m.burger;
    m.burger.clic();
    assert.equal(m.principal.inert, true, nom);
    fermer(m);
    assert.deepEqual([m.affiche().reduit, m.voile.hidden, m.classes.has('menu-ouvert'), m.principal.inert, m.pied.inert, m.burger.getAttribute('aria-expanded')], ['oui', true, false, false, false, 'false'], nom);
    assert.ok(m.burger.focuse >= 1, `${nom} : le focus revient au bouton`);
  }
  // une touche autre qu'Échap, ou Échap tiroir fermé : rien
  const m = ouvrir({ etroit: true });
  m.document.emettre('keydown', { key: 'Escape' });
  assert.equal(m.affiche().reduit, 'oui');
  m.burger.clic();
  m.document.emettre('keydown', { key: 'a' });
  assert.equal(m.affiche().reduit, 'non');
});

test('toucher une rubrique ouvre le tiroir sur sa liste ; le focus reste piégé dans l’en-tête et le tiroir (Tab boucle, Maj+Tab aussi)', () => {
  const m = ouvrir({ etroit: true });
  m.rubriqueRegles.clic();
  assert.equal(m.affiche().reduit, 'non', 'ouvert par la rubrique');
  assert.deepEqual([m.listeJeu.hidden, m.listeRegles.hidden], [true, false]);
  assert.equal(m.principal.inert, true);
  // le piège : Tab sur le dernier élément de l'ensemble en-tête + tiroir revient au premier
  const dedans = [m.burger, m.rubriqueJeu, m.bouton];
  m.entete.querySelectorAll = () => [m.burger, m.rubriqueJeu];
  m.menu.querySelectorAll = ((ancien) => (sel) => (sel.startsWith('a[href]') ? [m.bouton] : ancien(sel)))(m.menu.querySelectorAll);
  m.document.activeElement = m.bouton;
  let evite = 0;
  m.document.emettre('keydown', { key: 'Tab', shiftKey: false, preventDefault: () => { evite += 1; } });
  assert.deepEqual([evite, m.burger.focuse], [1, 1], 'après le dernier : le premier');
  m.document.activeElement = m.burger;
  m.document.emettre('keydown', { key: 'Tab', shiftKey: true, preventDefault: () => { evite += 1; } });
  assert.deepEqual([evite, m.bouton.focuse >= 1], [2, true], 'avant le premier : le dernier');
  m.document.activeElement = m.rubriqueJeu;
  m.document.emettre('keydown', { key: 'Tab', shiftKey: false, preventDefault: () => { evite += 1; } });
  assert.equal(evite, 2, 'au milieu : la tabulation suit son cours');
  assert.equal(dedans.length, 3);
});

test('le profil du compte s’ouvre : le tiroir se referme ; passage à un écran large : le tiroir se ferme et l’état gardé revient', () => {
  const m = ouvrir({ etroit: true });
  m.burger.clic();
  m.document.emettre('menu-du-profil:ouvert');
  assert.deepEqual([m.affiche().reduit, m.principal.inert], ['oui', false]);
  m.burger.clic();
  assert.equal(m.affiche().reduit, 'non');
  m.mq.matches = false;
  for (const f of m.changements) f();
  assert.deepEqual([m.affiche().reduit, m.classes.has('menu-ouvert'), m.principal.inert, m.voile.hidden], ['non', false, false, true], 'grand écran : le menu latéral ouvert (rien de gardé)');
  m.mq.matches = true;
  for (const f of m.changements) f();
  assert.equal(m.affiche().reduit, 'oui', 'étroit : le tiroir fermé');
});
