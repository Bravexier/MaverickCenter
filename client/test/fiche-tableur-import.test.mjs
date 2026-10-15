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
import { attributsDe, competencesDe, degatsDArme, maitriseDArme, trouver } from '../src/lib/fiche-moteur.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';
import {
  AUTO, CASES_CARACTERISTIQUES, CASES_COMPETENCES, casesDesDes, cle, DONS, MAITRISES, MARQUEUR_DES_NOTES, ORDINATEUR,
} from '../src/lib/fiche-tableur-cases.mjs';
import {
  acquisDeLEntrainement, ERREUR_DISPOSITION, estCoche, feuilleDeGrille, ficheDuClasseur, lireLaNote, nombreDe, paireDe, porteUneMarque,
} from '../src/lib/fiche-tableur-import.mjs';
import { lignesDArmure, lireGains, partiesDeLArme } from '../src/lib/fiche-tableur-export.mjs';
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

/** Le modèle vierge avec des cases écrites ({ A1: texte | nombre }) et des fonds ({ A1: 'RRGGBB' }). */
function ordinateur(valeurs = {}, { remplis = {}, images = [] } = {}) {
  const cellules = new Map(VIERGE.cellules);
  for (const [a, v] of Object.entries(valeurs)) {
    if (v === null || v === '') cellules.delete(a);
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
  assert.deepEqual(lireLaNote('Sans marqueur\nBi-classé : oui'), { marqueur: false, notes: 'Sans marqueur\nBi-classé : oui', valeurs: {}, suites: new Map(), autres: [] });
  // la suite d'un texte coupé (lib/tableur-mesure.mjs) : par adresse, la première seulement ; une seconde pour la même case revient dans les notes
  const coupee = lireLaNote([MARQUEUR_DES_NOTES, 'Suite de la case AM55 : du texte ⏎ et la suite', 'suite de la case am55 : encore', 'Suite de la case : sans adresse'].join('\n'));
  assert.deepEqual(coupee.suites, new Map([['AM55', { valeur: 'du texte ⏎ et la suite', ligne: 'Suite de la case AM55 : du texte ⏎ et la suite' }]]));
  assert.deepEqual(coupee.autres, ['suite de la case am55 : encore', 'Suite de la case : sans adresse']);
  assert.equal(lireLaNote('').notes, null);
  assert.equal(lireLaNote(`\n${MARQUEUR_DES_NOTES}\nBi-classé : non`).notes, null);
  // des lignes illisibles : dites dans nonRepris
  const r = ficheDuClasseur(regles, ordinateur({ BA54: `${MARQUEUR_DES_NOTES}\nGains de niveau : niv. 2 : beaucoup\nNM offerts : Boule de feu` }));
  assert.deepEqual(r.nonRepris, ['NM offerts : « Boule de feu » illisible', 'Gains de niveau : « niv. 2 : beaucoup » illisibles']);

  // la case de l'entraînement : « 2 Magie | 10 Concentration » (fiche auto) ou « Concentration 10 | Magie 2 » (modèle ordinateur)
  const attendu = new Map([['magie', 2], ['concentration', 10]]);
  assert.deepEqual(acquisDeLEntrainement(regles, '2 Magie | 10 Concentration'), attendu);
  assert.deepEqual(acquisDeLEntrainement(regles, 'Magie 2 | Concentration 10'), attendu);
  assert.equal(acquisDeLEntrainement(regles, ''), null);
  assert.equal(acquisDeLEntrainement(regles, '2 Magie | beaucoup de Chance'), null);
});

test('disposition inconnue : une Error qui nomme les deux modèles', () => {
  assert.throws(() => ficheDuClasseur(regles, feuilleDeGrille([['Nom', 'Lucien']])), { message: ERREUR_DISPOSITION });
  assert.throws(() => ficheDuClasseur(regles, ordinateur({ AA21: 'AP de base ?' })), { message: ERREUR_DISPOSITION });
  assert.match(ERREUR_DISPOSITION, /Fiche-de-personnage-Maverick-V15\.2\.2 ordinateur/);
  assert.match(ERREUR_DISPOSITION, /fiche auto V15\.2\.2 \(onglet « Personnage »\)/);
});

