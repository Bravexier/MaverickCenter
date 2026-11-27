// Extension de l'éditeur : le glossaire des mots-clés sur /regles/glossaire/ (pages/regles/glossaire.astro ; réponses du propriétaire du 2026-11-06, Q6
// et Q7 : toute la gestion du vocabulaire, jusque-là sur /recherche/, est sur le Glossaire, plus l'adresse et la couleur) — demandes du propriétaire :
// « en mode édition seulement », « supprimer / ajouter / Modifier des mots clés » ; puis (2026-10-16, migration 0056) « Le mot-clé aura son ID, son
// texte et une description » ; depuis les migrations 0113 à 0115 (décisions R232, R233, R234 : réponse T6, « l'édition dans la ligne » du tableau), ses
// catégories et ses synonymes, et la gestion des catégories elles-mêmes.
//   - au chargement (surcouche) : le tableau relu dans la base vivante (GET /api/edition/mots-cles/ : le site construit est en retard sur le site de dev),
//     définitions, bulles et feuille des couleurs comprises (mots-cles-vivants.mjs suit le vocabulaire relu et réécrit la feuille avec `css`) ;
//   - au crayon (debut) : le tableau de gestion, une ligne (un <tbody>) par mot-clé, dans les colonnes du tableau — ses noms : la balise à copier
//     (« {{clé}} »), son libellé (mot_cle.libelle ; décision R195 : modifiable pour tout mot-clé) et ses synonymes (R233 : une liste
//     ordonnée, une écriture par ligne), précédés de son icône (R235 : un choix dans la liste des icônes du
//     site, en première colonne) ; son type (R232 (5), R309 : une case à cocher par catégorie, exclusives — en cocher une décoche les autres, on peut tout
//     décocher ; un mot-clé qui en a encore plusieurs avant le premier lot d'ancrage les montre toutes cochées ; aussi pour un mot-clé verrouillé, R232 (11)) ; son adresse (mot_cle.url, migration 0098 : une balise de ce mot-clé est un lien vers elle ;
//     vidée, NULL) ; le menu déroulant des endroits qui le mentionnent (décision R196 (2), `mentions` du service : lib/mentions-des-mots-cles.mjs) et ses
//     outils, « Fusionner dans… » et « Supprimer » (mis en file, envoyés avec « Enregistrer » ; « Supprimer » seulement quand rien ne le mentionne,
//     R196) ; un mot-clé mentionné, à la place de « Supprimer », « Forcer la suppression » (décision R223 : mis en file comme les autres, confirmé avec ce
//     qu'il remplace), sauf quand le service prévoit de refuser le forçage (`refus_du_forcage`) : une note « Suppression forcée impossible » dit pourquoi
//     (en infobulle, et au bas du menu des mentions) ; puis, dans la ligne de dessous, sa couleur (mot_cle.couleur : la liste des couleurs du site,
//     groupées par famille, et le cercle d'une autre couleur, editeur.mjs#controleDeCouleur ; réponses Q3, Q4) et sa définition (mot_cle.description) ;
//     un mot-clé verrouillé (mot_cle.verrou = 1, migration 0110 ; décisions R218, R219 (7)) a son cadenas, la raison en infobulle, ni « Supprimer » ni
//     « Fusionner dans… » ; tous ses champs restent modifiables (demande du propriétaire : « Seule leur suppression est bloquée. »), il reste une
//     cible de fusion et garde son menu des mentions ; au-dessus du tableau, « + Ajouter un mot-clé » (la notion et sa page des Règles, créées tout de suite
//     d'un même geste, docs/chantier-pages-de-notion.md, §4 : son nom, son type et sa définition, CHAMPS_D_UNE_NOTION ; relu, il est ancré à sa page, sa
//     ligne en lecture seule avec « Ouvrir ») et la gestion des catégories (R232 (5) : chacune
//     renommable, « Supprimer » pour une catégorie vide, mis en file ; « + Ajouter une catégorie », créée tout de suite) ; ce que le service refuse (400 :
//     synonyme, adresse ou couleur mal écrite ; 409 : homonyme sans catégorie distinctive, clé ou synonyme déjà pris, suppression d'un mot-clé verrouillé, mot-clé
//     mentionné, refus du forçage, catégorie non vide ; `champ`) l'est comme tout refus du lot ; un mot-clé **ancré** (`element`, R309 : relié à une page, un
//     sort, un type de sort, une magie, une monnaie ou un type de dégâts) est en lecture seule — ni saisie, ni case, ni « Supprimer », « Forcer la suppression »
//     ou « Fusionner dans… » —, il garde sa balise à copier et le menu de ses mentions, et reste une cible de fusion ; le formulaire de création n'offre qu'un
//     type, exclusif, « Notion » présélectionné quand cette catégorie existe ;
//   - à l'enregistrement (verifier) : ce que le service ne pourrait pas jouer est refusé avant toute question (noms échangés en boucle, mot-clé qui reçoit
//     une fusion et serait supprimé) ; un renommage vers l'écriture d'un mot-clé gardé, sans catégorie qui les distingue (R232 (9)), propose la fusion ;
//     suppressions et fusions sont confirmées une fois ; (operations) l'ordre du lot que le service accepte (lib/mots-cles-edition.mjs#operationsDuVocabulaire :
//     fusions, suppressions, catégories des mots-clés avant les renommages, synonymes, catégories supprimées) ;
//   - en sortant (fin, après un enregistrement aussi) : le tableau relu dans la base vivante.
// Hors du mode modification, rien ne montre le verrou (R219 (7)).
// La page (src/scripts/glossaire.mjs : les filtres et la pagination) relit le tableau à l'évènement « glossaire:mots-cles » (detail.gestion : le tableau de
// gestion est affiché ; detail.categories : les catégories des mots-clés, [{ id, libelle }], pour la liste du filtre ; detail.voir : l'id d'un mot-clé créé,
// dont la page de la pagination s'affiche) ; chaque mot-clé y est un <tbody data-id
// data-cle data-n data-libelle data-synonymes data-categories data-definition data-url data-couleur> (absents sans valeur), la ligne de lecture le HTML de
// la page construite (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire), dont les balises de la définition sont rendues par mots-cles-vivants.mjs dès
// qu'elle est posée. Le titre de la page où mène l'adresse d'un mot-clé (la colonne Lien, R234 (2)) : `titre_du_lien` du service (null : l'adresse
// brute). Les catégories des événements de la chronologie
// se gèrent sur /chronologie/.
import { attributEd, cleDeLigne, ENTITES } from '../../lib/edition-modele.mjs';
import { aUnElement, estVerrouille } from '../../lib/mots-cles.mjs';
import {
  ceQueRemplaceLeForcage, CHAMPS_D_UNE_NOTION, cibleSaisie, ciblesDeFusion, compteDesElements, confirmationDesRetraits, decocherLesAutres, ecrituresDesCibles, endroitsDesMentions,
  erreurDesRetraits, examinerLesRenommages, forcageOffert, fusionOfferte, INFOBULLE_DU_VERROU, noteDeLAncrage, operationsDesListes, operationsDuVocabulaire,
  raisonSansForcage, suppressionDeCategorieOfferte, suppressionOfferte, synonymesSaisis, typeParDefaut,
} from '../../lib/mots-cles-edition.mjs';
import {
  adresseDuMotCle, COLONNES_DU_GLOSSAIRE, definitionDuMotCle, htmlDeLaLigneDuGlossaire, htmlDeLIcone, libellesDesCategories,
} from '../../lib/mots-cles-balises.mjs';
import { cheminDePage } from '../../lib/metiers.mjs';
import { definirLeVocabulaire } from './mots-cles-vivants.mjs';

