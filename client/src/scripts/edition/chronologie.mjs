// Extension de l'éditeur : la chronologie (demandes du propriétaire, 2026-10-14 : « J'aimerais que la page puisse être modifiée. Comme pour le guide ou les
// autres pages modifiables. Il faut pouvoir supprimer une page, ou en créer une nouvelle, lui attribuant une date » ; chaque entrée a une date, un titre,
// une description et un lien ; « On peut choisir plusieurs catégories pour chaque entrée […]. Le mode édition ajoute un bouton pour pouvoir créer, modifier
// et supprimer une catégorie. Une catégorie supprimée la retire de l'entrée »). Service : serveur/edition-chronologie.mjs.
//   - mode modification d'un événement : date, titre, Impact et lieu sont des champs communs (`data-ed` de ChronologieEvenement.astro) ; chaque
//     description (bloc) se modifie en place, comme le texte du guide (texte-en-place.mjs : gras, italique, barré, listes, liens), avec sous elle son lien
//     (une page du wiki, ou aucun) et « Retirer cette description » ; « + Ajouter une description » ; les catégories en cases à cocher ; « Supprimer cet
//     événement » (à l'enregistrement, après confirmation) ;
//   - partout, en mode modification : « + Nouvel événement » (date, titre, description, lien, catégories), créé tout de suite ; « Catégories » : la liste
//     des catégories (renommer, supprimer, ajouter), enregistrée d'un bloc à part (une catégorie supprimée quitte ses événements, après confirmation) ;
//   - surcouche (le site construit est en retard sur le site de dev) : la frise est refaite d'après la base vivante (événements créés, supprimés,
//     déplacés par leur date, titres, catégories, choix du filtre), et l'événement affiché aussi (catégories, descriptions) ; un événement créé depuis la
//     construction n'a pas de page : il s'affiche sur /chronologie/?evenement=<id> (la page 404 de /chronologie/<id>/ y renvoie : nouvelles.mjs).
// Le script de la frise (Frise.astro) et celui des chevrons (Chronologie.astro) suivent par l'évènement « chronologie:frise-changee ».
// Couleurs (skill ui-couleurs) : un événement créé ou supprimé décale toutes les teintes ; la feuille des classes de la page (`<style
// data-couleurs-chronologie>`, Chronologie.astro) est réécrite d'après la base vivante (lib/chronologie-couleurs.mjs, lib/palette-css.mjs, que l'éditeur
// peut importer : hors version portable), puis les classes sont posées (ligne, barre, morceau de barre, `.chrono`), jamais une couleur en style.
import { dateCourte, LIBELLE_SANS_CATEGORIE, libelleDeDate, operationsDesCategories, PORTEES, SANS_CATEGORIE } from '../../lib/chronologie.mjs';
import { couleursDesEvenements } from '../../lib/chronologie-couleurs.mjs';
import { choixDuFiltre } from '../../lib/chronologie-db.mjs';
import { htmlDesBlocs, htmlDesCategories } from '../../lib/chronologie-rendu.mjs';
import { attributEd, ENTITES } from '../../lib/edition-modele.mjs';
import { echapperHtml } from '../../lib/edition-rendu.mjs';
import { arbreDuDom, versMarkdown } from '../../lib/markdown-edition.mjs';
import { cheminDePage } from '../../lib/metiers.mjs';
import { classeDEvenement, cssDesEvenements } from '../../lib/palette-css.mjs';
import { editeurEnPlace, libelleDePage, outilsDesMotsCles, pageChoisie, pagesDuWiki } from './texte-en-place.mjs';

const etat = {
  id: null, // l'événement affiché
  donnees: null, // sa ligne, ses blocs et ses catégories dans la base vivante (POST /api/edition/evenement/), lus au passage en mode modification
  blocs: [], // [{ el, rang, initial, lien: { el, valeur }, retire }]
  categories: null, // { zone, lire, avant } : les cases des catégories de l'événement affiché
  supprimer: false,
  abandon: null,
  barre: null,
  ajouts: [], // éléments posés par l'extension en mode modification, retirés à la fin
  sauvegarde: null, // HTML des catégories et des descriptions au passage en mode modification (rendu si l'on abandonne ; les champs communs, eux, sont
  // remis par l'éditeur)
  pages: [],
  vivante: null, // la chronologie vivante (GET /api/edition/chronologie/) de la dernière surcouche
  ecritTout: false, // la base a déjà changé pendant la session (description ajoutée, catégories) : à la sortie, la page est relue, pas remise
};

