// Décision R174 (2026-10-29) : les résistances physiques de la fiche — le tableau des résistances et faiblesses gagne Estoc, Frappe et Taille ; le
// Potentiel Illimité (toujours la magie innée, R176) y a un cran de moins à chacun (« Surtension corporelle » : la Vulnérabilité, × 2), un palier
// personnel, annulé en Mode Hyper (R172 : le Mode Hyper actif passe `sansMalusPhysique`, restreint aux crans négatifs du PI ; le détail du Mode Hyper :
// test/fiche-mode-hyper.test.mjs) ; dans les dégâts reçus, l'armure d'abord (R98), puis
// le palier physique, au même endroit que le palier de l'élément, les deux multipliés, arrondi à l'inférieur une seule fois (R175).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { CASES_RESISTANCES } from '../src/lib/fiche-tableur-cases.mjs';
import { cellulesDeLaFiche } from '../src/lib/fiche-tableur-export.mjs';

const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false })))); // tel que la page le reçoit
const PI = 'magies/potentiel-illimite';
const FEU = 'magies/magie-du-feu';
const GLACE = 'magies/magie-de-la-glace';
const E = (id) => `ressources/accessoires#effet:${id}`;
// « Résistance Feu et Brûlure » (R54) : un cran de Feu chacun
const BAGUES_DU_FEU = ['bague-1', 'bague-2'].map((emplacement) => ({ emplacement, accessoire_effet_id: E('defense:5'), valeur: null, maudit: 0 }));
const ARMURE_CONTRE_L_ESTOC = 'ressources/armures#armure:armure-cellulose-fer';
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', ...x });
/** Les cibles physiques du tableau : `id:crans>palier`, dans l'ordre. */
const physiques = (r) => r.paliers.flatMap((p) => p.cibles.filter((c) => c.type === 'physique').map((c) => `${c.id}:${c.crans}>${p.id}`));
/** Toutes les lignes du tableau : `type:id` → [crans, palier]. */
const lignes = (r) => Object.fromEntries(r.paliers.flatMap((p) => p.cibles.map((c) => [`${c.type}:${c.id}`, [c.crans, p.id]])));

test('R174 : les trois types physiques, dans l’ordre du propriétaire (« Estoc, Frappe, Taille »), nommés comme les types de dégâts', () => {
  assert.deepEqual(M.RESISTANCES_PHYSIQUES.map((t) => [t.id, t.nom]), [['estoc', 'Estoc'], ['frappe', 'Frappe'], ['taille', 'Taille']]);
  assert.deepEqual(new Set(M.RESISTANCES_PHYSIQUES.map((t) => t.id)), new Set(M.DEGATS_PHYSIQUES.map(([id]) => id)), 'les mêmes que les types d’un coup');
});

