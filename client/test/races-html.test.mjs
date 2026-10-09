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

test('sections de l’onglet : présentation, histoire, avantages, dons, Mode Hyper, magies ; valeurs de départ en tuiles ; pas de liste des classes accessibles', options, () => {
  for (const { slug, html } of pages) {
    for (const id of ['presentation', 'histoire', 'avantages', 'dons', 'mode-hyper', 'magies-innees', 'relations']) {
      assert.ok(ids(html).includes(id), `${slug} : #${id}`);
    }
    // demande du propriétaire : aucune liste de classes ; seule la classe raciale d'une race hybride, dans le bandeau
    assert.ok(!ids(html).includes('classes'), `${slug} : section des classes`);
    assert.ok(!main(html).includes('Classes accessibles') && !main(html).includes('Classes non accessibles'), `${slug} : liste des classes`);
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
  // décision R14 : le Drassah'thac est hybride sans avoir de classe raciale ; la Lamia est pure
  assert.match(page('drassahthac'), /race-hero__surtitre">Race hybride</);
  assert.ok(!page('drassahthac').includes('class="race-hero__classe"'), 'drassahthac : pas de classe raciale');
  assert.match(page('drassahthac'), /href="[^"]*\/wiki\/races\/#hybrides">Races hybrides</);
  assert.match(page('lamia'), /race-hero__surtitre">Race pure</);
});

// La liste /wiki/races/ : deux colonnes côte à côte, races pures puis hybrides, dans l'ordre du propriétaire ; les magies innées des seules races hybrides.
const liste = present && existsSync(join(dossier, 'index.html')) ? main(readFileSync(join(dossier, 'index.html'), 'utf8')) : '';
const colonne = (id) => {
  const debut = liste.indexOf(`id="${id}"`);
  return debut < 0 ? '' : liste.slice(debut, liste.indexOf('</section>', debut));
};
// sans la race d'exemple, présente quand le site est construit sans HIDE_EXAMPLES=1 (c'est le cas de la CI)
const nomsDe = (html) =>
  [...html.matchAll(/class="race-list__nom" href="[^"]*\/wiki\/races\/([^/"]+)\/">([^<]+)</g)]
    .filter((m) => m[1] !== 'exemple-race')
    .map((m) => m[2].replace(/&#39;/g, "'"));

test('liste des races : deux colonnes, pures puis hybrides, dans l’ordre du propriétaire', options, () => {
  assert.match(liste, /class="race-columns"/);
  assert.ok(liste.indexOf('id="pures"') < liste.indexOf('id="hybrides"'));
  assert.deepEqual(nomsDe(colonne('pures')), [
    'Humain', 'Nain', 'Elfe forestier', 'Elfe doré', 'Elfe argenté', 'Elfe noir', 'Farfadet', 'Felfe', 'Majin', 'Hujin', 'Drakos', 'Lamia', 'Mort-vivant',
  ]);
  assert.deepEqual(nomsDe(colonne('hybrides')), [
    "Drassah'thac", 'Orios', 'Fenrir', 'Kitsune', 'Olwman', 'Rokh', 'Namazu', 'Minotaure', 'Satyre', 'Médusain', 'Jackalope', 'Marcass', 'Anansi', 'Goleois',
  ]);
});

test('liste des races : magies innées des races hybrides seulement, jamais les magies qu’une race ne peut pas avoir', options, () => {
  assert.ok(!colonne('pures').includes('Magies innées'), 'races pures : pas de magies innées');
  assert.ok(!colonne('pures').includes('class="chip'), 'races pures : aucune pastille');
  assert.equal((colonne('hybrides').match(/Magies innées :/g) ?? []).length, 14);
  assert.ok(!/sur \d+|toutes \(|non disponible|ne peut pas/i.test(liste), 'ni total, ni magies inaccessibles');
});
