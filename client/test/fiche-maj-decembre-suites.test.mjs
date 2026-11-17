// La fiche applique les décisions de « Mise à jour de Décembre, suites » : R253 (1) l'ordre des races, (2) et (3) le don « Gemmoïde » du Gémidien, R257 la limite D12
// quand une montée et une baisse se mêlent, R259 les cases « Passe / Casse la barrière » qui ne citent plus Anti-barrière ni Pré-mythril. (Boxeur et Porte-étendard :
// test/boxeur-bouclier.test.mjs, test/fiche-acquis.test.mjs ; R260 : test/fiche-listes-infobulles.test.mjs.)
// Les règles (textes et valeurs que le site de dev modifie) sont épinglées sur leur état d'import (test/aide-base-d-import.mjs) ; les écritures lues sont des
// exemples de lecteur, pas des textes de la base.
//   node --test test/fiche-maj-decembre-suites.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { bonusDeDegatsEcrit } from '../src/lib/degats-texte.mjs';
import { ORDRE_DES_RACES } from '../src/lib/race-kinds.mjs';
import { bonusDeSortsEcrits } from '../src/lib/sort-bonus-texte.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';
import { baseDImport, reglesDImport } from './aide-base-d-import.mjs';

const regles = reglesDImport(); // tel que la page le reçoit
const dImport = baseDImport();
const GEMIDIEN = 'races/gemidien';
const FONGOIDE = 'races/fongoide';
const FEU = 'magies/magie-du-feu';
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: FEU, ...x });
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const auNm = (s, nm = 0) => Object.fromEntries(['cout', 'portee', 'dsb', 'effets'].map((c) => [c, valeurAuNm(s[c], s.bonus ?? [], c, nm) ?? '']));
const gemidien = (niveau, x = {}) => fiche({
  race_id: GEMIDIEN, ethnie_id: regles.ethnies.find((e) => e.race_id === GEMIDIEN)?.id ?? null, magie_innee_id: FEU, xp: xpDuNiveau(niveau), ...x,
});
const donGemmoide = regles.races.find((r) => r.id === GEMIDIEN).dons.find((d) => d.id === 'races/gemidien#don:gemmoide');
const nomDuDon = donGemmoide.nom ?? donGemmoide.etiquette;
/** Un sort d'attaque lu de la magie `magie_id` (dés et fixe lisibles). */
const sortDe = (magie) => regles.sorts.find((s) => s.magie_id === magie && s.attaque && M.lireDegatsDeSort(auNm(s).dsb)?.nombre);
const bonusDuDon = (f, sort) => M.sortDuMoment(regles, f, sort, auNm(sort)).dsb.detail.filter((d) => d.nom === nomDuDon).map((d) => d.valeur);

test('R253 (2) : « +3 dégâts (+2/5 niveau global) » se lit 3 + 2 × ⌊niveau global ÷ 5⌋, comme R110 ; un sort de la magie innée seulement (R253 (3))', () => {
  // la lecture : une progression au niveau global, sur les sorts de la magie innée seule (une écriture d'exemple, pas le texte de la base)
  assert.deepEqual(bonusDeSortsEcrits("Inflige un bonus +3 dégâts (+2/5 niveau global) de l'élément de la magie innée."),
    [{ cible: 'degats', base: 3, pas: 2, niveaux: 5, niveauGlobal: true, vises: { innee: true } }]);
  // le don de l'import est lu ainsi : rien d'écrit à la main dans les règles
  assert.deepEqual(donGemmoide.sorts, [{ cible: 'degats', base: 3, pas: 2, niveaux: 5, niveauGlobal: true, vises: { innee: true } }]);

  const innee = sortDe(FEU);
  assert.ok(innee, 'un sort d’attaque de la magie innée');
  // niveaux 4, 5 et 20 : +3, +5, +11 (R110 : 3 + 2 × ⌊N ÷ 5⌋) ; aux niveaux 1 et 10 aussi, pour la marche
  for (const [niveau, attendu] of [[1, 3], [4, 3], [5, 5], [10, 7], [20, 11]]) {
    const f = gemidien(niveau);
    assert.equal(M.niveauGlobal(regles, f.xp), niveau);
    assert.deepEqual(bonusDuDon(f, innee), [attendu], `niveau ${niveau}`);
    assert.ok(!M.sortDuMoment(regles, f, innee, auNm(innee)).nonComptes.some((n) => n.nom === nomDuDon), 'compté, pas « non compté »');
  }
  // il ne compte pas sur le sort d'une autre magie que la magie innée (R253 (3) : « ni autre dégât de l'élément »)
  const autre = sortDe('magies/magie-de-leau');
  assert.ok(autre && autre.magie_id !== FEU);
  assert.deepEqual(bonusDuDon(gemidien(20), autre), []);
  // ni sur une autre magie innée : la magie innée du personnage est celle qui décide (le même sort d'eau, Eau en magie innée)
  assert.deepEqual(bonusDuDon(gemidien(20, { magie_innee_id: 'magies/magie-de-leau' }), autre), [11]);
});

