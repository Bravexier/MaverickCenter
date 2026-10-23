// Aller-retour de la fiche de personnage en tableur (demande du propriétaire, 2026-10-15 : « La fiche de personnage doit pouvoir être importée et
// exportée à tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle ») : la chaîne entière de la page /fiche/ — les cases
// (lib/fiche-tableur-export.mjs), le classeur écrit sur le modèle servi par le site (lib/fiche-modele.mjs, lib/tableur-ecriture.mjs), relu
// (lib/tableur-lecture.mjs) puis importé (lib/fiche-tableur-import.mjs) — redonne la fiche, sans rien ajouter aux notes (`nonRepris` et `remarques`
// vides), et l'export de la fiche réimportée redonne les mêmes cases (point fixe). Fiches : deux construites ici (tout rempli, débordements compris :
// mono-classe à métier et accessoires, bi-classe au Potentiel Illimité), les quatre personnages fil rouge du guide (lib/guide-fil-rouge.mjs) et les deux
// fiches auto du propriétaire (test/fixtures : Lucien et Louise), importées puis réexportées. La comparaison se fait sur la forme qu'envoie la page
// (aEnvoyer de src/scripts/fiche.mjs) mise en forme canonique : rangs des listes numérotées renumérotés, null, '' et absent confondus, listes sans ordre
// triées ; une valeur du moment égale à son maximum (ou une corruption nulle), une solidité d'arme à son maximum (armesValables), valent « rien d'écrit ».
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide, PARTIES_DE_FICHE, PREFIXE_DE_RETRAIT, sansPartiesRetirees } from '../src/lib/fiche-format.mjs';
import { modeleXlsx, partiesDuModele } from '../src/lib/fiche-modele.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import {
  CASES_RESISTANCES, casesDesDes, casesDuDon, DONS, lettresDeColonne, LONGUEUR_MAX_D_UNE_CASE, MAITRISES, MARQUEUR_DES_NOTES, ORDINATEUR, REMPLISSAGE_DE_ATTEINT,
} from '../src/lib/fiche-tableur-cases.mjs';
import { cellulesDeLaFiche, CLES_DE_LA_NOTE, enChiffres, lireLigneDeNote, lireSortPrepare, MODE_HYPER_CENT_DEBLOQUE } from '../src/lib/fiche-tableur-export.mjs';
import { feuilleDeGrille, ficheDuClasseur, REMARQUE_MAITRISES_CSV } from '../src/lib/fiche-tableur-import.mjs';
import { chargerFilRouge, FIL_ROUGE } from '../src/lib/guide-fil-rouge.mjs';
import { ecrireXlsx, zonesDuClasseur } from '../src/lib/tableur-ecriture.mjs';
import { lireClasseur } from '../src/lib/tableur-lecture.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const DATE = '15/10/2026';
const MODELE = await modeleXlsx();
const LOGO = partiesDuModele().get('xl/media/image1.png');
const ZONES = await zonesDuClasseur(MODELE);
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const trouve = (liste, critere, quoi) => {
  const x = regles[liste].find(critere);
  assert.ok(x, `${liste} : ${quoi}`);
  return x;
};

// ------------------------------------------------------------------ la chaîne de la page

/** La fiche telle que la page l'envoie (rafraichir puis aEnvoyer de src/scripts/fiche.mjs) : caractéristiques complètes, listes nettoyées et numérotées. */
function commeLaPage(fiche) {
  const f = structuredClone({ ...ficheVide(''), ...fiche });
  for (const cle of Object.keys(PARTIES_DE_FICHE)) f[cle] ??= [];
  f.caracteristiques = M.caracteristiquesCompletes(regles, f);
  f.caracteristiques = f.caracteristiques.filter((c) => c.base !== null && c.base !== undefined);
  f.competences = f.competences.filter((c) => c.naturel);
  f.entrainements = M.entrainementsAEnregistrer(f);
  f.acquis_choix = M.acquisChoixValables(regles, f);
  f.resistance_choix = M.resistanceChoixValables(regles, f);
  // les maîtrises d'armes (décision R148) : la famille de chaque point à choisir d'une source acquise, parmi ses options ; plus de dés par famille
  f.maitrise_choix = M.maitriseChoixValables(regles, f);
  delete f.maitrises_armes;
  f.armes = M.armesValables(regles, f);
  // rangés dans l'ordre ; le sort préparé garde sa marque, son jet et sa posture, les autres n'en ont pas (décision R115)
  f.sorts = M.sortsAEnregistrer(regles, f);
  f.bouclier_solidite = M.soliditeDuBouclierAEcrire(regles, f, f.bouclier_solidite);
  f.inventaire = f.inventaire.filter((o) => o.nom && o.nom.trim()).map((o, i) => ({ ...o, nom: o.nom.trim(), rang: i + 1 }));
  f.accessoires = f.accessoires.filter((a) => a.accessoire_effet_id);
  f.ceinture = f.ceinture.filter((o) => o.nom && o.nom.trim()).map((o) => ({ ...o, nom: o.nom.trim() }));
  return f;
}

/**
 * Ce que la page fait d'une fiche, puis d'un fichier : les cases (textes trop longs coupés d'après la taille des cases du modèle, la suite dans la
 * note), le classeur (sans portrait : le logo du modèle, marqué « logo »), relu, importé.
 */
async function allerRetour(fiche) {
  const { cellules, remplis, alignements, avertissements } = cellulesDeLaFiche(regles, fiche, { date: DATE, zones: ZONES });
  const octets = await ecrireXlsx(MODELE, { cellules, remplis, alignements, descriptionImage: 'logo', titre: fiche.nom ?? '' });
  const classeur = await lireClasseur(octets, { nom: 'essai.xlsx' });
  assert.equal(classeur.format, 'xlsx');
  const r = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  return { ...r, cellules, remplis, alignements, avertissements, octets };
}

// ------------------------------------------------------------------ la forme canonique

const vide = (v) => v === null || v === undefined || v === '';
/** Un objet sans ses clés vides (null, '' et absent confondus). */
const sansVides = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !vide(v)));
const ordre = (liste) => new Map(liste.map((x, i) => [x, i]));
const parCle = (cle, rang) => (a, b) => (rang.get(a[cle]) ?? 1e9) - (rang.get(b[cle]) ?? 1e9) || String(a[cle]).localeCompare(String(b[cle]));

/** La fiche comparable : forme de la page, sans ce que l'export ne porte pas (portrait : la page s'en charge ; colonnes du service), en forme canonique. */
function canonique(fiche) {
  const f = commeLaPage(fiche);
  for (const c of ['id', 'version', 'portrait', 'portrait_x', 'portrait_y', 'portrait_zoom', 'nature', 'proprietaire_id', 'visibilite', 'cree_le', 'modifie_le']) delete f[c];
  // une valeur du moment au maximum, ou une corruption nulle : rien d'écrit
  for (const j of M.valeursDuMoment(regles, f)) {
    if (vide(f[j.champ])) continue;
    if (j.champ === 'corruption' ? Number(f[j.champ]) === 0 : Number(f[j.champ]) === j.max) f[j.champ] = null;
  }
  const caracs = ordre(regles.caracteristiques.map((c) => c.id));
  const competences = ordre(regles.competences.map((c) => c.id));
  const emplacementsArmure = ordre(regles.emplacements_armure.map((e) => e.id));
  const emplacementsAccessoire = ordre(M.EMPLACEMENTS_ACCESSOIRES.map(([e]) => e));
  const tri = {
    classes: (a, b) => a.rang - b.rang,
    caracteristiques: parCle('caracteristique_id', caracs),
    competences: parCle('competence_id', competences),
    metier_bonus: (a, b) => a.rang - b.rang,
    capacites: (a, b) => a.capacite_id.localeCompare(b.capacite_id),
    maitrise_choix: (a, b) => a.source.localeCompare(b.source) || a.rang - b.rang,
    armes: (a, b) => a.rang - b.rang,
    armure_parties: parCle('emplacement_id', emplacementsArmure),
    accessoires: parCle('emplacement', emplacementsAccessoire),
    ceinture: (a, b) => a.rang - b.rang,
  };
  // l'entraînement : ses compétences (la case L42) puis ses textes (la note), renumérotées (le tableur ne garde pas l'ordre entre les deux : R104)
  f.entrainements = [...f.entrainements.filter((l) => l.competence_id), ...f.entrainements.filter((l) => !l.competence_id)].map((l, i) => ({ ...l, rang: i + 1 }));
  const resultat = sansVides(f);
  for (const cle of Object.keys(PARTIES_DE_FICHE)) {
    const liste = (f[cle] ?? []).map(sansVides);
    if (tri[cle]) liste.sort(tri[cle]);
    resultat[cle] = liste;
  }
  return resultat;
}

/** Les cases dont l'import tire un choix du personnage : seules elles peuvent avoir une suite dans la note (jamais un texte de règles). */
const O = ORDINATEUR;
const CASES_RELUES = new Set([O.nom, O.surnom, O.lieuOrigine, O.race, O.magieInnee, O.magieAcquise, O.dieuChoisi, O.xp, O.classe1, O.classe2, O.specialite1,
  O.specialite2, ...O.armes.flatMap((x) => [x.nom, x.effet]), O.armure.nom, O.armure.bonus, O.bouclier.nom, O.bouclier.composition,
  ...Object.values(O.accessoires), ...O.ceinture, ...O.inventaire.colonnes.flatMap((c) => O.inventaire.lignes.map((l) => `${c}${l}`)),
  casesDuDon(DONS.race).nom, casesDuDon(DONS.metier).nom, casesDuDon(DONS.metier).effet, casesDuDon(DONS.entrainement).effet,
  ...[...DONS.classe1, ...DONS.classe2].map((l) => casesDuDon(l).nom), ...DONS.evenements.flatMap((l) => [casesDuDon(l).nom, casesDuDon(l).effet]),
  ...O.sorts.lignes.map((l) => `${O.sorts.colonnes.nom}${l}`), ...O.armes.map((x) => x.solidite)]);

