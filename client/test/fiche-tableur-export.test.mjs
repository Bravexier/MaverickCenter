// Export de la fiche en tableur (lib/fiche-tableur-export.mjs ; demande du propriétaire, 2026-10-15) sur les vraies règles (la base construite) : chaque
// case attendue du modèle ordinateur est comparée aux fonctions du moteur (lib/fiche-moteur.mjs, lib/sort-maitrise.mjs), jamais à un nombre recopié ;
// les débordements des listes vont dans la case NOTE (lignes « Clé : valeur » sous le marqueur) ; les cases que le site ne calcule pas restent vides
// (la solidité d'une arme s'écrit « N / M » depuis la décision R74, l'entraînement en L42 depuis la R71) ;
// toute case écrite est dans A1:BZ75 et n'est pas couverte par une fusion du modèle (seule la case haut-gauche d'une fusion s'écrit). Fiches construites
// ici : une riche (race à ethnie, deux magies, mono-classe au niveau 16 avec spécialités et dons à choix, métier à choix, accessoires dont un à fourchette
// et un maudit, armes forgées, armure en pièces, bouclier, 60 objets, 6 événements, 25 sorts avec NM offerts, posture), une vide, une au Potentiel
// Illimité, un Mort-vivant (tableau de dons de la race), une bi-classée et une aux dons de trop.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import {
  CASES_CARACTERISTIQUES, CASES_COMPETENCES, CASES_POSTURES, CASES_RESISTANCES, DONS, EMPLACEMENTS_DU_MODELE, LONGUEUR_MAX_D_UNE_CASE, MAITRISES,
  MARQUEUR_DES_NOTES, ORDINATEUR, REMPLISSAGE_DE_ATTEINT, TITRE_DE_L_INVENTAIRE, casesDesDes, casesDuDon, decouperAdresse,
  numeroDeColonne,
} from '../src/lib/fiche-tableur-cases.mjs';
import {
  ARMURE_COMPLETE, CLES_DE_LA_NOTE, CLES_DES_ACCESSOIRES_SANS_CASE, CLES_D_INFORMATION, ETOILE, LIGNES_D_ARME, LIGNES_D_ARMURE, MARQUE_DE_POSTURE,
  MODE_HYPER_CENT_DEBLOQUE, NON, OUI, SEPARATEUR_DE_CLE, SEPARATEUR_DE_LISTE, SEPARATEUR_EN_LIGNE, SUITE_DE_LA_CASE, TITRES_DES_POSTURES, TYPES_DE_DON,
  avertissementDeCase, avertissementDesDonnees, avertissementDesNotes, cellulesDeLaFiche, decouperEvenement, ligneDExport, ligneDeNote, lignesDAccessoire,
  lignesDArme, lignesDArmure, lireAccessoire, lireChoixDuMetier, lireEffetDAmelioration, lireEffetDArme, lireGains, lireLigneDArmure, lireLigneDeNote,
  lireChoixDeMaitrise, lireListe, lireNiveauDAmelioration, lireNmOfferts, lireObjet, lireSortEnSuite, partiesDeLArme, partiesDuMetier, texteDAmelioration,
  texteDObjet, texteDeLaNote, texteDeSortEnSuite, texteDesChoixDeMaitrise, texteDesGains, texteDesNmOfferts,
} from '../src/lib/fiche-tableur-export.mjs';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import { coutEnUneCase } from '../src/lib/sort-cout.mjs';
import { modesAuNm, valeurAuNm } from '../src/lib/sort-maitrise.mjs';
import { zonesDuClasseur } from '../src/lib/tableur-ecriture.mjs';
import { recollerLeTexte, sansLaCoupure, tientDans } from '../src/lib/tableur-mesure.mjs';

// les coûts que la migration 0063 a répartis (décision R105) et leur écriture dans le classeur
const REPARTIS = new Map(JSON.parse(readFileSync(new URL('../../data/migrations/0063-cout-secondaire.json', import.meta.url), 'utf8')).repartis.map((r) => [r.id, r]));

const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false })))); // tel que la page le reçoit
const DATE = '15/10/2026';
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const trouve = (liste, critere, quoi) => {
  const x = regles[liste].find(critere);
  assert.ok(x, `${liste} : ${quoi}`);
  return x;
};
const signe = (n) => (n > 0 ? `+${n}` : String(n));
const nomDe = (liste, id) => M.trouver(regles[liste], id).nom;
/** Une case d'une seule rangée : chaque partie et chacune de ses lignes, sans blancs de bord, séparées par « · » (SEPARATEUR_EN_LIGNE). */
const enUneLigne = (parties) => parties.flatMap((p) => String(p ?? '').split('\n')).map((x) => x.trim()).filter(Boolean).join(SEPARATEUR_EN_LIGNE);
const uneLigne = (t) => String(t ?? '').split('\n').map((x) => x.trim()).filter(Boolean).join(' ');

