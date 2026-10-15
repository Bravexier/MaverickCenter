// Import d'une fiche de personnage depuis un classeur (lib/fiche-tableur-import.mjs ; demande du propriétaire, 2026-10-15 : « La fiche de personnage doit
// pouvoir être importée et exportée à tout moment depuis un Excel ou Google Sheet »). Les deux fiches auto du propriétaire (Lucien et Louise,
// test/fixtures : valeurs affichées par l'API Google) relues contre la base — ce qui est repris, ce qui part dans `nonRepris`, ce que disent les
// `remarques`, chaque valeur attendue tirée du fichier ou des règles —, puis des feuilles « ordinateur » : le modèle vierge (client/src/modeles,
// lu ici par lib/xml-mini.mjs) et des cases remplies à la main (maîtrises par remplissage et par marque, posture, accessoires en lignes, case NOTE et
// ses clés, débordements, portrait, l'écriture de la page et l'ancienne) ; anciennes graphies, homonymes (cases coupées comprises), disposition inconnue.
// Les écritures de la page se relisent par les lecteurs de lib/fiche-tableur-export.mjs, testés avec elle (fiche-tableur-export.test.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { attributsDe, competencesDe, degatsDArme, maitriseDArme, trouver } from '../src/lib/fiche-moteur.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';
import {
  AUTO, CASES_CARACTERISTIQUES, CASES_COMPETENCES, casesDesDes, cle, DONS, LONGUEUR_MAX_D_UNE_CASE, MAITRISES, MARQUEUR_DES_NOTES, ORDINATEUR,
  SAISIES_SANS_PLACE, TITRE_DE_L_INVENTAIRE,
} from '../src/lib/fiche-tableur-cases.mjs';
import {
  bonusDEntrainement, bornesDuDe, ERREUR_DISPOSITION, estCoche, feuilleDeGrille, ficheDuClasseur, gainsReconstitues, lireLaNote, nombreDe, paireDe,
  porteUneMarque, REMARQUE_MAITRISES_CSV,
} from '../src/lib/fiche-tableur-import.mjs';
import { cellulesDeLaFiche, enChiffres, lignesDArmure, lireGains, partiesDeLArme, SEPARATEUR_EN_LIGNE } from '../src/lib/fiche-tableur-export.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { analyserXml, enfantNomme, enfantsNommes, texteDe } from '../src/lib/xml-mini.mjs';

const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false })))); // tel que la page le reçoit

const grille = (qui) => JSON.parse(readFileSync(new URL(`./fixtures/fiche-auto-${qui}.json`, import.meta.url), 'utf8')).values;
const LUCIEN = grille('lucien');
const LOUISE = grille('louise');
/** La valeur affichée d'une case d'une grille (A1) ; '' pour une case vide. */
function lue(values, adresse) {
  const m = /^([A-Z]+)(\d+)$/.exec(adresse);
  let colonne = 0;
  for (const c of m[1]) colonne = colonne * 26 + c.charCodeAt(0) - 64;
  return values[Number(m[2]) - 1]?.[colonne - 1] ?? '';
}
/** Une copie de la grille avec des cases changées ({ A1: texte }, '' pour vider). */
function avec(values, changements) {
  const copie = values.map((l) => [...(l ?? [])]);
  for (const [adresse, v] of Object.entries(changements)) {
    const m = /^([A-Z]+)(\d+)$/.exec(adresse);
    let colonne = 0;
    for (const c of m[1]) colonne = colonne * 26 + c.charCodeAt(0) - 64;
    while (copie.length < Number(m[2])) copie.push([]);
    copie[Number(m[2]) - 1][colonne - 1] = v;
  }
  return copie;
}
const importer = (values, options) => ficheDuClasseur(regles, feuilleDeGrille(values), options);

// ------------------------------------------------------------------ le modèle « ordinateur » vierge, tel que le site le sert

/** L'onglet du modèle (client/src/modeles/fiche-personnage) : texte des cases et couleur de fond pleine (le blanc compte pour rien). */
function modeleVierge() {
  const dossier = join(trouverRacine(), 'client', 'src', 'modeles', 'fiche-personnage');
  const lire = (chemin) => analyserXml(readFileSync(join(dossier, chemin), 'utf8'));
  const chaines = enfantsNommes(lire('xl/sharedStrings.xml'), 'si').map(texteDe);
  const styles = lire('xl/styles.xml');
  const fonds = enfantsNommes(enfantNomme(styles, 'fills'), 'fill').map((f) => {
    const motif = enfantNomme(f, 'patternFill');
    const rgb = motif?.attrs.patternType === 'solid' ? enfantNomme(motif, 'fgColor')?.attrs.rgb : null;
    const couleur = rgb ? rgb.slice(-6).toUpperCase() : null;
    return couleur === 'FFFFFF' ? null : couleur;
  });
  const parStyle = enfantsNommes(enfantNomme(styles, 'cellXfs'), 'xf').map((x) => fonds[Number(x.attrs.fillId ?? 0)] ?? null);
  const cellules = new Map();
  for (const ligne of enfantsNommes(enfantNomme(lire('xl/worksheets/sheet1.xml'), 'sheetData'), 'row')) {
    for (const c of enfantsNommes(ligne, 'c')) {
      const v = enfantNomme(c, 'v');
      const texte = !v ? '' : c.attrs.t === 's' ? chaines[Number(texteDe(v))] : texteDe(v);
      const remplissage = parStyle[Number(c.attrs.s ?? 0)] ?? null;
      if (texte || remplissage) cellules.set(c.attrs.r, { valeur: texte, texte, remplissage });
    }
  }
  return { nom: 'Personnage', cellules, images: [] };
}
const VIERGE = modeleVierge();

/**
 * Le modèle vierge avec des cases écrites ({ A1: texte | nombre | { valeur, texte, tronquee? } : une case telle que la lit lib/tableur-lecture.mjs, valeur
 * et texte affiché distincts }) et des fonds ({ A1: 'RRGGBB' }).
 */
function ordinateur(valeurs = {}, { remplis = {}, images = [] } = {}) {
  const cellules = new Map(VIERGE.cellules);
  for (const [a, v] of Object.entries(valeurs)) {
    if (v === null || v === '') cellules.delete(a);
    else if (typeof v === 'object') cellules.set(a, { remplissage: cellules.get(a)?.remplissage ?? null, ...v });
    else cellules.set(a, { valeur: v, texte: String(v), remplissage: cellules.get(a)?.remplissage ?? null });
  }
  for (const [a, r] of Object.entries(remplis)) cellules.set(a, { valeur: cellules.get(a)?.valeur ?? '', texte: cellules.get(a)?.texte ?? '', remplissage: r });
  return { nom: 'Personnage', cellules, images };
}

// ------------------------------------------------------------------ outils des règles

const parNom = (liste, nom) => {
  const x = liste.filter((e) => e.nom === nom);
  assert.equal(x.length, 1, `une seule entrée « ${nom} »`);
  return x[0];
};
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const classe = (nom) => parNom(regles.classes, nom);
const don = (nomDeClasse, nom) => parNom(classe(nomDeClasse).dons, nom);
const magie = (nom) => parNom(regles.magies, nom);
const effetDAccessoire = (proprieteNom, libelle) => {
  const x = regles.accessoires.filter((a) => a.propriete_nom === proprieteNom && a.libelle === libelle);
  assert.ok(x.length >= 1, `${proprieteNom} : ${libelle}`);
  return x[0];
};
const sortDe = (nomDeMagie, nom) => parNom(regles.sorts.filter((s) => s.magie_id === magie(nomDeMagie).id), nom);
const amelioration = (cible, niveau) => regles.ameliorations.find((a) => a.cible === cible && a.niveau === niveau);

// ------------------------------------------------------------------ lecture des cases

test('lecture des cases : nombres, « a / b », cases cochées, marques', () => {
  assert.equal(nombreDe({ valeur: '20 600', texte: '20 600' }), 20600);
  assert.equal(nombreDe({ valeur: 20600, texte: '20 600' }), 20600);
  assert.equal(nombreDe('20600 / 23450'), 20600);
  assert.equal(nombreDe('Nd'), null);
  assert.equal(nombreDe('4d'), 4);
  assert.equal(nombreDe(null), null);
  assert.deepEqual(paireDe('45 / 60'), [45, 60]);
  assert.deepEqual(paireDe('60'), [60, null]);
  assert.deepEqual(paireDe(''), [null, null]);
  for (const oui of [{ valeur: true }, { valeur: 1, texte: 'TRUE' }, 'TRUE', 'VRAI', 'X', 'x', '✔', '✓', 'oui', 'Oui']) assert.equal(estCoche(oui), true, JSON.stringify(oui));
  for (const non of [{ valeur: false }, { valeur: 0, texte: 'FALSE' }, 'FALSE', 'FAUX', '', null, '0']) assert.equal(estCoche(non), false, JSON.stringify(non));
  for (const marque of ['✔', '2d ✓', 'x', '3d X', '●', '■', '★', '*']) assert.equal(porteUneMarque(marque), true, marque);
  for (const rien of ['2d', 'OFFENSIF', 'Max', '']) assert.equal(porteUneMarque(rien), false, rien);
});

test('case NOTE : notes du joueur avant le marqueur, lignes « Clé : valeur » après, lignes inconnues rendues aux notes', () => {
  const note = lireLaNote(['Mes notes', '', 'sur trois lignes', '', '', MARQUEUR_DES_NOTES, 'Exporté le 15/10/2026 depuis Maverick Center.', 'Bi-classé : oui',
    'Événement : Titre : texte', 'Événement : Autre', 'Choix à faire : Ethnie : Humain', 'Mode Hyper 100 % : …', 'Résistances au choix (non comptées) : X',
    'Une ligne écrite à la main', 'Sorts (suite) : Boule de feu (NM 2)'].join('\r\n'));
  assert.equal(note.marqueur, true);
  assert.equal(note.notes, 'Mes notes\n\nsur trois lignes');
  assert.deepEqual(note.valeurs, { biClasse: ['oui'], evenement: ['Titre : texte', 'Autre'], sorts: ['Boule de feu (NM 2)'] });
  assert.deepEqual(note.autres, ['Une ligne écrite à la main']);
  // les accessoires sans case, par emplacement
  assert.deepEqual(lireLaNote(`${MARQUEUR_DES_NOTES}\nAccessoire Ceinture : Boucle / +2 Initiative\naccessoire autre : Maudit`).valeurs.accessoires,
    [{ emplacement: 'ceinture', valeur: 'Boucle / +2 Initiative' }, { emplacement: 'autre', valeur: 'Maudit' }]);
  assert.deepEqual(lireLaNote('Sans marqueur\nBi-classé : oui'), { marqueur: false, notes: 'Sans marqueur\nBi-classé : oui', valeurs: {}, suites: new Map(), autres: [], doubles: [] });
  // des notes collées qui portent elles-mêmes le marqueur : seul le dernier sépare les notes des données
  const collees = lireLaNote(['Notes collées', MARQUEUR_DES_NOTES, 'Bi-classé : oui', 'Mes notes', '', MARQUEUR_DES_NOTES, 'Bi-classé : non'].join('\n'));
  assert.deepEqual([collees.notes, collees.valeurs], [`Notes collées\n${MARQUEUR_DES_NOTES}\nBi-classé : oui\nMes notes`, { biClasse: ['non'] }]);
  // une clé en double : la première ; les autres à part (nonRepris) ; les événements, une ligne chacun
  const doubles = lireLaNote([MARQUEUR_DES_NOTES, 'Bi-classé : non', 'Bi-classé : oui', 'Événement : Un', 'Événement : Deux', 'Accessoire Ceinture : A',
    'Accessoire Ceinture : B', 'Accessoire Autre : C'].join('\n'));
  assert.deepEqual(doubles.valeurs, { biClasse: ['non'], evenement: ['Un', 'Deux'], accessoires: [{ emplacement: 'ceinture', valeur: 'A' }, { emplacement: 'autre', valeur: 'C' }] });
  assert.deepEqual(doubles.doubles, ['Bi-classé : oui', 'Accessoire Ceinture : B']);
  const enDouble = ficheDuClasseur(regles, ordinateur({ BA54: [MARQUEUR_DES_NOTES, 'Bi-classé : non', 'Bi-classé : oui', 'Gains de niveau : niv. 2 : santé 15, chakra 0',
    'Gains de niveau : niv. 2 : santé 0, chakra 15'].join('\n') }));
  assert.equal(enDouble.fiche.mode_classe, 'mono');
  assert.deepEqual([enDouble.fiche.gains_sante, enDouble.fiche.gains_chakra], [15, 0]);
  assert.deepEqual(enDouble.nonRepris, ['Note : ligne « Bi-classé : oui » en double, seule la première de cette clé est lue',
    'Note : ligne « Gains de niveau : niv. 2 : santé 0, chakra 15 » en double, seule la première de cette clé est lue']);
  // la suite d'un texte coupé (lib/tableur-mesure.mjs) : par adresse, la première seulement ; une seconde pour la même case revient dans les notes
  const coupee = lireLaNote([MARQUEUR_DES_NOTES, 'Suite de la case AM55 : du texte ⏎ et la suite', 'suite de la case am55 : encore', 'Suite de la case : sans adresse'].join('\n'));
  assert.deepEqual(coupee.suites, new Map([['AM55', { valeur: 'du texte ⏎ et la suite', ligne: 'Suite de la case AM55 : du texte ⏎ et la suite' }]]));
  assert.deepEqual(coupee.autres, ['suite de la case am55 : encore', 'Suite de la case : sans adresse']);
  assert.equal(lireLaNote('').notes, null);
  assert.equal(lireLaNote(`\n${MARQUEUR_DES_NOTES}\nBi-classé : non`).notes, null);
  // des lignes illisibles : dites dans nonRepris
  const r = ficheDuClasseur(regles, ordinateur({ BA54: `${MARQUEUR_DES_NOTES}\nGains de niveau : niv. 2 : beaucoup\nNM offerts : Boule de feu` }));
  assert.deepEqual(r.nonRepris, ['NM offerts : « Boule de feu » illisible', 'Gains de niveau : « niv. 2 : beaucoup » illisibles']);

  // la case « Entraînement » de la fiche auto : les bonus d'entraînement (guide « Fiche de personnage : Capacités/Dons »), « 2 Magie | 10 Concentration »
  // ou « Magie 2 | Concentration 10 » (« % » permis)
  const attendu = new Map([['magie', 2], ['concentration', 10]]);
  assert.deepEqual(bonusDEntrainement(regles, '2 Magie | 10 Concentration'), attendu);
  assert.deepEqual(bonusDEntrainement(regles, 'Magie 2 | Concentration 10'), attendu);
  assert.deepEqual(bonusDEntrainement(regles, '2% Magie | Concentration 10 %'), attendu);
  assert.equal(bonusDEntrainement(regles, ''), null);
  assert.equal(bonusDEntrainement(regles, '2 Magie | beaucoup de Chance'), null);
});

