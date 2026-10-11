// Historique des modifications du site (lib/historique-site.mjs) sur une base synthétique : la table historique_modification de data/schema.sql,
// deux tables de règles (clé simple, clé composée déclarée dans un autre ordre que les colonnes) et des lots écrits hors de l'ordre de lecture.
// Pin d'import (valeurDImport, lignesDImport, effectifDImport) : l'état d'avant toute édition ; creee, supprimee, modifiee, touchee : ce que le site a fait.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleDeLigne, historiqueSite, lireHistorique } from '../src/lib/historique-site.mjs';

const schema = readFileSync(fileURLToPath(new URL('../../data/schema.sql', import.meta.url)), 'utf8');
const ddl = /CREATE TABLE historique_modification \([\s\S]*?\) STRICT;/.exec(schema)[0];

function base() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(ddl);
  db.exec(`CREATE TABLE metier (id TEXT NOT NULL PRIMARY KEY, nom TEXT NOT NULL, bonus TEXT, remarque TEXT) STRICT;
    CREATE TABLE race_magie (magie_id TEXT NOT NULL, race_id TEXT NOT NULL, acces INTEGER NOT NULL, PRIMARY KEY (race_id, magie_id)) STRICT;`);
  return db;
}
const inserer = (db, table, ligne) => {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
};
const noter = (db, [lot, rang, faitLe], table, cle, operation, avant, apres) =>
  db.prepare('INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)')
    .run(lot, rang, faitLe, 'essai', table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres));

// Import : forgeron, mineur, sapeur, bousier ; race_magie (orios, feu) et (orios, eau). Puis le site, en trois lots écrits dans le désordre :
//   lot-b (10:00) forgeron.bonus +3 → +4 ; pêcheur créé ; bousier supprimé ; (orios, feu) acces 1 → 0
//   lot-a (10:05) forgeron.bonus +4 → +5 et remarque ; sapeur supprimé puis recréé ; mineur.nom ; pêcheur supprimé ; (eau, orios) supprimée
//   lot-c (10:05, après lot-a dans l'ordre (fait_le, lot_id)) : (orios, ombre) créée
function scenario() {
  const db = base();
  inserer(db, 'metier', { id: 'forgeron', nom: 'Forgeron', bonus: '+5', remarque: 'Note.' });
  inserer(db, 'metier', { id: 'mineur', nom: 'Mineur (corrigé)', bonus: '+1', remarque: null });
  inserer(db, 'metier', { id: 'sapeur', nom: 'Sapeur', bonus: '+9', remarque: null });
  inserer(db, 'race_magie', { magie_id: 'feu', race_id: 'orios', acces: 0 });
  inserer(db, 'race_magie', { magie_id: 'ombre', race_id: 'orios', acces: 1 });
  noter(db, ['lot-c', 1, '2026-10-10T10:05:00Z'], 'race_magie', { race_id: 'orios', magie_id: 'ombre' }, 'inserer', null, { magie_id: 'ombre', race_id: 'orios', acces: 1 });
  noter(db, ['lot-a', 1, '2026-10-10T10:05:00Z'], 'metier', { id: 'forgeron' }, 'modifier', { bonus: '+4', remarque: null }, { bonus: '+5', remarque: 'Note.' });
  noter(db, ['lot-a', 2, '2026-10-10T10:05:00Z'], 'metier', { id: 'sapeur' }, 'supprimer', { id: 'sapeur', nom: 'Sapeur', bonus: '+2', remarque: null }, null);
  noter(db, ['lot-a', 3, '2026-10-10T10:05:00Z'], 'metier', { id: 'sapeur' }, 'inserer', null, { id: 'sapeur', nom: 'Sapeur', bonus: '+9', remarque: null });
  noter(db, ['lot-a', 4, '2026-10-10T10:05:00Z'], 'metier', { id: 'mineur' }, 'modifier', { nom: 'Mineur' }, { nom: 'Mineur (corrigé)' });
  noter(db, ['lot-a', 5, '2026-10-10T10:05:00Z'], 'metier', { id: 'pecheur' }, 'supprimer', { id: 'pecheur', nom: 'Pêcheur', bonus: '+1', remarque: null }, null);
  // clé écrite dans l'ordre des colonnes (magie_id, race_id) et non de la clé primaire (race_id, magie_id) : même ligne
  noter(db, ['lot-a', 6, '2026-10-10T10:05:00Z'], 'race_magie', { magie_id: 'eau', race_id: 'orios' }, 'supprimer', { magie_id: 'eau', race_id: 'orios', acces: 1 }, null);
  noter(db, ['lot-b', 1, '2026-10-10T10:00:00Z'], 'metier', { id: 'forgeron' }, 'modifier', { bonus: '+3' }, { bonus: '+4' });
  noter(db, ['lot-b', 2, '2026-10-10T10:00:00Z'], 'metier', { id: 'pecheur' }, 'inserer', null, { id: 'pecheur', nom: 'Pêcheur', bonus: '+1', remarque: null });
  noter(db, ['lot-b', 3, '2026-10-10T10:00:00Z'], 'metier', { id: 'bousier' }, 'supprimer', { id: 'bousier', nom: 'Bousier', bonus: '+2', remarque: 'Trace.' }, null);
  noter(db, ['lot-b', 4, '2026-10-10T10:00:00Z'], 'race_magie', { race_id: 'orios', magie_id: 'feu' }, 'modifier', { acces: 1 }, { acces: 0 });
  return db;
}

