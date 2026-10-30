// Décision R172 (2026-10-29) : le Mode Hyper et le Mode Hyper 100 % activables sur la fiche — deux cases enregistrées (personnage.mode_hyper,
// mode_hyper_100, migration 0084 ; Mode Hyper dès le niveau 2, Mode Hyper 100 % dès le niveau 10 et seulement avec le Mode Hyper), un compteur « une
// fois par semaine » (personnage.mode_hyper_semaine, NULL au maximum) ; le Mode Hyper actif recalcule dégâts (armes +15 ; sorts de ses magies +15, +7
// avec deux, R5 ; tous ses sorts pour le Potentiel Illimité), soins (+15), coût des sorts (0 chakra, R18), résistances (immunité, grande résistance,
// Potentiel Illimité : +1 cran et malus physique annulé, R174) et les effets de magie et de race lus dans leur texte (Glace, Terre, Humain, Nain, Felfe,
// Jackalope, Marcass) ; le Mode Hyper 100 % cumule les avantages des postures (R100) sans leurs inconvénients et ajoute +10 à toutes les attaques ;
// les jauges, par un bouton : un tour retire ⌊10 %⌋ du chakra maximum, la sortie du Mode Hyper 100 % en consomme ⌊75 %⌋ (R175), le manque payé 2 santé
// pour 1 chakra (R18).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { armureNaturelleEcrite, effetsDuModeHyper } from '../src/lib/mode-hyper-texte.mjs';
import { cellulesDeLaFiche, lireLigneDeNote, lireModeHyper, texteDuModeHyper } from '../src/lib/fiche-tableur-export.mjs';
import { MARQUEUR_DES_NOTES, ORDINATEUR } from '../src/lib/fiche-tableur-cases.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const FEU = 'magies/magie-du-feu';
const GLACE = 'magies/magie-de-la-glace';
const TERRE = 'magies/magie-de-la-terre';
const LUMIERE = 'magies/magie-de-la-lumiere';
const PI = 'magies/potentiel-illimite';
const POSTURE = (slug) => `guide/postures#posture:${slug}`;
const ARME = 'ressources/armes#arme:arbalete:arbalete';
/** Une fiche sans race (aucun effet de race), Feu inné, au niveau `niveau`. */
const fiche = (x = {}, niveau = 10) => ({ ...ficheVide('Essai'), magie_innee_id: FEU, xp: xpDuNiveau(niveau), ...x });
/** La même, en Mode Hyper (et en Mode Hyper 100 % avec `cent`). */
const enHyper = (x = {}, { cent = false, niveau = 10 } = {}) => fiche({ mode_hyper: 1, mode_hyper_100: cent ? 1 : 0, ...x }, niveau);
const avecArme = (x = {}) => ({ armes: [{ rang: 1, arme_id: ARME, materiau_id: null, amelioration_id: null, durabilite: null }], ...x });
const sort = (id) => M.trouver(regles.sorts, id);
const auNm = (s, dsb = null) => ({ ...Object.fromEntries(['cout', 'portee', 'dsb', 'effets'].map((c) => [c, valeurAuNm(s[c], s.bonus ?? [], c, 0) ?? ''])), ...(dsb ? { dsb } : {}) });
const BOULE_DE_FEU = sort('magies/magie-du-feu#sort:boule-de-feu');      // « 2d6 dégâts », coût 4
const FRAPPE_LUMINEUSE = sort('magies/magie-de-la-lumiere#sort:frappe-lumineuse'); // Lumière, « 2d6 dégâts »
const PREMIER_SOIN = sort('magies/magie-de-la-lumiere#sort:premier-soin');  // « 2d6 soin »
const moment = (f, s, dsb) => M.sortDuMoment(regles, f, s, auNm(s, dsb));
/** Les lignes du tableau des résistances : `type:id` → palier. */
const paliers = (r) => Object.fromEntries(r.paliers.flatMap((p) => p.cibles.map((c) => [`${c.type}:${c.id}`, p.id])));
const crans = (r) => Object.fromEntries(r.paliers.flatMap((p) => p.cibles.map((c) => [`${c.type}:${c.id}`, c.crans])));

test('R172 : les constantes du Mode Hyper viennent de la base (R5 « 15/7 », 10 % par tour, 75 % à la sortie, une fois par semaine, +10 en 100 %)', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(regles.constantes).filter(([k]) => k.startsWith('mode_hyper'))), {
    'mode_hyper.degats_physique': 15, 'mode_hyper.degats_magie_mono': 15, 'mode_hyper.degats_magie_bi': 7, 'mode_hyper.soin_magique': 15,
    'mode_hyper.conso_chakra_pct_max_par_tour': 10, 'mode_hyper.usage_par_semaine': 1, 'mode_hyper_100.degats_bonus': 10, 'mode_hyper_100.cout_chakra_pct_max': 75,
  });
});

