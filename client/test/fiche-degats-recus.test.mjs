// Les dégâts reçus de la fiche, suite de R98 (décision R171) : le coup en type (Estoc, Taille, Frappe ou Magique) et élément (l'une des quatorze magies,
// facultatif, obligatoire avec « Magique ») ; le bouton « Appliquer » qui baisse la barrière du moment, puis la santé (sans plancher) ; les cases de la
// barrière (Passe, Casse, Laiton, Médusain), la case du Médusain cochée d'office selon le don et le coup ; tous les arrondis à l'inférieur (R175).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false })))); // tel que la page le reçoit
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', ...x });
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const POSTURE = (slug) => `guide/postures#posture:${slug}`;
const FEU = 'magies/magie-du-feu';
const GLACE = 'magies/magie-de-la-glace';
const PI = 'magies/potentiel-illimite';

/**
 * Le calcul d'avant R171 (R98, R100, R108, R155), recopié tel qu'il était : un seul type parmi les dix-sept de typesDeDegats. Sert à épingler
 * l'équivalence : un type physique sans élément, ou « Magique » et un élément, donnent exactement ce qu'il donnait.
 */
function ancienCalcul(regles, f, options = {}) {
  const entier = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const { entrants = 0, type = null, reduits = false, parade = false, don = false } = options;
  const partie = options.partie ?? M.PARTIE_PAR_DEFAUT;
  const t = M.typesDeDegats(regles).find((x) => x.id === type);
  if (!t) return null;
  const d = M.defenseDe(regles, f, undefined, { partie });
  const brut = Math.max(0, entier(entrants));
  const etapes = [{ texte: 'Dégâts entrants', valeur: brut }];
  const x = t.physique ? d.ap : d.am;
  let facteur = 1;
  if (t.physique && !d.element && !d.partie?.cassee) {
    const armure = M.trouver(regles.armures ?? [], f.armure_id);
    for (const r of (armure?.degats ?? []).filter((y) => y.type === t.id)) {
      const k = 2 * Math.max(1, entier(r.multiplicateur));
      facteur *= r.sens === 'resistance' ? k : 1 / k;
    }
  }
  let armure = x.total - x.armure + x.armure * facteur;
  const auBouclier = reduits && parade && d.bouclier;
  const bouclier = auBouclier && !d.bouclier.cassee ? (t.physique ? d.bouclier.ap : d.bouclier.am) : 0;
  armure += bouclier;
  const nomArmure = t.physique ? 'AP' : 'AM';
  const precisions = [
    facteur !== 1 ? `armure ${facteur > 1 ? `× ${facteur}` : `÷ ${1 / facteur}`} contre ${t.nom.toLowerCase()}` : null,
    d.partie?.cassee ? `partie ${d.partie.nom} cassée : l’armure n’y compte pas` : null,
    bouclier ? `bouclier +${bouclier}` : null,
    auBouclier && d.bouclier.cassee ? 'bouclier cassé : il ne compte plus' : null,
  ].filter(Boolean);
  etapes.push({ texte: `− ${nomArmure}${precisions.map((p) => ` (${p})`).join('')}`, valeur: -armure });
  let reste = Math.max(0, brut - armure);
  if (reduits) {
    reste /= 2;
    etapes.push({ texte: 'Défense partielle : ÷ 2', valeur: reste });
  }
  if (don) {
    reste /= 2;
    etapes.push({ texte: 'Don qui divise les dégâts : ÷ 2', valeur: reste });
  }
  const symbiose = t.physique ? null : M.postureDuMoment(regles, f)?.symbiose;
  if (symbiose?.immunite && symbiose.magie?.id === t.id) {
    reste = 0;
    etapes.push({ texte: `Symbiose avec ${symbiose.magie.nom} : immunité`, valeur: 0 });
  } else if (!t.physique) {
    const palier = M.resistancesDe(regles, f).paliers.find((p) => p.cibles.some((c) => c.type === 'magie' && c.id === t.id));
    const mult = palier ? (regles.resistance_paliers ?? []).find((p) => p.id === palier.id)?.multiplicateur ?? 1 : 1;
    if (palier) {
      reste = M.appliquerMultiplicateur(reste, mult);
      etapes.push({ texte: `${palier.libelle} (${palier.effet})`, valeur: reste });
    }
  }
  return { recus: Math.floor(reste), etapes, armure, partie: d.partie };
}

