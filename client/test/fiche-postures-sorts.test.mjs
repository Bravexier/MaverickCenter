// La posture du moment (décision R100), les bâtons magiques (R101) et les sorts du moment (R102) sur la fiche de personnage (demandes du propriétaire
// du 2026-10-17 : « le fait de cocher une posture recalcule les valeurs de la fiche », « configurer correctement un "bâton magique" avec la magie et le
// niveau », « appliquer les effets passifs du bâton directement dans les cases concernées », « le calcul des dégâts de chaque sort […] à jour »). Les
// lecteurs de textes (lib/posture-texte.mjs, lib/sort-bonus-texte.mjs, lib/ceinture-texte.mjs#effetsDeBaton) sont rejoués sur toute la base.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { effetsDeBaton } from '../src/lib/ceinture-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { effetDePosture } from '../src/lib/posture-texte.mjs';
import { bonusDeSortsEcrits } from '../src/lib/sort-bonus-texte.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: 'magies/magie-du-feu', ...x });
const POSTURE = (slug) => `guide/postures#posture:${slug}`;
const auNm = (s, nm = 0) => Object.fromEntries(['cout', 'portee', 'dsb', 'effets'].map((c) => [c, valeurAuNm(s[c], s.bonus ?? [], c, nm) ?? '']));
const ceinture = (...noms) => ({ ceinture: noms.map((nom, i) => ({ rang: i + 1, nom, quantite: 1, ressource_id: null })) });
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;

test('posture-texte (R100) : chaque ligne du tableau des postures de la fiche est lue ou seulement affichée, comme épinglé', () => {
  const lues = Object.fromEntries(lignes("SELECT posture_id, rang, texte FROM posture_effet WHERE version = 'fiche' ORDER BY posture_id, rang")
    .map((l) => [`${l.posture_id.split(':')[1]}:${l.rang}`, effetDePosture(l.texte)?.cible ?? null]));
  assert.deepEqual(lues, {
    'defensif:1': null, 'defensif:2': 'armure', 'defensif:3': null, 'defensif:4': null, 'defensif:5': null, 'defensif:6': 'degats_diviseur',
    'focus:1': 'competences', 'focus:2': 'cran_des_sorts', 'focus:3': null, 'focus:4': null,
    'neutre:1': 'competences', 'neutre:2': null,
    'offensif:1': 'degats_maximum', 'offensif:2': null, 'offensif:3': 'competences', 'offensif:4': null,
    'symbiose:1': 'symbiose_sorts', 'symbiose:2': 'symbiose_am', 'symbiose:3': 'symbiose_immunite', 'symbiose:4': 'armes_inutilisables', 'symbiose:5': null, 'symbiose:6': 'une_seule_magie',
    'vigilance:1': 'competences', 'vigilance:2': 'initiative', 'vigilance:3': null, 'vigilance:4': null, 'vigilance:5': null, 'vigilance:6': null,
  });
  assert.deepEqual(effetDePosture('+5% pour jet de V ou S'), { cible: 'competences', caracteristiques: ['social', 'volonte'], valeur: 5 });
  assert.deepEqual(effetDePosture('Malus de 10% pour toucher une cible'), { cible: 'competences', competences: ['arc', 'arbalete', 'arme-legere', 'arme-lourde', 'magie'], valeur: -10 });
});

test('postureDuMoment (R100) : compétences, initiative, AP et AM, dégâts ; rien sans posture', () => {
  assert.equal(M.postureDuMoment(regles, fiche()), null);
  const scores = (slug) => Object.fromEntries(M.competencesDe(regles, fiche({ posture_id: slug && POSTURE(slug) })).map((c) => [c.id, c]));
  const sans = scores(null);
  // Neutre : « +5 % à toutes les compétences Social et Volonté » (l'exemple du propriétaire) ; le score de la fiche ne change pas, celui du moment oui
  for (const [id, c] of Object.entries(scores('neutre'))) {
    const attendu = ['social', 'volonte'].includes(c.caracteristique_id) ? 5 : 0;
    assert.deepEqual([c.posture, c.score, c.scoreDuMoment], [attendu, sans[id].score, sans[id].score + attendu], id);
  }
  for (const c of Object.values(scores('focus'))) assert.equal(c.posture, 10, `Focus : ${c.id}`);
  for (const c of Object.values(scores('vigilance'))) assert.equal(c.posture, c.caracteristique_id === 'perception' ? 5 : 0, `Vigilance : ${c.id}`);
  for (const c of Object.values(scores('offensif'))) assert.equal(c.posture, ['arc', 'arbalete', 'arme-legere', 'arme-lourde', 'magie'].includes(c.id) ? -10 : 0, `Offensif : ${c.id}`);
  const vigilance = M.attributsDe(regles, fiche({ posture_id: POSTURE('vigilance') }));
  assert.deepEqual([vigilance.initiativePosture, vigilance.initiativeBonus], [2, M.attributsDe(regles, fiche()).initiativeBonus]);
  // Défensif : 2 × ⌈N ÷ 4⌉ AP et AM (réponse « 2 × ⌈N/4⌉ »)
  for (const [n, v] of [[1, 2], [4, 2], [5, 4], [8, 4], [9, 6], [20, 10]]) {
    const p = M.postureDuMoment(regles, fiche({ posture_id: POSTURE('defensif'), xp: xpDuNiveau(n) }));
    assert.deepEqual([p.ap, p.am, p.diviseur], [v, v, 2], `niveau ${n}`);
    const d = M.defenseDe(regles, fiche({ posture_id: POSTURE('defensif'), xp: xpDuNiveau(n) }));
    assert.equal(d.ap.total - M.defenseDe(regles, fiche({ xp: xpDuNiveau(n) })).ap.total, v);
  }
  const offensif = M.postureDuMoment(regles, fiche({ posture_id: POSTURE('offensif') }));
  assert.deepEqual([offensif.degatsMaximum, offensif.crans], [true, 0]);
  assert.equal(M.postureDuMoment(regles, fiche({ posture_id: POSTURE('focus') })).crans, 1);
});

test('Symbiose (R100) : sa magie (la seule, sinon choisie), +5 (+2/NPM au-delà du premier) aux sorts de cette magie et +4 (+2/NPM) d’AM, immunité, l’autre magie inactive, armes inutilisables', () => {
  const mono = M.postureDuMoment(regles, fiche({ posture_id: POSTURE('symbiose') }));
  assert.deepEqual([mono.symbiose.magie.id, mono.symbiose.aChoisir, mono.symbiose.degats, mono.symbiose.am, mono.am, mono.armesInutilisables], ['magies/magie-du-feu', false, 5, 4, 4, true]);
  const niveau = regles.niveaux.find((l) => M.puissanceMagique(regles, l.niveau) === 3).niveau;
  const haut = M.postureDuMoment(regles, fiche({ posture_id: POSTURE('symbiose'), xp: xpDuNiveau(niveau) }));
  assert.deepEqual([haut.symbiose.degats, haut.symbiose.am], [5 + 2 * 2, 4 + 2 * 2], 'puissance magique 3');
  const bi = { posture_id: POSTURE('symbiose'), magie_acquise_id: 'magies/magie-de-la-glace' };
  const sansChoix = M.postureDuMoment(regles, fiche(bi));
  assert.deepEqual([sansChoix.symbiose.magie, sansChoix.symbiose.aChoisir, sansChoix.symbiose.inactive, sansChoix.am], [null, true, null, 4]);
  const glace = M.postureDuMoment(regles, fiche({ ...bi, symbiose_magie_id: 'magies/magie-de-la-glace' }));
  assert.deepEqual([glace.symbiose.magie.id, glace.symbiose.inactive.id], ['magies/magie-de-la-glace', 'magies/magie-du-feu']);
  // immunité à sa magie dans les dégâts reçus ; le Potentiel Illimité n'a pas de magie de symbiose (R109 : test suivant)
  assert.equal(M.degatsRecus(regles, fiche({ ...bi, symbiose_magie_id: 'magies/magie-de-la-glace' }), { entrants: 50, type: 'magies/magie-de-la-glace' }).recus, 0);
  assert.ok(M.degatsRecus(regles, fiche({ ...bi, symbiose_magie_id: 'magies/magie-de-la-glace' }), { entrants: 50, type: 'magies/magie-du-feu' }).recus > 0);
  assert.deepEqual(M.magiesDeLaSymbiose(regles, fiche({ magie_innee_id: 'magies/potentiel-illimite' })), []);
  // un sort de la magie désactivée est inactif ; ceux de la magie de la symbiose ont son bonus
  const feu = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  const deGlace = regles.sorts.find((s) => s.magie_id === 'magies/magie-de-la-glace' && /^\d+d\d+ dégâts/.test(s.dsb ?? ''));
  const f = fiche({ ...bi, symbiose_magie_id: 'magies/magie-de-la-glace' });
  assert.equal(M.sortDuMoment(regles, f, feu, auNm(feu)).inactif, 'Feu');
  const m = M.sortDuMoment(regles, f, deGlace, auNm(deGlace));
  assert.equal(m.inactif, null);
  assert.ok(m.dsb.detail.some((d) => d.nom === 'Posture Symbiose (Glace)' && d.valeur === 5), JSON.stringify(m.dsb));
});

