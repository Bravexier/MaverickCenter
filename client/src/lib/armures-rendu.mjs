// Rendu HTML des cellules des pages Armures et Boucliers (/ressources/armures/, /ressources/bouclier/) (components/armures/) : le même HTML sert à la page construite
// et au mode modification du site de dev (lib/edition-rendu.mjs : une cellule modifiée se réaffiche depuis sa ligne de la base). Les valeurs dont la
// fiche de l'armure ou du bouclier forgé a besoin (AP, AM, solidité, prix, coût et effet d'une amélioration) sont posées en attributs `data-…` sur
// l'élément rendu : le script de la page les lit au moment de la sélection (src/scripts/armures.mjs), si bien qu'une cellule réécrite après un
// enregistrement donne aussitôt les bonnes valeurs.
// Contexte de la page construite (`ctx`, lib/armures-db.mjs#contexteDesArmures) : materiauxDeProtection ([{ id, nom, type }] : la case « Matériaux »
// d'une armure, sans `data-ed` : l'éditeur ne la réécrit pas, le service n'a donc pas cette liste).
// Fonctions pures, chaîne HTML en sortie, tout texte échappé.
import { analyserAmeliorationDeProtection, coutDeLaPiece, degatsDeLArmure, nombreEcrit } from './armure-champs.mjs';
import { attributEd } from './edition-modele.mjs';
import { htmlAvecMonnaies, htmlDeMontant } from './monnaies.mjs';
import { cleDeMateriau } from './materiaux-couleurs.mjs';
import { RENDUS_DES_ARMES } from './armes-rendu.mjs';
import { classeDuPoids, classeDuTypeDArmure } from './palette-css.mjs';

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (texte) => String(texte ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);
const VIDE = '<span class="vide" aria-label="aucun">—</span>';
const attribut = (nom, valeur) => (valeur === null || valeur === undefined ? '' : ` data-${nom}="${e(valeur)}"`);

// Les couleurs des types d'armure (et de matière) et des poids de bouclier sont dans lib/equipement-couleurs.mjs (la règle) ; ce rendu ne pose que leur
// classe (lib/palette-css.mjs : classeDuTypeDArmure, classeDuPoids ; familles `armure` et `poids`, émises par components/armures/ArmuresPage.astro),
// jamais une couleur ni un style : le même HTML pour la page construite et le mode modification (choix du propriétaire, « Module JS → classe »).

/** Libellés des types de dégâts (comme ceux des armes). */
const LIBELLES_DES_DEGATS = { taille: 'Taille', estoc: 'Estoc', frappe: 'Frappe' };

/** Un prix écrit en RO (les prix de la grille, des boucliers et des formes : décision R79) : décomposé en monnaies (R63), sa valeur en `data-ro`. */
function htmlDuPrix(valeur) {
  const n = nombreEcrit(valeur);
  if (n === null) {
    const texte = String(valeur ?? '').trim();
    return `<span class="pprix"${texte ? ` title="${e(`Prix écrit : ${texte}`)}"` : ''}>${texte ? e(texte) : VIDE}</span>`;
  }
  return `<span class="pprix" data-ro="${n}">${htmlDeMontant(String(valeur).trim(), 'RO', String(valeur).trim())}</span>`;
}

/** Un nombre lu dans une colonne entière (AP, AM, coût…) : le nombre, ou null pour une case vide. */
const entierOuNul = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** La pastille de l'armure physique (`quoi` = 'ap') ou magique ('am') : « +10 AP » ; '' sans valeur. */
function pastilleDeDefense(n, quoi) {
  if (n === null) return '';
  return `<span class="pdef__${quoi}" title="${quoi === 'ap' ? 'Armure physique' : 'Armure magique'}">${n >= 0 ? '+' : '−'}${Math.abs(n)}&#8239;${quoi.toUpperCase()}</span>`;
}

/**
 * L'AP et l'AM d'une matière (`materiau_armure`, `materiau_bouclier` : leurs colonnes `ap` et `am`) en pastilles dans une seule case « Défense », leurs
 * valeurs en `data-ap` et `data-am` (0 quand elles sont vides) ; « Aucune » quand les deux le sont.
 */
