// Le rendu Markdown du site dans le navigateur du site de dev (mode modification : src/scripts/edition/guide.mjs, lib/chronologie-rendu.mjs) : un texte
// modifié ou créé depuis la construction du site s'affiche avant la version suivante, rendu COMME AU BUILD. La chaîne est celle de
// @astrojs/markdown-remark (remark-parse, remark-gfm, remark-smartypants, les plugins du site, remark-rehype, ids des intertitres par github-slugger,
// rehype-stringify), synchrone, sans Astro ni navigateur ni node:fs ; test/markdown-rendu.test.mjs compare son HTML à celui du build, sur des corps posés par le test
// et sur toutes les pages du guide.
//   - `processeurDuWiki(plugins)` : la chaîne, avec les plugins remark donnés (chronologie-rendu.mjs : liens vers `page(cible)` ; ici : l'index des pages) ;
//   - `remarkPluginsDuWiki({ index, base, adresse })` : les plugins du site, dans l'ordre d'astro.config.mjs (page du Codex) ou de lib/guide-rendu.ts
//     (page du guide : `adresse` mène un lien écrit vers une ancienne adresse du guide à la page d'aujourd'hui) ; à tenir d'accord avec eux
//     (test/markdown-rendu.test.mjs lit leurs sources) ;
//   - `creerLeRendu({ pages, base })` : le rendu d'un morceau de texte d'une page du guide ou du Codex, sur les pages de la base vivante
//     (GET /api/edition/pages/ : { id, titre }), y compris celles créées depuis la construction, que l'index du build ne connaît pas. Écarts voulus avec
//     le build : un [[alias]] qui n'est ni un titre ni un slug ne mène à rien (la route ne donne pas les alias), pas de coloration du code, et la sûreté
//     de remarkTexteSur (le HTML brut n'est rendu que pour un saut <br>, un lien ou une image seulement vers une adresse http(s), du site,
//     une #ancre ou une adresse relative ./ ../, comme htmlSur).
// Le HTML rendu passe ensuite par lib/markdown-edition.mjs#htmlSur (guide.mjs#assainir) avant d'entrer dans la page.
import GithubSlugger from 'github-slugger';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkSmartypants from 'remark-smartypants';
import { unified } from 'unified';
import { remarkAncresFigees } from './ancres-figees.mjs';
import { RENVOIS_DES_PAGES_ECLATEES } from './equipement.mjs';
import { adresseDesAnciensLiens, avecPrefixe, remarkAnciensLiensDuGuide } from './guide.mjs';
import { ACCUEIL_DU_GUIDE, pagesEclateesDuGuide } from './livres.mjs';
import { remarkCouleursDeCase } from './markdown-couleurs.mjs';
import { remarkMonnaies } from './markdown-monnaies.mjs';
import { cheminDePage } from './metiers.mjs';
import { cheminVersUnePageEclatee } from './nav.mjs';
import { remarkWikilinks } from './wikilinks-remark.mjs';
import { buildIndex } from './wikilinks-resolution.mjs';