test('R172 : effets de magie et de race lus dans leur texte (onglets, R13) — les sept comptés, les autres affichés seulement', () => {
  const lus = {};
  for (const r of db.prepare("SELECT magie_id, race_id, variante, effet FROM mode_hyper_effet WHERE version IN ('onglet_magie', 'onglet_race')").all()) {
    const e = effetsDuModeHyper(r.effet);
    if (e.length) lus[`${r.magie_id ?? r.race_id}${r.variante ? `:${r.variante}` : ''}`] = e;
  }
  assert.deepEqual(lus, {
    [`${GLACE}:mono`]: [{ cible: 'am_base', valeur: 25 }], [`${GLACE}:bi`]: [{ cible: 'am_base', valeur: 10 }],
    [`${TERRE}:mono`]: [{ cible: 'ap_base', valeur: 25 }], [`${TERRE}:bi`]: [{ cible: 'ap_base', valeur: 10 }],
    'races/humain': [{ cible: 'des_attaques', valeur: 1 }, { cible: 'vitesse', valeur: 2 }],
    'races/nain': [{ cible: 'des_armes', valeur: 2 }],
    'races/felfe': [{ cible: 'des_sorts', valeur: 2, soins: true }],
    'races/jackalope': [{ cible: 'vitesse', valeur: 3 }],
    'races/marcass': [{ cible: 'armure_naturelle' }],
  });
  // jamais par le nom : un autre texte écrit de même est lu de même ; « Augmente les dégâts de tous les alliés de 5 » (Goleois) ne l'est pas
  assert.deepEqual(effetsDuModeHyper('Une race inventée : +4 à la Vitesse.'), [{ cible: 'vitesse', valeur: 4 }]);
  assert.deepEqual(effetsDuModeHyper(regles.mode_hyper.races['races/goleois'].effet), []);
  // les règles de la page portent la lecture, par variante et par race
  assert.deepEqual(regles.mode_hyper.chiffres_magies[GLACE], { mono: [{ cible: 'am_base', valeur: 25 }], bi: [{ cible: 'am_base', valeur: 10 }] });
  assert.deepEqual(regles.mode_hyper.races['races/nain'].chiffres, [{ cible: 'des_armes', valeur: 2 }]);
});

test('R172 : les deux cases — Mode Hyper dès le niveau 2, Mode Hyper 100 % dès le niveau 10 et seulement avec le Mode Hyper ; décocher le Mode Hyper décoche le 100 %', () => {
  const n1 = fiche({}, 1);
  assert.equal(M.modeHyperDe(regles, n1).activable, false);
  assert.deepEqual(M.modeHyperApres(regles, n1, 'mode_hyper', true), {}, 'pas avant le niveau 2');
  assert.equal(M.modeHyperDuMoment(regles, { ...n1, mode_hyper: 1 }), null, 'une case cochée avant son niveau ne compte pas');
  const n2 = fiche({}, 2);
  assert.deepEqual(M.modeHyperApres(regles, n2, 'mode_hyper', true), { mode_hyper: 1, mode_hyper_100: 0, mode_hyper_semaine: 0 }, 'consomme l’utilisation');
  const actif2 = { ...n2, mode_hyper: 1, mode_hyper_semaine: 0 };
  assert.equal(M.modeHyperDe(regles, actif2).actif, true);
  assert.deepEqual(M.modeHyperApres(regles, actif2, 'mode_hyper_100', true), {}, 'le 100 % : pas avant le niveau 10');
  // niveau 10 : le 100 % seulement avec le Mode Hyper
  assert.deepEqual(M.modeHyperApres(regles, fiche(), 'mode_hyper_100', true), {}, 'sans le Mode Hyper');
  assert.deepEqual(M.modeHyperApres(regles, enHyper(), 'mode_hyper_100', true), { mode_hyper_100: 1 });
  assert.equal(M.modeHyperDe(regles, enHyper({}, { cent: true })).cent.actif, true);
  // décocher le Mode Hyper écrit les deux à 0 (la base ne décoche rien d'elle-même)
  assert.deepEqual(M.modeHyperApres(regles, enHyper({}, { cent: true }), 'mode_hyper', false), { mode_hyper: 0, mode_hyper_100: 0 });
  assert.deepEqual(M.modeHyperApres(regles, enHyper({}, { cent: true }), 'mode_hyper_100', false), { mode_hyper_100: 0 }, 'le 100 % seul : le Mode Hyper reste');
  // ce que la fiche garde : rien au-dessus de son niveau, jamais le 100 % sans le Mode Hyper
  assert.deepEqual(M.modeHyperValable(regles, { ...enHyper({}, { cent: true }), xp: xpDuNiveau(5) }), { mode_hyper: 1, mode_hyper_100: 0 });
  assert.deepEqual(M.modeHyperValable(regles, { ...enHyper({}, { cent: true }), xp: xpDuNiveau(1) }), { mode_hyper: 0, mode_hyper_100: 0 });
  assert.deepEqual(M.modeHyperValable(regles, fiche({ mode_hyper_100: 1 })), { mode_hyper: 0, mode_hyper_100: 0 });
});

test('R172 : le compteur « une fois par semaine » — consommé à l’activation, à 0 la case est grisée, remonté seulement à la main (au maximum : NULL)', () => {
  assert.deepEqual(M.modeHyperDe(regles, fiche()).semaine, { restantes: 1, max: 1 }, 'NULL : au maximum');
  const epuise = fiche({ mode_hyper_semaine: 0 });
  assert.deepEqual(M.modeHyperDe(regles, epuise).semaine, { restantes: 0, max: 1 });
  assert.equal(M.modeHyperDe(regles, epuise).activable, false, 'grisée, comme une action épuisée');
  assert.deepEqual(M.modeHyperApres(regles, epuise, 'mode_hyper', true), {});
  // actif, il se décoche toujours ; décoché, l'utilisation n'est pas rendue
  assert.equal(M.modeHyperDe(regles, { ...epuise, mode_hyper: 1 }).activable, true);
  assert.deepEqual(M.modeHyperApres(regles, { ...epuise, mode_hyper: 1 }, 'mode_hyper', false), { mode_hyper: 0, mode_hyper_100: 0 });
  // à la main : remonter au maximum écrit NULL ; jamais sous 0 ni au-dessus du maximum
  assert.deepEqual(M.semaineDuModeHyperApres(regles, epuise, 1), { mode_hyper_semaine: null });
  assert.deepEqual(M.semaineDuModeHyperApres(regles, fiche(), 1), { mode_hyper_semaine: null });
  assert.deepEqual(M.semaineDuModeHyperApres(regles, fiche(), -1), { mode_hyper_semaine: 0 });
  assert.deepEqual(M.semaineDuModeHyperApres(regles, epuise, -1), { mode_hyper_semaine: 0 });
});

