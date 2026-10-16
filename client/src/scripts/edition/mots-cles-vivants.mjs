// Les mots-clés du glossaire sur le site de dev, d'après le vocabulaire VIVANT (la base du site de dev, en avance sur le site construit ; demande du
// propriétaire du 2026-10-16, docs/content-guide.md, « Mots-clés (glossaire) ») : au build, le middleware (src/middleware.mjs) a rendu les balises de la page
// avec le vocabulaire de la base construite ; ici, chargé par l'éditeur (editeur.mjs) sur toutes les pages du site de dev :
//   - les mots-clés rendus suivent le vocabulaire vivant : libellé d'une balise sans texte écrit, mode complet (libellé et définition), bulle de chaque
//     mot-clé décrit (refaite, ajoutée ou retirée), mot-clé supprimé depuis réduit à son texte simple ;
//   - tout HTML posé après le chargement (rendus du mode modification, lib/edition-rendu.mjs#RENDUS ; cartes, frise ou descriptions rendues par le service ou
//     par une extension) a ses balises rendues dès qu'il est posé (un observateur de toute la page), comme le middleware (lib/mots-cles-balises.mjs) : dans
//     les nœuds de texte, ni dans script, style, textarea, template, code, pre, kbd, samp, svg, math, ni sous [data-mots-cles-bruts] (textes d'aide du mode
//     modification, zone d'annonce, page Debug, /donnees/), ni dans une zone en cours de saisie (contenteditable, champ de l'éditeur) — ni dans leurs
//     attributs ; les attributs de texte (title, data-infobulle, aria-label, aria-description, alt) en ont le texte simple ; dans une bulle, un mot-clé est
//     en gras sans bulle ni focus, dans un élément qui a le focus sans tabindex, dans un bouton ou un résumé sans bulle.
// Rien n'est écrit qui ne change : un texte ou un attribut sans balise lisible (« {{ » seul) reste tel quel, et l'observateur ne relit que ce qui a une
// balise (pas de boucle avec ses propres écritures). Au chargement, seuls les éléments qui ont une balise sont parcourus.
// Fonctions du DOM ; le rendu est celui de lib/mots-cles-balises.mjs (le même HTML que le middleware). Absent de la version portable (chaîne de l'édition).
import {
  ACTIONS, ATTRIBUTS_DE_TEXTE, EXCLUS as ELEMENTS_EXCLUS, FOCALISABLES, htmlDeLaBalise, htmlDeLaBulle, idDeBulle, lireBalises, lireUneBalise, motCleDeLaRef,
  texteSansBalises, vocabulaireDesMotsCles,
} from '../../lib/mots-cles-balises.mjs';

let vocabulaire = null; // le vocabulaire vivant (vocabulaireDesMotsCles), null tant qu'il n'est pas lu
let observateur = null;
let enAttente = new Set(); // nœuds ajoutés ou changés, traités ensemble à la microtâche suivante

/** Ce qui garde ses balises telles qu'écrites, texte et attributs (comme le middleware, plus les zones de saisie de l'éditeur). */
const EXCLUS = [...ELEMENTS_EXCLUS, 'script', 'style', 'textarea', 'title', '[data-mots-cles-bruts]', '[contenteditable=""]', '[contenteditable="true"]', '.ed-champ'].join(', ');
/** Les attributs de texte relus (ceux du middleware qu'un script pose ou change après le chargement). */
const ATTRIBUTS = ATTRIBUTS_DE_TEXTE.filter((a) => !['content', 'placeholder'].includes(a));
/** Un élément qui a déjà le focus (un mot-clé dedans : sans tabindex) ; un élément dont un appui fait une action (sans bulle). */
const FOCUS = [...FOCALISABLES, '[tabindex]'].join(', ');
const ACTION = ACTIONS.join(', ');
const aUneBalise = (t) => typeof t === 'string' && t.includes('{{') && lireBalises(t).length > 0;

const fragmentDe = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
};

/**
 * Ce que permet l'endroit où se trouve `el` (options de htmlDeLaBalise) : ni focus dans un élément focalisable ou une bulle, ni bulle dans un bouton, un
 * résumé ou une bulle (aussi pour les outils de l'éditeur en place : texte-en-place.mjs).
 */
export function contexteDe(el) {
  const bulle = Boolean(el?.closest('.bulle'));
  return { sansFocus: bulle || Boolean(el?.closest(FOCUS)), sansBulle: bulle || Boolean(el?.closest(ACTION)) };
}

