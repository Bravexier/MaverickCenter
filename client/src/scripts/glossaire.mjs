// Page /regles/glossaire/ (pages/regles/glossaire.astro) : le filtre de la liste des mots-clés (lib/glossaire-filtre.mjs : libellé, abréviation,
// définition). La saisie peut venir de l'adresse (?q=). Sur le site de dev, l'extension de l'éditeur (src/scripts/edition/mots-cles.mjs) redessine la
// liste (la base vivante ; la liste de gestion en mode modification) et l'annonce par l'évènement « glossaire:mots-cles » : la page la relit et refiltre.
// Chaque mot-clé est un <li data-id data-libelle data-abreviation data-definition> (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire).
// Script de page (navigateur) : il n'importe que lib/glossaire-filtre.mjs, qu'aucun autre script de page n'importe (la version portable refuse un module
// partagé).
import { compteDuFiltre, correspond } from '../lib/glossaire-filtre.mjs';

const champ = document.getElementById('filtre-glossaire');
const liste = document.getElementById('liste-mots-cles');
const compte = document.getElementById('glossaire-compte');
const aucun = document.getElementById('aucun-mot-cle');

let items = []; // { li, libelle, abreviation, definition }

function lireLaListe() {
  items = [...liste.querySelectorAll('li[data-id]')].map((li) => ({
    li, libelle: li.dataset.libelle ?? '', abreviation: li.dataset.abreviation ?? '', definition: li.dataset.definition ?? '',
  }));
}

function filtrer() {
  const requete = champ.value;
  let visibles = 0;
  for (const it of items) {
    const garde = correspond(it, requete);
    it.li.hidden = !garde;
    if (garde) visibles += 1;
  }
  compte.textContent = compteDuFiltre(visibles, items.length, requete);
  aucun.hidden = visibles > 0 || items.length === 0;
}

champ.addEventListener('input', filtrer);
champ.form?.addEventListener('submit', (e) => e.preventDefault());
// la liste redessinée par l'extension de l'éditeur (site de dev) : relue, puis filtrée comme avant
document.addEventListener('glossaire:mots-cles', () => {
  lireLaListe();
  filtrer();
});

const demande = new URLSearchParams(location.search).get('q');
if (demande) champ.value = demande;
lireLaListe();
filtrer();
