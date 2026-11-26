// Page /recherche/ (pages/recherche.astro) : la recherche dans l'index (pages du wiki et événements de la chronologie, /search-index.json), la liste des
// mots-clés filtrée par leur écriture, et les pages d'un mot-clé (demande du propriétaire : « cliquer sur un mot clé lance une recherche sur ce mot clé
// et liste les éléments qui ont ce mot clé » ; les événements de la chronologie n'ont pas de mot-clé, mais des catégories) : /recherche/?mot-cle=<clé>
// (décision R232 (3) : la clé du mot-clé ; une clé qu'il a quittée, un ancien id texte compris, mène encore à lui : lib/recherche-mots-cles.mjs#idDeLaCle),
// état gardé dans l'adresse (history.pushState, retour arrière compris, adresse lue au chargement). Une clé que le vocabulaire n'a pas (mot-clé supprimé ou
// fusionné depuis) : « Ce mot-clé n'existe plus ». Taper ou chercher depuis la vue d'un mot-clé ouverte par un clic de la liste revient à la liste par un
// retour arrière (l'entrée poussée par le clic est retirée, l'historique ne garde pas deux fois la liste) ; ouverte par son adresse, la vue est remplacée.
// La liste est le glossaire (migration 0056) : tous les mots-clés, même sans page ; la vue d'un mot-clé montre son libellé, sa définition, son élément, puis ses pages.
// La liste est rendue au build et lue une fois : aucun script ne la redessine (la gestion du vocabulaire est sur le Glossaire, /regles/glossaire/ :
// src/scripts/edition/mots-cles.mjs, évènement « glossaire:mots-cles »). Chaque mot-clé de la liste est un <li data-id data-cle data-n data-libelle
// data-synonymes data-anciennes-cles data-definition> (data-id : son id entier, celui des pages de l'index ; data-cle : sa clé ; data-n : ses pages ;
// data-synonymes : ses synonymes en JSON, que filtre la recherche avec son libellé, R233 (1) ; data-anciennes-cles : les clés qu'il a quittées, en JSON ;
// tous deux absents s'il n'en a pas ; data-definition : sa définition ÉCRITE, absente tant qu'il n'est pas décrit : le texte d'un élément n'est pas dans la page),
// dont le lien montre le nom dans un `.recherche-nom` (le libellé seul, R233 (9) ; « Ricken d’or » et son icône :
// lib/mots-cles-balises.mjs#htmlDeLaPastille), que le titre de la vue reprend. La définition que montre la vue est celle que la page construite a rendue
// dans #definitions-des-mots-cles ([data-definition-de], monnaies en icônes : R63) : ce script la recopie, il ne lit aucune monnaie ; à défaut, le texte de
// data-definition.
// Décision R309 (docs/chantier-ancrage-mots-cles.md §8, §9) :
//   - la vue d'un mot-clé montre d'abord son élément (la page, le sort… qu'il ancre : son nom en lien, son type, son texte à défaut de définition écrite), lu
//     dans /search-elements.json (lib/recherche-index.ts#elementsDesMotsCles), chargé avec l'index à la première vue ; puis ses pages. Sans cela, les pastilles des
//     mots-clés ancrés (plus de mille) mèneraient à « Aucune page ne porte ni ne cite ce mot-clé » ;
//   - la liste est paginée par 100 pastilles (`?page=` dans l'adresse, gardé par history.replaceState ; la page construite ne montre que la première, les
//     autres pastilles portent `hidden`, qu'un <noscript> annule : sans JavaScript tout s'affiche). Les filtres portent sur tout le registre, puis la page
//     s'applique ; une saisie revient à la page 1 ; la navigation, sous la liste, est créée ici (donc absente sans JavaScript). Ouvrir un mot-clé garde `page`
//     dans l'adresse : « Tous les mots-clés » et le retour arrière retrouvent la même page (sauf après une autre saisie, qui a changé la liste).
// Script de page (navigateur) : il n'importe que des modules purs qu'aucun autre script de page n'importe (la version portable refuse un module partagé).
import {
  adresseAvecMotCle, idDeLaCle, motCleDeLAdresse, motsClesAffiches, numerosDePage, pageDeLAdresse, pageDeLaListe, rechercheAvecPage, TAILLE_DE_PAGE_DE_LA_RECHERCHE,
  vueDuMotCle,
} from '../lib/recherche-mots-cles.mjs';
import { cleDeRecherche, searchIndex } from '../lib/search.mjs';

