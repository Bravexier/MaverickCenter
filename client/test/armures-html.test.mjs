// Onglets Armures et Boucliers de la page /ressources/equipement/ construite (dist/ ; avant, la page /ressources/armures/ : test/equipement-html.test.mjs
// pour la page et ses onglets) : rendus depuis les tables (pas de tableau Markdown), deux onglets (Armures, Boucliers : « Les deux seront
// dans la page »), deux tableaux de matériaux à choisir pour l'armure (« deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée »), la
// liste des armures (« Une liste plus classique est disponible également »), les armures particulières en premier, et les améliorations ; plus de
// tableau FABRICATION (une armure ne se fabrique plus pièce par pièce : décision R93) ni de création par pièces dans les règles (R95) ; la forme, ses améliorations sous elle, et la matière d'un bouclier (« forme + matière »), la liste des boucliers en un seul tableau
// replié et triable (AP et AM séparés), le poids de chaque bouclier (décision R92) ; plus de tableau MATÉRIAUX (sa fabrication est sur la page
// « Composants » : test/composants-html.test.mjs) ; les champs du mode modification. Les pages « Armures » et « Bouclier » ne sont plus construites : leurs liens mènent à leur onglet. Se saute sans dist/ (npm run build) ;
// la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ancreDArmure, ancreDeBouclier, chargerArmures, coutDeFabrication } from '../src/lib/armures-db.mjs';
import { prixEnRo } from '../src/lib/arme-champs.mjs';
import { couleurDuPoids, couleurDuType } from '../src/lib/armures-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
// le bloc des armures et des boucliers : ses deux panneaux, jusqu'au panneau de la ceinture
const main = html.slice(html.indexOf('<div class="armures" data-armures>'), html.indexOf('<section class="equipement-panneau ceinture" id="ceinture"'));
const armures = present ? chargerArmures(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
/** Le HTML d'un panneau (onglet) : de son <section> au suivant. */
const panneau = (id) => {
  const debut = main.indexOf(`<section class="armures-panneau equipement-panneau" id="${id}"`);
  const fin = main.indexOf('<section class="armures-panneau', debut + 10);
  return main.slice(debut, fin < 0 ? undefined : fin);
};

test('pas de tableau Markdown : le gabarit des armures, deux panneaux (Armures, Boucliers), les règles de chaque onglet repliées', options, () => {
  assert.match(main, /^<div class="armures" data-armures>/);
  assert.ok(!main.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  for (const id of ['armures', 'boucliers']) assert.ok(panneau(id).length > 1000, `le panneau ${id}`);
  assert.equal((main.match(/<details class="armures-regles">/g) ?? []).length, 2);
  assert.ok(panneau('armures').includes('Une armure a besoin de 2 matériaux pour être fabriquée'), 'les règles des armures (le texte de l’onglet)');
  // « Suppression de la création par pièces » (décision R95) : les paragraphes retirés par la migration 0055, et la note de la décision R93 qui les précédait
  for (const retire of ['il faut 2 matériaux pour chaque morceau', 'Comme vous le savez il est possible de fabriquer', 'armures-regles__decision']) {
    assert.ok(!panneau('armures').includes(retire), retire);
  }
  assert.ok(panneau('boucliers').includes('autant de matériaux que sa classe indique'), 'les règles des boucliers');
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('armures : deux tableaux des matières de la grille (premier et second matériau), chaque matière dans la couleur de son type', options, () => {
  const p = panneau('armures');
  for (const role of ['m1', 'm2']) {
    const table = p.slice(p.indexOf(`data-choix="${role}"`), p.indexOf('</table>', p.indexOf(`data-choix="${role}"`)));
    const cles = [...table.matchAll(/<tr class="pmat" data-materiau="([^"]+)" data-type="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(cles, armures.materiaux.map((m) => m.cle), role);
    for (const m of armures.materiaux) assert.ok(table.includes(`<th scope="row" class="pmat__nom" style="--t: ${couleurDuType(m.type)}">`), `${role} ${m.cle}`);
    assert.equal((table.match(/data-ed-lecture=/g) ?? []).length, armures.materiaux.length * 2, 'nom et prix en lecture (décision R62)');
    // « pour les tableaux des matériaux il faudra rajouter le total pour une armure (le X6) » (demande du propriétaire, 2026-10-16 ; décision R93)
    assert.match(table, /<th scope="col" title="Pour une armure : les 6 unités de ce matériau qu’elle demande \(décision R93\)">Prix ×6<\/th>/, `${role} : l’en-tête`);
    for (const m of armures.materiaux) {
      const ligne = table.slice(table.indexOf(`data-materiau="${m.cle}"`), table.indexOf('</tr>', table.indexOf(`data-materiau="${m.cle}"`)));
      const attendu = Math.round(6 * prixEnRo(m.prix) * 100) / 100;
      assert.ok(ligne.includes(`<td class="pmat__prix-armure" data-prix-armure><span class="pprix" data-ro="${attendu}">`), `${role} ${m.cle} : 6 × ${prixEnRo(m.prix)}`);
    }
  }
  // pas de « Prix ×6 » pour une matière de bouclier (une forme demande autant de matériaux que sa classe)
  assert.ok(!panneau('boucliers').includes('data-prix-armure'));
  // chaque paire de matières (dans un ordre ou dans l'autre) donne une seule armure de la grille : le choix trouve toujours son armure
  const paires = new Set(armures.combinaisons.map((a) => [a.m1, a.m2].sort().join('|')));
  assert.equal(paires.size, armures.combinaisons.length);
  const n = armures.materiaux.length;
  assert.equal(armures.combinaisons.length, (n * (n + 1)) / 2);
});

test('armures : les armures particulières en premier puis la liste par type, une ligne par armure, ses champs modifiables', options, () => {
  const p = panneau('armures');
  // « tu met le tableau "Armure particulières" en tout premier de la liste des armures » (demande du propriétaire, 2026-10-16)
  const liste = p.slice(p.indexOf('<div class="armures-listes">'));
  const blocs = [...liste.matchAll(/<details class="armures-bloc armures-liste" id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(blocs[0], 'armures-particulieres');
  assert.ok(blocs.length > 1 && blocs.slice(1).every((id) => id.startsWith('armures-') && id !== 'armures-particulieres'), blocs.join(', '));
  const lignes = [...p.matchAll(/<tr class="armure(?: armure--particuliere)?" id="([^"]+)" data-armure=/g)].map((m) => m[1]);
  assert.equal(lignes.length, armures.combinaisons.length + armures.particulieres.length);
  assert.deepEqual(new Set(lignes), new Set([...armures.combinaisons, ...armures.particulieres].map((a) => ancreDArmure(a.id))));
  const a = armures.combinaisons[0];
  for (const colonne of ['nom', 'type', 'stats_brut', 'solidite', 'resistance_brut', 'faiblesse_brut']) {
    assert.ok(p.includes(`data-ed="${echapper(attributEd('armure', { id: a.id }, colonne))}"`), colonne);
  }
  // « Pour les tableaux des armures j'aimerai séparer les colonnes d'AP et d'AM » (demande du propriétaire, 2026-10-16) : la défense se modifie dans la
  // case AP, la case AM la suit en lecture, comme dans la liste des boucliers ; plus de colonne « Défense » dans les listes d'armures
  const listes = p.slice(p.indexOf('<div class="armures-listes">'), p.indexOf('<aside class="armures-cote"'));
  for (const x of [...armures.particulieres, ...armures.combinaisons]) {
    const ligne = listes.slice(listes.indexOf(`id="${ancreDArmure(x.id)}"`), listes.indexOf('</tr>', listes.indexOf(`id="${ancreDArmure(x.id)}"`)));
    assert.ok(ligne.includes(`<td class="armure__ap" data-ed="${echapper(attributEd('armure', { id: x.id }, 'stats_brut'))}" data-ed-rendu="protection-ap"><span class="pdef" data-ap=`), `${x.nom} : AP`);
    assert.ok(ligne.includes(`<td class="armure__am" data-ed-lecture="${echapper(attributEd('armure', { id: x.id }, 'stats_brut'))}" data-ed-rendu="protection-am"><span class="pdef" data-ap=`), `${x.nom} : AM`);
  }
  const entetes = [...listes.matchAll(/<thead>([\s\S]*?)<\/thead>/g)].map((m) => [...m[1].matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((t) => t[1]));
  assert.deepEqual(entetes[0], ['Nom', 'Type', 'AP', 'AM', 'Solidité', 'Effet', 'Prix'], 'armures particulières');
  for (const e of entetes.slice(1)) assert.deepEqual(e, ['Nom', 'Matériaux', 'Type', 'AP', 'AM', 'Solidité', 'Résistance', 'Faiblesse', 'Prix'], 'armures de la grille');
  assert.ok(p.includes(`data-m1="${a.m1}" data-m2="${a.m2}"`));
  const particuliere = armures.particulieres[0];
  for (const colonne of ['effet', 'prix_brut']) assert.ok(p.includes(`data-ed="${echapper(attributEd('armure', { id: particuliere.id }, colonne))}"`), `particulière : ${colonne}`);
});

test('décision R93 : le prix de chaque armure de la grille = la fabrication de l’armure complète + 6 unités de chaque matériau, calculé, non modifiable', options, () => {
  const p = panneau('armures');
  // la fabrication (« Armure Complète » du tableau FABRICATION, 10 RO), écrite et modifiable dans la phrase du prix, au-dessus des matériaux
  const fabrication = coutDeFabrication(armures.fabricationDeLArmure);
  assert.ok(fabrication > 0);
  assert.ok(p.includes(`<span data-armures-fabrication data-ed="${echapper(attributEd('armure_emplacement', { id: 'armure-complete' }, 'cout_brut'))}" data-ed-rendu="piece-cout"><span class="pcout" data-ro="${fabrication}">`), 'la fabrication');
  assert.ok(!p.includes(`data-ed="${echapper(attributEd('armure', { id: armures.combinaisons[0].id }, 'prix_brut'))}"`), 'le prix écrit dans la grille n’est plus modifiable');
  const prixDe = new Map(armures.materiaux.map((m) => [m.ligne.ressource_id, prixEnRo(m.prix)]));
  for (const a of armures.combinaisons) {
    const ligne = p.slice(p.indexOf(`id="${ancreDArmure(a.id)}"`), p.indexOf('</tr>', p.indexOf(`id="${ancreDArmure(a.id)}"`)));
    const attendu = Math.round((fabrication + 6 * prixDe.get(a.materiau_ligne_id) + 6 * prixDe.get(a.materiau_colonne_id)) * 100) / 100;
    assert.match(ligne, new RegExp(`<td class="armure__prix" data-prix-calcule title="Fabrication de l’armure complète \\+ [^"]+"><span class="pprix" data-ro="${attendu}">`), a.nom);
  }
});

test('armures : à côté, la fiche (remplie par le script) et les améliorations +1 à +5, sans ligne Total ; plus de tableau FABRICATION (décision R93)', options, () => {
  const p = panneau('armures');
  assert.match(p, /<section class="pfiche" data-fiche="armure" aria-label="Fiche de l’armure" aria-live="polite">/);
  // « On ne peux plus concevoir d'armure pièce par pièce. Ce n'est que armure complète. Tu peux donc retirer le tableau actuel de "fabrication" »
  // (demande du propriétaire, 2026-10-16)
  assert.ok(!main.includes('class="ppiece"') && !main.includes('id="pieces"'), 'ni pièce ni tableau FABRICATION');
  assert.ok(!p.includes('>Fabrication<'), 'aucun bloc « Fabrication » dans l’onglet Armures');
  const niveaux = [...p.matchAll(/<tr class="pamelioration" data-cible="armure" data-niveau="(\d+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(niveaux, armures.ameliorations.armure.map((x) => x.niveau));
  // « La ligne "total" des améliorations est inutile » (demande du propriétaire, 2026-10-16) : ni pour les armures, ni pour les boucliers
  assert.ok(!html.includes('data-armures-total') && !panneau('boucliers').includes('<tfoot>') && !p.includes('<tfoot>'));
  // les fiches sont réduites à leurs tuiles (demande du propriétaire, 2026-10-16) : le détail du calcul est leur infobulle, écrite par le script hors
  // du panneau qui défile, dans le panneau de l'onglet
  for (const [onglet, quoi] of [['armures', 'armure'], ['boucliers', 'bouclier']]) {
    assert.match(panneau(onglet), new RegExp(`</aside>\\s*</div>\\s*<div class="armures-bulles" data-armures-bulles="${quoi}"></div>`), `${onglet} : le conteneur des infobulles`);
  }
});

test('boucliers : la forme et, sous elle, les améliorations, la matière à côté ; la liste en un seul tableau replié, triable, AP et AM séparés ; le poids de chaque bouclier', options, () => {
  const p = panneau('boucliers');
  const formes = [...p.matchAll(/<tr class="forme" data-forme="([^"]+)" data-classe="(\d)">/g)].map((m) => m[1]);
  assert.deepEqual(formes, armures.formes.map((f) => f.id));
  // le coût de fabrication du bouclier (tableau FABRICATION de l'onglet du classeur), seule ligne de ce tableau que la page garde (décision R93)
  assert.ok(p.includes(`data-ed="${echapper(attributEd('armure_emplacement', { id: 'bouclier' }, 'cout_brut'))}" data-ed-rendu="piece-cout"`), 'fabrication du bouclier');
  // « je veux que la table d'amélioration soit directement sous celui de la forme » (demande du propriétaire, 2026-10-16) : dans la même colonne, avant la matière
  const colonne = p.slice(p.indexOf('<div class="armures-colonne">'), p.indexOf('id="matieres-de-bouclier"'));
  assert.ok(colonne.indexOf('id="formes-de-bouclier"') > 0 && colonne.indexOf('id="ameliorations-bouclier"') > colonne.indexOf('id="formes-de-bouclier"'));
  const table = p.slice(p.indexOf('data-choix="matiere"'), p.indexOf('</table>', p.indexOf('data-choix="matiere"')));
  assert.deepEqual([...table.matchAll(/<tr class="pmat" data-materiau="([^"]+)"/g)].map((m) => m[1]), armures.matieres.map((m) => m.cle));
  const niveaux = [...p.matchAll(/<tr class="pamelioration" data-cible="bouclier" data-niveau="(\d+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(niveaux, armures.ameliorations.bouclier.map((x) => x.niveau));

  // la liste complète : un seul tableau, replié par défaut, un en-tête triable par colonne, AP et AM séparés
  assert.match(p, /<details class="armures-bloc armures-liste" id="liste-des-boucliers">/, 'replié par défaut (pas d’attribut open)');
  assert.equal((p.match(/<table class="armures-table armures-table--liste/g) ?? []).length, 1, 'un seul tableau de boucliers');
  const liste = p.slice(p.indexOf('data-triable'), p.indexOf('</table>', p.indexOf('data-triable')));
  assert.deepEqual([...liste.matchAll(/<th scope="col" data-tri="([^"]+)"/g)].map((m) => m[1]), ['nom', 'forme', 'matiere', 'ap', 'am', 'solidite', 'poids', 'prix']);
  const boucliers = [...liste.matchAll(/<tr class="bouclier" id="([^"]+)" data-bouclier="[^"]+" data-forme="([^"]+)" data-matiere="([^"]+)" data-ordre="(\d+)">/g)];
  assert.equal(boucliers.length, armures.boucliers.length);
  assert.deepEqual(boucliers.map((m) => Number(m[4])), armures.boucliers.map((_, i) => i), 'l’ordre de l’onglet, pour défaire le tri');
  assert.deepEqual(new Set(boucliers.map((m) => m[1])), new Set(armures.boucliers.map((b) => ancreDeBouclier(b.id))));
  // chaque forme × matière donne un seul bouclier : le choix trouve toujours son bouclier
  assert.equal(new Set(boucliers.map((m) => `${m[2]}|${m[3]}`)).size, armures.formes.length * armures.matieres.length);
  const b = armures.boucliers[0];
  const ligne = liste.slice(liste.indexOf(`id="${ancreDeBouclier(b.id)}"`), liste.indexOf('</tr>', liste.indexOf(`id="${ancreDeBouclier(b.id)}"`)));
  assert.ok(ligne.includes(`<td class="bouclier__ap" data-ed="${echapper(attributEd('bouclier', { id: b.id }, 'defense_brut'))}" data-ed-rendu="protection-ap">`), 'la défense se modifie dans la case AP');
  assert.ok(ligne.includes(`<td class="bouclier__am" data-ed-lecture="${echapper(attributEd('bouclier', { id: b.id }, 'defense_brut'))}" data-ed-rendu="protection-am">`), 'la case AM suit en lecture');
  assert.ok(ligne.includes(`<td class="bouclier__poids" data-ed="${echapper(attributEd('bouclier', { id: b.id }, 'poids_id'))}" data-ed-rendu="bouclier-poids">`), 'le poids se choisit');
  const forme = armures.formes.find((f) => f.id === b.classe_id);
  assert.ok(ligne.includes(`<td class="bouclier__forme" data-classe="${forme.classe}">`) && ligne.includes(`>${forme.nom}</span>`), 'la forme et sa classe');
  // le poids de chaque bouclier (décision R92) : sa pastille dans la couleur de son poids, « Requiert N Force minimum » en infobulle
  const poidsDe = new Map(armures.poids.map((x) => [x.id, x]));
  for (const x of armures.boucliers) {
    const q = poidsDe.get(x.poids_id);
    assert.ok(q, `${x.id} : poids ${x.poids_id}`);
    const l = liste.slice(liste.indexOf(`id="${ancreDeBouclier(x.id)}"`), liste.indexOf('</tr>', liste.indexOf(`id="${ancreDeBouclier(x.id)}"`)));
    assert.ok(l.includes(`<span class="ppoids" style="--t: ${couleurDuPoids(q.id)}" data-poids="${q.id}" data-force="${q.force_min}" title="Requiert ${q.force_min} Force minimum">${q.nom}</span>`), x.id);
  }

  // à côté : la fiche ; la liste des poids reste (mode modification, sans JavaScript), ses champs modifiables, mais plus en lecture (styles/armures/armures.css)
  assert.match(p, /<section class="pfiche" data-fiche="bouclier" aria-label="Fiche du bouclier" aria-live="polite">/);
  assert.ok(p.indexOf('id="poids-de-bouclier"') > p.indexOf('data-fiche="bouclier"'));
  for (const poids of armures.poids) assert.ok(p.includes(`data-ed="${echapper(attributEd('bouclier_poids', { id: poids.id }, 'force_brut'))}"`), poids.id);
  // (la feuille de style est insérée avant le bloc des armures : lue dans la page entière)
  assert.ok(html.includes('html.js .armures-poids { display: none; }') && html.includes('html.js body.ed-mode .armures-poids { display: block; }'));
  // la case Coût d'une fiche ne déborde pas : un montant passe à la ligne entre deux monnaies (demande du propriétaire, 2026-10-16)
  assert.ok(html.includes('.pfiche__tuile-val .montant { display: inline-flex; flex-wrap: wrap;'));
  assert.ok(!html.includes('.pfiche__tuile-val { font-size: 1.3rem; font-weight: 700; line-height: 1.15; font-variant-numeric: tabular-nums; white-space: nowrap; }'));
});

test('plus de tableau MATÉRIAUX sous les deux onglets : chacun renvoie au tableau des matériaux de la page « Composants » (demande du propriétaire, 2026-10-16)', options, () => {
  assert.ok(!main.includes('id="materiaux-armures"') && !main.includes('pmat-ref') && !main.includes('armures-table--materiaux'), 'le tableau MATÉRIAUX a disparu');
  for (const id of ['armures', 'boucliers']) {
    assert.match(panneau(id), /<p class="armures-renvoi">La description et la fabrication de chaque (?:matériau|matière) sont sur la page <a href="[^"]*\/ressources\/composants\/#materiaux">Composants<\/a>, où les matériaux se modifient \(décision R62\)\.<\/p>/, id);
  }
  // le renvoi reste en mode modification (la classe `armures-aide` y est cachée)
  assert.ok(html.includes('.armures-renvoi {') && !/body\.ed-mode[^{]*armures-renvoi/.test(html), 'le renvoi n’est pas caché en mode modification');
  const composants = readFileSync(join(dist, 'ressources', 'composants', 'index.html'), 'utf8');
  assert.ok(composants.includes('<details class="comp-tableau" id="materiaux"'), 'l’ancre du tableau des matériaux de « Composants »');
});

test('le script de la page n’importe que lib/armure-forge.mjs et lib/armures-tri.mjs, qu’aucun autre script de page n’importe', options, () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/armures.mjs', import.meta.url)), ['../lib/armure-forge.mjs', '../lib/armures-tri.mjs']);
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'armures.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /\/(armure-forge|armures-tri)\.mjs$/.test(m)), [], nom);
  }
  assert.deepEqual(imports(new URL('../src/lib/armures-tri.mjs', import.meta.url)), [], 'le tri est un module pur');
});
