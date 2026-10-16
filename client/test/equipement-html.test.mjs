// Page /ressources/equipement/ construite (dist/ ; demandes du propriétaire, 2026-10-16) : cinq onglets dans l'ordre (Armes, Armures, Boucliers,
// Ceinture, Accessoires), un panneau par onglet, le premier ouvert ; des identifiants uniques sur toute la page ; le sous-onglet des bâtons magiques
// de la ceinture (règles, une ligne par magie, liens vers « Composants ») ; les anciennes pages ne sont plus construites et aucun lien du site n'y
// mène ; chaque onglet garde son script, et la page n'a qu'un script d'onglets. Le contenu des onglets Armes, Armures et Boucliers, Ceinture,
// Accessoires : test/armes-html.test.mjs, armures-html.test.mjs, ceinture-html.test.mjs, accessoires-html.test.mjs. Se saute sans dist/ (npm run
// build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ANCIENNE_PAGE_DE_LA_CEINTURE, CHEMIN_DE_L_EQUIPEMENT, ONGLETS_DE_L_EQUIPEMENT, PAGES_SERVIES_PAR_L_EQUIPEMENT } from '../src/lib/equipement.mjs';
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
const panneauDesBatons = main.slice(main.indexOf('<section class="ceinture-panneau batons" id="batons-magiques"'), main.indexOf('<section class="equipement-panneau" id="accessoires"'));

test('le titre, puis les cinq onglets dans l’ordre, chacun un lien vers son panneau ; le premier ouvert au départ', options, () => {
  assert.match(main, /<div class="equipement">\s*<h1>Équipement <span class="badge">Ressource<\/span><\/h1>/);
  // le groupe des onglets de la page est sa barre seule (components/Onglets.astro prend tous les `.onglet` d'un groupe ; les onglets Ceinture et Accessoires ont les leurs)
  const barre = main.slice(main.indexOf('<nav class="equipement-onglets" aria-label="Équipement" data-onglets="Équipement">'), main.indexOf('</nav>', main.indexOf('class="equipement-onglets"')));
  assert.equal((barre.match(/class="onglet[ "]/g) ?? []).length, ONGLETS_DE_L_EQUIPEMENT.length, 'la barre n’a que les onglets de la page');
  const onglets = [...barre.matchAll(/<a class="onglet( is-active)?" id="onglet-([a-z-]+)" href="#([a-z-]+)">\s*<span class="onglet__nom">([^<]+)<\/span>/g)];
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
  for (const id of ['materiaux-armes', 'ameliorations-arme', 'ameliorations-armure', 'ameliorations-bouclier']) assert.ok(ids.includes(id), id);
});

