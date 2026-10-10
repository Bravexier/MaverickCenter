// Affichage d'un champ modifiable à partir de sa ligne en base (src/scripts/edition/ : mode modification du site de dev). Quand une page statique a été
// construite avant une modification, ou juste après l'enregistrement, le script réécrit l'élément `data-ed` avec ces fonctions : elles produisent le
// même HTML que les gabarits Astro (components/magie/Texte.astro, components/metier/MetiersTableau.astro…), à partir des mêmes fonctions pures.
// Fonctions pures (chaîne HTML en sortie, tout texte échappé), sans dépendance navigateur : testées dans test/edition-rendu.test.mjs.
import { analyserTypeDeDon, decouperInventaire, lignesDeListe } from './classe-champs.mjs';
import { typeDeDon } from './classe-dons.mjs';
import { decouperBonus, RIEN } from './metier-champs.mjs';
import { analyserType, bonusDeMaitrise } from './sort-analyse.mjs';
import { blocsDeTexte, coutDeSort, marquesDeMode, morceauxAvecEtats, morceauxAvecLiens, valeurDeSort } from './sort-format.mjs';
import { marquerBonus } from './sort-maitrise.mjs';

const ENTITES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const echapperHtml = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES_HTML[c]);

/** Un texte avec ses adresses web en liens (comme Texte.astro). */
const avecLiens = (texte) =>
  morceauxAvecLiens(texte)
    .map((m) => (m.lien ? `<a href="${echapperHtml(m.lien)}" rel="noopener noreferrer">${echapperHtml(m.lien)}</a>` : echapperHtml(m.texte)))
    .join('');

/** Longueur du texte qui précède une pastille, relevé avec elle pour la replacer au même endroit (voir placerPastilles). */
export const CONTEXTE_PASTILLE = 40;

/**
 * Les pastilles d'altération d'état qu'un champ montrait ({ forme : le mot, avant : les CONTEXTE_PASTILLE caractères qui le précédaient dans son bloc,
 * html : la pastille rendue }), replacées dans les textes du champ comme le gabarit les place (lib/sort-format.mjs#morceauxAvecEtats, chacune une
 * fois) : d'abord là où son mot suit encore le même texte, sinon sur la première occurrence libre de son mot ; un mot disparu emporte sa pastille.
 * -> pour chaque texte, ses morceaux [{ texte } | { texte, etat: { html } }].
 */
export function placerPastilles(textes, pastilles) {
  let morceaux = textes.map((t) => [{ texte: t }]);
  if (!pastilles?.length) return morceaux;
  const placer = (restantes) => {
    morceaux = morceaux.map((liste) => liste.flatMap((m) => (m.etat || !restantes.length ? [m] : morceauxAvecEtats(m.texte, restantes))));
  };
  const restantes = pastilles.map((p) => ({ forme: p.forme, extrait: `${(p.avant ?? '').slice(-CONTEXTE_PASTILLE)}${p.forme}`, html: p.html }));
  placer(restantes); // avec le texte qui les précédait
  placer(restantes.map((r) => ({ ...r, extrait: r.forme }))); // les autres : sur leur mot seul
  return morceaux;
}

/**
 * Blocs d'un texte long (paragraphes, listes à puces, intertitres « ▸ ») : le HTML de components/magie/Texte.astro, avec les pastilles d'état que
 * le champ montrait (`pastilles`, voir placerPastilles).
 */
export function htmlDeBlocs(texte, pastilles = null) {
  const blocs = blocsDeTexte(texte);
  const morceaux = placerPastilles(blocs.flatMap((b) => ('items' in b ? b.items : b.titre ? [] : [b.texte])), pastilles);
  let i = 0;
  const suivant = () => morceaux[i++].map((m) => (m.etat ? m.etat.html : avecLiens(m.texte))).join('');
  return blocs
    .map((b) =>
      'items' in b
        ? `<ul>${b.items.map(() => `<li>${suivant()}</li>`).join('')}</ul>`
        : b.titre
          ? `<h6 class="texte-titre">${echapperHtml(b.texte)}</h6>`
          : `<p class="texte">${suivant()}</p>`,
    )
    .join('');
}

const VIDE = '<span class="vide" aria-label="aucun">—</span>';
let compteurBulles = 0; // ids des infobulles rendues ici (« objet-ed-N » : jamais ceux du build, « objet-N »)

/**
 * Morceaux d'une case de sort (components/magie/Segments.astro) : valeur en gras, précision entre parenthèses en petit, expression de NM en pastille.
 * `morceaux(texte)` : le texte d'un segment coupé autour de ses pastilles d'état (par défaut : aucune).
 */
const segmentsHtml = (segments, morceaux = (t) => [{ texte: t }]) =>
  segments
    .map((s, i) => {
      const contenu = morceaux(s.texte).map((m) => (m.etat ? m.etat.html : echapperHtml(m.texte))).join('');
      return `${i > 0 ? ' ' : ''}${s.nm ? `<span class="nm">${contenu}</span>` : s.modif ? `<small class="mod">(${contenu})</small>` : `<span class="val">${contenu}</span>`}`;
    })
    .join('');
