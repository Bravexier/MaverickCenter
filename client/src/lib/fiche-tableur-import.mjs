// Import d'une fiche de personnage depuis un classeur (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et
// exportée à tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle. […] Toute info supplémentaire peut être notée dans les
// « Notes » »). L'onglet de la fiche (« Personnage », sinon le premier onglet qui suit l'une des deux dispositions : feuilleDeLaFiche) arrive sous la
// forme de lib/tableur-lecture.mjs (`{ nom, cellules: Map<'A1', { valeur, texte, remplissage, tronquee? }>, images }` ; feuilleDeGrille la fabrique
// depuis une grille de l'API Google) et suit l'une des deux dispositions de lib/fiche-tableur-cases.mjs : le modèle « ordinateur » que la page écrit
// (lib/fiche-tableur-export.mjs) ou la fiche auto V15.2.2 des joueurs.
// ficheDuClasseur rend une fiche au format de lib/fiche-format.mjs, prête pour la page /fiche/ comme l'import d'un JSON.
// Décisions :
//   - ne rien inventer (CLAUDE.md, règle d'or) : un nom écrit se retrouve par sa clé (cle()) dans son contexte (sorts : les magies du personnage, toutes
//     pour le Potentiel Illimité ; dons et spécialités : la classe ; ethnie : la race ; compétence d'un accessoire : la caractéristique de l'effet ;
//     élément d'armure écrit par sa magie : armure_elementaire.magie_id et la catégorie de l'armure), puis par le dernier segment de l'identifiant (les
//     corrections d'orthographe ont gardé les identifiants : « Balade guerrière », « Armure Vif Argent complet ») ; aucun candidat, ou plusieurs sans
//     départage écrit dans le classeur : l'information part dans `nonRepris`, que la page ajoute aux notes ;
//   - rien ne se perd sans être dit : chaque saisie du classeur est reprise, ou citée dans `nonRepris` avec sa valeur (zones que le site ne garde pas :
//     armure de chaque pièce et du bouclier, sac de l'inventaire, bonus et malus de l'armure ; solidité d'une arme sans solidité, sans arme reconnue ou
//     illisible ; lignes de la note en double ; image hors de A1) ; ce qui a pu se perdre avant l'import est dit dans `remarques` (case coupée par le
//     tableur, case relue finie par « … » sans sa suite) ;
//   - relus dans les deux dispositions : la case « Entraînement » (L42), les compétences de l'entraînement (décision R104 ; une ligne qui ne se lit pas
//     ainsi, une ligne de texte libre) ; dans le modèle ordinateur, la
//     solidité du moment de chaque arme (AK17, AX17 : « N / M », décision R74 ; à son maximum ou au-delà, rien d'enregistré ; un maximum écrit autre que
//     celui du site, une remarque). La case « Solidité » de la fiche auto (AK15, AX15) est un maximum calculé : pas relue ;
//   - ce que la fiche calcule (niveaux, totaux, dégâts, AP/AM, résistances, maximum de solidité…) n'est pas relu, sauf pour retrouver un choix que le
//     classeur n'écrit pas : un choix d'acquis « X ou Y » d'un don (décision R104 : l'acquis se calcule, l'acquis écrit lui est comparé, le bonus du
//     métier que comptait un classeur qui ne vient pas de la page étant celui qu'écrit sa case L41, bonusDuMetierEcrit — décision R72 : « Le métier
//     suit la base » ; plus que le calcul : `nonRepris`, moins : une remarque), les gains de niveau (décision R73 : les maximums de santé et de chakra lus, moins ce que la fiche calcule sans gains), la
//     compétence d'un accessoire « Compétence X » de la fiche auto (départagée par les bonus d'entraînement de la case L42, guide « Fiche de
//     personnage : Capacités/Dons »), la caractéristique du Potentiel Illimité ; chaque déduction est dite dans `remarques` ;
//   - un nombre : celui qu'écrit la case quand elle montre « % » (« 20% » : 20, pas 0,2), sinon sa valeur ; décimal là où la fiche veut un entier :
//     arrondi vers le bas, et une remarque ;
//   - la case NOTE : avant le dernier MARQUEUR_DES_NOTES (des notes collées peuvent en contenir un autre), les notes du joueur ; après, les lignes
//     « Clé : valeur » que la page écrit pour ce que le modèle n'a pas de case pour écrire (lireLaNote ; une clé en double : la première, les autres dans
//     `nonRepris`) ; une ligne inconnue revient dans les notes. Un classeur qui porte le marqueur vient de la page : ce qu'elle n'y écrit pas n'existe pas
//     (pas de gains de niveau déduits, pas de caractéristique déduite, pas d'ancien bonus du métier ni de remarque sur les acquis). Une ligne « Suite de
//     la case A1 : … » (un
//     texte trop long pour sa case, lib/tableur-mesure.mjs) se recolle au début resté dans la case avant toute lecture ; une case réécrite depuis (son
//     texte ne finit plus par « … ») garde son texte, et la ligne revient dans les notes. Un texte affiché seulement (effets des sorts, du catalogue…)
//     coupé par la page n'a pas de suite : il ne sert qu'à départager deux homonymes, et son début coupé compte alors pour lui (ecritComme) ;
//   - les écritures de la page (lignes de la note, objets, accessoires, armure, effet d'une arme, choix du métier) se relisent par les fonctions de
//     lib/fiche-tableur-export.mjs, qui les écrit : un seul jeu de lecteurs, l'aller et le retour ne divergent pas ; seule la fiche auto a les siens.
//     Aucune expression régulière ne revient sur ses pas sur une longue suite d'espaces (pas de préfixe paresseux suivi de blancs) : une case de
//     32 767 caractères se lit en un temps proportionnel à sa longueur ;
//   - puis la même chaîne que la page (caracteristiquesCompletes, ethnieImposee, magieAcquiseValable, classesSelonLaMagieInnee, donsValables,
//     choixDeMetierValables, maitriseChoixValables) ; ce qu'elle retire est dit dans `nonRepris` ;
//   - les maîtrises d'armes (décisions R148, R152, R153) : les choix de chaque source se relisent dans la note (lignes « Maîtrise d'arme au choix »,
//     lireChoixDeMaitrise), la famille de l'accessoire dans sa case ; les dés de la grille (couleurs du modèle ordinateur, « Nd » de la fiche auto) et
//     la famille d'une arme choisie (« Acquis au choix », entre parenthèses) se calculent : ils ne sont pas relus, mais comparés au calcul ; ce qui en
//     diffère est dit dans `nonRepris`, en une ligne au texte de la note datée de la base vivante (« Maîtrises d'armes avant la refonte : « ÉPÉES 3D10 ;
//     arme choisie : Flétrisseur (Tueur) DAGUES » », lib/fiche-format.mjs#texteDesMaitrisesDAvant) ; un classeur d'avant la refonte ne pose aucun choix
//     (R153), la compétence d'une arme choisie reste un choix d'acquis (R152) ;
//   - les listes ont la forme qu'envoie la page (aEnvoyer de src/scripts/fiche.mjs) : compétences non nulles dans l'ordre des règles, sorts, inventaire et
//     matériaux du bouclier numérotés, ceinture à son emplacement.
// N'importe que lib/fiche-moteur.mjs, lib/fiche-format.mjs, lib/sort-maitrise.mjs et les modules du tableur (lib/fiche-tableur-cases.mjs,
// lib/fiche-tableur-export.mjs, lib/tableur-mesure.mjs) : réservé au script de la page /fiche/ (deux scripts de page n'importent jamais le même module,
// skill site-version-portable ; jamais lib/text.mjs, partagé par la recherche).

import {
  ajouterAuxNotes, armureDesArmures, deuxArmures, entrainementEnLignes, ficheVide, maitrisesDAvant, NOMS_DES_EMPLACEMENTS_D_ACCESSOIRE, PREFIXE_DES_MAITRISES_D_AVANT,
  texteDesMaitrisesDAvant,
} from './fiche-format.mjs';
import {
  acquisApresChoix, acquisApresRepartition, acquisChoixValables, acquisDesDons, armesApresChoix, resistanceChoixValables, resistancesDe, attributsDe, bonusDuMetier, caracteristiquesCompletes, caracteristiquesDe, choixDeMetierValables, classesSelonLaMagieInnee, competencesDe,
  degatsDArme, donsValables, durabiliteAEcrire, durabiliteMaxDArme, effetsDesAccessoires, EMPLACEMENTS_ACCESSOIRES, ethnieImposee, ethniesDeLaRace,
  famillesMaitrisables, gainsDeNiveau, magieAcquiseValable, maitriseChoixValables, maitriseDArme, maitrisesParFamille, maitriseDesSorts, minimumDeLEmplacement,
  partiesApresReglage, sourcesDeMaitrise,
  armureParPartie, aUnLivre, bouclierDe, jetDuSortPrepare, partiesDeLArmure, sortsDesLivres, refusMagieAcquise, soliditeDuBouclierAEcrire, sortPrepare, trouver, armeDeLaLigne, typesDeDegats,
  modeHyperDe, actionsDeLaFiche,
} from './fiche-moteur.mjs';
import { coutEnUneCase } from './sort-cout.mjs';
import { valeurAuNm } from './sort-maitrise.mjs';
import { recollerLeTexte, sansLaCoupure } from './tableur-mesure.mjs';
import {
  CASES_CARACTERISTIQUES, CASES_COMPETENCES, CASES_POSTURES, casesDesDes, casesDuDon, cle, DONS, dispositionDe, EMPLACEMENTS_DU_MODELE, lettresDeColonne,
  CASES_AP_AM_DE_L_ARMURE, LONGUEUR_MAX_D_UNE_CASE, MAITRISES, MARQUEUR_DES_NOTES, MODELE_DE_LA_SOLIDITE, ORDINATEUR, REMPLISSAGE_DE_ATTEINT,
  TITRE_DE_L_INVENTAIRE,
} from './fiche-tableur-cases.mjs';
import {
  ARMURE_COMPLETE, FLECHE, NON, OUI, SEPARATEUR_D_ACCESSOIRE, SEPARATEUR_D_ARMURE, SUITE_DE_LA_CASE, apAmDuBouclier, enChiffres, lireAccessoire, lireChoixDuMetier, lireEffetDAmelioration,
  lireChoixDeMaitrise, lireEffetDArme, lireGains, lireLigneDArmure, lireLigneDeNote, lireListe, lireNiveauDAmelioration, lireNmOfferts, lireObjet, lireSortEnSuite,
  lireModeHyper, lireSortPrepare, partiesDeLArme, lireCompteurDAction, lireDonObtenu,
} from './fiche-tableur-export.mjs';

/** Message d'un onglet qui ne suit aucune des deux dispositions (dispositionDe). */
export const ERREUR_DISPOSITION = 'Ce classeur ne suit ni le modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » ni la fiche auto V15.2.2 (onglet « Personnage »).';

/**
 * Remarque d'un .csv au modèle ordinateur sans marque de dé ni choix de maîtrise dans la note : les dés atteints s'y écrivent par la couleur des cases,
 * qu'un .csv ne garde pas ; ceux d'un classeur d'avant la refonte (décision R153) ne peuvent donc pas être notés.
 */
export const REMARQUE_MAITRISES_CSV = 'Les dés des maîtrises d\'armes ne se lisent pas dans un .csv (les couleurs ne s\'y gardent pas) : ceux d\'un classeur d\'avant la refonte ne sont pas notés ; importez le .xlsx ou le .ods pour les garder dans les notes.';

/** Le Potentiel Illimité prend ses sorts dans toutes les magies (sortsPossibles de lib/fiche-moteur.mjs, même identifiant). */
const POTENTIEL_ILLIMITE = 'magies/potentiel-illimite';

/** Libellé des cases de la bourse (« Précieuse », « Or », « Fer » du modèle). */
const BOURSE = Object.freeze({ bourse_pp: 'précieuse', bourse_ro: 'or', bourse_rf: 'fer' });

// ------------------------------------------------------------------ lecture des cases

/**
 * Une feuille au format de lib/tableur-lecture.mjs depuis une grille de valeurs affichées (API Google Sheets : `values[ligne - 1][colonne - 1]`, ou
 * l'objet `{ range, values }` qui la contient) : valeur = texte = la chaîne, sans remplissage ni image. Sert aux fiches auto lues par l'API et aux tests.
 */
export function feuilleDeGrille(grille, nom = 'Personnage') {
  const values = Array.isArray(grille) ? grille : grille?.values ?? [];
  const cellules = new Map();
  values.forEach((ligne, i) => (ligne ?? []).forEach((v, j) => {
    if (v === '' || v === null || v === undefined) return;
    cellules.set(`${lettresDeColonne(j + 1)}${i + 1}`, { valeur: v, texte: String(v), remplissage: null });
  }));
  return { nom, cellules, images: [] };
}

/** Le texte affiché d'une case (cellule ou chaîne), fins de ligne en « \n », sans rien retirer d'autre ; '' pour une case vide. */
function texteBrut(cellule) {
  if (cellule === null || cellule === undefined) return '';
  const t = typeof cellule === 'object' ? cellule.texte ?? (cellule.valeur === null || cellule.valeur === undefined ? '' : String(cellule.valeur)) : String(cellule);
  return t.replace(/\r\n?/g, '\n');
}
const texteDe = (cellule) => texteBrut(cellule).trim();

/**
 * Le nombre d'une case : celui qu'écrit son texte quand il montre « % » (« 20% » : 20 ; le tableur en garde 0,2), sinon sa valeur quand le tableur en
 * donne une, sinon le premier nombre de son texte, espaces retirés (« 20 600 » = 20600 ; « 20600 / 23450 » = 20600 ; « 12,5 » = 12,5) ; null s'il n'y
 * en a pas. Peut être décimal : la fiche arrondit vers le bas (et le dit) là où elle veut un entier.
 */
export function nombreDe(cellule) {
  const t = texteBrut(cellule);
  const v = cellule?.valeur;
  if (typeof v === 'number' && Number.isFinite(v) && !t.includes('%')) return v;
  const m = /[-−]?\d+(?:[.,]\d+)?/.exec(t.replace(/[\s  ]+/g, ''));
  return m ? Number(m[0].replace('−', '-').replace(',', '.')) : null;
}

/** « a / b » → [a, b] (nombreDe de chaque côté du « / ») ; sans « / », [nombre, null]. */
export function paireDe(cellule) {
  const t = texteBrut(cellule);
  const i = t.indexOf('/');
  if (i < 0) return [nombreDe(cellule), null];
  return [nombreDe(t.slice(0, i)), nombreDe(t.slice(i + 1))];
}

