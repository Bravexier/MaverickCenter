// Contenu de l'onglet de chaque race dans la base (migration 0007-races-onglet ; tables race_onglet, race_don, race_don_tableau_*, race_magie_onglet,
// mode_hyper_effet 'onglet_race') et son chargement pour les pages de race (lib/races-db.mjs). Décision R13 : l'onglet est la source.
// Le site de dev est ensuite la source de ce qu'il modifie ou crée (décision du propriétaire) : les effectifs et les textes de l'onglet se lisent tels que
// la migration les a écrits (historique_modification, lib/historique-site.mjs) ; une race créée depuis le site n'a pas d'onglet dans le classeur.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
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
const historique = historiqueSite(db);
const dImport = (table) => historique.lignesDImport(table);
const ongletDImport = (slug, colonne) => historique.valeurDImport('race_onglet', { race_id: `races/${slug}` }, colonne);

const dir = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const pages = (type) =>
  readdirSync(join(dir, type))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ id: `${type}/${f.replace(/\.md$/, '')}`, ...splitFrontmatter(readFileSync(join(dir, type, f), 'utf8')) }))
    .filter((e) => e.data.status !== 'example');
const entries = [...pages('races'), ...pages('magies'), ...pages('classes')];
const texteDe = (blocs) => blocs.flatMap((b) => ('items' in b ? b.items : [b.texte])).join('\n');

test('migration 0007 : les tables de l’onglet se relisent depuis les pages, à l’identique (tools/db/races_onglet.py --verifier)', () => {
  const r = spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'races_onglet.py'), '--verifier'], { encoding: 'utf8', cwd: racine });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /conformes aux pages/);
});

test('effectifs : 27 onglets, 70 dons, 2 tableaux en panneaux (Drakos 15 x 4, Mort-vivant 12 x 2), 27 capacités Mode Hyper nommées', () => {
  // aujourd'hui : chaque race a son onglet (créée depuis le site : « à compléter »)
  assert.equal(n('SELECT count(*) AS n FROM race_onglet'), n('SELECT count(*) AS n FROM race'));
  // tels que la migration les a écrits
  const de = (table, filtre = () => true) => dImport(table).filter(filtre).length;
  assert.equal(historique.effectifDImport('race_onglet'), 27);
  assert.equal(de('race_don'), 70);
  assert.equal(de('race_don', (d) => d.forme === 'unique'), 5);
  assert.equal(de('race_don_tableau_ligne', (l) => l.race_id === 'races/drakos'), 15);
  assert.equal(de('race_don_tableau_colonne', (c) => c.race_id === 'races/drakos'), 4);
  assert.equal(de('race_don_tableau_ligne', (l) => l.race_id === 'races/mort-vivant'), 12);
  assert.equal(de('race_don_tableau_cellule'), 15 * 4 + 12 * 2);
  assert.equal(de('mode_hyper_effet', (m) => m.version === 'onglet_race' && m.nom !== null), 27);
  assert.equal(de('mode_hyper_effet', (m) => m.version !== 'onglet_race' && m.nom !== null), 0, 'les autres versions n’ont pas de nom');
});

test('valeurs de l’onglet (elles priment sur la fiche) : Drakos 13 / 10 alors que la fiche dit 10 / 13', () => {
  // R13 : la page de chaque race montre les valeurs de son onglet
  for (const o of db.prepare('SELECT race_id, sante_depart, chakra_depart FROM race_onglet').all()) {
    assert.deepEqual(races.get(o.race_id).stats.slice(0, 2).map((s) => s.valeur), [o.sante_depart, o.chakra_depart], o.race_id);
  }
  assert.deepEqual([ongletDImport('drakos', 'sante_depart'), ongletDImport('drakos', 'chakra_depart')], [13, 10], 'à l’import');
  assert.deepEqual({ ...db.prepare("SELECT sante, chakra_depart FROM race WHERE id = 'races/drakos'").get() }, { sante: 10, chakra_depart: 13 });
});

