// Extension de l'éditeur pour l'onglet Armes de /ressources/equipement/ (components/armes/ArmesPage.astro) — demandes du propriétaire : « tout peut
// être éditable à l'instar des autres pages qui peuvent l'être. Quand le mode Edition est lancé, il n'est pas possible de "sélectionner" une arme /
// matériau / amélioration, mais tous les tableaux sont visibles » ; « Fais donc la possibilité de créer / supprimer des armes » ; puis, avec les deux
// menus à onglets (2026-10-23) : « Je veux les onglets aussi. (mais la possibilité de changer le nom et leur dés, ou même de créer un nouvel onglet donc
// un nouveau tableau si besoin » (décision R159), qui remplace pour l'affichage en onglets « tous les tableaux sont visibles ».
//   - en mode modification : les tableaux repliables du panneau de côté s'ouvrent (matériaux, améliorations) et la fiche de l'arme se vide
//     (styles/armes/armes.css cache la fiche et montre les colonnes `ed-seul` ; le script de la page ignore les clics) ; les onglets des familles restent
//     affichés, un panneau ouvert par menu, et le titre de la famille ouverte se montre au-dessus de son tableau (styles/armes/armes.css) ;
//   - une famille (R159) : son nom et son dé (titre du tableau) et l'en-tête de sa colonne de coût sont des champs communs (`data-ed`,
//     components/armes/TableauArmes.astro), que son onglet suit (`data-ed-lecture`) ; « + Nouvelle famille », sous la barre de chaque menu (hors de la
//     liste d'onglets), crée une famille de la catégorie de ce menu (`data-armes-bloc`, jamais changée ensuite) : nom, dé, en-tête de coût, enregistrée
//     tout de suite (POST /api/edition/, opération creer ; un refus 400 ou 409 s'affiche tel quel dans le formulaire). Son onglet et son tableau vide
//     sont les modèles de la page (`<template data-armes-modele>`, lib/armes-rendu.mjs#htmlDeFamilleDepuisModele), insérés à chaud : l'onglet à la fin
//     de la barre (rebranchée par « onglets:brancher », components/Onglets.astro), le tableau après le dernier de son menu ; il s'ouvre, la famille entre
//     dans la liste du formulaire « Nouvelle arme » (`ed.listes.famillesDArmes`) ; pas de suppression ;
//   - ajouter : formulaire « Nouvelle arme » (famille, nom, compétence, type, effet…), enregistré tout de suite (POST /api/edition/, opération creer) ; sa
//     ligne s'ajoute à la fin du tableau de sa famille (lib/armes-rendu.mjs#htmlDeLigneDArme, le HTML de la page construite) et la page défile
//     jusqu'à elle ; l'onglet de sa famille s'ouvre aussi (évènement « onglets:ouvrir » de components/Onglets.astro) ;
//   - supprimer : bouton sur chaque ligne ; la suppression part avec le bouton de confirmation (une fiche de personnage qui a l'arme la perd, avec une
//     note datée : décision R52, annonce de l'éditeur) ;
//   - au chargement, une famille créée depuis la construction du site apparaît (avant ses armes), une arme créée ou supprimée apparaît ou disparaît
//     (lignes en attente) ;
//   - une arme enregistrée : sa ligne suit la case « Arme de départ » (fond bleu, infobulle) et sa description (infobulle du nom) ; une famille
//     enregistrée : la pastille de son dé dans l'onglet, son coût « à l'unité » (`data-unite`, lu par la fiche) et son nom dans la liste des familles ;
//   - à chaque étape, l'évènement « armes:rafraichir » redemande au script de la page la fiche ouverte et le filtre (aucun module partagé
//     entre les deux scripts).
import { cleDeLigne, ENTITES } from '../../lib/edition-modele.mjs';
import { htmlDeFamilleDepuisModele, htmlDeLigneDArme } from '../../lib/armes-rendu.mjs';

const rafraichir = () => document.dispatchEvent(new CustomEvent('armes:rafraichir'));
const ligneDe = (id) => document.querySelector(`tr.arme[data-arme="${CSS.escape(id)}"]`);
const supprimees = new Set();