/** Les lignes de la note sous le marqueur, lues (lireLigneDeNote) : toutes ont une clé connue. */
function lignesDeLaNote(cellules) {
  const lignes = cellules[O.note].split('\n');
  const lues = lignes.slice(lignes.indexOf(MARQUEUR_DES_NOTES) + 1).map((l) => [l, lireLigneDeNote(l)]);
  assert.deepEqual(lues.filter(([, x]) => !x).map(([l]) => l), [], 'toute ligne sous le marqueur a une clé connue');
  return lues.map(([, x]) => x);
}

/** L'aller-retour d'une fiche : même fiche, rien dans les notes, et l'export de la fiche relue redonne les mêmes cases. */
async function verifier(fiche, quoi) {
  const r = await allerRetour(fiche);
  assert.equal(r.disposition, 'ordinateur', quoi);
  assert.deepEqual(r.nonRepris, [], `${quoi} : rien sans place sur le site`);
  assert.deepEqual(r.remarques, [], `${quoi} : rien de déduit`);
  assert.equal(r.image, null, `${quoi} : le logo du modèle n'est pas un portrait`);
  assert.deepEqual(r.avertissements, [], `${quoi} : tout tient dans les cases`);
  assert.deepEqual(canonique(r.fiche), canonique(fiche), `${quoi} : la fiche relue`);
  const encore = cellulesDeLaFiche(regles, r.fiche, { date: DATE, zones: ZONES });
  assert.deepEqual(encore, { cellules: r.cellules, remplis: r.remplis, alignements: r.alignements, avertissements: r.avertissements }, `${quoi} : point fixe de l'export`);
  // la note : des données du personnage ; une suite seulement pour une case relue, et le Mode Hyper 100 % sans ses effets
  const lues = lignesDeLaNote(r.cellules);
  assert.deepEqual(lues.filter((l) => l.nom === 'suite' && !CASES_RELUES.has(l.adresse)).map((l) => l.adresse), [], `${quoi} : suite d'une case affichée`);
  assert.ok(lues.filter((l) => l.cle === CLES_DE_LA_NOTE.modeHyperCent).every((l) => l.valeur === MODE_HYPER_CENT_DEBLOQUE), quoi);
  return r;
}

// ------------------------------------------------------------------ les fiches

/** Un texte trop long pour toute case (lib/tableur-mesure.mjs) : coupé à l'export, la suite dans la note, recollé à l'import. */
const LONG = 'Banni du Temple de Morfot pour avoir ouvert le Livre des Cendres : il doit se présenter chaque nouvelle lune devant le Haut Conseil, '
  + 'sans arme ni armure, et répondre de ses actes ; tant qu’il n’a pas retrouvé les trois pages arrachées, aucun prêtre ne le soignera.';

/** Un carquois de la ceinture (v_objet_ceinture, famille « contenant »). */
const carquoisVide = regles.ressources.find((r) => regles.ceinture.objets.some((o) => o.famille === 'contenant' && o.ressource_id === r.id)).nom;

/** Un objet de l'inventaire ou de la ceinture, comme la page l'écrit : la ressource est la première de ce nom (src/scripts/fiche.mjs). */
const objet = (nom, quantite = 1) => ({ nom, quantite, ressource_id: regles.ressources.find((r) => r.nom === nom)?.id ?? null });

/**
 * Mono-classe à métier, tout rempli : 26 sorts, 55 objets, 6 événements, accessoires sur tous les emplacements, armes forgées (l'une abîmée, l'autre
 * cassée : décision R74), armure en pièces, gains de niveau (R73), un entraînement en lignes et des choix d'acquis (R104).
 */
function ficheRiche() {
  const f = {
    ...ficheVide('Bérénice'), surnom: 'la Rousse…', lieu_origine: 'Port-Sable', race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central',
    magie_innee_id: 'magies/magie-du-feu', magie_acquise_id: 'magies/magie-de-la-glace', dieu_choisi_id: regles.dieux.at(-1).id, metier_id: 'metiers/enchanteur',
    mode_classe: 'mono', xp: xpDuNiveau(14) + 250, alignement_loyal: 3, alignement_chaotique: 7, alignement_bon: 6, alignement_mauvais: 1,
    bourse_pp: 2, bourse_ro: 17, bourse_rf: 9, sante_actuelle: 12, chakra_actuel: 7, barriere_actuelle: 3, corruption: 2, posture_id: 'guide/postures#posture:vigilance',
    symbiose_magie_id: 'magies/magie-de-la-glace',   // la magie de la Symbiose, gardée hors de la posture (décision R100) : dans la note
    notes: 'Une note : avec deux-points\nEt une seconde ligne', evenements: ['Naissance : à Port-Sable', 'Sans titre ici', `Deuil : ${LONG}`, 'Duel : perdu… de peu', 'Voyage : vers le nord…', 'Dernier : encore'].join('\n'),
    classes: [
      { rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:epeiste' },
      { rang: 2, classe_id: 'classes/mage', specialite_id: 'classes/mage#specialite:mage-noir' },
    ],
    caracteristiques: regles.caracteristiques.map((k, i) => ({ caracteristique_id: k.id, base: 3 + (i % 2), croix: k.id === 'perception' ? 1 : 0 })),
    competences: [
      { competence_id: 'connaissance', naturel: 15 }, { competence_id: 'concentration', naturel: 5 }, { competence_id: 'esquive', naturel: 10 },
    ],
    metier_bonus: [{ rang: 2, competence_id: 'magie' }],
    // la maîtrise au choix du Guerrier (décision R148), que suit le retrait de l'Épéiste (R151)
    maitrise_choix: [{ source: 'classes/guerrier#maitrise-arme:2', rang: 1, arme_famille_id: 'hache' }],
    armes: [
      {
        rang: 1, arme_id: 'ressources/armes#arme:epees:epee-longue', materiau_id: trouve('materiaux_armes', (m) => m.nom === 'Acier', 'Acier').id,
        amelioration_id: trouve('ameliorations', (a) => a.cible === 'arme' && a.niveau === 3, 'amélioration 3').id,
        effet_en_plus: `Gravée au nom de sa mère\nTranchant : comme au premier jour\n${LONG}\n\n${LONG}`, durabilite: 1,
      },
      // une arme élémentaire de la magie acquise (décision R167), cassée, au +5 : son nom, son niveau et sa solidité reviennent
      { rang: 2, arme_elementaire_id: 'ressources/pieces-elementaires#arme-elementaire:dague:glace',
        amelioration_id: trouve('ameliorations', (a) => a.cible === 'arme' && a.niveau === 5, 'amélioration 5').id, durabilite: 0 },
    ],
    // l'entraînement (décision R104) : quinze compétences, le maximum (trop pour la case L42, la suite dans la note), deux textes libres
    entrainements: [...[['magie', 2], ['concentration', 10], ['observation', 10], ['distinction', 10], ['survie', 5], ['vigueur', 5], ['fermete', 5],
      ['medecine', 3], ['psychologie', 3], ['orientation', 3], ['sabotage', 3], ['diplomatie', 3], ['negociation', 3], ['equilibre', 3], ['reflexe', 3]]
      .map(([competence_id, valeur]) => ({ competence_id, valeur, texte: null })),
    { competence_id: null, valeur: null, texte: `Livre de magie lu : ${LONG}` }, { competence_id: null, valeur: null, texte: 'Accordé par le MJ : +5 Survie' }]
      .map((l, i) => ({ rang: i + 1, ...l })),
    // les choix d'acquis de ses dons (décision R104) : « Arme lourde ou légère » de l'Épéiste, les 10 % de l'Humain central répartis
    acquis_choix: [
      { source: 'capacites/guerrier-epeiste', rang: 1, competence_id: 'arme-legere', valeur: null },
      { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'arc', valeur: 6 }, { source: 'races/humain#don:humain-central', rang: 1, competence_id: 'calme', valeur: 4 },
    ],
    // l'armure portée (décisions R95, R165) : une armure élémentaire de sa magie innée, au poids qu'il peut porter (Guerrier : Intermédiaire), et son
    // amélioration du tableau élémentaire ; deux parties abîmées
    armure_elementaire_id: trouve('armures_elementaires', (a) => a.magie_id === 'magies/magie-du-feu' && a.categorie === 'Intermédiaire', 'armure élémentaire du Feu, intermédiaire').id,
    armure_amelioration_elementaire_id: trouve('ameliorations', (a) => a.cible === 'armure_elementaire' && a.niveau === 1, 'armure élémentaire 1').id,
    armure_parties: [{ emplacement_id: 'torse', solidite: 0 }, { emplacement_id: 'jambe-droit', solidite: 2 }],
    // le bouclier (décision R96) : une forme, une matière, son amélioration, la solidité du moment
    bouclier_classe_id: regles.boucliers[0].id, bouclier_materiau_id: 'ressources/armures#materiau:fer',
    bouclier_amelioration_id: trouve('ameliorations', (a) => a.cible === 'bouclier' && a.niveau === 4, 'bouclier 4').id, bouclier_solidite: 2,
    // six emplacements, un effet de la table chacun (décision R97)
    accessoires: [
      { emplacement: 'chef', accessoire_effet_id: 'ressources/accessoires#effet:competence:volonte:2', valeur: 8, maudit: 0, competence_id: 'concentration' },
      { emplacement: 'collier', accessoire_effet_id: 'ressources/accessoires#effet:attributs:1', maudit: 1 },
      { emplacement: 'bracelet-1', accessoire_effet_id: 'ressources/accessoires#effet:attaque:15', maudit: 0, arme_famille_id: 'epees' },
      { emplacement: 'bracelet-2', accessoire_effet_id: 'ressources/accessoires#effet:attributs:6', maudit: 0 },
      { emplacement: 'bague-1', accessoire_effet_id: 'ressources/accessoires#effet:attaque:17', maudit: 0 },
      { emplacement: 'bague-2', accessoire_effet_id: 'ressources/accessoires#effet:defense:1', maudit: 1 },
    ],
    // la 12e place (AA51) : un nom trop long pour sa case
    inventaire: [...regles.ressources.slice(0, 11).map((r, i) => objet(r.nom, (i % 3) + 1)), objet('Lettre de la mère, scellée à la cire rouge, jamais ouverte depuis la nuit de l’incendie'),
      ...regles.ressources.slice(11, 52).map((r, i) => objet(r.nom, (i % 3) + 1)), objet('Clé rouillée', 2), objet('Carte (déchirée)')].map((o, i) => ({ rang: i + 1, ...o })),
    // un carquois vide à la ceinture (décision R89 : « Un Carquois à 0 est juste un carquois vide »)
    ceinture: [{ rang: 1, ...objet(regles.ressources[90].nom, 12) }, { rang: 2, ...objet(carquoisVide, 0) },
      { rang: 3, ...objet('Corde tressée de crins de licorne, longue de vingt pas, nouée tous les trois pieds pour grimper') }],
  };
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options.at(-1).id })));
  // les gains de niveau, deux totaux (décision R73)
  f.gains_sante = 37;
  f.gains_chakra = 54;
  f.sorts = M.sortsPossibles(regles, f).slice(0, 26).map((s, i) => ({ sort_id: s.id, rang: i + 1, niveau_maitrise: i % 4, nm_livre: i % 4 >= 1 && i % 3 === 0 ? 1 : 0 }));
  // les NM du MJ, pour toute la fiche (décision R118)
  f.nm_mj = 2;
  return f;
}

