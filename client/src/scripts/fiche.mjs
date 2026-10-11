// Formulaire de la page /fiche/ (pages/fiche/index.astro) : construit les étapes à partir des règles de la base (/fiche/regles.json), garde la
// fiche en cours au format d'échange (lib/fiche-format.mjs), recalcule ce qui en découle à chaque saisie (lib/fiche-moteur.mjs) et l'enregistre
// auprès du service des personnages (/api/personnages/, docs/serveur.md). Création et modification sur le même écran : /fiche/?id=<id>.
// Script de page (navigateur) : il n'importe que des modules purs que seule cette page utilise (la version portable refuse un module partagé).
import { libelleDuControle } from '../lib/fiche-controles.mjs';
import { CHAMP_VERSION, COLONNES_DU_SERVICE, PARTIES_DE_FICHE, ficheVide } from '../lib/fiche-format.mjs';
import {
  attributsDe, budgetCaracteristiques, budgetCompetences, caracteristiquesCompletes, caracteristiquesDe, classeImposee, classesDe, classesSelonLaMagieInnee,
  competencesDe, donsAChoisir, donsValables, emplacementsDeSorts, ethnieCompatible, ethniesDeLaRace, lignesDeSorts, magiesInneesPermises, maitriseDArme,
  maitriseDesSorts, niveauGlobal, nmDuSort, npmMax, progressionAttendue, progressionXp, refusClasse, refusMagieAcquise, trouver,
} from '../lib/fiche-moteur.mjs';

const racine = document.getElementById('fiche');
const API = racine.dataset.api;
const $ = (id) => document.getElementById(id);

let regles = null;
let fiche = ficheVide('');
let id = null;
let version = null;
let controles = null;
let modifie = false;
let serviceJoignable = true;
const noms = new Map();
/** Fonctions qui alignent les champs et les états sur la fiche, par conteneur (remplacées quand le conteneur est reconstruit). */
const synchros = new Map();
let enConstruction = null;
/** Calculs du moteur, refaits une fois par rafraîchissement et lus par les synchronisations. */
let calcul = null;

// ------------------------------------------------------------------ outils
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const x of enfants.flat(Infinity)) if (x !== null && x !== undefined && x !== false) e.append(x instanceof Node ? x : String(x));
  return e;
}
const option = (valeur, texte, choisie = false) => el('option', { value: valeur ?? '', selected: choisie }, texte);
const entier = (v, vide = 0) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? vide : Math.trunc(Number(v)));
const signe = (n) => (n > 0 ? `+${n}` : String(n));

function message(texte, ton = '') {
  const m = $('fiche-message');
  m.textContent = texte;
  m.dataset.ton = ton;
}

/** Garde la valeur d'un champ alignée sur la fiche sans déplacer le curseur de qui tape. */
function poser(champ, valeur) {
  if (champ.type === 'checkbox') champ.checked = Boolean(valeur);
  else {
    const texte = valeur === null || valeur === undefined ? '' : String(valeur);
    if (champ.value !== texte) champ.value = texte;
  }
}

/** Enregistre une synchronisation pour le conteneur en cours de construction. */
function synchro(fn) {
  if (!synchros.has(enConstruction)) synchros.set(enConstruction, []);
  synchros.get(enConstruction).push(fn);
}

/** Reconstruit un conteneur seulement quand sa clé change : une saisie ou un clic ne reconstruit pas le champ en cours (le focus reste). */
function reconstruire(conteneur, cle, construire) {
  if (conteneur.dataset.cle === cle) return;
  conteneur.dataset.cle = cle;
  const precedent = enConstruction;
  enConstruction = conteneur;
  synchros.set(conteneur, []);
  try {
    conteneur.replaceChildren(...[construire()].flat(Infinity).filter(Boolean));
  } finally {
    enConstruction = precedent;
  }
}

function changer() {
  modifie = true;
  rafraichir();
}

const ligneDe = (cle, critere) => (fiche[cle] ?? []).find(critere);
/** Ligne d'une liste de la fiche (créée au besoin) : `critere` la trouve, `nouvelle` la crée. */
function ligne(cle, critere, nouvelle) {
  fiche[cle] ??= [];
  let l = fiche[cle].find(critere);
  if (!l) {
    l = nouvelle();
    fiche[cle].push(l);
  }
  return l;
}
const retirer = (cle, critere) => {
  fiche[cle] = (fiche[cle] ?? []).filter((l) => !critere(l));
};

// ------------------------------------------------------------------ pastilles
/**
 * Une pastille (bouton à bascule) : `choisie()`, `refus()` et `verrou()` sont relus à chaque rafraîchissement (le bouton reste en place, le focus
 * aussi). Une pastille refusée par les règles est grisée ; choisie malgré tout (règles changées, fiche importée), elle reste cliquable et cerclée de
 * rouge. Une pastille choisie que les règles imposent (`verrou()` dit pourquoi) ne se retire pas : le clic est sans effet.
 */
function pastille({ texte, couleur, texteSurCouleur, choisie, refus = () => null, verrou = () => null, surClic, detail }) {
  const bouton = el('button', {
    type: 'button',
    class: 'pastille',
    style: `--c: ${couleur}${texteSurCouleur ? `; --texte-sur-c: ${texteSurCouleur}` : ''}`,
    'aria-pressed': 'false',
    onclick: () => {
      if (bouton.hasAttribute('data-verrou')) return;
      const menu = bouton.closest('details.choix');
      surClic();
      fermerMenu(menu);
    },
  }, el('span', { class: 'pastille__point', 'aria-hidden': 'true' }), el('span', {}, texte), detail ? el('small', {}, detail) : null);
  synchro(() => {
    const oui = Boolean(choisie());
    const non = refus();
    const impose = oui && !non ? verrou() : null;
    bouton.setAttribute('aria-pressed', oui ? 'true' : 'false');
    bouton.disabled = Boolean(non) && !oui;
    bouton.toggleAttribute('data-refus', Boolean(non) && oui);
    bouton.toggleAttribute('data-verrou', Boolean(impose));
    if (impose) bouton.setAttribute('aria-disabled', 'true');
    else bouton.removeAttribute('aria-disabled');
    if (non || impose) bouton.title = non || impose;
    else bouton.removeAttribute('title');
  });
  return el('li', {}, bouton);
}

// ------------------------------------------------------------------ menus déroulants des choix
/**
 * Un choix (race, ethnie, magies, classes, spécialités) est un menu déroulant (demande du propriétaire, pour gagner de la place : ces choix bougent
 * peu) : <details class="choix"> de la page, fermé il montre le choix fait, ouvert les pastilles ; un clic sur une pastille, ailleurs ou Échap le referme.
 */
function fermerMenu(menu, focus = false) {
  if (!menu?.open) return;
  menu.open = false;
  if (focus) menu.querySelector('summary')?.focus();
}

/**
 * Ce que montre un menu fermé : une pastille par choix fait (`refus` : choisi mais fermé par les règles, cerclé de rouge ; `verrou` : imposé), ou
 * `vide` en grisé.
 */
function afficherChoix(id, choix, vide = 'À choisir') {
  const cible = $(`valeur-${id}`);
  const faits = choix.filter(Boolean);
  cible.replaceChildren(...(faits.length
    ? faits.map((c) => el('span', {
      class: 'choix__pastille', style: `--c: ${c.couleur}${c.texte ? `; --texte-sur-c: ${c.texte}` : ''}`,
      dataset: { ...(c.refus ? { refus: '' } : {}), ...(c.verrou ? { verrou: '' } : {}) }, title: c.refus || c.verrou || null,
    }, c.nom, c.verrou ? el('small', { class: 'choix__verrou' }, ' · imposée') : null))
    : [el('span', { class: 'choix__vide' }, vide)]));
}

function groupe(titre, couleur, elements) {
  return el('div', { class: 'groupe-pastilles', style: `--c: ${couleur}` },
    el('h4', {}, el('span', { class: 'pastille__point', style: `--c: ${couleur}`, 'aria-hidden': 'true' }), titre),
    el('ul', { class: 'pastilles' }, elements));
}

