// Migration data/migrations/0133-adresses-des-pages.sql (décision R316, « l'adresse d'une page suit son titre ») : la colonne page.slug_adresse et la table
// page_ancienne_adresse. Migration de structure seule : aucune ligne n'est écrite, aucune adresse n'est posée ici (les adresses viennent du service au
// renommage). Le test lit la structure sur une base neuve du schéma (clés étrangères coupées sauf là où on les éprouve), sans figer aucune valeur modifiable (data/rows n’est lu que pour son numéro de version).
//   node --test test/db-0133-adresses-des-pages.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');

/** Une base neuve du schéma ; les noms posés ci-dessous sont inventés. */
function baseNeuve({ clesEtrangeres = false } = {}) {
  const essai = new DatabaseSync(':memory:', { enableForeignKeyConstraints: clesEtrangeres });
  essai.exec(SCHEMA);
  return essai;
}

/** Insère une page minimale (id = type/slug) ; `slugAdresse` n'est posé que s'il est donné. */
function poserUnePage(essai, slug, slugAdresse) {
  const colonnes = slugAdresse === undefined ? '' : ', slug_adresse';
  const valeur = slugAdresse === undefined ? '' : ', ?';
  const params = slugAdresse === undefined ? [] : [slugAdresse];
  return essai.prepare(`INSERT INTO page (id, type, slug, titre, titre_cle, corps_md, statut, origine${colonnes})
    VALUES ('guide/' || ?, 'guide', ?, 'Essai', 'essai', '', 'draft', 'docs'${valeur})`).run(slug, slug, ...params);
}

test('0133 (R316) : page.slug_adresse existe, NULL par défaut, en dernier, au même CHECK de forme que page.slug', () => {
  const essai = baseNeuve();
  const colonnes = essai.prepare("SELECT name, \"notnull\" n, dflt_value d FROM pragma_table_info('page') ORDER BY cid").all();
  const noms = colonnes.map((c) => c.name);
  assert.ok(noms.includes('slug_adresse') && noms.indexOf('slug_adresse') > noms.indexOf('mot_cle_id'), 'ajoutée par la 0133, après la colonne de la 0131 (règle des migrations : en dernier)');
  const colonne = colonnes[noms.indexOf('slug_adresse')];
  assert.equal(colonne.n, 0, 'NULL permis');
  assert.equal(colonne.d, null, 'aucune valeur par défaut : NULL = l\'adresse se tire de l\'identifiant');

  poserUnePage(essai, 'sans-segment');
  assert.equal(essai.prepare("SELECT slug_adresse s FROM page WHERE id = 'guide/sans-segment'").get().s, null);
  poserUnePage(essai, 'avec-segment', 'autre-segment');
  assert.equal(essai.prepare("SELECT slug_adresse s FROM page WHERE id = 'guide/avec-segment'").get().s, 'autre-segment');

  // la même forme que page.slug : minuscules ASCII et tirets, ni vide, ni tiret en bord, ni double tiret
  for (const mal of ['A b', 'Aa', 'a_b', 'é', '', '-a', 'a-', 'a--b']) {
    assert.throws(() => poserUnePage(essai, `refus-${mal.length}`, mal), /CHECK/, `refusé : « ${mal} »`);
  }
  // elle ne change pas l'identifiant : le CHECK id = type || '/' || slug porte toujours sur slug
  assert.throws(() => essai.prepare("UPDATE page SET slug = 'x' WHERE id = 'guide/avec-segment'").run(), /CHECK/);
  essai.close();
});