test('R174 : le Potentiel Illimité — −1 cran, Vulnérabilité, sur Estoc, Frappe et Taille, après les magies et les altérations ; origine : la magie', () => {
  // Mort-Vivant de Feu : des magies et une altération dans le tableau, puis les types physiques
  const r = M.resistancesDe(regles, fiche({ race_id: 'races/mort-vivant', ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-feu', magie_innee_id: PI }));
  assert.deepEqual(physiques(r), ['estoc:-1>vulnerabilite', 'frappe:-1>vulnerabilite', 'taille:-1>vulnerabilite']);
  const vulnerabilite = r.paliers.find((p) => p.id === 'vulnerabilite').cibles;
  assert.deepEqual(vulnerabilite.map((c) => c.type), ['magie', 'physique', 'physique', 'physique'], 'la Glace, puis les types physiques');
  for (const c of vulnerabilite.filter((x) => x.type === 'physique')) {
    assert.equal(c.nom, M.RESISTANCES_PHYSIQUES.find((t) => t.id === c.id).nom);
    assert.deepEqual(c.origines, [{ nom: 'Potentiel Illimité (magie innée)', crans: -1 }]);
    assert.equal(c.immunite, false);
  }
  // le palier : la Vulnérabilité de la base, × 2 (R155)
  assert.equal(regles.resistance_paliers.find((p) => p.id === 'vulnerabilite').multiplicateur, 2);
});

test('R174 : un personnage sans cran physique n’a pas de ligne physique (absente, comme une magie sans cran) — toute magie innée autre que le PI, toute paire', () => {
  for (const innee of regles.magies.filter((m) => m.id !== PI)) {
    for (const acquise of [null, ...regles.magies.filter((m) => m.id !== PI && m.id !== innee.id)]) {
      const r = M.resistancesDe(regles, fiche({ magie_innee_id: innee.id, magie_acquise_id: acquise?.id ?? null }));
      assert.deepEqual(physiques(r), [], `${innee.nom} + ${acquise?.nom ?? 'rien'}`);
    }
  }
  assert.deepEqual(physiques(M.resistancesDe(regles, fiche())), [], 'sans magie');
});

test('R172, R174 : le Mode Hyper actif passe `sansMalusPhysique` — il retire le malus du PI et rien d’autre ; l’option le force ou l’empêche', () => {
  const f = fiche({ race_id: 'races/mort-vivant', ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-feu', magie_innee_id: PI, accessoires: BAGUES_DU_FEU });
  const avec = lignes(M.resistancesDe(regles, f));
  const sans = lignes(M.resistancesDe(regles, f, { sansMalusPhysique: true }));
  assert.deepEqual(Object.keys(avec).filter((k) => !(k in sans)), ['physique:estoc', 'physique:frappe', 'physique:taille']);
  assert.deepEqual(sans, Object.fromEntries(Object.entries(avec).filter(([k]) => !k.startsWith('physique:'))), 'le reste inchangé');
  // les dégâts reçus le passent à resistancesDe
  assert.equal(M.degatsRecus(regles, f, { entrants: 30, type: 'estoc', sansMalusPhysique: true }).recus, 30);
  // le Mode Hyper actif (niveau 2 et plus, la case cochée) le passe ; décoché, ou dans l'export (la fiche, pas le moment), le malus reste
  const enHyper = { ...f, xp: regles.niveaux.find((l) => l.niveau === 2).xp_min, mode_hyper: 1 };
  const physiquesEnHyper = (o) => Object.keys(lignes(M.resistancesDe(regles, enHyper, o))).filter((k) => k.startsWith('physique:'));
  assert.deepEqual(physiquesEnHyper(), [], 'le Mode Hyper l’annule');
  assert.deepEqual(physiquesEnHyper({ sansMalusPhysique: false }), ['physique:estoc', 'physique:frappe', 'physique:taille'], 'l’option l’empêche');
  assert.deepEqual(physiquesEnHyper({ avecLaPosture: false }), ['physique:estoc', 'physique:frappe', 'physique:taille'], 'l’export garde la fiche');
  assert.equal(M.degatsRecus(regles, enHyper, { entrants: 30, type: 'estoc' }).recus, 30);
  assert.equal(M.degatsRecus(regles, { ...enHyper, mode_hyper: 0 }, { entrants: 30, type: 'estoc' }).recus, 60);
});

test('R174, exemple du propriétaire : 30 entrants, AP 4, PI × 2 et grande résistance au Feu ÷ 3 → 26 × 2 ÷ 3 = 17 (les deux paliers se multiplient, un seul arrondi)', () => {
  // Drakos rouge (AP 4 de la race et de l'ethnie), Potentiel Illimité, deux bagues « Résistance Feu et Brûlure » : Feu à 2 crans, grande résistance
  // (configuration de calcul seulement : la source des accessoires interdit deux accessoires au même effet, « On ne peut pas avoir deux accessoires qui
  // ont le même effets », Ressources et Craft › Accessoires, A1 ; elle sert ici à obtenir deux crans de Feu)
  const f = fiche({ race_id: 'races/drakos', ethnie_id: 'races/drakos#ethnie:drakos-rouge', magie_innee_id: PI, accessoires: BAGUES_DU_FEU });
  assert.equal(M.defenseDe(regles, f).ap.total, 4);
  assert.deepEqual(lignes(M.resistancesDe(regles, f))[`magie:${FEU}`], [2, 'grande_resistance']);
  const r = M.degatsRecus(regles, f, { entrants: 30, type: 'estoc', element: FEU });
  assert.equal(r.recus, 17);
  assert.deepEqual(r.etapes.map((e) => [e.texte, e.valeur]), [
    ['Dégâts entrants', 30],
    ['− AP', -4],
    ['Vulnérabilité contre estoc (dégâts subis x2)', 52],
    ['Grande résistance (dégâts subis ÷3)', 52 / 3],
  ], 'le palier physique, puis celui de l’élément ; arrondi à la fin seulement');
  // chaque type physique a son palier, « Magique » + Feu n'en a aucun
  for (const type of ['taille', 'frappe']) assert.equal(M.degatsRecus(regles, f, { entrants: 30, type, element: FEU }).recus, 17, type);
  const magique = M.degatsRecus(regles, f, { entrants: 30, type: 'magique', element: FEU });
  assert.ok(!magique.etapes.some((e) => /contre (estoc|taille|frappe)/.test(e.texte)), 'un coup « Magique » : aucun palier physique');
  assert.deepEqual(magique, M.degatsRecus(regles, f, { entrants: 30, type: 'magique', element: FEU, sansMalusPhysique: true }));
});

test('R174, exemple du propriétaire : 30 en Estoc, armure qui résiste à l’estoc (AP 4 → 8), PI × 2 → 22 × 2 = 44 (l’armure d’abord, puis le palier)', () => {
  const armure = M.trouver(regles.armures, ARMURE_CONTRE_L_ESTOC);
  assert.equal(armure.ap, 4);
  assert.deepEqual(armure.degats.filter((d) => d.type === 'estoc'), [{ sens: 'resistance', type: 'estoc', multiplicateur: 1 }]);
  const f = fiche({ magie_innee_id: PI, armure_id: armure.id });
  assert.equal(M.defenseDe(regles, f).ap.total, 4, 'l’humain n’a pas d’AP à lui');
  const r = M.degatsRecus(regles, f, { entrants: 30, type: 'estoc' });
  assert.equal(r.armure, 8);
  assert.equal(r.recus, 44);
  assert.deepEqual(r.etapes.map((e) => e.texte), ['Dégâts entrants', '− AP (armure × 2 contre estoc)', 'Vulnérabilité contre estoc (dégâts subis x2)']);
  // la défense partielle et le don (÷ 2 chacun) viennent avant le palier : 22 ÷ 2 ÷ 2 × 2 = 11
  assert.equal(M.degatsRecus(regles, f, { entrants: 30, type: 'estoc', reduits: true, don: true }).recus, 11);
  // arrondi à l'inférieur, une fois : 31 → 23 ÷ 2 = 11,5 × 2 = 23 (et non ⌊11,5⌋ × 2 = 22)
  assert.equal(M.degatsRecus(regles, f, { entrants: 31, type: 'estoc', reduits: true }).recus, 23);
});

test('R174 : un coup Estoc sans élément pour un personnage sans cran physique est calculé comme avant (aucune étape de plus)', () => {
  const armure = M.trouver(regles.armures, ARMURE_CONTRE_L_ESTOC);
  for (const f of [fiche(), fiche({ magie_innee_id: FEU, armure_id: armure.id }), fiche({ magie_innee_id: GLACE, magie_acquise_id: FEU })]) {
    for (const type of ['estoc', 'taille', 'frappe']) {
      const r = M.degatsRecus(regles, f, { entrants: 41, type });
      assert.equal(r.etapes.length, 2, `${f.magie_innee_id} ${type} : entrants et armure seulement`);
      assert.equal(r.recus, Math.max(0, 41 - r.armure));
      // le même calcul que sans le malus (rien à annuler)
      assert.deepEqual(M.degatsRecus(regles, f, { entrants: 41, type, sansMalusPhysique: true }), r);
    }
  }
});

test('R174 : l’export en tableur écrit les types physiques dans la case de leur palier (BI8 pour le Potentiel Illimité), après les magies et les altérations', () => {
  const f = fiche({ race_id: 'races/mort-vivant', ethnie_id: 'races/mort-vivant#ethnie:mort-vivant-feu', magie_innee_id: PI });
  const v = cellulesDeLaFiche(regles, f, { date: '29/10/2026' }).cellules;
  const cellule = (id) => v[CASES_RESISTANCES.find((k) => k.palier === id).cibles] ?? '';
  assert.equal(cellule('vulnerabilite'), `${M.trouver(regles.magies, GLACE).nom}, Estoc, Frappe, Taille`);
  // sans le PI : aucun type physique nulle part
  const feu = cellulesDeLaFiche(regles, fiche({ magie_innee_id: FEU }), { date: '29/10/2026' }).cellules;
  for (const k of CASES_RESISTANCES) assert.doesNotMatch(feu[k.cibles] ?? '', /Estoc|Frappe|Taille/, k.palier);
});

test('R174, la page (src/scripts/fiche.mjs, lue comme un texte) : un type physique est cerclé de la couleur de son palier', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const debut = script.indexOf('function construireResistances()');
  const corps = script.slice(debut, script.indexOf('\n}\n', debut));
  assert.match(corps, /c\.type === 'physique' \? palierTeinte\(p\.id\)/);
  const css = readFileSync(new URL('../src/styles/fiche/fiche.css', import.meta.url), 'utf8');
  assert.match(css, /\.resistance--physique \{ background: var\(--surface\); color: var\(--text\); \}/, 'jamais un texte sur la couleur du palier');
});
