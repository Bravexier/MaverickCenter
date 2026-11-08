// Le tableau des mots-clés du Glossaire (/regles/glossaire/ ; décision R234 : « un tableau dans le même style que les autres (avec la couleur en liserai
// comme pour les armes si définie) », les noms, la catégorie, le lien, la liste des pages qui référencent le mot-clé ; la définition dans une ligne en
// plus) : la ligne d'un mot-clé (lib/mots-cles-balises.mjs#htmlDeLaLigneDuGlossaire) — ses colonnes, son liseré, le menu de ses pages (ses mentions,
// R196 : pagesDesMentions), la ligne de sa définition — ; la page de chaque lien (lib/mots-cles-db.mjs#pagesDesLiens, réponse T5 : le titre de la page) et
// le menu de chaque mot-clé lus dans la base ; la feuille de la page (le gabarit commun, la ligne colorée). Des mots-clés d'essai pour le rendu ; sur la
// base, des invariants (aucun texte figé).
//   node --test test/glossaire-tableau.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { mentionsDesMotsCles } from '../src/lib/mentions-des-mots-cles.mjs';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { htmlAvecMonnaies, htmlDePiece } from '../src/lib/monnaies.mjs';
import { COLONNES_DU_GLOSSAIRE, htmlDeLaLigneDuGlossaire, libellesDesCategories, pagesDesMentions } from '../src/lib/mots-cles-balises.mjs';
import { categoriesDesMotsCles, chargerVocabulaire, pagesDesLiens } from '../src/lib/mots-cles-db.mjs';
import { classeDuMotCle } from '../src/lib/mots-cles-liens.mjs';
import { el } from './aide-faux-dom.mjs';

const CATEGORIES = [{ id: 1, libelle: 'Règles' }, { id: 3, libelle: 'Race' }, { id: 6, libelle: 'Classe' }];
const PAGE = (id, titre, comment = 'balise', exemple = false) => ({ table: comment === 'etiquette' ? 'page_tag' : 'page', cle: { id }, colonne: 'x', comment, page: { id, titre }, libelle: titre, exemple });
const ELFE = {
  id: 7, cle: 'elfe', libelle: 'Elfe', synonymes: ['Elfes', 'Sylvain'], categories: [6, 3], description: 'Un peuple, {{nain|voisin}} des nains ; 10 RO.',
  url: '/races/elfe/', couleur: 'race:pure', lien: { page: 'races/elfe', titre: 'Les Elfes' },
  mentions: [PAGE('races/elfe', 'Elfe', 'etiquette'), PAGE('races/elfe', 'Elfe'), PAGE('metiers/forgeron', 'Forgeron'),
    { table: 'evenement_extrait', cle: { evenement_id: 'x', ordre: 1 }, colonne: 'texte', comment: 'balise', page: null, libelle: 'Chronologie › La chute', exemple: false },
    PAGE('exemples/demo', 'Démo', 'balise', true)],
};
/** La ligne rendue, relue comme un navigateur (un <tbody> dans une table). */
const ligne = (m, options = { base: '/M/', categories: CATEGORIES }) => {
  const t = el('table');
  t.innerHTML = htmlDeLaLigneDuGlossaire(m, options);
  assert.equal(t.children.length, 1, 'un seul <tbody> par mot-clé');
  return t.children[0];
};

test('R234 (2), (3), R235 (2) : les colonnes — l’icône en premier, noms, catégories, lien, pages — puis la ligne de la définition sur toute la largeur, dans un <tbody> par mot-clé', () => {
  assert.deepEqual([...COLONNES_DU_GLOSSAIRE], ['Icône', 'Mot-clé', 'Catégories', 'Lien', 'Pages']);
  const t = ligne(ELFE);
  assert.equal(t.tagName, 'TBODY');
  assert.ok(t.classList.contains('glossaire-mot'));
  assert.deepEqual(t.children.map((tr) => tr.className.split(' ')[0]), ['glossaire-mot__ligne', 'glossaire-mot__suite']);
  const [principale, suite] = t.children;
  assert.deepEqual(principale.children.map((c) => [c.tagName, c.className]),
    [['TD', 'glossaire-mot__icone'], ['TH', 'glossaire-mot__noms'], ['TD', 'glossaire-mot__categories'], ['TD', 'glossaire-mot__lien'], ['TD', 'glossaire-mot__pages']]);
  assert.equal(principale.children[1].getAttribute('scope'), 'row');
  assert.equal(principale.children.length, COLONNES_DU_GLOSSAIRE.length, 'une case par colonne');
  assert.equal(suite.children.length, 1);
  assert.equal(suite.children[0].getAttribute('colspan'), String(COLONNES_DU_GLOSSAIRE.length), 'toute la largeur (réponse T3)');
  // ce que lisent les filtres et l'éditeur
  assert.deepEqual({ ...Object.fromEntries(['id', 'cle', 'n', 'libelle', 'synonymes', 'categories', 'definition', 'url', 'couleur'].map((k) => [k, t.dataset[k]])) },
    { id: '7', cle: 'elfe', n: '3', libelle: 'Elfe', synonymes: '["Elfes","Sylvain"]', categories: '[3,6]', definition: ELFE.description, url: '/races/elfe/', couleur: 'race:pure' });
});

