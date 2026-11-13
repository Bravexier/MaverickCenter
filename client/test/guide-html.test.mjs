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
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { morceauxDuChapitre } from '../src/lib/guide.mjs';
import { decouperEnOnglets } from '../src/lib/guide-onglets.mjs';
import { COULEURS_ALIGNEMENTS } from '../src/lib/caracteristiques-postures.mjs';
import { classeDuMotCle, motCleDeLaPage } from '../src/lib/mots-cles-liens.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { decouperCorps, versMarkdown } from '../src/lib/markdown-edition.mjs';
import { classeDAlignement, classeDePartie, cssDesAlignements, cssDesFamilles, idDeCouleur } from '../src/lib/palette-css.mjs';
import {
  ARTISANAT, DECOUVRIR, entreesDuMenuLateral, estDuGuideDuMj, GUIDE_DU_MJ, installerLePlan, ongletsDesRegles, PAGES_ABSORBEES, PAGES_DE_LA_CREATION,
  PAGES_SUPPRIMEES, pagesDeLaRubrique, partieDeLaPage,
} from '../src/lib/livres.mjs';
import { chargerPlanDesRegles } from '../src/lib/plan-des-regles-db.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { chargerModeHyper } from '../src/lib/guide-db.mjs';
import { chargerFilRouge } from '../src/lib/guide-fil-rouge.mjs';
import { baseDImport, texteDImport } from './aide-base-d-import.mjs';
import { avecLesMotsCles, htmlParLignes, premiersMotsAffiches, texteAffiche } from './aide-texte-affiche.mjs';
import { enfantsDuHtml, rendreCommeLeGuide } from './aide-rendu-du-site.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'decouvrir', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (chemin) => {
  const html = readFileSync(join(dist, chemin, 'index.html'), 'utf8');
  return { html, main: html.slice(html.indexOf('<main'), html.indexOf('</main>')), ids: [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]) };
};
const sansStyles = (main) => main.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
/**
 * Le HTML sans le script partagé des onglets (components/Onglets.astro, skill ui-onglets), qu'une page à sections en onglets pose une fois, en ligne : il lit les
 * flèches gauche et droite du clavier (motif « tabs » de l'ARIA), ce que les contrôles « plus de livre » (flèches, glissement) et « aucun script de page
 * importé » ne visent pas.
 */
const sansLeScriptDesOnglets = (html) => html.replace(/<script type="module">(?:(?!<\/script>)[\s\S])*onglets:brancher[\s\S]*?<\/script>/g, '');
const db = ouvrirBase({ sansExemples: false });
installerLePlan(chargerPlanDesRegles(db));
const pagesConstruites = db.prepare("SELECT id, titre, resume, corps_md, statut FROM page WHERE type = 'guide'").all()
  .filter((p) => existsSync(join(dist, cheminDePage(p.id), 'index.html')))
  .map((p) => ({ ...p, data: { title: p.titre, summary: p.resume ?? undefined, status: p.statut } }));