/**
 * Le vocabulaire vivant (GET /api/edition/mots-cles/ : la liste de l'éditeur `ed.listes.motsCles` s'il l'a déjà) ; `frais` : relu dans la base vivante.
 * Rend le vocabulaire prêt (vocabulaireDesMotsCles).
 */
export async function vocabulaireVivant(ed, { frais = false } = {}) {
  if (vocabulaire && !frais) return vocabulaire;
  const liste = !frais && ed.listes?.motsCles ? ed.listes.motsCles : (await ed.appel('GET', 'edition/mots-cles/')).motsCles;
  definirLeVocabulaire(liste);
  return vocabulaire;
}

/** La bulle du mot-clé `id` dans la page, refaite d'après le vocabulaire (retirée s'il n'est plus décrit) ; les déclencheurs suivent. */
export function assurerLaBulle(id) {
  if (!vocabulaire || !unVraiDom()) return;
  const html = htmlDeLaBulle(id, vocabulaire);
  const enPlace = document.getElementById(idDeBulle(id));
  if (html) {
    const bulle = fragmentDe(html).firstElementChild;
    if (enPlace) {
      if (enPlace.innerHTML !== bulle.innerHTML) enPlace.replaceChildren(...bulle.childNodes);
    } else document.body.append(bulle);
    return;
  }
  enPlace?.remove();
  for (const d of document.querySelectorAll(`[data-bulle="${idDeBulle(id)}"]`)) {
    d.removeAttribute('data-bulle');
    d.removeAttribute('aria-describedby');
    if (d.classList.contains('mot-cle')) d.removeAttribute('tabindex');
  }
}

/** Le DOM d'un vrai navigateur (ou d'un faux navigateur qui sait parcourir les textes : test/aide-faux-dom.mjs#domVivant). */
const unVraiDom = () => typeof document !== 'undefined' && typeof document.createTreeWalker === 'function';

/** Un attribut de texte sans ses balises (texte simple), écrit seulement s'il change. */
function nettoyerLAttribut(el, a) {
  const v = el.getAttribute(a);
  if (!aUneBalise(v) || el.closest(EXCLUS)) return;
  const nette = texteSansBalises(v, vocabulaire);
  if (nette !== v) el.setAttribute(a, nette);
}

/** Les balises des nœuds de texte de `racine` (hors zones exclues) rendues ; les attributs de texte, en texte simple. */
function rendreDans(racine) {
  if (!vocabulaire || !racine || !unVraiDom()) return;
  const employes = new Set();
  if (racine.nodeType === 1) {
    // seuls les éléments qui ont une balise dans un attribut de texte (le reste de la page n'est pas parcouru)
    const selecteur = ATTRIBUTS.map((a) => `[${a}*="{{"]`).join(', ');
    for (const el of [...(racine.matches(selecteur) ? [racine] : []), ...racine.querySelectorAll(selecteur)]) for (const a of ATTRIBUTS) nettoyerLAttribut(el, a);
  }
  const textes = [];
  if (racine.nodeType === 3) textes.push(racine);
  else if (racine.textContent.includes('{{')) {
    const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    for (let n = parcours.nextNode(); n; n = parcours.nextNode()) if (n.nodeValue.includes('{{')) textes.push(n);
  }
  for (const n of textes) {
    if (!n.nodeValue.includes('{{') || !n.parentElement || n.parentElement.closest(EXCLUS)) continue;
    const balises = lireBalises(n.nodeValue);
    if (!balises.length) continue;
    if (n.parentElement.closest('option, optgroup')) {
      n.nodeValue = texteSansBalises(n.nodeValue, vocabulaire); // un choix d'une liste n'a que du texte
      continue;
    }
    const contexte = contexteDe(n.parentElement);
    const morceaux = [];
    let fin = 0;
    for (const b of balises) {
      morceaux.push(document.createTextNode(n.nodeValue.slice(fin, b.debut)));
      const { html, id } = htmlDeLaBalise(b, vocabulaire, contexte);
      morceaux.push(...fragmentDe(html).childNodes);
      if (id) employes.add(id);
      fin = b.fin;
    }
    morceaux.push(document.createTextNode(n.nodeValue.slice(fin)));
    n.replaceWith(...morceaux.filter((m) => m.nodeType !== 3 || m.nodeValue));
  }
  if (racine.nodeType === 1) {
    for (const el of [...(racine.matches('[data-bulle^="mot-cle-"]') ? [racine] : []), ...racine.querySelectorAll('[data-bulle^="mot-cle-"]')]) {
      const id = /^mot-cle-([a-z0-9-]+)$/.exec(el.getAttribute('data-bulle') ?? '')?.[1];
      if (id) employes.add(id);
    }
  }
  for (const id of employes) if (!document.getElementById(idDeBulle(id))) assurerLaBulle(id);
}

