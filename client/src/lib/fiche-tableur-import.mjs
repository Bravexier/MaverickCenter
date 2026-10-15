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
//     solidité, armure de chaque pièce et du bouclier, sac de l'inventaire, bonus et malus de l'armure, case de l'entraînement du modèle ordinateur ;
//     lignes de la note en double ; image hors de A1) ; ce qui a pu se perdre avant l'import est dit dans `remarques` (case coupée par le tableur, case
//     relue finie par « … » sans sa suite) ;
//   - ce que la fiche calcule (niveaux, totaux, dégâts, AP/AM, résistances…) n'est pas relu, sauf pour retrouver un choix que le classeur n'écrit pas :
//     l'acquis du joueur (acquis écrit − bonus du métier − accessoires, competencesDe : une remarque par compétence pour un classeur qui ne vient pas de
//     la page), les gains de niveau (maximums de santé et de chakra), la compétence d'un accessoire « Compétence X » de la fiche auto (départagée par la
//     case « Entraînement », L42 : les bonus d'entraînement, guide « Fiche de personnage : Capacités/Dons »), la caractéristique du Potentiel Illimité ;
//     chaque déduction est dite dans `remarques` ;
//   - un nombre : celui qu'écrit la case quand elle montre « % » (« 20% » : 20, pas 0,2), sinon sa valeur ; décimal là où la fiche veut un entier :
//     arrondi vers le bas, et une remarque ;
//   - la case NOTE : avant le dernier MARQUEUR_DES_NOTES (des notes collées peuvent en contenir un autre), les notes du joueur ; après, les lignes
//     « Clé : valeur » que la page écrit pour ce que le modèle n'a pas de case pour écrire (lireLaNote ; une clé en double : la première, les autres dans
//     `nonRepris`) ; une ligne inconnue revient dans les notes. Un classeur qui porte le marqueur vient de la page : ce qu'elle n'y écrit pas n'existe pas
//     (pas de gains de niveau reconstitués, pas de caractéristique déduite, pas de remarque sur les acquis). Une ligne « Suite de la case A1 : … » (un
//     texte trop long pour sa case, lib/tableur-mesure.mjs) se recolle au début resté dans la case avant toute lecture ; une case réécrite depuis (son
//     texte ne finit plus par « … ») garde son texte, et la ligne revient dans les notes. Un texte affiché seulement (effets des sorts, du catalogue…)
//     coupé par la page n'a pas de suite : il ne sert qu'à départager deux homonymes, et son début coupé compte alors pour lui (ecritComme) ;
//   - les écritures de la page (lignes de la note, objets, accessoires, armure, effet d'une arme, choix du métier) se relisent par les fonctions de
//     lib/fiche-tableur-export.mjs, qui les écrit : un seul jeu de lecteurs, l'aller et le retour ne divergent pas ; seule la fiche auto a les siens.
//     Aucune expression régulière ne revient sur ses pas sur une longue suite d'espaces (pas de préfixe paresseux suivi de blancs) : une case de
//     32 767 caractères se lit en un temps proportionnel à sa longueur ;
//   - puis la même chaîne que la page (caracteristiquesCompletes, ethnieImposee, magieAcquiseValable, classesSelonLaMagieInnee, donsValables,
//     choixDeMetierValables, maitrisesValables) ; ce qu'elle retire est dit dans `nonRepris` ;
//   - les listes ont la forme qu'envoie la page (aEnvoyer de src/scripts/fiche.mjs) : compétences non nulles dans l'ordre des règles, sorts, inventaire et
//     matériaux du bouclier numérotés, ceinture à son emplacement.
// N'importe que lib/fiche-moteur.mjs, lib/fiche-format.mjs, lib/sort-maitrise.mjs et les modules du tableur (lib/fiche-tableur-cases.mjs,
// lib/fiche-tableur-export.mjs, lib/tableur-mesure.mjs) : réservé au script de la page /fiche/ (deux scripts de page n'importent jamais le même module,
// CLAUDE.md « Pièges connus » ; jamais lib/text.mjs, partagé par la recherche).

