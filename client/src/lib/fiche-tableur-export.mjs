// Export de la fiche de personnage en tableur (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et exportée à
// tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle […] Inutile de mettre les formules dans le fichier généré, seul le
// résultat […] Toute info supplémentaire peut être notée dans les « Notes » ») : les cases du modèle « Fiche-de-personnage-Maverick-V15.2.2
// ordinateur » (lib/fiche-tableur-cases.mjs#ORDINATEUR) remplies des valeurs que la page /fiche/ affiche, calculées par les mêmes appels au moteur
// (lib/fiche-moteur.mjs, lib/sort-maitrise.mjs) — jamais une règle de plus : une case que le site ne calcule pas (AP/AM d'une pièce d'armure ou du
// bouclier, solidité) reste telle que dans le modèle. Ce qui n'a pas de case (bi-classe, gains de niveau, NM offerts, accessoires de ceinture,
// débordements des listes…) va dans la case NOTE, sous MARQUEUR_DES_NOTES, en lignes « Clé : valeur » que l'import relit (lib/fiche-tableur-import.mjs) :
// leur mise en forme et leur lecture sont ici (CLES_DE_LA_NOTE, texteDesGains / lireGains…), pour que l'aller et le retour ne divergent pas.
// Un texte trop long pour sa case (`zones` : la taille des cases du modèle, lib/tableur-ecriture.mjs#zonesDuClasseur) n'y est pas rogné : une case de
// plusieurs rangées prend le retour à la ligne, une case d'une rangée rapetisse un peu son texte (`alignements`), puis la case garde ce qui tient, fini
// par « … », et la suite va dans la note (« Suite de la case AM55 : … », lib/tableur-mesure.mjs#ajusterLeTexte), que l'import recolle ; la note qui
// déborde elle-même s'aligne en haut (son début reste lisible).
// Pur et sans DOM : seul src/scripts/fiche.mjs l'importe (il y ajoute le portrait, lib/tableur-ecriture.mjs écrit le classeur). Il n'importe que des
// modules que seule la page /fiche/ utilise (CLAUDE.md, « Pièges connus » : la version portable refuse un module partagé entre deux scripts de page) ;
// pas lib/text.mjs (partagé par la recherche) : cle() de lib/fiche-tableur-cases.mjs.
import { RAISONS } from './degats-texte.mjs';
import { PARTIES_DE_FICHE } from './fiche-format.mjs';
import {
  EMPLACEMENTS_ACCESSOIRES, accessoiresDesSorts, alignementDe, artisanatDe, attaqueADeuxArmes, attributsDe, bonusDuMetier, budgetCaracteristiques,
  caracteristiquesCompletes, caracteristiquesDe, choixEnAttente, classesDe, competencesDe, degatsDArme, donDeBase, donsAcquis, donsDeRace,
  emplacementsDeSorts, maitriseDesSorts, maitrisesValables, modeHyperDe, nmDuSort, npmMax, progressionXp, resistancesDe, trouver, valeursDuMoment,
} from './fiche-moteur.mjs';
import {
  CASES_CARACTERISTIQUES, CASES_COMPETENCES, CASES_POSTURES, CASES_RESISTANCES, DONS, EMPLACEMENTS_DU_MODELE, MAITRISES, MARQUEUR_DES_NOTES, ORDINATEUR,
  REMPLISSAGE_DE_ATTEINT, casesDesDes, casesDuDon, cle,
} from './fiche-tableur-cases.mjs';
import { modesAuNm, valeurAuNm } from './sort-maitrise.mjs';
import { ajusterLeTexte, tientDans } from './tableur-mesure.mjs';

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
});

/** Début de la ligne de la note qui porte la suite d'un texte coupé : « Suite de la case AM55 : <suite> » (le début est dans la case, fini par « … »). */
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

/** Préfixes des lignes d'une arme (AA13, AN13) que l'import relit ; les autres (effet du catalogue, deux armes, non comptés) ne sont que lus. */
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

/** Libellé du dé d'un gain de niveau (personnage_progression.de_choix) dans la note. */
export const DES_DES_GAINS = Object.freeze({ sante: 'santé', chakra: 'chakra', les_deux: 'les deux' });

// ------------------------------------------------------------------ outils

const entier = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const signe = (n) => (n > 0 ? `+${n}` : String(n));
const vide = (v) => v === null || v === undefined || v === '';
/** Un texte sur une seule ligne (dans une ligne d'une case à plusieurs lignes que l'import découpe). */
const uneLigne = (t) => String(t ?? '').replace(/\s*\r?\n\s*/g, ' ').trim();
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
  return n === 1 && lireObjet(brut).nom === brut ? brut : `${brut} ${MULTIPLICATION}${n}`;
}

