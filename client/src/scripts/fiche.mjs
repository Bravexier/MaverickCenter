// Formulaire de la page /fiche/ (pages/fiche/index.astro) : construit les étapes à partir des règles de la base (/fiche/regles.json), garde la
// fiche en cours au format d'échange (lib/fiche-format.mjs), recalcule ce qui en découle à chaque saisie (lib/fiche-moteur.mjs) et l'enregistre
// auprès du service des personnages (/api/personnages/, docs/serveur.md). Création et modification sur le même écran : /fiche/?id=<id>.
// Export et import (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et exportée à tout moment depuis un Excel
// ou Google Sheet et réexportée sous le même modèle ») : le classeur au modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » (/fiche/modele.xlsx :
// lib/fiche-tableur-export.mjs remplit ses cases, lib/tableur-ecriture.mjs écrit le .xlsx, le portrait cadré à la place du logo). La barre (demandes du
// propriétaire, 2026-10-15) : « Télécharger » (le .xlsx, nommé d'après le personnage), « Exporter » (le même classeur, en nouvelle feuille Google Sheets
// du Drive de la personne : connexion par Google Identity Services, chargé à la demande ; lib/google-sheets.mjs), tous deux grisés tant que la fiche
// n'est pas enregistrée telle qu'elle est (etatDesBoutons) ; « Importer (PC) » (un .xlsx) et « Importer (en ligne) » (le lien d'une feuille partagée
// par lien, que le service télécharge : POST /api/classeur/) ; l'import lit aussi la fiche auto V15.2.2 (lib/tableur-lecture.mjs,
// lib/fiche-tableur-import.mjs : l'onglet qui suit l'un des deux modèles, « Personnage » d'abord), et ce qui n'a pas de place sur le site va dans les
// notes. Plus d'export ni d'import en JSON, plus de bouton « Imprimer » (Ctrl+P reste possible).
// Script de page (navigateur) : il n'importe que des modules purs que seule cette page utilise (la version portable refuse un module partagé), et le
// choix et le recadrage du portrait (src/scripts/portrait.mjs, lib/portrait.mjs), partagés avec le mode modification du bestiaire, absent de la version
// portable.
import { libelleDuControle } from '../lib/fiche-controles.mjs';
import { CHAMP_VERSION, COLONNES_DU_SERVICE, PARTIES_DE_FICHE, ajouterAuxNotes, ficheVide, nouveauxRetraits, resumeDesRetraits, sansPartiesRetirees } from '../lib/fiche-format.mjs';
import { RAISONS } from '../lib/degats-texte.mjs';
import { modesAuNm, valeurAuNm } from '../lib/sort-maitrise.mjs';
import { cadrageDe, empreinte, octetsDuPortrait } from '../lib/portrait.mjs';
import { cellulesDeLaFiche, etatDesExports, messageDExport, nomDuFichier } from '../lib/fiche-tableur-export.mjs';
import {
  ADRESSE_D_ENVOI, PORTEE_DRIVE, SCRIPT_GOOGLE, TYPE_XLSX, corpsMultipart, estUnZip, idDeFeuille, lienDeFeuille, nomDuClasseur,
} from '../lib/google-sheets.mjs';
import { feuilleDeLaFiche, ficheDuClasseur, messageDImport, portraitDeLImport } from '../lib/fiche-tableur-import.mjs';
import { ecrireXlsx, zonesDuClasseur } from '../lib/tableur-ecriture.mjs';
import { lireClasseur } from '../lib/tableur-lecture.mjs';
import { lireZip } from '../lib/zip.mjs';
import { dessinerVignette, ouvrirRecadrage, reduireImage } from './portrait.mjs';
import {
  actionsDeLEmplacement, actionsDesAccessoires, effetsDesAccessoires, EMPLACEMENTS_ACCESSOIRES, exemplairesParEmplacement, inventaireDe,
  mettreALaCeinture, objetChoisiDansLaListe, quantiteDuSac, rangerLEmplacement, remplirLEmplacement, suggestionsDeCeinture, utiliserLObjet, ajusterValeurDuMoment, alignementDe, armesApresChoix, armesApresReglage, armesValables, artisanatDe, attaqueADeuxArmes, attributsDe, bonusDuMetier, choixEnAttente, cleDeChoix, donDeBase, modeHyperDe, niveauDeSpecialite, borner, budgetCaracteristiques, budgetCompetences, caracteristiquesCompletes, caracteristiquesDe,
  choisirObjetDeMetier, choixDeMetierValables, classeImposee, classesDe, classesSelonLaMagieInnee, competencesDe, deDeLaFamille, donsAChoisir, donsAcquis, donsDeRace, donsValables,
  durabiliteAEcrire, durabiliteDArme, emplacementsDeSorts, ethnieCompatible, ethnieImposee, ethniesDeLaRace, famillesMaitrisables, inventaireSelonLeMetier, lignesDeSorts, magieAcquiseValable, notationDesDes,
  magiesInneesPermises, maitriseDArme, maitriseDesSorts, maitrisesValables, gainsDeNiveau, niveauGlobal, bornesDuNm, nmDuSort, npmMax, objetChoisi, objetsDuMetier, progressionXp,
  livreAuPlafond, sortAuNm, sortAvecLivre, sortPourUnLivre,
  quotaDeMaitrise, refusClasse, refusMagieAcquise, resistancesDe, sortsParNpm, trouver, ecrireValeurDuMoment, valeursDuMoment,
  armureApresChoix, partiesApresReglage, partiesDeLArmure, partiesValables,
  bouclierApresChoix, bouclierDe, catalogueDuSac, defenseDe, degatsRecus, effetDeCompetence, effetsDAccessoireProposes, PARTIE_PAR_DEFAUT, partiesDuCorps, valeurDeCompetenceBornee,
  propositionsDuCatalogue, soliditeDuBouclierAEcrire, typesDeDegats, valeurDEffetDAccessoire,
  acquisApresChoix, acquisApresRepartition, acquisChoixValables, acquisDesDons, entrainementDe, entrainementsAEnregistrer, batonDuSac, contexteDesSorts, degatsDArmeDuMoment, magiesDesBatons, nomDuBaton, postureDuMoment, sortDuMoment,
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
/**
 * Le service a refusé le dernier enregistrement de la fiche à l'écran (toute réponse non OK : version changée entre-temps 409, requête trop volumineuse
 * 413, fiche refusée 400…) : Télécharger et Exporter redeviennent actifs pour ne rien perdre (etatDesBoutons). Oublié quand une autre fiche est à
 * l'écran (appliquer : relue, enregistrée, rechargée ; nouvelle ; nouveau prétiré tiré d'un classeur).
 */
let enregistrementRefuse = false;
/** Un téléchargement, un export ou un import en ligne en cours : Télécharger et Exporter attendent (etatDesBoutons). */
let occupe = false;
const noms = new Map();
/** Fonctions qui alignent les champs et les états sur la fiche, par conteneur (remplacées quand le conteneur est reconstruit). */
const synchros = new Map();
let enConstruction = null;
/** Calculs du moteur, refaits une fois par rafraîchissement et lus par les synchronisations. */
let calcul = null;
/**
 * Monte quand l'inventaire est remplacé d'un bloc (objets de départ d'un métier, objet qui passe du sac à la ceinture ou en revient : décision R89) : son
 * tableau est alors reconstruit, même à nombre de lignes égal.
 */
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

/**
 * Pose un attribut (true : sans valeur ; null ou false : retiré) seulement s'il change : la fiche est rafraîchie à chaque frappe, et chaque écriture
 * réveille les observateurs de la page (components/Infobulles.astro).
 */
function attribut(e, nom, valeur) {
  if (valeur === null || valeur === undefined || valeur === false) {
    if (e.hasAttribute(nom)) e.removeAttribute(nom);
    return;
  }
  const texte = valeur === true ? '' : String(valeur);
  if (e.getAttribute(nom) !== texte) e.setAttribute(nom, texte);
}

/**
 * Rend le focus après une reconstruction quand `cible`, qui l'avait, ne sert plus (détachée, désactivée ou cachée) : au seul champ de saisie de même
 * sorte (son aria-label sans les numéros) qui montre le même texte (la ligne du sac sur laquelle on venait de cliquer, qu'un objet sorti du sac a fait
 * remonter) ; sinon, si `cible` était dans `bloc`, à `repli`. Jamais à un bouton (le refocaliser referait son action à la touche suivante), jamais à
 * un champ qui montre autre chose (la frappe suivante changerait un autre objet).
 */
function rendreLeFocus(cible, bloc, repli) {
  if (!cible || cible === document.body) return;
  const sert = (e) => e.isConnected && !e.disabled && !e.closest('[hidden]');
  if (sert(cible)) return;
  const sorte = (e) => (e.getAttribute('aria-label') ?? '').replace(/\d+/g, '#');
  const memes = cible.tagName === 'INPUT' && cible.value && sorte(cible)
    ? [...racine.querySelectorAll('input')].filter((e) => e !== cible && sert(e) && sorte(e) === sorte(cible) && e.value === cible.value) : [];
  if (memes.length === 1) {
    memes[0].focus();
    memes[0].setSelectionRange?.(memes[0].value.length, memes[0].value.length);
  } else if (bloc.contains(cible)) repli.focus();
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
  const { paliers, auChoix, desactivee } = resistancesDe(regles, fiche);
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
  // la ligne sous le tableau : les résistances au choix, et la magie que la Symbiose désactive (décision R111 : ses résistances et faiblesses ne
  // comptent pas tant qu'elle l'est)
  const choix = $('resistances-choix');
  const lignes = [
    auChoix.length ? `Résistance laissée au choix, à noter à la main : ${auChoix.join(', ')}.` : '',
    desactivee ? `Posture Symbiose : la magie ${desactivee.nom} est désactivée, ses résistances et faiblesses ne comptent pas.` : '',
  ].filter(Boolean);
  choix.hidden = lignes.length === 0;
  const texte = lignes.join(' ');
  if (choix.textContent !== texte) choix.textContent = texte;
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
          const l = ligne('competences', (x) => x.competence_id === comp.id, () => ({ competence_id: comp.id, naturel: 0 }));
          l[cle] = valeur;
          if (!l.naturel) retirer('competences', (x) => x.competence_id === comp.id);
          changer();
        };
        const naturel = el('input', {
          type: 'range', min: '0', step: '1', class: 'curseur', 'aria-label': `${comp.nom} : points naturels`,
          oninput: (ev) => ecrire('naturel', entier(ev.target.value)),
        });
        const valeurNaturel = el('output', { class: 'curseur__valeur' });
        // l'Acquis se calcule (décision R104 : « il faudrai d'ailleurs retirer le slider des aquis à cet endroit là, et n'afficher que le chiffre calculé
        // par tous les autres bonus. ») : la valeur, son détail en infobulle (focalisable)
        const valeurAcquis = el('output', { class: 'acquis-calcule', tabindex: '0' });
        const score = el('span', { class: 'score' });
        synchro(() => {
          const c = calcul.competences.find((x) => x.id === comp.id);
          naturel.max = String(c.maxNaturel);
          poser(naturel, c.naturel);
          valeurNaturel.textContent = String(c.naturel);
          valeurNaturel.toggleAttribute('data-hors', c.naturel > c.maxNaturel);
          naturel.title = `De 0 à ${c.maxNaturel} au niveau du personnage`;
          const texteAcquis = String(c.acquis);
          if (valeurAcquis.textContent !== texteAcquis) valeurAcquis.textContent = texteAcquis;
          // rogné au plafond (5 par point de caractéristique, R41 ; « le plafond prévaut », R38) : signalé
          valeurAcquis.toggleAttribute('data-rogne', c.acquisBrut > c.acquis);
          const part = (nom, compte, brut) => (brut ? `${signe(compte)} ${nom}${brut > compte ? ` (${brut}, rogné au plafond)` : ''}` : null);
          infobulle(valeurAcquis, [
            `Acquis : ${c.acquis} (au plus ${c.plafondAcquis} : 5 par point de caractéristique${c.plafondBonus ? `, +${c.plafondBonus} d’un don` : ''})`,
            part('d’entraînement', c.entrainement, c.entrainementBrut),
            ...c.donsDetail.map((d) => `+${d.valeur} ${d.nom}`), c.donsBrut > c.dons ? `(dons : ${c.donsBrut}, rognés à ${c.dons})` : null,
            part('du métier', c.metier, c.metierBrut),
            c.accessoireBrut ? `${signe(c.accessoire)} d’accessoire${c.accessoireBrut > c.accessoire ? ` (${c.accessoireBrut}, rogné au plafond)` : ''}` : null,
          ].filter(Boolean).join('\n'));
          // le score du moment : la posture prise y ajoute son bonus (décision R100 : « Neutre donne +5 % à toutes les compétences Social et Volonté »)
          score.textContent = c.score === null ? 'N/A' : `${c.scoreDuMoment} %`;   // « N/A » plutôt qu'« inutilisable » (demande du propriétaire)
          score.toggleAttribute('data-posture', c.score !== null && c.posture !== 0);
          score.dataset.sens = c.posture > 0 ? 'plus' : c.posture < 0 ? 'moins' : '';
          // le bonus au jet d'un don (décision R122 : « +5% à tout jet impliquant la Perception ») est dans le score, hors acquis : son détail, comme la posture
          const detail = [
            ...(c.jet ? [`${c.score - c.jet} % ${signe(c.jet)} au jet = ${c.score} %`, ...c.jetDetail.map((d) => `${signe(d.valeur)} ${d.nom} (bonus au jet, hors acquis)`)] : []),
            ...(c.posture ? [`${c.score} % ${signe(c.posture)} (posture ${calcul.posture.posture.nom})`] : []),
          ];
          infobulle(score, c.score === null ? 'Deux croix : compétence inutilisable' : detail.join('\n'));
        });
        return el('tr', {}, el('td', {}, comp.nom), el('td', { class: 'curseur-td' }, el('span', { class: 'curseur-cellule' }, naturel, valeurNaturel)),
          el('td', { class: 'nombre' }, valeurAcquis), el('td', { class: 'nombre' }, score));
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
      // les bonus d'artisanat des dons (décision R123 : « +10% à tous les tests d'artisanat », Elfe noir Sang purifié)
      const bonus = a.bonus.map((b) => ` + ${b.valeur} (${b.nom})`).join('');
      const resultat = a.inutilisable ? el('strong', {}, 'inutilisable (deux croix)') : a.score === null ? '' : el('strong', {}, `${a.score} %`);
      artisanat.replaceChildren(el('strong', {}, 'Artisanat '), a.texte, a.score === null && !a.inutilisable ? '' : ` : ${a.inutilisable ? '' : `${formule}${bonus} = `}`, resultat);
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
/** Pourquoi un bonus de sort n'est pas compté (sortDuMoment, lib/sort-bonus-texte.mjs). */
const RAISONS_DES_SORTS = {
  situation: 'selon la situation', progression: 'progression par niveau à préciser', posture: 'dans une autre posture', des: 'pas de dés écrits',
  non_chiffre: 'valeur écrite non chiffrée', sans_chakra: 'le sort ne consomme pas de chakra',
};

/**
 * Les sorts dont le livre, noté au plafond, a pris la place d'un NM compté (livreAuPlafond) : ce NM leur est rendu si le livre part ou change de sort,
 * tant que leur curseur n'a pas bougé (sortAvecLivre, `rendre`) ; une fiche relue ou rechargée a d'autres objets.
 */
const livresAuPlafond = new WeakSet();

/**
 * Tableau des sorts (demande du propriétaire) : une ligne par emplacement, chacune avec la liste des sorts possibles (magies du personnage, NPM
 * accessible) moins ceux des autres lignes (lignesDeSorts) ; vider la liste libère l'emplacement ; pas d'emplacement en plus (décision R27). Le NM d'un
 * sort se règle à un seul curseur, de 0 à 3 (décision R118 : plus de cases « livre » ni « MJ ») ; de 1 à 3 quand l'entraînement note un livre de ce
 * sort, dont le NM ne compte pas dans le décompte. Les NM du MJ sont ceux de la fiche, notés à côté de la limite des NM (champ nm_mj du gabarit).
 */
function construireSorts() {
  const emplacements = emplacementsDeSorts(regles, fiche);
  const nm = calcul.nm;
  const max = npmMax(regles, fiche);
  $('emplacements-detail').textContent = emplacements.total
    ? `${emplacements.total} emplacement${emplacements.total > 1 ? 's' : ''} (${emplacements.conditions} condition${emplacements.conditions > 1 ? 's' : ''} × puissance ${emplacements.puissance}), sorts jusqu’au NPM ${max}, ${nm.plafond} NM au plus par sort (dont ${Math.min(nm.plafond, nm.maxParSort)} de niveau).`
    : 'Pas encore d’emplacement de sort : choisissez une magie.';
  etatBudget($('budget-sorts'), (fiche.sorts ?? []).length, emplacements.total, 'Sorts', false);
  // le décompte des NM (décision R118) : ceux des sorts sans leurs livres, sur les NM gagnés par les niveaux plus ceux du MJ, notés juste à côté (la
  // limite affichée est celle des niveaux : « 9 / 11 + MJ 2 »)
  const badge = $('budget-nm');
  etatBudget(badge, nm.comptes, nm.limite, 'NM');
  badge.textContent = `NM : ${nm.comptes} / ${nm.disponibles}`;
  infobulle(badge, `NM répartis sur les sorts (sans ceux des livres${nm.livres ? ` : ${nm.livres} en plus` : ''}) / NM gagnés par les niveaux, plus ceux du MJ, `
    + `notés à côté pour toute la fiche${nm.mj ? ` (${nm.disponibles} + ${nm.mj} = ${nm.limite})` : ''} ; ${nm.plafond} NM au plus sur un sort`);

  const lignes = lignesDeSorts(regles, fiche);
  const cle = JSON.stringify([lignes.length, (fiche.sorts ?? []).map((x) => x.sort_id), fiche.magie_innee_id, fiche.magie_acquise_id, max]);
  reconstruire($('sorts'), cle, () => [
    el('thead', {}, el('tr', {}, el('th', { class: 'nombre' }, '#'), el('th', {}, 'Sort'),
      el('th', { title: 'Instant Cast (IC), imparable, inesquivable, au NM du sort ; en grisé : pas encore atteint' }, 'IC'),
      el('th', { title: 'Chakra, puis le coût secondaire (âmes, Sang…)' }, 'Coût'), el('th', {}, 'Portée'), el('th', {}, 'Zone'),
      el('th', { title: 'Dégâts, soins ou barrière' }, 'D/S/B'),
      el('th', { title: `NM du sort, ${nm.plafond} au plus ; à partir de 1 quand l’entraînement note un livre de ce sort, dont le NM ne compte pas dans le décompte` }, 'NM'))),
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
            else if (fiche.sorts[l.index]) fiche.sorts[l.index] = { ...fiche.sorts[l.index], sort_id: choix, niveau_maitrise: 0, nm_livre: 0 };
            else fiche.sorts.push({ sort_id: choix, rang: fiche.sorts.length + 1, niveau_maitrise: 0, nm_livre: 0 });
            changer();
          },
        }, el('option', { value: '', class: 'option-vide' }, l.enTrop ? '— retirer —' : l.choix.length ? '— libre —' : '— aucun sort possible —'),
        l.enTrop ? null : sortsParNpm(regles, l.choix).map((g) => el('optgroup', { label: `NPM ${g.npm}` }, g.sorts.map(optionDeSort))),
        l.enTrop || l.horsDesRegles ? el('optgroup', { label: l.enTrop ? 'Au-delà des emplacements' : 'Hors des magies ou du niveau' }, optionDeSort(l.sort)) : null);
        liste.setAttribute('aria-invalid', String(l.horsDesRegles || l.enTrop));
        // le NM du sort : un curseur de 0 à 3, de 1 à 3 avec un livre (décision R118 ; sortAuNm le borne)
        const curseur = el('input', { type: 'range', step: '1', class: 'curseur', 'aria-label': `NM du sort de l’emplacement ${l.index + 1}`, disabled: !l.ligne,
          oninput: (ev) => {
            const x = fiche.sorts[l.index];
            if (!x) return;
            Object.assign(x, sortAuNm(regles, x, ev.target.value));
            livresAuPlafond.delete(x);
            changer();
          } });
        const total = el('output', { class: 'curseur__valeur' });
        // le NM d'un livre se note dans l'entraînement (décision R104 : « déplacer la case [livre] du sort, sans changer le calcul ») : rappelé ici
        const livre = el('span', { class: 'nm-livre', tabindex: '0', title: 'Dont 1 NM d’un livre de sort (noté dans l’entraînement), qui ne compte pas dans le décompte' }, 'livre');
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
        const classe = [l.enTrop ? 'en-trop' : null, l.sort?.effets ? 'avec-effet' : null].filter(Boolean).join(' ') || null;
        const tr = el('tr', { class: classe },
          el('td', { class: 'nombre muted' }, String(l.index + 1)), el('td', {}, el('span', { class: 'sort-choix' }, liste, remarque)),
          modes, cout, portee, zone, dsb,
          el('td', { class: 'nm-sort' }, el('span', { class: 'curseur-cellule' }, curseur, total), livre));
        synchro(() => {
          const nm = nmDuSort(fiche.sorts[l.index]);
          const auNm = (brut, champ) => (l.sort ? valeurAuNm(brut, l.sort.bonus ?? [], champ, nm.total) ?? '' : '');
          // le sort à son moment (décision R102) : coût réduit (dons, bâton ; jamais moins de 1), portée et dégâts ou soins avec les bonus des dons, des
          // accessoires, du bâton, de l'armure élémentaire et de la posture ; chaque valeur changée en gras, son détail en infobulle
          const m = l.sort ? sortDuMoment(regles, fiche, l.sort, {
            cout: auNm(l.sort.cout, 'cout'), portee: auNm(l.sort.portee, 'portee'), dsb: auNm(l.sort.dsb, 'dsb'), effets: auNm(l.sort.effets, 'effets'),
          }, calcul.contexteSorts) : null;
          const detail = (base, lignes, fin = []) => [base, ...lignes.map((x) => (x.crans || x.des ? x.nom : x.maximum ? `${x.nom} (${x.valeur})` : `${x.nom} : ${signe(x.valeur)}`)), ...fin].join('\n');
          // en gras la valeur que le moment change ; en infobulle son détail, et ce qui n'est pas compté (la case prend alors le focus : l'infobulle se lit
          // aussi au clavier)
          const poserValeur = (td, texte, change, titre, aDire = change) => {
            if (td.textContent !== texte) td.textContent = texte;
            td.toggleAttribute('data-calcule', Boolean(change));
            infobulle(td, aDire ? titre : '');
            if (aDire) td.tabIndex = 0;
            else td.removeAttribute('tabindex');
          };
          const nonComptes = (colonne) => (m?.nonComptes ?? []).filter((x) => x.cible === colonne)
            .map((x) => `Non compté (${RAISONS_DES_SORTS[x.raison] ?? x.raison}) : ${x.nom} ${signe(x.valeur)}`);
          // un coût en pourcentage du chakra maximum : la valeur calculée (décision R106), son calcul en tête de l'infobulle
          const calcule = m?.cout.calcule;
          poserValeur(cout, m ? (m.cout.corruption ? `${m.cout.texte} (ou ${m.cout.corruption.valeur} corruption)` : m.cout.texte) : '',
            m && (calcule || m.cout.detail.length || m.cout.corruption?.detail.length > 1),
            m && detail(calcule ? `${calcule.pourcent} % du chakra maximum (${calcule.chakra}) : ${calcule.valeur}${(calcule.chakra * calcule.pourcent) % 100 ? ', arrondi à l\'inférieur' : ''}` : `Coût écrit : ${auNm(l.sort.cout, 'cout')}`,
              m.cout.detail, [
                'Jamais moins de 1',
                ...(m.cout.corruption ? [detail('Avec la corruption :', m.cout.corruption.detail, ['Jamais moins de 1'])] : []),
                ...nonComptes('cout'),
              ]), m && (calcule || m.cout.detail.length || m.cout.corruption || nonComptes('cout').length));
          // le second coût (âmes, Sang, « Par tour » : décisions R105, R106) sous le coût de chakra, dans la même case (poserValeur réécrit la case quand le
          // coût change)
          if (l.sort?.cout_secondaire) cout.append(el('span', { class: 'sort-cout-secondaire' }, l.sort.cout_secondaire));
          poserValeur(portee, m?.portee.texte ?? '', m && m.portee.detail.length,
            m && detail(`Portée écrite : ${auNm(l.sort.portee, 'portee')}`, m.portee.detail, nonComptes('portee')), m && (m.portee.detail.length || nonComptes('portee').length));
          zone.textContent = auNm(l.sort?.zone, 'zone');
          modes.replaceChildren(...(l.sort ? modesAuNm(l.sort.modes, l.sort.bonus ?? [], nm.total) : []).map((m) => el('span', {
            class: 'sort-mode', dataset: { mode: m.mode ?? 'autre', ...(m.atteint ? {} : { attente: '' }) },
            title: m.atteint ? null : `Pas encore : ${nm.total} NM sur ce sort`,
          }, m.texte)));
          const autres = nonComptes('dsb');
          const texteDsb = m ? `${m.dsb.texte}${m.dsb.diviseur > 1 ? ` ÷ ${m.dsb.diviseur}` : ''}` : '';
          poserValeur(dsb, texteDsb, m && (m.dsb.detail.length || m.dsb.diviseur > 1),
            m && detail(`Écrit : ${auNm(l.sort.dsb, 'dsb')}`, m.dsb.detail, [
              ...(m.dsb.diviseur > 1 ? [`Posture ${calcul.posture.posture.nom} : dégâts infligés ÷ ${m.dsb.diviseur}, avant l’armure`] : []),
              ...autres, ...m.rappels.map((r) => `${r.nom} : ${r.texte}`),
            ]), m && (m.dsb.detail.length || m.dsb.diviseur > 1 || autres.length || m.rappels.length));
          // la magie que la Symbiose désactive (« Une seule magie active ») : ses sorts grisés
          tr.toggleAttribute('data-inactif', Boolean(m?.inactif));
          infobulle(tr, m?.inactif ? `Posture Symbiose : la magie ${m.inactif} est désactivée` : l.enTrop ? 'Au-delà des emplacements du personnage : à retirer' : '');
          // les effets : ceux d'un sort de protection comptent les dégâts bloqués du bâton (« Bloque N dégâts »)
          const texteEffet = m ? m.effets.texte : auNm(l.sort?.effets, 'effets');
          if (effet.textContent !== texteEffet) effet.textContent = texteEffet;
          effet.toggleAttribute('data-calcule', Boolean(m?.effets.detail.length));
          infobulle(effet, m?.effets.detail.length ? detail(`Écrit : ${auNm(l.sort.effets, 'effets')}`, m.effets.detail) : '');
          const bornes = bornesDuNm(regles, fiche.sorts[l.index]);
          curseur.min = String(bornes.min);
          curseur.max = String(bornes.max);
          poser(curseur, nm.total);
          livre.hidden = !nm.livre;
          // sur un sort : au plus 3 NM, et au plus niveau − 1 comptés, plus les NM du MJ (règles sort_nm_plafond et sort_nm_max de la base)
          const tropCompte = nm.comptes > calcul.nm.maxCompteParSort;
          curseur.setAttribute('aria-invalid', String(nm.total > calcul.nm.plafond || tropCompte));
          infobulle(curseur, [
            `${nm.total} NM sur ce sort${nm.livre ? `, dont 1 de livre : ${nm.comptes} compté${nm.comptes > 1 ? 's' : ''} dans le décompte` : ''} ; ${calcul.nm.plafond} au plus`,
            ...(tropCompte ? [`Au plus ${calcul.nm.maxParSort} NM de niveau sur un sort (niveau − 1)${calcul.nm.mj ? `, plus les ${calcul.nm.mj} du MJ` : ''}`] : []),
          ].join('\n'));
          total.textContent = String(nm.total);
          total.toggleAttribute('data-hors', nm.total > calcul.nm.plafond);
        });
        return [
          tr,
          // l'effet secondaire du sort, sur sa propre ligne (demande du propriétaire)
          l.sort?.effets ? el('tr', { class: `sort-effet${l.enTrop ? ' en-trop' : ''}` }, el('td', {}), el('td', { colspan: '7' }, effet)) : null,
        ];
      })),
  ]);
}

