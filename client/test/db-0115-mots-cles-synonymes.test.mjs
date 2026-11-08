// Migration data/migrations/0115-mots-cles-synonymes.sql (décision R233, lot « mots-clés : ID entier, clé, catégories, synonymes ») : la table
// mot_cle_synonyme (écriture telle qu'enregistrée, écriture normalisée unique, ordre, cascade) ; les abréviations de mot_cle.abreviation, colonne
// retirée, deviennent le premier synonyme de leur mot-clé (R233 (7)) ; « Action bonus » et « Action rapide » sont fondus dans « Instant Cast », dont
// ils deviennent les synonymes, et leurs clés mènent à lui (R233 (5)) ; monnaie.abreviation ne change pas.
// Le site de dev est la source de ce qu'il modifie (synonymes d'un mot-clé non verrouillé, libellés) : le registre
// 0115-mots-cles-synonymes.json se compare à l'état d'import (lib/historique-site.mjs#lignesDImport) ; l'état courant ne porte que les invariants de
// R233 (4) que le SQL ne lit pas (normalize). Les contraintes se vérifient sur une base neuve en mémoire (data/schema.sql), jamais sur la base.
//   node --test test/db-0115-mots-cles-synonymes.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { TABLES_HORS_REGLES } from '../src/lib/tables-de-la-base.mjs';

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const REGISTRE = JSON.parse(readFileSync(new URL('../../data/migrations/0115-mots-cles-synonymes.json', import.meta.url), 'utf8'));
const db = ouvrirBase({ sansExemples: false });

