// Page /regles/glossaire/ (pages/regles/glossaire.astro) : les deux filtres du tableau des mots-clés (décision R234 (4) : un filtre texte, qui lit le
// libellé, les synonymes, la définition et, sans définition écrite, le texte de l'élément que la sous-ligne montre ; et un filtre par type ; lib/glossaire-filtre.mjs),
// puis sa pagination (R309, §9 : 50 lignes par page, `?page=` dans l'adresse, la navigation sous le tableau). La saisie peut venir de l'adresse (?q=).
// Les filtres portent sur tout le registre, puis la pagination s'applique ; changer de filtre revient à la page 1. Sans JavaScript, la navigation n'existe
// pas et tout s'affiche (la page construite cache les lignes d'après la première page, qu'un <noscript> redonne).
// Sur le site de dev, l'extension de l'éditeur (src/scripts/edition/mots-cles.mjs) redessine le tableau (la base vivante ; la gestion en mode modification)
// et l'annonce par l'évènement « glossaire:mots-cles » (detail.categories : les catégories des mots-clés, [{ id, libelle }], quand elles ont pu changer ;
// detail.voir : l'id d'un mot-clé à montrer, sa page est alors affichée) : la page relit les lignes, refait la liste des types, et réapplique filtres et pagination.
// Chaque mot-clé est un <tbody data-id data-libelle data-synonymes data-definition data-categories> (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire) ;
// le texte de son élément est lu dans `.glossaire-mot__element` de sa sous-ligne (sans second attribut de données), une seule fois par ligne, à la relecture.
// Script de page (navigateur) : il n'importe que lib/glossaire-filtre.mjs, qu'aucun autre script de page n'importe (la version portable refuse un module
// partagé).
import {
  categorieChoisie, compteDuFiltre, correspond, motCleDeLaLigne, normaliser, numerosDePage, pageDeLaListe, pageDeLAdresse, rechercheAvecPage, SANS_CATEGORIE,
  TAILLE_DE_PAGE_DU_GLOSSAIRE, texteDuMotCle,
} from '../lib/glossaire-filtre.mjs';

const champ = document.getElementById('filtre-glossaire');
const choixDeCategorie = document.getElementById('filtre-categorie');
const tableau = document.getElementById('liste-mots-cles');
const compte = document.getElementById('glossaire-compte');
const aucun = document.getElementById('aucun-mot-cle');
const cadre = tableau.closest('.tableau') ?? tableau; // le cadre du gabarit commun des tableaux (components/Tableau.astro)

let items = []; // { ligne, libelle, synonymes, definition, categories, recherche (le texte normalisé où se cherche le mot-clé) }
let page = pageDeLAdresse(location.search);

function lireLeTableau() {
  items = [...tableau.querySelectorAll('tbody[data-id]')].map((ligne) => {
    const mot = motCleDeLaLigne(ligne.dataset);
    const element = ligne.querySelector('.glossaire-mot__element')?.textContent ?? '';
    return { ligne, ...mot, recherche: texteDuMotCle({ ...mot, element }) };
  });
}

const valeurDe = (option) => option.getAttribute('value') ?? '';
function uneOption(valeur, libelle) {
  const o = document.createElement('option');
  o.setAttribute('value', valeur);
  o.textContent = libelle;
  return o;
}

/**
 * La liste des types du filtre refaite : « Tous les types » en tête, « Sans catégorie » seulement quand un mot-clé est à classer (`hidden` sur une option
 * n'est pas respecté par Safari : elle n'est pas dans la liste), puis les catégories (`categories` : [{ id, libelle }] ; sans elle, celles de la liste). Le
 * choix en cours est gardé s'il existe encore.
 */
function refaireLesCategories(categories) {
  if (!choixDeCategorie) return;
  const avant = choixDeCategorie.value;
  const options = [...choixDeCategorie.querySelectorAll('option')];
  const toutes = options.find((o) => valeurDe(o) === '');
  const sans = options.find((o) => valeurDe(o) === SANS_CATEGORIE) ?? uneOption(SANS_CATEGORIE, 'Sans catégorie');
  const types = Array.isArray(categories) ? categories.map((c) => uneOption(String(c.id), c.libelle))
    : options.filter((o) => ![SANS_CATEGORIE, ''].includes(valeurDe(o)));
  const aClasser = items.some((it) => !it.categories.length);
  choixDeCategorie.replaceChildren(...[toutes, ...(aClasser ? [sans] : []), ...types].filter(Boolean));
  const garde = avant === SANS_CATEGORIE ? aClasser : types.some((o) => valeurDe(o) === avant);
  choixDeCategorie.value = garde ? avant : '';
}

