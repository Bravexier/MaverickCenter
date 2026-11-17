// Migration data/migrations/0125-types-de-degats-et-magies-en-mots-cles.sql (lot « liens glossaire : types de dégâts et magies », demande du
// propriétaire du 2026-11-14 : « les armes et armures référencera leur type ou résistance (taille, estoc et frappe) via ce mot clé. De même pour les
// magies. », « Si ils existent! ») : la table type_degats (une ligne par valeur fermée des colonnes de type de dégâts, son mot-clé, ou la magie du même
// nom pour feu, eau, glace) et la colonne magie.mot_cle_id. Les colonnes qui portent les valeurs gardent leurs données et leur CHECK.
// Le site de dev peut changer ces références : une fusion de mots-clés les reporte sur le mot-clé gardé (serveur/edition-mots-cles.mjs#reporterLesReferences),
// et l'adresse d'un mot-clé se modifie. Ce que la migration a posé se lit donc dans l'état de la migration (test/aide-base-d-import.mjs,
// baseDImport({ garder: lotsAvant('0125') }) : Frappe, Taille et Estoc, créés sur le site avant elle, y restent) ; l'état courant ne garde que des
// invariants (chaque valeur des CHECK a sa ligne, chaque référence existe, CHECK de forme). À l'import sans lot gardé (baseDImport()), ces trois
// mots-clés n'existent pas et la référence vaut NULL.
//   node --test test/db-0125-types-de-degats-et-magies.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });

/** Les colonnes dont le CHECK énumère des types de dégâts (une liste qui contient 'estoc'), hors type_degats : `table.colonne` -> valeurs admises. */
function colonnesDeTypeDeDegats(base) {
  const colonnes = new Map();
  for (const { name, sql } of base.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL").all()) {
    for (const [, colonne, liste] of sql.matchAll(/CHECK \((\w+) IN \(([^)]*)\)\)/g)) {
      const valeurs = [...liste.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      if (name !== 'type_degats' && valeurs.includes('estoc')) colonnes.set(`${name}.${colonne}`, valeurs);
    }
  }
  return colonnes;
}

test('les colonnes de type de dégâts : les huit du lot, et chacune de leurs valeurs a sa ligne dans type_degats', () => {
  const colonnes = colonnesDeTypeDeDegats(db);
  assert.deepEqual([...colonnes.keys()].sort(), [
    'arme_degats.type_degats', 'arme_elementaire_type_degats.type_degats', 'armure_degats.type_degats', 'creature_attaque_type.type',
    'creature_capacite_resistance.cible_degat', 'invocation_resistance.cible_degat', 'magie_resistance.cible_physique', 'personnage_arme.type_degats_choisi',
  ], 'une colonne de type de dégâts ajoutée au schéma : ses valeurs ont leur ligne dans type_degats');
  const lignes = new Set(db.prepare('SELECT id FROM type_degats').all().map((l) => l.id));
  const valeurs = new Set([...colonnes.values()].flat());
  assert.deepEqual([...lignes].sort(), [...valeurs].sort(), 'une ligne par valeur admise, pas une de plus');
  // les données en place : chaque valeur écrite a sa ligne (le CHECK de la colonne le garantit déjà ; la table et le CHECK disent la même liste)
  for (const cle of colonnes.keys()) {
    const [table, colonne] = cle.split('.');
    for (const { v } of db.prepare(`SELECT DISTINCT "${colonne}" AS v FROM "${table}" WHERE "${colonne}" IS NOT NULL`).all()) assert.ok(lignes.has(v), `${cle} = ${v}`);
  }
});

test('contraintes (base neuve) : magie_id pour feu, eau, glace seulement, jamais avec mot_cle_id ; aucune autre valeur', () => {
  // sans clés étrangères : seuls les CHECK et l'index unique sont éprouvés (ni page ni famille à poser)
  const essai = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  essai.exec(SCHEMA);
  const magie = (id, ordre, motCle) => essai.prepare('INSERT INTO magie (id, nom, nom_cle, onglet, ordre, origine, source_ref, mono_magie, mot_cle_id) ' +
    "VALUES (?, ?, ?, ?, ?, 'magies', 'essai', 0, ?)").run(id, id, id.replace('/', '-'), id, ordre, motCle);
  magie('magies/essai', 1, null);
  const poser = (id, motCle, magie) => {
    essai.prepare('INSERT INTO type_degats (id, mot_cle_id, magie_id) VALUES (?, ?, ?)').run(id, motCle, magie);
    essai.prepare('DELETE FROM type_degats WHERE id = ?').run(id);
  };
  for (const id of ['taille', 'estoc', 'frappe', 'physique', 'sonore']) {
    assert.doesNotThrow(() => poser(id, 9001, null), id);
    assert.doesNotThrow(() => poser(id, null, null), id);
    assert.throws(() => poser(id, null, 'magies/essai'), /CHECK/, `${id} : pas de magie`);
  }
  for (const id of ['feu', 'eau', 'glace']) {
    assert.doesNotThrow(() => poser(id, null, 'magies/essai'), id);
    assert.throws(() => poser(id, null, null), /CHECK/, `${id} : sa magie`);
    assert.throws(() => poser(id, 9001, 'magies/essai'), /CHECK/, `${id} : le mot-clé passe par la magie`);
  }
  assert.throws(() => poser('acide', null, null), /CHECK/);
  // deux magies n'ont jamais le même mot-clé (index unique partiel magie_mot_cle) ; NULL autant qu'il le faut
  essai.exec("UPDATE magie SET mot_cle_id = 9001 WHERE id = 'magies/essai'");
  assert.throws(() => magie('magies/essai-2', 2, 9001), /UNIQUE/);
  assert.doesNotThrow(() => { magie('magies/essai-3', 3, null); magie('magies/essai-4', 4, null); });
  essai.close();
});

