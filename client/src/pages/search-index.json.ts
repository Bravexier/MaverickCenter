import type { APIRoute } from 'astro';
import { TYPES } from '../lib/types.mjs';
import { entryHref, loadWiki, typeOf } from '../lib/wiki';

/** Texte brut approximatif d'une page, pour la recherche plein texte côté navigateur. */
function plainText(body: string) {
  return body
    .replace(/\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g, (_, target, label) => label ?? target)
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

export const GET: APIRoute = async () => {
  const { entries } = await loadWiki();
  const index = entries.map((entry) => ({
    title: entry.data.title,
    type: TYPES[typeOf(entry)].singular,
    href: entryHref(entry),
    summary: entry.data.summary ?? '',
    aliases: entry.data.aliases,
    tags: entry.data.tags,
    text: plainText(entry.body ?? ''),
  }));
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
