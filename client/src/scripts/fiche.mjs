// Formulaire de la page /fiche/ (pages/fiche/index.astro) : construit les étapes à partir des règles de la base (/fiche/regles.json), garde la
// fiche en cours au format d'échange (lib/fiche-format.mjs), recalcule ce qui en découle à chaque saisie (lib/fiche-moteur.mjs) et l'enregistre
// auprès du service des personnages (/api/personnages/, docs/serveur.md). Création et modification sur le même écran : /fiche/?id=<id>.
// Export et import (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et exportée à tout moment depuis un Excel
// ou Google Sheet et réexportée sous le même modèle ») : en JSON (le format d'échange), ou en classeur au modèle « Fiche-de-personnage-Maverick-V15.2.2
// ordinateur » (/fiche/modele.xlsx : lib/fiche-tableur-export.mjs remplit ses cases, lib/tableur-ecriture.mjs écrit le .xlsx, le portrait cadré à la
// place du logo) ; l'import lit aussi la fiche auto V15.2.2 et les .ods et .csv (lib/tableur-lecture.mjs, lib/fiche-tableur-import.mjs), et ce qui n'a
// pas de place sur le site va dans les notes.
// Script de page (navigateur) : il n'importe que des modules purs que seule cette page utilise (la version portable refuse un module partagé), et le
// choix et le recadrage du portrait (src/scripts/portrait.mjs, lib/portrait.mjs), partagés avec le mode modification du bestiaire, absent de la version
// portable.
import { libelleDuControle } from '../lib/fiche-controles.mjs';
import { CHAMP_VERSION, COLONNES_DU_SERVICE, COLONNES_RETIREES, PARTIES_DE_FICHE, ajouterAuxNotes, ficheVide, nouveauxRetraits, resumeDesRetraits } from '../lib/fiche-format.mjs';
import { RAISONS } from '../lib/degats-texte.mjs';
import { modesAuNm, valeurAuNm } from '../lib/sort-maitrise.mjs';
import { cadrageDe, empreinte, octetsDuPortrait } from '../lib/portrait.mjs';
import { cellulesDeLaFiche } from '../lib/fiche-tableur-export.mjs';
import { ficheDuClasseur } from '../lib/fiche-tableur-import.mjs';
import { ecrireXlsx, zonesDuClasseur } from '../lib/tableur-ecriture.mjs';
import { lireClasseur } from '../lib/tableur-lecture.mjs';
import { lireZip } from '../lib/zip.mjs';
import { dessinerVignette, ouvrirRecadrage, reduireImage } from './portrait.mjs';
import {
  accessoiresDesSorts, actionsDesAccessoires, effetsDesAccessoires, EMPLACEMENTS_ACCESSOIRES, ajusterValeurDuMoment, alignementDe, armesApresChoix, artisanatDe, attaqueADeuxArmes, attributsDe, bonusDuMetier, choixEnAttente, cleDeChoix, degatsDArme, donDeBase, modeHyperDe, niveauDeSpecialite, borner, budgetCaracteristiques, budgetCompetences, caracteristiquesCompletes, caracteristiquesDe,
  choisirObjetDeMetier, choixDeMetierValables, classeImposee, classesDe, classesSelonLaMagieInnee, competencesDe, deDeLaFamille, donsAChoisir, donsAcquis, donsDeRace, donsValables,
  emplacementsDeSorts, ethnieCompatible, ethnieImposee, ethniesDeLaRace, famillesMaitrisables, inventaireSelonLeMetier, lignesDeSorts, magieAcquiseValable, notationDesDes,
  magiesInneesPermises, maitriseDArme, maitriseDesSorts, maitrisesValables, niveauGlobal, nmDuSort, npmMax, objetChoisi, objetsDuMetier, progressionAttendue, progressionXp,
  quotaDeMaitrise, refusClasse, refusMagieAcquise, resistancesDe, sortsParNpm, trouver, ecrireValeurDuMoment, valeursDuMoment,
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
/** Monte quand l'inventaire est remplacé d'un bloc (objets de départ d'un métier) : son tableau est alors reconstruit, même à nombre de lignes égal. */
let versionInventaire = 0;

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
    bouton.title = non || impose || ''; // vide : plus d'infobulle (components/Infobulles.astro a déplacé l'attribut : un removeAttribute ne l'efface pas)
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

// ------------------------------------------------------------------ identité : race, ethnie, alignement
function construireRaces() {
  reconstruire($('races'), 'fixe', () => [['pure', 'Races pures'], ['hybride', 'Races hybrides']].map(([nature, titre]) => {
    const races = regles.races.filter((r) => r.nature === nature);
    return groupe(titre, races[0]?.couleur ?? '#6b5a45', races.map((r) => pastille({
      texte: r.nom, couleur: r.couleur, choisie: () => fiche.race_id === r.id,
      surClic: () => {
        fiche.race_id = fiche.race_id === r.id ? null : r.id;
        if (fiche.ethnie_id && trouver(regles.ethnies, fiche.ethnie_id)?.race_id !== fiche.race_id) fiche.ethnie_id = null;
        fiche.ethnie_id = ethnieImposee(regles, fiche) ?? fiche.ethnie_id;   // sans choix possible, l'ethnie se pose seule (demande du propriétaire)
        fiche.magie_acquise_id = magieAcquiseValable(regles, fiche);   // la Lamia n'a qu'une magie (décision R28)
        fiche.caracteristiques = caracteristiquesCompletes(regles, fiche, { borner: true });   // curseurs dans les bornes de la nouvelle race
        changer();
      },
    })));
  }));
  const ethnies = ethniesDeLaRace(regles, fiche.race_id);
  $('choix-ethnie').hidden = ethnies.length === 0;
  const race = trouver(regles.races, fiche.race_id);
  const ethnie = trouver(regles.ethnies, fiche.ethnie_id);
  const imposee = ethnieImposee(regles, fiche);
  const pourquoi = () => (ethniesDeLaRace(regles, fiche.race_id).length === 1 ? 'seule ethnie de la race' : 'seule ethnie de la magie innée');
  afficherChoix('race', [race && { nom: race.nom, couleur: race.couleur }]);
  $('choix-ethnie').toggleAttribute('data-a-choisir', aChoisir('ethnie'));
  afficherChoix('ethnie', [ethnie && {
    nom: ethnie.nom, couleur: race?.couleur ?? '#8a7a66',
    refus: ethnie.race_id !== fiche.race_id ? 'ethnie d’une autre race' : ethnieCompatible(ethnie, fiche.magie_innee_id) ? null : 'liée à une autre magie innée',
    verrou: imposee === ethnie.id ? pourquoi() : null,
  }]);
  $('ethnies').dataset.choixCle = 'ethnie';   // sa tuile dans l'infobulle du tiroir des choix (choixEnAttente)
  reconstruire($('ethnies'), `${fiche.race_id}`, () => ethnies.map((e) => pastille({
    texte: e.nom, couleur: race.couleur, choisie: () => fiche.ethnie_id === e.id,
    refus: () => (ethnieCompatible(e, fiche.magie_innee_id) ? null : `seulement avec la ${trouver(regles.magies, e.magie_id)?.nom ?? 'magie de l’ethnie'} innée`),
    verrou: () => (ethnieImposee(regles, fiche) === e.id ? pourquoi() : null),
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
      el('li', {}, el('strong', {}, 'Vitesse '), race.vitesse_sol), el('li', {}, el('strong', {}, 'Nage '), race.vitesse_nage),   // deux cases (demande du propriétaire)
      race.ap || race.am ? el('li', {}, el('strong', {}, 'Armure '), `${race.ap} AP / ${race.am} AM`) : null,
      // le don de base est en tête des dons raciaux, sous les sorts (demande du propriétaire)
    ]
    : [el('li', {}, 'Choisissez une race : elle fixe la santé et le chakra de départ, la vitesse, les magies innées et les classes possibles.')]));
}

/** L'alignement qui résulte des quatre scores, à côté d'eux (demande du propriétaire ; alignementDe : guide « Alignement »). */
function construireAlignement() {
  const a = alignementDe(regles, fiche);
  const sortie = $('alignement-resultat');
  sortie.textContent = a.nom;
  // la couleur de son titre dans le guide pour MJ (demande du propriétaire ; regles.alignements)
  const teinte = regles.alignements?.[a.nom];
  sortie.style.setProperty('--c', teinte?.couleur ?? '');
  sortie.style.setProperty('--c-texte', teinte?.texte ?? '');
  sortie.title = `Loi/Chaos : ${a.loi} ; Bien/Mal : ${a.bien} (5 points d’écart sur un axe pour qu’une tendance l’emporte)`;
}

// ------------------------------------------------------------------ magies et dieux
function construireMagies() {
  reconstruire($('magies-innees'), 'fixe', () => regles.magies.map((m) => pastille({
    texte: m.nom, couleur: m.couleur, texteSurCouleur: m.texte, choisie: () => fiche.magie_innee_id === m.id,
    refus: () => (magiesInneesPermises(regles, fiche.race_id).has(m.id) ? null : 'magie que la race ne permet pas'),
    surClic: () => {
      fiche.magie_innee_id = fiche.magie_innee_id === m.id ? null : m.id;
      fiche.ethnie_id = ethnieImposee(regles, fiche) ?? fiche.ethnie_id;   // l'ethnie d'une race hybride suit sa magie innée
      fiche.magie_acquise_id = magieAcquiseValable(regles, fiche);   // une acquise devenue incompatible disparaît (demande du propriétaire)
      if (!fiche.magie_innee_id || trouver(regles.magies, fiche.magie_innee_id).caracteristique_id) fiche.caracteristique_magie_id = null;
      // le Potentiel Illimité impose l'Archimage en classe 1, que nulle autre magie innée n'ouvre (décision R23)
      fiche.classes = classesSelonLaMagieInnee(regles, fiche);
      fiche.capacites = donsValables(regles, fiche);
      changer();
    },
  })));
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  $('bloc-carac-magie').hidden = !innee || Boolean(innee.caracteristique_id);
  $('bloc-carac-magie').toggleAttribute('data-a-choisir', aChoisir('carac_magie'));
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

/**
 * Résistances et faiblesses (demande du propriétaire, sur le modèle du tableau « Résistance / Faiblesse » de la fiche auto) : les six paliers, chacun avec
 * ses magies (dans leur couleur) puis ses altérations d'état (cerclées de la couleur de leur magie), le détail des crans en infobulle (resistancesDe) ;
 * sous le tableau, les dons qui laissent une résistance au choix (pas comptée).
 */
function construireResistances() {
  const { paliers, auChoix } = resistancesDe(regles, fiche);
  const magieDeLEtat = new Map(regles.magies.filter((m) => m.etat_id).map((m) => [m.etat_id, m]));
  const detail = (c) => `${c.nom} : ${c.origines.map((o) => (o.immunite ? `immunisé (${o.nom})` : `${o.nom} ${signe(o.crans)}`)).join(' · ')}`
    + (c.immunite || c.origines.length < 2 ? '' : ` = ${signe(c.crans)}`);
  reconstruire($('resistances'), JSON.stringify(paliers.map((p) => p.cibles.map(detail))), () => paliers.map((p) => el('tr', { dataset: { palier: p.id } },
    el('th', { scope: 'row' }, p.libelle, el('small', {}, p.effet)),
    el('td', {}, p.cibles.length
      ? el('ul', { class: 'resistances__cibles' }, p.cibles.map((c) => {
        const magie = c.type === 'magie' ? trouver(regles.magies, c.id) : magieDeLEtat.get(c.id);
        return el('li', { class: `resistance resistance--${c.type}`, title: detail(c), style: magie && `--c: ${magie.couleur}; --c-texte: ${magie.texte}` }, c.nom);
      }))
      : el('span', { class: 'resistances__vide' }, '—')))));
  const choix = $('resistances-choix');
  choix.hidden = auChoix.length === 0;
  choix.textContent = auChoix.length ? `Résistance laissée au choix, à noter à la main : ${auChoix.join(', ')}.` : '';
}

// ------------------------------------------------------------------ classes
function construireClasses() {
  // une case « Bi-classé » (demande du propriétaire) : cochée, deux classes au niveau global ; décochée, une seule (la seconde au niveau 11, R2)
  poser($('bi-classe'), fiche.mode_classe === 'bi');
  const groupes = [];
  for (const k of regles.classes) {
    let g = groupes.find((x) => x.key === k.groupe.key);
    if (!g) groupes.push((g = { ...k.groupe, couleur: k.couleur, classes: [] }));
    g.classes.push(k);
  }
  groupes.sort((a, b) => a.ordre - b.ordre);
  const imposee = classeImposee(regles, fiche);
  const magieImposante = imposee && trouver(regles.magies, imposee.magie_innee_id);
  // l'explication d'une classe imposée : en infobulle sur sa pastille « · imposée » (demande du propriétaire), pas en texte sous les classes
  const pourquoiImposee = (classe) => `Classe imposée par la magie innée ${trouver(regles.magies, classe.magie_innee_id)?.nom ?? ''} : ${classe.nom}, qui lui est réservée.`;
  for (const c of calcul.classes) {
    const rang = c.rang;
    $(`choix-classe-${rang}`).hidden = rang === 2 && c.niveau === 0 && !c.choix;
    $(`titre-classe-${rang}`).textContent = `${rang === 1 ? (fiche.mode_classe === 'bi' ? 'Première classe' : 'Classe') : 'Seconde classe'} · niveau ${c.niveau}`;
    $(`titre-classe-${rang}`).title = rang === 2 && fiche.mode_classe === 'mono' ? 'Prise au niveau 11 (décision R2)' : '';
    const choixDe = (r) => calcul.classes.find((x) => x.rang === r)?.choix ?? null;
    afficherChoix(`classe-${rang}`, [c.classe && {
      nom: c.classe.nom, couleur: c.classe.couleur, refus: refusClasse(regles, fiche, c.classe.id, rang),
      verrou: rang === 1 && imposee?.id === c.classe.id && magieImposante ? pourquoiImposee(imposee) : null,
    }]);
    const specialite = c.classe?.specialites.find((s) => s.id === c.choix?.specialite_id);
    $(`choix-specialite-${rang}`).hidden = !c.classe?.specialites.length || $(`choix-classe-${rang}`).hidden;
    afficherChoix(`specialite-${rang}`, [specialite && {
      nom: specialite.nom, couleur: c.classe.couleur, refus: c.niveau < 10 ? 'au niveau de classe 10' : null,
    }], c.niveau >= 10 ? 'À choisir' : 'Au niveau de classe 10');
    // un choix qui reste à faire est surligné (demande du propriétaire : « mettre en surbrillance le champ à saisir »)
    $(`choix-specialite-${rang}`).toggleAttribute('data-a-choisir', aChoisir('specialite', rang));
    reconstruire($(`classe-${rang}`), 'fixe', () => groupes.map((g) => groupe(g.label, g.couleur, g.classes.map((k) => pastille({
      texte: k.nom, couleur: k.couleur, choisie: () => choixDe(rang)?.classe_id === k.id,
      refus: () => refusClasse(regles, fiche, k.id, rang),
      verrou: () => (rang === 1 && classeImposee(regles, fiche)?.id === k.id ? pourquoiImposee(k) : null),
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

// ------------------------------------------------------------------ caractéristiques, compétences
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
    // les croix : deux cases à cocher (demande du propriétaire), comme sur la feuille ; cochées = le nombre de croix (R19). Cocher la seconde coche
    // la première, décocher la première décoche la seconde.
    const caseDeCroix = (n, titre) => el('input', {
      type: 'checkbox', class: 'croix__case', 'aria-label': `${k.nom} : ${titre}`, title: titre,
      onchange: (ev) => {
        ligne('caracteristiques', (x) => x.caracteristique_id === k.id, nouvelle).croix = ev.target.checked ? n : n - 1;
        changer();
      },
    });
    const croix1 = caseDeCroix(1, '1ʳᵉ croix : −20 % aux compétences');
    const croix2 = caseDeCroix(2, '2ᵉ croix : compétences inutilisables');
    const croix = el('span', { class: 'croix', role: 'group', 'aria-label': `${k.nom} : croix` }, el('span', { class: 'croix__titre', 'aria-hidden': 'true' }, 'Croix'), croix1, croix2);
    const valeur = el('span', { class: 'carac__valeur' });
    const bonus = el('span', { class: 'carac__bonus' });
    synchro(() => {
      const c = calcul.caracs.find((x) => x.id === k.id);
      base.min = String(c.min);
      base.max = String(c.max);
      poser(base, c.base ?? c.min);
      base.setAttribute('aria-invalid', c.base !== null && (c.base < c.min || c.base > c.max) ? 'true' : 'false');
      base.title = `De ${c.min} à ${c.max} pour cette race`;
      poser(croix1, c.croix >= 1);
      poser(croix2, c.croix >= 2);
      valeur.textContent = c.base === null ? '—' : String(c.valeur);
      valeur.toggleAttribute('data-hors', c.base !== null && (c.base < c.min || c.base > c.max));
      // +1 de la magie innée, ± l'accessoire (décision R54 : rogné à 4 et à la borne de la race)
      const plus = [c.bonus ? `+${c.bonus} (magie)` : null, c.accessoire ? `${signe(c.accessoire)} (accessoire)` : null].filter(Boolean);
      bonus.textContent = plus.length ? `base ${c.base} ${plus.join(' ')}` : `de ${c.min} à ${c.max}`;
      bonus.title = c.accessoireBrut > c.accessoire ? `Accessoire : ${signe(c.accessoireBrut)}, rogné à ${Math.min(regles.constantes['accessoire.caracteristique_max'], c.max)} (« Ne peut dépasser 4 » ni les limites de la race)` : '';
    });
    return el('div', { class: 'carac', style: `--c: ${k.couleur}; --c-texte: ${k.texte}` }, el('span', { class: 'carac__nom', title: k.nom }, k.nom), valeur, bonus, base, croix);
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
          // le bonus du métier est de l'Acquis (décision R33) : affiché à côté, compté dans le plafond et le score, jamais saisi
          // et celui d'un accessoire « Compétence X » (décision R54), de l'Acquis lui aussi, rogné au plafond après le métier
          const enPlus = c.metier + c.accessoire;
          valeurAcquis.textContent = enPlus ? `${c.acquis} ${signe(enPlus)}` : String(c.acquis);
          valeurAcquis.toggleAttribute('data-hors', c.acquis + Math.max(0, enPlus) > c.plafondAcquis);
          // le plafond prévaut sur le bonus du métier (décision R38) : au-delà, il est rogné
          valeurAcquis.title = c.metier || c.metierBrut || c.accessoireBrut ? [
            `${c.acquis} saisi(s)`,
            c.metier || c.metierBrut ? `+ ${c.metier} du métier${c.metierBrut > c.metier ? ` (${c.metierBrut}, rogné au plafond de ${c.plafondAcquis})` : ''}` : null,
            c.accessoireBrut ? `${signe(c.accessoire)} d’accessoire${c.accessoireBrut > c.accessoire ? ` (${c.accessoireBrut}, rogné au plafond de ${c.plafondAcquis})` : ''}` : null,
          ].filter(Boolean).join(' ') : '';
          acquis.title = `De 0 à ${c.maxAcquis} : 5 par point de caractéristique, magie innée comprise (race, classe, dons, équipement, entraînement)${enPlus > 0 ? `, moins les ${enPlus} du métier et des accessoires` : ''}`;
          score.textContent = c.score === null ? 'N/A' : `${c.score} %`;   // « N/A » plutôt qu'« inutilisable » (demande du propriétaire)
          score.title = c.score === null ? 'Deux croix : compétence inutilisable' : '';
        });
        return el('tr', {}, el('td', {}, comp.nom), el('td', { class: 'curseur-td' }, el('span', { class: 'curseur-cellule' }, naturel, valeurNaturel)),
          el('td', { class: 'curseur-td' }, el('span', { class: 'curseur-cellule' }, acquis, valeurAcquis)), el('td', { class: 'nombre' }, score));
      }))))));
}

// ------------------------------------------------------------------ métier
/**
 * Le métier (décisions R33 à R35) : ses bonus, chacun vers une compétence (son Acquis) ou l'initiative — un rang à plusieurs compétences se choisit ici
 * (« En cas de choix c'est à saisir dans la fiche de personnage ») —, sa compétence d'artisanat (10 × chacune de ses deux caractéristiques) et ses objets
 * de départ, ajoutés à l'inventaire quand on choisit le métier (un objet à choisir l'est ici). Changer de métier retire les objets de l'ancien encore
 * tels quels et ses bonus choisis (changerDeMetier).
 */
function changerDeMetier(nouveau) {
  const ancien = fiche.metier_id ?? null;
  if (ancien === nouveau) return;
  fiche.metier_id = nouveau;
  fiche.metier_bonus = choixDeMetierValables(regles, fiche);
  fiche.inventaire = inventaireSelonLeMetier(regles, fiche, ancien);
  versionInventaire += 1;
  changer();
}

function construireMetier() {
  const bloc = $('metier-bloc');
  const choisi = trouver(regles.metiers, fiche.metier_id);
  bloc.hidden = !choisi;
  $('metier-titre').textContent = choisi ? `Métier : ${choisi.nom}` : 'Métier';
  reconstruire($('metier-detail'), `${fiche.metier_id}`, () => {
    const { metier, rangs } = bonusDuMetier(regles, fiche);
    if (!metier) return [];
    const competence = (id) => trouver(regles.competences, id);
    const couleurDe = (id) => trouver(regles.caracteristiques, competence(id)?.caracteristique_id);
    const valeur = (b) => `${signe(entier(b.valeur))}${b.unite ?? ''}`;
    const ATTRIBUTS = { initiative: 'à l’initiative', vitesse: 'à la vitesse', vitesse_nage: 'à la vitesse de nage' };
    const nomDeCible = (o) => ATTRIBUTS[o.attribut] ?? competence(o.competence_id)?.nom ?? o.competence_id;
    const lignesDeBonus = rangs.map((b) => {
      if (b.aChoisir) {
        const li = el('li', { class: 'metier-fiche__choix', dataset: { choixCle: cleDeChoix.metierBonus(b.rang) } }, el('strong', {}, `${valeur(b)} au choix `),
          el('ul', { class: 'pastilles pastilles--etroites' }, b.options.filter((o) => o.competence_id).map((o) => {
            const k = couleurDe(o.competence_id);
            return pastille({
              texte: competence(o.competence_id)?.nom ?? o.competence_id, couleur: k?.couleur ?? '#8a7a66', texteSurCouleur: k?.texte,
              choisie: () => (fiche.metier_bonus ?? []).some((c) => entier(c.rang) === b.rang && c.competence_id === o.competence_id),
              surClic: () => {
                const deja = (fiche.metier_bonus ?? []).some((c) => entier(c.rang) === b.rang && c.competence_id === o.competence_id);
                retirer('metier_bonus', (c) => entier(c.rang) === b.rang);
                if (!deja) fiche.metier_bonus.push({ rang: b.rang, competence_id: o.competence_id });
                changer();
              },
            });
          })));
        synchro(() => li.toggleAttribute('data-a-choisir', !(fiche.metier_bonus ?? []).some((c) => entier(c.rang) === b.rang)));
        return li;
      }
      if (b.retenue) return el('li', {}, el('strong', {}, `${valeur(b)} `), nomDeCible(b.retenue), b.retenue.competence_id ? el('small', { class: 'muted' }, ' (acquis)') : null);
      return el('li', { class: 'muted', title: 'Texte libre : sans effet automatique sur la fiche' }, b.texte);
    });
    const artisanat = el('li', { class: 'metier-fiche__artisanat' });
    synchro(() => {
      const a = artisanatDe(regles, fiche);
      artisanat.hidden = !a;
      if (!a) return;
      const par = regles.constantes['metier.artisanat_par_point_caracteristique'];
      // une croix retire 20, comme −2 à la caractéristique ; deux croix rendent la compétence inutilisable (décision R39)
      const formule = a.caracteristiques.map((c) => `${c.nom} ${c.valeur} × ${par}${c.malus ? ` − ${-c.malus} (croix)` : ''}`).join(' + ');
      const resultat = a.inutilisable ? el('strong', {}, 'inutilisable (deux croix)') : a.score === null ? '' : el('strong', {}, `${a.score} %`);
      artisanat.replaceChildren(el('strong', {}, 'Artisanat '), a.texte, a.score === null && !a.inutilisable ? '' : ` : ${a.inutilisable ? '' : `${formule} = `}`, resultat);
    });
    const objets = objetsDuMetier(regles, metier.id).map((r) => (r.options.length === 1
      ? el('li', {}, el('strong', {}, 'Objet de départ '), r.options[0].texte)
      : (() => {
        const li = el('li', { class: 'metier-fiche__choix', dataset: { choixCle: cleDeChoix.metierObjet(r.rang) } }, el('strong', {}, 'Objet de départ au choix '),
        el('ul', { class: 'pastilles pastilles--etroites' }, r.options.map((o, i) => pastille({
          texte: o.texte, couleur: '#8a7a66', choisie: () => objetChoisi(fiche, r) === i,
          surClic: () => {
            fiche.inventaire = choisirObjetDeMetier(regles, fiche, r.rang, i);
            versionInventaire += 1;
            changer();
          },
        }))));
        synchro(() => li.toggleAttribute('data-a-choisir', objetChoisi(fiche, r) < 0));
        return li;
      })()));
    return el('ul', { class: 'fiche-resume metier-fiche', 'aria-label': `Ce que donne le métier ${metier.nom}` }, lignesDeBonus, artisanat, objets);
  });
}

// ------------------------------------------------------------------ maîtrises d'armes
/**
 * Maîtrises d'armes, dans leur bloc (demande du propriétaire). La base garde le nombre de dés (1 sans maîtrise, 5 au plus) ; un curseur étroit de
 * points de maîtrise (4 au plus), un dé de plus chacun, et les dés à côté ; le Pugilat montre le seul dé de la Force du personnage (deDeLaFamille). Dans
 * le coin du bloc, les points répartis sur le quota des classes et de leurs dons (quotaDeMaitrise, décision R32). Pas de ligne pour ARME DE MONSTRES,
 * des armes exclusives aux monstres (famillesMaitrisables, décision R45).
 */
function construireMaitrises() {
  const maitrise = maitriseDArme(regles);
  const quota = quotaDeMaitrise(regles, fiche);
  const badge = $('budget-maitrises');
  etatBudget(badge, quota.utilises, quota.total, 'Maîtrises');
  badge.title = quota.sources.length
    ? `Points de maîtrise répartis / quota des classes et de leurs dons : ${quota.sources.map((x) => `${x.nom} ${x.points > 0 ? '+' : ''}${x.points}`).join(' · ')}`
    : 'Quota de maîtrise : choisissez une classe (ses maîtrises et celles de ses dons)';
  reconstruire($('maitrises'), 'fixe', () => famillesMaitrisables(regles).map((f) => {
    const curseur = el('input', {
      type: 'range', min: '0', max: String(maitrise.pointsMax), step: '1', class: 'curseur', 'aria-label': `Maîtrise : ${f.nom} (points)`,
      title: `De 0 à ${maitrise.pointsMax} points : ${maitrise.desSansMaitrise} dé sans maîtrise, un de plus par point`,
      oninput: (ev) => {
        const points = entier(ev.target.value);
        retirer('maitrises_armes', (x) => x.arme_famille_id === f.id);
        if (points > 0) fiche.maitrises_armes.push({ arme_famille_id: f.id, des: maitrise.desDe(points) });
        changer();
      },
    });
    const points = el('output', { class: 'curseur__valeur' });
    const des = el('strong', { class: 'des' });
    synchro(() => {
      const l = ligneDe('maitrises_armes', (x) => x.arme_famille_id === f.id);
      const n = l ? maitrise.pointsDe(l.des) : 0;
      poser(curseur, n);
      points.textContent = String(n);
      const { de, force } = deDeLaFamille(regles, fiche, f);
      des.textContent = notationDesDes(de, l ? l.des : maitrise.desSansMaitrise);
      des.title = force === null ? '' : `${de} avec ${force} de Force (${f.de_selon_force.map((p) => `${p.de} pour ${p.min === p.max ? p.min : `${p.min} à ${p.max}`}`).join(', ')} de Force)`;
    });
    return el('li', { class: 'maitrise' }, el('span', { class: 'maitrise__nom' }, f.nom), el('span', { class: 'curseur-cellule' }, curseur, points), des);
  }));
}

// ------------------------------------------------------------------ sorts
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
    ? `${emplacements.total} emplacement${emplacements.total > 1 ? 's' : ''} (${emplacements.conditions} condition${emplacements.conditions > 1 ? 's' : ''} × puissance ${emplacements.puissance}), sorts jusqu’au NPM ${max}, ${nm.plafond} NM au plus par sort (dont ${Math.min(nm.plafond, nm.maxParSort)} de niveau).`
    : 'Pas encore d’emplacement de sort : choisissez une magie.';
  etatBudget($('budget-sorts'), (fiche.sorts ?? []).length, emplacements.total, 'Sorts', false);
  const badge = $('budget-nm');
  etatBudget(badge, nm.deNiveau, nm.disponibles, 'NM de niveau');
  if (nm.offerts) badge.textContent += ` · livre/MJ +${nm.offerts}`;
  badge.title = `NM de niveau répartis / gagnés ; ceux d’un livre (un par sort) ou du MJ en plus ; ${nm.plafond} NM au plus sur un sort`;

  const lignes = lignesDeSorts(regles, fiche);
  const cle = JSON.stringify([lignes.length, (fiche.sorts ?? []).map((x) => x.sort_id), fiche.magie_innee_id, fiche.magie_acquise_id, max]);
  reconstruire($('sorts'), cle, () => [
    el('thead', {}, el('tr', {}, el('th', { class: 'nombre' }, '#'), el('th', {}, 'Sort'),
      el('th', { title: 'Instant Cast (IC), imparable, inesquivable, au NM du sort ; en grisé : pas encore atteint' }, 'IC'),
      el('th', {}, 'Coût'), el('th', {}, 'Portée'), el('th', {}, 'Zone'),
      el('th', { title: 'Dégâts, soins ou barrière' }, 'D/S/B'),
      el('th', { title: 'NM de niveau, d’un livre (un par sort), du MJ ; 3 au plus en tout' }, 'NM : niveau · livre · MJ'))),
    el('tbody', {}, lignes.length === 0
      ? el('tr', {}, el('td', { colspan: '8', class: 'muted' }, 'Aucun emplacement de sort.'))
      : lignes.flatMap((l) => {
        // un groupe par NPM, le nom seul ; chaque sort sur la couleur de sa magie, comme sur les pages de magie (demande du propriétaire)
        const couleurDe = (s) => trouver(regles.magies, s?.magie_id);
        const optionDeSort = (s) => {
          const m = couleurDe(s);
          return el('option', { value: s.id, selected: s.id === l.ligne?.sort_id, style: m ? `background-color: ${m.couleur}; color: ${m.texte}` : null, title: m?.nom }, s.nom);
        };
        const choisi = couleurDe(l.sort);
        const liste = el('select', {
          style: choisi ? `--c: ${choisi.couleur}; --texte-sur-c: ${choisi.texte}` : null, dataset: choisi ? { couleur: '' } : {},
          title: choisi ? `${l.sort.nom} (${choisi.nom}, NPM ${l.sort.niveau})` : null,
          'aria-label': `Sort de l’emplacement ${l.index + 1}`,
          onchange: (ev) => {
            const choix = ev.target.value;
            if (!choix) fiche.sorts.splice(l.index, 1);
            else if (fiche.sorts[l.index]) fiche.sorts[l.index] = { ...fiche.sorts[l.index], sort_id: choix, niveau_maitrise: 0, nm_livre: 0, nm_cadeau: 0 };
            else fiche.sorts.push({ sort_id: choix, rang: fiche.sorts.length + 1, niveau_maitrise: 0, nm_livre: 0, nm_cadeau: 0 });
            changer();
          },
        }, el('option', { value: '', class: 'option-vide' }, l.enTrop ? '— retirer —' : l.choix.length ? '— libre —' : '— aucun sort possible —'),
        l.enTrop ? null : sortsParNpm(regles, l.choix).map((g) => el('optgroup', { label: `NPM ${g.npm}` }, g.sorts.map(optionDeSort))),
        l.enTrop || l.horsDesRegles ? el('optgroup', { label: l.enTrop ? 'Au-delà des emplacements' : 'Hors des magies ou du niveau' }, optionDeSort(l.sort)) : null);
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
        // coût, portée, zone, D/S/B et effet à la valeur du NM du sort, sans « (+1/NM) » (demande du propriétaire ; valeurAuNm) ; l'indication IC (et
        // imparable, inesquivable) au NM du sort, une condition pas encore atteinte (« IC pour 3 NM ») en grisé (modesAuNm)
        const modes = el('td', { class: 'sort-modes' });
        const cout = el('td', { class: 'sort-valeur' });
        const portee = el('td', { class: 'sort-valeur' });
        const zone = el('td', { class: 'sort-valeur' });
        const dsb = el('td', { class: 'sort-valeur' });
        const effet = el('span', { class: 'sort-effet__texte' });
        const remarque = l.sort?.remarque
          ? el('span', { class: 'sort-remarque', tabindex: '0', role: 'img', 'aria-label': `Remarque : ${l.sort.remarque}`, title: l.sort.remarque }, '★')
          : null;
        synchro(() => {
          const nm = nmDuSort(fiche.sorts[l.index]);
          const auNm = (brut, champ) => (l.sort ? valeurAuNm(brut, l.sort.bonus ?? [], champ, nm.total) ?? '' : '');
          cout.textContent = auNm(l.sort?.cout, 'cout');
          // accessoires (décision R54) : « Augmente la portée des sorts de +N » ; « Dégâts magie +N » sur un sort d'attaque
          const acc = accessoiresDesSorts(regles, fiche);
          portee.textContent = auNm(l.sort?.portee, 'portee') + (l.sort && acc.portee ? ` ${signe(acc.portee)}` : '');
          portee.title = l.sort && acc.portee ? `${signe(acc.portee)} de portée (accessoires)` : '';
          zone.textContent = auNm(l.sort?.zone, 'zone');
          modes.replaceChildren(...(l.sort ? modesAuNm(l.sort.modes, l.sort.bonus ?? [], nm.total) : []).map((m) => el('span', {
            class: 'sort-mode', dataset: { mode: m.mode ?? 'autre', ...(m.atteint ? {} : { attente: '' }) },
            title: m.atteint ? null : `Pas encore : ${nm.total} NM sur ce sort`,
          }, m.texte)));
          const degatsEnPlus = l.sort?.attaque && auNm(l.sort.dsb, 'dsb') ? acc.degats : 0;
          dsb.textContent = auNm(l.sort?.dsb, 'dsb') + (degatsEnPlus ? ` ${signe(degatsEnPlus)}` : '');
          dsb.title = degatsEnPlus ? `${signe(degatsEnPlus)} de dégâts (accessoires : ${acc.sources.filter((x) => x.cible === 'degats_magie').map((x) => x.nom).join(', ')})` : '';
          effet.textContent = auNm(l.sort?.effets, 'effets');
          if (document.activeElement !== deNiveau) poser(deNiveau, fiche.sorts[l.index] ? nm.deNiveau : '');
          if (document.activeElement !== cadeau) poser(cadeau, fiche.sorts[l.index] ? nm.cadeau : '');
          poser(livre, nm.livre);
          deNiveau.setAttribute('aria-invalid', String(nm.deNiveau > calcul.nm.maxParSort));
          deNiveau.title = `NM de niveau : au plus ${calcul.nm.maxParSort} sur un sort (niveau − 1)`;
          total.textContent = `= ${nm.total}`;
          total.toggleAttribute('data-hors', nm.total > calcul.nm.plafond);
          total.title = `${nm.total} NM sur ce sort ; ${calcul.nm.plafond} au plus`;
        });
        const classe = [l.enTrop ? 'en-trop' : null, l.sort?.effets ? 'avec-effet' : null].filter(Boolean).join(' ') || null;
        return [
          el('tr', { class: classe, title: l.enTrop ? 'Au-delà des emplacements du personnage : à retirer' : null },
            el('td', { class: 'nombre muted' }, String(l.index + 1)), el('td', {}, el('span', { class: 'sort-choix' }, liste, remarque)),
            modes, cout, portee, zone, dsb,
            el('td', { class: 'nm-origines' }, deNiveau, el('label', { class: 'nm-livre' }, livre, 'livre'), cadeau, total)),
          // l'effet secondaire du sort, sur sa propre ligne (demande du propriétaire)
          l.sort?.effets ? el('tr', { class: `sort-effet${l.enTrop ? ' en-trop' : ''}` }, el('td', {}), el('td', { colspan: '7' }, effet)) : null,
        ];
      })),
  ]);
}

