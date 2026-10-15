// Couleurs des caractéristiques (et de leurs compétences) et des postures (lib/caracteristiques-postures.mjs), demande du propriétaire :
// les couleurs telles qu'il les a données, une pour chaque ligne des tables caracteristique et posture de la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COULEUR_NEUTRE,
  COULEURS_ALIGNEMENTS,
  COULEURS_CARACTERISTIQUES,
  COULEURS_POSTURES,
  couleurDAlignement,
  couleurDeCaracteristique,
  couleurDePosture,
  styleDeCouleur,
} from '../src/lib/caracteristiques-postures.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { texteSurCouleur } from '../src/lib/sort-format.mjs';

const db = ouvrirBase({ sansExemples: false });

test('les couleurs demandées par le propriétaire, par nom de caractéristique et de posture', () => {
  const parNom = (table, couleur) => Object.fromEntries(db.prepare(`SELECT id, nom FROM ${table} ORDER BY ordre`).all().map((r) => [r.nom, couleur(r.id).toUpperCase()]));
  assert.deepEqual(parNom('caracteristique', couleurDeCaracteristique), {
    Force: '#FF6666', Volonté: '#FF99FF', Intelligence: '#66CCFF', Perception: '#FFCC00', Social: '#DDDDDD', Agilité: '#99FF66',
  });
  assert.deepEqual(parNom('posture', couleurDePosture), {
    Offensif: '#FF6666', Défensif: '#99FF99', Neutre: '#EEEEEE', Focus: '#9999FF', Vigilance: '#FFFF66', Symbiose: '#CC66FF',
  });
});

test('une couleur pour chaque ligne de la base, ni plus ni moins ; une compétence a celle de sa caractéristique', () => {
  const ids = (table) => db.prepare(`SELECT id FROM ${table}`).all().map((r) => r.id).sort();
  assert.deepEqual(Object.keys(COULEURS_CARACTERISTIQUES).sort(), ids('caracteristique'));
  assert.deepEqual(Object.keys(COULEURS_POSTURES).map((k) => `guide/postures#posture:${k}`).sort(), ids('posture'));
  for (const k of db.prepare('SELECT nom, caracteristique_id FROM competence').all()) {
    assert.notEqual(couleurDeCaracteristique(k.caracteristique_id), COULEUR_NEUTRE, k.nom);
  }
});

test('une posture se trouve par son id dans la base ou par sa clé ; l’inconnu reçoit la couleur neutre', () => {
  assert.equal(couleurDePosture('guide/postures#posture:focus'), COULEURS_POSTURES.focus);
  assert.equal(couleurDePosture('vigilance'), COULEURS_POSTURES.vigilance);
  assert.equal(couleurDePosture('guide/postures#posture:inconnue'), COULEUR_NEUTRE);
  assert.equal(couleurDeCaracteristique('chance'), COULEUR_NEUTRE);
});

test('couleurs claires : le texte posé dessus est foncé, dans les deux thèmes', () => {
  for (const couleur of [...Object.values(COULEURS_CARACTERISTIQUES), ...Object.values(COULEURS_POSTURES), COULEUR_NEUTRE]) {
    assert.match(couleur, /^#[0-9a-f]{6}$/);
    assert.equal(texteSurCouleur(couleur), '#171210', couleur);
  }
  assert.equal(styleDeCouleur('#ff6666'), '--c: #ff6666; --c-texte: #171210');
});

test('alignements : la couleur de leur titre dans « Les neuf alignements » du guide pour MJ (demande du propriétaire)', () => {
  assert.deepEqual(COULEURS_ALIGNEMENTS, {
    'Loyal Bon': '#45818e', 'Loyal Neutre': '#3c78d8', 'Loyal Mauvais': '#674ea7',
    'Neutre Bon': '#6aa84f', Neutre: '#999999', 'Neutre Mauvais': '#783f04',
    'Chaotique Bon': '#f1c232', 'Chaotique Neutre': '#e69138', 'Chaotique Mauvais': '#cc0000',
  });
  assert.equal(couleurDAlignement('Chaotique Mauvais'), '#cc0000');
  assert.equal(couleurDAlignement('Neutre Pur'), COULEUR_NEUTRE);
});
