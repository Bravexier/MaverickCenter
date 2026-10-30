// La réussite critique sur la fiche de personnage (décision R180, « Nerf de la réussite critique ») : le palier lu sur le score du moment (de 96 à 102 %,
// +2 ; à partir de 103 %, +5 au total ; sans borne haute), le +5 de l'Offensif sur ses six jets d'attaque et celui du Défensif sur Esquive et Parade
// (posture_critique), cumulés au Mode Hyper 100 % (R172), le don de posture (« (Posture Offensif) Augmente la réussite critique de +5% », Sci du Crit,
// lu dans son texte comme « ... Brutale », R164 ; ses jets : Q90, choix provisoire), l'accessoire « peu importe le jet », le plafond de 1 à 15 (base
// comprise), et l'infobulle du score. Seulement ce qui joue en permanence (R128, Q88 décidée : (a)). Les nombres viennent de regle_constante, les
// compétences de posture_critique : le test les lit dans la base, jamais en dur, sauf les exemples de la décision.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lecteurDAcquis } from '../src/lib/acquis-texte.mjs';
import { critiqueDeLAccessoire, critiqueDuDon } from '../src/lib/critique-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { COMPETENCES_D_ATTAQUE, effetDePosture } from '../src/lib/posture-texte.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const POSTURE = (slug) => `guide/postures#posture:${slug}`;
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const SCI_DU_CRIT = 'capacites/martiale-sci-du-crit';
const ACCESSOIRE = 'ressources/accessoires#effet:jet-de-de:13';
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', ...x });
/** Martiale, Héros, niveau 15, avec Sci du Crit (« Choix » du niveau 15). */
const heros = (x = {}) => fiche({
  xp: xpDuNiveau(15), classes: [{ rang: 1, classe_id: 'classes/martiale', specialite_id: 'classes/martiale#specialite:heros' }],
  capacites: [{ capacite_id: SCI_DU_CRIT }], ...x,
});
/** La fiche, chaque compétence de `scores` portée à ce score de fiche (hors posture) par ses points naturels. */
const avecScores = (f, scores) => {
  const sans = Object.fromEntries(M.competencesDe(regles, { ...f, competences: [] }).map((c) => [c.id, c.score]));
  return { ...f, competences: Object.entries(scores).map(([id, s]) => ({ competence_id: id, naturel: s - sans[id] })) };
};
const competence = (f, id) => M.competencesDe(regles, f).find((c) => c.id === id);
const origines = (c) => c.critique.origines.map((o) => [o.origine, o.valeur]);
const deLaBase = (posture, bonus) => lignes('SELECT competence_id FROM posture_critique WHERE posture_id = ? AND bonus = ? ORDER BY competence_id', POSTURE(posture), bonus)
  .map((r) => r.competence_id);
const constante = (id) => db.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(id).valeur;

test('R180 : les constantes et les jets de la réussite critique viennent de la base', () => {
  for (const id of ['critique.base', 'critique.palier_1_score_min', 'critique.palier_1_bonus', 'critique.palier_2_score_min', 'critique.palier_2_bonus', 'critique.plafond']) {
    assert.equal(regles.constantes[id], constante(id), id);
  }
  for (const p of regles.postures) {
    const slug = p.id.split(':').at(-1);
    assert.deepEqual(p.critique, { posture: deLaBase(slug, 'posture'), don_de_posture: deLaBase(slug, 'don_de_posture') }, p.nom);
  }
  // Offensif : ses six jets (Concentration en plus des cinq compétences d'attaque de R100, dont le −10 ne change pas) ; Défensif : Esquive et Parade
  const offensif = regles.postures.find((p) => p.id === POSTURE('offensif')).critique.posture;
  assert.deepEqual([...offensif].sort(), [...COMPETENCES_D_ATTAQUE, 'concentration'].sort());
  assert.deepEqual(COMPETENCES_D_ATTAQUE, ['arc', 'arbalete', 'arme-legere', 'arme-lourde', 'magie']);
  assert.deepEqual(regles.postures.find((p) => p.id === POSTURE('defensif')).critique.posture, ['esquive', 'parade']);
});

