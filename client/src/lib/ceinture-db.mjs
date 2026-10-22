// Onglet « Ceinture » de la page /ressources/equipement/ (demandes du propriétaire : le 2026-10-15, « l'ensemble de tous les objets que les joueurs
// peuvent placer à la ceinture dans le but de pouvoir les utiliser comme un IC. De plus il faut parler aussi des bâtons magiques » ; le 2026-10-16,
// « revoir intégralement la page des objets à la ceinture, renommer l'onglet en "Ceinture" et le mettre dans les onglets de équipement », chaque
// tableau dans ses sous-onglets « plutôt que la recherche actuel », « dans l'ordre Consommable / Carquois / Bâton magiques », les consommables
// regroupant « les fioles remêdes philtres huiles et alchimie privatives dans cet ordre ») : chargé depuis la base, jamais depuis un Markdown. Quels
// objets : la vue v_objet_ceinture (décision R81 : toutes les potions et huiles, les carquois, sacs de bombes et sacs de pierres, les bâtons magiques ;
// pas le bouclier : décision R82 ; la liste du guide reste « non exhaustive »). Les bâtons magiques ont leur sous-onglet, chargé par lib/batons-db.mjs.
// Les règles affichées sont des textes de la base, rendus par l'onglet : le paragraphe « La ceinture » du chapitre « L'équipement » du guide et la
// section « Ceinture » de la page de référence (le texte du Google Doc). Chaque potion porte la couleur que lui donne la règle du site
// (lib/alchimie-couleurs.mjs : l'affinité de son essence, ou la caractéristique d'un philtre, nuancée selon son niveau d'alchimie ; demande du
// propriétaire du 2026-10-22 : « Partout il faut utiliser Que les couleurs du site »).
// Sans dépendance (sauf lib/equipement.mjs et lib/alchimie-couleurs.mjs, purs) : `chargerObjetsDeCeinture` reçoit la base ouverte par lib/donnees.mjs.
import { caracteristiqueDesCompetences, couleurDePotion } from './alchimie-couleurs.mjs';
import { SOUS_ONGLETS_DE_LA_CEINTURE } from './equipement.mjs';

/** Le chapitre du guide dont la section « La ceinture » donne les règles, et la page de référence qui les détaille. */
export const CHAPITRE_DE_LA_CEINTURE = 'guide/l-equipement';
export const TITRE_DES_REGLES = '## La ceinture';
export const PAGE_DE_REFERENCE = 'guide/fiche-accessoires-et-ceinture';
export const TITRE_DE_LA_REFERENCE = '## Ceinture';

/** L'id d'un sous-onglet de lib/equipement.mjs, cherché par son id (un sous-onglet renommé ou retiré arrête le chargement, il ne change pas d'ordre en silence). */
const sousOnglet = (id) => {
  if (!SOUS_ONGLETS_DE_LA_CEINTURE.some((o) => o.id === id)) throw new Error(`[ceinture] sous-onglet inconnu : ${id}`);
  return id;
};
const CONSOMMABLES = sousOnglet('ceinture-consommables');
const CARQUOIS = sousOnglet('ceinture-carquois');
const BATONS = sousOnglet('batons-magiques');

/**
 * Les tableaux de l'onglet, dans l'ordre : `famille` de v_objet_ceinture, titre du tableau (les familles de recette du doc « Alchimie » : solvant
 * Fiole, Remède, Philtre, Huile, et l'alchimie primitive) et `onglet`, l'id du sous-onglet qui le montre (lib/equipement.mjs) : les consommables,
 * dans l'ordre voulu par le propriétaire (fioles, remèdes, philtres, huiles, alchimie primitive), puis les carquois et sacs. Toutes les familles de la
 * vue, sauf `FAMILLE_DES_BATONS` (leur sous-onglet a son tableau : lib/batons-db.mjs).
 */