test('ceinture, bâtons magiques : les règles repliées (introduction, fabrication), une ligne par magie (Gemme, Bois, Niveau au curseur, Effet, Prix) et ses liens vers « Composants »', options, () => {
  assert.ok(panneauDesBatons.length > 1000, 'le panneau des bâtons');
  assert.equal(panneauDesBatons.includes('<details class="batons-regles">'), Boolean(batons.regles.introduction || batons.regles.fabrication));
  assert.equal(panneauDesBatons.includes('<strong>Fabrication</strong>'), Boolean(batons.regles.fabrication));
  assert.ok(!panneauDesBatons.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  const lignes = [...panneauDesBatons.matchAll(/<tr class="baton" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(lignes, batons.magies.map((m) => ancreDeBatons(m.magie.id)));
  // demande du propriétaire du 2026-10-16 : plus de colonne Magie ni de colonne par niveau ; le niveau au curseur, l'effet et le prix du niveau choisi
  const entetes = [...panneauDesBatons.slice(panneauDesBatons.indexOf('<thead>'), panneauDesBatons.indexOf('</thead>')).matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes, ['Gemme', 'Bois', 'Niveau', 'Effet', 'Prix']);
  assert.equal((panneauDesBatons.match(/<tr class="baton" id="[^"]+" data-niveau="1" style="--mag: #[0-9a-f]{6}; --mag-texte: #[0-9a-f]{6}">/g) ?? []).length, batons.magies.length, 'chaque ligne sur la couleur de sa magie, au niveau 1');
  assert.equal((panneauDesBatons.match(/<input type="range" class="baton-curseur__champ" min="1" max="3"/g) ?? []).length, batons.magies.length, 'un curseur par ligne');
  assert.equal((panneauDesBatons.match(/<span class="bulle bulle--baton" role="tooltip" id="bulle-baton-[a-z-]+-(?:gemme|bois)" hidden>/g) ?? []).length, batons.magies.length * 2, 'une infobulle par gemme et par bois');
  assert.equal((panneauDesBatons.match(/<a class="acc-gemme" href="\/ressources\/composants\/#composant-gemme-[^"]+" style="--g: #[0-9a-f]{6}; --g-texte: #[0-9a-f]{6}"/g) ?? []).length, batons.magies.length, 'la gemme : la pastille des accessoires');
  assert.ok(!panneauDesBatons.includes('baton__qualite'), 'pas de ligne pour la qualité de la gemme');
  assert.ok(panneauDesBatons.includes('<section class="ceinture-panneau batons" id="batons-magiques" aria-labelledby="titre-batons-magiques" data-batons>'), 'la racine du script, le dernier sous-onglet de la ceinture');
  const composants = readFileSync(join(dist, 'ressources', 'composants', 'index.html'), 'utf8');
  const ancres = [...new Set([...panneauDesBatons.matchAll(/href="\/ressources\/composants\/#([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(ancres.length >= batons.magies.length * 2, 'une gemme et un bois par magie');
  for (const a of ancres) assert.ok(composants.includes(`id="${a}"`), `ancre absente de « Composants » : ${a}`);
});

test('les anciennes pages ne sont plus construites et aucun lien du site n’y mène ; ceux du wiki mènent à l’onglet', options, () => {
  const chemins = [...PAGES_SERVIES_PAR_L_EQUIPEMENT.map((o) => o.page), ANCIENNE_PAGE_DE_LA_CEINTURE.replace(/\/$/, '')];
  for (const c of chemins) assert.ok(!existsSync(join(dist, ...c.split('/'))), `pas de page /${c}/`);
  const anciennes = new RegExp(`href="[^"]*/(${chemins.join('|')})/`);
  const pages = readdirSync(dist, { recursive: true }).filter((n) => n.endsWith('.html') && n !== '404.html');
  for (const nom of pages) assert.ok(!anciennes.test(readFileSync(join(dist, nom), 'utf8')), nom);
  // le chapitre « L'équipement » du guide cite la page « Bouclier » (migration 0046) : son lien mène à l'onglet
  assert.ok(readFileSync(join(dist, 'guide', 'l-equipement', 'index.html'), 'utf8').includes(`href="/${cheminDePage('ressources/bouclier')}"`));
});

test('chaque onglet garde son script ; un seul script d’onglets sur la page', options, () => {
  for (const s of ['ArmesPage', 'ArmuresPage', 'AccessoiresPage']) assert.match(html, new RegExp(`<script type="module" src="[^"]*${s}\\.astro_astro_type_script`), s);
  // celui des bâtons magiques (src/scripts/batons.mjs), assez court pour qu'Astro l'écrive en ligne, une fois
  assert.equal((html.match(/<script type="module">[^<]*\[data-baton-curseur\]/g) ?? []).length, 1, 'BatonsMagiques');
  assert.equal((html.match(/onglets:brancher/g) ?? []).length, 1, 'components/Onglets.astro, posé une fois');
  // trois groupes : la barre de la page, les sous-onglets de la ceinture et, dans l'onglet Accessoires, les tableaux d'effets ; chacun est sa barre seule
  assert.deepEqual([...main.matchAll(/data-onglets="([^"]+)"/g)].map((m) => m[1]), ['Équipement', 'Ceinture', 'Effets par propriété']);
});
