// Le site construit sert une page renommée à sa nouvelle adresse (décision R316, « l'adresse d'une page suit son titre » ; colonne page.slug_adresse,
// migration 0133) : l'état des segments renommés est installé par le build (lib/wiki.ts) et par la configuration d'Astro (deux graphes de modules, qui ne
// partagent pas l'état), la route des pages tire son paramètre du segment, la page 404 renvoie les anciennes adresses, le tableau des métiers garde les
// anciennes ancres, les liens d'un don et des `[[liens]]` passent par l'identifiant de la page, et chaque page porte la liste des segments renommés pour les
// scripts du navigateur (`#adresses-renommees`). Sans build : le source des fichiers .astro et .ts, et les fonctions pures.
//   node --test test/adresses-du-site.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { installerLesAdresses, jsonDesAdressesRenommees } from '../src/lib/adresses-renommees.mjs';
import { htmlDeDon } from '../src/lib/classe-dons-rendu.mjs';
import { entryUrl } from '../src/lib/wikilinks-remark.mjs';

const source = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

afterEach(() => installerLesAdresses([]));

test('lib/wiki.ts installe les segments renommés de la base juste après le plan, et slugOf rend le segment de l’adresse (R316)', () => {
  const wiki = source('../src/lib/wiki.ts');
  assert.match(wiki, /^installerLePlan\(chargerPlanDesRegles\(ouvrirBase\(\)\)\);\n(?:\/\/.*\n)*installerLesAdresses\(slugsDAdresse\(ouvrirBase\(\)\)\);$/m);
  assert.match(wiki, /^import \{ installerLesAdresses \} from '\.\/adresses-renommees\.mjs';$/m);
  assert.match(wiki, /^import \{ slugsDAdresse \} from '\.\/adresses-db\.mjs';$/m);
  assert.match(wiki, /^export const slugOf = \(entry: WikiEntry\) => segmentDePage\(entry\.id\);$/m);
  // la clé de l'index des [[liens]] reste le slug de l'identifiant (entryUrl refait l'id par `<type>/<slug>`), jamais le segment renommé
  assert.match(wiki, /^export const idSlugOf = \(entry: WikiEntry\) => entry\.id\.split\('\/'\)\[1\];$/m);
  assert.match(wiki, /slug: idSlugOf\(e\)/);
  assert.doesNotMatch(wiki, /slug: slugOf\(e\)/);
  assert.match(source('../src/lib/guide-rendu.ts'), /slug: idSlugOf\(e\)/);
  assert.doesNotMatch(source('../src/lib/guide-rendu.ts'), /slug: slugOf\(e\)/);
});

test('astro.config.mjs installe les mêmes segments avant de lire l’index des [[liens]] : l’état n’est pas partagé avec les pages (R316)', () => {
  const config = source('../astro.config.mjs');
  const installe = config.indexOf('installerLesAdresses(slugsDAdresse(ouvrirBase()));');
  const lit = config.indexOf('buildIndex(scanContent(');
  assert.ok(installe > 0 && lit > installe, 'installerLesAdresses avant scanContent');
  assert.match(config, /^import \{ installerLesAdresses \} from '\.\/src\/lib\/adresses-renommees\.mjs';$/m);
  assert.match(config, /^import \{ slugsDAdresse \} from '\.\/src\/lib\/adresses-db\.mjs';$/m);
  assert.match(config, /^import \{ ouvrirBase \} from '\.\/src\/lib\/donnees\.mjs';$/m);
});

test('la route des pages tire son segment de slugOf et ne sert que les pages servies à leur id (estServieASonId, R316)', () => {
  const route = source('../src/pages/[type]/[slug].astro');
  assert.match(route, /entries\.filter\(\(entry\) => estServieASonId\(entry\.id\)\)/);
  assert.match(route, /params: \{ type: typeOf\(entry\), slug: slugOf\(entry\) \}/);
  assert.doesNotMatch(route, /entry\.id\.split/);
});

test('la page 404 reçoit les anciennes adresses des pages renommées (page_ancienne_adresse) avec les renvois du guide (R316)', () => {
  const page404 = source('../src/pages/404.astro');
  assert.match(page404, /import \{ anciennesAdresses \} from '\.\.\/lib\/adresses-db\.mjs';/);
  assert.match(page404, /import \{ ouvrirBase \} from '\.\.\/lib\/donnees\.mjs';/);
  assert.match(page404, /const renvois = renvoisDuGuide\(ids, anciennesAdresses\(ouvrirBase\(\)\)\);/);
});