// [{ id, libelle, cle, description, url, couleur, pages, verrou, monnaie_id, synonymes, categories, mentions, … }] de la base vivante ; null : pas lu
let vocabulaire = null;
let categories = []; // [{ id, libelle, libelle_cle, mots_cles }] : les catégories des mots-clés (GET /api/edition/mots-cles/)
const suppressions = new Set();
const forcages = new Set(); // suppressions forcées (« Forcer la suppression », décision R223)
const fusions = new Map(); // source → cible (« Fusionner dans… »)
const categoriesSupprimees = new Set(); // catégories vides à supprimer (R232 (5))
let renommagesEnFusion = new Map(); // source → cible : renommages acceptés en fusion (verifier), envoyés par operations
let lectures = 0; // la dernière lecture du vocabulaire demandée
let session = 0; // le passage en mode modification en cours (une lecture finie après la sortie ne dessine pas la gestion)

const tableau = () => document.getElementById('liste-mots-cles');
const lignes = () => [...(tableau()?.querySelectorAll('tbody[data-id]') ?? [])];
const ligneDe = (id) => lignes().find((t) => t.dataset.id === String(id)) ?? null;
// `voir` : l'id d'un mot-clé que la page doit montrer (un mot-clé créé : la pagination affiche sa page)
const annoncerLeTableau = (gestion, voir) => document.dispatchEvent(new CustomEvent('glossaire:mots-cles', {
  detail: { gestion, categories: categories.map((c) => ({ id: c.id, libelle: c.libelle })), ...(voir !== undefined ? { voir } : {}) },
}));
const retires = () => new Set([...suppressions, ...forcages, ...fusions.keys()]);
const motCle = (id) => vocabulaire?.find((m) => m.id === id) ?? null;

/** Relit le vocabulaire dans la base vivante ; vrai si cette lecture est la dernière demandée et a réussi. */
async function relire(ed) {
  const n = ++lectures;
  try {
    const r = await ed.appel('GET', 'edition/mots-cles/');
    if (n !== lectures) return false;
    vocabulaire = r.motsCles;
    if (Array.isArray(r.categories)) categories = r.categories;
    // la liste des icônes du site (décision R235), que le choix de l'icône lit (ed.listes.icones, aussi donnée par GET /api/edition/listes/)
    if (Array.isArray(r.icones) && ed.listes && !ed.listes.icones) ed.listes.icones = r.icones;
    definirLeVocabulaire(r.motsCles, { css: r.css }); // les mots-clés, les bulles et la feuille des couleurs de la page suivent
    return true;
  } catch (e) {
    if (n === lectures) ed.annoncer(`La liste des mots-clés du site de dev n’a pas pu être lue : ${e.message}`, 'erreur');
    return false;
  }
}

/** La page où mène l'adresse du mot-clé `m` (`page_du_lien`, `titre_du_lien` du service : lib/mots-cles-db.mjs#pagesDesLiens) ; null sinon. */
const lienDe = (m) => (m.url && m.titre_du_lien ? { page: m.page_du_lien ?? '', titre: m.titre_du_lien } : null);

/** Remplace les lignes du tableau (ses <tbody>) par `html`, ou par les éléments `corps`. */
function remplacerLesLignes({ html = null, corps = null }) {
  const t = tableau();
  if (!t) return;
  for (const tbody of t.querySelectorAll('tbody')) tbody.remove();
  if (html !== null) t.insertAdjacentHTML('beforeend', html);
  if (corps) t.append(...corps);
}

/**
 * Le tableau de lecture (comme la page construite, avec les mentions, les catégories, les définitions, les adresses et les couleurs de la base vivante) :
 * la ligne de chaque mot-clé (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire ; les balises de sa définition : mots-cles-vivants.mjs).
 */
function dessinerLaLecture(ed) {
  const t = tableau();
  if (!t || !vocabulaire) return;
  t.removeAttribute('data-gestion');
  const options = { base: ed?.base || '/', categories };
  remplacerLesLignes({ html: vocabulaire.map((m) => htmlDeLaLigneDuGlossaire({ ...m, lien: lienDe(m) }, options)).join('') });
  annoncerLeTableau(false);
}

