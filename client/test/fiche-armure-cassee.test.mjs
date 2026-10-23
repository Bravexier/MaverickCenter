// L'armure cassée de la fiche (décisions R157 et R158) : « Une armure à cran uni tombée à 0 perd son bonus de compétence tant qu'elle n'est pas réparée »
// (R157) ; « Cassée, une armure à cran de solidité uni ne donne plus aucun de ses effets, bonus comme malus, jusqu'à sa réparation » (R158, avec un
// élément : les effets de l'armure élémentaire portée, lecture de R158). Cassée : à cran uni (`regles.armures[].solidite_uni = 1`) et à 0
// (lib/fiche-moteur.mjs#armureCassee). Une armure à six parties ne l'est jamais : seules ses parties à 0 perdent leur AP et leur AM (R108), même toutes à 0
// avec un élément (question Q12). Les armures du cahier (Robe de mage, Armure montagne) sont prises par leur identifiant ; leurs bonus, leur solidité, ceux
// de l'armure élémentaire et les dégâts des sorts sont lus dans les règles de la page (l'état courant de la base), jamais figés ici.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { CLES_DE_LA_NOTE, cellulesDeLaFiche, ligneDeNote } from '../src/lib/fiche-tableur-export.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const entier = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0); // comme le moteur : une valeur vide vaut 0
const ARMURE = (slug) => `ressources/armures#armure:${slug}`;
const robe = regles.armures.find((a) => a.id === ARMURE('robe-de-mage'));
const montagne = regles.armures.find((a) => a.id === ARMURE('armure-montagne'));
/** Le bonus « X ou Y » de la Robe de mage (« +N% Magie ou Concentration ») et celui de l'Armure montagne (« +N% Stabilité »), lus dans leur effet. */
const auChoix = robe?.acquis?.find((b) => b.choix && !b.raison);
const choisie = auChoix?.choix[0];
const fixe = montagne?.acquis?.find((b) => b.competence_id && !b.raison);
/** Une armure à six parties (pas à cran uni) de la catégorie de l'Armure montagne. */
const sixParties = regles.armures.find((a) => Number(a.solidite_uni) !== 1 && a.type === montagne?.type && a.solidite >= 2);
/** Une amélioration d'armure qui ajoute des crans de solidité (R77 : « +1 cran au +4 et au +5 »). */
const aCrans = regles.ameliorations.find((a) => a.cible === 'armure' && entier(a.bonus_cran) > 0);
/** Une armure élémentaire de la catégorie de l'Armure montagne dont l'effet donne un bonus fixe aux dégâts des sorts d'une magie, et un sort d'attaque de cette magie aux dégâts lisibles. */
const element = regles.armures_elementaires.find((e) => e.categorie === montagne?.type
  && (e.sorts ?? []).some((b) => b.cible === 'degats' && !b.raison && Number.isFinite(b.valeur) && b.vises?.magies?.length === 1));
