// Affichage d'un champ modifiable à partir de sa ligne en base (src/scripts/edition/ : mode modification du site de dev). Quand une page statique a été
// construite avant une modification, ou juste après l'enregistrement, le script réécrit l'élément `data-ed` avec ces fonctions : elles produisent le
// même HTML que les gabarits Astro (components/magie/Texte.astro, components/metier/MetiersTableau.astro…), à partir des mêmes fonctions pures.
// Fonctions pures (chaîne HTML en sortie, tout texte échappé), sans dépendance navigateur : testées dans test/edition-rendu.test.mjs.
import { decouperBonus, RIEN } from './metier-champs.mjs';
import { analyserType, bonusDeMaitrise } from './sort-analyse.mjs';
import { blocsDeTexte, coutDeSort, marquesDeMode, morceauxAvecLiens, valeurDeSort } from './sort-format.mjs';
import { marquerBonus } from './sort-maitrise.mjs';

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

/** Morceaux d'une case de sort (components/magie/Segments.astro) : valeur en gras, précision entre parenthèses en petit, expression de NM en pastille. */
const segmentsHtml = (segments) =>
  segments
    .map((s, i) => `${i > 0 ? ' ' : ''}${s.nm ? `<span class="nm">${echapperHtml(s.texte)}</span>` : s.modif ? `<small class="mod">(${echapperHtml(s.texte)})</small>` : `<span class="val">${echapperHtml(s.texte)}</span>`}`)
    .join('');
/** Bonus de NM d'une case, d'après son texte (lib/sort-analyse.mjs), au format de lib/sort-maitrise.mjs#marquerBonus. */
const bonusDeLaCase = (champ, texte) => bonusDeMaitrise(champ, texte).map((b) => ({ champ, texteBrut: b.texte_brut }));
/** Portée, zone, D/S/B (components/magie/LigneDeSort.astro). */
const valeurDeCase = (champ, liste) => (valeur) => {
  const v = valeurDeSort(valeur, { liste });
  if (v.vide) return VIDE;
  return marquerBonus(v.lignes, bonusDeLaCase(champ, valeur), champ).map((l) => `<div>${segmentsHtml(l)}</div>`).join('');
};

/**
 * Rendus nommés (attribut `data-ed-rendu` ; sans attribut : `texte`). Chacun reçoit la valeur de la colonne, la ligne entière et le contexte de la page
 * ({ competences } : listes du service) et rend du HTML.
 */
export const RENDUS = {
  texte: (valeur) => echapperHtml(valeur ?? ''),
  blocs: (valeur) => htmlDeBlocs(valeur),
  // Métiers (components/metier/MetiersTableau.astro)
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
  // Sorts (components/magie/LigneDeSort.astro) : types, mode et NM du type ; coût (principal + supplément) ; portée, zone, D/S/B
  'sort-type': (valeur) => {
    const a = analyserType(valeur);
    const types = a.types.map((t) => `<span class="genre" data-genre="${echapperHtml(t.type)}">${echapperHtml(t.libelle)}</span> `);
    const marques = marquesDeMode(a.modes).map((m) => `<span class="marque marque--${echapperHtml(m.genre)}">${echapperHtml(m.texte)}</span> `);
    const nm = bonusDeLaCase('type', valeur).map((b) => `<span class="nm">${echapperHtml(b.texteBrut)}</span> `);
    return [...types, ...marques, ...nm].join('');
  },
  'sort-cout': (valeur) => {
    const cout = coutDeSort(valeur);
    if (cout.vide) return VIDE;
    return marquerBonus(cout.parts, bonusDeLaCase('cout', valeur), 'cout')
      .map((part, i) => (i === 0 ? `<div>${segmentsHtml(part)}</div>` : `<div class="supplement">+ ${segmentsHtml(part)}</div>`))
      .join('');
  },
  'sort-portee': valeurDeCase('portee', false),
  'sort-zone': valeurDeCase('zone', false),
  'sort-dsb': valeurDeCase('dsb', true),
};

/** HTML d'un champ d'après son rendu ; un rendu inconnu retombe sur le texte. */
export const rendreChamp = (rendu, valeur, ligne, ctx) => (RENDUS[rendu] ?? RENDUS.texte)(valeur, ligne ?? {}, ctx);
