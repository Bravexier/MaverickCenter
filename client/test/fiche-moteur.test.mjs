// Moteur de la fiche (lib/fiche-moteur.mjs) sur les vraies règles (lib/fiche-regles.mjs, la base construite) : chaque calcul comparé à sa source —
// les vues de la base (v_personnage_niveau, v_personnage_controle, par le service sur une base vivante temporaire), les personnages fil rouge du
// guide (lib/guide-fil-rouge.mjs) et les décisions du propriétaire (R2, R3, R6, R7, R15, R16, R19, R20, R23, R24, R25, R26, R27, R28).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  attributsDe, borner, budgetCaracteristiques, budgetCompetences, caracteristiquesCompletes, caracteristiquesDe, classeImposee, lignesDeSorts, magieAcquiseValable, nmDuSort,
  progressionXp, classeMagique, classesPermises, classesSelonLaMagieInnee,
  competencesDe, donsAChoisir, donsValables, emplacementsDeSorts, ethnieCompatible, ethnieImposee, ethniesDeLaRace, magiesInneesPermises, maitriseDesSorts, niveauGlobal,
  maitriseDArme, niveauxDeClasse, notationDesDes, npmMax, progressionAttendue, puissanceMagique, refusClasse, refusMagieAcquise, sortsParNpm, sortsPossibles, ecrireValeurDuMoment, valeursDuMoment, xpDuNiveauSuivant,
} from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { FIL_ROUGE, chargerFilRouge } from '../src/lib/guide-fil-rouge.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const racine = mkdtempSync(join(tmpdir(), 'maverick-moteur-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: racine }).chemin);

/** Humain central, Feu inné (Social), Guerrier ; 14 points de caractéristiques, 100 de compétences : conforme au niveau 1. */
function ficheConforme(surcharge = {}) {
  return {
    ...ficheVide('Essai'),
    race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu',
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }],
    caracteristiques: Object.entries({ force: 4, volonte: 2, intelligence: 2, perception: 2, social: 2, agilite: 2 }).map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: 0 })),
    competences: ['arc', 'arme-lourde', 'athletisme', 'parade', 'stabilite'].map((competence_id) => ({ competence_id, naturel: 20, acquis: 0 })),
    ...surcharge,
  };
}

test('niveau global et niveaux de classe : mêmes valeurs que v_personnage_niveau (décision R2), pour toute XP et les deux modes', () => {
  for (const mode of ['mono', 'bi']) {
    for (const xp of [0, 199, 200, 1649, 1650, 11450, 17049, 17050, 95450, 460249, 460250, 9999999]) {
      const { personnage } = enregistrerFiche(vivante, { ...ficheVide(`xp ${xp}`), xp, mode_classe: mode });
      const sql = { ...vivante.prepare('SELECT niveau_global, niveau_classe_1, niveau_classe_2 FROM v_personnage_niveau WHERE personnage_id = ?').get(personnage.id) };
      const niveau = niveauGlobal(regles, xp);
      const classes = niveauxDeClasse(regles, niveau, mode);
      assert.deepEqual({ niveau_global: niveau, niveau_classe_1: classes.classe1, niveau_classe_2: classes.classe2 }, sql, `${mode} ${xp} XP`);
    }
  }
  assert.equal(xpDuNiveauSuivant(regles, 1), 200);
  assert.equal(xpDuNiveauSuivant(regles, 20), null);
});

test('une fiche que le moteur dit dans ses budgets n’a aucune ligne de contrôle dans la base ; hors budget, la base dit la même chose', () => {
  const fiche = ficheConforme({ statut: 'valide' });
  assert.deepEqual(budgetCaracteristiques(regles, fiche), { total: 14, attendu: 14 });
  assert.deepEqual(budgetCompetences(regles, fiche), { total: 100, attendu: 100 });
  const { controles } = enregistrerFiche(vivante, fiche);
  assert.deepEqual(controles, []);

  const hors = ficheConforme({ caracteristiques: fiche.caracteristiques.map((c) => (c.caracteristique_id === 'force' ? { ...c, base: 3 } : c)) });
  assert.deepEqual(budgetCaracteristiques(regles, hors), { total: 13, attendu: 14 });
  const r = enregistrerFiche(vivante, hors);
  assert.deepEqual(r.controles.map((c) => c.regle), ['caracteristiques_total']);
  assert.equal(r.controles[0].detail, '13 / 14');

  // Niveau 5 : 15 caractéristiques, 100 + 20 + 20 + 20 + 40 compétences, naturel au plus 30 (seuils du niveau).
  const niveau5 = ficheConforme({ xp: 1650 });
  assert.deepEqual(budgetCaracteristiques(regles, niveau5), { total: 14, attendu: 15 });
  assert.deepEqual(budgetCompetences(regles, niveau5), { total: 100, attendu: 200 });
  assert.equal(competencesDe(regles, niveau5)[0].maxNaturel, 30);
});

test('jauge d’XP : niveau, seuil du niveau et du suivant, part parcourue ; niveau maximal ; XP négative ou vide comptée 0', () => {
  assert.deepEqual(progressionXp(regles, 0), { xp: 0, niveau: 1, debut: 0, suivant: 200, part: 0 });
  assert.deepEqual(progressionXp(regles, 100), { xp: 100, niveau: 1, debut: 0, suivant: 200, part: 0.5 });
  const trois = progressionXp(regles, 550);
  assert.deepEqual([trois.niveau, trois.debut, trois.suivant, trois.part], [3, 550, regles.niveaux.find((n) => n.niveau === 4).xp_min, 0]);
  const max = progressionXp(regles, 9999999);
  assert.deepEqual([max.niveau, max.suivant, max.part], [20, null, 1]);
  assert.equal(progressionXp(regles, -5).xp, 0);
  assert.equal(progressionXp(regles, '').niveau, 1);
});

