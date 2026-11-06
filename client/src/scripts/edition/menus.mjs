// Extension de l'éditeur : les menus latéraux et les pages des Règles (lot de l'édition des menus et des pages ; demandes du propriétaire : « En mode
// Edition il faut prévoir de pouvoir changer l'ordre des menu latéraux (par un glisser déposer) », « En mode Edition il faut prévoir aussi de pouvoir
// ajouter / supprimer une page » ; réponses « Règles + Races », « Oui, par une liste », entrées « bientôt » déplaçables, ordre des onglets fixe,
// « Pages des Règles », « Titre, onglet, résumé », « Refus si citée, puis 404 », pages protégées sans bouton). Sur les pages qui ont un menu latéral
// modifiable (components/guide/MenuLateral.astro, `data-ed-menu` : les quatre onglets des Règles, l'Artisanat, les pages de race) :
//   - chaque entrée reçoit une poignée (src/scripts/edition/glisser.mjs : souris, doigt, clavier) ; une race reste dans son groupe ; « Enregistrer »
//     envoie une opération `ordonner` par menu changé (lib/ordre-des-menus.mjs#operationsDOrdre ; serveur/edition-plan.mjs) ;
//   - sur petit écran, le menu replié s'ouvre le temps du mode modification ;
//   - sous un menu d'onglet, « + Ajouter une page » (titre, onglet présélectionné, résumé, tous obligatoires ; l'adresse /regles/<slug>/ tirée du titre,
//     figée) ; sur une entrée « bientôt », « Créer la page » (son libellé pour titre, son onglet) ; la création est immédiate, puis la page s'ouvre (elle
//     est dessinée sur la 404 tant que le site n'est pas reconstruit : src/scripts/edition/nouvelles.mjs) ;
//   - sous le titre d'une page des Règles : la liste « Onglet » (la page passe en fin du menu de l'autre onglet ; désactivée pour une page d'ouverture)
//     et « Supprimer » (rien d'affiché pour une page PROTÉGÉE, `protection` du plan vivant ; une page citée le garde, son refus donne la liste des
//     textes qui la citent : lib/ordre-des-menus.mjs#boutonSupprimer, décision du leader-technique) ; la suppression part
//     avec « Enregistrer », après confirmation, puis on revient à l'onglet ; un refus (409) liste en liens les pages qui la citent, ou les raisons.
// Le titre d'une page se lit aussi dans le menu (demande du propriétaire : « Changer le titre avec l'édition devrai aussi changer le nom sur le menu
// lattéral ») : une ligne `page` modifiée (en attente au chargement, enregistrée) change le libellé de son entrée et le résumé du menu replié ; pendant
// la saisie du titre de la page affichée, ils le suivent (l'ancien revient si l'on abandonne).
// Avant la reconstruction du site (décision du leader-technique) : une page supprimée sur le site de dev mais encore construite montre un avis à la place
// de son texte, avec un lien vers son onglet ; sur /races/, la liste et le tableau des magies innées suivent l'ordre de la liste du plan vivant, comme
// le menu des races.
// Le plan vivant (GET /api/edition/plan/) redessine les menus : au chargement quand des lignes du plan ont changé depuis la construction (surcouche),
// en passant en mode modification (les identifiants que la page enverra sont ceux de la base), après l'enregistrement.
import { cheminDePage } from '../../lib/metiers.mjs';
import {
  adresseDeLaNouvellePage, adresseDeLaPageCreee, boutonSupprimer, chercherDansLePlan, elementsDuRefus, entreeDeLaPage, entreesDuPlanVivant, htmlDUneEntree,
  lireMenu, operationsDOrdre, ordonnerSelon, pageSupprimeeEnAttente, raceDuLien,
} from '../../lib/ordre-des-menus.mjs';
import { rendreReordonnable } from './glisser.mjs';

const POIGNEE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
/** Les tables dont une ligne en attente peut changer un menu : on relit alors le plan vivant au chargement. */
const TABLES_DU_PLAN = new Set(['regles_onglet_entree', 'race', 'page']);

const etat = {
  generation: 0, // chaque passage en mode modification (et sa fin) : une réponse du plan arrivée trop tard est ignorée
  abandon: null,
  plan: null,
  menus: [], // [{ liste, avant: [{ id, groupe }], initial: [li] }]
  replis: [], // [{ details, open }]
  ajouts: [], // éléments posés par l'extension, retirés à la fin
  page: null, // la page des Règles affichée, d'après le plan : { id, titre, onglet, entree }
  choix: null, // la liste « Onglet »
  supprimer: false,
  envoi: null, // ce que le dernier lot a envoyé : { ordres: [{ liste, ordre }], retour (l'onglet où revenir après une suppression) }
  titre: null, // { id, texte } : le titre de la page affichée au passage en mode modification (rendu au menu si l'on abandonne la saisie)
};

