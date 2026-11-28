// Migration data/migrations/0113-mots-cles-id-entier.sql (lot « mots-clés : ID entier, clé, catégories ») : un mot-clé a un id entier (1 à 407 dans
// l'ordre de l'ancien id texte, registre 0113-mots-cles-id-entier.json), une clé `cle` (ce que citent les balises et les adresses) qui suit le libellé
// et les catégories, un libellé qui n'est plus unique ; les catégories (categorie_mot_cle, mot_cle_categorie) ; les clés quittées
// (mot_cle_ancienne_cle) ; page_tag et sort_mot_cle à l'id entier ; le lien d'un mot-clé de monnaie (mot_cle.monnaie_id). Règle de la clé (réponses du
// propriétaire) : tools/db/maverick.py#cles_des_mots_cles, épinglée ici sur des cas d'essai, et la base la suit.
// Le site de dev est la source de ce qu'il modifie : les valeurs de la migration (libellés des catégories, des 13 classes raciales) se lisent à
// l'import (lib/historique-site.mjs#lignesDImport) ; l'état courant ne porte que des invariants. Lecture de la base construite.
//   node --test test/db-0113-mots-cles-id-entier.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { REFERENCES } from '../src/lib/references-des-migrations.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { TABLES_HORS_REGLES } from '../src/lib/tables-de-la-base.mjs';
import { registreDeMigration } from './aide-registres-sortis.mjs';
import { testRetireAvecLesMixtes } from './aide-sortie-du-contenu.mjs';

// Les tests qui éprouvent la migration mixte elle-même sortent avec elle (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LES_MIXTES).
const testDeLaMixte = testRetireAvecLesMixtes(import.meta.url);

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
// Le registre sort avec les migrations mixtes. Ce que les tests d'invariants en lisent : la correspondance ancien id → id entier, dans sa référence
// (data/references/, lib/references-des-migrations.mjs, que lit le service) ; et, des seules entrées dont la clé n'est pas l'ancien id ou qui avaient un
// libellé d'avant (classes raciales), la clé et les libellés, gardés dans test/fixtures/registres-sortis.json (aide-registres-sortis.mjs). Toute autre
// entrée a pour clé son ancien id (vérifié par le test du registre, tant qu'il est là).
const lireLeRegistre0113 = () => JSON.parse(readFileSync(new URL('../../data/migrations/0113-mots-cles-id-entier.json', import.meta.url), 'utf8'));
const DETAILS_0113 = new Map(registreDeMigration('0113-mots-cles-id-entier').motsCles.map((e) => [e.ancienId, e]));
const REGISTRE = {
  motsCles: JSON.parse(readFileSync(new URL(`../../${REFERENCES.idsDesMotsCles}`, import.meta.url), 'utf8')).ids
    .map(([ancienId, id]) => DETAILS_0113.get(ancienId) ?? { ancienId, id, cle: ancienId }),
};
const db = ouvrirBase({ sansExemples: false });

