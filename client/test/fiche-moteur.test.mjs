// Moteur de la fiche (lib/fiche-moteur.mjs) sur les vraies règles (lib/fiche-regles.mjs, la base construite) : chaque calcul comparé à sa source —
// les vues de la base (v_personnage_niveau, v_personnage_controle, par le service sur une base vivante temporaire), les personnages fil rouge du
// guide (lib/guide-fil-rouge.mjs) et les décisions du propriétaire (R2, R3, R6, R7, R15, R16, R19, R20, R23, R24, R25, R26, R27, R28, R32, R33, R34, R35, R37, R38, R39, R41, R45) ; les résistances, contre les tables de la base (magie_resistance, resistance_palier).
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
  ajusterValeurDuMoment, alignementDe, artisanatDe, attributsDe, bonusDuMetier, borner, choisirObjetDeMetier, choixDeMetierValables, inventaireSelonLeMetier,
  objetChoisi, objetDInventaire, objetsDuMetier, deDeLaFamille, donsAcquis, donsDeRace, famillesMaitrisables, maitrisesValables, quotaDeMaitrise, budgetCaracteristiques, budgetCompetences, caracteristiquesCompletes, caracteristiquesDe, classeImposee, lignesDeSorts, magieAcquiseValable, nmDuSort,
  progressionXp, classeMagique, classesPermises, classesSelonLaMagieInnee,
  competencesDe, donsAChoisir, donsValables, emplacementsDeSorts, ethnieCompatible, ethnieImposee, ethniesDeLaRace, magiesInneesPermises, maitriseDesSorts, niveauGlobal,
  gainsAttendus, gainsDeNiveau, maitriseDArme, niveauxDeClasse, notationDesDes, npmMax, puissanceMagique, refusClasse, refusMagieAcquise, resistancesDe, sortsParNpm, sortsPossibles, ecrireValeurDuMoment, valeursDuMoment, xpDuNiveauSuivant,
} from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { FIL_ROUGE, chargerFilRouge } from '../src/lib/guide-fil-rouge.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';

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
    competences: ['arc', 'arme-lourde', 'athletisme', 'parade', 'stabilite'].map((competence_id) => ({ competence_id, naturel: 20 })),
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
  const fiche = ficheConforme();
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
  assert.deepEqual(feu.find((c) => c.id === 'social'), { id: 'social', nom: 'Social', lettre: feu.find((c) => c.id === 'social').lettre, base: 2, croix: 0, bonus: 1, accessoire: 0, accessoireBrut: 0, valeur: 3, min: 1, max: 4 });
  assert.equal(feu.filter((c) => c.bonus).length, 1);
  const pi = caracteristiquesDe(regles, ficheConforme({ magie_innee_id: 'magies/potentiel-illimite', caracteristique_magie_id: 'agilite' }));
  assert.equal(pi.find((c) => c.id === 'agilite').valeur, 3);
  assert.equal(caracteristiquesDe(regles, ficheConforme({ magie_innee_id: 'magies/potentiel-illimite' })).filter((c) => c.bonus).length, 0);
  const sansRace = caracteristiquesDe(regles, { ...ficheVide(), caracteristiques: [] });
  assert.ok(sansRace.every((c) => c.base === null && c.min === 1 && c.max === 4));
});

