// Page /regles/glossaire/ (pages/regles/glossaire.astro) : les deux filtres du tableau des mots-clés (décision R234 (4) : un filtre texte, qui lit le
// libellé, les synonymes et la définition, et un filtre par catégorie ; lib/glossaire-filtre.mjs). La saisie peut venir de l'adresse (?q=). Sur le site
// de dev, l'extension de l'éditeur (src/scripts/edition/mots-cles.mjs) redessine le tableau (la base vivante ; la gestion en mode modification) et
// l'annonce par l'évènement « glossaire:mots-cles » (detail.categories : les catégories des mots-clés, [{ id, libelle }], quand elles ont pu changer) :
// la page relit les lignes, refait la liste des catégories, et refiltre.
// Chaque mot-clé est un <tbody data-id data-libelle data-synonymes data-definition data-categories> (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire).
// Script de page (navigateur) : il n'importe que lib/glossaire-filtre.mjs, qu'aucun autre script de page n'importe (la version portable refuse un module
// partagé).
import { categorieChoisie, compteDuFiltre, correspond, motCleDeLaLigne } from '../lib/glossaire-filtre.mjs';

const champ = document.getElementById('filtre-glossaire');
const choixDeCategorie = document.getElementById('filtre-categorie');
const tableau = document.getElementById('liste-mots-cles');
const compte = document.getElementById('glossaire-compte');
const aucun = document.getElementById('aucun-mot-cle');

let items = []; // { ligne, libelle, synonymes, definition, categories }

function lireLeTableau() {
  items = [...tableau.querySelectorAll('tbody[data-id]')].map((ligne) => ({ ligne, ...motCleDeLaLigne(ligne.dataset) }));
}

/** La liste des catégories du filtre refaite (`categories` : [{ id, libelle }]), le choix en cours gardé s'il existe encore. */
function refaireLesCategories(categories) {
  if (!choixDeCategorie || !Array.isArray(categories)) return;
  const avant = choixDeCategorie.value;
  // « Toutes les catégories » et « Sans catégorie » restent en tête
  const fixes = [...choixDeCategorie.querySelectorAll('option[value=""], option[value="sans"]')];
  const options = categories.map((c) => {
    const o = document.createElement('option');
    o.value = String(c.id);
    o.textContent = c.libelle;
    return o;
  });
  choixDeCategorie.replaceChildren(...fixes, ...options);
  choixDeCategorie.value = avant === 'sans' || categories.some((c) => String(c.id) === avant) ? avant : '';
}

function filtrer() {
  const requete = champ.value;
  const categorie = categorieChoisie(choixDeCategorie?.value);
  let visibles = 0;
  for (const it of items) {
    const garde = correspond(it, requete, { categorie });
    it.ligne.hidden = !garde;
    if (garde) visibles += 1;
  }
  compte.textContent = compteDuFiltre(visibles, items.length, requete, { categorie });
  aucun.hidden = visibles > 0 || items.length === 0;
}

champ.addEventListener('input', filtrer);
choixDeCategorie?.addEventListener('change', filtrer);
champ.form?.addEventListener('submit', (e) => e.preventDefault());
// le tableau redessiné par l'extension de l'éditeur (site de dev) : relu, puis filtré comme avant
document.addEventListener('glossaire:mots-cles', (e) => {
  refaireLesCategories(e.detail?.categories);
  lireLeTableau();
  filtrer();
});

const demande = new URLSearchParams(location.search).get('q');
if (demande) champ.value = demande;
lireLeTableau();
filtrer();
