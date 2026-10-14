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
 *  `page(Element, body)` : le contenu de la page, posé avant que le script ne tourne ; `tactile` : un écran sans survol (hover: none). */
function navigateur(page = () => {}, { tactile = false } = {}) {
  class Noeud {}
  let guettes = [];
  /** Un changement de la page, remis aux observateurs (MutationObserver) qui le guettent, en microtâche comme dans un navigateur. */
  const notifier = (changement) => {
    for (const g of guettes) {
      if (!g.cible.contains(changement.target) || (changement.type === 'attributes' && !g.filtre.includes(changement.attributeName))) continue;
      queueMicrotask(() => g.rappel([changement]));
    }
  };
  class Element extends Noeud {
    constructor(tag, attributs = {}) {
      super();
      this.nodeType = 1;
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
    setAttribute(n, v) { this.attributs.set(n, String(v)); notifier({ type: 'attributes', target: this, attributeName: n }); }
    removeAttribute(n) { if (this.attributs.delete(n)) notifier({ type: 'attributes', target: this, attributeName: n }); }
    /** `el.title = …`, comme dans un navigateur : l'attribut. */
    set title(v) { this.setAttribute('title', v); }
    appendChild(e) {
      if (e.parentElement) e.parentElement.enfants.splice(e.parentElement.enfants.indexOf(e), 1);
      e.parentElement = this;
      this.enfants.push(e);
      notifier({ type: 'childList', target: this, addedNodes: [e] });
      return e;
    }
    querySelectorAll(sel) {
      assert.equal(sel, '[title]');
      return [...this.tous()].filter((e) => e !== this && e.hasAttribute('title'));
    }
    contains(n) { for (let x = n; x; x = x.parentElement) if (x === this) return true; return false; }
    closest(sel) {
      assert.equal(sel, 'dialog[open]');
      for (let x = this; x; x = x.parentElement) if (x.tagName === 'DIALOG' && x.hasAttribute('open')) return x;
      return null;
    }
    matches(sel) {
      if (sel === ':hover') return this.survol === true;
      assert.equal(sel, ':focus-visible');
      return this.focusVisible;
    }
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
      assert.equal(sel, 'body [title]');
      return body.querySelectorAll('[title]');
    },
    addEventListener: ecouter('document'),
    activeElement: null,
  };
  let minuteries = [];
  const contexte = {
    document: doc,
    Element,
    HTMLElement: Element,
    Node: Noeud,
    MutationObserver: class {
      constructor(rappel) { this.rappel = rappel; }
      observe(cible, o) {
        assert.ok(o.subtree && o.childList && o.attributes, 'toute la page : les attributs posés et les éléments ajoutés');
        guettes.push({ cible, filtre: o.attributeFilter, rappel: this.rappel, de: this });
      }
      disconnect() { guettes = guettes.filter((g) => g.de !== this); }
    },
    matchMedia: () => ({ matches: tactile }),
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
    get fleche() { return [...body.tous()].find((e) => e.getAttribute('class') === 'bulle-fleche') ?? null; },
    document: doc,
  };
}

const ouverte = (b) => b !== null && !b.hidden;
/** Laisse passer les microtâches : les rappels de l'observateur de la page. */
const microtaches = () => new Promise((ok) => setTimeout(ok, 0));
/** Aucun `title` dans la page : le navigateur n'a rien à afficher. */
const sansTitle = (n) => assert.deepEqual(n.body.querySelectorAll('[title]').map((e) => e.tagName), [], 'aucun `title` : jamais l’infobulle du navigateur');

