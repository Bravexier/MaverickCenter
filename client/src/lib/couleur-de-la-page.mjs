// La couleur principale d'une page et la feuille des mots-clés colorés (migration 0098 ; réponses du propriétaire du 2026-11-06, Q5 et Q13 : la page vers
// laquelle mène l'adresse d'un mot-clé coloré prend sa couleur ; « il ne faut pas de changement par rapport à avant en terme de résultat »).
//   - classeDeLaPage : la classe du mot-clé coloré qui mène à la page (lib/mots-cles-liens.mjs#motCleDeLaPage, puis #classeDuMotCle), sinon `repli`, la
//     couleur que la page avait avant (sa magie, la catégorie de sa classe, la nature de sa race, sa partie du guide ; null : l'accent du site). Les
//     mots-clés colorés de la migration 0098 reprennent chacun la couleur de sa page : le rendu ne change pas. Posée par le gabarit de la page sur son
//     élément principal (components/magie/MagiePage.astro, components/classes/ClassePage.astro, components/race/RacePage.astro,
//     components/guide/PageDuGuide.astro) ; les autres pages, sur leur <main> (layouts/Base.astro, `.page-coloree`, styles/global/wiki.css), seulement
//     quand un mot-clé coloré y mène. Les tuiles des listes (/classes/, /races/, l'accueil), la carte de /magies/, les puces et les tableaux gardent
//     leurs couleurs (réponse du propriétaire : seule la page elle-même).
//   - cssDesMotsClesDuSite : la feuille des classes des mots-clés colorés (lib/palette-css.mjs#cssDesMotsCles : couleurs écrites et familles d'une
//     zone), émise sur chaque page par layouts/Base.astro (`<style data-couleurs-mots-cles>`), que le site de dev réécrit avec celle du service
//     (src/scripts/edition/mots-cles-vivants.mjs).
// Lu au build (la base construite, lib/donnees.mjs) ; sans dépendance navigateur ni Astro.
import { ouvrirBase } from './donnees.mjs';
import { chargerVocabulaire } from './mots-cles-db.mjs';
import { classeDuMotCle, motCleDeLaPage } from './mots-cles-liens.mjs';
import { cssDesMotsCles } from './palette-css.mjs';

/**
 * La classe de la couleur principale de la page à l'adresse `chemin` (`base` : le préfixe de déploiement qu'elle porte) : celle du mot-clé coloré qui y
 * mène (`vocabulaire` : [{ id, libelle, url, couleur }]), sinon `repli` (la couleur d'avant, ou null).
 */
export function classeDeLaPage(vocabulaire, chemin, repli = null, { base = '/' } = {}) {
  return classeDuMotCle(motCleDeLaPage(vocabulaire ?? [], chemin, { base })) ?? repli ?? null;
}

/** Le vocabulaire de la base construite (lu une fois : lib/mots-cles-db.mjs#chargerVocabulaire le garde). */
export const vocabulaireDuSite = () => chargerVocabulaire(ouvrirBase());

/** classeDeLaPage d'après le vocabulaire de la base construite. */
export const classeDeLaPageDuSite = (chemin, repli = null, options = {}) => classeDeLaPage(vocabulaireDuSite(), chemin, repli, options);

let feuille = null;
/** La feuille des mots-clés colorés de la base construite (lib/palette-css.mjs#cssDesMotsCles), calculée une fois. */
export const cssDesMotsClesDuSite = () => (feuille ??= cssDesMotsCles(vocabulaireDuSite()));