const element = (tag, classe, texte) => {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
};
const bouton = (texte, classe) => {
  const b = element('button', classe, texte);
  b.type = 'button';
  return b;
};

/**
 * Remet chaque ligne du tableau de gestion dans l'état de la file : supprimée (forcée ou non), fusionnée, ou rien ; boutons permis ou non ; la saisie
 * du libellé, des synonymes et des catégories d'un mot-clé qui disparaît, désactivée. Une ligne verrouillée n'a aucun bouton ; une ligne mentionnée a
 * « Fusionner dans… » et, si le service ne le refuse pas, « Forcer la suppression » (R196, R223). Puis les catégories en file.
 */
function etatDesLignes() {
  for (const t of lignes()) {
    if (!t.classList.contains('ed-mot-cle')) continue;
    const id = Number(t.dataset.id);
    const suppression = t.querySelector('.ed-mot-cle__supprimer');
    const forcage = t.querySelector('.ed-mot-cle__forcer');
    const fusion = t.querySelector('.ed-mot-cle__fusionner');
    if (!fusion) continue; // mot-clé verrouillé
    const force = forcages.has(id);
    const supprime = suppressions.has(id) || force;
    const cible = fusions.get(id);
    t.classList.toggle('ed-supprime', supprime);
    t.classList.toggle('ed-fusionne', Boolean(cible));
    if (suppression) {
      suppression.setAttribute('aria-pressed', String(supprime));
      suppression.textContent = supprime ? 'Sera supprimé — annuler' : 'Supprimer';
      suppression.disabled = Boolean(cible);
    }
    if (forcage) {
      forcage.setAttribute('aria-pressed', String(force));
      forcage.textContent = force ? 'Sera supprimé en forçant — annuler' : 'Forcer la suppression';
      forcage.disabled = Boolean(cible);
    }
    fusion.setAttribute('aria-pressed', String(Boolean(cible)));
    fusion.textContent = cible ? `Sera fusionné dans « ${motCle(cible)?.libelle ?? cible} » — annuler` : 'Fusionner dans…';
    fusion.disabled = supprime;
    for (const saisie of t.querySelectorAll('.ed-saisie, .ed-mot-cle__synonymes-saisie, .ed-mot-cle__categorie input')) saisie.disabled = supprime || Boolean(cible);
  }
  const portees = categoriesPortees();
  for (const li of document.querySelectorAll('li.ed-categorie-mot-cle')) {
    const supprimer = li.querySelector('.ed-categorie-mot-cle__supprimer');
    if (!supprimer) continue;
    const id = Number(li.dataset.id);
    const c = categories.find((x) => x.id === id);
    const n = portees ? (portees.get(id) ?? 0) : Number(c?.mots_cles ?? 0);
    const offerte = suppressionDeCategorieOfferte({ mots_cles: n });
    if (!offerte) categoriesSupprimees.delete(id); // cochée de nouveau : la suppression en file tombe
    const enFile = categoriesSupprimees.has(id);
    li.querySelector('.ed-categorie-mot-cle__compte').textContent = `${n} mot${n > 1 ? 's' : ''}-clé${n > 1 ? 's' : ''}`;
    li.classList.toggle('ed-supprime', enFile);
    supprimer.disabled = !offerte;
    supprimer.title = offerte ? 'Aucun mot-clé ne la porte : la retirer (à l’enregistrement)'
      : `Portée par ${n} mot${n > 1 ? 's' : ''}-clé${n > 1 ? 's' : ''} : décochez-la d’abord (une catégorie ne se supprime que vide, décision R232 (5))`;
    supprimer.setAttribute('aria-pressed', String(enFile));
    supprimer.textContent = enFile ? 'Sera supprimée — annuler' : 'Supprimer';
  }
}

/**
 * Le nombre de mots-clés qui portent chaque catégorie d'après les cases cochées du tableau de gestion (Map(id → n)), sans les mots-clés qui
 * disparaissent (supprimés, fusionnés) : une catégorie décochée partout devient supprimable dans le même lot (les catégories des mots-clés partent
 * avant les catégories supprimées, `operationsDuVocabulaire`). null hors du tableau de gestion : le compte lu dans la base sert.
 */
function categoriesPortees() {
  if (!tableau()?.hasAttribute('data-gestion')) return null;
  const sortants = retires();
  const portees = new Map();
  // les cases cochées de chaque ligne ; un mot-clé ancré n'a pas de case (sa ligne est en lecture seule) : ses catégories, celles de la base vivante
  const saisies = saisiesDesListes();
  for (const m of vocabulaire ?? []) {
    if (sortants.has(m.id)) continue;
    for (const c of saisies.get(m.id)?.categories ?? m.categories ?? []) portees.set(c, (portees.get(c) ?? 0) + 1);
  }
  return portees;
}

