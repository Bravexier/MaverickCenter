// Extension de l'éditeur : le glossaire des mots-clés sur /regles/glossaire/ (pages/regles/glossaire.astro ; réponses du propriétaire du 2026-11-06, Q6
// et Q7 : toute la gestion du vocabulaire, jusque-là sur /recherche/, est sur le Glossaire, plus l'adresse et la couleur) — demandes du propriétaire :
// « en mode édition seulement », « supprimer / ajouter / Modifier des mots clés » ; puis (2026-10-16, migration 0056) « Le mot-clé aura son ID, son
// texte et une description ».
//   - au chargement (surcouche) : la liste relue dans la base vivante (GET /api/edition/mots-cles/ : le site construit est en retard sur le site de dev),
//     définitions, bulles et feuille des couleurs comprises (mots-cles-vivants.mjs suit le vocabulaire relu et réécrit la feuille avec `css`) ;
//   - au crayon (debut) : une liste de gestion — pour chaque mot-clé, la balise à copier (« {{id}} »), son libellé (mot_cle.libelle ; décision R195 :
//     modifiable pour tout mot-clé non verrouillé), son abréviation (mot_cle.abreviation, migration 0090 ; vidée, NULL), ses pages (leur nombre), son
//     adresse (mot_cle.url, migration 0098 : une balise de ce mot-clé est un lien vers elle ; vidée, NULL), sa couleur (mot_cle.couleur : la liste des
//     couleurs du site, groupées par famille, et le cercle d'une autre couleur, editeur.mjs#controleDeCouleur ; réponses Q3, Q4), sa définition
//     (mot_cle.description), le menu déroulant des endroits qui le mentionnent (décision R196 (2), `mentions` du service : lib/mentions-des-mots-cles.mjs),
//     « Fusionner dans… » et « Supprimer » (mis en file, envoyés avec « Enregistrer » ; « Supprimer » seulement quand rien ne le mentionne, R196) ;
//     un mot-clé mentionné, à la place de « Supprimer », « Forcer la suppression » (décision R223 : mis en file comme les autres, confirmé avec ce qu'il
//     remplace), sauf quand le service prévoit de refuser le forçage (`refus_du_forcage`) : une note « Suppression forcée impossible » dit pourquoi (en
//     infobulle, et au bas du menu des mentions) ;
//     un mot-clé verrouillé (mot_cle.verrou = 1, migration 0110 ; décisions R218, R219 (7) : « un cadenas sur la ligne, champs désactivés, la raison en
//     infobulle ») a son cadenas, ses champs désactivés, ni « Supprimer » ni « Fusionner dans… », mais reste une cible de fusion et garde son menu des
//     mentions ; « + Ajouter un mot-clé » le crée tout de suite (non verrouillé, R219 (5)), avec sa définition, son abréviation, son adresse et sa couleur
//     (ENTITES.mot_cle) ; ce que le service refuse (400 : abréviation, adresse ou couleur mal écrite ; 409 : abréviation prise par un autre mot-clé,
//     mot-clé verrouillé, mot-clé mentionné, refus du forçage ; `champ`) l'est comme tout refus du lot ;
//   - à l'enregistrement (verifier) : ce que le service ne pourrait pas jouer est refusé avant toute question (noms échangés en boucle, mot-clé qui reçoit
//     une fusion et serait supprimé) ; un renommage vers une écriture qui reste prise après le lot propose la fusion ; suppressions et fusions sont
//     confirmées une fois ; (operations) fusions et suppressions passent avant les renommages, chacun dans un ordre que le service accepte
//     (lib/mots-cles-edition.mjs) ;
//   - en sortant (fin, après un enregistrement aussi) : la liste relue dans la base vivante.
// Hors du mode modification, rien ne montre le verrou (R219 (7)).
// La page (src/scripts/glossaire.mjs : le filtre) relit la liste à l'évènement « glossaire:mots-cles » (detail.gestion : la liste de gestion est
// affichée) ; chaque mot-clé y est un <li data-id data-cle data-n data-libelle data-abreviation data-definition data-url data-couleur> (absents sans
// valeur), la ligne de lecture le HTML de la page construite (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire), dont les balises de la définition
// sont rendues par mots-cles-vivants.mjs dès qu'elle est posée. Les catégories des événements de la chronologie se gèrent sur /chronologie/.
import { attributEd, cleDeLigne, ENTITES } from '../../lib/edition-modele.mjs';
import { cheminDePage } from '../../lib/metiers.mjs';
import { estVerrouille, parLibelle } from '../../lib/mots-cles.mjs';
import {
  ceQueRemplaceLeForcage, cibleSaisie, ciblesDeFusion, compteDesElements, confirmationDesRetraits, endroitsDesMentions, erreurDesRetraits,
  examinerLesRenommages, forcageOffert, fusionOfferte, INFOBULLE_DU_VERROU, operationsDuVocabulaire, raisonSansForcage, suppressionOfferte,
} from '../../lib/mots-cles-edition.mjs';
import { htmlDeLaLigneDuGlossaire } from '../../lib/mots-cles-balises.mjs';
import { definirLeVocabulaire } from './mots-cles-vivants.mjs';

