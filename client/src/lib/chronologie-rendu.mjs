// Rendu d'un événement de la chronologie dans le navigateur, pour le site de dev seulement (mode modification : src/scripts/edition/chronologie.mjs ; et les
// blocs des panneaux de règles et l'annonce de l'accueil : edition/panneaux.mjs, edition/annonces.mjs) : un texte modifié ou créé depuis la construction
// du site s'affiche avant la version suivante. Le Markdown d'un texte est rendu COMME AU BUILD (lot « Défauts du code », point 8) : la même chaîne
// unified que @astrojs/markdown-remark (lib/markdown-rendu.mjs#processeurDuWiki : remark-parse, remark-gfm, remark-smartypants, puis les plugins du site de
// lib/guide-rendu.ts, remark-rehype, ids des intertitres par github-slugger, rehype-stringify), synchrone, sans Astro ni navigateur : typographie (guillemets, apostrophes, tirets, points
// de suspension), règle CommonMark des délimiteurs (gras, italique), échappements (« \*\* » reste « ** »), listes, citations, tableaux GFM, couleur des
// cases, monnaies en icônes, ancres figées des intertitres. Écarts voulus avec le build, faute de l'index des pages dans un module pur : un [[lien]] mène
// à `page(cible)` (pas de repère « page manquante ») ; ni préfixe de déploiement ni ancienne adresse du guide pour un lien Markdown écrit. Et la sûreté :
// le HTML brut n'est rendu que pour un saut <br> (le reste s'affiche en texte), un lien ou une image, direct ou par référence, seulement vers une
// adresse http(s), du site, une #ancre ou une adresse relative ./ ../ (comme htmlSur).
// Fonctions pures, sans dépendance navigateur (chaînes HTML en sortie) ; test/chronologie-rendu.test.mjs compare htmlDuTexte au rendu du build.
import { remarkAncresFigees } from './ancres-figees.mjs';
import { extraitsParPage, LIBELLE_SANS_CATEGORIE, marquerLaDate, PORTEES, SANS_CATEGORIE, surlignerLaDate, titreDeSection } from './chronologie.mjs';
import { remarkCouleursDeCase } from './markdown-couleurs.mjs';
import { remarkMonnaies } from './markdown-monnaies.mjs';
import { processeurDuWiki } from './markdown-rendu.mjs';
import { WIKILINK_SOURCE } from './wikilinks-resolution.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

/**
 * Plugin remark : `[[cible]]` et `[[cible|texte]]` deviennent des liens vers `page(cible)`, avec la cible telle qu'écrite en `data-cible` (comme
 * lib/wikilinks.mjs, que l'éditeur en place réécrit en [[cible|texte]]) ; ni dans un lien, ni dans du code.
 */
function remarkLiensDuWiki({ page }) {
  const motif = new RegExp(WIKILINK_SOURCE, 'g');
  const convertir = (valeur) => {
    const noeuds = [];
    let fin = 0;
    for (const m of valeur.matchAll(motif)) {
      if (m.index > fin) noeuds.push({ type: 'text', value: valeur.slice(fin, m.index) });
      const cible = m[1].trim();
      noeuds.push({
        type: 'link',
        url: page(cible),
        title: null,
        children: [{ type: 'text', value: (m[2] ?? m[1]).trim() }],
        data: { hProperties: { className: ['wikilink'], 'data-cible': cible } },
      });
      fin = m.index + m[0].length;
    }
    if (fin < valeur.length) noeuds.push({ type: 'text', value: valeur.slice(fin) });
    return noeuds;
  };
  const parcourir = (noeud) => {
    if (!noeud.children || noeud.type === 'link' || noeud.type === 'linkReference') return;
    noeud.children = noeud.children.flatMap((enfant) => {
      if (enfant.type === 'text' && enfant.value.includes('[[')) return convertir(enfant.value);
      parcourir(enfant);
      return [enfant];
    });
  };
  return (arbre) => parcourir(arbre);
}