// La navigation, sous le tableau (créée ici : sans JavaScript, elle n'existe pas). Précédent, les numéros (`numerosDePage` : jamais les 36), suivant, et
// l'état annoncé aux lecteurs d'écran.
const navigation = document.createElement('nav');
navigation.className = 'glossaire-pages';
navigation.setAttribute('aria-label', 'Pages du glossaire');
navigation.hidden = true;
const precedent = document.createElement('button');
const suivant = document.createElement('button');
for (const [b, nom, texte] of [[precedent, 'precedent', 'Précédent'], [suivant, 'suivant', 'Suivant']]) {
  b.type = 'button';
  b.className = 'glossaire-pages__bouton';
  b.dataset.nav = nom;
  b.textContent = texte;
}
const numeros = document.createElement('ol');
numeros.className = 'glossaire-pages__numeros';
const etat = document.createElement('p');
etat.className = 'glossaire-pages__etat muted';
etat.setAttribute('aria-live', 'polite');
navigation.append(precedent, numeros, suivant, etat);
cadre.after(navigation);

function dessinerLaNavigation(courante, pages) {
  navigation.hidden = pages <= 1;
  precedent.disabled = courante <= 1;
  suivant.disabled = courante >= pages;
  numeros.replaceChildren(...numerosDePage(courante, pages).map((n) => {
    const li = document.createElement('li');
    if (n === null) {
      li.className = 'glossaire-pages__trou';
      li.textContent = '…';
      return li;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'glossaire-pages__bouton';
    b.dataset.page = String(n);
    b.textContent = String(n);
    b.setAttribute('aria-label', `Page ${n}`);
    if (n === courante) b.setAttribute('aria-current', 'page');
    li.append(b);
    return li;
  }));
  etat.textContent = pages > 1 ? `Page ${courante} sur ${pages}` : '';
}

/** Le numéro de page dans l'adresse (les autres paramètres et le fragment gardés ; la page 1 sans « page »), sans nouvelle entrée de l'historique. */
function garderLAdresse() {
  const recherche = rechercheAvecPage(location.search, page);
  if (recherche !== location.search) history.replaceState(history.state, '', `${location.pathname}${recherche}${location.hash}`);
}

/** Les mots-clés qui passent les deux filtres, dans l'ordre du tableau. */
function lesGardes() {
  const requete = normaliser(champ.value);
  const categorie = categorieChoisie(choixDeCategorie?.value);
  return { gardes: items.filter((it) => correspond(it, requete, { categorie })), categorie };
}

/** Applique les filtres à tout le registre, puis la pagination : seules les lignes de la page ont `hidden` à faux ; n'écrit `hidden` que s'il change. */
function afficher() {
  const { gardes, categorie } = lesGardes();
  const p = pageDeLaListe(gardes.length, page, TAILLE_DE_PAGE_DU_GLOSSAIRE);
  page = p.page;
  const dePage = new Set(gardes.slice(p.debut, p.fin));
  for (const it of items) {
    const cache = !dePage.has(it);
    if (it.ligne.hidden !== cache) it.ligne.hidden = cache;
  }
  compte.textContent = compteDuFiltre(gardes.length, items.length, champ.value, { categorie });
  aucun.hidden = gardes.length > 0 || items.length === 0;
  dessinerLaNavigation(p.page, p.pages);
  garderLAdresse();
}

/** Un filtre qui change : retour à la première page. */
function filtrer() {
  page = 1;
  afficher();
}

navigation.addEventListener('click', (e) => {
  const bouton = e.target.closest('button');
  if (!bouton || bouton.disabled) return;
  const genre = bouton.dataset.nav ?? 'numero';
  const voulue = genre === 'precedent' ? page - 1 : genre === 'suivant' ? page + 1 : Number(bouton.dataset.page);
  if (!Number.isInteger(voulue) || voulue === page) return;
  page = voulue;
  afficher();
  // le focus reste sur la commande employée (Précédent et Suivant) ou passe au numéro affiché ; puis le haut du tableau est ramené à l'écran
  const encore = genre === 'numero' ? null : [precedent, suivant].find((b) => b.dataset.nav === genre && !b.disabled);
  (encore ?? navigation.querySelector('[aria-current="page"]'))?.focus({ preventScroll: true });
  cadre.scrollIntoView({ block: 'start' });
});

champ.addEventListener('input', filtrer);
choixDeCategorie?.addEventListener('change', filtrer);
champ.form?.addEventListener('submit', (e) => e.preventDefault());
// le tableau redessiné par l'extension de l'éditeur (site de dev) : relu, la liste des types refaite, puis filtré et paginé comme avant (la page courante est
// gardée, ou celle du mot-clé à montrer)
document.addEventListener('glossaire:mots-cles', (e) => {
  lireLeTableau();
  refaireLesCategories(e.detail?.categories);
  if (e.detail?.voir !== undefined) {
    const i = lesGardes().gardes.findIndex((it) => it.ligne.dataset.id === String(e.detail.voir));
    if (i >= 0) page = Math.floor(i / TAILLE_DE_PAGE_DU_GLOSSAIRE) + 1;
  }
  afficher();
});

const demande = new URLSearchParams(location.search).get('q');
if (demande) champ.value = demande;
lireLeTableau();
afficher();
