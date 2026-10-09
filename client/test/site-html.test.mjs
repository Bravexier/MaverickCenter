// Site CONSTRUIT (client/dist/) : adresses sans le préfixe /wiki/ (demande du propriétaire), logo officiel dans l'en-tête et en icône.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/site-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };

const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const lire = (rel) => readFileSync(join(dist, rel), 'utf8');

test('les pages sont à la racine du site, plus sous /wiki/', options, () => {
  assert.ok(!existsSync(join(dist, 'wiki')), 'dossier dist/wiki/');
  for (const rel of ['races/index.html', 'races/nain/index.html', 'magies/magie-du-feu/index.html', 'classes/index.html', 'pages/index.html']) {
    assert.ok(existsSync(join(dist, rel)), rel);
  }
  const avecWiki = walk(dist)
    .filter((f) => f.endsWith('.html') || f.endsWith('.json'))
    .filter((f) => /(?:href|action|src)="\/wiki\/|"path":"wiki\//.test(readFileSync(f, 'utf8')));
  assert.deepEqual(avecWiki, [], 'aucun lien vers /wiki/');
  assert.match(lire('races/nain/index.html'), /<a href="\/">Accueil<\/a> › <a href="\/races\/">Races<\/a>/, 'fil d’Ariane');
});

test('la page 404 renvoie les anciennes adresses /wiki/… vers les nouvelles', options, () => {
  const html = lire('404.html');
  assert.match(html, /<p id="introuvable" data-base="\/">/);
  assert.match(html, /location\.replace/);
});

test('en-tête : le logo à la place du titre, le menu à côté ; le logo en icône', options, () => {
  const html = lire('index.html');
  const entete = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(entete, /<a class="brand" href="\/"><img src="\/logo\.webp" alt="Maverick Center" width="\d+" height="\d+"\s*\/?><\/a>/);
  assert.ok(entete.indexOf('class="site-nav"') > entete.indexOf('class="site-header__menu"'), 'menu dans la même bande que le logo');
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon\.png"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  for (const fichier of ['logo.webp', 'favicon.png', 'apple-touch-icon.png']) assert.ok(existsSync(join(dist, fichier)), fichier);
  assert.ok(!existsSync(join(dist, 'favicon.svg')), 'ancienne icône retirée');
});