test('caractéristiques complètes : les six, au minimum de la race (1) quand elles manquent, jamais vides ; bornées au changement de race', () => {
  const vide = caracteristiquesCompletes(regles, { ...ficheVide(), caracteristiques: [] });
  assert.deepEqual(vide.map((c) => c.caracteristique_id), regles.caracteristiques.map((c) => c.id));
  assert.ok(vide.every((c) => c.base === 1 && c.croix === 0), 'sans race : 1 partout');
  const force5 = { ...ficheVide(), caracteristiques: [{ caracteristique_id: 'force', base: 5, croix: 1 }] };
  assert.deepEqual(caracteristiquesCompletes(regles, force5).find((c) => c.caracteristique_id === 'force'), { caracteristique_id: 'force', base: 5, croix: 1 }, 'gardée telle quelle');
  assert.equal(caracteristiquesCompletes(regles, force5, { borner: true }).find((c) => c.caracteristique_id === 'force').base, 4, 'ramenée au maximum');
  const race = regles.races.find((r) => Object.values(r.bornes).some(([min]) => min > 1));
  if (race) {
    const [carac, [min]] = Object.entries(race.bornes).find(([, [m]]) => m > 1);
    assert.equal(caracteristiquesCompletes(regles, { ...ficheVide(), race_id: race.id, caracteristiques: [] }).find((c) => c.caracteristique_id === carac).base, min, `${race.nom} : ${carac} part de ${min}`);
  }
  // une fiche complétée passe dans la base (bornes et colonnes)
  const fiche = { ...ficheConforme(), caracteristiques: [] };
  fiche.caracteristiques = caracteristiquesCompletes(regles, fiche);
  assert.ok(!enregistrerFiche(vivante, fiche).controles.some((c) => c.regle.startsWith('caracteristique_')));
});

test('caractéristiques : +1 de la magie innée sur sa caractéristique (ou celle choisie pour le Potentiel Illimité), bornes de la race', () => {
  const feu = caracteristiquesDe(regles, ficheConforme());
  assert.deepEqual(feu.find((c) => c.id === 'social'), { id: 'social', nom: 'Social', lettre: feu.find((c) => c.id === 'social').lettre, base: 2, croix: 0, bonus: 1, valeur: 3, min: 1, max: 4 });
  assert.equal(feu.filter((c) => c.bonus).length, 1);
  const pi = caracteristiquesDe(regles, ficheConforme({ magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'agilite' }));
  assert.equal(pi.find((c) => c.id === 'agilite').valeur, 3);
  assert.equal(caracteristiquesDe(regles, ficheConforme({ magie_innee_id: 'magies/potentiel-illimite' })).filter((c) => c.bonus).length, 0);
  const sansRace = caracteristiquesDe(regles, { ...ficheVide(), caracteristiques: [] });
  assert.ok(sansRace.every((c) => c.base === null && c.min === 1 && c.max === 4));
});

test('compétences : score = 10 × caractéristique + naturel + acquis ; une croix −20, deux croix inutilisable (R19) ; acquis au plus 5 par point de base', () => {
  const fiche = ficheConforme({
    competences: [{ competence_id: 'arme-lourde', naturel: 20, acquis: 5 }],
    caracteristiques: ficheConforme().caracteristiques.map((c) => (c.caracteristique_id === 'social' ? { ...c, croix: 1 } : c.caracteristique_id === 'agilite' ? { ...c, croix: 2 } : c)),
  });
  const parId = new Map(competencesDe(regles, fiche).map((c) => [c.id, c]));
  const force = regles.competences.find((c) => c.id === 'arme-lourde').caracteristique_id;
  assert.equal(force, 'force');
  assert.deepEqual({ score: parId.get('arme-lourde').score, maxAcquis: parId.get('arme-lourde').maxAcquis }, { score: 4 * 10 + 20 + 5, maxAcquis: 20 });
  const social = regles.competences.find((c) => c.caracteristique_id === 'social');
  assert.equal(parId.get(social.id).score, 3 * 10 - 20, 'Social 2 + 1 (Feu) ; une croix');
  const agilite = regles.competences.find((c) => c.caracteristique_id === 'agilite');
  assert.equal(parId.get(agilite.id).score, null);
});

test('attributs des quatre personnages fil rouge : les mêmes que le guide (santé, chakra, barrière, vitesse, AP/AM, emplacements de sorts)', () => {
  const guide = chargerFilRouge(db);
  for (const p of FIL_ROUGE) {
    const g = guide.find((x) => x.id === p.id);
    const fiche = { ...ficheVide(p.id), race_id: p.race, ethnie_id: p.ethnie, magie_innee_id: p.magie, classes: [{ rang: 1, classe_id: p.classe, specialite_id: null }] };
    const a = attributsDe(regles, fiche);
    assert.deepEqual(
      { sante: a.sante, chakra: a.chakra, barriere: a.barriere, vitesseSol: a.vitesseSol, vitesseNage: a.vitesseNage, ap: a.ap, am: a.am },
      { sante: g.attributs.sante, chakra: g.attributs.chakra, barriere: g.attributs.barriere, vitesseSol: g.attributs.vitesseSol, vitesseNage: g.attributs.vitesseNage, ap: g.attributs.ap, am: g.attributs.am },
      p.id,
    );
    assert.equal(emplacementsDeSorts(regles, fiche).total, g.emplacements, p.id);
  }
});