test('R180 : lectures — les lignes de réussite critique des postures, le don de posture, l’accessoire ; rien d’autre', () => {
  // les deux lignes du tableau de la fiche (Offensif rang 2, Défensif rang 5), rejouées sur toute la base
  const critiques = lignes("SELECT posture_id, rang, texte FROM posture_effet WHERE version = 'fiche' ORDER BY posture_id, rang")
    .filter((l) => effetDePosture(l.texte)?.cible === 'critique')
    .map((l) => [l.posture_id.split(':')[1], l.rang, effetDePosture(l.texte).valeur]);
  assert.deepEqual(critiques, [['defensif', 5, 5], ['offensif', 2, 5]]);
  assert.deepEqual(effetDePosture('+5% à la réussite critique'), { cible: 'critique', valeur: 5 });
  assert.deepEqual(effetDePosture('+5% à la RC à la défense'), { cible: 'critique', valeur: 5 });
  assert.deepEqual(effetDePosture('+5% à la réussite critique avec une défense'), { cible: 'critique', valeur: 5 });
  // le Focus « +10% à la réussite » reste un bonus de compétence
  assert.equal(effetDePosture('+10% à la réussite').cible, 'competences');

  // dons : « (Posture X) » en tête, puis « Augmente la réussite critique de +N% » ; rejoué sur tous les dons de classe et de race
  assert.deepEqual(critiqueDuDon('(Posture Offensif)\nAugmente la réussite critique de +5%.'), { postures: ['offensif'], valeur: 5 });
  assert.deepEqual(critiqueDuDon('(Posture Défensif/Neutre)\nAugmente la réussite critique de +3%.'), { postures: ['défensif', 'neutre'], valeur: 3 });
  assert.equal(critiqueDuDon('Augmente la réussite critique de +5%.'), null, 'sans posture en tête');
  const donsLus = [
    ...lignes('SELECT id, effet AS texte FROM capacite'), ...lignes('SELECT id, texte FROM race_don'),
  ].filter((d) => critiqueDuDon(d.texte)).map((d) => d.id);
  assert.ok(donsLus.includes(SCI_DU_CRIT), 'Sci du Crit est lu');
  assert.deepEqual(regles.classes.flatMap((c) => c.dons).find((d) => d.id === SCI_DU_CRIT).critique, { postures: ['offensif'], valeur: 5 });
  // ce qui ne joue pas en permanence (Q88 : (a)) n'est jamais lu : dons actifs, « prochaine attaque », arme utilisée, situation
  for (const id of ['capacites/guerrier-tout-ou-rien', 'capacites/moine-prend-ca', 'capacites/archer-coup-mortel', 'capacites/marcass-hache-fetiche',
    'capacites/kitsune-cest-pour-moi', 'capacites/moine-vive-dieu', 'capacites/parleur-bonimenteur', 'capacites/clerc-saint-combattant']) {
    const d = db.prepare('SELECT effet FROM capacite WHERE id = ?').get(id);
    assert.ok(d, id);
    assert.equal(critiqueDuDon(d.effet), null, id);
  }
  for (const d of regles.classes.flatMap((c) => c.dons)) if (d.critique) assert.equal(d.type, 'passif', d.id);
  // acquis-texte (R104) écarte toujours la réussite critique des acquis
  const lire = lecteurDAcquis(lignes('SELECT id, nom, caracteristique_id FROM competence'));
  assert.deepEqual(lire(db.prepare('SELECT effet FROM capacite WHERE id = ?').get(SCI_DU_CRIT).effet), []);

  // accessoires : « Augmente la réussite critique de N%, peu importe le jet. », rejoué sur tous les effets
  const accessoires = lignes('SELECT id, libelle FROM accessoire_effet').filter((a) => critiqueDeLAccessoire(a.libelle) !== null).map((a) => a.id);
  assert.ok(accessoires.includes(ACCESSOIRE));
  assert.equal(regles.accessoires.find((a) => a.id === ACCESSOIRE).critique, critiqueDeLAccessoire(db.prepare('SELECT libelle FROM accessoire_effet WHERE id = ?').get(ACCESSOIRE).libelle));
  assert.equal(critiqueDeLAccessoire('Augmente la réussite critique de 1%, peu importe le jet.'), 1);
});

test('R180 (1) : le palier se lit sur le score du moment — 95 : 0 ; 96 et 102 : +2 ; 103, 115 et 120 : +5', () => {
  const k = { id: 'medecine' };
  for (const [score, attendu] of [[95, 0], [96, 2], [102, 2], [103, 5], [115, 5], [120, 5]]) {
    const c = M.critiqueDe(regles, null, k, score);
    assert.equal(c.bonus, attendu, `score ${score}`);
    assert.equal(c.plage, 5 + attendu, `score ${score}`);
  }
  // par la fiche : sans posture, sur tout jet
  for (const [score, attendu] of [[95, 0], [96, 2], [102, 2], [103, 5], [115, 5], [120, 5]]) {
    const c = competence(avecScores(fiche(), { medecine: score }), 'medecine');
    assert.deepEqual([c.scoreDuMoment, c.critique.bonus], [score, attendu], `score ${score}`);
  }
  assert.deepEqual(M.lignesDuCritique(competence(avecScores(fiche(), { medecine: 100 }), 'medecine').critique),
    ['Réussite critique : +2 % (1 à 7)', '+2 % (score de 96 à 102 %)']);
  assert.deepEqual(M.lignesDuCritique(competence(avecScores(fiche(), { medecine: 95 }), 'medecine').critique), [], 'rien sans bonus');
});