test('jamais l’infobulle du navigateur : tout `title` déplacé dans `data-infobulle`, au chargement et dès qu’un script en pose un', async () => {
  let texte, bouton, feuille, pastille;
  const n = navigateur((Element, body) => {
    texte = body.appendChild(new Element('span', { title: 'Dé de la famille' }));
    bouton = body.appendChild(new Element('button', { title: 'Ajouter de l’XP', 'aria-label': 'Ajouter de l’XP' }));
    feuille = body.appendChild(new Element('style', { title: 'autre thème' }));
    pastille = body.appendChild(new Element('a', { 'data-bulle': 'etat-1', title: 'Gel' }));
  });
  assert.equal(texte.getAttribute('title'), null);
  assert.equal(texte.getAttribute('data-infobulle'), 'Dé de la famille', 'le texte, pour la bulle habillée et les scripts qui le lisent');
  assert.equal(texte.getAttribute('aria-description'), 'Dé de la famille', 'toujours une description pour les lecteurs d’écran');
  assert.equal(bouton.getAttribute('aria-description'), null, 'pas de description qui redit le nom');
  assert.equal(feuille.getAttribute('title'), 'autre thème', 'le `title` d’une feuille de style n’est pas une infobulle');
  assert.equal(pastille.getAttribute('title'), null, 'bulle riche : son repli sans JavaScript retiré');
  assert.equal(pastille.getAttribute('data-infobulle'), null);
  // un script pose un `title` (la fiche recalcule les siens), ajoute un élément qui en porte, ou en vide un
  texte.title = 'Dé de la Force';
  const ligne = n.body.appendChild(new n.Element('tr', { title: 'Arme de départ' }));
  const nom = ligne.appendChild(new n.Element('button', { title: 'Une arme courbe' }));
  await microtaches();
  n.body.enfants.filter((e) => e !== feuille).forEach((e) => assert.equal(e.getAttribute('title'), null));
  assert.equal(nom.getAttribute('title'), null);
  assert.equal(texte.getAttribute('data-infobulle'), 'Dé de la Force');
  assert.equal(ligne.getAttribute('data-infobulle'), 'Arme de départ');
  assert.equal(nom.getAttribute('data-infobulle'), 'Une arme courbe');
  nom.title = '';
  await microtaches();
  assert.equal(nom.getAttribute('data-infobulle'), '', 'vidé : plus d’infobulle');
  assert.equal(nom.getAttribute('aria-description'), null);
});

test('un `title` : sa bulle habillée après un délai, qui reste quand le pointeur passe dessus ; aussitôt pour la voisine ; un `title` vide masque celui du parent', async () => {
  let cible, ligne, vide;
  const n = navigateur((Element, body) => {
    cible = body.appendChild(new Element('span', { title: 'Dé de la famille' }));
    ligne = body.appendChild(new Element('tr', { title: 'Arme de départ' }));
    vide = ligne.appendChild(new Element('td', { title: '' }));
  });
  n.emettre('pointerover', { target: cible });
  assert.equal(n.bulle, null, 'rien avant le délai');
  n.avancer();
  assert.ok(ouverte(n.bulle));
  assert.equal(n.bulle.textContent, 'Dé de la famille');
  assert.equal(n.bulle.getAttribute('role'), 'tooltip');
  assert.equal(n.bulle.getAttribute('class'), 'bulle bulle--simple');
  // le pointeur passe sur la bulle : elle reste (WCAG 1.4.13)
  n.emettre('pointerout', { target: cible, relatedTarget: n.bulle });
  n.emettre('pointerover', { target: n.bulle });
  n.avancer();
  assert.ok(ouverte(n.bulle));
  n.emettre('pointerout', { target: n.bulle, relatedTarget: n.body });
  n.avancer();
  assert.ok(!ouverte(n.bulle));
  // juste après, une autre s'ouvre aussitôt (comme l'infobulle du navigateur)
  n.emettre('pointerover', { target: ligne });
  assert.ok(ouverte(n.bulle));
  assert.equal(n.bulle.textContent, 'Arme de départ');
  n.emettre('pointerout', { target: ligne, relatedTarget: n.body });
  n.avancer();
  n.avancer();
  n.emettre('pointerover', { target: vide });
  n.avancer();
  assert.ok(!ouverte(n.bulle), 'title="" : pas l’infobulle de la ligne');
  await microtaches();
  sansTitle(n);
});

test('un `title` : un appui ou une touche ferme la bulle ; plus de bulle tant que le pointeur reste ; Échap garde son effet ; jamais de `title` remis', async () => {
  let bouton;
  const n = navigateur((Element, body) => { bouton = body.appendChild(new Element('button', { title: 'Arme courbe' })); });
  n.emettre('pointerover', { target: bouton });
  n.avancer();
  assert.ok(ouverte(n.bulle));
  n.emettre('pointerdown', { target: bouton });
  assert.ok(!ouverte(n.bulle));
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
  await microtaches();
  sansTitle(n);
  assert.equal(bouton.getAttribute('data-infobulle'), 'Arme courbe');
});

test('un `title` changé par un script pendant l’affichage : la bulle prend le nouveau texte ; vidé, elle se ferme', async () => {
  let cible;
  const n = navigateur((Element, body) => { cible = body.appendChild(new Element('p', { title: 'Niveau 1' })); });
  n.emettre('pointerover', { target: cible });
  n.avancer();
  cible.title = 'Niveau 2';
  await microtaches();
  assert.equal(n.bulle.textContent, 'Niveau 2');
  assert.ok(ouverte(n.bulle));
  cible.title = '';
  await microtaches();
  assert.ok(!ouverte(n.bulle));
  sansTitle(n);
});

