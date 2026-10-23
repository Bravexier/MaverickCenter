// Le rendu Markdown du site, pour les tests : le processeur de @astrojs/markdown-remark avec les plugins du site ([[liens]] sur l'index des pages,
// couleurs des cases, monnaies en icônes ; astro.config.mjs et lib/guide-rendu.ts), puis les balises du glossaire comme le middleware (src/middleware.mjs,
// lib/mots-cles-balises.mjs#htmlAvecMotsCles) ; le rendu d'une page du guide (lib/guide-rendu.ts : liens Markdown préfixés, anciennes adresses du guide
// menées à leur page du plan et gardées en `data-lien-ecrit`) ; et le HTML relu comme un navigateur le lirait (hast-util-from-html, dépendance de
// @astrojs/markdown-remark) en l'arbre simple de lib/markdown-edition.mjs (celui qu'arbreDuDom tire du DOM). Partagé par test/markdown-edition.test.mjs et
// test/edition-panneaux.test.mjs.
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { fromHtml } from 'hast-util-from-html';
import { remarkCouleursDeCase } from '../src/lib/markdown-couleurs.mjs';
import { remarkMonnaies } from '../src/lib/markdown-monnaies.mjs';
import { htmlAvecMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { buildIndex, remarkWikilinks, scanContent } from '../src/lib/wikilinks.mjs';
import { adresseDesAnciensLiens, avecPrefixe, remarkAnciensLiensDuGuide } from '../src/lib/guide.mjs';
import { ACCUEIL_DU_GUIDE } from '../src/lib/livres.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';

/** Les pages fabriquées du wiki (npm run db:export-pages, lancé avant les tests). */
export const DOSSIER_DU_WIKI = fileURLToPath(new URL('../src/content/wiki/', import.meta.url));

let processeur = null;
/** Le HTML d'un Markdown, rendu comme au build (status « example » : pas d'avertissement pour un lien cassé, ces tests ne contrôlent pas les liens). */
export async function rendreLeMarkdown(md) {
  processeur ??= createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkWikilinks, { index: buildIndex(scanContent(DOSSIER_DU_WIKI)), base: '/' }], remarkCouleursDeCase, remarkMonnaies],
  });
  return (await (await processeur).render(md, { frontmatter: { status: 'example' } })).code;
}

const processeursDuGuide = new Map();
/**
 * Le HTML d'un morceau d'une page du guide, rendu comme lib/guide-rendu.ts au build (préfixe de déploiement `base`) : avecPrefixe, puis les plugins
 * du site et remarkAnciensLiensDuGuide sur les pages chargées (celles du dossier du wiki).
 */
export async function rendreCommeLeGuide(md, base = '/') {
  if (!processeursDuGuide.has(base)) {
    const pages = scanContent(DOSSIER_DU_WIKI);
    const ids = new Set(pages.map((p) => p.id));
    const adresse = (chemin) => adresseDesAnciensLiens(chemin, { cheminDe: cheminDePage, existe: (id) => ids.has(id), accueil: ACCUEIL_DU_GUIDE });
    processeursDuGuide.set(base, createMarkdownProcessor({
      syntaxHighlight: false,
      remarkPlugins: [[remarkWikilinks, { index: buildIndex(pages), base }], remarkCouleursDeCase, remarkMonnaies, [remarkAnciensLiensDuGuide, { base, adresse }]],
    }));
  }
  return (await (await processeursDuGuide.get(base)).render(avecPrefixe(md, base), { frontmatter: { status: 'example' } })).code;
}

/** Le HTML d'un Markdown tel que la page le montre : rendu (rendreLeMarkdown), puis ses balises du glossaire (`vocabulaire` : [{ id, libelle, description }]). */
export const rendreCommeLaPage = async (md, vocabulaire) => htmlAvecMotsCles(await rendreLeMarkdown(md), vocabulaire).html;

const kebab = (nom) => nom.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
/** hast (HTML analysé) → l'arbre simple de lib/markdown-edition.mjs, comme arbreDuDom le tire du DOM. */
function arbre(n) {
  if (n.type === 'text') return { type: 'texte', valeur: n.value };
  if (n.type !== 'element') return null;
  const attributs = {};
  for (const [nom, valeur] of Object.entries(n.properties ?? {})) {
    if (valeur === false || valeur === null || valeur === undefined) continue;
    attributs[nom === 'className' ? 'class' : /^data[A-Z]/.test(nom) ? kebab(nom) : nom.toLowerCase()] = Array.isArray(valeur) ? valeur.join(' ') : String(valeur);
  }
  return { type: 'element', nom: n.tagName, attributs, enfants: (n.children ?? []).map(arbre).filter(Boolean) };
}
/** Les nœuds d'un fragment HTML, en arbre simple (l'entrée de versMarkdown). */
export const enfantsDuHtml = (html) => fromHtml(html, { fragment: true }).children.map(arbre).filter(Boolean);

/** Le HTML sans les espaces entre balises (ils ne changent pas le rendu). */
export const normal = (html) => html.replace(/\s+/g, ' ').replace(/>\s+</g, '><').replace(/\s+</g, '<').replace(/>\s+/g, '>').trim();
