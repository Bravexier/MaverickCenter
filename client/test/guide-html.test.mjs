// Pages du guide CONSTRUITES (client/dist/decouvrir/, dist/regles/, dist/mj/ ; plan : lib/livres.mjs ; demandes du propriétaire du 2026-10-18 : « éclater
// le guide », puis « refaire toutes les anciennes pages du guide. Retirer le mécanisme de swipe, et les flèches suivant / précédent et la pagination ») :
// chaque page du guide est une page simple (fil d'Ariane vers sa rubrique ou son sommaire, titre, texte et blocs tirés de la base, mots-clés,
// rétroliens ; plus de sources : réponse du propriétaire du 2026-10-22, « Plus de sources ailleurs que dans les archives. »), sans flèches, ni
// pagination, ni glissement du doigt ; les pages de Découvrir dans la couleur de leur groupe ; Les bases puis les Règles avancées sur le modèle de la
// chronologie (menu latéral des pages, texte de la page choisie à droite, l'accent du site) ; les sommaires du Guide du MJ et de l'Artisanat ; plus de Discord, de Tipeee ni d'encart « Notre prochaine rencontre IRL » sous Bienvenue (sur l'accueil
// depuis le 2026-10-23 : test/accueil-html.test.mjs ; la page Liens est supprimée le 2026-10-22) ; plus rien sous /guide/, plus rien aux adresses des
// pages fusionnées.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/guide-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { morceauxDuChapitre } from '../src/lib/guide.mjs';
import { decouperCorps } from '../src/lib/markdown-edition.mjs';
import { classeDePartie, cssDesFamilles } from '../src/lib/palette-css.mjs';
import {
  ARTISANAT, DECOUVRIR, estDansDecouvrirOuLesBases, estDesBases, estDesReglesAvancees, GUIDE_DU_MJ, LES_BASES,
  PAGES_ABSORBEES, pagesDeLaRubrique, pagesDesBases, pagesDesReglesAvancees, partieDeLaPage, REGLES_AVANCEES,
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

test('chaque page du guide est une page simple : ni flèches, ni pagination, ni ← →, ni glissement du doigt ; titre, texte ; plus de sources', options, () => {
  assert.ok(pagesConstruites.length > 50, `${pagesConstruites.length} pages construites`);
  for (const p of pagesConstruites) {
    const { main } = lire(cheminDePage(p.id));
    assert.doesNotMatch(main, /guide-fleche|guide-pagination|guide-voisin|guide-page|data-guide-(?:suivant|precedent|suite)/, `${p.id} : le chrome du livre`);
    assert.doesNotMatch(main, /touchstart|touchmove|touchend|ArrowLeft|overflow-x: clip/, `${p.id} : ni geste, ni clavier, ni réglage de défilement du livre`);
    assert.match(main, /<h1 id="guide-titre">/, p.id);
    // le corps modifiable sur le site de dev, morceau par morceau ; une page d'exemple (HIDE_EXAMPLES=1 la retire) ne se modifie pas
    const modifiable = p.statut !== 'example';
    assert.match(main, modifiable ? new RegExp(`<div class="guide-corps" data-ed-corps="${p.id}">`) : /<div class="guide-corps">/, `${p.id} : le corps`);
    const visibles = decouperCorps(p.corps_md).filter((m) => m.visible).length;
    assert.equal((main.match(/data-ed-morceau/g) ?? []).length, modifiable ? visibles : 0, `${p.id} : un morceau modifiable par morceau visible`);
    // plus de sources sous le texte, quelle que soit la page (« Plus de sources ailleurs que dans les archives. ») : `sources:` reste dans la base
    assert.doesNotMatch(main, /<h2>Sources<\/h2>/, `${p.id} : sources`);
    // aucun lien vers une ancienne adresse : ni /guide/, ni une page fusionnée
    for (const [, href] of main.matchAll(/href="([^"]+)"/g)) {
      assert.doesNotMatch(href, /^\/guide\//, `${p.id} : ${href}`);
      for (const ancienne of Object.keys(PAGES_ABSORBEES)) assert.ok(!href.startsWith(`/decouvrir/${ancienne.slice('guide/'.length)}/`), `${p.id} : ${href}`);
    }
  }
});

test('le fil d’Ariane : Découvrir pour ses pages, Les bases, Règles avancées (sans groupe), Guide du MJ ; la couleur du groupe sur les pages de Découvrir, l’accent du site sur celles des Bases', options, () => {
  const fil = (chemin) => sansStyles(lire(chemin).main).match(/<p class="muted guide-fil">([\s\S]*?)<\/p>/)?.[1].replace(/\s+/g, ' ').trim();
  assert.equal(fil('decouvrir'), '<a href="/">Accueil</a> › <a href="/decouvrir/" aria-current="page">Découvrir</a>');
  assert.equal(fil('decouvrir/creer-son-personnage'), '<a href="/">Accueil</a> › <a href="/decouvrir/">Découvrir</a>');
  // « Inutile de séparer les catégories les Jouer / Progresser / Pour aller plus loin. » (2026-11-05) : plus de groupe dans le fil
  assert.equal(fil('regles/les-degats'), '<a href="/">Accueil</a> › <a href="/regles/">Les bases</a>');
  assert.equal(fil('regles/lexique'), '<a href="/">Accueil</a> › <a href="/regles/">Les bases</a>');
  assert.equal(fil('regles'), '<a href="/">Accueil</a> › <a href="/regles/">Les bases</a>', '/regles/ : le fil de sa première page');
  // Règles avancées : de même, plus de groupe ni d'ancre de groupe dans le fil (réponse du propriétaire du 2026-11-05 : « Liste sans groupes »)
  assert.equal(fil('regles/avancees/meteo'), '<a href="/">Accueil</a> › <a href="/regles/avancees/">Règles avancées</a>');
  assert.equal(fil('regles/avancees/fiche-attributs'), '<a href="/">Accueil</a> › <a href="/regles/avancees/">Règles avancées</a>');
  assert.equal(fil('regles/avancees'), '<a href="/">Accueil</a> › <a href="/regles/avancees/">Règles avancées</a>', '/regles/avancees/ : le fil de sa première page');
  assert.equal(fil('mj/campagne-ou-scenario-one-shot'), '<a href="/">Accueil</a> › <a href="/mj/">Guide du MJ</a>');
  for (const p of pagesConstruites) {
    const { main } = lire(cheminDePage(p.id));
    // la couleur du groupe : la classe de sa partie (lib/palette-css.mjs#classeDePartie), jamais un style ; la page en émet la feuille, une fois
    const classe = classeDePartie(partieDeLaPage(p.id));
    const feuille = `<style>${cssDesFamilles(['partie'])}</style>`;
    // les pages des Bases : aucune partie (réponse du propriétaire du 2026-11-05 : « Accent du site »)
    if (estDesBases(p.id)) assert.equal(classe, null, p.id);
    if (classe) {
      assert.ok(main.includes(`<div class="guide-reference guide-reference--couleur ${classe}">`), p.id);
      assert.equal(main.split(feuille).length - 1, 1, `${p.id} : la feuille des parties, une fois`);
    } else {
      assert.match(main, /<div class="guide-reference">/, p.id);
      assert.doesNotMatch(main, /\.couleur-partie-[a-z-]+\{/, `${p.id} : une page de référence, sans la feuille des parties`);
    }
    assert.doesNotMatch(main, /--couleur-partie/, p.id);
    // le badge « Guide » et « Aussi appelé » hors de Découvrir, des Bases et des Règles avancées (réponse du propriétaire du 2026-11-05 : « Retirer, comme Les bases »)
    const reference = !estDansDecouvrirOuLesBases(p.id) && !estDesReglesAvancees(p.id);
    assert.equal(/<span class="badge">Guide<\/span><\/h1>/.test(main.replace(/\s+<\/h1>/, '</h1>')), reference, `${p.id} : badge`);
    if (!reference) assert.doesNotMatch(main, /Aussi appelé/, `${p.id} : sans « Aussi appelé »`);
  }
  // une page écrite pour le site a aussi son pied de page : ses mots-clés (ses sources restent dans le frontmatter ; plus de rétroliens)
  assert.match(lire('decouvrir/creer-son-personnage').main, /class="tags"/);
});

/** Le menu latéral d'une rubrique (`titre` : « Les bases », « Règles avancées ») d'une page construite : [[adresse, titre, courante]] dans l'ordre, et le HTML du menu. */
const menuLateral = (main, titre) => {
  const nav = main.match(new RegExp(`<nav class="lateral-menu" aria-label="${titre}">([\\s\\S]*?)<\\/nav>`));
  assert.ok(nav, `le menu latéral « ${titre} »`);
  const entrees = [...nav[1].matchAll(/<li><a class="lateral-menu__lien" href="([^"]+)"( aria-current="page")?>([^<]+)<\/a><\/li>/g)]
    .map((m) => [m[1], m[3].replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'), Boolean(m[2])]);
  return { entrees, html: nav[1] };
};

/**
 * Les contrôles communs d'une page à menu latéral (Les bases, Règles avancées) : les entrées dans l'ordre, l'entrée affichée marquée, ni titres de
 * groupe ni sommaire, la page à droite (`droite` : à partir d'elle), le mode modification, l'accent du site, le menu lisible sans JavaScript, aucun script importé, l'entrée de la
 * rubrique marquée dans le menu du site.
 */
const verifierLeMenuLateral = (chemin, page, rubrique, attendues) => {
  const { html, main } = lire(chemin);
  const { entrees, html: menu } = menuLateral(main, rubrique.titre);
  assert.deepEqual(entrees.map(([href, titre]) => [href, titre]), attendues, `${chemin} : les entrées, dans l’ordre`);
  // l'entrée affichée marquée (aria-current), elle seule
  assert.deepEqual(entrees.filter((e) => e[2]).map((e) => e[0]), [`/${cheminDePage(page.id)}`], `${chemin} : l’entrée courante`);
  // plus de groupes : ni titres de groupe, ni sommaire
  assert.doesNotMatch(sansStyles(menu), /<h[2-6]/, `${chemin} : sans titres de groupe`);
  assert.doesNotMatch(main, /class="sommaire/, `${chemin} : plus de sommaire en groupes`);
  // à droite, la page elle-même (son titre, son texte modifiable, son pied de page), après le menu
  const droite = main.slice(main.indexOf('<div class="lateral-page">'));
  assert.ok(main.indexOf('<nav class="lateral-menu"') < main.indexOf('<div class="lateral-page">'), `${chemin} : le menu à gauche, la page à droite`);
  // (une page d'exemple, dans le reste des Règles avancées tant qu'elle est chargée, ne se modifie pas : HIDE_EXAMPLES=1 la retire)
  const modifiable = page.statut !== 'example';
  assert.match(droite, new RegExp(`<h1 id="guide-titre">${modifiable ? '<span data-ed="[^"]+">' : ''}${echappe(page.titre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${chemin} : le titre de la page`);
  assert.match(droite, new RegExp(`<div class="guide-corps"${modifiable ? ` data-ed-corps="${page.id}"` : ''}>`), `${chemin} : le texte de la page`);
  // le mode modification du site de dev porte sur la page affichée
  if (modifiable) assert.match(html, new RegExp(`<div data-edition data-api="/api/" data-page="${page.id}"`), `${chemin} : le mode modification`);
  // l'accent du site : aucune couleur de partie ni sa feuille (« Accent du site »)
  assert.doesNotMatch(html, /class="[^"]*\bcouleur-partie-/, `${chemin} : aucune classe des parties`);
  assert.doesNotMatch(html, /\.couleur-partie-[a-z-]+\{/, `${chemin} : ni leur feuille`);
  // le menu se lit sans JavaScript : ouvert dans le HTML construit (le script ne le replie que sur petit écran)
  assert.match(menu, /<details class="lateral-menu__repli" open data-lateral-repli>/, `${chemin} : ouvert sans JavaScript`);
  assert.doesNotMatch(main, /<script[^>]*\bsrc=|<script type="module"/, `${chemin} : aucun script de page importé (un script en ligne)`);
  // l'entrée de la rubrique du menu du site, marquée sur chacune de ces pages
  assert.match(html, new RegExp(`<a href="/${rubrique.chemin}" aria-current="(?:page|true)">${rubrique.titre}</a>`), `${chemin} : l’entrée « ${rubrique.titre} » du menu du site`);
  return { html, main, droite };
};

// Les bases sur le modèle de la chronologie (demande du propriétaire du 2026-11-05 : « Refait la page les bases. Au lieu de lister les différentes
// pages, réécrit directement le contenu. […] Inutile de séparer les catégories les Jouer / Progresser / Pour aller plus loin. Pour la présation je
// préfèrera un menu latéral sous le même modèle que la chronologie. » ; réponses : « Comme la chronologie (Recommandé) », « Accent du site »)
test('Les bases : à gauche le menu latéral des douze pages dans l’ordre (sans titres de groupe), à droite le texte de la page choisie ; /regles/ s’ouvre sur « Réussir une action »', options, () => {
  const pages = pagesDesBases(pagesConstruites);
  assert.deepEqual(pages.map((p) => p.id), LES_BASES.pages, 'les douze pages construites');
  assert.equal(pages.length, 12);
  const attendues = pages.map((p) => [`/${cheminDePage(p.id)}`, p.titre]);
  for (const [chemin, page] of [['regles', pages[0]], ...pages.map((p) => [cheminDePage(p.id).slice(0, -1), p])]) {
    const { main, droite } = verifierLeMenuLateral(chemin, page, LES_BASES, attendues);
    if (db.prepare('SELECT COUNT(*) AS n FROM page_tag WHERE page_id = ?').get(page.id).n > 0) assert.match(droite, /<ul class="tags" aria-label="Mots-clés">/, `${chemin} : son pied de page`);
    // ni « Jouer », ni « Progresser », ni « Pour aller plus loin »
    assert.doesNotMatch(sansStyles(menuLateral(main, LES_BASES.titre).html), /Jouer|Progresser|Pour aller plus loin/, `${chemin} : sans titres de groupe`);
  }
  // /regles/ montre « Réussir une action » ; son adresse canonique reste /regles/reussir-une-action/ (pas deux pages du même texte pour la recherche)
  assert.equal(LES_BASES.ouverture, 'guide/reussir-une-action');
  const regles = lire('regles').html;
  assert.match(regles, /<link rel="canonical" href="\/regles\/reussir-une-action\/">/);
  assert.match(regles, /<title>Les bases — Maverick Center<\/title>/);
  for (const p of pages) assert.doesNotMatch(lire(cheminDePage(p.id)).html, /rel="canonical"/, `${p.id} : à sa propre adresse, pas de canonique`);
});

test('les tableaux viennent de la base : progression, postures, compétences, magies, personnages fil rouge (la page qui appelle le bloc)', options, () => {
  const lireBloc = (bloc) => lire(cheminDePage(pageDuBloc(bloc).id)).main;
  const niveaux = lireBloc('niveaux');
  assert.equal((niveaux.match(/<tr>\s*<th scope="row">\d+<\/th>/g) ?? []).length, 20);
  assert.match(niveaux, /460\s250/, 'XP du niveau 20 (espace fine insécable de toLocaleString)');
  const postures = lireBloc('postures');
  assert.equal((postures.match(/class="guide-posture__nom"/g) ?? []).length, 6);
  // chacune dans sa couleur (demande du propriétaire, lib/caracteristiques-postures.mjs) : la classe de sa posture (lib/palette-css.mjs), émise par le
  // bloc lui-même (famille d'une zone), jamais un style
  assert.deepEqual([...postures.matchAll(/<section class="guide-posture (couleur-posture-[\w-]+)" aria-labelledby/g)].map((m) => m[1]),
    ['offensif', 'defensif', 'neutre', 'focus', 'vigilance', 'symbiose'].map((p) => `couleur-posture-${p}`), 'Offensif, Défensif, Neutre, Focus, Vigilance, Symbiose');
  assert.ok(postures.includes(`<style>${cssDesFamilles(['posture'])}</style>`), 'les classes des postures, émises par le bloc');
  const competences = lireBloc('competences');
  assert.equal((competences.match(/class="guide-competences__groupe /g) ?? []).length, 6);
  assert.deepEqual([...competences.matchAll(/<section class="guide-competences__groupe (couleur-caracteristique-[\w-]+)" aria-labelledby/g)].map((m) => m[1]),
    ['force', 'volonte', 'intelligence', 'perception', 'social', 'agilite'].map((c) => `couleur-caracteristique-${c}`), 'Force, Volonté, Intelligence, Perception, Social, Agilité');
  assert.match(lireBloc('magie-bonus'), /<span class="guide-carac couleur-caracteristique-social">Social<\/span>/, '+1 en Social du Feu');
  for (const html of [postures, competences]) assert.doesNotMatch(html, /class="guide-(?:posture|competences__groupe|carac)[^"]*" style=/, 'aucune couleur en style');
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

// Les Règles avancées comme Les bases (demande du propriétaire du 2026-11-05 : « Suite à la modification de la page "les bases" refait la même avec les
// "règles avancées", tout sur la même page avec menu lattéral. » ; réponses : « Liste sans groupes » — « Comme Les bases : une seule liste de titres,
// dans l'ordre actuel des groupes. » — et « Le Mode Hyper »)
test('Les Règles avancées : le même menu latéral, une seule liste de titres sans groupes dans l’ordre du plan, la page choisie à droite ; /regles/avancees/ s’ouvre sur « Le Mode Hyper »', options, () => {
  const pages = pagesDesReglesAvancees(pagesConstruites);
  assert.ok(pages.length > 30, `${pages.length} pages construites`);
  assert.deepEqual(pages.map((p) => p.id).slice(0, REGLES_AVANCEES.pages.length), REGLES_AVANCEES.pages, 'les pages nommées en tête, dans l’ordre');
  assert.deepEqual(pagesConstruites.filter((p) => estDesReglesAvancees(p.id)).map((p) => p.id).sort(), pages.map((p) => p.id).sort(), 'toutes les pages construites des Règles avancées');
  const attendues = pages.map((p) => [`/${cheminDePage(p.id)}`, p.titre]);
  for (const [chemin, page] of [['regles/avancees', pages[0]], ...pages.map((p) => [cheminDePage(p.id).slice(0, -1), p])]) {
    const { main } = verifierLeMenuLateral(chemin, page, REGLES_AVANCEES, attendues);
    // ni les titres des anciens groupes du sommaire
    assert.doesNotMatch(sansStyles(menuLateral(main, REGLES_AVANCEES.titre).html), /Magie et Mode Hyper|Combat et actions|Exploration et voyage|Autres pages de référence/,
      `${chemin} : sans titres de groupe`);
  }
  // les pages « Fiche de personnage : … » et une page que le plan ne nomme pas (les documents des règles) ont aussi le menu
  assert.ok(pages.some((p) => p.id.startsWith('guide/fiche-')) && pages.some((p) => p.id === 'guide/les-documents-des-regles'));
  // /regles/avancees/ montre « Le Mode Hyper » ; son adresse canonique reste /regles/avancees/le-mode-hyper/
  assert.equal(REGLES_AVANCEES.ouverture, 'guide/le-mode-hyper');
  assert.equal(pages[0].id, REGLES_AVANCEES.ouverture);
  const avancees = lire('regles/avancees').html;
  assert.match(avancees, /<link rel="canonical" href="\/regles\/avancees\/le-mode-hyper\/">/);
  assert.match(avancees, /<title>Règles avancées — Maverick Center<\/title>/);
  assert.match(avancees, /<a href="\/regles\/avancees\/" aria-current="page">Règles avancées<\/a>/, 'l’entrée du menu du site, la page elle-même');
  for (const p of pages) assert.doesNotMatch(lire(cheminDePage(p.id)).html, /rel="canonical"/, `${p.id} : à sa propre adresse, pas de canonique`);
  // pièges, portes, météo, « Donjon pas bon » : « dans les règles avancées, pour tout le monde » (2026-10-18)
  for (const id of ['guide/les-pieges', 'guide/les-portes', 'guide/meteo', 'guide/donjon-pas-bon']) assert.ok(pages.some((p) => p.id === id), id);
  // le bloc des documents : les pages de référence par document, liées à leur nouvelle adresse, sans les pages de Découvrir ni des Bases
  const documents = lire('regles/avancees/les-documents-des-regles').main;
  assert.match(documents, /<div class="guide-references">/);
  const liees = [...documents.matchAll(/<section class="guide-references__groupe">[\s\S]*?<\/section>/g)].flatMap((s) => [...s[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(liees.length > 20 && liees.every((h) => /^\/(?:regles\/avancees|mj)\//.test(h)), 'seulement des pages de référence');
});

test('/mj/ et /regles/artisanat/ : le titre et le résumé de chaque page, liés ; « Campagne » ou « Scénario one shot » dans le Guide du MJ ; Composants dans l’Artisanat', options, () => {
  const mj = lire('mj').main;
  assert.match(mj, /<h1>Guide du MJ<\/h1>/);
  // le Guide du MJ ne change pas (2026-11-05) : un sommaire, ni menu latéral, ni sur ses pages
  assert.match(mj, /<section class="sommaire"/);
  for (const chemin of ['mj', ...GUIDE_DU_MJ.pages.map((id) => cheminDePage(id).slice(0, -1)), 'regles/artisanat']) assert.doesNotMatch(lire(chemin).main, /class="lateral/, `${chemin} : sans menu latéral`);
  assert.deepEqual([...mj.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]), GUIDE_DU_MJ.pages.map((id) => `/${cheminDePage(id)}`));
  assert.ok(GUIDE_DU_MJ.pages.includes('guide/campagne-ou-scenario-one-shot'));
  const artisanat = lire('regles/artisanat').main;
  assert.match(artisanat, /<h1>Artisanat<\/h1>/);
  const liens = [...artisanat.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><div class="muted">/g)].map((m) => [m[1], m[2]]);
  assert.equal(liens.length, ARTISANAT.pages.length, 'cinq pages, chacune avec son résumé');
  assert.deepEqual(liens[0], ['/ressources/composants/', 'Composants']);
  assert.deepEqual(liens.slice(1).map((l) => l[0]), ARTISANAT.pages.slice(1).map((id) => `/${cheminDePage(id)}`));
});

test('Découvrir : une page par entrée du menu, dans l’ordre ; plus de « Rejoindre une partie » (ni au menu, ni construite)', options, () => {
  assert.deepEqual(pagesDeLaRubrique(DECOUVRIR).map((p) => `/${cheminDePage(p.id)}`),
    ['/decouvrir/', '/decouvrir/l-univers/', '/decouvrir/creer-son-personnage/']);
  for (const { id } of pagesDeLaRubrique(DECOUVRIR)) assert.ok(pageDe(id), `${id} : construite`);
  const accueil = lire('decouvrir').html;
  const menu = accueil.slice(accueil.indexOf('<header'), accueil.indexOf('</header>'));
  for (const chemin of ['/decouvrir/', '/decouvrir/l-univers/', '/decouvrir/creer-son-personnage/']) {
    assert.ok(menu.includes(`href="${chemin}"`), `menu : ${chemin}`);
  }
  // « Efface la page "Rejoindre une partie" et son lien. » (2026-11-05) : ni au menu, ni construite, ni liée depuis une page du guide ; son adresse
  // n'est pas renvoyée (« Page 404 (Recommandé) » : test/site-html.test.mjs)
  assert.ok(!menu.includes('rejoindre-une-partie'), 'menu : plus d’entrée « Rejoindre une partie »');
  assert.ok(!existsSync(join(dist, 'decouvrir', 'rejoindre-une-partie')), '/decouvrir/rejoindre-une-partie/ n’est plus construite');
  for (const p of pagesConstruites) assert.doesNotMatch(lire(cheminDePage(p.id)).main, /href="[^"]*rejoindre-une-partie/, `${p.id} : un lien vers la page retirée`);
  // plus de page Liens (« Supprimer la page ») : ni au menu, ni construite ; son adresse n'est plus renvoyée (« supprimer ce lien » : test/site-html.test.mjs)
  assert.ok(!menu.includes('href="/decouvrir/liens/"'), 'menu : plus d’entrée Liens');
  assert.ok(!existsSync(join(dist, 'decouvrir', 'liens')), '/decouvrir/liens/ n’est plus construite');
});

test('Bienvenue (/decouvrir/) : plus de liens Discord et Tipeee ni d’encart sous son texte (sur l’accueil depuis le 2026-10-23 : test/accueil-html.test.mjs)', options, () => {
  // « Ces 3 blocs auraient plus leur place dans l'onglet d'acceuil. » : la page garde son texte, ses mots-clés et son mode modification (ses rétroliens : test suivant)
  const { html, main } = lire('decouvrir');
  assert.match(main, /<div class="guide-corps"/);
  assert.doesNotMatch(main, /accueil-liens|bienvenue-liens|data-tipeee|data-annonce|id="(?:lien-discord|lien-tipeee|prochaine-rencontre)"/);
  assert.match(html, /<div data-edition data-api="\/api\/" data-page="guide\/bienvenue"/, 'le texte reste modifiable sur le site de dev');
  // sur les autres pages de Découvrir non plus
  for (const { id } of pagesDeLaRubrique(DECOUVRIR).slice(1)) assert.doesNotMatch(lire(cheminDePage(id)).main, /accueil-liens|data-tipeee|data-annonce/, id);
});

test('Plus aucune page du site n’a de rétroliens (« Cette page mentionne » / « Mentionnée par ») ; les mots-clés restent (demande du propriétaire du 2026-11-05)', options, () => {
  // « Supprime ces colonnes de toutes les pages. Elles polluent l'affichage pour rien. » : le bloc (et son filet, la bordure de .linked-pages)
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith('.html') ? [join(dir, d.name)] : []));
  const pages = walk(dist);
  assert.ok(pages.length > 100, `${pages.length} pages construites`);
  for (const f of pages) assert.doesNotMatch(readFileSync(f, 'utf8'), /class="linked-pages"|<h2>Cette page mentionne<\/h2>|<h2>Mentionnée par<\/h2>/, f);
  // une page du guide et une page du wiki gardent leurs mots-clés, s'ils en ont
  for (const id of ['guide/creer-son-personnage', 'guide/bienvenue', 'races/nain']) {
    const tags = db.prepare('SELECT COUNT(*) AS n FROM page_tag WHERE page_id = ?').get(id).n;
    if (tags > 0) assert.match(lire(cheminDePage(id)).main, /<ul class="tags" aria-label="Mots-clés">/, id);
  }
});
