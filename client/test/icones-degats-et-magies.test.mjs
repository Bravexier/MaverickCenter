// Les icônes des types de dégâts et des magies (lib/icones.mjs, styles/global/icones.css), ajoutées à celles des monnaies sur leur modèle (demande du
// propriétaire du 2026-11-14, qui prolonge R235 ; « Liste seulement » : aucune icône n'est posée sur un mot-clé). Le fonctionnement, pas un texte :
// chaque icône a son dessin dans la feuille, chaque icône de magie ou de dégâts porte la classe de palette de sa magie ou de son type (aucune couleur
// écrite ; dégâts : « Couleurs des armes », 2026-11-14), la liste suit les types de dégâts et les magies du site, la faute d'une icône écrite,
// l'aperçu du mode modification garde la classe d'une icône qui n'est pas une monnaie.
//   node --test test/icones-degats-et-magies.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TYPES_DE_DEGATS } from '../src/lib/arme-champs.mjs';
import { FAMILLES_D_ICONES, fauteDeLIcone, icone, ICONES } from '../src/lib/icones.mjs';
import { htmlSur } from '../src/lib/markdown-edition.mjs';
import { MONNAIES_DU_JEU } from '../src/lib/monnaies.mjs';
import { htmlDeLIcone, htmlDuNomDuMotCle } from '../src/lib/mots-cles-balises.mjs';
import { COULEURS_DES_DEGATS } from '../src/lib/equipement-couleurs.mjs';
import { classeDeDegats, classeDeMagie, cssDeLaPalette } from '../src/lib/palette-css.mjs';
import { cleDeMagieConnue, COULEURS_DES_MAGIES } from '../src/lib/sort-format.mjs';

const feuille = (nom) => readFileSync(new URL(`../src/styles/global/${nom}`, import.meta.url), 'utf8');
const icones = feuille('icones.css');
const monnaies = feuille('monnaies.css');
const deLaFamille = (famille) => ICONES.filter((i) => i.famille === famille);
const classes = (i) => i.classe.split(' ');

test('la liste : monnaies, puis dégâts, puis magies ; une valeur « famille:id » unique par icône, ses familles nommées', () => {
  const familles = [...new Set(ICONES.map((i) => i.famille))];
  assert.deepEqual(familles, ['monnaie', 'degats', 'magie']);
  assert.deepEqual(Object.keys(FAMILLES_D_ICONES), familles);
  assert.deepEqual(ICONES.map((i) => i.famille), [...ICONES.map((i) => i.famille)].sort((a, b) => familles.indexOf(a) - familles.indexOf(b)), 'groupées, dans l’ordre');
  assert.equal(new Set(ICONES.map((i) => i.valeur)).size, ICONES.length);
  assert.equal(new Set(ICONES.map((i) => i.libelle)).size, ICONES.length, 'un nom propre à chacune : le menu n’a pas de groupes, il la nomme');
  for (const i of ICONES) {
    assert.equal(i.valeur, `${i.famille}:${i.id}`);
    assert.equal(icone(i.valeur), i);
    assert.ok(i.libelle && i.classe, i.valeur);
  }
  assert.equal(deLaFamille('monnaie').length, Object.keys(MONNAIES_DU_JEU).length, 'les monnaies n’ont pas changé');
  for (const i of deLaFamille('monnaie')) assert.deepEqual(classes(i), ['piece', `piece--${i.id}`]);
});

test('dégâts : une icône par type de dégâts physiques du site, qui porte la classe de palette de son type (« Couleurs des armes », 2026-11-14)', () => {
  const degats = deLaFamille('degats');
  assert.deepEqual(degats.map((i) => i.id), TYPES_DE_DEGATS);
  assert.deepEqual(degats.map((i) => i.id).sort(), Object.keys(COULEURS_DES_DEGATS).sort(), 'une icône par couleur de type de dégâts, ni plus ni moins');
  for (const i of degats) {
    assert.ok(classeDeDegats(i.id), `${i.valeur} : une classe de palette`);
    assert.deepEqual(classes(i), ['icone', 'icone--degats', `icone--degats-${i.id}`, classeDeDegats(i.id)], i.valeur);
  }
});