test('R234 (2), R233 (8), (9), R235 (2) : les noms — le libellé seul, puis « Aussi appelé : » ses synonymes ; l’icône seule dans sa colonne ; les catégories nommées dans l’ordre de leur id', () => {
  const noms = ligne(ELFE).querySelector('.glossaire-mot__noms');
  assert.equal(noms.querySelector('.glossaire-mot__nom').textContent, 'Elfe');
  assert.equal(noms.querySelector('.glossaire-mot__synonymes').textContent, 'Aussi appelé : Elfes, Sylvain');
  assert.equal(ligne({ ...ELFE, synonymes: [] }).querySelector('.glossaire-mot__synonymes'), null, 'sans synonyme : rien');
  const ro = ligne({ id: 8, cle: 'ricken-dor', libelle: 'Ricken d’or', monnaie_id: 'ro', icone: 'monnaie:ro', synonymes: ['RO'] });
  const piece = el('div');
  piece.innerHTML = htmlDePiece('RO');
  assert.equal(ro.querySelector('.glossaire-mot__icone').innerHTML, piece.innerHTML, 'l’icône seule, dans la première colonne (R235 (2))');
  assert.equal(ro.querySelector('.glossaire-mot__nom').innerHTML, 'Ricken d’or', 'le nom : le libellé seul');
  assert.equal(ro.querySelector('.glossaire-mot__synonymes'), null, 'l’abréviation de sa monnaie n’est pas un « Aussi appelé » (R234 (8), R235 (4))');
  assert.equal(ligne(ELFE).querySelector('.glossaire-mot__icone').innerHTML, '', 'sans icône : la case vide');
  assert.equal(ligne(ELFE).querySelector('.glossaire-mot__categories').textContent, 'Race, Classe', 'R232 (5) : dans l’ordre de leur id');
  assert.deepEqual(libellesDesCategories([6, 3, 99], new Map([[3, 'Race'], [6, 'Classe']])), ['Race', 'Classe'], 'une catégorie inconnue : rien');
  assert.equal(ligne({ ...ELFE, categories: [] }).querySelector('.glossaire-mot__categories .glossaire-mot__vide').textContent, '—');
});

test('R234 (2), réponse T5 : la colonne Lien — le titre de la page où mène l’adresse, en lien (préfixé de la base du site) ; sinon l’adresse brute ; sans adresse, rien', () => {
  const a = ligne(ELFE).querySelector('.glossaire-mot__lien a');
  assert.equal(a.href, '/M/races/elfe/');
  assert.equal(a.textContent, 'Les Elfes');
  assert.equal(a.dataset.page, 'races/elfe');
  const brute = ligne({ ...ELFE, url: '/fiche/', lien: null }).querySelector('.glossaire-mot__lien a');
  assert.equal(brute.textContent, '/fiche/', 'une route sans page : l’adresse brute');
  assert.equal(brute.href, '/M/fiche/');
  assert.ok(brute.classList.contains('glossaire-mot__adresse'));
  assert.equal(ligne({ ...ELFE, url: null, lien: null }).querySelector('.glossaire-mot__lien a'), null);
});

test('R234 (3), réponses T2 et « Seulement les pages » : le menu des pages qui mentionnent le mot-clé (R196 : étiquettes et balises) — une ligne par page où l’on peut aller, sans doublon, leur total au résumé ; sans page, « Aucune page »', () => {
  assert.deepEqual(pagesDesMentions(ELFE.mentions), [
    { libelle: 'Elfe', page: 'races/elfe', exemple: false },
    { libelle: 'Forgeron', page: 'metiers/forgeron', exemple: false },
    { libelle: 'Chronologie › La chute', page: null, exemple: false },
    { libelle: 'Démo', page: 'exemples/demo', exemple: true },
  ], 'l’étiquette et la balise d’une même page : une ligne');
  assert.equal(pagesDesMentions(undefined), null);
  const menu = ligne(ELFE).querySelector('details.glossaire-mot__menu');
  assert.equal(menu.querySelector('summary').textContent, '3 pages', 'le total ne compte que les pages');
  const items = menu.querySelectorAll('li');
  assert.deepEqual(items.map((li) => li.textContent), ['Elfe', 'Forgeron', 'Démo'], 'un texte qu’aucune page ne montre n’y est pas');
  assert.deepEqual(items.map((li) => li.querySelector('a')?.href ?? null), [`/M/${cheminDePage('races/elfe')}`, `/M/${cheminDePage('metiers/forgeron')}`, `/M/${cheminDePage('exemples/demo')}`],
    'chaque page en lien (un métier, à sa ligne de /metiers/)');
  assert.ok(items[2].hasAttribute('data-exemple'));
  assert.equal(ligne({ ...ELFE, mentions: [PAGE('races/elfe', 'Elfe')] }).querySelector('summary').textContent, '1 page');
  for (const mentions of [[], ELFE.mentions.filter((x) => !x.page)]) {
    const aucune = ligne({ ...ELFE, mentions }).querySelector('.glossaire-mot__pages');
    assert.equal(aucune.querySelector('details'), null);
    assert.equal(aucune.textContent, 'Aucune page', 'sans mention, ou seulement des textes sans page');
  }
});

