// Page /ressources/equipement/ construite (dist/ ; demandes du propriétaire, 2026-10-16) : cinq onglets dans l'ordre (Armes, Armures, Boucliers,
// Ceinture, Accessoires), un panneau par onglet, le premier ouvert ; des identifiants uniques sur toute la page ; en tête de chaque onglet ou
// sous-onglet qui sert une page du wiki (Armes, Armures, Boucliers, Accessoires, et Bâtons magiques dans la ceinture), son panneau de règles (migration
// 0056 : titre, blocs et tuiles dans l'ordre de la base, deux colonnes sur un grand écran, plus de phrase au-dessus ; son texte dans l'index de la
// recherche) ; le sous-onglet des bâtons magiques de la ceinture (une ligne par magie, liens vers « Composants ») ; les anciennes pages ne sont plus
// construites et aucun lien du site n'y mène ; chaque onglet garde son script, et la page n'a qu'un script d'onglets. Le contenu des onglets Armes,
// Armures et Boucliers, Ceinture (et ses règles, tirées du guide), Accessoires : test/armes-html.test.mjs, armures-html.test.mjs, ceinture-html.test.mjs,
// accessoires-html.test.mjs. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ANCIENNE_PAGE_DE_LA_CEINTURE, CHEMIN_DE_L_EQUIPEMENT, ONGLETS_DE_L_EQUIPEMENT, PAGES_SERVIES_PAR_L_EQUIPEMENT } from '../src/lib/equipement.mjs';
import { chargerBatons } from '../src/lib/batons-db.mjs';
import { ancreDeBatons, couleursDesBatons } from '../src/lib/batons-rendu.mjs';
import { couleurDeMagie } from '../src/lib/sort-format.mjs';
import { adresseDePage, cheminDePage } from '../src/lib/metiers.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { chargerPanneau } from '../src/lib/panneaux-regles-db.mjs';
import { ancreDuPanneau } from '../src/lib/panneaux-regles-rendu.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const base = present ? ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }) : null;
const batons = present ? chargerBatons(base) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

test('panneaux de règles (migration 0056) : un par page servie (onglet ou sous-onglet), en tête de son panneau, sans phrase au-dessus ; replié sauf celui des accessoires ; son titre et ses blocs dans l’ordre de la base', options, () => {
  for (const { ancre: id } of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    const panneau = chargerPanneau(base, id);
    assert.ok(panneau, `${id} : son panneau dans la base`);
    const debut = main.indexOf(`<details class="preg" id="${ancreDuPanneau(id)}" data-panneau-regles="${id}"`);
    assert.ok(debut > 0, `${id} : son panneau dans la page`);
    const tete = main.slice(debut, main.indexOf('>', debut) + 1);
    assert.equal(/ open>$/.test(tete), id === 'accessoires', `${id} : ouvert au départ ou non (comme avant)`);
    const panneauHtml = main.slice(debut, main.indexOf('</details>', debut));
    assert.ok(panneauHtml.includes(`<summary class="preg__titre"><span data-ed="${echapper(attributEd('panneau_regles', { id }, 'titre'))}">${echapper(panneau.titre)}</span></summary>`), `${id} : le titre`);
    const blocs = [...panneauHtml.matchAll(/<div class="preg-bloc preg-bloc--(texte|tuile)" data-preg-bloc="(\d+)"/g)].map((m) => [Number(m[2]), m[1]]);
    assert.deepEqual(blocs, panneau.blocs.map((b) => [b.rang, b.tuile ? 'tuile' : 'texte']), `${id} : les blocs dans l’ordre de lecture`);
    // le panneau de règles suit le titre de l'onglet ou du sous-onglet (rien entre les deux : plus de chapeau, la première phrase répétée au-dessus)
    const titre = main.lastIndexOf(`id="titre-${id}">`, debut);
    const finDuTitre = main.slice(titre).search(/<\/h[23]>/) + titre + 5;
    const entre = main.slice(finDuTitre, debut).replace(/<template data-armes-piece="[A-Z]+">[\s\S]*?<\/template>/g, '');
    assert.match(entre, /^(?:<div class="(?:armes|acc)" data-(?:armes|accessoires)>)?$/, `${id} : rien avant le panneau`);
  }
  // l'onglet Ceinture (qui ne sert pas de page du wiki) n'a pas de panneau de règles : il garde ses règles tirées du guide (test/ceinture-html.test.mjs)
  assert.ok(!main.includes('data-panneau-regles="ceinture"'));
  assert.equal((main.match(/<details class="preg" /g) ?? []).length, PAGES_SERVIES_PAR_L_EQUIPEMENT.length, 'un panneau par page servie, pas d’autre');
  // plus de chapeau ni d'encart de règles dans les onglets qui ont un panneau
  for (const c of ['armes__chapo', 'armures__chapo', 'batons__chapo', 'acc__chapo', 'armes-regles', 'armures-regles', 'batons-regles', 'acc-regles']) assert.ok(!html.includes(c), c);
});

test('panneau des armes : les huit blocs de l’import dans l’ordre (tant que le site de dev ne l’a pas remanié), en tuiles les définitions, Dague, Arme de jet et le prix', options, () => {
  const panneau = chargerPanneau(base, 'armes');
  const genres = panneau.blocs.map((b) => (b.tuile ? `tuile:${b.titre ?? ''}` : 'texte'));
  const importe = ['texte', 'tuile:', 'tuile:', 'tuile:', 'texte', 'tuile:Dague', 'tuile:Arme de jet', 'tuile:Comment déterminer le prix de votre arme ?'];
  if (JSON.stringify(genres) !== JSON.stringify(importe)) return; // remanié sur le site de dev : le test précédent suit la base
  const debut = main.indexOf('<details class="preg" id="regles-armes"');
  const panneauHtml = main.slice(debut, main.indexOf('</details>', debut));
  const lus = [...panneauHtml.matchAll(/<div class="preg-bloc preg-bloc--(texte|tuile)"[^>]*>(?:<p class="preg-bloc__titre"[^>]*><span[^>]*>([^<]*)<\/span><\/p>)?/g)]
    .map((m) => (m[1] === 'tuile' ? `tuile:${m[2] ?? ''}` : 'texte'));
  assert.deepEqual(lus, importe);
});

