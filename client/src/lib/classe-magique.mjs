import { capacitesOfClass } from './capacites.mjs';
import { normalize } from './text.mjs';

const fold = (text) => String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// « considérer comme classe magique », « Concidérer comme une classe magique » ou « la classe est concidérée comme magique ».
const CONSIDERE_MAGIQUE = /con[sc]ider(?:er|ee)s? comme (?:une )?classe magique|classe (?:est )?con[sc]ider(?:er|ee)s? comme magique/;

/** Le texte d'un don de spécialité dit que la classe est « considérée comme classe magique » (+4 AM). */
export const ditClasseMagique = (texte) => CONSIDERE_MAGIQUE.test(fold(texte ?? ''));

/** La spécialité est considérée comme magique si sa capacité le précise explicitement. */
export function isMagicalSpecialization(specialization) {
  return specialization?.data.nature === 'specialite' && ditClasseMagique(specialization.body);
}

/** Classe magique d'après sa catégorie ou ses règles ; avec une spécialité, teste cette spécialité précise. */
export function isMagicalClass(entries, classEntry, specialization = null) {
  const tags = new Set((classEntry.data.tags ?? []).map(normalize));
  if (specialization) {
    if (specialization.data.nature !== 'specialite' || specialization.data.classe !== classEntry.id) return false;
    // Le Sommaire du classeur « Classe Maverick V7 » indique +4 AM par classe magique.
    if (tags.has('magique') || classEntry.id === 'classes/archimage') return true;
    const specialites = capacitesOfClass(entries, classEntry).specialites;
    return specialites.some((s) => s.cartouche?.id === specialization.id && isMagicalSpecialization(specialization));
  }
  // L'Archimage est « spéciale » dans le Sommaire, mais la fiche V15.2.2 (BDD!H40) le compte comme classe magique pour l'AM.
  if (tags.has('magique') || classEntry.id === 'classes/archimage') return true;
  const specialites = capacitesOfClass(entries, classEntry).specialites;
  return specialites.some((s) => isMagicalSpecialization(s.cartouche));
}