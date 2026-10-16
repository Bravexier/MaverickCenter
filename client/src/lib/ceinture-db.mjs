// Page /ressources/objets-a-la-ceinture/ (menu Ressources ; demande du propriétaire, 2026-10-15 : « l'ensemble de tous les objets que les joueurs peuvent
// placer à la ceinture dans le but de pouvoir les utiliser comme un IC. De plus il faut parler aussi des bâtons magiques ») : chargée depuis la base,
// jamais depuis un Markdown. Quels objets : la vue v_objet_ceinture (décision R81 : toutes les potions et huiles, les carquois, sacs de bombes et sacs
// de pierres, les bâtons magiques ; pas le bouclier : décision R82 ; la liste du guide reste « non exhaustive »). Les bâtons magiques ont leur tableau
// dans l'onglet « Bâtons magiques » de la page « Équipement » (demande du propriétaire, 2026-10-16 : « qui auront mieux leur place ici » ;
// lib/batons-db.mjs), où la page renvoie : elle n'a pas de tableau pour eux. Les règles affichées sont des textes de la base, rendus par la page : le
// paragraphe « La ceinture » du chapitre « L'équipement » du guide et la section « Ceinture » de la page de référence (le texte du Google Doc, en dépliable).
// Sans dépendance : `chargerObjetsDeCeinture` reçoit la base ouverte par lib/donnees.mjs.

/** Le chapitre du guide dont la section « La ceinture » donne les règles, et la page de référence qui les détaille. */
export const CHAPITRE_DE_LA_CEINTURE = 'guide/l-equipement';
export const TITRE_DES_REGLES = '## La ceinture';
export const PAGE_DE_REFERENCE = 'guide/fiche-accessoires-et-ceinture';
export const TITRE_DE_LA_REFERENCE = '## Ceinture';

/**
 * Les tableaux de la page, dans l'ordre : `famille` de v_objet_ceinture, titre du tableau (les familles de recette du doc « Alchimie » : solvant
 * Fiole, Philtre, Remède, Huile, et l'alchimie primitive) et le titre du groupe sous lequel il se range (null : un tableau seul). Toutes les familles
 * de la vue, sauf `FAMILLE_DES_BATONS` (l'onglet « Bâtons magiques » de la page « Équipement »).
 */