const idAffiche = () => document.querySelector('[data-chrono-evenement]')?.dataset.chronoEvenement ?? null;
const base = (ed) => (ed.base || '/').replace(/\/?$/, '/');
/** L'adresse d'une page du wiki d'après la cible d'un lien [[…]] (son id, ou son titre : résolu par la liste des pages, quand elle est lue). */
const adressePage = (ed) => (cible) => `${base(ed)}${cheminDePage(pageChoisie(etat.pages, cible)?.id ?? cible)}`;
const adresseFiltre = (ed) => (id) => `${base(ed)}chronologie/?filtre=${encodeURIComponent(id)}`;
/** Les catégories de la base vivante ([{ id, libelle, evenements }]) : celles de la dernière surcouche, sinon celles lues au chargement de l'éditeur. */
const categoriesVivantes = (ed) => etat.vivante?.categories ?? ed.listes.categoriesChronologie ?? [];
/** « Sans catégorie (à trier) » est proposé (hors de la production : Frise.astro, ChronologieEvenement.astro le notent en data-a-trier). */
const aTrier = () => Boolean(document.querySelector('[data-frise-choix][data-a-trier], [data-chrono-categories][data-a-trier]'));
/** L'adresse d'un événement : sa page construite, ou /chronologie/?evenement=<id> pour un événement créé depuis la construction. */
const adresseEvenement = (ed, id, construit) => (construit ? `${base(ed)}chronologie/${id}/` : `${base(ed)}chronologie/?evenement=${encodeURIComponent(id)}`);
const enfantsDe = (el) => [...el.childNodes].map(arbreDuDom).filter(Boolean);
/** Une adresse du site écrite depuis la racine, comme dans le Markdown (« /races/ ») : sans le préfixe de déploiement. */
const lienRelatif = (ed) => (href) => (base(ed) !== '/' && href.startsWith(base(ed)) ? `/${href.slice(base(ed).length)}` : href);
const markdownDe = (ed, el) => versMarkdown(enfantsDe(el), { lienRelatif: lienRelatif(ed) });
const changee = () => document.dispatchEvent(new CustomEvent('chronologie:frise-changee'));
/** Les tables dont une modification change ce que la chronologie montre. */
const TABLES_DE_LA_CHRONOLOGIE = ['evenement', 'evenement_extrait', 'evenement_categorie', 'categorie_chronologie'];

// --- Surcouche : la frise et l'événement affiché d'après la base vivante ------------------------------------------------------------------------

const COULEUR = 'couleur-evenement-';
/** Pose sur un élément la classe de couleur d'un événement (`voulue`), à la place de la sienne ; aucune (null) : sans couleur propre. */
export function poserCouleur(el, voulue) {
  if (!el) return;
  el.classList.remove(...[...el.classList].filter((c) => c.startsWith(COULEUR) && c !== voulue));
  if (voulue) el.classList.add(voulue);
}

/**
 * Réécrit la feuille des couleurs des événements d'après la base vivante. La couleur de `.chrono` dont l'événement n'est plus dans la base (la page
 * construite d'un événement supprimé depuis, ou le premier de /chronologie/) garde sa dernière règle : la page ne change pas de teinte. Un événement qui
 * existe toujours prend la teinte recalculée, celle de sa ligne. Exportée pour test/chronologie-editeur.test.mjs (faux navigateur).
 */
export function ecrireLesCouleurs(evenements) {
  const feuille = document.querySelector('style[data-couleurs-chronologie]');
  if (!feuille) return;
  const couleurs = couleursDesEvenements(evenements);
  const garde = [...(document.querySelector('[data-chrono]')?.classList ?? [])].filter((c) => c.startsWith(COULEUR) && !evenements.some((e) => classeDEvenement(e.id) === c))
    .map((c) => feuille.textContent.match(new RegExp(`\\.${c}\\{[^}]*\\}`))?.[0] ?? '').join('');
  feuille.textContent = cssDesEvenements(couleurs) + garde;
}

/** Refait la frise : une ligne par événement vivant, dans l'ordre de lecture ; les lignes construites gardent leur adresse, les nouvelles mènent à ?evenement=. */
export function refaireLaFrise(ed, evenements) {
  const liste = document.querySelector('.frise__liste');
  if (!liste) return;
  ecrireLesCouleurs(evenements);
  const actuel = idAffiche() ?? new URLSearchParams(location.search).get('evenement');
  const lignes = new Map([...liste.querySelectorAll('.frise__evenement')].map((li) => [li.id.replace(/^evenement-/, ''), li]));
  for (const [id, li] of lignes) if (!evenements.some((e) => e.id === id)) li.remove();
  evenements.forEach((e, i) => {
    let li = lignes.get(e.id);
    if (!li) {
      li = document.createElement('li');
      li.id = `evenement-${e.id}`;
      li.dataset.cree = '';
      li.innerHTML = `<a class="frise__lien"><span class="frise__date"><span data-ed-lecture="${echapperHtml(attributEd('evenement', { id: e.id }, 'epoque'))}" data-ed-rendu="evenement-date-courte"></span></span>`
        + '<span class="frise__barre"><span class="frise__morceau"></span><span class="frise__repere"></span></span>'
        + `<span class="frise__titre"><span data-ed-lecture="${echapperHtml(attributEd('evenement', { id: e.id }, 'titre'))}"></span></span></a>`;
      li.querySelector('.frise__lien').setAttribute('href', adresseEvenement(ed, e.id, false));
    }
    // la classe de l'événement sur la ligne, celle du précédent sur la barre, du suivant sur le morceau de barre (aucune au bord), comme au build
    li.className = `frise__evenement frise__evenement--${e.epoque} ${classeDEvenement(e.id)}`;
    poserCouleur(li.querySelector('.frise__barre'), evenements[i - 1] ? classeDEvenement(evenements[i - 1].id) : null);
    poserCouleur(li.querySelector('.frise__morceau'), evenements[i + 1] ? classeDEvenement(evenements[i + 1].id) : null);
    li.dataset.categories = e.categories.map((c) => c.id).join(' ');
    li.dataset.etiquette = `${libelleDeDate(e)} : ${e.titre}`;
    li.querySelector('.frise__date [data-ed-lecture]').textContent = dateCourte(e);
    li.querySelector('.frise__titre [data-ed-lecture]').textContent = e.titre;
    li.querySelector('.frise__repere').className = ['frise__repere', e.portee && `frise__repere--${e.portee}`].filter(Boolean).join(' ');
    const lien = li.querySelector('.frise__lien');
    if (e.id === actuel) lien.setAttribute('aria-current', 'page');
    liste.append(li);
  });
  // le choix du filtre : les catégories que portent les événements vivants (et « Sans catégorie (à trier) » hors de la production)
  const choix = document.querySelector('[data-frise-choix]');
  if (choix) {
    const garde = choix.value;
    const filtre = choixDuFiltre(evenements);
    const sans = choix.hasAttribute('data-a-trier') ? filtre.sansCategorie : 0;
    choix.replaceChildren(
      new Option(`Toutes (${evenements.length})`, ''),
      ...filtre.categories.map((c) => new Option(`${c.libelle} (${c.nombre})`, c.id)),
      ...(sans ? [new Option(`${LIBELLE_SANS_CATEGORIE} (${sans})`, SANS_CATEGORIE)] : []),
    );
    choix.value = [...choix.options].some((o) => o.value === garde) ? garde : '';
    const zone = choix.closest('[data-frise-filtre]');
    if (zone) zone.hidden = choix.options.length < 2;
  }
}