test('R172 (C2) : une seule magie — armes +15, sorts de sa magie +15, soins +15, sorts à 0 chakra (et 0 corruption) ; deux magies : sorts +7', () => {
  const arme = (f) => M.degatsDArmeDuMoment(regles, f, 1);
  const sans = arme(fiche(avecArme()));
  const avec = arme(enHyper(avecArme(), { niveau: 2 }));
  assert.equal(avec.texte, `${sans.notation}+15`);
  assert.deepEqual(avec.moment, [{ nom: 'Mode Hyper', valeur: 15 }]);
  // sorts : la magie du personnage +15, une autre rien ; deux magies +7
  assert.equal(moment(fiche(), BOULE_DE_FEU).dsb.texte, '2d6 dégâts');
  assert.equal(moment(enHyper(), BOULE_DE_FEU).dsb.texte, '2d6 + 15 dégâts');
  assert.equal(moment(enHyper(), FRAPPE_LUMINEUSE).dsb.texte, '2d6 dégâts', 'pas une magie du personnage');
  assert.equal(moment(enHyper({ magie_acquise_id: LUMIERE }), BOULE_DE_FEU).dsb.texte, '2d6 + 7 dégâts');
  assert.equal(moment(enHyper({ magie_acquise_id: LUMIERE }), FRAPPE_LUMINEUSE).dsb.texte, '2d6 + 7 dégâts');
  // Potentiel Illimité : tous ses sorts
  assert.equal(moment(enHyper({ magie_innee_id: PI }), FRAPPE_LUMINEUSE).dsb.texte, '2d6 + 15 dégâts');
  // soins +15, de tout sort
  assert.equal(moment(enHyper(), PREMIER_SOIN).dsb.texte, '2d6 + 15 soin');
  // coût : 0 chakra (R18) ; le coût secondaire n'est pas visé
  const m = moment(enHyper(), BOULE_DE_FEU);
  assert.equal(moment(fiche(), BOULE_DE_FEU).cout.texte, '4');
  assert.deepEqual([m.cout.texte, m.cout.modeHyper], ['0', true]);
  assert.equal(M.sortDuMoment(regles, enHyper(), BOULE_DE_FEU, { ...auNm(BOULE_DE_FEU), cout: '4 + 2 Sang' }).cout.texte, '0 + 2 Sang');
  // décoché : rien
  assert.equal(moment(enHyper({ mode_hyper: 0 }), BOULE_DE_FEU).dsb.texte, '2d6 dégâts');
  // un sort de la Corruption : gratuit dans les deux monnaies, chakra et corruption (« Oui, aussi à 0 ») ; hors Mode Hyper, 4 ou 8 de corruption
  const bouleSombre = sort('magies/magie-de-la-corruption#sort:boule-sombre');
  const corruption = { magie_innee_id: 'magies/magie-de-la-corruption' };
  const horsHyper = moment(fiche(corruption), bouleSombre).cout;
  assert.deepEqual([horsHyper.texte, horsHyper.corruption?.valeur], ['4', 8]);
  const enMode = moment(enHyper(corruption), bouleSombre).cout;
  assert.deepEqual([enMode.texte, enMode.corruption], ['0', null]);
});

test('R172 (C2) : résistances — une magie : immunité à sa magie innée ; deux : grande résistance à chacune (immunité gardée) ; origine « Mode Hyper »', () => {
  const une = M.resistancesDe(regles, enHyper());
  const feu = une.paliers.find((p) => p.id === 'immunite').cibles.find((c) => c.id === FEU);
  assert.ok(feu);
  assert.ok(feu.origines.some((o) => o.nom === 'Mode Hyper' && o.immunite));
  assert.notEqual(paliers(M.resistancesDe(regles, fiche()))[`magie:${FEU}`], 'immunite', 'hors Mode Hyper : la résistance de sa liste');
  // deux magies : la grande résistance, un palier fixé (Feu : +1 de sa liste et −1 de la Glace → 0 cran ; Glace : +1 et −1)
  const deux = M.resistancesDe(regles, enHyper({ magie_acquise_id: GLACE }));
  assert.equal(paliers(deux)[`magie:${FEU}`], 'grande_resistance');
  assert.equal(paliers(deux)[`magie:${GLACE}`], 'grande_resistance');
  assert.deepEqual(deux.paliers.flatMap((p) => p.cibles).find((c) => c.id === FEU).origines.at(-1), { nom: 'Mode Hyper', palier: 'Grande résistance' });
  // une magie déjà en immunité le reste : Feu à 3 crans (sa liste +1, deux bagues « Résistance Feu et Brûlure » +2 ; configuration de calcul)
  const bagues = ['bague-1', 'bague-2'].map((emplacement) => ({ emplacement, accessoire_effet_id: 'ressources/accessoires#effet:defense:5', valeur: null, maudit: 0 }));
  const immunise = M.resistancesDe(regles, enHyper({ magie_acquise_id: LUMIERE, accessoires: bagues }));
  assert.equal(paliers(immunise)[`magie:${FEU}`], 'immunite');
  assert.equal(paliers(immunise)[`magie:${LUMIERE}`], 'grande_resistance');
  // l'export (avecLaPosture: false) écrit la fiche, sans le Mode Hyper
  assert.deepEqual(M.resistancesDe(regles, enHyper(), { avecLaPosture: false }), M.resistancesDe(regles, fiche(), { avecLaPosture: false }));
  // les dégâts reçus suivent : immunisé au Feu
  assert.equal(M.degatsRecus(regles, enHyper(), { entrants: 30, type: 'magique', element: FEU }).recus, 0);
});

