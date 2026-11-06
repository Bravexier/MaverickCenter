// Pages de race CONSTRUITES (client/dist/races/*/index.html), rendues par le gabarit (components/race/RacePage.astro) depuis les tables de la base :
// aucun tableau Markdown, plus d'écarts avec la fiche V15.2.2 ni de source citée (décision R13), relations par niveau sans regrouper les peuples qui diffèrent.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/races-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { classeDeMagie, cssDeLaPalette, cssDesFamilles } from '../src/lib/palette-css.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { RACE_COLORS } from '../src/lib/race-kinds.mjs';
import { racesParNature } from '../src/lib/races-db.mjs';

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
// L'ordre de la liste des races (race.rang_liste, migration 0092 ; réponse du propriétaire « /races/ suit, le reste figé ») : le menu latéral des races,
// /races/ et le tableau des magies innées le suivent ; il se réordonne sur le site de dev, l'état courant de la base fait foi (lib/races-db.mjs#racesParNature,
// la règle du service ; sa valeur d'import, l'ancien ORDRE_DES_RACES : test/db-rang-des-races.test.mjs)
const base = ouvrirBase();
const groupesDeLaBase = racesParNature(base);
const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
const slugsDe = (groupe) => groupesDeLaBase[groupe].map((r) => r.id.slice('races/'.length));
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
  // la santé de départ du Drakos : celle de la base (le site de dev la modifie)
  const sante = base.prepare("SELECT sante_depart FROM race_onglet WHERE race_id = 'races/drakos'").get().sante_depart;
  assert.match(page('drakos'), new RegExp(`<dt>Santé de départ</dt>\\s*<dd[^>]*>${sante}</dd>`));
});

