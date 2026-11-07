// Les écritures d'un texte qu'une migration de données a réécrit par fragments (registre `textes` de data/migrations/NNNN-<nom>.json : une entrée par
// remplacement, table, cle, col, avant, apres ; `avant` présent une fois dans la valeur d'avant). La valeur d'import d'une cellule que le site de dev a
// modifiée (lib/historique-site.mjs#valeurDImport) est celle d'avant la migration, celle d'une cellule intacte celle d'après : un test qui compare deux
// cellules de l'import (un bloc de panneau et le corps qu'il recopie) admet l'une ou l'autre écriture de chaque côté, sans figer le texte d'après
// (skill tests-conventions ; patrons : panneaux-regles.test.mjs, equipement.test.mjs, R207 (3)).
//
//   textesReecrits(...migrations)   les entrées `textes` des registres nommés (« 0105-r207-armures-boucliers-et-fabrication »…), dans l'ordre donné.
//   ecrituresReecrites(...migrations) une fonction (table, cle, col, v) -> [v, v réécrit] : chaque `avant` des registres pour cette cellule remplacé
//                                   par son `apres` (s'il n'y est pas déjà).
import { readFileSync } from 'node:fs';

/** Les entrées `textes` des registres des migrations nommées (sans extension), dans l'ordre donné. */
export const textesReecrits = (...migrations) => migrations
  .flatMap((nom) => JSON.parse(readFileSync(new URL(`../../data/migrations/${nom}.json`, import.meta.url), 'utf8')).textes ?? []);

/** (table, cle, col, v) -> [v tel quel, v avec chaque fragment `avant` des registres pour cette cellule remplacé par son `apres`]. */
export function ecrituresReecrites(...migrations) {
  const textes = textesReecrits(...migrations);
  return (table, cle, col, v) => [v, textes
    .filter((t) => t.table === table && t.col === col && JSON.stringify(t.cle) === JSON.stringify(cle))
    .reduce((s, t) => (s.includes(t.apres) ? s : s.replace(t.avant, () => t.apres)), v)];
}