test('R113 : une valeur par tour reçoit les bonus fixes à chaque tour (dégâts et soin), la période après la valeur ; une valeur sans période inchangée', () => {
  // un sort à dégâts par tour, un bonus de bâton (« Dégâts sort ») ; puis d'un don (Barde « Ménestrel », +2 dégâts des sorts)
  const parTour = regles.sorts.find((s) => s.attaque && /^\d+d\d+ dégâts par tour$/.test(auNm(s).dsb));
  const ecrit = auNm(parTour).dsb;
  const baton = regles.ceinture.batons.find((b) => b.effets?.some((e) => e.cle === 'degats') && !b.effets.some((e) => e.cle === 'cran'));
  const bonus = baton.effets.find((e) => e.cle === 'degats').valeur;
  const avecBaton = M.sortDuMoment(regles, fiche(ceinture(baton.nom)), parTour, auNm(parTour));
  assert.equal(avecBaton.dsb.texte, ecrit.replace(/^(\d+d\d+) /, `$1 + ${bonus} `), ecrit);
  assert.ok(avecBaton.dsb.texte.endsWith(' dégâts par tour') && avecBaton.dsb.lu);
  assert.ok(!avecBaton.nonComptes.some((n) => n.raison === 'par_tour'));
  // « 5 dégâts / tour » : une valeur sans dés, la période telle qu'écrite
  assert.equal(M.ecrireDegatsDeSort({ ...M.lireDegatsDeSort('5 dégâts / tour'), fixe: 5 + 4 }), '9 dégâts / tour');
  assert.equal(M.ecrireDegatsDeSort({ ...M.lireDegatsDeSort('3d6 dégâts par tour'), fixe: 5 }), '3d6 + 5 dégâts par tour');
  // un soin par tour : le bonus de soin (une armure élémentaire « Les sorts de soin ont un bonus de +7 ») à chaque tour
  const soin = regles.sorts.find((s) => s.types.includes('soin') && M.lireDegatsDeSort(auNm(s).dsb)?.parTour && M.lireDegatsDeSort(auNm(s).dsb).nature === 'soin');
  const lumiere = regles.armures_elementaires.find((e) => e.sorts?.some((b) => b.cible === 'soin' && b.valeur === 7));
  assert.ok(soin && lumiere, 'un soin par tour dans la base');
  const lu = M.lireDegatsDeSort(auNm(soin).dsb);
  const m = M.sortDuMoment(regles, fiche({ armure_id: regles.armures[0].id, armure_elementaire_id: lumiere.id }), soin, auNm(soin));
  assert.equal(m.dsb.texte, M.ecrireDegatsDeSort({ ...lu, fixe: lu.fixe + 7 }), auNm(soin).dsb);
  assert.match(m.dsb.texte, /(\/\s*tour|par tour)$/);
  assert.equal(M.ecrireDegatsDeSort({ ...M.lireDegatsDeSort('4d6 de soin/tour'), fixe: 7 }), '4d6 + 7 de soin/tour');
  // un sort sans période : inchangé
  const boule = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  assert.equal(M.sortDuMoment(regles, fiche(ceinture(baton.nom)), boule, auNm(boule)).dsb.texte, `2d6 + ${bonus} dégâts`);
});

test('Symbiose (R112) : « Utiliser » grisé à la ceinture, sauf un parchemin ; Remplir et Ranger permis ; armes grisées ; les effets passifs (accessoires, bâton, armure, bouclier) comptent', () => {
  const symbiose = (x = {}) => fiche({ posture_id: POSTURE('symbiose'), ...x });
  const potion = regles.ceinture.objets.find((o) => o.famille === 'fiole');
  const parchemin = regles.ressources.find((r) => r.genre === 'parchemin' && r.nom === 'Parchemin gravé');
  const vierge = regles.ressources.find((r) => r.genre === 'materiel' && r.nom === 'Parchemin vierge');
  assert.ok(potion && parchemin && vierge);
  const ligne = (o, quantite = 2, ressource = true) => ({ nom: o.nom, quantite, ressource_id: ressource ? (o.ressource_id ?? o.id) : null });
  const aLaCeinture = (...lignes_) => ({ ceinture: lignes_.map((l, i) => ({ rang: i + 1, ...l })) });
  const refus = 'Posture Symbiose : on ne peut que lancer des sorts';
  // une potion : grisé, et « Utiliser » ne fait rien ; Remplir et Ranger restent
  const f = symbiose({ ...aLaCeinture(ligne(potion)), inventaire: [{ rang: 1, nom: potion.nom, quantite: 3, ressource_id: potion.ressource_id }] });
  const a = M.actionsDeLEmplacement(regles, f, 1);
  assert.deepEqual([a.utiliser, a.refus, a.remplir], [true, refus, true]);
  assert.deepEqual(M.utiliserLObjet(regles, f, 1), { ceinture: f.ceinture, inventaire: f.inventaire });
  assert.equal(M.remplirLEmplacement(regles, f, 1).ceinture[0].quantite, 3, 'Remplir : un geste de rangement');
  assert.deepEqual(M.rangerLEmplacement(regles, f, 1).ceinture, [], 'Ranger aussi');
  // un parchemin (genre « parchemin » du catalogue, par l'objet de la ligne ou par son nom) : permis
  for (const l of [ligne(parchemin), ligne(parchemin, 2, false)]) {
    const p = symbiose(aLaCeinture(l));
    assert.equal(M.estUnParchemin(regles, p.ceinture[0]), true);
    assert.equal(M.actionsDeLEmplacement(regles, p, 1).refus, null);
    assert.equal(M.utiliserLObjet(regles, p, 1).ceinture[0].quantite, 1);
  }
  // le « Parchemin vierge » de l'équipement d'inventaire (genre « matériel ») n'en est pas un ; un nom hors du catalogue non plus
  assert.equal(M.estUnParchemin(regles, ligne(vierge)), false);
  assert.equal(M.estUnParchemin(regles, { nom: 'Parchemin de feu du MJ', quantite: 1, ressource_id: null }), false);
  // hors Symbiose : inchangé
  for (const posture of [null, POSTURE('focus'), POSTURE('offensif')]) {
    const g = fiche({ posture_id: posture, ...aLaCeinture(ligne(potion)) });
    assert.equal(M.actionsDeLEmplacement(regles, g, 1).refus, null, String(posture));
    assert.equal(M.utiliserLObjet(regles, g, 1).ceinture[0].quantite, 1);
  }
  // les armes : grisées en Symbiose (pastille « Symbiose »)
  const arme = { rang: 1, arme_id: regles.armes.find((x) => x.solidite !== null).id, materiau_id: regles.materiau_arme_defaut };
  assert.equal(M.degatsDArmeDuMoment(regles, symbiose({ armes: [arme] }), 1).inutilisable, 'Symbiose');
  // les effets passifs comptent : accessoires, bâton à la ceinture, armure et bouclier (en parade partielle)
  const acc = regles.accessoires.find((x) => x.effets.some((c) => c.cible === 'armure_ap'));
  const armure = regles.armures.find((x) => x.ap >= 2 && Number(x.solidite_uni) !== 1);
  const equipe = {
    accessoires: [{ emplacement: 'chef', accessoire_effet_id: acc.id, valeur: null, maudit: 0 }], armure_id: armure.id,
    bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:fer', ...ceinture(regles.ceinture.batons[0].nom),
  };
  const enSymbiose = symbiose(equipe);
  const sans = fiche(equipe);
  assert.deepEqual(M.effetsDesAccessoires(regles, enSymbiose), M.effetsDesAccessoires(regles, sans));
  assert.ok(M.effetsDesBatons(regles, enSymbiose).comptes.size > 0);
  assert.deepEqual([...M.effetsDesBatons(regles, enSymbiose).comptes], [...M.effetsDesBatons(regles, sans).comptes]);
  const d = M.defenseDe(regles, enSymbiose);
  const d0 = M.defenseDe(regles, sans);
  assert.deepEqual([d.ap.total, d.ap.armure, d.am.armure, d.bouclier], [d0.ap.total, d0.ap.armure, d0.am.armure, d0.bouclier]);
  assert.equal(d.am.total, d0.am.total + M.postureDuMoment(regles, enSymbiose).am, 'l’AM de la posture en plus');
  const parade = (x) => M.degatsRecus(regles, x, { entrants: 40, type: 'taille', reduits: true, parade: true }).armure;
  assert.equal(parade(enSymbiose), parade(sans), 'le bouclier en parade partielle');
});