// ------------------------------------------------------------------ le modèle stocké : fusions et textes (lecture sans dépendance)
const MODELE = new URL('../src/modeles/fiche-personnage/xl/', import.meta.url);
const feuille = readFileSync(new URL('worksheets/sheet1.xml', MODELE), 'utf8');
const chaines = [...readFileSync(new URL('sharedStrings.xml', MODELE), 'utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
  .map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
    .replace(/&#10;/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
const textesDuModele = new Map();
for (const [, adresse, attrs, corps] of feuille.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
  const v = corps && /<v>([\s\S]*?)<\/v>/.exec(corps)?.[1];
  if (v !== undefined && v !== null) textesDuModele.set(adresse, /t="s"/.test(attrs) ? chaines[Number(v)] : v);
}
const fusions = [...feuille.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g)].map(([, de, a]) => ({ de: decouperAdresse(de), a: decouperAdresse(a), haut: de }));
/** La fusion qui couvre une case sans en être la case haut-gauche, ou null. */
const couverte = (adresse) => {
  const { colonne, ligne } = decouperAdresse(adresse);
  return fusions.find((f) => f.haut !== adresse && colonne >= f.de.colonne && colonne <= f.a.colonne && ligne >= f.de.ligne && ligne <= f.a.ligne) ?? null;
};
const DERNIERE_COLONNE = numeroDeColonne('BZ');

/** Toute case écrite ou remplie est dans le modèle, et n'est pas cachée sous une fusion ; les valeurs sont des textes non vides ou des nombres. */
function verifierLesAdresses({ cellules, remplis }) {
  for (const [adresse, valeur] of Object.entries(cellules)) {
    const a = decouperAdresse(adresse);
    assert.ok(a && a.colonne >= 1 && a.colonne <= DERNIERE_COLONNE && a.ligne >= 1 && a.ligne <= 75, `${adresse} hors de A1:BZ75`);
    assert.equal(couverte(adresse), null, `${adresse} est cachée sous une fusion`);
    assert.ok((typeof valeur === 'string' && valeur !== '') || (typeof valeur === 'number' && Number.isFinite(valeur)), `${adresse} : ${JSON.stringify(valeur)}`);
  }
  for (const [adresse, couleur] of Object.entries(remplis)) {
    assert.equal(couverte(adresse), null, adresse);
    assert.match(couleur, /^[0-9A-F]{6}$/);
  }
}

/** Les lignes « Clé : valeur » de la note, sous le marqueur (lireLigneDeNote) ; le texte avant le marqueur. */
function lireLaNote(texte) {
  const i = texte.indexOf(MARQUEUR_DES_NOTES);
  assert.ok(i >= 0, 'le marqueur est dans la note');
  const lignes = texte.slice(i + MARQUEUR_DES_NOTES.length).split('\n').filter(Boolean);
  const lues = lignes.map((l) => lireLigneDeNote(l));
  assert.ok(lues.every(Boolean), `toute ligne sous le marqueur a une clé connue : ${lignes.filter((_, k) => !lues[k]).join(' | ')}`);
  return { avant: texte.slice(0, i), lues, valeur: (cle) => lues.filter((l) => l.cle === cle).map((l) => l.valeur) };
}

// ------------------------------------------------------------------ les fiches d'essai

const NIVEAU_RICHE = 16; // mono-classe : la classe 1 au niveau 20, la classe 2 au niveau 12 (décision R2)
const EVENEMENTS = [
  'Naissance : à Londolor, sous la pluie',
  'Rencontre avec Mirada',
  'Âme fracturée : Malus nécromancie 30, +50% conso âme',
  'Perte de la main gauche',
  'Exil : banni du Temple',
  'Retour : réintégré',
];

function ficheRiche() {
  const f = {
    ...ficheVide('Aldric'), surnom: 'le Gris', lieu_origine: 'Londolor', race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central',
    magie_innee_id: 'magies/magie-de-la-necromancie', magie_acquise_id: 'magies/magie-du-feu', dieu_choisi_id: 'morfot', metier_id: 'metiers/enchanteur',
    mode_classe: 'mono', xp: xpDuNiveau(NIVEAU_RICHE) + 100, alignement_loyal: 8, alignement_chaotique: 1, alignement_bon: 2, alignement_mauvais: 9,
    bourse_pp: 1, bourse_ro: 245, bourse_rf: 50, sante_actuelle: 10, corruption: 3, barre4_actuelle: 4, posture_id: 'guide/postures#posture:focus',
    notes: 'Notes du joueur\nDeuxième ligne\n\n', evenements: `${EVENEMENTS.slice(0, 3).join('\n')}\n\n${EVENEMENTS.slice(3).join('\n')}`,
    classes: [
      { rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:epeiste' },
      { rang: 2, classe_id: 'classes/mage', specialite_id: 'classes/mage#specialite:mage-noir' },
    ],
    // F 2, V 3, I 4, P 2, S 3 (une croix), A 4 (deux croix : ses compétences sont inutilisables)
    caracteristiques: regles.caracteristiques.map((k, i) => ({ caracteristique_id: k.id, base: 2 + (i % 3), croix: k.id === 'social' ? 1 : k.id === 'agilite' ? 2 : 0 })),
    competences: [
      { competence_id: 'connaissance', naturel: 20 }, { competence_id: 'concentration', naturel: 10 }, { competence_id: 'arc', naturel: 15 },
      { competence_id: 'esquive', naturel: 10 },
    ],
    metier_bonus: [{ rang: 2, competence_id: 'magie' }],
    // les choix de maîtrise (décision R148) : la maîtrise au choix du Guerrier (que suit le retrait de l'Épéiste, R151), celle du Mage ; un choix sur
    // ARME DE MONSTRES n'est pas une option (R45) : il ne compte pas
    maitrise_choix: [
      { source: 'classes/guerrier#maitrise-arme:2', rang: 1, arme_famille_id: 'dagues' }, { source: 'classes/mage#maitrise-arme:1', rang: 1, arme_famille_id: 'arc' },
      { source: 'capacites/mage-mage-noir', rang: 1, arme_famille_id: 'arme-de-monstres' },
    ],
    armes: [
      {
        rang: 1, arme_id: 'ressources/armes#arme:epees:epee-longue', materiau_id: trouve('materiaux_armes', (m) => m.nom === 'Acier', 'Acier').id,
        amelioration_id: trouve('ameliorations', (a) => a.cible === 'arme' && a.niveau === 2, 'amélioration 2').id,
        arme_elementaire_id: 'ressources/pieces-elementaires#arme-elementaire:epee:feu',
        amelioration_elementaire_id: trouve('ameliorations', (a) => a.cible === 'arme_elementaire' && a.niveau === 1, 'amélioration élémentaire 1').id,
        effet_en_plus: 'Lame chantante\nsur deux lignes', durabilite: 1,
      },
      { rang: 2, arme_id: 'ressources/armes#arme:dagues:dague', materiau_id: regles.materiau_arme_defaut },
    ],
    // l'entraînement (décision R104) : des compétences (assez pour ne pas tenir sur une ligne de la case L42) et un texte libre ; un choix d'acquis
    entrainements: [['magie', 2], ['concentration', 10], ['connaissance', 5], ['arc', 3], ['observation', 10], ['distinction', 10], ['survie', 5], ['vigueur', 5]]
      .map(([competence_id, valeur], i) => ({ rang: i + 1, competence_id, valeur, texte: null }))
      .concat([{ rang: 9, competence_id: null, valeur: null, texte: 'Livre de magie lu : Boule de feu' }]),
    acquis_choix: [{ source: 'capacites/guerrier-epeiste', rang: 1, competence_id: 'arme-lourde', valeur: null }],
    // l'armure portée (décision R95) : une armure complète (sans AM), son amélioration, son élément et l'amélioration de l'élément ; le casque abîmé,
    // le torse cassé
    armure_id: trouve('armures', (a) => a.am === null && a.solidite >= 3 && Number(a.solidite_uni) !== 1, 'armure sans AM, solidité 3').id,
    armure_amelioration_id: trouve('ameliorations', (a) => a.cible === 'armure' && a.niveau === 1, 'armure 1').id,
    armure_elementaire_id: regles.armures_elementaires[0].id,
    armure_amelioration_elementaire_id: trouve('ameliorations', (a) => a.cible === 'armure_elementaire' && a.niveau === 1, 'armure élémentaire 1').id,
    armure_parties: [{ emplacement_id: 'casque', solidite: 1 }, { emplacement_id: 'torse', solidite: 0 }],
    // le bouclier (décision R96) : une forme, une matière, son amélioration et sa solidité du moment
    bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:bois',
    bouclier_amelioration_id: trouve('ameliorations', (a) => a.cible === 'bouclier' && a.niveau === 2, 'bouclier 2').id, bouclier_solidite: 1,
    // six emplacements, un effet de la table chacun (décision R97)
    accessoires: [
      { emplacement: 'chef', accessoire_effet_id: 'ressources/accessoires#effet:competence:volonte:2', valeur: 8, maudit: 0, competence_id: 'concentration', arme_famille_id: null },
      { emplacement: 'collier', accessoire_effet_id: 'ressources/accessoires#effet:attributs:1', valeur: null, maudit: 1, competence_id: null, arme_famille_id: null },
      { emplacement: 'bracelet-1', accessoire_effet_id: 'ressources/accessoires#effet:attaque:15', valeur: null, maudit: 0, competence_id: null, arme_famille_id: 'epees' },
      { emplacement: 'bracelet-2', accessoire_effet_id: 'ressources/accessoires#effet:attributs:6', valeur: null, maudit: 0, competence_id: null, arme_famille_id: null },
      { emplacement: 'bague-1', accessoire_effet_id: 'ressources/accessoires#effet:attaque:17', valeur: null, maudit: 0, competence_id: null, arme_famille_id: null },
      { emplacement: 'bague-2', accessoire_effet_id: 'ressources/accessoires#effet:attaque:19', valeur: null, maudit: 0, competence_id: null, arme_famille_id: null },
    ],
    inventaire: regles.ressources.slice(0, 60).map((r, i) => ({ rang: i + 1, nom: r.nom, quantite: (i % 4) + 1, ressource_id: r.id })),
    ceinture: [{ rang: 1, nom: regles.ressources[100].nom, quantite: 20, ressource_id: regles.ressources[100].id }, { rang: 3, nom: 'Corde', quantite: 1, ressource_id: null }],
  };
  // un don à choix par groupe (la première option), comme la page le permet
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.map((g) => ({ capacite_id: g.options[0].id })));
  // les gains de niveau, deux totaux (décision R73) : les points d'attributs des niveaux atteints, un tiers en chakra, et 3 en santé par dé
  const attendus = M.gainsAttendus(regles, NIVEAU_RICHE);
  f.gains_chakra = Math.floor(attendus.points / 3);
  f.gains_sante = attendus.points - f.gains_chakra + 3 * attendus.des.length;
  // 25 sorts des deux magies, des NM dont certains d'un livre ; les NM du MJ, pour toute la fiche (décision R118)
  f.sorts = M.sortsPossibles(regles, f).slice(0, 25).map((s, i) => {
    const total = i % 4;
    const livre = total >= 1 && i % 3 === 0 ? 1 : 0;
    return { sort_id: s.id, rang: i + 1, niveau_maitrise: total, nm_livre: livre };
  });
  f.nm_mj = 3;
  return f;
}

/** Humain au Potentiel Illimité (l'Archimage imposé, décision R23), +1 à l'Intelligence au choix, niveau 5. */
function fichePotentiel() {
  const f = { ...ficheVide('Ysolde'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'intelligence', xp: xpDuNiveau(5) };
  f.classes = M.classesSelonLaMagieInnee(regles, f);
  f.sorts = M.sortsPossibles(regles, f).slice(0, 3).map((s, i) => ({ sort_id: s.id, rang: i + 1, niveau_maitrise: 1, nm_livre: 0 }));
  return f;
}

/** Mort-vivant (son don unique et la ligne de son ethnie dans le tableau de la race), Nécromancie : l'Âme en 4ᵉ barre. */
const ficheMortVivant = () => ({
  ...ficheVide('Ombrelune'), race_id: 'races/mort-vivant', ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-sang', magie_innee_id: 'magies/magie-de-la-necromancie', xp: xpDuNiveau(3),
  classes: [{ rang: 1, classe_id: 'classes/mage', specialite_id: null }],
});

const riche = ficheRiche();
const exportRiche = cellulesDeLaFiche(regles, riche, { date: DATE });
const c = exportRiche.cellules;

// ------------------------------------------------------------------ les tests

test('fiche riche : identité, alignement, dieux, bourse, classes, niveau et XP', () => {
  verifierLesAdresses(exportRiche);
  const O = ORDINATEUR;
  assert.equal(c[O.nom], 'Aldric');
  assert.equal(c[O.surnom], 'le Gris');
  assert.equal(c[O.lieuOrigine], 'Londolor');
  assert.equal(c[O.race], nomDe('races', riche.race_id));
  assert.equal(c[O.magieInnee], nomDe('magies', riche.magie_innee_id));
  assert.equal(c[O.magieAcquise], nomDe('magies', riche.magie_acquise_id));
  assert.equal(c[O.alignement], M.alignementDe(regles, riche).nom);
  assert.deepEqual([c[O.loyal], c[O.chaotique], c[O.bon], c[O.mauvais]], [8, 1, 2, 9]);
  const innee = M.trouver(regles.magies, riche.magie_innee_id);
  assert.equal(c[O.dieuInne], innee.dieux.map((d) => nomDe('dieux', d)).join(', '));
  assert.equal(c[O.dieuChoisi], nomDe('dieux', 'morfot'));
  assert.deepEqual([c[O.bourseP], c[O.bourseO], c[O.bourseF]], [1, 245, 50]);
  const xp = M.progressionXp(regles, riche.xp);
  assert.equal(c[O.niveauGlobal], xp.niveau);
  assert.equal(xp.niveau, NIVEAU_RICHE);
  assert.equal(c[O.xp], `${xp.xp} / ${xp.suivant}`);
  const [c1, c2] = M.classesDe(regles, riche);
  assert.deepEqual([c[O.classe1], c[O.niveau1], c[O.specialite1]], [c1.classe.nom, c1.niveau, c1.classe.specialites.find((s) => s.id === c1.choix.specialite_id).nom]);
  assert.deepEqual([c[O.classe2], c[O.niveau2], c[O.specialite2]], [c2.classe.nom, c2.niveau, c2.classe.specialites.find((s) => s.id === c2.choix.specialite_id).nom]);
  assert.deepEqual([c1.niveau, c2.niveau], [20, 12], 'mono-classe au niveau 16 (R2)');
});

test('fiche riche : valeurs du moment, 4ᵉ barre, initiative, vitesses, armure de base', () => {
  const O = ORDINATEUR;
  const a = M.attributsDe(regles, riche);
  const jauges = M.valeursDuMoment(regles, { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) });
  const texte = (champ) => { const j = jauges.find((x) => x.champ === champ); return `${j.hors ? riche[champ] : j.valeur} / ${j.max}`; };
  assert.equal(c[O.sante], texte('sante_actuelle'));
  assert.equal(c[O.chakra], texte('chakra_actuel'));
  assert.equal(c[O.barriere], texte('barriere_actuelle'));
  assert.equal(c[O.barre4], texte('barre4_actuelle'));
  assert.equal(c[O.corruption], texte('corruption'));
  assert.match(c[O.sante], /^10 \/ \d+$/, 'la santé saisie');
  assert.equal(c[O.libelleBarre4], a.quatriemeBarre.ressource);
  assert.equal(c[O.libelleBarre4], 'Âme', 'la Nécromancie donne l’Âme');
  assert.ok(a.initiativeAccessoires, 'l’accessoire « +2 Initiative » donne de l’initiative');
  assert.equal(c[O.initiative], `D20${a.initiativeBonus >= 0 ? '+' : '-'}${Math.abs(a.initiativeBonus)}`);
  assert.equal(c[O.vitesse], a.vitesseSol);
  assert.equal(c[O.vitesseNage], a.vitesseNage);
  assert.equal(c[O.armure.apBase], a.ap);
  assert.equal(c[O.armure.amBase], a.am);
});

test('fiche riche : caractéristiques (base, bonus, croix), compétences (naturel, acquis affiché, total ou N/A), maîtrises remplies', () => {
  const b = M.budgetCaracteristiques(regles, riche);
  assert.equal(c[ORDINATEUR.titreCaracteristiques], `CARACTÉRISTIQUES ${b.total}/${b.attendu}`);
  const caracs = M.caracteristiquesDe(regles, riche);
  for (const k of CASES_CARACTERISTIQUES) {
    const x = caracs.find((y) => y.id === k.id);
    assert.equal(c[k.base], x.base, k.id);
    assert.equal(c[k.bonus], x.bonus + x.accessoire || undefined, `${k.id} : bonus (vide si 0)`);
    assert.equal(c[k.croix[0]], x.croix >= 1 ? 'X' : undefined, `${k.id} : 1re croix`);
    assert.equal(c[k.croix[1]], x.croix >= 2 ? 'X' : undefined, `${k.id} : 2e croix`);
  }
  assert.ok(caracs.some((x) => x.bonus) && caracs.some((x) => x.croix === 2), 'le cas d’un bonus de magie et de deux croix est essayé');
  const competences = M.competencesDe(regles, riche);
  for (const k of CASES_COMPETENCES) {
    const x = competences.find((y) => y.id === k.id);
    assert.equal(c[k.naturel], x.naturel || undefined, `${k.id} : naturel (0 vide)`);
    assert.equal(c[k.acquis], x.acquis || undefined, `${k.id} : acquis calculé (R104)`);
    assert.equal(c[k.total], x.score === null ? 'N/A' : x.score, `${k.id} : total`);
  }
  const concentration = competences.find((x) => x.id === 'concentration');
  assert.ok(concentration.accessoire > 0, 'l’accessoire « Compétence V » compte en Acquis de Concentration');
  assert.ok(competences.find((x) => x.id === 'magie').metier > 0, 'le bonus de métier choisi compte en Acquis de Magie');
  assert.equal(c[CASES_COMPETENCES.find((k) => k.id === 'esquive').total], 'N/A', 'Agilité à deux croix');
  // maîtrises : les dés calculés (décisions R148, R149 : maitrisesParFamille) au-delà du premier, remplis ; ARME DE MONSTRES n'a pas de ligne (R45)
  const attendus = {};
  const maitrises = M.maitrisesParFamille(regles, riche);
  for (const m of MAITRISES) {
    const l = maitrises.find((x) => x.famille === m.famille);
    for (const adresse of casesDesDes(m).slice(0, l.des - 1)) attendus[adresse] = REMPLISSAGE_DE_ATTEINT;
  }
  assert.deepEqual(exportRiche.remplis, attendus);
  assert.ok(maitrises.filter((m) => m.des > 1).length >= 3, 'des familles maîtrisées');
  for (const adresse of Object.keys(exportRiche.remplis)) assert.equal(c[adresse], undefined, `${adresse} : le « 2d »… du modèle reste écrit`);
});

test('fiche riche : armes (nom, dégâts, lignes de l’effet, portée, solidité), armure portée, bouclier', () => {
  for (const [i, cases] of ORDINATEUR.armes.entries()) {
    const rang = i + 1;
    const ligne = riche.armes.find((x) => x.rang === rang);
    const arme = M.trouver(regles.armes, ligne.arme_id);
    const degats = M.degatsDArme(regles, riche, rang);
    assert.equal(c[cases.nom], arme.nom);
    assert.equal(c[cases.degats], degats.texte);
    assert.equal(c[cases.effet], lignesDArme(regles, riche, rang).join('\n'));
    // la solidité du moment et le maximum de l'arme forgée (décision R74), « N / M » ; sans valeur enregistrée, au maximum
    const solidite = M.durabiliteDArme(regles, riche, rang);
    assert.equal(c[cases.solidite], `${solidite.actuelle} / ${solidite.max}`);
    assert.equal(solidite.actuelle, ligne.durabilite ?? solidite.max, `arme ${rang}`);
    const portee = [arme.portee ?? null, degats.porteeEnPlus ? `+ ${degats.porteeEnPlus}` : null].filter(Boolean).join(' ');
    assert.equal(c[cases.portee] === undefined ? '' : String(c[cases.portee]), portee);
  }
  const l1 = c[ORDINATEUR.armes[0].effet].split('\n');
  const ligne1 = riche.armes[0];
  const amelioration = M.trouver(regles.ameliorations, ligne1.amelioration_id);
  // d'abord ce que l'import relit (composition, améliorations, élément, effet en plus), puis ce que le site refait (catalogue, deux armes, non comptés)
  assert.equal(l1[0], `Composition : ${nomDe('materiaux_armes', ligne1.materiau_id)}`);
  assert.equal(l1[1], `Amélioration : niv. ${amelioration.niveau} — ${amelioration.effet}`);
  assert.equal(l1[2], `Élément : ${nomDe('armes_elementaires', ligne1.arme_elementaire_id)}`);
  assert.match(l1[3], /^Amélioration de l’élément : niv\. 1 — /);
  assert.deepEqual(l1.slice(4, 6), ['Effet en plus : Lame chantante', 'sur deux lignes'], 'l’effet en plus, après les autres lignes relues');
  const effetCatalogue = M.trouver(regles.armes, ligne1.arme_id).effet;
  assert.ok(effetCatalogue);
  assert.equal(l1.slice(6).join('\n').indexOf(effetCatalogue), 0, 'l’effet du catalogue, en tête de ce qui n’est qu’affiché');
  const parties = partiesDeLArme(regles, riche, 1);
  assert.deepEqual(parties.relues, l1.slice(0, 4).concat(['Effet en plus : Lame chantante\nsur deux lignes']));
  assert.equal(parties.affichees[0], effetCatalogue);
  const deux = M.attaqueADeuxArmes(regles, riche);
  assert.ok(deux, 'épée et dague : deux armes de mêlée');
  assert.ok(l1.includes(`Deux armes : −${deux.mains[0].malus} % (main directrice)`));
  assert.ok(c[ORDINATEUR.armes[1].effet].split('\n').includes(`Deux armes : −${deux.mains[1].malus} % (main secondaire)`));
  const nonComptes = M.degatsDArme(regles, riche, 1).nonComptes;
  assert.ok(nonComptes.length, 'le Contact du Guerrier ne se compte pas (armes visées non écrites)');
  for (const n of nonComptes) assert.ok(l1.some((x) => x.startsWith(`Non compté : ${n.nom} ${signe(n.valeur)} (`)), n.nom);
  assert.ok(c[ORDINATEUR.armes[0].effet].endsWith(parties.affichees.join('\n')), 'ce qui n’est qu’affiché, en dernier');
  // armure (décision R95) : son nom, une ligne (l'armure, son amélioration, son élément et l'amélioration de l'élément), sans emplacement ; la solidité
  // de chaque partie dans la ligne « Sol. » de la grille, « N / M » ; l'AP et l'AM de l'armure sur chaque partie dans les lignes « AP » et « AM » (R108)
  const armure = M.trouver(regles.armures, riche.armure_id);
  assert.equal(c[ORDINATEUR.armure.nom], armure.nom);
  const lignes = c[ORDINATEUR.armure.bonus].split('\n');
  assert.deepEqual(lignes, lignesDArmure(regles, riche));
  assert.equal(lignes.length, 1);
  const element = regles.armures_elementaires[0];
  const ameliorationElement = M.trouver(regles.ameliorations, riche.armure_amelioration_elementaire_id);
  assert.ok(lignes[0].startsWith(`${armure.nom} (AP ${armure.ap}) · `), 'un AM absent n’est pas écrit');
  assert.match(lignes[0], new RegExp(` · ${LIGNES_D_ARMURE.amelioration} niv\\. 1 \\(`));
  assert.ok(lignes[0].includes(` · ${LIGNES_D_ARMURE.element} ${element.nom} (AP ${element.ap}, AM ${element.am})`));
  assert.ok(lignes[0].endsWith(` · ${LIGNES_D_ARMURE.ameliorationElement} niv. 1 (${ameliorationElement.effet})`));
  // sans les statistiques du catalogue, puis sans l'effet des améliorations (pour tenir dans la case : voir « armure portée »)
  const sansStats = lignesDArmure(regles, riche, { stats: false });
  assert.ok(sansStats.every((l) => !/\((?:AP|AM) /.test(l)) && sansStats.some((l) => l.includes('(')));
  assert.deepEqual(lignesDArmure(regles, riche, { stats: false, effets: false }),
    [`${armure.nom} · ${LIGNES_D_ARMURE.amelioration} niv. 1 · ${LIGNES_D_ARMURE.element} ${element.nom} · ${LIGNES_D_ARMURE.ameliorationElement} niv. 1`]);
  assert.deepEqual(lignesDArmure(regles, { armure_id: null }), [], 'sans armure');
  const max = M.soliditeMaxDeLArmure(regles, riche);
  const solidites = Object.fromEntries(Object.entries(ORDINATEUR.armure.colonnes).map(([e, col]) => [e, c[`${col}${ORDINATEUR.armure.lignes.solidite}`]]));
  assert.deepEqual(solidites, { casque: `1 / ${max}`, torse: `0 / ${max}`, 'bras-gauche': `${max} / ${max}`, 'bras-droit': `${max} / ${max}`,
    'jambe-gauche': `${max} / ${max}`, 'jambe-droit': `${max} / ${max}` });
  // l'AP et l'AM de l'armure sur chaque partie (décision R108) : la valeur de l'armure portée (ici l'élément et son amélioration, R99), 0 sur le torse cassé ;
  // le casque, abîmé mais pas cassé, garde la valeur
  const ameliorationDeLElement = M.trouver(regles.ameliorations, riche.armure_amelioration_elementaire_id);
  const valeur = { ap: element.ap + ameliorationDeLElement.bonus_ap, am: element.am + ameliorationDeLElement.bonus_am };
  assert.ok(valeur.ap > 0 && valeur.am > 0);
  const grille = (cellules, ligne) => Object.fromEntries(Object.entries(ORDINATEUR.armure.colonnes).map(([e, col]) => [e, cellules[`${col}${ORDINATEUR.armure.lignes[ligne]}`]]));
  for (const ligne of ['ap', 'am']) {
    assert.deepEqual(grille(c, ligne), { casque: valeur[ligne], torse: 0, 'bras-gauche': valeur[ligne], 'bras-droit': valeur[ligne], 'jambe-gauche': valeur[ligne], 'jambe-droit': valeur[ligne] }, ligne);
  }
  const sansArmure = cellulesDeLaFiche(regles, { ...riche, armure_id: null }, { date: DATE }).cellules;
  for (const ligne of ['ap', 'am']) assert.ok(Object.values(grille(sansArmure, ligne)).every((v) => v === undefined), `sans armure, rien (${ligne})`);
  // une armure à solidité unifiée : sa solidité sur les six parties
  const uni = trouve('armures', (a) => Number(a.solidite_uni) === 1 && a.solidite >= 2, 'armure à solidité unifiée');
  const solUni = cellulesDeLaFiche(regles, { ...riche, armure_id: uni.id, armure_amelioration_id: null, armure_parties: [{ emplacement_id: ARMURE_COMPLETE, solidite: 1 }] }, { date: DATE }).cellules;
  for (const col of Object.values(ORDINATEUR.armure.colonnes)) assert.equal(solUni[`${col}${ORDINATEUR.armure.lignes.solidite}`], `1 / ${uni.solidite}`, col);
  // à 0, ses six parties sont cassées (R108) : 0 AP et 0 AM partout ; abîmée, la valeur de l'armure partout
  const uniCassee = cellulesDeLaFiche(regles, { ...riche, armure_id: uni.id, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null,
    armure_parties: [{ emplacement_id: ARMURE_COMPLETE, solidite: 0 }] }, { date: DATE }).cellules;
  for (const ligne of ['ap', 'am']) assert.ok(Object.values(grille(uniCassee, ligne)).every((v) => v === 0), ligne);
  const uniAbimee = cellulesDeLaFiche(regles, { ...riche, armure_id: uni.id, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null,
    armure_parties: [{ emplacement_id: ARMURE_COMPLETE, solidite: 1 }] }, { date: DATE }).cellules;
  assert.ok(Object.values(grille(uniAbimee, 'ap')).every((v) => v === M.trouver(regles.armures, uni.id).ap), 'abîmée : la valeur de l’armure');
  // bouclier (décision R96) : la forme, la matière et l'amélioration, la classe, l'AP et l'AM calculés, la solidité du moment « N / M »
  const bouclier = M.bouclierDe(regles, riche);
  assert.equal(c[ORDINATEUR.bouclier.nom], bouclier.forme.nom);
  const ameliorationDuBouclier = M.trouver(regles.ameliorations, riche.bouclier_amelioration_id);
  assert.equal(c[ORDINATEUR.bouclier.composition], `${nomDe('materiaux_bouclier', 'ressources/armures#materiau:bois')} · ${texteDAmelioration(ameliorationDuBouclier)}`);
  assert.equal(c[ORDINATEUR.bouclier.classe], bouclier.forme.classe);
  assert.deepEqual([c[ORDINATEUR.bouclier.ap], c[ORDINATEUR.bouclier.am]], [bouclier.ap, bouclier.am]);
  assert.ok(bouclier.ap > 0 && bouclier.amelioration.niveau === 2);
  assert.equal(c[ORDINATEUR.bouclier.solidite], `1 / ${bouclier.solidite.max}`);
  // cassé (solidité 0) : ses AP et AM ne comptent plus (décision R108), 0 ; sa solidité « 0 / M » relue
  const casse = cellulesDeLaFiche(regles, { ...riche, bouclier_solidite: 0 }, { date: DATE }).cellules;
  assert.deepEqual([casse[ORDINATEUR.bouclier.ap], casse[ORDINATEUR.bouclier.am], casse[ORDINATEUR.bouclier.solidite]], [0, 0, `0 / ${bouclier.solidite.max}`]);
});

test('fiche riche : accessoires (fourchette, choix, maudit, texte libre), ceinture, inventaire', () => {
  for (const emplacement of EMPLACEMENTS_DU_MODELE) {
    const a = riche.accessoires.find((x) => x.emplacement === emplacement);
    assert.equal(c[ORDINATEUR.accessoires[emplacement]], lignesDAccessoire(regles, a).join('\n'), emplacement);
  }
  // l'effet sur une ligne, « <libellé>[ = valeur][ → choix] », sans sa propriété quand le libellé suffit ; « Maudit » à part ; ni nom ni effet hors
  // table (décision R97)
  const chef = M.trouver(regles.accessoires, riche.accessoires[0].accessoire_effet_id);
  assert.equal(c[ORDINATEUR.accessoires.chef], `${chef.libelle} = 8 → ${nomDe('competences', 'concentration')}`);
  const collier = M.trouver(regles.accessoires, riche.accessoires[1].accessoire_effet_id);
  assert.equal(c[ORDINATEUR.accessoires.collier], `${collier.libelle}\nMaudit`, 'pas de valeur hors fourchette');
  const bracelet = M.trouver(regles.accessoires, riche.accessoires[2].accessoire_effet_id);
  assert.equal(c[ORDINATEUR.accessoires['bracelet-1']], `${bracelet.libelle} → ${nomDe('familles_armes', 'epees')}`);
  // la propriété écrite quand le libellé seul ne suffit pas : vide (« Attaque : ») ou partagé par plusieurs propriétés (« MALÉDICTION »)
  const sansLibelle = regles.accessoires.find((x) => !x.libelle);
  assert.deepEqual(lignesDAccessoire(regles, { accessoire_effet_id: sansLibelle.id }), [`${sansLibelle.propriete_nom} :`]);
  const malediction = regles.accessoires.find((x) => x.libelle === 'MALÉDICTION');
  assert.ok(regles.accessoires.some((x) => x.libelle === 'MALÉDICTION' && x.propriete !== malediction.propriete), 'MALÉDICTION : plusieurs propriétés');
  assert.deepEqual(lignesDAccessoire(regles, { accessoire_effet_id: malediction.id, maudit: 1 }), [`${malediction.propriete_nom} : MALÉDICTION`, 'Maudit']);
  const fourchette = regles.accessoires.find((x) => x.min !== null && x.propriete === 'competence');
  assert.deepEqual(lignesDAccessoire(regles, { accessoire_effet_id: fourchette.id, valeur: fourchette.min, competence_id: 'magie' }),
    [`${fourchette.libelle} = ${fourchette.min} → ${nomDe('competences', 'magie')}`]);
  // ceinture : rang 1 et 3, le 2 vide
  assert.equal(c[ORDINATEUR.ceinture[0]], `${regles.ressources[100].nom} ×20`);
  assert.equal(c[ORDINATEUR.ceinture[1]], undefined);
  assert.equal(c[ORDINATEUR.ceinture[2]], 'Corde');
  // inventaire : 48 places colonne par colonne
  const places = ORDINATEUR.inventaire.colonnes.flatMap((col) => ORDINATEUR.inventaire.lignes.map((l) => `${col}${l}`));
  assert.equal(places.length, 48);
  places.forEach((adresse, i) => assert.equal(c[adresse], texteDObjet(riche.inventaire[i]), adresse));
  assert.equal(c.AA51, texteDObjet(riche.inventaire[11]));
  assert.equal(c.AG40, texteDObjet(riche.inventaire[12]), 'la deuxième colonne commence au 13e objet');
});

test('fiche riche : dons (de base, race, métier, entraînement, classes), événements', () => {
  const dr = M.donsDeRace(regles, riche);
  const base = M.donDeBase(dr.base);
  const b = casesDuDon(DONS.base);
  const [type, ...reste] = base.texte.split(' · ');
  // des cases d'une seule rangée : leurs parties sur une ligne, séparées par « · » (coupées, elles montrent le début de chacune)
  assert.deepEqual([c[b.nom], c[b.type], c[b.effet]], [base.nom, type, enUneLigne([reste.join(' · ')])]);
  const r = casesDuDon(DONS.race);
  assert.equal(c[r.nom], nomDe('ethnies', riche.ethnie_id));
  assert.equal(c[r.type], dr.dons[0].nom ?? dr.dons[0].etiquette);
  assert.equal(c[r.effet], enUneLigne(dr.dons.map((d) => `${d.nom ?? d.etiquette} : ${d.texte}`)));
  assert.ok(dr.dons.some((d) => d.texte.includes('\n')) && !c[r.effet].includes('\n'), 'un don de race sur plusieurs lignes, écrit sur une');
  // métier : d'abord les rangs à choix avec leur flèche (relus), puis les autres rangs et l'artisanat (affichés), sur une ligne
  const m = casesDuDon(DONS.metier);
  const bm = M.bonusDuMetier(regles, riche);
  assert.equal(c[m.nom], bm.metier.nom);
  assert.equal(c[m.type], 'Passif');
  assert.ok(!c[m.effet].includes('\n'));
  const lignes = c[m.effet].split(SEPARATEUR_EN_LIGNE);
  assert.equal(lignes.length, bm.rangs.length + 1);
  const rangs = [...bm.rangs.filter((x) => x.aChoisir), ...bm.rangs.filter((x) => !x.aChoisir)];
  rangs.forEach((x, i) => assert.equal(lignes[i], x.aChoisir ? `${uneLigne(x.texte)} → ${nomDe('competences', x.retenue.competence_id)}` : uneLigne(x.texte)));
  assert.ok(bm.rangs.some((x) => x.aChoisir) && bm.rangs.some((x) => !x.aChoisir), 'l’Enchanteur a un rang à choix et un sans choix');
  const art = M.artisanatDe(regles, riche);
  assert.equal(lignes.at(-1), `Artisanat : ${art.texte} (${art.caracteristiques.map((x) => x.nom).join(' + ')}) = ${art.score} %`);
  assert.deepEqual(partiesDuMetier(regles, riche).relues, lignes.slice(0, bm.rangs.filter((x) => x.aChoisir).length));
  assert.deepEqual(lireChoixDuMetier(c[m.effet]), bm.rangs.filter((x) => x.aChoisir).map((x) => ({ texte: x.texte, choix: nomDe('competences', x.retenue.competence_id) })));
  // entraînement (décision R104) : ses compétences, « Nom points » jointes par « | » (une case relue, la forme de la fiche auto) ; le libellé
  // « Entraînement » et le type du modèle restent ; un texte libre dans la note
  const e = casesDuDon(DONS.entrainement);
  assert.deepEqual([c[e.nom], c[e.type], c[e.effet]], [undefined, undefined,
    'Magie 2 | Concentration 10 | Connaissance 5 | Arc 3 | Observation 10 | Distinction 10 | Survie 5 | Vigueur 5']);
  assert.ok(c[ORDINATEUR.note].split('\n').includes('Entraînement : Livre de magie lu : Boule de feu'));
  const seulTexte = { ...riche, entrainements: [{ rang: 1, competence_id: null, valeur: null, texte: 'Béni par la Dame' }] };
  assert.equal(cellulesDeLaFiche(regles, seulTexte, { date: DATE }).cellules[e.effet], undefined, 'sans compétence, rien dans la case');
  // un choix d'acquis d'un don : dans la note, « <don> : <compétence> »
  assert.ok(c[ORDINATEUR.note].split('\n').includes('Acquis au choix : Épéiste (Guerrier) : Arme Lourde'), c[ORDINATEUR.note]);
  // dons de classe : classe 1 en 43…55, classe 2 en 57…69, dans l'ordre de donsAcquis ; au-delà de sept (des dons ajoutés sur le site de dev), la note
  // (« Dons de classe N (suite) », test de la note)
  const acquis = M.donsAcquis(regles, riche);
  assert.deepEqual(acquis.map((x) => x.rang), [1, 2]);
  for (const x of acquis) {
    const rangees = x.rang === 1 ? DONS.classe1 : DONS.classe2;
    rangees.forEach((ligne, i) => {
      const d = x.dons[i];
      const cases = casesDuDon(ligne);
      assert.equal(c[cases.nom], d?.nom, `${x.classe.nom} ${ligne}`);
      assert.equal(c[cases.type], d ? [TYPES_DE_DON[d.type], d.precision ? `(${d.precision})` : null].filter(Boolean).join(' ') : undefined);
      assert.equal(c[cases.effet], d?.effet ?? undefined);
    });
  }
  // événements : les 4 premières lignes non vides, coupées au premier « : »
  DONS.evenements.forEach((ligne, i) => {
    const { titre, texte } = decouperEvenement(EVENEMENTS[i]);
    const cases = casesDuDon(ligne);
    assert.equal(c[cases.nom], titre || undefined);
    assert.equal(c[cases.effet], texte);
  });
  assert.equal(c.C71, 'Naissance');
  assert.equal(c.L71, 'à Londolor, sous la pluie');
  assert.equal(c.C72, undefined);
  assert.equal(c.L72, 'Rencontre avec Mirada');
});

test('fiche riche : sorts (titre, magies, 20 lignes au NM du sort avec les accessoires)', () => {
  const S = ORDINATEUR.sorts;
  const f = { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) };
  const e = M.emplacementsDeSorts(regles, f);
  const nm = M.maitriseDesSorts(regles, f);
  assert.ok(nm.mj > 0);
  assert.equal(c[S.titre], `LISTE DE SORTS — ${e.total} emplacements · NPM ${M.npmMax(regles, f)} au plus · NM ${nm.comptes}/${nm.disponibles} + ${nm.mj} du MJ`);
  assert.equal(c[S.magieInnee], nomDe('magies', riche.magie_innee_id));
  assert.equal(c[S.magieAcquise], nomDe('magies', riche.magie_acquise_id));
  const acc = M.accessoiresDesSorts(regles, f);
  assert.ok(acc.portee && acc.degats, 'les bagues ajoutent portée et dégâts aux sorts');
  const enNombre = (t) => (/^-?(0|[1-9]\d*)$/.test(t) ? Number(t) : t || undefined);
  let attaques = 0;
  let couts = 0;
  S.lignes.forEach((r, i) => {
    const ligne = riche.sorts[i];
    const sort = M.trouver(regles.sorts, ligne.sort_id);
    const n = M.nmDuSort(ligne).total;
    const auNm = (brut, champ) => valeurAuNm(brut ?? null, sort.bonus, champ, n) ?? '';
    const col = S.colonnes;
    assert.equal(c[`${col.nom}${r}`], sort.nom);
    assert.equal(c[`${col.nm}${r}`], n);
    // une rangée par sort : chaque case sur une ligne, la description ses parties séparées par « · »
    assert.equal(c[`${col.type}${r}`], uneLigne(auNm(sort.type, 'type')) || undefined, `${sort.nom} : type`);
    // les deux coûts en une case, comme le classeur (« 3 + 1 âme » : décision R105) ; un coût réparti par 0063 sans NM : l'écriture même du classeur
    assert.equal(c[`${col.cout}${r}`], enNombre(uneLigne(coutEnUneCase(auNm(sort.cout, 'cout'), sort.cout_secondaire ?? null))), `${sort.nom} : coût`);
    const reparti = REPARTIS.get(sort.id);
    if (reparti && !reparti.avant.includes('NM') && sort.cout === reparti.cout_brut && sort.cout_secondaire === reparti.cout_secondaire) {
      assert.equal(c[`${col.cout}${r}`], enNombre(reparti.avant), `${sort.nom} : coût du classeur`);
      couts += 1;
    }
    assert.equal(c[`${col.portee}${r}`], enNombre(`${uneLigne(auNm(sort.portee, 'portee'))} ${signe(acc.portee)}`));
    assert.equal(c[`${col.zone}${r}`], enNombre(uneLigne(auNm(sort.zone, 'zone'))));
    const dsb = auNm(sort.dsb, 'dsb');
    if (sort.attaque && dsb) attaques += 1;
    const description = enUneLigne([
      sort.attaque && dsb ? `${dsb} ${signe(acc.degats)}` : dsb, auNm(sort.effets, 'effets'),
      ...modesAuNm(sort.modes, sort.bonus, n).filter((x) => x.atteint).map((x) => x.texte), sort.remarque ? `${ETOILE} ${sort.remarque}` : '',
    ]);
    assert.equal(c[`${col.description}${r}`], description || undefined, `${sort.nom} : description`);
    for (const col_ of ['type', 'cout', 'portee', 'zone', 'description']) assert.ok(!String(c[`${col[col_]}${r}`] ?? '').includes('\n'), `${sort.nom} : ${col_} sur une ligne`);
  });
  assert.ok(attaques > 0, 'un sort d’attaque reçoit les dégâts des accessoires');
  assert.ok(couts > 0, 'un sort au coût réparti par la migration 0063 (âmes, Sang) : sa case « Coût » redit le classeur');
  assert.ok(riche.sorts.slice(0, 20).some((l) => /IC|NM/.test(M.trouver(regles.sorts, l.sort_id).type ?? '')), 'un type qui écrit un NM est essayé');
});

test('une rangée par sort : type et effets écrits sur plusieurs lignes dans les règles, sur une dans la case (coupée, elle montre le début de chaque partie)', () => {
  // des sorts d'une même magie dont le type, les effets ou le D/S/B tiennent sur plusieurs lignes (constat D1 : la coupe tombait au premier saut de ligne)
  const parMagie = Map.groupBy(regles.sorts.filter((s) => /\n/.test(`${s.type ?? ''}${s.effets ?? ''}${s.dsb ?? ''}`)), (s) => s.magie_id);
  const [magie, sorts] = [...parMagie].sort((x, y) => y[1].length - x[1].length)[0];
  assert.ok(sorts.some((x) => /\n/.test(x.type ?? '')) && sorts.some((x) => /\n/.test(x.effets ?? '')), magie);
  const f = { ...ficheVide('Une ligne'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: magie, xp: xpDuNiveau(10),
    sorts: sorts.slice(0, 20).map((x, i) => ({ sort_id: x.id, rang: i + 1, niveau_maitrise: 1, nm_livre: 0 })) };
  const v = cellulesDeLaFiche(regles, f, { date: DATE }).cellules;
  const col = ORDINATEUR.sorts.colonnes;
  f.sorts.forEach((l, i) => {
    const sort = M.trouver(regles.sorts, l.sort_id);
    const r = ORDINATEUR.sorts.lignes[i];
    const auNm = (ch) => valeurAuNm(sort[ch] ?? null, sort.bonus, ch, 1) ?? '';
    for (const ch of ['type', 'cout', 'portee', 'zone']) assert.equal(String(v[`${col[ch]}${r}`] ?? ''), uneLigne(auNm(ch)), `${sort.nom} : ${ch}`);
    const description = String(v[`${col.description}${r}`] ?? '');
    assert.ok(!description.includes('\n'), sort.nom);
    // chaque ligne du D/S/B et des effets, dans l'ordre, séparée de la suivante par « · »
    const lignes = ['dsb', 'effets'].flatMap((ch) => auNm(ch).split('\n')).map((x) => x.trim()).filter(Boolean);
    assert.ok(description.startsWith(lignes.join(SEPARATEUR_EN_LIGNE)), `${sort.nom} : ${description}`);
  });
});

test('fiche riche : résistances, posture du moment, Mode Hyper', () => {
  const r = M.resistancesDe(regles, { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) });
  for (const k of CASES_RESISTANCES) {
    const p = r.paliers.find((x) => x.id === k.palier);
    assert.equal(c[k.libelle], `${p.libelle}\n(${p.effet})`, 'le libellé et l’effet de la base');
    assert.equal(c[k.cibles], p.cibles.map((x) => x.nom).join(', ') || undefined, k.palier);
  }
  // décision R155 : les multiplicateurs de la base sont désormais ceux du modèle ordinateur (« dégâts subits ÷3 », « x3 », « x4 » ; R70 les disait faux)
  const effets = Object.fromEntries(CASES_RESISTANCES.map((k) => [k.palier, c[k.libelle]]));
  assert.deepEqual([effets.grande_resistance, effets.grande_vulnerabilite, effets.sensibilite],
    ['Grande résistance\n(dégâts subis ÷3)', 'Grande vulnérabilité\n(dégâts subis x3)', 'Sensibilité\n(dégâts subis x4)']);
  for (const [adresse, effet] of [['BA4', '÷3'], ['BA10', 'x3'], ['BA12', 'x4']]) {
    assert.ok(textesDuModele.get(adresse)?.includes(`(dégâts subits ${effet})`), `${adresse} du modèle : ${textesDuModele.get(adresse)}`);
  }
  assert.ok(r.paliers.some((p) => p.cibles.length), 'au moins une résistance ou faiblesse');
  for (const p of CASES_POSTURES) {
    assert.equal(c[p.titre], p.id === riche.posture_id ? `${MARQUE_DE_POSTURE} ${textesDuModele.get(p.titre)}` : undefined, p.id);
    assert.equal(c[p.effets], undefined, 'les effets du modèle restent');
  }
  const h = M.modeHyperDe(regles, riche);
  assert.ok(h.debloque && h.cent.debloque);
  assert.equal(c[ORDINATEUR.modeHyper.race], `${h.race.nom} : ${h.race.effet}`);
  assert.equal(c[ORDINATEUR.modeHyper.magieInnee], h.magies.find((x) => x.magie.id === riche.magie_innee_id).effet);
  assert.equal(c[ORDINATEUR.modeHyper.magieAcquise], h.magies.find((x) => x.magie.id === riche.magie_acquise_id).effet);
});

test('résistances (décision R111) : exportées sans la posture du moment — en Symbiose, la magie désactivée garde ses listes dans le classeur ; la page les retire', () => {
  const POSTURE_SYMBIOSE = 'guide/postures#posture:symbiose';
  assert.ok(CASES_POSTURES.some((p) => p.id === POSTURE_SYMBIOSE));
  const bi = (x = {}) => ({
    ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', magie_acquise_id: 'magies/magie-de-la-glace', ...x,
  });
  const sans = bi();
  const enGlace = bi({ posture_id: POSTURE_SYMBIOSE, symbiose_magie_id: 'magies/magie-de-la-glace' });
  // la page : le Feu désactivé perd ses listes, les paliers changent
  assert.deepEqual(M.resistancesDe(regles, enGlace).desactivee, { id: 'magies/magie-du-feu', nom: 'Feu' });
  assert.notDeepEqual(M.resistancesDe(regles, enGlace).paliers, M.resistancesDe(regles, sans).paliers, 'la page suit la posture');
  // l'option de l'export : la posture ignorée, comme sans elle
  assert.deepEqual(M.resistancesDe(regles, enGlace, { avecLaPosture: false }), M.resistancesDe(regles, sans));
  // le classeur : les mêmes cases de résistances que sans posture
  const cases = (f) => {
    const v = cellulesDeLaFiche(regles, f, { date: DATE }).cellules;
    return CASES_RESISTANCES.map((k) => [k.palier, v[k.libelle], v[k.cibles] ?? null]);
  };
  const attendu = cases(sans);
  assert.ok(attendu.some(([, , cibles]) => cibles), 'au moins une résistance ou faiblesse sans posture');
  assert.deepEqual(cases(enGlace), attendu);
  // la posture, elle, est marquée
  const symbiose = CASES_POSTURES.find((p) => p.id === POSTURE_SYMBIOSE);
  assert.equal(cellulesDeLaFiche(regles, enGlace, { date: DATE }).cellules[symbiose.titre], `${MARQUE_DE_POSTURE} ${TITRES_DES_POSTURES[POSTURE_SYMBIOSE]}`);
});

test('fiche riche : la note — notes du joueur, marqueur, puis ce qui n’a pas de case', () => {
  const texte = c[ORDINATEUR.note];
  assert.ok(texte.startsWith(`Notes du joueur\nDeuxième ligne\n\n${MARQUEUR_DES_NOTES}\n${ligneDExport(DATE)}\n`), 'les notes (sans leurs lignes vides de fin), une ligne vide, le marqueur, la date');
  const note = lireLaNote(texte);
  const K = CLES_DE_LA_NOTE;
  assert.deepEqual(note.valeur(K.biClasse), [NON]);
  assert.deepEqual(note.valeur(K.caracteristiqueMagie), [], 'la Nécromancie a sa caractéristique');
  assert.ok(riche.gains_sante && riche.gains_chakra);
  assert.deepEqual(lireGains(note.valeur(K.gains)[0]), { gains_sante: riche.gains_sante, gains_chakra: riche.gains_chakra });
  // les livres de sort ; les NM du MJ, ceux de la fiche (décision R118)
  const livres = riche.sorts.filter((s) => s.nm_livre);
  assert.ok(livres.length);
  assert.deepEqual(lireNmOfferts(note.valeur(K.nmOfferts)[0]), livres.map((s) => ({ nom: nomDe('sorts', s.sort_id), livre: 1, cadeau: 0 })));
  assert.deepEqual(note.valeur(K.nmMj), [String(riche.nm_mj)]);
  // les choix de maîtrise (décision R148) : la maîtrise au choix du Guerrier et celle du Mage ; ARME DE MONSTRES n'est pas une option (R45) : pas écrite
  assert.deepEqual(note.valeur(K.maitriseChoix), ['Guerrier (maîtrise 2) : DAGUES', 'Mage (maîtrise 1) : ARC']);
  // plus d'accessoire de la Ceinture ni d'« Autre » (décision R97) : aucun accessoire dans la note
  assert.deepEqual(CLES_DES_ACCESSOIRES_SANS_CASE, {});
  assert.ok(!note.lues.some((l) => l.nom === 'accessoire'));
  // les dons de classe au-delà des sept places de chaque classe (aucun tant que les règles en donnent sept au plus par classe)
  for (const x of M.donsAcquis(regles, riche)) {
    const enSuite = x.dons.slice((x.rang === 1 ? DONS.classe1 : DONS.classe2).length).map((d) => d.nom);
    assert.deepEqual(note.valeur(K[`donsClasse${x.rang}`]), enSuite.length ? [enSuite.join(SEPARATEUR_DE_LISTE)] : [], `classe ${x.rang}`);
  }
  // débordements : sorts au-delà de 20, objets au-delà de 48, événements au-delà de 4
  assert.deepEqual(lireListe(note.valeur(K.sorts)[0]).map(lireSortEnSuite),
    riche.sorts.slice(20).map((s) => ({ nom: nomDe('sorts', s.sort_id), nm: s.niveau_maitrise })));
  assert.deepEqual(lireListe(note.valeur(K.inventaire)[0]).map(lireObjet), riche.inventaire.slice(48).map((o) => ({ nom: o.nom, quantite: o.quantite })));
  assert.deepEqual(note.valeur(K.evenement), EVENEMENTS.slice(4));
  // informations (refaites à chaque export) : résistances au choix, Mode Hyper 100 %, choix à faire
  const f = { ...riche, caracteristiques: M.caracteristiquesCompletes(regles, riche) };
  assert.deepEqual(note.valeur(K.resistancesAuChoix), M.resistancesDe(regles, f).auChoix.length ? [M.resistancesDe(regles, f).auChoix.join(', ')] : []);
  assert.deepEqual(note.valeur(K.modeHyperCent), [MODE_HYPER_CENT_DEBLOQUE], 'débloqué, sans ses effets (un texte de règles)');
  assert.deepEqual(note.valeur(K.choixAFaire), M.choixEnAttente(regles, f).length ? [M.choixEnAttente(regles, f).map((x) => x.libelle).join(' ; ')] : []);
  for (const l of note.lues) assert.equal(l.information, l.nom === 'export' || CLES_D_INFORMATION.includes(l.cle), l.cle);
  // l'ordre des lignes est celui de CLES_DE_LA_NOTE
  const ordre = Object.values(K);
  const rangs = note.lues.filter((l) => l.nom !== 'export').map((l) => ordre.indexOf(l.cle));
  assert.deepEqual(rangs, [...rangs].sort((a, b) => a - b));
});

test('maîtrises d’armes (décisions R148, R149, R152) : la grille des dés calculés, plafonnée à 5 ; une ligne « Maîtrise d’arme au choix » par source choisie ; l’arme choisie avec la famille calculée entre parenthèses', () => {
  // Tueur Flétrisseur et Mercenaire Chasseur de primes, niveau 10 : ÉPÉES en maîtrise au choix du Tueur et 5 fois au Chasseur de primes (6 points, 4
  // comptés : 5 dés, R149) ; la ligne à répartir du Mercenaire, son 2e point à choisir ; « +5% de la compétence de l'arme choisie » du Flétrisseur
  const f = {
    ...ficheVide('Vaskar'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu',
    xp: xpDuNiveau(10), mode_classe: 'bi',
    classes: [
      { rang: 1, classe_id: 'classes/tueur', specialite_id: 'classes/tueur#specialite:fletrisseur' },
      { rang: 2, classe_id: 'classes/mercenaire', specialite_id: 'classes/mercenaire#specialite:chasseur-de-primes' },
    ],
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    maitrise_choix: [
      { source: 'classes/tueur#maitrise-arme:1', rang: 1, arme_famille_id: 'epees' },
      ...[1, 2, 3, 4, 5].map((rang) => ({ source: 'capacites/mercenaire-chasseur-de-primes', rang, arme_famille_id: 'epees' })),
      { source: 'classes/mercenaire#maitrise-arme:1', rang: 1, arme_famille_id: 'arc' }, { source: 'classes/mercenaire#maitrise-arme:3', rang: 1, arme_famille_id: 'hache' },
      { source: 'classes/mercenaire#maitrise-arme:1', rang: 3, arme_famille_id: 'hache' },
    ],
  };
  const arme = M.acquisDesDons(regles, f).choix.find((x) => x.source === 'capacites/tueur-fletrisseur' && x.arme);
  assert.ok(arme && arme.arme_famille_id === 'epees' && arme.options.length > 1, 'l’arme du Flétrisseur : la maîtrise au choix du Tueur (R152)');
  f.acquis_choix = [{ source: arme.source, rang: arme.rang, competence_id: arme.options.at(-1), valeur: null }];
  const e = cellulesDeLaFiche(regles, f, { date: DATE });
  verifierLesAdresses(e);
  // la grille : les dés du calcul, 5 au plus (ÉPÉES : 6 points, 4 comptés)
  const maitrises = M.maitrisesParFamille(regles, f);
  const epees = maitrises.find((m) => m.famille === 'epees');
  assert.deepEqual([epees.points, epees.comptes, epees.excedent, epees.des], [6, 4, 2, 5]);
  for (const m of MAITRISES) {
    const l = maitrises.find((x) => x.famille === m.famille);
    assert.deepEqual(casesDesDes(m).map((a) => e.remplis[a] ?? null), casesDesDes(m).map((_, i) => (i < l.des - 1 ? REMPLISSAGE_DE_ATTEINT : null)), m.famille);
  }
  assert.deepEqual(casesDesDes(MAITRISES.find((m) => m.famille === 'epees')).map((a) => e.remplis[a]), Array(4).fill(REMPLISSAGE_DE_ATTEINT), 'le 5e dé, pas au-delà');
  // la note : une ligne par source qui a un point choisi, dans l'ordre des sources (classe 1, ses lignes puis ses dons ; classe 2) ; un point sans famille avant un point choisi : « ? » ; un choix sur
  // une ligne que la classe n'a pas (« maitrise-arme:3 ») n'est pas valable : pas écrit
  const note = lireLaNote(e.cellules[ORDINATEUR.note]);
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.maitriseChoix), [
    'Tueur (maîtrise 1) : ÉPÉES', 'Mercenaire (maîtrise 1) : ARC, ?, HACHE', 'Chasseur de primes (Mercenaire) : ÉPÉES, ÉPÉES, ÉPÉES, ÉPÉES, ÉPÉES',
  ]);
  // l'arme choisie (R152) : la compétence, puis la famille de la maîtrise au choix du Tueur, calculée, entre parenthèses
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.acquisChoix), [`${arme.nom} : ${nomDe('competences', arme.options.at(-1))} (ÉPÉES)`]);
  // les choix de maîtrise avant les acquis au choix (l'ordre de CLES_DE_LA_NOTE)
  const ordre = Object.values(CLES_DE_LA_NOTE);
  assert.ok(ordre.indexOf(CLES_DE_LA_NOTE.maitriseChoix) < ordre.indexOf(CLES_DE_LA_NOTE.acquisChoix));
  // sans choix de maîtrise : la famille de l'arme choisie attend (R152), la ligne n'a pas de parenthèses ; la grille, les familles imposées seules
  const sans = cellulesDeLaFiche(regles, { ...f, maitrise_choix: [] }, { date: DATE });
  assert.deepEqual(lireLaNote(sans.cellules[ORDINATEUR.note]).valeur(CLES_DE_LA_NOTE.maitriseChoix), []);
  assert.deepEqual(lireLaNote(sans.cellules[ORDINATEUR.note]).valeur(CLES_DE_LA_NOTE.acquisChoix), []);
  assert.deepEqual(sans.remplis, {});
  // l'écriture et la lecture d'une ligne
  assert.deepEqual(lireChoixDeMaitrise('Mercenaire (maîtrise 1) : ARC, ?, HACHE'), { titre: 'Mercenaire (maîtrise 1)', familles: ['ARC', null, 'HACHE'] });
  assert.deepEqual(lireChoixDeMaitrise('Maître d\'arme (Guerrier) : ÉPÉES'), { titre: 'Maître d\'arme (Guerrier)', familles: ['ÉPÉES'] });
  assert.equal(lireChoixDeMaitrise('Mercenaire (maîtrise 1) : ?, ?'), null);
  assert.equal(lireChoixDeMaitrise('sans deux-points'), null);
  const sources = M.sourcesDeMaitrise(regles, f);
  for (const s of sources) {
    const t = texteDesChoixDeMaitrise(regles, s);
    if (t) assert.equal(lireChoixDeMaitrise(t).titre, s.titre, s.source);
  }
  assert.equal(texteDesChoixDeMaitrise(regles, sources.find((s) => s.source === 'classes/tueur#maitrise-arme:1')), 'Tueur (maîtrise 1) : ÉPÉES');
});

