// Le HTML des dons et des spécialités d'une page de classe, tel que les gabarits l'écrivent (components/classes/ClasseDons.astro, ChoixDeDons.astro,
// DonCarte.astro et la section « Spécialités » de ClassePage.astro) : en mode modification sur le site de dev (D11), la page d'une classe dont des
// spécialités ou des dons ont été créés ou supprimés depuis la construction du site est redessinée depuis son état vivant (src/scripts/edition/classes.mjs),
// à partir du même assemblage que le build (lib/classe-assemblage.mjs). Mêmes champs `data-ed` que les gabarits, ancres tirées des identifiants.
// test/classe-dons-rendu.test.mjs compare ce rendu à celui des pages construites. Fonctions pures (chaînes HTML, tout texte échappé), sans navigateur.
import { nomsSeRepondent } from './classe-dons.mjs';
import { CLASSE_MAGIQUE_HORS_CATEGORIE } from './classe-magique.mjs';
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

/**
 * L'id du titre du panneau d'une spécialité : `titre-<ancre>`. Tous les panneaux ont des ids `specialite-<slug>` : un titre `<ancre>-titre` pouvait
 * être le panneau d'une autre spécialité (« LAME » et « LAME TITRE » donnaient deux `specialite-lame-titre`).
 */
export const idDuTitre = (specialite) => `titre-${specialite.ancre}`;

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
    return `<section class="specialite${i === 0 ? ' is-active' : ''}" id="${echapperHtml(s.ancre)}" aria-labelledby="${echapperHtml(idDuTitre(s))}">`
      + `<h3 class="specialite__titre" id="${echapperHtml(idDuTitre(s))}"><span class="specialite__surtitre">Spécialité</span>`
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
  const colonnes = colonnesDeSpecialites(classe);
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

/** Les colonnes du plateau : une par spécialité qui a des dons ({ specialite, cartouche, choix }). */
const colonnesDeSpecialites = (classe) => classe.plateau.flatMap((e) => (e.forme === 'specialites' ? e.specialites : []));

/** Le lien « Spécialités » de la navigation de la page (ClassePage.astro) : quand une spécialité qui a des dons a une description. */
export const lienDesSpecialites = (classe) => colonnesDeSpecialites(classe).some((c) => c.specialite.description.length > 0);

/**
 * Le repère « Classe magique » du bandeau de la page (ClassePage.astro) : `<li id="repere-magique">`, vide si la classe n'est pas magique (ou sans bonus
 * d'armure magique). Magique par sa catégorie (`amBase` : categorie_classe.am_base) ou l'Archimage : « +N AM de base » (avec la note de la catégorie
 * en infobulle) ; sinon par la spécialité dont le don dit « considérer comme classe magique » (classes raciales, Flagelleur) : « avec la spécialité … ».
 * Le mode modification le redessine quand une spécialité est créée ou supprimée (src/scripts/edition/classes.mjs).
 * @param {{ plateau: object[] }} classe assemblage (lib/classe-assemblage.mjs)
 * @param {{ classeId: string, amBase?: number | null, amMagique?: number | null, note?: string | null }} o
 */
export function htmlDuRepereMagique(classe, { classeId, amBase = null, amMagique = null, note = null }) {
  if (amMagique === null || amMagique === undefined) return '';
  const magiques = colonnesDeSpecialites(classe).filter((c) => c.cartouche?.classeMagique);
  if ((amBase !== null && amBase !== undefined) || classeId === CLASSE_MAGIQUE_HORS_CATEGORIE) {
    return `<li id="repere-magique"${note ? ` title="${echapperHtml(note)}"` : ''}><strong>Classe magique</strong> +${amMagique} AM de base</li>`;
  }
  if (!magiques.length) return '';
  const liens = magiques.map((c, i) => `${i > 0 ? ' ou ' : ''}<a href="#${echapperHtml(c.specialite.ancre)}">${echapperHtml(c.cartouche.nom)}</a>`).join('');
  return `<li id="repere-magique"><strong>Classe magique</strong> avec la spécialité ${liens} : +${amMagique} AM de base</li>`;
}

/**
 * Ce que le mode modification redessine d'une page de classe (dons, spécialités, navigation, repère « Classe magique ») tient dans une empreinte : la
 * disposition des dons (étages, ancres, niveaux, choix), les spécialités (ancre, don de spécialité, son nom, « classe magique », description présente).
 * La page construite la porte (`data-ed-structure` de ClassePage.astro) ; l'éditeur ne redessine que si celle de l'état vivant diffère : une simple
 * modification de champ (effet, remarque, type…) ne change rien ici, elle est appliquée en place, et l'onglet ouvert reste ouvert.
 * FNV-1a 32 bits du JSON de la structure (même résultat dans Node et le navigateur).
 */
export function empreinteDeStructure(classe) {
  const etages = classe.plateau.map((e) => {
    if (e.forme === 'don') return ['d', e.don.ancre, e.don.niveau];
    if (e.forme === 'choix') return ['c', e.niveau, e.options.map((d) => d.ancre)];
    return ['s', e.niveau, e.specialites.map((c) => [
      c.specialite.ancre, c.cartouche?.ancre ?? null, c.cartouche?.nom ?? null, Boolean(c.cartouche?.classeMagique), c.specialite.description.length > 0,
      c.choix.map((g) => [g.niveau, g.options.map((d) => d.ancre)]),
    ])];
  });
  const texte = JSON.stringify([classe.dons.length, etages]);
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Le mode modification redessine-t-il la page ? Oui quand l'empreinte de l'état vivant (empreinteDeStructure) diffère de celle que la page montre
 * (`construite` : son `data-ed-structure`, absent sur une page dessinée après la construction : une classe créée sur le site).
 */
export const doitRedessiner = (construite, classe) => !construite || construite !== empreinteDeStructure(classe);

/** Les liens « Dons par spécialité » de la navigation de la page (ClassePage.astro). */
export function htmlDuGroupeDeNavigation(classe) {
  const colonnes = colonnesDeSpecialites(classe);
  if (!colonnes.length) return '';
  return `<span class="classe-nav__specialites" role="group" aria-label="Dons par spécialité">${colonnes
    .map((c) => `<a href="#${echapperHtml(c.specialite.ancre)}">${echapperHtml(c.cartouche?.nom ?? c.specialite.nom)}</a>`).join('')}</span>`;
}