test('R180 : l’exemple du propriétaire — 113 sur une compétence d’attaque en Offensif donne 103, +5 de palier et +5 d’Offensif : « +10 % (1 à 15) »', () => {
  const f = avecScores(fiche({ posture_id: POSTURE('offensif') }), { 'arme-legere': 113 });
  const c = competence(f, 'arme-legere');
  assert.deepEqual([c.score, c.posture, c.scoreDuMoment], [113, -10, 103]);
  assert.deepEqual(origines(c), [['palier', 5], ['posture', 5]]);
  assert.deepEqual([c.critique.bonus, c.critique.plage, c.critique.rogne], [10, 15, 0]);
  assert.deepEqual(M.lignesDuCritique(c.critique), [
    'Réussite critique : +10 % (1 à 15)', '+5 % (score de 103 % et plus)', '+5 % (posture Offensif)',
  ]);
  // le score de la fiche (tableur) ne change pas
  assert.equal(competence(avecScores(fiche(), { 'arme-legere': 113 }), 'arme-legere').score, 113);
});

test('R180 : le Focus (+10 %) fait passer 93 à 103 et donne le palier de +5', () => {
  const sans = competence(avecScores(fiche(), { medecine: 93 }), 'medecine');
  assert.deepEqual([sans.scoreDuMoment, sans.critique.bonus], [93, 0]);
  const focus = competence(avecScores(fiche({ posture_id: POSTURE('focus') }), { medecine: 93 }), 'medecine');
  assert.deepEqual([focus.scoreDuMoment, focus.critique.bonus], [103, 5]);
  assert.deepEqual(origines(focus), [['palier', 5]]);
});

test('R180 (4) : le Défensif ne donne son +5 qu’à Esquive et Parade', () => {
  const cs = M.competencesDe(regles, fiche({ posture_id: POSTURE('defensif') }));
  for (const c of cs) {
    const attendu = ['esquive', 'parade'].includes(c.id) ? [['posture', 5]] : [];
    assert.deepEqual(origines(c), attendu, c.id);
  }
  assert.deepEqual(M.lignesDuCritique(cs.find((c) => c.id === 'parade').critique), ['Réussite critique : +5 % (1 à 10)', '+5 % (posture Défensif)']);
});

test('R180 (3) : en Offensif, les six jets ont +5 ; Concentration sans le −10 ; Médecine rien', () => {
  const cs = Object.fromEntries(M.competencesDe(regles, fiche({ posture_id: POSTURE('offensif') })).map((c) => [c.id, c]));
  for (const c of Object.values(cs)) {
    const six = [...COMPETENCES_D_ATTAQUE, 'concentration'].includes(c.id);
    assert.deepEqual(origines(c), six ? [['posture', 5]] : [], c.id);
  }
  assert.deepEqual([cs.concentration.posture, cs.concentration.critique.bonus], [0, 5]);
  assert.deepEqual([cs.medecine.posture, cs.medecine.critique.bonus], [0, 0]);
  assert.deepEqual([cs.arc.posture, cs.arc.critique.bonus], [-10, 5]);
});

test('R180, R172 : le Mode Hyper 100 % cumule l’Offensif et le Défensif, sans le −10', () => {
  const f = avecScores(fiche({ xp: xpDuNiveau(10), mode_hyper: 1, mode_hyper_100: 1, posture_id: POSTURE('neutre') }), { arc: 93 });
  assert.ok(M.postureDuMoment(regles, f).cent);
  const cs = Object.fromEntries(M.competencesDe(regles, f).map((c) => [c.id, c]));
  // Arc : 93 + 10 du Focus, sans le −10 de l'Offensif (un inconvénient) = 103 : palier +5, Offensif +5
  assert.deepEqual([cs.arc.posture, cs.arc.scoreDuMoment], [10, 103]);
  assert.deepEqual(origines(cs.arc), [['palier', 5], ['posture', 5]]);
  assert.deepEqual(M.lignesDuCritique(cs.arc.critique), [
    'Réussite critique : +10 % (1 à 15)', '+5 % (score de 103 % et plus)', '+5 % (posture Offensif, Mode Hyper 100 %)',
  ]);
  for (const id of ['esquive', 'parade']) assert.deepEqual(origines(cs[id]), [['posture', 5]], id);
  assert.deepEqual(origines(cs.concentration), [['posture', 5]]);
  assert.deepEqual(origines(cs.medecine), []);
});