test('panneaux de règles : leurs balises du glossaire rendues (mode complet « Libellé : définition », gras), aucune brute hors de `data-balise`', options, () => {
  const motsCles = new Map(base.prepare('SELECT id, libelle, description FROM mot_cle').all().map((m) => [m.id, m]));
  const brutes = main.replace(/ data-balise="[^"]*"/g, '');
  assert.ok(!brutes.includes('{{'), 'aucune balise brute dans la page');
  let completes = 0;
  for (const o of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    for (const b of chargerPanneau(base, o.ancre)?.blocs ?? []) {
      for (const [, id] of b.texte.matchAll(/\{\{([a-z0-9-]+):\}\}/g)) {
        const m = motsCles.get(id);
        assert.ok(m, `${o.ancre} : ${id} est un mot-clé`);
        const attendu = `<strong class="mot-cle-definition__nom">${echapper(m.libelle)}</strong> : <span class="mot-cle-definition__texte">`;
        assert.ok(main.includes(`data-mot-cle="${id}"`) && main.includes(attendu), `${o.ancre} : ${id} en mode complet`);
        completes += 1;
      }
    }
  }
  // l'import : Recharge longue, Recharge très longue et Mordhau, en tuiles du panneau des armes
  assert.ok(completes >= 1);
});

test('panneaux de règles : deux colonnes séparées d’un filet à partir de 64rem ; une tuile, un paragraphe ou une liste jamais coupés entre deux colonnes, la fin d’un texte jamais séparée de la tuile qui suit', options, () => {
  assert.ok(html.includes('@media (min-width: 64rem) { .preg__corps { columns: 2; column-gap: 2.6rem; column-rule: 1px solid var(--border); } }'));
  assert.ok(html.includes('.preg-bloc__texte > *, .preg-bloc--tuile { break-inside: avoid; }'));
  // la fin d'un bloc de texte suivi d'une tuile reste avec elle (« CAS PARTICULIERS : » des armes)
  assert.ok(html.includes('.preg-bloc--texte:has(+ .preg-bloc--tuile), .preg-bloc--texte:has(+ .preg-bloc--tuile) > .preg-bloc__texte > :last-child { break-after: avoid; }'));
  assert.equal(html.split('.preg { --preg:').length - 1, 1, 'le CSS, une fois par page');
});

test('recherche : le titre et le texte des panneaux de règles en tête de l’entrée de la page qu’ils servent', options, () => {
  const index = JSON.parse(readFileSync(join(dist, 'search-index.json'), 'utf8'));
  for (const o of PAGES_SERVIES_PAR_L_EQUIPEMENT) {
    const panneau = chargerPanneau(base, o.ancre);
    const { chemin, ancre } = adresseDePage(o.page);
    const entree = index.find((e) => e.path === chemin && e.ancre === ancre && e.title === base.prepare('SELECT titre FROM page WHERE id = ?').get(o.page)?.titre);
    assert.ok(entree, `${o.page} : son entrée`);
    const premier = panneau.blocs.find((b) => !/^\{\{/.test(b.texte));
    const mots = premier.texte.replace(/[#>*_`|\\]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
    assert.ok(entree.text.startsWith(panneau.titre), `${o.ancre} : le titre du panneau en tête`);
    assert.ok(entree.text.includes(mots), `${o.ancre} : « ${mots} »`);
  }
});

test('ceinture, bâtons magiques : le panneau de règles en tête, une ligne par magie (Gemme, Bois, Niveau au curseur, Effet, Prix) et ses liens vers « Composants »', options, () => {
  assert.ok(panneauDesBatons.length > 1000, 'le panneau des bâtons');
  assert.match(panneauDesBatons, /<h3 class="ceinture-panneau__titre" id="titre-batons-magiques">Bâtons magiques<\/h3><details class="preg" id="regles-batons-magiques" data-panneau-regles="batons-magiques">/);
  assert.ok(!panneauDesBatons.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  const lignes = [...panneauDesBatons.matchAll(/<tr class="baton ligne-couleur" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(lignes, batons.magies.map((m) => ancreDeBatons(m.magie.id)));
  // demande du propriétaire du 2026-10-16 : plus de colonne Magie ni de colonne par niveau ; le niveau au curseur, l'effet et le prix du niveau choisi
  const entetes = [...panneauDesBatons.slice(panneauDesBatons.indexOf('<thead>'), panneauDesBatons.indexOf('</thead>')).matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes, ['Gemme', 'Bois', 'Niveau', 'Effet', 'Prix']);
  // chaque ligne sur la couleur de sa magie dans l'onglet « Bâton magique » du classeur (lib/ceinture-couleurs.mjs), au niveau 1 ; ses infobulles dans
  // la couleur de la magie sur le site
  for (const m of batons.magies) {
    const { fond, texte } = couleursDesBatons(m.magie);
    assert.ok(panneauDesBatons.includes(`<tr class="baton ligne-couleur" id="${ancreDeBatons(m.magie.id)}" data-niveau="1" style="--baton-fond: ${fond}; --baton-texte: ${texte}; --mag: ${couleurDeMagie(m.magie.nom)}">`), m.magie.nom);
  }
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