test('R172, R174 (C2) : Potentiel Illimité — +1 cran à chacune des 14 magies, malus physique annulé, ses crans positifs gardés', () => {
  const pi = (x = {}) => enHyper({ magie_innee_id: PI, ...x });
  const r = M.resistancesDe(regles, pi());
  const c = crans(r);
  for (const m of M.elementsDeDegats(regles)) assert.equal(c[`magie:${m.id}`], 1, m.nom);
  assert.equal(M.elementsDeDegats(regles).length, 14);
  assert.equal(c[`magie:${PI}`], undefined, 'pas le Potentiel Illimité lui-même');
  for (const t of ['estoc', 'frappe', 'taille']) assert.equal(c[`physique:${t}`], undefined, `${t} : le malus annulé`);
  assert.deepEqual(crans(M.resistancesDe(regles, { ...pi(), mode_hyper: 0 })), { 'physique:estoc': -1, 'physique:frappe': -1, 'physique:taille': -1 }, 'hors Mode Hyper : le malus');
  // seulement les crans négatifs du PI : un cran positif de sa liste (règles d'essai) reste
  const essai = JSON.parse(JSON.stringify(regles));
  M.trouver(essai.magies, PI).resistances.push({ type: 'physique', id: 'frappe', crans: 1 });
  assert.equal(crans(M.resistancesDe(essai, pi()))['physique:frappe'], 1);
  assert.equal(crans(M.resistancesDe(essai, { ...pi(), mode_hyper: 0 }))['physique:frappe'], undefined, 'hors Mode Hyper : −1 + 1 = 0, pas de ligne');
  // les dégâts reçus : 30 en Estoc, sans armure → 30 (et non × 2)
  assert.equal(M.degatsRecus(regles, pi(), { entrants: 30, type: 'estoc' }).recus, 30);
  assert.equal(M.degatsRecus(regles, { ...pi(), mode_hyper: 0 }, { entrants: 30, type: 'estoc' }).recus, 60);
});

test('R172 (C2) : Glace et Terre — AM ou AP de base +25 avec une seule magie, +10 avec deux', () => {
  const ecart = (x, cle) => M.defenseDe(regles, enHyper(x))[cle].total - M.defenseDe(regles, fiche(x))[cle].total;
  assert.equal(ecart({ magie_innee_id: GLACE }, 'am'), 25);
  assert.equal(ecart({ magie_innee_id: GLACE }, 'ap'), 0);
  assert.equal(ecart({ magie_innee_id: TERRE }, 'ap'), 25);
  assert.equal(ecart({ magie_innee_id: FEU, magie_acquise_id: GLACE }, 'am'), 10);
  assert.equal(ecart({ magie_innee_id: TERRE, magie_acquise_id: FEU }, 'ap'), 10);
  assert.ok(M.defenseDe(regles, enHyper({ magie_innee_id: GLACE })).am.detail.some((l) => l.nom === 'Mode Hyper (Glace)' && l.valeur === 25));
  // une autre magie (Feu) : rien, son effet reste affiché
  assert.equal(ecart({}, 'am') + ecart({}, 'ap'), 0);
  const feu = M.modeHyperDe(regles, enHyper()).magies[0];
  assert.deepEqual([feu.magie.id, feu.chiffres], [FEU, []]);
  assert.ok(feu.effet);
});

