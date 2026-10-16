// Page /recherche/ (pages/recherche.astro) : la recherche dans l'index (pages du wiki et événements de la chronologie, /search-index.json), la liste des
// mots-clés filtrée par leur écriture, et les pages d'un mot-clé (demande du propriétaire : « cliquer sur un mot clé lance une recherche sur ce mot clé
// et liste les éléments qui ont ce mot clé » ; les événements de la chronologie n'ont pas de mot-clé, mais des catégories) : /recherche/?mot-cle=<id>, état
// gardé dans l'adresse (history.pushState, retour arrière compris, adresse lue au chargement). Un id que le vocabulaire n'a pas (mot-clé supprimé ou
// fusionné depuis) : « Ce mot-clé n'existe plus ». Taper ou chercher depuis la vue d'un mot-clé ouverte par un clic de la liste revient à la liste par un
// retour arrière (l'entrée poussée par le clic est retirée, l'historique ne garde pas deux fois la liste) ; ouverte par son adresse, la vue est remplacée.
// La liste est le glossaire (migration 0056) : tous les mots-clés, même sans page ; la vue d'un mot-clé montre son libellé, sa définition, puis ses pages.
// Sur le site de dev, l'extension de l'éditeur (src/scripts/edition/mots-cles.mjs) redessine la liste (comptes et définitions de la base vivante, liste de
// gestion en mode modification) et l'annonce par l'évènement « recherche:mots-cles » (detail.gestion : la liste de gestion est affichée) : la page la
// relit alors. Chaque mot-clé de la liste est un <li data-id data-cle data-n data-libelle data-definition> (data-cle : son écriture, que filtre la
// recherche ; data-n : ses pages ; data-definition : sa définition, absente tant qu'il n'est pas décrit).
// Script de page (navigateur) : il n'importe que des modules purs qu'aucun autre script de page n'importe (la version portable refuse un module partagé).
import { adresseAvecMotCle, motCleDeLAdresse, motsClesAffiches, vueDuMotCle } from '../lib/recherche-mots-cles.mjs';
import { searchIndex } from '../lib/search.mjs';

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
const compteVue = document.getElementById('vue-du-mot-cle-compte');
const vuePages = document.getElementById('vue-du-mot-cle-pages');
const tousLesMotsCles = document.getElementById('tous-les-mots-cles');

// data-base : préfixe des pages du site (absolu, ou relatif dans la version portable) ; data-suffix : « index.html » si requis.
const base = form.dataset.base.replace(/\/?$/, '/');
const suffixe = form.dataset.suffix ?? '';
const titreDeLaPage = document.title;

let index; // promesse de l'index (chargé une fois : à la première recherche ou au premier mot-clé affiché)
let motCle = motCleDeLAdresse(location.search); // le mot-clé affiché (son id) ; null : la liste des mots-clés
let items = []; // les mots-clés de la liste : { li, id, cle, n, libelle, definition }
let demandes = 0; // la dernière vue demandée (un chargement plus ancien ne l'écrase pas)
// l'entrée de l'historique poussée par un clic dans la liste porte ce jeton (history.state.depuisLaListe) ; un par chargement de la page : après un
// rechargement, l'entrée d'avant n'est plus ce document, et un retour arrière perdrait la saisie
const JETON = `${Date.now()}-${Math.random()}`;

const nombre = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const modifie = (e) => e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey; // nouvel onglet, etc. : le navigateur suit le lien

function lireLaListe() {
  items = [...liste.querySelectorAll('li[data-id]')].map((li) => ({
    li, id: li.dataset.id, cle: li.dataset.cle ?? '', n: Number(li.dataset.n) || 0, libelle: li.dataset.libelle ?? '', definition: li.dataset.definition ?? '',
  }));
}

function chargerIndex() {
  index ??= fetch(form.dataset.indexUrl)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .catch((e) => {
      index = undefined; // réessayé à la demande suivante
      throw e;
    });
  return index;
}

