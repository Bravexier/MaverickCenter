// Les tables qui ne sont pas des textes de règles (lib/tables-de-la-base.mjs, la seule source) : les listes suivent data/schema.sql — les sections 13
// à 15 (fiches, journal, notes de version) sont les tables que le journal interdit (serveur/edition-journal.mjs#TABLES_INTERDITES) et que le service
// garde (serveur/base-vivante.mjs#TABLES_EDITION) ; les tables dérivées (`-- @derivee`) celles de la page Debug ; les traces existent — et aucune n'est
// lue comme un texte de règles par les balises du glossaire (lib/mots-cles-db.mjs#textesDeLaBase) : db:check ne refuse pas la balise que `lien.ancre`
// reprend d'un lien du Markdown, ni celle d'une trace (un écart entre sources), mais refuse la même dans une case des règles.
//   node --test test/tables-de-la-base.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TABLES_EDITION } from '../serveur/base-vivante.mjs';
import { TABLES_DERIVEES as DERIVEES_DE_LA_PAGE_DEBUG } from '../serveur/debug-tables.mjs';
import { TABLES_INTERDITES } from '../serveur/edition-journal.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { TABLES_DES_NOTES as NOTES } from '../src/lib/notes-de-version.mjs';
import { lireSchema } from '../src/lib/schema-doc.mjs';
import {
  CLASSES_DE_TABLES, TABLES_CALCULEES, TABLES_DE_CONTENU, TABLES_DE_REGLES, TABLES_DERIVEES, TABLES_DES_NOTES, TABLES_DU_JOURNAL, TABLES_HORS_REGLES, TABLES_PROPRES_AU_SITE,
  TRACES_TELLES_QUELLES, classeDeLaTable, tablesNonClassees,
} from '../src/lib/tables-de-la-base.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SECTIONS = lireSchema(readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8'));
const tablesDe = (numero) => SECTIONS.filter((s) => s.titre.startsWith(`${numero}. `)).flatMap((s) => s.objets).filter((o) => o.genre === 'table').map((o) => o.nom).sort();
const trie = (l) => [...l].sort();

test('sections 13 à 15 de data/schema.sql : fiches, journal, notes de version — les tables que le journal interdit et que le service garde', () => {
  assert.deepEqual(trie(TABLES_FICHES), tablesDe(13), 'section 13 : les fiches (lib/fiche-format.mjs)');
  assert.deepEqual(trie(TABLES_DU_JOURNAL), tablesDe(14), 'section 14 : le journal et le brouillon de la note');
  assert.deepEqual(trie(TABLES_DES_NOTES), tablesDe(15), 'section 15 : les notes de version et l’historique');
  assert.deepEqual(trie(TABLES_HORS_REGLES), trie([...tablesDe(13), ...tablesDe(14), ...tablesDe(15)]));
  assert.deepEqual(trie(TABLES_INTERDITES), trie(TABLES_HORS_REGLES), 'serveur/edition-journal.mjs#TABLES_INTERDITES');
  assert.equal(TABLES_EDITION, TABLES_DU_JOURNAL, 'serveur/base-vivante.mjs#TABLES_EDITION');
  assert.equal(NOTES, TABLES_DES_NOTES, 'lib/notes-de-version.mjs#TABLES_DES_NOTES');
});

test('tables dérivées (`-- @derivee`, hors recherche plein texte) et traces gardées telles quelles : dans le schéma, hors des sections 13 à 15', () => {
  const derivees = SECTIONS.flatMap((s) => s.objets).filter((o) => o.genre === 'table' && o.derivee).map((o) => o.nom).sort();
  assert.deepEqual(trie(TABLES_DERIVEES), derivees);
  assert.deepEqual(trie(DERIVEES_DE_LA_PAGE_DEBUG), derivees, 'serveur/debug-tables.mjs#TABLES_DERIVEES');
  const reglesEtPages = SECTIONS.filter((s) => /^(\d+)(?: bis)?\. /.test(s.titre) && Number(/^\d+/.exec(s.titre)[0]) <= 10).flatMap((s) => s.objets).map((o) => o.nom);
  for (const t of TRACES_TELLES_QUELLES) assert.ok(reglesEtPages.includes(t), `${t} : une table des sections 1 à 10`);
});

