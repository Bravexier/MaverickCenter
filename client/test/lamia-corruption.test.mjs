// La Lamia a accès à la Corruption en magie innée (décision R22 du propriétaire, migration data/migrations/0013-lamia-corruption.sql) : la case
// Lamia × Corruption de la matrice « Accessibilité Magie » (E24), à 0 dans la fiche, est corrigée partout où la liste des magies innées est écrite.
// Le site de dev est la source des magies innées qu'il modifie (décision du propriétaire) : ce que la migration a écrit se lit dans
// historique_modification (lib/historique-site.mjs), l'état courant est contrôlé par sa cohérence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { racesOfMagie } from '../src/lib/magie-relations.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
const LAMIA = 'races/lamia';
const CORRUPTION = 'magies/magie-de-la-corruption';
const page = (id) => db.prepare('SELECT donnees, corps_md FROM page WHERE id = ?').get(id);
const entree = (id) => ({ id, data: { title: id, ...JSON.parse(page(id).donnees ?? '{}') } });

test('matrice : la case Lamia × Corruption vaut 1, la trace de la fiche est dans source_ref ; les autres cases ne changent pas', () => {
  const cle = { race_id: LAMIA, magie_id: CORRUPTION };
  const { accessible, valeur_brut, source_ref } = historique.ligneDImport('race_magie', cle);
  assert.deepEqual({ accessible, valeur_brut, source_ref }, { accessible: 1, valeur_brut: '1', source_ref: 'Fiche auto V15.2.2 › Accessibilité Magie › E24 (0 dans la fiche ; 1 : décision R22 du propriétaire)' });
  if (!historique.touchee('race_magie', cle)) assert.ok(db.prepare('SELECT 1 FROM v_race_magie_accessible WHERE race_id = ? AND magie_id = ?').get(LAMIA, CORRUPTION));
  // la matrice est complète (une case par race et par magie) ; à l'import, 245 cases à 1 sur 405
  const n = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
  assert.equal(n('race_magie'), n('race') * n('magie'));
  const matrice = historique.lignesDImport('race_magie');
  assert.deepEqual({ un: matrice.filter((c) => c.accessible === 1).length, n: matrice.length }, { un: 245, n: 405 });
  assert.deepEqual(matrice.filter((c) => c.race_id === LAMIA && c.accessible === 0).map((c) => c.magie_id), ['magies/potentiel-illimite'],
    'la Lamia n’a toujours pas le Potentiel Illimité');
});

test('page de la Lamia : magies innées du front matter et section « Magies accessibles », la citation de la fiche reste telle quelle', () => {
  // tels que la migration les a écrits (le site de dev peut changer les magies innées de la Lamia depuis)
  const donnees = historique.valeurDImport('page', { id: LAMIA }, 'donnees');
  const corps_md = historique.valeurDImport('page', { id: LAMIA }, 'corps_md');
  assert.deepEqual(JSON.parse(donnees).magies_innees, ['Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre']);
  assert.ok(corps_md.includes('Nombre : 14 sur 15.'));
  assert.ok(corps_md.includes('Corruption : à 0 dans la matrice de la fiche, accessible d\'après le propriétaire du projet (décision R22).'));
  assert.ok(corps_md.includes('13 sur 15 (à 0 dans la matrice : Potentiel Illimité, Corruption)'), 'le tableau des écarts cite la fiche');
});

test('la page de la race (tables) et celle de la Corruption (front matter) disent la même chose', () => {
  const lamia = chargerRaces(db).races.get(LAMIA);
  assert.equal(lamia.magiesInnees.source, 'matrice');
  assert.ok(lamia.magiesInnees.avec.some((m) => m.id === CORRUPTION));
  assert.deepEqual(lamia.magiesInnees.sans.map((m) => m.id), ['magies/potentiel-illimite']);
  const { avec } = racesOfMagie([entree(LAMIA), entree('races/nain')], { data: { nom_court: 'Corruption' } });
  assert.deepEqual(avec.map((r) => r.id), [LAMIA], 'la Lamia est dans « Disponibilité par race » de la Corruption, pas le Nain');
});
