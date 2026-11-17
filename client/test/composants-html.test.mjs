// Page /ressources/composants/ construite (dist/) : rendue depuis les tables (lib/composants-db.mjs), un onglet par tableau dans l'ordre de la table
// composant_onglet (migration 0057 : monnaie, matériaux, gemmes, bois, fruits, ingrédients par catégorie, tableaux de l'onglet « Équipement inventaire »),
// leur titre et leur note modifiables, une ligne par composant, les champs du mode modification (data-ed), l'entité de chaque ligne (création,
// suppression), sa place dans le menu (Règles › Artisanat) et son fil d'Ariane. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerComposants } from '../src/lib/composants-db.mjs';
import { ancreDeComposant } from '../src/lib/composants-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd, lireAttributEd } from '../src/lib/edition-modele.mjs';
import { classeDeMateriau, cssDesFamilles } from '../src/lib/palette-css.mjs';
import { baseDImport } from './aide-base-d-import.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'composants', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const c = present ? chargerComposants(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
// les matériaux par leur id (le site de dev les renomme)
const FER = 'ressources/armures#materiau:fer';
const OS = 'ressources/armes#materiau:os';
const MYTHRIL = 'ressources/armures#materiau:mythril';
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

/** Le panneau d'un tableau (son onglet ouvert ou non). */
const panneau = (id) => {
  const debut = main.search(new RegExp(`<section class="tableau comp-tableau composants-panneau(?: is-active)?" id="${id}"`));
  return debut < 0 ? '' : main.slice(debut, main.indexOf('</section>', debut));
};