/** Bi-classe au Potentiel Illimité (l'Archimage imposé en classe 1, R23), la caractéristique de la magie au choix, sorts de plusieurs magies. */
function ficheBiPotentiel() {
  const f = {
    ...ficheVide('Ysolde'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/potentiel-illimite',
    caracteristique_magie_id: 'intelligence', xp: xpDuNiveau(13), mode_classe: 'bi', posture_id: 'guide/postures#posture:offensif',
  };
  f.classes = [...M.classesSelonLaMagieInnee(regles, f), { rang: 2, classe_id: 'classes/barde', specialite_id: null }];
  f.classes = f.classes.map((c) => ({ ...c, specialite_id: c.specialite_id ?? M.trouver(regles.classes, c.classe_id).specialites[0]?.id ?? null }));
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options[0].id })));
  const possibles = M.sortsPossibles(regles, f);
  const magies = [...new Set(possibles.map((s) => s.magie_id))];
  const unNom = (s) => possibles.filter((x) => x.nom === s.nom).length === 1;
  f.sorts = magies.slice(0, 6).flatMap((m) => possibles.filter((s) => s.magie_id === m && unNom(s)).slice(0, 2)).map((s, i) => ({ sort_id: s.id, rang: i + 1, niveau_maitrise: i % 3, nm_livre: 0 }));
  f.nm_mj = 1;
  return f;
}

/**
 * Bi-classe Mercenaire (Combattant libre) et Moine (Templier), niveau 10 : les choix d'acquis des compétences d'arme (décision R120 : « Polyvalence »
 * et « Combattant libre », une compétence d'arme chacun) et les deux compétences différentes du Templier (R121 : « choisir 2 sur les 3 »).
 */
function ficheDesArmes() {
  const f = {
    ...ficheVide('Aldric'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu',
    xp: xpDuNiveau(10), mode_classe: 'bi',
    classes: [
      { rang: 1, classe_id: 'classes/mercenaire', specialite_id: 'classes/mercenaire#specialite:combattant-libre' },
      { rang: 2, classe_id: 'classes/moine', specialite_id: 'classes/moine#specialite:templier' },
    ],
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    acquis_choix: [
      { source: 'capacites/mercenaire-polyvalence', rang: 1, competence_id: 'arbalete', valeur: null },
      { source: 'capacites/mercenaire-combattant-libre', rang: 1, competence_id: 'arc', valeur: null },
      { source: 'capacites/moine-templier', rang: 1, competence_id: 'arme-lourde', valeur: null },
      { source: 'capacites/moine-templier', rang: 2, competence_id: 'arc', valeur: null },
    ],
  };
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options[0].id })));
  return f;
}

/**
 * Bi-classe Tueur (Flétrisseur) et Mage Vert (Mage émeraude), niveau 10 : « +5% de la compétence de l'arme choisie » et « +5% de la compétence de l'arme de
 * départ* » (décision R119) — l'arme de la maîtrise au choix de chaque classe, puis sa compétence ; prises dans les règles d'aujourd'hui (le site de dev
 * modifie les armes et les maîtrises) : la première arme qui laisse la compétence au choix, et sa dernière compétence.
 */
const TUEUR = 'capacites/tueur-fletrisseur';
const MAGE_VERT = 'capacites/mage-vert-mage-emeraude';
const familleDArmes = (id) => regles.familles_armes.find((x) => x.id === id);
/**
 * Le choix d'arme du don `source` de la fiche (décision R152 : l'arme est la famille de la maîtrise au choix de la classe du don) : la famille posée sur
 * cette maîtrise et la compétence choisie. { maitrise: { source, rang, arme_famille_id }, acquis: { source, rang, competence_id, valeur } }.
 */
function armeChoisie(f, source) {
  const c = M.acquisDesDons(regles, f).choix.find((x) => x.source === source && x.arme);
  assert.ok(c, `${source} : un choix d'arme`);
  const id = c.familles.find((x) => familleDArmes(x).competences.length > 1) ?? c.familles[0];
  return { maitrise: { source: c.maitrise, rang: 1, arme_famille_id: id }, acquis: { source, rang: c.rang, competence_id: familleDArmes(id).competences.at(-1), valeur: null } };
}
function ficheDeLArmeChoisie() {
  const f = {
    ...ficheVide('Sylas'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu',
    xp: xpDuNiveau(10), mode_classe: 'bi',
    classes: [
      { rang: 1, classe_id: 'classes/tueur', specialite_id: 'classes/tueur#specialite:fletrisseur' },
      { rang: 2, classe_id: 'classes/mage-vert', specialite_id: 'classes/mage-vert#specialite:mage-emeraude' },
    ],
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
  };
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options[0].id })));
  const choix = [armeChoisie(f, TUEUR), armeChoisie(f, MAGE_VERT)];
  f.maitrise_choix = choix.map((c) => c.maitrise);
  f.acquis_choix = choix.map((c) => c.acquis);
  return f;
}

/**
 * Drakos orange (Potentiel illimité, l'Archimage imposé : R23), niveau 1 : « 5% parmi les autres » et « Au choix parmi les autres » du tableau « Écaille
 * draconique » (décision R124 : « Tu peux en avoir un avec +5% Ruse et résisstance Poison ») ; la première option de chacun, prise dans les règles
 * d'aujourd'hui (le site de dev modifie le tableau).
 */
const DRAKOS_ORANGE = 'races/drakos#tableau:races/drakos#ethnie:drakos-orange';
const ligneDuDrakosOrange = () => regles.races.find((x) => x.id === 'races/drakos').dons_tableau.lignes.find((l) => l.ethnie_id === 'races/drakos#ethnie:drakos-orange');
function ficheDuDrakosOrange() {
  const ligne = ligneDuDrakosOrange();
  const f = {
    ...ficheVide('Orazh'), race_id: 'races/drakos', ethnie_id: 'races/drakos#ethnie:drakos-orange', magie_innee_id: 'magies/potentiel-illimite',
    caracteristique_magie_id: 'agilite', xp: xpDuNiveau(1),
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    acquis_choix: [{ source: DRAKOS_ORANGE, rang: 1, competence_id: ligne.acquis.find((b) => b.choix).choix[0], valeur: null }],
    resistance_choix: [{ source: DRAKOS_ORANGE, rang: 1, etat_id: ligne.resistances.au_choix[0].options[0] }],
  };
  f.classes = M.classesSelonLaMagieInnee(regles, f);
  return f;
}

/**
 * Mage Rouge, spécialité Rubis, niveau 10, « Charge lente… » choisi : le sort préparé (décision R115) — un sort d'attaque de NPM 1, son jet de magie et
 * la posture du moment de sa préparation (Offensif), alors que la posture cochée est Défensif.
 */
const BOULE_DE_FEU = 'magies/magie-du-feu#sort:boule-de-feu';
function ficheDuMageRouge() {
  const f = {
    ...ficheVide('Ignis'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu',
    xp: xpDuNiveau(10), posture_id: 'guide/postures#posture:defensif',
    classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: 'classes/mage-rouge#specialite:mage-rubis' }],
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    capacites: [{ capacite_id: 'capacites/mage-rouge-charge-lente' }],
  };
  f.sorts = M.sortsPossibles(regles, f).filter((s) => s.magie_id === 'magies/magie-du-feu').slice(0, 6)
    .map((s, i) => ({ sort_id: s.id, rang: i + 1, niveau_maitrise: 0, nm_livre: 0 }));
  assert.ok(f.sorts.some((s) => s.sort_id === BOULE_DE_FEU), 'Boule de feu parmi les sorts');
  f.sorts = f.sorts.map((s) => (s.sort_id === BOULE_DE_FEU ? { ...s, prepare: 1, prepare_jet: 57, prepare_posture_id: 'guide/postures#posture:offensif' } : s));
  return f;
}