/** La petite boîte « Fusionner « X » dans… » : une saisie avec les autres mots-clés en suggestions ; `choisir(cible)` à la validation. */
function demanderLaCible(m, choisir) {
  const cibles = ciblesDeFusion(vocabulaire, m.id, { retires: retires() });
  const ecritures = ecrituresDesCibles(cibles);
  const dialogue = element('dialog', 'ed-dialogue');
  dialogue.setAttribute('data-mots-cles-bruts', ''); // les textes du mode modification : tels qu'écrits (mots-cles-vivants.mjs)
  const form = document.createElement('form');
  form.method = 'dialog';
  const titre = element('h2', '', `Fusionner « ${m.libelle} » dans…`);
  const aide = element('p', 'ed-aide', `Ses pages (${compteDesElements(m)}) porteront le mot-clé choisi, puis « ${m.libelle} » disparaîtra (à l’enregistrement).`);
  const label = document.createElement('label');
  const libelle = element('span', 'ed-libelle', 'Mot-clé qui le remplace *');
  const saisie = element('input', 'ed-saisie');
  saisie.required = true;
  saisie.autocomplete = 'off';
  saisie.setAttribute('list', 'ed-cibles-de-fusion');
  const suggestions = document.createElement('datalist');
  suggestions.id = 'ed-cibles-de-fusion';
  suggestions.append(...cibles.map((c) => new Option(compteDesElements(c), ecritures.get(c.id))));
  label.append(libelle, saisie, suggestions);
  const erreur = element('p', 'ed-erreur');
  erreur.setAttribute('role', 'alert');
  erreur.hidden = true;
  const boutons = element('div', 'ed-boutons');
  const annuler = bouton('Annuler', '');
  const valider = bouton('Choisir', '');
  valider.type = 'submit';
  boutons.append(annuler, valider);
  form.append(titre, aide, label, erreur, boutons);
  dialogue.append(form);
  document.body.append(dialogue);
  annuler.addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('close', () => dialogue.remove());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cible = cibleSaisie(cibles, saisie.value);
    if (!cible) {
      erreur.textContent = 'Choisissez un mot-clé de la liste (ni lui-même, ni un mot-clé qui disparaît ; un homonyme par sa clé).';
      erreur.hidden = false;
      return;
    }
    choisir(cible);
    dialogue.close();
  });
  dialogue.showModal();
}

// Le cadenas d'un mot-clé verrouillé (décision R219 (7)) : une icône au trait, du même dessin que le crayon de l'éditeur (editeur.mjs#CRAYON)
const CADENAS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

/**
 * Le menu déroulant des endroits qui mentionnent le mot-clé (décision R196 (2) : « un menu déroulant qui liste toutes les pages qui mentionne le mot clé
 * en question ») : une page en lien (lib/metiers.mjs#cheminDePage), un texte qu'aucune page ne montre par son nom ; null quand le service ne donne pas
 * les mentions.
 */
function menuDesMentions(ed, m) {
  const endroits = endroitsDesMentions(m);
  if (!endroits) return null;
  const menu = element('details', 'ed-mot-cle__mentions');
  if (!endroits.length) menu.dataset.vide = '';
  const resume = element('summary', '', endroits.length ? `${endroits.length} ${endroits.length > 1 ? 'mentions' : 'mention'}` : 'Aucune mention');
  const ul = document.createElement('ul');
  for (const x of endroits) {
    const li = document.createElement('li');
    if (x.page) {
      const a = element('a', '', x.libelle);
      a.href = `${ed?.base || '/'}${cheminDePage(x.page)}`;
      li.append(a);
    } else {
      li.textContent = x.libelle;
    }
    if (x.exemple) li.dataset.exemple = '';
    ul.append(li);
  }
  menu.append(resume, ul);
  // la raison pour laquelle le forçage n'est pas offert (décision R223 : `refus_du_forcage`), lisible aussi au toucher, où l'infobulle ne s'ouvre pas
  const raison = raisonSansForcage(m);
  if (raison) menu.append(element('p', 'ed-mot-cle__sans-forcage-raison', `Suppression forcée impossible : ${raison}`));
  return menu;
}

/**
 * Met en file (ou retire de la file) la suppression du mot-clé `m`, forcée ou non (`file` : suppressions ou forcages) ; un mot-clé qui doit recevoir une
 * fusion en attente ne se supprime pas.
 */
function basculerLaSuppression(ed, m, file) {
  if (file.delete(m.id)) {
    etatDesLignes();
    return;
  }
  const recoit = [...fusions].find(([, cible]) => cible === m.id);
  if (recoit) {
    ed.annoncer(`« ${m.libelle} » doit recevoir « ${motCle(recoit[0])?.libelle} » (fusion en attente) : annulez cette fusion avant de le supprimer.`, 'erreur');
    return;
  }
  file.add(m.id);
  ed.marquerModifie();
  etatDesLignes();
}

/**
 * Les cases à cocher du type d'un mot-clé (R309 : un seul type, les cases sont exclusives : en cocher une décoche les autres, on peut tout décocher ;
 * `cochees` : ses ids — un mot-clé qui a encore plusieurs catégories avant le premier lot d'ancrage les montre toutes cochées, sans refus à
 * l'enregistrement) ; un changement marque la page modifiée.
 */
function casesDesCategories(ed, cochees) {
  const fieldset = element('fieldset', 'ed-mot-cle__categories-choix');
  fieldset.setAttribute('aria-label', 'Type');
  for (const c of categories) fieldset.append(caseDeCategorie(ed, c, cochees.includes(c.id)));
  return fieldset;
}
function caseDeCategorie(ed, c, cochee) {
  const label = element('label', 'ed-mot-cle__categorie');
  const caseACocher = document.createElement('input');
  caseACocher.type = 'checkbox';
  caseACocher.value = String(c.id);
  caseACocher.checked = cochee;
  caseACocher.addEventListener('change', () => {
    decocherLesAutres(caseACocher, caseACocher.closest('fieldset')?.querySelectorAll('.ed-mot-cle__categorie input') ?? []);
    ed.marquerModifie();
    etatDesLignes(); // le compte des catégories et leur « Supprimer »
  });
  label.append(caseACocher, ` ${c.libelle}`);
  return label;
}

/**
 * Une ligne du tableau de gestion (un <tbody>, les colonnes du tableau de lecture) : ses noms (la balise à copier, le libellé, la liste ordonnée de ses
 * synonymes), ses catégories (cases à cocher), son adresse, ses outils — le menu des mentions (R196 (2)) et, pour un mot-clé verrouillé, le cadenas
 * (R219 (7)), sinon « Fusionner dans… » et, s'il n'est mentionné nulle part, « Supprimer » ; mentionné, « Forcer la suppression », ou la note qui dit
 * pourquoi le service la refuserait (R223) — ; dessous, sur toute la largeur, sa couleur et sa définition (saisies communes). Un mot-clé **ancré** (`element`,
 * R309) est en lecture seule : ni saisie, ni case, ni bouton ; il garde la balise à copier et le menu de ses mentions, le cadenas s'il est verrouillé, et une
 * note dit à quoi il est lié (un lien vers l'endroit où il se modifie) ; il reste une cible de « Fusionner dans… » (ciblesDeFusion). Le type : des cases
 * exclusives (R309), toutes cochées pour un mot-clé qui a encore plusieurs catégories.
 */
