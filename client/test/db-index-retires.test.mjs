// Migration data/migrations/0072-index-jamais-choisis.sql (entretien de la base) : six index qu'aucun plan ne choisissait sur un chemin réel sont
// retirés du schéma. Le premier test épingle la migration : leur absence, et la migration qui les retire tous et seulement eux. Le second est une
// garde, pas un test de la migration (qui ne peut pas le faire échouer) : les lectures par clé du service et des importeurs qui touchent ces tables
// restent des recherches par index (EXPLAIN QUERY PLAN sur une base vierge : la base n'est jamais analysée, ses plans ne dépendent pas des lignes).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

const lire = (chemin) => readFileSync(new URL(`../../${chemin}`, import.meta.url), 'utf8');
const RETIRES = ['alias_texte', 'source_google', 'source_fichier', 'page_entite_id', 'note_cellule_nature', 'ecart_source_nature'];

const db = new DatabaseSync(':memory:');
db.exec(lire('data/schema.sql'));
const index = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((i) => i.name));

test('0072 : les six index retirés sont absents du schéma, la migration les retire tous et seulement eux', () => {
  assert.deepEqual(RETIRES.filter((i) => index.has(i)), []);
  const retires = [...lire('data/migrations/0072-index-jamais-choisis.sql').matchAll(/^DROP INDEX (\w+);$/gm)].map((m) => m[1]);
  assert.deepEqual(retires, RETIRES);
  for (const garde of ['alias_cle', 'page_entite_page', 'page_entite_principale', 'page_source_source', 'ecart_source_entite']) assert.ok(index.has(garde), garde);
});

test('garde : les lectures par clé de alias, source, page_entite et note_cellule restent des recherches par index', () => {
  const requetes = [
    ['serveur/edition.mjs (ancien titre en alias)', 'SELECT 1 FROM alias WHERE page_id = ? AND (texte = ? OR cle = ?)', 3],
    ['serveur/edition.mjs (rang du nouvel alias)', 'SELECT coalesce(max(ordre) + 1, 0) AS n FROM alias WHERE page_id = ?', 1],
    ['tools/db/maverick.py (source déjà connue)', 'SELECT texte FROM source WHERE id = ?', 1],
    ['serveur/edition.mjs (entités d’une page)', 'SELECT * FROM page_entite WHERE page_id = ?', 1],
    ['serveur/edition.mjs (page d’une spécialité)', "SELECT * FROM page_entite WHERE entite_table = 'specialite' AND entite_id = ?", 1],
    ['tools/db/pages_md.py (page retirée)', 'DELETE FROM page_entite WHERE page_id = ?', 1],
    ['serveur/edition.mjs (notes d’un don de race)', "SELECT * FROM note_cellule WHERE entite_table = 'race_don' AND entite_id = ? ORDER BY rang", 1],
    ['serveur/edition.mjs (notes d’un don de classe)', "SELECT * FROM note_cellule WHERE entite_table = 'capacite' AND entite_id = ?", 1],
  ];
  for (const [ou, sql, n] of requetes) {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array(n).fill('x')).map((l) => l.detail);
    assert.ok(plan.length > 0 && plan.every((d) => /^SEARCH /.test(d)), `${ou} : ${plan.join(' | ')}`);
  }
});
