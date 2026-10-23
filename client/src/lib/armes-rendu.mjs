// Rendu HTML des cellules de l'onglet Armes de /ressources/equipement/ (components/armes/) : le même HTML sert à la page construite et au mode
// modification du site de dev (lib/edition-rendu.mjs : une cellule modifiée, ou tirée d'une cellule modifiée, se réaffiche depuis sa ligne de la
// base). Les colonnes Dégâts, Type de dégâts, Portée, Solidité, Effets supplémentaires et Origine sont tirées de l'effet (lib/arme-champs.mjs). Les
// valeurs dont la fiche de l'arme forgée a besoin (dé, bonus, portée, solidité, coût, prix) sont posées en attributs `data-…` sur l'élément rendu :
// le script de la page les lit au moment de la sélection (src/scripts/armes.mjs), si bien qu'une cellule réécrite après un enregistrement donne
// aussitôt les bonnes valeurs.
// Contexte (`ctx`, les mêmes listes que celles du service : serveur/edition.mjs#listes, lib/armes-db.mjs#contexteDesArmes) : competences (id,
// caracteristique_id), caracteristiques (id, nom), typesDArmes ({ valeur, libelle, de, de_regle, portee_min, portee_max }), soliditeDesArmes (2).
// Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import {
  analyserCoutDAmelioration, analyserEffetDAmelioration, analyserEffetDArme, analyserEffetDeMateriau, COMPETENCES_D_ARME, competencesDArme, coutEnRo,
  durabiliteDeLArme, LIBELLES_DES_DEGATS, MAINS, porteeDeLArme, prixEnRo,
} from './arme-champs.mjs';
import { attributEd } from './edition-modele.mjs';
import { htmlAvecMonnaies, htmlDeMontant } from './monnaies.mjs';
import { classesDeDeuxCaracteristiques } from './palette-css.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';
const attribut = (nom, valeur) => (valeur === null || valeur === undefined ? '' : ` data-${nom}="${e(valeur)}"`);
/** La première lettre en capitale (« naine » → « Naine ») : la forme, jamais le fond. */
const capitale = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * La phrase « Les armes en bleu sont les armes possibles en arme de départ » du panneau de règles de l'onglet (en gras et en bleu dans la cellule du
 * classeur ; en gras dans le Markdown du bloc : migration 0056) prend le bleu des lignes des armes de départ : son paragraphe, rendu en HTML (par remark au
 * build, par lib/chronologie-rendu.mjs#htmlDuTexte dans le navigateur du site de dev), reçoit la classe `armes__phrase-depart` (styles/armes/armes.css).
 * Rien d'autre ne change.
 */
export const avecPhraseDesArmesDeDepart = (html) =>
  String(html ?? '').replace(/<p>(<strong>Les armes en bleu [^<]*<\/strong>)<\/p>/, '<p class="armes__phrase-depart">$1</p>');

/** Le type d'arme d'après son id (« Épée »), dans la liste du contexte. */
const typeDe = (id, ctx) => (ctx.typesDArmes ?? []).find((t) => t.valeur === id) ?? null;

/** Les dés d'une règle de dé selon la Force (« D6 1-2 Force, D8 3-4 Force, D10 5 Force » → « D6/D8/D10 »). */
const desDeLaRegle = (regle) => (String(regle ?? '').match(/D\d+/g) ?? []).join('/');

/**
 * Dé de l'arme pour la page : celui de la ligne (effet, sinon type) ; sans dé (Pugilat), les dés de la règle du type, selon la Force.
 * → { de, regle (texte de la règle, sinon null) }
 */
function deAffiche(ligne, ctx = {}) {
  if (ligne.de) return { de: ligne.de, regle: null };
  const type = typeDe(ligne.type_id, ctx);
  return { de: desDeLaRegle(type?.de_regle) || '—', regle: type?.de_regle ?? null };
}

/**
 * Pastille de la compétence (décision R48) : la couleur de la caractéristique de chaque compétence (Arme Lourde et Arc : Force, Arme Légère : Agilité,
 * Arbalète : Perception), en dégradé pour deux ; la compétence et sa caractéristique en infobulle. La couleur : la classe de la première
 * caractéristique et la classe de second rang de la seconde, ou de la même (lib/palette-css.mjs#classesDeDeuxCaracteristiques ; les seconds rangs sont
 * émis par components/armes/ArmesPage.astro), jamais un style.
 */
export function htmlDeCompetence(competenceBrut, ctx = {}) {
  const comps = competencesDArme(competenceBrut);
  if (!comps.length) return competenceBrut ? `<span class="arme-comp arme-comp--texte">${e(competenceBrut)}</span>` : VIDE;
  const carac = new Map((ctx.caracteristiques ?? []).map((c) => [c.id, c.nom]));
  const couleurs = classesDeDeuxCaracteristiques(comps[0].caracteristique_id, comps[1]?.caracteristique_id).join(' ');
  const titre = comps.map((c) => `${c.nom} (${carac.get(c.caracteristique_id) ?? c.caracteristique_id})`).join(' et ');
  return `<span class="arme-comp${comps.length > 1 ? ' arme-comp--deux' : ''} ${couleurs}" data-competences="${comps.map((c) => c.id).join(' ')}" title="${e(titre)}">${e(comps.map((c) => c.libelle).join(' / '))}</span>`;
}

/**
 * Bouton du filtre par compétence (demande du propriétaire : « filtrer les armes par compétence arc / arbalète / légère et lourde » ; lib/armes-filtres.mjs) :
 * la pastille de la compétence, dans la couleur de sa caractéristique, à bascule (aria-pressed) ; la compétence et sa caractéristique en infobulle.
 */
export function htmlDuFiltreDeCompetence(id, ctx = {}) {
  const c = COMPETENCES_D_ARME[id];
  if (!c) return '';
  const carac = new Map((ctx.caracteristiques ?? []).map((x) => [x.id, x.nom])).get(c.caracteristique_id) ?? c.caracteristique_id;
  const couleurs = classesDeDeuxCaracteristiques(c.caracteristique_id).join(' ');
  return `<button type="button" class="arme-comp armes-filtre__choix ${couleurs}" data-competence="${e(id)}" aria-pressed="false" title="${e(`${c.nom} (${carac})`)}">${e(c.libelle)}</button>`;
}

/** Les types de dégâts en pastilles (Taille, Estoc, Frappe), d'après l'effet. */
function htmlDesTypesDeDegats(effet) {
  const types = analyserEffetDArme(effet).degats;
  return types.length ? types.map((t) => `<span class="arme-dgt arme-dgt--${t}">${LIBELLES_DES_DEGATS[t]}</span>`).join(' ') : VIDE;
}

/** Les effets supplémentaires, une ligne par ligne de l'effet (les modes « Une main = … » gardés). */
export function htmlDesEffets(effet) {
  const autres = analyserEffetDArme(effet).autres;
  return autres ? autres.split('\n').map((l) => `<span class="arme-effet">${e(l)}</span>`).join('') : VIDE;
}

/** Rendus nommés (attribut `data-ed-rendu`), fusionnés dans lib/edition-rendu.mjs#RENDUS : (valeur de la colonne, ligne, contexte) → HTML. */
export const RENDUS_DES_ARMES = {
  'arme-mains': (valeur) => {
    const m = MAINS.find((x) => x.valeur === valeur);
    return m ? e(m.libelle) : '';
  },
  'arme-competence': (valeur, _ligne, ctx = {}) => htmlDeCompetence(valeur, ctx),
  'arme-type': (valeur, _ligne, ctx = {}) => e(typeDe(valeur, ctx)?.libelle ?? valeur ?? ''),
  // dégâts de l'arme nue : son dé et son bonus (« D10+5 »)
  'arme-degats': (_valeur, ligne, ctx = {}) => {
    const { de, regle } = deAffiche(ligne, ctx);
    const bonus = ligne.bonus_degats ?? 0;
    const texte = bonus ? `${de}${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}` : de;
    const titre = regle ? ` title="${e(`Dé selon la Force : ${regle}`)}"` : '';
    return `<span class="arme-degats"${attribut('de', de)}${attribut('bonus', bonus)}${titre}>${e(texte)}</span>`;
  },
  'arme-types-degats': (valeur) => htmlDesTypesDeDegats(valeur),
  // portée : celle de l'effet, 1 par défaut (décision R50)
  'arme-portee': (_valeur, ligne) => `<span class="arme-portee" data-portee="${e(porteeDeLArme(ligne))}">${e(porteeDeLArme(ligne))}</span>`,
  'arme-durabilite': (_valeur, ligne, ctx = {}) => {
    const d = durabiliteDeLArme(ligne, ctx.soliditeDesArmes ?? 0);
    return `<span class="arme-durabilite" data-durabilite="${d}" title="${d} cran${d > 1 ? 's' : ''} de solidité">${d}</span>`;
  },
  'arme-effets': (valeur) => htmlDesEffets(valeur),
  'arme-origine': (_valeur, ligne) =>
    ligne.provenance ? `<span class="arme-origine" title="${e(`${ligne.provenance_mot} ${ligne.provenance}`)}">${e(capitale(ligne.provenance))}</span>` : VIDE,
  'arme-cout': (valeur) => `<span class="arme-cout"${attribut('ro', coutEnRo(valeur))}>${valeur ? htmlAvecMonnaies(valeur) : '—'}</span>`,
  'arme-depart': (valeur) => (Number(valeur) === 1 ? 'Oui' : 'Non'),
  // la remarque : une étoile à côté du nom, son texte en infobulle (lu par le script de la page pour la fiche de l'arme) ; rien sans remarque
  'arme-remarque': (valeur) =>
    (valeur ? `<span class="arme__remarque" title="${e(valeur)}" aria-label="${e(`Remarque : ${valeur}`)}">★</span>` : ''),
  // matériaux : le prix en RO seulement (« Ignore le prix en RF, il n'est plus d'actualité »), l'effet en morceaux typés (le bonus aux dégâts, les crans,
  // puis chaque autre effet) : un par ligne sur la page Composants, sur une seule ligne dans l'onglet Armes, le bonus sans le mot « Dégâts » (demande
  // du propriétaire, 2026-10-16 : « +2 / +7 | dégats doubles sur la barrière / +10 | Casse barrière » ; le mot reste pour les lecteurs d'écran)
  'materiau-prix': (valeur) => {
    const ro = prixEnRo(valeur);
    return `<span class="materiau-prix"${attribut('ro', ro)} title="${e(`Prix écrit : ${valeur ?? ''}`)}">${ro === null ? htmlAvecMonnaies(valeur ?? '—') : htmlDeMontant(String(ro), 'RO', valeur ?? '')}</span>`;
  },
  'materiau-effet': (valeur) => {
    const m = analyserEffetDeMateriau(valeur);
    const lignes = [];
    if (m.bonus_degats) lignes.push(`<span class="materiau-effet__bonus"><span class="materiau-effet__mot">Dégâts </span>${m.bonus_degats > 0 ? '+' : '−'}${Math.abs(m.bonus_degats)}</span>`);
    if (m.cran_solidite) lignes.push(`<span class="materiau-effet__cran">${m.cran_solidite > 0 ? '+' : '−'}${Math.abs(m.cran_solidite)} cran${Math.abs(m.cran_solidite) > 1 ? 's' : ''} de solidité</span>`);
    for (const l of String(m.effet_secondaire ?? '').split('\n').filter(Boolean)) lignes.push(`<span class="materiau-effet__secondaire">${e(l)}</span>`);
    return `<span class="materiau-effet"${attribut('bonus', m.bonus_degats ?? 0)}${attribut('cran', m.cran_solidite ?? 0)}>${lignes.length ? lignes.join('') : '<span class="materiau-effet__rien">Rien de particulier</span>'}</span>`;
  },
  // améliorations : coût et effet tels qu'écrits, leurs valeurs en attributs (coût cumulé et effet du niveau : lib/arme-forge.mjs)
  'amelioration-cout': (valeur) => {
    const c = analyserCoutDAmelioration(valeur);
    return `<span class="amelioration-cout"${attribut('ro', c.cout_ro ?? 0)}${attribut('materiaux', c.cout_materiaux ?? 0)}>${htmlAvecMonnaies(valeur ?? '')}</span>`;
  },
  'amelioration-effet': (valeur) => {
    const a = analyserEffetDAmelioration(valeur);
    return `<span class="amelioration-effet"${attribut('bonus', a.bonus_degats ?? 0)}${attribut('cran', a.bonus_cran ?? 0)}>${e(valeur ?? '')}</span>`;
  },
};

/** Ancre HTML d'une arme : « arme-epees-flamberge » pour « ressources/armes#arme:epees:flamberge ». */
export const ancreDArme = (id) => `arme-${String(id).slice(String(id).indexOf('#arme:') + 6).replace(/:/g, '-')}`;

/** Colonnes de la ligne d'une arme hors mode modification (Nom, Compétence, Type, Dégâts, Type de dégâts, Portée, Solidité, Origine). */
export const COLONNES_D_UNE_ARME = 8;

/**
 * Les lignes d'une arme dans le tableau de sa famille (components/armes/TableauArmes.astro, et le mode modification pour une arme créée depuis la
 * construction du site : src/scripts/edition/armes.mjs) : un seul HTML, deux `<tr>`. La première porte les colonnes ; la seconde (`arme-suite`), sous
 * elle, ses effets supplémentaires, comme l'effet d'un sort choisi sous sa ligne dans la fiche de personnage (demande du propriétaire) ; vide, elle se
 * cache (styles/armes/armes.css). Chaque champ porte son `data-ed` ; les colonnes tirées de l'effet sont en lecture (`data-ed-lecture`) ; Description,
 * Coût, Effet, Arme de départ et Remarque ne s'affichent qu'en mode modification (`ed-seul`) ; l'étoile de la remarque, à côté du nom, est en lecture
 * (refaite depuis la ligne après un enregistrement : elle part avec une remarque vidée, apparaît avec une remarque saisie). `a` : la ligne de la table arme.
 */
export function htmlDeLigneDArme(a, ctx = {}) {
  const ed = (colonne) => e(attributEd('arme', { id: a.id }, colonne));
  const rendu = (nom, colonne) => RENDUS_DES_ARMES[nom](a[colonne], a, ctx);
  const tiree = (classe, nom) => `<td class="${classe}" data-ed-lecture="${ed('effet')}" data-ed-rendu="${nom}">${rendu(nom, 'effet')}</td>`;
  const depart = Number(a.depart_possible) === 1;
  return `<tr class="arme${depart ? ' arme--depart' : ''}" id="${ancreDArme(a.id)}" data-arme="${e(a.id)}"${depart ? ' title="Arme de départ"' : ''}>`
    + '<th scope="row" class="arme__nom">'
    + `<span class="arme__libelle" data-ed="${ed('nom')}" data-ed-cible=".arme__choisir"><button type="button" class="arme__choisir" aria-pressed="false"${a.description ? ` title="${e(a.description)}"` : ''}>${e(a.nom)}</button></span>`
    + `<span class="arme__mains" data-ed="${ed('mains')}" data-ed-rendu="arme-mains">${rendu('arme-mains', 'mains')}</span>`
    + `<span class="arme__note" data-ed-lecture="${ed('remarque')}" data-ed-rendu="arme-remarque">${rendu('arme-remarque', 'remarque')}</span>`
    + '</th>'
    + `<td class="arme__competence" data-ed="${ed('competence_brut')}" data-ed-rendu="arme-competence">${rendu('arme-competence', 'competence_brut')}</td>`
    + `<td class="arme__type" data-ed="${ed('type_id')}" data-ed-rendu="arme-type">${rendu('arme-type', 'type_id')}</td>`
    + tiree('arme__degats', 'arme-degats')
    + tiree('arme__types', 'arme-types-degats')
    + tiree('arme__portee', 'arme-portee')
    + tiree('arme__durabilite', 'arme-durabilite')
    + tiree('arme__origine', 'arme-origine')
    + `<td class="arme__description ed-seul" data-ed="${ed('description')}">${e(a.description ?? '')}</td>`
    + `<td class="arme__cout ed-seul" data-ed="${ed('cout_brut')}" data-ed-rendu="arme-cout">${rendu('arme-cout', 'cout_brut')}</td>`
    + `<td class="arme__effet ed-seul" data-ed="${ed('effet')}">${e(a.effet ?? '')}</td>`
    + `<td class="arme__depart ed-seul" data-ed="${ed('depart_possible')}" data-ed-rendu="arme-depart">${rendu('arme-depart', 'depart_possible')}</td>`
    + `<td class="arme__remarque-texte ed-seul" data-ed="${ed('remarque')}">${e(a.remarque ?? '')}</td>`
    + '</tr>'
    + `<tr class="arme-suite" data-arme-suite="${e(a.id)}"><td class="arme-suite__marge"></td>`
    + `<td class="arme__effets" colspan="${COLONNES_D_UNE_ARME - 1}" data-ed-lecture="${ed('effet')}" data-ed-rendu="arme-effets">${rendu('arme-effets', 'effet')}</td></tr>`;
}

/**
 * Les deux menus à onglets de l'onglet Armes (demande du propriétaire, 2026-10-23 : « Il faudrai réduire çà en deux menus à onglet. Un pour les armes
 * de mêlée l'autre pour les armes à distances. ») : la catégorie de famille que chacun montre (arme_famille.categorie, décision R127) et son intitulé,
 * dans l'ordre de la page.
 */
export const MENUS_DES_ARMES = [
  { categorie: 'contact', titre: 'Armes de mêlée' },
  { categorie: 'distance', titre: 'Armes à distance' },
];

/**
 * Les familles de l'onglet (lib/armes-db.mjs#chargerArmes, dans l'ordre de l'onglet) rangées dans leurs menus : [{ categorie, titre, familles }], dans
 * l'ordre de MENUS_DES_ARMES, chaque menu dans l'ordre des familles, un menu sans famille omis. Une famille d'une autre catégorie (ou sans catégorie)
 * arrête le build : elle n'aurait pas de menu, et la page la perdrait sans rien dire.
 */
export function menusDesArmes(familles) {
  const sansMenu = familles.filter((f) => !MENUS_DES_ARMES.some((m) => m.categorie === f.categorie));
  if (sansMenu.length) {
    throw new Error(`familles d'armes sans menu (catégorie ni « contact » ni « distance », décision R127) : ${sansMenu.map((f) => `${f.id} (${f.categorie})`).join(', ')}`);
  }
  return MENUS_DES_ARMES.map((m) => ({ ...m, familles: familles.filter((f) => f.categorie === m.categorie) })).filter((m) => m.familles.length > 0);
}