test('lecture : ordre (fait_le, lot_id, rang), clé dans l’ordre de la clé primaire', () => {
  const db = scenario();
  const e = lireHistorique(db);
  assert.deepEqual(e.map((m) => `${m.lot}#${m.rang}`), ['lot-b#1', 'lot-b#2', 'lot-b#3', 'lot-b#4', 'lot-a#1', 'lot-a#2', 'lot-a#3', 'lot-a#4', 'lot-a#5', 'lot-a#6', 'lot-c#1']);
  assert.equal(e[9].texte, '{"race_id":"orios","magie_id":"eau"}');
  assert.deepEqual(cleDeLigne(db, 'race_magie', { acces: 3, magie_id: 'x', race_id: 'y' }), { race_id: 'y', magie_id: 'x' });
  assert.throws(() => cleDeLigne(db, 'race_magie', { race_id: 'y' }), /clé incomplète/);
});

test('creee, supprimee, modifiee, touchee', () => {
  const h = historiqueSite(scenario());
  assert.equal(h.vide, false);
  assert.equal(h.creee('race_magie', { magie_id: 'ombre', race_id: 'orios' }), true);
  assert.equal(h.creee('metier', { id: 'pecheur' }), false, 'créé puis supprimé : rien');
  assert.equal(h.supprimee('metier', { id: 'pecheur' }), false, 'créé puis supprimé : il n’était pas dans l’import');
  assert.equal(h.supprimee('metier', { id: 'bousier' }), true);
  assert.equal(h.supprimee('race_magie', { race_id: 'orios', magie_id: 'eau' }), true);
  assert.equal(h.creee('metier', { id: 'sapeur' }), false, 'supprimé puis recréé : ni créé…');
  assert.equal(h.supprimee('metier', { id: 'sapeur' }), false, '… ni supprimé');
  assert.equal(h.modifiee('metier', { id: 'sapeur' }, 'bonus'), true, '… mais réécrit');
  assert.equal(h.modifiee('metier', { id: 'forgeron' }, 'bonus'), true);
  assert.equal(h.modifiee('metier', { id: 'forgeron' }, 'nom'), false);
  assert.equal(h.modifiee('metier', { id: 'forgeron' }), true);
  assert.equal(h.modifiee('metier', { id: 'bousier' }, 'bonus'), false, 'une ligne supprimée n’est pas « modifiée »');
  assert.equal(h.modifiee('race_magie', { race_id: 'orios', magie_id: 'ombre' }, 'acces'), true, 'toute colonne d’une ligne créée');
  assert.equal(h.touchee('metier', { id: 'bousier' }, 'nom'), true);
  assert.equal(h.touchee('metier', { id: 'forgeron' }, 'nom'), false);
  assert.equal(h.touchee('metier', { id: 'forgeron' }), true);
  assert.equal(h.touchee('metier', { id: 'inconnu' }), false);
  assert.deepEqual(h.tables().sort(), ['metier', 'race_magie']);
  assert.deepEqual(h.lignesTouchees('race_magie'), [{ race_id: 'orios', magie_id: 'feu' }, { race_id: 'orios', magie_id: 'eau' }, { race_id: 'orios', magie_id: 'ombre' }]);
});