test('compétences : score = 10 × caractéristique + naturel + acquis (calculé, décision R104) ; une croix −20, deux croix inutilisable (R19) ; acquis au plus 5 par point, magie comprise (R41)', () => {
  const fiche = ficheConforme({
    entrainements: [{ rang: 1, competence_id: 'arme-lourde', valeur: 5, texte: null }],
    caracteristiques: ficheConforme().caracteristiques.map((c) => (c.caracteristique_id === 'social' ? { ...c, croix: 1 } : c.caracteristique_id === 'agilite' ? { ...c, croix: 2 } : c)),
  });
  const parId = new Map(competencesDe(regles, fiche).map((c) => [c.id, c]));
  const force = regles.competences.find((c) => c.id === 'arme-lourde').caracteristique_id;
  assert.equal(force, 'force');
  const lourde = parId.get('arme-lourde');
  // (les dons du Guerrier qui donnent de l'acquis en Arme lourde, lus dans leur texte, comptent aussi : acquisDesDons)
  assert.deepEqual({ score: lourde.score, acquis: lourde.acquis, entrainement: lourde.entrainement, plafondAcquis: lourde.plafondAcquis },
    { score: 4 * 10 + 20 + 5 + lourde.dons, acquis: 5 + lourde.dons, entrainement: 5, plafondAcquis: 20 });
  assert.equal(lourde.dons, lourde.donsDetail.reduce((t, d) => t + d.valeur, 0));
  const social = regles.competences.find((c) => c.caracteristique_id === 'social');
  assert.equal(parId.get(social.id).score, 3 * 10 - 20 + parId.get(social.id).acquis, 'Social 2 + 1 (Feu) ; une croix');
  const agilite = regles.competences.find((c) => c.caracteristique_id === 'agilite');
  assert.equal(parId.get(agilite.id).score, null);
  // décision R41 : la caractéristique totale, le +1 de la magie innée compris (Social 2 + 1 du Feu : 15) ; l'exemple du propriétaire, 5 en Volonté : 25
  assert.equal(parId.get(social.id).plafondAcquis, 15);
  const volonte = regles.magies.find((m) => m.caracteristique_id === 'volonte');
  assert.ok(volonte, 'une magie donne +1 en Volonté');
  const cinq = ficheConforme({
    magie_innee_id: volonte.id,
    caracteristiques: ficheConforme().caracteristiques.map((c) => (c.caracteristique_id === 'volonte' ? { ...c, base: 4 } : c.caracteristique_id === 'force' ? { ...c, base: 2 } : c)),
  });
  assert.equal(competencesDe(regles, cinq).find((c) => c.id === 'calme').plafondAcquis, 25);
  // l'acquis n'est plus saisi : un « acquis » reçu n'est pas lu, et la base n'a plus de règle à son sujet (le plafond est appliqué, jamais une erreur)
  const ancien = competencesDe(regles, { ...cinq, competences: [...cinq.competences, { competence_id: 'calme', naturel: 0, acquis: 26 }] }).find((c) => c.id === 'calme');
  assert.equal(ancien.acquis, competencesDe(regles, cinq).find((c) => c.id === 'calme').acquis);
  const { controles } = enregistrerFiche(vivante, { ...cinq, entrainements: [{ rang: 1, competence_id: 'calme', valeur: 10, texte: null }] });
  assert.deepEqual(controles, []);
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

test('attributs : deux classes et deux magies comptent ; gains de niveau (deux totaux, R73) ; accessoires « Attributs » signés par leur malédiction ; barrière = chakra ÷ 2', () => {
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
    gains_sante: 13, gains_chakra: 23,
    accessoires: [sante.ligne, { ...chakra.ligne, emplacement: 'collier' }],
  });
  assert.equal(avecTout.sante, a0.sante + 13 + sante.effet.valeur);
  assert.equal(avecTout.chakra, a0.chakra + 23 - chakra.effet.valeur, 'accessoire maudit : en moins');
  assert.deepEqual([avecTout.detail.sante.niveaux, avecTout.detail.chakra.niveaux], [13, 23]);
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
  assert.deepEqual(donsValables(regles, { ...avecDon, capacites: [don, { capacite_id: 'capacites/hors-des-choix' }] }), [don],
    'un don que les règles ne rangent dans aucun choix (supprimé depuis le site de dev, ou devenu reçu d’office : D11) est écarté');
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

test('décision R45 : pas de ligne de maîtrise pour ARME DE MONSTRES (des armes exclusives aux monstres) ; une maîtrise déjà posée n’est ni comptée ni enregistrée', () => {
  const ids = (familles) => familles.map((f) => f.id);
  assert.deepEqual(ids(famillesMaitrisables(regles)), ids(regles.familles_armes.filter((f) => f.id !== 'arme-de-monstres')), 'toutes les autres, dans leur ordre');
  assert.ok(regles.familles_armes.some((f) => f.id === 'arme-de-monstres'), 'la famille reste dans les règles : elle nomme ses armes dans l’équipement');
  const fiche = ficheConforme({ maitrises_armes: [{ arme_famille_id: 'epees', des: 3 }, { arme_famille_id: 'arme-de-monstres', des: 5 }] });
  assert.deepEqual(maitrisesValables(regles, fiche), [{ arme_famille_id: 'epees', des: 3 }]);
  assert.equal(quotaDeMaitrise(regles, fiche).utilises, 2, 'les 4 points sur ARME DE MONSTRES ne comptent pas');
  // la vue de la base, par le service : la règle maitrise_arme_exclue
  assert.deepEqual(enregistrerFiche(vivante, fiche).controles, [{ regle: 'maitrise_arme_exclue', detail: 'arme-de-monstres' }]);
  assert.deepEqual(enregistrerFiche(vivante, { ...fiche, maitrises_armes: maitrisesValables(regles, fiche) }).controles, []);
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

test('gains attendus (décision R73) : les points d’attributs cumulés, plus de 1 à 8 par dé bonus atteint ; tout lu dans les règles (v_niveau, niveau_global)', () => {
  for (const n of regles.niveaux) {
    const g = gainsAttendus(regles, n.niveau);
    assert.equal(g.points, n.points_attributs_cumul, `niveau ${n.niveau}`);
    assert.deepEqual([g.min, g.max], [n.points_attributs_cumul + n.de_attributs_min_cumul, n.points_attributs_cumul + n.de_attributs_max_cumul]);
    const des = regles.niveaux.filter((x) => x.niveau <= n.niveau && x.de_attributs_bonus);
    assert.deepEqual(g.des, des.map((x) => ({ niveau: x.niveau, texte: x.de_attributs_bonus, min: x.de_attributs_min, max: x.de_attributs_max })), 'un dé typé là où le guide en écrit un');
    assert.equal(g.des.reduce((s, d) => s + d.min, 0), n.de_attributs_min_cumul);
    assert.equal(g.des.reduce((s, d) => s + d.max, 0), n.de_attributs_max_cumul);
  }
  const g20 = gainsAttendus(regles, 20);
  assert.deepEqual([g20.parNiveau, g20.depuis], [15, 2], '15 points par niveau à partir du 2');
  assert.deepEqual(g20.des.map((d) => [d.niveau, d.min, d.max]), [[5, 1, 8], [10, 1, 8], [15, 1, 8], [20, 1, 8]]);
  const plage = (niveau) => [gainsAttendus(regles, niveau).min, gainsAttendus(regles, niveau).max];
  assert.deepEqual([1, 2, 4, 5, 11, 20].map(plage), [[0, 0], [15, 15], [45, 45], [61, 68], [152, 166], [289, 317]]);
  assert.deepEqual(gainsAttendus(regles, 1).des, [], 'niveau 1 : rien à saisir');

  const xp11 = regles.niveaux.find((n) => n.niveau === 11).xp_min;
  assert.deepEqual(
    (({ sante, chakra, total, niveau, min, max, hors }) => ({ sante, chakra, total, niveau, min, max, hors }))(gainsDeNiveau(regles, { xp: xp11, gains_sante: 41, gains_chakra: 121 })),
    { sante: 41, chakra: 121, total: 162, niveau: 11, min: 152, max: 166, hors: false },
  );
  assert.equal(gainsDeNiveau(regles, { xp: xp11, gains_sante: 41, gains_chakra: 126 }).hors, true, 'au-delà de la plage');
  assert.deepEqual([gainsDeNiveau(regles, ficheVide('x')).total, gainsDeNiveau(regles, ficheVide('x')).hors], [0, false], 'une fiche neuve, niveau 1 : 0 sur 0');
  assert.deepEqual([gainsDeNiveau(regles, { xp: 0, gains_sante: 'abc' }).total, gainsDeNiveau(regles, { xp: 0, gains_sante: 1 }).hors], [0, true], 'illisible : 0 ; au niveau 1, rien');
});

test('gains de niveau : le moteur et la règle gains_niveau de la base (v_personnage_controle) disent la même chose, niveaux 1 à 20, aux bornes de la plage', () => {
  let comparees = 0;
  for (const n of regles.niveaux) {
    const g = gainsAttendus(regles, n.niveau);
    for (const total of [g.min - 1, g.min, g.min + 1, g.max - 1, g.max, g.max + 1].filter((t) => t >= 0)) {
      const fiche = { ...ficheVide(`Gains ${n.niveau} ${total}`), xp: n.xp_min, gains_sante: Math.ceil(total / 2), gains_chakra: Math.floor(total / 2) };
      const moteur = gainsDeNiveau(regles, fiche);
      assert.equal(moteur.niveau, n.niveau);
      const base = enregistrerFiche(vivante, fiche).controles.filter((c) => c.regle === 'gains_niveau');
      assert.equal(base.length > 0, moteur.hors, `niveau ${n.niveau}, total ${total}`);
      if (moteur.hors) assert.equal(base[0].detail, `${total} / ${moteur.min}${moteur.max > moteur.min ? ` à ${moteur.max}` : ''}`);
      comparees += 1;
    }
  }
  assert.ok(comparees >= regles.niveaux.length * 5);
});

test('dons à choisir : groupes de la classe et de la spécialité choisie, jusqu’au niveau de classe', (t) => {
  // une spécialité du Guerrier qui a des choix (l’Épéiste à l’import ; lue dans les règles : le site de dev peut en créer ou en supprimer, D11)
  const guerrier = regles.classes.find((c) => c.id === 'classes/guerrier');
  const epeiste = guerrier.specialites.map((s) => s.id).find((id) => guerrier.choix.some((g) => g.specialite_id === id && g.niveau <= 18));
  if (!epeiste) t.diagnostic('Guerrier : aucune spécialité avec un choix avant le niveau 18 (remanié sur le site de dev)');
  const fiche = (xp, specialite_id = null) => ({ ...ficheVide(), xp, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id }] });
  // niveau de classe 2 : les choix hors spécialité des niveaux 1 et 2 (aucun à l'import ; le site peut ajouter une option à un don reçu d'office)
  assert.deepEqual(donsAChoisir(regles, fiche(0))[0].groupes, guerrier.choix.filter((g) => g.specialite_id === null && g.niveau <= 2), 'Guerrier niveau de classe 2');
  const dix = donsAChoisir(regles, fiche(8250, epeiste ?? null))[0];
  assert.equal(dix.classe.id, 'classes/guerrier');
  // ceux de sa spécialité (et les choix hors spécialité de la classe, s'il y en a), jusqu'à son niveau de classe
  if (epeiste) assert.ok(dix.groupes.some((g) => g.specialite_id === epeiste) && dix.groupes.every((g) => [epeiste, null].includes(g.specialite_id) && g.niveau <= 18));
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
  // les phrases du guide que valeursDuMoment applique, telles que la page les affiche (sans les balises du glossaire)
  const vocabulaire = chargerVocabulaire(db);
  const corps = (id) => texteSansBalises(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md, vocabulaire, { markdown: true });
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

test('alignement (demande du propriétaire, guide « Alignement ») : 5 points d’écart sur un axe pour une tendance, Neutre en dessous ; les neuf noms du guide', () => {
  const historique = historiqueSite(db);
  // les phrases du guide telles que l'import les a écrites
  assert.match(historique.valeurDImport('page', { id: 'guide/alignement' }, 'corps_md'),
    /Pour chaque axe, une différence de 5 points ou plus entre les deux scores détermine la tendance dominante\. En dessous de 5 points de différence, le personnage est Neutre sur cet axe/);
  assert.equal(regles.constantes['alignement.ecart_axe'], 5);
  const nom = (loyal, chaotique, bon, mauvais) => alignementDe(regles, { ...ficheVide(), alignement_loyal: loyal, alignement_chaotique: chaotique, alignement_bon: bon, alignement_mauvais: mauvais }).nom;
  assert.equal(nom(0, 0, 0, 0), 'Neutre');
  assert.equal(nom(5, 0, 0, 0), 'Loyal Neutre');
  assert.equal(nom(4, 0, 0, 0), 'Neutre', '4 points d’écart : Neutre');
  assert.equal(nom(9, 5, 0, 0), 'Neutre');
  assert.equal(nom(2, 7, 0, 0), 'Chaotique Neutre');
  assert.equal(nom(3, 3, 8, 3), 'Neutre Bon');
  assert.equal(nom(0, 6, 1, 7), 'Chaotique Mauvais');
  assert.equal(nom(12, 1, 20, 2), 'Loyal Bon');
  assert.deepEqual(alignementDe(regles, { alignement_loyal: '', alignement_chaotique: null }), { loi: 'Neutre', bien: 'Neutre', nom: 'Neutre' }, 'cases vides : 0');
  // les neuf combinaisons sont les titres de la page « Les neuf alignements »
  const titres = [...historique.valeurDImport('page', { id: 'guide/les-neuf-alignements' }, 'corps_md').matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const combinaisons = new Set();
  for (const [l, c] of [[5, 0], [0, 0], [0, 5]]) for (const [b, m] of [[5, 0], [0, 0], [0, 5]]) combinaisons.add(nom(l, c, b, m));
  assert.deepEqual([...combinaisons].sort(), [...titres].sort());
  // la pastille : une couleur par alignement possible (demande du propriétaire : celle de son titre dans le guide pour MJ), et le texte lisible dessus
  assert.deepEqual(Object.keys(regles.alignements).sort(), [...combinaisons].sort());
  assert.deepEqual(regles.alignements['Loyal Bon'], { couleur: '#45818e', texte: '#171210' });
  assert.deepEqual(regles.alignements['Chaotique Mauvais'], { couleur: '#cc0000', texte: '#ffffff' });
});

test('dé de la famille d’armes : le Pugilat selon la Force (« D6 1-2 Force, D8 3-4 Force, D10 5 Force »), +1 de la magie innée compris ; les autres leur dé', () => {
  const pugilat = regles.familles_armes.find((f) => f.id === 'pugilat');
  assert.deepEqual(pugilat.de_selon_force, [{ de: 'D6', min: 1, max: 2 }, { de: 'D8', min: 3, max: 4 }, { de: 'D10', min: 5, max: 5 }]);
  const avecForce = (base, magie = 'magies/magie-du-feu') => ficheConforme({
    magie_innee_id: magie,
    caracteristiques: ficheConforme().caracteristiques.map((c) => (c.caracteristique_id === 'force' ? { ...c, base } : c)),
  });
  assert.deepEqual([1, 2, 3, 4].map((f) => deDeLaFamille(regles, avecForce(f), pugilat)),
    [{ de: 'D6', force: 1 }, { de: 'D6', force: 2 }, { de: 'D8', force: 3 }, { de: 'D8', force: 4 }]);
  assert.deepEqual(deDeLaFamille(regles, avecForce(4, 'magies/magie-de-la-terre'), pugilat), { de: 'D10', force: 5 }, 'Terre innée : +1 Force');
  assert.equal(notationDesDes(deDeLaFamille(regles, avecForce(3), pugilat).de, 2), '2D8');
  for (const f of regles.familles_armes.filter((x) => !x.de_selon_force)) assert.deepEqual(deDeLaFamille(regles, ficheConforme(), f), { de: f.de, force: null }, f.id);
});

test('décision R32 : quota de maîtrise = maîtrises des classes prises + points des dons acquis (classe, spécialité au niveau, dons à choix choisis)', () => {
  const classe = (id) => regles.classes.find((c) => c.id === id);
  const deLaClasse = (id) => classe(id).maitrises.reduce((s, m) => s + m.nombre, 0);
  const xp = (niveau) => regles.niveaux.find((n) => n.niveau === niveau).xp_min;
  assert.ok(deLaClasse('classes/guerrier') > 0);
  // niveau 1 : les maîtrises du Guerrier, rien de réparti
  const debut = quotaDeMaitrise(regles, ficheConforme());
  assert.deepEqual(debut, { total: deLaClasse('classes/guerrier'), utilises: 0, sources: [{ nom: 'Guerrier', points: deLaClasse('classes/guerrier') }] });
  assert.deepEqual(quotaDeMaitrise(regles, ficheVide()), { total: 0, utilises: 0, sources: [] }, 'sans classe');
  // les points répartis sur la fiche
  assert.equal(quotaDeMaitrise(regles, ficheConforme({ maitrises_armes: [{ arme_famille_id: 'epees', des: 3 }, { arme_famille_id: 'dagues', des: 2 }] })).utilises, 3);
  // la spécialité au niveau de classe 10 : l'Épéiste (« 2 points de maîtrise à l'épée, 1 point de maîtrise à la dague, -1 point… »)
  const epeiste = classe('classes/guerrier').dons.find((d) => d.id === 'capacites/guerrier-epeiste');
  assert.deepEqual({ nature: epeiste.nature, niveau: epeiste.niveau, points: epeiste.points_maitrise }, { nature: 'specialite', niveau: 10, points: 2 });
  const guerrier10 = (specialite_id) => ficheConforme({ xp: xp(5), classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id }] });
  assert.equal(quotaDeMaitrise(regles, guerrier10('classes/guerrier#specialite:epeiste')).total, deLaClasse('classes/guerrier') + 2);
  assert.equal(quotaDeMaitrise(regles, guerrier10(null)).total, deLaClasse('classes/guerrier'), 'sans spécialité');
  // deux classes : les maîtrises de chacune ; en mono-classe, la seconde ne compte qu'une fois prise (niveau global 11, décision R2)
  const deux = [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }, { rang: 2, classe_id: 'classes/mage', specialite_id: null }];
  assert.equal(quotaDeMaitrise(regles, ficheConforme({ mode_classe: 'bi', classes: deux })).total, deLaClasse('classes/guerrier') + deLaClasse('classes/mage'));
  assert.equal(quotaDeMaitrise(regles, ficheConforme({ xp: xp(10), classes: deux })).total, deLaClasse('classes/guerrier'), 'mono-classe, niveau 10 : pas encore de seconde classe');
  assert.equal(quotaDeMaitrise(regles, ficheConforme({ xp: xp(11), classes: deux })).total, deLaClasse('classes/guerrier') + deLaClasse('classes/mage'));
  // un don à choix : seulement choisi (Archimage, niveau de classe 10 : « +1 point de maîtrise d'arme de contact »)
  const archimage = (capacites) => ficheConforme({ xp: xp(5), magie_innee_id: 'magies/potentiel-illimite', classes: [{ rang: 1, classe_id: 'classes/archimage', specialite_id: null }], capacites });
  assert.equal(quotaDeMaitrise(regles, archimage([])).total, deLaClasse('classes/archimage'));
  assert.equal(quotaDeMaitrise(regles, archimage([{ capacite_id: 'capacites/archimage-elementaliste' }])).total, deLaClasse('classes/archimage') + 1);
  assert.equal(quotaDeMaitrise(regles, { ...archimage([{ capacite_id: 'capacites/archimage-elementaliste' }]), xp: xp(4) }).total, deLaClasse('classes/archimage'), 'pas avant son niveau');
  // chaque classe a ses maîtrises ; chaque don qui en donne est d'une classe, avec ses points
  assert.ok(regles.classes.every((c) => c.maitrises.length > 0 && c.maitrises.every((m) => m.nombre > 0 && m.brut)));
  assert.ok(regles.classes.every((c) => c.dons.every((d) => d.points_maitrise >= 0 && ['classe', 'specialite', 'choix'].includes(d.nature))));
});

test('boutons + et − des valeurs du moment (demande du propriétaire) : la valeur affichée plus ou moins le nombre saisi, bornée comme le curseur', () => {
  const fiche = ficheConforme();
  const a = attributsDe(regles, fiche);
  assert.deepEqual(ajusterValeurDuMoment(regles, fiche, 'sante_actuelle', -5), { sante_actuelle: a.sante - 5 }, 'santé pleine (vide = au maximum)');
  assert.deepEqual(ajusterValeurDuMoment(regles, { ...fiche, sante_actuelle: 4 }, 'sante_actuelle', 3), { sante_actuelle: 7 });
  assert.deepEqual(ajusterValeurDuMoment(regles, fiche, 'sante_actuelle', 100), { sante_actuelle: a.sante }, 'au plus le maximum');
  assert.deepEqual(ajusterValeurDuMoment(regles, fiche, 'barriere_actuelle', -999), { barriere_actuelle: 0 }, 'au moins 0');
  assert.deepEqual(ajusterValeurDuMoment(regles, fiche, 'corruption', 3), { corruption: 3, chakra_actuel: a.chakra - 3 }, 'la corruption prend la place du chakra');
  assert.deepEqual(ajusterValeurDuMoment(regles, { ...fiche, corruption: 3, chakra_actuel: a.chakra - 3 }, 'chakra_actuel', 10), { chakra_actuel: a.chakra - 3 });
  assert.deepEqual(ajusterValeurDuMoment(regles, fiche, 'barre4_actuelle', 1), {}, 'pas de 4ᵉ barre sans Sang ni Nécromancie');
});

test('décision R33 : le métier donne son bonus en acquis (rang à choix : la compétence choisie) et « +X INI » à l’initiative ; même chose que v_personnage_metier_bonus', () => {
  for (const metier of regles.metiers) {
    // chaque rang à choix reçoit sa première compétence
    const metier_bonus = metier.bonus.filter((b) => b.options.filter((o) => o.competence_id).length > 1).map((b) => ({ rang: b.rang, competence_id: b.options.find((o) => o.competence_id).competence_id }));
    const fiche = { ...ficheVide(`métier ${metier.nom}`), metier_id: metier.id, metier_bonus };
    const { personnage } = enregistrerFiche(vivante, fiche);
    const vue = vivante.prepare('SELECT competence_id, attribut, valeur FROM v_personnage_metier_bonus WHERE personnage_id = ?').all(personnage.id);
    const parCompetence = {};
    for (const v of vue.filter((x) => x.competence_id)) parCompetence[v.competence_id] = (parCompetence[v.competence_id] ?? 0) + v.valeur;
    const b = bonusDuMetier(regles, fiche);
    assert.deepEqual(b.parCompetence, parCompetence, metier.id);
    assert.equal(b.initiative, vue.filter((x) => x.attribut === 'initiative').reduce((t, x) => t + x.valeur, 0), metier.id);
    assert.equal(attributsDe(regles, fiche).initiativeMetier, b.initiative, metier.id);
  }
  // sans choix fait, un rang à choix ne donne rien ; une compétence qui n'est pas une option ne compte pas et part au changement de métier
  const aChoix = regles.metiers.find((m) => m.bonus.some((b) => b.options.filter((o) => o.competence_id).length > 1));
  const rang = aChoix.bonus.find((b) => b.options.filter((o) => o.competence_id).length > 1);
  const sans = bonusDuMetier(regles, { metier_id: aChoix.id });
  assert.equal(sans.rangs.find((r) => r.rang === rang.rang).retenue, null);
  assert.equal(sans.rangs.find((r) => r.rang === rang.rang).aChoisir, true);
  const horsChoix = { metier_id: aChoix.id, metier_bonus: [{ rang: rang.rang, competence_id: 'medecine' }, { rang: rang.rang + 50, competence_id: rang.options[0].competence_id }] };
  assert.equal(bonusDuMetier(regles, horsChoix).rangs.find((r) => r.rang === rang.rang).retenue, null);
  assert.deepEqual(choixDeMetierValables(regles, horsChoix), []);
  const bon = { metier_id: aChoix.id, metier_bonus: [{ rang: rang.rang, competence_id: rang.options[1].competence_id }] };
  assert.deepEqual(choixDeMetierValables(regles, bon), bon.metier_bonus);
  assert.deepEqual(choixDeMetierValables(regles, { ...bon, metier_id: null }), []);
});

test('décision R33 : le bonus du métier compte dans l’acquis — score, plafond de 5 par point de base, acquis calculé ; initiative 1D20 + Agilité + métier', () => {
  const metier = regles.metiers.find((m) => m.bonus.some((b) => b.options.length === 1 && b.options[0].competence_id));
  const rang = metier.bonus.find((b) => b.options.length === 1 && b.options[0].competence_id);
  const id = rang.options[0].competence_id;
  const sans = competencesDe(regles, ficheConforme()).find((c) => c.id === id);
  const avec = competencesDe(regles, ficheConforme({ metier_id: metier.id })).find((c) => c.id === id);
  const total = metier.bonus.filter((b) => b.options.length === 1 && b.options[0].competence_id === id).reduce((t, b) => t + b.valeur, 0);
  assert.equal(avec.metier, total);
  assert.equal(avec.score, sans.score + total);
  assert.equal(avec.plafondAcquis, sans.plafondAcquis);
  assert.equal(avec.acquis, sans.acquis + total, 'compté dans l’acquis calculé (R104)');
  assert.equal(sans.metier, 0);
  // initiative : un métier « +N INI » s'ajoute au bonus de l'Agilité
  const coureur = regles.metiers.find((m) => m.bonus.some((b) => b.options.some((o) => o.attribut === 'initiative')));
  const n = coureur.bonus.find((b) => b.options.some((o) => o.attribut === 'initiative')).valeur;
  const base = attributsDe(regles, ficheConforme());
  const plus = attributsDe(regles, ficheConforme({ metier_id: coureur.id }));
  assert.equal(plus.initiativeBonus, base.initiativeBonus + n);
  assert.equal(base.initiativeBonus, base.initiative?.bonus ?? 0);
});

test('décision R34 : compétence d’artisanat = 10 × chacune des deux caractéristiques du métier (exemples du propriétaire : sculpteur 50 %, joaillier 90 %)', () => {
  const essai = (caracteristiques) => ({ id: 'metiers/essai', nom: 'Essai', bonus: [], objets: [], artisanat: { texte: 'Fabrique', caracteristiques } });
  const r = { ...regles, metiers: [essai(['force', 'intelligence']), { ...essai(['perception', 'intelligence']), id: 'metiers/essai-2' }, { ...essai([]), id: 'metiers/essai-3' }] };
  const bases = (b) => Object.entries({ force: 1, volonte: 1, intelligence: 1, perception: 1, social: 1, agilite: 1, ...b }).map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: 0 }));
  // « un Sculpteur avec 3 de force et 2 en intelligence a une compétence de 3*10 + 2*10 = 50% »
  assert.equal(artisanatDe(r, { metier_id: 'metiers/essai', caracteristiques: bases({ force: 3, intelligence: 2 }) }).score, 50);
  // « joalier avec 5 en intelligence et 4 en perception a 5*10 + 4*10 = 90% »
  assert.equal(artisanatDe(r, { metier_id: 'metiers/essai-2', caracteristiques: bases({ intelligence: 5, perception: 4 }) }).score, 90);
  // la valeur de la caractéristique compte le +1 de la magie innée, comme le score d'une compétence
  const magieDeForce = regles.magies.find((m) => m.caracteristique_id === 'force');
  assert.equal(artisanatDe(r, { metier_id: 'metiers/essai', magie_innee_id: magieDeForce.id, caracteristiques: bases({ force: 3, intelligence: 2 }) }).score, 60);
  assert.equal(artisanatDe(r, { metier_id: 'metiers/essai-3', caracteristiques: bases({}) }).score, null, 'sans ses deux caractéristiques');
  assert.equal(artisanatDe(r, { metier_id: null }), null);
  assert.equal(regles.constantes['metier.artisanat_par_point_caracteristique'], 10);
  // dans la base : chaque métier qui fabrique avec un test a ses deux caractéristiques (le Peintre « PERCEPTION x2 » : deux fois la Perception)
  for (const m of regles.metiers.filter((x) => x.artisanat?.caracteristiques.length)) assert.equal(m.artisanat.caracteristiques.length, 2, m.id);
});

