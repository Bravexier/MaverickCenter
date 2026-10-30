// Décision R172 (2026-10-29) : le Mode Hyper et le Mode Hyper 100 % activables sur la fiche — deux cases enregistrées (personnage.mode_hyper,
// mode_hyper_100, migration 0084 ; Mode Hyper dès le niveau 2, Mode Hyper 100 % dès le niveau 10 et seulement avec le Mode Hyper), un compteur « une
// fois par semaine » (personnage.mode_hyper_semaine, NULL au maximum) ; le Mode Hyper actif recalcule dégâts (armes +15 ; sorts de ses magies +15, +7
// avec deux, R5 ; tous ses sorts pour le Potentiel Illimité), soins (+15), coût des sorts (0 chakra, R18), résistances (immunité, grande résistance,
// Potentiel Illimité : +1 cran et malus physique annulé, R174) et les effets de magie et de race lus dans leur texte (Glace, Terre, Humain, Nain, Felfe,
// Jackalope, Marcass) ; le Mode Hyper 100 % cumule les avantages des postures (R100) sans leurs inconvénients et ajoute +10 à toutes les attaques ;
// les jauges, par un bouton : un tour retire ⌊10 %⌋ du chakra maximum, la sortie du Mode Hyper 100 % en consomme ⌊75 %⌋ (R175), le manque payé 2 santé
// pour 1 chakra (R18). Un sort préparé en Mode Hyper ou au 100 % garde leurs bonus après leur fin (R172, Q82 : prepare_hyper, prepare_cent, migration
// 0086 ; au 100 %, le dé de race aussi : Q84). Le Marcass en Mode Hyper : AP naturelle + AM naturelle + l'armure portée sur tout coup ; « L'attaque ignore l'armure » met tout à 0 (R178).
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

test('R177 : le don d’ethnie du Marcass « +2 Armure magique (+2 tous les 5 niveaux) », lu dans son texte, toujours dans l’AM de base de la fiche', () => {
  // l'armure naturelle écrite par un don de race ou d'ethnie, lue dans le texte : seuls les trois dons d'ethnie du Marcass l'écrivent
  const lus = db.prepare('SELECT id, texte FROM race_don').all().filter((d) => armureNaturelleEcrite(d.texte).length);
  assert.deepEqual(lus.map((d) => d.id).sort(), ['races/marcass#don:feu-en-innee', 'races/marcass#don:necromancie-en-innee', 'races/marcass#don:terre-en-innee']);
  for (const d of lus) assert.deepEqual(armureNaturelleEcrite(d.texte), [{ cle: 'am', base: 2, pas: 2, niveaux: 5 }], d.id);
  // « +2 Armure magique (+2 tous les 5 niveaux) », au niveau global comme R110 : 2 + 2 × ⌊N ÷ 5⌋
  const marcass = (niveau, x = {}) => fiche({ race_id: 'races/marcass', ethnie_id: 'races/marcass#ethnie:marcass-feu', ...x }, niveau);
  for (const [n, am] of [[1, 2], [4, 2], [5, 4], [9, 4], [10, 6], [20, 10]]) assert.equal(M.armureDesDonsDeRace(regles, marcass(n), 'am'), am, `niveau ${n}`);
  assert.equal(M.armureDesDonsDeRace(regles, marcass(10), 'ap'), 0, 'aucune AP écrite');
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
});

// Décision R178 : le Marcass en Mode Hyper — réduction de tout coup = AP naturelle + AM naturelle + l'armure du calcul classique (armure portée, bouclier)
const CHITINE = 'ressources/armures#armure:armure-peau-chitine'; // AP 6, AM 1 ; faible à la taille
const AMELIORATION_1 = 'ressources/armures#amelioration:armure:1'; // +2 AP/AM
/** Marcass de Terre de niveau 10, en Mode Hyper (exemple du propriétaire) : AP naturelle 25 (Terre), AM naturelle 6 (don d'ethnie), armure AP 8 et AM 3. */
const marcassDeTerre = (x = {}) => fiche({
  race_id: 'races/marcass', ethnie_id: 'races/marcass#ethnie:marcass-terre', magie_innee_id: TERRE, mode_hyper: 1, armure_id: CHITINE,
  armure_amelioration_id: AMELIORATION_1, ...x,
}, 10);
/** Un élément du coup magique auquel cette fiche n'a aucun palier (ni résistance ni faiblesse) : le calcul de l'armure seul. */
const elementNeutre = (f) => {
  const paliersDeLaFiche = paliers(M.resistancesDe(regles, f));
  return M.elementsDeDegats(regles).find((m) => !paliersDeLaFiche[`magie:${m.id}`]).id;
};

