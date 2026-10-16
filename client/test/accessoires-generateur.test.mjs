// Générateur d'accessoires (lib/accessoires-generateur.mjs) : couleurs des niveaux (celles de l'onglet), qualité de gemme d'un niveau (règles de la
// page), dés tirés des tables, plages, état dans l'adresse.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ancreGardee, bonusBorne, bonusDeLAdresse, cleDEffet, effetDuBonus, COULEURS_DES_NIVEAUX, dansLaPlage, ecrireEtat, facesDuDe, gemmesAuChoix, gemmesCochees, lancer, lireEtat, prixDeLAccessoire, qualiteDeGemme,
  QUALITES_DE_GEMME, styleDeNiveau,
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

test('gemmes au choix : deux en tout, les rangs à une gemme imposés (« laisser la possibilité d’en cocher 2 »)', () => {
  assert.deepEqual(gemmesAuChoix([['ambre'], ['grenat']]), { imposees: ['ambre', 'grenat'], auChoix: [], max: 0 });
  assert.deepEqual(gemmesAuChoix([['turquoise', 'perle', 'diamant-rose', 'onix']]), { imposees: [], auChoix: ['turquoise', 'perle', 'diamant-rose', 'onix'], max: 2 });
  assert.deepEqual(gemmesAuChoix([['onix'], ['grenat', 'malachite']]), { imposees: ['onix'], auChoix: ['grenat', 'malachite'], max: 1 });
  assert.deepEqual(gemmesCochees([['turquoise', 'perle', 'diamant-rose', 'onix']], ['perle', 'chocolat', 'perle', 'onix', 'turquoise']), ['perle', 'onix']);
  assert.deepEqual(gemmesCochees([['onix'], ['grenat', 'malachite']], ['onix', 'malachite', 'grenat']), ['malachite']);
  assert.deepEqual(gemmesCochees([['ambre'], ['grenat']], ['ambre']), []);
  const s = ecrireEtat('', { effet: 'caracteristique:intelligence', gemmes: 'perle,onix' });
  assert.equal(lireEtat(s).gemmes, 'perle,onix');
});

test('prix d’un accessoire aux gemmes au choix : quarts (en RF) + monture (en RO)', () => {
  assert.equal(prixDeLAccessoire([5700, 4700], 100), 204);
  assert.equal(prixDeLAccessoire([1000, 800], 5), 23);
  assert.equal(prixDeLAccessoire([], 5), null);
  assert.equal(prixDeLAccessoire([1000, Number.NaN], 5), null);
  assert.equal(prixDeLAccessoire([1000], Number.NaN), null);
});

test('bonus d’acquis : un entier borné aux plages écrites ; une saisie qui n’est pas un nombre donne le plus petit', () => {
  assert.equal(bonusBorne(7, 1, 20), 7);
  assert.equal(bonusBorne('12', 1, 20), 12);
  assert.equal(bonusBorne(0, 1, 20), 1);
  assert.equal(bonusBorne(25, 1, 20), 20);
  assert.equal(bonusBorne('7,6', 1, 20), 8);
  assert.equal(bonusBorne('', 1, 20), 1);
  assert.equal(bonusBorne('abc', 1, 20), 1);
  assert.equal(bonusBorne(-Infinity, 1, 20), 1);
  const niveaux = [{ min: 1, max: 5, niveau: 1 }, { min: 6, max: 10, niveau: 2 }, { min: 11, max: 15, niveau: 3 }, { min: 16, max: 20, niveau: 4 }];
  assert.deepEqual([1, 5, 6, 10, 11, 16, 20].map((b) => dansLaPlage(niveaux, bonusBorne(b, 1, 20)).niveau), [1, 1, 2, 2, 3, 4, 4]);
});

const NIVEAUX = [
  { valeur: 'competence:force:1', niveau: 1, min: 1, max: 5 },
  { valeur: 'competence:force:2', niveau: 2, min: 6, max: 10 },
  { valeur: 'competence:force:3', niveau: 3, min: 11, max: 15 },
  { valeur: 'competence:force:4', niveau: 4, min: 16, max: 20 },
];

test('une ligne des compétences : le bonus d’acquis (curseur, saisie, dé) donne l’effet du niveau dont la plage le contient', () => {
  assert.deepEqual(effetDuBonus(NIVEAUX, 12), { bonus: 12, effet: NIVEAUX[2] });
  assert.deepEqual(effetDuBonus(NIVEAUX, '6'), { bonus: 6, effet: NIVEAUX[1] });
  assert.deepEqual(effetDuBonus(NIVEAUX, 35), { bonus: 20, effet: NIVEAUX[3] }, 'borné au plus grand bonus écrit');
  assert.deepEqual(effetDuBonus(NIVEAUX, -Infinity), { bonus: 1, effet: NIVEAUX[0] }, 'la ligne telle que construite');
  assert.equal(effetDuBonus([], 3), null);
});

test('une ligne des compétences d’après l’adresse : le bonus s’il est dans la plage de l’effet, sinon le plus petit de cette plage', () => {
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', '12'), 12);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', '18'), 11, 'hors de la plage : l’effet de l’adresse fait foi');
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', null), 11);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', ''), 11);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:force:3', '12.5'), 11);
  assert.equal(bonusDeLAdresse(NIVEAUX, 'competence:agilite:3', '12'), null, 'un effet d’une autre ligne');
});

test('l’ancre d’un onglet d’effets n’est pas gardée dans l’adresse ; les autres le sont', () => {
  assert.equal(ancreGardee('#effets-attaque'), '');
  assert.equal(ancreGardee('#acc-monture'), '#acc-monture');
  assert.equal(ancreGardee(''), '');
  // dans la page « Équipement » : l'onglet Accessoires prend sa place (une adresse sans ancre rouvrirait le premier onglet de la page)
  assert.equal(ancreGardee('#effets-attaque', '#accessoires'), '#accessoires');
  assert.equal(ancreGardee('#acc-monture', '#accessoires'), '#acc-monture');
});
