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
import { htmlDeLIcone } from '../src/lib/mots-cles-balises.mjs';
import { menuLateral, sousEntreesDeLaListe } from './aide-menu-html.mjs';
import { RACE_COLORS } from '../src/lib/race-kinds.mjs';
import { racesParNature } from '../src/lib/races-db.mjs';
import { normalize } from '../src/lib/text.mjs';

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
// le nombre de races de la base (R1 : 27 ; R239 : 29 avec Fongoïde et Gémidien ; le site de dev en crée) : jamais écrit ici
const NOMBRE_DE_RACES = base.prepare('SELECT count(*) AS n FROM race').get().n;

test('une page de race rendue par le gabarit pour chaque race de la base', options, () => {
  assert.equal(pages.length, NOMBRE_DE_RACES);
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
  assert.equal(slugsDe('pures').length + slugsDe('hybrides').length, NOMBRE_DE_RACES);
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
      // une race sans présentation (Fongoïde et Gémidien, R239 ; une race créée sur le site) n'a pas d'infobulle : bulle présente ⇔ présentation présente
      const presentation = base.prepare('SELECT presentation FROM race WHERE id = ?').get(`races/${p.slug}`)?.presentation;
      assert.equal(Boolean(bulle), Boolean(presentation?.trim()), `${p.slug} : infobulle si et seulement si la race a une présentation`);
      if (!bulle) continue;
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

// Une magie y est affichée par son nom court, liée au mot-clé de sa magie (migration 0125, demande du propriétaire « si ils existent » : lib/valeurs-fermees-rendu.mjs) :
// en gras, sa définition en infobulle (la bulle `mot-cle-<clé>` posée par le middleware) ; sans mot-clé, le nom nu. Le mot-clé est lu par l'id de la magie dans la
// base courante (le site de dev change les clés), jamais écrit ici. Le mot-clé peut avoir une icône (mot_cle.icone, R235 (3), posée ou retirée sur le
// site de dev) : le nom est alors suivi d'une espace et de son dessin (lib/mots-cles-balises.mjs#avecLIcone), lu dans la base courante lui aussi.
const magiesDeLaBase = new Map(base.prepare('SELECT g.id, g.nom, m.cle, m.icone FROM magie g LEFT JOIN mot_cle m ON m.id = g.mot_cle_id').all().map((g) => [g.id, g]));
const sansBalises = (h) => h.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// le HTML sans les icônes des mots-clés (le dessin et l'espace qui le précède), pour en lire le nom
const DESSINS = [...new Set(base.prepare('SELECT icone FROM mot_cle WHERE icone IS NOT NULL').all().map((m) => htmlDeLIcone(m.icone)).filter(Boolean))];
const sansIcones = (h) => DESSINS.reduce((x, d) => x.replaceAll(` ${d}`, ''), h);
function verifierLaMagieLiee(ou, slugDeLaMagie, interieur) {
  const g = magiesDeLaBase.get(`magies/${slugDeLaMagie}`);
  assert.ok(g, `${ou} : une magie de la base`);
  const dessin = g.cle ? htmlDeLIcone(g.icone) : '';
  if (dessin) assert.ok(interieur.endsWith(` ${dessin}</strong>`), `${ou} : l'icône du mot-clé après le nom, dans sa balise`);
  else assert.equal(sansIcones(interieur), interieur, `${ou} : sans icône du mot-clé, aucune icône`);
  assert.equal(sansBalises(sansIcones(interieur)), g.nom, `${ou} : le nom court`);
  if (g.cle) {
    assert.match(interieur, new RegExp(`^<strong class="mot-cle[ "][^>]*data-mot-cle="${g.cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${ou} : le mot-clé de la magie`);
    assert.doesNotMatch(interieur, /<a\b/, `${ou} : jamais un lien dans un lien`);
  } else assert.doesNotMatch(interieur, /<strong|<a\b/, `${ou} : sans mot-clé, le nom nu`);
}

test('magies innées d’une race : chaque pastille dans la couleur de sa magie, par la classe de la magie (lib/palette-css.mjs), sans style ; le nom est le mot-clé de la magie', options, () => {
  let pastilles = 0;
  let liees = 0;
  for (const { slug, html } of pages) {
    const puces = [...html.matchAll(/<a class="chip race-magie (couleur-magie-[\w-]+)" href="[^"]*\/magies\/([^"/]+)\/">(.*?)<\/a>/g)];
    for (const [, classe, magie, interieur] of puces) {
      assert.equal(classe, classeDeMagie(sansBalises(sansIcones(interieur))), `${slug} : ${magie}`);
      verifierLaMagieLiee(`${slug} : ${magie}`, magie, interieur);
      if (interieur.startsWith('<strong')) liees += 1;
    }
    assert.ok(puces.every(([, classe]) => cssDeLaPalette().includes(`.${classe}{`)), `${slug} : des classes de la palette`);
    assert.doesNotMatch(html, /class="chip race-magie[^"]*"[^>]*style=/, `${slug} : aucune pastille en style`);
    // les magies non disponibles : même rendu, sans la couleur
    for (const [, magie, interieur] of html.matchAll(/<a class="chip" href="[^"]*\/magies\/([^"/]+)\/">(.*?)<\/a>/g)) verifierLaMagieLiee(`${slug} : ${magie} (non disponible)`, magie, interieur);
    pastilles += puces.length;
  }
  assert.ok(pastilles > 100, `${pastilles} pastilles`);
  // des pastilles liées dès que des magies ont un mot-clé (le site de dev peut les retirer toutes : alors aucune)
  assert.ok([...magiesDeLaBase.values()].every((g) => !g.cle) || liees > 0, 'des pastilles liées quand des magies ont un mot-clé');
});

// Le tableau des magies innées de toutes les races, en bas de /races/ (components/magie/TableauMagiesInnees.astro) : il remplace /races-et-magies/.
test('liste des races : tableau des magies innées en bas de page, races dans l’ordre des listes (race.rang_liste), magies dans l’ordre du classeur et dans leur couleur', options, () => {
  assert.ok(!liste.includes('races-et-magies'), 'plus de lien vers l’ancienne page');
  const debut = liste.indexOf('<section id="magies-innees"');
  assert.ok(debut > liste.indexOf('id="hybrides"'), 'après les deux listes');
  const tableau = liste.slice(debut);
  const entetes = [...tableau.matchAll(/<a href="[^"]*\/magies\/([^"/]+)\/"[^>]*><span class="tableau-magies__vertical">(.*?)<\/span><\/a>/g)];
  for (const [, magie, interieur] of entetes) verifierLaMagieLiee(`en-tête ${magie}`, magie, interieur);
  // les magies de la base dans l'ordre du classeur (magie.ordre : lib/magies.ts#ordreDesMagies), sous le nom court de leur page (page.donnees.nom_court,
  // celui que lit le composant), puis « Total » : lu, jamais écrit ici
  const nomsDesMagies = base.prepare("SELECT json_extract(p.donnees, '$.nom_court') AS nom FROM magie m JOIN page p ON p.id = m.id ORDER BY m.ordre").all()
    .map((m) => m.nom).filter((nom) => typeof nom === 'string' && nom.trim() !== '');
  assert.ok(nomsDesMagies.length > 0);
  assert.deepEqual([...sansIcones(tableau).matchAll(/<span class="tableau-magies__vertical">(.*?)<\/span>/g)].map((m) => sansBalises(m[1])), [...nomsDesMagies, 'Total']);
  // colonnes, en-têtes et pastilles dans la couleur de leur magie : sa classe (lib/palette-css.mjs), jamais un style
  const colonnes = [...tableau.matchAll(/<col class="tableau-magies__col-magie (couleur-magie-[\w-]+)">/g)].map((m) => m[1]);
  assert.equal(colonnes.length, nomsDesMagies.length, 'colonnes teintées');
  assert.deepEqual([...tableau.matchAll(/<th scope="col" class="tableau-magies__entete (couleur-magie-[\w-]+)">/g)].map((m) => m[1]), colonnes, 'en-têtes');
  assert.ok(colonnes.every((c) => cssDeLaPalette().includes(`.${c}{`)) && colonnes.includes('couleur-magie-espace-temps'), 'des classes de la palette');
  assert.doesNotMatch(tableau.slice(0, tableau.indexOf('</table>')), /style=/, 'aucun style dans le tableau');
  const lignes = [...tableau.matchAll(/<th scope="row" class="tableau-magies__nom"><a href="[^"]*\/races\/([^/"]+)\/">([^<]+)<\/a><\/th>(.*?)<\/tr>/g)].filter((m) => m[1] !== 'exemple-race');
  assert.deepEqual(lignes.map((m) => m[2].replace(/&#39;/g, "'")), [...nomsDe(colonne('pures')), ...nomsDe(colonne('hybrides'))]);
  assert.deepEqual(lignes.map((m) => m[1]), [...slugsDe('pures'), ...slugsDe('hybrides')], 'l’ordre de la liste des races');
  const pastilles = (slug) => (lignes.find((m) => m[1] === slug)[3].match(/class="tableau-magies__point couleur-magie-[\w-]+"/g) ?? []).length;
  // une pastille par magie innée de la race : la liste de sa page (page.donnees.magies_innees, que le service réécrit à chaque opération
  // `magies_innees`) qui nomme une magie du tableau, comme lib/magie-relations.mjs#accessMatrix ; lue dans la base, jamais écrite ici
  const nomsCourts = new Set(nomsDesMagies.map(normalize));
  for (const [, slug, , cellules] of lignes) {
    const page = base.prepare("SELECT donnees FROM page WHERE id = ?").get(`races/${slug}`);
    const attendu = new Set((JSON.parse(page?.donnees ?? '{}').magies_innees ?? []).map(normalize).filter((n) => nomsCourts.has(n))).size;
    assert.equal(pastilles(slug), attendu, `${slug} : pastilles`);
    assert.match(cellules, new RegExp(`<td class="tableau-magies__total">${attendu}</td>$`), `${slug} : total`);
  }
  assert.ok(lignes.some((m) => pastilles(m[1]) > 0), 'des pastilles');
  // pas de ligne de séparation « Races pures » / « Races hybrides » (demande du propriétaire) : une ligne de tableau par race, rien d'autre
  assert.ok(!/Races (pures|hybrides)|scope="colgroup"/.test(tableau), 'aucune ligne de séparation');
  assert.equal((tableau.match(/<tr>/g) ?? []).length - 1, (tableau.match(/<th scope="row"/g) ?? []).length, 'une ligne par race (plus celle des en-têtes)');
});

test('pages de race : le lien « Voir le tableau » mène au tableau de /races/', options, () => {
  for (const { slug, html } of pages) assert.ok(!html.includes('races-et-magies'), slug);
  assert.match(page('orios'), /href="[^"]*\/races\/#magies-innees">Voir le tableau de toutes les races et de leurs magies</);
});

// Demande du propriétaire : « Je veux comme pour chronologie, et les bases, un menu latéral qui récapitule toutes les races sur le menu d'une race
// ouverte. », puis R321 (« Imbriquer, par étapes » : étape 2) : ce menu est celui de « Les races » dans le menu latéral du site (lib/menu-sous-entrees.mjs).
test('pages de race : « Les races » du menu du site porte toutes les races en sous-entrées (une seule liste, pures puis hybrides, ordre de la liste, la race ouverte marquée et l’entrée ouverte d’office), la page seule dans <main>', options, () => {
  const attendu = [...slugsDe('pures'), ...slugsDe('hybrides')];
  for (const { slug, html } of pages) {
    const m = main(html);
    assert.doesNotMatch(m, /lateral-menu|class="lateral|data-lateral-repli/, `${slug} : plus de menu de page`);
    const listes = sousEntreesDeLaListe(menuLateral(html)).filter((g) => g.menu === 'races');
    assert.equal(listes.length, 1, `${slug} : une seule liste, sans titre de groupe`);
    const [{ entrees: toutes, contientLaPage }] = listes;
    const entrees = toutes.filter((e) => e.href !== null && !e.href.endsWith('/races/exemple-race/'));
    assert.deepEqual(entrees.map((e) => e.href.match(/\/races\/([^/]+)\/$/)[1]), attendu, `${slug} : toutes les races, dans l'ordre`);
    assert.deepEqual(entrees.filter((e) => e.courant === 'page').map((e) => e.href.match(/\/races\/([^/]+)\/$/)[1]), [slug], `${slug} : seule la race ouverte est marquée`);
    assert.equal(contientLaPage, true, `${slug} : « Les races » est ouverte d'office`);
    // « Les races » garde son lien (le mot-clé : /races/), un chevron à côté ; rien ne remplace le libellé
    assert.match(menuLateral(html), /<div class="menu-site__ligne"><a [^>]*href="[^"]*\/races\/"[^>]*>[^<]*<\/a><button type="button" class="menu-site__replier menu-site__replier--chevron" aria-expanded="true" aria-controls="menu-du-site-jeu-races"/, `${slug} : lien et chevron`);
    // le fil d'Ariane et le gabarit sont la page elle-même
    assert.match(m, /<p class="muted"><a href="[^"]*\/">Accueil<\/a> › <a href="[^"]*\/races\/">Races<\/a>/, `${slug} : fil d'Ariane`);
    assert.ok(m.includes('class="race-hero"'), `${slug} : gabarit`);
  }
});

// Lot de l'édition des menus (« changer l'ordre des menu latéraux (par un glisser déposer) », réponse « Règles + Races ») : le menu latéral des races porte,
// pour le mode modification du site de dev (src/scripts/edition/menus.mjs), le menu (`data-ed-menu="races"`) et, sur chaque race, son id, son rang dans la
// liste et son groupe (`data-ed-entree`, `data-ed-rang`, `data-ed-groupe` : une race reste dans le sien) ; rien ne change à l'affichage
test('pages de race : les sous-entrées de « Les races » portent l’id, le rang (race.rang_liste) et le groupe de chaque race, pour le glisser-déposer du site de dev', options, () => {
  const rangs = new Map([...groupesDeLaBase.pures, ...groupesDeLaBase.hybrides].map((r) => [r.id, r.rang_liste]));
  const groupes = new Map([...groupesDeLaBase.pures.map((r) => [r.id, 'pures']), ...groupesDeLaBase.hybrides.map((r) => [r.id, 'hybrides'])]);
  for (const { slug, html } of pages) {
    const [{ entrees: toutes }] = sousEntreesDeLaListe(menuLateral(html)).filter((g) => g.menu === 'races');
    const lignes = toutes.filter((e) => e.id !== 'races/exemple-race');
    assert.equal(lignes.length, NOMBRE_DE_RACES, slug);
    for (const e of lignes) {
      assert.equal(e.href.match(/\/races\/([^/]+)\/$/)?.[1], e.id.slice('races/'.length), `${slug} : ${e.id}`);
      assert.equal(e.groupe, groupes.get(e.id), `${slug} : ${e.id}`);
      assert.equal(e.rang, rangs.get(e.id) ?? null, `${slug} : ${e.id}`);
    }
    // les pures d'abord, d'un bloc, puis les hybrides : un groupe est contigu (le glisser-déposer le borne)
    const suite = lignes.map((e) => e.groupe);
    assert.deepEqual(suite, [...suite].sort((a, b) => (a === b ? 0 : a === 'pures' ? -1 : 1)), `${slug} : groupes contigus`);
  }
});
