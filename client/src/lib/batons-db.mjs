// Onglet « Bâtons magiques » de la page /ressources/equipement/ (demande du propriétaire, 2026-10-16 : « Il faudrait également un 4em onglet pour les
// bâtons magiques du coup qui auront mieux leur place ici ») : chargé depuis la base, jamais depuis le Markdown de la page « Bâton magique », dont seules
// les règles s'affichent (son introduction et « Comment fabriquer un bâton magique ? ») ; la page « Bâton magique » n'est plus construite, ses liens
// mènent à l'onglet (lib/metiers.mjs#adresseDePage). Un bâton va aussi à la ceinture (décision R81 : vue v_objet_ceinture, dont la fiche de personnage
// se sert) ; la page « Objets à la ceinture » renvoie à l'onglet.
// Sans dépendance (sauf lib/ceinture-db.mjs et lib/corps-composants.mjs, purs) : `chargerBatons` reçoit la base ouverte par lib/donnees.mjs.
import { sectionDuCorps } from './ceinture-db.mjs';
import { PAGE_DES_BATONS } from './corps-composants.mjs';

/** La page des bâtons magiques (lib/corps-composants.mjs) : son introduction (avant le premier titre) et « Comment fabriquer un bâton magique ? ». */
export { PAGE_DES_BATONS };
export const TITRE_DE_LA_FABRICATION = '## COMMENT FABRIQUER UN BÂTON MAGIQUE ?';

const lignes = (db, sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));

/**
 * Les données de l'onglet :
 *   page    : { id, titre, resume } de la page « Bâton magique » (son titre se modifie sur le site de dev), ou null (une base sans exemples peut ne plus l'avoir) ;
 *   regles  : { introduction, fabrication } : Markdown de la base (null si la page n'écrit plus la section), rendus par la page ;
 *   niveaux : [{ niveau, entete }] (l'en-tête de la colonne, la recette du niveau : « Niveau 1 (1 Gemme Commune + 1 bois [magie]) ») ;
 *   magies  : [{ magie: { id, nom }, gemme, bois ({ id, nom } ou null), bonus: { 1: '…', 2: '…', 3: '…' } }], une par magie, dans l'ordre des magies ;
 *   nombre  : le nombre de bâtons (lignes de baton_magique).
 */
export function chargerBatons(db) {
  const tous = lignes(db, `SELECT b.id, b.magie_id, b.niveau, b.bonus_brut, b.recette_id, r.texte_brut, m.nom AS magie_nom
    FROM baton_magique b JOIN magie m ON m.id = b.magie_id JOIN recette r ON r.id = b.recette_id ORDER BY m.ordre, b.niveau`);
  const ingredient = (recette, rang) =>
    lignes(db, `SELECT r.id, r.nom FROM recette_ingredient ri JOIN ressource r ON r.id = ri.ressource_id
      WHERE ri.recette_id = ? AND ri.rang = ? ORDER BY ri.option`, recette, rang)[0] ?? null;
  const niveaux = [...new Set(tous.map((b) => b.niveau))].sort((a, b) => a - b)
    .map((niveau) => ({ niveau, entete: tous.find((b) => b.niveau === niveau)?.texte_brut ?? `Niveau ${niveau}` }));
  const magies = [];
  for (const b of tous) {
    let m = magies.find((x) => x.magie.id === b.magie_id);
    if (!m) {
      // la gemme (premier élément de la recette) et le bois (second), les mêmes aux trois niveaux d'une magie
      m = { magie: { id: b.magie_id, nom: b.magie_nom }, gemme: ingredient(b.recette_id, 1), bois: ingredient(b.recette_id, 2), bonus: {} };
      magies.push(m);
    }
    m.bonus[b.niveau] = b.bonus_brut;
  }
  const page = lignes(db, 'SELECT id, titre, resume, corps_md FROM page WHERE id = ?', PAGE_DES_BATONS)[0] ?? null;
  return {
    page: page ? { id: page.id, titre: page.titre, resume: page.resume } : null,
    regles: {
      introduction: page ? sectionDuCorps(page.corps_md, null) : null,
      fabrication: page ? sectionDuCorps(page.corps_md, TITRE_DE_LA_FABRICATION) : null,
    },
    niveaux,
    magies,
    nombre: tous.length,
  };
}
