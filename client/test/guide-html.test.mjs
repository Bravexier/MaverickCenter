// Pages du guide CONSTRUITES (client/dist/decouvrir/, dist/regles/, dist/mj/ ; plan : lib/livres.mjs, demande du propriétaire du 2026-10-18 : « éclater
// le guide ») : les deux livres lus dans l'ordre (la page sur toute la largeur, une flèche de chaque côté par-dessus, grisée au bord du livre, le
// glissement du doigt, la pagination par section colorée avec le titre de chaque page en infobulle, les tableaux tirés de la base), les sommaires des
// Règles avancées, du Guide du MJ et de l'Artisanat, la page Liens ; plus rien sous /guide/.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/guide-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { decouperCorps } from '../src/lib/markdown-edition.mjs';
import { ARTISANAT, groupesDesReglesAvancees, GUIDE_DU_MJ, LIENS, LIVRES, pagesDuLivre } from '../src/lib/livres.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'decouvrir', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => {
  const html = readFileSync(join(dist, chemin, 'index.html'), 'utf8');
  return { html, main: html.slice(html.indexOf('<main'), html.indexOf('</main>')), ids: [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]) };
};
const vide = { html: '', main: '', ids: [] };
const decouvrir = present ? lire('decouvrir') : vide;
const numeros = (main) => [...main.matchAll(/class="guide-pagination__numero" href="([^"]+)"[^>]*?aria-label="Chapitre (\d+) : ([^"]+)"/g)].map((m) => ({ href: m[1], n: Number(m[2]), titre: m[3] }));
const sections = (main) => [...main.matchAll(/<li class="guide-pagination__partie" style="--couleur-partie: (#[0-9a-f]{6})"><span class="guide-pagination__titre">([^<]+)</g)].map((m) => [m[2], m[1]]);
const sansStyles = (main) => main.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
const db = ouvrirBase({ sansExemples: false });
const pagesConstruites = db.prepare("SELECT id, titre, resume, corps_md, statut FROM page WHERE type = 'guide'").all()
  .filter((p) => existsSync(join(dist, cheminDePage(p.id), 'index.html')))
  .map((p) => ({ ...p, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const echappe = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

test('plus rien sous /guide/ : /decouvrir/ est la première page du livre Découvrir, flèche gauche grisée, flèche droite vers la page 2, 11 numéros en trois sections', options, () => {
  assert.ok(!existsSync(join(dist, 'guide')), 'pas de dossier dist/guide/');
  assert.match(decouvrir.main, /<h1 id="guide-titre"[^>]*>Bienvenue dans Maverick<\/h1>/);
  assert.match(decouvrir.main, /<p class="guide-numero"><span class="guide-partie">Découvrir<\/span> chapitre 1 sur 11<\/p>/);
  assert.match(decouvrir.main, /<span class="guide-fleche guide-fleche--precedent" role="link" aria-disabled="true"/);
  assert.match(decouvrir.main, /<a class="guide-fleche guide-fleche--suivant" href="\/decouvrir\/le-jeu-de-role\/" rel="next"/);
  const pagination = numeros(decouvrir.main);
  assert.deepEqual(pagination.map((p) => p.n), Array.from({ length: 11 }, (_, i) => i + 1));
  assert.deepEqual(pagination.map((p) => p.href), pagesDuLivre(LIVRES[0]).map((p) => `/${cheminDePage(p.id)}`));
  assert.equal(pagination[0].href, '/decouvrir/', 'la page 1 est servie à /decouvrir/');
  assert.ok(!existsSync(join(dist, 'decouvrir', 'bienvenue')), 'pas de page /decouvrir/bienvenue/');
  assert.match(decouvrir.main, /aria-current="page"[^>]*>\s*1\s*</);
  assert.deepEqual(sections(decouvrir.main), [['Découvrir', '#2a6f97'], ['Créer son personnage', '#2e7d4f'], ['Rejoindre une partie', '#b03030']]);
  assert.match(decouvrir.main, /<nav class="guide-bas" aria-label="Chapitres : Découvrir">/);
  for (const [, id] of decouvrir.main.matchAll(/class="guide-pagination__numero"[^>]*data-bulle="([^"]+)"/g)) assert.ok(decouvrir.ids.includes(id), `infobulle ${id} absente`);
});

test('le livre Découvrir s’arrête à « Rejoindre une partie » ; Les bases (/regles/) : 12 numéros en trois sections, ses propres voisins', options, () => {
  const dernier = lire('decouvrir/campagne-ou-scenario-one-shot');
  assert.match(dernier.main, /<span class="guide-fleche guide-fleche--suivant" role="link" aria-disabled="true"/);
  assert.match(dernier.main, /<a class="guide-fleche guide-fleche--precedent" href="\/decouvrir\/finaliser-son-personnage\/" rel="prev"/);
  assert.match(dernier.main, /class="guide-partie">Rejoindre une partie<\/span> Découvrir · chapitre 11 sur 11</);
  // la dernière page n'est pas un cul-de-sac : le lien du bas mène à la suite du plan (lib/livres.mjs#suiteDuLivre), la flèche reste grisée
  assert.match(dernier.main, /<a class="guide-voisin guide-voisin--suivant guide-voisin--suite" href="\/regles\/" data-guide-suite>\s*<span class="guide-voisin__sens">Suivant ›<\/span>\s*<span class="guide-voisin__titre">Les bases<\/span>/);
  assert.doesNotMatch(dernier.main, /<a [^>]*data-guide-suivant/, 'ni ← → ni le doigt ne passent dans Les bases');
  const bases = lire('regles');
  assert.match(bases.main, /<h1 id="guide-titre"[^>]*>Réussir une action<\/h1>/);
  assert.match(bases.main, /<span class="guide-fleche guide-fleche--precedent" role="link" aria-disabled="true"/, 'première page des bases : rien avant');
  assert.deepEqual(numeros(bases.main).map((p) => p.href), pagesDuLivre(LIVRES[1]).map((p) => `/${cheminDePage(p.id)}`));
  assert.deepEqual(sections(bases.main), [['Jouer', '#b03030'], ['Progresser', '#6a4a9c'], ['Pour aller plus loin', '#5a6470']]);
  const degats = lire('regles/les-degats');
  assert.match(degats.main, /<a class="guide-fleche guide-fleche--precedent" href="\/regles\/l-equipement\/" rel="prev"/);
  assert.match(degats.main, /<a class="guide-fleche guide-fleche--suivant" href="\/regles\/les-postures\/" rel="next"/);
  assert.match(degats.main, /class="guide-partie">Jouer<\/span> Les bases · chapitre 5 sur 12</);
  const lexique = lire('regles/lexique');
  assert.match(lexique.main, /<span class="guide-fleche guide-fleche--suivant" role="link" aria-disabled="true"/, 'dernière page des bases');
  assert.match(lexique.main, /<a class="guide-voisin guide-voisin--suivant guide-voisin--suite" href="\/regles\/avancees\/" data-guide-suite>\s*<span class="guide-voisin__sens">Suivant ›<\/span>\s*<span class="guide-voisin__titre">Règles avancées<\/span>/);
  assert.doesNotMatch(lexique.main, /<a [^>]*data-guide-suivant/);
  // une page qui a une suivante dans son livre : pas de lien de suite
  assert.doesNotMatch(degats.main, /<a [^>]*data-guide-suite/);
  assert.match(degats.main, /<a [^>]*data-guide-suivant/);
});

test('sur écran tactile, glisser le doigt tourne la page, sans que le navigateur ajoute un retour dans l’historique', options, () => {
  const { main } = lire('regles/les-degats');
  for (const evenement of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) assert.match(main, new RegExp(`addEventListener\\('${evenement}', function \\(e?\\) \\{[\\s\\S]*?\\}, \\{ passive: true \\}\\)`), evenement);
  assert.match(main, /dx < 0 \? '\[data-guide-suivant\]' : '\[data-guide-precedent\]'/, 'vers la gauche : page suivante ; vers la droite : précédente');
  assert.match(main, /closest\('input, textarea, select, \[contenteditable\], \.guide-defile'\)/, 'pas sur un tableau qui défile ni dans un champ');
  assert.match(main, /t\.clientX < 24 \|\| t\.clientX > window\.innerWidth - 24/, 'pas depuis le bord de l’écran (gestes du système)');
  assert.match(main, /html \{ overscroll-behavior-x: none; \}/, 'Chrome ne fait pas du même geste un retour arrière');
});

test('la page prend toute la largeur : les flèches passent par-dessus, en bas de l’écran, et s’effacent quand les liens du bas arrivent', options, () => {
  const { main } = lire('decouvrir/l-univers');
  assert.match(main, /\.guide-cadre \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\);\s*\}/, 'une seule colonne : plus de colonnes pour les flèches');
  assert.match(main, /\.guide-cadre > \* \{ grid-area: 1 \/ 1; \}/, 'page et flèches dans la même case');
  assert.match(main, /\.guide-fleche \{\s*position: sticky;\s*bottom: 1\.5rem;/, 'flèches collées en bas de l’écran');
  assert.match(main, /\.guide\[data-bas-visible\] \.guide-fleche \{ opacity: 0; visibility: hidden; \}/);
  assert.match(main, /new IntersectionObserver\(function \(entrees\) \{\s*guide\.toggleAttribute\('data-bas-visible'[\s\S]*?\}\)\.observe\(bas\)/, 'effacées dès que les liens du bas sont à l’écran');
  assert.doesNotMatch(main, /\.guide-texte \{ max-width/, 'le texte n’a plus sa colonne étroite');
  assert.match(main, /main \{ overflow-x: clip; \}/, 'la page qui suit le doigt n’élargit pas l’écran');
});

test('les tableaux viennent de la base : progression, postures, compétences, personnages fil rouge', options, () => {
  const niveaux = lire('regles/la-montee-de-niveau').main;
  assert.equal((niveaux.match(/<tr>\s*<th scope="row">\d+<\/th>/g) ?? []).length, 20);
  assert.match(niveaux, /460\s250/, 'XP du niveau 20 (espace fine insécable de toLocaleString)');
  const postures = lire('regles/les-postures').main;
  assert.equal((postures.match(/class="guide-posture__nom"/g) ?? []).length, 6);
  const competences = lire('decouvrir/caracteristiques-et-competences').main;
  assert.equal((competences.match(/class="guide-competences__groupe"/g) ?? []).length, 6);
  // chacune dans sa couleur (demande du propriétaire, lib/caracteristiques-postures.mjs)
  assert.deepEqual([...postures.matchAll(/class="guide-posture" style="--c: (#[0-9a-f]{6}); --c-texte: #171210"/g)].map((m) => m[1]),
    ['#ff6666', '#99ff99', '#eeeeee', '#9999ff', '#ffff66', '#cc66ff'], 'Offensif, Défensif, Neutre, Focus, Vigilance, Symbiose');
  assert.deepEqual([...competences.matchAll(/class="guide-competences__groupe" style="--c: (#[0-9a-f]{6}); --c-texte: #171210"/g)].map((m) => m[1]),
    ['#ff6666', '#ff99ff', '#66ccff', '#ffcc00', '#dddddd', '#99ff66'], 'Force, Volonté, Intelligence, Perception, Social, Agilité');
  assert.match(lire('decouvrir/choisir-ses-magies').main, /<span class="guide-carac" style="--c: #dddddd; --c-texte: #171210">Social<\/span>/, '+1 en Social du Feu');
  const attributs = lire('decouvrir/finaliser-son-personnage').main;
  assert.equal((attributs.match(/class="guide-fil-rouge__perso"/g) ?? []).length, 4);
  assert.match(attributs, /20 de la race \+ 9 de la classe \+ 10 de la magie = 39/, 'santé du guerrier orios');
  assert.doesNotMatch(lire('decouvrir/creer-son-personnage').main, /à préciser/, 'les quatre magies innées sont connues');
});

test('sous « L’univers », et sous elle seule, la navigation vers Races, Magies et Classes (leurs titres, rien d’autre)', options, () => {
  const univers = lire('decouvrir/l-univers').main;
  const nav = univers.match(/<nav class="guide-rubriques" aria-label="Rubriques">([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'bloc de navigation absent');
  assert.deepEqual([...nav[1].matchAll(/<a class="guide-rubriques__lien" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]),
    [['/races/', 'Races'], ['/magies/', 'Magies'], ['/classes/', 'Classes']]);
  assert.equal(sansStyles(nav[1]).replace(/<[^>]+>/g, '').trim(), 'RacesMagiesClasses', 'aucun autre texte');
  for (const chemin of ['decouvrir', 'decouvrir/le-jeu-de-role', 'regles', 'regles/les-degats']) assert.doesNotMatch(sansStyles(lire(chemin).main), /class="guide-rubriques"/, chemin);
});

test('le sommaire de « Bienvenue » : les dix autres pages de Découvrir par section, puis Les bases et Règles avancées', options, () => {
  const sommaire = decouvrir.main.slice(decouvrir.main.indexOf('<div class="guide-sommaire">'));
  const liens = [...sommaire.matchAll(/<a class="guide-sommaire__lien" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(liens, [...pagesDuLivre(LIVRES[0]).slice(1).map((p) => `/${cheminDePage(p.id)}`), '/regles/', '/regles/avancees/']);
  assert.deepEqual([...sommaire.matchAll(/<h3 class="guide-sommaire__titre-partie">([^<]+)<\/h3>/g)].map((m) => m[1]),
    ['Découvrir', 'Créer son personnage', 'Rejoindre une partie', 'Règles']);
  for (const p of pagesConstruites.filter((x) => pagesDuLivre(LIVRES[0]).slice(1).some((l) => l.id === x.id))) {
    assert.ok(sommaire.includes(`<span class="guide-sommaire__titre">${echappe(p.titre)}</span>`), `${p.id} : titre`);
  }
});

test('/regles/avancees/ : les sept groupes dans l’ordre, chaque page liée avec son résumé (s’il y en a un), rien d’autre', options, () => {
  const { main } = lire('regles/avancees');
  assert.match(main, /<h1>Règles avancées<\/h1>/);
  const groupes = groupesDesReglesAvancees(pagesConstruites);
  assert.deepEqual([...main.matchAll(/<section class="sommaire" id="([^"]+)"[^>]*><h2 id="[^"]+">([^<]+)<\/h2>/g)].map((m) => [m[1], m[2]]),
    groupes.map((g) => [g.id, g.titre]));
  assert.equal(groupes.length, 7);
  const lignes = [...main.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a>(?:<div class="muted">([\s\S]*?)<\/div>)?<\/li>/g)];
  assert.deepEqual(lignes.map((m) => m[1]), groupes.flatMap((g) => g.pages.map((p) => `/${cheminDePage(p.id)}`)));
  for (const [, href, , resume] of lignes) {
    const p = pagesConstruites.find((x) => `/${cheminDePage(x.id)}` === href);
    assert.equal(Boolean(resume), Boolean(p.resume), `${p.id} : résumé`);
  }
  for (const id of ['guide/les-pieges', 'guide/les-portes', 'guide/meteo', 'guide/donjon-pas-bon']) assert.ok(lignes.some((m) => m[1] === `/${cheminDePage(id)}`), id);
});

test('une page des Règles avancées : fil d’Ariane vers son groupe, texte coupé à ses blocs (modifiable morceau par morceau), mots-clés, rétroliens, sources ; pas le chrome du livre', options, () => {
  for (const id of ['guide/le-mode-hyper', 'guide/les-documents-des-regles', 'guide/meteo']) {
    const p = pagesConstruites.find((x) => x.id === id);
    const { main } = lire(cheminDePage(id));
    assert.match(main, /<p class="muted"><a href="\/">Accueil<\/a> › <a href="\/regles\/avancees\/">Règles avancées<\/a> › <a href="\/regles\/avancees\/#[a-z-]+">[^<]+<\/a><\/p>/, id);
    assert.match(main, new RegExp(`<div class="guide-reference" data-ed-corps="${id}">`), id);
    const visibles = decouperCorps(p.corps_md).filter((m) => m.visible).length;
    assert.equal((main.match(/data-ed-morceau/g) ?? []).length, visibles, `${id} : un morceau modifiable par morceau visible`);
    assert.match(main, /<h2>Sources<\/h2>/, id);
    assert.doesNotMatch(main, /class="guide-pagination|overscroll-behavior-x|main \{ overflow-x: clip; \}/, `${id} : pas le chrome du livre`);
  }
  // le bloc des documents : les pages de référence par document, liées à leur nouvelle adresse, sans les pages des livres
  const documents = lire('regles/avancees/les-documents-des-regles').main;
  assert.match(documents, /<div class="guide-references">/);
  const liees = [...documents.matchAll(/<section class="guide-references__groupe">[\s\S]*?<\/section>/g)].flatMap((s) => [...s[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(liees.length > 20 && liees.every((h) => /^\/(?:regles\/avancees|mj)\//.test(h)), 'seulement des pages de référence');
  const hyper = lire('regles/avancees/le-mode-hyper').main;
  assert.match(hyper, /<h1><span data-ed="[^"]+">Le Mode Hyper et le Mode Super<\/span> <span class="badge">Guide<\/span><\/h1>/);
  assert.match(hyper, /class="tags"|Cette page mentionne|Mentionnée par/, 'mots-clés ou pages liées');
});

test('une page de livre n’a ni fil d’Ariane, ni mots-clés, ni pages liées sous le texte', options, () => {
  const page = lire('regles/le-tour-de-jeu').main;
  assert.doesNotMatch(page, /Accueil<\/a> ›/);
  assert.doesNotMatch(page, /class="tags"/);
  assert.doesNotMatch(page, /Cette page mentionne|Mentionnée par/);
  assert.match(page, /<article class="guide-page" aria-labelledby="guide-titre" data-ed-corps="guide\/le-tour-de-jeu">/);
  // les liens écrits vers les anciennes adresses /guide/… mènent aux nouvelles
  assert.match(page, /href="\/regles\/les-postures\/"/);
});

test('/mj/ et /regles/artisanat/ : le titre et le résumé de chaque page, liés ; Composants dans l’Artisanat', options, () => {
  const mj = lire('mj').main;
  assert.match(mj, /<h1>Guide du MJ<\/h1>/);
  assert.deepEqual([...mj.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]), GUIDE_DU_MJ.pages.map((id) => `/${cheminDePage(id)}`));
  for (const id of GUIDE_DU_MJ.pages) {
    const page = lire(cheminDePage(id)).main;
    assert.match(page, /<p class="muted"><a href="\/">Accueil<\/a> › <a href="\/mj\/">Guide du MJ<\/a>\s*<\/p>/, id);
  }
  const artisanat = lire('regles/artisanat').main;
  assert.match(artisanat, /<h1>Artisanat<\/h1>/);
  const liens = [...artisanat.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><div class="muted">/g)].map((m) => [m[1], m[2]]);
  assert.equal(liens.length, ARTISANAT.pages.length, 'cinq pages, chacune avec son résumé');
  assert.deepEqual(liens[0], ['/ressources/composants/', 'Composants']);
  assert.deepEqual(liens.slice(1).map((l) => l[0]), ARTISANAT.pages.slice(1).map((id) => `/${cheminDePage(id)}`));
});

test('/decouvrir/liens/ : le serveur Discord et la page Tipeee, rien d’autre que leurs libellés et le titre', options, () => {
  const { main } = lire('decouvrir/liens');
  assert.deepEqual([...main.matchAll(/<a href="([^"]+)" rel="noopener">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]), LIENS.liens.map((l) => [l.url, l.libelle]));
  assert.equal(sansStyles(main).replace(/<[^>]+>/g, '').replace(/\s+/g, ''), `Liens${LIENS.liens.map((l) => l.libelle).join('')}`.replace(/\s+/g, ''));
});
