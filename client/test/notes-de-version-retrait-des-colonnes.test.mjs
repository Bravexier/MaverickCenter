// La note de version et le retrait des colonnes du mot-clé (chantier 4, migration 0136, docs/chantier-retrait-des-colonnes.md §4) : la production reste à
// la structure 134 ou 135 (nom, adresse, définition, couleur et icône dans les colonnes du mot-clé), le site de dev passe à la 136 (sur l'élément : page,
// sort, repère). Une valeur seulement déplacée ne fait aucune ligne ; une valeur vraiment changée sur la page ou le repère se dit comme un changement du
// mot-clé, jamais par une ligne de page ou de repère. Bases SQLite synthétiques (noms inventés), la vraie migration appliquée à la copie « dev ».
//   node --test test/notes-de-version-retrait-des-colonnes.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { lireTables } from '../serveur/notes-de-version.mjs';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { installerLePlan } from '../src/lib/livres.mjs';
import { comparerBases, estUneTableAutre, TABLES_LUES } from '../src/lib/notes-de-version.mjs';

installerLePlan([{ id: 'onglet-essai', titre: 'Onglet d’essai', ouverture: 'guide/regle-essai', entrees: [{ page: 'guide/regle-essai' }] }]);

const migration = (nom) => readFileSync(new URL(`../../data/migrations/${nom}`, import.meta.url), 'utf8');
const PAGE = 'guide/regle-essai';
const SORT = 'magies/essai#sort:boule';

/**
 * Une base à l'ancienne structure : un mot-clé de page (définition, couleur, icône), un mot-clé de sort, un mot-clé sans élément ; `repere` : la
 * structure 135 (table des repères, le repère du mot-clé sans élément déjà posé par le lot « repères ») plutôt que la 134.
 */