test('décision R35 : les objets de départ du métier entrent dans l’inventaire quand on le choisit, sortent quand on en change ; un objet à choisir se choisit', () => {
  assert.deepEqual(objetDInventaire('Crochet (x3)'), { nom: 'Crochet', quantite: 3 });
  assert.deepEqual(objetDInventaire('Faux en fer (Arme)'), { nom: 'Faux en fer (Arme)', quantite: 1 });
  const r = {
    ...regles,
    metiers: [
      { id: 'metiers/a', nom: 'A', bonus: [], artisanat: null, objets: [{ rang: 1, options: ['Corde'] }, { rang: 2, options: ['Pelle', 'Faux'] }, { rang: 3, options: ['Crochet (x3)'] }] },
      { id: 'metiers/b', nom: 'B', bonus: [], artisanat: null, objets: [{ rang: 1, options: ['Marteau'] }] },
    ],
  };
  assert.deepEqual(objetsDuMetier(r, 'metiers/a')[2].options, [{ texte: 'Crochet (x3)', nom: 'Crochet', quantite: 3 }]);
  const depart = [{ rang: 1, nom: 'Pain', quantite: 2, ressource_id: null }];
  let fiche = { metier_id: 'metiers/a', inventaire: depart };
  fiche.inventaire = inventaireSelonLeMetier(r, fiche, null);
  assert.deepEqual(fiche.inventaire.map((o) => [o.rang, o.nom, o.quantite]), [[1, 'Pain', 2], [2, 'Corde', 1], [3, 'Crochet', 3]], 'le choix attend');
  assert.equal(objetChoisi(fiche, objetsDuMetier(r, 'metiers/a')[1]), -1);
  fiche.inventaire = choisirObjetDeMetier(r, fiche, 2, 1);
  assert.equal(objetChoisi(fiche, objetsDuMetier(r, 'metiers/a')[1]), 1);
  fiche.inventaire = choisirObjetDeMetier(r, fiche, 2, 0);
  assert.deepEqual(fiche.inventaire.map((o) => o.nom), ['Pain', 'Corde', 'Crochet', 'Pelle'], 'l’autre option part');
  // un objet renommé (ou dont la quantité a changé) reste au joueur quand il change de métier
  fiche.inventaire = fiche.inventaire.map((o) => (o.nom === 'Crochet' ? { ...o, quantite: 2 } : o));
  fiche = { ...fiche, metier_id: 'metiers/b' };
  fiche.inventaire = inventaireSelonLeMetier(r, fiche, 'metiers/a');
  assert.deepEqual(fiche.inventaire.map((o) => [o.rang, o.nom, o.quantite]), [[1, 'Pain', 2], [2, 'Crochet', 2], [3, 'Marteau', 1]]);
  fiche = { ...fiche, metier_id: null };
  assert.deepEqual(inventaireSelonLeMetier(r, fiche, 'metiers/b').map((o) => o.nom), ['Pain', 'Crochet']);
  // un objet au nom d'une ressource du catalogue y est rattaché, comme une saisie de l'inventaire
  const ressource = regles.ressources[0];
  const r2 = { ...regles, metiers: [{ id: 'metiers/c', nom: 'C', bonus: [], artisanat: null, objets: [{ rang: 1, options: [ressource.nom] }] }] };
  assert.equal(inventaireSelonLeMetier(r2, { metier_id: 'metiers/c', inventaire: [] }, null)[0].ressource_id, ressource.id);
  // dans la base : les objets de chaque métier redonnent son équipement
  for (const m of regles.metiers) assert.ok(m.objets.every((o) => o.options.length >= 1 && o.options.every((t) => t.trim())), m.id);
});

