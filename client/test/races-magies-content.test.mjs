// Intégrité du contenu RÉEL : les champs structurés que l'import pose sur les pages de races et de magies
// (magies_innees, nom_court, resiste_a, vulnerable_a, incompatible_avec) doivent
//   - nommer des magies qui existent,
//   - concorder avec le texte de la même page (section « Magies accessibles », bloc « Données »),
//   - respecter les effectifs connus (27 races ; races hybrides = 13 races à 3 magies et à classe raciale, et le Drassah'thac : décision R14).
// Les listes attendues viennent de l'onglet « Accessibilité Magie » du classeur (voir sources: des pages), sauf le Nain :
// l'onglet « Nain » de « Les races » limite sa magie innée à 5 magies (décision du propriétaire du projet, capture de l'onglet).
// Le site de dev est la source des races et des magies innées qu'il modifie ou crée (décision du propriétaire) : les listes et effectifs ci-dessus se
// lisent sur les pages telles que l'import les a écrites (historique_modification, lib/historique-site.mjs) ; toute race d'aujourd'hui doit porter la
// liste de ses tables (R8, R11) et la redire dans sa section « Magies accessibles ».
// À trancher par le propriétaire : « une race hybride a exactement 3 magies innées » est-il une règle ? Ici, seulement un effectif de l'import.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { magieIndex, relationsOfMagie, unresolvedNames } from '../src/lib/magie-relations.mjs';
import { groupRaces, ORDRE_DES_RACES, raceKind, racialClassOf } from '../src/lib/race-kinds.mjs';
import { normalize } from '../src/lib/text.mjs';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';

const dir = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const load = (type) =>
  readdirSync(`${dir}/${type}`)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ id: `${type}/${f.replace(/\.md$/, '')}`, ...splitFrontmatter(readFileSync(`${dir}/${type}/${f}`, 'utf8')) }))
    .filter((e) => e.data.status !== 'example')
    .map((e) => ({ id: e.id, data: e.data, body: e.body }));

const races = load('races');
const magies = load('magies');
const classes = load('classes');
const all = [...races, ...magies, ...classes];
// les pages telles que l'import les a écrites : sans les pages créées depuis le site, champs structurés et corps d'avant ses modifications
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
const versImport = (e) => {
  if (!historique.touchee('page', { id: e.id })) return e;
  const v = (colonne) => historique.valeurDImport('page', { id: e.id }, colonne);
  return { ...e, body: v('corps_md'), data: { ...e.data, ...JSON.parse(v('donnees') ?? '{}'), title: v('titre') } };
};
const allImport = all.filter((e) => !historique.creee('page', { id: e.id })).map(versImport);
const racesImport = allImport.filter((e) => e.id.startsWith('races/'));
const race = (slug) => racesImport.find((r) => r.id === `races/${slug}`);
const names = (slug) => race(slug).data.magies_innees;

const NOMS = ['Potentiel Illimité', 'Sang', 'Arcane', 'Corruption', 'Espace/Temps', 'Vide', 'Nécromancie', 'Feu', 'Eau', 'Glace', 'Terre', 'Vent', 'Foudre', 'Lumière', 'Ombre'];
const HYBRIDES = {
  orios: ['Sang', 'Eau', 'Terre'],
  fenrir: ['Glace', 'Foudre', 'Ombre'],
  kitsune: ['Feu', 'Vent', 'Lumière'],
  olwman: ['Espace/Temps', 'Vent', 'Ombre'],
  rokh: ['Vent', 'Foudre', 'Lumière'],
  namazu: ['Sang', 'Eau', 'Ombre'],
  minotaure: ['Sang', 'Terre', 'Ombre'],
  satyre: ['Feu', 'Terre', 'Foudre'],
  medusain: ['Eau', 'Foudre', 'Lumière'],
  jackalope: ['Vide', 'Terre', 'Foudre'],
  marcass: ['Nécromancie', 'Feu', 'Terre'],
  anansi: ['Arcane', 'Nécromancie', 'Ombre'],
  goleois: ['Sang', 'Glace', 'Lumière'],
};
const TOUTES = ['humain', 'elfe-forestier', 'elfe-noir', 'elfe-argente', 'elfe-dore', 'farfadet', 'felfe', 'hujin', 'drakos'];
// Exception : le Nain (race pure) n'a que ces magies innées, dans l'ordre des colonnes du classeur.
const NAIN = ['Potentiel Illimité', 'Arcane', 'Feu', 'Terre', 'Foudre'];
const SANS_PI = ['majin', 'mort-vivant', 'drassahthac'];

test('les 15 magies ont un nom court unique, dans l’orthographe des en-têtes du classeur', () => {
  assert.equal(magies.length, 15);
  assert.deepEqual([...magieIndex(all).values()].map((m) => m.data.nom_court).sort(), [...NOMS].sort());
});

