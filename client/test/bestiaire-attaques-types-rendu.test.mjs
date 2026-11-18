// Les types de dégâts des attaques sur les cartes de monstre (R288 : afficher le type, lié à son mot-clé ; R299 : tous les types écrits, dans l'ordre de rang ;
// R300 : rien sans type, le texte copié de l'attaque reste affiché) : lib/monstre-rendu.mjs#htmlDeRubrique (rubrique « Dégâts ») et
// lib/bestiaire-rendu.mjs#htmlDeCarteMonstre. Le test construit ses données (carte, types et liens fournis au rendu) : la base n'a pas encore ces types, et le
// texte d'une attaque ou le type d'une valeur de la source ne sont jamais figés ici (R295 : le type d'une attaque est donné par la source, pas par le code).
// La lecture des types dans la base : `bestiaire-attaques-types.test.mjs`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlDeCarteMonstre } from '../src/lib/bestiaire-rendu.mjs';
import { htmlDeRubrique } from '../src/lib/monstre-rendu.mjs';

// des types et un glossaire d'essai (aucune valeur du jeu) : `alpha` et `beta` ont un mot-clé, `gamma` n'en a pas (reste nu), `delta` est celui d'une magie
const liens = {
  degats: { alpha: { cle: 'cle-alpha', texte: null }, beta: { cle: 'cle-beta', texte: null }, delta: { cle: 'magie-delta', texte: 'Delta' }, gamma: null },
  magies: {},
};
const type = (t, libelle = t, magie_id = null) => ({ type: t, libelle, magie_id });

// trois attaques, dont une sans type, et deux lignes qui ne sont pas des attaques (la première, avant elles, ne doit pas décaler le compte)
const texte = ['Arme de la créature : à deux mains', 'Premiere - 1d4 dégâts alpha ou beta', 'Seconde - 2d4 dégâts', 'Troisieme - 3d4 dégâts gamma'].join('\n');
const attaques = [
  { nom: 'Premiere', texte: '1d4 dégâts alpha ou beta', types: [type('alpha'), type('beta')] },
  { nom: 'Seconde', texte: '2d4 dégâts', types: [] },
  { nom: 'Troisieme', texte: '3d4 dégâts gamma', types: [type('gamma')] },
];
const SUITE = /<span class="battaque__types battaque__types--ligne"><span class="muted">Type :<\/span> ([^<]*)<\/span>/g;
const sansLesTypes = (html) => html.replace(/ <span class="battaque__types battaque__types--ligne"><span class="muted">Type :<\/span> [^<]*<\/span>/g, '');
const lignesDuRendu = (html) => html.replace(/^<span class="texte">|<\/span>$/g, '').split('\n');