export function htmlDeLaDefense(apBrut, amBrut) {
  const [ap, am] = [entierOuNul(apBrut), entierOuNul(amBrut)];
  const parts = [pastilleDeDefense(ap, 'ap'), pastilleDeDefense(am, 'am')].filter(Boolean);
  const contenu = parts.length ? parts.join(' ') : '<span class="pdef__aucune">Aucune</span>';
  return `<span class="pdef" data-ap="${ap ?? 0}" data-am="${am ?? 0}">${contenu}</span>`;
}

/**
 * L'armure physique (`quoi` = 'ap') ou magique ('am') d'une armure ou d'un bouclier, chacune dans sa colonne et sa case modifiable (« Sépare donc les AP
 * des AM », demande du propriétaire, 2026-10-16 ; « C'est en base que les deux devraient être séparées et donc éditable aussi », 2026-10-17) : la
 * pastille, ou « — » pour une case vide ; sa valeur en `data-ap` ou `data-am` (0 quand elle est vide), que le script de la page lit dans chaque case.
 */
function htmlDUneDefense(valeur, quoi) {
  const n = entierOuNul(valeur);
  return `<span class="pdef" data-${quoi}="${n ?? 0}">${pastilleDeDefense(n, quoi) || VIDE}</span>`;
}

/**
 * Le poids d'un bouclier en pastille, dans la couleur de son poids, « Requiert N Force minimum » en infobulle (demande du propriétaire, 2026-10-16 :
 * « Pas besoin de tableau pour l'expliquer un simple tooltip au dessus du nom du poids pour dire "Requiert X Force minimum" suffit ») ; sa Force
 * minimum en `data-force` (le tri de la liste, la fiche). `p` : la ligne de bouclier_poids ({ id, nom, force_min }) ; null : « — ».
 */
export function htmlDuPoids(p) {
  if (!p) return VIDE;
  const force = p.force_min === null || p.force_min === undefined ? null : Number(p.force_min);
  return `<span class="ppoids ${classeDuPoids(p.id)}" data-poids="${e(p.id)}"${attribut('force', force)}`
    + `${force === null ? '' : ` title="${e(`Requiert ${force} Force minimum`)}"`}>${e(p.nom)}</span>`;
}

/** Les résistances ou faiblesses d'une armure (« x2 Frappe », « Estoc/Taille ») en pastilles, « ×2 » compris. */
export function htmlDesDegats(valeur, sens) {
  const lignes = sens === 'faiblesse' ? degatsDeLArmure(null, valeur) : degatsDeLArmure(valeur, null);
  if (!lignes.length) return String(valeur ?? '').trim() ? `<span class="pdgt-texte">${e(valeur)}</span>` : VIDE;
  return lignes
    .map((l) => `<span class="pdgt pdgt--${l.type_degats}"${l.multiplicateur ? ` title="${e(`${LIBELLES_DES_DEGATS[l.type_degats]} ×${l.multiplicateur} (« x${l.multiplicateur} » de la source)`)}"` : ''}>${l.multiplicateur ? `<b>×${l.multiplicateur}</b> ` : ''}${LIBELLES_DES_DEGATS[l.type_degats]}</span>`)
    .join(' ');
}

/** La pastille d'un matériau dans la couleur de son type (sa classe ; nom et type en infobulle). */
export function htmlDeMateriau(nom, type) {
  return `<span class="pmat-pastille ${classeDuTypeDArmure(type)}" title="${e(`${nom} (${type ?? 'Autres'})`)}">${e(nom)}</span>`;
}

/** Ancre HTML d'une armure : « armure-armure-cuir-peau » pour « ressources/armures#armure:armure-cuir-peau ». */
export const ancreDArmure = (id) => `armure-${String(id).slice(String(id).lastIndexOf(':') + 1)}`;
/** Ancre HTML d'un bouclier : « bouclier-targe-fer » pour « ressources/bouclier#bouclier:targe:fer ». */
export const ancreDeBouclier = (id) => `bouclier-${String(id).slice(String(id).indexOf('#bouclier:') + 10).replace(/:/g, '-')}`;

