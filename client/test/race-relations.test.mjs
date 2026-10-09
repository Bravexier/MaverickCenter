// Relations d'une race avec les autres peuples (lib/race-relations.mjs) : sens tranché par le propriétaire (R12 : la case (ligne A, colonne B) dit comment A
// voit B), listes par niveau, et la règle de regroupement demandée : on ne regroupe jamais deux peuples dont les relations diffèrent.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';
import { nomCourtDePeuple, relationsDeRace, tonalite } from '../src/lib/race-relations.mjs';

const ECHELLE = [
  { id: 'meme-peuple', libelle: 'Même peuple', ordre: 1 },
  { id: 'alliee', libelle: 'Alliée', ordre: 2 },
  { id: 'neutre', libelle: 'Neutre', ordre: 5 },
  { id: 'ennemie', libelle: 'Ennemie', ordre: 8 },
];
// Race A : deux peuples (A1, A2) ; race B : deux peuples (B1, B2) ; race C : un peuple (C1).
const PEUPLES = [
  { id: 'a1', nom: 'Aa Un', ordre: 1, raceId: 'races/a' },
  { id: 'a2', nom: 'Aa Deux', ordre: 2, raceId: 'races/a' },
  { id: 'b1', nom: 'Bb Nord', ordre: 3, raceId: 'races/b' },
  { id: 'b2', nom: 'Bb Sud', ordre: 4, raceId: 'races/b' },
  { id: 'c1', nom: 'Cc', ordre: 5, raceId: 'races/c' },
];
// Matrice : ligne = qui voit, colonne = qui est vu (même convention que relation_peuple).
function donnees(matrice) {
  const regards = [];
  for (const [voit, ligne] of Object.entries(matrice)) for (const [vu, e] of Object.entries(ligne)) regards.push({ peupleId: voit, vuPeupleId: vu, echelleId: e });
  return { peuples: PEUPLES, regards, echelle: ECHELLE };
}
const tout = (base, surcharge = {}) => {
  const m = {};
  for (const a of PEUPLES) {
    m[a.id] = {};
    for (const b of PEUPLES) m[a.id][b.id] = a.id === b.id ? 'meme-peuple' : base;
  }
  for (const [k, v] of Object.entries(surcharge)) {
    const [voit, vu] = k.split('>');
    m[voit][vu] = v;
  }
  return m;
};
const libelles = (bloc) => bloc.niveaux.map((n) => n.echelle.id);
const cibles = (bloc, niveau) =>
  bloc.niveaux.find((n) => n.echelle.id === niveau)?.cibles.map((c) => (c.toute ? c.raceId : c.peuples.map((p) => p.id).join('+'))) ?? [];

test('sens R12 : « voit » lit la ligne du peuple, « vu » sa colonne', () => {
  const r = relationsDeRace(donnees(tout('neutre', { 'a1>c1': 'alliee', 'a2>c1': 'alliee', 'c1>a1': 'ennemie', 'c1>a2': 'ennemie' })), 'races/a');
  assert.deepEqual(cibles(r.voit[0], 'alliee'), ['races/c']);
  assert.deepEqual(cibles(r.vu[0], 'ennemie'), ['races/c']);
  assert.deepEqual(cibles(r.vu[0], 'alliee'), []);
});

test('les peuples de la race au regard identique forment un seul bloc ; ceux qui diffèrent ne sont jamais regroupés', () => {
  const pareil = relationsDeRace(donnees(tout('neutre')), 'races/a');
  assert.equal(pareil.voit.length, 1);
  assert.equal(pareil.voit[0].tous, true);
  assert.deepEqual(pareil.voit[0].peuples.map((p) => p.id), ['a1', 'a2']);
  const different = relationsDeRace(donnees(tout('neutre', { 'a1>c1': 'ennemie' })), 'races/a');
  assert.equal(different.voit.length, 2, 'A1 et A2 diffèrent sur C1 : deux blocs');
  assert.deepEqual(different.voit.map((b) => b.peuples.map((p) => p.id)), [['a1'], ['a2']]);
  assert.ok(different.voit.every((b) => !b.tous));
  assert.equal(different.vu.length, 1, 'les autres les voient pareil : un bloc pour « vu »');
});

test('une race dont tous les peuples sont au même niveau est citée une fois ; sinon chaque peuple l’est à son propre niveau', () => {
  const r = relationsDeRace(donnees(tout('neutre', { 'a1>b2': 'ennemie', 'a2>b2': 'ennemie' })), 'races/a');
  assert.deepEqual(cibles(r.voit[0], 'neutre'), ['b1', 'races/c']);
  assert.deepEqual(cibles(r.voit[0], 'ennemie'), ['b2']);
  const entiere = relationsDeRace(donnees(tout('neutre')), 'races/a');
  assert.deepEqual(cibles(entiere.voit[0], 'neutre'), ['races/b', 'races/c']);
});

