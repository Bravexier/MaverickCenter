// Migration data/migrations/0128-lots-de-changements.sql (chantier « la base du site de dev devient la source de vérité », R274, R275 ; lot 6,
// garde-fou 11 : « Un numéro n'est jamais redonné, même par un lot ou après une restauration ») : deux tables de la section 14, vides dans data/rows.
//   - lot_de_changements : une proposition déposée, puis appliquée (avec son bilan), refusée ou annulée ; les CHECK tiennent l'état et ses colonnes
//     ensemble ;
//   - numero_donne : le plus haut numéro donné par table et colonne de clé entière.
// Les contraintes se vérifient sur une base neuve en mémoire (data/schema.sql), jamais sur la base ; la migration se rejoue sur une base d'où les
// deux tables sont retirées.
//   node --test test/db-0128-lots-de-changements.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { lignesDuContenu } from './aide-base-de-depart.mjs';
import { rejouerLaMigration } from './aide-migration-rejouee.mjs';
import { CLASSES_DE_TABLES, classeDeLaTable, TABLES_DU_JOURNAL } from '../src/lib/tables-de-la-base.mjs';

const RACINE = new URL('../../', import.meta.url);
const SCHEMA = readFileSync(new URL('data/schema.sql', RACINE), 'utf8');
const TABLES = ['lot_de_changements', 'numero_donne'];
const DEPOSE = '2026-11-15T10:00:00Z';
const ESSAYE = '2026-11-15T10:05:00Z';
const DECIDE = '2026-11-15T11:00:00Z';
const ANNULE = '2026-11-15T12:00:00Z';
const BILAN = JSON.stringify({ ecrites: 1, changees: [{ rang: 2, colonne: 'nom', attendue: 'A', actuelle: 'B' }], numeros: { mot_cle: [430] } });
const CONTENU = JSON.stringify({ format: 'maverick-lot/1', titre: 'Essai', nature: 'migration', operations: [] });

function baseNeuve() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  db.exec('PRAGMA foreign_keys = ON');
  for (const id of ['lot-a', 'lot-b']) {
    db.prepare(`INSERT INTO modification_lot (id, fait_le, resume, nature) VALUES (?, ?, 'essai', 'migration')`).run(id, DECIDE);
  }
  return db;
}

/** Une proposition valide dans l'état `etat`, retouchée par `autres`. */
function proposition(etat, autres = {}) {
  const base = { id: 'p1', depose_le: DEPOSE, titre: 'Essai', nature: 'migration', decision: null, auteur: null, contenu: CONTENU, etat: 'propose',
    essai: null, essaye_le: null, decide_le: null, lot_id: null, verrous_ouverts: null, annule_le: null, annulation_lot_id: null, bilan: null };
  const parEtat = {
    propose: {},
    refuse: { decide_le: DECIDE },
    applique: { decide_le: DECIDE, lot_id: 'lot-a', bilan: BILAN },
    annule: { decide_le: DECIDE, lot_id: 'lot-a', annule_le: ANNULE, annulation_lot_id: 'lot-b', bilan: BILAN },
  };
  return { ...base, etat, ...parEtat[etat], ...autres };
}

