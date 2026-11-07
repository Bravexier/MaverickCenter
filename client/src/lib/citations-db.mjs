// Les citations d'une page du wiki dans la base (lot de l'édition des menus et des pages : « Refus si citée, puis 404 » — une page des Règles ne se
// supprime pas tant que d'autres la citent ; le service donne leur liste). Lues dans les TEXTES de la base, pas dans la table `lien` (dérivée au
// build, périmée sur le site de dev dès qu'un texte change) :
//   - un lien du wiki `[[…]]` (résolu comme le site : lib/wikilinks-resolution.mjs, index des titres, slugs et alias de toutes les pages ; un lien
//     ambigu dont la page est une candidate compte aussi : la supprimer changerait sa cible) ;
//   - un lien écrit vers son adresse, `/regles/<slug>/` (ou l'ancienne `/regles/avancees/<slug>/`), ou vers son identifiant `guide/<slug>` ;
//   - un bloc de description de la chronologie qui la cite pour légende (evenement_extrait.page_id) ;
//   - depuis la migration 0098 (les liens devenus des balises du glossaire) : une balise dont le mot-clé a une adresse qui mène à la page
//     (lib/adresses-db.mjs#pageDeLAdresse ; la supprimer laisserait la balise sans page), et le mot-clé lui-même, dont l'adresse mènerait nulle part
//     (mot_cle.url : db:check la refuserait) — à retirer d'abord sur /recherche/, sauf celle d'un mot-clé verrouillé, qui ne change pas : la page ne
//     se supprime pas (décision R221, motsClesVerrouillesQuiYMenent).
// Les textes lus sont ceux de lib/mots-cles-db.mjs#textesDeLaBase (toutes les colonnes TEXT des tables des règles, hors traces, tables dérivées,
// fiches, journal et notes), sans les colonnes de clé (primaire ou étrangère : une relation, pas un texte ; lib/pages-protegees.mjs en tient
// compte). La page elle-même ne se cite pas. Une citation depuis une page d'exemple (statut `example`) est rendue avec `exemple: true` : elle ne bloque
// pas une suppression.
// Pur, sans dépendance navigateur ni Astro : la base est passée par l'appelant (la base vivante du service, une copie dans les tests).
import { indexDesAdresses, pageDeLAdresse } from './adresses-db.mjs';
import { nomDeTable } from './libelles-de-la-base.mjs';
import { lireBalises, motCleDeLaRef, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { motsClesDeLaBase, textesDeLaBase } from './mots-cles-db.mjs';
import { buildIndex, extractLinks, resolve } from './wikilinks-resolution.mjs';

/** Un lien écrit vers une page des onglets (/regles/<slug>/, /regles/avancees/<slug>/) ou vers son identifiant (guide/<slug>) : le slug. */
const ADRESSE_ECRITE = /(?<![a-z0-9_-])(?:regles\/(?:avancees\/)?|guide\/)([a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9_-])/g;

/** Les colonnes de mot_cle qui ne sont pas un texte (migration 0098) : l'adresse et la couleur. */
const COLONNES_DU_LIEN = ['url', 'couleur'];

/** Les colonnes de clé d'une table (primaire et étrangères) : jamais lues comme un texte. */
function colonnesDeCle(db, table) {
  const cles = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().filter((c) => c.pk).map((c) => c.name));
  for (const f of db.prepare(`PRAGMA foreign_key_list("${table}")`).all()) cles.add(f.from);
  return cles;
}

/**
 * Les citations de chacune des pages `ids` : Map(id → [{ table, cle, colonne, comment, page, libelle, exemple }]) — `comment` : 'lien' (`[[…]]`),
 * 'adresse' (un lien écrit vers son adresse ou son identifiant), 'chronologie' (evenement_extrait.page_id), 'balise' (la balise d'un mot-clé qui y
 * mène, migration 0098), 'mot-cle' (le mot-clé dont l'adresse y mène : table mot_cle, colonne url) ; `page` : { id, titre } de la page qui
 * cite (null hors de la table page) ; `libelle` : ce qui cite, en français (le titre de la page, « Chronologie › <événement> », sinon le nom de la
 * table et la clé) ; `exemple` : la page qui cite est une page d'exemple (ne bloque pas). Une ligne qui cite deux fois la même page par la même
 * colonne n'est rendue qu'une fois. Un seul passage sur les textes de la base, quel que soit le nombre de pages demandées (GET /api/edition/plan/).
 * `absentes` : des pages qui ne sont plus dans la base, telles qu'elles étaient ([{ id, type, slug, titre, alias: [textes] }] : une page qu'un lot
 * rejoué vient de supprimer, serveur/edition.mjs#liensRompusParLeLot) ; elles entrent dans l'index des liens comme les autres, sans quoi un lien écrit
 * par leur titre ou un alias (« [[Titre]] », « [[alias|texte]] ») ne se résoudrait plus vers elles, et dans l'index des adresses (leur adresse,
 * lib/adresses-db.mjs#adresseDeLaPage), sans quoi le mot-clé dont l'adresse y mène et ses balises ne les citeraient plus.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Iterable<string>} ids
 * @param {{ absentes?: { id: string, type: string, slug: string, titre: string, alias?: string[] }[] }} [options]
 */
