// La réussite critique après la décision R182 (suite de R180) sur la fiche de personnage :
// - (3) « Sci du Crit » (« (Posture Offensif) Augmente la réussite critique de +5%. ») ne compte que pour les jets d'attaque faits avec une arme de
//   contact (Q90 : « Tout jet d'attaque au corps à corps » ; familles de contact, R127, R151) : il dépend de l'arme utilisée (R128), et la fiche le
//   mentionne seulement (« Le mentionner seulement »), dans l'infobulle du score des compétences des armes de contact, jamais dans le total ;
// - (4) le critique d'un sort préparé est celui de la préparation (Q91) : la plage de Concentration à cet instant, enregistrée
//   (personnage_sort.prepare_critique, migration 0089), affichée « Réussite critique : 1 à N (figée à la préparation) », sans verdict sur le jet ;
//   « Lâcher le sort » et « Fin de combat » l'effacent ; une fiche d'avant (NULL) n'est jamais recalculée ;
// - (5) « Double coup » (Mage Rouge et Mage Vert, niveau 20) : un rappel dans le bloc, sans calcul, lu dans la remarque du don.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { critiqueDuDon, critiqueDuPremierCoup } from '../src/lib/critique-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { lireSortPrepare, texteDuSortPrepare } from '../src/lib/fiche-tableur-export.mjs';
import { competencesDArme } from '../src/lib/arme-champs.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const POSTURE = (slug) => `guide/postures#posture:${slug}`;
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const SCI_DU_CRIT = 'capacites/martiale-sci-du-crit';
const DOUBLE_COUP = ['capacites/mage-rouge-double-coup', 'capacites/mage-vert-double-coup'];
const BOULE_DE_FEU = 'magies/magie-du-feu#sort:boule-de-feu';
const MENTION = 'Sci du Crit : +5 % avec une arme de contact (non compté)';
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', ...x });
/** Martiale, Héros, niveau 15, avec Sci du Crit. */
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
/**
 * Un Mage Rouge (Rubis, « Préparation ») mono-classe de niveau global `niveau` (niveau de classe 2 × `niveau`, R2 : au niveau 10, son niveau de classe
 * 20 lui donne Double coup), Feu inné, la Boule de feu dans ses sorts, Concentration à `concentration` (score de fiche).
 */
const mageRouge = (niveau, x = {}, concentration = 100) => avecScores({
  ...fiche({ xp: xpDuNiveau(niveau) }),
  classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: 'classes/mage-rouge#specialite:mage-rubis' }],
  sorts: [{ sort_id: BOULE_DE_FEU, rang: 1, niveau_maitrise: 0 }, { sort_id: 'magies/magie-du-feu#sort:etincelle', rang: 2, niveau_maitrise: 0 }], ...x,
}, { concentration });
/** La fiche après la préparation de la Boule de feu dans l'état de `f`, puis passée à l'état `apres`. */
const preparePuis = (f, apres = {}) => ({ ...f, sorts: M.sortsApresPreparation(regles, f, BOULE_DE_FEU), ...apres });

// ------------------------------------------------------------------ (3) Sci du Crit : mentionné, jamais compté

test('R182 (3) : les compétences des armes de contact viennent des familles « contact » de la base (R127, R151) — Arme légère et Arme lourde', () => {
  const contact = new Set(lignes(`SELECT a.competence_brut FROM arme a JOIN arme_famille f ON f.id = a.famille_id WHERE f.categorie = 'contact'`)
    .flatMap((a) => competencesDArme(a.competence_brut).map((k) => k.id)));
  assert.deepEqual(M.competencesDeContact(regles), regles.competences.map((k) => k.id).filter((id) => contact.has(id)));
  assert.deepEqual([...M.competencesDeContact(regles)].sort(), ['arme-legere', 'arme-lourde'], 'l’exemple de la décision');
});