/** Une ligne de résultat : le lien, le type en pastille, le résumé (la date d'un événement). */
function ligneDElement(element) {
  const li = document.createElement('li');
  const a = Object.assign(document.createElement('a'), { href: `${base}${element.path}${suffixe}${element.ancre ? `#${element.ancre}` : ''}`, textContent: element.title });
  const badge = Object.assign(document.createElement('span'), { className: 'badge', textContent: element.type });
  li.append(a, ' ', badge);
  if (element.summary) li.append(Object.assign(document.createElement('div'), { className: 'muted', textContent: element.summary }));
  return li;
}

/** Mots-clés : ceux dont l'écriture correspond (tous sans recherche), qu'une page les porte ou non (le glossaire). Rend leur nombre. */
function filtrer(query) {
  const gardes = new Set(motsClesAffiches(items, query, { tous: true }));
  for (const m of items) m.li.hidden = !gardes.has(m);
  nombreMotsCles.textContent = `(${gardes.size})`;
  aucunMotCle.hidden = gardes.size > 0 || !items.length;
  return gardes.size;
}

async function chercher() {
  const query = input.value.trim();
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
  if (input.value.trim() !== query || motCle) return; // une frappe plus récente, ou un mot-clé, a pris la main pendant le chargement
  const hits = searchIndex(donnees, query);
  statut.textContent = `${nombre(hits.length, 'résultat', 'résultats')}, ${nombre(trouves, 'mot-clé', 'mots-clés')}`;
  sectionResultats.hidden = hits.length === 0;
  resultats.replaceChildren(...hits.map(ligneDElement));
}

/** La vue d'un mot-clé (lib/recherche-mots-cles.mjs#vueDuMotCle) : son titre, sa définition et ses pages ; ou « Ce mot-clé n'existe plus ». */
function montrer(v) {
  vuePages.hidden = true;
  definitionVue.hidden = !v.existe || !v.definition;
  definitionVue.textContent = v.existe ? v.definition : '';
  if (!v.existe) {
    titreVue.textContent = 'Ce mot-clé n’existe plus';
    compteVue.textContent = 'Il a été supprimé, ou fusionné dans un autre mot-clé. Choisissez-en un parmi tous les mots-clés.';
    document.title = `Mot-clé introuvable — ${titreDeLaPage}`;
    return;
  }
  titreVue.textContent = `Mot-clé « ${v.libelle} »`;
  vuePages.replaceChildren(...v.pages.map(ligneDElement));
  vuePages.hidden = v.pages.length === 0;
  compteVue.textContent = v.pages.length ? `${nombre(v.pages.length, 'page', 'pages')}.` : 'Aucune page ne porte ni ne cite ce mot-clé.';
  document.title = `${titreVue.textContent} — ${titreDeLaPage}`;
}

async function afficherLeMotCle() {
  const id = motCle;
  const demande = ++demandes;
  // le vocabulaire de la liste (tous les mots-clés du glossaire) dit si l'id existe et le décrit ; l'index donne ses pages
  const vocabulaire = new Map(items.map((m) => [m.id, { libelle: m.libelle, definition: m.definition }]));
  titreVue.textContent = vocabulaire.has(id) ? `Mot-clé « ${vocabulaire.get(id).libelle} »` : 'Mot-clé';
  definitionVue.hidden = !vocabulaire.get(id)?.definition;
  definitionVue.textContent = vocabulaire.get(id)?.definition ?? '';
  compteVue.textContent = 'Chargement…';
  vuePages.hidden = true;
  let donnees;
  try {
    donnees = await chargerIndex();
  } catch {
    if (demande === demandes) compteVue.textContent = 'Impossible de charger l’index de recherche.';
    return;
  }
  if (demande !== demandes || motCle !== id) return;
  montrer(vueDuMotCle(donnees, id, vocabulaire));
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
 * Va au mot-clé `id` (null : la liste) ; l'adresse suit (pushState, ou replaceState pour `remplacer`). Revenir à la liste en remplaçant la vue d'un
 * mot-clé ouverte par un clic de la liste, c'est retirer l'entrée que ce clic a poussée (history.back : popstate réaffiche la liste, avec la saisie en
 * cours) ; replaceState laisserait deux entrées identiques, et le premier retour arrière ne ferait rien.
 */
function aller(id, { remplacer = false } = {}) {
  if (!id && remplacer && motCle && pousseeDepuisLaListe()) {
    motCle = null; // tout de suite : une frappe avant le popstate ne revient pas une seconde fois en arrière
    afficher();
    history.back();
    return;
  }
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
  aller(li.dataset.id);
  titreVue.focus({ preventScroll: true });
  vue.scrollIntoView({ block: 'nearest' });
});
tousLesMotsCles.addEventListener('click', (e) => {
  if (modifie(e)) return;
  e.preventDefault();
  aller(null);
});
window.addEventListener('popstate', () => {
  motCle = motCleDeLAdresse(location.search);
  afficher();
});
input.addEventListener('input', () => {
  if (motCle) aller(null, { remplacer: true }); // taper reprend la recherche : la liste revient
  else chercher();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (motCle) aller(null, { remplacer: true });
  else chercher();
});
// la liste redessinée par l'extension de l'éditeur (site de dev) : relue ; la liste de gestion s'affiche à la place de la vue d'un mot-clé
document.addEventListener('recherche:mots-cles', (e) => {
  lireLaListe();
  if (e.detail?.gestion && motCle) aller(null, { remplacer: true });
  else afficher();
});

titreVue.tabIndex = -1;
input.value = new URLSearchParams(location.search).get('q') ?? '';
lireLaListe();
afficher();