test('textes trop longs pour leur case (zones du modèle) : la case en garde le début ; seule la part relue a une suite dans la note, avant les informations', async () => {
  const zones = await zonesDuClasseur(await modeleXlsx());
  // la fiche riche, avec des textes relus trop longs : un nom d'objet, un événement, l'effet en plus d'une arme
  const long = 'Banni du Temple de Morfot pour avoir ouvert le Livre des Cendres, il doit se présenter chaque nouvelle lune devant le Haut Conseil, sans arme ni armure.';
  const fiche = {
    ...riche, evenements: `${riche.evenements}\n`.replace(EVENEMENTS[1], `Rencontre avec Mirada ${long}`),
    inventaire: riche.inventaire.map((o, i) => (i === 5 ? { ...o, nom: `${o.nom}, ${long}` } : o)),
    armes: riche.armes.map((x) => (x.rang === 1 ? { ...x, effet_en_plus: `${long}\n${long}` } : x)),
  };
  const sans = cellulesDeLaFiche(regles, fiche, { date: DATE }).cellules;
  const avec = cellulesDeLaFiche(regles, fiche, { date: DATE, zones });
  verifierLesAdresses(avec);
  const lignes = avec.cellules[ORDINATEUR.note].split('\n');
  const lues = lignes.slice(lignes.indexOf(MARQUEUR_DES_NOTES) + 1).map((l) => lireLigneDeNote(l));
  assert.ok(lues.every(Boolean), 'toute ligne sous le marqueur a une clé connue');
  const suites = lues.filter((l) => l.nom === 'suite');
  const effetArme1 = ORDINATEUR.armes[0].effet;
  const placeDeL = ORDINATEUR.inventaire.colonnes[0] + ORDINATEUR.inventaire.lignes[5];
  const ajoutees = [effetArme1, placeDeL, `L${DONS.evenements[1]}`];
  assert.deepEqual(ajoutees.filter((a) => !suites.some((x) => x.adresse === a)), [], 'les textes relus trop longs ont leur suite');
  // seules des cases relues (des choix du personnage) ont une suite : jamais un texte de règles
  const O = ORDINATEUR;
  const relues = new Set([O.nom, O.surnom, O.lieuOrigine, O.race, O.magieInnee, O.magieAcquise, O.dieuChoisi, O.xp, O.classe1, O.classe2, O.specialite1,
    O.specialite2, ...O.armes.flatMap((x) => [x.nom, x.effet]), O.armure.nom, O.armure.bonus, O.bouclier.nom, O.bouclier.composition,
    ...Object.values(O.accessoires), ...O.ceinture, ...O.inventaire.colonnes.flatMap((col) => O.inventaire.lignes.map((l) => `${col}${l}`)),
    casesDuDon(DONS.race).nom, casesDuDon(DONS.metier).nom, casesDuDon(DONS.metier).effet, casesDuDon(DONS.entrainement).effet,
    ...[...DONS.classe1, ...DONS.classe2].map((l) => casesDuDon(l).nom), ...DONS.evenements.flatMap((l) => [casesDuDon(l).nom, casesDuDon(l).effet]),
    ...O.sorts.lignes.map((l) => `${O.sorts.colonnes.nom}${l}`)]);
  assert.deepEqual(suites.map((x) => x.adresse).filter((a) => !relues.has(a)), [], 'une suite pour une case affichée');
  // l'entraînement (une rangée) trop long : la case en garde le début, la suite dans la note
  assert.ok(suites.some((x) => x.adresse === casesDuDon(DONS.entrainement).effet), 'l’entraînement trop long pour sa case a sa suite');
  // chaque case coupée : son début (fini par « … ») tient dans sa case ; recollé à la suite, il redonne la part relue du texte (ici : l'arme sans son
  // effet du catalogue ni ses lignes non comptées ; l'armure portée sans les statistiques du catalogue ni l'effet des améliorations, qui ne tiennent
  // pas ; les autres en entier)
  const armureCourte = lignesDArmure(regles, fiche, { stats: false, effets: false }).join('\n');
  const relue = (a) => ({ [effetArme1]: partiesDeLArme(regles, fiche, 1).relues.join('\n'), [O.armure.bonus]: armureCourte })[a] ?? sans[a];
  for (const { adresse, valeur } of suites) {
    const a = avec.alignements[adresse];
    assert.ok(a?.reduire || tientDans(avec.cellules[adresse], { ...zones.get(adresse), ...(a?.retour ? { retour: true } : {}) }), adresse);
    assert.equal(recollerLeTexte(avec.cellules[adresse], valeur), relue(adresse), adresse);
  }
  assert.ok(!suites.some((x) => x.valeur.includes(M.trouver(regles.armes, fiche.armes[0].arme_id).effet.split('\n')[0])), 'pas de texte du catalogue dans la note');
  assert.ok(armureCourte.startsWith(sansLaCoupure(avec.cellules[O.armure.bonus]) ?? avec.cellules[O.armure.bonus]), 'trois pièces : l’armure portée en bref');
  // les textes affichés seulement (effets des sorts et des dons, textes de la race, artisanat…) : coupés, sans suite ; la case garde leur début
  const coupees = Object.keys(sans).filter((a) => ![ORDINATEUR.note, O.armure.bonus].includes(a) && avec.cellules[a] !== sans[a]);
  const affichees = coupees.filter((a) => !suites.some((x) => x.adresse === a));
  assert.ok(affichees.length > 10, `${affichees.length} cases affichées coupées`);
  for (const a of affichees) {
    const debut = sansLaCoupure(avec.cellules[a]);
    assert.ok(debut !== null && sans[a].startsWith(debut), `${a} : le début du texte, fini par « … »`);
  }
  assert.ok(affichees.some((a) => /^AM\d+$/.test(a)) && affichees.includes(casesDuDon(DONS.race).effet), 'descriptions des sorts, dons de la race');
  // les autres cases : les mêmes qu'à l'export sans zones (la note mise à part) ; les alignements : retour à la ligne, réduction, note en haut
  for (const [a, v] of Object.entries(sans)) if (![ORDINATEUR.note, O.armure.bonus].includes(a) && !coupees.includes(a)) assert.equal(avec.cellules[a], v, a);
  assert.deepEqual(avec.remplis, exportRiche.remplis);
  assert.deepEqual(exportRiche.alignements, {}, 'sans zones, rien ne bouge');
  assert.ok(Object.values(avec.alignements).some((x) => x.reduire) && Object.values(avec.alignements).some((x) => x.retour));
  // l'ordre : les lignes que l'import relit, les suites, puis les informations
  const rangs = lues.map((l) => (l.nom === 'suite' ? 1 : l.information && l.nom !== 'export' ? 2 : 0));
  assert.deepEqual(rangs, [...rangs].sort((a, b) => a - b));
  assert.deepEqual(lireLigneDeNote('suite de la case am55 : du texte ⏎ suite'), { nom: 'suite', cle: SUITE_DE_LA_CASE, valeur: 'du texte ⏎ suite', information: false, adresse: 'AM55' });
});