test('sans cascade, comme sort_mot_cle : un mot-clé qui définit un type de dégâts ou une magie ne se supprime pas', () => {
  for (const [table, colonne] of [['type_degats', 'mot_cle_id'], ['magie', 'mot_cle_id']]) {
    const cle = db.prepare(`SELECT * FROM pragma_foreign_key_list('${table}') WHERE "from" = ?`).get(colonne);
    assert.deepEqual([cle.table, cle.to, cle.on_delete], ['mot_cle', 'id', 'NO ACTION'], `${table}.${colonne}`);
    assert.equal(db.prepare(`SELECT "notnull" AS n FROM pragma_table_info('${table}') WHERE name = ?`).get(colonne).n, 0, `${table}.${colonne} nullable`);
  }
  assert.equal(db.prepare('PRAGMA table_info(magie)').all().at(-1).name, 'mot_cle_id', 'magie.mot_cle_id ajoutée en dernier');
});

test('état courant : chaque référence existe, chaque magie a un mot-clé distinct, feu, eau, glace ont une magie qui a le sien', () => {
  for (const { id, mot_cle_id: m } of db.prepare('SELECT id, mot_cle_id FROM type_degats WHERE mot_cle_id IS NOT NULL').all()) {
    assert.ok(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(m), `type_degats ${id} : mot-clé ${m}`);
  }
  for (const { id, magie_id: m } of db.prepare('SELECT id, magie_id FROM type_degats WHERE magie_id IS NOT NULL').all()) {
    assert.ok(db.prepare('SELECT 1 FROM magie WHERE id = ?').get(m), `type_degats ${id} : magie ${m}`);
  }
  const poses = db.prepare('SELECT mot_cle_id FROM magie WHERE mot_cle_id IS NOT NULL').all().map((l) => l.mot_cle_id);
  assert.equal(new Set(poses).size, poses.length, 'deux magies n\'ont jamais le même mot-clé');
  for (const m of poses) assert.ok(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(m), `magie : mot-clé ${m}`);
  assert.deepEqual(db.prepare('SELECT * FROM pragma_foreign_key_check(\'type_degats\')').all(), []);
});

test('état de la migration : Taille 440, Estoc 441, Frappe 439 ; physique et sonore sans mot-clé ; feu, eau, glace par la magie de leurs attaques', () => {
  const base = baseDImport({ garder: lotsAvant('0125') });
  const lignes = Object.fromEntries(base.prepare('SELECT id, mot_cle_id, magie_id FROM type_degats').all().map((l) => [l.id, { ...l }]));
  // ids figés des mots-clés (data/rows/mot_cle.sql), créés sur le site avant la migration
  assert.deepEqual({ taille: lignes.taille.mot_cle_id, estoc: lignes.estoc.mot_cle_id, frappe: lignes.frappe.mot_cle_id }, { taille: 440, estoc: 441, frappe: 439 });
  for (const id of ['physique', 'sonore']) assert.deepEqual([lignes[id].mot_cle_id, lignes[id].magie_id], [null, null], `${id} : le glossaire n'a pas ce mot-clé`);
  for (const id of ['taille', 'estoc', 'frappe']) assert.ok(base.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(lignes[id].mot_cle_id), id);
  // feu, eau, glace : la magie du même nom, celle que portent leurs attaques de créature (creature_attaque_type.magie_id)
  for (const id of ['feu', 'eau', 'glace']) {
    const magies = base.prepare('SELECT DISTINCT magie_id FROM creature_attaque_type WHERE type = ?').all(id).map((l) => l.magie_id);
    assert.ok(magies.length, `${id} : des attaques de ce type`);
    for (const m of magies) assert.equal(m, lignes[id].magie_id, `${id} : la magie de ses attaques`);
    assert.ok(base.prepare('SELECT mot_cle_id FROM magie WHERE id = ?').get(lignes[id].magie_id)?.mot_cle_id != null, `${id} : son mot-clé est celui de la magie`);
  }
});

test('état de la migration : magie.mot_cle_id est le mot-clé qui mène à la page de la magie', () => {
  const base = baseDImport({ garder: lotsAvant('0125') });
  for (const m of base.prepare('SELECT id, mot_cle_id FROM magie ORDER BY id').all()) {
    const versLaPage = base.prepare('SELECT id FROM mot_cle WHERE url = ?').get(`/${m.id}/`);
    assert.ok(versLaPage, `${m.id} : un mot-clé mène à sa page`);
    assert.equal(m.mot_cle_id, versLaPage.id, `${m.id} : le mot-clé de sa page`);
  }
});

test('état d\'import : chaque magie de l\'import a son mot-clé ; un mot-clé créé par le site n\'y existe pas et sa référence vaut NULL', () => {
  const dImport = baseDImport();
  assert.deepEqual(dImport.prepare('SELECT id FROM magie WHERE mot_cle_id IS NULL').all(), [], 'les magies de l\'import ont leur mot-clé (verrouillé, R218)');
  for (const l of dImport.prepare('SELECT id, mot_cle_id FROM type_degats WHERE mot_cle_id IS NOT NULL').all()) {
    assert.ok(dImport.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(l.mot_cle_id), `${l.id} : mot-clé ${l.mot_cle_id} présent à l'import`);
  }
  assert.deepEqual(dImport.prepare('PRAGMA foreign_key_check').all(), []);
});