test('décision R37 : la vitesse et la vitesse de nage du métier s’ajoutent à celles de la race', () => {
  const vite = regles.metiers.find((m) => m.bonus.some((b) => b.options.some((o) => o.attribut === 'vitesse')));
  const nageur = regles.metiers.find((m) => m.bonus.some((b) => b.options.some((o) => o.attribut === 'vitesse_nage')));
  const valeur = (m, attribut) => m.bonus.filter((b) => b.options.length === 1 && b.options[0].attribut === attribut).reduce((t, b) => t + b.valeur, 0);
  const base = attributsDe(regles, ficheConforme());
  const a = attributsDe(regles, ficheConforme({ metier_id: vite.id }));
  assert.equal(a.vitesseSol, base.vitesseSol + valeur(vite, 'vitesse'));
  assert.equal(a.vitesseMetier, valeur(vite, 'vitesse'));
  const b = attributsDe(regles, ficheConforme({ metier_id: nageur.id }));
  assert.equal(b.vitesseNage, base.vitesseNage + valeur(nageur, 'vitesse_nage'));
  assert.equal(b.vitesseSol, base.vitesseSol + valeur(nageur, 'vitesse'));
  assert.equal(attributsDe(regles, { ...ficheVide(), metier_id: vite.id }).vitesseSol, null, 'sans race, pas de vitesse');
});

