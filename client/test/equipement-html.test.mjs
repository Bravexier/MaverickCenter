// Page /ressources/equipement/ construite (dist/ ; demandes du propriétaire, 2026-10-16) : cinq onglets dans l'ordre (Armes, Armures, Boucliers,
// Bâtons magiques, Accessoires), un panneau par onglet, le premier ouvert ; des identifiants uniques sur toute la page ; l'onglet des bâtons magiques
// (règles, une ligne par magie, liens vers « Composants ») ; les anciennes pages ne sont plus construites et aucun lien du site n'y mène ; chaque
// onglet garde son script, et la page n'a qu'un script d'onglets. Le contenu des onglets Armes, Armures et Boucliers, Accessoires :
// test/armes-html.test.mjs, armures-html.test.mjs, accessoires-html.test.mjs. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CHEMIN_DE_L_EQUIPEMENT, ONGLETS_DE_L_EQUIPEMENT } from '../src/lib/equipement.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { ancreDeBatons } from '../src/lib/batons-rendu.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const batons = present ? chargerBatons(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
const panneauDesBatons = main.slice(main.indexOf('<section class="equipement-panneau batons" id="batons-magiques"'), main.indexOf('<section class="equipement-panneau" id="accessoires"'));

test('le titre, puis les cinq onglets dans l’ordre, chacun un lien vers son panneau ; le premier ouvert au départ', options, () => {
  assert.match(main, /<div class="equipement">\s*<h1>Équipement <span class="badge">Ressource<\/span><\/h1>/);
  // le groupe des onglets de la page est sa barre seule (components/Onglets.astro prend tous les `.onglet` d'un groupe ; l'onglet Accessoires a les siens)
  const barre = main.slice(main.indexOf('<nav class="equipement-onglets" aria-label="Équipement" data-onglets="Équipement">'), main.indexOf('</nav>', main.indexOf('class="equipement-onglets"')));
  assert.equal((barre.match(/class="onglet[ "]/g) ?? []).length, ONGLETS_DE_L_EQUIPEMENT.length, 'la barre n’a que les onglets de la page');
  const onglets = [...main.matchAll(/<a class="onglet( is-active)?" id="onglet-([a-z-]+)" href="#([a-z-]+)">\s*<span class="onglet__nom">([^<]+)<\/span>/g)];
  assert.deepEqual(onglets.map((m) => [m[2], m[3], m[4]]), ONGLETS_DE_L_EQUIPEMENT.map((o) => [o.id, o.id, o.nom]));
  assert.deepEqual(onglets.map((m) => Boolean(m[1])), ONGLETS_DE_L_EQUIPEMENT.map((o, i) => i === 0), 'seul le premier onglet est ouvert');
  const panneaux = [...main.matchAll(/<section class="([^"]*\bequipement-panneau\b[^"]*)" id="([a-z-]+)" aria-labelledby="titre-([a-z-]+)"/g)];
  assert.deepEqual(panneaux.map((m) => m[2]), ONGLETS_DE_L_EQUIPEMENT.map((o) => o.id), 'un panneau par onglet, dans l’ordre');
  for (const [, classes, id, titre] of panneaux) {
    assert.equal(titre, id, `${id} : son titre`);
    assert.equal(/\bis-active\b/.test(classes), id === ONGLETS_DE_L_EQUIPEMENT[0].id, `${id} : ouvert au départ ou non`);
    assert.ok(main.includes(`<h2 class="equipement-panneau__titre" id="titre-${id}">`), `${id} : le titre du panneau`);
  }
  assert.equal((main.match(/<h1[\s>]/g) ?? []).length, 1, 'un seul titre de page');
  assert.ok(html.includes(`href="/${CHEMIN_DE_L_EQUIPEMENT}"`), 'l’entrée du menu Ressources');
});

test('identifiants uniques sur toute la page (les onglets réunis : matériaux, améliorations, matières…)', options, () => {
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual([...new Set(doublons)], []);
  for (const id of ['materiaux-armes', 'ameliorations-arme', 'materiaux-armures']) assert.ok(ids.includes(id), id);
});

test('bâtons magiques : les règles repliées (introduction, fabrication), une ligne par magie, ses trois niveaux et ses liens vers « Composants »', options, () => {
  assert.ok(panneauDesBatons.length > 1000, 'le panneau des bâtons');
  assert.equal(panneauDesBatons.includes('<details class="batons-regles">'), Boolean(batons.regles.introduction || batons.regles.fabrication));
  assert.equal(panneauDesBatons.includes('<strong>Fabrication</strong>'), Boolean(batons.regles.fabrication));
  assert.ok(!panneauDesBatons.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  const lignes = [...panneauDesBatons.matchAll(/<tr class="baton" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(lignes, batons.magies.map((m) => ancreDeBatons(m.magie.id)));
  for (const n of batons.niveaux) assert.ok(panneauDesBatons.includes(`>Niveau ${n.niveau}<span class="baton-recette">`), `niveau ${n.niveau}`);
  const composants = readFileSync(join(dist, 'ressources', 'composants', 'index.html'), 'utf8');
  const ancres = [...new Set([...panneauDesBatons.matchAll(/href="\/ressources\/composants\/#([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(ancres.length >= batons.magies.length * 2, 'une gemme et un bois par magie');
  for (const a of ancres) assert.ok(composants.includes(`id="${a}"`), `ancre absente de « Composants » : ${a}`);
  assert.match(panneauDesBatons, /href="\/ressources\/objets-a-la-ceinture\/"/, 'les autres objets de la ceinture');
});

test('les anciennes pages ne sont plus construites et aucun lien du site n’y mène ; ceux du wiki mènent à l’onglet', options, () => {
  for (const o of ONGLETS_DE_L_EQUIPEMENT) assert.ok(!existsSync(join(dist, ...o.page.split('/'))), `pas de page /${o.page}/`);
  const anciennes = new RegExp(`href="[^"]*/(${ONGLETS_DE_L_EQUIPEMENT.map((o) => o.page).join('|')})/`);
  const pages = readdirSync(dist, { recursive: true }).filter((n) => n.endsWith('.html') && n !== '404.html');
  for (const nom of pages) assert.ok(!anciennes.test(readFileSync(join(dist, nom), 'utf8')), nom);
  // le chapitre « L'équipement » du guide cite la page « Bouclier » (migration 0046) : son lien mène à l'onglet
  assert.ok(readFileSync(join(dist, 'guide', 'l-equipement', 'index.html'), 'utf8').includes(`href="/${cheminDePage('ressources/bouclier')}"`));
});

test('chaque onglet garde son script ; un seul script d’onglets sur la page', options, () => {
  for (const s of ['ArmesPage', 'ArmuresPage', 'AccessoiresPage']) assert.match(html, new RegExp(`<script type="module" src="[^"]*${s}\\.astro_astro_type_script`), s);
  assert.equal((html.match(/onglets:brancher/g) ?? []).length, 1, 'components/Onglets.astro, posé une fois');
  // deux groupes : la barre de la page et, dans l'onglet Accessoires, les tableaux d'effets ; aucun ne contient l'autre
  assert.deepEqual([...main.matchAll(/data-onglets="([^"]+)"/g)].map((m) => m[1]), ['Équipement', 'Effets par propriété']);
});
