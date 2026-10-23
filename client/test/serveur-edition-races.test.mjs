// Édition des races depuis le site de dev (client/serveur/edition.mjs) : onglet de la race, dons, tableau en panneaux ; création d'une race (pure ou
// hybride, avec sa ligne dans les matrices de la fiche et son peuple) ; magies innées (la liste de l'onglet prime, sinon la matrice : R11, R8) ;
// relations entre peuples (sens R12 : la case (A, B) dit comment A voit B).
// La base vivante part des règles de data/rows, où le site de dev a pu créer des races : les données d'essai ont des noms absents de la base, et les
// effectifs attendus (ordre, matrices) sont lus avant d'écrire.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { A_COMPLETER } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';
import { relationsDeRace } from '../src/lib/race-relations.mjs';
import { raceKind } from '../src/lib/race-kinds.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-races');
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const service = { base: () => db, etat: () => ({}), edition: true };
const enregistrer = (operations) =>
  traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'races/x', operations }) }, service);
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p);
const peuple = (slug) => `lore/relations-entre-les-races#peuple:${slug}`;
/** Un nom de race (et de peuple) que la base n'a pas encore : `nom`, ou `nom 2`, `nom 3`… */
const nomLibre = (nom) => {
  const pris = (n) => ligne('SELECT 1 FROM race WHERE nom = ? OR id = ? UNION ALL SELECT 1 FROM page WHERE id = ? UNION ALL SELECT 1 FROM peuple WHERE nom = ? OR id = ?',
    n, `races/${normalize(n)}`, `races/${normalize(n)}`, n, peuple(normalize(n)));
  let n = nom;
  for (let i = 2; pris(n); i += 1) n = `${nom} ${i}`;
  return n;
};
const LYCAN = nomLibre('Lycan');
const ID_LYCAN = `races/${normalize(LYCAN)}`;
const PEUPLE_LYCAN = peuple(normalize(LYCAN));

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
  const ordre = ligne('SELECT max(ordre) AS m FROM race').m + 1;
  const r = enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: LYCAN, nature: 'hybride', presentation: 'Les loups-garous.' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.crees, [{ entite: 'race', id: ID_LYCAN, operation: 0 }]);
  const race = ligne('SELECT * FROM race WHERE id = ?', ID_LYCAN);
  assert.equal(race.ordre, ordre, 'à la suite des races de la base');
  assert.equal(ligne('SELECT histoire FROM race_onglet WHERE race_id = ?', ID_LYCAN).histoire, A_COMPLETER);
  assert.equal(ligne('SELECT description_generale FROM race_onglet WHERE race_id = ?', ID_LYCAN).description_generale, 'Les loups-garous.');
  assert.deepEqual(lignes('SELECT m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id WHERE t.page_id = ? ORDER BY t.ordre', ID_LYCAN).map((t) => t.libelle), ['race', 'race hybride']);
  assert.equal(ligne('SELECT count(*) AS n FROM race_magie WHERE race_id = ? AND accessible = 0', ID_LYCAN).n, ligne('SELECT count(*) AS n FROM magie').n);
  assert.equal(ligne('SELECT count(*) AS n FROM race_classe WHERE race_id = ?', ID_LYCAN).n, ligne('SELECT count(*) AS n FROM classe').n);
  assert.equal(ligne('SELECT race_id FROM peuple WHERE id = ?', PEUPLE_LYCAN).race_id, ID_LYCAN);
  const races = chargerRaces(db);
  assert.equal(races.races.get(ID_LYCAN).hybride, true, 'lib/races-db.mjs');
  const entree = { id: ID_LYCAN, data: { title: LYCAN, tags: ['race', 'race hybride'] } };
  assert.equal(raceKind([entree], entree), 'hybride', 'lib/race-kinds.mjs');
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: LYCAN, nature: 'pure' } }]).statut, 409);
  assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: 'Autre', nature: 'mixte' } }]).statut, 400);
});