/** L'infobulle du prix calculé d'une combinaison (décision R93) : « Fabrication de l'armure complète + 6 Cuir + 6 Peau » (12 pour un seul matériau). */
function titreDuPrix(a, ctx = {}) {
  const connus = new Map((ctx.materiauxDeProtection ?? []).map((m) => [m.id, m.nom]));
  const noms = [a.materiau_ligne_id, a.materiau_colonne_id].map((id) => connus.get(id) ?? id);
  const unites = noms[0] === noms[1] ? `12 ${noms[0]}` : `6 ${noms[0]} + 6 ${noms[1]}`;
  return `Fabrication de l’armure complète + ${unites}, matériaux achetés (décision R93)`;
}

/** Les deux matières d'une combinaison (ligne de la grille, puis colonne), dans la couleur de leur type (ctx.materiauxDeProtection). */
function htmlDesMateriauxDeLArmure(a, ctx = {}) {
  const ids = [a.materiau_ligne_id, a.materiau_colonne_id].filter(Boolean);
  if (!ids.length) return VIDE;
  const connus = new Map((ctx.materiauxDeProtection ?? []).map((m) => [m.id, m]));
  return ids.map((id) => htmlDeMateriau(connus.get(id)?.nom ?? cleDeMateriau(id), connus.get(id)?.type)).join('<span class="pmat-plus">+</span>');
}

/** Rendus nommés (attribut `data-ed-rendu`), fusionnés dans lib/edition-rendu.mjs#RENDUS : (valeur de la colonne, ligne, contexte) → HTML. */
export const RENDUS_DES_ARMURES = {
  // l'AP et l'AM d'une armure ou d'un bouclier (colonnes `ap`, `am`, chacune modifiable dans sa case)
  'protection-ap': (valeur) => htmlDUneDefense(valeur, 'ap'),
  'protection-am': (valeur) => htmlDUneDefense(valeur, 'am'),
  // le poids d'un bouclier (bouclier.poids_id) : sa ligne dans ctx.poidsDeBouclier (lib/armures-db.mjs#poidsDeBouclier, liste du service) ; un
  // identifiant que la liste n'a pas s'affiche tel quel, sans Force
  'bouclier-poids': (valeur, _ligne, ctx = {}) =>
    (valeur ? htmlDuPoids((ctx.poidsDeBouclier ?? []).find((p) => p.id === valeur) ?? { id: valeur, nom: valeur, force_min: null }) : VIDE),
  'protection-prix': (valeur) => htmlDuPrix(valeur),
  'armure-type': (valeur) => (valeur ? `<span class="ptype ${classeDuTypeDArmure(valeur)}">${e(valeur)}</span>` : VIDE),
  // solidité ; « uni » pour une armure particulière (« Solidité uni : N » ; « Cran de solidité uni = Si un cran de solidité est perdu, c'est TOUTE l'armure
  // qui est abimée. »)
  'armure-solidite': (valeur, ligne = {}) => {
    const n = Number(valeur ?? 0);
    const uni = Number(ligne.solidite_uni) === 1
      ? ' <span class="psol__uni" title="Cran de solidité uni : si un cran de solidité est perdu, c’est toute l’armure qui est abîmée">uni</span>' : '';
    return `<span class="psol" data-solidite="${n}">${n}${uni}</span>`;
  },
  'armure-resistance': (valeur) => htmlDesDegats(valeur, 'resistance'),
  'armure-faiblesse': (valeur) => htmlDesDegats(valeur, 'faiblesse'),
  'armure-effet': (valeur) => (String(valeur ?? '').trim() ? `<span class="armure-effet">${e(valeur)}</span>` : VIDE),
  // un coût du tableau FABRICATION de l'onglet (« Armure Complète », compté dans le prix des armures de la grille : décision R93 ; « Bouclier »,
  // « 250 RF / Classe », sous les formes de l'onglet Boucliers) : tel qu'écrit, en RO dans `data-ro` (null pour « 250 RF / Classe »)
  'piece-cout': (valeur) => {
    const rf = coutDeLaPiece(valeur);
    return `<span class="pcout"${attribut('ro', rf === null ? null : rf / 100)}>${htmlAvecMonnaies(valeur ?? '')}</span>`;
  },
  // améliorations : coût et effet tels qu'écrits (en-tête « Coût(RO) »), leurs valeurs en attributs (lib/armure-forge.mjs)
  'protection-amelioration-cout': (valeur, ligne = {}) => {
    const a = analyserAmeliorationDeProtection(ligne.cible, valeur, ligne.effet_brut);
    return `<span class="pamel-cout"${attribut('ro', a.cout_ro ?? 0)}${attribut('materiaux', a.cout_materiaux ?? 0)}>${htmlAvecMonnaies(valeur ?? '', { unite: 'RO' })}</span>`;
  },
  'protection-amelioration-effet': (valeur, ligne = {}) => {
    const a = analyserAmeliorationDeProtection(ligne.cible, ligne.cout_brut, valeur);
    return `<span class="pamel-effet"${attribut('ap', a.bonus_ap ?? 0)}${attribut('am', a.bonus_am ?? 0)}${attribut('cran', a.bonus_cran ?? 0)}${attribut('materiaux', a.cout_materiaux ?? 0)}>${e(valeur ?? '')}</span>`;
  },
  // améliorations de bouclier : quatre cases (demande du propriétaire, 2026-10-17), chacune sa valeur en attribut (lib/armure-forge.mjs, R76) ; le coût
  // et l'effet écrits en sont refaits par le service, la page ne les montre plus
  'bouclier-amelioration-ro': (valeur) => {
    const n = entierOuNul(valeur);
    return `<span class="pamel-cout" data-ro="${n ?? 0}">${n === null ? VIDE : htmlDeMontant(String(n), 'RO', `${n} RO`)}</span>`;
  },
  'bouclier-amelioration-materiaux': (valeur) => {
    const n = entierOuNul(valeur);
    return `<span class="pamel-materiaux" data-materiaux="${n ?? 0}"${n ? ' title="Une unité de la matière du bouclier (décision R76)"' : ''}>${n ? `+${n}&#8239;matériau${n > 1 ? 'x' : ''}` : VIDE}</span>`;
  },
  'bouclier-amelioration-ap': (valeur) => {
    const n = entierOuNul(valeur);
    return `<span class="pamel-ap" data-ap="${n ?? 0}">${pastilleDeDefense(n, 'ap') || VIDE}</span>`;
  },
  'bouclier-amelioration-cran': (valeur) => {
    const n = entierOuNul(valeur);
    return `<span class="pamel-cran" data-cran="${n ?? 0}"${n ? ' title="Les crans de solidité se cumulent (décision R76)"' : ''}>${n ? `+${n}&#8239;cran${n > 1 ? 's' : ''}` : VIDE}</span>`;
  },
};