// ------------------------------------------------------------------ les tests

test('sort préparé (décision R115) : le sort, son jet de magie et sa posture dans la note (« Sort préparé »), relus tels quels, point fixe ; sans jet ni posture, le nom seul ; ce que la fiche ne peut pas préparer est dit', async () => {
  const f = ficheDuMageRouge();
  assert.equal(M.sortPrepare(regles, commeLaPage(f))?.sort.id, BOULE_DE_FEU);
  const r = await verifier(f, 'sort préparé');
  const preparees = (cellules) => lignesDeLaNote(cellules).filter((l) => l.nom === 'sortPrepare').map((l) => l.valeur);
  assert.deepEqual(preparees(r.cellules), ['Boule de feu (jet 57, posture Offensif)']);
  assert.deepEqual(r.fiche.sorts.filter((s) => s.prepare === 1), [{ sort_id: BOULE_DE_FEU, rang: commeLaPage(f).sorts.find((s) => s.prepare === 1).rang, niveau_maitrise: 0, nm_livre: 0, prepare: 1, prepare_jet: 57, prepare_posture_id: 'guide/postures#posture:offensif' }]);
  // préparé sans jet (« si réussi ») ni posture (aucune n'était cochée) : le nom seul
  const sansJet = { ...f, sorts: f.sorts.map((s) => (s.prepare ? { ...s, prepare_jet: null, prepare_posture_id: null } : s)) };
  assert.deepEqual(preparees((await verifier(sansJet, 'sort préparé sans jet ni posture')).cellules), ['Boule de feu']);
  // une ligne que la fiche ne peut pas reprendre : un sort absent de la liste, un jet hors du D100, une posture inconnue, une fiche sans « Préparation »
  const relire = async (fiche, remplacer) => {
    const a = await allerRetour(fiche);
    const cellules = { ...a.cellules, [ORDINATEUR.note]: remplacer(a.cellules[ORDINATEUR.note]) };
    const classeur = await lireClasseur(await ecrireXlsx(MODELE, { cellules, remplis: a.remplis, alignements: a.alignements, descriptionImage: 'logo', titre: fiche.nom }), { nom: 'essai.xlsx' });
    return ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  };
  for (const [ecrit, perdu] of [
    ['Fouet ténébreux (jet 57)', 'Sort préparé : « Fouet ténébreux (jet 57) » ne désigne pas un sort de la liste'],
    ['Boule de feu (jet 140, posture Offensif)', 'Sort préparé : « Boule de feu (jet 140, posture Offensif) » : jet de magie hors de 1 à 100'],
    ['Boule de feu (posture Rêveuse)', 'Sort préparé (posture) : « Rêveuse » introuvable dans les règles'],
  ]) {
    const relu = await relire(f, (note) => note.replace('Sort préparé : Boule de feu (jet 57, posture Offensif)', `Sort préparé : ${ecrit}`));
    assert.deepEqual(relu.nonRepris, [perdu], ecrit);
    assert.ok(relu.fiche.sorts.every((s) => !s.prepare), `${ecrit} : aucun sort préparé`);
  }
  assert.deepEqual((await relire(f, (note) => note)).nonRepris, [], 'la note telle quelle');
  const sansDon = await relire({ ...f, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }], capacites: [] },
    (note) => `${note}\nSort préparé : Boule de feu (jet 57, posture Offensif)`);
  assert.deepEqual(sansDon.nonRepris, ['Sort préparé : « Boule de feu (jet 57, posture Offensif) » : la fiche n’a pas le don qui le permet (« Préparation », « Chargement »), ou ce sort n’est pas de ceux qu’il autorise']);
  // une seconde ligne « Sort préparé » : un seul sort préparé par fiche, la première est gardée, la seconde dite
  const autre = commeLaPage(f).sorts.find((s) => !s.prepare && M.sortsAPreparer(regles, commeLaPage(f)).some((x) => x.sort.id === s.sort_id));
  assert.ok(autre, 'un second sort que la fiche pourrait préparer');
  const nomDeLAutre = regles.sorts.find((x) => x.id === autre.sort_id).nom;
  const deux = await relire(f, (note) => note.replace('Sort préparé : Boule de feu (jet 57, posture Offensif)',
    `Sort préparé : Boule de feu (jet 57, posture Offensif)\nSort préparé : ${nomDeLAutre} (jet 12)`));
  assert.deepEqual(deux.nonRepris, [`Sort préparé : « ${nomDeLAutre} (jet 12) » : un seul sort préparé par fiche (décision R115)`]);
  assert.deepEqual(deux.fiche.sorts.filter((s) => s.prepare === 1).map((s) => [s.sort_id, s.prepare_jet]), [[BOULE_DE_FEU, 57]]);
  // la lecture de la ligne : des parenthèses qui ne disent ni un jet ni une posture font partie du nom
  assert.deepEqual(lireSortPrepare('Boule de feu (posture Focus, jet 3)'), { nom: 'Boule de feu', jet: 3, posture: 'Focus' });
  assert.deepEqual(lireSortPrepare('Mur (de glace)'), { nom: 'Mur (de glace)', jet: null, posture: null });
  assert.deepEqual(lireSortPrepare('Boule de feu'), { nom: 'Boule de feu', jet: null, posture: null });
});


