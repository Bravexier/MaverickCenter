// Rendu d'un événement de la chronologie dans le navigateur, pour le site de dev seulement (mode modification : src/scripts/edition/chronologie.mjs) : un
// événement modifié ou créé depuis la construction du site s'affiche avant la version suivante (le site construit rend le Markdown par remark :
// components/chronologie/ChronologieEvenement.astro, qui fait foi). Le Markdown d'un bloc de description est simple (paragraphes, listes, gras, italique,
// barré, liens vers une page du wiki ou une adresse web, échappements) : c'est ce que l'éditeur en place écrit. Tout texte est échappé ; un lien n'est
// posé que vers une page du wiki ou une adresse http(s) ou du site. Fonctions pures, sans dépendance navigateur (chaînes HTML en sortie).
import { extraitsParPage, LIBELLE_SANS_CATEGORIE, marquerLaDate, PORTEES, SANS_CATEGORIE, surlignerLaDate, titreDeSection } from './chronologie.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const desechapper = (t) => t.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
// un saut de ligne <br> écrit dans le texte (les extraits du Codex en ont), le temps du rendu : un autre caractère de la zone d'usage privé
const SAUT = '\uE003';

// un caractère échappé (« \- ») le temps du rendu : un caractère de la zone d'usage privé (ni ceux de la date surlignée, U+E000 et U+E001)
const ECHAPPE = '';

/**
 * Une ligne de Markdown → HTML : échappements, sauts <br>, [[liens]] du wiki (avec leur cible telle qu'écrite, data-cible, comme lib/wikilinks.mjs : l'éditeur
 * en place la réécrit), [liens](web), gras, barré, italique. `page(cible)` : l'adresse d'une page du wiki.
 */
function enLigne(texte, page) {
  const gardes = [];
  let t = texte.replace(/\\([!-/:-@[-`{-~])/g, (_, c) => {
    gardes.push(c);
    return ECHAPPE;
  });
  t = echapper(t.replace(/<br\s*\/?>/gi, SAUT));
  t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, cible, libelle) =>
    `<a class="wikilink" data-cible="${cible.trim()}" href="${echapper(page(desechapper(cible.trim())))}">${libelle ?? cible}</a>`);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (tout, libelle, adresse) => (/^(https?:\/\/|\/(?!\/))/.test(adresse) ? `<a href="${adresse}">${libelle}</a>` : libelle));
  t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>').replace(/~~([^~]+?)~~/g, '<del>$1</del>');
  t = t.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  let i = 0;
  return t.replace(new RegExp(ECHAPPE, 'g'), () => echapper(gardes[i++])).replace(new RegExp(SAUT, 'g'), '<br>');
}

const PUCE = /^\s*(?:[*+-]|\d+[.)])\s+/;

/** Des paragraphes de Markdown simple → HTML : paragraphes, listes à puces ou numérotées, citations « > » (leur contenu de même). */
function blocsHtml(texte, page) {
  return texte
    .split(/\n\s*\n/)
    .map((bloc) => bloc.trim())
    .filter(Boolean)
    .map((bloc) => {
      const lignes = bloc.split('\n');
      if (lignes.every((l) => /^\s*>/.test(l))) return `<blockquote>${blocsHtml(lignes.map((l) => l.replace(/^\s*> ?/, '')).join('\n'), page)}</blockquote>`;
      if (lignes.every((l) => PUCE.test(l))) {
        const balise = /^\s*\d/.test(lignes[0]) ? 'ol' : 'ul';
        return `<${balise}>${lignes.map((l) => `<li>${enLigne(l.replace(PUCE, ''), page)}</li>`).join('')}</${balise}>`;
      }
      // un retour à la ligne forcé : une barre oblique inverse ou deux espaces en fin de ligne (comme le Markdown du build)
      return `<p>${lignes.map((l, i) => {
        const force = i < lignes.length - 1 && /(\\| {2,})$/.test(l.replace(/\t+$/, ''));
        return enLigne(force ? l.replace(/(\\| {2,})\t*$/, '').trim() : l.trim(), page) + (force ? '<br>' : '');
      }).join('\n')}</p>`;
    })
    .join('');
}

/**
 * Le Markdown simple d'un bloc → HTML, la date `dateBrut` surlignée comme sur la page construite (lib/chronologie.mjs#marquerLaDate, #surlignerLaDate).
 * Redonne par l'éditeur en place (lib/markdown-edition.mjs#versMarkdown) le Markdown que redonne le rendu du build (test/chronologie-rendu.test.mjs) :
 * une retouche ne réécrit ni les [[liens]] ni les citations du reste. `page(cible)` : l'adresse d'une page du wiki (lien [[…]]).
 */
export function htmlDuTexte(markdown, { dateBrut = null, page = (id) => `/${id}/` } = {}) {
  return surlignerLaDate(blocsHtml(marquerLaDate(String(markdown ?? '').replace(/\r\n?/g, '\n'), dateBrut), page));
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