const ed = (table, cle, colonne) => e(attributEd(table, cle, colonne));
const rendu = (nom, valeur, ligne, ctx) => RENDUS_DES_ARMURES[nom](valeur, ligne, ctx);

/** Le prix de 6 unités d'un matériau (pour une armure, décision R93), en RO décomposés (R63), sa valeur en `data-ro` ; « — » sans prix. */
export function htmlDuPrixPourUneArmure(ro) {
  if (ro === null || ro === undefined) return `<span class="pprix">${VIDE}</span>`;
  return `<span class="pprix" data-ro="${ro}">${htmlDeMontant(String(ro).replace('.', ','), 'RO', `${String(ro).replace('.', ',')} RO`)}</span>`;
}

/**
 * La ligne d'un matériau dans un tableau de sélection (`role` : 'm1' ou 'm2' pour les deux matières d'une armure, 'matiere' pour un bouclier) : la
 * matière (bouton, dans la couleur de son type, description en infobulle), sa défense, sa solidité et son prix (celui de la ressource : décision R62).
 * Les champs du matériau sont en lecture (la page « Composants » en est la seule source : R62) ; ses stats d'armure ou de bouclier ne se modifient pas.
 * Le prix est le rendu « materiau-prix » de la page des armes (lib/armes-rendu.mjs : le prix en RO seulement, sa valeur en `data-ro`). Pour une matière
 * d'armure (`role` 'm1' ou 'm2'), une case de plus : le prix pour une armure, les 6 unités du matériau qu'elle demande (décision R93 ; demande du
 * propriétaire, 2026-10-16 : « pour les tableaux des matériaux il faudra rajouter le total pour une armure (le X6) ») : `m.prix_armure`
 * (lib/armures-db.mjs), sa valeur en `data-ro`, refaite par le script de la page quand le prix du matériau change (src/scripts/armures.mjs).
 * `m` : { ligne (materiau_armure ou materiau_bouclier), cle, nom, type, prix, prix_armure, description }.
 */