// ------------------------------------------------------------------ les deux fiches auto du propriétaire

/** Ce que les deux fiches ont en commun : identité, alignement, bourse, XP, caractéristiques, compétences (scores gardés), sorts, inventaire, maîtrises. */
function verifierLeCommun(values, r, { magies, clampees = [] }) {
  const f = r.fiche;
  const v = (a) => lue(values, a);
  assert.equal(r.disposition, 'auto');
  assert.equal(f.nom, v('I1'));
  assert.equal(f.surnom, v('S1'));
  assert.equal(f.lieu_origine, v('I3'));
  assert.equal(f.race_id, parNom(regles.races, v('I2')).id);
  assert.equal(f.magie_innee_id, magie(v('S2')).id);
  assert.equal(f.magie_acquise_id, v('S3') ? magie(v('S3')).id : null);
  assert.equal(f.ethnie_id, parNom(regles.ethnies.filter((e) => e.race_id === f.race_id), v('C40')).id);
  assert.equal(f.metier_id, parNom(regles.metiers, v('C41')).id);
  assert.deepEqual([f.alignement_loyal, f.alignement_chaotique, f.alignement_bon, f.alignement_mauvais], ['L5', 'M5', 'N5', 'O5'].map((a) => Number(v(a) || 0)));
  assert.deepEqual([f.bourse_pp, f.bourse_ro, f.bourse_rf], ['L6', 'Q6', 'W6'].map((a) => Number(v(a) || 0)));
  assert.equal(f.xp, Number(v('S11')));
  // niveaux de classe 20 et 2 au niveau global 11 : mono-classe (décision R2)
  assert.deepEqual([v('G9'), v('G11'), v('W8')], ['20', '2', '11']);
  assert.equal(f.mode_classe, 'mono');
  assert.deepEqual(f.classes.map((c) => c.classe_id), [classe(v('A9')).id, classe(v('A11')).id]);
  for (const c of CASES_CARACTERISTIQUES) {
    const ligne = f.caracteristiques.find((x) => x.caracteristique_id === c.id);
    assert.deepEqual([ligne.base, ligne.croix], [Number(v(c.base)), c.croix.filter((a) => v(a) === 'TRUE').length], c.id);
  }
  // le +1 de la magie innée sur sa caractéristique (case bonus du classeur)
  const bonus = CASES_CARACTERISTIQUES.filter((c) => v(c.bonus)).map((c) => c.id);
  assert.deepEqual(bonus, [regles.magies.find((m) => m.id === f.magie_innee_id).caracteristique_id]);
  // compétences : le naturel tel quel, et chaque score du classeur retrouvé par le site (sauf un acquis du classeur rogné à 0 : voir les remarques)
  const calcul = competencesDe(regles, f);
  for (const c of CASES_COMPETENCES) {
    const ligne = f.competences.find((x) => x.competence_id === c.id);
    assert.equal(ligne?.naturel ?? 0, Number(v(c.naturel) || 0), c.id);
    if (!clampees.includes(c.id)) assert.equal(calcul.find((k) => k.id === c.id).score, Number(v(c.total)), `score ${c.id}`);
  }
  // maîtrises : « Nd » → N dés, seules celles qui ajoutent un dé
  const attendues = MAITRISES.map((m) => ({ arme_famille_id: m.famille, des: Number(v(`${m.cote === 'gauche' ? 'AI' : 'AN'}${m.ligne}`).replace('d', '')) }))
    .filter((m) => m.des > maitriseDArme(regles).desSansMaitrise);
  assert.deepEqual([...f.maitrises_armes].sort((a, b) => a.arme_famille_id.localeCompare(b.arme_famille_id)),
    attendues.sort((a, b) => a.arme_famille_id.localeCompare(b.arme_famille_id)));
  // sorts : chaque ligne écrite, retrouvée parmi les sorts des magies du personnage, avec son NM (rien d'offert : la fiche auto ne le dit pas)
  const ecrits = AUTO.sorts.lignes.filter((l) => v(`AA${l}`)).map((l) => [v(`AA${l}`), Number(v(`AY${l}`) || 0)]);
  assert.deepEqual(f.sorts.map((s) => [trouver(regles.sorts, s.sort_id).nom, s.niveau_maitrise, s.nm_livre, s.nm_cadeau, s.rang]),
    ecrits.map(([nom, nm], i) => [regles.sorts.find((s) => magies.includes(s.magie_id) && cle(s.nom) === cle(nom)).nom, nm, 0, 0, i + 1]));
  // inventaire : colonne par colonne, les lignes nommées ; la ressource de ce nom exact (comme la page)
  const objets = AUTO.inventaire.colonnes.flatMap((c) => AUTO.inventaire.lignes.map((l) => [v(`${c.nom}${l}`), v(`${c.quantite}${l}`)])).filter(([nom]) => nom);
  assert.deepEqual(f.inventaire, objets.map(([nom, q], i) => ({ rang: i + 1, nom, quantite: Number(q), ressource_id: regles.ressources.find((x) => x.nom === nom)?.id ?? null })));
  // valeurs du moment au maximum (null), corruption 0 (null)
  assert.deepEqual([v('D14'), v('K14'), v('R14')], [v('F14'), v('M14'), v('T14')]);
  assert.deepEqual([f.sante_actuelle, f.chakra_actuel, f.barriere_actuelle, f.barre4_actuelle, f.corruption, f.posture_id], [null, null, null, null, null, null]);
  // gains de niveau reconstitués : les maximums du classeur retrouvés, 15 points par niveau, un d8 aux niveaux à dé
  const a = attributsDe(regles, f);
  assert.deepEqual([a.sante, a.chakra], [Number(v('F14')), Number(v('M14'))]);
  const niveaux = regles.niveaux.filter((n) => n.niveau >= 2 && n.niveau <= Number(v('W8')));
  assert.deepEqual(f.progression.map((p) => p.niveau), niveaux.map((n) => n.niveau));
  for (const p of f.progression) {
    const n = niveaux.find((x) => x.niveau === p.niveau);
    assert.equal(p.points_sante + p.points_chakra, n.points_attributs);
    assert.equal(p.de_choix !== null, Boolean(n.de_attributs_bonus), `dé du niveau ${p.niveau}`);
    if (p.de_choix) assert.ok(p.de_resultat >= 1 && p.de_resultat <= 8);
  }
  assert.ok(r.remarques.includes(`Gains de niveau reconstitués d'après les maximums du classeur (santé ${v('F14')}, chakra ${v('M14')}) : à vérifier`));
  assert.equal(r.image, null);
  assert.equal(r.portraitGarde, false);
  assert.equal(f.notes, v('BA54') || null);
}