function ligneDeGestion(ed, m) {
  const t = element('tbody', 'ed-mot-cle');
  const ancre = aUnElement(m); // R309 : un mot-clé ancré est en lecture seule, hors sa balise à copier et le menu de ses mentions
  // la balise à copier, son aide, les synonymes et la définition telle qu'enregistrée (balises comprises) : tels qu'écrits, jamais rendus
  // (mots-cles-vivants.mjs) ; une ligne ancrée n'a que la balise à copier de brute, le reste y est lu comme au tableau de lecture
  if (!ancre) t.setAttribute('data-mots-cles-bruts', '');
  Object.assign(t.dataset, { id: String(m.id), cle: m.cle, libelle: m.libelle });
  if (m.description) t.dataset.definition = m.description;
  if (m.synonymes?.length) t.dataset.synonymes = JSON.stringify(m.synonymes);
  if (m.categories?.length) t.dataset.categories = JSON.stringify(m.categories);
  if (ancre) {
    t.classList.add('ed-mot-cle--ancre');
    t.dataset.ancre = m.element.table;
  }
  const verrouille = estVerrouille(m);
  // chaque champ, une saisie commune ; vide : NULL (sauf le libellé, requis) ; sur un mot-clé ancré, le texte seul
  const champ = (classe, colonne, valeur) => {
    const span = element('span', classe, valeur ?? '');
    if (!ancre) span.dataset.ed = attributEd('mot_cle', { id: m.id }, colonne);
    return span;
  };
  const ligne = element('tr', 'ed-mot-cle__ligne');
  // l'icône (décision R235 : un choix dans la liste des icônes du site, ed.listes.icones ; vidée, NULL ; modifiable aussi sur un mot-clé verrouillé)
  const icone = element('td', 'ed-mot-cle__icone-case');
  if (ancre) icone.innerHTML = htmlDeLIcone(m.icone);
  else icone.append(champ('ed-mot-cle__icone', 'icone', m.icone));
  const noms = element('th', 'ed-mot-cle__noms');
  noms.setAttribute('scope', 'row');
  const balise = element('code', 'ed-mot-cle__balise', `{{${m.cle}}}`);
  if (ancre) balise.setAttribute('data-mots-cles-bruts', ''); // la balise reste telle qu'écrite : c'est ce qu'on copie
  balise.title = `À écrire dans un texte pour citer ce mot-clé (en gras, sa définition en infobulle) ; « {{${m.cle}|texte}} » pour un autre texte affiché, `
    + `« {{${m.cle}:}} » pour « Libellé : définition »${m.synonymes?.length ? ` ; « {{${m.synonymes[0]}}} » pour un synonyme, qu’elle affiche` : ''}`;
  // les synonymes : une liste ordonnée, une écriture par ligne (R233 ; réponse T6)
  const synonymes = element('label', 'ed-mot-cle__synonymes');
  const saisieDesSynonymes = element('textarea', 'ed-mot-cle__synonymes-saisie');
  saisieDesSynonymes.rows = Math.max(1, Math.min(4, (m.synonymes?.length ?? 0) + 1));
  saisieDesSynonymes.value = (m.synonymes ?? []).join('\n');
  saisieDesSynonymes.addEventListener('input', () => ed.marquerModifie());
  synonymes.append(element('span', 'ed-libelle', 'Synonymes (un par ligne)'), saisieDesSynonymes);
  if (ancre) {
    noms.append(balise, champ('ed-mot-cle__nom', 'libelle', m.libelle));
    if (m.synonymes?.length) noms.append(element('span', 'ed-mot-cle__synonymes', m.synonymes.join(', ')));
  } else noms.append(balise, champ('ed-mot-cle__nom', 'libelle', m.libelle), synonymes);
  const cats = element('td', 'ed-mot-cle__categories');
  if (ancre) cats.append(libellesDesCategories(m.categories ?? [], categories).join(', ') || '—');
  else cats.append(casesDesCategories(ed, m.categories ?? []));
  const lien = element('td', 'ed-mot-cle__lien-case');
  const adresse = ancre ? adresseDuMotCle(m, ed?.base || '/') : null;
  if (adresse) {
    const a = element('a', 'ed-mot-cle__lien', lienDe(m)?.titre ?? m.url);
    a.href = adresse;
    lien.append(a);
  } else lien.append(champ('ed-mot-cle__lien', 'url', m.url));
  const outils = element('td', 'ed-mot-cle__outils');
  const compte = element('span', 'ed-mot-cle__compte', compteDesElements(m));
  outils.append(compte);
  const mentions = menuDesMentions(ed, m);
  if (mentions) outils.append(mentions);
  ligne.append(icone, noms, cats, lien, outils);
  const suite = element('tr', 'ed-mot-cle__suite');
  const definition = element('td', 'ed-mot-cle__suite-case');
  definition.setAttribute('colspan', String(COLONNES_DU_GLOSSAIRE.length));
  if (ancre) definition.append(element('span', 'ed-mot-cle__definition', definitionDuMotCle(m) ?? 'Pas encore de définition.'));
  else definition.append(champ('ed-mot-cle__couleur', 'couleur', m.couleur), champ('ed-mot-cle__definition', 'description', m.description));
  suite.append(definition);
  t.append(ligne, suite);
  if (verrouille) {
    t.classList.add('ed-mot-cle--verrouille');
    t.setAttribute('data-verrou', '');
    const cadenas = element('span', 'ed-mot-cle__verrou');
    cadenas.setAttribute('role', 'img');
    cadenas.setAttribute('aria-label', INFOBULLE_DU_VERROU);
    cadenas.title = INFOBULLE_DU_VERROU;
    cadenas.innerHTML = CADENAS;
    outils.append(cadenas);
  }
  if (ancre) {
    // ni « Supprimer », ni « Forcer la suppression », ni « Fusionner dans… » : la ligne dit où il se modifie
    const note = element('p', 'ed-mot-cle__ancre', noteDeLAncrage(m));
    if (typeof m.element.adresse === 'string' && m.element.adresse) {
      const a = element('a', '', 'Ouvrir');
      a.href = `${String(ed?.base || '/').replace(/\/+$/, '')}${m.element.adresse}`;
      note.append(' ', a);
    }
    outils.append(note);
    return t;
  }
  if (verrouille) return t;
  if (fusionOfferte(m)) {
    const fusion = bouton('Fusionner dans…', 'ed-outil ed-mot-cle__fusionner');
    fusion.setAttribute('aria-pressed', 'false');
    fusion.title = 'Ses pages portent un autre mot-clé, puis il disparaît (à l’enregistrement)';
    fusion.addEventListener('click', () => {
      if (fusions.delete(m.id)) {
        etatDesLignes();
        return;
      }
      // un mot-clé qui en reçoit un autre peut être fusionné à son tour : la file part dans l'ordre (« A » dans « X », puis « X » dans « Y ») ; un mot-clé
      // déjà en file (supprimé ou fusionné) n'est jamais proposé comme cible (ciblesDeFusion)
      demanderLaCible(m, (cible) => {
        fusions.set(m.id, cible.id);
        ed.marquerModifie();
        etatDesLignes();
      });
    });
    outils.append(fusion);
  }
  if (suppressionOfferte(m)) {
    const suppression = bouton('Supprimer', 'ed-outil ed-outil--danger ed-mot-cle__supprimer');
    suppression.setAttribute('aria-pressed', 'false');
    suppression.title = 'Le retirer du vocabulaire (à l’enregistrement)';
    suppression.addEventListener('click', () => basculerLaSuppression(ed, m, suppressions));
    outils.append(suppression);
  }
  if (forcageOffert(m)) {
    const forcage = bouton('Forcer la suppression', 'ed-outil ed-outil--danger ed-mot-cle__forcer');
    forcage.setAttribute('aria-pressed', 'false');
    forcage.title = `Le supprimer malgré ses mentions (à l’enregistrement, décision R223) : ${ceQueRemplaceLeForcage(m).texte}`;
    forcage.addEventListener('click', () => basculerLaSuppression(ed, m, forcages));
    outils.append(forcage);
  } else {
    const raison = raisonSansForcage(m);
    if (raison) {
      const note = element('span', 'ed-mot-cle__sans-forcage', 'Suppression forcée impossible');
      note.setAttribute('tabindex', '0'); // l'infobulle s'ouvre aussi au clavier
      note.title = raison;
      outils.append(note);
    }
  }
  return t;
}

