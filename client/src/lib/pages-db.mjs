// Pages du wiki <-> base : la base (data/rows) est la source des pages ; les fichiers `.md` de client/src/content/wiki/ sont un PRODUIT du build (ignorés par git),
// fabriqués par `scripts/db-export-pages.mjs` pour que le site (Astro, wikilinks, outils d'import) les lise comme avant.
// Format écrit : le sous-ensemble strict de YAML que les importeurs (tools/sheets/*.py) écrivent déjà, lu par tools/db/pages_md.py et par le site.
import { DatabaseSync } from 'node:sqlite';

const j = (v) => JSON.stringify(v);
const liste = (v) => `[${v.map(j).join(', ')}]`;

/** Famille dont les importeurs écrivent leurs champs structurés AVANT `summary` (pages de magies) : même octets que ce qu'ils produisent. */
const EXTRAS_AVANT_RESUME = new Set(['magies']);

/** Texte d'un fichier `.md` à partir d'une page de la base : { id, titre, resume, donnees (objet|null), corps_md, statut, origine, aliases[], tags[], sources[] }. */
export function emettrePage(p) {
  const extras = Object.entries(p.donnees ?? {}).map(([cle, valeur]) => `${cle}: ${Array.isArray(valeur) ? liste(valeur) : Number.isInteger(valeur) ? String(valeur) : j(valeur)}`);
  const resume = p.resume === null || p.resume === undefined ? [] : [`summary: ${j(p.resume)}`];
  const entete = ['---', `title: ${j(p.titre)}`, `aliases: ${liste(p.aliases)}`, `tags: ${liste(p.tags)}`];
  if (EXTRAS_AVANT_RESUME.has(p.origine)) entete.push(...extras, ...resume);
  else entete.push(...resume, ...extras);
  entete.push(`sources: ${liste(p.sources)}`, `status: ${p.statut}`, '---');
  return `${entete.join('\n')}\n\n${p.corps_md}`;
}

/** Toutes les pages de la base, avec leurs alias, mots-clés et sources, triées par identifiant. */
export function lirePages(db) {
  const regrouper = (sql) => {
    const m = new Map();
    for (const r of db.prepare(sql).all()) (m.get(r.page_id) ?? m.set(r.page_id, []).get(r.page_id)).push(r.v);
    return m;
  };
  const aliases = regrouper('SELECT page_id, texte AS v FROM alias ORDER BY page_id, ordre');
  const tags = regrouper('SELECT page_id, libelle AS v FROM page_tag ORDER BY page_id, ordre');
  const sources = regrouper('SELECT ps.page_id, s.texte AS v FROM page_source ps JOIN source s ON s.id = ps.source_id ORDER BY ps.page_id, ps.ordre');
  return db.prepare('SELECT id, type, slug, titre, resume, donnees, corps_md, statut, origine FROM page ORDER BY id').all().map((r) => ({
    ...r,
    donnees: r.donnees ? JSON.parse(r.donnees) : null,
    aliases: aliases.get(r.id) ?? [],
    tags: tags.get(r.id) ?? [],
    sources: sources.get(r.id) ?? [],
  }));
}

export const ouvrirEnLectureSeule = (chemin) => new DatabaseSync(chemin, { readOnly: true });
