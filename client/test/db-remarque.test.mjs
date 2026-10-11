// Colonne `remarque` (texte libre, vide par défaut) dans les tables d'entités : les notes de cellule des classeurs y sont recopiées, dans la ligne de l'entité qu'elles
// commentent (migration data/migrations/0002-remarque.sql). La table `note_cellule` garde la cellule d'origine et la nature (note, commentaire résolu).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cheminBase, ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';

const racine = trouverRacine();
const client = fileURLToPath(new URL('../', import.meta.url));
const db = ouvrirBase({ sansExemples: false });
const colonnes = (t) => db.prepare(`PRAGMA table_info("${t}")`).all();
const entites = db
  .prepare('SELECT entite_table FROM page_entite UNION SELECT entite_table FROM note_cellule UNION SELECT entite_table FROM ecart_source')
  .all()
  .map((r) => r.entite_table)
  .filter((t) => t !== 'page')
  .sort();
const tablesAvecNotes = db.prepare("SELECT DISTINCT entite_table AS t FROM note_cellule WHERE entite_table <> 'page' ORDER BY 1").all().map((r) => r.t);

// Colonnes ajoutées APRÈS `remarque` par des migrations ultérieures (une colonne ajoutée va en dernier : l'export d'une base migrée = celui d'une base neuve) :
// table -> colonnes dans l'ordre. Migration 0004 : le mode du sort et ses bonus de niveau de maîtrise ; 0007 : le nom d'une capacité Mode Hyper ;
// 0010 : mono-magie (R15) ; 0015 : la magie innée qui réserve et impose une classe (R23) ; 0019 : celle qui la ferme (R25).
const APRES_REMARQUE = { sort: ['mode_brut', 'bonus_maitrise'], mode_hyper_effet: ['nom'], magie: ['mono_magie'], classe: ['magie_innee_id', 'magie_innee_exclue_id'] };
// Tables d'entités créées APRÈS 0002 par une migration qui leur donne directement leur `remarque` (0007 : les dons raciaux de l'onglet de la race).
const CREEES_APRES_0002 = ['race_don'];

test('toute table d’entités a une colonne `remarque` TEXT facultative, en dernier (sauf colonnes ajoutées ensuite par migration) ; aucune autre table n’en a (la table page non plus)', () => {
  assert.ok(entites.length >= 60, `tables d'entités : ${entites.length}`);
  for (const t of entites) {
    const cols = colonnes(t);
    const apres = APRES_REMARQUE[t] ?? [];
    assert.deepEqual(cols.slice(cols.length - apres.length).map((c) => c.name), apres, `${t} : colonnes ajoutées après remarque`);
    const derniere = cols[cols.length - 1 - apres.length];
    assert.equal(derniere.name, 'remarque', `${t} : remarque en dernier (hors colonnes ajoutées ensuite : ${apres.join(', ') || 'aucune'})`);
    assert.equal(derniere.type, 'TEXT', t);
    assert.equal(derniere.notnull, 0, `${t} : facultative`);
  }
  const toutes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const avec = toutes.filter((t) => colonnes(t).some((c) => c.name === 'remarque'));
  assert.deepEqual(avec.sort(), entites, 'exactement les tables d’entités');
});

