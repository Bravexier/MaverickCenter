// GET /api/edition/en-attente/ (R309, T13) : ce que la surcouche des pages a Ã  rÃ©Ã©crire. Les quatre lots d'ancrage laissent 4 403 lignes en attente (3,6 Mo) ; chaque
// page les rejouait une Ã  une (28 Ã  42 s de blocage sur le Glossaire). N'en partent plus : les lignes du vocabulaire (les pages les lisent en direct : GET
// edition/listes/, edition/mots-cles/) et celles de `page`, `sort`, `type_sort` dont toutes les modifications ne font qu'Ã©crire `mot_cle_id`. Base d'essai minimale,
// ids inventÃ©s ; `lignesEnAttente(db)` sans option garde son sens (les autres tests du journal).
//   node --test test/serveur-edition-en-attente-pages.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MARQUE_DE_REPRISE, lignesEnAttente } from '../serveur/edition-journal.mjs';

function base() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE modification_lot (id TEXT PRIMARY KEY, fait_le TEXT, resolu_le TEXT);
    CREATE TABLE modification (lot_id TEXT, rang INTEGER, table_nom TEXT, cle TEXT, operation TEXT, avant TEXT, apres TEXT, etat TEXT, detail TEXT, apercu TEXT, PRIMARY KEY (lot_id, rang));
    CREATE TABLE page (id TEXT PRIMARY KEY, titre TEXT, corps_md TEXT, mot_cle_id INTEGER);
    CREATE TABLE sort (id TEXT PRIMARY KEY, nom TEXT, mot_cle_id INTEGER);
    CREATE TABLE type_sort (id INTEGER PRIMARY KEY, mot_cle_id INTEGER);
    CREATE TABLE mot_cle (id INTEGER PRIMARY KEY, libelle TEXT);
    CREATE TABLE mot_cle_categorie (mot_cle_id INTEGER, categorie_id INTEGER, PRIMARY KEY (mot_cle_id, categorie_id));
    CREATE TABLE mot_cle_synonyme (id INTEGER PRIMARY KEY, mot_cle_id INTEGER, libelle TEXT);
    CREATE TABLE mot_cle_ancienne_cle (cle TEXT PRIMARY KEY, mot_cle_id INTEGER);
    CREATE TABLE categorie_mot_cle (id INTEGER PRIMARY KEY, libelle TEXT);
    INSERT INTO page VALUES ('essai/a', 'A', 'a', 1), ('essai/b', 'B', 'b', 2), ('essai/c', 'C', 'c', 3), ('guide/essai-d', 'D', 'd', 4), ('essai/e', 'E', 'e', 5);
    INSERT INTO sort VALUES ('essai#sort:s1', 'S1', 7), ('essai#sort:s2', 'S2', 8);
    INSERT INTO type_sort VALUES (1, 9), (2, 10);
    INSERT INTO mot_cle VALUES (1, 'M1'), (2, 'M2');
    INSERT INTO mot_cle_categorie VALUES (1, 1);
    INSERT INTO mot_cle_synonyme VALUES (1, 1, 'S');
    INSERT INTO mot_cle_ancienne_cle VALUES ('ancienne', 1);
    INSERT INTO categorie_mot_cle VALUES (1, 'C1');
    INSERT INTO modification_lot VALUES ('L1', '2026-11-01T10:00:00Z', NULL), ('L2', '2026-11-02T10:00:00Z', NULL);
  `);
  let rang = 0;
  const noter = (lot, table, cle, operation, { avant = null, apres = null, etat = 'en_attente', detail = null, apercu = null } = {}) => {
    db.prepare('INSERT INTO modification VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(lot, (rang += 1), table, JSON.stringify(cle), operation, avant && JSON.stringify(avant), apres && JSON.stringify(apres), etat, detail, apercu && JSON.stringify(apercu));
  };
  return { db, noter };
}
const cles = (lignes) => lignes.map((l) => `${l.table}:${JSON.stringify(l.cle)}`).sort();
const pourLesPages = (db) => lignesEnAttente(db, { pourLesPages: true });

test('une ligne dont la seule modification Ã©crit mot_cle_id ne part pas, pour page, sort et type_sort', () => {
  const { db, noter } = base();
  noter('L1', 'page', { id: 'essai/a' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 1 } });
  noter('L1', 'sort', { id: 'essai#sort:s1' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 7 } });
  noter('L1', 'type_sort', { id: 1 }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 9 } });
  assert.deepEqual(pourLesPages(db), []);
  assert.equal(lignesEnAttente(db).length, 3, 'sans lâ€™option, le sens dâ€™avant : les trois lignes sont lÃ ');
  assert.equal(lignesEnAttente(db, { tables: ['page'] }).length, 1);
});

test('la mÃªme ligne avec une autre colonne, dans le mÃªme lot ou un autre, part, avec son aperÃ§u pour une page du guide', () => {
  const { db, noter } = base();
  noter('L1', 'page', { id: 'guide/essai-d' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 4 } });
  noter('L2', 'page', { id: 'guide/essai-d' }, 'modifier', { avant: { corps_md: 'avant' }, apres: { corps_md: 'd' }, apercu: ['<p>d</p>'] });
  noter('L1', 'sort', { id: 'essai#sort:s1' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 7 } });
  noter('L2', 'sort', { id: 'essai#sort:s1' }, 'modifier', { avant: { nom: 'S' }, apres: { nom: 'S1' } });
  noter('L1', 'type_sort', { id: 1 }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 9 } });
  noter('L2', 'type_sort', { id: 1 }, 'modifier', { apres: { mot_cle_id: 9, autre: 1 } });
  const lignes = pourLesPages(db);
  assert.deepEqual(cles(lignes), ['page:{"id":"guide/essai-d"}', 'sort:{"id":"essai#sort:s1"}', 'type_sort:{"id":1}']);
  const page = lignes.find((l) => l.table === 'page');
  assert.deepEqual(page.apercu, ['<p>d</p>']);
  assert.equal(page.ligne.corps_md, 'd');
  assert.equal(page.creee, false);
});

test('une page crÃ©Ã©e puis ancrÃ©e part ; une page supprimÃ©e part avec ligne: null ; un conflit Ã  reprendre part', () => {
  const { db, noter } = base();
  noter('L1', 'page', { id: 'essai/a' }, 'inserer', { apres: { id: 'essai/a', titre: 'A' } });
  noter('L2', 'page', { id: 'essai/a' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 1 } });
  db.prepare("DELETE FROM page WHERE id = 'essai/b'").run();
  noter('L1', 'page', { id: 'essai/b' }, 'supprimer', { avant: { id: 'essai/b' } });
  noter('L2', 'page', { id: 'essai/c' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 3 }, etat: 'conflit', detail: `la valeur a changÃ©${MARQUE_DE_REPRISE}{"issue":"garde"}}` });
  // un conflit sans reprise (lot annulÃ©) n'est pas Ã  rejouer
  noter('L2', 'page', { id: 'essai/e' }, 'modifier', { avant: { mot_cle_id: null }, apres: { mot_cle_id: 5 }, etat: 'conflit', detail: 'conflit simple' });
  const lignes = pourLesPages(db);
  assert.deepEqual(cles(lignes), ['page:{"id":"essai/a"}', 'page:{"id":"essai/b"}', 'page:{"id":"essai/c"}']);
  assert.equal(lignes.find((l) => l.cle.id === 'essai/a').creee, true);
  assert.equal(lignes.find((l) => l.cle.id === 'essai/b').ligne, null);
  assert.equal(lignes.find((l) => l.cle.id === 'essai/c').ligne.mot_cle_id, 3);
});

test('aucune ligne des cinq tables du vocabulaire ne part, crÃ©Ã©e, modifiÃ©e ou supprimÃ©e', () => {
  const { db, noter } = base();
  noter('L1', 'mot_cle', { id: 1 }, 'modifier', { avant: { libelle: 'x' }, apres: { libelle: 'M1' } });
  noter('L1', 'mot_cle', { id: 3 }, 'inserer', { apres: { id: 3, libelle: 'M3' } });
  noter('L1', 'mot_cle_categorie', { mot_cle_id: 1, categorie_id: 1 }, 'inserer', { apres: { mot_cle_id: 1, categorie_id: 1 } });
  noter('L1', 'mot_cle_synonyme', { id: 1 }, 'inserer', { apres: { id: 1, mot_cle_id: 1, libelle: 'S' } });
  noter('L1', 'mot_cle_ancienne_cle', { cle: 'ancienne' }, 'inserer', { apres: { cle: 'ancienne', mot_cle_id: 1 } });
  noter('L1', 'categorie_mot_cle', { id: 1 }, 'inserer', { apres: { id: 1, libelle: 'C1' } });
  noter('L2', 'mot_cle', { id: 2 }, 'supprimer', { avant: { id: 2 } });
  noter('L2', 'page', { id: 'essai/e' }, 'modifier', { avant: { titre: 'x' }, apres: { titre: 'E' } });
  assert.equal(lignesEnAttente(db).length, 8);
  assert.deepEqual(cles(pourLesPages(db)), ['page:{"id":"essai/e"}']);
});
