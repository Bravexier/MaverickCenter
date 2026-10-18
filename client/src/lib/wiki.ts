import { getCollection, type CollectionEntry } from 'astro:content';
import { buildIndex, extractLinks, resolve } from './wikilinks.mjs';
import { TYPES } from './types.mjs';
import { cheminDePage } from './metiers.mjs';

export type WikiEntry = CollectionEntry<'wiki'>;
export type TypeKey = keyof typeof TYPES;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** URL absolue (avec le préfixe de déploiement) d'un chemin du site. */
export const url = (path = '') => `${base}/${path.replace(/^\//, '')}`;
/** Lien vers une page du wiki ; pour un métier, sa ligne du tableau de /metiers/ (lib/metiers.mjs). */
export const entryHref = (entry: WikiEntry) => url(cheminDePage(entry.id));
export const typeOf = (entry: WikiEntry) => entry.id.split('/')[0] as TypeKey;
export const slugOf = (entry: WikiEntry) => entry.id.split('/')[1];
export const byTitle = (a: WikiEntry, b: WikiEntry) => a.data.title.localeCompare(b.data.title, 'fr');

let cache: ReturnType<typeof compute> | undefined;

async function compute() {
  const hideExamples = process.env.HIDE_EXAMPLES === '1';
  const entries = (await getCollection('wiki', ({ data }) => !(hideExamples && data.status === 'example'))).sort(byTitle);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const index = buildIndex(
    entries.map((e) => ({ id: e.id, type: typeOf(e), slug: slugOf(e), title: e.data.title, aliases: e.data.aliases })),
  );

  const outgoing = new Map<string, WikiEntry[]>();
  const incoming = new Map<string, WikiEntry[]>();
  const unresolved: { from: string; target: string }[] = [];
  for (const entry of entries) {
    const targets = new Map<string, WikiEntry>();
    for (const { target } of extractLinks(entry.body ?? '')) {
      const hit = resolve(index, target)?.entry;
      const found = hit && byId.get(hit.id);
      if (found && found.id !== entry.id) targets.set(found.id, found);
      else if (!found) unresolved.push({ from: entry.id, target });
    }
    outgoing.set(entry.id, [...targets.values()].sort(byTitle));
    for (const found of targets.values()) {
      incoming.set(found.id, [...(incoming.get(found.id) ?? []), entry].sort(byTitle));
    }
  }

  // les mots-clés ne sont plus regroupés ici : leur vocabulaire est dans la base (lib/mots-cles-db.mjs), leurs éléments dans l'index de la recherche
  return { entries, outgoing, incoming, unresolved };
}

/** Pages du wiki + graphe de liens (mis en cache pour tout le build). */
export const loadWiki = () => (cache ??= compute());

export const entriesOfType = (entries: WikiEntry[], type: string) => entries.filter((e) => typeOf(e) === type);

/**
 * Les pages servies sous un chemin du plan du site (lib/livres.mjs : « decouvrir/ », « regles/ », « mj/ »), pour le paramètre de reste de leur route
 * (pages/decouvrir/[...page].astro…) : [{ entry, reste }] (`reste` : le chemin de la page sans `prefixe` ni barre de fin ; undefined pour la page servie
 * au chemin même, la première d'un livre). Une page servie par une autre (ancre) n'y est pas.
 */
export const pagesSous = (entries: WikiEntry[], prefixe: string) =>
  entries.flatMap((entry) => {
    const chemin = cheminDePage(entry.id);
    if (!chemin.startsWith(prefixe) || chemin.includes('#')) return [];
    const reste = chemin.slice(prefixe.length).replace(/\/$/, '');
    return [{ entry, reste: reste || undefined }];
  });
