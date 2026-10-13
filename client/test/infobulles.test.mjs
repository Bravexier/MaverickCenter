// Infobulles de tout le site (components/Infobulles.astro, demande du propriétaire : toutes habillées comme le reste du site) : le script, exécuté
// dans un faux navigateur, puis le site construit (une fois par page, habillage dans la feuille commune).
//   node --test test/infobulles.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SCRIPT = /<script is:inline data-infobulles>([\s\S]*?)<\/script>/;
const code = readFileSync(fileURLToPath(new URL('../src/components/Infobulles.astro', import.meta.url)), 'utf8').match(SCRIPT)[1];

/** Un faux navigateur, juste ce que le script emploie : un arbre d'éléments, des écouteurs, des minuteries qu'on fait avancer à la main.
 *  `page(Element, body)` : le contenu de la page, posé avant que le script ne tourne. */
function navigateur(page = () => {}) {
  class Noeud {}
  let guettes = [];
  class Element extends Noeud {
    constructor(tag, attributs = {}) {
      super();
      this.tagName = tag.toUpperCase();
      this.attributs = new Map(Object.entries(attributs));
      this.enfants = [];
      this.parentElement = null;
      this.hidden = false;
      this.textContent = '';
      this.focusVisible = false;
      this.vars = {};
      const proprietes = new Map();
      this.style = { setProperty: (p, v) => proprietes.set(p, v), removeProperty: (p) => proprietes.delete(p), get: (p) => proprietes.get(p) };
      this.classList = { contains: (c) => (this.getAttribute('class') ?? '').split(/\s+/).includes(c) };
    }
    get parentNode() { return this.parentElement; }
    get id() { return this.getAttribute('id') ?? ''; }
    set id(v) { this.setAttribute('id', v); }
    set className(v) { this.setAttribute('class', v); }
    get isConnected() {
      let n = this;
      while (n.parentElement) n = n.parentElement;
      return n === doc.documentElement;
    }
    getAttribute(n) { return this.attributs.has(n) ? this.attributs.get(n) : null; }
    hasAttribute(n) { return this.attributs.has(n); }
    setAttribute(n, v) { this.attributs.set(n, String(v)); this.changer(n); }
    removeAttribute(n) { if (this.attributs.delete(n)) this.changer(n); }
    changer(n) { for (const g of guettes) if (g.cible === this && g.filtre.includes(n)) queueMicrotask(() => g.rappel([])); }
    appendChild(e) {
      if (e.parentElement) e.parentElement.enfants.splice(e.parentElement.enfants.indexOf(e), 1);
      e.parentElement = this;
      this.enfants.push(e);
      return e;
    }
    contains(n) { for (let x = n; x; x = x.parentElement) if (x === this) return true; return false; }
    closest(sel) {
      assert.equal(sel, 'dialog[open]');
      for (let x = this; x; x = x.parentElement) if (x.tagName === 'DIALOG' && x.hasAttribute('open')) return x;
      return null;
    }
    matches(sel) { assert.equal(sel, ':focus-visible'); return this.focusVisible; }
    getBoundingClientRect() { return { left: 100, top: 100, right: 200, bottom: 120, width: 100, height: 20 }; }
    *tous() { yield this; for (const e of this.enfants) yield* e.tous(); }
  }
  const ecouteurs = { document: {}, window: {} };
  const ecouter = (ou) => (type, f, o) => (ecouteurs[ou][type] ??= []).push({ f, capture: o === true || o?.capture === true });
  const html = new Element('html');
  html.clientWidth = 1000;
  html.clientHeight = 800;
  const body = html.appendChild(new Element('body'));
  const doc = {
    documentElement: html,
    body,
    createElement: (tag) => new Element(tag),
    getElementById: (id) => [...html.tous()].find((e) => e.id === id) ?? null,
    querySelectorAll: (sel) => {
      assert.equal(sel, '[data-bulle][title]');
      return [...html.tous()].filter((e) => e.hasAttribute('data-bulle') && e.hasAttribute('title'));
    },
    addEventListener: ecouter('document'),
  };
  let minuteries = [];
  const contexte = {
    document: doc,
    Element,
    HTMLElement: Element,
    Node: Noeud,
    MutationObserver: class {
      constructor(rappel) { this.rappel = rappel; }
      observe(cible, o) { guettes.push({ cible, filtre: o.attributeFilter, rappel: this.rappel, de: this }); }
      disconnect() { guettes = guettes.filter((g) => g.de !== this); }
    },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: (e) => ({ getPropertyValue: (p) => e.vars[p] ?? '', backgroundColor: 'rgb(255, 253, 248)', borderTopColor: 'rgb(217, 204, 182)' }),
    setTimeout: (f) => minuteries.push(f),
    clearTimeout: (i) => { if (i) minuteries[i - 1] = null; },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    addEventListener: ecouter('window'),
    Date,
  };
  page(Element, body);
  vm.runInNewContext(code, contexte);
  return {
    Element,
    body,
    /** Un évènement : les écouteurs en capture, puis les autres, tant que personne n'arrête la propagation. */
    emettre(type, proprietes) {
      const e = { type, pointerType: 'mouse', clientX: 150, relatedTarget: null, ...proprietes, arrete: false, stopPropagation() { this.arrete = true; }, preventDefault() {} };
      const liste = ecouteurs.document[type] ?? [];
      for (const { f } of [...liste.filter((l) => l.capture), ...liste.filter((l) => !l.capture)]) if (!e.arrete) f(e);
      return e;
    },
    /** Fait passer le temps : les minuteries en attente (délai d'ouverture, fermeture différée) se déclenchent. */
    avancer() {
      const enCours = minuteries;
      minuteries = [];
      for (const f of enCours) f?.();
    },
    get bulle() { return doc.getElementById('bulle-du-titre'); },
  };
}