test('Symbiose à deux magies (R111) : la magie désactivée perd ses résistances et faiblesses (et leur part du cumul, R85), rien d’autre ; sans Symbiose, rien ne change', () => {
  const bi = (x = {}) => fiche({ magie_acquise_id: 'magies/magie-de-la-glace', ...x });
  const enGlace = bi({ posture_id: POSTURE('symbiose'), symbiose_magie_id: 'magies/magie-de-la-glace' });
  const sans = bi();
  const cible = (r, id) => r.paliers.flatMap((p) => p.cibles.map((c) => ({ ...c, palier: p.id }))).find((c) => c.id === id) ?? null;
  const origines = (r) => r.paliers.flatMap((p) => p.cibles.flatMap((c) => c.origines.map((o) => o.nom)));
  const avant = M.resistancesDe(regles, sans);
  const apres = M.resistancesDe(regles, enGlace);
  assert.equal(avant.desactivee, null);
  assert.deepEqual(apres.desactivee, { id: 'magies/magie-du-feu', nom: 'Feu' });
  assert.ok(origines(avant).includes('Feu (magie innée)') && !origines(apres).includes('Feu (magie innée)'), 'les listes du Feu ne comptent plus');
  assert.ok(origines(apres).includes('Glace (magie acquise)'), 'celles de la magie de la symbiose restent');
  // le Feu : le Feu y résiste, la Glace y est faible (0 cran, rien) ; désactivé, seule la faiblesse de la Glace reste
  const feu = regles.magies.find((m) => m.id === 'magies/magie-du-feu');
  const glace = regles.magies.find((m) => m.id === 'magies/magie-de-la-glace');
  const crans = (m, id) => (m.resistances.find((e) => e.type === 'magie' && e.id === id)?.crans ?? 0);
  assert.deepEqual([crans(feu, feu.id), crans(glace, feu.id)], [1, -1]);
  assert.equal(cible(avant, feu.id), null, 'R85 : une résistance et une faiblesse s’annulent');
  assert.equal(cible(apres, feu.id).crans, -1);
  // la Terre, que seul le Feu résiste : plus rien
  assert.ok(crans(feu, 'magies/magie-de-la-terre') > 0 && crans(glace, 'magies/magie-de-la-terre') === 0);
  assert.ok(cible(avant, 'magies/magie-de-la-terre') && !cible(apres, 'magies/magie-de-la-terre'));
  // les dégâts reçus suivent (le palier de la faiblesse au Feu s'applique)
  const r = M.degatsRecus(regles, enGlace, { entrants: 60, type: feu.id });
  const palier = regles.resistance_paliers.find((p) => p.id === cible(apres, feu.id).palier);
  assert.ok(r.etapes.some((e) => e.texte.startsWith(palier.libelle)), JSON.stringify(r.etapes));
  assert.ok(!M.degatsRecus(regles, sans, { entrants: 60, type: feu.id }).etapes.some((e) => e.texte.startsWith(palier.libelle)));
  // rien d'autre : Mode Hyper, santé, chakra, caractéristiques (le +1 de la magie innée), 4ᵉ barre
  assert.deepEqual(M.modeHyperDe(regles, enGlace).magies.map((m) => m.magie.id), M.modeHyperDe(regles, sans).magies.map((m) => m.magie.id));
  const a = (f) => { const x = M.attributsDe(regles, f); return [x.sante, x.chakra, x.barriere, x.barre4]; };
  assert.deepEqual(a(enGlace), a(sans));
  assert.deepEqual(M.caracteristiquesDe(regles, enGlace), M.caracteristiquesDe(regles, sans));
  // sans Symbiose (une autre posture), ou en Symbiose sans magie désactivée (une seule magie) : rien ne change
  assert.deepEqual(M.resistancesDe(regles, bi({ posture_id: POSTURE('focus') })), avant);
  const mono = fiche({ posture_id: POSTURE('symbiose') });
  assert.deepEqual(M.resistancesDe(regles, mono), M.resistancesDe(regles, fiche()));
  // deux magies en Symbiose, la magie pas encore choisie : rien n'est désactivé
  assert.deepEqual(M.resistancesDe(regles, bi({ posture_id: POSTURE('symbiose') })), avant);
});

test('Symbiose du Potentiel Illimité (R109) : le bonus de dégâts et de soin sur tous ses sorts, quelle que soit leur magie, et l’AM ; ni magie à choisir, ni immunité', () => {
  const pi = (x = {}) => fiche({ magie_innee_id: 'magies/potentiel-illimite', posture_id: POSTURE('symbiose'), ...x });
  const p = M.postureDuMoment(regles, pi());
  assert.deepEqual([p.symbiose.potentielIllimite, p.symbiose.magie, p.symbiose.possibles, p.symbiose.aChoisir, p.symbiose.inactive, p.symbiose.degats, p.symbiose.am, p.am],
    [true, null, [], false, null, 5, 4, 4]);
  // une magie de symbiose enregistrée (fiche d'avant) n'y change rien
  assert.deepEqual(M.postureDuMoment(regles, pi({ symbiose_magie_id: 'magies/magie-du-feu' })).symbiose, p.symbiose);
  // le NPM (« +2/NPM ») : le Potentiel Illimité monte comme une autre magie innée
  const niveau = regles.niveaux.find((l) => M.puissanceMagique(regles, l.niveau) === 3).niveau;
  const haut = M.postureDuMoment(regles, pi({ xp: xpDuNiveau(niveau) }));
  assert.deepEqual([haut.symbiose.degats, haut.symbiose.am], [5 + 2 * 2, 4 + 2 * 2]);
  // pas de magie à choisir : rien dans le tiroir des choix
  assert.ok(!M.choixEnAttente(regles, pi()).some((c) => c.nature === 'symbiose'));
  // l'AM de la posture compte ; aucune immunité, quelle que soit la magie de l'attaque
  const sansPosture = pi({ posture_id: null });
  assert.equal(M.defenseDe(regles, pi()).am.total, M.defenseDe(regles, sansPosture).am.total + 4);
  for (const m of regles.magies.filter((x) => x.id !== 'magies/potentiel-illimite')) {
    const r = M.degatsRecus(regles, pi(), { entrants: 60, type: m.id });
    const avant = M.degatsRecus(regles, sansPosture, { entrants: 60, type: m.id });
    assert.ok(!r.etapes.some((e) => /Symbiose/.test(e.texte)), m.nom);
    assert.equal(r.armure, avant.armure + 4, `${m.nom} : 4 d’AM de plus`);
    assert.deepEqual(r.etapes.slice(2).map((e) => e.texte), avant.etapes.slice(2).map((e) => e.texte), `${m.nom} : le reste inchangé`);
  }
  // le bonus sur les sorts de deux magies différentes, et sur un soin
  const feu = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  const deGlace = regles.sorts.find((s) => s.magie_id === 'magies/magie-de-la-glace' && /^\d+d\d+ dégâts/.test(s.dsb ?? ''));
  const soin = regles.sorts.find((s) => s.types.includes('soin') && /^\d+d6 soin/.test(auNm(s).dsb));
  assert.ok(feu && deGlace && soin && new Set([feu.magie_id, deGlace.magie_id]).size === 2);
  for (const sort of [feu, deGlace, soin]) {
    const m = M.sortDuMoment(regles, pi(), sort, auNm(sort));
    assert.equal(m.inactif, null, sort.id);
    assert.deepEqual(m.dsb.detail.filter((d) => d.nom.startsWith('Posture Symbiose')), [{ nom: 'Posture Symbiose (Potentiel Illimité)', valeur: 5 }], sort.id);
    const sans = M.sortDuMoment(regles, sansPosture, sort, auNm(sort));
    const lu = (t) => M.lireDegatsDeSort(t).fixe;
    assert.equal(lu(m.dsb.texte), lu(sans.dsb.texte) + 5, `${sort.id} : ${m.dsb.texte}`);
  }

  // un personnage mono-magie ordinaire : inchangé (sa magie, ses sorts seulement, l'immunité)
  const ordinaire = fiche({ posture_id: POSTURE('symbiose') });
  const o = M.postureDuMoment(regles, ordinaire);
  assert.deepEqual([o.symbiose.potentielIllimite, o.symbiose.magie.id, o.symbiose.aChoisir], [false, 'magies/magie-du-feu', false]);
  assert.ok(M.sortDuMoment(regles, ordinaire, feu, auNm(feu)).dsb.detail.some((d) => d.nom === 'Posture Symbiose (Feu)' && d.valeur === 5));
  assert.ok(!M.sortDuMoment(regles, ordinaire, deGlace, auNm(deGlace)).dsb.detail.some((d) => d.nom.startsWith('Posture Symbiose')));
  assert.equal(M.degatsRecus(regles, ordinaire, { entrants: 50, type: 'magies/magie-du-feu' }).recus, 0);
});