// [{ id, libelle, libelle_cle, description, abreviation, url, couleur, pages, verrou, mentions }] de la base vivante ; null : pas encore lu
let vocabulaire = null;
const suppressions = new Set();
const forcages = new Set(); // suppressions forcées (« Forcer la suppression », décision R223)
const fusions = new Map(); // source → cible (« Fusionner dans… »)
let renommagesEnFusion = new Map(); // source → cible : renommages acceptés en fusion (verifier), envoyés par operations
let lectures = 0; // la dernière lecture du vocabulaire demandée
let session = 0; // le passage en mode modification en cours (une lecture finie après la sortie ne dessine pas la liste de gestion)

const racine = () => document.querySelector('[data-glossaire]');
const liste = () => document.getElementById('liste-mots-cles');
const annoncerLaListe = (gestion) => document.dispatchEvent(new CustomEvent('glossaire:mots-cles', { detail: { gestion } }));
const retires = () => new Set([...suppressions, ...forcages, ...fusions.keys()]);
const motCle = (id) => vocabulaire?.find((m) => m.id === id) ?? null;

/** Relit le vocabulaire dans la base vivante ; vrai si cette lecture est la dernière demandée et a réussi. */
async function relire(ed) {
  const n = ++lectures;
  try {
    const { motsCles, css } = await ed.appel('GET', 'edition/mots-cles/');
    if (n !== lectures) return false;
    vocabulaire = motsCles;
    definirLeVocabulaire(motsCles, { css }); // les mots-clés, les bulles et la feuille des couleurs de la page suivent
    return true;
  } catch (e) {
    if (n === lectures) ed.annoncer(`La liste des mots-clés du site de dev n’a pas pu être lue : ${e.message}`, 'erreur');
    return false;
  }
}

/** Les attributs que lit la page (src/scripts/glossaire.mjs) : id, écriture, nombre de pages, libellé, abréviation, définition, adresse, couleur. */
function decrire(li, m) {
  Object.assign(li.dataset, { id: m.id, cle: m.libelle_cle, n: String(m.pages), libelle: m.libelle });
  for (const [attribut, valeur] of [['abreviation', m.abreviation], ['definition', m.description], ['url', m.url], ['couleur', m.couleur]]) {
    if (valeur) li.dataset[attribut] = valeur;
    else delete li.dataset[attribut];
  }
}

/**
 * La liste de lecture (comme la page construite, avec les comptes, les définitions, les adresses et les couleurs de la base vivante) : la ligne de chaque
 * mot-clé (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire ; les balises de sa définition : mots-cles-vivants.mjs).
 */
function dessinerLaLecture(ed) {
  const ul = liste();
  if (!ul || !vocabulaire) return;
  ul.removeAttribute('data-gestion');
  ul.className = 'glossaire-liste';
  const options = { base: ed?.base || '/', lienDesPages: racine()?.dataset.lienMotCle ?? '/recherche/?mot-cle=' };
  ul.innerHTML = vocabulaire.map((m) => htmlDeLaLigneDuGlossaire({ ...m, n: m.pages }, options)).join('');
  annoncerLaListe(false);
}

const bouton = (texte, classe) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = texte;
  return b;
};

/**
 * Remet chaque ligne de la liste de gestion dans l'état de la file : supprimée (forcée ou non), fusionnée, ou rien ; boutons permis ou non. Une ligne
 * verrouillée n'a aucun bouton ; une ligne mentionnée a « Fusionner dans… » et, si le service ne le refuse pas, « Forcer la suppression » (R196, R223).
 */