test('décision R38 : le plafond d’Acquis prévaut sur le bonus du métier — rogné, jamais une erreur ; la base dit la même chose', () => {
  // un métier qui donne un seul bonus fixe de N à une compétence, sur une caractéristique de base 1 (plafond 5) : N > 5 est rogné à 5
  const r = { ...regles, metiers: [{ id: 'metiers/essai-plafond', nom: 'Essai', artisanat: null, objets: [], bonus: [{ rang: 1, texte: '+7% Connaissance', valeur: 7, unite: '%', options: [{ competence_id: 'connaissance', attribut: null }] }] }] };
  const fiche = ficheConforme({ metier_id: 'metiers/essai-plafond' });
  const intelligence = fiche.caracteristiques.find((c) => c.caracteristique_id === 'intelligence');
  const plafond = intelligence.base * regles.constantes['competence.acquis_max_par_point_caracteristique'];
  const c = competencesDe(r, fiche).find((x) => x.id === 'connaissance');
  assert.deepEqual([c.metierBrut, c.metier, c.plafondAcquis, c.acquis], [7, Math.min(7, plafond), plafond, Math.min(7, plafond)]);
  const sans = competencesDe(r, { ...fiche, metier_id: null }).find((x) => x.id === 'connaissance');
  assert.equal(c.score, sans.score + Math.min(7, plafond));
  // dans la base : un vrai métier dont le bonus dépasse le plafond d'une caractéristique de base 1
  const grand = regles.metiers.flatMap((m) => m.bonus.filter((b) => b.options.length === 1 && b.options[0].competence_id && b.valeur > regles.constantes['competence.acquis_max_par_point_caracteristique'])
    .map((b) => ({ metier: m, competence: regles.competences.find((k) => k.id === b.options[0].competence_id), valeur: b.valeur })))[0];
  if (grand) {
    const bases = Object.fromEntries(regles.caracteristiques.map((k) => [k.id, 2]));
    bases[grand.competence.caracteristique_id] = 1;
    const autre = regles.caracteristiques.find((k) => k.id !== grand.competence.caracteristique_id).id; // reçoit le reste des 14 points
    bases[autre] += 14 - Object.values(bases).reduce((t, v) => t + v, 0);
    const caracteristiques = Object.entries(bases).map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: 0 }));
    const metier_bonus = grand.metier.bonus.filter((b) => b.options.filter((o) => o.competence_id).length > 1).map((b) => ({ rang: b.rang, competence_id: b.options.find((o) => o.competence_id).competence_id }));
    const { controles } = enregistrerFiche(vivante, ficheConforme({ metier_id: grand.metier.id, caracteristiques, metier_bonus }));
    assert.deepEqual(controles.filter((x) => String(x.detail).includes(grand.competence.id)), [], `${grand.metier.id} : bonus rogné, pas d’erreur`);
    // l'entraînement sur cette compétence ne passe pas le plafond : il est compté en premier, le métier prend ce qui reste (R104)
    const entraine = ficheConforme({ metier_id: grand.metier.id, caracteristiques, metier_bonus, entrainements: [{ rang: 1, competence_id: grand.competence.id, valeur: 3, texte: null }] });
    const k = competencesDe(regles, entraine).find((x) => x.id === grand.competence.id);
    assert.deepEqual([k.entrainement, k.metier, k.acquis], [3, k.plafondAcquis - 3, k.plafondAcquis]);
    assert.ok(!enregistrerFiche(vivante, entraine).controles.some((x) => x.regle.startsWith('entrainement')), 'rogné, jamais une erreur');
  }
});