test('R178 : Marcass de Terre en Mode Hyper (AP naturelle 25, AM naturelle 6, armure AP 8 et AM 3) — 50 physiques : 39 retirés, 11 reçus ; 50 magiques : 34 retirés, 16 reçus', () => {
  const f = marcassDeTerre();
  const d = M.defenseDe(regles, f);
  assert.deepEqual([d.ap.total - d.ap.armure, d.am.total - d.am.armure, d.ap.armure, d.am.armure], [25, 6, 8, 3], 'les parts de l’exemple');
  const physique = M.degatsRecus(regles, f, { entrants: 50, type: 'frappe' });
  assert.deepEqual([physique.armure, physique.recus], [39, 11]);
  const element = elementNeutre(f);
  const magique = M.degatsRecus(regles, f, { entrants: 50, type: 'magique', element });
  assert.deepEqual([magique.armure, magique.recus], [34, 16]);
  // les étapes de l'infobulle, lisibles
  assert.deepEqual(physique.etapes.slice(1, 4), [
    { texte: '− AP naturelle (Mode Hyper, Marcass)', valeur: -25 },
    { texte: '− AM naturelle (Mode Hyper, Marcass)', valeur: -6 },
    { texte: '− AP de l’armure portée', valeur: -8 },
  ]);
  assert.deepEqual(magique.etapes[3], { texte: '− AM de l’armure portée', valeur: -3 });
  // la faiblesse de l'armure à la taille ne porte que sur sa part (8 ÷ 2 = 4) : 25 + 6 + 4
  const taille = M.degatsRecus(regles, f, { entrants: 50, type: 'taille' });
  assert.deepEqual([taille.armure, taille.recus, taille.etapes[3].texte], [35, 15, '− AP de l’armure portée (armure ÷ 2 contre taille)']);
  // chaque part naturelle une seule fois, même sans armure portée : 25 + 6
  assert.equal(M.degatsRecus(regles, marcassDeTerre({ armure_id: null, armure_amelioration_id: null }), { entrants: 50, type: 'frappe' }).recus, 19);
});

test('R178 : « naturel » = tout sauf l’armure portée et le bouclier — la posture et les accessoires en sont, le bouclier en parade partielle est de l’armure', () => {
  // la posture Défensif (2 × ⌈10 ÷ 4⌉ = 6 AP et AM) : naturelle, sur les deux
  const defensif = marcassDeTerre({ posture_id: POSTURE('defensif') });
  assert.equal(M.degatsRecus(regles, defensif, { entrants: 60, type: 'frappe' }).armure, 25 + 6 + 6 + 6 + 8);
  // le bouclier (Bocle Acier, AP 3) : en parade partielle, ajouté à l'armure portée (AP contre un coup physique), jamais une part naturelle
  const f = marcassDeTerre({ bouclier_classe_id: 'bocle', bouclier_materiau_id: 'ressources/armures#materiau:acier' });
  assert.equal(M.bouclierDe(regles, f).ap, 3);
  const avec = M.degatsRecus(regles, f, { entrants: 100, type: 'frappe', reduits: true, parade: true });
  assert.deepEqual([avec.armure, avec.etapes[3].texte], [39 + 3, '− AP de l’armure portée (bouclier +3)']);
  assert.equal(M.degatsRecus(regles, f, { entrants: 100, type: 'frappe' }).armure, 39, 'sans parade partielle : pas de bouclier');
});