const bonusElement = element?.sorts.find((b) => b.cible === 'degats' && !b.raison && Number.isFinite(b.valeur));
const NOM_ELEMENT = `${element?.nom} (armure élémentaire)`;
const auNm = (s, nm = 0) => Object.fromEntries(['cout', 'portee', 'dsb', 'effets'].map((c) => [c, valeurAuNm(s[c], s.bonus ?? [], c, nm) ?? '']));
const sortVise = regles.sorts.find((s) => s.magie_id === bonusElement?.vises.magies[0] && s.types?.includes('attaque') && M.lireDegatsDeSort(auNm(s).dsb)?.nature === 'degats');
const fiche = (x = {}) => ({
  ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', classes: [],
  // des caractéristiques à 6, que le plafond de R41 ne rogne pas les bonus des armures
  caracteristiques: ['force', 'volonte', 'intelligence', 'perception', 'social', 'agilite'].map((caracteristique_id) => ({ caracteristique_id, base: 6, croix: 0 })),
  ...x,
});
/** La solidité du moment de l'armure à cran uni (l'emplacement « armure-complete »). */
const uniA = (solidite) => ({ armure_parties: [{ emplacement_id: M.ARMURE_ENTIERE, solidite }] });
const competence = (f, id, r = regles) => M.competencesDe(r, f).find((k) => k.id === id);
const deLArmure = (f, id, nom, r = regles) => competence(f, id, r).donsDetail.filter((d) => d.nom === `${nom} (armure)`).map((d) => d.valeur);
/** Les dégâts du sort visé par l'armure élémentaire, sans elle et avec son bonus. */
const degatsDuSort = () => {
  const n = M.lireDegatsDeSort(auNm(sortVise).dsb);
  return { sans: M.sortDuMoment(regles, fiche(), sortVise, auNm(sortVise)).dsb.texte, avec: M.ecrireDegatsDeSort({ ...n, fixe: n.fixe + bonusElement.valeur }) };
};

test('les armures que vise le cahier, dans la base : Robe de mage et Armure montagne à cran uni, avec un bonus d’acquis au choix et un fixe ; de quoi essayer le reste', () => {
  assert.ok(robe && montagne, 'Robe de mage, Armure montagne');
  assert.deepEqual([Number(robe.solidite_uni), Number(montagne.solidite_uni)], [1, 1], 'à cran uni (R156)');
  assert.ok(auChoix && auChoix.valeur > 0 && auChoix.choix.length >= 2, 'Robe de mage : un bonus « X ou Y »');
  assert.ok(fixe && fixe.valeur > 0, 'Armure montagne : un bonus fixe');
  assert.ok(sixParties && aCrans && element && sortVise, 'une armure à six parties, une amélioration à crans, une armure élémentaire et un sort qu’elle vise');
});

test('armureCassee (R157, R158) : à cran uni et à 0 seulement ; jamais une armure à six parties, même toute à 0 ; faux sans armure', () => {
  assert.equal(M.armureCassee(regles, fiche({ armure_id: robe.id, ...uniA(0) })), true);
  assert.equal(M.armureCassee(regles, fiche({ armure_id: robe.id })), false, 'neuve');
  assert.equal(M.armureCassee(regles, fiche({ armure_id: montagne.id, ...uniA(1) })), montagne.solidite < 1, 'à 1 : abîmée, pas cassée');
  assert.equal(M.armureCassee(regles, fiche()), false, 'sans armure');
  const toutes = M.partiesDuCorps(regles).map((p) => ({ emplacement_id: p.id, solidite: 0 }));
  assert.equal(M.armureCassee(regles, fiche({ armure_id: sixParties.id, armure_parties: toutes })), false, 'six parties à 0');
  // une ligne d'une partie que l'armure à cran uni n'a pas ne la casse pas
  assert.equal(M.armureCassee(regles, fiche({ armure_id: robe.id, armure_parties: [{ emplacement_id: 'torse', solidite: 0 }] })), false);
});