test('attributs : deux classes et deux magies comptent ; gains de niveau et dé ; accessoires « Attributs » signés par leur malédiction ; barrière = chakra ÷ 2', () => {
  const ecu = (cible, maudit = 0) => {
    const effet = regles.accessoires.find((e) => e.propriete === 'attributs' && e.cible === cible && e.valeur);
    return { effet, ligne: { emplacement: 'chef', accessoire_effet_id: effet.id, valeur: null, maudit } };
  };
  const base = { ...ficheVide('a'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', classes: [{ rang: 1, classe_id: 'classes/guerrier' }] };
  const a0 = attributsDe(regles, base);
  const mage = regles.classes.find((c) => c.id === 'classes/mage');
  const glace = regles.magies.find((m) => m.id === 'magies/magie-de-la-glace');
  const deux = attributsDe(regles, { ...base, mode_classe: 'bi', magie_acquise_id: glace.id, classes: [...base.classes, { rang: 2, classe_id: mage.id }] });
  assert.equal(deux.sante, a0.sante + mage.sante + glace.sante);
  assert.equal(deux.chakra, a0.chakra + mage.chakra + glace.chakra);
  assert.equal(deux.am, a0.am + regles.am_classe_magique, 'le Mage est une classe magique');

  const sante = ecu('Santé');
  const chakra = ecu('Chakra', 1);
  const avecTout = attributsDe(regles, {
    ...base, xp: 1650,
    progression: [{ niveau: 2, points_sante: 10, points_chakra: 5 }, { niveau: 5, points_sante: 0, points_chakra: 15, de_choix: 'les_deux', de_resultat: 3 }],
    accessoires: [sante.ligne, { ...chakra.ligne, emplacement: 'collier' }],
  });
  assert.equal(avecTout.sante, a0.sante + 10 + 3 + sante.effet.valeur);
  assert.equal(avecTout.chakra, a0.chakra + 5 + 15 + 3 - chakra.effet.valeur, 'accessoire maudit : en moins');
  assert.equal(avecTout.barriere, Math.floor(avecTout.chakra / 2) + avecTout.detail.barriere.classes + avecTout.detail.barriere.race + avecTout.detail.barriere.ethnie);
  assert.equal(avecTout.corruptionMax, avecTout.chakra);
  assert.deepEqual(attributsDe(regles, { ...base, magie_innee_id: 'magies/magie-du-sang' }).quatriemeBarre, { ressource: 'Sang', max: regles.magies.find((m) => m.id === 'magies/magie-du-sang').barre4.max });
  assert.equal(attributsDe(regles, ficheConforme()).initiative.bonus, 0, 'Agilité 2 : +0');
});

test('classe magique : catégorie et Archimage (R6), spécialité « considérée comme classe magique » au niveau de classe 10 (R7)', () => {
  const orios = regles.classes.find((c) => c.id === 'classes/orios');
  const chaman = orios.specialites.find((s) => s.magique);
  const autre = orios.specialites.find((s) => !s.magique);
  assert.ok(chaman && autre);
  assert.equal(classeMagique(regles, { classe_id: orios.id, specialite_id: chaman.id }, 10), true);
  assert.equal(classeMagique(regles, { classe_id: orios.id, specialite_id: chaman.id }, 9), false);
  assert.equal(classeMagique(regles, { classe_id: orios.id, specialite_id: autre.id }, 20), false);
  assert.equal(classeMagique(regles, { classe_id: 'classes/archimage', specialite_id: null }, 1), true);
  assert.equal(classeMagique(regles, { classe_id: 'classes/guerrier', specialite_id: null }, 20), false);
  const fiche = { ...ficheVide(), race_id: 'races/orios', xp: 11450, magie_innee_id: 'magies/magie-du-sang', classes: [{ rang: 1, classe_id: orios.id, specialite_id: chaman.id }] };
  assert.equal(emplacementsDeSorts(regles, fiche).conditions, 2);
});

test('race : classes et magies innées permises (R8, R11), ethnies de la race et de sa magie', () => {
  assert.ok(!classesPermises(regles, 'races/medusain').has('classes/guerrier'), 'le Médusain n’a pas Guerrier');
  assert.ok(classesPermises(regles, null).has('classes/guerrier'));
  assert.deepEqual([...magiesInneesPermises(regles, 'races/nain')].sort(),
    ['magies/magie-de-la-foudre', 'magies/magie-de-la-terre', 'magies/magie-de-larcane', 'magies/magie-du-feu', 'magies/potentiel-illimite'], 'Nain : liste de son onglet (R11)');
  const orios = ethniesDeLaRace(regles, 'races/orios');
  assert.ok(orios.length > 1 && orios.every((e) => e.race_id === 'races/orios'));
  const deSang = orios.find((e) => e.magie_id === 'magies/magie-du-sang');
  assert.ok(deSang);
  assert.equal(ethnieCompatible(deSang, 'magies/magie-du-sang'), true);
  assert.equal(ethnieCompatible(deSang, 'magies/magie-du-feu'), false);
});

test('décision R23 : l’Archimage seulement avec le Potentiel Illimité inné, qui l’impose en classe 1 ; mêmes refus que la base', () => {
  assert.deepEqual(regles.classes.filter((c) => c.magie_innee_id).map((c) => [c.id, c.magie_innee_id]), [['classes/archimage', 'magies/potentiel-illimite']]);
  const archimage = [{ rang: 1, classe_id: 'classes/archimage', specialite_id: null }];
  const feu = ficheConforme();
  const pi = ficheConforme({ magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'force' });
  assert.equal(classeImposee(regles, feu), null);
  assert.equal(classeImposee(regles, { ...feu, magie_innee_id: null }), null);
  assert.equal(classeImposee(regles, pi).id, 'classes/archimage');

  assert.equal(refusClasse(regles, feu, 'classes/archimage', 1), 'réservée à la magie innée Potentiel Illimité');
  assert.equal(refusClasse(regles, feu, 'classes/archimage', 2), 'réservée à la magie innée Potentiel Illimité', 'ni en seconde classe');
  assert.equal(refusClasse(regles, { ...feu, magie_innee_id: null }, 'classes/archimage', 1), 'réservée à la magie innée Potentiel Illimité');
  assert.equal(refusClasse(regles, feu, 'classes/guerrier', 1), null);
  assert.equal(refusClasse(regles, pi, 'classes/archimage', 1), null);
  assert.equal(refusClasse(regles, pi, 'classes/guerrier', 1), 'la magie innée Potentiel Illimité impose Archimage');
  assert.equal(refusClasse(regles, { ...pi, classes: archimage }, 'classes/guerrier', 2), null, 'la seconde classe reste libre');
  assert.equal(refusClasse(regles, { ...pi, classes: archimage }, 'classes/archimage', 2), 'déjà l’autre classe');
  assert.equal(refusClasse(regles, { ...feu, race_id: 'races/medusain' }, 'classes/guerrier', 1), 'classe que la race ne permet pas');

  // Les mêmes fiches enregistrées : la base dit la même chose (v_personnage_controle)
  const enBase = (fiche) => enregistrerFiche(vivante, fiche).controles.map((c) => `${c.regle} ${c.detail}`);
  assert.deepEqual(enBase(feu), []);
  assert.deepEqual(enBase({ ...feu, classes: archimage }), ['classe_reservee classes/archimage']);
  assert.deepEqual(enBase({ ...feu, mode_classe: 'bi', classes: [...feu.classes, { rang: 2, classe_id: 'classes/archimage', specialite_id: null }] }), ['classe_reservee classes/archimage']);
  assert.deepEqual(enBase(pi), ['classe_imposee classes/archimage']);
  assert.deepEqual(enBase({ ...pi, classes: archimage }), []);
  assert.deepEqual(enBase({ ...pi, mode_classe: 'bi', classes: [...archimage, { rang: 2, classe_id: 'classes/guerrier', specialite_id: null }] }), []);
  assert.deepEqual(enBase({ ...pi, mode_classe: 'bi', classes: [{ ...feu.classes[0] }, { rang: 2, classe_id: 'classes/archimage', specialite_id: null }] }),
    ['classe_imposee classes/archimage'], 'en classe 1, pas en classe 2');
});

test('décision R25 : le Mage Bleu est fermé au Potentiel Illimité, à tous les rangs ; toute autre seconde classe reste permise', () => {
  assert.deepEqual(regles.classes.filter((c) => c.magie_innee_exclue_id).map((c) => [c.id, c.magie_innee_exclue_id]), [['classes/mage-bleu', 'magies/potentiel-illimite']]);
  const pi = ficheConforme({ magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'force', mode_classe: 'bi', classes: [{ rang: 1, classe_id: 'classes/archimage', specialite_id: null }] });
  assert.equal(refusClasse(regles, pi, 'classes/mage-bleu', 2), 'fermée à la magie innée Potentiel Illimité');
  const permises = regles.classes.filter((c) => !['classes/archimage', 'classes/mage-bleu'].includes(c.id) && classesPermises(regles, 'races/humain').has(c.id));
  assert.ok(permises.length > 20 && permises.every((c) => refusClasse(regles, pi, c.id, 2) === null), 'toute autre classe en seconde classe');
  assert.equal(refusClasse(regles, ficheConforme(), 'classes/mage-bleu', 1), null, 'sans Potentiel Illimité, le Mage Bleu reste ouvert');
  // la base dit la même chose ; choisir le Potentiel Illimité retire le Mage Bleu
  const avecMageBleu = { ...pi, classes: [...pi.classes, { rang: 2, classe_id: 'classes/mage-bleu', specialite_id: null }] };
  assert.deepEqual(enregistrerFiche(vivante, avecMageBleu).controles.filter((c) => c.regle.startsWith('classe_')).map((c) => `${c.regle} ${c.detail}`), ['classe_exclue classes/mage-bleu']);
  assert.deepEqual(enregistrerFiche(vivante, { ...pi, classes: [...pi.classes, { rang: 2, classe_id: 'classes/mage', specialite_id: null }] }).controles.filter((c) => c.regle.startsWith('classe_')), []);
  const feu = ficheConforme({ mode_classe: 'bi', classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }, { rang: 2, classe_id: 'classes/mage-bleu', specialite_id: null }] });
  assert.deepEqual(classesSelonLaMagieInnee(regles, { ...feu, magie_innee_id: 'magies/potentiel-illimite' }).map((c) => [c.rang, c.classe_id]), [[1, 'classes/archimage']]);
});