test('R253 (3) : « Gemmoïde » n’ajoute rien aux dégâts d’une arme (ni arme, ni autre dégât de l’élément)', () => {
  // le lecteur des armes (lib/degats-texte.mjs) ne lit pas ce don : aucun bonus de dégâts exporté pour lui
  assert.equal(donGemmoide.degats, undefined);
  assert.equal(bonusDeDegatsEcrit("Inflige un bonus +3 dégâts (+2/5 niveau global) de l'élément de la magie innée."), null);
  const arme = regles.armes.find((a) => !a.bonus_degats && regles.familles_armes.find((f) => f.id === a.famille_id)?.maitrisable !== false);
  for (const niveau of [4, 5, 20]) {
    const f = gemidien(niveau, { armes: [{ rang: 1, arme_id: arme.id, materiau_id: null }] });
    const sans = { ...f, race_id: 'races/humain', ethnie_id: null };
    const degats = M.degatsDArme(regles, f, 1);
    assert.deepEqual(degats.bonus.filter((b) => b.nom === nomDuDon), []);
    assert.deepEqual(degats.nonComptes.filter((b) => b.nom === nomDuDon), []);
    assert.equal(degats.total, M.degatsDArme(regles, sans, 1).total, `niveau ${niveau} : mêmes dégâts d’arme qu’un autre personnage`);
  }
});

test('R253 (1) : Fongoïde puis Gémidien, à la fin des races pures, dans l’ordre figé, l’onglet « Race » et la liste des races', () => {
  const premiereHybride = ORDRE_DES_RACES.indexOf('races/drassahthac');
  assert.deepEqual(ORDRE_DES_RACES.slice(premiereHybride - 2, premiereHybride), [FONGOIDE, GEMIDIEN]);
  // la fiche : l'ordre des races de ses règles suit celui de l'onglet « Race » (race.ordre), pures avant les hybrides, Fongoïde avant Gémidien
  const ids = regles.races.map((r) => r.id);
  assert.ok(ids.indexOf(FONGOIDE) + 1 === ids.indexOf(GEMIDIEN), 'Gémidien juste après Fongoïde');
  assert.equal(ids[ids.indexOf(FONGOIDE) - 1], 'races/mort-vivant', 'à la suite de la dernière race pure du classeur');
  assert.equal(ids[ids.indexOf(GEMIDIEN) + 1], 'races/drassahthac', 'avant les hybrides');
  // à l'import : race.ordre et race.rang_liste, dans le même ordre (la liste des races se réordonne ensuite sur le site de dev)
  const rang = (colonne) => dImport.prepare(`SELECT id FROM race WHERE ${colonne} IS NOT NULL ORDER BY ${colonne}`).all().map((r) => r.id);
  for (const colonne of ['ordre', 'rang_liste']) {
    const ordre = rang(colonne);
    assert.equal(ordre.indexOf(GEMIDIEN), ordre.indexOf(FONGOIDE) + 1, `${colonne} : Gémidien juste après Fongoïde`);
    assert.equal(ordre[ordre.indexOf(FONGOIDE) - 1], 'races/mort-vivant', `${colonne} : après la dernière race pure du classeur`);
    // la race qui suit est une hybride (la fin de l'ordre figé, Drassah'thac compris) : les deux races sont bien les dernières des races pures de la liste
    assert.ok(ORDRE_DES_RACES.indexOf(ordre[ordre.indexOf(GEMIDIEN) + 1]) >= premiereHybride, `${colonne} : avant les hybrides`);
  }
});