function etatDesLignes() {
  for (const li of liste()?.querySelectorAll('li.ed-mot-cle') ?? []) {
    const { id } = li.dataset;
    const suppression = li.querySelector('.ed-mot-cle__supprimer');
    const forcage = li.querySelector('.ed-mot-cle__forcer');
    const fusion = li.querySelector('.ed-mot-cle__fusionner');
    if (!fusion) continue; // mot-clé verrouillé
    const force = forcages.has(id);
    const supprime = suppressions.has(id) || force;
    const cible = fusions.get(id);
    li.classList.toggle('ed-supprime', supprime);
    li.classList.toggle('ed-fusionne', Boolean(cible));
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
    const saisie = li.querySelector('.ed-saisie');
    if (saisie) saisie.disabled = supprime || Boolean(cible);
  }
}

/** La petite boîte « Fusionner « X » dans… » : une saisie avec les autres mots-clés en suggestions ; `choisir(cible)` à la validation. */
function demanderLaCible(m, choisir) {
  const cibles = ciblesDeFusion(vocabulaire, m.id, { retires: retires() });
  const dialogue = document.createElement('dialog');
  dialogue.className = 'ed-dialogue';
  dialogue.setAttribute('data-mots-cles-bruts', ''); // les textes du mode modification : tels qu'écrits (mots-cles-vivants.mjs)
  const form = document.createElement('form');
  form.method = 'dialog';
  const titre = document.createElement('h2');
  titre.textContent = `Fusionner « ${m.libelle} » dans…`;
  const aide = document.createElement('p');
  aide.className = 'ed-aide';
  aide.textContent = `Ses pages (${compteDesElements(m)}) porteront le mot-clé choisi, puis « ${m.libelle} » disparaîtra (à l’enregistrement).`;
  const label = document.createElement('label');
  const libelle = document.createElement('span');
  libelle.className = 'ed-libelle';
  libelle.textContent = 'Mot-clé qui le remplace *';
  const saisie = document.createElement('input');
  saisie.className = 'ed-saisie';
  saisie.required = true;
  saisie.autocomplete = 'off';
  saisie.setAttribute('list', 'ed-cibles-de-fusion');
  const suggestions = document.createElement('datalist');
  suggestions.id = 'ed-cibles-de-fusion';
  suggestions.append(...cibles.map((c) => new Option(compteDesElements(c), c.libelle)));
  label.append(libelle, saisie, suggestions);
  const erreur = document.createElement('p');
  erreur.className = 'ed-erreur';
  erreur.setAttribute('role', 'alert');
  erreur.hidden = true;
  const boutons = document.createElement('div');
  boutons.className = 'ed-boutons';
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
      erreur.textContent = 'Choisissez un mot-clé de la liste (ni lui-même, ni un mot-clé qui disparaît).';
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
  const menu = document.createElement('details');
  menu.className = 'ed-mot-cle__mentions';
  if (!endroits.length) menu.dataset.vide = '';
  const resume = document.createElement('summary');
  resume.textContent = endroits.length ? `${endroits.length} ${endroits.length > 1 ? 'mentions' : 'mention'}` : 'Aucune mention';
  const ul = document.createElement('ul');
  for (const x of endroits) {
    const li = document.createElement('li');
    if (x.page) {
      const a = document.createElement('a');
      a.href = `${ed?.base || '/'}${cheminDePage(x.page)}`;
      a.textContent = x.libelle;
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
  if (raison) {
    const p = document.createElement('p');
    p.className = 'ed-mot-cle__sans-forcage-raison';
    p.textContent = `Suppression forcée impossible : ${raison}`;
    menu.append(p);
  }
  return menu;
}

/**
 * Un mot-clé verrouillé (décisions R218, R219 (7)) : ses saisies montées par l'éditeur désactivées (leur valeur ne change pas : aucune opération ne part),
 * la raison en infobulle sur chaque champ (la saisie désactivée ne reçoit pas le pointeur : styles/edition/edition.css).
 */
function verrouiller(li) {
  if (!li.hasAttribute('data-verrou')) return;
  for (const champ of li.querySelectorAll('[data-ed]')) {
    champ.title = INFOBULLE_DU_VERROU;
    for (const saisie of champ.querySelectorAll('textarea, input, select, button')) saisie.disabled = true;
  }
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
 * Une ligne de la liste de gestion : la balise à copier, le libellé, l'abréviation, ses pages, l'adresse, la couleur et la définition (saisies communes),
 * puis ses outils : le menu des mentions (R196 (2)) et, pour un mot-clé verrouillé, le cadenas (R219 (7)), sinon « Fusionner dans… » et, s'il n'est
 * mentionné nulle part, « Supprimer » ; mentionné, « Forcer la suppression », ou la note qui dit pourquoi le service la refuserait (R223).
 */
function ligneDeGestion(ed, m) {
  const li = document.createElement('li');
  li.className = 'ed-mot-cle';
  // la balise à copier, son aide et la définition telle qu'enregistrée (balises comprises) : telles qu'écrites, jamais rendues (mots-cles-vivants.mjs)
  li.setAttribute('data-mots-cles-bruts', '');
  decrire(li, m);
  const verrouille = estVerrouille(m);
  const balise = document.createElement('code');
  balise.className = 'ed-mot-cle__balise';
  balise.textContent = `{{${m.id}}}`;
  balise.title = `À écrire dans un texte pour citer ce mot-clé (en gras, sa définition en infobulle) ; « {{${m.id}|texte}} » pour un autre texte affiché, « {{${m.id}:}} » pour « Libellé : définition »${m.abreviation ? ` ; « {{${m.abreviation}}} » pour son abréviation` : ''}`;
  // chaque champ, une saisie commune ; vide : NULL (sauf le libellé, requis)
  const champ = (classe, colonne, valeur) => {
    const span = document.createElement('span');
    span.className = classe;
    span.dataset.ed = attributEd('mot_cle', { id: m.id }, colonne);
    span.textContent = valeur ?? '';
    return span;
  };
  const nom = champ('ed-mot-cle__nom', 'libelle', m.libelle);
  // l'abréviation, à côté du libellé
  const abreviation = champ('ed-mot-cle__abreviation', 'abreviation', m.abreviation);
  const compte = document.createElement('span');
  compte.className = 'ed-mot-cle__compte';
  compte.textContent = compteDesElements(m);
  // l'adresse (une balise de ce mot-clé est un lien vers elle) et la couleur
  const lien = champ('ed-mot-cle__lien', 'url', m.url);
  const couleur = champ('ed-mot-cle__couleur', 'couleur', m.couleur);
  const definition = champ('ed-mot-cle__definition', 'description', m.description);
  li.append(balise, nom, abreviation, compte, lien, couleur, definition);
  const outils = document.createElement('span');
  outils.className = 'ed-mot-cle__outils';
  const mentions = menuDesMentions(ed, m);
  if (mentions) outils.append(mentions);
  li.append(outils);
  if (verrouille) {
    li.classList.add('ed-mot-cle--verrouille');
    li.setAttribute('data-verrou', '');
    const cadenas = document.createElement('span');
    cadenas.className = 'ed-mot-cle__verrou';
    cadenas.setAttribute('role', 'img');
    cadenas.setAttribute('aria-label', INFOBULLE_DU_VERROU);
    cadenas.title = INFOBULLE_DU_VERROU;
    cadenas.innerHTML = CADENAS;
    outils.append(cadenas);
    return li;
  }
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
      const note = document.createElement('span');
      note.className = 'ed-mot-cle__sans-forcage';
      note.setAttribute('tabindex', '0'); // l'infobulle s'ouvre aussi au clavier
      note.textContent = 'Suppression forcée impossible';
      note.title = raison;
      outils.append(note);
    }
  }
  return li;
}

/** La liste de gestion (mode modification) : une ligne par mot-clé du vocabulaire, saisies montées par l'éditeur. */
function dessinerLaGestion(ed) {
  const ul = liste();
  if (!ul || !vocabulaire) return;
  // les lignes des saisies : celles du vocabulaire qu'on vient de lire (libellé, écriture, définition et abréviation telles qu'enregistrées : NULL ou texte)
  for (const m of vocabulaire) {
    ed.lignes?.set(cleDeLigne('mot_cle', { id: m.id }), {
      id: m.id, libelle: m.libelle, libelle_cle: m.libelle_cle, description: m.description ?? null, abreviation: m.abreviation ?? null,
      url: m.url ?? null, couleur: m.couleur ?? null,
    });
  }
  ul.setAttribute('data-gestion', '');
  ul.className = 'ed-mots-cles';
  ul.replaceChildren(...vocabulaire.map((m) => ligneDeGestion(ed, m)));
  ed.monterChamps(ul);
  for (const li of ul.querySelectorAll('li[data-verrou]')) verrouiller(li);
  etatDesLignes();
  annoncerLaListe(true);
}

/**
 * Un mot-clé créé : ajouté au vocabulaire et, en mode modification, à sa place dans la liste de gestion ; il n'est pas verrouillé (décision R219 (5)) et
 * rien ne le mentionne encore.
 */
function ajouter(ed, ligne) {
  const m = {
    id: ligne.id, libelle: ligne.libelle, libelle_cle: ligne.libelle_cle, description: ligne.description ?? null, abreviation: ligne.abreviation ?? null,
    url: ligne.url ?? null, couleur: ligne.couleur ?? null, pages: 0, verrou: 0, mentions: [],
  };
  vocabulaire = [...(vocabulaire ?? []).filter((x) => x.id !== m.id), m].sort(parLibelle);
  ed.lignes?.set(cleDeLigne('mot_cle', { id: m.id }), { ...ligne });
  const ul = liste();
  if (!ed.enEdition || !ul?.hasAttribute('data-gestion')) return null;
  const li = ligneDeGestion(ed, m);
  li.classList.add('ed-nouveau');
  const suivant = vocabulaire[vocabulaire.indexOf(m) + 1];
  ul.insertBefore(li, suivant ? ul.querySelector(`li[data-id="${CSS.escape(suivant.id)}"]`) : null);
  ed.monterChamps(li);
  verrouiller(li);
  annoncerLaListe(true);
  return li;
}

export const motsCles = {
  nom: 'mots-cles',
  actif: (doc) => Boolean(doc.querySelector('[data-glossaire]')),

  async surcouche(ed) {
    if ((await relire(ed)) && !ed.enEdition) dessinerLaLecture(ed);
  },

  debut(ed) {
    const n = ++session;
    const outils = document.createElement('div');
    outils.className = 'ed-outils ed-outils-mots-cles';
    const nouveau = bouton('+ Ajouter un mot-clé', 'ed-outil');
    nouveau.addEventListener('click', () =>
      ed.formulaire({
        titre: ENTITES.mot_cle.nouveau,
        aide: 'Le mot-clé est créé tout de suite dans la base du site de dev, sans page qui le porte ; un texte le cite ensuite par sa balise (« {{id}} »).',
        champs: Object.entries(ENTITES.mot_cle.champs).map(([nom, c]) => ({ nom, libelle: c.libelle, type: c.type, requis: c.requis })),
        valider: async (valeurs) => {
          const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'mot_cle', valeurs }] });
          const ligne = r.lignes.find((l) => l.table === 'mot_cle' && l.ligne)?.ligne;
          if (!ligne) return;
          ajouter(ed, ligne)?.scrollIntoView({ block: 'center' });
          definirLeVocabulaire(vocabulaire);
          relire(ed); // la feuille des couleurs du service (un mot-clé créé avec sa couleur)
          ed.annoncer(`Mot-clé créé : ${ligne.libelle} (balise « {{${ligne.id}}} »).`);
        },
      }),
    );
    outils.append(nouveau);
    liste()?.before(outils);
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
    const { erreur, aFusionner } = examinerLesRenommages(vocabulaire, renommages, { retires: retires() });
    if (erreur) return erreur;
    for (const r of aFusionner) {
      const cible = motCle(r.dans);
      const question = `« ${r.libelle} » s’écrit comme « ${cible.libelle} » : fusionner « ${r.avant} » dans « ${cible.libelle} » ?\n`
        + `Ses pages (${compteDesElements(motCle(r.id) ?? {})}) porteront « ${cible.libelle} », puis « ${r.avant} » disparaîtra.`;
      if (!confirm(question)) return `Non enregistré : « ${r.libelle} » s’écrit comme le mot-clé « ${cible.libelle} ». Choisissez une autre écriture, ou acceptez de les fusionner.`;
      renommagesEnFusion.set(r.id, r.dans);
    }
    const question = confirmationDesRetraits(vocabulaire, { suppressions, forcages, fusions });
    if (question && !confirm(question)) return 'Enregistrement annulé : rien n’a été envoyé.';
    return null;
  },

  operations(_ed, operations) {
    return operationsDuVocabulaire(operations, {
      suppressions, forcages, fusions: new Map([...fusions, ...renommagesEnFusion]), vocabulaire: vocabulaire ?? [],
    });
  },

  fin(ed) {
    session += 1;
    suppressions.clear();
    forcages.clear();
    fusions.clear();
    renommagesEnFusion = new Map();
    document.querySelector('.ed-outils-mots-cles')?.remove();
    dessinerLaLecture(ed); // tout de suite, puis avec ce que l'enregistrement a changé
    relire(ed).then((lu) => {
      if (lu && !ed.enEdition) dessinerLaLecture(ed);
    });
  },
};