test('R157 : Robe de mage, au choix de la première compétence — sans son bonus à 0 (« non compté », armure_cassee) ; compté à 1 et au maximum ; le choix gardé', () => {
  const choix = { acquis_choix: [{ source: robe.id, rang: 1, competence_id: choisie, valeur: null }] };
  // avec l'amélioration à crans, le maximum dépasse 1 (R77) : on la voit à 1 sans être au maximum
  const ameliore = { armure_amelioration_id: aCrans.id };
  const max = M.soliditeMaxDeLArmure(regles, { armure_id: robe.id, ...ameliore });
  assert.equal(max, entier(robe.solidite) + entier(aCrans.bonus_cran));
  assert.ok(max > 1, `maximum ${max}`);
  for (const [nom, x] of [['au maximum', {}], ['à 1, améliorée', { ...ameliore, ...uniA(1) }], ['au maximum, améliorée', { ...ameliore, ...uniA(max) }]]) {
    const f = fiche({ armure_id: robe.id, ...choix, ...x });
    assert.deepEqual(deLArmure(f, choisie, robe.nom), [auChoix.valeur], nom);
    assert.ok(!M.acquisDesDons(regles, f).nonComptes.some((n) => n.raison === 'armure_cassee'), nom);
  }
  const cassee = fiche({ armure_id: robe.id, ...choix, ...uniA(0) });
  assert.deepEqual(deLArmure(cassee, choisie, robe.nom), [], 'cassée : rien');
  const a = M.acquisDesDons(regles, cassee);
  assert.deepEqual(a.nonComptes.filter((n) => n.nom === `${robe.nom} (armure)`).map((n) => [n.valeur, n.raison]), robe.acquis.map((b) => [b.valeur ?? b.plafond, 'armure_cassee']));
  // plus de choix au tiroir ni de choix en attente pour elle…
  assert.ok(!a.choix.some((c) => c.source === robe.id));
  const enAttente = (x) => M.choixEnAttente(regles, fiche({ armure_id: robe.id, ...x })).filter((c) => c.nature === 'acquis' && c.libelle.includes(robe.nom));
  assert.equal(enAttente({}).length, 1, 'neuve : à choisir');
  assert.deepEqual(enAttente(uniA(0)), [], 'cassée : rien à choisir');
  // … mais le choix enregistré (personnage_acquis_choix) est gardé, et recompte une fois réparée
  assert.deepEqual(M.acquisChoixValables(regles, cassee), choix.acquis_choix);
  assert.deepEqual(M.acquisChoixGardes(regles, cassee).filter((c) => c.source === robe.id).map((c) => c.choisi), [choisie]);
  assert.deepEqual(deLArmure({ ...cassee, armure_parties: [] }, choisie, robe.nom), [auChoix.valeur], 'réparée');
});

test('R157 : l’export en tableur d’une Robe de mage cassée garde la ligne « Acquis au choix » de la note, comme neuve', () => {
  const ligne = ligneDeNote(CLES_DE_LA_NOTE.acquisChoix, `${robe.nom} (armure) : ${M.trouver(regles.competences, choisie).nom}`);
  const choix = { acquis_choix: [{ source: robe.id, rang: 1, competence_id: choisie, valeur: null }] };
  for (const [nom, x] of [['neuve', {}], ['cassée', uniA(0)]]) {
    const { cellules } = cellulesDeLaFiche(regles, fiche({ armure_id: robe.id, ...choix, ...x }), { date: '15/10/2026' });
    assert.ok(Object.values(cellules).some((v) => typeof v === 'string' && v.split('\n').includes(ligne)), `${nom} : ${ligne}`);
  }
});

test('R157, R158 : Armure montagne à 0 — sans son bonus d’acquis ; l’AP et l’AM de l’armure à 0 sur toutes les parties, le reste demeure (R108)', () => {
  const neuve = fiche({ armure_id: montagne.id });
  const cassee = fiche({ armure_id: montagne.id, ...uniA(0) });
  assert.deepEqual(deLArmure(neuve, fixe.competence_id, montagne.nom), [fixe.valeur]);
  assert.deepEqual(deLArmure(fiche({ armure_id: montagne.id, ...uniA(1) }), fixe.competence_id, montagne.nom), [fixe.valeur], 'à 1');
  assert.deepEqual(deLArmure(cassee, fixe.competence_id, montagne.nom), []);
  assert.equal(competence(cassee, fixe.competence_id).dons, competence(fiche(), fixe.competence_id).dons, 'comme sans armure');
  assert.ok(M.acquisDesDons(regles, cassee).nonComptes.some((n) => n.nom === `${montagne.nom} (armure)` && n.valeur === fixe.valeur && n.raison === 'armure_cassee'));
  // AP et AM (R108, déjà fait) : la part de l'armure tombe à 0 sur les six parties ; la base reste
  assert.ok(M.armureParPartie(regles, cassee).every((p) => p.cassee && p.ap === 0 && p.am === 0));
  assert.ok(M.armureParPartie(regles, neuve).every((p) => !p.cassee && p.ap === entier(montagne.ap) && p.am === entier(montagne.am)));
  for (const partie of M.partiesDuCorps(regles).map((p) => p.id)) {
    const d = M.defenseDe(regles, cassee, undefined, { partie });
    const sans = M.defenseDe(regles, fiche(), undefined, { partie });
    assert.deepEqual([d.ap.armure, d.am.armure, d.ap.total, d.am.total, d.partie.cassee], [0, 0, sans.ap.total, sans.am.total, true], partie);
  }
});