test('un onglet par tableau, dans l’ordre de la base : monnaie, matériaux, gemmes, bois, fruits, ingrédients, équipement', options, () => {
  // demande du propriétaire, 2026-10-17 : « à l'image de la page d'équipement avoir des onglets pour chaque table »
  const panneaux = [...main.matchAll(/<section class="tableau comp-tableau composants-panneau(?: is-active)?" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(panneaux, ['monnaie', 'materiaux', 'gemmes', 'bois', 'fruits', 'ingredients-solvant', 'ingredients-essence', 'ingredients-amplificateur',
    'ingredients-catalyseur', 'ingredients-stabilisateur', 'objets-vegetaux', 'objets-animaux', 'objets-autres', 'objets-matos-aventures',
    'objets-matos-fabrication', 'objets-matos-projectile']);
  assert.deepEqual(panneaux, c.onglets.map((o) => o.id), 'l’ordre de la table composant_onglet');
  const barre = main.slice(main.indexOf('<nav class="composants-onglets"'), main.indexOf('</nav>', main.indexOf('<nav class="composants-onglets"')));
  assert.match(barre, /data-onglets="Composants"/);
  const onglets = [...barre.matchAll(/<a class="onglet(?: is-active)?" id="onglet-([^"]+)" href="#([^"]+)">/g)];
  assert.deepEqual(onglets.map((m) => m[1]), panneaux);
  assert.deepEqual(onglets.map((m) => m[2]), panneaux, 'chaque onglet mène à son panneau');
  assert.equal([...barre.matchAll(/class="onglet is-active"/g)].length, 1, 'le premier onglet ouvert');
  assert.ok(main.includes('<section class="tableau comp-tableau composants-panneau is-active" id="monnaie"'), 'son panneau aussi');
  assert.ok(!/<details class="[^"]*comp-tableau/.test(main), 'plus de tableaux repliables');
  assert.ok(html.includes('data-edition'), 'la page se modifie sur le site de dev');
  // plus d'entrée au menu (2026-10-18 : « Composants en Artisanat ok ») : la page est dans le sommaire de l'Artisanat ; la rubrique Équipement ouverte
  // (toute page de ressources/ l'ouvre, lib/nav.mjs ; R184 : la page reste dans l'Équipement)
  assert.match(html, /data-group="equipement" aria-pressed="true" aria-current="true"/, 'la page ouvre l’Équipement');
  assert.match(readFileSync(join(dist, 'regles', 'artisanat', 'index.html'), 'utf8'), /<a href="\/ressources\/composants\/">Composants<\/a>/, 'dans l’Artisanat');
  // l'Artisanat, son sommaire, est son fil d'Ariane ; il n'est plus une entrée du menu du site (R184 : une entrée du menu latéral de l'onglet
  // Exploration des Règles) : aucune entrée marquée
  assert.ok(main.includes('<p class="muted"><a href="/">Accueil</a> › <a href="/regles/artisanat/">Artisanat</a></p>'), 'fil d’Ariane vers l’Artisanat');
  assert.ok(!html.includes('<a href="/regles/artisanat/" aria-current'), 'plus d’entrée Artisanat au menu du site');
  assert.doesNotMatch(html, /<a href="[^"]*" aria-current="true">/, 'aucune entrée du menu marquée');
  // un seul lien vers /ressources/ : l'entrée Autres du menu Équipement (« sous menu-autres », 2026-10-29), aucun dans la page
  assert.equal(html.split('href="/ressources/"').length - 1, 1, 'un seul lien vers /ressources/');
  assert.ok(html.includes('<a href="/ressources/">Autres</a>'), 'celui de l’entrée Autres du menu');
  assert.ok(!html.includes('aria-current="page"'), 'la page n’est pas une entrée du menu');
});

test('le titre et la note d’un onglet viennent de la base et se modifient (composant_onglet)', options, () => {
  // « Il faudrait aussi qu'elles soient modifiables et directement liées en base »
  for (const o of c.onglets) {
    const p = panneau(o.id);
    const titre = echapper(attributEd('composant_onglet', { id: o.id }, 'titre'));
    assert.ok(p.includes(`<h2 class="tableau__titre comp-tableau__titre"><span class="tableau__nom comp-tableau__nom" id="${o.id}-titre" data-ed="${titre}">${echapper(o.titre)}</span></h2>`), o.id);
    assert.ok(main.includes(`<span class="onglet__nom" data-ed-lecture="${titre}">${echapper(o.titre)}</span>`), `${o.id} : le nom de l’onglet suit le titre`);
    const note = echapper(attributEd('composant_onglet', { id: o.id }, 'note'));
    assert.ok(p.includes(o.note ? `data-ed="${note}" data-ed-cadre>${echapper(o.note)}</p>` : `hidden data-ed="${note}" data-ed-cadre></p>`), `${o.id} : sa note`);
    // le gabarit commun des tableaux (components/Tableau.astro)
    assert.match(p, new RegExp(`<div class="tableau__defile"><table class="table-donnees comp-table" aria-labelledby="${o.id}-titre"`));
  }
});

test('une ligne par composant, avec son entité ; aucun consommable (potion, livre)', options, () => {
  const lignes = [...main.matchAll(/<tr class="composant(?: composant--magie couleur-magie-[a-z0-9-]+)?" id="([^"]+)"/g)].map((m) => m[1]);
  const attendues = [
    ...c.monnaies.map((m) => `monnaie-${m.id}`), ...[...c.materiaux, ...c.gemmes, ...c.bois, ...c.fruits, ...c.ingredients.flatMap((x) => x.ingredients),
      ...c.objets.flatMap((s) => s.objets)].map((r) => ancreDeComposant(r.id)),
  ];
  assert.deepEqual(lignes, attendues);
  assert.equal(new Set(lignes).size, lignes.length, 'ancres uniques');
  // la table des fruits : les ingrédients de type « Fruit », un type que le site de dev modifie ; à l'import, elle n'est pas vide
  assert.ok(c.fruits.every((f) => f.type === 'Fruit'), 'la table des fruits');
  assert.ok(chargerComposants(baseDImport()).fruits.length > 0, 'la table des fruits, à l’import');
  assert.ok(!main.includes('#potion:') && !main.includes('#livre:'), 'pas de consommable');
});

test('les champs du mode modification se relisent ; un composant cité ne se supprime pas', options, () => {
  const eds = [...main.matchAll(/data-ed(?:-lecture)?="([^"]+)"/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'"));
  assert.ok(eds.length > 500);
  for (const e of eds) assert.ok(lireAttributEd(e), e);
  const fer = c.materiaux.find((m) => m.id === FER);
  assert.ok(main.includes(echapper(attributEd('ressource', { id: fer.id }, 'prix_brut'))));
  assert.ok(fer.citations.length > 0);
  assert.match(main, new RegExp(`id="${ancreDeComposant(fer.id)}"[^>]*data-citee="Cité par : [^"]*armures`));
  const gemme = c.gemmes[0];
  assert.ok(main.includes(echapper(attributEd('gemme', { ressource_id: gemme.id }, 'quart_parfaite_brut'))));
});

test('décision R219 (3) : l’onglet Monnaie est figé — dans son panneau, seuls le titre et la note de l’onglet se modifient, le symbole suit la base en lecture', options, () => {
  const p = panneau('monnaie');
  assert.ok(p.includes('data-monnaie='), 'le panneau des monnaies');
  const eds = [...p.matchAll(/data-ed="([^"]+)"/g)].map((m) => lireAttributEd(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")));
  assert.deepEqual([...new Set(eds.map((e) => e.table))], ['composant_onglet'], 'aucune case d’une monnaie ne se modifie');
  for (const m of c.monnaies) assert.ok(p.includes(`data-ed-lecture="${echapper(attributEd('monnaie', { id: m.id }, 'abreviation'))}"`), `${m.id} : son symbole suit la base`);
});

