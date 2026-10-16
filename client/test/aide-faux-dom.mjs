// Un faux navigateur minimal pour exécuter un script de page dans les tests (test/recherche-script.test.mjs, test/edition-mots-cles.test.mjs,
// test/accessoires-script.test.mjs, test/edition-panneaux.test.mjs…) : des éléments avec attributs, enfants (éléments et nœuds de texte, dans l'ordre)
// et écouteurs (EventTarget de Node), et les sélecteurs dont ces scripts se servent — « li », « #id », « .classe », « [attr] », « [attr="valeur"] »,
// leurs combinaisons sans espace, le descendant « a b », la liste « a, b » (une valeur d'attribut peut porter espaces et virgules :
// test/aide-faux-dom.test.mjs) et « :scope > … » (les enfants directs, dans querySelectorAll) ; un attribut se compare entier (« = ») ou par son
// contenu (« *= », « ^= », « $= »). `innerHTML`, `outerHTML` et `insertAdjacentHTML` lisent le HTML avec parse5 (le lecteur HTML de
// hast-util-from-html, dépendance de @astrojs/markdown-remark, le processeur Markdown du site), comme un navigateur le ferait ; `innerHTML` relu écrit
// un HTML simple (attributs entre guillemets doubles, texte échappé). `domVivant(document)` y ajoute ce qu'un script qui suit la page emploie
// (src/scripts/edition/mots-cles-vivants.mjs, test/mots-cles-vivants.test.mjs) : createTreeWalker (les nœuds de texte), NodeFilter et MutationObserver
// (ajouts d'enfants, attributs, textes : remis à la microtâche suivante, comme un navigateur, même pour une valeur qui ne change pas).
import { parseFragment } from 'parse5';

/** `selecteur` découpé là où `separe(caractère)`, hors des […] et des guillemets ; morceaux sans espaces autour, vides retirés. */
function decouper(selecteur, separe) {
  const morceaux = [''];
  let crochets = 0;
  let guillemet = null;
  for (const c of selecteur) {
    if (guillemet) {
      if (c === guillemet) guillemet = null;
    } else if (c === '"' || c === "'") guillemet = c;
    else if (c === '[') crochets += 1;
    else if (c === ']') crochets -= 1;
    else if (crochets === 0 && separe(c)) {
      morceaux.push('');
      continue;
    }
    morceaux[morceaux.length - 1] += c;
  }
  return morceaux.map((m) => m.trim()).filter(Boolean);
}

const VIDES = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const echapperTexte = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
const echapperAttribut = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/ /g, '&nbsp;');

/** Un nœud de texte. */
export class Texte {
  constructor(valeur) {
    this.nodeType = 3;
    this.valeur = String(valeur);
    this.parentElement = null;
  }
  get nodeValue() { return this.valeur; }
  set nodeValue(v) {
    this.valeur = String(v);
    notifier(this, { type: 'characterData', target: this });
  }
  get textContent() { return this.nodeValue; }
  set textContent(v) { this.nodeValue = String(v); }
  get parentNode() { return this.parentElement; }
  get isConnected() { return Boolean(this.parentElement?.isConnected); }
  remove() {
    this.parentElement?.retirer(this);
  }
  replaceWith(...noeuds) {
    const parent = this.parentElement;
    if (!parent) return;
    for (const n of noeuds) parent.insertBefore(typeof n === 'string' ? new Texte(n) : n, this);
    this.remove();
  }
}

/** La racine d'un nœud (le document, si le nœud y est attaché). */
const racineDe = (n) => {
  let e = n;
  while (e.parentElement) e = e.parentElement;
  return e;
};
/** Un changement du faux DOM, remis aux observateurs (domVivant) dont la cible contient le nœud changé. */
function notifier(noeud, enregistrement) {
  const observateurs = racineDe(noeud).observateurs;
  if (!observateurs?.size) return;
  for (const o of observateurs) o.noter(noeud, enregistrement);
}

/** Les nœuds lus dans un HTML (parse5), en éléments et textes de ce faux DOM ; les commentaires sont laissés. */
function depuisParse5(n) {
  if (n.nodeName === '#text') return new Texte(n.value);
  if (!n.tagName) return null;
  const e = new Element(n.tagName, Object.fromEntries(n.attrs.map((a) => [a.name, a.value])));
  const cible = e.content ?? e;
  for (const c of (n.tagName === 'template' ? n.content.childNodes : n.childNodes)) {
    const x = depuisParse5(c);
    if (x) cible.append(x);
  }
  return e;
}
const analyser = (html) => parseFragment(String(html ?? '')).childNodes.map(depuisParse5).filter(Boolean);

