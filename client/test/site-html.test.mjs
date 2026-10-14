// Site CONSTRUIT (client/dist/) : adresses sans le préfixe /wiki/ (demande du propriétaire), logo officiel dans l'en-tête et en icône.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/site-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { trierVersions } from '../src/lib/notes-de-version.mjs';
import { htmlDeLaNote } from '../src/lib/notes-de-version-rendu.mjs';

const dist =fileURLToPath(new URL('../dist/', import.meta.url));
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
    ['regles Règles', 'ressources Ressources', 'personnages Personnages', 'codex Codex', 'outils Outils']);
  const outils = entete.match(/<ul class="site-nav__items" data-group="outils"[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.deepEqual([...outils.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`), ['Mise à jour /mise-a-jour/', 'Galeries /galeries/', 'Recherche /recherche/', 'Archives /archives/']);
  assert.match(lire('ressources/alchimie/index.html'), /data-group="ressources" aria-pressed="true" aria-current="true"/, 'une ressource hors menu ouvre les Ressources');
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
  // CODEX Maverick et Bestiaire 2.0 : les copies du propriétaire (2026-10-11), l'original en « Document d'origine »
  assert.match(archives, /<a href="https:\/\/docs\.google\.com\/document\/d\/1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg\/edit[^"]*" rel="noopener noreferrer" target="_blank">CODEX Maverick<\/a>/);
  assert.match(archives, /<a href="https:\/\/docs\.google\.com\/document\/d\/1CwDqDKurMOdqig3ozX4NQETbBW9sggsxEqM1WfbOG5M\/edit[^"]*" rel="noopener noreferrer" target="_blank">Document d’origine<\/a>/);
  assert.match(archives, /<a href="https:\/\/docs\.google\.com\/document\/d\/1WWCmI4nwkBnLcvkEsQEd-Cd_P5rb22NDJllCTO5yhsE\/edit[^"]*" rel="noopener noreferrer" target="_blank">Bestiaire 2\.0<\/a>/);
  assert.match(archives, /<a href="https:\/\/docs\.google\.com\/document\/d\/1vn5Tq11U6LG2T3X9Yobu5E_3DCKrg2jFoPFisvLYXK8\/edit[^"]*" rel="noopener noreferrer" target="_blank">Document d’origine<\/a>/);
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

test('/mise-a-jour/ : la note de la dernière version, l’historique, la place de la note en préparation ; la base de la production à côté', options, () => {
  const html = lire('mise-a-jour/index.html');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.match(main, /<h1>Mise à jour<\/h1>/);
  assert.match(main, /<div class="mise-a-jour" data-mise-a-jour data-api="\/api\/" data-maintenance="\/maintenance\/" data-version="\d+\.\d+\.\d+">/);
  assert.match(main, /<section class="nv-dev" data-nv-dev hidden aria-live="polite"><\/section>/, 'note en préparation : remplie par le script sur le site de dev');
  // les notes de la base, lues et non supposées : les notes d'exemple (lorem ipsum) tant qu'aucune livraison n'a eu lieu, puis les vraies — la
  // première mise à jour retire les exemples, et pendant une mise à jour (job preparer) data/rows porte la note du lot, pas encore livrée
  const db = ouvrirBase();
  const notes = db.prepare('SELECT * FROM note_version').all();
  const lignesDe = (v) => db.prepare('SELECT * FROM note_version_ligne WHERE version = ? ORDER BY rang').all(v)
    .map((l) => ({ ...l, parties: l.parties ? JSON.parse(l.parties) : null }));
  const [derniere, ...anciennes] = trierVersions(notes.map((n) => n.version)).map((v) => notes.find((n) => n.version === v));
  assert.ok(derniere, 'data/rows porte au moins une note (d’exemple ou livrée)');
  // la plus récente en premier, telle que le rendu pur la donne ; les autres dans l'historique, de la plus récente à la plus ancienne
  assert.ok(main.includes(htmlDeLaNote(derniere, lignesDe(derniere.version), { niveau: 2 })), `la note de la V${derniere.version}`);
  assert.equal(main.indexOf('<article class="nv-note"'), main.indexOf(`<article class="nv-note" id="v${derniere.version.replace('.', '-')}">`));
  assert.equal(main.includes('<h2 id="nv-historique">Historique</h2>'), anciennes.length > 0);
  for (const n of anciennes) assert.ok(main.includes(htmlDeLaNote(n, lignesDe(n.version), { niveau: 3 })), `la V${n.version} dans l’historique`);
  const positions = [derniere, ...anciennes].map((n) => main.indexOf(`id="v${n.version.replace('.', '-')}"`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.equal(/class="nv-exemple" role="note"/.test(main), notes.some((n) => n.exemple === 1), 'le bandeau « donnée d’exemple » sur les seules notes d’exemple');
  const production = main.slice(main.indexOf('<section class="nv-production" data-nv-production>')); // sans la feuille de style insérée avant
  assert.ok(production.length > 0 && production.length < main.length);
  for (const sens of ['amelioration', 'affaiblissement']) {
    const present = db.prepare(`SELECT 1 FROM note_version_ligne WHERE sens = ?
      OR (parties IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(parties) p WHERE json_extract(p.value, '$.sens') = ?))`).get(sens, sens);
    assert.equal(production.includes(`nv-sens--${sens}`), present !== undefined, `couleur « ${sens} » si une ligne l’a`);
  }
  assert.match(html, /<script type="module"[^>]*>|<script type="module" src="/, 'le script du site de dev');
  if (existsSync(join(dist, 'donnees', 'reference.json'))) {
    const ref = JSON.parse(lire('donnees/reference.json'));
    assert.match(ref.commit, /^[0-9a-f]{40}$/);
    assert.ok(existsSync(join(dist, 'donnees', 'reference.db')), 'base de la production (master)');
  }
});

test('maintenance pendant une mise à jour : chaque page (sauf /maintenance/) demande au service et part vers /maintenance/ ; sinon rien', options, async () => {
  const pages = walk(dist).filter((f) => f.endsWith('.html')).map((f) => relative(dist, f).split('\\').join('/'));
  const SCRIPT = /<script data-maintenance-api="([^"]+)" data-maintenance-page="([^"]+)">([\s\S]*?)<\/script>/;
  assert.deepEqual(pages.filter((rel) => !SCRIPT.test(lire(rel))), ['maintenance/index.html'], 'toutes les pages, page 404 comprise');
  const [, api, page, code] = lire('races/index.html').match(SCRIPT);
  assert.deepEqual([api, page], ['/api/maintenance/', '/maintenance/']);
  assert.ok(lire('races/index.html').indexOf(SCRIPT.exec(lire('races/index.html'))[0]) < lire('races/index.html').indexOf('</head>'), 'dans <head> : la question part tôt');
  /** Exécute le script de la page dans un faux navigateur ; `reponse` : ce que rend fetch. */
  const executer = async (reponse) => {
    const vu = { appels: [], remplacements: [], attributs: {}, entete: { inert: false } };
    vm.runInNewContext(code, {
      document: {
        currentScript: { getAttribute: (n) => ({ 'data-maintenance-api': api, 'data-maintenance-page': page })[n] },
        hidden: false,
        documentElement: { setAttribute: (n, v) => { vu.attributs[n] = v; } },
        querySelector: (sel) => (sel === '.site-header__inner' ? vu.entete : null),
        addEventListener: () => {},
      },
      location: { pathname: '/races/elfe/', search: '?a=1', hash: '#don', replace: (u) => vu.remplacements.push(u) },
      fetch: async (url, o) => { vu.appels.push([url, o.cache]); return reponse(); },
      setInterval: () => 0,
      addEventListener: () => {},
    });
    await new Promise((ok) => setTimeout(ok, 20));
    return vu;
  };
  const en = await executer(() => ({ ok: true, json: async () => ({ active: true, version_cible: '0.3', etape: 'preparation' }) }));
  assert.deepEqual(en.appels, [['/api/maintenance/', 'no-store']]);
  assert.deepEqual(en.remplacements, ['/maintenance/?retour=%2Fraces%2Felfe%2F%3Fa%3D1%23don'], 'retour à la même page, paramètres et ancre compris');
  assert.equal(en.attributs['data-maintenance'], '', 'menus grisés tout de suite');
  assert.equal(en.entete.inert, true);
  for (const [nom, reponse] of [['pas en maintenance', () => ({ ok: true, json: async () => ({ active: false }) })],
    ['service arrêté (502)', () => ({ ok: false, json: async () => ({}) })], ['site sans service', () => { throw new Error('réseau'); }],
    ['réponse inattendue', () => ({ ok: true, json: async () => 'oui' })]]) {
    const vu = await executer(reponse);
    assert.deepEqual([vu.remplacements, vu.attributs, vu.entete.inert], [[], {}, false], nom);
  }
});

test('/maintenance/ : « En travaux, merci de revenir dans quelques minutes », menus grisés et inertes, les étapes ; hors du menu', options, () => {
  const html = lire('maintenance/index.html');
  assert.match(html, /<title>Maintenance en cours — Maverick Center<\/title>/);
  assert.match(html, /<header class="site-header site-header--maintenance"><div class="site-header__inner" inert>/, 'ni clic ni clavier dans l’en-tête');
  assert.match(html, /<h1>Maintenance en cours<\/h1>/);
  assert.match(html, /<p class="maintenance__message">En travaux, merci de revenir dans quelques minutes\.<\/p>/);
  assert.deepEqual([...html.matchAll(/<li data-etape="([^"]+)">/g)].map((m) => m[1]), ['preparation', 'livraison', 'installation']);
  assert.match(html, /data-maintenance data-api="\/api\/" data-accueil="\/"/);
  assert.match(html, /<script type="module"/, 'le script qui ramène à la page quand c’est fini');
  const css = readdirSync(join(dist, '_astro')).filter((f) => f.endsWith('.css')).map((f) => lire(`_astro/${f}`)).join('\n');
  const grise = css.match(/\.site-header--maintenance \.site-nav,html\[data-maintenance\] \.site-nav\{([^}]*)\}/);
  assert.ok(grise && /opacity:/.test(grise[1]) && /pointer-events:none/.test(grise[1]), 'menu grisé, sur la page de maintenance et sur une page qui y part');
  assert.ok(!lire('index.html').includes('href="/maintenance/"'), 'pas dans le menu');
});
