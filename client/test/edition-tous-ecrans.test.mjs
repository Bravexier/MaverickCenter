// Demande du propriétaire (2026-10-15) : le mode modification et les boutons « Simulation de mise à jour » / « Effectuer la mise à jour » sont sur
// tous les écrans du site de dev, téléphone et tablette compris (un outil pour ceux qui bidouillent déjà). Le seul verrou est le service
// (`edition: true` de /api/etat/, MAVERICK_EDITION=1) : aucun des deux scripts ne regarde la taille de l'écran ni le pointeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SCRIPTS = ['../src/scripts/edition.mjs', '../src/scripts/mise-a-jour.mjs'];

for (const chemin of SCRIPTS) {
  test(`${chemin.split('/').pop()} : pas de verrou selon l'écran`, () => {
    const code = readFileSync(new URL(chemin, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /matchMedia|pointer:\s*fine|hover:\s*hover/);
  });
}

test('mise-a-jour.mjs : les boutons de simulation et de mise à jour sont toujours rendus', () => {
  const code = readFileSync(new URL('../src/scripts/mise-a-jour.mjs', import.meta.url), 'utf8');
  assert.match(code, /data-nv-simuler/);
  assert.match(code, /data-nv-lancer/);
  assert.doesNotMatch(code, /version ordinateur/);
});