test('le tableau des métiers porte les anciennes ancres de chaque ligne et son script ouvre la ligne pour une ancienne ancre (R316, décision 4)', () => {
  const tableau = source('../src/components/metier/MetiersTableau.astro');
  // un élément d'id égal à l'ancienne ancre, dans la ligne principale (la ligne de détail est cachée : l'adresse n'y défilerait pas)
  assert.match(tableau, /m\.anciennesAncres\.map\(\(ancienne\) => <span class="metier__ancienne-ancre" id=\{ancienne\}><\/span>\)/);
  const ligne = tableau.slice(tableau.indexOf('<tr class="metier__main">'), tableau.indexOf('<tr class="metier__detail"'));
  assert.ok(ligne.includes('m.anciennesAncres.map'), 'dans la ligne principale');
  // le script retrouve la ligne par l'élément de l'adresse, ancre d'aujourd'hui (la ligne même) ou ancienne (son élément)
  assert.match(tableau, /document\.getElementById\(id\)\?\.closest<HTMLElement>\('tbody\.metier'\)/);
  assert.doesNotMatch(tableau, /lignes\(\)\.find\(\(l\) => l\.id === id\)/);
});

test('l’adresse d’un don par défaut est celle de sa page : le segment renommé, jamais le slug de son identifiant (R316)', () => {
  const don = { id: 'capacites/essai-a-b', slug: 'essai-a-b', ancre: 'don-essai-a-b', niveau: 1, nom: 'Essai', precision: '', effet: [], remarque: [] };
  assert.match(htmlDeDon(don, { base: '/site/' }), /<a href="\/site\/capacites\/essai-a-b\/">Essai<\/a>/);
  installerLesAdresses([['capacites/essai-a-b', 'essai-a-c']]);
  const html = htmlDeDon(don, { base: '/site/' });
  assert.match(html, /<a href="\/site\/capacites\/essai-a-c\/">Essai<\/a>/);
  assert.doesNotMatch(html, /essai-a-b\/"/);
});

test('l’adresse d’un [[lien]] passe par l’identifiant de la page : une page renommée est liée à son segment (R316)', () => {
  const entree = { type: 'capacites', slug: 'essai-a-b' }; // l'index garde le slug de l'identifiant (lib/wiki.ts#idSlugOf)
  assert.equal(entryUrl('/site/', entree), '/site/capacites/essai-a-b/');
  installerLesAdresses([['capacites/essai-a-b', 'essai-a-c']]);
  assert.equal(entryUrl('/site/', entree), '/site/capacites/essai-a-c/');
});

test('layouts/Base.astro écrit la liste des segments renommés dans chaque page, et rien quand aucune page n’est renommée (R316)', () => {
  const base = source('../src/layouts/Base.astro');
  assert.match(base, /import \{ jsonDesAdressesRenommees \} from '\.\.\/lib\/adresses-renommees\.mjs';/);
  assert.match(base, /const adressesRenommees = jsonDesAdressesRenommees\(\);/);
  assert.match(base, /\{adressesRenommees && <script is:inline type="application\/json" id="adresses-renommees" set:html=\{adressesRenommees\}><\/script>\}/);
  assert.equal(jsonDesAdressesRenommees(), null);
  installerLesAdresses([]);
  assert.equal(jsonDesAdressesRenommees(), null);
});

test('jsonDesAdressesRenommees : l’objet { id: segment }, sans « < » qui fermerait la balise, relu tel quel par le navigateur (R316)', () => {
  installerLesAdresses([['races/a', 'a-renommee'], ['capacites/b-c', 'b-d'], ['classes/piege', '</script><b>']]);
  const json = jsonDesAdressesRenommees();
  assert.ok(!json.includes('<'), 'aucun « < » dans le JSON inséré en HTML');
  assert.deepEqual(JSON.parse(json), { 'races/a': 'a-renommee', 'capacites/b-c': 'b-d', 'classes/piege': '</script><b>' });
  installerLesAdresses([]);
  assert.equal(jsonDesAdressesRenommees(), null);
});