test('niveaux rangés du plus favorable au plus défavorable ; la race elle-même n’est pas dans ses listes', () => {
  const r = relationsDeRace(donnees(tout('neutre', { 'a1>b1': 'ennemie', 'a2>b1': 'ennemie', 'a1>c1': 'alliee', 'a2>c1': 'alliee' })), 'races/a');
  assert.deepEqual(libelles(r.voit[0]), ['alliee', 'neutre', 'ennemie']);
  const ids = r.voit[0].niveaux.flatMap((n) => n.cibles.flatMap((c) => c.peuples.map((p) => p.id)));
  assert.ok(!ids.includes('a1') && !ids.includes('a2'));
  assert.equal(ids.length, 3);
});

test('relations entre les peuples de la race : une matrice (ligne = qui voit), sans la diagonale', () => {
  const r = relationsDeRace(donnees(tout('neutre', { 'a1>a2': 'ennemie', 'a2>a1': 'alliee' })), 'races/a');
  assert.equal(r.interne.cases.get('a1').get('a2').id, 'ennemie');
  assert.equal(r.interne.cases.get('a2').get('a1').id, 'alliee');
  assert.equal(r.interne.cases.get('a1').has('a1'), false);
  assert.equal(relationsDeRace(donnees(tout('neutre')), 'races/c').interne, null, 'un seul peuple : pas de matrice');
});

test('race absente de la matrice : aucune relation', () => {
  assert.deepEqual(relationsDeRace(donnees(tout('neutre')), 'races/z'), { peuples: [], voit: [], vu: [], interne: null });
});

test('tonalité autour de « Neutre » ; nom court d’un peuple dans sa race', () => {
  assert.equal(tonalite({ ordre: 2 }, 5), 'amitie');
  assert.equal(tonalite({ ordre: 5 }, 5), 'neutre');
  assert.equal(tonalite({ ordre: 8 }, 5), 'animosite');
  assert.equal(nomCourtDePeuple('Humain Central', 'Humain'), 'Central');
  assert.equal(nomCourtDePeuple('Elfe Argenté Barrage argenté', 'Elfe argenté'), 'Barrage argenté');
  assert.equal(nomCourtDePeuple("Drassah'thac Nord", "Drassah'thac"), 'Nord');
  assert.equal(nomCourtDePeuple('Majin', 'Majin'), 'Majin', 'rien ne reste : nom entier');
  assert.equal(nomCourtDePeuple('Autre Chose', 'Humain'), 'Autre Chose');
});

// Données réelles (matrice « Relation entre les races » de la base)
const { relations } = chargerRaces(ouvrirBase({ sansExemples: false }));

test('base : 69 peuples, 69 x 69 regards, 24 races présentes ; Anansi, Farfadet et Goleois n’ont pas de relations', () => {
  assert.equal(relations.peuples.length, 69);
  assert.equal(relations.regards.length, 69 * 69);
  assert.equal(new Set(relations.peuples.map((p) => p.raceId)).size, 24);
  for (const slug of ['anansi', 'farfadet', 'goleois']) assert.equal(relationsDeRace(relations, `races/${slug}`).peuples.length, 0, slug);
});

test('Elfe noir : Charbon et Salé ne voient pas les autres pareil, ils ne sont pas regroupés ; Charbon voit Salé « Ennemie », Salé voit Charbon « Haine »', () => {
  const r = relationsDeRace(relations, 'races/elfe-noir');
  assert.deepEqual(r.peuples.map((p) => p.nom), ['Elfe Noir Charbon', 'Elfe Noir Salé']);
  assert.deepEqual(r.voit.map((b) => b.peuples.map((p) => p.nom)), [['Elfe Noir Charbon'], ['Elfe Noir Salé']]);
  const charbon = r.peuples[0].id;
  const sale = r.peuples[1].id;
  assert.equal(r.interne.cases.get(charbon).get(sale).libelle, 'Ennemie');
  assert.equal(r.interne.cases.get(sale).get(charbon).libelle, 'Haine');
});

test('Mort-vivant (R12) : il évite 62 peuples, tous les autres le voient « Neutre » (sauf un allié)', () => {
  const r = relationsDeRace(relations, 'races/mort-vivant');
  const compte = (bloc, niveau) => bloc.niveaux.find((n) => n.echelle.id === niveau)?.cibles.reduce((t, c) => t + c.peuples.length, 0) ?? 0;
  assert.equal(compte(r.voit[0], 'evitee'), 62);
  assert.equal(compte(r.vu[0], 'neutre'), 67);
});

test('toute relation est citée une fois par bloc : un bloc couvre les 69 peuples moins ceux de la race', () => {
  for (const raceId of new Set(relations.peuples.map((p) => p.raceId))) {
    const r = relationsDeRace(relations, raceId);
    for (const bloc of [...r.voit, ...r.vu]) {
      const vus = bloc.niveaux.flatMap((n) => n.cibles.flatMap((c) => c.peuples.map((p) => p.id)));
      assert.equal(vus.length, 69 - r.peuples.length, raceId);
      assert.equal(new Set(vus).size, vus.length, `${raceId} : un peuple cité deux fois`);
    }
  }
});