/** Refait les catégories et les descriptions de l'article d'après la base vivante. */
function refaireLArticle(ed, donnees) {
  const article = document.querySelector('[data-chrono-evenement]');
  if (!article || !donnees) return;
  const categories = article.querySelector('[data-chrono-categories]');
  if (categories) {
    const aTrierIci = categories.hasAttribute('data-a-trier');
    categories.innerHTML = htmlDesCategories(donnees.categories, { filtre: adresseFiltre(ed), aTrier: aTrierIci });
    categories.dataset.chronoCategories = donnees.categories.map((c) => c.id).join(' ');
    categories.hidden = !donnees.categories.length && !aTrierIci;
  }
  const blocs = article.querySelector('[data-chrono-blocs]');
  if (blocs) blocs.innerHTML = htmlDesBlocs(donnees.blocs, { page: adressePage(ed) });
  ed.appliquerLigne('evenement', { id: donnees.evenement.id }, donnees.evenement);
}

/** L'article d'un événement créé depuis la construction (aucune page construite) : les mêmes champs que ChronologieEvenement.astro. */
function articleProvisoire(ed, donnees, position, total) {
  const e = donnees.evenement;
  const champ = (colonne, valeur, libelle) => `<span class="chrono-ed__champ"><span class="chrono-ed__libelle">${libelle}</span><span data-ed="${echapperHtml(attributEd('evenement', { id: e.id }, colonne))}">${echapperHtml(valeur ?? '')}</span></span>`;
  const lecture = (colonne, rendu, html) => `<span data-ed-lecture="${echapperHtml(attributEd('evenement', { id: e.id }, colonne))}"${rendu ? ` data-ed-rendu="${rendu}"` : ''}>${html}</span>`;
  return `<article class="chrono-page" aria-labelledby="chrono-titre" data-chrono-evenement="${echapperHtml(e.id)}">
    <p class="chrono-numero">Chronologie · événement ${position} sur ${total}</p>
    <p class="banner" role="note">Événement créé sur le site de dev : sa page sera construite comme les autres à la prochaine version du site. Complétez-le ici (crayon).</p>
    <p class="chrono-date" data-ed-lecture="${echapperHtml(attributEd('evenement', { id: e.id }, 'epoque'))}" data-ed-rendu="evenement-date">${echapperHtml(libelleDeDate(e))}</p>
    <div class="chrono-ed chrono-ed--date" aria-label="Date">${champ('epoque', e.epoque, 'Époque')}${champ('annee', e.annee, 'Année')}${champ('annee_fin', e.annee_fin, 'Année de fin')}</div>
    <h1 id="chrono-titre"><span data-ed="${echapperHtml(attributEd('evenement', { id: e.id }, 'titre'))}">${echapperHtml(e.titre)}</span></h1>
    <p class="chrono-etiquettes" data-ed-cadre="[data-ed-lecture]"${e.portee || e.lieu ? '' : ' hidden'}>${lecture('portee', 'evenement-portee', e.portee ? `<span class="chrono-portee chrono-portee--${e.portee}">${PORTEES[e.portee]}</span>` : '')}<span class="chrono-lieu"${e.lieu ? '' : ' hidden'} data-ed-cadre="[data-ed-lecture]">${lecture('lieu', null, echapperHtml(e.lieu ?? ''))}</span></p>
    <div class="chrono-ed chrono-ed--impact" aria-label="Impact">${champ('portee', e.portee, 'Impact')}${champ('lieu', e.lieu, 'Lieu de l’Impact')}</div>
    <ul class="chrono-categories" aria-label="Catégories" data-chrono-categories=""${aTrier() ? ' data-a-trier' : ''}></ul>
    <div class="chrono-blocs" data-chrono-blocs></div>
  </article>`;
}

/** Bandeau sur la page construite d'un événement supprimé depuis (sur le site de dev). */
function bandeauSupprime() {
  const article = document.querySelector('[data-chrono-evenement]');
  if (!article || article.querySelector('.chrono-supprime')) return;
  const p = document.createElement('p');
  p.className = 'banner chrono-supprime';
  p.setAttribute('role', 'note');
  p.textContent = 'Cet événement a été supprimé sur le site de dev : sa page disparaîtra à la prochaine version du site.';
  article.prepend(p);
}

