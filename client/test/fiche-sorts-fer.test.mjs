// Les sorts fer sur la fiche de personnage (décision R164, sur le modèle des sorts grenades de R114) : « ... Brutale » (Mage Vert, spécialité Mage
// Émeraude, niveau 10, passif) écrit « (Posture Focus) Les enchantements d'armes sont augmentés de +2 », avec la note « Les sorts "fer" » ; règle du
// propriétaire, « +2 dégâts en Focus » : +2 aux dégâts des sorts étiquetés « Sort fer » (sort_mot_cle, migration 0079), en posture Focus seulement.
// lib/sort-bonus-texte.mjs lit « les enchantements d'armes » comme les sorts de l'étiquette (ETIQUETTES_DES_SORTS), jamais par le nom d'un sort ni par
// le nom du don ; lib/fiche-moteur.mjs#sortDuMoment ajoute le bonus au « +8 dégâts » d'un sort d'amplification qui porte l'étiquette. La lecture est
// rejouée sur tous les textes que la fiche lit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { bonusDeSortsEcrits, ETIQUETTES_DES_SORTS } from '../src/lib/sort-bonus-texte.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const POSTURE = (slug) => `guide/postures#posture:${slug}`;
const auNm = (s, nm = 0) => Object.fromEntries(['cout', 'portee', 'dsb', 'effets'].map((c) => [c, valeurAuNm(s[c], s.bonus ?? [], c, nm) ?? '']));
const ceinture = (...noms) => ({ ceinture: noms.map((nom, i) => ({ rang: i + 1, nom, quantite: 1, ressource_id: null })) });
const sortDe = (id) => {
  const s = regles.sorts.find((x) => x.id === id);
  assert.ok(s, id);
  return s;
};
const BRUTALE = 'capacites/mage-vert-brutale';
const NOM = '... Brutale (Mage Vert)';
const FER_BRULANT = 'magies/magie-du-feu#sort:fer-brulant';
const LECTURE = [{ cible: 'degats', valeur: 2, vises: { mots_cles: ['sort-fer'] }, posture: 'focus' }];

/**
 * Un Mage Vert, spécialité Mage Émeraude, « ... Brutale » choisi, au niveau de classe `niveau` (mode bi-classé : le niveau de classe est le niveau
 * global, ce qui donne aussi le niveau 9), dans la posture `posture` (un slug, ou null).
 */