test('décision R23 : choisir le Potentiel Illimité met l’Archimage en classe 1, le quitter la retire ; les dons d’une classe partie s’en vont avec elle', () => {
  const imposee = { rang: 1, classe_id: 'classes/archimage', specialite_id: null };
  const mage = { rang: 1, classe_id: 'classes/mage', specialite_id: null };
  const guerrier2 = { rang: 2, classe_id: 'classes/guerrier', specialite_id: null };
  const fiche = (magie, classes) => ({ ...ficheVide(), magie_innee_id: magie, mode_classe: 'bi', classes });
  const pi = 'magies/potentiel-illimite';
  assert.deepEqual(classesSelonLaMagieInnee(regles, fiche(pi, [])), [imposee]);
  assert.deepEqual(classesSelonLaMagieInnee(regles, fiche(pi, [mage, guerrier2])), [imposee, guerrier2], 'à la place de la classe 1, la seconde reste');
  assert.deepEqual(classesSelonLaMagieInnee(regles, fiche(pi, [mage, { ...imposee, rang: 2 }])), [imposee], 'déjà en seconde classe (fiche importée) : passe en classe 1');
  const enPlace = [{ ...imposee, specialite_id: 'classes/archimage#specialite:x' }, guerrier2];
  assert.deepEqual(classesSelonLaMagieInnee(regles, fiche(pi, enPlace)), enPlace, 'déjà en classe 1 : rien ne change (spécialité gardée)');
  assert.deepEqual(classesSelonLaMagieInnee(regles, fiche('magies/magie-du-feu', enPlace)), [guerrier2], 'une autre magie innée : l’Archimage part');
  assert.deepEqual(classesSelonLaMagieInnee(regles, fiche(null, enPlace)), [guerrier2], 'sans magie innée non plus');
  assert.deepEqual(classesSelonLaMagieInnee(regles, fiche('magies/magie-du-feu', [mage, guerrier2])), [mage, guerrier2], 'les autres classes ne bougent pas');

  // Dons : ceux d'une classe de la fiche et de sa spécialité choisie (règle capacite_hors_classe de la base)
  const groupe = regles.classes.find((c) => c.id === 'classes/mage').choix.find((g) => g.specialite_id);
  const don = { capacite_id: groupe.options[0].id };
  const avecDon = ficheConforme({ xp: 11450, classes: [{ ...mage, specialite_id: groupe.specialite_id }], capacites: [don] });
  assert.deepEqual(donsValables(regles, avecDon), [don]);
  assert.deepEqual(donsValables(regles, { ...avecDon, capacites: [don, { capacite_id: 'capacites/hors-des-choix' }] }), [don, { capacite_id: 'capacites/hors-des-choix' }],
    'un don que les règles ne rangent dans aucun choix reste');
  const sansSpecialite = { ...avecDon, classes: [mage] };
  const remplace = { ...avecDon, magie_innee_id: pi, caracteristique_magie_id: 'force' };
  remplace.classes = classesSelonLaMagieInnee(regles, remplace);
  for (const f of [sansSpecialite, remplace]) {
    assert.deepEqual(donsValables(regles, f), []);
    assert.ok(enregistrerFiche(vivante, f).controles.some((c) => c.regle === 'capacite_hors_classe' && c.detail === don.capacite_id), 'la base refuse le don gardé');
    assert.ok(!enregistrerFiche(vivante, { ...f, capacites: donsValables(regles, f) }).controles.some((c) => c.regle === 'capacite_hors_classe'));
  }
});