// Sous « Capacité Mode Hyper », le lien mène à la page « Le mode hyper » (R187 : la « Liste des effets mode hyper » est supprimée, ses renvois visent
// cette page, qui porte le tableau des capacités de toutes les races).
test('Mode Hyper : le lien sous le titre mène à « Le Mode Hyper » (R187), plus à la liste supprimée', options, () => {
  for (const { slug, html } of pages) {
    const section = html.slice(html.indexOf('<section class="race-section" id="mode-hyper"'), html.indexOf('</section>', html.indexOf('id="mode-hyper"')));
    assert.match(section, /<h2 id="mode-hyper-titre">Capacité Mode Hyper<\/h2>\s*<p class="muted"><a href="[^"]*\/regles\/le-mode-hyper\/">Le Mode Hyper<\/a><\/p>/, slug);
    assert.ok(!html.includes('liste-des-effets-mode-hyper') && !html.includes('Liste des effets mode hyper'), `${slug} : un renvoi à la liste supprimée`);
  }
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
  const debut = liste.search(new RegExp(`<section class="races-groupe(?: couleur-race-[a-z]+)?" id="${id}"`));
  return debut < 0 ? '' : liste.slice(debut, liste.indexOf('</section>', debut));
};
// sans la race d'exemple, présente quand le site est construit sans HIDE_EXAMPLES=1 (c'est le cas de la CI)
const pastillesDe = (html) =>
  [...html.matchAll(/<a class="race-pastille" href="[^"]*\/races\/([^/"]+)\/"([^>]*)>.*?<span class="race-pastille__nom">([^<]+)<\/span>/g)]
    .filter((m) => m[1] !== 'exemple-race')
    .map((m) => ({ slug: m[1], attributs: m[2], nom: m[3].replace(/&#39;/g, "'") }));
const nomsDe = (html) => pastillesDe(html).map((p) => p.nom);

test('liste des races : deux groupes de pastilles, pures puis hybrides, chacun dans l’ordre de la liste (race.rang_liste)', options, () => {
  assert.match(liste, /class="races-pastilles"/);
  assert.ok(liste.indexOf('id="pures"') < liste.indexOf('id="hybrides"'));
  assert.deepEqual(pastillesDe(colonne('pures')).map((p) => p.slug), slugsDe('pures'));
  assert.deepEqual(pastillesDe(colonne('hybrides')).map((p) => p.slug), slugsDe('hybrides'));
  assert.equal(slugsDe('pures').length + slugsDe('hybrides').length, 27);
});

test('liste des races : chaque groupe dans la couleur du bandeau des pages de race, avec le nombre de ses races', options, () => {
  // la couleur : la classe de la nature (lib/palette-css.mjs, famille `race`, émise par la page), jamais un style
  assert.match(colonne('pures'), /^<section class="races-groupe couleur-race-pure" id="pures">/);
  assert.match(colonne('hybrides'), /^<section class="races-groupe couleur-race-hybride" id="hybrides">/);
  assert.match(colonne('hybrides'), /<span class="races-groupe__nom">Races hybrides<\/span>\s*<span class="races-groupe__compte">14<\/span>/);
  assert.match(page('orios'), /<div class="race race--hybride couleur-race-hybride">/);
  assert.match(page('humain'), /<div class="race race--pure couleur-race-pure">/);
  // les couleurs des deux natures, dans la feuille de la liste et de chaque page de race
  assert.deepEqual(RACE_COLORS, { pure: '#2f6a6a', hybride: '#8a5a1c' });
  for (const html of [readFileSync(join(dossier, 'index.html'), 'utf8'), page('orios'), page('humain')]) {
    assert.ok(html.includes(`<style>${cssDesFamilles(['race'])}</style>`), 'la feuille des races');
  }
  assert.ok(cssDesFamilles(['race']).startsWith('.couleur-race-pure{--couleur:#2f6a6a;'));
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
  // l'accroche du Kitsune : le résumé de sa page dans la base (le site de dev le réécrit)
  const accroche = base.prepare("SELECT resume FROM page WHERE id = 'races/kitsune'").get().resume;
  assert.ok(pastillesDe(colonne('hybrides')).find((p) => p.slug === 'kitsune').attributs.includes(`title="${echapper(accroche)}"`), `kitsune : « ${accroche} »`);
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
test('liste des races : tableau des magies innées en bas de page, races dans l’ordre des listes (race.rang_liste), magies dans l’ordre du classeur et dans leur couleur', options, () => {
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
  assert.deepEqual(lignes.map((m) => m[1]), [...slugsDe('pures'), ...slugsDe('hybrides')], 'l’ordre de la liste des races');
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

// Demande du propriétaire : « Je veux comme pour chronologie, et les bases, un menu latéral qui récapitule toutes les races sur le menu d'une race
// ouverte. » (components/race/MenuDesRaces.astro, sur le menu latéral commun des Bases :
// components/guide/MenuLateral.astro, ses classes `lateral*` et sa feuille).
test('pages de race : à gauche le menu latéral de toutes les races (une seule liste, pures puis hybrides, ordre de la liste, la race ouverte marquée), à droite la page', options, () => {
  const attendu = [...slugsDe('pures'), ...slugsDe('hybrides')];
  for (const { slug, html } of pages) {
    const m = main(html);
    const nav = m.match(/<nav class="lateral-menu" aria-label="Races">([\s\S]*?)<\/nav>/);
    assert.ok(nav, `${slug} : menu des races`);
    assert.ok(m.indexOf('<nav class="lateral-menu"') < m.indexOf('<div class="lateral-page">'), `${slug} : le menu à gauche, la page à droite`);
    assert.match(nav[1], /<details class="lateral-menu__repli" open data-lateral-repli>/, `${slug} : ouvert sans JavaScript`);
    assert.match(nav[1], /<p class="lateral-menu__titre"><a href="[^"]*\/races\/">Races<\/a><\/p>/, `${slug} : titre lié à /races/`);
    // réponse du propriétaire : « Une seule liste » (sans titre de groupe, comme le menu des Bases)
    assert.equal((nav[1].match(/<ol class="lateral-menu__liste"[ >]/g) ?? []).length, 1, `${slug} : une seule liste`);
    assert.ok(!nav[1].includes('lateral-menu__groupe') && !nav[1].includes('Races pures'), `${slug} : sans titre de groupe`);
    const entrees = [...nav[1].matchAll(/<a class="lateral-menu__lien" href="[^"]*\/races\/([^/"]+)\/"( aria-current="page")?>/g)]
      .filter((e) => e[1] !== 'exemple-race');
    assert.deepEqual(entrees.map((e) => e[1]), attendu, `${slug} : toutes les races, dans l'ordre`);
    assert.deepEqual(entrees.filter((e) => e[2]).map((e) => e[1]), [slug], `${slug} : seule la race ouverte est marquée`);
    // le fil d'Ariane et le gabarit dans la colonne de la page
    const droite = m.slice(m.indexOf('<div class="lateral-page">'));
    assert.match(droite, /<p class="muted"><a href="[^"]*\/">Accueil<\/a> › <a href="[^"]*\/races\/">Races<\/a>/, `${slug} : fil d'Ariane à droite`);
    assert.ok(droite.includes('class="race-hero"'), `${slug} : gabarit à droite`);
  }
});

// Lot de l'édition des menus (« changer l'ordre des menu latéraux (par un glisser déposer) », réponse « Règles + Races ») : le menu latéral des races porte,
// pour le mode modification du site de dev (src/scripts/edition/menus.mjs), le menu (`data-ed-menu="races"`) et, sur chaque race, son id, son rang dans la
// liste et son groupe (`data-ed-entree`, `data-ed-rang`, `data-ed-groupe` : une race reste dans le sien) ; rien ne change à l'affichage
test('pages de race : le menu latéral porte l’id, le rang (race.rang_liste) et le groupe de chaque race, pour le glisser-déposer du site de dev', options, () => {
  const rangs = new Map([...groupesDeLaBase.pures, ...groupesDeLaBase.hybrides].map((r) => [r.id, r.rang_liste]));
  const groupes = new Map([...groupesDeLaBase.pures.map((r) => [r.id, 'pures']), ...groupesDeLaBase.hybrides.map((r) => [r.id, 'hybrides'])]);
  for (const { slug, html } of pages) {
    const nav = main(html).match(/<nav class="lateral-menu" aria-label="Races">([\s\S]*?)<\/nav>/)[1];
    assert.match(nav, /<ol class="lateral-menu__liste" data-ed-menu="races">/, `${slug} : le menu`);
    const lignes = [...nav.matchAll(/<li([^>]*)><a class="lateral-menu__lien" href="[^"]*\/races\/([^/"]+)\/"/g)].filter((m) => m[2] !== 'exemple-race');
    assert.equal(lignes.length, 27, slug);
    for (const [, attributs, race] of lignes) {
      const id = `races/${race}`;
      const attribut = (nom) => attributs.match(new RegExp(` ${nom}="([^"]*)"`))?.[1];
      assert.equal(attribut('data-ed-entree'), id, `${slug} : ${race}`);
      assert.equal(attribut('data-ed-groupe'), groupes.get(id), `${slug} : ${race}`);
      assert.equal(attribut('data-ed-rang'), rangs.get(id) === null ? undefined : String(rangs.get(id)), `${slug} : ${race}`);
    }
    // les pures d'abord, d'un bloc, puis les hybrides : un groupe est contigu (le glisser-déposer le borne)
    const suite = lignes.map((m) => m[1].match(/data-ed-groupe="([^"]+)"/)[1]);
    assert.deepEqual(suite, [...suite].sort((a, b) => (a === b ? 0 : a === 'pures' ? -1 : 1)), `${slug} : groupes contigus`);
  }
});
