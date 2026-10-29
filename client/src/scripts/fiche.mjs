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
import { controlesParGravite, libelleDuControle } from '../lib/fiche-controles.mjs';
import {
  CHAMP_VERSION, COLONNES_DU_SERVICE, PARTIES_DE_FICHE, ajouterAuxNotes, ficheVide, ligneDeRetrait, nouveauxRetraits, resumeDesRetraits, sansPartiesRetirees,
} from '../lib/fiche-format.mjs';
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
  choisirObjetDeMetier, choixDeMetierValables, classeImposee, classesDe, classesSelonLaMagieInnee, competencesDe, donsAChoisir, donsAcquis, donsDeRace, donsValables,
  durabiliteAEcrire, durabiliteDArme, emplacementsDeSorts, ethnieCompatible, ethnieImposee, ethniesDeLaRace, famillesMaitrisables, inventaireSelonLeMetier, lignesDeSorts, magieAcquiseValable,
  magiesInneesPermises, maitriseDArme, maitriseDesSorts, gainsDeNiveau, niveauGlobal, bornesDuNm, nmDuSort, npmMax, objetChoisi, objetsDuMetier, progressionXp,
  bornesDuMultiplicateur, livreAuPlafond, livresAEnregistrer, livresApresAjout, livresApresChangement, livresApresRetrait, livresDe, multiplicateurDuCout, sortAuNm, sortPourUnLivre, sortsDesLivres, donDePreparation, jetDuSortPrepare, sortPrepare, sortsAEnregistrer, sortsAPreparer, sortsApresLeJet,
  sortsApresChoixDEmplacement, sortsApresPreparation, sortsApresLaSymbiose, nmDuMoment,
  refusClasse, refusMagieAcquise, resistancesDe, sortsParNpm, trouver, ecrireValeurDuMoment, valeursDuMoment,
  armureApresChoix, armuresProposees, partiesApresReglage, partiesDeLArmure, partiesValables, poidsPortableDe, retraitsDeLArmureHorsListe,
  bouclierApresChoix, bouclierDe, catalogueDuSac, defenseDe, degatsRecus, effetDeCompetence, effetsDAccessoireProposes, PARTIE_PAR_DEFAUT, partiesDuCorps, valeurDeCompetenceBornee,
  propositionsDuCatalogue, soliditeDuBouclierAEcrire, typesDeDegats, valeurDEffetDAccessoire,
  acquisApresChoix, acquisApresRepartition, acquisChoixValables, acquisDesDons, magieTireeParLeMj, resistanceApresChoix, resistanceChoixValables, entrainementDe, entrainementsAEnregistrer, batonDuSac, contexteDesSorts, degatsDArmeDuMoment, magiesDesBatons, nomDuBaton, postureDuMoment, sortDuMoment,
  creaturesDuSort, sacrificeDuSort,
  carteDeMaitrise, compteurDeMaitrise, infobulleDeClasse, infobulleDeSpecialite, infobulleDuDonAChoisir, TYPES_DE_DON, groupesDArmesParMaitrise, ligneDeMaitrise, maitriseApresChoix, maitriseChoixValables, maitrisesParFamille, presentationDuCompteurDeMaitrise, sourcesDeMaitrise,
  armeDeLaLigne, armesElementairesProposees, effetDeLArmeElementaire, sortsFerDAutreElement,
} from '../lib/fiche-moteur.mjs';
import { creatureAuNpm, FPVSIA, vautAuNpm } from '../lib/creature-npm.mjs';

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
/**
 * L'armure sortie de la liste par un geste en cours (décision R165 (7), retrait différé jusqu'au choix arrêté : arreterLeChoix) : { groupe } — le
 * contrôle du geste (groupeDuControle : le menu de pastilles, le groupe de boutons radio, la liste ou le champ) —, ou null. Un changement fait par un
 * geste (changer) ne retire pas l'armure : elle reste dans le groupe « Hors de la liste » tant que le geste reste dans son contrôle (l'XP tapée chiffre
 * à chiffre, une liste parcourue aux flèches, des boutons radio, une classe retirée puis remplacée dans le même menu), et revenir au choix d'origine ne
 * retire ni ne note rien.
 */
let armureEnSuspens = null;
/** Un rafraîchissement demandé par un geste de l'utilisateur (changer) : rafraichir ne retire pas l'armure hors de la liste, il la met en suspens. */
let parUnGeste = false;
/** La cible du dernier geste (pointerdown, keydown, focusin : demarrer), d'où vient le groupe d'une armure mise en suspens. */
let derniereCible = null;
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
 * La couleur d'une magie, d'une caractéristique (et de ses compétences), d'une posture, d'un alignement, d'une race, d'une classe, d'un palier de
 * résistance, du Mode Hyper ou du poids d'un bouclier : les classes de la palette du site (lib/palette-css.mjs ; regles.json en donne les noms : `classe`
 * et `classe_2` de chaque magie, `classe` de chaque caractéristique, posture, alignement, race, classe, palier, mode et poids, `race_par_nature`, et `neutre` pour ce qui n'a
 * pas de couleur de règle), jamais une couleur écrite. `teinteDe(x)` : les classes d'un élément sur la couleur de `x` (rien sans `x`) ; `teinte-palette` fait lire à
 * l'élément --couleur et --couleur-texte de sa classe dans les variables de la fiche (--c, --c-texte, --texte-sur-c : styles/fiche/fiche.css).
 */
const teinteDe = (x) => (x ? ['teinte-palette', x.classe] : []);

/** Remplace les classes de la palette d'un élément (`couleur-…` et `teinte-palette`) par `classes`, sans toucher aux autres. */
function poserTeinte(e, classes) {
  for (const c of [...e.classList]) if ((c.startsWith('couleur-') || c === 'teinte-palette') && !classes.includes(c)) e.classList.remove(c);
  for (const c of classes) if (!e.classList.contains(c)) e.classList.add(c);
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
  parUnGeste = true;
  try {
    rafraichir();
  } finally {
    parUnGeste = false;
  }
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
 * rouge. Une pastille choisie que les règles imposent (`verrou()` dit pourquoi) ne se retire pas : le clic est sans effet. `description` : le texte de
 * l'infobulle d'une classe ou d'une spécialité (demande du propriétaire du 2026-10-29 : infobulleDeClasse, infobulleDeSpecialite), sous la raison d'un
 * refus ou d'un verrou ; au survol et au focus du clavier, comme toute infobulle (components/Infobulles.astro).
 */
function pastille({ texte, teinte, choisie, refus = () => null, verrou = () => null, surClic, detail, description = null }) {
  const bouton = el('button', {
    type: 'button',
    // les classes de sa couleur (`teinte` : une magie, une compétence, une race, une classe, ou `regles.neutre`), jamais un style
    class: ['pastille', ...teinteDe(teinte)].join(' '),
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
    // vide : plus d'infobulle (components/Infobulles.astro a déplacé l'attribut : un removeAttribute ne l'efface pas)
    infobulle(bouton, [non || impose, description].filter(Boolean).join('\n\n'));
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
      class: ['choix__pastille', ...teinteDe(c.teinte)].join(' '),
      dataset: { ...(c.refus ? { refus: '' } : {}), ...(c.verrou ? { verrou: '' } : {}) }, title: c.refus || c.verrou || null,
    }, c.nom, c.verrou ? el('small', { class: 'choix__verrou' }, ' · imposée') : null))
    : [el('span', { class: 'choix__vide' }, vide)]));
}

/** Un groupe de pastilles dans la couleur de `teinte` (une race par sa nature, une classe par sa catégorie) : son titre et son point la lisent (--c). */
function groupe(titre, teinte, elements) {
  return el('div', { class: ['groupe-pastilles', ...teinteDe(teinte)].join(' ') },
    el('h4', {}, el('span', { class: 'pastille__point', 'aria-hidden': 'true' }), titre),
    el('ul', { class: 'pastilles' }, elements));
}

