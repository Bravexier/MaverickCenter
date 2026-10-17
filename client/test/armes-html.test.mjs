// Onglet Armes de la page /ressources/equipement/ construite (dist/ ; avant, la page /ressources/armes/ : test/equipement-html.test.mjs pour la page et
// ses onglets) : rendu depuis les tables (pas de tableau Markdown), un tableau repliable par famille sans les armes de
// monstres, les colonnes voulues par le propriétaire, les lignes de départ en bleu avec leur infobulle, la description en infobulle du nom, les compétences
// en couleur (décision R48) et leur filtre, le panneau de règles (migration 0056 : ses blocs dans l'ordre de la base, tuiles et leurs titres, la mise
// en forme du classeur), les matériaux dans leur couleur, les améliorations, les champs du mode modification. Se saute sans dist/ (npm run build) ;
// la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMPETENCES_D_ARME } from '../src/lib/arme-champs.mjs';
import { ancreDArme, ancreDeMateriau, chargerArmes } from '../src/lib/armes-db.mjs';
import { COLONNES_D_UNE_ARME, htmlDesEffets, RENDUS_DES_ARMES } from '../src/lib/armes-rendu.mjs';
import { couleurDeMateriau } from '../src/lib/materiaux-couleurs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';
import { chargerPanneau } from '../src/lib/panneaux-regles-db.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
// le panneau de l'onglet Armes : de sa <section> au bloc des armures, qui le suit (components/equipement/EquipementPage.astro)
const main = html.slice(html.indexOf('<section class="equipement-panneau is-active" id="armes"'), html.indexOf('<div class="armures" data-armures>'));
const base = present ? ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }) : null;
const armes = present ? chargerArmes(base) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