test('R110 : « +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux » vaut 2 + 2 × ⌊niveau global ÷ 5⌋ sur les sorts (Elfe argenté, Felfe argenté) ; « 3+x […] x = +2/6 niveaux » au niveau de classe', () => {
  // la lecture (lib/sort-bonus-texte.mjs) : une progression, plus une raison « progression »
  assert.deepEqual(bonusDeSortsEcrits('- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.\n- +3 Chakra.'),
    [{ cible: 'degats', base: 2, pas: 2, niveaux: 5, niveauGlobal: true, vises: { tous: true } }]);
  const sort = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  const ethnieDuDon = (id) => lignes('SELECT ethnie_id FROM race_don WHERE id = ?', id)[0].ethnie_id;
  for (const [race, don, base, pas] of [['races/elfe-argente', 'races/elfe-argente#don:ailleurs', 2, 2], ['races/felfe', 'races/felfe#don:felfe-argente', 1, 1]]) {
    const ecrit = regles.races.find((r) => r.id === race).dons.find((d) => d.id === don);
    assert.deepEqual(ecrit?.sorts?.map((b) => [b.base, b.pas, b.niveaux, b.niveauGlobal]), [[base, pas, 5, true]], don);
    for (const [niveau, attendu] of [[1, base], [4, base], [5, base + pas], [10, base + 2 * pas], [20, base + 4 * pas]]) {
      const f = fiche({ race_id: race, ethnie_id: ethnieDuDon(don), xp: xpDuNiveau(niveau) });
      assert.equal(M.niveauGlobal(regles, f.xp), niveau);
      const m = M.sortDuMoment(regles, f, sort, auNm(sort));
      const lu = m.dsb.detail.filter((d) => d.nom === (ecrit.nom ?? ecrit.etiquette));
      assert.deepEqual(lu.map((d) => d.valeur), [attendu], `${don}, niveau ${niveau}`);
      assert.ok(!m.nonComptes.some((n) => n.nom === (ecrit.nom ?? ecrit.etiquette)), 'plus « non compté »');
    }
  }
  // « 3+x dégâts avec un sort d'attaque […] x = +2 dégâts/6 niveaux » (Mage « Puissance ») : au niveau de la classe, arrondi à l'inférieur (inchangé)
  const mage = regles.classes.find((c) => c.id === 'classes/mage');
  const puissance = mage.dons.find((d) => d.id === 'capacites/mage-puissance');
  assert.deepEqual(puissance.sorts.map((b) => [b.base, b.pas, b.niveaux, b.niveauGlobal ?? false]), [[3, 2, 6, false]]);
});

test('R110, repli : une autre écriture « qui augmente de +N tous les M niveaux » n’est pas comptée (raison « progression »), pas même sa base ; les Elfe et Felfe argentés restent comptés', () => {
  const autres = [
    ['+2 aux dégâts des sorts, qui augmente de +2 tous les 5 niveaux globaux', { tous: true }],
    ['La magie innée inflige +2 dégâts, qui augmente de +2 tous les 5 niveaux globaux.', { innee: true }],
  ];
  for (const [texte, vises] of autres) assert.deepEqual(bonusDeSortsEcrits(texte), [{ cible: 'degats', valeur: 2, vises, raison: 'progression' }], texte);
  // la lecture R110 reste la seule comptée
  assert.deepEqual(bonusDeSortsEcrits('- +1 aux dégâts magiques, qui augmente de +1 tous les 5 niveaux globaux'),
    [{ cible: 'degats', base: 1, pas: 1, niveaux: 5, niveauGlobal: true, vises: { tous: true } }]);
  // sur la fiche : une règle d'essai qui donne ces textes au don « Ailleurs » de l'Elfe argenté ; non compté, avec sa raison, le D/S/B tel qu'écrit
  const sort = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  const don = 'races/elfe-argente#don:ailleurs';
  const ethnie = lignes('SELECT ethnie_id FROM race_don WHERE id = ?', don)[0].ethnie_id;
  const f = fiche({ race_id: 'races/elfe-argente', ethnie_id: ethnie, xp: xpDuNiveau(10) });
  const nomDuDon = (r) => { const d = r.races.find((x) => x.id === 'races/elfe-argente').dons.find((x) => x.id === don); return d.nom ?? d.etiquette; };
  for (const [texte] of autres) {
    const essai = { ...regles, races: regles.races.map((r) => (r.id !== 'races/elfe-argente' ? r : { ...r, dons: r.dons.map((d) => (d.id === don ? { ...d, sorts: bonusDeSortsEcrits(texte) } : d)) })) };
    const m = M.sortDuMoment(essai, f, sort, auNm(sort));
    assert.deepEqual(m.nonComptes.filter((n) => n.nom === nomDuDon(essai)), [{ nom: nomDuDon(essai), valeur: 2, raison: 'progression', cible: 'dsb' }], texte);
    assert.ok(!m.dsb.detail.some((d) => d.nom === nomDuDon(essai)), texte);
    assert.equal(m.dsb.texte, M.sortDuMoment(essai, fiche(), sort, auNm(sort)).dsb.texte, 'rien d’ajouté');
  }
  // les vraies règles : le don compté au niveau 10 (2 + 2 × 2), sans « non compté »
  const vrai = M.sortDuMoment(regles, f, sort, auNm(sort));
  assert.deepEqual(vrai.dsb.detail.filter((d) => d.nom === nomDuDon(regles)).map((d) => d.valeur), [6]);
  assert.ok(!vrai.nonComptes.some((n) => n.raison === 'progression'));
  // la page a le libellé de cette raison (src/scripts/fiche.mjs, RAISONS_DES_SORTS) : « Non compté (progression par niveau à préciser) : … »
  const page = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  assert.match(/const RAISONS_DES_SORTS = \{([\s\S]*?)\};/.exec(page)[1], /\bprogression: 'progression par niveau à préciser'/);
});

test('R110, don de classe (règles d’essai) : « … tous les M niveaux globaux » au niveau global, « … tous les M niveaux » au niveau de la classe ; arrondi à l’inférieur', () => {
  // « Contact » du Guerrier (niveau 1, passif, sans bonus de sort) porte ici un texte d'essai ; en mono-classe la classe 1 est à deux fois le niveau
  // global (décision R2) : les deux lectures se distinguent
  const classe = regles.classes.find((c) => c.id === 'classes/guerrier');
  const don = classe.dons.find((d) => d.id === 'capacites/guerrier-contact');
  assert.ok(don && !don.sorts?.length, 'un don sans bonus de sort à lui');
  const essai = (texte) => ({ ...regles, classes: regles.classes.map((c) => (c.id !== classe.id ? c : { ...c, dons: c.dons.map((d) => (d.id === don.id ? { ...d, sorts: bonusDeSortsEcrits(texte) } : d)) })) });
  const globaux = essai('+2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux');
  const deClasse = essai('3+x dégâts avec les sorts. x = +2 dégâts/5 niveaux');
  assert.deepEqual(globaux.classes.find((c) => c.id === classe.id).dons.find((d) => d.id === don.id).sorts,
    [{ cible: 'degats', base: 2, pas: 2, niveaux: 5, niveauGlobal: true, vises: { tous: true } }]);
  assert.deepEqual(deClasse.classes.find((c) => c.id === classe.id).dons.find((d) => d.id === don.id).sorts,
    [{ cible: 'degats', base: 3, pas: 2, niveaux: 5, vises: { tous: true } }]);
  const sort = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  const nom = `${don.nom} (${classe.nom})`;
  for (const global of [1, 4, 5, 9, 10, 15]) {
    const f = fiche({ classes: [{ rang: 1, classe_id: classe.id, specialite_id: null }], xp: xpDuNiveau(global) });
    assert.equal(M.niveauGlobal(regles, f.xp), global);
    const niveauDeClasse = M.donsAcquis(globaux, f).find((c) => c.classe.id === classe.id).niveau;
    assert.equal(niveauDeClasse, Math.min(20, 2 * global), 'mono-classe (R2)');
    for (const [r, niveau, base, attendu] of [[globaux, global, 2, 2 + 2 * Math.floor(global / 5)], [deClasse, niveauDeClasse, 3, 3 + 2 * Math.floor(niveauDeClasse / 5)]]) {
      const b = M.bonusDeSortsDuPersonnage(r, f).filter((x) => x.nom === nom);
      assert.deepEqual(b.map((x) => [x.base, x.niveau]), [[base, niveau]], `${nom}, niveau global ${global}`);
      const lu = M.sortDuMoment(r, f, sort, auNm(sort)).dsb.detail.filter((d) => d.nom === nom);
      assert.deepEqual(lu.map((d) => d.valeur), [attendu], `${nom}, niveau global ${global}`);
    }
  }
  // au niveau global 4 (classe au niveau 8) : +2 au niveau global, quand le niveau de la classe donnerait +4
  const f4 = fiche({ classes: [{ rang: 1, classe_id: classe.id, specialite_id: null }], xp: xpDuNiveau(4) });
  assert.deepEqual(M.sortDuMoment(globaux, f4, sort, auNm(sort)).dsb.detail.filter((d) => d.nom === nom).map((d) => d.valeur), [2]);
});