test('portée d’une arme (décision R50) : celle de la page « Armes », 1 sans portée écrite ; solidité (R74) : « N / M », « 0 / M » cassée, rien pour une arme de monstre', () => {
  const sansPortee = regles.armes.find((a) => a.portee === '1' && a.effet && !/port[ée]e/i.test(a.effet));
  assert.ok(sansPortee, 'une arme dont l’effet n’écrit pas de portée');
  const f = { ...ficheVide('Portée'), armes: [{ rang: 1, arme_id: sansPortee.id, materiau_id: regles.materiau_arme_defaut }] };
  const v = cellulesDeLaFiche(regles, f, { date: DATE }).cellules;
  assert.equal(v[ORDINATEUR.armes[0].portee], 1, `${sansPortee.nom} : 1 par défaut`);
  const max = M.durabiliteMaxDArme(regles, f.armes[0]);
  assert.ok(max >= 1);
  assert.equal(v[ORDINATEUR.armes[0].solidite], `${max} / ${max}`, 'sans valeur : à son maximum');
  // une arme cassée : « 0 / M », ses dégâts (réparée) gardés en AG10 (ils départagent deux armes du même nom à l'import)
  const cassee = { ...f, armes: [{ ...f.armes[0], durabilite: 0 }] };
  const vc = cellulesDeLaFiche(regles, cassee, { date: DATE }).cellules;
  assert.equal(vc[ORDINATEUR.armes[0].solidite], `0 / ${max}`);
  assert.equal(vc[ORDINATEUR.armes[0].degats], v[ORDINATEUR.armes[0].degats]);
  assert.equal(vc[ORDINATEUR.armes[0].degats], M.degatsDArme(regles, cassee, 1).texte);
  // une valeur enregistrée au-delà du maximum (règles changées) : bornée
  assert.equal(cellulesDeLaFiche(regles, { ...f, armes: [{ ...f.armes[0], durabilite: max + 3 }] }, { date: DATE }).cellules[ORDINATEUR.armes[0].solidite], `${max} / ${max}`);
  // une arme de monstre (R45 : sans solidité) : la case garde le « / » du modèle
  const monstre = regles.armes.find((a) => a.solidite === null);
  assert.ok(monstre, 'une arme sans solidité');
  const vm = cellulesDeLaFiche(regles, { ...f, armes: [{ rang: 2, arme_id: monstre.id, materiau_id: regles.materiau_arme_defaut }] }, { date: DATE }).cellules;
  assert.equal(vm[ORDINATEUR.armes[1].nom], monstre.nom);
  assert.equal(vm[ORDINATEUR.armes[1].solidite], undefined);
  assert.equal(textesDuModele.get(ORDINATEUR.armes[1].solidite), '/');
  const aDistance = regles.armes.find((a) => a.portee.includes(' - '));
  const w = cellulesDeLaFiche(regles, { ...f, armes: [{ rang: 1, arme_id: aDistance.id, materiau_id: regles.materiau_arme_defaut }] }, { date: DATE }).cellules;
  assert.equal(w[ORDINATEUR.armes[0].portee], aDistance.portee);
});