const COCHE = new Set(['TRUE', 'VRAI', 'X', '✔', '✓', 'OUI']);
/** Une case cochée : vrai, un nombre non nul, « TRUE », « VRAI », « X », « ✔ », « ✓ », « oui » ; tout le reste (faux, 0, « FALSE », vide) ne l'est pas. */
export function estCoche(cellule) {
  const v = cellule?.valeur;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const t = texteDe(cellule);
  if (/^[-−]?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.').replace('−', '-')) !== 0;
  return COCHE.has(t.toUpperCase());
}

/** Une marque écrite dans une case (dé de maîtrise atteint, posture du moment) : ✔ ✓ ● ■ ★ *, ou un x isolé. */
export const porteUneMarque = (texte) => /[✔✓●■★*]/.test(texte) || /(^|\s)[xX](?=\s|$)/.test(texte);

/**
 * Un texte écrit par la page, peut-être coupé (« … » final : un texte affiché trop long pour sa case, lib/tableur-mesure.mjs) : le même que `attendu`
 * (comparés par cle()), ou son début.
 */
function ecritComme(ecrit, attendu) {
  const debut = sansLaCoupure(ecrit);
  if (debut === null) return cle(ecrit) === cle(attendu);
  return cle(debut) !== '' && cle(attendu).startsWith(cle(debut));
}

/** Les lignes non vides d'un texte, sans leurs espaces de bord. */
const lignesDe = (texte) => String(texte ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
/** Les parties d'un texte écrit sur plusieurs lignes ou sur une ligne, séparées par « · » (description d'un sort, lib/fiche-tableur-export.mjs). */
const segmentsDe = (texte) => String(texte ?? '').split(/\n| · /).map((l) => l.trim()).filter(Boolean);

// ------------------------------------------------------------------ la case NOTE

/**
 * La case NOTE : { marqueur (la page l'a écrite), notes (le texte avant le dernier marqueur, sans ses lignes vides de fin ; null s'il est vide), valeurs:
 * { nom: [valeur] } (lignes reconnues par lireLigneDeNote : biClasse, gains, sorts…, CLES_DE_LA_NOTE ; une seule par clé, sauf les événements, les textes de l’entraînement, les maîtrises et les acquis au choix, les compteurs d'actions (R173),
 * les résistances au choix et le sort préparé (un seul par fiche, mais l'import dit pourquoi le second ne l'est pas : décision R115) ;
 * accessoires : [{ emplacement, valeur }], un par emplacement), suites: Map<adresse, { valeur, ligne }> (la suite d'un texte coupé, la première par case),
 * autres: [ligne] (lignes après le marqueur que rien ne reconnaît : elles reviennent dans les notes), doubles: [ligne] (une clé déjà lue) }. Les lignes
 * d'information (refaites à chaque export) sont ignorées. Le dernier marqueur : des notes collées d'une autre fiche peuvent en porter un.
 */
export function lireLaNote(texte) {
  const lignes = texteBrut(texte).split('\n');
  const repere = cle(MARQUEUR_DES_NOTES);
  let i = -1;
  for (let k = lignes.length - 1; k >= 0 && i < 0; k -= 1) if (lignes[k].trim() === MARQUEUR_DES_NOTES || cle(lignes[k]) === repere) i = k;
  const avant = i < 0 ? [...lignes] : lignes.slice(0, i);
  while (avant.length && !avant[avant.length - 1].trim()) avant.pop();
  const valeurs = {};
  const suites = new Map();
  const autres = [];
  const doubles = [];
  for (const ligne of i < 0 ? [] : lignes.slice(i + 1)) {
    if (!ligne.trim()) continue;
    const lue = lireLigneDeNote(ligne);
    if (!lue) autres.push(ligne);
    else if (lue.information) continue;
    else if (lue.nom === 'suite') {
      if (suites.has(lue.adresse)) autres.push(ligne);
      else suites.set(lue.adresse, { valeur: lue.valeur, ligne });
    } else if (lue.nom === 'accessoire') {
      if ((valeurs.accessoires ??= []).some((a) => a.emplacement === lue.emplacement)) doubles.push(ligne);
      else valeurs.accessoires.push({ emplacement: lue.emplacement, valeur: lue.valeur });
    } else if (['evenement', 'entrainementTexte', 'maitriseChoix', 'donObtenu', 'acquisChoix', 'resistanceChoix', 'sortPrepare', 'compteurAction'].includes(lue.nom)) (valeurs[lue.nom] ??= []).push(lue.valeur);
    else if (valeurs[lue.nom]) doubles.push(ligne);
    else valeurs[lue.nom] = [lue.valeur];
  }
  return { marqueur: i >= 0, notes: avant.length ? avant.join('\n') : null, valeurs, suites, autres, doubles };
}

/**
 * Les bonus d'entraînement écrits dans la case « Entraînement » (L42) de la fiche auto : « 2 Magie | 10 Concentration » ou « Concentration 10 | Magie 2 »
 * → Map competence_id → points ; null pour une case vide ou qu'on ne lit pas en entier. Guide « Fiche de personnage : Capacités/Dons » : la case note
 * « tous les bonus relatifs à l'avancée des différents entraînements » (15 compétences au plus, 10 % au plus) ; la fiche auto les compte dans l'acquis
 * qu'elle affiche. Depuis la décision R104, ces bonus sont les lignes de l'entraînement de la fiche (personnage_entrainement), comptés dans l'Acquis
 * calculé ; ils départagent aussi la compétence d'un accessoire.
 */
export function bonusDEntrainement(regles, texte) {
  const brut = String(texte ?? '').trim();
  if (!brut) return null;
  const bonus = new Map();
  for (const morceau of brut.split('|').map((x) => x.trim())) {
    // « 2 Magie » (le nombre en tête, « % » permis), sinon « Magie 2 » (le nombre à la fin) ; rien qui revienne sur ses pas
    let m = /^(\d+)(?:\s*%)?\s+(\S.*)$/.exec(morceau);
    let n;
    let nom;
    if (m) [n, nom] = [Number(m[1]), m[2]];
    else if ((m = /\s(\d+)\s*%?$/.exec(morceau))) [n, nom] = [Number(m[1]), morceau.slice(0, m.index)];
    else return null;
    const k = regles.competences.filter((c) => cle(c.nom) === cle(nom) || c.id === cle(nom));
    if (k.length !== 1) return null;
    bonus.set(k[0].id, (bonus.get(k[0].id) ?? 0) + n);
  }
  return bonus;
}

/** Blancs d'une case (espaces insécables comprises), ramenés à une espace par bonusDuMetierEcrit. */
const BLANCS = /[\s\u00a0\u202f]+/g;
const estBlanc = (c) => c !== undefined && /[\s\u00a0\u202f]/.test(c);
const estChiffre = (c) => c !== undefined && c >= '0' && c <= '9';
/** Ce qui fait d'un « N% » un malus (trait d'union, signe moins, tiret demi-cadratin), que bonusDuMetierEcrit ne lit pas comme le bonus qu'écrit le nombre. */
const MOINS = new Set(['-', '\u2212', '\u2013']);
/** Les mots d'un texte, joints par « - » (cle() ; l'apostrophe d'une élision sépare deux mots : « d'Esquive » → « d-esquive »). */
const motsDe = (texte) => cle(String(texte ?? '').replace(/['’]/g, ' '));

/**
 * Les bonus de compétence qu'écrit la case du métier (L41) d'un classeur qui ne vient pas de la page : ceux que le classeur a comptés dans les acquis
 * qu'il affiche, que l'import retire de l'acquis écrit (décision R72 : « Le métier suit la base » — « L'ancien bonus est retiré, le nouveau s'applique, le
 * joueur ne garde que ses propres points ») ; Map competence_id → points (vide : la case n'en donne aucun, « → ? »), ou null quand on ne sait pas les
 * lire exactement. Lit l'écriture de la page (partiesDuMetier de lib/fiche-tableur-export.mjs : rangs à choix « … → Compétence », autres rangs,
 * « Artisanat : … = N % », séparés par « · ») et celle de la fiche auto (« 4% Connaissance. Peut fabriquer des livres magiques.\n(Artisanat …) »,
 * « Bonus +2% Reflexe, Esquive et Ruse. »). Le texte se découpe en morceaux (lignes, « · » entre deux blancs, parenthèses, « ; », « . » en fin de
 * phrase) ; dans un morceau, chaque « N% » (N entier, « + » et blancs permis) porte un bonus, sur la liste qui le suit jusqu'au bonus suivant (sans le
 * « + » ni le « et » qui les lient), jusqu'à « → » s'il y en a une :
 *   - une liste de compétences (noms ou identifiants, comparés par cle(), séparés par « , » et « et ») : N à chacune ;
 *   - une liste en « OU » : un choix, qu'écrit la flèche (« → Équilibre » : N à cette compétence, qui doit être de la liste ; « → ? » : rien, pas choisi) ;
 *     sans flèche, on ne sait pas lequel le classeur comptait : null ;
 *   - une liste qui ne nomme aucune compétence, même parmi d'autres mots (« = 60 % » de l'artisanat, « de bonus à la création de documents », « au lieu
 *     de 40% ») : pas un bonus de compétence, ignoré — sauf avec une flèche (« dans une compétence sociale au choix → Diplomatie ») ;
 *   - une liste où se mêlent compétences et autres mots, une liste qui n'est pas de compétences mais en nomme une parmi d'autres mots (« en Esquive »,
 *     « aux jets d'Esquive »), un nombre décimal (« 2,5% »), une flèche vers ce qui n'est pas une compétence : null.
 * Un nom de compétence écrit avant son nombre (avant le premier « N% » d'un morceau : « Esquive +3%, Réflexe +3% », « Esquive : +3% » ; ou dans la
 * liste qui précède un « N% » sans liste : « +3% Esquive, Réflexe +2% ») : on ne sait pas à quel nombre il va, null. Un nombre précédé d'un signe moins
 * (MOINS, blancs permis : « Malus -2% Esquive », « − 2 % ») : un malus, null. Aucun bonus de compétence lu : null. Un texte coupé (fini par « … »,
 * lib/tableur-mesure.mjs) : son dernier morceau est incertain, null s'il porte un « % ». Linéaire : les blancs ramenés à une espace, puis des découpages
 * par chaînes fixes, sans expression régulière qui revienne sur ses pas ; un nom de compétence parmi d'autres mots se cherche mot à mot, sur des suites
 * d'au plus autant de mots que le plus long nom (motsDe).
 * N'importe ni lib/text.mjs ni lib/metier-champs.mjs (partagés par d'autres scripts de page).
 */
export function bonusDuMetierEcrit(regles, texte) {
  const ecrit = String(texte ?? '').replace(/\r\n?/g, '\n');
  if (!ecrit.trim()) return null;
  const montre = sansLaCoupure(ecrit);
  const brut = montre ?? ecrit;
  const parCle = new Map();
  for (const k of regles.competences) {
    parCle.set(k.id, k.id);
    parCle.set(cle(k.nom), k.id);
  }
  const competence = (nom) => parCle.get(cle(nom)) ?? null;
  // une compétence nommée parmi d'autres mots : ses écritures en mots (nom, identifiant), cherchées à chaque mot du texte sur au plus `longueur` mots
  const enMots = new Set();
  let longueur = 1;
  for (const k of regles.competences) {
    for (const e of [motsDe(k.id), motsDe(k.nom)].filter(Boolean)) {
      enMots.add(e);
      longueur = Math.max(longueur, e.split('-').length);
    }
  }
  const nommeUneCompetence = (texte) => {
    const mots = motsDe(texte).split('-').filter(Boolean);
    for (let i = 0; i < mots.length; i += 1) {
      let suite = mots[i];
      if (enMots.has(suite)) return true;
      for (let n = 1; n < longueur && i + n < mots.length; n += 1) {
        suite = `${suite}-${mots[i + n]}`;
        if (enMots.has(suite)) return true;
      }
    }
    return false;
  };
  // les morceaux, en une passe
  const morceaux = [];
  let debut = 0;
  for (let i = 0; i <= brut.length; i += 1) {
    const c = brut[i];
    const fin = i === brut.length || c === '\n' || c === '(' || c === ')' || c === ';'
      || (c === '·' && estBlanc(brut[i - 1]) && estBlanc(brut[i + 1]))
      || (c === '.' && (i + 1 === brut.length || estBlanc(brut[i + 1])));
    if (fin) {
      morceaux.push(brut.slice(debut, i));
      debut = i + 1;
    }
  }
  if (montre !== null && morceaux.at(-1).includes('%')) return null;
  const bonus = new Map();
  let lus = 0;
  for (const morceau of morceaux) {
    const m = morceau.replace(BLANCS, ' ').toLowerCase();
    // les « N% » du morceau : le nombre lu en remontant depuis « % » (blancs, puis chiffres)
    const nombres = [];
    for (let i = m.indexOf('%'); i >= 0; i = m.indexOf('%', i + 1)) {
      let j = i - 1;
      while (j >= 0 && m[j] === ' ') j -= 1;
      let k = j;
      while (k >= 0 && estChiffre(m[k])) k -= 1;
      if (k === j) continue;
      if ((m[k] === ',' || m[k] === '.') && estChiffre(m[k - 1])) return null; // un décimal : ce n'est pas un bonus de la base
      let signe = k;
      while (signe >= 0 && m[signe] === ' ') signe -= 1;
      if (MOINS.has(m[signe])) return null; // un malus (« -2% », « − 2 % ») : pas le bonus qu'écrit le nombre
      nombres.push({ debut: k + 1, n: Number(m.slice(k + 1, j + 1)), apres: i + 1 });
    }
    // un nom de compétence avant le premier nombre (« Esquive +3%, Réflexe +3% ») : on ne sait pas à quel nombre il va
    if (nombres.length && nommeUneCompetence(m.slice(0, nombres[0].debut))) return null;
    let precedente = '';
    for (const [x, p] of nombres.entries()) {
      const reste = m.slice(p.apres, x + 1 < nombres.length ? nombres[x + 1].debut : m.length);
      const f = reste.indexOf(FLECHE);
      let liste = (f >= 0 ? reste.slice(0, f) : reste).trim();
      // ce qui lie au bonus suivant (« Réflexe et +2 % Ruse ») n'est pas de la liste
      if (liste.endsWith('+')) liste = liste.slice(0, -1).trim();
      if (liste === 'et' || liste.endsWith(' et')) liste = liste.slice(0, -2).trim();
      if (liste.endsWith(',')) liste = liste.slice(0, -1).trim();
      const enOu = ` ${liste} `.split(' ou ').map((t) => t.trim());
      const noms = (enOu.length > 1 ? enOu : liste.split(',').flatMap((t) => ` ${t} `.split(' et '))).map((t) => t.trim()).filter(Boolean);
      const ids = noms.map(competence);
      const toutes = ids.length > 0 && ids.every(Boolean);
      const aucune = ids.every((id) => !id);
      if (!toutes && !aucune) return null;
      // pas une liste de compétences, mais une compétence parmi d'autres mots (« +3% en Esquive », « +2% aux jets d'Esquive ») : pas lue exactement
      if (aucune && nommeUneCompetence(liste)) return null;
      // un nombre sans liste après une liste qui nomme une compétence (« +3% Esquive, Réflexe +2% ») : le nom est-il au nombre d'avant ou à celui-ci ?
      if (x > 0 && f < 0 && !liste && nommeUneCompetence(precedente)) return null;
      precedente = liste;
      if (f >= 0) {
        const choix = reste.slice(f + FLECHE.length).trim();
        lus += 1;
        if (choix === '?' || choix === '') continue;
        const id = competence(choix);
        if (!id || (toutes && !ids.includes(id))) return null;
        bonus.set(id, (bonus.get(id) ?? 0) + p.n);
      } else if (toutes) {
        if (enOu.length > 1) return null;
        lus += 1;
        for (const id of ids) bonus.set(id, (bonus.get(id) ?? 0) + p.n);
      }
    }
  }
  return lus ? bonus : null;
}

// ------------------------------------------------------------------ retrouver un nom

/** Dernier segment d'un identifiant (« races/humain#ethnie:humain-central » → « humain-central ») : la clé du nom d'origine, gardée par les corrections. */
const segment = (id) => String(id ?? '').split(/[#:/]/).pop();

/**
 * Les entrées de `liste` qu'écrit `texte` : celles dont le nom a sa clé ; à défaut, celles dont une autre écriture la porte (`autres(x)` : par défaut le
 * dernier segment de l'identifiant, l'ancienne graphie). [] pour un texte vide.
 */
function retrouver(liste, texte, { nom = (x) => x.nom, autres = (x) => [segment(x.id)] } = {}) {
  const k = cle(texte);
  if (!k) return [];
  const parNom = liste.filter((x) => cle(nom(x)) === k);
  return parNom.length ? parNom : liste.filter((x) => autres(x).some((a) => a === k));
}

/**
 * La famille d'armes qu'écrit un classeur, parmi `familles` : par son nom, sinon par son nom de lecture (décision R159, migration 0077 : une fiche
 * exportée avant que le site de dev renomme la famille écrit son nom d'alors) ; null sinon.
 */
const familleEcrite = (familles, nom) => familles.find((x) => cle(x.nom) === cle(nom)) ?? familles.find((x) => x.nom_lecture && cle(x.nom_lecture) === cle(nom)) ?? null;

/** Les écritures d'une magie : son nom court, l'identifiant, et l'identifiant sans « magie-du- », « magie-de-la- »… (« Magie de la Nécromancie »). */
const ecrituresDeMagie = (m) => [segment(m.id), segment(m.id).replace(/^magie-(?:du-|de-la-|des-|de-l|de-)/, '')];

/** Un nom d'arme de la fiche auto sans la mention de ses mains entre parenthèses (« Arbalète à bras\n(une main) ») ; lu depuis la fin, sans retour en arrière. */
function sansLesMains(nom) {
  const brut = String(nom ?? '').trim();
  const i = brut.endsWith(')') ? brut.lastIndexOf('(') : -1;
  return i >= 0 && /^\s*(?:une|deux|1|2)\b[^()]*mains?\s*$/i.test(brut.slice(i + 1, -1)) ? brut.slice(0, i).trim() : brut;
}

// ------------------------------------------------------------------ l'import

/**
 * La fiche que décrit l'onglet « Personnage » d'un classeur (voir l'en-tête). `feuille` : `{ cellules: Map, images }` (lib/tableur-lecture.mjs,
 * feuilleDeGrille). `logo` : les octets du logo du modèle (une image identique n'est pas un portrait) ; `empreintePortrait` : celle du portrait de la fiche
 * ouverte (un classeur exporté avec ce portrait le garde, avec son cadrage). `format` : celui du fichier lu ('xlsx', 'ods', 'csv' : un .csv ne garde pas
 * les couleurs des maîtrises). `nomFichier` et `date` servent à la page pour la ligne d'en-tête des notes (« [JJ/MM/AAAA] Import du classeur « … » : ») ;
 * acceptés ici pour la même signature.
 * { fiche, disposition: 'ordinateur' | 'auto', nonRepris: [texte], remarques: [texte], image: Image | null, portraitGarde }.
 * Une disposition inconnue lève une Error (ERREUR_DISPOSITION).
 */
export function ficheDuClasseur(regles, feuille, { nomFichier = '', date = 'JJ/MM/AAAA', logo = null, empreintePortrait = null, format = null } = {}) {
  let cellules = feuille?.cellules instanceof Map ? feuille.cellules : new Map(Object.entries(feuille?.cellules ?? {}));
  const cellule = (adresse) => cellules.get(adresse) ?? null;
  const texte = (adresse) => texteDe(cellule(adresse));
  const nombre = (adresse) => nombreDe(cellule(adresse));
  const d = dispositionDe(texte);
  if (!d) throw new Error(ERREUR_DISPOSITION);
  const auto = d.disposition === 'auto';
  const nonRepris = [];
  const remarques = [];
  const perdu = (ligne) => nonRepris.push(ligne);
  const nomDe = (liste, id) => trouver(liste, id)?.nom ?? id;
  const libelleDEmplacement = (e) => EMPLACEMENTS_ACCESSOIRES.find(([k]) => k === e)?.[1] ?? NOMS_DES_EMPLACEMENTS_D_ACCESSOIRE[e] ?? e;

  /** Un nombre lu là où la fiche veut un entier : décimal, arrondi vers le bas, et une remarque (« Bourse (or) : « 12,5 » lu 12 »). */
  const entierDe = (n, ecrit, quoi) => {
    if (n === null || Number.isInteger(n)) return n;
    const bas = Math.floor(n);
    remarques.push(`${quoi} : « ${ecrit} » lu ${bas}`);
    return bas;
  };
  const entierLu = (adresse, quoi) => entierDe(nombre(adresse), texte(adresse), quoi);

  /**
   * Le seul candidat ; sinon une ligne de `nonRepris` (`quoi` : « Race », « Arme 1 »… ; `ou` : « dans les règles », « parmi les ethnies de … » ;
   * `precisions` : ce qui accompagne la valeur dans le classeur, entre parenthèses).
   */
  const unSeul = (candidats, quoi, valeur, { ou = 'dans les règles', departager = null, nom = (x) => x.nom, precisions = '' } = {}) => {
    let reste = candidats;
    if (reste.length > 1 && departager) reste = departager(reste);
    if (reste.length === 1) return reste[0];
    const ecrit = `« ${valeur} »${precisions ? ` (${precisions})` : ''}`;
    if (!candidats.length) perdu(`${quoi} : ${ecrit} introuvable ${ou}`);
    else perdu(`${quoi} : ${ecrit} désigne plusieurs entrées des règles (${candidats.map(nom).join(', ')}), rien dans le classeur pour les départager`);
    return null;
  };

  // ---- ce qui a pu se perdre avant l'import : une case coupée par la lecture (lib/tableur-lecture.mjs), la case NOTE pleine
  for (const [adresse, c] of cellules) if (c?.tronquee) remarques.push(`Case ${adresse} : trop longue, coupée à la lecture du classeur ; sa fin n'est pas reprise`);
  const note = lireLaNote(cellule(d.note));
  const noteBrute = texteBrut(cellule(d.note));
  if (noteBrute.length >= LONGUEUR_MAX_D_UNE_CASE - 1 && !cellule(d.note)?.tronquee) {
    if (noteBrute.trimEnd().endsWith('…')) {
      remarques.push(`Case NOTE (${d.note}) : ${enChiffres(noteBrute.length)} caractères finis par « … », la limite d'une case de tableur : sa fin a été coupée et n'est pas reprise`);
    } else if (note.marqueur && note.notes?.endsWith('…')) {
      remarques.push(`Notes : raccourcies à l'export (la case NOTE est pleine : ${enChiffres(noteBrute.length)} caractères) ; leur fin n'est pas dans le classeur`);
    }
  }
  for (const ligne of note.doubles) perdu(`Note : ligne « ${ligne.trim()} » en double, seule la première de cette clé est lue`);

  // les textes relus coupés par la page : la suite, lue dans la note, recollée au début resté dans la case (une copie des cases : la feuille n'est pas
  // touchée) ; une case recollée ne porte plus que sa part relue
  const recollees = new Set();
  if (!auto && note.suites.size) {
    cellules = new Map(cellules);
    for (const [adresse, { valeur, ligne }] of note.suites) {
      const c = adresse === d.note ? null : cellules.get(adresse);
      const entier = c ? recollerLeTexte(texteBrut(c), valeur) : null;
      if (entier === null) note.autres.push(ligne);
      else {
        cellules.set(adresse, { ...c, valeur: entier, texte: entier });
        recollees.add(adresse);
      }
    }
  } else note.autres.push(...[...note.suites.values()].map((x) => x.ligne));
  const deLaPage = note.marqueur;
  const notee = (champ) => note.valeurs[champ] ?? [];

  // ---- un classeur de la page : une case relue entière (lib/fiche-tableur-export.mjs) finie par « … » sans sa suite dans la note a perdu sa fin. Cela
  // n'arrive que si la page a dû retirer des lignes de données d'une note pleine (texteDeLaNote : ligne « Lignes retirées (case NOTE pleine) : N ») ;
  // sinon un « … » final est celui du joueur (« le Taciturne… »).
  const retirees = notee('lignesRetirees')[0];
  if (retirees) remarques.push(`Note : ${Number(retirees) > 1 ? `${retirees} lignes de données retirées` : 'une ligne de données retirée'} à l'export, la case NOTE étant pleine : ce qu'elle${Number(retirees) > 1 ? 's' : ''} portai${Number(retirees) > 1 ? 'en' : ''}t n'est pas repris`);
  if (deLaPage && !auto && retirees) {
    const O = ORDINATEUR;
    const relues = [O.nom, O.surnom, O.lieuOrigine, O.race, O.magieInnee, O.magieAcquise, O.dieuChoisi, O.xp, O.classe1, O.classe2, O.specialite1,
      O.specialite2, ...O.armes.map((x) => x.nom), O.armure.bonus, O.bouclier.nom, O.bouclier.composition, ...Object.values(O.accessoires), ...O.ceinture,
      ...O.inventaire.colonnes.flatMap((c) => O.inventaire.lignes.map((l) => `${c}${l}`)), casesDuDon(DONS.race).nom, casesDuDon(DONS.metier).nom,
      casesDuDon(DONS.entrainement).effet,
      ...[...DONS.classe1, ...DONS.classe2].map((l) => casesDuDon(l).nom), ...DONS.evenements.flatMap((l) => [casesDuDon(l).nom, casesDuDon(l).effet]),
      ...O.sorts.lignes.map((l) => `${O.sorts.colonnes.nom}${l}`)];
    for (const adresse of relues) {
      if (recollees.has(adresse) || sansLaCoupure(texte(adresse)) === null) continue;
      remarques.push(`Case ${adresse} : « … » final sans ligne « ${SUITE_DE_LA_CASE} ${adresse} » dans la note : la fin de la case a été perdue, sauf si le « … » fait partie du texte`);
    }
  }

  const f = ficheVide(texte(d.nom));
  Object.assign(f, {
    surnom: texte(d.surnom) || null,
    lieu_origine: texte(d.lieuOrigine) || null,
    race_id: null, ethnie_id: null, magie_innee_id: null, magie_acquise_id: null, caracteristique_magie_id: null, dieu_choisi_id: null, metier_id: null,
    bouclier_classe_id: null, bouclier_materiau_id: null, bouclier_amelioration_id: null, bouclier_solidite: null, sante_actuelle: null, chakra_actuel: null, barriere_actuelle: null, corruption: null, barre4_actuelle: null,
    notes: null, evenements: null, posture_id: null, symbiose_magie_id: null,
  });

  // ---- identité, race, magies, ethnie, dieu, alignement, bourse, XP
  if (texte(d.race)) f.race_id = unSeul(retrouver(regles.races, texte(d.race)), 'Race', texte(d.race))?.id ?? null;
  for (const [champ, adresse, quoi] of [['magie_innee_id', d.magieInnee, 'Magie innée'], ['magie_acquise_id', d.magieAcquise, 'Magie acquise']]) {
    if (texte(adresse)) f[champ] = unSeul(retrouver(regles.magies, texte(adresse), { autres: ecrituresDeMagie }), quoi, texte(adresse))?.id ?? null;
  }
  const race = trouver(regles.races, f.race_id);
  const texteEthnie = texte(casesDuDon(DONS.race).nom);
  if (texteEthnie) {
    f.ethnie_id = unSeul(retrouver(ethniesDeLaRace(regles, f.race_id), texteEthnie), 'Ethnie', texteEthnie,
      { ou: race ? `parmi les ethnies de la race ${race.nom}` : 'sans race reconnue' })?.id ?? null;
  }
  if (texte(d.dieuChoisi)) f.dieu_choisi_id = unSeul(retrouver(regles.dieux, texte(d.dieuChoisi)), 'Dieu choisi', texte(d.dieuChoisi))?.id ?? null;
  for (const [champ, adresse, quoi] of [['alignement_loyal', d.loyal, 'Alignement (loyal)'], ['alignement_chaotique', d.chaotique, 'Alignement (chaotique)'],
    ['alignement_bon', d.bon, 'Alignement (bon)'], ['alignement_mauvais', d.mauvais, 'Alignement (mauvais)'],
    ['bourse_pp', d.bourseP, `Bourse (${BOURSE.bourse_pp})`], ['bourse_ro', d.bourseO, `Bourse (${BOURSE.bourse_ro})`], ['bourse_rf', d.bourseF, `Bourse (${BOURSE.bourse_rf})`]]) {
    f[champ] = Math.max(0, entierLu(adresse, quoi) ?? 0);
  }
  f.xp = Math.max(0, entierLu(d.xp, 'XP') ?? 0);

  // ---- classes, spécialités, mode
  for (const [rang, aClasse, aSpecialite] of [[1, d.classe1, d.specialite1], [2, d.classe2, d.specialite2]]) {
    const t = texte(aClasse);
    const ts = texte(aSpecialite);
    if (!t) {
      if (ts) perdu(`Spécialité de la classe ${rang} : « ${ts} » sans classe`);
      continue;
    }
    const classe = unSeul(retrouver(regles.classes, t), `Classe ${rang}`, t);
    if (!classe) continue;
    const specialite = ts ? unSeul(retrouver(classe.specialites, ts), `Spécialité de ${classe.nom}`, ts) : null;
    f.classes.push({ rang, classe_id: classe.id, specialite_id: specialite?.id ?? null });
  }
  const bi = notee('biClasse')[0];
  if (bi !== undefined && [cle(OUI), cle(NON)].includes(cle(bi))) f.mode_classe = cle(bi) === cle(OUI) ? 'bi' : 'mono';
  else {
    if (bi !== undefined) perdu(`Bi-classé : « ${bi} » illisible (oui ou non)`);
    const [n1, n2, global] = [nombre(d.niveau1), nombre(d.niveau2), nombre(d.niveauGlobal)];
    f.mode_classe = f.classes.length === 2 && global !== null && n1 === global && n2 === global && global < 20 ? 'bi' : 'mono';
  }

  // ---- caractéristiques (base, croix)
  for (const c of CASES_CARACTERISTIQUES) {
    const base = entierLu(c.base, `${nomDe(regles.caracteristiques, c.id)} (base)`);
    const croix = c.croix.filter((a) => estCoche(cellule(a))).length;
    // une croix sans base : la base part du minimum, comme une case vide de la page (caracteristiquesCompletes)
    const min = race?.bornes?.[c.id]?.[0] ?? regles.constantes['caracteristique.base_min'];
    if (base !== null || croix) f.caracteristiques.push({ caracteristique_id: c.id, base: base ?? min, croix });
  }

  // ---- métier et ses choix (modèle ordinateur : « → compétence » sous le métier)
  const texteMetier = texte(casesDuDon(DONS.metier).nom);
  if (texteMetier && cle(texteMetier) !== cle('Métier ?')) f.metier_id = unSeul(retrouver(regles.metiers, texteMetier), 'Métier', texteMetier)?.id ?? null;
  const metier = trouver(regles.metiers, f.metier_id);
  if (metier && !auto) {
    // les rangs à choix, « <texte> → <compétence> » : par leur texte, sinon dans leur ordre (lib/fiche-tableur-export.mjs#partiesDuMetier)
    const ecrits = lireChoixDuMetier(texteBrut(cellule(casesDuDon(DONS.metier).effet)));
    const aChoix = metier.bonus.filter((b) => b.options.filter((o) => o.competence_id).length > 1);
    aChoix.forEach((b, k) => {
      const options = b.options.filter((o) => o.competence_id).map((o) => trouver(regles.competences, o.competence_id)).filter(Boolean);
      const ecrit = ecrits.find((x) => cle(x.texte) === cle(b.texte)) ?? ecrits[k];
      if (!ecrit?.choix) return;
      const c = unSeul(retrouver(options, ecrit.choix), `Métier ${metier.nom}, « ${b.texte} »`, ecrit.choix, { ou: 'parmi les compétences proposées' });
      if (c) f.metier_bonus.push({ rang: b.rang, competence_id: c.id });
    });
  }

  // ---- les dés des maîtrises d'armes, lus pour être comparés au calcul (décisions R148, R153 : ils se calculent, plus bas) : famille → dés écrits, au-delà
  // du dé sans maîtrise ; null quand la grille ne se lit pas (un .csv sans marque)
  const maitrise = maitriseDArme(regles);
  // modèle ordinateur : un dé atteint est une case remplie ou marquée ; un fond commun à toutes les cases de dés est celui du bloc (mise en forme), pas un
  // dé atteint — sauf le gris de la page (REMPLISSAGE_DE_ATTEINT : cinq dés partout)
  const casesDeDes = MAITRISES.flatMap(casesDesDes);
  const fonds = casesDeDes.map((a) => cellule(a)?.remplissage ?? null);
  const fondDuBloc = fonds[0] && fonds[0] !== REMPLISSAGE_DE_ATTEINT && fonds.every((x) => x === fonds[0]) ? fonds[0] : null;
  const atteint = (a) => (Boolean(cellule(a)?.remplissage) && cellule(a).remplissage !== fondDuBloc) || porteUneMarque(texte(a));
  const desIllisibles = !auto && format === 'csv' && !casesDeDes.some((a) => porteUneMarque(texte(a)));
  const desLus = desIllisibles ? null : new Map();
  for (const m of desIllisibles ? [] : MAITRISES) {
    const famille = nomDe(regles.familles_armes, m.famille);
    let des;
    if (auto) des = entierLu(`${m.cote === 'gauche' ? d.maitrises.gauche : d.maitrises.droite}${m.ligne}`, `Maîtrise ${famille}`);
    else des = maitrise.desSansMaitrise + casesDesDes(m).filter(atteint).length;
    if (des !== null && des > maitrise.desSansMaitrise) desLus.set(m.famille, des);
  }
  if (desIllisibles && !notee('maitriseChoix').length) remarques.push(REMARQUE_MAITRISES_CSV);

  // ---- accessoires
  const proprietes = [...new Map(regles.accessoires.map((a) => [a.propriete, a.propriete_nom ?? a.propriete])).entries()];
  const proprieteDe = (t) => proprietes.find(([id, nom]) => cle(nom) === cle(t) || id === cle(t)) ?? null;
  /** L'effet `libelle` d'une propriété (et sa valeur tirée, qui départage les fourchettes « Compétence F ») ; des lignes identiques comptent pour une. */
  const effetDAccessoire = (propriete, libelle, valeur) => {
    // un effet sans libellé (la table en a un par propriété au plus) s'écrit « Attaque : » : il se retrouve par sa propriété ; sans propriété écrite, le
    // libellé seul (la page n'écrit la propriété que quand il ne suffit pas)
    const candidats = regles.accessoires.filter((a) => (propriete === null || a.propriete === propriete) && cle(a.libelle) === cle(libelle));
    const dansLaFourchette = candidats.filter((a) => a.min === null || (valeur !== null && valeur >= a.min && valeur <= a.max));
    const reste = dansLaFourchette.length ? dansLaFourchette : candidats;
    // deux effets identiques (même libellé, même niveau, mêmes valeurs) comptent pour un ; d'une propriété à l'autre (« MALÉDICTION »), seulement si elle est écrite
    const contenu = (a) => JSON.stringify([propriete === null ? a.propriete : null, a.libelle, a.niveau, a.min, a.max, a.valeur, a.malediction, a.usage, a.effets]);
    return reste.length && new Set(reste.map(contenu)).size === 1 ? reste[0] : null;
  };
  const choixDAccessoire = (ligne, effet, choix, quoi) => {
    const competence = effet.effets.find((c) => c.cible === 'competence');
    if (competence) {
      const k = unSeul(retrouver(regles.competences.filter((x) => x.caracteristique_id === competence.cible_id), choix), quoi, choix,
        { ou: `parmi les compétences ${nomDe(regles.caracteristiques, competence.cible_id)}` });
      if (k) ligne.competence_id = k.id;
    } else if (effet.effets.some((c) => c.cible === 'degats_famille' || c.cible === 'maitrise_arme')) {
      // « +5 dégâts avec une catégorie d'arme », « Un point de maîtrise d'arme » (décisions R54, R151 : sa famille se choisit, jamais ARME DE MONSTRES)
      // la famille par son nom, sinon son nom de lecture (décision R159) ou l'identifiant
      const fam = unSeul(retrouver(famillesMaitrisables(regles), choix, { autres: (x) => [segment(x.id), cle(x.nom_lecture ?? '')].filter(Boolean) }), quoi, choix,
        { ou: 'parmi les familles d’armes' });
      if (fam) ligne.arme_famille_id = fam.id;
    } else perdu(`${quoi} : « ${choix} » sans choix à faire pour cet effet`);
  };
  // un accessoire : six emplacements, un effet de la table, ni nom ni effet hors table (décision R97) ; ce qu'un classeur écrit d'autre est dit perdu
  const nouvelAccessoire = (emplacement) => ({ emplacement, accessoire_effet_id: null, valeur: null, maudit: 0, competence_id: null, arme_famille_id: null });
  const garderAccessoire = (a) => {
    if (a.accessoire_effet_id) f.accessoires.push(a);
  };

  /**
   * Modèle ordinateur : les lignes d'une case d'accessoire, lues par lireAccessoire (lib/fiche-tableur-export.mjs, l'écriture courte et l'ancienne) ;
   * une ligne « Accessoire Ceinture : … » ou « Accessoire Autre : … » de la note d'un classeur d'avant : perdue (plus d'emplacement).
   */
  const accessoireDesLignes = (emplacement, lignes) => {
    const quoi = `Accessoire ${libelleDEmplacement(emplacement)}`;
    if (!EMPLACEMENTS_ACCESSOIRES.some(([e]) => e === emplacement)) {
      perdu(`${quoi} : « ${lignes.join(' / ')} » (la fiche n’a plus d’emplacement Ceinture ni Autre : décision R97)`);
      return;
    }
    const a = nouvelAccessoire(emplacement);
    const lu = lireAccessoire(regles, lignes);
    if (lu.nom && lu.ligne === null) perdu(`${quoi} : « ${lu.nom} » sans effet`);
    else if (lu.nom) perdu(`${quoi}, nom : « ${lu.nom} » (un accessoire n’a plus de nom : décision R97)`);
    if (lu.texte) perdu(`${quoi}, effet hors table : « ${lu.texte} » (décision R97)`);
    a.maudit = lu.maudit ? 1 : 0;
    const choix = lu.choix;
    if (lu.ligne !== null) {
      const effet = effetDAccessoire(lu.propriete === null ? null : proprieteDe(lu.propriete)?.[0] ?? null, lu.libelle, lu.valeur);
      if (effet) {
        a.accessoire_effet_id = effet.id;
        a.valeur = effet.min !== null ? lu.valeur : null;
      } else perdu(`${quoi} : « ${lu.ligne} » ne correspond à aucun effet de la table des accessoires`);
    }
    for (const ligne of lu.autres) perdu(`${quoi} : ligne « ${ligne} » sans place sur la fiche`);
    const effet = trouver(regles.accessoires, a.accessoire_effet_id);
    if (choix && choix !== '?' && effet) choixDAccessoire(a, effet, choix, quoi);
    else if (choix && choix !== '?') perdu(`${quoi} : choix « ${choix} » sans effet de la table`);
    garderAccessoire(a);
  };

  /** Valeur tirée d'un accessoire de la fiche auto : « 18% » ou 0,18 (pourcentage du tableur) → 18. */
  const valeurTiree = (c) => {
    if (typeof c?.valeur === 'number' && c.valeur > 0 && c.valeur < 1 && !/%/.test(texteDe(c))) return Math.round(c.valeur * 100);
    const t = texteDe(c).replace(/[\s  ]+/g, '').replace(',', '.');
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n)) return null;
    return Math.round(!t.includes('%') && n > 0 && n < 1 ? n * 100 : n);
  };

  if (auto) {
    for (const emplacement of EMPLACEMENTS_DU_MODELE) {
      const cases = d.accessoires[emplacement];
      const tp = texte(cases.propriete);
      const te = texte(cases.effet);
      if (!te) continue;
      const a = nouvelAccessoire(emplacement);
      a.maudit = estCoche(cellule(cases.maudit)) ? 1 : 0;
      const valeur = valeurTiree(cellule(cases.valeur));
      const propriete = proprieteDe(tp);
      const caracteristique = regles.caracteristiques.find((k) => cle(k.nom) === cle(te));
      let effet = null;
      if (propriete?.[0] === 'competence' && caracteristique) {
        // « COMPETENCE » + « Intelligence » : l'effet « Compétence I » dont la fourchette contient la valeur tirée
        const dans = regles.accessoires.filter((x) => x.propriete === 'competence' && x.caracteristique_id === caracteristique.id && valeur !== null
          && valeur >= x.min && valeur <= x.max);
        effet = dans.length === 1 ? dans[0] : null;
      } else if (propriete) effet = effetDAccessoire(propriete[0], te, valeur);
      if (effet) {
        a.accessoire_effet_id = effet.id;
        a.valeur = effet.min !== null ? valeur : null;
      } else {
        perdu(`Accessoire ${libelleDEmplacement(emplacement)} : « ${te} »${tp ? ` (${tp})` : ''}${valeur !== null ? ` ${texte(cases.valeur)}` : ''} ne correspond à aucun effet de la table des accessoires`);
      }
      garderAccessoire(a);
    }
  } else {
    for (const emplacement of EMPLACEMENTS_DU_MODELE) {
      const lignes = lignesDe(texte(d.accessoires[emplacement]));
      if (lignes.length) accessoireDesLignes(emplacement, lignes);
    }
  }
  for (const { emplacement, valeur } of notee('accessoires')) accessoireDesLignes(emplacement, valeur.split(SEPARATEUR_D_ACCESSOIRE.trim()).map((l) => l.trim()).filter(Boolean));

  // ---- caractéristique de la magie innée (Potentiel Illimité : au choix)
  const innee = trouver(regles.magies, f.magie_innee_id);
  if (innee && !innee.caracteristique_id) {
    const ecrite = notee('caracteristiqueMagie')[0];
    if (ecrite !== undefined) {
      f.caracteristique_magie_id = unSeul(retrouver(regles.caracteristiques, ecrite), 'Caractéristique de la magie innée', ecrite)?.id ?? null;
    } else if (!deLaPage) {
      const accessoires = new Map(caracteristiquesDe(regles, f).map((c) => [c.id, c.accessoire]));
      const avecBonus = CASES_CARACTERISTIQUES.filter((c) => (nombre(c.bonus) ?? 0) - (accessoires.get(c.id) ?? 0) >= 1);
      if (avecBonus.length === 1) {
        f.caracteristique_magie_id = avecBonus[0].id;
        remarques.push(`Caractéristique de la magie innée (${innee.nom}) déduite du bonus du classeur : ${nomDe(regles.caracteristiques, avecBonus[0].id)}`);
      }
    }
  }

  // ---- la magie de la Symbiose (décision R100), dans la note : une magie du personnage, sinon perdue
  const symbiose = notee('symbioseMagie')[0];
  if (symbiose !== undefined) {
    const magie = unSeul(retrouver(regles.magies, symbiose), 'Magie de la symbiose', symbiose);
    if (magie && [f.magie_innee_id, f.magie_acquise_id].includes(magie.id)) f.symbiose_magie_id = magie.id;
    else if (magie) perdu(`Magie de la symbiose : « ${symbiose} » n’est pas une magie du personnage`);
  }

  // ---- le Mode Hyper (décision R172), dans la note : son état, s'il est débloqué au niveau du classeur, et le compteur de la semaine
  const ecritHyper = notee('modeHyper')[0];
  if (ecritHyper !== undefined) {
    const lu = lireModeHyper(ecritHyper);
    const h = modeHyperDe(regles, f);
    if (!lu || !h) perdu(`Mode Hyper : « ${ecritHyper} » illisible`);
    else {
      if (lu.mode_hyper && !h.debloque) perdu(`Mode Hyper : « ${ecritHyper} » : pas débloqué avant le niveau ${h.niveau}`);
      else if (lu.mode_hyper_100 && !h.cent.debloque) perdu(`Mode Hyper : « ${ecritHyper} » : le Mode Hyper 100 % n’est pas débloqué avant le niveau ${h.cent.niveau}`);
      f.mode_hyper = lu.mode_hyper && h.debloque ? 1 : 0;
      f.mode_hyper_100 = f.mode_hyper && lu.mode_hyper_100 && h.cent.debloque ? 1 : 0;
      if (lu.semaine !== null && h.semaine) f.mode_hyper_semaine = lu.semaine >= h.semaine.max ? null : lu.semaine;
    }
  }

  // ---- dons de classe : les dons à choix (les autres se déduisent), la spécialité d'après ses dons quand le classeur ne l'écrit pas
  for (const rang of [1, 2]) {
    const choix = f.classes.find((c) => c.rang === rang);
    const classe = trouver(regles.classes, choix?.classe_id);
    const ecrits = (rang === 1 ? DONS.classe1 : DONS.classe2).map((l) => ({ nom: texte(casesDuDon(l).nom), effet: texte(casesDuDon(l).effet) }))
      .concat(notee(`donsClasse${rang}`).flatMap(lireListe).map((nom) => ({ nom, effet: '' })))
      .filter((x) => x.nom);
    for (const ecrit of ecrits) {
      const quoi = `Don de la classe ${rang}${classe ? ` (${classe.nom})` : ''}`;
      if (!classe) {
        perdu(`${quoi} : « ${ecrit.nom} » sans classe reconnue`);
        continue;
      }
      const prefixe = `${segment(classe.id)}-`;
      const don = unSeul(retrouver(classe.dons, ecrit.nom, { autres: (x) => [segment(x.id).startsWith(prefixe) ? segment(x.id).slice(prefixe.length) : segment(x.id)] }),
        quoi, ecrit.nom, {
          // « Chant . », « Chant .. » du Goleois : le nom exact, puis l'effet écrit à côté
          departager: (c) => {
            const exact = c.filter((x) => x.nom.trim() === ecrit.nom);
            if (exact.length === 1) return exact;
            return c.filter((x) => ecrit.effet && cle(x.effet) === cle(ecrit.effet));
          },
        });
      if (!don) continue;
      if (don.specialite_id) {
        if (!choix.specialite_id) choix.specialite_id = don.specialite_id;
        else if (don.nature === 'specialite' && don.specialite_id !== choix.specialite_id) {
          perdu(`${quoi} : « ${ecrit.nom} » est le don de la spécialité ${nomDe(classe.specialites, don.specialite_id)}, la spécialité choisie est ${nomDe(classe.specialites, choix.specialite_id)}`);
        }
      }
      if (don.nature === 'choix' && !f.capacites.some((x) => x.capacite_id === don.id)) f.capacites.push({ capacite_id: don.id });
    }
  }

  // ---- la chaîne de la page ; ce qu'elle retire est dit
  f.caracteristiques = caracteristiquesCompletes(regles, f);
  const ethnieLue = f.ethnie_id;
  f.ethnie_id = ethnieImposee(regles, f) ?? f.ethnie_id;
  if (ethnieLue && ethnieLue !== f.ethnie_id) {
    perdu(`Ethnie « ${nomDe(regles.ethnies, ethnieLue)} » : remplacée par ${nomDe(regles.ethnies, f.ethnie_id)}, la seule de la race qui aille avec la magie innée ${innee?.nom}`);
  }
  const acquiseLue = f.magie_acquise_id;
  const refus = acquiseLue ? refusMagieAcquise(regles, f, acquiseLue) : null;
  f.magie_acquise_id = magieAcquiseValable(regles, f);
  if (acquiseLue && !f.magie_acquise_id) perdu(`Magie acquise « ${nomDe(regles.magies, acquiseLue)} » : ${refus}`);
  const classesLues = f.classes;
  f.classes = classesSelonLaMagieInnee(regles, f);
  for (const c of classesLues) {
    if (!f.classes.some((x) => x.rang === c.rang && x.classe_id === c.classe_id)) {
      const imposee = f.classes.find((x) => x.rang === c.rang);
      perdu(`Classe ${c.rang} « ${nomDe(regles.classes, c.classe_id)} » : ${imposee ? `remplacée par ${nomDe(regles.classes, imposee.classe_id)}, imposée` : 'fermée'} par la magie innée ${innee?.nom}`);
    }
  }
  const nomDuDon = (id) => regles.classes.flatMap((c) => c.dons.map((x) => [x, c])).find(([x]) => x.id === id) ?? [];
  const donsLus = f.capacites;
  f.capacites = donsValables(regles, f);
  for (const c of donsLus) {
    if (f.capacites.some((x) => x.capacite_id === c.capacite_id)) continue;
    const [don, classe] = nomDuDon(c.capacite_id);
    perdu(`Don « ${don?.nom ?? c.capacite_id} » (${classe?.nom ?? '?'}) : hors des classes ou de la spécialité de la fiche`);
  }
  const metierLus = f.metier_bonus;
  f.metier_bonus = choixDeMetierValables(regles, f);
  for (const c of metierLus) if (!f.metier_bonus.includes(c)) perdu(`Métier : choix « ${nomDe(regles.competences, c.competence_id)} » du rang ${c.rang} hors des options`);

  // ---- les choix de maîtrise d'arme (décision R148), lignes « Maîtrise d'arme au choix » de la note : « <source> : <famille>, <famille>, ? »
  // (lireChoixDeMaitrise) ; la source par son titre parmi celles de la fiche (lignes des classes prises, dons acquis), chaque famille par son bandeau
  // parmi les options de son point ; un point que la source n'a pas, ou une famille qu'elle ne propose pas (ARME DE MONSTRES comprise, R45), n'est pas
  // repris. La famille de l'accessoire « Un point de maîtrise d'arme » est dans sa case (« → ÉPÉES »), déjà lue.
  const sourcesAChoisir = sourcesDeMaitrise(regles, f).filter((s) => s.type !== 'accessoire');
  for (const ligne of notee('maitriseChoix')) {
    const quoi = `Maîtrise d'arme au choix « ${ligne} »`;
    const lu = lireChoixDeMaitrise(ligne);
    const source = lu && sourcesAChoisir.find((s) => cle(s.titre) === cle(lu.titre) && !f.maitrise_choix.some((x) => x.source === s.source));
    if (!source) {
      perdu(`${quoi} : ${lu ? 'aucune source de maîtrise de ce nom dans les classes et les dons de la fiche' : 'illisible (une source, puis une famille par point)'}`);
      continue;
    }
    const part = source.parts.find((p) => p.genre === 'choix');
    lu.familles.forEach((nom, i) => {
      if (nom === null) return;
      const famille = familleEcrite(regles.familles_armes, nom);
      if (!famille) perdu(`${quoi} : « ${nom} » introuvable parmi les familles d’armes`);
      else if (!part || i >= part.points) perdu(`${quoi} : ${source.titre} n’a pas de point ${i + 1} à choisir`);
      else if (!part.options.includes(famille.id)) perdu(`${quoi} : ${famille.nom} n’est pas proposée par ${source.titre}`);
      else f.maitrise_choix.push({ source: source.source, rang: i + 1, arme_famille_id: famille.id });
    });
  }
  f.maitrise_choix = maitriseChoixValables(regles, f);

  // ---- les dons obtenus des dons « Variable » du Mage Bleu (décision R181), lignes « Don obtenu » de la note : « <don> (<classe>) : <entrée> (<magie>) »
  // (lireDonObtenu) ; le don par son nom parmi les dons « Variable » de la classe nommée, l'entrée par son nom sur la ligne de la magie nommée du tableau
  // de cette classe, jamais rapprochés ; un don une fois, une entrée une fois. Un choix d'un don qui n'est pas acquis, ou hors de la liste du don, est
  // repris tel quel : gardé sans effet, signalé par la base (comme sur la page)
  f.dons_obtenus = [];
  for (const ligne of notee('donObtenu')) {
    const quoi = `Don obtenu « ${ligne} »`;
    const lu = lireDonObtenu(ligne);
    const classe = lu && (regles.classes ?? []).find((c) => cle(c.nom) === cle(lu.classe));
    const don = classe && (classe.dons ?? []).find((d) => d.magie_visee && cle(d.nom) === cle(lu.don));
    const magie = don && (regles.magies ?? []).find((m) => cle(m.nom) === cle(lu.magie));
    const entree = magie && (classe.entrees ?? []).find((e) => e.magie_id === magie.id && cle(e.nom) === cle(lu.entree));
    if (!lu) perdu(`${quoi} : illisible (un don « Variable » et sa classe, puis une entrée et sa magie)`);
    else if (!don) perdu(`${quoi} : aucun don « Variable » de ce nom dans les classes des règles`);
    else if (!entree) perdu(`${quoi} : « ${lu.entree} » introuvable parmi les entrées de ${lu.magie} du tableau de ${classe.nom}`);
    else if (f.dons_obtenus.some((o) => o.source === don.id)) perdu(`${quoi} : ce don a déjà son entrée`);
    else if (f.dons_obtenus.some((o) => o.entree_id === entree.id)) perdu(`${quoi} : entrée déjà obtenue par un autre don (une seule fois, décision R181)`);
    else f.dons_obtenus.push({ source: don.id, entree_id: entree.id });
  }

  // ---- l'entraînement (décision R104) : ses compétences dans la case L42 (« Magie 2 | Concentration 10 », bonusDEntrainement) ; la case est lue ligne
  // par ligne : une ligne qui se lit ainsi en entier donne ses compétences, une autre (le texte libre d'avant, R71) une ligne de texte, puis les
  // lignes « Entraînement : … » de la note (l'ordre entre compétences et textes n'est donc pas gardé par le tableur : les compétences d'abord)
  const texteL42 = texte(casesDuDon(DONS.entrainement).effet);
  const lusL42 = new Map();
  const textesL42 = [];
  for (const l of entrainementEnLignes(texteL42)) {
    const lus = bonusDEntrainement(regles, l.texte);
    if (lus) for (const [id, n] of lus) lusL42.set(id, (lusL42.get(id) ?? 0) + n);
    else textesL42.push(l.texte);
  }
  f.entrainements = [
    ...[...lusL42].map(([competence_id, valeur]) => ({ competence_id, valeur, texte: null })),
    ...[...textesL42, ...notee('entrainementTexte')].map((t) => ({ competence_id: null, valeur: null, texte: t })),
  ].map((l, i) => ({ rang: i + 1, ...l }));

  // ---- les choix d'acquis des dons (décision R104), lignes « Acquis au choix » de la note : « <don> : <compétence> » (« X ou Y », « pour les compétences
  // d'arme » (R120) : une de ses options), « <don> : Arc 6, Calme 4 » (« à répartir au choix »), « <don> : <compétence> (<famille d'armes>) » (l'arme
  // choisie, R119 : une famille de la maîtrise au choix de la classe, une compétence de ses armes) ; un don qui a deux choix est relu dans l'ordre de ses
  // lignes (« choisir 2 sur les 3 » (R121) : une ligne par compétence, deux compétences différentes). L'arme choisie (décision R152) : la famille entre
  // parenthèses est celle de la maîtrise au choix de la classe, calculée, pas relue ; une autre (un classeur d'avant la refonte, où rien n'est encore
  // choisi, R153) va dans `armesEcrites`, dite avec les dés ; la compétence est gardée tant que la maîtrise au choix n'est pas posée (`armesEnAttente` :
  // la page la compte dès que la famille choisie l'offre), reprise si la famille calculée l'offre, dite sinon.
  f.acquis_choix = [];
  const armesEcrites = [];
  const armesEnAttente = [];
  const choixDesDons = acquisDesDons(regles, f).choix;
  const competenceNommee = (nom) => regles.competences.find((k) => cle(k.nom) === cle(nom)) ?? null;
  /**
   * « Arme Légère (DAGUES) » d'un choix d'arme : { competence_id, arme_famille_id } quand la famille est une des siennes et la compétence une de ses armes.
   * La famille est tout ce qui suit la première parenthèse (le nom d'une famille créée sur le site de dev peut en écrire : R159), lue par son nom ou son nom
   * de lecture.
   */
  const armeNommee = (choix, valeur) => {
    const m = /^(.*?\S)\s+\((.+)\)$/.exec(valeur);
    const famille = m && familleEcrite(regles.familles_armes.filter((x) => choix.familles.includes(x.id)), m[2]);
    const k = famille && competenceNommee(m[1]);
    return k && famille.competences.includes(k.id) ? { competence_id: k.id, arme_famille_id: famille.id } : null;
  };
  for (const ligne of notee('acquisChoix')) {
    const coupe = ligne.lastIndexOf(' : ');
    const [nom, valeur] = coupe < 0 ? ['', ligne] : [ligne.slice(0, coupe), ligne.slice(coupe + 3).trim()];
    const quoi = `Acquis au choix « ${ligne} »`;
    const libres = choixDesDons.filter((c) => cle(c.nom) === cle(nom) && !f.acquis_choix.some((y) => y.source === c.source && y.rang === c.rang));
    const choix = libres.find((c) => c.repartition || (c.arme ? armeNommee(c, valeur) : c.options.includes(competenceNommee(valeur)?.id))) ?? null;
    if (!choix) {
      perdu(`${quoi} : ${libres.length ? 'pas une option de ce don' : 'aucun choix d’acquis de ce nom dans les dons de la fiche'}`);
      continue;
    }
    if (choix.arme) {
      const arme = armeNommee(choix, valeur);
      if (arme.arme_famille_id !== choix.arme_famille_id) armesEcrites.push({ source: choix.source, arme_famille_id: arme.arme_famille_id });
      const gardee = { source: choix.source, rang: choix.rang, competence_id: arme.competence_id, valeur: null };
      if (!choix.arme_famille_id) armesEnAttente.push(gardee);
      else if (!choix.options.includes(arme.competence_id)) {
        perdu(`${quoi} : ${nomDe(regles.competences, arme.competence_id)} n’est pas une compétence de ${nomDe(regles.familles_armes, choix.arme_famille_id)}, la maîtrise au choix de ${choix.classe} (décision R152)`);
      } else if (!choix.deduite) f.acquis_choix.push(gardee);
      continue;
    }
    if (!choix.repartition) {
      const k = competenceNommee(valeur);
      if (choix.sur && f.acquis_choix.some((y) => y.source === choix.source && y.competence_id === k.id)) {
        perdu(`${quoi} : déjà choisie pour ce don (des compétences différentes : décision R121)`);
        continue;
      }
      f.acquis_choix.push({ source: choix.source, rang: choix.rang, competence_id: k.id, valeur: null });
      continue;
    }
    const parts = [];
    for (const morceau of valeur.split(/\s*,\s*/)) {
      const m = /^(.*\S)\s+(\d+)$/.exec(morceau.trim());
      const k = m && competenceNommee(m[1]);
      if (k) parts.push({ competence_id: k.id, valeur: Number(m[2]) });
      else perdu(`${quoi} : « ${morceau} » illisible (une compétence et ses points)`);
    }
    f.acquis_choix.push(...acquisApresRepartition({}, choix.source, choix.rang, parts).acquis_choix);
  }
  const relus = f.acquis_choix.length;
  f.acquis_choix = acquisChoixValables(regles, f);
  if (f.acquis_choix.length < relus) perdu('Acquis au choix : des points répartis au-delà du bonus de leur don, retirés');

  // ---- les résistances au choix, lignes « Résistance au choix » de la note : de la ligne du tableau de la race (« Au choix parmi les autres » du Drakos
  // orange, décision R124), « <ligne> : <altération> », une des options de la ligne de la race et de l'ethnie de la fiche ; d'un don qui laisse une magie
  // au choix ou tirée (décision R137 : Ocultomancien « Résilience », Anansi d'Arcane), « <don> : <magie> », une de ses options
  f.resistance_choix = [];
  const resistancesAChoisir = resistancesDe(regles, f, { avecLaPosture: false }).aChoisir;
  for (const ligne of notee('resistanceChoix')) {
    const coupe = ligne.lastIndexOf(' : ');
    const [nom, valeur] = coupe < 0 ? ['', ligne] : [ligne.slice(0, coupe), ligne.slice(coupe + 3).trim()];
    const quoi = `Résistance au choix « ${ligne} »`;
    const libres = resistancesAChoisir.filter((c) => cle(c.nom) === cle(nom) && !f.resistance_choix.some((y) => y.source === c.source && y.rang === c.rang));
    const etat = (regles.etats ?? []).find((e) => cle(e.nom) === cle(valeur));
    const magie = (regles.magies ?? []).find((m) => cle(m.nom) === cle(valeur));
    const choix = libres.find((c) => (c.magie ? magie && c.options.includes(magie.id) : etat && c.options.includes(etat.id))) ?? null;
    if (!choix) {
      perdu(`${quoi} : ${libres.length ? 'pas une option de ce choix' : 'aucune résistance au choix de ce nom pour la race, l’ethnie et les dons de la fiche'}`);
      continue;
    }
    f.resistance_choix.push(choix.magie ? { source: choix.source, rang: choix.rang, magie_id: magie.id } : { source: choix.source, rang: choix.rang, etat_id: etat.id });
  }
  f.resistance_choix = resistanceChoixValables(regles, f);

  // ---- compétences : naturel et acquis écrits (entiers)
  const caseDeCompetence = new Map(CASES_COMPETENCES.map((c) => [c.id, c]));
  const ecrits = new Map(regles.competences.filter((k) => caseDeCompetence.has(k.id)).map((k) => {
    const cases = caseDeCompetence.get(k.id);
    return [k.id, { naturel: entierLu(cases.naturel, `${k.nom} (naturel)`), acquis: entierLu(cases.acquis, `${k.nom} (acquis)`) }];
  }));

  // ---- le bonus du métier que le classeur a compté dans ses acquis (décision R72 : « Le métier suit la base ») : un classeur qui ne vient pas de la page
  // écrit en L41 le bonus de son temps, qui peut ne plus être celui de la base ; c'est lui que l'acquis écrit porte, et lui qui en est retiré (brut : rien
  // ne dit que le classeur le rognait au plafond), le site ajoutant ensuite celui de la base. Illisible : celui de la base, à vérifier. Un classeur de
  // la page : celui de la base, qu'il a écrit (`ancienMetier` undefined).
  const texteL41 = texteBrut(cellule(casesDuDon(DONS.metier).effet));
  const metierEcrit = !deLaPage && Boolean(texteMetier) && cle(texteMetier) !== cle('Métier ?');
  const ancienMetier = metierEcrit ? bonusDuMetierEcrit(regles, texteL41) : undefined;
  const nomDuMetier = metier?.nom ?? texteMetier;
  const metierDuClasseur = (id, c) => (ancienMetier ? ancienMetier.get(id) ?? 0 : c.metier);
  const bonusEcrits = (parCompetence) => regles.competences.filter((k) => parCompetence.get(k.id)).map((k) => `${k.nom} +${parCompetence.get(k.id)}`).join(', ');
  if (ancienMetier === null && texteL41.trim() && metier?.bonus.some((b) => b.options.some((o) => o.competence_id))) {
    remarques.push(`Métier ${nomDuMetier} : bonus du classeur illisibles (« ${texteL41.replace(BLANCS, ' ').trim()} ») : l'acquis du joueur retire ceux de la base, à vérifier`);
  } else if (ancienMetier) {
    const base = new Map(Object.entries(bonusDuMetier(regles, f).parCompetence).filter(([, n]) => n));
    const avant = bonusEcrits(ancienMetier);
    const apres = bonusEcrits(base);
    if (!metier && avant) remarques.push(`Métier « ${texteMetier} » (introuvable dans les règles) : le classeur comptait ${avant}, retiré des acquis (R72)`);
    else if (metier && avant !== apres) {
      remarques.push(`Métier ${nomDuMetier} : le classeur comptait ${avant || 'aucun bonus de compétence'} ; la base donne ${apres || 'aucun bonus de compétence'} : les acquis suivent la base (R72)`);
    }
  }

  // ---- compétence d'un accessoire « Compétence X » de la fiche auto : celle de la caractéristique dont l'acquis écrit, moins le métier (celui du
  // classeur, R72) et les bonus d'entraînement (L42), vaut la valeur tirée
  const entrainement = auto && lusL42.size ? lusL42 : null;
  if (entrainement) {
    const calcul = new Map(competencesDe(regles, f).map((k) => [k.id, k]));
    for (const a of f.accessoires) {
      const effet = trouver(regles.accessoires, a.accessoire_effet_id);
      const cible = effet?.effets?.find((c) => c.cible === 'competence');
      if (!cible || a.competence_id || a.valeur === null) continue;
      const parCompetence = regles.competences.filter((k) => k.caracteristique_id === cible.cible_id && caseDeCompetence.has(k.id)).map((k) => {
        const c = calcul.get(k.id);
        const ecrit = ecrits.get(k.id).acquis ?? 0;
        const duMetier = metierDuClasseur(k.id, c);
        const reste = ecrit - duMetier - (entrainement.get(k.id) ?? 0);
        return { k, ecrit, metier: duMetier, entrainement: entrainement.get(k.id) ?? 0, reste, ok: reste === a.valeur || reste === Math.min(a.valeur, Math.max(0, c.plafondAcquis - duMetier)) };
      });
      const candidats = parCompetence.filter((x) => x.ok);
      if (candidats.length === 1) {
        const x = candidats[0];
        a.competence_id = x.k.id;
        const calculEcrit = [x.metier ? `métier ${x.metier}${ancienMetier ? ' (classeur)' : ''}` : null, x.entrainement ? `entraînement ${x.entrainement}` : null, `accessoire ${x.reste}`].filter(Boolean).join(' + ');
        remarques.push(`Compétence de l'accessoire ${libelleDEmplacement(a.emplacement)} (${effet.libelle} ${a.valeur}) déduite : ${x.k.nom} (acquis ${x.ecrit} = ${calculEcrit})`);
      }
    }
  }

  // ---- compétences : le naturel écrit ; l'Acquis se calcule (décision R104 : entraînement, dons, métier, accessoires) : celui du classeur n'est pas
  // repris, un écart avec le calcul est dit (non repris)
  for (const k of regles.competences) {
    if (!caseDeCompetence.has(k.id)) continue;
    const naturel = Math.max(0, ecrits.get(k.id).naturel ?? 0);
    if (naturel) f.competences.push({ competence_id: k.id, naturel });
  }
  // l'écart entre l'acquis écrit et le calcul, le métier du classeur remplacé par celui de la base (décision R72 : son écart a déjà sa remarque)
  const ecarts = () => {
    const calcul = new Map(competencesDe(regles, f).map((k) => [k.id, k]));
    return regles.competences.filter((k) => caseDeCompetence.has(k.id)).map((k) => {
      const c = calcul.get(k.id);
      const ecrit = ecrits.get(k.id).acquis ?? 0;
      return { k, ecrit, calcule: c.acquis, ecart: ecrit - metierDuClasseur(k.id, c) + c.metier - c.acquis };
    });
  };
  // un choix « X ou Y » d'un don que le classeur ne dit pas (une fiche auto, un classeur de la page d'avant la décision R104) : déduit quand une seule
  // option a un acquis écrit qui dépasse le calcul de la valeur du bonus (un arbitrage, dit par une remarque) ; une répartition (« à répartir au
  // choix ») ne se déduit pas : ce que l'acquis écrit a de plus peut venir d'ailleurs (points du joueur, équipement, MJ), elle reste à faire
  for (const choix of acquisDesDons(regles, f).choix.filter((c) => !c.fait && !c.repartition)) {
    const parId = new Map(ecarts().map((x) => [x.k.id, x]));
    const options = choix.options.filter((o) => parId.get(o)?.ecart === choix.valeur);
    if (options.length !== 1) continue;
    Object.assign(f, acquisApresChoix(f, choix.source, choix.rang, options[0]));
    remarques.push(`Acquis au choix de ${choix.nom} (+${choix.valeur} %) déduit : ${nomDe(regles.competences, options[0])} (l'acquis du classeur)`);
  }
  f.acquis_choix = [...acquisChoixValables(regles, f), ...armesEnAttente];

  // ---- les dés des maîtrises (décisions R148, R149) se calculent : ceux du classeur (desLus) sont comparés au calcul, comme l'AP et l'AM de la grille
  // (R108) ; si une famille a plus de dés écrits que calculés (ce que la fiche ne garde pas), ou qu'une arme choisie écrit une autre famille que la
  // maîtrise au choix de sa classe (R152), une ligne de `nonRepris` les dit — tous les dés écrits, comme l'ancien tableau — au texte de la note datée de
  // la base vivante (texteDesMaitrisesDAvant) : un classeur d'avant la refonte (sans ligne « Maîtrise d'arme au choix » dans la note) « Maîtrises
  // d'armes avant la refonte : … » (décision R153 : ses dés sont notés, aucun choix n'est posé), un autre « Maîtrises d'armes du classeur : … ». Une
  // famille sans dé écrit a le dé sans maîtrise ; moins de dés écrits que calculés (une grille laissée vide, des familles imposées) : rien n'est perdu.
  const desCalcules = new Map(maitrisesParFamille(regles, f).map((m) => [m.famille, m.des]));
  const desDe = (carte, id) => carte.get(id) ?? maitrise.desSansMaitrise;
  const autresDes = desLus !== null && MAITRISES.some((m) => desDe(desLus, m.famille) > desDe(desCalcules, m.famille));
  if (autresDes || armesEcrites.length) {
    const ordre = famillesMaitrisables(regles).map((x) => x.id);
    const noms = {
      famille: (id) => {
        const x = trouver(regles.familles_armes, id);
        return x ? { nom: x.nom, de: x.de ?? null, ordre: ordre.includes(id) ? ordre.indexOf(id) : ordre.length } : null;
      },
      don: (id) => {
        const [don, classe] = nomDuDon(id);
        return don ? { nom: don.nom, classe: classe?.nom ?? null } : null;
      },
    };
    const ecrites = maitrisesDAvant(autresDes ? [...desLus].map(([arme_famille_id, des]) => ({ arme_famille_id, des })) : [], armesEcrites, noms);
    const avant = !notee('maitriseChoix').length;
    perdu(`${avant ? PREFIXE_DES_MAITRISES_D_AVANT : 'Maîtrises d\'armes du classeur'} : « ${texteDesMaitrisesDAvant(ecrites)} » (non reprises : ${avant
      ? 'aucun choix n’est posé, les maîtrises se choisissent sur la fiche ; décision R153'
      : 'la fiche les calcule d’après ses choix ; décision R148'})`);
  }
  for (const { k, ecrit, calcule, ecart } of ecarts()) {
    // plus que le calcul : des points saisis que la fiche n'a plus (non repris) ; moins : la fiche en compte davantage (dons, métier…), une remarque
    if (ecart > 0) perdu(`Acquis ${k.nom} : « ${ecrit} » dans le classeur, ${calcule} calculé (l’acquis se calcule : entraînement, dons, métier, accessoires ; décision R104)`);
    else if (ecart < 0) remarques.push(`Acquis ${k.nom} : ${ecrit} dans le classeur, ${calcule} calculé (entraînement, dons, métier, accessoires : décision R104)`);
  }

  // ---- sorts et leurs NM
  const pris = new Set();
  const magiesDuPersonnage = new Set([f.magie_innee_id, f.magie_acquise_id].filter(Boolean));
  const sortsDuPersonnage = regles.sorts.filter((s) => f.magie_innee_id === POTENTIEL_ILLIMITE || magiesDuPersonnage.has(s.magie_id));
  const colonnes = d.sorts.colonnes;
  const ajouterSort = (nom, nm, ligne) => {
    const quoi = `Sort « ${nom} » (NM ${nm})`;
    const candidats = retrouver(sortsDuPersonnage, nom).filter((s) => !pris.has(s.id));
    if (!candidats.length) {
      const ailleurs = retrouver(regles.sorts, nom);
      perdu(`${quoi} : ${retrouver(sortsDuPersonnage, nom).length ? 'déjà sur une autre ligne' : ailleurs.length ? 'absent des magies du personnage' : 'introuvable dans les règles'}`);
      return;
    }
    // homonymes (« Vague déferlante » : Corruption et Arcane, pour un Potentiel Illimité) : les colonnes écrites, comparées aux valeurs au NM du sort
    // (leur début, pour une case coupée par la page) ; dans une description écrite entière (ses parties sur des lignes, ou sur une ligne séparées par
    // « · »), chaque ligne du D/S/B et des effets du sort qui y est compte, une seule qui n'y est pas écarte le sort ; coupée, on ne sait pas où : ses
    // parties entières comptent, et le début de la dernière
    // la case « Coût » écrit les deux coûts du sort (décision R105 : « 3 + 1 Sang », comme l'export et le classeur)
    const auNm = (s, ch) => {
      const v = s[ch] ? valeurAuNm(s[ch], s.bonus ?? [], ch, Math.min(3, Math.max(0, nm))) : '';
      return ch === 'cout' ? coutEnUneCase(v, s.cout_secondaire ?? null) : v;
    };
    const score = (s) => {
      if (ligne === null) return 0;
      const n = ['type', 'cout', 'portee', 'zone'].filter((ch) => texte(`${colonnes[ch]}${ligne}`) && ecritComme(texte(`${colonnes[ch]}${ligne}`), auNm(s, ch))).length;
      const description = texteBrut(cellule(`${colonnes.description}${ligne}`)).trim();
      const montre = sansLaCoupure(description);
      const parties = segmentsDe(montre ?? description);
      const coupee = montre !== null && parties.length ? cle(parties.pop()) : null;
      const ecrites = new Set(parties.map(cle));
      if (!ecrites.size && coupee === null) return n;
      const siennes = ['dsb', 'effets'].flatMap((ch) => segmentsDe(auNm(s, ch))).map(cle);
      if (montre === null) return siennes.every((l) => ecrites.has(l)) ? n + siennes.length : -Infinity;
      return n + siennes.filter((l) => ecrites.has(l)).length + (coupee && siennes.some((l) => l.startsWith(coupee)) ? 1 : 0);
    };
    const meilleur = Math.max(...candidats.map(score));
    const sort = candidats.length === 1 ? candidats[0] : unSeul(candidats, 'Sort', nom, {
      departager: (c) => c.filter((s) => score(s) === meilleur),
      nom: (s) => `${s.nom} (${nomDe(regles.magies, s.magie_id)})`,
    });
    if (!sort) return;
    pris.add(sort.id);
    f.sorts.push({ sort_id: sort.id, rang: f.sorts.length + 1, niveau_maitrise: Math.max(0, nm) });
  };
  for (const l of d.sorts.lignes) {
    const nom = texte(`${colonnes.nom}${l}`);
    if (nom) ajouterSort(nom, entierLu(`${colonnes.nm}${l}`, `Sort « ${nom} » (NM)`) ?? 0, l);
  }
  for (const v of notee('sorts')) {
    for (const { nom, nm } of lireListe(v).map(lireSortEnSuite)) ajouterSort(nom, nm ?? 0, null);
  }
  // les livres de sort (décision R169) : un par sort, sur un sort de la liste ou non (il attend alors), même hors des magies du personnage (aucun
  // contrôle ne le refuse) ; seul un nom inconnu des règles est perdu. Un nom ambigu (homonymes d'un Potentiel Illimité) se lit d'abord dans la liste
  // des sorts, puis dans sortsDesLivres, puis dans toutes les règles ; encore ambigu, il est perdu (jamais rapproché par vraisemblance). Les NM du MJ
  // sont ceux de la fiche (décision R118 : ligne « NM du MJ »), un classeur d'avant les écrit sort par sort (« MJ 2 »)
  let nmDuMj = 0;
  f.livres_sorts = [];
  const nomme = (o) => (s) => cle(s.nom) === cle(o.nom) || segment(s.id) === cle(o.nom);
  for (const v of notee('nmOfferts')) {
    const offerts = lireNmOfferts(v);
    if (!offerts) {
      perdu(`NM offerts : « ${v} » illisible`);
      continue;
    }
    for (const o of offerts) {
      const choisis = f.sorts.map((s) => trouver(regles.sorts, s.sort_id)).filter((s) => s && nomme(o)(s));
      const candidats = [choisis, sortsDesLivres(regles, f).filter(nomme(o)), regles.sorts.filter(nomme(o))].find((c) => c.length) ?? [];
      if (candidats.length !== 1) {
        perdu(`NM offerts : « ${o.nom} » (livre ${o.livre}, MJ ${o.cadeau}) ${candidats.length ? 'désigne plusieurs sorts' : 'introuvable dans les règles'}`);
        continue;
      }
      nmDuMj += o.cadeau;
      if (!o.livre) continue;
      const sort = candidats[0];
      if (aUnLivre(f, sort.id) || o.livre > 1) perdu(`NM offerts : « ${o.nom} » (livre ${o.livre}) : un seul livre par sort (décision R26)`);
      if (!aUnLivre(f, sort.id)) f.livres_sorts.push({ sort_id: sort.id, rang: f.livres_sorts.length + 1 });
    }
  }
  for (const v of notee('nmMj')) {
    if (/^\d+$/.test(v.trim())) nmDuMj += Number(v.trim());
    else perdu(`NM du MJ : « ${v} » illisible`);
  }
  f.nm_mj = nmDuMj;
  // le sort préparé (décision R115), dans la note : un sort de la liste, que le don de préparation de la fiche autorise (sortPrepare), son jet de magie
  // (1 à 100), la posture de la préparation, son Mode Hyper (R172) et sa plage de critique figée (R182) ; sinon perdu, et dit
  for (const v of notee('sortPrepare')) {
    if (f.sorts.some((s) => s.prepare === 1)) {
      perdu(`Sort préparé : « ${v} » : un seul sort préparé par fiche (décision R115)`);
      continue;
    }
    const lu = lireSortPrepare(v);
    const lignes = f.sorts.filter((s) => cle(nomDe(regles.sorts, s.sort_id)) === cle(lu.nom) || segment(s.sort_id) === cle(lu.nom));
    if (lignes.length !== 1) {
      perdu(`Sort préparé : « ${v} » ne désigne pas un sort de la liste`);
      continue;
    }
    const bornes = jetDuSortPrepare(regles);
    if (lu.jet !== null && (lu.jet < bornes.min || lu.jet > bornes.max)) {
      perdu(`Sort préparé : « ${v} » : jet de magie hors de ${bornes.min} à ${bornes.max}`);
      continue;
    }
    // la plage de réussite critique figée à la préparation (décision R182 (4), « critique 1 à N ») : relue telle quelle, N de 1 (le bas de la plage ;
    // un accessoire maudit la fait descendre sous critique.base, R180 et R54) au plafond (constante critique.plafond), comme le CHECK de
    // personnage_sort.prepare_critique, jamais recalculée ; absente, NULL
    const plage = { min: 1, max: regles.constantes['critique.plafond'] };
    if (lu.critique !== null && (lu.critique < plage.min || lu.critique > plage.max)) {
      perdu(`Sort préparé : « ${v} » : réussite critique « 1 à ${lu.critique} » hors des plages possibles (de « 1 à ${plage.min} » à « 1 à ${plage.max} »)`);
      continue;
    }
    const posture = lu.posture === null ? null : unSeul(retrouver(regles.postures, lu.posture), 'Sort préparé (posture)', lu.posture);
    if (lu.posture !== null && !posture) continue;
    // préparé en Mode Hyper ou au Mode Hyper 100 % (décision R172) : les deux cases, cohérentes (le 100 % l'est aussi en Mode Hyper)
    Object.assign(lignes[0], {
      prepare: 1, prepare_jet: lu.jet, prepare_posture_id: posture?.id ?? null, prepare_hyper: lu.hyper ? 1 : 0, prepare_cent: lu.hyper && lu.cent ? 1 : 0,
      prepare_critique: lu.critique,
    });
    if (!sortPrepare(regles, f)) {
      Object.assign(lignes[0], { prepare: 0, prepare_jet: null, prepare_posture_id: null, prepare_hyper: 0, prepare_cent: 0, prepare_critique: null });
      perdu(`Sort préparé : « ${v} » : la fiche n’a pas le don qui le permet (« Préparation », « Chargement »), ou ce sort n’est pas de ceux qu’il autorise`);
    }
  }
  if (auto) {
    const nm = maitriseDesSorts(regles, f);
    if (nm.comptes > nm.limite) {
      remarques.push(`NM des sorts : les ${nm.total} NM du classeur sont tous comptés (${nm.disponibles} gagnés par les niveaux) ; le classeur ne dit pas lesquels viennent d'un livre (à noter dans l'entraînement) ou du MJ (à noter à côté du décompte des NM)`);
    }
  }

  // ---- armes
  /**
   * Une amélioration écrite « niv. N — effet » ou « niv. N (effet) » (modèle ordinateur : lireNiveauDAmelioration, lireEffetDAmelioration), « +N » ou
   * « +N (effet) » (fiche auto : le niveau, et l'effet qui doit être le sien), ou son effet seul ; « Aucune » : rien.
   */
  const amelioration = (t, cible, quoi) => {
    if (!t || ['aucune', 'aucun'].includes(cle(t))) return null;
    const niveau = lireNiveauDAmelioration(t) ?? /^\+?\s*(\d+)(?:\s*\([^()]*\))?$/.exec(t.trim())?.[1];
    const effetEcrit = lireEffetDAmelioration(t);
    const liste = regles.ameliorations.filter((a) => a.cible === cible);
    const trouvee = niveau !== null && niveau !== undefined
      ? liste.find((a) => a.niveau === Number(niveau) && (!effetEcrit || cle(a.effet).startsWith(cle(effetEcrit))))
      : liste.find((a) => cle(a.effet) === cle(t));
    if (!trouvee) perdu(`${quoi} : « ${t} » introuvable dans les règles`);
    return trouvee?.id ?? null;
  };
  // l'effet en plus (modèle ordinateur), relu une fois la fiche entière : la part affichée de la case est celle de la fiche relue (partiesDeLArme) ; la
  // fiche auto n'en a pas (son « Effet en plus », AA13, est une formule, =BDD!AJ36 dans les fiches du propriétaire relevées le 2026-10-15 : on y lit
  // l'effet du catalogue puis celui du matériau ; docs/fiche-auto.md)
  const effetsEnPlus = [];
  for (const [i, cases] of d.armes.entries()) {
    const rang = i + 1;
    const quoi = `Arme ${rang}`;
    const nom = auto ? sansLesMains(texte(cases.nom)) : texte(cases.nom);
    // modèle ordinateur : la solidité du moment, « N / M » (le « / » du modèle n'est pas une valeur) ; la fiche auto n'écrit que le maximum (AK15, AX15)
    const solidite = auto || texte(cases.solidite) === MODELE_DE_LA_SOLIDITE ? '' : texte(cases.solidite);
    if (!nom) {
      if (solidite) perdu(`${quoi}, solidité : « ${solidite} » sans arme`);
      continue;
    }
    const effet = texteBrut(cellule(cases.effet));
    const lue = auto ? null : lireEffetDArme(effet);
    const composition = auto ? texte(cases.composition) : lue.composition;
    const degatsEcrits = texte(cases.degats);
    // une arme élémentaire s'écrit par son nom dans la case de l'arme (décision R167 : « Arc de Sang » ; aucun nom n'est celui d'une arme du catalogue)
    const nommees = retrouver(regles.armes, nom).length ? [] : retrouver(regles.armes_elementaires ?? [], nom, { autres: () => [] });
    const nommee = nommees.length === 1 ? nommees[0] : null;
    // ce qui va avec l'arme, lu avant elle : ses dégâts départagent deux armes du même nom
    const ligne = { rang, arme_id: null, materiau_id: null, amelioration_id: null, arme_elementaire_id: null, effet_en_plus: null };
    if (composition && !nommee) ligne.materiau_id = unSeul(retrouver(regles.materiaux_armes, composition), `${quoi}, composition`, composition)?.id ?? null;
    ligne.amelioration_id = amelioration(auto ? texte(cases.amelioration) : lue.amelioration, 'arme', `${quoi}, amélioration`);
    // un classeur d'avant la décision R167 : un élément posé sur une arme du catalogue (« Élément : … » de la case de l'effet, AI17 de la fiche auto) et,
    // au modèle ordinateur, l'amélioration de l'élément (« Amélioration de l'élément : niv. N — … », son niveau seul : les effets des deux anciens
    // tableaux sont les mêmes niveau par niveau, R167)
    const elementEcrit = auto ? texte(cases.element) : lue.element;
    const element = elementEcrit ? unSeul(retrouver(regles.armes_elementaires ?? [], elementEcrit, { autres: () => [] }), `${quoi}, élément`, elementEcrit) : null;
    const ameliorationElementEcrite = auto || !lue.ameliorationElement || ['aucune', 'aucun'].includes(cle(lue.ameliorationElement)) ? null : lue.ameliorationElement;
    const niveauElement = ameliorationElementEcrite === null ? null
      : Number(lireNiveauDAmelioration(ameliorationElementEcrite) ?? /^\+?\s*(\d+)/.exec(ameliorationElementEcrite.trim())?.[1] ?? Number.NaN);
    const autres = f.armes.filter((x) => x.rang !== rang);
    let arme;
    // l'effet du catalogue écrit dans la case : celui de l'arme, ou de l'arme d'origine d'une arme devenue élémentaire (classeur d'avant R167), qui n'est
    // pas de l'effet en plus
    let catalogue = null;
    if (nommee) {
      // l'arme élémentaire (décision R167) : ni matériau, ni autre élément, un seul niveau d'amélioration
      if (composition) perdu(`${quoi} (${nommee.nom}), composition : « ${composition} » : une arme élémentaire n’a pas de matériau (décision R167)`);
      if (elementEcrit) perdu(`${quoi} (${nommee.nom}), élément : « ${elementEcrit} » : une arme élémentaire n’en porte pas d’autre (décision R167)`);
      if (ameliorationElementEcrite) perdu(`${quoi} (${nommee.nom}), amélioration de l’élément : « ${ameliorationElementEcrite} » : une arme n’a plus qu’un niveau d’amélioration (décision R167)`);
      f.armes = [...autres, { ...ligne, arme_elementaire_id: nommee.id }].sort((x, y) => x.rang - y.rang);
      arme = armeDeLaLigne(regles, f.armes.find((x) => x.rang === rang));
      // le type physique choisi (décision R167, la bombe : « Estoc, Frappe ou Taille au choix ») : « Type de dégâts : Taille », parmi ceux de son type
      const typeEcrit = lue?.typeDegats ?? null;
      if (typeEcrit) {
        const t = arme.type_degats_au_choix ? typesDeDegats(regles).find((x) => x.physique && arme.types_offerts.includes(x.id) && (cle(x.nom) === cle(typeEcrit) || x.id === cle(typeEcrit))) : null;
        if (t) f.armes.find((x) => x.rang === rang).type_degats_choisi = t.id;
        else perdu(`${quoi} (${nommee.nom}), type de dégâts : « ${typeEcrit} » : ${arme.type_degats_au_choix ? 'pas un des types au choix de l’arme' : 'le type de cette arme ne se choisit pas'} (décision R167)`);
      }
    } else {
      const avecLArme = (armeId) => (composition ? [...autres, { ...ligne, arme_id: armeId }].sort((x, y) => x.rang - y.rang)
        // une composition absente : le fer (décision R49, armesApresChoix) ; écrite mais introuvable : rien
        : armesApresChoix(regles, { ...f, armes: [...autres, ligne] }, rang, armeId));
      // la solidité du moment écrite, pour les dégâts écrits : les crans perdus y comptent (décision R107, Vieille Branche)
      const actuelleEcrite = solidite ? paireDe(cellule(cases.solidite))[0] : null;
      const avecSaSolidite = (armes) => (actuelleEcrite === null ? armes
        : armes.map((x) => (x.rang === rang ? { ...x, durabilite: durabiliteAEcrire(regles, x, Math.floor(actuelleEcrite)) } : x)));
      const departager = (candidats) => {
        // homonymes d'une famille à l'autre (« Étendard de guerre », « Crochet grappin ») : l'effet du catalogue écrit (son début, dans une case coupée
        // par la page), puis les dégâts écrits
        const ecrites = lignesDe(effet);
        const parEffet = candidats.filter((a) => a.effet && ecrites.some((l, k) => (k === ecrites.length - 1 ? ecritComme(l, lignesDe(a.effet)[0]) : cle(l) === cle(lignesDe(a.effet)[0]))));
        if (parEffet.length === 1) return parEffet;
        return (parEffet.length ? parEffet : candidats)
          .filter((a) => degatsEcrits && ecritComme(degatsEcrits, degatsDArme(regles, { ...f, armes: avecSaSolidite(avecLArme(a.id)) }, rang)?.texte));
      };
      arme = unSeul(retrouver(regles.armes, nom), quoi, nom, {
        departager, nom: (a) => `${a.nom} (${nomDe(regles.familles_armes, a.famille_id)})`, precisions: [composition, degatsEcrits].filter(Boolean).join(', '),
      });
      if (!arme) {
        if (solidite) perdu(`${quoi}, solidité : « ${solidite} » sans arme reconnue`);
        continue;
      }
      if (lue?.typeDegats) perdu(`${quoi} (${arme.nom}), type de dégâts : « ${lue.typeDegats} » : seul celui d’une arme élémentaire au type au choix se note (décision R167)`);
      f.armes = avecLArme(arme.id);
      // l'élément d'un classeur d'avant (décision R167 : « l'élément gagne s'il est du type de l'arme ; sinon il est retiré et noté ») : du type élémentaire
      // de la famille de l'arme, l'arme devient l'arme élémentaire, avec pour niveau celui de l'amélioration de l'élément (aucun sans elle) ; l'arme, son
      // matériau et son amélioration sont dits. D'un autre type : l'élément n'est pas repris, l'arme garde matériau et amélioration. Une amélioration de
      // l'élément sans élément n'est pas reprise.
      const finale = f.armes.find((x) => x.rang === rang);
      const famille = trouver(regles.familles_armes, arme.famille_id);
      if (element && famille?.type_elementaire_id && famille.type_elementaire_id === element.type_id) {
        const niveau = Number.isInteger(niveauElement) ? (regles.ameliorations ?? []).find((a) => a.cible === 'arme' && a.niveau === niveauElement) ?? null : null;
        const avant = trouver(regles.ameliorations ?? [], finale.amelioration_id)?.niveau;
        const perdus = [composition && ligne.materiau_id ? `composition « ${nomDe(regles.materiaux_armes, ligne.materiau_id)} »` : null, avant ? `amélioration +${avant}` : null].filter(Boolean);
        Object.assign(finale, { arme_id: null, materiau_id: null, arme_elementaire_id: element.id, amelioration_id: niveau?.id ?? null });
        const suite = !ameliorationElementEcrite ? ', sans amélioration' : niveau ? `, avec l’amélioration +${niveauElement} de son élément`
          : `, sans l’amélioration de son élément « ${ameliorationElementEcrite} » (niveau absent des règles)`;
        perdu(`${quoi} : « ${arme.nom} »${perdus.length ? ` (${perdus.join(', ')})` : ''} est devenue l’arme élémentaire « ${element.nom} »${suite} : une pièce élémentaire transforme l’arme, qui perd toutes ses caractéristiques d’avant (décision R167)`);
        catalogue = arme.effet;
        arme = armeDeLaLigne(regles, finale);
      } else if (element) {
        perdu(`${quoi} (${arme.nom}), élément : « ${element.nom} »${ameliorationElementEcrite ? ` (amélioration de l’élément « ${ameliorationElementEcrite} »)` : ''} : pas l’arme élémentaire du type de sa famille, non repris (décision R167)`);
      } else if (ameliorationElementEcrite) {
        perdu(`${quoi} (${arme.nom}), amélioration de l’élément : « ${ameliorationElementEcrite} » sans élément : une arme n’a plus qu’un niveau d’amélioration (décision R167)`);
      }
    }
    if (!auto) effetsEnPlus.push({ rang, effet, arme, catalogue: catalogue ?? arme.effet, entier: recollees.has(cases.effet) });
    // la solidité du moment (décision R74), sur la ligne finale (matériau et amélioration relus : ils font le maximum ; d'une arme élémentaire, 4 + les
    // crans de sa ligne d'amélioration, R167)
    if (solidite) {
      const finale = f.armes.find((x) => x.rang === rang);
      const max = durabiliteMaxDArme(regles, finale);
      const [actuelle, maxEcrit] = paireDe(cellule(cases.solidite));
      if (max === null) perdu(`${quoi} (${arme.nom}), solidité : « ${solidite} » sans place sur le site (arme sans solidité)`);
      else if (actuelle === null) perdu(`${quoi} (${arme.nom}), solidité : « ${solidite} » illisible`);
      else {
        const crans = durabiliteAEcrire(regles, finale, entierDe(actuelle, solidite, `${quoi}, solidité`));
        if (crans !== null) finale.durabilite = crans;
        if (maxEcrit !== null && maxEcrit !== max) remarques.push(`${quoi} (${arme.nom}) : solidité maximale écrite ${maxEcrit}, le site calcule ${max} (décision ${arme.elementaire ? 'R167' : 'R51'})`);
      }
    }
  }

  // ---- armure
  const armureElementaire = (t, armure, quoi) => {
    const parNom = retrouver(regles.armures_elementaires, t, { autres: () => [] });
    if (parNom.length) return unSeul(parNom, quoi, t)?.id ?? null;
    // fiche auto : le nom d'une magie ; l'armure élémentaire de cette magie (armure_elementaire.magie_id) et de la catégorie de l'armure
    const magie = retrouver(regles.magies, t, { autres: ecrituresDeMagie });
    if (magie.length === 1 && armure) {
      const x = regles.armures_elementaires.find((e) => e.magie_id === magie[0].id && cle(e.categorie) === cle(armure.type)) ?? null;
      if (!x) {
        perdu(`${quoi} : pas d'armure élémentaire ${magie[0].nom} de catégorie ${armure.type}`);
        return null;
      }
      remarques.push(`Élément d'armure déduit de la magie « ${magie[0].nom} » et de la catégorie « ${armure.type} » : ${x.nom}`);
      return x.id;
    }
    perdu(`${quoi} : « ${t} » introuvable dans les règles`);
    return null;
  };
  // l'armure de la fiche (décision R95 : une armure complète et son amélioration ; R165 : de base OU élémentaire) : écrite même vide, pour qu'un
  // classeur sans armure en retire une au prétiré mis à jour. Un classeur d'avant la décision R165 (l'armure, son « élément » et l'amélioration de
  // l'élément ; la fiche auto : l'élément écrit par le nom de sa magie) donne une fiche d'avant, qui porte les deux : la page la convertit comme la base
  // vivante (lib/fiche-format.mjs#sansPartiesRetirees : l'élément devient l'armure, avec son amélioration ; l'armure d'origine notée, datée), puis retire
  // et note une armure hors de la liste (lib/fiche-moteur.mjs#retraitsDeLArmureHorsListe : trop lourde, « Familier », magie absente)
  Object.assign(f, { armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null, armure_parties: [] });
  if (auto) {
    const nomArmure = texte(d.armure.nom);
    const armure = nomArmure ? unSeul(retrouver(regles.armures, nomArmure), 'Armure', nomArmure) : null;
    if (armure) {
      f.armure_id = armure.id;
      f.armure_amelioration_id = amelioration(texte(d.armure.amelioration), 'armure', `Armure (${armure.nom}), amélioration`);
      if (texte(d.armure.element)) f.armure_elementaire_id = armureElementaire(texte(d.armure.element), armure, `Armure (${armure.nom}), élément`);
      if (f.armure_elementaire_id) f.armure_amelioration_elementaire_id = amelioration(texte(d.armure.ameliorationElement), 'armure_elementaire', `Armure (${armure.nom}), amélioration de l’élément`);
      else if (texte(d.armure.ameliorationElement)) perdu(`Armure (${armure.nom}), amélioration de l’élément : « ${texte(d.armure.ameliorationElement)} » sans élément reconnu`);
    }
  } else {
    // « Bonus/ Malus » (AQ21) : la ligne de l'armure (lib/fiche-tableur-export.mjs#lireLigneDArmure) ; un classeur d'avant la décision R95 en écrit une
    // par pièce (« Torse : … ») : la fiche garde la première dans l'ordre des emplacements, l'armure complète d'abord (armureDesArmures, la règle de la
    // base vivante), une remarque quand c'est une pièce qui devient l'armure complète, les autres pièces vont dans les notes. Une ligne qui ne nomme pas d'armure n'a pas de place sur le site. « Nom Armure » (AD22) :
    // l'armure quand aucune ligne n'en écrit, sinon comparé aux lignes
    const portees = [];
    // une armure élémentaire (décision R165 : la ligne la nomme, avec son amélioration du tableau élémentaire) ; une seule par fiche
    let elementaireLue = null;
    for (const l of lignesDe(texte(d.armure.bonus))) {
      const lu = lireLigneDArmure(regles, l);
      if (!lu.emplacementEcrit && !retrouver(regles.armures, lu.armure).length) {
        const elementaires = retrouver(regles.armures_elementaires, lu.armure, { autres: () => [] });
        if (!elementaires.length) {
          perdu(`Bonus/Malus de l'armure : « ${l} » sans place sur le site`);
          continue;
        }
        const x = unSeul(elementaires, 'Armure élémentaire', lu.armure);
        if (!x) continue;
        const quoi = `Armure élémentaire (${x.nom})`;
        if (elementaireLue) {
          perdu(`${quoi} : une fiche ne porte qu’une armure (décision R165)`);
          continue;
        }
        elementaireLue = { id: x.id, amelioration: amelioration(lu.amelioration ?? lu.ameliorationElement, 'armure_elementaire', `${quoi}, amélioration`) };
        for (const partie of [...(lu.element ? [`élément ${lu.element}`] : []), ...lu.autres]) perdu(`${quoi} : « ${partie} » sans place sur la fiche`);
        continue;
      }
      const emplacement = lu.emplacementEcrit ? trouver(regles.emplacements_armure, lu.emplacement_id)?.nom ?? lu.emplacement_id : null;
      const armure = unSeul(retrouver(regles.armures, lu.armure), emplacement ? `Armure (${emplacement})` : 'Armure', lu.armure);
      if (!armure) continue;
      const quoi = emplacement ? `Armure (${emplacement} : ${armure.nom})` : `Armure (${armure.nom})`;
      const ligne = {
        emplacement_id: lu.emplacement_id, armure_id: armure.id,
        amelioration_id: amelioration(lu.amelioration, 'armure', `${quoi}, amélioration`),
        armure_elementaire_id: lu.element ? armureElementaire(lu.element, armure, `${quoi}, élément`) : null,
        amelioration_elementaire_id: amelioration(lu.ameliorationElement, 'armure_elementaire', `${quoi}, amélioration de l’élément`),
      };
      for (const partie of lu.autres) perdu(`${quoi} : « ${partie} » sans place sur la fiche`);
      portees.push({ ligne, quoi });
    }
    const { colonnes, retirees, transformee } = armureDesArmures(portees.map((x) => x.ligne));
    Object.assign(f, colonnes);
    if (transformee) remarques.push(`${portees.find((x) => x.ligne === transformee).quoi} : devenue l’armure complète de la fiche (décision R95)`);
    for (const r of retirees) {
      const quoi = portees.find((x) => x.ligne === r).quoi;
      perdu(r.armure_id === colonnes.armure_id
        ? `${quoi} : son amélioration et son élément ne sont pas repris, une fiche ne porte plus qu’une armure complète (décision R95)`
        : `${quoi} : une fiche ne porte plus qu’une armure complète (décision R95)`);
    }
    if (elementaireLue) Object.assign(f, { armure_elementaire_id: elementaireLue.id, armure_amelioration_elementaire_id: elementaireLue.amelioration });
    const nomAD22 = texte(d.armure.nom);
    if (!portees.length && !elementaireLue && nomAD22) {
      // « Nom Armure » seul : une armure de base, ou élémentaire (R165), à son nom
      const deBase = retrouver(regles.armures, nomAD22);
      const elementaires = deBase.length ? [] : retrouver(regles.armures_elementaires, nomAD22, { autres: () => [] });
      if (elementaires.length) f.armure_elementaire_id = unSeul(elementaires, 'Armure élémentaire', nomAD22)?.id ?? null;
      else f.armure_id = unSeul(deBase, 'Armure', nomAD22)?.id ?? null;
    } else if (nomAD22 && elementaireLue && !portees.length) {
      if (!retrouver(regles.armures_elementaires, nomAD22, { autres: () => [] }).some((x) => x.id === elementaireLue.id)) {
        remarques.push(`Armure : « ${nomAD22} » (Nom Armure) ne correspond pas à la case Bonus/Malus (${nomDe(regles.armures_elementaires, elementaireLue.id)}) : celle-ci est reprise`);
      }
    } else if (nomAD22 && portees.length && !nommeLesPieces(regles, nomAD22, portees.map((x) => x.ligne))) {
      remarques.push(`Armure : « ${nomAD22} » (Nom Armure) ne correspond pas à la case Bonus/Malus (${nomDe(regles.armures, f.armure_id)}) : celle-ci est reprise`);
    }
    // la solidité de chaque partie (décision R95) : la ligne « Sol. » de la grille (AI24:AN24), « N / M » comme celle d'une arme ; une armure à
    // solidité unifiée n'en a qu'une : la plus basse des six (« Si un cran de solidité est perdu, c'est TOUTE l'armure qui est abimée »)
    const lues = [];
    for (const [emplacement, colonne] of Object.entries(d.armure.colonnes)) {
      const adresse = `${colonne}${d.armure.lignes.solidite}`;
      const t = texte(adresse);
      if (!t) continue;
      const nom = nomDe(regles.emplacements_armure, emplacement);
      if (!f.armure_id && !f.armure_elementaire_id) {
        perdu(`Armure, ${nom} (solidité) : « ${t} » sans armure reconnue`);
        continue;
      }
      const [actuelle, maxEcrit] = paireDe(cellule(adresse));
      if (actuelle === null) perdu(`Armure, ${nom} (solidité) : « ${t} » illisible`);
      else lues.push({ emplacement, crans: entierDe(actuelle, t, `Armure, ${nom} (solidité)`), maxEcrit });
    }
    // une fiche d'avant (l'armure et son « élément ») : la solidité est celle de l'armure d'origine, que la conversion note (R165 (8))
    const sol = deuxArmures(f) ? { ...f, armure_elementaire_id: null, armure_amelioration_elementaire_id: null } : f;
    const a = partiesDeLArmure(regles, sol);
    if (a && lues.length) {
      if (a.uni) f.armure_parties = partiesApresReglage(regles, sol, a.parties[0].emplacement_id, Math.min(...lues.map((x) => x.crans)));
      else for (const x of lues) f.armure_parties = partiesApresReglage(regles, { ...sol, armure_parties: f.armure_parties }, x.emplacement, x.crans);
      const ecrits = [...new Set(lues.map((x) => x.maxEcrit).filter((m) => m !== null && m !== a.max))];
      if (ecrits.length) remarques.push(`Armure (${a.armure.nom}) : solidité maximale écrite ${ecrits.join(', ')}, le site calcule ${a.max} (décisions R77, R95${a.elementaire ? ', R165' : ''})`);
    }
  }

  // ---- bouclier (décision R96 : une forme et une matière) : la forme en AA26 ; la matière en AF26, suivie de l'amélioration (« Fer · niv. 2 — … ») ;
  // un classeur d'avant (plusieurs matériaux : « Fer ×2, Bois ×1 », ou les trois cases de la fiche auto) donne sa première matière, les autres sont
  // dites perdues ; la solidité du moment « N / M » en AX26 (modèle ordinateur)
  if (texte(d.bouclier.nom)) f.bouclier_classe_id = unSeul(retrouver(regles.boucliers, texte(d.bouclier.nom)), 'Bouclier', texte(d.bouclier.nom))?.id ?? null;
  const [matieres, ameliorationDuBouclier] = auto
    ? [d.bouclier.materiaux.map((m) => texte(m.materiau)).filter(Boolean), null]
    : (() => {
      const [composition, ...suite] = texte(d.bouclier.composition).split(SEPARATEUR_D_ARMURE.trim()).map((x) => x.trim());
      return [String(composition ?? '').split(',').map((x) => lireObjet(x)?.nom).filter(Boolean), suite.join(` ${SEPARATEUR_D_ARMURE.trim()} `) || null];
    })();
  for (const nom of matieres) {
    const materiau = unSeul(retrouver(regles.materiaux_bouclier, nom), 'Bouclier, matériau', nom);
    if (!materiau) continue;
    if (!f.bouclier_classe_id) perdu(`Bouclier, matière « ${nom} » sans forme`);
    else if (f.bouclier_materiau_id) perdu(`Bouclier, matériau : « ${nom} » (un bouclier n’a plus qu’une forme et une matière : décision R96)`);
    else f.bouclier_materiau_id = materiau.id;
  }
  if (ameliorationDuBouclier && f.bouclier_materiau_id) f.bouclier_amelioration_id = amelioration(ameliorationDuBouclier, 'bouclier', 'Bouclier, amélioration');
  const soliditeDuBouclier = auto || texte(d.bouclier.solidite) === MODELE_DE_LA_SOLIDITE ? '' : texte(d.bouclier.solidite);
  if (soliditeDuBouclier) {
    const [actuelle] = paireDe(cellule(d.bouclier.solidite));
    if (!f.bouclier_materiau_id) perdu(`Bouclier, solidité : « ${soliditeDuBouclier} » sans bouclier`);
    else if (actuelle === null) perdu(`Bouclier, solidité : « ${soliditeDuBouclier} » illisible`);
    else f.bouclier_solidite = soliditeDuBouclierAEcrire(regles, f, entierDe(actuelle, soliditeDuBouclier, 'Bouclier, solidité'));
  }

  // ---- modèle ordinateur : l'AP et l'AM de l'armure sur chaque partie (grille AI22:AN23), calculés depuis la décision R108 (la valeur de l'armure, 0
  // sur une partie cassée : armureParPartie), jamais relus ; une autre valeur que celle que calcule le site (un classeur fait à la main, ou d'avant R108)
  // dans les notes ; de même ceux du bouclier (AN26, AS26 ; 0 cassé) ; puis les zones de saisie que le site ne garde pas
  if (!auto) {
    const valeurs = { ap: 'AP', am: 'AM' };
    const parPartie = armureParPartie(regles, f);
    for (const s of CASES_AP_AM_DE_L_ARMURE) {
      const t = texte(s.adresse);
      if (!t || t === s.modele) continue;
      const quoi = `Armure, ${nomDe(regles.emplacements_armure, s.emplacement)} (${valeurs[s.valeur]})`;
      const calcule = parPartie?.find((p) => p.id === s.emplacement)?.[s.valeur];
      if (calcule === undefined) perdu(`${quoi} : « ${t} » sans armure reconnue`);
      else if (t.trim() !== String(calcule) && cellule(s.adresse)?.valeur !== calcule) perdu(`${quoi} : « ${t} », le site calcule ${calcule} (décision R108)`);
    }
    // de même l'AP et l'AM du bouclier (AN26, AS26) : ceux du bouclier de la liste, 0 cassé (décision R108 : ses AP et AM ne comptent plus),
    // apAmDuBouclier, ce qu'écrit l'export ; un classeur qui en écrit d'autres (4 AP pour un bouclier cassé) le voit dit
    const duBouclier = apAmDuBouclier(bouclierDe(regles, f));
    for (const [valeur, adresse] of [['ap', d.bouclier.ap], ['am', d.bouclier.am]]) {
      const t = texte(adresse);
      if (!t) continue;
      const quoi = `Bouclier (${valeurs[valeur]})`;
      const calcule = duBouclier?.[valeur];
      if (calcule === undefined) perdu(`${quoi} : « ${t} » sans bouclier reconnu`);
      else if (t.trim() !== String(calcule) && cellule(adresse)?.valeur !== calcule) {
        perdu(`${quoi} : « ${t} », le site calcule ${calcule} (${duBouclier.casse ? 'bouclier cassé, ' : ''}décision R108)`);
      }
    }
    const titre = texte(d.inventaire.titre);
    if (titre && cle(titre) !== cle(TITRE_DE_L_INVENTAIRE)) {
      const sac = cle(titre).startsWith(cle(TITRE_DE_L_INVENTAIRE)) && titre.includes('=') ? titre.slice(titre.indexOf('=') + 1).trim() : titre;
      if (sac) perdu(`Inventaire, sac : « ${sac} » sans place sur le site`);
    }
  }

  // ---- ceinture et inventaire (ressource_id : la ressource de ce nom exact, comme la page)
  const ressource = (nom) => (regles.ressources ?? []).find((r) => r.nom === nom)?.id ?? null;
  const objetAuto = (aNom, aQuantite) => {
    const nom = texte(aNom);
    return nom ? { nom, quantite: entierLu(aQuantite, `Quantité de « ${nom} »`) ?? 1 } : null;
  };
  // une quantité 0 n'a de sens qu'à la ceinture, pour un carquois ou un sac de projectiles vide (décision R89 : minimumDeLEmplacement)
  const ranger = (liste, objet, quoi, rang) => {
    if (!objet) return;
    if (objet.quantite < (liste === f.ceinture ? minimumDeLEmplacement(regles, objet.nom) : 1)) perdu(`${quoi} : « ${objet.nom} » en quantité ${objet.quantite}`);
    else liste.push({ rang, nom: objet.nom, quantite: objet.quantite, ressource_id: ressource(objet.nom) });
  };
  d.ceinture.forEach((c, i) => ranger(f.ceinture, auto ? objetAuto(c.nom, c.quantite) : lireObjet(texte(c)), `Ceinture ${i + 1}`, i + 1));
  const objets = [];
  for (const colonne of d.inventaire.colonnes) {
    for (const l of d.inventaire.lignes) objets.push(auto ? objetAuto(`${colonne.nom}${l}`, `${colonne.quantite}${l}`) : lireObjet(texte(`${colonne}${l}`)));
  }
  for (const v of notee('inventaire')) objets.push(...lireListe(v).map(lireObjet));
  for (const o of objets) ranger(f.inventaire, o, 'Inventaire', f.inventaire.length + 1);

  // ---- événements (titre, type, texte : « titre (type) : texte »), notes
  const evenements = [];
  const derniere = auto ? d.evenementsJusqua : DONS.evenements[DONS.evenements.length - 1];
  for (let l = DONS.evenements[0]; l <= derniere; l += 1) {
    const type = texte(casesDuDon(l).type);
    const tete = [texte(casesDuDon(l).nom), type ? `(${type})` : ''].filter(Boolean).join(' ');
    const corps = texte(casesDuDon(l).effet);
    if (tete && corps) evenements.push(`${tete} : ${corps}`);
    else if (tete || corps) evenements.push(tete || corps);
  }
  evenements.push(...notee('evenement'));
  f.evenements = evenements.length ? evenements.join('\n') : null;
  f.notes = note.autres.length ? ajouterAuxNotes(note.notes, note.autres) : note.notes;


  // ---- valeurs du moment (null : au maximum ; corruption : null à 0) et posture du moment
  const QUOI_DES_JAUGES = { sante_actuelle: 'Santé', chakra_actuel: 'Chakra', barriere_actuelle: 'Barrière', barre4_actuelle: '4ᵉ barre', corruption: 'Corruption' };
  const paireLue = (adresse, champ) => paireDe(cellule(adresse)).map((n) => entierDe(n, texte(adresse), QUOI_DES_JAUGES[champ]));
  const jauges = auto
    ? [['sante_actuelle', d.sante, d.santeMax], ['chakra_actuel', d.chakra, d.chakraMax], ['barriere_actuelle', d.barriere, d.barriereMax], ['barre4_actuelle', d.barre4, d.barre4Max]]
      .map(([champ, a, max]) => [champ, entierLu(a, QUOI_DES_JAUGES[champ]), entierLu(max, `${QUOI_DES_JAUGES[champ]} (maximum)`)])
    : [['sante_actuelle', d.sante], ['chakra_actuel', d.chakra], ['barriere_actuelle', d.barriere], ['barre4_actuelle', d.barre4]]
      .map(([champ, a]) => [champ, ...paireLue(a, champ)]);
  // la santé du moment n'a pas de plancher (décision R171 : « Peut devenir négative ») ; les autres jauges restent au moins à 0
  for (const [champ, valeur, max] of jauges) f[champ] = valeur === null || valeur === max ? null : champ === 'sante_actuelle' ? valeur : Math.max(0, valeur);
  const corruption = auto ? entierLu(d.corruption, QUOI_DES_JAUGES.corruption) : paireLue(d.corruption, 'corruption')[0];
  f.corruption = corruption ? Math.max(0, corruption) : null;
  if (!auto) {
    const marquees = CASES_POSTURES.filter((p) => porteUneMarque(texte(p.titre)));
    if (marquees.length === 1) f.posture_id = marquees[0].id;
    else if (marquees.length > 1) perdu(`Posture du moment : plusieurs postures marquées (${marquees.map((p) => texte(p.titre)).join(', ')})`);
  } else if (estCoche(cellule(d.ambidextrie))) {
    perdu('Ambidextrie : cochée dans le classeur ; la fiche calcule l’attaque à deux armes d’après les armes portées (décision R46)');
  }

  // ---- gains de niveau (deux totaux, décision R73) : la ligne de la note (celle d'un classeur exporté avant, niveau par niveau, est sommée par
  // lireGains) ; sinon, d'un classeur qui ne vient pas de la page, « maximum lu − le reste du calcul » : les maximums de santé et de chakra (fiche auto :
  // F14, M14 ; modèle ordinateur : le « b » de « a / b ») moins ce que la fiche calcule sans gains (race, ethnie, magies, classes, accessoires)
  const gainsEcrits = notee('gains')[0];
  if (gainsEcrits !== undefined) {
    const lus = lireGains(gainsEcrits);
    if (lus) Object.assign(f, lus);
    else perdu(`Gains de niveau : « ${gainsEcrits} » illisibles`);
  } else if (!deLaPage) {
    const [maxSante, maxChakra] = [jauges[0][2], jauges[1][2]];
    const gains = maxSante !== null && maxChakra !== null ? gainsDesMaximums(regles, f, maxSante, maxChakra) : null;
    if (gains) {
      Object.assign(f, { gains_sante: gains.gains_sante, gains_chakra: gains.gains_chakra });
      remarques.push(gains.remarque);
    }
  }

  // ---- effet en plus des armes (modèle ordinateur) : les lignes du joueur, sans la part affichée de la fiche relue (lireEffetDArme), ni une ligne « Deux
  // armes : » ou « Non compté : » qu'elle n'écrit plus (seul le site les écrit : celle de Vieille Branche d'un classeur exporté avant la décision R107) ;
  // celles écrites sans « Effet en plus : » sont dites dans un classeur qui ne vient pas de la page ; une ligne du site écartée qui n'est pas celle que
  // la fiche écrit aujourd'hui pour cette arme est dite aussi (« rien ne se perd sans être dit »), dans tout classeur, sans être reprise
  for (const { rang, effet, arme, catalogue, entier } of effetsEnPlus) {
    const ligne = f.armes.find((x) => x.rang === rang);
    if (!ligne) continue;
    const lue = lireEffetDArme(effet, { affichees: partiesDeLArme(regles, f, rang).affichees.join('\n'), catalogue, entier });
    ligne.effet_en_plus = lue.effetEnPlus;
    // (dans un classeur de la page aussi quand la case ne porte plus ce que le site y écrit : l'effet du catalogue a pu changer depuis l'export)
    if (lue.libres.length && (!deLaPage || !lue.affichageRetrouve)) {
      const s = lue.libres.length > 1 ? 's' : '';
      const pourquoi = deLaPage ? ' (la case ne porte plus ce que le site y écrit pour cette arme)' : '';
      remarques.push(`Arme ${rang} (${arme.nom}) : ligne${s} ${lue.libres.map((l) => `« ${l} »`).join(', ')} reprise${s} comme effet en plus${pourquoi}`);
    }
    if (lue.ecartees.length) {
      const s = lue.ecartees.length > 1 ? 's' : '';
      remarques.push(`Arme ${rang} (${arme.nom}) : ligne${s} ${lue.ecartees.map((l) => `« ${l} »`).join(', ')} non reprise${s} (recalculée${s} par le site)`);
    }
  }

  // ---- les compteurs entamés des actions (décision R173), dans la note : la clé d'une action à compteur de la fiche importée (son équipement, ses dons
  // et sa race relus), une fois chacune, sous son maximum ; sinon la ligne est perdue, avec sa raison
  const compteurs = notee('compteurAction');
  if (compteurs.length) {
    const actions = new Map(actionsDeLaFiche(regles, f).filter((a) => a.compteur).map((a) => [a.cle, a]));
    f.actions_usage = [];
    for (const ecrit of compteurs) {
      const lu = lireCompteurDAction(ecrit);
      const action = lu ? actions.get(lu.cle) : null;
      if (!lu) perdu(`Compteur d’action : « ${ecrit} » illisible`);
      else if (!action) perdu(`Compteur d’action : « ${ecrit} » : la fiche n’a pas cette action`);
      else if (f.actions_usage.some((u) => u.action_id === lu.cle)) perdu(`Compteur d’action : « ${ecrit} » : déjà lu`);
      else if (lu.restants < action.compteur.max) f.actions_usage.push({ action_id: lu.cle, restants: lu.restants });
    }
  }

  // ---- portrait (modèle ordinateur) : l'image ancrée en A1, sauf le logo du modèle ; une autre image n'a pas de place
  let image = null;
  let portraitGarde = false;
  if (!auto) {
    const portraits = [];
    for (const x of feuille?.images ?? []) {
      const description = String(x.description ?? '').trim();
      const marqueeLogo = /^logo/i.test(description) || (!description && cle(x.nom) === 'logo');
      if (x.de !== d.image) perdu(`Image en ${x.de} non reprise : le portrait se place en ${d.image}`);
      else if (/^portrait/i.test(description) || (!marqueeLogo && !memesOctets(x.octets, logo))) portraits.push(x);
    }
    image = portraits[0] ?? null;
    for (const x of portraits.slice(1)) perdu(`Image en ${x.de} non reprise : une seule image sert de portrait`);
    if (image) {
      const empreinte = /^portrait:(.+)$/i.exec(String(image.description ?? '').trim())?.[1]?.trim();
      portraitGarde = Boolean(empreinte && empreintePortrait && empreinte === empreintePortrait);
    }
  }

  return { fiche: f, disposition: d.disposition, nonRepris, remarques, image, portraitGarde };
}

/**
 * « Nom Armure » (AD22) nomme-t-il les pièces relues dans la case Bonus/Malus ? Comme l'écrit la page : l'armure complète, sinon les pièces jointes par
 * « , » (une écriture qui désigne chacune, anciennes graphies comprises : retrouver), autant de noms que de pièces. Une liste de pièces n'y est
 * qu'affichée (l'import les lit dans Bonus/Malus) : coupée par la page (« … »), son début.
 */
function nommeLesPieces(regles, nom, armures) {
  const complete = armures.find((x) => x.emplacement_id === ARMURE_COMPLETE);
  const montre = sansLaCoupure(nom);
  if (montre !== null) {
    const ordre = (regles.emplacements_armure ?? []).map((e) => e.id);
    const ecrites = complete ? [complete] : [...armures].sort((a, b) => ordre.indexOf(a.emplacement_id) - ordre.indexOf(b.emplacement_id));
    const attendu = ecrites.map((x) => trouver(regles.armures, x.armure_id)?.nom ?? x.armure_id).join(', ');
    return cle(montre) !== '' && cle(attendu).startsWith(cle(montre));
  }
  if (complete) return retrouver(regles.armures, nom).some((a) => a.id === complete.armure_id);
  const restantes = armures.map((x) => x.armure_id);
  const ecrits = nom.split(',').map((x) => x.trim()).filter(Boolean);
  if (ecrits.length !== restantes.length) return false;
  for (const ecrit of ecrits) {
    const i = restantes.findIndex((id) => retrouver(regles.armures, ecrit).some((a) => a.id === id));
    if (i < 0) return false;
    restantes.splice(i, 1);
  }
  return true;
}

/** Deux suites d'octets identiques (le logo du modèle n'est pas un portrait). */
function memesOctets(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Les gains de niveau d'un classeur qui ne les écrit pas (décision R73 : « Import d'une fiche auto : gains = maximum lu − le reste du calcul ») :
 * { gains_sante, gains_chakra, remarque }. Chacun = le maximum lu moins ce que la fiche calcule sans gains (attributsDe : race, ethnie, magies, classes,
 * accessoires) ; un maximum plus petit que ce calcul donne 0, à vérifier. La remarque dit toujours la déduction (fiche auto de Lucien : « Gains de
 * niveau déduits des maximums du classeur (santé 60, chakra 150) : santé 41, chakra 121 »), et un total hors de ce que donnent les niveaux atteints
 * (gainsDeNiveau : les points d'attributs et les dés bonus, la règle gains_niveau de la base) : « … : hors du total à saisir (152 à 166), à vérifier ».
 */
export function gainsDesMaximums(regles, fiche, maxSante, maxChakra) {
  const sans = attributsDe(regles, { ...fiche, gains_sante: 0, gains_chakra: 0 });
  const brut = { sante: maxSante - sans.sante, chakra: maxChakra - sans.chakra };
  const gains = { gains_sante: Math.max(0, brut.sante), gains_chakra: Math.max(0, brut.chakra) };
  const partie = (nom, champ) => `${nom} ${gains[`gains_${champ}`]}${brut[champ] < 0 ? ` (maximum sous les ${sans[champ]} que la fiche calcule sans gains)` : ''}`;
  const attendus = gainsDeNiveau(regles, { ...fiche, ...gains });
  const plage = attendus.min === attendus.max ? String(attendus.min) : `${attendus.min} à ${attendus.max}`;
  const suite = attendus.hors ? ` : hors du total à saisir (${plage}), à vérifier` : brut.sante < 0 || brut.chakra < 0 ? ' : à vérifier' : '';
  return {
    ...gains,
    remarque: `Gains de niveau déduits des maximums du classeur (santé ${maxSante}, chakra ${maxChakra}) : ${partie('santé', 'sante')}, ${partie('chakra', 'chakra')}${suite}`,
  };
}

// ------------------------------------------------------------------ ce que la page /fiche/ fait d'un classeur lu (src/scripts/fiche.mjs)

/** L'onglet des deux modèles (comparé par cle()) : celui que la page essaie d'abord et ne nomme pas dans son message. */
const ONGLET_DES_MODELES = cle('Personnage');

/**
 * L'onglet de la fiche dans un classeur lu (lib/tableur-lecture.mjs#lireClasseur) : le premier qui suit l'une des deux dispositions (dispositionDe),
 * « Personnage » essayé d'abord, puis les autres onglets dans l'ordre (classeur.trouver) : un onglet renommé ou déplacé, ou rangé parmi d'autres (« BDD »,
 * « Race »… de la fiche auto), est retrouvé à son contenu. Error ERREUR_DISPOSITION si aucun ne convient (celle d'un onglet illisible, s'il y en a un).
 */
export function feuilleDeLaFiche(classeur) {
  const suitUnModele = (f) => {
    const cellules = f?.cellules instanceof Map ? f.cellules : new Map(Object.entries(f?.cellules ?? {}));
    return dispositionDe((adresse) => texteDe(cellules.get(adresse))) !== null;
  };
  const feuille = classeur.trouver(suitUnModele);
  if (!feuille) throw new Error(ERREUR_DISPOSITION);
  return feuille;
}

/**
 * Le début du message de la page après l'import d'un classeur : « Classeur importé (modèle ordinateur). », « Classeur importé (modèle auto, onglet
 * « Fiche de Lucien ») : 1 information sans équivalent et 2 remarques ajoutées aux notes. » ; l'onglet lu (`onglet`, le nom de la feuille) n'est nommé
 * que si ce n'est pas « Personnage » (un .csv n'a pas d'onglet : sa feuille porte le nom du fichier) ; `nonRepris`, `remarques` : leur nombre. La page
 * y ajoute la suite (« Enregistrez pour … »).
 */
export function messageDImport({ disposition, format = null, onglet = '', nonRepris = 0, remarques = 0 }) {
  const ou = format !== 'csv' && cle(onglet) && cle(onglet) !== ONGLET_DES_MODELES ? `, onglet « ${String(onglet).trim()} »` : '';
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const dans = [
    nonRepris ? pluriel(nonRepris, 'information sans équivalent', 'informations sans équivalent') : null,
    remarques ? pluriel(remarques, 'remarque', 'remarques') : null,
  ].filter(Boolean);
  const notes = dans.length ? ` : ${dans.join(' et ')} ajouté${nonRepris + remarques > 1 ? 'es' : 'e'} aux notes` : '';
  return `Classeur importé (modèle ${disposition}${ou})${notes}.`;
}

/**
 * Le portrait de la fiche importée, d'après ce que rend ficheDuClasseur (`image`, `portraitGarde`), le portrait de la fiche ouverte (`portrait`) et la
 * cible de l'import (`cible` : 'mettre-a-jour' le prétiré ouvert ou 'creer' un nouveau prétiré : dialogue « import-cible » de la page) :
 *   'garder' : celui de la fiche ouverte, avec son cadrage : le classeur porte son empreinte (exporté par la page avec ce portrait : l'image d'origine
 *              plutôt que sa vignette), ou c'est une mise à jour et le classeur n'a pas d'image (fiche auto, .csv, export sans portrait) ;
 *   'image'  : l'image du classeur, que la page réduit comme une image choisie (cadrage par défaut) ;
 *   'aucun'  : un nouveau prétiré tiré d'un classeur sans image n'a pas de portrait.
 * Une image que la page ne sait pas lire : la redemander sans elle (`{ ...lu, image: null }`).
 */
export function portraitDeLImport({ image = null, portraitGarde = false } = {}, { portrait = null, cible = 'creer' } = {}) {
  if (portrait && portraitGarde) return 'garder';
  if (image) return 'image';
  return portrait && cible === 'mettre-a-jour' ? 'garder' : 'aucun';
}