test('maîtrise d’arme : 1 dé sans maîtrise, un de plus par point, 4 points au plus (5 dés) ; la base garde les dés et refuse un 5ᵉ point', () => {
  const m = maitriseDArme(regles);
  assert.deepEqual({ desSansMaitrise: m.desSansMaitrise, desMax: m.desMax, pointsMax: m.pointsMax }, { desSansMaitrise: 1, desMax: 5, pointsMax: 4 });
  assert.deepEqual([0, 1, 2, 3, 4].map(m.desDe), [1, 2, 3, 4, 5]);
  assert.deepEqual([1, 2, 5].map(m.pointsDe), [0, 1, 4]);
  const avec = (points) => ficheConforme({ maitrises_armes: [{ arme_famille_id: 'epees', des: m.desDe(points) }] });
  const { personnage, controles } = enregistrerFiche(vivante, avec(m.pointsMax));
  assert.deepEqual(controles, []);
  assert.deepEqual(personnage.maitrises_armes, [{ arme_famille_id: 'epees', des: 5 }], '4 points : 5 dés');
  assert.throws(() => enregistrerFiche(vivante, avec(m.pointsMax + 1)), (e) => e.statut === 400 && /maitrises_armes\[0\] : valeur hors des bornes/.test(e.details.problemes.join()));
});

test('magie acquise : même magie, incompatibles, mono-magie (R15) sauf Corruption de l’Elfe Noir Charbon et du Felfe Noir (R20)', () => {
  const fiche = (innee, ethnie = null) => ({ ...ficheVide(), magie_innee_id: innee, ethnie_id: ethnie });
  assert.equal(refusMagieAcquise(regles, fiche('magies/magie-du-feu'), 'magies/magie-de-leau'), null);
  assert.match(refusMagieAcquise(regles, fiche('magies/magie-du-feu'), 'magies/magie-du-feu'), /déjà la magie innée/);
  assert.match(refusMagieAcquise(regles, fiche('magies/magie-du-sang'), 'magies/magie-de-larcane'), /incompatible/);
  assert.match(refusMagieAcquise(regles, fiche('magies/potentiel-illimite'), 'magies/magie-du-feu'), /incompatible|mono-magie/);
  assert.match(refusMagieAcquise(regles, fiche('magies/magie-du-feu'), 'magies/magie-de-la-corruption'), /mono-magie/);
  assert.equal(refusMagieAcquise(regles, fiche('magies/magie-du-feu', 'races/elfe-noir#ethnie:elfe-noir-charbon'), 'magies/magie-de-la-corruption'), null);
  assert.equal(refusMagieAcquise(regles, fiche('magies/magie-du-feu', 'races/felfe#ethnie:felfe-noir'), 'magies/magie-de-la-corruption'), null);
  assert.match(refusMagieAcquise(regles, fiche('magies/magie-du-feu', 'races/elfe-noir#ethnie:elfe-noir-sale'), 'magies/magie-de-la-corruption'), /mono-magie/);
  assert.match(refusMagieAcquise(regles, fiche('magies/magie-de-larcane', 'races/elfe-noir#ethnie:elfe-noir-charbon'), 'magies/magie-de-la-corruption'), /incompatible/, 'les incompatibilités restent');
});

test('décision R28 : la Lamia n’a qu’une magie ; toute magie acquise est refusée, et la base dit la même chose', () => {
  assert.deepEqual(regles.races.filter((r) => r.mono_magie).map((r) => r.id), ['races/lamia']);
  const lamia = ficheConforme({ race_id: 'races/lamia', ethnie_id: 'races/lamia#ethnie:lamia' });
  const refus = regles.magies.filter((m) => m.id !== lamia.magie_innee_id).map((m) => refusMagieAcquise(regles, lamia, m.id));
  assert.ok(refus.length === 14 && refus.every((r) => r === 'Lamia : une seule magie'), refus.join());
  assert.equal(refusMagieAcquise(regles, ficheConforme(), 'magies/magie-de-leau'), null, 'un Humain garde sa magie acquise');
  const avecEau = { ...lamia, magie_acquise_id: 'magies/magie-de-leau' };
  assert.deepEqual(enregistrerFiche(vivante, avecEau).controles.filter((c) => c.regle === 'race_mono_magie').map((c) => c.detail), ['magies/magie-de-leau']);
  assert.deepEqual(enregistrerFiche(vivante, lamia).controles.filter((c) => c.regle === 'race_mono_magie'), []);
});

