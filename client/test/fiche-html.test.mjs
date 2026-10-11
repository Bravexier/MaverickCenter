// Site CONSTRUIT (client/dist/) : la fiche de personnage (/fiche/, création et modification d'un prétiré) et la recherche des personnages
// (/personnages/), demandes du propriétaire ; l'ancien générateur (/generateur/) a disparu et son adresse mène à la fiche (page 404) ; le menu met
// la fiche à droite, après les métiers. Ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COLONNES, FILTRES_PAR_DEFAUT } from '../src/lib/personnages-liste.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'fiche', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const lire = (rel) => readFileSync(join(dist, rel), 'utf8');

test('/fiche/ : les étapes du guide dans la couleur de leur partie, les données à lire (règles, service) et le script', options, () => {
  const html = lire('fiche/index.html');
  assert.match(html, /<div class="fiche" id="fiche" data-regles="\/fiche\/regles\.json" data-api="\/api\/" data-personnages="\/personnages\/" data-fiche="\/fiche\/">/);
  const etapes = [...html.matchAll(/<section class="fiche-etape[^"]*" id="etape-([a-z]+)" style="--etape: (#[0-9a-f]{6})"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(etapes.map(([id]) => id), ['identite', 'magies', 'classes', 'attributs', 'progression', 'caracteristiques', 'sorts', 'maitrises', 'equipement', 'jeu', 'controles']);
  const creer = ['identite', 'magies', 'classes', 'attributs', 'caracteristiques', 'sorts', 'maitrises'];
  assert.ok(etapes.filter(([id]) => creer.includes(id)).every(([, c]) => c === '#2e7d4f'), 'les étapes de création : couleur de « Créer son personnage »');
  for (const [id] of etapes) assert.match(html, new RegExp(`<a href="#etape-${id}"`), `sommaire : ${id}`);
  for (const champ of ['nom', 'surnom', 'lieu_origine', 'xp', 'statut', 'metier_id', 'dieu_choisi_id', 'caracteristique_magie_id', 'ambidextrie', 'bourse_pp', 'notes', 'evenements']) {
    assert.match(html, new RegExp(`data-champ="${champ}"`), champ);
  }
  assert.match(html, /<style>[^<]*\.fiche-etape/, 'feuille de style de la fiche insérée dans la page');
  assert.match(html, /<script type="module" src="\/_astro\/[^"]+\.js"><\/script>/);
  assert.match(html, /<button type="button" class="fiche-barre__principal" id="fiche-enregistrer" disabled>Enregistrer<\/button>/);
});

test('/fiche/ disposée en rangées (demande du propriétaire) : 1-2-3, 6-7, 4-5, 10, 8-9, puis le contrôle ; aucun numéro de bloc', options, () => {
  const html = lire('fiche/index.html');
  const fiche = html.slice(html.indexOf('<div class="fiche" id="fiche"'));
  const jetons = [...fiche.matchAll(/<div class="fiche-rangee( fiche-rangee--[a-z0-9]+)?">|<section class="fiche-etape[^"]*" id="etape-([a-z]+)"/g)]
    .map((m) => (m[2] ? m[2] : `[${(m[1] ?? '').replace(' fiche-rangee--', '')}]`));
  assert.deepEqual(jetons, ['[3]', 'identite', 'magies', 'classes', '[2]', 'attributs', 'progression', '[2]', 'caracteristiques', 'sorts', '[]', 'maitrises',
    '[large]', 'equipement', 'jeu', 'controles']);
  const entre = fiche.slice(fiche.indexOf('id="etape-jeu"'), fiche.indexOf('id="etape-controles"'));
  assert.match(entre, /<\/section>\s*<\/div>\s*<section/, 'le contrôle hors des rangées, sur toute la largeur');
  assert.ok(!/class="num"/.test(fiche), 'plus de numéro, ni dans le sommaire ni dans les titres');
  for (const [, titre] of fiche.matchAll(/<h2 id="titre-[a-z]+">([^<]*)<\/h2>/g)) assert.doesNotMatch(titre, /^\d/, titre);
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
  // les quatre scores d'alignement serrés, l'alignement qui en résulte à côté
  assert.match(identite, /<fieldset class="alignement">[\s\S]*?<output class="alignement__resultat" id="alignement-resultat" aria-live="polite">/);
  const equipement = bloc('equipement');
  assert.ok(equipement.indexOf('data-champ="bourse_pp"') > equipement.indexOf('id="inventaire"'), 'la bourse à la fin de l’équipement');
  for (const champ of ['bourse_pp', 'bourse_ro', 'bourse_rf']) assert.match(equipement, new RegExp(`data-champ="${champ}"`), champ);
  const maitrises = bloc('maitrises');
  assert.match(maitrises, /<span class="budget fiche-etape__coin" id="budget-maitrises"><\/span>/, 'le quota dans un coin (décision R32)');
  assert.match(maitrises, /<ul id="maitrises" class="maitrises"/);
  assert.match(maitrises, /data-champ="ambidextrie"/);
  assert.ok(!bloc('caracteristiques').includes('id="maitrises"'), 'les maîtrises ont quitté les caractéristiques');
  const progression = bloc('progression');
  for (const id of ['xp-bloc', 'xp-niveau', 'xp-jauge', 'xp-plus', 'xp-ajout']) assert.match(progression, new RegExp(`id="${id}"`), `progression : ${id}`);
  assert.match(progression, /<div id="progression" class="gains"><\/div>/, 'gains de niveau compacts');
  const attributs = bloc('attributs');
  assert.match(attributs, /<div id="attributs-barres" class="attributs"><\/div>/, 'valeurs du moment et maximums fusionnés');
  assert.match(attributs, /<ul id="attributs-pastilles" class="fiche-resume attributs-pastilles"/, 'initiative, vitesse et nage en pastilles');
  assert.match(attributs, /<div id="attributs-corruption" class="attributs-corruption"><\/div>/);
  assert.match(attributs, /<div id="postures" class="postures__choix" role="group" aria-labelledby="titre-postures"><\/div>/, 'le sélecteur des six postures');
  assert.ok(!attributs.includes('fiche-aide'), 'plus de texte de calcul');
  const sorts = bloc('sorts');
  assert.ok(sorts.indexOf('id="dons-race"') > sorts.indexOf('id="sorts"') && sorts.indexOf('id="dons-classes"') > sorts.indexOf('id="dons-race"'),
    'sous les sorts : les dons de la race, puis ceux des classes');
  assert.ok(!html.includes('id="jauges"'), 'plus de bloc à part pour les valeurs du moment');
  for (const id of ['metier_id', 'alignement_loyal', 'bourse_pp']) assert.ok(!attributs.includes(`data-champ="${id}"`), `${id} hors des attributs`);
  const jeu = bloc('jeu');
  assert.match(jeu, /data-champ="notes"/);
  assert.match(jeu, /data-champ="evenements"/);
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

test('/fiche/regles.json : les règles de la base que lit la page', options, () => {
  const regles = JSON.parse(lire('fiche/regles.json'));
  assert.equal(regles.races.length, 27);
  assert.equal(regles.classes.length, 39);
  assert.equal(regles.niveaux.length, 20);
  assert.ok(regles.sorts.length > 300);
  assert.ok(regles.classes.every((c) => /^#[0-9a-f]{6}$/i.test(c.couleur) && Number.isInteger(c.groupe.ordre)));
});

test('/personnages/ : filtres et tableau dont chaque colonne se trie (un bouton par en-tête)', options, () => {
  const html = lire('personnages/index.html');
  assert.match(html, /<div class="personnages" id="personnages" data-api="\/api\/" data-fiche="\/fiche\/">/);
  const entetes = [...html.matchAll(/<th scope="col" data-cle="([a-z_]+)"[^>]*><button type="button">([^<]+)<span class="fleche" aria-hidden="true">/g)];
  assert.deepEqual(entetes.map((m) => m[1]), COLONNES.map((c) => c.cle));
  assert.deepEqual(entetes.map((m) => m[2]), COLONNES.map((c) => c.titre));
  for (const cle of Object.keys(FILTRES_PAR_DEFAUT).filter((c) => !['tri', 'sens'].includes(c))) assert.match(html, new RegExp(`name="${cle}"`), `filtre ${cle}`);
  assert.match(html, /<a class="personnages-nouveau" href="\/fiche\/">/);
});

test('plus de /generateur/ : la page 404 renvoie l’ancienne adresse vers /fiche/ ; la fiche ouvre la rubrique Personnages du menu', options, () => {
  assert.ok(!existsSync(join(dist, 'generateur')), 'dossier dist/generateur/');
  // le script de la page 404 est inséré dans la page (petit) ou dans un fichier de _astro/
  const scripts = [lire('404.html'), ...readdirSync(join(dist, '_astro')).filter((f) => f.endsWith('.js')).map((f) => lire(`_astro/${f}`))];
  assert.ok(scripts.some((s) => /"generateur\/":`fiche\/`|"generateur\/":"fiche\/"/.test(s)), 'correspondance /generateur/ → /fiche/ dans le script de la page 404');
  const menu = lire('index.html').match(/<ul class="site-nav__items" data-group="personnages"[^>]*>([\s\S]*?)<\/ul>/)[1];
  assert.deepEqual([...menu.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`), ['Fiche de personnage /fiche/', 'Listes /personnages/']);
  assert.match(lire('fiche/index.html'), /<button type="button" class="nav-group__toggle" data-group="personnages" aria-pressed="true" aria-current="true">/, 'rubrique ouverte sur la fiche');
});
