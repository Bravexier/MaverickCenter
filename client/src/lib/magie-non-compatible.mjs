// Bloc « Magie non compatible » d'une page de magie (components/magie/MagieAffinites.astro). Fonction pure, sans dépendance Astro ni navigateur
// (test/magie-non-compatible.test.mjs). Demandes du propriétaire (décision R15) :
//   - une magie mono-magie (colonne magie.mono_magie : Potentiel Illimité, Corruption) affiche « Mono-magie uniquement » à la place de sa liste,
//     puis les ethnies qui font exception (magie_ethnie_secondaire : Elfe Noir Charbon et Felfe Noir pour la Corruption) ;
//   - le Potentiel Illimité n'est cité dans le bloc d'aucune autre magie : mono-magie, il est incompatible avec toutes. La relation reste dans la base
//     (magie_incompatibilite, v_magie_incompatible) : seul l'affichage la tait.
import { POTENTIEL_ILLIMITE } from './potentiel-illimite.mjs';

export const MONO_MAGIE = 'Mono-magie uniquement';

/**
 * @param {{ monoMagie: boolean, incompatibles: string[], incompatibiliteNote: string | null, ethniesSecondaires: object[] }} magie  une magie de lib/magies-db.mjs#chargerMagies
 * @returns {{ mono: boolean, magies: string[], note: string | null, ethnies: object[] }}  magies = ids des magies à citer, dans l'ordre du classeur ;
 *   note = phrase libre de la source, montrée seulement quand ce n'est pas une magie mono-magie (la Corruption, mono-magie, garde la sienne comme trace dans la base)
 */
export function blocNonCompatible(magie) {
  if (magie.monoMagie) return { mono: true, magies: [], note: null, ethnies: magie.ethniesSecondaires };
  return {
    mono: false,
    magies: magie.incompatibles.filter((id) => id !== POTENTIEL_ILLIMITE),
    note: magie.incompatibiliteNote,
    ethnies: magie.ethniesSecondaires,
  };
}
