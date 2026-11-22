// Migration data/migrations/0131-ancrage-mots-cles.sql (décision R309, « les mots-clés au centre ») : la colonne mot_cle_id de page et de sort et la table
// type_sort (un type de sort = une ligne = un mot-clé). Migration de structure seule : aucun mot-clé n'est posé ici, les lignes viennent plus tard par des lots
// de changements. Le test lit donc la structure sur une base neuve du schéma (clés étrangères coupées : seuls les CHECK, les clés primaires et les index
// UNIQUE sont éprouvés), sans figer aucune valeur modifiable.
//   node --test test/db-0131-ancrage-mots-cles.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');

/** Une base neuve du schéma, sans clés étrangères : les noms posés ci-dessous sont inventés, aucun mot-clé n'a besoin d'exister. */
function baseNeuve() {
  const essai = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  essai.exec(SCHEMA);
  return essai;
}

test('0131 (R309) : page et sort citent mot_cle, sans cascade, NULL permis', () => {
  const essai = baseNeuve();
  for (const t of ['page', 'sort', 'type_sort']) {
    const fk = essai.prepare(`PRAGMA foreign_key_list(${t})`).all().find((f) => f.from === 'mot_cle_id');
    assert.equal(fk.table, 'mot_cle', t);
    assert.equal(fk.to, 'id', t);
    assert.equal(fk.on_delete, 'NO ACTION', `${t} : un mot-clé ancré ne se supprime pas en cascade`);
    assert.equal(essai.prepare(`SELECT "notnull" n FROM pragma_table_info('${t}') WHERE name = 'mot_cle_id'`).get().n, 0, `${t} : NULL permis`);
  }
  // une colonne ajoutée va en dernier (règle des migrations) : la colonne d'ancrage ferme page et sort
  for (const t of ['page', 'sort']) {
    const colonnes = essai.prepare(`SELECT name FROM pragma_table_info('${t}') ORDER BY cid`).all().map((c) => c.name);
    assert.equal(colonnes.at(-1), 'mot_cle_id', t);
  }
  essai.close();
});

test('0131 (R309) : type_sort porte exactement les codes du CHECK de sort_type, sans mot-clé', () => {
  // la base construite du dépôt (schéma + data/rows) : les dix lignes de la migration y sont, sans mot-clé tant qu'aucun lot n'en a posé
  const db = ouvrirBase({ sansExemples: false });
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'sort_type'").get().sql;
  const codes = [...sql.match(/type\s+TEXT[^,]*CHECK \(type IN \(([^)]*)\)/)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.ok(codes.length > 0, 'le CHECK de sort_type est lu');
  assert.deepEqual(db.prepare('SELECT id FROM type_sort ORDER BY id').all().map((r) => r.id), codes);
  assert.equal(db.prepare('SELECT count(*) n FROM type_sort WHERE mot_cle_id IS NOT NULL').get().n, 0, 'aucun mot-clé posé par la migration');
  // le CHECK de type_sort refuse un code que sort_type refuse aussi
  const neuve = baseNeuve();
  assert.throws(() => neuve.prepare("INSERT INTO type_sort (id) VALUES ('inconnu')").run(), /CHECK/);
  neuve.close();
});

test('0131 (R309) : un mot-clé ancre au plus une page, un sort, un type ; une page ET un type sont permis (R309, Météo)', () => {
  const essai = baseNeuve();
  const page = essai.prepare(`INSERT INTO page (id, type, slug, titre, titre_cle, corps_md, statut, origine, mot_cle_id)
    VALUES (?, 'guide', ?, ?, ?, '', 'draft', 'docs', ?)`);
  const sort = essai.prepare(`INSERT INTO sort (id, magie_id, nom, nom_cle, niveau, ordre, type_brut, ic_direct, imparable, inesquivable, cout_brut, cout_chakra,
    portee_brut, portee_nature, zone_brut, zone_forme, origine, source_ref, mot_cle_id)
    VALUES (?, 'magies/essai', ?, ?, 1, ?, 'Attaque', 0, 0, 0, '3', 3, 'Vue', 'vue', '1', 'unique', 'magies', 'essai', ?)`);
  const typeDeSort = essai.prepare('UPDATE type_sort SET mot_cle_id = ? WHERE id = ?');
  // une base neuve du schéma n'a aucune ligne : les types y sont posés ici, comme le fait la migration
  for (const id of ['attaque', 'soin', 'meteo']) essai.prepare('INSERT INTO type_sort (id) VALUES (?)').run(id);

  // deux pages sur le même mot-clé : refusé ; sur deux mots-clés différents : accepté
  page.run('guide/aube', 'aube', 'Aube', 'aube', 9001);
  assert.throws(() => page.run('guide/aurore', 'aurore', 'Aurore', 'aurore', 9001), /UNIQUE/, 'deux pages, un mot-clé');
  page.run('guide/brume', 'brume', 'Brume', 'brume', 9002);
  // deux pages sans mot-clé : accepté (NULL ne se compare pas)
  page.run('guide/cendre', 'cendre', 'Cendre', 'cendre', null);
  page.run('guide/dune', 'dune', 'Dune', 'dune', null);

  // deux sorts sur le même mot-clé : refusé ; deux sorts sans mot-clé : accepté
  sort.run('magies/essai#sort:a', 'A', 'a', 1, 9003);
  assert.throws(() => sort.run('magies/essai#sort:b', 'B', 'b', 2, 9003), /UNIQUE/, 'deux sorts, un mot-clé');
  sort.run('magies/essai#sort:c', 'C', 'c', 3, null);
  sort.run('magies/essai#sort:d', 'D', 'd', 4, null);

  // deux types sur le même mot-clé : refusé ; deux types sans mot-clé : accepté (les types n'en portent aucun au départ)
  assert.equal(typeDeSort.run(9004, 'attaque').changes, 1);
  assert.throws(() => typeDeSort.run(9004, 'soin'), /UNIQUE/, 'deux types, un mot-clé');

  // R309 : une page ET un type de sort peuvent porter le même mot-clé (le type Météo et sa page) ; un sort et une page de même
  assert.equal(typeDeSort.run(9001, 'meteo').changes, 1, 'le mot-clé 9001 ancre déjà la page guide/aube : le type s\'y ajoute');
  assert.equal(essai.prepare('SELECT count(*) n FROM page WHERE mot_cle_id = 9001').get().n, 1);
  assert.equal(essai.prepare("SELECT count(*) n FROM type_sort WHERE mot_cle_id = 9001").get().n, 1);
  sort.run('magies/essai#sort:e', 'E', 'e', 5, 9002);
  assert.equal(essai.prepare('SELECT count(*) n FROM sort WHERE mot_cle_id = 9002').get().n, 1, 'un sort et la page guide/brume sur le même mot-clé');
  essai.close();
});