// ------------------------------------------------------------------ étape 1 : race et ethnie
function construireRaces() {
  reconstruire($('races'), 'fixe', () => [['pure', 'Races pures'], ['hybride', 'Races hybrides']].map(([nature, titre]) => {
    const races = regles.races.filter((r) => r.nature === nature);
    return groupe(titre, races[0]?.couleur ?? '#6b5a45', races.map((r) => pastille({
      texte: r.nom, couleur: r.couleur, choisie: () => fiche.race_id === r.id,
      surClic: () => {
        fiche.race_id = fiche.race_id === r.id ? null : r.id;
        if (fiche.ethnie_id && trouver(regles.ethnies, fiche.ethnie_id)?.race_id !== fiche.race_id) fiche.ethnie_id = null;
        fiche.caracteristiques = caracteristiquesCompletes(regles, fiche, { borner: true });   // curseurs dans les bornes de la nouvelle race
        changer();
      },
    })));
  }));
  const ethnies = ethniesDeLaRace(regles, fiche.race_id);
  $('choix-ethnie').hidden = ethnies.length === 0;
  const race = trouver(regles.races, fiche.race_id);
  const ethnie = trouver(regles.ethnies, fiche.ethnie_id);
  afficherChoix('race', [race && { nom: race.nom, couleur: race.couleur }]);
  afficherChoix('ethnie', [ethnie && {
    nom: ethnie.nom, couleur: race?.couleur ?? '#8a7a66',
    refus: ethnie.race_id !== fiche.race_id ? 'ethnie d’une autre race' : ethnieCompatible(ethnie, fiche.magie_innee_id) ? null : 'liée à une autre magie innée',
  }]);
  reconstruire($('ethnies'), `${fiche.race_id}`, () => ethnies.map((e) => pastille({
    texte: e.nom, couleur: race.couleur, choisie: () => fiche.ethnie_id === e.id,
    refus: () => (ethnieCompatible(e, fiche.magie_innee_id) ? null : `seulement avec la ${trouver(regles.magies, e.magie_id)?.nom ?? 'magie de l’ethnie'} innée`),
    detail: [e.sante && `${signe(e.sante)} santé`, e.chakra && `${signe(e.chakra)} chakra`, e.barriere && `${signe(e.barriere)} barrière`, e.vitesse && `${signe(e.vitesse)} vitesse`].filter(Boolean).join(', ') || null,
    surClic: () => {
      fiche.ethnie_id = fiche.ethnie_id === e.id ? null : e.id;
      changer();
    },
  })));
  reconstruire($('race-resume'), `${fiche.race_id}`, () => (race
    ? [
      el('li', {}, el('strong', {}, 'Santé '), race.sante), el('li', {}, el('strong', {}, 'Chakra '), race.chakra),
      race.barriere ? el('li', {}, el('strong', {}, 'Barrière '), signe(race.barriere)) : null,
      el('li', {}, el('strong', {}, 'Vitesse '), `${race.vitesse_sol} (nage ${race.vitesse_nage})`),
      race.ap || race.am ? el('li', {}, el('strong', {}, 'Armure '), `${race.ap} AP / ${race.am} AM`) : null,
      race.don_base ? el('li', {}, el('strong', {}, 'Don de base '), race.don_base) : null,
    ]
    : [el('li', {}, 'Choisissez une race : elle fixe la santé et le chakra de départ, la vitesse, les magies innées et les classes possibles.')]));
}

// ------------------------------------------------------------------ étape 2 : magies et dieux
function construireMagies() {
  reconstruire($('magies-innees'), 'fixe', () => regles.magies.map((m) => pastille({
    texte: m.nom, couleur: m.couleur, texteSurCouleur: m.texte, choisie: () => fiche.magie_innee_id === m.id,
    refus: () => (magiesInneesPermises(regles, fiche.race_id).has(m.id) ? null : 'magie que la race ne permet pas'),
    surClic: () => {
      fiche.magie_innee_id = fiche.magie_innee_id === m.id ? null : m.id;
      if (fiche.magie_acquise_id === fiche.magie_innee_id) fiche.magie_acquise_id = null;
      if (!fiche.magie_innee_id || trouver(regles.magies, fiche.magie_innee_id).caracteristique_id) fiche.caracteristique_magie_id = null;
      // le Potentiel Illimité impose l'Archimage en classe 1, que nulle autre magie innée n'ouvre (décision R23)
      fiche.classes = classesSelonLaMagieInnee(regles, fiche);
      fiche.capacites = donsValables(regles, fiche);
      changer();
    },
  })));
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  $('bloc-carac-magie').hidden = !innee || Boolean(innee.caracteristique_id);
  const acquiseChoisie = trouver(regles.magies, fiche.magie_acquise_id);
  afficherChoix('magie-innee', [innee && {
    nom: innee.nom, couleur: innee.couleur, texte: innee.texte,
    refus: magiesInneesPermises(regles, fiche.race_id).has(innee.id) ? null : 'magie que la race ne permet pas',
  }]);
  afficherChoix('magie-acquise', [acquiseChoisie && {
    nom: acquiseChoisie.nom, couleur: acquiseChoisie.couleur, texte: acquiseChoisie.texte, refus: refusMagieAcquise(regles, fiche, acquiseChoisie.id),
  }], 'Aucune');
  reconstruire($('magies-acquises'), 'fixe', () => [
    pastille({ texte: 'Aucune', couleur: '#8a7a66', choisie: () => !fiche.magie_acquise_id, surClic: () => { fiche.magie_acquise_id = null; changer(); } }),
    ...regles.magies.map((m) => pastille({
      texte: m.nom, couleur: m.couleur, texteSurCouleur: m.texte, choisie: () => fiche.magie_acquise_id === m.id,
      refus: () => refusMagieAcquise(regles, fiche, m.id),
      surClic: () => {
        fiche.magie_acquise_id = fiche.magie_acquise_id === m.id ? null : m.id;
        changer();
      },
    })),
  ]);
  $('dieu-inne').textContent = innee ? innee.dieux.map((d) => trouver(regles.dieux, d)?.nom ?? d).join(', ') || '—' : '—';
  const acquise = trouver(regles.magies, fiche.magie_acquise_id);
  reconstruire($('magie-resume'), `${fiche.magie_innee_id}|${fiche.magie_acquise_id}`, () => [innee, acquise].filter(Boolean).map((m, i) => el('li', {},
    el('strong', {}, `${m.nom} `), [
      i === 0 && (m.caracteristique_id ? `+1 ${trouver(regles.caracteristiques, m.caracteristique_id).nom}` : `+1 au choix (${(m.caracteristique_brut ?? '').toLowerCase() || 'au choix'})`),
      m.chakra && `${signe(m.chakra)} chakra`, m.sante && `${signe(m.sante)} santé`, m.barre4 && `4ᵉ barre : ${m.barre4.ressource === 'ame' ? 'Âme' : 'Sang'} (${m.barre4.max})`,
    ].filter(Boolean).join(', '))));
}