/** Les lignes des saisies du mot-clé `m` (celles du vocabulaire lu : libellé, définition, adresse et couleur telles qu'enregistrées : NULL ou texte). */
const ligneDesSaisies = (m) => ({
  id: m.id, libelle: m.libelle, cle: m.cle, description: m.description ?? null, url: m.url ?? null, couleur: m.couleur ?? null, icone: m.icone ?? null,
});

/** Le tableau de gestion (mode modification) : une ligne par mot-clé du vocabulaire, saisies montées par l'éditeur. */
function dessinerLaGestion(ed) {
  const t = tableau();
  if (!t || !vocabulaire) return;
  for (const m of vocabulaire) ed.lignes?.set(cleDeLigne('mot_cle', { id: m.id }), ligneDesSaisies(m));
  t.setAttribute('data-gestion', '');
  const corps = vocabulaire.map((m) => ligneDeGestion(ed, m));
  remplacerLesLignes({ corps });
  ed.monterChamps(t);
  dessinerLesCategories(ed);
  etatDesLignes();
  annoncerLeTableau(true);
}

/**
 * La gestion des catégories des mots-clés (décision R232 (5) : « une catégorie s'ajoute, se renomme, et se supprime si elle est vide »), au-dessus du
 * tableau : chacune en saisie commune (son libellé : categorie_mot_cle.libelle), le nombre de mots-clés qui la portent (d'après les cases cochées),
 * « Supprimer » permis quand elle est vide (mis en file), désactivé avec sa raison sinon ; « + Ajouter une catégorie », visible à côté de
 * « + Ajouter un mot-clé », la crée tout de suite.
 */
function dessinerLesCategories(ed) {
  const bloc = document.querySelector('.ed-categories-mots-cles');
  const ul = bloc?.querySelector('ul');
  if (!ul) return;
  for (const c of categories) ed.lignes?.set(cleDeLigne('categorie_mot_cle', { id: c.id }), { id: c.id, libelle: c.libelle, libelle_cle: c.libelle_cle });
  ul.replaceChildren(...categories.map((c) => ligneDeCategorie(ed, c)));
  bloc.querySelector('summary').textContent = `Catégories des mots-clés (${categories.length})`;
  ed.monterChamps(ul);
}
function ligneDeCategorie(ed, c) {
  const li = element('li', 'ed-categorie-mot-cle');
  li.dataset.id = String(c.id);
  const nom = element('span', 'ed-categorie-mot-cle__nom', c.libelle);
  nom.dataset.ed = attributEd('categorie_mot_cle', { id: c.id }, 'libelle');
  const n = Number(c.mots_cles ?? 0);
  li.append(nom, element('span', 'ed-categorie-mot-cle__compte', `${n} mot${n > 1 ? 's' : ''}-clé${n > 1 ? 's' : ''}`));
  // « Supprimer » sur chaque catégorie, permis seulement quand aucun mot-clé ne la porte plus (R232 (5)) : état et raison posés par etatDesLignes
  const supprimer = bouton('Supprimer', 'ed-outil ed-outil--danger ed-categorie-mot-cle__supprimer');
  supprimer.setAttribute('aria-pressed', 'false');
  supprimer.disabled = !suppressionDeCategorieOfferte(c);
  supprimer.addEventListener('click', () => {
    if (!categoriesSupprimees.delete(c.id)) {
      categoriesSupprimees.add(c.id);
      ed.marquerModifie();
    }
    etatDesLignes();
  });
  li.append(supprimer);
  return li;
}

