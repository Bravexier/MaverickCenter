// Générateur d'accessoires (lib/accessoires-generateur.mjs) : couleurs des niveaux (celles de l'onglet), qualité de gemme d'un niveau (règles de la
// page), dés tirés des tables, plages, état dans l'adresse.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cleDEffet, COULEURS_DES_NIVEAUX, dansLaPlage, ecrireEtat, facesDuDe, lancer, lireEtat, qualiteDeGemme, QUALITES_DE_GEMME, styleDeNiveau,
} from '../src/lib/accessoires-generateur.mjs';

test('une couleur par niveau 1 à 5, celles du tableau « Monture » de l’onglet', () => {
  assert.deepEqual(COULEURS_DES_NIVEAUX, { 1: '#d9ead3', 2: '#fff2cc', 3: '#fce5cd', 4: '#f4cccc', 5: '#e6b8af' });
  assert.equal(styleDeNiveau(3), '--niv: #fce5cd');
  assert.equal(styleDeNiveau(null), undefined, 'niveau absent (« Niveau ? », ligne vide) : pas de couleur');
});

test('qualité de gemme : classique aux niveaux 1 et 2, raffinée aux niveaux 3 et 4, parfaite au niveau 5', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => qualiteDeGemme(n).id), ['commune', 'commune', 'raffinee', 'raffinee', 'parfaite']);
  assert.equal(qualiteDeGemme('4').libelle, 'raffinée');
  assert.equal(qualiteDeGemme(null), null);
  assert.deepEqual(QUALITES_DE_GEMME.flatMap((q) => q.niveaux), [1, 2, 3, 4, 5]);
});

test('dés : les faces sont le plus grand jet écrit ; un jet reste entre 1 et le nombre de faces', () => {
  assert.equal(facesDuDe([1, 2, 3, 4]), 4);
  assert.equal(facesDuDe([5, 20, 100, 66]), 100);
  assert.equal(lancer(20, () => 0), 1);
  assert.equal(lancer(20, () => 0.999999), 20);
  assert.equal(lancer(6, () => 0.5), 4);
  for (let i = 0; i < 200; i++) {
    const j = lancer(100);
    assert.ok(Number.isInteger(j) && j >= 1 && j <= 100);
  }
});

test('plages : l’élément dont la plage contient le jet', () => {
  const plages = [{ min: 1, max: 5, id: 'a' }, { min: 6, max: 20, id: 'b' }, { min: '21', max: '35', id: 'c' }];
  assert.equal(dansLaPlage(plages, 1).id, 'a');
  assert.equal(dansLaPlage(plages, 6).id, 'b');
  assert.equal(dansLaPlage(plages, 35).id, 'c');
  assert.equal(dansLaPlage(plages, 36), null);
});

test('état dans l’adresse : aller-retour, vides retirés, autres paramètres gardés', () => {
  const s = ecrireEtat('?x=1', { emplacement: 'anneau', propriete: 'competence', effet: 'competence:force:2', acquis: 7, monture: null, maudit: true });
  assert.equal(s, '?x=1&emplacement=anneau&propriete=competence&effet=competence%3Aforce%3A2&acquis=7&maudit=1');
  assert.deepEqual(lireEtat(s), { emplacement: 'anneau', propriete: 'competence', effet: 'competence:force:2', acquis: '7', maudit: '1' });
  assert.equal(ecrireEtat(s, {}), '?x=1');
  assert.equal(ecrireEtat('', { maudit: false }), '');
});

test('clé d’un effet : la partie après « #effet: »', () => {
  assert.equal(cleDEffet('ressources/accessoires#effet:competence:force:2'), 'competence:force:2');
  assert.equal(cleDEffet('ressources/accessoires#effet:attaque:5'), 'attaque:5');
});