test('case NOTE au-delà de 32 767 caractères : le marqueur et ses lignes restent entiers, les notes du joueur sont raccourcies, et un avertissement le dit', () => {
  const court = cellulesDeLaFiche(regles, { ...riche, notes: 'Court' }, { date: DATE });
  assert.deepEqual(court.avertissements, []);
  const donnees = court.cellules[ORDINATEUR.note].slice('Court\n\n'.length);
  assert.ok(donnees.startsWith(MARQUEUR_DES_NOTES));
  // des notes de 40 000 caractères (un journal de campagne)
  const notes = Array.from({ length: 4000 }, (_, i) => `Jour ${String(i).padStart(4, '0')}.`).join('\n').padEnd(40_000, 'x');
  const long = cellulesDeLaFiche(regles, { ...riche, notes }, { date: DATE });
  const note = long.cellules[ORDINATEUR.note];
  assert.equal(note.length, LONGUEUR_MAX_D_UNE_CASE, 'la case est pleine, pas plus');
  assert.ok(note.endsWith(`…\n\n${donnees}`), 'les données entières, après les notes raccourcies');
  const gardees = note.length - donnees.length - 3;
  assert.ok(notes.startsWith(note.slice(0, gardees)));
  assert.deepEqual(long.avertissements, [avertissementDesNotes(notes.length - gardees)]);
  assert.match(long.avertissements[0], /^Notes trop longues pour une case de tableur \(32\u00a0767 caractères\) : les \d{1,3}(?:\u00a0\d{3})* derniers caractères ne sont pas dans le classeur\.$/);
  // le reste de l'export ne change pas
  for (const [a, v] of Object.entries(court.cellules)) if (a !== ORDINATEUR.note) assert.equal(long.cellules[a], v, a);

  // des lignes de données trop longues elles-mêmes : les dernières retirées, une ligne entière à la fois ; les notes restent si la place le permet
  const lignes = [MARQUEUR_DES_NOTES, `A : ${'x'.repeat(20_000)}`, `B : ${'y'.repeat(20_000)}`, 'C : z'];
  const retrait = (n) => ligneDeNote(CLES_DE_LA_NOTE.lignesRetirees, String(n));
  assert.deepEqual(texteDeLaNote('Mes notes', lignes),
    { texte: `Mes notes\n\n${[...lignes.slice(0, 2), retrait(2)].join('\n')}`, avertissements: [avertissementDesDonnees(2)] }, 'la dernière ligne dit le retrait');
  assert.match(avertissementDesDonnees(2), /^Données de la case NOTE trop longues pour une case de tableur \(32\u00a0767 caractères\) : les 2 dernières lignes ne sont pas dans le classeur\.$/);
  assert.match(avertissementDesDonnees(1), /: la dernière ligne n’est pas dans le classeur\.$/);
  // la ligne du retrait a sa place : une ligne de données qui tiendrait seule, mais pas avec elle, est retirée aussi
  const juste = [MARQUEUR_DES_NOTES, `A : ${'x'.repeat(LONGUEUR_MAX_D_UNE_CASE - MARQUEUR_DES_NOTES.length - 10)}`, 'B : y'];
  const t = texteDeLaNote('', juste).texte;
  assert.equal(juste.slice(0, 2).join('\n').length <= LONGUEUR_MAX_D_UNE_CASE, true, 'la ligne A tiendrait seule');
  assert.equal(t, `${MARQUEUR_DES_NOTES}\n${retrait(2)}`, 'mais pas avec la ligne du retrait : elle part aussi');
  // sans place pour les notes : elles partent toutes, et un avertissement le dit
  const pleine = [MARQUEUR_DES_NOTES, `A : ${'x'.repeat(LONGUEUR_MAX_D_UNE_CASE - MARQUEUR_DES_NOTES.length - 6)}`];
  assert.deepEqual(texteDeLaNote('Mes notes', pleine), { texte: pleine.join('\n'), avertissements: [avertissementDesNotes('Mes notes'.length)] });
  // une paire de substitution n'est jamais coupée
  const emoji = texteDeLaNote('😀'.repeat(20_000), [MARQUEUR_DES_NOTES]).texte;
  assert.ok(emoji.length <= LONGUEUR_MAX_D_UNE_CASE && !/[\uD800-\uDBFF]…/.test(emoji));
  // dans l'export : 3 000 objets au-delà des 48 places, la ligne « Inventaire (suite) » (et ce qui la suit) retirée, celles d'avant entières
  const inventaire = Array.from({ length: 3000 }, (_, i) => ({ rang: i + 1, nom: `Objet numéro ${i} au nom bien long`, quantite: 1, ressource_id: null }));
  const trop = cellulesDeLaFiche(regles, { ...riche, notes: 'Mes notes', inventaire }, { date: DATE });
  const texte = trop.cellules[ORDINATEUR.note];
  assert.ok(texte.length <= LONGUEUR_MAX_D_UNE_CASE);
  assert.ok(texte.startsWith(`Mes notes\n\n${MARQUEUR_DES_NOTES}\n${ligneDExport(DATE)}\n`));
  const lues = texte.split('\n').slice(3).map(lireLigneDeNote);
  assert.ok(lues.every(Boolean) && lues.some((l) => l.cle === CLES_DE_LA_NOTE.gains) && !lues.some((l) => l.cle === CLES_DE_LA_NOTE.inventaire), 'des lignes entières, jusqu’à l’inventaire');
  assert.equal(lues.at(-1).cle, CLES_DE_LA_NOTE.lignesRetirees, 'la dernière ligne dit combien ont été retirées');
  assert.equal(trop.avertissements.length, 1);
  assert.match(trop.avertissements[0], /^Données de la case NOTE/);
  // une autre case trop longue (sans zones, rien n'est coupé ici) : un avertissement
  const enPlus = 'y'.repeat(LONGUEUR_MAX_D_UNE_CASE + 10);
  const arme = cellulesDeLaFiche(regles, { ...riche, armes: [{ ...riche.armes[0], effet_en_plus: enPlus }] }, { date: DATE });
  const longueur = arme.cellules[ORDINATEUR.armes[0].effet].length;
  assert.deepEqual(arme.avertissements, [avertissementDeCase(ORDINATEUR.armes[0].effet, longueur - (LONGUEUR_MAX_D_UNE_CASE - 1))]);
});

