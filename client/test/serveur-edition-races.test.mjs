// Édition des races depuis le site de dev (client/serveur/edition.mjs) : onglet de la race, dons, tableau en panneaux ; création d'une race (pure ou
// hybride, avec sa ligne dans les matrices de la fiche et son peuple) ; magies innées (la liste de l'onglet prime, sinon la matrice : R11, R8) ;
// relations entre peuples (sens R12 : la case (A, B) dit comment A voit B).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { A_COMPLETER } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';
import { relationsDeRace } from '../src/lib/race-relations.mjs';
import { raceKind } from '../src/lib/race-kinds.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-races-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true };
const enregistrer = (operations) =>
  traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'races/x', operations }) }, service);
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p);
const peuple = (slug) => `lore/relations-entre-les-races#peuple:${slug}`;

test('onglet de la race : textes et valeurs de départ ; présentation reprise comme résumé de la page', () => {
  const r = enregistrer([
    { op: 'modifier', table: 'race_onglet', cle: { race_id: 'races/humain' }, valeurs: { histoire: 'Nouvelle histoire.', sante_depart: '11' } },
    { op: 'modifier', table: 'race', cle: { id: 'races/humain' }, valeurs: { presentation: 'Les humains, partout.' } },
  ]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual({ ...ligne("SELECT histoire, sante_depart FROM race_onglet WHERE race_id = 'races/humain'") }, { histoire: 'Nouvelle histoire.', sante_depart: 11 });
  assert.equal(ligne("SELECT resume FROM page WHERE id = 'races/humain'").resume, 'Les humains, partout.');
  assert.equal(enregistrer([{ op: 'modifier', table: 'race_onglet', cle: { race_id: 'races/humain' }, valeurs: { histoire: '' } }]).statut, 400, 'texte obligatoire de l’onglet');
});

test('dons, tableau en panneaux, mode Hyper : chaque case', () => {
  const don = ligne("SELECT id FROM race_don WHERE race_id = 'races/elfe-noir' ORDER BY rang LIMIT 1").id;
  const cellule = ligne("SELECT race_id, ligne, colonne FROM race_don_tableau_cellule WHERE race_id = 'races/drakos' ORDER BY ligne, colonne LIMIT 1");
  const hyper = ligne("SELECT id FROM mode_hyper_effet WHERE version = 'onglet_race' AND race_id = 'races/elfe-noir'").id;
  const r = enregistrer([
    { op: 'modifier', table: 'race_don', cle: { id: don }, valeurs: { nom: 'Sang très corrompu', texte: '- Une ligne\n- Une autre' } },
    { op: 'modifier', table: 'race_don_tableau_cellule', cle: cellule, valeurs: { valeur: 'Case modifiée' } },
    { op: 'modifier', table: 'mode_hyper_effet', cle: { id: hyper }, valeurs: { nom: 'Sang du condamné II', effet: 'Effet réécrit.' } },
  ]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne('SELECT nom FROM race_don WHERE id = ?', don).nom, 'Sang très corrompu');
  assert.equal(ligne('SELECT valeur FROM race_don_tableau_cellule WHERE race_id = ? AND ligne = ? AND colonne = ?', cellule.race_id, cellule.ligne, cellule.colonne).valeur, 'Case modifiée');
  assert.equal(ligne('SELECT effet FROM mode_hyper_effet WHERE id = ?', hyper).effet, 'Effet réécrit.');
});

test('créer une race hybride : page (mot-clé « race hybride »), race, onglet à compléter, matrices de la fiche, peuple ; rangée parmi les hybrides', () => {
  const r = enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: 'Lycan', nature: 'hybride', presentation: 'Les loups-garous.' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.crees, [{ entite: 'race', id: 'races/lycan' }]);
  const race = ligne("SELECT * FROM race WHERE id = 'races/lycan'");
  assert.equal(race.ordre, 28);
  assert.equal(ligne("SELECT histoire FROM race_onglet WHERE race_id = 'races/lycan'").histoire, A_COMPLETER);
  assert.equal(ligne("SELECT description_generale FROM race_onglet WHERE race_id = 'races/lycan'").description_generale, 'Les loups-garous.');
  assert.deepEqual(lignes("SELECT libelle FROM page_tag WHERE page_id = 'races/lycan' ORDER BY ordre").map((t) => t.libelle), ['race', 'race hybride']);
  assert.equal(ligne("SELECT count(*) AS n FROM race_magie WHERE race_id = 'races/lycan' AND accessible = 0").n, 15);
  assert.equal(ligne("SELECT count(*) AS n FROM race_classe WHERE race_id = 'races/lycan'").n, ligne('SELECT count(*) AS n FROM classe').n);
  assert.equal(ligne('SELECT race_id FROM peuple WHERE id = ?', peuple('lycan')).race_id, 'races/lycan');
  const races = chargerRaces(db);
  assert.equal(races.races.get('races/lycan').hybride, true, 'lib/races-db.mjs');
  const entree = { id: 'races/lycan', data: { title: 'Lycan', tags: ['race', 'race hybride'] } };
  assert.equal(raceKind([entree], entree), 'hybride', 'lib/race-kinds.mjs');
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: 'Lycan', nature: 'pure' } }]).statut, 409);
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: 'Autre', nature: 'mixte' } }]).statut, 400);
});