/** Bonus de NM d'une case, d'après son texte (lib/sort-analyse.mjs), au format de lib/sort-maitrise.mjs#marquerBonus. */
const bonusDeLaCase = (champ, texte) => bonusDeMaitrise(champ, texte).map((b) => ({ champ, texteBrut: b.texte_brut }));
/** Portée, zone, D/S/B (components/magie/LigneDeSort.astro : seule la case D/S/B place des pastilles d'état). */
const valeurDeCase = (champ, liste) => (valeur, _ligne, ctx = {}) => {
  const v = valeurDeSort(valeur, { liste });
  if (v.vide) return VIDE;
  const lignes = marquerBonus(v.lignes, bonusDeLaCase(champ, valeur), champ);
  const places = placerPastilles(lignes.flat().map((s) => s.texte), champ === 'dsb' ? ctx.pastilles : null);
  let i = 0;
  return lignes.map((l) => `<div>${segmentsHtml(l, () => places[i++])}</div>`).join('');
};

/**
 * Rendus nommés (attribut `data-ed-rendu` ; sans attribut : `texte`). Chacun reçoit la valeur de la colonne, la ligne entière et le contexte de la page
 * ({ competences } : listes du service ; { pastilles } : celles que le champ montrait, voir htmlDeBlocs) et rend du HTML.
 */
export const RENDUS = {
  texte: (valeur) => echapperHtml(valeur ?? ''),
  blocs: (valeur, _ligne, ctx = {}) => htmlDeBlocs(valeur, ctx.pastilles),
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
  // Classes (components/classes/ClassePage.astro, DonCarte.astro) : listes à tirets, inventaire, type d'un don
  liste: (valeur) => lignesDeListe(valeur).map((l) => `<li>${echapperHtml(l)}</li>`).join(''),
  // inventaire : un objet du glossaire (ctx.objets : objet_depart, listes du service) a son infobulle, comme dans ClassePage.astro
  inventaire: (valeur, _ligne, ctx = {}) => {
    const glossaire = new Map((ctx.objets ?? []).map((o) => [o.id, o]));
    const emplacements = [];
    for (const o of decouperInventaire(valeur, ctx.objets ?? [])) (emplacements[o.rang - 1] ??= []).push(o);
    const objet = (o) => {
      const g = glossaire.get(o.objet_depart_id);
      if (!g?.description) return `<span class="objet objet--seul">${echapperHtml(o.texte)}</span>`;
      const id = `objet-ed-${++compteurBulles}`;
      return `<span class="bulle-zone"><button type="button" class="objet" data-bulle="${id}" aria-describedby="${id}" title="${echapperHtml(`${g.nom} : ${g.description}`)}">${echapperHtml(o.texte)}</button>`
        + `<span class="bulle" role="tooltip" id="${id}" hidden><strong class="bulle__titre">${echapperHtml(g.nom)}</strong><span class="bulle__texte">${echapperHtml(g.description)}</span></span></span>`;
    };
    return emplacements
      .filter(Boolean)
      .map((options) => `<li${options.length > 1 ? ' class="inventaire__choix"' : ''}>${options
        .map((o, j) => `${j > 0 ? '<span class="inventaire__ou">ou</span>' : ''}${objet(o)}`)
        .join('')}</li>`)
      .join('');
  },
  // type d'un don : nom et définition du guide (ctx.typesDon : table type_don, listes du service) en infobulle native, comme DonCarte.astro
  'don-type': (valeur, _ligne, ctx = {}) => {
    if (!valeur) return '';
    const { type } = analyserTypeDeDon(valeur);
    const { mot, precision } = typeDeDon(valeur);
    const connu = (ctx.typesDon ?? []).find((t) => t.id === type);
    const libelle = connu?.nom ?? { passif: 'Passif', actif: 'Actif', action: 'Action', reaction: 'Réaction' }[type] ?? mot;
    const bulle = connu?.definition ? ` title="${echapperHtml(`${libelle} : ${connu.definition}`)}"` : '';
    return `${type ? `<span class="don-type" data-type="${type}"${bulle}>${echapperHtml(libelle)}</span>` : ''}${precision ? `<span class="don__precision">${echapperHtml(precision)}</span>` : ''}`;
  },
  'sort-portee': valeurDeCase('portee', false),
  'sort-zone': valeurDeCase('zone', false),
  'sort-dsb': valeurDeCase('dsb', true),
};

/** HTML d'un champ d'après son rendu ; un rendu inconnu retombe sur le texte. */
export const rendreChamp = (rendu, valeur, ligne, ctx) => (RENDUS[rendu] ?? RENDUS.texte)(valeur, ligne ?? {}, ctx);