/** Le nombre d'armes affiché en tête de la famille d'une ligne, et dans son onglet (components/armes/ArmesPage.astro : `onglet-famille-<id>`). */
function recompter(famille) {
  if (!famille) return;
  const n = famille.querySelectorAll('tbody tr.arme').length;
  const texte = `${n} arme${n > 1 ? 's' : ''}`;
  for (const c of [famille.querySelector('.armes-famille__compte'), document.getElementById(`onglet-${famille.id}`)?.querySelector('[data-armes-onglet-compte]')]) {
    if (c) c.textContent = texte;
  }
}

/**
 * Les lignes d'une arme que la page n'a pas (la sienne et celle de ses effets : lib/armes-rendu.mjs#htmlDeLigneDArme), ajoutées à la fin du tableau de
 * sa famille (rien si la famille n'est pas sur la page) ; rend la ligne de l'arme.
 */
function ajouter(ed, ligne) {
  if (ligneDe(ligne.id)) return ligneDe(ligne.id);
  const famille = document.getElementById(`famille-${ligne.famille_id}`);
  const corps = famille?.querySelector('tbody');
  if (!corps) return null;
  corps.insertAdjacentHTML('beforeend', htmlDeLigneDArme(ligne, ed.listes));
  const tr = ligneDe(ligne.id);
  tr?.classList.add('ed-nouveau');
  recompter(famille);
  return tr;
}

/**
 * L'onglet et le tableau (vide) d'une famille que la page n'a pas (créée en mode modification, ou depuis la construction : décision R159), tirés des
 * modèles de la page (`<template data-armes-modele>`) : l'onglet à la fin de la barre du menu de sa catégorie, rebranchée (« onglets:brancher »), le
 * tableau après le dernier de ce menu ; la famille entre dans la liste du formulaire « Nouvelle arme ». Rend son tableau (null sans menu ni modèle).
 */
function ajouterFamille(ed, famille) {
  const deja = document.getElementById(`famille-${famille.id}`);
  if (deja) return deja;
  const bloc = document.querySelector(`[data-armes-bloc="${CSS.escape(famille.categorie ?? '')}"]`);
  const barre = bloc?.querySelector('.armes-onglets');
  const modele = (nom) => document.querySelector(`template[data-armes-modele="${nom}"]`)?.innerHTML ?? '';
  const onglet = modele('onglet');
  const tableau = modele('famille');
  if (!barre || !onglet || !tableau) return null;
  barre.insertAdjacentHTML('beforeend', htmlDeFamilleDepuisModele(onglet, famille));
  const derniere = [...bloc.querySelectorAll(':scope > .armes-famille')].at(-1);
  if (derniere) derniere.insertAdjacentHTML('afterend', htmlDeFamilleDepuisModele(tableau, famille));
  else bloc.insertAdjacentHTML('beforeend', htmlDeFamilleDepuisModele(tableau, famille));
  barre.dispatchEvent(new CustomEvent('onglets:brancher', { bubbles: true }));
  const liste = (ed.listes.famillesDArmes ??= []);
  if (!liste.some((f) => f.valeur === famille.id)) liste.push({ valeur: famille.id, libelle: famille.nom, categorie: famille.categorie });
  return document.getElementById(`famille-${famille.id}`);
}

/** Une famille enregistrée (R159) : la pastille de son dé dans l'onglet (cachée si vide), son coût « à l'unité » et son nom dans la liste des familles. */
function suivreLaFamille(ed, id, ligne) {
  const de = document.getElementById(`onglet-famille-${id}`)?.querySelector('.armes-onglets__de');
  if (de) de.hidden = !ligne.de_brut;
  const tableau = document.getElementById(`famille-${id}`);
  if (tableau) {
    if (String(ligne.cout_libelle ?? '').includes('(unité)')) tableau.dataset.unite = '1';
    else delete tableau.dataset.unite;
  }
  const choix = ed.listes?.famillesDArmes?.find((f) => f.valeur === id);
  if (choix) choix.libelle = ligne.nom;
}

