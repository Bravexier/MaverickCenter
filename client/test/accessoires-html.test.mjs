// Page /ressources/accessoires/ construite (dist/) : le générateur d'accessoire (demande du propriétaire) — pas de tableau Markdown, les règles en tête,
// un tableau par étape avec une case au dé, un tableau d'effets par propriété, la monture, l'encart de l'accessoire créé ; les lignes d'effet et de
// monture dans la couleur de leur niveau ; pas de tableau des gemmes, une infobulle par gemme, la gemme dans la couleur de sa magie. Se saute sans dist/
// (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bulleDeGemme, chargerAccessoires } from '../src/lib/accessoires-db.mjs';
import { cleDEffet, COULEURS_DES_NIVEAUX } from '../src/lib/accessoires-generateur.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'accessoires', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const a = present ? chargerAccessoires(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;

test('pas de tableau Markdown : le gabarit du générateur, avec les règles de l’onglet', options, () => {
  assert.match(main, /<div class="acc" data-accessoires>/);
  assert.match(main, /<details class="acc-regles" open>/);
  assert.ok(main.includes('Les accessoires maudits'), 'les règles');
  assert.equal((main.match(/<table>/g) ?? []).length, 0, 'aucun tableau rendu depuis le Markdown');
  assert.ok(!main.includes('Gemme précieuse'), 'pas de tableau des gemmes');
  assert.match(main, /data-acc-produit/, 'l’encart de l’accessoire créé');
  assert.match(main, /data-acc-tout-tirer/);
});

test('une case au dé par tableau : identité, propriété, chaque propriété à effets, monture', options, () => {
  const tables = (main.match(/<table class="acc-table/g) ?? []).length;
  const des = [...main.matchAll(/<button type="button" class="acc-de js-seul" data-de="(\d+)"(?: data-de-bonus="(\d+)")?/g)];
  assert.equal(des.length, tables);
  assert.equal(tables, 2 + a.proprietes.filter((p) => p.effets.length).length + 1);
  assert.deepEqual(des.map((d) => [d[1], d[2] ?? null]).slice(0, 2), [['4', null], ['100', null]]);
  assert.ok(des.some((d) => d[1] === '6' && d[2] === '20'), 'compétence : 1d6 puis 1d20');
});

test('une ligne (ou case) à choisir par emplacement, propriété, effet et monture ; effets et montures dans la couleur de leur niveau', options, () => {
  const choix = [...main.matchAll(/data-choix="(\w+)" data-valeur="([^"]+)"/g)];
  const compte = (s) => choix.filter((c) => c[1] === s).length;
  assert.equal(compte('emplacement'), a.emplacements.length);
  assert.equal(compte('propriete'), a.proprietes.length);
  assert.equal(compte('effet'), a.proprietes.reduce((n, p) => n + p.effets.length, 0));
  assert.equal(compte('monture'), a.montures.length);
  for (const e of a.proprietes.flatMap((p) => p.effets)) {
    const i = main.indexOf(`data-valeur="${cleDEffet(e.id)}"`);
    const debut = main.lastIndexOf('<t', i);
    const balise = main.slice(debut, main.indexOf('>', i));
    if (e.niveau) assert.ok(balise.includes(`--niv: ${COULEURS_DES_NIVEAUX[e.niveau]}`), e.id);
    else assert.ok(!balise.includes('--niv'), e.id);
  }
  for (const m of a.montures) assert.match(main, new RegExp(`style="--niv: ${COULEURS_DES_NIVEAUX[m.niveau]}" data-choix="monture" data-valeur="${m.niveau}"`));
});

test('gemmes : une infobulle par gemme, chaque mention dans la couleur de sa magie et reliée à son infobulle', options, () => {
  for (const g of a.gemmes) {
    const id = bulleDeGemme(g.id);
    assert.equal((main.match(new RegExp(` id="${id}"`, 'g')) ?? []).length, 1, id);
  }
  const mentions = [...main.matchAll(/<span class="acc-gemme" style="--g: (#[0-9a-f]{6}); --g-texte: #[0-9a-f]{6}" data-bulle="([^"]+)"/g)];
  assert.ok(mentions.length > 200);
  for (const [, couleur, bulle] of mentions) assert.equal(a.gemmes.find((g) => bulleDeGemme(g.id) === bulle)?.couleur, couleur, bulle);
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('le script de la page n’importe que lib/accessoires-generateur.mjs, qu’aucun autre script de page n’importe', () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/accessoires.mjs', import.meta.url)), ['../lib/accessoires-generateur.mjs']);
  assert.deepEqual(imports(new URL('../src/lib/accessoires-generateur.mjs', import.meta.url)), [], 'module sans import');
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'accessoires.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /accessoires-generateur\.mjs$/.test(m)), [], nom);
  }
});