export function citationsDesPages(db, ids, { absentes = [] } = {}) {
  const voulues = new Set(ids);
  const sortie = new Map([...voulues].map((id) => [id, []]));
  if (!voulues.size) return sortie;
  const pages = db.prepare('SELECT id, type, slug, titre, statut FROM page').all();
  const parId = new Map(pages.map((p) => [p.id, p]));
  const alias = new Map();
  for (const a of db.prepare('SELECT page_id, texte FROM alias ORDER BY page_id, ordre').all()) (alias.get(a.page_id) ?? alias.set(a.page_id, []).get(a.page_id)).push(a.texte);
  const enPlus = absentes.filter((p) => !parId.has(p.id));
  const index = buildIndex([
    ...pages.map((p) => ({ id: p.id, type: p.type, slug: p.slug, title: p.titre, aliases: alias.get(p.id) ?? [] })),
    ...enPlus.map((p) => ({ id: p.id, type: p.type, slug: p.slug, title: p.titre, aliases: p.alias ?? [] })),
  ]);
  // les slugs des pages demandées que les adresses écrites désignent (guide/<slug> et /regles/<slug>/ : les pages du guide)
  const parSlug = new Map([...voulues].filter((id) => id.startsWith('guide/')).map((id) => [id.slice('guide/'.length), id]));
  const vues = new Set();
  const ajouter = (id, { table, cle, colonne, comment, ligne = null }) => {
    if (!voulues.has(id)) return;
    if (table === 'page' && cle.id === id) return; // la page elle-même
    const cle_ = `${id}\u0000${table}\u0000${JSON.stringify(cle)}\u0000${colonne}`;
    if (vues.has(cle_)) return;
    vues.add(cle_);
    const page = table === 'page' ? parId.get(cle.id) ?? null : null;
    const libelle = page ? page.titre
      : table === 'evenement_extrait' ? `Chronologie › ${ligne?.evenement_titre ?? cle.evenement_id}`
        : table === 'mot_cle' && comment === 'mot-cle' ? `Mot-clé « ${ligne?.libelle ?? cle.id} » (son lien)`
          : `${nomDeTable(table) ?? table} ${Object.values(cle).join(' › ')}`;
    sortie.get(id).push({ table, cle, colonne, comment, page: page ? { id: page.id, titre: page.titre } : null, libelle, exemple: page?.statut === 'example' });
  };

  // les mots-clés qui mènent à une des pages demandées (migration 0098 : mot_cle.url ; aucun sur une base d'avant) ; une page absente entre dans
  // l'index à son adresse, sans quoi le mot-clé qui y mène, et ses balises, ne la citeraient plus (liensRompusParLeLot)
  const adresses = indexDesAdresses(db, { exemples: true, enPlus: enPlus.map((p) => p.id) });
  const motsCles = motsClesDeLaBase(db);
  const vocabulaire = vocabulaireDesMotsCles(motsCles);
  const pageDuMotCle = new Map();
  for (const m of motsCles) {
    const id = m.url ? pageDeLAdresse(adresses, m.url) : null;
    if (id === null || !voulues.has(id)) continue;
    pageDuMotCle.set(m.id, id);
    ajouter(id, { table: 'mot_cle', cle: { id: m.id }, colonne: 'url', comment: 'mot-cle', ligne: m });
  }

  const parTable = new Map();
  for (const t of textesDeLaBase(db)) (parTable.get(t.table) ?? parTable.set(t.table, []).get(t.table)).push(t);
  for (const [table, textes] of parTable) {
    const cles = colonnesDeCle(db, table);
    // l'adresse d'un mot-clé (mot_cle.url, migration 0098) cite sa page comme le mot-clé (plus haut), pas comme une adresse écrite dans un texte
    const colonnes = textes.filter((t) => !cles.has(t.colonne) && !(table === 'mot_cle' && COLONNES_DU_LIEN.includes(t.colonne))).map((t) => t.colonne);
    if (!colonnes.length) continue;
    const pk = textes[0].cle;
    const q = (c) => (c === 'rowid' ? 'rowid' : `"${c}"`);
    const balises = pageDuMotCle.size ? (c) => ` OR instr(${q(c)}, '{{') > 0` : () => '';
    const ou = colonnes.map((c) => `instr(${q(c)}, '[[') > 0 OR instr(${q(c)}, 'regles/') > 0 OR instr(${q(c)}, 'guide/') > 0${balises(c)}`).join(' OR ');
    const markdown = new Map(textes.map((t) => [t.colonne, t.markdown]));
    for (const l of db.prepare(`SELECT ${[...new Set([...pk, ...colonnes])].map(q).join(', ')} FROM "${table}" WHERE ${ou}`).all()) {
      const cle = Object.fromEntries(pk.map((c) => [c, l[c]]));
      for (const colonne of colonnes) {
        const v = l[colonne];
        if (typeof v !== 'string') continue;
        if (v.includes('[[')) {
          for (const { target } of extractLinks(v)) {
            const r = resolve(index, target);
            for (const e of r?.entry ? [r.entry] : r?.ambiguous ?? []) ajouter(e.id, { table, cle, colonne, comment: 'lien' });
          }
        }
        if (parSlug.size && (v.includes('regles/') || v.includes('guide/'))) {
          for (const m of v.matchAll(ADRESSE_ECRITE)) if (parSlug.has(m[1])) ajouter(parSlug.get(m[1]), { table, cle, colonne, comment: 'adresse' });
        }
        if (pageDuMotCle.size && v.includes('{{')) {
          for (const b of lireBalises(v, { markdown: markdown.get(colonne) })) {
            const id = pageDuMotCle.get(motCleDeLaRef(vocabulaire, b.ref)?.id);
            if (id) ajouter(id, { table, cle, colonne, comment: 'balise' });
          }
        }
      }
    }
  }
  // la légende d'un bloc de description de la chronologie (une clé étrangère, lue à part)
  const aLaChronologie = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('evenement_extrait', 'evenement')").get().n === 2;
  if (aLaChronologie) {
    for (const b of db.prepare('SELECT x.evenement_id, x.rang, x.page_id, e.titre AS evenement_titre FROM evenement_extrait x JOIN evenement e ON e.id = x.evenement_id WHERE x.page_id IS NOT NULL ORDER BY x.evenement_id, x.rang').all()) {
      ajouter(b.page_id, { table: 'evenement_extrait', cle: { evenement_id: b.evenement_id, rang: b.rang }, colonne: 'page_id', comment: 'chronologie', ligne: b });
    }
  }
  for (const liste of sortie.values()) liste.sort((a, b) => Number(a.exemple) - Number(b.exemple) || a.libelle.localeCompare(b.libelle, 'fr') || a.colonne.localeCompare(b.colonne));
  return sortie;
}

