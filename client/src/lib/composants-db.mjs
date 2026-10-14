// Page /ressources/composants/ (demande du propriétaire, 2026-10-14 : « une page dans les ressources […] "Composants". Il comprendra les tableaux des
// gemmes, des matériaux, la monnaie, et l'ensemble des tables de l'onglet "équipement inventaire" » ; « Il faut aussi y mettre la table des fruits. Ainsi
// que tout ce qui n'est pas directement des consommables mais qui peut servir pour fabriquer les potions / fioles et autres ») : chargée depuis les
// tables de la base (monnaie, ressource, gemme, bois, ingredient_alchimie), jamais depuis un Markdown. Les potions, livres et parchemins (des
// consommables) n'y sont pas ; les fioles et kits d'alchimie sont dans « Matos fabrication » (onglet « Équipement inventaire »).
// Sans dépendance (sauf les modules purs ci-dessous) : `chargerComposants` reçoit la base ouverte par lib/donnees.mjs.
import { CATEGORIES_D_INGREDIENTS, SECTIONS_DE_L_INVENTAIRE } from './corps-composants.mjs';
import { TABLES_FICHES } from './fiche-format.mjs';

export { pourquoiPasSupprimable } from './composants-champs.mjs';

export const PAGE_DES_COMPOSANTS = 'ressources/composants';

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

/** Les clés étrangères vers `ressource` des règles (hors fiches de personnage, section 13) : [{ table, colonnes }], lues dans le schéma. */
export function referencesAuxRessources(db) {
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
export const estUnFruit = (i) => /^fruit$/i.test(String(i?.type ?? '').trim());

/** Libellé de la catégorie d'un ingrédient (un amplificateur « (majeur) » : « Amplificateur majeur », le sixième emplacement de la recette). */
export const libelleDeCategorie = (i) => {
  const c = CATEGORIES_D_INGREDIENTS.find((x) => x.categorie === i.categorie)?.section ?? i.categorie;
  return i.majeur ? `${c} majeur` : c;
};

/**
 * Les données de la page :
 *   monnaies    : lignes monnaie, par valeur croissante ;
 *   materiaux   : [{ ...ressource, type (table materiau, « Autres » sans ligne : décision R62), arme (sa ligne materiau_arme, ou null), usages: ['Armes',
 *                 'Armures', …], citations }] dans l'ordre des armures (l'Os, de la page des armes, à la fin) ;
 *   gemmes      : [{ ...ressource, ...gemme, magie: { id, nom }, citations }] dans l'ordre des magies ;
 *   bois        : [{ ...ressource, magie, citations }] dans l'ordre des magies ;
 *   fruits      : les ingrédients de type Fruit, [{ ...ressource, ...ingredient, citations }], amplificateurs majeurs d'abord ;
 *   ingredients : [{ categorie, section, ingredients: [...] }] par catégorie, sans les fruits ;
 *   objets      : [{ ...section de l'onglet (lib/corps-composants.mjs#SECTIONS_DE_L_INVENTAIRE), objets: [{ ...ressource, citations }] }].
 * `citations` : les règles qui citent le composant (vide : il peut se supprimer sur le site de dev).
 */
export function chargerComposants(db) {
  const references = referencesAuxRessources(db);
  const avec = (r, sauf = []) => ({ ...r, citations: citationsDeRessource(db, r.id, sauf, references) });
  const usages = (id) => [
    ['materiau_arme', 'Armes'], ['materiau_armure', 'Armures'], ['materiau_bouclier', 'Boucliers'],
  ].filter(([t]) => db.prepare(`SELECT 1 FROM ${t} WHERE ressource_id = ?`).get(id)).map(([, l]) => l)
    .concat(db.prepare('SELECT 1 FROM accessoire_monture WHERE materiau_id = ?').get(id) ? ['Montures'] : []);
  const monnaies = lignes(db, 'SELECT * FROM monnaie ORDER BY valeur_rf');
  const materiaux = lignes(db, `SELECT r.*, coalesce(m.type, 'Autres') AS type FROM ressource r LEFT JOIN materiau m ON m.ressource_id = r.id
    WHERE r.genre = 'materiau' ORDER BY r.page_id <> 'ressources/armures', r.ordre, r.nom_cle`)
    .map((r) => ({ ...avec(r, ['materiau']), usages: usages(r.id), arme: lignes(db, 'SELECT * FROM materiau_arme WHERE ressource_id = ?', r.id)[0] ?? null }));
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
  };
}
