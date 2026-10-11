// Site CONSTRUIT (client/dist/) : adresses sans le préfixe /wiki/ (demande du propriétaire), logo officiel dans l'en-tête et en icône.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/site-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };

const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const lire = (rel) => readFileSync(join(dist, rel), 'utf8');

test('les pages sont à la racine du site, plus sous /wiki/', options, () => {
  assert.ok(!existsSync(join(dist, 'wiki')), 'dossier dist/wiki/');
  for (const rel of ['races/index.html', 'races/nain/index.html', 'magies/magie-du-feu/index.html', 'classes/index.html', 'pages/index.html']) {
    assert.ok(existsSync(join(dist, rel)), rel);
  }
  const avecWiki = walk(dist)
    .filter((f) => f.endsWith('.html') || f.endsWith('.json'))
    .filter((f) => /(?:href|action|src)="\/wiki\/|"path":"wiki\//.test(readFileSync(f, 'utf8')));
  assert.deepEqual(avecWiki, [], 'aucun lien vers /wiki/');
  assert.match(lire('races/nain/index.html'), /<a href="\/">Accueil<\/a> › <a href="\/races\/">Races<\/a>/, 'fil d’Ariane');
});

test('la page 404 renvoie les anciennes adresses /wiki/… vers les nouvelles', options, () => {
  const html = lire('404.html');
  assert.match(html, /<p id="introuvable" data-base="\/">/);
  assert.match(html, /location\.replace/);
});

test('en-tête : le logo à la place du titre, le menu à côté ; le logo en icône', options, () => {
  const html = lire('index.html');
  const entete = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(entete, /<a class="brand" href="\/"><img src="\/logo\.webp" alt="Maverick Center" width="\d+" height="\d+"\s*\/?><\/a>/);
  assert.ok(entete.indexOf('class="site-nav"') > entete.indexOf('class="site-header__menu"'), 'menu dans la même bande que le logo');
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon\.png"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  for (const fichier of ['logo.webp', 'favicon.png', 'apple-touch-icon.png']) assert.ok(existsSync(join(dist, fichier)), fichier);
  assert.ok(!existsSync(join(dist, 'favicon.svg')), 'ancienne icône retirée');
});

test('en-tête : plus de barre de recherche (une page à part, avec les mots-clés) ; le menu voulu par le propriétaire', options, () => {
  const html = lire('index.html');
  const entete = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.ok(!/<form|type="search"/.test(entete), 'aucun formulaire de recherche dans l’en-tête');
  assert.deepEqual([...entete.matchAll(/class="nav-group__toggle" data-group="([^"]+)"[^>]*>([^<]+)</g)].map((m) => `${m[1]} ${m[2].trim()}`),
    ['regles Règles', 'personnages Personnages', 'inventaire Inventaire', 'codex Codex', 'outils Outils']);
  const outils = entete.match(/<ul class="site-nav__items" data-group="outils"[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.deepEqual([...outils.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`), ['Galeries /galeries/', 'Recherche /recherche/', 'Archives /archives/']);
  assert.match(lire('ressources/alchimie/index.html'), /data-group="inventaire" aria-pressed="true" aria-current="true"/, 'une ressource hors menu ouvre l’Inventaire');
});

test('accueil : texte de bienvenue et défilement des images de la galerie (en construction : le logo seul)', options, () => {
  const html = lire('index.html');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.match(main, /<h1 id="titre-accueil">Bienvenue sur Maverick Center<\/h1>/);
  assert.match(main, /<a class="accueil__bouton accueil__bouton--principal" href="\/guide\/">Lire le guide<\/a>/);
  assert.match(main, /<section class="carrousel" aria-roledescription="carrousel" aria-label="Galerie"/);
  assert.match(main, /<a href="\/galeries\/#image-logo"><img src="\/logo\.webp" alt="Logo de Maverick[^"]*" width="319" height="320"/, 'l’image mène à sa place sur /galeries/');
  assert.match(main, /class="carrousel__badge">En construction</);
  assert.ok(!main.includes('class="carrousel__commandes"'), 'pas de flèches pour une seule image');
  assert.ok(!main.includes('class="card"'), 'plus la grille des rubriques');
});

test('/galeries/ : toutes les images ; /archives/ : les documents sources et l’ancien wiki', options, () => {
  const galeries = lire('galeries/index.html');
  assert.match(galeries, /<li id="image-logo"><figure><a href="\/logo\.webp"><img src="\/logo\.webp"/);
  const archives = lire('archives/index.html');
  for (const titre of ['Classeurs et documents du jeu', 'Fiches de personnage automatiques', 'L’ancien wiki']) assert.ok(archives.includes(`>${titre}</h2>`), titre);
  assert.ok(!archives.includes('Documents introuvables') && !archives.includes('sans titre'), 'chaque document a son titre');
  assert.match(archives, /<a href="https:\/\/docs\.google\.com\/spreadsheets\/d\/1Pyg4GSUlFrvNaTg3bi6uXlehg1MuRHmkyfPO6s5K72I\/edit[^"]*" rel="noopener noreferrer" target="_blank">Classe Maverick V7<\/a>/);
  assert.match(archives, /<a href="https:\/\/docs\.google\.com\/document\/d\/1CwDqDKurMOdqig3ozX4NQETbBW9sggsxEqM1WfbOG5M\/edit[^"]*" rel="noopener noreferrer" target="_blank">CODEX Maverick<\/a>/);
  assert.match(archives, /<a href="https:\/\/docs\.google\.com\/document\/d\/1vn5Tq11U6LG2T3X9Yobu5E_3DCKrg2jFoPFisvLYXK8\/edit[^"]*" rel="noopener noreferrer" target="_blank">Bestiaire 2\.0<\/a>/);
  assert.match(archives, /href="https:\/\/maverick-jdr\.fandom\.com\/fr\/wiki\/Progression"/);
  assert.ok(!archives.includes('payoumorfot'), 'pas d’adresse de courriel du registre');
});

test('aucun lien vers les classeurs « Familiers » et « Prototype » (demande du propriétaire, migration 0019)', options, () => {
  const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0014-sources-copies-drive.json', import.meta.url), 'utf8'));
  const ids = registre.copies.filter((c) => ['Familiers', 'Prototype'].includes(c.titre)).flatMap((c) => [c.avant, c.apres]);
  assert.equal(ids.length, 4);
  const avecLien = walk(dist)
    .filter((f) => f.endsWith('.html') || f.endsWith('.json'))
    .filter((f) => ids.some((id) => readFileSync(f, 'utf8').includes(id)));
  assert.deepEqual(avecLien, []);
});

test('/recherche/ : la recherche et tous les mots-clés ; plus de /tags/ (la page 404 y renvoie), la page d’un mot-clé ramène à la recherche', options, () => {
  const html = lire('recherche/index.html');
  assert.match(html, /<form id="search-form" action="\/recherche\/"/);
  const motsCles = [...html.matchAll(/<li data-cle="([^"]+)"><a class="badge" href="\/tags\/([^"/]+)\/">/g)];
  assert.ok(motsCles.length > 100, `${motsCles.length} mots-clés`);
  for (const [, cle, adresse] of motsCles) {
    assert.equal(cle, adresse);
    assert.ok(existsSync(join(dist, 'tags', cle, 'index.html')), `tags/${cle}/`);
  }
  assert.ok(!existsSync(join(dist, 'tags', 'index.html')), 'ancienne liste des mots-clés');
  assert.match(lire(`tags/${motsCles[0][1]}/index.html`), /<a href="\/recherche\/#mots-cles">Mots-clés<\/a> ›/);
});

test('en-tête : la bande a la hauteur du menu, pas du logo, dont la pointe de l’épée dépasse dessous ; sur téléphone, le logo reste dans la bande', options, () => {
  const css = readdirSync(join(dist, '_astro'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => lire(`_astro/${f}`))
    .find((c) => c.includes('.brand img{'));
  assert.ok(css, 'feuille de style de l’en-tête');
  /** Déclarations des règles `selecteur{…}` d'un morceau de CSS minifié (l'ordre des propriétés n'est pas garanti). */
  const regles = (morceau, selecteur) => [...morceau.matchAll(new RegExp(`(?:^|[}{])${selecteur.replace(/[.*]/g, '\\$&')}\\{([^}]*)\\}`, 'g'))].map((m) => m[1].split(';'));
  const telephone = css.indexOf('@media (width<=60rem){');
  assert.ok(telephone > 0, 'règles du téléphone');
  const [bureau, petit] = [css.slice(0, telephone), css.slice(telephone)];
  // bureau : l'image hors du flux (la hauteur de la bande vient du menu), le lien garde sa largeur et prend la hauteur de la bande, l'en-tête passe devant la page
  assert.ok(regles(bureau, '.brand img').some((d) => d.includes('position:absolute') && d.includes('top:0') && d.includes('pointer-events:none')), 'image en absolu, sans capter les clics');
  assert.ok(regles(bureau, '.brand').some((d) => d.includes('align-self:stretch') && d.includes('position:relative') && d.some((x) => x.startsWith('width:'))), 'lien : largeur du logo, hauteur de la bande');
  assert.ok(regles(bureau, '.site-header').some((d) => d.includes('position:relative') && d.some((x) => x.startsWith('z-index:'))), 'la pointe passe devant le contenu');
  // téléphone : le menu passe sous le logo, qui reprend sa place dans le flux
  assert.ok(regles(petit, '.brand img').some((d) => d.includes('position:static')), 'logo dans le flux sur téléphone');
});

test('le service des personnages est livré avec le site, dans _serveur/ (mode client / serveur, docs/serveur.md)', options, async () => {
  const { DOSSIER_LIVRE, ENTREE, modulesDuServeur } = await import('../serveur/livraison.mjs');
  const info = JSON.parse(lire(`${DOSSIER_LIVRE}/version.json`));
  assert.equal(info.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  assert.deepEqual(info.modules, modulesDuServeur());
  assert.ok(existsSync(join(dist, DOSSIER_LIVRE, ENTREE)));
  assert.ok(existsSync(join(dist, 'donnees', 'maverick.db')), 'la base des règles qu’il recopie');
});