/** La frise d'ordinateur (qui défile seule) centrée sur l'événement affiché, comme au chargement (Frise.astro). */
function centrer() {
  const frise = document.querySelector('[data-frise]');
  const actuel = frise?.querySelector('[aria-current="page"]');
  if (!actuel || getComputedStyle(frise).overflowY !== 'auto') return;
  const f = frise.getBoundingClientRect();
  const haut = Math.max(f.top, 0) + (frise.querySelector('.frise__tete')?.offsetHeight ?? 0) + 8;
  const bas = Math.min(f.bottom, window.innerHeight) - 16;
  const r = actuel.getBoundingClientRect();
  if (r.top < haut || r.bottom > bas) frise.scrollTop += r.top - (haut + bas - r.height) / 2;
}

async function surcoucheVivante(ed) {
  const [vivante, pages] = await Promise.all([ed.appel('GET', 'edition/chronologie/'), pagesDuWiki(ed).catch(() => null)]);
  if (pages) etat.pages = pages;
  etat.vivante = vivante;
  const demande = idAffiche() ? null : new URLSearchParams(location.search).get('evenement');
  refaireLaFrise(ed, vivante.evenements);
  const id = idAffiche() ?? demande;
  // « événement N sur M » : la place dans la chronologie vivante
  const numero = document.querySelector('.chrono-numero');
  const position = vivante.evenements.findIndex((e) => e.id === id) + 1;
  if (numero && position) numero.textContent = `Chronologie · événement ${position} sur ${vivante.evenements.length}`;
  if (id) {
    let donnees = null;
    try {
      donnees = await ed.appel('POST', 'edition/evenement/', { evenement: id });
    } catch (e) {
      if (e.statut !== 404) throw e;
    }
    if (!donnees) {
      if (idAffiche()) bandeauSupprime();
    } else {
      if (!idAffiche()) {
        // /chronologie/?evenement=<id> : l'événement créé depuis la construction, à la place du mode d'emploi
        const page = document.querySelector('.chrono-page');
        const position = vivante.evenements.findIndex((e) => e.id === id) + 1;
        if (page) page.outerHTML = articleProvisoire(ed, donnees, position, vivante.evenements.length);
        document.title = document.title.replace(/^Chronologie\b/, `Chronologie : ${donnees.evenement.titre}`);
        poserCouleur(document.querySelector('[data-chrono]'), classeDEvenement(id));
        ed.page = `chronologie/?evenement=${id}`;
      }
      refaireLArticle(ed, donnees);
    }
  }
  changee();
  centrer();
}

// --- Mode modification ----------------------------------------------------------------------------------------------------------------------------

const texte = editeurEnPlace(() => etat.blocs.filter((b) => !b.retire).map((b) => b.el));
const OUTILS = [
  ['Texte', [
    ['G', 'Gras (Ctrl+B)', (ed) => texte.commande(ed, 'bold'), 'ed-gras'],
    ['I', 'Italique (Ctrl+I)', (ed) => texte.commande(ed, 'italic'), 'ed-italique'],
    ['S', 'Barré', (ed) => texte.commande(ed, 'strikeThrough'), 'ed-barre'],
    ['Effacer', 'Retirer gras, italique et barré du texte choisi', (ed) => texte.commande(ed, 'removeFormat')],
  ]],
  ['Mise en page', [
    ['¶', 'Paragraphe', (ed) => texte.bloc(ed, 'p')],
    ['• Liste', 'Liste à puces', (ed) => texte.commande(ed, 'insertUnorderedList')],
    ['1. Liste', 'Liste numérotée', (ed) => texte.commande(ed, 'insertOrderedList')],
  ]],
  ['Liens', [
    ['Lien page', 'Lien vers une page du wiki', texte.lienWiki],
    ['Lien web', 'Lien vers une adresse web', texte.lienWeb],
    ['Sans lien', 'Retirer le lien (le texte reste)', texte.retirerLien],
  ]],
  outilsDesMotsCles(texte),
];

function bouton(libelle, { classe = 'ed-outil', titre = null, action }) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = libelle;
  if (titre) b.title = titre;
  b.addEventListener('click', action);
  return b;
}

/** Les champs du formulaire « Nouvel événement » : ceux du modèle (lib/edition-modele.mjs#ENTITES.evenement), dans l'ordre de la demande. */
function champsDeCreation(ed) {
  return Object.entries(ENTITES.evenement.champs).map(([nom, c]) => ({
    nom, libelle: c.libelle, type: nom === 'lien' ? 'page' : c.type, requis: c.requis, choix: nom === 'categories' ? categoriesVivantes(ed) : c.choix,
    valeur: nom === 'epoque' ? 'datee' : undefined,
    aide: { epoque: 'Une année ne se donne qu’à un événement daté.', annee: 'Signe moins pour une année négative (-112).', description: 'Paragraphes séparés par une ligne vide ; **gras**, *italique*.', categories: 'Aucune : « Sans catégorie (à trier) ». Les catégories se créent par le bouton « Catégories ».' }[nom],
  }));
}

function boutonNouvelEvenement(ed) {
  const ici = document.querySelector('.chrono-page');
  if (!ici) return;
  const outils = document.createElement('div');
  outils.className = 'ed-outils chrono-ed-outils';
  outils.append(bouton('+ Nouvel événement', {
    action: () => ed.formulaire({
      titre: 'Nouvel événement',
      aide: 'Il est créé tout de suite dans la base du site de dev, à sa place dans la frise (après les événements de la même date) ; sa page s’ouvre ensuite pour le compléter.',
      champs: champsDeCreation(ed),
      valider: async (valeurs) => {
        const r = await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'evenement', valeurs }] });
        const id = r.crees[0].id;
        location.href = adresseEvenement(ed, id, false);
      },
    }),
  }));
  outils.append(bouton('Catégories', { titre: 'Créer, renommer ou supprimer une catégorie de la chronologie', action: () => gererLesCategories(ed) }));
  ici.prepend(outils);
  etat.ajouts.push(outils);
}