test('R172 (C2) : Humain — +1 dé à toutes les attaques (armes et sorts, du type du premier dé ; rien sur un sort sans dé), +2 en Vitesse', () => {
  const humain = { race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' };
  const a = M.degatsDArmeDuMoment(regles, enHyper({ ...humain, ...avecArme() }), 1);
  const sans = M.degatsDArme(regles, fiche({ ...humain, ...avecArme() }), 1);
  assert.equal(a.texte, `${M.notationDesDes(sans.de, sans.nombre + 1)}+15`);
  assert.equal(moment(enHyper(humain), BOULE_DE_FEU).dsb.texte, '3d6 + 15 dégâts');
  assert.equal(moment(enHyper(humain), PREMIER_SOIN).dsb.texte, '2d6 + 15 soin', 'pas les soins');
  assert.equal(moment(enHyper(humain), BOULE_DE_FEU, '23 dégâts').dsb.texte, '38 dégâts', 'un sort sans dé : rien');
  const v = M.attributsDe(regles, enHyper(humain));
  assert.deepEqual([v.vitesseModeHyper, v.vitesseSol], [2, M.attributsDe(regles, fiche(humain)).vitesseSol], 'la vitesse de la fiche ne change pas (tableur)');
});

test('R172 (C2) : Nain +2 dés aux armes (pas aux sorts), Felfe +2 dés aux dégâts et soins des sorts (pas aux armes), Jackalope +3 en Vitesse', () => {
  const nain = { race_id: 'races/nain', ethnie_id: 'races/nain#ethnie:nain-ouest' };
  const felfe = { race_id: 'races/felfe', ethnie_id: 'races/felfe#ethnie:felfe-forestier' };
  const base = M.degatsDArme(regles, fiche(avecArme()), 1);
  assert.equal(M.degatsDArmeDuMoment(regles, enHyper({ ...nain, ...avecArme() }), 1).texte, `${M.notationDesDes(base.de, base.nombre + 2)}+15`);
  assert.equal(moment(enHyper(nain), BOULE_DE_FEU).dsb.texte, '2d6 + 15 dégâts');
  assert.equal(M.degatsDArmeDuMoment(regles, enHyper({ ...felfe, ...avecArme() }), 1).texte, `${base.notation}+15`);
  assert.equal(moment(enHyper(felfe), BOULE_DE_FEU).dsb.texte, '4d6 + 15 dégâts');
  assert.equal(moment(enHyper(felfe), PREMIER_SOIN).dsb.texte, '4d6 + 15 soin');
  const jackalope = { race_id: 'races/jackalope', ethnie_id: 'races/jackalope#ethnie:jackalope-terre', magie_innee_id: TERRE };
  assert.equal(M.attributsDe(regles, enHyper(jackalope)).vitesseModeHyper, 3);
  assert.equal(M.attributsDe(regles, fiche(jackalope)).vitesseModeHyper, 0);
  // un effet non chiffré reste affiché, sans rien changer (Goleois : « Augmente les dégâts de tous les alliés de 5 »)
  const goleois = { race_id: 'races/goleois', ethnie_id: 'races/goleois#ethnie:goleois-de-glace', magie_innee_id: GLACE };
  const h = M.modeHyperDe(regles, enHyper(goleois));
  assert.match(h.race.effet, /alliés de 5/);
  assert.deepEqual(h.race.chiffres, []);
  assert.equal(M.degatsDArmeDuMoment(regles, enHyper({ ...goleois, ...avecArme() }), 1).texte, `${base.notation}+15`);
});

test('R172, R177 (C2) : Marcass — « L’attaque ignore l’armure » ; avec elle, seuls l’AP et l’AM naturels (race, ethnie et leurs dons) d’un Marcass en Mode Hyper comptent', () => {
  // l'armure naturelle écrite par un don de race ou d'ethnie, lue dans le texte : seuls les trois dons d'ethnie du Marcass l'écrivent
  const lus = db.prepare('SELECT id, texte FROM race_don').all().filter((d) => armureNaturelleEcrite(d.texte).length);
  assert.deepEqual(lus.map((d) => d.id).sort(), ['races/marcass#don:feu-en-innee', 'races/marcass#don:necromancie-en-innee', 'races/marcass#don:terre-en-innee']);
  for (const d of lus) assert.deepEqual(armureNaturelleEcrite(d.texte), [{ cle: 'am', base: 2, pas: 2, niveaux: 5 }], d.id);
  // « +2 Armure magique (+2 tous les 5 niveaux) », au niveau global comme R110 : 2 + 2 × ⌊N ÷ 5⌋
  const marcass = (niveau, x = {}) => fiche({ race_id: 'races/marcass', ethnie_id: 'races/marcass#ethnie:marcass-feu', ...x }, niveau);
  for (const [n, am] of [[1, 2], [4, 2], [5, 4], [9, 4], [10, 6], [20, 10]]) assert.equal(M.armureNaturelleDe(regles, marcass(n), 'am'), am, `niveau ${n}`);
  assert.equal(M.armureNaturelleDe(regles, marcass(10), 'ap'), 0, 'aucune AP naturelle écrite');
  // R177, « Oui, toujours » : l'AM de base de la fiche la compte, en permanence (1, 4, 5, 10 → 2, 2, 4, 6) ; celle des autres races ne change pas
  for (const [n, am] of [[1, 2], [4, 2], [5, 4], [10, 6]]) {
    const a = M.attributsDe(regles, marcass(n));
    assert.deepEqual([a.am, a.ap], [am, 0], `niveau ${n}`);
    assert.ok(M.defenseDe(regles, marcass(n)).am.detail.some((l) => l.nom === 'Base (race, ethnie, classes magiques)' && l.valeur === am));
  }
  for (const race of regles.races.filter((r) => r.id !== 'races/marcass')) {
    for (const e of regles.ethnies.filter((x) => x.race_id === race.id)) {
      const f = fiche({ race_id: race.id, ethnie_id: e.id }, 20);
      assert.equal(M.armureDesDonsDeRace(regles, f, 'am') + M.armureDesDonsDeRace(regles, f, 'ap'), 0, e.id);
      assert.deepEqual([M.attributsDe(regles, f).ap, M.attributsDe(regles, f).am], [race.ap + e.ap, race.am + e.am], e.id);
    }
  }
  // les vraies règles : 30 dégâts magiques de Vent (vulnérabilité de sa liste de Feu, × 2), au niveau 10
  const recus = (f, o) => M.degatsRecus(regles, f, { entrants: 30, type: 'magique', element: 'magies/magie-du-vent', ...o }).recus;
  const hors = marcass(10);
  const en = marcass(10, { mode_hyper: 1 });
  const am = M.defenseDe(regles, hors).am.total;
  // sans la case : rien ne compte deux fois, Mode Hyper ou non
  assert.equal(recus(hors), (30 - am) * 2);
  assert.equal(recus(en), (30 - am) * 2);
  assert.equal(am, 6, 'l’AM de base : le don d’ethnie au niveau 10');
  // avec la case : hors Mode Hyper, aucune armure ; en Mode Hyper, l'AM naturelle (6 au niveau 10), comptée une seule fois (pas 6 + 6)
  assert.equal(recus(hors, { ignoreArmure: true }), 60);
  assert.equal(recus(en, { ignoreArmure: true }), (30 - 6) * 2);
  assert.equal(M.degatsRecus(regles, en, { entrants: 30, type: 'magique', element: 'magies/magie-du-vent', ignoreArmure: true }).armure, 6);
  assert.match(M.degatsRecus(regles, en, { entrants: 30, type: 'magique', element: 'magies/magie-du-vent', ignoreArmure: true }).etapes[1].texte, /l’attaque ignore l’armure ; AM naturelle/);
  // une autre race en Mode Hyper : rien
  assert.equal(recus(marcass(10, { mode_hyper: 1, race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' }), { ignoreArmure: true }), 60);
  // l'étape dit ce qui reste, en valeurs
  assert.equal(M.degatsRecus(regles, en, { entrants: 30, type: 'magique', element: 'magies/magie-du-vent', ignoreArmure: true }).etapes[1].texte,
    '− AM (l’attaque ignore l’armure ; AM naturelle : dons de race 6)');
});

test('R172 (« Oui, gardé ») : Marcass de Terre (et de Glace) — l’AP (l’AM) de base de l’effet de sa magie reste avec « L’attaque ignore l’armure »', () => {
  const terre = (x = {}) => fiche({ race_id: 'races/marcass', ethnie_id: 'races/marcass#ethnie:marcass-terre', magie_innee_id: TERRE, mode_hyper: 1, ...x });
  // une magie : AP de base +25, lue dans le texte de l'effet de la Terre ; 30 en Taille → 5
  assert.deepEqual(M.partsDeLArmureNaturelle(regles, terre(), 'ap'), [{ nom: 'Mode Hyper (Terre)', valeur: 25 }]);
  assert.equal(M.degatsRecus(regles, terre(), { entrants: 30, type: 'taille', ignoreArmure: true }).recus, 5);
  // deux magies : +10 ; et l'AM de la Glace de même
  assert.deepEqual(M.partsDeLArmureNaturelle(regles, terre({ magie_acquise_id: GLACE }), 'ap'), [{ nom: 'Mode Hyper (Terre)', valeur: 10 }]);
  assert.deepEqual(M.partsDeLArmureNaturelle(regles, terre({ magie_acquise_id: GLACE }), 'am'), [{ nom: 'dons de race', valeur: 6 }, { nom: 'Mode Hyper (Glace)', valeur: 10 }]);
  // sans la case, l'AP de base +25 est déjà dans l'armure, une seule fois
  assert.equal(M.degatsRecus(regles, terre(), { entrants: 30, type: 'taille' }).armure, M.defenseDe(regles, terre()).ap.total);
  assert.equal(M.defenseDe(regles, terre()).ap.total - M.defenseDe(regles, terre({ mode_hyper: 0 })).ap.total, 25);
  // un autre effet de Mode Hyper (Humain de Terre) : rien ne reste
  assert.deepEqual(M.partsDeLArmureNaturelle(regles, terre({ race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' }), 'ap'), []);
  assert.equal(M.degatsRecus(regles, terre({ race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' }), { entrants: 30, type: 'taille', ignoreArmure: true }).recus, 30);
});

test('R172 : l’état des cases n’est pas réécrit au rafraîchissement — un niveau qui repasse sous 2 suspend le Mode Hyper, qui revient au niveau rendu ; l’enregistrement seul le décoche', () => {
  const f = enHyper({}, { cent: true });
  const bas = { ...f, xp: xpDuNiveau(1) };
  assert.equal(M.modeHyperDe(regles, bas).actif, false);
  assert.equal(M.modeHyperDuMoment(regles, bas), null);
  assert.deepEqual([bas.mode_hyper, bas.mode_hyper_100], [1, 1], 'le moteur ne réécrit rien');
  assert.deepEqual([M.modeHyperDe(regles, f).actif, M.modeHyperDe(regles, f).cent.actif], [true, true], 'l’XP rendue : tel quel');
  const moyen = { ...f, xp: xpDuNiveau(5) };
  assert.deepEqual([M.modeHyperDe(regles, moyen).actif, M.modeHyperDe(regles, moyen).cent.actif], [true, false]);
  // la page : plus de normalisation dans rafraichir, seulement dans aEnvoyer (l'enregistrement)
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const corps = (nom) => script.slice(script.indexOf(`function ${nom}(`), script.indexOf('\n}\n', script.indexOf(`function ${nom}(`)));
  assert.doesNotMatch(corps('rafraichir'), /modeHyperValable/);
  assert.match(corps('aEnvoyer'), /Object\.assign\(f, modeHyperValable\(regles, f\)\)/);
});

test('R172 : un sort préparé se calcule au Mode Hyper 100 % tant qu’il dure (la posture de sa préparation est ignorée), puis à cette posture', () => {
  // Mage Rouge Rubis (« Préparation »), Boule de feu préparée en Défensif
  const mage = (x = {}) => ({
    ...fiche({ race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', mode_hyper: 1 }, 10),
    classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: 'classes/mage-rouge#specialite:mage-rubis' }],
    sorts: [{ sort_id: BOULE_DE_FEU.id, rang: 1, niveau_maitrise: 0, prepare: 1, prepare_jet: 50, prepare_posture_id: POSTURE('defensif') }], ...x,
  });
  assert.ok(M.sortPrepare(regles, mage()), 'le don de préparation');
  const cent = M.contexteDesSorts(regles, mage({ mode_hyper_100: 1 })).prepare;
  assert.deepEqual([cent.posture.cent, cent.posture.diviseur, cent.posture.degatsMaximum], [true, 1, true]);
  const m = M.sortDuMoment(regles, mage({ mode_hyper_100: 1 }), BOULE_DE_FEU, auNm(BOULE_DE_FEU));
  assert.deepEqual([m.prepare, m.posture.nom, m.dsb.diviseur], [true, 'Mode Hyper 100 %', 1]);
  // hors du 100 % : la posture de sa préparation (Défensif : ÷ 2)
  const apres = M.sortDuMoment(regles, mage(), BOULE_DE_FEU, auNm(BOULE_DE_FEU));
  assert.deepEqual([apres.posture.nom, apres.dsb.diviseur], ['Défensif', 2]);
});

test('R172 : en Mode Hyper 100 %, l’AM de la Symbiose compte une seule fois, même avec deux magies', () => {
  const am = (x) => M.defenseDe(regles, x).am.total;
  const une = enHyper({}, { cent: true });
  const deux = enHyper({ magie_acquise_id: LUMIERE }, { cent: true });
  const p = M.postureDuMoment(regles, deux);
  assert.equal(p.symbiose.magies.length, 2);
  assert.equal(p.am, M.postureDuMoment(regles, une).am, 'Défensif et Symbiose, pas la Symbiose deux fois');
  assert.equal(p.am, p.ap + p.symbiose.am);
  assert.equal(am(deux) - am(enHyper({ magie_acquise_id: LUMIERE })), p.am);
});

test('R172 (C3) : Mode Hyper 100 % — toutes les postures sans leurs inconvénients, la posture cochée ignorée ; Focus puis Offensif : 6D6+4 → 6D8+4 → 52', () => {
  const cent = (x = {}) => enHyper(x, { cent: true });
  const p = M.postureDuMoment(regles, cent({ posture_id: POSTURE('defensif') }));
  assert.equal(p.cent, true);
  assert.deepEqual([p.degatsMaximum, p.crans, p.diviseur, p.armesInutilisables, p.initiative], [true, 1, 1, false, 2]);
  // Défensif 2 × ⌈N ÷ 4⌉ (niveau 10 : 6) et l'AM de la Symbiose
  assert.equal(p.ap, 6);
  assert.equal(p.am, 6 + p.symbiose.am);
  // compétences : Focus +10 partout, Neutre +5 Social et Volonté, Vigilance +5 Perception, jamais le −10 de l'Offensif
  for (const c of M.competencesDe(regles, cent())) {
    const attendu = 10 + (['social', 'volonte', 'perception'].includes(c.caracteristique_id) ? 5 : 0);
    assert.equal(c.posture, attendu, c.id);
  }
  // un sort d'une autre magie (ni +15 ni Symbiose) : 6d6 + 4 → 6d8 + 4 → 52, puis +10 (Mode Hyper 100 %)
  const m = moment(cent(), FRAPPE_LUMINEUSE, '6d6 + 4 dégâts');
  assert.equal(m.dsb.texte, `${52 + 10} dégâts`);
  assert.deepEqual(m.dsb.detail.filter((l) => l.crans || l.maximum).map((l) => [l.nom, l.valeur]), [['Dés d6 → d8', 0], ['Mode Hyper 100 % (postures) : dégâts maximum', 48]]);
  // avec l'accessoire qui monte le dé : d6 → d10, puis le maximum
  const accessoire = { accessoires: [{ emplacement: 'bague-1', accessoire_effet_id: 'ressources/accessoires#effet:attaque:11', valeur: null, maudit: 0 }] };
  assert.equal(moment(cent(accessoire), FRAPPE_LUMINEUSE, '6d6 + 4 dégâts').dsb.texte, `${64 + 10} dégâts`);
  // une arme : utilisable, au maximum, +15 et +10, sans ÷ 2
  const a = M.degatsDArmeDuMoment(regles, cent({ posture_id: POSTURE('symbiose'), ...avecArme() }), 1);
  const base = M.degatsDArme(regles, fiche(avecArme()), 1);
  assert.deepEqual([a.inutilisable, a.diviseur], [null, 1]);
  assert.equal(a.texte, String(base.nombre * Number(base.de.slice(1)) + base.total + 15 + 10));
  // hors Mode Hyper 100 % : la posture cochée revient (Défensif : ÷ 2)
  assert.equal(M.postureDuMoment(regles, enHyper({ posture_id: POSTURE('defensif') })).diviseur, 2);
});

test('R172 (C3) : Mode Hyper 100 % — la Symbiose vaut pour ses deux magies (dégâts et soins, immunité), aucune magie désactivée (R111 levé)', () => {
  const f = enHyper({ magie_acquise_id: LUMIERE, symbiose_magie_id: FEU }, { cent: true });
  const s = M.postureDuMoment(regles, f).symbiose;
  assert.deepEqual([s.magies.map((m) => m.id), s.inactive, s.aChoisir], [[FEU, LUMIERE], null, false]);
  const bonus = (sortChoisi) => moment(f, sortChoisi).dsb.detail.filter((l) => /Symbiose/.test(l.nom)).map((l) => l.nom);
  assert.deepEqual(bonus(BOULE_DE_FEU), ['Mode Hyper 100 % : Symbiose (Feu)']);
  assert.deepEqual(bonus(FRAPPE_LUMINEUSE), ['Mode Hyper 100 % : Symbiose (Lumière)']);
  assert.equal(moment(f, FRAPPE_LUMINEUSE).inactif, null);
  assert.equal(M.resistancesDe(regles, f).desactivee, null);
  for (const e of [FEU, LUMIERE]) assert.equal(M.degatsRecus(regles, f, { entrants: 30, type: 'magique', element: e }).recus, 0, e);
  // en Symbiose simple (Mode Hyper sans 100 %), une seule magie
  const simple = { ...f, mode_hyper_100: 0, posture_id: POSTURE('symbiose') };
  assert.deepEqual(M.postureDuMoment(regles, simple).symbiose.magies.map((m) => m.id), [FEU]);
  assert.equal(moment(simple, FRAPPE_LUMINEUSE).inactif, 'Lumière');
});

test('R172 (C3) : +10 dégâts à toutes les attaques en Mode Hyper 100 %, en plus du Mode Hyper (armes et sorts ; pas les soins)', () => {
  const cent = enHyper(avecArme(), { cent: true });
  assert.ok(M.degatsDArmeDuMoment(regles, cent, 1).moment.some((l) => l.nom === 'Mode Hyper 100 %' && l.valeur === 10));
  const m = M.sortDuMoment(regles, cent, BOULE_DE_FEU, auNm(BOULE_DE_FEU));
  assert.deepEqual(m.dsb.detail.filter((l) => l.nom.startsWith('Mode Hyper') && !/Symbiose|postures/.test(l.nom)).map((l) => [l.nom, l.valeur]),
    [['Mode Hyper', 15], ['Mode Hyper 100 %', 10]]);
  assert.ok(!moment(cent, PREMIER_SOIN).dsb.detail.some((l) => l.nom === 'Mode Hyper 100 %'), 'pas les soins');
});

test('R172 (C4), R175, R18 : jauges — 65 de chakra maximum : 6 par tour, 48 à la sortie ; avec 40 de chakra, la sortie coûte 40 chakra et 16 santé', () => {
  const a = { ...M.attributsDe(regles, fiche()), chakra: 65, sante: 50, corruptionMax: 65 };
  const tour = M.tourDeModeHyper(regles, enHyper(), a);
  assert.deepEqual([tour.cout, tour.chakra, tour.sante, tour.ecrit], [6, { avant: 65, apres: 59 }, { avant: 50, apres: 50 }, { chakra_actuel: 59 }], 'la santé n’est écrite que si elle change');
  assert.equal(M.tourDeModeHyper(regles, enHyper({}, { cent: true }), a), null, 'pas en Mode Hyper 100 % : « le chakra ne s’évapore plus »');
  assert.equal(M.tourDeModeHyper(regles, fiche(), a), null, 'pas hors Mode Hyper');
  const sortie = M.finDuModeHyperCent(regles, enHyper({ chakra_actuel: 40 }, { cent: true }), a);
  assert.deepEqual([sortie.cout, sortie.manque, sortie.chakra, sortie.sante], [48, 8, { avant: 40, apres: 0 }, { avant: 50, apres: 34 }]);
  assert.deepEqual(sortie.ecrit, { chakra_actuel: 0, sante_actuelle: 34, mode_hyper_100: 0 }, 'le 100 % décoché, le Mode Hyper reste');
  assert.equal(M.finDuModeHyperCent(regles, enHyper(), a), null);
  // la santé peut devenir négative (R171) ; le chakra ne descend pas sous 0
  const vide = M.payerDuChakra(regles, fiche({ chakra_actuel: 0, sante_actuelle: 10 }), 48, a);
  assert.deepEqual(vide.ecrit, { chakra_actuel: 0, sante_actuelle: 10 - 96 });
});

test('R172 : tableur — l’état et le compteur dans la note (« Mode Hyper : actif, 100 %, semaine 0/1 »), relus tels quels', () => {
  assert.equal(texteDuModeHyper(M.modeHyperDe(regles, fiche())), '', 'rien à noter');
  const h = M.modeHyperDe(regles, enHyper({ mode_hyper_semaine: 0 }, { cent: true }));
  assert.equal(texteDuModeHyper(h), 'actif, 100 %, semaine 0/1');
  assert.equal(texteDuModeHyper(M.modeHyperDe(regles, fiche({ mode_hyper_semaine: 0 }))), 'inactif, semaine 0/1');
  assert.deepEqual(lireModeHyper('actif, 100 %, semaine 0/1'), { mode_hyper: 1, mode_hyper_100: 1, semaine: 0 });
  assert.deepEqual(lireModeHyper('inactif, semaine 0/1'), { mode_hyper: 0, mode_hyper_100: 0, semaine: 0 });
  assert.deepEqual(lireModeHyper('actif'), { mode_hyper: 1, mode_hyper_100: 0, semaine: null });
  assert.equal(lireModeHyper('inactif, 100 %'), null, 'le 100 % sans le Mode Hyper ne se lit pas');
  assert.equal(lireModeHyper('peut-être'), null);
  const { cellules } = cellulesDeLaFiche(regles, enHyper({ mode_hyper_semaine: 0 }, { cent: true }), { date: '30/10/2026' });
  const note = String(cellules[ORDINATEUR.note] ?? '');
  const lignes = note.slice(note.lastIndexOf(MARQUEUR_DES_NOTES)).split('\n').map(lireLigneDeNote).filter(Boolean);
  assert.deepEqual(lignes.find((l) => l.nom === 'modeHyper'), { nom: 'modeHyper', cle: 'Mode Hyper', valeur: 'actif, 100 %, semaine 0/1', information: false });
  // R177 : l'« AM Base » (AA24) d'un Marcass de niveau 10 écrit son don d'ethnie
  const marcass = fiche({ race_id: 'races/marcass', ethnie_id: 'races/marcass#ethnie:marcass-feu' }, 10);
  assert.equal(cellulesDeLaFiche(regles, marcass, { date: '30/10/2026' }).cellules[ORDINATEUR.armure.amBase], 6);
  // relu par l'import : l'aller-retour du .xlsx (test/fiche-tableur-aller-retour.test.mjs, « Bérénice » en Mode Hyper 100 %, compteur à 0)
});
