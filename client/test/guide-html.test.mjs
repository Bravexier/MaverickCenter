// Pages du guide CONSTRUITES (client/dist/decouvrir/, dist/regles/, dist/mj/ ; plan : lib/livres.mjs ; demandes du propriétaire du 2026-10-18 : « éclater
// le guide », puis « refaire toutes les anciennes pages du guide. Retirer le mécanisme de swipe, et les flèches suivant / précédent et la pagination ») :
// chaque page du guide est une page simple (fil d'Ariane vers sa rubrique ou son sommaire, titre, texte et blocs tirés de la base, mots-clés,
// rétroliens ; plus de sources : réponse du propriétaire du 2026-10-22, « Plus de sources ailleurs que dans les archives. »), sans flèches, ni
// pagination, ni glissement du doigt ; les pages de Découvrir et de la création du personnage dans la couleur de leur partie ; les onglets des Règles
// (R184, R185 : plan de la base) sur le modèle de la chronologie (menu latéral de l'onglet, texte de la page choisie à droite) ; les sommaires du Guide
// du MJ et de l'Artisanat (à côté du menu de l'onglet Exploration) ; plus de Discord, de Tipeee ni d'encart « Notre prochaine rencontre IRL » sous
// Bienvenue (sur l'accueil depuis le 2026-10-23 : test/accueil-html.test.mjs) ; plus rien sous /guide/ ni /regles/avancees/, plus rien aux adresses
// des pages fusionnées ou supprimées.
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
  ARTISANAT, DECOUVRIR, entreesDuMenuLateral, estDuGuideDuMj, GUIDE_DU_MJ, installerLePlan, ongletDe, ongletsDesRegles, PAGES_ABSORBEES, PAGES_DE_LA_CREATION,
  PAGES_SUPPRIMEES, pagesDeLaRubrique, partieDeLaPage,
} from '../src/lib/livres.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
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
installerLePlan(chargerPlanDesRegles(db));
const pagesConstruites = db.prepare("SELECT id, titre, resume, corps_md, statut FROM page WHERE type = 'guide'").all()
  .filter((p) => existsSync(join(dist, cheminDePage(p.id), 'index.html')))
  .map((p) => ({ ...p, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const pageDe = (id) => pagesConstruites.find((p) => p.id === id);
const echappe = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** La page qui appelle un bloc (`<!-- guide:<bloc> -->`) : chaque bloc est appelé une fois dans tout le guide (test/guide.test.mjs). */
const pageDuBloc = (bloc) => pagesConstruites.find((p) => morceauxDuChapitre(p.corps_md).some((m) => m.bloc === bloc));

test('plus rien sous /guide/ ni /regles/avancees/, ni aux adresses des pages fusionnées ou supprimées ; /decouvrir/ est Bienvenue, sans sommaire', options, () => {
  assert.ok(!existsSync(join(dist, 'guide')), 'pas de dossier dist/guide/');
  assert.ok(!existsSync(join(dist, 'regles', 'avancees')), 'plus de Règles avancées (R184) : leurs adresses sont renvoyées par la page 404');
  for (const id of [...Object.keys(PAGES_ABSORBEES), ...PAGES_SUPPRIMEES]) {
    const slug = id.slice('guide/'.length);
    for (const dossier of ['decouvrir', 'regles', 'mj']) assert.ok(!existsSync(join(dist, dossier, slug)), `${id} : plus construite (/${dossier}/${slug}/)`);
  }
  assert.ok(!existsSync(join(dist, 'decouvrir', 'creer-son-personnage')), '« Créer son personnage » n’est plus dans Découvrir (R184)');
  for (const id of PAGES_DE_LA_CREATION.pages) assert.ok(existsSync(join(dist, cheminDePage(id), 'index.html')), `${id} : à /${cheminDePage(id)}`);
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
    // aucun lien vers une ancienne adresse : ni /guide/, ni /regles/avancees/, ni l'ancienne « Créer son personnage », ni une page fusionnée ou supprimée
    for (const [, href] of main.matchAll(/href="([^"]+)"/g)) {
      assert.doesNotMatch(href, /^\/(?:guide|regles\/avancees|decouvrir\/creer-son-personnage)\//, `${p.id} : ${href}`);
      for (const ancienne of [...Object.keys(PAGES_ABSORBEES), ...PAGES_SUPPRIMEES]) {
        const slug = ancienne.slice('guide/'.length);
        assert.ok(!href.startsWith(`/decouvrir/${slug}/`) && !href.startsWith(`/regles/${slug}/`), `${p.id} : ${href}`);
      }
    }
  }
});

test('le fil d’Ariane : Découvrir, l’onglet de la page, Guide du MJ ; la couleur de la partie sur Découvrir et la création du personnage, l’accent du site ailleurs ; le badge « Guide » au seul Guide du MJ', options, () => {
  const fil = (chemin) => sansStyles(lire(chemin).main).match(/<p class="muted guide-fil">([\s\S]*?)<\/p>/)?.[1].replace(/\s+/g, ' ').trim();
  assert.equal(fil('decouvrir'), '<a href="/">Accueil</a> › <a href="/decouvrir/" aria-current="page">Découvrir</a>');
  assert.equal(fil('decouvrir/l-univers'), '<a href="/">Accueil</a> › <a href="/decouvrir/">Découvrir</a>');
  // R184 : « Accueil › <onglet> », l'onglet de la page dans le plan de la base
  assert.equal(fil('regles/creer-son-personnage'), '<a href="/">Accueil</a> › <a href="/regles/fiche-de-personnage/">Fiche de personnage</a>');
  assert.equal(fil('regles/premiers-sorts'), '<a href="/">Accueil</a> › <a href="/regles/fiche-de-personnage/">Fiche de personnage</a>');
  assert.equal(fil('regles/meteo'), '<a href="/">Accueil</a> › <a href="/regles/mecaniques-generales/">Mécaniques générales</a>');
  assert.equal(fil('regles/les-degats'), '<a href="/">Accueil</a> › <a href="/regles/combats/">Les combats</a>');
  assert.equal(fil('regles/les-pieges'), '<a href="/">Accueil</a> › <a href="/regles/exploration/">Exploration</a>');
  assert.equal(fil('regles/combats'), '<a href="/">Accueil</a> › <a href="/regles/combats/">Les combats</a>', '/regles/combats/ : le fil de sa page d’ouverture');
  assert.equal(fil('regles'), '<a href="/">Accueil</a> › <a href="/regles/fiche-de-personnage/">Fiche de personnage</a>', '/regles/ : le premier onglet');
  assert.equal(fil('mj/campagne-ou-scenario-one-shot'), '<a href="/">Accueil</a> › <a href="/mj/">Guide du MJ</a>');
  for (const p of pagesConstruites) {
    const { main } = lire(cheminDePage(p.id));
    // la couleur de la partie (lib/palette-css.mjs#classeDePartie), jamais un style ; la page en émet la feuille, une fois
    const classe = classeDePartie(partieDeLaPage(p.id));
    const feuille = `<style>${cssDesFamilles(['partie'])}</style>`;
    // R184 : la création du personnage garde la couleur « creer », les autres pages des onglets l'accent du site (« Accent du site »)
    assert.equal(classe !== null, DECOUVRIR.groupes.some((g) => g.pages.includes(p.id)) || PAGES_DE_LA_CREATION.pages.includes(p.id), `${p.id} : sa couleur`);
    if (classe) {
      assert.ok(main.includes(`<div class="guide-reference guide-reference--couleur ${classe}">`), p.id);
      assert.equal(main.split(feuille).length - 1, 1, `${p.id} : la feuille des parties, une fois`);
    } else {
      assert.match(main, /<div class="guide-reference">/, p.id);
      assert.doesNotMatch(main, /\.couleur-partie-[a-z-]+\{/, `${p.id} : sans la feuille des parties`);
    }
    assert.doesNotMatch(main, /--couleur-partie/, p.id);
    // le badge « Guide » et « Aussi appelé » au seul Guide du MJ (réponse du propriétaire du 2026-11-05 : « Retirer, comme Les bases »)
    const reference = estDuGuideDuMj(p.id);
    assert.equal(/<span class="badge">Guide<\/span><\/h1>/.test(main.replace(/\s+<\/h1>/, '</h1>')), reference, `${p.id} : badge`);
    if (!reference) assert.doesNotMatch(main, /Aussi appelé/, `${p.id} : sans « Aussi appelé »`);
  }
  // une page écrite pour le site a aussi son pied de page : ses mots-clés (ses sources restent dans le frontmatter ; plus de rétroliens)
  assert.match(lire('regles/creer-son-personnage').main, /class="tags"/);
});

/** Le menu latéral d'un onglet (`titre` : « Les combats »…) d'une page construite : [[adresse, titre, courante]] dans l'ordre (pages et liens), et le HTML du menu. */
const menuLateral = (main, titre) => {
  const nav = main.match(new RegExp(`<nav class="lateral-menu" aria-label="${titre}">([\\s\\S]*?)<\\/nav>`));
  assert.ok(nav, `le menu latéral « ${titre} »`);
  const entrees = [...nav[1].matchAll(/<li(?: [^>]*)?><a class="lateral-menu__lien" href="([^"]+)"( aria-current="page")?>([^<]+)<\/a><\/li>/g)]
    .map((m) => [m[1], m[3].replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'), Boolean(m[2])]);
  return { entrees, html: nav[1] };
};

/**
 * Les contrôles communs d'une page à menu latéral (un onglet des Règles) : les entrées dans l'ordre, l'entrée affichée marquée, ni titres de groupe ni
 * sommaire, la page à droite (`droite` : à partir d'elle), le mode modification, la couleur de sa partie ou l'accent du site, le menu lisible sans
 * JavaScript, aucun script importé, l'entrée de l'onglet marquée dans le menu du site (d'après le plan, pas l'adresse).
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
  // l'accent du site (« Accent du site ») : aucune couleur de partie ni sa feuille, sauf sur la création du personnage (la partie « creer », R184)
  if (partieDeLaPage(page.id) === null) {
    assert.doesNotMatch(html, /class="[^"]*\bcouleur-partie-/, `${chemin} : aucune classe des parties`);
    assert.doesNotMatch(html, /\.couleur-partie-[a-z-]+\{/, `${chemin} : ni leur feuille`);
  }
  // le menu se lit sans JavaScript : ouvert dans le HTML construit (le script ne le replie que sur petit écran)
  assert.match(menu, /<details class="lateral-menu__repli" open data-lateral-repli>/, `${chemin} : ouvert sans JavaScript`);
  assert.doesNotMatch(main, /<script[^>]*\bsrc=|<script type="module"/, `${chemin} : aucun script de page importé (un script en ligne)`);
  // l'entrée de l'onglet du menu du site, marquée sur chacune de ces pages, elle seule dans la rubrique Règles
  assert.match(html, new RegExp(`<a href="/${rubrique.chemin}" aria-current="(?:page|true)">${rubrique.titre}</a>`), `${chemin} : l’entrée « ${rubrique.titre} » du menu du site`);
  const enTete = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  for (const o of ongletsDesRegles().filter((x) => x.chemin !== rubrique.chemin)) {
    assert.doesNotMatch(enTete, new RegExp(`<a href="/${o.chemin}" aria-current=`), `${chemin} : « ${o.titre} » n’est pas marqué`);
  }
  return { html, main, droite };
};

// Les onglets des Règles (R184, R185 ; plan de la base) sur le modèle de la chronologie (demande du propriétaire du 2026-11-05 pour Les bases : « un menu
// latéral sous le même modèle que la chronologie » ; réponses : « Comme la chronologie (Recommandé) », « Accent du site »)
test('R184 : chaque onglet des Règles, à gauche le menu latéral de ses entrées dans l’ordre du plan (pages, lien Artisanat), à droite la page choisie ; /regles/<onglet>/ et /regles/ s’ouvrent sur la page d’ouverture', options, () => {
  const onglets = ongletsDesRegles();
  assert.deepEqual(onglets.map((o) => o.id), ['fiche-de-personnage', 'mecaniques-generales', 'combats', 'exploration']);
  for (const onglet of onglets) {
    const entrees = entreesDuMenuLateral(onglet, pagesConstruites);
    const pages = entrees.filter((e) => e.id);
    assert.deepEqual(pages.map((p) => p.id), onglet.entrees.filter((e) => e.page).map((e) => e.page), `${onglet.titre} : chaque page construite`);
    const attendues = entrees.map((e) => (e.id ? [`/${cheminDePage(e.id)}`, e.titre] : [`/${e.adresse}`, e.libelle]));
    const ouverture = pageDe(onglet.ouverture);
    for (const [chemin, page] of [[onglet.chemin.slice(0, -1), ouverture], ...pages.map((p) => [cheminDePage(p.id).slice(0, -1), p])]) {
      const { droite } = verifierLeMenuLateral(chemin, page, onglet, attendues);
      if (db.prepare('SELECT COUNT(*) AS n FROM page_tag WHERE page_id = ?').get(page.id).n > 0) assert.match(droite, /<ul class="tags" aria-label="Mots-clés">/, `${chemin} : son pied de page`);
    }
    // /regles/<onglet>/ montre sa page d'ouverture ; son adresse canonique reste /regles/<slug>/ (pas deux pages du même texte pour la recherche)
    const html = lire(onglet.chemin.slice(0, -1)).html;
    assert.match(html, new RegExp(`<link rel="canonical" href="/${cheminDePage(onglet.ouverture)}">`), onglet.chemin);
    assert.match(html, new RegExp(`<title>${echappe(onglet.titre)} — Maverick Center</title>`), onglet.chemin);
    assert.match(html, new RegExp(`<a href="/${onglet.chemin}" aria-current="page">${echappe(onglet.titre)}</a>`), `${onglet.chemin} : l’entrée du menu du site, la page elle-même`);
    for (const p of pages) assert.doesNotMatch(lire(cheminDePage(p.id)).html, /rel="canonical"/, `${p.id} : à sa propre adresse, pas de canonique`);
  }
  // /regles/ : le premier onglet, ouvert sur « Créer son personnage »
  const regles = lire('regles').html;
  assert.match(regles, /<link rel="canonical" href="\/regles\/creer-son-personnage\/">/);
  assert.match(regles, /<title>Fiche de personnage — Maverick Center<\/title>/);
  assert.match(regles, /<a href="\/regles\/fiche-de-personnage\/" aria-current="true">Fiche de personnage<\/a>/);
  // une entrée « bientôt » : aucune aujourd'hui (R184, bilan) ; son rendu (grisée, sans lien) est épinglé par test/livres.test.mjs et le composant
  for (const onglet of onglets) assert.doesNotMatch(sansStyles(lire(onglet.chemin.slice(0, -1)).main), /class="lateral-menu__bientot/);
  // le Lexique (2026-11-05, migration 0090) : plus construit, son adresse mène à /recherche/ (page 404 : test/site-html.test.mjs)
  assert.ok(!existsSync(join(dist, 'regles', 'lexique')), '/regles/lexique/ n’est plus construite');
  // la fixture (status: example), si elle est construite : son adresse de repli, sans menu latéral
  if (existsSync(join(dist, 'regles', 'utiliser-ce-wiki'))) assert.doesNotMatch(lire('regles/utiliser-ce-wiki').main, /class="lateral/);
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
  // R184 : plus de bloc « documents » (sa page est supprimée) ; les blocs ont suivi leur texte dans les pages des étapes
  assert.equal(pageDuBloc('documents'), undefined);
  assert.deepEqual(['fil-rouge-race', 'magie-bonus', 'competences', 'initiative', 'types-de-don'].map((b) => pageDuBloc(b)?.id),
    ['guide/choisir-sa-race', 'guide/choisir-ses-magies', 'guide/caracteristiques-et-competences', 'guide/finaliser-son-personnage', 'guide/finaliser-son-personnage']);
  // les niveaux de titre restent cohérents : chaque bloc fil rouge et les groupes des compétences sont des h3, sous un h2 de la page (les sous-sections
  // des étapes sont devenues des `##`) ; aucun saut de niveau dans la création du personnage
  for (const id of PAGES_DE_LA_CREATION.pages) {
    const corps = sansStyles(lire(cheminDePage(id)).main);
    const niveaux = [...corps.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    assert.equal(niveaux[0], 1, `${id} : le titre`);
    niveaux.forEach((n, i) => assert.ok(i === 0 || n <= niveaux[i - 1] + 1, `${id} : un h${n} après un h${niveaux[i - 1]} (${niveaux.join(', ')})`));
    assert.doesNotMatch(corps, /<h4 class="guide-fil-rouge__nom"/, `${id} : les personnages fil rouge en h3`);
  }
});

test('R185 (4) : « Résistances et faiblesses » montre le tableau « Relations entre magies », le même que /magies/#relations, juste après son premier paragraphe', options, () => {
  const tableau = (html) => html.match(/<table class="tableau-magies__table tableau-magies--relations">[\s\S]*?<\/table>/)?.[0];
  const page = lire(cheminDePage('guide/resistances-et-faiblesses')).main;
  const magies = lire('magies').main;
  assert.ok(tableau(magies), 'le tableau de /magies/');
  assert.equal(tableau(page), tableau(magies), 'les mêmes données, le même rendu (components/magie/TableauRelationsMagies.astro)');
  const corps = page.slice(page.indexOf('<div class="guide-corps"'));
  assert.ok(corps.indexOf('</p>') < corps.indexOf('<div class="guide-relations"'), 'après le premier paragraphe');
  assert.match(corps, /<div class="guide-relations" role="region" aria-label="Relations entre magies">/);
  assert.equal((corps.match(/tableau-magies--relations/g) ?? []).length, 1, 'une fois');
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

test('/mj/ et /regles/artisanat/ : le titre et le résumé de chaque page, liés ; « Campagne » ou « Scénario one shot » dans le Guide du MJ ; Composants dans l’Artisanat, à côté du menu de l’onglet Exploration', options, () => {
  const mj = lire('mj').main;
  assert.match(mj, /<h1>Guide du MJ<\/h1>/);
  // le Guide du MJ ne change pas (2026-11-05) : un sommaire, ni menu latéral, ni sur ses pages
  assert.match(mj, /<section class="sommaire"/);
  for (const chemin of ['mj', ...GUIDE_DU_MJ.pages.map((id) => cheminDePage(id).slice(0, -1))]) assert.doesNotMatch(lire(chemin).main, /class="lateral/, `${chemin} : sans menu latéral`);
  assert.deepEqual([...mj.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]), GUIDE_DU_MJ.pages.map((id) => `/${cheminDePage(id)}`));
  assert.ok(GUIDE_DU_MJ.pages.includes('guide/campagne-ou-scenario-one-shot'));
  const artisanat = lire('regles/artisanat').main;
  assert.match(artisanat, /<h1>Artisanat<\/h1>/);
  const liens = [...artisanat.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><div class="muted">/g)].map((m) => [m[1], m[2]]);
  assert.equal(liens.length, ARTISANAT.pages.length, 'cinq pages, chacune avec son résumé');
  assert.deepEqual(liens[0], ['/ressources/composants/', 'Composants']);
  assert.deepEqual(liens.slice(1).map((l) => l[0]), ARTISANAT.pages.slice(1).map((id) => `/${cheminDePage(id)}`));
  // R184 : l'Artisanat est une entrée lien de l'onglet Exploration : son menu latéral, son entrée marquée, l'onglet marqué au menu du site
  const { html, main } = lire('regles/artisanat');
  const { entrees } = menuLateral(main, 'Exploration');
  assert.deepEqual(entrees.filter((e) => e[2]).map((e) => [e[0], e[1]]), [['/regles/artisanat/', 'Artisanat']]);
  assert.deepEqual(entrees.map((e) => e[0]), entreesDuMenuLateral(ongletDe('guide/les-pieges'), pagesConstruites).map((e) => `/${e.id ? cheminDePage(e.id) : e.adresse}`));
  assert.match(html, /<a href="\/regles\/exploration\/" aria-current="true">Exploration<\/a>/);
  assert.match(html, /data-group="regles" aria-pressed="true" aria-current="true"/, 'la rubrique Règles ouverte');
  // lot de l'édition des menus : l'Artisanat reçoit le mode modification du site de dev (son menu se réordonne, « + Ajouter une page »)
  assert.match(html, /<div data-edition data-api="\/api\/" data-page="regles\/artisanat"/, 'le mode modification');
  assert.match(main, /<ol class="lateral-menu__liste" data-ed-menu="onglet:exploration">/);
});

// Lot de l'édition des menus (« changer l'ordre des menu latéraux (par un glisser déposer) ») : chaque menu d'onglet porte son onglet (data-ed-menu) et,
// sur chaque entrée, l'id et le rang de sa ligne de regles_onglet_entree (data-ed-entree, data-ed-rang) : le mode modification réordonne par eux
// (src/scripts/edition/menus.mjs, opération `ordonner`) ; une entrée de page se retrouve par l'id de sa page (`page:<id>`), dont elle montre le titre
test('le menu latéral de chaque onglet porte l’id et le rang de chaque ligne de regles_onglet_entree, dans l’ordre, pour le mode modification', options, () => {
  for (const onglet of ongletsDesRegles()) {
    const { main } = lire(onglet.chemin.slice(0, -1));
    const nav = main.match(new RegExp(`<nav class="lateral-menu" aria-label="${echappe(onglet.titre)}">([\\s\\S]*?)<\\/nav>`))[1];
    assert.match(nav, new RegExp(`<ol class="lateral-menu__liste" data-ed-menu="onglet:${onglet.id}">`), onglet.id);
    const lignes = db.prepare('SELECT id, rang, page_id FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id').all(onglet.id)
      .filter((l) => l.page_id === null || pageDe(l.page_id));
    const posees = [...nav.matchAll(/<li data-ed-entree="([^"]+)" data-ed-rang="(\d+)">(?:<a class="lateral-menu__lien" href="([^"]+)"[^>]*>([^<]+)<\/a>)?/g)];
    assert.deepEqual(posees.map((m) => [m[1], Number(m[2])]), lignes.map((l) => [l.id, l.rang]), `${onglet.id} : les lignes de la base, dans l’ordre`);
    assert.equal((nav.match(/<li[ >]/g) ?? []).length, posees.length, `${onglet.id} : chaque entrée porte les siens`);
    for (const [, id, , href, titre] of posees) {
      if (!id.startsWith('page:')) continue;
      const page = pageDe(id.slice('page:'.length));
      assert.equal(href, `/${cheminDePage(page.id)}`, id);
      assert.equal(titre.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'), page.titre, `${id} : le titre de la page`);
    }
  }
});

test('Découvrir : une page par entrée du menu, dans l’ordre ; plus de « Rejoindre une partie » (ni au menu, ni construite)', options, () => {
  assert.deepEqual(pagesDeLaRubrique(DECOUVRIR).map((p) => `/${cheminDePage(p.id)}`), ['/decouvrir/', '/decouvrir/l-univers/']);
  for (const { id } of pagesDeLaRubrique(DECOUVRIR)) assert.ok(pageDe(id), `${id} : construite`);
  const accueil = lire('decouvrir').html;
  const menu = accueil.slice(accueil.indexOf('<header'), accueil.indexOf('</header>'));
  for (const chemin of ['/decouvrir/', '/decouvrir/l-univers/', ...ongletsDesRegles().map((o) => `/${o.chemin}`)]) {
    assert.ok(menu.includes(`href="${chemin}"`), `menu : ${chemin}`);
  }
  assert.ok(!menu.includes('href="/decouvrir/creer-son-personnage/"') && !menu.includes('href="/regles/avancees/"'), 'menu : plus de Créer son personnage ni de Règles avancées');
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
