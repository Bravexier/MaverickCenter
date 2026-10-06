// Intégrité de src/data/rules.json : ce test doit rester vert quand les vraies règles remplacent l'exemple.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { scanContent } from '../src/lib/wikilinks.mjs';

const rules = JSON.parse(readFileSync(new URL('../src/data/rules.json', import.meta.url), 'utf8'));
const pages = new Set(scanContent(fileURLToPath(new URL('../src/content/wiki', import.meta.url))).map((p) => p.id));
const ids = (list) => list.map((item) => item.id);
const choices = [['races', rules.races], ['classes', rules.classes], ['magies', rules.magies]];

test('les ids sont uniques dans chaque liste', () => {
  for (const [name, list] of [['attributes', rules.attributes], ...choices, ['derived', rules.derived ?? []]]) {
    assert.equal(new Set(ids(list)).size, list.length, `ids dupliqués dans ${name}`);
  }
});

test('les paramètres de création sont cohérents', () => {
  const { base, pool, max } = rules.creation;
  assert.ok(Number.isInteger(base) && Number.isInteger(pool) && Number.isInteger(max));
  assert.ok(pool >= 0 && max >= base);
  assert.ok(Number.isInteger(rules.limits.classes) && Number.isInteger(rules.limits.magies));
});

test('modificateurs et formules ne citent que des caractéristiques existantes', () => {
  const attrs = new Set(ids(rules.attributes));
  for (const [name, list] of choices) {
    for (const item of list) {
      for (const attr of Object.keys(item.modifiers ?? {})) assert.ok(attrs.has(attr), `${name}/${item.id} : ${attr}`);
    }
  }
  for (const d of rules.derived ?? []) {
    for (const attr of Object.keys(d.add ?? {})) assert.ok(attrs.has(attr), `derived/${d.id} : ${attr}`);
  }
});

test('les restrictions citent des races/classes existantes', () => {
  const races = new Set(ids(rules.races));
  const classes = new Set(ids(rules.classes));
  for (const cls of rules.classes) {
    for (const id of cls.allowedRaces ?? []) assert.ok(races.has(id), `classes/${cls.id} : race ${id}`);
  }
  for (const magic of rules.magies) {
    for (const id of magic.allowedClasses ?? []) assert.ok(classes.has(id), `magies/${magic.id} : classe ${id}`);
  }
});

test('chaque champ `wiki` pointe vers une page existante', () => {
  for (const [name, list] of choices) {
    for (const item of list.filter((i) => i.wiki)) {
      assert.ok(pages.has(item.wiki), `${name}/${item.id} → ${item.wiki} introuvable dans src/content/wiki`);
    }
  }
});
