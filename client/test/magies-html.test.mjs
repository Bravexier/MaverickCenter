// Pages de magie CONSTRUITES (client/dist/wiki/magies/*/index.html) : câblage des infobulles et des fiches de créatures, éléments retirés à la demande du propriétaire.
// Ce test lit le site construit : il ne tourne qu'après `npm run build` (la CI l'exécute juste après) et se saute sinon.
//   node --test test/magies-html.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dossier = fileURLToPath(new URL('../dist/wiki/magies/', import.meta.url));
const present = existsSync(dossier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const indexMagies = present ? readFileSync(join(dossier, 'index.html'), 'utf8') : '';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
// pages rendues par le gabarit (la magie d'exemple, sans ligne dans la base, garde le rendu Markdown)
const pages = present
  ? readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ slug: d.name, html: readFileSync(join(dossier, d.name, 'index.html'), 'utf8') }))
      .filter((p) => p.html.includes('class="magie-hero"'))
  : [];
// pages qui ont leurs propres sorts ; le Potentiel Illimité n'en a pas, il montre ceux des autres magies (tests plus bas)
const avecSorts = pages.filter((p) => p.html.includes('<h2 id="sorts-titre">Sorts <span'));
const potentiel = pages.find((p) => p.slug === 'potentiel-illimite')?.html ?? '';

/** Contenu (HTML) de l'élément ouvrant en `debut` (index du « < »), jusqu'à sa fermeture : comptage des balises du même nom. */
function contenu(html, debut, nom) {
  const re = new RegExp(`<(/?)${nom}\\b[^>]*>`, 'g');
  re.lastIndex = debut;
  let profondeur = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    profondeur += m[1] ? -1 : 1;
    if (profondeur === 0) return html.slice(debut, m.index + m[0].length);
  }
  return html.slice(debut);
}
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

test('15 pages de magie construites, 14 avec une table de sorts', options, () => {
  assert.equal(pages.length, 15);
  assert.equal(avecSorts.length, 14);
});

