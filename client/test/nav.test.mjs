import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { NAV, activeGroup, groupIsCurrent, navPaths } from '../src/lib/nav.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';

const content = new URL('../src/content/wiki/', import.meta.url);

test('le menu a les rubriques voulues, dans l’ordre', () => {
  assert.deepEqual(NAV.map((g) => g.label).slice(0, 4), ['Règles', 'Objets et artisanat', 'Codex', 'Statistiques']);
  assert.deepEqual(NAV[0].items.map((i) => i.label), ['Guide', 'Fiche de personnage', 'Races', 'Magies', 'Classes', 'Métiers']);
});

test('chaque lien du menu pointe vers une page qui existe', () => {
  for (const path of navPaths()) {
    const m = path.match(/^wiki\/([^/]+)\/(?:([^/]+)\/)?$/);
    if (m && m[2]) assert.ok(existsSync(new URL(`${m[1]}/${m[2]}.md`, content)), `page absente : ${path}`);
    else if (m) assert.ok(TYPE_KEYS.includes(m[1]), `type inconnu : ${path}`);
    else assert.ok(['wiki/', 'generateur/', 'tags/', 'donnees/'].includes(path), `chemin inconnu : ${path}`);
  }
});

test('la rubrique courante est repérée, avec ou sans préfixe de déploiement', () => {
  const [regles, objets] = NAV;
  assert.equal(groupIsCurrent(regles, '/wiki/races/elfe/'), true);
  assert.equal(groupIsCurrent(regles, '/MaverickCenter/generateur/', '/MaverickCenter/'), true);
  assert.equal(groupIsCurrent(objets, '/wiki/ressources/armures/'), true);
  assert.equal(groupIsCurrent(objets, '/wiki/races/'), false);
});

test('la 2e ligne suit la rubrique de la page, ou la première par défaut', () => {
  assert.equal(activeGroup('/wiki/ressources/alchimie/').key, 'objets');
  assert.equal(activeGroup('/').key, 'regles');
  assert.equal(activeGroup('/recherche/').key, 'regles');
});