/** Une catégorie créée : ajoutée à la liste, à la gestion des catégories et, non cochée, aux cases de chaque mot-clé (sans redessiner le tableau). */
function ajouterLaCategorie(ed, ligne) {
  const c = { id: ligne.id, libelle: ligne.libelle, libelle_cle: ligne.libelle_cle, mots_cles: 0 };
  categories = [...categories.filter((x) => x.id !== c.id), c].sort((a, b) => a.id - b.id);
  ed.lignes?.set(cleDeLigne('categorie_mot_cle', { id: c.id }), { id: c.id, libelle: c.libelle, libelle_cle: c.libelle_cle });
  const ul = document.querySelector('.ed-categories-mots-cles ul');
  if (ul) {
    const li = ligneDeCategorie(ed, c);
    li.classList.add('ed-nouveau');
    ul.append(li);
    ed.monterChamps(li);
    document.querySelector('.ed-categories-mots-cles summary').textContent = `Catégories des mots-clés (${categories.length})`;
  }
  for (const f of document.querySelectorAll('.ed-mot-cle__categories-choix')) f.append(caseDeCategorie(ed, c, false));
  etatDesLignes();
  annoncerLeTableau(Boolean(tableau()?.hasAttribute('data-gestion')));
}

/**
 * Un mot-clé créé, avec sa page de notion (docs/chantier-pages-de-notion.md, §4), tel que la base vivante relue le rend : en mode modification, sa ligne de
 * gestion à sa place dans le tableau, celle d'un mot-clé ancré (`element` : en lecture seule, « Ouvrir » mène à sa page) ; il ne se modifie plus au Glossaire.
 * Rend la ligne, ou null (hors du mode modification, ou absent du vocabulaire relu).
 */
function montrerLeMotCleCree(ed, id) {
  const m = motCle(id);
  const t = tableau();
  if (!m || !ed.enEdition || !t?.hasAttribute('data-gestion')) return null;
  ligneDe(id)?.remove();
  const corps = ligneDeGestion(ed, m);
  corps.classList.add('ed-nouveau');
  const suivant = vocabulaire[vocabulaire.indexOf(m) + 1];
  t.insertBefore(corps, (suivant && ligneDe(suivant.id)) || null);
  annoncerLeTableau(true, m.id);
  return corps;
}

/** Les catégories et les synonymes saisis dans le tableau de gestion : Map(id → { categories: [ids], synonymes: [écritures] }). */
function saisiesDesListes() {
  const saisies = new Map();
  for (const t of lignes()) {
    if (!t.classList.contains('ed-mot-cle') || t.classList.contains('ed-mot-cle--ancre')) continue; // un mot-clé ancré : aucune saisie
    const cases = t.querySelectorAll('.ed-mot-cle__categorie input');
    const synonymes = t.querySelector('.ed-mot-cle__synonymes-saisie');
    saisies.set(Number(t.dataset.id), {
      categories: [...cases].filter((c) => c.checked).map((c) => Number(c.value)),
      ...(synonymes ? { synonymes: synonymesSaisis(synonymes.value) } : {}),
    });
  }
  return saisies;
}

/**
 * Les champs du formulaire « Nouveau mot-clé » : ceux d'une notion (CHAMPS_D_UNE_NOTION : son nom, son type en cases exclusives, sa définition facultative ;
 * docs/chantier-pages-de-notion.md, §4), décrits par ENTITES.mot_cle. Ni adresse (elle vient de sa page), ni couleur, icône ou synonymes.
 */
const champsDeCreation = () => CHAMPS_D_UNE_NOTION.map((nom) => [nom, ENTITES.mot_cle.champs[nom]]).map(([nom, c]) => {
  if (c.type === 'ids') {
    // un seul type (R309), exclusif ; « Notion » est présélectionné quand cette catégorie existe (elle n'existe qu'après le premier lot d'ancrage)
    const notion = typeParDefaut(categories);
    return {
      nom, libelle: 'Type', type: 'categories', exclusif: true, valeur: notion === null ? [] : [notion], choix: categories.map((x) => ({ id: x.id, libelle: x.libelle })),
      vide: 'Aucun type pour l’instant : « + Ajouter une catégorie », au-dessus du tableau.',
    };
  }
  return { nom, libelle: c.libelle, type: c.type, requis: c.requis };
});