test('R178 : la case « L’attaque ignore l’armure » met toute la réduction à 0, même pour le Marcass en Mode Hyper ; un non-Marcass et un Marcass hors Mode Hyper sont inchangés', () => {
  const f = marcassDeTerre();
  for (const coup of [{ type: 'frappe' }, { type: 'magique', element: elementNeutre(f) }]) {
    const r = M.degatsRecus(regles, f, { entrants: 50, ignoreArmure: true, ...coup });
    assert.deepEqual([r.armure, r.recus], [0, 50], coup.type);
    assert.match(r.etapes[1].texte, /l’attaque ignore l’armure : aucune réduction/);
    assert.equal(r.etapes[1].valeur, 0);
  }
  // un Marcass hors Mode Hyper : le calcul classique (AP contre le physique, AM contre le magique)
  const hors = marcassDeTerre({ mode_hyper: 0 });
  const dh = M.defenseDe(regles, hors);
  assert.equal(M.degatsRecus(regles, hors, { entrants: 50, type: 'frappe' }).armure, dh.ap.total);
  assert.equal(M.degatsRecus(regles, hors, { entrants: 50, type: 'magique', element: elementNeutre(hors) }).armure, dh.am.total);
  // un Humain de Terre en Mode Hyper : le calcul classique (son AP de base +25 comprise, une fois), pas l'AM en plus
  const humain = marcassDeTerre({ race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' });
  const d = M.defenseDe(regles, humain);
  const r = M.degatsRecus(regles, humain, { entrants: 50, type: 'frappe' });
  assert.deepEqual([r.armure, r.etapes[1].texte], [d.ap.total, '− AP']);
  assert.equal(d.ap.total, 25 + 8);
  assert.equal(M.degatsRecus(regles, humain, { entrants: 50, type: 'frappe', ignoreArmure: true }).recus, 50);
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

test('R172, R179 (Q85) : un sort préparé hors Mode Hyper, lancé au Mode Hyper 100 %, garde la posture de sa préparation — ni le cumul des postures, ni le +10, ni le +15, ni le dé de race', () => {
  // Mage Rouge Rubis (« Préparation »), Humain, Boule de feu préparée en Défensif hors Mode Hyper (prepare_hyper = 0)
  const mage = (x = {}) => ({
    ...fiche({ race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', mode_hyper: 1 }, 10),
    classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: 'classes/mage-rouge#specialite:mage-rubis' }],
    sorts: [{ sort_id: BOULE_DE_FEU.id, rang: 1, niveau_maitrise: 0, prepare: 1, prepare_jet: 50, prepare_posture_id: POSTURE('defensif') }], ...x,
  });
  assert.ok(M.sortPrepare(regles, mage()), 'le don de préparation');
  const cent = M.contexteDesSorts(regles, mage({ mode_hyper_100: 1 })).prepare;
  assert.deepEqual([cent.posture.cent, cent.posture.diviseur, cent.posture.degatsMaximum, cent.modeHyper], [false, 2, false, null]);
  const m = M.sortDuMoment(regles, mage({ mode_hyper_100: 1 }), BOULE_DE_FEU, auNm(BOULE_DE_FEU, '2d6 + 5 dégâts'));
  assert.deepEqual([m.prepare, m.posture.nom, m.dsb.diviseur, m.dsb.texte, m.prepareModeHyper], [true, 'Défensif', 2, '2d6 + 5 dégâts', null]);
  assert.ok(!m.dsb.detail.some((l) => /Mode Hyper/.test(l.nom)), 'rien du Mode Hyper du moment');
  // le coût, lui, est celui du moment (0 chakra en Mode Hyper : pas une valeur du sort préparé)
  assert.equal(m.cout.texte, '0');
  // un autre sort, lancé au 100 % : le cumul, le +15, le +10 et le dé de l'Humain du moment
  const autre = M.sortDuMoment(regles, mage({ mode_hyper_100: 1 }), FRAPPE_LUMINEUSE, auNm(FRAPPE_LUMINEUSE));
  assert.deepEqual([autre.posture.nom, autre.dsb.diviseur], ['Mode Hyper 100 %', 1]);
});

// Décisions R172, R179 (réponses à Q82 « Oui : 2d6+20 », Q84, Q85, Q87) : le sort préparé est figé à sa préparation — préparé en Mode Hyper, il garde son
// +15 (+7) et le dé de race jusqu'au lancer, même après la fin du Mode Hyper ; préparé au Mode Hyper 100 %, en plus le cumul des postures et le +10 ;
// préparé hors Mode Hyper, il ne reçoit rien du Mode Hyper du lancer (personnage_sort.prepare_hyper, prepare_cent, migration 0086)
/** Mage Rouge Rubis (« Préparation »), Feu inné, niveau 10, la Boule de feu et l'Étincelle dans ses sorts, sans posture ni race (sans dé de race). */
const mageRouge = (x = {}) => ({
  ...fiche({}, 10),
  classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: 'classes/mage-rouge#specialite:mage-rubis' }],
  sorts: [{ sort_id: BOULE_DE_FEU.id, rang: 1, niveau_maitrise: 0 }, { sort_id: 'magies/magie-du-feu#sort:etincelle', rang: 2, niveau_maitrise: 0 }], ...x,
});
/** La fiche après la préparation de la Boule de feu dans l'état `pendant`, puis passée à l'état `apres`. */
const preparePuis = (pendant, apres = {}) => {
  const f = mageRouge(pendant);
  return { ...f, sorts: M.sortsApresPreparation(regles, f, BOULE_DE_FEU.id), ...apres };
};
const HORS = { mode_hyper: 0, mode_hyper_100: 0 };

test('R172 (Q82) : préparer écrit l’état du Mode Hyper (prepare_hyper, prepare_cent) ; « Lâcher le sort » et la Symbiose d’une autre magie remettent les trois à 0', () => {
  const ligne = (f) => f.sorts.slice(0, 1).map((l) => [l.prepare, l.prepare_hyper, l.prepare_cent]);
  assert.deepEqual(ligne(preparePuis({})), [[1, 0, 0]], 'hors Mode Hyper');
  assert.deepEqual(ligne(preparePuis({ mode_hyper: 1 })), [[1, 1, 0]], 'en Mode Hyper');
  assert.deepEqual(ligne(preparePuis({ mode_hyper: 1, mode_hyper_100: 1 })), [[1, 1, 1]], 'au Mode Hyper 100 %');
  // une case cochée que le niveau ne débloque pas ne compte pas (modeHyperDe.actif)
  assert.deepEqual(ligne(preparePuis({ mode_hyper: 1, xp: xpDuNiveau(1) })), [[1, 0, 0]]);
  assert.deepEqual(ligne(preparePuis({ mode_hyper: 1, mode_hyper_100: 1, xp: xpDuNiveau(5) })), [[1, 1, 0]]);
  const cent = preparePuis({ mode_hyper: 1, mode_hyper_100: 1 });
  assert.deepEqual([M.sortPrepare(regles, cent).hyper, M.sortPrepare(regles, cent).cent], [true, true]);
  assert.deepEqual(M.sortsAEnregistrer(regles, cent).map((l) => [l.prepare_hyper, l.prepare_cent]), [[1, 1], [0, 0]], 'gardés à l’enregistrement, le sort préparé seul');
  // « Lâcher le sort » : les trois à 0 (la base refuse prepare_hyper sans prepare)
  assert.deepEqual(ligne({ sorts: M.sortsApresPreparation(regles, cent, null) }), [[0, 0, 0]]);
  // un autre sort sur l'emplacement : sans la préparation de l'ancien
  assert.deepEqual(ligne({ sorts: M.sortsApresChoixDEmplacement(cent, 0, 'magies/magie-du-feu#sort:braise-magique') }), [[0, 0, 0]]);
  // R135 : en Symbiose d'une autre magie, le sort préparé est perdu, Mode Hyper compris
  const symbiose = { ...cent, ...HORS, magie_acquise_id: LUMIERE, posture_id: POSTURE('symbiose'), symbiose_magie_id: LUMIERE };
  assert.equal(M.sortPrepare(regles, symbiose), null);
  assert.deepEqual(ligne({ sorts: M.sortsApresLaSymbiose(regles, symbiose) }), [[0, 0, 0]]);
});

test('R172 (Q82) : préparé en Mode Hyper, 2d6+5 lancé après la fin du Mode Hyper → 2d6+20 (une magie) ; hors Mode Hyper, rien de figé ; jamais deux fois', () => {
  const lance = (f, dsb = '2d6 + 5 dégâts') => M.sortDuMoment(regles, f, BOULE_DE_FEU, auNm(BOULE_DE_FEU, dsb));
  const apres = preparePuis({ mode_hyper: 1 }, HORS);
  const m = lance(apres);
  assert.equal(m.dsb.texte, '2d6 + 20 dégâts');
  assert.deepEqual(m.dsb.detail.filter((l) => l.nom.startsWith('Mode Hyper')), [{ nom: 'Mode Hyper (à la préparation)', valeur: 15 }]);
  assert.equal(m.prepareModeHyper, 'Mode Hyper');
  // ses soins aussi (+15)
  assert.equal(lance(apres, '2d6 soin').dsb.texte, '2d6 + 15 soin');
  // rien d'autre du Mode Hyper : le coût revient (4), un autre sort n'a rien
  assert.equal(m.cout.texte, '4');
  const etincelle = sort('magies/magie-du-feu#sort:etincelle');
  assert.ok(!M.sortDuMoment(regles, apres, etincelle, auNm(etincelle, '3d6 dégâts')).dsb.detail.some((l) => l.nom.startsWith('Mode Hyper')));
  // pendant le Mode Hyper : +15 une seule fois, celui de la préparation
  assert.equal(lance(preparePuis({ mode_hyper: 1 })).dsb.texte, '2d6 + 20 dégâts');
  // le Mode Hyper relancé (ou décoché, recoché) ne change rien au sort déjà préparé
  assert.equal(lance({ ...apres, mode_hyper: 1 }).dsb.texte, '2d6 + 20 dégâts');
  // préparé hors Mode Hyper : rien, lancé hors Mode Hyper comme en Mode Hyper (Q85 : « Non : 2d6+5 »)
  assert.equal(lance(preparePuis({})).dsb.texte, '2d6 + 5 dégâts');
  assert.equal(lance(preparePuis({}, { mode_hyper: 1 })).dsb.texte, '2d6 + 5 dégâts');
  // le nombre de magies, lu au lancer (R179 : il ne peut pas changer en combat) — une magie acquise : +7
  assert.equal(lance({ ...apres, magie_acquise_id: LUMIERE }).dsb.texte, '2d6 + 12 dégâts');
  // la posture de sa préparation reste (R115) : préparé en Défensif, ÷ 2
  assert.equal(lance(preparePuis({ mode_hyper: 1, posture_id: POSTURE('defensif') }, { ...HORS, posture_id: POSTURE('offensif') })).dsb.diviseur, 2);
});

test('R172 (Q82) : préparé au Mode Hyper 100 %, il garde le cumul des postures, le +10 et le +15 après la sortie du 100 % et du Mode Hyper', () => {
  const lance = (f) => M.sortDuMoment(regles, f, BOULE_DE_FEU, auNm(BOULE_DE_FEU, '2d6 + 5 dégâts'));
  const pendant = preparePuis({ mode_hyper: 1, mode_hyper_100: 1, posture_id: POSTURE('defensif') });
  const sorti = { ...pendant, mode_hyper_100: 0 };
  const fini = { ...pendant, ...HORS };
  const attendu = lance(pendant).dsb.texte;
  for (const [nom, f] of [['après la sortie du 100 %', sorti], ['après la fin du Mode Hyper', fini]]) {
    const m = lance(f);
    assert.equal(m.dsb.texte, attendu, nom);
    assert.deepEqual([m.posture.nom, m.dsb.diviseur, m.prepareModeHyper], ['Mode Hyper 100 %', 1, 'Mode Hyper 100 %'], nom);
    const p = M.contexteDesSorts(regles, f).prepare.posture;
    assert.deepEqual([p.cent, p.degatsMaximum, p.crans], [true, true, 1], `${nom} : le cumul des postures`);
  }
  // Focus (d6 → d8) puis Offensif (au maximum : 16), +5, la Symbiose, +15 et +10
  const m = lance(fini);
  const symbiose = M.postureDuMoment(regles, pendant).symbiose.degats;
  assert.equal(m.dsb.texte, `${16 + 5 + symbiose + 15 + 10} dégâts`);
  assert.deepEqual(m.dsb.detail.filter((l) => /à la préparation/.test(l.nom)).map((l) => [l.nom, l.valeur]),
    [['Mode Hyper (à la préparation)', 15], ['Mode Hyper 100 % (à la préparation)', 10]]);
  // après la sortie du 100 %, en Mode Hyper : tout vient de la préparation
  assert.deepEqual(lance(sorti).dsb.detail.filter((l) => l.nom.startsWith('Mode Hyper') && !/postures|Symbiose/.test(l.nom)).map((l) => l.nom),
    ['Mode Hyper (à la préparation)', 'Mode Hyper 100 % (à la préparation)']);
  // préparé en Mode Hyper normal (prepare_cent = 0), lancé au 100 % : ni le +10 ni le cumul, la posture de sa préparation (aucune)
  const simple = lance(preparePuis({ mode_hyper: 1 }, { mode_hyper_100: 1 }));
  assert.deepEqual([simple.dsb.texte, simple.posture, simple.prepareModeHyper], ['2d6 + 20 dégâts', null, 'Mode Hyper']);
});

test('R172 (Q84) : préparé au Mode Hyper 100 %, il garde le dé de race du Mode Hyper — Humain : 2d6+5 lancé après la sortie, 3D8 au maximum (24) + 30, et la Symbiose cumulée', () => {
  const humain = { race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' };
  const lance = (f, dsb = '2d6 + 5 dégâts') => M.sortDuMoment(regles, f, BOULE_DE_FEU, auNm(BOULE_DE_FEU, dsb));
  const fini = preparePuis({ ...humain, mode_hyper: 1, mode_hyper_100: 1 }, HORS);
  const m = lance(fini);
  // Focus (d6 → d8), +1 dé de l'Humain, Offensif au maximum : 3 × 8 = 24 ; +5, +15, +10 : les 30 de la réponse du propriétaire (« 3D8 au maximum + 30
  // = 54 ») ; le cumul des postures du 100 % compte aussi la Symbiose (R172 : « Pour les deux magies »), en plus (question posée au propriétaire)
  const symbiose = M.postureDuMoment(regles, { ...fini, mode_hyper: 1, mode_hyper_100: 1 }).symbiose.degats;
  assert.ok(m.dsb.detail.some((l) => l.nom === 'Mode Hyper (Adrénaline, Humain) (à la préparation) : +1d' && l.des === 1));
  assert.deepEqual(m.dsb.detail.find((l) => l.maximum).valeur, 24, '3D8 au maximum');
  assert.equal(m.dsb.texte, `${54 + symbiose} dégâts`);
  // jamais deux fois : pendant le 100 %, le même total (le dé du moment)
  assert.equal(lance(preparePuis({ ...humain, mode_hyper: 1, mode_hyper_100: 1 })).dsb.texte, m.dsb.texte);
  // pas aux soins (« toutes les attaques »)
  assert.equal(lance(fini, '2d6 soin').dsb.texte, `2d8 + ${15 + symbiose} soin`);
});

test('R172 (Q84) : Felfe préparé au Mode Hyper 100 % — +2 dés aux dégâts et aux soins magiques gardés après la sortie du Mode Hyper', () => {
  const felfe = { race_id: 'races/felfe', ethnie_id: 'races/felfe#ethnie:felfe-forestier' };
  const lance = (f, dsb) => M.sortDuMoment(regles, f, BOULE_DE_FEU, auNm(BOULE_DE_FEU, dsb));
  const fini = preparePuis({ ...felfe, mode_hyper: 1, mode_hyper_100: 1 }, HORS);
  const symbiose = M.postureDuMoment(regles, { ...fini, mode_hyper: 1, mode_hyper_100: 1 }).symbiose.degats;
  // 4D8 au maximum (32) + 5 + 15 + 10 + la Symbiose
  assert.equal(lance(fini, '2d6 + 5 dégâts').dsb.texte, `${32 + 30 + symbiose} dégâts`);
  assert.equal(lance(fini, '2d6 soin').dsb.texte, `4d8 + ${15 + symbiose} soin`);
});

test('R172, R179 (Q85, Q87) : le dé de race du Mode Hyper suit le sort préparé — préparé en Mode Hyper : Humain 3d6+20, Felfe 4d6+20 après la fin ; préparé hors Mode Hyper : aucun', () => {
  const humain = { race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central' };
  const felfe = { race_id: 'races/felfe', ethnie_id: 'races/felfe#ethnie:felfe-forestier' };
  const lance = (f, dsb = '2d6 + 5 dégâts') => M.sortDuMoment(regles, f, BOULE_DE_FEU, auNm(BOULE_DE_FEU, dsb)).dsb.texte;
  // Q87, « Oui : 3d6+20 »
  assert.equal(lance(preparePuis({ ...humain, mode_hyper: 1 }, HORS)), '3d6 + 20 dégâts');
  assert.equal(lance(preparePuis({ ...humain, mode_hyper: 1 })), '3d6 + 20 dégâts', 'pendant le Mode Hyper : une fois');
  // R179, « Non : reste figé comme préparé » : préparé en Mode Hyper normal, lancé au 100 % — ni +10, ni cran de Focus, ni maximum d'Offensif
  assert.equal(lance(preparePuis({ ...humain, mode_hyper: 1 }, { mode_hyper_100: 1 })), '3d6 + 20 dégâts');
  assert.equal(lance(preparePuis({ ...felfe, mode_hyper: 1 }, HORS)), '4d6 + 20 dégâts');
  assert.equal(lance(preparePuis({ ...felfe, mode_hyper: 1 }, HORS), '2d6 soin'), '4d6 + 15 soin');
  // Q85 : préparé hors Mode Hyper, lancé en Mode Hyper : ni le +15, ni le dé de race
  assert.equal(lance(preparePuis(humain, { mode_hyper: 1 })), '2d6 + 5 dégâts');
  assert.equal(lance(preparePuis(felfe, { mode_hyper: 1 }), '2d6 soin'), '2d6 soin');
});

test('R179 (Q86) : « Fin de combat » lâche le sort préparé — marque, jet, posture, Mode Hyper et Mode Hyper 100 % remis à zéro, avec les compteurs par combat', () => {
  const f = { ...preparePuis({ mode_hyper: 1, mode_hyper_100: 1, posture_id: POSTURE('offensif') }) };
  f.sorts = M.sortsApresLeJet(regles, f, 57);
  assert.deepEqual(f.sorts.map((l) => [l.prepare, l.prepare_jet, l.prepare_posture_id, l.prepare_hyper, l.prepare_cent]),
    [[1, 57, POSTURE('offensif'), 1, 1], [0, null, null, 0, 0]]);
  const ecrit = M.finDeCombat(regles, f);
  assert.deepEqual(Object.keys(ecrit).sort(), ['actions_usage', 'sorts']);
  assert.deepEqual(ecrit.sorts.map((l) => [l.sort_id, l.prepare, l.prepare_jet, l.prepare_posture_id, l.prepare_hyper, l.prepare_cent]),
    [[BOULE_DE_FEU.id, 0, null, null, 0, 0], ['magies/magie-du-feu#sort:etincelle', 0, null, null, 0, 0]]);
  assert.equal(M.sortPrepare(regles, { ...f, ...ecrit }), null, 'plus aucun sort préparé');
  // sans sort préparé, les sorts ne sont pas réécrits
  assert.deepEqual(Object.keys(M.finDeCombat(regles, mageRouge())), ['actions_usage']);
  // le bouton est montré dès qu'un sort est préparé, même sans action « par combat » (un Mage Rouge de niveau 1 : « Préparation », pas encore « Voit
  // rouge ») ; ni l'un ni l'autre : caché
  const niveau1 = preparePuis({ xp: xpDuNiveau(1), classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: null }] });
  assert.ok(M.sortPrepare(regles, niveau1));
  assert.equal(M.actionsDeLaFiche(regles, niveau1).some((a) => a.compteur?.remontee === 'fin_de_combat'), false, 'aucune action par combat');
  assert.equal(M.finDeCombatMontree(regles, niveau1), true);
  assert.equal(M.finDeCombatMontree(regles, { ...niveau1, ...M.finDeCombat(regles, niveau1) }), false, 'lâché : plus de bouton');
  // une marque que le don ne permet plus (sans classe) : aucun sort préparé visible, pas de bouton
  const sansDon = { ...niveau1, classes: [] };
  assert.deepEqual([M.sortPrepare(regles, sansDon), M.finDeCombatMontree(regles, sansDon)], [null, false]);
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