// ------------------------------------------------------------------ entraînement (décision R104)
/**
 * L'entraînement (demande du propriétaire : « Il faudrai remplacer le texte des "Entraînement" par des lignes qu'on peut ajouter (+) et remplir soit par
 * "entrainement compétence : une compétence donnée avec un slider de 0 à 10, qui s'ajoute aux Aquis. […] Soit par un livre de compétence et lister le
 * sort associé (et du coup déplacer la case [livre] du sort, sans changer le calcul. Soit un texte libre pour les "dons évènementiels". ») : une ligne
 * par compétence entraînée (curseur de 0 à entrainement.bonus_max_pct), par livre lu (le NM de livre d'un sort, personnage_sort.nm_livre) et par texte ;
 * trois boutons en ajoutent.
 */
function construireEntrainement() {
  const e = entrainementDe(regles, fiche);
  const livres = (fiche.sorts ?? []).map((x, i) => ({ x, i })).filter(({ x }) => entier(x.nm_livre) > 0);
  // (versionInventaire : une fiche relue ou rechargée a d'autres objets, auxquels chaque ligne doit se lier de nouveau)
  const cle = JSON.stringify([versionInventaire, e.lignes.map((l) => [l.rang, l.competence_id === null ? 't' : 'c']), livres.map(({ x }) => x.sort_id), (fiche.sorts ?? []).map((x) => x.sort_id)]);
  const nomDuSort = (id) => trouver(regles.sorts, id)?.nom ?? id;
  // noter le livre d'un sort lui donne son NM (au plus 3), le retirer le lui reprend, sauf le NM compté qu'il avait pris au plafond (sortAvecLivre,
  // décision R118) : déplacer un livre d'un sort à l'autre ne fait perdre aucun NM
  const poserLivre = (index, oui) => {
    const x = fiche.sorts[index];
    if (!x) return;
    if (oui && livreAuPlafond(regles, x)) livresAuPlafond.add(x);
    Object.assign(x, sortAvecLivre(regles, x, oui, { rendre: !oui && livresAuPlafond.delete(x) }));
  };
  reconstruire($('entrainement'), cle, () => [
    ...e.lignes.map((l, i) => {
      const n = i + 1;
      const retirer_ = el('button', { type: 'button', class: 'retirer', 'aria-label': `Retirer la ligne ${n} de l’entraînement`,
        onclick: () => { fiche.entrainements = (fiche.entrainements ?? []).filter((y) => y !== l); changer(); } }, '✕');
      if (l.competence_id === null) {
        const texte = el('input', { 'aria-label': `Entraînement, ligne ${n} : texte libre (don évènementiel)`, placeholder: 'Don évènementiel, ce que le MJ accorde…',
          oninput: (ev) => { l.texte = ev.target.value; changer(); } });
        synchro(() => { if (document.activeElement !== texte) poser(texte, l.texte ?? ''); });
        return el('li', { class: 'entrainement__ligne entrainement__ligne--texte' }, el('span', { class: 'entrainement__type' }, 'Texte'), texte, retirer_);
      }
      const competence = el('select', { 'aria-label': `Entraînement, ligne ${n} : compétence`, onchange: (ev) => { l.competence_id = ev.target.value; changer(); } },
        regles.caracteristiques.map((k) => el('optgroup', { label: k.nom }, regles.competences.filter((c) => c.caracteristique_id === k.id).map((c) => option(c.id, c.nom)))));
      const curseur = el('input', { type: 'range', min: '0', max: String(e.valeurMax), step: '1', class: 'curseur', 'aria-label': `Entraînement, ligne ${n} : points`,
        oninput: (ev) => { l.valeur = entier(ev.target.value); changer(); } });
      const valeur = el('output', { class: 'curseur__valeur' });
      synchro(() => {
        poser(competence, l.competence_id);
        poser(curseur, l.valeur);
        valeur.textContent = `+${entier(l.valeur)}`;
        // deux lignes de la même compétence : signalées (personnage_entrainement n'en garde qu'une)
        competence.setAttribute('aria-invalid', String((fiche.entrainements ?? []).filter((y) => y.competence_id === l.competence_id).length > 1));
      });
      return el('li', { class: 'entrainement__ligne' }, el('span', { class: 'entrainement__type' }, 'Compétence'), competence,
        el('span', { class: 'curseur-cellule' }, curseur, valeur), retirer_);
    }),
    // les livres de sort : le NM de livre du sort (« sans changer le calcul »), choisi parmi les sorts de la fiche
    ...livres.map(({ x, i }) => {
      const sort = el('select', { 'aria-label': `Livre de sort : le sort (${nomDuSort(x.sort_id)})`,
        onchange: (ev) => {
          const j = fiche.sorts.findIndex((y) => y.sort_id === ev.target.value);
          if (j < 0 || j === i) return;
          poserLivre(i, false);
          poserLivre(j, true);
          changer();
        } },
      (fiche.sorts ?? []).filter((y, j) => j === i || !entier(y.nm_livre)).map((y) => option(y.sort_id, nomDuSort(y.sort_id), y.sort_id === x.sort_id)));
      const retirer_ = el('button', { type: 'button', class: 'retirer', 'aria-label': `Retirer le livre de ${nomDuSort(x.sort_id)}`,
        onclick: () => { poserLivre(i, false); changer(); } }, '✕');
      return el('li', { class: 'entrainement__ligne entrainement__ligne--livre' }, el('span', { class: 'entrainement__type' }, 'Livre'), sort, retirer_);
    }),
  ]);
  // les ajouts : une compétence (la première qui n'est pas encore entraînée), un livre (le premier sort sans livre sous le plafond : sortPourUnLivre),
  // un texte ; ce qui est libre se relit au clic (les boutons ne sont refaits que quand l'un d'eux se grise ou se dégrise)
  const ajouts = $('entrainement-ajouts');
  const libre = () => regles.competences.find((c) => !entrainementDe(regles, fiche).parCompetence.has(c.id)) ?? null;
  const sansLivre = () => sortPourUnLivre(regles, fiche.sorts);
  const cleAjouts = JSON.stringify([e.competences >= e.max || !libre(), sansLivre() < 0]);
  reconstruire(ajouts, cleAjouts, () => {
    const ajouter = (ligne) => {
      const rang = Math.max(0, ...(fiche.entrainements ?? []).map((y) => entier(y.rang))) + 1;
      fiche.entrainements = [...(fiche.entrainements ?? []), { rang, ...ligne }];
      changer();
    };
    const plein = e.competences >= e.max || !libre();
    return [
      el('button', { type: 'button', class: 'ajouter', disabled: plein,
        title: e.competences >= e.max ? `${e.max} compétences au plus (« Vous ne pouvez monter que 15 compétences maximum »)` : null,
        onclick: () => { const k = libre(); if (k) ajouter({ competence_id: k.id, valeur: 0, texte: null }); } }, '+ Compétence'),
      el('button', { type: 'button', class: 'ajouter', disabled: sansLivre() < 0, title: sansLivre() < 0 ? 'Chaque sort de la fiche a déjà son livre' : null,
        onclick: () => { const j = sansLivre(); if (j >= 0) { poserLivre(j, true); changer(); } } }, '+ Livre de sort'),
      el('button', { type: 'button', class: 'ajouter', onclick: () => ajouter({ competence_id: null, valeur: null, texte: '' }) }, '+ Texte'),
    ];
  });
}