test('lireDegatsDeSort / ecrireDegatsDeSort : les écritures sans ambiguïté, et l’aller-retour sur tous les D/S/B de la base au NM 0', () => {
  for (const [texte, attendu] of [
    ['3d6 dégâts', { nature: 'degats', nombre: 3, faces: 6, fixe: 0, prefixe: '', suite: 'dégâts', parTour: false }],
    ['8d6 + 35 dégâts', { nature: 'degats', nombre: 8, faces: 6, fixe: 35, prefixe: '', suite: 'dégâts', parTour: false }],
    ['23 dégâts', { nature: 'degats', nombre: 0, faces: null, fixe: 23, prefixe: '', suite: 'dégâts', parTour: false }],
    ['Soigne 6d6 + 7', { nature: 'soin', nombre: 6, faces: 6, fixe: 7, prefixe: 'Soigne', suite: '', parTour: false }],
    ['4d6 de soin/tour', { nature: 'soin', nombre: 4, faces: 6, fixe: 0, prefixe: '', suite: 'de soin/tour', parTour: true }],
    ["8d6 dégâts d'acide", { nature: 'degats', nombre: 8, faces: 6, fixe: 0, prefixe: '', suite: "dégâts d'acide", parTour: false }],
  ]) assert.deepEqual(M.lireDegatsDeSort(texte), attendu, texte);
  for (const t of ['+8 dégâts', 'X dégâts', '2d6 cr', 'Vole 4d10 chakra', '5d6 dégâts + 10 /tour', '15 - 30 - 15', '3d6 + 4', '']) assert.equal(M.lireDegatsDeSort(t), null, t);
  const espaces = (t) => t.replace(/\s*\+\s*/g, ' + ').replace(/\.$/, '').trim();
  let lus = 0;
  for (const s of regles.sorts) {
    const v = auNm(s).dsb;
    const l = M.lireDegatsDeSort(v);
    if (!l) continue;
    lus += 1;
    assert.equal(M.ecrireDegatsDeSort(l), espaces(v).replace(/^soigne/i, 'Soigne'), `${s.id} : ${v}`);
  }
  assert.ok(lus > 120, `${lus} D/S/B lus`);
  assert.deepEqual([4, 6, 8, 10, 12, 20, 7].map((f) => M.deMonte(f, 1)), [6, 8, 10, 12, 20, 20, 7]);
  assert.deepEqual([M.deMonte(6, 2), M.deMonte(4, -1), M.deMonte(8, -1)], [10, 4, 6]);
});

test('sortDuMoment (R102) : Focus monte le dé d’un cran, Offensif prend le maximum, Défensif divise par 2 ; les bonus fixes des dons, accessoires, bâtons et armure élémentaire', () => {
  const boule = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  assert.equal(M.sortDuMoment(regles, fiche(), boule, auNm(boule)).dsb.texte, '2d6 dégâts');
  assert.equal(M.sortDuMoment(regles, fiche({ posture_id: POSTURE('focus') }), boule, auNm(boule, 1)).dsb.texte, '3d8 dégâts', 'au NM 1, en Focus');
  assert.equal(M.sortDuMoment(regles, fiche({ posture_id: POSTURE('offensif') }), boule, auNm(boule)).dsb.texte, '12 dégâts');
  assert.equal(M.sortDuMoment(regles, fiche({ posture_id: POSTURE('defensif') }), boule, auNm(boule)).dsb.diviseur, 2);
  // Focus + accessoire « Augmente le dé de dégâts des sorts » : deux crans (« Peuvent se cumuler »)
  const cran = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'cran_des_sorts'));
  const avecCran = fiche({ posture_id: POSTURE('focus'), accessoires: [{ emplacement: 'chef', accessoire_effet_id: cran.id, valeur: null, maudit: 0 }] });
  assert.equal(M.sortDuMoment(regles, avecCran, boule, auNm(boule)).dsb.texte, '2d10 dégâts');
  // un dé au maximum (« 3D6+4 » → « 2D6+6+4 ») ; sans effet en Offensif
  const max = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'de_maximum'));
  const deMax = (x = {}) => fiche({ ...x, accessoires: [{ emplacement: 'chef', accessoire_effet_id: max.id, valeur: null, maudit: 0 }] });
  assert.equal(M.sortDuMoment(regles, deMax(), boule, auNm(boule)).dsb.texte, '1d6 + 6 dégâts');
  assert.equal(M.sortDuMoment(regles, deMax({ posture_id: POSTURE('offensif') }), boule, auNm(boule)).dsb.texte, '12 dégâts');
  // bâton du Feu 3 (« Dégâts sort +9 ») ; deux bâtons au même effet : le plus fort seul (réponse « Tous les sorts, le meilleur seul »)
  assert.equal(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Feu, niveau 3')), boule, auNm(boule)).dsb.texte, '2d6 + 9 dégâts');
  const deux = M.effetsDesBatons(regles, fiche(ceinture('Bâton magique Feu, niveau 1', 'Bâton magique Foudre, niveau 2')));
  assert.deepEqual([...deux.comptes].map(([cle, e]) => [cle, e.valeur, e.baton.nom]), [['degats', 6, 'Bâton magique Foudre, niveau 2']]);
  assert.deepEqual(deux.ecartes.map((e) => e.baton.nom), ['Bâton magique Feu, niveau 1']);
  // un bâton dans le sac ne compte pas : seulement à la ceinture
  assert.equal(M.sortDuMoment(regles, fiche({ inventaire: [{ rang: 1, nom: 'Bâton magique Feu, niveau 3', quantite: 1 }] }), boule, auNm(boule)).dsb.texte, '2d6 dégâts');
  // accessoire « Dégâts magie +N » sur un sort d'attaque (R54)
  const magie = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'degats_magie'));
  const v = magie.effets.find((e) => e.cible === 'degats_magie').valeur;
  assert.equal(M.sortDuMoment(regles, fiche({ accessoires: [{ emplacement: 'chef', accessoire_effet_id: magie.id, valeur: null, maudit: 0 }] }), boule, auNm(boule)).dsb.texte, `2d6 + ${v} dégâts`);
  // l'armure élémentaire du Feu (« +N dégâts avec les sorts de Feu »)
  const element = regles.armures_elementaires.find((e) => e.magie_id === 'magies/magie-du-feu' && e.sorts?.length);
  const armure = regles.armures.find((a) => a.type === element.categorie) ?? regles.armures[0];
  const bonusElement = element.sorts.find((b) => b.cible === 'degats').valeur;
  assert.equal(M.sortDuMoment(regles, fiche({ armure_id: armure.id, armure_elementaire_id: element.id }), boule, auNm(boule)).dsb.texte, `2d6 + ${bonusElement} dégâts`);
  // un D/S/B qui ne se lit pas reste tel qu'écrit
  const variable = regles.sorts.find((s) => s.dsb === 'Variable');
  assert.deepEqual(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Feu, niveau 3')), variable, auNm(variable)).dsb, { texte: 'Variable', detail: [], diviseur: 1, lu: false });
});

test('sortDuMoment (R102) : le coût réduit par les dons (Économe, « réduits de 4 ») et le bâton, jamais moins de 1 ; la Corruption : 2 × le coût réduit − son bâton', () => {
  const boule = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  assert.equal(boule.cout, '4');
  const ocultomancien = { classes: [{ rang: 1, classe_id: 'classes/ocultomancien', specialite_id: null }] };
  const econome = M.sortDuMoment(regles, fiche(ocultomancien), boule, auNm(boule)).cout;
  assert.deepEqual([econome.texte, econome.detail], [String(4 - boule.niveau), [{ nom: 'Économe (Ocultomancien)', valeur: -boule.niveau }]]);
  assert.equal(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Arcane, niveau 3')), boule, auNm(boule)).cout.texte, '1', '4 − 3');
  assert.equal(M.sortDuMoment(regles, fiche({ ...ocultomancien, ...ceinture('Bâton magique Arcane, niveau 3') }), boule, auNm(boule)).cout.texte, '1', 'jamais moins de 1');
  // « Les coûts pour les sortilèges de Feu, Lumière et Vent sont réduits de 4 » (Kitsune, don à choix) : seulement les sorts de ces magies
  const kitsune = regles.classes.find((c) => c.dons.some((d) => d.id === 'capacites/kitsune-reduction'));
  const don = kitsune.dons.find((d) => d.id === 'capacites/kitsune-reduction');
  const f = fiche({ classes: [{ rang: 1, classe_id: kitsune.id, specialite_id: don.specialite_id }], xp: xpDuNiveau(don.niveau), capacites: [{ capacite_id: don.id }] });
  assert.ok(M.donsAcquis(regles, f).some((c) => c.dons.some((d) => d.id === don.id)), 'le don est débloqué');
  const cher = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && /^\d+$/.test(s.cout) && Number(s.cout) >= 12);
  assert.equal(M.sortDuMoment(regles, f, cher, auNm(cher)).cout.texte, String(Number(cher.cout) - 4));
  const glace = regles.sorts.find((s) => s.magie_id === 'magies/magie-de-la-glace' && /^\d+$/.test(s.cout) && Number(s.cout) >= 12);
  assert.equal(M.sortDuMoment(regles, f, glace, auNm(glace)).cout.texte, glace.cout, 'pas une magie nommée');
  // Corruption (réponse « 2 × coût réduit − bâton ») : bâton 2, « Coût sort −2 » et « Coût corruption −4 »
  const corr = regles.sorts.find((s) => s.magie_id === 'magies/magie-de-la-corruption' && /^\d+$/.test(s.cout) && Number(s.cout) >= 10);
  const c = M.sortDuMoment(regles, fiche({ magie_innee_id: 'magies/magie-de-la-corruption', ...ceinture('Bâton magique Corruption, niveau 2') }), corr, auNm(corr)).cout;
  assert.deepEqual([c.texte, c.corruption.valeur], [String(Number(corr.cout) - 2), Math.max(1, 2 * (Number(corr.cout) - 2) - 4)]);
  // un sort de la Corruption au coût « 0 » (« 50% corruption », « X Corruption » : décision R106) ne consomme que de la corruption : pas d'alternative
  const sansChakra = regles.sorts.filter((s) => s.magie_id === 'magies/magie-de-la-corruption' && s.cout === '0');
  assert.ok(sansChakra.length >= 2, 'Pluie huileuse et Sapeur');
  for (const s of sansChakra) {
    const z = M.sortDuMoment(regles, fiche({ magie_innee_id: 'magies/magie-de-la-corruption', ...ceinture('Bâton magique Corruption, niveau 2') }), s, auNm(s)).cout;
    assert.deepEqual([z.texte, z.corruption], ['0', null], s.id);
  }
  // un coût qui n'est pas un nombre ne change pas (la réduction est dite non comptée) : « X » (au choix), « N/A » d'un coût qui n'est pas un pourcentage
  // du chakra maximum (« Aléatoire » : décision R106)
  const nonChiffres = [regles.sorts.find((s) => s.cout === 'X'), regles.sorts.find((s) => s.cout === 'N/A' && s.cout_secondaire === 'Aléatoire')];
  for (const choix of nonChiffres) {
    assert.ok(choix, 'un sort au coût non chiffré');
    const v = M.sortDuMoment(regles, fiche(ceinture('Bâton magique Arcane, niveau 1')), choix, auNm(choix));
    assert.deepEqual([v.cout.texte, v.cout.calcule, v.nonComptes.map((n) => [n.raison, n.cible])], [choix.cout, null, [['non_chiffre', 'cout']]], choix.id);
  }
});

