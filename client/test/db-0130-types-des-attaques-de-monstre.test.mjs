// Migration data/migrations/0130-types-des-attaques-de-monstre.sql (décisions R288, R295, R298 à R301) : la table monstre_attaque_type (zéro, un ou
// plusieurs types de dégâts par attaque de carte, dans l'ordre écrit, R299) et type_degats élargie aux onze types que les attaques écrivent hors de la
// liste, chacun lié à la magie du même nom (R298). Migration de structure seule : les lignes viennent d'un lot de changements du site de dev, un type
// n'étant posé que si le texte copié du doc le nomme (R295 : « le type d'une attaque n'est donné que s'il est sourcé »). Le test ne fige donc aucune
// ligne : la structure et ses contraintes sur une base neuve, puis, sur l'état courant, les invariants de R295 et R299 (chaque type posé est écrit dans
// le texte de son attaque, dans l'ordre des rangs). La correspondance id -> magie est celle du CHECK (ids figés), pas une valeur modifiable.
//   node --test test/db-0130-types-des-attaques-de-monstre.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { testRetireAvecLesMixtes } from './aide-sortie-du-contenu.mjs';

// Les tests qui éprouvent la migration mixte elle-même sortent avec elle (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LES_MIXTES).
const testDeLaMixte = testRetireAvecLesMixtes(import.meta.url);

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const migration = () => readFileSync(new URL('../../data/migrations/0130-types-des-attaques-de-monstre.sql', import.meta.url), 'utf8');
const db = ouvrirBase({ sansExemples: false });

/** R298 : les onze types ajoutés et la magie du même nom de chacun (feu, eau, glace : migration 0125). */
const MAGIE_DU_TYPE = {
  feu: 'magies/magie-du-feu', eau: 'magies/magie-de-leau', glace: 'magies/magie-de-la-glace',
  foudre: 'magies/magie-de-la-foudre', lumiere: 'magies/magie-de-la-lumiere', arcane: 'magies/magie-de-larcane', sang: 'magies/magie-du-sang',
  terre: 'magies/magie-de-la-terre', ombre: 'magies/magie-de-lombre', corruption: 'magies/magie-de-la-corruption',
  'espace-temps': 'magies/magie-de-lespace-temps', vide: 'magies/magie-du-vide', vent: 'magies/magie-du-vent', necromancie: 'magies/magie-de-la-necromancie',
};
const SANS_MAGIE = ['taille', 'estoc', 'frappe', 'physique', 'sonore'];

/** Une base neuve du schéma, sans clés étrangères (seuls les CHECK, clés primaires et UNIQUE sont éprouvés) ; un test les active après sa pose. */
function baseNeuve() {
  const essai = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  essai.exec(SCHEMA);
  return essai;
}

testDeLaMixte('migration de structure seule : aucune ligne insérée hors de la recopie de type_degats (R295 : les types viennent du site de dev)', () => {
  const MIGRATION = migration();
  const inserts = [...MIGRATION.matchAll(/^\s*INSERT\b[^;]*;/gim)].map((m) => m[0]);
  assert.equal(inserts.length, 1);
  assert.match(inserts[0], /INSERT INTO type_degats_0130 \(id, mot_cle_id, magie_id\) SELECT id, mot_cle_id, magie_id FROM type_degats;/);
  assert.doesNotMatch(MIGRATION, /^\s*(UPDATE|DELETE|VALUES)\b/im);
});

test('type_degats (base neuve) : chaque type élémentaire a la magie du même nom, et elle seule (R298) ; les autres, aucune', () => {
  const essai = baseNeuve();
  const poser = (id, motCle, magie) => {
    essai.prepare('INSERT INTO type_degats (id, mot_cle_id, magie_id) VALUES (?, ?, ?)').run(id, motCle, magie);
    essai.prepare('DELETE FROM type_degats WHERE id = ?').run(id);
  };
  for (const [id, magie] of Object.entries(MAGIE_DU_TYPE)) {
    assert.doesNotThrow(() => poser(id, null, magie), id);
    assert.throws(() => poser(id, null, null), /CHECK/, `${id} : sa magie`);
    assert.throws(() => poser(id, null, magie === MAGIE_DU_TYPE.feu ? MAGIE_DU_TYPE.eau : MAGIE_DU_TYPE.feu), /CHECK/, `${id} : pas une autre magie`);
    assert.throws(() => poser(id, 9001, magie), /CHECK/, `${id} : le mot-clé passe par la magie`);
  }
  for (const id of SANS_MAGIE) {
    assert.doesNotThrow(() => poser(id, null, null), id);
    assert.throws(() => poser(id, null, MAGIE_DU_TYPE.foudre), /CHECK/, `${id} : pas de magie`);
  }
  // un type hors liste reste une question au propriétaire (R298) : la liste ne s'élargit que par migration
  for (const id of ['neutre', 'elementaire', 'acide', 'Foudre']) assert.throws(() => poser(id, null, null), /CHECK/, id);
  essai.close();
});

