// Le HTML des dons et des spécialités d'une page de classe, tel que les gabarits l'écrivent (components/classes/ClasseDons.astro, ChoixDeDons.astro,
// DonCarte.astro et la section « Spécialités » de ClassePage.astro) : en mode modification sur le site de dev (D11), la page d'une classe dont des
// spécialités ou des dons ont été créés ou supprimés depuis la construction du site est redessinée depuis son état vivant (src/scripts/edition/classes.mjs),
// à partir du même assemblage que le build (lib/classe-assemblage.mjs). Mêmes champs `data-ed` que les gabarits, ancres tirées des identifiants.
// test/classe-dons-rendu.test.mjs compare ce rendu à celui des pages construites. Fonctions pures (chaînes HTML, tout texte échappé), sans navigateur.
import { nomsSeRepondent } from './classe-dons.mjs';
import { attributEd } from './edition-modele.mjs';
import { echapperHtml, htmlDesBlocs, RENDUS } from './edition-rendu.mjs';

const ed = (table, cle, colonne) => echapperHtml(attributEd(table, cle, colonne));
const EN_LETTRES = { 2: 'deux', 3: 'trois', 4: 'quatre' };

/**
 * Options communes : `base` (préfixe des adresses du site, « / » par défaut), `typesDon` (table type_don : nom et définition du guide), `amMagique`
 * (bonus d'armure magique d'une classe magique), `hrefDuDon(don)` (lien du nom d'un don ; par défaut sa fiche, `<base>capacites/<slug>/` : la page
 * d'un don créé depuis la construction n'existe pas encore, l'éditeur lui donne l'ancre du don sur la page).
 */
const lienParDefaut = (base) => (don) => `${base}capacites/${don.slug}/`;

/** Un don en carte (DonCarte.astro). */
export function htmlDeDon(don, { titre = 'h4', cartouche = false, base = '/', typesDon = [], hrefDuDon = lienParDefaut(base) } = {}) {
  const c = (colonne) => ed('capacite', { id: don.id }, colonne);
  const vide = (b) => (b ? ' hidden' : '');
  const type = don.type || don.precision ? RENDUS['don-type'](don.typeBrut, {}, { typesDon }) : '';
  return `<article class="don${cartouche ? ' don--cartouche' : ''}" id="${echapperHtml(don.ancre)}"${don.type?.id ? ` data-type="${echapperHtml(don.type.id)}"` : ''}>`
    + '<header class="don__tete">'
    + `<span class="don__niveau" title="Niveau de classe ${don.niveau}">Niv. ${don.niveau}</span>`
    + `<${titre} class="don__nom" data-ed="${c('nom')}" data-ed-cible="a"><a href="${echapperHtml(hrefDuDon(don))}">${echapperHtml(don.nom)}</a></${titre}>`
    + '</header>'
    + `<p class="don__type" data-ed="${c('type_brut')}" data-ed-rendu="don-type" data-ed-cadre${vide(!(don.type || don.precision))}>${type}</p>`
    + `<div class="don__effet" data-ed="${c('effet')}" data-ed-rendu="blocs" data-ed-cadre${vide(!don.effet.length)}>${htmlDesBlocs(don.effet)}</div>`
    + `<div class="don__remarque" data-ed-cadre=".don__remarque-texte"${vide(!don.remarque.length)}>`
    + '<p class="don__remarque-titre">Remarque</p>'
    + `<div class="don__remarque-texte" data-ed="${c('remarque')}" data-ed-rendu="blocs">${htmlDesBlocs(don.remarque)}</div>`
    + '</div></article>';
}