test('valeurDImport : avant de la première modification de la colonne, sinon la valeur actuelle ; undefined pour une ligne créée', () => {
  const h = historiqueSite(scenario());
  assert.equal(h.valeurDImport('metier', { id: 'forgeron' }, 'bonus'), '+3', 'deux modifications : la première dit l’import');
  assert.equal(h.valeurDImport('metier', { id: 'forgeron' }, 'remarque'), null);
  assert.equal(h.valeurDImport('metier', { id: 'forgeron' }, 'nom'), 'Forgeron', 'colonne non touchée : la valeur actuelle, lue dans la base');
  assert.equal(h.valeurDImport('metier', { id: 'forgeron' }, 'nom', 'donnée'), 'donnée', 'ou celle que l’appelant donne');
  assert.equal(h.valeurDImport('metier', { id: 'bousier' }, 'remarque'), 'Trace.', 'ligne supprimée : sa ligne entière');
  assert.equal(h.valeurDImport('metier', { id: 'sapeur' }, 'bonus'), '+2', 'supprimée puis recréée : la valeur d’avant la suppression');
  assert.equal(h.valeurDImport('metier', { id: 'pecheur' }, 'nom'), undefined);
  assert.equal(h.valeurDImport('race_magie', { magie_id: 'ombre', race_id: 'orios' }, 'acces'), undefined);
  assert.equal(h.valeurDImport('race_magie', { race_id: 'orios', magie_id: 'feu' }, 'acces'), 1);
  assert.equal(h.valeurDImport('metier', { id: 'inconnu' }, 'nom'), undefined, 'ni historique ni ligne');
  assert.deepEqual(h.ligneDImport('metier', { id: 'forgeron' }), { id: 'forgeron', nom: 'Forgeron', bonus: '+3', remarque: null });
  assert.equal(h.ligneDImport('race_magie', { race_id: 'orios', magie_id: 'ombre' }), null);
});

test('lignesDImport et effectifDImport : l’état d’avant toute édition du site', () => {
  const db = scenario();
  const h = historiqueSite(db);
  assert.deepEqual(h.lignesDImport('metier'), [
    { id: 'forgeron', nom: 'Forgeron', bonus: '+3', remarque: null },
    { id: 'mineur', nom: 'Mineur', bonus: '+1', remarque: null },
    { id: 'sapeur', nom: 'Sapeur', bonus: '+2', remarque: null },
    { id: 'bousier', nom: 'Bousier', bonus: '+2', remarque: 'Trace.' },
  ]);
  assert.equal(h.effectifDImport('metier'), 4);
  assert.deepEqual(h.lignesDImport('race_magie').map((l) => `${l.race_id}/${l.magie_id}=${l.acces}`), ['orios/feu=1', 'orios/eau=1']);
  assert.equal(h.effectifDImport('race_magie'), 2);
  const lignes = db.prepare("SELECT * FROM metier WHERE id <> 'mineur'").all();
  assert.deepEqual(h.lignesDImport('metier', lignes).map((l) => l.id), ['forgeron', 'sapeur', 'bousier'], 'sur les lignes données');
});

test('base sans modification, ou sans la table : l’import est l’état courant', () => {
  const db = base();
  inserer(db, 'metier', { id: 'forgeron', nom: 'Forgeron', bonus: '+3', remarque: null });
  const h = historiqueSite(db);
  assert.equal(h.vide, true);
  assert.equal(h.effectifDImport('metier'), 1);
  assert.equal(h.valeurDImport('metier', { id: 'forgeron' }, 'bonus'), '+3');
  assert.equal(h.creee('metier', { id: 'forgeron' }), false);
  const nue = new DatabaseSync(':memory:');
  nue.exec('CREATE TABLE metier (id TEXT NOT NULL PRIMARY KEY, nom TEXT) STRICT');
  assert.deepEqual(lireHistorique(nue), []);
  assert.equal(historiqueSite(nue).effectifDImport('metier'), 0);
});