test('magies innées : la matrice de la fiche (R8), ou la liste de l’onglet quand elle existe (R11 : le Nain) ; la liste de la page suit', () => {
  const r = enregistrer([{ op: 'magies_innees', race: ID_LYCAN, magies: ['magies/magie-du-feu', 'magies/magie-de-lombre'] }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(lignes('SELECT magie_id FROM race_magie WHERE race_id = ? AND accessible = 1 ORDER BY ordre', ID_LYCAN).map((m) => m.magie_id), ['magies/magie-du-feu', 'magies/magie-de-lombre']);
  assert.deepEqual(JSON.parse(ligne('SELECT donnees FROM page WHERE id = ?', ID_LYCAN).donnees).magies_innees, ['Feu', 'Ombre']);
  const nain = enregistrer([{ op: 'magies_innees', race: 'races/nain', magies: ['magies/magie-du-feu'] }]);
  assert.equal(nain.statut, 200, JSON.stringify(nain.corps));
  assert.deepEqual(lignes("SELECT magie_id FROM race_magie_onglet WHERE race_id = 'races/nain'").map((m) => m.magie_id), ['magies/magie-du-feu']);
  assert.equal(enregistrer([{ op: 'magies_innees', race: 'races/nain', magies: ['magies/inconnue'] }]).statut, 400);
});

test('relations entre peuples : placer une race dans un niveau (case créée ou changée), retirer une case ; le tableau de la race suit', () => {
  const r = enregistrer([{ op: 'relations', cases: [
    { voit: PEUPLE_LYCAN, vu: peuple('humain-central'), echelle: 'haine' },
    { voit: peuple('humain-central'), vu: PEUPLE_LYCAN, echelle: 'evitee' },
  ] }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const rel = chargerRaces(db).relations;
  const lycan = relationsDeRace(rel, ID_LYCAN);
  assert.deepEqual(lycan.voit[0].niveaux.map((n) => [n.echelle.id, n.cibles.map((c) => c.peuples.map((p) => p.nom).join('+'))]), [['haine', ['Humain Central']]]);
  assert.equal(lycan.vu[0].niveaux[0].echelle.id, 'evitee');
  assert.equal(enregistrer([{ op: 'relations', cases: [{ voit: PEUPLE_LYCAN, vu: peuple('humain-central'), echelle: 'alliee' }] }]).statut, 200);
  assert.equal(ligne('SELECT echelle_id FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id = ?', PEUPLE_LYCAN, peuple('humain-central')).echelle_id, 'alliee');
  assert.equal(enregistrer([{ op: 'relations', cases: [{ voit: PEUPLE_LYCAN, vu: peuple('humain-central'), echelle: null }] }]).statut, 200);
  // plus aucun regard vers un autre peuple (la case « Même peuple » de la diagonale n'est pas une relation entre races)
  assert.equal(ligne('SELECT count(*) AS n FROM relation_peuple WHERE ligne_peuple_id = ? AND colonne_peuple_id <> ligne_peuple_id', PEUPLE_LYCAN).n, 0);
  for (const cas of [[{ voit: PEUPLE_LYCAN, vu: PEUPLE_LYCAN, echelle: 'neutre' }], [{ voit: peuple('x'), vu: PEUPLE_LYCAN, echelle: 'neutre' }], [{ voit: PEUPLE_LYCAN, vu: peuple('humain-central'), echelle: 'amour' }]]) {
    assert.equal(enregistrer([{ op: 'relations', cases: cas }]).statut, 400, JSON.stringify(cas));
  }
});

test('peuple ajouté à une race qui n’en a pas (à l’import : Anansi, Farfadet, Goleois) : sa race peut avoir des relations', () => {
  // une race sans peuple, prise dans la base (le site a pu en donner un à l'Anansi) ; s'il n'y en a plus, une race minimale dans cette copie
  let sans = ligne('SELECT id, nom FROM race r WHERE NOT EXISTS (SELECT 1 FROM peuple p WHERE p.race_id = r.id) ORDER BY id = ? DESC, id LIMIT 1', 'races/anansi');
  if (!sans) {
    assert.equal(enregistrer([{ op: 'creer', entite: 'race', valeurs: { nom: nomLibre('Race sans peuple'), nature: 'pure' } }]).statut, 200);
    sans = ligne('SELECT r.id, r.nom FROM race r WHERE r.ordre = (SELECT max(ordre) FROM race)');
    const siens = 'SELECT id FROM peuple WHERE race_id = ?';
    db.prepare(`DELETE FROM relation_peuple WHERE ligne_peuple_id IN (${siens}) OR colonne_peuple_id IN (${siens})`).run(sans.id, sans.id);
    db.prepare(`DELETE FROM page_entite WHERE entite_table = 'peuple' AND entite_id IN (${siens})`).run(sans.id);
    db.prepare('DELETE FROM peuple WHERE race_id = ?').run(sans.id);
  }
  const nom = nomLibre(sans.nom);
  const r = enregistrer([{ op: 'creer', entite: 'peuple', valeurs: { nom, race_id: sans.id } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(ligne("SELECT principale FROM page_entite WHERE entite_table = 'peuple' AND entite_id = ?", peuple(normalize(nom))).principale, 0);
  assert.equal(enregistrer([{ op: 'creer', entite: 'peuple', valeurs: { nom: 'X', race_id: 'races/absente' } }]).statut, 400);
});

test('état vivant d’une race (POST /api/edition/race/) : magies innées et relations', () => {
  const r = traiter({ methode: 'POST', chemin: '/api/edition/race/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ race: ID_LYCAN }) }, service);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(r.corps.magiesInnees, { source: 'matrice', ids: ['magies/magie-du-feu', 'magies/magie-de-lombre'] });
  assert.ok(r.corps.relations.peuples.some((p) => p.raceId === ID_LYCAN));
  const nain = traiter({ methode: 'POST', chemin: '/api/edition/race/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ race: 'races/nain' }) }, service);
  assert.equal(nain.corps.magiesInnees.source, 'onglet');
  assert.equal(traiter({ methode: 'POST', chemin: '/api/edition/race/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ race: 'races/x' }) }, service).statut, 404);
});
