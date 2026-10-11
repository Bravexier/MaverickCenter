// Intégrité du contenu RÉEL des capacités de classe (pages `capacites/*.md` posées par l'import de « Classe Maverick V7 »).
// La règle des choix exclusifs vient de la mise en page de l'onglet (capacités d'une même ligne = une seule au choix) et a été
// confirmée par le propriétaire du projet : ses exemples (Barde Ménestrel, Archimage) sont rejoués ici sur les vraies pages.
// Le site de dev est la source des classes et des dons qu'il modifie (décision du propriétaire) : les effectifs et les textes de l'import se lisent dans
// historique_modification (lib/historique-site.mjs, pages « telles que l'import les a écrites ») ; une classe créée depuis le site n'a pas encore de don.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isMagicalClass, isMagicalSpecialization } from '../src/lib/classe-magique.mjs';
import { asymmetricChoices, capacitesOfClass, checkSelection, nomCapacite, nomsSeRepondent, unresolvedCapacites } from '../src/lib/capacites.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
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
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
// une page telle que l'import l'a écrite (titre, champs structurés, corps), avant les modifications du site de dev ; les pages qu'il a créées sont retirées
const versImport = (e) => {
  if (!historique.touchee('page', { id: e.id })) return e;
  const v = (colonne) => historique.valeurDImport('page', { id: e.id }, colonne);
  return { ...e, body: v('corps_md'), data: { ...e.data, ...JSON.parse(v('donnees') ?? '{}'), title: v('titre') } };
};
const allImport = all.filter((e) => !historique.creee('page', { id: e.id })).map(versImport);
const classesImport = allImport.filter((e) => e.id.startsWith('classes/'));
const capacitesImport = allImport.filter((e) => e.id.startsWith('capacites/'));

test('660 capacités, une page chacune, toutes rattachées à une classe qui existe', () => {
  assert.equal(capacites.length, db.prepare('SELECT count(*) AS n FROM capacite').get().n);
  assert.equal(historique.effectifDImport('capacite'), 660, 'à l’import');
  assert.deepEqual(unresolvedCapacites(all), []);
  const perClass = new Map();
  for (const c of capacites) perClass.set(c.data.classe, (perClass.get(c.data.classe) ?? 0) + 1);
  for (const c of classes) assert.ok(perClass.has(c.id) || historique.creee('classe', { id: c.id }), `${c.id} : une classe importée a ses capacités`);
  // à l'import : les 39 classes ont des capacités, 17 pour le Barde, 14 pour l'Archimage
  const parClasseImport = new Map();
  for (const k of historique.lignesDImport('capacite')) parClasseImport.set(k.classe_id, (parClasseImport.get(k.classe_id) ?? 0) + 1);
  assert.equal(parClasseImport.size, 39, 'les 39 classes ont des capacités');
  assert.equal(parClasseImport.get('classes/barde'), 17);
  assert.equal(parClasseImport.get('classes/archimage'), 14);
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

test('chaque classe : soit deux spécialités (un cartouche chacune, exclusifs entre eux), soit des groupes sans spécialité (Archimage)', (t) => {
  for (const c of classes) {
    const r = capacitesOfClass(all, c);
    if (!r.automatiques.length && !r.specialites.length && !r.groupes.length) {
      // une classe créée depuis le site n'a pas encore de don (l'édition n'en crée pas) ; une classe importée en a toujours
      assert.ok(historique.creee('classe', { id: c.id }), `${c.id} : classe importée sans capacité`);
      t.diagnostic(`${c.id} : créée depuis le site, sans don (à compléter)`);
      continue;
    }
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

test('noms coupés sur deux cases : 33 paires dont les deux noms se répondent (« Tenir ... » / « ... ou charger ? »), voulu par le classeur pour accentuer le choix', () => {
  const coupe = (nom) => /(\.{2,}|…|\s\.|^\.\s)/.test(nom.replace(/\s+$/, ' '));
  const lirePaires = (liste) => {
    const byId = new Map(liste.map((c) => [c.id, c]));
    const paires = new Map();
    for (const c of liste) for (const id of c.data.choix_exclusif_avec ?? []) paires.set([c.id, id].sort().join('|'), [c, byId.get(id)]);
    let repondent = 0;
    const autres = [];
    for (const [a, b] of paires.values()) {
      if (nomsSeRepondent(a, b)) {
        repondent += 1;
        // aujourd'hui comme à l'import : une paire de noms qui se répondent est un choix du même niveau
        assert.equal(a.data.nature, 'choix', `${a.id} : une paire de noms qui se répondent est un choix`);
        assert.equal(a.data.niveau, b.data.niveau, `${a.id} / ${b.id} : même niveau`);
      } else if (coupe(nomCapacite(a)) || coupe(nomCapacite(b))) autres.push([a.id, b.id].sort().join(' / '));
    }
    return { repondent, autres };
  };
  lirePaires(capacites);
  // les noms de l'import (le site de dev peut renommer un don)
  const { repondent, autres } = lirePaires(capacitesImport);
  assert.equal(repondent, 33);
  // Seule exception : au niveau 20 du Flagelleur, « 50 Nuances ... » (Sadique) et « ... Encore plus ! » (Masochiste) se répondent d'une
  // spécialité à l'autre ; chacun est groupé avec une autre capacité de sa ligne, et les deux spécialités s'excluent déjà.
  assert.deepEqual(autres, ['capacites/flagelleur-50-nuances / capacites/flagelleur-prescription', 'capacites/flagelleur-encore-plus / capacites/flagelleur-resilience']);
});

test('type magique : catégories, spécialités reconnues et Archimage', () => {
  // aujourd'hui : magique par le mot-clé de sa catégorie, l'Archimage, et toute classe raciale qui a ses dons (une classe créée depuis le site n'en a pas)
  const magiques = classes.filter((c) => isMagicalClass(all, c));
  assert.ok(magiques.some((c) => c.id === 'classes/archimage'));
  assert.ok(classes.filter((c) => (c.data.tags ?? []).includes('magique')).every((c) => magiques.includes(c)));
  for (const c of classes.filter((x) => (x.data.tags ?? []).includes('hybride animal'))) {
    if (capacites.some((k) => k.data.classe === c.id)) assert.ok(magiques.includes(c), `${c.id} : classe raciale`);
  }
  // à l'import (pages telles que l'import les a écrites) : 23 classes magiques, Flagelleur compris
  const magiquesImport = classesImport.filter((c) => isMagicalClass(allImport, c));
  assert.equal(magiquesImport.length, 23);
  assert.ok(magiquesImport.some((c) => c.id === 'classes/flagelleur'), 'le Flagelleur écrit « concidérée » : faute de frappe comprise');
  for (const c of classesImport.filter((x) => (x.data.tags ?? []).includes('hybride animal'))) assert.ok(magiquesImport.includes(c), `${c.id} : classe raciale`);
  const specialiteFlagelleur = capacitesImport.find((e) => e.id === 'capacites/flagelleur-masochiste');
  const specialiteOrios = capacitesImport.find((e) => e.id === 'capacites/orios-chaman');
  assert.equal(isMagicalSpecialization(specialiteFlagelleur), true);
  assert.equal(isMagicalSpecialization(specialiteOrios), true);
  const oriosImport = classesImport.find((c) => c.id === 'classes/orios');
  assert.equal(isMagicalClass(allImport, oriosImport, capacitesImport.find((e) => e.id === 'capacites/orios-va-t-en-guerre')), false);
});