test('disposition inconnue : une Error qui nomme les deux modèles', () => {
  assert.throws(() => ficheDuClasseur(regles, feuilleDeGrille([['Nom', 'Lucien']])), { message: ERREUR_DISPOSITION });
  assert.throws(() => ficheDuClasseur(regles, ordinateur({ AA21: 'AP de base ?' })), { message: ERREUR_DISPOSITION });
  assert.match(ERREUR_DISPOSITION, /Fiche-de-personnage-Maverick-V15\.2\.2 ordinateur/);
  assert.match(ERREUR_DISPOSITION, /fiche auto V15\.2\.2 \(onglet « Personnage »\)/);
});

// ------------------------------------------------------------------ les deux fiches auto du propriétaire
// Les fiches sont figées, les règles changent (le site de dev en est la source : CLAUDE.md, « Conventions de travail ») : seul ce qui vient du classeur
// (nom, XP, bourse, noms écrits…) est attendu tel quel ; ce qui dépend des règles est retrouvé ici comme l'import le fait (par la clé du nom, sinon par le
// dernier segment de l'identifiant), et contrôlé par des invariants (un nom introuvable part dans nonRepris, l'acquis du joueur est l'acquis écrit moins
// les bonus de la base, chaque déduction a sa remarque).

const segment = (id) => String(id ?? '').split(/[#:/]/).pop();
/** Les entrées d'une liste qu'écrit un texte du classeur : par la clé de leur nom, sinon par le dernier segment de leur identifiant (ancienne graphie). */
function selon(liste, ecrit) {
  const k = cle(ecrit);
  const parNom = liste.filter((x) => cle(x.nom) === k);
  return parNom.length ? parNom : liste.filter((x) => segment(x.id) === k);
}
/** Les noms des règles (et les clés de leurs identifiants) : un nom que nonRepris cite doit en être absent. */
const NOMS_DES_REGLES = new Set([...regles.races, ...regles.ethnies, ...regles.magies, ...regles.classes, ...regles.classes.flatMap((c) => [...c.specialites, ...c.dons]),
  ...regles.sorts, ...regles.armes, ...regles.armures, ...regles.armures_elementaires, ...regles.armes_elementaires, ...regles.materiaux_armes,
  ...regles.materiaux_bouclier, ...regles.boucliers, ...regles.metiers, ...regles.dieux, ...regles.competences].flatMap((x) => [cle(x.nom), segment(x.id)]));
/** Chaque ligne de nonRepris d'une fiche auto du propriétaire cite (entre « ») un nom absent des règles du moment. */
function verifierNonRepris(r) {
  for (const l of r.nonRepris) {
    const m = /« ([^»]+) »/.exec(l);
    assert.ok(m && !NOMS_DES_REGLES.has(cle(m[1])) && !NOMS_DES_REGLES.has(cle(sansMains(m[1]))), l);
  }
}
const sansMains = (nom) => nom.replace(/\s*\((?:une|deux) mains?\)\s*$/i, '');

/**
 * L'acquis du joueur, compétence par compétence : l'acquis écrit moins le métier et les accessoires de la base (competencesDe de la fiche importée), jamais
 * négatif ; une remarque pour chaque compétence que ces bonus touchent (classeur qui ne vient pas de la page). Rend les remarques attendues.
 */
function verifierLesAcquis(values, r) {
  const f = r.fiche;
  const v = (a) => lue(values, a);
  const attendues = [];
  for (const k of M.competencesDe(regles, f)) {
    const cases = CASES_COMPETENCES.find((c) => c.id === k.id);
    const ecrit = Number(v(cases.acquis) || 0);
    const joueur = f.competences.find((c) => c.competence_id === k.id)?.acquis ?? 0;
    assert.equal(joueur, Math.max(0, ecrit - k.metier - k.accessoire), k.id);
    if (!k.metier && !k.accessoire) continue;
    const remarque = r.remarques.find((x) => x.startsWith(`${k.nom} : acquis ${ecrit} du classeur `));
    assert.ok(remarque, `${k.nom} : la remarque de son acquis`);
    if (k.metier) assert.ok(remarque.includes(` − ${k.metier} du métier ${M.trouver(regles.metiers, f.metier_id).nom} (base)`), remarque);
    assert.ok(remarque.endsWith(ecrit < k.metier + k.accessoire ? ': moins que ces bonus, 0 au joueur' : `= ${joueur} au joueur`), remarque);
    attendues.push(remarque);
  }
  return attendues;
}

/** Ce que les deux fiches ont en commun : identité, alignement, bourse, XP, caractéristiques, compétences (scores gardés), sorts, inventaire, maîtrises. */
function verifierLeCommun(values, r) {
  const f = r.fiche;
  const v = (a) => lue(values, a);
  assert.equal(r.disposition, 'auto');
  verifierNonRepris(r);
  assert.equal(f.nom, v('I1'));
  assert.equal(f.surnom, v('S1'));
  assert.equal(f.lieu_origine, v('I3'));
  const unique = (liste, ecrit) => {
    const x = selon(liste, ecrit);
    return x.length === 1 ? x[0].id : null;
  };
  assert.equal(f.race_id, unique(regles.races, v('I2')));
  assert.equal(f.magie_innee_id, unique(regles.magies, v('S2')));
  assert.equal(f.magie_acquise_id, v('S3') ? unique(regles.magies, v('S3')) : null);
  assert.equal(f.ethnie_id, unique(regles.ethnies.filter((e) => e.race_id === f.race_id), v('C40')));
  assert.equal(f.metier_id, unique(regles.metiers, v('C41')));
  assert.deepEqual([f.alignement_loyal, f.alignement_chaotique, f.alignement_bon, f.alignement_mauvais], ['L5', 'M5', 'N5', 'O5'].map((a) => Number(v(a) || 0)));
  assert.deepEqual([f.bourse_pp, f.bourse_ro, f.bourse_rf], ['L6', 'Q6', 'W6'].map((a) => Number(v(a) || 0)));
  assert.equal(f.xp, Number(v('S11')));
  // niveaux de classe 20 et 2 au niveau global 11 : mono-classe (décision R2)
  assert.deepEqual([v('G9'), v('G11'), v('W8')], ['20', '2', '11']);
  assert.equal(f.mode_classe, 'mono');
  // classes et spécialités : celles qu'écrit le classeur (I9, I11), sinon celle des dons de spécialité écrits
  for (const [rang, aClasse, aSpecialite] of [[1, 'A9', 'I9'], [2, 'A11', 'I11']]) {
    const choix = f.classes.find((c) => c.rang === rang);
    assert.equal(choix?.classe_id ?? null, unique(regles.classes, v(aClasse)), aClasse);
    if (choix && v(aSpecialite)) assert.equal(choix.specialite_id, unique(M.trouver(regles.classes, choix.classe_id).specialites, v(aSpecialite)), aSpecialite);
  }
  // dons à choix : chacun est une option de la classe dont le nom est écrit, et son nom (ou l'ancienne graphie de son identifiant) est écrit dans ses lignes
  for (const [rang, lignes] of [[1, DONS.classe1], [2, DONS.classe2]]) {
    const choix = f.classes.find((c) => c.rang === rang);
    const classe = M.trouver(regles.classes, choix?.classe_id);
    const ecrits = lignes.map((l) => v(`C${l}`)).filter(Boolean);
    const prefixe = `${segment(classe?.id)}-`;
    const sienne = (d, ecrit) => cle(d.nom) === cle(ecrit) || segment(d.id) === cle(ecrit) || segment(d.id) === prefixe + cle(ecrit);
    for (const c of f.capacites.filter((x) => classe?.dons.some((d) => d.id === x.capacite_id))) {
      const d = classe.dons.find((x) => x.id === c.capacite_id);
      assert.equal(d.nature, 'choix', d.id);
      assert.ok(ecrits.some((e) => sienne(d, e)), `${d.nom} : écrit dans le classeur`);
    }
    // et chaque don à choix écrit (le seul de ce nom dans sa classe) est repris, s'il va avec la spécialité
    for (const e of ecrits) {
      const d = classe?.dons.filter((x) => sienne(x, e));
      if (d?.length === 1 && d[0].nature === 'choix' && (!d[0].specialite_id || d[0].specialite_id === choix.specialite_id)) {
        assert.ok(f.capacites.some((x) => x.capacite_id === d[0].id), `${e} : repris`);
      }
    }
  }
  assert.equal(f.capacites.length, new Set(f.capacites.map((c) => c.capacite_id)).size);
  for (const c of CASES_CARACTERISTIQUES) {
    const ligne = f.caracteristiques.find((x) => x.caracteristique_id === c.id);
    assert.deepEqual([ligne.base, ligne.croix], [Number(v(c.base)), c.croix.filter((a) => v(a) === 'TRUE').length], c.id);
  }
  // le +1 de la magie innée sur sa caractéristique (case bonus du classeur)
  const bonus = CASES_CARACTERISTIQUES.filter((c) => v(c.bonus)).map((c) => c.id);
  assert.deepEqual(bonus, [regles.magies.find((m) => m.id === f.magie_innee_id).caracteristique_id]);
  // compétences : le naturel tel quel ; chaque score du classeur retrouvé par le site (sauf un acquis du classeur plus petit que les bonus de la base)
  const calcul = competencesDe(regles, f);
  for (const c of CASES_COMPETENCES) {
    const ligne = f.competences.find((x) => x.competence_id === c.id);
    const k = calcul.find((x) => x.id === c.id);
    assert.equal(ligne?.naturel ?? 0, Number(v(c.naturel) || 0), c.id);
    if (Number(v(c.acquis) || 0) >= k.metier + k.accessoire) assert.equal(k.score, Number(v(c.total)), `score ${c.id}`);
  }
  // maîtrises : « Nd » → N dés, seules celles qui ajoutent un dé
  const attendues = MAITRISES.map((m) => ({ arme_famille_id: m.famille, des: Number(v(`${m.cote === 'gauche' ? 'AI' : 'AN'}${m.ligne}`).replace('d', '')) }))
    .filter((m) => m.des > maitriseDArme(regles).desSansMaitrise);
  assert.deepEqual([...f.maitrises_armes].sort((a, b) => a.arme_famille_id.localeCompare(b.arme_famille_id)),
    attendues.sort((a, b) => a.arme_famille_id.localeCompare(b.arme_famille_id)));
  // sorts : chaque ligne écrite, retrouvée parmi les sorts des magies du personnage, avec son NM (rien d'offert : la fiche auto ne le dit pas) ; un sort
  // que les règles n'ont plus part dans nonRepris (verifierNonRepris)
  const magies = [f.magie_innee_id, f.magie_acquise_id].filter(Boolean);
  const ecrits = AUTO.sorts.lignes.filter((l) => v(`AA${l}`)).map((l) => [v(`AA${l}`), Number(v(`AY${l}`) || 0)])
    .map(([nom, nm]) => [selon(regles.sorts.filter((s) => magies.includes(s.magie_id)), nom), nm]).filter(([s]) => s.length === 1);
  assert.deepEqual(f.sorts.map((s) => [s.sort_id, s.niveau_maitrise, s.nm_livre, s.nm_cadeau, s.rang]), ecrits.map(([[s], nm], i) => [s.id, nm, 0, 0, i + 1]));
  assert.ok(f.sorts.length >= 1);
  // inventaire : colonne par colonne, les lignes nommées ; la ressource de ce nom exact (comme la page)
  const objets = AUTO.inventaire.colonnes.flatMap((c) => AUTO.inventaire.lignes.map((l) => [v(`${c.nom}${l}`), v(`${c.quantite}${l}`)])).filter(([nom]) => nom);
  assert.deepEqual(f.inventaire, objets.map(([nom, q], i) => ({ rang: i + 1, nom, quantite: Number(q), ressource_id: regles.ressources.find((x) => x.nom === nom)?.id ?? null })));
  // valeurs du moment au maximum (null), corruption 0 (null)
  assert.deepEqual([v('D14'), v('K14'), v('R14')], [v('F14'), v('M14'), v('T14')]);
  assert.deepEqual([f.sante_actuelle, f.chakra_actuel, f.barriere_actuelle, f.barre4_actuelle, f.corruption, f.posture_id], [null, null, null, null, null, null]);
  // gains de niveau (deux totaux, décision R73) : les maximums du classeur retrouvés, un total dans la plage du niveau (points et dés atteints)
  const a = attributsDe(regles, f);
  assert.deepEqual([a.sante, a.chakra], [Number(v('F14')), Number(v('M14'))]);
  const n = regles.niveaux.find((x) => x.niveau === Number(v('W8')));
  const total = f.gains_sante + f.gains_chakra;
  assert.ok(total >= n.points_attributs_cumul + n.de_attributs_min_cumul && total <= n.points_attributs_cumul + n.de_attributs_max_cumul, `gains ${total}`);
  assert.equal(r.image, null);
  assert.equal(r.portraitGarde, false);
  assert.equal(f.notes, v('BA54') || null);
  // les remarques : celles des acquis, des gains de niveau
  const remarques = verifierLesAcquis(values, r);
  remarques.push(`Gains de niveau reconstitués d'après les maximums du classeur (santé ${v('F14')}, chakra ${v('M14')}) : à vérifier`);
  for (const x of remarques) assert.ok(r.remarques.includes(x), x);
  return remarques;
}

test('fiche auto de Lucien : tout ce que le classeur choisit est repris, chaque déduction a sa remarque', () => {
  const r = importer(LUCIEN);
  const f = r.fiche;
  const v = (a) => lue(LUCIEN, a);
  const remarques = verifierLeCommun(LUCIEN, r);
  assert.equal(f.dieu_choisi_id, selon(regles.dieux, v('S5'))[0]?.id ?? null, '« Pas de Dieu choisi » est un dieu de la liste');
  // « Balade guerrière » (C51) : retrouvée par l'identifiant quand la base écrit le nom autrement (« Ballade guerrière » à l'import, décision 0006)
  assert.equal(v('C51'), 'Balade guerrière');
  // l'accessoire « Compétence » (Chef) : l'effet de la caractéristique écrite dont la fourchette contient la valeur tirée ; sa compétence, celle dont
  // l'acquis écrit moins le métier et les bonus d'entraînement (L42) vaut la valeur tirée
  const chef = f.accessoires.find((a) => a.emplacement === 'chef');
  const effetChef = M.trouver(regles.accessoires, chef.accessoire_effet_id);
  const tiree = Number.parseFloat(v('AA31'));
  const caracteristique = regles.caracteristiques.find((k) => cle(k.nom) === cle(v('AA30')));
  assert.deepEqual([effetChef.propriete, effetChef.caracteristique_id, chef.valeur], ['competence', caracteristique.id, tiree]);
  assert.ok(tiree >= effetChef.min && tiree <= effetChef.max);
  const entrainement = bonusDEntrainement(regles, v('L42'));
  const calcul = new Map(competencesDe(regles, { ...f, competences: [] }).map((k) => [k.id, k]));
  const candidates = regles.competences.filter((k) => k.caracteristique_id === caracteristique.id).filter((k) => {
    const cases = CASES_COMPETENCES.find((c) => c.id === k.id);
    return Number(v(cases.acquis) || 0) - calcul.get(k.id).metier - (entrainement.get(k.id) ?? 0) === tiree;
  });
  assert.equal(candidates.length, 1);
  assert.equal(chef.competence_id, candidates[0].id);
  const ecrit = Number(v(CASES_COMPETENCES.find((c) => c.id === chef.competence_id).acquis));
  const deduite = r.remarques.find((x) => x.startsWith(`Compétence de l'accessoire Chef (${effetChef.libelle} ${tiree}) déduite : ${candidates[0].nom} (acquis ${ecrit} = `));
  assert.ok(deduite?.endsWith(`entraînement ${entrainement.get(chef.competence_id)} + accessoire ${tiree})`), deduite);
  remarques.push(deduite);
  // les autres accessoires : la propriété et le libellé du classeur, tels quels dans la table, sinon en texte libre (avec une remarque)
  for (const a of f.accessoires.filter((x) => x.emplacement !== 'chef')) {
    const effet = M.trouver(regles.accessoires, a.accessoire_effet_id);
    assert.ok(effet ? !a.texte : a.texte, a.emplacement);
  }
  // armes : « (une main) » ignorée ; la composition écrite, le fer par défaut (décision R49) ; « Effet en plus » (AA13) est une formule de la fiche
  // auto (=BDD!AJ36, relevée le 2026-10-15 : on y lit l'effet du catalogue puis celui du matériau), aucune saisie du joueur : rien n'en est tiré
  assert.match(v('AA10'), /\(une main\)$/);
  const armes = [['AA10', 'AE10'], ['AN10', 'AR10']].map(([nom, composition]) => ({ arme: selon(regles.armes, sansMains(v(nom))), composition: v(composition) }));
  assert.deepEqual(f.armes.map((a) => [a.rang, a.arme_id, a.materiau_id, a.effet_en_plus]), armes.map((x, i) => [i + 1, x.arme[0].id,
    x.composition ? selon(regles.materiaux_armes, x.composition)[0].id : regles.materiau_arme_defaut, null]));
  // armure : l'armure complète écrite ; l'élément « Nécromancie », le nom d'une magie : l'armure élémentaire de cette magie et de la catégorie de
  // l'armure (armure_elementaire.magie_id), et une remarque ; « +5 » : son amélioration de niveau 5
  const vetement = selon(regles.armures, v('AD21'))[0];
  const necromancie = selon(regles.magies, v('AS21'))[0] ?? regles.magies.find((m) => segment(m.id).endsWith(cle(v('AS21'))));
  const elementaire = regles.armures_elementaires.find((x) => x.magie_id === necromancie.id && x.categorie === vetement.type);
  assert.equal(v('AT20'), 'Aucune');
  assert.deepEqual(f.armures, [{
    emplacement_id: 'armure-complete', armure_id: vetement.id, amelioration_id: null, armure_elementaire_id: elementaire.id,
    amelioration_elementaire_id: amelioration('armure_elementaire', Number(v('AX21'))).id,
  }]);
  const element = `Élément d'armure déduit de la magie « ${necromancie.nom} » et de la catégorie « ${vetement.type} » : ${elementaire.nom}`;
  assert.ok(r.remarques.includes(element));
  remarques.push(element);
  assert.equal(f.bouclier_classe_id, null);
  assert.deepEqual(f.bouclier_materiaux, []);
  assert.equal(f.evenements, `${v('C71')} : ${v('L71')}\n${v('C72')} : ${v('L72')}`);
  // les NM du classeur, plus que les NM de niveau : comptés comme NM de niveau, une remarque
  const nm = M.maitriseDesSorts(regles, f);
  if (nm.deNiveau > nm.disponibles) {
    const x = `NM des sorts : les ${nm.total} NM du classeur sont comptés comme NM de niveau (${nm.disponibles} disponibles) ; le classeur ne dit pas lesquels viennent d'un livre ou du MJ`;
    assert.ok(r.remarques.includes(x));
    remarques.push(x);
  }
  // les textes libres des accessoires
  remarques.push(...r.remarques.filter((x) => /^Accessoire .* gardé en texte libre \(non compté\)$/.test(x)));
  assert.deepEqual([...r.remarques].sort(), [...remarques].sort(), 'aucune autre remarque');
});

test('fiche auto de Louise : bi-magie, amélioration écrite « +N (effet) », anciennes graphies, métier qui a changé', () => {
  const r = importer(LOUISE);
  const f = r.fiche;
  const v = (a) => lue(LOUISE, a);
  const remarques = verifierLeCommun(LOUISE, r);
  assert.ok(v('S3'), 'deux magies');
  assert.equal(v('I11'), '', 'la classe 2 sans spécialité écrite');
  assert.equal(f.dieu_choisi_id, null);
  // le métier : les bonus de la base (pas ceux qu'écrivait la fiche auto, « +2% Reflexe, Esquive et Ruse ») ; l'acquis écrit qui en est plus petit
  // revient à 0 (verifierLesAcquis), avec sa remarque
  assert.match(v('L41'), /Reflexe, Esquive et Ruse/);
  // arme : la composition écrite (Mythril), « +5 » : l'amélioration de niveau 5 ; « Passe barrière », sous l'effet du catalogue, vient de la formule (le
  // matériau) : pas d'effet en plus
  const rasoir = selon(regles.armes, v('AA10'));
  assert.equal(v('AA13').split('\n').length, 2);
  assert.deepEqual(f.armes, rasoir.length === 1 ? [{
    rang: 1, arme_id: rasoir[0].id, materiau_id: selon(regles.materiaux_armes, v('AE10'))[0].id, amelioration_id: amelioration('arme', Number(v('AI13').replace('+', ''))).id,
    arme_elementaire_id: null, amelioration_elementaire_id: null, effet_en_plus: null,
  }] : []);
  // armure : « Armure Vif Argent complet », l'ancienne graphie retrouvée par l'identifiant ; « +4 (+8 AP/AM) » : l'amélioration de niveau 4, si c'est son effet
  const vifArgent = selon(regles.armures, v('AD21'));
  assert.equal(vifArgent.length, 1);
  const [, niveau, effet] = /^\s*\+(\d+)\s*\(([^)]*)\)\s*$/.exec(v('AT20'));
  const a4 = amelioration('armure', Number(niveau));
  const attendue = a4 && cle(a4.effet).startsWith(cle(effet)) ? a4.id : null;
  assert.deepEqual(f.armures, [{ emplacement_id: 'armure-complete', armure_id: vifArgent[0].id, amelioration_id: attendue, armure_elementaire_id: null, amelioration_elementaire_id: null }]);
  // accessoires : la propriété (« DÉFENSE ») et le libellé du classeur, tels quels dans la table ; sinon en texte libre, non compté, et une remarque
  for (const [emplacement, adresse] of [['chef', 'AA30'], ['collier', 'AI30'], ['bracelet-1', 'AA33'], ['bracelet-2', 'AI33'], ['bague-1', 'AA36']]) {
    const a = f.accessoires.find((x) => x.emplacement === emplacement);
    const effets = regles.accessoires.filter((x) => x.propriete === 'defense' && cle(x.libelle) === cle(v(adresse)));
    if (effets.length) assert.deepEqual([a.accessoire_effet_id, a.texte], [effets[0].id, null], emplacement);
    else {
      assert.deepEqual([a.accessoire_effet_id, a.texte], [null, `Défense : ${v(adresse)}`], emplacement);
      const x = `Accessoire ${M.EMPLACEMENTS_ACCESSOIRES.find(([e]) => e === emplacement)[1]} : « ${v(adresse)} » (DÉFENSE) ne correspond à aucun effet de la table des accessoires : gardé en texte libre (non compté)`;
      assert.ok(r.remarques.includes(x), x);
      remarques.push(x);
    }
  }
  assert.equal(f.evenements, null);
  assert.deepEqual([...r.remarques].sort(), [...remarques].sort(), 'aucune autre remarque');
});

// La ceinture des fiches auto est en AQ29 (nom) et AX29 (quantité), AQ32/AX32, AQ35/AX35 : « CEINTURE » en AQ28 dans les deux fiches du propriétaire.
const CEINTURE_DES_FICHES = [['AQ29', 'AX29'], ['AQ32', 'AX32'], ['AQ35', 'AX35']];
test('fiches auto : la ceinture (nom et quantité)', () => {
  assert.deepEqual(AUTO.ceinture.map((c) => [c.nom, c.quantite]), CEINTURE_DES_FICHES);
  for (const values of [LUCIEN, LOUISE]) {
    assert.equal(lue(values, 'AQ28'), 'CEINTURE');
    const attendue = CEINTURE_DES_FICHES.map(([nom, q], i) => ({ rang: i + 1, nom: lue(values, nom), quantite: Number(lue(values, q)), ressource_id: regles.ressources.find((x) => x.nom === lue(values, nom))?.id ?? null }));
    assert.deepEqual(importer(values).fiche.ceinture, attendue);
  }
});

test('fiche auto : ce qui n’a pas de place sur le site part dans nonRepris, une ligne chacun, avec sa valeur', () => {
  const louise = (changements) => importer(avec(LOUISE, changements));
  // un sort d'une autre magie, un sort inconnu
  let r = louise({ AA64: 'Boule de feu', AY64: '2', AA65: 'Sort inventé', AY65: '1' });
  assert.ok(r.nonRepris.includes('Sort « Boule de feu » (NM 2) : absent des magies du personnage'));
  assert.ok(r.nonRepris.includes('Sort « Sort inventé » (NM 1) : introuvable dans les règles'));
  assert.ok(!r.fiche.sorts.some((s) => s.sort_id === sortDe('Feu', 'Boule de feu').id));
  // une arme inconnue : son nom, sa composition et ses dégâts
  r = louise({ AA10: 'Épée inventée' });
  assert.deepEqual(r.nonRepris, ['Arme 1 : « Épée inventée » (Mythril, 5D10+6+8) introuvable dans les règles']);
  assert.deepEqual(r.fiche.armes, []);
  // une ethnie qui n'est pas de la race ; une magie acquise refusée par les règles (refusMagieAcquise)
  r = louise({ C40: 'Humain Lunaire', S3: 'Lumière' });
  assert.ok(r.nonRepris.includes('Ethnie : « Humain Lunaire » introuvable parmi les ethnies de la race Humain'));
  assert.ok(r.nonRepris.includes('Magie acquise « Lumière » : c’est déjà la magie innée'));
  assert.equal(r.fiche.magie_acquise_id, null);
  // un don inconnu de la classe ; un don à choix de l'autre spécialité (Mage Rubis), écarté comme le fait la page (donsValables)
  r = louise({ C55: 'Coup de génie', C51: don('Mage Rouge', 'Destructeur').nom });
  assert.ok(r.nonRepris.includes('Don de la classe 1 (Mage Rouge) : « Coup de génie » introuvable dans les règles'));
  assert.ok(r.nonRepris.includes('Don « Destructeur » (Mage Rouge) : hors des classes ou de la spécialité de la fiche'));
  assert.ok(!r.fiche.capacites.some((c) => c.capacite_id === don('Mage Rouge', 'Destructeur').id));
  // l'ambidextrie cochée (décision R46) ; un objet en quantité 0
  r = louise({ AU8: 'TRUE', AA46: 'Corde', AF46: '0' });
  assert.ok(r.nonRepris.includes('Ambidextrie : cochée dans le classeur ; la fiche calcule l’attaque à deux armes d’après les armes portées (décision R46)'));
  assert.ok(r.nonRepris.includes('Inventaire : « Corde » en quantité 0'));
  // une ethnie qui ne va pas avec la magie innée, remplacée par celle qu'impose la magie (ethnieImposee) : Drakos Rouge (Feu) pour un Drakos de Lumière
  const drakos = parNom(regles.races, 'Drakos');
  r = louise({ I2: 'Drakos', C40: 'Drakos Rouge', S3: '' });
  const beige = regles.ethnies.find((e) => e.race_id === drakos.id && e.magie_id === magie('Lumière').id);
  assert.equal(r.fiche.ethnie_id, beige.id);
  assert.ok(r.nonRepris.includes(`Ethnie « Drakos Rouge » : remplacée par ${beige.nom}, la seule de la race qui aille avec la magie innée Lumière`));
  // des maximums que les règles n'expliquent pas : pas de gains de niveau, une remarque
  r = louise({ F14: '5' });
  assert.deepEqual([r.fiche.gains_sante, r.fiche.gains_chakra], [0, 0]);
  assert.ok(r.remarques.includes('Gains de niveau non reconstitués : les maximums du classeur (santé 5, chakra 133) ne s\'expliquent pas par les points et les dés des niveaux ; à saisir'));
});

// ------------------------------------------------------------------ le modèle « ordinateur »

test('modèle ordinateur vierge : une fiche vide, ses libellés figés ne sont pas des valeurs', () => {
  assert.equal(lue([], 'A1'), '');
  assert.equal(VIERGE.cellules.get('C41').texte.replace(/\s/g, ' '), 'Métier ?');
  assert.equal(VIERGE.cellules.get('C42').texte, 'Entraînement');
  const r = ficheDuClasseur(regles, VIERGE);
  assert.equal(r.disposition, 'ordinateur');
  assert.deepEqual([r.nonRepris, r.remarques, r.image, r.portraitGarde], [[], [], null, false]);
  assert.equal(r.fiche.metier_id, null);
  assert.deepEqual(r.fiche.maitrises_armes, [], 'les cases « 2d » à « 5d » du modèle ne sont pas des dés atteints');
  assert.equal(r.fiche.posture_id, null);
  assert.deepEqual(r.fiche.caracteristiques.map((c) => c.base), [1, 1, 1, 1, 1, 1]);
  for (const cle_ of ['classes', 'competences', 'capacites', 'sorts', 'armes', 'armures', 'accessoires', 'inventaire', 'ceinture']) assert.deepEqual(r.fiche[cle_], [], cle_);
  assert.deepEqual([r.fiche.gains_sante, r.fiche.gains_chakra], [0, 0]);
});

test('modèle ordinateur : maîtrises par remplissage et par marque, posture marquée, valeurs du moment « a / b »', () => {
  const epees = MAITRISES.find((m) => m.famille === 'epees');
  const arbalete = MAITRISES.find((m) => m.famille === 'arbalete');
  const [e2, e3] = casesDesDes(epees);
  const [a2, a3, a4] = casesDesDes(arbalete);
  const feuille = ordinateur({
    I2: 'Humain', S2: 'Feu', [a2]: 'x', [a3]: '3d ✔', [a4]: '4d', BI23: '✔ VIGILANCE', D14: '30 / 41', K14: '20 / 38', R14: '23 / 23', K15: '5 / 43', D15: '',
  }, { remplis: { [e2]: '808080', [e3]: 'FF0000' } });
  const f = ficheDuClasseur(regles, feuille).fiche;
  assert.deepEqual(f.maitrises_armes, [{ arme_famille_id: 'epees', des: 3 }, { arme_famille_id: 'arbalete', des: 3 }]);
  assert.equal(f.posture_id, 'guide/postures#posture:vigilance');
  assert.deepEqual([f.sante_actuelle, f.chakra_actuel, f.barriere_actuelle, f.corruption, f.barre4_actuelle], [30, 20, null, 5, null]);
  const deux = ficheDuClasseur(regles, ordinateur({ BA16: '✔ OFFENSIF', BR16: 'X DEFENSIF' }));
  assert.equal(deux.fiche.posture_id, null);
  assert.deepEqual(deux.nonRepris, ['Posture du moment : plusieurs postures marquées (✔ OFFENSIF, X DEFENSIF)']);
});

test('modèle ordinateur : une fiche écrite par la page dans l’ancienne écriture (marqueur, clés de la note, lignes des cases) se relit en entier', () => {
  const guerrier = classe('Guerrier');
  const coursier = parNom(regles.metiers, 'Coursier');
  const rangAChoisir = coursier.bonus.find((b) => b.options.length > 1);
  const epeeLongue = parNom(regles.armes, 'Épée Longue');
  const epeeDeFeu = regles.armes_elementaires.find((a) => a.id.endsWith(':epee:feu'));
  const [torse, casque] = [regles.armures[0], regles.armures[1]];
  const elementaire = regles.armures_elementaires[0];
  const competenceA = regles.accessoires.find((a) => a.propriete === 'competence' && a.caracteristique_id === 'agilite' && a.min <= 7 && a.max >= 7);
  const parCategorie = regles.accessoires.find((a) => a.effets.some((c) => c.cible === 'degats_famille'));
  const note = ['Mes notes', 'sur deux lignes', '', MARQUEUR_DES_NOTES, 'Exporté le 15/10/2026 depuis Maverick Center.', 'Bi-classé : non',
    'Gains de niveau : niv. 2 : santé 10, chakra 5 ; niv. 3 : santé 15, chakra 0 ; niv. 4 : santé 0, chakra 15 ; niv. 5 : santé 5, chakra 10, dé chakra 6',
    'NM offerts : Boule de feu (livre 1, MJ 1)', 'Accessoire Ceinture : Ceinture de force / Caractéristique : Force', 'Accessoire Autre : Effet : Un porte-clé',
    'Sorts (suite) : Cautérisation (NM 2)', 'Inventaire (suite) : Lanterne ×2 ; Parchemin vierge', 'Événement : Cinquième : au-delà de la case',
    'Résistances au choix (non comptées) : —', 'Mode Hyper 100 % : —', 'Choix à faire : —', 'Une ligne que la page n’écrit pas'].join('\n');
  const feuille = ordinateur({
    I1: 'Essai', S1: 'Le Test', I3: 'Champieu', I2: 'Humain', S2: 'Feu', C40: 'Humain Central', S5: 'Mirada', I4: 'Loyal Neutre',
    L5: 8, M5: 1, N5: 2, O5: 3, L6: 1, Q6: 245, W6: 50, A9: 'Guerrier', G9: 10, W8: 5, S11: `${xpDuNiveau(5)} / ${xpDuNiveau(6)}`,
    E18: 3, M18: 2, U18: 2, E19: 2, M19: 3, U19: 3, H18: 'X', P19: 'X', Q19: 'X',
    G22: 10, T33: 5, V33: 12,
    C41: 'Coursier', L41: `${coursier.bonus.map((b) => (b === rangAChoisir ? `${b.texte} → Équilibre` : b.texte)).join('\n')}`,
    C43: 'Contact', C45: 'Brave', C47: 'Épéiste', C49: 'Duelliste',
    AA10: epeeLongue.nom, AG10: '1D10+2',
    AA13: ['Composition : Acier', `Amélioration : niv. 2 — ${amelioration('arme', 2).effet}`, `Élément : ${epeeDeFeu.nom}`,
      `Amélioration de l’élément : niv. 1 — ${amelioration('arme_elementaire', 1).effet}`, epeeLongue.effet, 'Effet en plus : Première ligne', 'Seconde ligne'].join('\n'),
    AQ21: [`Torse : ${torse.nom} (AP ${torse.ap}, AM ${torse.am}) · Amélioration : niv. 1 — ${amelioration('armure', 1).effet}`,
      `Casque : ${casque.nom} (AP ${casque.ap}, AM ${casque.am}) · Élément : ${elementaire.nom} (AP ${elementaire.ap}, AM ${elementaire.am}) · Amélioration de l’élément : niv. 2 — ${amelioration('armure_elementaire', 2).effet}`].join('\n'),
    AD22: `${torse.nom}, ${casque.nom}`,
    AA26: 'Targe', AF26: 'Bois ×1, Fer ×1',
    AD29: `Couronne\nCompétence : ${competenceA.libelle} = 7\n→ Équilibre`, AL29: 'Attributs : +10 Santé\nMaudit', AD32: 'Effet : Porte-bonheur',
    AL32: `Attaque : ${parCategorie.libelle}\n→ ÉPÉES`,
    AR29: 'Super fiole verte ×2', AR32: 'Ration',
    AA40: 'Briquet', AA41: 'Ration ×3', AG40: 'Corde (x2)', AG41: 'Perche (4)',
    AA55: 'Boule de feu', AY55: 3, AA56: 'Fer brûlant', AY56: 1,
    C71: 'Naissance', L71: 'À Champieu', L72: 'Une ligne sans titre',
    D14: '41 / 41', K14: '30 / 38', K15: '0 / 38',
    BA54: note,
  });
  const r = ficheDuClasseur(regles, feuille);
  const f = r.fiche;
  assert.deepEqual(r.nonRepris, []);
  assert.deepEqual(r.remarques, []);
  assert.deepEqual([f.nom, f.surnom, f.lieu_origine, f.race_id, f.magie_innee_id, f.ethnie_id, f.dieu_choisi_id, f.xp, f.mode_classe],
    ['Essai', 'Le Test', 'Champieu', 'races/humain', magie('Feu').id, 'races/humain#ethnie:humain-central', parNom(regles.dieux, 'Mirada').id, xpDuNiveau(5), 'mono']);
  assert.deepEqual([f.alignement_loyal, f.alignement_chaotique, f.alignement_bon, f.alignement_mauvais, f.bourse_pp, f.bourse_ro, f.bourse_rf], [8, 1, 2, 3, 1, 245, 50]);
  // la spécialité d'après la cartouche « Épéiste » (I9 vide) ; le don à choix Duelliste
  assert.deepEqual(f.classes, [{ rang: 1, classe_id: guerrier.id, specialite_id: guerrier.specialites.find((s) => cle(s.nom) === 'epeiste').id }]);
  assert.deepEqual(f.capacites, [{ capacite_id: don('Guerrier', 'Duelliste').id }]);
  assert.deepEqual(f.caracteristiques.map((c) => [c.base, c.croix]), [[3, 1], [2, 0], [2, 0], [2, 0], [3, 2], [3, 0]]);
  assert.deepEqual(f.metier_bonus, [{ rang: rangAChoisir.rang, competence_id: 'equilibre' }]);
  // l'acquis du joueur : 12 écrits − 2 du métier − 7 de l'accessoire
  const equilibre = competencesDe(regles, f).find((k) => k.id === 'equilibre');
  assert.deepEqual([equilibre.naturel, equilibre.acquis, equilibre.metier, equilibre.accessoire], [5, 12 - rangAChoisir.valeur - 7, rangAChoisir.valeur, 7]);
  assert.deepEqual(f.competences.find((c) => c.competence_id === 'arc'), { competence_id: 'arc', naturel: 10, acquis: 0 });
  // la note d'un classeur exporté avant la décision R73, niveau par niveau : sommée
  assert.deepEqual({ gains_sante: f.gains_sante, gains_chakra: f.gains_chakra }, lireGains(note.split('\n').find((l) => l.startsWith('Gains')).split(' : ').slice(1).join(' : ')));
  assert.deepEqual([f.gains_sante, f.gains_chakra], [30, 36]);
  assert.deepEqual(f.sorts, [
    { sort_id: sortDe('Feu', 'Boule de feu').id, rang: 1, niveau_maitrise: 3, nm_livre: 1, nm_cadeau: 1 },
    { sort_id: sortDe('Feu', 'Fer brûlant').id, rang: 2, niveau_maitrise: 1, nm_livre: 0, nm_cadeau: 0 },
    { sort_id: sortDe('Feu', 'Cautérisation').id, rang: 3, niveau_maitrise: 2, nm_livre: 0, nm_cadeau: 0 },
  ]);
  assert.deepEqual(f.armes, [{
    rang: 1, arme_id: epeeLongue.id, materiau_id: parNom(regles.materiaux_armes, 'Acier').id, amelioration_id: amelioration('arme', 2).id,
    arme_elementaire_id: epeeDeFeu.id, amelioration_elementaire_id: amelioration('arme_elementaire', 1).id, effet_en_plus: 'Première ligne\nSeconde ligne',
  }]);
  assert.deepEqual(f.armures, [
    { emplacement_id: 'casque', armure_id: casque.id, amelioration_id: null, armure_elementaire_id: elementaire.id, amelioration_elementaire_id: amelioration('armure_elementaire', 2).id },
    { emplacement_id: 'torse', armure_id: torse.id, amelioration_id: amelioration('armure', 1).id, armure_elementaire_id: null, amelioration_elementaire_id: null },
  ]);
  assert.equal(f.bouclier_classe_id, parNom(regles.boucliers, 'Targe').id);
  assert.deepEqual(f.bouclier_materiaux, [
    { rang: 1, materiau_id: parNom(regles.materiaux_bouclier, 'Bois').id, quantite: 1 }, { rang: 2, materiau_id: parNom(regles.materiaux_bouclier, 'Fer').id, quantite: 1 },
  ]);
  const vide = { nom: null, accessoire_effet_id: null, valeur: null, texte: null, maudit: 0, competence_id: null, arme_famille_id: null };
  assert.deepEqual(f.accessoires, [
    { ...vide, emplacement: 'chef', nom: 'Couronne', accessoire_effet_id: competenceA.id, valeur: 7, competence_id: 'equilibre' },
    { ...vide, emplacement: 'collier', accessoire_effet_id: effetDAccessoire('Attributs', '+10 Santé').id, maudit: 1 },
    { ...vide, emplacement: 'bracelet-1', texte: 'Porte-bonheur' },
    { ...vide, emplacement: 'bracelet-2', accessoire_effet_id: parCategorie.id, arme_famille_id: 'epees' },
    { ...vide, emplacement: 'ceinture', nom: 'Ceinture de force', accessoire_effet_id: effetDAccessoire('Caractéristique', 'Force').id },
    { ...vide, emplacement: 'autre', texte: 'Un porte-clé' },
  ]);
  const ressource = (nom) => regles.ressources.find((x) => x.nom === nom)?.id ?? null;
  assert.deepEqual(f.ceinture, [{ rang: 1, nom: 'Super fiole verte', quantite: 2, ressource_id: ressource('Super fiole verte') }, { rang: 2, nom: 'Ration', quantite: 1, ressource_id: ressource('Ration') }]);
  assert.deepEqual(f.inventaire.map((o) => [o.rang, o.nom, o.quantite, o.ressource_id]),
    [['Briquet', 1], ['Ration', 3], ['Corde', 2], ['Perche', 4], ['Lanterne', 2], ['Parchemin vierge', 1]].map(([nom, q], i) => [i + 1, nom, q, ressource(nom)]));
  assert.equal(f.evenements, 'Naissance : À Champieu\nUne ligne sans titre\nCinquième : au-delà de la case');
  assert.equal(f.notes, 'Mes notes\nsur deux lignes\nUne ligne que la page n’écrit pas');
  assert.deepEqual([f.sante_actuelle, f.chakra_actuel, f.corruption], [null, 30, null]);
  // les dégâts écrits ne sont pas relus : ceux du site
  assert.ok(degatsDArme(regles, f, 1));
});

test('modèle ordinateur : l’écriture de la page — accessoires sur une ligne, pièces d’armure, effet en plus avant le catalogue, choix du métier en tête', () => {
  const coursier = parNom(regles.metiers, 'Coursier');
  const rangAChoisir = coursier.bonus.find((b) => b.options.length > 1);
  const epeeLongue = parNom(regles.armes, 'Épée Longue');
  const competenceA = regles.accessoires.find((a) => a.propriete === 'competence' && a.caracteristique_id === 'agilite' && a.min <= 7 && a.max >= 7);
  const malediction = regles.accessoires.find((a) => a.propriete === 'attributs' && a.libelle === 'MALÉDICTION');
  const [torse, casque] = [regles.armures[0], regles.armures[1]];
  const complete = regles.armures.find((a) => a.id.endsWith('-complet') || /complète$/.test(a.nom));
  const elementaire = regles.armures_elementaires[0];
  // l'acquis d'Équilibre affiché : celui du métier et de l'accessoire de la case Chef (aucun du joueur)
  const base = { I2: 'Humain', S2: 'Feu', C41: 'Coursier', AA10: epeeLongue.nom, V33: rangAChoisir.valeur + 7 };
  const feuille = (valeurs) => ordinateur({ ...base, ...valeurs });
  // le choix du métier en tête de la case, les rangs sans choix et l'artisanat ensuite ; « → ? » : pas choisi
  const autres = coursier.bonus.filter((b) => b !== rangAChoisir).map((b) => b.texte);
  let r = ficheDuClasseur(regles, feuille({
    L41: [`${rangAChoisir.texte} → Équilibre`, ...autres, 'Artisanat : Livrer (Agilité + Perception) = 20 %'].join('\n'),
    // l'effet en plus, sur deux lignes, avant l'effet du catalogue (la part affichée, que le site refait)
    AA13: ['Composition : Acier', 'Effet en plus : Première ligne', 'Seconde ligne', epeeLongue.effet].join('\n'),
    AD29: `Couronne\n${competenceA.libelle} = 7 → Équilibre`, AL29: '+10 Santé\nMaudit', AD32: 'Attributs : MALÉDICTION', AL32: 'Attaque :',
    AQ21: [`Torse : ${torse.nom} · amél. niv. 1 (${amelioration('armure', 1).effet})`,
      `Casque : ${casque.nom} · élément ${elementaire.nom} · amél. élément niv. 2`].join('\n'),
  }));
  let f = r.fiche;
  // une fiche sans marqueur (faite à la main) : l'acquis écrit moins les bonus de la base (métier, accessoire rogné au plafond), dit par une remarque
  const equilibre = competencesDe(regles, f).find((k) => k.id === 'equilibre');
  assert.deepEqual(r.nonRepris, []);
  assert.deepEqual(r.remarques, [`Équilibre : acquis ${base.V33} du classeur − ${equilibre.metier} du métier Coursier (base) − ${equilibre.accessoire} de l'accessoire Chef = ${equilibre.acquis} au joueur`]);
  assert.equal(equilibre.acquis, base.V33 - equilibre.metier - equilibre.accessoire);
  assert.deepEqual(f.metier_bonus, [{ rang: rangAChoisir.rang, competence_id: 'equilibre' }]);
  assert.deepEqual(f.armes.map((a) => [a.materiau_id, a.effet_en_plus]), [[parNom(regles.materiaux_armes, 'Acier').id, 'Première ligne\nSeconde ligne']]);
  const vide = { nom: null, accessoire_effet_id: null, valeur: null, texte: null, maudit: 0, competence_id: null, arme_famille_id: null };
  assert.deepEqual(f.accessoires, [
    { ...vide, emplacement: 'chef', nom: 'Couronne', accessoire_effet_id: competenceA.id, valeur: 7, competence_id: 'equilibre' },
    { ...vide, emplacement: 'collier', accessoire_effet_id: effetDAccessoire('Attributs', '+10 Santé').id, maudit: 1 },
    { ...vide, emplacement: 'bracelet-1', accessoire_effet_id: malediction.id },
    { ...vide, emplacement: 'bracelet-2', accessoire_effet_id: regles.accessoires.find((a) => a.propriete_nom === 'Attaque' && !a.libelle).id },
  ]);
  assert.deepEqual(f.armures, [
    { emplacement_id: 'casque', armure_id: casque.id, amelioration_id: null, armure_elementaire_id: elementaire.id, amelioration_elementaire_id: amelioration('armure_elementaire', 2).id },
    { emplacement_id: 'torse', armure_id: torse.id, amelioration_id: amelioration('armure', 1).id, armure_elementaire_id: null, amelioration_elementaire_id: null },
  ]);
  // « MALÉDICTION » sans sa propriété : plusieurs effets, rien pour les départager (texte libre et une remarque) ; l'armure complète sans emplacement
  r = ficheDuClasseur(regles, feuille({ AD29: 'MALÉDICTION', AQ21: `${complete.nom} · amél. niv. 3` }));
  assert.deepEqual(r.fiche.accessoires.map((a) => [a.accessoire_effet_id, a.texte]), [[null, 'MALÉDICTION']]);
  assert.equal(r.remarques.length, 1);
  assert.deepEqual(r.fiche.armures, [{ emplacement_id: 'armure-complete', armure_id: complete.id, amelioration_id: amelioration('armure', 3).id, armure_elementaire_id: null, amelioration_elementaire_id: null }]);
  // l'effet en plus d'une case coupée par la page dans la part affichée (« … » sans suite dans la note) : relu sans le début de l'effet du catalogue
  const fiche = { ...ficheDuClasseur(regles, feuille({ AA13: 'Composition : Acier\nEffet en plus : Gravée' })).fiche };
  const affichees = partiesDeLArme(regles, fiche, 1).affichees.join('\n');
  for (const coupe of [`${affichees.slice(0, 12)}…`, `${affichees.slice(0, affichees.indexOf(' ', 8))} …`, '']) {
    r = ficheDuClasseur(regles, feuille({ AA13: `Composition : Acier\nEffet en plus : Gravée${coupe ? `\n${coupe}` : ' …'}` }));
    assert.equal(r.fiche.armes[0].effet_en_plus, 'Gravée', coupe);
  }
  // une pièce d'armure avec ses statistiques et l'effet de son amélioration, ou sans : la même
  const portee = { armures: [{ emplacement_id: 'torse', armure_id: torse.id, amelioration_id: amelioration('armure', 1).id }] };
  for (const options of [{}, { stats: false }, { stats: false, effets: false }]) {
    f = ficheDuClasseur(regles, feuille({ AQ21: lignesDArmure(regles, portee, options).join('\n') })).fiche;
    assert.deepEqual(f.armures.map((a) => [a.emplacement_id, a.armure_id, a.amelioration_id]), [['torse', torse.id, amelioration('armure', 1).id]], JSON.stringify(options));
  }
});

test('modèle ordinateur : débordements (dons, sorts, inventaire, événements) dans la note', () => {
  const feu = regles.sorts.filter((s) => s.magie_id === magie('Feu').id);
  const glace = regles.sorts.filter((s) => s.magie_id === magie('Glace').id);
  const sorts = [...feu, ...glace].slice(0, 22);
  // les dons débloqués au niveau 20 du Guerrier (ceux de la classe, la cartouche de l'Épéiste, une option de chaque choix) : les 5 premiers dans leurs
  // lignes, les autres dans la note (une classe qui en aurait plus de 7)
  const guerrier = classe('Guerrier');
  const epeiste = guerrier.specialites.find((s) => cle(s.nom) === 'epeiste');
  const choisis = guerrier.choix.filter((g) => g.specialite_id === epeiste.id).map((g) => g.options[0].id);
  const dons = guerrier.dons.filter((d) => d.nature === 'classe' || (d.nature === 'specialite' && d.specialite_id === epeiste.id) || choisis.includes(d.id));
  const dansLesLignes = 5;
  const valeurs = { I2: 'Humain', S2: 'Feu', S3: 'Glace', A9: guerrier.nom, I9: epeiste.nom, G9: 20, W8: 10 };
  ORDINATEUR.sorts.lignes.forEach((l, i) => Object.assign(valeurs, { [`AA${l}`]: sorts[i].nom, [`AY${l}`]: i % 4 }));
  DONS.classe1.slice(0, dansLesLignes).forEach((l, i) => { valeurs[`C${l}`] = dons[i].nom; });
  ORDINATEUR.inventaire.colonnes.forEach((c, j) => ORDINATEUR.inventaire.lignes.forEach((l, i) => { valeurs[`${c}${l}`] = `Objet ${j * 12 + i + 1}`; }));
  DONS.evenements.forEach((l, i) => { valeurs[`L${l}`] = `Événement ${i + 1}`; });
  valeurs.BA54 = [MARQUEUR_DES_NOTES, 'Bi-classé : non', `Dons de classe 1 (suite) : ${dons.slice(dansLesLignes).map((d) => d.nom).join(' ; ')}`,
    `Sorts (suite) : ${sorts.slice(20).map((s, i) => `${s.nom} (NM ${i + 1})`).join(' ; ')}`, 'Inventaire (suite) : Objet 49 ×2 ; Objet 50',
    'Événement : Événement 5', 'Événement : Événement 6'].join('\n');
  const r = ficheDuClasseur(regles, ordinateur(valeurs));
  assert.deepEqual(r.nonRepris, []);
  assert.deepEqual(r.fiche.sorts.map((s) => [s.sort_id, s.niveau_maitrise, s.rang]), sorts.map((s, i) => [s.id, i < 20 ? i % 4 : i - 19, i + 1]));
  assert.deepEqual(r.fiche.capacites.map((c) => c.capacite_id), dons.filter((d) => d.nature === 'choix').map((d) => d.id));
  assert.ok(dons.slice(dansLesLignes).some((d) => d.nature === 'choix'), 'un don à choix n’est que dans la note');
  assert.equal(r.fiche.inventaire.length, 50);
  assert.deepEqual(r.fiche.inventaire.slice(-3).map((o) => [o.nom, o.quantite]), [['Objet 48', 1], ['Objet 49', 2], ['Objet 50', 1]]);
  assert.equal(r.fiche.evenements, Array.from({ length: 6 }, (_, i) => `Événement ${i + 1}`).join('\n'));
});

test('modèle ordinateur : accessoires en lignes — effet introuvable, choix hors de la caractéristique, ligne de trop', () => {
  const r = ficheDuClasseur(regles, ordinateur({
    AD29: 'Défense : Une protection inventée', AL29: `Compétence : ${regles.accessoires.find((a) => a.id.endsWith('competence:force:1')).libelle} = 3\n→ Magie`,
    AD32: 'Bracelet de cuivre\nUne seconde ligne\nAttributs : +5 Santé', AL32: 'Bracelet sans effet', AD35: 'Attaque :',
  }));
  const parEmplacement = Object.fromEntries(r.fiche.accessoires.map((a) => [a.emplacement, a]));
  assert.equal(parEmplacement.chef.texte, 'Défense : Une protection inventée');
  assert.ok(r.remarques.includes('Accessoire Chef : « Défense : Une protection inventée » ne correspond à aucun effet de la table des accessoires : gardé en texte libre (non compté)'));
  assert.equal(parEmplacement.collier.competence_id, null);
  assert.ok(r.nonRepris.includes('Accessoire Collier : « Magie » introuvable parmi les compétences Force'));
  assert.equal(parEmplacement['bracelet-1'].nom, 'Bracelet de cuivre');
  assert.ok(r.nonRepris.includes('Accessoire Bracelet 1 : ligne « Une seconde ligne » sans place sur la fiche'));
  assert.equal(parEmplacement['bracelet-2'], undefined);
  // l'effet sans libellé d'une propriété (la page l'écrit « Attaque : ») : le seul de cette propriété
  const sansLibelle = regles.accessoires.filter((a) => a.propriete_nom === 'Attaque' && !a.libelle);
  assert.equal(sansLibelle.length, 1);
  assert.equal(parEmplacement['bague-1'].accessoire_effet_id, sansLibelle[0].id);
  assert.ok(r.nonRepris.includes('Accessoire Bracelet 2 : « Bracelet sans effet » sans effet'));
});

test('modèle ordinateur : le portrait ancré en A1, sauf le logo du modèle ; un portrait exporté par la page est gardé', () => {
  const logo = new Uint8Array([1, 2, 3]);
  const image = (description, octets = new Uint8Array([9, 9]), nom = 'Image') => ({ de: 'A1', a: 'E5', octets, type: 'image/png', nom, description });
  const lire = (img, options = {}) => ficheDuClasseur(regles, ordinateur({}, { images: [img] }), { logo, ...options });
  assert.equal(lire(image('', logo)).image, null, 'le logo du modèle, octet pour octet');
  assert.equal(lire(image('logo')).image, null, 'marqué « logo » par la page');
  assert.equal(lire(image('', new Uint8Array([9]), 'Logo')).image, null);
  const autre = image('Une photo');
  assert.equal(lire(autre).image, autre, 'une autre image : le portrait');
  const marque = image('portrait:abc', logo);
  assert.equal(lire(marque).image, marque, 'marqué « portrait », même identique au logo');
  assert.equal(lire(marque, { empreintePortrait: 'abc' }).portraitGarde, true);
  assert.equal(lire(marque, { empreintePortrait: 'xyz' }).portraitGarde, false);
  // une image ailleurs qu'en A1 n'est pas le portrait, et le dit ; une seconde image en A1 non plus
  const ailleurs = lire({ ...autre, de: 'B7' });
  assert.deepEqual([ailleurs.image, ailleurs.nonRepris], [null, ['Image en B7 non reprise : le portrait se place en A1']]);
  const deux = ficheDuClasseur(regles, ordinateur({}, { images: [image('', logo), autre, image('Une autre')] }), { logo });
  assert.deepEqual([deux.image, deux.nonRepris], [autre, ['Image en A1 non reprise : une seule image sert de portrait']]);
  assert.deepEqual(lire(image('logo')).nonRepris, [], 'le logo du modèle n’est pas une information');
  // la fiche auto : l'image (son logo) est ignorée
  const feuille = feuilleDeGrille(LOUISE);
  feuille.images = [autre];
  assert.equal(ficheDuClasseur(regles, feuille).image, null);
});

// ------------------------------------------------------------------ anciennes graphies, homonymes

test('anciennes graphies : retrouvées par le dernier segment de l’identifiant (les corrections d’orthographe l’ont gardé)', () => {
  const bordeaux = regles.ethnies.find((e) => e.id.endsWith(':drakos-bordeau'));
  const contrecoup = classe('Guerrier').dons.find((d) => d.id.endsWith('-contre-coup'));
  const vagueDeCadavres = regles.sorts.find((s) => s.id.endsWith(':vague-de-cadavre'));
  const pavois = regles.boucliers.find((b) => b.id === 'pavoi');
  const athee = regles.dieux.find((d) => d.id === 'atheiste');
  for (const [nom, ancien] of [[bordeaux.nom, 'Drakos Bordeau'], [contrecoup.nom, 'Contre coup'], [vagueDeCadavres.nom, 'Vague de cadavre'], [pavois.nom, 'Pavoi'], [athee.nom, 'Athéiste']]) {
    assert.notEqual(cle(nom), cle(ancien), `${ancien} n’est plus le nom de la base`);
  }
  const guerrier = classe('Guerrier');
  const maitreDArme = guerrier.specialites.find((s) => s.id === contrecoup.specialite_id);
  let r = ficheDuClasseur(regles, ordinateur({
    I2: 'Drakos', S2: magie('Sang').nom, C40: 'Drakos Bordeau', S5: 'Athéiste', A9: guerrier.nom, I9: maitreDArme.nom, G9: 20, W8: 10, C43: 'Contre coup', AA26: 'Pavoi',
  }));
  const f = r.fiche;
  assert.deepEqual([f.ethnie_id, f.dieu_choisi_id, f.bouclier_classe_id], [bordeaux.id, athee.id, pavois.id]);
  assert.deepEqual(f.capacites, [{ capacite_id: contrecoup.id }]);
  assert.deepEqual(r.nonRepris, []);
  r = ficheDuClasseur(regles, ordinateur({ I2: 'Humain', S2: magie('Nécromancie').nom, AA55: 'Vague de cadavre', AY55: 1 }));
  assert.deepEqual(r.fiche.sorts.map((s) => s.sort_id), [vagueDeCadavres.id]);
  assert.deepEqual(r.nonRepris, []);
  // « Magie de la Nécromancie » : le nom de la page de la magie
  assert.equal(ficheDuClasseur(regles, ordinateur({ S2: 'Magie de la Nécromancie' })).fiche.magie_innee_id, magie('Nécromancie').id);
});

test('homonymes : un don cherché dans sa classe, « Vague déferlante » départagée par ce qu’écrit sa ligne, deux armes du même nom', () => {
  // « Contre-attaque » : un don du Guerrier (Épéiste) et du Pugiliste (Cogneur) ; la classe de la ligne décide, et donne la spécialité
  const [guerrier, pugiliste] = [classe('Guerrier'), classe('Pugiliste')];
  const [dG, dP] = [guerrier, pugiliste].map((k) => k.dons.find((d) => cle(d.nom) === 'contre-attaque'));
  let r = ficheDuClasseur(regles, ordinateur({ I2: 'Humain', S2: 'Feu', A9: guerrier.nom, A11: pugiliste.nom, G9: 20, G11: 20, W8: 20, C43: dG.nom, C57: dP.nom,
    S11: String(xpDuNiveau(20)), BA54: `${MARQUEUR_DES_NOTES}\nBi-classé : oui` }));
  assert.equal(r.fiche.mode_classe, 'bi');
  assert.deepEqual(r.fiche.capacites.map((c) => c.capacite_id), [dG.id, dP.id]);
  assert.deepEqual(r.fiche.classes.map((c) => c.specialite_id), [dG.specialite_id, dP.specialite_id]);

  // « Vague déferlante » (Corruption et Arcane) pour un Potentiel Illimité : la ligne de la Corruption écrit en plus « Si CR = … »
  const vagues = regles.sorts.filter((s) => cle(s.nom) === 'vague-deferlante');
  assert.equal(vagues.length, 2);
  const description = (s, nm) => [valeurAuNm(s.dsb, s.bonus, 'dsb', nm), valeurAuNm(s.effets, s.bonus, 'effets', nm)].join('\n');
  const pi = { I2: 'Humain', S2: magie('Potentiel Illimité').nom, W8: 10 };
  for (const s of vagues) {
    r = ficheDuClasseur(regles, ordinateur({ ...pi, AA55: s.nom, AY55: 1, AM55: description(s, 1) }));
    assert.deepEqual(r.fiche.sorts.map((x) => x.sort_id), [s.id], s.id);
    assert.deepEqual(r.nonRepris, []);
  }
  // une description coupée par la page (« … », sans suite : un texte affiché) départage encore, par ses lignes entières et le début de la dernière ;
  // coupée avant ce qui les distingue, plus rien ne le fait
  const corruption = vagues.find((s) => s.id.includes('corruption'));
  const d = description(corruption, 1);
  assert.match(d.split('\n').at(-1), /^Si CR = /);
  r = ficheDuClasseur(regles, ordinateur({ ...pi, AA55: corruption.nom, AY55: 1, AM55: `${d.slice(0, d.lastIndexOf('\n') + 6)}…` }));
  assert.deepEqual(r.fiche.sorts.map((x) => x.sort_id), [corruption.id], '« Si CR… »');
  r = ficheDuClasseur(regles, ordinateur({ ...pi, AA55: corruption.nom, AY55: 1, AM55: `${d.slice(0, d.indexOf('\n') + 12)} …` }));
  assert.deepEqual(r.fiche.sorts, [], 'coupée avant « Si CR »');
  // la description telle que la page l'écrit (une rangée : ses lignes séparées par « · »), entière ou coupée
  const enLigne = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean).join(SEPARATEUR_EN_LIGNE);
  for (const s of vagues) {
    r = ficheDuClasseur(regles, ordinateur({ ...pi, AA55: s.nom, AY55: 1, AM55: enLigne(description(s, 1)) }));
    assert.deepEqual(r.fiche.sorts.map((x) => x.sort_id), [s.id], `${s.id} (sur une ligne)`);
  }
  const d1 = enLigne(d);
  r = ficheDuClasseur(regles, ordinateur({ ...pi, AA55: corruption.nom, AY55: 1, AM55: `${d1.slice(0, d1.lastIndexOf(SEPARATEUR_EN_LIGNE) + 8)}…` }));
  assert.deepEqual(r.fiche.sorts.map((x) => x.sort_id), [corruption.id], '« Si CR… » (sur une ligne)');
  r = ficheDuClasseur(regles, ordinateur({ ...pi, AA55: vagues[0].nom, AY55: 1 }));
  assert.deepEqual(r.fiche.sorts, []);
  assert.match(r.nonRepris[0], /^Sort : « Vague déferlante » désigne plusieurs entrées des règles \(Vague déferlante \(.+\), Vague déferlante \(.+\)\), rien dans le classeur pour les départager$/);
  // pour une magie acquise seule, pas d'homonyme : celui de la magie du personnage
  r = ficheDuClasseur(regles, ordinateur({ I2: 'Humain', S2: 'Feu', S3: 'Arcane', AA55: vagues[0].nom, AY55: 0 }));
  assert.deepEqual(r.fiche.sorts.map((x) => x.sort_id), [vagues.find((s) => s.magie_id === magie('Arcane').id).id]);

  // armes de deux familles : « Étendard de guerre » départagé par l'effet du catalogue écrit, « Crochet grappin » (même effet) par les dégâts écrits
  const etendards = regles.armes.filter((a) => a.nom === 'Étendard de guerre');
  assert.equal(etendards.length, 2);
  for (const a of etendards) {
    r = ficheDuClasseur(regles, ordinateur({ AA10: a.nom, AA13: `Composition : Fer\n${a.effet}` }));
    assert.deepEqual(r.fiche.armes.map((x) => x.arme_id), [a.id]);
    // coupé par la page : le début de son effet
    r = ficheDuClasseur(regles, ordinateur({ AA10: a.nom, AA13: `Composition : Fer\n${a.effet.slice(0, a.effet.lastIndexOf(' ', 30))} …` }));
    assert.deepEqual(r.fiche.armes.map((x) => x.arme_id), [a.id], 'effet coupé');
  }
  const crochets = regles.armes.filter((a) => a.nom === 'Crochet grappin');
  assert.deepEqual([crochets.length, crochets[0].effet === crochets[1].effet], [2, true]);
  const hache = MAITRISES.find((m) => m.famille === 'hache');
  const avecHache = { AA10: 'Crochet grappin', AA13: crochets[0].effet };
  const remplis = Object.fromEntries(casesDesDes(hache).slice(0, 2).map((a) => [a, '808080']));
  const dHache = crochets.find((a) => a.famille_id === 'hache');
  const fiche = { ...ficheDuClasseur(regles, ordinateur({}, { remplis })).fiche };
  const degats = degatsDArme(regles, { ...fiche, armes: [{ rang: 1, arme_id: dHache.id, materiau_id: regles.materiau_arme_defaut }] }, 1).texte;
  r = ficheDuClasseur(regles, ordinateur({ ...avecHache, AG10: degats }, { remplis }));
  assert.deepEqual(r.fiche.armes.map((x) => x.arme_id), [dHache.id]);
  r = ficheDuClasseur(regles, ordinateur(avecHache));
  assert.deepEqual(r.fiche.armes, []);
  assert.match(r.nonRepris[0], /^Arme 1 : « Crochet grappin » désigne plusieurs entrées des règles/);
});

