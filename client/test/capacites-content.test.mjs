// Intégrité du contenu RÉEL des capacités de classe (pages `capacites/*.md` posées par l'import de « Classe Maverick V7 »).
// La règle des choix exclusifs vient de la mise en page de l'onglet (capacités d'une même ligne = une seule au choix) et a été
// confirmée par le propriétaire du projet : ses exemples (Barde Ménestrel, Archimage) sont rejoués ici sur les vraies pages.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { asymmetricChoices, capacitesOfClass, checkSelection, unresolvedCapacites } from '../src/lib/capacites.mjs';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';

const dir = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const load = (type) =>
  readdirSync(`${dir}/${type}`)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ id: `${type}/${f.replace(/\.md$/, '')}`, ...splitFrontmatter(readFileSync(`${dir}/${type}/${f}`, 'utf8')) }))
    .filter((e) => e.data.status !== 'example');

const classes = load('classes');
const capacites = load('capacites');
const all = [...classes, ...capacites];
const classe = (slug) => classes.find((c) => c.id === `classes/${slug}`);
const id = (slug) => `capacites/${slug}`;

test('660 capacités, une page chacune, toutes rattachées à une classe qui existe', () => {
  assert.equal(capacites.length, 660);
  assert.deepEqual(unresolvedCapacites(all), []);
  const perClass = new Map();
  for (const c of capacites) perClass.set(c.data.classe, (perClass.get(c.data.classe) ?? 0) + 1);
  assert.equal(perClass.size, 39, 'les 39 classes ont des capacités');
  assert.equal(perClass.get('classes/barde'), 17);
  assert.equal(perClass.get('classes/archimage'), 14);
});

test('contrat du frontmatter : niveau entier, nature connue, titre « Nom (Classe) » unique, brouillon sourcé', () => {
  const titles = new Set();
  for (const c of capacites) {
    const d = c.data;
    assert.ok(Number.isInteger(d.niveau) && d.niveau >= 1, `${c.id} : niveau`);
    assert.ok(['classe', 'specialite', 'choix'].includes(d.nature), `${c.id} : nature`);
    assert.ok(Number.isInteger(d.rang) && d.rang >= 1, `${c.id} : rang`);
    assert.ok(Number.isInteger(d.ligne) && d.ligne >= 1, `${c.id} : ligne`);
    assert.match(c.id, /^capacites\/[a-z0-9]+(-[a-z0-9]+)*$/, `${c.id} : slug`);
    assert.ok(c.id.startsWith(`capacites/${d.classe.replace('classes/', '')}-`), `${c.id} : le slug commence par celui de la classe`);
    assert.ok(!titles.has(d.title), `${c.id} : titre en double « ${d.title} »`);
    titles.add(d.title);
    assert.equal(d.status, 'draft', c.id);
    assert.ok(d.sources.length >= 2, `${c.id} : sources`);
    if (d.nature === 'classe') assert.ok(!d.specialite, `${c.id} : une capacité de classe n'a pas de spécialité`);
    if (d.nature === 'specialite') assert.ok(d.specialite, `${c.id} : cartouche sans spécialité`);
  }
});

test('exclusivités : symétriques ; un groupe partage classe, niveau, ligne et nature, et la spécialité sauf pour les deux cartouches', () => {
  assert.deepEqual(asymmetricChoices(all), []);
  const byId = new Map(capacites.map((c) => [c.id, c]));
  for (const c of capacites) {
    for (const otherId of c.data.choix_exclusif_avec ?? []) {
      const o = byId.get(otherId);
      assert.equal(o.data.classe, c.data.classe, `${c.id} / ${otherId} : classe`);
      assert.equal(o.data.niveau, c.data.niveau, `${c.id} / ${otherId} : niveau`);
      assert.equal(o.data.ligne, c.data.ligne, `${c.id} / ${otherId} : ligne`);
      assert.equal(o.data.nature, c.data.nature, `${c.id} / ${otherId} : un cartouche n'est exclusif qu'avec un cartouche, un choix qu'avec un choix`);
      if (c.data.nature === 'specialite') {
        // Les deux cartouches d'une même ligne s'excluent précisément parce qu'ils sont de spécialités différentes.
        assert.notEqual(o.data.specialite, c.data.specialite, `${c.id} / ${otherId} : deux cartouches de la même spécialité`);
      } else {
        assert.equal(o.data.specialite, c.data.specialite, `${c.id} / ${otherId} : spécialité`);
      }
      assert.notEqual(o.id, c.id);
    }
    assert.equal(c.data.nature === 'classe', !(c.data.choix_exclusif_avec ?? []).length, `${c.id} : une capacité de classe est sans choix, les autres ont au moins une alternative`);
  }
});

