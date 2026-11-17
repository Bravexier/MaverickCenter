// Migration data/migrations/0114-mots-cles-categories-assignees.sql (décision R232 (7), lot « mots-clés : ID entier, clé, catégories, synonymes ») :
// les catégories des mots-clés existants, assignées par game-design et worldbuilding (registre 0114-mots-cles-categories-assignees.json, une ligne
// par mot-clé, avec l'équipe), puis les clés recalculées par la règle de R232 (2), (9), (10), sans écart admis : les 13 races homonymes d'une classe
// raciale ont la catégorie Race et la clé « x-race », leur ancienne clé mène encore à elles (mot_cle_ancienne_cle), et la balise qui la citait est
// réécrite.
// Le site de dev est la source de ce qu'il modifie (catégories posées ou retirées, libellés) : le registre se compare à l'état d'import
// (lib/historique-site.mjs#lignesDImport) ; l'état courant ne porte que les invariants de R232 (clé recalculée, homonymes distingués, balises).
//   node --test test/db-0114-categories-assignees.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { TABLES_HORS_REGLES } from '../src/lib/tables-de-la-base.mjs';
import { ecrituresReecrites } from './aide-textes-reecrits.mjs';
import { MOTS_CLES_DE_LA_0120 } from './aide-races-0120.mjs';
import { fonduParLa0122 } from './aide-migration-0122.mjs';
import { fonduParLa0124 } from './aide-migration-0124.mjs';

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const lireRegistre = (nom) => JSON.parse(readFileSync(new URL(`../../data/migrations/${nom}.json`, import.meta.url), 'utf8'));
const REGISTRE = lireRegistre('0114-mots-cles-categories-assignees');
const REGISTRE_0113 = lireRegistre('0113-mots-cles-id-entier');
const db = ouvrirBase({ sansExemples: false });