import { ajouterAuxNotes, ficheVide } from './fiche-format.mjs';
import {
  armesApresChoix, attributsDe, caracteristiquesCompletes, caracteristiquesDe, choixDeMetierValables, classesSelonLaMagieInnee, competencesDe, degatsDArme,
  donsValables, effetsDesAccessoires, EMPLACEMENTS_ACCESSOIRES, ethnieImposee, ethniesDeLaRace, famillesMaitrisables, magieAcquiseValable, maitriseDArme,
  maitrisesValables, maitriseDesSorts, niveauGlobal, progressionAttendue, refusMagieAcquise, trouver,
} from './fiche-moteur.mjs';
import { valeurAuNm } from './sort-maitrise.mjs';
import { recollerLeTexte, sansLaCoupure } from './tableur-mesure.mjs';
import {
  CASES_CARACTERISTIQUES, CASES_COMPETENCES, CASES_POSTURES, casesDesDes, casesDuDon, cle, DONS, dispositionDe, EMPLACEMENTS_DU_MODELE, lettresDeColonne,
  LONGUEUR_MAX_D_UNE_CASE, MAITRISES, MARQUEUR_DES_NOTES, ORDINATEUR, REMPLISSAGE_DE_ATTEINT, SAISIES_SANS_PLACE, TITRE_DE_L_INVENTAIRE,
} from './fiche-tableur-cases.mjs';
import {
  ARMURE_COMPLETE, NON, OUI, SEPARATEUR_D_ACCESSOIRE, SUITE_DE_LA_CASE, enChiffres, lireAccessoire, lireChoixDuMetier, lireEffetDAmelioration, lireEffetDArme,
  lireGains, lireLigneDArmure, lireLigneDeNote, lireListe, lireNiveauDAmelioration, lireNmOfferts, lireObjet, lireSortEnSuite, partiesDeLArme,
} from './fiche-tableur-export.mjs';

/** Message d'un onglet qui ne suit aucune des deux dispositions (dispositionDe). */
export const ERREUR_DISPOSITION = 'Ce classeur ne suit ni le modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » ni la fiche auto V15.2.2 (onglet « Personnage »).';

/** Remarque d'un .csv au modèle ordinateur sans marque de dé : les dés atteints s'y écrivent par la couleur des cases, qu'un .csv ne garde pas. */
export const REMARQUE_MAITRISES_CSV = 'Les maîtrises d\'armes ne se lisent pas dans un .csv (les couleurs ne s\'y gardent pas) : importez le .xlsx ou le .ods.';

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
 * { nom: [valeur] } (lignes reconnues par lireLigneDeNote : biClasse, gains, sorts…, CLES_DE_LA_NOTE ; une seule par clé, sauf les événements ;
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
    } else if (lue.nom === 'evenement') (valeurs.evenement ??= []).push(lue.valeur);
    else if (valeurs[lue.nom]) doubles.push(ligne);
    else valeurs[lue.nom] = [lue.valeur];
  }
  return { marqueur: i >= 0, notes: avant.length ? avant.join('\n') : null, valeurs, suites, autres, doubles };
}