test('les 27 races portent la liste de leurs magies innées, et tous les noms désignent une magie existante', () => {
  assert.equal(races.length, db.prepare('SELECT count(*) AS n FROM race').get().n);
  assert.equal(racesImport.length, 27);
  assert.equal(historique.effectifDImport('race'), 27);
  for (const r of races) assert.ok(Array.isArray(r.data.magies_innees), `${r.id} : magies_innees absent`);
  assert.deepEqual(unresolvedNames(all), []);
});

test('la liste de chaque race est celle de ses tables : la liste de son onglet si elle en a une (R11), sinon la matrice de la fiche (R8), dans l’ordre des magies', () => {
  const nom = new Map(db.prepare('SELECT id, nom FROM magie').all().map((m) => [m.id, m.nom]));
  const onglet = db.prepare('SELECT o.magie_id FROM race_magie_onglet o JOIN magie m ON m.id = o.magie_id WHERE o.race_id = ? ORDER BY m.ordre');
  const matrice = db.prepare('SELECT rm.magie_id FROM race_magie rm JOIN magie m ON m.id = rm.magie_id WHERE rm.race_id = ? AND rm.accessible = 1 ORDER BY m.ordre');
  for (const r of races) {
    const liste = onglet.all(r.id);
    assert.deepEqual(r.data.magies_innees, (liste.length ? liste : matrice.all(r.id)).map((m) => nom.get(m.magie_id)), r.id);
  }
});

test('9 races ont les 15 magies, 4 races les 14 magies sans Potentiel Illimité (dont la Lamia, qui a la Corruption : décision R22)', () => {
  for (const slug of TOUTES) assert.deepEqual([...names(slug)].sort(), [...NOMS].sort(), slug);
  for (const slug of [...SANS_PI, 'lamia']) assert.deepEqual([...names(slug)].sort(), NOMS.filter((n) => n !== 'Potentiel Illimité').sort(), slug);
  // la fiche met la case Lamia × Corruption (E24) à 0 : corrigée par la migration 0013, dans l'ordre des colonnes de la matrice
  assert.deepEqual(names('lamia').slice(0, 4), ['Sang', 'Arcane', 'Corruption', 'Espace/Temps']);
});

test('les 13 races restreintes ont exactement les 3 magies de l’onglet « Accessibilité Magie », dans l’ordre des colonnes', () => {
  for (const [slug, expected] of Object.entries(HYBRIDES)) assert.deepEqual(names(slug), expected, slug);
});

test('le Nain est limité à 5 magies innées (Potentiel Illimité, Arcane, Feu, Terre, Foudre), écart signalé sur sa page', () => {
  assert.deepEqual(names('nain'), NAIN);
  const body = race('nain').body;
  assert.match(body, /Nombre : 5 sur 15\./);
  assert.match(body, /Inconvénient/);
  assert.match(race('nain').data.sources.join(' '), /onglet « Nain »/);
  assert.equal(raceKind(all, race('nain')), 'pure', 'le Nain n’a pas de classe raciale : race pure malgré sa limitation');
});

test('races hybrides = les 13 races qui ont leur classe raciale, avec exactement 3 magies innées, et le Drassah’thac (R14 : sans classe raciale, 14 magies) ; les races pures en ont 13 ou plus, sauf le Nain : 5', (t) => {
  // aujourd'hui : le Drassah'thac reste hybride sans classe raciale (décision R14) ; une race créée depuis le site sans magie innée est à compléter
  const drassahthac = races.find((r) => r.id === 'races/drassahthac');
  assert.equal(raceKind(all, drassahthac), 'hybride');
  assert.equal(racialClassOf(all, drassahthac), null, 'le Drassah’thac n’a pas de classe raciale');
  for (const r of races.filter((x) => historique.creee('race', { id: x.id }) && !x.data.magies_innees.length)) t.diagnostic(`${r.id} : créée depuis le site, sans magie innée (à compléter)`);
  // à l'import (effectifs du classeur, pas une règle : voir l'en-tête)
  const hybrides = racesImport.filter((r) => raceKind(allImport, r) === 'hybride').map((r) => r.id.split('/')[1]).sort();
  assert.deepEqual(hybrides, [...Object.keys(HYBRIDES), 'drassahthac'].sort());
  for (const r of racesImport) {
    const n = r.data.magies_innees.length;
    if (r.id === 'races/drassahthac') {
      assert.equal(raceKind(allImport, r), 'hybride');
      assert.equal(racialClassOf(allImport, r), null, 'le Drassah’thac n’a pas de classe raciale');
      assert.equal(n, 14);
    } else if (raceKind(allImport, r) === 'hybride') {
      assert.equal(n, 3, `${r.id} : une race hybride a 3 magies innées`);
      assert.ok(racialClassOf(allImport, r), r.id);
    } else if (r.id === 'races/nain') assert.equal(n, 5);
    else assert.ok(n >= 13, `${r.id} : une race pure a ${n} magies`);
  }
});