export function htmlDeLigneDeMateriau(m, role) {
  const id = m.ligne.ressource_id;
  return `<tr class="pmat" data-materiau="${e(m.cle)}" data-type="${e(m.type)}">`
    + `<th scope="row" class="pmat__nom ${classeDuTypeDArmure(m.type)}"><span data-ed-lecture="${ed('ressource', { id }, 'nom')}" data-ed-cible=".pmat__choisir">`
    + `<button type="button" class="pmat__choisir" data-role="${e(role)}" aria-pressed="false"${m.description ? ` title="${e(m.description)}"` : ''}>${e(m.nom)}</button></span></th>`
    + `<td class="pmat__defense">${htmlDeLaDefense(m.ligne.ap, m.ligne.am)}</td>`
    + `<td class="pmat__solidite"><span class="psol" data-solidite="${Number(m.ligne.solidite ?? 0)}">${Number(m.ligne.solidite ?? 0)}</span></td>`
    + `<td class="pmat__prix" data-ed-lecture="${ed('ressource', { id }, 'prix_brut')}" data-ed-rendu="materiau-prix">${RENDUS_DES_ARMES['materiau-prix'](m.prix)}</td>`
    + (role === 'm1' || role === 'm2' ? `<td class="pmat__prix-armure" data-prix-armure>${htmlDuPrixPourUneArmure(m.prix_armure)}</td>` : '')
    + '</tr>';
}

/**
 * La ligne d'une armure de la liste (une combinaison de deux matières, ou une armure particulière) : son nom (bouton : sélectionner l'armure), ses
 * matières, son type, sa défense, sa solidité, ses résistances et faiblesses (ou son effet) et son prix ; chaque champ porte son `data-ed`, sauf le
 * prix d'une combinaison : il est calculé, la fabrication de l'armure complète + 6 unités de chaque matériau (décision R93 : `a.prix_calcule`, le prix
 * écrit dans la grille n'est plus lu), et le script de la page le refait quand un prix de matériau ou la fabrication change (src/scripts/armures.mjs).
 * `a` : la ligne de la table armure (avec `m1`, `m2`, `prix_calcule` pour une combinaison : lib/armures-db.mjs).
 */
export function htmlDeLigneDArmure(a, ctx = {}) {
  const cle = { id: a.id };
  const champ = (classe, colonne, nom) => `<td class="${classe}" data-ed="${ed('armure', cle, colonne)}" data-ed-rendu="${nom}">${rendu(nom, a[colonne], a, ctx)}</td>`;
  const particuliere = a.sorte === 'particuliere';
  return `<tr class="armure${particuliere ? ' armure--particuliere' : ''}" id="${ancreDArmure(a.id)}" data-armure="${e(a.id)}"${particuliere ? ' data-particuliere="1"' : `${attribut('m1', a.m1)}${attribut('m2', a.m2)}`}>`
    + `<th scope="row" class="armure__nom"><span data-ed="${ed('armure', cle, 'nom')}" data-ed-cible=".armure__choisir"><button type="button" class="armure__choisir" aria-pressed="false">${e(a.nom)}</button></span>`
    + (a.remarque ? `<span class="armure__remarque" title="${e(a.remarque)}" aria-label="${e(`Remarque : ${a.remarque}`)}">★</span>` : '')
    + '</th>'
    + (particuliere ? '' : `<td class="armure__materiaux">${htmlDesMateriauxDeLArmure(a, ctx)}</td>`)
    + champ('armure__type', 'type', 'armure-type')
    // AP et AM en deux colonnes (demande du propriétaire, 2026-10-16 : « Pour les tableaux des armures j'aimerai séparer les colonnes d'AP et d'AM »),
    // comme la liste des boucliers, chacune modifiable dans sa case (2026-10-17 : « C'est en base que les deux devraient être séparées et donc éditable
    // aussi ») ; la défense écrite (stats_brut) en est refaite par le service
    + champ('armure__ap', 'ap', 'protection-ap')
    + champ('armure__am', 'am', 'protection-am')
    + champ('armure__solidite', 'solidite', 'armure-solidite')
    + (particuliere
      ? champ('armure__effet', 'effet', 'armure-effet')
      : champ('armure__resistance', 'resistance_brut', 'armure-resistance') + champ('armure__faiblesse', 'faiblesse_brut', 'armure-faiblesse'))
    + (particuliere
      ? champ('armure__prix', 'prix_brut', 'protection-prix')
      : `<td class="armure__prix" data-prix-calcule title="${e(titreDuPrix(a, ctx))}">${htmlDuPrix(a.prix_calcule === null || a.prix_calcule === undefined ? '' : String(a.prix_calcule).replace('.', ','))}</td>`)
    + '</tr>';
}