test('R234 (3), réponse T3 : la définition, dans sa ligne — ses balises gardées (le middleware les rend), ses monnaies en icônes (R63) ; sans définition, « Pas encore de définition. »', () => {
  const definition = ligne(ELFE).querySelector('.glossaire-mot__definition');
  const attendue = el('div');
  attendue.innerHTML = htmlAvecMonnaies(ELFE.description);
  assert.equal(definition.innerHTML, attendue.innerHTML);
  assert.ok(definition.textContent.includes('{{nain|voisin}}'), 'la balise, rendue ensuite par le middleware');
  assert.ok(definition.querySelector('.piece.piece--ro'));
  const vide = ligne({ ...ELFE, description: null }).querySelector('.glossaire-mot__definition');
  assert.ok(vide.classList.contains('glossaire-mot__definition--vide'));
  assert.equal(vide.textContent, 'Pas encore de définition.');
});

test('R234 (1) : la couleur du mot-clé en liseré, comme les armes — ses deux lignes sont des lignes colorées du gabarit (`ligne-couleur` et la classe de sa couleur) ; sans couleur, aucune', () => {
  const t = ligne(ELFE);
  for (const tr of t.children) assert.ok(tr.classList.contains('ligne-couleur') && tr.classList.contains(classeDuMotCle(ELFE)), tr.className);
  const ecrite = ligne({ ...ELFE, couleur: '#12ab9f' });
  assert.ok(ecrite.children.every((tr) => tr.classList.contains(`couleur-mot-cle-${ELFE.id}`)), 'une couleur écrite : couleur-mot-cle-<id>');
  assert.ok(ligne({ ...ELFE, couleur: null }).children.every((tr) => !tr.className.includes('couleur')), 'sans couleur : pas de liseré');
  // la feuille de la page : la ligne colorée du gabarit lit --ligne-fond et --ligne-texte, tirés de la classe de la couleur (--couleur, --couleur-texte) ;
  // aucune couleur écrite (skill ui-couleurs) ; la ligne de la définition prolonge celle du mot-clé
  const css = readFileSync(new URL('../src/styles/glossaire/glossaire.css', import.meta.url), 'utf8');
  assert.match(css, /\.glossaire-mot > tr \{ --ligne-fond: var\(--couleur\); --ligne-texte: var\(--couleur-texte\); \}/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{3,6}\b|rgb\(/i, 'aucune couleur écrite');
  const page = readFileSync(new URL('../src/pages/regles/glossaire.astro', import.meta.url), 'utf8');
  assert.match(page, /<Tableau [^>]*classeTable="glossaire-table"/, 'le gabarit commun des tableaux (components/Tableau.astro)');
});

test('R234 (3), (2), sur la base : chaque mot-clé a ses pages (ses mentions, R196), et le titre de la page où mène son adresse (une page de la base, sinon aucune)', () => {
  const db = ouvrirBase();
  const vocabulaire = chargerVocabulaire(db);
  const liens = pagesDesLiens(db, vocabulaire);
  const index = indexDesAdresses(db);
  const titres = new Map(db.prepare('SELECT id, titre FROM page').all().map((p) => [p.id, p.titre]));
  assert.deepEqual([...liens.keys()].sort((a, b) => a - b), vocabulaire.filter((m) => m.url).map((m) => m.id).sort((a, b) => a - b), 'un par mot-clé à adresse');
  for (const m of vocabulaire.filter((x) => x.url)) {
    const page = pageDeLAdresse(index, m.url);
    assert.deepEqual(liens.get(m.id), page && titres.has(page) ? { page, titre: titres.get(page) } : null, `${m.cle} : ${m.url}`);
  }
  // le menu : les mentions de R196, une ligne par page ; la ligne rendue les montre toutes
  const mentions = mentionsDesMotsCles(db, vocabulaire.map((m) => m.id));
  const categories = categoriesDesMotsCles(db);
  for (const m of vocabulaire.slice(0, 40)) {
    const t = ligne({ ...m, mentions: mentions.get(m.id), lien: liens.get(m.id) ?? null }, { base: '/', categories });
    const attendues = pagesDesMentions(mentions.get(m.id)).filter((x) => x.page !== null);
    assert.equal(t.dataset.n, String(attendues.length), m.cle);
    assert.deepEqual(t.querySelectorAll('.glossaire-mot__menu li').map((li) => li.textContent), attendues.map((x) => x.libelle), m.cle);
    assert.equal(t.querySelector('.glossaire-mot__categories').textContent, libellesDesCategories(m.categories, categories).join(', ') || '—', m.cle);
  }
});