test('une attaque avec types : ses types à la suite de sa ligne, dans l’ordre de rang, un lien par type lié, « / » entre deux (R299)', () => {
  const lignes = lignesDuRendu(htmlDeRubrique('degats', texte, { attaques, liens }));
  assert.equal(lignes.length, 4, 'une ligne par ligne du texte');
  assert.match(lignes[1], /^Premiere - 1d4 dégâts alpha ou beta <span class="battaque__types/);
  assert.match(lignes[1], /Type :<\/span> \{\{cle-alpha\|Alpha\}\} \/ \{\{cle-beta\|Beta\}\}<\/span>$/, 'alpha puis beta, chacun sa balise du glossaire');
  const inverse = attaques.map((a, k) => (k === 0 ? { ...a, types: [...a.types].reverse() } : a));
  assert.match(htmlDeRubrique('degats', texte, { attaques: inverse, liens }), /\{\{cle-beta\|Beta\}\} \/ \{\{cle-alpha\|Alpha\}\}/, 'l’ordre des types est celui donné (rang)');
});

test('un type sans mot-clé reste nu ; le type d’une magie est lié par son lien (texte du lien)', () => {
  const lignes = lignesDuRendu(htmlDeRubrique('degats', texte, { attaques, liens }));
  assert.match(lignes[3], /Type :<\/span> Gamma<\/span>$/);
  const avecMagie = attaques.map((a, k) => (k === 1 ? { ...a, types: [type('delta', 'delta', 'magies/x')] } : a));
  assert.match(lignesDuRendu(htmlDeRubrique('degats', texte, { attaques: avecMagie, liens }))[2], /Type :<\/span> \{\{magie-delta\|Delta\}\}<\/span>$/);
  const sansLiens = lignesDuRendu(htmlDeRubrique('degats', texte, { attaques, liens: null }));
  assert.match(sansLiens[1], /Type :<\/span> Alpha \/ Beta<\/span>$/, 'sans liens, les libellés nus');
});

test('une attaque sans type n’affiche rien (R300) ; le texte de chaque ligne reste celui écrit', () => {
  const html = htmlDeRubrique('degats', texte, { attaques, liens });
  const lignes = lignesDuRendu(html);
  assert.equal(lignes[0], 'Arme de la créature : à deux mains', 'une ligne qui n’est pas une attaque');
  assert.equal(lignes[2], 'Seconde - 2d4 dégâts', 'une attaque sans type');
  assert.equal([...html.matchAll(SUITE)].length, 2, 'deux attaques sur trois ont des types');
  assert.equal(sansLesTypes(html), htmlDeRubrique('degats', texte), 'sans les types, le rendu est celui d’avant : le texte copié n’est pas réécrit');
  // aucune attaque avec type, ou aucune donnée : exactement le rendu sans types
  const aucun = attaques.map((a) => ({ ...a, types: [] }));
  assert.equal(htmlDeRubrique('degats', texte, { attaques: aucun, liens }), htmlDeRubrique('degats', texte));
  assert.equal(htmlDeRubrique('degats', texte, { attaques: [], liens }), htmlDeRubrique('degats', texte));
  assert.equal(htmlDeRubrique('degats', texte, { attaques: null, liens }), htmlDeRubrique('degats', texte));
});

test('les types ne vont qu’à l’attaque dont le nom et le texte sont ceux de la ligne (une table de détail pas encore refaite ne donne rien)', () => {
  const perimees = attaques.map((a, k) => (k === 0 ? { ...a, texte: 'un autre texte' } : a));
  const html = htmlDeRubrique('degats', texte, { attaques: perimees, liens });
  assert.equal([...html.matchAll(SUITE)].length, 1, 'seule la troisième attaque garde ses types');
  assert.doesNotMatch(lignesDuRendu(html)[1], /battaque__types/);
  // une autre rubrique ne montre jamais de types
  assert.equal(htmlDeRubrique('tactique', texte, { attaques, liens }), htmlDeRubrique('tactique', texte));
});

test('une carte écrite par échelle : les lignes d’attaque simples montrent leurs types, les lignes d’échelle restent telles qu’écrites', () => {
  const parEchelle = ['Premiere - 1d4 dégâts alpha ou beta', 'EP 1 - 5 : 1d6 dégâts', 'EP 6 - 10 : 2d6 dégâts'].join('\n');
  const html = htmlDeRubrique('degats', parEchelle, { attaques, liens });
  assert.match(html, /<span class="bep-ligne texte">Premiere - 1d4 dégâts alpha ou beta <span class="battaque__types[^"]*"><span class="muted">Type :<\/span> \{\{cle-alpha\|Alpha\}\} \/ \{\{cle-beta\|Beta\}\}<\/span><\/span>/);
  assert.equal([...html.matchAll(SUITE)].length, 1, 'les lignes « EP … » n’en ont pas');
  assert.equal(sansLesTypes(html), htmlDeRubrique('degats', parEchelle));
});

test('la carte d’un monstre : la rubrique « Dégâts » montre les types de ses attaques avec les liens fournis, nus sans eux ; sans type, la carte est inchangée', () => {
  const rubriques = [{ rang: 1, rubrique: 'degats', titre: 'Dégâts', texte }];
  const ligne = (carte) => ({
    id: 'monstres/essai#carte:essai', ancre: 'monstre-essai', nom: 'Essai', portrait: null,
    espece: { id: 'monstres/essai', nom: 'Essai', groupe: null, ep: '', description: '', lieu: '', complement: '', lieux: [], blocs: [], butin: [] },
    carte: { nomBrut: 'Essai', description: '', echelle: '1', categorie: 'ennemi_simple', categorieBrut: null, type: '', alignement: '', variable: false, capacites: [], rubriques, ...carte },
  });
  const avec = htmlDeCarteMonstre(ligne({ attaques }), { logo: '/logo.webp', liens });
  assert.equal([...avec.matchAll(SUITE)].length, 2);
  assert.match(avec, /\{\{cle-alpha\|Alpha\}\} \/ \{\{cle-beta\|Beta\}\}/);
  const nu = htmlDeCarteMonstre(ligne({ attaques }), { logo: '/logo.webp' });
  assert.match(nu, /Type :<\/span> Alpha \/ Beta<\/span>/, 'sans liens : libellés nus');
  const sans = htmlDeCarteMonstre(ligne({ attaques: attaques.map((a) => ({ ...a, types: [] })) }), { logo: '/logo.webp', liens });
  assert.equal(sans, sansLesTypes(avec), 'sans type, rien n’est ajouté à la carte');
  assert.doesNotMatch(sans, /battaque__types/);
  // seule la première rubrique « Dégâts » fait foi pour les attaques (lib/monstre-champs.mjs#valeursDeLaCarte)
  const deux = htmlDeCarteMonstre(ligne({ attaques, rubriques: [...rubriques, { rang: 2, rubrique: 'degats', titre: 'Dégâts', texte }] }), { logo: '/logo.webp', liens });
  assert.equal([...deux.matchAll(SUITE)].length, 2);
});

test('une ligne d’attaque précédée d’une forme et d’une échelle (comptée par l’extraction) montre ses types, sans décaler les suivantes', () => {
  const ecrit = ['(Forme) EP 2 - 5 : Premiere - 1d4 dégâts alpha', 'Seconde - 2d4 dégâts beta', 'EP 6 - 10 : 2d6 dégâts'].join('\n');
  const donnees = [
    { nom: '(Forme) EP 2', texte: '5 : Premiere - 1d4 dégâts alpha', types: [type('alpha')] },
    { nom: 'Seconde', texte: '2d4 dégâts beta', types: [type('beta')] },
  ];
  const html = htmlDeRubrique('degats', ecrit, { attaques: donnees, liens });
  assert.match(html, /<span class="bep-ligne" data-eps="2 3 4 5">.*?\{\{cle-alpha\|Alpha\}\}<\/span><\/span>/, 'la ligne d’échelle montre son type');
  assert.match(html, /Seconde - 2d4 dégâts beta <span class="battaque__types[^"]*"><span class="muted">Type :<\/span> \{\{cle-beta\|Beta\}\}/, 'la suivante garde le sien');
  assert.equal([...html.matchAll(SUITE)].length, 2);
  assert.equal(sansLesTypes(html), htmlDeRubrique('degats', ecrit), 'le texte écrit reste le même');
});
