// Rendu HTML des lignes de la page /ressources/composants/ (components/composants/) : le même HTML sert à la page construite et au mode modification du
// site de dev (src/scripts/edition/composants.mjs, pour un composant créé depuis la construction ; lib/edition-rendu.mjs#RENDUS : une cellule modifiée se
// réaffiche depuis sa ligne de la base). Chaque champ modifiable porte son `data-ed` ; une ligne porte l'entité qui la crée ou la supprime (`data-entite`,
// `data-cle`) et, si d'autres règles la citent, pourquoi elle ne se supprime pas (`data-citee`).
// Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { conversionsDe, milliers, pourquoiPasSupprimable, prixEnRf } from './composants-champs.mjs';
import { htmlAvecMonnaies, htmlDePiece, MONNAIES_DU_JEU } from './monnaies.mjs';
import { CATEGORIES_D_INGREDIENTS } from './corps-composants.mjs';
import { attributEd } from './edition-modele.mjs';
import { couleurDeMateriau } from './materiaux-couleurs.mjs';
import { RENDUS_DES_ARMES } from './armes-rendu.mjs';
import { couleurDeMagie, texteSurCouleur } from './sort-format.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';
const ed = (table, cle, colonne) => e(attributEd(table, cle, colonne));

/** Ancre d'un composant : « composant-materiel-briquet » pour « ressources/equipement-inventaire#materiel:briquet ». */
export const ancreDeComposant = (id) => `composant-${String(id).slice(String(id).indexOf('#') + 1).replace(/[^a-z0-9-]+/gi, '-')}`;

/** Le texte de recherche d'une ligne (filtre de la page) : ses mots en minuscules sans accents. */
const recherche = (...textes) => e(textes.filter(Boolean).join(' ').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase());

/** Les attributs d'une ligne : son entité, sa clé, ce qui la cite (elle ne se supprime pas), son texte de recherche. */
const attributsDeLigne = (entite, cle, citations, textes) => {
  const citee = typeof citations === 'string' ? citations : pourquoiPasSupprimable(citations ?? []);
  return ` data-entite="${entite}" data-cle="${e(JSON.stringify(cle))}"${citee ? ` data-citee="${e(citee)}"` : ''} data-recherche="${recherche(...textes)}"`;
};

/** Pastille d'une magie dans sa couleur (gemmes, bois). */
export const htmlDeMagie = (magie) => {
  const fond = couleurDeMagie(magie?.nom);
  return `<span class="comp-magie" style="--c: ${fond}; --c-texte: ${texteSurCouleur(fond)}">${e(magie?.nom ?? '')}</span>`;
};

/** Rendus nommés (attribut `data-ed-rendu`), fusionnés dans lib/edition-rendu.mjs#RENDUS : (valeur de la colonne, ligne, contexte) → HTML. */
export const RENDUS_DES_COMPOSANTS = {
  // un prix tel qu'écrit, sa valeur en RF en infobulle (« 1 RO = 100 RF », CONVERTISSEUR de l'onglet)
  'composant-prix': (valeur) => {
    if (!valeur) return VIDE;
    const rf = prixEnRf(valeur);
    return `<span class="comp-prix"${rf === null ? '' : ` title="${e(`${milliers(rf)} Ricken de fer`)}"`}>${htmlAvecMonnaies(valeur)}</span>`;
  },
  // une description ; une adresse web seule (le doc « Alchimie » dans « Matos fabrication ») devient un lien
  'composant-description': (valeur) => {
    if (!valeur) return VIDE;
    if (/^https?:\/\/\S+$/.test(valeur)) return `<a href="${e(valeur)}" rel="noopener noreferrer">Voir le document</a>`;
    return e(valeur).replace(/\n/g, '<br>');
  },
  'monnaie-valeur': (valeur) => `<span class="comp-valeur">${e(milliers(valeur ?? ''))} ${htmlDePiece('RF')}</span>`,
  // le symbole d'une monnaie : son icône (lib/monnaies.mjs), l'abréviation d'une monnaie créée depuis le site, qui n'en a pas
  'monnaie-symbole': (valeur) => (MONNAIES_DU_JEU[String(valeur ?? '').toUpperCase()] ? htmlDePiece(String(valeur).toUpperCase()) : e(valeur ?? '')),
  // la catégorie d'un fruit : celle de l'ingrédient, « majeur » d'après son type (« Fruit (majeur) »)
  'ingredient-categorie': (valeur, ligne) => {
    const c = CATEGORIES_D_INGREDIENTS.find((x) => x.categorie === ligne?.categorie)?.section ?? ligne?.categorie ?? '';
    return e(/\(majeur\)/i.test(valeur ?? '') ? `${c} majeur` : c);
  },
};
const rendu = (nom, valeur, ligne) => RENDUS_DES_COMPOSANTS[nom](valeur, ligne);