const ouverte = (b) => b !== null && !b.hidden;

test('un `title` : sa bulle après un délai, l’attribut retiré pendant l’affichage puis remis, la description câblée le temps de l’affichage', async () => {
  const n = navigateur();
  const cible = n.body.appendChild(new n.Element('span', { title: 'Dé de la famille', 'aria-describedby': 'aide' }));
  n.emettre('pointerover', { target: cible });
  assert.equal(n.bulle, null, 'rien avant le délai');
  n.avancer();
  assert.ok(ouverte(n.bulle));
  assert.equal(n.bulle.textContent, 'Dé de la famille');
  assert.equal(n.bulle.getAttribute('role'), 'tooltip');
  assert.equal(n.bulle.getAttribute('class'), 'bulle bulle--simple');
  assert.equal(cible.getAttribute('title'), null, 'sinon le navigateur montrerait aussi la sienne');
  assert.equal(cible.getAttribute('aria-describedby'), 'aide bulle-du-titre');
  // le pointeur passe sur la bulle : elle reste (WCAG 1.4.13)
  n.emettre('pointerout', { target: cible, relatedTarget: n.bulle });
  n.emettre('pointerover', { target: n.bulle });
  n.avancer();
  assert.ok(ouverte(n.bulle));
  n.emettre('pointerout', { target: n.bulle, relatedTarget: n.body });
  n.avancer();
  assert.ok(!ouverte(n.bulle));
  assert.equal(cible.getAttribute('title'), 'Dé de la famille', 'remis : les scripts qui le lisent le retrouvent');
  assert.equal(cible.getAttribute('aria-describedby'), 'aide');
  // juste après, un autre `title` s'ouvre aussitôt (comme l'infobulle du navigateur)
  const voisin = n.body.appendChild(new n.Element('td', { title: 'Portée' }));
  n.emettre('pointerover', { target: voisin });
  assert.ok(ouverte(n.bulle));
  assert.equal(n.bulle.textContent, 'Portée');
});

test('un `title` : un appui ou une touche ferme la bulle et rend l’attribut avant les gestionnaires de la page ; plus de bulle tant que le pointeur reste', () => {
  const n = navigateur();
  const bouton = n.body.appendChild(new n.Element('button', { title: 'Arme courbe' }));
  n.emettre('pointerover', { target: bouton });
  n.avancer();
  assert.ok(ouverte(n.bulle));
  n.emettre('pointerdown', { target: bouton });
  assert.ok(!ouverte(n.bulle));
  assert.equal(bouton.getAttribute('title'), 'Arme courbe', 'rendu avant le clic (armes.mjs lit la description dans `title`)');
  n.emettre('pointerover', { target: bouton });
  n.avancer();
  assert.ok(!ouverte(n.bulle), 'suspendue tant que le pointeur reste sur l’élément');
  n.emettre('pointerout', { target: bouton, relatedTarget: n.body });
  n.emettre('pointerover', { target: bouton });
  n.avancer();
  assert.ok(ouverte(n.bulle));
  const echap = n.emettre('keydown', { key: 'Escape' });
  assert.ok(!ouverte(n.bulle));
  assert.equal(echap.arrete, false, 'Échap garde son effet (fermer une fenêtre)');
  assert.equal(bouton.getAttribute('title'), 'Arme courbe');
});

test('un `title` changé par un script pendant l’affichage : la bulle prend le nouveau texte, l’attribut reste retiré, puis le nouveau est remis', async () => {
  const n = navigateur();
  const cible = n.body.appendChild(new n.Element('p', { title: 'Niveau 1' }));
  n.emettre('pointerover', { target: cible });
  n.avancer();
  cible.setAttribute('title', 'Niveau 2');
  await new Promise((ok) => setTimeout(ok, 0));
  assert.equal(n.bulle.textContent, 'Niveau 2');
  assert.equal(cible.getAttribute('title'), null);
  n.emettre('pointerout', { target: cible, relatedTarget: n.body });
  n.avancer();
  assert.equal(cible.getAttribute('title'), 'Niveau 2');
});