/** Un élément : attributs, enfants, texte, dataset, et les méthodes du DOM que les scripts emploient. */
export class Element extends EventTarget {
  constructor(tag, attributs = {}, enfants = []) {
    super();
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attributs = new Map(Object.entries(attributs).map(([k, v]) => [k, String(v)]));
    this.noeuds = [];
    this.parentElement = null;
    this.disabled = false;
    this.value = '';
    if (this.tagName === 'TEMPLATE') this.content = new Element('fragment');
    const soi = this;
    const attribut = (nom) => `data-${String(nom).replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`;
    this.dataset = new Proxy({}, {
      get: (_, nom) => soi.getAttribute(attribut(nom)) ?? undefined,
      set: (_, nom, valeur) => (soi.setAttribute(attribut(nom), String(valeur)), true),
      deleteProperty: (_, nom) => (soi.removeAttribute(attribut(nom)), true),
    });
    const classes = () => (soi.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    this.classList = {
      contains: (c) => classes().includes(c),
      add: (...c) => soi.setAttribute('class', [...new Set([...classes(), ...c])].join(' ')),
      remove: (...c) => soi.setAttribute('class', classes().filter((x) => !c.includes(x)).join(' ')),
      toggle: (c, oui = !classes().includes(c)) => {
        if (oui) soi.classList.add(c);
        else soi.classList.remove(c);
        return oui;
      },
    };
    this.append(...enfants);
  }
  get id() { return this.getAttribute('id') ?? ''; }
  set id(v) { this.setAttribute('id', v); }
  set className(v) { this.setAttribute('class', v); }
  get className() { return this.getAttribute('class') ?? ''; }
  set href(v) { this.setAttribute('href', v); }
  get href() { return this.getAttribute('href'); }
  set title(v) { this.setAttribute('title', v); }
  get title() { return this.getAttribute('title') ?? ''; }
  /** `hidden` suit l'attribut, comme dans un navigateur. */
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) {
    if (v) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }
  /** `open` (d'un `<details>`) suit l'attribut, comme dans un navigateur. */
  get open() { return this.hasAttribute('open'); }
  set open(v) {
    if (v) this.setAttribute('open', '');
    else this.removeAttribute('open');
  }
  /** Les enfants éléments, dans l'ordre (une copie). */
  get children() { return this.noeuds.filter((n) => n instanceof Element); }
  /** Tous les enfants, textes compris, dans l'ordre (une copie). */
  get childNodes() { return [...this.noeuds]; }
  get firstElementChild() { return this.children[0] ?? null; }
  get parentNode() { return this.parentElement; }
  get nextElementSibling() {
    const freres = this.parentElement?.children ?? [];
    return freres[freres.indexOf(this) + 1] ?? null;
  }
  get previousElementSibling() {
    const freres = this.parentElement?.children ?? [];
    return freres[freres.indexOf(this) - 1] ?? null;
  }
  /** [{ name, value }] (arbreDuDom de lib/markdown-edition.mjs les lit). */
  get attributes() { return [...this.attributs].map(([name, value]) => ({ name, value })); }
  get isConnected() {
    let e = this;
    while (e.parentElement) e = e.parentElement;
    return e.tagName === 'HTML';
  }
  get textContent() { return this.noeuds.map((n) => n.textContent).join(''); }
  set textContent(v) {
    for (const n of this.noeuds) n.parentElement = null;
    this.noeuds = [];
    if (String(v)) this.append(String(v));
  }
  get innerHTML() { return this.noeuds.map(serialiser).join(''); }
  set innerHTML(html) {
    const cible = this.content ?? this;
    cible.textContent = '';
    cible.append(...analyser(html));
  }
  get outerHTML() { return serialiser(this); }
  set outerHTML(html) {
    if (this.parentElement) this.replaceWith(...analyser(html));
  }
  insertAdjacentHTML(position, html) {
    const noeuds = analyser(html);
    if (position === 'beforeend') this.append(...noeuds);
    else if (position === 'afterbegin') for (const n of noeuds.reverse()) this.insertBefore(n, this.noeuds[0] ?? null);
    else if (position === 'beforebegin') this.before(...noeuds);
    else if (position === 'afterend') this.after(...noeuds);
    else throw new Error(`insertAdjacentHTML : position inconnue ${position}`);
  }
  getAttribute(nom) { return this.attributs.has(nom) ? this.attributs.get(nom) : null; }
  setAttribute(nom, valeur) {
    this.attributs.set(nom, String(valeur));
    notifier(this, { type: 'attributes', target: this, attributeName: nom });
  }
  hasAttribute(nom) { return this.attributs.has(nom); }
  removeAttribute(nom) {
    if (!this.attributs.delete(nom)) return;
    notifier(this, { type: 'attributes', target: this, attributeName: nom });
  }
  /** Retire l'enfant `n` (texte ou élément). */
  retirer(n) {
    const i = this.noeuds.indexOf(n);
    if (i >= 0) this.noeuds.splice(i, 1);
    n.parentElement = null;
  }
  append(...noeuds) {
    for (const n of noeuds) {
      const noeud = typeof n === 'string' ? new Texte(n) : n;
      noeud.remove();
      noeud.parentElement = this;
      this.noeuds.push(noeud);
      notifier(this, { type: 'childList', target: this, addedNodes: [noeud] });
    }
  }
  replaceChildren(...noeuds) {
    this.textContent = '';
    this.append(...noeuds);
  }
  insertBefore(noeud, repere) {
    if (!repere) return this.append(noeud);
    noeud.remove();
    noeud.parentElement = this;
    this.noeuds.splice(this.noeuds.indexOf(repere), 0, noeud);
    notifier(this, { type: 'childList', target: this, addedNodes: [noeud] });
    return noeud;
  }
  before(...noeuds) {
    for (const n of noeuds) this.parentElement.insertBefore(typeof n === 'string' ? new Texte(n) : n, this);
  }
  after(...noeuds) {
    const parent = this.parentElement;
    let repere = parent.noeuds[parent.noeuds.indexOf(this) + 1] ?? null;
    for (const n of noeuds) {
      const noeud = typeof n === 'string' ? new Texte(n) : n;
      parent.insertBefore(noeud, repere);
      repere = parent.noeuds[parent.noeuds.indexOf(noeud) + 1] ?? null;
    }
  }
  replaceWith(...noeuds) {
    if (!this.parentElement) return;
    this.after(...noeuds);
    this.remove();
  }
  remove() {
    this.parentElement?.retirer(this);
  }
  correspond(selecteur) {
    // une liste « a, b » et le descendant « a b », découpés hors des […] et des guillemets ([aria-label="Fermer la fenêtre"] reste entier)
    const liste = decouper(selecteur, (c) => c === ',');
    if (liste.length > 1) return liste.some((s) => this.correspond(s));
    const parties = decouper(selecteur, (c) => /\s/.test(c));
    if (parties.some((p) => /^[>+~]$/.test(p))) throw new Error(`sélecteur non pris en charge : ${selecteur}`);
    if (parties.length > 1) {
      if (!this.correspond(parties.at(-1))) return false;
      let reste = parties.slice(0, -1);
      for (let e = this.parentElement; e && reste.length; e = e.parentElement) if (e.correspond(reste.at(-1))) reste = reste.slice(0, -1);
      return reste.length === 0;
    }
    const m = selecteur.trim().match(/^([a-z][a-z0-9]*)?((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:[*^$]?="[^"]*")?\])*)$/);
    if (!m) throw new Error(`sélecteur non pris en charge : ${selecteur}`);
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const [, id, classe, attr, operateur, valeur] of m[2].matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^$]?)="([^"]*)")?\]/g)) {
      if (id && this.id !== id) return false;
      if (classe && !this.classList.contains(classe)) return false;
      if (!attr) continue;
      const v = this.getAttribute(attr);
      if (v === null) return false;
      if (valeur === undefined) continue;
      if (operateur === '*' ? !v.includes(valeur) : operateur === '^' ? !v.startsWith(valeur) : operateur === '$' ? !v.endsWith(valeur) : v !== valeur) return false;
    }
    return true;
  }
  *descendants() {
    for (const c of this.children) {
      yield c;
      yield* c.descendants();
    }
  }
  matches(selecteur) { return this.correspond(selecteur); }
  querySelectorAll(selecteur) {
    // « :scope > … » : les enfants directs ; le reste de la liste par correspond (découpée hors des […] et des guillemets)
    const parties = decouper(selecteur, (c) => c === ',');
    const directs = parties.filter((s) => s.startsWith(':scope >')).map((s) => s.slice(':scope >'.length).trim());
    const autres = parties.filter((s) => !s.startsWith(':scope >'));
    return [...this.descendants()].filter((e) => (directs.length && e.parentElement === this && directs.some((s) => e.correspond(s)))
      || autres.some((s) => e.correspond(s)));
  }
  querySelector(selecteur) { return this.querySelectorAll(selecteur)[0] ?? null; }
  closest(selecteur) {
    for (let e = this; e; e = e.parentElement) if (e.tagName !== 'FRAGMENT' && e.matches(selecteur)) return e;
    return null;
  }
  contains(autre) {
    for (let e = autre; e; e = e.parentElement) if (e === this) return true;
    return false;
  }
  focus() {}
  scrollIntoView() {}
  showModal() { this.ouvert = true; }
  close() {
    this.ouvert = false;
    this.dispatchEvent(new Event('close'));
  }
}

