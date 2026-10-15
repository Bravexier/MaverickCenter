// Filtre des armes par compétence (lib/armes-filtres.mjs ; demande du propriétaire : « filtrer les armes par compétence arc / arbalète / légère et
// lourde ») : une arme reste si l'une de ses compétences est choisie, toutes sans choix ; l'état de l'adresse se lit et s'écrit dans l'ordre des boutons.
// Plus « Arme de départ » (« trier par "arme de départ" ») : seules les armes de départ, en même temps que le filtre des compétences.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPETENCES_D_ARME, competencesDArme, ECRITURES_DE_COMPETENCE } from '../src/lib/arme-champs.mjs';
import { armeVisible, basculerCompetence, ecrireCompetences, lireCompetences, lireDepart } from '../src/lib/armes-filtres.mjs';

const connues = Object.keys(COMPETENCES_D_ARME);

test('les boutons du filtre : les quatre compétences d’arme, dans l’ordre Lourde, Légère, Arc, Arbalète', () => {
  assert.deepEqual(connues, ['arme-lourde', 'arme-legere', 'arc', 'arbalete']);
  assert.deepEqual(connues.map((id) => COMPETENCES_D_ARME[id].libelle), ['Lourde', 'Légère', 'Arc', 'Arbalète']);
});

test('une arme reste si l’une de ses compétences est choisie ; toutes sans choix', () => {
  const ids = (ecriture) => competencesDArme(ecriture).map((c) => c.id);
  assert.equal(armeVisible(ids('Arme Lourde'), []), true);
  assert.equal(armeVisible([], []), true, 'une écriture inconnue reste sans choix');
  assert.equal(armeVisible([], ['arc']), false, 'mais pas sous un filtre');
  assert.equal(armeVisible(ids('Arc'), ['arc']), true);
  assert.equal(armeVisible(ids('Arc'), ['arme-lourde']), false, 'l’Arc n’est pas une Arme Lourde');
  assert.equal(armeVisible(ids('Arc / Arme Légère'), ['arme-legere']), true, '« Arc / Arme Légère » sous Légère');
  assert.equal(armeVisible(ids('Arc / Arme Légère'), ['arc']), true, '… comme sous Arc');
  assert.equal(armeVisible(ids('Arme Lourde/Légère'), ['arme-lourde']), true);
  assert.equal(armeVisible(ids('Arme Lourde/Légère'), ['arbalete']), false);
  assert.equal(armeVisible(ids('Arbalète'), ['arc', 'arbalete']), true, 'l’une OU l’autre');
  // chaque écriture de l'onglet est rangée sous au moins un bouton
  for (const ecriture of ECRITURES_DE_COMPETENCE) assert.ok(ids(ecriture).length && ids(ecriture).every((id) => connues.includes(id)), ecriture);
});

test('bascule : un choix s’ajoute ou se retire, dans l’ordre des boutons', () => {
  assert.deepEqual(basculerCompetence([], 'arbalete', connues), ['arbalete']);
  assert.deepEqual(basculerCompetence(['arbalete'], 'arc', connues), ['arc', 'arbalete']);
  assert.deepEqual(basculerCompetence(['arc', 'arbalete'], 'arc', connues), ['arbalete']);
  assert.deepEqual(basculerCompetence(['arbalete'], 'inconnue', connues), ['arbalete'], 'un id inconnu est ignoré');
});

test('adresse : ?competence=arc,arbalete se lit (ids connus, ordre des boutons, sans doublon) et s’écrit', () => {
  assert.deepEqual(lireCompetences('arbalete, arc,arc,zorglub', connues), ['arc', 'arbalete']);
  assert.deepEqual(lireCompetences(null, connues), []);
  assert.deepEqual(lireCompetences('', connues), []);
  assert.equal(ecrireCompetences(['arbalete', 'arme-lourde'], connues), 'arme-lourde,arbalete');
  assert.equal(ecrireCompetences([], connues), '');
  assert.deepEqual(lireCompetences(ecrireCompetences(['arc', 'arme-legere'], connues), connues), ['arme-legere', 'arc']);
});

test('« Arme de départ » : seules les armes de départ, en même temps que le filtre des compétences ; ?depart=1', () => {
  const ids = (ecriture) => competencesDArme(ecriture).map((c) => c.id);
  assert.equal(armeVisible(ids('Arc'), [], { depart: false, seulementDepart: true }), false);
  assert.equal(armeVisible(ids('Arc'), [], { depart: true, seulementDepart: true }), true);
  assert.equal(armeVisible(ids('Arc'), ['arbalete'], { depart: true, seulementDepart: true }), false, 'les deux filtres à la fois');
  assert.equal(armeVisible(ids('Arc / Arme Légère'), ['arme-legere'], { depart: true, seulementDepart: true }), true);
  assert.equal(armeVisible(ids('Arme Lourde'), [], { depart: false }), true, 'sans le filtre, une arme qui n’est pas de départ reste');
  assert.equal(lireDepart('1'), true);
  assert.equal(lireDepart(null), false);
  assert.equal(lireDepart('oui'), false);
});
