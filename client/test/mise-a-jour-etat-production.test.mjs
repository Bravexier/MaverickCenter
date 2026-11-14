// Ce que la page « Mise à jour » (site de dev) montre de `etat_production` (GET /api/mise-a-jour/, serveur/attestation.mjs) :
// lib/notes-de-version-rendu.mjs#affichageDeLaProduction. On teste le niveau choisi (alerte, ligne discrète, rien), pas les libellés.
//   node --test test/mise-a-jour-etat-production.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { affichageDeLaProduction } from '../src/lib/notes-de-version-rendu.mjs';

const etat = (plus) => ({ etat: 'inconnue', raison: 'absente', message: 'Message du service.', version_publiee: null, version_attestee: null, attestee_le: null, problemes: null, tables_differentes: [], ...plus });

test('seul `pas_appliquee` donne une alerte, avec le message du service, les deux versions et les tables', () => {
  const a = affichageDeLaProduction(etat({ etat: 'pas_appliquee', raison: 'contenu', message: 'Pas appliquée.', version_publiee: '0.4.79', version_attestee: '0.4.78', attestee_le: '2026-11-14T10:00:00Z', tables_differentes: ['metier', 'sort'] }));
  assert.equal(a.niveau, 'alerte');
  assert.equal(a.message, 'Pas appliquée.');
  assert.ok(a.lignes.some((l) => l.includes('0.4.79')), 'la version publiée');
  assert.ok(a.lignes.some((l) => l.includes('0.4.78')), 'la version attestée');
  assert.deepEqual(a.tables, ['metier', 'sort']);
});

test('une alerte sans tables ni versions reste une alerte, sans lignes ajoutées', () => {
  const a = affichageDeLaProduction(etat({ etat: 'pas_appliquee', raison: 'version', message: 'Pas appliquée.' }));
  assert.equal(a.niveau, 'alerte');
  assert.deepEqual(a.tables, []);
  assert.deepEqual(a.lignes, []);
});

test('`inconnue` n’est jamais une alerte : une ligne discrète, quelle que soit la raison', () => {
  for (const raison of ['absente', 'en_cours', 'illisible', 'production_illisible', 'non_configuree']) {
    const a = affichageDeLaProduction(etat({ etat: 'inconnue', raison }));
    assert.equal(a.niveau, 'discret', raison);
    assert.equal(a.message, 'Message du service.');
    assert.deepEqual(a.tables, []);
  }
});

test('`a_jour` donne une ligne discrète, qui porte la date d’attestation quand elle est lisible', () => {
  const sans = affichageDeLaProduction(etat({ etat: 'a_jour', raison: null, message: 'À jour.', version_publiee: '0.4.79', version_attestee: '0.4.79' }));
  assert.equal(sans.niveau, 'discret');
  const avec = affichageDeLaProduction(etat({ etat: 'a_jour', raison: null, message: 'À jour.', version_publiee: '0.4.79', version_attestee: '0.4.79', attestee_le: '2026-11-14T10:00:00Z' }));
  assert.equal(avec.niveau, 'discret');
  assert.ok(avec.message.length > sans.message.length, 'la date s’ajoute');
  const illisible = affichageDeLaProduction(etat({ etat: 'a_jour', raison: null, message: 'À jour.', attestee_le: 'pas une date' }));
  assert.equal(illisible.message, 'À jour.');
});

test('`a_jour` sans message se compose avec la version', () => {
  const a = affichageDeLaProduction(etat({ etat: 'a_jour', raison: null, message: '', version_attestee: '0.4.79' }));
  assert.equal(a.niveau, 'discret');
  assert.ok(a.message.includes('0.4.79'));
  assert.equal(affichageDeLaProduction(etat({ etat: 'a_jour', raison: null, message: '' })), null);
});

test('une réponse sans le champ (ancien service) ou mal formée ne montre rien et ne casse rien', () => {
  for (const v of [undefined, null, 'a_jour', 3, [], {}, { etat: 'inconnu_du_site' }, etat({ etat: 'inconnue', message: '' })]) {
    assert.equal(affichageDeLaProduction(v), null, JSON.stringify(v));
  }
  const a = affichageDeLaProduction({ etat: 'pas_appliquee', message: 4, version_publiee: {}, tables_differentes: 'metier' });
  assert.equal(a.niveau, 'alerte');
  assert.deepEqual(a.tables, []);
  assert.equal(a.message, '');
  assert.deepEqual(affichageDeLaProduction({ etat: 'pas_appliquee', tables_differentes: ['metier', 3, '', null] }).tables, ['metier']);
});
