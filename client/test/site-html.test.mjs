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
import { htmlAvecMotsCles, pageAvecMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { trierVersions } from '../src/lib/notes-de-version.mjs';
import { ADRESSES_DU_PLAN_PRECEDENT, ANCRES_DES_PAGES_ABSORBEES, PAGES_ABSORBEES, PAR_OU_COMMENCER } from '../src/lib/livres.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { classesDeLaPalette } from '../src/lib/palette-css.mjs';
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

test('plus rien sous /guide/ (éclatement du guide, 2026-10-18) : ni page, ni lien, ni adresse dans l’index de la recherche', options, () => {
  assert.ok(!existsSync(join(dist, 'guide')), 'dossier dist/guide/');
  const avecGuide = walk(dist)
    .filter((f) => f.endsWith('.html') || f.endsWith('.json'))
    .filter((f) => /(?:href|action|src)="\/guide\/|"path":"guide\//.test(readFileSync(f, 'utf8')));
  assert.deepEqual(avecGuide.map((f) => relative(dist, f)), [], 'aucun lien vers /guide/');
  const guide = JSON.parse(lire('search-index.json')).filter((e) => e.type === 'Guide');
  assert.ok(guide.length > 50 && guide.every((e) => /^(?:decouvrir|regles|mj)\//.test(e.path)), 'les pages du guide à leurs nouvelles adresses');
});

test('la page 404 renvoie les anciennes adresses /wiki/… vers les nouvelles', options, () => {
  const html = lire('404.html');
  assert.match(html, /<p id="introuvable" data-base="\/" data-renvois="[^"]*">/);
  assert.match(html, /location\.replace/);
  // les anciennes adresses du guide (/guide/, /guide/<slug>/) : une par page du guide de l'index de la recherche, vers sa nouvelle adresse ; puis, pour
  // chaque page fusionnée dans une autre (refonte du 2026-10-18), /guide/<slug>/ et /decouvrir/<slug>/, et les adresses du plan précédent qui ont changé
  const attribut = html.match(/data-renvois="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const renvois = JSON.parse(attribut);
  assert.equal(renvois['guide/'], 'decouvrir/');
  const guide = JSON.parse(lire('search-index.json')).filter((e) => e.type === 'Guide');
  for (const e of guide) {
    const slug = Object.keys(renvois).find((k) => renvois[k] === e.path);
    assert.ok(slug && slug.startsWith('guide/'), `${e.path} : renvoi absent`);
  }
  assert.equal(Object.keys(renvois).length, guide.length + 1 + 2 * Object.keys(PAGES_ABSORBEES).length + Object.keys(ADRESSES_DU_PLAN_PRECEDENT).length);
  for (const ancienne of Object.keys(PAGES_ABSORBEES)) {
    const slug = ancienne.slice('guide/'.length);
    assert.equal(renvois[`decouvrir/${slug}/`], renvois[`${ancienne}/`], `${ancienne} : ses deux anciennes adresses mènent au même endroit`);
    // … à l'intertitre de la page qui l'absorbe où se lit son contenu
    const [chemin, ancre] = renvois[`${ancienne}/`].split('#');
    assert.equal(ancre, ANCRES_DES_PAGES_ABSORBEES[ancienne], ancienne);
    assert.match(lire(join(chemin, 'index.html')), new RegExp(`<h[2-6] id="${ancre}"`), `${ancienne} : #${ancre} absent de /${chemin}`);
    assert.ok(!existsSync(join(dist, 'decouvrir', slug)), `${ancienne} : plus construite`);
  }
  assert.equal(renvois['decouvrir/campagne-ou-scenario-one-shot/'], 'mj/campagne-ou-scenario-one-shot/');
  // la page Liens, supprimée le 2026-10-22 (« L'ancienne adresse renverrait vers Bienvenue. ») : vers Bienvenue, qui a ses ancres
  assert.equal(renvois['decouvrir/liens/'], 'decouvrir/');
  assert.ok(!existsSync(join(dist, 'decouvrir', 'liens')), '/decouvrir/liens/ n’est plus construite');
  for (const ancre of ['lien-discord', 'lien-tipeee', 'prochaine-rencontre']) assert.match(lire('decouvrir/index.html'), new RegExp(` id="${ancre}"`), ancre);
  assert.ok(Object.values(renvois).every((c) => !c.startsWith('guide/') && existsSync(join(dist, c.split('#')[0], 'index.html'))), 'chaque renvoi mène à une page construite');
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
    ['decouvrir Découvrir', 'regles Règles', 'joueur Espace joueur', 'mj Espace MJ', 'codex Codex', 'outils Outils']);
  assert.match(entete, /data-group="decouvrir" aria-pressed="true"/, 'l’accueil ouvre Découvrir');
  const outils = entete.match(/<ul class="site-nav__items" data-group="outils"[^>]*>([\s\S]*?)<\/ul>/)[1];
  // Debug : au menu du site de dev seulement (lib/nav.mjs#entreesDuMenu) ; un build de production (SITE_MODE=prod) a la page réservée, sans menu
  // (test/debug-page.test.mjs)
  const production = lire('debug/index.html').includes('class="debug-reservee"');
  assert.deepEqual([...outils.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`),
    ['Mise à jour /mise-a-jour/', 'Galeries /galeries/', 'Recherche /recherche/', 'Archives /archives/', ...(production ? [] : ['Debug /debug/'])]);
  assert.match(lire('ressources/alchimie/index.html'), /data-group="regles" aria-pressed="true" aria-current="true"/, 'une ressource hors menu ouvre les Règles');
  assert.ok(!entete.includes('data-group="ressources"'), 'plus de rubrique Ressources');
});

test('accueil : texte de bienvenue et défilement des images de la galerie (en construction : le logo seul)', options, () => {
  const html = lire('index.html');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.match(main, /<h1 id="titre-accueil">Bienvenue sur Maverick Center<\/h1>/);
  // la phrase de la première visite ne dit que la navigation (plus de livre : « Découvrir », la rubrique)
  assert.match(main, /<p>Première visite \? Commencez par Découvrir : le jeu, son univers, la création d’un personnage et comment rejoindre une partie\.<\/p>/);
  assert.match(main, /<a class="accueil__bouton accueil__bouton--principal" href="\/decouvrir\/">Découvrir Maverick<\/a>/);
  assert.doesNotMatch(main, /Lire le guide|pas à pas/);
  // « Par où commencer ? » : quatre cartes, le titre et le résumé de chaque page tels que la base les écrit, liés à leur adresse
  assert.match(main, /<h2 id="titre-par-ou-commencer">Par où commencer \?<\/h2>/);
  const cartes = [...main.matchAll(/<li class="accueil-debut__carte" style="--c: #[0-9a-f]{6}"><a class="accueil-debut__lien" href="([^"]+)">([^<]+)<\/a>(?:<p class="accueil-debut__resume">([\s\S]*?)<\/p>)?<\/li>/g)];
  const base = ouvrirBase();
  const pages = PAR_OU_COMMENCER.map((id) => base.prepare('SELECT id, titre, resume FROM page WHERE id = ?').get(id));
  assert.deepEqual(cartes.map((m) => m[1]), pages.map((p) => `/${cheminDePage(p.id)}`));
  assert.deepEqual(cartes.map((m) => m[2].replace(/&#39;/g, "'")), pages.map((p) => p.titre));
  assert.ok(cartes.every((m, i) => Boolean(m[3]) === Boolean(pages[i].resume)), 'un résumé quand la page en a un');
  assert.match(main, /<section class="carrousel" aria-roledescription="carrousel" aria-label="Galerie"/);
  assert.match(main, /<a href="\/galeries\/#image-logo"><img src="\/logo\.webp" alt="Logo de Maverick[^"]*" width="319" height="320"/, 'l’image mène à sa place sur /galeries/');
  assert.match(main, /class="carrousel__badge">En construction</);
  assert.ok(!main.includes('class="carrousel__commandes"'), 'pas de flèches pour une seule image');
  assert.ok(!main.includes('class="card"'), 'plus la grille des rubriques');
});

test('plus de sources sous une page : seules les Archives les montrent (réponse du propriétaire du 2026-10-22)', options, () => {
  // « Plus de sources ailleurs que dans les archives. On va épurer un peu ce qui est redondant. » : ni pied « Sources » (pages du wiki, guide, Codex…)
  // ni autre gabarit ; les données restent (frontmatter `sources:`, page_source, source), /archives/ les lit
  const pages = walk(dist).filter((f) => f.endsWith('.html') && relative(dist, f) !== join('archives', 'index.html'));
  assert.ok(pages.length > 200, `${pages.length} pages`);
  const avecSources = pages.filter((f) => /<h[1-6][^>]*>\s*Sources\s*<\/h[1-6]>/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(avecSources.map((f) => relative(dist, f)), []);
});

test('le retour arrière du navigateur au glissement horizontal est empêché pour tout le site (feuille globale)', options, () => {
  // réponses du propriétaire du 2026-10-22 (« Supprime juste le swipe. ») : html { overscroll-behavior-x: none } dans la feuille de toutes les pages
  const feuilles = [...lire('index.html').matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)].map((m) => m[1]);
  assert.ok(feuilles.length, 'la feuille globale de l’accueil');
  assert.ok(feuilles.some((h) => /html\{overscroll-behavior-x:none\}/.test(lire(h.replace(/^\//, '')))), 'html { overscroll-behavior-x: none }');
  for (const chemin of ['decouvrir/index.html', 'chronologie/index.html', 'races/nain/index.html']) {
    for (const h of feuilles) assert.ok(lire(chemin).includes(h), `${chemin} : ${h}`);
  }
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

test('/recherche/ : la recherche et le glossaire des mots-clés (tous, liens ?mot-cle=<id>, nombre de pages, définition en infobulle) ; plus de /tags/ (la page 404 y renvoie) ; les pastilles des pages y mènent', options, () => {
  const html = lire('recherche/index.html');
  assert.match(html, /<form id="search-form" action="\/recherche\/"/);
  assert.match(html, /<div class="recherche" data-recherche data-lien-mot-cle="\/recherche\/\?mot-cle=">/);
  assert.match(html, /<noscript><p class="banner">La recherche [^<]*JavaScript[^<]*<a href="\/pages\/">index de toutes les pages<\/a>/, 'sans JavaScript : l’index des pages');
  // plus de « Sans catégorie (à trier) » ni d'événements dans la vue d'un mot-clé : les événements ont des catégories (filtre de la frise), pas de mot-clé
  for (const reste of ['data-sans-categorie', 'data-libelle-sans-categorie', 'data-reserve', 'badge--sans-categorie', 'mot-cle-evenements']) assert.ok(!html.includes(reste), reste);
  assert.match(html, /<ul id="vue-du-mot-cle-pages" class="entry-list" hidden><\/ul>/, 'la vue d’un mot-clé : ses pages');
  // l'index : chaque page porte les ids de ses mots-clés (étiquettes, et ceux que citent ses balises) ; un événement n'a pas d'étiquette, ses `tags`
  // sont les libellés de ses catégories ; aucun texte de l'index n'a de balise brute
  const index = JSON.parse(lire('search-index.json'));
  assert.ok(index.every((e) => Array.isArray(e.motsCles) && !('evenement' in e)), 'motsCles partout, plus de drapeau `evenement`');
  const evenements = index.filter((e) => e.type === 'Événement');
  assert.ok(evenements.length > 50 && evenements.every((e) => e.path.startsWith('chronologie/')), 'les événements de la chronologie');
  const base = ouvrirBase();
  const ids = new Set(base.prepare('SELECT id FROM mot_cle').all().map((m) => m.id));
  assert.ok(evenements.every((e) => e.motsCles.every((id) => ids.has(id))), 'un événement : seulement les mots-clés que citent ses descriptions');
  assert.ok(index.every((e) => ![e.title, e.summary, e.text, ...e.tags, ...e.aliases].some((t) => /\{\{[^{}\n]+\}\}/.test(t ?? ''))), 'aucune balise brute dans l’index');
  const categories = new Map();
  for (const c of base.prepare('SELECT ec.evenement_id AS id, c.libelle FROM evenement_categorie ec JOIN categorie_chronologie c ON c.id = ec.categorie_id').all()) {
    categories.set(c.id, [...(categories.get(c.id) ?? []), c.libelle]);
  }
  for (const e of evenements) {
    const id = e.path.slice('chronologie/'.length, -1);
    assert.deepEqual([...e.tags].sort(), [...(categories.get(id) ?? [])].sort(), `${id} : ses tags = les libellés de ses catégories`);
  }
  const comptes = new Map();
  for (const e of index) for (const id of new Set(e.motsCles)) comptes.set(id, (comptes.get(id) ?? 0) + 1);
  // la liste : le glossaire, tout le vocabulaire (même un mot-clé qu'aucune page visible ne porte), chaque mot-clé décrit avec sa définition en infobulle
  const vocabulaire = new Map(base.prepare('SELECT id, libelle, libelle_cle, description FROM mot_cle').all().map((m) => [m.id, m]));
  const liste = html.slice(html.indexOf('<ul class="tags" id="liste-mots-cles">'), html.indexOf('id="aucun-mot-cle"'));
  const motsCles = [...liste.matchAll(/<li data-id="([^"]+)" data-cle="([^"]+)" data-n="(\d+)" data-libelle="[^"]*"( data-definition="[^"]*")?>\s*<a class="badge" href="\/recherche\/\?mot-cle=([^"]+)"( data-bulle="mot-cle-[^"]+" aria-describedby="mot-cle-[^"]+")?>([^<]+)<\/a>\s*<\/li>/g)];
  assert.equal(motsCles.length, (liste.match(/<li /g) ?? []).length, 'chaque mot-clé a la forme attendue');
  assert.ok(motsCles.length > 0, `${motsCles.length} mots-clés`);
  for (const [, id, cle, n, definition, lien, bulle, texte] of motsCles) {
    assert.equal(lien, id, 'le lien porte l’id (figé), pas l’écriture');
    assert.equal(Number(n), comptes.get(id) ?? 0, `${id} : nombre de pages de l’index`);
    assert.ok(Number(n) > 0 ? texte.endsWith(` (${n})`) : !/\(\d+\)$/.test(texte), texte);
    assert.equal(vocabulaire.get(id)?.libelle_cle, cle, `${id} : son écriture`);
    const decrit = Boolean(vocabulaire.get(id)?.description);
    assert.equal(Boolean(definition), decrit, `${id} : sa définition`);
    assert.equal(Boolean(bulle), decrit, `${id} : l’infobulle de sa définition`);
    if (decrit) assert.equal((html.match(new RegExp(`<span class="bulle" role="tooltip" id="mot-cle-${id}" hidden>`, 'g')) ?? []).length, 1, `${id} : sa bulle, une fois`);
  }
  assert.deepEqual(motsCles.map((m) => m[1]).sort(), [...vocabulaire.keys()].sort(), 'tout le vocabulaire, rien d’autre');
  assert.match(html, new RegExp(`<small id="nombre-mots-cles" class="muted">\\(${motsCles.length}\\)</small>`), 'le nombre de mots-clés');
  assert.match(html, /<p id="vue-du-mot-cle-definition" class="recherche-definition" hidden><\/p>/, 'la vue d’un mot-clé : sa définition');
  // plus de pages /tags/ : la page 404 renvoie /tags/<clé>/ vers /recherche/?mot-cle=<clé>
  assert.ok(!existsSync(join(dist, 'tags')), 'dossier dist/tags/');
  // les pastilles d'une page du wiki mènent à la recherche, par l'id du mot-clé
  const nain = lire('races/nain/index.html');
  const pastilles = [...nain.slice(nain.indexOf('<ul class="tags" aria-label="Mots-clés">')).split('</ul>')[0].matchAll(/<a class="badge" href="\/recherche\/\?mot-cle=([^"]+)">([^<]+)<\/a>/g)];
  assert.ok(pastilles.length > 0, 'pastilles de la page du Nain');
  for (const [, id, libelle] of pastilles) assert.equal(vocabulaire.get(id)?.libelle, libelle.replaceAll('&#39;', "'").replaceAll('&amp;', '&'), id);
  const avecTags = walk(dist).filter((f) => f.endsWith('.html')).filter((f) => /href="\/tags\//.test(readFileSync(f, 'utf8')));
  assert.deepEqual(avecTags, [], 'aucun lien vers /tags/');
});

/** Éléments dont le texte n'est pas montré tel quel (code, modèles, scripts…) ou garde ses balises (zones brutes) : comme lib/mots-cles-balises.mjs. */
const ZONES_BRUTES = new Set(['script', 'style', 'textarea', 'template', 'code', 'pre', 'kbd', 'samp', 'svg', 'math']);
const ATTRIBUTS_VISIBLES = ['title', 'alt', 'placeholder', 'aria-label', 'aria-description', 'data-infobulle'];
/**
 * Le texte visible d'une page (nœuds de texte, <title>, attributs montrés ou lus à l'écran), hors zones brutes (ZONES_BRUTES, [data-mots-cles-bruts]) :
 * ce qu'une balise du glossaire restée brute montrerait. `data-balise` (la balise d'un mot-clé rendu) n'est pas visible.
 */
function texteVisible(html) {
  const morceaux = [];
  const pile = [];
  let bruts = 0;
  let i = 0;
  const JETON = /<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*>|<\/?([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  for (let m = JETON.exec(html); m; m = JETON.exec(html)) {
    if (!bruts) morceaux.push(html.slice(i, m.index));
    i = JETON.lastIndex;
    const [jeton, nomBrut, attributs] = m;
    if (!nomBrut) continue;
    const nom = nomBrut.toLowerCase();
    if (jeton[1] === '/') {
      const k = pile.map((e) => e.nom).lastIndexOf(nom);
      if (k >= 0) for (const e of pile.splice(k)) bruts -= e.brut ? 1 : 0;
      continue;
    }
    const brut = ZONES_BRUTES.has(nom) || /\sdata-mots-cles-bruts(?=[\s=>/]|$)/i.test(attributs);
    if (!bruts && !brut) {
      for (const a of ATTRIBUTS_VISIBLES) {
        const v = new RegExp(`\\s${a}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attributs);
        if (v) morceaux.push(v[2] ?? v[3]);
      }
    }
    if (['script', 'style', 'textarea', 'title'].includes(nom)) {
      const fin = html.toLowerCase().indexOf(`</${nom}`, i);
      if (nom === 'title' && !bruts) morceaux.push(html.slice(i, fin < 0 ? html.length : fin));
      i = fin < 0 ? html.length : fin;
      JETON.lastIndex = i;
      continue;
    }
    if (/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(nom) || /\/\s*$/.test(attributs)) continue;
    pile.push({ nom, brut });
    bruts += brut ? 1 : 0;
  }
  if (!bruts) morceaux.push(html.slice(i));
  return morceaux.join('\n');
}

test('glossaire des mots-clés : aucune balise brute sur le site construit (le middleware est passé sur chaque page, bulles comprises) ; /donnees/ montre les valeurs telles qu’enregistrées', options, () => {
  const vocabulaire = chargerVocabulaire(ouvrirBase());
  const pages = walk(dist).filter((f) => f.endsWith('.html'));
  const restes = pages.filter((f) => {
    const html = readFileSync(f, 'utf8');
    return pageAvecMotsCles(html, vocabulaire) !== html;
  }).map((f) => relative(dist, f));
  assert.deepEqual(restes, [], 'une seconde passe du middleware ne change aucune page');
  // le texte VISIBLE de chaque page (hors zones brutes et data-balise) n'a aucune balise : « {{ » ne s'y lit nulle part
  const visibles = pages.flatMap((f) => {
    const t = texteVisible(readFileSync(f, 'utf8'));
    const k = t.indexOf('{{');
    return k < 0 ? [] : [`${relative(dist, f)} : « ${t.slice(Math.max(0, k - 40), k + 60).replace(/\s+/g, ' ')} »`];
  });
  assert.deepEqual(visibles, [], 'aucune balise brute dans le texte visible');
  assert.equal(texteVisible('<p title="a">b</p><code>{{x}}</code><div data-mots-cles-bruts><p>{{y}}</p></div><strong data-balise="{{z}}">Z</strong><title>T</title>'),
    '\na\nb\n\n\n\nZ\n\nT\n\n', 'l’aide du test : ni code, ni zone brute, ni data-balise');
  // « mot-cle-<id> » : l'id des bulles du glossaire, de nul autre élément (une page qui en aurait un autre le confondrait avec la bulle d'un mot-clé)
  const autres = pages.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/<([a-z]+)([^>]*) id="mot-cle-[^"]*"/g)]
    .filter((m) => !(m[1] === 'span' && / class="bulle"/.test(m[2]))).map((m) => `${relative(dist, f)} : ${m[0]}`));
  assert.deepEqual(autres, []);
  // les blocs des panneaux de règles écrivent des balises (migration 0056) : la table brute les garde
  const brute = 'donnees/panneau_regles_bloc/index.html';
  if (existsSync(join(dist, brute))) {
    const html = lire(brute);
    assert.match(html, /<div class="donnees-wrap" data-mots-cles-bruts>/);
    assert.match(html, /\{\{recharge-longue:\}\}/, 'la balise telle qu’enregistrée');
    assert.ok(!html.slice(html.indexOf('data-mots-cles-bruts')).includes('class="mot-cle-definition"'), 'pas rendue dans la table');
  }
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
  // une ligne de note peut citer un texte qui porte une balise du glossaire (« 2 crans de {{solidite|solidité}} ») : le site construit la rend
  // (le middleware : src/middleware.mjs), comme partout ; on compare donc au rendu pur passé par le même rendu des mots-clés
  const vocabulaire = chargerVocabulaire(db);
  const htmlDeLaNoteRendue = (...args) => htmlAvecMotsCles(htmlDeLaNote(...args), vocabulaire).html;
  // la plus récente en premier, telle que le rendu pur la donne ; les autres dans l'historique, de la plus récente à la plus ancienne
  assert.ok(main.includes(htmlDeLaNoteRendue(derniere, lignesDe(derniere.version), { niveau: 2 })), `la note de la V${derniere.version}`);
  assert.equal(main.indexOf('<article class="nv-note"'), main.indexOf(`<article class="nv-note" id="v${derniere.version.replace('.', '-')}">`));
  assert.equal(main.includes('<h2 id="nv-historique">Historique</h2>'), anciennes.length > 0);
  for (const n of anciennes) assert.ok(main.includes(htmlDeLaNoteRendue(n, lignesDe(n.version), { niveau: 3 })), `la V${n.version} dans l’historique`);
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

test('balise des pages (métriques du navigateur, page Debug) : sur chaque page sauf /maintenance/, production comprise, avec le chemin construit de la page', options, async () => {
  // décision du propriétaire du 2026-10-15 : « Active-le aussi en prod dans un premier temps » ; SITE_METRIQUES_PAGES=0 au build la retire
  const pages = walk(dist).filter((f) => f.endsWith('.html')).map((f) => relative(dist, f).split('\\').join('/'));
  const BALISE = /<script data-metriques-page="([^"]+)" data-metriques-chemin="([^"]+)">([\s\S]*?)<\/script>/;
  if (process.env.SITE_METRIQUES_PAGES === '0') {
    assert.deepEqual(pages.filter((rel) => BALISE.test(lire(rel))), [], 'SITE_METRIQUES_PAGES=0 : aucune page ne mesure');
    return;
  }
  assert.deepEqual(pages.filter((rel) => !BALISE.test(lire(rel))), ['maintenance/index.html'], 'toutes les pages, page 404 comprise, sauf la maintenance');
  for (const rel of pages.filter((r) => r !== 'maintenance/index.html')) {
    const [, adresse, chemin] = lire(rel).match(BALISE);
    assert.equal(adresse, '/api/metriques/page/', rel);
    // le chemin construit : autant de valeurs que de pages construites (une adresse inconnue sert la page 404, qui se dit « 404 »)
    if (rel.endsWith('index.html')) assert.equal(chemin, `/${rel.slice(0, -'index.html'.length)}`, rel);
    else assert.match(chemin, /^\/[^?#"]*$/, rel);
  }
  assert.match(lire('404.html').match(BALISE)[2], /^\/404\/?$/, 'la page 404 : un seul chemin, quelle que soit l’adresse demandée');
  // exécutée dans un faux navigateur : une seule mesure, en texte JSON, vers le service de CE serveur
  const [, adresse, chemin, code] = lire('races/index.html').match(BALISE);
  const envois = [];
  const evenements = {};
  vm.runInNewContext(code, {
    document: { currentScript: { getAttribute: (n) => ({ 'data-metriques-page': adresse, 'data-metriques-chemin': chemin })[n] }, readyState: 'loading', visibilityState: 'hidden', addEventListener: () => {} },
    navigator: { sendBeacon: (a, corps) => envois.push([a, corps]) },
    performance: { getEntriesByType: () => [{ responseStart: 12.345, domContentLoadedEventEnd: 50, loadEventEnd: 80 }] },
    addEventListener: (type, f) => { evenements[type] = f; },
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  evenements.pagehide();
  evenements.pagehide();
  assert.equal(envois.length, 1);
  assert.deepEqual([envois[0][0], JSON.parse(envois[0][1])], ['/api/metriques/page/', { page: '/races/', ttfb_ms: 12.35, dom_ms: 50, charge_ms: 80 }]);
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

// Les couleurs des magies en classes (lot des magies de la palette, demande du propriétaire du 2026-10-22 : « Aucune couleur en dur. », choix « Module JS
// → classe » : skill ui-couleurs, lib/palette-css.mjs) : sur toute page construite, aucune couleur de magie en style ; chaque classe de couleur posée
// existe (la palette de chaque page, ou une combinaison que la page émet).
/** Les éléments que les pages posent sur la couleur d'une magie (lot des magies de la palette). */
const ELEMENTS_DES_MAGIES = new Set([
  'magie', 'magie-teinte', 'autre-magie__onglet', 'creature__bouton', 'magies-orbite__position', 'magies-orbite__noeud', 'magies-orbite__pastille', 'magies-relation',
  'tableau-magies__col-magie', 'tableau-magies__entete', 'tableau-magies__ligne', 'tableau-magies__point', 'race-magie', 'annexe-classe__carte',
  'guide-magie', 'guide-magie__point', 'bmagie', 'bcible--magie', 'comp-magie', 'composant--magie', 'acc-gemme', 'bulle--gemme', 'perso',
]);

test('couleurs des magies : jamais en style sur une page construite, toujours par une classe de la palette qui existe', options, () => {
  const palette = classesDeLaPalette();
  const VARIABLES_DES_MAGIES = /style="[^"]*(?:--couleur-magie|--couleur-texte-magie|--mag:|--mag-texte:|--m:|--m-texte:|--g:|--g-texte:|--creature-[12]:|--magie-[12]:)/;
  const avecMagie = new Map();
  for (const fichier of walk(dist).filter((f) => f.endsWith('.html'))) {
    const rel = relative(dist, fichier);
    const html = readFileSync(fichier, 'utf8');
    assert.doesNotMatch(html, VARIABLES_DES_MAGIES, `${rel} : une couleur de magie en style`);
    // un élément de la palette, ou un élément d'une magie (même sans sa classe : une régression qui remettrait `style="--c: #…"`), n'a aucune couleur
    // en style
    for (const [balise, classe] of html.matchAll(/<[a-z][a-z0-9]*\b[^>]*\bclass="([^"]*)"[^>]*>/g)) {
      const jetons = classe.split(/\s+/);
      if (!jetons.some((c) => c.startsWith('couleur-') || ELEMENTS_DES_MAGIES.has(c))) continue;
      assert.doesNotMatch(balise, /style="[^"]*(?:#[0-9a-f]{3,6}\b|\b(?:rgba?|hsla?)\()/i, `${rel} : une couleur en style sur un élément d'une magie : ${balise}`);
    }
    const classes = new Set([...html.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith('couleur-')));
    for (const c of classes) assert.ok(palette.has(c) || html.includes(`.${c}{`), `${rel} : la classe ${c} n’existe pas`);
    if ([...classes].some((c) => c.startsWith('couleur-magie-'))) avecMagie.set(rel, html);
  }
  // chaque zone du lot pose bien les classes de ses magies
  const zones = {
    'magies/index.html': /class="magies-orbite__position [^"]* couleur-magie-feu"[\s\S]*<tr class="tableau-magies__ligne couleur-magie-feu">/,
    'magies/magie-du-feu/index.html': /<div class="magie couleur-magie-feu">/,
    'magies/potentiel-illimite/index.html': /class="onglet autre-magie__onglet couleur-magie-feu"/,
    'magies/magie-de-la-terre/index.html': /class="chip creature__bouton creature__bouton--magie couleur-magie-[\w-]+ couleur-2-magie-[\w-]+"[\s\S]*class="bmagie couleur-magie-terre"/,
    'races/index.html': /<col class="tableau-magies__col-magie couleur-magie-feu">/,
    'races/nain/index.html': /<a class="chip race-magie couleur-magie-[\w-]+"/,
    'classes/mage-bleu/index.html': /<article class="annexe-classe__carte annexe-classe__carte--magie couleur-magie-sang">/,
    'decouvrir/l-univers/index.html': /<li class="couleur-magie-feu">\s*<a class="guide-magie"/,
    'bestiaire/index.html': /class="bcible bcible--[a-z_]+ bcible--magie(?: bcible--deux)? couleur-magie-[\w-]+ couleur-2-magie-[\w-]+"/,
    'ressources/composants/index.html': /<tr class="composant composant--magie couleur-magie-[\w-]+"[\s\S]*<span class="comp-magie couleur-magie-[\w-]+">/,
    'ressources/equipement/index.html': /<span class="acc-gemme couleur-magie-[\w-]+" data-bulle=[\s\S]*<span class="bulle bulle--gemme couleur-magie-[\w-]+"/,
  };
  for (const [rel, attendu] of Object.entries(zones)) assert.match(avecMagie.get(rel) ?? '', attendu, rel);
  assert.ok([...avecMagie.values()].some((html) => /<tr class="couleur-magie-[\w-]+">\s*<th scope="row">\s*<a class="guide-magie guide-magie--ligne"/.test(html)), 'le tableau de ce que donne chaque magie (guide)');
  // la fiche et les personnages posent leurs classes au navigateur : leurs noms viennent de la page ou de regles.json (test/fiche-html.test.mjs)
  const regles = JSON.parse(lire('fiche/regles.json'));
  assert.ok(regles.magies.every((m) => palette.has(m.classe) && palette.has(m.classe_2)), 'regles.json : des classes de la palette');
});

// Lot des caractéristiques (et de leurs compétences), des postures et des alignements (même demande, mêmes choix de cadrage : skill ui-couleurs) : sur
// toute page construite, aucune de ces couleurs en style ; chaque classe posée existe (contrôle commun ci-dessus : la palette de chaque page, ou une
// feuille que la page émet, les familles d'une zone et les seconds rangs des caractéristiques compris).
/** Les éléments que les pages posent sur la couleur d'une caractéristique, d'une compétence, d'une posture ou d'un alignement. */
const ELEMENTS_DU_LOT_DES_CARACTERISTIQUES = new Set([
  'guide-carac', 'guide-competences__groupe', 'guide-posture', 'bcarac', 'arme-comp', 'metier-cible', 'metier-carac', 'alignement__resultat',
]);

test('couleurs des caractéristiques, compétences, postures et alignements : jamais en style sur une page construite, toujours par une classe qui existe', options, () => {
  const parZone = new Map();
  for (const fichier of walk(dist).filter((f) => f.endsWith('.html'))) {
    const rel = relative(dist, fichier);
    const html = readFileSync(fichier, 'utf8');
    // les variables de ces couleurs ne sont plus posées en style, nulle part
    assert.doesNotMatch(html, /style="[^"]*(?:--c-texte:|--texte-sur-c:|--c1:|--c2:)/, `${rel} : une variable de couleur du lot en style`);
    for (const [balise, classe] of html.matchAll(/<[a-z][a-z0-9]*\b[^>]*\bclass="([^"]*)"[^>]*>/g)) {
      const jetons = classe.split(/\s+/);
      if (!jetons.some((c) => /^couleur-(?:2-)?(?:caracteristique|posture|alignement)-/.test(c) || ELEMENTS_DU_LOT_DES_CARACTERISTIQUES.has(c))) continue;
      assert.doesNotMatch(balise, /\bstyle="/, `${rel} : un style sur un élément du lot : ${balise}`);
      for (const c of jetons.filter((x) => /^couleur-(?:2-)?(?:caracteristique|posture|alignement)-/.test(x))) parZone.set(c, [...(parZone.get(c) ?? []), rel]);
    }
  }
  // chaque zone du lot pose bien ses classes
  const zones = {
    'regles/les-postures/index.html': /<section class="guide-posture couleur-posture-offensif" aria-labelledby/,
    'decouvrir/creer-son-personnage/index.html': /<section class="guide-competences__groupe couleur-caracteristique-force" aria-labelledby/,
    'ressources/equipement/index.html': /<span class="arme-comp couleur-caracteristique-force couleur-2-caracteristique-force" data-competences="arme-lourde"/,
    'bestiaire/index.html': /<span class="bcarac couleur-caracteristique-force" title="Force">/,
    'fiche/index.html': /<output class="alignement__resultat teinte-palette couleur-alignement-neutre" id="alignement-resultat"/,
  };
  for (const [rel, attendu] of Object.entries(zones)) assert.match(existsSync(join(dist, rel)) ? lire(rel) : '', attendu, rel);
  assert.ok([...parZone.keys()].some((c) => c.startsWith('couleur-caracteristique-')) && parZone.has('couleur-posture-focus'), 'classes trouvées');
  assert.ok(!parZone.has('couleur-caracteristique-par-defaut'), `aucune caractéristique inconnue : ${parZone.get('couleur-caracteristique-par-defaut')}`);
  // la fiche pose ses classes au navigateur, d'après regles.json : des classes de la palette de chaque page (caractéristiques) ou de la feuille de la
  // fiche (postures, alignements)
  const regles = JSON.parse(lire('fiche/regles.json'));
  const palette = classesDeLaPalette();
  const fiche = lire('fiche/index.html');
  assert.ok([...regles.caracteristiques, regles.caracteristique_par_defaut].every((k) => palette.has(k.classe)), 'regles.json : caractéristiques');
  for (const x of [...regles.postures, ...Object.values(regles.alignements), regles.alignement_par_defaut]) assert.ok(fiche.includes(`.${x.classe}{`), `${x.classe} : dans la feuille de la fiche`);
});

// Lot des catégories de classe, des races et du reste de la fiche (même demande, mêmes choix de cadrage : skill ui-couleurs) : sur toute page construite,
// aucune de ces couleurs en style ; chaque classe posée existe (contrôle commun des magies ci-dessus : la palette de chaque page, ou une feuille que la
// page émet, les familles `classe` et `race` comprises).
/** Les éléments que les pages posent sur la couleur d'une catégorie de classe ou d'une race. */
const ELEMENTS_DU_LOT_DES_CLASSES_ET_RACES = new Set(['classe', 'classes-groupe', 'race', 'races-groupe']);
const CLASSE_DU_LOT_DES_CLASSES_ET_RACES = /^couleur-(?:classe|race|palier|mode|neutre)-/;

test('couleurs des catégories de classe, des races, des paliers, du Mode Hyper et neutre : jamais en style sur une page construite, toujours par une classe qui existe', options, () => {
  const parPage = new Map();
  for (const fichier of walk(dist).filter((f) => f.endsWith('.html'))) {
    const rel = relative(dist, fichier);
    const html = readFileSync(fichier, 'utf8');
    // les variables de ces couleurs ne sont plus posées en style, nulle part
    assert.doesNotMatch(html, /style="[^"]*(?:--couleur-classe|--couleur-texte-classe|--couleur-race|--cla:|--rac:|--r:)/, `${rel} : une variable de couleur du lot en style`);
    for (const [balise, classe] of html.matchAll(/<[a-z][a-z0-9]*\b[^>]*\bclass="([^"]*)"[^>]*>/g)) {
      const jetons = classe.split(/\s+/);
      if (!jetons.some((c) => CLASSE_DU_LOT_DES_CLASSES_ET_RACES.test(c) || ELEMENTS_DU_LOT_DES_CLASSES_ET_RACES.has(c))) continue;
      assert.doesNotMatch(balise, /\bstyle="/, `${rel} : un style sur un élément du lot : ${balise}`);
      for (const c of jetons.filter((x) => CLASSE_DU_LOT_DES_CLASSES_ET_RACES.test(x))) {
        assert.ok(html.includes(`.${c}{`), `${rel} : la classe ${c} n’est pas dans une feuille de la page`);
        parPage.set(rel, [...(parPage.get(rel) ?? []), c]);
      }
    }
  }
  // chaque zone du lot pose bien ses classes
  const zones = {
    'classes/index.html': ['couleur-classe-melee', 'couleur-classe-distance', 'couleur-classe-magiques', 'couleur-classe-raciales', 'couleur-classe-speciales'],
    'classes/guerrier/index.html': ['couleur-classe-melee'],
    'races/index.html': ['couleur-race-pure', 'couleur-race-hybride'],
    'races/humain/index.html': ['couleur-race-pure'],
  };
  for (const [rel, attendues] of Object.entries(zones)) {
    assert.ok(existsSync(join(dist, rel)), `page construite : ${rel}`);
    assert.deepEqual([...new Set(parPage.get(rel))], attendues, rel);
  }
  // la fiche pose ses classes au navigateur, d'après regles.json : toutes dans la feuille de la fiche (familles d'une zone)
  const regles = JSON.parse(lire('fiche/regles.json'));
  const fiche = lire('fiche/index.html');
  const classes = [...regles.races, ...regles.classes, ...Object.values(regles.race_par_nature), regles.neutre, ...regles.resistance_paliers,
    regles.mode_hyper, regles.mode_hyper.cent].map((x) => x.classe);
  assert.ok(classes.length > 60, `${classes.length} classes`);
  for (const c of classes) assert.ok(CLASSE_DU_LOT_DES_CLASSES_ET_RACES.test(c) && fiche.includes(`.${c}{`), `${c} : dans la feuille de la fiche`);
  assert.ok([...regles.races, ...regles.classes].every((x) => !('couleur' in x) && !('texte' in x)), 'regles.json : aucune couleur de race ni de classe');
});
