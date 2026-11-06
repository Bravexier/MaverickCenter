// Liens `[[…]]` du wiki : index des pages, résolution et plugin remark.
//
// Syntaxes : [[Titre]]  [[Alias]]  [[slug]]  [[races/slug]]  [[Titre|texte affiché]]
// La résolution ignore casse, accents et apostrophes (voir text.mjs).
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { TYPE_KEYS } from './types.mjs';
import { cheminDePage } from './metiers.mjs';
import { WIKILINK_SOURCE, buildIndex, extractLinks, resolve } from './wikilinks-resolution.mjs';

// L'index, la résolution et l'extraction des liens sont dans lib/wikilinks-resolution.mjs (sans dépendance : le service les emploie aussi,
// lib/citations-db.mjs) ; ils restent exportés d'ici, comme avant.
export { buildIndex, extractLinks, resolve };

/** Découpe un fichier Markdown en { data, body } (frontmatter YAML optionnel). */
export function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  return { data: parseYaml(match[1]) ?? {}, body: match[2] };
}

/**
 * Lit src/content/wiki/<type>/*.md et renvoie les métadonnées de chaque page.
 * `includeExamples: false` écarte les pages `status: example` (version à montrer, voir HIDE_EXAMPLES).
 */
export function scanContent(contentDir, { includeExamples = true } = {}) {
  const entries = [];
  for (const type of TYPE_KEYS) {
    let files = [];
    try {
      files = readdirSync(join(contentDir, type)).filter((f) => f.endsWith('.md'));
    } catch {
      continue; // dossier absent : catégorie vide
    }
    for (const file of files) {
      const slug = basename(file, '.md');
      const { data } = splitFrontmatter(readFileSync(join(contentDir, type, file), 'utf8'));
      if (!includeExamples && data.status === 'example') continue;
      entries.push({
        id: `${type}/${slug}`,
        type,
        slug,
        title: String(data.title ?? slug),
        aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
      });
    }
  }
  return entries;
}

/** Adresse d'une page (un métier : sa ligne du tableau de /metiers/, voir metiers.mjs). */
export function entryUrl(base, entry) {
  return `${base.replace(/\/$/, '')}/${cheminDePage(`${entry.type}/${entry.slug}`)}`;
}

/** Plugin remark : remplace `[[…]]` par des liens (ou un repère « page manquante »). */
export function remarkWikilinks({ index, base = '/' }) {
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
        if (file?.data?.astro?.frontmatter?.status !== 'example') {
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