test('R182 (3), Q90 : Sci du Crit, en Offensif, est mentionné sur Arme légère et Arme lourde, hors du total ; rien sur les autres compétences', () => {
  assert.deepEqual(critiqueDuDon(db.prepare('SELECT effet FROM capacite WHERE id = ?').get(SCI_DU_CRIT).effet), { postures: ['offensif'], valeur: 5 });
  const cs = M.competencesDe(regles, heros({ posture_id: POSTURE('offensif') }));
  for (const c of cs) {
    const contact = ['arme-legere', 'arme-lourde'].includes(c.id);
    assert.deepEqual(c.critique.mentions, contact ? [{ nom: 'Sci du Crit', valeur: 5 }] : [], c.id);
    assert.ok(!c.critique.origines.some((o) => o.nom === 'Sci du Crit'), `${c.id} : jamais compté`);
    assert.equal(M.lignesDuCritique(c.critique).includes(MENTION), contact, c.id);
  }
  // Arme lourde en Offensif, sans palier : le +5 de la posture seul compté, la mention à la suite
  const lourde = cs.find((c) => c.id === 'arme-lourde');
  assert.deepEqual([lourde.critique.bonus, lourde.critique.plage], [5, 10]);
  assert.deepEqual(M.lignesDuCritique(lourde.critique), ['Réussite critique : +5 % (1 à 10)', '+5 % (posture Offensif)', MENTION]);
  // Concentration, Arc, Arbalète, Magie : le +5 de l'Offensif, sans mention (pas des armes de contact ; un sort jamais)
  for (const id of ['concentration', 'arc', 'arbalete', 'magie']) {
    assert.deepEqual(M.lignesDuCritique(cs.find((c) => c.id === id).critique), ['Réussite critique : +5 % (1 à 10)', '+5 % (posture Offensif)'], id);
  }
});

test('R182 (3) : Sci du Crit hors Offensif — rien ; au Mode Hyper 100 % — mentionné ; sans le don — rien', () => {
  for (const slug of [null, 'neutre', 'defensif', 'focus', 'vigilance']) {
    for (const c of M.competencesDe(regles, heros({ posture_id: slug && POSTURE(slug) }))) {
      assert.deepEqual(c.critique?.mentions ?? [], [], `${slug} : ${c.id}`);
      assert.ok(!M.lignesDuCritique(c.critique).includes(MENTION), `${slug} : ${c.id}`);
    }
  }
  const cent = Object.fromEntries(M.competencesDe(regles, heros({ mode_hyper: 1, mode_hyper_100: 1 })).map((c) => [c.id, c]));
  assert.ok(M.postureDuMoment(regles, heros({ mode_hyper: 1, mode_hyper_100: 1 })).cent);
  assert.deepEqual(M.lignesDuCritique(cent['arme-legere'].critique),
    ['Réussite critique : +5 % (1 à 10)', '+5 % (posture Offensif, Mode Hyper 100 %)', MENTION]);
  assert.deepEqual(cent.arc.critique.mentions, []);
  for (const c of M.competencesDe(regles, heros({ posture_id: POSTURE('offensif'), capacites: [] }))) assert.deepEqual(c.critique.mentions, [], c.id);
});

// ------------------------------------------------------------------ (4) la plage figée du sort préparé

test('R182 (4) : la compétence de la plage figée est Concentration (regles.sort_prepare), une compétence de la base', () => {
  assert.equal(regles.sort_prepare.competence_id, 'concentration');
  assert.ok(regles.competences.some((k) => k.id === regles.sort_prepare.competence_id));
});

