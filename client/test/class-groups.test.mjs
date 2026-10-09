import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLASS_COLORS, CLASS_GROUPS, classCategory, classColor, groupClasses } from '../src/lib/class-groups.mjs';

const page = (title, ...tags) => ({ id: `classes/${title.toLowerCase()}`, data: { title, tags: ['classe', ...tags] } });
const titles = (section) => section.entries.map((e) => e.data.title);
const keys = (groups) => groups.map((g) => g.key);

const sample = [
  page('Mage', 'magique'),
  page('Parleur', 'càc'),
  page('Guerrier', 'càc'),
  page('Archer', 'distance'),
  page('Kitsune', 'hybride animal'),
  page('Archimage', 'spéciale'),
  page('Flagelleur', 'hybride'),
  page('Bimane', 'càc'),
  page('Arbalétrier', 'distance'),
  page('Anansi', 'hybride animal'),
];

test('cinq catégories, dans l’ordre : physiques mêlée, physiques distance, magiques, raciales, spéciales', () => {
  const groups = groupClasses(sample);
  assert.deepEqual(keys(groups), ['melee', 'distance', 'magiques', 'raciales', 'speciales']);
  assert.deepEqual(groups.map((g) => g.label), ['Physiques Mêlée', 'Physiques Distance', 'Magiques', 'Raciales', 'Spéciales']);
  assert.deepEqual(keys(CLASS_GROUPS), keys(groups));
  for (const g of groups) assert.deepEqual(g.sections.map((s) => [s.key, s.label]), [[g.key, null]], `${g.key} : une seule liste, sans sous-titre`);
});

test('chaque catégorie est triée par nom, en ignorant la casse et les accents', () => {
  const [melee, distance, , raciales] = groupClasses(sample);
  assert.deepEqual(titles(melee.sections[0]), ['Bimane', 'Guerrier']);
  assert.deepEqual(titles(distance.sections[0]), ['Arbalétrier', 'Archer']);
  assert.deepEqual(titles(raciales.sections[0]), ['Anansi', 'Kitsune']);
});

test('« Spéciales » réunit l’Archimage (spéciale), le Flagelleur (hybride) et le Parleur, sorti de la mêlée à la demande du propriétaire', () => {
  const groups = groupClasses(sample);
  const speciales = groups.find((g) => g.key === 'speciales');
  assert.deepEqual(speciales.sections.map((s) => [s.key, s.label, titles(s)]), [['speciales', null, ['Archimage', 'Flagelleur', 'Parleur']]]);
  assert.deepEqual(titles(groups[0].sections[0]), ['Bimane', 'Guerrier'], 'le Parleur n’est plus dans la mêlée');
});

test('une classe sans catégorie reconnue n’est pas perdue : section « Non classées », sous « Spéciales »', () => {
  const groups = groupClasses([...sample, page('Mystère', 'autre-chose'), { id: 'classes/sans', data: { title: 'Sans tags', tags: [] } }]);
  const last = groups.at(-1);
  assert.equal(last.key, 'speciales');
  assert.deepEqual(last.sections.at(-1), { key: 'non-classees', label: 'Non classées', entries: last.sections.at(-1).entries });
  assert.deepEqual(titles(last.sections.at(-1)), ['Mystère', 'Sans tags']);
  assert.equal(groups.flatMap((g) => g.sections).flatMap((s) => s.entries).length, sample.length + 2);
  // sans classe spéciale, la catégorie n'existe que pour les non classées
  const seules = groupClasses([page('Mage', 'magique'), page('Mystère', 'autre-chose')]);
  assert.deepEqual(seules.map((g) => [g.key, g.sections.map((s) => s.key)]), [['magiques', ['magiques']], ['speciales', ['non-classees']]]);
});

test('les catégories vides sont omises', () => {
  assert.deepEqual(keys(groupClasses([page('Mage', 'magique'), page('Archer', 'distance')])), ['distance', 'magiques']);
  assert.deepEqual(groupClasses([]), []);
});