const form = document.getElementById('search-form');
const input = document.getElementById('q');
const statut = document.getElementById('status');
const resultats = document.getElementById('results');
const sectionResultats = document.getElementById('pages-trouvees');
const sectionMotsCles = document.getElementById('mots-cles');
const liste = document.getElementById('liste-mots-cles');
const nombreMotsCles = document.getElementById('nombre-mots-cles');
const aucunMotCle = document.getElementById('aucun-mot-cle');
const vue = document.getElementById('vue-du-mot-cle');
const titreVue = document.getElementById('titre-mot-cle');
const definitionVue = document.getElementById('vue-du-mot-cle-definition');
const elementVue = document.getElementById('vue-du-mot-cle-element');
const elementListe = document.getElementById('vue-du-mot-cle-element-liste');
const compteVue = document.getElementById('vue-du-mot-cle-compte');
const vuePages = document.getElementById('vue-du-mot-cle-pages');
const tousLesMotsCles = document.getElementById('tous-les-mots-cles');
const definitions = document.getElementById('definitions-des-mots-cles');

// data-base : préfixe des pages du site (absolu, ou relatif dans la version portable) ; data-suffix : « index.html » si requis.
const base = form.dataset.base.replace(/\/?$/, '/');
const suffixe = form.dataset.suffix ?? '';
const titreDeLaPage = document.title;

let index; // promesse de l'index (chargé une fois : à la première recherche ou au premier mot-clé affiché)
let elementsDesMotsCles; // promesse du fichier des éléments (chargé une fois : à la première vue d'un mot-clé)
let motCle = motCleDeLAdresse(location.search); // le mot-clé affiché (la clé de l'adresse) ; null : la liste des mots-clés
let page = pageDeLAdresse(location.search); // la page de la liste (à partir de 1 ; ramenée dans les bornes à l'affichage)
let demandes = 0; // la dernière vue demandée (un chargement plus ancien ne l'écrase pas)
let requeteAvantLaVue = ''; // la saisie quand la vue d'un mot-clé s'est ouverte : la page de l'adresse ne vaut que pour elle
// l'entrée de l'historique poussée par un clic dans la liste porte ce jeton (history.state.depuisLaListe) ; un par chargement de la page : après un
// rechargement, l'entrée d'avant n'est plus ce document, et un retour arrière perdrait la saisie
const JETON = `${Date.now()}-${Math.random()}`;

const nombre = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const requete = () => input.value.trim();
const modifie = (e) => e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey; // nouvel onglet, etc. : le navigateur suit le lien

