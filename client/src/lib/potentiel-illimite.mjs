// Page du Potentiel Illimité : il n'a pas de table de sorts à lui (« cette magie pioche ses sorts dans toutes les magies existantes », bloc
// « Explication » de son onglet). Sa page montre donc, en onglets, les tableaux de sorts des autres magies, du NPM 1 au NPM 4 seulement
// (demande du propriétaire) : le même gabarit que leurs propres pages (components/magie/TableauNpm.astro), une magie par onglet.
// Fonctions pures, sans dépendance Astro ni navigateur (components/magie/SortsDuPotentiel.astro, test/potentiel-illimite.test.mjs).
import { sortsParNpm } from './sort-format.mjs';

export const POTENTIEL_ILLIMITE = 'magies/potentiel-illimite';
/** NPM le plus haut des tableaux repris des autres magies (demande du propriétaire). */
export const NPM_MAX_DU_POTENTIEL = 4;

/**
 * Les autres magies qui ont des sorts, dans l'ordre du classeur, chacune avec ses sorts du NPM 1 au NPM 4 regroupés par NPM.
 * @param {Map<string, { id: string, ordre: number, sorts: { niveau: number }[] }>} magies  `magies` de lib/magies-db.mjs#chargerMagies
 * @returns {{ magie: object, groupes: { niveau: number, sorts: object[] }[], total: number }[]}
 */
export function magiesDuPotentiel(magies) {
  return [...magies.values()]
    .filter((m) => m.id !== POTENTIEL_ILLIMITE)
    .sort((a, b) => a.ordre - b.ordre)
    .map((magie) => {
      const sorts = magie.sorts.filter((s) => s.niveau <= NPM_MAX_DU_POTENTIEL);
      return { magie, groupes: sortsParNpm(sorts), total: sorts.length };
    })
    .filter((m) => m.total > 0);
}