/**
 * La gestion des catégories (demande du propriétaire : « un bouton pour pouvoir créer, modifier et supprimer une catégorie ») : une boîte avec une ligne par
 * catégorie (son nom modifiable, son nombre d'événements, « Supprimer » à bascule) et une saisie pour en ajouter ; « Enregistrer » envoie le tout d'un bloc,
 * après confirmation s'il y a des suppressions (« une catégorie supprimée la retire de l'entrée »), puis la frise et l'événement affiché sont relus.
 */
async function gererLesCategories(ed) {
  let categories;
  try {
    categories = (await ed.appel('GET', 'edition/chronologie/')).categories ?? [];
  } catch (e) {
    ed.annoncer(`Les catégories n’ont pas pu être lues : ${e.message}`, 'erreur');
    return;
  }
  const dialogue = document.createElement('dialog');
  dialogue.className = 'ed-dialogue';
  dialogue.innerHTML = `<form method="dialog"><h2>Catégories de la chronologie</h2>
    <p class="ed-aide">Une catégorie range les événements (filtre de la frise ; plusieurs par événement). Renommée, elle garde ses événements ; supprimée, elle
    les quitte (ils restent dans la chronologie).</p>
    <ul class="ed-gestion-categories"></ul>
    <label class="ed-champ"><span class="ed-libelle">Nouvelle catégorie</span><span class="ed-ajout-relation"><input class="ed-saisie" autocomplete="off" placeholder="Son nom…"><button type="button" class="ed-outil" value="ajouter">Ajouter</button></span></label>
    <p class="ed-erreur" role="alert" hidden></p>
    <div class="ed-boutons"><button type="button" value="annuler">Annuler</button><button type="submit">Enregistrer</button></div></form>`;
  const liste = dialogue.querySelector('.ed-gestion-categories');
  const erreur = dialogue.querySelector('.ed-erreur');
  const nouvelle = dialogue.querySelector('label input');
  const lignes = []; // { categorie (null : à créer), saisie, supprimee, li, nombre }
  const compte = (n) => (n ? `${n} événement${n > 1 ? 's' : ''}` : 'aucun événement');
  function ligneDe(categorie, libelle) {
    const li = document.createElement('li');
    li.className = 'ed-gestion-categorie';
    const saisie = document.createElement('input');
    saisie.className = 'ed-saisie';
    saisie.value = libelle;
    saisie.setAttribute('aria-label', categorie ? `Nom de la catégorie ${categorie.libelle}` : 'Nom de la nouvelle catégorie');
    const nombre = document.createElement('span');
    nombre.className = 'ed-gestion-categorie__compte';
    nombre.textContent = categorie ? compte(categorie.evenements) : 'à créer';
    const ligne = { categorie, saisie, supprimee: false, li, nombre };
    const retirer = bouton(categorie ? 'Supprimer' : 'Retirer', {
      classe: 'ed-outil ed-outil--danger',
      action: () => {
        if (!categorie) {
          li.remove();
          lignes.splice(lignes.indexOf(ligne), 1);
          return;
        }
        ligne.supprimee = !ligne.supprimee;
        li.classList.toggle('ed-supprime', ligne.supprimee);
        saisie.disabled = ligne.supprimee;
        retirer.setAttribute('aria-pressed', String(ligne.supprimee));
        retirer.textContent = ligne.supprimee ? 'Sera supprimée — annuler' : 'Supprimer';
      },
    });
    li.append(saisie, nombre, retirer);
    liste.append(li);
    lignes.push(ligne);
  }
  for (const c of categories) ligneDe(c, c.libelle);
  if (!categories.length) liste.innerHTML = '<li class="ed-aide">Aucune catégorie pour l’instant.</li>';
  const ajouter = () => {
    const nom = nouvelle.value.trim();
    if (!nom) return;
    liste.querySelector('.ed-aide')?.remove();
    ligneDe(null, nom);
    nouvelle.value = '';
    nouvelle.focus();
  };
  dialogue.querySelector('[value="ajouter"]').addEventListener('click', ajouter);
  nouvelle.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    ajouter();
  });
  dialogue.querySelector('[value="annuler"]').addEventListener('click', () => dialogue.close());
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    erreur.hidden = true;
    try {
      ajouter();
      const operations = operationsDesCategories(lignes.map((l) => ({ id: l.categorie?.id ?? null, libelle: l.categorie?.libelle ?? null, nom: l.saisie.value, supprimee: l.supprimee })));
      if (!operations.length) {
        dialogue.close();
        return;
      }
      const supprimees = lignes.filter((l) => l.categorie && l.supprimee);
      const retrait = (n) => (n ? `retirée de ${compte(n)}` : 'aucun événement ne la porte');
      if (supprimees.length && !confirm(`Supprimer ${supprimees.map((l) => `« ${l.categorie.libelle} » (${retrait(l.categorie.evenements)})`).join(', ')} ?`)) return;
      await ed.appel('POST', 'edition/', { page: ed.page, operations });
      dialogue.close();
      ed.annoncer('Catégories enregistrées.');
      etat.ecritTout = true;
      await categoriesChangees(ed, new Set(supprimees.map((l) => l.categorie.id)));
    } catch (err) {
      erreur.textContent = err.message;
      erreur.hidden = false;
      if (err.statut !== 409 && err.statut !== 404) return;
      // une catégorie changée ou supprimée ailleurs entre-temps : la liste relue, les noms saisis gardés, pour un nouvel essai
      try {
        const fraiches = (await ed.appel('GET', 'edition/chronologie/')).categories ?? [];
        for (const l of [...lignes]) {
          if (!l.categorie) continue;
          const c = fraiches.find((x) => x.id === l.categorie.id);
          if (c) {
            // une ligne laissée telle quelle prend le nom relu (renommée ailleurs : le nouvel essai ne la renomme pas en sens inverse)
            if (l.saisie.value.trim() === l.categorie.libelle) l.saisie.value = c.libelle;
            l.categorie = c;
            l.nombre.textContent = compte(c.evenements);
          } else {
            l.li.remove();
            lignes.splice(lignes.indexOf(l), 1);
          }
        }
        for (const c of fraiches) if (!lignes.some((l) => l.categorie?.id === c.id)) ligneDe(c, c.libelle);
        erreur.textContent += ' La liste a été relue : vérifiez-la, puis enregistrez de nouveau.';
      } catch {
        // la liste reste telle quelle ; le message dit le refus
      }
    }
  });
  document.body.append(dialogue);
  dialogue.showModal();
}

