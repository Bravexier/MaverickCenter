import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize } from '../src/lib/text.mjs';
import { buildIndex, entryUrl, extractLinks, remarkWikilinks, resolve, splitFrontmatter } from '../src/lib/wikilinks.mjs';

const index = buildIndex([
  { id: 'races/elfe', type: 'races', slug: 'elfe', title: 'Elfe', aliases: ['Haut-Elfe', "Fils de l'aube"] },
  { id: 'classes/mage', type: 'classes', slug: 'mage', title: 'Mage', aliases: [] },
  { id: 'bestiaire/ombre', type: 'bestiaire', slug: 'ombre', title: 'Ombre', aliases: [] },
  { id: 'lore/ombre', type: 'lore', slug: 'ombre', title: 'Ombre', aliases: [] },
]);

test('normalize ignore casse, accents et apostrophes', () => {
  assert.equal(normalize("L’Éveillé d'Ôrn"), 'leveille-dorn');
  assert.equal(normalize('  Haut-Elfe '), 'haut-elfe');
});

test('resolve trouve par titre, alias, slug et id qualifié', () => {
  assert.equal(resolve(index, 'elfe').entry.id, 'races/elfe');
  assert.equal(resolve(index, 'HAUT ELFE').entry.id, 'races/elfe');
  assert.equal(resolve(index, "fils de l'aube").entry.id, 'races/elfe');
  assert.equal(resolve(index, 'classes/mage').entry.id, 'classes/mage');
});

test('resolve signale les titres ambigus et les pages absentes', () => {
  assert.equal(resolve(index, 'ombre').ambiguous.length, 2);
  assert.equal(resolve(index, 'lore/ombre').entry.id, 'lore/ombre');
  assert.equal(resolve(index, 'inconnu'), null);
  assert.equal(resolve(index, 'races/inconnu'), null);
});

test('extractLinks ignore les blocs et codes en ligne', () => {
  const body = 'Un [[Elfe]] et [[Mage|le sorcier]].\n`[[Ignoré]]`\n```\n[[Ignoré aussi]]\n```\n';
  assert.deepEqual(extractLinks(body), [
    { target: 'Elfe', label: 'Elfe' },
    { target: 'Mage', label: 'le sorcier' },
  ]);
});

test('entryUrl respecte le préfixe de déploiement', () => {
  const entry = index.byId.get('races/elfe');
  assert.equal(entryUrl('/', entry), '/wiki/races/elfe/');
  assert.equal(entryUrl('/MaverickCenter/', entry), '/MaverickCenter/wiki/races/elfe/');
});

test('splitFrontmatter lit le YAML et rend le corps', () => {
  const { data, body } = splitFrontmatter('---\ntitle: Elfe\ntags: [a, b]\n---\nCorps\n');
  assert.deepEqual(data, { title: 'Elfe', tags: ['a', 'b'] });
  assert.equal(body, 'Corps\n');
  assert.deepEqual(splitFrontmatter('Sans en-tête'), { data: {}, body: 'Sans en-tête' });
});

test('remarkWikilinks remplace les liens, marque les manquants, épargne les liens existants', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnings.push(msg);
  try {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Voir [[Elfe]], [[Mage|ce mage]] et [[Fantôme]] puis [[Ombre]].' },
            { type: 'link', url: 'x', children: [{ type: 'text', value: '[[Elfe]]' }] },
            { type: 'inlineCode', value: '[[Elfe]]' },
          ],
        },
      ],
    };
    remarkWikilinks({ index, base: '/' })(tree, { path: 'test.md' });
    const kids = tree.children[0].children;

    const links = kids.filter((n) => n.type === 'link' && n.data);
    assert.deepEqual(links.map((n) => n.url), ['/wiki/races/elfe/', '/wiki/classes/mage/']);
    assert.equal(links[1].children[0].value, 'ce mage');

    const missing = kids.filter((n) => n.data?.hProperties?.className?.includes('wikilink--missing'));
    assert.deepEqual(missing.map((n) => n.data.hProperties.title), ['Page introuvable', 'Page ambigu']);

    // le lien existant et le code en ligne restent intacts
    assert.equal(kids.find((n) => n.url === 'x').children[0].value, '[[Elfe]]');
    assert.equal(kids.at(-1).value, '[[Elfe]]');
    assert.equal(warnings.length, 2);
  } finally {
    console.warn = originalWarn;
  }
});

test('scanContent peut écarter les pages status: example', async () => {
  const { scanContent } = await import('../src/lib/wikilinks.mjs');
  const dir = new URL('./fixtures/wiki', import.meta.url).pathname;
  const ids = (entries) => entries.map((e) => e.id).sort();
  assert.deepEqual(ids(scanContent(dir)), ['guide/sans-statut', 'races/demo', 'races/vrai']);
  assert.deepEqual(ids(scanContent(dir, { includeExamples: false })), ['guide/sans-statut', 'races/vrai']);
});

test('remarkWikilinks ne signale pas les liens manquants des pages status: example', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnings.push(msg);
  try {
    const make = () => ({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: '[[Fantôme]]' }] }] });
    const run = remarkWikilinks({ index, base: '/' });
    run(make(), { path: 'demo.md', data: { astro: { frontmatter: { status: 'example' } } } });
    assert.equal(warnings.length, 0);
    run(make(), { path: 'vrai.md', data: { astro: { frontmatter: { status: 'draft' } } } });
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('resolve : un titre contenant « / » reste résolu ; un id qualifié inconnu ne l\'est pas', () => {
  const idx = buildIndex([{ id: 'guide/resistance-faiblesse-magie', type: 'guide', slug: 'resistance-faiblesse-magie', title: 'Résistance/Faiblesse Magie', aliases: [] }]);
  assert.equal(resolve(idx, 'Résistance/Faiblesse Magie').entry.id, 'guide/resistance-faiblesse-magie');
  assert.equal(resolve(idx, 'guide/resistance-faiblesse-magie').entry.id, 'guide/resistance-faiblesse-magie');
  assert.equal(resolve(idx, 'guide/inconnu'), null);
});