/** Lance `script` (Python : `maverick as T`, `entree` = la valeur JSON donnée) et rend son JSON. */
function python(script, entree = null) {
  const p = spawnSync('python3', ['-X', 'utf8', '-I', '-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
entree = json.loads(sys.stdin.read())
${script}`], { encoding: 'utf8', input: JSON.stringify(entree) });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

const colonnes = (table) => db.prepare(`PRAGMA table_info("${table}")`).all();
const clesEtrangeres = (table) => db.prepare(`PRAGMA foreign_key_list("${table}")`).all();

test('structure : mot_cle.id entier, `cle` unique à la place de libelle_cle, libellé sans UNIQUE, monnaie_id en dernier', () => {
  const c = colonnes('mot_cle');
  // abreviation, retirée par la migration 0115 (R233 (7) : devenue un synonyme, test/db-0115-mots-cles-synonymes.test.mjs)
  // libelle, description, couleur, url et icone (0116) : retirées par la migration 0136, elles se lisent sur l'élément du mot-clé (page, sort ou repère)
  assert.deepEqual(c.map((x) => x.name), ['id', 'cle', 'verrou', 'monnaie_id']);
  assert.deepEqual([c[0].type, c[0].pk], ['INTEGER', 1]);
  const uniques = db.prepare("SELECT name FROM pragma_index_list('mot_cle') WHERE \"unique\" = 1").all()
    .map((i) => db.prepare('SELECT name FROM pragma_index_info(?)').all(i.name).map((x) => x.name).join(','));
  assert.ok(uniques.includes('cle') && uniques.includes('monnaie_id'));
  assert.ok(!uniques.includes('libelle'), 'le libellé n’est plus unique');
  assert.deepEqual(clesEtrangeres('mot_cle').map((f) => [f.from, f.table, f.to]), [['monnaie_id', 'monnaie', 'id']]);
});

test('structure : page_tag.tag_id et sort_mot_cle.mot_cle_id entiers ; catégories, liaison (cascade, RESTRICT) et clés quittées (cascade)', () => {
  assert.equal(colonnes('page_tag').find((x) => x.name === 'tag_id').type, 'INTEGER');
  assert.equal(colonnes('sort_mot_cle').find((x) => x.name === 'mot_cle_id').type, 'INTEGER');
  assert.deepEqual(colonnes('categorie_mot_cle').map((x) => [x.name, x.type]), [['id', 'INTEGER'], ['libelle', 'TEXT'], ['libelle_cle', 'TEXT']]);
  const liaison = Object.fromEntries(clesEtrangeres('mot_cle_categorie').map((f) => [f.from, [f.table, f.on_delete]]));
  assert.deepEqual(liaison, { mot_cle_id: ['mot_cle', 'CASCADE'], categorie_id: ['categorie_mot_cle', 'RESTRICT'] });
  assert.deepEqual(clesEtrangeres('mot_cle_ancienne_cle').map((f) => [f.from, f.table, f.on_delete]), [['mot_cle_id', 'mot_cle', 'CASCADE']]);
  for (const table of ['page_tag', 'sort_mot_cle', 'mot_cle_categorie', 'mot_cle_ancienne_cle']) {
    assert.deepEqual(db.prepare(`PRAGMA foreign_key_check("${table}")`).all(), [], table);
  }
  for (const [table, col] of [['page_tag', 'tag_id'], ['sort_mot_cle', 'mot_cle_id'], ['mot_cle_categorie', 'mot_cle_id'], ['mot_cle', 'id']]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM "${table}" WHERE typeof("${col}") <> 'integer'`).get().n, 0, `${table}.${col}`);
  }
});

test('import : les catégories des réponses du propriétaire, ids 1 à 11, dans l’ordre (Métier et Bestiaire ajoutées)', () => {
  const lignes = historiqueSite(db).lignesDImport('categorie_mot_cle').filter((c) => c.id <= 11).sort((a, b) => a.id - b.id);
  assert.deepEqual(lignes.map((c) => [c.id, c.libelle]), [
    [1, 'Règles'], [2, 'Magie'], [3, 'Race'], [4, 'Combat'], [5, 'Fiche de personnage'], [6, 'Classe'], [7, 'Équipement'], [8, 'Événement'],
    [9, 'Objet légendaire'], [10, 'Métier'], [11, 'Bestiaire'],
  ]);
});

test('état courant : libelle_cle des catégories = normalize(libelle), unique', { skip: sansPython }, () => {
  const categories = db.prepare('SELECT id, libelle, libelle_cle FROM categorie_mot_cle').all();
  const attendu = python('print(json.dumps([T.normalize(l) for l in entree]))', categories.map((c) => c.libelle));
  assert.deepEqual(categories.map((c) => c.libelle_cle), attendu);
});

testDeLaMixte('registre : 407 anciens ids, numérotés de 1 à 367 (version 110) puis 368 à 407 (ajoutés par dev), chaque partie dans l’ordre binaire', () => {
  const m = lireLeRegistre0113().motsCles;
  assert.deepEqual(REGISTRE.motsCles, m, 'la référence et ce qui est gardé redonnent le registre');
  assert.equal(m.length, 407);
  assert.deepEqual(m.map((e) => e.id), m.map((_, i) => i + 1));
  const binaire = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  for (const partie of [m.slice(0, 367), m.slice(367)]) assert.deepEqual(partie.map((e) => e.ancienId), partie.map((e) => e.ancienId).sort(binaire));
  assert.equal(new Set(m.map((e) => e.cle)).size, 407);
});

test('état courant : l’ancien id d’un mot-clé encore présent mène à lui (sa clé, ou mot_cle_ancienne_cle), sauf s’il est devenu la clé d’un autre', () => {
  const parCle = new Map(db.prepare('SELECT cle, id FROM mot_cle').all().map((m) => [m.cle, m.id]));
  const quittees = new Map(db.prepare('SELECT cle, mot_cle_id FROM mot_cle_ancienne_cle').all().map((a) => [a.cle, a.mot_cle_id]));
  const presents = new Set(parCle.values());
  let vus = 0;
  for (const { ancienId, id } of REGISTRE.motsCles) {
    if (!presents.has(id)) continue; // supprimé depuis : ses clés quittées sont parties avec lui (cascade)
    vus += 1;
    if (parCle.get(ancienId) === id) continue;
    if (parCle.has(ancienId)) continue; // devenu la clé courante d'un autre mot-clé : la clé courante se cherche d'abord (voulu)
    assert.equal(quittees.get(ancienId), id, `${ancienId} : une clé quittée mène à ${id}`);
  }
  assert.ok(vus > 0);
  // mot_cle_ancienne_cle ne garde que des clés quittées : aucune n'est la clé courante de son propre mot-clé
  for (const [cle, id] of quittees) assert.notEqual(parCle.get(cle), id, cle);
});

