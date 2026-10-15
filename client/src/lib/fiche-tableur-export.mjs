// Export de la fiche de personnage en tableur (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et exportée à
// tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle […] Inutile de mettre les formules dans le fichier généré, seul le
// résultat […] Toute info supplémentaire peut être notée dans les « Notes » ») : les cases du modèle « Fiche-de-personnage-Maverick-V15.2.2
// ordinateur » (lib/fiche-tableur-cases.mjs#ORDINATEUR) remplies des valeurs que la page /fiche/ affiche, calculées par les mêmes appels au moteur
// (lib/fiche-moteur.mjs, lib/sort-maitrise.mjs) — jamais une règle de plus : une case que la fiche ne calcule pas reste telle que dans le modèle (AP/AM
// et solidité d'une pièce d'armure ou du bouclier). La solidité d'une arme (AK17, AX17) : « N / M », celle du moment et le maximum de l'arme forgée
// (décision R74, durabiliteDArme ; rien pour une arme de monstre, sans solidité), relue ; la case « Entraînement » (L42) : le texte libre de la fiche
// (décision R71, personnage.entrainement : bonus d'entraînement, livres de magie lus, ce que le MJ accorde ; jamais compté), relu. La portée d'une
// arme est celle de la page « Armes » (décision R50 : la portée écrite, 1 par défaut ; regles.armes[].portee). Ce qui n'a pas de case (bi-classe,
// gains de niveau — deux totaux, décision R73 : « santé X, chakra Y » —, NM offerts, accessoires de ceinture, débordements des listes…) va dans la case
// NOTE, sous MARQUEUR_DES_NOTES, en lignes « Clé : valeur » que l'import relit (lib/fiche-tableur-import.mjs) : leur mise en forme et leur lecture sont
// ici (CLES_DE_LA_NOTE, texteDesGains / lireGains…), comme celles des cases que l'import relit (objets, accessoires, armure, effet d'une arme, choix du
// métier) : un seul jeu de lecteurs, l'aller et le retour ne divergent pas.
// La note ne porte que des données du personnage, jamais un texte de règles : chaque case écrite est « relue » (l'import en tire un choix : nom, sorts,
// NM, noms des dons, accessoires, objets, événements, lignes de l'armure, composition, effet en plus et solidité d'une arme, choix du métier,
// entraînement…) ou « affichée » (un texte de règles ou un calcul que le site refait : effets des sorts et des dons, textes de la race, artisanat, Mode
// Hyper, résistances, dégâts, effet du catalogue d'une arme…) ; une case à la fois relue et affichée écrit ses lignes relues d'abord (partiesDeLArme,
// partiesDuMetier). Un texte trop long pour sa case (`zones` : la taille des cases du modèle, lib/tableur-ecriture.mjs#zonesDuClasseur) n'y est pas
// rogné : une case de plusieurs rangées prend le retour à la ligne, une case d'une rangée rapetisse un peu son texte (`alignements`), puis la case garde
// ce qui tient, fini par « … » ; seule la part relue qu'elle ne montre pas va dans la note (« Suite de la case AA51 : … »,
// lib/tableur-mesure.mjs#ajusterLeTexte), que l'import recolle. Des
// écritures courtes (accessoire sur une ligne, pièce d'armure sans ses statistiques quand elles ne tiennent pas) laissent ces suites rares ; la note
// qui déborde elle-même s'aligne en haut (son début reste lisible). Une case d'une seule rangée (description et colonnes d'un sort, dons de base, de
// race et du métier) écrit ses parties sur une ligne, séparées par « · » (SEPARATEUR_EN_LIGNE) : coupée, elle montre le début de chacune et pas
// seulement sa première ligne. La case NOTE garde toujours le marqueur et les lignes qui le suivent : au-delà de 32 767 caractères (la limite d'une case
// de tableur, LONGUEUR_MAX_D_UNE_CASE), ce sont les notes du joueur qui sont raccourcies (et, s'il le faut encore, les dernières lignes de données
// retirées), ce que disent les `avertissements` (texteDeLaNote).
// Pur et sans DOM : seuls src/scripts/fiche.mjs (qui y ajoute le portrait, lib/tableur-ecriture.mjs écrit le classeur) et l'import (ses lecteurs)
// l'importent. Il n'importe que des
// modules que seule la page /fiche/ utilise (CLAUDE.md, « Pièges connus » : la version portable refuse un module partagé entre deux scripts de page) ;
// pas lib/text.mjs (partagé par la recherche) : cle() de lib/fiche-tableur-cases.mjs.
import { RAISONS } from './degats-texte.mjs';
import { PARTIES_DE_FICHE, gainsDeLaProgression } from './fiche-format.mjs';
import {
  EMPLACEMENTS_ACCESSOIRES, accessoiresDesSorts, alignementDe, artisanatDe, attaqueADeuxArmes, attributsDe, bonusDuMetier, budgetCaracteristiques,
  caracteristiquesCompletes, caracteristiquesDe, choixEnAttente, classesDe, competencesDe, degatsDArme, donDeBase, donsAcquis, donsDeRace, durabiliteDArme,
  emplacementsDeSorts, maitriseDesSorts, maitrisesValables, modeHyperDe, nmDuSort, npmMax, progressionXp, resistancesDe, trouver, valeursDuMoment,
} from './fiche-moteur.mjs';
import {
  CASES_CARACTERISTIQUES, CASES_COMPETENCES, CASES_POSTURES, CASES_RESISTANCES, DONS, EMPLACEMENTS_DU_MODELE, LONGUEUR_MAX_D_UNE_CASE, MAITRISES,
  MARQUEUR_DES_NOTES, ORDINATEUR, REMPLISSAGE_DE_ATTEINT, casesDesDes, casesDuDon, cle,
} from './fiche-tableur-cases.mjs';
import { modesAuNm, valeurAuNm } from './sort-maitrise.mjs';
import { ajusterLeTexte, sansLaCoupure, tientDans } from './tableur-mesure.mjs';

// ------------------------------------------------------------------ libellés et séparateurs partagés avec l'import

/** Lignes de la case NOTE sous MARQUEUR_DES_NOTES, dans l'ordre où l'export les écrit : « <clé> : <valeur> » (ligneDeNote, lireLigneDeNote). */
export const CLES_DE_LA_NOTE = Object.freeze({
  biClasse: 'Bi-classé',
  caracteristiqueMagie: 'Caractéristique de la magie innée',
  gains: 'Gains de niveau',
  nmOfferts: 'NM offerts',
  accessoireCeinture: 'Accessoire Ceinture',
  accessoireAutre: 'Accessoire Autre',
  donsClasse1: 'Dons de classe 1 (suite)',
  donsClasse2: 'Dons de classe 2 (suite)',
  sorts: 'Sorts (suite)',
  inventaire: 'Inventaire (suite)',
  evenement: 'Événement',
  resistancesAuChoix: 'Résistances au choix (non comptées)',
  modeHyperCent: 'Mode Hyper 100 %',
  choixAFaire: 'Choix à faire',
  // dernière ligne, écrite seulement quand la case NOTE pleine a perdu des lignes de données (texteDeLaNote) : l'import sait alors qu'une suite a pu manquer
  lignesRetirees: 'Lignes retirées (case NOTE pleine)',
});

/**
 * Début de la ligne de la note qui porte la suite d'un texte relu coupé : « Suite de la case AA51 : <suite> » (le début est dans la case, fini par
 * « … »). Un texte affiché seulement n'en a jamais : coupé, il perd sa fin, que le site refait.
 */
export const SUITE_DE_LA_CASE = 'Suite de la case';
const LIGNE_DE_SUITE = /^suite-de-la-case-([a-z]{1,3}[1-9]\d*)$/;

/** Les lignes d'information : refaites à chaque export d'après le reste de la fiche, l'import les ignore (la ligne d'export aussi : ligneDExport). */
export const CLES_D_INFORMATION = Object.freeze([CLES_DE_LA_NOTE.resistancesAuChoix, CLES_DE_LA_NOTE.modeHyperCent, CLES_DE_LA_NOTE.choixAFaire]);

/** Emplacement d'accessoire sans case dans le modèle (ceinture, autre) → sa clé dans la note (« Accessoire Ceinture »). */
export const CLES_DES_ACCESSOIRES_SANS_CASE = Object.freeze(Object.fromEntries(EMPLACEMENTS_ACCESSOIRES
  .filter(([emplacement]) => !EMPLACEMENTS_DU_MODELE.includes(emplacement))
  .map(([emplacement, nom]) => [emplacement, `Accessoire ${nom}`])));

/** « Bi-classé : oui » / « non ». */
export const OUI = 'oui';
export const NON = 'non';
/** Entre les éléments d'une liste de la note (dons, sorts, objets, NM offerts, niveaux des gains, choix). */
export const SEPARATEUR_DE_LISTE = ' ; ';
/** Entre les lignes d'un accessoire sans case, dans sa ligne de la note. */
export const SEPARATEUR_D_ACCESSOIRE = ' / ';
/** Entre le titre et le texte d'un événement (titre en C, texte en L), et entre la clé et la valeur d'une ligne de la note. */
export const SEPARATEUR_DE_CLE = ' : ';
/** Entre la pièce d'armure et ce qui l'améliore, dans sa ligne de AQ21. */
export const SEPARATEUR_D_ARMURE = ' · ';
/**
 * Entre les parties (et les lignes) d'un texte écrit dans une case d'une seule rangée (description d'un sort : D/S/B, effets, modes, remarque ; dons de
 * base, de race et du métier) : coupée, la case montre le début de chacune, et non seulement sa première ligne.
 */
