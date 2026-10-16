// Rendu HTML des lignes de la page /ressources/objets-a-la-ceinture/ (components/ceinture/CeinturePage.astro ; données : lib/ceinture-db.mjs).
// Chaque ligne porte son texte de recherche (`data-recherche` : mots en minuscules sans accents), que le script de la page (src/scripts/ceinture.mjs)
// filtre ; un groupe de potions (une page : « Fiole rouge » et ses paliers) est un <tbody> qui porte le sien (titre et résumé de la page).
// Prix et textes : monnaies en icônes (décision R63, lib/monnaies.mjs). Rien n'est calculé : chaque case écrit une valeur de la base, sauf la valeur en
// Ricken de fer d'un prix, en infobulle (la conversion des monnaies, R61, comme sur la page « Composants »).
// Fonctions pures, chaîne HTML en sortie, tout texte échappé. `lien(id)` donne l'adresse d'une page (url(cheminDePage(id)) dans la page).
import { htmlAvecMonnaies } from './monnaies.mjs';
import { RENDUS_DES_COMPOSANTS, ancreDeComposant } from './composants-rendu.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';

/** Le texte de recherche d'une ligne : ses mots en minuscules sans accents. */
export const texteDeRecherche = (...textes) =>
  textes.filter(Boolean).join(' ').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Ancre d'un objet de la page : « objet-potion-petite-fiole-rouge » pour « ressources/fiole-rouge#potion:petite-fiole-rouge ». */
export const ancreDObjet = (id) => `objet-${String(id).slice(String(id).indexOf('#') + 1).replace(/[^a-z0-9-]+/gi, '-')}`;

/**
 * Un texte de plusieurs lignes (effet d'une potion ; bonus d'un bâton, onglet « Bâtons magiques » de la page « Équipement » : lib/batons-rendu.mjs) :
 * une ligne par ligne écrite, la puce « - » d'une ligne retirée (l'alchimie primitive écrit ses effets en liste), les monnaies en icônes.
 */
export function htmlDeLignes(texte) {
  const l = String(texte ?? '').replace(/\r\n?/g, '\n').split('\n').map((x) => x.trim().replace(/^-\s+/, '')).filter(Boolean);
  return l.length ? l.map((x) => htmlAvecMonnaies(x)).join('<br>') : VIDE;
}

/** Un prix tel qu'écrit, en icônes, et sa valeur en Ricken de fer en infobulle (le rendu des prix de la page « Composants »). */
export const htmlDePrix = (prix) => RENDUS_DES_COMPOSANTS['composant-prix'](prix);

/**
 * Le début d'un groupe de potions : le <tbody> (ouvert, à fermer par l'appelant) et sa ligne de titre, le nom de la page en lien et son résumé. Chaque
 * <tbody> des tableaux de la page porte `data-ceinture-corps` (le script n'en filtre pas d'autres) ; celui d'un groupe, le texte de recherche de la page.
 */
export function htmlDEnteteDeGroupe(page, lien, colonnes) {
  const titre = page.existe ? `<a href="${e(lien(page.id))}">${e(page.titre)}</a>` : e(page.titre);
  return `<tbody class="ceint-groupe" data-ceinture-corps data-recherche="${e(texteDeRecherche(page.titre, page.resume))}">`
    + `<tr class="ceint-groupe__titre"><th scope="rowgroup" colspan="${colonnes}">${titre}`
    + `${page.resume ? ` <span class="ceint-groupe__resume">${htmlAvecMonnaies(page.resume)}</span>` : ''}</th></tr>`;
}

/** Une potion : Nom | Niveau | Prix | Effet. */
export const htmlDeLigneDePotion = (p) =>
  `<tr class="ceint-ligne" id="${e(ancreDObjet(p.id))}" data-recherche="${e(texteDeRecherche(p.nom, p.niveau, p.effet))}">`
  + `<th scope="row" class="ceint-nom">${e(p.nom)}</th><td class="ceint-niveau">${e(p.niveau)}</td>`
  + `<td class="ceint-prix">${htmlDePrix(p.prix_brut)}</td><td class="ceint-effet">${htmlDeLignes(p.effet)}</td></tr>`;

/** Un carquois ou un sac (matériel de l'onglet « Équipement inventaire ») : Nom (lien vers sa ligne de la page « Composants ») | Prix | Description. */
export const htmlDeLigneDeContenant = (r, adresseDesComposants) =>
  `<tr class="ceint-ligne" id="${e(ancreDObjet(r.id))}" data-recherche="${e(texteDeRecherche(r.nom, r.description))}">`
  + `<th scope="row" class="ceint-nom"><a href="${e(`${adresseDesComposants}#${ancreDeComposant(r.id)}`)}">${e(r.nom)}</a></th>`
  + `<td class="ceint-prix">${htmlDePrix(r.prix_brut)}</td><td class="ceint-description">${r.description ? htmlAvecMonnaies(r.description) : VIDE}</td></tr>`;