/** La ligne d'une amélioration d'armure (+1 à +5) : le niveau (bouton : choisir l'amélioration), le coût et l'effet écrits. */
export function htmlDeLigneDAmelioration(a) {
  const cle = { id: a.id };
  return `<tr class="pamelioration" data-cible="${e(a.cible)}" data-niveau="${a.niveau}">`
    + `<th scope="row" class="pamelioration__niveau"><button type="button" class="pamelioration__choisir" aria-pressed="false">+${a.niveau}</button></th>`
    + `<td class="pamelioration__cout" data-ed="${ed('amelioration_equipement', cle, 'cout_brut')}" data-ed-rendu="protection-amelioration-cout">${rendu('protection-amelioration-cout', a.cout_brut, a)}</td>`
    + `<td class="pamelioration__effet" data-ed="${ed('amelioration_equipement', cle, 'effet_brut')}" data-ed-rendu="protection-amelioration-effet">${rendu('protection-amelioration-effet', a.effet_brut, a)}</td>`
    + '</tr>';
}

/**
 * La ligne d'une amélioration de bouclier (+1 à +5) : le niveau (bouton : choisir l'amélioration), puis ses quatre cases, chacune modifiable (demande du
 * propriétaire, 2026-10-17 : « Le +1matériaux devrai être dans le cout (une 2e collonne cout matériaux boolean) Les effet séparés en deux autres colones
 * aussi, Valeur d'AP supplémentaire, et Solidité + 1 ou non ») : le coût en RO, le coût en matériaux (1 matériau de la matière du bouclier : R76), l'AP
 * supplémentaire, le cran de solidité.
 */
export function htmlDeLigneDAmeliorationDeBouclier(a) {
  const cle = { id: a.id };
  const champ = (classe, colonne, nom) => `<td class="${classe}" data-ed="${ed('amelioration_equipement', cle, colonne)}" data-ed-rendu="${nom}">${rendu(nom, a[colonne], a)}</td>`;
  return `<tr class="pamelioration" data-cible="${e(a.cible)}" data-niveau="${a.niveau}">`
    + `<th scope="row" class="pamelioration__niveau"><button type="button" class="pamelioration__choisir" aria-pressed="false">+${a.niveau}</button></th>`
    + champ('pamelioration__cout', 'cout_ro', 'bouclier-amelioration-ro')
    + champ('pamelioration__materiaux', 'cout_materiaux', 'bouclier-amelioration-materiaux')
    + champ('pamelioration__ap', 'bonus_ap', 'bouclier-amelioration-ap')
    + champ('pamelioration__cran', 'bonus_cran', 'bouclier-amelioration-cran')
    + '</tr>';
}