test('fiche auto de Lucien : tout ce que le classeur choisit est repris, rien ne part dans les notes', () => {
  const r = importer(LUCIEN);
  const f = r.fiche;
  const v = (a) => lue(LUCIEN, a);
  const necromancie = magie('Nécromancie');
  verifierLeCommun(LUCIEN, r, { magies: [necromancie.id] });
  assert.deepEqual(r.nonRepris, []);
  // classes et spécialités ; « SPÉCIALISTE » en classe 2 au niveau 2 : gardée telle quelle (le contrôle specialite_trop_tot le signale)
  assert.deepEqual(f.classes, [
    { rang: 1, classe_id: classe('Barde').id, specialite_id: parNom(classe('Barde').specialites, v('I9')).id },
    { rang: 2, classe_id: classe('Ocultomancien').id, specialite_id: parNom(classe('Ocultomancien').specialites, v('I11')).id },
  ]);
  // dons à choix : Nouvel accord, « Balade guerrière » (la base écrit « Ballade guerrière », même identifiant), Exaltation ; Prestation, Son perturbant,
  // Ménestrel, Chant double et Économe se déduisent
  const ballade = classe('Barde').dons.find((d) => d.id.endsWith('-balade-guerriere'));
  assert.equal(v('C51'), 'Balade guerrière');
  assert.notEqual(cle(ballade.nom), cle(v('C51')));
  assert.deepEqual(f.capacites.map((c) => c.capacite_id), [don('Barde', 'Nouvel accord').id, ballade.id, don('Barde', 'Exaltation').id]);
  assert.equal(f.dieu_choisi_id, parNom(regles.dieux, 'Pas de Dieu choisi').id, '« Pas de Dieu choisi » est un dieu de la liste');
  // compétences : l'acquis du joueur = acquis du classeur − bonus du métier (Écrivain : celui de la base) − accessoire
  const ecrivain = parNom(regles.metiers, 'Écrivain');
  const bonusConnaissance = ecrivain.bonus.find((b) => b.options.some((o) => o.competence_id === 'connaissance')).valeur;
  const acquis = (id) => f.competences.find((c) => c.competence_id === id)?.acquis ?? 0;
  assert.equal(acquis('connaissance'), Number(v('I32')) - bonusConnaissance);
  // « 2 Magie | 10 Concentration | 10 Observation | 10 Distinction » (L42) : les acquis du joueur ; l'accessoire « Compétence I » (18 %) est sur Magie
  const entrainement = acquisDeLEntrainement(regles, v('L42'));
  for (const [id, n] of entrainement) assert.equal(acquis(id), n, id);
  const chef = f.accessoires.find((a) => a.emplacement === 'chef');
  const effetChef = regles.accessoires.find((a) => a.id === chef.accessoire_effet_id);
  assert.deepEqual([effetChef.propriete_nom, effetChef.caracteristique_id, chef.valeur, chef.competence_id], ['Compétence', 'intelligence', 18, 'magie']);
  assert.ok(18 >= effetChef.min && 18 <= effetChef.max);
  assert.equal(Number(v('I33')) - entrainement.get('magie'), chef.valeur);
  assert.ok(r.remarques.includes('Compétence de l\'accessoire Chef (Compétence I 18) déduite : Magie'));
  // les autres accessoires : la propriété et le libellé du classeur, tels quels dans la table
  assert.deepEqual(f.accessoires.filter((a) => a.emplacement !== 'chef').map((a) => [a.emplacement, a.accessoire_effet_id, a.texte, a.maudit]), [
    ['collier', effetDAccessoire('Attributs', v('AI30').trim()).id, null, 0],
    ['bracelet-1', effetDAccessoire('Attributs', v('AA33').trim()).id, null, 0],
    ['bracelet-2', effetDAccessoire('Défense', v('AI33')).id, null, 0],
    ['bague-1', effetDAccessoire('Attributs', v('AA36')).id, null, 0],
  ]);
  // armes : « (une main) » ignorée ; Laiton pour l'arbalète, le fer par défaut pour la dague (décision R49)
  const arbalete = parNom(regles.armes, 'Arbalète à bras');
  const dague = parNom(regles.armes, 'Dague');
  assert.deepEqual(f.armes.map((a) => [a.rang, a.arme_id, a.materiau_id, a.amelioration_id, a.arme_elementaire_id]), [
    [1, arbalete.id, parNom(regles.materiaux_armes, v('AE10')).id, null, null],
    [2, dague.id, regles.materiau_arme_defaut, null, null],
  ]);
  // « Effet en plus » (AA12, AA13) : une formule de la fiche auto (=BDD!AJ36 : effet du catalogue, du matériau, malus d'ambidextrie), aucune saisie du
  // joueur : rien n'en est tiré
  assert.ok(v('AA13').includes('\n'), 'l’effet du catalogue et celui du matériau');
  assert.equal(cle(v('AN13')), cle(dague.effet));
  assert.deepEqual(f.armes.map((a) => a.effet_en_plus), [null, null]);
  // armure : Vêtement renforcé (armure complète), élément « Nécromancie » = l'armure élémentaire Vêtement de cette magie, « +5 » = son amélioration niveau 5
  const vetement = parNom(regles.armures, v('AD21'));
  const elementaire = regles.armures_elementaires.find((x) => x.id === f.armures[0].armure_elementaire_id);
  assert.deepEqual([elementaire.categorie, elementaire.id.split(':').pop()], [vetement.type, cle(v('AS21'))]);
  assert.equal(v('AT20'), 'Aucune');
  assert.deepEqual(f.armures, [{
    emplacement_id: 'armure-complete', armure_id: vetement.id, amelioration_id: null, armure_elementaire_id: elementaire.id,
    amelioration_elementaire_id: amelioration('armure_elementaire', Number(v('AX21'))).id,
  }]);
  assert.equal(f.bouclier_classe_id, null);
  assert.deepEqual(f.bouclier_materiaux, []);
  assert.equal(f.evenements, `${v('C71')} : ${v('L71')}\n${v('C72')} : ${v('L72')}`);
  // les deux remarques propres à Lucien : la compétence de l'accessoire (ci-dessus) et ses 18 NM, plus que les NM de niveau du niveau 11
  const disponibles = regles.niveaux.find((n) => n.niveau === Number(v('W8'))).niveaux_maitrise_cumul;
  assert.ok(f.sorts.reduce((s, x) => s + x.niveau_maitrise, 0) > disponibles);
  assert.equal(r.remarques.length, 3);
  assert.ok(r.remarques.some((x) => x.startsWith(`NM des sorts : les 18 NM du classeur sont comptés comme NM de niveau (${disponibles} disponibles)`)));
});

