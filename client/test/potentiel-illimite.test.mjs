// Page du Potentiel Illimité : quelles magies et quels sorts ses onglets reprennent (lib/potentiel-illimite.mjs). Le Potentiel Illimité n'a pas de sorts
// à lui ; sa page montre, une magie par onglet, les tableaux des autres magies du NPM 1 au NPM 4 (demande du propriétaire). Le rendu est contrôlé sur le
// site construit (test/magies-html.test.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { magiesDuPotentiel, NPM_MAX_DU_POTENTIEL, POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';

const db = ouvrirBase({ sansExemples: false });
const magies = chargerMagies(db).magies;
const ORDRE_DU_CLASSEUR = ['Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre'];

test('les 14 autres magies, dans l’ordre du classeur, sans le Potentiel Illimité ; chacune avec ses sorts du NPM 1 au NPM 4 (5 par NPM)', () => {
  assert.equal(NPM_MAX_DU_POTENTIEL, 4);
  const autres = magiesDuPotentiel(magies);
  assert.deepEqual(autres.map((a) => a.magie.nom), ORDRE_DU_CLASSEUR);
  assert.ok(!autres.some((a) => a.magie.id === POTENTIEL_ILLIMITE));
  for (const { magie, groupes, total } of autres) {
    assert.deepEqual(groupes.map((g) => g.niveau), [1, 2, 3, 4], magie.nom);
    assert.ok(groupes.every((g) => g.sorts.length === 5 && g.sorts.every((s) => s.niveau === g.niveau && s.magieId === magie.id)), magie.nom);
    assert.equal(total, 20, magie.nom);
    // mêmes sorts, dans le même ordre, que les tableaux de sa page (sans le NPM 5)
    assert.deepEqual(groupes.flatMap((g) => g.sorts.map((s) => s.id)), magie.sorts.filter((s) => s.niveau <= 4).map((s) => s.id), magie.nom);
  }
  assert.equal(autres.reduce((n, a) => n + a.total, 0), 280);
});

test('le nom court de chaque magie (préfixe des identifiants HTML de la page du Potentiel Illimité) est unique et sans espace', () => {
  const cles = magiesDuPotentiel(magies).map((a) => a.magie.cle);
  assert.equal(new Set(cles).size, cles.length);
  for (const cle of cles) assert.match(cle, /^[a-z]+(-[a-z]+)*$/);
  assert.equal(magies.get('magies/magie-du-feu').cle, 'feu');
});

test('cas limites : ordre du classeur (et non d’insertion), Potentiel Illimité écarté même avec des sorts, magie sans sort jusqu’au NPM 4 écartée', () => {
  const sort = (niveau) => ({ niveau });
  const m = (id, ordre, niveaux) => [id, { id, ordre, sorts: niveaux.map(sort) }];
  const autres = magiesDuPotentiel(
    new Map([m('magies/b', 3, [5, 1, 4, 2]), m(POTENTIEL_ILLIMITE, 1, [1]), m('magies/a', 2, [3, 3]), m('magies/seulement-5', 4, [5, 5])]),
  );
  assert.deepEqual(autres.map((a) => a.magie.id), ['magies/a', 'magies/b']);
  assert.deepEqual(autres[1].groupes.map((g) => g.niveau), [1, 2, 4]);
  assert.deepEqual(autres.map((a) => a.total), [2, 3]);
});

test('NPM 4 : borne de l’Explication du Potentiel Illimité (NPM 3), relevée par le don de niveau 20 de l’Archimage, sa classe unique', () => {
  const explication = db.prepare(`SELECT explication FROM magie WHERE id = ?`).get(POTENTIEL_ILLIMITE).explication;
  assert.match(explication, /niveau 3 de puissance magique maximum/);
  assert.match(explication, /Classe unique = Archimage/);
  const don = db.prepare(`SELECT classe_id, niveau, effet FROM capacite WHERE id = 'capacites/archimage-semi-complet'`).get();
  assert.deepEqual({ ...don }, { classe_id: 'classes/archimage', niveau: 20, effet: 'Permet d\'utiliser les sorts de lvl 4 de puissance.' });
  assert.equal(NPM_MAX_DU_POTENTIEL, 4);
});
