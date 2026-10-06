import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bonusAM } from '../src/lib/classe-bonus.mjs';

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

test('toute classe magique offre +4 AM : c’est la note du Sommaire du classeur des classes', () => {
  assert.deepEqual(bonusAM(ALL, barde), { valeur: 4, portee: 'classe', specialite: null, cartouche: null, source: 'sommaire' });
});

test('classe raciale : +4 AM avec la spécialité dont la capacité de niveau 10 dit « considérer comme classe magique »', () => {
  const r = bonusAM(ALL, orios);
  assert.equal(r.valeur, 4);
  assert.equal(r.portee, 'specialite');
  assert.equal(r.specialite, 'CHAMAN');
  assert.equal(r.cartouche.id, 'capacites/orios-chaman');
  assert.equal(r.source, 'specialite');
});

test('la spécialité est reconnue au texte de sa capacité, pas à son rang ni à l’ordre des pages', () => {
  assert.equal(bonusAM([orios, chaman, vaTEnGuerre], orios).specialite, 'CHAMAN');
  const inverse = [orios, cartouche('orios', 'va-t-en-guerre', 'VA-T-EN GUERRE', 2, 'considérer comme classe magique'), cartouche('orios', 'chaman', 'CHAMAN', 1, '+5% Vigueur')];
  assert.equal(bonusAM(inverse, orios).specialite, 'VA-T-EN GUERRE');
});

test('les variantes d’écriture de la phrase comptent (« Concidérer comme une classe magique », points, majuscules)', () => {
  for (const texte of ['Concidérer comme une classe magique, 2 points de maîtrise à répartir.', 'Maîtrise les armures intermédiaires considérer comme classe magique.', 'CONSIDÉRER COMME CLASSE MAGIQUE']) {
    const e = [orios, cartouche('orios', 'chaman', 'CHAMAN', 2, texte)];
    assert.equal(bonusAM(e, orios)?.specialite, 'CHAMAN', texte);
  }
});

test('« la classe est concidérée comme magique » (Flagelleur : faute de frappe et participe passé) compte aussi', () => {
  const masochiste = cartouche('flagelleur', 'masochiste', 'MASOCHISTE', 2, "La résistance magique permet de réduire les dégâts des altérations d'états, +2 points de maîtrise à répartir, la classe est concidérée comme magique.");
  const sadique = cartouche('flagelleur', 'sadique', 'SADIQUE', 1, '+7% Arme légères OU lourdes, 7% intimidation, +2 points de maîtrise à répartir');
  const r = bonusAM([flagelleur, sadique, masochiste], flagelleur);
  assert.equal(r?.specialite, 'MASOCHISTE');
  assert.equal(r?.source, 'specialite');
  for (const texte of ['la classe est considérée comme magique', 'considérée comme classe magique', 'Concidérer comme une classe magique']) {
    assert.equal(bonusAM([flagelleur, cartouche('flagelleur', 'masochiste', 'MASOCHISTE', 2, texte)], flagelleur)?.specialite, 'MASOCHISTE', texte);
  }
  for (const texte of ['La magie est considérée comme dangereuse', 'Les armes sont considérées comme magiques', 'Ses attaques sont considérées comme magique pendant 2 tours']) {
    assert.equal(bonusAM([flagelleur, cartouche('flagelleur', 'masochiste', 'MASOCHISTE', 2, texte)], flagelleur), null, `une phrase voisine ne suffit pas : ${texte}`);
  }
});

test('classe raciale dont aucune capacité ne dit « classe magique » : aucun bonus, rien n’est deviné', () => {
  assert.equal(bonusAM([orios, vaTEnGuerre], orios), null);
  assert.equal(bonusAM([orios], orios), null);
});

test('l’Archimage : la fiche de personnage V15.2.2 le compte parmi les classes magiques pour l’AM', () => {
  assert.deepEqual(bonusAM(ALL, archimage), { valeur: 4, portee: 'classe', specialite: null, cartouche: null, source: 'fiche' });
});

test('les autres classes (physiques, hybride) n’ont aucun bonus d’AM de classe', () => {
  for (const c of [guerrier, archer, flagelleur]) assert.equal(bonusAM(ALL, c), null, c.id);
});
