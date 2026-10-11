// Page /bestiaire/ construite (dist/) : deux onglets (monstres, créatures invoquées à part), un tableau filtrable chacun, une fiche sous chaque ligne,
// l'entrée du menu Codex. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerBestiaire } from '../src/lib/bestiaire-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'bestiaire', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const panneau = (id) => {
  const debut = main.indexOf(`<section class="bpanneau${id === 'monstres' ? ' is-active' : ''}" id="${id}"`);
  const fin = id === 'monstres' ? main.indexOf('<section class="bpanneau" id="invoquees"') : main.length;
  return main.slice(debut, fin);
};

test('deux onglets : les monstres (ouverts au départ) et, à part, les créatures invoquées', options, () => {
  assert.match(main, /<a class="onglet is-active" id="onglet-monstres" href="#monstres">/);
  assert.match(main, /<a class="onglet" id="onglet-invoquees" href="#invoquees">/);
  assert.match(main, /data-onglets="Catégories du bestiaire"/);
  assert.ok(panneau('monstres').length > 0 && panneau('invoquees').length > 0);
});

test('une ligne par monstre ou créature, chacune avec sa fiche ; les identifiants sont uniques et les aria-controls mènent quelque part', options, () => {
  const { monstres, invocations } = chargerBestiaire(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' }));
  const lignes = (bloc) => [...bloc.matchAll(/<tbody class="bligne" id="([^"]+)" data-ligne/g)].map((m) => m[1]);
  assert.deepEqual(lignes(panneau('monstres')), monstres.lignes.map((l) => l.ancre));
  assert.deepEqual(lignes(panneau('invoquees')), invocations.lignes.map((l) => l.ancre));
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  const connus = new Set(ids);
  for (const [, cible] of main.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)) assert.ok(connus.has(cible), cible);
  for (const ancre of lignes(main)) assert.ok(connus.has(`fiche-${ancre}`), `fiche de ${ancre}`);
  // liens internes vers une autre créature (même combinaison) : vers une ligne qui existe
  for (const [, cible] of main.matchAll(/href="#(invoquee-[^"]+)"/g)) assert.ok(connus.has(cible), cible);
});

test('filtres : formulaire caché sans JavaScript, une case par valeur, le préfixe « i- » pour les créatures invoquées', options, () => {
  for (const [id, facettes, prefixe] of [['monstres', ['categorie', 'ep', 'type', 'alignement', 'lieu', 'vulnerabilite', 'resistance', 'immunite', 'capacite'], ''], ['invoquees', ['invocation', 'magie', 'degat', 'defense', 'capacite'], 'i-']]) {
    const bloc = panneau(id);
    assert.match(bloc, /<form class="bfiltres" role="search"[^>]*data-filtres hidden>/);
    assert.ok(bloc.includes(`data-prefixe="${prefixe}"`), id);
    assert.ok(bloc.includes(`data-facettes="${JSON.stringify(facettes).replace(/"/g, '&quot;')}"`), `${id} : filtres`);
    for (const f of facettes) assert.ok(bloc.includes(`<details class="bfacette" data-facette="${f}">`), `${id} : ${f}`);
    assert.ok((bloc.match(/<input type="checkbox" name="categorie" value="boss">/g) ?? []).length <= 1);
  }
  assert.match(panneau('monstres'), /<input type="checkbox" name="categorie" value="boss">/);
  assert.match(panneau('invoquees'), /<input type="checkbox" name="magie" value="feu">/);
});

test('sans JavaScript, toutes les fiches s’affichent ; le script de la page est un seul fichier sans import', options, () => {
  assert.match(html, /<noscript>\s*<style>[^<]*\.bestiaire \.bligne__fiche\[hidden\] \{ display: table-row !important; \}/);
  const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1);
  for (const src of scripts) {
    const code = readFileSync(join(dist, src.replace(/^\//, '')), 'utf8');
    assert.ok(!/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code), `${src} importe un autre module (version portable)`);
  }
});

test('le menu Codex mène au bestiaire', options, () => {
  assert.match(html, /<a[^>]*href="\/bestiaire\/"[^>]*aria-current="page"[^>]*>Bestiaire<\/a>|<a[^>]*aria-current="page"[^>]*href="\/bestiaire\/"[^>]*>Bestiaire<\/a>/);
});