test('décision R39 : une croix retire 20 à la compétence d’artisanat (comme −2 à la caractéristique), deux croix la rendent inutilisable', () => {
  const r = { ...regles, metiers: [{ id: 'metiers/essai', nom: 'Essai', bonus: [], objets: [], artisanat: { texte: 'Fabrique', caracteristiques: ['force', 'intelligence'] } }] };
  const fiche = (croix) => ({ metier_id: 'metiers/essai', caracteristiques: Object.entries({ force: 3, volonte: 1, intelligence: 2, perception: 1, social: 1, agilite: 1 })
    .map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: croix[caracteristique_id] ?? 0 })) });
  assert.equal(artisanatDe(r, fiche({})).score, 50);
  assert.equal(artisanatDe(r, fiche({ force: 1 })).score, 30, '3 × 10 − 20 + 2 × 10');
  assert.equal(artisanatDe(r, fiche({ force: 1, intelligence: 1 })).score, 10, 'une croix sur chacune');
  assert.equal(artisanatDe(r, fiche({ volonte: 1 })).score, 50, 'une croix ailleurs ne change rien');
  const deux = artisanatDe(r, fiche({ intelligence: 2 }));
  assert.deepEqual([deux.score, deux.inutilisable], [null, true]);
  assert.equal(regles.constantes['competence.croix_1_malus'], -20);
});