/** Les conversions d'une monnaie vers les plus petites (« 1 PP = 1 000 RO = 100 000 RF »), d'après les valeurs en RF. */
export const htmlDesConversions = (m, monnaies) => {
  const c = conversionsDe(m, monnaies);
  return c.length ? htmlAvecMonnaies(`1 ${m.abreviation} = ${c.map((x) => `${milliers(x.valeur)} ${x.vers.abreviation}`).join(' = ')}`) : '<span class="muted">Unité</span>';
};

/** Une monnaie : Nom | Symbole (son icône) | Valeur en RF (non modifiable) | Conversions (refaites par l'extension de l'éditeur après un enregistrement). */
export const htmlDeLigneDeMonnaie = (m, monnaies) =>
  `<tr class="composant" id="${e(`monnaie-${m.id}`)}" data-monnaie="${e(m.id)}" data-valeur="${e(m.valeur_rf)}"${attributsDeLigne('monnaie', { id: m.id }, m.valeur_rf === 1 ? 'L’unité des monnaies ne se supprime pas' : '', [m.nom, m.abreviation])}>`
  + `<th scope="row" class="comp-nom" data-ed="${ed('monnaie', { id: m.id }, 'nom')}">${e(m.nom)}</th>`
  + `<td class="comp-abr" data-abreviation="${e(m.abreviation)}" data-ed="${ed('monnaie', { id: m.id }, 'abreviation')}" data-ed-rendu="monnaie-symbole">${rendu('monnaie-symbole', m.abreviation)}</td>`
  + `<td>${rendu('monnaie-valeur', m.valeur_rf)}</td>`
  + `<td class="comp-conversions" data-conversions>${htmlDesConversions(m, monnaies)}</td></tr>`;

/** Les cases Nom (et sa pastille), Prix, Description d'une ressource. */
const nom = (r, pastille = '') => `<th scope="row" class="comp-nom">${pastille}<span data-ed="${ed('ressource', { id: r.id }, 'nom')}">${e(r.nom)}</span></th>`;
const prix = (r) => `<td class="comp-prix-case" data-ed="${ed('ressource', { id: r.id }, 'prix_brut')}" data-ed-rendu="composant-prix">${rendu('composant-prix', r.prix_brut)}</td>`;
const description = (r) => `<td class="comp-description" data-ed="${ed('ressource', { id: r.id }, 'description')}" data-ed-rendu="composant-description">${rendu('composant-description', r.description)}</td>`;

/**
 * Un matériau (décision R62 : la page « Composants » en est la seule source) : Nom (dans sa couleur) | Type (d'après l'armure) | Prix | Description |
 * Effets sur une arme (ceux du tableau MATÉRIAUX de l'onglet « Armes », pour un matériau d'arme) | Utilisé pour (armes, armures, boucliers, montures).
 */
