// Pages de race CONSTRUITES (client/dist/wiki/races/*/index.html), rendues par le gabarit (components/race/RacePage.astro) depuis les tables de la base :
// aucun tableau Markdown, plus d'écarts avec la fiche V15.2.2 ni de source citée (décision R13), relations par niveau sans regrouper les peuples qui diffèrent.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/races-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dossier = fileURLToPath(new URL('../dist/wiki/races/', import.meta.url));
const present = existsSync(dossier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
// pages rendues par le gabarit (la race d'exemple, sans ligne dans la base, garde le rendu Markdown)
const pages = present
  ? readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ slug: d.name, html: readFileSync(join(dossier, d.name, 'index.html'), 'utf8') }))
      .filter((p) => p.html.includes('class="race-hero"'))
  : [];
const page = (slug) => pages.find((p) => p.slug === slug)?.html ?? '';
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const main = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));

test('27 pages de race rendues par le gabarit', options, () => {
  assert.equal(pages.length, 27);
});

test('chaque identifiant est unique ; les liens de la navigation mènent à une section de la page', options, () => {
  for (const { slug, html } of pages) {
    const tous = ids(html);
    assert.equal(new Set(tous).size, tous.length, `${slug} : identifiant en double`);
    const nav = html.slice(html.indexOf('class="race-nav'), html.indexOf('</nav>', html.indexOf('class="race-nav')));
    for (const [, cible] of nav.matchAll(/href="#([^"]+)"/g)) assert.ok(tous.includes(cible), `${slug} : #${cible} sans section`);
  }
});

test('retirés : tableaux Markdown, écarts avec la fiche V15.2.2, sous-races de la fiche, sources ; seuls les tableaux du gabarit restent', options, () => {
  for (const { slug, html } of pages) {
    const m = main(html);
    assert.ok(!m.includes('Écarts avec la fiche'), `${slug} : écarts`);
    assert.ok(!m.includes('Sous-races et origines'), `${slug} : sous-races de la fiche`);
    assert.ok(!m.includes('(fiche)'), `${slug} : valeur de la fiche`);
    assert.ok(!/<h2[^>]*>Sources<\/h2>/.test(m), `${slug} : sources`);
    assert.ok(!m.includes('docs.google.com'), `${slug} : lien vers les classeurs`);
    assert.ok(!m.includes('class="prose"'), `${slug} : rendu Markdown`);
    for (const [table] of m.matchAll(/<table\b[^>]*>/g)) assert.match(table, /class="race-table/, `${slug} : tableau hors gabarit`);
    assert.ok(!/\|\s*---/.test(m), `${slug} : tableau Markdown brut`);
  }
});

test('sections de l’onglet : présentation, histoire, avantages, dons, Mode Hyper, magies, classes ; valeurs de départ en tuiles', options, () => {
  for (const { slug, html } of pages) {
    for (const id of ['presentation', 'histoire', 'avantages', 'dons', 'mode-hyper', 'magies-innees', 'classes', 'relations']) {
      assert.ok(ids(html).includes(id), `${slug} : #${id}`);
    }
    assert.equal((html.match(/class="race-stat[ "]/g) ?? []).length, 5, `${slug} : 5 valeurs de départ`);
  }
  assert.match(page('drakos'), /<dt>Santé de départ<\/dt>\s*<dd>13<\/dd>/);
});

test('relations : Elfe noir en deux blocs (Charbon, Salé), la matrice entre ses peuples ; une race sans peuple le dit', options, () => {
  const html = page('elfe-noir');
  const voit = html.slice(html.indexOf('Comment ses peuples voient les autres'), html.indexOf('Comment les autres voient ses peuples'));
  assert.equal((voit.match(/class="regards__bloc"/g) ?? []).length, 2);
  assert.match(voit, /<h4>Elfe Noir Charbon<\/h4>/);
  assert.match(voit, /<h4>Elfe Noir Salé<\/h4>/);
  assert.match(html, /class="race-table regards__matrice"/);
  assert.match(page('farfadet'), /n’a pas de peuple dans l’onglet « Relation entre les races »/);
  for (const { slug, html: h } of pages) {
    const niveaux = [...h.matchAll(/class="regard__niveau">([^<]+)</g)].map((m) => m[1]);
    for (const nv of niveaux) assert.ok(['Alliée', 'Appréciée', 'Acceptée', 'Neutre', 'Évitée', 'Haine', 'Ennemie'].includes(nv), `${slug} : ${nv}`);
  }
});

test('race hybride : bandeau « Race hybride » et lien vers sa classe raciale', options, () => {
  assert.match(page('orios'), /race-hero__surtitre">Race hybride</);
  assert.match(page('orios'), /Classe raciale<\/strong>\s*<a href="[^"]*\/wiki\/classes\/orios\/"/);
  assert.match(page('humain'), /race-hero__surtitre">Race pure</);
});
