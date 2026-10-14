// Page /ressources/composants/ construite (dist/) : rendue depuis les tables (lib/composants-db.mjs), un tableau repliable par liste dans l'ordre voulu
// (monnaie, matériaux, gemmes, bois, fruits, ingrédients par catégorie, tableaux de l'onglet « Équipement inventaire »), une ligne par composant, les champs
// du mode modification (data-ed), l'entité de chaque ligne (création, suppression) et l'entrée du menu Ressources. Se saute sans dist/ (npm run build) ;
// la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerComposants } from '../src/lib/composants-db.mjs';
import { ancreDeComposant } from '../src/lib/composants-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd, lireAttributEd } from '../src/lib/edition-modele.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'composants', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const c = present ? chargerComposants(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

test('les tableaux, dans l’ordre : monnaie, matériaux, gemmes, bois, fruits, ingrédients, équipement', options, () => {
  const ids = [...main.matchAll(/<details class="comp-tableau" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['monnaie', 'materiaux', 'gemmes', 'bois', 'fruits', 'ingredients-solvant', 'ingredients-essence', 'ingredients-amplificateur',
    'ingredients-catalyseur', 'ingredients-stabilisateur', 'objets-vegetaux', 'objets-animaux', 'objets-autres', 'objets-matos-aventures',
    'objets-matos-fabrication', 'objets-matos-projectile']);
  assert.ok(html.includes('data-edition'), 'la page se modifie sur le site de dev');
  assert.match(html, /href="[^"]*ressources\/composants\/"[^>]*>Composants</, 'l’entrée du menu Ressources');
});

test('une ligne par composant, avec son entité ; aucun consommable (potion, livre)', options, () => {
  const lignes = [...main.matchAll(/<tr class="composant" id="([^"]+)"/g)].map((m) => m[1]);
  const attendues = [
    ...c.monnaies.map((m) => `monnaie-${m.id}`), ...[...c.materiaux, ...c.gemmes, ...c.bois, ...c.fruits, ...c.ingredients.flatMap((x) => x.ingredients),
      ...c.objets.flatMap((s) => s.objets)].map((r) => ancreDeComposant(r.id)),
  ];
  assert.deepEqual(lignes, attendues);
  assert.equal(new Set(lignes).size, lignes.length, 'ancres uniques');
  assert.ok(c.fruits.length > 0 && c.fruits.every((f) => f.type === 'Fruit'), 'la table des fruits');
  assert.ok(!main.includes('#potion:') && !main.includes('#livre:'), 'pas de consommable');
});

test('les champs du mode modification se relisent ; un composant cité ne se supprime pas', options, () => {
  const eds = [...main.matchAll(/data-ed(?:-lecture)?="([^"]+)"/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
  assert.ok(eds.length > 500);
  for (const e of eds) assert.ok(lireAttributEd(e), e);
  const fer = c.materiaux.find((m) => m.nom_cle === 'fer');
  assert.ok(main.includes(echapper(attributEd('ressource', { id: fer.id }, 'prix_brut'))));
  assert.ok(fer.citations.length > 0);
  assert.match(main, new RegExp(`id="${ancreDeComposant(fer.id)}"[^>]*data-citee="Cité par : [^"]*armures`));
  const gemme = c.gemmes[0];
  assert.ok(main.includes(echapper(attributEd('gemme', { ressource_id: gemme.id }, 'quart_parfaite_brut'))));
});