test('import : les 13 classes raciales n’ont plus le suffixe « (classe) » et ont la catégorie Classe (R191 remplacée)', () => {
  const h = historiqueSite(db);
  const classe = h.lignesDImport('categorie_mot_cle').find((c) => c.libelle_cle === 'classe').id;
  // le libellé se lit sur l'élément du mot-clé (vue v_mot_cle, migration 0136) ; l'historique y remet ceux d'avant les renommages du site
  const libelles = new Map(h.lignesDImport('mot_cle', db.prepare('SELECT id, libelle FROM v_mot_cle').all()).map((m) => [m.id, m.libelle]));
  assert.ok([...libelles.values()].every((l) => typeof l === 'string' && l), 'chaque mot-clé a son libellé');
  const categories = h.lignesDImport('mot_cle_categorie');
  const raciales = REGISTRE.motsCles.filter((e) => e.libelleAvant);
  assert.equal(raciales.length, 13);
  for (const e of raciales) {
    assert.match(e.libelleAvant, / \(classe\)$/);
    assert.equal(e.libelle, e.libelleAvant.replace(/ \(classe\)$/, ''), e.ancienId);
    if (!libelles.has(e.id)) continue;
    assert.ok(categories.some((c) => c.mot_cle_id === e.id && c.categorie_id === classe), `${e.ancienId} : catégorie Classe`);
  }
  assert.deepEqual([...libelles.values()].filter((l) => / \(classe\)\s*$/i.test(l)), [], 'aucun libellé ne garde le suffixe');
});

test('état courant : chaque monnaie a un seul mot-clé (monnaie_id), celui dont l’ancien id était le sien (R183)', () => {
  const anciens = new Map(REGISTRE.motsCles.map((e) => [e.id, e.ancienId]));
  for (const { id } of db.prepare('SELECT id FROM monnaie').all()) {
    const lignes = db.prepare('SELECT id FROM mot_cle WHERE monnaie_id = ?').all(id);
    assert.equal(lignes.length, 1, id);
    assert.equal(anciens.get(lignes[0].id), id);
  }
});

test('état courant : la clé de chaque mot-clé suit la règle (maverick.py#cles_des_mots_cles ; strict depuis la 0114 : test/db-0114-categories-assignees.test.mjs)', { skip: sansPython }, () => {
  // le libellé se lit sur l'élément du mot-clé (migration 0136)
  const mots = motsClesDeLaBase(db, { elements: false });
  const cats = db.prepare('SELECT mot_cle_id, categorie_id FROM mot_cle_categorie').all();
  const entree = {
    mots: mots.map((m) => [m.id, m.libelle, cats.filter((c) => c.mot_cle_id === m.id).map((c) => c.categorie_id)]),
    categories: db.prepare('SELECT id, libelle FROM categorie_mot_cle').all().map((c) => [c.id, c.libelle]),
    // R309 : le parent d'un mot-clé ancré sur un sort (la magie du sort) départage deux homonymes de même type
    parents: Object.fromEntries(motsClesDeLaBase(db).filter((m) => m.parent).map((m) => [m.id, m.parent])),
  };
  const cles = python('print(json.dumps(T.cles_des_mots_cles(entree["mots"], dict(entree["categories"]), strict=False, parents={int(k): v for k, v in entree["parents"].items()})))', entree);
  for (const { id, cle } of db.prepare('SELECT id, cle FROM mot_cle').all()) assert.equal(cle, cles[String(id)], `mot-clé ${id}`);
});