test('liste des races : 13 races pures et 14 races hybrides, dans l’ordre du propriétaire', () => {
  // aujourd'hui : dans chaque groupe, les races de la liste du propriétaire dans son ordre, puis les races créées depuis le site, par titre
  for (const g of groupRaces(all)) {
    const ids = g.entries.map((r) => r.id);
    const connues = ids.filter((id) => ORDRE_DES_RACES.includes(id));
    assert.deepEqual(ids.slice(0, connues.length), [...connues].sort((a, b) => ORDRE_DES_RACES.indexOf(a) - ORDRE_DES_RACES.indexOf(b)), g.key);
    const titres = g.entries.slice(connues.length).map((r) => r.data.title);
    assert.deepEqual(titres, [...titres].sort((a, b) => a.localeCompare(b, 'fr')), g.key);
  }
  // à l'import
  const groups = groupRaces(allImport);
  assert.deepEqual(groups.map((g) => [g.key, g.entries.map((r) => r.data.title)]), [
    ['pures', ['Humain', 'Nain', 'Elfe forestier', 'Elfe doré', 'Elfe argenté', 'Elfe noir', 'Farfadet', 'Felfe', 'Majin', 'Hujin', 'Drakos', 'Lamia', 'Mort-vivant']],
    [
      'hybrides',
      ["Drassah'thac", 'Orios', 'Fenrir', 'Kitsune', 'Olwman', 'Rokh', 'Namazu', 'Minotaure', 'Satyre', 'Médusain', 'Jackalope', 'Marcass', 'Anansi', 'Goleois'],
    ],
  ]);
});

test('la liste structurée d’une race concorde avec la section « Magies accessibles » de sa propre page', () => {
  for (const r of races) {
    const section = r.body.split(/^## Magies accessibles\s*$/m)[1];
    assert.ok(section, `${r.id} : section absente`);
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
    // la section commence par sa provenance (matrice de la fiche), puis « Nombre : N sur M. », puis la liste
    const at = lines.findIndex((l) => l.startsWith('Nombre :'));
    assert.ok(at >= 0, `${r.id} : ligne « Nombre » absente`);
    const count = lines[at].match(/^Nombre : (\d+) sur (\d+)\.$/);
    assert.ok(count, `${r.id} : ligne « Nombre » illisible`);
    const listed = lines[at + 1].split(',').map((n) => n.trim());
    assert.equal(Number(count[1]), r.data.magies_innees.length, r.id);
    assert.equal(Number(count[2]), 15, r.id);
    assert.deepEqual(listed.map(normalize), r.data.magies_innees.map(normalize), `${r.id} : liste et ordre`);
  }
});

const FIELDS = [
  ['resiste_a', 'Résistance magique'],
  ['vulnerable_a', 'Vulnérabilité magique'],
  ['incompatible_avec', 'Magie non compatible'],
];

test('les relations structurées d’une magie concordent avec le bloc « Données » de sa propre page ; une phrase libre n’est jamais devinée', () => {
  const known = new Set(NOMS.map(normalize));
  for (const m of magies) {
    for (const [field, label] of FIELDS) {
      const line = m.body.split('\n').find((l) => l.startsWith(`- **${label}** :`));
      const value = line?.replace(`- **${label}** :`, '').trim();
      if (value === undefined) {
        assert.ok(!(field in m.data) || m.data[field] === undefined, `${m.id} : ${field} sans ligne « ${label} »`);
      } else if (/^aucune?s?$/i.test(value)) {
        assert.deepEqual(m.data[field], [], `${m.id} : ${field} (« Aucune »)`);
      } else {
        const parts = value.split(',').map((p) => p.trim());
        if (parts.every((p) => known.has(normalize(p)))) assert.deepEqual(m.data[field].map(normalize), parts.map(normalize), `${m.id} : ${field}`);
        else assert.ok(!(field in m.data), `${m.id} : ${field} est une phrase libre, la clé doit être omise`);
      }
    }
  }
});

test('contenu connu : le Sang résiste à Sang, Eau, Terre, est vulnérable à Glace, Nécromancie ; la Corruption n’a pas de liste d’incompatibilités propre mais est déduite des pages Arcane, Sang, Espace/Temps', () => {
  const sang = relationsOfMagie(all, magies.find((m) => m.data.nom_court === 'Sang'));
  assert.deepEqual(sang.fortContre.map((r) => r.entry.data.nom_court), ['Sang', 'Eau', 'Terre']);
  assert.deepEqual(sang.faibleContre.map((r) => r.entry.data.nom_court), ['Glace', 'Nécromancie']);
  assert.deepEqual(sang.incompatible.map((r) => r.entry.data.nom_court), ['Arcane', 'Espace/Temps', 'Corruption', 'Nécromancie']);
  const corruption = relationsOfMagie(all, magies.find((m) => m.data.nom_court === 'Corruption'));
  assert.deepEqual(corruption.incompatible.map((r) => [r.entry.data.nom_court, r.source]).sort(), [['Arcane', 'deduite'], ['Espace/Temps', 'deduite'], ['Sang', 'deduite']]);
});
