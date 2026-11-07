// Le diff d'un conflit réduit à ce qui change (lib/diff-replie.mjs ; demande du propriétaire du 2026-11-07 sur la page « Mise à jour » : seulement la
// différence entre les deux versions, les passages identiques repliés). Textes construits ici : aucun contenu de la base n'est figé.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTEXTE, replierLeDiff, texteDuDiff } from '../src/lib/diff-replie.mjs';
import { diffMots } from '../src/lib/notes-de-version-rendu.mjs';

const lignes = (n, f = (i) => `Ligne ${i} pareille des deux côtés, avec quelques mots de plus.`) => Array.from({ length: n }, (_, i) => f(i));
const visibles = (morceaux) => morceaux.filter((m) => m.type !== 'replie').map((m) => m.texte).join('');

test('rien n’est perdu : les morceaux repliés redonnent le diff entier', () => {
  const cas = [
    [lignes(30).join('\n'), lignes(30, (i) => (i === 12 ? 'Ligne douze réécrite.' : `Ligne ${i} pareille des deux côtés, avec quelques mots de plus.`)).join('\n')],
    [lignes(30).join('\n'), [...lignes(30), 'Une ligne ajoutée à la fin.'].join('\n')],
    [['Une ligne ôtée au début.', ...lignes(30)].join('\n'), lignes(30).join('\n')],
    [lignes(50).join(' '), lignes(50, (i) => (i === 25 ? 'Phrase changée au milieu d’une seule longue ligne.' : `Ligne ${i} pareille des deux côtés, avec quelques mots de plus.`)).join(' ')],
    ['court', 'court aussi'],
    ['\n\nA\n\n', '\nA\n\nB'],
  ];
  for (const [a, b] of cas) {
    const d = diffMots(a, b);
    const m = replierLeDiff(d);
    // le pliage ne retire rien au diff (diffMots peut garder un saut de ligne final d'un seul côté : comparé au diff lui-même)
    assert.equal(texteDuDiff(m, 'retire'), texteDuDiff(d, 'retire'));
    assert.equal(texteDuDiff(m, 'ajoute'), texteDuDiff(d, 'ajoute'));
  }
});

test('un changement au milieu d’un long texte : le reste est replié, le contexte gardé de chaque côté', () => {
  const avant = lignes(40);
  const apres = avant.map((l, i) => (i === 20 ? `${l} Ajout.` : l));
  const m = replierLeDiff(diffMots(avant.join('\n'), apres.join('\n')));
  assert.deepEqual(m.map((x) => x.type), ['replie', 'egal', 'ajoute', 'egal', 'replie']);
  const vu = visibles(m);
  // la ligne changée et une ligne de contexte de chaque côté (CONTEXTE.lignes), pas plus
  for (const i of [19, 20, 21]) assert.ok(vu.includes(avant[i]), `ligne ${i}`);
  for (const i of [0, 10, 18, 22, 39]) assert.ok(!vu.includes(avant[i]), `ligne ${i} repliée`);
  assert.equal(CONTEXTE.lignes, 1);
  // le nombre de lignes de chaque passage replié : les 19 premières (0 à 18), puis les 18 dernières (22 à 39)
  assert.deepEqual(m.filter((x) => x.type === 'replie').map((r) => r.lignes), [19, 18]);
});

test('une seule longue ligne : le contexte est coupé en caractères, à un blanc', () => {
  const mots = Array.from({ length: 400 }, (_, i) => `mot${i}`);
  const a = mots.join(' ');
  const b = mots.map((x, i) => (i === 200 ? 'CHANGÉ' : x)).join(' ');
  const m = replierLeDiff(diffMots(a, b));
  assert.equal(m.filter((x) => x.type === 'replie').length, 2);
  for (const e of m.filter((x) => x.type === 'egal')) {
    assert.ok(e.texte.length <= CONTEXTE.caracteres + 1, e.texte);
    assert.match(e.texte, /^(?:\S|\s)/);
  }
  // aucun mot coupé entre le contexte et le passage replié
  for (let k = 1; k < m.length; k++) {
    if (m[k].type === 'replie' || m[k - 1].type === 'replie') assert.ok(/\s$/.test(m[k - 1].texte) || /^\s/.test(m[k].texte), `coupure ${k}`);
  }
});

test('un texte court, ou deux changements proches : rien n’est replié', () => {
  assert.ok(!replierLeDiff(diffMots('Dure 3 tours.', 'Dure 4 tours.')).some((x) => x.type === 'replie'));
  const avant = lignes(6);
  const apres = avant.map((l, i) => (i === 1 || i === 3 ? `${l} !` : l));
  assert.ok(!replierLeDiff(diffMots(avant.join('\n'), apres.join('\n'))).slice(1, -1).some((x) => x.type === 'replie'), 'entre deux changements proches');
});

test('sans changement, rien n’est replié ; sans diff (textes trop longs), null', () => {
  assert.deepEqual(replierLeDiff([{ type: 'egal', texte: 'abc' }]), [{ type: 'egal', texte: 'abc' }]);
  assert.equal(replierLeDiff(null), null);
});