export function htmlDeLigneDeMateriau(r) {
  const c = couleurDeMateriau(r.id);
  const pastille = `<span class="comp-teinte" style="--c: ${c.fond}" aria-hidden="true"></span>`;
  const usages = (r.usages ?? []).map((u) => `<span class="comp-usage">${e(u)}</span>`).join(' ') || VIDE;
  const arme = r.arme
    ? `<td class="comp-effet" data-ed="${ed('materiau_arme', { ressource_id: r.id }, 'effet_brut')}" data-ed-rendu="materiau-effet">${RENDUS_DES_ARMES['materiau-effet'](r.arme.effet_brut)}</td>`
    : `<td class="comp-effet">${VIDE}</td>`;
  return `<tr class="composant" id="${ancreDeComposant(r.id)}"${attributsDeLigne('materiau', { ressource_id: r.id }, r.citations, [r.nom, r.type, r.description])}>`
    + `${nom(r, pastille)}<td class="comp-type" data-ed="${ed('materiau', { ressource_id: r.id }, 'type')}">${e(r.type ?? 'Autres')}</td>`
    + `${prix(r)}${description(r)}${arme}<td class="comp-usages">${usages}</td></tr>`;
}

/** Les prix d'une gemme, par qualité : la gemme entière (bâton magique) puis le quart (accessoires). */
const PRIX_D_UNE_GEMME = ['prix_commune_brut', 'prix_raffinee_brut', 'prix_parfaite_brut', 'quart_commune_brut', 'quart_raffinee_brut', 'quart_parfaite_brut'];

/** Une gemme : Magie | Nom | Description | gemme commune, raffinée, parfaite | quart commune, raffinée, parfaite. */
export const htmlDeLigneDeGemme = (g) =>
  `<tr class="composant" id="${ancreDeComposant(g.id)}" style="--mag: ${couleurDeMagie(g.magie?.nom)}"${attributsDeLigne('gemme', { ressource_id: g.id }, g.citations, [g.nom, g.magie?.nom, g.description])}>`
  + `<td class="comp-magie-case">${htmlDeMagie(g.magie)}</td>${nom(g)}${description(g)}`
  + PRIX_D_UNE_GEMME.map((c, i) => `<td class="comp-prix-case${i === 3 ? ' comp-quart' : ''}" data-ed="${ed('gemme', { ressource_id: g.id }, c)}" data-ed-rendu="composant-prix">${rendu('composant-prix', g[c])}</td>`).join('')
  + '</tr>';

/** Un bois de bâton magique : Magie | Nom | Description | Prix. */
export const htmlDeLigneDeBois = (b) =>
  `<tr class="composant" id="${ancreDeComposant(b.id)}" style="--mag: ${couleurDeMagie(b.magie?.nom)}"${attributsDeLigne('bois', { ressource_id: b.id }, b.citations, [b.nom, b.magie?.nom, b.description])}>`
  + `<td class="comp-magie-case">${htmlDeMagie(b.magie)}</td>${nom(b)}${description(b)}${prix(b)}</tr>`;

/** Un ingrédient d'alchimie : Nom | (Catégorie, pour un fruit) | Type | Affinité. */
export function htmlDeLigneDIngredient(i, { fruit = false } = {}) {
  const cle = { ressource_id: i.id };
  return `<tr class="composant" id="${ancreDeComposant(i.id)}"${attributsDeLigne('ingredient', cle, i.citations, [i.nom, i.type_brut, i.affinite_brut])}>`
    + nom(i)
    + (fruit ? `<td class="comp-categorie" data-ed-lecture="${ed('ingredient_alchimie', cle, 'type_brut')}" data-ed-rendu="ingredient-categorie">${rendu('ingredient-categorie', i.type_brut, i)}</td>` : '')
    + `<td data-ed="${ed('ingredient_alchimie', cle, 'type_brut')}">${e(i.type_brut)}</td>`
    + `<td data-ed="${ed('ingredient_alchimie', cle, 'affinite_brut')}">${e(i.affinite_brut)}</td></tr>`;
}

/** Un objet de l'onglet « Équipement inventaire » : Nom | Prix (| Description, pour les matos). */
export const htmlDeLigneDObjet = (r, avecDescription) =>
  `<tr class="composant" id="${ancreDeComposant(r.id)}"${attributsDeLigne('composant', { id: r.id }, r.citations, [r.nom, r.description])}>`
  + `${nom(r)}${prix(r)}${avecDescription ? description(r) : ''}</tr>`;
