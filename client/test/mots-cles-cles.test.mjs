// La clé des mots-clés (mot_cle.cle, migration 0113 ; décision R232 (2), (9), (10)) : lib/mots-cles-cles.mjs#clesDesMotsCles, la jumelle de
// tools/db/maverick.py#cles_des_mots_cles (la référence), rend les mêmes clés et les mêmes refus ; sur la base, chaque clé est celle de la règle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { clesDesMotsCles, HomonymesRefuses } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;

/** cles_des_mots_cles de maverick.py sur chaque cas : [{ cles } | { refus: [[base, ids, raison]] }]. */
function python(cas) {
  const p = spawnSync('python3', ['-X', 'utf8', '-I', '-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
sortie = []
for c in json.load(sys.stdin):
    try:
        parents = {m['id']: m['parent'] for m in c['motsCles'] if m.get('parent')}
        cles = T.cles_des_mots_cles([(m['id'], m['libelle'], m['categories']) for m in c['motsCles']], {int(k): v for k, v in c['categories'].items()}, strict=c.get('strict', True), parents=parents)
        sortie.append({'cles': {str(k): v for k, v in cles.items()}})
    except T.HomonymesRefuses as e:
        sortie.append({'refus': sorted([[b, sorted(ids), r] for b, ids, r in e.fautes])})
print(json.dumps(sortie))`], { input: JSON.stringify(cas), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

/** La même chose en JavaScript, sous la même forme (les raisons dites comme maverick.py). */
const RAISONS_PY = {
  'sans-categorie': 'homonyme sans catégorie',
  incluses: 'aucune catégorie propre ni parent face à un homonyme (catégories incluses ou égales)',
  'cle-prise': 'clé déjà prise',
};
function javascript(c) {
  try {
    return { cles: Object.fromEntries([...clesDesMotsCles(c.motsCles, new Map(Object.entries(c.categories).map(([k, v]) => [Number(k), v])), { strict: c.strict ?? true })]) };
  } catch (e) {
    if (!(e instanceof HomonymesRefuses)) throw e;
    return { refus: e.fautes.map((f) => [f.base, [...f.ids].sort((a, b) => a - b), RAISONS_PY[f.raison]]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
  }
}

const CATEGORIES = { 1: 'Règles', 2: 'Magie', 3: 'Race', 6: 'Classe', 10: 'Métier' };
const CATEGORIES_R309 = { 10: 'Métier', 16: 'Sort' };
const CAS = [
  // R232 (2) : sans homonyme, le slug du libellé
  { motsCles: [{ id: 1, libelle: 'Recharge longue', categories: [] }, { id: 2, libelle: 'Écho de pierre', categories: [1] }], categories: CATEGORIES },
  // l'exemple du propriétaire : deux « namazu » qui partagent une catégorie, distingués par Race et Classe
  { motsCles: [{ id: 1, libelle: 'Namazu', categories: [1, 3] }, { id: 2, libelle: 'namazu', categories: [1, 6] }], categories: CATEGORIES },
  // trois homonymes : chacun ses catégories non communes à tous, dans l'ordre de leur id
  { motsCles: [{ id: 1, libelle: 'Orios', categories: [3, 1] }, { id: 2, libelle: 'Orios', categories: [6, 2] }, { id: 3, libelle: 'ORIOS', categories: [10, 1] }], categories: CATEGORIES },
  // R232 (9) : un homonyme sans catégorie ; des catégories incluses ; des catégories égales
  { motsCles: [{ id: 1, libelle: 'Feu', categories: [] }, { id: 2, libelle: 'feu', categories: [2] }], categories: CATEGORIES },
  { motsCles: [{ id: 1, libelle: 'Feu', categories: [2] }, { id: 2, libelle: 'feu', categories: [2, 3] }], categories: CATEGORIES },
  { motsCles: [{ id: 1, libelle: 'Feu', categories: [2] }, { id: 2, libelle: 'Feu', categories: [2] }], categories: CATEGORIES },
  // R232 (10) : la clé d'un homonyme égale au slug d'un autre libellé
  { motsCles: [{ id: 1, libelle: 'Namazu', categories: [3] }, { id: 2, libelle: 'Namazu', categories: [6] }, { id: 3, libelle: 'Namazu race', categories: [] }], categories: CATEGORIES },
  // sans `strict` (l'état intermédiaire de la 0113) : un homonyme sans catégorie propre prend le slug seul ; deux clés égales restent refusées
  { motsCles: [{ id: 1, libelle: 'Anansi', categories: [] }, { id: 2, libelle: 'Anansi', categories: [6] }], categories: CATEGORIES, strict: false },
  { motsCles: [{ id: 1, libelle: 'Anansi', categories: [] }, { id: 2, libelle: 'Anansi', categories: [] }], categories: CATEGORIES, strict: false },
  // R309 : deux homonymes de même type (ici deux sorts) se distinguent par leur parent, la magie du sort ; les cas suivants sont ajoutés à la fin (CAS_R309 les lit par index)
  { motsCles: [{ id: 1, libelle: 'Contre-sort', categories: [16], parent: 'Arcane' }, { id: 2, libelle: 'Contre-sort', categories: [16], parent: 'Corruption' }], categories: CATEGORIES_R309 },
  { motsCles: [{ id: 1, libelle: 'Sapeur', categories: [10] }, { id: 2, libelle: 'Sapeur', categories: [16], parent: 'Feu' }], categories: CATEGORIES_R309 },
  { motsCles: [{ id: 1, libelle: 'X', categories: [16], parent: 'Feu' }, { id: 2, libelle: 'X', categories: [16], parent: 'Feu' }], categories: CATEGORIES_R309 },
  { motsCles: [{ id: 1, libelle: 'X', categories: [16] }, { id: 2, libelle: 'X', categories: [16] }], categories: CATEGORIES_R309 },
];
const CAS_R309 = CAS.length - 4;

test('R232 : clesDesMotsCles (JS) rend les clés et les refus de maverick.py#cles_des_mots_cles', { skip: sansPython }, () => {
  const py = python(CAS);
  CAS.forEach((c, i) => assert.deepEqual(javascript(c), py[i], JSON.stringify(c.motsCles)));
});

test('R232 (2) : la forme de la clé — le slug seul, puis les seules catégories non communes à tous les homonymes', () => {
  assert.deepEqual(javascript(CAS[0]).cles, { 1: 'recharge-longue', 2: 'echo-de-pierre' });
  assert.deepEqual(javascript(CAS[1]).cles, { 1: 'namazu-race', 2: 'namazu-classe' }, 'la catégorie commune n’entre pas dans la clé');
  assert.deepEqual(javascript(CAS[2]).cles, { 1: 'orios-regles-race', 2: 'orios-magie-classe', 3: 'orios-regles-metier' }, 'triées par id de catégorie');
  for (const i of [3, 4, 5, 6]) assert.ok(javascript(CAS[i]).refus, `cas ${i} refusé`);
  assert.equal(javascript(CAS[6]).refus[0][2], 'clé déjà prise');
});

test('R309 : deux homonymes de même type se distinguent par leur parent ; sans parent, ou avec le même, le refus', () => {
  const [contreSort, sapeur, memeParent, sansParent] = [0, 1, 2, 3].map((i) => javascript(CAS[CAS_R309 + i]));
  assert.deepEqual(contreSort.cles, { 1: 'contre-sort-arcane', 2: 'contre-sort-corruption' }, 'le parent s’ajoute après le libellé');
  assert.deepEqual(sapeur.cles, { 1: 'sapeur-metier', 2: 'sapeur-sort' }, 'des types différents : le type suffit, le parent n’entre pas dans la clé');
  assert.deepEqual(memeParent.refus, [['x-feu', [1, 2], 'clé déjà prise']], 'même type, même parent : la clé est prise, et rien d’autre');
  assert.ok(sansParent.refus.some(([base, ids, raison]) => base === 'x' && ids.join() === '1,2' && raison === RAISONS_PY.incluses), 'sans parent, le refus « catégories incluses » reste');
  assert.ok(sansParent.refus.some(([, , raison]) => raison === RAISONS_PY['cle-prise']));
});

test('R309 : clesDesMotsCles ne lit le parent que d’un homonyme de même type ; un parent seul ne change pas la clé d’un mot-clé sans homonyme', () => {
  const sansHomonyme = clesDesMotsCles([{ id: 1, libelle: 'Rituel', categories: [16], parent: 'Arcane' }], CATEGORIES_R309);
  assert.equal(sansHomonyme.get(1), 'rituel');
  const mixte = clesDesMotsCles([{ id: 1, libelle: 'Rituel', categories: [16], parent: 'Arcane' }, { id: 2, libelle: 'Rituel', categories: [16] }], CATEGORIES_R309, { strict: false });
  assert.equal(mixte.get(1), 'rituel-arcane');
  assert.equal(mixte.get(2), 'rituel', 'sans parent (et non strict) : le libellé seul, comme avant');
});

test('R232 : sur la base, chaque clé est celle de la règle (stricte), et la même que celle de maverick.py', { skip: sansPython }, () => {
  const db = ouvrirBase();
  const motsCles = motsClesDeLaBase(db);
  const categories = Object.fromEntries(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle]));
  const cas = { motsCles: motsCles.map((m) => ({ id: m.id, libelle: m.libelle, categories: m.categories, parent: m.parent })), categories };
  const js = javascript(cas);
  assert.ok(js.cles, `la base respecte la règle : ${JSON.stringify(js.refus)}`);
  for (const m of motsCles) assert.equal(js.cles[m.id], m.cle, `mot-clé ${m.id}`);
  assert.deepEqual(js, python([cas])[0]);
});

test('R309 : motsClesDeLaBase porte le parent d’un mot-clé de sort (la magie du sort), null sinon ; une base sans sort.mot_cle_id n’en lève pas', () => {
  const essai = new DatabaseSync(':memory:');
  essai.exec(`
    CREATE TABLE mot_cle (id INTEGER PRIMARY KEY, libelle TEXT NOT NULL, cle TEXT NOT NULL);
    CREATE TABLE magie (id TEXT PRIMARY KEY, nom TEXT NOT NULL);
    CREATE TABLE sort (id TEXT PRIMARY KEY, magie_id TEXT NOT NULL REFERENCES magie(id), nom TEXT NOT NULL);
    INSERT INTO mot_cle (id, libelle, cle) VALUES (1, 'Essaim fantôme', 'essaim-fantome-zorg'), (2, 'Essaim fantôme', 'essaim-fantome-quix'), (3, 'Mot libre', 'mot-libre');
    INSERT INTO magie (id, nom) VALUES ('magies/zorg', 'Zorg'), ('magies/quix', 'Quix');
    INSERT INTO sort (id, magie_id, nom) VALUES ('magies/zorg#sort:essaim', 'magies/zorg', 'Essaim fantôme'), ('magies/quix#sort:essaim', 'magies/quix', 'Essaim fantôme');`);
  // base d'avant la 0131 : pas de colonne, donc pas de parent, et aucune erreur
  assert.deepEqual(motsClesDeLaBase(essai).map((m) => m.parent), [null, null, null]);
  essai.exec(`
    ALTER TABLE sort ADD COLUMN mot_cle_id INTEGER REFERENCES mot_cle(id);
    UPDATE sort SET mot_cle_id = 1 WHERE magie_id = 'magies/zorg';
    UPDATE sort SET mot_cle_id = 2 WHERE magie_id = 'magies/quix';`);
  assert.deepEqual(motsClesDeLaBase(essai).map((m) => [m.id, m.parent]), [[1, 'Zorg'], [2, 'Quix'], [3, null]]);
  // les deux homonymes de même type, ancrés sur deux sorts de même nom, reçoivent chacun la clé de leur magie
  const types = new Map([[16, 'Sort']]);
  const cles = clesDesMotsCles(motsClesDeLaBase(essai).map((m) => ({ ...m, categories: m.id === 3 ? [] : [16] })), types);
  assert.deepEqual([...cles], [[1, 'essaim-fantome-zorg'], [2, 'essaim-fantome-quix'], [3, 'mot-libre']]);
});
