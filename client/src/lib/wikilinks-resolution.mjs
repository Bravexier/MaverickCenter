// Liens `[[…]]` du wiki : l'index des pages (clés normalisées : slug, titre, alias), la résolution d'une cible et l'extraction des cibles d'un texte.
// Syntaxes : [[Titre]]  [[Alias]]  [[slug]]  [[races/slug]]  [[Titre|texte affiché]] ; la résolution ignore casse, accents et apostrophes (text.mjs).
// Pur, sans dépendance (ni node:fs ni paquet) : lu par lib/wikilinks.mjs (le site, qui les réexporte), scripts/db-derive.mjs (par wikilinks.mjs) et
// le service (lib/citations-db.mjs : les pages qui en citent une autre), qui n'importe aucun paquet npm (serveur/livraison.mjs#modulesDuServeur).
import { normalize } from './text.mjs';

/** Un lien `[[cible]]` ou `[[cible|texte]]` (la source de l'expression : chaque appelant fait la sienne, drapeau `g`). */
export const WIKILINK_SOURCE = String.raw`\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]`;

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
    if (entry) return { entry };
    // sinon : un titre qui contient une barre oblique (« Résistance/Faiblesse Magie »), cherché comme un titre
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