// ------------------------------------------------------------------ rien ne se perd sans être dit

/** Le classeur que la page écrit pour une fiche (lib/fiche-tableur-export.mjs, sans zones : rien de coupé) sur le modèle vierge, des cases changées ensuite. */
function deLaPage(fiche, changements = {}) {
  const { cellules, remplis } = cellulesDeLaFiche(regles, fiche, { date: '15/10/2026' });
  return ordinateur({ ...cellules, ...changements }, { remplis });
}
const epeeLongue = () => parNom(regles.armes, 'Épée Longue');

test('effet d’une arme (AA13) : une ligne sans clé est de l’effet en plus (le titre du modèle) ; dite par une remarque dans un classeur fait à la main', () => {
  const epee = epeeLongue();
  const lire = (AA13) => ficheDuClasseur(regles, ordinateur({ I1: 'X', AA10: epee.nom, AA13 }));
  let r = lire('Lame empoisonnée +1D4');
  assert.deepEqual([r.fiche.armes[0].effet_en_plus, r.nonRepris], ['Lame empoisonnée +1D4', []]);
  assert.deepEqual(r.remarques, [`Arme 1 (${epee.nom}) : ligne « Lame empoisonnée +1D4 » reprise comme effet en plus`]);
  r = lire('Lame empoisonnée\nBrille dans le noir');
  assert.equal(r.fiche.armes[0].effet_en_plus, 'Lame empoisonnée\nBrille dans le noir');
  assert.deepEqual(r.remarques, [`Arme 1 (${epee.nom}) : lignes « Lame empoisonnée », « Brille dans le noir » reprises comme effet en plus`]);
  r = lire('Effet en plus : brûle');
  assert.deepEqual([r.fiche.armes[0].effet_en_plus, r.remarques], ['brûle', []]);
  // l'effet du catalogue recopié par le joueur : de la part affichée, pas de l'effet en plus
  r = lire(`Composition : Acier\n${epee.effet}\nGravée`);
  assert.deepEqual([r.fiche.armes[0].materiau_id, r.fiche.armes[0].effet_en_plus], [parNom(regles.materiaux_armes, 'Acier').id, 'Gravée']);

  // un classeur de la page (deux armes : « Deux armes » sous l'effet du catalogue), une ligne ajoutée à la fin, au début, ou un « Effet en plus : » à la fin
  const fiche = { ...ficheVide('Site'), race_id: 'races/humain', magie_innee_id: magie('Feu').id,
    armes: [{ rang: 1, arme_id: epee.id, materiau_id: parNom(regles.materiaux_armes, 'Acier').id }, { rang: 2, arme_id: parNom(regles.armes, 'Dague').id, materiau_id: regles.materiau_arme_defaut }] };
  const ecrit = cellulesDeLaFiche(regles, fiche).cellules.AA13;
  assert.match(ecrit, /\nDeux armes : /);
  for (const [AA13, attendu] of [[`${ecrit}\nForgée par mon père`, 'Forgée par mon père'], [`Forgée par mon père\n${ecrit}`, 'Forgée par mon père'],
    [`${ecrit}\nEffet en plus : Forgée par mon père`, 'Forgée par mon père'], [ecrit, null]]) {
    r = ficheDuClasseur(regles, deLaPage(fiche, { AA13 }));
    assert.deepEqual([r.fiche.armes[0].effet_en_plus, r.fiche.armes[0].materiau_id, r.nonRepris, r.remarques], [attendu, fiche.armes[0].materiau_id, [], []], AA13);
  }
  // l'effet du catalogue a changé depuis l'export (les armes se modifient sur le site de dev) : l'ancien texte, qui n'est plus la part affichée, est repris
  // comme effet en plus, et dit
  const changees = structuredClone(regles);
  changees.armes.find((a) => a.id === epee.id).effet = 'Un effet réécrit sur le site de dev';
  r = ficheDuClasseur(changees, deLaPage(fiche));
  const ancien = epee.effet.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.equal(r.fiche.armes[0].effet_en_plus, ancien.join('\n'));
  assert.deepEqual(r.remarques, [`Arme 1 (${epee.nom}) : ligne${ancien.length > 1 ? 's' : ''} ${ancien.map((l) => `« ${l} »`).join(', ')} reprise${ancien.length > 1 ? 's' : ''} comme effet en plus (la case ne porte plus ce que le site y écrit pour cette arme)`]);
});