/**
 * Les bonus d'entraînement écrits dans la case « Entraînement » (L42) de la fiche auto : « 2 Magie | 10 Concentration » ou « Concentration 10 | Magie 2 »
 * → Map competence_id → points ; null pour une case vide ou qu'on ne lit pas en entier. Guide « Fiche de personnage : Capacités/Dons » : la case note
 * « tous les bonus relatifs à l'avancée des différents entraînements » (15 compétences au plus, 10 % au plus) ; la fiche auto les compte dans l'acquis
 * qu'elle affiche. Le site ne les distingue pas des autres acquis : l'import ne s'en sert que pour départager la compétence d'un accessoire.
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
  const libelleDEmplacement = (e) => EMPLACEMENTS_ACCESSOIRES.find(([k]) => k === e)?.[1] ?? e;

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
    bouclier_classe_id: null, sante_actuelle: null, chakra_actuel: null, barriere_actuelle: null, corruption: null, barre4_actuelle: null,
    notes: null, evenements: null, posture_id: null,
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

  // ---- maîtrises d'armes
  const maitrise = maitriseDArme(regles);
  // modèle ordinateur : un dé atteint est une case remplie ou marquée ; un fond commun à toutes les cases de dés est celui du bloc (mise en forme), pas un
  // dé atteint — sauf le gris de la page (REMPLISSAGE_DE_ATTEINT : cinq dés partout)
  const casesDeDes = MAITRISES.flatMap(casesDesDes);
  const fonds = casesDeDes.map((a) => cellule(a)?.remplissage ?? null);
  const fondDuBloc = fonds[0] && fonds[0] !== REMPLISSAGE_DE_ATTEINT && fonds.every((x) => x === fonds[0]) ? fonds[0] : null;
  const atteint = (a) => (Boolean(cellule(a)?.remplissage) && cellule(a).remplissage !== fondDuBloc) || porteUneMarque(texte(a));
  for (const m of MAITRISES) {
    const famille = nomDe(regles.familles_armes, m.famille);
    let des;
    if (auto) des = entierLu(`${m.cote === 'gauche' ? d.maitrises.gauche : d.maitrises.droite}${m.ligne}`, `Maîtrise ${famille}`);
    else des = maitrise.desSansMaitrise + casesDesDes(m).filter(atteint).length;
    if (des === null || des <= maitrise.desSansMaitrise) continue;
    if (des > maitrise.desMax) perdu(`Maîtrise ${famille} : ${des} dés, ramenés à ${maitrise.desMax} (le maximum)`);
    f.maitrises_armes.push({ arme_famille_id: m.famille, des: Math.min(des, maitrise.desMax) });
  }
  if (!auto && format === 'csv' && !casesDeDes.some((a) => porteUneMarque(texte(a)))) remarques.push(REMARQUE_MAITRISES_CSV);
  const ordreDesFamilles = famillesMaitrisables(regles).map((x) => x.id);
  f.maitrises_armes.sort((a, b) => ordreDesFamilles.indexOf(a.arme_famille_id) - ordreDesFamilles.indexOf(b.arme_famille_id));

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
    // deux effets identiques comptent pour un (« Résistance Surcharge Magique ») ; d'une propriété à l'autre (« MALÉDICTION »), seulement si elle est écrite
    const contenu = (a) => JSON.stringify([propriete === null ? a.propriete : null, a.libelle, a.niveau, a.min, a.max, a.valeur, a.malediction, a.usage, a.effets]);
    return reste.length && new Set(reste.map(contenu)).size === 1 ? reste[0] : null;
  };
  const choixDAccessoire = (ligne, effet, choix, quoi) => {
    const competence = effet.effets.find((c) => c.cible === 'competence');
    if (competence) {
      const k = unSeul(retrouver(regles.competences.filter((x) => x.caracteristique_id === competence.cible_id), choix), quoi, choix,
        { ou: `parmi les compétences ${nomDe(regles.caracteristiques, competence.cible_id)}` });
      if (k) ligne.competence_id = k.id;
    } else if (effet.effets.some((c) => c.cible === 'degats_famille')) {
      const fam = unSeul(retrouver(famillesMaitrisables(regles), choix), quoi, choix, { ou: 'parmi les familles d’armes' });
      if (fam) ligne.arme_famille_id = fam.id;
    } else perdu(`${quoi} : « ${choix} » sans choix à faire pour cet effet`);
  };
  const nouvelAccessoire = (emplacement) => ({ emplacement, nom: null, accessoire_effet_id: null, valeur: null, texte: null, maudit: 0, competence_id: null, arme_famille_id: null });
  const garderAccessoire = (a) => {
    if (a.accessoire_effet_id || a.texte) f.accessoires.push(a);
    else if (a.nom) perdu(`Accessoire ${libelleDEmplacement(a.emplacement)} : « ${a.nom} » sans effet`);
  };

  /**
   * Modèle ordinateur : les lignes d'une case d'accessoire ou d'une ligne « Accessoire Ceinture : … » de la note, lues par lireAccessoire
   * (lib/fiche-tableur-export.mjs, l'écriture courte et l'ancienne).
   */
  const accessoireDesLignes = (emplacement, lignes) => {
    const a = nouvelAccessoire(emplacement);
    const quoi = `Accessoire ${libelleDEmplacement(emplacement)}`;
    const lu = lireAccessoire(regles, lignes);
    a.nom = lu.nom;
    a.texte = lu.texte || null;
    a.maudit = lu.maudit ? 1 : 0;
    const choix = lu.choix;
    if (lu.ligne !== null) {
      const effet = effetDAccessoire(lu.propriete === null ? null : proprieteDe(lu.propriete)?.[0] ?? null, lu.libelle, lu.valeur);
      if (effet) {
        a.accessoire_effet_id = effet.id;
        a.valeur = effet.min !== null ? lu.valeur : null;
      } else if (a.texte === null) {
        a.texte = lu.ligne;
        remarques.push(`${quoi} : « ${lu.ligne} » ne correspond à aucun effet de la table des accessoires : gardé en texte libre (non compté)`);
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
        a.texte = `${propriete?.[1] ?? tp}${propriete || tp ? ' : ' : ''}${te}${valeur !== null ? ` ${texte(cases.valeur)}` : ''}`;
        remarques.push(`Accessoire ${libelleDEmplacement(emplacement)} : « ${te} »${tp ? ` (${tp})` : ''} ne correspond à aucun effet de la table des accessoires : gardé en texte libre (non compté)`);
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
  f.maitrises_armes = maitrisesValables(regles, f);

  // ---- compétences : naturel et acquis écrits (entiers)
  const caseDeCompetence = new Map(CASES_COMPETENCES.map((c) => [c.id, c]));
  const ecrits = new Map(regles.competences.filter((k) => caseDeCompetence.has(k.id)).map((k) => {
    const cases = caseDeCompetence.get(k.id);
    return [k.id, { naturel: entierLu(cases.naturel, `${k.nom} (naturel)`), acquis: entierLu(cases.acquis, `${k.nom} (acquis)`) }];
  }));

  // ---- compétence d'un accessoire « Compétence X » de la fiche auto : celle de la caractéristique dont l'acquis écrit, moins le métier et les bonus
  // d'entraînement (L42), vaut la valeur tirée
  const entrainement = auto ? bonusDEntrainement(regles, texte(casesDuDon(DONS.entrainement).effet)) : null;
  if (entrainement) {
    const calcul = new Map(competencesDe(regles, f).map((k) => [k.id, k]));
    for (const a of f.accessoires) {
      const effet = trouver(regles.accessoires, a.accessoire_effet_id);
      const cible = effet?.effets?.find((c) => c.cible === 'competence');
      if (!cible || a.competence_id || a.valeur === null) continue;
      const parCompetence = regles.competences.filter((k) => k.caracteristique_id === cible.cible_id && caseDeCompetence.has(k.id)).map((k) => {
        const c = calcul.get(k.id);
        const ecrit = ecrits.get(k.id).acquis ?? 0;
        const reste = ecrit - c.metier - (entrainement.get(k.id) ?? 0);
        return { k, ecrit, metier: c.metier, entrainement: entrainement.get(k.id) ?? 0, reste, ok: reste === a.valeur || reste === Math.min(a.valeur, Math.max(0, c.plafondAcquis - c.metier)) };
      });
      const candidats = parCompetence.filter((x) => x.ok);
      if (candidats.length === 1) {
        const x = candidats[0];
        a.competence_id = x.k.id;
        const calculEcrit = [x.metier ? `métier ${x.metier}` : null, x.entrainement ? `entraînement ${x.entrainement}` : null, `accessoire ${x.reste}`].filter(Boolean).join(' + ');
        remarques.push(`Compétence de l'accessoire ${libelleDEmplacement(a.emplacement)} (${effet.libelle} ${a.valeur}) déduite : ${x.k.nom} (acquis ${x.ecrit} = ${calculEcrit})`);
      }
    }
  }

  // ---- compétences : l'acquis du joueur = l'acquis écrit moins le métier et les accessoires (que la fiche ajoute d'elle-même) ; un classeur qui ne vient
  // pas de la page le dit, compétence par compétence (ses bonus peuvent être d'anciennes valeurs) ; un acquis écrit plus petit que ces bonus, toujours
  const calcul = new Map(competencesDe(regles, f).map((k) => [k.id, k]));
  const accessoiresDe = (id) => effetsDesAccessoires(regles, f).filter((e) => e.cible === 'competence' && e.cible_id === id && !e.aChoisir && e.valeur !== null);
  for (const k of regles.competences) {
    if (!caseDeCompetence.has(k.id)) continue;
    const naturel = Math.max(0, ecrits.get(k.id).naturel ?? 0);
    const ecrit = ecrits.get(k.id).acquis ?? 0;
    const c = calcul.get(k.id);
    const plus = c.metier + c.accessoire;
    let acquis = ecrit - plus;
    if (plus) {
      const termes = [];
      const terme = (v, quoi) => termes.push(` ${v >= 0 ? '−' : '+'} ${Math.abs(v)} ${quoi}`);
      if (c.metier) terme(c.metier, `du métier ${nomDe(regles.metiers, f.metier_id)} (base)`);
      if (c.accessoire) {
        const emplacements = [...new Set(accessoiresDe(k.id).map((e) => libelleDEmplacement(e.emplacement)))];
        terme(c.accessoire, `${emplacements.length > 1 ? 'des accessoires' : 'de l\'accessoire'} ${emplacements.join(', ')}`);
      }
      const debut = `${k.nom} : acquis ${ecrit} du classeur${termes.join('')}`;
      if (acquis < 0) remarques.push(`${debut} : moins que ces bonus, 0 au joueur`);
      else if (!deLaPage) remarques.push(`${debut} = ${acquis} au joueur`);
    }
    acquis = Math.max(0, acquis);
    if (naturel || acquis) f.competences.push({ competence_id: k.id, naturel, acquis });
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
    const auNm = (s, ch) => (s[ch] ? valeurAuNm(s[ch], s.bonus ?? [], ch, Math.min(3, Math.max(0, nm))) : '');
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
    f.sorts.push({ sort_id: sort.id, rang: f.sorts.length + 1, niveau_maitrise: Math.max(0, nm), nm_livre: 0, nm_cadeau: 0 });
  };
  for (const l of d.sorts.lignes) {
    const nom = texte(`${colonnes.nom}${l}`);
    if (nom) ajouterSort(nom, entierLu(`${colonnes.nm}${l}`, `Sort « ${nom} » (NM)`) ?? 0, l);
  }
  for (const v of notee('sorts')) {
    for (const { nom, nm } of lireListe(v).map(lireSortEnSuite)) ajouterSort(nom, nm ?? 0, null);
  }
  for (const v of notee('nmOfferts')) {
    const offerts = lireNmOfferts(v);
    if (!offerts) {
      perdu(`NM offerts : « ${v} » illisible`);
      continue;
    }
    for (const o of offerts) {
      const lignes = f.sorts.filter((s) => cle(nomDe(regles.sorts, s.sort_id)) === cle(o.nom) || segment(s.sort_id) === cle(o.nom));
      if (lignes.length !== 1 || o.livre > 1 || o.livre + o.cadeau > lignes[0].niveau_maitrise) {
        perdu(`NM offerts : « ${o.nom} » (livre ${o.livre}, MJ ${o.cadeau}) ${lignes.length !== 1 ? 'ne désigne pas un sort de la liste' : 'dépasse les NM du sort'}`);
        continue;
      }
      lignes[0].nm_livre = o.livre;
      lignes[0].nm_cadeau = o.cadeau;
    }
  }
  if (auto) {
    const nm = maitriseDesSorts(regles, f);
    if (nm.deNiveau > nm.disponibles) {
      remarques.push(`NM des sorts : les ${nm.total} NM du classeur sont comptés comme NM de niveau (${nm.disponibles} disponibles) ; le classeur ne dit pas lesquels viennent d'un livre ou du MJ`);
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
    if (!nom) continue;
    const effet = texteBrut(cellule(cases.effet));
    const lue = auto ? null : lireEffetDArme(effet);
    const composition = auto ? texte(cases.composition) : lue.composition;
    const degatsEcrits = texte(cases.degats);
    // ce qui va avec l'arme, lu avant elle : ses dégâts départagent deux armes du même nom
    const ligne = { rang, arme_id: null, materiau_id: null, amelioration_id: null, arme_elementaire_id: null, amelioration_elementaire_id: null, effet_en_plus: null };
    if (composition) ligne.materiau_id = unSeul(retrouver(regles.materiaux_armes, composition), `${quoi}, composition`, composition)?.id ?? null;
    ligne.amelioration_id = amelioration(auto ? texte(cases.amelioration) : lue.amelioration, 'arme', `${quoi}, amélioration`);
    const element = auto ? texte(cases.element) : lue.element;
    if (element) ligne.arme_elementaire_id = unSeul(retrouver(regles.armes_elementaires, element, { autres: () => [] }), `${quoi}, élément`, element)?.id ?? null;
    if (!auto) ligne.amelioration_elementaire_id = amelioration(lue.ameliorationElement, 'arme_elementaire', `${quoi}, amélioration de l’élément`);
    const avecLArme = (armeId) => (composition ? [...f.armes.filter((x) => x.rang !== rang), { ...ligne, arme_id: armeId }].sort((a, b) => a.rang - b.rang)
      // une composition absente : le fer (décision R49, armesApresChoix) ; écrite mais introuvable : rien
      : armesApresChoix(regles, { ...f, armes: [...f.armes.filter((x) => x.rang !== rang), ligne] }, rang, armeId));
    const departager = (candidats) => {
      // homonymes d'une famille à l'autre (« Étendard de guerre », « Crochet grappin ») : l'effet du catalogue écrit (son début, dans une case coupée
      // par la page), puis les dégâts écrits
      const ecrites = lignesDe(effet);
      const parEffet = candidats.filter((a) => a.effet && ecrites.some((l, k) => (k === ecrites.length - 1 ? ecritComme(l, lignesDe(a.effet)[0]) : cle(l) === cle(lignesDe(a.effet)[0]))));
      if (parEffet.length === 1) return parEffet;
      return (parEffet.length ? parEffet : candidats)
        .filter((a) => degatsEcrits && ecritComme(degatsEcrits, degatsDArme(regles, { ...f, armes: avecLArme(a.id) }, rang)?.texte));
    };
    const arme = unSeul(retrouver(regles.armes, nom), quoi, nom, {
      departager, nom: (a) => `${a.nom} (${nomDe(regles.familles_armes, a.famille_id)})`, precisions: [composition, degatsEcrits].filter(Boolean).join(', '),
    });
    if (!arme) continue;
    if (!auto) effetsEnPlus.push({ rang, effet, arme, entier: recollees.has(cases.effet) });
    f.armes = avecLArme(arme.id);
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
  const ajouterArmure = (emplacementId, nomArmure, quoi) => {
    const armure = unSeul(retrouver(regles.armures, nomArmure), quoi, nomArmure);
    if (!armure) return null;
    const ligne = { emplacement_id: emplacementId, armure_id: armure.id, amelioration_id: null, armure_elementaire_id: null, amelioration_elementaire_id: null };
    f.armures = [...f.armures.filter((x) => x.emplacement_id !== emplacementId), ligne];
    return { ligne, armure };
  };
  if (auto) {
    const nomArmure = texte(d.armure.nom);
    const lue = nomArmure ? ajouterArmure(ARMURE_COMPLETE, nomArmure, 'Armure') : null;
    if (lue) {
      lue.ligne.amelioration_id = amelioration(texte(d.armure.amelioration), 'armure', `Armure (${lue.armure.nom}), amélioration`);
      if (texte(d.armure.element)) lue.ligne.armure_elementaire_id = armureElementaire(texte(d.armure.element), lue.armure, `Armure (${lue.armure.nom}), élément`);
      lue.ligne.amelioration_elementaire_id = amelioration(texte(d.armure.ameliorationElement), 'armure_elementaire', `Armure (${lue.armure.nom}), amélioration de l’élément`);
    }
  } else {
    // « Bonus/ Malus » (AQ21) : une pièce par ligne qui commence par un emplacement ou nomme une armure (lib/fiche-tableur-export.mjs#lireLigneDArmure) ;
    // une autre ligne n'a pas de place sur le site. « Nom Armure » (AD22) : l'armure complète quand aucune ligne n'est une pièce, sinon comparé aux pièces
    let pieces = 0;
    for (const l of lignesDe(texte(d.armure.bonus))) {
      const lu = lireLigneDArmure(regles, l);
      if (!lu.emplacementEcrit && !retrouver(regles.armures, lu.armure).length) {
        perdu(`Bonus/Malus de l'armure : « ${l} » sans place sur le site`);
        continue;
      }
      pieces += 1;
      const emplacement = trouver(regles.emplacements_armure, lu.emplacement_id);
      const lue = ajouterArmure(lu.emplacement_id, lu.armure, `Armure (${emplacement?.nom ?? lu.emplacement_id})`);
      if (!lue) continue;
      const quoi = `Armure (${emplacement?.nom ?? lu.emplacement_id} : ${lue.armure.nom})`;
      lue.ligne.amelioration_id = amelioration(lu.amelioration, 'armure', `${quoi}, amélioration`);
      if (lu.element) lue.ligne.armure_elementaire_id = armureElementaire(lu.element, lue.armure, `${quoi}, élément`);
      lue.ligne.amelioration_elementaire_id = amelioration(lu.ameliorationElement, 'armure_elementaire', `${quoi}, amélioration de l’élément`);
      for (const partie of lu.autres) perdu(`${quoi} : « ${partie} » sans place sur la fiche`);
    }
    const nomAD22 = texte(d.armure.nom);
    if (!pieces && nomAD22) ajouterArmure(ARMURE_COMPLETE, nomAD22, 'Armure');
    else if (nomAD22 && f.armures.length && !nommeLesPieces(regles, nomAD22, f.armures)) {
      const lues = regles.emplacements_armure.map((e) => f.armures.find((x) => x.emplacement_id === e.id)).filter(Boolean).map((x) => nomDe(regles.armures, x.armure_id));
      remarques.push(`Armure : « ${nomAD22} » (Nom Armure) ne correspond pas aux pièces de la case Bonus/Malus (${lues.join(', ')}) : les pièces sont reprises`);
    }
  }
  const ordreDesEmplacements = regles.emplacements_armure.map((e) => e.id);
  f.armures.sort((a, b) => ordreDesEmplacements.indexOf(a.emplacement_id) - ordreDesEmplacements.indexOf(b.emplacement_id));

  // ---- bouclier
  if (texte(d.bouclier.nom)) f.bouclier_classe_id = unSeul(retrouver(regles.boucliers, texte(d.bouclier.nom)), 'Bouclier', texte(d.bouclier.nom))?.id ?? null;
  const materiaux = auto
    ? d.bouclier.materiaux.map((m) => (texte(m.materiau) ? { nom: texte(m.materiau), quantite: entierLu(m.quantite, `Bouclier, quantité de « ${texte(m.materiau)} »`) ?? 1 } : null)).filter(Boolean)
    : texte(d.bouclier.composition).split(',').map(lireObjet).filter(Boolean);
  for (const m of materiaux) {
    const materiau = unSeul(retrouver(regles.materiaux_bouclier, m.nom), 'Bouclier, matériau', m.nom);
    if (!materiau) continue;
    if (m.quantite < 1) perdu(`Bouclier, matériau : « ${m.nom} » en quantité ${m.quantite}`);
    else f.bouclier_materiaux.push({ rang: f.bouclier_materiaux.length + 1, materiau_id: materiau.id, quantite: m.quantite });
  }

  // ---- zones de saisie que le site ne garde pas (modèle ordinateur) : leur valeur dans les notes
  if (!auto) {
    const valeurs = { ap: 'AP', am: 'AM', solidite: 'solidité' };
    for (const s of SAISIES_SANS_PLACE) {
      const t = texte(s.adresse);
      if (!t || t === s.modele) continue;
      const quoi = s.quoi ?? `Armure, ${nomDe(regles.emplacements_armure, s.emplacement)} (${valeurs[s.valeur]})`;
      perdu(`${quoi} : « ${t} » sans place sur le site`);
    }
    const titre = texte(d.inventaire.titre);
    if (titre && cle(titre) !== cle(TITRE_DE_L_INVENTAIRE)) {
      const sac = cle(titre).startsWith(cle(TITRE_DE_L_INVENTAIRE)) && titre.includes('=') ? titre.slice(titre.indexOf('=') + 1).trim() : titre;
      if (sac) perdu(`Inventaire, sac : « ${sac} » sans place sur le site`);
    }
    const ecritEntrainement = texte(casesDuDon(DONS.entrainement).effet);
    if (ecritEntrainement) perdu(`Entraînement : « ${ecritEntrainement} » sans place sur le site`);
  }

  // ---- ceinture et inventaire (ressource_id : la ressource de ce nom exact, comme la page)
  const ressource = (nom) => (regles.ressources ?? []).find((r) => r.nom === nom)?.id ?? null;
  const objetAuto = (aNom, aQuantite) => {
    const nom = texte(aNom);
    return nom ? { nom, quantite: entierLu(aQuantite, `Quantité de « ${nom} »`) ?? 1 } : null;
  };
  const ranger = (liste, objet, quoi, rang) => {
    if (!objet) return;
    if (objet.quantite < 1) perdu(`${quoi} : « ${objet.nom} » en quantité ${objet.quantite}`);
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
  for (const [champ, valeur, max] of jauges) f[champ] = valeur === null || valeur === max ? null : Math.max(0, valeur);
  const corruption = auto ? entierLu(d.corruption, QUOI_DES_JAUGES.corruption) : paireLue(d.corruption, 'corruption')[0];
  f.corruption = corruption ? Math.max(0, corruption) : null;
  if (!auto) {
    const marquees = CASES_POSTURES.filter((p) => porteUneMarque(texte(p.titre)));
    if (marquees.length === 1) f.posture_id = marquees[0].id;
    else if (marquees.length > 1) perdu(`Posture du moment : plusieurs postures marquées (${marquees.map((p) => texte(p.titre)).join(', ')})`);
  } else if (estCoche(cellule(d.ambidextrie))) {
    perdu('Ambidextrie : cochée dans le classeur ; la fiche calcule l’attaque à deux armes d’après les armes portées (décision R46)');
  }

  // ---- gains de niveau : la ligne de la note ; sinon reconstitués d'après les maximums de santé et de chakra du classeur
  const gainsEcrits = notee('gains')[0];
  if (gainsEcrits !== undefined) {
    const lus = lireGains(gainsEcrits);
    if (lus) f.progression = lus;
    else perdu(`Gains de niveau : « ${gainsEcrits} » illisibles`);
  } else if (!deLaPage) {
    // les maximums lus : fiche auto, leurs cases (F14, M14) ; modèle ordinateur, le « b » de « a / b »
    const [maxSante, maxChakra] = [jauges[0][2], jauges[1][2]];
    if (maxSante !== null && maxChakra !== null) {
      const lus = `(santé ${maxSante}, chakra ${maxChakra})`;
      const illisible = progressionAttendue(regles, niveauGlobal(regles, f.xp)).find((n) => n.de && !bornesDuDe(n.de));
      if (illisible) {
        remarques.push(`Gains de niveau non reconstitués : le dé du niveau ${illisible.niveau} (« ${illisible.de} ») ne se lit pas ; maximums du classeur ${lus} : à saisir`);
      } else {
        const reconstitues = gainsReconstitues(regles, f, maxSante, maxChakra);
        if (reconstitues === null) remarques.push(`Gains de niveau non reconstitués : les maximums du classeur ${lus} ne s'expliquent pas par les points et les dés des niveaux ; à saisir`);
        else if (reconstitues.length) {
          f.progression = reconstitues;
          remarques.push(`Gains de niveau reconstitués d'après les maximums du classeur ${lus} : à vérifier`);
        }
      }
    }
  }

  // ---- effet en plus des armes (modèle ordinateur) : les lignes du joueur, sans la part affichée de la fiche relue (lireEffetDArme) ; celles écrites sans
  // « Effet en plus : » sont dites dans un classeur qui ne vient pas de la page
  for (const { rang, effet, arme, entier } of effetsEnPlus) {
    const ligne = f.armes.find((x) => x.rang === rang);
    if (!ligne) continue;
    const lue = lireEffetDArme(effet, { affichees: partiesDeLArme(regles, f, rang).affichees.join('\n'), catalogue: arme.effet, entier });
    ligne.effet_en_plus = lue.effetEnPlus;
    // (dans un classeur de la page aussi quand la case ne porte plus ce que le site y écrit : l'effet du catalogue a pu changer depuis l'export)
    if (lue.libres.length && (!deLaPage || !lue.affichageRetrouve)) {
      const s = lue.libres.length > 1 ? 's' : '';
      const pourquoi = deLaPage ? ' (la case ne porte plus ce que le site y écrit pour cette arme)' : '';
      remarques.push(`Arme ${rang} (${arme.nom}) : ligne${s} ${lue.libres.map((l) => `« ${l} »`).join(', ')} reprise${s} comme effet en plus${pourquoi}`);
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
 * Ce que peut donner le dé d'un niveau (niveau_global.de_attributs_bonus, « 1d8 santé OU 1d8 chakra OU 1d4 pour les deux ») : { min, max } d'après les dés
 * qu'il écrit (« NdF » : de N à N × F ; le plus grand dé écrit pour le maximum) ; null quand il n'en écrit aucun.
 */
export function bornesDuDe(texte) {
  const des = [...String(texte ?? '').matchAll(/\b(\d*)[dD](\d+)\b/g)].map((m) => ({ n: Number(m[1] || 1), faces: Number(m[2]) })).filter((x) => x.n >= 1 && x.faces >= 1);
  if (!des.length) return null;
  return { min: Math.min(...des.map((x) => x.n)), max: Math.max(...des.map((x) => x.n * x.faces)) };
}

/**
 * Les gains de niveau (personnage_progression) qu'il faut pour atteindre les maximums de santé et de chakra lus dans le classeur, la fiche n'en ayant pas :
 * gains = maximum − attributsDe de la fiche sans progression ; P = les points des niveaux atteints (progressionAttendue : 15 chacun, santé + chakra), D = les
 * niveaux à dé ; les dés font T = gains de santé + gains de chakra − P. Possible si les deux gains sont positifs et que T va avec D (aucun dé : T = 0 ;
 * sinon entre la somme des plus petits résultats et celle des plus grands, bornesDuDe du texte de chaque niveau) : les dés au plus près de l'égalité (un
 * point à la fois, à tour de rôle), sur le chakra tant qu'ils y tiennent puis sur la santé ; les points de chaque niveau sur la santé jusqu'à épuisement,
 * puis sur le chakra. null quand c'est impossible, ou qu'un dé ne se lit pas ; [] quand il n'y a rien à répartir.
 */
export function gainsReconstitues(regles, fiche, maxSante, maxChakra) {
  const sans = attributsDe(regles, { ...fiche, progression: [] });
  const gainsSante = maxSante - sans.sante;
  const gainsChakra = maxChakra - sans.chakra;
  const attendue = progressionAttendue(regles, niveauGlobal(regles, fiche.xp));
  const points = attendue.reduce((s, n) => s + n.points, 0);
  const aDe = attendue.filter((n) => n.de).map((n) => ({ niveau: n.niveau, bornes: bornesDuDe(n.de) }));
  if (aDe.some((n) => !n.bornes)) return null;
  const total = gainsSante + gainsChakra - points;
  if (gainsSante < 0 || gainsChakra < 0) return null;
  const minimum = aDe.reduce((s, n) => s + n.bornes.min, 0);
  const maximum = aDe.reduce((s, n) => s + n.bornes.max, 0);
  if (aDe.length ? total < minimum || total > maximum : total !== 0) return null;
  if (!attendue.length) return [];
  const des = aDe.map((n) => ({ niveau: n.niveau, valeur: n.bornes.min, max: n.bornes.max, sur: null }));
  for (let reste = total - minimum; reste > 0;) {
    for (const de of des) {
      if (reste > 0 && de.valeur < de.max) {
        de.valeur += 1;
        reste -= 1;
      }
    }
  }
  let surChakra = 0;
  for (const de of des) {
    if (surChakra + de.valeur <= gainsChakra) {
      de.sur = 'chakra';
      surChakra += de.valeur;
    } else de.sur = 'sante';
  }
  const surSante = total - surChakra;
  if (surSante > gainsSante) return null;
  let resteSante = gainsSante - surSante;
  return attendue.map((n) => {
    const sante = Math.min(n.points, resteSante);
    resteSante -= sante;
    const de = des.find((x) => x.niveau === n.niveau);
    return { niveau: n.niveau, points_sante: sante, points_chakra: n.points - sante, de_choix: de?.sur ?? null, de_resultat: de?.valeur ?? null };
  });
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
