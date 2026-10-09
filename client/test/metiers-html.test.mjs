// Page des métiers CONSTRUITE (client/dist/wiki/metiers/index.html) : un long tableau (Nom, Bonus, Artisanat, Équipement supplémentaire), une ligne par métier,
// la description sous la ligne ; plus de page par métier, et tout lien du site vers un métier mène à sa ligne (lib/metiers.mjs).
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/metiers-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const dossier = join(dist, 'wiki', 'metiers');
const present = existsSync(join(dossier, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(join(dossier, 'index.html'), 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const lignes = [...main.matchAll(/<tbody class="metier" id="(metier-[^"]+)"/g)].map((m) => m[1]);

const pagesHtml = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pagesHtml(join(d, e.name)) : e.name.endsWith('.html') ? [join(d, e.name)] : []));

test('un tableau de 72 métiers, aux quatre colonnes demandées, une ancre unique par ligne', options, () => {
  assert.equal(lignes.length, 72);
  assert.equal(new Set(ids).size, ids.length, 'identifiant en double');
  const entetes = [...main.slice(main.indexOf('<thead'), main.indexOf('</thead>')).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(entetes, ['Nom', 'Bonus', 'Artisanat', 'Équipement supplémentaire']);
});

test('chaque ligne ouvre sa description juste en dessous ; les aria-* mènent à un élément de la page', options, () => {
  assert.equal((main.match(/class="metier__choisir" aria-expanded="false" aria-controls="detail-metier-/g) ?? []).length, 72);
  assert.equal((main.match(/<tr class="metier__detail" id="detail-metier-[^"]+" hidden>/g) ?? []).length, 72);
  for (const [, cible] of main.matchAll(/aria-(?:controls|labelledby)="([^"]+)"/g)) assert.ok(ids.includes(cible), `${cible} introuvable`);
  // la description du Forgeron est dans son panneau, sous sa ligne
  const forgeron = main.slice(main.indexOf('id="metier-forgeron"'), main.indexOf('</tbody>', main.indexOf('id="metier-forgeron"')));
  assert.match(forgeron, /Le forgeron transforme métal brut en armes/);
  assert.match(forgeron, /FORCE \+ VOLONTÉ/);
});

test('plus de page par métier : seule la page des règles reste à côté du tableau', options, () => {
  const sousDossiers = readdirSync(dossier, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.deepEqual(sousDossiers, ['regles-des-metiers']);
  assert.match(main, /href="\/wiki\/metiers\/regles-des-metiers\/"/);
});

test('tout lien du site vers un métier mène à une ligne du tableau', options, () => {
  let liens = 0;
  for (const fichier of pagesHtml(dist)) {
    const page = readFileSync(fichier, 'utf8');
    for (const [, cible] of page.matchAll(/href="[^"]*\/wiki\/metiers\/([^"]*)"/g)) {
      if (cible === '' || cible === 'regles-des-metiers/') continue;
      assert.match(cible, /^#metier-/, `${relative(dist, fichier)} : lien vers une page de métier (${cible})`);
      assert.ok(lignes.includes(cible.slice(1)), `${relative(dist, fichier)} : ${cible} sans ligne`);
      liens += 1;
    }
  }
  assert.ok(liens >= 72, `${liens} liens vers des métiers (au moins un par métier : le mot-clé « métier »)`);
});
