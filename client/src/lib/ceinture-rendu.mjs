// Rendu HTML des lignes de l'onglet « Ceinture » de la page /ressources/equipement/ (components/ceinture/CeinturePanneau.astro ; données :
// lib/ceinture-db.mjs) : les potions du sous-onglet Consommables, un tableau par page (« Fiole rouge » et ses paliers ; demande du propriétaire,
// 2026-10-17 : « Les tableaux des fioles sont trop larrges Mettre de coté 2 ou 3 tableaux serai plus lisible »), et les carquois et sacs du
// sous-onglet Carquois. Plus de recherche (demande du propriétaire, 2026-10-16 : des sous-onglets « plutôt que la recherche actuel ») : aucune ligne
// ne porte de texte de recherche.
// Chaque potion est sur la couleur que lui donne la règle du site (demandes du propriétaire : le 2026-10-16, « récupérer les couleurs utilisé dans les
// tableaux du GoogleSheet pour les lignes présentes » ; le 2026-10-22, « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle
// il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; lib/alchimie-couleurs.mjs : l'affinité de son
// essence, ou la caractéristique d'un philtre, nuancée selon son niveau) : la ligne colorée du gabarit commun des tableaux (`ligne-couleur`,
// `--ligne-fond` et `--ligne-texte` : styles/global/tableaux.css), le texte le plus lisible sur le fond (« Privilégé la lisibilité. ») ; une potion
// sans couleur (essence Anti) reste neutre. Les carquois et sacs n'ont pas de couleur.
// Prix et textes : monnaies en icônes (décision R63, lib/monnaies.mjs). Rien n'est calculé : chaque case écrit une valeur de la base, sauf la valeur en
// Ricken de fer d'un prix, en infobulle (la conversion des monnaies, R61, comme sur la page « Composants »).
// Mode modification du site de dev (demande du propriétaire, 2026-10-17 : « Les tableaux des consommables devrai pouvoir aussi être modifiées . (sauf
// pour les champ calculés) ») : les quatre cases saisies d'une potion portent leur `data-ed` — nom et prix (sa ressource), niveau et effet (sa ligne de
// potion) — et leur rendu nommé (RENDUS_DE_LA_CEINTURE, fusionnés dans lib/edition-rendu.mjs#RENDUS ; le prix : celui de la page « Composants ») : le
// même HTML sert à la page construite et à l'éditeur commun (src/scripts/edition/editeur.mjs), qui réécrit une case depuis sa ligne de la base. En
// lecture : la couleur de la ligne (la règle du site), la valeur en RF d'un prix, le titre et le résumé d'un tableau (ceux de la page de la potion),
// et les carquois et sacs (ils se modifient sur la page « Composants »).
// Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { htmlAvecMonnaies } from './monnaies.mjs';
import { RENDUS_DES_COMPOSANTS, ancreDeComposant } from './composants-rendu.mjs';
import { attributEd } from './edition-modele.mjs';
import { texteSurCouleur } from './sort-format.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';
const ed = (table, cle, colonne) => e(attributEd(table, cle, colonne));

/** Ancre d'un objet de l'onglet : « objet-potion-petite-fiole-rouge » pour « ressources/fiole-rouge#potion:petite-fiole-rouge ». */
export const ancreDObjet = (id) => `objet-${String(id).slice(String(id).indexOf('#') + 1).replace(/[^a-z0-9-]+/gi, '-')}`;

/**
 * Les couleurs d'une ligne colorée (`couleur` : { fond, texte? }, lib/alchimie-couleurs.mjs#couleurDePotion) : son fond, et le texte donné ou, sinon,
 * le plus lisible sur ce fond ({ fond, texte }) ; null sans couleur. Partagé avec les bâtons magiques (lib/batons-rendu.mjs).
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

/** L'ancre du tableau d'une page de potions : « potions-fiole-rouge » pour « ressources/fiole-rouge ». */
export const ancreDePotions = (pageId) => `potions-${String(pageId).slice(String(pageId).lastIndexOf('/') + 1).replace(/[^a-z0-9-]+/gi, '-')}`;

/**
 * Rendus nommés des cases d'une potion (attribut `data-ed-rendu`), fusionnés dans lib/edition-rendu.mjs#RENDUS : (valeur de la colonne, ligne, contexte) →
 * HTML. `potion-niveau` : le nom du niveau d'alchimie (`ctx.niveauxDAlchimie` : [{ valeur, libelle }], liste du service) ; `potion-effet` : ses lignes.
 */
export const RENDUS_DE_LA_CEINTURE = {
  'potion-niveau': (valeur, _ligne, ctx = {}) => e((ctx.niveauxDAlchimie ?? []).find((n) => n.valeur === valeur)?.libelle ?? valeur ?? ''),
  'potion-effet': (valeur) => htmlDeLignes(valeur),
};

/**
 * Une potion : Nom | Niveau | Prix | Effet, sur la couleur de son palier (ou neutre) ; chaque case saisie avec son `data-ed` (nom et prix : la ressource,
 * niveau et effet : la ligne de potion) et son rendu.
 */
export function htmlDeLigneDePotion(p) {
  const c = couleursDeLaLigne(p.couleur);
  const style = c ? ` style="--ligne-fond: ${e(c.fond)}; --ligne-texte: ${e(c.texte)}"` : '';
  const ressource = { id: p.id };
  const potion = { ressource_id: p.id };
  const niveaux = { niveauxDAlchimie: [{ valeur: p.niveau_id, libelle: p.niveau }] };
  return `<tr class="ceint-ligne${c ? ' ligne-couleur' : ''}" id="${e(ancreDObjet(p.id))}"${style}>`
    + `<th scope="row" class="ceint-nom" data-ed="${ed('ressource', ressource, 'nom')}">${e(p.nom)}</th>`
    + `<td class="ceint-niveau" data-ed="${ed('potion', potion, 'niveau_id')}" data-ed-rendu="potion-niveau">${RENDUS_DE_LA_CEINTURE['potion-niveau'](p.niveau_id, p, niveaux)}</td>`
    + `<td class="ceint-prix" data-ed="${ed('ressource', ressource, 'prix_brut')}" data-ed-rendu="composant-prix">${htmlDePrix(p.prix_brut)}</td>`
    + `<td class="ceint-effet" data-ed="${ed('potion', potion, 'effet')}" data-ed-rendu="potion-effet">${RENDUS_DE_LA_CEINTURE['potion-effet'](p.effet)}</td></tr>`;
}

/** Un carquois ou un sac (matériel de l'onglet « Équipement inventaire ») : Nom (lien vers sa ligne de la page « Composants ») | Prix | Description. */
export const htmlDeLigneDeContenant = (r, adresseDesComposants) =>
  `<tr class="ceint-ligne" id="${e(ancreDObjet(r.id))}">`
  + `<th scope="row" class="ceint-nom"><a href="${e(`${adresseDesComposants}#${ancreDeComposant(r.id)}`)}">${e(r.nom)}</a></th>`
  + `<td class="ceint-prix">${htmlDePrix(r.prix_brut)}</td><td class="ceint-description">${r.description ? htmlAvecMonnaies(r.description) : VIDE}</td></tr>`;
