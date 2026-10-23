// Résolution d'un lot en conflit du journal de l'édition (migration 0072, data/schema.sql section 14 ; demande du propriétaire du 2026-10-22 : « Après
// les listes de modifications, montrer les lignes en conflits […] Laisser le choix entre 1, 2, ou 3 ») : modification_lot.resolu_le (instant),
// resolu_par (le nouveau lot normal qui le reprend, jamais lui-même) et resolution (les choix, tableau JSON), NULL tant que le lot n'est pas résolu.
// Les lignes d'un lot résolu restent 'conflit', comme trace. Une base vivante d'avant 0072 est reprise : ses lots en conflit deviennent « à résoudre ».
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('resolution');
const REGLES = cheminBase({ sansExemples: false });
let compteur = 0;
const nouveau = (prefixe) => join(racine, `${prefixe}-${(compteur += 1)}`);
const FAIT_LE = '2026-10-20T09:00:00Z';
const RESOLU_LE = '2026-10-22T11:00:00Z';

function copie(sql = '') {
  const f = `${nouveau('regles')}.db`;
  copyFileSync(REGLES, f);
  if (sql) {
    const db = new DatabaseSync(f, { enableForeignKeyConstraints: false });
    db.exec(sql);
    db.close();
  }
  return f;
}

/** Un lot, avec ses colonnes de résolution ; rend 'ok' ou le message de SQLite. */
function lot(db, id, { le = null, par = null, resolution = null } = {}) {
  try {
    db.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume, resolu_le, resolu_par, resolution) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)')
      .run(id, FAIT_LE, 'guide/la-magie-en-jeu', `lot ${id}`, le, par, resolution);
    return 'ok';
  } catch (e) {
    return e.message;
  }
}

test('migration 0072 : trois colonnes de modification_lot, NULL par défaut, en dernier', () => {
  const db = new DatabaseSync(REGLES, { readOnly: true });
  try {
    const colonnes = db.prepare("SELECT name, type, \"notnull\", dflt_value FROM pragma_table_info('modification_lot') ORDER BY cid").all().map((c) => ({ ...c }));
    assert.deepEqual(colonnes.map((c) => c.name), ['id', 'fait_le', 'auteur_id', 'page_id', 'resume', 'resolu_le', 'resolu_par', 'resolution']);
    for (const c of colonnes.slice(5)) assert.deepEqual([c.type, c.notnull, c.dflt_value], ['TEXT', 0, null], c.name);
    const fk = db.prepare("SELECT \"table\", \"from\", \"to\" FROM pragma_foreign_key_list('modification_lot') WHERE \"from\" = 'resolu_par'").all().map((f) => ({ ...f }));
    assert.deepEqual(fk, [{ table: 'modification_lot', from: 'resolu_par', to: 'id' }]);
    assert.equal(db.prepare('SELECT count(*) AS n FROM modification_lot').get().n, 0, 'section 14 vide dans data/rows');
    assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 72, 'schéma d’au moins la version de la migration 0072 (une migration suivante la monte)');
  } finally {
    db.close();
  }
});

test('migration 0072 : les contraintes de la résolution acceptent un lot résolu et refusent une résolution incohérente', () => {
  const db = new DatabaseSync(copie());
  db.exec('PRAGMA foreign_keys = ON');
  try {
    assert.equal(lot(db, 'nouveau'), 'ok', 'lot normal : rien de résolu');
    assert.equal(lot(db, 'repris', { le: RESOLU_LE, par: 'nouveau', resolution: '[{"rang":1,"colonne":"corps_md","choix":3},{"rang":2,"colonne":null,"choix":2}]' }), 'ok');
    assert.equal(lot(db, 'abandonne', { le: RESOLU_LE, resolution: '[{"rang":1,"colonne":null,"choix":2}]' }), 'ok', 'tous les choix ont abandonné : pas de nouveau lot');
    const refus = {
      'resolu_par sans resolu_le': lot(db, 'r1', { par: 'nouveau' }),
      'resolu_par = id': lot(db, 'r2', { le: RESOLU_LE, par: 'r2', resolution: '[]' }),
      'resolu_par absent': lot(db, 'r3', { le: RESOLU_LE, par: 'inconnu', resolution: '[]' }),
      'resolu_le sans resolution': lot(db, 'r4', { le: RESOLU_LE }),
      'resolution sans resolu_le': lot(db, 'r5', { resolution: '[]' }),
      'resolution objet': lot(db, 'r6', { le: RESOLU_LE, resolution: '{"rang":1}' }),
      'resolution illisible': lot(db, 'r7', { le: RESOLU_LE, resolution: '[{"rang":1' }),
      'resolu_le hors forme': lot(db, 'r8', { le: '2026-10-22 11:00:00', resolution: '[]' }),
    };
    for (const [cas, message] of Object.entries(refus)) assert.match(message, /constraint failed/, cas);
    assert.match(refus['resolu_par absent'], /FOREIGN KEY/);
    // la livraison et le rapatriement vident le journal d'un coup (mise-a-jour-regles.mjs, db-appliquer-edition.mjs) : la clé vers soi ne l'empêche pas
    db.exec('DELETE FROM modification; DELETE FROM modification_lot');
    assert.equal(db.prepare('SELECT count(*) AS n FROM modification_lot').get().n, 0);
  } finally {
    db.close();
  }
});

