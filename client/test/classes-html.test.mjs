// Pages de classe CONSTRUITES (client/dist/wiki/classes/*/index.html), rendues par le gabarit (components/classes/ClassePage.astro) depuis les tables
// de la base : aucun tableau Markdown, pas de source citée, les DONS disposés comme l'onglet avec leurs choix encadrés (« Au choix », « ou »),
// les spécialités en onglets.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/classes-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dossier = fileURLToPath(new URL('../dist/wiki/classes/', import.meta.url));
const present = existsSync(dossier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
// pages rendues par le gabarit (la classe d'exemple, sans ligne dans la base, garde le rendu Markdown)
const pages = present
  ? readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ slug: d.name, html: readFileSync(join(dossier, d.name, 'index.html'), 'utf8') }))
      .filter((p) => p.html.includes('class="classe-hero"'))
  : [];
const page = (slug) => pages.find((p) => p.slug === slug)?.html ?? '';
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const main = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const compte = (html, motif) => (html.match(motif) ?? []).length;

test('39 pages de classe rendues par le gabarit', options, () => {
  assert.equal(pages.length, 39);
});

test('chaque identifiant est unique ; les liens de la navigation et les aria-labelledby mènent à un élément de la page', options, () => {
  for (const { slug, html } of pages) {
    const tous = ids(html);
    assert.equal(new Set(tous).size, tous.length, `${slug} : identifiant en double`);
    const nav = html.slice(html.indexOf('class="classe-nav'), html.indexOf('</nav>', html.indexOf('class="classe-nav')));
    for (const [, cible] of nav.matchAll(/href="#([^"]+)"/g)) assert.ok(tous.includes(cible), `${slug} : #${cible} sans section`);
    for (const [, cible] of main(html).matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) assert.ok(tous.includes(cible), `${slug} : ${cible} introuvable`);
  }
});

test('retirés : tableaux Markdown, rendu Markdown, sources ; aucun tableau du tout', options, () => {
  for (const { slug, html } of pages) {
    const m = main(html);
    assert.ok(!m.includes('class="prose"'), `${slug} : rendu Markdown`);
    assert.ok(!/<table\b/.test(m), `${slug} : tableau`);
    assert.ok(!/\|\s*---/.test(m), `${slug} : tableau Markdown brut`);
    assert.ok(!/<h2[^>]*>Sources<\/h2>/.test(m), `${slug} : sources`);
    assert.ok(!m.includes('Capacités de la classe'), `${slug} : ancienne liste des capacités`);
  }
});

test('dons : un par don de la classe, chacun avec son ancre ; les choix sont encadrés avec « ou » entre les options', options, () => {
  for (const { slug, html } of pages) {
    const n = compte(html, /<article class="don[ "]/g);
    assert.equal(n, slug === 'archimage' ? 14 : 17, `${slug} : nombre de dons`);
    assert.equal(compte(html, /<article class="don[^"]*" id="don-/g), n, `${slug} : ancre de chaque don`);
    assert.match(html, /<h2 id="dons-titre">Dons /, `${slug} : section « Dons »`);
  }
  for (const { slug, html } of pages.filter((p) => p.slug !== 'archimage')) {
    assert.equal(compte(html, /class="choix choix--2"/g), 6, `${slug} : 3 choix par spécialité`);
    assert.equal(compte(html, /class="choix__ou"/g), 6, `${slug} : « ou » entre les deux options`);
    assert.equal(compte(html, /class="onglets__ou"/g), 1, `${slug} : « ou » entre les onglets des spécialités`);
    assert.equal(compte(html, /class="etage etage--don"/g), 3, `${slug} : dons reçus sans choix (niveaux 1, 5, 20)`);
  }
  const archimage = page('archimage');
  assert.equal(compte(archimage, /class="choix choix--2"/g), 1);
  assert.equal(compte(archimage, /class="choix choix--3"/g), 3);
  assert.equal(compte(archimage, /class="specialite"/g), 0, 'Archimage : pas de spécialité');
});