test('armure (modèle ordinateur) : AD22 toujours lue ; une ligne de « Bonus/ Malus » qui n’est pas une pièce part dans les notes ; un désaccord est dit', () => {
  const [a1, a2] = [regles.armures[1], regles.armures[2]];
  const complete = (id) => [{ emplacement_id: 'armure-complete', armure_id: id, amelioration_id: null, armure_elementaire_id: null, amelioration_elementaire_id: null }];
  let r = ficheDuClasseur(regles, ordinateur({ AD22: a1.nom }));
  assert.deepEqual([r.fiche.armures, r.nonRepris, r.remarques], [complete(a1.id), [], []]);
  for (const bonus of ['+2 AP (forgeron)', 'Malus : -10% discrétion']) {
    r = ficheDuClasseur(regles, ordinateur({ AD22: a1.nom, AQ21: bonus }));
    assert.deepEqual([r.fiche.armures, r.nonRepris], [complete(a1.id), [`Bonus/Malus de l'armure : « ${bonus} » sans place sur le site`]], bonus);
  }
  // un classeur de la page : AD22 réécrite (une autre armure) ; les pièces de AQ21 sont reprises, et une remarque le dit
  const torse = { ...ficheVide('Armure'), armures: [{ emplacement_id: 'torse', armure_id: a1.id }] };
  r = ficheDuClasseur(regles, deLaPage(torse));
  assert.deepEqual([r.fiche.armures.map((x) => [x.emplacement_id, x.armure_id]), r.nonRepris, r.remarques], [[['torse', a1.id]], [], []]);
  r = ficheDuClasseur(regles, deLaPage(torse, { AD22: a2.nom }));
  assert.deepEqual(r.fiche.armures.map((x) => [x.emplacement_id, x.armure_id]), [['torse', a1.id]]);
  assert.deepEqual(r.remarques, [`Armure : « ${a2.nom} » (Nom Armure) ne correspond pas aux pièces de la case Bonus/Malus (${a1.nom}) : les pièces sont reprises`]);
  // l'armure complète de la page : AD22 et sa ligne sans emplacement d'accord ; une pièce avec, une ligne de bonus en plus
  const entiere = { ...ficheVide('Complète'), armures: [{ emplacement_id: 'armure-complete', armure_id: a2.id }, { emplacement_id: 'casque', armure_id: a1.id }] };
  r = ficheDuClasseur(regles, deLaPage(entiere));
  assert.deepEqual([r.fiche.armures.map((x) => x.armure_id), r.nonRepris, r.remarques], [[a2.id, a1.id], [], []]);
  // « Nom Armure » d'une liste de pièces n'est qu'affiché : coupé par la page (« … »), son début s'accorde aux pièces
  const deux = { ...ficheVide('Pièces'), armures: [{ emplacement_id: 'torse', armure_id: a1.id }, { emplacement_id: 'casque', armure_id: a2.id }] };
  const liste = `${a2.nom}, ${a1.nom}`;
  assert.equal(cellulesDeLaFiche(regles, deux).cellules.AD22, liste, 'dans l’ordre des emplacements');
  assert.deepEqual(ficheDuClasseur(regles, deLaPage(deux, { AD22: `${liste.slice(0, a2.nom.length + 2)}…` })).remarques, []);
  assert.equal(ficheDuClasseur(regles, deLaPage(deux, { AD22: 'Autre chose …' })).remarques.length, 1);
  r = ficheDuClasseur(regles, deLaPage(entiere, { AQ21: `${cellulesDeLaFiche(regles, entiere).cellules.AQ21}\n+2 AP (forgeron)` }));
  assert.deepEqual([r.fiche.armures.map((x) => x.armure_id), r.nonRepris], [[a2.id, a1.id], ['Bonus/Malus de l\'armure : « +2 AP (forgeron) » sans place sur le site']]);
});