/** Les mots-clés déjà rendus dans la page (au build, ou avant que le vocabulaire change) refaits d'après le vocabulaire vivant, puis leurs bulles. */
function rafraichir() {
  if (!vocabulaire || !unVraiDom()) return;
  const ids = new Set();
  for (const el of document.querySelectorAll('[data-mot-cle][data-balise]')) {
    if (el.closest('[contenteditable=""], [contenteditable="true"]')) continue; // un texte en cours de saisie : il sera relu tel qu'il est
    const b = lireUneBalise(el.dataset.balise);
    const m = b && motCleDeLaRef(vocabulaire, b.ref);
    if (!b) continue;
    if (!m) {
      el.replaceWith(document.createTextNode(el.classList.contains('mot-cle-definition') ? b.ref : el.textContent)); // supprimé depuis : texte simple
      continue;
    }
    // une balise sans texte écrit montre le libellé vivant ; avec, le texte affiché (celui de la balise, ou celui qu'on y a modifié : la balise
    // d'origine reste dans data-balise, lib/markdown-edition.mjs y voit le changement)
    const lue = b.texte === null || !el.classList.contains('mot-cle') ? b : { ...b, texte: el.textContent };
    const rendu = fragmentDe(htmlDeLaBalise(lue, vocabulaire, contexteDe(el.parentElement)).html).firstElementChild;
    if (el.getAttribute('contenteditable') === 'false') rendu.setAttribute('contenteditable', 'false');
    if (rendu.outerHTML !== el.outerHTML) el.replaceWith(rendu);
    ids.add(m.id);
  }
  for (const d of document.querySelectorAll('[data-bulle^="mot-cle-"]')) ids.add(d.getAttribute('data-bulle').slice('mot-cle-'.length));
  for (const b of document.querySelectorAll('.bulle[id^="mot-cle-"]')) ids.add(b.id.slice('mot-cle-'.length));
  for (const id of ids) assurerLaBulle(id);
}

/** Change le vocabulaire vivant (le glossaire relu après un enregistrement, sur /recherche/) : la page le suit aussitôt. */
export function definirLeVocabulaire(liste) {
  vocabulaire = vocabulaireDesMotsCles(liste);
  rafraichir();
  if (typeof document !== 'undefined') rendreDans(document.body);
}

/** Les nœuds ajoutés ou changés depuis la dernière fois, rendus d'un coup (ce que rendreDans pose n'a plus de balise : rien n'y revient). */
function traiter() {
  const noeuds = [...enAttente];
  enAttente = new Set();
  for (const n of noeuds) if (n.isConnected) rendreDans(n);
}

/**
 * Met en place les mots-clés vivants sur la page (editeur.mjs, au démarrage, une fois les listes de l'éditeur lues : `ed.listes.motsCles`) : la page
 * suit le vocabulaire vivant, et tout ce qui s'y pose ensuite a ses balises rendues. Ne remet en file que ce qui a une balise lisible : un attribut ou
 * un texte où « {{ » n'ouvre aucune balise n'est ni réécrit ni relu.
 */
export async function glossaireVivant(ed) {
  try {
    await vocabulaireVivant(ed); // la page suit aussitôt (definirLeVocabulaire)
  } catch {
    return; // sans vocabulaire, la page garde ce que le build a rendu
  }
  if (observateur || !unVraiDom()) return;
  observateur = new MutationObserver((changements) => {
    const vide = !enAttente.size;
    for (const c of changements) {
      if (c.type === 'childList') {
        for (const n of c.addedNodes) if (n.nodeType === 1 || (n.nodeType === 3 && aUneBalise(n.nodeValue))) enAttente.add(n);
      } else if (c.type === 'characterData') {
        if (aUneBalise(c.target.nodeValue)) enAttente.add(c.target);
      } else if (c.type === 'attributes' && aUneBalise(c.target.getAttribute(c.attributeName))) enAttente.add(c.target);
    }
    if (vide && enAttente.size) queueMicrotask(traiter);
  });
  observateur.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS });
}