/** Une liste lue dans un attribut JSON ; [] s'il est absent ou illisible. */
const listeJson = (valeur) => {
  try {
    const v = JSON.parse(valeur ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

// les mots-clés de la liste : { li, id (entier), cle, n, libelle, synonymes, anciennes_cles, definition, recherche (leur clé de recherche, calculée une fois) }
const items = [...liste.querySelectorAll('li[data-id]')].map((li) => {
  const m = {
    li, id: Number(li.dataset.id), cle: li.dataset.cle ?? '', n: Number(li.dataset.n) || 0, libelle: li.dataset.libelle ?? '',
    synonymes: listeJson(li.dataset.synonymes), anciennes_cles: listeJson(li.dataset.anciennesCles), definition: li.dataset.definition ?? '',
  };
  return { ...m, recherche: cleDeRecherche(m) };
});

/** Un fichier JSON du site. */
function lireLeJson(adresse) {
  return fetch(adresse).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
}

function chargerIndex() {
  index ??= lireLeJson(form.dataset.indexUrl).catch((e) => {
    index = undefined; // réessayé à la demande suivante
    throw e;
  });
  return index;
}

function chargerLesElements() {
  elementsDesMotsCles ??= lireLeJson(form.dataset.elementsUrl).catch((e) => {
    elementsDesMotsCles = undefined;
    throw e;
  });
  return elementsDesMotsCles;
}

/** L'adresse d'une page du site (`chemin` relatif à la racine, `ancre` sans « # ») : préfixe de déploiement, puis « index.html » dans la version portable. */
const lienVers = (chemin, ancre) => `${base}${chemin}${suffixe}${ancre ? `#${ancre}` : ''}`;
const pastilleDeType = (type) => Object.assign(document.createElement('span'), { className: 'badge', textContent: type });

/** Une ligne de résultat : le lien, le type en pastille, le résumé (la date d'un événement). */
function ligneDElement(element) {
  const li = document.createElement('li');
  const a = Object.assign(document.createElement('a'), { href: lienVers(element.path, element.ancre), textContent: element.title });
  li.append(a, ' ', pastilleDeType(element.type));
  if (element.summary) li.append(Object.assign(document.createElement('div'), { className: 'muted', textContent: element.summary }));
  return li;
}

/**
 * La ligne de l'élément d'un mot-clé ancré (`{ nom, type, adresse?, texte? }` de /search-elements.json) : son nom en lien vers l'endroit où il se lit et se
 * modifie (sans adresse, le nom seul : un type de sort, une monnaie), son type en pastille, son texte (seulement quand le mot-clé n'a pas de définition écrite).
 */
function ligneDeLElement(element) {
  const li = document.createElement('li');
  const [chemin, ancre] = String(element.adresse ?? '').split('#');
  const nom = chemin
    ? Object.assign(document.createElement('a'), { href: lienVers(chemin, ancre), textContent: element.nom })
    : Object.assign(document.createElement('strong'), { textContent: element.nom });
  li.append(nom, ' ', pastilleDeType(element.type));
  if (element.texte) li.append(Object.assign(document.createElement('div'), { className: 'muted', textContent: element.texte }));
  return li;
}

// La navigation, sous la liste (créée ici : sans JavaScript, elle n'existe pas). Précédent, les numéros (`numerosDePage` : jamais les 18), suivant, et
// l'état annoncé aux lecteurs d'écran.
const navigation = document.createElement('nav');
navigation.className = 'recherche-navigation';
navigation.setAttribute('aria-label', 'Pages des mots-clés');
navigation.hidden = true;
const precedent = document.createElement('button');
const suivant = document.createElement('button');
for (const [b, nom, texte] of [[precedent, 'precedent', 'Précédent'], [suivant, 'suivant', 'Suivant']]) {
  b.type = 'button';
  b.className = 'recherche-navigation__bouton';
  b.dataset.nav = nom;
  b.textContent = texte;
}
const numeros = document.createElement('ol');
numeros.className = 'recherche-navigation__numeros';
const etat = document.createElement('p');
etat.className = 'recherche-navigation__etat muted';
etat.setAttribute('aria-live', 'polite');
navigation.append(precedent, numeros, suivant, etat);
liste.after(navigation);

function dessinerLaNavigation(courante, pages) {
  navigation.hidden = pages <= 1;
  precedent.disabled = courante <= 1;
  suivant.disabled = courante >= pages;
  numeros.replaceChildren(...numerosDePage(courante, pages).map((n) => {
    const li = document.createElement('li');
    if (n === null) {
      li.className = 'recherche-navigation__trou';
      li.textContent = '…';
      return li;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'recherche-navigation__bouton';
    b.dataset.page = String(n);
    b.textContent = String(n);
    b.setAttribute('aria-label', `Page ${n}`);
    if (n === courante) b.setAttribute('aria-current', 'page');
    li.append(b);
    return li;
  }));
  etat.textContent = pages > 1 ? `Page ${courante} sur ${pages}` : '';
}

/**
 * Le numéro de page dans l'adresse de la liste (les autres paramètres et le fragment gardés ; la page 1 sans « page »), sans nouvelle entrée de l'historique.
 * Pas pendant la vue d'un mot-clé, ni tant que l'adresse est encore la sienne (le retour arrière d'une saisie n'est pas encore fait).
 */
function garderLAdresse() {
  if (motCle || motCleDeLAdresse(location.search)) return;
  const recherche = rechercheAvecPage(location.search, page);
  if (recherche === location.search) return;
  try {
    history.replaceState(history.state, '', `${location.pathname}${recherche}${location.hash}`);
  } catch {
    // cadre isolé (version portable) : l'adresse ne suit pas
  }
}

/**
 * Mots-clés : ceux dont le libellé ou un synonyme correspond (tous sans recherche), qu'une page les porte ou non (le glossaire), sur tout le registre ; puis la
 * page : seules les pastilles de la page ont `hidden` à faux (écrit seulement s'il change : 1 764 pastilles à chaque frappe). Rend le nombre de mots-clés trouvés.
 */
function filtrer(query) {
  const gardes = motsClesAffiches(items, query, { tous: true });
  const p = pageDeLaListe(gardes.length, page, TAILLE_DE_PAGE_DE_LA_RECHERCHE);
  page = p.page;
  const dePage = new Set(gardes.slice(p.debut, p.fin));
  for (const m of items) {
    const cache = !dePage.has(m);
    if (m.li.hidden !== cache) m.li.hidden = cache;
  }
  nombreMotsCles.textContent = `(${gardes.length})`;
  aucunMotCle.hidden = gardes.length > 0 || !items.length;
  dessinerLaNavigation(p.page, p.pages);
  garderLAdresse();
  return gardes.length;
}

async function chercher() {
  const query = requete();
  const trouves = filtrer(query);
  resultats.replaceChildren();
  if (!query) {
    statut.textContent = '';
    sectionResultats.hidden = true;
    return;
  }
  let donnees;
  try {
    donnees = await chargerIndex();
  } catch {
    statut.textContent = 'Impossible de charger l’index de recherche.';
    return;
  }
  if (requete() !== query || motCle) return; // une frappe plus récente, ou un mot-clé, a pris la main pendant le chargement
  const hits = searchIndex(donnees, query);
  statut.textContent = `${nombre(hits.length, 'résultat', 'résultats')}, ${nombre(trouves, 'mot-clé', 'mots-clés')}`;
  sectionResultats.hidden = hits.length === 0;
  resultats.replaceChildren(...hits.map(ligneDElement));
}

/** Le titre de la vue du mot-clé `id` : « Mot-clé « <son nom> » », le nom tel que sa pastille le montre (icône d'une monnaie comprise), sinon son libellé. */
function titrer(id, libelle) {
  const nom = items.find((m) => m.id === id)?.li.querySelector('.recherche-nom');
  if (nom) titreVue.innerHTML = `Mot-clé « ${nom.innerHTML} »`;
  else titreVue.textContent = `Mot-clé « ${libelle} »`;
}

/** La définition du mot-clé `id` dans la vue : celle que la page a rendue ([data-definition-de]), sinon `texte` tel quel ; cachée sans définition. */
function definir(id, texte) {
  const rendue = [...(definitions?.children ?? [])].find((d) => d.dataset.definitionDe === String(id));
  if (rendue && texte) definitionVue.innerHTML = rendue.innerHTML;
  else definitionVue.textContent = texte ?? '';
  definitionVue.hidden = !texte;
}

/** L'élément du mot-clé dans la vue (null : aucun, le bloc est caché). */
function montrerLElement(element) {
  elementListe.replaceChildren(...(element ? [ligneDeLElement(element)] : []));
  elementVue.hidden = !element;
}

/** Le texte sous l'élément : vide (et caché) quand l'élément suffit à dire d'où vient le mot-clé. */
function compter(texte) {
  compteVue.textContent = texte;
  compteVue.hidden = !texte;
}

/** Le vocabulaire de la liste (tous les mots-clés du glossaire) : dit si l'id existe et le décrit ; `elements` (id → élément) donne l'élément qu'il ancre. */
const vocabulaire = (elements = {}) => new Map(items.map((m) => [m.id, { libelle: m.libelle, synonymes: m.synonymes, definition: m.definition, element: elements[m.id] ?? null }]));

/** La vue d'un mot-clé (lib/recherche-mots-cles.mjs#vueDuMotCle) : son titre, sa définition, son élément et ses pages ; ou « Ce mot-clé n'existe plus ». */
function montrer(v, id, { detail = true } = {}) {
  vuePages.hidden = true;
  definir(id, v.existe ? v.definition : '');
  if (!v.existe) {
    titreVue.textContent = 'Ce mot-clé n’existe plus';
    montrerLElement(null);
    compter('Il a été supprimé, ou fusionné dans un autre mot-clé. Choisissez-en un parmi tous les mots-clés.');
    document.title = `Mot-clé introuvable — ${titreDeLaPage}`;
    return;
  }
  titrer(id, v.libelle);
  montrerLElement(v.element);
  vuePages.replaceChildren(...v.pages.map(ligneDElement));
  vuePages.hidden = v.pages.length === 0;
  // l'élément dit d'où vient le mot-clé : sans page qui le cite, rien de plus à compter (jamais « Aucune page » pour un sort ou une page ancrés) ; sans le
  // fichier des éléments (`detail` faux), on ne sait pas s'il en a un : jamais « Aucune page » non plus
  compter(v.pages.length ? `${nombre(v.pages.length, 'page', 'pages')}.`
    : v.element ? '' : detail ? 'Aucune page ne porte ni ne cite ce mot-clé.' : 'Le détail de ce mot-clé n’a pas pu être chargé.');
  document.title = `${titreVue.textContent.replace(/\s+/g, ' ')} — ${titreDeLaPage}`; // une icône n'a pas de texte
}

async function afficherLeMotCle() {
  const cle = motCle;
  // la clé de l'adresse désigne l'id entier du mot-clé (sa clé, ou une clé qu'il a quittée) ; inconnue : -1, qu'aucun mot-clé n'a
  const id = idDeLaCle(items, cle) ?? -1;
  const demande = ++demandes;
  const avant = vocabulaire();
  if (avant.has(id)) titrer(id, avant.get(id).libelle);
  else titreVue.textContent = 'Mot-clé';
  definir(id, avant.get(id)?.definition ?? '');
  montrerLElement(null);
  compter('Chargement…');
  vuePages.hidden = true;
  // les deux fichiers se chargent ensemble ; l'élément complète la vue, il ne l'empêche pas : sans lui, les pages s'affichent (le prochain essai le relira)
  const lesElements = chargerLesElements().catch(() => null);
  let donnees;
  try {
    donnees = await chargerIndex();
  } catch {
    if (demande === demandes) compter('Impossible de charger l’index de recherche.');
    return;
  }
  const elements = await lesElements;
  if (demande !== demandes || motCle !== cle) return;
  montrer(vueDuMotCle(donnees, id, vocabulaire(elements ?? {})), id, { detail: elements !== null });
}

/** Affiche l'état de l'adresse : la vue d'un mot-clé, ou la liste des mots-clés et la recherche. */
function afficher() {
  vue.hidden = !motCle;
  sectionMotsCles.hidden = Boolean(motCle);
  if (motCle) {
    sectionResultats.hidden = true;
    statut.textContent = '';
    afficherLeMotCle();
  } else {
    demandes += 1; // une vue en cours de chargement ne s'affichera plus
    document.title = titreDeLaPage;
    chercher();
  }
}

/** L'entrée actuelle de l'historique vient-elle d'un clic dans la liste de cette page (pushState, JETON) ? */
function pousseeDepuisLaListe() {
  try {
    return history.state?.depuisLaListe === JETON;
  } catch {
    return false; // cadre isolé (version portable)
  }
}

/**
 * Va au mot-clé de clé `id` (null : la liste) ; l'adresse suit (pushState, ou replaceState pour `remplacer`) et garde les autres paramètres, `page` compris.
 * Revenir à la liste en remplaçant la vue d'un mot-clé ouverte par un clic de la liste, c'est retirer l'entrée que ce clic a poussée (history.back : popstate
 * réaffiche la liste, avec la saisie en cours) ; replaceState laisserait deux entrées identiques, et le premier retour arrière ne ferait rien.
 */
function aller(id, { remplacer = false } = {}) {
  if (!id && remplacer && motCle && pousseeDepuisLaListe()) {
    motCle = null; // tout de suite : une frappe avant le popstate ne revient pas une seconde fois en arrière
    afficher();
    history.back();
    return;
  }
  if (id) requeteAvantLaVue = requete();
  motCle = id;
  try {
    history[remplacer ? 'replaceState' : 'pushState'](id && !remplacer ? { depuisLaListe: JETON } : null, '', `${location.pathname}${adresseAvecMotCle(location.search, id)}`);
  } catch {
    // cadre isolé (version portable) : l'adresse ne suit pas, la page change quand même
  }
  afficher();
}

liste.addEventListener('click', (e) => {
  const lien = e.target.closest('a[href]');
  const li = lien?.closest('li[data-id]');
  if (!li || !liste.contains(li) || modifie(e)) return;
  e.preventDefault();
  aller(li.dataset.cle);
  titreVue.focus({ preventScroll: true });
  vue.scrollIntoView({ block: 'nearest' });
});
tousLesMotsCles.addEventListener('click', (e) => {
  if (modifie(e)) return;
  e.preventDefault();
  aller(null);
});
navigation.addEventListener('click', (e) => {
  const bouton = e.target.closest('button');
  if (!bouton || bouton.disabled) return;
  const genre = bouton.dataset.nav ?? 'numero';
  const voulue = genre === 'precedent' ? page - 1 : genre === 'suivant' ? page + 1 : Number(bouton.dataset.page);
  if (!Number.isInteger(voulue) || voulue === page) return;
  page = voulue;
  filtrer(requete());
  // le focus reste sur la commande employée (Précédent et Suivant) ou passe au numéro affiché ; puis le haut de la liste est ramené à l'écran
  const encore = genre === 'numero' ? null : [precedent, suivant].find((b) => b.dataset.nav === genre && !b.disabled);
  (encore ?? navigation.querySelector('[aria-current="page"]'))?.focus({ preventScroll: true });
  sectionMotsCles.scrollIntoView({ block: 'start' });
});
window.addEventListener('popstate', () => {
  motCle = motCleDeLAdresse(location.search);
  // la page de l'adresse est celle de la liste d'avant la vue ; une autre saisie depuis a changé la liste : la page 1
  page = requete() === requeteAvantLaVue ? pageDeLAdresse(location.search) : 1;
  afficher();
});
input.addEventListener('input', () => {
  page = 1; // un autre filtre : la première page
  if (motCle) aller(null, { remplacer: true }); // taper reprend la recherche : la liste revient
  else chercher();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (motCle) aller(null, { remplacer: true });
  else chercher();
});
titreVue.tabIndex = -1;
input.value = new URLSearchParams(location.search).get('q') ?? '';
requeteAvantLaVue = requete();
afficher();
