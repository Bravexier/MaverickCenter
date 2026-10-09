// Contenu de l'onglet de chaque race dans la base (migration 0006-races-onglet ; tables race_onglet, race_don, race_don_tableau_*, race_magie_onglet,
// mode_hyper_effet 'onglet_race') et son chargement pour les pages de race (lib/races-db.mjs). Décision R13 : l'onglet est la source.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { magiesOfRace } from '../src/lib/magie-relations.mjs';
import { raceKind } from '../src/lib/race-kinds.mjs';
import { chargerRaces } from '../src/lib/races-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { splitFrontmatter } from '../src/lib/wikilinks.mjs';

const racine = trouverRacine();
const db = ouvrirBase({ sansExemples: false });
const n = (sql) => db.prepare(sql).get().n;
const { races } = chargerRaces(db);
const race = (slug) => races.get(`races/${slug}`);

const dir = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const pages = (type) =>
  readdirSync(join(dir, type))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ id: `${type}/${f.replace(/\.md$/, '')}`, ...splitFrontmatter(readFileSync(join(dir, type, f), 'utf8')) }))
    .filter((e) => e.data.status !== 'example');
const entries = [...pages('races'), ...pages('magies'), ...pages('classes')];
const texteDe = (blocs) => blocs.flatMap((b) => ('items' in b ? b.items : [b.texte])).join('\n');

test('migration 0006 : les tables de l’onglet se relisent depuis les pages, à l’identique (tools/db/races_onglet.py --verifier)', () => {
  const r = spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'races_onglet.py'), '--verifier'], { encoding: 'utf8', cwd: racine });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /conformes aux pages/);
});

test('effectifs : 27 onglets, 70 dons, 2 tableaux en panneaux (Drakos 15 x 4, Mort-vivant 12 x 2), 27 capacités Mode Hyper nommées', () => {
  assert.equal(n('SELECT count(*) AS n FROM race_onglet'), 27);
  assert.equal(n('SELECT count(*) AS n FROM race_don'), 70);
  assert.equal(n("SELECT count(*) AS n FROM race_don WHERE forme = 'unique'"), 5);
  assert.equal(n("SELECT count(*) AS n FROM race_don_tableau_ligne WHERE race_id = 'races/drakos'"), 15);
  assert.equal(n("SELECT count(*) AS n FROM race_don_tableau_colonne WHERE race_id = 'races/drakos'"), 4);
  assert.equal(n("SELECT count(*) AS n FROM race_don_tableau_ligne WHERE race_id = 'races/mort-vivant'"), 12);
  assert.equal(n("SELECT count(*) AS n FROM race_don_tableau_cellule"), 15 * 4 + 12 * 2);
  assert.equal(n("SELECT count(*) AS n FROM mode_hyper_effet WHERE version = 'onglet_race' AND nom IS NOT NULL"), 27);
  assert.equal(n("SELECT count(*) AS n FROM mode_hyper_effet WHERE version <> 'onglet_race' AND nom IS NOT NULL"), 0, 'les autres versions n’ont pas de nom');
});

test('valeurs de l’onglet (elles priment sur la fiche) : Drakos 13 / 10 alors que la fiche dit 10 / 13', () => {
  const o = db.prepare("SELECT sante_depart, chakra_depart FROM race_onglet WHERE race_id = 'races/drakos'").get();
  assert.deepEqual({ ...o }, { sante_depart: 13, chakra_depart: 10 });
  assert.deepEqual(race('drakos').stats.slice(0, 2).map((s) => s.valeur), [13, 10]);
  assert.deepEqual({ ...db.prepare("SELECT sante, chakra_depart FROM race WHERE id = 'races/drakos'").get() }, { sante: 10, chakra_depart: 13 });
});

test('dons raciaux : ethnies de l’onglet rapprochées des sous-races de la fiche ; note de cellule du Médusain dans la remarque (et tracée)', () => {
  const noir = race('elfe-noir').dons;
  assert.deepEqual(noir.map((d) => [d.etiquette, d.nom]), [['Elfe Charbon', 'Sang corrompu'], ['Elfe Salé', 'Sang purifié']]);
  assert.equal(n("SELECT count(*) AS n FROM race_don WHERE race_id = 'races/elfe-noir' AND ethnie_id LIKE 'races/elfe-noir#ethnie:elfe-noir-%'"), 2);
  assert.equal(n("SELECT count(*) AS n FROM race_don WHERE ethnie_id IS NULL"), 1, 'seul « Trompe-mort » n’a pas de sous-race dans la fiche');
  const medusain = race('medusain').dons;
  assert.ok(medusain.every((d) => d.remarque === "Jet de vigueur pour esquiver l'altération d'état"));
  assert.equal(n("SELECT count(*) AS n FROM note_cellule WHERE entite_table = 'race_don'"), 3);
  assert.equal(race('drakos').tableau.titre, 'Écaille draconique');
  assert.equal(race('mort-vivant').tableau.titre, null);
  assert.deepEqual(race('mort-vivant').dons.map((d) => d.nom), ['Trompe-mort']);
});

test('magies innées des pages de race (base) = `magies_innees` du front matter (pages de magie, tableau races et magies) ; le Nain suit son onglet (R11)', () => {
  for (const e of entries.filter((x) => x.id.startsWith('races/'))) {
    const attendu = magiesOfRace(entries, e).magies.map((m) => normalize(m.data.nom_court)).sort();
    const obtenu = races.get(e.id).magiesInnees.avec.map((m) => normalize(m.nom)).sort();
    assert.deepEqual(obtenu, attendu, e.id);
  }
  assert.equal(race('nain').magiesInnees.source, 'onglet');
  assert.deepEqual(race('nain').magiesInnees.avec.map((m) => m.nom), ['Potentiel Illimité', 'Arcane', 'Feu', 'Terre', 'Foudre']);
  assert.equal(race('humain').magiesInnees.source, 'matrice');
  assert.equal(race('humain').magiesInnees.avec.length, 15);
});

test('race pure ou hybride (classe raciale dans la base) = lib/race-kinds.mjs sur les pages', () => {
  for (const e of entries.filter((x) => x.id.startsWith('races/'))) {
    assert.equal(races.get(e.id).classeRaciale ? 'hybride' : 'pure', raceKind(entries, e), e.id);
  }
  assert.equal(race('orios').classeRaciale.id, 'classes/orios');
});

test('textes sans Markdown : ni échappement, ni tableau, ni lien [[…]] dans les textes de l’onglet', () => {
  for (const r of races.values()) {
    const textes = [r.descriptionGenerale, r.histoire, r.description, r.avantages, r.inconvenients, r.donBase, ...r.dons.map((d) => d.texte)].map(texteDe).join('\n');
    assert.ok(!/\\[-*_[\]<>#]|\|\s*---|\[\[/.test(textes), r.id);
  }
  assert.match(texteDe(race('elfe-noir').histoire), /^Les Elfes Charbon, reconnaissables/);
});