test('dons de classe débloqués (demande du propriétaire) : de la classe et de la spécialité jusqu’au niveau de classe, dons à choix choisis seulement', () => {
  const xp = (niveau) => regles.niveaux.find((n) => n.niveau === niveau).xp_min;
  const guerrier = regles.classes.find((c) => c.id === 'classes/guerrier');
  const ids = (fiche) => donsAcquis(regles, fiche).flatMap((c) => c.dons.map((d) => d.id));
  // niveau global 1, mono-classe : niveau de classe 2, les dons de classe de niveau 1 et 2
  assert.deepEqual(ids(ficheConforme()), guerrier.dons.filter((d) => d.nature === 'classe' && d.niveau <= 2 && !d.specialite_id).map((d) => d.id));
  const epeiste = 'classes/guerrier#specialite:epeiste';
  const dix = ficheConforme({ xp: xp(5), classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: epeiste }], capacites: [{ capacite_id: 'capacites/guerrier-duelliste' }] });
  const acquis = ids(dix);
  assert.ok(acquis.includes('capacites/guerrier-epeiste'), 'le don de la spécialité');
  assert.ok(acquis.includes('capacites/guerrier-duelliste'), 'le don à choix choisi');
  assert.ok(!acquis.includes('capacites/guerrier-coup-dur'), 'pas l’autre option du choix');
  assert.ok(!acquis.includes('capacites/guerrier-maitre-darme'), 'pas l’autre spécialité');
  assert.ok(donsAcquis(regles, dix)[0].dons.every((d) => d.niveau <= 10), 'rien au-delà du niveau de classe');
  assert.deepEqual(donsAcquis(regles, ficheVide()), [], 'sans classe');
  // la seconde classe d'un mono-classe n'en donne qu'une fois prise (niveau global 11, décision R2)
  const deux = (niveau) => ficheConforme({ xp: xp(niveau), classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }, { rang: 2, classe_id: 'classes/mage', specialite_id: null }] });
  assert.deepEqual(donsAcquis(regles, deux(10)).map((c) => c.rang), [1]);
  assert.deepEqual(donsAcquis(regles, deux(11)).map((c) => c.rang), [1, 2]);
});

test('dons de la race (demande du propriétaire) : le don de base d’abord, le don de l’ethnie, la ligne de son ethnie dans le tableau de la race', () => {
  const humain = regles.races.find((r) => r.id === 'races/humain');
  const central = donsDeRace(regles, ficheConforme());
  assert.equal(central.base, humain.don_base);
  assert.ok(central.base, 'l’Humain a un don de base');
  assert.deepEqual(central.dons, humain.dons.filter((d) => d.ethnie_id === 'races/humain#ethnie:humain-central'));
  assert.equal(central.dons.length, 1);
  assert.equal(central.ethnieAChoisir, false);
  const sansEthnie = donsDeRace(regles, ficheConforme({ ethnie_id: null }));
  assert.deepEqual([sansEthnie.dons, sansEthnie.ethnieAChoisir], [[], true], 'un don par ethnie : à choisir');
  // un don unique vaut pour toute la race
  const unique = regles.races.find((r) => r.dons.length === 1 && r.dons[0].forme === 'unique');
  assert.ok(unique);
  assert.equal(donsDeRace(regles, { ...ficheVide(), race_id: unique.id }).dons.length, 1);
  // une race à tableau de dons : la ligne de son ethnie
  const tableau = regles.races.find((r) => r.dons_tableau?.lignes.some((l) => l.ethnie_id));
  assert.ok(tableau, 'une race a un tableau de dons par ethnie');
  const ligne = tableau.dons_tableau.lignes.find((l) => l.ethnie_id);
  const avecTableau = donsDeRace(regles, { ...ficheVide(), race_id: tableau.id, ethnie_id: ligne.ethnie_id });
  assert.deepEqual(avecTableau.tableau, { titre: tableau.dons_tableau.titre, cellules: ligne.cellules, resistances: ligne.resistances ?? null, acquis: ligne.acquis ?? [] });
  assert.deepEqual(donsDeRace(regles, ficheVide()), { base: null, dons: [], tableau: null, ethnieAChoisir: false }, 'sans race');
});