const listesDesMenus = () => [...document.querySelectorAll('ol[data-ed-menu]')];
const pageCourante = () => document.querySelector('[data-ed-corps]')?.dataset.edCorps ?? null;
const entreesDeLaListe = (liste) => [...liste.children].filter((li) => li.dataset.edEntree).map((li) => ({ id: li.dataset.edEntree, groupe: li.dataset.edGroupe }));
const nomDe = (li) => (li.querySelector('.lateral-menu__lien')?.textContent ?? li.querySelector('.lateral-menu__bientot')?.firstChild?.textContent ?? '').trim();
const chargerLePlan = (ed) => ed.appel('GET', 'edition/plan/');

/**
 * Redessine chaque menu latéral de la page d'après le plan vivant : l'ordre, les titres, les pages créées ou supprimées ; un menu d'onglet devient celui
 * de l'onglet où est maintenant la page affichée (changée d'onglet), et le fil d'Ariane le suit. L'entrée affichée reste marquée.
 */
function redessiner(ed, plan) {
  const page = pageCourante() ?? ed.page;
  for (const liste of listesDesMenus()) {
    const menu = lireMenu(liste.dataset.edMenu);
    if (!menu) continue;
    const courantes = new Set([...liste.querySelectorAll('[aria-current="page"]')].map((a) => a.closest('li')?.dataset.edEntree).filter(Boolean));
    let cible = menu;
    if (menu.onglet) {
      const ici = chercherDansLePlan(plan, (e) => e.page_id && e.page_id === page) ?? chercherDansLePlan(plan, (e) => courantes.has(e.id));
      const onglet = ici?.onglet ?? plan.onglets.find((o) => o.id === menu.onglet);
      if (!onglet) continue;
      cible = { onglet: onglet.id };
      if (onglet.id !== menu.onglet) changerDeRubrique(ed, liste, menu.onglet, onglet);
    }
    const entrees = entreesDuPlanVivant(plan, cible);
    if (!entrees.length) continue;
    liste.innerHTML = entrees.map((e) => htmlDUneEntree(e, { base: ed.base, courante: courantes.has(e.id) || (e.page !== null && e.page === page) })).join('');
  }
}

/** Le titre d'une page dans les menus latéraux : le libellé de son entrée, et le résumé du menu replié quand c'est la page affichée. */
function afficherLeTitre(ed, id, titre) {
  if (typeof titre !== 'string' || !titre) return;
  const entree = entreeDeLaPage(id);
  for (const li of document.querySelectorAll('li[data-ed-entree]')) {
    const lien = li.dataset.edEntree === entree ? li.querySelector('.lateral-menu__lien') : null;
    if (lien) lien.textContent = titre;
  }
  if (id === (pageCourante() ?? ed.page)) for (const r of document.querySelectorAll('.lateral-menu__resume-page')) r.textContent = titre;
}

/** Le menu d'une page passée dans un autre onglet : son titre, son lien, son résumé (petit écran), le fil d'Ariane. */
function changerDeRubrique(ed, liste, ancien, onglet) {
  liste.dataset.edMenu = `onglet:${onglet.id}`;
  const nav = liste.closest('.lateral-menu');
  const chemin = `${ed.base}regles/${onglet.id}/`;
  nav?.setAttribute('aria-label', onglet.titre);
  const titre = nav?.querySelector('.lateral-menu__titre a');
  if (titre) Object.assign(titre, { textContent: onglet.titre, href: chemin });
  const resume = nav?.querySelector('.lateral-menu__resume-rubrique');
  if (resume) resume.textContent = onglet.titre;
  for (const a of document.querySelectorAll('.guide-fil a')) {
    if (a.getAttribute('href') === `${ed.base}regles/${ancien}/`) Object.assign(a, { textContent: onglet.titre, href: chemin });
  }
}

