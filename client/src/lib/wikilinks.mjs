// Liens `[[…]]` du wiki : index des pages, résolution et plugin remark (lib/wikilinks-remark.mjs, pur : le navigateur du site de dev l'emploie aussi).
//
// Syntaxes : [[Titre]]  [[Alias]]  [[slug]]  [[races/slug]]  [[Titre|texte affiché]]
// La résolution ignore casse, accents et apostrophes (voir text.mjs).
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { TYPE_KEYS } from './types.mjs';
import { buildIndex, extractLinks, resolve } from './wikilinks-resolution.mjs';
import { entryUrl, remarkWikilinks } from './wikilinks-remark.mjs';

// L'index, la résolution et l'extraction des liens sont dans lib/wikilinks-resolution.mjs (sans dépendance : le service les emploie aussi,
// lib/citations-db.mjs) ; ils restent exportés d'ici, comme avant.
export { buildIndex, entryUrl, extractLinks, remarkWikilinks, resolve };

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