test('résistances (fiche auto Personnage!BA2:BI12) : les crans de la magie innée et de l’acquise s’additionnent, rangés dans les six paliers ; à 0, rien', () => {
  // la base recalcule la même chose : somme des crans des deux listes (magie_resistance), palier de resistance_palier
  const palierSql = db.prepare(`
    SELECT r.cible, p.id AS palier FROM (
      SELECT COALESCE(cible_magie_id, cible_etat_id) AS cible, SUM(CASE sens WHEN 'resistance' THEN 1 ELSE -1 END) AS v
      FROM magie_resistance WHERE magie_id IN (?, ?) GROUP BY cible) r
    JOIN resistance_palier p ON (p.valeur_min IS NULL OR r.v >= p.valeur_min) AND (p.valeur_max IS NULL OR r.v <= p.valeur_max)`);
  let paires = 0;
  for (const innee of regles.magies) {
    for (const acquise of [null, ...regles.magies]) {
      const fiche = ficheConforme({ magie_innee_id: innee.id, magie_acquise_id: acquise?.id ?? null });
      if (acquise && refusMagieAcquise(regles, fiche, acquise.id)) continue;
      paires += 1;
      const calcul = resistancesDe(regles, fiche); // Humain central, Guerrier : ni don ni ethnie qui en donne
      assert.deepEqual(calcul.paliers.map((p) => p.id), ['immunite', 'grande_resistance', 'resistance', 'vulnerabilite', 'grande_vulnerabilite', 'sensibilite']);
      const lus = calcul.paliers.flatMap((p) => p.cibles.map((c) => `${c.id}>${p.id}`)).sort();
      assert.deepEqual(lus, palierSql.all(innee.id, acquise?.id ?? innee.id).map((r) => `${r.cible}>${r.palier}`).sort(), `${innee.nom} + ${acquise?.nom ?? '—'}`);
      for (const p of calcul.paliers) {
        // les magies d'abord, puis les altérations, chacune dans l'ordre de la base
        const types = p.cibles.map((c) => c.type);
        assert.deepEqual(types, [...types].sort((a, b) => (a === b ? 0 : a === 'magie' ? -1 : 1)));
        for (const c of p.cibles) assert.equal(c.crans, c.origines.reduce((t, o) => t + o.crans, 0), c.nom);
      }
      assert.deepEqual(calcul.auChoix, []);
    }
  }
  assert.ok(paires > 100);
  const feu = resistancesDe(regles, ficheConforme());
  assert.deepEqual(feu.paliers.find((p) => p.id === 'resistance').cibles.map((c) => c.nom), ['Feu', 'Glace', 'Terre', 'Brûlure', 'Gel', 'Pétrifié'],
    'la page de la magie du Feu : résiste au Feu, à la Glace, à la Terre et à leurs altérations');
  assert.deepEqual(resistancesDe(regles, ficheVide()).paliers.flatMap((p) => p.cibles), [], 'fiche vide');
});

test('résistances des dons : ethnie hybride (sa magie innée et son altération), tableau du Drakos, Mort-Vivant (ligne du tableau, immunité de Trompe-mort), don de classe ; choix signalé', () => {
  const palier = (calcul, nom) => calcul.paliers.find((p) => p.cibles.some((c) => c.nom === nom))?.id ?? null;
  const cible = (calcul, nom) => calcul.paliers.flatMap((p) => p.cibles).find((c) => c.nom === nom);
  // « 1 cran de résistance en plus à la magie innée et son altération d'état » : Glace 1 + 1, Gel 1 + 1
  const fenrir = resistancesDe(regles, ficheConforme({ race_id: 'races/fenrir', ethnie_id: 'races/fenrir#ethnie:fenrir-de-glace', magie_innee_id: 'magies/magie-de-la-glace' }));
  assert.deepEqual([palier(fenrir, 'Glace'), palier(fenrir, 'Gel')], ['grande_resistance', 'grande_resistance']);
  assert.deepEqual(cible(fenrir, 'Gel').origines.map((o) => o.crans), [1, 1]);
  // Mort-Vivant nécrotique : Nécromancie +1 (magie) +1 (ligne du tableau) +1 (Glace acquise) = 3, immunité ; Poison : immunisé (Trompe-mort)
  const mort = resistancesDe(regles, ficheConforme({
    race_id: 'races/mort-vivant', ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-necrotique', magie_innee_id: 'magies/magie-de-la-necromancie', magie_acquise_id: 'magies/magie-de-la-glace',
  }));
  assert.deepEqual(mort.paliers.find((p) => p.id === 'immunite').cibles.map((c) => c.nom), ['Nécromancie', 'Poison']);
  assert.equal(cible(mort, 'Nécromancie').crans, 3);
  assert.ok(cible(mort, 'Poison').origines.some((o) => o.nom === 'Trompe-mort' && o.immunite));
  // une immunité prévaut sur les crans : la Foudre est vulnérable au Poison
  const foudre = resistancesDe(regles, ficheConforme({ race_id: 'races/mort-vivant', ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-foudre', magie_innee_id: 'magies/magie-de-la-foudre' }));
  assert.equal(cible(foudre, 'Poison').crans, -1);
  assert.equal(palier(foudre, 'Poison'), 'immunite');
  // Drakos Rouge : « +1 cran de résistance » Brûlure (Feu inné : 1 + 1) ; Drakos Orange : au choix, pas compté
  const rouge = resistancesDe(regles, ficheConforme({ race_id: 'races/drakos', ethnie_id: 'races/drakos#ethnie:drakos-rouge' }));
  assert.equal(cible(rouge, 'Brûlure').crans, 2);
  const orange = resistancesDe(regles, ficheConforme({ race_id: 'races/drakos', ethnie_id: 'races/drakos#ethnie:drakos-orange', magie_innee_id: 'magies/potentiel-illimite' }));
  assert.deepEqual([orange.paliers.flatMap((p) => p.cibles), orange.auChoix], [[], ['Écaille draconique']]);
  // Clerc, don de classe de niveau 1 « Proche » : la magie innée (Feu) et la Brûlure gagnent un cran
  const clerc = resistancesDe(regles, ficheConforme({ classes: [{ rang: 1, classe_id: 'classes/clerc', specialite_id: null }] }));
  assert.deepEqual([cible(clerc, 'Feu').crans, cible(clerc, 'Brûlure').crans, cible(clerc, 'Glace').crans], [2, 2, 1]);
  assert.ok(cible(clerc, 'Feu').origines.some((o) => o.nom === 'Proche (Clerc)'));
});
