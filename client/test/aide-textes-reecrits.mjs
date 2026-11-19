// Les écritures d'un texte qu'une migration de données a réécrit par fragments (registre `textes` de data/migrations/NNNN-<nom>.json : une entrée par
// remplacement, table, cle, col, avant, apres ; `avant` présent une fois dans la valeur d'avant). La valeur d'import d'une cellule que le site de dev a
// modifiée (lib/historique-site.mjs#valeurDImport) est celle d'avant la migration, celle d'une cellule intacte celle d'après : un test qui compare deux
// cellules de l'import (un bloc de panneau et le corps qu'il recopie) admet l'une ou l'autre écriture de chaque côté, sans figer le texte d'après
// (skill tests-conventions ; patrons : panneaux-regles.test.mjs, equipement.test.mjs, R207 (3)).
//
//   textesReecrits(...migrations)   les entrées `textes` des registres nommés (« 0105-r207-armures-boucliers-et-fabrication »…), dans l'ordre donné.
//   ecrituresReecrites(...migrations) une fonction (table, cle, col, v) -> [v, v réécrit] : chaque `avant` des registres pour cette cellule remplacé
//                                   par son `apres` (s'il n'y est pas déjà).
import { contenuSorti, mixtesSorties } from '../src/lib/sortie-du-contenu.mjs';
import { registreDeMigration, REGISTRES_GARDES } from './aide-registres-sortis.mjs';

/**
 * Les entrées `textes` des registres des migrations nommées (sans extension), dans l'ordre donné. Un registre sorti du dépôt se lit dans ce qu'en garde
 * test/fixtures/registres-sortis.json (balises seulement : aide-registres-sortis.mjs#registreDeMigration) ; une erreur s'il n'est pas gardé, ou gardé sans
 * ses fragments `avant` et `apres` (cellules seules : jamais une liste vide ou incomplète en silence).
 */
export const textesReecrits = (...migrations) => migrations.flatMap((nom) => {
  const registre = registreDeMigration(nom);
  if ((contenuSorti() || mixtesSorties()) && Object.hasOwn(REGISTRES_GARDES, nom)
    && (!Array.isArray(registre.textes) || registre.textes.some((t) => typeof t.avant !== 'string' || typeof t.apres !== 'string'))) {
    throw new Error(`registre ${nom}.json : ses fragments ne sont pas gardés dans test/fixtures/registres-sortis.json (test/aide-textes-reecrits.mjs)`);
  }
  return registre.textes ?? [];
});

/** (table, cle, col, v) -> [v tel quel, v avec chaque fragment `avant` des registres pour cette cellule remplacé par son `apres`]. */
export function ecrituresReecrites(...migrations) {
  const textes = textesReecrits(...migrations);
  return (table, cle, col, v) => [v, textes
    .filter((t) => t.table === table && t.col === col && JSON.stringify(t.cle) === JSON.stringify(cle))
    .reduce((s, t) => (s.includes(t.apres) ? s : s.replace(t.avant, () => t.apres)), v)];
}