test('monstre_attaque_type : clés vers l\'attaque et vers type_degats, sans cascade ni CHECK recopié des types', () => {
  const cles = db.prepare("SELECT id, seq, \"table\", \"from\", \"to\", on_delete FROM pragma_foreign_key_list('monstre_attaque_type') ORDER BY id, seq").all()
    .map((c) => [c.table, c.from, c.to, c.on_delete]);
  assert.deepEqual(cles.sort(), [
    ['monstre_attaque', 'attaque_rang', 'rang', 'NO ACTION'], ['monstre_attaque', 'monstre_id', 'monstre_id', 'NO ACTION'],
    ['type_degats', 'type', 'id', 'NO ACTION'],
  ].sort());
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'monstre_attaque_type'").get().sql;
  assert.doesNotMatch(sql, /'estoc'|'foudre'/, 'le vocabulaire est celui de type_degats');
  const cle = db.prepare("SELECT name, pk FROM pragma_table_info('monstre_attaque_type') WHERE pk > 0 ORDER BY pk").all().map((c) => c.name);
  assert.deepEqual(cle, ['monstre_id', 'attaque_rang', 'rang']);
});

test('monstre_attaque_type (base neuve) : zéro, un ou plusieurs types par attaque, ordonnés, sans doublon ; type et attaque existants', () => {
  const essai = baseNeuve();
  essai.exec(`INSERT INTO type_degats (id, mot_cle_id, magie_id) VALUES ('taille', NULL, NULL), ('estoc', NULL, NULL), ('foudre', NULL, '${MAGIE_DU_TYPE.foudre}')`);
  const attaque = essai.prepare("INSERT INTO monstre_attaque (monstre_id, rang, nom, texte, origine, source_ref) VALUES ('monstres/essai', ?, 'Essai', 'x', 'monstres', 'essai')");
  for (const rang of [1, 2, 3]) attaque.run(rang);
  essai.exec('PRAGMA foreign_keys = ON');
  const type = essai.prepare("INSERT INTO monstre_attaque_type (monstre_id, attaque_rang, rang, type, libelle) VALUES ('monstres/essai', ?, ?, ?, ?)");
  // attaque 1 : deux types, dans l'ordre écrit (R299) ; attaque 2 : un type hors de l'ancienne liste (R298) ; attaque 3 : aucun (R300)
  type.run(1, 1, 'taille', 'taille');
  type.run(1, 2, 'estoc', 'estoc');
  type.run(2, 1, 'foudre', 'Foudre');
  assert.throws(() => type.run(1, 3, 'taille', 'tailles'), /UNIQUE/, 'un type une fois par attaque');
  assert.throws(() => type.run(1, 2, 'foudre', 'foudre'), /UNIQUE|PRIMARY/, 'un rang une fois par attaque');
  assert.throws(() => type.run(1, 0, 'foudre', 'foudre'), /CHECK/, 'rang >= 1');
  assert.throws(() => type.run(1, 3, 'foudre', ''), /CHECK/, 'l\'écriture d\'origine n\'est pas vide');
  assert.throws(() => type.run(1, 3, 'glace', 'glace'), /FOREIGN KEY/, 'un type de type_degats');
  assert.throws(() => type.run(9, 1, 'taille', 'taille'), /FOREIGN KEY/, 'une attaque de la carte');
  // sans cascade : une attaque ne se supprime (ni ne se refait) qu'après ses types, comme les autres détails d'une carte
  assert.throws(() => essai.exec("DELETE FROM monstre_attaque WHERE monstre_id = 'monstres/essai' AND rang = 1"), /FOREIGN KEY/);
  assert.throws(() => essai.exec("DELETE FROM type_degats WHERE id = 'foudre'"), /FOREIGN KEY/);
  assert.doesNotThrow(() => essai.exec("DELETE FROM monstre_attaque WHERE monstre_id = 'monstres/essai' AND rang = 3"));
  essai.exec("DELETE FROM monstre_attaque_type WHERE monstre_id = 'monstres/essai' AND attaque_rang = 1");
  assert.doesNotThrow(() => essai.exec("DELETE FROM monstre_attaque WHERE monstre_id = 'monstres/essai' AND rang = 1"));
  essai.close();
});

test('état d\'import : les quatorze magies que le CHECK lie à un type existent (R298 : « une magie existante du même nom »)', () => {
  const dImport = baseDImport();
  for (const [id, magie] of Object.entries(MAGIE_DU_TYPE)) assert.ok(dImport.prepare('SELECT 1 FROM magie WHERE id = ?').get(magie), `${id} : ${magie}`);
});

test('état courant (R295, R299) : chaque type posé est écrit dans le texte de son attaque, dans l\'ordre des rangs ; clés intactes', () => {
  assert.deepEqual(db.prepare("SELECT * FROM pragma_foreign_key_check('monstre_attaque_type')").all(), []);
  assert.deepEqual(db.prepare("SELECT * FROM pragma_foreign_key_check('type_degats')").all(), []);
  const parAttaque = new Map();
  for (const l of db.prepare('SELECT t.monstre_id, t.attaque_rang, t.rang, t.libelle, a.texte FROM monstre_attaque_type t ' +
    'JOIN monstre_attaque a ON a.monstre_id = t.monstre_id AND a.rang = t.attaque_rang ORDER BY t.monstre_id, t.attaque_rang, t.rang').all()) {
    const ou = `${l.monstre_id} attaque ${l.attaque_rang} type ${l.rang}`;
    const cle = `${l.monstre_id}#${l.attaque_rang}`;
    const depuis = parAttaque.get(cle) ?? 0;
    const position = l.texte.indexOf(l.libelle, depuis);
    assert.ok(position >= 0, `${ou} : « ${l.libelle} » est écrit dans le texte de l'attaque, après le type précédent`);
    parAttaque.set(cle, position + l.libelle.length);
  }
});
