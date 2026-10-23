// La pastille du dé d'une famille d'armes (onglet Armes de /ressources/equipement/ : components/armes/OngletDeFamille.astro, TableauArmes.astro) :
// son infobulle. Quand la note de la famille écrit des dés selon la Force (PUGILAT : « D6 1-2 Force, D8 3-4 Force, D10 5 Force »,
// arme_famille.note_brut, lue par lib/maitrise-arme.mjs#desSelonLaForce), l'infobulle les cite (demande du propriétaire, 2026-10-23 : « Inutile dans
// l'onglet des armes de changer ça. Juste l'indiquer suffit (en tooltip de la catégorie) ») ; sinon « Dé de la famille, sauf indication contraire ».
// Affichage seulement, pas une règle du jeu : les paliers ne se modifient pas sur le site (le refus 400 du dé du service reste).
// Pur, sans dépendance navigateur ni Astro ; lu au build et par le service (refus 400 du dé) ; aucun script de page ne l'importe.
import { desSelonLaForce } from './maitrise-arme.mjs';

/**
 * Les paliers de desSelonLaForce reformés depuis la note (dé en majuscules, espaces et tirets normalisés) : « D6 1-2 Force, D8 3-4 Force, D10 5 Force » (un palier d'une seule valeur :
 * « D10 5 Force ») ; null sans palier. Le même texte que le refus du dé du service (serveur/edition-armes.mjs, ARME_FAMILLE#colonnes).
 * @param {{ de: string, min: number, max: number }[]|null|undefined} paliers
 */
export const texteDesDesSelonLaForce = (paliers) =>
  paliers?.length ? paliers.map((p) => `${p.de} ${p.min === p.max ? p.min : `${p.min}-${p.max}`} Force`).join(', ') : null;

/** L'infobulle de la pastille du dé d'une famille dont la note n'écrit pas de dés selon la Force. */
export const INFOBULLE_DU_DE_DE_FAMILLE = 'Dé de la famille, sauf indication contraire';

/**
 * L'infobulle de la pastille du dé d'une famille : « Dé selon la Force : <paliers> » quand sa note en écrit, sinon INFOBULLE_DU_DE_DE_FAMILLE.
 * @param {string|null|undefined} note arme_famille.note_brut
 */
export function infobulleDuDeDeFamille(note) {
  const texte = texteDesDesSelonLaForce(desSelonLaForce(note));
  return texte ? `Dé selon la Force : ${texte}` : INFOBULLE_DU_DE_DE_FAMILLE;
}