// --- Avant la reconstruction : page supprimée, liste des races ------------------------------------------------------------------------------
/** Une page supprimée sur le site de dev, encore construite : un avis à la place de son texte (le fil d'Ariane et le titre restent), lien vers son onglet. */
function avisDeSuppression(ed, plan) {
  const reference = document.querySelector('.guide-reference');
  if (!reference) return;
  const menu = lireMenu(document.querySelector('ol[data-ed-menu]')?.dataset.edMenu);
  const onglet = menu?.onglet ? plan.onglets.find((o) => o.id === menu.onglet) : null;
  const fil = reference.querySelector('.guide-fil');
  const titre = document.createElement('h1');
  titre.id = 'guide-titre';
  titre.textContent = reference.querySelector('#guide-titre')?.textContent.trim() ?? '';
  const avis = document.createElement('p');
  avis.className = 'banner ed-page-supprimee';
  avis.setAttribute('role', 'note');
  avis.append('Page supprimée sur le site de dev : son adresse mènera à la page introuvable à la prochaine construction du site.');
  if (onglet) {
    const lien = document.createElement('a');
    lien.href = `${ed.base}regles/${onglet.id}/`;
    lien.textContent = `Retour à l’onglet « ${onglet.titre} »`;
    avis.append(' ', lien, '.');
  }
  // plus de champ modifiable : la page n'existe plus dans la base du site de dev
  reference.replaceChildren(...[fil, titre, avis].filter(Boolean));
  for (const pied of document.querySelectorAll('.lateral-page > :not(.guide-reference)')) pied.remove();
}

/** /races/ : chaque groupe de pastilles et le tableau des magies innées dans l'ordre de la liste des races du plan vivant (race.rang_liste). */
function ordonnerLaListeDesRaces(plan) {
  if (!document.querySelector('.races-pastilles') || !plan?.races) return;
  const ordre = [...(plan.races.pures ?? []), ...(plan.races.hybrides ?? [])].map((r) => r.id);
  const reordonner = (parent, lien) => {
    const enfants = [...parent.children];
    const idDe = (el) => raceDuLien(el.querySelector(lien)?.getAttribute('href'));
    for (const el of ordonnerSelon(enfants, ordre, idDe)) parent.append(el);
  };
  for (const liste of document.querySelectorAll('.races-groupe__liste')) reordonner(liste, 'a.race-pastille');
  for (const corps of document.querySelectorAll('.tableau-magies--innees tbody')) reordonner(corps, '.tableau-magies__nom a');
}

// --- Créer une page ---------------------------------------------------------------------------------------------------------------------------
/** Après la création : la page, à son adresse (dessinée sur la 404 jusqu'à la prochaine construction du site). */
function allerALaPage(ed, r) {
  const id = r.crees?.find((c) => c.entite === 'page_des_regles')?.id ?? r.crees?.[0]?.id;
  const adresse = adresseDeLaPageCreee(id);
  if (adresse) location.assign(`${ed.base}${adresse}`);
}

/** L'aide du titre : l'adresse que la page prendra. */
const aideDeLAdresse = (ed, titre) => {
  const adresse = adresseDeLaNouvellePage(titre);
  return adresse
    ? `Adresse : ${ed.base}${adresse}, tirée du titre ; elle ne changera plus (suffixée -2, -3… si elle est déjà prise).`
    : 'L’adresse sera tirée du titre (/regles/<titre>/) et ne changera plus.';
};

function creerUnePage(ed, ongletId) {
  const dialogue = ed.formulaire({
    titre: 'Nouvelle page des Règles',
    aide: 'La page est créée tout de suite dans la base du site de dev, en fin du menu de l’onglet choisi, avec le texte « À compléter. » ; '
      + 'elle s’ouvre ensuite pour l’écrire (crayon). Aucune source à saisir.',
    champs: [
      { nom: 'titre', libelle: 'Titre', type: 'ligne', requis: true, aide: aideDeLAdresse(ed, '') },
      { nom: 'onglet_id', libelle: 'Onglet', type: 'choix', requis: true, liste: 'onglets', valeur: ongletId },
      { nom: 'resume', libelle: 'Résumé', type: 'ligne', requis: true, aide: 'Une phrase, montrée par les sommaires et la recherche.' },
    ],
    valider: async (v) => {
      const valeurs = { titre: v.titre.trim(), onglet_id: v.onglet_id, resume: v.resume.trim() };
      if (!valeurs.titre || !valeurs.onglet_id || !valeurs.resume) throw new Error('Le titre, l’onglet et le résumé sont obligatoires.');
      allerALaPage(ed, await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'page_des_regles', valeurs }] }));
    },
  });
  const titre = dialogue.querySelector('[name="titre"]');
  const aide = titre?.closest('label')?.querySelector('.ed-aide');
  titre?.addEventListener('input', () => {
    if (aide) aide.textContent = aideDeLAdresse(ed, titre.value);
  });
}

