// Liens `[[…]]` du wiki : index des pages, résolution et plugin remark.
//
// Syntaxes : [[Titre]]  [[Alias]]  [[slug]]  [[races/slug]]  [[Titre|texte affiché]]
// La résolution ignore casse, accents et apostrophes (voir text.mjs).
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { normalize } from './text.mjs';
import { TYPE_KEYS } from './types.mjs';

const WIKILINK_SOURCE = String.raw`\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]`;

/** Découpe un fichier Markdown en { data, body } (frontmatter YAML optionnel). */
export function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  return { data: parseYaml(match[1]) ?? {}, body: match[2] };
}

/** Lit src/content/wiki/<type>/*.md et renvoie les métadonnées de chaque page. */
export function scanContent(contentDir) {
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

/** Construit la table clé normalisée -> pages. `entries` : { id, type, slug, title, aliases }. */
export function buildIndex(entries) {
  const keys = new Map();
  const add = (key, entry) => {
    if (!key) return;
    const list = keys.get(key) ?? [];
    if (!list.includes(entry)) list.push(entry);
    keys.set(key, list);
  };
  for (const entry of entries) {
    add(normalize(entry.slug), entry);
    add(normalize(entry.title), entry);
    for (const alias of entry.aliases) add(normalize(alias), entry);
  }
  return { entries, keys, byId: new Map(entries.map((e) => [e.id, e])) };
}

/** @returns {{ entry?: object, ambiguous?: object[] } | null} */
export function resolve(index, target) {
  const wanted = target.trim();
  if (wanted.includes('/')) {
    const entry = index.byId.get(wanted.toLowerCase());
    return entry ? { entry } : null;
  }
  const hits = index.keys.get(normalize(wanted));
  if (!hits) return null;
  return hits.length === 1 ? { entry: hits[0] } : { ambiguous: hits };
}

/** Cibles `[[…]]` d'un corps Markdown, hors blocs et codes en ligne. */
export function extractLinks(body) {
  const clean = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...clean.matchAll(new RegExp(WIKILINK_SOURCE, 'g'))].map((m) => ({
    target: m[1].trim(),
    label: (m[2] ?? m[1]).trim(),
  }));
}

export function entryUrl(base, entry) {
  return `${base.replace(/\/$/, '')}/wiki/${entry.type}/${entry.slug}/`;
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
          data: { hProperties: { className: ['wikilink'] } },
        });
      } else {
        const why = found?.ambiguous ? 'ambigu' : 'introuvable';
        console.warn(`[wikilinks] [[${target}]] ${why} dans ${file?.path ?? '?'}`);
        nodes.push({
          type: 'emphasis',
          children: [{ type: 'text', value: label }],
          data: {
            hName: 'span',
            hProperties: { className: ['wikilink', 'wikilink--missing'], title: `Page ${why}` },
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
