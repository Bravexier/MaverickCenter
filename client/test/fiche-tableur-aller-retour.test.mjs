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
import { ficheVide, PARTIES_DE_FICHE } from '../src/lib/fiche-format.mjs';
import { modeleXlsx, partiesDuModele } from '../src/lib/fiche-modele.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { casesDuDon, DONS, lettresDeColonne, LONGUEUR_MAX_D_UNE_CASE, MARQUEUR_DES_NOTES, ORDINATEUR } from '../src/lib/fiche-tableur-cases.mjs';
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
  f.maitrises_armes = M.maitrisesValables(regles, f);
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
  const familles = ordre(regles.familles_armes.map((c) => c.id));
  const emplacementsArmure = ordre(regles.emplacements_armure.map((e) => e.id));
  const emplacementsAccessoire = ordre(M.EMPLACEMENTS_ACCESSOIRES.map(([e]) => e));
  const tri = {
    classes: (a, b) => a.rang - b.rang,
    caracteristiques: parCle('caracteristique_id', caracs),
    competences: parCle('competence_id', competences),
    metier_bonus: (a, b) => a.rang - b.rang,
    capacites: (a, b) => a.capacite_id.localeCompare(b.capacite_id),
    maitrises_armes: parCle('arme_famille_id', familles),
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
    maitrises_armes: [{ arme_famille_id: 'epees', des: 4 }, { arme_famille_id: 'arc', des: 2 }, { arme_famille_id: 'pugilat', des: 3 }],
    armes: [
      {
        rang: 1, arme_id: 'ressources/armes#arme:epees:epee-longue', materiau_id: trouve('materiaux_armes', (m) => m.nom === 'Acier', 'Acier').id,
        amelioration_id: trouve('ameliorations', (a) => a.cible === 'arme' && a.niveau === 3, 'amélioration 3').id,
        arme_elementaire_id: 'ressources/pieces-elementaires#arme-elementaire:epee:feu',
        amelioration_elementaire_id: trouve('ameliorations', (a) => a.cible === 'arme_elementaire' && a.niveau === 2, 'amélioration élémentaire 2').id,
        effet_en_plus: `Gravée au nom de sa mère\nTranchant : comme au premier jour\n${LONG}\n\n${LONG}`, durabilite: 1,
      },
      { rang: 2, arme_id: 'ressources/armes#arme:dagues:dague', materiau_id: regles.materiau_arme_defaut, durabilite: 0 },
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
    // l'armure portée (décision R95) : une armure complète, son amélioration, son élément et l'amélioration de l'élément ; deux parties abîmées
    armure_id: trouve('armures', (a) => a.solidite >= 3 && Number(a.solidite_uni) !== 1, 'armure de solidité 3').id,
    armure_amelioration_id: trouve('ameliorations', (a) => a.cible === 'armure' && a.niveau === 2, 'armure 2').id,
    armure_elementaire_id: regles.armures_elementaires[1].id,
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
    const r = await verifier(auto.fiche, qui);
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

test('par un .csv (Fichier › Télécharger) : la fiche relue, sauf les maîtrises que portaient les couleurs ; une remarque le dit', async () => {
  const f = ficheRiche();
  const { octets } = await allerRetour(f);
  const classeur = await lireClasseur(new TextEncoder().encode(enCsv((await lireClasseur(octets)).feuille('Personnage'))), { nom: 'essai.csv' });
  assert.equal(classeur.format, 'csv');
  const r = ficheDuClasseur(regles, classeur.feuille('Personnage'), { nomFichier: 'essai.csv', date: DATE, logo: LOGO, format: classeur.format });
  assert.ok(f.maitrises_armes.length > 0);
  assert.deepEqual([r.nonRepris, r.remarques, r.fiche.maitrises_armes], [[], [REMARQUE_MAITRISES_CSV], []]);
  assert.deepEqual(canonique({ ...r.fiche, maitrises_armes: f.maitrises_armes }), canonique(f));
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