/**
 * Après la gestion des catégories : la frise relue dans la base vivante ; en mode modification, les cases de l'événement refaites
 * (une catégorie supprimée a quitté l'événement dans la base : elle sort aussi de ce que la page a lu, `avant`, sinon l'enregistrement serait refusé).
 */
async function categoriesChangees(ed, supprimees) {
  // la frise seulement (ses catégories, le choix du filtre) : l'article est en cours de modification (ses descriptions montées ne se refont pas) ; ses
  // pastilles, cachées en mode modification, sont relues à la sortie (fin : ecritTout)
  try {
    etat.vivante = await ed.appel('GET', 'edition/chronologie/');
    refaireLaFrise(ed, etat.vivante.evenements);
    changee();
  } catch (e) {
    ed.annoncer(`La chronologie n’a pas pu être relue : ${e.message}`, 'erreur');
  }
  if (!etat.categories) return;
  const cochees = etat.categories.lire().filter((id) => !supprimees.has(id));
  etat.categories.avant = etat.categories.avant.filter((id) => !supprimees.has(id));
  poserLesCases(ed, cochees);
}

/** Les cases des catégories de l'événement affiché (mode modification), cochées selon `cochees` ; remplace celles d'avant. */
function poserLesCases(ed, cochees) {
  // les catégories connues, plus celles que porte l'événement (créées ailleurs depuis la dernière lecture : sans leur case, l'enregistrement les retirerait)
  const choix = [...categoriesVivantes(ed)];
  for (const c of etat.donnees?.categories ?? []) if (!choix.some((x) => x.id === c.id)) choix.push(c);
  const champ = ed.champ({ nom: 'categories', libelle: 'Catégories', type: 'categories', choix, valeur: cochees });
  etat.categories.zone.querySelector('.ed-categories')?.remove();
  etat.categories.zone.append(champ.element);
  etat.categories.lire = champ.lire;
}

/** La saisie du lien d'un bloc : une page du wiki (suggestions), ou rien. */
function saisieDuLien(ed, bloc) {
  const ligne = document.createElement('div');
  ligne.className = 'chrono-ed-bloc';
  const id = `chrono-lien-${bloc.rang}`;
  const page = bloc.lien.valeur ? etat.pages.find((p) => p.id === bloc.lien.valeur) : null;
  ligne.innerHTML = `<label class="chrono-ed-bloc__lien"><span class="chrono-ed__libelle">Lien</span><input class="ed-saisie" list="${id}-pages" autocomplete="off" placeholder="Aucun : quelques lettres du titre d’une page…"></label>`;
  const saisie = ligne.querySelector('input');
  saisie.value = page ? libelleDePage(page) : bloc.lien.valeur ?? '';
  const liste = document.createElement('datalist');
  liste.id = `${id}-pages`;
  liste.append(...etat.pages.map((p) => new Option(libelleDePage(p))));
  ligne.append(liste);
  saisie.addEventListener('change', () => {
    const t = saisie.value.trim();
    const p = t ? pageChoisie(etat.pages, t) : null;
    saisie.setCustomValidity(t && !p ? 'Page introuvable : choisissez-la dans la liste (ou videz le champ : aucun lien).' : '');
    bloc.lien.valeur = p ? p.id : t ? bloc.lien.valeur : null;
    bloc.lien.invalide = Boolean(t && !p);
    ed.marquerModifie();
  });
  const retirer = bouton('Retirer cette description', {
    classe: 'ed-outil ed-outil--danger',
    action: () => {
      bloc.retire = !bloc.retire;
      bloc.el.classList.toggle('ed-supprime', bloc.retire);
      bloc.el.contentEditable = bloc.retire ? 'false' : 'true';
      retirer.setAttribute('aria-pressed', String(bloc.retire));
      retirer.textContent = bloc.retire ? 'Sera retirée — annuler' : 'Retirer cette description';
      ed.marquerModifie();
    },
  });
  ligne.append(retirer);
  bloc.lien.el = ligne;
  return ligne;
}