test('magie acquise devenue impossible (demande du propriétaire) : elle part quand l’innée ou la race change, sinon elle reste', () => {
  const fiche = (surcharge) => ({ ...ficheVide(), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', magie_acquise_id: 'magies/magie-de-larcane', ...surcharge });
  assert.equal(magieAcquiseValable(regles, fiche()), 'magies/magie-de-larcane');
  assert.equal(magieAcquiseValable(regles, fiche({ magie_innee_id: 'magies/magie-du-sang' })), null, 'Sang et Arcane incompatibles');
  assert.equal(magieAcquiseValable(regles, fiche({ magie_innee_id: 'magies/magie-de-larcane' })), null, 'devenue l’innée');
  assert.equal(magieAcquiseValable(regles, fiche({ magie_innee_id: 'magies/magie-de-la-corruption' })), null, 'innée mono-magie (R15)');
  assert.equal(magieAcquiseValable(regles, fiche({ race_id: 'races/lamia', ethnie_id: 'races/lamia#ethnie:lamia' })), null, 'Lamia (R28)');
  assert.equal(magieAcquiseValable(regles, fiche({ magie_acquise_id: null })), null);
});

test('ethnie sans choix (demande du propriétaire) : la seule de la race, ou la seule de la magie innée ; la base l’accepte', () => {
  const fiche = (race_id, magie_innee_id = null) => ({ ...ficheVide(), race_id, magie_innee_id });
  assert.equal(ethnieImposee(regles, fiche('races/lamia')), 'races/lamia#ethnie:lamia', 'race à une seule ethnie, même sans magie');
  assert.equal(ethnieImposee(regles, fiche('races/humain', 'magies/magie-du-feu')), null, 'quatre ethnies au choix');
  assert.equal(ethnieImposee(regles, fiche('races/goleois')), null, 'race hybride : rien avant la magie innée');
  assert.equal(ethnieImposee(regles, fiche('races/goleois', 'magies/magie-de-la-glace')), 'races/goleois#ethnie:goleois-de-glace');
  assert.equal(ethnieImposee(regles, fiche('races/drakos', 'magies/magie-du-feu')), 'races/drakos#ethnie:drakos-rouge');
  assert.equal(ethnieImposee(regles, fiche(null)), null);
  const seules = regles.races.filter((r) => ethniesDeLaRace(regles, r.id).length === 1).map((r) => r.id).sort();
  assert.deepEqual(seules, ['races/elfe-dore', 'races/hujin', 'races/lamia', 'races/majin']);
  // toute race, toute magie innée permise : l'ethnie posée est de la race, va avec la magie, et la base n'y trouve rien à redire
  for (const r of regles.races) {
    for (const m of magiesInneesPermises(regles, r.id)) {
      const e = ethnieImposee(regles, fiche(r.id, m));
      if (!e) continue;
      const ethnie = regles.ethnies.find((x) => x.id === e);
      assert.ok(ethnie.race_id === r.id && ethnieCompatible(ethnie, m), `${r.id} ${m}`);
    }
  }
  const goleois = ficheConforme({ race_id: 'races/goleois', magie_innee_id: 'magies/magie-de-la-glace', ethnie_id: 'races/goleois#ethnie:goleois-de-glace' });
  assert.deepEqual(enregistrerFiche(vivante, goleois).controles.filter((c) => c.regle.startsWith('ethnie_')), []);
});

test('sorts : puissance magique 5 au niveau 16 (R16), palier 5 fermé avec une magie acquise mais ses emplacements ouverts ; NM au plus niveau − 1', () => {
  assert.deepEqual([1, 3, 4, 8, 12, 15, 16, 20].map((n) => puissanceMagique(regles, n)), [1, 1, 2, 3, 4, 4, 5, 5]);
  const seize = { ...ficheVide(), xp: 95450, magie_innee_id: 'magies/magie-du-feu' };
  assert.equal(npmMax(regles, seize), 5);
  const bi = { ...seize, magie_acquise_id: 'magies/magie-de-leau' };
  assert.equal(npmMax(regles, bi), 4);
  assert.deepEqual(emplacementsDeSorts(regles, bi), { conditions: 2, puissance: 5, total: 10 });
  assert.ok(sortsPossibles(regles, bi).every((s) => s.niveau <= 4 && ['magies/magie-du-feu', 'magies/magie-de-leau'].includes(s.magie_id)));
  const pi = { ...ficheVide(), magie_innee_id: 'magies/potentiel-illimite' };
  assert.ok(new Set(sortsPossibles(regles, pi).map((s) => s.magie_id)).size > 2, 'le Potentiel Illimité pioche dans toutes les magies');
  assert.ok(sortsPossibles(regles, pi).every((s) => s.niveau === 1));
  const nm = maitriseDesSorts(regles, { ...seize, sorts: [{ sort_id: 'x', rang: 1, niveau_maitrise: 3 }, { sort_id: 'y', rang: 2, niveau_maitrise: 2 }] });
  assert.deepEqual(nm, { plafond: 3, maxParSort: 15, total: 5, deNiveau: 5, offerts: 0, disponibles: regles.niveaux.find((n) => n.niveau === 16).niveaux_maitrise_cumul });
});

test('tableau des sorts : une ligne par emplacement, sans emplacement en plus (R27) ; sorts possibles moins ceux des autres lignes ; un sort hors des règles reste visible', () => {
  const feu = { ...ficheVide(), magie_innee_id: 'magies/magie-du-feu', xp: 550 };
  const vides = lignesDeSorts(regles, feu);
  assert.equal(vides.length, emplacementsDeSorts(regles, feu).total);
  assert.ok(vides.length > 0 && vides.every((l) => l.ligne === null && l.choix.length > 0 && l.choix.every((x) => x.magie_id === 'magies/magie-du-feu')));
  const [a, b] = vides[0].choix;
  const deux = { ...feu, sorts: [{ sort_id: a.id, rang: 1, niveau_maitrise: 0 }, { sort_id: b.id, rang: 2, niveau_maitrise: 0 }] };
  const lignes = lignesDeSorts(regles, deux);
  assert.ok(lignes.length >= 2);
  for (const l of lignes) {
    const autres = deux.sorts.filter((_, j) => j !== l.index).map((x) => x.sort_id);
    assert.ok(!l.choix.some((x) => autres.includes(x.id)), `ligne ${l.index} : sans les sorts des autres lignes`);
    if (l.ligne) assert.ok(l.choix.some((x) => x.id === l.ligne.sort_id) && !l.horsDesRegles, `ligne ${l.index} : garde son sort`);
  }
  assert.ok(vides.every((l) => !l.enTrop), 'pas d’emplacement en plus (R27) : une ligne par emplacement');
  const enPlus = { ...feu, sorts: Array.from({ length: vides.length + 1 }, (_, i) => ({ sort_id: vides[0].choix[i].id, rang: i + 1, niveau_maitrise: 0 })) };
  const lignesEnPlus = lignesDeSorts(regles, enPlus);
  assert.equal(lignesEnPlus.length, vides.length + 1, 'un sort au-delà des emplacements (XP baissée) reste visible…');
  assert.deepEqual(lignesEnPlus.map((l) => l.enTrop), [...vides.map(() => false), true], '… sur une ligne à retirer');
  const eau = { ...deux, magie_innee_id: 'magies/magie-de-leau' };
  const hors = lignesDeSorts(regles, eau)[0];
  assert.deepEqual([hors.horsDesRegles, hors.sort.id], [true, a.id], 'magie changée : le sort reste, signalé');
  assert.equal(lignesDeSorts(regles, ficheVide()).length, 0, 'sans magie, pas d’emplacement');
});

test('décision R26 : 3 NM au plus sur un sort ; NM de niveau au plus niveau − 1 et au plus ceux gagnés ; un NM de livre par sort et ceux du MJ en plus ; même chose que la base', () => {
  // niveau 3 : 2 NM gagnés, 2 au plus de niveau sur un sort
  const sort = (sort_id, rang, niveau, livre = 0, cadeau = 0) => ({ sort_id, rang, niveau_maitrise: niveau + livre + cadeau, nm_livre: livre, nm_cadeau: cadeau });
  const fiche = (sorts) => ficheConforme({ xp: 550, sorts });
  const enBase = (f) => enregistrerFiche(vivante, f).controles.filter((c) => c.regle.startsWith('sort')).map((c) => `${c.regle} ${c.detail}`);
  const bdf = 'magies/magie-du-feu#sort:boule-de-feu';
  const cau = 'magies/magie-du-feu#sort:cauterisation';
  const juste = fiche([sort(bdf, 1, 2, 1), sort(cau, 2, 0, 0, 1)]);
  assert.deepEqual(maitriseDesSorts(regles, juste), { plafond: 3, maxParSort: 2, total: 4, deNiveau: 2, offerts: 2, disponibles: 2 });
  assert.deepEqual(nmDuSort(juste.sorts[0]), { total: 3, livre: 1, cadeau: 0, deNiveau: 2 });
  assert.deepEqual(enBase(juste), [], '2 NM de niveau gagnés, un de livre et un du MJ en plus');
  assert.deepEqual(enBase(fiche([sort(bdf, 1, 2, 1, 1)])), [`sort_nm_plafond ${bdf} = 4`], 'jamais plus de 3, même offerts');
  assert.deepEqual(enBase(fiche([sort(bdf, 1, 3)])), [`sort_nm_max ${bdf} = 3`, `sorts_nm_total 3 / 2`], 'de niveau : au plus niveau − 1 et au plus ceux gagnés');
  assert.deepEqual(enBase(fiche([sort(bdf, 1, 2), sort(cau, 2, 1)])), ['sorts_nm_total 3 / 2'], 'un NM en plus doit venir d’un livre ou du MJ');
  assert.throws(() => enregistrerFiche(vivante, fiche([{ ...sort(bdf, 1, 0, 1), nm_livre: 2, niveau_maitrise: 2 }])), (e) => e.statut === 400, 'un seul NM de livre par sort');
  assert.throws(() => enregistrerFiche(vivante, fiche([{ sort_id: bdf, rang: 1, niveau_maitrise: 0, nm_livre: 0, nm_cadeau: 1 }])), (e) => e.statut === 400, 'les NM offerts font partie du NM du sort');
  assert.equal(regles.constantes['sort.nm_max'], 3);
});

test('progression attendue : 15 points par niveau à partir du 2, le dé aux niveaux 5, 10, 15 et 20', () => {
  const p = progressionAttendue(regles, 20);
  assert.equal(p.length, 19);
  assert.ok(p.every((x) => x.points === 15));
  assert.deepEqual(p.filter((x) => x.de).map((x) => x.niveau), [5, 10, 15, 20]);
  assert.deepEqual(progressionAttendue(regles, 1), []);
});

test('dons à choisir : groupes de la classe et de la spécialité choisie, jusqu’au niveau de classe', () => {
  const epeiste = 'classes/guerrier#specialite:epeiste';
  const fiche = (xp, specialite_id = null) => ({ ...ficheVide(), xp, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id }] });
  assert.deepEqual(donsAChoisir(regles, fiche(0))[0].groupes, [], 'Guerrier niveau de classe 2 : aucun choix');
  const dix = donsAChoisir(regles, fiche(8250, epeiste))[0];
  assert.equal(dix.classe.id, 'classes/guerrier');
  assert.ok(dix.groupes.length >= 1 && dix.groupes.every((g) => g.specialite_id === epeiste && g.niveau <= 18));
  const archimage = donsAChoisir(regles, { ...ficheVide(), xp: 11450, classes: [{ rang: 1, classe_id: 'classes/archimage' }] })[0];
  assert.ok(archimage.groupes.length >= 2 && archimage.groupes.every((g) => g.specialite_id === null));
});