// ------------------------------------------------------------------ rappel des dons
const TYPES_DE_DON = { passif: 'Passif', actif: 'Actif', action: 'Action', reaction: 'Réaction', variable: 'Variable' };

/** Un don de la liste : son niveau (s'il en a un), son nom, son type et sa précision (limite d'usage « 2 fois/combat », telle qu'écrite), et son texte. */
function elementDeDon({ niveau = null, nom, type = null, precision = null, texte }) {
  return el('li', { class: 'don' },
    el('span', { class: 'don__tete' },
      niveau !== null ? el('span', { class: 'don__niveau' }, `Niv. ${niveau}`) : null,
      el('strong', { class: 'don__nom' }, nom),
      type || precision ? el('span', { class: 'don__type', dataset: type ? { type } : {} }, [TYPES_DE_DON[type] ?? type, precision ? `(${precision})` : null].filter(Boolean).join(' ')) : null),
    texte ? el('span', { class: 'don__texte' }, texte) : null);
}

/**
 * Sous les sorts, le rappel des dons (demande du propriétaire) : ceux de la race — le don de base d'abord (demande du propriétaire), puis le don de
 * l'ethnie et la ligne de son ethnie dans le tableau de la race (donsDeRace) —, puis les dons de chaque classe débloqués au niveau atteint (donsAcquis).
 */