/** Rend un bloc modifiable en place (sans la date surlignée, qui n'est qu'un repère d'affichage) et pose sa ligne « Lien ». */
function monterLeBloc(ed, el, ligne) {
  for (const m of el.querySelectorAll('mark.chrono-surligne')) m.replaceWith(...m.childNodes);
  el.normalize();
  const bloc = { el, rang: ligne.rang, ligne, initial: '', lien: { valeur: ligne.page_id ?? null, invalide: false, el: null }, retire: false };
  texte.rendreModifiable(ed, el, etat.abandon.signal);
  bloc.initial = markdownDe(ed, el); // relu une fois les mots-clés en balises écrites (rendreModifiable)
  etat.blocs.push(bloc);
  el.after(saisieDuLien(ed, bloc));
  return bloc;
}

async function debutDeLEvenement(ed) {
  const id = idAffiche();
  if (!id) return;
  let donnees;
  try {
    [donnees, etat.pages] = await Promise.all([ed.appel('POST', 'edition/evenement/', { evenement: id }), pagesDuWiki(ed)]);
  } catch (e) {
    ed.annoncer(`Cet événement ne peut pas être modifié ici : ${e.message}`, 'erreur');
    return;
  }
  if (!ed.enEdition) return;
  etat.donnees = donnees;
  const article = document.querySelector('[data-chrono-evenement]');
  // l'état de la base vivante, puis l'édition en place de chaque bloc
  refaireLArticle(ed, donnees);
  for (const el of article.querySelectorAll('blockquote[data-chrono-bloc]')) {
    const ligne = donnees.blocs.find((b) => String(b.rang) === el.dataset.chronoBloc);
    if (ligne) monterLeBloc(ed, el, ligne);
  }
  // + Ajouter une description (créée tout de suite, puis modifiable ici)
  const blocs = article.querySelector('[data-chrono-blocs]');
  const ajout = document.createElement('div');
  ajout.className = 'ed-outils';
  ajout.append(bouton('+ Ajouter une description', {
    action: () => ed.formulaire({
      titre: 'Nouvelle description',
      aide: 'Elle s’ajoute à la fin de l’événement, créée tout de suite dans la base du site de dev.',
      champs: [
        { nom: 'texte', libelle: 'Description', type: 'markdown', requis: true },
        { nom: 'lien', libelle: 'Lien (une page du wiki)', type: 'page' },
      ],
      valider: async (valeurs) => {
        await ed.appel('POST', 'edition/', { page: ed.page, operations: [{ op: 'creer', entite: 'evenement_extrait', valeurs: { evenement_id: id, ...valeurs } }] });
        const frais = await ed.appel('POST', 'edition/evenement/', { evenement: id });
        const nouveau = frais.blocs.at(-1);
        const figure = document.createElement('div');
        figure.innerHTML = htmlDesBlocs([nouveau], { page: adressePage(ed) });
        const el = figure.querySelector('blockquote');
        blocs.append(...figure.childNodes);
        monterLeBloc(ed, el, nouveau);
        etat.donnees.blocs.push(nouveau);
        etat.ecritTout = true;
      },
    }),
  }));
  blocs.after(ajout);
  etat.ajouts.push(ajout);
  // les catégories : une case chacune (editeur.mjs#champAPart)
  const categories = article.querySelector('[data-chrono-categories]');
  const zone = document.createElement('div');
  zone.className = 'chrono-ed chrono-ed--categories';
  zone.innerHTML = `<span class="chrono-ed__libelle">Catégories (« ${LIBELLE_SANS_CATEGORIE} » s’il n’y en a aucune ; bouton « Catégories » pour en créer)</span>`;
  zone.addEventListener('change', () => ed.marquerModifie());
  categories.after(zone);
  etat.ajouts.push(zone);
  etat.categories = { zone, lire: () => [], avant: donnees.categories.map((c) => c.id) };
  poserLesCases(ed, etat.categories.avant);
  // supprimer l'événement (à l'enregistrement)
  const supprimer = bouton('Supprimer cet événement', {
    classe: 'ed-outil ed-outil--danger',
    titre: 'L’événement et ses descriptions partent à l’enregistrement',
    action: () => {
      etat.supprimer = !etat.supprimer;
      article.classList.toggle('ed-supprime', etat.supprimer);
      supprimer.setAttribute('aria-pressed', String(etat.supprimer));
      supprimer.textContent = etat.supprimer ? 'Sera supprimé — annuler' : 'Supprimer cet événement';
      ed.marquerModifie();
    },
  });
  const outils = article.querySelector('.chrono-ed-outils') ?? article;
  outils.append(supprimer);
  // la barre de mise en forme des descriptions
  document.execCommand('defaultParagraphSeparator', false, 'p');
  etat.barre = texte.barre(ed, OUTILS, 'Mise en forme des descriptions').element;
  document.body.append(etat.barre);
}

