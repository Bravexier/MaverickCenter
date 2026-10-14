// Page /personnages/ (pages/personnages.astro) : charge les résumés des prétirés auprès du service (GET /api/personnages/), puis filtre et trie la
// liste dans le navigateur (lib/personnages-liste.mjs) ; filtres et tri sont gardés dans l'adresse de la page. Chaque ligne est un lien vers la fiche
// (toute la ligne, pas le nom seul : demande du propriétaire), bordée de la couleur de sa magie (couleursDeBordure) ; le portrait vient de
// GET /api/personnages/<id>/portrait/ (la liste n'en a que l'empreinte et le cadrage), le logo en attendant une image.
// Script de page (navigateur) : il n'importe qu'un module pur que seule cette page utilise (la version portable refuse un module partagé).
import {
  COLONNES, FILTRES_PAR_DEFAUT, adresseDesFiltres, adresseDuPortrait, choixDeFiltres, couleursDeBordure, filtrer, filtresDepuisAdresse, trier,
} from '../lib/personnages-liste.mjs';

const racine = document.getElementById('personnages');
const formulaire = document.getElementById('filtres');
const lignes = document.getElementById('lignes');
const compte = document.getElementById('compte');
const couleurs = JSON.parse(racine.dataset.couleurs || '{}');
let personnages = [];
let charge = false; // la liste reçue du service : avant (ou s'il ne répond pas), ni tri ni filtre n'affichent quoi que ce soit
let filtres = filtresDepuisAdresse(location.search);

const element = (balise, classe, contenu) => {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (contenu !== undefined) e.append(contenu);
  return e;
};

/** Le portrait d'une ligne : le carré cadré de l'image (style calculé par le service, lib/portrait.mjs#styleDuCadrage), ou le logo. */
function portrait(p) {
  const cadre = element('span', 'perso__portrait');
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  const adresse = adresseDuPortrait(racine.dataset.api, p);
  if (adresse) {
    img.src = adresse;
    img.setAttribute('style', p.portrait.style);
    img.addEventListener('error', () => {
      img.removeAttribute('style');
      img.src = racine.dataset.logo;
      cadre.toggleAttribute('data-vide', true);
    }, { once: true });
  } else {
    img.src = racine.dataset.logo;
    cadre.toggleAttribute('data-vide', true);
  }
  cadre.append(img);
  return cadre;
}

function ligne(p) {
  const a = element('a', 'perso');
  a.href = `${racine.dataset.fiche}?id=${encodeURIComponent(p.id)}`;
  const bordure = couleursDeBordure(p, couleurs);
  if (bordure) for (const [variable, couleur] of Object.entries(bordure)) a.style.setProperty(variable, couleur);
  for (const c of COLONNES) {
    if (c.cle === 'portrait') {
      a.append(portrait(p));
    } else if (c.cle === 'niveau') {
      const n = element('span', 'col col--niveau', element('span', 'hors-ecran', `${c.titre} `));
      n.append(String(p.niveau_global));
      n.title = `${p.xp} XP`;
      a.append(n);
    } else {
      a.append(element('span', `col col--${c.cle}`, String(c.texte(p) ?? '')));
    }
  }
  return element('li', null, a);
}

function afficher() {
  if (!charge) return;
  const liste = trier(filtrer(personnages, filtres), filtres.tri, filtres.sens);
  compte.textContent = personnages.length === 0
    ? 'Aucun personnage pour l’instant.'
    : `${liste.length} personnage${liste.length > 1 ? 's' : ''}${liste.length !== personnages.length ? ` sur ${personnages.length}` : ''}`;
  lignes.replaceChildren(...liste.map(ligne));
  if (personnages.length && !liste.length) lignes.append(element('li', 'personnages-vide', 'Aucun personnage ne correspond à ces filtres.'));
  for (const bouton of racine.querySelectorAll('#tete button[data-cle]')) {
    const actif = bouton.dataset.cle === filtres.tri;
    const titre = COLONNES.find((c) => c.cle === bouton.dataset.cle).titre;
    bouton.toggleAttribute('data-actif', actif);
    bouton.setAttribute('aria-label', actif
      ? `${titre} : trié par ordre ${filtres.sens === 'desc' ? 'décroissant' : 'croissant'} (cliquer pour inverser)`
      : `Trier par ${titre.toLowerCase()}`);
    bouton.querySelector('.fleche').textContent = actif ? (filtres.sens === 'desc' ? '▼' : '▲') : '↕';
  }
  history.replaceState(null, '', `${location.pathname}${adresseDesFiltres(filtres)}`);
}

function remplirFormulaire() {
  const choix = choixDeFiltres(personnages);
  for (const [nom, liste] of [['race', choix.races], ['magie', choix.magies], ['classe', choix.classes]]) {
    const select = formulaire.elements.namedItem(nom);
    select.replaceChildren(select.options[0], ...liste.map((x) => new Option(x.nom, x.id)));
  }
  for (const [cle, valeur] of Object.entries(filtres)) {
    const champ = formulaire.elements.namedItem(cle);
    if (champ) champ.value = valeur;
  }
}

formulaire.addEventListener('input', () => {
  for (const cle of Object.keys(FILTRES_PAR_DEFAUT)) {
    const champ = formulaire.elements.namedItem(cle);
    if (champ) filtres[cle] = champ.value;
  }
  afficher();
});
formulaire.addEventListener('submit', (ev) => ev.preventDefault());
formulaire.addEventListener('reset', () => {
  setTimeout(() => {
    filtres = { ...FILTRES_PAR_DEFAUT, tri: filtres.tri, sens: filtres.sens };
    remplirFormulaire();
    afficher();
  });
});
for (const bouton of racine.querySelectorAll('#tete button[data-cle]')) {
  bouton.addEventListener('click', () => {
    filtres = { ...filtres, sens: filtres.tri === bouton.dataset.cle && filtres.sens === 'asc' ? 'desc' : 'asc', tri: bouton.dataset.cle };
    afficher();
  });
}

async function charger() {
  try {
    const reponse = await fetch(`${racine.dataset.api}personnages/`);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    personnages = (await reponse.json()).personnages;
    charge = true;
  } catch {
    const b = document.getElementById('indisponible');
    b.textContent = 'Le service des personnages n’est pas joignable : la liste ne peut pas être chargée pour le moment.';
    b.hidden = false;
    compte.textContent = '';
    return;
  }
  remplirFormulaire();
  afficher();
}

charger();