function construireDons() {
  const race = donsDeRace(regles, fiche);
  const actions = actionsDesAccessoires(regles, fiche);
  const cleRace = JSON.stringify([fiche.race_id, fiche.ethnie_id, actions]);
  reconstruire($('dons-race'), cleRace, () => {
    if (!fiche.race_id) return [el('li', { class: 'fiche-aide' }, 'Choisissez une race : ses dons apparaîtront ici.'), actions.map((x) => elementDeDon({ nom: x.nom, type: x.type, texte: x.texte }))];
    return [
      race.base ? elementDeDon(donDeBase(race.base)) : null,   // « Méditation » ou « Repos » plutôt que « Don de base » (demande du propriétaire)
      race.dons.map((d) => elementDeDon({ nom: d.nom ?? d.etiquette, texte: d.texte })),
      race.tableau ? elementDeDon({ nom: race.tableau.titre ?? 'Selon l’ethnie', texte: race.tableau.cellules.map((c) => `${c.libelle.replace(/\n/g, ' / ')} : ${c.valeur}`).join('\n') }) : null,
      race.ethnieAChoisir ? el('li', { class: 'fiche-aide' }, 'Choisissez l’ethnie : son don apparaîtra ici.') : null,
      // à la suite, les effets d'accessoire « (Action) » et à usage compté, sous le même format (demande du propriétaire, décision R54)
      actions.map((x) => elementDeDon({ nom: x.nom, type: x.type, texte: x.maudit ? `${x.texte} (maudit : l’effet est le contraire)` : x.texte })),
    ];
  });
  const classes = donsAcquis(regles, fiche);
  const cleClasses = JSON.stringify(classes.map((c) => [c.classe.id, c.niveau, c.dons.map((d) => d.id)]));
  reconstruire($('dons-classes'), cleClasses, () => (classes.length === 0
    ? el('p', { class: 'fiche-aide' }, 'Choisissez une classe : ses dons apparaîtront ici, niveau de classe par niveau de classe.')
    : classes.map((c) => el('div', { class: 'dons-classe', style: `--c: ${c.classe.couleur}` },
      el('h4', {}, `${c.classe.nom} · niveau ${c.niveau}`),
      c.dons.length
        ? el('ul', { class: 'dons-liste' }, c.dons.map((d) => elementDeDon({ niveau: d.niveau, nom: d.nom, type: d.type, precision: d.precision, texte: d.effet })))
        : el('p', { class: 'fiche-aide' }, 'Pas encore de don à ce niveau de classe.')))));
}

