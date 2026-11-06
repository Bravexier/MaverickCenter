// Demande du propriétaire (2026-10-15) : le mode modification et les boutons « Simulation de mise à jour » / « Effectuer la mise à jour » sont sur
// tous les écrans du site de dev, téléphone et tablette compris (un outil pour ceux qui bidouillent déjà). Le seul verrou est le service
// (`edition: true` de /api/etat/, MAVERICK_EDITION=1) : aucun des deux scripts ne regarde la taille de l'écran ni le pointeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SCRIPTS = ['../src/scripts/edition.mjs', '../src/scripts/mise-a-jour.mjs', '../src/scripts/edition/menus.mjs', '../src/scripts/edition/glisser.mjs'];

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

// Le glisser-déposer des menus latéraux (lot de l'édition des menus : « changer l'ordre des menu latéraux (par un glisser déposer) ») : au doigt comme à
// la souris et au clavier. Pointer Events, jamais le glisser HTML5 (draggable, dragstart : pas au doigt) ; `touch-action: none` sur la poignée seule ;
// ↑ ↓ Début Fin et une annonce aria-live ; Échap annule.
test('glisser.mjs : Pointer Events (pas de glisser HTML5), clavier ↑ ↓ Début Fin, Échap, annonce ; touch-action: none sur la poignée seule', () => {
  const glisser = readFileSync(new URL('../src/scripts/edition/glisser.mjs', import.meta.url), 'utf8');
  for (const evenement of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown']) assert.match(glisser, new RegExp(`'${evenement}'`), evenement);
  assert.match(glisser, /setPointerCapture/);
  assert.match(glisser, /e\.key === 'Escape'/);
  assert.match(glisser, /placeAuClavier/, 'les touches : lib/ordre-des-menus.mjs#placeAuClavier (↑ ↓ Début Fin)');
  assert.match(glisser, /requestAnimationFrame\(defiler\)/, 'le défilement automatique');
  // essai dans Chromium (souris, Pixel 5 au doigt) : l'élément glissé déplacé dans le DOM perdait la capture, le geste s'arrêtait après une place. Ses
  // voisins bougent (lib/ordre-des-menus.mjs#voisinsADeplacer), le geste est suivi sur le document, et la perte de capture ne le finit jamais
  assert.match(glisser, /voisinsADeplacer\(place, cible\)/);
  assert.doesNotMatch(glisser, /insertBefore\(el,/, 'l’élément glissé ne quitte jamais le DOM pendant le geste');
  for (const evenement of ['pointermove', 'pointerup', 'pointercancel']) assert.match(glisser, new RegExp(`document\\.addEventListener\\('${evenement}'`), evenement);
  assert.doesNotMatch(glisser, /addEventListener\('lostpointercapture'/);
  const menus = readFileSync(new URL('../src/scripts/edition/menus.mjs', import.meta.url), 'utf8');
  assert.match(menus, /setAttribute\('aria-live', 'polite'\)/);
  for (const code of [glisser, menus]) assert.doesNotMatch(code, /draggable|dragstart|dragover|ondrop|'drop'/);
  const css = readFileSync(new URL('../src/styles/edition/edition.css', import.meta.url), 'utf8');
  const regles = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => /touch-action:\s*none/.test(m[2])).map((m) => m[1].trim());
  assert.deepEqual(regles, ['.ed-poignee'], 'touch-action: none sur la poignée seule : ailleurs, la page défile au doigt');
});