/**
 * Les citations de la page `id` dans la base (citationsDesPages, `options` comprises) : [{ table, cle, colonne, comment, page, libelle, exemple }],
 * celles des pages d'exemple en dernier.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} id
 */
export const citationsDe = (db, id, options = {}) => citationsDesPages(db, [id], options).get(id);

/** Les citations qui empêchent une suppression : toutes, sauf celles des pages d'exemple. */
export const citationsBloquantes = (citations) => citations.filter((c) => !c.exemple);

/**
 * Décision R221 : les mots-clés verrouillés (mot_cle.verrou = 1, migration 0110 ; R218, R219) dont l'adresse mène à la page, parmi ses `citations`
 * (comment 'mot-cle', citationsDesPages) : [{ id, libelle }], dans l'ordre des citations. Leur adresse ne se change ni ne se vide depuis le site :
 * la page ne s'y supprime pas. Vide sur une base d'avant la 0110 (sans la colonne).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function motsClesVerrouillesQuiYMenent(db, citations) {
  const ids = [...new Set(citations.filter((c) => c.table === 'mot_cle' && c.comment === 'mot-cle').map((c) => c.cle.id))];
  if (!ids.length || !db.prepare('PRAGMA table_info(mot_cle)').all().some((c) => c.name === 'verrou')) return [];
  const lire = db.prepare('SELECT id, libelle FROM mot_cle WHERE id = ? AND verrou = 1');
  return ids.map((id) => lire.get(id)).filter(Boolean).map((m) => ({ id: m.id, libelle: m.libelle }));
}

/** Décision R221 : le refus de supprimer `nom` (une page, un métier, un don) vers lequel mènent les mots-clés verrouillés `motsCles` (non vide). */
export function refusDuMotCleVerrouille(nom, motsCles) {
  const noms = motsCles.map((m) => `« ${m.libelle} »`).join(', ');
  return `« ${nom} » ne se supprime pas sur le site : ${motsCles.length > 1 ? `les mots-clés verrouillés ${noms} y mènent` : `le mot-clé verrouillé ${noms} y mène`} (décision R221).`;
}