test('R171 : les types d’un coup (Estoc, Taille, Frappe, Magique) et ses éléments (les quatorze magies, sans le Potentiel Illimité)', () => {
  assert.deepEqual(M.TYPES_DE_COUP.map((t) => [t.id, t.nom, t.physique]),
    [['estoc', 'Estoc', true], ['taille', 'Taille', true], ['frappe', 'Frappe', true], ['magique', 'Magique', false]]);
  const elements = M.elementsDeDegats(regles);
  assert.equal(elements.length, 14);
  assert.ok(!elements.some((m) => m.id === PI));
  // « Magique » sans élément : pas de calcul ; un élément qui n'en est pas un (le Potentiel Illimité, un inconnu) : non plus
  assert.equal(M.coupDeDegats(regles, { type: 'magique' }), null);
  assert.equal(M.degatsRecus(regles, fiche(), { entrants: 10, type: 'magique' }), null, 'Magique sans élément : pas de calcul');
  assert.equal(M.coupDeDegats(regles, { type: 'magique', element: PI }), null);
  assert.equal(M.coupDeDegats(regles, { type: 'estoc', element: PI }), null);
  assert.equal(M.coupDeDegats(regles, { type: 'inconnu' }), null);
  assert.equal(M.coupDeDegats(regles, { type: PI }), null);
  // un type physique, avec ou sans élément
  assert.deepEqual([M.coupDeDegats(regles, { type: 'estoc' }).type.id, M.coupDeDegats(regles, { type: 'estoc' }).element], ['estoc', null]);
  assert.equal(M.coupDeDegats(regles, { type: 'estoc', element: FEU }).element.id, FEU);
  // l'écriture d'avant (une magie en type) : « Magique » et cette magie
  const ancien = M.coupDeDegats(regles, { type: FEU });
  assert.deepEqual([ancien.type.id, ancien.element.id], ['magique', FEU]);
});

