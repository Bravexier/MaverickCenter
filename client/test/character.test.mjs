import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bonuses, changeAttribute, derivedStats, finalAttributes, newCharacter, parseExport,
  pointsLeft, sanitize, serialize, setRace, toggleChoice, validate,
} from '../src/lib/character.mjs';

// Règles de test (volontairement indépendantes de src/data/rules.json).
const rules = {
  meta: { status: 'test', version: 't1' },
  attributes: [{ id: 'str', label: 'Str' }, { id: 'int', label: 'Int' }],
  creation: { base: 1, pool: 4, max: 4 },
  limits: { classes: 2, magies: 1 },
  races: [
    { id: 'elf', name: 'Elfe', modifiers: { int: 1 } },
    { id: 'orc', name: 'Orc', modifiers: { str: 2 } },
  ],
  classes: [
    { id: 'mage', name: 'Mage', modifiers: { int: 1 }, allowedRaces: ['elf'] },
    { id: 'warrior', name: 'Guerrier', modifiers: { str: 1 } },
    { id: 'thief', name: 'Voleur' },
  ],
  magies: [
    { id: 'fire', name: 'Feu', allowedClasses: ['mage'] },
    { id: 'wild', name: 'Sauvage' },
  ],
  derived: [{ id: 'hp', label: 'PV', base: 10, add: { str: 2, int: 1 } }],
};

test('un nouveau personnage est vide avec toute la réserve de points', () => {
  const ch = newCharacter(rules);
  assert.deepEqual(ch.spent, { str: 0, int: 0 });
  assert.equal(pointsLeft(rules, ch), 4);
});

test('caractéristiques finales = base + points + bonus race et classes', () => {
  let ch = setRace(rules, newCharacter(rules), 'elf');
  ch = toggleChoice(rules, ch, 'classes', 'mage');
  ch = toggleChoice(rules, ch, 'classes', 'warrior');
  ch = changeAttribute(rules, ch, 'str', +2);
  assert.deepEqual(bonuses(rules, ch), { str: 1, int: 2 });
  assert.deepEqual(finalAttributes(rules, ch), { str: 1 + 2 + 1, int: 1 + 0 + 2 });
  assert.deepEqual(derivedStats(rules, ch), [{ id: 'hp', label: 'PV', value: 10 + 4 * 2 + 3 * 1 }]);
});

test('changeAttribute respecte le minimum, le maximum et la réserve', () => {
  let ch = newCharacter(rules);
  assert.equal(changeAttribute(rules, ch, 'str', -1), ch);
  ch = changeAttribute(rules, ch, 'str', +3); // 1 + 3 = 4 = max
  assert.equal(ch.spent.str, 3);
  assert.equal(changeAttribute(rules, ch, 'str', +1), ch, 'maximum atteint');
  ch = changeAttribute(rules, ch, 'int', +1);
  assert.equal(pointsLeft(rules, ch), 0);
  assert.equal(changeAttribute(rules, ch, 'int', +1), ch, 'réserve épuisée');
  assert.equal(changeAttribute(rules, ch, 'inconnue', +1), ch);
});

test('changer de race retire en cascade les classes et magies devenues interdites', () => {
  let ch = setRace(rules, newCharacter(rules), 'elf');
  ch = toggleChoice(rules, ch, 'classes', 'mage');
  ch = toggleChoice(rules, ch, 'magies', 'fire');
  assert.deepEqual([ch.classes, ch.magies], [['mage'], ['fire']]);
  ch = setRace(rules, ch, 'orc');
  assert.deepEqual([ch.classes, ch.magies], [[], []]);
});

test('toggleChoice : limite N bloque, limite 1 remplace, classe interdite ignorée', () => {
  let ch = setRace(rules, newCharacter(rules), 'orc');
  ch = toggleChoice(rules, ch, 'classes', 'mage'); // interdit pour un orc
  assert.deepEqual(ch.classes, []);
  ch = toggleChoice(rules, ch, 'classes', 'warrior');
  ch = toggleChoice(rules, ch, 'classes', 'thief');
  assert.deepEqual(ch.classes, ['warrior', 'thief']);
  const full = toggleChoice(rules, ch, 'classes', 'mage');
  assert.equal(full, ch, 'limite de 2 classes atteinte');
  ch = toggleChoice(rules, ch, 'classes', 'warrior');
  assert.deepEqual(ch.classes, ['thief']);

  ch = toggleChoice(rules, ch, 'magies', 'wild');
  ch = toggleChoice(rules, ch, 'magies', 'fire'); // interdit sans mage
  assert.deepEqual(ch.magies, ['wild']);
});

test('sanitize nettoie une entrée non fiable', () => {
  const ch = sanitize(rules, {
    name: 'x'.repeat(500),
    race: 'dragon',
    classes: ['mage', 'mage', 'nope'],
    magies: ['fire'],
    spent: { str: 99, int: -3, extra: 5 },
    notes: 42,
  });
  assert.equal(ch.name.length, 100);
  assert.equal(ch.race, '');
  assert.deepEqual(ch.classes, []);
  assert.deepEqual(ch.magies, []);
  assert.deepEqual(ch.spent, { str: 3, int: 0 });
  assert.equal(ch.notes, '');
  assert.deepEqual(sanitize(rules, null), newCharacter(rules));
});

test('validate signale les oublis (avertissements) et le dépassement (erreur)', () => {
  const empty = validate(rules, newCharacter(rules));
  assert.deepEqual(empty.errors, []);
  assert.equal(empty.warnings.length, 4);

  const over = { ...newCharacter(rules), spent: { str: 3, int: 3 } };
  assert.deepEqual(validate(rules, over).errors, ['2 point(s) dépensé(s) en trop.']);

  let ok = setRace(rules, { ...newCharacter(rules), name: 'Aela' }, 'elf');
  ok = toggleChoice(rules, ok, 'classes', 'mage');
  ok = changeAttribute(rules, ok, 'str', +3);
  ok = changeAttribute(rules, ok, 'int', +1);
  assert.deepEqual(validate(rules, ok), { errors: [], warnings: [] });
});

test('export puis import redonne la même fiche ; un fichier étranger est refusé', () => {
  let ch = setRace(rules, { ...newCharacter(rules), name: 'Aela', notes: 'Note' }, 'elf');
  ch = toggleChoice(rules, ch, 'classes', 'mage');
  assert.deepEqual(parseExport(rules, serialize(rules, ch)), ch);
  assert.throws(() => parseExport(rules, 'pas du json'), /JSON invalide/);
  assert.throws(() => parseExport(rules, '{"foo":1}'), /pas une fiche Maverick/);
});
