// Page /ressources/composants/ (demande du propriétaire, 2026-10-14 : « une page dans les ressources […] "Composants". Il comprendra les tableaux des
// gemmes, des matériaux, la monnaie, et l'ensemble des tables de l'onglet "équipement inventaire" » ; « Il faut aussi y mettre la table des fruits. Ainsi
// que tout ce qui n'est pas directement des consommables mais qui peut servir pour fabriquer les potions / fioles et autres ») : chargée depuis les
// tables de la base (monnaie, ressource, gemme, bois, ingredient_alchimie), jamais depuis un Markdown. Les potions, livres et parchemins (des
// consommables) n'y sont pas ; les fioles et kits d'alchimie sont dans « Matos fabrication » (onglet « Équipement inventaire »).
// Un onglet par tableau (demande du propriétaire du 2026-10-17 : « à l'image de la page d'équipement avoir des onglets pour chaque table. Il faudrait
// aussi qu'elles soient modifiables et directement liées en base ») : la table composant_onglet (migration 0057) donne le titre, la note et la place de
// chacun ; son id est celui du tableau (TABLEAUX_DES_COMPOSANTS), et un tableau sans onglet ou un onglet sans tableau arrête le build (ongletsDeLaPage).
// Sans dépendance (sauf les modules purs ci-dessous) : `chargerComposants` reçoit la base ouverte par lib/donnees.mjs.
import { CATEGORIES_D_INGREDIENTS, SECTIONS_DE_L_INVENTAIRE } from './corps-composants.mjs';
import { TABLES_FICHES } from './fiche-format.mjs';

export { pourquoiPasSupprimable } from './composants-champs.mjs';

export const PAGE_DES_COMPOSANTS = 'ressources/composants';
/**
 * Le titre et la description de la page Composants (son `<title>` et sa description, pages/ressources/composants.astro), repris par le sommaire de
 * l'Artisanat (pages/regles/artisanat.astro, lib/livres.mjs#ARTISANAT) : la page n'a pas de ligne `page`, donc pas de résumé dans la base.
 */
export const TITRE_DES_COMPOSANTS = 'Composants';
export const DESCRIPTION_DES_COMPOSANTS = 'Monnaie, matériaux, gemmes, bois, ingrédients d’alchimie et équipement d’inventaire.';

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

const slug = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** L'id du tableau (et de son onglet) d'une catégorie d'ingrédients d'alchimie : « ingredients-solvant ». */
export const idDuTableauDIngredients = (categorie) => `ingredients-${categorie}`;
/** L'id du tableau (et de son onglet) d'une section de l'onglet « Équipement inventaire » : « objets-matos-aventures » pour « MATOS AVENTURES ». */
export const idDuTableauDObjets = (section) => `objets-${slug(section)}`;

/**
 * Les tableaux de la page, chacun l'id de son onglet (composant_onglet.id) et de son panneau : monnaie, matériaux, gemmes, bois, fruits, une catégorie
 * d'ingrédients d'alchimie chacun, une section de l'onglet « Équipement inventaire » chacun. Leur ordre à l'écran est celui de la table.
 */
export const TABLEAUX_DES_COMPOSANTS = Object.freeze([
  'monnaie', 'materiaux', 'gemmes', 'bois', 'fruits',
  ...CATEGORIES_D_INGREDIENTS.map((c) => idDuTableauDIngredients(c.categorie)),
  ...SECTIONS_DE_L_INVENTAIRE.map((s) => idDuTableauDObjets(s.section)),
]);

/**
 * Les onglets de la page (lignes composant_onglet), dans l'ordre de la barre (ordre, puis id) ; une erreur si un tableau n'a pas son onglet ou si un
 * onglet ne désigne aucun tableau (la page perdrait un tableau, ou montrerait un onglet vide).
 */
