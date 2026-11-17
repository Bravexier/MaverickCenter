// La clé des mots-clés (mot_cle.cle, migration 0113 ; décision R232 (2), (9), (10)) : lib/mots-cles-cles.mjs#clesDesMotsCles, la jumelle de
// tools/db/maverick.py#cles_des_mots_cles (la référence), rend les mêmes clés et les mêmes refus ; sur la base, chaque clé est celle de la règle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { clesDesMotsCles, HomonymesRefuses } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;

/** cles_des_mots_cles de maverick.py sur chaque cas : [{ cles } | { refus: [[base, ids, raison]] }]. */
function python(cas) {
  const p = spawnSync('python3', ['-I', '-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
sortie = []
for c in json.load(sys.stdin):
    try:
        cles = T.cles_des_mots_cles([(m['id'], m['libelle'], m['categories']) for m in c['motsCles']], {int(k): v for k, v in c['categories'].items()}, strict=c.get('strict', True))
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
  incluses: 'aucune catégorie propre face à un homonyme (catégories incluses ou égales)',
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
];

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

test('R232 : sur la base, chaque clé est celle de la règle (stricte), et la même que celle de maverick.py', { skip: sansPython }, () => {
  const db = ouvrirBase();
  const motsCles = motsClesDeLaBase(db);
  const categories = Object.fromEntries(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle]));
  const cas = { motsCles: motsCles.map((m) => ({ id: m.id, libelle: m.libelle, categories: m.categories })), categories };
  const js = javascript(cas);
  assert.ok(js.cles, `la base respecte la règle : ${JSON.stringify(js.refus)}`);
  for (const m of motsCles) assert.equal(js.cles[m.id], m.cle, `mot-clé ${m.id}`);
  assert.deepEqual(js, python([cas])[0]);
});
