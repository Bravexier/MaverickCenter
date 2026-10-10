// Affichage d'un champ modifiable à partir de sa ligne en base (src/scripts/edition/ : mode modification du site de dev). Quand une page statique a été
// construite avant une modification, ou juste après l'enregistrement, le script réécrit l'élément `data-ed` avec ces fonctions : elles produisent le
// même HTML que les gabarits Astro (components/magie/Texte.astro, components/metier/MetiersTableau.astro…), à partir des mêmes fonctions pures.
// Fonctions pures (chaîne HTML en sortie, tout texte échappé), sans dépendance navigateur : testées dans test/edition-rendu.test.mjs.
import { decouperBonus, RIEN } from './metier-champs.mjs';
import { blocsDeTexte, morceauxAvecLiens } from './sort-format.mjs';

const ENTITES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const echapperHtml = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES_HTML[c]);

/** Un texte avec ses adresses web en liens (comme Texte.astro). */
const avecLiens = (texte) =>
  morceauxAvecLiens(texte)
    .map((m) => (m.lien ? `<a href="${echapperHtml(m.lien)}" rel="noopener noreferrer">${echapperHtml(m.lien)}</a>` : echapperHtml(m.texte)))
    .join('');

/** Blocs d'un texte long (paragraphes, listes à puces, intertitres « ▸ ») : le HTML de components/magie/Texte.astro. */
export function htmlDeBlocs(texte) {
  return blocsDeTexte(texte)
    .map((b) =>
      'items' in b
        ? `<ul>${b.items.map((i) => `<li>${avecLiens(i)}</li>`).join('')}</ul>`
        : b.titre
          ? `<h6 class="texte-titre">${echapperHtml(b.texte)}</h6>`
          : `<p class="texte">${avecLiens(b.texte)}</p>`,
    )
    .join('');
}

const VIDE = '<span class="vide" aria-label="aucun">—</span>';

/**
 * Rendus nommés (attribut `data-ed-rendu` ; sans attribut : `texte`). Chacun reçoit la valeur de la colonne, la ligne entière et le contexte de la page
 * ({ competences } : listes du service) et rend du HTML.
 */
export const RENDUS = {
  texte: (valeur) => echapperHtml(valeur ?? ''),
  blocs: (valeur) => htmlDeBlocs(valeur),
  // Métiers (components/metier/MetiersTableau.astro)
  'metier-nom': (valeur, ligne) => {
    const ancre = `metier-${String(ligne.id).slice(String(ligne.id).indexOf('/') + 1)}`;
    return `<button type="button" class="metier__choisir" aria-expanded="false" aria-controls="detail-${echapperHtml(ancre)}">${echapperHtml(valeur)}</button>`;
  },
  'metier-bonus': (valeur, _ligne, ctx = {}) => {
    const rangs = [];
    for (const b of decouperBonus(valeur ?? '', ctx.competences ?? [])) rangs[b.rang - 1] ??= b.texte;
    return rangs.filter(Boolean).map((t) => `<div>${echapperHtml(t)}</div>`).join('');
  },
  'metier-artisanat': (_valeur, ligne) => {
    if (!ligne.peut_fabriquer) return VIDE;
    const test = ligne.test_brut ? ` <span class="metier__test" title="Caractéristiques à combiner pour fabriquer">${echapperHtml(ligne.test_brut.replace(/\s+/g, ' ').trim())}</span>` : '';
    return `${echapperHtml(ligne.artisanat_texte)}${test}`;
  },
  'metier-equipement': (valeur) => (valeur === RIEN || !valeur ? VIDE : echapperHtml(valeur)),
  'metier-avantage': (valeur) => (valeur && valeur.trim() !== '…' ? echapperHtml(valeur) : ''),
};

/** HTML d'un champ d'après son rendu ; un rendu inconnu retombe sur le texte. */
export const rendreChamp = (rendu, valeur, ligne, ctx) => (RENDUS[rendu] ?? RENDUS.texte)(valeur, ligne ?? {}, ctx);