test('textesDeLaBase : ni les sections 13 à 15, ni les tables dérivées, ni les traces, ni la recherche plein texte ; les règles et les pages, oui', () => {
  const lus = textesDeLaBase(ouvrirBase({ sansExemples: false }));
  const tables = new Set(lus.map((t) => t.table));
  for (const t of [...TABLES_HORS_REGLES, ...TABLES_DERIVEES, ...TRACES_TELLES_QUELLES]) assert.ok(!tables.has(t), t);
  assert.ok(![...tables].some((t) => /_fts(_|$)/.test(t)), 'pas de table de recherche plein texte');
  assert.ok(lus.some((t) => t.table === 'page' && t.colonne === 'corps_md' && t.markdown), 'le corps des pages : un texte mis en forme');
  assert.ok(lus.some((t) => t.table === 'arme' && t.colonne === 'effet' && !t.markdown), 'l’effet d’une arme : un texte de case');
  assert.ok(lus.some((t) => t.table === 'panneau_regles_bloc' && t.colonne === 'texte' && t.markdown), 'un bloc de panneau de règles');
});

test('db:check : une balise d’un lien du Markdown reprise dans `lien.ancre`, ou d’un écart entre sources, n’est pas contrôlée ; la même dans une case des règles est refusée', () => {
  const dossier = dossierTemporaire('tables-de-la-base');
  try {
    const copie = join(dossier, 'maverick.db');
    cpSync(cheminBase({ sansExemples: false }), copie);
    const db = new DatabaseSync(copie);
    const id = db.prepare('SELECT id FROM mot_cle ORDER BY id LIMIT 1').get().id;
    const lien = db.prepare('SELECT page_id, position FROM lien ORDER BY page_id, position LIMIT 1').get();
    db.prepare('UPDATE lien SET ancre = ? WHERE page_id = ? AND position = ?').run(`{{${id}}}`, lien.page_id, lien.position);
    // une trace (l'écart entre deux sources, tel qu'écrit) : même un mode complet sans forme canonique n'y est pas lu
    const ecart = db.prepare('SELECT id FROM ecart_source ORDER BY id LIMIT 1').get();
    db.prepare('UPDATE ecart_source SET detail = detail || ? WHERE id = ?').run(` {{${id}:}}`, ecart.id);
    db.close();
    const check = () => spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-check.mjs'), copie], { encoding: 'utf8' });
    const avant = check();
    assert.equal(avant.status, 0, avant.stdout + avant.stderr);
    const db2 = new DatabaseSync(copie);
    const arme = db2.prepare("SELECT id, effet FROM arme WHERE effet IS NOT NULL AND instr(effet, '{{') = 0 ORDER BY id LIMIT 1").get();
    db2.prepare('UPDATE arme SET effet = ? WHERE id = ?').run(`${arme.effet} {{${id}}}`, arme.id);
    db2.close();
    const apres = check();
    assert.notEqual(apres.status, 0);
    assert.match(apres.stdout, new RegExp(`arme\\.effet ${arme.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} : la balise « \\{\\{${id}\\}\\} »`));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Le classement de toutes les tables en « contenu », « propre au site » ou « calculée » (lot 5 du chantier de la base de dev, garde-fou 9 : un extrait ou
// un paquet ne porte jamais une table que le classement ne connaît pas)
// ---------------------------------------------------------------------------------------------------------------------------------------------------

const TOUTES_LES_TABLES = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((t) => t.name);
const schemaEnMemoire = (supplement = '') => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8'));
  if (supplement) db.exec(supplement);
  return db;
};

test('classement : les listes des trois classes suivent les sections de data/schema.sql et ne se recouvrent pas', () => {
  const numero = (s) => Number(/^\d+/.exec(s.titre)?.[0]);
  const tablesDesSections = (garde) => SECTIONS.filter((s) => /^\d+(?: bis)?\. /.test(s.titre) && garde(numero(s))).flatMap((s) => s.objets)
    .filter((o) => o.genre === 'table' || o.genre === 'table de recherche (FTS5)').map((o) => o.nom).sort();
  assert.deepEqual(trie(TABLES_DE_REGLES), tablesDesSections((n) => n <= 10), 'sections 0 à 10 : les règles');
  assert.deepEqual(trie(TABLES_DE_CONTENU), trie([...tablesDesSections((n) => n <= 10), ...tablesDe(15)]), 'contenu = règles + notes de version et historique');
  assert.deepEqual(trie(TABLES_PROPRES_AU_SITE), trie([...tablesDe(13), ...tablesDe(14)]), 'propre au site = fiches, comptes, groupes, journal, brouillon');
  assert.deepEqual(trie(TABLES_CALCULEES), tablesDesSections((n) => n === 11), 'calculées = section 11 (dérivées et recherche plein texte)');
  const toutes = [...TABLES_DE_CONTENU, ...TABLES_PROPRES_AU_SITE, ...TABLES_CALCULEES];
  assert.equal(new Set(toutes).size, toutes.length, 'une table n’est que d’une classe');
  for (const t of TABLES_DE_CONTENU) assert.equal(classeDeLaTable(t), CLASSES_DE_TABLES.CONTENU, t);
  for (const t of TABLES_PROPRES_AU_SITE) assert.equal(classeDeLaTable(t), CLASSES_DE_TABLES.PROPRE_AU_SITE, t);
  for (const t of TABLES_CALCULEES) assert.equal(classeDeLaTable(t), CLASSES_DE_TABLES.CALCULEE, t);
});

test('classement : toute table du schéma, et de la base construite, a une classe — les ombres du plein texte et les tables internes de SQLite sont calculées', () => {
  const schema = schemaEnMemoire();
  const noms = TOUTES_LES_TABLES(schema);
  assert.ok(noms.some((t) => /^page_fts_/.test(t)), 'les tables d’ombre du plein texte existent dans le schéma exécuté');
  assert.deepEqual(tablesNonClassees(noms), []);
  for (const t of noms.filter((n) => /_fts(_|$)/.test(n))) assert.equal(classeDeLaTable(t), CLASSES_DE_TABLES.CALCULEE, t);
  schema.close();
  assert.deepEqual(tablesNonClassees(TOUTES_LES_TABLES(ouvrirBase({ sansExemples: false }))), [], 'la base construite depuis data/rows aussi');
  assert.equal(classeDeLaTable('sqlite_sequence'), CLASSES_DE_TABLES.CALCULEE);
});

test('classement : une table nouvelle, non classée, est refusée (le schéma d’essai qui en a une de plus fait échouer le contrôle)', () => {
  const faux = schemaEnMemoire('CREATE TABLE une_table_nouvelle (id INTEGER PRIMARY KEY) STRICT; CREATE TABLE personnage_autre_nouveau (id INTEGER PRIMARY KEY) STRICT;');
  const noms = TOUTES_LES_TABLES(faux);
  faux.close();
  assert.deepEqual(tablesNonClassees(noms), ['personnage_autre_nouveau', 'une_table_nouvelle']);
  assert.equal(classeDeLaTable('une_table_nouvelle'), null);
  // un nom qui ressemble à une ombre du plein texte sans l'être n'est pas classé non plus
  assert.equal(classeDeLaTable('page_fts_nouvelle'), null);
  assert.equal(classeDeLaTable('autre_fts_data'), null);
});