test('saisie d’un curseur au clic droit (demande du propriétaire) : ramenée au maximum au-dessus, au minimum en dessous, arrondie', () => {
  assert.equal(borner('7', 0, 4), 4);
  assert.equal(borner('-3', 1, 4), 1);
  assert.equal(borner('2.6', 0, 4), 3);
  assert.equal(borner('2,4', 0, 4), 2, 'virgule décimale');
  assert.equal(borner(' 3 ', 0, 4), 3);
  assert.equal(borner('', 0, 4), null, 'rien de tapé : rien ne change');
  assert.equal(borner('abc', 0, 4), null);
});

test('valeurs du moment : de 0 au maximum, absentes au maximum (corruption à 0) ; la corruption prend la place du chakra, sauf magie de la Corruption', () => {
  // les phrases du guide que valeursDuMoment applique
  const corps = (id) => db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
  assert.match(corps('guide/fiche-attributs'), /25 de chakra maximum, si jamais vous avez 2 points de corruption, vous ne pourrez pas monter au-delà de 23\/25/);
  assert.match(corps('guide/fiche-attributs'), /Ceux qui utilisent la magie de la corruption ne sont pas concernés par cette règle/);
  assert.match(corps('magies/magie-de-la-corruption'), /la corruption n'empiète pas dans l'espace du chakra/);
  assert.match(corps('guide/finaliser-son-personnage'), /\*\*Corruption\*\* : son maximum est celui du chakra/);
  // l'exemple du propriétaire : 50 de chakra, 15 de corruption, 35 au plus
  const attributs = { sante: 40, chakra: 50, barriere: 25, corruptionMax: 50, quatriemeBarre: null };
  const par = (fiche) => Object.fromEntries(valeursDuMoment(regles, { ...ficheVide(), ...fiche }, attributs).map((j) => [j.champ, j]));
  const vide = par({});
  assert.deepEqual(Object.keys(vide), ['sante_actuelle', 'chakra_actuel', 'barriere_actuelle', 'corruption']);
  assert.deepEqual(Object.values(vide).map((j) => [j.min, j.max, j.valeur]), [[0, 40, 40], [0, 50, 50], [0, 25, 25], [0, 50, 0]]);
  const corrompu = par({ corruption: 15 });
  assert.deepEqual([corrompu.chakra_actuel.max, corrompu.chakra_actuel.valeur, corrompu.chakra_actuel.reduction], [35, 35, 15]);
  assert.equal(par({ corruption: 15, chakra_actuel: 20 }).chakra_actuel.valeur, 20);
  assert.equal(par({ corruption: 15, chakra_actuel: 40 }).chakra_actuel.hors, true, '40 enregistré, 35 au plus');
  assert.equal(par({ corruption: 15, magie_innee_id: 'magies/magie-de-la-corruption' }).chakra_actuel.max, 50, 'magie de la Corruption innée');
  assert.equal(par({ corruption: 15, magie_acquise_id: 'magies/magie-de-la-corruption' }).chakra_actuel.max, 50, 'ou acquise');
  assert.equal(par({ corruption: 80 }).chakra_actuel.max, 0, 'jamais en dessous de 0');
  // la corruption qui monte prend la place du chakra actuel ; celle qui baisse ne le rend pas ; les autres curseurs n'écrivent qu'eux, bornés
  const fiche = { ...ficheConforme(), sante_actuelle: 3 };
  const a = attributsDe(regles, fiche);
  assert.ok(a.chakra > 5);
  const monte = ecrireValeurDuMoment(regles, fiche, 'corruption', a.chakra - 5);
  assert.deepEqual(monte, { corruption: a.chakra - 5, chakra_actuel: 5 }, 'chakra plein (vide = au maximum), 5 de place');
  assert.deepEqual(ecrireValeurDuMoment(regles, { ...fiche, ...monte }, 'corruption', 0), { corruption: 0, chakra_actuel: 5 }, 'la corruption retirée ne rend pas de chakra');
  assert.deepEqual(ecrireValeurDuMoment(regles, { ...fiche, chakra_actuel: 2 }, 'corruption', 1), { corruption: 1, chakra_actuel: 2 });
  assert.deepEqual(ecrireValeurDuMoment(regles, fiche, 'corruption', a.chakra + 50), { corruption: a.chakra, chakra_actuel: 0 }, 'au plus le chakra');
  assert.deepEqual(ecrireValeurDuMoment(regles, fiche, 'sante_actuelle', 999), { sante_actuelle: a.sante });
  assert.deepEqual(ecrireValeurDuMoment(regles, fiche, 'barre4_actuelle', 3), {}, 'pas de 4ᵉ barre sans Sang ni Nécromancie');
  // la 4ᵉ barre de la magie qui en a une (Sang : 10 au plus)
  const sang = valeursDuMoment(regles, ficheConforme({ magie_innee_id: 'magies/magie-du-sang' })).find((j) => j.champ === 'barre4_actuelle');
  assert.deepEqual([sang.nom, sang.max, sang.valeur], ['Sang actuel', 10, 10]);
});