/** Un choix encadré (ChoixDeDons.astro) : « Au choix », « un seul des N », « ou » (ou « / » entre deux noms coupés qui se répondent). */
export function htmlDeChoix(niveau, options, { titre = 'h4', ...o } = {}) {
  const id = `choix-${options[0].slug}`;
  const combien = `un seul des ${EN_LETTRES[options.length] ?? options.length}`;
  return `<div class="choix choix--${options.length}" role="group" aria-labelledby="${echapperHtml(id)}">`
    + `<p class="choix__tete" id="${echapperHtml(id)}"><span class="choix__badge">Au choix</span><span class="choix__regle">Niveau ${niveau} : ${combien}</span></p>`
    + `<div class="choix__options">${options.map((d, i) => `${i > 0 ? `<span class="choix__ou" aria-hidden="true"><span>${nomsSeRepondent(options[i - 1].nom, d.nom) ? '/' : 'ou'}</span></span>` : ''}${htmlDeDon(d, { ...o, titre })}`).join('')}</div>`
    + '</div>';
}

/** La règle de l'étage des spécialités, selon leur nombre (une seule : la spécialité de la classe, sans « Au choix »). */
export function regleDesSpecialites(niveau, n) {
  if (n === 1) return { badge: false, texte: `Niveau ${niveau} : la spécialité de la classe.` };
  if (n === 2) return { badge: true, texte: `Niveau ${niveau} : une seule spécialité sur les deux. Elle exclut l’autre et tous ses dons.` };
  return { badge: true, texte: `Niveau ${niveau} : une seule spécialité. Elle exclut les autres et tous leurs dons.` };
}

function htmlDesSpecialitesEnOnglets(etage, o) {
  const magique = (col, classe) => (col.cartouche?.classeMagique && o.amMagique !== null && o.amMagique !== undefined ? classe : '');
  const regle = regleDesSpecialites(etage.niveau, etage.specialites.length);
  const onglets = etage.specialites.map((col, i) => {
    const s = col.specialite;
    return `${i > 0 ? '<span class="onglets__ou" aria-hidden="true"><span>ou</span></span>' : ''}`
      + `<a class="onglet${i === 0 ? ' is-active' : ''}" id="onglet-${echapperHtml(s.slug)}" href="#${echapperHtml(s.ancre)}">`
      + '<span class="onglet__surtitre">Spécialité</span>'
      + `<span class="onglet__nom" data-ed-lecture="${ed('specialite', { id: s.id }, 'nom')}">${echapperHtml(s.nom)}</span>`
      + magique(col, `<span class="onglet__magique" title="Le don de cette spécialité la fait considérer comme classe magique">Classe magique · +${o.amMagique} AM</span>`)
      + '</a>';
  }).join('');
  const panneaux = etage.specialites.map((col, i) => {
    const s = col.specialite;
    return `<section class="specialite${i === 0 ? ' is-active' : ''}" id="${echapperHtml(s.ancre)}" aria-labelledby="${echapperHtml(s.ancre)}-titre">`
      + `<h3 class="specialite__titre" id="${echapperHtml(s.ancre)}-titre"><span class="specialite__surtitre">Spécialité</span>`
      + `<span class="specialite__nom" data-ed="${ed('specialite', { id: s.id }, 'nom')}">${echapperHtml(s.nom)}</span>`
      + magique(col, `<span class="specialite__magique">Classe magique · +${o.amMagique} AM</span>`)
      + '</h3>'
      + (col.cartouche ? `<div class="specialite__cartouche">${htmlDeDon(col.cartouche, { ...o, cartouche: true })}</div>` : '')
      + col.choix.map((g) => (g.options.length > 1 ? htmlDeChoix(g.niveau, g.options, o) : htmlDeDon(g.options[0], o))).join('')
      + '</section>';
  }).join('');
  return '<li class="etage etage--specialites">'
    + '<div class="specialites" data-onglets role="group" aria-labelledby="specialites-regle">'
    + `<p class="specialites__tete" id="specialites-regle">${regle.badge ? '<span class="choix__badge">Au choix</span>' : ''}<span class="choix__regle">${echapperHtml(regle.texte)}</span></p>`
    + `<div class="onglets onglets--${etage.specialites.length}">${onglets}</div>`
    + panneaux
    + '</div></li>';
}

/**
 * La section « Dons » d'une classe (ClasseDons.astro) : `classe` = { dons, plateau } (lib/classe-assemblage.mjs#assemblerClasse) ; vide si la classe
 * n'a pas de don.
 */