test('armes élémentaires (décision R167) : nom, niveau, solidité et type physique choisi de la bombe reviennent tels quels, point fixe', async () => {
  const bombe = regles.armes_elementaires.find((a) => a.type_id === 'bombe' && a.magie_id === 'magies/magie-du-feu');
  const arc = regles.armes_elementaires.find((a) => a.type_id === 'arc' && a.magie_id === 'magies/magie-du-feu');
  const niveau = (n) => regles.ameliorations.find((a) => a.cible === 'arme' && a.niveau === n).id;
  const f = {
    ...ficheVide('Ignis R167'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu',
    armes: [{ rang: 1, arme_elementaire_id: arc.id, amelioration_id: niveau(5), durabilite: 3 }, { rang: 2, arme_elementaire_id: bombe.id, amelioration_id: niveau(2), type_degats_choisi: 'taille' }],
  };
  const r = await allerRetour(commeLaPage(f));
  assert.deepEqual(r.nonRepris, []);
  assert.equal(r.cellules[ORDINATEUR.armes[1].nom], bombe.nom);
  assert.ok(r.cellules[ORDINATEUR.armes[1].effet].split('\n').includes('Type de dégâts : Taille'));
  assert.deepEqual(canonique(r.fiche).armes, canonique(f).armes);
  assert.deepEqual(r.fiche.armes.map((a) => [a.arme_elementaire_id, a.amelioration_id, a.durabilite ?? null, a.type_degats_choisi ?? null]),
    [[arc.id, niveau(5), 3, null], [bombe.id, niveau(2), null, 'taille']]);
  assert.deepEqual(M.armeDeLaLigne(regles, r.fiche.armes[1]).types_degats, ['taille', 'magies/magie-du-feu']);
  // point fixe
  const encore = await allerRetour(commeLaPage(r.fiche));
  assert.deepEqual(canonique(encore.fiche).armes, canonique(r.fiche).armes);
  // sans choix : rien n'est écrit ni deviné
  const sans = await allerRetour(commeLaPage({ ...f, armes: [{ rang: 2, arme_elementaire_id: bombe.id }] }));
  assert.equal(sans.fiche.armes[0].type_degats_choisi ?? null, null);
});

test('entraînement (décision R104) : ses lignes reviennent compétences d’abord, puis textes, chacune telle quelle ; les choix d’acquis aussi', async () => {
  const f = { ...ficheRiche(), entrainements: [
    { rang: 1, competence_id: null, valeur: null, texte: 'Béni par la Dame du lac' }, { rang: 2, competence_id: 'arc', valeur: 3, texte: null },
    { rang: 3, competence_id: null, valeur: null, texte: 'Livre lu : Boule de feu' }, { rang: 4, competence_id: 'calme', valeur: 0, texte: null },
  ] };
  const r = await allerRetour(commeLaPage(f));
  assert.deepEqual(r.fiche.entrainements.map((l) => [l.rang, l.competence_id ?? l.texte, l.valeur]),
    [[1, 'arc', 3], [2, 'calme', 0], [3, 'Béni par la Dame du lac', null], [4, 'Livre lu : Boule de feu', null]]);
  assert.deepEqual(canonique(r.fiche).entrainements, canonique(f).entrainements);
  assert.deepEqual(r.fiche.acquis_choix, commeLaPage(f).acquis_choix);
});

test('choix d’acquis des compétences d’arme (décisions R120, R121) : une compétence d’arme par don, deux différentes pour le Templier, relues telles quelles', async () => {
  const f = ficheDesArmes();
  // les quatre choix sont ceux de dons débloqués, et tous faits
  assert.deepEqual(commeLaPage(f).acquis_choix, f.acquis_choix);
  assert.deepEqual(M.acquisDesDons(regles, f).choix.filter((c) => !c.repartition).map((c) => [c.source, c.rang, c.fait]),
    f.acquis_choix.map((x) => [x.source, x.rang, true]));
  const r = await verifier(f, 'compétences d’arme');
  assert.deepEqual(r.fiche.acquis_choix, f.acquis_choix);
  // une ligne « Acquis au choix » par choix, le Templier deux fois, dans l'ordre de ses rangs
  const lignes = lignesDeLaNote(r.cellules).filter((l) => l.nom === 'acquisChoix').map((l) => l.valeur);
  assert.deepEqual(lignes.filter((l) => l.startsWith('Templier')), ['Templier (Moine) : Arme Lourde', 'Templier (Moine) : Arc']);
  // la même compétence deux fois pour le Templier : la seconde ligne n'est pas reprise, et l'import le dit ; l'acquis écrit de l'Arc (+5 de plus que le
  // calcul sans ce choix) déduit le second choix, une remarque (décision R104 : « déduit quand une seule option l'explique »)
  const cellules = { ...r.cellules, [ORDINATEUR.note]: r.cellules[ORDINATEUR.note].replace('Templier (Moine) : Arc', 'Templier (Moine) : Arme Lourde') };
  const classeur = await lireClasseur(await ecrireXlsx(MODELE, { cellules, remplis: r.remplis, alignements: r.alignements, descriptionImage: 'logo', titre: f.nom }), { nom: 'essai.xlsx' });
  const relu = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  assert.ok(relu.nonRepris.some((x) => x.startsWith('Acquis au choix « Templier (Moine) : Arme Lourde » : déjà choisie pour ce don')), relu.nonRepris.join('\n'));
  assert.deepEqual(relu.fiche.acquis_choix.filter((x) => x.source === 'capacites/moine-templier'), f.acquis_choix.slice(2));
  assert.ok(relu.remarques.includes('Acquis au choix de Templier (Moine) (+5 %) déduit : Arc (l\'acquis du classeur)'), relu.remarques.join('\n'));
});

test('l’arme choisie (décisions R119, R126, R152) : la compétence de chaque choix et la famille de la maîtrise au choix (calculée, entre parenthèses) dans la note (« Acquis au choix »), relues telles quelles, point fixe ; une famille hors de la maîtrise au choix n’est pas reprise, une autre que la sienne est dite', async () => {
  const f = ficheDeLArmeChoisie();
  assert.deepEqual([commeLaPage(f).acquis_choix, commeLaPage(f).maitrise_choix], [f.acquis_choix, f.maitrise_choix], 'deux choix d’arme faits');
  const r = await verifier(f, 'arme choisie');
  assert.deepEqual([r.fiche.acquis_choix, r.fiche.maitrise_choix], [f.acquis_choix, f.maitrise_choix]);
  // une ligne par choix : « <don> : <compétence> (<famille d'armes>) »
  const choix = M.acquisDesDons(regles, f).choix.filter((c) => c.arme);
  const ligneDe = (c, familleId) => `${c.nom} : ${regles.competences.find((k) => k.id === c.choisi).nom} (${familleDArmes(familleId).nom})`;
  const lignes = lignesDeLaNote(r.cellules).filter((l) => l.nom === 'acquisChoix').map((l) => l.valeur);
  assert.deepEqual(lignes, choix.map((c) => ligneDe(c, c.arme_famille_id)));
  // une famille hors de la maîtrise au choix du Mage Vert (une arme de contact, décision R127) : pas reprise, et l'import le dit
  const mageVert = choix.find((c) => c.source === MAGE_VERT);
  const hors = regles.familles_armes.find((x) => x.maitrisable && !mageVert.familles.includes(x.id));
  assert.ok(hors, 'une famille maîtrisable que le Mage Vert ne choisit pas');
  const cellules = { ...r.cellules, [ORDINATEUR.note]: r.cellules[ORDINATEUR.note].replace(ligneDe(mageVert, mageVert.arme_famille_id), ligneDe(mageVert, hors.id)) };
  const classeur = await lireClasseur(await ecrireXlsx(MODELE, { cellules, remplis: r.remplis, alignements: r.alignements, descriptionImage: 'logo', titre: f.nom }), { nom: 'essai.xlsx' });
  const relu = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  assert.ok(relu.nonRepris.includes(`Acquis au choix « ${ligneDe(mageVert, hors.id)} » : pas une option de ce don`), relu.nonRepris.join('\n'));
  // la maîtrise au choix du Mage Vert est relue (R152 : c'est elle, l'arme) : sa compétence se déduit de l'acquis écrit (R104), une remarque le dit
  assert.deepEqual(relu.fiche.acquis_choix, f.acquis_choix);
  const competence = regles.competences.find((k) => k.id === mageVert.choisi).nom;
  assert.ok(relu.remarques.includes(`Acquis au choix de ${mageVert.nom} (+${mageVert.valeur} %) déduit : ${competence} (l'acquis du classeur)`), relu.remarques.join('\n'));
  // une autre famille de la maîtrise au choix du Mage Vert, qui offre la même compétence : la famille se calcule (R152), la compétence est gardée, et
  // l'import dit la famille écrite
  const autre = mageVert.familles.find((x) => x !== mageVert.arme_famille_id && familleDArmes(x).competences.includes(mageVert.choisi));
  assert.ok(autre, 'une autre famille du Mage Vert avec la même compétence');
  const cellulesAutre = { ...r.cellules, [ORDINATEUR.note]: r.cellules[ORDINATEUR.note].replace(ligneDe(mageVert, mageVert.arme_famille_id), ligneDe(mageVert, autre)) };
  const classeurAutre = await lireClasseur(await ecrireXlsx(MODELE, { cellules: cellulesAutre, remplis: r.remplis, alignements: r.alignements, descriptionImage: 'logo', titre: f.nom }), { nom: 'essai.xlsx' });
  const reluAutre = ficheDuClasseur(regles, classeurAutre.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  assert.deepEqual(reluAutre.nonRepris, [`Maîtrises d'armes du classeur : « arme choisie : ${mageVert.nom} ${familleDArmes(autre).nom} » (non reprises : la fiche les calcule d’après ses choix ; décision R148)`]);
  assert.deepEqual([reluAutre.fiche.acquis_choix, reluAutre.fiche.maitrise_choix], [f.acquis_choix, f.maitrise_choix]);
});

/**
 * Bi-classe Guerrier (Maître d'arme) et Mercenaire (Chasseur de primes), niveau 10, et l'accessoire « Un point de maîtrise d'arme » (R54) : des choix
 * de maîtrise de chaque genre (décision R148) — la maîtrise au choix du Guerrier, la ligne à répartir du Mercenaire (1 au plus par famille), les
 * 5 points limités du Maître d'arme (2 au plus par famille, R150 : le 3e sur ÉPÉES dépasse, il reste), les 5 points sans limite du Chasseur de primes,
 * l'accessoire — avec des points laissés à choisir entre deux points choisis.
 */
const POINT_DE_MAITRISE = regles.accessoires.find((a) => a.effets.some((e) => e.cible === 'maitrise_arme')).id;
function ficheDesMaitrises() {
  const f = {
    ...ficheVide('Brennus'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu',
    xp: xpDuNiveau(10), mode_classe: 'bi',
    classes: [
      { rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:maitre-darme' },
      { rang: 2, classe_id: 'classes/mercenaire', specialite_id: 'classes/mercenaire#specialite:chasseur-de-primes' },
    ],
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    accessoires: [{ emplacement: 'bague-1', accessoire_effet_id: POINT_DE_MAITRISE, maudit: 0, arme_famille_id: 'arc' }],
  };
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options[0].id })));
  const points = (source, familles) => familles.map((x, i) => x && { source, rang: i + 1, arme_famille_id: x }).filter(Boolean);
  f.maitrise_choix = [
    ...points('classes/guerrier#maitrise-arme:2', ['hache']),
    ...points('classes/mercenaire#maitrise-arme:1', ['arc', null, 'dagues']),
    ...points('capacites/guerrier-maitre-darme', ['epees', 'epees', 'epees', null, 'arc']),
    ...points('capacites/mercenaire-chasseur-de-primes', ['arc', 'arc', 'pugilat']),
  ];
  return f;
}

