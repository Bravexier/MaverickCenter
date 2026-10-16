// Rendu HTML des lignes de l'onglet « Ceinture » de la page /ressources/equipement/ (components/ceinture/CeinturePanneau.astro ; données :
// lib/ceinture-db.mjs) : les potions du sous-onglet Consommables, groupées par page (un <tbody> par page : « Fiole rouge » et ses paliers), et les
// carquois et sacs du sous-onglet Carquois. Plus de recherche (demande du propriétaire, 2026-10-16 : des sous-onglets « plutôt que la recherche
// actuel ») : aucune ligne ne porte de texte de recherche.
// Chaque potion est sur la couleur de son palier dans le Doc « Alchimie » (demande du propriétaire, 2026-10-16 : « récupérer les couleurs utilisé
// dans les tableaux du GoogleSheet pour les lignes présentes » ; lib/ceinture-couleurs.mjs) : `--ceint-fond` et `--ceint-texte` sur la ligne, le
// texte que le Doc pose ou, sinon, le plus lisible sur le fond ; une potion que le Doc ne colore pas reste neutre. Les carquois et sacs n'ont pas de
// couleur dans le classeur.
// Prix et textes : monnaies en icônes (décision R63, lib/monnaies.mjs). Rien n'est calculé : chaque case écrit une valeur de la base, sauf la valeur en
// Ricken de fer d'un prix, en infobulle (la conversion des monnaies, R61, comme sur la page « Composants »).
// Fonctions pures, chaîne HTML en sortie, tout texte échappé. `lien(id)` donne l'adresse d'une page (url(cheminDePage(id)) dans l'onglet).
import { htmlAvecMonnaies } from './monnaies.mjs';
import { RENDUS_DES_COMPOSANTS, ancreDeComposant } from './composants-rendu.mjs';
import { texteSurCouleur } from './sort-format.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';

/** Ancre d'un objet de l'onglet : « objet-potion-petite-fiole-rouge » pour « ressources/fiole-rouge#potion:petite-fiole-rouge ». */
export const ancreDObjet = (id) => `objet-${String(id).slice(String(id).indexOf('#') + 1).replace(/[^a-z0-9-]+/gi, '-')}`;

/**
 * Les couleurs d'une ligne colorée (`couleur` : { fond, texte? } de lib/ceinture-couleurs.mjs) : son fond, et le texte que la source pose ou, sinon,
 * le plus lisible sur ce fond ({ fond, texte }) ; null sans couleur. Partagé avec les bâtons magiques (lib/batons-rendu.mjs, qui le pose en `--mag`).
 */
export function couleursDeLaLigne(couleur) {
  if (!couleur?.fond) return null;
  return { fond: couleur.fond, texte: couleur.texte ?? texteSurCouleur(couleur.fond) };
}

/**
 * Un texte de plusieurs lignes (effet d'une potion ; bonus d'un bâton, sous-onglet « Bâtons magiques » : lib/batons-rendu.mjs) : une ligne par
 * ligne écrite, la puce « - » d'une ligne retirée (l'alchimie primitive écrit ses effets en liste), les monnaies en icônes.
 */
export function htmlDeLignes(texte) {
  const l = String(texte ?? '').replace(/\r\n?/g, '\n').split('\n').map((x) => x.trim().replace(/^-\s+/, '')).filter(Boolean);
  return l.length ? l.map((x) => htmlAvecMonnaies(x)).join('<br>') : VIDE;
}

/** Un prix tel qu'écrit, en icônes, et sa valeur en Ricken de fer en infobulle (le rendu des prix de la page « Composants »). */
export const htmlDePrix = (prix) => RENDUS_DES_COMPOSANTS['composant-prix'](prix);

/**
 * Le début d'un groupe de potions : le <tbody> (ouvert, à fermer par l'appelant) et sa ligne de titre, le nom de la page en lien et son résumé.
 */
export function htmlDEnteteDeGroupe(page, lien, colonnes) {
  const titre = page.existe ? `<a href="${e(lien(page.id))}">${e(page.titre)}</a>` : e(page.titre);
  return '<tbody class="ceint-groupe">'
    + `<tr class="ceint-groupe__titre"><th scope="rowgroup" colspan="${colonnes}">${titre}`
    + `${page.resume ? ` <span class="ceint-groupe__resume">${htmlAvecMonnaies(page.resume)}</span>` : ''}</th></tr>`;
}

/** Une potion : Nom | Niveau | Prix | Effet, sur la couleur de son palier (ou neutre). */
export function htmlDeLigneDePotion(p) {
  const c = couleursDeLaLigne(p.couleur);
  const style = c ? ` style="--ceint-fond: ${e(c.fond)}; --ceint-texte: ${e(c.texte)}"` : '';
  return `<tr class="ceint-ligne${c ? ' ceint-ligne--couleur' : ''}" id="${e(ancreDObjet(p.id))}"${style}>`
    + `<th scope="row" class="ceint-nom">${e(p.nom)}</th><td class="ceint-niveau">${e(p.niveau)}</td>`
    + `<td class="ceint-prix">${htmlDePrix(p.prix_brut)}</td><td class="ceint-effet">${htmlDeLignes(p.effet)}</td></tr>`;
}

/** Un carquois ou un sac (matériel de l'onglet « Équipement inventaire ») : Nom (lien vers sa ligne de la page « Composants ») | Prix | Description. */
export const htmlDeLigneDeContenant = (r, adresseDesComposants) =>
  `<tr class="ceint-ligne" id="${e(ancreDObjet(r.id))}">`
  + `<th scope="row" class="ceint-nom"><a href="${e(`${adresseDesComposants}#${ancreDeComposant(r.id)}`)}">${e(r.nom)}</a></th>`
  + `<td class="ceint-prix">${htmlDePrix(r.prix_brut)}</td><td class="ceint-description">${r.description ? htmlAvecMonnaies(r.description) : VIDE}</td></tr>`;
