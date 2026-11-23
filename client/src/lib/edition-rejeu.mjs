// Le rejeu des lignes en attente au démarrage de l'éditeur (src/scripts/edition/editeur.mjs ; GET /api/edition/en-attente/) : chaque ligne réécrit les champs
// qui l'affichent, puis passe aux extensions actives. Module pur (aucun accès au document sauf par les fonctions passées), importé par l'éditeur.
//   - les extensions actives sont calculées UNE fois, avant la première ligne (après les surcouches, qui dessinent ce que d'autres attendent) : relire `actif`
//     à chaque ligne coûtait un `querySelector` par extension et par ligne (4 403 lignes rejouées par les lots d'ancrage : 28 à 42 s sur le Glossaire) ;
//   - `cadres` (cacher les cadres dont tous les champs sont vides) passe UNE fois, à la fin, hors du mode modification ;
//   - `elementsDe` est relu ligne par ligne, sans index des champs : une extension peut créer ou remplacer un élément pendant le rejeu, la ligne suivante
//     le réécrit.

/**
 * @param {{ table: string, cle: object, ligne: object|null }[]} lignes
 * @param {object} ed  l'éditeur, passé tel quel aux extensions
 * @param {{ extensions: { actif: (doc: object) => boolean, ligne?: Function }[], document: object, elementsDe: (table: string, cle: object) => object[],
 *   estEdite: (el: object) => boolean, rendre: (el: object, ligne: object) => void, cadres: () => void }} sorties
 */
export function rejouerLesLignes(lignes, ed, { extensions, document, elementsDe, estEdite, rendre, cadres }) {
  const actives = extensions.filter((x) => x.actif(document));
  for (const { table, cle, ligne } of lignes) {
    if (ligne) for (const el of elementsDe(table, cle)) if (!estEdite(el)) rendre(el, ligne);
    for (const x of actives) x.ligne?.(ed, table, cle, ligne);
  }
  if (lignes.length && !ed.enEdition) cadres(); // aucune ligne en attente : rien n'a changé, les cadres restent comme la page les a construits
}