test('index des magies : 15 noms courts, descriptions en tooltip, version au footer', options, () => {
  assert.equal([...indexMagies.matchAll(/class="magies-orbite__noeud"/g)].length, 15);
  const nomsVisibles = [...indexMagies.matchAll(/<span class="magies-orbite__nom"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(nomsVisibles, ['Potentiel Illimité', 'Arcane', 'Corruption', 'Espace-Temps', 'Vide', 'Nécromancie', 'Sang', 'Lumière', 'Ombre', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre']);
  assert.ok(!indexMagies.includes('magies-orbite__description'));
  assert.equal([...indexMagies.matchAll(/class="magies-orbite__noeud"[^>]*data-tooltip="[^"]+"/g)].length, 15);
  assert.equal([...indexMagies.matchAll(/class="magies-orbite__noeud"[^>]*aria-description="[^"]+"/g)].length, 15);
  assert.equal([...indexMagies.matchAll(/class="magies-orbite__lien /g)].length, 4);
  assert.ok(indexMagies.includes(`<span class="site-footer__version">v${version}</span>`));
  assert.ok(!indexMagies.includes('Écoles, sorts et règles de magie.'));
});

test('index des magies sur téléphone : chaque infobulle est bornée à la carte (sinon, même cachée, elle fait défiler la page horizontalement)', options, () => {
  const positions = [...indexMagies.matchAll(/class="magies-orbite__position[^"]*" style="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(positions.length, 15);
  for (const style of positions) {
    const mx = Number(style.match(/--mx: ([\d.]+)%/)?.[1]);
    assert.equal(Number(style.match(/--mx-fraction: ([\d.]+)/)?.[1]), mx / 100, style);
  }
  const telephone = indexMagies.slice(indexMagies.indexOf('@media (max-width: 44rem)'));
  assert.match(telephone, /\.magies-orbite \{ container-type: inline-size;/, 'la carte est le conteneur des unités cqw');
  assert.match(telephone, /\.magies-orbite__noeud::after \{[^}]*box-sizing: border-box;[^}]*clamp\(/, 'largeur bornée bordure comprise, position ramenée dans la carte');
});

test('chaque identifiant est unique dans une page ; aria-controls, aria-describedby et data-bulle désignent un élément qui existe', options, () => {
  for (const { slug, html } of pages) {
    const tous = ids(html);
    const vus = new Set();
    for (const id of tous) {
      assert.ok(!vus.has(id), `${slug} : id en double « ${id} »`);
      vus.add(id);
    }
    for (const attribut of ['aria-controls', 'aria-describedby', 'aria-labelledby', 'data-bulle']) {
      for (const m of html.matchAll(new RegExp(`\\s${attribut}="([^"]+)"`, 'g'))) {
        for (const cible of m[1].split(/\s+/)) assert.ok(vus.has(cible), `${slug} : ${attribut}="${cible}" ne mène à rien`);
      }
    }
  }
});

test('infobulles : un déclencheur par bulle, un texte de repli (title), une bulle en role="tooltip" cachée et faite d’éléments en ligne seulement', options, () => {
  let bulles = 0;
  for (const { slug, html } of pages) {
    const declencheurs = [...html.matchAll(/<(?:a|button)\b[^>]*\sdata-bulle="([^"]+)"[^>]*>/g)];
    for (const [balise, id] of declencheurs) {
      assert.match(balise, /\saria-describedby="/, `${slug} : ${id} sans aria-describedby`);
      assert.match(balise, /\stitle="[^"]+"/, `${slug} : ${id} sans texte de repli (sans JavaScript)`);
      const debut = html.indexOf(`id="${id}"`);
      const ouvrante = html.lastIndexOf('<span', debut);
      const bulle = contenu(html, ouvrante, 'span');
      assert.match(html.slice(ouvrante, debut + id.length + 40), /role="tooltip"/, `${slug} : ${id} n'est pas un tooltip`);
      assert.match(html.slice(ouvrante, debut + id.length + 40), /\shidden\b/, `${slug} : ${id} doit être cachée au départ`);
      // un bloc dans un paragraphe ferme le <p> : le contenu de la bulle fuirait dans le texte
      assert.doesNotMatch(bulle, /<(?:dl|dt|dd|div|ul|ol|li|p|table|h[1-6]|blockquote)\b/, `${slug} : bloc dans la bulle ${id}`);
      bulles += 1;
    }
    assert.equal(declencheurs.length, new Set(declencheurs.map((d) => d[1])).size, `${slug} : un déclencheur par bulle`);
  }
  assert.ok(bulles > 100, `infobulles posées : ${bulles}`);
});

test('règle spéciale du NPM 5 : une seule pastille « i », dans le titre du tableau du NPM 5 juste après son texte, et plus d’encart sous le tableau', options, () => {
  for (const { slug, html } of avecSorts) {
    const infos = [...html.matchAll(/class="info"/g)].length;
    assert.equal(infos, 1, `${slug} : une pastille « i »`);
    const npm5 = html.slice(html.indexOf('id="npm-5"'));
    assert.ok(npm5.indexOf('class="info"') > 0 && npm5.indexOf('class="info"') < npm5.indexOf('class="sorts-wrap"'), `${slug} : la pastille est dans le titre du tableau 5`);
    // à gauche, après le texte du titre, avant les pastilles de niveau (demande du propriétaire)
    assert.ok(npm5.indexOf('class="npm__nom"') < npm5.indexOf('class="info"') && npm5.indexOf('class="info"') < npm5.indexOf('class="npm__pips"'), `${slug} : la pastille suit le texte du titre`);
    // dans le même bloc que le texte : sur un téléphone étroit, le « i » passe à la ligne avec lui, jamais seul sous le badge
    const intitule = contenu(npm5, npm5.indexOf('<span class="npm__intitule">'), 'span');
    assert.ok(intitule.includes('class="npm__nom"') && intitule.includes('class="info"'), `${slug} : texte du titre et pastille dans le même bloc`);
    assert.ok(!html.includes('magie-regle'), `${slug} : plus d'encart de règle sous le tableau`);
  }
});

test('retirés à la demande du propriétaire : pastilles Remarque / Texte, légende, source par sort et en pied de page, créatures qui lancent le sort, « voir la page », bandeau « brouillon »', options, () => {
  for (const { slug, html } of pages) {
    for (const interdit of ['pas encore relu', 'magie-legende', 'Légende', 'Source :', 'sort-detail__source', 'Créatures qui lancent', 'Voir la page', '<h2>Sources</h2>', '<h5>Remarque</h5>', '<h5>Texte du sort</h5>', '<h5>Effets secondaires</h5>', 'title="Remarque du classeur"', 'title="Texte du sort"']) {
      assert.ok(!html.includes(interdit), `${slug} : « ${interdit} » est revenu`);
    }
  }
});

test('niveaux de maîtrise : plus de colonne « Maîtrise » ; chaque bonus du type ou d’une cellule est une pastille à côté de sa valeur', options, () => {
  let pastilles = 0;
  for (const { slug, html } of avecSorts) {
    assert.ok(!html.includes('<th scope="col">Maîtrise</th>') && !html.includes('sort__maitrise') && !html.includes('nm__champ'), `${slug} : colonne Maîtrise revenue`);
    for (const m of html.matchAll(/<span class="nm"[^>]*>([^<]*)<\/span>/g)) {
      assert.match(m[1], /NM/, `${slug} : pastille « ${m[1]} » sans NM`);
      assert.doesNotMatch(m[1], /^\(|\)$/, `${slug} : pastille « ${m[1]} » avec ses parenthèses`);
      pastilles += 1;
    }
  }
  // 72 bonus de la colonne Type + 190 des cellules Coût, Portée, Zone, D/S/B (test/maitrise-sorts.test.mjs)
  assert.equal(pastilles, 262);
  const feu = pages.find((p) => p.slug === 'magie-du-feu').html;
  const bdf = contenu(feu, feu.indexOf('<tbody class="sort" id="sort-boule-de-feu"'), 'tbody');
  assert.match(bdf, /<span class="val">2d6 dégâts<\/span> <span class="nm">\+1d6\/NM<\/span>/);
});

test('panneau d’un sort : un seul cadre « Effets » par sort, les règles d’invocation et l’annexe sont repliées par défaut', options, () => {
  for (const { slug, html } of avecSorts) {
    assert.equal([...html.matchAll(/<h5>Effets<\/h5>/g)].length, 23, `${slug} : 23 cadres « Effets »`);
    assert.doesNotMatch(html, /<details[^>]*\sopen\b/, `${slug} : un <details> est ouvert par défaut`);
  }
  const necro = pages.find((p) => p.slug === 'magie-de-la-necromancie').html;
  assert.match(necro, /<summary>Règles de l’invocation<\/summary>/);
  assert.match(necro, /<summary>TABLEAU &quot;AMÉLIORATION CADAVÉRIQUE&quot;<\/summary>/);
});

test('créatures invoquées : un bouton et un lien « Bestiaire » par créature, une fiche cachée par bouton, juste sous le bloc de la créature', options, () => {
  const attendu = { 'magie-de-la-necromancie': 28, 'magie-de-la-terre': 30, 'magie-de-lombre': 5 };
  for (const [slug, n] of Object.entries(attendu)) {
    const { html } = pages.find((p) => p.slug === slug);
    const boutons = [...html.matchAll(/<button\b[^>]*class="chip creature__bouton"[^>]*aria-controls="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(boutons.length, n, `${slug} : boutons`);
    assert.equal([...html.matchAll(/class="chip creature__lien"/g)].length, n, `${slug} : liens Bestiaire`);
    for (const id of boutons) {
      assert.match(html, new RegExp(`<article class="creature__fiche" id="${id}" hidden`), `${slug} : fiche ${id} cachée`);
      assert.doesNotMatch(html, new RegExp(`<button[^>]*aria-controls="${id}"[^>]*aria-expanded`), 'aria-expanded est posé par le script, pas par le HTML');
    }
    // la fiche suit le bloc : « </li><li class="creature__rangee" hidden><article … » ; jamais en fin de liste
    assert.equal([...html.matchAll(/<li class="creature__rangee" hidden>/g)].length, [...html.matchAll(/<span class="invoque__bloc">/g)].length, `${slug} : une rangée de fiches par bloc`);
  }
});

// Tableau des relations entre magies, sous la carte de /wiki/magies/ (components/magie/TableauRelationsMagies.astro) : il remplace /wiki/races-et-magies/.
// Le Potentiel Illimité n'y est pas (demande du propriétaire).
const ORDRE_DU_CLASSEUR = ['Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre'];

test('/wiki/magies/ : le tableau des relations suit la carte, lignes et colonnes dans l’ordre du classeur sans le Potentiel Illimité, chaque ligne dans la couleur de sa magie', options, () => {
  const debut = indexMagies.indexOf('<section id="relations"');
  assert.ok(debut > indexMagies.indexOf('class="magies-orbite"'), 'sous la carte des magies');
  const tableau = contenu(indexMagies, debut, 'section');
  assert.deepEqual([...tableau.matchAll(/<span class="tableau-magies__vertical">([^<]+)<\/span>/g)].map((m) => m[1]), ORDRE_DU_CLASSEUR, 'colonnes');
  const lignes = [...tableau.matchAll(/<tr class="tableau-magies__ligne" style="--couleur-magie: (#[0-9a-f]{6})"><th scope="row" class="tableau-magies__nom"><a [^>]*><span[^>]*><\/span>([^<]+)<\/a>/g)];
  assert.deepEqual(lignes.map((m) => m[2]), ORDRE_DU_CLASSEUR, 'lignes');
  assert.equal(lignes[6][1], '#ff0000', 'la ligne du Feu est rouge');
  assert.ok(!tableau.includes('Potentiel Illimité'), 'ni ligne ni colonne pour le Potentiel Illimité');
  assert.ok(!tableau.includes('Une case « – »'), 'plus d’explication des cases « – »');
  assert.match(tableau, /<td title="Feu faible contre Eau"><span class="tableau-magies__marque tableau-magies__marque--faible" aria-hidden="true">▼<\/span>/);
  assert.match(tableau, /<td title="Nécromancie fort contre Sang ; Nécromancie incompatible avec Sang">/, 'deux marques dans une case');
});

test('/wiki/races-et-magies/ n’existe plus et aucune page de magie n’y renvoie', options, () => {
  assert.ok(!existsSync(fileURLToPath(new URL('../dist/wiki/races-et-magies/', import.meta.url))));
  for (const { slug, html } of [{ slug: 'index', html: indexMagies }, ...pages]) assert.ok(!html.includes('races-et-magies'), slug);
});

// Page du Potentiel Illimité (components/magie/SortsDuPotentiel.astro) : il pioche ses sorts dans les autres magies. Une magie par onglet, dans l'ordre
// du classeur ; chaque onglet reprend les tableaux de cette magie du NPM 1 au NPM 4 (demande du propriétaire), avec le gabarit de sa page (TableauNpm.astro).
const ongletsDuPotentiel = () =>
  [...potentiel.matchAll(/<a class="onglet autre-magie__onglet( is-active)?" id="onglet-([^"]+)" href="#(sorts-[^"]+)" style="--couleur-magie: (#[0-9a-f]{6}); --couleur-texte-magie: (#[0-9a-f]{6})">\s*([^<]+?)\s*<\/a>/g)].map(
    (m) => ({ actif: Boolean(m[1]), cle: m[2], panneau: m[3], couleur: m[4], nom: m[6] }),
  );
const panneauxDuPotentiel = () =>
  [...potentiel.matchAll(/<section class="autre-magie magie-teinte( is-active)?" id="(sorts-[^"]+)"[^>]*style="--couleur-magie: (#[0-9a-f]{6});/g)].map((m) => ({
    actif: Boolean(m[1]),
    id: m[2],
    couleur: m[3],
    html: contenu(potentiel, potentiel.lastIndexOf('<section', m.index + 1), 'section'),
  }));
/** Lignes de sort d'un morceau de page : [{ id, html }] (le <tbody> entier : ligne et détails). */
const lignesDeSort = (html) => [...html.matchAll(/<tbody class="sort" id="([^"]+)"/g)].map((m) => ({ id: m[1], html: contenu(html, m.index, 'tbody') }));

test('Potentiel Illimité : 14 onglets, un par autre magie, dans l’ordre du classeur et dans sa couleur, le premier ouvert ; un panneau par onglet', options, () => {
  const onglets = ongletsDuPotentiel();
  assert.deepEqual(onglets.map((o) => o.nom), ORDRE_DU_CLASSEUR);
  assert.deepEqual(onglets.map((o) => o.actif), ORDRE_DU_CLASSEUR.map((_, i) => i === 0), 'seul le premier onglet est ouvert');
  assert.equal(onglets.find((o) => o.nom === 'Feu').couleur, '#ff0000');
  const panneaux = panneauxDuPotentiel();
  assert.deepEqual(panneaux.map((p) => p.id), onglets.map((o) => o.panneau), 'un panneau par onglet, dans le même ordre');
  assert.deepEqual(panneaux.map((p) => p.couleur), onglets.map((o) => o.couleur), 'chaque panneau dans la couleur de sa magie');
  assert.deepEqual(panneaux.map((p) => p.actif), onglets.map((o) => o.actif));
  // dans la section « Sorts » de la page, que la navigation de la page désigne ; les rôles d'onglet sont posés par le script (sans JavaScript : des liens)
  const sorts = contenu(potentiel, potentiel.indexOf('<section class="magie-section" id="sorts"'), 'section');
  assert.match(sorts, /<h2 id="sorts-titre">Sorts des autres magies <span class="count">280<\/span><\/h2>/);
  assert.ok(sorts.includes('<div class="autres-magies" data-onglets="Magies">'));
  assert.match(potentiel, /<a href="#sorts">Sorts<\/a>/);
  assert.doesNotMatch(potentiel, /role="tab(list|panel)?"/);
});

test('Potentiel Illimité : chaque onglet reprend, du NPM 1 au NPM 4, les tableaux de sa magie tels que sur sa page (mêmes lignes, mêmes détails)', options, () => {
  let total = 0;
  for (const panneau of panneauxDuPotentiel()) {
    const cle = panneau.id.slice('sorts-'.length);
    const slug = panneau.html.match(/<h3 class="autre-magie__titre" id="[^"]+"><a href="[^"]*\/magies\/([^/"]+)\/">/)?.[1];
    const page = pages.find((p) => p.slug === slug)?.html;
    assert.ok(page, `${cle} : le titre du panneau mène à la page de sa magie`);
    const niveaux = [...panneau.html.matchAll(/<section class="npm" id="npm-([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(niveaux, [1, 2, 3, 4].map((n) => `${cle}-${n}`), `${cle} : NPM 1 à 4, pas de NPM 5`);
    assert.match(panneau.html, /<h4 class="npm__titre">/, `${cle} : titres des tableaux sous le titre de la magie`);
    // même gabarit : à l'identifiant près (préfixé du nom court de la magie) et au numéro des infobulles, chaque ligne est celle de la page de la magie
    const surSaPage = lignesDeSort(page.slice(page.indexOf('id="npm-1"'), page.indexOf('id="npm-5"')));
    const ici = lignesDeSort(panneau.html);
    assert.equal(ici.length, 20, `${cle} : 5 sorts par NPM`);
    const bulles = (html) => html.replace(/"etat-\d+"/g, '"etat-n"');
    const sansPrefixe = (html) => html.replace(new RegExp(`(id|aria-controls|aria-labelledby)="(sort|detail|fiche)-${cle}-`, 'g'), '$1="$2-');
    assert.deepEqual(ici.map((l) => bulles(sansPrefixe(l.html))), surSaPage.map((l) => bulles(l.html)), `${cle} : lignes reprises de sa page`);
    total += ici.length;
  }
  assert.equal(total, 280);
  assert.ok(!potentiel.includes('class="info"'), 'pas de règle du NPM 5 sur cette page');
  assert.match(potentiel, /<tbody class="sort" id="sort-feu-boule-de-feu">/, 'lien profond vers un sort : #sort-<magie>-<sort>');
});
