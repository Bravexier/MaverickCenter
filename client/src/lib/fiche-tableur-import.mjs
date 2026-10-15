// Import d'une fiche de personnage depuis un classeur (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et
// exportée à tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle. […] Toute info supplémentaire peut être notée dans les
// « Notes » »). L'onglet « Personnage » arrive sous la forme de lib/tableur-lecture.mjs (`{ nom, cellules: Map<'A1', { valeur, texte, remplissage }>,
// images }` ; feuilleDeGrille la fabrique depuis une grille de l'API Google) et suit l'une des deux dispositions de lib/fiche-tableur-cases.mjs : le
// modèle « ordinateur » que la page écrit (lib/fiche-tableur-export.mjs) ou la fiche auto V15.2.2 des joueurs. ficheDuClasseur rend une fiche au format
// de lib/fiche-format.mjs, prête pour la page /fiche/ comme l'import d'un JSON.
// Décisions :
//   - ne rien inventer (CLAUDE.md, règle d'or) : un nom écrit se retrouve par sa clé (cle()) dans son contexte (sorts : les magies du personnage, toutes
//     pour le Potentiel Illimité ; dons et spécialités : la classe ; ethnie : la race ; compétence d'un accessoire : la caractéristique de l'effet), puis
//     par le dernier segment de l'identifiant (les corrections d'orthographe ont gardé les identifiants : « Balade guerrière », « Armure Vif Argent
//     complet ») ; aucun candidat, ou plusieurs sans départage écrit dans le classeur : l'information part dans `nonRepris`, que la page ajoute aux notes ;
//   - ce que la fiche calcule (niveaux, totaux, dégâts, AP/AM, résistances…) n'est pas relu, sauf pour retrouver un choix que le classeur n'écrit pas :
//     l'acquis du joueur (acquis écrit − bonus du métier − accessoires, competencesDe), les gains de niveau (maximums de santé et de chakra), la
//     compétence d'un accessoire « Compétence X » de la fiche auto (case de l'entraînement, L42), la caractéristique du Potentiel Illimité ; chaque
//     déduction est dite dans `remarques` ;
//   - la case NOTE : avant MARQUEUR_DES_NOTES, les notes du joueur ; après, les lignes « Clé : valeur » que la page écrit pour ce que le modèle n'a pas de
//     case pour écrire (lireLaNote) ; une ligne inconnue revient dans les notes (rien ne se perd). Un classeur qui porte le marqueur vient de la page :
//     ce qu'elle n'y écrit pas n'existe pas (pas de gains de niveau reconstitués, pas de caractéristique déduite). Une ligne « Suite de la case A1 : … »
//     (un texte trop long pour sa case, lib/tableur-mesure.mjs) se recolle au début resté dans la case avant toute lecture ; une case réécrite depuis
//     (son texte ne finit plus par « … ») garde son texte, et la ligne revient dans les notes ;
//   - puis la même chaîne que la page (caracteristiquesCompletes, ethnieImposee, magieAcquiseValable, classesSelonLaMagieInnee, donsValables,
//     choixDeMetierValables, maitrisesValables) ; ce qu'elle retire est dit dans `nonRepris` ;
//   - les listes ont la forme qu'envoie la page (aEnvoyer de src/scripts/fiche.mjs) : compétences non nulles dans l'ordre des règles, sorts, inventaire et
//     matériaux du bouclier numérotés, ceinture à son emplacement.
// N'importe que lib/fiche-moteur.mjs, lib/fiche-format.mjs, lib/sort-maitrise.mjs et lib/fiche-tableur-cases.mjs : réservé au script de la page /fiche/
// (deux scripts de page n'importent jamais le même module, CLAUDE.md « Pièges connus » ; jamais lib/text.mjs, partagé par la recherche).

import { ajouterAuxNotes, ficheVide } from './fiche-format.mjs';
import {
  armesApresChoix, attributsDe, caracteristiquesCompletes, caracteristiquesDe, choixDeMetierValables, classesSelonLaMagieInnee, competencesDe, degatsDArme,
  donsValables, EMPLACEMENTS_ACCESSOIRES, ethnieImposee, ethniesDeLaRace, famillesMaitrisables, magieAcquiseValable, maitriseDArme, maitrisesValables,
  maitriseDesSorts, niveauGlobal, progressionAttendue, refusMagieAcquise, trouver,
} from './fiche-moteur.mjs';
import { valeurAuNm } from './sort-maitrise.mjs';
import { recollerLeTexte } from './tableur-mesure.mjs';
import {
  CASES_CARACTERISTIQUES, CASES_COMPETENCES, CASES_POSTURES, casesDesDes, casesDuDon, cle, DONS, dispositionDe, EMPLACEMENTS_DU_MODELE, lettresDeColonne,
  MAITRISES, MARQUEUR_DES_NOTES,
} from './fiche-tableur-cases.mjs';

/** Message d'un onglet qui ne suit aucune des deux dispositions (dispositionDe). */
export const ERREUR_DISPOSITION = 'Ce classeur ne suit ni le modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » ni la fiche auto V15.2.2 (onglet « Personnage »).';

/** Le Potentiel Illimité prend ses sorts dans toutes les magies (sortsPossibles de lib/fiche-moteur.mjs, même identifiant). */
const POTENTIEL_ILLIMITE = 'magies/potentiel-illimite';

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
 * Le nombre d'une case : sa valeur quand le tableur en donne une (tronquée à l'entier), sinon le premier entier de son texte, espaces retirés (« 20 600 »
 * = 20600 ; « 20600 / 23450 » = 20600) ; null s'il n'y en a pas.
 */