test('R116 : le coût en corruption (2 × le coût réduit − le bâton) jamais sous 1 ; un sort qui ne coûte aucun chakra (« 0 ») n’a pas de coût en corruption', () => {
  const corruption = (x = {}) => fiche({ magie_innee_id: 'magies/magie-de-la-corruption', ...x });
  const baton = (n) => ceinture(`Bâton magique Corruption, niveau ${n}`);
  // les réductions du bâton (« Coût sort −N », « Coût corruption −2N »), telles que la base les écrit
  for (const [n, cout, coutCorruption] of [[1, -1, -2], [2, -2, -4], [3, -3, -6]]) {
    const comptes = M.effetsDesBatons(regles, corruption(baton(n))).comptes;
    assert.deepEqual([comptes.get('cout')?.valeur, comptes.get('cout_corruption')?.valeur], [cout, coutCorruption], `bâton niveau ${n}`);
  }
  // un sort de la Corruption au coût 1 (un sort d'essai : la base n'en a pas) : 2 × 1 = 2 sans bâton ; le bâton le ferait descendre à 0 ou moins : 1
  const corr = regles.sorts.find((s) => s.magie_id === 'magies/magie-de-la-corruption' && /^\d+$/.test(s.cout) && Number(s.cout) >= 4);
  const un = { ...corr, id: 'essai:sort-a-un', cout: '1', cout_secondaire: null, bonus: [] };
  const coutDe = (sort, f) => M.sortDuMoment(regles, f, sort, auNm(sort)).cout;
  assert.deepEqual([coutDe(un, corruption()).texte, coutDe(un, corruption()).corruption.valeur], ['1', 2]);
  for (const n of [1, 2, 3]) {
    const c = coutDe(un, corruption(baton(n)));
    assert.equal(c.texte, '1', `bâton niveau ${n} : le coût en chakra, jamais moins de 1 (R102)`);
    assert.equal(c.corruption.valeur, 1, `bâton niveau ${n} : 2 × 1 − ${2 * n} → 1 (R116)`);
    assert.deepEqual(c.corruption.detail.map((d) => d.valeur), [2, -2 * n], 'le détail garde le calcul');
  }
  // un vrai sort : coût 4 (ou plus), bâton niveau 3 : réduit à max(1, coût − 3), corruption max(1, 2 × réduit − 6)
  const c = coutDe(corr, corruption(baton(3)));
  const reduit = Math.max(1, Number(corr.cout) - 3);
  assert.deepEqual([c.texte, c.corruption.valeur], [String(reduit), Math.max(1, 2 * reduit - 6)]);
  if (reduit === 1) assert.equal(c.corruption.valeur, 1, 'sous 1 sans le plancher');
  // un coût « 0 » (Pluie huileuse, Sapeur : décision R106) : pas de coût en corruption, avec ou sans bâton, ses réductions non comptées
  const sansChakra = regles.sorts.filter((s) => s.magie_id === 'magies/magie-de-la-corruption' && s.cout === '0');
  assert.ok(sansChakra.length >= 2);
  for (const s of sansChakra) {
    for (const f of [corruption(), corruption(baton(1)), corruption(baton(3))]) {
      const m = M.sortDuMoment(regles, f, s, auNm(s));
      assert.deepEqual([m.cout.texte, m.cout.corruption], ['0', null], s.id);
      assert.ok(m.nonComptes.filter((x) => x.cible === 'cout').every((x) => x.raison === 'sans_chakra'), s.id);
    }
  }
});

test('sortDuMoment (R106) : « N/A » et « 25% Chakra maximum » : ce pourcentage du chakra maximum du personnage, arrondi à l’inférieur, puis réduit (R102)', () => {
  const pluie = regles.sorts.find((s) => s.cout === 'N/A' && /^\d+% Chakra maximum$/.test(s.cout_secondaire ?? ''));
  assert.ok(pluie, 'Pluie de Chakra');
  const pourcent = Number(/^(\d+)%/.exec(pluie.cout_secondaire)[1]);
  let arrondis = 0;
  for (const gains of [0, 1, 2, 3, 7, 30]) {
    const f = fiche({ gains_chakra: gains });
    const chakra = M.attributsDe(regles, f).chakra;
    const c = M.sortDuMoment(regles, f, pluie, auNm(pluie)).cout;
    assert.deepEqual(c.calcule, { pourcent, chakra, valeur: Math.floor((chakra * pourcent) / 100) }, `chakra ${chakra}`);
    assert.equal(c.texte, String(c.calcule.valeur));
    if ((chakra * pourcent) % 100) arrondis += 1;
  }
  assert.ok(arrondis > 0, 'un chakra dont le pourcentage tombe entre deux entiers');
  // le bâton de l'Arcane (« Coût sort −3 ») le réduit comme les autres, jamais moins de 1
  const c = M.sortDuMoment(regles, fiche({ gains_chakra: 30, ...ceinture('Bâton magique Arcane, niveau 3') }), pluie, auNm(pluie)).cout;
  assert.deepEqual([c.texte, c.detail.map((d) => d.valeur)], [String(Math.max(1, c.calcule.valeur - 3)), [-3]]);
});