/**
 * Les bonus d'acquis « X ou Y » des dons débloqués (décision R104 : « un texte à choix devient un choix du tiroir ») : une liste par choix, la
 * compétence retenue (personnage_acquis_choix) ; « pour les compétences d'arme » (R120) : une des quatre ; « choisir 2 sur les 3 » (R121) : une liste par
 * compétence, chacune sans celles que les autres ont prises ; « à répartir au choix » : les compétences et leurs points ; un choix à faire est surligné et
 * dans le tiroir des choix.
 */
/** Pourquoi un bonus d'acquis écrit dans un don ou l'armure n'est pas compté (lib/acquis-texte.mjs, décision R104 ; questions de docs/sql/a-valider.md). */
const RAISONS_DE_L_ACQUIS = {
  situation: 'selon la situation (à compter au moment du jet)',
  arme_choisie: '« l’arme choisie » : laquelle ? (question Q22)',
  mj: 'à voir avec le MJ (décision R123 : un cas très particulier de la Ruse)',
  sans_artisanat: 'sans métier, pas de compétence d’artisanat (décision R123)',
  inconnue: 'aucune compétence nommée (question Q27)',
  element: 'l’armure transformée par un élément perd ses bonus d’origine (décision R99)',
};

function construireAcquisAChoisir() {
  const { choix, nonComptes } = acquisDesDons(regles, fiche);
  $('acquis-choix-bloc').hidden = !choix.length;
  // les bonus que la fiche ne compte pas, chacun avec sa raison (le texte du don, lu, en infobulle)
  $('acquis-non-comptes-bloc').hidden = !nonComptes.length;
  reconstruire($('acquis-non-comptes'), JSON.stringify(nonComptes), () => nonComptes.map((x) => el('li', { title: x.texte ?? null },
    `${x.nom} : ${x.valeur ? `${x.valeur} % — ` : ''}${RAISONS_DE_L_ACQUIS[x.raison] ?? x.raison}`)));
  const listeDesCompetences = (attributs, exclues = new Set()) => el('select', attributs, option('', 'Choisir…'),
    regles.caracteristiques.map((k) => el('optgroup', { label: k.nom },
      regles.competences.filter((c) => c.caracteristique_id === k.id && !exclues.has(c.id)).map((c) => option(c.id, c.nom)))));
  const cle = JSON.stringify(choix.map((c) => [c.source, c.rang, c.options ?? c.parts.map((x) => x.competence_id)]));
  reconstruire($('acquis-choix'), cle, () => choix.map((c) => {
    const li = el('li', { class: 'fiche-champ acquis-choix__ligne', dataset: { choixCle: cleDeChoix.acquis(c.source, c.rang) } });
    if (!c.repartition) {
      const groupe = c.sur ? ` (choix ${c.numero} sur ${c.sur})` : '';
      const liste = el('select', {
        'aria-label': `${c.nom} : +${c.valeur} % à choisir${groupe}`,
        onchange: (ev) => { Object.assign(fiche, acquisApresChoix(fiche, c.source, c.rang, ev.target.value || null)); changer(); },
      }, option('', 'Choisir…'), c.options.map((o) => option(o, trouver(regles.competences, o)?.nom ?? o)));
      li.append(el('span', {}, `${c.nom} : +${c.valeur} %${groupe}`), liste);
      synchro(() => {
        const fait = acquisDesDons(regles, fiche).choix.find((x) => x.source === c.source && x.rang === c.rang);
        // deux compétences différentes (décision R121) : celles que les autres choix du groupe ont prises sont grisées
        for (const o of liste.options) o.disabled = Boolean(o.value) && (fait?.exclues ?? []).includes(o.value);
        poser(liste, fait?.choisi ?? '');
        li.toggleAttribute('data-a-choisir', !fait?.fait);
      });
      return li;
    }
    // « 10% de compétence en acquis à répartir au choix » : une ligne par compétence et ses points, autant de lignes que le joueur veut, la somme au plus le
    // bonus ; « + Compétence » tant qu'il reste des points
    const actuelle = () => acquisDesDons(regles, fiche).choix.find((x) => x.source === c.source && x.rang === c.rang) ?? c;
    const repartir = (parts) => { Object.assign(fiche, acquisApresRepartition(fiche, c.source, c.rang, parts)); changer(); };
    // (ni le reste ni les parts ne sont des « span » : la marque « à choisir » ne suit que le titre)
    const reste = el('small', { class: 'acquis-choix__reste', 'aria-live': 'polite' });
    const parts = c.parts.map((x, i) => {
      const autres = new Set(c.parts.filter((_, j) => j !== i).map((y) => y.competence_id));
      const competence = listeDesCompetences({
        'aria-label': `${c.nom} : compétence ${i + 1}`,
        onchange: (ev) => repartir(actuelle().parts.map((y, j) => (j === i ? { ...y, competence_id: ev.target.value } : y))),
      }, autres);
      const points = el('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', class: 'acquis-choix__points', 'aria-label': `${c.nom} : points de la compétence ${i + 1}`,
        onchange: (ev) => repartir(actuelle().parts.map((y, j) => (j === i ? { ...y, valeur: borner(ev.target.value, 1, y.valeur + actuelle().reste) ?? y.valeur } : y))) });
      const retirer_ = el('button', { type: 'button', class: 'retirer', 'aria-label': `${c.nom} : retirer la compétence ${i + 1}`,
        onclick: () => repartir(actuelle().parts.filter((_, j) => j !== i)) }, '✕');
      synchro(() => {
        const part = actuelle().parts[i];
        if (!part) return;
        poser(competence, part.competence_id);
        if (document.activeElement !== points) poser(points, part.valeur);
        points.max = String(part.valeur + actuelle().reste);
      });
      return el('div', { class: 'acquis-choix__part' }, competence, points, retirer_);
    });
    const ajouter_ = el('button', { type: 'button', class: 'ajouter', 'aria-label': `${c.nom} : ajouter une compétence à la répartition`, onclick: () => {
      const a = actuelle();
      const libre = regles.competences.find((k) => !a.parts.some((y) => y.competence_id === k.id));
      if (libre && a.reste > 0) repartir([...a.parts, { competence_id: libre.id, valeur: a.reste }]);
    } }, '+ Compétence');
    synchro(() => {
      const a = actuelle();
      reste.textContent = a.reste ? `${a.reste} % à répartir` : 'tout est réparti';
      ajouter_.disabled = a.reste <= 0;
      li.toggleAttribute('data-a-choisir', !a.fait);
    });
    li.append(el('span', {}, `${c.nom} : ${c.valeur} % à répartir au choix`), reste, ...parts, ajouter_);
    return li;
  }));
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
    // la posture du moment y ajoute le sien (décision R100 : Vigilance « +2 initiative »)
    ...(() => {
      const bonus = a.initiativeBonus + a.initiativePosture;
      const ecrit = a.initiative || a.initiativeMetier || a.initiativeAccessoires || a.initiativePosture;
      return [['Initiative', ecrit ? `1D20 ${bonus >= 0 ? '+' : '−'} ${Math.abs(bonus)}` : '1D20',
        [a.initiative?.note ?? 'Selon l’Agilité', a.initiativeMetier ? `${signe(a.initiativeMetier)} du métier` : null,
          a.initiativeAccessoires ? `${signe(a.initiativeAccessoires)} des accessoires` : null,
          a.initiativePosture ? `${signe(a.initiativePosture)} de la posture ${calcul.posture.posture.nom}` : null].filter(Boolean).join(' · ')]];
    })(),
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
  }).concat((() => {
    // la magie de la Symbiose (décision R100 : « Quand vous avez 2 magies, 1 de ces magies doit être désactivée temporairement ») : choisie ici quand le
    // personnage en a deux ; ses sorts reçoivent le bonus de la posture, l'autre magie est désactivée
    const choix = el('select', { 'aria-label': 'Magie de la symbiose', onchange: (ev) => { fiche.symbiose_magie_id = ev.target.value || null; changer(); } });
    const bloc = el('label', { class: 'fiche-champ posture-symbiose', hidden: true, dataset: { choixCle: 'symbiose' } }, el('span', {}, 'Symbiose avec'), choix);
    synchro(() => {
      const s = calcul.posture?.symbiose;
      bloc.hidden = !s || s.possibles.length < 2;
      if (bloc.hidden) return;
      const cle = s.possibles.map((m) => m.id).join();
      if (choix.dataset.cle !== cle) {
        choix.replaceChildren(option('', 'Choisir…'), ...s.possibles.map((m) => option(m.id, m.nom)));
        choix.dataset.cle = cle;
      }
      poser(choix, s.magie?.id ?? '');
      bloc.toggleAttribute('data-a-choisir', s.aChoisir);
    });
    return [bloc];
  })()));
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
  // une saisie (un nombre, un texte) se relaie à son changement, comme une liste ; un bouton ou une case, à son clic
  const saisie = (x) => x instanceof HTMLSelectElement || (x instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(x.type));
  bulle.addEventListener('click', (ev) => {
    const champ = ev.target instanceof Element ? ev.target.closest('button, input') : null;
    if (saisie(champ)) return;
    const cible = champ && original(champ);
    if (!cible) return;
    ev.preventDefault();
    cible.click();
  });
  bulle.addEventListener('change', (ev) => {
    const cible = saisie(ev.target) ? original(ev.target) : null;
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
/** « 5 », « 5 et 10 », « 5, 10 et 15 ». */
const enListe = (mots) => (mots.length > 1 ? `${mots.slice(0, -1).join(', ')} et ${mots.at(-1)}` : mots.join(''));

/**
 * D'où vient le total à saisir des gains de niveau (gainsDeNiveau : tout est lu dans les règles) : les points d'attributs par niveau, à répartir entre la
 * santé et le chakra, et les dés bonus atteints, avec leur texte (niveau_global.de_attributs_bonus), leurs niveaux et ce que chacun ajoute au total.
 */
function aideDesGains(g) {
  const repartir = 'à répartir entre la santé (case rouge) et le chakra (case bleue)';
  const points = g.parNiveau !== null && g.depuis !== null
    ? `${g.parNiveau} points d’attributs par niveau à partir du ${g.depuis}, ${repartir}`
    : `Les points d’attributs des niveaux atteints, ${repartir}`;
  const parTexte = new Map();
  for (const d of g.des) {
    const cle = JSON.stringify([d.texte, d.min, d.max]);
    if (!parTexte.has(cle)) parTexte.set(cle, { ...d, niveaux: [] });
    parTexte.get(cle).niveaux.push(d.niveau);
  }
  const des = [...parTexte.values()].map((d) => {
    const plusieurs = d.niveaux.length > 1;
    const ajoute = d.min === d.max ? `${d.min}` : `de ${d.min} à ${d.max}`;
    return ` Dé bonus au${plusieurs ? 'x' : ''} niveau${plusieurs ? 'x' : ''} ${enListe(d.niveaux.map(String))}${d.texte ? ` (${d.texte})` : ''} : ${plusieurs ? 'chacun ajoute' : 'il ajoute'} ${ajoute} au total.`;
  });
  return `${points} : ${g.points ? `${g.points} au niveau ${g.niveau}` : `rien à saisir au niveau ${g.niveau}`}.${des.join('')}`;
}

/**
 * Gains de niveau (décision R73) : deux champs du gabarit (data-champ gains_sante, gains_chakra : la liaison générique les borne à 0, jamais vides), et
 * à côté le total attribué et le total à saisir — sa plage quand un dé bonus est atteint —, en rouge hors de la plage (gainsDeNiveau : les mêmes bornes
 * que la règle gains_niveau de la base, qui le signale à l'enregistrement). Visible dès le niveau 1 (rien à saisir) ; jamais dans les choix à faire.
 */
function construireProgression() {
  const g = gainsDeNiveau(regles, fiche);
  const aSaisir = g.max > g.min ? `entre ${g.min} et ${g.max}` : String(g.min);
  const total = $('gains-total');
  total.textContent = `Total attribué : ${g.total} / à saisir : ${aSaisir}`;
  total.toggleAttribute('data-hors', g.hors);
  total.title = g.hors ? `Hors du total à saisir au niveau ${g.niveau} : santé ${g.sante} + chakra ${g.chakra} = ${g.total}` : '';
  $('progression-aide').textContent = aideDesGains(g);

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
  cran_des_sorts: 'Cran des dés de dégâts des sorts', de_maximum: 'Dé de dégâts au maximum', des_soins: 'Dés de soin des sorts',
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


let numeroDeListe = 0;
/**
 * Le réglage d'un bâton magique d'une ligne du sac (décision R101 : « configurer correctement un "bâton magique" avec la magie et le niveau de ce dernier
 * avant de pouvoir l'assigner à un emplacement de ceinture ») : la magie, puis le niveau ; les deux choisis, `choisir` reçoit le nom du bâton ; la magie
 * vidée, la ligne redevient le bâton à régler. Caché pour un autre objet. La magie choisie sans niveau attend dans la page (elle n'est pas un nom
 * d'objet). `emplacement` : le numéro de la ligne du sac, dans le nom des listes. { element, maj }.
 */
function reglageDuBaton(ligne, emplacement, choisir) {
  const magies = magiesDesBatons(regles);
  const magie = el('select', { 'aria-label': `Sac, emplacement ${emplacement} : magie du bâton` }, option('', 'Magie…'), magies.map((m) => option(m.id, m.nom)));
  const niveau = el('select', { 'aria-label': `Sac, emplacement ${emplacement} : niveau du bâton` }, option('', 'Niveau…'));
  const element = el('span', { class: 'baton-reglage', hidden: true }, magie, niveau);
  const niveauxDe = (id) => magies.find((m) => m.id === id)?.niveaux ?? [];
  const remplirNiveaux = (id, choisi) => {
    niveau.replaceChildren(option('', 'Niveau…'), ...niveauxDe(id).map((n) => option(String(n), `Niveau ${n}`)));
    niveau.value = choisi ? String(choisi) : '';
    niveau.disabled = !id;
    niveau.dataset.pour = `${id ?? ''}:${choisi ?? ''}`;
  };
  magie.addEventListener('change', () => {
    magiesEnAttente.set(ligne, magie.value || null);
    if (!magie.value) {
      // la magie vidée : la ligne redevient le bâton à régler
      if (batonDuSac(regles, ligne.nom)?.regle) choisir(regles.ceinture.baton_a_regler);
      remplirNiveaux(null, null);
      return;
    }
    const n = nomDuBaton(regles, magie.value, niveau.value);
    if (n) choisir(n);
    else remplirNiveaux(magie.value, null);
  });
  niveau.addEventListener('change', () => {
    const n = nomDuBaton(regles, magie.value, niveau.value);
    if (n) choisir(n);
  });
  const maj = () => {
    const b = batonDuSac(regles, ligne.nom);
    element.hidden = !b;
    if (!b) return;
    const magieId = b.baton?.magie_id ?? magiesEnAttente.get(ligne) ?? '';
    if (magie.value !== magieId) magie.value = magieId;
    if (niveau.dataset.pour !== `${magieId}:${b.baton?.niveau ?? ''}`) remplirNiveaux(magieId || null, b.baton?.niveau ?? null);
    element.toggleAttribute('data-a-choisir', !b.regle);
    infobulle(element, b.regle ? b.baton.effets.map((e) => e.texte).join('\n') : 'À régler avant la ceinture : sa magie et son niveau');
  };
  return { element, maj };
}
/** Les magies choisies d'un bâton à régler qui attend son niveau, par ligne du sac. */
const magiesEnAttente = new WeakMap();

/**
 * Une saisie et sa liste de propositions qui se filtre à la frappe (demande du propriétaire du 2026-10-17 : « un véritable autocomplete (menu déroulant
 * qui se filtre sur la saisie actuelle et qui ne commence qu'à partir de 2 caractères saisis) ») : une liste déroulante ARIA (combobox : aria-expanded,
 * aria-activedescendant), ↑ ↓ pour la parcourir, Entrée pour choisir, Échap pour la fermer ; un clic (ou un appui) choisit ; la saisie libre reste
 * possible. `propositions(valeur)` rend les noms à montrer (propositionsDuCatalogue : rien sous deux caractères) ; `choisir(nom)` reçoit le nom choisi.
 * Rend l'enveloppe (le champ et sa liste).
 */
function autocompletion(champ, propositions, choisir) {
  const idListe = `propositions-${++numeroDeListe}`;
  const liste = el('ul', { class: 'autocompletion__liste', role: 'listbox', id: idListe, hidden: true, 'aria-label': 'Propositions' });
  Object.entries({ role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': idListe, autocomplete: 'off' })
    .forEach(([k, v]) => champ.setAttribute(k, v));
  let noms = [];
  let actif = -1;
  let appui = null;
  const fermer = () => {
    liste.hidden = true;
    champ.setAttribute('aria-expanded', 'false');
    champ.removeAttribute('aria-activedescendant');
    actif = -1;
  };
  const surligner = (i) => {
    actif = i;
    [...liste.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    const li = liste.children[i];
    if (li) {
      champ.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    }
  };
  const prendre = (i) => {
    const n = noms[i];
    fermer();
    if (n !== undefined) choisir(n);
  };
  const montrer = () => {
    noms = propositions(champ.value);
    // rien à proposer, ou le seul nom proposé est déjà écrit : la liste se ferme
    if (!noms.length || (noms.length === 1 && noms[0] === champ.value)) return fermer();
    liste.replaceChildren(...noms.map((n, i) => el('li', {
      id: `${idListe}-${i}`, role: 'option', 'aria-selected': 'false',
      // pointerdown : le champ garde le focus (pas de blur qui fermerait la liste avant le choix) ; le choix au relâcher sur la même ligne, sans
      // déplacement : au toucher, le doigt qui fait défiler la liste ne choisit rien (le défilement annule le pointeur : pointercancel)
      onpointerdown: (ev) => { ev.preventDefault(); appui = { i, x: ev.clientX, y: ev.clientY }; },
      onpointerup: (ev) => {
        const a = appui;
        appui = null;
        if (a?.i === i && Math.hypot(ev.clientX - a.x, ev.clientY - a.y) < 10) prendre(i);
      },
      onpointercancel: () => { appui = null; },
      // un clic sans pointeur (lecteur d'écran, clavier) choisit aussi
      onclick: (ev) => { if (ev.detail === 0) prendre(i); },
    }, n)));
    liste.hidden = false;
    champ.setAttribute('aria-expanded', 'true');
    actif = -1;
  };
  champ.addEventListener('input', (ev) => { if (!ev.isComposing) montrer(); });
  champ.addEventListener('keydown', (ev) => {
    if (liste.hidden) {
      if (ev.key === 'ArrowDown') { montrer(); if (!liste.hidden) ev.preventDefault(); }
      return;
    }
    if (ev.key === 'ArrowDown') surligner((actif + 1) % noms.length);
    else if (ev.key === 'ArrowUp') surligner(actif <= 0 ? noms.length - 1 : actif - 1);
    else if (ev.key === 'Enter' && actif >= 0) prendre(actif);
    else if (ev.key === 'Escape') fermer();
    else return;
    ev.preventDefault();
  });
  champ.addEventListener('blur', fermer);
  return el('span', { class: 'autocompletion' }, champ, liste);
}

function construireEquipement() {
  reconstruire($('armes'), 'fixe', () => [1, 2].map((rang) => {
    const l = () => ligneDe('armes', (x) => x.rang === rang);
    // une arme choisie sans matériau prend le fer (armesApresChoix, décision R49) ; une autre arme est neuve, une autre composition ou amélioration ramène
    // la solidité du moment sous son nouveau maximum (armesApresReglage, décision R74)
    const poserChamp = (cle) => (v) => {
      if (cle === 'arme_id') fiche.armes = armesApresChoix(regles, fiche, rang, v);
      else if (l()) fiche.armes = armesApresReglage(regles, fiche, rang, cle, v);
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
    // la solidité du moment (décision R74 : « Un slider qui va de 0 au max de l'arme. A zéro, l'arme est cassée ») : un curseur de 0 au maximum de l'arme
    // forgée (durabiliteDArme : arme, composition, amélioration, au moins 1), « N / M » à côté ; clic droit ou Entrée : saisir le nombre. Caché pour une
    // arme sans solidité (arme de monstre). Le maximum ou plus s'enregistre « à son maximum » (durabiliteAEcrire)
    const solidite = el('input', {
      type: 'range', min: '0', step: '1', class: 'curseur', 'aria-label': `Arme ${rang} : solidité`,
      oninput: (ev) => {
        const x = l();
        if (!x) return;
        x.durabilite = durabiliteAEcrire(regles, x, ev.target.value);
        changer();
      },
    });
    const soliditeValeur = el('output', { class: 'curseur__valeur' });
    const soliditeLigne = el('div', { class: 'objet__solidite' }, el('span', { class: 'objet__solidite-nom' }, 'Solidité'), solidite, soliditeValeur);
    synchro(() => {
      const x = l();
      poser(effet, x?.effet_en_plus ?? '');
      for (const d of [effet, ...details]) d.disabled = !x;
      const dur = durabiliteDArme(regles, fiche, rang);
      soliditeLigne.hidden = !dur;
      soliditeLigne.toggleAttribute('data-cassee', Boolean(dur?.cassee));
      if (dur) {
        solidite.max = String(dur.max);
        poser(solidite, dur.actuelle);
        soliditeValeur.textContent = `${dur.actuelle} / ${dur.max}`;
        soliditeLigne.title = [
          `Solidité : ${dur.actuelle} / ${dur.max} cran${dur.max > 1 ? 's' : ''}${dur.cassee ? ' : l’arme est cassée' : ''}`,
          ...dur.detail.map((c, i) => (i ? `${c.nom} ${signe(c.valeur)}` : `${c.nom} : ${c.valeur}`)),
          ...(dur.plancher ? [`Jamais moins de ${dur.max} cran`] : []),
          'À 0, l’arme est cassée. Clic droit ou Entrée sur le curseur : saisir le nombre.',
        ].join('\n');
      }
      // les dégâts du moment (décisions R100, R102) : la posture (Offensif : le maximum ; Défensif : ÷ 2 ; Symbiose : arme inutilisable) et un dé au maximum
      const d = degatsDArmeDuMoment(regles, fiche, rang);
      des.hidden = !d;
      // une arme cassée : la pastille de ses dés grisée, « Cassée » (décision R74) ; ses dégâts, réparée, restent en infobulle ; de même en Symbiose
      des.toggleAttribute('data-cassee', Boolean(d && (dur?.cassee || d.inutilisable)));
      if (d) {
        const valeur = d.diviseur > 1 ? `(${d.texte}) ÷ ${d.diviseur}` : d.texte;
        des.textContent = dur?.cassee ? 'Cassée' : d.inutilisable ? d.inutilisable : valeur;
        des.title = [
          ...(dur?.cassee ? [`Arme cassée (solidité 0 / ${dur.max}). Réparée : ${valeur}`] : []),
          ...(d.inutilisable ? [`Posture ${d.inutilisable} : « Impossible d’utiliser les armes ou objets ». Hors de cette posture : ${valeur}`] : []),
          `${d.notation} : ${d.nombre} dé${d.nombre > 1 ? 's' : ''} (maîtrise) de ${d.de ?? '—'}`,
          ...d.bonus.map((b) => `+${b.valeur} ${b.nom}`),
          ...d.moment.map((b) => `${b.nom} : ${b.valeur}`),
          ...(d.diviseur > 1 ? [`Posture ${calcul.posture.posture.nom} : dégâts infligés ÷ ${d.diviseur}, avant l’armure`] : []),
          ...(d.porteeEnPlus ? [`Portée ${signe(d.porteeEnPlus)} (accessoires)`] : []),
          ...(d.nonComptes.length ? ['Non comptés :', ...d.nonComptes.map((n) => `+${n.valeur} ${n.nom} (${n.raison === 'mains' ? 'arme à une main non écrite' : RAISONS[n.raison]})`)] : []),
        ].join('\n');
        des.toggleAttribute('data-posture', Boolean(d.moment.length || d.diviseur > 1));
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
      soliditeLigne,
      el('details', { class: 'objet__details' }, el('summary', {}, resume), el('div', { class: 'fiche-champs' },
      champ('Composition', selecteur(() => l()?.materiau_id, regles.materiaux_armes.map((m) => option(m.id, m.nom)), poserChamp('materiau_id'), { etiquette: `Arme ${rang} : composition` })),
      champ('Amélioration', selecteur(() => l()?.amelioration_id, ameliorations('arme'), poserChamp('amelioration_id'), { etiquette: `Arme ${rang} : amélioration` })),
      champ('Élément', selecteur(() => l()?.arme_elementaire_id, regles.armes_elementaires.map((a) => option(a.id, a.nom)), poserChamp('arme_elementaire_id'), { etiquette: `Arme ${rang} : élément` })),
      champ('Amélioration de l’élément', selecteur(() => l()?.amelioration_elementaire_id, ameliorations('arme_elementaire'), poserChamp('amelioration_elementaire_id'), { etiquette: `Arme ${rang} : amélioration de l’élément` })),
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Effet en plus'), effet))));
  }));

  // l'armure portée (décision R95 : « L'amélioration est pour l'armure complète », l'élément aussi) : UNE armure complète, son amélioration, son élément
  // et l'amélioration de l'élément (armureApresChoix : une autre armure est neuve) ; puis la solidité du moment de chacune de ses six parties
  // (« L'armure peut casser à certains endroits seulement »), ou de l'armure entière pour une armure à solidité unifiée : un curseur de 0 au maximum
  // (partiesDeLArmure : la solidité de l'armure et les crans de son amélioration), « N / M » à côté, « Cassée » à 0 ; clic droit ou Entrée : saisir le
  // nombre. Chaque partie se répare individuellement (« kit de réparation ou métier adapté + matériau ») : rien n'en est calculé, sa solidité remonte au curseur
  reconstruire($('armures'), 'fixe', () => {
    const choisir = (champ) => (v) => {
      Object.assign(fiche, armureApresChoix(regles, fiche, champ, v));
      changer();
    };
    const armure = selecteur(() => fiche.armure_id, optionsGroupees(regles.armures, (a) => a.type, (a) => `${a.nom}${stats(a) ? ` (${stats(a)})` : ''}`),
      choisir('armure_id'), { vide: 'Aucune', etiquette: 'Armure' });
    const suite = [
      ['Amélioration', selecteur(() => fiche.armure_amelioration_id, ameliorations('armure'), choisir('armure_amelioration_id'), { etiquette: 'Armure : amélioration' })],
      ['Élément', selecteur(() => fiche.armure_elementaire_id, optionsGroupees(regles.armures_elementaires, (a) => a.categorie, (a) => a.nom + (stats(a) ? ` (${stats(a)})` : '')),
        choisir('armure_elementaire_id'), { etiquette: 'Armure : élément' })],
      ['Amélioration de l’élément', selecteur(() => fiche.armure_amelioration_elementaire_id, ameliorations('armure_elementaire'), choisir('armure_amelioration_elementaire_id'),
        { etiquette: 'Armure : amélioration de l’élément' })],
    ];
    synchro(() => { for (const [, sel] of suite) sel.disabled = !fiche.armure_id; });
    // un rang par emplacement (les six parties, et l'armure entière pour une armure à solidité unifiée) : ceux que l'armure n'a pas sont cachés
    const rangs = regles.emplacements_armure.map((e) => {
      const curseur = el('input', {
        type: 'range', min: '0', step: '1', class: 'curseur', 'aria-label': `Solidité : ${e.nom}`,
        oninput: (ev) => {
          fiche.armure_parties = partiesApresReglage(regles, fiche, e.id, ev.target.value);
          changer();
        },
      });
      const nom = el('span', { class: 'objet__solidite-nom' }, e.nom);
      const valeur = el('output', { class: 'curseur__valeur' });
      const rang = el('div', { class: 'objet__solidite armure__partie', 'data-emplacement': e.id }, nom, curseur, valeur);
      synchro(() => {
        const a = partiesDeLArmure(regles, fiche);
        const partie = a?.parties.find((x) => x.emplacement_id === e.id);
        rang.hidden = !partie;
        if (!partie) return;
        nom.textContent = partie.nom;
        curseur.setAttribute('aria-label', `Solidité : ${partie.nom}`);
        rang.toggleAttribute('data-cassee', partie.cassee);
        curseur.max = String(a.max);
        poser(curseur, partie.actuelle);
        valeur.textContent = partie.cassee ? 'Cassée' : `${partie.actuelle} / ${a.max}`;
        rang.title = [
          `${partie.nom} : ${partie.actuelle} / ${a.max} cran${a.max > 1 ? 's' : ''}${partie.cassee ? ' : cassée' : ''}`,
          ...a.detail.map((c, i) => (i ? `${c.nom} ${signe(c.valeur)}` : `${c.nom} : ${c.valeur}${a.uni ? ' (solidité unifiée : toute l’armure)' : ''}`)),
          'À 0, la partie est cassée ; chaque partie se répare individuellement (kit de réparation ou métier adapté + matériau). Clic droit ou Entrée sur le curseur : saisir le nombre.',
        ].join('\n');
      });
      return rang;
    });
    const parties = el('div', { class: 'armure__parties', role: 'group', 'aria-label': 'Solidité des parties de l’armure' }, rangs);
    synchro(() => { parties.hidden = !fiche.armure_id; });
    return el('div', { class: 'objet' },
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Armure'), armure),
      el('div', { class: 'fiche-champs' }, suite.map(([t, sel]) => el('label', { class: 'fiche-champ' }, el('span', {}, t), sel))),
      parties);
  });

  // le bouclier (décision R96 : « Forme + matière », comme l'onglet Boucliers) : sa forme, sa matière et son amélioration (bouclierApresChoix : une autre
  // forme ou matière est neuve) ; puis son AP et son AM (comptés en parade partielle : construireDefense ; cassé, 0 et grisés : R108), son poids (Force
  // minimum) et sa solidité du moment, un curseur de 0 au maximum (la matière et les crans de l'amélioration), « Cassé » à 0 ; clic droit ou Entrée :
  // saisir le nombre
  reconstruire($('bouclier'), 'fixe', () => {
    const choisir = (champ) => (v) => {
      Object.assign(fiche, bouclierApresChoix(regles, fiche, champ, v));
      changer();
    };
    const forme = selecteur(() => fiche.bouclier_classe_id, regles.boucliers.map((b) => option(b.id, `${b.nom} (classe ${b.classe})`)), choisir('bouclier_classe_id'),
      { vide: 'Aucun', etiquette: 'Bouclier : forme' });
    const matiere = selecteur(() => fiche.bouclier_materiau_id, regles.materiaux_bouclier.map((m) => option(m.id, m.nom)), choisir('bouclier_materiau_id'),
      { etiquette: 'Bouclier : matière' });
    const amelioration = selecteur(() => fiche.bouclier_amelioration_id, ameliorations('bouclier'), choisir('bouclier_amelioration_id'), { etiquette: 'Bouclier : amélioration' });
    // trois tuiles posées une fois, focalisables (leur infobulle se lit aussi au clavier, comme celles de la défense)
    const tuile = (nom) => {
      const texte = el('strong', {});
      return { texte, li: el('li', { class: 'bouclier__tuile', tabindex: '0' }, el('small', {}, nom), texte) };
    };
    const [tuileAp, tuileAm, tuilePoids] = [tuile('AP'), tuile('AM'), tuile('Poids')];
    const tuiles = el('ul', { class: 'bouclier__tuiles', 'aria-label': 'Ce que donne le bouclier' }, tuileAp.li, tuileAm.li, tuilePoids.li);
    const labelMatiere = el('label', { class: 'fiche-champ' }, el('span', {}, 'Matière'), matiere);
    const curseur = el('input', {
      type: 'range', min: '0', step: '1', class: 'curseur', 'aria-label': 'Bouclier : solidité',
      oninput: (ev) => {
        fiche.bouclier_solidite = soliditeDuBouclierAEcrire(regles, fiche, ev.target.value);
        changer();
      },
    });
    const valeur = el('output', { class: 'curseur__valeur' });
    const soliditeLigne = el('div', { class: 'objet__solidite' }, el('span', { class: 'objet__solidite-nom' }, 'Solidité'), curseur, valeur);
    synchro(() => {
      const b = bouclierDe(regles, fiche);
      matiere.disabled = !b;
      amelioration.disabled = !b?.matiere;
      // une forme sans sa matière : la matière est à choisir (règle bouclier_matiere_manquante)
      labelMatiere.toggleAttribute('data-a-choisir', Boolean(b && !b.matiere));
      tuiles.hidden = !b?.bouclier;
      if (b?.bouclier) {
        const ecrire = (t, texte) => { if (t.texte.textContent !== texte) t.texte.textContent = texte; };
        // un bouclier cassé (décision R108 : « Bouclier à 0 : ses AP/AM cessent-ils de compter, comme une arme cassée ? Oui ») : ses tuiles AP et AM
        // grisées à 0, comme la pastille d'une arme cassée (l'export écrit aussi 0) ; ses valeurs, réparé, restent en infobulle
        const casse = Boolean(b.solidite?.cassee);
        const pourquoi = casse ? [`Bouclier cassé (solidité 0 / ${b.solidite.max}) : ses AP et AM ne comptent plus, même en parade partielle (décision R108)`] : [];
        for (const t of [tuileAp, tuileAm]) t.li.toggleAttribute('data-cassee', casse);
        ecrire(tuileAp, String(casse ? 0 : b.ap));
        infobulle(tuileAp.li, [...pourquoi, ...(casse ? [`Réparé : ${b.ap} AP`] : []),
          `${b.nom} : ${entier(b.bouclier.ap)} AP`, ...(b.amelioration?.bonus_ap ? [`Amélioration niveau ${b.amelioration.niveau} : +${b.amelioration.bonus_ap} AP`] : []),
          ...(casse ? [] : ['Comptés en parade partielle (guide « Fiche de personnage : Armure/Défense/Bouclier »)'])].join('\n'));
        ecrire(tuileAm, String(casse ? 0 : b.am));
        infobulle(tuileAm.li, casse ? [...pourquoi, `Réparé : ${b.am} AM`].join('\n') : 'Comptés en parade partielle');
        tuilePoids.li.hidden = !b.poids;
        if (b.poids) {
          ecrire(tuilePoids, b.poids.nom);
          infobulle(tuilePoids.li, `Requiert ${b.poids.force_min} Force minimum${b.forceManquante ? ` : Force ${b.force}, trop lourd` : ''}`);
          tuilePoids.li.style.setProperty('--c', b.poids.couleur);
          tuilePoids.li.style.setProperty('--texte-sur-c', b.poids.texte);
          tuilePoids.li.dataset.poids = '';
          tuilePoids.li.toggleAttribute('data-trop', b.forceManquante);
        }
      }
      soliditeLigne.hidden = !b?.solidite;
      if (b?.solidite) {
        const sol = b.solidite;
        curseur.max = String(sol.max);
        poser(curseur, sol.actuelle);
        valeur.textContent = sol.cassee ? 'Cassé' : `${sol.actuelle} / ${sol.max}`;
        soliditeLigne.toggleAttribute('data-cassee', sol.cassee);
        soliditeLigne.title = [`Solidité : ${sol.actuelle} / ${sol.max} cran${sol.max > 1 ? 's' : ''}${sol.cassee ? ' : le bouclier est cassé' : ''}`,
          ...sol.detail.map((c, i) => (i ? `${c.nom} ${signe(c.valeur)}` : `${c.nom} : ${c.valeur}`)), 'Clic droit ou Entrée sur le curseur : saisir le nombre.'].join('\n');
      }
    });
    return el('div', { class: 'objet' },
      el('div', { class: 'fiche-champs' },
        el('label', { class: 'fiche-champ' }, el('span', {}, 'Forme'), forme),
        labelMatiere,
        el('label', { class: 'fiche-champ' }, el('span', {}, 'Amélioration'), amelioration)),
      tuiles, soliditeLigne);
  });

  // les accessoires (décision R97) : six emplacements, chacun un effet de la table, choisi dans une liste rangée (effetsDAccessoireProposes : par
  // propriété, puis par ce qu'il vise et sa valeur) ; une « Compétence X » est une entrée par caractéristique, dont la valeur tirée (de 1 à 20) donne le
  // niveau (effetDeCompetence) : la seule valeur saisie ; la case « Maudit » (effet contraire, R54)
  reconstruire($('accessoires'), 'fixe', () => [
    el('thead', {}, el('tr', {}, el('th', {}, 'Emplacement'), el('th', {}, 'Effet'), el('th', { class: 'nombre etroite' }, 'Valeur'), el('th', { class: 'etroite' }, 'Maudit'))),
    el('tbody', {}, EMPLACEMENTS_ACCESSOIRES.map(([cle, nom]) => {
      const l = () => ligneDe('accessoires', (x) => x.emplacement === cle);
      const obtenir = () => ligne('accessoires', (x) => x.emplacement === cle, () => ({ emplacement: cle, accessoire_effet_id: null, valeur: null, maudit: 0 }));
      const caracteristiqueDe = (x) => {
        const effet = trouver(regles.accessoires, x?.accessoire_effet_id);
        return effet?.propriete === 'competence' ? effet.caracteristique_id : null;
      };
      const niveaux = (caracId) => regles.accessoires.filter((a) => a.propriete === 'competence' && a.caracteristique_id === caracId);
      const valeur = el('input', {
        type: 'number', step: '1', 'aria-label': `${nom} : valeur tirée`,
        oninput: (ev) => {
          const x = l();
          const caracId = caracteristiqueDe(x);
          if (!x || !caracId) return;
          // bornée aux plages écrites, comme le générateur : la valeur comptée est celle du niveau choisi
          x.valeur = valeurDeCompetenceBornee(regles, caracId, ev.target.value);
          x.accessoire_effet_id = effetDeCompetence(regles, caracId, x.valeur)?.id ?? x.accessoire_effet_id;
          changer();
        },
      });
      const maudit = el('input', { type: 'checkbox', 'aria-label': `${nom} : maudit`, onchange: (ev) => { const x = l(); if (x) { x.maudit = ev.target.checked ? 1 : 0; changer(); } } });
      // l'effet à choix (décision R54) : « Compétence X » → une compétence de cette caractéristique ; « +5 dégâts avec une catégorie d'arme » → une famille
      const choixCompetence = el('select', { 'aria-label': `${nom} : compétence de l’accessoire`,
        onchange: (ev) => { obtenir().competence_id = ev.target.value || null; changer(); } });
      const choixFamille = el('select', { 'aria-label': `${nom} : famille d’armes de l’accessoire`,
        onchange: (ev) => { obtenir().arme_famille_id = ev.target.value || null; changer(); } });
      const resumeEffet = el('span', { class: 'accessoire-effet' });
      const effets = el('select', {
        'aria-label': `${nom} : effet`,
        onchange: (ev) => {
          const v = ev.target.value;
          if (!v) {
            retirer('accessoires', (y) => y.emplacement === cle);
            return changer();
          }
          const x = obtenir();
          const avant = caracteristiqueDe(x);
          const caracId = v.startsWith('competence:') ? v.slice('competence:'.length) : null;
          // la même caractéristique garde sa valeur tirée et sa compétence ; un autre effet repart de rien
          if (caracId !== avant || !caracId) Object.assign(x, { valeur: null, competence_id: null });
          if (v !== valeurDEffetDAccessoire(regles, x)) x.arme_famille_id = null;
          x.accessoire_effet_id = caracId ? effetDeCompetence(regles, caracId, x.valeur)?.id ?? null : v;
          changer();
        },
      });
      synchro(() => {
        const x = l();
        const effet = trouver(regles.accessoires, x?.accessoire_effet_id);
        // la liste (refaite quand l'effet porté n'y est pas encore : un effet que la liste ne propose pas reste visible et choisi)
        const cleListe = effet && effet.propriete !== 'competence' ? effet.id : '';
        if (effets.dataset.cle !== cleListe || !effets.options.length) {
          effets.dataset.cle = cleListe;
          effets.replaceChildren(el('option', { value: '' }, '—'), ...effetsDAccessoireProposes(regles, cleListe ? [cleListe] : [])
            .map((g) => el('optgroup', { label: g.nom }, g.options.map((o) => el('option', { value: o.valeur }, o.texte)))));
        }
        effets.value = valeurDEffetDAccessoire(regles, x);
        const caracId = caracteristiqueDe(x);
        choixCompetence.hidden = !caracId;
        if (caracId) {
          const options = regles.competences.filter((k) => k.caracteristique_id === caracId);
          if (choixCompetence.dataset.options !== caracId) {
            choixCompetence.replaceChildren(el('option', { value: '' }, '— compétence —'), ...options.map((k) => el('option', { value: k.id }, k.nom)));
            choixCompetence.dataset.options = caracId;
          }
          choixCompetence.value = options.some((k) => k.id === x?.competence_id) ? x.competence_id : '';
          choixCompetence.toggleAttribute('data-a-choisir', !choixCompetence.value);
        }
        const cibles = (effet?.effets ?? []).map((c) => c.cible);
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
        const rendus = effetsDesAccessoires(regles, { ...fiche, accessoires: x ? [x] : [] });
        resumeEffet.textContent = rendus.filter((e) => !e.aChoisir && e.valeur !== null).map(texteDEffet).join(' · ');
        // la valeur : seulement pour une « Compétence X » (demande du propriétaire : « la valeur ne devrait s'afficher que pour les compétences »)
        valeur.hidden = !caracId;
        if (caracId) {
          const n = niveaux(caracId);
          valeur.min = String(Math.min(...n.map((a) => a.min)));
          valeur.max = String(Math.max(...n.map((a) => a.max)));
          valeur.title = `Entre ${valeur.min} et ${valeur.max} : le niveau de l’effet en découle${effet ? ` (niveau ${effet.niveau})` : ''}`;
          if (document.activeElement !== valeur) poser(valeur, x?.valeur ?? '');
          valeur.toggleAttribute('data-a-choisir', x?.valeur === null || x?.valeur === undefined);
        }
        maudit.disabled = !x;
        poser(maudit, x?.maudit);
      });
      return el('tr', {}, el('td', {}, nom),
        el('td', { class: 'accessoire-cellule' }, effets, choixCompetence, choixFamille, resumeEffet),
        el('td', { class: 'nombre' }, valeur), el('td', {}, maudit));
    })),
  ]);

  // le sac (décision R88) : autant d'emplacements que la Force en donne, une ligne par emplacement quelle que soit sa quantité, et le tableau en montre
  // autant (les objets, l'emplacement libre suivant, puis les emplacements vides) ; chaque ligne propose le catalogue (ressources et bâtons magiques :
  // catalogueDuSac) dans une liste qui se filtre à la frappe, à partir de deux caractères (autocompletion), ou une saisie libre. Au-delà de la place (une
  // Force qui baisse, un import), les lignes restent, signalées : rien n'est retiré.
  const sac = inventaireDe(regles, fiche);
  const place = $('inventaire-place');
  // écrit seulement quand il change : c'est une région annoncée aux lecteurs d'écran (aria-live), et la fiche est rafraîchie à chaque frappe
  // le don « Organisé » : le sac d'une Force plus haute, dit à côté (décision R88)
  const textePlace = `${sac.occupes} / ${sac.emplacements} emplacements (Force ${sac.force}${sac.don && sac.don.force > sac.force ? ` ; ${sac.don.nom} : comme Force ${sac.don.force}` : ''})`
    + (sac.auDela ? ` : ${sac.auDela} objet${sac.auDela > 1 ? 's' : ''} au-delà de la place` : '');
  if (place.textContent !== textePlace) place.textContent = textePlace;
  attribut(place, 'data-trop', sac.auDela > 0);
  const lignesDuSac = fiche.inventaire ?? [];
  const ressourceDe = (nom) => regles.ressources.find((r) => r.nom === nom)?.id ?? null;
  const catalogue = catalogueDuSac(regles);
  const occupee = (o) => String(o?.nom ?? '').trim() !== '';
  const libre = lignesDuSac.length < sac.emplacements;
  reconstruire($('inventaire'), `${versionInventaire}:${lignesDuSac.length}:${sac.emplacements}`, () => [
    el('thead', {}, el('tr', {}, el('th', {}, 'Objet'), el('th', { class: 'nombre' }, 'Quantité'), el('th', {}, ''))),
    el('tbody', {}, [
      ...lignesDuSac.map((o, i) => {
        const ecrire = (valeur) => {
          o.nom = valeur;
          o.ressource_id = ressourceDe(valeur);
          changer();
        };
        const nom = el('input', { 'aria-label': `Sac, emplacement ${i + 1} : objet`, oninput: (ev) => ecrire(ev.target.value) });
        const saisie = autocompletion(nom, (v) => propositionsDuCatalogue(catalogue, v), (choisi) => {
          poser(nom, choisi);
          ecrire(choisi);
        });
        // un nombre saisi, de 1 (personnage_inventaire : CHECK quantite >= 1) à 99 (décision R88 : quantiteDuSac) ; un champ vidé attend la saisie
        // suivante, la valeur validée reprend celle de la fiche ; 1 ne se voit qu'au survol de la ligne ou au focus (data-un, fiche.css)
        const quantite = el('input', {
          type: 'number', min: '1', max: String(regles.sac.quantite_max), step: '1', 'aria-label': `Sac, emplacement ${i + 1} : quantité`,
          oninput: (ev) => {
            if (ev.target.value === '') return;
            o.quantite = quantiteDuSac(regles, entier(ev.target.value, 1));
            changer();
          },
          onchange: () => poser(quantite, o.quantite),
        });
        // un bâton magique se règle ici, magie puis niveau, avant d'aller à la ceinture (décision R101) : la ligne prend alors le nom du bâton
        const reglage = reglageDuBaton(o, i + 1, (nomDuBatonChoisi) => { poser(nom, nomDuBatonChoisi); ecrire(nomDuBatonChoisi); });
        const tr = el('tr', { 'data-ligne': String(i + 1) },
          el('td', {}, saisie, reglage.element), el('td', { class: 'nombre' }, quantite),
          el('td', {}, el('button', { type: 'button', class: 'retirer', 'aria-label': 'Retirer l’objet', onclick: () => { retirer('inventaire', (x) => x === o); changer(); } }, '✕')));
        synchro(() => {
          poser(nom, o.nom ?? '');
          reglage.maj();
          poser(quantite, o.quantite);
          attribut(quantite, 'data-un', entier(o.quantite) === 1);
          attribut(quantite, 'aria-invalid', entier(o.quantite) > regles.sac.quantite_max ? 'true' : null);
          // au-delà de la place : compté parmi les lignes qui portent un objet (une ligne dont le nom a été effacé n'en prend pas)
          const auDela = occupee(o) && (fiche.inventaire ?? []).slice(0, i + 1).filter(occupee).length > sac.emplacements;
          attribut(tr, 'data-au-dela', auDela);
          infobulle(tr, auDela ? `Au-delà de la place (${sac.emplacements} emplacements)` : '');
        });
        return tr;
      }),
      // l'emplacement libre suivant : y écrire crée la ligne, qui garde le focus (une composition en cours, touche morte ou IME, attend d'être finie) ;
      // une ligne dont le nom a été effacé sert d'emplacement libre : le champ se cache, l'emplacement reste
      libre ? (() => {
        // une seule fois : un navigateur qui envoie compositionend puis un input ordinaire passerait deux fois, et la seconde remplacerait la ligne
        // créée (celle dont le champ a reçu le focus) par une autre
        let cree = false;
        const creer = (valeur) => {
          if (cree || !valeur.trim()) return;
          cree = true;
          fiche.inventaire = [...lignesDuSac, { rang: lignesDuSac.length + 1, nom: valeur, quantite: 1, ressource_id: ressourceDe(valeur) }];
          changer();
          const champ = racine.querySelector(`#inventaire tr[data-ligne="${fiche.inventaire.length}"] input`);
          champ?.focus();
          champ?.setSelectionRange?.(champ.value.length, champ.value.length);
          // la liste qui se filtre s'ouvre tout de suite (un collage de deux lettres ou plus n'attend pas la frappe suivante)
          champ?.dispatchEvent(new Event('input'));
        };
        const champ = el('input', {
          'aria-label': `Sac, emplacement ${lignesDuSac.length + 1} : nouvel objet`, placeholder: 'Ajouter un objet (proposé dès 2 lettres, ou libre)…',
          oninput: (ev) => { if (!ev.isComposing) creer(ev.target.value); },
          oncompositionend: (ev) => creer(ev.target.value),
        });
        synchro(() => attribut(champ, 'hidden', !(fiche.inventaire ?? []).every(occupee)));
        return el('tr', { class: 'inventaire__libre' }, el('td', { colspan: '3' }, champ));
      })() : null,
      // les emplacements vides qui restent : la place que la Force donne, visible
      ...Array.from({ length: Math.max(0, sac.emplacements - lignesDuSac.length - (libre ? 1 : 0)) },
        () => el('tr', { class: 'inventaire__vide', 'aria-hidden': 'true' }, el('td', { colspan: '3' }))),
    ]),
  ]);
}

// ------------------------------------------------------------------ défense et dégâts reçus (décision R98)
/** Les dégâts reçus en cours de calcul : rien n'en est enregistré (un calcul du moment, pas un choix du joueur), la partie touchée comprise (R108). */
const degatsEnCours = { entrants: '', type: 'estoc', partie: PARTIE_PAR_DEFAUT, reduits: false, parade: false, don: false };

/**
 * La défense du personnage (demande du propriétaire du 2026-10-17 : « dans l'onglet Armure avoir la valeur totale d'AP et d'AM ») : l'AP et l'AM totaux
 * (defenseDe : base, accessoires, armure portée) sur la partie touchée (décision R108 : « Partie touchée », le torse par défaut, l'armure d'une partie
 * cassée ne compte pas), le détail en infobulle avec les parties cassées, et ceux du bouclier à part (comptés en parade partielle, plus du tout cassé) ;
 * puis les dégâts reçus (degatsRecus : « saisir le nombre de dégâts entrants, et un champ calculant automatiquement les dégâts reçus, avec une case à
 * cocher (dégâts réduits) pour les cas d'esquive ou parade partielle », le type de dégâts : Estoc, Taille, Frappe ou l'une des quatorze magies ; « Ce
 * calcul devra inclure les réductions éventuelles » : l'étape « ÷ 2 si un don divise les dégâts » de la formule, à cocher), les étapes du calcul en
 * infobulle.
 */
function construireDefense() {
  // un réglage du calcul ne change pas la fiche : seules les synchronisations de ce bloc sont refaites
  const majDefense = () => { for (const f of synchros.get($('defense')) ?? []) f(); };
  reconstruire($('defense'), 'fixe', () => {
    const tuile = (nom) => {
      const valeur = el('strong', {});
      return { valeur, li: el('li', { class: 'defense__tuile', tabindex: '0' }, el('small', {}, nom), valeur) };
    };
    const ap = tuile('AP');
    const am = tuile('AM');
    const bouclier = el('p', { class: 'fiche-aide defense__bouclier' });
    const entrants = el('input', {
      type: 'number', min: '0', step: '1', inputmode: 'numeric', 'aria-label': 'Dégâts entrants', placeholder: 'Dégâts',
      oninput: (ev) => { degatsEnCours.entrants = ev.target.value; majDefense(); },
    });
    const types = typesDeDegats(regles);
    const type = el('select', { 'aria-label': 'Type de dégâts', onchange: (ev) => { degatsEnCours.type = ev.target.value; majDefense(); } },
      el('optgroup', { label: 'Physique' }, types.filter((t) => t.physique).map((t) => option(t.id, t.nom, t.id === degatsEnCours.type))),
      el('optgroup', { label: 'Magie' }, types.filter((t) => !t.physique).map((t) => option(t.id, t.nom, t.id === degatsEnCours.type))));
    // la partie touchée (décision R108) : les six parties, le torse par défaut (« Une attaque "non ciblée" touche par défaut le torse ») ; seulement
    // avec une armure (sans elle, toutes les parties se valent)
    const parties = partiesDuCorps(regles);
    const partie = el('select', {
      'aria-label': 'Partie touchée',
      title: 'Partie touchée : une attaque non ciblée touche le torse ; l’armure d’une partie cassée n’y compte pas (décision R108)',
      onchange: (ev) => { degatsEnCours.partie = ev.target.value; majDefense(); },
    }, parties.map((x) => option(x.id, x.nom, x.id === degatsEnCours.partie)));
    const reduits = el('input', { type: 'checkbox', onchange: (ev) => { degatsEnCours.reduits = ev.target.checked; majDefense(); } });
    const parade = el('input', { type: 'checkbox', onchange: (ev) => { degatsEnCours.parade = ev.target.checked; majDefense(); } });
    const paradeLabel = el('label', { class: 'fiche-coche', title: 'La parade partielle se fait au bouclier : ses AP et AM s’ajoutent à l’armure' }, parade, 'Au bouclier');
    const don = el('input', { type: 'checkbox', onchange: (ev) => { degatsEnCours.don = ev.target.checked; majDefense(); } });
    const recus = el('output', { class: 'defense__recus', 'aria-live': 'polite' });
    synchro(() => {
      const avecArmure = Boolean(partiesDeLArmure(regles, fiche));
      const d = defenseDe(regles, fiche, calcul.attributs, { partie: degatsEnCours.partie });
      // la partie touchée et les parties cassées (R108), avec une armure seulement
      const parPartie = !avecArmure || !d.partie ? [] : [
        `Partie touchée : ${d.partie.nom}${d.partie.cassee ? ' (cassée : l’armure n’y compte pas)' : ''}`,
        ...(d.cassees.length ? [`Parties cassées (l’armure n’y compte pas, décision R108) : ${d.cassees.map((x) => x.nom).join(', ')}`] : []),
      ];
      const detail = (x, nom) => [`${nom} : ${x.total}`, ...x.detail.map((l) => `${l.nom} : ${signe(l.valeur)}`),
        ...(d.element ? [`Élément ${d.element.nom} : l’armure d’origine et son amélioration ne comptent plus (« Tous les bonus d’origine […] sont perdus »)`] : []),
        ...parPartie].join('\n');
      ap.valeur.textContent = String(d.ap.total);
      am.valeur.textContent = String(d.am.total);
      infobulle(ap.li, detail(d.ap, 'Armure physique (AP)'));
      infobulle(am.li, detail(d.am, 'Armure magique (AM)'));
      partie.hidden = !avecArmure;
      for (const o of partie.options) {
        const x = parties.find((y) => y.id === o.value);
        const texte = `${x.nom}${d.cassees.some((y) => y.id === x.id) ? ' (cassée)' : ''}`;
        if (o.textContent !== texte) o.textContent = texte;
      }
      poser(partie, d.partie?.id ?? degatsEnCours.partie);
      const texteBouclier = !d.bouclier ? ''
        : d.bouclier.cassee ? `Bouclier ${d.bouclier.nom} cassé : ses AP et AM ne comptent plus, même en parade partielle (décision R108).`
          : `Bouclier ${d.bouclier.nom} : +${d.bouclier.ap} AP, +${d.bouclier.am} AM en parade partielle.`;
      if (bouclier.textContent !== texteBouclier) bouclier.textContent = texteBouclier;
      bouclier.hidden = !d.bouclier;
      if (document.activeElement !== entrants) poser(entrants, degatsEnCours.entrants);
      poser(reduits, degatsEnCours.reduits);
      poser(parade, degatsEnCours.parade);
      poser(don, degatsEnCours.don);
      paradeLabel.hidden = !d.bouclier;
      parade.disabled = !degatsEnCours.reduits;
      const r = degatsEnCours.entrants === '' ? null
        : degatsRecus(regles, fiche, degatsEnCours);
      // écrit seulement quand il change : c'est une région annoncée aux lecteurs d'écran (aria-live), et la fiche est rafraîchie à chaque frappe
      const texteRecus = r ? `${r.recus} reçus` : '—';
      if (recus.textContent !== texteRecus) recus.textContent = texteRecus;
      infobulle(recus, r ? r.etapes.map((e) => `${e.texte} : ${String(Math.round(e.valeur * 100) / 100).replace('.', ',')}`).concat(`Arrondi à l’inférieur : ${r.recus}`).join('\n') : '');
    });
    return [
      el('ul', { class: 'defense__tuiles', 'aria-label': 'Armure totale' }, ap.li, am.li),
      bouclier,
      el('div', { class: 'defense__degats', role: 'group', 'aria-label': 'Dégâts reçus' },
        el('span', { class: 'defense__titre' }, 'Dégâts reçus'), entrants, type, partie,
        el('label', { class: 'fiche-coche', title: 'Esquive ou parade partielle : les dégâts sont divisés par 2 après l’armure' }, reduits, 'Dégâts réduits'),
        paradeLabel,
        el('label', { class: 'fiche-coche', title: 'Formule des dégâts : « ÷ 2 si un don divise les dégâts » (selon la situation : à cocher)' }, don, 'Don ÷ 2'),
        recus),
    ];
  });
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

/**
 * Les 3 emplacements de la ceinture (décision R89), chacun [objet][quantité] : l'objet, un objet du sac (liste-ceinture : suggestionsDeCeinture ; un nom
 * que le sac n'a pas est refusé, avec la raison : « Sac seulement »), qui en sort (mettreALaCeinture : 3 exemplaires au plus, un bâton magique, un
 * carquois plein) ; la quantité, affichée, que changent seuls les boutons « Utiliser » (utiliserLObjet), « Remplir » (remplirLEmplacement) et « Ranger »
 * (rangerLEmplacement), chacun montré quand il sert (actionsDeLEmplacement). Un nom effacé ne vide pas l'emplacement : le champ reprend son objet
 * (« Ranger » le vide).
 */
/** Le nom refusé en dernier (absent du sac) : sa raison s'efface quand on tape à nouveau, ou quand le sac reçoit ce nom. */
let nomRefuse = null;

function construireCeinture() {
  // l'aide dit les règles telles que la fiche les applique (les valeurs viennent des règles de la base) ; écrite seulement quand elle change
  const exemplaires = exemplairesParEmplacement(regles, fiche);
  const aide = `${PLACES_DE_CEINTURE} emplacements d’objets rapides, utilisables en IC ; les carquois, sacs de bombes ou de pierres doivent être à la ceinture pour servir. `
    + `Chaque emplacement prend un objet du sac : ${exemplaires} exemplaires au plus (tous s’il y en a moins), un bâton magique seul, un carquois ou un sac plein (sa contenance en projectiles). `
    + '« Utiliser » en retire un, « Remplir » le complète avec le sac (un carquois : un projectile de plus), « Ranger » le remet au sac.';
  const blocAide = $('ceinture-aide');
  if (blocAide.textContent !== aide) blocAide.textContent = aide;
  // les objets du sac, proposés dans chaque emplacement (refaits quand le sac change)
  const suggestions = suggestionsDeCeinture(fiche, regles);
  const liste = $('liste-ceinture');
  const cle = JSON.stringify(suggestions);
  if (liste.dataset.cle !== cle) {
    liste.dataset.cle = cle;
    liste.replaceChildren(...suggestions.map((s) => el('option', { value: s.nom, label: `${s.nom} (×${s.quantite} dans le sac)` })));
  }
  // un nom refusé (absent du sac) : la raison, annoncée (role="status"), effacée à l'action suivante, à la frappe suivante, ou quand le sac a ce nom
  const refus = (n) => {
    nomRefuse = n;
    // le bâton magique pas encore réglé (décision R101) : il est dans le sac, mais sa magie et son niveau se choisissent d'abord
    const texte = n === null ? ''
      : n === regles.ceinture?.baton_a_regler && (fiche.inventaire ?? []).some((o) => String(o.nom ?? '').trim() === n)
        ? `« ${n} » se règle d’abord dans le sac (sa magie, puis son niveau) avant d’aller à la ceinture.`
        : `« ${n} » n’est pas dans le sac : ajoutez-le d’abord à l’inventaire, puis choisissez-le ici.`;
    if ($('ceinture-refus').textContent !== texte) $('ceinture-refus').textContent = texte;
  };
  if (nomRefuse !== null && suggestions.some((x) => x.nom === nomRefuse)) refus(null);
  reconstruire($('ceinture'), 'fixe', () => Array.from({ length: PLACES_DE_CEINTURE }, (_, i) => {
    const rang = i + 1;
    const l = () => ligneDe('ceinture', (x) => entier(x.rang) === rang);
    // ceinture et sac changent ensemble : quand le sac change, son tableau est refait (ses lignes ne sont plus les mêmes objets) ; le focus, s'il était
    // sur un champ que cela détache, ou sur un bouton que cela cache ou désactive, est rendu (rendreLeFocus : la même ligne du sac, ou le nom de
    // l'emplacement s'il était dans celui-ci)
    const appliquer = (r) => {
      const cible = document.activeElement;
      refus(null);
      fiche.ceinture = r.ceinture;
      if (JSON.stringify(r.inventaire) !== JSON.stringify(fiche.inventaire ?? [])) {
        fiche.inventaire = r.inventaire;
        versionInventaire += 1;
      }
      changer();
      rendreLeFocus(cible, li, nom);
    };
    // refusé (absent du sac, ou effacé) : le champ reprend l'objet de l'emplacement
    const choisir = (valeur) => {
      const n = String(valeur ?? '').trim();
      if (n === String(l()?.nom ?? '').trim()) return poser(nom, l()?.nom ?? '');
      const r = mettreALaCeinture(regles, fiche, rang, n);
      if (r) return appliquer(r);
      if (n) refus(n);
      poser(nom, l()?.nom ?? '');
    };
    // un objet du sac s'applique dès qu'il est choisi dans la liste (objetChoisiDansLaListe) ; ce qui est tapé, quand le champ est validé : un nom en
    // cours de frappe n'est pas un objet (« Méga fiole verte » avant « … foncée »). Un nom validé en quittant le champ (Tab, clic ailleurs) s'applique
    // avant que le focus n'arrive à sa cible, que cela peut détacher (le sac est refait), désactiver ou cacher : focusout la connaît (relatedTarget),
    // et le focus perdu lui est rendu (rendreLeFocus).
    const nom = el('input', {
      list: 'liste-ceinture', 'aria-label': `Ceinture, emplacement ${rang} : objet`, placeholder: 'Un objet du sac',
      oninput: (ev) => {
        if (nomRefuse !== null) refus(null);
        const choisi = objetChoisiDansLaListe(fiche, ev.target.value, ev.inputType, regles);
        if (choisi !== null) choisir(choisi);
      },
      onchange: (ev) => choisir(ev.target.value),
      onfocusout: (ev) => {
        const cible = ev.relatedTarget;
        if (cible) setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) rendreLeFocus(cible, li, nom); });
      },
    });
    // la quantité « N / max » : un simple texte (pas une région annoncée : chaque synchronisation la lirait sans dire de quel emplacement)
    const quantite = el('span', { class: 'ceinture__quantite' });
    // un bouton grisé (aria-disabled, pas disabled : il garde le focus, et son infobulle dit pourquoi au clavier aussi) ne fait rien
    const bouton = (texte, action) => {
      const b = el('button', {
        type: 'button', 'aria-label': `${texte} (ceinture, emplacement ${rang})`,
        onclick: () => { if (b.getAttribute('aria-disabled') !== 'true') appliquer(action(regles, fiche, rang)); },
      }, texte);
      return b;
    };
    // dans l'ordre où le propriétaire les nomme : « "Remplir" "Utiliser" et "Ranger" »
    const remplir = bouton('Remplir', remplirLEmplacement);
    const utiliser = bouton('Utiliser', utiliserLObjet);
    const ranger = bouton('Ranger', rangerLEmplacement);
    const actions = el('span', { class: 'ceinture__actions' }, remplir, utiliser, ranger);
    const li = el('li', { class: 'ceinture__emplacement' }, el('span', { class: 'ceinture__numero', 'aria-hidden': 'true' }, String(rang)), nom, quantite, actions);
    synchro(() => {
      const x = l();
      const a = actionsDeLEmplacement(regles, fiche, rang);
      if (document.activeElement !== nom) poser(nom, x?.nom ?? '');
      const texte = a ? `${a.quantite} / ${a.max}` : '';
      if (quantite.textContent !== texte) quantite.textContent = texte;
      attribut(quantite, 'hidden', !a);
      // au-delà du maximum (un import, un don perdu), ou un objet à 0 qui n'est pas (ou plus) un carquois : signalé, et dit dans l'infobulle
      const trop = Boolean(a) && a.quantite > a.max;
      const sous = Boolean(a) && a.quantite < a.min;
      attribut(quantite, 'data-invalide', trop || sous);
      infobulle(quantite, !a ? ''
        : trop ? `Au-delà du maximum de l’emplacement (${a.max})`
          : sous ? `En dessous du minimum de l’emplacement (${a.min})`
            : a.genre === 'baton' ? 'Un bâton magique compte pour un (utilisations illimitées)'
              : a.genre === 'contenant' ? `Projectiles : ${a.quantite} sur ${a.max}` : `Exemplaires : ${a.quantite} sur ${a.max}`);
      // un bâton dont un effet n'est pas compté : un autre bâton de la ceinture a le même, plus fort (décision R101 : « le meilleur seul »)
      const ecartes = a?.genre === 'baton' ? calcul.contexteSorts.batons.ecartes.filter((e) => e.baton.nom === x?.nom) : [];
      attribut(li, 'data-ecarte', ecartes.length > 0);
      infobulle(nom, ecartes.length ? ecartes.map((e) => `Non compté : « ${e.texte} » (${e.par.nom} a le même effet, plus fort)`).join('\n') : '');
      attribut(actions, 'hidden', !a);
      attribut(utiliser, 'hidden', !a?.utiliser);
      // grisé en Symbiose, sauf un parchemin (décision R112 : actionsDeLEmplacement, `refus`)
      attribut(utiliser, 'aria-disabled', a?.refus ? 'true' : null);
      infobulle(utiliser, !a ? '' : a.refus ? a.refus : a.genre === 'contenant' ? 'Retire un projectile' : 'Retire un exemplaire (le dernier libère l’emplacement)');
      attribut(remplir, 'hidden', !a?.remplir);
      // le sac n'en a plus : le bouton reste, grisé, avec la raison
      attribut(remplir, 'aria-disabled', a?.duSac === 0 ? 'true' : null);
      infobulle(remplir, !a ? ''
        : a.genre === 'contenant' ? `Ajoute un projectile (jusqu’à ${a.max})`
          : a.duSac === 0 ? `Plus de « ${x.nom} » dans le sac`
            : `Complète l’emplacement avec le sac : ${a.duSac} de plus`);
      infobulle(ranger, !a ? '' : a.genre === 'contenant' ? 'Remet le carquois ou le sac au sac (sans ses projectiles)' : 'Remet l’objet au sac');
      attribut(li, 'data-plein', Boolean(x));
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
  // la magie de la Symbiose (décision R100) : une magie du personnage, jamais le Potentiel Illimité ; une autre (magies changées) est oubliée
  if (fiche.symbiose_magie_id && (fiche.symbiose_magie_id === 'magies/potentiel-illimite'
    || ![fiche.magie_innee_id, fiche.magie_acquise_id].includes(fiche.symbiose_magie_id))) fiche.symbiose_magie_id = null;
  calcul = {
    niveau: niveauGlobal(regles, fiche.xp),
    classes: classesDe(regles, fiche),
    caracs: caracteristiquesDe(regles, fiche),
    competences: competencesDe(regles, fiche),
    nm: maitriseDesSorts(regles, fiche),
    attributs: attributsDe(regles, fiche),
    // la posture du moment et ce qu'elle change (décision R100) : compétences, initiative, AP/AM, dégâts, sorts
    posture: postureDuMoment(regles, fiche),
    // ce qui vaut pour tous les sorts (décisions R100 à R102), calculé une fois par rafraîchissement
    contexteSorts: contexteDesSorts(regles, fiche),
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
  construireEntrainement();
  construireAcquisAChoisir();
  construireAttributs();
  construirePostures();
  construireProgression();
  construireEquipement();
  construireDefense();
  construireCeinture();
  construirePortrait();
  for (const liste of synchros.values()) for (const s of liste) s();
  construireControles();
  construireRetraits();
  construireChoixEnAttente();
  etatDesBoutons();
  if (modifie) message(serviceJoignable ? 'Modifications non enregistrées.' : 'Service indisponible : téléchargez la fiche pour ne rien perdre.', 'attente');
}

/** Pose l'infobulle d'un élément (son `title`, que components/Infobulles.astro déplace dans data-infobulle) seulement si elle change. */
function infobulle(e, texte) {
  if ((e.dataset.infobulle ?? e.getAttribute('title')) !== texte) e.title = texte;
}

/**
 * La barre : Enregistrer (une fiche modifiée, ou jamais enregistrée), Supprimer (une fiche enregistrée), Télécharger et Exporter (grisés tant que la
 * fiche n'est pas enregistrée telle qu'elle est, sauf quand le service ne répond pas ou a refusé le dernier enregistrement ; Exporter aussi sans
 * identifiant client Google ; pendant un export : lib/fiche-tableur-export.mjs#etatDesExports). Recalculé par rafraichir et à la fin de chaque action.
 */
function etatDesBoutons() {
  $('fiche-enregistrer').disabled = !modifie && id !== null;
  $('fiche-supprimer').hidden = id === null;
  const etat = etatDesExports({ id, modifie, serviceJoignable, enregistrementRefuse, client: $('fiche-exporter').dataset.clientGoogle ?? '', occupe });
  for (const [cle, bouton] of [['telecharger', $('fiche-telecharger')], ['exporter', $('fiche-exporter')]]) {
    bouton.disabled = !etat[cle].actif;
    infobulle(bouton, etat[cle].infobulle);
  }
  $('fiche-importer-en-ligne').disabled = occupe;
}

// ------------------------------------------------------------------ enregistrement, chargement
/** La fiche à envoyer : listes nettoyées (lignes vides retirées, rangs renumérotés, pas de maîtrise sur ARME DE MONSTRES : décision R45). */
function aEnvoyer() {
  const f = structuredClone(fiche);
  for (const c of COLONNES_DU_SERVICE) delete f[c];
  delete f[CHAMP_VERSION];
  f.caracteristiques = (f.caracteristiques ?? []).filter((c) => c.base !== null && c.base !== undefined);
  f.competences = (f.competences ?? []).filter((c) => c.naturel).map(({ acquis: _a, ...c }) => c);
  // l'entraînement (décision R104) : une compétence par ligne, ou un texte non vide ; rangées dans l'ordre ; les choix d'acquis des dons débloqués
  f.entrainements = entrainementsAEnregistrer(f);
  f.acquis_choix = acquisChoixValables(regles, f);
  f.maitrises_armes = maitrisesValables(regles, f);
  // solidité du moment de chaque arme bornée à son maximum (décision R74 : à son maximum ou au-delà, rien d'enregistré) ; gains de niveau jamais négatifs (R73)
  f.armes = armesValables(regles, f);
  // de même celle des parties de l'armure (décision R95 : une ligne par partie abîmée, rien sans armure)
  f.armure_parties = partiesValables(regles, f);
  for (const c of ['gains_sante', 'gains_chakra']) f[c] = Math.max(0, entier(f[c]));
  f.sorts = (f.sorts ?? []).map((s, i) => ({ ...s, rang: i + 1 }));
  // la solidité du moment du bouclier bornée à son maximum (décision R96 : à son maximum ou au-delà, rien d'enregistré)
  f.bouclier_solidite = soliditeDuBouclierAEcrire(regles, f, f.bouclier_solidite);
  f.inventaire = (f.inventaire ?? []).filter((o) => o.nom && o.nom.trim()).map((o, i) => ({ ...o, nom: o.nom.trim(), rang: i + 1 }));
  f.accessoires = (f.accessoires ?? []).filter((a) => a.accessoire_effet_id);
  // la ceinture garde ses emplacements (rang 1 à 3) : seuls les emplacements vides partent
  f.ceinture = (f.ceinture ?? []).filter((o) => o.nom && o.nom.trim()).map((o) => ({ ...o, nom: o.nom.trim() }));
  return f;
}

/**
 * Les noms qui décrivent ce qu'une fiche d'avant perd à sa conversion (sansPartiesRetirees) : une armure, un emplacement d'armure, un matériau de
 * bouclier, un effet d'accessoire.
 */
const nomsDesRetraits = () => ({
  armure: (x) => trouver(regles.armures ?? [], x)?.nom ?? null,
  emplacement: (x) => trouver(regles.emplacements_armure ?? [], x)?.nom ?? null,
  ressource: (x) => trouver(regles.ressources ?? [], x)?.nom ?? null,
  accessoire: (x) => trouver(regles.accessoires ?? [], x)?.libelle ?? null,
  competence: (x) => trouver(regles.competences ?? [], x)?.nom ?? null,
});

function appliquer(donnees) {
  // une fiche d'avant (le service retombé sur sa base d'avant : docs/serveur.md) est convertie ici ; ce qu'elle perd est noté, daté, dans ses notes,
  // et la fiche est à enregistrer (sinon la conversion et ses notes se perdraient)
  const brute = donnees.personnage;
  const convertie = sansPartiesRetirees(brute, { instant: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), noms: nomsDesRetraits() });
  fiche = { ...ficheVide(''), ...convertie };
  versionInventaire += 1;   // une autre fiche : ses lignes d'inventaire sont d'autres objets
  for (const cle of Object.keys(PARTIES_DE_FICHE)) fiche[cle] ??= [];
  id = fiche.id;
  version = fiche[CHAMP_VERSION];
  controles = donnees.controles ?? null;
  modifie = convertie !== brute && (convertie?.notes ?? null) !== (brute?.notes ?? null);
  enregistrementRefuse = false;
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
      serviceJoignable = true;   // il répond de nouveau : Télécharger suit de nouveau l'enregistrement
      appliquer(donnees);
      history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
      message(controles.length ? `Enregistré : ${controles.length} règle${controles.length > 1 ? 's' : ''} à revoir (onglet « Contrôle »).` : 'Enregistré ✓', 'ok');
      return;
    }
    enregistrementRefuse = true;   // les modifications restent à l'écran : Télécharger et Exporter permis pour ne rien perdre (etatDesBoutons, plus bas)
    if (reponse.status === 409 && donnees.personnage) {
      // des éléments retirés par les règles depuis l'ouverture de la fiche (R42) : le dire, ils sont dans les notes de la fiche à jour
      const n = nouveauxRetraits(fiche.notes, donnees.personnage.notes).length;
      const avertissement = n ? `Les règles ont changé : ${n} élément(s) retiré(s) de cette fiche depuis son ouverture (voir les notes après rechargement). ` : '';
      message(`${avertissement}${donnees.erreur} `, 'erreur');
      $('fiche-message').append(el('button', { type: 'button', onclick: () => { appliquer({ personnage: donnees.personnage }); message('Fiche rechargée : les modifications non enregistrées sont perdues.', 'attente'); } }, 'Recharger la fiche'));
    } else if (donnees.erreur) {
      message(`${donnees.erreur}${donnees.problemes ? ` ${donnees.problemes.map(avecNoms).join(' ; ')}` : ''}`, 'erreur');
    } else if (reponse.status === 413) {
      // nginx répond avant le service (client_max_body_size, deploy/nginx.conf), en HTML : le service répond bien, la fiche est trop lourde
      message('Non enregistré : la fiche est trop volumineuse (portrait ou notes trop longs). Téléchargez-la pour ne rien perdre.', 'erreur');
    } else if (reponse.status < 500) {
      message(`Non enregistré (erreur ${reponse.status}). Téléchargez la fiche pour ne rien perdre.`, 'erreur');
    } else {
      throw new Error(`HTTP ${reponse.status}`);
    }
  } catch {
    serviceJoignable = false;
    afficherIndisponible('Le service des personnages ne répond pas : la fiche n’a pas été enregistrée. Téléchargez-la pour ne rien perdre, puis réessayez.');
    message('Non enregistré : service injoignable.', 'erreur');
  }
  bouton.disabled = false;
  etatDesBoutons();
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
    afficherIndisponible('Le service des personnages n’est pas joignable : la fiche peut être remplie et téléchargée, mais pas enregistrée.');
  }
}

/** Supprime la fiche enregistrée (demande du propriétaire), après confirmation ; on revient à la liste des personnages. */
async function supprimer() {
  if (!id) return;
  if (!confirm(`Supprimer définitivement « ${fiche.nom || 'ce prétiré'} » ? La fiche ne pourra pas être récupérée (téléchargez-la d’abord pour en garder une copie).`)) return;
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
    etatDesBoutons();
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
  enregistrementRefuse = false;
  history.replaceState(null, '', racine.dataset.fiche);
  rafraichir();
  message('', '');
}

// ------------------------------------------------------------------ export et import (classeur, Google Sheets)
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
 * trop long pour sa case y est coupé, la suite de sa part relue dans la note), le portrait cadré à la place du logo (la vignette de la page, JPEG),
 * marqué « portrait:<empreinte de l'image d'origine> » pour qu'un import du fichier dans ce prétiré garde l'image d'origine et son cadrage ; sans
 * portrait, le logo du modèle, marqué « logo ». { octets, nom (le nom du personnage : nomDuFichier), avertissements } : ce qui ne tient pas dans une
 * case de tableur (notes de plus de 32 767 caractères…), que le message dit (messageDExport). « Télécharger » et « Exporter » en font le même fichier.
 */
async function classeurDeLaFiche() {
  const f = aEnvoyer();
  const { cellules, remplis, alignements, avertissements } = cellulesDeLaFiche(regles, f, { date: aujourdhui(), zones: await zonesDesCases() });
  let image = null;
  let descriptionImage = 'logo';
  if (fiche.portrait) {
    const octets = octetsDuPortrait(await dessinerVignette(fiche.portrait, cadrageDuPortrait()));
    if (octets) {
      image = { octets, type: 'image/jpeg' };
      descriptionImage = `portrait:${empreinte(fiche.portrait)}`;
    }
  }
  const octets = await ecrireXlsx(await octetsDuModele(), { cellules, remplis, alignements, image, descriptionImage, titre: f.nom || 'Personnage', date: new Date() });
  return { octets, nom: nomDuFichier(f.nom), avertissements };
}

/** Exécute une action de la barre (téléchargement, export, import en ligne) : Télécharger, Exporter et Importer (en ligne) attendent sa fin. */
async function pendant(action) {
  occupe = true;
  etatDesBoutons();
  try {
    return await action();
  } finally {
    occupe = false;
    etatDesBoutons();
  }
}

/** « Télécharger » : le classeur, nommé d'après le personnage (demande du propriétaire, 2026-10-15 : « Le nom du fichier deviens juste nom du personnage »). */
function telechargerClasseur() {
  return pendant(async () => {
    message('Préparation du classeur…', 'attente');
    try {
      const { octets, nom, avertissements } = await classeurDeLaFiche();
      telecharger(new Blob([octets], { type: TYPE_XLSX }), `${nom}.xlsx`);
      // ce que le classeur n'a pas pu garder (une case de tableur : 32 767 caractères au plus) est dit, sur le ton « attente »
      const { texte, ton } = messageDExport(avertissements, 'Classeur téléchargé.');
      message(texte, ton);
    } catch (e) {
      message(`Le classeur n’a pas pu être préparé : ${e?.message ?? e}`, 'erreur');
    }
  });
}

// « Exporter » (demande du propriétaire, 2026-10-15 : « Exporte sous le format Google Sheet » ; précision choisie : « Créer un Google Sheet en ligne ») :
// la page se connecte à Google (Google Identity Services, droit drive.file : le site ne voit que les fichiers qu'il crée) et envoie le classeur de
// « Télécharger » à l'API Drive, qui en fait une nouvelle feuille Google Sheets à chaque export. Le script de Google est chargé à la demande
// (document.createElement : ni balise dans le HTML ni import, que la version portable refuse), dès que le pointeur ou le focus approche du bouton ;
// la fenêtre de connexion doit s'ouvrir dans le clic même (requestAccessToken sans attente avant lui), sinon le navigateur la bloque. Le jeton reste
// en mémoire (jamais enregistré, jamais envoyé au service) jusqu'à son expiration.
let chargementGoogle = null;
let clientDeJetons = null;
let jetonGoogle = null;

/** Charge Google Identity Services une fois et prépare le client de jetons ; un échec se retente au prochain appel. */
function chargerGoogle() {
  if (!chargementGoogle) {
    chargementGoogle = new Promise((ok, ko) => {
      const script = document.createElement('script');
      script.src = SCRIPT_GOOGLE;
      script.async = true;
      script.onload = () => ok();
      script.onerror = () => {
        script.remove();
        ko(new Error('le service de connexion de Google n’a pas pu être chargé'));
      };
      document.head.append(script);
    }).then(() => {
      clientDeJetons = globalThis.google.accounts.oauth2.initTokenClient({
        client_id: $('fiche-exporter').dataset.clientGoogle,
        scope: PORTEE_DRIVE,
        callback: recevoirJeton,
        error_callback: erreurDeConnexion,
      });
    });
    chargementGoogle.catch(() => { chargementGoogle = null; });
  }
  return chargementGoogle;
}

/** La réponse de la connexion à Google : le jeton, gardé en mémoire jusqu'à une minute avant son expiration, puis l'envoi. */
function recevoirJeton(reponse) {
  if (reponse?.error) {
    message(reponse.error === 'access_denied' ? 'Export annulé : Google n’a pas reçu l’autorisation.' : `Connexion à Google refusée (${reponse.error}).`, 'erreur');
    return;
  }
  if (!globalThis.google.accounts.oauth2.hasGrantedAllScopes(reponse, PORTEE_DRIVE)) {
    message('Export annulé : l’accès à Google Drive n’a pas été accordé (il sert à y créer la feuille).', 'erreur');
    return;
  }
  jetonGoogle = { valeur: reponse.access_token, expire: Date.now() + (Number(reponse.expires_in) || 3600) * 1000 - 60_000 };
  envoyerAGoogle(jetonGoogle.valeur);
}

/** La fenêtre de connexion de Google bloquée ou fermée. */
function erreurDeConnexion(e) {
  if (e?.type === 'popup_failed_to_open') message('La fenêtre de connexion de Google a été bloquée : cliquez de nouveau sur « Exporter » (ou autorisez les fenêtres de ce site).', 'erreur');
  else if (e?.type === 'popup_closed') message('Export annulé : la fenêtre de connexion de Google a été fermée.', 'attente');
  else message(`Connexion à Google impossible : ${e?.message ?? e?.type ?? e}`, 'erreur');
}

/** « Exporter » : un jeton encore valable → l'envoi ; sinon la fenêtre de connexion de Google, ouverte dans le clic (aucune attente avant elle). */
function exporterVersGoogle() {
  if (jetonGoogle && Date.now() < jetonGoogle.expire) {
    envoyerAGoogle(jetonGoogle.valeur);
    return;
  }
  if (clientDeJetons) {
    clientDeJetons.requestAccessToken();
    return;
  }
  // le script de Google n'était pas encore là (aucun survol avant le clic) : la fenêtre s'ouvre après son chargement, si le navigateur le permet
  message('Connexion à Google…', 'attente');
  chargerGoogle().then(() => clientDeJetons.requestAccessToken(), (e) => message(`Export impossible : ${e?.message ?? e}`, 'erreur'));
}

/** Envoie le classeur à Google Drive, converti en feuille Google Sheets ; le message donne son lien (une fenêtre s'ouvre si le navigateur le permet). */
function envoyerAGoogle(jeton) {
  return pendant(async () => {
    message('Envoi vers Google Sheets…', 'attente');
    try {
      const { octets, nom, avertissements } = await classeurDeLaFiche();
      const { type, corps } = corpsMultipart({ nom, octets, frontiere: `maverick-${crypto.randomUUID()}` });
      const reponse = await fetch(ADRESSE_D_ENVOI, { method: 'POST', headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': type }, body: corps });
      const donnees = await reponse.json().catch(() => ({}));
      if (reponse.status === 401) {
        jetonGoogle = null;
        message('La connexion à Google a expiré : cliquez de nouveau sur « Exporter ».', 'erreur');
        return;
      }
      if (!reponse.ok) {
        message(`Google a refusé la feuille (HTTP ${reponse.status}${donnees?.error?.message ? ` : ${donnees.error.message}` : ''}).`, 'erreur');
        return;
      }
      const lien = lienDeFeuille(donnees);
      const { texte, ton } = messageDExport(avertissements, 'Feuille Google créée.');
      message(`${texte} Pour la réimporter ici, partagez-la par lien (« Tous les utilisateurs disposant du lien »), puis « Importer (en ligne) ».`, ton);
      if (lien) {
        $('fiche-message').append(' ', el('a', { href: lien, target: '_blank', rel: 'noopener' }, 'Ouvrir dans Google Sheets'));
        window.open(lien, '_blank', 'noopener');   // souvent bloquée (plus dans le clic) : le lien reste dans le message
      }
    } catch (e) {
      message(`La feuille Google n’a pas pu être créée : ${e?.message ?? e}`, 'erreur');
    }
  });
}

/**
 * Où va la fiche d'un fichier importé (« à tout moment ») : un prétiré enregistré est ouvert → le dialogue « import-cible » (le mettre à jour, créer un
 * nouveau prétiré, ou annuler ; la perte des modifications non enregistrées est dite) ; sinon, une confirmation s'il y a des modifications non
 * enregistrées. 'mettre-a-jour' | 'creer' | null (annulé).
 */
function cibleDeLImport() {
  if (!id) return Promise.resolve(!modifie || confirm('Remplacer la fiche en cours par celle du classeur ?') ? 'creer' : null);
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
  // une `progression` d'un fichier d'avant : ses gains en deux totaux (R73) ; une armure par emplacement : l'armure de la fiche, les autres pièces notées
  // (R95) ; des matériaux de bouclier, des accessoires Ceinture ou Autre, un nom ou un effet hors table : notés (R96, R97)
  fiche = { ...ficheVide(''), ...sansPartiesRetirees(nouvelle, { instant: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), noms: nomsDesRetraits() }) };
  versionInventaire += 1;   // une autre fiche : ses lignes d'inventaire sont d'autres objets
  for (const cle of Object.keys(PARTIES_DE_FICHE)) if (!Array.isArray(fiche[cle])) fiche[cle] = [];
  controles = null;
  if (cible === 'creer') {
    id = null;
    version = null;
    enregistrementRefuse = false;   // un autre prétiré, jamais envoyé (une mise à jour du prétiré ouvert garde son identifiant et sa version : le refus reste noté)
    history.replaceState(null, '', racine.dataset.fiche);
  }
  changer();
}

/** « Enregistrez pour mettre à jour « X » » ou « … pour créer le prétiré ». */
const suiteDeLImport = (cible, nom) => `Enregistrez pour ${cible === 'creer' ? 'créer le prétiré' : `mettre à jour « ${nom} »`}.`;

/**
 * Un classeur (.xlsx ; la lecture sait aussi les .ods et .csv) au modèle V15.2.2, ordinateur ou auto (lib/tableur-lecture.mjs, lib/fiche-tableur-import.mjs) : l'onglet « Personnage »,
 * sinon le premier onglet qui suit l'un des deux modèles (feuilleDeLaFiche ; le message le nomme). Ce qui n'a pas de place sur le site (`nonRepris`) et
 * ce que l'import a déduit (`remarques`) s'ajoutent à la fin des notes, sous une ligne datée qui nomme le fichier. Le message « Lecture du classeur… »
 * est retiré avant le dialogue « import-cible ». Portrait (portraitDeLImport) : celui de la fiche ouverte, avec son cadrage, quand le classeur porte son
 * empreinte (exporté par la page avec ce portrait), ou pour une mise à jour depuis un classeur sans image (fiche auto, .csv, export sans portrait) ;
 * sinon l'image ancrée en A1 qui n'est pas le logo du modèle, réduite comme une image choisie (cadrage par défaut) ; un nouveau prétiré tiré d'un
 * classeur sans image n'en a pas.
 */
async function importerClasseur(octets, nomFichier) {
  const date = aujourdhui();
  let lu;
  let classeur;
  let feuille;
  try {
    message('Lecture du classeur…', 'attente');
    classeur = await lireClasseur(octets, { nom: nomFichier });
    feuille = feuilleDeLaFiche(classeur);
    lu = ficheDuClasseur(regles, feuille, {
      nomFichier, date, format: classeur.format, logo: await logoDuModele(), empreintePortrait: fiche.portrait ? empreinte(fiche.portrait) : null,
    });
  } catch (e) {
    message(`Ce classeur n’a pas pu être lu : ${e?.message ?? e}`, 'erreur');
    return;
  }
  message('', '');   // le classeur est lu : rien n'est « en cours » pendant que le dialogue attend la réponse
  const nom = fiche.nom || 'ce prétiré';
  const cible = await cibleDeLImport();
  if (!cible) return;
  const nouvelle = { ...lu.fiche };
  const nonRepris = [...lu.nonRepris];
  const ouverte = { portrait: fiche.portrait ?? null, cible };
  const portraitOuvert = { portrait: fiche.portrait, portrait_x: fiche.portrait_x ?? null, portrait_y: fiche.portrait_y ?? null, portrait_zoom: fiche.portrait_zoom ?? null };
  let portrait = portraitDeLImport(lu, ouverte);
  if (portrait === 'image') {
    try {
      Object.assign(nouvelle, { portrait: await reduireImage(new Blob([lu.image.octets], { type: lu.image.type })), portrait_x: null, portrait_y: null, portrait_zoom: null });
    } catch {
      nonRepris.push(`Portrait du classeur (${lu.image.type || 'image'}) : illisible ou trop lourd pour la fiche`);
      portrait = portraitDeLImport({ ...lu, image: null }, ouverte);
    }
  }
  if (portrait === 'garder') Object.assign(nouvelle, portraitOuvert);
  const lignes = [...nonRepris, ...lu.remarques];
  if (lignes.length) nouvelle.notes = ajouterAuxNotes(nouvelle.notes, [`[${date}] Import du classeur « ${nomFichier} » :`, ...lignes]);
  remplacerLaFiche(nouvelle, cible);
  const debut = messageDImport({ disposition: lu.disposition, format: classeur.format, onglet: feuille.nom, nonRepris: nonRepris.length, remarques: lu.remarques.length });
  message(`${debut} ${suiteDeLImport(cible, nom)}`, 'attente');
}

/** Un fichier choisi par « Importer (PC) » : un classeur (un ancien export .json ne s'importe plus : le message le dit). */
async function importer(fichier) {
  let octets;
  try {
    octets = new Uint8Array(await fichier.arrayBuffer());
  } catch {
    message('Ce fichier n’a pas pu être lu.', 'erreur');
    return;
  }
  if (!estUnZip(octets) && new TextDecoder('utf-8').decode(octets.subarray(0, 64)).replace(/^﻿/, '').trimStart().startsWith('{')) {
    message('Les fiches .json ne s’importent plus : importez un classeur .xlsx (celui de « Télécharger »).', 'erreur');
    return;
  }
  return importerClasseur(octets, fichier.name);
}

/**
 * « Importer (en ligne) » (demande du propriétaire, 2026-10-15 : « Demande l'url d'un Google Sheet » ; précision choisie : « Feuille partagée par
 * lien ») : le service télécharge la feuille au format .xlsx (POST /api/classeur/, serveur/classeur.mjs : Google ne laisse pas une page d'un autre
 * site la lire), puis le même chemin qu'un classeur choisi sur l'ordinateur (importerClasseur : dialogue « import-cible », notes datées).
 */
function importerEnLigne(adresse) {
  return pendant(async () => {
    message('Téléchargement de la feuille Google…', 'attente');
    const horsService = 'Le service du site ne répond pas : dans Google Sheets, « Fichier › Télécharger › Microsoft Excel (.xlsx) », puis « Importer (PC) ».';
    let reponse;
    try {
      reponse = await fetch(`${API}classeur/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: adresse }) });
    } catch {
      message(horsService, 'erreur');
      return;
    }
    if (!reponse.ok) {
      const donnees = await reponse.json().catch(() => null);
      message(donnees?.erreur ?? ([502, 503, 504].includes(reponse.status) ? horsService : `La feuille n’a pas pu être téléchargée (HTTP ${reponse.status}).`), 'erreur');
      return;
    }
    let octets;
    try {
      octets = new Uint8Array(await reponse.arrayBuffer());
    } catch {
      message('La feuille n’a pas pu être téléchargée en entier : réessayez.', 'erreur');
      return;
    }
    await importerClasseur(octets, nomDuClasseur(reponse.headers.get('content-disposition')) ?? 'Google Sheets.xlsx');
  });
}

/** Le dialogue « Importer (en ligne) » : le lien est vérifié avant de fermer (un lien de feuille Google Sheets), puis l'import part. */
function preparerImportEnLigne() {
  const d = $('import-en-ligne');
  const champ = $('import-en-ligne-adresse');
  const erreur = $('import-en-ligne-erreur');
  $('fiche-importer-en-ligne').addEventListener('click', () => {
    erreur.hidden = true;
    d.returnValue = '';
    d.showModal();
    champ.select();
  });
  $('import-en-ligne-formulaire').addEventListener('submit', (ev) => {
    if (ev.submitter?.value !== 'importer' || idDeFeuille(champ.value)) return;
    ev.preventDefault();
    erreur.textContent = 'Lien d’une feuille Google Sheets attendu : https://docs.google.com/spreadsheets/d/…';
    erreur.hidden = false;
    champ.focus();
  });
  champ.addEventListener('input', () => { erreur.hidden = true; });
  d.addEventListener('close', () => {
    if (d.returnValue === 'importer') importerEnLigne(champ.value.trim());
  });
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
  // la ceinture propose tous les objets du sac (liste-ceinture, refaite par construireCeinture) ; le sac, son catalogue (autocompletion)
  racine.append(el('datalist', { id: 'liste-ceinture' }));
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
    else if ('entier' in t.dataset) {
      const v = t.value === '' ? ('videNull' in t.dataset ? null : 0) : entier(t.value);
      // le minimum du champ (min="0" : XP, alignement, bourse, gains de niveau ; la base refuserait un nombre négatif)
      fiche[t.dataset.champ] = v !== null && t instanceof HTMLInputElement && t.min !== '' && Number.isFinite(Number(t.min)) ? Math.max(Number(t.min), v) : v;
    }
    else fiche[t.dataset.champ] = t.value === '' ? null : t.value;
    changer();
  });
  $('fiche-enregistrer').addEventListener('click', enregistrer);
  $('fiche-nouvelle').addEventListener('click', nouvelle);
  $('fiche-telecharger').addEventListener('click', telechargerClasseur);
  const exporter = $('fiche-exporter');
  exporter.addEventListener('click', exporterVersGoogle);
  // le script de Google se charge dès que le geste s'annonce : au clic, la fenêtre de connexion peut s'ouvrir aussitôt
  for (const type of ['pointerenter', 'focus', 'touchstart']) {
    exporter.addEventListener(type, () => { if (exporter.dataset.clientGoogle && !exporter.disabled) chargerGoogle().catch(() => {}); }, { passive: true });
  }
  preparerImportEnLigne();
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
  window.addEventListener('beforeunload', (ev) => {
    if (modifie) ev.preventDefault();
  });

  const demande = new URLSearchParams(location.search).get('id');
  await verifierService();
  if (demande) await charger(demande);
  else rafraichir();
}

demarrer();
