// Page /personnages/ (pages/personnages.astro) : charge les résumés des prétirés auprès du service (GET /api/personnages/), puis filtre et trie le
// tableau dans le navigateur (lib/personnages-liste.mjs) ; filtres et tri sont gardés dans l'adresse de la page.
// Script de page (navigateur) : il n'importe qu'un module pur que seule cette page utilise (la version portable refuse un module partagé).
import { COLONNES, FILTRES_PAR_DEFAUT, adresseDesFiltres, choixDeFiltres, filtrer, filtresDepuisAdresse, trier } from '../lib/personnages-liste.mjs';

const racine = document.getElementById('personnages');
const formulaire = document.getElementById('filtres');
const lignes = document.getElementById('lignes');
const compte = document.getElementById('compte');
let personnages = [];
let filtres = filtresDepuisAdresse(location.search);

const cellule = (contenu, classe) => {
  const td = document.createElement('td');
  if (classe) td.className = classe;
  td.append(contenu);
  return td;
};
const dateCourte = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function afficher() {
  const liste = trier(filtrer(personnages, filtres), filtres.tri, filtres.sens);
  compte.textContent = personnages.length === 0
    ? 'Aucun personnage pour l’instant : créez le premier prétiré.'
    : `${liste.length} personnage${liste.length > 1 ? 's' : ''}${liste.length !== personnages.length ? ` sur ${personnages.length}` : ''}`;
  lignes.replaceChildren(...liste.map((p) => {
    const tr = document.createElement('tr');
    for (const c of COLONNES) {
      if (c.cle === 'nom') {
        const a = document.createElement('a');
        a.href = `${racine.dataset.fiche}?id=${encodeURIComponent(p.id)}`;
        a.textContent = p.nom;
        const td = cellule(a);
        if (p.surnom) td.append(` « ${p.surnom} »`);
        tr.append(td);
      } else if (c.cle === 'statut') {
        const s = document.createElement('span');
        s.className = 'statut';
        s.dataset.statut = p.statut;
        s.textContent = c.texte(p);
        tr.append(cellule(s));
      } else if (c.cle === 'anomalies') {
        const s = document.createElement('span');
        s.className = 'regles-a-revoir';
        s.toggleAttribute('data-zero', !p.anomalies);
        s.textContent = p.anomalies ? String(p.anomalies) : '✓';
        s.title = p.anomalies ? 'Règles de la base enfreintes : voir le bas de la fiche' : 'Aucune règle enfreinte';
        tr.append(cellule(s, 'nombre'));
      } else if (c.cle === 'modifie_le') {
        tr.append(cellule(dateCourte(p.modifie_le), 'nombre'));
      } else if (c.cle === 'niveau') {
        const td = cellule(String(p.niveau_global), 'nombre');
        td.title = `${p.xp} XP`;
        tr.append(td);
      } else {
        tr.append(cellule(String(c.texte(p) ?? ''), c.nature === 'nombre' ? 'nombre' : c.cle === 'classes' || c.cle === 'magies' || c.cle === 'race' ? 'long' : undefined));
      }
    }
    return tr;
  }));
  if (personnages.length && !liste.length) {
    const tr = document.createElement('tr');
    const td = cellule('Aucun personnage ne correspond à ces filtres.', 'personnages-vide');
    td.colSpan = COLONNES.length;
    tr.append(td);
    lignes.append(tr);
  }
  for (const th of racine.querySelectorAll('th[data-cle]')) {
    const actif = th.dataset.cle === filtres.tri;
    if (actif) th.setAttribute('aria-sort', filtres.sens === 'desc' ? 'descending' : 'ascending');
    else th.removeAttribute('aria-sort');
    th.querySelector('.fleche').textContent = actif ? (filtres.sens === 'desc' ? '▼' : '▲') : '↕';
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
for (const th of racine.querySelectorAll('th[data-cle]')) {
  th.querySelector('button').addEventListener('click', () => {
    filtres = { ...filtres, sens: filtres.tri === th.dataset.cle && filtres.sens === 'asc' ? 'desc' : 'asc', tri: th.dataset.cle };
    afficher();
  });
}

async function charger() {
  try {
    const reponse = await fetch(`${racine.dataset.api}personnages/`);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    personnages = (await reponse.json()).personnages;
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