test('sortDuMoment (R102) : soins (Focus, bâton de Lumière, accessoire +1d), portée (accessoire, dons, bâton), amplifications chiffrées des bâtons', () => {
  const soin = regles.sorts.find((s) => s.types.includes('soin') && /^\d+d6 soin/.test(auNm(s).dsb));
  const n = M.lireDegatsDeSort(auNm(soin).dsb);
  const m = M.sortDuMoment(regles, fiche({ posture_id: POSTURE('focus'), ...ceinture('Bâton magique Lumière, niveau 2') }), soin, auNm(soin));
  assert.equal(m.dsb.texte, M.ecrireDegatsDeSort({ ...n, faces: 8, fixe: n.fixe + 6 }));
  // Farfadet maritime : « Augmente d'un cran les dés des soins magiques » (les soins seulement)
  const farfadet = { race_id: 'races/farfadet', ethnie_id: regles.ethnies.find((e) => /farfadet-maritime/.test(e.id)).id };
  assert.equal(M.sortDuMoment(regles, fiche(farfadet), soin, auNm(soin)).dsb.texte, M.ecrireDegatsDeSort({ ...n, faces: 8 }));
  const bouleDeFeu = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  assert.equal(M.sortDuMoment(regles, fiche(farfadet), bouleDeFeu, auNm(bouleDeFeu)).dsb.texte, '2d6 dégâts', 'pas les dégâts');
  const desEnPlus = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'des_soins'));
  const plusUn = M.sortDuMoment(regles, fiche({ accessoires: [{ emplacement: 'chef', accessoire_effet_id: desEnPlus.id, valeur: null, maudit: 0 }] }), soin, auNm(soin));
  assert.equal(plusUn.dsb.texte, M.ecrireDegatsDeSort({ ...n, nombre: n.nombre + 1 }));
  // Offensif : les dégâts seulement, pas les soins
  assert.equal(M.sortDuMoment(regles, fiche({ posture_id: POSTURE('offensif') }), soin, auNm(soin)).dsb.texte, auNm(soin).dsb.replace(/\s*\+\s*/g, ' + '));
  // portée : un nombre seulement, accessoire + bâton du Vent
  const loin = regles.sorts.find((s) => /^\d+$/.test(s.portee) && Number(s.portee) >= 3);
  const portee = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'portee_sorts'));
  const p = M.sortDuMoment(regles, fiche({ accessoires: [{ emplacement: 'chef', accessoire_effet_id: portee.id, valeur: null, maudit: 0 }], ...ceinture('Bâton magique Vent, niveau 3') }), loin, auNm(loin));
  assert.equal(p.portee.texte, String(Number(loin.portee) + portee.effets[0].valeur + 3));
  const soi = regles.sorts.find((s) => s.portee === 'Soi-même');
  assert.equal(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Vent, niveau 3')), soi, auNm(soi)).portee.texte, 'Soi-même');
  // amplifications (réponse « Compter où c'est chiffré ») : « +8 dégâts » + Sang 3, « +5AP, +10AM » + Glace 3 (AM) ou Terre 3 (AP)
  const fer = regles.sorts.find((s) => s.types.includes('amplification') && s.dsb === '+8 dégâts');
  assert.equal(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Sang, niveau 3')), fer, auNm(fer)).dsb.texte, '+11 dégâts');
  const armure = regles.sorts.find((s) => s.types.includes('amplification') && s.dsb === '+5AP, +10AM');
  assert.equal(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Glace, niveau 3')), armure, auNm(armure)).dsb.texte, '+5AP, +13AM');
  assert.equal(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Terre, niveau 3')), armure, auNm(armure)).dsb.texte, '+8AP, +10AM');
  // ce que les bâtons ne chiffrent pas : rappelé
  const necro = M.sortDuMoment(regles, fiche(ceinture('Bâton magique Nécromancie, niveau 1')), fer, auNm(fer));
  assert.deepEqual(necro.rappels, [{ nom: 'Bâton magique Nécromancie, niveau 1', texte: 'Invocation +5 santé' }]);
});

test('degatsDArmeDuMoment (R100, R102) : Offensif « 6 D6+4 devient alors 40 », un dé au maximum, Défensif ÷ 2, Symbiose inutilisable', () => {
  const arme = regles.armes.find((a) => a.de === 'D6' && !a.bonus_degats && regles.familles_armes.find((f) => f.id === a.famille_id)?.maitrisable !== false);
  const f = (x = {}) => fiche({ armes: [{ rang: 1, arme_id: arme.id, materiau_id: null }], maitrises_armes: [{ arme_famille_id: arme.famille_id, des: 6 }], ...x });
  const base = M.degatsDArme(regles, f(), 1);
  assert.equal(base.notation, '6D6');
  const offensif = M.degatsDArmeDuMoment(regles, f({ posture_id: POSTURE('offensif') }), 1);
  assert.equal(offensif.texte, String(36 + base.total));
  const physiques = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'degats_physiques' && e.valeur === 4))
    ?? regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'degats_physiques'));
  const plus = physiques.effets[0].valeur;
  const avec = (x = {}) => f({ ...x, accessoires: [{ emplacement: 'chef', accessoire_effet_id: physiques.id, valeur: null, maudit: 0 }] });
  assert.equal(M.degatsDArmeDuMoment(regles, avec({ posture_id: POSTURE('offensif') }), 1).texte, String(36 + base.total + plus), '6D6+N au maximum');
  const max = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'de_maximum'));
  const deMax = M.degatsDArmeDuMoment(regles, f({ accessoires: [{ emplacement: 'chef', accessoire_effet_id: max.id, valeur: null, maudit: 0 }] }), 1);
  assert.equal(deMax.texte, `5D6+${6 + base.total}`);
  assert.equal(M.degatsDArmeDuMoment(regles, f({ posture_id: POSTURE('defensif') }), 1).diviseur, 2);
  assert.equal(M.degatsDArmeDuMoment(regles, f({ posture_id: POSTURE('symbiose') }), 1).inutilisable, 'Symbiose');
  assert.equal(M.degatsDArmeDuMoment(regles, f(), 1).texte, base.texte, 'sans posture ni accessoire : les dégâts de la fiche');
});

test('bâtons magiques (R101) : effets lus sur toute la base ; le bâton à régler, sa magie et son niveau ; la ceinture ne le prend pas réglé', () => {
  for (const b of lignes('SELECT id, bonus_brut FROM baton_magique')) {
    for (const e of effetsDeBaton(b.bonus_brut)) assert.ok(e.cle, `${b.id} : « ${e.texte} » non lu`);
  }
  assert.deepEqual(effetsDeBaton('Coût sort -2\nCoût corruption -4'), [{ cle: 'cout', valeur: -2, texte: 'Coût sort -2' }, { cle: 'cout_corruption', valeur: -4, texte: 'Coût corruption -4' }]);
  const a = regles.ceinture.baton_a_regler;
  assert.equal(a, 'Bâton magique');
  const catalogue = M.catalogueDuSac(regles);
  assert.ok(catalogue.includes(a));
  assert.ok(!catalogue.some((n) => /^Bâton magique .+, niveau \d$/.test(n)), 'les bâtons réglés ne sont plus proposés un par un');
  assert.deepEqual(M.batonDuSac(regles, a), { regle: false, baton: null });
  assert.equal(M.batonDuSac(regles, 'Bâton magique Feu, niveau 2').baton.niveau, 2);
  assert.equal(M.batonDuSac(regles, 'Corde'), null);
  assert.equal(M.nomDuBaton(regles, 'magies/magie-du-feu', '2'), 'Bâton magique Feu, niveau 2');
  assert.equal(M.nomDuBaton(regles, 'magies/magie-du-feu', 4), null);
  assert.equal(M.magiesDesBatons(regles).length, 14);
  assert.ok(M.magiesDesBatons(regles).every((m) => m.niveaux.join() === '1,2,3'));
  const sac = { inventaire: [{ rang: 1, nom: a, quantite: 1 }, { rang: 2, nom: 'Bâton magique Feu, niveau 2', quantite: 1 }] };
  assert.equal(M.mettreALaCeinture(regles, fiche(sac), 1, a), null, 'à régler d’abord');
  assert.equal(M.mettreALaCeinture(regles, fiche(sac), 1, 'Bâton magique Feu, niveau 2').ceinture[0].nom, 'Bâton magique Feu, niveau 2');
  assert.deepEqual(M.suggestionsDeCeinture(fiche(sac), regles).map((s) => s.nom), ['Bâton magique Feu, niveau 2']);
});

test('sort-bonus-texte (R102) : les bonus de sorts des dons de classe et de race, et des armures élémentaires, tels qu’épinglés', () => {
  const lus = new Map();
  for (const r of [...lignes('SELECT id, effet AS texte FROM capacite WHERE effet IS NOT NULL'), ...lignes('SELECT id, texte FROM race_don')]) {
    const b = bonusDeSortsEcrits(r.texte);
    if (b.length) lus.set(r.id, b.map((x) => `${x.cible}:${x.valeur ?? (x.parNpm ? 'npm' : `${x.base}+${x.pas}/${x.niveaux}${x.niveauGlobal ? ' global' : ''}`)}${x.raison ? `!${x.raison}` : x.posture ? `@${x.posture}` : ''}`).join(' '));
  }
  assert.deepEqual(Object.fromEntries(lus), {
    'capacites/archimage-tempus-figus': 'portee:2',
    'capacites/barde-menestrel': 'degats:2',
    'capacites/clerc-comme-un-seul': 'degats:4 soin:4',
    'capacites/clerc-pour-dieu': 'degats:7',
    'capacites/fenrir-manteau-noir': 'cout:-4',
    'capacites/grenadier-pardon': 'degats:11',
    'capacites/jackalope-cyclique': 'cout:-4',
    'capacites/kitsune-reduction': 'cout:-4',
    'capacites/kitsune-soin-renforce': 'soin:6',
    'capacites/mage-attaquant-magique': 'degats:6',
    'capacites/mage-puissance': 'degats:3+2/6',
    'capacites/mage-rouge-charge-lente': 'degats:5',
    'capacites/mage-rouge-ou-rapide': 'degats:5',
    'capacites/mage-soigneur': 'portee:2',
    'capacites/mage-vert-mage-emeraude': 'degats:3@focus',
    'capacites/mage-vert-soralonge': 'portee:2!situation',
    'capacites/namazu-eau-pure': 'cout:-4',
    'capacites/ocultomancien-econome': 'cout:npm',
    'capacites/ocultomancien-meteorologue': 'degats:4!situation',
    'capacites/rokh-diurne': 'cout:-4',
    'capacites/satyre-habitue': 'cout:-4',
    'races/elfe-argente#don:ailleurs': 'degats:2+2/5 global',
    'races/elfe-argente#don:barrage-argente': 'degats:2+2/5 global',
    'races/elfe-argente#don:territoire-elfes-argentes': 'degats:2+2/5 global',
    'races/elfe-dore#don:sang-dore': 'degats:3 soin:3',
    'races/farfadet#don:farfadet-maritime-forets-proches-de-leau': 'cran:1',
    'races/felfe#don:felfe-argente': 'degats:1+1/5 global',
  });
  // chaque armure élémentaire nomme sa magie (« +4 dégâts avec les sorts de l'Eau ») : elle seule ; et deux autres effets chiffrés
  for (const e of regles.armures_elementaires) {
    for (const b of (e.sorts ?? []).filter((x) => x.cible === 'degats')) assert.deepEqual(b.vises, { magies: [e.magie_id] }, e.id);
  }
  assert.equal(regles.armures_elementaires.filter((e) => e.sorts?.some((b) => b.cible === 'degats')).length, regles.armures_elementaires.length);
  const autres = regles.armures_elementaires.flatMap((e) => (e.sorts ?? []).filter((b) => b.cible !== 'degats').map((b) => [e.id.split(':').slice(1).join(':'), b]));
  assert.deepEqual(autres, [
    ['vetement:vent', { cible: 'portee', valeur: 2, vises: { types: ['placement'], magies: ['magies/magie-du-vent'] } }],
    ['intermediaire:lumiere', { cible: 'soin', valeur: 7, vises: { soin: true } }],
  ]);
});