test('fiche auto de Louise : bi-magie, amélioration écrite « +N (effet) », anciennes graphies, métier qui a changé', () => {
  const r = importer(LOUISE);
  const f = r.fiche;
  const v = (a) => lue(LOUISE, a);
  verifierLeCommun(LOUISE, r, { magies: [magie('Lumière').id, magie('Espace/Temps').id], clampees: ['esquive', 'reflexe'] });
  assert.deepEqual(r.nonRepris, []);
  assert.deepEqual(f.classes, [
    { rang: 1, classe_id: classe('Mage Rouge').id, specialite_id: parNom(classe('Mage Rouge').specialites, v('I9')).id },
    { rang: 2, classe_id: classe('Guerrier').id, specialite_id: null },
  ]);
  assert.deepEqual(f.capacites.map((c) => c.capacite_id), ['Ange rouge', 'Favori', 'Les deux'].map((n) => don('Mage Rouge', n).id));
  assert.equal(f.dieu_choisi_id, null);
  // Acrobate : la base donne +3 % Esquive et +3 % Réflexe ; le classeur écrit 2 d'acquis (l'ancien « +2 % Réflexe, Esquive et Ruse ») : acquis du joueur 0
  const acrobate = parNom(regles.metiers, 'Acrobate');
  for (const [id, adresse] of [['esquive', 'V34'], ['reflexe', 'V35']]) {
    const bonus = acrobate.bonus.find((b) => b.options.some((o) => o.competence_id === id)).valeur;
    assert.ok(Number(v(adresse)) < bonus);
    assert.equal(f.competences.find((c) => c.competence_id === id)?.acquis ?? 0, 0);
    const nom = regles.competences.find((k) => k.id === id).nom;
    assert.ok(r.remarques.includes(`Compétence ${nom} : acquis du classeur ${v(adresse)}, moins que ce qu'ajoutent le métier et les accessoires (${bonus}) : acquis du joueur 0`));
  }
  assert.equal(f.competences.find((c) => c.competence_id === 'ruse').acquis, Number(v('V36')), 'Ruse n’est plus un bonus d’Acrobate : l’acquis reste au joueur');
  // arme : Épée rasoir en Mythril, « +5 » = amélioration niveau 5 ; « Passe barrière », sous l'effet du catalogue, vient de la formule (le matériau) :
  // pas d'effet en plus
  const rasoir = parNom(regles.armes, v('AA10'));
  assert.equal(cle(v('AA13').split('\n')[0]), cle(rasoir.effet));
  assert.equal(v('AA13').split('\n').length, 2);
  assert.deepEqual(f.armes, [{
    rang: 1, arme_id: rasoir.id, materiau_id: parNom(regles.materiaux_armes, v('AE10')).id, amelioration_id: amelioration('arme', 5).id,
    arme_elementaire_id: null, amelioration_elementaire_id: null, effet_en_plus: null,
  }]);
  // armure : « Armure Vif Argent complet » = « Armure Vif Argent complète » (même identifiant) ; « +4 (+8 AP/AM) » = amélioration niveau 4, dont c'est l'effet
  const vifArgent = regles.armures.find((a) => a.id.endsWith(`:${cle(v('AD21'))}`));
  assert.notEqual(vifArgent.nom, v('AD21'));
  assert.ok(cle(amelioration('armure', 4).effet).startsWith(cle('+8 AP/AM')));
  assert.deepEqual(f.armures, [{ emplacement_id: 'armure-complete', armure_id: vifArgent.id, amelioration_id: amelioration('armure', 4).id, armure_elementaire_id: null, amelioration_elementaire_id: null }]);
  // accessoires : « Les AP de base augmente de 5 » n'est pas le libellé de la base (« … augmentent … ») : texte libre, non compté, et une remarque
  assert.ok(!regles.accessoires.some((a) => cle(a.libelle) === cle(v('AA33'))));
  assert.ok(regles.accessoires.some((a) => a.libelle === 'Les AP de base augmentent de 5'));
  assert.deepEqual(f.accessoires.map((a) => [a.emplacement, a.accessoire_effet_id, a.texte]), [
    ['chef', effetDAccessoire('Défense', v('AA30')).id, null],
    ['collier', effetDAccessoire('Défense', v('AI30')).id, null],
    ['bracelet-1', null, `Défense : ${v('AA33')}`],
    ['bracelet-2', effetDAccessoire('Défense', v('AI33')).id, null],
    ['bague-1', effetDAccessoire('Défense', v('AA36')).id, null],
  ]);
  assert.ok(r.remarques.includes(`Accessoire Bracelet 1 : « ${v('AA33')} » (DÉFENSE) ne correspond à aucun effet de la table des accessoires : gardé en texte libre (non compté)`));
  assert.equal(f.evenements, null);
  assert.equal(r.remarques.length, 4, 'le texte libre, Esquive, Réflexe, les gains de niveau');
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
  assert.deepEqual(r.fiche.progression, []);
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
  for (const cle_ of ['classes', 'competences', 'capacites', 'sorts', 'armes', 'armures', 'accessoires', 'inventaire', 'ceinture', 'progression']) assert.deepEqual(r.fiche[cle_], [], cle_);
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
  assert.deepEqual(f.progression, lireGains(note.split('\n').find((l) => l.startsWith('Gains')).split(' : ').slice(1).join(' : ')));
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
  assert.deepEqual([r.nonRepris, r.remarques], [[], []]);
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
  assert.equal(lire({ ...autre, de: 'B7' }).image, null, 'une image ailleurs qu’en A1 n’est pas le portrait');
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