test('les monnaies en icônes dans les tables (décision R61) : plus d’abréviation dans une case de tableau ; le type de chaque matériau (R62)', options, () => {
  for (const page of ['ressources/composants', 'ressources/equipement-inventaire', 'ressources/livre-parchemin', 'ressources/armes', 'ressources/armures',
    'ressources/bouclier', 'ressources/objets-a-la-ceinture', 'ressources/accessoires']) {
    const h = readFileSync(join(dist, ...page.split('/'), 'index.html'), 'utf8');
    const cases = [...h.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    const restes = cases.filter((c) => /(?<![\p{L}\p{N}])(R[OoFf]|PP)(?![\p{L}\p{N}])/u.test(c));
    assert.deepEqual(restes, [], `${page} : abréviations restées dans les cases`);
    assert.match(h, /class="piece piece--(rf|ro|pp)" role="img"/, `${page} : les icônes`);
  }
  for (const m of c.materiaux) assert.ok(['Léger', 'Intermédiaire', 'Lourd', 'Autres'].includes(m.type), m.nom);
  // l'Os en « Autres » (R62, migration 0041) : un type que le site de dev modifie, lu à l'import (test/aide-base-d-import.mjs)
  assert.equal(chargerComposants(baseDImport()).materiaux.find((m) => m.id === OS)?.type, 'Autres');
  // chaque matériau montre son type courant, modifiable
  const materiaux = panneau('materiaux');
  for (const m of c.materiaux) {
    const debut = materiaux.indexOf(`id="${ancreDeComposant(m.id)}"`);
    assert.match(materiaux.slice(debut, materiaux.indexOf('</tr>', debut)), new RegExp(`<td class="comp-type" data-ed="[^"]*materiau[^"]*">${m.type}</td>`), `${m.nom} : son type`);
  }
});

test('les matériaux : leur fabrication (la recette du tableau MATÉRIAUX des onglets « Armures » et « Bouclier », qui a quitté la page « Équipement »), en lecture', options, () => {
  // demande du propriétaire, 2026-10-16 : ce tableau des armures et des boucliers « devrait disparaître et être mélangé au tableau des matériaux des Composants »
  const t = panneau('materiaux');
  const entetes = [...t.slice(t.indexOf('<thead>'), t.indexOf('</thead>')).matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes, ['Matière', 'Type', 'Prix', 'Description', 'Fabrication', 'Effets sur une arme', 'Utilisé pour']);
  // chaque matériau d'armure ou de bouclier a sa recette (l'Os, de la page des armes, n'en a pas)
  assert.ok(c.materiaux.filter((m) => m.usages.includes('Armures') || m.usages.includes('Boucliers')).every((m) => m.fabrication), 'une fabrication par matériau d’armure ou de bouclier');
  for (const m of c.materiaux) {
    const debut = t.indexOf(`id="${ancreDeComposant(m.id)}"`);
    const ligne = t.slice(debut, t.indexOf('</tr>', debut));
    assert.ok(ligne.includes(m.fabrication ? `<td class="comp-fabrication">${echapper(m.fabrication)}</td>` : '<td class="comp-fabrication"><span class="vide"'), m.nom);
  }
  assert.ok(t.includes('10 minerais de Mythril + Fourneau de Séraphin'), 'la fabrication du Mythril');
  assert.ok(!/<td class="comp-fabrication"[^>]*data-ed/.test(t), 'la fabrication ne se modifie pas');
  // la description (« les grands textes ») y est déjà : celle de la ressource, la même que l'ancien tableau des armures
  const mythril = c.materiaux.find((m) => m.id === MYTHRIL);
  assert.ok(mythril?.description && t.includes(echapper(mythril.description).replace(/\n/g, '<br>')), 'la description du Mythril');
  // la couleur de chaque matériau (celle de l'onglet « Armes ») : sa pastille porte la classe du matériau (lib/palette-css.mjs, famille `materiau` ;
  // `par-defaut` pour un matériau sans couleur), jamais un style ; la page émet la feuille de la famille
  for (const m of c.materiaux) {
    const debut = t.indexOf(`id="${ancreDeComposant(m.id)}"`);
    assert.ok(t.slice(debut, t.indexOf('</tr>', debut)).includes(`<span class="comp-teinte ${classeDeMateriau(m.id)}" aria-hidden="true"></span>`), `${m.nom} : sa pastille`);
  }
  assert.doesNotMatch(t, /class="comp-teinte[^"]*"[^>]*style=/, 'aucune couleur de matériau en style');
  assert.ok(html.includes(`<style>${cssDesFamilles(['materiau'])}</style>`), 'la feuille des matériaux');
});