test('nombres : « 20% » se lit 20 (le tableur en garde 0,2) ; un décimal là où la fiche veut un entier est arrondi vers le bas, et dit', () => {
  assert.equal(nombreDe({ valeur: 0.2, texte: '20%' }), 20);
  assert.equal(nombreDe({ valeur: 0.05, texte: '5 %' }), 5);
  assert.equal(nombreDe({ valeur: 12.5, texte: '12,5' }), 12.5);
  assert.equal(nombreDe('12,5'), 12.5);
  assert.equal(nombreDe({ valeur: 1, texte: '100%' }), 100);
  const r = ficheDuClasseur(regles, ordinateur({
    I2: 'Humain', S2: 'Feu', G22: { valeur: 0.2, texte: '20%' }, I22: { valeur: 0.05, texte: '5%' }, Q6: { valeur: 12.5, texte: '12,5' }, L6: 3,
    E18: { valeur: 2.7, texte: '2,7' }, AA55: sortDe('Feu', 'Boule de feu').nom, AY55: { valeur: 1.5, texte: '1,5' },
  }));
  const f = r.fiche;
  assert.deepEqual(f.competences.find((c) => c.competence_id === 'arc'), { competence_id: 'arc', naturel: 20, acquis: 5 });
  assert.deepEqual([f.bourse_pp, f.bourse_ro, f.caracteristiques.find((c) => c.caracteristique_id === 'force').base, f.sorts[0].niveau_maitrise], [3, 12, 2, 1]);
  assert.deepEqual(r.remarques, ['Bourse (or) : « 12,5 » lu 12', 'Force (base) : « 2,7 » lu 2', `Sort « ${sortDe('Feu', 'Boule de feu').nom} » (NM) : « 1,5 » lu 1`]);
  // fiche auto : une quantité décimale
  const louise = importer(avec(LOUISE, { AA46: 'Corde', AF46: '2,5' }));
  assert.deepEqual(louise.fiche.inventaire.find((o) => o.nom === 'Corde').quantite, 2);
  assert.ok(louise.remarques.includes('Quantité de « Corde » : « 2,5 » lu 2'));
});