export const FAMILLES_DE_LA_CEINTURE = Object.freeze([
  Object.freeze({ famille: 'fiole', titre: 'Fioles', onglet: CONSOMMABLES }),
  Object.freeze({ famille: 'remede', titre: 'Remèdes', onglet: CONSOMMABLES }),
  Object.freeze({ famille: 'philtre', titre: 'Philtres', onglet: CONSOMMABLES }),
  Object.freeze({ famille: 'huile', titre: 'Huiles', onglet: CONSOMMABLES }),
  Object.freeze({ famille: 'primitive', titre: 'Alchimie primitive', onglet: CONSOMMABLES }),
  Object.freeze({ famille: 'contenant', titre: 'Carquois et sacs', onglet: CARQUOIS }),
]);
/** La famille de v_objet_ceinture des bâtons magiques : le tableau de leur sous-onglet (`ONGLET_DES_BATONS`) est celui de lib/batons-db.mjs. */
export const FAMILLE_DES_BATONS = 'baton';
export const ONGLET_DES_BATONS = BATONS;
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
 * Les données de l'onglet :
 *   regles   : { ceinture, reference } : Markdown de la base (null si la page n'écrit plus la section), rendus par l'onglet ;
 *   sources  : { chapitre, reference } : les pages d'où viennent ces règles, { id, titre } (leur titre se modifie sur le site de dev), ou null ;
 *   tableaux : un par famille de FAMILLES_DE_LA_CEINTURE, { famille, titre, onglet, nombre, ... } avec
 *              - potions et huiles : `pages` : [{ id, titre, resume, existe, caracteristique, potions: [{ id, nom, niveau_id, niveau, niveau_rang, prix_brut,
 *                effet, essence, couleur }] }], une par page de potion (ordre alphabétique du titre ; `existe` : la page est dans la base, son titre peut
 *                être un lien), ses paliers dans l'ordre où la page écrit leurs noms, puis leur rang (ressource.ordre) et leur niveau ; `essence` :
 *                l'affinité de l'essence de la première variante de sa recette (`affinite.id`, null sans recette) ; `caracteristique` : celle dont les
 *                potions de la page augmentent les compétences (les philtres ; null sinon, ou si elles en nomment plusieurs) ; `couleur` : { fond } ou null
 *                (lib/alchimie-couleurs.mjs#couleurDePotion) ;
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
  // l'essence de chaque potion : celle de la première variante de la recette qui la produit (la première ligne de la table « Recette » du Doc)
  const essences = new Map();
  for (const r of lignes(db, `SELECT rp.ressource_id, ri.affinite_id FROM recette_produit rp JOIN recette r ON r.id = rp.recette_id
    JOIN recette_ingredient ri ON ri.recette_id = r.id AND ri.role = 'essence' WHERE r.genre = 'alchimie'
    ORDER BY rp.ressource_id, r.variante, ri.rang, ri.option`)) {
    if (!essences.has(r.ressource_id)) essences.set(r.ressource_id, r.affinite_id);
  }
  const caracteristiques = lignes(db, 'SELECT id, nom FROM caracteristique');
  const potions = lignes(db, `SELECT r.id, r.nom, r.nom_cle, r.prix_brut, r.page_id, r.ordre, p.effet, p.niveau_id, n.nom AS niveau, n.rang AS niveau_rang
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
    // la caractéristique dont les potions de la page augmentent les compétences : une seule, nommée par leurs effets (l'ultime philtre ne la nomme pas
    // dans cette tournure : la page la donne à tous ses paliers)
    const nommees = new Set(liste.map((p) => caracteristiqueDesCompetences(p.effet, caracteristiques)).filter(Boolean));
    const caracteristique = nommees.size === 1 ? [...nommees][0] : null;
    const rangees = liste.map((p) => ({ p, place: place(p) }))
      .sort((a, b) => a.place - b.place || a.p.ordre - b.p.ordre || a.p.niveau_rang - b.p.niveau_rang || comparer(a.p.nom_cle, b.p.nom_cle))
      .map(({ p: { page_id, ordre, nom_cle, ...p } }) => {
        const essence = essences.get(p.id) ?? null;
        return { ...p, essence, couleur: couleurDePotion({ essence, caracteristique, niveau: p.niveau_rang }) };
      });
    return { id, titre: page?.titre ?? id, resume: page?.resume ?? null, existe: Boolean(page), caracteristique, potions: rangees };
  }).sort((a, b) => comparer(a.titre, b.titre));
}
