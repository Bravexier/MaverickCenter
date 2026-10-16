// Colonne `remarque` (texte libre, vide par défaut) dans les tables d'entités : les notes de cellule des classeurs y sont recopiées, dans la ligne de l'entité qu'elles
// commentent (migration data/migrations/0002-remarque.sql). La table `note_cellule` garde la cellule d'origine et la nature (note, commentaire résolu).
// Le site de dev est la source des remarques qu'il modifie (décision du propriétaire) : ce que l'import a écrit se lit dans historique_modification
// (lib/historique-site.mjs) ; une ligne que le site a créée n'a pas de note.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cheminBase, ouvrirBase, trouverRacine } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const racine = trouverRacine();
const client = fileURLToPath(new URL('../', import.meta.url));
const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
const LASER_NOIR = 'magies/magie-de-la-corruption#sort:laser-noir';
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
// 0010 : mono-magie (R15) ; 0015 : la magie innée qui réserve et impose une classe (R23) ; 0019 : celle qui la ferme (R25) ; 0022 : la race à une seule magie (R28) ;
// 0030 : la famille d'armes sans maîtrise (R45) ; 0037 : l'usage d'un effet d'accessoire (action, usage compté : R54).
const APRES_REMARQUE = {
  sort: ['mode_brut', 'bonus_maitrise'], mode_hyper_effet: ['nom'], magie: ['mono_magie'], race: ['mono_magie'], classe: ['magie_innee_id', 'magie_innee_exclue_id'],
  arme_famille: ['maitrisable'], accessoire_effet: ['usage'],
};
// Tables d'entités créées APRÈS 0002 par une migration qui leur donne directement leur `remarque` (0007 : les dons raciaux de l'onglet de la race).
const CREEES_APRES_0002 = ['race_don'];
// Tables d'entités que 0002 a dotées d'une `remarque` puis qu'une migration ultérieure a retirées (0049 : les couples de magies de l'onglet
// « Statistiques », décisions R85 et R86 : la vue v_resistance_combinaison les remplace).
const RETIREES_APRES_0002 = ['resistance_duo'];

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

test('la note de « Laser noir » est directement dans la ligne du sort (à l’import)', () => {
  assert.equal(historique.valeurDImport('sort', { id: LASER_NOIR }, 'remarque'), 'Peut prendre un tour de concentration pour donner un bonus de +10 dégâts.');
});

test('plusieurs notes sur une ligne : réunies dans l’ordre, séparées par une ligne vide ; sans note, la remarque est vide (NULL) (à l’import)', () => {
  assert.equal(historique.valeurDImport('sort', { id: 'magies/magie-de-la-corruption#sort:verrouillage-magique' }, 'remarque'),
    'Si la cible est dans la posture indiquée à ce moment-là, il doit changer de posture de suite.\n\nLes verrouillages ne se cumulent pas.');
  assert.equal(historique.lignesDImport('competence').filter((c) => c.remarque !== null).length, 0, 'aucune note sur les compétences : aucune remarque inventée');
  const avecNote = new Set(db.prepare("SELECT entite_id FROM note_cellule WHERE entite_table = 'sort'").all().map((n) => n.entite_id));
  for (const s of historique.lignesDImport('sort')) assert.equal(s.remarque === null, !avecNote.has(s.id), `${s.id} : remarque vide ⇔ sans note`);
});

test('aucune note de cellule perdue : une remarque par entité qui a des notes, et chaque note (sans espaces de bordure) figure dans la remarque de sa ligne (à l’import)', () => {
  assert.deepEqual(tablesAvecNotes, ['accessoire_effet', 'arme', 'arme_elementaire', 'capacite', 'creature', 'maladie', 'race_don', 'sort']);
  // les notes de l'import (D11 : le site supprime des dons, et leurs notes avec eux ; historique_modification les remet)
  const notesDImport = historique.lignesDImport('note_cellule');
  for (const t of tablesAvecNotes) {
    const attendues = new Set(notesDImport.filter((n) => n.entite_table === t).map((n) => n.entite_id)).size;
    assert.equal(historique.lignesDImport(t).filter((r) => r.remarque !== null).length, attendues, `${t} : lignes avec remarque`);
    for (const n of db.prepare('SELECT entite_id, cellule, texte FROM note_cellule WHERE entite_table = ?').all(t)) {
      assert.ok(!historique.creee(t, { id: n.entite_id }), `${t}:${n.entite_id} : une ligne créée par le site n’a pas de note de cellule`);
      const remarque = historique.valeurDImport(t, { id: n.entite_id }, 'remarque');
      assert.ok(typeof remarque === 'string' && remarque.includes(n.texte.trim()), `${t}:${n.entite_id} (${n.cellule}) : note absente de la remarque`);
    }
  }
});

test('la remarque est cherchable (plein texte des entités) et visible dans l’explorateur', () => {
  // la remarque de Laser noir tant que le site ne l'a pas réécrite, sinon celle (actuelle) d'un autre sort : deux de ses mots
  const s = db.prepare('SELECT id, remarque FROM sort WHERE remarque IS NOT NULL ORDER BY id = ? DESC, id LIMIT 1').get(LASER_NOIR);
  const requete = s.id === LASER_NOIR && !historique.modifiee('sort', { id: LASER_NOIR }, 'remarque')
    ? 'concentration bonus'
    : (s.remarque.toLowerCase().match(/\p{L}{6,}/gu) ?? []).slice(0, 2).join(' ');
  const trouve = db.prepare("SELECT entite_id FROM entite_fts WHERE entite_fts MATCH ? AND entite_table = 'sort'").all(requete).map((r) => r.entite_id);
  assert.ok(trouve.includes(s.id), `${s.id} : « ${requete} »`);
});

test('db:check détecte une remarque qui a perdu une note', () => {
  // une note d'un sort que le site n'a jamais touché : une ligne de l'historique serait comparée à sa remarque d'import, qui masquerait le défaut injecté
  const note = db.prepare("SELECT entite_id, cellule FROM note_cellule WHERE entite_table = 'sort' ORDER BY entite_id = ? DESC, entite_id").all(LASER_NOIR)
    .find((n) => !historique.touchee('sort', { id: n.entite_id }));
  const dir = mkdtempSync(join(tmpdir(), 'remarque-'));
  const copie = join(dir, 'm.db');
  cpSync(cheminBase({ sansExemples: false }), copie);
  const d = new DatabaseSync(copie);
  d.prepare("UPDATE sort SET remarque = 'autre chose' WHERE id = ?").run(note.entite_id);
  d.close();
  const r = spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-check.mjs'), copie], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes(`remarque : la note sort:${note.entite_id} (${note.cellule}) ne figure pas`), r.stdout);
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
  assert.equal(instructions.filter((l) => /^ALTER TABLE \w+ ADD COLUMN remarque TEXT;$/.test(l)).length, entites.filter((t) => !CREEES_APRES_0002.includes(t)).length + RETIREES_APRES_0002.length);
  for (const t of RETIREES_APRES_0002) assert.ok(instructions.includes(`ALTER TABLE ${t} ADD COLUMN remarque TEXT;`) && !entites.includes(t), t);
  assert.ok(!/\b(DROP|DELETE|RENAME)\b/i.test(sql), 'migration additive');
  assert.equal(instructions.filter((l) => l.startsWith('UPDATE ')).length, tablesAvecNotes.filter((t) => !CREEES_APRES_0002.includes(t)).length);
});
