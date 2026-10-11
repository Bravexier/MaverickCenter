// Script de /bestiaire/ (components/bestiaire/Bestiaire.astro) : pour chaque tableau `[data-bestiaire-tableau]`, la recherche, les filtres à cases
// (plusieurs valeurs : l'une OU l'autre ; plusieurs filtres : tous), le tri par en-tête et les fiches qui s'ouvrent sous leur ligne. L'état de chaque
// tableau tient dans l'adresse, sous son préfixe (lib/bestiaire-filtres.mjs) ; le lien d'une ligne (#monstre-…, #invoquee-…) ouvre sa fiche.
// Il n'importe qu'un module pur que seule cette page utilise (la version portable refuse un module partagé entre deux scripts).
import { adresseAvecEtat, basculer, effectifs, etatDepuisAdresse, filtrerEtTrier, normaliser, triSuivant } from '../lib/bestiaire-filtres.mjs';

document.documentElement.classList.add('js');
const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tableaux = [];

function brancher(section) {
  const config = {
    prefixe: section.dataset.prefixe ?? '',
    facettes: JSON.parse(section.dataset.facettes ?? '[]'),
    tris: JSON.parse(section.dataset.tris ?? '[]'),
  };
  const formulaire = section.querySelector('[data-filtres]');
  const table = section.querySelector('table.btable');
  const compte = section.querySelector('[data-compte]');
  const puces = section.querySelector('[data-puces]');
  const effacer = section.querySelector('[data-effacer]');
  const aucune = section.querySelector('[data-aucune]');
  const recherche = formulaire.elements.namedItem('q');
  const entetes = [...table.querySelectorAll('thead th[data-tri]')];
  const lignes = [...table.querySelectorAll('tbody[data-ligne]')].map((tbody) => ({
    tbody,
    id: tbody.id,
    ordre: Number(tbody.dataset.ordre),
    facettes: JSON.parse(tbody.dataset.facettes),
    tri: JSON.parse(tbody.dataset.tri),
    texteNormalise: normaliser(tbody.textContent),
  }));
  const libelles = new Map(); // `${cle}\u0000${valeur}` -> libellé
  const facettes = [...formulaire.querySelectorAll('[data-facette]')].map((details) => {
    const cle = details.dataset.facette;
    const options = [...details.querySelectorAll('input[type=checkbox]')].map((input) => {
      const li = input.closest('li');
      const libelle = li.querySelector('.bfacette__libelle').textContent;
      libelles.set(`${cle}\u0000${input.value}`, libelle);
      return { input, li, nombre: li.querySelector('[data-nombre]'), libelle: normaliser(libelle) };
    });
    return { cle, details, nom: details.querySelector('.bfacette__nom').textContent, compte: details.querySelector('[data-facette-compte]'), options, chercher: details.querySelector('[data-facette-chercher]') };
  });
  const valeurs = Object.fromEntries(facettes.map((f) => [f.cle, f.options.map((o) => o.input.value)]));
  let etat = etatDepuisAdresse(location.search, { ...config, valeurs });

  // en-têtes cliquables : croissant, décroissant, puis l'ordre du doc
  for (const th of entetes) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btri';
    bouton.textContent = th.textContent.trim();
    bouton.title = th.title ? `Trier — ${th.title}` : `Trier par ${th.textContent.trim()}`;
    th.replaceChildren(bouton);
    bouton.addEventListener('click', () => {
      etat = triSuivant(etat, th.dataset.tri);
      appliquer(true);
    });
  }
  formulaire.hidden = false;

  const singulier = section.dataset.singulier ?? 'ligne';
  const pluriel = section.dataset.pluriel ?? 'lignes';
  const nombreDe = (n) => `${n} ${n > 1 ? pluriel : singulier}`;

  function appliquer(ecrireAdresse) {
    const visibles = filtrerEtTrier(lignes, etat);
    const gardees = new Set(visibles);
    for (const l of lignes) l.tbody.hidden = !gardees.has(l);
    for (const l of [...visibles, ...lignes.filter((x) => !gardees.has(x))]) table.append(l.tbody);
    for (const th of entetes) th.setAttribute('aria-sort', etat.tri === th.dataset.tri ? (etat.sens === 'desc' ? 'descending' : 'ascending') : 'none');
    // filtres : cases, effectifs (parmi les lignes qui passent les AUTRES filtres), nombre de valeurs cochées
    for (const f of facettes) {
      const choisies = new Set(etat.facettes[f.cle] ?? []);
      const n = effectifs(lignes, etat, f.cle);
      for (const o of f.options) {
        o.input.checked = choisies.has(o.input.value);
        const k = n.get(o.input.value) ?? 0;
        o.nombre.textContent = String(k);
        o.li.classList.toggle('est-vide', k === 0 && !o.input.checked);
      }
      f.compte.hidden = choisies.size === 0;
      f.compte.textContent = String(choisies.size);
      f.details.classList.toggle('est-active', choisies.size > 0);
    }
    if (recherche.value !== etat.q && document.activeElement !== recherche) recherche.value = etat.q;
    // puces des filtres actifs (un clic retire la valeur)
    puces.replaceChildren(
      ...facettes.flatMap((f) =>
        (etat.facettes[f.cle] ?? []).map((v) => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'bpuce';
          b.textContent = `${f.nom} : ${libelles.get(`${f.cle}\u0000${v}`) ?? v}`;
          b.setAttribute('aria-label', `Retirer le filtre ${b.textContent}`);
          b.addEventListener('click', () => {
            etat = basculer(etat, f.cle, v, false);
            appliquer(true);
          });
          li.append(b);
          return li;
        }),
      ),
    );
    const filtre = Boolean(etat.q) || Object.keys(etat.facettes).length > 0;
    effacer.hidden = !filtre;
    compte.textContent = filtre ? `${nombreDe(visibles.length)} sur ${lignes.length}.` : `${nombreDe(lignes.length)}.`;
    aucune.hidden = visibles.length > 0;
    if (ecrireAdresse) history.replaceState(null, '', location.pathname + adresseAvecEtat(location.search, etat, config) + location.hash);
  }

  let attente = 0;
  recherche.addEventListener('input', () => {
    clearTimeout(attente);
    attente = setTimeout(() => {
      etat = { ...etat, q: recherche.value };
      appliquer(true);
    }, 150);
  });
  formulaire.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'checkbox') return;
    etat = basculer(etat, input.name, input.value, input.checked);
    appliquer(true);
  });
  formulaire.addEventListener('reset', (e) => {
    e.preventDefault();
    etat = { q: '', facettes: {}, tri: etat.tri, sens: etat.sens };
    recherche.value = '';
    appliquer(true);
  });
  formulaire.addEventListener('submit', (e) => e.preventDefault());
  // recherche dans les valeurs d'un filtre (liste longue : capacités, lieux)
  for (const f of facettes) {
    f.chercher?.addEventListener('input', () => {
      const mots = normaliser(f.chercher.value).split(' ').filter(Boolean);
      for (const o of f.options) o.li.hidden = !mots.every((m) => o.libelle.includes(m));
    });
    f.details.addEventListener('toggle', () => {
      if (f.details.open) for (const autre of facettes) if (autre !== f) autre.details.open = false;
    });
  }

  // fiches : un clic sur le nom (ou la ligne) ouvre la fiche sous la ligne, une seule à la fois par tableau
  const bouton = (l) => l.tbody.querySelector('.bligne__ouvrir');
  const fiche = (l) => l.tbody.querySelector('.bligne__fiche');
  function fermer() {
    for (const l of lignes) {
      if (!l.tbody.classList.contains('est-ouverte')) continue;
      const f = fiche(l);
      const focus = f.contains(document.activeElement);
      l.tbody.classList.remove('est-ouverte');
      bouton(l).setAttribute('aria-expanded', 'false');
      f.hidden = true;
      if (focus) bouton(l).focus();
    }
  }
  function ouvrir(l, defiler) {
    fermer();
    l.tbody.classList.add('est-ouverte');
    bouton(l).setAttribute('aria-expanded', 'true');
    fiche(l).hidden = false;
    // la ligne en haut du cadre, sous l'en-tête fixe (scroll-margin-top), sa fiche dessous
    if (defiler) l.tbody.querySelector('.bligne__principale').scrollIntoView({ block: 'start', behavior: reduit() ? 'auto' : 'smooth' });
    history.replaceState(null, '', `${location.pathname}${location.search}#${l.id}`);
  }
  function toutFermer() {
    const ouverte = lignes.some((l) => l.tbody.classList.contains('est-ouverte'));
    fermer();
    if (ouverte && lignes.some((l) => `#${l.id}` === location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  table.addEventListener('click', (e) => {
    const cible = e.target;
    const tbody = cible.closest('tbody[data-ligne]');
    const l = tbody && lignes.find((x) => x.tbody === tbody);
    if (!l) return;
    if (cible.closest('.bfiche__fermer')) {
      toutFermer();
      bouton(l).focus();
      return;
    }
    if (!cible.closest('.bligne__principale') || cible.closest('a, input, select, textarea')) return;
    if (!cible.closest('button') && (getSelection()?.toString() ?? '') !== '') return;
    if (l.tbody.classList.contains('est-ouverte')) toutFermer();
    else ouvrir(l, true);
  });
  tableaux.push({ lignes, ouvrir, toutFermer, appliquer, formulaire, facettes });
  appliquer(false);
}

for (const section of document.querySelectorAll('[data-bestiaire-tableau]')) brancher(section);

// adresse #monstre-… / #invoquee-… : ouvre cette fiche (l'onglet qui la contient est ouvert par components/Onglets.astro)
function depuisAdresse() {
  let id = '';
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  for (const t of tableaux) {
    const l = t.lignes.find((x) => x.id === id);
    if (l) {
      if (l.tbody.hidden) {
        // ligne cachée par les filtres : on les retire pour la montrer
        t.formulaire.dispatchEvent(new Event('reset', { cancelable: true }));
      }
      t.ouvrir(l, true);
    }
  }
}
window.addEventListener('hashchange', depuisAdresse);
depuisAdresse();

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ouvert = document.querySelector('.bfacette[open]');
  if (ouvert) {
    ouvert.open = false;
    ouvert.querySelector('summary').focus();
    return;
  }
  if (!e.target.closest?.('input, textarea, select')) for (const t of tableaux) t.toutFermer();
});
// un clic hors d'un menu de filtre le ferme
document.addEventListener('click', (e) => {
  for (const d of document.querySelectorAll('.bfacette[open]')) if (!d.contains(e.target)) d.open = false;
});