function remplirLEntree(ed, li) {
  const trouve = chercherDansLePlan(etat.plan, (e) => e.id === li.dataset.edEntree);
  if (!trouve) return;
  const { onglet, entree } = trouve;
  ed.formulaire({
    titre: `Créer la page « ${entree.libelle} »`,
    aide: `Titre : « ${entree.libelle} » (le libellé de l’entrée) ; onglet : « ${onglet.titre} ». La page prend la place de l’entrée dans le menu, avec le texte `
      + `« À compléter. », et s’ouvre ensuite pour l’écrire (crayon). ${aideDeLAdresse(ed, entree.libelle)}`,
    champs: [{ nom: 'resume', libelle: 'Résumé', type: 'ligne', requis: true, aide: 'Une phrase, montrée par les sommaires et la recherche.' }],
    bouton: 'Créer la page',
    valider: async (v) => {
      const resume = v.resume.trim();
      if (!resume) throw new Error('Le résumé est obligatoire.');
      const valeurs = { titre: entree.libelle, onglet_id: onglet.id, resume, bientot: entree.id };
      allerALaPage(ed, await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'page_des_regles', valeurs }] }));
    },
  });
}

// --- Outils du mode modification -------------------------------------------------------------------------------------------------------------
function poser(el) {
  etat.ajouts.push(el);
  return el;
}

function outilsDesMenus(ed) {
  const { signal } = etat.abandon;
  const annonce = poser(document.createElement('p'));
  annonce.className = 'ed-annonce-menu';
  annonce.setAttribute('aria-live', 'polite');
  document.body.append(annonce);
  for (const liste of listesDesMenus()) {
    const menu = lireMenu(liste.dataset.edMenu);
    if (!menu) continue;
    etat.menus.push({ liste, avant: entreesDeLaListe(liste), initial: [...liste.children] });
    liste.classList.add('ed-menu-modifiable');
    for (const li of liste.children) {
      if (!li.dataset.edEntree) continue;
      const poignee = document.createElement('button');
      poignee.type = 'button';
      poignee.className = 'ed-poignee';
      poignee.innerHTML = POIGNEE;
      const nom = nomDe(li);
      poignee.title = 'Glisser pour déplacer (ou flèches haut et bas, Début, Fin)';
      poignee.setAttribute('aria-label', `Déplacer « ${nom} »${li.dataset.edGroupe ? ` dans les races ${li.dataset.edGroupe}` : ''} : flèches haut et bas, Début, Fin`);
      li.prepend(poignee);
      if (menu.onglet && li.dataset.edEntree.startsWith('bientot:')) {
        const creer = document.createElement('button');
        creer.type = 'button';
        creer.className = 'ed-outil ed-creer-bientot';
        creer.textContent = 'Créer la page';
        creer.setAttribute('aria-label', `Créer la page « ${nom} »`);
        creer.addEventListener('click', () => remplirLEntree(ed, li), { signal });
        li.append(creer);
      }
    }
    rendreReordonnable(liste, { poignee: '.ed-poignee', nomDe, groupeDe: (li) => li.dataset.edGroupe, annonce, apres: () => ed.marquerModifie(), signal });
    if (menu.onglet) {
      const outils = poser(document.createElement('div'));
      outils.className = 'ed-outils ed-ajout-page';
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'ed-outil';
      bouton.textContent = '+ Ajouter une page';
      // l'onglet présélectionné : celui du menu au moment du clic (la page a pu changer d'onglet depuis)
      bouton.addEventListener('click', () => creerUnePage(ed, lireMenu(liste.dataset.edMenu)?.onglet ?? menu.onglet), { signal });
      outils.append(bouton);
      liste.after(outils);
    }
  }
}