test('magies : les clés de COULEURS_DES_MAGIES ont chacune leur icône, qui porte la classe de palette de sa magie', () => {
  const magies = deLaFamille('magie');
  assert.deepEqual(magies.map((i) => i.id).sort(), Object.keys(COULEURS_DES_MAGIES).sort(), 'une icône par magie, ni plus ni moins');
  const defaut = classeDeMagie('une magie qui n’existe pas');
  for (const i of magies) {
    assert.ok(classes(i).includes(classeDeMagie(i.id)), `${i.valeur} : la classe de sa magie`);
    assert.notEqual(classeDeMagie(i.id), defaut, `${i.valeur} : pas la couleur par défaut`);
    assert.deepEqual(classes(i).filter((c) => c.startsWith('couleur-')), [classeDeMagie(i.id)], `${i.valeur} : une seule couleur`);
    assert.ok(classes(i).includes('icone') && classes(i).includes('icone--magie') && classes(i).includes(`icone--magie-${i.id}`), i.valeur);
    // le libellé reprend le nom de la magie, que le site retrouve (cleDeMagieConnue : sans casse ni accents)
    assert.match(i.libelle, /^Magie : /);
    assert.equal(cleDeMagieConnue(i.libelle.slice('Magie : '.length)), i.id, `${i.valeur} : le nom de sa magie`);
  }
});

test('la palette des magies et des types de dégâts est sur chaque page (layouts/Base.astro : cssDeLaPalette) : le dessin a sa couleur et son contour partout où un mot-clé s’affiche', () => {
  const palette = cssDeLaPalette();
  for (const i of [...deLaFamille('magie'), ...deLaFamille('degats')]) {
    const classe = classes(i).find((c) => c.startsWith('couleur-'));
    const regle = palette.split('}').find((r) => r.startsWith(`.${classe}{`));
    assert.ok(regle?.includes('--couleur:') && regle.includes('--couleur-texte:'), `${i.valeur} : --couleur et --couleur-texte`);
  }
});

