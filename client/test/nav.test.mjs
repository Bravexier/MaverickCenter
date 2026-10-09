import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { NAV, activeGroup, groupIsCurrent, legacyWikiRedirect, navPaths } from '../src/lib/nav.mjs';
import { TYPE_KEYS } from '../src/lib/types.mjs';

const content = new URL('../src/content/wiki/', import.meta.url);

test('le menu a les rubriques voulues, dans l’ordre', () => {
  assert.deepEqual(NAV.map((g) => g.label).slice(0, 4), ['Règles', 'Objets et artisanat', 'Codex', 'Statistiques']);
  assert.deepEqual(NAV[0].items.map((i) => i.label), ['Guide', 'Fiche de personnage', 'Races', 'Magies', 'Classes', 'Métiers']);
});

test('chaque lien du menu pointe vers une page qui existe', () => {
  for (const path of navPaths()) {
    const m = path.match(/^([^/]+)\/(?:([^/]+)\/)?$/);
    if (m && TYPE_KEYS.includes(m[1])) {
      if (m[2]) assert.ok(existsSync(new URL(`${m[1]}/${m[2]}.md`, content)), `page absente : ${path}`);
    } else assert.ok(['pages/', 'generateur/', 'tags/', 'donnees/'].includes(path), `chemin inconnu : ${path}`);
  }
});

test('la rubrique courante est repérée, avec ou sans préfixe de déploiement', () => {
  const [regles, objets] = NAV;
  assert.equal(groupIsCurrent(regles, '/races/elfe/'), true);
  assert.equal(groupIsCurrent(regles, '/MaverickCenter/generateur/', '/MaverickCenter/'), true);
  assert.equal(groupIsCurrent(objets, '/ressources/armures/'), true);
  assert.equal(groupIsCurrent(objets, '/races/'), false);
  assert.equal(groupIsCurrent(NAV.find((g) => g.key === 'outils'), '/pages/'), true, 'index du wiki');
});

test('la 2e ligne suit la rubrique de la page, ou la première par défaut', () => {
  assert.equal(activeGroup('/ressources/alchimie/').key, 'objets');
  assert.equal(activeGroup('/').key, 'regles');
  assert.equal(activeGroup('/recherche/').key, 'regles');
});

test('les pages ne sont plus sous /wiki/ : une ancienne adresse mène à la nouvelle (page 404)', () => {
  assert.equal(legacyWikiRedirect('/wiki/races/nain/'), '/races/nain/');
  assert.equal(legacyWikiRedirect('/wiki/magies/'), '/magies/');
  assert.equal(legacyWikiRedirect('/wiki/'), '/pages/', 'l’index du wiki');
  assert.equal(legacyWikiRedirect('/wiki'), '/pages/');
  assert.equal(legacyWikiRedirect('/MaverickCenter/wiki/races/nain/', '/MaverickCenter/'), '/MaverickCenter/races/nain/');
  assert.equal(legacyWikiRedirect('/MaverickCenter/wiki/', '/MaverickCenter'), '/MaverickCenter/pages/');
  assert.equal(legacyWikiRedirect('/races/inconnue/'), null, 'une vraie page absente reste introuvable');
  assert.equal(legacyWikiRedirect('/wikipedia/'), null);
  assert.equal(legacyWikiRedirect('/autre/wiki/races/', '/MaverickCenter/'), null, 'hors du préfixe de déploiement');
});
