// L'armure portée de la fiche (décision R95 : « Les emplacement d'armure restent. L'armure peut casser à certains endroits seulement. (sauf si comme
// pour les armures spéciales, elle disposent de durabilité unifiée) . Chaque partie est à réparer individuellement pour remonter » ; « L'amélioration
// est pour l'armure complète ») : une armure complète et son amélioration (l'armure élémentaire de la décision R165 : test/fiche-armure-elementaire.test.mjs) ; la solidité du moment de chacune
// de ses six parties, ou de l'armure entière pour une armure à solidité unifiée. Le maximum d'une partie est la solidité de l'armure forgée de la page
// « Équipement » (lib/armure-forge.mjs#forgerArmure : sa solidité et les crans de son amélioration, R77), que le moteur de la fiche ne peut pas importer
// (le script de la page l'importe : deux scripts de page ne partagent jamais un module) : comparé ici sur TOUTES les armures × améliorations 0 à 5. Puis :
// parties, bornage, partie cassée, choix d'une autre armure ou amélioration, et l'aller-retour par le service.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { forgerArmure } from '../src/lib/armure-forge.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  ARMURE_ENTIERE, armureApresChoix, partiesApresReglage, partiesDeLArmure, partiesValables, soliditeMaxDeLArmure,
} from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const ameliorations = db.prepare("SELECT * FROM amelioration_equipement WHERE cible = 'armure' ORDER BY niveau").all().map((a) => ({ ...a }));
const PARTIES = db.prepare("SELECT id, nom FROM armure_emplacement WHERE id NOT IN ('armure-complete', 'bouclier') ORDER BY ordre").all().map((e) => ({ ...e }));
const grille = regles.armures.find((a) => Number(a.solidite_uni) !== 1 && a.solidite >= 2);
const uni = regles.armures.find((a) => Number(a.solidite_uni) === 1);
const amelioration = (n) => regles.ameliorations.find((a) => a.cible === 'armure' && a.niveau === n);
const fiche = (x = {}) => ({ ...ficheVide('Essai'), armure_id: grille.id, ...x });

test('le maximum d’une partie est la solidité de l’armure forgée de la page Équipement (forgerArmure), sur toutes les armures × améliorations 0 à 5', () => {
  assert.equal(regles.armures.length, db.prepare('SELECT count(*) AS n FROM armure').get().n);
  let n = 0;
  for (const a of regles.armures) {
    for (const niveau of [0, ...ameliorations.map((x) => x.niveau)]) {
      const forge = forgerArmure({ ap: a.ap, am: a.am, solidite: a.solidite, prix: null }, ameliorations, niveau);
      const f = { armure_id: a.id, armure_amelioration_id: niveau ? amelioration(niveau).id : null };
      assert.equal(soliditeMaxDeLArmure(regles, f), forge.solidite.total, `${a.nom} +${niveau}`);
      n += 1;
    }
  }
  assert.ok(n > 1000, `${n} combinaisons`);
  assert.equal(soliditeMaxDeLArmure(regles, { armure_id: null }), null, 'sans armure');
  // une amélioration d'une autre cible (une armure élémentaire) ne compte pas
  const autre = regles.ameliorations.find((a) => a.cible === 'armure_elementaire' && a.bonus_cran);
  if (autre) assert.equal(soliditeMaxDeLArmure(regles, { armure_id: grille.id, armure_amelioration_id: autre.id }), grille.solidite);
});

