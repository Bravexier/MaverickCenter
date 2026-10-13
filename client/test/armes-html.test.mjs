// Page /ressources/armes/ construite (dist/) : rendue depuis les tables (pas de tableau Markdown), un tableau repliable par famille sans les armes de
// monstres, les colonnes voulues par le propriétaire, les lignes de départ en bleu avec leur infobulle, la description en infobulle du nom, les compétences
// en couleur (décision R48) et leur filtre, les règles avec la mise en forme du classeur, les matériaux dans leur couleur, les améliorations, les champs
// du mode modification. Se saute sans dist/ (npm run build) ;
// la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMPETENCES_D_ARME } from '../src/lib/arme-champs.mjs';
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

test('filtre par compétence (demande du propriétaire) : Lourde, Légère, Arc, Arbalète, à bascule, dans la couleur de leur caractéristique (décision R48)', options, () => {
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
  assert.match(main, /<p class="armes-legende"><span class="armes-legende__depart" title="Arme de départ">Arme de départ<\/span><\/p>/);
});

test('règles de l’onglet avec la mise en forme du classeur : définitions en italique, phrase des armes de départ en bleu, cas particuliers en gras ; le prix à part', options, () => {
  const debut = main.indexOf('<div class="prose armes-regles__texte">');
  assert.ok(debut > 0);
  const regles = main.slice(debut, main.indexOf('</details>', debut));
  for (const terme of ['Recharge longue', 'Recharge très longue', 'Mordhau ou Demi-épée']) assert.ok(regles.includes(`<p><em>${terme}</em> = `), terme);
  assert.match(regles, /<em>Exemple : Si vous faites plus de 70/);
  assert.match(regles, /<p class="armes-regles__depart"><strong>Les armes en bleu sont les armes possibles en arme de départ\.<\/strong><\/p>/);
  assert.match(regles, /<p><em><strong>CAS PARTICULIERS :<\/strong><\/em><\/p>|<p><strong><em>CAS PARTICULIERS :<\/em><\/strong><\/p>/);
  assert.match(regles, /<p><strong>Dague<\/strong><\/p>\s*<ul>/);
  assert.match(regles, /<p><strong>Arme de jet<\/strong><\/p>\s*<ul>/);
  assert.match(regles, /<section class="armes-regles__prix" aria-labelledby="armes-prix-titre"><h2 id="armes-prix-titre">Comment déterminer le prix de votre arme \?<\/h2><p>1 Matériau \+ /);
  assert.ok(!/[*_]{1,3}(Recharge|Dague|CAS)/.test(regles), 'aucune marque Markdown laissée telle quelle');
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

test('le script de la page n’importe que lib/arme-forge.mjs et lib/armes-filtres.mjs, qu’aucun autre script de page n’importe', options, () => {
  const imports = (chemin) => [...readFileSync(chemin, 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports(new URL('../src/scripts/armes.mjs', import.meta.url)), ['../lib/arme-forge.mjs', '../lib/armes-filtres.mjs']);
  const scripts = new URL('../src/scripts/', import.meta.url);
  for (const nom of readdirSync(scripts, { recursive: true }).filter((n) => n.endsWith('.mjs') && n !== 'armes.mjs')) {
    const autres = imports(new URL(nom, scripts)).filter((m) => /\/(arme-forge|armes-filtres)\.mjs$/.test(m));
    assert.deepEqual(autres, [], nom);
  }
});