/** Sous le titre d'une page des Règles : la liste « Onglet » et, si le service la laisse supprimer, « Supprimer ». */
function outilsDeLaPage(ed) {
  const id = pageCourante();
  const ici = id ? chercherDansLePlan(etat.plan, (e) => e.page_id === id) : null;
  const titre = document.querySelector('#guide-titre');
  if (!ici || !titre) return;
  const { onglet, entree } = ici;
  etat.page = { id, titre: entree.titre, onglet: onglet.id, entree: entree.id };
  const bloc = poser(document.createElement('div'));
  bloc.className = 'ed-page-regles';
  const { signal } = etat.abandon;

  const label = document.createElement('label');
  label.className = 'ed-page-regles__onglet';
  const libelle = document.createElement('span');
  libelle.className = 'ed-libelle';
  libelle.textContent = 'Onglet';
  const choix = document.createElement('select');
  choix.className = 'ed-saisie';
  for (const o of etat.plan.onglets) choix.append(new Option(o.titre, o.id));
  choix.value = onglet.id;
  const aide = document.createElement('small');
  aide.className = 'ed-aide';
  const ouvre = etat.plan.onglets.find((o) => o.ouverture === id);
  if (ouvre) {
    choix.disabled = true;
    aide.textContent = `Page d’ouverture de l’onglet « ${ouvre.titre} » : elle ne change pas d’onglet.`;
  } else {
    aide.textContent = 'Changer d’onglet met la page en fin du menu de l’autre onglet ; son adresse ne change pas.';
  }
  choix.addEventListener('change', () => {
    choix.classList.toggle('ed-modifiee', choix.value !== onglet.id);
    ed.marquerModifie();
  }, { signal });
  label.append(libelle, choix, aide);
  bloc.append(label);
  etat.choix = choix;

  if (boutonSupprimer(entree)) {
    const supprimer = document.createElement('button');
    supprimer.type = 'button';
    supprimer.className = 'ed-outil ed-outil--danger';
    const montrer = () => {
      supprimer.setAttribute('aria-pressed', String(etat.supprimer));
      supprimer.textContent = etat.supprimer ? 'Supprimée à l’enregistrement (annuler)' : 'Supprimer la page';
      bloc.classList.toggle('ed-supprime', etat.supprimer);
    };
    supprimer.addEventListener('click', () => {
      etat.supprimer = !etat.supprimer;
      montrer();
      ed.marquerModifie();
    }, { signal });
    montrer();
    bloc.append(supprimer);
  }
  (document.querySelector('.ed-resume-page') ?? titre).after(bloc);
}

/** Un refus du service (409) d'une suppression : le message, puis les pages qui citent la page (en liens) ou les raisons qui la protègent. */
function refusEnListe(ed, e) {
  const elements = elementsDuRefus(e.corps);
  if (!elements.length) return null;
  const titre = etat.page?.titre ?? e.corps?.page ?? '';
  const message = document.createDocumentFragment();
  message.append(Array.isArray(e.corps?.raisons) && e.corps.raisons.length
    ? `Non enregistré : « ${titre} » ne se supprime pas :`
    : `Non enregistré : « ${titre} » est citée par ces textes ; retirez d’abord leurs liens vers elle :`);
  const liste = document.createElement('ul');
  liste.className = 'ed-refus';
  for (const el of elements) {
    const li = document.createElement('li');
    if (el.page) {
      const a = document.createElement('a');
      a.href = `${ed.base}${cheminDePage(el.page)}`;
      a.textContent = el.texte;
      li.append(a);
    } else {
      li.textContent = el.texte;
    }
    liste.append(li);
  }
  message.append(liste);
  return message;
}