test('R182 (4), Q91 : préparé en Offensif avec Concentration à 100 % — 5 + 2 + 5 = 12, figé ; passé en Neutre, le bloc dit toujours 12, l’infobulle de Concentration la plage du moment', () => {
  const offensif = mageRouge(10, { posture_id: POSTURE('offensif') });
  const conc = competence(offensif, 'concentration');
  assert.deepEqual([conc.scoreDuMoment, conc.critique.plage], [100, 12]);
  assert.equal(M.critiqueAlaPreparation(regles, offensif), 12);
  const prepare = preparePuis(offensif);
  assert.deepEqual(prepare.sorts.map((l) => [l.sort_id, l.prepare, l.prepare_critique]), [[BOULE_DE_FEU, 1, 12], ['magies/magie-du-feu#sort:etincelle', 0, null]]);
  // passé en Neutre : la plage figée ne bouge pas ; Concentration montre celle du moment (Neutre « +5% pour jet de V ou S » : 105, palier +5, sans
  // l'Offensif : 1 à 10)
  const neutre = { ...prepare, posture_id: POSTURE('neutre') };
  assert.equal(M.sortPrepare(regles, neutre).critique, 12);
  assert.equal(M.texteDuCritiquePrepare(M.sortPrepare(regles, neutre)), 'Réussite critique : 1 à 12 (figée à la préparation)');
  assert.equal(competence(neutre, 'concentration').scoreDuMoment, 105);
  assert.deepEqual(M.lignesDuCritique(competence(neutre, 'concentration').critique), ['Réussite critique : +5 % (1 à 10)', '+5 % (score de 103 % et plus)']);
  // sans posture : le palier de 100, +2 (1 à 7) ; le bloc dit toujours 12
  const sans = { ...prepare, posture_id: null };
  assert.deepEqual([competence(sans, 'concentration').critique.plage, M.sortPrepare(regles, sans).critique], [7, 12]);
  // le jet noté ne change rien à la plage (aucun verdict) ; l'enregistrement la garde, sur le sort préparé seul
  const jet = { ...neutre, sorts: M.sortsApresLeJet(regles, neutre, '3') };
  assert.equal(M.texteDuCritiquePrepare(M.sortPrepare(regles, jet)), 'Réussite critique : 1 à 12 (figée à la préparation)');
  assert.deepEqual(M.sortsAEnregistrer(regles, jet).map((l) => [l.prepare_jet, l.prepare_critique]), [[3, 12], [null, null]]);
});

test('R182 (4), R172 : préparé au Mode Hyper 100 %, la plage de cet instant (Focus +10 : 93 → 103, palier +5, Offensif +5 : 1 à 15), gardée après sa fin', () => {
  const cent = mageRouge(10, { posture_id: POSTURE('neutre'), mode_hyper: 1, mode_hyper_100: 1 }, 93);
  const prepare = preparePuis(cent);
  assert.deepEqual(prepare.sorts.slice(0, 1).map((l) => [l.prepare_hyper, l.prepare_cent, l.prepare_critique]), [[1, 1, 15]]);
  const apres = { ...prepare, mode_hyper: 0, mode_hyper_100: 0 };
  assert.equal(competence(apres, 'concentration').critique.plage, 7, 'le moment : 93 + 5 du Neutre = 98, +2');
  assert.equal(M.sortPrepare(regles, apres).critique, 15);
  // hors posture et hors Mode Hyper, sans palier : 1 à 5
  assert.equal(preparePuis(mageRouge(10, {}, 90)).sorts[0].prepare_critique, 5);
});

test('R182 (4), R179 : « Lâcher le sort », « Fin de combat » et un autre sort sur la ligne effacent la plage figée ; préparer de nouveau prend la plage du nouvel instant', () => {
  const prepare = preparePuis(mageRouge(10, { posture_id: POSTURE('offensif') }));
  assert.equal(prepare.sorts[0].prepare_critique, 12);
  assert.deepEqual(M.sortsApresPreparation(regles, prepare, null).map((l) => [l.prepare, l.prepare_critique]), [[0, null], [0, null]], 'Lâcher le sort');
  assert.deepEqual(M.finDeCombat(regles, prepare).sorts.map((l) => [l.prepare, l.prepare_critique]), [[0, null], [0, null]], 'Fin de combat');
  assert.deepEqual(M.sortsApresChoixDEmplacement(prepare, 0, 'magies/magie-du-feu#sort:etincelle')[0].prepare_critique, null, 'un autre sort sur la ligne');
  // préparer un autre sort : la plage de ce nouvel instant
  const neutre = { ...prepare, posture_id: POSTURE('neutre') };
  assert.deepEqual(M.sortsApresPreparation(regles, neutre, BOULE_DE_FEU).map((l) => l.prepare_critique), [10, null]);
});

test('R182 (4) : une fiche d’avant (prepare_critique NULL ou absente) n’est jamais recalculée — pas de ligne', () => {
  const base = mageRouge(10, { posture_id: POSTURE('offensif') });
  for (const ligne of [{ prepare: 1, prepare_jet: 57, prepare_posture_id: POSTURE('offensif') }, { prepare: 1, prepare_jet: 57, prepare_posture_id: POSTURE('offensif'), prepare_critique: null }]) {
    const f = { ...base, sorts: base.sorts.map((l, i) => (i === 0 ? { ...l, ...ligne } : l)) };
    const p = M.sortPrepare(regles, f);
    assert.equal(p.critique, null);
    assert.equal(M.texteDuCritiquePrepare(p), null);
    assert.equal(M.sortsAEnregistrer(regles, f)[0].prepare_critique, null, 'enregistrée telle quelle');
  }
  assert.equal(M.texteDuCritiquePrepare(null), null, 'sans sort préparé');
});