test('zones de saisie que le site ne garde pas (solidité, armure par pièce, bouclier, sac, entraînement) : leur valeur dans nonRepris ; le type d’un événement', () => {
  // les textes du modèle (« / ») ne sont pas des valeurs
  for (const s of SAISIES_SANS_PLACE) assert.equal(VIERGE.cellules.get(s.adresse)?.texte ?? '', s.modele, s.adresse);
  assert.equal(VIERGE.cellules.get(ORDINATEUR.inventaire.titre).texte, TITRE_DE_L_INVENTAIRE);
  assert.equal(SAISIES_SANS_PLACE.length, 2 + 6 * 3 + 3);
  const epee = epeeLongue();
  const r = ficheDuClasseur(regles, ordinateur({
    AA10: epee.nom, AK17: '12 / 15', AI22: 5, AJ23: 1, AN24: '10/10', AA26: regles.boucliers[0].nom, AN26: 4, AS26: 2, AX26: '20 / 20',
    AA38: 'INVENTAIRE | SAC = Sac à dos', C71: 'Malédiction du sorcier', I71: 'Passif', L71: '-2 en Social', I72: 'Actif', L72: 'Sans titre', L42: '2 Magie',
  }));
  const emplacement = (id) => regles.emplacements_armure.find((e) => e.id === id).nom;
  assert.deepEqual(r.nonRepris, [
    'Solidité de l’arme 1 : « 12 / 15 » sans place sur le site', `Armure, ${emplacement('casque')} (AP) : « 5 » sans place sur le site`,
    `Armure, ${emplacement('torse')} (AM) : « 1 » sans place sur le site`, `Armure, ${emplacement('jambe-droit')} (solidité) : « 10/10 » sans place sur le site`,
    'Bouclier, armure physique : « 4 » sans place sur le site', 'Bouclier, armure magique : « 2 » sans place sur le site',
    'Bouclier, solidité : « 20 / 20 » sans place sur le site', 'Inventaire, sac : « Sac à dos » sans place sur le site', 'Entraînement : « 2 Magie » sans place sur le site',
  ]);
  assert.equal(r.fiche.evenements, 'Malédiction du sorcier (Passif) : -2 en Social\n(Actif) : Sans titre');
  // fiche auto : le type d'un événement aussi
  assert.equal(importer(avec(LOUISE, { C71: 'Titre', I71: 'Actif', L71: 'Texte', C72: '', I72: 'Réaction' })).fiche.evenements, 'Titre (Actif) : Texte\n(Réaction)');
  assert.deepEqual(ficheDuClasseur(regles, ordinateur({ AA38: 'INVENTAIRE | SAC = ' })).nonRepris, [], 'le titre du modèle, rien après « = »');
});