// ------------------------------------------------------------------ attributs et valeurs du moment
const NOMS_DU_DETAIL = { classes: 'classes', race: 'race', magies: 'magies', ethnie: 'ethnie', accessoires: 'accessoires', niveaux: 'niveaux', chakra: '½ chakra' };
const detailDe = (d) => Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${NOMS_DU_DETAIL[k] ?? k} ${signe(v)}`).join(' · ') || '—';
/** Carte d'une valeur du moment : son nom, la couleur de son attribut (data-a) et le détail de son maximum. */
const JAUGES = {
  sante_actuelle: { a: 'sante', nom: () => 'Santé', detail: () => detailDe(calcul.attributs.detail.sante) },
  barriere_actuelle: { a: 'barriere', nom: () => 'Barrière', detail: () => detailDe(calcul.attributs.detail.barriere) },
  chakra_actuel: {
    a: 'chakra', nom: () => 'Chakra',
    detail: (j) => `${detailDe(calcul.attributs.detail.chakra)}${j.reduction ? ` ; ${j.chakra} − ${j.reduction} de corruption (sauf magie de la Corruption)` : ''}`,
  },
  barre4_actuelle: { a: 'barre4', nom: () => calcul.attributs.quatriemeBarre?.ressource ?? '4ᵉ barre', detail: () => '4ᵉ barre, de la magie' },
  corruption: { a: 'corruption', nom: () => 'Corruption', detail: () => 'Au plus le chakra ; elle en prend la place (sauf magie de la Corruption)' },
};

/**
 * Une valeur du moment avec son maximum (demande du propriétaire) : curseur de 0 au maximum (valeursDuMoment), et deux boutons − et + qui ouvrent une
 * case où saisir le nombre à retirer ou à ajouter (ajusterValeurDuMoment, borné comme le curseur) : Entrée ou OK l'applique, Échap abandonne.
 */
function carteDeJauge(champ) {
  const def = JAUGES[champ];
  const curseur = el('input', {
    type: 'range', min: '0', step: '1', class: 'curseur', 'aria-label': `${def.nom()} du moment`,
    oninput: (ev) => {
      Object.assign(fiche, ecrireValeurDuMoment(regles, fiche, champ, ev.target.value));   // la corruption emporte le chakra actuel avec elle
      changer();
    },
  });
  let sens = 1;
  const saisie = el('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', required: true });
  const etiquette = el('span', {});
  const fermer = (focus = false) => {
    ajout.hidden = true;
    saisie.value = '';
    moins.setAttribute('aria-expanded', 'false');
    plus.setAttribute('aria-expanded', 'false');
    if (focus) (sens > 0 ? plus : moins).focus();
  };
  const ajout = el('form', {
    class: 'ajout', hidden: true,
    onsubmit: (ev) => {
      ev.preventDefault();
      const n = entier(saisie.value);
      fermer(true);
      if (n > 0) {
        Object.assign(fiche, ajusterValeurDuMoment(regles, fiche, champ, sens * n));
        changer();
      }
    },
    onkeydown: (ev) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopPropagation();
      fermer(true);
    },
  }, el('label', {}, etiquette, saisie), el('button', { type: 'submit' }, 'OK'),
  el('button', { type: 'button', class: 'retirer', 'aria-label': 'Annuler', title: 'Annuler (Échap)', onclick: () => fermer(true) }, '✕'));
  const ouvrir = (s) => {
    if (!ajout.hidden && sens === s) return fermer(true);
    sens = s;
    etiquette.textContent = s > 0 ? 'Ajouter' : 'Retirer';
    ajout.dataset.sens = s > 0 ? 'plus' : 'moins';
    ajout.hidden = false;
    moins.setAttribute('aria-expanded', String(s < 0));
    plus.setAttribute('aria-expanded', String(s > 0));
    saisie.focus();
  };
  const moins = el('button', { type: 'button', class: 'ajuster', 'aria-expanded': 'false', onclick: () => ouvrir(-1) }, '−');
  const plus = el('button', { type: 'button', class: 'ajuster', 'aria-expanded': 'false', onclick: () => ouvrir(1) }, '+');
  const nom = el('span', { class: 'attribut__nom' });
  const valeur = el('output', { class: 'attribut__valeur' });
  synchro(() => {
    const j = calcul.jauges.find((x) => x.champ === champ);
    const texte = def.nom();
    nom.textContent = texte;
    curseur.max = String(j.max);
    poser(curseur, j.valeur);
    curseur.setAttribute('aria-label', `${texte} du moment`);
    moins.setAttribute('aria-label', `Retirer de : ${texte}`);
    moins.title = `Retirer un nombre (${texte})`;
    plus.setAttribute('aria-label', `Ajouter à : ${texte}`);
    plus.title = `Ajouter un nombre (${texte})`;
    saisie.setAttribute('aria-label', `${texte} : nombre à ${sens > 0 ? 'ajouter' : 'retirer'}`);
    valeur.textContent = `${j.hors ? fiche[champ] : j.valeur} / ${j.max}`;
    valeur.toggleAttribute('data-hors', j.hors);
    valeur.title = def.detail(j);   // le calcul du maximum en infobulle seulement (« les textes de calcul sont inutiles », demande du propriétaire)
  });
  return el('div', { class: 'attribut attribut--jauge', dataset: { a: def.a } },
    el('span', { class: 'attribut__tete' }, nom, valeur), el('span', { class: 'attribut__curseur' }, moins, curseur, plus), ajout);
}

/**
 * Attributs et valeurs du moment, fusionnés (demandes du propriétaire) : santé, barrière, chakra (et Âme ou Sang, la 4ᵉ barre de la Nécromancie ou du
 * Sang) en cartes, chacune dans la couleur de son attribut ; puis initiative, vitesse et vitesse de nage en simples pastilles, à côté de la corruption ;
 * l'armure de base n'y est plus (les AP/AM viendront avec l'armure portée).
 */
function construireAttributs() {
  const barres = ['sante_actuelle', 'barriere_actuelle', 'chakra_actuel', 'barre4_actuelle'].filter((c) => calcul.jauges.some((j) => j.champ === c));
  reconstruire($('attributs-barres'), barres.join(), () => barres.map(carteDeJauge));
  reconstruire($('attributs-corruption'), 'fixe', () => carteDeJauge('corruption'));
  const a = calcul.attributs;
  const pastilles = [
    // 1D20 + le bonus de l'Agilité + celui du métier (« +X INI », décision R33)
    ['Initiative', a.initiative || a.initiativeMetier || a.initiativeAccessoires ? `1D20 ${a.initiativeBonus >= 0 ? '+' : '−'} ${Math.abs(a.initiativeBonus)}` : '1D20',
      [a.initiative?.note ?? 'Selon l’Agilité', a.initiativeMetier ? `${signe(a.initiativeMetier)} du métier` : null,
        a.initiativeAccessoires ? `${signe(a.initiativeAccessoires)} des accessoires` : null].filter(Boolean).join(' · ')],
    // vitesse et vitesse de nage de la race, de l'ethnie et du métier (décision R37)
    ['Vitesse', a.vitesseSol ?? '—', `Vitesse sur terre (race et ethnie${a.vitesseMetier ? `, ${signe(a.vitesseMetier)} du métier` : ''}${a.vitesseAccessoires ? `, ${signe(a.vitesseAccessoires)} des accessoires` : ''})`],
    ['Nage', a.vitesseNage ?? '—', `Vitesse de nage (race et ethnie${a.vitesseNageMetier ? `, ${signe(a.vitesseNageMetier)} du métier` : ''})`],
  ];
  reconstruire($('attributs-pastilles'), JSON.stringify(pastilles), () => pastilles.map(([nom, valeur, titre]) => el('li', { title: titre }, el('strong', {}, `${nom} `), String(valeur))));
}

/**
 * Les six postures (demande du propriétaire), chacune dans sa case avec ses effets du tableau de la fiche, toujours lisibles, avantages en vert et
 * inconvénients en rouge, sur deux lignes : un clic choisit la posture du moment (personnage.posture_id), un second la retire. À droite, une fois débloqués
 * (modeHyperDe : niveaux 2 et 10), les cases du Mode Hyper (effets de base, de la magie et de la race) et du Mode Hyper 100 % (demande du propriétaire),
 * pour lecture.
 */
function construirePostures() {
  const hyper = modeHyperDe(regles, fiche);
  const cleHyper = JSON.stringify(hyper && [hyper.debloque, hyper.cent.debloque, hyper.magies.map((m) => m.effet), hyper.race?.nom, hyper.toursAccessoires]);
  // dans l'ordre des cases de la fiche (regles.ordre_postures) ; chaque effet en vert (avantage) ou en rouge (inconvénient : `inconvenients`, par rang)
  const ordre = (p) => (regles.ordre_postures ?? []).indexOf(p.id);
  reconstruire($('postures'), 'fixe', () => [...regles.postures].sort((a, b) => ordre(a) - ordre(b)).map((p) => {
    const bouton = el('button', {
      type: 'button', class: 'posture-carte', style: `--c: ${p.couleur}; --c-texte: ${p.texte}`, 'aria-pressed': 'false',
      onclick: () => {
        fiche.posture_id = fiche.posture_id === p.id ? null : p.id;
        changer();
      },
    }, el('span', { class: 'posture-carte__nom' }, p.nom), el('ul', { class: 'posture-carte__effets' }, p.effets.map((e, i) => {
      const inconvenient = (p.inconvenients ?? []).includes(i + 1);
      return el('li', { class: inconvenient ? 'est-inconvenient' : 'est-avantage' }, el('span', { class: 'visuellement-cache' }, inconvenient ? 'Inconvénient : ' : 'Avantage : '), e);
    })));
    synchro(() => bouton.setAttribute('aria-pressed', String(fiche.posture_id === p.id)));
    return bouton;
  }));
  const cartesHyper = $('postures-hyper');
  cartesHyper.hidden = !hyper?.debloque;
  reconstruire(cartesHyper, cleHyper, () => [
    hyper?.debloque ? el('div', { class: 'posture-carte posture-carte--hyper' },
      el('span', { class: 'posture-carte__nom' }, 'Mode Hyper', el('small', {}, ` · dès le niveau ${hyper.niveau}`)),
      el('ul', { class: 'posture-carte__effets' }, hyper.effets.map((e) => el('li', {}, e)),
        hyper.magies.map((m) => el('li', { class: 'posture-carte__magie', style: `--m: ${m.magie.couleur}` }, el('strong', {}, `${m.magie.nom} : `), m.effet)),
        hyper.race ? el('li', { class: 'posture-carte__race' }, el('strong', {}, `${hyper.race.nom ?? 'Race'} : `), hyper.race.effet) : null,
        // accessoire « +1 tour de Mode Hyper (100% exclu) » (décision R54)
        hyper.toursAccessoires ? el('li', {}, el('strong', {}, 'Accessoires : '), `${signe(hyper.toursAccessoires)} tour${Math.abs(hyper.toursAccessoires) > 1 ? 's' : ''} (pas le Mode Hyper 100 %)`) : null)) : null,
    hyper?.cent.debloque ? el('div', { class: 'posture-carte posture-carte--hyper posture-carte--cent' },
      el('span', { class: 'posture-carte__nom' }, 'Mode Hyper 100 %', el('small', {}, ` · dès le niveau ${hyper.cent.niveau}`)),
      el('ul', { class: 'posture-carte__effets' }, hyper.cent.effets.map((e) => el('li', {}, e)),
        hyper.cent.suite ? el('li', { class: 'posture-carte__suite' }, `${hyper.cent.suite.charAt(0).toUpperCase()}${hyper.cent.suite.slice(1)}`) : null)) : null,
  ]);
}

// ------------------------------------------------------------------ les choix qui restent à faire, en tiroir (demande du propriétaire)
/** Le choix `nature` (et de la classe `rang`) reste à faire (choixEnAttente, refait à chaque rafraîchissement) : son champ est surligné. */
const aChoisir = (nature, rang = null) => (calcul?.attente ?? []).some((c) => c.nature === nature && (rang === null || c.rang === rang));

/**
 * La spécialité de chaque classe qui y a droit (niveau de son don de spécialité atteint), aussi choisie dans le cadre « Choix » (demande du propriétaire :
 * « le doubler dans le menu de choix ») : les mêmes pastilles que le menu de l'identité, surlignées tant qu'elle n'est pas choisie.
 */
function construireChoixSpecialites() {
  const classes = calcul.classes.filter((c) => c.classe?.specialites.length && c.niveau >= niveauDeSpecialite(c.classe));
  const bloc = $('choix-specialites');
  bloc.hidden = classes.length === 0;
  reconstruire(bloc, JSON.stringify(classes.map((c) => [c.rang, c.classe.id])), () => classes.map((c) => {
    const choixDe = () => calcul.classes.find((x) => x.rang === c.rang)?.choix;
    const cadre = groupe(`Spécialité · ${c.classe.nom}`, c.classe.couleur, c.classe.specialites.map((s) => pastille({
      texte: s.nom, couleur: c.classe.couleur, detail: s.magique ? 'classe magique' : null,
      choisie: () => choixDe()?.specialite_id === s.id,
      surClic: () => {
        const l = ligneDe('classes', (x) => x.rang === c.rang);
        if (!l) return;
        l.specialite_id = l.specialite_id === s.id ? null : s.id;
        fiche.capacites = donsValables(regles, fiche);
        changer();
      },
    })));
    cadre.dataset.choixCle = cleDeChoix.specialite(c.rang);
    synchro(() => cadre.toggleAttribute('data-a-choisir', aChoisir('specialite', c.rang)));
    return cadre;
  }));
}

/**
 * Tant qu'il reste des choix à faire (choixEnAttente), le panneau « Choix » de la zone IV sort en tiroir en bas de l'écran, par-dessus la fiche, avec la
 * liste de ce qui manque ; il ne se range que quand la zone IV est à l'écran (son onglet « Choix » compte alors ce qui manque). « Réduire » le replie sur sa
 * poignée (le survol le rouvre), « Aller aux choix » descend à la zone IV et ouvre l'onglet.
 */
let zoneParametresVisible = false;
let tiroirReduit = false;
function construireChoixEnAttente() {
  const attente = calcul?.attente ?? choixEnAttente(regles, fiche);
  const panneau = $('etape-choix');
  const compte = $('choix-compte');
  compte.hidden = attente.length === 0;
  compte.textContent = String(attente.length);
  compte.title = attente.length ? `${attente.length} choix à faire` : '';
  $('choix-tete').hidden = attente.length === 0;
  $('choix-titre').textContent = attente.length > 1 ? `${attente.length} choix à faire` : 'Un choix à faire';
  // au survol (ou au focus) d'un choix, sa tuile dans une infobulle (demande du propriétaire ; bulleDeChoix)
  reconstruire($('choix-attente'), JSON.stringify(attente), () => attente.map((c) => {
    const tuile = () => tuileDeChoix(c.cle);
    const remplir = () => remplirBulleDeChoix(c.cle);
    return el('li', {
      dataset: { nature: c.nature, ...(tuile() ? { bulle: bulleDeChoix().id } : {}) }, tabindex: c.nature === 'ethnie' ? null : '0',
      onpointerover: remplir, onpointerdown: remplir, onfocusin: remplir,
    }, c.nature === 'ethnie'
      ? el('button', { type: 'button', class: 'tiroir__lien', 'aria-label': `${c.libelle} : ouvrir le menu de l’ethnie`, onclick: (ev) => { ev.stopPropagation(); ouvrirMenu('choix-ethnie'); } }, c.libelle)
      : c.libelle);
  }));
  const bulle = document.getElementById('bulle-choix');
  if (bulle && !bulle.hidden) remplirBulleDeChoix(bulle.dataset.cle);
  const tiroir = attente.length > 0 && !zoneParametresVisible;
  panneau.classList.toggle('est-tiroir', tiroir);
  panneau.toggleAttribute('data-reduit', tiroir && tiroirReduit);
  $('choix-aller').hidden = !tiroir;
  $('choix-reduire').hidden = !tiroir;
  $('choix-reduire').textContent = tiroirReduit ? 'Déplier' : 'Réduire';
  $('choix-reduire').setAttribute('aria-expanded', String(!tiroirReduit));
}

/**
 * L'infobulle d'un choix du tiroir (demande du propriétaire : « la tuile correspondant au choix qui apparaît dans la tooltip au survol ») : une copie de
 * la tuile du choix (`data-choix-cle` = la clé de choixEnAttente : pastilles de l'ethnie ou de la spécialité, groupe de dons, choix du métier, +1 de la
 * magie innée), dans une bulle riche de components/Infobulles.astro, remplie juste avant qu'elle s'ouvre. Ses boutons, cases et listes renvoient leur clic
 * ou leur valeur à la tuile de la page : le choix se fait aussi depuis la bulle. Une seule bulle, posée dans la zone IV hors du tiroir (son `transform`
 * fausserait la position fixe).
 */
const tuileDeChoix = (cle) => (cle ? [...racine.querySelectorAll('[data-choix-cle]')].find((t) => t.dataset.choixCle === cle && !t.closest('#bulle-choix')) ?? null : null);
const CHAMPS_DE_TUILE = 'button, input, select';

function bulleDeChoix() {
  let bulle = document.getElementById('bulle-choix');
  if (bulle) return bulle;
  bulle = el('span', { class: 'bulle bulle--tuile', role: 'tooltip', id: 'bulle-choix', hidden: true });
  const original = (champ) => {
    const copie = bulle.querySelector('[data-copie]');
    const tuile = tuileDeChoix(bulle.dataset.cle);
    if (!copie || !tuile) return null;
    const i = [...copie.querySelectorAll(CHAMPS_DE_TUILE)].indexOf(champ);
    return i < 0 ? null : tuile.querySelectorAll(CHAMPS_DE_TUILE)[i] ?? null;
  };
  bulle.addEventListener('click', (ev) => {
    const champ = ev.target instanceof Element ? ev.target.closest('button, input') : null;
    const cible = champ && original(champ);
    if (!cible) return;
    ev.preventDefault();
    cible.click();
  });
  bulle.addEventListener('change', (ev) => {
    const cible = ev.target instanceof HTMLSelectElement ? original(ev.target) : null;
    if (!cible) return;
    cible.value = ev.target.value;
    cible.dispatchEvent(new Event('input', { bubbles: true }));
    cible.dispatchEvent(new Event('change', { bubbles: true }));
  });
  ($('etape-choix').closest('.fiche-zone') ?? racine).append(bulle);   // les couleurs de la zone IV, hors du tiroir
  return bulle;
}

/** Remplit la bulle avec la copie de la tuile du choix `cle`, dans un conteneur comme le sien (ses styles), sans identifiant ni nom de groupe partagés. */
function remplirBulleDeChoix(cle) {
  const tuile = tuileDeChoix(cle);
  const bulle = bulleDeChoix();
  if (!tuile) return;
  bulle.dataset.cle = cle;
  const copie = tuile.cloneNode(true);
  copie.removeAttribute('data-choix-cle');
  copie.hidden = false;
  copie.setAttribute('data-copie', '');
  for (const n of [copie, ...copie.querySelectorAll('[id]')]) n.removeAttribute('id');
  for (const n of copie.querySelectorAll('input[name]')) n.name = `bulle-${n.name}`;
  for (const n of [copie, ...copie.querySelectorAll('[data-champ]')]) n.removeAttribute('data-champ');   // la tuile de la page reste le seul champ de la fiche
  // l'état coché ou choisi d'un champ n'est pas toujours un attribut : on le recopie
  const sources = tuile.querySelectorAll(CHAMPS_DE_TUILE);
  copie.querySelectorAll(CHAMPS_DE_TUILE).forEach((n, i) => {
    if (n instanceof HTMLInputElement) n.checked = sources[i].checked;
    if (n instanceof HTMLSelectElement) n.value = sources[i].value;
  });
  const parent = tuile.parentElement;
  const enveloppe = parent && parent.matches('ul, ol') ? parent.cloneNode(false) : null;
  enveloppe?.removeAttribute('id');
  enveloppe?.removeAttribute('aria-label');
  if (enveloppe) enveloppe.append(copie);
  bulle.replaceChildren(enveloppe ?? copie);
}

/** Ouvre un menu déroulant de la fiche (la spécialité d'une classe, depuis le tiroir des choix) et l'amène à l'écran. */
function ouvrirMenu(id) {
  const menu = $(id);
  if (!menu || menu.hidden) return;
  menu.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  menu.open = true;
  menu.querySelector('summary')?.focus({ preventScroll: true });
}

// ------------------------------------------------------------------ saisie d'un curseur (demande du propriétaire)
/**
 * Un clic droit sur un curseur (ou Entrée quand il a le focus) le remplace par une case de saisie : le nombre tapé, ramené entre le minimum et le
 * maximum du curseur (borner), lui est donné à Entrée ou quand la case perd le focus ; Échap abandonne.
 */
function ouvrirSaisie(curseur) {
  if (curseur.disabled || curseur.hidden) return;
  const min = Number(curseur.min || 0);
  const max = Number(curseur.max || 100);
  const saisie = el('input', {
    type: 'number', class: 'curseur-saisie', min: String(min), max: String(max), step: '1', inputmode: 'numeric',
    'aria-label': `${curseur.getAttribute('aria-label') ?? 'Valeur'} : saisie (de ${min} à ${max})`,
  });
  saisie.value = curseur.value;
  let fini = false;
  const fermer = (valider) => {
    if (fini) return;
    fini = true;
    const v = valider ? borner(saisie.value, min, max) : null;
    saisie.remove();
    curseur.hidden = false;
    curseur.focus();
    if (v !== null && String(v) !== curseur.value) {
      curseur.value = String(v);
      curseur.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  saisie.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    fermer(ev.key === 'Enter');
  });
  saisie.addEventListener('blur', () => fermer(true));
  curseur.hidden = true;
  curseur.after(saisie);
  saisie.focus();
  saisie.select();
}

// ------------------------------------------------------------------ progression et dons à choix
/**
 * Gains de niveau, compacts (demande du propriétaire : « la liste des bonus est trop grande ») : une petite carte par niveau atteint, côte à côte —
 * santé et chakra (15 points exactement), le total, et aux niveaux qui en donnent un, le dé bonus (sur quoi, et son résultat). Le dé n'est décrit
 * qu'une fois, au-dessus (progressionAttendue : table niveau_global).
 */
function construireProgression() {
  const attendus = progressionAttendue(regles, calcul.niveau);
  const des = [...new Set(attendus.filter((n) => n.de).map((n) => n.de))];
  const niveauxDuDe = (de) => attendus.filter((n) => n.de === de).map((n) => n.niveau);
  $('progression-aide').textContent = attendus.length
    ? `À chaque niveau à partir du 2 : ${attendus[0].points} points d’attributs à répartir entre la santé (case rouge) et le chakra (case bleue), exactement.${des.map((de) => ` Dé bonus au${niveauxDuDe(de).length > 1 ? 'x' : ''} niveau${niveauxDuDe(de).length > 1 ? 'x' : ''} ${niveauxDuDe(de).join(', ')} : ${de}.`).join('')}`
    : 'Les gains commencent au niveau 2.';
  reconstruire($('progression'), `${calcul.niveau}`, () => attendus.map((n) => {
    const trouverLigne = () => ligne('progression', (x) => x.niveau === n.niveau, () => ({ niveau: n.niveau, points_sante: 0, points_chakra: 0, de_choix: null, de_resultat: null }));
    const champ = (cle, nom) => el('input', {
      type: 'number', min: '0', step: '1', class: `gain__${cle === 'points_sante' ? 'sante' : 'chakra'}`, 'aria-label': `Niveau ${n.niveau} : ${nom}`, title: nom,
      oninput: (ev) => { trouverLigne()[cle] = entier(ev.target.value); changer(); },
    });
    const sante = champ('points_sante', 'santé');
    const chakra = champ('points_chakra', 'chakra');
    const total = el('span', { class: 'gain__total' });
    const de = n.de ? el('select', {
      'aria-label': `Niveau ${n.niveau} : dé bonus (${n.de})`, title: n.de,
      onchange: (ev) => {
        const l = trouverLigne();
        l.de_choix = ev.target.value || null;
        if (!l.de_choix) l.de_resultat = null;
        changer();
      },
    }, option('', 'Dé : —'), option('sante', 'Santé'), option('chakra', 'Chakra'), option('les_deux', 'Les deux')) : null;
    const resultat = n.de ? el('input', { type: 'number', min: '1', step: '1', 'aria-label': `Niveau ${n.niveau} : résultat du dé`, title: 'Résultat du dé', oninput: (ev) => { trouverLigne().de_resultat = ev.target.value === '' ? null : entier(ev.target.value); changer(); } }) : null;
    synchro(() => {
      const l = ligneDe('progression', (x) => x.niveau === n.niveau);
      poser(sante, l ? l.points_sante : '');
      poser(chakra, l ? l.points_chakra : '');
      const t = l ? entier(l.points_sante) + entier(l.points_chakra) : 0;
      total.textContent = `${t}/${n.points}`;
      total.toggleAttribute('data-hors', t !== n.points);
      total.title = `${t} points répartis sur ${n.points}`;
      if (de) poser(de, l?.de_choix ?? '');
      if (resultat) {
        poser(resultat, l?.de_resultat ?? '');
        resultat.disabled = !l?.de_choix;
      }
    });
    return el('div', { class: `gain${n.de ? ' gain--de' : ''}` },
      el('span', { class: 'gain__niveau' }, `Niv. ${n.niveau}`), sante, chakra, total,
      n.de ? el('span', { class: 'gain__de' }, de, resultat) : null);
  }));

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
          const cadre = el('fieldset', { class: 'dons-groupe', dataset: { choixCle: cleDeChoix.don(d.rang, g) } },
            el('legend', {}, `Niveau de classe ${g.niveau}${specialite ? ` · ${specialite.nom}` : ''} : un seul au choix`),
            el('div', { class: 'dons-options' },
              el('label', {}, radio(null), 'Pas encore choisi'),
              g.options.map((o) => el('label', {}, radio(o), o.nom, el('small', { class: 'muted' }, ` (${o.type})`)))));
          // un groupe encore sans choix est surligné (demande du propriétaire)
          synchro(() => {
            const choisis = new Set((fiche.capacites ?? []).map((c) => c.capacite_id));
            cadre.toggleAttribute('data-a-choisir', !g.options.some((o) => choisis.has(o.id)));
          });
          return cadre;
        })));
  });
}

// ------------------------------------------------------------------ équipement
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
const NOMS_DES_CIBLES = {
  sante: 'Santé', chakra: 'Chakra', barriere: 'Barrière', initiative: 'Initiative', vitesse: 'Vitesse', barre4_max: 'Sang ou Âme max', armure_ap: 'AP de base',
  armure_am: 'AM de base', degats_physiques: 'Dégâts des armes', degats_magie: 'Dégâts des sorts d’attaque', portee_distance: 'Portée des armes à distance',
  portee_sorts: 'Portée des sorts', maitrise_arme: 'Point de maîtrise d’arme', mode_hyper_tours: 'Tour de Mode Hyper',
};
/** Ce qu'un effet d'accessoire change, en quelques mots (« Initiative +5 », « Acquis Arme lourde +7 », « Résistance Feu +1 »). */
function texteDEffet(e) {
  const nomDe = (liste, id) => trouver(liste, id)?.nom ?? id;
  const quoi = e.cible === 'caracteristique' ? nomDe(regles.caracteristiques, e.cible_id)
    : e.cible === 'competence' ? `Acquis ${nomDe(regles.competences, e.cible_id)}`
      : e.cible === 'degats_famille' ? `Dégâts ${nomDe(regles.familles_armes, e.cible_id)}`
        : e.cible === 'resistance' ? `Résistance ${nomDe([...regles.magies, ...(regles.etats ?? [])], e.cible_id)}`
          : NOMS_DES_CIBLES[e.cible] ?? e.cible;
  return `${quoi} ${signe(e.valeur)}`;
}


function construireEquipement() {
  reconstruire($('armes'), 'fixe', () => [1, 2].map((rang) => {
    const l = () => ligneDe('armes', (x) => x.rang === rang);
    // une arme choisie sans matériau prend le fer (armesApresChoix, décision R49)
    const poserChamp = (cle) => (v) => {
      if (cle === 'arme_id') fiche.armes = armesApresChoix(regles, fiche, rang, v);
      else if (l()) l()[cle] = v;
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
    // les dégâts de l'arme, « XDY+Z » (degatsDArme, demande du propriétaire) : les dés de sa maîtrise et son dé, plus les bonus de l'équipement et des dons
    // passifs qui la visent, le détail en infobulle (avec les bonus de dons qui ne se comptent pas) ; avec deux armes de mêlée, une étoile à côté dit le
    // malus d'attaque de cette main (attaqueADeuxArmes, décision du propriétaire : « −10 % si ambidextre » ; l'arme 1 est l'arme principale)
    const des = el('strong', { class: 'objet__des' });
    const etoile = el('span', { class: 'objet__etoile', tabindex: '0', role: 'img' }, '★');
    const resume = el('span', { class: 'objet__resume' });
    synchro(() => {
      const x = l();
      poser(effet, x?.effet_en_plus ?? '');
      for (const d of [effet, ...details]) d.disabled = !x;
      const d = degatsDArme(regles, fiche, rang);
      des.hidden = !d;
      if (d) {
        des.textContent = d.texte;
        des.title = [
          `${d.notation} : ${d.nombre} dé${d.nombre > 1 ? 's' : ''} (maîtrise) de ${d.de ?? '—'}`,
          ...d.bonus.map((b) => `+${b.valeur} ${b.nom}`),
          ...(d.porteeEnPlus ? [`Portée ${signe(d.porteeEnPlus)} (accessoires)`] : []),
          ...(d.nonComptes.length ? ['Non comptés :', ...d.nonComptes.map((n) => `+${n.valeur} ${n.nom} (${n.raison === 'mains' ? 'arme à une main non écrite' : RAISONS[n.raison]})`)] : []),
        ].join('\n');
      }
      const deux = attaqueADeuxArmes(regles, fiche);
      const main = deux?.mains[rang - 1];
      etoile.hidden = !main;
      if (main) {
        const texte = `−${String(main.malus).replace('.', ',')} % si ambidextre`;
        const pourquoi = [main.dague ? 'dague' : null, deux.bimane ? 'Bimane' : null].filter(Boolean);
        etoile.title = `${texte} (main ${main.main}${pourquoi.length ? ` ; moitié : ${pourquoi.join(', ')}` : ''})${deux.aPreciser.length ? `\nÀ appliquer à la main : ${deux.aPreciser.join(', ')}` : ''}`;
        etoile.setAttribute('aria-label', texte);
      }
      const choisis = [trouver(regles.materiaux_armes, x?.materiau_id)?.nom, x?.amelioration_id && 'amélioration', trouver(regles.armes_elementaires, x?.arme_elementaire_id)?.nom, x?.effet_en_plus && 'effet en plus'].filter(Boolean);
      resume.textContent = choisis.length ? choisis.join(' · ') : 'composition, amélioration, élément…';
    });
    // à portée de main (demande du propriétaire) : l'arme et ses dés ; composition, améliorations, élément et effet en plus repliés
    return el('div', { class: 'objet' }, el('div', { class: 'objet__tete' }, el('h4', {}, `Arme ${rang}`), el('span', { class: 'objet__degats' }, des, etoile)),
      el('label', { class: 'fiche-champ' }, el('span', { class: 'visuellement-cache' }, 'Arme'), selecteur(() => l()?.arme_id, optionsGroupees(regles.armes, (a) => familles.get(a.famille_id), (a) => a.nom), poserChamp('arme_id'), { vide: 'Aucune', etiquette: `Arme ${rang}` })),
      el('details', { class: 'objet__details' }, el('summary', {}, resume), el('div', { class: 'fiche-champs' },
      champ('Composition', selecteur(() => l()?.materiau_id, regles.materiaux_armes.map((m) => option(m.id, m.nom)), poserChamp('materiau_id'), { etiquette: `Arme ${rang} : composition` })),
      champ('Amélioration', selecteur(() => l()?.amelioration_id, ameliorations('arme'), poserChamp('amelioration_id'), { etiquette: `Arme ${rang} : amélioration` })),
      champ('Élément', selecteur(() => l()?.arme_elementaire_id, regles.armes_elementaires.map((a) => option(a.id, a.nom)), poserChamp('arme_elementaire_id'), { etiquette: `Arme ${rang} : élément` })),
      champ('Amélioration de l’élément', selecteur(() => l()?.amelioration_elementaire_id, ameliorations('arme_elementaire'), poserChamp('amelioration_elementaire_id'), { etiquette: `Arme ${rang} : amélioration de l’élément` })),
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Effet en plus'), effet))));
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
      // l'effet à choix (décision R54) : « Compétence X » → une compétence de cette caractéristique ; « +5 dégâts avec une catégorie d'arme » → une famille
      const choixCompetence = el('select', { 'aria-label': `${nom} : compétence de l’accessoire`,
        onchange: (ev) => { obtenir().competence_id = ev.target.value || null; changer(); } });
      const choixFamille = el('select', { 'aria-label': `${nom} : famille d’armes de l’accessoire`,
        onchange: (ev) => { obtenir().arme_famille_id = ev.target.value || null; changer(); } });
      const resumeEffet = el('span', { class: 'accessoire-effet' });
      synchro(() => {
        const x = l();
        const effet = trouver(regles.accessoires, x?.accessoire_effet_id);
        const cibles = (effet?.effets ?? []).map((c) => c.cible);
        const caracId = effet?.effets.find((c) => c.cible === 'competence')?.cible_id ?? null;
        choixCompetence.hidden = !caracId;
        if (caracId) {
          const options = regles.competences.filter((k) => k.caracteristique_id === caracId);
          const cleOptions = `${caracId}`;
          if (choixCompetence.dataset.options !== cleOptions) {
            choixCompetence.replaceChildren(el('option', { value: '' }, '— compétence —'), ...options.map((k) => el('option', { value: k.id }, k.nom)));
            choixCompetence.dataset.options = cleOptions;
          }
          choixCompetence.value = options.some((k) => k.id === x?.competence_id) ? x.competence_id : '';
          choixCompetence.toggleAttribute('data-a-choisir', !choixCompetence.value);
        }
        choixFamille.hidden = !cibles.includes('degats_famille');
        if (!choixFamille.hidden) {
          if (!choixFamille.options.length) {
            choixFamille.replaceChildren(el('option', { value: '' }, '— famille d’armes —'), ...regles.familles_armes.filter((f) => f.maitrisable !== false).map((f) => el('option', { value: f.id }, f.nom)));
          }
          choixFamille.value = x?.arme_famille_id ?? '';
          choixFamille.toggleAttribute('data-a-choisir', !choixFamille.value);
        }
        // la tuile du choix dans le tiroir (choixEnAttente) : la liste affichée
        for (const liste of [choixCompetence, choixFamille]) {
          if (liste.hidden) delete liste.dataset.choixCle;
          else liste.dataset.choixCle = cleDeChoix.accessoire(cle);
        }
        // ce que l'accessoire change sur la fiche (effetsDesAccessoires)
        const effets = effetsDesAccessoires(regles, { ...fiche, accessoires: x ? [x] : [] });
        resumeEffet.textContent = effets.filter((e) => !e.aChoisir && e.valeur !== null).map(texteDEffet).join(' · ');
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
        el('td', { class: 'accessoire-cellule' }, selecteur(() => l()?.accessoire_effet_id, optionsGroupees(regles.accessoires, (a) => a.propriete, (a) => a.libelle + (a.min !== null ? ` (${a.min} à ${a.max})` : '')),
          (v) => {
            const x = obtenir();
            x.accessoire_effet_id = v;
            if (!v || trouver(regles.accessoires, v)?.min === null) x.valeur = null;
            x.competence_id = null;
            x.arme_famille_id = null;
            nettoyer();
            changer();
          }, { etiquette: `${nom} : effet` }), choixCompetence, choixFamille, resumeEffet),
        el('td', { class: 'nombre' }, valeur), el('td', {}, texte), el('td', {}, maudit));
    })),
  ]);

  reconstruire($('inventaire'), `${versionInventaire}:${(fiche.inventaire ?? []).length}`, () => [
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

// ------------------------------------------------------------------ portrait et ceinture (demandes du propriétaire)
/**
 * Le portrait (le logo en attendant une image, recadrable une fois choisie : personnage.portrait et son cadrage, migration 0031) et les 3 emplacements
 * de la ceinture (objets rapides, guide « Fiche de personnage : Accessoires et Ceinture » : personnage_ceinture), enregistrés avec la fiche.
 */
const PLACES_DE_CEINTURE = 3;
/** La vignette affichée (le carré cadré), refaite quand l'image ou son cadrage changent. */
let vignette = { cle: null };

function construirePortrait() {
  const figure = $('portrait');
  const image = $('portrait-image');
  const p = fiche.portrait;
  figure.toggleAttribute('data-vide', !p);
  image.alt = p ? `Portrait de ${fiche.nom || 'ce personnage'}` : 'Portrait du personnage (logo en attendant une image)';
  $('portrait-choisir').textContent = p ? 'Changer' : 'Choisir une image';
  $('portrait-recadrer').hidden = !p;
  $('portrait-retirer').hidden = !p;
  if (!p) {
    vignette = { cle: null };
    if (image.getAttribute('src') !== image.dataset.defaut) image.src = image.dataset.defaut;
    return;
  }
  const cadrage = cadrageDuPortrait();
  const cle = `${p.length}:${p.slice(-48)}:${cadrage.x}:${cadrage.y}:${cadrage.zoom}`;
  if (vignette.cle === cle) return;
  vignette = { cle };
  dessinerVignette(p, cadrage).then((url) => { if (vignette.cle === cle) image.src = url; }).catch(() => { image.src = image.dataset.defaut; });
}

/** Le cadrage enregistré (centré, sans zoom quand la fiche n'en a pas). */
const cadrageDuPortrait = () => cadrageDe({ x: fiche.portrait_x, y: fiche.portrait_y, zoom: fiche.portrait_zoom });

/** Le recadrage (src/scripts/portrait.mjs) : l'image d'origine et son cadrage validé entrent dans la fiche (annulé : rien ne change). */
async function recadrerPortrait(source, cadrage) {
  const c = await ouvrirRecadrage(source, cadrage);
  if (!c) return;
  Object.assign(fiche, { portrait: source, portrait_x: c.x, portrait_y: c.y, portrait_zoom: c.zoom });
  changer();
}

/** Les 3 emplacements de la ceinture : un objet (au catalogue des ressources ou non) et sa quantité (le nombre de flèches d'un carquois…). */
function construireCeinture() {
  reconstruire($('ceinture'), 'fixe', () => Array.from({ length: PLACES_DE_CEINTURE }, (_, i) => {
    const rang = i + 1;
    const l = () => ligneDe('ceinture', (x) => entier(x.rang) === rang);
    const ecrire = (cle, valeur) => {
      const x = ligne('ceinture', (y) => entier(y.rang) === rang, () => ({ rang, nom: '', quantite: 1, ressource_id: null }));
      x[cle] = valeur;
      if (cle === 'nom') x.ressource_id = regles.ressources.find((r) => r.nom === valeur)?.id ?? null;
      if (!String(x.nom ?? '').trim()) retirer('ceinture', (y) => y === x);
      changer();
    };
    const nom = el('input', { list: 'liste-ressources', 'aria-label': `Ceinture, emplacement ${rang} : objet`, placeholder: 'Libre', oninput: (ev) => ecrire('nom', ev.target.value) });
    const quantite = el('input', { type: 'number', min: '1', step: '1', 'aria-label': `Ceinture, emplacement ${rang} : quantité`, title: 'Quantité (flèches d’un carquois…)', oninput: (ev) => ecrire('quantite', entier(ev.target.value, 1)) });
    const vider = el('button', { type: 'button', class: 'retirer', 'aria-label': `Vider l’emplacement ${rang} de la ceinture`, title: 'Vider', onclick: () => { retirer('ceinture', (y) => entier(y.rang) === rang); changer(); } }, '✕');
    const li = el('li', { class: 'ceinture__emplacement' }, el('span', { class: 'ceinture__numero', 'aria-hidden': 'true' }, String(rang)), nom, quantite, vider);
    synchro(() => {
      const x = l();
      if (document.activeElement !== nom) poser(nom, x?.nom ?? '');
      if (document.activeElement !== quantite) poser(quantite, x ? x.quantite : '');
      quantite.disabled = !x;
      vider.hidden = !x;
      li.toggleAttribute('data-plein', Boolean(x));
    });
    return li;
  }));
}

// ------------------------------------------------------------------ contrôles rendus par le service
/** Un détail de contrôle (« classes/guerrier », « force = 5 », « a / b ») avec les noms des règles à la place des identifiants. */
const avecNoms = (texte) => String(texte).split(/( \/ | : | = |« | »)/).map((x) => noms.get(x) ?? x).join('');

function construireControles() {
  const liste = $('controles');
  // l'onglet « Contrôle » de la zone IV compte les règles à revoir (vert quand il n'y en a aucune)
  const compte = $('controles-compte');
  compte.hidden = controles === null;
  compte.textContent = controles === null ? '' : controles.length ? String(controles.length) : '✓';
  compte.toggleAttribute('data-ok', controles !== null && controles.length === 0);
  compte.title = controles === null ? '' : controles.length ? `${controles.length} règle${controles.length > 1 ? 's' : ''} à revoir` : 'Aucune règle enfreinte';
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
/** Jauge d'XP, en tête du bloc de progression (demandes du propriétaire) : l'XP se modifie dans le champ, ou s'ajoute avec le bouton + ; le niveau suit. */
function construireXp() {
  const p = progressionXp(regles, fiche.xp);
  $('xp-niveau').textContent = `Niveau ${p.niveau}`;
  $('fiche-niveau').textContent = `Niveau ${p.niveau}`;
  $('identite-niveau').textContent = String(p.niveau);   // le niveau seul dans l'identité (demande du propriétaire)
  $('xp-objectif').textContent = p.suivant === null ? 'XP · niveau maximal' : `/ ${p.suivant} XP`;
  const jauge = $('xp-jauge');
  jauge.setAttribute('aria-valuemin', String(p.debut));
  jauge.setAttribute('aria-valuemax', String(p.suivant ?? p.xp));
  jauge.setAttribute('aria-valuenow', String(p.xp));
  jauge.setAttribute('aria-valuetext', p.suivant === null ? `${p.xp} XP, niveau maximal` : `${p.xp} XP ; niveau ${p.niveau + 1} à ${p.suivant} XP`);
  $('xp-rempli').style.width = `${Math.round(p.part * 1000) / 10}%`;
}

/**
 * La bannière des éléments que les règles ont retirés de la fiche (décision R42), d'après les lignes datées de ses notes (lib/fiche-format.mjs) :
 * recalculée à chaque saisie, elle part quand le joueur efface ces lignes.
 */
function construireRetraits() {
  const banniere = $('fiche-retraits');
  const r = resumeDesRetraits(fiche.notes);
  banniere.hidden = !r;
  banniere.replaceChildren();
  if (r) banniere.append(`${r.texte} `, el('a', { href: '#etape-jeu' }, 'Voir les notes'));
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
  calcul.jauges = valeursDuMoment(regles, fiche, calcul.attributs);
  calcul.attente = choixEnAttente(regles, fiche);
  for (const champ of racine.querySelectorAll('[data-champ]')) poser(champ, fiche[champ.dataset.champ]);
  // cadres des blocs dans la couleur de la magie innée, en dégradé vers celle de la magie acquise (demande du propriétaire ; fiche.css, « cadres »)
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  const acquise = trouver(regles.magies, fiche.magie_acquise_id);
  racine.toggleAttribute('data-magie', Boolean(innee));
  racine.style.setProperty('--magie-1', innee?.couleur ?? '');
  racine.style.setProperty('--magie-2', innee ? (acquise ?? innee).couleur : '');
  const titre = fiche.nom || (id ? 'Prétiré sans nom' : 'Nouveau prétiré');
  $('fiche-titre').textContent = titre;
  document.title = `${titre} — Fiche de personnage — Maverick Center`;
  construireXp();
  construireRaces();
  construireAlignement();
  construireMetier();
  construireMagies();
  construireResistances();
  construireClasses();
  construireChoixSpecialites();
  construireCaracteristiques();
  construireMaitrises();
  construireSorts();
  construireDons();
  construireAttributs();
  construirePostures();
  construireProgression();
  construireEquipement();
  construireCeinture();
  construirePortrait();
  for (const liste of synchros.values()) for (const s of liste) s();
  construireControles();
  construireRetraits();
  construireChoixEnAttente();
  $('fiche-enregistrer').disabled = !modifie && id !== null;
  $('fiche-supprimer').hidden = id === null;
  if (modifie) message(serviceJoignable ? 'Modifications non enregistrées.' : 'Service indisponible : exportez la fiche pour ne rien perdre.', 'attente');
}

// ------------------------------------------------------------------ enregistrement, chargement
/** La fiche à envoyer : listes nettoyées (lignes vides retirées, rangs renumérotés, pas de maîtrise sur ARME DE MONSTRES : décision R45). */
function aEnvoyer() {
  const f = structuredClone(fiche);
  for (const c of COLONNES_DU_SERVICE) delete f[c];
  delete f[CHAMP_VERSION];
  f.caracteristiques = (f.caracteristiques ?? []).filter((c) => c.base !== null && c.base !== undefined);
  f.competences = (f.competences ?? []).filter((c) => c.naturel || c.acquis);
  f.maitrises_armes = maitrisesValables(regles, f);
  f.sorts = (f.sorts ?? []).map((s, i) => ({ ...s, rang: i + 1 }));
  f.bouclier_materiaux = (f.bouclier_materiaux ?? []).filter((m) => m.materiau_id).map((m, i) => ({ ...m, rang: i + 1 }));
  f.inventaire = (f.inventaire ?? []).filter((o) => o.nom && o.nom.trim()).map((o, i) => ({ ...o, nom: o.nom.trim(), rang: i + 1 }));
  f.accessoires = (f.accessoires ?? []).filter((a) => a.accessoire_effet_id || a.texte);
  // la ceinture garde ses emplacements (rang 1 à 3) : seuls les emplacements vides partent
  f.ceinture = (f.ceinture ?? []).filter((o) => o.nom && o.nom.trim()).map((o) => ({ ...o, nom: o.nom.trim() }));
  return f;
}

function appliquer(donnees) {
  fiche = { ...ficheVide(''), ...donnees.personnage };
  versionInventaire += 1;   // une autre fiche : ses lignes d'inventaire sont d'autres objets
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
      message(controles.length ? `Enregistré : ${controles.length} règle${controles.length > 1 ? 's' : ''} à revoir (onglet « Contrôle »).` : 'Enregistré ✓', 'ok');
      return;
    }
    if (reponse.status === 409 && donnees.personnage) {
      // des éléments retirés par les règles depuis l'ouverture de la fiche (R42) : le dire, ils sont dans les notes de la fiche à jour
      const n = nouveauxRetraits(fiche.notes, donnees.personnage.notes).length;
      const avertissement = n ? `Les règles ont changé : ${n} élément(s) retiré(s) de cette fiche depuis son ouverture (voir les notes après rechargement). ` : '';
      message(`${avertissement}${donnees.erreur} `, 'erreur');
      $('fiche-message').append(el('button', { type: 'button', onclick: () => { appliquer({ personnage: donnees.personnage }); message('Fiche rechargée : les modifications non enregistrées sont perdues.', 'attente'); } }, 'Recharger la fiche'));
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
  versionInventaire += 1;   // une autre fiche : ses lignes d'inventaire sont d'autres objets
  id = null;
  version = null;
  controles = null;
  modifie = false;
  history.replaceState(null, '', racine.dataset.fiche);
  rafraichir();
  message('', '');
}

// ------------------------------------------------------------------ export et import (JSON, classeur)
/** Fait télécharger un fichier. */
function telecharger(blob, nom) {
  const lien = el('a', { href: URL.createObjectURL(blob), download: nom });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
}

/** Le jour, « JJ/MM/AAAA » (la ligne d'export de la case NOTE, celle d'un import dans les notes). */
function aujourdhui() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function exporter() {
  const f = aEnvoyer();
  telecharger(new Blob([`${JSON.stringify(f, null, 2)}\n`], { type: 'application/json' }), `${(f.nom || 'personnage').replace(/[^\p{L}\p{N}-]+/gu, '-')}.json`);
}

const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Le logo du modèle, à sa place dans l'archive (tools/fiche/modele.py) : l'import ne le prend pas pour un portrait. */
const LOGO_DU_MODELE = 'xl/media/image1.png';
let modeleDuClasseur = null;
let zonesDuModele = null;

/** Les octets du modèle (/fiche/modele.xlsx, lib/fiche-modele.mjs), lus une fois ; un échec se retente au prochain appel. */
function octetsDuModele() {
  if (!modeleDuClasseur) {
    modeleDuClasseur = fetch(racine.dataset.modele).then(async (reponse) => {
      if (!reponse.ok) throw new Error(`le modèle de la fiche n’a pas pu être chargé (HTTP ${reponse.status})`);
      return new Uint8Array(await reponse.arrayBuffer());
    });
    modeleDuClasseur.catch(() => { modeleDuClasseur = null; });
  }
  return modeleDuClasseur;
}

/** La taille des cases du modèle (lib/tableur-ecriture.mjs#zonesDuClasseur), lue une fois : un texte trop long pour sa case y est coupé, la suite dans la note. */
function zonesDesCases() {
  if (!zonesDuModele) {
    zonesDuModele = octetsDuModele().then(zonesDuClasseur);
    zonesDuModele.catch(() => { zonesDuModele = null; });
  }
  return zonesDuModele;
}

/** Le logo du modèle (octets), que l'import ne prend pas pour un portrait ; null s'il ne se lit pas (l'import s'en passe). */
async function logoDuModele() {
  try {
    return (await lireZip(await octetsDuModele())).get(LOGO_DU_MODELE) ?? null;
  } catch {
    return null;
  }
}

/**
 * Le classeur au modèle V15.2.2 ordinateur : les cases de la fiche (lib/fiche-tableur-export.mjs, sur la fiche telle qu'elle s'enregistre ; un texte
 * trop long pour sa case y est coupé, la suite dans la note), le portrait cadré à la place du logo (la vignette de la page, JPEG), marqué
 * « portrait:<empreinte de l'image d'origine> » pour qu'un import du fichier dans ce prétiré garde l'image d'origine et son cadrage ; sans portrait,
 * le logo du modèle, marqué « logo ».
 */
async function exporterTableur() {
  const bouton = $('fiche-exporter-tableur');
  bouton.disabled = true;
  message('Export du classeur…', 'attente');
  try {
    const f = aEnvoyer();
    const { cellules, remplis, alignements } = cellulesDeLaFiche(regles, f, { date: aujourdhui(), zones: await zonesDesCases() });
    let image = null;
    let descriptionImage = 'logo';
    if (fiche.portrait) {
      const octets = octetsDuPortrait(await dessinerVignette(fiche.portrait, cadrageDuPortrait()));
      if (octets) {
        image = { octets, type: 'image/jpeg' };
        descriptionImage = `portrait:${empreinte(fiche.portrait)}`;
      }
    }
    const classeur = await ecrireXlsx(await octetsDuModele(), { cellules, remplis, alignements, image, descriptionImage, titre: f.nom || 'Personnage', date: new Date() });
    // le nom du personnage tel quel, sans les caractères qu'un système de fichiers refuse
    const nom = String(f.nom ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim() || 'Personnage';
    telecharger(new Blob([classeur], { type: TYPE_XLSX }), `${nom} - Fiche Maverick V15.2.2.xlsx`);
    message('Classeur exporté.', 'ok');
  } catch (e) {
    message(`Le classeur n’a pas pu être exporté : ${e?.message ?? e}`, 'erreur');
  } finally {
    bouton.disabled = false;
  }
}

/**
 * Où va la fiche d'un fichier importé (« à tout moment ») : un prétiré enregistré est ouvert → le dialogue « import-cible » (le mettre à jour, créer un
 * nouveau prétiré, ou annuler ; la perte des modifications non enregistrées est dite) ; sinon, une confirmation s'il y a des modifications non
 * enregistrées. 'mettre-a-jour' | 'creer' | null (annulé).
 */
function cibleDeLImport() {
  if (!id) return Promise.resolve(!modifie || confirm('Remplacer la fiche en cours par celle du fichier ?') ? 'creer' : null);
  const d = $('import-cible');
  $('import-cible-maj').textContent = `Mettre à jour « ${fiche.nom || 'ce prétiré'} »`;
  $('import-cible-perte').hidden = !modifie;
  return new Promise((ok) => {
    d.addEventListener('close', () => ok(['mettre-a-jour', 'creer'].includes(d.returnValue) ? d.returnValue : null), { once: true });
    d.returnValue = '';
    d.showModal();
  });
}

/** La fiche importée remplace celle de la page : mise à jour, elle garde l'identifiant et la version du prétiré ouvert ; nouvelle, elle les oublie. */
function remplacerLaFiche(nouvelle, cible) {
  fiche = { ...ficheVide(''), ...nouvelle };
  versionInventaire += 1;   // une autre fiche : ses lignes d'inventaire sont d'autres objets
  for (const cle of Object.keys(PARTIES_DE_FICHE)) if (!Array.isArray(fiche[cle])) fiche[cle] = [];
  controles = null;
  if (cible === 'creer') {
    id = null;
    version = null;
    history.replaceState(null, '', racine.dataset.fiche);
  }
  changer();
}

/** « Enregistrez pour mettre à jour « X » » ou « … pour créer le prétiré ». */
const suiteDeLImport = (cible, nom) => `Enregistrez pour ${cible === 'creer' ? 'créer le prétiré' : `mettre à jour « ${nom} »`}.`;

/** Un fichier exporté en JSON (lib/fiche-format.mjs). */
async function importerJson(texte) {
  let objet;
  try {
    objet = JSON.parse(texte);
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) throw new Error('pas une fiche');
  } catch {
    message('Ce fichier n’est pas une fiche exportée.', 'erreur');
    return;
  }
  const nom = fiche.nom || 'ce prétiré';
  const cible = await cibleDeLImport();
  if (!cible) return;
  for (const c of [...COLONNES_DU_SERVICE, ...COLONNES_RETIREES.personnage, CHAMP_VERSION]) delete objet[c]; // le statut d'un fichier d'avant : ignoré
  remplacerLaFiche(objet, cible);
  message(`Fiche importée. ${suiteDeLImport(cible, nom)}`, 'attente');
}

/**
 * Un classeur (.xlsx, .ods, .csv) au modèle V15.2.2, ordinateur ou auto (lib/tableur-lecture.mjs, lib/fiche-tableur-import.mjs). Ce qui n'a pas de
 * place sur le site (`nonRepris`) et ce que l'import a déduit (`remarques`) s'ajoutent à la fin des notes, sous une ligne datée qui nomme le fichier.
 * Portrait : celui de la fiche ouverte quand le classeur porte son empreinte (un classeur exporté par la page : l'image d'origine et son cadrage) ;
 * sinon l'image ancrée en A1 qui n'est pas le logo du modèle, réduite comme une image choisie (cadrage par défaut) ; sinon aucun.
 */
async function importerClasseur(octets, nomFichier) {
  const date = aujourdhui();
  let lu;
  try {
    message('Lecture du classeur…', 'attente');
    const classeur = await lireClasseur(octets, { nom: nomFichier });
    lu = ficheDuClasseur(regles, classeur.feuille('Personnage'), {
      nomFichier, date, logo: await logoDuModele(), empreintePortrait: fiche.portrait ? empreinte(fiche.portrait) : null,
    });
  } catch (e) {
    message(`Ce classeur n’a pas pu être lu : ${e?.message ?? e}`, 'erreur');
    return;
  }
  const nom = fiche.nom || 'ce prétiré';
  const cible = await cibleDeLImport();
  if (!cible) {
    message('', '');
    return;
  }
  const nouvelle = { ...lu.fiche };
  const nonRepris = [...lu.nonRepris];
  if (lu.portraitGarde && fiche.portrait) {
    Object.assign(nouvelle, { portrait: fiche.portrait, portrait_x: fiche.portrait_x ?? null, portrait_y: fiche.portrait_y ?? null, portrait_zoom: fiche.portrait_zoom ?? null });
  } else if (lu.image) {
    try {
      Object.assign(nouvelle, { portrait: await reduireImage(new Blob([lu.image.octets], { type: lu.image.type })), portrait_x: null, portrait_y: null, portrait_zoom: null });
    } catch {
      nonRepris.push(`Portrait du classeur (${lu.image.type || 'image'}) : illisible ou trop lourd pour la fiche`);
    }
  }
  const lignes = [...nonRepris, ...lu.remarques];
  if (lignes.length) nouvelle.notes = ajouterAuxNotes(nouvelle.notes, [`[${date}] Import du classeur « ${nomFichier} » :`, ...lignes]);
  remplacerLaFiche(nouvelle, cible);
  // « : 3 informations sans équivalent ajoutées aux notes », « : 1 information sans équivalent et 2 remarques ajoutées aux notes »
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const dans = [
    nonRepris.length ? pluriel(nonRepris.length, 'information sans équivalent', 'informations sans équivalent') : null,
    lu.remarques.length ? pluriel(lu.remarques.length, 'remarque', 'remarques') : null,
  ].filter(Boolean);
  const notes = dans.length ? ` : ${dans.join(' et ')} ajouté${dans.length > 1 || nonRepris.length + lu.remarques.length > 1 ? 'es' : 'e'} aux notes` : '';
  message(`Classeur importé (modèle ${lu.disposition})${notes}. ${suiteDeLImport(cible, nom)}`, 'attente');
}

/** Un fichier choisi par « Importer » : une fiche JSON (premier caractère non blanc « { »), sinon un classeur. */
async function importer(fichier) {
  let octets;
  try {
    octets = new Uint8Array(await fichier.arrayBuffer());
  } catch {
    message('Ce fichier n’a pas pu être lu.', 'erreur');
    return;
  }
  const zip = octets[0] === 0x50 && octets[1] === 0x4b;
  const texte = zip ? '' : new TextDecoder('utf-8').decode(octets).replace(/^\uFEFF/, '');
  if (!zip && texte.trimStart().startsWith('{')) return importerJson(texte);
  return importerClasseur(octets, fichier.name);
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
    if (t.dataset.champ === 'metier_id') return changerDeMetier(t.value || null);   // bonus choisis et objets de départ suivent (décisions R33, R35)
    if (t instanceof HTMLInputElement && t.type === 'checkbox') fiche[t.dataset.champ] = t.checked ? 1 : 0;
    else if ('entier' in t.dataset) fiche[t.dataset.champ] = t.value === '' ? ('videNull' in t.dataset ? null : 0) : entier(t.value);
    else fiche[t.dataset.champ] = t.value === '' ? null : t.value;
    changer();
  });
  $('fiche-enregistrer').addEventListener('click', enregistrer);
  $('fiche-nouvelle').addEventListener('click', nouvelle);
  $('fiche-exporter').addEventListener('click', exporter);
  $('fiche-exporter-tableur').addEventListener('click', exporterTableur);
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
    if (ev.key === 'Enter' && ev.target instanceof HTMLInputElement && ev.target.type === 'range') {
      ev.preventDefault();
      ouvrirSaisie(ev.target);
    }
  });
  // clic droit sur un curseur : saisir le nombre à la main
  racine.addEventListener('contextmenu', (ev) => {
    if (!(ev.target instanceof HTMLInputElement) || ev.target.type !== 'range') return;
    ev.preventDefault();
    ouvrirSaisie(ev.target);
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
  // portrait : choisir une image ouvre le recadrage ; « Recadrer » rouvre l'image d'origine avec son cadrage
  const fichierPortrait = $('portrait-fichier');
  fichierPortrait.addEventListener('change', async () => {
    const f = fichierPortrait.files?.[0];
    fichierPortrait.value = '';
    if (!f) return;
    try {
      recadrerPortrait(await reduireImage(f));
    } catch {
      message('Cette image n’a pas pu être lue (ou reste trop lourde une fois réduite).', 'erreur');
    }
  });
  $('portrait-choisir').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      fichierPortrait.click();
    }
  });
  $('portrait-recadrer').addEventListener('click', () => fiche.portrait && recadrerPortrait(fiche.portrait, cadrageDuPortrait()));
  $('portrait-retirer').addEventListener('click', () => {
    Object.assign(fiche, { portrait: null, portrait_x: null, portrait_y: null, portrait_zoom: null });
    changer();
  });
  $('bi-classe').addEventListener('change', (ev) => {
    fiche.mode_classe = ev.target.checked ? 'bi' : 'mono';
    changer();
  });
  // le tiroir des choix : il se range quand la zone IV est à l'écran ; « Aller aux choix » y descend et ouvre l'onglet « Choix »
  new IntersectionObserver(([entree]) => {
    zoneParametresVisible = entree.isIntersecting;
    construireChoixEnAttente();
  }, { rootMargin: '0px 0px -15% 0px' }).observe(racine.querySelector('.parametres'));
  $('choix-aller').addEventListener('click', () => {
    $('onglet-choix').click();
    $('zone-parametres').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  $('choix-reduire').addEventListener('click', () => {
    tiroirReduit = !tiroirReduit;
    construireChoixEnAttente();
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