test('magies innées : la matrice de la fiche (R8), ou la liste de l’onglet quand elle existe (R11 : le Nain) ; la liste de la page suit', () => {
  const r = enregistrer([{ op: 'magies_innees', race: 'races/lycan', magies: ['magies/magie-du-feu', 'magies/magie-de-lombre'] }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(lignes("SELECT magie_id FROM race_magie WHERE race_id = 'races/lycan' AND accessible = 1 ORDER BY ordre").map((m) => m.magie_id), ['magies/magie-du-feu', 'magies/magie-de-lombre']);
  assert.deepEqual(JSON.parse(ligne("SELECT donnees FROM page WHERE id = 'races/lycan'").donnees).magies_innees, ['Feu', 'Ombre']);
  const nain = enregistrer([{ op: 'magies_innees', race: 'races/nain', magies: ['magies/magie-du-feu'] }]);
  assert.equal(nain.statut, 200, JSON.stringify(nain.corps));
  assert.deepEqual(lignes("SELECT magie_id FROM race_magie_onglet WHERE race_id = 'races/nain'").map((m) => m.magie_id), ['magies/magie-du-feu']);
  assert.equal(enregistrer([{ op: 'magies_innees', race: 'races/nain', magies: ['magies/inconnue'] }]).statut, 400);
});

test('relations entre peuples : placer une race dans un niveau (case créée ou changée), retirer une case ; le tableau de la race suit', () => {
  const r = enregistrer([{ op: 'relations', cases: [
    { voit: peuple('lycan'), vu: peuple('humain-central'), echelle: 'haine' },
    { voit: peuple('humain-central'), vu: peuple('lycan'), echelle: 'evitee' },
  ] }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const rel = chargerRaces(db).relations;
  const lycan = relationsDeRace(rel, 'races/lycan');
  assert.deepEqual(lycan.voit[0].niveaux.map((n) => [n.echelle.id, n.cibles.map((c) => c.peuples.map((p) => p.nom).join('+'))]), [['haine', ['Humain Central']]]);
  assert.equal(lycan.vu[0].niveaux[0].echelle.id, 'evitee');
  assert.equal(enregistrer([{ op: 'relations', cases: [{ voit: peuple('lycan'), vu: peuple('humain-central'), echelle: 'alliee' }] }]).statut, 200);
  assert.equal(ligne('SELECT echelle_id FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id = ?', peuple('lycan'), peuple('humain-central')).echelle_id, 'alliee');
  assert.equal(enregistrer([{ op: 'relations', cases: [{ voit: peuple('lycan'), vu: peuple('humain-central'), echelle: null }] }]).statut, 200);
  assert.equal(ligne('SELECT count(*) AS n FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id <> ligne_peuple_id', peuple('lycan')).n, 0, 'reste sa case diagonale');
  for (const cas of [[{ voit: peuple('lycan'), vu: peuple('lycan'), echelle: 'neutre' }], [{ voit: peuple('x'), vu: peuple('lycan'), echelle: 'neutre' }], [{ voit: peuple('lycan'), vu: peuple('humain-central'), echelle: 'amour' }]]) {
    assert.equal(enregistrer([{ op: 'relations', cases: cas }]).statut, 400, JSON.stringify(cas));
  }
});

test('peuple ajouté à une race qui n’en a pas (Anansi) : sa race peut avoir des relations', () => {
  const r = enregistrer([{ op: 'creer', entite: 'peuple', valeurs: { nom: 'Anansi', race_id: 'races/anansi' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne("SELECT principale FROM page_entite WHERE entite_table = 'peuple' AND entite_id = ?", peuple('anansi')).principale, 0);
  assert.equal(enregistrer([{ op: 'creer', entite: 'peuple', valeurs: { nom: 'X', race_id: 'races/absente' } }]).statut, 400);
});

test('état vivant d’une race (POST /api/edition/race/) : magies innées et relations', () => {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/race/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ race: 'races/lycan' }) }, service);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.magiesInnees, { source: 'matrice', ids: ['magies/magie-du-feu', 'magies/magie-de-lombre'] });
  assert.ok(r.corps.relations.peuples.some((p) => p.raceId === 'races/lycan'));
  const nain = traiter({ methode: 'POST', chemin: '/api/edition/race/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ race: 'races/nain' }) }, service);
  assert.equal(nain.corps.magiesInnees.source, 'onglet');
  assert.equal(traiter({ methode: 'POST', chemin: '/api/edition/race/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ race: 'races/x' }) }, service).statut, 404);
});