test('un `title` : rien au toucher (comme le navigateur) ; au clavier, au focus visible ; la teinte de la page ; dans une fenêtre modale', async () => {
  let cible;
  const n = navigateur((Element, body) => { cible = body.appendChild(new Element('input', { title: 'Résultat du dé' })); });
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
  await microtaches();
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

test('la carte d’une créature (`data-placement="cote"`, `data-fermer-au-toucher`) : à côté de son nom, pointe de côté ; un clic dedans ne la ferme pas ; elle défile au clavier', () => {
  let nom, carte;
  const page = (Element, body) => {
    nom = body.appendChild(new Element('button', { 'data-bulle': 'bulle-creature-noye', title: 'Santé : 20/NPM' }));
    carte = body.appendChild(new Element('div', { class: 'bulle bulle--carte', role: 'tooltip', id: 'bulle-creature-noye', 'data-placement': 'cote', 'data-fermer-au-toucher': '' }));
    carte.hidden = true;
  };
  const n = navigateur(page);
  n.emettre('pointerover', { target: nom });
  assert.ok(!carte.hidden);
  // le faux navigateur donne à tout élément le rectangle 100–200 × 100–120 dans une fenêtre de 1000 × 800 : la place est à droite
  assert.equal(carte.style.left, '209px', 'à droite du nom, la place de la pointe entre les deux');
  assert.equal(n.fleche.getAttribute('data-cote'), 'droite');
  assert.ok(!n.fleche.hidden);
  // un clic dans la carte (le focus quitte le nom) ne la ferme pas tant que le pointeur est dessus
  carte.survol = true;
  n.emettre('focusout', { target: nom });
  n.emettre('click', { target: carte });
  assert.ok(!carte.hidden);
  carte.survol = false;
  n.emettre('pointerout', { target: carte, relatedTarget: n.body });
  n.avancer();
  assert.ok(carte.hidden, 'le pointeur qui la quitte la ferme');
  // au clavier : plus haute que sa place, elle défile (flèches, pages, début, fin) au lieu de la page, tant que son nom a le focus
  nom.focusVisible = true;
  n.emettre('focusin', { target: nom });
  n.document.activeElement = nom;
  const defile = [];
  Object.assign(carte, { scrollHeight: 1200, clientHeight: 700, scrollBy: (o) => defile.push(o.top) });
  const bas = n.emettre('keydown', { key: 'ArrowDown' });
  assert.deepEqual(defile, [40]);
  assert.equal(bas.arrete, true, 'la page ne défile pas');
  n.emettre('keydown', { key: 'End' });
  assert.deepEqual(defile, [40, 1200]);
  n.emettre('keydown', { key: 'Tab' });
  assert.equal(defile.length, 2, 'les autres touches ne la font pas défiler');
  assert.ok(!carte.hidden);
  // au toucher, un appui dans la carte (qui couvre presque l'écran d'un téléphone) la ferme
  const t = navigateur(page, { tactile: true });
  t.emettre('click', { target: nom });
  assert.ok(!carte.hidden);
  t.emettre('click', { target: carte });
  assert.ok(carte.hidden);
});

test('un `title` dont le déclencheur porte `data-placement="cote"` : la bulle partagée à côté de lui, pointe de côté (chevrons de la chronologie) ; le suivant, sans l’attribut, dessous', async () => {
  const n = navigateur();
  const chevron = n.body.appendChild(new n.Element('a', { title: 'An 500 : Quatrième porteur d’Excalibur : Dreya', 'data-placement': 'cote' }));
  await microtaches(); // le `title` de l'élément ajouté passe dans `data-infobulle`
  n.emettre('pointerover', { target: chevron });
  n.avancer();
  assert.ok(ouverte(n.bulle));
  assert.equal(n.bulle.textContent, 'An 500 : Quatrième porteur d’Excalibur : Dreya');
  // le faux navigateur donne à tout élément le rectangle 100–200 × 100–120 dans une fenêtre de 1000 × 800 : la place est à droite
  assert.equal(n.bulle.style.left, '209px', 'à côté du déclencheur, pas dessous');
  assert.equal(n.fleche.getAttribute('data-cote'), 'droite');
  n.emettre('pointerout', { target: chevron, relatedTarget: n.body });
  n.avancer();
  assert.ok(!ouverte(n.bulle));
  const autre = n.body.appendChild(new n.Element('span', { title: 'Portée' }));
  await microtaches();
  n.emettre('pointerover', { target: autre });
  assert.ok(ouverte(n.bulle));
  assert.equal(n.fleche.getAttribute('data-cote'), 'dessous', 'la bulle partagée ne garde pas le placement du déclencheur précédent');
  sansTitle(n);
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
    assert.equal(html.split("querySelectorAll('body [title]')").length - 1, 1, `${rel} : un seul gestionnaire des infobulles`);
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
