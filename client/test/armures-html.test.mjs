// Onglets Armures et Boucliers de la page /ressources/equipement/ construite (dist/ ; avant, la page /ressources/armures/ : test/equipement-html.test.mjs
// pour la page et ses onglets) : rendus depuis les tables (pas de tableau Markdown), deux onglets (Armures, Boucliers : « Les deux seront
// dans la page »), deux tableaux de matériaux à choisir pour l'armure (« deux tables des matériaux à sélectionner pour avoir l'armure ainsi créée »), la
// liste des armures (« Une liste plus classique est disponible également ») et les armures particulières, les pièces (tableau FABRICATION) et les
// améliorations ; la forme et la matière d'un bouclier (« forme + matière »), la liste des boucliers ; le tableau MATÉRIAUX ; les champs du mode
// modification. Les pages « Armures » et « Bouclier » ne sont plus construites : leurs liens mènent à leur onglet. Se saute sans dist/ (npm run build) ;
// la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ancreDArmure, ancreDeBouclier, chargerArmures } from '../src/lib/armures-db.mjs';
import { couleurDuType } from '../src/lib/armures-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'equipement', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
// le bloc des armures et des boucliers : ses deux panneaux et le tableau MATÉRIAUX, jusqu'au panneau des bâtons magiques
const main = html.slice(html.indexOf('<div class="armures" data-armures>'), html.indexOf('<section class="equipement-panneau batons" id="batons-magiques"'));
const armures = present ? chargerArmures(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
/** Le HTML d'un panneau (onglet) : de son <section> au suivant. */
const panneau = (id) => {
  const debut = main.indexOf(`<section class="armures-panneau equipement-panneau" id="${id}"`);
  const fin = main.indexOf('<section class="armures-panneau', debut + 10);
  return main.slice(debut, fin < 0 ? main.indexOf('id="materiaux-armures"') : fin);
};

test('pas de tableau Markdown : le gabarit des armures, deux panneaux (Armures, Boucliers), les règles de chaque onglet repliées', options, () => {
  assert.match(main, /^<div class="armures" data-armures>/);
  assert.ok(!main.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  for (const id of ['armures', 'boucliers']) assert.ok(panneau(id).length > 1000, `le panneau ${id}`);
  assert.equal((main.match(/<details class="armures-regles">/g) ?? []).length, 2);
  assert.ok(panneau('armures').includes('il faut 2 matériaux pour chaque morceau'), 'les règles des armures');
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
  }
  // chaque paire de matières (dans un ordre ou dans l'autre) donne une seule armure de la grille : le choix trouve toujours son armure
  const paires = new Set(armures.combinaisons.map((a) => [a.m1, a.m2].sort().join('|')));
  assert.equal(paires.size, armures.combinaisons.length);
  const n = armures.materiaux.length;
  assert.equal(armures.combinaisons.length, (n * (n + 1)) / 2);
});

test('armures : la liste par type puis les armures particulières, une ligne par armure, ses champs modifiables', options, () => {
  const p = panneau('armures');
  const lignes = [...p.matchAll(/<tr class="armure(?: armure--particuliere)?" id="([^"]+)" data-armure=/g)].map((m) => m[1]);
  assert.equal(lignes.length, armures.combinaisons.length + armures.particulieres.length);
  assert.deepEqual(new Set(lignes), new Set([...armures.combinaisons, ...armures.particulieres].map((a) => ancreDArmure(a.id))));
  const a = armures.combinaisons[0];
  for (const colonne of ['nom', 'type', 'stats_brut', 'solidite', 'resistance_brut', 'faiblesse_brut', 'prix_brut']) {
    assert.ok(p.includes(`data-ed="${echapper(attributEd('armure', { id: a.id }, colonne))}"`), colonne);
  }
  assert.ok(p.includes(`data-m1="${a.m1}" data-m2="${a.m2}"`));
  const particuliere = armures.particulieres[0];
  assert.ok(p.includes(`data-ed="${echapper(attributEd('armure', { id: particuliere.id }, 'effet'))}"`));
  assert.ok(p.includes('id="armures-particulieres"'));
});

test('armures : à côté, la fiche (remplie par le script), les pièces (l’armure complète d’abord) et les améliorations +1 à +5, sans ligne Total', options, () => {
  const p = panneau('armures');
  assert.match(p, /<section class="pfiche" data-fiche="armure" aria-label="Fiche de l’armure" aria-live="polite">/);
  const pieces = [...p.matchAll(/<tr class="ppiece" data-piece="([^"]+)"( data-complete="1")?>/g)].map((m) => [m[1], Boolean(m[2])]);
  assert.deepEqual(pieces, armures.pieces.map((x) => [x.id, x.id === 'armure-complete']));
  assert.ok(!pieces.some(([id]) => id === 'bouclier'), 'la ligne du bouclier n’est pas une pièce d’armure');
  const niveaux = [...p.matchAll(/<tr class="pamelioration" data-cible="armure" data-niveau="(\d+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(niveaux, armures.ameliorations.armure.map((x) => x.niveau));
  // « La ligne "total" des améliorations est inutile » (demande du propriétaire, 2026-10-16) : ni pour les armures, ni pour les boucliers
  assert.ok(!html.includes('data-armures-total') && !panneau('boucliers').includes('<tfoot>') && !p.includes('<tfoot>'));
});

test('boucliers : les formes et les matières à choisir, la liste par forme (une ligne par bouclier préfabriqué), les améliorations et les poids', options, () => {
  const p = panneau('boucliers');
  const formes = [...p.matchAll(/<tr class="forme" data-forme="([^"]+)" data-classe="(\d)">/g)].map((m) => m[1]);
  assert.deepEqual(formes, armures.formes.map((f) => f.id));
  const table = p.slice(p.indexOf('data-choix="matiere"'), p.indexOf('</table>', p.indexOf('data-choix="matiere"')));
  assert.deepEqual([...table.matchAll(/<tr class="pmat" data-materiau="([^"]+)"/g)].map((m) => m[1]), armures.matieres.map((m) => m.cle));
  const boucliers = [...p.matchAll(/<tr class="bouclier" id="([^"]+)" data-bouclier="[^"]+" data-forme="([^"]+)" data-matiere="([^"]+)">/g)];
  assert.equal(boucliers.length, armures.boucliers.length);
  assert.deepEqual(new Set(boucliers.map((m) => m[1])), new Set(armures.boucliers.map((b) => ancreDeBouclier(b.id))));
  // chaque forme × matière donne un seul bouclier : le choix trouve toujours son bouclier
  assert.equal(new Set(boucliers.map((m) => `${m[2]}|${m[3]}`)).size, armures.formes.length * armures.matieres.length);
  const niveaux = [...p.matchAll(/<tr class="pamelioration" data-cible="bouclier" data-niveau="(\d+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(niveaux, armures.ameliorations.bouclier.map((x) => x.niveau));
  for (const poids of armures.poids) assert.ok(p.includes(`data-ed="${echapper(attributEd('bouclier_poids', { id: poids.id }, 'force_brut'))}"`), poids.id);
  assert.match(p, /<section class="pfiche" data-fiche="bouclier" aria-label="Fiche du bouclier" aria-live="polite">/);
});

test('le tableau MATÉRIAUX (prix, description, fabrication), en lecture : la page « Composants » en est la seule source (décision R62)', options, () => {
  const t = main.slice(main.indexOf('id="materiaux-armures"'));
  assert.deepEqual([...t.matchAll(/<tr class="pmat-ref" id="matiere-([^"]+)">/g)].map((m) => m[1]), armures.materiaux.map((m) => m.cle));
  assert.ok(t.includes('Fourneau de Séraphin'), 'la fabrication d’une matière');
  assert.ok(!/<tr class="pmat-ref"[^]*?data-ed="/.test(t.slice(0, t.indexOf('</table>'))), 'aucun champ modifiable');
});

test('le script de la page n’importe que lib/armure-forge.mjs, qu’aucun autre script de page n’importe', options, () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import\s[^;]*?from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/armures.mjs', import.meta.url)), ['../lib/armure-forge.mjs']);
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'armures.mjs')) {
    assert.deepEqual(imports(new URL(nom, scripts)).filter((m) => /\/armure-forge\.mjs$/.test(m)), [], nom);
  }
});
