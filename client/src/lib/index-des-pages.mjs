// La ligne de l'index de recherche des pages (table dérivée `page_fts`, data/schema.sql) : le titre, les alias, les étiquettes, le résumé et le texte d'une page
// tels qu'ils s'affichent. Un seul calcul pour la fabrication (scripts/db-derive.mjs, qui refait tout l'index) et pour le service (serveur/index-des-pages.mjs,
// qui ajoute la ligne d'une page créée et retire celle d'une page partie) : les deux écrivent la même ligne. Sans dépendance navigateur ni Astro ; il lit la base
// qu'on lui donne (node:sqlite), il n'écrit rien.
import { sansAncresFigees } from './ancres-figees.mjs';
import { sansMarquesDOnglets } from './onglets-groupe.mjs';
import { texteSansBalises, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { motsClesDeLaBase } from './mots-cles-db.mjs';

/** L'insertion d'une ligne, dans l'ordre que rend `lignesDeLIndex`. */
export const INSERTION_DANS_L_INDEX = 'INSERT INTO page_fts (page_id, titre, alias, tag, resume, texte) VALUES (?, ?, ?, ?, ?, ?)';

/**
 * Texte brut pour la recherche, tel qu'il s'affiche : chaque balise du glossaire devient son texte affiché (le texte écrit, ou le libellé du mot-clé ;
 * « Libellé : définition » pour le mode complet ; une balise dans un code reste écrite : lib/mots-cles-balises.mjs#texteSansBalises) — depuis la
 * migration 0098, un lien est une balise sans texte, « {{lequipement}} », et seul son libellé, « L’équipement », se lit ; puis même nettoyage que
 * lib/recherche-index.ts#plainText, sans la coupe à 4000 caractères. Comme lib/recherche-index.ts, les lignes de marque d'un groupe d'onglets
 * (`::: onglets`, `:::` : lib/onglets-groupe.mjs#sansMarquesDOnglets), les ancres figées et la marque de couleur d'un intertitre (`{#ancre}`,
 * `{couleur:…}` : lib/ancres-figees.mjs#sansAncresFigees) ne s'affichent pas : elles ne s'indexent pas.
 */
export function textePlein(corps, vocabulaire) {
  return texteSansBalises(sansAncresFigees(sansMarquesDOnglets(corps ?? '')), vocabulaire, { markdown: true })
    .replace(/\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g, (_, cible, ancre) => ancre ?? cible)
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Le vocabulaire des balises tel que la base le donne (tous les mots-clés) : celui de la fabrication. */
export const vocabulaireDeLIndex = (db) => vocabulaireDesMotsCles(motsClesDeLaBase(db));

/**
 * Les lignes de l'index des pages `ids` (toutes si `ids` est null), par id croissant : [page_id, titre, alias, tag, resume, texte] — le titre et le résumé sans
 * balises, les écritures de la page (alias) et les libellés de ses étiquettes séparés par un retour à la ligne, dans leur ordre, le texte par `textePlein`.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ ids?: string[] | null, vocabulaire?: object }} [o] `vocabulaire` : celui de `vocabulaireDeLIndex(db)`, lu une fois par l'appelant qui en a déjà un
 */
export function lignesDeLIndex(db, { ids = null, vocabulaire = vocabulaireDeLIndex(db) } = {}) {
  const filtre = (colonne) => (ids ? ` WHERE ${colonne} IN (SELECT value FROM json_each(?))` : '');
  const params = ids ? [JSON.stringify(ids)] : [];
  const parPage = (lignes, valeur) => {
    const m = new Map();
    for (const r of lignes) (m.get(r.page_id) ?? m.set(r.page_id, []).get(r.page_id)).push(valeur(r));
    return m;
  };
  const alias = parPage(db.prepare(`SELECT page_id, texte FROM alias${filtre('page_id')} ORDER BY page_id, ordre`).all(...params), (r) => r.texte);
  const tags = parPage(db.prepare(`SELECT t.page_id, m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id${filtre('t.page_id')} ORDER BY t.page_id, t.ordre`).all(...params),
    (r) => r.libelle);
  const sans = (t) => texteSansBalises(t, vocabulaire);
  return db.prepare(`SELECT id, titre, resume, corps_md FROM page${filtre('id')} ORDER BY id`).all(...params).map((p) => [
    p.id, sans(p.titre), (alias.get(p.id) ?? []).join('\n'), (tags.get(p.id) ?? []).join('\n'), sans(p.resume ?? ''), textePlein(p.corps_md, vocabulaire),
  ]);
}