const pageDe = (id) => pagesConstruites.find((p) => p.id === id);
const echappe = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** L'onglet courant d'une page des onglets des Règles (le site de dev range une page dans un autre onglet) : son fil d'Ariane. */
const filDeLOnglet = (id) => {
  const o = db.prepare('SELECT o.id, o.titre FROM regles_onglet_entree e JOIN regles_onglet o ON o.id = e.onglet_id WHERE e.page_id = ?').get(id);
  return `<a href="/">Accueil</a> › <a href="/regles/${o.id}/">${echappe(o.titre)}</a>`;
};
/** Les premiers mots d'un effet du Mode Hyper de la base, rendu comme au build (GuideBloc.astro#effetEnHtml : test/aide-texte-affiche.mjs) puis affiché. */
const premiersMots = async (texte, n = 6) => premiersMotsAffiches(await htmlParLignes(texte, db), n);
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
  // chaque page du guide de la base est construite (le site de dev en crée et en supprime : le nombre suit la base, pas un seuil)
  const duGuide = db.prepare("SELECT id, statut FROM page WHERE type = 'guide'").all().filter((p) => process.env.HIDE_EXAMPLES !== '1' || p.statut !== 'example');
  assert.ok(pagesConstruites.length > 0, `${pagesConstruites.length} pages construites`);
  assert.deepEqual(duGuide.map((p) => p.id).filter((id) => !pageDe(id)), [], 'les pages du guide de la base qui ne sont pas construites');
  for (const p of pagesConstruites) {
    const main = sansLeScriptDesOnglets(lire(cheminDePage(p.id)).main);
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
  // une page du menu d'un onglet : l'onglet où la base la range (le site de dev la déplace)
  // (les deux dernières ne sont pas protégées : le site de dev peut les supprimer, entrée de menu comprise ; ce cas se vérifie, puis la page passe)
  for (const id of ['guide/premiers-sorts', 'guide/meteo', 'guide/les-degats', 'guide/les-pieges']) {
    if (!pageDe(id)) {
      assert.ok(historiqueSite(db).supprimee('page', { id }), `${id} : absente du site construit sans que le site de dev l’ait supprimée`);
      continue;
    }
    assert.equal(fil(cheminDePage(id).slice(0, -1)), filDeLOnglet(id), id);
  }
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
  // Un mot-clé coloré d'une partie (sa balise, son mode complet, sa bulle) et la feuille des mots-clés colorés (`<style data-couleurs-mots-cles>` de
  // layouts/Base.astro, sur chaque page : skill zone-mots-cles-liens) ne colorent pas la page : ils sont mis à part.
  if (partieDeLaPage(page.id) === null) {
    const DU_MOT_CLE = new Set(['mot-cle', 'mot-cle-definition', 'bulle']);
    const classesDesParties = [...html.matchAll(/class="([^"]*\bcouleur-partie-[^"]*)"/g)].map(([, c]) => c.split(/\s+/))
      .filter((classes) => !classes.some((c) => DU_MOT_CLE.has(c)));
    assert.deepEqual(classesDesParties, [], `${chemin} : aucune classe des parties`);
    assert.doesNotMatch(html.replace(/<style[^>]*\bdata-couleurs-mots-cles\b[^>]*>[\s\S]*?<\/style>/g, ''), /\.couleur-partie-[a-z-]+\{/, `${chemin} : ni leur feuille`);
  }
  // le menu se lit sans JavaScript : ouvert dans le HTML construit (le script ne le replie que sur petit écran)
  assert.match(menu, /<details class="lateral-menu__repli" open data-lateral-repli>/, `${chemin} : ouvert sans JavaScript`);
  assert.doesNotMatch(sansLeScriptDesOnglets(main), /<script[^>]*\bsrc=|<script type="module"/, `${chemin} : aucun script de page importé (un script en ligne)`);
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
  // le Lexique (2026-11-05, migration 0090) : plus construit, son adresse mène au Glossaire, /regles/glossaire/ (R190 ; page 404 : test/site-html.test.mjs)
  assert.ok(!existsSync(join(dist, 'regles', 'lexique')), '/regles/lexique/ n’est plus construite');
  // la fixture (status: example), si elle est construite : son adresse de repli, sans menu latéral
  if (existsSync(join(dist, 'regles', 'utiliser-ce-wiki'))) assert.doesNotMatch(lire('regles/utiliser-ce-wiki').main, /class="lateral/);
});

test('les tableaux viennent de la base : progression, postures, compétences, magies, personnages fil rouge (la page qui appelle le bloc)', options, () => {
  const lireBloc = (bloc) => lire(cheminDePage(pageDuBloc(bloc).id)).main;
  // le bloc « niveaux » peut n'être appelé par aucune page : celle qui l'appelait (La montée de niveau) est retirée par la migration 0122, et le
  // propriétaire le rappelle dans « Fiche de personnage : Expérience/Niveau global » (test/guide.test.mjs#NON_APPELES)
  if (pageDuBloc('niveaux')) {
    const niveaux = lireBloc('niveaux');
    assert.equal((niveaux.match(/<tr>\s*<th scope="row">\d+<\/th>/g) ?? []).length, 20);
    assert.match(niveaux, /460\s250/, 'XP du niveau 20 (espace fine insécable de toLocaleString)');
  }
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
  // la caractéristique du Feu (+1 en Social à l'import : test/aide-base-d-import.mjs) ; la page montre celle de la base courante
  assert.equal(texteDImport('magie', { id: 'magies/magie-du-feu' }, 'caracteristique_id'), 'social', '+1 en Social du Feu, à l’import');
  const feu = db.prepare("SELECT c.id, c.nom FROM magie m JOIN caracteristique c ON c.id = m.caracteristique_id WHERE m.id = 'magies/magie-du-feu'").get();
  assert.ok(lireBloc('magie-bonus').includes(`<span class="guide-carac couleur-caracteristique-${feu.id}">${echappe(feu.nom)}</span>`), `+1 en ${feu.nom} du Feu`);
  for (const html of [postures, competences]) assert.doesNotMatch(html, /class="guide-(?:posture|competences__groupe|carac)[^"]*" style=/, 'aucune couleur en style');
  const attributs = lireBloc('fil-rouge-attributs');
  assert.ok((attributs.match(/class="guide-fil-rouge__perso"/g) ?? []).length >= 4);
  // la santé du guerrier orios, terme à terme (comme components/guide/GuideBloc.astro) : à l'import, 20 + 9 + 10 = 39 (test/aide-base-d-import.mjs) ; la
  // page rend les valeurs de la base courante (le site de dev les modifie)
  const calcul = (termes, total) => `${termes.filter(([v], i) => i === 0 || v).map(([v, d]) => `${v ?? 0} ${d}`).join(' + ')} = ${total}`;
  const santeDe = (p) => calcul([[p.race.sante, 'de la race'], [p.classe.sante, 'de la classe'], [p.magie?.sante, 'de la magie'], [p.ethnie?.sante, 'de l’ethnie']], p.attributs.sante);
  const guerrierOrios = (base) => chargerFilRouge(base).find((p) => p.race.id === 'races/orios' && p.classe.id === 'classes/guerrier');
  assert.equal(santeDe(guerrierOrios(baseDImport())), '20 de la race + 9 de la classe + 10 de la magie = 39', 'santé du guerrier orios, à l’import');
  assert.ok(attributs.includes(echappe(santeDe(guerrierOrios(db)))), 'santé du guerrier orios');
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

// Décision R187 (2) (demande du propriétaire du 2026-11-06 : « Dans le mode hyper rajoute un tableau qui liste les diffents bonus des magie et des races en
// récupérant directement l'information depuis la DB. ») : sous « Ce qu’il donne » de « Le mode hyper », le tableau des magies (« Magie | Mono-Magie |
// Bi-magie », le Potentiel Illimité sur une ligne « Forme Complète » dont la case tient les deux colonnes) puis celui des races (« Race | Capacité |
// Effet ») ; chaque nom mène à sa page ; une ligne par effet de mode_hyper_effet (lib/guide-db.mjs#chargerModeHyper).
test('R187 (2) : « Le mode hyper » montre les deux tableaux du Mode Hyper, magies puis races, sous « Ce qu’il donne », tirés de la base', options, async () => {
  const page = lire(cheminDePage('guide/le-mode-hyper')).main;
  const region = (nom) => {
    const debut = page.indexOf(`role="region" aria-label="Mode Hyper : ${nom}"`);
    assert.ok(debut > 0, nom);
    return page.slice(debut, page.indexOf('</table>', debut));
  };
  const magies = region('l’effet de chaque magie');
  const races = region('la capacité de chaque race');
  // sous « Ce qu’il donne », avant « Ce qu’il coûte » : la place du bloc dans le texte de la page, que le site de dev réécrit (intertitres compris) ; à
  // l'import (test/aide-base-d-import.mjs) ; la page rend les deux tableaux, magies puis races
  const morceaux = morceauxDuChapitre(texteDImport('page', { id: 'guide/le-mode-hyper' }, 'corps_md'));
  const i = morceaux.findIndex((m) => m.bloc === 'mode-hyper');
  const avant = morceaux.slice(0, i).map((m) => m.markdown ?? '').join('\n');
  const apres = morceaux.slice(i + 1).map((m) => m.markdown ?? '').join('\n');
  const donne = avant.search(/^## Ce qu['’]il donne\s*$/m);
  assert.ok(i > 0 && donne >= 0 && !/^## /m.test(avant.slice(donne + 3)), 'sous « Ce qu’il donne », à l’import');
  assert.match(apres, /^## Ce qu['’]il coûte\s*$/m, 'avant « Ce qu’il coûte », à l’import');
  assert.ok(page.indexOf('Mode Hyper : l’effet de chaque magie') < page.indexOf('Mode Hyper : la capacité de chaque race'), 'magies puis races');
  // le gabarit commun des tableaux, dans sa zone qui défile
  for (const html of [magies, races]) assert.match(page.slice(page.lastIndexOf('<div ', page.indexOf(html)), page.indexOf(html)), /^<div class="guide-defile tableau tableau--defile" tabindex="0"/);
  const entetes = (html) => [...html.slice(html.indexOf('<thead>'), html.indexOf('</thead>')).matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes(magies), ['Magie', 'Mono-Magie', 'Bi-magie']);
  assert.deepEqual(entetes(races), ['Race', 'Capacité', 'Effet']);
  // une ligne par magie et par race de la base (lectures onglet_magie, onglet_race), chacune liée à sa page
  const nMagies = db.prepare("SELECT count(DISTINCT magie_id) AS n FROM mode_hyper_effet WHERE version = 'onglet_magie'").get().n;
  const nRaces = db.prepare("SELECT count(*) AS n FROM mode_hyper_effet WHERE version = 'onglet_race'").get().n;
  assert.equal((magies.match(/<tr class="couleur-magie-[\w-]+">/g) ?? []).length, nMagies);
  assert.equal((races.match(/<tr>\s*<th scope="row"><a href=/g) ?? []).length, nRaces);
  // les textes sont ceux de la base courante (lib/guide-db.mjs#chargerModeHyper ; le site de dev les réécrit) : le Feu, son nom lié à sa page, Mono-Magie
  // puis Bi-magie
  const hyper = chargerModeHyper(db);
  const ligne = (html, debut) => html.slice(html.indexOf(debut), html.indexOf('</tr>', html.indexOf(debut)));
  const feu = hyper.magies.lignes.find((m) => m.id === 'magies/magie-du-feu');
  const ligneDuFeu = ligne(magies, '<tr class="couleur-magie-feu">');
  assert.match(ligneDuFeu, new RegExp(`^<tr class="couleur-magie-feu">\\s*<th scope="row">\\s*<a class="guide-magie guide-magie--ligne" href="[^"]*/magies/magie-du-feu/">[\\s\\S]*?>${echappe(feu.nom)}</span>\\s*</a>\\s*</th>\\s*<td>[\\s\\S]*</td>\\s*<td>[\\s\\S]*</td>\\s*$`),
    'le Feu : son nom (celui du site) lié à sa page, deux cases');
  const cases = ligneDuFeu.split('<td>').slice(1).map(texteAffiche);
  for (const [k, c] of feu.cellules.entries()) {
    const debut = await premiersMots(c.effet);
    assert.ok(cases[k].includes(debut), `le Feu, case ${k + 1} : « ${debut} »`);
  }
  // le Potentiel Illimité : une seule case sur les deux colonnes, son intitulé (« Forme Complète ») en tête
  const pi = hyper.magies.lignes.find((m) => m.id === 'magies/potentiel-illimite');
  const ligneDuPi = magies.slice(magies.lastIndexOf('<tr', magies.indexOf('/magies/potentiel-illimite/')), magies.indexOf('</tr>', magies.indexOf('/magies/potentiel-illimite/')));
  assert.match(ligneDuPi, new RegExp(`<td colspan="2">\\s*<strong>${echappe(pi.cellules[0].intitule)} :</strong>`));
  assert.ok(texteAffiche(ligneDuPi).includes(await premiersMots(pi.cellules[0].effet)), 'le Potentiel Illimité : son effet');
  assert.equal((magies.match(/colspan=/g) ?? []).length, 1, 'une seule case fusionnée');
  // une race : son nom lié à sa page, sa capacité, son effet
  const humain = hyper.races.lignes.find((r) => r.id === 'races/humain');
  const ligneHumain = ligne(races, '/races/humain/');
  assert.ok(ligneHumain.startsWith(`/races/humain/">${echappe(humain.nom)}</a></th>`), 'l’Humain : son nom lié à sa page');
  assert.match(ligneHumain, new RegExp(`<td class="guide-hyper__capacite">${echappe(humain.capacite)}</td>\\s*<td>`), 'sa capacité');
  assert.ok(texteAffiche(ligneHumain).includes(await premiersMots(humain.effet)), 'son effet');
  // un retour à la ligne d'un effet est gardé ; une balise du glossaire est rendue (le middleware), jamais laissée telle quelle
  const surDeuxLignes = hyper.magies.lignes.flatMap((m) => m.cellules).filter((c) => /\S\n\S/.test(c.effet.trim()));
  assert.equal((magies.match(/<br \/>/g) ?? []).length >= surDeuxLignes.length, true, 'un retour à la ligne par effet écrit sur deux lignes');
  assert.doesNotMatch((magies + races).replace(/ data-balise="[^"]*"/g, ''), /\{\{/, 'balises rendues (la forme source ne reste que dans data-balise)');
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
  assert.deepEqual(entrees.map((e) => e[0]), entreesDuMenuLateral(ongletsDesRegles().find((o) => o.id === 'exploration'), pagesConstruites).map((e) => `/${e.id ? cheminDePage(e.id) : e.adresse}`));
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

// Migration 0123, demande du propriétaire : « Réunis toutes les informations dans la page /regles/alignement/ Liste les 9 allignements sous forme de
// tableau (ou de tuile) à onglet ou chaque onglet a la couleur de l'alignement. » : les neuf sections `###` à ancre figée de « Alignement » sont les
// onglets d'une barre (components/guide/PageDuGuide.astro, lib/guide-onglets.mjs, components/Onglets.astro), chacun dans la classe de couleur de son
// alignement (palette, famille `alignement`). Le déclencheur est l'ancre figée, jamais le texte de l'intertitre.
test('« Alignement » : les neuf alignements en onglets colorés, un panneau par section au texte entier, l’adresse #<ancre> y mène ; script des onglets posé une fois', options, async () => {
  const classes = new Map(Object.keys(COULEURS_ALIGNEMENTS).map((nom) => [idDeCouleur(nom), classeDAlignement(nom)]));
  const ancres = new Set(classes.keys());
  const decoupe = (corps) => morceauxDuChapitre(corps).filter((m) => 'markdown' in m).map((m) => decouperEnOnglets(m.markdown, ancres)).find(Boolean) ?? null;
  const id = 'guide/alignement';

  // à l'import : neuf sections, une par alignement de la palette, dans l'ordre de la grille (LB, LN, LM, NB, N, NM, CB, CN, CM) ; la phrase de clôture sort du dernier
  const dImport = decoupe(texteDImport('page', { id }, 'corps_md'));
  assert.ok(dImport, 'l’import découpe la page en onglets');
  assert.equal(dImport.panneaux.length, 9);
  assert.deepEqual(dImport.panneaux.map((p) => p.ancre), [...classes.keys()]);
  assert.ok(dImport.etiquette && dImport.avant.includes(`{#${dImport.etiquette}}`), 'la barre est nommée par le dernier intertitre à ancre de l’introduction');
  assert.ok(dImport.apres.trim() && !dImport.panneaux.at(-1).markdown.includes(dImport.apres), 'la phrase finale en gras suit les onglets, hors du dernier panneau');

  // la page construite suit la base courante : ses sections, dans l'ordre du texte
  const page = pageDe(id);
  assert.ok(page, 'Alignement est construite (page protégée : elle absorbe Les neuf alignements)');
  const attendu = decoupe(page.corps_md);
  const { html, main } = lire(cheminDePage(id));
  const onglets = [...main.matchAll(/<a class="([^"]*)" id="onglet-([^"]+)" href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const panneaux = [...main.matchAll(/<section class="onglets-guide__panneau ([^"]*)" id="([^"]+)">([\s\S]*?)<\/section>/g)];
  assert.equal((html.match(/onglets:brancher/g) ?? []).length, attendu ? 1 : 0, 'le script d’Onglets.astro, posé une fois');
  assert.equal((main.match(/data-onglets(?=[\s>=])/g) ?? []).length, attendu ? 1 : 0, 'un seul groupe d’onglets');
  if (!attendu) return assert.equal(onglets.length + panneaux.length, 0, 'sans section à ancre d’alignement, pas d’onglets');
  assert.equal(onglets.length, attendu.panneaux.length);
  assert.equal(panneaux.length, attendu.panneaux.length);
  assert.deepEqual(onglets.map((o) => o[2]), attendu.panneaux.map((p) => p.ancre), 'un onglet par section, dans l’ordre du texte');
  for (const [i, p] of attendu.panneaux.entries()) {
    const [, classe, ancre, href, titre] = onglets[i];
    const couleur = classes.get(p.ancre);
    // l'onglet : la classe de couleur de la palette (jamais un style), il mène à son panneau ; le premier est ouvert, lui seul
    assert.deepEqual(classe.split(/\s+/).filter((c) => c.startsWith('couleur-')), [couleur], `${p.ancre} : la classe de couleur de l’alignement`);
    assert.ok(classe.split(/\s+/).includes('onglet'), `${p.ancre} : la classe que le script des onglets prend`);
    assert.equal(classe.split(/\s+/).includes('is-active'), i === 0, `${p.ancre} : onglet ouvert au départ`);
    assert.equal(href, p.ancre);
    assert.equal(ancre, p.ancre);
    // le panneau : l'id de l'ancre (une adresse `#<ancre>` ou un mot-clé y mène), la même classe de couleur, son texte entier
    const [, classePanneau, idPanneau, interieur] = panneaux[i];
    assert.equal(idPanneau, p.ancre);
    assert.equal(html.split(`id="${p.ancre}"`).length - 1, 1, `${p.ancre} : l’id n’est qu’une fois dans la page (l’intertitre du panneau ne le double pas)`);
    assert.deepEqual(classePanneau.split(/\s+/).filter((c) => c.startsWith('couleur-')), [couleur], `${p.ancre} : le panneau reprend la couleur`);
    assert.equal(classePanneau.split(/\s+/).includes('is-active'), i === 0, `${p.ancre} : panneau ouvert au départ`);
    assert.match(interieur, new RegExp(`<h3[^>]*\\sdata-ancre-figee="${p.ancre}"`), `${p.ancre} : l’intertitre garde son ancre figée (l’éditeur la réécrit)`);
    const rendu = avecLesMotsCles(await rendreCommeLeGuide(p.markdown), db);
    assert.equal(texteAffiche(interieur).trim(), texteAffiche(rendu).trim(), `${p.ancre} : tout le texte de la section`);
    assert.equal((interieur.match(/<table/g) ?? []).length, (rendu.match(/<table/g) ?? []).length, `${p.ancre} : ses tableaux`);
    // l'onglet porte le nom de l'intertitre tel qu'il est maintenant (il se renomme sur le site de dev)
    assert.equal(texteAffiche(titre).trim(), texteAffiche(interieur.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)[1]).trim(), `${p.ancre} : le nom de l’onglet`);
  }
  // l'introduction reste au-dessus de la barre, la phrase de clôture et la suite après les panneaux ; la barre est nommée par l'intertitre qui la précède
  const barre = main.indexOf('<div class="onglets-guide"');
  assert.ok(barre > 0 && main.indexOf('<nav class="onglets-guide__liste"') > barre);
  if (attendu.etiquette) {
    assert.ok(main.indexOf(`id="${attendu.etiquette}"`) > 0 && main.indexOf(`id="${attendu.etiquette}"`) < barre, 'l’intertitre qui nomme la barre est au-dessus');
    assert.match(main, new RegExp(`<nav class="onglets-guide__liste" aria-labelledby="${attendu.etiquette}"`));
  }
  const apres = main.slice(main.lastIndexOf('</section>'));
  if (attendu.apres.trim()) assert.ok(texteAffiche(apres).includes(texteAffiche(avecLesMotsCles(await rendreCommeLeGuide(attendu.apres), db)).trim()), 'la phrase finale, après le dernier panneau');
  // la feuille des alignements (famille de zone de la palette) : posée avec les classes, une seule fois (hors la feuille des mots-clés colorés)
  assert.equal(main.split(`<style>${cssDesAlignements()}</style>`).length - 1, 1, 'la feuille des alignements, une fois');
  assert.doesNotMatch(main, /style="[^"]*(?:color|couleur|background)/, 'aucune couleur écrite en style');
  // Q5 « Ancre = pas de couleur » : les mots-clés des alignements mènent à une section (adresse à ancre), ils ne colorent pas la page entière ; la page prend
  // la couleur d'un mot-clé coloré qui mène à elle, sans ancre, s'il y en a un, sinon l'accent du site
  const motCle = motCleDeLaPage(chargerVocabulaire(db), `/${cheminDePage(id)}`);
  const classeDeLaPage = classeDuMotCle(motCle);
  assert.ok(!classeDeLaPage || !classeDeLaPage.startsWith('couleur-alignement-') || !motCle.url.includes('#'), 'jamais la couleur d’un mot-clé à ancre');
  assert.ok(main.includes(classeDeLaPage ? `<div class="guide-reference guide-reference--couleur ${classeDeLaPage}">` : '<div class="guide-reference">'), 'la couleur de la page');

  // le mode modification : la barre est ignorée de l'éditeur (data-ed-ignorer), le groupe et les panneaux sont transparents — le Markdown relu du morceau
  // est celui qu'on relit du rendu à plat (aucune perte à l'enregistrement : lib/markdown-edition.mjs#versMarkdown)
  const trouver = (noeuds) => noeuds.flatMap((n) => {
    if (n.type !== 'element') return [];
    const contient = (e) => e.enfants?.some((c) => c.type === 'element' && ((c.attributs.class ?? '').split(/\s+/).includes('onglets-guide') || contient(c)));
    return n.attributs['data-ed-morceau'] !== undefined && contient(n) ? [n] : trouver(n.enfants ?? []);
  });
  const [morceau] = trouver(enfantsDuHtml(html));
  assert.ok(morceau, 'le morceau de texte modifiable qui porte les onglets');
  const barreIgnoree = (noeuds) => noeuds.some((n) => n.type === 'element' && (((n.attributs.class ?? '').split(/\s+/).includes('onglets-guide__liste') && n.attributs['data-ed-ignorer'] !== undefined) || barreIgnoree(n.enfants ?? [])));
  assert.ok(barreIgnoree([morceau]), 'la barre d’onglets est ignorée de l’éditeur');
  const morceauSource = morceauxDuChapitre(page.corps_md).find((m) => 'markdown' in m && decouperEnOnglets(m.markdown, ancres)).markdown;
  const aPlat = versMarkdown(enfantsDuHtml(avecLesMotsCles(await rendreCommeLeGuide(morceauSource), db)));
  assert.equal(versMarkdown(morceau.enfants), aPlat, 'le Markdown relu du morceau en onglets est celui du rendu à plat');
});