export function htmlDesDons(classe, options = {}) {
  if (!classe.dons.length) return '';
  const o = { base: '/', typesDon: [], amMagique: null, ...options };
  const etages = classe.plateau.map((etage) => {
    if (etage.forme === 'don') return `<li class="etage etage--don"><p class="etage__repere">Don de classe · reçu sans choix</p>${htmlDeDon(etage.don, { ...o, titre: 'h3' })}</li>`;
    if (etage.forme === 'choix') return `<li class="etage etage--choix">${htmlDeChoix(etage.niveau, etage.options, { ...o, titre: 'h3' })}</li>`;
    return htmlDesSpecialitesEnOnglets(etage, o);
  }).join('');
  return '<section class="classe-section" id="dons" aria-labelledby="dons-titre">'
    + `<h2 id="dons-titre">Dons <span class="count">${classe.dons.length}</span></h2>`
    + '<p class="muted dons-aide">Disposés comme dans le classeur, du niveau 1 au niveau 20. Des dons côte à côte sur une même ligne sont un <strong>choix</strong> : un seul peut être pris.</p>'
    + `<ol class="plateau">${etages}</ol>`
    + '</section>';
}

/**
 * La section « Spécialités » d'une classe (ClassePage.astro) : un article par spécialité qui a des dons (une colonne du plateau), caché tant qu'il
 * n'a ni description ni remarque (le mode modification l'ouvre pour le remplir) ; la section entière cachée quand aucun ne s'affiche. Vide sans
 * spécialité qui ait des dons.
 */
export function htmlDesSpecialites(classe) {
  const colonnes = classe.plateau.flatMap((e) => (e.forme === 'specialites' ? e.specialites : []));
  if (!colonnes.length) return '';
  const montrees = colonnes.filter((c) => c.specialite.description.length || c.specialite.remarque.length);
  const s = (id, colonne) => ed('specialite', { id }, colonne);
  const articles = colonnes.map(({ specialite: sp }) => {
    const cache = !sp.description.length && !sp.remarque.length;
    return `<article class="classe-specialite" data-ed-cadre=".classe-prose, .classe-remarque__texte"${cache ? ' hidden' : ''}>`
      + `<h3 data-ed="${s(sp.id, 'nom')}">${echapperHtml(sp.nom)}</h3>`
      + `<div class="classe-prose" data-ed="${s(sp.id, 'description')}" data-ed-rendu="blocs">${htmlDesBlocs(sp.description)}</div>`
      + `<div class="classe-remarque" data-ed-cadre=".classe-remarque__texte"${sp.remarque.length ? '' : ' hidden'}>`
      + '<p class="classe-remarque__titre">Remarque</p>'
      + `<div class="classe-remarque__texte" data-ed="${s(sp.id, 'remarque')}" data-ed-rendu="blocs">${htmlDesBlocs(sp.remarque)}</div>`
      + '</div>'
      + `<p class="classe-specialite__lien"><a href="#${echapperHtml(sp.ancre)}">Ses dons</a></p>`
      + '</article>';
  }).join('');
  return `<section class="classe-section" id="specialites" aria-labelledby="specialites-titre" data-ed-cadre=".classe-prose, .classe-remarque__texte"${montrees.length ? '' : ' hidden'}>`
    + '<h2 id="specialites-titre">Spécialités</h2>'
    + `<div class="classe-specialites">${articles}</div>`
    + '</section>';
}

/** Les liens « Dons par spécialité » de la navigation de la page (ClassePage.astro). */
export function htmlDuGroupeDeNavigation(classe) {
  const colonnes = classe.plateau.flatMap((e) => (e.forme === 'specialites' ? e.specialites : []));
  if (!colonnes.length) return '';
  return `<span class="classe-nav__specialites" role="group" aria-label="Dons par spécialité">${colonnes
    .map((c) => `<a href="#${echapperHtml(c.specialite.ancre)}">${echapperHtml(c.cartouche?.nom ?? c.specialite.nom)}</a>`).join('')}</span>`;
}