test('ce qui a pu se perdre avant l’import : case relue finie par « … » sans sa suite, case coupée à la lecture, case NOTE pleine', () => {
  const fiche = { ...ficheVide('Coupée'), evenements: 'Rencontre : un long texte' };
  const attendue = 'Case L71 : « … » final sans ligne « Suite de la case L71 » dans la note : la fin de la case a été perdue, sauf si le « … » fait partie du texte';
  // la note n'est pas pleine : le « … » est celui du joueur (« le Taciturne… »), rien n'a pu se perdre
  assert.deepEqual(ficheDuClasseur(regles, deLaPage(fiche, { L71: 'un long tex…' })).remarques, []);
  assert.deepEqual(ficheDuClasseur(regles, deLaPage(fiche)).remarques, []);
  assert.deepEqual(ficheDuClasseur(regles, ordinateur({ C71: 'Rencontre', L71: 'un long tex…' })).remarques, [], 'un classeur fait à la main : son « … »');
  // une case que la lecture du classeur a coupée (lib/tableur-lecture.mjs : `tronquee`)
  assert.deepEqual(ficheDuClasseur(regles, ordinateur({ AA40: { valeur: 'Corde', texte: 'Corde', tronquee: true } })).remarques,
    ['Case AA40 : trop longue, coupée à la lecture du classeur ; sa fin n\'est pas reprise']);
  // la case NOTE de 32 767 caractères finie par « … » : coupée par le tableur, ses dernières lignes perdues
  const pleine = `${'x'.repeat(LONGUEUR_MAX_D_UNE_CASE - 1)}…`;
  assert.deepEqual(ficheDuClasseur(regles, ordinateur({ BA54: pleine })).remarques,
    [`Case NOTE (BA54) : ${enChiffres(LONGUEUR_MAX_D_UNE_CASE)} caractères finis par « … », la limite d'une case de tableur : sa fin a été coupée et n'est pas reprise`]);
  // des notes raccourcies par la page (lib/fiche-tableur-export.mjs#texteDeLaNote) : les données relues entières, et une remarque
  const longue = { ...fiche, xp: regles.niveaux.find((n) => n.niveau === 5).xp_min, mode_classe: 'mono', gains_sante: 64, gains_chakra: 0, notes: 'n'.repeat(40_000) };
  const r = ficheDuClasseur(regles, deLaPage(longue));
  assert.deepEqual([r.fiche.gains_sante, r.fiche.gains_chakra], [64, 0], 'les gains de niveau relus, pas reconstitués');
  assert.ok(r.fiche.notes.endsWith('n…') && r.fiche.notes.length < 40_000);
  const raccourcies = `Notes : raccourcies à l'export (la case NOTE est pleine : ${enChiffres(LONGUEUR_MAX_D_UNE_CASE)} caractères) ; leur fin n'est pas dans le classeur`;
  assert.deepEqual(r.remarques, [raccourcies]);
  // des notes raccourcies laissent les données entières : un « … » final reste celui du joueur
  assert.deepEqual(ficheDuClasseur(regles, deLaPage(longue, { L71: 'un long tex…' })).remarques, [raccourcies]);
  // des lignes de données retirées d'une note pleine (un inventaire démesuré) ont pu emporter la suite d'une case : son « … » final est signalé
  const demesure = { ...fiche, inventaire: Array.from({ length: 4000 }, (_, i) => ({ rang: i + 1, nom: `Objet numéro ${i + 1}`, quantite: 1, ressource_id: null })) };
  const remarques = ficheDuClasseur(regles, deLaPage(demesure, { L71: 'un long tex…' })).remarques;
  assert.deepEqual(remarques, [
    'Note : une ligne de données retirée à l\'export, la case NOTE étant pleine : ce qu\'elle portait n\'est pas repris', attendue]);
});