function baseAncienne({ repere }) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE monnaie (id TEXT PRIMARY KEY);
    CREATE TABLE mot_cle (id INTEGER PRIMARY KEY, libelle TEXT NOT NULL, cle TEXT NOT NULL UNIQUE, description TEXT, url TEXT, couleur TEXT, icone TEXT,
      verrou INTEGER NOT NULL DEFAULT 0, monnaie_id TEXT);
    CREATE TABLE page (id TEXT PRIMARY KEY, type TEXT, statut TEXT, titre TEXT, corps_md TEXT, resume TEXT, mot_cle_id INTEGER);
    CREATE TABLE sort (id TEXT PRIMARY KEY, magie_id TEXT, nom TEXT, mot_cle_id INTEGER);
    CREATE TABLE page_tag (page_id TEXT, tag_id INTEGER);
    CREATE VIEW v_mot_cle AS SELECT id FROM mot_cle;
  `);
  const mot = db.prepare('INSERT INTO mot_cle (id, libelle, cle, description, url, couleur, icone) VALUES (?, ?, ?, ?, ?, ?, ?)');
  mot.run(1, 'Règle d’essai', 'regle-d-essai', 'Une définition.', adresseDeLaPage(PAGE, null), '#aa0000', 'lucide:sword');
  mot.run(2, 'Boule d’essai', 'boule-d-essai', null, adresseDuSort(SORT, null), null, null);
  mot.run(3, 'Rubrique d’essai', 'rubrique-d-essai', 'Une rubrique.', '/regles/', 'magie:feu', 'lucide:book');
  db.prepare('INSERT INTO page (id, type, statut, titre, corps_md, mot_cle_id) VALUES (?, ?, ?, ?, ?, ?)').run(PAGE, 'guide', 'canon', 'Règle d’essai', 'Texte.', 1);
  db.prepare('INSERT INTO sort (id, magie_id, nom, mot_cle_id) VALUES (?, ?, ?, ?)').run(SORT, 'magies/essai', 'Boule d’essai', 2);
  if (repere) {
    db.exec(migration('0135-reperes.sql'));
    db.exec("INSERT INTO repere (mot_cle_id, nom, adresse, definition, couleur) VALUES (3, 'Rubrique d’essai', '/regles/', 'Une rubrique.', 'magie:feu')");
  }
  return db;
}

/** La même base passée à la structure 136 (la vraie migration, clés étrangères suspendues comme le fait qui l'applique). */
function baseNouvelle({ repere }) {
  const db = baseAncienne({ repere });
  db.exec('PRAGMA foreign_keys = OFF');
  if (!repere) db.exec(migration('0135-reperes.sql'));
  db.exec(migration('0136-retrait-des-colonnes-du-mot-cle.sql'));
  return db;
}

const lire = (db) => lireTables(db, TABLES_LUES, { autres: true });
const lignesDe = (ref, dev) => comparerBases(lire(ref), lire(dev));

for (const repere of [false, true]) {
  const structure = repere ? 135 : 134;
  test(`retrait des colonnes : production à la structure ${structure}, dev à la 136, mêmes valeurs → aucune ligne`, () => {
    const dev = baseNouvelle({ repere });
    assert.equal(dev.prepare('PRAGMA table_info(mot_cle)').all().some((c) => c.name === 'libelle'), false, 'la base de dev a perdu les colonnes');
    const lus = lire(dev).tables.mot_cle;
    assert.deepEqual(lus.map((m) => [m.id, m.libelle, m.url, m.description, m.couleur, m.icone]),
      lire(baseAncienne({ repere })).tables.mot_cle.map((m) => [m.id, m.libelle, m.url, m.description, m.couleur, m.icone]), 'les cinq champs, lus sur l’élément');
    assert.deepEqual(lignesDe(baseAncienne({ repere }), dev), []);
  });
}

test('retrait des colonnes : définition, couleur, icône et nom vraiment changés sur la page ou le repère se disent comme un changement du mot-clé', () => {
  const dev = baseNouvelle({ repere: true });
  dev.prepare('UPDATE page SET definition = ?, couleur = ?, icone = ? WHERE id = ?').run('Une autre définition.', '#00aa00', 'lucide:shield', PAGE);
  dev.prepare('UPDATE repere SET nom = ?, definition = NULL, couleur = ?, icone = NULL WHERE mot_cle_id = 3').run('Rubrique renommée', 'magie:eau');
  const lignes = lignesDe(baseAncienne({ repere: true }), dev);
  assert.ok(lignes.every((l) => l.table_nom === 'mot_cle' && l.domaine === 'mots-cles'), 'ni ligne de page, ni ligne de repère');
  const vues = lignes.map((l) => [l.cle.id, l.colonne, l.nature, l.avant, l.apres]).sort((p, q) => p[0] - q[0] || p[1].localeCompare(q[1]));
  assert.deepEqual(vues, [
    [1, 'couleur', 'modifie', '#aa0000', '#00aa00'],
    [1, 'description', 'modifie', 'Une définition.', 'Une autre définition.'],
    [1, 'icone', 'modifie', 'lucide:sword', 'lucide:shield'],
    [3, 'couleur', 'modifie', 'magie:feu', 'magie:eau'],
    [3, 'description', 'retire', 'Une rubrique.', null],
    [3, 'icone', 'retire', 'lucide:book', null],
    [3, 'libelle', 'modifie', 'Rubrique d’essai', 'Rubrique renommée'],
  ]);
});

test('retrait des colonnes : le nom d’un mot-clé de page renommé avec elle est dit par la ligne de la page (dejaDit), comme avant', () => {
  const dev = baseNouvelle({ repere: true });
  dev.prepare('UPDATE page SET titre = ? WHERE id = ?').run('Règle renommée', PAGE);
  const lignes = lignesDe(baseAncienne({ repere: true }), dev);
  assert.deepEqual(lignes.map((l) => [l.table_nom, l.colonne, l.avant, l.apres]), [['page', 'titre', 'Règle d’essai', 'Règle renommée']]);
});

test('retrait des colonnes : la table des repères est lue avec les tables décrites, jamais avec les « autres tables »', () => {
  assert.ok(TABLES_LUES.includes('repere'));
  assert.equal(estUneTableAutre('repere'), false);
  const lu = lire(baseNouvelle({ repere: false }));
  assert.equal(lu.autres.repere, undefined);
  assert.deepEqual(lu.tables.repere.map((r) => r.mot_cle_id), [3], 'un repère pour le seul mot-clé sans page ni sort');
});