test('maîtrises d’armes : les dés dans leur colonne (demande du propriétaire), pour chaque écriture du dé des familles', () => {
  assert.deepEqual(regles.familles_armes.map((f) => notationDesDes(f.de, 3)),
    ['3D10', '3D6', '3D10', '3D10', '3D10', '3D6/3D8/3D10', '3D8', '3D6', '3D8', '3D12', '3D6', '3 dés']);
  assert.equal(notationDesDes('D10', 1), '1D10');
  assert.equal(notationDesDes(null, 1), '1 dé');
});

test('liste d’un emplacement de sort (demande du propriétaire) : un groupe par NPM, croissant ; dans un NPM, l’ordre des magies puis du classeur', () => {
  const groupes = sortsParNpm(regles, regles.sorts);
  const npms = groupes.map((g) => g.npm);
  assert.deepEqual(npms, [...new Set(regles.sorts.map((s) => s.niveau))].sort((a, b) => a - b));
  assert.equal(groupes.flatMap((g) => g.sorts).length, regles.sorts.length, 'chaque sort une fois');
  const rang = (s) => regles.magies.findIndex((m) => m.id === s.magie_id);
  for (const g of groupes) {
    assert.ok(g.sorts.every((s) => s.niveau === g.npm), `NPM ${g.npm}`);
    for (let i = 1; i < g.sorts.length; i += 1) {
      const [a, b] = [g.sorts[i - 1], g.sorts[i]];
      assert.ok(rang(a) < rang(b) || (rang(a) === rang(b) && regles.sorts.indexOf(a) < regles.sorts.indexOf(b)), `${a.id} avant ${b.id}`);
    }
  }
  // au niveau 1, le Feu seul : son NPM 1, chaque sort sur la couleur du Feu
  const feu = sortsParNpm(regles, sortsPossibles(regles, ficheConforme()));
  assert.deepEqual(feu.map((g) => g.npm), [1]);
  assert.ok(feu[0].sorts.length > 0 && feu[0].sorts.every((s) => s.magie_id === 'magies/magie-du-feu'));
  assert.ok(regles.magies.every((m) => /^#[0-9a-f]{6}$/i.test(m.couleur) && m.texte), 'chaque magie a sa couleur et son texte');
});