// ------------------------------------------------------------------ étape 3 : classes
function construireClasses() {
  reconstruire($('modes'), 'fixe', () => [['mono', 'Une classe'], ['bi', 'Deux classes']].map(([mode, texte]) => pastille({
    texte, couleur: '#2e7d4f', choisie: () => fiche.mode_classe === mode,
    surClic: () => {
      fiche.mode_classe = mode;
      changer();
    },
  })));
  const groupes = [];
  for (const k of regles.classes) {
    let g = groupes.find((x) => x.key === k.groupe.key);
    if (!g) groupes.push((g = { ...k.groupe, couleur: k.couleur, classes: [] }));
    g.classes.push(k);
  }
  groupes.sort((a, b) => a.ordre - b.ordre);
  const imposee = classeImposee(regles, fiche);
  const magieImposante = imposee && trouver(regles.magies, imposee.magie_innee_id);
  $('classe-imposee').hidden = !imposee;
  $('classe-imposee').textContent = imposee ? `Classe imposée par la magie innée ${magieImposante.nom} : ${imposee.nom}, qui lui est réservée.` : '';
  for (const c of calcul.classes) {
    const rang = c.rang;
    $(`choix-classe-${rang}`).hidden = rang === 2 && c.niveau === 0 && !c.choix;
    $(`titre-classe-${rang}`).textContent = `${rang === 1 ? (fiche.mode_classe === 'bi' ? 'Première classe' : 'Classe') : 'Seconde classe'} · niveau ${c.niveau}`;
    $(`titre-classe-${rang}`).title = rang === 2 && fiche.mode_classe === 'mono' ? 'Prise au niveau 11 (décision R2)' : '';
    const choixDe = (r) => calcul.classes.find((x) => x.rang === r)?.choix ?? null;
    afficherChoix(`classe-${rang}`, [c.classe && {
      nom: c.classe.nom, couleur: c.classe.couleur, refus: refusClasse(regles, fiche, c.classe.id, rang),
      verrou: rang === 1 && imposee?.id === c.classe.id ? `imposée par la magie innée ${magieImposante.nom}` : null,
    }]);
    const specialite = c.classe?.specialites.find((s) => s.id === c.choix?.specialite_id);
    $(`choix-specialite-${rang}`).hidden = !c.classe?.specialites.length || $(`choix-classe-${rang}`).hidden;
    afficherChoix(`specialite-${rang}`, [specialite && {
      nom: specialite.nom, couleur: c.classe.couleur, refus: c.niveau < 10 ? 'au niveau de classe 10' : null,
    }], c.niveau >= 10 ? 'À choisir' : 'Au niveau de classe 10');
    reconstruire($(`classe-${rang}`), 'fixe', () => groupes.map((g) => groupe(g.label, g.couleur, g.classes.map((k) => pastille({
      texte: k.nom, couleur: k.couleur, choisie: () => choixDe(rang)?.classe_id === k.id,
      refus: () => refusClasse(regles, fiche, k.id, rang),
      verrou: () => (rang === 1 && classeImposee(regles, fiche)?.id === k.id ? `imposée par la magie innée ${trouver(regles.magies, fiche.magie_innee_id).nom}` : null),
      surClic: () => {
        const deja = choixDe(rang)?.classe_id === k.id;
        retirer('classes', (l) => l.rang === rang);
        if (!deja) fiche.classes.push({ rang, classe_id: k.id, specialite_id: null });
        fiche.capacites = donsValables(regles, fiche);
        changer();
      },
    })))));
    reconstruire($(`specialite-${rang}`), `${c.choix?.classe_id}`, () => (!c.classe ? [] : c.classe.specialites.map((s) => pastille({
      texte: s.nom, couleur: c.classe.couleur, detail: s.magique ? 'classe magique' : null,
      choisie: () => choixDe(rang)?.specialite_id === s.id,
      refus: () => ((calcul.classes.find((x) => x.rang === rang)?.niveau ?? 0) < 10 ? 'au niveau de classe 10' : null),
      surClic: () => {
        const l = ligneDe('classes', (x) => x.rang === rang);
        l.specialite_id = l.specialite_id === s.id ? null : s.id;
        fiche.capacites = donsValables(regles, fiche);
        changer();
      },
    }))));
  }
}

// ------------------------------------------------------------------ étape 4 : caractéristiques, compétences, maîtrises
function etatBudget(badge, total, attendu, texte, exact = true) {
  badge.textContent = `${texte} : ${total} / ${attendu}`;
  badge.dataset.etat = total === attendu || (!exact && total < attendu) ? 'ok' : total < attendu ? 'manque' : 'trop';
}

function construireCaracteristiques() {
  const budget = budgetCaracteristiques(regles, fiche);
  etatBudget($('budget-caracs'), budget.total, budget.attendu, 'Points répartis');
  // curseurs (demande du propriétaire) : de la borne basse à la borne haute de la race, jamais vides ni à 0 (caracteristiquesCompletes)
  reconstruire($('caracs'), 'fixe', () => regles.caracteristiques.map((k) => {
    const nouvelle = () => ({ caracteristique_id: k.id, base: 1, croix: 0 });
    const base = el('input', {
      type: 'range', step: '1', class: 'curseur', 'aria-label': `${k.nom} : valeur de base`,
      oninput: (ev) => {
        ligne('caracteristiques', (x) => x.caracteristique_id === k.id, nouvelle).base = entier(ev.target.value, 1);
        changer();
      },
    });
    const croix = el('select', {
      'aria-label': `${k.nom} : croix`,
      onchange: (ev) => {
        ligne('caracteristiques', (x) => x.caracteristique_id === k.id, nouvelle).croix = entier(ev.target.value);
        changer();
      },
    }, option('0', 'Aucune croix'), option('1', '1 croix (−20 %)'), option('2', '2 croix (inutilisable)'));
    const valeur = el('span', { class: 'carac__valeur' });
    const bonus = el('span', { class: 'carac__bonus' });
    synchro(() => {
      const c = calcul.caracs.find((x) => x.id === k.id);
      base.min = String(c.min);
      base.max = String(c.max);
      poser(base, c.base ?? c.min);
      base.setAttribute('aria-invalid', c.base !== null && (c.base < c.min || c.base > c.max) ? 'true' : 'false');
      base.title = `De ${c.min} à ${c.max} pour cette race`;
      poser(croix, String(c.croix));
      valeur.textContent = c.base === null ? '—' : String(c.valeur);
      valeur.toggleAttribute('data-hors', c.base !== null && (c.base < c.min || c.base > c.max));
      bonus.textContent = c.bonus ? `base ${c.base} +${c.bonus} (magie)` : `de ${c.min} à ${c.max}`;
    });
    return el('div', { class: 'carac', style: `--c: ${k.couleur}; --c-texte: ${k.texte}` }, el('span', { class: 'carac__nom' }, k.nom), valeur, bonus, base, croix);
  }));

  const budgetC = budgetCompetences(regles, fiche);
  etatBudget($('budget-competences'), budgetC.total, budgetC.attendu, 'Points naturels');
  // un tableau par caractéristique, dans sa couleur
  reconstruire($('competences'), 'fixe', () => regles.caracteristiques.map((k) => el('div', { class: 'competences__groupe', style: `--c: ${k.couleur}; --c-texte: ${k.texte}` },
    el('table', { class: 'fiche-table' },
      el('thead', {}, el('tr', {}, el('th', {}, k.nom), el('th', {}, 'Naturel'), el('th', {}, 'Acquis'), el('th', { class: 'nombre' }, 'Score'))),
      el('tbody', {}, regles.competences.filter((x) => x.caracteristique_id === k.id).map((comp) => {
        const ecrire = (cle, valeur) => {
          const l = ligne('competences', (x) => x.competence_id === comp.id, () => ({ competence_id: comp.id, naturel: 0, acquis: 0 }));
          l[cle] = valeur;
          if (!l.naturel && !l.acquis) retirer('competences', (x) => x.competence_id === comp.id);
          changer();
        };
        const naturel = el('input', {
          type: 'range', min: '0', step: '1', class: 'curseur', 'aria-label': `${comp.nom} : points naturels`,
          oninput: (ev) => ecrire('naturel', entier(ev.target.value)),
        });
        const valeurNaturel = el('output', { class: 'curseur__valeur' });
        const acquis = el('input', {
          type: 'range', min: '0', step: '1', class: 'curseur', 'aria-label': `${comp.nom} : points acquis`,
          oninput: (ev) => ecrire('acquis', entier(ev.target.value)),
        });
        const valeurAcquis = el('output', { class: 'curseur__valeur' });
        const score = el('span', { class: 'score' });
        synchro(() => {
          const c = calcul.competences.find((x) => x.id === comp.id);
          naturel.max = String(c.maxNaturel);
          poser(naturel, c.naturel);
          valeurNaturel.textContent = String(c.naturel);
          valeurNaturel.toggleAttribute('data-hors', c.naturel > c.maxNaturel);
          naturel.title = `De 0 à ${c.maxNaturel} au niveau du personnage`;
          acquis.max = String(c.maxAcquis);
          poser(acquis, c.acquis);
          valeurAcquis.textContent = String(c.acquis);
          valeurAcquis.toggleAttribute('data-hors', c.acquis > c.maxAcquis);
          acquis.title = `De 0 à ${c.maxAcquis} : 5 par point de caractéristique de base (race, classe, dons, équipement, entraînement)`;
          score.textContent = c.score === null ? 'inutilisable' : `${c.score} %`;
        });
        return el('tr', {}, el('td', {}, comp.nom), el('td', { class: 'curseur-td' }, el('span', { class: 'curseur-cellule' }, naturel, valeurNaturel)),
          el('td', { class: 'curseur-td' }, el('span', { class: 'curseur-cellule' }, acquis, valeurAcquis)), el('td', { class: 'nombre' }, score));
      }))))));

  // la base garde le nombre de dés (1 sans maîtrise, 5 au plus) ; on choisit des points de maîtrise (4 au plus), un dé de plus chacun
  const maitrise = maitriseDArme(regles);
  reconstruire($('maitrises'), 'fixe', () => [
    el('thead', {}, el('tr', {}, el('th', {}, 'Famille d’armes'), el('th', {}, 'Dé'), el('th', {}, 'Maîtrise'))),
    el('tbody', {}, regles.familles_armes.map((f) => {
      const choix = el('select', {
        'aria-label': `Maîtrise : ${f.nom}`,
        onchange: (ev) => {
          const points = entier(ev.target.value);
          retirer('maitrises_armes', (x) => x.arme_famille_id === f.id);
          if (points > 0) fiche.maitrises_armes.push({ arme_famille_id: f.id, des: maitrise.desDe(points) });
          changer();
        },
      }, option('0', `Aucune (${maitrise.desSansMaitrise} dé)`),
      Array.from({ length: maitrise.pointsMax }, (_, i) => i + 1).map((n) => option(String(n), `${n} point${n > 1 ? 's' : ''} (${maitrise.desDe(n)} dés)`)));
      synchro(() => {
        const ligneDeMaitrise = ligneDe('maitrises_armes', (x) => x.arme_famille_id === f.id);
        poser(choix, String(ligneDeMaitrise ? maitrise.pointsDe(ligneDeMaitrise.des) : 0));
      });
      return el('tr', {}, el('td', {}, f.nom), el('td', { class: 'muted' }, f.de ?? ''), el('td', {}, choix));
    })),
  ]);
}

