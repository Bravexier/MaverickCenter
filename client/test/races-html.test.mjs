// Pages de race CONSTRUITES (client/dist/races/*/index.html), rendues par le gabarit (components/race/RacePage.astro) depuis les tables de la base :
// aucun tableau Markdown, plus d'écarts avec la fiche V15.2.2 ni de source citée (décision R13), relations par niveau sans regrouper les peuples qui diffèrent.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/races-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { classeDeMagie, cssDeLaPalette } from '../src/lib/palette-css.mjs';

const dossier = fileURLToPath(new URL('../dist/races/', import.meta.url));
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
  assert.match(page('drakos'), /<dt>Santé de départ<\/dt>\s*<dd[^>]*>13<\/dd>/);
});

test('relations : Elfe noir en deux blocs (Charbon, Salé), la matrice entre ses peuples ; une race sans peuple le dit', options, () => {
  const html = page('elfe-noir');
  const voit = html.slice(html.indexOf('Comment ses peuples voient les autres'), html.indexOf('Comment les autres voient ses peuples'));
  assert.equal((voit.match(/class="regards__bloc"/g) ?? []).length, 2);
  assert.match(voit, /<h4>Elfe Noir Charbon<\/h4>/);
  assert.match(voit, /<h4>Elfe Noir Salé<\/h4>/);
  assert.match(html, /class="race-table regards__matrice table-donnees"/);
  assert.match(page('farfadet'), /n’a pas de peuple dans l’onglet « Relation entre les races »/);
  for (const { slug, html: h } of pages) {
    const niveaux = [...h.matchAll(/class="regard__niveau">([^<]+)</g)].map((m) => m[1]);
    for (const nv of niveaux) assert.ok(['Alliée', 'Appréciée', 'Acceptée', 'Neutre', 'Évitée', 'Haine', 'Ennemie'].includes(nv), `${slug} : ${nv}`);
  }
});