test('relectures (R101, R102) : protection chiffrée, coût 0, valeur par tour, bonus négatif, plusieurs dés au maximum, effets d’armure élémentaire, NPM accessible', () => {
  // protection (réponse « Compter où c'est chiffré ») : « −N dégâts » du D/S/B et « Bloque N dégâts » des effets, plus « protection = +N dégâts bloqués »
  const mucus = regles.sorts.find((s) => s.id === 'magies/magie-de-leau#sort:mucus-protecteur');
  assert.equal(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Glace, niveau 3')), mucus, auNm(mucus)).dsb.texte, '-13 dégâts magiques');
  const champ = regles.sorts.find((s) => s.id === 'magies/magie-de-la-lumiere#sort:champ-de-force');
  const c = M.sortDuMoment(regles, fiche(ceinture('Bâton magique Terre, niveau 3')), champ, auNm(champ));
  assert.match(c.effets.texte, /^Bloque 17 dégâts/);
  assert.deepEqual(c.rappels, []);
  const rocheuse = regles.sorts.find((s) => s.id === 'magies/magie-de-la-terre#sort:barriere-rocheuse');
  assert.deepEqual(M.sortDuMoment(regles, fiche(ceinture('Bâton magique Terre, niveau 3')), rocheuse, auNm(rocheuse)).rappels.map((r) => r.texte), ['protection = +7 dégâts bloqués']);
  // un coût écrit 0 reste 0, même réduit : le sort ne consomme pas de chakra (décision R106), la réduction est dite non comptée, rien n'est en gras
  for (const planete of regles.sorts.filter((s) => s.cout === '0')) {
    assert.equal(M.sortDuMoment(regles, fiche(), planete, auNm(planete)).cout.texte, '0');
    const r = M.sortDuMoment(regles, fiche(ceinture('Bâton magique Arcane, niveau 3')), planete, auNm(planete));
    assert.deepEqual([r.cout.texte, r.cout.detail, r.nonComptes.filter((n) => n.cible === 'cout').map((n) => [n.raison, n.valeur])], ['0', [], [['sans_chakra', -3]]], planete.id);
  }
  // une valeur par tour reçoit ses bonus à chaque tour (décision R113) : le bonus du bâton avant la période
  const parTour = regles.sorts.find((s) => s.attaque && /^\d+d\d+ dégâts par tour$/.test(auNm(s).dsb));
  const t = M.sortDuMoment(regles, fiche(ceinture('Bâton magique Feu, niveau 3')), parTour, auNm(parTour));
  const [, desDuTour] = /^(\d+d\d+) dégâts par tour$/.exec(auNm(parTour).dsb);
  assert.deepEqual([t.dsb.texte, t.dsb.lu, t.nonComptes], [`${desDuTour} + 9 dégâts par tour`, true, []]);
  // un D/S/B illisible d'un sort d'attaque : ses bonus dits non comptés (l'accessoire « Dégâts magie » aussi)
  const illisible = regles.sorts.find((s) => s.attaque && !M.lireDegatsDeSort(auNm(s).dsb) && !s.types.includes('amplification') && !s.types.includes('protection'));
  const magie = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'degats_magie'));
  const i = M.sortDuMoment(regles, fiche({ accessoires: [{ emplacement: 'chef', accessoire_effet_id: magie.id, valeur: null, maudit: 0 }] }), illisible, auNm(illisible));
  assert.deepEqual(i.nonComptes.map((n) => n.raison), ['non_chiffre']);
  // un accessoire maudit : un bonus négatif s'écrit « − 2 »
  const boule = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-feu' && s.dsb === '2d6 dégâts (+1d6/NM)');
  const v = magie.effets.find((e) => e.cible === 'degats_magie').valeur;
  assert.equal(M.sortDuMoment(regles, fiche({ accessoires: [{ emplacement: 'chef', accessoire_effet_id: magie.id, valeur: null, maudit: 1 }] }), boule, auNm(boule)).dsb.texte, `2d6 − ${v} dégâts`);
  assert.equal(M.ecrireDegatsDeSort({ nature: 'degats', nombre: 0, faces: null, fixe: -3, prefixe: '', suite: 'dégâts' }), '0 dégâts');
  // deux accessoires « un dé au maximum » : deux dés
  const max = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'de_maximum'));
  const deux = fiche({ accessoires: ['chef', 'collier'].map((emplacement) => ({ emplacement, accessoire_effet_id: max.id, valeur: null, maudit: 0 })) });
  assert.equal(M.sortDuMoment(regles, deux, boule, auNm(boule)).dsb.texte, '12 dégâts');
  // armure élémentaire : « Les sorts de soin ont un bonus de +7 » ; « Les sorts de placement du Vent voient leur portée augmentée de 2 »
  const lumiere = regles.armures_elementaires.find((e) => e.id.endsWith('intermediaire:lumiere'));
  const soin = regles.sorts.find((s) => s.types.includes('soin') && /^\d+d6 soin/.test(auNm(s).dsb));
  const n = M.lireDegatsDeSort(auNm(soin).dsb);
  assert.equal(M.sortDuMoment(regles, fiche({ armure_id: regles.armures[0].id, armure_elementaire_id: lumiere.id }), soin, auNm(soin)).dsb.texte, M.ecrireDegatsDeSort({ ...n, fixe: n.fixe + 7 }));
  const vent = regles.armures_elementaires.find((e) => e.id.endsWith('vetement:vent'));
  const fv = fiche({ armure_id: regles.armures[0].id, armure_elementaire_id: vent.id });
  const placement = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-vent' && s.types.includes('placement') && /^\d+$/.test(auNm(s).portee));
  const autreVent = regles.sorts.find((s) => s.magie_id === 'magies/magie-du-vent' && !s.types.includes('placement') && /^\d+$/.test(auNm(s).portee));
  assert.equal(M.sortDuMoment(regles, fv, placement, auNm(placement)).portee.texte, String(Number(auNm(placement).portee) + 2));
  assert.equal(M.sortDuMoment(regles, fv, autreVent, auNm(autreVent)).portee.texte, auNm(autreVent).portee);
  // Symbiose : le NPM accessible (un personnage à magie acquise n'a pas le palier 5)
  const n16 = regles.niveaux.find((l) => M.puissanceMagique(regles, l.niveau) === 5).niveau;
  const bi = fiche({ posture_id: POSTURE('symbiose'), magie_acquise_id: 'magies/magie-de-la-glace', symbiose_magie_id: 'magies/magie-du-feu', xp: xpDuNiveau(n16) });
  const p = M.postureDuMoment(regles, bi);
  assert.deepEqual([M.npmMax(regles, bi), p.symbiose.degats, p.symbiose.am], [4, 5 + 2 * 3, 4 + 2 * 3]);
  // le choix de la magie de la Symbiose, dans le tiroir des choix
  assert.ok(M.choixEnAttente(regles, fiche({ posture_id: POSTURE('symbiose'), magie_acquise_id: 'magies/magie-de-la-glace' })).some((c) => c.nature === 'symbiose'));
  assert.ok(!M.choixEnAttente(regles, bi).some((c) => c.nature === 'symbiose'));
  // la ceinture : le bâton à régler n'est pas proposé, même choisi dans la liste
  const sac = fiche({ inventaire: [{ rang: 1, nom: 'Bâton magique', quantite: 1 }] });
  assert.equal(M.objetChoisiDansLaListe(sac, 'Bâton magique', 'insertReplacementText', regles), null);
});