function poser(db, ligne) {
  const colonnes = Object.keys(ligne);
  db.prepare(`INSERT INTO lot_de_changements (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}

/** Pose la ligne dans une base neuve : rend null si elle passe, sinon le message de l'erreur. */
function essayer(ligne) {
  const db = baseNeuve();
  try {
    poser(db, ligne);
    return null;
  } catch (e) {
    return e.message;
  } finally {
    db.close();
  }
}

test('structure : deux tables STRICT de la section 14, entre le journal et le brouillon de la note, « propres au site », vides dans le contenu qui fait foi (contenu fourni, sinon data/rows)', () => {
  const debut14 = SCHEMA.indexOf('-- 14. ÉDITION');
  const debut15 = SCHEMA.indexOf('-- 15. NOTES DE VERSION');
  const section14 = [...SCHEMA.slice(debut14, debut15).matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]);
  // les tables d'une migration postérieure (0129 : migration_recue) viennent après le brouillon de la note
  assert.deepEqual(section14.slice(0, 5), ['modification_lot', 'modification', ...TABLES, 'note_version_brouillon']);
  assert.deepEqual([...TABLES_DU_JOURNAL], section14, 'lib/tables-de-la-base.mjs#TABLES_DU_JOURNAL, dans l’ordre du schéma');
  const db = baseNeuve();
  try {
    for (const t of TABLES) {
      assert.equal(db.prepare('SELECT strict FROM pragma_table_list WHERE name = ?').get(t).strict, 1, `${t} STRICT`);
      assert.equal(classeDeLaTable(t), CLASSES_DE_TABLES.PROPRE_AU_SITE, t);
      const { source, lignes } = lignesDuContenu(t);
      assert.equal(lignes, 0, `${t} : aucun lot dans ${source}`);
    }
    const cles = db.prepare('SELECT "from" AS colonne, "table" AS parent FROM pragma_foreign_key_list(?) ORDER BY "from"').all('lot_de_changements').map((r) => ({ ...r }));
    assert.deepEqual(cles, [{ colonne: 'annulation_lot_id', parent: 'modification_lot' }, { colonne: 'lot_id', parent: 'modification_lot' }]);
    const pk = db.prepare('SELECT name FROM pragma_table_info(?) WHERE pk > 0 ORDER BY pk').all('numero_donne').map((r) => r.name);
    assert.deepEqual(pk, ['table_nom', 'colonne']);
  } finally {
    db.close();
  }
});

test('lot_de_changements : les quatre états, chacun avec ses colonnes', () => {
  for (const etat of ['propose', 'refuse', 'applique', 'annule']) {
    assert.equal(essayer(proposition(etat)), null, etat);
    assert.equal(essayer(proposition(etat, { essai: '{"applicables":0}', essaye_le: ESSAYE })), null, `${etat} essayé`);
  }
  assert.equal(essayer(proposition('applique', { verrous_ouverts: '["R218","R219"]' })), null, 'verrous ouverts au clic');
  assert.equal(essayer(proposition('annule', { verrous_ouverts: '["R218"]' })), null, 'verrous d’un lot annulé');
  assert.equal(essayer(proposition('propose', { nature: 'decision', decision: 'R275', auteur: 'session' })), null, 'nature decision et son numéro');
  for (const nature of ['source', 'migration', 'code']) assert.equal(essayer(proposition('propose', { nature })), null, nature);
});

test('lot_de_changements : un état sans ses colonnes, ou avec celles d’un autre, est refusé', () => {
  const refus = [
    ['propose', { decide_le: DECIDE }, 'proposé mais décidé'],
    ['propose', { lot_id: 'lot-a' }, 'proposé avec un lot du journal'],
    ['propose', { verrous_ouverts: '["R218"]' }, 'verrou ouvert sans application'],
    ['refuse', { decide_le: null }, 'refusé sans instant'],
    ['refuse', { lot_id: 'lot-a' }, 'refusé avec un lot du journal'],
    ['refuse', { verrous_ouverts: '["R218"]' }, 'refusé avec un verrou ouvert'],
    ['applique', { lot_id: null }, 'appliqué sans lot du journal'],
    ['applique', { decide_le: null }, 'appliqué sans instant'],
    ['applique', { annule_le: ANNULE }, 'appliqué avec un instant d’annulation'],
    ['applique', { annulation_lot_id: 'lot-b' }, 'appliqué avec un lot d’annulation'],
    ['annule', { annule_le: null }, 'annulé sans instant'],
    ['annule', { annulation_lot_id: null }, 'annulé sans lot d’annulation'],
    ['annule', { lot_id: null }, 'annulé sans lot d’application'],
    ['annule', { annulation_lot_id: 'lot-a' }, 'annulé par son propre lot'],
    ['propose', { essai: '{}' }, 'essai sans instant'],
    ['propose', { essaye_le: ESSAYE }, 'instant d’essai sans essai'],
    ['propose', { essai: '[]', essaye_le: ESSAYE }, 'essai qui n’est pas un objet'],
    ['propose', { essaye_le: '2026-11-15T09:00:00Z', essai: '{}' }, 'essayé avant le dépôt'],
    ['refuse', { decide_le: '2026-11-15T09:00:00Z' }, 'décidé avant le dépôt'],
    ['annule', { annule_le: '2026-11-15T10:30:00Z' }, 'annulé avant l’application'],
    ['applique', { verrous_ouverts: '[]' }, 'liste de verrous vide (NULL : aucun)'],
    ['applique', { verrous_ouverts: '{"R218":true}' }, 'verrous hors tableau'],
    ['applique', { verrous_ouverts: 'R218' }, 'verrous hors JSON'],
    ['propose', { etat: 'en_attente' }, 'état inconnu'],
    ['propose', { bilan: BILAN }, 'bilan sans application'],
    ['refuse', { bilan: BILAN }, 'refusé avec un bilan'],
    ['applique', { bilan: null }, 'appliqué sans bilan'],
    ['annule', { bilan: null }, 'annulé sans bilan (celui de l’application reste)'],
    ['applique', { bilan: '[]' }, 'bilan qui n’est pas un objet'],
    ['applique', { bilan: 'écrit' }, 'bilan hors JSON'],
  ];
  for (const [etat, autres, raison] of refus) assert.match(essayer(proposition(etat, autres)) ?? 'accepté', /CHECK/, raison);
  assert.match(essayer(proposition('propose', { etat: null })) ?? 'accepté', /NOT NULL/, 'état absent');
});

test('lot_de_changements : en-tête et contenu (nature jamais « saisie », numéro de décision ssi nature decision, contenu objet avec operations)', () => {
  const refus = [
    [{ nature: 'saisie' }, 'nature saisie'],
    [{ nature: 'Decision' }, 'nature inconnue'],
    [{ nature: 'decision' }, 'decision sans numéro'],
    [{ nature: 'migration', decision: 'R275' }, 'numéro sans nature decision'],
    [{ nature: 'decision', decision: 'r275' }, 'numéro mal formé'],
    [{ nature: 'decision', decision: 'R275(2)' }, 'numéro avec un alinéa'],
    [{ titre: '' }, 'titre vide'],
    [{ auteur: '' }, 'auteur vide (NULL : non dit)'],
    [{ depose_le: '2026-11-15 10:00:00' }, 'instant de dépôt hors ISO UTC'],
    [{ contenu: '[]' }, 'contenu qui n’est pas un objet'],
    [{ contenu: 'pas du JSON' }, 'contenu hors JSON'],
    [{ contenu: '{"titre":"Essai","nature":"migration"}' }, 'contenu sans operations'],
    [{ contenu: '{"titre":"Essai","nature":"migration","operations":{}}' }, 'operations hors tableau'],
  ];
  for (const [autres, raison] of refus) assert.match(essayer(proposition('propose', autres)) ?? 'accepté', /CHECK/, raison);
  for (const colonne of ['depose_le', 'titre', 'nature', 'contenu']) {
    assert.match(essayer(proposition('propose', { [colonne]: null })) ?? 'accepté', /NOT NULL/, `${colonne} absent`);
  }
});

test('lot_de_changements : le lot du journal cité existe, et n’est écrit que par une seule application ou annulation', () => {
  assert.match(essayer(proposition('applique', { lot_id: 'lot-absent' })) ?? 'accepté', /FOREIGN KEY/, 'lot du journal absent');
  assert.match(essayer(proposition('annule', { annulation_lot_id: 'lot-absent' })) ?? 'accepté', /FOREIGN KEY/, 'lot d’annulation absent');
  const db = baseNeuve();
  try {
    poser(db, proposition('applique'));
    assert.throws(() => poser(db, proposition('applique', { id: 'p2' })), /UNIQUE/, 'deux propositions pour un lot du journal');
    poser(db, proposition('propose', { id: 'p3' }));
    db.prepare("UPDATE lot_de_changements SET etat = 'applique', decide_le = ?, lot_id = 'lot-b', bilan = ? WHERE id = 'p3'").run(DECIDE, BILAN);
    assert.throws(() => db.prepare("UPDATE lot_de_changements SET etat = 'annule', annule_le = ?, annulation_lot_id = 'lot-b' WHERE id = 'p3'").run(ANNULE), /CHECK/);
    assert.throws(() => db.prepare("DELETE FROM modification_lot WHERE id = 'lot-a'").run(), /FOREIGN KEY/, 'le lot du journal cité reste');
  } finally {
    db.close();
  }
});

test('numero_donne : un plafond entier positif ou nul par table et colonne', () => {
  const db = baseNeuve();
  try {
    const inserer = db.prepare('INSERT INTO numero_donne (table_nom, colonne, plafond) VALUES (?, ?, ?)');
    inserer.run('mot_cle', 'id', 429);
    inserer.run('categorie_mot_cle', 'id', 0);
    assert.throws(() => inserer.run('mot_cle', 'id', 430), /UNIQUE|PRIMARY KEY/, 'une ligne par table et colonne');
    assert.throws(() => inserer.run('mot_cle', 'rang', -1), /CHECK/, 'plafond négatif');
    assert.throws(() => inserer.run('mot_cle', 'rang', 1.5), /cannot store REAL/, 'plafond non entier (STRICT)');
    assert.throws(() => inserer.run('mot_cle', 'rang', null), /NOT NULL/, 'plafond absent');
    for (const [table, colonne] of [['', 'id'], ['Mot_cle', 'id'], ['mot_cle', ''], ['mot_cle', 'id; --'], ['mot-cle', 'id']]) {
      assert.throws(() => inserer.run(table, colonne, 1), /CHECK/, `${table}.${colonne}`);
    }
    // le service ne fait que monter le plafond : la forme portable d'une montée
    db.prepare(`INSERT INTO numero_donne (table_nom, colonne, plafond) VALUES ('mot_cle', 'id', ?)
      ON CONFLICT (table_nom, colonne) DO UPDATE SET plafond = max(plafond, excluded.plafond)`).run(12);
    assert.equal(db.prepare("SELECT plafond FROM numero_donne WHERE table_nom = 'mot_cle'").get().plafond, 429);
  } finally {
    db.close();
  }
});

test('migration rejouée : les deux tables et leurs index reprennent la forme de data/schema.sql', () => {
  const db = baseNeuve();
  try {
    const forme = () => Object.fromEntries(TABLES.map((t) => [t, {
      colonnes: db.prepare(`PRAGMA table_xinfo(${t})`).all().map((c) => ({ ...c })),
      index: db.prepare(`SELECT name, "unique", partial FROM pragma_index_list(?) ORDER BY name`).all(t).map((i) => ({ ...i })),
      cles: db.prepare(`SELECT * FROM pragma_foreign_key_list(?) ORDER BY id`).all(t).map((c) => ({ ...c })),
    }]));
    const attendu = forme();
    db.exec('DROP TABLE lot_de_changements; DROP TABLE numero_donne');
    db.exec('BEGIN');
    rejouerLaMigration(db, '0128-lots-de-changements.sql');
    db.exec('COMMIT');
    assert.deepEqual(forme(), attendu);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});