const mageEmeraude = (niveau, posture, x = {}) => ({
  ...ficheVide('Émeraude'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', mode_classe: 'bi', xp: xpDuNiveau(niveau),
  classes: [{ rang: 1, classe_id: 'classes/mage-vert', specialite_id: 'classes/mage-vert#specialite:mage-emeraude' }],
  capacites: [{ capacite_id: BRUTALE }], posture_id: posture && POSTURE(posture), ...x,
});

test('R164 : « ... Brutale » se lit +2 aux dégâts des sorts étiquetés « Sort fer », en posture Focus (bonusDeSortsEcrits, regles.json)', () => {
  const don = regles.classes.find((c) => c.id === 'classes/mage-vert').dons.find((d) => d.id === BRUTALE);
  assert.equal(don.effet, "(Posture Focus)\nLes enchantements d'armes sont augmentés de +2");
  assert.deepEqual([don.niveau, don.nature, don.type, don.specialite_id], [10, 'choix', 'passif', 'classes/mage-vert#specialite:mage-emeraude']);
  assert.deepEqual(bonusDeSortsEcrits(don.effet), LECTURE);
  assert.deepEqual(don.sorts, LECTURE);
  // l'étiquette lue est celle de la base, posée sur les 13 sorts « Fer… » (le nom du sort ne compte pas : voir le test du moteur)
  assert.ok(ETIQUETTES_DES_SORTS.some(([id]) => id === 'sort-fer'));
  assert.equal(regles.sorts.filter((s) => s.mots_cles?.includes('sort-fer')).length, 13);
  // les écritures que la décision donne aux sorts fer (la note de Brutale, « Jongleur Magique ») visent aussi l'étiquette
  assert.deepEqual(bonusDeSortsEcrits('Les sorts "fer" font +3 dégâts.'), [{ cible: 'degats', valeur: 3, vises: { mots_cles: ['sort-fer'] } }]);
  assert.deepEqual(bonusDeSortsEcrits('Les sorts de Fer Élémentaire font +3 dégâts.'), [{ cible: 'degats', valeur: 3, vises: { mots_cles: ['sort-fer'] } }]);
  // une phrase sur les armes reste exclue (« les enchantements d'armes » ne sont que le nom d'une étiquette) ; une phrase sur les sorts fer et les armes
  // aussi (« Jongleur Magique » : rien à compter)
  assert.deepEqual(bonusDeSortsEcrits('Les armes infligent +2 dégâts aux sorts.'), []);
  // seule l'écriture de Brutale, au pluriel : un « enchantement d'arme » n'est pas un sort fer ; l'augmentation ne se lit que pour les sorts fer (R164),
  // pas pour une autre étiquette
  assert.deepEqual(bonusDeSortsEcrits("L'enchantement d'arme de l'objet donne +2 dégâts."), []);
  assert.deepEqual(bonusDeSortsEcrits("(Posture Focus) L'enchantement d'arme est augmenté de +2"), []);
  assert.deepEqual(bonusDeSortsEcrits('Les sorts grenades sont augmentés de +2'), []);
  assert.deepEqual(bonusDeSortsEcrits(regles.classes.flatMap((c) => c.dons).find((d) => d.id === 'capacites/lanceur-jongleur-magique').effet), []);
});

test('R164 : rejouée sur tous les textes que la fiche lit, la lecture des sorts fer ne donne un bonus qu’à « ... Brutale »', () => {
  // ceux que lib/fiche-regles.mjs passe à bonusDeSortsEcrits : les dons de classe (effet ; tous, pas seulement les passifs), les dons de race (texte), les
  // effets des armures élémentaires
  const textes = [
    ...lignes('SELECT id, effet AS texte FROM capacite WHERE effet IS NOT NULL'),
    ...lignes('SELECT id, texte FROM race_don WHERE texte IS NOT NULL'),
    ...lignes('SELECT armure_elementaire_id AS id, texte FROM armure_elementaire_effet WHERE texte IS NOT NULL'),
  ];
  assert.ok(textes.length > 500, `${textes.length} textes`);
  const visent = textes.filter((t) => bonusDeSortsEcrits(t.texte).some((b) => b.vises?.mots_cles?.includes('sort-fer'))).map((t) => t.id);
  assert.deepEqual(visent, [BRUTALE]);
  // dans regles.json : seul Brutale porte un bonus des sorts fer (dons de classe et de race, armures élémentaires)
  const portent = [
    ...regles.classes.flatMap((c) => c.dons).filter((d) => d.sorts?.some((b) => b.vises?.mots_cles?.includes('sort-fer'))).map((d) => d.id),
    ...regles.races.flatMap((r) => r.dons ?? []).filter((d) => d.sorts?.some((b) => b.vises?.mots_cles?.includes('sort-fer'))).map((d) => d.id),
    ...regles.armures_elementaires.filter((e) => e.sorts?.some((b) => b.vises?.mots_cles?.includes('sort-fer'))).map((e) => e.id),
  ];
  assert.deepEqual(portent, [BRUTALE]);
});

test('R164 : un Mage Émeraude de niveau de classe 10 en Focus fait « +10 dégâts » avec un sort fer ; « +8 » hors Focus et sans le don (niveau 9)', () => {
  const fer = sortDe(FER_BRULANT);
  assert.deepEqual([fer.dsb, fer.types, fer.mots_cles], ['+8 dégâts', ['amplification'], ['sort-fer']]);
  assert.equal(M.classesDe(regles, mageEmeraude(10, 'focus'))[0].niveau, 10);
  // en Focus : +2, sous la forme des autres sources (le nom du don et sa classe) ; rien de non compté
  const focus = M.sortDuMoment(regles, mageEmeraude(10, 'focus'), fer, auNm(fer));
  assert.equal(focus.dsb.texte, '+10 dégâts');
  assert.deepEqual(focus.dsb.detail, [{ nom: NOM, valeur: 2 }]);
  assert.ok(focus.dsb.lu);
  assert.deepEqual(focus.nonComptes, []);
  // les 13 sorts fer, Fer corrompu compris : +10 en Focus (ses « 5 points de corruption » restent du texte)
  for (const s of regles.sorts.filter((x) => x.mots_cles?.includes('sort-fer'))) {
    const m = M.sortDuMoment(regles, mageEmeraude(10, 'focus'), s, auNm(s));
    assert.equal(m.dsb.texte, '+10 dégâts', s.id);
    assert.equal(m.effets.texte, auNm(s).effets, `${s.id} : l'effet tel qu'écrit`);
  }
  // hors Focus : « +8 », le bonus dit non compté dans une autre posture, comme tout bonus d'une posture (décision R100)
  for (const posture of [null, 'offensif', 'defensif', 'vigilance', 'symbiose']) {
    const m = M.sortDuMoment(regles, mageEmeraude(10, posture), fer, auNm(fer));
    assert.equal(m.dsb.texte, '+8 dégâts', String(posture));
    assert.deepEqual(m.dsb.detail, [], String(posture));
    assert.deepEqual(m.nonComptes, [{ nom: NOM, valeur: 2, raison: 'posture', cible: 'dsb' }], String(posture));
  }
  // sans le don : niveau de classe 9 (il n'est pas débloqué), ou le don non choisi
  for (const f of [mageEmeraude(9, 'focus'), mageEmeraude(10, 'focus', { capacites: [] })]) {
    const m = M.sortDuMoment(regles, f, fer, auNm(fer));
    assert.equal(m.dsb.texte, '+8 dégâts');
    assert.deepEqual([m.dsb.detail, m.nonComptes], [[], []]);
  }
});

test('R164 : en Focus, un autre sort d’amplification sans l’étiquette ne reçoit rien ; l’étiquette fait le sort fer, pas son nom', () => {
  const fer = sortDe(FER_BRULANT);
  const f = mageEmeraude(10, 'focus');
  const autres = regles.sorts.filter((s) => s.types.includes('amplification') && !s.mots_cles?.includes('sort-fer') && /\+\d+\s*dégâts/i.test(auNm(s).dsb));
  assert.ok(autres.length > 0, 'des sorts d’amplification « +N dégâts » sans l’étiquette');
  for (const s of autres) {
    const m = M.sortDuMoment(regles, f, s, auNm(s));
    assert.equal(m.dsb.texte, auNm(s).dsb, s.id);
    assert.ok(!m.dsb.detail.some((x) => x.nom === NOM) && !m.nonComptes.some((x) => x.nom === NOM), s.id);
  }
  // sans l'étiquette, un sort fer n'a rien ; avec elle, un autre sort d'amplification a les +2
  assert.equal(M.sortDuMoment(regles, f, { ...fer, mots_cles: undefined }, auNm(fer)).dsb.texte, '+8 dégâts');
  const autre = autres[0];
  const avec = M.sortDuMoment(regles, f, { ...autre, mots_cles: ['sort-fer'] }, auNm(autre));
  assert.ok(avec.dsb.detail.some((x) => x.nom === NOM && x.valeur === 2), JSON.stringify(avec.dsb));
  // un sort d'attaque : rien (le bonus vise les sorts de l'étiquette)
  const boule = sortDe('magies/magie-du-feu#sort:boule-de-feu');
  const b = M.sortDuMoment(regles, f, boule, auNm(boule));
  assert.ok(!b.dsb.detail.some((x) => x.nom === NOM) && !b.nonComptes.some((x) => x.nom === NOM));
});

test('R164 : un sort (fabriqué) d’amplification et d’attaque ne dit qu’une fois le bonus de « ... Brutale » non compté hors Focus', () => {
  const fer = sortDe(FER_BRULANT);
  const double = { ...fer, types: ['amplification', 'attaque'], attaque: true };
  const m = M.sortDuMoment(regles, mageEmeraude(10, null), double, auNm(double));
  assert.equal(m.dsb.texte, '+8 dégâts');
  assert.deepEqual(m.nonComptes.filter((x) => x.nom === NOM), [{ nom: NOM, valeur: 2, raison: 'posture', cible: 'dsb' }]);
  const focus = M.sortDuMoment(regles, mageEmeraude(10, 'focus'), double, auNm(double));
  assert.equal(focus.dsb.texte, '+10 dégâts');
  assert.ok(!focus.nonComptes.some((x) => x.nom === NOM));
});

test('R164 : les bonus fixes déjà comptés (le bâton « Sort qui amplifie dégâts ») restent cumulés avec « ... Brutale »', () => {
  const fer = sortDe(FER_BRULANT);
  const baton = regles.ceinture.batons.find((x) => x.effets?.some((e) => e.cle === 'ampli_degats'));
  assert.ok(baton, 'un bâton qui amplifie les dégâts');
  const ampli = baton.effets.find((e) => e.cle === 'ampli_degats').valeur;
  const sansDon = M.sortDuMoment(regles, mageEmeraude(9, 'focus', ceinture(baton.nom)), fer, auNm(fer));
  assert.equal(sansDon.dsb.texte, `+${8 + ampli} dégâts`);
  const m = M.sortDuMoment(regles, mageEmeraude(10, 'focus', ceinture(baton.nom)), fer, auNm(fer));
  assert.equal(m.dsb.texte, `+${8 + 2 + ampli} dégâts`);
  assert.deepEqual(m.dsb.detail.map((x) => x.nom), [NOM, baton.nom]);
  const horsFocus = M.sortDuMoment(regles, mageEmeraude(10, null, ceinture(baton.nom)), fer, auNm(fer));
  assert.equal(horsFocus.dsb.texte, `+${8 + ampli} dégâts`);
});
