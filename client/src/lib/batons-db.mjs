// Sous-onglet « Bâtons magiques » de l'onglet « Ceinture » de la page /ressources/equipement/ (demandes du propriétaire, 2026-10-16 : d'abord un
// onglet de « Équipement », « qui auront mieux leur place ici », puis, la ceinture devenue l'onglet « Ceinture », « On y remettrait à ce moment le
// tableau Bâton magique ») : chargé depuis la base, jamais depuis le Markdown de la page « Bâton magique » ; ses règles (son introduction et « Comment
// fabriquer un bâton magique ? », copiées par la migration 0055) sont le panneau de règles `batons-magiques` (lib/panneaux-regles-db.mjs) ; la page
// « Bâton magique » n'est plus construite, ses liens mènent au sous-onglet (lib/metiers.mjs#adresseDePage). Un bâton va à la ceinture (décision R81 :
// vue v_objet_ceinture, dont la fiche de personnage se sert).
// Prix d'un bâton (demande du propriétaire du 2026-10-16 : « Rajouter une colonne pour le prix ») : la source n'écrit pas de prix pour un bâton, seulement
// ceux de ses matériaux (« MATÉRIAUX NÉCESSAIRES PAR MAGIE » : la gemme entière par qualité, le bois) et la recette de chaque niveau (« 1 Gemme Commune
// + 1 bois [magie] ») ; le prix affiché est donc celui des matériaux de la recette : la gemme de la qualité du niveau + le bois (`prixDuBaton`), rien
// d'autre (aucun coût de fabrication n'est écrit).
// Sans dépendance (sauf lib/corps-composants.mjs, pur) : `chargerBatons` reçoit la base ouverte par lib/donnees.mjs.
import { PAGE_DES_BATONS } from './corps-composants.mjs';

/** La page des bâtons magiques (lib/corps-composants.mjs). */
export { PAGE_DES_BATONS };

/** Les qualités de gemme (`recette_ingredient.qualite`), dans l'ordre des niveaux, et leur libellé tel que la recette l'écrit (« 1 Gemme Raffinée »). */
export const QUALITES_DE_GEMME = Object.freeze({ commune: 'Gemme commune', raffinee: 'Gemme raffinée', parfaite: 'Gemme parfaite' });

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

/**
 * Le prix d'un bâton d'une magie à un niveau, en Ricken de fer : la gemme entière de la qualité du niveau (`m.qualites[niveau]`) + le bois ;
 * null si la recette n'a pas de qualité de gemme ou si l'un des deux prix manque (jamais un prix partiel).
 */
export function prixDuBaton(m, niveau) {
  const gemme = m.gemme?.prix?.[m.qualites?.[niveau]]?.rf;
  const bois = m.bois?.prix?.rf;
  return Number.isInteger(gemme) && Number.isInteger(bois) ? gemme + bois : null;
}

/**
 * Les données de l'onglet :
 *   page    : { id, titre } de la page « Bâton magique », ou null (une base sans exemples peut ne plus l'avoir) ; son résumé n'est plus lu (le panneau de
 *             règles l'a remplacé) ;
 *   niveaux : [{ niveau, entete }] (l'en-tête de la colonne du classeur, la recette du niveau : « Niveau 1 (1 Gemme Commune + 1 bois [magie]) ») ;
 *   magies  : [{ magie: { id, nom }, gemme, bois, qualites: { 1: 'commune', … }, bonus: { 1: '…', 2: '…', 3: '…' } }], une par magie, dans l'ordre des
 *             magies ; gemme : { id, nom, description, prix: { commune, raffinee, parfaite } } (chaque prix { brut, rf }, la gemme entière) ;
 *             bois : { id, nom, description, prix: { brut, rf } } ; l'un ou l'autre null si la recette ne le nomme pas ;
 *   nombre  : le nombre de bâtons (lignes de baton_magique).
 */
export function chargerBatons(db) {
  const tous = lignes(db, `SELECT b.id, b.magie_id, b.niveau, b.bonus_brut, b.recette_id, r.texte_brut, m.nom AS magie_nom
    FROM baton_magique b JOIN magie m ON m.id = b.magie_id JOIN recette r ON r.id = b.recette_id ORDER BY m.ordre, b.niveau`);
  const ingredient = (recette, rang) =>
    lignes(db, `SELECT r.id, r.nom, r.description, r.prix_brut, r.prix_rf, ri.qualite FROM recette_ingredient ri JOIN ressource r ON r.id = ri.ressource_id
      WHERE ri.recette_id = ? AND ri.rang = ? ORDER BY ri.option`, recette, rang)[0] ?? null;
  const gemmeDe = (i) => {
    if (!i) return null;
    const g = lignes(db, 'SELECT * FROM gemme WHERE ressource_id = ?', i.id)[0];
    const prix = Object.fromEntries(Object.keys(QUALITES_DE_GEMME).map((q) => [q, g ? { brut: g[`prix_${q}_brut`], rf: g[`prix_${q}_rf`] } : null]));
    return { id: i.id, nom: i.nom, description: i.description, prix };
  };
  const boisDe = (i) => (i ? { id: i.id, nom: i.nom, description: i.description, prix: { brut: i.prix_brut, rf: i.prix_rf } } : null);
  const niveaux = [...new Set(tous.map((b) => b.niveau))].sort((a, b) => a - b)
    .map((niveau) => ({ niveau, entete: tous.find((b) => b.niveau === niveau)?.texte_brut ?? `Niveau ${niveau}` }));
  const magies = [];
  for (const b of tous) {
    const gemme = ingredient(b.recette_id, 1);
    let m = magies.find((x) => x.magie.id === b.magie_id);
    if (!m) {
      // la gemme (premier élément de la recette) et le bois (second), les mêmes aux trois niveaux d'une magie ; seule la qualité de la gemme change
      m = { magie: { id: b.magie_id, nom: b.magie_nom }, gemme: gemmeDe(gemme), bois: boisDe(ingredient(b.recette_id, 2)), qualites: {}, bonus: {} };
      magies.push(m);
    }
    m.qualites[b.niveau] = gemme?.qualite ?? null;
    m.bonus[b.niveau] = b.bonus_brut;
  }
  const page = lignes(db, 'SELECT id, titre FROM page WHERE id = ?', PAGE_DES_BATONS)[0] ?? null;
  return {
    page,
    niveaux,
    magies,
    nombre: tous.length,
  };
}