export const chronologie = {
  nom: 'chronologie',
  actif: (doc) => Boolean(doc.querySelector('[data-chrono]')),

  async surcouche(ed, lignes) {
    const touche = lignes.some((l) => TABLES_DE_LA_CHRONOLOGIE.includes(l.table));
    if (!touche && !new URLSearchParams(location.search).has('evenement')) return;
    try {
      await surcoucheVivante(ed);
    } catch (e) {
      ed.annoncer(`La chronologie du site de dev n’a pas pu être affichée : ${e.message}`, 'erreur');
    }
  },

  debut(ed) {
    etat.abandon = new AbortController();
    const article = document.querySelector('[data-chrono-evenement]');
    Object.assign(etat, {
      id: idAffiche(), donnees: null, blocs: [], categories: null, supprimer: false, ajouts: [],
      sauvegarde: article ? { categories: article.querySelector('[data-chrono-categories]')?.innerHTML ?? '', blocs: article.querySelector('[data-chrono-blocs]')?.innerHTML ?? '' } : null,
    });
    boutonNouvelEvenement(ed);
    debutDeLEvenement(ed);
  },

  verifier(ed) {
    if (!etat.donnees) return null;
    if (etat.supprimer) {
      return confirm(`Supprimer l’événement « ${etat.donnees.evenement.titre} » et ses descriptions ?`) ? null : 'Suppression annulée : rien n’est enregistré.';
    }
    const gardes = etat.blocs.filter((b) => !b.retire);
    if (!gardes.length) return 'Un événement garde au moins une description (ou supprimez l’événement).';
    const vide = gardes.find((b) => markdownDe(ed, b.el).trim() === '');
    if (vide) {
      vide.el.focus();
      return 'Une description est vide : écrivez-y au moins une phrase, ou retirez-la.';
    }
    const lien = etat.blocs.find((b) => !b.retire && b.lien.invalide);
    if (lien) return 'Un lien de description n’est pas une page du wiki : choisissez-la dans la liste, ou videz le champ.';
    return null;
  },

  operations(ed, operations) {
    if (!etat.donnees) return operations;
    const id = etat.donnees.evenement.id;
    if (etat.supprimer) {
      return [
        ...operations.filter((o) => !(o.table === 'evenement' && o.cle?.id === id) && !(o.table === 'evenement_extrait' && o.cle?.evenement_id === id)),
        { op: 'supprimer', entite: 'evenement', cle: { id } },
      ];
    }
    for (const b of etat.blocs) {
      const cle = { evenement_id: id, rang: b.rang };
      if (b.retire) {
        operations.push({ op: 'supprimer', entite: 'evenement_extrait', cle });
        continue;
      }
      const valeurs = {};
      const avant = {};
      const md = markdownDe(ed, b.el);
      if (md.trim() !== b.initial.trim()) {
        valeurs.texte = md;
        avant.texte = b.ligne.texte;
      }
      if ((b.lien.valeur ?? null) !== (b.ligne.page_id ?? null)) {
        valeurs.page_id = b.lien.valeur ?? '';
        avant.page_id = b.ligne.page_id ?? null;
      }
      if (Object.keys(valeurs).length) operations.push({ op: 'modifier', table: 'evenement_extrait', cle, valeurs, avant });
    }
    const cochees = etat.categories?.lire() ?? null;
    if (cochees && [...cochees].sort().join(' ') !== [...etat.categories.avant].sort().join(' ')) {
      operations.push({ op: 'categories', evenement: id, categories: cochees, avant: etat.categories.avant });
    }
    return operations;
  },

  /** Un 409 sur une description (changée ailleurs entre-temps) : sa ligne actuelle devient la référence (`avant`) ; le texte saisi reste, à vérifier. */
  conflit(ed, e) {
    if (e.corps?.table !== 'evenement_extrait' || e.corps.cle?.evenement_id !== etat.donnees?.evenement.id) return null;
    const bloc = etat.blocs.find((b) => b.rang === Number(e.corps.cle.rang));
    if (!bloc) return null;
    bloc.ligne = e.corps.ligne;
    return 'Cette description a changé entre-temps (autre onglet ou autre personne) : votre texte est resté ; vérifiez-le, puis enregistrez de nouveau pour le garder.';
  },

  fin(ed) {
    // abandon : l'article d'avant revient ; enregistrement : apresEnregistrement le refait ensuite d'après la base vivante. Ce qui a été écrit tout de
    // suite pendant la session (une description ajoutée, les catégories) est dans la base même sans « Enregistrer » : la page est alors relue.
    const article = document.querySelector('[data-chrono-evenement]');
    const relire = etat.ecritTout;
    if (article && etat.sauvegarde) {
      const categories = article.querySelector('[data-chrono-categories]');
      const blocs = article.querySelector('[data-chrono-blocs]');
      if (categories) categories.innerHTML = etat.sauvegarde.categories;
      if (blocs) blocs.innerHTML = etat.sauvegarde.blocs;
      article.classList.remove('ed-supprime');
    }
    etat.abandon?.abort();
    etat.barre?.remove();
    for (const el of etat.ajouts) el.remove();
    Object.assign(etat, { blocs: [], barre: null, abandon: null, ajouts: [], categories: null, sauvegarde: null, ecritTout: false });
    if (relire) surcoucheVivante(ed).catch((e) => ed.annoncer(`La chronologie n’a pas pu être relue : ${e.message}`, 'erreur'));
  },

  async apresEnregistrement(ed, resultat) {
    const id = etat.donnees?.evenement.id;
    const touche = resultat.lignes?.some((l) => TABLES_DE_LA_CHRONOLOGIE.includes(l.table));
    if (etat.supprimer && id) {
      // l'événement n'existe plus : son voisin dans la frise, ou la chronologie
      const li = document.getElementById(`evenement-${id}`);
      const voisin = li?.nextElementSibling ?? li?.previousElementSibling;
      location.href = voisin?.querySelector('.frise__lien')?.href ?? `${base(ed)}chronologie/`;
      return;
    }
    etat.donnees = null;
    if (touche) {
      try {
        await surcoucheVivante(ed);
      } catch (e) {
        ed.annoncer(`La chronologie n’a pas pu être relue : ${e.message}`, 'erreur');
      }
    }
  },
};
