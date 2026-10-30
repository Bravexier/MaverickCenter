// Site CONSTRUIT (client/dist/) : la fiche de personnage (/fiche/, création et modification d'un prétiré) et la recherche des personnages
// (/personnages/), demandes du propriétaire ; l'ancien générateur (/generateur/) a disparu et son adresse mène à la fiche (page 404) ; le menu met
// la fiche à droite, après les métiers ; la fiche se télécharge et s'importe en classeur au modèle V15.2.2 (/fiche/modele.xlsx), s'exporte en feuille
// Google Sheets et s'importe d'une feuille partagée par lien (demandes du propriétaire, 2026-10-15). Ne tourne qu'après `npm run build` (la CI
// l'exécute juste après, sans identifiant client Google) et se saute sinon.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { classesDeLaPalette } from '../src/lib/palette-css.mjs';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import { aideDeLEntrainement } from '../src/lib/fiche-regles.mjs';
import { dispositionDe } from '../src/lib/fiche-tableur-cases.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { COLONNES, FILTRES_PAR_DEFAUT } from '../src/lib/personnages-liste.mjs';
import { lireClasseur } from '../src/lib/tableur-lecture.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'fiche', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (rel) => readFileSync(join(dist, rel), 'utf8');

const BLOC = /<(?:section|div) class="fiche-etape[^"]*" id="etape-([a-z]+)"/g;

test('/fiche/ : quatre zones dans la couleur de leur partie du guide, les données à lire (règles, service) et le script', options, () => {
  const html = lire('fiche/index.html');
  assert.match(html, /<div class="fiche" id="fiche" data-regles="\/fiche\/regles\.json" data-modele="\/fiche\/modele\.xlsx" data-api="\/api\/" data-personnages="\/personnages\/" data-fiche="\/fiche\/">/);
  // la couleur de chaque zone : la classe de sa partie (lib/palette-css.mjs#classeDePartie), dans la feuille de la page, jamais un style (ni --etape)
  const zones = [...html.matchAll(/<section class="fiche-zone(?: fiche-zone--identite)? (couleur-partie-[a-z-]+)" id="zone-([a-z]+)" aria-labelledby/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(zones, [['identite', 'couleur-partie-creer'], ['portee', 'couleur-partie-jouer'], ['situation', 'couleur-partie-decouvrir'], ['parametres', 'couleur-partie-progresser']]);
  for (const [, classe] of zones) assert.ok(html.includes(`.${classe}{`), `${classe} : dans une feuille de la page`);
  assert.doesNotMatch(html, /style="[^"]*--etape/, 'plus de --etape en style');
  for (const champ of ['nom', 'surnom', 'lieu_origine', 'xp', 'metier_id', 'dieu_choisi_id', 'caracteristique_magie_id', 'bourse_pp', 'notes', 'evenements', 'gains_sante', 'gains_chakra']) {
    assert.match(html, new RegExp(`data-champ="${champ}"`), champ);
  }
  // plus de statut (brouillon, validé, archivé : demande du propriétaire, migration 0038) : les contrôles signalent, n'empêchent jamais d'enregistrer
  assert.ok(!html.includes('data-champ="statut"') && !html.includes('id="fiche-statut"'), 'plus de sélecteur « Statut » dans la barre');
  assert.ok(!/brouillon|« validée »/i.test(html), 'ni brouillon ni fiche « validée » dans les textes de la page (aide de l’onglet « Contrôle »)');
  assert.match(html, /Toute fiche est contrôlée, même inachevée : une règle enfreinte est signalée, elle n’empêche pas d’enregistrer\./);
  assert.ok(!html.includes('data-champ="ambidextrie"'), 'plus de case « Ambidextrie » : l’attaque à deux armes est calculée (décision R46)');
  assert.match(html, /<style>[^<]*\.fiche-etape/, 'feuille de style de la fiche insérée dans la page');
  assert.match(html, /<script type="module" src="\/_astro\/[^"]+\.js"><\/script>/);
  assert.match(html, /<button type="button" class="fiche-barre__principal" id="fiche-enregistrer" disabled>Enregistrer<\/button>/);
  // les éléments que les règles ont retirés de la fiche (décision R42) : une bannière, remplie par le script d'après les notes, cachée à l'impression
  assert.ok(html.includes('<p class="banner fiche-retraits" id="fiche-retraits" role="status" hidden></p>'), 'bannière des retraits');
  assert.ok(html.indexOf('id="fiche-retraits"') > html.indexOf('id="fiche-indisponible"'), 'sous la bannière du service');
  assert.match(html, /@media print\s*\{[^}]*\.fiche-retraits[^}]*display:\s*none/, 'masquée à l’impression');
});