test('R171 : un type physique sans élément et « Magique » + élément donnent exactement les dix-sept types d’avant (typesDeDegats), et leur calcul', () => {
  // les dix-sept coups : un par type d'avant, et réciproquement
  const coups = [...M.TYPES_DE_COUP.filter((t) => t.physique).map((t) => ({ type: t.id })),
    ...M.elementsDeDegats(regles).map((m) => ({ type: 'magique', element: m.id }))];
  const types = coups.map((c) => M.typeDeDegatsDuCoup(M.coupDeDegats(regles, c)));
  assert.deepEqual(types, M.typesDeDegats(regles).map((t) => t.id), 'dans le même ordre, sans doublon');
  assert.equal(M.typeDeDegatsDuCoup(M.coupDeDegats(regles, { type: 'taille', element: FEU })), null, 'un coup physique avec un élément n’en a pas');
  // le calcul : le même résultat, les mêmes étapes, sur des fiches qui touchent chaque étape (armure qui résiste ou est faible, paliers, Symbiose,
  // bouclier, partie cassée, défense partielle, don)
  const resiste = regles.armures.find((a) => a.ap >= 2 && Number(a.solidite_uni) !== 1 && a.degats.some((r) => r.sens === 'resistance'));
  const faible = regles.armures.find((a) => a.ap >= 2 && a.degats.some((r) => r.sens === 'vulnerabilite'));
  const element = regles.armures_elementaires.find((e) => e.ap && e.am);
  const fiches = {
    humain: fiche(),
    feu: fiche({ magie_innee_id: FEU, armure_id: resiste.id, armure_parties: [{ emplacement_id: 'bras-droit', solidite: 0 }] }),
    faible: fiche({ magie_innee_id: GLACE, magie_acquise_id: 'magies/magie-de-la-terre', armure_id: faible.id }),
    fenrir: fiche({ race_id: 'races/fenrir', ethnie_id: 'races/fenrir#ethnie:fenrir-de-glace', magie_innee_id: GLACE, bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:fer' }),
    symbiose: fiche({ magie_innee_id: FEU, magie_acquise_id: GLACE, posture_id: POSTURE('symbiose'), symbiose_magie_id: GLACE }),
    defensif: fiche({ magie_innee_id: FEU, posture_id: POSTURE('defensif'), xp: xpDuNiveau(9), armure_elementaire_id: element.id }),
  };
  const reglages = [{}, { reduits: true }, { reduits: true, parade: true }, { don: true }, { reduits: true, don: true, partie: 'bras-droit' }];
  let n = 0;
  for (const [nom, f] of Object.entries(fiches)) {
    for (const coup of coups) {
      for (const entrants of [0, 7, 41, 100]) {
        for (const r of reglages) {
          const ancien = ancienCalcul(regles, f, { entrants, type: M.typeDeDegatsDuCoup(M.coupDeDegats(regles, coup)), ...r });
          const nouveau = M.degatsRecus(regles, f, { entrants, ...coup, ...r });
          assert.deepEqual({ recus: nouveau.recus, etapes: nouveau.etapes, armure: nouveau.armure, partie: nouveau.partie }, ancien, `${nom}, ${JSON.stringify(coup)}, ${entrants}, ${JSON.stringify(r)}`);
          // l'écriture d'avant (une magie en type) reste acceptée et donne le même calcul
          if (coup.element) assert.deepEqual(M.degatsRecus(regles, f, { entrants, type: coup.element, ...r }), nouveau);
          n += 1;
        }
      }
    }
  }
  assert.equal(n, Object.keys(fiches).length * 17 * 4 * reglages.length);
});

test('R171 : un coup Estoc + Feu prend l’AP (avec la résistance de l’armure à l’estoc), puis le palier de résistance au Feu ; la Symbiose de sa magie l’annule', () => {
  const armure = regles.armures.find((a) => a.ap >= 2 && a.degats.some((r) => r.sens === 'resistance' && r.type === 'estoc' && r.multiplicateur === 1)
    && !a.degats.some((r) => r.type === 'estoc' && r.sens !== 'resistance'));
  assert.ok(armure, 'une armure qui résiste à l’estoc');
  const f = fiche({ magie_innee_id: FEU, armure_id: armure.id });
  const palier = M.resistancesDe(regles, f).paliers.find((p) => p.cibles.some((c) => c.id === FEU));
  assert.ok(palier, 'le Feu inné : une résistance au Feu');
  const mult = regles.resistance_paliers.find((p) => p.id === palier.id).multiplicateur;
  const physique = M.degatsRecus(regles, f, { entrants: 61, type: 'estoc' });
  const coup = M.degatsRecus(regles, f, { entrants: 61, type: 'estoc', element: FEU });
  // l'AP, pas l'AM : la même armure que le coup sans élément, doublée contre l'estoc
  assert.equal(coup.armure, physique.armure);
  assert.equal(coup.armure, M.defenseDe(regles, f).ap.total + M.defenseDe(regles, f).ap.armure, 'AP × 2 sur la part de l’armure');
  assert.equal(coup.recus, Math.floor(M.appliquerMultiplicateur(Math.max(0, 61 - coup.armure), mult)));
  assert.deepEqual(coup.etapes.map((e) => e.texte), [...physique.etapes.map((e) => e.texte), `${palier.libelle} (${palier.effet})`], 'puis le palier du Feu');
  assert.deepEqual([coup.type.id, coup.element.id], ['estoc', FEU]);
  // défense partielle : ÷ 2 avant le palier
  const partielle = M.degatsRecus(regles, f, { entrants: 61, type: 'estoc', element: FEU, reduits: true });
  assert.equal(partielle.recus, Math.floor(M.appliquerMultiplicateur(Math.max(0, 61 - coup.armure) / 2, mult)));
  // « Magique » + Feu : l'AM ; Estoc + Feu : l'AP
  assert.equal(M.degatsRecus(regles, f, { entrants: 61, type: 'magique', element: FEU }).armure, M.defenseDe(regles, f).am.total);
  // la Symbiose avec le Feu : immunité à sa magie, même portée par un coup physique
  const symbiose = { ...f, posture_id: POSTURE('symbiose') };
  assert.equal(M.degatsRecus(regles, symbiose, { entrants: 61, type: 'estoc', element: FEU }).recus, 0);
  assert.ok(M.degatsRecus(regles, symbiose, { entrants: 61, type: 'estoc' }).recus > 0, 'sans élément, rien de la Symbiose');
});

test('R171 : « Appliquer » — la barrière d’abord, puis la santé ; les exemples de la décision (20 reçus, barrière 12, santé 40)', () => {
  const avant = { barriere: 12, sante: 40 };
  const apres = (recus, cases = {}, x = avant) => {
    const r = M.degatsALaBarriere(recus, x, cases);
    return [r.barriere, r.sante];
  };
  assert.deepEqual(apres(20), [0, 32], 'sans case : 12 pris par la barrière, 8 à la santé');
  assert.deepEqual(apres(5), [7, 40], 'la barrière seule');
  assert.deepEqual(apres(12), [0, 40], 'la barrière juste vidée');
  assert.deepEqual(apres(20, { passe: true }), [12, 20], 'Passe la barrière : elle ne bouge pas, tout à la santé');
  assert.deepEqual(apres(20, { casse: true }), [0, 20], 'Casse la barrière : 0 sans rien absorber, tout à la santé');
  assert.deepEqual(apres(20, { laiton: true }), [0, 26], 'Laiton : 6 points la vident, santé 26');
  assert.deepEqual(apres(20, { medusain: true }), [2, 40], 'Médusain : barrière 2, la santé ne bouge pas');
  assert.deepEqual(apres(30, { medusain: true }), [0, 34], 'Médusain, 30 reçus : 24 points la vident, santé 34');
  assert.deepEqual(apres(24, { medusain: true }), [0, 40], 'Médusain, reçus = 2B : vidée, la santé ne bouge pas');
  // arrondis à l'inférieur (R175) : le Médusain retire ⌊reçus ÷ 2⌋ ; le Laiton vide la barrière en ⌈B ÷ 2⌉ points (le dernier peut ne retirer qu'1)
  assert.deepEqual(apres(3, { medusain: true }), [11, 40], '3 × 0,5 = 1,5 → 1');
  assert.deepEqual(apres(25, { medusain: true }), [0, 39]);
  assert.deepEqual(apres(2, { laiton: true }, { barriere: 5, sante: 40 }), [1, 40]);
  assert.deepEqual(apres(3, { laiton: true }, { barriere: 5, sante: 40 }), [0, 40], '⌈5 ÷ 2⌉ = 3 points la vident');
  assert.deepEqual(apres(4, { laiton: true }, { barriere: 5, sante: 40 }), [0, 39]);
  // R171, réponse du propriétaire « Oui, comme ça » : barrière impaire, le dernier point ne retire que ce qui reste, les suivants baissent la santé
  assert.deepEqual(apres(20, { laiton: true }, { barriere: 5, sante: 40 }), [0, 23]);
  // la barrière déjà à 0 : tout à la santé, quelles que soient les cases
  for (const cases of [{}, { laiton: true }, { medusain: true }, { laiton: true, medusain: true }]) {
    assert.deepEqual(apres(9, cases, { barriere: 0, sante: 40 }), [0, 31], JSON.stringify(cases));
  }
  // 0 reçu : rien ne bouge, quelle que soit la case (réponse du propriétaire : « Non, il faut des dégâts »)
  for (const cases of [{}, { casse: true }, { passe: true }, { laiton: true }, { medusain: true }, { laiton: true, medusain: true }, { casse: true, medusain: true }]) {
    assert.deepEqual(apres(0, cases), [12, 40], `0 reçu ${JSON.stringify(cases)}`);
  }
  assert.deepEqual(apres(1, { casse: true }), [0, 39], 'Casse : dès 1 point, la barrière tombe à 0 et tout va à la santé');
});

test('R171 : la santé du moment devient négative, sans plancher ; la barrière reste ≥ 0', () => {
  assert.deepEqual(M.degatsALaBarriere(20, { barriere: 3, sante: 5 }, {}), { barriere: 0, sante: -12, absorbes: 3, etapes: [] });
  assert.equal(M.degatsALaBarriere(50, { barriere: 0, sante: -12 }, { passe: true }).sante, -62);
  // sur une fiche : valeursDuMoment, ecrireValeurDuMoment et ajusterValeurDuMoment gardent la santé négative
  const f = fiche({ sante_actuelle: 5, barriere_actuelle: 2 });
  const a = M.attributsDe(regles, f);
  assert.ok(a.barriere >= 2 && a.sante >= 5, 'un humain a de la barrière et de la santé');
  const r = M.appliquerDegatsRecus(regles, f, 20);
  assert.deepEqual(r.ecrit, { barriere_actuelle: 0, sante_actuelle: -13 });
  assert.deepEqual([r.barriere, r.sante, r.absorbes], [{ avant: 2, apres: 0 }, { avant: 5, apres: -13 }, 2]);
  const blesse = { ...f, ...r.ecrit };
  const sante = M.valeursDuMoment(regles, blesse).find((j) => j.champ === 'sante_actuelle');
  assert.deepEqual([sante.valeur, sante.min, sante.hors], [-13, null, false], 'gardée telle quelle, pas « hors »');
  assert.deepEqual(M.ecrireValeurDuMoment(regles, blesse, 'sante_actuelle', -20), { sante_actuelle: -20 });
  assert.deepEqual(M.ecrireValeurDuMoment(regles, blesse, 'barriere_actuelle', -20), { barriere_actuelle: 0 }, 'la barrière, elle, au moins 0');
  assert.deepEqual(M.ajusterValeurDuMoment(regles, blesse, 'sante_actuelle', 3), { sante_actuelle: -10 });
  // une barrière pleine (rien d'enregistré : au maximum) absorbe d'abord
  const pleine = M.appliquerDegatsRecus(regles, fiche(), a.barriere + 4);
  assert.deepEqual(pleine.ecrit, { barriere_actuelle: 0, sante_actuelle: a.sante - 4 });
});

test('R171 : Laiton et Médusain se compensent (1 de barrière par point) ; Casse ignore le Médusain ; avec Passe, la barrière n’absorbe rien', () => {
  const avant = { barriere: 12, sante: 40 };
  const ensemble = M.degatsALaBarriere(20, avant, { laiton: true, medusain: true });
  assert.deepEqual([ensemble.barriere, ensemble.sante], [0, 32], 'comme sans case');
  assert.deepEqual([M.degatsALaBarriere(5, avant, { laiton: true, medusain: true }).barriere], [7]);
  const casse = M.degatsALaBarriere(20, avant, { casse: true, medusain: true });
  assert.deepEqual([casse.barriere, casse.sante], [0, 20], 'Casse + Médusain : barrière 0, tout à la santé');
  const passe = M.degatsALaBarriere(20, avant, { passe: true, medusain: true });
  assert.deepEqual([passe.barriere, passe.sante], [12, 20], 'Passe + Médusain : la barrière n’absorbe rien');
});

test('R171, Q74 : Passe, Casse et Laiton, une seule case à la fois (choix provisoire, isolé) ; le Médusain se coche avec n’importe laquelle', () => {
  assert.deepEqual(M.CASES_DE_LA_BARRIERE.map((c) => c.id), ['passe', 'casse', 'laiton', 'medusain']);
  assert.deepEqual([...M.CASES_EXCLUSIVES_DE_LA_BARRIERE], ['passe', 'casse', 'laiton']);
  const vide = { passe: false, casse: false, laiton: false, medusain: false };
  let c = M.casesDeLaBarriereApres(vide, 'passe', true);
  assert.deepEqual(c, { ...vide, passe: true });
  c = M.casesDeLaBarriereApres(c, 'laiton', true);
  assert.deepEqual(c, { ...vide, laiton: true }, 'Laiton décoche Passe');
  c = M.casesDeLaBarriereApres(c, 'medusain', true);
  assert.deepEqual(c, { ...vide, laiton: true, medusain: true }, 'le Médusain avec le Laiton');
  c = M.casesDeLaBarriereApres(c, 'casse', true);
  assert.deepEqual(c, { ...vide, casse: true, medusain: true }, 'Casse décoche le Laiton, garde le Médusain');
  c = M.casesDeLaBarriereApres(c, 'casse', false);
  assert.deepEqual(c, { ...vide, medusain: true }, 'décocher ne coche rien');
  assert.notEqual(M.casesDeLaBarriereApres(vide, 'passe', true), vide, 'un nouvel objet');
});

test('R171 : « Deux fois moins » cochée d’office — « Barrière résistante » contre un type physique, « Barrière isolante » contre un élément ; lue dans le texte du don', () => {
  // le texte, jamais le nom : sur toute la base, seuls les deux dons du Médusain l'écrivent
  const textes = [...regles.classes.flatMap((k) => k.dons.map((d) => ({ nom: d.nom, texte: d.effet }))),
    ...regles.races.flatMap((r) => (r.dons ?? []).map((d) => ({ nom: r.nom, texte: d.texte })))];
  const lus = textes.map((d) => ({ ...d, lu: M.barriereMoinsToucheeEcrite(d.texte) })).filter((d) => d.lu.physiques || d.lu.magiques);
  assert.deepEqual(lus.map((d) => [d.nom, d.lu.physiques, d.lu.magiques]).sort(), [['Barrière isolante', false, true], ['Barrière résistante', true, false]]);
  assert.deepEqual(M.barriereMoinsToucheeEcrite('Les contrôles mentaux ont deux fois moins d’effets'), { physiques: false, magiques: false });
  // un Médusain Hoplite de niveau 20, avec l'un ou l'autre don (des choix exclusifs de sa ligne 43)
  const medusain = (don) => fiche({
    xp: xpDuNiveau(20), classes: [{ rang: 1, classe_id: 'classes/medusain', specialite_id: 'classes/medusain#specialite:hoplite' }],
    capacites: don ? [{ capacite_id: don }] : [],
  });
  const resistante = medusain('capacites/medusain-barriere-resistante');
  const isolante = medusain('capacites/medusain-barriere-isolante');
  const office = (f, coup) => M.medusainDOffice(regles, f, coup).coche;
  assert.deepEqual(M.medusainDOffice(regles, resistante, { type: 'estoc' }), { coche: true, dons: ['Barrière résistante'] });
  for (const type of ['estoc', 'taille', 'frappe']) assert.equal(office(resistante, { type }), true, type);
  assert.equal(office(resistante, { type: 'magique', element: FEU }), false, 'un coup magique : pas la résistante');
  assert.equal(office(resistante, { type: 'taille', element: FEU }), true, 'un coup physique avec un élément : l’un ou l’autre suffit');
  assert.equal(office(isolante, { type: 'magique', element: FEU }), true);
  assert.equal(office(isolante, { type: 'taille', element: FEU }), true, 'un coup physique avec un élément : l’un ou l’autre suffit');
  assert.equal(office(isolante, { type: 'taille' }), false, 'un coup physique sans élément : pas l’isolante');
  // sans le don, ou sans coup valable : rien d'office
  assert.equal(office(medusain(null), { type: 'estoc' }), false);
  assert.equal(office(fiche(), { type: 'magique', element: FEU }), false);
  assert.equal(office(resistante, { type: 'magique' }), false, 'Magique sans élément : pas de coup');
  // le don pas encore débloqué (un niveau de classe sous 20) : rien
  const avant = regles.niveaux.findLast((l) => M.niveauxDeClasse(regles, l.niveau, resistante.mode_classe).classe1 < 20);
  assert.ok(avant, 'un niveau global sous le niveau de classe 20');
  assert.equal(office({ ...resistante, xp: avant.xp_min }, { type: 'estoc' }), false);
});

test('R171, la page (src/scripts/fiche.mjs, lue comme un texte) : type et élément, cases de la barrière et « Appliquer » passent par le moteur', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const debut = script.indexOf('function construireDefense()');
  const corps = script.slice(debut, script.indexOf('// ------------------------------------------------------------------ portrait et ceinture', debut));
  assert.ok(debut > 0 && corps.length > 0, 'le bloc des dégâts reçus');
  for (const f of ['TYPES_DE_COUP', 'elementsDeDegats', 'degatsRecus', 'medusainDOffice', 'casesDeLaBarriereApres', 'appliquerDegatsRecus', 'CASES_DE_LA_BARRIERE']) {
    assert.match(corps, new RegExp(`\\b${f}\\b`), f);
  }
  // l'écriture dans les jauges : celle du moteur, telle quelle
  assert.match(corps, /Object\.assign\(fiche, appliquerDegatsRecus\(/);
  assert.doesNotMatch(corps, /typesDeDegats\(/, 'plus un seul type parmi dix-sept');
  assert.doesNotMatch(corps, /parfaite/i, 'pas de case « défense parfaite »');
});