test('maîtrises d’armes (décisions R148 à R151) : les choix de chaque genre dans la note (« Maîtrise d’arme au choix »), les points à choisir marqués « ? », la famille de l’accessoire dans sa case ; les dés calculés dans la grille ; relus tels quels, point fixe', async () => {
  const f = ficheDesMaitrises();
  assert.deepEqual(canonique(f).maitrise_choix, [...f.maitrise_choix].sort((a, b) => a.source.localeCompare(b.source) || a.rang - b.rang),
    'tous les choix sont valables, le point refusé du Maître d’arme compris (R150)');
  const sources = M.sourcesDeMaitrise(regles, f);
  assert.ok(sources.some((s) => s.etat === 'refus') && sources.some((s) => s.type === 'accessoire' && s.etat === 'complete'));
  const r = await verifier(f, 'maîtrises');
  assert.deepEqual([canonique(r.fiche).maitrise_choix, r.fiche.accessoires.map((a) => a.arme_famille_id)], [canonique(f).maitrise_choix, ['arc']]);
  const titre = (source) => sources.find((s) => s.source === source).titre;
  const lignes = lignesDeLaNote(r.cellules).filter((l) => l.nom === 'maitriseChoix').map((l) => l.valeur);
  assert.deepEqual(lignes, [
    `${titre('classes/guerrier#maitrise-arme:2')} : HACHE`,
    `${titre('capacites/guerrier-maitre-darme')} : ÉPÉES, ÉPÉES, ÉPÉES, ?, ARC`,
    `${titre('classes/mercenaire#maitrise-arme:1')} : ARC, ?, DAGUES`,
    `${titre('capacites/mercenaire-chasseur-de-primes')} : ARC, ARC, PUGILAT`,
  ]);
  assert.deepEqual(lignes.slice(0, 2), ['Guerrier (maîtrise 2) : HACHE', 'Maître d\'arme (Guerrier) : ÉPÉES, ÉPÉES, ÉPÉES, ?, ARC']);
  // la grille : les dés calculés (R149 : 5 au plus ; ARC 1 + 1 + 2 + l'accessoire = 5 points, 4 comptés), le 2e dé et les suivants remplis
  for (const m of M.maitrisesParFamille(regles, f)) {
    const ligne = MAITRISES.find((x) => x.famille === m.famille);
    assert.deepEqual(casesDesDes(ligne).map((a) => r.remplis[a] ?? null), casesDesDes(ligne).map((_, i) => (i < m.des - 1 ? REMPLISSAGE_DE_ATTEINT : null)), m.famille);
  }
  assert.deepEqual(M.maitrisesParFamille(regles, f).filter((m) => m.points).map((m) => [m.famille, m.points, m.des]),
    [['epees', 4, 5], ['dagues', 1, 2], ['hache', 1, 2], ['pugilat', 1, 2], ['arc', 5, 5]]);
  // une ligne que la fiche ne peut pas reprendre : chaque point est dit, les autres sont gardés
  const note = r.cellules[ORDINATEUR.note].replace('ARC, ?, DAGUES', 'ARC, ARME DE MONSTRES, DAGUES, ÉPÉES').replace('Guerrier (maîtrise 2) : HACHE', 'Guerrier (maîtrise 2) : HACHES');
  const classeur = await lireClasseur(await ecrireXlsx(MODELE, { cellules: { ...r.cellules, [ORDINATEUR.note]: note }, remplis: r.remplis, alignements: r.alignements, descriptionImage: 'logo', titre: f.nom }), { nom: 'essai.xlsx' });
  const relu = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  const mercenaire = titre('classes/mercenaire#maitrise-arme:1');
  assert.deepEqual(relu.nonRepris.slice(0, 3), [
    `Maîtrise d'arme au choix « Guerrier (maîtrise 2) : HACHES » : « HACHES » introuvable parmi les familles d’armes`,
    `Maîtrise d'arme au choix « ${mercenaire} : ARC, ARME DE MONSTRES, DAGUES, ÉPÉES » : ARME DE MONSTRES n’est pas proposée par ${mercenaire}`,
    `Maîtrise d'arme au choix « ${mercenaire} : ARC, ARME DE MONSTRES, DAGUES, ÉPÉES » : ${mercenaire} n’a pas de point 4 à choisir`,
  ]);
  assert.deepEqual(canonique(relu.fiche).maitrise_choix, canonique(f).maitrise_choix.filter((x) => x.source !== 'classes/guerrier#maitrise-arme:2'));
  // les dés de la grille, écrits pour la HACHE, ne sont plus ceux du calcul : dits avec les autres (la ligne de la note montre que le classeur vient d'après la refonte)
  const desEcrits = M.maitrisesParFamille(regles, f).filter((m) => m.des > 1).map((m) => `${m.nom} ${M.notationDesDes(familleDArmes(m.famille).de, m.des)}`);
  assert.ok(desEcrits.includes('HACHE 2D10') && desEcrits.includes('PUGILAT 2D6/2D8/2D10'), desEcrits.join(', '));
  assert.deepEqual(relu.nonRepris.slice(3), [`Maîtrises d'armes du classeur : « ${desEcrits.join(', ')} » (non reprises : la fiche les calcule d’après ses choix ; décision R148)`]);
});

test('Drakos orange (décision R124) : la compétence (« Acquis au choix ») et la résistance (« Résistance au choix ») des autres lignes du tableau, relues telles quelles, point fixe ; l’altération d’aucune autre ligne : non reprise', async () => {
  const f = ficheDuDrakosOrange();
  assert.deepEqual([commeLaPage(f).acquis_choix, commeLaPage(f).resistance_choix], [f.acquis_choix, f.resistance_choix], 'les deux choix faits');
  const r = await verifier(f, 'Drakos orange');
  assert.deepEqual([r.fiche.acquis_choix, r.fiche.resistance_choix], [f.acquis_choix, f.resistance_choix]);
  const titre = regles.races.find((x) => x.id === 'races/drakos').dons_tableau.titre;
  const nom = (liste, id) => regles[liste].find((x) => x.id === id).nom;
  const note = lignesDeLaNote(r.cellules);
  assert.deepEqual(note.filter((l) => l.nom === 'acquisChoix').map((l) => l.valeur), [`${titre} : ${nom('competences', f.acquis_choix[0].competence_id)}`]);
  const resistance = `${titre} : ${nom('etats', f.resistance_choix[0].etat_id)}`;
  assert.deepEqual(note.filter((l) => l.nom === 'resistanceChoix').map((l) => l.valeur), [resistance]);
  // l'altération d'aucune autre ligne : pas reprise, l'import le dit
  const horsEtat = regles.etats.find((e) => !ligneDuDrakosOrange().resistances.au_choix[0].options.includes(e.id));
  const cellules = { ...r.cellules, [ORDINATEUR.note]: r.cellules[ORDINATEUR.note].replace(`Résistance au choix : ${resistance}`, `Résistance au choix : ${titre} : ${horsEtat.nom}`) };
  const classeur = await lireClasseur(await ecrireXlsx(MODELE, { cellules, remplis: r.remplis, alignements: r.alignements, descriptionImage: 'logo', titre: f.nom }), { nom: 'essai.xlsx' });
  const relu = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  assert.ok(relu.nonRepris.includes(`Résistance au choix « ${titre} : ${horsEtat.nom} » : pas une option de ce choix`), relu.nonRepris.join('\n'));
  assert.deepEqual(relu.fiche.resistance_choix, []);
});

test('résistances à une magie (décision R137) : l’Anansi d’Arcane (une magie tirée) et « Résilience » (une magie au choix) dans la note (« Résistance au choix »), relues telles quelles, point fixe ; l’Arcane : non reprise', async () => {
  const ARCANE = 'magies/magie-de-larcane';
  const f = {
    ...ficheVide('Tisseuse'), race_id: 'races/anansi', ethnie_id: 'races/anansi#ethnie:anansi-darcane', magie_innee_id: ARCANE, xp: xpDuNiveau(5),
    classes: [{ rang: 1, classe_id: 'classes/ocultomancien', specialite_id: 'classes/ocultomancien#specialite:specialiste' }],
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    resistance_choix: [
      { source: 'races/anansi#don:arcane-en-innee', rang: 1, magie_id: 'magies/magie-du-feu' },
      { source: 'capacites/ocultomancien-resilience', rang: 1, magie_id: 'magies/magie-de-la-glace' },
    ],
  };
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options.find((o) => o.id === 'capacites/ocultomancien-resilience')?.id ?? g.options[0].id })));
  assert.deepEqual(commeLaPage(f).resistance_choix, f.resistance_choix, 'les deux choix faits');
  const r = await verifier(f, 'résistances à une magie');
  assert.deepEqual(r.fiche.resistance_choix, f.resistance_choix);
  const note = lignesDeLaNote(r.cellules).filter((l) => l.nom === 'resistanceChoix').map((l) => l.valeur);
  assert.deepEqual(note, ['Anansi d\'Arcane : Feu', 'Résilience (Ocultomancien) : Glace']);
  // l'Arcane (exclue par le don) : pas reprise, l'import le dit
  const cellules = { ...r.cellules, [ORDINATEUR.note]: r.cellules[ORDINATEUR.note].replace('Résistance au choix : Résilience (Ocultomancien) : Glace', 'Résistance au choix : Résilience (Ocultomancien) : Arcane') };
  const classeur = await lireClasseur(await ecrireXlsx(MODELE, { cellules, remplis: r.remplis, alignements: r.alignements, descriptionImage: 'logo', titre: f.nom }), { nom: 'essai.xlsx' });
  const relu = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE, logo: LOGO, empreintePortrait: null });
  assert.ok(relu.nonRepris.includes('Résistance au choix « Résilience (Ocultomancien) : Arcane » : pas une option de ce choix'), relu.nonRepris.join('\n'));
  assert.deepEqual(relu.fiche.resistance_choix, f.resistance_choix.slice(0, 1));
});