test('/fiche/ en quatre zones (demande du propriétaire), sans cadre, titre ni pastille visibles : identité, à portée de main, selon la situation, paramètres en onglets', options, () => {
  const html = lire('fiche/index.html');
  const fiche = html.slice(html.indexOf('<div class="fiche" id="fiche"'));
  const jetons = [...fiche.matchAll(/<section class="fiche-zone[^"]*" id="zone-([a-z]+)"|<(?:section|div) class="fiche-etape[^"]*" id="etape-([a-z]+)"/g)]
    .map((m) => (m[1] ? `[${m[1]}]` : m[2]));
  assert.deepEqual(jetons, ['[identite]', 'identite', '[portee]', 'attributs', 'caracteristiques', 'armes', 'ceinture', 'actions', 'sorts', 'passifs',
    '[situation]', 'posture', 'armure', 'accessoires', 'inventaire', 'resistances', 'bouclier', '[parametres]', 'progression', 'choix', 'entrainement', 'jeu', 'controles']);
  assert.ok(!fiche.includes('fiche-zones-nav') && !fiche.includes('fiche-etapes'), 'ni pastilles des zones ni sommaire des blocs');
  assert.match(html, /\.fiche-zone__titre\s*\{[^}]*clip-path:\s*inset\(50%\)/, 'titres des zones lus par les lecteurs d’écran, pas affichés');
  // zone IV : des onglets (components/Onglets.astro), le compteur des choix et celui du contrôle
  const onglets = [...fiche.matchAll(/<a class="onglet[^"]*" id="onglet-([a-z]+)" href="#etape-([a-z]+)"/g)].map((m) => [m[1], m[2]]);
  // l'inventaire est sous les accessoires (zone III), plus dans un onglet (demande du propriétaire du 2026-10-17) ; l'entraînement dans le sien, juste
  // après « Choix » (demande du propriétaire du 2026-10-29 : « Le tableau d'entrainement devrait être dans un onglet à part à coté des choix. »)
  assert.deepEqual(onglets, [['progression', 'progression'], ['choix', 'choix'], ['entrainement', 'entrainement'], ['jeu', 'jeu'], ['controles', 'controles']]);
  assert.match(fiche, /<a class="onglet" id="onglet-entrainement" href="#etape-entrainement">Entraînement<\/a>/);
  assert.match(fiche, /<div class="parametres" data-onglets="Paramètres et suivi">/);
  assert.match(fiche, /id="choix-compte" hidden><\/span>/);
  assert.match(fiche, /id="controles-compte" hidden><\/span>/);
  assert.ok(!/class="num"/.test(fiche), 'aucun numéro de bloc');
});

test('/fiche/, zone II sur grand écran : les armes à côté des caractéristiques et compétences, la ceinture dessous, comme avant ; les maîtrises dans « Choix » (demande du propriétaire du 2026-10-23)', options, () => {
  const html = lire('fiche/index.html');
  const fiche = html.slice(html.indexOf('<div class="fiche" id="fiche"'));
  // l'ordre du DOM est celui des écrans moyens et des téléphones : attributs, compétences, armes, ceinture, actions (juste sous la ceinture, décision
  // R173), sorts, passifs (aire `don`, juste sous la colonne sur grand écran)
  const ordre = ['attributs', 'caracteristiques', 'armes', 'ceinture', 'actions', 'sorts', 'passifs'].map((id) => fiche.indexOf(`id="etape-${id}"`));
  assert.ok(ordre.every((i, n) => i > 0 && (n === 0 || i > ordre[n - 1])), `ordre du DOM de la zone II : ${ordre}`);
  // « Garder l'armes visibles à coté des caractéristiques comme avant » : la colonne des armes, puis de la ceinture, dans l'aire `col`
  assert.match(fiche, /<div class="zp-colonne">\s*(?:<!--[^]*?-->\s*)?<section class="fiche-etape" id="etape-armes" aria-labelledby="titre-armes">\s*<h3 id="titre-armes">Armes<\/h3>[^]*?<section class="fiche-etape" id="etape-ceinture"/);
  // les actions dans la même colonne, juste après la ceinture (décision R173 : « directement sous la case de la ceinture »)
  const colonne = fiche.slice(fiche.indexOf('<div class="zp-colonne">'), fiche.indexOf('id="etape-sorts"'));
  assert.match(colonne, /<section class="fiche-etape" id="etape-ceinture"[^]*?<\/section>\s*<section class="fiche-etape" id="etape-actions" aria-labelledby="titre-actions">\s*<h3 id="titre-actions">Actions<\/h3>/);
  const grand = html.match(/@media \(min-width:\s*64rem\)\s*\{([^]*?)\.zone-situation/)?.[1] ?? '';
  const aires = [...(grand.match(/\.zone-portee\s*\{[^}]*grid-template-areas:\s*([^;}]+)/)?.[1] ?? '').matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(aires, ['attr attr', 'car col', 'sor don'], 'la colonne des armes et de la ceinture à côté des compétences');
  assert.match(grand, /\.zp-colonne\s*\{\s*grid-area:\s*col\b/);
  assert.doesNotMatch(html, /\.zp-colonne\s*\{\s*display:\s*contents|\.zp-armes|\.zp-ceinture|'arm arm'/, 'plus d’aires propres aux armes et à la ceinture');
  // les maîtrises ne sont plus dans la zone II
  const zone = fiche.slice(fiche.indexOf('id="zone-portee"'), fiche.indexOf('id="zone-situation"'));
  assert.ok(zone.length > 0 && !/id="(?:maitrises|budget-maitrises|maitrises-sources|maitrises-familles)"|Maîtrises d’armes/.test(zone), 'plus de maîtrises dans la zone II');
  // le tableau des familles à côté des cartes dès que le bloc a la place, dessous sinon (sans défilement horizontal de la page)
  assert.match(html, /\.maitrises\s*\{\s*container-type:\s*inline-size/);
  assert.match(html, /@container \(min-width:\s*44rem\)\s*\{\s*\.maitrises__grille\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1\.1fr\) minmax\(0,\s*1fr\)/);
});

test('/fiche/, panneau « Choix » : les maîtrises d’armes sur toute sa largeur, sous ses deux piles (demande du propriétaire du 2026-10-23 : « La partie maitrise d’arme vont déscendre dans l’encart des \"choix\" »)', options, () => {
  const html = lire('fiche/index.html');
  const debut = html.indexOf('id="etape-choix"');
  const choix = html.slice(debut, html.indexOf('</section>', debut));
  // le bloc entier, ids inchangés (le script les lit) : l'en-tête et son compteur, les cartes des sources, puis le tableau calculé
  const bloc = choix.slice(choix.indexOf('<div class="choix-maitrises">'));
  assert.ok(bloc.length < choix.length, 'le bloc des maîtrises est dans le panneau « Choix »');
  assert.match(bloc, /^<div class="choix-maitrises">\s*<div class="fiche-entete-bloc"><h4 class="fiche-sous-titre">Maîtrises d’armes<\/h4><span class="budget" id="budget-maitrises" aria-live="polite"><\/span><\/div>\s*<div id="maitrises" class="maitrises">/);
  // après les deux piles (spécialités, dons à choisir), sur toute la largeur de la grille du panneau
  assert.ok(choix.indexOf('<div class="choix-maitrises">') > choix.indexOf('id="dons"'), 'sous les dons de classe à choisir');
  assert.equal([...choix.matchAll(/class="parametres__pile"/g)].length, 2);
  assert.match(html, /\.choix-maitrises\s*\{\s*grid-column:\s*1\s*\/\s*-1/, 'une rangée sur toute la largeur');
  // décision R181 : les dons obtenus des dons « Variable » du Mage Bleu, juste sous les dons à choisir, cachés tant qu'il n'y en a pas (le script les remplit)
  assert.match(choix, /<div id="dons-obtenus-bloc" hidden><h4 class="fiche-sous-titre">Dons obtenus \(dons « Variable »\)<\/h4><div id="dons-obtenus" class="fiche-etape__dons"><\/div><\/div>/);
  assert.ok(choix.indexOf('id="dons-obtenus-bloc"') > choix.indexOf('id="dons"') && choix.indexOf('id="dons-obtenus-bloc"') < choix.indexOf('<div class="choix-maitrises">'));
  assert.equal([...html.matchAll(/id="maitrises"/g)].length, 1, 'un seul bloc des maîtrises');
});

test('/fiche/ : chaque champ dans son bloc (demandes du propriétaire)', options, () => {
  const html = lire('fiche/index.html');
  const bloc = (id) => {
    const debut = html.indexOf(`id="etape-${id}"`);
    return html.slice(debut, html.indexOf('</section>', debut));
  };
  const identite = bloc('identite');
  for (const champ of ['nom', 'surnom', 'lieu_origine', 'metier_id', 'alignement_loyal', 'alignement_chaotique', 'alignement_bon', 'alignement_mauvais']) {
    assert.match(identite, new RegExp(`data-champ="${champ}"`), `identité : ${champ}`);
  }
  assert.ok(identite.indexOf('id="metiers"') > identite.indexOf('id="choix-ethnie"'), 'le métier, facultatif, sous l’ethnie');
  assert.match(identite, /<option value="">Sans métier \(facultatif\)<\/option>/);
  // portrait (le logo en attendant une image), niveau seul (l'XP est dans la zone IV), case « Bi-classé »
  assert.match(identite, /<img class="portrait__image" id="portrait-image" src="\/logo\.webp" data-defaut="\/logo\.webp"/);
  assert.match(identite, /<input type="file" id="portrait-fichier" accept="image\/\*" hidden>/);
  assert.match(identite, /<strong id="identite-niveau">1<\/strong>/);
  assert.ok(!identite.includes('data-champ="xp"'), 'pas d’XP dans l’identité');
  assert.match(identite, /<input type="checkbox" id="bi-classe">/);
  assert.ok(!html.includes('id="modes"') && !html.includes('id="classe-imposee"'), 'plus de boutons « Une classe / Deux classes » ni de texte de classe imposée');
  // l'alignement, dans la couleur de la classe de son alignement (Neutre avant le script : lib/palette-css.mjs, famille émise par la page)
  assert.match(identite, /<fieldset class="alignement">[\s\S]*?<output class="alignement__resultat teinte-palette couleur-alignement-neutre" id="alignement-resultat" aria-live="polite">Neutre<\/output>/);
  // II. à portée de main
  const attributs = bloc('attributs');
  assert.match(attributs, /<div id="attributs-barres" class="attributs"><\/div>/, 'valeurs du moment et maximums fusionnés');
  assert.match(attributs, /<div id="attributs-corruption" class="attributs-corruption"><\/div>/);
  assert.ok(!attributs.includes('fiche-aide'), 'pas de texte de calcul');
  // la 2ᵉ ligne (demande du propriétaire du 2026-10-29 : « une 2em ligne où tu y déplacera : les AP / AM / Vitesse et initiative , ainsi que
  // l'interface pour les dégâts reçu ») : l'AP et l'AM, puis initiative, vitesse et nage, puis les dégâts reçus (décisions R98, R171)
  assert.match(attributs, /<div class="attributs-ligne2">\s*<ul id="defense-tuiles" class="defense__tuiles" aria-label="Armure totale"><\/ul>\s*<ul id="attributs-pastilles" class="fiche-resume attributs-pastilles" aria-label="Initiative et vitesses"><\/ul>\s*<\/div>\s*<div id="defense" class="defense"><\/div>/);
  assert.ok(attributs.indexOf('class="attributs-ligne2"') > attributs.indexOf('id="attributs-corruption"'), 'sous la ligne des valeurs du moment');
  for (const id of ['defense', 'defense-tuiles', 'attributs-pastilles']) assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `un seul #${id}`);
  assert.ok(!html.includes('id="etape-mouvement"'), 'plus de bloc « Initiative et vitesses » dans la zone III');
  const armes = bloc('armes');
  assert.match(armes, /<div id="armes" class="equipement equipement--armes"><\/div>/);
  assert.doesNotMatch(armes, /maitrise/, 'le bloc des armes n’a plus les maîtrises (panneau « Choix »)');
  // les maîtrises d'armes, dans le panneau « Choix » (demande du propriétaire du 2026-10-23 ; décision R148, variante A de la maquette, « Bloc des
  // sources ») : le compteur « N points · M à choisir » dans le coin, une carte par source et, à côté, le tableau calculé des familles (remplis par le
  // script) ; plus de curseur de maîtrise ni de quota, pas de points du MJ
  const maitrises = bloc('choix').slice(bloc('choix').indexOf('<div class="choix-maitrises">'));
  assert.match(maitrises, /<span class="budget" id="budget-maitrises" aria-live="polite"><\/span>/, 'le compteur');
  assert.match(maitrises, /<div id="maitrises" class="maitrises">\s*<div class="maitrises__grille">\s*<div class="maitrises__sources">/);
  assert.match(maitrises, /<ul id="maitrises-sources" class="maitrises-sources" aria-labelledby="titre-maitrises-sources"><\/ul>/, 'une carte par source');
  assert.match(maitrises, /<div class="fiche-defile"><table class="fiche-table fiche-table--maitrises" aria-labelledby="titre-maitrises-familles"><caption class="fiche-aide" id="maitrises-legende"><\/caption><thead><tr><th scope="col">Famille<\/th><th scope="col" class="nombre">Points<\/th><th scope="col" class="nombre">Dés<\/th><th scope="col">Sources<\/th><\/tr><\/thead><tbody id="maitrises-familles"><\/tbody><\/table><\/div>/, 'le tableau des familles');
  assert.ok(maitrises.indexOf('id="maitrises-sources"') < maitrises.indexOf('id="maitrises-familles"'), 'les sources, puis le résultat');
  assert.doesNotMatch(maitrises, /type="range"|class="maitrise"|Points du MJ|à confirmer/i, 'ni curseur, ni points du MJ, ni « à confirmer »');
  assert.doesNotMatch(html, /Points du MJ/);
  assert.match(bloc('ceinture'), /<ol id="ceinture" class="ceinture"/, 'les 3 emplacements de la ceinture');
  // les actions (décision R173) : la liste, puis « Fin de combat » (montré par le script quand une action a un compteur par combat)
  const actions = bloc('actions');
  assert.match(actions, /<ul id="actions" class="dons-liste actions-liste" aria-labelledby="titre-actions"><\/ul>\s*<p class="actions__pied"><button type="button" id="fin-de-combat"[^>]*>Fin de combat<\/button><\/p>/);
  // les passifs (décision R173 ; ils remplacent les « Dons débloqués ») : la race, puis les classes, puis l'équipement
  const dons = bloc('passifs');
  assert.match(dons, /<h3 id="titre-passifs">Passifs<\/h3>/);
  assert.ok(!html.includes('id="etape-dons"') && !html.includes('Dons débloqués'), 'plus de bloc « Dons débloqués »');
  assert.ok(dons.indexOf('id="dons-classes"') > dons.indexOf('id="dons-race"'), 'les dons de la race, puis ceux des classes');
  assert.ok(dons.indexOf('id="passifs-equipement"') > dons.indexOf('id="dons-classes"'), 'puis l’équipement');
  // « Entraînement » (décision R104 ; un texte libre avant, R71) : des lignes, dans son onglet de la zone IV, juste après « Choix » (demande du
  // propriétaire du 2026-10-29), plus dans les dons ; les boutons d'ajout dessous, avec l'aide du guide (le paragraphe que la base écrit) ; les acquis à
  // choisir et les bonus non comptés restent dans les dons
  assert.ok(!dons.includes('id="entrainement"') && !dons.includes('titre-entrainement'), 'plus dans les dons débloqués');
  const entrainement = bloc('entrainement');
  assert.match(entrainement, /^id="etape-entrainement" aria-labelledby="titre-entrainement">\s*<h3 class="parametres__titre" id="titre-entrainement">Entraînement<\/h3>\s*<div class="fiche-etape__corps entrainement-panneau">\s*<ul id="entrainement" class="entrainement" aria-labelledby="titre-entrainement"><\/ul>\s*<p class="entrainement__ajouts" id="entrainement-ajouts"><\/p>/);
  assert.ok(html.indexOf('id="etape-entrainement"') > html.indexOf('id="etape-choix"') && html.indexOf('id="etape-entrainement"') < html.indexOf('id="etape-jeu"'));
  assert.equal([...html.matchAll(/id="entrainement"/g)].length, 1, 'un seul bloc de l’entraînement');
  assert.ok(!html.includes('data-champ="entrainement"') && !html.includes('id="fiche-entrainement"'), 'plus de texte libre d’entraînement');
  assert.match(dons, /<div id="acquis-choix-bloc" hidden>/);
  assert.match(dons, /<div id="acquis-non-comptes-bloc" hidden>/);
  const aide = /<p class="fiche-aide" id="entrainement-aide">([\s\S]*?)<\/p>/.exec(entrainement)?.[1] ?? '';
  const guide = aideDeLEntrainement(ouvrirBase());
  const html_ = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // le titre de la page, puis le paragraphe tel que la base l'écrit ; plus de numéro de chapitre (refonte des pages du guide, 2026-10-18), et pas de lien :
  // la fiche reste sans lien vers le guide (demande du propriétaire, docs/character-generator.md, « Compacte »)
  if (guide) assert.ok(aide.startsWith(`<cite>${html_(guide.titre)}</cite> : « ${html_(guide.texte)} »`), 'le titre de la page, puis le paragraphe du guide');
  assert.doesNotMatch(aide, /<a /);
  assert.doesNotMatch(aide, /chapitre \d/);
  assert.match(aide, /Les points d’une compétence s’ajoutent à son acquis ; un livre de sort donne un NM à son sort, qui ne compte pas dans le décompte des NM, et attend tant que le sort n’est pas choisi ; un texte libre note un don évènementiel ou ce que le MJ accorde\./);
  assert.match(bloc('sorts'), /<table class="fiche-table fiche-table--sorts" id="sorts"><\/table>/);
  // les NM du MJ, pour toute la fiche, juste après le décompte des NM (décision R118 : « noté à coté de la limit de NM »)
  assert.match(bloc('sorts'), /<span class="budget" id="budget-nm"><\/span><label class="budget budget--mj"[^>]*><span aria-hidden="true">\+ MJ<\/span><input type="number" min="0" step="1" inputmode="numeric" data-champ="nm_mj" data-entier id="nm-mj"/);
  // III. selon la situation
  const posture = bloc('posture');
  assert.match(posture, /<div id="postures" class="postures__cartes" role="group" aria-labelledby="titre-postures"><\/div>/, 'les six postures en cases');
  assert.match(posture, /<div id="postures-hyper" class="postures__hyper" hidden><\/div>/, 'le Mode Hyper et le Mode Hyper 100 %, une fois débloqués');
  assert.match(bloc('resistances'), /<table class="resistances__table" aria-labelledby="titre-resistances"><tbody id="resistances"><\/tbody><\/table>/);
  assert.match(bloc('resistances'), /<p class="fiche-aide" id="resistances-choix" hidden><\/p>/);
  // une armure complète et la solidité de ses parties (décision R95), remplies par le script comme le bouclier ; la défense totale et les dégâts reçus
  // sont dans la 2ᵉ ligne des attributs (demande du propriétaire du 2026-10-29)
  assert.match(bloc('armure'), /<div id="armures" class="equipement"><\/div>/);
  assert.ok(!bloc('armure').includes('id="defense"'), 'plus la défense dans l’armure');
  assert.match(bloc('bouclier'), /<div id="bouclier" class="equipement"><\/div>/);
  // IV. paramètres et suivi
  const progression = bloc('progression');
  for (const id of ['xp-bloc', 'xp-niveau', 'xp-jauge', 'xp-plus', 'xp-ajout']) assert.match(progression, new RegExp(`id="${id}"`), `progression : ${id}`);
  // gains de niveau (décision R73) : deux totaux, santé et chakra, jamais négatifs ; le total attribué et le total à saisir (rempli par le script)
  const gains = progression.slice(progression.indexOf('<div id="progression" class="gains">'));
  assert.ok(gains.length < progression.length, 'le bloc des gains');
  assert.match(gains, /<label class="gains__champ gains__champ--sante"><span>Santé<\/span><input type="number" min="0" step="1" inputmode="numeric" data-champ="gains_sante" data-entier id="gains-sante"><\/label>/);
  assert.match(gains, /<label class="gains__champ gains__champ--chakra"><span>Chakra<\/span><input type="number" min="0" step="1" inputmode="numeric" data-champ="gains_chakra" data-entier id="gains-chakra"><\/label>/);
  assert.match(gains, /<output class="gains__total" id="gains-total" for="gains-sante gains-chakra"><\/output>/);
  assert.ok(progression.indexOf('id="progression-aide"') < progression.indexOf('id="progression"'), 'l’aide au-dessus des deux champs');
  assert.equal([...html.matchAll(/data-champ="gains_(sante|chakra)"/g)].length, 2, 'un champ chacun, pas un par niveau');
  const choix = bloc('choix');
  for (const id of ['choix-tete', 'choix-attente', 'choix-aller', 'choix-reduire', 'metier-bloc', 'bloc-carac-magie', 'choix-specialites', 'dons']) {
    assert.match(choix, new RegExp(`id="${id}"`), `choix : ${id}`);
  }
  // l'inventaire, juste sous les accessoires (zone III) : le sac puis la bourse
  const inventaire = bloc('inventaire');
  assert.ok(html.indexOf('id="etape-inventaire"') > html.indexOf('id="etape-accessoires"') && html.indexOf('id="etape-inventaire"') < html.indexOf('id="zone-parametres"'));
  assert.ok(inventaire.indexOf('data-champ="bourse_pp"') > inventaire.indexOf('id="inventaire"'), 'la bourse après le sac');
  for (const champ of ['bourse_pp', 'bourse_ro', 'bourse_rf']) assert.match(inventaire, new RegExp(`data-champ="${champ}"`), champ);
  const jeu = bloc('jeu');
  assert.match(jeu, /data-champ="notes"/);
  assert.match(jeu, /data-champ="evenements"/);
  assert.match(bloc('controles'), /<ul class="controles" id="controles">/);
  // le recadrage du portrait
  assert.match(html, /<dialog class="recadrage" id="recadrage" aria-labelledby="titre-recadrage">/);
});

test('/fiche/ compacte (demandes du propriétaire) : pas de lien vers le guide, choix en menus déroulants, jauge d’XP avec ajout, suppression', options, () => {
  const html = lire('fiche/index.html');
  const fiche = html.slice(html.indexOf('<div class="fiche" id="fiche"'));
  assert.ok(!/Le guide</.test(fiche) && !/href="\/guide\//.test(fiche), 'aucun lien vers le guide dans la fiche (le menu du site garde le sien)');
  const menus = [...html.matchAll(/<details class="choix" id="choix-([a-z0-9-]+)"( hidden)?>/g)].map((m) => m[1]);
  assert.deepEqual(menus, ['race', 'ethnie', 'magie-innee', 'magie-acquise', 'classe-1', 'specialite-1', 'classe-2', 'specialite-2']);
  for (const conteneur of ['races', 'ethnies', 'magies-innees', 'magies-acquises', 'classe-1', 'classe-2', 'specialite-1', 'specialite-2']) {
    assert.match(html, new RegExp(`<div class="choix__panneau"><(div|ul) id="${conteneur}"`), `${conteneur} dans un menu`);
  }
  assert.match(html, /<input type="number" min="0" step="1" data-champ="xp" data-entier id="xp" aria-label="Expérience \(XP\)">/);
  assert.match(html, /<div class="xp__jauge" id="xp-jauge" role="progressbar"/);
  assert.match(html, /<button type="button" class="xp__plus" id="xp-plus" aria-expanded="false" aria-controls="xp-ajout"/);
  assert.match(html, /<form class="xp__ajout" id="xp-ajout" hidden>/);
  assert.equal([...html.matchAll(/data-champ="xp"/g)].length, 1, 'un seul champ d’XP : celui de la jauge');
  assert.match(html, /<button type="button" class="fiche-barre__danger" id="fiche-supprimer" hidden>Supprimer<\/button>/);
  assert.ok(!html.includes('id="ajout-sort"'), 'les sorts se choisissent dans le tableau, ligne par ligne');
});

test('/fiche/ : la barre Nouveau, Télécharger, Exporter, Importer (PC), Importer (en ligne), Supprimer (demandes du propriétaire, 2026-10-15) ; les dialogues « import-cible » et « import-en-ligne »', options, () => {
  const html = lire('fiche/index.html');
  const barre = html.slice(html.indexOf('<span class="fiche-barre__outils">'), html.indexOf('</span>', html.indexOf('id="fiche-supprimer"')));
  const boutons = [...barre.matchAll(/<button type="button"(?: class="[^"]*")? id="([a-z-]+)"[^>]*>([^<]+)<\/button>|<input type="file" id="(fiche-importer)"[^>]*><span[^>]*>([^<]+)<\/span>/g)]
    .map((m) => (m[1] ? `${m[1]} ${m[2]}` : `${m[3]} ${m[4]}`));
  assert.deepEqual(boutons, ['fiche-nouvelle Nouveau', 'fiche-telecharger Télécharger', 'fiche-exporter Exporter', 'fiche-importer Importer (PC)',
    'fiche-importer-en-ligne Importer (en ligne)', 'fiche-supprimer Supprimer']);
  // plus d'export ni d'import en JSON, plus d'impression (Ctrl+P reste possible : la mise en page d'impression est gardée)
  assert.ok(!/fiche-imprimer|fiche-exporter-tableur|Exporter \(JSON\)|\.json/.test(barre), 'ni JSON ni Imprimer dans la barre');
  // `id` juste après `type="button"` : la version portable (tools/build-artifact.mjs) masque ainsi Télécharger, Exporter et Importer (en ligne)
  const portable = readFileSync(new URL('../../tools/build-artifact.mjs', import.meta.url), 'utf8').match(/html\.replace\((\/<button type="button" id="[^/]+"\/g), /)?.[1];
  assert.equal(portable, '/<button type="button" id="(fiche-telecharger|fiche-exporter|fiche-importer-en-ligne)"/g');
  for (const id of ['fiche-telecharger', 'fiche-exporter', 'fiche-importer-en-ligne']) assert.match(barre, new RegExp(`<button type="button" id="${id}"`), id);
  // Télécharger et Exporter grisés dans la page construite (une fiche neuve n'est pas enregistrée ; le script les recalcule) ; la CI construit sans
  // identifiant client Google (SITE_GOOGLE_CLIENT_ID) : Exporter dit qu'il n'est pas configuré
  assert.match(barre, /<button type="button" id="fiche-telecharger" disabled title="Enregistrez la fiche pour la télécharger">Télécharger<\/button>/);
  // (un attribut vide est écrit sans valeur : le script lit dataset.clientGoogle = '')
  assert.match(barre, /<button type="button" id="fiche-exporter" data-client-google(?:="")? disabled title="Export vers Google Sheets pas encore configuré">Exporter<\/button>/);
  assert.ok(!/<script[^>]+src="https:\/\/accounts\.google\.com/.test(html), 'le script de Google n’est pas dans la page : la page le crée au besoin');
  // Importer (PC) : un .xlsx
  const accept = barre.match(/<input type="file" id="fiche-importer" accept="([^"]+)" hidden>/)?.[1].split(',');
  assert.deepEqual(accept, ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
  assert.match(barre, /<span role="button" tabindex="0" title="Un classeur \.xlsx au modèle de la fiche V15\.2\.2, ordinateur ou auto \(depuis Google Sheets : Fichier › Télécharger › Microsoft Excel\)">Importer \(PC\)<\/span>/);
  assert.match(barre, /<button type="button" id="fiche-importer-en-ligne" title="Le lien d’une feuille Google Sheets partagée à « Tous les utilisateurs disposant du lien »">Importer \(en ligne\)<\/button>/);
  // la connexion à Google : la fenêtre de Google reçoit l'origine du site (cette page seulement ; le reste du site garde Referrer-Policy same-origin)
  const tete = html.slice(0, html.indexOf('</head>'));
  assert.match(tete, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.ok(!lire('index.html').includes('name="referrer"'), 'pas sur les autres pages');
  // où va une fiche importée quand un prétiré est ouvert : le mettre à jour, en créer un nouveau, ou annuler ; caché à l'impression
  const dialogue = html.match(/<dialog class="import-cible" id="import-cible" aria-labelledby="titre-import-cible">([\s\S]*?)<\/dialog>/)?.[1];
  assert.ok(dialogue, 'dialogue « import-cible »');
  assert.match(dialogue, /<form method="dialog"/);
  assert.match(dialogue, /<p>La fiche du classeur remplace celle de la page\.<\/p>/);
  assert.match(dialogue, /<p class="import-cible__perte" id="import-cible-perte" hidden>Les modifications non enregistrées seront perdues\.<\/p>/);
  assert.deepEqual([...dialogue.matchAll(/<button type="submit"[^>]* id="([a-z-]+)" value="([a-z-]+)">([^<]+)<\/button>/g)].map((m) => [m[1], m[2], m[3]]), [
    ['import-cible-maj', 'mettre-a-jour', 'Mettre à jour le prétiré'], ['import-cible-creer', 'creer', 'Créer un nouveau prétiré'], ['import-cible-annuler', 'annuler', 'Annuler'],
  ]);
  // « Importer (en ligne) » : le lien de la feuille (requis), Annuler sans validation ; même classe, donc caché à l'impression
  const enLigne = html.match(/<dialog class="import-cible import-en-ligne" id="import-en-ligne" aria-labelledby="titre-import-en-ligne">([\s\S]*?)<\/dialog>/)?.[1];
  assert.ok(enLigne, 'dialogue « import-en-ligne »');
  assert.match(enLigne, /<form method="dialog" class="import-cible__corps" id="import-en-ligne-formulaire">/);
  assert.match(enLigne, /<input type="url" id="import-en-ligne-adresse" name="adresse" required inputmode="url" autocomplete="off" spellcheck="false" placeholder="https:\/\/docs\.google\.com\/spreadsheets\/d\/…">/);
  assert.match(enLigne, /Tous les utilisateurs disposant du lien/);
  assert.match(enLigne, /<p class="import-en-ligne__erreur" id="import-en-ligne-erreur" role="alert" hidden><\/p>/);
  assert.deepEqual([...enLigne.matchAll(/<button type="submit"[^>]* id="([a-z-]+)" value="([a-z-]+)"( formnovalidate)?>([^<]+)<\/button>/g)].map((m) => [m[1], m[2], Boolean(m[3]), m[4]]), [
    ['import-en-ligne-importer', 'importer', false, 'Importer'], ['import-en-ligne-annuler', 'annuler', true, 'Annuler'],
  ]);
  assert.match(html, /@media print\s*\{[^}]*\.import-cible[^}]*display:\s*none/, 'dialogues cachés à l’impression');
});

test('/fiche/modele.xlsx : le modèle V15.2.2 ordinateur assemblé au build (lib/fiche-modele.mjs), que la page remplit et relit', options, async () => {
  const octets = new Uint8Array(readFileSync(join(dist, 'fiche', 'modele.xlsx')));
  assert.deepEqual(octets, await modeleXlsx(), 'les octets de lib/fiche-modele.mjs (sortie identique d’un build à l’autre)');
  const classeur = await lireClasseur(octets, { nom: 'modele.xlsx' });
  assert.deepEqual([classeur.format, classeur.feuilles], ['xlsx', ['Personnage']]);
  const feuille = classeur.feuille('Personnage');
  assert.equal(dispositionDe((a) => feuille.cellules.get(a)?.texte ?? '')?.disposition, 'ordinateur');
  assert.deepEqual(feuille.images.map((i) => [i.de, i.a, i.type]), [['A1', 'E5', 'image/png']], 'le logo, en haut à gauche');
});

test('/fiche/regles.json : les règles de la base que lit la page (races et classes : celles de la base, 27 et 39 à l’import)', options, () => {
  const regles = JSON.parse(lire('fiche/regles.json'));
  // le site de dev crée des races et des classes : la page a celles de la base, l'effectif d'import se lit dans l'historique (R1 : 27 races)
  const db = ouvrirBase({ sansExemples: false });
  try {
    const historique = historiqueSite(db);
    assert.equal(regles.races.length, db.prepare('SELECT count(*) AS n FROM race').get().n);
    assert.equal(historique.effectifDImport('race'), 27);
    assert.equal(regles.classes.length, db.prepare('SELECT count(*) AS n FROM classe').get().n);
    assert.equal(historique.effectifDImport('classe'), 39);
  } finally {
    db.close();
  }
  assert.equal(regles.niveaux.length, 20);
  assert.ok(regles.sorts.length > 300);
  assert.ok(regles.classes.every((c) => /^couleur-classe-[a-z]+$/.test(c.classe) && !('couleur' in c) && Number.isInteger(c.groupe.ordre)));
  assert.equal(regles.resistance_paliers.length, 6);
  // décision R155 : les multiplicateurs et les effets que la page applique et affiche
  assert.deepEqual(regles.resistance_paliers.map((p) => [p.id, p.multiplicateur, p.effet]), [['immunite', 0, 'dégâts subis =0'],
    ['grande_resistance', 1 / 3, 'dégâts subis ÷3'], ['resistance', 0.5, 'dégâts subis ÷2'], ['vulnerabilite', 2, 'dégâts subis x2'],
    ['grande_vulnerabilite', 3, 'dégâts subis x3'], ['sensibilite', 4, 'dégâts subis x4']]);
  assert.ok(regles.magies.some((m) => m.resistances.length) && regles.etats.length > 0);
  // la couleur d'une magie : les noms de ses classes de la palette (lib/palette-css.mjs), que la page porte ; jamais une couleur
  const palette = classesDeLaPalette();
  for (const m of regles.magies) assert.ok(palette.has(m.classe) && palette.has(m.classe_2) && !('couleur' in m) && !('texte' in m), m.id);
});

test('/personnages/ (demandes du propriétaire) : filtres sans statut, puis la liste (portrait, nom, race, magies, classes, niveau) dont chaque colonne sauf le portrait se trie (un bouton par en-tête) ; ni phrase d’introduction ni bouton « Nouveau prétiré »', options, () => {
  const html = lire('personnages/index.html');
  // les adresses du service, de la fiche et du logo (portrait par défaut), et les couleurs des magies pour la bordure des lignes (data-couleurs : du
  // JSON, guillemets échappés par Astro)
  const racine = html.match(/<div class="personnages" id="personnages" data-api="\/api\/" data-fiche="\/fiche\/" data-logo="\/logo\.webp" data-couleurs="([^"]+)">/);
  assert.ok(racine, 'racine de la page et ses données');
  const couleurs = JSON.parse(racine[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
  const regles = JSON.parse(lire('fiche/regles.json'));
  // les couleurs : les classes de la palette de chaque magie (la classe de la magie, sa classe de second rang : lib/palette-css.mjs), jamais un hex
  assert.deepEqual(couleurs, Object.fromEntries(regles.magies.map((m) => [m.id, [m.classe, m.classe_2]])), 'les classes de chaque magie de la base, celles de la fiche');
  const palette = classesDeLaPalette();
  assert.ok(Object.values(couleurs).flat().every((c) => palette.has(c)), 'des classes de la palette');
  assert.doesNotMatch(racine[1], /#[0-9a-f]{3,6}\b/i, 'aucune couleur');
  // le titre, puis directement les filtres : plus de phrase d'introduction ni de bouton de création
  assert.match(html, /<h1>Personnages<\/h1>\s*<form class="personnages-filtres" id="filtres" role="search" aria-label="Filtres">/);
  assert.ok(!html.includes('personnages-nouveau') && !html.includes('Nouveau prétiré'), 'plus de bouton « + Nouveau prétiré »');
  assert.ok(!html.includes('Cliquez sur un en-tête') && !html.includes('des personnages qui ne sont à personne'), 'plus de phrase d’introduction');
  // filtres : ceux de lib/personnages-liste.mjs, plus de statut
  for (const cle of Object.keys(FILTRES_PAR_DEFAUT).filter((c) => !['tri', 'sens'].includes(c))) assert.match(html, new RegExp(`name="${cle}"`), `filtre ${cle}`);
  assert.ok(!html.includes('name="statut"'), 'plus de filtre de statut');
  // l'en-tête de la liste : un bouton par colonne triable, le portrait en simple libellé, dans l'ordre de COLONNES ; plus de tableau
  const tete = html.match(/<div class="personnages-tete" id="tete">([\s\S]*?)<\/div>/);
  assert.ok(tete, 'en-tête de la liste');
  const entetes = [...tete[1].matchAll(/<button type="button" class="col col--([a-z_]+)" data-cle="([a-z_]+)">([^<]+)<span class="fleche" aria-hidden="true">[^<]*<\/span><\/button>|<span class="col col--([a-z_]+)">([^<]+)<\/span>/g)]
    .map((m) => (m[1] ? { cle: m[2], titre: m[3], triable: true, classe: m[1] } : { cle: m[4], titre: m[5], triable: false, classe: m[4] }));
  assert.deepEqual(entetes.map(({ classe, ...e }) => e), COLONNES.map((c) => ({ cle: c.cle, titre: c.titre, triable: Boolean(c.tri) })));
  assert.ok(entetes.every((e) => e.classe === e.cle), 'la classe de chaque en-tête suit sa clé');
  assert.deepEqual(entetes.filter((e) => !e.triable).map((e) => e.cle), ['portrait'], 'seul le portrait ne se trie pas');
  assert.ok(!/data-cle="statut"/.test(html) && !/<th scope="col"/.test(html), 'ni colonne de statut ni tableau');
  // les lignes, remplies par le script de la page (chacune tout entière un lien vers la fiche)
  assert.match(html, /<ol class="personnages-lignes" id="lignes" aria-label="Personnages"><\/ol>/);
});

test('plus de /generateur/ : la page 404 renvoie l’ancienne adresse vers /fiche/ ; la fiche ouvre la rubrique Espace joueur du menu', options, () => {
  assert.ok(!existsSync(join(dist, 'generateur')), 'dossier dist/generateur/');
  // le script de la page 404 est inséré dans la page (petit) ou dans un fichier de _astro/
  const scripts = [lire('404.html'), ...readdirSync(join(dist, '_astro')).filter((f) => f.endsWith('.js')).map((f) => lire(`_astro/${f}`))];
  assert.ok(scripts.some((s) => /"generateur\/":`fiche\/`|"generateur\/":"fiche\/"/.test(s)), 'correspondance /generateur/ → /fiche/ dans le script de la page 404');
  const menu = lire('index.html').match(/<ul class="site-nav__items" data-group="joueur"[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.deepEqual([...menu.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`), ['Fiche de personnage /fiche/', 'Personnages /personnages/']);
  assert.match(lire('fiche/index.html'), /<button type="button" class="nav-group__toggle" data-group="joueur" aria-pressed="true" aria-current="true">/, 'rubrique ouverte sur la fiche');
});
