// Un faux navigateur minimal pour exécuter un script de page dans les tests (test/recherche-script.test.mjs, test/edition-mots-cles.test.mjs) :
// des éléments avec attributs, enfants et écouteurs (EventTarget de Node), et les sélecteurs dont ces scripts se servent — « li », « #id », « .classe »,
// « [attr] », « [attr="valeur"] » et leurs combinaisons sans espace (pas de descendant, pas de virgule).

/** Un élément : attributs, enfants, texte, dataset, et les méthodes du DOM que les scripts emploient. */
export class Element extends EventTarget {
  constructor(tag, attributs = {}, enfants = []) {
    super();
    this.tagName = tag.toUpperCase();
    this.attributs = new Map(Object.entries(attributs));
    this.children = [];
    this.parentElement = null;
    this.hidden = this.attributs.has('hidden');
    this.disabled = false;
    this.texte = '';
    this.value = '';
    const soi = this;
    const attribut = (nom) => `data-${String(nom).replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`;
    this.dataset = new Proxy({}, {
      get: (_, nom) => soi.getAttribute(attribut(nom)) ?? undefined,
      set: (_, nom, valeur) => (soi.setAttribute(attribut(nom), String(valeur)), true),
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
  get textContent() { return this.texte + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) {
    for (const c of this.children) c.parentElement = null;
    this.children = [];
    this.texte = String(v);
  }
  getAttribute(nom) { return this.attributs.has(nom) ? this.attributs.get(nom) : null; }
  setAttribute(nom, valeur) { this.attributs.set(nom, String(valeur)); }
  hasAttribute(nom) { return this.attributs.has(nom); }
  removeAttribute(nom) { this.attributs.delete(nom); }
  append(...noeuds) {
    for (const n of noeuds) {
      if (typeof n === 'string') this.texte += n; // le texte entre deux éléments n'importe pas ici
      else {
        n.remove();
        n.parentElement = this;
        this.children.push(n);
      }
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
    this.children.splice(this.children.indexOf(repere), 0, noeud);
  }
  before(noeud) {
    this.parentElement.insertBefore(noeud, this);
  }
  remove() {
    if (!this.parentElement) return;
    const freres = this.parentElement.children;
    freres.splice(freres.indexOf(this), 1);
    this.parentElement = null;
  }
  correspond(selecteur) {
    const m = selecteur.match(/^([a-z]+)?((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/);
    if (!m) throw new Error(`sélecteur non pris en charge : ${selecteur}`);
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const [, id, classe, attr, valeur] of m[2].matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (id && this.id !== id) return false;
      if (classe && !this.classList.contains(classe)) return false;
      if (attr && (!this.hasAttribute(attr) || (valeur !== undefined && this.getAttribute(attr) !== valeur))) return false;
    }
    return true;
  }
  *descendants() {
    for (const c of this.children) {
      yield c;
      yield* c.descendants();
    }
  }
  querySelectorAll(selecteur) { return [...this.descendants()].filter((e) => e.correspond(selecteur)); }
  querySelector(selecteur) { return this.querySelectorAll(selecteur)[0] ?? null; }
  closest(selecteur) {
    for (let e = this; e; e = e.parentElement) if (e.correspond(selecteur)) return e;
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

/** `el('li', { 'data-id': 'x' }, enfant…)` */
export const el = (tag, attributs, ...enfants) => new Element(tag, attributs, enfants);

/** Un document : la racine, `body`, getElementById, createElement ; `title`. */
export function fauxDocument(...contenu) {
  const document = new Element('html');
  const body = el('body', {}, ...contenu);
  document.append(body);
  document.body = body;
  document.getElementById = (id) => document.querySelector(`#${id}`);
  document.createElement = (tag) => new Element(tag);
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