/** { nom, quantite } d'un objet écrit « Nom ×N » (aussi « Nom x N », « Nom (xN) », « Nom (N) » en fin) ; sans quantité écrite, 1. */
export function lireObjet(texte) {
  const brut = String(texte ?? '').trim();
  for (const forme of [/^(.*?)\s*×\s*(\d+)$/, /^(.*?)\s+x\s*(\d+)$/i, /^(.*?)\s*\(\s*[x×]?\s*(\d+)\s*\)$/i]) {
    const m = forme.exec(brut);
    if (m && m[1].trim()) return { nom: m[1].trim(), quantite: Number(m[2]) };
  }
  return { nom: brut, quantite: 1 };
}

/** Les gains de niveau (personnage_progression), par niveau : « niv. 2 : santé 10, chakra 5 ; niv. 5 : santé 5, chakra 10, dé chakra 6 ». */
export function texteDesGains(progression) {
  return [...(progression ?? [])].sort((a, b) => entier(a.niveau) - entier(b.niveau)).map((p) => {
    const parts = [`santé ${entier(p.points_sante)}`, `chakra ${entier(p.points_chakra)}`];
    if (p.de_choix) parts.push(`dé ${DES_DES_GAINS[p.de_choix] ?? p.de_choix}${vide(p.de_resultat) ? '' : ` ${entier(p.de_resultat)}`}`);
    return `niv. ${entier(p.niveau)}${SEPARATEUR_DE_CLE}${parts.join(', ')}`;
  }).join(SEPARATEUR_DE_LISTE);
}

/** Les lignes de personnage_progression d'un texte de texteDesGains ; un niveau illisible est sauté. */
export function lireGains(texte) {
  const choix = new Map(Object.entries(DES_DES_GAINS).map(([id, libelle]) => [cle(libelle), id]));
  const lignes = [];
  for (const morceau of lireListe(texte)) {
    const m = /^niv\.?\s*(\d+)\s*:\s*(.*)$/i.exec(morceau);
    if (!m) continue;
    const p = { niveau: Number(m[1]), points_sante: 0, points_chakra: 0, de_choix: null, de_resultat: null };
    for (const part of m[2].split(',').map((x) => x.trim())) {
      const de = /^d[ée]\s+(.+?)(?:\s+(-?\d+))?$/i.exec(part);
      if (de) {
        p.de_choix = choix.get(cle(de[1])) ?? null;
        p.de_resultat = p.de_choix && de[2] !== undefined ? Number(de[2]) : null;
        continue;
      }
      const point = /^(sant[ée]|chakra)\s+(-?\d+)$/i.exec(part);
      if (point) p[cle(point[1]) === 'sante' ? 'points_sante' : 'points_chakra'] = Number(point[2]);
    }
    lignes.push(p);
  }
  return lignes;
}

/** Les NM offerts (livre, MJ) des sorts de la fiche : « Boule de feu (livre 1, MJ 2) ; Brasier (MJ 1) » ; vide quand aucun. */
export function texteDesNmOfferts(regles, sorts) {
  return (sorts ?? []).map((ligne) => {
    const nm = nmDuSort(ligne);
    const parts = [nm.livre ? `livre ${nm.livre}` : null, nm.cadeau ? `MJ ${nm.cadeau}` : null].filter(Boolean);
    return parts.length ? `${nomDe(regles.sorts, ligne.sort_id)} (${parts.join(', ')})` : null;
  }).filter(Boolean).join(SEPARATEUR_DE_LISTE);
}

/** [{ nom, livre, cadeau }] d'un texte de texteDesNmOfferts. */
export function lireNmOfferts(texte) {
  return lireListe(texte).map((morceau) => {
    const m = /^(.*)\(([^()]*)\)$/.exec(morceau);
    if (!m) return null;
    const nombre = (mot) => Number(new RegExp(`${mot}\\s+(\\d+)`, 'i').exec(m[2])?.[1] ?? 0);
    return { nom: m[1].trim(), livre: nombre('livre'), cadeau: nombre('MJ') };
  }).filter((x) => x && x.nom);
}

/** Un sort au-delà des 20 lignes : « Boule de feu (NM 2) ». */
export const texteDeSortEnSuite = (nom, nm) => `${nom} (NM ${nm})`;

/** { nom, nm } d'un texte de texteDeSortEnSuite (nm null s'il n'est pas écrit). */
export function lireSortEnSuite(texte) {
  const m = /^(.*?)\s*\(\s*NM\s*(\d+)\s*\)$/i.exec(String(texte ?? '').trim());
  return m ? { nom: m[1], nm: Number(m[2]) } : { nom: String(texte ?? '').trim(), nm: null };
}

