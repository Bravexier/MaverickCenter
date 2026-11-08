// La page Armes construite, /ressources/armes/ (dist/ ; l'onglet Armes de la page « Équipement » du 2026-10-16 au 2026-10-29 : test/equipement-html.test.mjs pour la page et
// ses onglets) : rendu depuis les tables (pas de tableau Markdown), un seul tableau affiché et un menu latéral des familles, une seule liste, mêlée puis
// distance (demandes du propriétaire, 2026-11-05 : « un menu lattéral sur la gauche », « Liste unique »), une entrée et un tableau par famille sans les
// armes de monstres, les colonnes voulues par le propriétaire, les lignes de départ en bleu avec leur infobulle, la description en infobulle du nom, les compétences
// en couleur (décision R48) et leur filtre, le panneau de règles (migration 0056 : ses blocs dans l'ordre de la base, tuiles et leurs titres, la mise
// en forme du classeur), les matériaux dans leur couleur, les améliorations, les champs du mode modification (une famille : nom, dé, en-tête de coût,
// décision R159), le menu gardé en mode modification, les modèles d'une famille créée (le même HTML que celui d'une famille de la base), l'infobulle
// du dé d'une famille (les paliers selon la Force que sa note écrit : PUGILAT ; demande du propriétaire, 2026-10-23). Se saute
// sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMPETENCES_D_ARME } from '../src/lib/arme-champs.mjs';
import { ancreDArme, ancreDeMateriau, chargerArmes, contexteDesArmes } from '../src/lib/armes-db.mjs';
import {
  ancreDArmeElementaire, COLONNES_D_UNE_ARME, htmlDeFamilleDepuisModele, htmlDeLigneDArmeElementaire, htmlDesEffets, htmlDuCoutElementaire, MODELE_DE_FAMILLE,
  RENDUS_DES_ARMES,
} from '../src/lib/armes-rendu.mjs';
import { texteDuCoutElementaire } from '../src/lib/arme-forge.mjs';
import { CLASSE_DES_ARMES_DE_DEPART, classeDeMagie, classeDeMateriau, cssDesFamilles } from '../src/lib/palette-css.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { desSelonLaForce } from '../src/lib/maitrise-arme.mjs';
import { chargerPanneau } from '../src/lib/panneaux-regles-db.mjs';
import { htmlAvecMotsCles, texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { chargerVocabulaire } from '../src/lib/mots-cles-db.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { idDuMotCleNomme } from './aide-mots-cles.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'armes', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
// le panneau de la page Armes : de sa <section> à la fin du contenu (components/equipement/EquipementPage.astro)
const main = html.slice(html.indexOf('<section class="equipement-panneau" id="armes"'), html.indexOf('</main>'));
const base = present ? ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }) : null;
const armes = present ? chargerArmes(base) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
// les balises du glossaire, rendues par le middleware (src/middleware.mjs) : en gras dans le texte, en texte simple dans un attribut
const vocabulaire = present ? chargerVocabulaire(base) : [];
const commeLaPage = (h) => htmlAvecMotsCles(h, vocabulaire).html;
// l'infobulle de la pastille du dé d'une famille : les paliers selon la Force que sa note écrit, lus dans la base (PUGILAT : « D6 1-2 Force, D8 3-4
// Force, D10 5 Force »), écrits comme le refus du dé du service ; sinon celle de toute famille
const INFOBULLE_PAR_DEFAUT = 'Dé de la famille, sauf indication contraire';
const infobulleDuDe = (f) => {
  const paliers = desSelonLaForce(f.note_brut);
  return paliers ? `Dé selon la Force : ${paliers.map((p) => `${p.de} ${p.min === p.max ? p.min : `${p.min}-${p.max}`} Force`).join(', ')}` : INFOBULLE_PAR_DEFAUT;
};
// la catégorie de chaque famille, lue dans la base (arme_famille.categorie, décision R127) : le menu range les familles de mêlée (`contact`), puis celles à distance
const categorie = present ? Object.fromEntries(base.prepare('SELECT id, categorie FROM arme_famille').all().map((r) => [r.id, r.categorie])) : {};
const famillesAffichees = present ? ['contact', 'distance'].flatMap((c) => armes.familles.filter((f) => categorie[f.id] === c)) : [];