test('la note de « Laser noir » est directement dans la ligne du sort', () => {
  const r = db.prepare("SELECT remarque FROM sort WHERE id = 'magies/magie-de-la-corruption#sort:laser-noir'").get();
  assert.equal(r.remarque, 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.');
});

test('plusieurs notes sur une ligne : réunies dans l’ordre, séparées par une ligne vide ; sans note, la remarque est vide (NULL)', () => {
  const r = db.prepare("SELECT remarque FROM sort WHERE id = 'magies/magie-de-la-corruption#sort:verrouillage-magique'").get();
  assert.equal(r.remarque, 'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.\n\nLes verrouillages ne se cumulent pas.');
  assert.equal(db.prepare('SELECT count(*) AS n FROM competence WHERE remarque IS NOT NULL').get().n, 0, 'aucune note sur les compétences : aucune remarque inventée');
  const sansNote = db.prepare("SELECT count(*) AS n FROM sort s WHERE remarque IS NULL AND NOT EXISTS (SELECT 1 FROM note_cellule n WHERE n.entite_table = 'sort' AND n.entite_id = s.id)").get().n;
  assert.equal(sansNote, db.prepare('SELECT count(*) AS n FROM sort WHERE remarque IS NULL').get().n);
});

test('aucune note de cellule perdue : une remarque par entité qui a des notes, et chaque note (sans espaces de bordure) figure dans la remarque de sa ligne', () => {
  assert.deepEqual(tablesAvecNotes, ['accessoire_effet', 'arme', 'arme_elementaire', 'capacite', 'creature', 'maladie', 'race_don', 'sort']);
  for (const t of tablesAvecNotes) {
    const attendues = db.prepare('SELECT count(DISTINCT entite_id) AS n FROM note_cellule WHERE entite_table = ?').get(t).n;
    assert.equal(db.prepare(`SELECT count(*) AS n FROM "${t}" WHERE remarque IS NOT NULL`).get().n, attendues, `${t} : lignes avec remarque`);
    for (const n of db.prepare('SELECT entite_id, cellule, texte FROM note_cellule WHERE entite_table = ?').all(t)) {
      const r = db.prepare(`SELECT remarque FROM "${t}" WHERE id = ?`).get(n.entite_id);
      assert.ok(r && r.remarque.includes(n.texte.trim()), `${t}:${n.entite_id} (${n.cellule}) : note absente de la remarque`);
    }
  }
});

test('la remarque est cherchable (plein texte des entités) et visible dans l’explorateur', () => {
  const trouve = db.prepare("SELECT entite_id FROM entite_fts WHERE entite_fts MATCH 'concentration bonus' AND entite_table = 'sort'").all().map((r) => r.entite_id);
  assert.ok(trouve.includes('magies/magie-de-la-corruption#sort:laser-noir'));
});

test('db:check détecte une remarque qui a perdu une note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'remarque-'));
  const copie = join(dir, 'm.db');
  cpSync(cheminBase({ sansExemples: false }), copie);
  const d = new DatabaseSync(copie);
  d.exec("UPDATE sort SET remarque = 'autre chose' WHERE id = 'magies/magie-de-la-corruption#sort:laser-noir'");
  d.close();
  const r = spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-check.mjs'), copie], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /remarque : la note sort:magies\/magie-de-la-corruption#sort:laser-noir \(BJ37\) ne figure pas/);
});

test('db:migrate : refuse un schéma précédent dont la version ne précède pas celle du schéma courant', () => {
  const dir = mkdtempSync(join(tmpdir(), 'migrer-'));
  const rows = join(dir, 'rows');
  cpSync(join(racine, 'data', 'rows'), rows, { recursive: true });
  writeFileSync(join(dir, 'm.sql'), 'ALTER TABLE sort ADD COLUMN x TEXT;\n');
  const r = spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'migrer.py'), join(dir, 'm.sql'), '--rows', rows, '--schema-ancien', join(racine, 'data', 'schema.sql')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /les versions se suivent une à une/);
  assert.equal(readFileSync(join(rows, 'VERSION'), 'utf8'), readFileSync(join(racine, 'data', 'rows', 'VERSION'), 'utf8'), 'rien n’est écrit');
});

test('la migration 0002 est additive : colonnes facultatives ajoutées et remplies, rien n’est supprimé ni réécrit', () => {
  const sql = readFileSync(join(racine, 'data', 'migrations', '0002-remarque.sql'), 'utf8');
  const instructions = sql.split('\n').filter((l) => l.trim() && !l.startsWith('--') && !l.startsWith('  WHERE'));
  assert.equal(instructions.filter((l) => /^ALTER TABLE \w+ ADD COLUMN remarque TEXT;$/.test(l)).length, entites.filter((t) => !CREEES_APRES_0002.includes(t)).length);
  assert.ok(!/\b(DROP|DELETE|RENAME)\b/i.test(sql), 'migration additive');
  assert.equal(instructions.filter((l) => l.startsWith('UPDATE ')).length, tablesAvecNotes.filter((t) => !CREEES_APRES_0002.includes(t)).length);
});