test('chaque classe : soit deux spécialités (un cartouche chacune, exclusifs entre eux), soit des groupes sans spécialité (Archimage)', () => {
  for (const c of classes) {
    const r = capacitesOfClass(all, c);
    if (c.id === 'classes/archimage') {
      assert.equal(r.specialites.length, 0);
      assert.deepEqual(r.groupes.map((g) => g.options.length), [2, 3, 3, 3]);
      continue;
    }
    assert.equal(r.specialites.length, 2, `${c.id} : deux spécialités`);
    const [a, b] = r.specialites;
    assert.ok(a.cartouche && b.cartouche, `${c.id} : cartouche de spécialité`);
    assert.equal(checkSelection(all, [a.cartouche.id, b.cartouche.id]).conflits[0]?.raison, 'meme-choix', `${c.id} : les spécialités s'excluent`);
    for (const s of r.specialites) for (const g of s.groupes) assert.ok(g.options.length >= 2, `${c.id} / ${s.nom} : groupe d'une seule capacité au niveau ${g.niveau}`);
  }
});

test('exemple du propriétaire (Barde) : Ménestrel + Nouvel accord + Balade guerrière + Exaltation + Chant double, mais ni Danseur, ni Écho, ni Amplification, ni Touérk ! ensemble', () => {
  const ok = ['menestrel', 'nouvel-accord', 'balade-guerriere', 'exaltation', 'chant-double'].map((s) => id(`barde-${s}`));
  assert.deepEqual(checkSelection(all, ok), { ok: true, conflits: [], inconnues: [] });
  for (const [a, b] of [['nouvel-accord', 'echo'], ['balade-guerriere', 'amplification'], ['exaltation', 'touerk']]) {
    assert.equal(checkSelection(all, [id('barde-menestrel'), id(`barde-${a}`), id(`barde-${b}`)]).conflits.length, 1, `${a} / ${b}`);
  }
  assert.equal(checkSelection(all, [id('barde-menestrel'), id('barde-danseur')]).ok, false);
  assert.equal(checkSelection(all, [id('barde-menestrel'), id('barde-perroquet')]).ok, false);
});

test('exemple du propriétaire (Archimage) : Élémentaliste ou Occultiste, et un choix parmi trois à chaque palier, Semi complet en plus', () => {
  const a = (s) => id(`archimage-${s}`);
  assert.equal(checkSelection(all, [a('elementaliste'), a('creation-vivante'), a('moissonneur'), a('cameleon'), a('semi-complet')]).ok, true);
  assert.equal(checkSelection(all, [a('elementaliste'), a('occultiste')]).ok, false);
  assert.equal(checkSelection(all, [a('creation-vivante'), a('tempus-figus')]).ok, false);
  assert.equal(checkSelection(all, [a('tempus-figus'), a('obedience')]).ok, false);
  assert.equal(checkSelection(all, [a('choix'), a('cameleon')]).ok, false);
  assert.equal(checkSelection(all, [a('cameleon'), a('adaptation')]).ok, false);
  assert.deepEqual(capacitesOfClass(all, classe('archimage')).automatiques.map((e) => e.id).includes(a('semi-complet')), true);
});

test('les pages de classes ne portent plus de tableau d’aptitudes : les capacités sont sur leurs fiches', () => {
  for (const c of classes) assert.ok(!/^\| Lvl \d+/m.test(c.body), `${c.id} : tableau d'aptitudes résiduel`);
});
