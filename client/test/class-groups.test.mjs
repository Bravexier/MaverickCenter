import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLASS_COLORS, classCategory, classColor, groupClasses } from '../src/lib/class-groups.mjs';

const page = (title, ...tags) => ({ id: `classes/${title.toLowerCase()}`, data: { title, tags: ['classe', ...tags] } });
const titles = (section) => section.entries.map((e) => e.data.title);

const sample = [
  page('Mage', 'magique'),
  page('Parleur', 'càc'),
  page('Guerrier', 'càc'),
  page('Archer', 'distance'),
  page('Kitsune (classe)', 'hybride animal'),
  page('Archimage', 'spéciale'),
  page('Flagelleur', 'hybride'),
  page('Bimane', 'càc'),
  page('Arbalétrier', 'distance'),
  page('Anansi (classe)', 'hybride animal'),
];

test('les classes sont rangées dans l’ordre : physiques (mêlée puis distance), magiques, raciales, autres', () => {
  const groups = groupClasses(sample);
  assert.deepEqual(groups.map((g) => g.key), ['physiques', 'magiques', 'raciales', 'autres']);
  assert.deepEqual(groups[0].sections.map((s) => s.key), ['melee', 'distance']);
  assert.deepEqual(groups.map((g) => g.label), ['Physiques', 'Magiques', 'Raciales', 'Autres']);
  assert.deepEqual(groups[0].sections.map((s) => s.label), ['Mêlée', 'Distance']);
});

test('chaque section est triée par titre, en ignorant la casse et les accents', () => {
  const [physiques, , raciales] = groupClasses(sample);
  assert.deepEqual(titles(physiques.sections[0]), ['Bimane', 'Guerrier']);
  assert.deepEqual(titles(physiques.sections[1]), ['Arbalétrier', 'Archer']);
  assert.deepEqual(titles(raciales.sections[0]), ['Anansi (classe)', 'Kitsune (classe)']);
});

test('« Autres » réunit l’Archimage (spéciale), le Flagelleur (hybride) et le Parleur, sortis de « mêlée » à la demande du propriétaire', () => {
  const groups = groupClasses(sample);
  const autres = groups.find((g) => g.key === 'autres');
  assert.deepEqual(autres.sections.map((s) => [s.key, s.label, titles(s)]), [['autres', null, ['Archimage', 'Flagelleur', 'Parleur']]]);
  assert.deepEqual(titles(groups[0].sections[0]), ['Bimane', 'Guerrier'], 'le Parleur n’est plus dans la mêlée');
});

test('une classe sans catégorie reconnue n’est pas perdue : section « Non classées »', () => {
  const groups = groupClasses([...sample, page('Mystère', 'autre-chose'), { id: 'classes/sans', data: { title: 'Sans tags', tags: [] } }]);
  const autres = groups.find((g) => g.key === 'autres');
  const last = autres.sections.at(-1);
  assert.equal(last.key, 'non-classees');
  assert.deepEqual(titles(last), ['Mystère', 'Sans tags']);
  assert.equal(groups.flatMap((g) => g.sections).flatMap((s) => s.entries).length, sample.length + 2);
});

test('les groupes et sections vides sont omis', () => {
  const groups = groupClasses([page('Mage', 'magique'), page('Archer', 'distance')]);
  assert.deepEqual(groups.map((g) => g.key), ['physiques', 'magiques']);
  assert.deepEqual(groups[0].sections.map((s) => s.key), ['distance']);
  assert.deepEqual(groupClasses([]), []);
});

test('les tags sont comparés sans tenir compte de la casse ni des accents', () => {
  const groups = groupClasses([page('A', 'CÀC'), page('B', 'Distance'), page('C', 'SPECIALE'), page('D', 'Hybride Animal')]);
  assert.deepEqual(groups.flatMap((g) => g.sections.map((s) => `${g.key}/${s.key}`)), [
    'physiques/melee',
    'physiques/distance',
    'raciales/hybride-animal',
    'autres/autres',
  ]);
});

test('une classe qui porte deux tags de catégorie n’apparaît qu’une fois, dans la première catégorie affichée', () => {
  const groups = groupClasses([page('Double', 'magique', 'càc')]);
  assert.deepEqual(groups.map((g) => g.key), ['physiques']);
  assert.deepEqual(titles(groups[0].sections[0]), ['Double']);
});

test('le tri ne modifie pas la liste d’origine', () => {
  const input = [page('Zèbre', 'càc'), page('Abeille', 'càc')];
  const copy = [...input];
  groupClasses(input);
  assert.deepEqual(input, copy);
});

test('classCategory donne le groupe et la section d’une classe, ou rien pour une autre page', () => {
  assert.deepEqual(classCategory(page('Archer', 'distance')), { group: 'Physiques', groupKey: 'physiques', section: 'Distance', sectionKey: 'distance' });
  assert.deepEqual(classCategory(page('Mage', 'magique')), { group: 'Magiques', groupKey: 'magiques', section: null, sectionKey: 'magiques' });
  assert.deepEqual(classCategory(page('Kitsune (classe)', 'hybride animal')), { group: 'Raciales', groupKey: 'raciales', section: null, sectionKey: 'hybride-animal' });
  assert.deepEqual(classCategory(page('Archimage', 'spéciale')), { group: 'Autres', groupKey: 'autres', section: null, sectionKey: 'autres' });
  assert.equal(classCategory(page('Mystère', 'autre')), null);
});

test('l’exception du Parleur suit l’identifiant de la page, pas son titre ni ses tags', () => {
  assert.equal(classCategory({ id: 'classes/parleur', data: { title: 'Autre titre', tags: ['classe', 'càc'] } }).groupKey, 'autres');
  assert.equal(classCategory({ id: 'classes/autre-page', data: { title: 'Parleur', tags: ['classe', 'càc'] } }).groupKey, 'physiques');
});

test('couleur d’une classe d’après sa rubrique : rouge (mêlée), vert (distance), bleu (magiques), violet (raciales), jaune (autres, Parleur compris)', () => {
  const couleur = (titre) => classColor(sample.find((e) => e.data.title === titre));
  assert.equal(couleur('Guerrier'), CLASS_COLORS.melee);
  assert.equal(couleur('Archer'), CLASS_COLORS.distance);
  assert.equal(couleur('Mage'), CLASS_COLORS.magiques);
  assert.equal(couleur('Kitsune (classe)'), CLASS_COLORS['hybride-animal']);
  assert.equal(couleur('Archimage'), CLASS_COLORS.autres);
  assert.equal(couleur('Flagelleur'), CLASS_COLORS.autres);
  assert.equal(couleur('Parleur'), CLASS_COLORS.autres, 'exception du propriétaire : le Parleur est rangé sous « Autres »');
  assert.equal(classColor(page('Inconnue', 'autre-chose')), CLASS_COLORS.autres, 'une classe non classée va sous « Autres »');
  assert.equal(new Set(Object.values(CLASS_COLORS)).size, 5);
});