test('lecteurs de l’export : en temps linéaire sur une case faite surtout d’espaces (pas de préfixe paresseux suivi de blancs)', () => {
  const espaces = ' '.repeat(50_000);
  const s = `a${espaces}b`;
  const debut = performance.now();
  lireObjet(s);
  lireObjet(`(${espaces}b`);
  lireSortEnSuite(s);
  lireNmOfferts(s);
  lireGains(`niv. 2 : dé${s}`);
  lireGains(`niv. 2 : santé${s}`);
  lireAccessoire(regles, [s, `x${s}=`, `Attributs :${s}→${s}`]);
  lireEffetDArme(s);
  lireEffetDArme(`Effet en plus :${s}\n${s}`, { affichees: `${s}\nb`, catalogue: s });
  lireEffetDArme(`${s} …`, { affichees: `b${espaces}` });
  lireLigneDArmure(regles, s);
  lireLigneDArmure(regles, `Torse :${s}·${s}`);
  lireLigneDArmure(regles, `x (AP${s}`);
  lireChoixDuMetier(`${s}→${s}`);
  lireLigneDeNote(s);
  lireEffetDAmelioration(`(${s}`);
  texteDObjet({ nom: s, quantite: 1 });
  const ms = performance.now() - debut;
  assert.ok(ms < 2000, `${Math.round(ms)} ms`);
});

test('armure portée : sans les statistiques du catalogue, puis sans l’effet des améliorations, quand la case ne les tient pas', async () => {
  const zones = await zonesDuClasseur(await modeleXlsx());
  // l'armure, son amélioration, son élément et l'amélioration de l'élément (décision R95 : une ligne) : avec leurs statistiques, la case ne les tient pas
  const v = cellulesDeLaFiche(regles, riche, { date: DATE, zones }).cellules[ORDINATEUR.armure.bonus];
  const ecrite = (fiche, options) => lignesDArmure(regles, fiche, options).join('\n');
  assert.notEqual(v, ecrite(riche, {}), 'avec ses statistiques, la ligne ne tient pas');
  assert.doesNotMatch(v, /\((?:AP|AM) /, 'les statistiques retirées');
  const montre = sansLaCoupure(v) ?? v;
  assert.ok(ecrite(riche, { stats: false, effets: false }).startsWith(montre), 'puis l’effet des améliorations : la case en montre le plus possible');
  // l'armure seule : tout tient, statistiques comprises
  const seule = { ...riche, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null };
  const s = cellulesDeLaFiche(regles, seule, { date: DATE, zones }).cellules[ORDINATEUR.armure.bonus];
  assert.equal(s, ecrite(seule, {}));
  assert.match(s, /\(AP /);
});

test('fiche vide : rien d’inventé, les libellés du modèle restent', () => {
  const vide = cellulesDeLaFiche(regles, ficheVide(''), { date: DATE });
  verifierLesAdresses(vide);
  const v = vide.cellules;
  assert.deepEqual(vide.remplis, {});
  for (const adresse of ['I1', 'I2', 'S2', 'S3', 'S4', 'S5', 'A9', 'G9', 'A11', 'R15', 'T15', 'AA10', 'AA13', 'AD22', 'AQ21', 'AA26', 'AD29', 'AR29', 'AA40', 'C39', 'C40', 'L40', 'C41', 'I41', 'L41', 'L42', 'C43', 'C71', 'AA55', 'AG53', 'BI2', 'BI43', 'D15', 'A15']) {
    assert.equal(v[adresse], undefined, adresse);
  }
  const f = { ...ficheVide(''), caracteristiques: M.caracteristiquesCompletes(regles, ficheVide('')) };
  assert.equal(v[ORDINATEUR.alignement], M.alignementDe(regles, f).nom);
  assert.equal(v[ORDINATEUR.niveauGlobal], 1);
  for (const k of CASES_CARACTERISTIQUES) assert.equal(v[k.base], M.caracteristiquesDe(regles, f).find((x) => x.id === k.id).base, 'la base au minimum (caracteristiquesCompletes)');
  for (const k of CASES_COMPETENCES) {
    assert.equal(v[k.naturel], undefined);
    assert.equal(v[k.acquis], undefined);
  }
  const a = M.attributsDe(regles, f);
  assert.equal(v[ORDINATEUR.initiative], a.initiative ? `D20${a.initiativeBonus >= 0 ? '+' : '-'}${Math.abs(a.initiativeBonus)}` : 'D20');
  const note = lireLaNote(v[ORDINATEUR.note]);
  assert.equal(note.avant, '', 'pas de notes : le marqueur en tête');
  assert.deepEqual(note.lues.map((l) => l.nom), ['export', 'biClasse']);
});

test('Potentiel Illimité : l’Archimage imposé, la caractéristique au choix dans la note, pas de 4ᵉ barre', () => {
  const pi = fichePotentiel();
  const e = cellulesDeLaFiche(regles, pi, { date: DATE });
  verifierLesAdresses(e);
  const v = e.cellules;
  assert.equal(v[ORDINATEUR.classe1], nomDe('classes', 'classes/archimage'));
  assert.equal(v[casesDuDon(DONS.race).nom], nomDe('ethnies', pi.ethnie_id));
  assert.equal(v[ORDINATEUR.magieInnee], nomDe('magies', 'magies/potentiel-illimite'));
  assert.equal(v[ORDINATEUR.dieuInne], M.trouver(regles.magies, 'magies/potentiel-illimite').dieux.map((d) => nomDe('dieux', d)).join(', '));
  const intel = CASES_CARACTERISTIQUES.find((k) => k.id === 'intelligence');
  assert.equal(v[intel.bonus], 1, 'le +1 de la magie innée sur la caractéristique choisie');
  assert.equal(v[ORDINATEUR.barre4], undefined);
  assert.equal(v[ORDINATEUR.libelleBarre4], undefined, 'le libellé « Âme/Sang » du modèle reste');
  const h = M.modeHyperDe(regles, pi);
  assert.ok(h.debloque);
  assert.equal(v[ORDINATEUR.modeHyper.magieInnee], undefined, 'le Potentiel Illimité n’a que la forme complète, que la page ne montre pas');
  assert.equal(v[ORDINATEUR.modeHyper.race], `${h.race.nom} : ${h.race.effet}`);
  pi.sorts.forEach((l, i) => assert.equal(v[`AA${ORDINATEUR.sorts.lignes[i]}`], nomDe('sorts', l.sort_id)));
  const note = lireLaNote(v[ORDINATEUR.note]);
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.caracteristiqueMagie), [nomDe('caracteristiques', 'intelligence')]);
  const f = { ...pi, caracteristiques: M.caracteristiquesCompletes(regles, pi) };
  const attente = M.choixEnAttente(regles, f);
  assert.ok(attente.length, 'des dons de l’Archimage restent à choisir');
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.choixAFaire), [attente.map((x) => x.libelle).join(' ; ')]);
  assert.deepEqual(note.valeur(CLES_DE_LA_NOTE.modeHyperCent), [], 'pas encore au niveau 10');
});