test('R182 (4) : le tableur — « critique 1 à N » dans la note du sort préparé, relu ; sans plage, rien', () => {
  const p = M.sortPrepare(regles, preparePuis(mageRouge(10, { posture_id: POSTURE('offensif') })));
  const texte = texteDuSortPrepare({ ...p, jet: 57 });
  assert.equal(texte, 'Boule de feu (jet 57, posture Offensif, critique 1 à 12)');
  assert.deepEqual(lireSortPrepare(texte), { nom: 'Boule de feu', jet: 57, posture: 'Offensif', hyper: false, cent: false, critique: 12 });
  assert.equal(texteDuSortPrepare({ ...p, critique: null, jet: null }), 'Boule de feu (posture Offensif)');
  assert.deepEqual(lireSortPrepare('Boule de feu (critique 1 à 9, critique 1 à 10)').nom, 'Boule de feu (critique 1 à 9, critique 1 à 10)', 'deux plages : illisible');
});

// ------------------------------------------------------------------ (5) Double coup : un rappel

test('R182 (5) : la remarque de Double coup est lue dans le texte (jamais par le nom) — le Mage Rouge et le Mage Vert, et eux seuls', () => {
  const lus = lignes('SELECT id, remarque FROM capacite').filter((d) => critiqueDuPremierCoup(d.remarque)).map((d) => d.id).sort();
  assert.deepEqual(lus, DOUBLE_COUP);
  for (const id of DOUBLE_COUP) {
    const d = regles.classes.flatMap((c) => c.dons).find((x) => x.id === id);
    const lu = critiqueDuPremierCoup(db.prepare('SELECT remarque FROM capacite WHERE id = ?').get(id).remarque);
    assert.deepEqual(d.critique_premier_coup, lu, id);
    assert.equal(d.nom, 'Double coup');
  }
  assert.deepEqual(critiqueDuPremierCoup('Dans le cas d’un critique, ce sera que pour le premier coup, les prochains c’est fixé à 40 de réussite.'), { reussite: 40 });
  assert.equal(critiqueDuPremierCoup('Consomme le chakra à chaque sort.'), null);
  assert.equal(regles.classes.flatMap((c) => c.dons).filter((d) => d.critique_premier_coup).length, DOUBLE_COUP.length);
});

test('R182 (5) : le rappel de Double coup, mot pour mot, avec le don acquis (Mage Rouge, Mage Vert, les deux une fois) ; absent sans lui', () => {
  const reussite = critiqueDuPremierCoup(db.prepare('SELECT remarque FROM capacite WHERE id = ?').get(DOUBLE_COUP[0]).remarque).reussite;
  const rappel = `Seul le premier relâchement peut être un critique ; les suivants sont fixés à ${reussite} de réussite (Double coup).`;
  assert.deepEqual(M.rappelsDuSortPrepare(regles, mageRouge(10)), [rappel], 'Mage Rouge, niveau de classe 20');
  assert.deepEqual(M.rappelsDuSortPrepare(regles, mageRouge(9)), [], 'niveau de classe 18 : pas encore le don');
  const vert = mageRouge(10, { classes: [{ rang: 1, classe_id: 'classes/mage-vert', specialite_id: 'classes/mage-vert#specialite:mage-jade' }] });
  assert.deepEqual(M.rappelsDuSortPrepare(regles, vert), [rappel], 'Mage Vert');
  const bi = mageRouge(20, { mode_classe: 'bi', classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: null }, { rang: 2, classe_id: 'classes/mage-vert', specialite_id: null }] });
  assert.ok(M.donsAcquis(regles, bi).flatMap((c) => c.dons).filter((d) => DOUBLE_COUP.includes(d.id)).length === 2, 'les deux dons');
  assert.deepEqual(M.rappelsDuSortPrepare(regles, bi), [rappel], 'une seule fois');
  assert.deepEqual(M.rappelsDuSortPrepare(regles, heros()), []);
});
