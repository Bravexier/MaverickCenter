// Pages du wiki <-> base : la base (data/rows) est la source des pages ; les fichiers `.md` de client/src/content/wiki/ sont un PRODUIT du build (ignorés par git),
// fabriqués par `scripts/db-export-pages.mjs` pour que le site (Astro, wikilinks, outils d'import) les lise comme avant.
// Format écrit : le sous-ensemble strict de YAML que les importeurs (tools/sheets/*.py) écrivent déjà, lu par tools/db/pages_md.py et par le site.
import { DatabaseSync } from 'node:sqlite';
import { nomDuProtege } from './mots-cles-proteges.mjs';
import { normalize } from './text.mjs';

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

/**
 * L'écriture d'un mot-clé ({ libelle, cle }) dans le `tags:` d'une page : son libellé quand il mène à lui seul (sa clé est le slug de son libellé),
 * sinon sa clé (un homonyme, migration 0113 ; décision R232 (4) : un libellé partagé est ambigu).
 */
export const ecritureDuTag = (m) => (normalize(m.libelle) === m.cle ? m.libelle : m.cle);

/** Toutes les pages de la base, avec leurs alias, mots-clés et sources, triées par identifiant. */
export function lirePages(db) {
  const regrouper = (sql) => {
    const m = new Map();
    for (const r of db.prepare(sql).all()) (m.get(r.page_id) ?? m.set(r.page_id, []).get(r.page_id)).push(r.v);
    return m;
  };
  const aliases = regrouper('SELECT page_id, texte AS v FROM alias ORDER BY page_id, ordre');
  // l'écriture d'un mot-clé dans `tags:` : son libellé, sauf pour un homonyme (migration 0113 : sa clé n'est plus le slug de son libellé, que
  // d'autres portent) — sa clé, que tools/db/maverick.py#trouver_mot_cle relit d'abord (la règle de maverick.py#vocabulaire_des_mots_cles)
  const colonnes = db.prepare('PRAGMA table_info(mot_cle)').all().map((c) => c.name);
  const cle = colonnes.includes('cle') ? 'm.cle' : 'm.libelle_cle';
  const tags = new Map();
  for (const r of db.prepare(`SELECT t.page_id, m.libelle, ${cle} AS cle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id ORDER BY t.page_id, t.ordre`).all()) {
    (tags.get(r.page_id) ?? tags.set(r.page_id, []).get(r.page_id)).push(ecritureDuTag(r));
  }
  const sources = regrouper('SELECT ps.page_id, s.texte AS v FROM page_source ps JOIN source s ON s.id = ps.source_id ORDER BY ps.page_id, ps.ordre');
  return db.prepare('SELECT id, type, slug, titre, resume, donnees, corps_md, statut, origine FROM page ORDER BY id').all().map((r) => ({
    ...r,
    donnees: r.donnees ? JSON.parse(r.donnees) : null,
    aliases: aliases.get(r.id) ?? [],
    tags: tags.get(r.id) ?? [],
    sources: sources.get(r.id) ?? [],
  }));
}

/**
 * Les mots-clés dont le site se sert que porte chaque page (page_tag, dans l'ordre de la page), par leur nom (lib/mots-cles-proteges.mjs : « classe »,
 * « hybride-animal », « race-hybride »…), reconnus à leur id entier (`race-hybride`, sans id, à sa clé) : Map page_id → [nom]. Le `tags:` d'un `.md` donne
 * les écritures de tous ses mots-clés (l'affichage, la recherche) ; une règle qui range une page (lib/class-groups.mjs, lib/race-kinds.mjs,
 * lib/classe-magique.mjs) lit ces noms, posés en `data.mots_cles` par lib/wiki.ts (avecLesMotsCles) : un mot-clé renommé sur le site de dev ne
 * déplace aucune page (décision R195). Jamais écrits dans le `.md` (tools/db/pages_md.py lirait une clé de plus comme un champ de `page.donnees`).
 */
export function motsClesDesPages(db) {
  const m = new Map();
  for (const r of etiquettesDesPages(db)) {
    const nom = nomDuProtege(r);
    if (nom !== null) (m.get(r.page_id) ?? m.set(r.page_id, []).get(r.page_id)).push(nom);
  }
  return m;
}

/**
 * Les étiquettes des pages (page_tag), avec l'id et la clé du mot-clé (mot_cle.cle, migration 0113 ; libelle_cle avant) : [{ page_id, id, cle }], dans
 * l'ordre des pages ; `ou` : une condition SQL sur la page (`t.page_id`), sans paramètre.
 */
export function etiquettesDesPages(db, ou = '1') {
  const cle = db.prepare('PRAGMA table_info(mot_cle)').all().some((c) => c.name === 'cle') ? 'm.cle' : 'm.libelle_cle';
  return db.prepare(`SELECT t.page_id, t.tag_id AS id, ${cle} AS cle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id WHERE ${ou} ORDER BY t.page_id, t.ordre`).all();
}

/** Des pages ({ id, data }) avec les noms de leurs mots-clés protégés (`data.mots_cles`, motsClesDesPages), sans toucher aux objets reçus. */
export const avecLesMotsCles = (pages, parPage) => pages.map((e) => ({ ...e, data: { ...e.data, mots_cles: parPage.get(e.id) ?? [] } }));

export const ouvrirEnLectureSeule = (chemin) => new DatabaseSync(chemin, { readOnly: true });