export const motsCles = {
  nom: 'mots-cles',
  actif: (doc) => Boolean(doc.querySelector('[data-glossaire]')),

  async surcouche(ed) {
    if ((await relire(ed)) && !ed.enEdition) dessinerLaLecture(ed);
  },

  debut(ed) {
    const n = ++session;
    const outils = element('div', 'ed-outils ed-outils-mots-cles');
    const nouveau = bouton('+ Ajouter un mot-clé', 'ed-outil');
    nouveau.addEventListener('click', () =>
      ed.formulaire({
        titre: ENTITES.mot_cle.nouveau,
        aide: 'Le mot-clé est créé tout de suite dans la base du site de dev, avec sa page des Règles (hors menu), qui porte son nom ; un texte le cite ensuite '
          + 'par sa balise (« {{clé}} »). Il ne se modifie plus au Glossaire : on renomme sa page. Un homonyme d’un mot-clé existant demande un type qui l’en distingue.',
        champs: champsDeCreation(),
        valider: async (brutes) => {
          // la notion et sa page d'un même geste (docs/chantier-pages-de-notion.md, §4) : seuls son nom, son type et sa définition partent
          const valeurs = Object.fromEntries(CHAMPS_D_UNE_NOTION.filter((c) => brutes[c] !== undefined).map((c) => [c, brutes[c]]));
          const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'mot_cle', valeurs }] });
          const ligne = r.lignes.find((l) => l.table === 'mot_cle' && l.ligne)?.ligne;
          if (!ligne) return;
          const page = r.lignes.find((l) => l.table === 'page' && l.ligne)?.ligne;
          // relu : sa ligne est celle d'un mot-clé relié à sa page (lecture seule, « Ouvrir »), la feuille des couleurs et la clé de ses homonymes suivent
          const relu = await relire(ed);
          if (relu) montrerLeMotCleCree(ed, ligne.id)?.scrollIntoView({ block: 'center' });
          const cree = `Mot-clé créé avec sa page${page?.titre ? ` « ${page.titre} »` : ''} : ${ligne.libelle} (balise « {{${ligne.cle ?? ligne.id}}} »). `;
          // la relecture manquée a son propre message : il ne s'efface pas sans dire ce qui est créé ni comment le voir
          if (relu) ed.annoncer(`${cree}Il se modifie désormais par sa page.`);
          else ed.annoncer(`${cree}La liste des mots-clés n’a pas pu être relue : rechargez la page pour le voir.`, 'erreur');
        },
      }),
    );
    // la gestion des catégories (R232 (5)) : « + Ajouter une catégorie » à côté de « + Ajouter un mot-clé », la liste repliée dessous
    const blocCategories = element('details', 'ed-categories-mots-cles');
    blocCategories.append(element('summary', '', 'Catégories des mots-clés'), element('ul', 'ed-categories-mots-cles__liste'));
    const nouvelle = bouton('+ Ajouter une catégorie', 'ed-outil');
    nouvelle.addEventListener('click', () =>
      ed.formulaire({
        titre: ENTITES.categorie_mot_cle.nouveau,
        aide: 'La catégorie est créée tout de suite dans la base du site de dev ; elle se coche ensuite sur les mots-clés qu’elle range.',
        champs: Object.entries(ENTITES.categorie_mot_cle.champs).map(([nom, c]) => ({ nom, libelle: c.libelle, type: c.type, requis: c.requis })),
        valider: async (valeurs) => {
          const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'categorie_mot_cle', valeurs }] });
          const ligne = r.lignes.find((l) => l.table === 'categorie_mot_cle' && l.ligne)?.ligne;
          if (!ligne) return;
          ajouterLaCategorie(ed, ligne);
          ed.annoncer(`Catégorie créée : ${ligne.libelle}.`);
        },
      }),
    );
    outils.append(nouveau, nouvelle, blocCategories);
    tableau()?.closest('.tableau')?.before(outils);
    // le vocabulaire relu au crayon : les saisies partent de la base vivante telle qu'elle est maintenant
    relire(ed).then((lu) => {
      if (lu && ed.enEdition && n === session) dessinerLaGestion(ed);
    });
  },

  verifier(ed, editeurs) {
    renommagesEnFusion = new Map();
    if (!vocabulaire) return null;
    const impossible = erreurDesRetraits(vocabulaire, { suppressions, forcages, fusions });
    if (impossible) return `Non enregistré : ${impossible}`;
    const renommages = [...editeurs.values()]
      .filter((e) => e.info.table === 'mot_cle' && e.info.colonne === 'libelle' && e.controle.value !== e.original)
      .map((e) => ({ id: e.info.cle.id, avant: e.original, libelle: e.controle.value.trim() }));
    const saisies = saisiesDesListes();
    const categoriesSaisies = new Map([...saisies].map(([id, s]) => [id, s.categories]));
    const { erreur, aFusionner } = examinerLesRenommages(vocabulaire, renommages, { retires: retires(), categories: categoriesSaisies });
    if (erreur) return erreur;
    for (const r of aFusionner) {
      const cible = motCle(r.dans);
      const question = `« ${r.libelle} » s’écrit comme « ${cible.libelle} », sans catégorie qui les distingue : fusionner « ${r.avant} » dans « ${cible.libelle} » ?\n`
        + `Ses pages (${compteDesElements(motCle(r.id) ?? {})}) porteront « ${cible.libelle} », puis « ${r.avant} » disparaîtra.`;
      if (!confirm(question)) {
        return `Non enregistré : « ${r.libelle} » s’écrit comme le mot-clé « ${cible.libelle} ». Donnez à chacun une catégorie qui le distingue de l’autre `
          + '(décision R232 (9)), choisissez une autre écriture, ou acceptez de les fusionner.';
      }
      renommagesEnFusion.set(r.id, r.dans);
    }
    const question = confirmationDesRetraits(vocabulaire, { suppressions, forcages, fusions });
    if (question && !confirm(question)) return 'Enregistrement annulé : rien n’a été envoyé.';
    return null;
  },

  operations(_ed, operations) {
    const toutesLesFusions = new Map([...fusions, ...renommagesEnFusion]);
    const sortants = new Set([...suppressions, ...forcages, ...toutesLesFusions.keys()]);
    return operationsDuVocabulaire(operations, {
      suppressions, forcages, fusions: toutesLesFusions, vocabulaire: vocabulaire ?? [], categoriesSupprimees,
      listes: vocabulaire ? operationsDesListes(vocabulaire, saisiesDesListes(), { retires: sortants }) : undefined,
    });
  },

  fin(ed) {
    session += 1;
    suppressions.clear();
    forcages.clear();
    fusions.clear();
    categoriesSupprimees.clear();
    renommagesEnFusion = new Map();
    document.querySelector('.ed-outils-mots-cles')?.remove();
    dessinerLaLecture(ed); // tout de suite, puis avec ce que l'enregistrement a changé
    relire(ed).then((lu) => {
      if (lu && !ed.enEdition) dessinerLaLecture(ed);
    });
  },
};