test('les tags sont comparés sans tenir compte de la casse ni des accents', () => {
  const groups = groupClasses([page('A', 'CÀC'), page('B', 'Distance'), page('C', 'SPECIALE'), page('D', 'Hybride Animal')]);
  assert.deepEqual(keys(groups), ['melee', 'distance', 'raciales', 'speciales']);
});

test('« hybride » (Flagelleur) et « hybride animal » (classes raciales) ne se confondent pas', () => {
  assert.equal(classCategory(page('Flagelleur', 'hybride')).key, 'speciales');
  assert.equal(classCategory(page('Fenrir', 'hybride animal')).key, 'raciales');
});

test('une classe qui porte deux tags de catégorie n’apparaît qu’une fois, dans la première catégorie affichée', () => {
  const groups = groupClasses([page('Double', 'magique', 'càc')]);
  assert.deepEqual(keys(groups), ['melee']);
  assert.deepEqual(titles(groups[0].sections[0]), ['Double']);
});

test('le tri ne modifie pas la liste d’origine', () => {
  const input = [page('Zèbre', 'càc'), page('Abeille', 'càc')];
  const copy = [...input];
  groupClasses(input);
  assert.deepEqual(input, copy);
});

test('le tri suit le titre, une classe raciale portant le nom de sa race', () => {
  const [raciales] = groupClasses([page('Mage Bleu', 'hybride animal'), page('Mage', 'hybride animal')]);
  assert.deepEqual(titles(raciales.sections[0]), ['Mage', 'Mage Bleu']);
});

test('classCategory donne la catégorie d’une classe, ou rien pour une autre page', () => {
  assert.deepEqual(classCategory(page('Guerrier', 'càc')), { key: 'melee', label: 'Physiques Mêlée' });
  assert.deepEqual(classCategory(page('Archer', 'distance')), { key: 'distance', label: 'Physiques Distance' });
  assert.deepEqual(classCategory(page('Mage', 'magique')), { key: 'magiques', label: 'Magiques' });
  assert.deepEqual(classCategory(page('Kitsune', 'hybride animal')), { key: 'raciales', label: 'Raciales' });
  assert.deepEqual(classCategory(page('Archimage', 'spéciale')), { key: 'speciales', label: 'Spéciales' });
  assert.equal(classCategory(page('Mystère', 'autre')), null);
});

test('l’exception du Parleur suit l’identifiant de la page, pas son titre ni ses tags', () => {
  assert.equal(classCategory({ id: 'classes/parleur', data: { title: 'Autre titre', tags: ['classe', 'càc'] } }).key, 'speciales');
  assert.equal(classCategory({ id: 'classes/autre-page', data: { title: 'Parleur', tags: ['classe', 'càc'] } }).key, 'melee');
});

test('couleur d’une classe d’après sa catégorie : rouge (mêlée), vert (distance), bleu (magiques), violet (raciales), jaune (spéciales, Parleur compris)', () => {
  const couleur = (titre) => classColor(sample.find((e) => e.data.title === titre));
  assert.equal(couleur('Guerrier'), CLASS_COLORS.melee);
  assert.equal(couleur('Archer'), CLASS_COLORS.distance);
  assert.equal(couleur('Mage'), CLASS_COLORS.magiques);
  assert.equal(couleur('Kitsune'), CLASS_COLORS.raciales);
  assert.equal(couleur('Archimage'), CLASS_COLORS.speciales);
  assert.equal(couleur('Flagelleur'), CLASS_COLORS.speciales);
  assert.equal(couleur('Parleur'), CLASS_COLORS.speciales, 'exception du propriétaire : le Parleur est rangé sous « Spéciales »');
  assert.equal(classColor(page('Inconnue', 'autre-chose')), CLASS_COLORS.speciales, 'une classe non classée va sous « Spéciales »');
  assert.deepEqual(Object.keys(CLASS_COLORS), keys(CLASS_GROUPS), 'une couleur par catégorie');
  assert.equal(new Set(Object.values(CLASS_COLORS)).size, 5);
});