/** Le HTML d'un nœud (innerHTML, outerHTML). */
function serialiser(n) {
  if (n.nodeType === 3) return echapperTexte(n.nodeValue);
  const tag = n.tagName.toLowerCase();
  const attributs = [...n.attributs].map(([k, v]) => ` ${k}="${echapperAttribut(v)}"`).join('');
  if (VIDES.has(tag)) return `<${tag}${attributs}>`;
  return `<${tag}${attributs}>${(n.content ?? n).noeuds.map(serialiser).join('')}</${tag}>`;
}

/** `el('li', { 'data-id': 'x' }, enfant…)` */
export const el = (tag, attributs, ...enfants) => new Element(tag, attributs, enfants);

/** Un document : la racine, `head`, `body`, getElementById, createElement, createTextNode, execCommand (sans effet) ; `title`. */
export function fauxDocument(...contenu) {
  const document = new Element('html');
  const head = el('head', {});
  const body = el('body', {}, ...contenu);
  document.append(head, body);
  document.head = head;
  document.body = body;
  document.getElementById = (id) => document.querySelector(`#${id}`);
  document.createElement = (tag) => new Element(tag);
  document.createTextNode = (texte) => new Texte(texte);
  document.execCommand = () => true;
  document.title = '';
  return document;
}

/** Un clic sur `cible`, écouté sur `ecoute` (un évènement qui remonte jusqu'à elle) ; rend l'évènement (defaultPrevented…). */
export function cliquer(cible, ecoute = cible) {
  const e = new Event('click', { cancelable: true });
  Object.defineProperties(e, { target: { value: cible }, button: { value: 0 } });
  ecoute.dispatchEvent(e);
  return e;
}

