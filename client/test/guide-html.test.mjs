// Pages du guide CONSTRUITES (client/dist/decouvrir/, dist/regles/, dist/mj/ ; plan : lib/livres.mjs ; demandes du propriétaire du 2026-10-18 : « éclater
// le guide », puis « refaire toutes les anciennes pages du guide. Retirer le mécanisme de swipe, et les flèches suivant / précédent et la pagination ») :
// chaque page du guide est une page simple (fil d'Ariane vers sa rubrique ou son sommaire, titre, texte et blocs tirés de la base, mots-clés,
// rétroliens, sources), sans flèches, ni pagination, ni glissement du doigt ; les pages de Découvrir et des Bases dans la couleur de leur groupe ; les
// sommaires des Bases, des Règles avancées, du Guide du MJ et de l'Artisanat ; la page Liens et l'encart « Notre prochaine rencontre IRL » ; plus rien
// sous /guide/, plus rien aux adresses des pages fusionnées.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/guide-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerAnnonce } from '../src/lib/annonces.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { morceauxDuChapitre } from '../src/lib/guide.mjs';
import { decouperCorps } from '../src/lib/markdown-edition.mjs';
import {
  ARTISANAT, couleurDeLaPage, DECOUVRIR, estDansDecouvrirOuLesBases, groupesDesBases, groupesDesReglesAvancees, GUIDE_DU_MJ, LES_BASES, LIENS,
  PAGES_ABSORBEES, pagesDeLaRubrique,
} from '../src/lib/livres.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'decouvrir', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => {
  const html = readFileSync(join(dist, chemin, 'index.html'), 'utf8');
  return { html, main: html.slice(html.indexOf('<main'), html.indexOf('</main>')), ids: [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]) };
};
const sansStyles = (main) => main.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
const db = ouvrirBase({ sansExemples: false });
const pagesConstruites = db.prepare("SELECT id, titre, resume, corps_md, statut FROM page WHERE type = 'guide'").all()
  .filter((p) => existsSync(join(dist, cheminDePage(p.id), 'index.html')))
  .map((p) => ({ ...p, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const pageDe = (id) => pagesConstruites.find((p) => p.id === id);
const echappe = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** La page qui appelle un bloc (`<!-- guide:<bloc> -->`) : chaque bloc est appelé une fois dans tout le guide (test/guide.test.mjs). */
const pageDuBloc = (bloc) => pagesConstruites.find((p) => morceauxDuChapitre(p.corps_md).some((m) => m.bloc === bloc));

test('plus rien sous /guide/, ni aux adresses des pages fusionnées ; /decouvrir/ est Bienvenue, sans sommaire', options, () => {
  assert.ok(!existsSync(join(dist, 'guide')), 'pas de dossier dist/guide/');
  for (const ancienne of Object.keys(PAGES_ABSORBEES)) assert.ok(!existsSync(join(dist, 'decouvrir', ancienne.slice('guide/'.length))), `${ancienne} : plus construite`);
  assert.ok(!existsSync(join(dist, 'decouvrir', 'campagne-ou-scenario-one-shot')), 'la page du MJ n’est plus dans Découvrir');
  assert.ok(existsSync(join(dist, 'mj', 'campagne-ou-scenario-one-shot', 'index.html')), '… elle est dans le Guide du MJ');
  assert.ok(!existsSync(join(dist, 'decouvrir', 'bienvenue')), 'pas de page /decouvrir/bienvenue/');
  const { main } = lire('decouvrir');
  assert.match(main, new RegExp(`<h1 id="guide-titre"><span data-ed="[^"]+">${echappe(pageDe('guide/bienvenue').titre)}</span>\\s*</h1>`));
  assert.doesNotMatch(main, /guide-sommaire/, 'plus de sommaire dans Bienvenue (demande du propriétaire du 2026-10-18)');
});

test('chaque page du guide est une page simple : ni flèches, ni pagination, ni ← →, ni glissement du doigt ; titre, texte, sources (pages de référence seulement)', options, () => {
  assert.ok(pagesConstruites.length > 50, `${pagesConstruites.length} pages construites`);
  for (const p of pagesConstruites) {
    const { main } = lire(cheminDePage(p.id));
    assert.doesNotMatch(main, /guide-fleche|guide-pagination|guide-voisin|guide-page|data-guide-(?:suivant|precedent|suite)/, `${p.id} : le chrome du livre`);
    assert.doesNotMatch(main, /touchstart|ArrowLeft|overscroll-behavior-x|overflow-x: clip/, `${p.id} : ni geste, ni clavier, ni réglage de défilement du livre`);
    assert.match(main, /<h1 id="guide-titre">/, p.id);
    // le corps modifiable sur le site de dev, morceau par morceau ; une page d'exemple (HIDE_EXAMPLES=1 la retire) ne se modifie pas
    const modifiable = p.statut !== 'example';
    assert.match(main, modifiable ? new RegExp(`<div class="guide-corps" data-ed-corps="${p.id}">`) : /<div class="guide-corps">/, `${p.id} : le corps`);
    const visibles = decouperCorps(p.corps_md).filter((m) => m.visible).length;
    assert.equal((main.match(/data-ed-morceau/g) ?? []).length, modifiable ? visibles : 0, `${p.id} : un morceau modifiable par morceau visible`);
    // les sources sous le texte : les pages de référence seulement ; une page de Découvrir ou des Bases n'en cite pas, comme ses anciennes pages de livre
    assert.equal(/<h2>Sources<\/h2>/.test(main), !estDansDecouvrirOuLesBases(p.id), `${p.id} : sources`);
    // aucun lien vers une ancienne adresse : ni /guide/, ni une page fusionnée
    for (const [, href] of main.matchAll(/href="([^"]+)"/g)) {
      assert.doesNotMatch(href, /^\/guide\//, `${p.id} : ${href}`);
      for (const ancienne of Object.keys(PAGES_ABSORBEES)) assert.ok(!href.startsWith(`/decouvrir/${ancienne.slice('guide/'.length)}/`), `${p.id} : ${href}`);
    }
  }
});

test('le fil d’Ariane : Découvrir pour ses pages, Les bases et le groupe, Règles avancées et le groupe, Guide du MJ ; la couleur du groupe sur les pages de Découvrir et des Bases', options, () => {
  const fil = (chemin) => sansStyles(lire(chemin).main).match(/<p class="muted guide-fil">([\s\S]*?)<\/p>/)?.[1].replace(/\s+/g, ' ').trim();
  assert.equal(fil('decouvrir'), '<a href="/">Accueil</a> › <a href="/decouvrir/" aria-current="page">Découvrir</a>');
  assert.equal(fil('decouvrir/creer-son-personnage'), '<a href="/">Accueil</a> › <a href="/decouvrir/">Découvrir</a>');
  assert.equal(fil('regles/les-degats'), '<a href="/">Accueil</a> › <a href="/regles/">Les bases</a> › <a href="/regles/#jouer">Jouer</a>');
  assert.equal(fil('regles/lexique'), '<a href="/">Accueil</a> › <a href="/regles/">Les bases</a> › <a href="/regles/#plus-loin">Pour aller plus loin</a>');
  assert.equal(fil('regles/avancees/meteo'), '<a href="/">Accueil</a> › <a href="/regles/avancees/">Règles avancées</a> › <a href="/regles/avancees/#exploration-et-voyage">Exploration et voyage</a>');
  assert.equal(fil('mj/campagne-ou-scenario-one-shot'), '<a href="/">Accueil</a> › <a href="/mj/">Guide du MJ</a>');
  for (const p of pagesConstruites) {
    const { main } = lire(cheminDePage(p.id));
    const couleur = couleurDeLaPage(p.id);
    if (couleur) assert.match(main, new RegExp(`<div class="guide-reference guide-reference--couleur" style="--couleur-partie: ${couleur}">`), p.id);
    else assert.match(main, /<div class="guide-reference">/, p.id);
    // le badge « Guide » sur les pages de référence seulement (comme avant)
    assert.equal(/<span class="badge">Guide<\/span><\/h1>/.test(main.replace(/\s+<\/h1>/, '</h1>')), !estDansDecouvrirOuLesBases(p.id), `${p.id} : badge`);
  }
  // une page écrite pour le site a aussi son pied de page : mots-clés et pages liées (ses sources restent dans le frontmatter)
  assert.match(lire('decouvrir/creer-son-personnage').main, /class="tags"|Cette page mentionne|Mentionnée par/);
});

test('/regles/ : le sommaire des Bases, trois groupes dans leur couleur, chaque page liée avec son résumé', options, () => {
  const { main } = lire('regles');
  assert.match(main, /<h1>Les bases<\/h1>/);
  const groupes = groupesDesBases(pagesConstruites);
  assert.deepEqual([...main.matchAll(/<section class="sommaire sommaire--couleur" id="([^"]+)" style="--sommaire-couleur: (#[0-9a-f]{6})"[^>]*><h2 id="[^"]+">([^<]+)<\/h2>/g)].map((m) => [m[1], m[2], m[3]]),
    LES_BASES.groupes.map((g) => [g.id, g.couleur, g.titre]));
  const lignes = [...main.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a>(?:<div class="muted">([\s\S]*?)<\/div>)?<\/li>/g)];
  assert.deepEqual(lignes.map((m) => m[1]), groupes.flatMap((g) => g.pages.map((p) => `/${cheminDePage(p.id)}`)));
  assert.equal(lignes.length, 12);
  assert.ok(lignes.every((m) => m[3]), 'chaque page des Bases a son résumé');
  assert.doesNotMatch(main, /guide-titre|guide-corps/, 'un sommaire, pas une page du guide');
});

test('les tableaux viennent de la base : progression, postures, compétences, magies, personnages fil rouge (la page qui appelle le bloc)', options, () => {
  const lireBloc = (bloc) => lire(cheminDePage(pageDuBloc(bloc).id)).main;
  const niveaux = lireBloc('niveaux');
  assert.equal((niveaux.match(/<tr>\s*<th scope="row">\d+<\/th>/g) ?? []).length, 20);
  assert.match(niveaux, /460\s250/, 'XP du niveau 20 (espace fine insécable de toLocaleString)');
  const postures = lireBloc('postures');
  assert.equal((postures.match(/class="guide-posture__nom"/g) ?? []).length, 6);
  // chacune dans sa couleur (demande du propriétaire, lib/caracteristiques-postures.mjs)
  assert.deepEqual([...postures.matchAll(/class="guide-posture" style="--c: (#[0-9a-f]{6}); --c-texte: #171210"/g)].map((m) => m[1]),
    ['#ff6666', '#99ff99', '#eeeeee', '#9999ff', '#ffff66', '#cc66ff'], 'Offensif, Défensif, Neutre, Focus, Vigilance, Symbiose');
  const competences = lireBloc('competences');
  assert.equal((competences.match(/class="guide-competences__groupe"/g) ?? []).length, 6);
  assert.deepEqual([...competences.matchAll(/class="guide-competences__groupe" style="--c: (#[0-9a-f]{6}); --c-texte: #171210"/g)].map((m) => m[1]),
    ['#ff6666', '#ff99ff', '#66ccff', '#ffcc00', '#dddddd', '#99ff66'], 'Force, Volonté, Intelligence, Perception, Social, Agilité');
  assert.match(lireBloc('magie-bonus'), /<span class="guide-carac" style="--c: #dddddd; --c-texte: #171210">Social<\/span>/, '+1 en Social du Feu');
  const attributs = lireBloc('fil-rouge-attributs');
  assert.ok((attributs.match(/class="guide-fil-rouge__perso"/g) ?? []).length >= 4);
  assert.match(attributs, /20 de la race \+ 9 de la classe \+ 10 de la magie = 39/, 'santé du guerrier orios');
  assert.doesNotMatch(lireBloc('fil-rouge'), /<em>à préciser<\/em>/, 'les quatre magies innées sont connues');
  assert.equal(pageDuBloc('documents').id, 'guide/les-documents-des-regles');
});

test('sous « L’univers », et sous elle seule, la navigation vers Races, Magies et Classes (leurs titres, rien d’autre)', options, () => {
  const univers = lire('decouvrir/l-univers').main;
  const nav = univers.match(/<nav class="guide-rubriques" aria-label="Rubriques">([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'bloc de navigation absent');
  assert.deepEqual([...nav[1].matchAll(/<a class="guide-rubriques__lien" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]),
    [['/races/', 'Races'], ['/magies/', 'Magies'], ['/classes/', 'Classes']]);
  assert.equal(sansStyles(nav[1]).replace(/<[^>]+>/g, '').trim(), 'RacesMagiesClasses', 'aucun autre texte');
  for (const p of pagesConstruites.filter((x) => x.id !== 'guide/l-univers')) assert.doesNotMatch(sansStyles(lire(cheminDePage(p.id)).main), /class="guide-rubriques"/, p.id);
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
  // le bloc des documents : les pages de référence par document, liées à leur nouvelle adresse, sans les pages de Découvrir ni des Bases
  const documents = lire('regles/avancees/les-documents-des-regles').main;
  assert.match(documents, /<div class="guide-references">/);
  const liees = [...documents.matchAll(/<section class="guide-references__groupe">[\s\S]*?<\/section>/g)].flatMap((s) => [...s[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(liees.length > 20 && liees.every((h) => /^\/(?:regles\/avancees|mj)\//.test(h)), 'seulement des pages de référence');
});

test('/mj/ et /regles/artisanat/ : le titre et le résumé de chaque page, liés ; « Campagne » ou « Scénario one shot » dans le Guide du MJ ; Composants dans l’Artisanat', options, () => {
  const mj = lire('mj').main;
  assert.match(mj, /<h1>Guide du MJ<\/h1>/);
  assert.deepEqual([...mj.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]), GUIDE_DU_MJ.pages.map((id) => `/${cheminDePage(id)}`));
  assert.ok(GUIDE_DU_MJ.pages.includes('guide/campagne-ou-scenario-one-shot'));
  const artisanat = lire('regles/artisanat').main;
  assert.match(artisanat, /<h1>Artisanat<\/h1>/);
  const liens = [...artisanat.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><div class="muted">/g)].map((m) => [m[1], m[2]]);
  assert.equal(liens.length, ARTISANAT.pages.length, 'cinq pages, chacune avec son résumé');
  assert.deepEqual(liens[0], ['/ressources/composants/', 'Composants']);
  assert.deepEqual(liens.slice(1).map((l) => l[0]), ARTISANAT.pages.slice(1).map((id) => `/${cheminDePage(id)}`));
});

test('Découvrir : une page par entrée du menu, dans l’ordre ; « Rejoindre une partie » est une page à elle', options, () => {
  assert.deepEqual(pagesDeLaRubrique(DECOUVRIR).map((p) => `/${cheminDePage(p.id)}`),
    ['/decouvrir/', '/decouvrir/l-univers/', '/decouvrir/creer-son-personnage/', '/decouvrir/rejoindre-une-partie/']);
  for (const { id } of pagesDeLaRubrique(DECOUVRIR)) assert.ok(pageDe(id), `${id} : construite`);
  const accueil = lire('decouvrir').html;
  const menu = accueil.slice(accueil.indexOf('<header'), accueil.indexOf('</header>'));
  for (const chemin of ['/decouvrir/', '/decouvrir/l-univers/', '/decouvrir/creer-son-personnage/', '/decouvrir/rejoindre-une-partie/', '/decouvrir/liens/']) {
    assert.ok(menu.includes(`href="${chemin}"`), `menu : ${chemin}`);
  }
});

test('/decouvrir/liens/ : le serveur Discord et la page Tipeee (leur présentation quand elle est écrite), puis l’encart « Notre prochaine rencontre IRL »', options, () => {
  const { main } = lire('decouvrir/liens');
  const corps = sansStyles(main);
  // le fil d'Ariane vers Découvrir, comme les autres pages de la rubrique
  assert.match(corps, /<p class="muted"><a href="\/">Accueil<\/a> › <a href="\/decouvrir\/">Découvrir<\/a><\/p>\s*<h1>Liens<\/h1>/);
  // chaque lien sous son titre (h2, au niveau de l'encart)
  assert.deepEqual([...corps.matchAll(/<h2 class="liens__titre" id="lien-([a-z]+)-titre"><a class="liens__lien" href="([^"]+)" rel="noopener">([^<]+)<\/a><\/h2>/g)].map((m) => [m[1], m[2], m[3]]),
    LIENS.liens.map((l) => [l.id, l.url, l.libelle]));
  for (const l of LIENS.liens) {
    const element = corps.match(new RegExp(`<section class="liens__element" id="lien-${l.id}" aria-labelledby="lien-${l.id}-titre">([\\s\\S]*?)</section>`))?.[1] ?? '';
    assert.equal(element.includes('class="prose liens__presentation"'), Boolean(l.presentation), `${l.id} : sa présentation, si elle est écrite`);
  }
  // l'encart : le titre fixe, l'annonce de la base ou le texte d'attente ; la zone modifiable sur le site de dev
  assert.match(corps, /<section class="annonce" id="prochaine-rencontre" aria-labelledby="prochaine-rencontre-titre">\s*<h2 class="annonce__titre" id="prochaine-rencontre-titre">Notre prochaine rencontre IRL<\/h2>/);
  const zone = corps.match(/<div class="prose annonce__texte"([^>]*)>([\s\S]*?)<\/div>\s*<\/section>/);
  assert.ok(zone, 'la zone de l’annonce');
  assert.match(zone[1], /data-annonce="prochaine-rencontre-irl"/);
  assert.match(zone[1], /data-annonce-vide="Aucune rencontre annoncée pour le moment\."/);
  const annonce = chargerAnnonce(db, LIENS.rencontre.annonce);
  if (annonce.texte) assert.doesNotMatch(zone[2], /annonce__vide/);
  else assert.equal(zone[2].trim(), '<p class="annonce__vide">Aucune rencontre annoncée pour le moment.</p>');
  // le mode modification du site de dev se propose sur la page (components/edition/Edition.astro, hors de <main>)
  assert.match(lire('decouvrir/liens').html, /<div data-edition data-api="\/api\/" data-page="decouvrir\/liens\/"/);
  // rien d'autre : le titre, les libellés, les présentations, l'encart
  const textes = ['Accueil', '›', 'Découvrir', LIENS.titre, ...LIENS.liens.map((l) => l.libelle), LIENS.rencontre.titre].map((t) => t.replace(/\s+/g, ''));
  const reste = corps.replace(/<div class="prose liens__presentation"[\s\S]*?<\/div>/g, '').replace(/<div class="prose annonce__texte"[\s\S]*?<\/div>/, '')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  assert.equal(reste, textes.join(''));
});
