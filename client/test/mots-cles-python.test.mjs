// Le mot-clé d'un libellé côté importeurs (tools/db/maverick.py#mot_cle, db:sync-pages, Famille.page) : le site de dev est la source du vocabulaire
// (historique_modification) — une écriture qu'un mot-clé a quittée (renommé) mène à lui, celle d'un mot-clé fusionné au mot-clé qui l'a reçu, celle d'un
// mot-clé supprimé ne revient pas ; et un import ne crée jamais de mot-clé (migration 0056 : le vocabulaire, devenu un glossaire, est celui du site de
// dev) : une écriture inconnue n'est pas posée, poser_les_mots_cles la rend pour que db:sync-pages la signale. Depuis la migration 0113, un mot-clé a
// un id entier et une clé (mot_cle.cle), et son libellé n'est plus unique : une écriture que portent plusieurs homonymes n'est pas posée.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MOT_CLE_DE_CATEGORIE } from '../src/lib/classe-champs.mjs';
import { MOTS_CLES_PROTEGES, RAISONS_DES_MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES } from '../src/lib/mots-cles-proteges.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;

/** Lance `script` (Python, `maverick as T` importé, `db` : une base en mémoire faite de `tables`) et rend son JSON. */
function pythonSurTables(tables, script) {
  const p = spawnSync('python3', ['-I', '-c', `
import json, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
db = sqlite3.connect(':memory:')
db.executescript(${JSON.stringify(tables)})
${script}`], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

const TABLES_D_ESSAI = `
CREATE TABLE mot_cle (id INTEGER PRIMARY KEY, libelle TEXT, cle TEXT UNIQUE);
CREATE TABLE mot_cle_ancienne_cle (cle TEXT PRIMARY KEY, mot_cle_id INTEGER);
CREATE TABLE page_tag (page_id TEXT, ordre INTEGER, tag_id INTEGER, PRIMARY KEY (page_id, ordre), UNIQUE (page_id, tag_id));
CREATE TABLE historique_modification (lot_id TEXT, rang INTEGER, fait_le TEXT, table_nom TEXT, cle TEXT, operation TEXT, avant TEXT, apres TEXT);
`;

test('maverick.py#mot_cle et poser_les_mots_cles suivent ce que le site a fait du vocabulaire, sans jamais créer de mot-clé', { skip: sansPython }, () => {
  // ids entiers (migration 0113) : les traces nomment un mot-clé par son id
  const r = pythonSurTables(`${TABLES_D_ESSAI}
INSERT INTO mot_cle VALUES (1, 'Civilisations', 'civilisations'), (2, 'guide', 'guide');`, `
h = lambda lot, rang, table, cle, op, avant, apres: db.execute('INSERT INTO historique_modification VALUES (?,?,?,?,?,?,?,?)',
    (lot, rang, '2026-10-14T10:00:0' + str(rang) + 'Z', table, json.dumps(cle), op, avant and json.dumps(avant), apres and json.dumps(apres)))
h('l1', 1, 'mot_cle', {'id': 1}, 'modifier', {'libelle': 'civilisation'}, {'libelle': 'Civilisations'})
h('l2', 2, 'page_tag', {'page_id': 'lore/x', 'ordre': 1}, 'supprimer', {'page_id': 'lore/x', 'ordre': 1, 'tag_id': 3}, None)
h('l2', 3, 'mot_cle', {'id': 3}, 'supprimer', {'id': 3, 'libelle': 'mrode', 'cle': 'mrode'}, None)
h('l3', 4, 'page_tag', {'page_id': 'lore/y', 'ordre': 2}, 'modifier', {'tag_id': 4}, {'tag_id': 2})
h('l3', 5, 'mot_cle', {'id': 4}, 'supprimer', {'id': 4, 'libelle': 'aide', 'cle': 'aide'}, None)
h('l4', 6, 'mot_cle', {'id': 5}, 'inserer', None, {'id': 5, 'libelle': 'Essai', 'cle': 'essai'})
h('l4', 7, 'mot_cle', {'id': 5}, 'modifier', {'libelle': 'Essai'}, {'libelle': 'Épreuve'})
h('l5', 8, 'mot_cle', {'id': 6}, 'inserer', None, {'id': 6, 'libelle': 'x', 'cle': 'x'})
h('l5', 9, 'mot_cle', {'id': 6}, 'supprimer', {'id': 6, 'libelle': 'x', 'cle': 'x'}, None)
r = {l: T.mot_cle(db, l) for l in ['civilisation', 'Civilisations', 'mrode', 'aide', 'nouveau']}
r['Épreuve (id employé)'] = T.mot_cle(db, 'Épreuve')
r['inconnues'] = T.poser_les_mots_cles(db, 'lore/z', ['civilisation', 'mrode', 'Civilisations', 'aide', 'nouveau', 'guide'])
r['page_tag'] = db.execute("SELECT ordre, tag_id FROM page_tag WHERE page_id = 'lore/z' ORDER BY ordre").fetchall()
r['vocabulaire'] = db.execute("SELECT id FROM mot_cle ORDER BY id").fetchall()
print(json.dumps(r))`);
  assert.equal(r.civilisation, 1, 'une écriture quittée mène au mot-clé renommé');
  assert.equal(r.Civilisations, 1);
  assert.equal(r.mrode, null, 'un mot-clé supprimé sur le site ne revient pas');
  assert.equal(r.aide, 2, 'un mot-clé fusionné mène au mot-clé qui l’a reçu');
  assert.equal(r.nouveau, null, 'une écriture inconnue du vocabulaire ne crée pas de mot-clé (migration 0056)');
  assert.equal(r['Épreuve (id employé)'], null, 'ni l’écriture d’un mot-clé absent du vocabulaire (créé puis renommé sur le site) : rien n’est recréé');
  assert.deepEqual(r.page_tag, [[0, 1], [3, 2]], 'ni le supprimé, ni l’inconnu, ni deux fois le même ; l’ordre garde sa place');
  assert.deepEqual(r.inconnues, ['mrode', 'nouveau'], 'les écritures non posées sont rendues, pour être signalées');
  assert.deepEqual(r.vocabulaire, [[1], [2]], 'le vocabulaire n’a pas bougé');
});

// Migration 0113 : une écriture que portent plusieurs homonymes est ambiguë (non posée, rendue pour être signalée : il faut écrire la clé) ; la clé
// courante se cherche d'abord (unique, jamais ambiguë) ; une clé quittée (mot_cle_ancienne_cle : un ancien id texte) mène encore à son mot-clé.
test('maverick.py#trouver_mot_cle : la clé d’abord, l’écriture ambiguë non posée, la clé quittée (0113)', { skip: sansPython }, () => {
  const r = pythonSurTables(`${TABLES_D_ESSAI}
INSERT INTO mot_cle VALUES (1, 'Namazu', 'namazu-race'), (2, 'Namazu', 'namazu-classe'), (3, 'Pierre précieuse', 'pierre-precieuse');
INSERT INTO mot_cle_ancienne_cle VALUES ('pp', 3);`, `
r = {e: T.trouver_mot_cle(db, e) for e in ['Namazu', 'namazu-race', 'Namazu classe', 'PP', 'Pierre precieuse', 'absent']}
r['poses'] = T.mots_cles_poses(db, ['Namazu', 'namazu-classe', 'absent'])
r['non_posees'] = T.poser_les_mots_cles(db, 'lore/z', ['Namazu', 'namazu-race'])
r['page_tag'] = db.execute("SELECT ordre, tag_id FROM page_tag WHERE page_id = 'lore/z' ORDER BY ordre").fetchall()
print(json.dumps(r))`);
  assert.deepEqual(r.Namazu, [null, ['namazu-race', 'namazu-classe']], 'deux homonymes portent l’écriture : ambiguë, ils sont nommés par leur clé');
  assert.deepEqual(r['namazu-race'], [1, []]);
  assert.deepEqual(r['Namazu classe'], [2, []], 'une écriture dont le normalize est une clé désigne ce mot-clé');
  assert.deepEqual(r.PP, [3, []], 'l’ancien id texte mène au mot-clé (mot_cle_ancienne_cle)');
  assert.deepEqual(r['Pierre precieuse'], [3, []]);
  assert.deepEqual(r.absent, [null, []]);
  assert.deepEqual(r.poses, [[[1, 2]], ['absent'], [['Namazu', ['namazu-race', 'namazu-classe']]]]);
  assert.deepEqual(r.non_posees, ['Namazu'], 'une écriture ambiguë n’est pas posée et se signale');
  assert.deepEqual(r.page_tag, [[1, 1]]);
});

// Migration 0115 (R233) : un synonyme (mot_cle_synonyme, l'ancienne abréviation comprise) désigne son mot-clé, sans égard à la casse ni aux signes
// (même normalize), après la clé et le libellé ; une base de travail sans la table (vocabulaire chargé seul : codex.py) ne le cherche pas.
test('maverick.py#trouver_mot_cle : un synonyme mène à son mot-clé, sans égard à la casse (0115, R233)', { skip: sansPython }, () => {
  const vocabulaire = `
INSERT INTO mot_cle VALUES (1, 'Instant Cast', 'instant-cast'), (2, 'Naturel', 'naturel'), (3, 'Essai zq', 'essai-zq');`;
  const r = pythonSurTables(`${TABLES_D_ESSAI}
CREATE TABLE mot_cle_synonyme (id INTEGER PRIMARY KEY, mot_cle_id INTEGER, libelle TEXT, libelle_cle TEXT UNIQUE, ordre INTEGER);
${vocabulaire}
INSERT INTO mot_cle_synonyme VALUES (1, 1, 'IC', 'ic', 0), (2, 1, 'Action bonus', 'action-bonus', 1), (3, 2, 'Nat.', 'nat', 0);`, `
r = {e: T.trouver_mot_cle(db, e) for e in ['IC', 'ic', 'Ic', 'action bonus', 'ACTION-BONUS', 'nat.', 'NAT', 'naturel', 'absent']}
r['poses'] = T.mots_cles_poses(db, ['ic', 'Instant Cast', 'Nat.'])
print(json.dumps(r))`);
  for (const e of ['IC', 'ic', 'Ic', 'action bonus', 'ACTION-BONUS']) assert.deepEqual(r[e], [1, []], e);
  for (const e of ['nat.', 'NAT', 'naturel']) assert.deepEqual(r[e], [2, []], e);
  assert.deepEqual(r.absent, [null, []]);
  assert.deepEqual(r.poses, [[[0, 1], [2, 2]], [], []], 'un synonyme et le libellé du même mot-clé : posé une fois');
  const sansTable = pythonSurTables(`${TABLES_D_ESSAI}${vocabulaire}`, "print(json.dumps([T.trouver_mot_cle(db, 'IC'), T.trouver_mot_cle(db, 'Naturel')]))");
  assert.deepEqual(sansTable, [[null, []], [2, []]], 'sans la table des synonymes : seuls clé et libellé');
});

// Les mots-clés protégés (lib/mots-cles.mjs#MOTS_CLES_PROTEGES ; décision R195 : le site les reconnaît à leur ancien id texte) : un importeur les
// pose par l'id entier de leur mot-clé (maverick.py#MOTS_CLES_PROTEGES, migration 0113), jamais par leur écriture. Il écrit dans `tags:` l'écriture
// courante du mot-clé de cet id (maverick.py#libelle_protege, codex.py Vocabulaire.protege), qui ne mène qu'à lui : un autre mot-clé qui a pris
// l'écriture d'origine d'un protégé (« codex », « classe », « race »…) ne reçoit pas ses pages. Vocabulaire d'essai : chaque protégé renommé
// « Essai <clé> » (sa clé suit : « essai-<clé> »), et un leurre (id LEURRE + id) qui porte l'écriture <clé> (le cas que la recherche par écriture
// faisait mal).
const racine = fileURLToPath(new URL('../../', import.meta.url));
const LEURRE = 100000;

/** Lance un script Python (`python3 -I -c`) qui a `maverick as T` et `db` (le vocabulaire `vocabulaire` chargé), et rend son JSON. */
function python(script, vocabulaire) {
  const p = spawnSync('python3', ['-I', '-c', `
import json, os, re, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
VOCABULAIRE = ${JSON.stringify(vocabulaire ?? '')}
db = sqlite3.connect(':memory:')
db.execute(re.search(r'CREATE TABLE mot_cle \\([\\s\\S]*?\\) STRICT;', open(T.SCHEMA, encoding='utf-8').read()).group(0))
db.execute('CREATE TABLE mot_cle_ancienne_cle (cle TEXT PRIMARY KEY, mot_cle_id INTEGER)')
if VOCABULAIRE:
    db.executescript(open(VOCABULAIRE, encoding='utf-8').read())
${script}`], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

/** maverick.py#MOTS_CLES_PROTEGES : { clé : id entier, ou null }. */
const idsProteges = () => python('print(json.dumps(T.MOTS_CLES_PROTEGES))');

function vocabulaireDEssai(t) {
  const fichier = join(dossierTemporaire('mots-cles-proteges-', { t }), 'mot_cle.sql');
  const lignes = Object.entries(idsProteges()).filter(([, id]) => id !== null).flatMap(([cle, id]) => [
    `INSERT INTO mot_cle (id, libelle, cle) VALUES (${id}, 'Essai ${cle}', 'essai-${cle}');`,
    `INSERT INTO mot_cle (id, libelle, cle) VALUES (${LEURRE + id}, '${cle}', '${cle}');`,
  ]);
  writeFileSync(fichier, `${lignes.join('\n')}\n`);
  return fichier;
}

/**
 * Les mots-clés que db:sync-pages poserait pour le `tags:` de chaque page .md de `dossier/famille` : { 'famille/slug': [noms] }, le nom d'un
 * protégé étant sa clé de MOTS_CLES_PROTEGES, celui d'un leurre « leurre-<clé> ».
 */
function posesParPage(dossier, familles, vocabulaire) {
  const pages = {};
  for (const famille of familles) {
    for (const f of readdirSync(join(dossier, famille)).filter((n) => n.endsWith('.md'))) {
      pages[`${famille}/${f.slice(0, -3)}`] = JSON.parse(/^tags: (.*)$/m.exec(readFileSync(join(dossier, famille, f), 'utf8'))[1]);
    }
  }
  return python(`
nom = {i: c for c, i in T.MOTS_CLES_PROTEGES.items() if i is not None}
nom.update({i + ${LEURRE}: 'leurre-' + c for c, i in T.MOTS_CLES_PROTEGES.items() if i is not None})
print(json.dumps({p: [nom.get(i, str(i)) for _, i in T.mots_cles_poses(db, e)[0]] for p, e in ${JSON.stringify(pages)}.items()}))`, vocabulaire);
}

test('maverick.py#MOTS_CLES_PROTEGES recopie les clés de lib/mots-cles.mjs#MOTS_CLES_PROTEGES, avec l’id entier que la migration 0113 leur a donné', { skip: sansPython }, () => {
  const ids = idsProteges();
  assert.deepEqual(Object.keys(ids).sort(), [...RAISONS_DES_MOTS_CLES_PROTEGES.keys()].sort());
  // la copie JS du dictionnaire (lib/mots-cles-proteges.mjs) est la même, et MOTS_CLES_PROTEGES en tient les ids entiers (sans race-hybride, sans id)
  assert.deepEqual({ ...IDS_DES_MOTS_CLES_PROTEGES }, ids);
  assert.deepEqual([...MOTS_CLES_PROTEGES.keys()].sort((a, b) => a - b), Object.values(ids).filter((id) => id !== null).sort((a, b) => a - b));
  // l'id de chacun : celui du registre de la migration 0113 (ancien id texte -> id entier) ; null pour celui qui n'existait pas (race-hybride)
  const registre = new Map(JSON.parse(readFileSync(join(racine, 'data/migrations/0113-mots-cles-id-entier.json'), 'utf8')).motsCles.map((m) => [m.ancienId, m.id]));
  for (const [cle, id] of Object.entries(ids)) assert.equal(id, registre.get(cle) ?? null, cle);
});

test('maverick.py#libelle_protege : l’écriture courante du mot-clé de l’id, qui mène à lui et pas au mot-clé qui a pris son écriture d’origine', { skip: sansPython }, (t) => {
  const vocabulaire = vocabulaireDEssai(t);
  const r = python(`
libelle = T.libelle_protege('codex', VOCABULAIRE)
try:
    T.libelle_protege('leurre-codex', VOCABULAIRE)
    refus = None
except ValueError as e:
    refus = str(e)
print(json.dumps({'libelle': libelle, 'pose': T.mot_cle(db, libelle), 'ecriture': T.mot_cle(db, 'codex'), 'absent': T.libelle_protege('race-hybride', VOCABULAIRE),
                  'refus': refus, 'sans_vocabulaire': T.libelle_protege('codex', os.path.join(os.path.dirname(VOCABULAIRE), 'absent.sql'))}))`, vocabulaire);
  const codex = idsProteges().codex;
  assert.equal(r.libelle, 'Essai codex');
  assert.equal(r.pose, codex, 'le libellé courant mène au protégé');
  assert.equal(r.ecriture, LEURRE + codex, 'l’écriture d’origine mène au mot-clé qui l’a prise : c’est pourquoi l’importeur pose par id');
  assert.equal(r.absent, null, 'un protégé absent du vocabulaire n’est pas écrit (un import ne crée jamais de mot-clé)');
  assert.equal(r.sans_vocabulaire, null);
  assert.ok(r.refus, 'une clé non protégée est refusée');
});

test('maverick.py#libelle_protege : un protégé qui a des homonymes s’écrit par sa clé (0113)', { skip: sansPython }, (t) => {
  const fichier = join(dossierTemporaire('mots-cles-proteges-homonymes-', { t }), 'mot_cle.sql');
  const race = idsProteges().race;
  writeFileSync(fichier, `INSERT INTO mot_cle (id, libelle, cle) VALUES (${race}, 'Race', 'race-regles');\nINSERT INTO mot_cle (id, libelle, cle) VALUES (${LEURRE}, 'Race', 'race-magie');\n`);
  const r = python(`print(json.dumps({'ecriture': T.libelle_protege('race', VOCABULAIRE)}))`, fichier);
  assert.equal(r.ecriture, 'race-regles', 'son libellé est ambigu : sa clé');
});

test('classes.py, relations-races.py, races.py et codex.py posent leurs mots-clés protégés par id, jamais sur le mot-clé qui a pris leur écriture', { skip: sansPython }, (t) => {
  const vocabulaire = vocabulaireDEssai(t);
  const out = dossierTemporaire('mots-cles-proteges-out-', { t });
  for (const famille of ['classes', 'capacites', 'ressources']) mkdirSync(join(out, famille), { recursive: true });
  const classeurs = join(racine, 'sources/raw/classeurs');
  const lancer = (script, ...args) => {
    const p = spawnSync('python3', ['-I', join(racine, script), ...args, '--out', out, '--vocabulaire', vocabulaire], { encoding: 'utf8' });
    assert.equal(p.status, 0, `${script} : ${p.stderr || p.stdout}`);
  };
  lancer('tools/sheets/classes.py', '--dump', join(classeurs, 'classe-maverick-v7.json'), '--sans-liens');
  lancer('tools/sheets/relations-races.py', '--dump', join(classeurs, 'les-races.json'));
  lancer('tools/docs/codex.py', '--historique', join(out, 'sans-historique.sql'));
  const poses = posesParPage(out, ['classes', 'capacites', 'lore'], vocabulaire);
  const categories = new Set(Object.values(MOT_CLE_DE_CATEGORIE));
  const pages = Object.entries(poses);
  assert.ok(pages.some(([p]) => p.startsWith('classes/')) && pages.some(([p]) => p.startsWith('capacites/')) && pages.some(([p]) => p.startsWith('lore/')));
  for (const [page, ids] of pages) {
    assert.ok(!ids.some((i) => i.startsWith('leurre-')), `${page} : ${ids} (un mot-clé qui a pris l’écriture d’un protégé)`);
    if (page.startsWith('classes/')) {
      assert.equal(ids[0], 'classe', page);
      assert.ok(ids.length === 2 && categories.has(ids[1]), `${page} : ${ids} (la catégorie de la classe)`);
    } else if (page.startsWith('capacites/')) assert.deepEqual(ids, ['capacite-de-classe'], page);
    else if (page === 'lore/relations-entre-les-races') assert.deepEqual(ids, ['race'], page);
    else assert.deepEqual(ids, ['codex'], page);
  }
  // races.py (son dump de l'index n'a pas d'instantané) : le `tags:` d'une page de race
  const races = python(`
import importlib.util
spec = importlib.util.spec_from_file_location('races', ${JSON.stringify(join(racine, 'tools/sheets/races.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.VOCABULAIRE = VOCABULAIRE
print(json.dumps([i for _, i in T.mots_cles_poses(db, m.tags_of_race())[0]]))`, vocabulaire);
  assert.deepEqual(races, [idsProteges().race]);
});