test('la feuille : chaque icône qui n’est pas une monnaie a son dessin (--dessin) ; une monnaie garde le sien dans monnaies.css ; la feuille est importée', () => {
  for (const i of ICONES) {
    if (i.famille === 'monnaie') {
      assert.match(monnaies, new RegExp(`\\.piece--${i.id}\\s*\\{[^}]*background-image: url\\("data:image/svg\\+xml,`), i.valeur);
      continue;
    }
    const classeDuDessin = classes(i).find((c) => c === `icone--${i.famille}-${i.id}`);
    assert.ok(classeDuDessin, `${i.valeur} : sa classe de dessin`);
    assert.match(icones, new RegExp(`\\.${classeDuDessin}\\s*\\{\\s*--dessin: url\\("data:image/svg\\+xml,%3Csvg [^"]+%3C/svg%3E"\\);\\s*\\}`), `${i.valeur} : un dessin dans la feuille`);
  }
  // pas de dessin sans icône (un dessin oublié de la liste ne se choisirait jamais)
  const dessines = [...icones.matchAll(/^\.(icone--[a-z-]+)\s*\{\s*--dessin:/gm)].map((m) => m[1]);
  assert.deepEqual(dessines.sort(), ICONES.filter((i) => i.famille !== 'monnaie').map((i) => `icone--${i.famille}-${i.id}`).sort());
  assert.match(readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8'), /@import '\.\/global\/icones\.css';/);
  assert.doesNotMatch(icones.replace(/\/\*[\s\S]*?\*\//g, ''), /\.piece\b/, '`.piece` est réservée aux monnaies');
});

test('la couleur d’une magie ou d’un type de dégâts vient de la palette : le dessin prend --couleur, son contour --couleur-texte ; aucune couleur écrite dans la feuille', () => {
  // la règle dont la liste de sélecteurs (avant « { ») nomme exactement `selecteur`
  const regle = (selecteur) => icones.replace(/\/\*[\s\S]*?\*\//g, '').split('}').find((r) => r.split('{')[0].split(',').map((x) => x.trim()).includes(selecteur)) ?? '';
  for (const famille of ['degats', 'magie']) {
    assert.match(regle(`.icone--${famille}::before`), /background:\s*var\(--couleur\)/, famille);
    assert.match(regle(`.icone--${famille}`), /filter:[^;]*var\(--couleur-texte\)/, famille);
  }
  assert.doesNotMatch(regle('.icone::before'), /background/, 'le fond vient de la classe de la famille, jamais de la couleur du texte');
  const sansCommentaires = icones.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sansCommentaires, /#[0-9a-f]{3,8}\b|%23[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/i, 'aucune couleur en dur (« Aucune couleur en dur », 2026-10-22)');
});

test('le rendu d’une icône (htmlDeLIcone) : ses classes et son nom en aria-label ; le nom d’un mot-clé la montre', () => {
  for (const i of ICONES) {
    const html = htmlDeLIcone(i.valeur);
    assert.ok(html.includes(`class="${i.classe}"`) || i.famille === 'monnaie', `${i.valeur} : ${html}`);
    assert.match(html, /role="img"/);
    if (i.famille !== 'monnaie') assert.ok(html.includes(`aria-label="${i.libelle}"`), `${i.valeur} : son nom`);
    assert.ok(htmlDuNomDuMotCle({ libelle: 'Essai', icone: i.valeur }).includes(html), `${i.valeur} : après le libellé`);
  }
  assert.equal(htmlDeLIcone('magie:inconnue'), '');
});

test('fauteDeLIcone : accepte chaque icône de la liste et NULL, refuse une icône ou une famille inconnue', () => {
  for (const i of ICONES) assert.equal(fauteDeLIcone(i.valeur), null, i.valeur);
  assert.equal(fauteDeLIcone(null), null);
  assert.equal(fauteDeLIcone(undefined), null);
  for (const x of ['magie:inconnue', 'degats:feu', 'sort:feu', 'feu', 'magie:', ':feu', '', 3, {}]) assert.equal(typeof fauteDeLIcone(x), 'string', String(x));
  assert.ok(fauteDeLIcone('sort:feu').includes('degats:taille') && fauteDeLIcone('sort:feu').includes('magie:feu'), 'le message nomme la liste complète');
});

/** Un élément de l'arbre simple de lib/markdown-edition.mjs (celui que le navigateur tire du DOM). */
const element = (nom, attributs = {}, enfants = []) => ({ type: 'element', nom, attributs, enfants });
/** L'aperçu assaini (htmlSur) d'un paragraphe qui porte un `span` aux attributs donnés, comme l'éditeur du guide le reçoit. */
const apercu = (attributs) => htmlSur([element('p', {}, [{ type: 'texte', valeur: 'Un mot ' }, element('span', attributs)])]);

test('aperçu du mode modification : l’icône d’un type de dégâts ou d’une magie garde sa classe et son nom (comme une monnaie) ; rien d’autre ne passe', () => {
  for (const i of ICONES) {
    const sortie = apercu({ class: i.classe, role: 'img', 'aria-label': i.libelle, ...(i.famille === 'monnaie' ? { 'data-monnaie': 'RO' } : {}) });
    assert.ok(sortie.includes(`class="${i.classe}"`), `${i.valeur} : ${sortie}`);
    if (i.famille !== 'monnaie') assert.ok(sortie.includes(`aria-label="${i.libelle}"`) && sortie.includes('role="img"'), i.valeur);
  }
  const [dessin] = ICONES.filter((i) => i.famille === 'magie');
  // la classe et le nom sont recalculés d'après la liste : ni classe en trop, ni nom reçu, ni attribut d'événement
  const forge = apercu({ class: `${dessin.classe} autre-classe`, 'aria-label': 'faux nom', onclick: 'x()', style: 'color:red' });
  assert.ok(forge.includes(`class="${dessin.classe}"`) && forge.includes(`aria-label="${dessin.libelle}"`), forge);
  assert.doesNotMatch(forge, /autre-classe|faux nom|onclick|style=/);
  // une classe incomplète (sans celle du dessin) n'est pas une icône : elle n'est pas gardée
  assert.doesNotMatch(apercu({ class: 'icone icone--magie' }), /class=/);
  assert.doesNotMatch(apercu({ class: `icone--magie-${dessin.id} couleur-magie-${dessin.id}` }), /class=/);
});