test('partiesDeLArmure (R95) : les six parties d’une armure de la grille, à leur maximum sans ligne ; l’armure entière seule pour une armure à solidité unifiée', () => {
  const a = partiesDeLArmure(regles, fiche());
  assert.equal(a.uni, false);
  assert.deepEqual(a.parties.map((p) => [p.emplacement_id, p.nom, p.actuelle, p.cassee]), PARTIES.map((e) => [e.id, e.nom, grille.solidite, false]));
  assert.deepEqual(a.detail, [{ nom: grille.nom, valeur: grille.solidite }]);
  const u = partiesDeLArmure(regles, fiche({ armure_id: uni.id }));
  assert.equal(u.uni, true);
  assert.deepEqual(u.parties.map((p) => [p.emplacement_id, p.nom, p.actuelle]), [[ARMURE_ENTIERE, 'Armure entière', uni.solidite]]);
  assert.equal(partiesDeLArmure(regles, fiche({ armure_id: null })), null);
  // une partie abîmée, une cassée ; une valeur au-delà du maximum est ramenée au maximum, une négative à 0
  const abimee = partiesDeLArmure(regles, fiche({ armure_parties: [{ emplacement_id: 'torse', solidite: 1 }, { emplacement_id: 'casque', solidite: 0 }, { emplacement_id: 'bras-gauche', solidite: 99 }] }));
  const par = Object.fromEntries(abimee.parties.map((p) => [p.emplacement_id, [p.actuelle, p.cassee]]));
  assert.deepEqual([par.torse, par.casque, par['bras-gauche'], par['jambe-droit']], [[1, false], [0, true], [grille.solidite, false], [grille.solidite, false]]);
  // l'amélioration +4 : un cran de plus sur chaque partie (R77)
  const plus4 = partiesDeLArmure(regles, fiche({ armure_amelioration_id: amelioration(4).id }));
  assert.equal(plus4.max, grille.solidite + 1);
  assert.deepEqual(plus4.detail, [{ nom: grille.nom, valeur: grille.solidite }, { nom: 'Amélioration niveau 4', valeur: 1 }]);
});

test('partiesValables, partiesApresReglage : une ligne par partie abîmée (0 à moins que le maximum), rien d’autre ; rien sans armure', () => {
  const f = fiche();
  assert.deepEqual(partiesApresReglage(regles, f, 'torse', 1), [{ emplacement_id: 'torse', solidite: 1 }]);
  assert.deepEqual(partiesApresReglage(regles, f, 'torse', grille.solidite), [], 'au maximum : pas de ligne');
  assert.deepEqual(partiesApresReglage(regles, f, 'torse', '1.6'), [{ emplacement_id: 'torse', solidite: 2 }].map((x) => (grille.solidite > 2 ? x : null)).filter(Boolean), 'arrondi');
  assert.deepEqual(partiesApresReglage(regles, f, 'casque', -3), [{ emplacement_id: 'casque', solidite: 0 }], 'cassée');
  const deux = partiesApresReglage(regles, { ...f, armure_parties: [{ emplacement_id: 'casque', solidite: 0 }] }, 'jambe-gauche', 1);
  assert.deepEqual(deux, [{ emplacement_id: 'casque', solidite: 0 }, { emplacement_id: 'jambe-gauche', solidite: 1 }], 'dans l’ordre des emplacements');
  // une partie que l'armure n'a pas : l'armure entière pour une armure de la grille, une partie pour une armure à solidité unifiée
  assert.deepEqual(partiesValables(regles, { ...f, armure_parties: [{ emplacement_id: ARMURE_ENTIERE, solidite: 0 }, { emplacement_id: 'bouclier', solidite: 0 }] }), []);
  assert.deepEqual(partiesValables(regles, fiche({ armure_id: uni.id, armure_parties: [{ emplacement_id: 'torse', solidite: 0 }, { emplacement_id: ARMURE_ENTIERE, solidite: 0 }] })),
    [{ emplacement_id: ARMURE_ENTIERE, solidite: 0 }]);
  assert.deepEqual(partiesValables(regles, fiche({ armure_id: null, armure_parties: [{ emplacement_id: 'torse', solidite: 0 }] })), []);
  for (const v of [null, '', 'abc', undefined]) assert.deepEqual(partiesApresReglage(regles, f, 'torse', v), [], String(v));
});

