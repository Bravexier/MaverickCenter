// Le rejeu des lignes en attente au démarrage de l'éditeur (lib/edition-rejeu.mjs, importé par scripts/edition/editeur.mjs) : en un passage. Avant, chaque ligne relisait
// `actif` de chaque extension (un querySelector chacune) et les cadres : 4 403 lignes d'ancrage = 28 à 42 s sur le Glossaire. Extensions et éditeur d'essai.
//   node --test test/edition-rejeu.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { rejouerLesLignes } from '../src/lib/edition-rejeu.mjs';

/** Un faux éditeur : des « éléments » { id, table, cle } dans un tableau que les extensions peuvent changer. */
function essai({ enEdition = false, extensions = [] } = {}) {
  const elements = [{ id: 'e1', table: 't', cle: 1 }];
  const compte = { actif: new Map(), elementsDe: 0, cadres: 0 };
  const ecrits = [];
  const exts = extensions.map((x, i) => ({
    ...x,
    actif: (doc) => {
      compte.actif.set(i, (compte.actif.get(i) ?? 0) + 1);
      return x.actifSi ? x.actifSi(doc) : true;
    },
  }));
  const ed = { enEdition };
  const sorties = {
    extensions: exts,
    document: { nom: 'doc' },
    elementsDe: (table, cle) => { compte.elementsDe += 1; return elements.filter((el) => el.table === table && el.cle === cle); },
    estEdite: () => false,
    rendre: (el, ligne) => ecrits.push([el.id, ligne.v]),
    cadres: () => { compte.cadres += 1; },
  };
  return { ed, elements, compte, ecrits, sorties };
}
const lignes = (n) => Array.from({ length: n }, (_, i) => ({ table: 't', cle: 1, ligne: { v: i } }));

test('le rejeu de N lignes appelle actif une fois par extension et cadres une fois', () => {
  const appels = [];
  const { ed, compte, sorties } = essai({ extensions: [{ ligne: (_ed, table, cle, ligne) => appels.push(ligne?.v) }, {}, { actifSi: () => false, ligne: () => assert.fail('inactive') }] });
  rejouerLesLignes(lignes(500), ed, sorties);
  assert.deepEqual([...compte.actif.entries()], [[0, 1], [1, 1], [2, 1]], 'actif : une fois par extension, pas une fois par ligne');
  assert.equal(compte.cadres, 1, 'les cadres : une fois, à la fin');
  assert.equal(compte.elementsDe, 500, 'les éléments restent lus ligne par ligne');
  assert.equal(appels.length, 500);
});

test('en mode modification, les cadres ne sont pas relus ; une ligne supprimée (null) va aux extensions sans réécrire de champ', () => {
  const vues = [];
  const { ed, compte, ecrits, sorties } = essai({ enEdition: true, extensions: [{ ligne: (_ed, table, cle, ligne) => vues.push(ligne) }] });
  rejouerLesLignes([{ table: 't', cle: 1, ligne: null }, { table: 't', cle: 1, ligne: { v: 1 } }], ed, sorties);
  assert.equal(compte.cadres, 0);
  assert.deepEqual(vues, [null, { v: 1 }]);
  assert.deepEqual(ecrits, [['e1', 1]]);
});

test('une extension qui crée un champ pendant le rejeu le voit réécrit par la ligne suivante (aucun index des champs)', () => {
  let cree = false;
  const essaiDeCreation = essai({
    extensions: [{
      ligne: (_ed, table, cle, ligne) => {
        if (ligne.v === 0 && !cree) { cree = true; essaiDeCreation.elements.push({ id: 'neuf', table: 't', cle: 1 }); }
      },
    }],
  });
  rejouerLesLignes(lignes(3), essaiDeCreation.ed, essaiDeCreation.sorties);
  assert.deepEqual(essaiDeCreation.ecrits.filter(([id]) => id === 'neuf'), [['neuf', 1], ['neuf', 2]], 'créé à la ligne 0 : réécrit par les lignes 1 et 2');
  assert.equal(essaiDeCreation.ecrits.filter(([id]) => id === 'e1').length, 3);
});

test('un élément en cours de modification n’est pas réécrit', () => {
  const { ed, ecrits, sorties } = essai();
  rejouerLesLignes(lignes(2), ed, { ...sorties, estEdite: () => true });
  assert.deepEqual(ecrits, []);
});

test('l’éditeur rejoue ses lignes en attente par ce module, et lui seul (appliquerLigne reste pour un enregistrement)', () => {
  const editeur = readFileSync(fileURLToPath(new URL('../src/scripts/edition/editeur.mjs', import.meta.url)), 'utf8');
  assert.match(editeur, /rejouerLesLignes\(enAttente\.lignes, ed, \{/);
  assert.doesNotMatch(editeur, /for \(const l of enAttente\.lignes\) appliquerLigne/);
  assert.match(editeur, /for \(const l of r\.lignes\) appliquerLigne\(l\.table, l\.cle, l\.ligne\)/, 'après un enregistrement : comportement d’avant');
});

test('une liste vide n’appelle pas cadres (l’ancien rejeu n’y touchait pas)', () => {
  const { ed, compte, sorties } = essai({ extensions: [{}] });
  rejouerLesLignes([], ed, sorties);
  assert.equal(compte.cadres, 0);
  assert.equal(compte.elementsDe, 0);
});