export function nombreDe(cellule) {
  if (typeof cellule?.valeur === 'number' && Number.isFinite(cellule.valeur)) return Math.trunc(cellule.valeur);
  const m = /[-−]?\d+/.exec(texteBrut(cellule).replace(/[\s\u00a0\u202f]+/g, ''));
  return m ? Number(m[0].replace('−', '-')) : null;
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
 * Un objet écrit « Nom ×N » (aussi « Nom x N », « Nom (xN) », « Nom (N) ») : { nom, quantite } ; sans quantité écrite, une unité ; null pour un texte vide.
 */
export function objetDeLaCase(texte) {
  const brut = String(texte ?? '').trim();
  if (!brut) return null;
  const m = /^(.+?)\s*×\s*(\d+)$/.exec(brut) ?? /^(.+?)\s+[xX]\s*(\d+)$/.exec(brut) ?? /^(.+?)\s*\(\s*[×xX]?\s*(\d+)\s*\)$/.exec(brut);
  return m ? { nom: m[1].trim(), quantite: Number(m[2]) } : { nom: brut, quantite: 1 };
}

/** Le nom d'une pièce d'armure sans les « (AP 3, AM 1) » que la page écrit après (lib/fiche-tableur-export.mjs) : « Cotte de maille (Fer) » garde les siennes. */
const sansAPAM = (t) => String(t ?? '').replace(/\s*\((?:AP|AM)\s[^()]*\)\s*$/i, '').trim();

/** Les lignes non vides d'un texte, sans leurs espaces de bord. */
const lignesDe = (texte) => String(texte ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** « Clé : valeur » → { cle: cle(Clé), valeur } (au premier « : ») ; null sans « : ». */
function cleEtValeur(ligne) {
  const m = /^\s*([^:]+?)\s*:\s*([\s\S]*?)\s*$/.exec(ligne);
  return m ? { cle: cle(m[1]), brut: m[1], valeur: m[2] } : null;
}

// ------------------------------------------------------------------ la case NOTE

/** Clés des lignes que la page écrit après MARQUEUR_DES_NOTES (comparées par cle()) → nom du champ rendu par lireLaNote. */
const CLES_DE_LA_NOTE = Object.freeze({
  'bi-classe': 'biClasse',
  'caracteristique-de-la-magie-innee': 'caracteristiqueMagie',
  'gains-de-niveau': 'gains',
  'nm-offerts': 'nmOfferts',
  'accessoire-ceinture': 'accessoireCeinture',
  'accessoire-autre': 'accessoireAutre',
  'dons-de-classe-1-suite': 'dons1',
  'dons-de-classe-2-suite': 'dons2',
  'sorts-suite': 'sorts',
  'inventaire-suite': 'inventaire',
  evenement: 'evenements',
});
/** Lignes d'information (tirées des règles à l'export) : ignorées. « Exporté le … » n'a pas de « : ». */
const INFORMATIONS_DE_LA_NOTE = new Set(['resistances-au-choix-non-comptees', 'mode-hyper-100', 'choix-a-faire']);

/** Une ligne « Suite de la case AM55 : … » (lib/fiche-tableur-export.mjs) : sa clé (cle()) donne l'adresse. */
const LIGNE_DE_SUITE = /^suite-de-la-case-([a-z]{1,3}[1-9]\d*)$/;

/**
 * La case NOTE : { marqueur (la page l'a écrite), notes (le texte avant le marqueur, sans ses lignes vides de fin ; null s'il est vide), valeurs: { champ:
 * [valeur…] } (lignes reconnues, CLES_DE_LA_NOTE), suites: Map<adresse, { valeur, ligne }> (la suite d'un texte coupé), autres: [ligne] (lignes après le
 * marqueur que rien ne reconnaît : elles reviennent dans les notes) }.
 */
export function lireLaNote(texte) {
  const lignes = texteBrut(texte).split('\n');
  const repere = cle(MARQUEUR_DES_NOTES);
  const i = lignes.findIndex((l) => l.trim() === MARQUEUR_DES_NOTES || cle(l) === repere);
  const avant = i < 0 ? [...lignes] : lignes.slice(0, i);
  while (avant.length && !avant[avant.length - 1].trim()) avant.pop();
  const valeurs = {};
  const suites = new Map();
  const autres = [];
  for (const ligne of i < 0 ? [] : lignes.slice(i + 1)) {
    if (!ligne.trim() || /^exporte-le-/.test(cle(ligne))) continue;
    const kv = cleEtValeur(ligne);
    const champ = kv && CLES_DE_LA_NOTE[kv.cle];
    const suite = kv && LIGNE_DE_SUITE.exec(kv.cle);
    if (champ) (valeurs[champ] ??= []).push(kv.valeur);
    else if (suite && !suites.has(suite[1].toUpperCase())) suites.set(suite[1].toUpperCase(), { valeur: kv.valeur, ligne });
    else if (!kv || !INFORMATIONS_DE_LA_NOTE.has(kv.cle)) autres.push(ligne);
  }
  return { marqueur: i >= 0, notes: avant.length ? avant.join('\n') : null, valeurs, suites, autres };
}

/**
 * « niv. 2 : santé 10, chakra 5 ; niv. 5 : santé 5, chakra 10, dé chakra 6 » → lignes de `progression` ({ niveau, points_sante, points_chakra, de_choix,
 * de_resultat }) ; null si une partie ne se lit pas.
 */
export function lireLesGains(texte) {
  const lignes = [];
  for (const morceau of String(texte ?? '').split(';')) {
    if (!morceau.trim()) continue;
    const m = /^\s*niv(?:eau|\.)?\s*(\d+)\s*:\s*(.*)$/i.exec(morceau);
    if (!m) return null;
    const ligne = { niveau: Number(m[1]), points_sante: 0, points_chakra: 0, de_choix: null, de_resultat: null };
    for (const partie of m[2].split(',')) {
      const k = cle(partie);
      let p;
      if (!k) continue;
      if ((p = /^sante-(\d+)$/.exec(k))) ligne.points_sante = Number(p[1]);
      else if ((p = /^chakra-(\d+)$/.exec(k))) ligne.points_chakra = Number(p[1]);
      else if ((p = /^de-(sante|chakra|les-deux)(?:-(\d+))?$/.exec(k))) {
        // un dé choisi sans son résultat (la page le laisse saisir) : relu tel quel
        ligne.de_choix = p[1].replace('-', '_');
        ligne.de_resultat = p[2] === undefined ? null : Number(p[2]);
      } else return null;
    }
    lignes.push(ligne);
  }
  return lignes;
}

/** « Sort (livre 1, MJ 2) ; … » → [{ nom, livre, mj }] ; null si un morceau ne se lit pas. */
export function lireLesNmOfferts(texte) {
  const offerts = [];
  for (const morceau of String(texte ?? '').split(';')) {
    if (!morceau.trim()) continue;
    const m = /^\s*(.+?)\s*\(([^()]*)\)\s*$/.exec(morceau);
    if (!m) return null;
    const o = { nom: m[1], livre: 0, mj: 0 };
    for (const partie of m[2].split(',')) {
      const k = cle(partie);
      let p;
      if (!k) continue;
      if ((p = /^livre-(\d+)$/.exec(k))) o.livre = Number(p[1]);
      else if ((p = /^mj-(\d+)$/.exec(k))) o.mj = Number(p[1]);
      else return null;
    }
    offerts.push(o);
  }
  return offerts;
}

/**
 * L'acquis du joueur écrit dans la case de l'entraînement (L42) : « 2 Magie | 10 Concentration » (fiche auto) ou « Concentration 10 | Magie 2 » (modèle
 * ordinateur) → Map competence_id → points ; null pour une case vide ou qu'on ne lit pas en entier.
 */
export function acquisDeLEntrainement(regles, texte) {
  const brut = String(texte ?? '').trim();
  if (!brut) return null;
  const acquis = new Map();
  for (const morceau of brut.split('|')) {
    let m = /^\s*(\d+)\s*%?\s+(.+?)\s*$/.exec(morceau);
    let n;
    let nom;
    if (m) [n, nom] = [Number(m[1]), m[2]];
    else if ((m = /^\s*(.+?)\s+(\d+)\s*%?\s*$/.exec(morceau))) [n, nom] = [Number(m[2]), m[1]];
    else return null;
    const k = regles.competences.filter((c) => cle(c.nom) === cle(nom) || c.id === cle(nom));
    if (k.length !== 1) return null;
    acquis.set(k[0].id, (acquis.get(k[0].id) ?? 0) + n);
  }
  return acquis;
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

// ------------------------------------------------------------------ l'import

/**
 * La fiche que décrit l'onglet « Personnage » d'un classeur (voir l'en-tête). `feuille` : `{ cellules: Map, images }` (lib/tableur-lecture.mjs,
 * feuilleDeGrille). `logo` : les octets du logo du modèle (une image identique n'est pas un portrait) ; `empreintePortrait` : celle du portrait de la fiche
 * ouverte (un classeur exporté avec ce portrait le garde, avec son cadrage). `nomFichier` et `date` servent à la page pour la ligne d'en-tête des notes
 * (« [JJ/MM/AAAA] Import du classeur « … » : ») ; acceptés ici pour la même signature.
 * { fiche, disposition: 'ordinateur' | 'auto', nonRepris: [texte], remarques: [texte], image: Image | null, portraitGarde }.
 * Une disposition inconnue lève une Error (ERREUR_DISPOSITION).
 */
export function ficheDuClasseur(regles, feuille, { nomFichier = '', date = 'JJ/MM/AAAA', logo = null, empreintePortrait = null } = {}) {
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

  const note = lireLaNote(cellule(d.note));
  // les textes coupés par la page : la suite, lue dans la note, recollée au début resté dans la case (une copie des cases : la feuille n'est pas touchée)
  if (!auto && note.suites.size) {
    cellules = new Map(cellules);
    for (const [adresse, { valeur, ligne }] of note.suites) {
      const c = adresse === d.note ? null : cellules.get(adresse);
      const entier = c ? recollerLeTexte(texteBrut(c), valeur) : null;
      if (entier === null) note.autres.push(ligne);
      else cellules.set(adresse, { ...c, valeur: entier, texte: entier });
    }
  } else note.autres.push(...[...note.suites.values()].map((x) => x.ligne));
  const deLaPage = note.marqueur;
  const notee = (champ) => note.valeurs[champ] ?? [];

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
  for (const [champ, adresse] of [['alignement_loyal', d.loyal], ['alignement_chaotique', d.chaotique], ['alignement_bon', d.bon], ['alignement_mauvais', d.mauvais],
    ['bourse_pp', d.bourseP], ['bourse_ro', d.bourseO], ['bourse_rf', d.bourseF]]) {
    f[champ] = Math.max(0, nombre(adresse) ?? 0);
  }
  f.xp = Math.max(0, nombre(d.xp) ?? 0);

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
  if (bi !== undefined && ['oui', 'non'].includes(cle(bi))) f.mode_classe = cle(bi) === 'oui' ? 'bi' : 'mono';
  else {
    if (bi !== undefined) perdu(`Bi-classé : « ${bi} » illisible (oui ou non)`);
    const [n1, n2, global] = [nombre(d.niveau1), nombre(d.niveau2), nombre(d.niveauGlobal)];
    f.mode_classe = f.classes.length === 2 && global !== null && n1 === global && n2 === global && global < 20 ? 'bi' : 'mono';
  }

  // ---- caractéristiques (base, croix)
  for (const c of CASES_CARACTERISTIQUES) {
    const base = nombre(c.base);
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
    const lignes = lignesDe(texte(casesDuDon(DONS.metier).effet)).filter((l) => !/^artisanat\s*:/i.test(l));
    metier.bonus.forEach((b, i) => {
      const options = b.options.filter((o) => o.competence_id).map((o) => trouver(regles.competences, o.competence_id)).filter(Boolean);
      if (options.length < 2) return;
      const ligne = lignes.find((l) => cle(l.split('→')[0]) === cle(b.texte)) ?? lignes[i];
      if (!ligne?.includes('→')) return;
      const choix = ligne.slice(ligne.indexOf('→') + 1).trim();
      if (!choix || choix === '?') return;
      const k = unSeul(retrouver(options, choix), `Métier ${metier.nom}, « ${b.texte} »`, choix, { ou: 'parmi les compétences proposées' });
      if (k) f.metier_bonus.push({ rang: b.rang, competence_id: k.id });
    });
  }

  // ---- maîtrises d'armes
  const maitrise = maitriseDArme(regles);
  for (const m of MAITRISES) {
    let des;
    if (auto) des = nombre(`${m.cote === 'gauche' ? d.maitrises.gauche : d.maitrises.droite}${m.ligne}`);
    else des = maitrise.desSansMaitrise + casesDesDes(m).filter((a) => Boolean(cellule(a)?.remplissage) || porteUneMarque(texte(a))).length;
    if (des === null || des <= maitrise.desSansMaitrise) continue;
    const famille = nomDe(regles.familles_armes, m.famille);
    if (des > maitrise.desMax) perdu(`Maîtrise ${famille} : ${des} dés, ramenés à ${maitrise.desMax} (le maximum)`);
    f.maitrises_armes.push({ arme_famille_id: m.famille, des: Math.min(des, maitrise.desMax) });
  }
  const ordreDesFamilles = famillesMaitrisables(regles).map((x) => x.id);
  f.maitrises_armes.sort((a, b) => ordreDesFamilles.indexOf(a.arme_famille_id) - ordreDesFamilles.indexOf(b.arme_famille_id));

  // ---- accessoires
  const libelleDEmplacement = (e) => EMPLACEMENTS_ACCESSOIRES.find(([k]) => k === e)?.[1] ?? e;
  const proprietes = [...new Map(regles.accessoires.map((a) => [a.propriete, a.propriete_nom ?? a.propriete])).entries()];
  const proprieteDe = (t) => proprietes.find(([id, nom]) => cle(nom) === cle(t) || id === cle(t)) ?? null;
  /** L'effet `libelle` d'une propriété (et sa valeur tirée, qui départage les fourchettes « Compétence F ») ; des lignes identiques comptent pour une. */
  const effetDAccessoire = (propriete, libelle, valeur) => {
    // un effet sans libellé (la table en a un par propriété au plus) s'écrit « Attaque : » : il se retrouve par sa propriété
    const candidats = regles.accessoires.filter((a) => a.propriete === propriete && cle(a.libelle) === cle(libelle));
    const dansLaFourchette = candidats.filter((a) => a.min === null || (valeur !== null && valeur >= a.min && valeur <= a.max));
    const reste = dansLaFourchette.length ? dansLaFourchette : candidats;
    const contenu = (a) => JSON.stringify([a.libelle, a.niveau, a.min, a.max, a.valeur, a.malediction, a.usage, a.effets]);
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

  /** Modèle ordinateur : les lignes d'une case d'accessoire (lib/fiche-tableur-export.mjs) ou d'une ligne « Accessoire Ceinture : … » de la note. */
  const accessoireDesLignes = (emplacement, lignes) => {
    const a = nouvelAccessoire(emplacement);
    const quoi = `Accessoire ${libelleDEmplacement(emplacement)}`;
    let choix = null;
    for (const ligne of lignes) {
      const kv = cleEtValeur(ligne);
      const propriete = kv && proprieteDe(kv.brut);
      if (cle(ligne) === 'maudit') a.maudit = 1;
      else if (/^→/.test(ligne)) choix = ligne.slice(1).trim();
      else if (kv?.cle === 'effet') a.texte = kv.valeur || null;
      else if (propriete) {
        const m = /^(.*?)\s*=\s*([-−]?\d+)\s*$/.exec(kv.valeur);
        const [libelle, valeur] = m ? [m[1], Number(m[2].replace('−', '-'))] : [kv.valeur, null];
        const effet = effetDAccessoire(propriete[0], libelle, valeur);
        if (effet) {
          a.accessoire_effet_id = effet.id;
          a.valeur = effet.min !== null ? valeur : null;
        } else {
          a.texte = ligne;
          remarques.push(`${quoi} : « ${ligne} » ne correspond à aucun effet de la table des accessoires : gardé en texte libre (non compté)`);
        }
      } else if (a.nom === null) a.nom = ligne;
      else perdu(`${quoi} : ligne « ${ligne} » sans place sur la fiche`);
    }
    const effet = trouver(regles.accessoires, a.accessoire_effet_id);
    if (choix && choix !== '?' && effet) choixDAccessoire(a, effet, choix, quoi);
    else if (choix && choix !== '?') perdu(`${quoi} : choix « ${choix} » sans effet de la table`);
    garderAccessoire(a);
  };

  /** Valeur tirée d'un accessoire de la fiche auto : « 18% » ou 0,18 (pourcentage du tableur) → 18. */
  const valeurTiree = (c) => {
    if (typeof c?.valeur === 'number' && c.valeur > 0 && c.valeur < 1 && !/%/.test(texteDe(c))) return Math.round(c.valeur * 100);
    const t = texteDe(c).replace(/[\s\u00a0\u202f]+/g, '').replace(',', '.');
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
  for (const [champ, emplacement] of [['accessoireCeinture', 'ceinture'], ['accessoireAutre', 'autre']]) {
    for (const v of notee(champ)) accessoireDesLignes(emplacement, v.split(' / ').map((l) => l.trim()).filter(Boolean));
  }

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
      .concat(notee(`dons${rang}`).flatMap((v) => v.split(';')).map((nom) => ({ nom: nom.trim(), effet: '' })))
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

  // ---- compétence d'un accessoire « Compétence X » de la fiche auto : celle de la caractéristique dont l'acquis écrit, moins le métier et ce que la case
  // de l'entraînement (L42) donne au joueur, vaut la valeur tirée
  const entrainement = auto ? acquisDeLEntrainement(regles, texte(casesDuDon(DONS.entrainement).effet)) : null;
  const caseDeCompetence = new Map(CASES_COMPETENCES.map((c) => [c.id, c]));
  if (entrainement) {
    const calcul = new Map(competencesDe(regles, f).map((k) => [k.id, k]));
    for (const a of f.accessoires) {
      const effet = trouver(regles.accessoires, a.accessoire_effet_id);
      const cible = effet?.effets?.find((c) => c.cible === 'competence');
      if (!cible || a.competence_id || a.valeur === null) continue;
      const candidats = regles.competences.filter((k) => k.caracteristique_id === cible.cible_id).filter((k) => {
        const c = calcul.get(k.id);
        const reste = (nombre(caseDeCompetence.get(k.id).acquis) ?? 0) - c.metier - (entrainement.get(k.id) ?? 0);
        return reste === a.valeur || reste === Math.min(a.valeur, Math.max(0, c.plafondAcquis - c.metier));
      });
      if (candidats.length === 1) {
        a.competence_id = candidats[0].id;
        remarques.push(`Compétence de l'accessoire ${libelleDEmplacement(a.emplacement)} (${effet.libelle} ${a.valeur}) déduite : ${candidats[0].nom}`);
      }
    }
  }

  // ---- compétences : naturel, et l'acquis du joueur = l'acquis écrit moins le métier et les accessoires (que la fiche ajoute d'elle-même)
  const calcul = new Map(competencesDe(regles, f).map((k) => [k.id, k]));
  for (const k of regles.competences) {
    const cases = caseDeCompetence.get(k.id);
    if (!cases) continue;
    const naturel = Math.max(0, nombre(cases.naturel) ?? 0);
    const ecrit = nombre(cases.acquis) ?? 0;
    const plus = calcul.get(k.id).metier + calcul.get(k.id).accessoire;
    let acquis = ecrit - plus;
    if (acquis < 0) {
      remarques.push(`Compétence ${k.nom} : acquis du classeur ${ecrit}, moins que ce qu'ajoutent le métier et les accessoires (${plus}) : acquis du joueur 0`);
      acquis = 0;
    }
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
    // homonymes (« Vague déferlante » : Corruption et Arcane, pour un Potentiel Illimité) : les colonnes écrites, comparées aux valeurs au NM du sort ;
    // dans une description écrite, chaque ligne du D/S/B et des effets du sort qui y est compte, une seule qui n'y est pas écarte le sort
    const auNm = (s, ch) => (s[ch] ? valeurAuNm(s[ch], s.bonus ?? [], ch, Math.min(3, Math.max(0, nm))) : '');
    const score = (s) => {
      if (ligne === null) return 0;
      const n = ['type', 'cout', 'portee', 'zone'].filter((ch) => texte(`${colonnes[ch]}${ligne}`) && cle(texte(`${colonnes[ch]}${ligne}`)) === cle(auNm(s, ch))).length;
      const ecrites = new Set(lignesDe(texteBrut(cellule(`${colonnes.description}${ligne}`))).map(cle));
      if (!ecrites.size) return n;
      const siennes = ['dsb', 'effets'].flatMap((ch) => lignesDe(auNm(s, ch))).map(cle);
      return siennes.every((l) => ecrites.has(l)) ? n + siennes.length : -Infinity;
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
    if (nom) ajouterSort(nom, nombre(`${colonnes.nm}${l}`) ?? 0, l);
  }
  for (const v of notee('sorts')) {
    for (const morceau of v.split(';')) {
      if (!morceau.trim()) continue;
      const m = /^\s*(.+?)\s*\(\s*NM\s*(\d+)\s*\)\s*$/i.exec(morceau);
      if (m) ajouterSort(m[1], Number(m[2]), null);
      else ajouterSort(morceau.trim(), 0, null);
    }
  }
  for (const v of notee('nmOfferts')) {
    const offerts = lireLesNmOfferts(v);
    if (!offerts) {
      perdu(`NM offerts : « ${v} » illisible`);
      continue;
    }
    for (const o of offerts) {
      const lignes = f.sorts.filter((s) => cle(nomDe(regles.sorts, s.sort_id)) === cle(o.nom) || segment(s.sort_id) === cle(o.nom));
      if (lignes.length !== 1 || o.livre > 1 || o.livre + o.mj > lignes[0].niveau_maitrise) {
        perdu(`NM offerts : « ${o.nom} » (livre ${o.livre}, MJ ${o.mj}) ${lignes.length !== 1 ? 'ne désigne pas un sort de la liste' : 'dépasse les NM du sort'}`);
        continue;
      }
      lignes[0].nm_livre = o.livre;
      lignes[0].nm_cadeau = o.mj;
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
   * Une amélioration écrite « niv. N — effet » (modèle ordinateur), « +N » ou « +N (effet) » (fiche auto : le niveau, et l'effet qui doit être le sien),
   * ou son effet seul ; « Aucune » : rien.
   */
  const amelioration = (t, cible, quoi) => {
    if (!t || ['aucune', 'aucun'].includes(cle(t))) return null;
    const niveau = /niv(?:eau|\.)?\s*(\d+)/i.exec(t)?.[1] ?? /^\s*\+?\s*(\d+)\s*(?:\([^()]*\))?\s*$/.exec(t)?.[1];
    const effetEcrit = /—\s*(.+)$/.exec(t)?.[1] ?? /\(([^()]+)\)\s*$/.exec(t)?.[1] ?? null;
    const liste = regles.ameliorations.filter((a) => a.cible === cible);
    const trouvee = niveau !== undefined
      ? liste.find((a) => a.niveau === Number(niveau) && (!effetEcrit || cle(a.effet).startsWith(cle(effetEcrit))))
      : liste.find((a) => cle(a.effet) === cle(t));
    if (!trouvee) perdu(`${quoi} : « ${t} » introuvable dans les règles`);
    return trouvee?.id ?? null;
  };
  /** Les lignes d'un effet écrit qui ne sont pas celles du catalogue : l'« Effet en plus » de la fiche auto (AA12). */
  const effetEnPlus = (t, arme) => {
    const catalogue = new Set(lignesDe(arme.effet).map(cle));
    const reste = lignesDe(t).filter((l) => !catalogue.has(cle(l)));
    return reste.length ? reste.join('\n') : null;
  };
  for (const [i, cases] of d.armes.entries()) {
    const rang = i + 1;
    const quoi = `Arme ${rang}`;
    const nom = auto ? texte(cases.nom).replace(/\s*\(\s*(?:une|deux|1|2)\b[^()]*mains?\s*\)\s*$/i, '').trim() : texte(cases.nom);
    if (!nom) continue;
    const effet = texteBrut(cellule(cases.effet));
    const lignesDEffet = auto ? [] : lignesDe(effet);
    const lue = (k) => lignesDEffet.map(cleEtValeur).find((kv) => kv?.cle === k)?.valeur ?? null;
    const composition = auto ? texte(cases.composition) : lue('composition');
    const degatsEcrits = texte(cases.degats);
    // ce qui va avec l'arme, lu avant elle : ses dégâts départagent deux armes du même nom
    const ligne = { rang, arme_id: null, materiau_id: null, amelioration_id: null, arme_elementaire_id: null, amelioration_elementaire_id: null, effet_en_plus: null };
    if (composition) ligne.materiau_id = unSeul(retrouver(regles.materiaux_armes, composition), `${quoi}, composition`, composition)?.id ?? null;
    ligne.amelioration_id = amelioration(auto ? texte(cases.amelioration) : lue('amelioration'), 'arme', `${quoi}, amélioration`);
    const element = auto ? texte(cases.element) : lue('element');
    if (element) ligne.arme_elementaire_id = unSeul(retrouver(regles.armes_elementaires, element, { autres: () => [] }), `${quoi}, élément`, element)?.id ?? null;
    if (!auto) ligne.amelioration_elementaire_id = amelioration(lue('amelioration-de-lelement'), 'arme_elementaire', `${quoi}, amélioration de l’élément`);
    const avecLArme = (armeId) => (composition ? [...f.armes.filter((x) => x.rang !== rang), { ...ligne, arme_id: armeId }].sort((a, b) => a.rang - b.rang)
      // une composition absente : le fer (décision R49, armesApresChoix) ; écrite mais introuvable : rien
      : armesApresChoix(regles, { ...f, armes: [...f.armes.filter((x) => x.rang !== rang), ligne] }, rang, armeId));
    const departager = (candidats) => {
      // homonymes d'une famille à l'autre (« Étendard de guerre », « Crochet grappin ») : l'effet du catalogue écrit, puis les dégâts écrits
      const parEffet = candidats.filter((a) => a.effet && lignesDe(effet).some((l) => cle(l) === cle(lignesDe(a.effet)[0])));
      if (parEffet.length === 1) return parEffet;
      return (parEffet.length ? parEffet : candidats)
        .filter((a) => degatsEcrits && cle(degatsDArme(regles, { ...f, armes: avecLArme(a.id) }, rang)?.texte) === cle(degatsEcrits));
    };
    const arme = unSeul(retrouver(regles.armes, nom), quoi, nom, {
      departager, nom: (a) => `${a.nom} (${nomDe(regles.familles_armes, a.famille_id)})`, precisions: [composition, degatsEcrits].filter(Boolean).join(', '),
    });
    if (!arme) continue;
    if (auto) ligne.effet_en_plus = effetEnPlus(effet, arme);
    else {
      const k = lignesDEffet.findIndex((l) => cleEtValeur(l)?.cle === 'effet-en-plus');
      if (k >= 0) {
        // la dernière ligne de la case : son texte va jusqu'au bout (il peut tenir sur plusieurs lignes)
        const brut = effet.slice(effet.indexOf(lignesDEffet[k]));
        ligne.effet_en_plus = brut.slice(brut.indexOf(':') + 1).trim() || null;
      }
    }
    f.armes = avecLArme(arme.id);
  }

  // ---- armure
  const armureElementaire = (t, armure, quoi) => {
    const parNom = retrouver(regles.armures_elementaires, sansAPAM(t), { autres: () => [] });
    if (parNom.length) return unSeul(parNom, quoi, t)?.id ?? null;
    // fiche auto : le nom de la magie, l'armure élémentaire de cette magie et de la catégorie de l'armure
    const magie = retrouver(regles.magies, t, { autres: ecrituresDeMagie });
    if (magie.length === 1 && armure) {
      const id = regles.armures_elementaires.find((x) => cle(x.categorie) === cle(armure.type) && segment(x.id) === cle(magie[0].nom))?.id ?? null;
      if (!id) perdu(`${quoi} : pas d'armure élémentaire ${magie[0].nom} de catégorie ${armure.type}`);
      return id;
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
    const lue = nomArmure ? ajouterArmure('armure-complete', nomArmure, 'Armure') : null;
    if (lue) {
      lue.ligne.amelioration_id = amelioration(texte(d.armure.amelioration), 'armure', `Armure (${lue.armure.nom}), amélioration`);
      if (texte(d.armure.element)) lue.ligne.armure_elementaire_id = armureElementaire(texte(d.armure.element), lue.armure, `Armure (${lue.armure.nom}), élément`);
      lue.ligne.amelioration_elementaire_id = amelioration(texte(d.armure.ameliorationElement), 'armure_elementaire', `Armure (${lue.armure.nom}), amélioration de l’élément`);
    }
  } else {
    const lignes = lignesDe(texte(d.armure.bonus));
    for (const l of lignes) {
      const [premiere, ...suite] = l.split(/\s+·\s+/);
      const kv = cleEtValeur(premiere);
      const emplacement = kv ? retrouver(regles.emplacements_armure, kv.brut) : [];
      if (emplacement.length !== 1) {
        perdu(`Armure : ligne « ${l} » sans emplacement reconnu`);
        continue;
      }
      const lue = ajouterArmure(emplacement[0].id, sansAPAM(kv.valeur), `Armure (${emplacement[0].nom})`);
      if (!lue) continue;
      for (const partie of suite) {
        const p = cleEtValeur(partie);
        const quoi = `Armure (${emplacement[0].nom} : ${lue.armure.nom})`;
        if (p?.cle === 'amelioration') lue.ligne.amelioration_id = amelioration(p.valeur, 'armure', `${quoi}, amélioration`);
        else if (p?.cle === 'element') lue.ligne.armure_elementaire_id = armureElementaire(p.valeur, lue.armure, `${quoi}, élément`);
        else if (p?.cle === 'amelioration-de-lelement') lue.ligne.amelioration_elementaire_id = amelioration(p.valeur, 'armure_elementaire', `${quoi}, amélioration de l’élément`);
        else perdu(`${quoi} : « ${partie} » sans place sur la fiche`);
      }
    }
    if (!lignes.length && texte(d.armure.nom)) ajouterArmure('armure-complete', texte(d.armure.nom), 'Armure');
  }
  const ordreDesEmplacements = regles.emplacements_armure.map((e) => e.id);
  f.armures.sort((a, b) => ordreDesEmplacements.indexOf(a.emplacement_id) - ordreDesEmplacements.indexOf(b.emplacement_id));

  // ---- bouclier
  if (texte(d.bouclier.nom)) f.bouclier_classe_id = unSeul(retrouver(regles.boucliers, texte(d.bouclier.nom)), 'Bouclier', texte(d.bouclier.nom))?.id ?? null;
  const materiaux = auto
    ? d.bouclier.materiaux.map((m) => (texte(m.materiau) ? { nom: texte(m.materiau), quantite: nombre(m.quantite) ?? 1 } : null)).filter(Boolean)
    : texte(d.bouclier.composition).split(',').map(objetDeLaCase).filter(Boolean);
  for (const m of materiaux) {
    const materiau = unSeul(retrouver(regles.materiaux_bouclier, m.nom), 'Bouclier, matériau', m.nom);
    if (!materiau) continue;
    if (m.quantite < 1) perdu(`Bouclier, matériau : « ${m.nom} » en quantité ${m.quantite}`);
    else f.bouclier_materiaux.push({ rang: f.bouclier_materiaux.length + 1, materiau_id: materiau.id, quantite: m.quantite });
  }

  // ---- ceinture et inventaire (ressource_id : la ressource de ce nom exact, comme la page)
  const ressource = (nom) => (regles.ressources ?? []).find((r) => r.nom === nom)?.id ?? null;
  const objetAuto = (aNom, aQuantite) => {
    const nom = texte(aNom);
    return nom ? { nom, quantite: nombre(aQuantite) ?? 1 } : null;
  };
  const ranger = (liste, objet, quoi, rang) => {
    if (!objet) return;
    if (objet.quantite < 1) perdu(`${quoi} : « ${objet.nom} » en quantité ${objet.quantite}`);
    else liste.push({ rang, nom: objet.nom, quantite: objet.quantite, ressource_id: ressource(objet.nom) });
  };
  d.ceinture.forEach((c, i) => ranger(f.ceinture, auto ? objetAuto(c.nom, c.quantite) : objetDeLaCase(texte(c)), `Ceinture ${i + 1}`, i + 1));
  const objets = [];
  for (const colonne of d.inventaire.colonnes) {
    for (const l of d.inventaire.lignes) objets.push(auto ? objetAuto(`${colonne.nom}${l}`, `${colonne.quantite}${l}`) : objetDeLaCase(texte(`${colonne}${l}`)));
  }
  for (const v of notee('inventaire')) objets.push(...v.split(';').map(objetDeLaCase));
  for (const o of objets) ranger(f.inventaire, o, 'Inventaire', f.inventaire.length + 1);

  // ---- événements, notes
  const evenements = [];
  const derniere = auto ? d.evenementsJusqua : DONS.evenements[DONS.evenements.length - 1];
  for (let l = DONS.evenements[0]; l <= derniere; l += 1) {
    const titre = texte(casesDuDon(l).nom);
    const corps = texte(casesDuDon(l).effet);
    if (titre && corps) evenements.push(`${titre} : ${corps}`);
    else if (titre || corps) evenements.push(titre || corps);
  }
  evenements.push(...notee('evenements'));
  f.evenements = evenements.length ? evenements.join('\n') : null;
  f.notes = note.autres.length ? ajouterAuxNotes(note.notes, note.autres) : note.notes;

  // ---- valeurs du moment (null : au maximum ; corruption : null à 0) et posture du moment
  const jauges = auto
    ? [['sante_actuelle', d.sante, d.santeMax], ['chakra_actuel', d.chakra, d.chakraMax], ['barriere_actuelle', d.barriere, d.barriereMax], ['barre4_actuelle', d.barre4, d.barre4Max]]
      .map(([champ, a, max]) => [champ, nombre(a), nombre(max)])
    : [['sante_actuelle', d.sante], ['chakra_actuel', d.chakra], ['barriere_actuelle', d.barriere], ['barre4_actuelle', d.barre4]]
      .map(([champ, a]) => [champ, ...paireDe(cellule(a))]);
  for (const [champ, valeur, max] of jauges) f[champ] = valeur === null || valeur === max ? null : Math.max(0, valeur);
  const corruption = auto ? nombre(d.corruption) : paireDe(cellule(d.corruption))[0];
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
    const lus = lireLesGains(gainsEcrits);
    if (lus) f.progression = lus;
    else perdu(`Gains de niveau : « ${gainsEcrits} » illisibles`);
  } else if (!deLaPage) {
    const maxSante = auto ? nombre(d.santeMax) : paireDe(cellule(d.sante))[1];
    const maxChakra = auto ? nombre(d.chakraMax) : paireDe(cellule(d.chakra))[1];
    if (maxSante !== null && maxChakra !== null) {
      const reconstitues = gainsReconstitues(regles, f, maxSante, maxChakra);
      const lus = `(santé ${maxSante}, chakra ${maxChakra})`;
      if (reconstitues === null) remarques.push(`Gains de niveau non reconstitués : les maximums du classeur ${lus} ne s'expliquent pas par les points et les dés des niveaux ; à saisir`);
      else if (reconstitues.length) {
        f.progression = reconstitues;
        remarques.push(`Gains de niveau reconstitués d'après les maximums du classeur ${lus} : à vérifier`);
      }
    }
  }

  // ---- portrait (modèle ordinateur) : l'image ancrée en A1, sauf le logo du modèle
  let image = null;
  let portraitGarde = false;
  if (!auto) {
    const img = (feuille?.images ?? []).find((x) => x.de === d.image) ?? null;
    if (img) {
      const description = String(img.description ?? '').trim();
      const marqueePortrait = /^portrait/i.test(description);
      const marqueeLogo = /^logo/i.test(description) || (!description && cle(img.nom) === 'logo');
      if (marqueePortrait || (!marqueeLogo && !memesOctets(img.octets, logo))) image = img;
      const empreinte = /^portrait:(.+)$/i.exec(description)?.[1]?.trim();
      portraitGarde = Boolean(empreinte && empreintePortrait && empreinte === empreintePortrait);
    }
  }

  return { fiche: f, disposition: d.disposition, nonRepris, remarques, image, portraitGarde };
}

/** Deux suites d'octets identiques (le logo du modèle n'est pas un portrait). */
function memesOctets(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Les gains de niveau (personnage_progression) qu'il faut pour atteindre les maximums de santé et de chakra lus dans le classeur, la fiche n'en ayant pas :
 * gains = maximum − attributsDe de la fiche sans progression ; P = les points des niveaux atteints (progressionAttendue : 15 chacun, santé + chakra), D = les
 * niveaux à dé ; les dés font T = gains de santé + gains de chakra − P. Possible si les deux gains sont positifs et que T va avec D (aucun dé : T = 0 ;
 * sinon de |D| à 8 |D|, un d8 chacun) : les dés au plus près de l'égalité, sur le chakra tant qu'ils y tiennent puis sur la santé ; les points de chaque
 * niveau sur la santé jusqu'à épuisement, puis sur le chakra. null quand c'est impossible ; [] quand il n'y a rien à répartir.
 */
export function gainsReconstitues(regles, fiche, maxSante, maxChakra) {
  const sans = attributsDe(regles, { ...fiche, progression: [] });
  const gainsSante = maxSante - sans.sante;
  const gainsChakra = maxChakra - sans.chakra;
  const attendue = progressionAttendue(regles, niveauGlobal(regles, fiche.xp));
  const points = attendue.reduce((s, n) => s + n.points, 0);
  const aDe = attendue.filter((n) => n.de);
  const total = gainsSante + gainsChakra - points;
  if (gainsSante < 0 || gainsChakra < 0) return null;
  if (aDe.length ? total < aDe.length || total > 8 * aDe.length : total !== 0) return null;
  if (!attendue.length) return [];
  const des = aDe.map((n, i) => ({ niveau: n.niveau, valeur: Math.floor(total / aDe.length) + (i < total % aDe.length ? 1 : 0), sur: null }));
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
