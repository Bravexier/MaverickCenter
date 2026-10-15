// Métiers (lib/metiers.mjs) : plus de page par métier, un long tableau sur /metiers/ (demande du propriétaire) ; tout lien vers un métier mène à sa ligne.
//   node --test test/metiers.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { adresseDePage, ancreDeMetier, chargerMetiers, cheminDePage, estUnMetier, PAGE_DES_REGLES, pageSansAdresse } from '../src/lib/metiers.mjs';
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
  // la page « Bouclier » est l'onglet Boucliers de la page des armures (demande du propriétaire, 2026-10-15) : elle n'est pas construite
  assert.equal(cheminDePage('ressources/bouclier'), 'ressources/armures/#boucliers');
  assert.equal(pageSansAdresse('ressources/bouclier'), true);
  assert.equal(pageSansAdresse('ressources/armures'), false);
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
    assert.deepEqual(m.ligne, { ...brut }, `${m.id} : la ligne de la table, telle quelle (cellules : lib/edition-rendu.mjs)`);
    // Bonus : un rang par élément ; leurs textes joints par « , » redonnent le champ entier
    assert.equal(m.bonus.map((b) => b.texte).join(', '), brut.bonus_brut, `${m.id} : bonus`);
    // Artisanat : texte avant le crochet, puis le crochet (doubles espaces réduits) ; « Rien » : aucun
    const artisanat = m.artisanat ? `${m.artisanat.texte}${m.artisanat.test ? ` [${m.artisanat.test}]` : ''}` : 'Rien';
    assert.equal(artisanat, brut.artisanat_brut.replace(/\s+/g, ' '), `${m.id} : artisanat`);
    // Objets de départ : leurs textes, les options d'un choix jointes par « OU », redonnent l'équipement (« Rien » : aucun)
    assert.equal(m.objets.map((o) => o.join(' OU ')).join(', ') || 'Rien', brut.equipement_brut, `${m.id} : équipement`);
    assert.equal(m.description, brut.description);
  }
  assert.equal(dImport('metiers/forgeron', 'artisanat_brut').replace(/\s+/g, ' '), 'Peut faire des armes métalliques [FORCE + VOLONTÉ]');
  if (intact('metiers/forgeron', 'artisanat_brut')) {
    assert.deepEqual(metiers.find((m) => m.id === 'metiers/forgeron').artisanat,
      { texte: 'Peut faire des armes métalliques', test: 'FORCE + VOLONTÉ', caracteristiques: ['force', 'volonte'] });
  }
  assert.equal(dImport('metiers/coursier', 'bonus_brut'), '+1 INI, +2% Athlétisme OU Équilibre');
  if (intact('metiers/coursier', 'bonus_brut')) {
    assert.deepEqual(metiers.find((m) => m.id === 'metiers/coursier').bonus, [
      { texte: '+1 INI', valeur: 1, unite: null, options: [{ competence_id: null, attribut: 'initiative' }] },
      { texte: '+2% Athlétisme OU Équilibre', valeur: 2, unite: '%', options: [{ competence_id: 'athletisme', attribut: null }, { competence_id: 'equilibre', attribut: null }] },
    ]);
  }
  assert.equal(dImport('metiers/acrobate', 'equipement_brut'), 'Rien');
  if (intact('metiers/acrobate', 'equipement_brut')) assert.deepEqual(metiers.find((m) => m.id === 'metiers/acrobate').objets, []);
});

test('artisanat (décision R34) : chaque métier qui fabrique avec un test a ses deux caractéristiques ; le Peintre « PERCEPTION x2 » en a deux fois une', () => {
  for (const m of metiers) if (m.artisanat?.test) assert.equal(m.artisanat.caracteristiques.length, 2, m.id);
  if (intact('metiers/peintre', 'artisanat_brut') && ligneBrute.has('metiers/peintre')) {
    assert.deepEqual(metiers.find((m) => m.id === 'metiers/peintre').artisanat.caracteristiques, ['perception', 'perception']);
  }
  // la constante de la compétence d'artisanat (10 par point de caractéristique) et sa phrase dans la page des règles
  const c = db.prepare("SELECT valeur, texte, page_id FROM regle_constante WHERE id = 'metier.artisanat_par_point_caracteristique'").get();
  assert.equal(c.valeur, 10);
  assert.equal(c.page_id, PAGE_DES_REGLES);
  assert.ok(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(PAGE_DES_REGLES).corps_md.includes(c.texte), 'phrase écrite dans la page des règles');
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

test('décisions R36 et R40 : « Survie » du Prostitué = +3 % Survie ; les équipements à choix donnent leurs options en entier', () => {
  const metier = (id) => metiers.find((m) => m.id === id);
  if (metier('metiers/prostitue') && intact('metiers/prostitue', 'bonus_brut')) {
    assert.deepEqual(metier('metiers/prostitue').bonus.map((b) => [b.texte, b.options[0].competence_id]), [['+3% Manipulation', 'manipulation'], ['+3% Survie', 'survie']]);
  }
  for (const [id, options] of [
    ['metiers/chasseur', ['Arc en acier (Arme)', 'Arbalète en acier (Arme)']],
    ['metiers/gladiateur', ['Glaive lourd en acier (arme)', 'Glaive léger en acier (arme)']],
    ['metiers/fossoyeur', ['Pelle en acier (arme)', 'Faucille en acier (arme)']],
  ]) {
    if (metier(id) && intact(id, 'equipement_brut')) assert.deepEqual(metier(id).objets, [options], id);
  }
  // aucun objet de départ ne garde un choix abrégé en minuscules (« Arc ou Arbalète… »)
  for (const m of metiers) for (const o of m.objets.flat()) assert.doesNotMatch(o, / ou /, `${m.id} : ${o}`);
});
