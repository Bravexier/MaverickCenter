// Métiers (lib/metiers.mjs) : plus de page par métier, un long tableau sur /metiers/ (demande du propriétaire) ; tout lien vers un métier mène à sa ligne.
//   node --test test/metiers.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { adresseDePage, ancreDeMetier, chargerMetiers, cheminDePage, estUnMetier, PAGE_DES_REGLES } from '../src/lib/metiers.mjs';
import { buildIndex, entryUrl } from '../src/lib/wikilinks.mjs';

const db = ouvrirBase({ sansExemples: false });
const metiers = chargerMetiers(db);
const ligneBrute = new Map(db.prepare('SELECT * FROM metier').all().map((m) => [m.id, m]));
// le site de dev est la source des métiers qu'il modifie (décision du propriétaire) : les exemples cités sont ceux de l'import (lib/historique-site.mjs),
// vérifiés sur la page tant que le site n'a pas réécrit la colonne
const historique = historiqueSite(db);
const dImport = (id, colonne) => historique.valeurDImport('metier', { id }, colonne);
const intact = (id, colonne) => !historique.modifiee('metier', { id }, colonne);

test('un métier est une page du type metiers, sauf la page des règles', () => {
  assert.equal(estUnMetier('metiers/forgeron'), true);
  assert.equal(estUnMetier(PAGE_DES_REGLES), false);
  assert.equal(estUnMetier('races/elfe'), false);
  assert.equal(estUnMetier('guide/metiers'), false);
});

test('un lien vers un métier mène à sa ligne du tableau ; les autres pages gardent leur adresse', () => {
  assert.equal(ancreDeMetier('metiers/ange-gardien'), 'metier-ange-gardien');
  assert.deepEqual(adresseDePage('metiers/forgeron'), { chemin: 'metiers/', ancre: 'metier-forgeron' });
  assert.equal(cheminDePage('metiers/forgeron'), 'metiers/#metier-forgeron');
  assert.deepEqual(adresseDePage(PAGE_DES_REGLES), { chemin: `${PAGE_DES_REGLES}/`, ancre: '' });
  assert.equal(cheminDePage('races/elfe'), 'races/elfe/');
});

test('les [[liens]] vers un métier mènent à sa ligne, préfixe de déploiement compris', () => {
  const index = buildIndex([
    { id: 'metiers/mineur', type: 'metiers', slug: 'mineur', title: 'Mineur', aliases: [] },
    { id: PAGE_DES_REGLES, type: 'metiers', slug: PAGE_DES_REGLES.split('/')[1], title: 'Règles des métiers', aliases: [] },
  ]);
  assert.equal(entryUrl('/', index.byId.get('metiers/mineur')), '/metiers/#metier-mineur');
  assert.equal(entryUrl('/MaverickCenter/', index.byId.get('metiers/mineur')), '/MaverickCenter/metiers/#metier-mineur');
  assert.equal(entryUrl('/', index.byId.get(PAGE_DES_REGLES)), `/${PAGE_DES_REGLES}/`);
});

test('les métiers sont exactement les lignes de la table metier ; la page des règles existe et n’en est pas une', () => {
  const pages = db.prepare("SELECT id FROM page WHERE type = 'metiers' ORDER BY id").all().map((p) => p.id);
  assert.ok(pages.includes(PAGE_DES_REGLES), 'page des règles absente');
  assert.deepEqual(pages.filter(estUnMetier), [...ligneBrute.keys()].sort());
});

test('72 métiers (à l’import), par ordre alphabétique, chacun avec son ancre unique et sa description', () => {
  assert.equal(historique.effectifDImport('metier'), 72);
  assert.equal(metiers.length, ligneBrute.size);
  const cles = metiers.map((m) => ligneBrute.get(m.id).nom_cle);
  assert.deepEqual(cles, [...cles].sort());
  assert.equal(new Set(metiers.map((m) => m.ancre)).size, metiers.length);
  for (const m of metiers) assert.ok(m.description.length > 0, `${m.id} : description`);
});

test('les colonnes redonnent les champs de la source, sans rien réécrire', () => {
  for (const m of metiers) {
    const brut = ligneBrute.get(m.id);
    assert.equal(m.nom, brut.nom);
    // Bonus : un rang par ligne ; joints par « , », ils redonnent le champ entier
    assert.equal(m.bonus.join(', '), brut.bonus_brut, `${m.id} : bonus`);
    // Artisanat : texte avant le crochet, puis les caractéristiques du crochet (doubles espaces réduits) ; « Rien » : aucun
    const artisanat = m.artisanat ? `${m.artisanat.texte}${m.artisanat.test ? ` [${m.artisanat.test}]` : ''}` : 'Rien';
    assert.equal(artisanat, brut.artisanat_brut.replace(/\s+/g, ' '), `${m.id} : artisanat`);
    assert.equal(m.equipement ?? 'Rien', brut.equipement_brut, `${m.id} : équipement`);
    assert.equal(m.description, brut.description);
  }
  assert.equal(dImport('metiers/forgeron', 'artisanat_brut').replace(/\s+/g, ' '), 'Peut faire des armes métalliques [FORCE + VOLONTÉ]');
  if (intact('metiers/forgeron', 'artisanat_brut')) {
    assert.deepEqual(metiers.find((m) => m.id === 'metiers/forgeron').artisanat, { texte: 'Peut faire des armes métalliques', test: 'FORCE + VOLONTÉ' });
  }
  assert.equal(dImport('metiers/coursier', 'bonus_brut'), '+1 INI, +2% Athlétisme OU Équilibre');
  if (intact('metiers/coursier', 'bonus_brut')) assert.deepEqual(metiers.find((m) => m.id === 'metiers/coursier').bonus, ['+1 INI', '+2% Athlétisme OU Équilibre']);
  assert.equal(dImport('metiers/acrobate', 'equipement_brut'), 'Rien');
  if (intact('metiers/acrobate', 'equipement_brut')) assert.equal(metiers.find((m) => m.id === 'metiers/acrobate').equipement, null);
});

test('avantage possible : gardé, sauf vide ou réduit à « … »', () => {
  for (const m of metiers) {
    const brut = ligneBrute.get(m.id).avantage_brut;
    assert.equal(m.avantage, brut && brut.trim() !== '…' ? brut : null, m.id);
  }
  assert.equal(dImport('metiers/forgeron', 'avantage_brut'), 'Identifier une arme, …');
  if (intact('metiers/forgeron', 'avantage_brut')) assert.equal(metiers.find((m) => m.id === 'metiers/forgeron').avantage, 'Identifier une arme, …');
  assert.ok([null, '', '…'].includes(dImport('metiers/assassin', 'avantage_brut')?.trim() ?? null), 'à l’import : vide ou « … »');
  if (intact('metiers/assassin', 'avantage_brut')) assert.equal(metiers.find((m) => m.id === 'metiers/assassin').avantage, null);
});
