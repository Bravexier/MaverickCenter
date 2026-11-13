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

test('les 14 autres magies, dans l’ordre du classeur, sans le Potentiel Illimité ; chacune avec ses sorts du NPM 1 à son plafond (R188), rangés en tableau commun puis en spécialisations (R236)', () => {
  assert.ok(Number.isInteger(PLAFOND), 'le Potentiel Illimité a un plafond en base (R188)');
  const autres = magiesDuPotentiel(magies);
  assert.deepEqual(autres.map((a) => a.magie.nom), ORDRE_DU_CLASSEUR);
  assert.ok(!autres.some((a) => a.magie.id === POTENTIEL_ILLIMITE));
  for (const { magie, communs, specialisations, total } of autres) {
    // le nombre de sorts par NPM n'est plus « 5 × plafond » (R236) : il vient des sorts de la base, au plus haut NPM que le plafond laisse
    const attendus = magie.sorts.filter((s) => s.niveau <= PLAFOND);
    assert.equal(total, attendus.length, magie.nom);
    assert.ok(total > 0, magie.nom);
    // communs : sans spécialisation, un groupe par NPM ; spécialisations : celles de la magie, dans l'ordre, avec leurs sorts rattachés par la base
    assert.ok(communs.every((g) => g.sorts.every((s) => s.niveau === g.niveau && s.magieId === magie.id && s.specialisationId === null && s.niveau <= PLAFOND)), magie.nom);
    assert.deepEqual(specialisations.map((x) => x.specialisation.id), magie.specialisations.filter((sp) => attendus.some((s) => s.specialisationId === sp.id)).map((sp) => sp.id), magie.nom);
    for (const x of specialisations) {
      assert.ok(x.groupes.every((g) => g.sorts.every((s) => s.niveau === g.niveau && s.specialisationId === x.specialisation.id && s.niveau <= PLAFOND)), x.specialisation.id);
      assert.equal(x.total, attendus.filter((s) => s.specialisationId === x.specialisation.id).length, x.specialisation.id);
    }
    // mêmes sorts que ceux de sa page, sans les NPM au-dessus du plafond : aucun perdu, aucun doublé
    const montres = [...communs.flatMap((g) => g.sorts), ...specialisations.flatMap((x) => x.groupes.flatMap((g) => g.sorts))].map((s) => s.id);
    assert.deepEqual(montres.sort(), attendus.map((s) => s.id).sort(), magie.nom);
  }
  assert.equal(autres.reduce((n, a) => n + a.total, 0), [...magies.values()].flatMap((x) => x.sorts).filter((s) => s.niveau <= PLAFOND).length);
});

test('R236 (7) : à l’import, le Potentiel Illimité prend, dans la limite de son NPM, 10 sorts communs et ceux des deux spécialisations de chaque magie (4 par NPM 3 et 4 pour chacune)', () => {
  const dImport = chargerMagies(baseDImport()).magies;
  const plafond = npmMaxDuPotentiel(dImport);
  for (const { magie, communs, specialisations, total } of magiesDuPotentiel(dImport)) {
    assert.deepEqual(communs.map((g) => [g.niveau, g.sorts.length]), [[1, 5], [2, 5]], magie.nom);
    assert.equal(specialisations.length, 2, magie.nom);
    for (const x of specialisations) assert.deepEqual(x.groupes.map((g) => [g.niveau, g.sorts.length]), Array.from({ length: plafond - 2 }, (_, i) => [i + 3, 4]), x.specialisation.id);
    assert.equal(total, 10 + 2 * 4 * (plafond - 2), magie.nom);
  }
});

test('le nom court de chaque magie (préfixe des identifiants HTML de la page du Potentiel Illimité) est unique et sans espace', () => {
  const cles = magiesDuPotentiel(magies).map((a) => a.magie.cle);
  assert.equal(new Set(cles).size, cles.length);
  for (const cle of cles) assert.match(cle, /^[a-z]+(-[a-z]+)*$/);
  assert.equal(magies.get('magies/magie-du-feu').cle, 'feu');
});

test('cas limites : ordre du classeur (et non d’insertion), Potentiel Illimité écarté même avec des sorts, magie sans sort jusqu’au plafond écartée, spécialisation vidée par le plafond écartée', () => {
  const sort = (niveau, specialisationId = null) => ({ niveau, specialisationId });
  const sp = (id) => ({ id });
  const m = (id, ordre, sorts, plus = {}) => [id, { id, ordre, sorts, specialisations: [], ...plus }];
  const essai = (plafond) => new Map([
    m('magies/b', 3, [sort(5, 's2'), sort(1), sort(4, 's1'), sort(2), sort(3, 's1'), sort(3, 's2')], { specialisations: [sp('s1'), sp('s2')] }),
    m(POTENTIEL_ILLIMITE, 1, [sort(1)], { npmPlafondAvecDon: plafond }),
    m('magies/a', 2, [sort(3), sort(3)]),
    m('magies/seulement-5', 4, [sort(5, 'x'), sort(5, 'x')], { specialisations: [sp('x')] }),
  ]);
  // R188 : le plafond vient de la magie (npmPlafondAvecDon), pas du code
  assert.equal(npmMaxDuPotentiel(essai(4)), 4);
  const autres = magiesDuPotentiel(essai(4));
  assert.deepEqual(autres.map((a) => a.magie.id), ['magies/a', 'magies/b']);
  assert.deepEqual(autres[1].communs.map((g) => g.niveau), [1, 2]);
  assert.deepEqual(autres[1].specialisations.map((x) => [x.specialisation.id, x.groupes.map((g) => g.niveau)]), [['s1', [3, 4]], ['s2', [3]]]);
  assert.deepEqual(autres.map((a) => a.total), [2, 5]);
  // un autre plafond suit la donnée ; le paramètre l'emporte ; sans plafond en base, aucune borne
  assert.deepEqual(magiesDuPotentiel(essai(3)).map((a) => a.total), [2, 4]);
  assert.deepEqual(magiesDuPotentiel(essai(2)).map((a) => [a.magie.id, a.total, a.specialisations.length]), [['magies/b', 2, 0]]);
  assert.deepEqual(magiesDuPotentiel(essai(4), 3).map((a) => a.total), [2, 4]);
  assert.equal(npmMaxDuPotentiel(essai(null)), null);
  assert.deepEqual(magiesDuPotentiel(essai(null)).map((a) => a.total), [2, 6, 2]);
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
  assert.doesNotMatch(explication, /Classe unique = Archimage/, 'R238 (5) : la phrase est retirée de la magie (migration 0119)');
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