/** La table modification_lot d'avant 0072 (sans les colonnes de la résolution), lignes gardées. */
function enBaseDAvant0072(chemin) {
  const db = new DatabaseSync(chemin, { enableForeignKeyConstraints: false });
  try {
    db.exec(`CREATE TABLE modification_lot_avant (
        id         TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
        fait_le    TEXT    NOT NULL CHECK (fait_le GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z'),
        auteur_id  TEXT    REFERENCES utilisateur(id),
        page_id    TEXT    CHECK (page_id IS NULL OR length(page_id) > 0),
        resume     TEXT    NOT NULL CHECK (length(resume) > 0)
      ) STRICT;
      INSERT INTO modification_lot_avant SELECT id, fait_le, auteur_id, page_id, resume FROM modification_lot;
      DROP TABLE modification_lot;
      ALTER TABLE modification_lot_avant RENAME TO modification_lot;`);
  } finally {
    db.close();
  }
}

test('migration 0072 : une base vivante d’avant est reprise ; son lot en conflit garde ses lignes « conflit » et devient à résoudre', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: copie(), dossier });
  enBaseDAvant0072(chemin);
  const avant = new DatabaseSync(chemin);
  try {
    avant.exec('PRAGMA foreign_keys = ON');
    assert.ok(!avant.prepare("SELECT 1 FROM pragma_table_info('modification_lot') WHERE name = 'resolu_le'").get(), 'base d’avant 0072');
    avant.prepare("INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES ('lot-conflit', ?, NULL, 'guide/le-mode-hyper', 'Page : corps_md')").run(FAIT_LE);
    avant.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu)
      VALUES ('lot-conflit', 1, 'page', '{"id":"guide/le-mode-hyper"}', 'modifier', '{"corps_md":"ancien"}', '{"corps_md":"du site de dev"}', 'conflit',
        'lot lot-conflit : page {"id":"guide/le-mode-hyper"} : les règles ont changé corps_md autrement', NULL)`).run();
  } finally {
    avant.close();
  }

  // une livraison : la base vivante est refaite d'après les règles de la version 70
  const r = preparerBaseVivante({ regles: copie("UPDATE race SET nom = 'Humain (0072)' WHERE id = 'races/humain'"), dossier });
  assert.equal(r.refaite, true);
  const db = new DatabaseSync(chemin);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    assert.deepEqual({ ...db.prepare("SELECT resume, resolu_le, resolu_par, resolution FROM modification_lot WHERE id = 'lot-conflit'").get() },
      { resume: 'Page : corps_md', resolu_le: null, resolu_par: null, resolution: null }, 'colonnes communes recopiées, nouvelles NULL : à résoudre');
    assert.deepEqual({ ...db.prepare("SELECT etat, apres FROM modification WHERE lot_id = 'lot-conflit'").get() }, { etat: 'conflit', apres: '{"corps_md":"du site de dev"}' });
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    // la résolution s'écrit sur la base reprise ; les lignes du lot restent « conflit », comme trace
    assert.equal(lot(db, 'lot-repris'), 'ok');
    db.prepare("UPDATE modification_lot SET resolu_le = ?, resolu_par = 'lot-repris', resolution = '[{\"rang\":1,\"colonne\":\"corps_md\",\"choix\":1}]' WHERE id = 'lot-conflit'").run(RESOLU_LE);
    assert.equal(db.prepare("SELECT etat FROM modification WHERE lot_id = 'lot-conflit'").get().etat, 'conflit');
    assert.throws(() => db.prepare("UPDATE modification_lot SET resolu_le = NULL WHERE id = 'lot-conflit'").run(), /constraint failed/, 'une résolution ne se défait pas à moitié');
  } finally {
    db.close();
  }

  // une livraison suivante recopie la résolution telle quelle (clé vers la table elle-même contrôlée après la copie : clesRompues)
  assert.equal(preparerBaseVivante({ regles: copie("UPDATE race SET nom = 'Humain (0072 bis)' WHERE id = 'races/humain'"), dossier }).refaite, true);
  const suite = new DatabaseSync(chemin, { readOnly: true });
  try {
    assert.deepEqual({ ...suite.prepare("SELECT resolu_le, resolu_par FROM modification_lot WHERE id = 'lot-conflit'").get() }, { resolu_le: RESOLU_LE, resolu_par: 'lot-repris' });
    assert.equal(suite.prepare("SELECT etat FROM modification WHERE lot_id = 'lot-conflit'").get().etat, 'conflit', 'un lot résolu n’est pas rejoué');
  } finally {
    suite.close();
  }
});

test('migration 0072 : une résolution qui cite un lot disparu bloque la reprise de la base vivante (clesRompues)', () => {
  const dossier = nouveau('db');
  const { chemin } = preparerBaseVivante({ regles: copie(), dossier });
  const db = new DatabaseSync(chemin, { enableForeignKeyConstraints: false });
  try {
    assert.equal(lot(db, 'orphelin', { le: RESOLU_LE, par: 'disparu', resolution: '[]' }), 'ok', 'clés étrangères coupées : écrit');
  } finally {
    db.close();
  }
  assert.throws(() => preparerBaseVivante({ regles: copie("UPDATE race SET nom = 'Humain (orphelin)' WHERE id = 'races/humain'"), dossier }),
    /modification_lot\.resolu_par = « disparu » absent de modification_lot/);
});