// --- Extension --------------------------------------------------------------------------------------------------------------------------------
export const menus = {
  nom: 'menus',
  actif: (doc) => Boolean(doc.querySelector('ol[data-ed-menu], .races-pastilles')),

  /** Des lignes du plan ont changé depuis la construction de la page : les menus redessinés d'après le plan vivant. */
  async surcouche(ed, lignes) {
    if (!lignes.some((l) => TABLES_DU_PLAN.has(l.table))) return;
    let plan;
    try {
      plan = await chargerLePlan(ed);
    } catch {
      return; // le plan vivant illisible : les menus construits restent
    }
    const id = pageCourante();
    if (pageSupprimeeEnAttente(lignes, id)) avisDeSuppression(ed, plan);
    redessiner(ed, plan);
    ordonnerLaListeDesRaces(plan);
  },

  /** Une ligne `page` affichée (en attente au chargement, ou enregistrée) : son titre dans les menus. */
  ligne(ed, table, cle, ligne) {
    if (table === 'page' && ligne && cle?.id) afficherLeTitre(ed, cle.id, ligne.titre);
  },

  debut(ed) {
    // /races/ (la liste) : rien à modifier ici, seule la surcouche la réordonne
    if (!listesDesMenus().length) return;
    const generation = ++etat.generation;
    etat.abandon = new AbortController();
    // le titre en cours de saisie de la page affichée : le menu le suit
    const id = pageCourante();
    const saisie = id ? document.querySelector('#guide-titre [data-ed] .ed-saisie') : null;
    if (saisie) {
      etat.titre = { id, texte: saisie.value };
      saisie.addEventListener('input', () => afficherLeTitre(ed, id, saisie.value.trim() || etat.titre.texte), { signal: etat.abandon.signal });
    }
    // petit écran : le menu replié s'ouvre le temps du mode modification (MenuLateral.astro le replie au chargement)
    for (const details of document.querySelectorAll('[data-lateral-repli]')) {
      etat.replis.push({ details, open: details.open });
      details.open = true;
    }
    // les identifiants envoyés sont ceux de la base : les menus redessinés d'après le plan vivant, puis leurs outils
    chargerLePlan(ed).then((plan) => {
      if (generation !== etat.generation || !ed.enEdition) return;
      etat.plan = plan;
      redessiner(ed, plan);
      outilsDesMenus(ed);
      outilsDeLaPage(ed);
    }).catch((e) => {
      if (generation === etat.generation) ed.annoncer(`Les menus ne peuvent pas être modifiés : le plan n’a pas pu être lu (${e.message}).`, 'erreur');
    });
  },

  verifier(ed) {
    if (!etat.supprimer || !etat.page) return null;
    if (confirm(`Supprimer la page « ${etat.page.titre} » ? Son entrée quitte le menu et son adresse mènera à la page introuvable.`)) return null;
    return 'Rien n’est enregistré : la page n’est pas supprimée (le bouton « Supprimée à l’enregistrement » annule la demande).';
  },

  operations(ed, operations) {
    etat.envoi = null;
    if (!etat.plan) return operations;
    const ajout = operationsDOrdre(etat.menus.map(({ liste, avant }) => ({ menu: liste.dataset.edMenu, avant, apres: entreesDeLaListe(liste) })));
    const envoi = { ordres: ajout.length ? etat.menus.map(({ liste }) => ({ liste, ordre: [...liste.children] })) : [], retour: null };
    if (etat.page && etat.supprimer) {
      ajout.push({ op: 'supprimer', entite: 'page_des_regles', cle: { id: etat.page.id } });
      envoi.retour = etat.page.onglet;
    } else if (etat.page && etat.choix && !etat.choix.disabled && etat.choix.value !== etat.page.onglet) {
      ajout.push({ op: 'modifier', table: 'regles_onglet_entree', cle: { id: etat.page.entree }, valeurs: { onglet_id: etat.choix.value }, avant: { onglet_id: etat.page.onglet } });
    }
    if (!ajout.length) return operations;
    etat.envoi = envoi;
    return [...operations, ...ajout];
  },

  /** Un refus 409 d'une suppression : les pages qui citent la page, en liens, ou les raisons qui la protègent (editeur.mjs l'affiche). */
  refus(ed, e) {
    return e.statut === 409 && (e.corps?.citations || e.corps?.raisons) ? refusEnListe(ed, e) : null;
  },

  fin(ed) {
    etat.generation += 1;
    etat.abandon?.abort();
    for (const el of etat.ajouts) el.remove();
    for (const { liste, initial } of etat.menus) {
      for (const x of liste.querySelectorAll('.ed-poignee, .ed-creer-bientot')) x.remove();
      // abandon : l'ordre d'avant revient ; enregistrement : apresEnregistrement remet l'ordre envoyé, puis le plan vivant
      for (const li of initial) liste.append(li);
      liste.classList.remove('ed-menu-modifiable');
    }
    for (const { details, open } of etat.replis) details.open = open;
    // le titre d'avant la saisie (abandon) ; enregistré, la ligne renvoyée le réécrit aussitôt (ligne)
    if (etat.titre) afficherLeTitre(ed, etat.titre.id, etat.titre.texte);
    Object.assign(etat, { abandon: null, plan: null, menus: [], replis: [], ajouts: [], page: null, choix: null, supprimer: false, titre: null });
  },

  apresEnregistrement(ed) {
    const envoi = etat.envoi;
    etat.envoi = null;
    if (!envoi) return;
    // la page supprimée : son onglet (son adresse mène maintenant à la page introuvable)
    if (envoi.retour) {
      location.assign(`${ed.base}regles/${envoi.retour}/`);
      return;
    }
    for (const { liste, ordre } of envoi.ordres) for (const li of ordre) liste.append(li);
    chargerLePlan(ed).then((plan) => {
      if (!ed.enEdition) redessiner(ed, plan);
    }).catch(() => {});
  },
};
