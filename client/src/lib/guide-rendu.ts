import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { buildIndex, remarkWikilinks } from './wikilinks.mjs';
import { remarkCouleursDeCase } from './markdown-couleurs.mjs';
import { remarkMonnaies } from './markdown-monnaies.mjs';
import { adresseDesAnciensLiens, avecPrefixe, remarkAnciensLiensDuGuide } from './guide.mjs';
import { ACCUEIL_DU_GUIDE } from './livres.mjs';
import { cheminDePage } from './metiers.mjs';
import { loadWiki, slugOf, typeOf } from './wiki';

// Rendu Markdown des pages du guide (lib/guide.mjs) : une page est coupée à ses blocs tirés de la base, chaque morceau de texte est rendu ici
// avec les mêmes plugins ([[liens]], couleur des cases, monnaies) que les autres pages (astro.config.mjs), sur l'index des pages chargées (lib/wiki.ts).
// Un lien Markdown écrit vers une ancienne adresse du guide (« [les postures](/guide/les-postures/) ») mène à la nouvelle adresse de la page
// (lib/livres.mjs, par lib/guide.mjs#adresseDesAnciensLiens) et garde l'adresse écrite en `data-lien-ecrit` (lib/guide.mjs#remarkAnciensLiensDuGuide) :
// le texte de la base n'est réécrit ni au rendu ni par l'éditeur du guide, qui la relit (lib/markdown-edition.mjs#versMarkdown).

let processeur: ReturnType<typeof createMarkdownProcessor> | undefined;

async function creer() {
  const { entries } = await loadWiki();
  const pages = new Set(entries.map((e) => e.id));
  const index = buildIndex(entries.map((e) => ({ id: e.id, type: typeOf(e), slug: slugOf(e), title: e.data.title, aliases: e.data.aliases })));
  const adresse = (chemin: string) => adresseDesAnciensLiens(chemin, { cheminDe: cheminDePage, existe: (page: string) => pages.has(page), accueil: ACCUEIL_DU_GUIDE });
  return createMarkdownProcessor({
    syntaxHighlight: false,
    remarkPlugins: [[remarkWikilinks, { index, base: import.meta.env.BASE_URL }], remarkCouleursDeCase, remarkMonnaies,
      [remarkAnciensLiensDuGuide, { base: import.meta.env.BASE_URL, adresse }]],
  });
}

/** HTML d'un morceau de Markdown. `id` (« guide/le-combat ») sert aux avertissements des liens cassés. */
export async function rendreMarkdown(markdown: string, id: string, status?: string) {
  const rendu = await (processeur ??= creer());
  const { code } = await rendu.render(avecPrefixe(markdown, import.meta.env.BASE_URL), { fileURL: new URL(`file:///${id}.md`), frontmatter: { status } });
  return code;
}

/** HTML d'une phrase de la base qui peut contenir des [[liens]] : sans le paragraphe qui l'entoure. */
export async function rendreLigne(texte: string, id: string) {
  return (await rendreMarkdown(texte, id)).replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
}