/** normalize() de tools/db/maverick.py (la référence de la base) sur une liste d'écritures. */
function normaliser(ecritures) {
  const p = spawnSync('python3', ['-I', '-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
print(json.dumps([T.normalize(e) for e in json.loads(sys.stdin.read())]))`], { encoding: 'utf8', input: JSON.stringify(ecritures) });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

const colonnes = (base, table) => base.prepare(`PRAGMA table_info("${table}")`).all();

test('structure : mot_cle sans abreviation, v_mot_cle non plus ; monnaie.abreviation inchangée (R233 (7))', () => {
  assert.ok(!colonnes(db, 'mot_cle').some((c) => c.name === 'abreviation'));
  assert.ok(!colonnes(db, 'v_mot_cle').some((c) => c.name === 'abreviation'));
  const monnaie = colonnes(db, 'monnaie').find((c) => c.name === 'abreviation');
  assert.deepEqual([monnaie?.type, monnaie?.notnull], ['TEXT', 1]);
});

test('structure : mot_cle_synonyme (id entier, mot-clé en cascade, écriture, écriture normalisée unique, ordre) et son index', () => {
  assert.deepEqual(colonnes(db, 'mot_cle_synonyme').map((c) => [c.name, c.type, c.notnull, c.pk]), [
    ['id', 'INTEGER', 1, 1], ['mot_cle_id', 'INTEGER', 1, 0], ['libelle', 'TEXT', 1, 0], ['libelle_cle', 'TEXT', 1, 0], ['ordre', 'INTEGER', 1, 0],
  ]);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_list(mot_cle_synonyme)').all().map((f) => [f.from, f.table, f.to, f.on_delete]),
    [['mot_cle_id', 'mot_cle', 'id', 'CASCADE']]);
  const uniques = db.prepare("SELECT name FROM pragma_index_list('mot_cle_synonyme') WHERE \"unique\" = 1").all()
    .map((i) => db.prepare('SELECT name FROM pragma_index_info(?)').all(i.name).map((x) => x.name).join(','));
  assert.deepEqual(uniques, ['libelle_cle']);
  assert.deepEqual(db.prepare('SELECT name FROM pragma_index_info(?)').all('mot_cle_synonyme_mot_cle').map((x) => x.name), ['mot_cle_id', 'ordre']);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check(mot_cle_synonyme)').all(), []);
});

test('contraintes (base neuve) : écriture normalisée unique sur toute la table, écritures vides ou mal formées refusées, cascade du mot-clé', () => {
  const essai = new DatabaseSync(':memory:');
  essai.exec(SCHEMA);
  essai.exec('PRAGMA foreign_keys = ON');
  essai.exec("INSERT INTO mot_cle (id, libelle, cle) VALUES (1, 'Essai un', 'essai-un'), (2, 'Essai deux', 'essai-deux')");
  const ajouter = essai.prepare('INSERT INTO mot_cle_synonyme (id, mot_cle_id, libelle, libelle_cle, ordre) VALUES (?, ?, ?, ?, ?)');
  ajouter.run(1, 1, 'ZQ', 'zq', 0);
  ajouter.run(2, 1, 'Zq bis', 'zq-bis', 0); // même ordre : admis (pas d'UNIQUE, l'id départage)
  assert.throws(() => ajouter.run(3, 2, 'zq', 'zq', 0), /UNIQUE/, 'la même écriture normalisée sur un autre mot-clé');
  assert.throws(() => ajouter.run(4, 1, 'Zq', 'zq', 1), /UNIQUE/, 'la même écriture normalisée sur le même mot-clé');
  assert.throws(() => ajouter.run(5, 2, '', 'vide', 0), /CHECK/, 'écriture vide');
  assert.throws(() => ajouter.run(6, 2, 'Zq ter', 'Zq ter', 0), /CHECK/, 'écriture normalisée mal formée');
  assert.throws(() => ajouter.run(7, 2, 'Zq', 'zq-quater', -1), /CHECK/, 'ordre négatif');
  assert.throws(() => ajouter.run(8, 9, 'Zq', 'zq-quinquies', 0), /FOREIGN KEY/, 'mot-clé absent');
  essai.exec('DELETE FROM mot_cle WHERE id = 1');
  assert.equal(essai.prepare('SELECT count(*) AS n FROM mot_cle_synonyme').get().n, 0, 'supprimer le mot-clé retire ses synonymes');
  essai.close();
});

test('registre : les abréviations, ordre 0, puis les libellés des deux mots-clés fondus, après ceux de la cible ; écriture normalisée = normalize', { skip: sansPython }, () => {
  const s = REGISTRE.synonymes;
  assert.deepEqual(s.map((e) => e.id), s.map((_, i) => i + 1));
  const abreviations = s.filter((e) => e.origine === 'abreviation');
  const fusions = s.filter((e) => e.origine === 'fusion');
  assert.equal(abreviations.length + fusions.length, s.length);
  assert.equal(abreviations.length, 20);
  assert.ok(abreviations.every((e) => e.ordre === 0));
  assert.equal(new Set(abreviations.map((e) => e.motCleId)).size, abreviations.length, 'une abréviation par mot-clé');
  assert.deepEqual(s.map((e) => e.libelleCle), normaliser(s.map((e) => e.libelle)));
  assert.equal(REGISTRE.fusions.length, 2);
  for (const f of REGISTRE.fusions) {
    const e = fusions.find((x) => x.ancienMotCleId === f.id);
    assert.equal(e.libelle, f.libelle, `${f.cle} : son libellé devient un synonyme`);
    assert.equal(e.motCleId, f.cible.id);
    const avant = s.filter((x) => x.motCleId === f.cible.id && x.origine === 'abreviation');
    assert.ok(avant.every((x) => x.ordre < e.ordre), `${f.cle} : après les synonymes de la cible`);
    assert.deepEqual([f.pageTag, f.sortMotCle, f.categories], [[], [], []], `${f.cle} : rien à reporter à la version 114`);
    // ses balises : celles du registre `textes`, reciblées vers la cible
    const reciblees = REGISTRE.textes.filter((t) => t.avant.startsWith(`{{${f.cle}`));
    assert.equal(f.balises, reciblees.reduce((n, t) => n + t.compte, 0), `${f.cle} : balises`);
    for (const t of reciblees) assert.ok(t.apres.startsWith(`{{${f.cible.cle}`), `${f.cle} : vers la cible`);
  }
});

test('import : les synonymes sont ceux du registre ; les monnaies ont leur abréviation pour synonyme ; les mots-clés fondus n’existent plus', () => {
  const h = historiqueSite(db);
  const synonymes = h.lignesDImport('mot_cle_synonyme').sort((a, b) => a.id - b.id);
  assert.deepEqual(synonymes.map((x) => [x.id, x.mot_cle_id, x.libelle, x.libelle_cle, x.ordre]),
    REGISTRE.synonymes.map((e) => [e.id, e.motCleId, e.libelle, e.libelleCle, e.ordre]));
  const motsCles = h.lignesDImport('mot_cle');
  for (const m of h.lignesDImport('monnaie')) {
    const motCle = motsCles.find((x) => x.monnaie_id === m.id);
    assert.ok(motCle, `${m.id} : son mot-clé`);
    assert.ok(synonymes.some((x) => x.mot_cle_id === motCle.id && x.libelle.toLowerCase() === m.abreviation.toLowerCase()), `${m.id} : abréviation en synonyme`);
  }
  const ids = new Set(motsCles.map((m) => m.id));
  for (const f of REGISTRE.fusions) {
    assert.ok(!ids.has(f.id), `${f.cle} : fondu`);
    assert.ok(ids.has(f.cible.id), `${f.cle} : la cible`);
  }
});

test('état courant : la clé d’un mot-clé fondu mène à sa cible (mot_cle_ancienne_cle), sauf si elle est devenue la clé d’un mot-clé', () => {
  const courantes = new Set(db.prepare('SELECT cle FROM mot_cle').all().map((m) => m.cle));
  const presents = new Set(db.prepare('SELECT id FROM mot_cle').all().map((m) => m.id));
  const quittees = new Map(db.prepare('SELECT cle, mot_cle_id FROM mot_cle_ancienne_cle').all().map((a) => [a.cle, a.mot_cle_id]));
  for (const f of REGISTRE.fusions) {
    if (!presents.has(f.cible.id) || courantes.has(f.cle)) continue; // cible supprimée depuis (cascade), ou clé reprise : la clé courante d'abord
    assert.equal(quittees.get(f.cle), f.cible.id, f.cle);
  }
});

test('état courant (R233 (4)) : l’écriture normalisée est normalize(libelle), et n’égale ni le libellé ni la clé d’un autre mot-clé, ni son propre libellé', { skip: sansPython }, () => {
  const synonymes = db.prepare('SELECT id, mot_cle_id, libelle, libelle_cle FROM mot_cle_synonyme ORDER BY id').all();
  assert.deepEqual(synonymes.map((s) => s.libelle_cle), normaliser(synonymes.map((s) => s.libelle)));
  const motsCles = db.prepare('SELECT id, libelle, cle FROM mot_cle').all();
  const libelles = normaliser(motsCles.map((m) => m.libelle));
  const fautes = [];
  for (const s of synonymes) {
    motsCles.forEach((m, i) => {
      if (m.id !== s.mot_cle_id && (m.cle === s.libelle_cle || libelles[i] === s.libelle_cle)) fautes.push(`${s.libelle} : mot-clé ${m.id}`);
      if (m.id === s.mot_cle_id && libelles[i] === s.libelle_cle) fautes.push(`${s.libelle} : son propre libellé`);
    });
  }
  assert.deepEqual(fautes, []);
});

test('traces et textes : aucune trace de mot_cle ne porte abreviation ; aucune balise des règles ne cite un mot-clé fondu, hors sections 13 à 15', () => {
  for (const t of db.prepare("SELECT avant, apres FROM historique_modification WHERE table_nom = 'mot_cle'").all()) {
    for (const o of [JSON.parse(t.avant ?? 'null'), JSON.parse(t.apres ?? 'null')].filter(Boolean)) assert.ok(!('abreviation' in o));
  }
  const courantes = new Set(db.prepare('SELECT cle FROM mot_cle').all().map((m) => m.cle));
  const fondues = new Set(REGISTRE.fusions.map((f) => f.cle).filter((c) => !courantes.has(c)));
  const balise = /\{\{([^{}|\n]+?)(?:\\?\|[^{}\n]*?)?\}\}/g;
  const hors = new Set(TABLES_HORS_REGLES);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all()
    .map((t) => t.name).filter((t) => !hors.has(t) && !/_fts(_|$)/.test(t));
  const fautes = [];
  for (const table of tables) {
    for (const { name } of colonnes(db, table).filter((c) => c.type === 'TEXT')) {
      for (const { v } of db.prepare(`SELECT "${name}" AS v FROM "${table}" WHERE instr("${name}", '{{') > 0`).all()) {
        for (const [, ref] of v.matchAll(balise)) if (fondues.has(ref.replace(/:$/, '').trim())) fautes.push(`${table}.${name} : ${ref}`);
      }
    }
  }
  assert.deepEqual(fautes, []);
});