test('magie tirée d’un don du Flagelleur (décision R163) : Potentiel Illimité, Archimage et Flagelleur Masochiste, « Punis-moi ... » : « Punis-moi ... (Flagelleur) : Feu » dans la note, relue telle quelle, point fixe ; les paliers exportés la comptent', async () => {
  const PUNIS = 'capacites/flagelleur-puni-moi';
  const f = {
    ...ficheVide('Flagelleuse'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/potentiel-illimite',
    caracteristique_magie_id: 'intelligence', xp: xpDuNiveau(13), mode_classe: 'bi',
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    resistance_choix: [{ source: PUNIS, rang: 1, magie_id: 'magies/magie-du-feu' }],
  };
  f.classes = [...M.classesSelonLaMagieInnee(regles, f), { rang: 2, classe_id: 'classes/flagelleur', specialite_id: 'classes/flagelleur#specialite:masochiste' }];
  f.classes = f.classes.map((c) => ({ ...c, specialite_id: c.specialite_id ?? M.trouver(regles.classes, c.classe_id).specialites[0]?.id ?? null }));
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options.find((o) => o.id === PUNIS)?.id ?? g.options[0].id })));
  assert.ok(f.capacites.some((c) => c.capacite_id === PUNIS), 'le don débloqué et choisi');
  assert.deepEqual(commeLaPage(f).resistance_choix, f.resistance_choix, 'le choix fait');
  const r = await verifier(f, 'magie tirée du Flagelleur');
  assert.deepEqual(r.fiche.resistance_choix, f.resistance_choix);
  assert.deepEqual(lignesDeLaNote(r.cellules).filter((l) => l.nom === 'resistanceChoix').map((l) => l.valeur), ['Punis-moi ... (Flagelleur) : Feu']);
  // les paliers écrits : Brûlure, Gel et Pétrifié en Résistance (+1 du don, rien de la magie Feu : le PI n'hérite pas de ses listes)
  const resistance = CASES_RESISTANCES.find((k) => k.palier === 'resistance');
  assert.deepEqual(r.cellules[resistance.cibles].split(', ').sort(), ['Brûlure', 'Gel', 'Pétrifié'].sort());
  // sans le choix, rien dans la note ni dans les paliers
  const sans = await allerRetour({ ...f, resistance_choix: [] });
  assert.deepEqual(lignesDeLaNote(sans.cellules).filter((l) => l.nom === 'resistanceChoix'), []);
  assert.ok(!sans.cellules[resistance.cibles]);
});

test('fiche riche (mono-classe, tout rempli, débordements dans la note) : relue telle quelle, point fixe', async () => {
  const f = ficheRiche();
  // une arme abîmée, une arme cassée (décision R74) : sous leur maximum, gardées telles quelles
  assert.ok(f.armes.every((x) => x.durabilite < M.durabiliteMaxDArme(regles, x)));
  const r = await verifier(f, 'fiche riche');
  assert.deepEqual(r.fiche.armes.map((x) => x.durabilite), [1, 0]);
  assert.deepEqual(ORDINATEUR.armes.map((x) => r.cellules[x.solidite]), f.armes.map((x) => `${x.durabilite} / ${M.durabiliteMaxDArme(regles, x)}`));
  assert.equal(r.cellules[ORDINATEUR.armes[1].degats], M.degatsDArme(regles, f, 2).texte, 'une arme cassée garde ses dégâts dans le classeur');
  // l'entraînement (décision R104) : ses lignes relues à l'identique ; les choix d'acquis des dons aussi ; les gains de niveau (R73) aussi
  assert.deepEqual(r.fiche.entrainements, commeLaPage(f).entrainements);
  assert.deepEqual(r.fiche.acquis_choix, commeLaPage(f).acquis_choix);
  assert.equal(r.fiche.acquis_choix.length, 3, 'les trois choix sont ceux de dons débloqués');
  assert.deepEqual([r.fiche.gains_sante, r.fiche.gains_chakra], [f.gains_sante, f.gains_chakra]);
  // des textes que l'import relit, trop longs pour leur case : coupés (« … »), la suite dans la note, recollés à l'import
  const suites = r.cellules[ORDINATEUR.note].split('\n').filter((l) => l.startsWith('Suite de la case ')).map((l) => /^Suite de la case ([A-Z]+\d+) : /.exec(l)[1]);
  const lues = [ORDINATEUR.armes[0].effet, ORDINATEUR.accessoires['bracelet-1'], ORDINATEUR.ceinture[2], 'L73', 'AA51', casesDuDon(DONS.entrainement).effet];
  assert.deepEqual(lues.filter((a) => !suites.includes(a)), [], `cases coupées : ${suites.join(', ')}`);
  for (const a of lues) assert.match(r.cellules[a], /…$/, a);
  // la suite de l'effet de l'arme ne porte que ce que l'import relit : ni l'effet du catalogue, ni les lignes « Deux armes », « Non compté »
  const suiteDeLArme = r.cellules[ORDINATEUR.note].split('\n').find((l) => l.startsWith(`Suite de la case ${ORDINATEUR.armes[0].effet} : `));
  const catalogue = regles.armes.find((a) => a.id === f.armes[0].arme_id).effet;
  assert.ok(!suiteDeLArme.includes(catalogue.split('\n')[0]) && !/Deux armes|Non compté/.test(suiteDeLArme), suiteDeLArme);
  // des textes affichés coupés (descriptions des sorts…) : sans suite, la fin « … » dans leur case
  const affichees = Object.keys(r.cellules).filter((a) => /^AM(5[5-9]|6\d|7[0-4])$/.test(a) && /…$/.test(r.cellules[a]));
  assert.ok(affichees.length > 0 && affichees.every((a) => !suites.includes(a)), `descriptions coupées : ${affichees.join(', ')}`);
  assert.ok(Object.values(r.alignements).some((x) => x.reduire) && Object.values(r.alignements).some((x) => x.retour), 'réduction et retour à la ligne');
  // les débordements sont bien passés par la note : la fiche relue en a autant que la fiche écrite
  assert.ok(f.sorts.length > ORDINATEUR.sorts.lignes.length && r.fiche.sorts.length === f.sorts.length);
  assert.ok(f.inventaire.length > 48 && r.fiche.inventaire.length === f.inventaire.length);
  assert.ok(r.cellules[ORDINATEUR.note].includes(MARQUEUR_DES_NOTES));
  // l'AP et l'AM de l'armure sur chaque partie (décision R108), écrits dans la grille et non relus : 0 sur le torse cassé, la valeur de l'armure ailleurs
  const parPartie = M.armureParPartie(regles, f);
  assert.ok(parPartie.find((p) => p.id === 'torse').cassee && parPartie.some((p) => !p.cassee && p.ap > 0));
  for (const p of parPartie) {
    const colonne = ORDINATEUR.armure.colonnes[p.id];
    assert.deepEqual([r.cellules[`${colonne}${ORDINATEUR.armure.lignes.ap}`], r.cellules[`${colonne}${ORDINATEUR.armure.lignes.am}`]], [p.ap, p.am], p.id);
  }
});

test('bouclier cassé (décision R108) : 0 AP et 0 AM écrits, sa solidité « 0 / M » relue telle quelle, point fixe', async () => {
  const f = { ...ficheRiche(), bouclier_solidite: 0 };
  const r = await verifier(f, 'bouclier cassé');
  assert.equal(r.fiche.bouclier_solidite, 0);
  assert.deepEqual([r.cellules[ORDINATEUR.bouclier.ap], r.cellules[ORDINATEUR.bouclier.am]], [0, 0]);
});

test('bi-classe au Potentiel Illimité : relue telle quelle, point fixe', async () => {
  await verifier(ficheBiPotentiel(), 'Potentiel Illimité');
});

test('les personnages fil rouge du guide : relus tels quels, point fixe', async () => {
  const personnages = chargerFilRouge(db);
  assert.equal(personnages.length, FIL_ROUGE.length);
  for (const p of personnages) {
    // leurs choix (FIL_ROUGE), comme la page les poserait, et ce que le guide en dit (titre)
    const choix = FIL_ROUGE.find((x) => x.id === p.id);
    const f = {
      ...ficheVide(p.titre), race_id: choix.race, ethnie_id: choix.ethnie, magie_innee_id: choix.magie,
      classes: [{ rang: 1, classe_id: choix.classe, specialite_id: null }],
    };
    await verifier(f, p.id);
  }
});

test('fiches auto du propriétaire (Lucien, Louise) : importées, exportées, relues telles quelles, point fixe ; une note courte', async () => {
  for (const qui of ['lucien', 'louise']) {
    const values = JSON.parse(readFileSync(new URL(`./fixtures/fiche-auto-${qui}.json`, import.meta.url), 'utf8')).values;
    const auto = ficheDuClasseur(regles, feuilleDeGrille(values));
    assert.equal(auto.disposition, 'auto');
    // une fiche auto porte l'armure et son « élément » (avant la décision R165) : la page la convertit comme la base vivante (sansPartiesRetirees : l'élément
    // devient l'armure, avec son amélioration ; l'armure d'origine notée, datée), puis la relit telle quelle
    const noms = {
      armure: (x) => M.trouver(regles.armures, x)?.nom ?? null, armureElementaire: (x) => M.trouver(regles.armures_elementaires, x)?.nom ?? null,
      amelioration: (x) => M.trouver(regles.ameliorations, x)?.niveau ?? null, emplacement: (x) => M.trouver(regles.emplacements_armure, x)?.nom ?? null,
    };
    const fiche = sansPartiesRetirees(auto.fiche, { instant: '2026-10-23T08:00:00Z', noms });
    if (auto.fiche.armure_id && auto.fiche.armure_elementaire_id) {
      assert.deepEqual([fiche.armure_id, fiche.armure_elementaire_id], [null, auto.fiche.armure_elementaire_id], `${qui} : l’élément devient l’armure (R165 (8))`);
      assert.ok(fiche.notes.split('\n').some((l) => l.startsWith(`[23/10/2026] ${PREFIXE_DE_RETRAIT}l’armure « ${noms.armure(auto.fiche.armure_id)} »`)
        && l.includes(`est devenue l’armure élémentaire « ${noms.armureElementaire(auto.fiche.armure_elementaire_id)} »`)), `${qui} : la note de la conversion`);
    }
    const r = await verifier(fiche, qui);
    // l'entraînement (L42) et les gains de niveau de la fiche auto reviennent tels quels (verifier) ; la note : bi-classe, gains de niveau, Mode Hyper
    // 100 %, et au plus deux suites (un libellé d'accessoire, un événement trop longs pour leur case)
    const lues = lignesDeLaNote(r.cellules);
    assert.ok(lues.filter((l) => l.nom === 'suite').length <= 2, `${qui} : ${lues.filter((l) => l.nom === 'suite').map((l) => l.adresse).join(', ')}`);
    assert.ok(lues.length <= 7, `${qui} : ${lues.length} lignes`);
  }
});