test('R158 : la résistance aux coups d’une armure à cran uni cassée ne compte plus (degatsRecus, R108 : déjà fait)', () => {
  // une résistance à la frappe prêtée à l'Armure montagne, dans une copie des règles (une armure à cran uni n'en a pas forcément dans la base)
  const r = { ...regles, armures: regles.armures.map((a) => (a.id === montagne.id ? { ...a, degats: [{ sens: 'resistance', type: 'frappe', multiplicateur: 1 }] } : a)) };
  const neuve = M.degatsRecus(r, fiche({ armure_id: montagne.id }), { entrants: 100, type: 'frappe' });
  const cassee = M.degatsRecus(r, fiche({ armure_id: montagne.id, ...uniA(0) }), { entrants: 100, type: 'frappe' });
  const base = M.defenseDe(r, fiche()).ap.total;
  assert.equal(neuve.armure, base + 2 * entier(montagne.ap), 'la résistance double les AP de l’armure');
  assert.equal(cassee.armure, base, 'cassée : ni ses AP ni sa résistance');
  assert.ok(cassee.etapes.some((e) => /cassée/.test(e.texte)));
});

test('R158 : l’armure élémentaire portée sur une armure à cran uni — ses bonus de sorts absents à 0 (« non compté », armure_cassee), présents au-dessus', () => {
  const { sans, avec: attendu } = degatsDuSort();
  const avec = (x) => fiche({ armure_id: montagne.id, armure_elementaire_id: element.id, ...x });
  for (const [nom, x] of [['neuve', {}], ['à 1', uniA(1)]]) {
    const m = M.sortDuMoment(regles, avec(x), sortVise, auNm(sortVise));
    assert.equal(m.dsb.texte, attendu, nom);
    assert.ok(m.dsb.detail.some((d) => d.nom === NOM_ELEMENT && d.valeur === bonusElement.valeur), nom);
    assert.ok(!m.nonComptes.some((n) => n.raison === 'armure_cassee'), nom);
  }
  const ecrits = M.bonusDeSortsDuPersonnage(regles, avec(uniA(0))).filter((b) => b.nom === NOM_ELEMENT);
  assert.deepEqual(ecrits.map((b) => b.raison), element.sorts.map(() => 'armure_cassee'));
  const m = M.sortDuMoment(regles, avec(uniA(0)), sortVise, auNm(sortVise));
  assert.equal(m.dsb.texte, sans);
  assert.ok(m.nonComptes.some((n) => n.nom === NOM_ELEMENT && n.valeur === bonusElement.valeur && n.raison === 'armure_cassee' && n.cible === 'dsb'));
  assert.ok(m.nonComptes.filter((n) => n.nom === NOM_ELEMENT).every((n) => n.raison === 'armure_cassee'));
  // les bonus d'acquis de l'armure d'origine restent perdus par l'élément (R99) : la raison element passe avant armure_cassee
  const a = M.acquisDesDons(regles, avec(uniA(0)));
  assert.deepEqual(a.nonComptes.filter((n) => n.nom === `${montagne.nom} (armure)`).map((n) => n.raison), montagne.acquis.map(() => 'element'));
});

