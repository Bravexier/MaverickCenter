import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { buildIndex, remarkWikilinks } from './wikilinks.mjs';
import { avecPrefixe } from './guide.mjs';
import { loadWiki, slugOf, typeOf } from './wiki';

// Rendu Markdown des chapitres du guide (lib/guide.mjs) : un chapitre est coupé à ses blocs tirés de la base, chaque morceau de texte est rendu ici
// avec le même plugin des [[liens]] que les autres pages (astro.config.mjs), sur l'index des pages chargées (lib/wiki.ts).

let processeur: ReturnType<typeof createMarkdownProcessor> | undefined;

async function creer() {
  const { entries } = await loadWiki();
  const index = buildIndex(entries.map((e) => ({ id: e.id, type: typeOf(e), slug: slugOf(e), title: e.data.title, aliases: e.data.aliases })));
  return createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [[remarkWikilinks, { index, base: import.meta.env.BASE_URL }]] });
}

/** HTML d'un morceau de Markdown. `id` (« guide/le-combat ») sert aux avertissements des liens cassés. */
export async function rendreMarkdown(markdown: string, id: string, status?: string) {
  const texte = avecPrefixe(markdown, import.meta.env.BASE_URL);
  const { code } = await (await (processeur ??= creer())).render(texte, { fileURL: new URL(`file:///${id}.md`), frontmatter: { status } });
  return code;
}

/** HTML d'une phrase de la base qui peut contenir des [[liens]] : sans le paragraphe qui l'entoure. */
export async function rendreLigne(texte: string, id: string) {
  return (await rendreMarkdown(texte, id)).replace(/^<p>([\s\S]*)<\/p>\s*$/, '$1');
}