/** « + Nouvelle famille » sous la barre d'un menu (hors de la liste d'onglets) : la catégorie est celle du menu, fixée à la création (R159). */
function boutonNouvelleFamille(ed, bloc) {
  const barre = bloc.querySelector(':scope > .armes-onglets');
  if (!barre || bloc.querySelector(':scope > .armes-nouvelle-famille')) return;
  const categorie = bloc.dataset.armesBloc;
  const titre = bloc.querySelector('.armes-bloc__titre')?.textContent.trim() ?? '';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ed-outil armes-nouvelle-famille';
  bouton.textContent = '+ Nouvelle famille';
  bouton.title = `Créer une famille d’armes (un onglet et son tableau) dans « ${titre} » ; sa catégorie ne change plus ensuite`;
  bouton.addEventListener('click', () =>
    ed.formulaire({
      titre: `Nouvelle famille : ${titre}`,
      aide: `La famille est créée tout de suite dans la base du site de dev, à la fin de « ${titre} », avec son onglet et un tableau vide ; sa catégorie ne change plus ensuite (décision R159). Son nom, son dé et l’en-tête de son coût se modifient ensuite dans l’en-tête de son tableau.`,
      champs: champsDeFamille(),
      valider: async (valeurs) => {
        const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'arme_famille', valeurs: { ...valeurs, categorie } }] });
        const famille = r.lignes.find((l) => l.table === 'arme_famille' && l.ligne)?.ligne;
        if (!famille) return;
        const tableau = ajouterFamille(ed, famille);
        if (!tableau) return;
        ed.lignes?.set(cleDeLigne('arme_famille', { id: famille.id }), famille);
        if (ed.enEdition) ed.monterChamps(tableau);
        // son onglet s'ouvre (tous les niveaux) : on peut y créer une arme
        tableau.dispatchEvent(new CustomEvent('onglets:ouvrir', { bubbles: true }));
        rafraichir();
        ed.annoncer(`Famille créée : ${famille.nom}.`);
      },
    }),
  );
  barre.after(bouton);
}

/** Champs du formulaire « Nouvelle famille » (ENTITES.arme_famille, sans la catégorie : celle du menu). */
const champsDeFamille = () =>
  Object.entries(ENTITES.arme_famille.champs)
    .filter(([c]) => c !== 'categorie')
    .map(([c, champ]) => ({ nom: c, libelle: champ.libelle, type: champ.type, requis: champ.requis, valeur: '', ...(champ.choix ? { choix: champ.choix } : {}) }));

function retirer(id) {
  const tr = ligneDe(id);
  if (!tr) return;
  const famille = tr.closest('.armes-famille');
  if (tr.nextElementSibling?.classList.contains('arme-suite')) tr.nextElementSibling.remove();
  tr.remove();
  recompter(famille);
}

function boutonSupprimer(tr) {
  const cellule = tr.querySelector('.arme__nom');
  if (!cellule || cellule.querySelector('.ed-supprimer')) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'ed-outil ed-outil--danger ed-supprimer';
  bouton.textContent = 'Supprimer';
  bouton.setAttribute('aria-pressed', 'false');
  // R52 (comme R42) : les fiches qui l'ont la perdent, avec une note datée ; elles sont annoncées après l'enregistrement (editeur.mjs, annonceDesFiches)
  bouton.title = 'Supprimer cette arme (à l’enregistrement) ; une fiche de personnage qui l’a la perdra, avec une note datée';
  bouton.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = tr.dataset.arme;
    const oui = !supprimees.has(id);
    if (oui) supprimees.add(id);
    else supprimees.delete(id);
    bouton.setAttribute('aria-pressed', String(oui));
    bouton.textContent = oui ? 'Sera supprimée — annuler' : 'Supprimer';
    tr.classList.toggle('ed-supprime', oui);
  });
  cellule.append(bouton);
}

/** Champs du formulaire « Nouvelle arme » ; un champ « choix » prend sa liste du service (ed.listes) ; une arme n'est pas d'office arme de départ. */
const champsDeCreation = (ed) =>
  Object.entries(ENTITES.arme.champs).map(([c, champ]) => ({
    nom: c, libelle: champ.libelle, type: champ.type, requis: champ.requis, valeur: c === 'depart_possible' ? '0' : '',
    ...(champ.type === 'choix' ? { choix: champ.choix ?? ed.listes?.[champ.liste] ?? [] } : {}),
  }));