test('R180 (4), Q90 : Sci du Crit compte en Offensif (et au Mode Hyper 100 %) sur les six jets, jamais hors Offensif ni sur Médecine', () => {
  const offensif = Object.fromEntries(M.competencesDe(regles, heros({ posture_id: POSTURE('offensif') })).map((c) => [c.id, c]));
  for (const id of deLaBase('offensif', 'don_de_posture')) assert.ok(origines(offensif[id]).some(([o, v]) => o === 'don' && v === 5), id);
  assert.deepEqual(origines(offensif.concentration), [['posture', 5], ['don', 5]]);
  assert.deepEqual(M.lignesDuCritique(offensif.concentration.critique), ['Réussite critique : +10 % (1 à 15)', '+5 % (posture Offensif)', '+5 % (Sci du Crit)']);
  assert.deepEqual(origines(offensif.medecine), []);
  // hors Offensif : rien
  for (const slug of ['neutre', 'defensif', 'focus']) {
    for (const c of M.competencesDe(regles, heros({ posture_id: POSTURE(slug) }))) assert.ok(!c.critique.origines.some((o) => o.origine === 'don'), `${slug} : ${c.id}`);
  }
  for (const c of M.competencesDe(regles, heros())) assert.ok(!c.critique.origines.some((o) => o.origine === 'don'), `sans posture : ${c.id}`);
  // le don non acquis (pas choisi) ne compte pas
  assert.deepEqual(origines(competence(heros({ posture_id: POSTURE('offensif'), capacites: [] }), 'arc')), [['posture', 5]]);
  // au Mode Hyper 100 % : toutes les postures sont actives
  const cent = competence(heros({ mode_hyper: 1, mode_hyper_100: 1 }), 'arc');
  assert.ok(cent.critique.origines.some((o) => o.origine === 'don' && o.nom === 'Sci du Crit'));
});

test('R180 (4) : l’accessoire « peu importe le jet » ajoute son +1 à toutes les compétences', () => {
  const f = fiche({ accessoires: [{ emplacement: 'collier', accessoire_effet_id: ACCESSOIRE, valeur: null, maudit: 0 }] });
  for (const c of M.competencesDe(regles, f)) assert.deepEqual(origines(c), [['accessoire', 1]], c.id);
  assert.deepEqual(M.lignesDuCritique(competence(f, 'medecine').critique), ['Réussite critique : +1 % (1 à 6)', '+1 % (Accessoire : Collier)']);
});

test('R180 (4), R54 : l’accessoire maudit a l’effet contraire — −1 % de réussite critique, affiché puisque le bonus n’est pas nul', () => {
  const f = fiche({ accessoires: [{ emplacement: 'collier', accessoire_effet_id: ACCESSOIRE, valeur: null, maudit: 1 }] });
  for (const c of M.competencesDe(regles, f)) assert.deepEqual(origines(c), [['accessoire', -1]], c.id);
  const c = competence(f, 'medecine').critique;
  assert.equal(c.bonus, -1);
  assert.equal(c.plage, 4);
  const lignes = M.lignesDuCritique(c);
  assert.deepEqual(lignes, ['Réussite critique : -1 % (1 à 4)', '-1 % (Accessoire : Collier)']);
});

test('R180 (2) : le plafond — palier 5 + Offensif 5 + Sci du Crit 5 + accessoire 1 donnent +10 (1 à 15), la mention du plafond', () => {
  const f = avecScores(heros({ posture_id: POSTURE('offensif'), accessoires: [{ emplacement: 'bague-1', accessoire_effet_id: ACCESSOIRE, valeur: null, maudit: 0 }] }), { arc: 120 });
  const c = competence(f, 'arc');
  assert.equal(c.scoreDuMoment, 110);
  assert.deepEqual(origines(c), [['palier', 5], ['posture', 5], ['don', 5], ['accessoire', 1]]);
  assert.deepEqual([c.critique.brut, c.critique.bonus, c.critique.rogne, c.critique.plage], [16, 10, 6, 15]);
  assert.deepEqual(M.lignesDuCritique(c.critique), [
    'Réussite critique : +10 % (1 à 15)', '+5 % (score de 103 % et plus)', '+5 % (posture Offensif)', '+5 % (Sci du Crit)', '+1 % (Accessoire : Bague 1)',
    'Plafond : +16 % ramené à +10 % (jamais plus de 1 à 15)',
  ]);
});

test('R180 : une compétence à deux croix (inutilisable, R19) n’a pas de réussite critique', () => {
  const k = regles.competences.find((x) => x.id === 'arc');
  const f = heros({ posture_id: POSTURE('offensif'), caracteristiques: [{ caracteristique_id: k.caracteristique_id, base: 4, croix: 2 }] });
  const c = competence(f, 'arc');
  assert.deepEqual([c.score, c.critique], [null, null]);
  assert.deepEqual(M.lignesDuCritique(c.critique), []);
});