export const attendre = () => new Promise((r) => setTimeout(r, 0));

/**
 * Ce qu'un script qui suit la page emploie, ajouté à un faux document : `document.createTreeWalker(racine, NodeFilter.SHOW_TEXT)` (les nœuds de texte de
 * `racine`, dans l'ordre du document, relevés à sa création) ; rend { MutationObserver, NodeFilter } à poser sur globalThis. Un observateur reçoit les
 * changements de sa cible (et de ses descendants avec `subtree`) : enfants ajoutés (`childList`), attributs (`attributes`, `attributeFilter`), textes
 * (`characterData`), remis ensemble à la microtâche suivante ; `nombre` : les remises faites (un script qui bouclerait sur ses propres écritures en
 * ferait sans fin).
 */
export function domVivant(document) {
  const observateurs = new Set();
  document.observateurs = observateurs;
  document.createTreeWalker = (racine) => {
    const textes = [];
    const visiter = (n) => {
      for (const c of (n.content ?? n).noeuds ?? []) {
        if (c.nodeType === 3) textes.push(c);
        else visiter(c);
      }
    };
    visiter(racine);
    let i = 0;
    return { nextNode: () => textes[i++] ?? null };
  };
  class MutationObserver {
    constructor(rappel) {
      this.rappel = rappel;
      this.file = [];
      this.cible = null;
      this.options = {};
      MutationObserver.nombre ??= 0;
    }
    observe(cible, options = {}) {
      this.cible = cible;
      this.options = options;
      observateurs.add(this);
    }
    disconnect() {
      observateurs.delete(this);
      this.file = [];
    }
    takeRecords() {
      const f = this.file;
      this.file = [];
      return f;
    }
    noter(noeud, e) {
      const o = this.options;
      const dedans = noeud === this.cible || (o.subtree && this.cible.contains(noeud.nodeType === 3 ? noeud.parentElement : noeud));
      if (!dedans) return;
      if (e.type === 'childList' && !o.childList) return;
      if (e.type === 'characterData' && !o.characterData) return;
      if (e.type === 'attributes' && (!o.attributes || (o.attributeFilter && !o.attributeFilter.includes(e.attributeName)))) return;
      const vide = !this.file.length;
      this.file.push({ addedNodes: [], ...e });
      if (vide) {
        queueMicrotask(() => {
          const f = this.takeRecords();
          if (!f.length) return;
          MutationObserver.nombre += 1;
          this.rappel(f, this);
        });
      }
    }
  }
  return { MutationObserver, NodeFilter: { SHOW_TEXT: 4 } };
}