test('notes plus longues qu’une case de tableur : un avertissement à l’export ; à l’import, toutes les données, les notes raccourcies et une remarque', async () => {
  // un journal de campagne de 40 000 caractères : sans précaution, la fin de la case (le marqueur, les gains de niveau…) serait perdue
  const notes = Array.from({ length: 2000 }, (_, i) => `Séance ${i + 1} : la troupe avance vers le nord.`).join('\n').slice(0, 40_000);
  const f = { ...ficheRiche(), notes };
  const r = await allerRetour(f);
  assert.equal(r.avertissements.length, 1);
  assert.match(r.avertissements[0], /^Notes trop longues pour une case de tableur \(32\u00a0767 caractères\) : les \d{1,3}(?:\u00a0\d{3})* derniers caractères ne sont pas dans le classeur\.$/);
  assert.equal(r.cellules[ORDINATEUR.note].length, LONGUEUR_MAX_D_UNE_CASE);
  assert.deepEqual(r.nonRepris, []);
  assert.deepEqual(r.remarques, [`Notes : raccourcies à l'export (la case NOTE est pleine : ${enChiffres(LONGUEUR_MAX_D_UNE_CASE)} caractères) ; leur fin n'est pas dans le classeur`]);
  assert.ok(r.fiche.notes.endsWith('…') && notes.startsWith(r.fiche.notes.slice(0, -1)));
  assert.equal(notes.length - (r.fiche.notes.length - 1), Number(/les ([\d\u00a0]+) derniers/.exec(r.avertissements[0])[1].replace(/\u00a0/g, '')), 'l’avertissement compte ce qui manque');
  // tout le reste est relu, gains de niveau compris (pas reconstitués)
  assert.deepEqual(canonique({ ...r.fiche, notes }), canonique(f));
});

/** Une feuille relue, écrite en .csv comme le font Google Sheets et LibreOffice (« , », guillemets doublés, sauts de ligne entre guillemets). */
function enCsv(feuille) {
  const lignes = [];
  for (let l = 1; l <= 75; l += 1) {
    const valeurs = [];
    for (let c = 1; c <= 78; c += 1) {
      const t = feuille.cellules.get(`${lettresDeColonne(c)}${l}`)?.texte ?? '';
      valeurs.push(/[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
    }
    lignes.push(valeurs.join(','));
  }
  return `${lignes.join('\r\n')}\r\n`;
}

test('par un .csv (Fichier › Télécharger) : la fiche relue, maîtrises comprises (décision R148 : les choix sont dans la note, les dés que portaient les couleurs se calculent) ; sans choix dans la note, une remarque dit que les dés ne se lisent pas', async () => {
  const enCsvRelu = async (fiche) => {
    const { octets } = await allerRetour(fiche);
    const classeur = await lireClasseur(new TextEncoder().encode(enCsv((await lireClasseur(octets)).feuille('Personnage'))), { nom: 'essai.csv' });
    assert.equal(classeur.format, 'csv');
    return ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.csv', date: DATE, logo: LOGO, format: classeur.format });
  };
  const f = ficheRiche();
  assert.ok(commeLaPage(f).maitrise_choix.length > 0);
  const r = await enCsvRelu(f);
  assert.deepEqual([r.nonRepris, r.remarques], [[], []]);
  assert.deepEqual(canonique(r.fiche), canonique(f));
  // sans choix de maîtrise dans la note (un classeur d'avant la refonte, ou une fiche sans choix) : les dés d'un classeur d'avant ne seraient pas notés
  const sansChoix = await enCsvRelu({ ...f, maitrise_choix: [] });
  assert.deepEqual([sansChoix.nonRepris, sansChoix.remarques], [[], [REMARQUE_MAITRISES_CSV]]);
  assert.deepEqual(canonique(sansChoix.fiche), canonique({ ...f, maitrise_choix: [] }));
});

test('portrait : la vignette à la place du logo, marquée « portrait:<empreinte> », est relue comme le portrait ; gardé quand l’empreinte est celle de la fiche ouverte', async () => {
  // un JPEG 2 × 2 (Pillow, qualité 50), comme la vignette que dessine la page
  const jpeg = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDHooorhPqD/9k=', 'base64'));
  const fiche = { ...ficheVide('Portraitiste'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', classes: [{ rang: 1, classe_id: 'classes/mage', specialite_id: null }] };
  const { cellules, remplis } = cellulesDeLaFiche(regles, fiche, { date: DATE });
  const lire = async (options) => (await lireClasseur(await ecrireXlsx(MODELE, { cellules, remplis, ...options }))).feuille('Personnage');
  const avecPortrait = await lire({ image: { octets: jpeg, type: 'image/jpeg' }, descriptionImage: 'portrait:3f2a9c0112345678' });
  const garde = ficheDuClasseur(regles, avecPortrait, { logo: LOGO, empreintePortrait: '3f2a9c0112345678' });
  assert.deepEqual([garde.image?.de, garde.image?.type, garde.image?.description], ['A1', 'image/jpeg', 'portrait:3f2a9c0112345678']);
  assert.deepEqual(garde.image.octets, jpeg);
  assert.equal(garde.portraitGarde, true, 'la fiche ouverte a cette image : la page garde l’image d’origine et son cadrage');
  assert.equal(ficheDuClasseur(regles, avecPortrait, { logo: LOGO, empreintePortrait: 'autre' }).portraitGarde, false, 'une autre fiche : la vignette devient le portrait');
  assert.deepEqual(ficheDuClasseur(regles, avecPortrait, { logo: LOGO }).nonRepris, []);
  // sans portrait : le logo du modèle, marqué « logo », n'est pas un portrait
  const sans = ficheDuClasseur(regles, await lire({ descriptionImage: 'logo' }), { logo: LOGO });
  assert.deepEqual([sans.image, sans.portraitGarde], [null, false]);
});

// ------------------------------------------------------------------ les modules du tableur : réservés au script de la page /fiche/

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const MODULES_DU_TABLEUR = ['lib/zip.mjs', 'lib/xml-mini.mjs', 'lib/tableur-lecture.mjs', 'lib/tableur-ecriture.mjs', 'lib/tableur-mesure.mjs',
  'lib/fiche-tableur-cases.mjs', 'lib/fiche-tableur-export.mjs', 'lib/fiche-tableur-import.mjs'];
const fichiersDe = (dossier, extension) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? fichiersDe(join(dossier, e.name), extension) : e.name.endsWith(extension) ? [join(dossier, e.name)] : []);
/** Les modules qu'importe un texte (statique ou dynamique), résolus depuis son dossier ; ceux de node: et des paquets à part. */
function importsDe(texte, dossier) {
  return [...texte.matchAll(/(?:^|[\s;])import\s*(?:[^'"();]*?\bfrom\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1] ?? m[2]).map((x) => (x.startsWith('.') ? resolve(dossier, x.replace(/\?.*$/, '')) : x));
}
/** Tout ce qu'atteint un point d'entrée, de module en module (chemins relatifs à src/, ou nom de paquet). */
function atteints(fichier, vus = new Set()) {
  for (const cible of importsDe(readFileSync(fichier, 'utf8'), dirname(fichier))) {
    const nom = cible.startsWith('/') ? relative(SRC, cible).split('\\').join('/') : cible;
    if (vus.has(nom)) continue;
    vus.add(nom);
    if (cible.startsWith('/') && /\.(mjs|js|ts)$/.test(cible)) atteints(cible, vus);
  }
  return vus;
}

test('modules du tableur : seul le script de la page /fiche/ les importe (version portable), sans lib/text.mjs ni module de Node', () => {
  const fiche = atteints(join(SRC, 'scripts', 'fiche.mjs'));
  for (const m of MODULES_DU_TABLEUR) assert.ok(fiche.has(m), `src/scripts/fiche.mjs atteint ${m}`);
  assert.deepEqual([...fiche].filter((m) => m.startsWith('node:') || ['lib/text.mjs', 'lib/fiche-modele.mjs', 'lib/donnees.mjs', 'lib/monnaies.mjs'].includes(m)), []);
  // les autres scripts de page (et les scripts des composants et des pages Astro) n'en atteignent aucun
  const autres = [...fichiersDe(join(SRC, 'scripts'), '.mjs').filter((f) => !f.endsWith(join('scripts', 'fiche.mjs'))),
    ...[...fichiersDe(join(SRC, 'components'), '.astro'), ...fichiersDe(join(SRC, 'pages'), '.astro'), ...fichiersDe(join(SRC, 'layouts'), '.astro')]];
  for (const f of autres) {
    let vus;
    if (f.endsWith('.astro')) {
      // les <script> de la page ou du composant (le frontmatter tourne au build)
      vus = new Set();
      for (const [, corps] of readFileSync(f, 'utf8').matchAll(/<script(?![^>]*is:inline)[^>]*>([\s\S]*?)<\/script>/g)) {
        for (const cible of importsDe(corps, dirname(f))) {
          if (!cible.startsWith('/')) continue;
          if (cible.endsWith(join('scripts', 'fiche.mjs'))) continue;
          vus.add(relative(SRC, cible).split('\\').join('/'));
          for (const x of atteints(cible)) vus.add(x);
        }
      }
    } else vus = atteints(f);
    assert.deepEqual(MODULES_DU_TABLEUR.filter((m) => vus.has(m)), [], relative(SRC, f));
  }
});