test('pas de tableau Markdown : l’onglet est le gabarit des armes, avec son panneau de règles replié et sans phrase au-dessus', options, () => {
  assert.ok(main.length > 1000, 'le panneau de l’onglet Armes');
  assert.match(main, /<div class="armes couleur-arme-depart" data-armes>(?:<template data-armes-piece="[A-Z]+">[\s\S]*?<\/template>)*<details class="preg" id="regles-armes" data-panneau-regles="armes">/, 'le panneau en tête');
  assert.ok(!main.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  assert.ok(!main.includes('armes__chapo'), 'plus de chapeau (demande du propriétaire, 2026-10-16)');
});

test('un menu latéral, une seule liste (« Liste unique ») : mêlée puis distance (R127), une entrée par famille ; un seul tableau affiché (demandes du propriétaire, 2026-11-05)', options, () => {
  // « plutôt que 2 tableaux à onglet j'aimerai que tu n'affiche qu'un seul tableau et que tu ajoute un menu lattéral sur la gauche comme pour la page
  // chronologie et les bases » ; « Liste unique » : ni titres de groupe ni barres d'onglets
  assert.ok(!main.includes('data-onglets'), 'plus de groupe d’onglets sur la page');
  assert.ok(!/class="onglet[ "]/.test(main) && !main.includes('armes-onglets') && !main.includes('armes-bloc'), 'plus d’onglets ni de menus à onglets');
  assert.ok(!main.includes('Armes de mêlée') && !main.includes('Armes à distance'), 'pas de titre de groupe');
  // le menu à gauche, puis les tableaux, puis le panneau de l'arme ; replié dans un <details> sur petit écran, ouvert au build (sans JavaScript)
  const ordre = ['<div class="armes-vue">', '<nav class="armes-menu"', '<div class="armes-tableaux">', '<aside class="armes-cote"'].map((x) => main.indexOf(x));
  assert.ok(ordre[0] > 0 && ordre.every((x, i) => i === 0 || x > ordre[i - 1]), 'menu | tableaux | panneau de l’arme');
  assert.match(main, /<nav class="armes-menu" aria-label="Familles d’armes" data-armes-menu><details class="armes-menu__repli" open data-armes-repli><summary class="armes-menu__resume"><span class="armes-menu__resume-rubrique">Familles d’armes<\/span> <span class="armes-menu__resume-famille" data-armes-menu-affichee>[^<]+<\/span><\/summary><ul class="armes-menu__liste">/);
  const menu = main.slice(main.indexOf('<ul class="armes-menu__liste">'), main.indexOf('</nav>'));
  // le nom et le dé suivent ceux du tableau en mode modification (data-ed-lecture, R159) ; le dé toujours écrit, caché s'il est vide
  const lecture = (colonne) => `data-ed-lecture="\\[&quot;arme_famille&quot;,\\{&quot;id&quot;:&quot;\\1&quot;\\},&quot;${colonne}&quot;\\]"`;
  const motif = new RegExp(`<li class="armes-menu__entree"><a class="armes-menu__lien" id="armes-menu-famille-([^"]+)" href="#famille-([^"]+)"( aria-current="true")?><span class="armes-menu__nom" ${lecture('nom')}>([^<]+)</span><span class="armes-menu__de" title="[^"]+" ${lecture('de_brut')}( hidden)?>([^<]*)</span><span class="armes-menu__compte" data-armes-menu-compte>([^<]+)</span></a></li>`, 'g');
  const entrees = [...menu.matchAll(motif)];
  assert.equal(entrees.length, (menu.match(/<li /g) ?? []).length, 'la liste n’a que ses entrées');
  for (const m of entrees) assert.equal(Boolean(m[5]), !m[6], `${m[1]} : la pastille du dé cachée si et seulement si elle est vide`);
  // l'ordre : les familles de mêlée, puis celles à distance, chacune dans l'ordre de la base (chargerArmes)
  assert.deepEqual(entrees.map((m) => m[1]), famillesAffichees.map((f) => f.id), 'mêlée puis distance, dans l’ordre de la base');
  assert.ok(famillesAffichees.some((f) => categorie[f.id] === 'contact') && famillesAffichees.some((f) => categorie[f.id] === 'distance'));
  assert.ok(entrees.every((m) => m[1] === m[2]), 'chaque entrée vers #famille-<id>');
  // son nom, la pastille de son dé, son nombre d'armes (toutes les lignes du tableau, armes élémentaires comprises : R167)
  const n = (f) => f.armes.length + f.armes_elementaires.length;
  assert.deepEqual(entrees.map((m) => [m[4], m[6] || null, m[7]]), famillesAffichees.map((f) => [echapper(f.nom), f.de_brut ? echapper(f.de_brut) : null, `${n(f)} arme${n(f) > 1 ? 's' : ''}`]));
  assert.deepEqual(entrees.map((m) => Boolean(m[3])), famillesAffichees.map((_, k) => k === 0), 'une seule entrée marquée (aria-current), la première');
  assert.equal(main.match(/data-armes-menu-affichee>([^<]+)</)[1], echapper(famillesAffichees[0].nom), 'le résumé du menu replié : la famille affichée');
  // les tableaux : tous à la suite dans .armes-tableaux (sans JavaScript, on les lit l'un après l'autre), dans l'ordre du menu, un seul affiché (is-active)
  const tableaux = main.slice(ordre[2], ordre[3]);
  const panneaux = [...tableaux.matchAll(/<(details|section) class="tableau armes-famille( is-active)?" id="famille-([^"]+)"/g)];
  assert.deepEqual(panneaux.map((m) => m[3]), famillesAffichees.map((f) => f.id), 'les tableaux, dans l’ordre du menu');
  assert.ok(panneaux.every((m) => m[1] === 'section'), 'plus de tableau repliable');
  assert.deepEqual(panneaux.map((m) => Boolean(m[2])), famillesAffichees.map((_, k) => k === 0), 'un seul tableau affiché, le premier');
  // toutes les familles de la page, sans les armes de monstres (R45)
  assert.deepEqual(panneaux.map((m) => m[3]).sort(), armes.familles.map((f) => f.id).sort(), 'chaque famille une fois');
  assert.ok(!panneaux.some((m) => m[3] === 'arme-de-monstres'));
  // plus de « Tout déplier » ni « Tout replier » : les tableaux ne se replient plus
  assert.ok(!main.includes('Tout déplier') && !main.includes('Tout replier') && !main.includes('data-armes-tout'));
});