const processeurs = new Map();
/** La chaîne du build pour une fonction `page` (une par appelant : les scripts en gardent une). */
function processeur(page) {
  if (!processeurs.has(page)) {
    processeurs.set(page, processeurDuWiki([[remarkLiensDuWiki, { page }], remarkCouleursDeCase, remarkMonnaies, remarkAncresFigees]));
  }
  return processeurs.get(page);
}

const PAGE_PAR_DEFAUT = (id) => `/${id}/`;

/**
 * Le Markdown d'un bloc → HTML, comme au build (lib/guide-rendu.ts), la date `dateBrut` surlignée comme sur la page construite
 * (lib/chronologie.mjs#marquerLaDate, #surlignerLaDate). Redonne par l'éditeur en place (lib/markdown-edition.mjs#versMarkdown) le Markdown que redonne
 * le rendu du build : une retouche ne réécrit ni les [[liens]] ni les citations du reste. `page(cible)` : l'adresse d'une page du wiki (lien [[…]]).
 */
export function htmlDuTexte(markdown, { dateBrut = null, page = PAGE_PAR_DEFAUT } = {}) {
  const md = marquerLaDate(String(markdown ?? '').replace(/\r\n?/g, '\n'), dateBrut);
  return surlignerLaDate(String(processeur(page).processSync(md)));
}

/**
 * Les pastilles des catégories d'un événement ([{ id, libelle }]) ; `filtre(id)` : l'adresse de la frise filtrée sur elle. Sans catégorie : « Sans catégorie
 * (à trier) » si `aTrier` (hors de la production), sinon rien.
 */
export function htmlDesCategories(categories, { filtre = (id) => `/chronologie/?filtre=${encodeURIComponent(id)}`, aTrier = true } = {}) {
  if (!categories?.length) {
    return aTrier ? `<li><a class="chrono-categorie chrono-categorie--a-trier" href="${echapper(filtre(SANS_CATEGORIE))}">${echapper(LIBELLE_SANS_CATEGORIE)}</a></li>` : '';
  }
  return categories.map((c) => `<li><a class="chrono-categorie" href="${echapper(filtre(c.id))}">${echapper(c.libelle)}</a></li>`).join('');
}

/**
 * Les blocs de description d'un événement ([{ rang, page_id, page_titre, section, texte, date_brut }]), regroupés comme sur la page construite : les blocs
 * consécutifs d'une même page sous une légende (sa page et ses sections), un bloc sans lien seul et sans légende. `page(id)` : l'adresse d'une page.
 */
export function htmlDesBlocs(blocs, { page = (id) => `/${id}/` } = {}) {
  return extraitsParPage(blocs)
    .map((g) => {
      const sections = [...new Set(g.extraits.map((x) => x.section).filter(Boolean).map(titreDeSection))];
      const legende = g.page_id
        ? `<figcaption class="chrono-legende"><a href="${echapper(page(g.page_id))}">${echapper(g.page_titre ?? g.page_id)}</a>${sections.length ? `<span class="chrono-legende__sections">· ${echapper(sections.join(', '))}</span>` : ''}</figcaption>`
        : '';
      const textes = g.extraits
        .map((x) => `<blockquote class="chrono-extrait" data-chrono-bloc="${x.rang}" data-chrono-page="${echapper(x.page_id ?? '')}">${htmlDuTexte(x.texte, { dateBrut: x.date_brut, page })}</blockquote>`)
        .join('');
      return `<figure class="chrono-source">${textes}${legende}</figure>`;
    })
    .join('');
}

/** La pastille de la portée d'un Impact (« Impact majeur ») ; rien sans portée. */
export const htmlDeLaPortee = (portee) => (portee && PORTEES[portee] ? `<span class="chrono-portee chrono-portee--${portee}">${PORTEES[portee]}</span>` : '');