/** Lance `script` (Python : `maverick as T`, `entree` = la valeur JSON donnée) et rend son JSON. */
function python(script, entree = null) {
  const p = spawnSync('python3', ['-I', '-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
entree = json.loads(sys.stdin.read())
${script}`], { encoding: 'utf8', input: JSON.stringify(entree) });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

/** Les clés que la règle donne à des mots-clés et à leurs catégories (tools/db/maverick.py#cles_des_mots_cles, strict : un refus lève). */
function clesDeLaRegle(motsCles, liaisons, categories) {
  const entree = {
    mots: motsCles.map((m) => [m.id, m.libelle, liaisons.filter((c) => c.mot_cle_id === m.id).map((c) => c.categorie_id)]),
    categories: categories.map((c) => [c.id, c.libelle]),
  };
  return python(`
try:
    print(json.dumps({'cles': T.cles_des_mots_cles(entree['mots'], dict(entree['categories']), strict=True)}))
except T.HomonymesRefuses as e:
    print(json.dumps({'refus': [[f[0], f[1], f[2]] for f in e.fautes]}))`, entree);
}

test('registre : une ligne par mot-clé, son id et son ancien id du registre 0113, ses catégories par id croissant, l’équipe qui les a proposées', () => {
  const ancien = new Map(REGISTRE_0113.motsCles.map((e) => [e.id, e.ancienId]));
  const a = REGISTRE.assignations;
  assert.ok(a.length > 0);
  assert.equal(new Set(a.map((e) => e.id)).size, a.length, 'un mot-clé une seule fois');
  for (const e of a) {
    assert.equal(ancien.get(e.id), e.ancienId, `${e.id} : ancien id du registre 0113`);
    assert.ok(['game-design', 'worldbuilding'].includes(e.auteur), `${e.ancienId} : équipe`);
    assert.ok(e.categories.length > 0, `${e.ancienId} : au moins une catégorie`);
    const ids = e.categories.map((c) => c.id);
    assert.deepEqual(ids, [...new Set(ids)].sort((x, y) => x - y), `${e.ancienId} : catégories par id croissant, sans doublon`);
  }
  // R233 (5) : les deux mots-clés fondus dans Instant Cast par la migration 0115 ne reçoivent rien ; les classes raciales gardent la seule catégorie de la 0113
  const fondus = new Set(lireRegistre('0115-mots-cles-synonymes').fusions.map((f) => f.id));
  const raciales = new Set(REGISTRE_0113.motsCles.filter((e) => e.libelleAvant).map((e) => e.id));
  assert.deepEqual(a.filter((e) => fondus.has(e.id) || raciales.has(e.id)), []);
});

test('import : les catégories des mots-clés sont celles du registre, plus Classe sur les 13 classes raciales (0113) ; libellés des catégories du registre', () => {
  const h = historiqueSite(db);
  const categories = new Map(h.lignesDImport('categorie_mot_cle').map((c) => [c.id, c.libelle]));
  for (const e of REGISTRE.assignations) {
    for (const c of e.categories) assert.equal(categories.get(c.id), c.libelle, `${e.ancienId} : catégorie ${c.id}`);
  }
  const classe = h.lignesDImport('categorie_mot_cle').find((c) => c.libelle_cle === 'classe').id;
  const attendu = [
    // les mots-clés que la 0122 et la 0124 fondent dans un autre (« La montée de niveau », « Fiche de personnage : Accessoires et Ceinture » ; leurs
    // registres) ont perdu leurs catégories avec eux
    ...REGISTRE.assignations.filter((e) => !fonduParLa0122(e.id) && !fonduParLa0124(e.id)).flatMap((e) => e.categories.map((c) => `${e.id}:${c.id}`)),
    ...REGISTRE_0113.motsCles.filter((e) => e.libelleAvant).map((e) => `${e.id}:${classe}`),
  ].sort();
  // les mots-clés d'une migration postérieure (0120 : Fongoïde et Gémidien, épinglés par test/db-0120-races-fongoide-gemidien.test.mjs) mis à part ;
  // de la 0121 (R258 (7), R268), seule la catégorie que son registre `mots_cles` leur donne (épinglée par test/db-0121-maj-decembre-suites.test.mjs)
  const posterieurs = new Set(Object.values(MOTS_CLES_DE_LA_0120));
  // de même la 0123 (les neuf alignements, épinglés par test/db-0123-fusion-pages-alignement.test.mjs : registre `mots_cles_crees`)
  const deLa0121EtLa0123 = new Set([...lireRegistre('0121-maj-decembre-suites').mots_cles, ...lireRegistre('0123-fusion-pages-alignement').mots_cles_crees]
    .map((m) => `${m.id}:${m.categorie_id}`));
  const aLImport = h.lignesDImport('mot_cle_categorie').filter((l) => !posterieurs.has(l.mot_cle_id)).map((l) => `${l.mot_cle_id}:${l.categorie_id}`)
    .filter((l) => !deLa0121EtLa0123.has(l)).sort();
  assert.deepEqual(aLImport, attendu);
});

test('import : les clés que la migration a changées sont celles de la règle, l’ancienne mène au mot-clé (mot_cle_ancienne_cle)', () => {
  const h = historiqueSite(db);
  const cles = new Map(h.lignesDImport('mot_cle').map((m) => [m.id, m.cle]));
  const quittees = new Map(h.lignesDImport('mot_cle_ancienne_cle').map((a) => [a.cle, a.mot_cle_id]));
  assert.ok(REGISTRE.cles.length > 0);
  for (const { id, avant, apres } of REGISTRE.cles) {
    assert.notEqual(avant, apres);
    assert.equal(cles.get(id), apres, `${id} : clé après la migration`);
    assert.equal(quittees.get(avant), id, `${avant} : clé quittée`);
  }
  // les 13 races homonymes d'une classe raciale (registre 0113) sont celles dont la clé change, et seulement elles
  const libelles = new Map(REGISTRE_0113.motsCles.map((e) => [e.id, e.libelle]));
  const homonymesDeClasse = REGISTRE_0113.motsCles.filter((e) => e.libelleAvant).map((e) => e.libelle);
  const races = REGISTRE_0113.motsCles.filter((e) => !e.libelleAvant && homonymesDeClasse.includes(e.libelle)).map((e) => e.id).sort((a, b) => a - b);
  assert.equal(races.length, 13);
  assert.deepEqual(REGISTRE.cles.map((c) => c.id).sort((a, b) => a - b), races);
  for (const { id } of REGISTRE.cles) assert.ok(REGISTRE.assignations.some((e) => e.id === id), `${libelles.get(id)} : catégories assignées`);
});

test('import : la règle de la clé, stricte, donne exactement les clés de l’état d’import (R232 : plus d’écart admis)', { skip: sansPython }, () => {
  const h = historiqueSite(db);
  const motsCles = h.lignesDImport('mot_cle');
  const r = clesDeLaRegle(motsCles, h.lignesDImport('mot_cle_categorie'), h.lignesDImport('categorie_mot_cle'));
  assert.deepEqual(r.refus, undefined, 'aucun homonyme sans catégorie propre, aucune clé prise');
  for (const m of motsCles) assert.equal(m.cle, r.cles[String(m.id)], `mot-clé ${m.id}`);
});

test('état courant (R232 (2), (9), (10)) : chaque clé est celle de la règle stricte ; aucun homonyme sans catégorie propre', { skip: sansPython }, () => {
  const motsCles = db.prepare('SELECT id, libelle, cle FROM mot_cle').all();
  const r = clesDeLaRegle(motsCles, db.prepare('SELECT mot_cle_id, categorie_id FROM mot_cle_categorie').all(),
    db.prepare('SELECT id, libelle FROM categorie_mot_cle').all());
  assert.deepEqual(r.refus, undefined);
  for (const m of motsCles) assert.equal(m.cle, r.cles[String(m.id)], `mot-clé ${m.id}`);
});

test('textes : la balise réécrite l’est à l’import ; aucune balise des règles ne cite une clé quittée par la 0114, hors sections 13 à 15', () => {
  const h = historiqueSite(db);
  const ecritures = ecrituresReecrites('0114-mots-cles-categories-assignees');
  assert.ok(REGISTRE.textes.length > 0);
  for (const t of REGISTRE.textes) {
    const valeur = h.valeurDImport(t.table, t.cle, t.col);
    if (valeur === undefined) continue; // ligne créée par le site : rien d'importé
    assert.ok(ecritures(t.table, t.cle, t.col, valeur)[1].includes(t.apres), `${t.table} ${JSON.stringify(t.cle)} ${t.col}`);
  }
  const courantes = new Set(db.prepare('SELECT cle FROM mot_cle').all().map((m) => m.cle));
  const quittees = new Set(REGISTRE.cles.map((c) => c.avant).filter((c) => !courantes.has(c)));
  const balise = /\{\{([^{}|\n]+?)(?:\\?\|[^{}\n]*?)?\}\}/g;
  const hors = new Set(TABLES_HORS_REGLES);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all()
    .map((t) => t.name).filter((t) => !hors.has(t) && !/_fts(_|$)/.test(t));
  const fautes = [];
  for (const table of tables) {
    for (const { name } of db.prepare(`PRAGMA table_info("${table}")`).all().filter((c) => c.type === 'TEXT')) {
      for (const { v } of db.prepare(`SELECT "${name}" AS v FROM "${table}" WHERE instr("${name}", '{{') > 0`).all()) {
        for (const [, ref] of v.matchAll(balise)) if (quittees.has(ref.replace(/:$/, '').trim())) fautes.push(`${table}.${name} : ${ref}`);
      }
    }
  }
  assert.deepEqual(fautes, []);
});