test('le menu sur le modèle de celui des Bases : collé en haut, l’entrée affichée teintée de l’accent ; replié sous 56rem par un script en ligne sans import ; le panneau de l’arme large comme celui des armures quand tout tient, plus étroit sur écran moyen', options, () => {
  const regle = (selecteur) => {
    const i = html.indexOf(`${selecteur} {`);
    assert.ok(i > 0, selecteur);
    return html.slice(i, html.indexOf('}', i));
  };
  assert.match(regle("html.js .armes-menu__lien[aria-current='true']"), /border-left-color: var\(--accent\)/);
  assert.match(html, /\.armes-menu \{\s*position: sticky;/, 'collé en haut pendant qu’on lit');
  // au plus 38 % de la vue, comme .armures-vue (« Avoir l'endroit de l'arme en permanence visible […] avec la même largeur »), le menu compris dans la
  // vue ; sur écran moyen, jusqu'à 16rem (réponse du propriétaire, 2026-11-05 : « Panneau de l'arme plus étroit »), le tableau gardant d'abord ce que
  // demandent ses 8 colonnes (--armes-tableau-min) ; le résumé du menu replié, ses deux morceaux séparés (un espace, l'écart de la boîte flexible)
  const vue = regle('  html.js .armes-vue');
  assert.match(vue, /--armes-tableau-min: 52\.5rem;/);
  assert.match(vue, /grid-template-columns: minmax\(11rem, 14rem\) minmax\(min\(var\(--armes-tableau-min\), 100% - 11rem - 16rem - 2 \* var\(--armes-ecart\)\), 1fr\) minmax\(16rem, 38%\);/);
  assert.match(html, /\.armes-cote__tables \{[^}]*minmax\(min\(18rem, 100%\), 1fr\)/, 'les tableaux du panneau à sa largeur quand il est étroit');
  assert.match(html, /\.armes-menu__resume \{[^}]*gap: 0\.1rem 0\.6rem;/);
  assert.ok(html.includes('html.js .armes-tableaux > .armes-famille:not(.is-active) { display: none; }'), 'un seul tableau, sous html.js seulement');
  const petit = html.slice(html.indexOf('@media (max-width: 56rem) {', html.indexOf('.armes-menu')));
  assert.match(petit.slice(0, 300), /grid-template-areas: 'menu' 'tableaux' 'cote'/, 'petit écran : le menu au-dessus du tableau');
  // le script du repli : en ligne, juste après le menu, sans import (aucun module partagé entre scripts de page)
  const script = main.slice(main.indexOf('</nav>', main.indexOf('<nav class="armes-menu"')), main.indexOf('<div class="armes-tableaux">'));
  assert.match(script, /<script>[\s\S]*data-armes-repli[\s\S]*matchMedia\('\(max-width: 56rem\)'\)[\s\S]*<\/script>/);
  assert.doesNotMatch(script, /\bimport\b/);
});

test('une ligne par arme, dans l’ordre de l’onglet (mêlée, puis distance) ; identifiants uniques', options, () => {
  const lignes = [...main.matchAll(/<tr class="arme(?: arme--depart)?" id="([^"]+)" data-arme=/g)].map((m) => m[1]);
  assert.deepEqual(lignes, famillesAffichees.flatMap((f) => f.armes.map((a) => ancreDArme(a.id))));
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('colonnes : Nom, Compétence, Type, Dégâts, Type de dégâts, Portée, Solidité, Origine ; Description, Coût, Effet, départ et Remarque en mode modification', options, () => {
  const tete = main.slice(main.indexOf('<thead>'), main.indexOf('</thead>'));
  const colonnes = [...tete.matchAll(/<th scope="col"(?: class="ed-seul")?>(.*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
  // « Solidité » partout à la place de « Durabilité » : l'en-tête est le mot-clé du glossaire, sa définition en infobulle (migration 0058)
  // son texte : la balise rendue comme au build avec le vocabulaire de la base (le site de dev renomme le mot-clé ; il n'est pas protégé : supprimé, la
  // balise reste écrite dans le gabarit et le build la rend en texte, ce cas se vérifie explicitement)
  const solidite = htmlAvecMotsCles('{{solidite}}', chargerVocabulaire(base)).html.replace(/<[^>]+>/g, '');
  assert.deepEqual(colonnes.slice(0, 8), ['Nom', 'Compétence', 'Type', 'Dégâts', 'Type de dégâts', 'Portée', solidite, 'Origine']);
  // le mot-clé « Solidité », par son id entier, figé (migration 0113) : sa clé, que citent data-mot-cle et sa bulle, suit son libellé (R232)
  const idSolidite = idDuMotCleNomme('solidite');
  const motSolidite = base.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(idSolidite);
  if (motSolidite) {
    assert.ok(tete.includes(`<th scope="col"><strong class="mot-cle" data-mot-cle="${motSolidite.cle}" data-bulle="mot-cle-${motSolidite.cle}"`));
  } else {
    assert.ok(historiqueSite(base).supprimee('mot_cle', { id: idSolidite }), 'le mot-clé « solidite » manque sans que le site de dev l’ait supprimé');
  }
  assert.ok(!/durabilit/i.test(main.replace(/data-[\w-]*durabilite[\w-]*(="[^"]*")?|arme-bulle-durabilite|arme__durabilite|arme-durabilite/g, '')), 'plus de « durabilité » affichée');
  assert.equal(colonnes.length - 5, COLONNES_D_UNE_ARME);
  assert.equal((tete.match(/class="ed-seul"/g) ?? []).length, 5);
  assert.equal(colonnes.at(-1), 'Remarque');
});

test('effets supplémentaires sur une seconde ligne, sous l’arme (comme l’effet d’un sort choisi dans la fiche) : une par arme, effet en lecture', options, () => {
  for (const a of armes.familles.flatMap((f) => f.armes)) {
    const debut = main.indexOf(`id="${ancreDArme(a.id)}"`);
    const fin = main.indexOf('</tr>', debut) + 5;
    const suite = main.slice(fin, main.indexOf('</tr>', fin) + 5);
    assert.ok(suite.startsWith(`<tr class="arme-suite" data-arme-suite="${echapper(a.id)}"><td class="arme-suite__marge"></td><td class="arme__effets" colspan="${COLONNES_D_UNE_ARME - 1}" data-ed-lecture="${echapper(attributEd('arme', { id: a.id }, 'effet'))}" data-ed-rendu="arme-effets">`), a.id);
    assert.ok(suite.includes(commeLaPage(htmlDesEffets(a.effet))), `${a.id} : ses effets supplémentaires`);
    assert.ok(!main.slice(debut, fin).includes('class="arme__effets"'), `${a.id} : plus dans la ligne de l’arme`);
  }
});

test('armes de départ en bleu avec l’infobulle « Arme de départ » ; description en infobulle du nom ; remarque en étoile ; compétences en couleur', options, () => {
  for (const a of armes.familles.flatMap((f) => f.armes)) {
    const debut = main.indexOf(`id="${ancreDArme(a.id)}"`);
    const ligne = main.slice(main.lastIndexOf('<tr', debut), main.indexOf('</tr>', debut));
    assert.equal(ligne.includes('arme--depart') && ligne.includes('title="Arme de départ"'), a.depart_possible === 1, a.id);
    if (a.description) assert.ok(ligne.includes(`title="${echapper(texteSansBalises(a.description, vocabulaire))}"`), `${a.id} : description en infobulle`);
    assert.ok(ligne.includes(`data-ed="${echapper(attributEd('arme', { id: a.id }, 'effet'))}"`), `${a.id} : effet modifiable`);
    // la remarque (demande du propriétaire, décision R91) : modifiable dans sa colonne, l'étoile à côté du nom refaite depuis la ligne (en lecture)
    assert.ok(ligne.includes(`<td class="arme__remarque-texte ed-seul" data-ed="${echapper(attributEd('arme', { id: a.id }, 'remarque'))}">`), `${a.id} : remarque modifiable`);
    assert.ok(ligne.includes(`<span class="arme__note" data-ed-lecture="${echapper(attributEd('arme', { id: a.id }, 'remarque'))}" data-ed-rendu="arme-remarque">`), `${a.id} : étoile en lecture`);
    assert.equal(ligne.includes('class="arme__remarque"'), Boolean(a.remarque), `${a.id} : une étoile seulement avec une remarque`);
    assert.match(ligne, /<span class="arme-comp[^"]*" data-competences="(arme-lourde|arme-legere|arc|arbalete)( arme-legere)?"/, a.id);
  }
});

test('filtre par compétence (Lourde, Légère, Arc, Arbalète, à bascule, dans la couleur de leur caractéristique : décision R48) et « Arme de départ »', options, () => {
  const debut = main.indexOf('<div class="armes-filtre js-seul" role="group"');
  assert.ok(debut > 0, 'le filtre');
  const filtre = main.slice(debut, main.indexOf('</div>', debut));
  // la couleur : la classe de la caractéristique et celle de son second rang (lib/palette-css.mjs), jamais un style
  const boutons = [...filtre.matchAll(/<button type="button" class="arme-comp armes-filtre__choix (couleur-caracteristique-[\w-]+) couleur-2-caracteristique-[\w-]+" data-competence="([^"]+)" aria-pressed="false" title="([^"]+)">([^<]+)<\/button>/g)]
    .map(([tout, classe, id, titre, libelle]) => [tout, id, classe, titre, libelle]);
  assert.deepEqual(boutons.map((m) => m[1]), Object.keys(COMPETENCES_D_ARME));
  assert.deepEqual(boutons.map((m) => m[4]), ['Lourde', 'Légère', 'Arc', 'Arbalète']);
  const couleur = Object.fromEntries(boutons.map((m) => [m[4], m[2]]));
  assert.equal(couleur.Arc, couleur.Lourde, 'l’Arc a la couleur de la Force, comme l’Arme Lourde');
  assert.notEqual(couleur['Arbalète'], couleur.Lourde);
  assert.deepEqual(couleur, { Lourde: 'couleur-caracteristique-force', Légère: 'couleur-caracteristique-agilite', Arc: 'couleur-caracteristique-force', Arbalète: 'couleur-caracteristique-perception' }, 'R48');
  assert.doesNotMatch(main, /class="arme-comp[^"]*"[^>]*style=/, 'aucune couleur de compétence en style');
  // chaque pastille : la classe de la première caractéristique et le second rang de la seconde (ou de la même), émis par l'onglet
  const pastilles = [...main.matchAll(/<span class="arme-comp(?: arme-comp--deux)? (couleur-caracteristique-[\w-]+) (couleur-2-caracteristique-[\w-]+)"/g)];
  assert.ok(pastilles.length > 0, 'des pastilles de compétence');
  for (const m of pastilles) assert.ok(html.includes(`.${m[2]}{`), `${m[2]} : émise par la page`);
  // une arme de deux compétences (R48) : le premier rang est la caractéristique de sa première compétence, le second celle de la seconde
  // (invariant, quelles que soient les armes du site de dev), et au moins une arme a deux caractéristiques distinctes (le dégradé)
  const caracDe = Object.fromEntries(boutons.map((m) => [m[1], m[2].replace('couleur-caracteristique-', '')]));
  const deux = [...main.matchAll(/<span class="arme-comp arme-comp--deux couleur-caracteristique-([\w-]+) couleur-2-caracteristique-([\w-]+)" data-competences="([^"]+)"/g)];
  assert.ok(deux.length > 0, 'des armes de deux compétences');
  for (const [, premiere, seconde, competences] of deux) {
    const [c1, c2] = competences.split(' ');
    assert.deepEqual([premiere, seconde], [caracDe[c1], caracDe[c2]], competences);
  }
  assert.ok(deux.some(([, premiere, seconde]) => premiere !== seconde), 'au moins un second rang distinct du premier');
  assert.match(filtre, /data-armes-filtre-tout hidden>Toutes</);
  assert.ok(!main.includes('Précision'), 'plus de « Précision »');
  // chaque ligne porte ses compétences, toutes parmi celles du filtre (lib/armes-filtres.mjs les lit)
  for (const m of main.matchAll(/<td class="arme__competence"[^>]*><span class="arme-comp[^"]*" data-competences="([^"]+)"/g)) {
    assert.ok(m[1].split(' ').every((id) => id in COMPETENCES_D_ARME), m[1]);
  }
  assert.match(main, /<span data-armes-compte>\d+ armes<\/span>/);
  // « Arme de départ » : un bouton du filtre (avec JavaScript), la légende sans
  assert.match(filtre, /<button type="button" class="armes-filtre__depart" data-armes-filtre-depart aria-pressed="false" title="[^"]+">Arme de départ<\/button>/);
  assert.match(main, /<p class="armes-legende sans-js"><span class="armes-legende__depart" title="Arme de départ">Arme de départ<\/span><\/p>/);
});

test('panneau de règles (migration 0056) : son titre, ses blocs dans l’ordre de la base (texte ou tuile, titres des tuiles), la mise en forme du classeur, la phrase des armes de départ en bleu', options, () => {
  const panneau = chargerPanneau(base, 'armes');
  const debut = main.indexOf('<details class="preg" id="regles-armes" data-panneau-regles="armes">');
  assert.ok(debut > 0 && panneau);
  const regles = main.slice(debut, main.indexOf('</details>', debut));
  assert.ok(regles.includes(`<summary class="preg__titre"><span data-ed="${attributEd('panneau_regles', { id: 'armes' }, 'titre').replace(/"/g, '&quot;')}">${echapper(panneau.titre)}</span></summary>`), 'le titre, un champ du mode modification');
  const blocs = [...regles.matchAll(/<div class="preg-bloc preg-bloc--(texte|tuile)" data-preg-bloc="(\d+)" data-preg-ordre="(\d+)"/g)].map((m) => [m[1], Number(m[2]), Number(m[3])]);
  assert.deepEqual(blocs, panneau.blocs.map((b) => [b.tuile ? 'tuile' : 'texte', b.rang, b.ordre]));
  const titres = [...regles.matchAll(/<p class="preg-bloc__titre" data-ed-cadre( hidden)?><span data-ed="[^"]+">([^<]*)<\/span><\/p>/g)].map((m) => [m[2], Boolean(m[1])]);
  assert.deepEqual(titres, panneau.blocs.filter((b) => b.tuile).map((b) => [echapper(b.titre ?? ''), !b.titre]), 'le titre de chaque tuile, caché s’il est vide');
  // la mise en forme du classeur, tant que le bloc l'écrit
  if (panneau.blocs.some((b) => b.texte.includes('**Les armes en bleu sont'))) {
    assert.match(regles, /<p class="armes__phrase-depart"><strong>Les armes en bleu sont les armes possibles en arme de départ\.<\/strong><\/p>/);
  }
  if (panneau.blocs.some((b) => b.texte.includes('***CAS PARTICULIERS :***'))) {
    assert.match(regles, /<p><em><strong>CAS PARTICULIERS :<\/strong><\/em><\/p>|<p><strong><em>CAS PARTICULIERS :<\/em><\/strong><\/p>/);
  }
  assert.ok(!/\*{2,3}(Les armes|CAS)/.test(regles), 'aucune marque Markdown laissée telle quelle');
});

test('à côté des tableaux, toujours affiché : la fiche (un seul cadre, vide au départ, remplie par le script), puis les matériaux et les améliorations côte à côte', options, () => {
  const cote = main.slice(main.indexOf('<aside class="armes-cote"'), main.indexOf('</aside>'));
  // « Avoir l'endroit de l'arme en permanence visible comme c'est le cas pour l'armure » (demande du propriétaire, 2026-10-16) : la fiche n'est plus cachée
  assert.match(cote, /^<aside class="armes-cote"[^>]*>\s*<section class="arme-fiche" aria-label="Fiche de l’arme" aria-live="polite">\s*<p class="arme-fiche__vide">Choisissez une arme[^<]+<\/p>\s*<\/section>\s*<div class="armes-cote__tables">\s*<details class="tableau armes-famille armes-materiaux"/);
  assert.match(cote, /<\/details>\s*<details class="tableau armes-famille armes-ameliorations"/);
  assert.ok(!cote.includes('arme-resume') && !cote.includes('armes-cote__haut'), 'plus de second cadre');
  // les infobulles des tuiles de la fiche : écrites par le script hors du panneau, qui défile
  assert.match(main, /<\/aside>\s*<\/div>\s*<div class="armes-bulles" data-armes-bulles><\/div>/);
});

test('matériaux : toute la ligne dans leur couleur, prix en RO, effets en morceaux ; améliorations +1 à +10 sans ligne Total ; le fer est le matériau par défaut', options, () => {
  for (const m of armes.materiaux) {
    // la couleur sur la ligne entière (demande du propriétaire, 2026-10-16 : « La ligne tout entière devrait prendre la couleur du matériau ») : la
    // classe du matériau (lib/palette-css.mjs, famille `materiau`), jamais un style
    assert.ok(main.includes(`<tr class="materiau ligne-couleur ${classeDeMateriau(m.ligne.ressource_id)}" id="${ancreDeMateriau(m.ligne.ressource_id)}" data-materiau="${m.ligne.ressource_id}"${m.defaut ? ' data-defaut="1"' : ''}>`), m.nom);
  }
  assert.ok(!main.includes('<th scope="row" class="materiau__nom" style='), 'plus de couleur sur la seule case du nom');
  assert.doesNotMatch(main, /style="[^"]*--mat\b/, 'plus de --mat en style');
  // l'onglet émet les familles qu'il pose (les matériaux, le bleu des armes de départ, posé sur `.armes`)
  assert.ok(html.includes(`<style>${cssDesFamilles(['materiau', 'arme'])}</style>`), 'la feuille des matériaux et des armes de départ');
  assert.equal(CLASSE_DES_ARMES_DE_DEPART, 'couleur-arme-depart');
  // les effets sur une ligne (styles/armes/armes.css) : le bonus aux dégâts, puis les autres effets, en morceaux frères ; le mot « Dégâts » reste pour
  // les lecteurs d'écran (les effets se modifient sur la page Composants, R62 : le test lit ceux de la base)
  for (const m of armes.materiaux) assert.ok(main.includes(commeLaPage(RENDUS_DES_ARMES['materiau-effet'](m.ligne.effet_brut))), `${m.nom} : ses effets`);
  const avecBonus = armes.materiaux.map((m) => RENDUS_DES_ARMES['materiau-effet'](m.ligne.effet_brut)).filter((h) => h.includes('materiau-effet__bonus'));
  assert.ok(avecBonus.length > 0);
  for (const h of avecBonus) assert.match(h, /^<span class="materiau-effet"[^>]*><span class="materiau-effet__bonus"><span class="materiau-effet__mot">Dégâts <\/span>[+−]\d+<\/span>(<span class="materiau-effet__(cran|secondaire)">[^<]+<\/span>)*<\/span>$/);
  // le fer, matériau par défaut (R49) : lib/armes-db.mjs le reconnaît à son id figé (arme-forge.mjs#MATERIAU_PAR_DEFAUT ; un renommage ne le perd pas :
  // test/armes-materiau-par-defaut.test.mjs) ; à l'import, c'est le fer (test/aide-base-d-import.mjs) ; la page en pose un au plus
  assert.deepEqual(chargerArmes(baseDImport()).materiaux.filter((m) => m.defaut).map((m) => m.ligne.ressource_id), ['ressources/armures#materiau:fer']);
  assert.ok(armes.materiaux.filter((m) => m.defaut).length <= 1 && (main.match(/ data-defaut="1"/g) ?? []).length === armes.materiaux.filter((m) => m.defaut).length);
  assert.equal([...main.matchAll(/<tr class="amelioration" id="amelioration-(\d+)"/g)].length, armes.ameliorations.length);
  // « La ligne "total" des améliorations est inutile » (demande du propriétaire, 2026-10-16)
  const ameliorations = main.slice(main.indexOf('id="ameliorations-arme"'), main.indexOf('</details>', main.indexOf('id="ameliorations-arme"')));
  assert.ok(!ameliorations.includes('<tfoot>') && !main.includes('data-armes-total'));
  for (const [abr, id] of [['PP', 'pp'], ['RO', 'ro'], ['RF', 'rf']]) {
    assert.ok(main.includes(`<template data-armes-piece="${abr}"><span class="piece piece--${id}"`), `l’icône ${abr} que reprend le script`);
  }
  // les matériaux en lecture : leur référence est la page « Composants » (décision R62)
  assert.ok(!/<td class="materiau__(prix|effet)" data-ed=/.test(main));
});

test('l’effet secondaire des matériaux et des améliorations sur une ligne à part, sous la sienne (demande du propriétaire, 2026-11-05), le texte inchangé', options, () => {
  // « Pour gagner de la largeur, tu peux mettre l'effet secondaire des matériaux et amélioration sur une ligne à part comme c'est le cas pour les armes
  // elles même » (les balises du glossaire rendues comme le middleware : commeLaPage)
  const contexte = contexteDesArmes(base);
  const lecture = (table, cle, colonne) => echapper(attributEd(table, cle, colonne));
  for (const m of armes.materiaux) {
    const id = m.ligne.ressource_id;
    const ligne = main.match(new RegExp(`<tr class="materiau [^"]*" id="${ancreDeMateriau(id)}"[\\s\\S]*?</tr>(<tr[\\s\\S]*?</tr>)`));
    assert.ok(ligne, `${id} : sa ligne et la suivante`);
    // la case de la ligne du matériau : le rendu d'avant, entier (la fiche y lit bonus, crans et effets) ; la ligne à part, dans sa couleur, le reste
    assert.ok(ligne[0].includes(`data-ed-rendu="materiau-effet">${commeLaPage(RENDUS_DES_ARMES['materiau-effet'](m.ligne.effet_brut, m.ligne, contexte))}</td>`), `${id} : sa case`);
    assert.equal(ligne[1], `<tr class="materiau-suite ligne-couleur ${classeDeMateriau(id)}" data-materiau-suite="${echapper(id)}"><td class="materiau-suite__marge"></td><td colspan="2" class="materiau-suite__effet" data-ed-lecture="${lecture('materiau_arme', { ressource_id: id }, 'effet_brut')}" data-ed-rendu="materiau-effet-suite">${commeLaPage(RENDUS_DES_ARMES['materiau-effet-suite'](m.ligne.effet_brut, m.ligne, contexte))}</td></tr>`, `${id} : sa ligne à part`);
  }
  assert.ok(armes.materiaux.some((m) => RENDUS_DES_ARMES['materiau-effet-suite'](m.ligne.effet_brut) !== ''), 'des matériaux à effet secondaire');
  assert.ok(armes.materiaux.some((m) => RENDUS_DES_ARMES['materiau-effet-suite'](m.ligne.effet_brut) === ''), 'et sans (le fer)');
  for (const a of armes.ameliorations) {
    const ligne = main.match(new RegExp(`<tr class="amelioration" id="amelioration-${a.niveau}"[\\s\\S]*?</tr>(<tr[\\s\\S]*?</tr>)`));
    assert.ok(ligne, `+${a.niveau}`);
    // son champ (mode modification) garde tout le texte : le reste dans `amelioration-effet__reste`, caché hors du mode modification
    assert.ok(ligne[0].includes(`data-ed="${lecture('amelioration_equipement', { id: a.id }, 'effet_brut')}" data-ed-rendu="amelioration-effet">${commeLaPage(RENDUS_DES_ARMES['amelioration-effet'](a.effet_brut, a, contexte))}</td>`), `+${a.niveau} : son champ`);
    assert.equal(ligne[1], `<tr class="amelioration-suite" data-amelioration-suite="${a.niveau}"><td class="amelioration-suite__marge"></td><td colspan="3" class="amelioration-suite__effet" data-ed-lecture="${lecture('amelioration_equipement', { id: a.id }, 'effet_brut')}" data-ed-rendu="amelioration-effet-suite">${commeLaPage(RENDUS_DES_ARMES['amelioration-effet-suite'](a.effet_brut, a, contexte))}</td></tr>`, `+${a.niveau} : sa ligne à part`);
  }
  // la feuille : la case du matériau ne montre que le bonus, celle de l'amélioration que sa première clause ; une ligne à part vide se cache ; en mode
  // modification, l'amélioration montre tout son texte dans son champ et sa ligne à part se cache ; les deux lignes dans la couleur du matériau
  for (const regle of [
    '.armes-materiaux .materiau__effet :is(.materiau-effet__cran, .materiau-effet__secondaire) { display: none; }',
    '.armes-ameliorations .amelioration-effet__reste { display: none; }',
    '.armes-table tbody > tr:is(.materiau-suite, .amelioration-suite):has(> td:last-child:empty) { display: none; }',
    'body.ed-mode .armes-ameliorations .amelioration-effet__reste { display: inline; }',
    'body.ed-mode .armes-table tbody > tr.amelioration-suite { display: none; }',
    '.materiau-suite { --ligne-fond: var(--couleur); --ligne-texte: var(--couleur-texte); }',
  ]) assert.ok(html.includes(regle), regle);
});

test('le script de la page n’importe que lib/arme-forge.mjs et lib/armes-filtres.mjs, qu’aucun autre script de page n’importe', options, () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/armes.mjs', import.meta.url)), ['../lib/arme-forge.mjs', '../lib/armes-filtres.mjs']);
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'armes.mjs')) {
    const autres = imports(new URL(nom, scripts)).filter((m) => /\/(arme-forge|armes-filtres)\.mjs$/.test(m));
    assert.deepEqual(autres, [], nom);
  }
});

test('mode modification : le menu et un seul tableau restent (comme « Je veux les onglets aussi ») ; le titre du tableau affiché se voit', options, () => {
  // demande du propriétaire, 2026-10-23 : « Je veux les onglets aussi », qui remplace pour l'affichage la demande antérieure « tous les tableaux sont
  // visibles » ; depuis le 2026-11-05, le menu latéral : aucune règle du mode modification ne cache le menu ni ne montre les tableaux non affichés
  assert.doesNotMatch(html, /body\.ed-mode[^{]*\.armes-famille:not\(\.is-active\)/, 'un seul tableau affiché');
  assert.doesNotMatch(html, /body\.ed-mode[^{,]*\.armes-menu(?:__repli|__liste|__entree|__lien)?\s*\{[^}]*display:\s*none/, 'le menu reste');
  // le titre d'une famille (nom, dé, compte ; ses champs en mode modification, R159) n'est plus caché sous html.js
  assert.doesNotMatch(html, /html\.js[^{]*\.armes-famille__titre\s*\{/);
});

test('les familles qui se suivent (sans JavaScript, à l’impression) gardent l’espace entre deux tableaux : celui de .armes-tableaux, dont elles sont les enfants', options, () => {
  assert.match(html, /\.armes-tableaux \{[^}]*gap: 1\.4rem/);
  assert.match(main, /<div class="armes-tableaux"><section class="tableau armes-famille/, 'les tableaux, enfants directs de la grille');
  const impression = html.slice(html.indexOf('@media print {', html.indexOf('.armes-menu')));
  const regles = impression.slice(0, impression.indexOf('\n}'));
  assert.ok(regles.includes('.armes-tableaux > .armes-famille:not(.est-filtree) { display: block !important; }'), 'à l’impression, toutes les familles');
  assert.match(regles, /\.armes-menu \{ display: none !important; \}/, 'sans le menu');
  // aucune marge entre familles : l'espace est celui de la grille (un tableau caché n'en laisse pas)
  assert.doesNotMatch(html, /\.armes-famille[^{]*~[^{]*\.armes-famille[^{]*\{[^}]*margin/);
});

test('R159 : une famille se modifie dans l’en-tête de son tableau — son nom, son dé (toujours écrit, caché s’il est vide), l’en-tête de son coût', options, () => {
  const ed = (id, colonne) => echapper(attributEd('arme_famille', { id }, colonne));
  for (const f of famillesAffichees) {
    const debut = main.indexOf(`id="famille-${f.id}"`);
    const tableau = main.slice(debut, main.indexOf('</thead>', debut));
    assert.ok(tableau.includes(`<span class="tableau__nom armes-famille__nom" id="famille-${f.id}-titre" data-ed="${ed(f.id, 'nom')}">${echapper(f.nom)}</span>`), `${f.id} : son nom`);
    assert.ok(tableau.includes(`<span class="armes-famille__de" title="${echapper(infobulleDuDe(f))}" data-ed="${ed(f.id, 'de_brut')}" data-ed-cadre${f.de_brut ? '' : ' hidden'}>${echapper(f.de_brut ?? '')}</span>`), `${f.id} : son dé`);
    assert.ok(tableau.includes(`<th scope="col" class="ed-seul"><span data-ed="${ed(f.id, 'cout_libelle')}">${echapper(f.cout_libelle)}</span></th>`), `${f.id} : l’en-tête de son coût`);
  }
  // ARME DE MONSTRES reste hors de la page (R45) : aucun champ pour elle
  assert.ok(!main.includes('&quot;arme-de-monstres&quot;'));
});

test('le dé d’une famille dont la note écrit des dés selon la Force (PUGILAT) : ses paliers en infobulle, dans l’entrée du menu et le titre du tableau, la note gardée ; les autres familles inchangées (demande du propriétaire, 2026-10-23)', options, () => {
  // « Inutile dans l'onglet des armes de changer ça. Juste l'indiquer suffit (en tooltip de la catégorie) » : la pastille du dé (« D6/D8/D10 »)
  const pugilat = famillesAffichees.find((f) => f.id === 'pugilat');
  assert.ok(pugilat && desSelonLaForce(pugilat.note_brut), 'PUGILAT : des paliers selon la Force dans sa note');
  assert.match(infobulleDuDe(pugilat), /^Dé selon la Force : D\d+ \d+(?:-\d+)? Force(?:, D\d+ \d+(?:-\d+)? Force)+$/);
  assert.ok(famillesAffichees.some((f) => !desSelonLaForce(f.note_brut)), 'des familles sans paliers');
  for (const f of famillesAffichees) {
    const attendu = `title="${echapper(infobulleDuDe(f))}"`;
    const onglet = main.match(new RegExp(`<a class="armes-menu__lien" id="armes-menu-famille-${f.id}"[\\s\\S]*?</a>`))[0];
    assert.ok(onglet.includes(`<span class="armes-menu__de" ${attendu} `), `${f.id} : l’infobulle du dé de l’entrée du menu`);
    const debut = main.indexOf(`id="famille-${f.id}"`);
    const titre = main.slice(debut, main.indexOf('</thead>', debut));
    assert.ok(titre.includes(`<span class="armes-famille__de" ${attendu} `), `${f.id} : l’infobulle du dé du titre du tableau`);
    if (desSelonLaForce(f.note_brut)) {
      assert.ok(!titre.includes(INFOBULLE_PAR_DEFAUT) && !onglet.includes(INFOBULLE_PAR_DEFAUT), f.id);
      // la note reste écrite sous le titre du tableau
      assert.ok(titre.includes(`<p class="tableau__note armes-famille__note">${echapper(f.note_brut.split('\n').join(' · '))}</p>`), `${f.id} : sa note`);
    } else {
      assert.ok(onglet.includes(`title="${INFOBULLE_PAR_DEFAUT}"`) && titre.includes(`title="${INFOBULLE_PAR_DEFAUT}"`), `${f.id} : l’infobulle de toute famille`);
    }
  }
});

test('R159 : les modèles d’une famille créée (entrée du menu, tableau vide) donnent le HTML construit de chaque famille de la base, sans armes ; ids uniques', options, () => {
  const modeles = Object.fromEntries([...main.matchAll(/<template data-armes-modele="(entree|famille)">([\s\S]*?)<\/template>/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.keys(modeles), ['entree', 'famille']);
  // après le panneau de côté et les bulles, hors du menu et des tableaux (que le filtre et les tests parcourent)
  assert.ok(main.indexOf('<template data-armes-modele="entree">') > main.indexOf('data-armes-bulles'));
  // la famille fictive : des jetons qu'aucun identifiant ne donne (lib/text.mjs#normalize : jamais de « _ »)
  assert.ok(modeles.famille.includes(`id="famille-${MODELE_DE_FAMILLE.id}"`) && modeles.entree.includes(`id="armes-menu-famille-${MODELE_DE_FAMILLE.id}"`));
  for (const f of famillesAffichees) {
    // le compte construit : ses armes et ses armes élémentaires (R167 ; une famille créée n'en a aucune)
    const total = f.armes.length + (f.armes_elementaires?.length ?? 0);
    const n = `${total} arme${total > 1 ? 's' : ''}`;
    // l'entrée construite, non marquée, son compte celui d'une famille vide
    const entree = main.match(new RegExp(`<li class="armes-menu__entree"><a class="armes-menu__lien" id="armes-menu-famille-${f.id}"[\\s\\S]*?</li>`))[0]
      .replace(' aria-current="true"', '').replace(`data-armes-menu-compte>${n}<`, 'data-armes-menu-compte>0 arme<')
      .replace(` title="${echapper(infobulleDuDe(f))}"`, ` title="${INFOBULLE_PAR_DEFAUT}"`);
    assert.equal(htmlDeFamilleDepuisModele(modeles.entree, f), entree, `${f.id} : l’entrée du menu`);
    // le tableau construit, fermé, sans armes ni note (une famille créée n'en a pas : l'infobulle de son dé est celle de toute famille)
    const debut = main.indexOf(`<section class="tableau armes-famille`, main.indexOf(`id="famille-${f.id}"`) - 60);
    const tableau = main.slice(debut, main.indexOf('</section>', debut) + '</section>'.length)
      .replace('class="tableau armes-famille is-active"', 'class="tableau armes-famille"')
      .replace(/ data-note="[^"]*"/, ' data-note')
      .replace(` title="${echapper(infobulleDuDe(f))}"`, ` title="${INFOBULLE_PAR_DEFAUT}"`)
      .replace(/<p class="tableau__note armes-famille__note">[^<]*<\/p>/, '')
      .replace(`armes-famille__compte">${n}<`, 'armes-famille__compte">0 arme<')
      .replace(/<tbody>[\s\S]*<\/tbody>/, '<tbody></tbody>');
    // les balises du glossaire du modèle (« {{solidite}} ») : le middleware ne rend rien dans un <template>, le site de dev les rend une fois posées
    assert.equal(commeLaPage(htmlDeFamilleDepuisModele(modeles.famille, f)), tableau, `${f.id} : le tableau`);
  }
  // aucun id du modèle n'est celui d'un élément de la page (test/equipement-html.test.mjs : identifiants uniques)
  const idsDuModele = [...`${modeles.entree}${modeles.famille}`.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const autres = [...main.replace(/<template data-armes-modele="(?:entree|famille)">[\s\S]*?<\/template>/g, '').matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(idsDuModele.length >= 3 && idsDuModele.every((id) => !autres.includes(id)), idsDuModele.join(', '));
});

test('R159 : les modèles d’une famille créée sont posés là où l’éditeur peut se charger — jamais dans la version portable (pas de service)', () => {
  // la condition de components/edition/Edition.astro dans layouts/Base.astro (`edition && !portable`, portable = INLINE_CSS=1)
  const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');
  assert.match(lire('../src/layouts/Base.astro'), /const portable = process\.env\.INLINE_CSS === '1';[\s\S]*\{edition && !portable && <Edition /);
  const page = lire('../src/components/armes/ArmesPage.astro');
  assert.match(page, /const avecModeles = process\.env\.INLINE_CSS !== '1';/);
  const modeles = [...page.matchAll(/^\s*(.*)<template data-armes-modele="(entree|famille)">/gm)];
  assert.deepEqual(modeles.map((m) => [m[2], m[1]]), [['entree', '{avecModeles && '], ['famille', '{avecModeles && ']]);
});

// Armes élémentaires (décision R167 ; design du propriétaire, 2026-10-23 : « Met juste directement l'arme élémentaire dans chaque tableau. » ; « en
// sélectionnant l'arme élémentaire en question ça affichera ou non la bonne colone du tableau "amélioration" et grisera le "matériau" »).

test('R167 : chaque famille affichée liste ses 14 armes élémentaires, à la suite de ses armes, dans l’ordre de la base, sur le fond de leur magie ; aucune pour ARME DE MONSTRES', options, () => {
  const contexte = contexteDesArmes(base);
  for (const f of famillesAffichees) {
    assert.equal(f.armes_elementaires.length, 14, f.id);
    const debut = main.indexOf(`id="famille-${f.id}"`);
    const tableau = main.slice(debut, main.indexOf('</table>', debut));
    const lignes = [...tableau.matchAll(/<tr class="arme( arme--depart| arme--elementaire [\w-]+)?" id="([^"]+)"/g)].map((m) => [m[2], m[1]?.includes('elementaire') ?? false]);
    // les armes du catalogue, puis les armes élémentaires (ordre de arme_elementaire.ordre)
    assert.deepEqual(lignes, [...f.armes.map((a) => [ancreDArme(a.id), false]), ...f.armes_elementaires.map((ae) => [ancreDArmeElementaire(ae.id), true])], f.id);
    for (const ae of f.armes_elementaires) {
      // la ligne telle que la rend lib/armes-rendu.mjs (balises du glossaire comprises, comme le middleware), sur la classe de sa magie
      const attendu = commeLaPage(htmlDeLigneDArmeElementaire(ae, { type: f.type_elementaire, solidite: armes.solidite_elementaire }, contexte));
      assert.ok(tableau.includes(attendu.slice(0, attendu.indexOf('<td class="arme__competence">'))), `${ae.id} : sa ligne`);
      assert.ok(tableau.includes(`<tr class="arme-suite arme-suite--elementaire ${classeDeMagie(ae.magie)}" data-arme-suite="${echapper(ae.id)}">`), `${ae.id} : ses effets`);
    }
  }
  assert.ok(!main.includes('famille-arme-de-monstres'));
  assert.equal((main.match(/<tr class="arme arme--elementaire /g) ?? []).length, famillesAffichees.length * 14);
  // jamais un style, et chaque classe de magie posée existe sur la page (la palette de chaque page : layouts/Base.astro)
  assert.doesNotMatch(main, /<tr class="arme(-suite)? arme(-suite)?--elementaire[^>]*style=/);
  for (const classe of new Set([...main.matchAll(/arme--elementaire (couleur-magie-[\w-]+)/g)].map((m) => m[1]))) assert.ok(html.includes(`.${classe}{`), classe);
  // le « [Métier à définir] » de la page source n'est pas affiché par les armes élémentaires ; le texte de la page « Pièces élémentaires », lu tel
  // qu'écrit sous le panneau de règles (`details#pieces-elementaires`, « Fusionner dans Armes et Armures »), le cite : il n'est pas réécrit
  const debutDesPieces = main.indexOf('<details class="preg preg--pieces-elementaires"');
  const sansLeTexteDesPieces = debutDesPieces < 0 ? main : main.slice(0, debutDesPieces) + main.slice(main.indexOf('</details>', debutDesPieces));
  assert.ok(!sansLeTexteDesPieces.includes('Métier à définir'));
});

test('R167 : le tableau des améliorations a ses deux colonnes de coût (matériel, élémentaire), l’une ou l’autre selon l’arme choisie ; le matériau grisé', options, () => {
  const debut = main.indexOf('id="ameliorations-arme"');
  const tableau = main.slice(debut, main.indexOf('</details>', debut));
  assert.ok(tableau.includes('<thead><tr><th scope="col">Niveau</th><th scope="col" class="amelioration__cout">Coût</th><th scope="col" class="amelioration__cout-elementaire">Coût élémentaire</th><th scope="col">Effet</th></tr></thead>'));
  for (const a of armes.ameliorations) {
    const cumul = a.niveau > 1 ? texteDuCoutElementaire(armes.couts_elementaires.find((c) => c.niveau === a.niveau), null) : '';
    assert.ok(tableau.includes(`<td class="amelioration__cout-elementaire">${htmlDuCoutElementaire(a, cumul)}</td>`), `+${a.niveau} : son coût élémentaire, le cumul en infobulle`);
  }
  const note = /<p class="tableau__note armes-famille__note js-seul armes-ameliorations__note-elementaire">Arme élémentaire : [\s\S]*?<\/p>/.exec(tableau)?.[0];
  assert.ok(note, 'la note de l’arme élémentaire');
  // décision R207 (4), Q58 : l'amélioration revient au Forgeron, le mot-clé `forgeron` (sa section de /metiers/ quand il a une adresse, libellé et
  // adresse lus dans la base : le site de dev les modifie)
  const forgeron = base.prepare('SELECT libelle, url, cle FROM mot_cle WHERE id = ?').get(idDuMotCleNomme('forgeron'));
  assert.ok(forgeron, 'le mot-clé forgeron (migration 0104)');
  assert.match(note, forgeron.url
    ? new RegExp(`<a class="mot-cle[^"]*" href="[^"]*${forgeron.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" data-mot-cle="${forgeron.cle}"`)
    : new RegExp(`<strong class="mot-cle[^"]*" data-mot-cle="${forgeron.cle}"`));
  assert.ok(note.includes(`>${echapper(forgeron.libelle)}</`), 'son libellé');
  assert.ok(!note.includes('Métier à définir'));
  assert.match(main, /<p class="tableau__note armes-famille__note js-seul armes-materiaux__note-elementaire">Une arme élémentaire n’a pas de matériau\.<\/p>/);
  // la feuille : une seule colonne de coût avec JavaScript (le coût matériel, ou l'élémentaire avec `armes--elementaire`), les deux sans JavaScript et
  // en mode modification ; les matériaux grisés
  assert.ok(html.includes('html.js .armes:not(.armes--elementaire) .armes-ameliorations .amelioration__cout-elementaire,\nhtml.js .armes.armes--elementaire .armes-ameliorations .amelioration__cout { display: none; }'));
  assert.ok(html.includes('body.ed-mode .armes .armes-ameliorations :is(.amelioration__cout, .amelioration__cout-elementaire) { display: table-cell !important; }'));
  assert.ok(html.includes('html.js .armes--elementaire .armes-materiaux tbody { opacity: 0.45; }'));
  // la ligne « Aucune » (avec JavaScript seulement, une colonne de coût visible) couvre le coût et l'effet
  assert.match(tableau, /<tr class="amelioration amelioration--aucune js-seul-ligne" data-niveau="0">[\s\S]*?<td colspan="2" class="muted">Arme non améliorée<\/td><\/tr>/);
});