export function ongletsDeLaPage(onglets) {
  const ids = new Set(onglets.map((o) => o.id));
  const manquants = TABLEAUX_DES_COMPOSANTS.filter((id) => !ids.has(id));
  const enTrop = [...ids].filter((id) => !TABLEAUX_DES_COMPOSANTS.includes(id));
  if (manquants.length || enTrop.length) {
    throw new Error(`Composants : ${[manquants.length ? `tableaux sans onglet (${manquants.join(', ')})` : '', enTrop.length ? `onglets sans tableau (${enTrop.join(', ')})` : ''].filter(Boolean).join(' ; ')} : voir la table composant_onglet.`);
  }
  return [...onglets].sort((a, b) => a.ordre - b.ordre || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Les clés étrangères vers `ressource` des règles (hors fiches de personnage, section 13) : [{ table, colonnes }], lues dans le schéma. */
function referencesAuxRessources(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((t) => t.name)
    .filter((t) => !TABLES_FICHES.includes(t))
    .map((t) => ({ table: t, colonnes: db.prepare(`PRAGMA foreign_key_list("${t}")`).all().filter((f) => f.table === 'ressource').map((f) => f.from) }))
    .filter((r) => r.colonnes.length);
}

/**
 * Les règles qui citent une ressource, sauf les tables `sauf` (sa propre table de détail) : [« armure (21) », …] ; vide = elle peut se supprimer.
 * `references` : referencesAuxRessources(db), lu une fois.
 */
export function citationsDeRessource(db, id, sauf = [], references = referencesAuxRessources(db)) {
  const sortie = [];
  for (const { table, colonnes } of references) {
    if (sauf.includes(table)) continue;
    const n = db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE ${colonnes.map((c) => `"${c}" = ?`).join(' OR ')}`).get(...colonnes.map(() => id)).n;
    if (n) sortie.push(`${table} (${n})`);
  }
  return sortie;
}

/** Un ingrédient qui va dans le tableau des fruits (« la table des fruits ») : son type est « Fruit ». */
const estUnFruit = (i) => /^fruit$/i.test(String(i?.type ?? '').trim());

/**
 * Les données de la page :
 *   monnaies    : lignes monnaie, par valeur croissante ;
 *   materiaux   : [{ ...ressource, type (table materiau, « Autres » sans ligne : décision R62), arme (sa ligne materiau_arme, ou null), usages: ['Armes',
 *                 'Armures', …], fabrication (le texte de sa recette, « 10 minerais de fer + 1 charbon + Bas Fourneau », ou null), citations }] dans
 *                 l'ordre des armures (l'Os, de la page des armes, à la fin) ;
 *   gemmes      : [{ ...ressource, ...gemme, magie: { id, nom }, citations }] dans l'ordre des magies ;
 *   bois        : [{ ...ressource, magie, citations }] dans l'ordre des magies ;
 *   fruits      : les ingrédients de type Fruit, [{ ...ressource, ...ingredient, citations }], amplificateurs majeurs d'abord ;
 *   ingredients : [{ categorie, section, ingredients: [...] }] par catégorie, sans les fruits ;
 *   objets      : [{ ...section de l'onglet (lib/corps-composants.mjs#SECTIONS_DE_L_INVENTAIRE), objets: [{ ...ressource, citations }] }] ;
 *   onglets     : les lignes composant_onglet ({ id, titre, note, ordre }), dans l'ordre de la barre (ongletsDeLaPage).
 * `citations` : les règles qui citent le composant (vide : il peut se supprimer sur le site de dev).
 */
export function chargerComposants(db) {
  const references = referencesAuxRessources(db);
  const avec = (r, sauf = []) => ({ ...r, citations: citationsDeRessource(db, r.id, sauf, references) });
  const usages = (id) => [
    ['materiau_arme', 'Armes'], ['materiau_armure', 'Armures'], ['materiau_bouclier', 'Boucliers'],
  ].filter(([t]) => db.prepare(`SELECT 1 FROM ${t} WHERE ressource_id = ?`).get(id)).map(([, l]) => l)
    .concat(db.prepare('SELECT 1 FROM accessoire_monture WHERE materiau_id = ?').get(id) ? ['Montures'] : []);
  // la fabrication d'un matériau (colonne « Fabrication (pour obtenir une matière) » du tableau MATÉRIAUX des onglets « Armures » et « Bouclier »),
  // affichée ici et plus sur la page « Équipement » (demande du propriétaire, 2026-10-16 : ce tableau des armures et des boucliers « devrait disparaître
  // et être mélangé au tableau des matériaux des Composants »)
  const fabrication = (id) =>
    db.prepare(`SELECT r.texte_brut FROM recette r JOIN recette_produit p ON p.recette_id = r.id WHERE r.genre = 'materiau' AND p.ressource_id = ?
      ORDER BY r.id LIMIT 1`).get(id)?.texte_brut ?? null;
  const monnaies = lignes(db, 'SELECT * FROM monnaie ORDER BY valeur_rf');
  const materiaux = lignes(db, `SELECT r.*, coalesce(m.type, 'Autres') AS type FROM ressource r LEFT JOIN materiau m ON m.ressource_id = r.id
    WHERE r.genre = 'materiau' ORDER BY r.page_id <> 'ressources/armures', r.ordre, r.nom_cle`)
    .map((r) => ({
      ...avec(r, ['materiau']), usages: usages(r.id), arme: lignes(db, 'SELECT * FROM materiau_arme WHERE ressource_id = ?', r.id)[0] ?? null,
      fabrication: fabrication(r.id),
    }));
  const gemmes = lignes(db, `SELECT r.*, g.*, m.nom AS magie_nom FROM gemme g JOIN ressource r ON r.id = g.ressource_id JOIN magie m ON m.id = g.magie_id
    ORDER BY m.ordre`).map(({ magie_nom, ...g }) => ({ ...avec(g, ['gemme']), magie: { id: g.magie_id, nom: magie_nom } }));
  const bois = lignes(db, `SELECT r.*, b.magie_id, m.nom AS magie_nom FROM bois b JOIN ressource r ON r.id = b.ressource_id JOIN magie m ON m.id = b.magie_id
    ORDER BY m.ordre`).map(({ magie_nom, ...b }) => ({ ...avec(b, ['bois']), magie: { id: b.magie_id, nom: magie_nom } }));
  const ingredients = lignes(db, `SELECT r.*, i.categorie, i.type_brut, i.type, i.majeur, i.affinite_brut, i.affinite_id
    FROM ingredient_alchimie i JOIN ressource r ON r.id = i.ressource_id ORDER BY r.ordre, r.nom_cle`).map((i) => avec(i, ['ingredient_alchimie']));
  const rang = (i) => CATEGORIES_D_INGREDIENTS.findIndex((c) => c.categorie === i.categorie);
  const fruits = ingredients.filter(estUnFruit).sort((a, b) => b.majeur - a.majeur || rang(a) - rang(b) || a.ordre - b.ordre);
  return {
    monnaies,
    materiaux,
    gemmes,
    bois,
    fruits,
    ingredients: CATEGORIES_D_INGREDIENTS.map((c) => ({ ...c, ingredients: ingredients.filter((i) => i.categorie === c.categorie && !estUnFruit(i)) })),
    objets: SECTIONS_DE_L_INVENTAIRE.map((s) => ({
      ...s,
      objets: lignes(db, 'SELECT * FROM ressource WHERE genre = ? AND section = ? ORDER BY ordre', s.genre, s.section).map((r) => avec(r)),
    })),
    onglets: ongletsDeLaPage(lignes(db, 'SELECT * FROM composant_onglet')),
  };
}