test('maîtrises (modèle ordinateur) : un fond commun à toutes les cases de dés n’est pas un dé atteint ; un .csv sans marque le dit', () => {
  const cases = MAITRISES.flatMap(casesDesDes);
  assert.deepEqual(ficheDuClasseur(regles, ordinateur({}, { remplis: Object.fromEntries(cases.map((a) => [a, 'FFF2CC'])) })).fiche.maitrises_armes, [], 'un fond de bloc');
  // le gris de la page sur toutes les cases : tous les dés
  const max = maitriseDArme(regles).desMax;
  assert.ok(ficheDuClasseur(regles, ordinateur({}, { remplis: Object.fromEntries(cases.map((a) => [a, '808080'])) })).fiche.maitrises_armes.every((m) => m.des === max));
  // un fond de bloc et des marques : les marques
  const epees = MAITRISES.find((m) => m.famille === 'epees');
  const f = ficheDuClasseur(regles, ordinateur({ [casesDesDes(epees)[0]]: '2d ✔' }, { remplis: Object.fromEntries(cases.map((a) => [a, 'FFF2CC'])) })).fiche;
  assert.deepEqual(f.maitrises_armes, [{ arme_famille_id: 'epees', des: 2 }]);
  // un .csv au modèle ordinateur : les couleurs n'y sont pas ; sans marque écrite, une remarque (la page passe le format du fichier)
  assert.deepEqual(ficheDuClasseur(regles, ordinateur(), { format: 'csv' }).remarques, [REMARQUE_MAITRISES_CSV]);
  assert.deepEqual(ficheDuClasseur(regles, ordinateur({ [casesDesDes(epees)[0]]: '✔' }), { format: 'csv' }).remarques, []);
  assert.deepEqual(ficheDuClasseur(regles, ordinateur(), { format: 'xlsx' }).remarques, []);
  assert.deepEqual(importer(LOUISE, { format: 'csv' }).remarques.filter((x) => x === REMARQUE_MAITRISES_CSV), [], 'la fiche auto écrit ses dés');
});

test('élément d’armure de la fiche auto (le nom d’une magie) : retrouvé par la magie (armure_elementaire.magie_id) et la catégorie de l’armure, même renommée', () => {
  // la magie renommée sur le site de dev (son identifiant ne change pas) : le classeur écrit son nouveau nom
  const renommees = structuredClone(regles);
  const necro = renommees.magies.find((m) => m.id === magie('Nécromancie').id);
  necro.nom = 'Art des morts';
  const r = ficheDuClasseur(renommees, feuilleDeGrille(avec(LUCIEN, { S2: 'Art des morts', AS21: 'Art des morts' })));
  const armure = renommees.armures.find((a) => a.id === r.fiche.armures[0].armure_id);
  const element = renommees.armures_elementaires.find((x) => x.magie_id === necro.id && x.categorie === armure.type);
  assert.equal(r.fiche.armures[0].armure_elementaire_id, element.id);
  assert.ok(r.remarques.includes(`Élément d'armure déduit de la magie « Art des morts » et de la catégorie « ${armure.type} » : ${element.nom}`));
  assert.deepEqual(r.nonRepris, []);
});

test('gains de niveau reconstitués : les bornes du dé lues dans le texte du niveau ; un texte illisible, pas de reconstitution et une remarque', () => {
  assert.deepEqual(bornesDuDe('1d8 santé OU 1d8 chakra OU 1d4 pour les deux'), { min: 1, max: 8 }, 'le plus grand dé écrit');
  assert.deepEqual(bornesDuDe('2d6'), { min: 2, max: 12 });
  assert.equal(bornesDuDe('un dé au choix'), null);
  // les dés des règles du moment : des bornes lues
  for (const n of regles.niveaux.filter((x) => x.de_attributs_bonus)) assert.ok(bornesDuDe(n.de_attributs_bonus), n.niveau);
  // un d12 : 12 par dé, ce que le d8 ne permet pas
  const f = importer(LOUISE).fiche;
  const sans = attributsDe(regles, { ...f, gains_sante: 0, gains_chakra: 0 });
  const attendue = M.progressionAttendue(regles, M.niveauGlobal(regles, f.xp));
  const points = attendue.reduce((s, n) => s + n.points, 0);
  const des = attendue.filter((n) => n.de).length;
  assert.ok(des >= 1);
  const [maxSante, maxChakra] = [sans.sante + points, sans.chakra + 12 * des];
  assert.equal(gainsReconstitues(regles, f, maxSante, maxChakra), null, '1d8 : pas plus de 8 par dé');
  const d12 = structuredClone(regles);
  for (const n of d12.niveaux) if (n.de_attributs_bonus) n.de_attributs_bonus = '1d12 santé OU 1d12 chakra';
  const gains = gainsReconstitues(d12, f, maxSante, maxChakra);
  assert.deepEqual(gains.filter((g) => g.de_choix).map((g) => [g.de_choix, g.de_resultat]), Array.from({ length: des }, () => ['chakra', 12]));
  // un dé qui ne se lit pas : rien de reconstitué, une remarque avec les maximums
  const illisible = structuredClone(regles);
  const n5 = illisible.niveaux.find((n) => n.de_attributs_bonus);
  n5.de_attributs_bonus = 'un dé au choix';
  const r = ficheDuClasseur(illisible, feuilleDeGrille(LOUISE));
  assert.deepEqual([r.fiche.gains_sante, r.fiche.gains_chakra], [0, 0]);
  assert.ok(r.remarques.includes(`Gains de niveau non reconstitués : le dé du niveau ${n5.niveau} (« un dé au choix ») ne se lit pas ; maximums du classeur (santé ${lue(LOUISE, 'F14')}, chakra ${lue(LOUISE, 'M14')}) : à saisir`));
});

test('cases de 32 767 caractères faites surtout d’espaces : l’import reste linéaire (moins de 5 s pour une dizaine de cases)', () => {
  const s = `a${' '.repeat(LONGUEUR_MAX_D_UNE_CASE - 2)}b`;
  const feuille = ordinateur({
    I1: 'Espaces', AD29: s, AL29: `Attributs :${s}`, AA40: s, AA41: `${s}×3`, AA42: `(${s}`, AR29: s, AA10: epeeLongue().nom, AA13: `Effet en plus :${s}\n${s}`,
    AQ21: `Torse :${s}·${s}`, C41: 'Coursier', L41: `${s}→${s}`, AA55: s, C71: s, L42: s, AK17: s,
    BA54: [MARQUEUR_DES_NOTES, `Gains de niveau : niv. 2 : dé${s}`, `Sorts (suite) : ${s}`, `NM offerts : ${s}`].join('\n'),
  });
  const debut = performance.now();
  const r = ficheDuClasseur(regles, feuille);
  const ms = performance.now() - debut;
  assert.ok(ms < 5000, `${Math.round(ms)} ms`);
  assert.ok(r.nonRepris.length > 0);
  // et une fiche auto aux noms d'arme pleins d'espaces
  const debutAuto = performance.now();
  importer(avec(LOUISE, { AA10: `Épée${' '.repeat(30_000)}(une main${' '.repeat(30_000)}`, L42: `1${' '.repeat(30_000)}2` }));
  // une amélioration « +5 » suivie d'espaces et d'un mot, une ligne « Entraînement » au nombre suivi d'espaces et de deux lignes
  const espaces = ' '.repeat(39_000);
  importer(avec(LOUISE, { AI13: `+5${espaces}x`, AV13: `+5${espaces}x`, AT20: `+4${espaces}x`, AX21: `+5${espaces}x`, L42: `5${espaces}a\nb` }));
  assert.ok(performance.now() - debutAuto < 5000);
});