test('0133 (R316) : page_ancienne_adresse, vide, clé primaire adresse, clé étrangère en cascade vers page, index sur page_id', () => {
  // une base neuve du schéma : la table existe et le schéma ne lui pose aucune ligne, ni aucune adresse à page (le contenu du dépôt, lui, change avec les renommages)
  const neuve = baseNeuve();
  assert.equal(neuve.prepare("SELECT count(*) n FROM sqlite_master WHERE type = 'table' AND name = 'page_ancienne_adresse'").get().n, 1);
  assert.equal(neuve.prepare('SELECT count(*) n FROM page_ancienne_adresse').get().n, 0, 'aucune ancienne adresse écrite par le schéma');
  assert.equal(neuve.prepare('SELECT count(*) n FROM page WHERE slug_adresse IS NOT NULL').get().n, 0, 'aucune adresse posée par le schéma');
  neuve.close();

  const essai = baseNeuve({ clesEtrangeres: true });
  // une base neuve n'a ni famille ni rubrique : les clés étrangères de page en ont besoin
  essai.exec(`INSERT INTO famille (id, libelle, ordre) VALUES ('docs', 'Essai', 1);
    INSERT INTO type_page (id, libelle, singulier, salon_discord, description, ordre) VALUES ('guide', 'Essai', 'Essai', 'essai', 'essai', 1)`);
  const colonnes = essai.prepare("SELECT name, type, \"notnull\" n, pk FROM pragma_table_info('page_ancienne_adresse') ORDER BY cid").all();
  assert.deepEqual(colonnes.map((c) => c.name), ['adresse', 'page_id']);
  assert.ok(colonnes.every((c) => c.type === 'TEXT' && c.n === 1), 'deux colonnes TEXT NOT NULL');
  assert.deepEqual(colonnes.map((c) => c.pk), [1, 0], 'adresse est la clé primaire');
  const table = essai.prepare("SELECT sql FROM sqlite_master WHERE name = 'page_ancienne_adresse'").get().sql;
  assert.match(table, /STRICT/);
  assert.match(table, /WITHOUT ROWID/);

  const cle = essai.prepare("PRAGMA foreign_key_list('page_ancienne_adresse')").all();
  assert.equal(cle.length, 1);
  assert.equal(cle[0].from, 'page_id');
  assert.equal(cle[0].table, 'page');
  assert.equal(cle[0].to, 'id');
  assert.equal(cle[0].on_delete, 'CASCADE');

  const index = essai.prepare("SELECT name, \"unique\" u FROM pragma_index_list('page_ancienne_adresse') WHERE origin = 'c'").all();
  assert.deepEqual(index.map((i) => i.name), ['page_ancienne_adresse_page']);
  assert.deepEqual(essai.prepare("SELECT name FROM pragma_index_info('page_ancienne_adresse_page')").all().map((c) => c.name), ['page_id']);

  // comportement : l'adresse est unique, la clé étrangère est tenue, la cascade suit la page
  poserUnePage(essai, 'cible');
  poserUnePage(essai, 'autre');
  const poser = essai.prepare('INSERT INTO page_ancienne_adresse (adresse, page_id) VALUES (?, ?)');
  poser.run('guide/ancien/', 'guide/cible');
  assert.throws(() => poser.run('guide/ancien/', 'guide/autre'), /UNIQUE|PRIMARY/, 'une adresse mène à une seule page');
  assert.throws(() => poser.run('guide/inconnue/', 'guide/absente'), /FOREIGN KEY/, 'la page existe');
  poser.run('metiers/#metier-forgeron', 'guide/cible');
  essai.prepare("DELETE FROM page WHERE id = 'guide/cible'").run();
  assert.equal(essai.prepare('SELECT count(*) n FROM page_ancienne_adresse').get().n, 0, 'supprimée avec sa page');
  essai.close();
});

test('0133 (R316) : le CHECK d\'adresse refuse le vide, la barre initiale et le chemin qui ne finit pas par « / » sans ancre', () => {
  const essai = baseNeuve();
  poserUnePage(essai, 'cible');
  const poser = essai.prepare("INSERT INTO page_ancienne_adresse (adresse, page_id) VALUES (?, 'guide/cible')");
  for (const bien of ['capacites/anansi-anti-corps/', 'metiers/#metier-forgeron', 'a/b/#ancre']) {
    assert.equal(poser.run(bien).changes, 1, `accepté : « ${bien} »`);
  }
  for (const mal of ['', '/x/', 'x', 'regles/x', '/metiers/#metier-forgeron']) {
    assert.throws(() => poser.run(mal), /CHECK/, `refusé : « ${mal} »`);
  }
  essai.close();
});

test('0133 (R316) : user_version vaut 133, et la migration est de structure seule (aucune ligne écrite)', () => {
  const essai = baseNeuve();
  assert.ok(essai.prepare('PRAGMA user_version').get().user_version >= 133, 'le schéma porte au moins la 0133');
  essai.close();
  const version = Number(readFileSync(new URL('../../data/rows/VERSION', import.meta.url), 'utf8').match(/schema_version=(\d+)/)[1]);
  assert.ok(version >= 133, 'data/rows/VERSION suit le schéma');

  // R316 : la migration ne porte que du DDL, aucun INSERT, UPDATE ni DELETE (les adresses viennent du service, jamais d'une migration)
  const migration = readFileSync(new URL('../../data/migrations/0133-adresses-des-pages.sql', import.meta.url), 'utf8');
  const sansCommentaires = migration.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sansCommentaires, /(^|;)\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i, 'aucune instruction d\'écriture (« ON DELETE CASCADE » n\'en est pas une)');
  assert.match(sansCommentaires, /ALTER TABLE page ADD COLUMN slug_adresse/);
  assert.match(sansCommentaires, /CREATE TABLE page_ancienne_adresse/);
});
