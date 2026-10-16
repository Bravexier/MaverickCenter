// Rendu HTML du tableau des bâtons magiques, onglet « Bâtons magiques » de la page /ressources/equipement/ (components/equipement/BatonsMagiques.astro ;
// données : lib/batons-db.mjs). Une ligne par magie : sa pastille, la gemme et le bois de sa recette (en lien vers leur ligne de la page « Composants »,
// où sont leurs prix), le bonus de chaque niveau tel qu'écrit. Rien n'est calculé. Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { ancreDeComposant } from './composants-rendu.mjs';
import { htmlDeLignes } from './ceinture-rendu.mjs';
import { couleurDeMagie, texteSurCouleur } from './sort-format.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';

/** Pastille d'une magie dans sa couleur. */
const htmlDeMagie = (magie) => {
  const fond = couleurDeMagie(magie?.nom);
  return `<span class="baton-magie" style="--c: ${fond}; --c-texte: ${texteSurCouleur(fond)}">${e(magie?.nom ?? '')}</span>`;
};

/** Une gemme ou un bois de la recette, en lien vers sa ligne de la page « Composants ». */
const htmlDeComposant = (c, adresseDesComposants) => (c ? `<a href="${e(`${adresseDesComposants}#${ancreDeComposant(c.id)}`)}">${e(c.nom)}</a>` : VIDE);

/** Ancre de la ligne des bâtons d'une magie : « baton-magie-du-feu » pour « magies/magie-du-feu ». */
export const ancreDeBatons = (magieId) => `baton-${String(magieId).replace(/^.*\//, '')}`;

/** Les bâtons d'une magie : Magie | Gemme | Bois | le bonus de chaque niveau (`niveaux` : [{ niveau }]). */
export const htmlDeLigneDeBatons = (m, niveaux, adresseDesComposants) =>
  `<tr class="baton" id="${e(ancreDeBatons(m.magie.id))}" style="--mag: ${couleurDeMagie(m.magie.nom)}">`
  + `<th scope="row" class="baton__magie">${htmlDeMagie(m.magie)}</th>`
  + `<td>${htmlDeComposant(m.gemme, adresseDesComposants)}</td><td>${htmlDeComposant(m.bois, adresseDesComposants)}</td>`
  + niveaux.map((n) => `<td class="baton__bonus">${htmlDeLignes(m.bonus[n.niveau])}</td>`).join('')
  + '</tr>';

/** L'en-tête d'une colonne de niveau de bâton : « Niveau 1 » et, dessous, sa recette (« 1 Gemme Commune + 1 bois [magie] »), telle qu'écrite. */
export function htmlDEnteteDeNiveau(entete) {
  const m = /^(Niveau\s+\d+)\s*\((.*)\)\s*$/.exec(String(entete ?? '').trim());
  return m ? `${e(m[1])}<span class="baton-recette">${e(m[2])}</span>` : e(entete);
}
