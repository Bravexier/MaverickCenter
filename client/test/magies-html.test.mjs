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
// pages rendues par le gabarit (la magie d'exemple, sans ligne dans la base, garde le rendu Markdown)
const pages = present
  ? readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ slug: d.name, html: readFileSync(join(dossier, d.name, 'index.html'), 'utf8') }))
      .filter((p) => p.html.includes('class="magie-hero"'))
  : [];
const avecSorts = pages.filter((p) => p.html.includes('class="sorts"'));

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

test('règle spéciale du NPM 5 : une seule pastille « i », dans le titre du tableau du NPM 5, et plus d’encart sous le tableau', options, () => {
  for (const { slug, html } of avecSorts) {
    const infos = [...html.matchAll(/class="info"/g)].length;
    assert.equal(infos, 1, `${slug} : une pastille « i »`);
    const npm5 = html.slice(html.indexOf('id="npm-5"'));
    assert.ok(npm5.indexOf('class="info"') > 0 && npm5.indexOf('class="info"') < npm5.indexOf('class="sorts-wrap"'), `${slug} : la pastille est dans le titre du tableau 5`);
    assert.ok(!html.includes('magie-regle'), `${slug} : plus d'encart de règle sous le tableau`);
  }
});

test('retirés à la demande du propriétaire : pastilles Remarque / Texte, légende, source par sort et en pied de page, créatures qui lancent le sort, « voir la page »', options, () => {
  for (const { slug, html } of pages) {
    for (const interdit of ['magie-legende', 'Légende', 'Source :', 'sort-detail__source', 'Créatures qui lancent', 'Voir la page', '<h2>Sources</h2>', '<h5>Remarque</h5>', '<h5>Texte du sort</h5>', '<h5>Effets secondaires</h5>', 'title="Remarque du classeur"', 'title="Texte du sort"']) {
      assert.ok(!html.includes(interdit), `${slug} : « ${interdit} » est revenu`);
    }
  }
});

test('panneau d’un sort : un seul cadre « Effets » par sort, les règles d’invocation et l’annexe sont repliées par défaut', options, () => {
  for (const { slug, html } of avecSorts) {
    assert.equal([...html.matchAll(/<h5>Effets<\/h5>/g)].length, 23, `${slug} : 23 cadres « Effets »`);
    assert.doesNotMatch(html, /<details[^>]*\sopen\b/, `${slug} : un <details> est ouvert par défaut`);
  }
  const necro = pages.find((p) => p.slug === 'magie-de-la-necromancie').html;
  assert.match(necro, /<summary>Règles de l’invocation<\/summary>/);
  assert.match(necro, /<summary>TABLEAU &quot;AMELIORATION CADAVERIQUE&quot;<\/summary>/);
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