test('un `title` : rien au toucher (comme le navigateur) ; au clavier, au focus visible ; la teinte de la page ; dans une fenêtre modale', () => {
  const n = navigateur();
  const cible = n.body.appendChild(new n.Element('input', { title: 'Résultat du dé' }));
  cible.vars['--mag'] = '#1e90ff';
  n.emettre('pointerover', { target: cible, pointerType: 'touch' });
  n.avancer();
  assert.equal(n.bulle, null);
  n.emettre('focusin', { target: cible });
  assert.equal(n.bulle, null, 'focus à la souris : rien');
  cible.focusVisible = true;
  n.emettre('focusin', { target: cible });
  assert.ok(ouverte(n.bulle), 'focus clavier : aussitôt');
  assert.equal(n.bulle.style.get('--bulle-teinte'), '#1e90ff');
  n.emettre('focusout', { target: cible });
  assert.ok(!ouverte(n.bulle));
  const fenetre = n.body.appendChild(new n.Element('dialog', { open: '' }));
  const annuler = fenetre.appendChild(new n.Element('button', { title: 'Annuler (Échap)' }));
  n.emettre('pointerover', { target: annuler });
  n.avancer();
  assert.ok(ouverte(n.bulle));
  assert.equal(n.bulle.parentElement, fenetre, 'une fenêtre modale passe devant le reste : la bulle y va');
});

test('une bulle riche (`data-bulle`) : son `title` (repli sans JavaScript) retiré, aussitôt au survol ; Échap la ferme seule', () => {
  let pastille, bulle;
  const n = navigateur((Element, body) => {
    const zone = body.appendChild(new Element('span', { class: 'bulle-zone' }));
    pastille = zone.appendChild(new Element('a', { 'data-bulle': 'etat-1', title: 'Gel' }));
    bulle = zone.appendChild(new Element('span', { class: 'bulle', role: 'tooltip', id: 'etat-1' }));
    bulle.hidden = true;
  });
  assert.equal(pastille.getAttribute('title'), null, 'la bulle riche remplace l’infobulle native');
  n.emettre('pointerover', { target: pastille });
  assert.ok(!bulle.hidden, 'aussitôt');
  assert.equal(n.bulle, null, 'pas de bulle partagée');
  // passer sur la bulle (dans la page, à côté de sa pastille) ne la ferme pas
  n.emettre('pointerout', { target: pastille, relatedTarget: bulle });
  n.emettre('pointerover', { target: bulle });
  n.avancer();
  assert.ok(!bulle.hidden);
  const echap = n.emettre('keydown', { key: 'Escape' });
  assert.ok(bulle.hidden);
  assert.equal(echap.arrete, true, 'le panneau du sort reste ouvert');
  assert.equal(pastille.getAttribute('title'), null);
});

// ---- site construit -------------------------------------------------------------------------------------------------------------------------
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const options = existsSync(join(dist, 'index.html')) ? {} : { skip: 'site non construit (npm run build)' };
const walk = (dir) => readdirSync(dir).flatMap((nom) => (statSync(join(dir, nom)).isDirectory() ? walk(join(dir, nom)) : [join(dir, nom)]));

test('site construit : le script des infobulles une fois sur chaque page, en ligne ; plus d’autre gestionnaire de bulles', options, () => {
  const pages = walk(dist).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length > 100);
  for (const f of pages) {
    const html = readFileSync(f, 'utf8');
    const rel = relative(dist, f);
    assert.equal(html.match(/<script data-infobulles>/g)?.length, 1, `${rel} : une fois`);
    assert.equal(html.split("querySelectorAll('[data-bulle][title]')").length - 1, 1, `${rel} : un seul gestionnaire des bulles riches`);
  }
});

test('site construit : l’habillage des bulles est dans la feuille commune (toutes les pages), plus dans celle des pages de magie', options, () => {
  const css = readdirSync(join(dist, '_astro')).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dist, '_astro', f), 'utf8')).join('\n');
  const regle = (sel) => css.match(new RegExp(`(?:^|\\})${sel.replace(/[.[\]()]/g, '\\$&')}\\{([^}]*)\\}`))?.[1] ?? '';
  assert.match(regle('.bulle'), /border-left:3px solid var\(--bulle-teinte\)/, 'filet de couleur à gauche, comme les cartes');
  assert.match(regle('.bulle'), /font:[^;]*Georgia/, 'la police du site, pas celle du système');
  assert.match(regle('.bulle--simple'), /position:fixed/);
  assert.match(regle('.bulle-fleche'), /rotate\(45deg\)/);
  const magie = readFileSync(join(dist, 'magies', 'magie-de-la-glace', 'index.html'), 'utf8');
  assert.ok(!/\.bulle \{/.test(magie), 'pas de seconde définition de .bulle dans la page');
});