test('race hybride : bandeau « Race hybride » et lien vers sa classe raciale', options, () => {
  assert.match(page('orios'), /race-hero__surtitre">Race hybride</);
  assert.match(page('orios'), /Classe raciale<\/strong>\s*<a href="[^"]*\/classes\/orios\/"/);
  assert.match(page('humain'), /race-hero__surtitre">Race pure</);
  // décision R14 : le Drassah'thac est hybride sans avoir de classe raciale ; la Lamia est pure
  assert.match(page('drassahthac'), /race-hero__surtitre">Race hybride</);
  assert.ok(!page('drassahthac').includes('class="race-hero__classe"'), 'drassahthac : pas de classe raciale');
  assert.match(page('drassahthac'), /href="[^"]*\/races\/#hybrides">Races hybrides</);
  assert.match(page('lamia'), /race-hero__surtitre">Race pure</);
});

// La liste /races/ : races pures puis hybrides côte à côte, dans l'ordre du propriétaire, une pastille par race (components/race/RacesPastilles.astro),
// sur le modèle des classes et de la carte des magies ; l'accroche en infobulle ; ni magies ni classe raciale.
const liste = present && existsSync(join(dossier, 'index.html')) ? main(readFileSync(join(dossier, 'index.html'), 'utf8')) : '';
const colonne = (id) => {
  const debut = liste.indexOf(`<section class="races-groupe" id="${id}"`);
  return debut < 0 ? '' : liste.slice(debut, liste.indexOf('</section>', debut));
};
// sans la race d'exemple, présente quand le site est construit sans HIDE_EXAMPLES=1 (c'est le cas de la CI)
const pastillesDe = (html) =>
  [...html.matchAll(/<a class="race-pastille" href="[^"]*\/races\/([^/"]+)\/"([^>]*)>.*?<span class="race-pastille__nom">([^<]+)<\/span>/g)]
    .filter((m) => m[1] !== 'exemple-race')
    .map((m) => ({ slug: m[1], attributs: m[2], nom: m[3].replace(/&#39;/g, "'") }));
const nomsDe = (html) => pastillesDe(html).map((p) => p.nom);

test('liste des races : deux groupes de pastilles, pures puis hybrides, dans l’ordre du propriétaire', options, () => {
  assert.match(liste, /class="races-pastilles"/);
  assert.ok(liste.indexOf('id="pures"') < liste.indexOf('id="hybrides"'));
  assert.deepEqual(nomsDe(colonne('pures')), [
    'Humain', 'Nain', 'Elfe forestier', 'Elfe doré', 'Elfe argenté', 'Elfe noir', 'Farfadet', 'Felfe', 'Majin', 'Hujin', 'Drakos', 'Lamia', 'Mort-vivant',
  ]);
  assert.deepEqual(nomsDe(colonne('hybrides')), [
    "Drassah'thac", 'Orios', 'Fenrir', 'Kitsune', 'Olwman', 'Rokh', 'Namazu', 'Minotaure', 'Satyre', 'Médusain', 'Jackalope', 'Marcass', 'Anansi', 'Goleois',
  ]);
});

test('liste des races : chaque groupe dans la couleur du bandeau des pages de race, avec le nombre de ses races', options, () => {
  assert.match(colonne('pures'), /^<section class="races-groupe" id="pures" style="--couleur-race: #2f6a6a">/);
  assert.match(colonne('hybrides'), /^<section class="races-groupe" id="hybrides" style="--couleur-race: #8a5a1c">/);
  assert.match(colonne('hybrides'), /<span class="races-groupe__nom">Races hybrides<\/span>\s*<span class="races-groupe__compte">14<\/span>/);
  assert.match(page('orios'), /<div class="race race--hybride" style="--couleur-race: #8a5a1c">/);
  assert.match(page('humain'), /<div class="race race--pure" style="--couleur-race: #2f6a6a">/);
});

test('liste des races : l’accroche de chaque race en infobulle ; ni magies ni classe raciale', options, () => {
  for (const id of ['pures', 'hybrides']) {
    const html = colonne(id);
    for (const p of pastillesDe(html)) {
      const bulle = p.attributs.match(/data-bulle="([^"]+)" aria-describedby="\1" title="([^"]+)"/);
      assert.ok(bulle, `${p.slug} : infobulle`);
      assert.match(html, new RegExp(`<span class="bulle" role="tooltip" id="${bulle[1]}" hidden>`), `${p.slug} : bulle cachée`);
    }
    assert.ok(!html.includes('Magies innées'), `${id} : pas de magies innées`);
    assert.ok(!html.includes('Classe raciale'), `${id} : pas de classe raciale`);
    const liens = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(liens.length > 0 && liens.every((h) => /\/races\/[^/]+\/$/.test(h)), `${id} : seulement les liens vers les races`);
  }
  assert.match(colonne('hybrides'), /title="Les semi-renards, une race à la beauté et au narcissisme sans égal"/);
});

test('magies innées d’une race : chaque pastille dans la couleur de sa magie, par la classe de la magie (lib/palette-css.mjs), sans style', options, () => {
  let pastilles = 0;
  for (const { slug, html } of pages) {
    const puces = [...html.matchAll(/<a class="chip race-magie (couleur-magie-[\w-]+)" href="[^"]*\/magies\/[^"]+\/">([^<]+)<\/a>/g)];
    for (const [, classe, nom] of puces) assert.equal(classe, classeDeMagie(nom), `${slug} : ${nom}`);
    assert.ok(puces.every(([, classe]) => cssDeLaPalette().includes(`.${classe}{`)), `${slug} : des classes de la palette`);
    assert.doesNotMatch(html, /class="chip race-magie[^"]*"[^>]*style=/, `${slug} : aucune pastille en style`);
    pastilles += puces.length;
  }
  assert.ok(pastilles > 100, `${pastilles} pastilles`);
  assert.match(page('nain'), /<a class="chip race-magie couleur-magie-feu" href="\/magies\/magie-du-feu\/">Feu<\/a>/);
});

// Le tableau des magies innées de toutes les races, en bas de /races/ (components/magie/TableauMagiesInnees.astro) : il remplace /races-et-magies/.
test('liste des races : tableau des magies innées en bas de page, races dans l’ordre des listes, magies dans l’ordre du classeur et dans leur couleur', options, () => {
  assert.ok(!liste.includes('races-et-magies'), 'plus de lien vers l’ancienne page');
  const debut = liste.indexOf('<section id="magies-innees"');
  assert.ok(debut > liste.indexOf('id="hybrides"'), 'après les deux listes');
  const tableau = liste.slice(debut);
  assert.deepEqual([...tableau.matchAll(/<span class="tableau-magies__vertical">([^<]+)<\/span>/g)].map((m) => m[1]), [
    'Potentiel Illimité', 'Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre', 'Total',
  ]);
  // colonnes, en-têtes et pastilles dans la couleur de leur magie : sa classe (lib/palette-css.mjs), jamais un style
  const colonnes = [...tableau.matchAll(/<col class="tableau-magies__col-magie (couleur-magie-[\w-]+)">/g)].map((m) => m[1]);
  assert.equal(colonnes.length, 15, 'colonnes teintées');
  assert.deepEqual([...tableau.matchAll(/<th scope="col" class="tableau-magies__entete (couleur-magie-[\w-]+)">/g)].map((m) => m[1]), colonnes, 'en-têtes');
  assert.ok(colonnes.every((c) => cssDeLaPalette().includes(`.${c}{`)) && colonnes.includes('couleur-magie-espace-temps'), 'des classes de la palette');
  assert.doesNotMatch(tableau.slice(0, tableau.indexOf('</table>')), /style=/, 'aucun style dans le tableau');
  const lignes = [...tableau.matchAll(/<th scope="row" class="tableau-magies__nom"><a href="[^"]*\/races\/([^/"]+)\/">([^<]+)<\/a><\/th>(.*?)<\/tr>/g)].filter((m) => m[1] !== 'exemple-race');
  assert.deepEqual(lignes.map((m) => m[2].replace(/&#39;/g, "'")), [...nomsDe(colonne('pures')), ...nomsDe(colonne('hybrides'))]);
  const pastilles = (slug) => (lignes.find((m) => m[1] === slug)[3].match(/class="tableau-magies__point couleur-magie-[\w-]+"/g) ?? []).length;
  assert.equal(pastilles('humain'), 15);
  assert.equal(pastilles('nain'), 5);
  assert.equal(pastilles('drassahthac'), 14);
  assert.equal(pastilles('orios'), 3);
  assert.match(lignes.find((m) => m[1] === 'nain')[3], /<td class="tableau-magies__total">5<\/td>$/);
  // pas de ligne de séparation « Races pures » / « Races hybrides » (demande du propriétaire) : une ligne de tableau par race, rien d'autre
  assert.ok(!/Races (pures|hybrides)|scope="colgroup"/.test(tableau), 'aucune ligne de séparation');
  assert.equal((tableau.match(/<tr>/g) ?? []).length - 1, (tableau.match(/<th scope="row"/g) ?? []).length, 'une ligne par race (plus celle des en-têtes)');
});

test('pages de race : le lien « Voir le tableau » mène au tableau de /races/', options, () => {
  for (const { slug, html } of pages) assert.ok(!html.includes('races-et-magies'), slug);
  assert.match(page('orios'), /href="[^"]*\/races\/#magies-innees">Voir le tableau de toutes les races et de leurs magies</);
});
