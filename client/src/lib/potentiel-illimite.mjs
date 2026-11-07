// Page du Potentiel Illimité : il n'a pas de table de sorts à lui (« cette magie pioche ses sorts dans toutes les magies existantes », bloc
// « Explication » de son onglet). Sa page montre donc, en onglets, les tableaux de sorts des autres magies, du NPM 1 au plus haut NPM qu'il peut
// choisir (demande du propriétaire) : le même gabarit que leurs propres pages (components/magie/TableauNpm.astro), une magie par onglet.
// Ce NPM est en données (décision R188, migration 0097) : le plafond de sa magie (magie_npm_plafond, 3 : « ne pouvoir atteindre que le niveau 3 de
// puissance magique maximum ») relevé par un don (capacite_npm_plafond, 4 : « Semi-complet » de l'Archimage, sa classe unique), lu par
// lib/magies-db.mjs#chargerMagies (`npmPlafondAvecDon`), jamais écrit ici. La fiche applique le même plafond (lib/fiche-moteur.mjs#npmDesSorts).
// Fonctions pures, sans dépendance Astro ni navigateur (components/magie/SortsDuPotentiel.astro, test/potentiel-illimite.test.mjs).
import { sortsParNpm } from './sort-format.mjs';

export const POTENTIEL_ILLIMITE = 'magies/potentiel-illimite';

/**
 * NPM le plus haut des tableaux repris des autres magies (décision R188) : le plafond du Potentiel Illimité relevé par le meilleur don
 * (`npmPlafondAvecDon` de lib/magies-db.mjs#chargerMagies) ; null quand la base ne lui en donne pas (tous ses NPM sont alors montrés).
 * @param {Map<string, { npmPlafondAvecDon?: number | null }>} magies  `magies` de lib/magies-db.mjs#chargerMagies
 * @returns {number | null}
 */
export const npmMaxDuPotentiel = (magies) => magies.get(POTENTIEL_ILLIMITE)?.npmPlafondAvecDon ?? null;

/**
 * Les autres magies qui ont des sorts, dans l'ordre du classeur, chacune avec ses sorts du NPM 1 au NPM `npmMax` regroupés par NPM.
 * @param {Map<string, { id: string, ordre: number, sorts: { niveau: number }[] }>} magies  `magies` de lib/magies-db.mjs#chargerMagies
 * @param {number | null} [npmMax]  le plus haut NPM montré ; par défaut, celui de la base (npmMaxDuPotentiel) ; null : aucune borne
 * @returns {{ magie: object, groupes: { niveau: number, sorts: object[] }[], total: number }[]}
 */
export function magiesDuPotentiel(magies, npmMax = npmMaxDuPotentiel(magies)) {
  const borne = npmMax ?? Infinity;
  return [...magies.values()]
    .filter((m) => m.id !== POTENTIEL_ILLIMITE)
    .sort((a, b) => a.ordre - b.ordre)
    .map((magie) => {
      const sorts = magie.sorts.filter((s) => s.niveau <= borne);
      return { magie, groupes: sortsParNpm(sorts), total: sorts.length };
    })
    .filter((m) => m.total > 0);
}
