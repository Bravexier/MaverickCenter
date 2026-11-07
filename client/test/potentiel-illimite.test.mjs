// Page du Potentiel Illimité : quelles magies et quels sorts ses onglets reprennent (lib/potentiel-illimite.mjs). Le Potentiel Illimité n'a pas de sorts
// à lui ; sa page montre, une magie par onglet, les tableaux des autres magies du NPM 1 au plus haut NPM qu'il peut choisir (demande du propriétaire) :
// son plafond relevé par un don, en données (décision R188, migration 0097 : magie_npm_plafond, capacite_npm_plafond ; ni lib/edition-modele.mjs ni le
// service ne les écrivent). Le rendu est contrôlé sur le site construit (test/magies-html.test.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { magiesDuPotentiel, npmMaxDuPotentiel, POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { baseDImport, texteDImport } from './aide-base-d-import.mjs';

const db = ouvrirBase({ sansExemples: false });
const magies = chargerMagies(db).magies;
/** R188 : le plafond de la page, lu dans la base (le plafond de la magie, relevé par le meilleur don), jamais écrit dans le code. */
const plafondEnBase = () => {
  const magie = db.prepare('SELECT npm FROM magie_npm_plafond WHERE magie_id = ?').get(POTENTIEL_ILLIMITE)?.npm;
  const dons = db.prepare('SELECT npm FROM capacite_npm_plafond').all().map((r) => r.npm);
  return magie === undefined ? null : Math.max(magie, ...dons);
};
const PLAFOND = npmMaxDuPotentiel(magies);
const ORDRE_DU_CLASSEUR = ['Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre'];

test('les 14 autres magies, dans l’ordre du classeur, sans le Potentiel Illimité ; chacune avec ses sorts du NPM 1 à son plafond (R188 ; 5 par NPM)', () => {
  assert.ok(Number.isInteger(PLAFOND), 'le Potentiel Illimité a un plafond en base (R188)');
  const autres = magiesDuPotentiel(magies);
  assert.deepEqual(autres.map((a) => a.magie.nom), ORDRE_DU_CLASSEUR);
  assert.ok(!autres.some((a) => a.magie.id === POTENTIEL_ILLIMITE));
  for (const { magie, groupes, total } of autres) {
    assert.deepEqual(groupes.map((g) => g.niveau), Array.from({ length: PLAFOND }, (_, i) => i + 1), magie.nom);
    assert.ok(groupes.every((g) => g.sorts.length === 5 && g.sorts.every((s) => s.niveau === g.niveau && s.magieId === magie.id)), magie.nom);
    assert.equal(total, 5 * PLAFOND, magie.nom);
    // mêmes sorts, dans le même ordre, que les tableaux de sa page (sans les NPM au-dessus du plafond)
    assert.deepEqual(groupes.flatMap((g) => g.sorts.map((s) => s.id)), magie.sorts.filter((s) => s.niveau <= PLAFOND).map((s) => s.id), magie.nom);
  }
  assert.equal(autres.reduce((n, a) => n + a.total, 0), 14 * 5 * PLAFOND);
});

test('le nom court de chaque magie (préfixe des identifiants HTML de la page du Potentiel Illimité) est unique et sans espace', () => {
  const cles = magiesDuPotentiel(magies).map((a) => a.magie.cle);
  assert.equal(new Set(cles).size, cles.length);
  for (const cle of cles) assert.match(cle, /^[a-z]+(-[a-z]+)*$/);
  assert.equal(magies.get('magies/magie-du-feu').cle, 'feu');
});

test('cas limites : ordre du classeur (et non d’insertion), Potentiel Illimité écarté même avec des sorts, magie sans sort jusqu’au plafond écartée', () => {
  const sort = (niveau) => ({ niveau });
  const m = (id, ordre, niveaux, plus = {}) => [id, { id, ordre, sorts: niveaux.map(sort), ...plus }];
  const essai = (plafond) => new Map([m('magies/b', 3, [5, 1, 4, 2]), m(POTENTIEL_ILLIMITE, 1, [1], { npmPlafondAvecDon: plafond }), m('magies/a', 2, [3, 3]),
    m('magies/seulement-5', 4, [5, 5])]);
  // R188 : le plafond vient de la magie (npmPlafondAvecDon), pas du code
  assert.equal(npmMaxDuPotentiel(essai(4)), 4);
  const autres = magiesDuPotentiel(essai(4));
  assert.deepEqual(autres.map((a) => a.magie.id), ['magies/a', 'magies/b']);
  assert.deepEqual(autres[1].groupes.map((g) => g.niveau), [1, 2, 4]);
  assert.deepEqual(autres.map((a) => a.total), [2, 3]);
  // un autre plafond suit la donnée ; le paramètre l'emporte ; sans plafond en base, aucune borne
  assert.deepEqual(magiesDuPotentiel(essai(3)).map((a) => a.total), [2, 2]);
  assert.deepEqual(magiesDuPotentiel(essai(4), 2).map((a) => [a.magie.id, a.total]), [['magies/b', 2]]);
  assert.equal(npmMaxDuPotentiel(essai(null)), null);
  assert.deepEqual(magiesDuPotentiel(essai(null)).map((a) => a.total), [2, 4, 2]);
});

test('R188 : le plafond de la page est celui de la base (magie_npm_plafond relevé par capacite_npm_plafond), sourcé par l’Explication et le don de niveau 20 de l’Archimage (textes de l’import)', () => {
  // Le plafond de la page est la donnée de R188 (lib/magies-db.mjs#chargerMagies, `npmPlafondAvecDon`), la même que celle de la fiche
  // (lib/fiche-moteur.mjs#npmDesSorts) et de la règle sort_puissance : jamais une constante du code.
  assert.equal(PLAFOND, plafondEnBase());
  assert.equal(magies.get(POTENTIEL_ILLIMITE).npmPlafond, db.prepare('SELECT npm FROM magie_npm_plafond WHERE magie_id = ?').get(POTENTIEL_ILLIMITE).npm);
  // L'explication et l'effet du don sont des textes, modifiables sur le site de dev (source de ce qu'il modifie) : lus dans l'état d'import
  // (test/aide-base-d-import.mjs, lib/historique-site.mjs), pour la source des valeurs de R188 (jamais relues de ces textes).
  const explication = texteDImport('magie', { id: POTENTIEL_ILLIMITE }, 'explication');
  assert.match(explication, /niveau 3 de puissance magique maximum/);
  assert.match(explication, /Classe unique = Archimage/);
  // le don « Semi-complet » de l'Archimage à l'import (le site de dev a pu le modifier ou le supprimer : D11)
  const historique = historiqueSite(db);
  const cle = { id: 'capacites/archimage-semi-complet' };
  assert.deepEqual(['classe_id', 'niveau', 'effet'].map((c) => historique.valeurDImport('capacite', cle, c)),
    ['classes/archimage', 20, 'Permet d\'utiliser les sorts de lvl 4 de puissance.']);
  // la donnée de la migration 0097 sur l'état d'import : 3 pour la magie, 4 avec le don (R188 : « Plafonner à 3, puis 4 avec "Semi Complet". »)
  const d = baseDImport();
  assert.deepEqual([d.prepare('SELECT npm FROM magie_npm_plafond WHERE magie_id = ?').get(POTENTIEL_ILLIMITE).npm,
    d.prepare('SELECT npm FROM capacite_npm_plafond WHERE capacite_id = ?').get(cle.id).npm], [3, 4]);
});
