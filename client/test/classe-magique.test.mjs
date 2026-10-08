import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMagicalClass, isMagicalSpecialization } from '../src/lib/classe-magique.mjs';

const classe = (slug, title, ...tags) => ({ id: `classes/${slug}`, data: { title, tags: ['classe', ...tags] } });
const cartouche = (classeSlug, slug, specialite, rang, body = '') => ({
  id: `capacites/${classeSlug}-${slug}`,
  data: { title: `${specialite} (${classeSlug})`, classe: `classes/${classeSlug}`, nature: 'specialite', specialite, niveau: 10, rang, ligne: 22 },
  body,
});

const barde = classe('barde', 'Barde', 'magique');
const guerrier = classe('guerrier', 'Guerrier', 'càc');
const archer = classe('archer', 'Archer', 'distance');
const orios = classe('orios', 'Orios (classe)', 'hybride animal');
const archimage = classe('archimage', 'Archimage', 'spéciale');
const flagelleur = classe('flagelleur', 'Flagelleur', 'hybride');
// Textes des cartouches de niveau 10 de l'onglet « Orios » (cellules X23 et AA23).
const vaTEnGuerre = cartouche('orios', 'va-t-en-guerre', 'VA-T-EN GUERRE', 1, '+5% Arme légères et lourdes, +5% Arc. Maîtrise les Armures Intermédiaires, 2 points de maîtrise à répartir.');
const chaman = cartouche('orios', 'chaman', 'CHAMAN', 2, '+5% Magie et concentration, +5% Vigueur, +2 point de maîtrise à répartir, Maîtrise les Armures Intermédiaires, considérer comme classe magique');
const ALL = [barde, guerrier, archer, orios, archimage, flagelleur, vaTEnGuerre, chaman];

test('une classe portant le type magique est reconnue comme telle', () => {
  assert.equal(isMagicalClass(ALL, barde), true);
  assert.equal(isMagicalClass(ALL, barde, chaman), false, 'une spécialité d’une autre classe ne correspond pas');
});

test('une classe est magique si une de ses spécialités le précise, mais seule cette spécialité l’est', () => {
  assert.equal(isMagicalClass(ALL, orios), true);
  assert.equal(isMagicalClass(ALL, orios, chaman), true);
  assert.equal(isMagicalClass(ALL, orios, vaTEnGuerre), false);
  assert.equal(isMagicalSpecialization(chaman), true);
  assert.equal(isMagicalSpecialization(vaTEnGuerre), false);
});

test('la spécialité magique est reconnue à son texte, pas à son rang ni à l’ordre des pages', () => {
  assert.equal(isMagicalClass([orios, chaman, vaTEnGuerre], orios), true);
  assert.equal(isMagicalClass([orios, chaman, vaTEnGuerre], orios, chaman), true);
  const inverse = [orios, cartouche('orios', 'va-t-en-guerre', 'VA-T-EN GUERRE', 2, 'considérer comme classe magique'), cartouche('orios', 'chaman', 'CHAMAN', 1, '+5% Vigueur')];
  assert.equal(isMagicalClass(inverse, orios, inverse[1]), true);
  assert.equal(isMagicalClass(inverse, orios, inverse[2]), false);
});

test('les variantes d’écriture de la phrase comptent (« Concidérer comme une classe magique », points, majuscules)', () => {
  for (const texte of ['Concidérer comme une classe magique, 2 points de maîtrise à répartir.', 'Maîtrise les armures intermédiaires considérer comme classe magique.', 'CONSIDÉRER COMME CLASSE MAGIQUE']) {
    const e = [orios, cartouche('orios', 'chaman', 'CHAMAN', 2, texte)];
    assert.equal(isMagicalSpecialization(e[1]), true, texte);
  }
});

test('« la classe est concidérée comme magique » (Flagelleur : faute de frappe et participe passé) compte aussi', () => {
  const masochiste = cartouche('flagelleur', 'masochiste', 'MASOCHISTE', 2, "La résistance magique permet de réduire les dégâts des altérations d'états, +2 points de maîtrise à répartir, la classe est concidérée comme magique.");
  const sadique = cartouche('flagelleur', 'sadique', 'SADIQUE', 1, '+7% Arme légères OU lourdes, 7% intimidation, +2 points de maîtrise à répartir');
  assert.equal(isMagicalClass([flagelleur, sadique, masochiste], flagelleur), true);
  assert.equal(isMagicalClass([flagelleur, sadique, masochiste], flagelleur, masochiste), true);
  assert.equal(isMagicalClass([flagelleur, sadique, masochiste], flagelleur, sadique), false);
  for (const texte of ['la classe est considérée comme magique', 'considérée comme classe magique', 'Concidérer comme une classe magique']) {
    assert.equal(isMagicalSpecialization(cartouche('flagelleur', 'masochiste', 'MASOCHISTE', 2, texte)), true, texte);
  }
  for (const texte of ['La magie est considérée comme dangereuse', 'Les armes sont considérées comme magiques', 'Ses attaques sont considérées comme magique pendant 2 tours']) {
    assert.equal(isMagicalSpecialization(cartouche('flagelleur', 'masochiste', 'MASOCHISTE', 2, texte)), false, `une phrase voisine ne suffit pas : ${texte}`);
  }
});

test('classe raciale dont aucune spécialité ne dit « classe magique » : le type reste faux', () => {
  assert.equal(isMagicalClass([orios, vaTEnGuerre], orios), false);
  assert.equal(isMagicalClass([orios], orios), false);
});

test('l’Archimage : la fiche de personnage V15.2.2 le compte parmi les classes magiques', () => {
  assert.equal(isMagicalClass(ALL, archimage), true);
});

test('les autres classes (physiques, hybride) ne reçoivent pas le type magique', () => {
  for (const c of [guerrier, archer, flagelleur]) assert.equal(isMagicalClass(ALL, c), false, c.id);
});
