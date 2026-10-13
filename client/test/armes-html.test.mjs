// Page /ressources/armes/ construite (dist/) : rendue depuis les tables (pas de tableau Markdown), un tableau repliable par famille sans les armes de
// monstres, les colonnes voulues par le propriétaire, les lignes de départ en bleu avec leur infobulle, la description en infobulle du nom, les compétences
// en couleur (décision R48), les matériaux dans leur couleur, les améliorations, les champs du mode modification. Se saute sans dist/ (npm run build) ;
// la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ancreDArme, ancreDeMateriau, chargerArmes } from '../src/lib/armes-db.mjs';
import { couleurDeMateriau } from '../src/lib/materiaux-couleurs.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { attributEd } from '../src/lib/edition-modele.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'armes', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const armes = present ? chargerArmes(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

test('pas de tableau Markdown : la page est le gabarit des armes, avec les règles de l’onglet repliées', options, () => {
  assert.match(main, /<div class="armes" data-armes>/);
  assert.match(main, /<details class="armes-regles">/);
  assert.ok(!main.includes('<table>'), 'aucun tableau rendu depuis le Markdown');
  assert.ok(main.includes('Mordhau'), 'les règles de l’onglet');
});

test('un tableau repliable par famille, sans les armes de monstres ; une ligne par arme, dans l’ordre de l’onglet', options, () => {
  const familles = [...main.matchAll(/<details class="armes-famille" id="famille-([^"]+)" open/g)].map((m) => m[1]);
  assert.deepEqual(familles, armes.familles.map((f) => f.id));
  assert.ok(!familles.includes('arme-de-monstres'));
  const lignes = [...main.matchAll(/<tr class="arme(?: arme--depart)?" id="([^"]+)" data-arme=/g)].map((m) => m[1]);
  assert.deepEqual(lignes, armes.familles.flatMap((f) => f.armes.map((a) => ancreDArme(a.id))));
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('colonnes : Nom, Compétence, Type, Dégâts, Type de dégâts, Portée, Durabilité, Effets supplémentaires, Origine ; Description, Coût, Effet et départ en mode modification', options, () => {
  const tete = main.slice(main.indexOf('<thead>'), main.indexOf('</thead>'));
  const colonnes = [...tete.matchAll(/<th scope="col"(?: class="ed-seul")?>([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(colonnes.slice(0, 9), ['Nom', 'Compétence', 'Type', 'Dégâts', 'Type de dégâts', 'Portée', 'Durabilité', 'Effets supplémentaires', 'Origine']);
  assert.equal((tete.match(/class="ed-seul"/g) ?? []).length, 4);
});

test('armes de départ en bleu avec l’infobulle « Arme de départ » ; description en infobulle du nom ; compétences en couleur', options, () => {
  for (const a of armes.familles.flatMap((f) => f.armes)) {
    const debut = main.indexOf(`id="${ancreDArme(a.id)}"`);
    const ligne = main.slice(main.lastIndexOf('<tr', debut), main.indexOf('</tr>', debut));
    assert.equal(ligne.includes('arme--depart') && ligne.includes('title="Arme de départ"'), a.depart_possible === 1, a.id);
    if (a.description) assert.ok(ligne.includes(`title="${echapper(a.description)}"`), `${a.id} : description en infobulle`);
    assert.ok(ligne.includes(`data-ed="${echapper(attributEd('arme', { id: a.id }, 'effet'))}"`), `${a.id} : effet modifiable`);
    assert.match(ligne, /<span class="arme-comp[^"]*" data-competences="(arme-lourde|arme-legere|arc|arbalete)( arme-legere)?"/, a.id);
  }
});

test('légende des compétences (décision R48) : Lourde, Légère, Lourde / Légère, Arc, Arc / Légère, Arbalète, dans la couleur de leur caractéristique', options, () => {
  const legende = main.slice(main.indexOf('<p class="armes-legende"'), main.indexOf('</p>', main.indexOf('<p class="armes-legende"')));
  const pastilles = [...legende.matchAll(/<span class="arme-comp( arme-comp--deux)?" data-competences="([^"]+)" style="--c1: ([^;]+); --c2: ([^;]+);[^"]*" title="([^"]+)">([^<]+)<\/span>/g)];
  assert.deepEqual(pastilles.map((m) => m[6]), ['Lourde', 'Légère', 'Lourde / Légère', 'Arc', 'Arc / Légère', 'Arbalète']);
  const couleur = Object.fromEntries(pastilles.map((m) => [m[6], [m[3], m[4]]]));
  assert.deepEqual(couleur.Arc, couleur.Lourde, 'l’Arc a la couleur de la Force, comme l’Arme Lourde');
  assert.deepEqual(couleur['Arc / Légère'], [couleur.Arc[0], couleur['Légère'][0]], 'dégradé Arc - Arme Légère');
  assert.notDeepEqual(couleur['Arbalète'], couleur.Lourde);
  assert.ok(!main.includes('Précision'), 'plus de « Précision »');
});

test('matériaux dans leur couleur, prix en RO ; améliorations +1 à +10 avec le total ; le fer est le matériau par défaut', options, () => {
  for (const m of armes.materiaux) {
    const c = couleurDeMateriau(m.ligne.ressource_id);
    assert.ok(main.includes(`id="${ancreDeMateriau(m.ligne.ressource_id)}" data-materiau="${m.ligne.ressource_id}"${m.nom === 'Fer' ? ' data-defaut="1"' : ''}`), m.nom);
    assert.ok(main.includes(`style="--mat: ${c.fond}; --mat-texte: ${c.texte}"`), `${m.nom} : sa couleur`);
  }
  assert.deepEqual(armes.materiaux.filter((m) => m.defaut).map((m) => m.nom), ['Fer']);
  assert.equal([...main.matchAll(/<tr class="amelioration" id="amelioration-(\d+)"/g)].length, armes.ameliorations.length);
  assert.match(main, /<td colspan="2" data-armes-total>\d+ matériaux? \+ \d+ RO<\/td>/);
});

test('le script de la page n’importe que lib/arme-forge.mjs (aucun module partagé avec un autre script de page)', options, () => {
  const source = readFileSync(new URL('../src/scripts/armes.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['../lib/arme-forge.mjs']);
});