// ------------------------------------------------------------------ identité : race, ethnie, alignement
function construireRaces() {
  reconstruire($('races'), 'fixe', () => [['pure', 'Races pures'], ['hybride', 'Races hybrides']].map(([nature, titre]) => {
    const races = regles.races.filter((r) => r.nature === nature);
    return groupe(titre, regles.race_par_nature[nature], races.map((r) => pastille({
      texte: r.nom, teinte: r, choisie: () => fiche.race_id === r.id,
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
  afficherChoix('race', [race && { nom: race.nom, teinte: race }]);
  $('choix-ethnie').toggleAttribute('data-a-choisir', aChoisir('ethnie'));
  afficherChoix('ethnie', [ethnie && {
    // une ethnie n'a pas de couleur à elle : celle de la race choisie, ou la classe neutre sans race
    nom: ethnie.nom, teinte: race ?? regles.neutre,
    refus: ethnie.race_id !== fiche.race_id ? 'ethnie d’une autre race' : ethnieCompatible(ethnie, fiche.magie_innee_id) ? null : 'liée à une autre magie innée',
    verrou: imposee === ethnie.id ? pourquoi() : null,
  }]);
  $('ethnies').dataset.choixCle = 'ethnie';   // sa tuile dans l'infobulle du tiroir des choix (choixEnAttente)
  reconstruire($('ethnies'), `${fiche.race_id}`, () => ethnies.map((e) => pastille({
    texte: e.nom, teinte: race, choisie: () => fiche.ethnie_id === e.id,
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
  // la couleur de son titre dans le guide pour MJ (demande du propriétaire) : la classe de l'alignement (regles.alignements ; celle d'un alignement
  // inconnu, regles.alignement_par_defaut), jamais un style
  poserTeinte(sortie, teinteDe(regles.alignements?.[a.nom] ?? regles.alignement_par_defaut));
  sortie.title = `Loi/Chaos : ${a.loi} ; Bien/Mal : ${a.bien} (5 points d’écart sur un axe pour qu’une tendance l’emporte)`;
}

// ------------------------------------------------------------------ magies et dieux
function construireMagies() {
  reconstruire($('magies-innees'), 'fixe', () => regles.magies.map((m) => pastille({
    texte: m.nom, teinte: m, choisie: () => fiche.magie_innee_id === m.id,
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
    nom: innee.nom, teinte: innee,
    refus: magiesInneesPermises(regles, fiche.race_id).has(innee.id) ? null : 'magie que la race ne permet pas',
  }]);
  afficherChoix('magie-acquise', [acquiseChoisie && {
    nom: acquiseChoisie.nom, teinte: acquiseChoisie, refus: refusMagieAcquise(regles, fiche, acquiseChoisie.id),
  }], 'Aucune');
  reconstruire($('magies-acquises'), 'fixe', () => [
    pastille({ texte: 'Aucune', teinte: regles.neutre, choisie: () => !fiche.magie_acquise_id, surClic: () => { fiche.magie_acquise_id = null; changer(); } }),
    ...regles.magies.map((m) => pastille({
      texte: m.nom, teinte: m, choisie: () => fiche.magie_acquise_id === m.id,
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
 * sous le tableau, les résistances à choisir — de la ligne du tableau de la race (« Au choix parmi les autres » du Drakos orange, décision R124 : une
 * liste des altérations des autres lignes), d'un don qui laisse une magie au choix ou tirée (décision R137 : Ocultomancien « Résilience », Anansi
 * d'Arcane : une liste des magies) ; personnage_resistance_choix ; surlignées et dans le tiroir des choix tant qu'elles ne sont pas faites —, puis les
 * dons qui laissent une autre résistance au choix (pas comptée).
 */
function construireResistances() {
  const { paliers, auChoix, aChoisir: resistancesAChoisir, desactivee } = resistancesDe(regles, fiche);
  const blocDuChoix = $('resistances-a-choisir');
  blocDuChoix.hidden = !resistancesAChoisir.length;
  reconstruire(blocDuChoix, JSON.stringify(resistancesAChoisir.map((c) => [c.source, c.rang, c.options])), () => resistancesAChoisir.map((c) => {
    const li = el('li', { class: 'fiche-champ acquis-choix__ligne', dataset: { choixCle: cleDeChoix.resistance(c.source, c.rang) } });
    // une altération d'état (Drakos orange, R124) ou une magie, choisie ou tirée, et son altération quand le don l'écrit (R137) ; la magie tirée par le
    // MJ qui tient lieu de magie innée pour un don du Flagelleur d'un personnage du Potentiel Illimité (R163)
    const quoi = c.remplaceMagieInnee ? magieTireeParLeMj(c)
      : `+${c.crans} cran de résistance${c.magie ? ` à une magie${c.alteration ? ' et à son altération d’état' : ''}` : ''}`;
    const liste = el('select', {
      'aria-label': `${c.nom} : ${quoi} à choisir`,
      onchange: (ev) => { Object.assign(fiche, resistanceApresChoix(fiche, c.source, c.rang, ev.target.value || null, c.magie)); changer(); },
    }, option('', 'Choisir…'), c.options.map((o) => option(o, trouver(c.magie ? regles.magies : regles.etats, o)?.nom ?? o)));
    li.append(el('span', {}, `${c.nom} : ${quoi}`), liste);
    synchro(() => {
      const fait = resistancesDe(regles, fiche).aChoisir.find((x) => x.source === c.source && x.rang === c.rang);
      poser(liste, fait?.choisi ?? '');
      li.toggleAttribute('data-a-choisir', !fait?.fait);
    });
    return li;
  }));
  const magieDeLEtat = new Map(regles.magies.filter((m) => m.etat_id).map((m) => [m.etat_id, m]));
  const detail = (c) => `${c.nom} : ${c.origines.map((o) => (o.immunite ? `immunisé (${o.nom})` : `${o.nom} ${signe(o.crans)}`)).join(' · ')}`
    + (c.immunite || c.origines.length < 2 ? '' : ` = ${signe(c.crans)}`);
  reconstruire($('resistances'), JSON.stringify(paliers.map((p) => p.cibles.map(detail))), () => paliers.map((p) => el('tr', { class: trouver(regles.resistance_paliers, p.id)?.classe ?? null, dataset: { palier: p.id } },
    el('th', { scope: 'row' }, p.libelle, el('small', {}, p.effet)),
    el('td', {}, p.cibles.length
      ? el('ul', { class: 'resistances__cibles' }, p.cibles.map((c) => {
        const magie = c.type === 'magie' ? trouver(regles.magies, c.id) : magieDeLEtat.get(c.id);
        return el('li', { class: [`resistance resistance--${c.type}`, ...teinteDe(magie)].join(' '), title: detail(c) }, c.nom);
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
    if (!g) groupes.push((g = { ...k.groupe, classe: k.classe, classes: [] }));   // la classe de couleur de la catégorie : celle de ses classes
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
      nom: c.classe.nom, teinte: c.classe, refus: refusClasse(regles, fiche, c.classe.id, rang),
      verrou: rang === 1 && imposee?.id === c.classe.id && magieImposante ? pourquoiImposee(imposee) : null,
    }]);
    const specialite = c.classe?.specialites.find((s) => s.id === c.choix?.specialite_id);
    $(`choix-specialite-${rang}`).hidden = !c.classe?.specialites.length || $(`choix-classe-${rang}`).hidden;
    afficherChoix(`specialite-${rang}`, [specialite && {
      nom: specialite.nom, teinte: c.classe, refus: c.niveau < 10 ? 'au niveau de classe 10' : null,
    }], c.niveau >= 10 ? 'À choisir' : 'Au niveau de classe 10');
    // un choix qui reste à faire est surligné (demande du propriétaire : « mettre en surbrillance le champ à saisir »)
    $(`choix-specialite-${rang}`).toggleAttribute('data-a-choisir', aChoisir('specialite', rang));
    reconstruire($(`classe-${rang}`), 'fixe', () => groupes.map((g) => groupe(g.label, g, g.classes.map((k) => pastille({
      texte: k.nom, teinte: k, choisie: () => choixDe(rang)?.classe_id === k.id, description: infobulleDeClasse(k),
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
      texte: s.nom, teinte: c.classe, detail: s.magique ? 'classe magique' : null, description: infobulleDeSpecialite(c.classe, s),
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
    return el('div', { class: ['carac', ...teinteDe(k)].join(' ') }, el('span', { class: 'carac__nom', title: k.nom }, k.nom), valeur, bonus, base, croix);
  }));

  const budgetC = budgetCompetences(regles, fiche);
  etatBudget($('budget-competences'), budgetC.total, budgetC.attendu, 'Points naturels');
  // un tableau par caractéristique, dans sa couleur (la classe de la caractéristique)
  reconstruire($('competences'), 'fixe', () => regles.caracteristiques.map((k) => el('div', { class: ['competences__groupe', ...teinteDe(k)].join(' ') },
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
    // la caractéristique d'une compétence (sa couleur : sa classe) ; celle d'une compétence inconnue : la classe par défaut de la famille
    const caracDe = (id) => trouver(regles.caracteristiques, competence(id)?.caracteristique_id) ?? regles.caracteristique_par_defaut;
    const valeur = (b) => `${signe(entier(b.valeur))}${b.unite ?? ''}`;
    const ATTRIBUTS = { initiative: 'à l’initiative', vitesse: 'à la vitesse', vitesse_nage: 'à la vitesse de nage' };
    const nomDeCible = (o) => ATTRIBUTS[o.attribut] ?? competence(o.competence_id)?.nom ?? o.competence_id;
    const lignesDeBonus = rangs.map((b) => {
      if (b.aChoisir) {
        const li = el('li', { class: 'metier-fiche__choix', dataset: { choixCle: cleDeChoix.metierBonus(b.rang) } }, el('strong', {}, `${valeur(b)} au choix `),
          el('ul', { class: 'pastilles pastilles--etroites' }, b.options.filter((o) => o.competence_id).map((o) => {
            return pastille({
              texte: competence(o.competence_id)?.nom ?? o.competence_id, teinte: caracDe(o.competence_id),
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
          texte: o.texte, teinte: regles.neutre, choisie: () => objetChoisi(fiche, r) === i,
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
 * Maîtrises d'armes, dans leur bloc du panneau « Choix » de la zone IV, donc aussi dans son tiroir (demande du propriétaire du 2026-10-23) ; décision
 * R148, variante A de la maquette retenue par le propriétaire, « Bloc des sources » : « tous les choix dans le bloc Maîtrises, une carte par source, à
 * côté du tableau calculé par famille ». Une carte par source (lignes des classes prises, dons acquis, accessoire
 * « Un point de maîtrise d'arme » : sourcesDeMaitrise) : son titre, son texte tel qu'écrit, la famille imposée, la famille suivie ou retirée (R151), un
 * sélecteur par point à choisir (maitriseApresChoix ; une famille à la limite écrite de la source n'y est plus proposée, R150 ; l'accessoire : sa famille,
 * la même que sous les accessoires) et son état, en mots (carteDeMaitrise). À côté, le tableau calculé des familles maîtrisables (maitrisesParFamille :
 * points, dés, d'où ils viennent ; l'excédent au-delà du plafond signalé sur sa ligne, R149 ; jamais ARME DE MONSTRES, R45 ; le Pugilat au dé de la Force,
 * deDeLaFamille) : rien ne s'y saisit. Dans le coin, « N points · M à choisir » (compteurDeMaitrise). Pas de points du MJ (R148) ; rien de calculé
 * n'est enregistré. Un point à choisir est surligné et passe dans la liste du tiroir (nature `maitrise`, sa tuile par `data-choix-cle`).
 */
function construireMaitrises() {
  const { sources } = calcul.maitrises;
  const compteur = presentationDuCompteurDeMaitrise(calcul.maitrises.compteur, sources);
  const badge = $('budget-maitrises');
  if (badge.textContent !== compteur.texte) badge.textContent = compteur.texte;
  attribut(badge, 'data-etat', compteur.etat);
  infobulle(badge, compteur.infobulle);
  const m = maitriseDArme(regles);
  const legende = `${m.desSansMaitrise} dé sans maîtrise, un de plus par point ; ${m.pointsMax} points comptés au plus par famille (${m.desMax} dés). Rien ne se saisit ici : tout vient des sources.`;
  if ($('maitrises-legende').textContent !== legende) $('maitrises-legende').textContent = legende;
  // la carte est refaite quand ses sources changent (une classe, un niveau, un don, un accessoire) ; un choix de famille ne la refait pas (le focus reste)
  const cle = JSON.stringify(sources.map((s) => [s.source, s.titre, s.texte, s.parts.map((p) => [p.genre, p.points, p.choisis?.length ?? 0])]));
  reconstruire($('maitrises-sources'), cle, () => (sources.length
    ? sources.map(carteDeMaitriseDeLaPage)
    : el('li', { class: 'maitrises-sources__vide' }, 'Choisissez une classe : ses lignes de maîtrise et celles de ses dons apparaissent ici.')));
  reconstruire($('maitrises-familles'), 'fixe', () => famillesMaitrisables(regles).map(ligneDeFamilleDeLaPage));
}

/** La famille `familleId` (null : retirée) pour le point `rang` de la source `s` : dans maitrise_choix, ou sur l'accessoire (son arme_famille_id, R151). */
function choisirLaMaitrise(s, rang, familleId) {
  if (s.type === 'accessoire') {
    const a = (fiche.accessoires ?? []).find((x) => x.emplacement === s.emplacement);
    if (a) a.arme_famille_id = familleId;
  } else Object.assign(fiche, maitriseApresChoix(fiche, s.source, rang, familleId));
  changer();
}

let numeroDeMaitrise = 0;
/** La carte d'une source (carteDeMaitrise), relue à chaque rafraîchissement dans calcul.maitrises. */
function carteDeMaitriseDeLaPage(s) {
  const actuelle = () => calcul.maitrises.sources.find((x) => x.source === s.source) ?? s;
  const carte = carteDeMaitrise(regles, s);
  const etat = el('span', { class: 'maitrise-source__etat' });
  const lignes = carte.lignes.map((l, i) => {
    const ligneActuelle = () => carteDeMaitrise(regles, actuelle()).lignes[i] ?? l;
    const points = el('span', { class: 'maitrise-part__points' }, l.points);
    if (l.genre === 'imposee') {
      return el('li', { class: 'maitrise-part' }, points, el('span', { class: 'maitrise-part__famille' }, l.famille), el('span', { class: 'maitrise-marque', title: 'Écrite dans le texte' }, l.marque));
    }
    if (l.genre === 'suit') {
      // « avec l'arme déterminée avant », le −1 de l'Épéiste (décision R151) : la famille de la maîtrise au choix de la classe, sans sélecteur
      const famille = el('span', { class: 'maitrise-part__famille' });
      const attente = el('p', { class: 'maitrise-part__message', dataset: { ton: 'choisir' } });
      const li = el('li', { class: 'maitrise-part' }, points, famille, el('span', { class: 'maitrise-marque', dataset: l.retrait ? { ton: 'retrait' } : {} }, l.marque), attente);
      synchro(() => {
        const x = ligneActuelle();
        famille.textContent = x.famille ?? '…';
        attente.textContent = x.attente ?? '';
        attente.hidden = !x.attente;
      });
      return li;
    }
    // un point à choisir : ses familles (sans celle qu'une limite écrite ferme, R150), « à choisir » tant qu'il est vide, la limite dépassée en rouge
    numeroDeMaitrise += 1;
    const id = `maitrise-point-${numeroDeMaitrise}`;
    const liste = el('select', {
      id, 'aria-label': `${s.titre} : famille ${l.etiquette === 'Famille' ? 'd’armes' : `du point ${l.rang}`}`,
      onchange: (ev) => choisirLaMaitrise(s, l.rang, ev.target.value || null),
    });
    const marque = el('span', { class: 'maitrise-marque', dataset: { ton: 'choisir' } }, 'à choisir');
    const message = el('p', { class: 'maitrise-part__message', dataset: { ton: 'erreur' }, role: 'alert' });
    const li = el('li', { class: 'maitrise-part', dataset: l.cle ? { choixCle: l.cle } : {} },
      points, el('label', { class: 'maitrise-part__etiquette', for: id }, l.etiquette), liste, marque, message);
    synchro(() => {
      const x = ligneActuelle();
      // les familles proposées, refaites seulement quand elles changent (la liste garde le focus du clavier)
      const options = JSON.stringify(x.options.map((o) => o.id));
      if (liste.dataset.options !== options) {
        liste.dataset.options = options;
        liste.replaceChildren(option('', '— à choisir —'), ...x.options.map((o) => option(o.id, o.nom)));
      }
      poser(liste, x.famille ?? '');
      attribut(liste, 'data-vide', !x.famille);
      attribut(liste, 'data-refus', x.refus);
      attribut(liste, 'aria-invalid', x.refus ? 'true' : null);
      marque.hidden = Boolean(x.famille);
      if (message.textContent !== (x.message ?? '')) message.textContent = x.message ?? '';
      message.hidden = !x.message;
    });
    return li;
  });
  const li = el('li', { class: 'maitrise-source', dataset: { type: s.type } },
    el('div', { class: 'maitrise-source__tete' }, el('strong', { class: 'maitrise-source__titre' }, s.titre), el('span', { class: 'maitrise-source__type' }, carte.sousTitre), etat),
    s.texte ? el('p', { class: 'maitrise-source__texte' }, s.texte) : null,
    el('ul', { class: 'maitrise-parts' }, lignes));
  synchro(() => {
    const x = actuelle();
    const c = carteDeMaitrise(regles, x);
    etat.textContent = c.etat.libelle;
    etat.dataset.etat = c.etat.cle;
    attribut(li, 'data-a-choisir', x.etat === 'a_choisir' || x.etat === 'attente');
    attribut(li, 'data-erreur', x.etat === 'refus');
  });
  return li;
}

/** La ligne d'une famille dans le tableau calculé (maitrisesParFamille, ligneDeMaitrise) : points, dés, sources et alertes. */
function ligneDeFamilleDeLaPage(f) {
  const points = el('td', { class: 'nombre' });
  const des = el('td', { class: 'nombre des' });
  const detail = el('td', { class: 'maitrise-detail' });
  const tr = el('tr', {}, el('th', { scope: 'row' }, f.nom), points, des, detail);
  synchro(() => {
    const m = calcul.maitrises.familles.find((x) => x.famille === f.id);
    if (!m) return;
    const l = ligneDeMaitrise(m);
    points.textContent = String(m.points);
    des.textContent = m.notation;
    infobulle(des, m.force === null ? '' : `${m.de} avec ${m.force} de Force (${f.de_selon_force.map((p) => `${p.de} pour ${p.min === p.max ? p.min : `${p.min} à ${p.max}`}`).join(', ')} de Force)`);
    const cle = JSON.stringify(l);
    if (detail.dataset.cle !== cle) {
      detail.dataset.cle = cle;
      detail.replaceChildren(el('span', {}, l.detail.length ? l.detail.join(' · ') : 'aucune source'),
        ...l.alertes.map((a) => el('span', { class: 'maitrise-alerte', dataset: { ton: a.ton } }, a.texte)));
    }
    attribut(tr, 'data-nul', !m.detail.length);
    // au-delà du plafond : un avertissement, pas une erreur (décision R170)
    attribut(tr, 'data-etat', l.alertes.some((a) => a.ton === 'avertissement') ? 'avertissement' : null);
  });
  return tr;
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
 * Combien de fois le coût d'un sort qui augmente avec l'utilisation (décision R129 : le NPM de la créature invoquée, les dégâts en plus, les tailles, les
 * personnes…), par sort : un réglage du moment, pas un choix de la fiche (il n'est pas enregistré) ; 1 au départ.
 */
const foisDesSorts = new Map();

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
  // le décompte des NM (décision R118) : ceux des sorts sans leurs livres, sur les NM gagnés plus ceux du MJ, notés juste à côté (la limite affichée est
  // celle des NM gagnés : « 9 / 11 + MJ 2 ») ; les NM gagnés sont ceux des niveaux et ceux qu'écrit un don acquis (décision R154 : « Maîtrise » de
  // l'Ocultomancien, +4), détaillés dans l'infobulle
  const badge = $('budget-nm');
  etatBudget(badge, nm.comptes, nm.limite, 'NM');
  badge.textContent = `NM : ${nm.comptes} / ${nm.disponibles}`;
  const gagnes = nm.dons.length ? ` (${nm.niveaux} par les niveaux, ${nm.dons.map((d) => `+${d.nm} ${d.nom}`).join(', ')})` : '';
  // un livre d'un sort qui n'est pas choisi attend (décision R169) : rappelé, sans rien changer au décompte
  const attente = nm.enAttente ? `, ${nm.enAttente} livre${nm.enAttente > 1 ? 's' : ''} en attente (sort non choisi)` : '';
  infobulle(badge, `NM répartis sur les sorts (sans ceux des livres${nm.livres ? ` : ${nm.livres} en plus` : ''}${attente}) / NM gagnés par les niveaux${nm.dons.length ? ' et les dons' : ''}${gagnes}, `
    + `plus ceux du MJ, notés à côté pour toute la fiche${nm.mj ? ` (${nm.disponibles} + ${nm.mj} = ${nm.limite})` : ''} ; ${nm.plafond} NM au plus sur un sort`);

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
          return el('option', { value: s.id, selected: s.id === l.ligne?.sort_id, class: teinteDe(m).join(' ') || null, title: m?.nom }, s.nom);
        };
        const choisi = couleurDe(l.sort);
        const liste = el('select', {
          class: teinteDe(choisi).join(' ') || null, dataset: choisi ? { couleur: '' } : {},
          title: choisi ? `${l.sort.nom} (${choisi.nom}, NPM ${l.sort.niveau})` : null,
          'aria-label': `Sort de l’emplacement ${l.index + 1}`,
          onchange: (ev) => {
            // un autre sort dans l'emplacement : à 0 NM (à 1 avec son livre, R169), sans la préparation de l'ancien (décision R115) ; le livre de
            // l'ancien reste noté, en attente
            fiche.sorts = sortsApresChoixDEmplacement(fiche, l.index, ev.target.value || null);
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
            Object.assign(x, sortAuNm(regles, x, ev.target.value, fiche));
            livresAuPlafond.delete(x);
            changer();
          } });
        const total = el('output', { class: 'curseur__valeur' });
        // le NM d'un livre se note dans l'entraînement (décision R104 : « déplacer la case [livre] du sort, sans changer le calcul ») : rappelé ici
        const livre = el('span', { class: 'nm-livre', tabindex: '0', title: 'Dont 1 NM d’un livre de sort (noté dans l’entraînement), qui ne compte pas dans le décompte' }, 'livre');
        // coût, portée, zone, D/S/B et effet à la valeur du NM du sort, sans « (+1/NM) » (demande du propriétaire ; valeurAuNm) ; l'indication IC (et
        // imparable, inesquivable) au NM du sort, une condition pas encore atteinte (« IC pour 3 NM ») en grisé (modesAuNm)
        const modes = el('td', { class: 'sort-modes' });
        // le coût : le chakra, le coût secondaire dessous (âmes, Sang, « Par tour » : décisions R105, R106) et, pour un coût par unité, combien de fois
        // (« × N » : décision R129, multiplié avant les réductions, borné par bornesDuMultiplicateur : le NPM accessible pour une créature)
        const coutTexte = el('span', { class: 'sort-cout' });
        const multiplicateur = l.sort ? multiplicateurDuCout(l.sort) : null;
        const fois = multiplicateur ? el('input', {
          type: 'number', min: '1', step: '1', inputmode: 'numeric', class: 'sort-fois__nombre',
          'aria-label': `${l.sort.nom} : combien de fois le coût (${multiplicateur.unite})`,
          oninput: (ev) => {
            const bornes = bornesDuMultiplicateur(regles, fiche, l.sort);
            foisDesSorts.set(l.sort.id, Math.min(bornes.max, Math.max(bornes.min, entier(ev.target.value, 1))));
            rafraichir();
          },
          // en quittant le champ, il montre le nombre compté (borné, jamais vide)
          onchange: (ev) => poser(ev.target, foisDesSorts.get(l.sort.id) ?? 1),
        }) : null;
        const champFois = fois ? el('label', { class: 'sort-fois' }, el('span', { 'aria-hidden': 'true' }, '×'), fois) : null;
        const cout = el('td', { class: 'sort-valeur' }, coutTexte,
          l.sort?.cout_secondaire ? el('span', { class: 'sort-cout-secondaire' }, l.sort.cout_secondaire) : null, champFois);
        const portee = el('td', { class: 'sort-valeur' });
        const zone = el('td', { class: 'sort-valeur' });
        const dsb = el('td', { class: 'sort-valeur' });
        const effet = el('span', { class: 'sort-effet__texte' });
        const remarque = l.sort?.remarque
          ? el('span', { class: 'sort-remarque', tabindex: '0', role: 'img', 'aria-label': `Remarque : ${l.sort.remarque}`, title: l.sort.remarque }, '★')
          : null;
        // le sort préparé (décision R115) : marqué, sa posture enregistrée en infobulle (son bloc est sous le tableau)
        const marquePrepare = el('span', { class: 'sort-prepare__marque', tabindex: '0', hidden: true }, 'préparé');
        const classe = [l.enTrop ? 'en-trop' : null, l.sort?.effets ? 'avec-effet' : null].filter(Boolean).join(' ') || null;
        const tr = el('tr', { class: classe },
          el('td', { class: 'nombre muted' }, String(l.index + 1)), el('td', {}, el('span', { class: 'sort-choix' }, liste, remarque, marquePrepare)),
          modes, cout, portee, zone, dsb,
          el('td', { class: 'nm-sort' }, el('span', { class: 'curseur-cellule' }, curseur, total), livre));
        synchro(() => {
          const nm = nmDuSort(fiche.sorts[l.index], fiche);
          // le NM auquel les valeurs se lisent : celui du curseur, plus ceux que les dons donnent au sort préparé (« À l'aise », décision R134 ; au plus 3)
          const nmLu = fiche.sorts[l.index] ? nmDuMoment(regles, fiche, fiche.sorts[l.index], calcul.contexteSorts) : { total: nm.total, detail: [] };
          const auNm = (brut, champ) => (l.sort ? valeurAuNm(brut, l.sort.bonus ?? [], champ, nmLu.total) ?? '' : '');
          // le sort à son moment (décision R102) : coût réduit (dons, bâton ; jamais moins de 1), portée et dégâts ou soins avec les bonus des dons, des
          // accessoires, du bâton, de l'armure élémentaire et de la posture ; chaque valeur changée en gras, son détail en infobulle
          const m = l.sort ? sortDuMoment(regles, fiche, l.sort, {
            cout: auNm(l.sort.cout, 'cout'), portee: auNm(l.sort.portee, 'portee'), dsb: auNm(l.sort.dsb, 'dsb'), effets: auNm(l.sort.effets, 'effets'),
          }, calcul.contexteSorts, { fois: foisDesSorts.get(l.sort.id) ?? 1 }) : null;
          const detail = (base, lignes, fin = []) => [base, ...lignes.map((x) => (x.crans || x.des ? x.nom : x.maximum ? `${x.nom} (${x.valeur})` : `${x.nom} : ${signe(x.valeur)}`)), ...fin].join('\n');
          // en gras la valeur que le moment change ; en infobulle son détail, et ce qui n'est pas compté (la case prend alors le focus : l'infobulle se lit
          // aussi au clavier)
          // (`cible` : ce qui porte le texte, la case elle-même sauf pour le coût, dont la case garde le coût secondaire et le multiplicateur)
          const poserValeur = (td, texte, change, titre, aDire = change, cible = td) => {
            if (cible.textContent !== texte) cible.textContent = texte;
            td.toggleAttribute('data-calcule', Boolean(change));
            infobulle(td, aDire ? titre : '');
            if (aDire) td.tabIndex = 0;
            else td.removeAttribute('tabindex');
          };
          const nonComptes = (colonne) => (m?.nonComptes ?? []).filter((x) => x.cible === colonne)
            .map((x) => `Non compté (${RAISONS_DES_SORTS[x.raison] ?? x.raison}) : ${x.nom} ${signe(x.valeur)}`);
          // un coût en pourcentage du chakra maximum : la valeur calculée (décision R106), son calcul en tête de l'infobulle ; un coût par unité : multiplié,
          // puis réduit (décision R129)
          const calcule = m?.cout.calcule;
          const parUnite = m?.cout.fois;
          const ecrit = parUnite && parUnite.n > 1
            ? `Coût écrit : ${parUnite.base} × ${parUnite.n} (${parUnite.unite}) = ${parUnite.base * parUnite.n}${m.cout.detail.length ? ', réduit ensuite' : ''}${parUnite.economeAuNpm ? ` ; Économe : le NPM de la créature (${parUnite.n})` : ''}`
            : `Coût écrit : ${auNm(l.sort?.cout, 'cout')}`;
          poserValeur(cout, m ? (m.cout.corruption ? `${m.cout.texte} (ou ${m.cout.corruption.valeur} corruption)` : m.cout.texte) : '',
            m && (calcule || parUnite?.n > 1 || m.cout.detail.length || m.cout.corruption?.detail.length > 1),
            m && detail(calcule ? `${calcule.pourcent} % du chakra maximum (${calcule.chakra}) : ${calcule.valeur}${(calcule.chakra * calcule.pourcent) % 100 ? ', arrondi à l\'inférieur' : ''}` : ecrit,
              m.cout.detail, [
                'Jamais moins de 1',
                ...(m.cout.corruption ? [detail('Avec la corruption :', m.cout.corruption.detail, ['Jamais moins de 1'])] : []),
                ...nonComptes('cout'),
              ]), m && (calcule || parUnite?.n > 1 || m.cout.detail.length || m.cout.corruption || nonComptes('cout').length), coutTexte);
          if (fois) {
            // (le champ ne sert qu'à un coût chiffré : pas de « × N » pour un coût « 0 », « N/A » ou « X »)
            champFois.hidden = !parUnite;
            if (parUnite) fois.max = String(parUnite.max);
            if (document.activeElement !== fois) poser(fois, parUnite?.n ?? 1);
          }
          poserValeur(portee, m?.portee.texte ?? '', m && m.portee.detail.length,
            m && detail(`Portée écrite : ${auNm(l.sort.portee, 'portee')}`, m.portee.detail, nonComptes('portee')), m && (m.portee.detail.length || nonComptes('portee').length));
          zone.textContent = auNm(l.sort?.zone, 'zone');
          modes.replaceChildren(...(l.sort ? modesAuNm(l.sort.modes, l.sort.bonus ?? [], nmLu.total) : []).map((m) => el('span', {
            class: 'sort-mode', dataset: { mode: m.mode ?? 'autre', ...(m.atteint ? {} : { attente: '' }) },
            title: m.atteint ? null : `Pas encore : ${nmLu.total} NM sur ce sort`,
          }, m.texte)));
          const autres = nonComptes('dsb');
          const texteDsb = m ? `${m.dsb.texte}${m.dsb.diviseur > 1 ? ` ÷ ${m.dsb.diviseur}` : ''}` : '';
          poserValeur(dsb, texteDsb, m && (m.dsb.detail.length || m.dsb.diviseur > 1),
            m && detail(`Écrit : ${auNm(l.sort.dsb, 'dsb')}`, m.dsb.detail, [
              ...(m.dsb.diviseur > 1 ? [`Posture ${m.posture?.nom} : dégâts infligés ÷ ${m.dsb.diviseur}, avant l’armure`] : []),
              // le sort préparé : à la posture du moment de sa préparation (décision R115)
              ...(m.prepare ? [`Sort préparé : calculé à la posture de sa préparation (${m.posture?.nom ?? 'aucune'})`] : []),
              ...autres, ...m.rappels.map((r) => `${r.nom} : ${r.texte}`),
            ]), m && (m.dsb.detail.length || m.dsb.diviseur > 1 || autres.length || m.rappels.length || m.prepare));
          marquePrepare.hidden = !m?.prepare;
          infobulle(marquePrepare, m?.prepare ? `Sort préparé, à la posture du moment de sa préparation : ${m.posture?.nom ?? 'aucune'}` : '');
          // la magie que la Symbiose désactive (« Une seule magie active ») : ses sorts grisés
          tr.toggleAttribute('data-inactif', Boolean(m?.inactif));
          infobulle(tr, m?.inactif ? `Posture Symbiose : la magie ${m.inactif} est désactivée` : l.enTrop ? 'Au-delà des emplacements du personnage : à retirer' : '');
          // les effets : ceux d'un sort de protection comptent les dégâts bloqués du bâton (« Bloque N dégâts »)
          const texteEffet = m ? m.effets.texte : auNm(l.sort?.effets, 'effets');
          if (effet.textContent !== texteEffet) effet.textContent = texteEffet;
          effet.toggleAttribute('data-calcule', Boolean(m?.effets.detail.length));
          infobulle(effet, m?.effets.detail.length ? detail(`Écrit : ${auNm(l.sort.effets, 'effets')}`, m.effets.detail) : '');
          const bornes = bornesDuNm(regles, fiche.sorts[l.index], fiche);
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
            // les NM que les dons donnent au sort préparé (décision R134) : ses valeurs se lisent à ce NM, sans rien compter dans le décompte
            ...nmLu.detail.map((d) => `Sort préparé : ${signe(d.valeur)} NM (${d.nom}), ses valeurs se lisent à ${nmLu.total} NM ; hors du décompte`),
          ].join('\n'));
          total.textContent = nmLu.total > nm.total ? `${nm.total}+${nmLu.total - nm.total}` : String(nm.total);
          total.toggleAttribute('data-hors', nm.total > calcul.nm.plafond);
        });
        return [
          tr,
          // l'effet secondaire du sort, sur sa propre ligne (demande du propriétaire)
          l.sort?.effets ? el('tr', { class: `sort-effet${l.enTrop ? ' en-trop' : ''}` }, el('td', {}), el('td', { colspan: '7' }, effet)) : null,
          // les créatures d'un sort qui invoque, ou ce que donne l'invocation sacrifiée (décision R130)
          ligneDInvocation(l),
        ];
      })),
  ]);
}

// ------------------------------------------------------------------ invocations (décision R130)
/**
 * La créature choisie sous chaque sort qui invoque ou sacrifie (un réglage du moment, jamais enregistré) : id du sort -> { id de la créature, NPM du sort
 * quand on l'a choisie }.
 */
const creaturesChoisies = new Map();

/** Une créature invoquée à son NPM (lib/creature-npm.mjs) : une carte resserrée, ses valeurs à ce NPM et les capacités qui y valent. */
function carteDInvocation(c, npm) {
  const v = creatureAuNpm(c.donnees, npm);
  const rubrique = (nom, ...contenu) => el('div', { class: 'invocation-carte__rubrique' }, el('dt', {}, nom), el('dd', {}, ...contenu));
  const caracs = el('span', { class: 'invocation-carte__caracs' }, FPVSIA.map((id, k) => {
    const carac = trouver(regles.caracteristiques, id);
    return el('span', { class: ['invocation-carte__carac', ...teinteDe(carac ?? regles.caracteristique_par_defaut)].join(' '), title: carac?.nom },
      `${carac?.lettre ?? id[0].toUpperCase()} ${v.caracteristiques.valeurs[k] ?? '—'}`);
  }));
  const capacites = c.capacites.filter((x) => vautAuNpm(x.npm, npm));
  return el('div', { class: 'invocation-carte' },
    el('p', { class: 'invocation-carte__titre' }, el('strong', {}, c.nom), ` · ${c.bloc}`, c.npm === null ? ` · NPM ${npm}` : ''),
    el('dl', {},
      rubrique('Santé', v.sante),
      v.chakra !== null ? rubrique('Chakra', v.chakra) : null,
      v.barriere !== null ? rubrique('Barrière', v.barriere) : null,
      v.ressources.map((r) => rubrique(r.libelle, r.valeur)),
      v.defense !== null ? rubrique('Défense', v.defense) : null,
      c.vitesse ? rubrique('Vitesse', c.vitesse) : null,
      // les bonus « au niveau N magique » atteints, comptés ; un bonus sur deux caractéristiques (« +1 Force/Agilité ») ne l'est pas : rappelé
      rubrique('F.P.V.S.I.A.', caracs,
        v.caracteristiques.comptes.length ? el('span', { class: 'muted' }, ` (compté : ${v.caracteristiques.comptes.join(', ')})`) : null,
        v.caracteristiques.nonComptes.length ? el('span', { class: 'muted' }, ` (non compté : ${v.caracteristiques.nonComptes.join(', ')})`) : null),
      v.attaques.length ? rubrique('Dégâts', el('ul', {}, v.attaques.map((a) => el('li', {}, a)))) : null,
      capacites.length ? rubrique('Capacités', el('ul', {}, capacites.map((x) => el('li', {}, el('strong', {}, x.nom), x.commune ? el('span', { class: 'muted' }, ' (commune)') : null, ` : ${x.texte}`)))) : null));
}

/**
 * Sous un sort qui invoque (décision R130 : « avoir la liste des invocations possibles », « Toutes, les miennes d'abord ») : ses créatures, celles à la
 * portée du personnage d'abord (creaturesDuSort), et la carte de la créature choisie au NPM du sort, le « × N » de son coût (décision R129 : borné au
 * NPM accessible) ; une marionnette est la créature d'un NPM : la choisir règle le « × N », le changer la change. Sous un sort qui sacrifie une
 * invocation (sacrificeDuSort) : l'effet de la marionnette sacrifiée au NPM du sort (« Manteau noir »), ou toutes les améliorations (« Amélioration
 * cadavérique » : « avoir toutes les améliorations visibles en fonction de l'invocation sacrifiée »). Repliée au départ ; null pour un autre sort.
 */
function ligneDInvocation(l) {
  const sort = l.sort;
  const invoque = sort ? creaturesDuSort(regles, fiche, sort) : null;
  const sacrifice = sort && !invoque ? sacrificeDuSort(regles, sort.id) : null;
  if (!invoque && !sacrifice) return null;
  // le NPM du sort : son « × N » (décision R129), borné
  const npmDuSort = () => {
    const bornes = bornesDuMultiplicateur(regles, fiche, sort);
    return bornes ? Math.min(bornes.max, Math.max(bornes.min, foisDesSorts.get(sort.id) ?? 1)) : 1;
  };
  const magieDuSort = trouver(regles.magies, sort.magie_id);
  const bouton = (c, choisir) => {
    // la couleur de ses magies, de la première à la seconde : la classe de la première, la classe de second rang de la seconde (lib/palette-css.mjs)
    const [m1 = magieDuSort, m2 = m1] = c.magies.map((id) => trouver(regles.magies, id)).filter(Boolean);
    return el('button', {
      type: 'button', class: ['invocation-choix', ...(m1 ? ['invocation-choix--magie', m1.classe, m2.classe_2] : [])].join(' '), 'aria-pressed': 'false',
      title: c.npm === null ? c.bloc : `NPM ${c.npm}`, onclick: choisir,
    }, c.nom, c.npm === null ? null : el('span', { class: 'invocation-choix__npm' }, ` NPM ${c.npm}`));
  };
  // choisir une créature : une marionnette règle aussi le « × N » du sort sur son NPM, s'il est à la portée du personnage
  const choisir = (c) => () => {
    const bornes = bornesDuMultiplicateur(regles, fiche, sort);
    if (c.npm !== null && bornes && c.npm <= bornes.max) foisDesSorts.set(sort.id, c.npm);
    creaturesChoisies.set(sort.id, { id: c.id, npm: npmDuSort() });
    rafraichir();
  };
  // la créature montrée : celle choisie (une marionnette, tant que le « × N » n'a pas changé depuis), sinon la marionnette du NPM du sort, sinon la
  // première à la portée du personnage
  const creatures = invoque ? invoque.invocation.creatures : sacrifice.type === 'effets' ? sacrifice.lignes.map((x) => x.creature) : [];
  const montree = (npm) => {
    const choix = creaturesChoisies.get(sort.id);
    const choisie = choix && creatures.find((c) => c.id === choix.id);
    if (choisie && (choisie.npm === null || choix.npm === npm)) return choisie;
    return creatures.find((c) => c.npm === npm) ?? (invoque ? invoque.miennes[0] ?? creatures[0] : null);
  };
  const boutons = [];
  const groupe = (titre, liste) => (liste.length ? el('div', { class: 'invocations__groupe' }, el('p', { class: 'invocations__titre' }, titre),
    el('div', { class: 'invocations__choix' }, liste.map((c) => {
      const b = bouton(c, choisir(c));
      boutons.push([c, b]);
      return b;
    }))) : null);
  const zone = el('div', { class: 'invocations__carte' });
  let resume;
  let contenu;
  if (invoque) {
    resume = `Créatures invocables : ${invoque.miennes.length} à votre portée sur ${creatures.length}`;
    contenu = [
      groupe('À votre portée', invoque.miennes),
      groupe(invoque.raison === 'npm' ? 'Au-delà de votre NPM' : 'Avec l’aide d’un allié (sa magie)', invoque.autres),
      el('p', { class: 'invocations__aide muted' }, creatures.some((c) => c.npm === null)
        ? 'La carte suit le NPM de la créature, le « × N » du coût.' : 'Une créature par NPM : le « × N » du coût.'),
      zone,
    ];
  } else if (sacrifice.type === 'effets') {
    resume = `Selon l’invocation sacrifiée (${sacrifice.lignes.length})`;
    contenu = [groupe('Invocation sacrifiée', creatures), el('p', { class: 'invocations__aide muted' }, 'Le NPM de l’invocation sacrifiée : le « × N » du coût.'), zone];
  } else {
    resume = `Améliorations selon l’invocation sacrifiée (${sacrifice.lignes.length})`;
    contenu = [el('dl', { class: 'invocations__tableau' }, sacrifice.lignes.map((a) => el('div', {}, el('dt', {}, a.nom), el('dd', {}, a.effet))))];
  }
  if (boutons.length) {
    synchro(() => {
      const npm = npmDuSort();
      const c = montree(npm);
      for (const [x, b] of boutons) attribut(b, 'aria-pressed', String(x === c));
      const cle = `${c?.id ?? ''}|${npm}`;
      if (zone.dataset.cle === cle) return;
      zone.dataset.cle = cle;
      const effet = sacrifice && c ? sacrifice.lignes.find((x) => x.creature === c) : null;
      zone.replaceChildren(...(!c ? [] : effet
        ? [el('p', { class: 'invocations__effet' }, el('strong', {}, `${c.nom} (NPM ${c.npm}) — ${effet.libelle}`), el('br'), effet.texte)]
        : [carteDInvocation(c, c.npm ?? npm)]));
    });
  }
  return el('tr', { class: `sort-invocations${l.enTrop ? ' en-trop' : ''}` }, el('td', {}),
    el('td', { colspan: '7' }, el('details', { class: 'invocations' }, el('summary', {}, resume), contenu)));
}

// ------------------------------------------------------------------ sort préparé (décision R115)
/**
 * Le sort préparé (décision R115, présentation validée par le propriétaire le 2026-10-18 : « un bloc « Sort préparé » avec « Préparation » ou « Chargement »,
 * un seul sort d'attaque de niveau 1 ou 2, le jet de magie (le D100), la posture du moment enregistrée, « Lâcher le sort » ») : caché sans l'un de ces dons
 * (donDePreparation) ; l'aide dit qu'il n'y en a qu'un, pour tout type d'attaque (décision R136), perdu en Symbiose d'une autre magie (R135 :
 * sortsApresLaSymbiose, à chaque rafraîchissement) ; la liste ne propose que les sorts de la fiche que le don autorise (sortsAPreparer). Choisir un sort le prépare à la posture cochée à
 * cet instant, qu'on voit à côté ; le jet de magie se note ensuite (« si réussi » : il peut rester vide) ; « Lâcher le sort » remet tout à zéro. Ses dégâts,
 * dans le tableau des sorts, se calculent à la posture enregistrée (sortDuMoment).
 */
function construireSortPrepare() {
  const don = donDePreparation(regles, fiche);
  $('sort-prepare-bloc').hidden = !don;
  if (!don) {
    reconstruire($('sort-prepare'), '', () => []);
    return;
  }
  const noms = don.dons.map((x) => `« ${x.don.nom} » (${x.classe.nom})`).join(' et ');
  const aide = $('sort-prepare-aide');
  // un seul sort préparé à la fois, pour n'importe quel type d'attaque (décision R136 : « Un seul sort préparé à la fois. Il comptera juste pour n'importe
  // quel type d'attaque »), même avec les deux dons ; perdu en Symbiose avec une autre magie que la sienne (décision R135)
  const texteAide = `${noms} : ${don.dons.map((x) => x.don.effet).join(' ')} Un seul sort préparé à la fois, utilisable pour n’importe quel type `
    + 'd’attaque, de contact ou à distance ; en posture Symbiose avec une autre magie que la sienne, il est perdu.';
  if (aide.textContent !== texteAide) aide.textContent = texteAide;
  const choix = sortsAPreparer(regles, fiche, don);
  const cle = JSON.stringify([choix.map((x) => x.sort.id), don.dons.map((x) => x.don.id)]);
  reconstruire($('sort-prepare'), cle, () => {
    const couleurDe = (s) => trouver(regles.magies, s?.magie_id);
    const liste = el('select', {
      'aria-label': 'Sort préparé', disabled: !choix.length,
      onchange: (ev) => { fiche.sorts = sortsApresPreparation(regles, fiche, ev.target.value || null); changer(); },
    }, el('option', { value: '', class: 'option-vide' }, choix.length ? '— aucun —' : `— aucun sort ${don.types.includes('attaque') ? 'd’attaque ' : ''}de NPM ${don.niveaux.join(' ou ')} dans la fiche —`),
    choix.map((x) => {
      const m = couleurDe(x.sort);
      return el('option', { value: x.sort.id, class: teinteDe(m).join(' ') || null, title: m?.nom }, `${x.sort.nom} (NPM ${x.sort.niveau})`);
    }));
    const jet = el('input', {
      type: 'number', min: String(jetDuSortPrepare(regles).min), max: String(jetDuSortPrepare(regles).max), step: '1', inputmode: 'numeric', class: 'sort-prepare__jet',
      'aria-label': 'Jet de magie du sort préparé (D100, facultatif)', placeholder: 'D100',
      onchange: (ev) => { fiche.sorts = sortsApresLeJet(regles, fiche, ev.target.value); changer(); },
    });
    const posture = el('output', { class: 'sort-prepare__posture', 'aria-live': 'polite' });
    const lacher = el('button', { type: 'button', class: 'retirer sort-prepare__lacher', onclick: () => { fiche.sorts = sortsApresPreparation(regles, fiche, null); changer(); } }, 'Lâcher le sort');
    synchro(() => {
      const p = sortPrepare(regles, fiche);
      poser(liste, p?.sort.id ?? '');
      // la couleur de la magie du sort, celle de la posture (comme le tableau des sorts et les cases des postures), posées seulement quand elles changent
      const m = couleurDe(p?.sort);
      attribut(liste, 'data-couleur', Boolean(m));
      poserTeinte(liste, teinteDe(m));
      jet.disabled = !p;
      if (document.activeElement !== jet) poser(jet, p?.jet ?? '');
      const texte = p ? (p.posture?.nom ?? 'aucune') : '—';
      if (posture.textContent !== texte) posture.textContent = texte;
      attribut(posture, 'data-couleur', Boolean(p?.posture));
      poserTeinte(posture, teinteDe(p?.posture));
      infobulle(posture, p ? 'La posture du moment où le sort a été préparé : ses dégâts se calculent à elle, même si la posture change ensuite (décision R115)' : '');
      lacher.disabled = !p;
    });
    return [
      el('label', { class: 'fiche-champ sort-prepare__sort' }, el('span', {}, 'Sort'), liste),
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Jet de magie (D100)'), jet),
      el('span', { class: 'fiche-champ' }, el('span', {}, 'Posture à la préparation'), posture),
      lacher,
    ];
  });
}

// ------------------------------------------------------------------ entraînement (décision R104)
/**
 * L'entraînement (demande du propriétaire : « Il faudrai remplacer le texte des "Entraînement" par des lignes qu'on peut ajouter (+) et remplir soit par
 * "entrainement compétence : une compétence donnée avec un slider de 0 à 10, qui s'ajoute aux Aquis. […] Soit par un livre de compétence et lister le
 * sort associé (et du coup déplacer la case [livre] du sort, sans changer le calcul. Soit un texte libre pour les "dons évènementiels". ») : une ligne
 * par compétence entraînée (curseur de 0 à entrainement.bonus_max_pct), par livre lu (un livre par sort, fiche.livres_sorts : décision R169) et par
 * texte ; trois boutons en ajoutent. Dans son onglet « Entraînement » de la zone IV, à côté de « Choix » (demande du propriétaire du 2026-10-29).
 */
function construireEntrainement() {
  const e = entrainementDe(regles, fiche);
  const livres = livresDe(regles, fiche);
  // (versionInventaire : une fiche relue ou rechargée a d'autres objets, auxquels chaque ligne doit se lier de nouveau)
  const cle = JSON.stringify([versionInventaire, e.lignes.map((l) => [l.rang, l.competence_id === null ? 't' : 'c']), livres.map((l) => l.sort_id),
    fiche.magie_innee_id, fiche.magie_acquise_id]);
  const nomDuSort = (id) => trouver(regles.sorts, id)?.nom ?? id;
  // noter le livre d'un sort choisi lui donne son NM (au plus 3), le retirer le lui reprend, sauf le NM compté qu'il avait pris au plafond
  // (sortAvecLivre, décision R118) : déplacer un livre d'un sort à l'autre ne fait perdre aucun NM ; le livre d'un sort non choisi attend (R169). Les
  // lignes des sorts gardent leurs objets (livresAuPlafond les connaît) : seules celles qui changent sont recopiées
  const choisi = (sortId) => (fiche.sorts ?? []).find((y) => y.sort_id === sortId) ?? null;
  const poserLivres = (r) => {
    (fiche.sorts ?? []).forEach((x, i) => { if (r.sorts[i] !== x) Object.assign(x, r.sorts[i]); });
    fiche.livres_sorts = r.livres_sorts;
  };
  const ajouterLivre = (sortId) => {
    const x = choisi(sortId);
    if (x && livreAuPlafond(regles, fiche, x)) livresAuPlafond.add(x);
    poserLivres(livresApresAjout(regles, fiche, sortId));
  };
  const rendre = (sortId) => { const x = choisi(sortId); return Boolean(x) && livresAuPlafond.delete(x); };
  const retirerLivre = (sortId) => poserLivres(livresApresRetrait(regles, fiche, sortId, { rendre: rendre(sortId) }));
  const changerLivre = (ancien, nouveau) => {
    const x = choisi(nouveau);
    const auPlafond = x && livreAuPlafond(regles, fiche, x);
    poserLivres(livresApresChangement(regles, fiche, ancien, nouveau, { rendre: rendre(ancien) }));
    if (auPlafond) livresAuPlafond.add(x);
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
    // les livres de sort (décision R169) : le sort parmi ceux de la magie innée et de la magie acquise, quel que soit le NPM (toutes les magies pour le
    // Potentiel Illimité : sortsDesLivres), choisi ou non, sans ceux qui ont déjà leur livre ; le sort d'une magie perdue reste, à part ; un sort non
    // choisi : « en attente », son NM n'est pas utilisé
    ...livres.map((livre) => {
      const pris = new Set(livres.filter((y) => y.sort_id !== livre.sort_id).map((y) => y.sort_id));
      const possibles = sortsDesLivres(regles, fiche).filter((s) => !pris.has(s.id));
      const parMagie = [...new Set(possibles.map((s) => s.magie_id))].map((m) => [trouver(regles.magies, m), possibles.filter((s) => s.magie_id === m)]);
      const optionDeLivre = (s) => el('option', { value: s.id, selected: s.id === livre.sort_id, class: teinteDe(trouver(regles.magies, s.magie_id)).join(' ') || null },
        `${s.nom} (NPM ${s.niveau})`);
      const actuel = livre.sort ?? { id: livre.sort_id, nom: nomDuSort(livre.sort_id), niveau: '?' };
      const magie = trouver(regles.magies, livre.sort?.magie_id);
      const sort = el('select', { 'aria-label': `Livre de sort : le sort (${nomDuSort(livre.sort_id)})`, class: teinteDe(magie).join(' ') || null,
        onchange: (ev) => { changerLivre(livre.sort_id, ev.target.value); changer(); } },
      parMagie.map(([m, sorts]) => el('optgroup', { label: m?.nom ?? 'Autres' }, sorts.map(optionDeLivre))),
      livre.horsDesMagies ? el('optgroup', { label: 'Hors des magies du personnage' }, optionDeLivre(actuel)) : null);
      const attente = el('span', { class: 'entrainement__attente', tabindex: '0', hidden: true }, 'en attente');
      synchro(() => {
        const l = livresDe(regles, fiche).find((y) => y.sort_id === livre.sort_id);
        attente.hidden = !l?.enAttente;
        infobulle(attente, l?.enAttente ? `${nomDuSort(livre.sort_id)} n’est pas dans la liste des sorts : le NM du livre attend qu’il y soit (décision R169)${l.horsDesMagies ? ' ; ce sort n’est d’aucune magie du personnage' : ''}` : '');
      });
      const retirer_ = el('button', { type: 'button', class: 'retirer', 'aria-label': `Retirer le livre de ${nomDuSort(livre.sort_id)}`,
        onclick: () => { retirerLivre(livre.sort_id); changer(); } }, '✕');
      return el('li', { class: 'entrainement__ligne entrainement__ligne--livre' }, el('span', { class: 'entrainement__type' }, 'Livre'), sort, attente, retirer_);
    }),
  ]);
  // les ajouts : une compétence (la première qui n'est pas encore entraînée), un livre (le premier sort choisi sans livre sous le plafond, sinon le
  // premier sort possible sans livre : sortPourUnLivre), un texte ; ce qui est libre se relit au clic (les boutons ne sont refaits que quand l'un d'eux
  // se grise ou se dégrise)
  const ajouts = $('entrainement-ajouts');
  const libre = () => regles.competences.find((c) => !entrainementDe(regles, fiche).parCompetence.has(c.id)) ?? null;
  const sansLivre = () => sortPourUnLivre(regles, fiche);
  const cleAjouts = JSON.stringify([e.competences >= e.max || !libre(), !sansLivre()]);
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
      el('button', { type: 'button', class: 'ajouter', disabled: !sansLivre(),
        title: !sansLivre() ? (fiche.magie_innee_id ? 'Chaque sort des magies du personnage a déjà son livre' : 'Choisissez une magie : ses sorts peuvent recevoir un livre') : null,
        onclick: () => { const id_ = sansLivre(); if (id_) { ajouterLivre(id_); changer(); } } }, '+ Livre de sort'),
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
  arme_choisie: '« l’arme choisie » : aucune maîtrise d’arme au choix dont la fiche sache lire les armes pour ce don (décision R119 : celle de la classe du don ; un don de race ou une armure n’en a pas)',
  mj: 'à voir avec le MJ (décision R123 : un cas très particulier de la Ruse)',
  sans_artisanat: 'sans métier, pas de compétence d’artisanat (décision R123)',
  inconnue: 'aucune compétence nommée',
  armure_cassee: 'armure cassée (R158)',
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
  // (un choix d'arme : la maîtrise qu'il suit seulement, la liste de ses compétences est refaite en place, sans perdre le focus du clavier)
  const cle = JSON.stringify(choix.map((c) => [c.source, c.rang, c.arme ? ['arme', c.maitrise] : c.options ?? c.parts.map((x) => x.competence_id)]));
  reconstruire($('acquis-choix'), cle, () => choix.map((c) => {
    const li = el('li', { class: 'fiche-champ acquis-choix__ligne', dataset: { choixCle: cleDeChoix.acquis(c.source, c.rang) } });
    if (c.arme) {
      // « de la compétence de l'arme choisie » (décisions R119, R152 « Un seul choix ») : l'arme est la famille choisie pour la maîtrise au choix de la
      // classe du don (dans le bloc Maîtrises), jamais choisie ici ; puis sa compétence, déduite quand ses armes n'en donnent qu'une, au choix sinon (R48 ;
      // Arc : Arc ou Arme légère, R126), gardée d'une famille à l'autre quand la nouvelle l'offre. Sans la maîtrise au choix, le bonus attend.
      const actuel = () => acquisDesDons(regles, fiche).choix.find((x) => x.source === c.source && x.rang === c.rang) ?? c;
      const arme = el('span', { class: 'acquis-choix__arme' });
      const competence = el('select', {
        'aria-label': `${c.nom} : +${c.valeur} %, la compétence de l’arme`,
        onchange: (ev) => { Object.assign(fiche, acquisApresChoix(fiche, c.source, c.rang, ev.target.value || null)); changer(); },
      });
      li.append(el('span', {}, `${c.nom} : +${c.valeur} % de la compétence de l’arme choisie`), el('div', { class: 'acquis-choix__part' }, arme, competence));
      synchro(() => {
        const x = actuel();
        const famille = trouver(regles.familles_armes, x.arme_famille_id);
        arme.textContent = famille
          ? `Arme : ${famille.nom} (maîtrise au choix de ${x.classe})${x.deduite ? ` — ${trouver(regles.competences, x.choisi)?.nom ?? x.choisi}` : ''}`
          : `Choisissez d’abord la maîtrise au choix de ${x.classe} (bloc Maîtrises d’armes).`;
        // les compétences de l'arme, refaites seulement quand elles changent (la liste garde le focus du clavier)
        const options = JSON.stringify(x.options);
        if (competence.dataset.options !== options) {
          competence.dataset.options = options;
          competence.replaceChildren(option('', 'Compétence…'), ...x.options.map((o) => option(o, trouver(regles.competences, o)?.nom ?? o)));
        }
        poser(competence, x.choisi ?? '');
        competence.hidden = x.options.length < 2;
        li.toggleAttribute('data-a-choisir', !x.fait);
      });
      return li;
    }
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

// ------------------------------------------------------------------ rappel des dons (TYPES_DE_DON : lib/fiche-moteur.mjs)

/**
 * Un don de la liste : son niveau (s'il en a un), son nom, son type et sa précision (limite d'usage « 2 fois/combat », telle qu'écrite), son texte, et
 * une aide de la fiche sous le texte (`aide`, AIDE_ANNULE_LES_FAIBLESSES).
 */
function elementDeDon({ niveau = null, nom, type = null, precision = null, texte, aide = null }) {
  return el('li', { class: 'don' },
    el('span', { class: 'don__tete' },
      niveau !== null ? el('span', { class: 'don__niveau' }, `Niv. ${niveau}`) : null,
      el('strong', { class: 'don__nom' }, nom),
      type || precision ? el('span', { class: 'don__type', dataset: type ? { type } : {} }, [TYPES_DE_DON[type] ?? type, precision ? `(${precision})` : null].filter(Boolean).join(' ')) : null),
    texte ? el('span', { class: 'don__texte' }, texte) : null,
    aide ? el('small', { class: 'fiche-aide don__aide' }, aide) : null);
}

/**
 * L'aide à côté d'un don qui annule les faiblesses aux altérations d'état de la magie innée (« ... plus fort ! » du Flagelleur, décision R163 : « Le texte
 * d'aide pour les faiblesses que la fiche ne connaît pas ? » : « Oui, à appliquer par le MJ ») : la fiche ne retire que les crans qu'elle compte.
 */
const AIDE_ANNULE_LES_FAIBLESSES = 'La fiche retire les faiblesses qu’elle connaît ; le MJ annule aussi en jeu celles qu’elle ne connaît pas (sorts ennemis, météo, armure, états en jeu).';
const aideDuDon = (d) => ((d.resistances?.effets ?? []).some((e) => e.annule) ? AIDE_ANNULE_LES_FAIBLESSES : null);

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
    : classes.map((c) => el('div', { class: ['dons-classe', ...teinteDe(c.classe)].join(' ') },
      el('h4', {}, `${c.classe.nom} · niveau ${c.niveau}`),
      c.dons.length
        ? el('ul', { class: 'dons-liste' }, c.dons.map((d) => elementDeDon({ niveau: d.niveau, nom: d.nom, type: d.type, precision: d.precision, texte: d.effet, aide: aideDuDon(d) })))
        : el('p', { class: 'fiche-aide' }, 'Pas encore de don à ce niveau de classe.')))));
}

// ------------------------------------------------------------------ attributs et valeurs du moment
const NOMS_DU_DETAIL = { classes: 'classes', race: 'race', magies: 'magies', ethnie: 'ethnie', accessoires: 'accessoires', niveaux: 'niveaux', chakra: '½ chakra' };
const detailDe = (d) => Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${NOMS_DU_DETAIL[k] ?? k} ${signe(v)}`).join(' · ') || '—';
/**
 * Carte d'une valeur du moment : son nom, la couleur de son attribut (data-a) et le détail de son maximum. La 4ᵉ barre prend la classe de la magie qui
 * la donne (`classe`, de calcul.attributs.quatriemeBarre : Sang ou Nécromancie ; demande du propriétaire du 2026-10-23 : « La 4eme barre doit être de
 * couleur différente en fonction de la magie qui l'utilise (Sang ou nécromancie) »), que fiche.css lit en `--couleur`.
 */
const JAUGES = {
  sante_actuelle: { a: 'sante', nom: () => 'Santé', detail: () => detailDe(calcul.attributs.detail.sante) },
  barriere_actuelle: { a: 'barriere', nom: () => 'Barrière', detail: () => detailDe(calcul.attributs.detail.barriere) },
  chakra_actuel: {
    a: 'chakra', nom: () => 'Chakra',
    detail: (j) => `${detailDe(calcul.attributs.detail.chakra)}${j.reduction ? ` ; ${j.chakra} − ${j.reduction} de corruption` : ''}`,
  },
  barre4_actuelle: {
    a: 'barre4', nom: () => calcul.attributs.quatriemeBarre?.ressource ?? '4ᵉ barre', detail: () => '4ᵉ barre, de la magie',
    classe: () => calcul.attributs.quatriemeBarre?.classe ?? null,
  },
  corruption: { a: 'corruption', nom: () => 'Corruption', detail: () => 'Au plus le chakra ; elle en prend la place' },
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
  const carte = el('div', { class: 'attribut attribut--jauge', dataset: { a: def.a } },
    el('span', { class: 'attribut__tete' }, nom, valeur), el('span', { class: 'attribut__curseur' }, moins, curseur, plus), ajout);
  // la classe de la magie de la 4ᵉ barre, reposée à chaque calcul : la carte n'est pas reconstruite quand la magie innée passe du Sang à la Nécromancie
  if (def.classe) synchro(() => poserTeinte(carte, [def.classe()].filter(Boolean)));
  return carte;
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
      type: 'button', class: ['posture-carte', ...teinteDe(p)].join(' '), 'aria-pressed': 'false',
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
    // leur couleur : la classe du mode (regles.mode_hyper.classe, .cent.classe : lib/palette-css.mjs, famille `mode`), comme une posture
    hyper?.debloque ? el('div', { class: ['posture-carte', 'posture-carte--hyper', ...teinteDe(regles.mode_hyper)].join(' ') },
      el('span', { class: 'posture-carte__nom' }, 'Mode Hyper', el('small', {}, ` · dès le niveau ${hyper.niveau}`)),
      el('ul', { class: 'posture-carte__effets' }, hyper.effets.map((e) => el('li', {}, e)),
        hyper.magies.map((m) => el('li', { class: `posture-carte__magie ${m.magie.classe}` }, el('strong', {}, `${m.magie.nom} : `), m.effet)),
        hyper.race ? el('li', { class: 'posture-carte__race' }, el('strong', {}, `${hyper.race.nom ?? 'Race'} : `), hyper.race.effet) : null,
        // accessoire « +1 tour de Mode Hyper (100% exclu) » (décision R54)
        hyper.toursAccessoires ? el('li', {}, el('strong', {}, 'Accessoires : '), `${signe(hyper.toursAccessoires)} tour${Math.abs(hyper.toursAccessoires) > 1 ? 's' : ''} (pas le Mode Hyper 100 %)`) : null)) : null,
    hyper?.cent.debloque ? el('div', { class: ['posture-carte', 'posture-carte--hyper', 'posture-carte--cent', ...teinteDe(regles.mode_hyper.cent)].join(' ') },
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
    const cadre = groupe(`Spécialité · ${c.classe.nom}`, c.classe, c.classe.specialites.map((s) => pastille({
      texte: s.nom, teinte: c.classe, detail: s.magique ? 'classe magique' : null, description: infobulleDeSpecialite(c.classe, s),
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
 * poignée (le survol le rouvre), « Aller aux choix » descend à la zone IV, ouvre l'onglet et lui donne le focus (allerAuxChoix). Réduit, son corps est en
 * `display: none` (fiche.css) : le focus clavier n'y entre pas ; le focus déjà dans le corps le garde ouvert. Au clavier, on passe par « Déplier »,
 * « Aller aux choix » ou la bulle d'un choix du tiroir (bulleDeChoix) : le focus sur le choix montre sa tuile, Entrée met le focus dans la bulle (sauf
 * l'ethnie, un bouton qui ouvre son menu, sans bulle). Un choix gardé d'un calcul à l'autre garde son élément (le déclencheur de sa bulle ouverte),
 * seul son texte suit. Le tiroir rangé au défilement alors que le focus y est : le focus va sur l'onglet « Choix » (focusApresRangement).
 */
let zoneParametresVisible = false;
/**
 * La zone IV est-elle à l'écran, d'après un lot d'entrées de l'IntersectionObserver ? La dernière fait foi : deux changements rapprochés (un Tab qui fait
 * remonter puis redescendre la page en quelques millisecondes) arrivent dans un même lot, du plus ancien au plus récent ; lire la première laissait le
 * tiroir sorti sur une zone IV à l'écran (arbitrage, carte blanche du propriétaire).
 */
function zoneAEcran(entrees) {
  return entrees[entrees.length - 1].isIntersecting;
}
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
  const liste = $('choix-attente');
  const avant = [...liste.children].map((li) => li.dataset.choix);
  // le focus dans la bulle, mis là au clavier : où il va une fois le choix recalculé (suivreLeChoixAuClavier)
  const bulle = document.getElementById('bulle-choix');
  const auClavier = bulleAuClavier && bulle && !bulle.hidden && bulle.contains(document.activeElement) ? bulle.dataset.choix : null;
  const champ = auClavier ? [...bulle.querySelectorAll(CHAMPS_DE_TUILE)].indexOf(document.activeElement) : -1;
  // le focus dans le tiroir (un choix, « Réduire », « Aller aux choix ») ou dans la bulle d'un choix, avant que le tiroir ne se range (focusApresRangement)
  const focusAvant = document.activeElement;
  const etaitTiroir = panneau.classList.contains('est-tiroir');
  const focusDansLaBulle = Boolean(bulle && !bulle.hidden && bulle.contains(focusAvant));
  const focusDansLeTiroir = etaitTiroir && (panneau.contains(focusAvant) || focusDansLaBulle);
  // au survol (ou au focus) d'un choix, sa tuile dans une infobulle (demande du propriétaire ; bulleDeChoix)
  const elements = new Map([...liste.children].map((li) => [li.dataset.choix, li]));
  const voulus = identitesDesChoix(attente).map((choix, i) => {
    const li = elements.get(choix) ?? elementDeChoix(attente[i], choix);
    mettreAJourLeChoix(li, attente[i]);
    return li;
  });
  if (voulus.length !== liste.children.length || voulus.some((li, i) => liste.children[i] !== li)) liste.replaceChildren(...voulus);
  if (bulle && !bulle.hidden) {
    // au clavier, la bulle suit son choix (les points d'une même maîtrise, l'un après l'autre) ; à la souris, elle garde sa tuile
    const li = auClavier ? voulus.find((x) => x.dataset.choix === auClavier) : null;
    remplirBulleDeChoix(li?.dataset.cle ?? bulle.dataset.cle, li?.textContent ?? attente.find((c) => c.cle === bulle.dataset.cle)?.libelle, li?.dataset.choix);
  }
  const tiroir = attente.length > 0 && !zoneParametresVisible;
  panneau.classList.toggle('est-tiroir', tiroir);
  panneau.toggleAttribute('data-reduit', tiroir && tiroirReduit);
  $('choix-aller').hidden = !tiroir;
  $('choix-reduire').hidden = !tiroir;
  $('choix-reduire').textContent = tiroirReduit ? 'Déplier' : 'Réduire';
  $('choix-reduire').setAttribute('aria-expanded', String(!tiroirReduit));
  if (focusDansLeTiroir) {
    // ce qui tient le focus : le choix d'une bulle (qui se ferme quand il disparaît), sinon l'élément du tiroir lui-même
    const tenu = focusDansLaBulle ? boutonDuChoix(voulus.find((x) => x.dataset.choix === bulle.dataset.choix)) : focusAvant;
    const visible = Boolean(tenu?.isConnected && tenu.getClientRects().length > 0);
    if (focusApresRangement({ focusDansLeTiroir, range: !tiroir, parLeDefilement: attente.length > 0 && zoneParametresVisible, visible }) === 'onglet') {
      $('onglet-choix').focus({ preventScroll: true });
      return;
    }
  }
  if (auClavier) suivreLeChoixAuClavier(auClavier, champ, avant, voulus.map((li) => li.dataset.choix));
}

/**
 * Le tiroir se range au défilement (la zone IV à l'écran) alors que le focus y est (un choix, « Réduire », « Aller aux choix », un champ de la bulle d'un
 * choix) : le focus tomberait sur la page. Arbitrage (carte blanche du propriétaire) : il va sur l'onglet « Choix » (`#onglet-choix`, sans défilement ni
 * changement de l'onglet actif), sauf si ce qui le tient reste à l'écran (le panneau « Choix » ouvert : le choix y est encore). Jamais quand il n'était
 * pas dans le tiroir, ni quand le tiroir disparaît parce qu'il n'y a plus de choix (suivreLeChoixAuClavier, ou la souris : comme avant). Rend 'onglet'
 * ou null.
 */
function focusApresRangement({ focusDansLeTiroir, range, parLeDefilement, visible }) {
  return focusDansLeTiroir && range && parLeDefilement && !visible ? 'onglet' : null;
}

/**
 * L'identité de chaque choix du tiroir, d'un calcul à l'autre : sa nature et sa clé ; pour une maîtrise, sa source seulement (ses points à choisir, l'un
 * après l'autre, sont un même choix en plusieurs parts : « Maîtrise à choisir : <source> (N points) ») ; numérotée quand elle revient (deux lignes d'une
 * même source).
 */
function identitesDesChoix(attente) {
  const vues = new Map();
  return attente.map((c) => {
    const base = `${c.nature}|${c.nature === 'maitrise' ? c.cle.slice(0, c.cle.lastIndexOf(':')) : c.cle}`;
    vues.set(base, (vues.get(base) ?? 0) + 1);
    return `${base}|${vues.get(base)}`;
  });
}

/**
 * Un choix du tiroir, un `li` et son bouton (qui porte le focus et, sa tuile dans la page, la bulle : `data-bulle` et les rôles ARIA, qu'un `listitem`
 * ne prend pas) : l'ethnie, un bouton qui ouvre son menu, sans bulle ; les autres, un bouton qui montre sa tuile en bulle, où Entrée met le focus.
 */
function elementDeChoix(c, choix) {
  if (c.nature === 'ethnie') {
    return el('li', { dataset: { nature: c.nature, choix } },
      el('button', { type: 'button', class: 'tiroir__lien', onclick: (ev) => { ev.stopPropagation(); ouvrirMenu('choix-ethnie'); } }));
  }
  const bouton = el('button', { type: 'button', class: 'tiroir__choix' });
  const remplir = () => bouton.dataset.bulle && remplirBulleDeChoix(bouton.closest('li').dataset.cle, bouton.textContent, bouton.closest('li').dataset.choix);
  // le survol ne remplace pas la bulle où l'on est entré au clavier (arbitrage, carte blanche du propriétaire ; Infobulles.astro ne l'ouvre pas non plus)
  bouton.addEventListener('pointerover', () => { if (!bulleRetenue(bouton)) remplir(); });
  bouton.addEventListener('pointerdown', (ev) => {
    const retenue = bulleRetenue(bouton);
    remplir();
    appuiSurUnAutreChoix(bouton, ev, retenue);
  });
  bouton.addEventListener('focusin', remplir);
  bouton.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || !bouton.dataset.bulle) return;
    ev.preventDefault();   // pas de clic : seule la bulle s'ouvre
    remplir();
    // la bulle fermée (Échap, ou le focus donné à la souris) : rouverte comme au focus du clavier (components/Infobulles.astro)
    if (!bouton.hasAttribute('data-ouverte')) bouton.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const premier = bouton.hasAttribute('data-ouverte') ? arretsDeLaBulle(bulleDeChoix())[0] : null;
    if (!premier) return;
    bulleAuClavier = true;
    premier.focus({ preventScroll: true });
  });
  return el('li', { dataset: { nature: c.nature, choix } }, bouton);
}

/**
 * Le survol du bouton d'un choix laisse la bulle telle quelle : on est entré au clavier dans la bulle d'un autre choix et le focus y est encore
 * (bulleAuClavier). Sorti de la bulle (Échap, Tab, focus parti, appui du pointeur dans la bulle), le survol la remplit de nouveau.
 */
function bulleRetenue(bouton) {
  const bulle = document.getElementById('bulle-choix');
  return Boolean(bulleAuClavier && bulle && !bulle.hidden && bulle.contains(document.activeElement) && bulle.dataset.choix !== bouton.closest('li')?.dataset.choix);
}

/**
 * Un appui sur le bouton d'un autre choix alors que la bulle était retenue (bulleRetenue) : la retenue prend fin (Infobulles.astro : un appui du
 * pointeur), et la bulle de ce choix s'ouvre, comme à son survol sans focus du clavier dans une bulle (arbitrage, carte blanche du propriétaire). Elle
 * vient d'être remplie ; Infobulles.astro l'ouvre au survol, que l'on rejoue ici.
 */
function appuiSurUnAutreChoix(bouton, ev, retenue) {
  if (!retenue) return;
  bouton.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: ev.pointerType, clientX: ev.clientX, clientY: ev.clientY }));
}

/** Le bouton d'un choix du tiroir (celui qui reçoit le focus). */
const boutonDuChoix = (li) => li?.querySelector('button') ?? null;

/** Le texte d'un choix du tiroir, la clé de sa tuile, et sa bulle (`data-bulle`, rôles ARIA) quand sa tuile est dans la page. */
function mettreAJourLeChoix(li, c) {
  li.dataset.cle = c.cle;
  if (c.nature === 'ethnie') {
    const bouton = li.firstElementChild;
    if (bouton.textContent !== c.libelle) bouton.textContent = c.libelle;
    bouton.setAttribute('aria-label', `${c.libelle} : ouvrir le menu de l’ethnie`);
    return;
  }
  const bouton = boutonDuChoix(li);
  if (bouton.textContent !== c.libelle) bouton.textContent = c.libelle;
  const avecBulle = Boolean(tuileDeChoix(c.cle));
  if (avecBulle === Boolean(bouton.dataset.bulle)) return;
  if (avecBulle) {
    bouton.dataset.bulle = bulleDeChoix().id;
    bouton.setAttribute('aria-haspopup', 'dialog');
    bouton.setAttribute('aria-controls', bouton.dataset.bulle);
    bouton.setAttribute('aria-expanded', 'false');   // tenu ensuite par components/Infobulles.astro
  } else {
    delete bouton.dataset.bulle;
    for (const a of ['aria-haspopup', 'aria-controls', 'aria-expanded']) bouton.removeAttribute(a);
  }
}

/**
 * Le choix que le focus rejoint quand le choix `choix`, fait depuis sa bulle au clavier, quitte le tiroir (demande du propriétaire : « Le focus va au
 * choix suivant du tiroir ») : dans `apres` (les identités du tiroir recalculé), le premier choix qui n'était pas avant lui dans `avant` (celui qui
 * prend sa place : un choix suivant, ou un choix nouveau à sa place, comme les dons d'une spécialité choisie) ; sinon le dernier (il était le dernier) ;
 * null quand il n'en reste plus.
 */
function choixSuivant(choix, avant, apres) {
  if (!apres.length) return null;
  const precedents = new Set(avant.slice(0, Math.max(avant.indexOf(choix), 0)));
  return apres.find((k) => !precedents.has(k)) ?? apres[apres.length - 1];
}

/**
 * Après un changement fait depuis la bulle d'un choix, le focus y étant venu au clavier (demandes du propriétaire) : un choix qui reste (en plusieurs
 * parts) garde le focus dans sa bulle, sur le même champ ou celui de même rang (`champ`) ; un choix terminé quitte le tiroir et le focus va au choix
 * suivant (choixSuivant) ; s'il n'en reste plus, le tiroir disparaît et le focus va sur la tuile de la page où le choix vient d'être fait (son champ de
 * même rang), dans son onglet ouvert.
 */
function suivreLeChoixAuClavier(choix, champ, avant, apres) {
  const bulle = bulleDeChoix();
  if (apres.includes(choix)) {
    if (!bulle.contains(document.activeElement)) (bulle.querySelectorAll(CHAMPS_DE_TUILE)[champ] ?? arretsDeLaBulle(bulle)[0])?.focus({ preventScroll: true });
    return;
  }
  const suivant = choixSuivant(choix, avant, apres);
  const li = suivant ? [...$('choix-attente').children].find((x) => x.dataset.choix === suivant) : null;
  if (li) return boutonDuChoix(li)?.focus({ preventScroll: true });
  const tuile = tuileDeChoix(bulle.dataset.cle);
  if (!tuile) return;
  tuile.closest('[id]')?.dispatchEvent(new CustomEvent('onglets:ouvrir', { bubbles: true }));
  const champs = [...tuile.querySelectorAll(CHAMPS_DE_TUILE)];
  (champs[champ] ?? champs[0])?.focus();
}

/**
 * L'infobulle d'un choix du tiroir (demande du propriétaire : « la tuile correspondant au choix qui apparaît dans la tooltip au survol ») : une copie de
 * la tuile du choix (`data-choix-cle` = la clé de choixEnAttente : pastilles de la spécialité, groupe de dons, choix du métier, +1 de la magie innée,
 * maîtrise, acquis, accessoire, résistance, symbiose), dans une bulle à champs de components/Infobulles.astro (`data-bulle-champs`, `role="dialog"`
 * nommé par le choix), remplie juste avant qu'elle s'ouvre. Ses boutons, cases et listes renvoient leur clic ou leur valeur à la tuile de la page : le
 * choix se fait aussi depuis la bulle. À la souris et au toucher, comme les autres bulles. Au clavier (demandes du propriétaire) : le focus sur le choix
 * montre la bulle, Entrée y met le focus (sur son premier champ) ; Tab passe d'un choix à l'autre sans entrer dans les bulles. Dans la bulle, Échap la
 * ferme et rend le focus au choix (Infobulles.astro) ; Tab après le dernier champ la ferme et va au choix suivant, Maj+Tab avant le premier revient au
 * choix ; un choix terminé : suivreLeChoixAuClavier ; une liste ou un groupe de dons parcouru aux flèches : regleDuParcours. Une seule bulle, posée dans la zone IV hors du tiroir (son `transform` fausserait la position fixe).
 */
const tuileDeChoix = (cle) => (cle ? [...racine.querySelectorAll('[data-choix-cle]')].find((t) => t.dataset.choixCle === cle && !t.closest('#bulle-choix')) ?? null : null);
const CHAMPS_DE_TUILE = 'button, input, select';
/** Le focus est dans la bulle des choix parce qu'Entrée l'y a mis (pas la souris) : les règles du clavier jouent. */
let bulleAuClavier = false;
/** Ce qui se parcourt dans la bulle et dont la valeur attend sa validation (regleDuParcours) : une liste, un champ nombre, ou « radio:<nom> ». */
let parcoursEnAttente = null;
/** Ce qui se parcourt aux flèches dans la bulle : une liste ou un champ nombre (l'élément), un groupe de boutons radio (« radio:<nom> »). */
const parcoursDe = (x) => (x instanceof HTMLSelectElement || (x instanceof HTMLInputElement && x.type === 'number') ? x
  : x instanceof HTMLInputElement && x.type === 'radio' && x.name ? `radio:${x.name}` : null);
const genreDuParcours = (p) => (typeof p === 'string' ? 'radios' : p instanceof HTMLSelectElement ? 'liste' : 'nombre');

/** Les arrêts de Tab de la bulle, dans l'ordre : ses champs affichés, un seul par groupe de boutons radio (le coché, sinon le premier). */
function arretsDeLaBulle(bulle) {
  const champs = [...bulle.querySelectorAll(CHAMPS_DE_TUILE)].filter((c) => !c.disabled && c.getClientRects().length > 0);
  const radio = (c) => c instanceof HTMLInputElement && c.type === 'radio' && c.name;
  return champs.filter((c) => {
    if (!radio(c)) return true;
    const groupe = champs.filter((x) => radio(x) && x.name === c.name);
    return c === (groupe.find((x) => x.checked) ?? groupe[0]);
  });
}

/**
 * Deux réponses du propriétaire sur la règle du parcours, qui se changent ici seulement : Maj+Tab « Prend la valeur. Comme Tab. » ; un clic ailleurs :
 * « Non, annulée. Comme vous l'avez écrit, seuls Entrée, Espace (pour les dons) et Tab prennent la valeur. »
 */
const PARCOURS = { majTabValide: true, ailleursAnnule: true };

/**
 * Ce qui se parcourt aux flèches dans la bulle d'un choix (demandes du propriétaire) : une liste (`select`, genre 'liste' : « Dans la bulle, la valeur
 * parcourue aux flèches n'est prise qu'à Entrée ou quand on quitte la liste par Tab, et Échap l'annule. »), un groupe de boutons radio (genre 'radios',
 * les dons : « Comme la liste. Dans la bulle, les flèches parcourent les dons sans les prendre. Le don est pris à Entrée ou Espace, ou quand on quitte le
 * groupe par Tab, et Échap annule. ») et un champ nombre (genre 'nombre', les points d'une répartition : « Dans la bulle, les flèches et les chiffres tapés
 * ne sont pris qu'à Entrée, ou quand on quitte le champ par Tab. Échap annule. »). Ce qu'un évènement fait de la valeur parcourue,
 * `enAttente` quand elle attend :
 *   - `change` (une liste) ou `clic` (un bouton radio) juste après une touche de parcours (flèches, début, fin, pages, une lettre) : elle attend ; sinon
 *     (la souris, une valeur prise dans la liste ouverte) : elle se relaie aussitôt ; un champ nombre (`saisie` à chaque frappe ou flèche, `change`) :
 *     elle attend toujours ;
 *   - une touche : Entrée, Tab (Maj+Tab : PARCOURS.majTabValide) la relaient ; Espace aussi pour un groupe de boutons radio ;
 *   - `quitte` : vers le choix du tiroir (Échap, qui ferme la bulle et lui rend le focus), elle est annulée ; ailleurs (un clic), annulée aussi
 *     (PARCOURS.ailleursAnnule), sinon relayée. Annulée, la bulle reprend l'état de la tuile de la page.
 * Seulement au clavier (`auClavier` : on est entré dans la bulle par Entrée sur le choix, bulleAuClavier) : les questions du propriétaire étaient posées
 * « au clavier », et « la souris ne change pas » ; entré à la souris, un champ de la bulle se relaie à son `change`, un bouton radio à son clic.
 * Rend 'relayer', 'attendre', 'annuler' ou null (rien). La tuile de la page, les autres cases et les boutons de la bulle n'en changent pas.
 */
function regleDuParcours(evenement, enAttente, genre, auClavier = true) {
  if (evenement.type === 'saisie') return auClavier && genre === 'nombre' ? 'attendre' : null;
  if (evenement.type === 'change' || evenement.type === 'clic') return auClavier && (genre === 'nombre' || evenement.apresUneTouche) ? 'attendre' : 'relayer';
  if (evenement.type === 'touche') {
    if (!enAttente) return null;
    if (evenement.touche === 'Tab') return !evenement.maj || PARCOURS.majTabValide ? 'relayer' : null;
    return evenement.touche === 'Enter' || (genre === 'radios' && evenement.touche === ' ') ? 'relayer' : null;
  }
  if (evenement.type === 'quitte') {
    if (!enAttente) return null;
    return evenement.vers === 'choix' || PARCOURS.ailleursAnnule ? 'annuler' : 'relayer';
  }
  return null;
}

function bulleDeChoix() {
  let bulle = document.getElementById('bulle-choix');
  if (bulle) return bulle;
  bulle = el('span', { class: 'bulle bulle--tuile', role: 'dialog', id: 'bulle-choix', hidden: true, 'data-bulle-champs': '' });
  const original = (champ) => {
    const copie = bulle.querySelector('[data-copie]');
    const tuile = tuileDeChoix(bulle.dataset.cle);
    if (!copie || !tuile) return null;
    const i = [...copie.querySelectorAll(CHAMPS_DE_TUILE)].indexOf(champ);
    return i < 0 ? null : tuile.querySelectorAll(CHAMPS_DE_TUILE)[i] ?? null;
  };
  // une saisie (un nombre, un texte) se relaie à son changement, comme une liste ; un bouton ou une case, à son clic
  const saisie = (x) => x instanceof HTMLSelectElement || (x instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(x.type));
  const relayer = (champ) => {
    const cible = original(champ);
    if (!cible) return;
    cible.value = champ.value;
    cible.dispatchEvent(new Event('input', { bubbles: true }));
    cible.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const groupe = (p) => [...bulle.querySelectorAll('input[type="radio"]')].filter((r) => `radio:${r.name}` === p);
  // un rond pris au clavier : coché sur la page par son `change` (un clic de script passerait par le document, où Infobulles.astro fermerait la bulle
  // avant le recalcul de la fiche)
  const valider = (p) => {
    if (genreDuParcours(p) !== 'radios') return relayer(p);
    const cible = original(groupe(p).find((r) => r.checked));
    if (!cible || cible.checked) return;
    cible.checked = true;
    cible.dispatchEvent(new Event('input', { bubbles: true }));
    cible.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const annuler = (p) => {
    if (genreDuParcours(p) !== 'radios') p.value = original(p)?.value ?? p.value;
    else for (const r of groupe(p)) r.checked = Boolean(original(r)?.checked);
  };
  let toucheSur = null;   // ce qui vient de recevoir une touche de parcours (le `change` ou le clic qui suit en est le parcours)
  const TOUCHES_HORS_PARCOURS = ['Enter', 'Tab', 'Escape', ' ', 'Shift', 'Control', 'Alt', 'Meta', 'AltGraph'];
  bulle.addEventListener('click', (ev) => {
    const champ = ev.target instanceof Element ? ev.target.closest('button, input') : null;
    if (saisie(champ)) return;
    const p = parcoursDe(champ);
    if (p && regleDuParcours({ type: 'clic', apresUneTouche: p === toucheSur }, false, genreDuParcours(p), bulleAuClavier) === 'attendre') {
      parcoursEnAttente = p;   // le bouton reste coché dans la bulle, rien n'est relayé
      return;
    }
    const cible = champ && original(champ);
    if (!cible) return;
    ev.preventDefault();
    // au clavier, ni ce clic ni celui de la tuile ne remontent au document : Infobulles.astro y fermerait la bulle (le choix reste ouvert) ou celle du
    // choix suivant (le champ cliqué, retiré de la bulle refaite, n'y est plus) ; à la souris, le clic de toujours
    if (!bulleAuClavier) return cible.click();
    ev.stopPropagation();
    cible.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true }));
  });
  // un champ nombre revenu à la valeur de la page n'attend rien
  const inchange = (p) => genreDuParcours(p) === 'nombre' && p.value === original(p)?.value;
  bulle.addEventListener('input', (ev) => {
    const p = parcoursDe(ev.target);
    if (p && inchange(p)) parcoursEnAttente = null;
    else if (p && regleDuParcours({ type: 'saisie' }, false, genreDuParcours(p), bulleAuClavier) === 'attendre') parcoursEnAttente = p;
  });
  bulle.addEventListener('change', (ev) => {
    if (!saisie(ev.target)) return;
    const p = parcoursDe(ev.target);
    if (p && inchange(p)) return;
    if (p && regleDuParcours({ type: 'change', apresUneTouche: p === toucheSur }, false, genreDuParcours(p), bulleAuClavier) === 'attendre') parcoursEnAttente = p;
    else relayer(ev.target);
  });
  bulle.addEventListener('keydown', (ev) => {
    const p = parcoursDe(ev.target);
    if (p && !TOUCHES_HORS_PARCOURS.includes(ev.key)) {
      toucheSur = p;
      setTimeout(() => { toucheSur = null; });
    }
    if (p && p === parcoursEnAttente && regleDuParcours({ type: 'touche', touche: ev.key, maj: ev.shiftKey }, true, genreDuParcours(p)) === 'relayer') {
      parcoursEnAttente = null;
      valider(p);
      if (ev.key !== 'Tab') ev.preventDefault();   // Espace ne clique pas une seconde fois
      // le choix terminé : le focus est déjà au choix suivant (suivreLeChoixAuClavier), Tab n'y ajoute rien
      else if (!bulle.contains(document.activeElement)) return ev.preventDefault();
    }
    // au clavier : Tab après le dernier arrêt part du choix (le Tab du navigateur va au suivant), Maj+Tab avant le premier y revient
    if (ev.key !== 'Tab' || !bulleAuClavier || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const ici = document.activeElement;
    const li = boutonDuChoix([...$('choix-attente').children].find((x) => x.dataset.choix === bulle.dataset.choix && x.dataset.nature !== 'ethnie'));
    const arrets = arretsDeLaBulle(bulle);
    const i = arrets.findIndex((a) => a === ici || (a.type === 'radio' && a.name && a.name === ici.name));
    if (!li || i < 0 || i !== (ev.shiftKey ? 0 : arrets.length - 1)) return;
    li.focus({ preventScroll: true });
    if (ev.shiftKey) ev.preventDefault();
  });
  bulle.addEventListener('pointerdown', () => { bulleAuClavier = false; });
  bulle.addEventListener('focusout', (ev) => {
    const p = parcoursDe(ev.target);
    if (p && p === parcoursEnAttente && parcoursDe(ev.relatedTarget) !== p) {
      const vers = ev.relatedTarget instanceof Element && ev.relatedTarget.closest('#choix-attente') ? 'choix' : 'ailleurs';
      const quoi = regleDuParcours({ type: 'quitte', vers }, true, genreDuParcours(p));
      parcoursEnAttente = null;
      if (quoi === 'annuler') annuler(p);
      else if (quoi === 'relayer') valider(p);
    }
    // jugé après coup, comme Infobulles.astro : un champ retiré quand la bulle est refaite perd le focus, que suivreLeChoixAuClavier lui rend
    setTimeout(() => { if (!bulle.contains(document.activeElement)) bulleAuClavier = false; });
  });
  ($('etape-choix').closest('.fiche-zone') ?? racine).append(bulle);   // les couleurs de la zone IV, hors du tiroir
  return bulle;
}

/**
 * Met `actuel` à l'image de `voulu` en gardant ses nœuds tant que leur balise est la même (attributs et textes recopiés ; le champ qui a le focus le
 * garde), sinon le remplace. Rend le nœud mis en place.
 */
function morpher(actuel, voulu) {
  if (actuel.nodeType !== voulu.nodeType || (actuel.nodeType === 1 && actuel.tagName !== voulu.tagName) || (actuel.nodeType !== 1 && actuel.nodeType !== 3)) {
    actuel.replaceWith(voulu);
    return voulu;
  }
  if (actuel.nodeType === 3) {
    if (actuel.nodeValue !== voulu.nodeValue) actuel.nodeValue = voulu.nodeValue;
    return actuel;
  }
  for (const a of [...actuel.attributes]) if (!voulu.hasAttribute(a.name)) actuel.removeAttribute(a.name);
  for (const a of [...voulu.attributes]) if (actuel.getAttribute(a.name) !== a.value) actuel.setAttribute(a.name, a.value);
  const anciens = [...actuel.childNodes];
  const nouveaux = [...voulu.childNodes];
  nouveaux.forEach((n, i) => (i < anciens.length ? morpher(anciens[i], n) : actuel.append(n)));
  for (const n of anciens.slice(nouveaux.length)) n.remove();
  return actuel;
}

/**
 * Remplit la bulle avec la copie de la tuile `cle` du choix `choix` (son identité, nommée `libelle`), dans un conteneur comme le sien (ses styles), sans identifiant ni nom de
 * groupe partagés. La bulle du même choix est mise à jour en place (morpher) : le champ qui a le focus le garde.
 */
function remplirBulleDeChoix(cle, libelle, choix) {
  const tuile = tuileDeChoix(cle);
  const bulle = bulleDeChoix();
  if (!tuile) return;
  const memeChoix = bulle.dataset.cle === cle && bulle.childNodes.length === 1;
  bulle.dataset.cle = cle;
  if (choix) bulle.dataset.choix = choix;
  if (libelle) bulle.setAttribute('aria-label', libelle);
  const copie = tuile.cloneNode(true);
  copie.removeAttribute('data-choix-cle');
  copie.hidden = false;
  copie.setAttribute('data-copie', '');
  for (const n of [copie, ...copie.querySelectorAll('[id]')]) n.removeAttribute('id');
  for (const n of copie.querySelectorAll('input[name]')) n.name = `bulle-${n.name}`;
  for (const n of [copie, ...copie.querySelectorAll('[data-champ]')]) n.removeAttribute('data-champ');   // la tuile de la page reste le seul champ de la fiche
  const parent = tuile.parentElement;
  const enveloppe = parent && parent.matches('ul, ol') ? parent.cloneNode(false) : null;
  enveloppe?.removeAttribute('id');
  enveloppe?.removeAttribute('aria-label');
  if (enveloppe) enveloppe.append(copie);
  if (memeChoix) morpher(bulle.firstChild, enveloppe ?? copie);
  else bulle.replaceChildren(enveloppe ?? copie);
  // l'état coché ou choisi d'un champ n'est pas toujours un attribut : on le recopie, sauf dans le champ qui a le focus (comme la tuile de la page : la
  // frappe en cours reste) et dans ce qui attend sa validation (regleDuParcours)
  const sources = tuile.querySelectorAll(CHAMPS_DE_TUILE);
  bulle.querySelectorAll(CHAMPS_DE_TUILE).forEach((n, i) => {
    if (n === document.activeElement || (parcoursEnAttente && parcoursDe(n) === parcoursEnAttente)) return;
    if (n instanceof HTMLInputElement && sources[i] instanceof HTMLInputElement) {
      n.checked = sources[i].checked;
      if (n.value !== sources[i].value) n.value = sources[i].value;
    }
    if (n instanceof HTMLSelectElement && sources[i]) n.value = sources[i].value;
  });
}

/**
 * « Aller aux choix » : ouvre l'onglet « Choix » de la zone IV, y met le focus (le tiroir rangé, ce bouton passe en `hidden` et le focus serait perdu)
 * sans faire défiler, puis descend à la zone IV (sans animation sous `prefers-reduced-motion`).
 */
function allerAuxChoix() {
  const onglet = $('onglet-choix');
  onglet.click();
  onglet.focus({ preventScroll: true });
  $('zone-parametres').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
    return dons.map((d) => el('div', { class: ['groupe-pastilles', ...teinteDe(d.classe)].join(' ') },
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
              // le texte du don en infobulle (demande du propriétaire du 2026-10-29 : infobulleDuDonAChoisir), au survol de l'option et au focus de son
              // rond : le `title` est aussi sur le rond, car components/Infobulles.astro n'ouvre au clavier que la bulle de l'élément qui a le focus
              g.options.map((o) => {
                const texte = infobulleDuDonAChoisir(d.classe, o.id);
                const rond = radio(o);
                if (texte) rond.title = texte;
                return el('label', { title: texte }, rond, o.nom, el('small', { class: 'muted' }, ` (${o.type})`));
              })));
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

/**
 * Le rappel d'un sort « Fer » d'un autre élément que l'arme élémentaire portée (décision R167 : « la fiche signale seulement quand le sort et l'arme
 * élémentaire ne sont pas du même élément » ; sortsFerDAutreElement) ; son infobulle, la phrase de la page « Pièces élémentaires », telle qu'écrite.
 */
const RAPPEL_DES_SORTS_FER = Object.freeze({
  texte: (sort) => `${sort.nom} : sort « Fer » d’un autre élément que cette arme`,
  source: 'Page « Pièces élémentaires » : « Les sorts "fer" sont utilisables sur les armes élémentaires mais il faut évidemment qu\'il soit du même élément sinon ça ne marche pas. »',
});

function construireEquipement() {
  // la liste de chaque arme (décision R167) : les armes du catalogue, et directement les armes élémentaires des magies du personnage (innée et acquise,
  // jamais le Potentiel Illimité : armesElementairesProposees), dans le groupe de leur famille, chacune sur le fond de sa magie ; une arme élémentaire
  // déjà posée d'une autre magie reste dans un groupe à part (la base la signale : arme_elementaire_hors_magie). Refaite quand les magies changent.
  const armesProposees = armesElementairesProposees(regles, fiche);
  const horsDeRang = (rang) => {
    const id = ligneDe('armes', (x) => x.rang === rang)?.arme_elementaire_id;
    return id && !armesProposees.some((a) => a.id === id) ? trouver(regles.armes_elementaires, id) : null;
  };
  reconstruire($('armes'), JSON.stringify([armesProposees.map((a) => a.id), [1, 2].map((r) => horsDeRang(r)?.id ?? null)]), () => [1, 2].map((rang) => {
    const l = () => ligneDe('armes', (x) => x.rang === rang);
    // une arme du catalogue choisie sans matériau prend le fer (armesApresChoix, décision R49) ; une arme élémentaire n'a pas de matériau (R167) ; une
    // autre arme est neuve, une autre composition ou amélioration ramène la solidité du moment sous son nouveau maximum (armesApresReglage, décision R74)
    const poserChamp = (cle) => (v) => {
      if (cle === 'arme_id') fiche.armes = armesApresChoix(regles, fiche, rang, v);
      else if (l()) fiche.armes = armesApresReglage(regles, fiche, rang, cle, v);
      changer();
    };
    const optionDElement = (a) => el('option', { value: a.id, class: teinteDe(a).join(' ') || null, title: trouver(regles.magies, a.magie_id)?.nom ?? null }, a.nom);
    // les groupes du catalogue, la maîtrise la plus haute d'abord (groupesDArmesParMaitrise, demande du propriétaire du 2026-10-23 : puis par ordre
    // alphabétique à maîtrise égale ; « Autres » à la fin) ; les armes élémentaires proposées à la fin du groupe de leur famille (celle de leur type élémentaire)
    const groupesDuCatalogue = () => groupesDArmesParMaitrise(regles, fiche, calcul.maitrises.familles).map((g) => g.famille);
    const parFamille = new Map(groupesDArmesParMaitrise(regles, fiche, calcul.maitrises.familles).map((g) => [g.famille, el('optgroup', { label: g.nom }, g.armes.map((a) => option(a.id, a.nom)))]));
    for (const a of armesProposees) {
      const f = regles.familles_armes.find((x) => x.type_elementaire_id === a.type_id);
      if (!f) continue;
      if (!parFamille.has(f.id)) parFamille.set(f.id, el('optgroup', { label: f.nom }));
      parFamille.get(f.id).append(optionDElement(a));
    }
    const hors = horsDeRang(rang);
    const horsGroupe = hors ? el('optgroup', { label: 'Hors des magies du personnage' }, optionDElement(hors)) : null;
    const ordreDesGroupes = () => {
      const base = groupesDuCatalogue();
      return [...base, ...[...parFamille.keys()].filter((k) => !base.includes(k))];
    };
    const choixDArme = selecteur(() => l()?.arme_id ?? l()?.arme_elementaire_id,
      [...ordreDesGroupes().map((k) => parFamille.get(k)), horsGroupe].filter(Boolean), poserChamp('arme_id'), { vide: 'Aucune', etiquette: `Arme ${rang}` });
    // l'ordre suit la fiche en direct (un choix de maîtrise, une classe, un don, un accessoire) : les groupes, construits une fois, sont seulement déplacés
    // quand l'ordre change (`dataset.cle`), et l'arme choisie le reste
    choixDArme.dataset.cle = JSON.stringify(ordreDesGroupes());
    synchro(() => {
      const ordre = ordreDesGroupes();
      const cle = JSON.stringify(ordre);
      if (choixDArme.dataset.cle === cle) return;
      choixDArme.dataset.cle = cle;
      const valeur = choixDArme.value;
      choixDArme.append(...[...ordre.map((k) => parFamille.get(k)), horsGroupe].filter(Boolean));
      choixDArme.value = valeur;
    });
    const effet = el('input', { 'aria-label': `Arme ${rang} : effet en plus`, oninput: (ev) => { const x = l(); if (x) { x.effet_en_plus = ev.target.value || null; changer(); } } });
    const details = [];
    const champ = (texte, select) => {
      const label = el('label', { class: 'fiche-champ' }, el('span', {}, texte), select);
      details.push(select);
      return label;
    };
    const composition = selecteur(() => l()?.materiau_id, regles.materiaux_armes.map((m) => option(m.id, m.nom)), poserChamp('materiau_id'), { etiquette: `Arme ${rang} : composition` });
    // le type physique d'une arme élémentaire dont le type se choisit (décision R167, la bombe : « Estoc, Frappe ou Taille au choix », un seul) : ses options,
    // les types de son type élémentaire (types_offerts) ; tant qu'il n'est pas choisi, seul le type de la magie compte (armeDeLaLigne), rien n'est deviné
    const nomsDesTypes = new Map(typesDeDegats(regles).filter((t) => t.physique).map((t) => [t.id, t.nom]));
    const typeDegats = el('select', { 'aria-label': `Arme ${rang} : type de dégâts physique`, onchange: (ev) => poserChamp('type_degats_choisi')(ev.target.value || null) });
    const typeLigne = el('label', { class: 'fiche-champ' }, el('span', {}, 'Type de dégâts'), typeDegats);
    // l'effet d'une arme élémentaire (décision R167) : sa capacité « Nom (mode) : texte », « Ignore 4 AP » de l'arbalète, la mention de l'arme de jet et de
    // la bombe (effetDeLArmeElementaire, comme la page des armes) ; puis le rappel des sorts « Fer » d'un autre élément (sortsFerDAutreElement)
    const effetDeLArme = el('p', { class: 'objet__effet' });
    const rappels = el('ul', { class: 'objet__rappels' });
    // les dégâts de l'arme, « XDY+Z » (degatsDArme, demande du propriétaire) : les dés de sa maîtrise et son dé, plus les bonus de l'équipement et des dons
    // passifs qui la visent, le détail en infobulle (avec les bonus de dons qui ne se comptent pas) ; avec deux armes de mêlée, une étoile à côté dit le
    // malus d'attaque de cette main (attaqueADeuxArmes, décision du propriétaire : « −10 % si ambidextre » ; l'arme 1 est l'arme principale)
    const des = el('strong', { class: 'objet__des' });
    const etoile = el('span', { class: 'objet__etoile', tabindex: '0', role: 'img' }, '★');
    const resume = el('span', { class: 'objet__resume' });
    // la solidité du moment (décision R74 : « Un slider qui va de 0 au max de l'arme. A zéro, l'arme est cassée ») : un curseur de 0 au maximum de l'arme
    // (durabiliteDArme : arme forgée, au moins 1 ; arme élémentaire, 4 + les crans de sa ligne d'amélioration, R167), « N / M » à côté ; clic droit ou
    // Entrée : saisir le nombre. Caché pour une arme sans solidité (arme de monstre). Le maximum ou plus s'enregistre « à son maximum » (durabiliteAEcrire)
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
      // une arme élémentaire, sur le fond de sa magie (sa classe de la palette, jamais une couleur) ; sans matériau (R167)
      const arme = armeDeLaLigne(regles, x);
      const element = arme?.elementaire ?? null;
      poserTeinte(choixDArme, teinteDe(element));
      attribut(choixDArme, 'data-couleur', Boolean(element));
      attribut(choixDArme, 'title', element ? `${element.nom} (arme élémentaire, ${trouver(regles.magies, element.magie_id)?.nom ?? element.magie_id})` : null);
      attribut(choixDArme, 'aria-invalid', element && !armesProposees.some((a) => a.id === element.id) ? 'true' : null);
      composition.disabled = !x || Boolean(element);
      typeLigne.hidden = !arme?.type_degats_au_choix;
      const offerts = arme?.type_degats_au_choix ? arme.types_offerts : [];
      if (typeDegats.dataset.cle !== offerts.join()) {
        typeDegats.dataset.cle = offerts.join();
        typeDegats.replaceChildren(option('', '— au choix —'), ...offerts.map((t) => option(t, nomsDesTypes.get(t) ?? t)));
      }
      poser(typeDegats, x?.type_degats_choisi ?? '');
      const lignesDEffet = element ? effetDeLArmeElementaire(element, trouver(regles.types_elementaires ?? [], element.type_id)) : [];
      if (effetDeLArme.dataset.texte !== lignesDEffet.join('\n')) {
        effetDeLArme.dataset.texte = lignesDEffet.join('\n');
        effetDeLArme.replaceChildren(...lignesDEffet.map((t) => el('span', {}, t)));
      }
      effetDeLArme.hidden = !lignesDEffet.length;
      const fer = sortsFerDAutreElement(regles, fiche).filter((r) => r.rang === rang);
      if (rappels.dataset.cle !== fer.map((r) => r.sort.id).join()) {
        rappels.dataset.cle = fer.map((r) => r.sort.id).join();
        rappels.replaceChildren(...fer.map((r) => el('li', { title: RAPPEL_DES_SORTS_FER.source }, RAPPEL_DES_SORTS_FER.texte(r.sort))));
      }
      rappels.hidden = !fer.length;
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
      // les dégâts du moment (décisions R100, R102) : la posture (Offensif : le maximum ; Défensif : ÷ 2 ; Symbiose : arme inutilisable, sauf l'arme
      // élémentaire de la magie de la Symbiose, avec le bonus de la posture : R167) et un dé au maximum
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
      const choisis = [!element && trouver(regles.materiaux_armes, x?.materiau_id)?.nom, arme?.type_degats_au_choix && nomsDesTypes.get(x?.type_degats_choisi),
        x?.amelioration_id && 'amélioration', x?.effet_en_plus && 'effet en plus'].filter(Boolean);
      resume.textContent = choisis.length ? choisis.join(' · ') : element ? 'amélioration, effet en plus…' : 'composition, amélioration…';
    });
    // à portée de main (demande du propriétaire) : l'arme et ses dés ; composition (grisée pour une arme élémentaire), amélioration et effet en plus
    // repliés (décision R167 : plus de champ « Élément » ni « Amélioration de l'élément », un seul niveau d'amélioration)
    return el('div', { class: 'objet' }, el('div', { class: 'objet__tete' }, el('h4', {}, `Arme ${rang}`), el('span', { class: 'objet__degats' }, des, etoile)),
      el('label', { class: 'fiche-champ' }, el('span', { class: 'visuellement-cache' }, 'Arme'), choixDArme),
      effetDeLArme, rappels,
      soliditeLigne,
      el('details', { class: 'objet__details' }, el('summary', {}, resume), el('div', { class: 'fiche-champs' },
      champ('Composition', composition),
      typeLigne,
      champ('Amélioration', selecteur(() => l()?.amelioration_id, ameliorations('arme'), poserChamp('amelioration_id'), { etiquette: `Arme ${rang} : amélioration` })),
      el('label', { class: 'fiche-champ' }, el('span', {}, 'Effet en plus'), effet))));
  }));

  // l'armure portée (décision R95 : « L'amélioration est pour l'armure complète ») : UNE armure, de base ou élémentaire (décision R165 (5) : « une seule
  // liste d'armures », celle d'armuresProposees — les armures de base au plus du poids portable, jamais « Familier », par poids ; les armures élémentaires
  // des magies innée et acquise, au plus du poids portable, un groupe par magie, chaque option sur la couleur de sa magie comme les sorts : Safari iOS
  // ignore le fond d'une option, le nom de la magie est donc celui de son groupe ; fermée, la liste prend la couleur de l'armure élémentaire choisie),
  // puis son amélioration, du tableau de son genre (une armure élémentaire : +1 à +5 du tableau élémentaire) ; armureApresChoix : une autre armure est
  // neuve. Sous la liste, le poids portable (poidsPortableDe, son calcul en infobulle). Puis la solidité du moment de chacune de ses six parties
  // (« L'armure peut casser à certains endroits seulement »), ou de l'armure entière pour une armure à solidité unifiée : un curseur de 0 au maximum
  // (partiesDeLArmure : la solidité de l'armure, ou 4 crans pour une armure élémentaire, et les crans de son amélioration), « N / M » à côté, « Cassée »
  // à 0 ; clic droit ou Entrée : saisir le nombre. Chaque partie se répare individuellement (« kit de réparation ou métier adapté + matériau ») : rien n'en
  // est calculé, sa solidité remonte au curseur. Une armure hors de la liste est retirée et notée (retirerLArmureHorsListe) ; sortie de la liste par un
  // geste en cours (armureEnSuspens), elle reste dans un groupe « Hors de la liste » jusqu'à ce que le choix soit arrêté (arreterLeChoix)
  const proposees = armuresProposees(regles, fiche);
  const armurePortee = () => trouver(regles.armures_elementaires ?? [], fiche.armure_elementaire_id) ?? trouver(regles.armures ?? [], fiche.armure_id);
  const portee = armurePortee();
  const proposee = (a) => proposees.base.some((g) => g.armures.includes(a)) || proposees.elementaires.some((g) => g.armures.includes(a));
  const horsListe = portee && !proposee(portee) ? portee : null;
  const elementaire = Boolean(fiche.armure_elementaire_id);
  const cleDesArmures = JSON.stringify([proposees.portable, proposees.elementaires.map((g) => g.magie.id), horsListe?.id ?? null, elementaire]);
  reconstruire($('armures'), cleDesArmures, () => {
    const choisir = (champ) => (v) => {
      Object.assign(fiche, armureApresChoix(regles, fiche, champ, v));
      changer();
    };
    const libelle = (a) => `${a.nom} (${[a.categorie, stats(a)].filter(Boolean).join(', ')})`;
    const optionDArmure = (a, magie = null) => el('option', { value: a.id, class: teinteDe(magie).join(' ') || null, title: magie ? `${magie.nom} : armure élémentaire` : null },
      magie ? libelle(a) : `${a.nom}${stats(a) ? ` (${stats(a)})` : ''}`);
    const armure = el('select', { 'aria-label': 'Armure', onchange: (ev) => choisir('armure')(ev.target.value || null) },
      el('option', { value: '', class: 'option-vide' }, 'Aucune'),
      proposees.base.map((g) => el('optgroup', { label: g.poids }, g.armures.map((a) => optionDArmure(a)))),
      proposees.elementaires.map((g) => el('optgroup', { label: `Armures élémentaires : ${g.magie.nom}` }, g.armures.map((a) => optionDArmure(a, g.magie)))),
      horsListe ? el('optgroup', { label: 'Hors de la liste (retirée une fois le choix arrêté)' }, optionDArmure(horsListe, trouver(regles.magies, horsListe.magie_id))) : null);
    synchro(() => {
      poser(armure, fiche.armure_elementaire_id ?? fiche.armure_id ?? '');
      const a = trouver(regles.armures_elementaires ?? [], fiche.armure_elementaire_id);
      const magie = trouver(regles.magies, a?.magie_id);
      poserTeinte(armure, teinteDe(magie));
      armure.toggleAttribute('data-couleur', Boolean(magie));
      attribut(armure, 'title', a ? `${a.nom} : armure élémentaire (${magie?.nom ?? a.magie_id}, ${a.categorie})` : null);
    });
    const poids = el('p', { class: 'fiche-aide armure__poids' });
    synchro(() => {
      const p = poidsPortableDe(regles, fiche);
      const texte = `Poids portable : ${p.poids}`;
      if (poids.textContent !== texte) poids.textContent = texte;
      infobulle(poids, [`Poids portable : ${p.poids} (${p.valeur})`, ...p.etapes.map((e) => e.texte),
        'La liste ne propose que les armures de ce poids au plus (décision R165).'].join('\n'));
    });
    // l'amélioration de l'armure portée, du tableau de son genre (R77 ; R165 (2) pour une armure élémentaire)
    const champ = elementaire ? 'armure_amelioration_elementaire_id' : 'armure_amelioration_id';
    const amelioration = selecteur(() => fiche[champ], ameliorations(elementaire ? 'armure_elementaire' : 'armure'), choisir(champ),
      { etiquette: elementaire ? 'Armure élémentaire : amélioration' : 'Armure : amélioration' });
    synchro(() => { amelioration.disabled = !armurePortee(); });
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
          ...a.detail.map((c, i) => (i ? `${c.nom} ${signe(c.valeur)}` : `${c.nom} : ${c.valeur}${a.uni ? ' (solidité unifiée : toute l’armure)' : a.elementaire ? ' (pièce élémentaire, décision R165)' : ''}`)),
          'À 0, la partie est cassée ; chaque partie se répare individuellement (kit de réparation ou métier adapté + matériau). Clic droit ou Entrée sur le curseur : saisir le nombre.',
        ].join('\n');
      });
      return rang;
    });
    const parties = el('div', { class: 'armure__parties', role: 'group', 'aria-label': 'Solidité des parties de l’armure' }, rangs);
    synchro(() => { parties.hidden = !armurePortee(); });
    return el('div', { class: 'objet' },
      el('label', { class: 'fiche-champ armure__choix' }, el('span', {}, 'Armure'), armure),
      poids,
      el('div', { class: 'fiche-champs' }, el('label', { class: 'fiche-champ' }, el('span', {}, 'Amélioration'), amelioration)),
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
        // la couleur du poids (R92) : sa classe (regles.json : `classe` de chaque poids, famille `poids` de la feuille de la page), jamais un style
        poserTeinte(tuilePoids.li, teinteDe(b.poids));
        if (b.poids) {
          ecrire(tuilePoids, b.poids.nom);
          infobulle(tuilePoids.li, `Requiert ${b.poids.force_min} Force minimum${b.forceManquante ? ` : Force ${b.force}, trop lourd` : ''}`);
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
      // l'effet à choix (décision R54) : « Compétence X » → une compétence de cette caractéristique ; « +5 dégâts avec une catégorie d'arme » et « Un point
      // de maîtrise d'arme » → une famille maîtrisable (R151 : « (ne peut changer une fois décidé) » n'est qu'un rappel, le choix reste modifiable ; le
      // point de maîtrise se choisit aussi dans sa carte du bloc Maîtrises, la même valeur)
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
        choixFamille.hidden = !cibles.includes('degats_famille') && !cibles.includes('maitrise_arme');
        infobulle(choixFamille, choixFamille.hidden ? '' : '« Ne peut changer une fois décidé » : un rappel, le choix reste modifiable');
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
  // l'onglet « Contrôle » de la zone IV compte les règles à revoir, en rouge (vert quand il n'y en a aucune) ; les avertissements (décision R170 : le
  // plafond de maîtrise, lib/fiche-controles.mjs#graviteDuControle) ne sont pas des erreurs : comptés à part, dans l'infobulle, et dans le compteur aux
  // couleurs d'un avertissement seulement quand il n'y a aucune erreur
  const compte = $('controles-compte');
  const g = controlesParGravite(controles);
  const avertis = g.avertissements ? `${g.avertissements} avertissement${g.avertissements > 1 ? 's' : ''}` : '';
  compte.hidden = controles === null;
  compte.textContent = controles === null ? '' : g.erreurs ? String(g.erreurs) : g.avertissements ? String(g.avertissements) : '✓';
  compte.toggleAttribute('data-ok', controles !== null && !g.erreurs && !g.avertissements);
  compte.toggleAttribute('data-avertissement', controles !== null && !g.erreurs && g.avertissements > 0);
  compte.title = controles === null ? ''
    : g.erreurs ? `${g.erreurs} règle${g.erreurs > 1 ? 's' : ''} à revoir${avertis ? ` · ${avertis}` : ''}`
      : avertis ? `Aucune règle enfreinte · ${avertis}` : 'Aucune règle enfreinte';
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
  // les erreurs, puis les avertissements, marqués comme tels
  liste.replaceChildren(
    ...(g.erreurs ? [] : [el('li', { class: 'controles__ok' }, '✓ Aucune règle enfreinte ; à noter :')]),
    ...g.lignes.map((c) => el('li', { dataset: c.gravite === 'avertissement' ? { gravite: 'avertissement' } : {} },
      c.gravite === 'avertissement' ? el('span', { class: 'controles__gravite' }, 'Avertissement · ') : null,
      el('strong', {}, libelleDuControle(c.regle)), c.detail ? ` : ${avecNoms(c.detail)}` : '')));
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

/** L'instant des lignes ajoutées aux notes (ISO 8601 UTC à la seconde, le format des colonnes `*_le` : lib/fiche-format.mjs#ligneDeRetrait). */
const instantDesNotes = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * Décision R165 (7) (« Retirer et noter ») : l'armure qui sort de la liste de la fiche — trop lourde pour le poids portable (y compris quand il baisse :
 * classe, spécialité, niveau, don, race changés), élémentaire d'une magie que le personnage n'a plus, « Familier » — en est retirée, une ligne datée
 * dans les notes, au texte du service (lib/fiche-moteur.mjs#retraitsDeLArmureHorsListe, lib/fiche-format.mjs#ligneDeRetrait) : au chargement (appliquer,
 * nouvelle), une fois arrêté le choix qui l'a fait sortir de la liste (arreterLeChoix), et avant chaque enregistrement, téléchargement ou export.
 * Vrai si elle l'a été.
 */
function retirerLArmureHorsListe() {
  const r = retraitsDeLArmureHorsListe(regles, fiche);
  if (!r) return false;
  Object.assign(fiche, r.colonnes);
  fiche.notes = ajouterAuxNotes(fiche.notes, r.retraits.map((d) => ligneDeRetrait(d, instantDesNotes())));
  modifie = true;
  return true;
}

/**
 * Le contrôle d'un geste, pour le retrait différé de l'armure (armureEnSuspens) : le menu de pastilles (race, ethnie, magies, classe, spécialité : un
 * <details class="choix">, son résumé compris, pour retirer une classe puis en choisir une autre dans le même menu), sinon le groupe de boutons radio
 * (un <fieldset> : les dons à choisir, que les flèches parcourent en déclenchant « change » à chaque bouton), sinon le groupe de pastilles (les
 * spécialités du tiroir), sinon l'élément même (une liste, que les flèches parcourent de même sous Windows ; le champ de l'XP ; la case « Bi-classé »).
 */
function groupeDuControle(cible) {
  if (!(cible instanceof Element)) return null;
  return cible.closest('details.choix') ?? cible.closest('fieldset') ?? cible.closest('.groupe-pastilles') ?? cible;
}

/**
 * Le choix arrêté (décision R165 (7), retrait différé) : l'armure mise en suspens par un geste est retirée et notée si elle est toujours hors de la liste
 * (revenue dans la liste, elle ne l'est pas, et rien n'est noté). Appelé quand le geste quitte son contrôle (un clic ou le focus ailleurs, hors du bloc
 * de l'armure, où l'on peut choisir une autre armure : demarrer), et avant d'enregistrer, de télécharger ou d'exporter (jamais une fiche envoyée avec
 * une armure hors de sa liste). Vrai si elle l'a été.
 */
function arreterLeChoix() {
  armureEnSuspens = null;
  if (!retirerLArmureHorsListe()) return false;
  rafraichir();
  return true;
}

function rafraichir() {
  // un geste en cours met l'armure sortie de la liste en suspens (le groupe de son contrôle) ; revenue dans la liste, le suspens tombe ; hors d'un geste
  // (chargement, nouvelle fiche, réponse du service), elle est retirée aussitôt, sauf en suspens (arreterLeChoix la retirera)
  if (parUnGeste) {
    if (!retraitsDeLArmureHorsListe(regles, fiche)) armureEnSuspens = null;
    else armureEnSuspens ??= { groupe: groupeDuControle(derniereCible) };
  } else if (!armureEnSuspens) retirerLArmureHorsListe();
  // les six caractéristiques sont toujours là, au minimum de la race (1) tant qu'on ne les a pas montées (demande du propriétaire)
  fiche.caracteristiques = caracteristiquesCompletes(regles, fiche);
  // la magie de la Symbiose (décision R100) : une magie du personnage, jamais le Potentiel Illimité ; une autre (magies changées) est oubliée
  if (fiche.symbiose_magie_id && (fiche.symbiose_magie_id === 'magies/potentiel-illimite'
    || ![fiche.magie_innee_id, fiche.magie_acquise_id].includes(fiche.symbiose_magie_id))) fiche.symbiose_magie_id = null;
  // le sort préparé est perdu en Symbiose avec une autre magie que la sienne (décision R135) : sa préparation est lâchée, et ne revient pas
  fiche.sorts = sortsApresLaSymbiose(regles, fiche);
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
  // les maîtrises d'armes (décision R148) : les sources une fois, lues par le bloc, son tableau et son compteur
  const sourcesDesMaitrises = sourcesDeMaitrise(regles, fiche);
  calcul.maitrises = {
    sources: sourcesDesMaitrises,
    familles: maitrisesParFamille(regles, fiche, sourcesDesMaitrises),
    compteur: compteurDeMaitrise(regles, fiche, sourcesDesMaitrises),
  };
  calcul.attente = choixEnAttente(regles, fiche);
  for (const champ of racine.querySelectorAll('[data-champ]')) poser(champ, fiche[champ.dataset.champ]);
  // cadres des blocs dans la couleur de la magie innée, en dégradé vers celle de la magie acquise (demande du propriétaire ; fiche.css, « cadres »)
  const innee = trouver(regles.magies, fiche.magie_innee_id);
  const acquise = trouver(regles.magies, fiche.magie_acquise_id);
  // (la classe de l'innée et la classe de second rang de l'acquise, ou de l'innée : --couleur, --couleur-2, lib/palette-css.mjs)
  racine.toggleAttribute('data-magie', Boolean(innee));
  poserTeinte(racine, innee ? [innee.classe, (acquise ?? innee).classe_2] : []);
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
  construireSortPrepare();
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
/** La fiche à envoyer : listes nettoyées (lignes vides retirées, rangs renumérotés, choix devenus sans effet retirés : pas de maîtrise sur ARME DE MONSTRES, R45). */
function aEnvoyer() {
  const f = structuredClone(fiche);
  for (const c of COLONNES_DU_SERVICE) delete f[c];
  delete f[CHAMP_VERSION];
  f.caracteristiques = (f.caracteristiques ?? []).filter((c) => c.base !== null && c.base !== undefined);
  f.competences = (f.competences ?? []).filter((c) => c.naturel).map(({ acquis: _a, ...c }) => c);
  // l'entraînement (décision R104) : une compétence par ligne, ou un texte non vide ; rangées dans l'ordre ; les choix d'acquis des dons débloqués
  f.entrainements = entrainementsAEnregistrer(f);
  f.acquis_choix = acquisChoixValables(regles, f);
  // la résistance au choix de la ligne du tableau de la race (décision R124) : celle de la race et de l'ethnie de la fiche, une de ses options
  f.resistance_choix = resistanceChoixValables(regles, f);
  // les maîtrises d'armes (décision R148) : la famille de chaque point à choisir d'une source acquise, parmi ses options ; plus de dés par famille (une
  // liste maitrises_armes envoyée avec maitrise_choix serait refusée : 409)
  f.maitrise_choix = maitriseChoixValables(regles, f);
  delete f.maitrises_armes;
  // solidité du moment de chaque arme bornée à son maximum (décision R74 : à son maximum ou au-delà, rien d'enregistré) ; gains de niveau jamais négatifs (R73)
  f.armes = armesValables(regles, f);
  // de même celle des parties de l'armure (décision R95 : une ligne par partie abîmée, rien sans armure)
  f.armure_parties = partiesValables(regles, f);
  for (const c of ['gains_sante', 'gains_chakra']) f[c] = Math.max(0, entier(f[c]));
  // rangés dans l'ordre ; le sort préparé garde sa marque, son jet et sa posture, une préparation que le don ne permet plus part (décision R115)
  f.sorts = sortsAEnregistrer(regles, f);
  // les livres de sort (décision R169) : un par sort, sur un sort choisi ou non, rangés dans l'ordre
  f.livres_sorts = livresAEnregistrer(f);
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
 * bouclier, un effet d'accessoire ; pour les maîtrises d'avant la refonte (décision R153, lib/fiche-format.mjs#maitrisesDAvant), une famille d'armes
 * ({ nom, de, ordre }, comme arme_famille : le bandeau, le dé écrit, son rang) et un don ({ nom, classe }).
 */
const nomsDesRetraits = () => ({
  // une arme d'avant la migration 0081, un élément posé sur une arme du catalogue (décision R167, lib/fiche-format.mjs#armeDAvant) : l'arme (son nom, le
  // bandeau de sa famille et le type élémentaire de celle-ci), l'arme élémentaire (son nom et son type), le niveau d'une amélioration (l'ancienne de
  // l'élément, absente des règles, se lit dans son identifiant), la ligne d'amélioration d'arme d'un niveau et la solidité de base d'une arme élémentaire
  arme: (x) => {
    const a = trouver(regles.armes ?? [], x);
    const f = a ? trouver(regles.familles_armes ?? [], a.famille_id) : null;
    return a ? { nom: a.nom, famille: f?.nom ?? null, type_elementaire_id: f?.type_elementaire_id ?? null } : null;
  },
  armeElementaire: (x) => {
    const a = trouver(regles.armes_elementaires ?? [], x);
    return a ? { nom: a.nom, type_id: a.type_id } : null;
  },
  niveau: (x) => trouver(regles.ameliorations ?? [], x)?.niveau ?? null,
  ameliorationDArme: (n) => {
    const a = (regles.ameliorations ?? []).find((y) => y.cible === 'arme' && y.niveau === n);
    return a ? { id: a.id, bonus_cran: a.bonus_cran ?? null } : null;
  },
  soliditeElementaire: regles.constantes?.['piece_elementaire.solidite_base'],
  armure: (x) => trouver(regles.armures ?? [], x)?.nom ?? null,
  // une fiche d'avant la décision R165 (une armure et son « élément ») : l'armure élémentaire qu'elle devient et le niveau des améliorations notées
  armureElementaire: (x) => trouver(regles.armures_elementaires ?? [], x)?.nom ?? null,
  amelioration: (x) => trouver(regles.ameliorations ?? [], x)?.niveau ?? null,
  emplacement: (x) => trouver(regles.emplacements_armure ?? [], x)?.nom ?? null,
  ressource: (x) => trouver(regles.ressources ?? [], x)?.nom ?? null,
  accessoire: (x) => trouver(regles.accessoires ?? [], x)?.libelle ?? null,
  competence: (x) => trouver(regles.competences ?? [], x)?.nom ?? null,
  famille: (x) => {
    const i = (regles.familles_armes ?? []).findIndex((f) => f.id === x);
    return i < 0 ? null : { nom: regles.familles_armes[i].nom, de: regles.familles_armes[i].de ?? null, ordre: i + 1 };
  },
  don: (x) => {
    for (const c of regles.classes ?? []) {
      const d = (c.dons ?? []).find((y) => y.id === x);
      if (d) return { nom: d.nom, classe: c.nom };
    }
    return null;
  },
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
  armureEnSuspens = null;   // une autre fiche (ou la fiche enregistrée) : son armure hors de la liste est retirée aussitôt (rafraichir)
  rafraichir();
}

async function enregistrer() {
  const bouton = $('fiche-enregistrer');
  bouton.disabled = true;
  // jamais une armure hors de la liste (décision R165 (7)) : celle qu'un geste laissait en suspens est retirée et notée
  arreterLeChoix();
  message('Enregistrement…', 'attente');
  try {
    const adresse = id ? `${API}personnages/${encodeURIComponent(id)}/` : `${API}personnages/`;
    const reponse = await fetch(adresse, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aEnvoyer(), [CHAMP_VERSION]: version }) });
    const donnees = await reponse.json().catch(() => ({}));
    if (reponse.ok) {
      serviceJoignable = true;   // il répond de nouveau : Télécharger suit de nouveau l'enregistrement
      appliquer(donnees);
      history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
      // les erreurs seules sont « à revoir » ; un avertissement (décision R170) est dit à part
      const g = controlesParGravite(controles);
      const avertis = g.avertissements ? `${g.avertissements} avertissement${g.avertissements > 1 ? 's' : ''}` : '';
      message(g.erreurs ? `Enregistré : ${g.erreurs} règle${g.erreurs > 1 ? 's' : ''} à revoir${avertis ? `, ${avertis}` : ''} (onglet « Contrôle »).`
        : avertis ? `Enregistré ✓ (${avertis}, onglet « Contrôle »).` : 'Enregistré ✓', 'ok');
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
  armureEnSuspens = null;
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
  arreterLeChoix();   // jamais une armure hors de la liste dans le classeur (décision R165 (7))
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
  // `armes_elementaires` : le détail de la règle arme_elementaire_hors_magie (décision R167) nomme l'arme
  for (const cle of ['races', 'ethnies', 'magies', 'dieux', 'metiers', 'classes', 'sorts', 'caracteristiques', 'competences', 'armes', 'armes_elementaires', 'armures', 'boucliers', 'accessoires']) {
    for (const x of regles[cle]) noms.set(x.id, x.nom ?? x.libelle ?? x.id);
  }
  for (const c of regles.classes) {
    for (const s of c.specialites) noms.set(s.id, `${c.nom} · ${s.nom}`);
    for (const g of c.choix) for (const o of g.options) noms.set(o.id, `${o.nom} (${c.nom})`);
    // les sources de maîtrise d'arme des contrôles maitrise_* (décision R148) : une ligne de classe, un don, comme les titres du bloc Maîtrises
    (c.maitrises ?? []).forEach((m, i) => { if (m.source) noms.set(m.source, `${c.nom} (maîtrise ${i + 1})`); });
    for (const d of c.dons ?? []) if (!noms.has(d.id)) noms.set(d.id, `${d.nom} (${c.nom})`);
  }
  for (const [cle, nom] of EMPLACEMENTS_ACCESSOIRES) noms.set(`accessoire:${cle}`, `Accessoire : ${nom}`);
  // les familles d'armes (une compétence du même identifiant, « arc », garde son nom)
  for (const f of regles.familles_armes) if (!noms.has(f.id)) noms.set(f.id, f.nom);
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
  // le retrait différé de l'armure hors de la liste (décision R165 (7), armureEnSuspens) : la cible de chaque geste, d'où vient le groupe du suspens ;
  // le choix est arrêté quand un clic ou le focus quitte ce groupe (hors du bloc de l'armure, où choisir une autre armure la remplace sans retrait),
  // après l'action du geste (un clic dans le même menu, une classe retirée puis remplacée, garde l'armure). Pas à « change » : Chrome et Firefox le
  // déclenchent à chaque option d'une liste parcourue aux flèches sous Windows, à chaque bouton radio, à chaque clic sur les flèches d'un nombre
  for (const type of ['pointerdown', 'keydown', 'focusin']) document.addEventListener(type, (ev) => { derniereCible = ev.target; }, { capture: true });
  const quitteLeGroupe = (ev) => {
    if (!armureEnSuspens) return;
    const cible = ev.target;
    // le groupe et le bloc de l'armure lus avant le geste (son action peut reconstruire la cible)
    const groupe = groupeDuControle(cible);
    const dansLArmure = cible instanceof Node && $('armures').contains(cible);
    setTimeout(() => {
      if (armureEnSuspens && !dansLArmure && groupe !== armureEnSuspens.groupe) arreterLeChoix();
    });
  };
  document.addEventListener('click', quitteLeGroupe, { capture: true });
  document.addEventListener('focusin', quitteLeGroupe, { capture: true });
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
  // le tiroir des choix : il se range quand la zone IV est à l'écran (zoneAEcran) ; « Aller aux choix » y descend et ouvre l'onglet « Choix »
  new IntersectionObserver((entrees) => {
    zoneParametresVisible = zoneAEcran(entrees);
    construireChoixEnAttente();
  }, { rootMargin: '0px 0px -15% 0px' }).observe(racine.querySelector('.parametres'));
  $('choix-aller').addEventListener('click', allerAuxChoix);
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