export const armes = {
  nom: 'armes',
  actif: (doc) => Boolean(doc.querySelector('[data-armes]')),

  surcouche(ed, lignes) {
    // les familles créées depuis la construction du site, avant leurs armes (R159)
    for (const l of lignes) if (l.table === 'arme_famille' && l.creee && l.ligne) ajouterFamille(ed, l.ligne);
    for (const l of lignes) {
      if (l.table !== 'arme') continue;
      if (l.ligne) ajouter(ed, l.ligne);
      else retirer(l.cle.id);
    }
  },

  ligne(ed, table, cle, ligne) {
    if (table === 'arme_famille' && ligne) suivreLaFamille(ed, cle.id, ligne);
    if (table === 'arme') {
      if (!ligne) retirer(cle.id);
      const tr = ligne && ligneDe(cle.id);
      if (tr) {
        const depart = Number(ligne.depart_possible) === 1;
        tr.classList.toggle('arme--depart', depart);
        // `title` vide pour retirer une infobulle (components/Infobulles.astro a déplacé l'attribut : un removeAttribute ne l'efface pas)
        tr.title = depart ? 'Arme de départ' : '';
        const nom = tr.querySelector('.arme__choisir');
        if (nom) nom.title = ligne.description || '';
      }
    }
    if (['arme', 'arme_famille', 'ressource', 'materiau_arme', 'amelioration_equipement'].includes(table)) rafraichir();
  },

  debut(ed) {
    // les tableaux repliables qui restent (matériaux, améliorations : les familles sont des panneaux d'onglets, qui ne se replient pas) ; le panneau de
    // règles : son extension l'ouvre et le referme (edition/panneaux.mjs)
    for (const d of document.querySelectorAll('[data-armes] details')) {
      if (!d.classList.contains('preg')) d.open = true;
    }
    const outils = document.createElement('div');
    outils.className = 'ed-outils ed-outils-armes';
    const ajouterBouton = document.createElement('button');
    ajouterBouton.type = 'button';
    ajouterBouton.className = 'ed-outil';
    ajouterBouton.textContent = '+ Ajouter une arme';
    ajouterBouton.addEventListener('click', () =>
      ed.formulaire({
        titre: 'Nouvelle arme',
        aide: 'L’arme est créée tout de suite dans la base du site de dev, à la fin du tableau de sa famille ; ses colonnes (dégâts, portée, solidité, origine…) sont tirées de son effet, comme celles des autres armes.',
        champs: champsDeCreation(ed),
        valider: async (valeurs) => {
          const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'arme', valeurs }] });
          const arme = r.lignes.find((l) => l.table === 'arme' && l.ligne)?.ligne;
          if (!arme) return;
          const tr = ajouter(ed, arme);
          if (!tr) return;
          ed.lignes?.set(cleDeLigne('arme', { id: arme.id }), arme);
          if (ed.enEdition) {
            ed.monterChamps(tr);
            boutonSupprimer(tr);
          }
          // l'onglet de sa famille (et celui de la page)
          tr.closest('.armes-famille')?.dispatchEvent(new CustomEvent('onglets:ouvrir', { bubbles: true }));
          tr.scrollIntoView({ block: 'center' });
          ed.annoncer(`Arme créée : ${arme.nom}.`);
        },
      }),
    );
    outils.append(ajouterBouton);
    document.querySelector('[data-armes] .armes-vue')?.before(outils);
    for (const bloc of document.querySelectorAll('[data-armes] [data-armes-bloc]')) boutonNouvelleFamille(ed, bloc);
    for (const tr of document.querySelectorAll('[data-armes] tr.arme')) boutonSupprimer(tr);
    rafraichir();
  },

  operations(_ed, operations) {
    if (!supprimees.size) return operations;
    const garde = operations.filter((op) => !(op.table === 'arme' && supprimees.has(op.cle?.id)));
    return [...garde, ...[...supprimees].map((id) => ({ op: 'supprimer', entite: 'arme', cle: { id } }))];
  },

  apresEnregistrement: () => rafraichir(),

  fin() {
    document.querySelector('.ed-outils-armes')?.remove();
    for (const b of document.querySelectorAll('[data-armes] .armes-nouvelle-famille')) b.remove();
    for (const b of document.querySelectorAll('[data-armes] .ed-supprimer')) b.remove();
    for (const t of document.querySelectorAll('[data-armes] tr.ed-supprime')) t.classList.remove('ed-supprime');
    supprimees.clear();
    rafraichir();
  },
};
