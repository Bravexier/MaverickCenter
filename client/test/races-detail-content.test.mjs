// Intégrité du contenu RÉEL des pages de races issu de l'onglet de chaque race du classeur « Les races »
// (tools/sheets/races.py) : sections attendues, source de l'onglet, valeurs de départ de l'onglet, écarts avec la fiche.
// L'onglet de la race PRIME sur la « Fiche personnage Maverick Auto V15.2.2 » (décision du propriétaire du projet) :
// la page affiche l'onglet et liste dans « Écarts avec la fiche de personnage V15.2.2 » ce que la fiche dit de différent.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';

const dir = fileURLToPath(new URL('../src/content/wiki/races', import.meta.url));
const races = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ slug: f.replace(/\.md$/, ''), ...splitFrontmatter(readFileSync(`${dir}/${f}`, 'utf8')) }))
  .filter((e) => e.data.status !== 'example');
const race = (slug) => races.find((r) => r.slug === slug);
const titles = (body) => [...body.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
const section = (body, title) => body.split(new RegExp(`^## ${title.replace(/[()]/g, '\\$&')}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? '';
const tableRows = (text) => text.split('\n').filter((l) => l.startsWith('|')).map((l) => l.slice(1, -1).split(' | ').map((c) => c.trim()));

const ORDRE = ['Présentation', 'Histoire', 'Description', 'Caractéristiques de départ', 'Avantage(s) et inconvénient(s)', 'Don de base', 'Ethnies et dons raciaux', 'Capacité Mode Hyper'];

test('les 27 races portent les sections de leur onglet, dans l’ordre, puis les matrices de la fiche', () => {
  assert.equal(races.length, 27);
  for (const r of races) {
    const t = titles(r.body);
    const at = ORDRE.map((s) => t.indexOf(s));
    assert.ok(at.every((i) => i >= 0), `${r.slug} : section de l'onglet absente (${t.join(' | ')})`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, `${r.slug} : sections dans le désordre`);
    assert.ok(t.indexOf('Classes accessibles') > at.at(-1) && t.indexOf('Magies accessibles') > t.indexOf('Classes accessibles'), r.slug);
    assert.ok(!t.includes('Don base') && !t.includes('Capacité Hyper'), `${r.slug} : anciennes sections de la fiche`);
  }
});

test('chaque page cite l’onglet de sa race dans `sources`, et le Nain n’a plus de capture d’écran', () => {
  for (const r of races) {
    const onglet = r.data.sources.filter((s) => /^Google Sheet « Les races », onglet « (?!première feuille)/.test(s));
    assert.equal(onglet.length, 1, `${r.slug} : une entrée d'onglet attendue`);
  }
  assert.ok(race('nain').data.sources.includes('Google Sheet « Les races », onglet « Nain »'));
  assert.ok(race('namazu').data.sources.includes('Google Sheet « Les races », onglet « Namazus »'), 'l’onglet « Namazus » est la race Namazu');
  assert.doesNotMatch(race('nain').data.sources.join(' '), /capture/i);
});

test('les valeurs de départ sont celles de l’onglet (Santé, Chakra, Barrière, Vitesse sol / nage), AP et AM restent celles de la fiche', () => {
  const attendu = { humain: ['10', '10', '0', '4 / 4'], nain: ['16', '4', '0', '3 / 3'], drakos: ['13', '10', '0', '4 / 3'], olwman: ['8', '12', '0', '6 / 0'] };
  for (const [slug, valeurs] of Object.entries(attendu)) {
    const [entetes, , ligne] = tableRows(section(race(slug).body, 'Caractéristiques de départ'));
    assert.deepEqual(entetes.slice(0, 4), ['Santé de départ', 'Chakra de départ', 'Barrière bonus', 'Vitesse Sol/Nage'], slug);
    assert.deepEqual(ligne.slice(0, 4), valeurs, slug);
    assert.deepEqual(entetes.slice(4), ['AP (fiche)', 'AM (fiche)'], slug);
  }
});

test('Avantage(s), Inconvénient(s), don de base et capacité Mode Hyper sont ceux de l’onglet', () => {
  const nain = race('nain').body;
  assert.match(section(nain, 'Avantage(s) et inconvénient(s)'), /\*\*Avantage\(s\)\*\* : Les armures lourdes ne les ralenties pas, accès à toutes les classes\./);
  assert.match(section(nain, 'Avantage(s) et inconvénient(s)'), /\*\*Inconvénient\(s\)\*\* : Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné uniquement\./);
  for (const r of races) assert.match(section(r.body, 'Don de base'), /^(?:Méditation|Repos) \(Action 3 fois\/jour\)/m, r.slug);
  assert.match(section(race('humain').body, 'Capacité Mode Hyper'), /^\*\*Adrénaline\*\* : 1d de dégâts en plus/m);
});

test('chaque ethnie de l’onglet affiche la sous-race de la fiche qui lui correspond (« Londolor Ouest » = « Nain Ouest »)', () => {
  const nain = section(race('nain').body, 'Ethnies et dons raciaux');
  assert.match(nain, /### Londolor Ouest[\s\S]*?\*\*Fiche de personnage V15\.2\.2\*\* : sous-race « Nain Ouest »/);
  assert.match(nain, /### Londolor Est[\s\S]*?sous-race « Nain Est »/);
  const drakos = section(race('drakos').body, 'Ethnies et dons raciaux');
  assert.equal(tableRows(drakos).length - 2, 15, 'les 15 magies de l’Écaille draconique');
  assert.match(drakos, /\| Feu \| 4AP\/0AM \| 5% Intimidation \| Brûlure \| Drakos Rouge \|/);
});

test('les écarts avec la fiche sont listés, la valeur de la fiche citée telle quelle (Drakos : Santé 13 / Chakra 10 contre 10.0 / 13.0 ; Nain : 5 magies contre 15)', () => {
  const rows = (slug) => tableRows(section(race(slug).body, 'Écarts avec la fiche de personnage V15.2.2')).slice(2);
  const drakos = rows('drakos');
  assert.deepEqual(drakos.find((c) => c[0].startsWith('Santé de départ')).slice(1), ['13', '10.0']);
  assert.deepEqual(drakos.find((c) => c[0].startsWith('Chakra de départ')).slice(1), ['10', '13.0']);
  const nain = rows('nain').find((c) => c[0].startsWith('Magies innées'));
  assert.match(nain[1], /\(5 sur 15\)$/);
  assert.match(nain[2], /\(15 sur 15\)$/);
  assert.ok(rows('humain').some((c) => c[0].startsWith('Don de base')), 'le don de base de la fiche (2d6 chakra) diffère de l’onglet (3d6 + 6)');
  assert.equal(rows('humain').length, 1, 'Humain : seul le don de base diffère');
});

test('les sections de la fiche restent affichées telles quelles et signalent leur provenance', () => {
  for (const r of races) {
    assert.match(section(r.body, 'Sous-races et origines'), /^Section issue de la fiche de personnage V15\.2\.2/m, r.slug);
    assert.match(section(r.body, 'Caractéristiques de départ'), /AP \(fiche\)/, r.slug);
  }
});