const BR = /^<br\s*\/?>$/i;
// les adresses que garde aussi lib/markdown-edition.mjs#htmlSur : http(s), l'adresse du site, une ancre (« #plaine »), une adresse relative
const ADRESSE_SURE = /^(https?:\/\/|\/(?!\/)|#|\.\.?\/)/i;

/**
 * Plugin remark (après la typographie, avant les plugins qui posent du HTML, comme les monnaies) : un HTML brut écrit n'est rendu que s'il est un saut
 * <br> (le build le recopie : les extraits du Codex en ont) ; tout autre s'affiche en texte. Un lien ou une image vers une adresse qui n'est ni http(s),
 * ni du site, ni une ancre (ADRESSE_SURE) garde son texte, sans lien (le service refuse déjà d'écrire un lien non sûr : lib/markdown-sur.mjs ; ceci vaut pour un texte importé).
 * Les liens et images par référence (`[texte][a]`, `[a]`, `![alt][a]` et leur définition `[a]: adresse`) suivent la même règle : une définition non
 * sûre est retirée, et une référence qui ne trouve plus de définition sûre garde son texte (ou son texte alternatif), sans lien. Une référence sans
 * aucune définition reste telle que le build la rend (le texte entre crochets).
 */
export function remarkTexteSur() {
  const cle = (noeud) => String(noeud.identifier ?? '').toUpperCase();
  return (arbre) => {
    const sures = new Set();
    const nonSures = new Set();
    const relever = (noeud) => {
      if (noeud.type === 'definition') (ADRESSE_SURE.test(noeud.url ?? '') ? sures : nonSures).add(cle(noeud));
      for (const enfant of noeud.children ?? []) relever(enfant);
    };
    relever(arbre);
    const sansLien = (noeud) => {
      if (noeud.type === 'link' || noeud.type === 'image') return !ADRESSE_SURE.test(noeud.url ?? '');
      if (noeud.type === 'linkReference' || noeud.type === 'imageReference') return nonSures.has(cle(noeud)) && !sures.has(cle(noeud));
      return false;
    };
    const parcourir = (noeud) => {
      if (!noeud.children) return;
      noeud.children = noeud.children.flatMap((enfant) => {
        if (enfant.type === 'html') return [BR.test(enfant.value.trim()) ? { ...enfant, value: '<br>' } : { type: 'text', value: enfant.value }];
        if (enfant.type === 'definition' && !ADRESSE_SURE.test(enfant.url ?? '')) return [];
        if (sansLien(enfant)) {
          if (enfant.type === 'image' || enfant.type === 'imageReference') return enfant.alt ? [{ type: 'text', value: enfant.alt }] : [];
          parcourir(enfant);
          return enfant.children ?? [];
        }
        parcourir(enfant);
        return [enfant];
      });
    };
    parcourir(arbre);
  };
}

/** Plugin rehype : l'id d'un intertitre qui n'en a pas (une ancre figée l'a déjà), le slug de son texte, comme @astrojs/markdown-remark (github-slugger). */
export function rehypeIdsDesIntertitres() {
  const texte = (n) => {
    if (n.type === 'text') return n.value;
    if (n.type === 'raw') return /^\n?<.*>\n?$/.test(n.value) ? '' : n.value.replace(/\{/g, '${');
    return (n.children ?? []).map(texte).join('');
  };
  return (arbre) => {
    const slugger = new GithubSlugger();
    const parcourir = (n) => {
      if (n.type === 'element' && /^h[1-6]$/.test(n.tagName)) {
        n.properties ??= {};
        if (typeof n.properties.id !== 'string') n.properties.id = slugger.slug(texte(n));
      }
      for (const enfant of n.children ?? []) parcourir(enfant);
    };
    parcourir(arbre);
  };
}

/** La chaîne du build avec `plugins` (la liste d'un `remarkPlugins` : un plugin, ou [plugin, options]) ; `processSync(markdown)` rend le HTML. */
export function processeurDuWiki(plugins) {
  const p = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants).use(remarkTexteSur);
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) p.use(plugin[0], plugin[1]);
    else p.use(plugin);
  }
  return p.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeIdsDesIntertitres).use(rehypeStringify, { allowDangerousHtml: true });
}

/**
 * Les plugins remark du site, dans l'ordre d'astro.config.mjs (sans `adresse`) ou de lib/guide-rendu.ts (avec : les anciennes adresses du guide).
 * `index` : lib/wikilinks-resolution.mjs#buildIndex ; `base` : le préfixe de déploiement ; `avertir: false` : pas d'avertissement pour un [[lien]] sans page.
 */
export function remarkPluginsDuWiki({ index, base = '/', adresse = null, avertir = true }) {
  return [
    [remarkWikilinks, { index, base, avertir }],
    remarkCouleursDeCase,
    remarkMonnaies,
    remarkAncresFigees,
    ...(adresse ? [[remarkAnciensLiensDuGuide, { base, adresse }]] : []),
  ];
}

/** L'index des liens [[…]] d'après les pages de la base vivante ([{ id, titre }] : GET /api/edition/pages/) ; pas d'alias (la route n'en donne pas). */
export function indexDesPages(pages) {
  return buildIndex(
    pages.map(({ id, titre }) => {
      const barre = id.indexOf('/');
      return { id, type: id.slice(0, barre), slug: id.slice(barre + 1), title: String(titre ?? id), aliases: [] };
    }),
  );
}

/**
 * Le rendu des morceaux de texte, sur les pages de la base vivante : `{ guide(markdown), codex(markdown) }` rendent le HTML d'un morceau d'une page du guide
 * (liens Markdown préfixés, anciennes adresses du guide et pages éclatées menées à leur page, comme lib/guide-rendu.ts) ou d'une page du Codex (comme
 * astro.config.mjs). `base` : le préfixe de déploiement (`ed.base`).
 */
export function creerLeRendu({ pages, base = '/' }) {
  const index = indexDesPages(pages);
  const existantes = new Set(pages.map((p) => p.id));
  const existe = (page) => existantes.has(page);
  // comme lib/guide-rendu.ts : une cible absente (page supprimée) est sautée, le lien reste tel qu'écrit
  const eclatees = { ...RENVOIS_DES_PAGES_ECLATEES, ...pagesEclateesDuGuide(existe) };
  const adresse = (chemin) => {
    const eclatee = cheminVersUnePageEclatee(chemin, eclatees);
    return eclatee !== chemin ? eclatee : adresseDesAnciensLiens(chemin, { cheminDe: cheminDePage, existe, accueil: ACCUEIL_DU_GUIDE });
  };
  const guide = processeurDuWiki(remarkPluginsDuWiki({ index, base, adresse, avertir: false }));
  const codex = processeurDuWiki(remarkPluginsDuWiki({ index, base, avertir: false }));
  return {
    guide: (markdown) => String(guide.processSync(avecPrefixe(markdown, base))),
    codex: (markdown) => String(codex.processSync(markdown)),
  };
}