test('R257 : une montée et une baisse de dé s’additionnent avant le plafond D12 ; un D12 monté d’un cran et baissé d’un cran reste D12', () => {
  // le dé : les crans se comptent avant le plafond (1 − 1 = 0)
  assert.equal(M.deMonte(12, 1 - 1), 12);
  assert.equal(M.deMonte(10, 2 - 1), 12, 'D10 + 2 − 1 = D12');
  assert.equal(M.deMonte(10, 1 - 1), 10);
  assert.equal(M.deMonte(8, 1 - 1), 8);

  // sur un sort : Focus (+1 cran) et un accessoire maudit « Augmente le dé de dégâts des sorts » (un cran de moins, R54), le dé du sort reste le même
  const cran = regles.accessoires.find((a) => a.effets?.some((e) => e.cible === 'cran_des_sorts'));
  const focus = 'guide/postures#posture:focus';
  const maudit = fiche({ posture_id: focus, accessoires: [{ emplacement: 'chef', accessoire_effet_id: cran.id, valeur: null, maudit: 1 }] });
  const facesDuSort = (f, s) => M.lireDegatsDeSort(M.sortDuMoment(regles, f, s, auNm(s)).dsb.texte)?.faces;
  const d10 = regles.sorts.find((s) => { const l = M.lireDegatsDeSort(auNm(s).dsb); return l?.nature === 'degats' && l.faces === 10 && l.nombre; });
  const d12 = { ...d10, dsb: '2d12 dégâts' };
  assert.deepEqual([facesDuSort(maudit, d12), facesDuSort(fiche({ posture_id: focus }), d12)], [12, 12], 'D12 : +1 − 1 reste D12, +1 seul aussi');
  assert.equal(facesDuSort(maudit, d10), 10, 'D10 : +1 − 1 reste D10 (les crans s’annulent)');
});

test('R259 : les cases « Passe / Casse la barrière » ne citent ni Anti-barrière ni Pré-mythril, ni aucun matériau d’arme (R241 (3))', () => {
  const ids = M.CASES_DE_LA_BARRIERE.map((c) => c.id);
  for (const id of ['passe', 'casse']) assert.ok(ids.includes(id), id);
  const nomDuDon = dImport.prepare("SELECT nom FROM capacite WHERE id = 'capacites/arbaletrier-pre-mythril'").get().nom;
  const nomCapacite = dImport.prepare("SELECT nom FROM monstre_capacite_commune WHERE id = 'anti-barriere'").get().nom;
  const materiaux = dImport.prepare('SELECT r.nom FROM materiau_arme m JOIN ressource r ON r.id = m.ressource_id').all().map((m) => m.nom);
  assert.ok(nomDuDon && nomCapacite && materiaux.length > 0);
  const norme = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const texte = norme(M.CASES_DE_LA_BARRIERE.map((c) => `${c.nom} ${c.aide}`).join('\n'));
  const cite = (nom) => new RegExp(`(?<![a-z])${norme(nom).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`).test(texte);
  for (const nom of [nomDuDon, nomCapacite, ...materiaux]) assert.ok(!cite(nom), `une case cite « ${nom} »`);
  // le calcul ne dépend que des cases : « Passe » laisse la barrière, « Casse » la tombe à 0, tout baisse la santé (R171)
  const jauges = { barriere: 10, sante: 50 };
  assert.deepEqual([M.degatsALaBarriere(7, jauges, { passe: true }).barriere, M.degatsALaBarriere(7, jauges, { passe: true }).sante], [10, 43]);
  assert.deepEqual([M.degatsALaBarriere(7, jauges, { casse: true }).barriere, M.degatsALaBarriere(7, jauges, { casse: true }).sante], [0, 43]);
});