test('règle de la clé : homonymes distingués par leurs seules catégories propres, refus des cas que le propriétaire refuse', { skip: sansPython }, () => {
  const r = python(`
cats = {1: 'Règles', 3: 'Race', 5: 'Fiche de personnage', 6: 'Classe', 9: 'Objet légendaire'}
def essai(mots, strict=True):
    try:
        return T.cles_des_mots_cles(mots, cats, strict)
    except T.HomonymesRefuses as e:
        return {'refus': [f[2] for f in e.fautes]}
print(json.dumps({
    'seul': essai([(1, 'Armure magique', [1, 3])]),
    'deux': essai([(1, 'Namazu', [5, 3]), (2, 'Namazu', [5, 6])]),
    'trois': essai([(1, 'Orbe', [1, 3]), (2, 'Orbe', [1, 6]), (3, 'Orbe', [9, 3])]),
    'sans_categorie': essai([(1, 'Orios', []), (2, 'Orios', [6])]),
    'sans_categorie_admis': essai([(1, 'Orios', []), (2, 'Orios', [6])], strict=False),
    'incluses': essai([(1, 'Feu', [3]), (2, 'Feu', [3, 6])]),
    'egales': essai([(1, 'Feu', [3]), (2, 'Feu', [3])]),
    'cle_prise': essai([(1, 'Namazu', [3]), (2, 'Namazu', [6]), (3, 'Namazu race', [])]),
    'cle_prise_admis': essai([(1, 'Namazu', [3]), (2, 'Namazu', [6]), (3, 'Namazu race', [])], strict=False),
}))`);
  assert.deepEqual(r.seul, { 1: 'armure-magique' }, 'sans homonyme : le slug du libellé seul');
  assert.deepEqual(r.deux, { 1: 'namazu-race', 2: 'namazu-classe' }, 'la catégorie commune n’entre pas dans la clé');
  assert.deepEqual(r.trois, { 1: 'orbe-regles-race', 2: 'orbe-regles-classe', 3: 'orbe-race-objet-legendaire' }, 'toutes les catégories non communes à tous, par id');
  assert.deepEqual(r.sans_categorie.refus, ['homonyme sans catégorie']);
  assert.deepEqual(r.sans_categorie_admis, { 1: 'orios', 2: 'orios-classe' }, 'état intermédiaire de la 0113 : le slug seul');
  assert.ok(r.incluses.refus.length >= 1, 'catégories incluses dans celles d’un autre : refusé');
  assert.ok(r.egales.refus.length >= 1, 'mêmes catégories : refusé');
  assert.ok(r.cle_prise.refus.includes('clé déjà prise'));
  assert.ok(r.cle_prise_admis.refus.includes('clé déjà prise'), 'une clé prise est refusée même dans l’état intermédiaire (cle UNIQUE)');
});

test('textes : aucune balise ne cite un ancien id qui n’est plus une clé (pp, rf, ro), hors sections 13 à 15', () => {
  const cles = new Set(db.prepare('SELECT cle FROM mot_cle').all().map((m) => m.cle));
  const anciens = new Set(REGISTRE.motsCles.filter((e) => e.ancienId !== e.cle && !cles.has(e.ancienId)).map((e) => e.ancienId));
  assert.ok(anciens.size > 0);
  const balise = /\{\{([^{}|\n]+?)(?:\\?\|[^{}\n]*?)?\}\}/g;
  const hors = new Set(TABLES_HORS_REGLES);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all()
    .map((t) => t.name).filter((t) => !hors.has(t) && !/_fts(_|$)/.test(t));
  const fautes = [];
  for (const table of tables) {
    for (const { name } of colonnes(table).filter((c) => c.type === 'TEXT')) {
      for (const { v } of db.prepare(`SELECT "${name}" AS v FROM "${table}" WHERE instr("${name}", '{{') > 0`).all()) {
        for (const [, ref] of v.matchAll(balise)) if (anciens.has(ref.replace(/:$/, '').trim())) fautes.push(`${table}.${name} : ${ref}`);
      }
    }
  }
  assert.deepEqual(fautes, []);
});

test('traces : une ligne de mot_cle, page_tag ou sort_mot_cle de historique_modification nomme le mot-clé par son id entier, sans libelle_cle', () => {
  const anciens = new Set(REGISTRE.motsCles.map((e) => e.ancienId));
  const traces = db.prepare("SELECT table_nom, cle, avant, apres FROM historique_modification WHERE table_nom IN ('mot_cle', 'page_tag', 'sort_mot_cle')").all();
  for (const t of traces) {
    const objets = [JSON.parse(t.cle), JSON.parse(t.avant ?? 'null'), JSON.parse(t.apres ?? 'null')].filter(Boolean);
    const champ = { mot_cle: 'id', page_tag: 'tag_id', sort_mot_cle: 'mot_cle_id' }[t.table_nom];
    for (const o of objets) {
      if (champ in o && typeof o[champ] === 'string') assert.ok(!anciens.has(o[champ]), `${t.table_nom} ${t.cle} : ancien id ${o[champ]} non traduit`);
      if (t.table_nom === 'mot_cle') assert.ok(!('libelle_cle' in o), `${t.cle} : libelle_cle`);
    }
  }
});
