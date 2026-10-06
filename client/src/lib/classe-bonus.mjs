// Bonus d'armure magique (AM) des classes. Fonctions pures.
//
// Trois sources, distinguées :
//  - « sommaire » : le Sommaire du classeur « Classe Maverick V7 » : « Octroie 4 AM de base par classe magique »
//    (note sous la colonne « Classe Magique », reprise sur chaque page de classe magique) ;
//  - « specialite » : classe raciale (« Hybride Animal ») : la capacité de spécialisation de niveau 10 de sa 2ᵉ spécialité,
//    le pendant lanceur de sort de la classe, dit « considérer comme classe magique » (cellule AA23 de l'onglet) : elle
//    reçoit donc le +4 AM des classes magiques. La spécialité est reconnue à ce texte, pas à sa position ;
//  - « fiche » : la « Fiche personnage Maverick Auto V15.2.2 » (BDD!H40, I40, BB2) range l'Archimage, classe « spéciale »
//    du Sommaire, dans sa liste de classes magiques pour ce bonus.
import { capacitesOfClass } from './capacites.mjs';
import { normalize } from './text.mjs';

const fold = (text) => String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const AM_BONUS = 4;

// « considérer comme classe magique », « Concidérer comme une classe magique » (faute de frappe du classeur)…
const CONSIDERE_MAGIQUE = /con[sc]iderer comme (?:une )?classe magique/; // appliquée au texte sans accents (fold)

/**
 * @returns {{ valeur: number, portee: 'classe' | 'specialite', specialite: string | null, cartouche: object | null, source: 'sommaire' | 'specialite' | 'fiche' } | null}
 */
export function bonusAM(entries, classEntry) {
  const tags = new Set((classEntry.data.tags ?? []).map(normalize));
  if (tags.has('magique')) return { valeur: AM_BONUS, portee: 'classe', specialite: null, cartouche: null, source: 'sommaire' };
  if (classEntry.id === 'classes/archimage') return { valeur: AM_BONUS, portee: 'classe', specialite: null, cartouche: null, source: 'fiche' };
  const { specialites } = capacitesOfClass(entries, classEntry);
  const cible = specialites.find((s) => s.cartouche && CONSIDERE_MAGIQUE.test(fold(s.cartouche.body ?? '')));
  if (!cible) return null;
  return { valeur: AM_BONUS, portee: 'specialite', specialite: cible.nom, cartouche: cible.cartouche, source: 'specialite' };
}