// ------------------------------------------------------------------ étape 5 : sorts
/**
 * Tableau des sorts (demande du propriétaire) : une ligne par emplacement, chacune avec la liste des sorts possibles (magies du personnage, NPM
 * accessible) moins ceux des autres lignes (lignesDeSorts) ; vider la liste libère l'emplacement ; pas d'emplacement en plus (décision R27). Les NM d'un
 * sort se notent par origine : de niveau (au plus niveau − 1 sur un sort, et en tout au plus ceux gagnés), d'un livre (un par sort), du MJ ; 3 au plus
 * sur un sort (décisions R24, R26).
 */
function construireSorts() {
  const emplacements = emplacementsDeSorts(regles, fiche);
  const nm = calcul.nm;
  const max = npmMax(regles, fiche);
  $('emplacements-detail').textContent = emplacements.total
    ? `${emplacements.total} emplacement${emplacements.total > 1 ? 's' : ''} (${emplacements.conditions} condition${emplacements.conditions > 1 ? 's' : ''} × puissance ${emplacements.puissance}), sorts jusqu’au NPM ${max}, NM au plus ${nm.maxParSort} par sort.`
    : 'Pas encore d’emplacement de sort : choisissez une magie.';
  etatBudget($('budget-sorts'), (fiche.sorts ?? []).length, emplacements.total, 'Sorts', false);
  const badge = $('budget-nm');
  etatBudget(badge, nm.deNiveau, nm.disponibles, 'NM de niveau');
  if (nm.offerts) badge.textContent += ` · livre/MJ +${nm.offerts}`;
  badge.title = `NM de niveau répartis / gagnés ; ceux d’un livre (un par sort) ou du MJ en plus ; ${nm.plafond} NM au plus sur un sort`;

  const lignes = lignesDeSorts(regles, fiche);
  const cle = JSON.stringify([lignes.length, (fiche.sorts ?? []).map((x) => x.sort_id), fiche.magie_innee_id, fiche.magie_acquise_id, max]);
  reconstruire($('sorts'), cle, () => [
    el('thead', {}, el('tr', {}, el('th', { class: 'nombre' }, '#'), el('th', {}, 'Sort'), el('th', { class: 'nombre' }, 'NPM'), el('th', {}, 'Coût'), el('th', {}, 'Portée'),
      el('th', { title: 'NM de niveau, d’un livre (un par sort), du MJ ; 3 au plus en tout' }, 'NM : niveau · livre · MJ'))),
    el('tbody', {}, lignes.length === 0
      ? el('tr', {}, el('td', { colspan: '6', class: 'muted' }, 'Aucun emplacement de sort.'))
      : lignes.map((l) => {
        const magies = regles.magies.filter((m) => l.choix.some((x) => x.magie_id === m.id));
        const liste = el('select', {
          'aria-label': `Sort de l’emplacement ${l.index + 1}`,
          onchange: (ev) => {
            const choix = ev.target.value;
            if (!choix) fiche.sorts.splice(l.index, 1);
            else if (fiche.sorts[l.index]) fiche.sorts[l.index] = { ...fiche.sorts[l.index], sort_id: choix, niveau_maitrise: 0, nm_livre: 0, nm_cadeau: 0 };
            else fiche.sorts.push({ sort_id: choix, rang: fiche.sorts.length + 1, niveau_maitrise: 0, nm_livre: 0, nm_cadeau: 0 });
            changer();
          },
        }, option('', l.enTrop ? '— retirer —' : l.choix.length ? '— libre —' : '— aucun sort possible —'),
        l.enTrop ? null : magies.map((m) => el('optgroup', { label: m.nom }, l.choix.filter((x) => x.magie_id === m.id).map((x) => option(x.id, `${x.nom} (NPM ${x.niveau})`, x.id === l.ligne?.sort_id)))),
        l.enTrop || l.horsDesRegles ? el('optgroup', { label: l.enTrop ? 'Au-delà des emplacements' : 'Hors des magies ou du niveau' }, option(l.sort.id, l.sort.nom, true)) : null);
        liste.setAttribute('aria-invalid', String(l.horsDesRegles || l.enTrop));
        // NM par origine : niveau_maitrise = niveau + livre + MJ
        const ecrireNm = (origine, valeur) => {
          const x = fiche.sorts[l.index];
          if (!x) return;
          const nm = nmDuSort(x);
          const parts = { deNiveau: nm.deNiveau, livre: nm.livre, cadeau: nm.cadeau, [origine]: valeur };
          Object.assign(x, { niveau_maitrise: parts.deNiveau + parts.livre + parts.cadeau, nm_livre: parts.livre, nm_cadeau: parts.cadeau });
          changer();
        };
        const deNiveau = el('input', { type: 'number', min: '0', step: '1', 'aria-label': `NM de niveau de l’emplacement ${l.index + 1}`, disabled: !l.ligne,
          oninput: (ev) => ecrireNm('deNiveau', entier(ev.target.value)) });
        const livre = el('input', { type: 'checkbox', 'aria-label': `NM d’un livre de sort, emplacement ${l.index + 1}`, title: 'NM d’un livre de sort (un par sort)', disabled: !l.ligne,
          onchange: (ev) => ecrireNm('livre', ev.target.checked ? 1 : 0) });
        const cadeau = el('input', { type: 'number', min: '0', step: '1', 'aria-label': `NM donnés par le MJ, emplacement ${l.index + 1}`, disabled: !l.ligne,
          oninput: (ev) => ecrireNm('cadeau', entier(ev.target.value)) });
        const total = el('output', { class: 'curseur__valeur' });
        synchro(() => {
          const nm = nmDuSort(fiche.sorts[l.index]);
          if (document.activeElement !== deNiveau) poser(deNiveau, fiche.sorts[l.index] ? nm.deNiveau : '');
          if (document.activeElement !== cadeau) poser(cadeau, fiche.sorts[l.index] ? nm.cadeau : '');
          poser(livre, nm.livre);
          deNiveau.setAttribute('aria-invalid', String(nm.deNiveau > calcul.nm.maxParSort));
          deNiveau.title = `NM de niveau : au plus ${calcul.nm.maxParSort} sur un sort (niveau − 1)`;
          total.textContent = `= ${nm.total}`;
          total.toggleAttribute('data-hors', nm.total > calcul.nm.plafond);
          total.title = `${nm.total} NM sur ce sort ; ${calcul.nm.plafond} au plus`;
        });
        return el('tr', { class: l.enTrop ? 'en-trop' : null, title: l.enTrop ? 'Au-delà des emplacements du personnage : à retirer' : null },
          el('td', { class: 'nombre muted' }, String(l.index + 1)), el('td', {}, liste), el('td', { class: 'nombre' }, l.sort?.niveau ?? ''),
          el('td', {}, l.sort?.cout ?? ''), el('td', {}, l.sort?.portee ?? ''),
          el('td', { class: 'nm-origines' }, deNiveau, el('label', { class: 'nm-livre' }, livre, 'livre'), cadeau, total));
      })),
  ]);
}

// ------------------------------------------------------------------ étape 6 : attributs
const NOMS_DU_DETAIL = { classes: 'classes', race: 'race', magies: 'magies', ethnie: 'ethnie', accessoires: 'accessoires', niveaux: 'niveaux', chakra: '½ chakra' };