/** La ligne d'une forme (classe) de bouclier : son nom (bouton : choisir la forme), sa classe (« Classe 4 » : 4 matériaux) et son prix. */
export function htmlDeLigneDeForme(f) {
  const cle = { id: f.id };
  return `<tr class="forme" data-forme="${e(f.id)}" data-classe="${f.classe}">`
    + `<th scope="row" class="forme__nom"><span data-ed="${ed('bouclier_classe', cle, 'nom')}" data-ed-cible=".forme__choisir"><button type="button" class="forme__choisir" aria-pressed="false">${e(f.nom)}</button></span></th>`
    + `<td class="forme__classe">${e(f.categorie_brut)}</td>`
    + `<td class="forme__prix" data-ed="${ed('bouclier_classe', cle, 'prix_brut')}" data-ed-rendu="protection-prix">${rendu('protection-prix', f.prix_brut, f)}</td>`
    + '</tr>';
}

/**
 * La ligne d'un bouclier préfabriqué de la liste (un seul tableau, triable : demande du propriétaire, 2026-10-16) : son nom (bouton : choisir ce
 * bouclier), sa forme (nom en lecture, suit son renommage ; « Classe N »), sa matière, son AP et son AM (deux colonnes : « Sépare donc les AP des AM » ;
 * chacune modifiable dans sa case, 2026-10-17 ; la défense écrite en est refaite), sa solidité (celle de la matière : décision R78), son poids (la
 * couleur de sa case dans l'onglet : décision R92) et son prix. `b` : la ligne de la table bouclier (avec `matiere`, la clé de sa matière) ; `matiere` :
 * la matière ({ nom, type, ligne }) ; `forme` : la ligne de bouclier_classe ; `ordre` : le rang de la ligne dans l'onglet (`data-ordre`, l'ordre sans
 * tri) ; `ctx` : le contexte des rendus (ctx.poidsDeBouclier : lib/armures-db.mjs#contexteDesArmures), comme pour une armure.
 */
export function htmlDeLigneDeBouclier(b, matiere, { forme = null, ordre = null } = {}, ctx = {}) {
  const cle = { id: b.id };
  const ancre = ancreDeBouclier(b.id);
  const solidite = Number(matiere?.ligne?.solidite ?? 0);
  return `<tr class="bouclier" id="${ancre}" data-bouclier="${e(b.id)}" data-forme="${e(b.classe_id)}" data-matiere="${e(b.matiere)}"${attribut('ordre', ordre)}>`
    + `<th scope="row" class="bouclier__nom"><span data-ed="${ed('bouclier', cle, 'nom')}" data-ed-cible=".bouclier__choisir"><button type="button" class="bouclier__choisir" aria-pressed="false">${e(b.nom)}</button></span>`
    + (b.remarque ? `<span class="armure__remarque" title="${e(b.remarque)}" aria-label="${e(`Remarque : ${b.remarque}`)}">★</span>` : '')
    + '</th>'
    + `<td class="bouclier__forme"${attribut('classe', forme?.classe)}>${forme
      ? `<span data-ed-lecture="${ed('bouclier_classe', { id: forme.id }, 'nom')}">${e(forme.nom)}</span> <span class="bouclier__classe">${e(forme.categorie_brut)}</span>`
      : VIDE}</td>`
    + `<td class="bouclier__matiere">${matiere ? htmlDeMateriau(matiere.nom, matiere.type) : VIDE}</td>`
    + `<td class="bouclier__ap" data-ed="${ed('bouclier', cle, 'ap')}" data-ed-rendu="protection-ap">${rendu('protection-ap', b.ap, b)}</td>`
    + `<td class="bouclier__am" data-ed="${ed('bouclier', cle, 'am')}" data-ed-rendu="protection-am">${rendu('protection-am', b.am, b)}</td>`
    + `<td class="bouclier__solidite"><span class="psol" data-solidite="${solidite}" title="Solidité de la matière (décision R78)">${solidite}</span></td>`
    + `<td class="bouclier__poids" data-ed="${ed('bouclier', cle, 'poids_id')}" data-ed-rendu="bouclier-poids">${rendu('bouclier-poids', b.poids_id, b, ctx)}</td>`
    + `<td class="bouclier__prix" data-ed="${ed('bouclier', cle, 'prix_brut')}" data-ed-rendu="protection-prix">${rendu('protection-prix', b.prix_brut, b)}</td>`
    + '</tr>';
}