test('dons raciaux : ethnies de l’onglet rapprochées des sous-races de la fiche ; note de cellule du Médusain dans la remarque (et tracée)', () => {
  // aujourd'hui : la page lit les dons et le titre du tableau dans les tables
  for (const [id, r] of races) {
    const titre = db.prepare('SELECT dons_tableau_titre AS t FROM race_onglet WHERE race_id = ?').get(id)?.t ?? null;
    if (r.tableau) assert.equal(r.tableau.titre, titre, id);
    assert.deepEqual(r.dons.map((d) => d.id).sort(), db.prepare('SELECT id FROM race_don WHERE race_id = ?').all(id).map((d) => d.id).sort(), id);
  }
  // tels que la migration les a écrits
  const dons = (slug) => dImport('race_don').filter((d) => d.race_id === `races/${slug}`).sort((a, b) => a.rang - b.rang);
  assert.deepEqual(dons('elfe-noir').map((d) => [d.etiquette, d.nom]), [['Elfe Charbon', 'Sang corrompu'], ['Elfe Salé', 'Sang purifié']]);
  assert.equal(dons('elfe-noir').filter((d) => d.ethnie_id?.startsWith('races/elfe-noir#ethnie:elfe-noir-')).length, 2);
  assert.equal(dImport('race_don').filter((d) => d.ethnie_id === null).length, 1, 'seul « Trompe-mort » n’a pas de sous-race dans la fiche');
  assert.ok(dons('medusain').every((d) => d.remarque === "Jet de vigueur pour esquiver l'altération d'état"));
  assert.equal(n("SELECT count(*) AS n FROM note_cellule WHERE entite_table = 'race_don'"), 3);
  assert.equal(ongletDImport('drakos', 'dons_tableau_titre'), 'Écaille draconique');
  assert.equal(ongletDImport('mort-vivant', 'dons_tableau_titre'), null);
  assert.deepEqual(dons('mort-vivant').map((d) => d.nom), ['Trompe-mort']);
});

test('magies innées des pages de race (base) = `magies_innees` du front matter (pages de magie, tableau races et magies) ; le Nain suit son onglet (R11)', () => {
  for (const e of entries.filter((x) => x.id.startsWith('races/'))) {
    const attendu = magiesOfRace(entries, e).magies.map((m) => normalize(m.data.nom_court)).sort();
    const obtenu = races.get(e.id).magiesInnees.avec.map((m) => normalize(m.nom)).sort();
    assert.deepEqual(obtenu, attendu, e.id);
  }
  // tels que la migration les a écrits : le Nain suit son onglet, l'Humain la matrice (15 magies)
  const nom = new Map(db.prepare('SELECT id, nom, ordre FROM magie').all().map((m) => [m.id, m]));
  const onglet = (slug) => dImport('race_magie_onglet').filter((o) => o.race_id === `races/${slug}`).map((o) => nom.get(o.magie_id));
  assert.deepEqual(onglet('nain').sort((a, b) => a.ordre - b.ordre).map((m) => m.nom), ['Potentiel Illimité', 'Arcane', 'Feu', 'Terre', 'Foudre']);
  assert.deepEqual(onglet('humain'), []);
  assert.equal(dImport('race_magie').filter((c) => c.race_id === 'races/humain' && c.accessible === 1).length, 15);
  if (!historique.lignesTouchees('race_magie_onglet').some((c) => c.race_id === 'races/nain')) {
    assert.equal(race('nain').magiesInnees.source, 'onglet');
    assert.deepEqual(race('nain').magiesInnees.avec.map((m) => m.nom), ['Potentiel Illimité', 'Arcane', 'Feu', 'Terre', 'Foudre']);
  }
  if (!historique.lignesTouchees('race_magie_onglet').some((c) => c.race_id === 'races/humain')) assert.equal(race('humain').magiesInnees.source, 'matrice');
});

test('race pure ou hybride (classe raciale dans la base, ou décision R14) = lib/race-kinds.mjs sur les pages', () => {
  for (const e of entries.filter((x) => x.id.startsWith('races/'))) {
    assert.equal(races.get(e.id).hybride ? 'hybride' : 'pure', raceKind(entries, e), e.id);
  }
  assert.equal(race('orios').classeRaciale.id, 'classes/orios');
  assert.equal(race('drassahthac').hybride, true);
  assert.equal(race('drassahthac').classeRaciale, null);
  assert.equal(race('lamia').hybride, false);
});

test('textes sans Markdown : ni échappement, ni tableau, ni lien [[…]] dans les textes de l’onglet', () => {
  for (const r of races.values()) {
    const textes = [r.descriptionGenerale, r.histoire, r.description, r.avantages, r.inconvenients, r.donBase, ...r.dons.map((d) => d.texte)].map(texteDe).join('\n');
    assert.ok(!/\\[-*_[\]<>#]|\|\s*---|\[\[/.test(textes), r.id);
  }
  assert.match(ongletDImport('elfe-noir', 'histoire'), /^Les Elfes Charbon, reconnaissables/);
});