test('pas de tableau Markdown : l’onglet est le gabarit des armes, avec son panneau de règles replié et sans phrase au-dessus', options, () => {
  assert.ok(main.length > 1000, 'le panneau de l’onglet Armes');
  assert.match(main, /<div class="armes" data-armes>(?:<template data-armes-piece="[A-Z]+">[\s\S]*?<\/template>)*<details class="preg" id="regles-armes" data-panneau-regles="armes">/, 'le panneau en tête');
  assert.ok(!main.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  assert.ok(!main.includes('armes__chapo'), 'plus de chapeau (demande du propriétaire, 2026-10-16)');
});

test('un tableau repliable par famille, sans les armes de monstres ; une ligne par arme, dans l’ordre de l’onglet', options, () => {
  const familles = [...main.matchAll(/<details class="tableau armes-famille" id="famille-([^"]+)" open/g)].map((m) => m[1]);
  assert.deepEqual(familles, armes.familles.map((f) => f.id));
  assert.ok(!familles.includes('arme-de-monstres'));
  const lignes = [...main.matchAll(/<tr class="arme(?: arme--depart)?" id="([^"]+)" data-arme=/g)].map((m) => m[1]);
  assert.deepEqual(lignes, armes.familles.flatMap((f) => f.armes.map((a) => ancreDArme(a.id))));
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('colonnes : Nom, Compétence, Type, Dégâts, Type de dégâts, Portée, Durabilité, Origine ; Description, Coût, Effet, départ et Remarque en mode modification', options, () => {
  const tete = main.slice(main.indexOf('<thead>'), main.indexOf('</thead>'));
  const colonnes = [...tete.matchAll(/<th scope="col"(?: class="ed-seul")?>([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(colonnes.slice(0, 8), ['Nom', 'Compétence', 'Type', 'Dégâts', 'Type de dégâts', 'Portée', 'Durabilité', 'Origine']);
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
    assert.ok(suite.includes(htmlDesEffets(a.effet)), `${a.id} : ses effets supplémentaires`);
    assert.ok(!main.slice(debut, fin).includes('class="arme__effets"'), `${a.id} : plus dans la ligne de l’arme`);
  }
});

test('armes de départ en bleu avec l’infobulle « Arme de départ » ; description en infobulle du nom ; remarque en étoile ; compétences en couleur', options, () => {
  for (const a of armes.familles.flatMap((f) => f.armes)) {
    const debut = main.indexOf(`id="${ancreDArme(a.id)}"`);
    const ligne = main.slice(main.lastIndexOf('<tr', debut), main.indexOf('</tr>', debut));
    assert.equal(ligne.includes('arme--depart') && ligne.includes('title="Arme de départ"'), a.depart_possible === 1, a.id);
    if (a.description) assert.ok(ligne.includes(`title="${echapper(a.description)}"`), `${a.id} : description en infobulle`);
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
  const boutons = [...filtre.matchAll(/<button type="button" class="arme-comp armes-filtre__choix" data-competence="([^"]+)" aria-pressed="false" style="--c1: ([^;]+); --c2: [^"]*" title="([^"]+)">([^<]+)<\/button>/g)];
  assert.deepEqual(boutons.map((m) => m[1]), Object.keys(COMPETENCES_D_ARME));
  assert.deepEqual(boutons.map((m) => m[4]), ['Lourde', 'Légère', 'Arc', 'Arbalète']);
  const couleur = Object.fromEntries(boutons.map((m) => [m[4], m[2]]));
  assert.equal(couleur.Arc, couleur.Lourde, 'l’Arc a la couleur de la Force, comme l’Arme Lourde');
  assert.notEqual(couleur['Arbalète'], couleur.Lourde);
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
    const c = couleurDeMateriau(m.ligne.ressource_id);
    // la couleur sur la ligne entière (demande du propriétaire, 2026-10-16 : « La ligne tout entière devrait prendre la couleur du matériau »)
    assert.ok(main.includes(`id="${ancreDeMateriau(m.ligne.ressource_id)}" data-materiau="${m.ligne.ressource_id}"${m.nom === 'Fer' ? ' data-defaut="1"' : ''} style="--mat: ${c.fond}; --mat-texte: ${c.texte}">`), m.nom);
  }
  assert.ok(!main.includes('<th scope="row" class="materiau__nom" style='), 'plus de couleur sur la seule case du nom');
  // les effets sur une ligne (styles/armes/armes.css) : le bonus aux dégâts, puis les autres effets, en morceaux frères ; le mot « Dégâts » reste pour
  // les lecteurs d'écran (les effets se modifient sur la page Composants, R62 : le test lit ceux de la base)
  for (const m of armes.materiaux) assert.ok(main.includes(RENDUS_DES_ARMES['materiau-effet'](m.ligne.effet_brut)), `${m.nom} : ses effets`);
  const avecBonus = armes.materiaux.map((m) => RENDUS_DES_ARMES['materiau-effet'](m.ligne.effet_brut)).filter((h) => h.includes('materiau-effet__bonus'));
  assert.ok(avecBonus.length > 0);
  for (const h of avecBonus) assert.match(h, /^<span class="materiau-effet"[^>]*><span class="materiau-effet__bonus"><span class="materiau-effet__mot">Dégâts <\/span>[+−]\d+<\/span>(<span class="materiau-effet__(cran|secondaire)">[^<]+<\/span>)*<\/span>$/);
  assert.deepEqual(armes.materiaux.filter((m) => m.defaut).map((m) => m.nom), ['Fer']);
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

test('le script de la page n’importe que lib/arme-forge.mjs et lib/armes-filtres.mjs, qu’aucun autre script de page n’importe', options, () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/armes.mjs', import.meta.url)), ['../lib/arme-forge.mjs', '../lib/armes-filtres.mjs']);
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'armes.mjs')) {
    const autres = imports(new URL(nom, scripts)).filter((m) => /\/(arme-forge|armes-filtres)\.mjs$/.test(m));
    assert.deepEqual(autres, [], nom);
  }
});