test('spécialités en onglets : deux liens d’onglet (gauche puis droite) vers leurs panneaux, le premier ouvert ; chaque panneau garde son titre', options, () => {
  for (const { slug, html } of pages.filter((p) => p.slug !== 'archimage')) {
    const onglets = [...html.matchAll(/<a class="onglet( is-active)?" id="(onglet-[^"]+)" href="#(specialite-[^"]+)">/g)];
    assert.equal(onglets.length, 2, `${slug} : deux onglets`);
    assert.deepEqual(onglets.map((o) => Boolean(o[1])), [true, false], `${slug} : le premier onglet est ouvert`);
    const panneaux = [...html.matchAll(/<section class="specialite( is-active)?" id="(specialite-[^"]+)"/g)];
    assert.deepEqual(panneaux.map((p) => p[2]), onglets.map((o) => o[3]), `${slug} : un panneau par onglet, dans le même ordre`);
    assert.deepEqual(panneaux.map((p) => Boolean(p[1])), [true, false], `${slug} : le premier panneau est ouvert`);
    assert.equal(compte(html, /<h3 class="specialite__titre"/g), 2, `${slug} : titre de chaque panneau (sans JavaScript)`);
    assert.match(html, /data-onglets/);
  }
  assert.match(page('barde'), /id="onglet-danseur" href="#specialite-danseur">\s*<span class="onglet__surtitre">Spécialité<\/span>\s*<span class="onglet__nom">DANSEUR<\/span>/);
});

test('Barde : l’ordre de l’onglet (Prestation, Son perturbant, les spécialités, Chant double) et les paires du Ménestrel', options, () => {
  const html = page('barde');
  const ordre = ['don-barde-prestation', 'don-barde-son-perturbant', 'specialite-danseur', 'specialite-menestrel', 'don-barde-chant-double'].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(ordre.every((i, k) => i > 0 && (k === 0 || i > ordre[k - 1])), `ordre ${ordre}`);
  const menestrel = html.slice(html.indexOf('id="specialite-menestrel"'), html.indexOf('id="don-barde-chant-double"'));
  const paires = [...menestrel.matchAll(/<div class="choix choix--2"[\s\S]*?<\/div>\s*<\/div>/g)].map((m) => [...m[0].matchAll(/class="don__nom"><a [^>]*>([^<]+)</g)].map((x) => x[1]));
  assert.deepEqual(paires, [['Nouvel accord', 'Écho'], ['Ballade guerrière', 'Amplification'], ['Exaltation', 'Touérk !']]);
});

test('bandeau : « Don de départ » en tuiles ; classe magique (+4 AM) par catégorie ou par la spécialité ; classe raciale', options, () => {
  for (const { slug, html } of pages) assert.equal(compte(html, /class="classe-stat[ "]/g), 3, `${slug} : santé, chakra, barrière de départ`);
  assert.match(page('barde'), /<strong>Classe magique<\/strong> \+4 AM de base/);
  assert.match(page('archimage'), /<strong>Classe magique<\/strong> \+4 AM de base/);
  assert.match(page('orios'), /<strong>Classe magique<\/strong> avec la spécialité <a href="#specialite-chaman">Chaman<\/a>/);
  assert.match(page('orios'), /<strong>Classe raciale<\/strong> de la race <a href="[^"]*\/wiki\/races\/orios\/">Orios<\/a>/);
  assert.ok(!page('guerrier').includes('Classe magique'));
  assert.match(page('orios'), /class="specialite__magique"[^>]*>\s*Classe magique · \+4 AM/);
});

test('inventaire : infobulle de l’objet (glossaire) et « ou » entre deux options ; tableau du Mage Bleu par magie', options, () => {
  const html = page('mage-bleu');
  assert.match(html, /class="inventaire__choix"/);
  const bulle = /<button type="button" class="objet" data-bulle="([^"]+)" aria-describedby="\1"/.exec(html);
  assert.ok(bulle, 'objet avec infobulle');
  assert.match(html, new RegExp(`<span class="bulle" role="tooltip" id="${bulle[1]}" hidden>`));
  assert.equal(compte(html, /class="annexe-classe__carte"/g), 14);
  assert.match(html, /<h3><a href="[^"]*\/wiki\/magies\/magie-du-sang\/">SANG<\/a><\/h3>/);
});

test('fiche d’un don : « Don » dans le bandeau et lien vers le don sur la page de la classe', options, () => {
  const fiche = fileURLToPath(new URL('../dist/wiki/capacites/barde-nouvel-accord/index.html', import.meta.url));
  const html = readFileSync(fiche, 'utf8');
  assert.match(html, /<span class="badge">Don<\/span>/);
  assert.match(html, /href="[^"]*\/wiki\/classes\/barde\/#don-barde-nouvel-accord"/);
  assert.ok(ids(page('barde')).includes('don-barde-nouvel-accord'));
});