test('Mort-vivant : le don unique et la ligne du tableau de l’ethnie ; l’Âme ; le métier absent laisse « Métier ? »', () => {
  const mv = ficheMortVivant();
  const e = cellulesDeLaFiche(regles, mv, { date: DATE });
  verifierLesAdresses(e);
  const v = e.cellules;
  const dr = M.donsDeRace(regles, mv);
  assert.ok(dr.tableau && dr.dons.length);
  const r = casesDuDon(DONS.race);
  assert.equal(v[r.nom], nomDe('ethnies', mv.ethnie_id));
  assert.equal(v[r.type], dr.dons[0].nom);
  assert.equal(v[r.effet], enUneLigne([
    ...dr.dons.map((d) => `${d.nom ?? d.etiquette} : ${d.texte}`), ...dr.tableau.cellules.map((x) => `${x.libelle.replace(/\n/g, ' / ')} : ${x.valeur}`),
  ]));
  assert.equal(v[ORDINATEUR.libelleBarre4], 'Âme');
  assert.match(v[ORDINATEUR.barre4], /^\d+ \/ \d+$/);
  const m = casesDuDon(DONS.metier);
  assert.deepEqual([v[m.nom], v[m.type], v[m.effet]], [undefined, undefined, undefined]);
  assert.equal(textesDuModele.get(m.nom), 'Métier\u00a0?', 'le libellé du modèle (espace insécable)');
});

test('bi-classe : les deux classes au niveau global, « Bi-classé : oui »', () => {
  const f = {
    ...ficheVide('Duo'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', mode_classe: 'bi', xp: xpDuNiveau(7),
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }, { rang: 2, classe_id: 'classes/archer', specialite_id: null }],
    // un arc seul (pas d'attaque à deux armes) et la portée des armes à distance d'un accessoire
    armes: [{ rang: 1, arme_id: 'ressources/armes#arme:arc:arc', materiau_id: regles.materiau_arme_defaut }],
    accessoires: [{ emplacement: 'chef', accessoire_effet_id: 'ressources/accessoires#effet:attaque:3', valeur: null, maudit: 0, competence_id: null, arme_famille_id: null }],
  };
  const e = cellulesDeLaFiche(regles, f, { date: DATE });
  verifierLesAdresses(e);
  const v = e.cellules;
  assert.deepEqual([v.G9, v.G11, v.W8], [7, 7, 7]);
  assert.deepEqual(lireLaNote(v[ORDINATEUR.note]).valeur(CLES_DE_LA_NOTE.biClasse), [OUI]);
  const arc = M.trouver(regles.armes, f.armes[0].arme_id);
  const degats = M.degatsDArme(regles, f, 1);
  assert.ok(arc.portee && degats.porteeEnPlus > 0);
  assert.equal(v[ORDINATEUR.armes[0].portee], `${arc.portee} + ${degats.porteeEnPlus}`, 'la portée du catalogue, plus celle des accessoires');
  assert.doesNotMatch(v[ORDINATEUR.armes[0].effet], new RegExp(LIGNES_D_ARME.deuxArmes), 'une seule arme');
  assert.equal(v[ORDINATEUR.armes[1].nom], undefined);
  // classe 2 d'un mono-classe pas encore prise (niveau 0) : nommée, niveau 0, sans don
  const mono = cellulesDeLaFiche(regles, { ...f, mode_classe: 'mono', xp: xpDuNiveau(3) }, { date: DATE }).cellules;
  assert.deepEqual([mono.A11, mono.G11, mono.C57], [nomDe('classes', 'classes/archer'), 0, undefined]);
});