export const FAMILLES_DE_LA_CEINTURE = Object.freeze([
  { famille: 'fiole', titre: 'Fioles', groupe: 'Potions' },
  { famille: 'philtre', titre: 'Philtres', groupe: 'Potions' },
  { famille: 'remede', titre: 'Remèdes', groupe: 'Potions' },
  { famille: 'primitive', titre: 'Alchimie primitive', groupe: 'Potions' },
  { famille: 'huile', titre: 'Huiles', groupe: null },
  { famille: 'contenant', titre: 'Carquois et sacs', groupe: null },
]);
/** La famille de v_objet_ceinture des bâtons magiques : pas de tableau sur la page, elle renvoie à l'onglet « Bâtons magiques » de la page « Équipement ». */
export const FAMILLE_DES_BATONS = 'baton';
const POTIONS = ['fiole', 'philtre', 'remede', 'primitive', 'huile'];

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const comparer = (a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' });

/**
 * La section d'un corps Markdown qui commence à la ligne `titre` (titre compris ou non), jusqu'au titre suivant de même niveau ou plus haut ;
 * null si la page ne l'écrit pas. `titre` null : l'introduction, avant le premier titre.
 */
export function sectionDuCorps(corps, titre, { avecTitre = false } = {}) {
  const l = String(corps ?? '').replace(/\r\n?/g, '\n').split('\n');
  // debut : la ligne du titre (-1 pour l'introduction, qui n'en a pas) ; la section s'arrête au titre suivant de même niveau ou plus haut
  const debut = titre === null ? -1 : l.findIndex((x) => x.trim() === titre);
  if (titre !== null && debut < 0) return null;
  const niveau = titre === null ? 6 : /^#+/.exec(titre)[0].length;
  const fin = l.findIndex((x, i) => i > debut && new RegExp(`^#{1,${niveau}} `).test(x));
  const morceau = l.slice(avecTitre && debut >= 0 ? debut : debut + 1, fin < 0 ? l.length : fin).join('\n').trim();
  return morceau || null;
}

/** Le corps et le titre d'une page de la base, ou null (une base sans exemples peut ne plus l'avoir). */
const pageDe = (db, id) => lignes(db, 'SELECT id, titre, resume, corps_md FROM page WHERE id = ?', id)[0] ?? null;

/**
 * Les données de la page :
 *   regles   : { ceinture, reference } : Markdown de la base (null si la page n'écrit plus la section), rendus par la page ;
 *   sources  : { chapitre, reference } : les pages d'où viennent ces règles, { id, titre } (leur titre se modifie sur le site de dev), ou null ;
 *   tableaux : un par famille de FAMILLES_DE_LA_CEINTURE, { famille, titre, groupe, nombre, ... } avec
 *              - potions et huiles : `pages` : [{ id, titre, resume, existe, potions: [{ id, nom, niveau, niveau_rang, prix_brut, effet }] }], une par page
 *                de potion (ordre alphabétique du titre ; `existe` : la page est dans la base, son titre peut être un lien), ses paliers dans l'ordre où la
 *                page écrit leurs noms, puis leur rang (ressource.ordre) et leur niveau ;
 *              - carquois et sacs : `objets` : [{ id, nom, prix_brut, description }] dans l'ordre de l'onglet « Équipement inventaire ».
 *   `nombre` : le nombre d'objets du tableau (lignes de v_objet_ceinture).
 */
export function chargerObjetsDeCeinture(db) {
  const vue = lignes(db, 'SELECT famille, ressource_id, baton_id FROM v_objet_ceinture');
  const de = (famille) => vue.filter((v) => v.famille === famille);
  const tableaux = FAMILLES_DE_LA_CEINTURE.map((f) => {
    const membres = de(f.famille);
    if (POTIONS.includes(f.famille)) return { ...f, nombre: membres.length, pages: pagesDePotions(db, membres.map((m) => m.ressource_id)) };
    const ids = new Set(membres.map((m) => m.ressource_id));
    const objets = lignes(db, "SELECT id, nom, prix_brut, description, ordre FROM ressource WHERE genre = 'materiel' ORDER BY section, ordre, nom_cle").filter((r) => ids.has(r.id));
    return { ...f, nombre: objets.length, objets };
  });
  const chapitre = pageDe(db, CHAPITRE_DE_LA_CEINTURE);
  const reference = pageDe(db, PAGE_DE_REFERENCE);
  return {
    regles: {
      ceinture: chapitre ? sectionDuCorps(chapitre.corps_md, TITRE_DES_REGLES) : null,
      reference: reference ? sectionDuCorps(reference.corps_md, TITRE_DE_LA_REFERENCE) : null,
    },
    sources: {
      chapitre: chapitre ? { id: chapitre.id, titre: chapitre.titre } : null,
      reference: reference ? { id: reference.id, titre: reference.titre } : null,
    },
    tableaux,
  };
}

/** Clé de comparaison d'un texte : minuscules, sans accents (« Bloc dégoûtant » se retrouve dans « | Bloc dégoûtant |  |  | »). */
const cleDeTexte = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Les potions `ids`, rangées par page (la page « Fiole rouge » et ses paliers, de la petite à l'ultime) : dans une page, l'ordre où elle écrit
 * leurs noms (« Alchimie primitive » : les deux poudres, puis les breuvages, puis les blocs), sinon leur rang (ressource.ordre) et leur niveau.
 */
function pagesDePotions(db, ids) {
  if (!ids.length) return [];
  const voulues = new Set(ids);
  const potions = lignes(db, `SELECT r.id, r.nom, r.nom_cle, r.prix_brut, r.page_id, r.ordre, p.effet, n.nom AS niveau, n.rang AS niveau_rang
    FROM potion p JOIN ressource r ON r.id = p.ressource_id JOIN niveau_alchimie n ON n.id = p.niveau_id`)
    .filter((p) => voulues.has(p.id));
  const parPage = new Map();
  for (const p of potions) {
    if (!parPage.has(p.page_id)) parPage.set(p.page_id, []);
    parPage.get(p.page_id).push(p);
  }
  return [...parPage].map(([id, liste]) => {
    const page = pageDe(db, id);
    const corps = cleDeTexte(page?.corps_md);
    const place = (p) => {
      const i = corps.indexOf(`| ${cleDeTexte(p.nom)} |`);
      return i < 0 ? Infinity : i;
    };
    const rangees = liste.map((p) => ({ p, place: place(p) }))
      .sort((a, b) => a.place - b.place || a.p.ordre - b.p.ordre || a.p.niveau_rang - b.p.niveau_rang || comparer(a.p.nom_cle, b.p.nom_cle))
      .map(({ p: { page_id, ordre, nom_cle, ...p } }) => p);
    return { id, titre: page?.titre ?? id, resume: page?.resume ?? null, existe: Boolean(page), potions: rangees };
  }).sort((a, b) => comparer(a.titre, b.titre));
}