export const SEPARATEUR_EN_LIGNE = ' · ';
/** Quantité d'un objet : « Corde ×3 ». */
export const MULTIPLICATION = '×';
/** Compétence ou famille choisie : « → Magie » (accessoire, bonus de métier à choix ; « → ? » pas encore choisi). */
export const FLECHE = '→';
/** Dernière ligne d'un accessoire maudit. */
export const MAUDIT = 'Maudit';
/** Préfixe de l'effet hors table d'un accessoire (« Effet : … »). */
export const EFFET_LIBRE = 'Effet';
/** Marque du titre de la posture du moment (« ✔ OFFENSIF »). */
export const MARQUE_DE_POSTURE = '✔';
/** Marque d'une croix sur une caractéristique (H18, I18…). */
export const MARQUE_DE_CROIX = 'X';
/** Préfixe de la remarque d'un sort dans sa description (comme l'étoile de la page). */
export const ETOILE = '★';

/** Titres des postures dans le modèle (BA16, BI16…), dans l'ordre de CASES_POSTURES : la base ne les donne pas (posture.libelle_fiche n'est pas dans les règles). */
export const TITRES_DES_POSTURES = Object.freeze({
  'guide/postures#posture:offensif': 'OFFENSIF',
  'guide/postures#posture:neutre': 'NEUTRE',
  'guide/postures#posture:defensif': 'DEFENSIF',
  'guide/postures#posture:focus': 'FOCUS',
  'guide/postures#posture:vigilance': 'VIGILANCE',
  'guide/postures#posture:symbiose': 'SYMBIOSE',
});

/**
 * Préfixes des lignes de la case de l'effet d'une arme (AA13, AN13) : composition, améliorations, élément et effet en plus, que l'import relit, avant
 * celles qui ne sont qu'affichées (l'effet du catalogue, puis deux armes et non comptés).
 */
export const LIGNES_D_ARME = Object.freeze({
  composition: 'Composition',
  amelioration: 'Amélioration',
  element: 'Élément',
  ameliorationElement: 'Amélioration de l’élément',
  deuxArmes: 'Deux armes',
  nonCompte: 'Non compté',
  effetEnPlus: 'Effet en plus',
});

/** Les types de don, comme la page (TYPES_DE_DON de src/scripts/fiche.mjs). */
export const TYPES_DE_DON = Object.freeze({ passif: 'Passif', actif: 'Actif', action: 'Action', reaction: 'Réaction', variable: 'Variable' });

/** Les mots d'une ligne d'armure (AQ21) : « Torse : Cuir · amél. niv. 1 (+2 AP/AM) · élément Garde coeur · amél. élément niv. 2 (+4 AP/AM) ». */
export const LIGNES_D_ARMURE = Object.freeze({ amelioration: 'amél.', element: 'élément', ameliorationElement: 'amél. élément' });

/** Ligne d'information de la note : le Mode Hyper 100 % débloqué (ses effets sont un texte de règles : la page les montre, pas la note). */
export const MODE_HYPER_CENT_DEBLOQUE = 'débloqué';

/** Libellé du dé d'un gain de niveau dans la note d'avant la décision R73 (personnage_progression.de_choix, niveau par niveau), relue par lireGains. */
export const DES_DES_GAINS = Object.freeze({ sante: 'santé', chakra: 'chakra', les_deux: 'les deux' });

// ------------------------------------------------------------------ outils