test('dons de trop (deux options d’un même choix) : au-delà de sept, la note « Dons de classe 1 (suite) »', () => {
  const f = { ...ficheVide('Trop'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', xp: xpDuNiveau(10),
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:epeiste' }] };
  f.capacites = M.donsAChoisir(regles, f).flatMap((d) => d.groupes.flatMap((g) => g.options.map((o) => ({ capacite_id: o.id }))));
  const dons = M.donsAcquis(regles, f)[0].dons;
  assert.ok(dons.length > DONS.classe1.length);
  const v = cellulesDeLaFiche(regles, f, { date: DATE }).cellules;
  DONS.classe1.forEach((ligne, i) => assert.equal(v[casesDuDon(ligne).nom], dons[i].nom));
  assert.deepEqual(lireListe(lireLaNote(v[ORDINATEUR.note]).valeur(CLES_DE_LA_NOTE.donsClasse1)[0]), dons.slice(DONS.classe1.length).map((d) => d.nom));
});

test('mise en forme de la note et des lignes : relue telle qu’écrite', () => {
  // clés : comparées par cle(), une ligne inconnue rendue null
  assert.deepEqual(lireLigneDeNote(ligneDeNote(CLES_DE_LA_NOTE.biClasse, OUI)), { nom: 'biClasse', cle: 'Bi-classé', valeur: 'oui', information: false });
  assert.equal(lireLigneDeNote('BI-CLASSE : oui').nom, 'biClasse');
  assert.deepEqual(lireLigneDeNote(ligneDExport(DATE)), { nom: 'export', cle: 'Exporté le', valeur: DATE, information: true });
  assert.equal(lireLigneDeNote('Remarque : rien'), null);
  assert.equal(lireLigneDeNote('sans clé'), null);
  assert.deepEqual(lireLigneDeNote('Accessoire Ceinture : Boucle / Attributs : +2 Initiative'),
    { nom: 'accessoire', cle: 'Accessoire Ceinture', valeur: 'Boucle / Attributs : +2 Initiative', information: false, emplacement: 'ceinture' });
  assert.equal(lireLigneDeNote(ligneDeNote(CLES_DE_LA_NOTE.choixAFaire, 'x')).information, true);
  assert.deepEqual(Object.keys(CLES_DES_ACCESSOIRES_SANS_CASE), M.EMPLACEMENTS_ACCESSOIRES.map(([x]) => x).filter((x) => !EMPLACEMENTS_DU_MODELE.includes(x)));
  // objets
  for (const o of [{ nom: 'Corde', quantite: 1 }, { nom: 'Flèche', quantite: 20 }, { nom: 'Potion (soin)', quantite: 3 }]) assert.deepEqual(lireObjet(texteDObjet(o)), o);
  assert.equal(texteDObjet({ nom: 'Corde', quantite: null }), 'Corde');
  assert.deepEqual(lireObjet('Flèche x 12'), { nom: 'Flèche', quantite: 12 });
  assert.deepEqual(lireObjet('Flèche (x12)'), { nom: 'Flèche', quantite: 12 });
  assert.deepEqual(lireObjet('Flèche (12)'), { nom: 'Flèche', quantite: 12 });
  assert.deepEqual(lireObjet('Box3'), { nom: 'Box3', quantite: 1 });
  // les écritures des joueurs (fiche auto, cases remplies à la main)
  assert.deepEqual(lireObjet('Super fiole verte ×3'), { nom: 'Super fiole verte', quantite: 3 });
  assert.deepEqual(lireObjet('Ration x 2'), { nom: 'Ration', quantite: 2 });
  assert.deepEqual(lireObjet('Corde×3'), { nom: 'Corde', quantite: 3 });
  assert.deepEqual(lireObjet('Carquois normal (10) ×1'), { nom: 'Carquois normal (10)', quantite: 1 }, 'un nom qui finit par « (N) » garde son « ×1 »');
  assert.deepEqual(lireObjet('Crochet (x3)'), { nom: 'Crochet', quantite: 3 });
  assert.deepEqual(lireObjet('Corde (4)'), { nom: 'Corde', quantite: 4 });
  assert.deepEqual(lireObjet('Fiole toxique 3d8'), { nom: 'Fiole toxique 3d8', quantite: 1 });
  assert.deepEqual(lireObjet('Potion max 2'), { nom: 'Potion max 2', quantite: 1 }, 'le x d’un mot n’est pas une quantité');
  assert.equal(lireObjet('  '), null);
  // un nom qui finit comme une quantité garde son « ×1 » ; toutes les ressources se relisent telles quelles
  assert.equal(texteDObjet({ nom: 'Carquois normal (10)', quantite: 1 }), 'Carquois normal (10) ×1');
  for (const r of regles.ressources) for (const quantite of [1, 3]) assert.deepEqual(lireObjet(texteDObjet({ nom: r.nom, quantite })), { nom: r.nom, quantite }, r.nom);
  // gains, NM offerts, sorts en suite, améliorations, événements
  // gains de niveau : deux totaux (décision R73) ; la note d'un classeur exporté avant, niveau par niveau, est sommée (« les deux » sur chacun)
  assert.equal(texteDesGains({ gains_sante: 30, gains_chakra: 36 }), 'santé 30, chakra 36');
  assert.equal(texteDesGains({ gains_sante: 0, gains_chakra: 5 }), 'santé 0, chakra 5');
  assert.equal(texteDesGains({ gains_sante: 0, gains_chakra: 0 }), '', 'rien à noter');
  assert.equal(texteDesGains({}), '');
  for (const g of [{ gains_sante: 30, gains_chakra: 36 }, { gains_sante: 0, gains_chakra: 5 }]) assert.deepEqual(lireGains(texteDesGains(g)), g);
  assert.deepEqual(lireGains('chakra 12'), { gains_sante: 0, gains_chakra: 12 }, 'une partie absente : 0');
  assert.deepEqual(lireGains('Chakra 12, Santé 3'), { gains_sante: 3, gains_chakra: 12 });
  assert.deepEqual(lireGains('niv. 2 : santé 10, chakra 5 ; niv. 5 : santé 5, chakra 10, dé chakra 6 ; niv. 9 : santé 0, chakra 15, dé les deux'),
    { gains_sante: 15, gains_chakra: 36 }, 'l’ancienne note : un dé sans résultat compte 0');
  assert.deepEqual(lireGains('niveau 10 : santé 15, dé les deux 3'), { gains_sante: 18, gains_chakra: 3 });
  assert.equal(lireGains('niv. 2 : beaucoup'), null, 'une partie illisible : null (l’import le dit)');
  assert.equal(lireGains('niv. 2 : santé 10 ; deux'), null);
  assert.equal(lireGains('santé 10, santé 3'), null, 'deux fois la santé');
  assert.equal(lireGains('beaucoup'), null);
  assert.deepEqual(lireGains(''), { gains_sante: 0, gains_chakra: 0 });
  const sorts = regles.sorts.slice(0, 3).map((s, i) => ({ sort_id: s.id, niveau_maitrise: 3, nm_livre: i === 1 ? 0 : 1 }));
  assert.equal(texteDesNmOfferts(regles, sorts), `${nomDe('sorts', sorts[0].sort_id)} (livre 1) ; ${nomDe('sorts', sorts[2].sort_id)} (livre 1)`, 'les livres seuls (décision R118)');
  assert.deepEqual(lireNmOfferts(texteDesNmOfferts(regles, sorts)), [sorts[0], sorts[2]].map((s) => ({ nom: nomDe('sorts', s.sort_id), livre: 1, cadeau: 0 })));
  assert.equal(texteDesNmOfferts(regles, [{ sort_id: regles.sorts[0].id, niveau_maitrise: 2 }]), '');
  // un classeur d'avant la décision R118 : les NM du MJ sort par sort
  assert.deepEqual(lireNmOfferts('Boule de feu (livre 1, MJ 2) ; Rayon d’Aurora (MJ 1)'), [{ nom: 'Boule de feu', livre: 1, cadeau: 2 }, { nom: 'Rayon d’Aurora', livre: 0, cadeau: 1 }]);
  assert.deepEqual(lireNmOfferts('Sort (rituel) (livre 1)'), [{ nom: 'Sort (rituel)', livre: 1, cadeau: 0 }]);
  assert.equal(lireNmOfferts('Boule de feu'), null);
  assert.equal(lireNmOfferts('Boule de feu (cadeau 1)'), null);
  assert.deepEqual(lireSortEnSuite(texteDeSortEnSuite('Boule de feu', 2)), { nom: 'Boule de feu', nm: 2 });
  const amelioration = regles.ameliorations.find((a) => a.cible === 'arme' && a.niveau === 3);
  assert.equal(lireNiveauDAmelioration(texteDAmelioration(amelioration)), 3);
  assert.equal(lireEffetDAmelioration(texteDAmelioration(amelioration)), amelioration.effet);
  assert.deepEqual([lireNiveauDAmelioration('niv. 4 (+8 AP/AM)'), lireEffetDAmelioration('niv. 4 (+8 AP/AM)')], [4, '+8 AP/AM']);
  assert.deepEqual([lireNiveauDAmelioration('niveau 2'), lireEffetDAmelioration('niveau 2')], [2, null]);
  assert.deepEqual(decouperEvenement('Titre : texte : suite'), { titre: 'Titre', texte: 'texte : suite' });
  assert.deepEqual(decouperEvenement('Rien à couper'), { titre: '', texte: 'Rien à couper' });
  assert.deepEqual(decouperEvenement('Titre :'), { titre: '', texte: 'Titre :' });
  // un accessoire relu (cellule et note) : l'écriture courte, la propriété seulement quand elle est écrite
  const malediction = regles.accessoires.find((x) => x.libelle === 'MALÉDICTION');
  const essais = [...riche.accessoires, { emplacement: 'autre', nom: 'Force', accessoire_effet_id: regles.accessoires.find((x) => x.libelle === 'Force').id },
    { emplacement: 'autre', accessoire_effet_id: malediction.id, maudit: 1 }];
  for (const a of essais) {
    const effet = M.trouver(regles.accessoires, a.accessoire_effet_id);
    const lignes = lignesDAccessoire(regles, a);
    const ligne = effet ? lignes[a.nom ? 1 : 0] : null;
    const attendu = {
      nom: a.nom ?? null, ligne, propriete: ligne?.startsWith(`${effet.propriete_nom} :`) ? effet.propriete_nom : null, libelle: effet?.libelle ?? null,
      valeur: effet?.min != null ? a.valeur : null, texte: a.texte ?? null,
      choix: a.competence_id ? nomDe('competences', a.competence_id) : a.arme_famille_id ? nomDe('familles_armes', a.arme_famille_id) : null, maudit: Boolean(a.maudit),
      autres: [],
    };
    assert.deepEqual(lireAccessoire(regles, lignes.join('\n')), attendu, a.emplacement);
    assert.deepEqual(lireAccessoire(regles, lignes.join(' / ').split(' / ')), attendu, `${a.emplacement} (note)`);
  }
  const sansLibelle = regles.accessoires.find((x) => !x.libelle);
  assert.equal(lireAccessoire(regles, lignesDAccessoire(regles, { accessoire_effet_id: sansLibelle.id })).propriete, sansLibelle.propriete_nom, 'un effet sans libellé garde sa propriété');
  assert.equal(lireAccessoire(regles, `${malediction.propriete_nom} : MALÉDICTION = 3`).propriete, malediction.propriete_nom);
  // l'ancienne écriture : « <propriété> : <libellé> = N », puis « → X » sur sa ligne
  const chef = M.trouver(regles.accessoires, riche.accessoires[0].accessoire_effet_id);
  assert.deepEqual(lireAccessoire(regles, `Diadème\n${chef.propriete_nom} : ${chef.libelle} = 8\n→ Concentration\nMaudit`),
    { nom: 'Diadème', ligne: `${chef.propriete_nom} : ${chef.libelle} = 8`, propriete: chef.propriete_nom, libelle: chef.libelle, valeur: 8, texte: null, choix: 'Concentration', maudit: true, autres: [] });
  // un nom seul ; une ligne de trop
  assert.deepEqual(lireAccessoire(regles, 'Bracelet sans effet').nom, 'Bracelet sans effet');
  assert.deepEqual(lireAccessoire(regles, 'Bracelet\nUne seconde ligne\n+5 Santé').autres, ['Une seconde ligne']);
  assert.equal(LIGNES_D_ARME.effetEnPlus, 'Effet en plus');
});

test('lignes d’armure, effet d’une arme, choix du métier : relus tels qu’écrits (écriture courte et ancienne, case coupée)', () => {
  // armure : l'écriture de lignesDArmure (une ligne, décision R95), avec ou sans statistiques et effets ; l'ancienne (une ligne par pièce)
  for (const options of [{}, { stats: false }, { stats: false, effets: false }]) {
    const [ligne] = lignesDArmure(regles, riche, options);
    const lu = lireLigneDArmure(regles, ligne);
    const amelioration = M.trouver(regles.ameliorations, riche.armure_amelioration_id);
    const ameliorationElement = M.trouver(regles.ameliorations, riche.armure_amelioration_elementaire_id);
    assert.deepEqual([lu.emplacement_id, lu.emplacementEcrit, lu.armure, lu.element, lireNiveauDAmelioration(lu.amelioration), lireNiveauDAmelioration(lu.ameliorationElement), lu.autres],
      [ARMURE_COMPLETE, false, nomDe('armures', riche.armure_id), nomDe('armures_elementaires', riche.armure_elementaire_id), amelioration.niveau, ameliorationElement.niveau, []],
      JSON.stringify(options));
    if (options.effets !== false) assert.equal(lireEffetDAmelioration(lu.amelioration), amelioration.effet);
  }
  assert.deepEqual(lireLigneDArmure(regles, 'Torse : Cuir (AP 3, AM 1) · Amélioration : niv. 1 — +2 AP/AM · Élément : Garde coeur (AP 7, AM 3) · Amélioration de l’élément : niv. 2 — +4 AP/AM · Gravée'),
    { emplacement_id: 'torse', emplacementEcrit: true, armure: 'Cuir', amelioration: 'niv. 1 — +2 AP/AM', element: 'Garde coeur', ameliorationElement: 'niv. 2 — +4 AP/AM', autres: ['Gravée'] });
  assert.deepEqual([lireLigneDArmure(regles, '+2 AP (forgeron)').emplacementEcrit, lireLigneDArmure(regles, '+2 AP (forgeron)').armure], [false, '+2 AP (forgeron)']);
  assert.deepEqual(lireLigneDArmure(regles, 'Cuir·sans blancs · amél. niv. 1').armure, 'Cuir·sans blancs', 'un « · » sans blancs autour ne sépare pas');
  assert.deepEqual(lireLigneDArmure(regles, 'Armure Complète : Vêtement renforcé (AP 2, AM 2)').emplacement_id, ARMURE_COMPLETE, 'l’ancienne armure complète');
  assert.deepEqual(lireLigneDArmure(regles, 'Cotte de maille (Fer) · amél. niv. 2').armure, 'Cotte de maille (Fer)', 'ses parenthèses gardées, sans emplacement : l’armure complète');

  // effet d'une arme : les lignes relues ; l'effet en plus jusqu'à la part affichée, entière, coupée dedans ou juste avant ; l'ancien ordre
  const { relues, affichees } = partiesDeLArme(regles, riche, 1);
  const effet = [...relues, ...affichees].join('\n');
  const attendu = { composition: 'Acier', amelioration: texteDAmelioration(M.trouver(regles.ameliorations, riche.armes[0].amelioration_id)),
    element: nomDe('armes_elementaires', riche.armes[0].arme_elementaire_id), ameliorationElement: texteDAmelioration(M.trouver(regles.ameliorations, riche.armes[0].amelioration_elementaire_id)),
    effetEnPlus: 'Lame chantante\nsur deux lignes', libres: [], ecartees: [], affichageRetrouve: true };
  const A = affichees.join('\n');
  assert.deepEqual(lireEffetDArme(effet, { affichees: A }), attendu);
  const relu = relues.join('\n');
  for (const coupe of [`${relu}\n${A.slice(0, 1)}…`, `${relu}\n${A.slice(0, A.indexOf(' ', 20))} …`, `${relu} …`, `${relu}\n${affichees[0]} …`]) {
    assert.deepEqual(lireEffetDArme(coupe, { affichees: A }), attendu, coupe.slice(-40));
  }
  assert.deepEqual(lireEffetDArme(relu, { affichees: A, entier: true }), attendu, 'recollée : la part relue seule');
  // la part affichée attendue introuvable d'un bloc (règles changées) : reconnue ligne à ligne, et dit
  assert.deepEqual(lireEffetDArme(`${relu}\n${affichees[0]}`, { affichees: `${affichees[0]}\nDeux armes : autre` }), { ...attendu, affichageRetrouve: false });
  assert.equal(lireEffetDArme(`${relu}\n${A}`.replace('sur deux lignes', 'sur deux lignes …'), { affichees: A }).effetEnPlus, 'Lame chantante\nsur deux lignes …', 'un « … » écrit par le joueur reste');
  // sans la part affichée de la fiche (case réécrite, règles changées) : ligne à ligne, l'effet du catalogue, « Deux armes : », « Non compté : »
  assert.equal(lireEffetDArme(`${relu}\nDeux armes : −20 % (main directrice)`).effetEnPlus, attendu.effetEnPlus);
  assert.equal(lireEffetDArme(`${relu}\n${affichees[0]}\nNon compté : Contact +2 (ancienne valeur)`, { catalogue: affichees[0] }).effetEnPlus, attendu.effetEnPlus);
  // une ligne qui n'est ni d'une clé connue ni de la part affichée : de l'effet en plus (le joueur écrit sous le titre « Effet en plus » du modèle)
  assert.deepEqual(lireEffetDArme(`${relu}\n${affichees[0]}\nautre`, { catalogue: affichees[0] }), { ...attendu, effetEnPlus: `${attendu.effetEnPlus}\nautre`, libres: ['autre'] });
  assert.deepEqual(lireEffetDArme(`${relu}\n${A}\nautre`, { affichees: A }), { ...attendu, effetEnPlus: `${attendu.effetEnPlus}\nautre`, libres: ['autre'] }, 'après le bloc');
  // l'ancien ordre (l'effet en plus en dernier)
  assert.deepEqual(lireEffetDArme([...relues.slice(0, 4), ...affichees, 'Effet en plus : Lame chantante', 'sur deux lignes'].join('\n'), { affichees: A }), attendu);
  assert.deepEqual(lireEffetDArme('Composition : Fer\nUn effet écrit à la main', { affichees: '' }),
    { composition: 'Fer', amelioration: null, element: null, ameliorationElement: null, effetEnPlus: 'Un effet écrit à la main', libres: ['Un effet écrit à la main'], ecartees: [], affichageRetrouve: true });
  // une ligne « Non compté : » ou « Deux armes : » que la fiche relue n'écrit plus (classeur exporté avant un changement des règles : « Vieille Branche »
  // était un bonus non compté avant la décision R107) : jamais de l'effet en plus, après le bloc retrouvé, dans l'ancien ordre, ou dans une case coupée
  // dedans ; écartée, telle qu'écrite (`ecartees`, que l'import dit) ; une ligne du site que la fiche relue écrit pour cette arme ne l'est pas
  const ancienne = 'Non compté : Vieille Branche (Mage Vert) +4 (selon la situation)';
  assert.ok(ancienne.startsWith(`${LIGNES_D_ARME.nonCompte}${SEPARATEUR_DE_CLE}`) && `Deux armes : x`.startsWith(`${LIGNES_D_ARME.deuxArmes}${SEPARATEUR_DE_CLE}`), 'le format écrit par l’export');
  assert.ok(!affichees.includes(ancienne));
  const pasEcrites = (lignes) => lignes.filter((l) => !affichees.includes(l));
  assert.deepEqual(lireEffetDArme(`${relu}\n${A}\n${ancienne}`, { affichees: A }), { ...attendu, ecartees: [ancienne] }, 'après le bloc');
  const deuxArmes = 'Deux armes : −20 % (main directrice)';
  assert.deepEqual(lireEffetDArme(`${relu}\n${A}\n${deuxArmes}\n${ancienne}`, { affichees: A }), { ...attendu, ecartees: pasEcrites([deuxArmes, ancienne]) }, 'deux lignes du site');
  assert.deepEqual(lireEffetDArme(`${relu}\n${A}\nDeux armes : −99 % (main directrice)`, { affichees: A }), { ...attendu, ecartees: ['Deux armes : −99 % (main directrice)'] }, 'une autre valeur');
  assert.deepEqual(lireEffetDArme([...relues.slice(0, 4), ...affichees, ancienne, 'Effet en plus : Lame chantante', 'sur deux lignes'].join('\n'), { affichees: A }), { ...attendu, ecartees: [ancienne] }, 'l’ancien ordre');
  for (const coupe of [`${relu}\n${A}\n${ancienne.slice(0, ancienne.indexOf(' ', 25))} …`, `${relu}\n${A}\n${ancienne.slice(0, 20)}…`]) {
    assert.deepEqual(lireEffetDArme(coupe, { affichees: A }), { ...attendu, ecartees: [coupe.split('\n').at(-1)] }, coupe.slice(-40));
  }
  // l'ancienne ligne au milieu de la part affichée, la case coupée dans la dernière ligne du site : la part affichée cherchée sans les lignes du site de la fin
  assert.ok(affichees.length >= 2 && /^(Deux armes|Non compté) : /.test(affichees.at(-1)), affichees.join(' | '));
  const auMilieu = [relu, affichees[0], ancienne, ...affichees.slice(1)].join('\n');
  for (const coupe of [`${auMilieu.slice(0, auMilieu.lastIndexOf(' '))} …`, `${auMilieu.slice(0, auMilieu.lastIndexOf('\n') + 16)}…`]) {
    // la dernière ligne, coupée, commence une ligne que la fiche écrit : seule l'ancienne est écartée
    assert.deepEqual(lireEffetDArme(coupe, { affichees: A }), { ...attendu, ecartees: [ancienne], affichageRetrouve: false }, coupe.slice(-40));
  }
  // une ligne du joueur dans le bloc « Effet en plus : » reste la sienne (l'export l'écrit avant la part affichée)
  assert.equal(lireEffetDArme(`${relu}\nNon compté : par le MJ\n${A}`, { affichees: A }).effetEnPlus, 'Lame chantante\nsur deux lignes\nNon compté : par le MJ');

  // métier : les rangs à choix, par leur ligne ; « → ? » pas choisi ; la fin « … » d'une case coupée juste après
  assert.deepEqual(lireChoixDuMetier('+2% Magie OU Concentration → Magie\n+1 Initiative → ?\nArtisanat : x'), [{ texte: '+2% Magie OU Concentration', choix: 'Magie' }, { texte: '+1 Initiative', choix: null }]);
  assert.deepEqual(lireChoixDuMetier('+2% Magie OU Concentration → Magie …'), [{ texte: '+2% Magie OU Concentration', choix: 'Magie' }]);
});

test('titres des postures : ceux du modèle, dans l’ordre des règles', () => {
  for (const p of CASES_POSTURES) assert.equal(TITRES_DES_POSTURES[p.id], textesDuModele.get(p.titre), p.id);
  assert.deepEqual(CASES_POSTURES.map((p) => p.id), regles.ordre_postures);
});

test('export déterministe et sans effet sur la fiche', () => {
  const avant = JSON.stringify(riche);
  assert.deepEqual(cellulesDeLaFiche(regles, riche, { date: DATE }), exportRiche);
  assert.equal(JSON.stringify(riche), avant);
});

test('le module n’importe que des modules réservés à la page /fiche/ (pas de module partagé, pas d’import dynamique)', () => {
  const source = readFileSync(new URL('../src/lib/fiche-tableur-export.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import [^;]*? from '([^']+)';/gm)].map((m) => m[1]);
  const permis = ['./fiche-moteur.mjs', './sort-maitrise.mjs', './sort-cout.mjs', './fiche-format.mjs', './fiche-tableur-cases.mjs', './degats-texte.mjs', './tableur-mesure.mjs'];
  assert.deepEqual(imports.filter((x) => !permis.includes(x)), []);
  assert.doesNotMatch(source, /\bimport\(/);
  // lib/degats-texte.mjs : seul src/scripts/fiche.mjs l'importe parmi les scripts de page, et il n'importe rien
  assert.doesNotMatch(readFileSync(new URL('../src/lib/degats-texte.mjs', import.meta.url), 'utf8'), /^import /m);
  // lib/sort-cout.mjs (les deux coûts d'un sort en une case, décision R105) : de même
  assert.doesNotMatch(readFileSync(new URL('../src/lib/sort-cout.mjs', import.meta.url), 'utf8'), /^import /m);
});