test('armureApresChoix : une autre armure est neuve ; sans armure, aucune amélioration ; une autre amélioration borne les parties abîmées', () => {
  const abimee = fiche({ armure_amelioration_id: amelioration(4).id, armure_parties: [{ emplacement_id: 'torse', solidite: grille.solidite }, { emplacement_id: 'casque', solidite: 0 }] });
  // sans l'amélioration +4, le maximum perd un cran : le torse (à l'ancien maximum moins un) est désormais à son maximum, sans ligne ; le casque reste cassé
  assert.deepEqual(armureApresChoix(regles, abimee, 'armure_amelioration_id', null).armure_parties, [{ emplacement_id: 'casque', solidite: 0 }]);
  const autre = regles.armures.find((a) => a.id !== grille.id && Number(a.solidite_uni) !== 1);
  const changee = armureApresChoix(regles, abimee, 'armure_id', autre.id);
  assert.deepEqual([changee.armure_id, changee.armure_amelioration_id, changee.armure_parties], [autre.id, amelioration(4).id, []], 'l’amélioration reste, les parties sont neuves');
  const retiree = armureApresChoix(regles, { ...abimee, armure_elementaire_id: regles.armures_elementaires[0].id }, 'armure', '');
  assert.deepEqual(retiree, { armure_id: null, armure_amelioration_id: null, armure_elementaire_id: null, armure_amelioration_elementaire_id: null, armure_parties: [] });
  // la même armure choisie de nouveau : rien ne change
  assert.deepEqual(armureApresChoix(regles, abimee, 'armure_id', grille.id).armure_parties, partiesValables(regles, abimee));
});

test('R95 (« Suppression de la création par pièces ») : la page « Armures » n’a plus les paragraphes sur la création par pièces, le reste de ses règles reste (lu dans la base, sans build)', () => {
  const corps = db.prepare("SELECT corps_md FROM page WHERE id = 'ressources/armures'").get().corps_md;
  for (const retire of ['Comme vous le savez il est possible de fabriquer', 'Pour fabriquer des morceaux', 'il faut 2 matériaux pour chaque morceau', 'un torse de cuir complet']) {
    assert.ok(!corps.includes(retire), retire);
  }
  for (const garde of ['Une armure a besoin de 2 matériaux pour être fabriquée', 'Cran de solidité uni', 'perdre un seul morceau de l\'armure']) assert.ok(corps.includes(garde), garde);
});

const racine = dossierTemporaire('armure');

test('aller-retour par le service : l’armure, son amélioration et la solidité de ses parties s’enregistrent et se relisent telles quelles', () => {
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') }).chemin);
  try {
    // une armure de base et son amélioration (décision R165 : une fiche porte UNE armure ; l'armure élémentaire : test/fiche-armure-elementaire.test.mjs)
    // une classe qui la porte (sans classe, un vêtement seulement : R165 (6), l'armure partirait, trop lourde)
    const envoi = fiche({ armure_amelioration_id: amelioration(2).id, armure_parties: partiesApresReglage(regles, fiche(), 'torse', 0),
      classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }] });
    const p = enregistrerFiche(vivante, envoi).personnage;
    const lue = lireFiche(vivante, p.id);
    assert.deepEqual([lue.armure_id, lue.armure_amelioration_id, lue.armure_elementaire_id, lue.armure_amelioration_elementaire_id],
      [grille.id, amelioration(2).id, null, null]);
    assert.deepEqual(lue.armure_parties, [{ emplacement_id: 'torse', solidite: 0 }]);
    assert.deepEqual(partiesValables(regles, lue), lue.armure_parties, 'relue, elle est déjà valable');
    // une partie hors de la table : refusée par la base (pas le bouclier)
    assert.throws(() => enregistrerFiche(vivante, { version: lue.version, armure_parties: [{ emplacement_id: 'bouclier', solidite: 0 }] }, { id: p.id }), /CHECK|n’a pas été enregistrée/);
  } finally {
    vivante.close();
  }
});