const entier = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const signe = (n) => (n > 0 ? `+${n}` : String(n));
const vide = (v) => v === null || v === undefined || v === '';
/** Les lignes d'un texte, sans leurs blancs de bord, sans les vides (découpage linéaire : pas d'expression régulière qui revienne sur ses pas). */
const lignesSansBlancs = (t) => String(t ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
/** Un texte sur une seule ligne (dans une ligne d'une case à plusieurs lignes que l'import découpe). */
const uneLigne = (t) => lignesSansBlancs(t).join(' ');
/** Des parties de texte sur une ligne, chaque partie et chacune de ses lignes séparées par SEPARATEUR_EN_LIGNE (case d'une seule rangée). */
const enUneLigne = (parties) => parties.flatMap(lignesSansBlancs).join(SEPARATEUR_EN_LIGNE);
/** « <clé> : <valeur> » d'une ligne, coupée à son premier « : » (pas en tête) : { cle, valeur } sans leurs blancs de bord ; null sans « : ». */
function deuxPoints(ligne) {
  const t = String(ligne ?? '');
  const i = t.indexOf(':');
  return i > 0 && t.slice(0, i).trim() ? { cle: t.slice(0, i).trim(), valeur: t.slice(i + 1).trim() } : null;
}
/** Un texte sans ses lignes vides (ou d'espaces et de tabulations) de fin. */
function sansLignesVidesDeFin(t) {
  const lignes = String(t ?? '').split('\n');
  let n = lignes.length;
  while (n > 1 && /^[ \t]*\r?$/.test(lignes[n - 1])) n -= 1;
  return n === lignes.length ? lignes.join('\n') : lignes.slice(0, n).join('\n').replace(/\r$/, '');
}
/** Un texte de la base qui n'est qu'un entier (« 4 ») s'écrit en nombre ; sinon tel quel. */
const nombreSiEntier = (t) => (typeof t === 'string' && /^-?(0|[1-9]\d*)$/.test(t.trim()) ? Number(t.trim()) : t);
const nomDe = (liste, id) => (id ? trouver(liste ?? [], id)?.nom ?? id : null);

// ------------------------------------------------------------------ lignes de la note

/** La ligne de la note qui date l'export (information). */
export const ligneDExport = (date) => `Exporté le ${date} depuis Maverick Center.`;
const LIGNE_D_EXPORT = /^Exporté le (.+?) depuis Maverick Center\.?$/;

/** « <clé> : <valeur> ». */
export const ligneDeNote = (cle_, valeur) => `${cle_}${SEPARATEUR_DE_CLE}${valeur}`;

const CLES_CONNUES = new Map([
  ...Object.entries(CLES_DE_LA_NOTE).map(([nom, libelle]) => [cle(libelle), { nom, libelle }]),
  ...Object.entries(CLES_DES_ACCESSOIRES_SANS_CASE).map(([emplacement, libelle]) => [cle(libelle), { nom: 'accessoire', libelle, emplacement }]),
]);

/**
 * Une ligne de la note sous le marqueur : { nom (clé de CLES_DE_LA_NOTE, 'accessoire', 'suite' ou 'export'), cle (libellé canonique), valeur, information,
 * emplacement?, adresse? (la case d'une suite) } ; null pour une ligne qui n'est pas d'une clé connue (comparée par cle() : « bi-classe : OUI » est
 * reconnue).
 */
export function lireLigneDeNote(ligne) {
  const texte = String(ligne ?? '').trim();
  const exporte = LIGNE_D_EXPORT.exec(texte);
  if (exporte) return { nom: 'export', cle: 'Exporté le', valeur: exporte[1], information: true };
  const i = texte.indexOf(':');
  if (i <= 0) return null;
  const suite = LIGNE_DE_SUITE.exec(cle(texte.slice(0, i)));
  if (suite) return { nom: 'suite', cle: SUITE_DE_LA_CASE, valeur: texte.slice(i + 1).trim(), information: false, adresse: suite[1].toUpperCase() };
  const connue = CLES_CONNUES.get(cle(texte.slice(0, i)));
  if (!connue) return null;
  return {
    nom: connue.nom, cle: connue.libelle, valeur: texte.slice(i + 1).trim(), information: CLES_D_INFORMATION.includes(connue.libelle),
    ...(connue.emplacement ? { emplacement: connue.emplacement } : {}),
  };
}

/** Une liste de la note : ses éléments, sans les vides. */
export const lireListe = (valeur) => String(valeur ?? '').split(SEPARATEUR_DE_LISTE.trim()).map((x) => x.trim()).filter(Boolean);

/**
 * « Nom » (quantité 1) ou « Nom ×N ». Un nom que lireObjet prendrait pour une quantité (« Carquois normal (10) », une ressource) garde son « ×1 » : relu,
 * il redonne le nom entier.
 */
export function texteDObjet({ nom, quantite }) {
  const n = vide(quantite) ? 1 : entier(quantite);
  const brut = String(nom ?? '').trim();
  return n === 1 && lireObjet(brut)?.nom === brut ? brut : `${brut} ${MULTIPLICATION}${n}`;
}

/**
 * { nom, quantite } d'un objet écrit « Nom ×N » (aussi « Nom x N », « Nom (xN) », « Nom (N) » en fin : la fiche auto et les joueurs les écrivent) ;
 * sans quantité écrite, 1 ; null pour un texte vide.
 */
export function lireObjet(texte) {
  const brut = String(texte ?? '').trim();
  if (!brut) return null;
  // la fin du texte seulement (« ×3 », « x 3 » après un blanc, « (x3) », « (3) ») : le nom est ce qui précède (pas de préfixe paresseux suivi de blancs,
  // dont le coût croît comme le carré d'une suite d'espaces)
  for (const forme of [/×\s*(\d+)$/, /\s[xX]\s*(\d+)$/, /\(\s*(?:[x×X]\s*)?(\d+)\s*\)$/]) {
    const m = forme.exec(brut);
    const nom = m ? brut.slice(0, m.index).trim() : '';
    if (nom) return { nom, quantite: Number(m[1]) };
  }
  return { nom: brut, quantite: 1 };
}

/** Les gains de niveau (décision R73 : deux totaux) : « santé 41, chakra 121 » ; vide quand les deux sont nuls (la note n'en a pas de ligne). */
export function texteDesGains(fiche) {
  const sante = entier(fiche?.gains_sante);
  const chakra = entier(fiche?.gains_chakra);
  return sante || chakra ? `santé ${sante}, chakra ${chakra}` : '';
}

/**
 * Les lignes de personnage_progression d'une note d'avant la décision R73 (« niv. 2 : santé 10, chakra 5 ; niv. 5 : …, dé chakra 6 », « niveau 2 »
 * aussi) ; un dé choisi sans son résultat (l'ancienne page le laissait saisir) est relu tel quel. null si une partie ne se lit pas.
 */
function lignesDesGains(texte) {
  const choix = new Map(Object.entries(DES_DES_GAINS).map(([id, libelle]) => [cle(libelle), id]));
  const lignes = [];
  for (const morceau of lireListe(texte)) {
    const m = /^niv(?:eau|\.)?\s*(\d+)\s*:\s*(.*)$/i.exec(morceau);
    if (!m) return null;
    const p = { niveau: Number(m[1]), points_sante: 0, points_chakra: 0, de_choix: null, de_resultat: null };
    for (const part of m[2].split(',').map((x) => x.trim()).filter(Boolean)) {
      // « dé <choix>[ <résultat>] » : le résultat lu à la fin, le choix est ce qui reste (sans préfixe paresseux suivi de blancs)
      const de = /^d[ée]\s/i.test(part) ? part.slice(2).trim() : null;
      const resultat = de === null ? null : /\s(\d+)$/.exec(de);
      const choixEcrit = resultat ? de.slice(0, resultat.index).trim() : de;
      const point = /^(sant[ée]|chakra)\s+(\d+)$/i.exec(part);
      if (de !== null && choix.has(cle(choixEcrit))) {
        p.de_choix = choix.get(cle(choixEcrit));
        p.de_resultat = resultat ? Number(resultat[1]) : null;
      } else if (point) p[cle(point[1]) === 'sante' ? 'points_sante' : 'points_chakra'] = Number(point[2]);
      else return null;
    }
    lignes.push(p);
  }
  return lignes;
}

/**
 * Les gains de niveau d'un texte de la note : { gains_sante, gains_chakra }. Le format de texteDesGains (« santé 41, chakra 121 » ; une partie absente
 * vaut 0) et celui d'avant la décision R73, niveau par niveau, sommé comme la reconstruction de la base vivante (gainsDeLaProgression de
 * lib/fiche-format.mjs : le dé « les deux » compte sur chacun). Un texte vide : 0 et 0 ; null si une partie ne se lit pas (l'import le dit).
 */
export function lireGains(texte) {
  const brut = String(texte ?? '').trim();
  if (!brut) return { gains_sante: 0, gains_chakra: 0 };
  if (/^niv/i.test(brut)) {
    const lignes = lignesDesGains(brut);
    return lignes ? gainsDeLaProgression(lignes) : null;
  }
  const gains = { gains_sante: 0, gains_chakra: 0 };
  const lus = new Set();
  for (const part of brut.split(',').map((x) => x.trim()).filter(Boolean)) {
    const point = /^(sant[ée]|chakra)\s+(\d+)$/i.exec(part);
    const champ = point && (cle(point[1]) === 'sante' ? 'gains_sante' : 'gains_chakra');
    if (!point || lus.has(champ)) return null;
    lus.add(champ);
    gains[champ] = Number(point[2]);
  }
  return gains;
}

/** Les NM offerts (livre, MJ) des sorts de la fiche : « Boule de feu (livre 1, MJ 2) ; Brasier (MJ 1) » ; vide quand aucun. */
export function texteDesNmOfferts(regles, sorts) {
  return (sorts ?? []).map((ligne) => {
    const nm = nmDuSort(ligne);
    const parts = [nm.livre ? `livre ${nm.livre}` : null, nm.cadeau ? `MJ ${nm.cadeau}` : null].filter(Boolean);
    return parts.length ? `${nomDe(regles.sorts, ligne.sort_id)} (${parts.join(', ')})` : null;
  }).filter(Boolean).join(SEPARATEUR_DE_LISTE);
}

/** [{ nom, livre, cadeau }] d'un texte de texteDesNmOfferts ; null si un morceau ne se lit pas (l'import le dit). */
export function lireNmOfferts(texte) {
  const offerts = [];
  for (const morceau of lireListe(texte)) {
    const m = /^(.*\S)\s*\(([^()]*)\)$/.exec(morceau);
    if (!m) return null;
    const o = { nom: m[1].trim(), livre: 0, cadeau: 0 };
    for (const part of m[2].split(',').map((x) => x.trim()).filter(Boolean)) {
      const n = /^(livre|MJ)\s+(\d+)$/i.exec(part);
      if (!n) return null;
      o[cle(n[1]) === 'livre' ? 'livre' : 'cadeau'] = Number(n[2]);
    }
    offerts.push(o);
  }
  return offerts;
}

/** Un sort au-delà des 20 lignes : « Boule de feu (NM 2) ». */
export const texteDeSortEnSuite = (nom, nm) => `${nom} (NM ${nm})`;

/** { nom, nm } d'un texte de texteDeSortEnSuite (nm null s'il n'est pas écrit). */
export function lireSortEnSuite(texte) {
  const brut = String(texte ?? '').trim();
  const m = /\(\s*NM\s*(\d+)\s*\)$/i.exec(brut);
  return m ? { nom: brut.slice(0, m.index).trim(), nm: Number(m[1]) } : { nom: brut, nm: null };
}

/** Une amélioration dans une ligne d'arme ou d'armure : « niv. 2 — +4 dégâts ». */
export const texteDAmelioration = (a) => (vide(a.effet) ? `niv. ${a.niveau}` : `niv. ${a.niveau} — ${uneLigne(a.effet)}`);

/** Le niveau écrit d'une amélioration (« niv. 2 — … », « niv. 2 (…) », « niveau 2 » → 2), ou null. */
export function lireNiveauDAmelioration(texte) {
  const m = /niv(?:eau|\.)?\s*(\d+)/i.exec(String(texte ?? ''));
  return m ? Number(m[1]) : null;
}

/** L'effet écrit avec une amélioration : après « — » (« niv. 2 — +4 dégâts ») ou entre les parenthèses finales (« niv. 2 (+4 dégâts) »), ou null. */
export function lireEffetDAmelioration(texte) {
  const t = String(texte ?? '');
  return /—\s*(.+)$/.exec(t)?.[1].trim() ?? /\(([^()]+)\)\s*$/.exec(t)?.[1].trim() ?? null;
}

/** Un événement de la fiche dans le modèle : { titre (case C), texte (case L) } ; « titre : texte » coupé au premier « : » entouré d'espaces. */
export function decouperEvenement(ligne) {
  const t = String(ligne ?? '').trim();
  const i = t.indexOf(SEPARATEUR_DE_CLE);
  const titre = i > 0 ? t.slice(0, i).trim() : '';
  const texte = i > 0 ? t.slice(i + SEPARATEUR_DE_CLE.length).trim() : '';
  return titre && texte ? { titre, texte } : { titre: '', texte: t };
}

// ------------------------------------------------------------------ accessoires

/** Le nom de la propriété d'un effet d'accessoire (« Caractéristique », « Attributs »…). */
const proprieteDeLEffet = (effet) => effet.propriete_nom ?? effet.propriete;

/**
 * La ligne d'un effet de la table doit-elle nommer sa propriété (« Attributs : MALÉDICTION ») ? Oui quand son libellé est vide (« Attaque : »), est aussi
 * celui d'un effet d'une autre propriété, ou écrit « : » (il se lirait comme une propriété) ; sinon le libellé seul la désigne.
 */
function proprieteAEcrire(regles, effet) {
  const k = cle(effet.libelle);
  return !k || String(effet.libelle).includes(':') || (regles.accessoires ?? []).some((e) => e.propriete !== effet.propriete && cle(e.libelle) === k);
}

/**
 * Les lignes d'un accessoire porté (cases AD29… ; note pour la ceinture et « autre », jointes par SEPARATEUR_D_ACCESSOIRE) : son nom s'il en a un ;
 * l'effet de la table sur une ligne, « <libellé>[ = valeur][ → choix] » (la valeur seulement pour un effet à fourchette, le choix : la compétence ou la
 * famille d'armes ; « <propriété> : » devant quand le libellé seul ne suffit pas, proprieteAEcrire) ; « Effet : <texte> » pour l'effet hors table ;
 * « Maudit ». Le nom et le texte libre sur une ligne (l'import découpe la case par lignes).
 */
export function lignesDAccessoire(regles, a) {
  const lignes = [];
  if (!vide(a.nom)) lignes.push(uneLigne(a.nom));
  const effet = trouver(regles.accessoires ?? [], a.accessoire_effet_id);
  const choix = (a.competence_id && nomDe(regles.competences, a.competence_id)) || (a.arme_famille_id && nomDe(regles.familles_armes, a.arme_famille_id));
  if (effet) {
    const valeur = effet.min !== null && effet.min !== undefined && !vide(a.valeur) ? ` = ${entier(a.valeur)}` : '';
    const corps = `${String(effet.libelle ?? '').trim()}${valeur}`.trim();
    const ligne = proprieteAEcrire(regles, effet) ? `${proprieteDeLEffet(effet)}${SEPARATEUR_DE_CLE.trimEnd()}${corps ? ` ${corps}` : ''}` : corps;
    lignes.push(choix ? `${ligne} ${FLECHE} ${choix}` : ligne);
  }
  if (!vide(a.texte)) lignes.push(`${EFFET_LIBRE}${SEPARATEUR_DE_CLE}${uneLigne(a.texte)}`);
  if (choix && !effet) lignes.push(`${FLECHE} ${choix}`);
  if (a.maudit && entier(a.maudit) !== 0) lignes.push(MAUDIT);
  return lignes;
}

/**
 * Les lignes d'un accessoire rangées : { nom, ligne (celle de l'effet, telle qu'écrite), propriete (son nom, s'il est écrit), libelle, valeur, texte,
 * choix, maudit, autres (lignes sans place) } — des textes : l'effet se retrouve dans les règles à l'import. `lignes` : le texte d'une case (une ligne par
 * ligne), ou la liste des lignes (pour la note : sa valeur découpée par SEPARATEUR_D_ACCESSOIRE). Les deux écritures se lisent : « <libellé>[ = N][ → X] »
 * (celle de lignesDAccessoire) et l'ancienne, « <propriété> : <libellé>[ = N] » puis « → X » sur sa ligne. Une ligne d'effet commence par une propriété
 * (regles.accessoires[].propriete_nom) suivie de « : », ou écrit le libellé d'un effet de la table ; la première ligne est le nom quand il y en a une
 * autre, ou qu'elle n'est pas une ligne d'effet.
 */
export function lireAccessoire(regles, lignes) {
  const proprietes = new Map((regles.accessoires ?? []).map((e) => [cle(proprieteDeLEffet(e)), proprieteDeLEffet(e)]));
  const libelles = new Set((regles.accessoires ?? []).map((e) => cle(e.libelle)).filter(Boolean));
  const brut = Array.isArray(lignes) ? lignes : String(lignes ?? '').split(/\r?\n/);
  const lu = { nom: null, ligne: null, propriete: null, libelle: null, valeur: null, texte: null, choix: null, maudit: false, autres: [] };
  const restantes = [];
  for (const ligne of brut.map((x) => String(x).trim()).filter(Boolean)) {
    const deux = deuxPoints(ligne);
    if (cle(ligne) === cle(MAUDIT)) lu.maudit = true;
    else if (ligne.startsWith(FLECHE)) lu.choix = ligne.slice(FLECHE.length).trim() || null;
    else if (deux && cle(deux.cle) === cle(EFFET_LIBRE) && lu.texte === null) lu.texte = deux.valeur;
    else restantes.push(ligne);
  }
  /** La ligne d'un effet : { propriete, libelle, valeur, choix }, ou null. « <libellé>[ = N][ → X] », découpée par indexOf (rien qui revienne sur ses pas). */
  const effetDe = (ligne) => {
    const deux = deuxPoints(ligne);
    const propriete = deux && proprietes.has(cle(deux.cle)) ? proprietes.get(cle(deux.cle)) : null;
    let reste = propriete ? deux.valeur : ligne;
    let choix = null;
    const f = reste.indexOf(FLECHE);
    if (f >= 0) {
      choix = reste.slice(f + FLECHE.length).trim() || null;
      reste = reste.slice(0, f);
    }
    let valeur = null;
    const e = reste.lastIndexOf('=');
    if (e >= 0 && /^[-−]?\d+$/.test(reste.slice(e + 1).trim())) {
      valeur = Number(reste.slice(e + 1).trim().replace('−', '-'));
      reste = reste.slice(0, e);
    }
    const libelle = reste.trim();
    if (!propriete && !libelles.has(cle(libelle))) return null;
    return { propriete, libelle, valeur, choix };
  };
  // le nom en premier (l'export l'y écrit), puis une seule ligne d'effet
  const nommee = restantes.length > 1 || (restantes.length === 1 && !effetDe(restantes[0]));
  if (nommee) lu.nom = restantes[0];
  for (const ligne of restantes.slice(nommee ? 1 : 0)) {
    const effet = lu.ligne === null ? effetDe(ligne) : null;
    if (!effet) {
      lu.autres.push(ligne);
      continue;
    }
    Object.assign(lu, { ligne, propriete: effet.propriete, libelle: effet.libelle, valeur: effet.valeur });
    if (effet.choix) lu.choix = effet.choix;
  }
  return lu;
}

// ------------------------------------------------------------------ armes et armure

/**
 * La case de l'effet d'une arme (AA13, AN13) : { relues, affichees } — relues : la composition, l'amélioration, l'élément, l'amélioration de l'élément
 * (chacune si présente) et, en dernier (il peut tenir sur plusieurs lignes), l'effet en plus saisi ; affichées : l'effet du catalogue (armes[].effet),
 * le malus d'attaque à deux armes de sa main (attaqueADeuxArmes, décision R46), les bonus de dons non comptés (degatsDArme). L'import relit les unes
 * (lireEffetDArme), le site refait les autres.
 */
export function partiesDeLArme(regles, fiche, rang) {
  const ligne = (fiche.armes ?? []).find((x) => entier(x.rang) === rang);
  if (!ligne || vide(ligne.arme_id)) return { relues: [], affichees: [] };
  const arme = trouver(regles.armes, ligne.arme_id);
  const relues = [];
  const materiau = ligne.materiau_id && nomDe(regles.materiaux_armes, ligne.materiau_id);
  if (materiau) relues.push(`${LIGNES_D_ARME.composition}${SEPARATEUR_DE_CLE}${materiau}`);
  const amelioration = trouver(regles.ameliorations ?? [], ligne.amelioration_id);
  if (amelioration) relues.push(`${LIGNES_D_ARME.amelioration}${SEPARATEUR_DE_CLE}${texteDAmelioration(amelioration)}`);
  const element = ligne.arme_elementaire_id && nomDe(regles.armes_elementaires, ligne.arme_elementaire_id);
  if (element) relues.push(`${LIGNES_D_ARME.element}${SEPARATEUR_DE_CLE}${element}`);
  const ameliorationElement = trouver(regles.ameliorations ?? [], ligne.amelioration_elementaire_id);
  if (ameliorationElement) relues.push(`${LIGNES_D_ARME.ameliorationElement}${SEPARATEUR_DE_CLE}${texteDAmelioration(ameliorationElement)}`);
  if (!vide(ligne.effet_en_plus)) relues.push(`${LIGNES_D_ARME.effetEnPlus}${SEPARATEUR_DE_CLE}${ligne.effet_en_plus}`);
  const affichees = [];
  if (!vide(arme?.effet)) affichees.push(String(arme.effet));
  const main = attaqueADeuxArmes(regles, fiche)?.mains[rang - 1];
  if (main) affichees.push(`${LIGNES_D_ARME.deuxArmes}${SEPARATEUR_DE_CLE}−${String(main.malus).replace('.', ',')} % (main ${main.main})`);
  for (const n of degatsDArme(regles, fiche, rang)?.nonComptes ?? []) {
    // les raisons, comme l'infobulle des dégâts de la page (« mains » : libellée par la page, pas par lib/degats-texte.mjs)
    const raison = n.raison === 'mains' ? 'arme à une main non écrite' : RAISONS[n.raison] ?? n.raison;
    affichees.push(`${LIGNES_D_ARME.nonCompte}${SEPARATEUR_DE_CLE}${n.nom} ${signe(n.valeur)} (${raison})`);
  }
  return { relues, affichees };
}

/** Les lignes de la case de l'effet d'une arme, dans l'ordre où l'export les écrit : les relues, puis les affichées (partiesDeLArme). */
export function lignesDArme(regles, fiche, rang) {
  const { relues, affichees } = partiesDeLArme(regles, fiche, rang);
  return [...relues, ...affichees];
}

/**
 * Ce que la case de l'effet d'une arme écrit des choix du joueur : { composition, amelioration, element, ameliorationElement, effetEnPlus, libres }
 * (textes, null pour une ligne absente). Chaque ligne de la case est :
 *   - de la part affichée, que le site refait (l'effet du catalogue, « Deux armes : », « Non compté : ») : `affichees`, ces lignes telles que l'export
 *     les écrit (partiesDeLArme sur la fiche relue, jointes par « \n » ; '' : aucune), reconnues d'un bloc où qu'elles soient, ou au bout d'une case coupée
 *     (« … », lib/tableur-mesure.mjs) dont elles sont le début ; à défaut (case réécrite, règles changées, fiche faite à la main), une à une : une ligne
 *     de l'effet du catalogue (`catalogue`) ou de `affichees`, une ligne « Deux armes : » ou « Non compté : » ;
 *   - une ligne « <Clé> : <valeur> » de LIGNES_D_ARME (la composition, les améliorations, l'élément ; la première de chaque clé) ;
 *   - « Effet en plus : <texte> » et les lignes qui le suivent, jusqu'à la part affichée : l'effet en plus ;
 *   - toute autre ligne (`libres` : le joueur écrit sous le titre « Effet en plus » du modèle, sans préfixe) : de l'effet en plus aussi, dans l'ordre.
 * `affichageRetrouve` : la part affichée attendue est dans la case, d'un bloc ou au bout d'une case coupée (ou il n'y en a pas) ; faux quand elle n'a été
 * reconnue que ligne à ligne (règles changées depuis l'export : une ligne de l'ancien effet du catalogue serait alors prise pour de l'effet en plus).
 * `entier` : le texte n'est que la part relue (recollée à sa suite dans la note), sans part affichée.
 */
export function lireEffetDArme(texte, { affichees = null, catalogue = null, entier: seul = false } = {}) {
  const lu = { composition: null, amelioration: null, element: null, ameliorationElement: null, effetEnPlus: null, libres: [], affichageRetrouve: true };
  const champs = new Map([[cle(LIGNES_D_ARME.composition), 'composition'], [cle(LIGNES_D_ARME.amelioration), 'amelioration'],
    [cle(LIGNES_D_ARME.element), 'element'], [cle(LIGNES_D_ARME.ameliorationElement), 'ameliorationElement']]);
  const { lignes, affichage, retrouvee } = seul
    ? { lignes: String(texte ?? '').replace(/\r\n?/g, '\n').split('\n'), affichage: null, retrouvee: true }
    : partAffichee(String(texte ?? '').replace(/\r\n?/g, '\n'), affichees, catalogue);
  lu.affichageRetrouve = retrouvee;
  const enPlus = [];
  let dedans = false; // dans le bloc « Effet en plus : … »
  lignes.forEach((ligne, i) => {
    if (affichage?.[i]) {
      dedans = false;
      return;
    }
    if (dedans) {
      enPlus.push(ligne);
      return;
    }
    const kv = deuxPoints(ligne);
    const k = kv ? cle(kv.cle) : null;
    if (k === cle(LIGNES_D_ARME.effetEnPlus)) {
      dedans = true;
      enPlus.push(ligne.slice(ligne.indexOf(':') + 1).trimStart());
      return;
    }
    if (champs.has(k) && lu[champs.get(k)] === null) {
      lu[champs.get(k)] = kv.valeur;
      return;
    }
    if (!ligne.trim()) return;
    lu.libres.push(ligne.trim());
    enPlus.push(ligne.trim());
  });
  lu.effetEnPlus = enPlus.join('\n').trim() || null;
  return lu;
}

/**
 * Les lignes de la case de l'effet d'une arme et, pour chacune, si elle est de la part affichée (lireEffetDArme) : { lignes, affichage: [booléen],
 * retrouvee }. Une case coupée par la page dans sa part affichée perd sa fin « … » (sa ligne coupée compte pour la part affichée).
 */
function partAffichee(texte, affichees, catalogue) {
  let lignes = texte.split('\n');
  if (affichees) {
    // le bloc entier, le dernier s'il revient
    const A = affichees.split('\n');
    for (let j = lignes.length - A.length; j >= 0; j -= 1) {
      if (A.every((l, k) => lignes[j + k] === l)) return { lignes, affichage: lignes.map((_, i) => i >= j && i < j + A.length), retrouvee: true };
    }
    const montre = sansLaCoupure(texte);
    if (montre !== null) {
      // coupée dans la part affichée : la plus longue fin de la case, depuis un début de ligne, qui commence `affichees` (assez courte pour cela) ; ou
      // juste avant elle (toute la case est relue, sans son « … »)
      lignes = montre.split('\n');
      const borne = montre.length - affichees.length;
      const departs = borne <= 0 ? [0] : [];
      for (let p = montre.indexOf('\n', Math.max(0, borne - 1)); p >= 0; p = montre.indexOf('\n', p + 1)) departs.push(p + 1);
      const debut = departs.find((s) => s < montre.length && affichees.startsWith(montre.slice(s)));
      const ligneDuDebut = debut === undefined ? lignes.length : montre.slice(0, debut).split('\n').length - 1;
      return { lignes, affichage: lignes.map((_, i) => i >= ligneDuDebut), retrouvee: true };
    }
  }
  // ligne à ligne : l'effet du catalogue (ou une ligne de la part affichée attendue), « Deux armes : », « Non compté : »
  const connues = new Set([...String(catalogue ?? '').split('\n'), ...String(affichees ?? '').split('\n')].map(cle).filter(Boolean));
  const ouvrantes = [LIGNES_D_ARME.deuxArmes, LIGNES_D_ARME.nonCompte].map(cle);
  return {
    lignes,
    retrouvee: !affichees,
    affichage: lignes.map((l) => {
      const k = cle(l);
      return Boolean(k) && (connues.has(k) || ouvrantes.some((o) => k === o || k.startsWith(`${o}-`)));
    }),
  };
}

/** « (AP 3, AM 1) » d'après les valeurs écrites (une valeur absente n'est pas écrite ; rien sans valeur). */
const statsDArmure = (x) => {
  const parts = [!vide(x?.ap) ? `AP ${x.ap}` : null, !vide(x?.am) ? `AM ${x.am}` : null].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
};
/** Un nom sans les « (AP 3, AM 1) » que la page écrit après : « Cotte de maille (Fer) » garde les siennes. */
const sansStats = (t) => {
  const brut = String(t ?? '').trim();
  const m = /\((?:AP|AM)\s[^()]*\)$/i.exec(brut);
  return (m ? brut.slice(0, m.index) : brut).trim();
};
/** Une amélioration dans une ligne d'armure : « niv. 1 (+2 AP/AM) », ou « niv. 1 » sans son effet. */
const ameliorationDArmure = (a, effets) => (effets && !vide(a.effet) ? `niv. ${a.niveau} (${uneLigne(a.effet)})` : `niv. ${a.niveau}`);

/**
 * Une ligne par pièce d'armure portée (AQ21), dans l'ordre de regles.emplacements_armure : « Torse : Armure Cuir/Peau (AP 3) · amél. niv. 1 (+2 AP/AM) ·
 * élément Garde coeur (AP 7, AM 3) · amél. élément niv. 1 (+2 AP/AM) » ; l'armure complète sans son emplacement. AP et AM sont ceux de la pièce dans les
 * règles (aucun total : le site ne calcule pas l'armure portée) ; `stats` et `effets` à faux les retirent, ainsi que l'effet des améliorations, pour que
 * la case tienne (ce sont des textes du catalogue : l'import ne relit que les noms et les niveaux).
 */
export function lignesDArmure(regles, fiche, { stats = true, effets = true } = {}) {
  const portees = fiche.armures ?? [];
  return (regles.emplacements_armure ?? []).flatMap((e) => {
    const l = portees.find((x) => x.emplacement_id === e.id);
    if (!l || vide(l.armure_id)) return [];
    const armure = trouver(regles.armures ?? [], l.armure_id);
    const emplacement = e.id === ARMURE_COMPLETE ? '' : `${e.nom}${SEPARATEUR_DE_CLE}`;
    const parts = [`${emplacement}${armure?.nom ?? l.armure_id}${stats ? statsDArmure(armure) : ''}`];
    const amelioration = trouver(regles.ameliorations ?? [], l.amelioration_id);
    if (amelioration) parts.push(`${LIGNES_D_ARMURE.amelioration} ${ameliorationDArmure(amelioration, effets)}`);
    if (!vide(l.armure_elementaire_id)) {
      const element = trouver(regles.armures_elementaires ?? [], l.armure_elementaire_id);
      parts.push(`${LIGNES_D_ARMURE.element} ${element?.nom ?? l.armure_elementaire_id}${stats ? statsDArmure(element) : ''}`);
    }
    const ameliorationElement = trouver(regles.ameliorations ?? [], l.amelioration_elementaire_id);
    if (ameliorationElement) parts.push(`${LIGNES_D_ARMURE.ameliorationElement} ${ameliorationDArmure(ameliorationElement, effets)}`);
    return [parts.join(SEPARATEUR_D_ARMURE)];
  });
}

/**
 * Une ligne d'armure (AQ21) relue : { emplacement_id (ARMURE_COMPLETE sans emplacement écrit), emplacementEcrit (la ligne commence par « <Emplacement> : »),
 * armure, amelioration, element, ameliorationElement, autres } — des textes (« niv. 1 (+2 AP/AM) » : lireNiveauDAmelioration, lireEffetDAmelioration), les statistiques « (AP 3, AM 1) » retirées des noms ;
 * l'ancienne écriture aussi (« Torse : X (AP 3) · Amélioration : niv. 1 — … · Élément : Y · Amélioration de l’élément : niv. 1 — … »).
 */
export function lireLigneDArmure(regles, ligne) {
  const [premiere, ...parts] = partiesDArmure(String(ligne ?? '').trim());
  const kv = deuxPoints(premiere);
  const emplacement = kv ? (regles.emplacements_armure ?? []).find((e) => cle(e.nom) === cle(kv.cle) || e.id === cle(kv.cle)) : null;
  const lu = {
    emplacement_id: emplacement?.id ?? ARMURE_COMPLETE, emplacementEcrit: Boolean(emplacement), armure: sansStats(emplacement ? kv.valeur : premiere),
    amelioration: null, element: null, ameliorationElement: null, autres: [],
  };
  for (const part of parts) {
    let m;
    if ((m = /^am[éeÉE]l(?:ioration|\.)?\s*(?:de\s+l['’]\s*)?[éeÉE]l[éeÉE]ment\s*:?\s*(.*)$/i.exec(part))) lu.ameliorationElement ??= m[1].trim();
    else if ((m = /^am[éeÉE]l(?:ioration|\.)?\s*:?\s*(.*)$/i.exec(part))) lu.amelioration ??= m[1].trim();
    else if ((m = /^[éeÉE]l[éeÉE]ment\s*:?\s*(.*)$/i.exec(part))) lu.element ??= sansStats(m[1]);
    else lu.autres.push(part);
  }
  return lu;
}

/** Les parties d'une ligne d'armure, séparées par un « · » entre deux blancs (SEPARATEUR_D_ARMURE), sans leurs blancs de bord. */
function partiesDArmure(t) {
  const parts = [];
  let debut = 0;
  for (let i = t.indexOf('·'); i >= 0; i = t.indexOf('·', i + 1)) {
    if (i > 0 && /\s/.test(t[i - 1]) && /\s/.test(t[i + 1] ?? '')) {
      parts.push(t.slice(debut, i).trim());
      debut = i + 1;
    }
  }
  parts.push(t.slice(debut).trim());
  return parts;
}

/** L'emplacement « armure complète » (regles.emplacements_armure) : son nom seul va dans « Nom Armure » (AD22). */
export const ARMURE_COMPLETE = 'armure-complete';

// ------------------------------------------------------------------ métier

/**
 * La case du métier (L41) : { relues, affichees } — relues : les rangs à choix, « <texte> → <compétence choisie> » (« → ? » pas encore choisi) ;
 * affichées : les autres rangs, puis « Artisanat : <texte> (<carac 1> + <carac 2>) = N % » (ou « = inutilisable », décision R39). Chacune sur une ligne :
 * la case n'a qu'une rangée, l'export les joint par SEPARATEUR_EN_LIGNE.
 */
export function partiesDuMetier(regles, fiche) {
  const bm = bonusDuMetier(regles, fiche);
  const relues = bm.rangs.filter((b) => b.aChoisir)
    .map((b) => `${uneLigne(b.texte)} ${FLECHE} ${b.retenue ? nomDe(regles.competences, b.retenue.competence_id) : '?'}`.trim());
  const affichees = bm.rangs.filter((b) => !b.aChoisir).map((b) => uneLigne(b.texte)).filter(Boolean);
  const art = artisanatDe(regles, fiche);
  if (art) {
    const noms = art.caracteristiques.map((c) => c.nom);
    affichees.push(`Artisanat${SEPARATEUR_DE_CLE}${uneLigne(art.texte)}${noms.length ? ` (${noms.join(' + ')})` : ''}${art.inutilisable ? ' = inutilisable' : art.score !== null ? ` = ${art.score} %` : ''}`);
  }
  return { relues, affichees };
}

/**
 * Les rangs à choix écrits dans la case du métier : [{ texte, choix }] (« → ? » : choix null ; la fin « … » d'une case coupée juste après est retirée).
 * Les parties de la case sont séparées par SEPARATEUR_EN_LIGNE (la case n'a qu'une rangée) ou, dans une case écrite à la main, par des sauts de ligne.
 */
export function lireChoixDuMetier(texte) {
  return String(texte ?? '').split(/\r?\n| · /).filter((l) => l.includes(FLECHE)).map((l) => {
    const i = l.indexOf(FLECHE);
    const brut = l.slice(i + FLECHE.length).trim();
    const choix = (sansLaCoupure(brut) ?? brut).trim();
    return { texte: l.slice(0, i).trim(), choix: choix && choix !== '?' ? choix : null };
  });
}

// ------------------------------------------------------------------ la fiche entière

/** La fiche telle que la page la calcule : listes présentes, six caractéristiques (caracteristiquesCompletes, comme rafraichir()), maîtrises valables. */
function normaliser(regles, fiche) {
  const f = { ...fiche };
  for (const cle_ of Object.keys(PARTIES_DE_FICHE)) if (!Array.isArray(f[cle_])) f[cle_] = [];
  f.caracteristiques = caracteristiquesCompletes(regles, f);
  f.maitrises_armes = maitrisesValables(regles, f);
  return f;
}

/** Nombre de places des listes du modèle (au-delà : la note). */
const PLACES_DONS = DONS.classe1.length;
const PLACES_SORTS = ORDINATEUR.sorts.lignes.length;
const PLACES_INVENTAIRE = ORDINATEUR.inventaire.colonnes.length * ORDINATEUR.inventaire.lignes.length;
const PLACES_EVENEMENTS = DONS.evenements.length;

/**
 * Les cases du modèle ordinateur pour une fiche (format de lib/fiche-format.mjs, celle qu'envoie la page) : { cellules: { A1: texte | nombre },
 * remplis: { A1: 'RRGGBB' }, alignements: { A1: { retour?, reduire?, echelle?, vertical? } }, avertissements: [phrase] } — seulement les cases écrites
 * (une autre case garde le texte du modèle : un 0 de naturel ou d'acquis reste vide, comme dans la fiche auto) ; les nombres en nombres ; `echelle` :
 * la taille de la police d'une case réduite (lib/tableur-mesure.mjs, lib/tableur-ecriture.mjs). `date` (JJ/MM/AAAA) date la ligne d'export de la
 * note. `zones` (Map adresse → zone, lib/tableur-ecriture.mjs#zonesDuClasseur, celles du modèle) : un texte qui ne tient pas dans sa case y est coupé,
 * la suite de sa part relue seulement dans la note (reporterLesDebordements) ; sans `zones`, rien n'est coupé. Les `avertissements` disent ce qui ne
 * tient pas dans une case de tableur (32 767 caractères : notes raccourcies, texteDeLaNote) : la page les montre avec son message (messageDExport). Le
 * portrait est ajouté par la page.
 */
export function cellulesDeLaFiche(regles, fiche, { date = 'JJ/MM/AAAA', zones = null } = {}) {
  const f = normaliser(regles, fiche);
  const O = ORDINATEUR;
  const cellules = {};
  const remplis = {};
  // ce que l'import relit de chaque texte : rien (une case affichée), tout (RELUE) ou ses `lu` premiers caractères (une case relue puis affichée)
  const lus = {};
  const RELUE = Infinity;
  const ecrire = (adresse, valeur, lu = 0) => {
    if (vide(valeur) || (typeof valeur === 'number' && !Number.isFinite(valeur))) return;
    cellules[adresse] = valeur;
    if (typeof valeur === 'string' && lu > 0) lus[adresse] = Math.min(lu, valeur.length);
  };
  /** Une case relue puis affichée : ses lignes relues, puis les affichées, jointes par `separateur` ; l'import relit les premières. */
  const ecrireEnDeuxParts = (adresse, { relues, affichees }, separateur = '\n') => {
    const relu = relues.join(separateur);
    ecrire(adresse, [...relues, ...affichees].join(separateur), relu.length);
  };
  const note = [];
  const informations = [];
  const noter = (cle_, valeur) => { if (!vide(valeur)) (CLES_D_INFORMATION.includes(cle_) ? informations : note).push(ligneDeNote(cle_, valeur)); };
  /** Le texte tient-il dans sa case sans être coupé (retour à la ligne ou réduction au besoin compris) ? Toujours sans `zones`. */
  const tiendrait = (adresse, texte) => !zones?.get(adresse) || ajusterLeTexte(texte, zones.get(adresse)).texte === texte;

  // identité
  const race = trouver(regles.races, f.race_id);
  const innee = trouver(regles.magies, f.magie_innee_id);
  const acquise = trouver(regles.magies, f.magie_acquise_id);
  ecrire(O.nom, f.nom, RELUE);
  ecrire(O.surnom, f.surnom, RELUE);
  ecrire(O.lieuOrigine, f.lieu_origine, RELUE);
  ecrire(O.race, race?.nom ?? f.race_id, RELUE);
  ecrire(O.magieInnee, innee?.nom ?? f.magie_innee_id, RELUE);
  ecrire(O.magieAcquise, acquise?.nom ?? f.magie_acquise_id, RELUE);
  ecrire(O.alignement, alignementDe(regles, f).nom);
  ecrire(O.loyal, entier(f.alignement_loyal));
  ecrire(O.chaotique, entier(f.alignement_chaotique));
  ecrire(O.bon, entier(f.alignement_bon));
  ecrire(O.mauvais, entier(f.alignement_mauvais));
  // le dieu inné : les dieux de la magie innée, comme la page (construireMagies)
  if (innee) ecrire(O.dieuInne, (innee.dieux ?? []).map((d) => trouver(regles.dieux, d)?.nom ?? d).join(', '));
  ecrire(O.dieuChoisi, nomDe(regles.dieux, f.dieu_choisi_id), RELUE);
  ecrire(O.bourseP, entier(f.bourse_pp));
  ecrire(O.bourseO, entier(f.bourse_ro));
  ecrire(O.bourseF, entier(f.bourse_rf));

  // classes, niveau, XP
  const xp = progressionXp(regles, f.xp);
  ecrire(O.niveauGlobal, xp.niveau);
  ecrire(O.xp, xp.suivant === null ? xp.xp : `${xp.xp} / ${xp.suivant}`, RELUE);
  for (const c of classesDe(regles, f)) {
    if (!c.choix) continue;
    const [classe, niveau, specialite] = c.rang === 1 ? [O.classe1, O.niveau1, O.specialite1] : [O.classe2, O.niveau2, O.specialite2];
    ecrire(classe, c.classe?.nom ?? c.choix.classe_id, RELUE);
    ecrire(niveau, c.niveau);
    if (c.choix.specialite_id) ecrire(specialite, c.classe?.specialites.find((s) => s.id === c.choix.specialite_id)?.nom ?? c.choix.specialite_id, RELUE);
  }

  // attributs : valeurs du moment « valeur / max » (comme carteDeJauge), initiative et vitesses (construireAttributs)
  const attributs = attributsDe(regles, f);
  const CASES_DES_JAUGES = { sante_actuelle: O.sante, chakra_actuel: O.chakra, barriere_actuelle: O.barriere, barre4_actuelle: O.barre4, corruption: O.corruption };
  for (const j of valeursDuMoment(regles, f, attributs)) ecrire(CASES_DES_JAUGES[j.champ], `${j.hors ? f[j.champ] : j.valeur} / ${j.max}`, RELUE);
  if (attributs.quatriemeBarre) ecrire(O.libelleBarre4, attributs.quatriemeBarre.ressource);
  const a = attributs;
  const bonusDInitiative = a.initiative || a.initiativeMetier || a.initiativeAccessoires;
  ecrire(O.initiative, bonusDInitiative ? `D20${a.initiativeBonus >= 0 ? '+' : '-'}${Math.abs(a.initiativeBonus)}` : 'D20');
  ecrire(O.vitesse, a.vitesseSol);
  ecrire(O.vitesseNage, a.vitesseNage);

  // caractéristiques et compétences
  const budget = budgetCaracteristiques(regles, f);
  ecrire(O.titreCaracteristiques, `CARACTÉRISTIQUES ${budget.total}/${budget.attendu}`);
  const caracs = caracteristiquesDe(regles, f);
  for (const k of CASES_CARACTERISTIQUES) {
    const c = caracs.find((x) => x.id === k.id);
    if (!c) continue;
    ecrire(k.base, c.base);
    const bonus = c.bonus + c.accessoire;
    if (bonus) ecrire(k.bonus, bonus);
    if (c.croix >= 1) ecrire(k.croix[0], MARQUE_DE_CROIX, RELUE);
    if (c.croix >= 2) ecrire(k.croix[1], MARQUE_DE_CROIX, RELUE);
  }
  const competences = competencesDe(regles, f);
  for (const k of CASES_COMPETENCES) {
    const c = competences.find((x) => x.id === k.id);
    if (!c) continue;
    if (c.naturel) ecrire(k.naturel, c.naturel);
    const acquis = c.acquis + c.metier + c.accessoire;
    if (acquis) ecrire(k.acquis, acquis);
    ecrire(k.total, c.score === null ? 'N/A' : c.score);
  }

  // maîtrises : le 2e dé, le 3e… remplis (les « 2d », « 3d » du modèle restent écrits)
  for (const m of MAITRISES) {
    const l = f.maitrises_armes.find((x) => x.arme_famille_id === m.famille);
    if (!l) continue;
    for (const adresse of casesDesDes(m).slice(0, Math.max(0, entier(l.des) - 1))) remplis[adresse] = REMPLISSAGE_DE_ATTEINT;
  }

  // armes
  O.armes.forEach((cases, i) => {
    const rang = i + 1;
    const ligne = f.armes.find((x) => entier(x.rang) === rang);
    if (!ligne || vide(ligne.arme_id)) return;
    const arme = trouver(regles.armes, ligne.arme_id);
    ecrire(cases.nom, arme?.nom ?? ligne.arme_id, RELUE);
    const degats = degatsDArme(regles, f, rang);
    if (degats) ecrire(cases.degats, degats.texte);
    ecrireEnDeuxParts(cases.effet, partiesDeLArme(regles, f, rang));
    const porteeEnPlus = degats?.porteeEnPlus ?? 0;
    const portee = [arme?.portee ?? null, porteeEnPlus ? `${porteeEnPlus > 0 ? '+' : '-'} ${Math.abs(porteeEnPlus)}` : null].filter(Boolean).join(' ');
    ecrire(cases.portee, nombreSiEntier(portee));
    // solidité du moment et maximum (décision R74), « N / M » comme les valeurs du moment ; une arme cassée (0 / M) garde ses dégâts en AG10 : ils
    // départagent deux armes du même nom à l'import
    const solidite = durabiliteDArme(regles, f, rang);
    if (solidite) ecrire(cases.solidite, `${solidite.actuelle} / ${solidite.max}`, RELUE);
  });

  // armure de base, armure portée, bouclier
  ecrire(O.armure.apBase, a.ap);
  ecrire(O.armure.amBase, a.am);
  const complete = f.armures.find((x) => x.emplacement_id === ARMURE_COMPLETE && !vide(x.armure_id));
  const pieces = (regles.emplacements_armure ?? []).map((e) => f.armures.find((x) => x.emplacement_id === e.id && !vide(x.armure_id))).filter(Boolean);
  // « Nom Armure » : l'armure complète (relue quand AQ21 manque), sinon les pièces pour mémoire (l'import les relit dans AQ21)
  if (complete) ecrire(O.armure.nom, nomDe(regles.armures, complete.armure_id), RELUE);
  else ecrire(O.armure.nom, pieces.map((x) => nomDe(regles.armures, x.armure_id)).join(', '));
  // les pièces : avec les statistiques du catalogue et l'effet des améliorations s'ils tiennent, sinon sans
  let armure = lignesDArmure(regles, f).join('\n');
  for (const options of [{ stats: false }, { stats: false, effets: false }]) {
    if (tiendrait(O.armure.bonus, armure)) break;
    armure = lignesDArmure(regles, f, options).join('\n');
  }
  ecrire(O.armure.bonus, armure, RELUE);
  const bouclier = trouver(regles.boucliers ?? [], f.bouclier_classe_id);
  ecrire(O.bouclier.nom, bouclier?.nom ?? f.bouclier_classe_id, RELUE);
  ecrire(O.bouclier.composition, [...f.bouclier_materiaux].filter((m) => !vide(m.materiau_id)).sort((x, y) => entier(x.rang) - entier(y.rang))
    .map((m) => `${nomDe(regles.materiaux_bouclier, m.materiau_id)} ${MULTIPLICATION}${vide(m.quantite) ? 1 : entier(m.quantite)}`).join(', '), RELUE);
  if (bouclier) ecrire(O.bouclier.classe, bouclier.classe);

  // accessoires : une case par emplacement du modèle, la ceinture et « autre » dans la note
  const accessoiresSansCase = [];
  for (const [emplacement] of EMPLACEMENTS_ACCESSOIRES) {
    const x = f.accessoires.find((y) => y.emplacement === emplacement);
    if (!x) continue;
    const lignes = lignesDAccessoire(regles, x);
    if (O.accessoires[emplacement]) ecrire(O.accessoires[emplacement], lignes.join('\n'), RELUE);
    else if (lignes.length) accessoiresSansCase.push([CLES_DES_ACCESSOIRES_SANS_CASE[emplacement] ?? `Accessoire ${emplacement}`, lignes.join(SEPARATEUR_D_ACCESSOIRE)]);
  }

  // ceinture (rang 1 à 3) et inventaire (colonne par colonne)
  O.ceinture.forEach((adresse, i) => {
    const o = f.ceinture.find((x) => entier(x.rang) === i + 1);
    if (o && !vide(String(o.nom ?? '').trim())) ecrire(adresse, texteDObjet(o), RELUE);
  });
  const objets = f.inventaire.filter((o) => !vide(String(o.nom ?? '').trim()));
  const placesDInventaire = O.inventaire.colonnes.flatMap((c) => O.inventaire.lignes.map((l) => `${c}${l}`));
  objets.slice(0, PLACES_INVENTAIRE).forEach((o, i) => ecrire(placesDInventaire[i], texteDObjet(o), RELUE));
  const inventaireEnSuite = objets.slice(PLACES_INVENTAIRE).map(texteDObjet);

  // dons : de base, de race (ethnie), du métier, l'entraînement, de classe ; seuls le nom de l'ethnie, du métier et des dons de classe, les choix du
  // métier et l'entraînement sont relus (le reste : textes de règles et calculs que le site refait). Les dons de base, de race et du métier ont une
  // rangée : leurs parties sur une ligne. L'entraînement (L42, une rangée aussi) est écrit tel quel, blancs de bord retirés (l'import les retire) : sur
  // plusieurs lignes ou trop long, la case en garde le début et la suite va dans la note, que l'import recolle.
  const dr = donsDeRace(regles, f);
  if (dr.base) {
    const base = donDeBase(dr.base);
    const cases = casesDuDon(DONS.base);
    const i = String(base.texte ?? '').indexOf(' · ');
    ecrire(cases.nom, base.nom);
    ecrire(cases.type, i >= 0 ? uneLigne(base.texte.slice(0, i)) : null);
    ecrire(cases.effet, enUneLigne([i >= 0 ? base.texte.slice(i + 3) : base.texte]));
  }
  {
    const cases = casesDuDon(DONS.race);
    ecrire(cases.nom, nomDe(regles.ethnies, f.ethnie_id), RELUE);
    ecrire(cases.type, uneLigne(dr.dons[0] ? dr.dons[0].nom ?? dr.dons[0].etiquette : dr.tableau?.titre ?? null));
    ecrire(cases.effet, enUneLigne([
      ...dr.dons.map((d) => `${d.nom ?? d.etiquette}${SEPARATEUR_DE_CLE}${d.texte ?? ''}`.trim()),
      ...(dr.tableau?.cellules ?? []).map((c) => `${String(c.libelle ?? '').replace(/\n/g, ' / ')}${SEPARATEUR_DE_CLE}${c.valeur ?? ''}`),
    ]));
  }
  if (!vide(f.metier_id)) {
    const cases = casesDuDon(DONS.metier);
    ecrire(cases.nom, trouver(regles.metiers, f.metier_id)?.nom ?? f.metier_id, RELUE);
    ecrire(cases.type, 'Passif');
    ecrireEnDeuxParts(cases.effet, partiesDuMetier(regles, f), SEPARATEUR_EN_LIGNE);
  }
  // entraînement (décision R71) : le texte libre de la fiche ; le nom (« Entraînement ») et le type du modèle restent
  ecrire(casesDuDon(DONS.entrainement).effet, String(f.entrainement ?? '').trim() || null, RELUE);
  const donsEnSuite = { 1: [], 2: [] };
  for (const c of donsAcquis(regles, f)) {
    const lignes = c.rang === 1 ? DONS.classe1 : DONS.classe2;
    c.dons.forEach((d, i) => {
      if (i >= PLACES_DONS) {
        donsEnSuite[c.rang].push(d.nom);
        return;
      }
      const cases = casesDuDon(lignes[i]);
      ecrire(cases.nom, d.nom, RELUE);
      ecrire(cases.type, [TYPES_DE_DON[d.type] ?? d.type, d.precision ? `(${d.precision})` : null].filter(Boolean).join(' '));
      ecrire(cases.effet, d.effet);
    });
  }

  // événements : une ligne de `evenements` par rangée
  const evenements = String(f.evenements ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  evenements.slice(0, PLACES_EVENEMENTS).forEach((ligne, i) => {
    const { titre, texte } = decouperEvenement(ligne);
    const cases = casesDuDon(DONS.evenements[i]);
    ecrire(cases.nom, titre, RELUE);
    ecrire(cases.effet, texte, RELUE);
  });

  // sorts : titre, magies, une ligne par sort dans l'ordre de la fiche (au NM du sort, comme construireSorts) ; seuls le nom et le NM sont relus
  const emplacements = emplacementsDeSorts(regles, f);
  const nmDeLaFiche = maitriseDesSorts(regles, f);
  ecrire(O.sorts.titre, `LISTE DE SORTS — ${emplacements.total} emplacement${emplacements.total > 1 ? 's' : ''} · NPM ${npmMax(regles, f)} au plus · NM de niveau ${nmDeLaFiche.deNiveau}/${nmDeLaFiche.disponibles}`);
  if (innee) ecrire(O.sorts.magieInnee, innee.nom);
  if (acquise) ecrire(O.sorts.magieAcquise, acquise.nom);
  const acc = accessoiresDesSorts(regles, f);
  const sortsEnSuite = [];
  f.sorts.forEach((ligne, i) => {
    const sort = trouver(regles.sorts, ligne.sort_id);
    const nm = nmDuSort(ligne).total;
    if (i >= PLACES_SORTS) {
      sortsEnSuite.push(texteDeSortEnSuite(sort?.nom ?? ligne.sort_id, nm));
      return;
    }
    const r = O.sorts.lignes[i];
    const col = O.sorts.colonnes;
    ecrire(`${col.nom}${r}`, sort?.nom ?? ligne.sort_id, RELUE);
    ecrire(`${col.nm}${r}`, nm);
    if (!sort) return;
    // une rangée par sort : chaque case sur une ligne (« Amplification\n(IC) » → « Amplification (IC) ») ; la description, ses parties séparées par « · »
    const auNm = (brut, champ) => uneLigne(valeurAuNm(brut ?? null, sort.bonus ?? [], champ, nm) ?? '');
    ecrire(`${col.type}${r}`, auNm(sort.type, 'type'));
    ecrire(`${col.cout}${r}`, nombreSiEntier(auNm(sort.cout, 'cout')));
    ecrire(`${col.portee}${r}`, nombreSiEntier(auNm(sort.portee, 'portee') + (acc.portee ? ` ${signe(acc.portee)}` : '')));
    ecrire(`${col.zone}${r}`, nombreSiEntier(auNm(sort.zone, 'zone')));
    const dsb = valeurAuNm(sort.dsb ?? null, sort.bonus ?? [], 'dsb', nm) ?? '';
    const degatsEnPlus = sort.attaque && dsb ? acc.degats : 0;
    const modes = modesAuNm(sort.modes, sort.bonus ?? [], nm).filter((m) => m.atteint).map((m) => m.texte);
    ecrire(`${col.description}${r}`, enUneLigne([
      dsb + (degatsEnPlus ? ` ${signe(degatsEnPlus)}` : ''), valeurAuNm(sort.effets ?? null, sort.bonus ?? [], 'effets', nm) ?? '', ...modes,
      vide(sort.remarque) ? '' : `${ETOILE} ${sort.remarque}`,
    ]));
  });

  // résistances et faiblesses : le palier (libellé et effet de la base) et ses cibles
  const resistances = resistancesDe(regles, f);
  for (const k of CASES_RESISTANCES) {
    const p = resistances.paliers.find((x) => x.id === k.palier);
    if (!p) continue;
    ecrire(k.libelle, `${p.libelle}\n(${p.effet})`);
    ecrire(k.cibles, p.cibles.map((c) => c.nom).join(', '));
  }

  // posture du moment (relue) ; Mode Hyper (race, magie innée, magie acquise) une fois débloqué
  const posture = CASES_POSTURES.find((p) => p.id === f.posture_id);
  if (posture) ecrire(posture.titre, `${MARQUE_DE_POSTURE} ${TITRES_DES_POSTURES[posture.id]}`, RELUE);
  const hyper = modeHyperDe(regles, f);
  if (hyper?.debloque) {
    if (hyper.race) ecrire(O.modeHyper.race, `${hyper.race.nom ?? 'Race'}${SEPARATEUR_DE_CLE}${hyper.race.effet}`);
    ecrire(O.modeHyper.magieInnee, hyper.magies.find((m) => m.magie.id === f.magie_innee_id)?.effet);
    ecrire(O.modeHyper.magieAcquise, hyper.magies.find((m) => m.magie.id === f.magie_acquise_id)?.effet);
  }

  // la note : celles du joueur, puis ce que le modèle n'a pas de case pour écrire (des données du personnage, jamais un texte de règles)
  const K = CLES_DE_LA_NOTE;
  noter(K.biClasse, f.mode_classe === 'bi' ? OUI : NON);
  if (innee && !innee.caracteristique_id && f.caracteristique_magie_id) noter(K.caracteristiqueMagie, nomDe(regles.caracteristiques, f.caracteristique_magie_id));
  noter(K.gains, texteDesGains(f));
  noter(K.nmOfferts, texteDesNmOfferts(regles, f.sorts));
  for (const [cle_, valeur] of accessoiresSansCase) noter(cle_, valeur);
  noter(K.donsClasse1, donsEnSuite[1].join(SEPARATEUR_DE_LISTE));
  noter(K.donsClasse2, donsEnSuite[2].join(SEPARATEUR_DE_LISTE));
  noter(K.sorts, sortsEnSuite.join(SEPARATEUR_DE_LISTE));
  noter(K.inventaire, inventaireEnSuite.join(SEPARATEUR_DE_LISTE));
  for (const ligne of evenements.slice(PLACES_EVENEMENTS)) noter(K.evenement, ligne);
  noter(K.resistancesAuChoix, resistances.auChoix.join(', '));
  if (hyper?.cent.debloque) noter(K.modeHyperCent, MODE_HYPER_CENT_DEBLOQUE);
  noter(K.choixAFaire, choixEnAttente(regles, f).map((c) => c.libelle).join(SEPARATEUR_DE_LISTE));
  const alignements = {};
  const suites = zones ? reporterLesDebordements(cellules, lus, alignements, zones, O.note) : [];
  // ce que l'import relit (dont les suites des textes relus coupés) avant ce qui n'est qu'informatif, refait d'après les règles à chaque export
  const { texte: texteNote, avertissements } = texteDeLaNote(sansLignesVidesDeFin(f.notes ?? ''),
    [MARQUEUR_DES_NOTES, ligneDExport(date), ...note, ...suites, ...informations]);
  ecrire(O.note, texteNote);
  // une note trop longue pour sa case : alignée en haut, ses premières lignes (celles du joueur, puis ce que le modèle n'a pas de case pour écrire) restent à l'écran
  if (zones?.get(O.note) && !tientDans(cellules[O.note], zones.get(O.note))) alignements[O.note] = { vertical: 'top' };
  // une autre case plus longue que ce qu'une case de tableur garde (sans `zones`, rien n'est coupé ici) : lib/tableur-ecriture.mjs en coupera la fin
  for (const [adresse, valeur] of Object.entries(cellules)) {
    if (adresse !== O.note && typeof valeur === 'string' && valeur.length > LONGUEUR_MAX_D_UNE_CASE) {
      avertissements.push(avertissementDeCase(adresse, valeur.length - (LONGUEUR_MAX_D_UNE_CASE - 1)));
    }
  }

  return { cellules, remplis, alignements, avertissements };
}

/** Un nombre écrit à la française, par tranches de trois chiffres séparées d'une espace insécable (« 32 767 ») : messages et remarques. */
export const enChiffres = (n) => String(n).replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
/** La limite d'une case, écrite pour les messages. */
const LIMITE_ECRITE = `${enChiffres(LONGUEUR_MAX_D_UNE_CASE)} caractères`;
/** Avertissement : les notes du joueur raccourcies dans la case NOTE (texteDeLaNote). */
export const avertissementDesNotes = (n) => `Notes trop longues pour une case de tableur (${LIMITE_ECRITE}) : les ${enChiffres(n)} derniers caractères ne sont pas dans le classeur.`;
/** Avertissement : les dernières lignes de données de la case NOTE retirées (texteDeLaNote). */
export const avertissementDesDonnees = (n) => `Données de la case NOTE trop longues pour une case de tableur (${LIMITE_ECRITE}) : ${n === 1 ? 'la dernière ligne n’est pas' : `les ${enChiffres(n)} dernières lignes ne sont pas`} dans le classeur.`;
/** Avertissement : une autre case trop longue (sa fin sera coupée à l'écriture du classeur). */
export const avertissementDeCase = (adresse, n) => `Case ${adresse} trop longue pour une case de tableur (${LIMITE_ECRITE}) : ses ${enChiffres(n)} derniers caractères ne sont pas dans le classeur.`;

/**
 * Le message de la page /fiche/ après l'export en tableur (src/scripts/fiche.mjs) : « Classeur exporté. », suivi des `avertissements` de cellulesDeLaFiche
 * s'il y en a (ce que le classeur n'a pas pu garder), et alors sur le ton « attente » au lieu de « ok ». { texte, ton }.
 */
export function messageDExport(avertissements = []) {
  const liste = (avertissements ?? []).filter(Boolean);
  return liste.length ? { texte: `Classeur exporté. ${liste.join(' ')}`, ton: 'attente' } : { texte: 'Classeur exporté.', ton: 'ok' };
}

/**
 * La case NOTE : les notes du joueur (`notes`, sans leurs lignes vides de fin), une ligne vide, puis `donnees` (le marqueur et les lignes qui le suivent) ;
 * { texte, avertissements }. Au plus LONGUEUR_MAX_D_UNE_CASE caractères (ce qu'une case de tableur garde : lib/tableur-ecriture.mjs couperait la fin,
 * c'est-à-dire les données) : le marqueur et ses lignes restent toujours entiers ; les notes du joueur sont raccourcies, leur fin remplacée par « … » ; si
 * les lignes de données dépassent elles-mêmes, les dernières sont retirées (une ligne entière à la fois) et les notes aussi. Chaque perte est un
 * avertissement (une phrase pour le message de la page).
 */
export function texteDeLaNote(notes, donnees) {
  const avertissements = [];
  const limite = LONGUEUR_MAX_D_UNE_CASE;
  const lignes = [...donnees];
  let longueur = lignes.join('\n').length;
  let retirees = 0;
  // la ligne qui dit le retrait (« Lignes retirées (case NOTE pleine) : N ») a sa place réservée dès qu'il faut retirer
  const reserve = () => (retirees ? ligneDeNote(CLES_DE_LA_NOTE.lignesRetirees, String(lignes.length + retirees)).length + 1 : 0);
  while (lignes.length > 1 && longueur + reserve() > limite) {
    longueur -= lignes.pop().length + 1;
    retirees += 1;
  }
  if (retirees) lignes.push(ligneDeNote(CLES_DE_LA_NOTE.lignesRetirees, String(retirees)));
  const texteDonnees = lignes.join('\n');
  if (retirees) avertissements.push(avertissementDesDonnees(retirees));
  if (!notes.trim()) return { texte: texteDonnees, avertissements };
  // les notes, une ligne vide, puis les données : « notes\n\n<marqueur>… »
  const place = limite - texteDonnees.length - 2;
  if (notes.length <= place) return { texte: `${notes}\n\n${texteDonnees}`, avertissements };
  let garde = place - 1;
  if (garde > 0 && /[\uD800-\uDBFF]/.test(notes[garde - 1])) garde -= 1; // ne pas couper une paire de substitution
  if (garde <= 0) {
    avertissements.unshift(avertissementDesNotes(notes.length));
    return { texte: texteDonnees, avertissements };
  }
  avertissements.unshift(avertissementDesNotes(notes.length - garde));
  return { texte: `${notes.slice(0, garde)}…\n\n${texteDonnees}`, avertissements };
}

/**
 * Les textes trop longs pour leur case (`zones`), sauf la note : retour à la ligne ou réduction au besoin (`alignements`), puis, s'il le faut, la case en
 * garde le début, fini par « … » ; la part relue (`lus` : sa longueur, absente pour une case affichée) qui n'est pas montrée part dans la note, une
 * ligne « Suite de la case <adresse> : … » par case, dans l'ordre d'écriture des cases (lib/tableur-mesure.mjs#ajusterLeTexte). Rend ces lignes.
 */
function reporterLesDebordements(cellules, lus, alignements, zones, note) {
  const suites = [];
  for (const [adresse, valeur] of Object.entries(cellules)) {
    const zone = zones.get(adresse);
    if (adresse === note || typeof valeur !== 'string' || !zone) continue;
    const { texte, alignement, suite } = ajusterLeTexte(valeur, zone, { lu: lus[adresse] ?? 0 });
    cellules[adresse] = texte;
    if (alignement) alignements[adresse] = alignement;
    if (suite !== null) suites.push(ligneDeNote(`${SUITE_DE_LA_CASE} ${adresse}`, suite));
  }
  return suites;
}
