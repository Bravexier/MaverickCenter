// Plugin remark des liens `[[…]]` du wiki : remplace chaque lien par un lien vers sa page (ou un repère « page manquante »).
// Pur, sans dépendance navigateur ni Astro (ni node:fs : lib/wikilinks.mjs, qui le réexporte, lit les pages sur le disque) : déclaré par astro.config.mjs et
// lib/guide-rendu.ts au build, et par lib/markdown-rendu.mjs dans le navigateur du site de dev.
import { cheminDePage } from './metiers.mjs';
import { WIKILINK_SOURCE, resolve } from './wikilinks-resolution.mjs';

/** Adresse d'une page (un métier : sa ligne du tableau de /metiers/, voir metiers.mjs). */
export function entryUrl(base, entry) {
  return `${base.replace(/\/$/, '')}/${cheminDePage(`${entry.type}/${entry.slug}`)}`;
}

/**
 * Plugin remark : remplace `[[…]]` par des liens (ou un repère « page manquante »). `avertir: false` : pas d'avertissement dans la console pour un lien
 * qui ne mène nulle part (le navigateur du site de dev, dont l'index est celui de la base vivante).
 */
export function remarkWikilinks({ index, base = '/', avertir = true }) {
  const pattern = new RegExp(WIKILINK_SOURCE, 'g');

  function convert(value, file) {
    const nodes = [];
    let last = 0;
    for (const match of value.matchAll(pattern)) {
      if (match.index > last) nodes.push({ type: 'text', value: value.slice(last, match.index) });
      const target = match[1].trim();
      const label = (match[2] ?? match[1]).trim();
      const found = resolve(index, target);
      if (found?.entry) {
        nodes.push({
          type: 'link',
          url: entryUrl(base, found.entry),
          title: null,
          children: [{ type: 'text', value: label }],
          // data-cible : la cible telle qu'écrite, que l'éditeur du guide (lib/markdown-edition.mjs) réécrit en [[cible|texte]]
          data: { hProperties: { className: ['wikilink'], 'data-cible': target } },
        });
      } else {
        const why = found?.ambiguous ? 'ambigu' : 'introuvable';
        // Les pages de démonstration peuvent pointer vers des pages masquées (HIDE_EXAMPLES) : pas d'alerte.
        if (avertir && file?.data?.astro?.frontmatter?.status !== 'example') {
          console.warn(`[wikilinks] [[${target}]] ${why} dans ${file?.path ?? '?'}`);
        }
        nodes.push({
          type: 'emphasis',
          children: [{ type: 'text', value: label }],
          data: {
            hName: 'span',
            hProperties: { className: ['wikilink', 'wikilink--missing'], title: `Page ${why}`, 'data-cible': target },
          },
        });
      }
      last = match.index + match[0].length;
    }
    if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
    return nodes;
  }

  function walk(node, file) {
    if (!node.children || node.type === 'link' || node.type === 'linkReference') return;
    node.children = node.children.flatMap((child) => {
      if (child.type === 'text' && child.value.includes('[[')) return convert(child.value, file);
      walk(child, file);
      return [child];
    });
  }

  return (tree, file) => walk(tree, file);
}