function construireAttributs() {
  const a = calcul.attributs;
  const detail = (d) => Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${NOMS_DU_DETAIL[k] ?? k} ${signe(v)}`).join(' · ') || '—';
  const cartes = [
    ['sante', 'Santé', a.sante, detail(a.detail.sante)],
    ['chakra', 'Chakra', a.chakra, detail(a.detail.chakra)],
    ['barriere', 'Barrière', a.barriere, detail(a.detail.barriere)],
    ['vitesse', 'Vitesse', a.vitesseSol ?? '—', a.vitesseNage !== null ? `nage ${a.vitesseNage}` : 'selon la race'],
    ['armure', 'Armure de base', `${a.ap} / ${a.am}`, 'AP / AM, sans l’équipement'],
    ['initiative', 'Initiative', a.initiative ? `1D20 ${a.initiative.bonus >= 0 ? '+' : '−'} ${Math.abs(a.initiative.bonus)}` : '1D20', a.initiative?.note ?? 'selon l’Agilité'],
    ['corruption', 'Corruption max.', a.corruptionMax, 'autant que le chakra'],
    ...(a.quatriemeBarre ? [['barre4', a.quatriemeBarre.ressource, a.quatriemeBarre.max, '4ᵉ barre, de la magie']] : []),
  ];
  reconstruire($('attributs'), JSON.stringify(cartes), () => cartes.map(([cle, nom, valeur, d]) => el('div', { class: 'attribut', dataset: { a: cle } },
    el('span', { class: 'attribut__nom' }, nom), el('span', { class: 'attribut__valeur' }, valeur), el('span', { class: 'attribut__detail' }, d))));
  $('bloc-barre4').hidden = !a.quatriemeBarre;
  if (a.quatriemeBarre) $('titre-barre4').textContent = `${a.quatriemeBarre.ressource} actuel`;
}

// ------------------------------------------------------------------ étape 7 : progression et dons à choix
function construireProgression() {
  const attendus = progressionAttendue(regles, calcul.niveau);
  $('progression-aide').textContent = attendus.length
    ? `À chaque niveau à partir du 2 : ${attendus[0].points} points d’attributs à répartir entre la santé et le chakra (exactement), et un dé bonus aux niveaux qui en donnent un.`
    : 'Les gains commencent au niveau 2.';
  reconstruire($('progression'), `${calcul.niveau}`, () => (attendus.length === 0 ? [] : [
    el('thead', {}, el('tr', {}, el('th', {}, 'Niveau'), el('th', { class: 'nombre' }, 'Santé'), el('th', { class: 'nombre' }, 'Chakra'), el('th', { class: 'nombre' }, 'Total'), el('th', {}, 'Dé bonus'))),
    el('tbody', {}, attendus.map((n) => {
      const trouverLigne = () => ligne('progression', (x) => x.niveau === n.niveau, () => ({ niveau: n.niveau, points_sante: 0, points_chakra: 0, de_choix: null, de_resultat: null }));
      const champ = (cle) => el('input', { type: 'number', min: '0', step: '1', 'aria-label': `Niveau ${n.niveau} : ${cle === 'points_sante' ? 'santé' : 'chakra'}`, oninput: (ev) => { trouverLigne()[cle] = entier(ev.target.value); changer(); } });
      const sante = champ('points_sante');
      const chakra = champ('points_chakra');
      const total = el('span', { class: 'score' });
      const de = n.de ? el('select', {
        'aria-label': `Niveau ${n.niveau} : dé bonus`,
        onchange: (ev) => {
          const l = trouverLigne();
          l.de_choix = ev.target.value || null;
          if (!l.de_choix) l.de_resultat = null;
          changer();
        },
      }, option('', '—'), option('sante', 'Santé'), option('chakra', 'Chakra'), option('les_deux', 'Les deux')) : null;
      const resultat = n.de ? el('input', { type: 'number', min: '1', step: '1', 'aria-label': `Niveau ${n.niveau} : résultat du dé`, oninput: (ev) => { trouverLigne().de_resultat = ev.target.value === '' ? null : entier(ev.target.value); changer(); } }) : null;
      synchro(() => {
        const l = ligneDe('progression', (x) => x.niveau === n.niveau);
        poser(sante, l ? l.points_sante : '');
        poser(chakra, l ? l.points_chakra : '');
        const t = l ? entier(l.points_sante) + entier(l.points_chakra) : 0;
        total.textContent = `${t} / ${n.points}`;
        total.toggleAttribute('data-hors', t !== n.points);
        if (de) poser(de, l?.de_choix ?? '');
        if (resultat) {
          poser(resultat, l?.de_resultat ?? '');
          resultat.disabled = !l?.de_choix;
        }
      });
      return el('tr', {}, el('td', {}, `Niveau ${n.niveau}`), el('td', { class: 'nombre' }, sante), el('td', { class: 'nombre' }, chakra), el('td', { class: 'nombre' }, total),
        el('td', {}, n.de ? [el('span', { class: 'muted' }, `${n.de} `), de, ' ', resultat] : el('span', { class: 'muted' }, '—')));
    })),
  ]));

  const dons = donsAChoisir(regles, fiche);
  reconstruire($('dons'), JSON.stringify(dons.map((d) => [d.rang, d.classe.id, d.groupes.map((g) => g.options[0].id)])), () => {
    if (!dons.length) return el('p', { class: 'fiche-aide' }, 'Choisissez une classe : ses dons à choisir apparaîtront ici, niveau de classe par niveau de classe.');
    return dons.map((d) => el('div', { class: 'groupe-pastilles', style: `--c: ${d.classe.couleur}` },
      el('h4', {}, d.classe.nom),
      d.groupes.length === 0
        ? el('p', { class: 'fiche-aide' }, 'Pas encore de don à choisir à ce niveau de classe.')
        : d.groupes.map((g, i) => {
          const nomGroupe = `don-${d.rang}-${i}`;
          const specialite = d.classe.specialites.find((s) => s.id === g.specialite_id);
          const choisir = (option_) => {
            retirer('capacites', (c) => g.options.some((o) => o.id === c.capacite_id));
            if (option_) fiche.capacites.push({ capacite_id: option_.id });
            changer();
          };
          const radio = (option_) => {
            const r = el('input', { type: 'radio', name: nomGroupe, onchange: () => choisir(option_) });
            synchro(() => {
              const choisis = new Set((fiche.capacites ?? []).map((c) => c.capacite_id));
              r.checked = option_ ? choisis.has(option_.id) : !g.options.some((o) => choisis.has(o.id));
            });
            return r;
          };
          return el('fieldset', { class: 'dons-groupe' },
            el('legend', {}, `Niveau de classe ${g.niveau}${specialite ? ` · ${specialite.nom}` : ''} : un seul au choix`),
            el('div', { class: 'dons-options' },
              el('label', {}, radio(null), 'Pas encore choisi'),
              g.options.map((o) => el('label', {}, radio(o), o.nom, el('small', { class: 'muted' }, ` (${o.type})`)))));
        })));
  });
}

// ------------------------------------------------------------------ étape 8 : équipement
function selecteur(valeur, options, surChoix, { vide = '—', etiquette } = {}) {
  const s = el('select', { 'aria-label': etiquette, onchange: (ev) => surChoix(ev.target.value || null) }, option('', vide), options);
  synchro(() => poser(s, valeur() ?? ''));
  return s;
}
const optionsGroupees = (liste, cleGroupe, texte) => {
  const groupes = new Map();
  for (const x of liste) {
    const g = cleGroupe(x) ?? 'Autres';
    if (!groupes.has(g)) groupes.set(g, []);
    groupes.get(g).push(x);
  }
  return [...groupes].map(([g, xs]) => el('optgroup', { label: g }, xs.map((x) => option(x.id, texte(x)))));
};
const ameliorations = (cible) => regles.ameliorations.filter((a) => a.cible === cible).map((a) => option(a.id, `Niveau ${a.niveau} : ${a.effet ?? ''}`.slice(0, 120)));
const stats = (x) => [x.ap && `${x.ap} AP`, x.am && `${x.am} AM`].filter(Boolean).join(', ');
const EMPLACEMENTS_ACCESSOIRES = [['chef', 'Chef'], ['collier', 'Collier'], ['bracelet-1', 'Bracelet 1'], ['bracelet-2', 'Bracelet 2'], ['bague-1', 'Bague 1'], ['bague-2', 'Bague 2'], ['ceinture', 'Ceinture'], ['autre', 'Autre']];

function construireEquipement() {
  reconstruire($('armes'), 'fixe', () => [1, 2].map((rang) => {
    const l = () => ligneDe('armes', (x) => x.rang === rang);
    const poserChamp = (cle) => (v) => {
      if (cle === 'arme_id' && !v) retirer('armes', (x) => x.rang === rang);
      else if (cle === 'arme_id' || l()) ligne('armes', (x) => x.rang === rang, () => ({ rang, arme_id: null }))[cle] = v;
      changer();
    };
    const familles = new Map(regles.familles_armes.map((f) => [f.id, f.nom]));
    const effet = el('input', { 'aria-label': `Arme ${rang} : effet en plus`, oninput: (ev) => { const x = l(); if (x) { x.effet_en_plus = ev.target.value || null; changer(); } } });
    const details = [];
    const champ = (texte, select) => {
      const label = el('label', { class: 'fiche-champ' }, el('span', {}, texte), select);
      details.push(select);
      return label;
    };
    synchro(() => {
      poser(effet, l()?.effet_en_plus ?? '');
      for (const d of [effet, ...details]) d.disabled = !l();
    });
    return el('div', { class: 'objet' }, el('h4', {}, `Arme ${rang}`), el('div', { class: 'fiche-champs' },
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Arme'), selecteur(() => l()?.arme_id, optionsGroupees(regles.armes, (a) => familles.get(a.famille_id), (a) => a.nom), poserChamp('arme_id'), { vide: 'Aucune', etiquette: `Arme ${rang}` })),
      champ('Composition', selecteur(() => l()?.materiau_id, regles.materiaux_armes.map((m) => option(m.id, m.nom)), poserChamp('materiau_id'), { etiquette: `Arme ${rang} : composition` })),
      champ('Amélioration', selecteur(() => l()?.amelioration_id, ameliorations('arme'), poserChamp('amelioration_id'), { etiquette: `Arme ${rang} : amélioration` })),
      champ('Élément', selecteur(() => l()?.arme_elementaire_id, regles.armes_elementaires.map((a) => option(a.id, a.nom)), poserChamp('arme_elementaire_id'), { etiquette: `Arme ${rang} : élément` })),
      champ('Amélioration de l’élément', selecteur(() => l()?.amelioration_elementaire_id, ameliorations('arme_elementaire'), poserChamp('amelioration_elementaire_id'), { etiquette: `Arme ${rang} : amélioration de l’élément` })),
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Effet en plus'), effet)));
  }));

  reconstruire($('armures'), 'fixe', () => [
    el('thead', {}, el('tr', {}, el('th', {}, 'Emplacement'), el('th', {}, 'Pièce'), el('th', {}, 'Amélioration'), el('th', {}, 'Élément'), el('th', {}, 'Amélioration de l’élément'))),
    el('tbody', {}, regles.emplacements_armure.map((e) => {
      const l = () => ligneDe('armures', (x) => x.emplacement_id === e.id);
      const poserChamp = (cle) => (v) => {
        if (cle === 'armure_id' && !v) retirer('armures', (x) => x.emplacement_id === e.id);
        else if (cle === 'armure_id' || l()) ligne('armures', (x) => x.emplacement_id === e.id, () => ({ emplacement_id: e.id, armure_id: null }))[cle] = v;
        changer();
      };
      const suite = [
        selecteur(() => l()?.amelioration_id, ameliorations('armure'), poserChamp('amelioration_id'), { etiquette: `${e.nom} : amélioration` }),
        selecteur(() => l()?.armure_elementaire_id, optionsGroupees(regles.armures_elementaires, (a) => a.categorie, (a) => a.nom + (stats(a) ? ` (${stats(a)})` : '')), poserChamp('armure_elementaire_id'), { etiquette: `${e.nom} : élément` }),
        selecteur(() => l()?.amelioration_elementaire_id, ameliorations('armure_elementaire'), poserChamp('amelioration_elementaire_id'), { etiquette: `${e.nom} : amélioration de l’élément` }),
      ];
      synchro(() => { for (const s of suite) s.disabled = !l(); });
      return el('tr', {}, el('td', {}, e.nom),
        el('td', {}, selecteur(() => l()?.armure_id, optionsGroupees(regles.armures, (a) => a.type, (a) => `${a.nom}${stats(a) ? ` (${stats(a)})` : ''}`), poserChamp('armure_id'), { vide: 'Aucune', etiquette: `${e.nom} : pièce` })),
        suite.map((s) => el('td', {}, s)));
    })),
  ]);

  reconstruire($('bouclier'), 'fixe', () => {
    const badge = el('span', { class: 'budget' });
    synchro(() => {
      const bouclier = trouver(regles.boucliers, fiche.bouclier_classe_id);
      const quantites = (fiche.bouclier_materiaux ?? []).reduce((s, m) => s + entier(m.quantite), 0);
      etatBudget(badge, quantites, bouclier?.classe ?? 0, 'Matériaux', false);
    });
    const lignes = [1, 2, 3].map((rang) => {
      const l = () => ligneDe('bouclier_materiaux', (x) => x.rang === rang);
      const quantite = el('input', { type: 'number', min: '1', step: '1', 'aria-label': `Matériau ${rang} : quantité`, oninput: (ev) => { const x = l(); if (x) { x.quantite = entier(ev.target.value, 1); changer(); } } });
      synchro(() => { poser(quantite, l()?.quantite ?? ''); quantite.disabled = !l(); });
      return el('div', { class: 'fiche-champs fiche-champs--paire' },
        el('label', { class: 'fiche-champ' }, el('span', {}, `Matériau ${rang}`), selecteur(() => l()?.materiau_id, regles.materiaux_bouclier.map((m) => option(m.id, `${m.nom}${stats(m) ? ` (${stats(m)})` : ''}`)),
          (v) => {
            if (!v) retirer('bouclier_materiaux', (x) => x.rang === rang);
            else ligne('bouclier_materiaux', (x) => x.rang === rang, () => ({ rang, materiau_id: v, quantite: 1 })).materiau_id = v;
            changer();
          }, { etiquette: `Matériau ${rang}` })),
        el('label', { class: 'fiche-champ' }, el('span', {}, 'Quantité'), quantite));
    });
    return el('div', { class: 'objet' }, el('div', { class: 'fiche-entete-bloc' }, el('h4', {}, 'Bouclier et matériaux'), badge),
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Bouclier'), selecteur(() => fiche.bouclier_classe_id, regles.boucliers.map((b) => option(b.id, `${b.nom} (classe ${b.classe})`)), (v) => { fiche.bouclier_classe_id = v; changer(); }, { vide: 'Aucun', etiquette: 'Bouclier' })),
      lignes);
  });

  reconstruire($('accessoires'), 'fixe', () => [
    el('thead', {}, el('tr', {}, el('th', {}, 'Emplacement'), el('th', {}, 'Nom'), el('th', {}, 'Effet'), el('th', { class: 'nombre etroite' }, 'Valeur'), el('th', {}, 'Effet hors table'), el('th', { class: 'etroite' }, 'Maudit'))),
    el('tbody', {}, EMPLACEMENTS_ACCESSOIRES.map(([cle, nom]) => {
      const l = () => ligneDe('accessoires', (x) => x.emplacement === cle);
      const obtenir = () => ligne('accessoires', (x) => x.emplacement === cle, () => ({ emplacement: cle, nom: null, accessoire_effet_id: null, valeur: null, texte: null, maudit: 0 }));
      const nettoyer = () => { const x = l(); if (x && !x.accessoire_effet_id && !x.texte && !x.nom && !x.maudit) retirer('accessoires', (y) => y === x); };
      const nomObjet = el('input', { 'aria-label': `${nom} : nom`, oninput: (ev) => { obtenir().nom = ev.target.value || null; nettoyer(); changer(); } });
      const valeur = el('input', { type: 'number', step: '1', 'aria-label': `${nom} : valeur tirée`, oninput: (ev) => { obtenir().valeur = ev.target.value === '' ? null : entier(ev.target.value); changer(); } });
      const texte = el('input', { 'aria-label': `${nom} : effet hors table`, oninput: (ev) => { obtenir().texte = ev.target.value || null; nettoyer(); changer(); } });
      const maudit = el('input', { type: 'checkbox', 'aria-label': `${nom} : maudit`, onchange: (ev) => { obtenir().maudit = ev.target.checked ? 1 : 0; nettoyer(); changer(); } });
      synchro(() => {
        const x = l();
        const effet = trouver(regles.accessoires, x?.accessoire_effet_id);
        poser(nomObjet, x?.nom ?? '');
        poser(valeur, x?.valeur ?? '');
        valeur.disabled = !effet || effet.min === null;
        valeur.min = effet?.min ?? '';
        valeur.max = effet?.max ?? '';
        valeur.title = effet && effet.min !== null ? `Entre ${effet.min} et ${effet.max}` : 'Seulement pour un effet à fourchette';
        poser(texte, x?.texte ?? '');
        poser(maudit, x?.maudit);
      });
      return el('tr', {}, el('td', {}, nom), el('td', {}, nomObjet),
        el('td', {}, selecteur(() => l()?.accessoire_effet_id, optionsGroupees(regles.accessoires, (a) => a.propriete, (a) => a.libelle + (a.min !== null ? ` (${a.min} à ${a.max})` : '')),
          (v) => { const x = obtenir(); x.accessoire_effet_id = v; if (!v || trouver(regles.accessoires, v)?.min === null) x.valeur = null; nettoyer(); changer(); }, { etiquette: `${nom} : effet` })),
        el('td', { class: 'nombre' }, valeur), el('td', {}, texte), el('td', {}, maudit));
    })),
  ]);

  reconstruire($('inventaire'), `${(fiche.inventaire ?? []).length}`, () => [
    el('thead', {}, el('tr', {}, el('th', {}, 'Objet'), el('th', { class: 'nombre' }, 'Quantité'), el('th', {}, ''))),
    el('tbody', {}, (fiche.inventaire ?? []).length === 0
      ? el('tr', {}, el('td', { colspan: '3', class: 'muted' }, 'Sac vide.'))
      : fiche.inventaire.map((o) => {
        const nom = el('input', {
          list: 'liste-ressources', 'aria-label': 'Objet',
          oninput: (ev) => {
            o.nom = ev.target.value;
            o.ressource_id = regles.ressources.find((r) => r.nom === ev.target.value)?.id ?? null;
            changer();
          },
        });
        const quantite = el('input', { type: 'number', min: '1', step: '1', 'aria-label': 'Quantité', oninput: (ev) => { o.quantite = entier(ev.target.value, 1); changer(); } });
        synchro(() => { poser(nom, o.nom ?? ''); poser(quantite, o.quantite); });
        return el('tr', {}, el('td', {}, nom), el('td', { class: 'nombre' }, quantite),
          el('td', {}, el('button', { type: 'button', class: 'retirer', 'aria-label': 'Retirer l’objet', onclick: () => { retirer('inventaire', (x) => x === o); changer(); } }, '✕')));
      })),
  ]);
}

// ------------------------------------------------------------------ contrôles rendus par le service
/** Un détail de contrôle (« classes/guerrier », « force = 5 », « a / b ») avec les noms des règles à la place des identifiants. */
const avecNoms = (texte) => String(texte).split(/( \/ | : | = |« | »)/).map((x) => noms.get(x) ?? x).join('');

function construireControles() {
  const liste = $('controles');
  if (controles === null) {
    delete liste.dataset.vide;
    liste.replaceChildren(el('li', {}, id ? 'Enregistrez pour revoir le contrôle.' : 'La fiche n’a pas encore été enregistrée.'));
    return;
  }
  if (controles.length === 0) {
    liste.dataset.vide = '';
    liste.replaceChildren(el('li', {}, '✓ La fiche respecte toutes les règles que la base contrôle.'));
    return;
  }
  delete liste.dataset.vide;
  liste.replaceChildren(...controles.map((c) => el('li', {}, el('strong', {}, libelleDuControle(c.regle)), c.detail ? ` : ${avecNoms(c.detail)}` : '')));
}

// ------------------------------------------------------------------ rafraîchissement
/** Jauge d'XP de l'en-tête (demande du propriétaire) : l'XP se modifie dans le champ, ou s'ajoute avec le bouton + ; le niveau suit. */
function construireXp() {
  const p = progressionXp(regles, fiche.xp);
  $('xp-niveau').textContent = `Niveau ${p.niveau}`;
  $('fiche-niveau').textContent = `Niveau ${p.niveau}`;
  $('xp-objectif').textContent = p.suivant === null ? 'XP · niveau maximal' : `/ ${p.suivant} XP`;
  const jauge = $('xp-jauge');
  jauge.setAttribute('aria-valuemin', String(p.debut));
  jauge.setAttribute('aria-valuemax', String(p.suivant ?? p.xp));
  jauge.setAttribute('aria-valuenow', String(p.xp));
  jauge.setAttribute('aria-valuetext', p.suivant === null ? `${p.xp} XP, niveau maximal` : `${p.xp} XP ; niveau ${p.niveau + 1} à ${p.suivant} XP`);
  $('xp-rempli').style.width = `${Math.round(p.part * 1000) / 10}%`;
}

function rafraichir() {
  // les six caractéristiques sont toujours là, au minimum de la race (1) tant qu'on ne les a pas montées (demande du propriétaire)
  fiche.caracteristiques = caracteristiquesCompletes(regles, fiche);
  calcul = {
    niveau: niveauGlobal(regles, fiche.xp),
    classes: classesDe(regles, fiche),
    caracs: caracteristiquesDe(regles, fiche),
    competences: competencesDe(regles, fiche),
    nm: maitriseDesSorts(regles, fiche),
    attributs: attributsDe(regles, fiche),
  };
  for (const champ of racine.querySelectorAll('[data-champ]')) poser(champ, fiche[champ.dataset.champ]);
  const titre = fiche.nom || (id ? 'Prétiré sans nom' : 'Nouveau prétiré');
  $('fiche-titre').textContent = titre;
  document.title = `${titre} — Fiche de personnage — Maverick Center`;
  construireXp();
  construireRaces();
  construireMagies();
  construireClasses();
  construireCaracteristiques();
  construireSorts();
  construireAttributs();
  construireProgression();
  construireEquipement();
  for (const liste of synchros.values()) for (const s of liste) s();
  construireControles();
  $('fiche-enregistrer').disabled = !modifie && id !== null;
  $('fiche-supprimer').hidden = id === null;
  if (modifie) message(serviceJoignable ? 'Modifications non enregistrées.' : 'Service indisponible : exportez la fiche pour ne rien perdre.', 'attente');
}

// ------------------------------------------------------------------ enregistrement, chargement
/** La fiche à envoyer : listes nettoyées (lignes vides retirées, rangs renumérotés). */
function aEnvoyer() {
  const f = structuredClone(fiche);
  for (const c of COLONNES_DU_SERVICE) delete f[c];
  delete f[CHAMP_VERSION];
  f.caracteristiques = (f.caracteristiques ?? []).filter((c) => c.base !== null && c.base !== undefined);
  f.competences = (f.competences ?? []).filter((c) => c.naturel || c.acquis);
  f.sorts = (f.sorts ?? []).map((s, i) => ({ ...s, rang: i + 1 }));
  f.bouclier_materiaux = (f.bouclier_materiaux ?? []).filter((m) => m.materiau_id).map((m, i) => ({ ...m, rang: i + 1 }));
  f.inventaire = (f.inventaire ?? []).filter((o) => o.nom && o.nom.trim()).map((o, i) => ({ ...o, nom: o.nom.trim(), rang: i + 1 }));
  f.accessoires = (f.accessoires ?? []).filter((a) => a.accessoire_effet_id || a.texte);
  return f;
}

function appliquer(donnees) {
  fiche = { ...ficheVide(''), ...donnees.personnage };
  for (const cle of Object.keys(PARTIES_DE_FICHE)) fiche[cle] ??= [];
  id = fiche.id;
  version = fiche[CHAMP_VERSION];
  controles = donnees.controles ?? null;
  modifie = false;
  rafraichir();
}

async function enregistrer() {
  const bouton = $('fiche-enregistrer');
  bouton.disabled = true;
  message('Enregistrement…', 'attente');
  try {
    const adresse = id ? `${API}personnages/${encodeURIComponent(id)}/` : `${API}personnages/`;
    const reponse = await fetch(adresse, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aEnvoyer(), [CHAMP_VERSION]: version }) });
    const donnees = await reponse.json().catch(() => ({}));
    if (reponse.ok) {
      appliquer(donnees);
      history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
      message(controles.length ? `Enregistré : ${controles.length} règle${controles.length > 1 ? 's' : ''} à revoir (en bas de la fiche).` : 'Enregistré ✓', 'ok');
      return;
    }
    if (reponse.status === 409 && donnees.personnage) {
      message(`${donnees.erreur} `, 'erreur');
      $('fiche-message').append(el('button', { type: 'button', onclick: () => { appliquer({ personnage: donnees.personnage }); message('Fiche rechargée : les modifications non enregistrées sont perdues.', 'attente'); } }, 'Recharger la fiche'));
    } else if (reponse.status === 422) {
      controles = donnees.controles ?? [];
      construireControles();
      message(donnees.erreur, 'erreur');
    } else if (donnees.erreur) {
      message(`${donnees.erreur}${donnees.problemes ? ` ${donnees.problemes.map(avecNoms).join(' ; ')}` : ''}`, 'erreur');
    } else {
      throw new Error(`HTTP ${reponse.status}`);
    }
  } catch {
    serviceJoignable = false;
    afficherIndisponible('Le service des personnages ne répond pas : la fiche n’a pas été enregistrée. Exportez-la pour ne rien perdre, puis réessayez.');
    message('Non enregistré : service injoignable.', 'erreur');
  }
  bouton.disabled = false;
}

async function charger(identifiant) {
  message('Chargement…', 'attente');
  try {
    const reponse = await fetch(`${API}personnages/${encodeURIComponent(identifiant)}/`);
    const donnees = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      rafraichir();
      message(reponse.status === 404 ? 'Ce personnage n’existe pas (ou plus).' : donnees.erreur ?? `Erreur ${reponse.status}`, 'erreur');
      return;
    }
    appliquer(donnees);
    message('', '');
  } catch {
    serviceJoignable = false;
    afficherIndisponible('Le service des personnages ne répond pas : la fiche ne peut pas être chargée pour le moment.');
    rafraichir();
    message('', '');
  }
}

function afficherIndisponible(texte) {
  const b = $('fiche-indisponible');
  b.textContent = texte;
  b.hidden = false;
}

async function verifierService() {
  try {
    const reponse = await fetch(`${API}etat/`);
    const etat = await reponse.json();
    if (!reponse.ok || !etat.base?.disponible) throw new Error(etat.base?.erreur ?? 'base indisponible');
    if (!etat.base.a_jour) afficherIndisponible(`La base des fiches n’a pas pu suivre les dernières règles : ${etat.base.erreur}`);
  } catch {
    serviceJoignable = false;
    afficherIndisponible('Le service des personnages n’est pas joignable : la fiche peut être remplie, exportée et imprimée, mais pas enregistrée.');
  }
}

/** Supprime la fiche enregistrée (demande du propriétaire), après confirmation ; on revient à la liste des personnages. */
async function supprimer() {
  if (!id) return;
  if (!confirm(`Supprimer définitivement « ${fiche.nom || 'ce prétiré'} » ? La fiche ne pourra pas être récupérée (exportez-la d’abord pour en garder une copie).`)) return;
  message('Suppression…', 'attente');
  try {
    const reponse = await fetch(`${API}personnages/${encodeURIComponent(id)}/`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [CHAMP_VERSION]: version }),
    });
    const donnees = await reponse.json().catch(() => ({}));
    if (reponse.ok) {
      modifie = false;
      location.assign(racine.dataset.personnages);
      return;
    }
    message(donnees.erreur ?? `Erreur ${reponse.status}`, 'erreur');
  } catch {
    serviceJoignable = false;
    afficherIndisponible('Le service des personnages ne répond pas : la fiche n’a pas été supprimée.');
    message('Non supprimée : service injoignable.', 'erreur');
  }
}

function nouvelle() {
  if (modifie && !confirm('Abandonner les modifications non enregistrées ?')) return;
  fiche = ficheVide('');
  id = null;
  version = null;
  controles = null;
  modifie = false;
  history.replaceState(null, '', racine.dataset.fiche);
  rafraichir();
  message('', '');
}

function exporter() {
  const f = aEnvoyer();
  const lien = el('a', { href: URL.createObjectURL(new Blob([`${JSON.stringify(f, null, 2)}\n`], { type: 'application/json' })), download: `${(f.nom || 'personnage').replace(/[^\p{L}\p{N}-]+/gu, '-')}.json` });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
}

async function importer(fichier) {
  try {
    const objet = JSON.parse(await fichier.text());
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) throw new Error('pas une fiche');
    if (modifie && !confirm('Remplacer la fiche en cours par celle du fichier ?')) return;
    for (const c of [...COLONNES_DU_SERVICE, CHAMP_VERSION]) delete objet[c];
    fiche = { ...ficheVide(''), ...objet };
    for (const cle of Object.keys(PARTIES_DE_FICHE)) if (!Array.isArray(fiche[cle])) fiche[cle] = [];
    id = null;
    version = null;
    controles = null;
    history.replaceState(null, '', racine.dataset.fiche);
    changer();
    message('Fiche importée : enregistrez-la pour créer le prétiré.', 'attente');
  } catch {
    message('Ce fichier n’est pas une fiche exportée.', 'erreur');
  }
}

// ------------------------------------------------------------------ démarrage
function indexerNoms() {
  for (const cle of ['races', 'ethnies', 'magies', 'dieux', 'metiers', 'classes', 'sorts', 'caracteristiques', 'competences', 'armes', 'armures', 'boucliers', 'accessoires']) {
    for (const x of regles[cle]) noms.set(x.id, x.nom ?? x.libelle ?? x.id);
  }
  for (const c of regles.classes) {
    for (const s of c.specialites) noms.set(s.id, `${c.nom} · ${s.nom}`);
    for (const g of c.choix) for (const o of g.options) noms.set(o.id, `${o.nom} (${c.nom})`);
  }
}

function remplirListesFixes() {
  $('dieux').append(...regles.dieux.map((d) => option(d.id, d.nom)));
  $('metiers').append(...regles.metiers.map((m) => option(m.id, m.nom)));
  $('carac-magie').replaceChildren(option('', '—'), ...regles.caracteristiques.map((c) => option(c.id, c.nom)));
  racine.append(el('datalist', { id: 'liste-ressources' }, regles.ressources.map((r) => el('option', { value: r.nom }))));
}

async function demarrer() {
  try {
    const reponse = await fetch(racine.dataset.regles);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    regles = await reponse.json();
  } catch {
    afficherIndisponible('Les règles de la fiche n’ont pas pu être chargées : rechargez la page.');
    return;
  }
  indexerNoms();
  remplirListesFixes();
  racine.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement) || !t.dataset.champ) return;
    if (t instanceof HTMLInputElement && t.type === 'checkbox') fiche[t.dataset.champ] = t.checked ? 1 : 0;
    else if ('entier' in t.dataset) fiche[t.dataset.champ] = t.value === '' ? ('videNull' in t.dataset ? null : 0) : entier(t.value);
    else fiche[t.dataset.champ] = t.value === '' ? null : t.value;
    changer();
  });
  $('fiche-enregistrer').addEventListener('click', enregistrer);
  $('fiche-nouvelle').addEventListener('click', nouvelle);
  $('fiche-exporter').addEventListener('click', exporter);
  $('fiche-imprimer').addEventListener('click', () => window.print());
  $('fiche-supprimer').addEventListener('click', supprimer);
  const fichier = $('fiche-importer');
  fichier.addEventListener('change', () => {
    if (fichier.files?.[0]) importer(fichier.files[0]);
    fichier.value = '';
  });
  fichier.nextElementSibling.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      fichier.click();
    }
  });
  // menus déroulants : un clic ailleurs ou Échap les referme
  document.addEventListener('click', (ev) => {
    for (const menu of racine.querySelectorAll('details.choix[open]')) if (!menu.contains(ev.target)) fermerMenu(menu);
  });
  racine.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') fermerMenu(ev.target.closest?.('details.choix'), true);
  });
  // ajout d'XP : le bouton + ouvre un petit champ
  const ajoutXp = $('xp-ajout');
  const montrerAjoutXp = (oui) => {
    ajoutXp.hidden = !oui;
    $('xp-plus').setAttribute('aria-expanded', String(oui));
    if (oui) $('xp-gain').focus();
    else $('xp-gain').value = '';
  };
  $('xp-plus').addEventListener('click', () => montrerAjoutXp(ajoutXp.hidden));
  $('xp-annuler').addEventListener('click', () => montrerAjoutXp(false));
  ajoutXp.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const gain = entier($('xp-gain').value);
    if (gain > 0) {
      fiche.xp = Math.max(0, entier(fiche.xp)) + gain;
      changer();
    }
    montrerAjoutXp(false);
  });
  $('bouton-ajout-objet').addEventListener('click', () => {
    fiche.inventaire.push({ rang: fiche.inventaire.length + 1, nom: '', quantite: 1, ressource_id: null });
    changer();
    racine.querySelector('#inventaire tbody tr:last-child input')?.focus();
  });
  window.addEventListener('beforeunload', (ev) => {
    if (modifie) ev.preventDefault();
  });

  const demande = new URLSearchParams(location.search).get('id');
  await verifierService();
  if (demande) await charger(demande);
  else rafraichir();
}

demarrer();