/** Une amélioration dans une ligne d'arme ou d'armure : « niv. 2 — +4 dégâts ». */
export const texteDAmelioration = (a) => (vide(a.effet) ? `niv. ${a.niveau}` : `niv. ${a.niveau} — ${uneLigne(a.effet)}`);

/** Le niveau écrit d'une amélioration (« niv. 2 — … » → 2), ou null. */
export function lireNiveauDAmelioration(texte) {
  const m = /niv\.?\s*(\d+)/i.exec(String(texte ?? ''));
  return m ? Number(m[1]) : null;
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

/**
 * Les lignes d'un accessoire porté (cases AD29… ; note pour la ceinture et « autre ») : son nom s'il en a un ; « <propriété> : <libellé>[ = valeur] »
 * (la valeur seulement pour un effet à fourchette) ; « Effet : <texte> » pour l'effet hors table ; « → <compétence ou famille choisie> » ; « Maudit ».
 * Le nom et le texte libre sur une ligne (l'import découpe la case par lignes).
 */
export function lignesDAccessoire(regles, a) {
  const lignes = [];
  if (!vide(a.nom)) lignes.push(uneLigne(a.nom));
  const effet = trouver(regles.accessoires ?? [], a.accessoire_effet_id);
  if (effet) {
    const valeur = effet.min !== null && effet.min !== undefined && !vide(a.valeur) ? ` = ${entier(a.valeur)}` : '';
    lignes.push(`${effet.propriete_nom ?? effet.propriete}${SEPARATEUR_DE_CLE}${effet.libelle ?? ''}`.trim() + valeur);
  }
  if (!vide(a.texte)) lignes.push(`${EFFET_LIBRE}${SEPARATEUR_DE_CLE}${uneLigne(a.texte)}`);
  const choix = (a.competence_id && nomDe(regles.competences, a.competence_id)) || (a.arme_famille_id && nomDe(regles.familles_armes, a.arme_famille_id));
  if (choix) lignes.push(`${FLECHE} ${choix}`);
  if (a.maudit && entier(a.maudit) !== 0) lignes.push(MAUDIT);
  return lignes;
}

/**
 * Les lignes d'un accessoire rangées : { nom, propriete, libelle, valeur, texte, choix, maudit } (des textes ; l'effet se retrouve dans les règles à
 * l'import). `lignes` : le texte d'une case (une ligne par ligne), ou la liste des lignes (pour la note : sa valeur découpée par
 * SEPARATEUR_D_ACCESSOIRE). Une ligne « X : Y » n'est une propriété que si X en est une (regles.accessoires[].propriete_nom) ; la première autre ligne
 * est le nom.
 */
export function lireAccessoire(regles, lignes) {
  const proprietes = new Map((regles.accessoires ?? []).map((e) => [cle(e.propriete_nom ?? e.propriete), e.propriete_nom ?? e.propriete]));
  const brut = Array.isArray(lignes) ? lignes : String(lignes ?? '').split(/\r?\n/);
  const lu = { nom: null, propriete: null, libelle: null, valeur: null, texte: null, choix: null, maudit: false };
  for (const ligne of brut.map((x) => String(x).trim()).filter(Boolean)) {
    const deux = /^([^:]+?)\s*:\s*(.*)$/.exec(ligne);
    if (cle(ligne) === cle(MAUDIT)) lu.maudit = true;
    else if (ligne.startsWith(FLECHE)) lu.choix = ligne.slice(FLECHE.length).trim();
    else if (deux && cle(deux[1]) === cle(EFFET_LIBRE)) lu.texte = deux[2];
    else if (deux && proprietes.has(cle(deux[1])) && lu.propriete === null) {
      const v = /^(.*?)\s*=\s*(-?\d+)$/.exec(deux[2]);
      lu.propriete = proprietes.get(cle(deux[1]));
      lu.libelle = v ? v[1] : deux[2];
      lu.valeur = v ? Number(v[2]) : null;
    } else if (lu.nom === null) lu.nom = ligne;
  }
  return lu;
}

// ------------------------------------------------------------------ armes et armure

/**
 * Les lignes de la case « Effet en plus » d'une arme (AA13, AN13) : composition, amélioration, élément, amélioration de l'élément (chacune si présente),
 * l'effet du catalogue (armes[].effet), le malus d'attaque à deux armes de sa main (attaqueADeuxArmes, décision R46), les bonus de dons non comptés
 * (degatsDArme) et, en dernier (il peut tenir sur plusieurs lignes), l'effet en plus saisi.
 */
export function lignesDArme(regles, fiche, rang) {
  const ligne = (fiche.armes ?? []).find((x) => entier(x.rang) === rang);
  if (!ligne || vide(ligne.arme_id)) return [];
  const arme = trouver(regles.armes, ligne.arme_id);
  const lignes = [];
  const materiau = ligne.materiau_id && nomDe(regles.materiaux_armes, ligne.materiau_id);
  if (materiau) lignes.push(`${LIGNES_D_ARME.composition}${SEPARATEUR_DE_CLE}${materiau}`);
  const amelioration = trouver(regles.ameliorations ?? [], ligne.amelioration_id);
  if (amelioration) lignes.push(`${LIGNES_D_ARME.amelioration}${SEPARATEUR_DE_CLE}${texteDAmelioration(amelioration)}`);
  const element = ligne.arme_elementaire_id && nomDe(regles.armes_elementaires, ligne.arme_elementaire_id);
  if (element) lignes.push(`${LIGNES_D_ARME.element}${SEPARATEUR_DE_CLE}${element}`);
  const ameliorationElement = trouver(regles.ameliorations ?? [], ligne.amelioration_elementaire_id);
  if (ameliorationElement) lignes.push(`${LIGNES_D_ARME.ameliorationElement}${SEPARATEUR_DE_CLE}${texteDAmelioration(ameliorationElement)}`);
  if (!vide(arme?.effet)) lignes.push(String(arme.effet));
  const main = attaqueADeuxArmes(regles, fiche)?.mains[rang - 1];
  if (main) lignes.push(`${LIGNES_D_ARME.deuxArmes}${SEPARATEUR_DE_CLE}−${String(main.malus).replace('.', ',')} % (main ${main.main})`);
  for (const n of degatsDArme(regles, fiche, rang)?.nonComptes ?? []) {
    // les raisons, comme l'infobulle des dégâts de la page (« mains » : libellée par la page, pas par lib/degats-texte.mjs)
    const raison = n.raison === 'mains' ? 'arme à une main non écrite' : RAISONS[n.raison] ?? n.raison;
    lignes.push(`${LIGNES_D_ARME.nonCompte}${SEPARATEUR_DE_CLE}${n.nom} ${signe(n.valeur)} (${raison})`);
  }
  if (!vide(ligne.effet_en_plus)) lignes.push(`${LIGNES_D_ARME.effetEnPlus}${SEPARATEUR_DE_CLE}${ligne.effet_en_plus}`);
  return lignes;
}

/** « (AP 3, AM 1) » d'après les valeurs écrites (une valeur absente n'est pas écrite ; rien sans valeur). */
const statsDArmure = (x) => {
  const parts = [!vide(x?.ap) ? `AP ${x.ap}` : null, !vide(x?.am) ? `AM ${x.am}` : null].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
};

/**
 * Une ligne par pièce d'armure portée (AQ21), dans l'ordre de regles.emplacements_armure : « Torse : Armure Cuir/Peau (AP 3) · Amélioration : niv. 1 —
 * +2 AP/AM · Élément : Garde coeur (AP 7, AM 3) · Amélioration de l’élément : niv. 1 — +2 AP/AM ». AP et AM sont ceux de la pièce dans les règles
 * (aucun total : le site ne calcule pas l'armure portée).
 */
export function lignesDArmure(regles, fiche) {
  const portees = fiche.armures ?? [];
  return (regles.emplacements_armure ?? []).flatMap((e) => {
    const l = portees.find((x) => x.emplacement_id === e.id);
    if (!l || vide(l.armure_id)) return [];
    const armure = trouver(regles.armures ?? [], l.armure_id);
    const parts = [`${e.nom}${SEPARATEUR_DE_CLE}${armure?.nom ?? l.armure_id}${statsDArmure(armure)}`];
    const amelioration = trouver(regles.ameliorations ?? [], l.amelioration_id);
    if (amelioration) parts.push(`${LIGNES_D_ARME.amelioration}${SEPARATEUR_DE_CLE}${texteDAmelioration(amelioration)}`);
    if (!vide(l.armure_elementaire_id)) {
      const element = trouver(regles.armures_elementaires ?? [], l.armure_elementaire_id);
      parts.push(`${LIGNES_D_ARME.element}${SEPARATEUR_DE_CLE}${element?.nom ?? l.armure_elementaire_id}${statsDArmure(element)}`);
    }
    const ameliorationElement = trouver(regles.ameliorations ?? [], l.amelioration_elementaire_id);
    if (ameliorationElement) parts.push(`${LIGNES_D_ARME.ameliorationElement}${SEPARATEUR_DE_CLE}${texteDAmelioration(ameliorationElement)}`);
    return [parts.join(SEPARATEUR_D_ARMURE)];
  });
}

/** L'emplacement « armure complète » (regles.emplacements_armure) : son nom seul va dans « Nom Armure » (AD22). */
export const ARMURE_COMPLETE = 'armure-complete';

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
 * remplis: { A1: 'RRGGBB' }, alignements: { A1: { retour?, vertical? } } } — seulement les cases écrites (une autre case garde le texte du modèle : un 0
 * de naturel ou d'acquis reste vide, comme dans la fiche auto) ; les nombres en nombres. `date` (JJ/MM/AAAA) date la ligne d'export de la note.
 * `zones` (Map adresse → zone, lib/tableur-ecriture.mjs#zonesDuClasseur, celles du modèle) : un texte qui ne tient pas dans sa case y est coupé, la
 * suite dans la note (reporterLesDebordements) ; sans `zones`, rien n'est coupé. Le portrait est ajouté par la page.
 */
export function cellulesDeLaFiche(regles, fiche, { date = 'JJ/MM/AAAA', zones = null } = {}) {
  const f = normaliser(regles, fiche);
  const O = ORDINATEUR;
  const cellules = {};
  const remplis = {};
  const ecrire = (adresse, valeur) => {
    if (vide(valeur) || (typeof valeur === 'number' && !Number.isFinite(valeur))) return;
    cellules[adresse] = valeur;
  };
  const note = [];
  const informations = [];
  const noter = (cle_, valeur) => { if (!vide(valeur)) (CLES_D_INFORMATION.includes(cle_) ? informations : note).push(ligneDeNote(cle_, valeur)); };

  // identité
  const race = trouver(regles.races, f.race_id);
  const innee = trouver(regles.magies, f.magie_innee_id);
  const acquise = trouver(regles.magies, f.magie_acquise_id);
  ecrire(O.nom, f.nom);
  ecrire(O.surnom, f.surnom);
  ecrire(O.lieuOrigine, f.lieu_origine);
  ecrire(O.race, race?.nom ?? f.race_id);
  ecrire(O.magieInnee, innee?.nom ?? f.magie_innee_id);
  ecrire(O.magieAcquise, acquise?.nom ?? f.magie_acquise_id);
  ecrire(O.alignement, alignementDe(regles, f).nom);
  ecrire(O.loyal, entier(f.alignement_loyal));
  ecrire(O.chaotique, entier(f.alignement_chaotique));
  ecrire(O.bon, entier(f.alignement_bon));
  ecrire(O.mauvais, entier(f.alignement_mauvais));
  // le dieu inné : les dieux de la magie innée, comme la page (construireMagies)
  if (innee) ecrire(O.dieuInne, (innee.dieux ?? []).map((d) => trouver(regles.dieux, d)?.nom ?? d).join(', '));
  ecrire(O.dieuChoisi, nomDe(regles.dieux, f.dieu_choisi_id));
  ecrire(O.bourseP, entier(f.bourse_pp));
  ecrire(O.bourseO, entier(f.bourse_ro));
  ecrire(O.bourseF, entier(f.bourse_rf));

  // classes, niveau, XP
  const xp = progressionXp(regles, f.xp);
  ecrire(O.niveauGlobal, xp.niveau);
  ecrire(O.xp, xp.suivant === null ? xp.xp : `${xp.xp} / ${xp.suivant}`);
  for (const c of classesDe(regles, f)) {
    if (!c.choix) continue;
    const [classe, niveau, specialite] = c.rang === 1 ? [O.classe1, O.niveau1, O.specialite1] : [O.classe2, O.niveau2, O.specialite2];
    ecrire(classe, c.classe?.nom ?? c.choix.classe_id);
    ecrire(niveau, c.niveau);
    if (c.choix.specialite_id) ecrire(specialite, c.classe?.specialites.find((s) => s.id === c.choix.specialite_id)?.nom ?? c.choix.specialite_id);
  }

  // attributs : valeurs du moment « valeur / max » (comme carteDeJauge), initiative et vitesses (construireAttributs)
  const attributs = attributsDe(regles, f);
  const CASES_DES_JAUGES = { sante_actuelle: O.sante, chakra_actuel: O.chakra, barriere_actuelle: O.barriere, barre4_actuelle: O.barre4, corruption: O.corruption };
  for (const j of valeursDuMoment(regles, f, attributs)) ecrire(CASES_DES_JAUGES[j.champ], `${j.hors ? f[j.champ] : j.valeur} / ${j.max}`);
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
    if (c.croix >= 1) ecrire(k.croix[0], MARQUE_DE_CROIX);
    if (c.croix >= 2) ecrire(k.croix[1], MARQUE_DE_CROIX);
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
    ecrire(cases.nom, arme?.nom ?? ligne.arme_id);
    const degats = degatsDArme(regles, f, rang);
    if (degats) ecrire(cases.degats, degats.texte);
    ecrire(cases.effet, lignesDArme(regles, f, rang).join('\n'));
    const porteeEnPlus = degats?.porteeEnPlus ?? 0;
    const portee = [arme?.portee ?? null, porteeEnPlus ? `${porteeEnPlus > 0 ? '+' : '-'} ${Math.abs(porteeEnPlus)}` : null].filter(Boolean).join(' ');
    ecrire(cases.portee, nombreSiEntier(portee));
  });

  // armure de base, armure portée, bouclier
  ecrire(O.armure.apBase, a.ap);
  ecrire(O.armure.amBase, a.am);
  const complete = f.armures.find((x) => x.emplacement_id === ARMURE_COMPLETE && !vide(x.armure_id));
  const pieces = (regles.emplacements_armure ?? []).map((e) => f.armures.find((x) => x.emplacement_id === e.id && !vide(x.armure_id))).filter(Boolean);
  ecrire(O.armure.nom, complete ? nomDe(regles.armures, complete.armure_id) : pieces.map((x) => nomDe(regles.armures, x.armure_id)).join(', '));
  ecrire(O.armure.bonus, lignesDArmure(regles, f).join('\n'));
  const bouclier = trouver(regles.boucliers ?? [], f.bouclier_classe_id);
  ecrire(O.bouclier.nom, bouclier?.nom ?? f.bouclier_classe_id);
  ecrire(O.bouclier.composition, [...f.bouclier_materiaux].filter((m) => !vide(m.materiau_id)).sort((x, y) => entier(x.rang) - entier(y.rang))
    .map((m) => `${nomDe(regles.materiaux_bouclier, m.materiau_id)} ${MULTIPLICATION}${vide(m.quantite) ? 1 : entier(m.quantite)}`).join(', '));
  if (bouclier) ecrire(O.bouclier.classe, bouclier.classe);

  // accessoires : une case par emplacement du modèle, la ceinture et « autre » dans la note
  const accessoiresSansCase = [];
  for (const [emplacement] of EMPLACEMENTS_ACCESSOIRES) {
    const x = f.accessoires.find((y) => y.emplacement === emplacement);
    if (!x) continue;
    const lignes = lignesDAccessoire(regles, x);
    if (O.accessoires[emplacement]) ecrire(O.accessoires[emplacement], lignes.join('\n'));
    else if (lignes.length) accessoiresSansCase.push([CLES_DES_ACCESSOIRES_SANS_CASE[emplacement] ?? `Accessoire ${emplacement}`, lignes.join(SEPARATEUR_D_ACCESSOIRE)]);
  }

  // ceinture (rang 1 à 3) et inventaire (colonne par colonne)
  O.ceinture.forEach((adresse, i) => {
    const o = f.ceinture.find((x) => entier(x.rang) === i + 1);
    if (o && !vide(String(o.nom ?? '').trim())) ecrire(adresse, texteDObjet(o));
  });
  const objets = f.inventaire.filter((o) => !vide(String(o.nom ?? '').trim()));
  const placesDInventaire = O.inventaire.colonnes.flatMap((c) => O.inventaire.lignes.map((l) => `${c}${l}`));
  objets.slice(0, PLACES_INVENTAIRE).forEach((o, i) => ecrire(placesDInventaire[i], texteDObjet(o)));
  const inventaireEnSuite = objets.slice(PLACES_INVENTAIRE).map(texteDObjet);

  // dons : de base, de race (ethnie), du métier, entraînement (acquis saisis), de classe
  const dr = donsDeRace(regles, f);
  if (dr.base) {
    const base = donDeBase(dr.base);
    const cases = casesDuDon(DONS.base);
    const i = String(base.texte ?? '').indexOf(' · ');
    ecrire(cases.nom, base.nom);
    ecrire(cases.type, i >= 0 ? base.texte.slice(0, i) : null);
    ecrire(cases.effet, i >= 0 ? base.texte.slice(i + 3) : base.texte);
  }
  {
    const cases = casesDuDon(DONS.race);
    ecrire(cases.nom, nomDe(regles.ethnies, f.ethnie_id));
    ecrire(cases.type, dr.dons[0] ? dr.dons[0].nom ?? dr.dons[0].etiquette : dr.tableau?.titre ?? null);
    ecrire(cases.effet, [
      ...dr.dons.map((d) => `${d.nom ?? d.etiquette}${SEPARATEUR_DE_CLE}${d.texte ?? ''}`.trim()),
      ...(dr.tableau?.cellules ?? []).map((c) => `${String(c.libelle ?? '').replace(/\n/g, ' / ')}${SEPARATEUR_DE_CLE}${c.valeur ?? ''}`),
    ].join('\n'));
  }
  if (!vide(f.metier_id)) {
    const cases = casesDuDon(DONS.metier);
    const bm = bonusDuMetier(regles, f);
    ecrire(cases.nom, bm.metier?.nom ?? f.metier_id);
    ecrire(cases.type, 'Passif');
    const lignes = bm.rangs.map((b) => (b.aChoisir
      ? `${b.texte ?? ''} ${FLECHE} ${b.retenue ? nomDe(regles.competences, b.retenue.competence_id) : '?'}`.trim()
      : String(b.texte ?? '')));
    const art = artisanatDe(regles, f);
    if (art) {
      const noms = art.caracteristiques.map((c) => c.nom);
      lignes.push(`Artisanat${SEPARATEUR_DE_CLE}${art.texte ?? ''}${noms.length ? ` (${noms.join(' + ')})` : ''}${art.inutilisable ? ' = inutilisable' : art.score !== null ? ` = ${art.score} %` : ''}`);
    }
    ecrire(cases.effet, lignes.filter(Boolean).join('\n'));
  }
  ecrire(casesDuDon(DONS.entrainement).effet, competences.filter((c) => c.acquis).map((c) => `${c.nom} ${c.acquis}`).join(' | '));
  const donsEnSuite = { 1: [], 2: [] };
  for (const c of donsAcquis(regles, f)) {
    const lignes = c.rang === 1 ? DONS.classe1 : DONS.classe2;
    c.dons.forEach((d, i) => {
      if (i >= PLACES_DONS) {
        donsEnSuite[c.rang].push(d.nom);
        return;
      }
      const cases = casesDuDon(lignes[i]);
      ecrire(cases.nom, d.nom);
      ecrire(cases.type, [TYPES_DE_DON[d.type] ?? d.type, d.precision ? `(${d.precision})` : null].filter(Boolean).join(' '));
      ecrire(cases.effet, d.effet);
    });
  }

  // événements : une ligne de `evenements` par rangée
  const evenements = String(f.evenements ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  evenements.slice(0, PLACES_EVENEMENTS).forEach((ligne, i) => {
    const { titre, texte } = decouperEvenement(ligne);
    const cases = casesDuDon(DONS.evenements[i]);
    ecrire(cases.nom, titre);
    ecrire(cases.effet, texte);
  });

  // sorts : titre, magies, une ligne par sort dans l'ordre de la fiche (au NM du sort, comme construireSorts)
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
    ecrire(`${col.nom}${r}`, sort?.nom ?? ligne.sort_id);
    ecrire(`${col.nm}${r}`, nm);
    if (!sort) return;
    const auNm = (brut, champ) => valeurAuNm(brut ?? null, sort.bonus ?? [], champ, nm) ?? '';
    ecrire(`${col.type}${r}`, auNm(sort.type, 'type'));
    ecrire(`${col.cout}${r}`, nombreSiEntier(auNm(sort.cout, 'cout')));
    ecrire(`${col.portee}${r}`, nombreSiEntier(auNm(sort.portee, 'portee') + (acc.portee ? ` ${signe(acc.portee)}` : '')));
    ecrire(`${col.zone}${r}`, nombreSiEntier(auNm(sort.zone, 'zone')));
    const dsb = auNm(sort.dsb, 'dsb');
    const degatsEnPlus = sort.attaque && dsb ? acc.degats : 0;
    const modes = modesAuNm(sort.modes, sort.bonus ?? [], nm).filter((m) => m.atteint).map((m) => m.texte);
    ecrire(`${col.description}${r}`, [
      dsb + (degatsEnPlus ? ` ${signe(degatsEnPlus)}` : ''), auNm(sort.effets, 'effets'), modes.join(' · '), vide(sort.remarque) ? '' : `${ETOILE} ${sort.remarque}`,
    ].filter(Boolean).join('\n'));
  });

  // résistances et faiblesses : le palier (libellé et effet de la base) et ses cibles
  const resistances = resistancesDe(regles, f);
  for (const k of CASES_RESISTANCES) {
    const p = resistances.paliers.find((x) => x.id === k.palier);
    if (!p) continue;
    ecrire(k.libelle, `${p.libelle}\n(${p.effet})`);
    ecrire(k.cibles, p.cibles.map((c) => c.nom).join(', '));
  }

  // posture du moment ; Mode Hyper (race, magie innée, magie acquise) une fois débloqué
  const posture = CASES_POSTURES.find((p) => p.id === f.posture_id);
  if (posture) ecrire(posture.titre, `${MARQUE_DE_POSTURE} ${TITRES_DES_POSTURES[posture.id]}`);
  const hyper = modeHyperDe(regles, f);
  if (hyper?.debloque) {
    if (hyper.race) ecrire(O.modeHyper.race, `${hyper.race.nom ?? 'Race'}${SEPARATEUR_DE_CLE}${hyper.race.effet}`);
    ecrire(O.modeHyper.magieInnee, hyper.magies.find((m) => m.magie.id === f.magie_innee_id)?.effet);
    ecrire(O.modeHyper.magieAcquise, hyper.magies.find((m) => m.magie.id === f.magie_acquise_id)?.effet);
  }

  // la note : celles du joueur, puis ce que le modèle n'a pas de case pour écrire
  const K = CLES_DE_LA_NOTE;
  noter(K.biClasse, f.mode_classe === 'bi' ? OUI : NON);
  if (innee && !innee.caracteristique_id && f.caracteristique_magie_id) noter(K.caracteristiqueMagie, nomDe(regles.caracteristiques, f.caracteristique_magie_id));
  noter(K.gains, texteDesGains(f.progression));
  noter(K.nmOfferts, texteDesNmOfferts(regles, f.sorts));
  for (const [cle_, valeur] of accessoiresSansCase) noter(cle_, valeur);
  noter(K.donsClasse1, donsEnSuite[1].join(SEPARATEUR_DE_LISTE));
  noter(K.donsClasse2, donsEnSuite[2].join(SEPARATEUR_DE_LISTE));
  noter(K.sorts, sortsEnSuite.join(SEPARATEUR_DE_LISTE));
  noter(K.inventaire, inventaireEnSuite.join(SEPARATEUR_DE_LISTE));
  for (const ligne of evenements.slice(PLACES_EVENEMENTS)) noter(K.evenement, ligne);
  noter(K.resistancesAuChoix, resistances.auChoix.join(', '));
  if (hyper?.cent.debloque) noter(K.modeHyperCent, [...hyper.cent.effets, hyper.cent.suite].filter((x) => !vide(x)).map(uneLigne).join(SEPARATEUR_DE_LISTE));
  noter(K.choixAFaire, choixEnAttente(regles, f).map((c) => c.libelle).join(SEPARATEUR_DE_LISTE));
  const notes = String(f.notes ?? '').replace(/(?:\r?\n[ \t]*)+$/, '');
  const alignements = {};
  const suites = zones ? reporterLesDebordements(cellules, alignements, zones, O.note) : [];
  // ce que l'import relit (dont les suites des textes coupés) avant ce qui n'est qu'informatif, refait d'après les règles à chaque export
  ecrire(O.note, [...(notes.trim() ? [notes, ''] : []), MARQUEUR_DES_NOTES, ligneDExport(date), ...note, ...suites, ...informations].join('\n'));
  // une note trop longue pour sa case : alignée en haut, ses premières lignes (celles du joueur, puis ce que le modèle n'a pas de case pour écrire) restent à l'écran
  if (zones?.get(O.note) && !tientDans(cellules[O.note], zones.get(O.note))) alignements[O.note] = { vertical: 'top' };

  return { cellules, remplis, alignements };
}

/**
 * Les textes trop longs pour leur case (`zones`), sauf la note : retour à la ligne ou réduction au besoin (`alignements`), puis, s'il le faut, la case en
 * garde le début et la suite part dans la note, une ligne « Suite de la case <adresse> : … » par case, dans l'ordre d'écriture des cases
 * (lib/tableur-mesure.mjs#ajusterLeTexte). Rend ces lignes.
 */
function reporterLesDebordements(cellules, alignements, zones, note) {
  const suites = [];
  for (const [adresse, valeur] of Object.entries(cellules)) {
    const zone = zones.get(adresse);
    if (adresse === note || typeof valeur !== 'string' || !zone) continue;
    const { texte, alignement, suite } = ajusterLeTexte(valeur, zone);
    cellules[adresse] = texte;
    if (alignement) alignements[adresse] = alignement;
    if (suite !== null) suites.push(ligneDeNote(`${SUITE_DE_LA_CASE} ${adresse}`, suite));
  }
  return suites;
}