test('R158 : une armure à six parties dont une est à 0 n’est pas cassée — acquis et bonus de sorts inchangés ; seule la partie perd son AP et son AM (R108)', () => {
  // le bonus d'acquis de l'Armure montagne prêté à une armure à six parties, dans une copie des règles (aucune n'en a dans la base, R156)
  const r = { ...regles, armures: regles.armures.map((a) => (a.id === sixParties.id ? { ...a, acquis: montagne.acquis } : a)) };
  const torse = { armure_parties: [{ emplacement_id: 'torse', solidite: 0 }] };
  const f = fiche({ armure_id: sixParties.id, ...torse });
  assert.equal(M.armureCassee(r, f), false);
  assert.deepEqual(deLArmure(f, fixe.competence_id, sixParties.nom, r), [fixe.valeur]);
  assert.ok(!M.acquisDesDons(r, f).nonComptes.some((n) => n.nom === `${sixParties.nom} (armure)`));
  const fe = fiche({ armure_id: sixParties.id, armure_elementaire_id: element.id, ...torse });
  assert.equal(M.sortDuMoment(regles, fe, sortVise, auNm(sortVise)).dsb.texte, degatsDuSort().avec);
  assert.ok(!M.bonusDeSortsDuPersonnage(regles, fe).some((b) => b.raison === 'armure_cassee'));
  const parties = M.armureParPartie(regles, f);
  assert.deepEqual(parties.filter((p) => p.cassee).map((p) => [p.id, p.ap, p.am]), [['torse', 0, 0]]);
  assert.ok(parties.filter((p) => !p.cassee).every((p) => p.ap === entier(sixParties.ap) && p.am === entier(sixParties.am)));
});

test('R158, Q12 : un élément sur une armure à six parties toutes à 0 garde ses bonus de sorts (seules les armures à cran uni sont cassées au sens de R158)', () => {
  const toutes = M.partiesDuCorps(regles).map((p) => ({ emplacement_id: p.id, solidite: 0 }));
  const fe = fiche({ armure_id: sixParties.id, armure_elementaire_id: element.id, armure_parties: toutes });
  assert.ok(M.armureParPartie(regles, fe).every((p) => p.cassee && p.ap === 0 && p.am === 0), 'R108 : l’AP et l’AM tombent sur chaque partie');
  assert.equal(M.armureCassee(regles, fe), false);
  assert.ok(!M.bonusDeSortsDuPersonnage(regles, fe).some((b) => b.raison === 'armure_cassee'));
  assert.equal(M.sortDuMoment(regles, fe, sortVise, auNm(sortVise)).dsb.texte, degatsDuSort().avec);
});

test('R99 : une armure élémentaire non cassée garde la raison element pour les acquis de l’armure d’origine (pas armure_cassee)', () => {
  const autre = regles.armures_elementaires.find((e) => e.categorie !== montagne.type) ?? element;
  for (const x of [{}, uniA(1)]) {
    const a = M.acquisDesDons(regles, fiche({ armure_id: robe.id, armure_elementaire_id: autre.id, ...x }));
    assert.deepEqual(a.nonComptes.filter((n) => n.nom === `${robe.nom} (armure)`).map((n) => n.raison), robe.acquis.map(() => 'element'));
  }
});

test('la page (src/scripts/fiche.mjs, lue comme un texte) : la raison armure_cassee a son libellé « armure cassée (R158) » dans les acquis et dans les sorts', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  for (const nom of ['RAISONS_DE_L_ACQUIS', 'RAISONS_DES_SORTS']) {
    const debut = script.indexOf(`const ${nom} = {`);
    assert.ok(debut >= 0, nom);
    assert.match(script.slice(debut, script.indexOf('};', debut)), /\barmure_cassee: 'armure cassée \(R158\)'/, nom);
  }
});
