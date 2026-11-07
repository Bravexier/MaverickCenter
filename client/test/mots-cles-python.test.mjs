// Le mot-clé d'un libellé côté importeurs (tools/db/maverick.py#mot_cle, db:sync-pages, Famille.page) : le site de dev est la source du vocabulaire
// (historique_modification) — une écriture qu'un mot-clé a quittée (renommé) mène à lui, celle d'un mot-clé fusionné au mot-clé qui l'a reçu, celle d'un
// mot-clé supprimé ne revient pas ; et un import ne crée jamais de mot-clé (migration 0056 : le vocabulaire, devenu un glossaire, est celui du site de
// dev) : une écriture inconnue n'est pas posée, poser_les_mots_cles la rend pour que db:sync-pages la signale.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MOT_CLE_DE_CATEGORIE } from '../src/lib/classe-champs.mjs';
import { MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;

test('maverick.py#mot_cle et poser_les_mots_cles suivent ce que le site a fait du vocabulaire, sans jamais créer de mot-clé', { skip: sansPython }, () => {
  const script = `
import json, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
db = sqlite3.connect(':memory:')
db.executescript("""
CREATE TABLE mot_cle (id TEXT PRIMARY KEY, libelle TEXT, libelle_cle TEXT UNIQUE);
CREATE TABLE page_tag (page_id TEXT, ordre INTEGER, tag_id TEXT, PRIMARY KEY (page_id, ordre), UNIQUE (page_id, tag_id));
CREATE TABLE historique_modification (lot_id TEXT, rang INTEGER, fait_le TEXT, table_nom TEXT, cle TEXT, operation TEXT, avant TEXT, apres TEXT);
INSERT INTO mot_cle VALUES ('civilisation', 'Civilisations', 'civilisations'), ('guide', 'guide', 'guide');
""")
h = lambda lot, rang, table, cle, op, avant, apres: db.execute('INSERT INTO historique_modification VALUES (?,?,?,?,?,?,?,?)',
    (lot, rang, '2026-10-14T10:00:0' + str(rang) + 'Z', table, json.dumps(cle), op, avant and json.dumps(avant), apres and json.dumps(apres)))
h('l1', 1, 'mot_cle', {'id': 'civilisation'}, 'modifier', {'libelle': 'civilisation'}, {'libelle': 'Civilisations'})
h('l2', 2, 'page_tag', {'page_id': 'lore/x', 'ordre': 1}, 'supprimer', {'page_id': 'lore/x', 'ordre': 1, 'tag_id': 'mrode'}, None)
h('l2', 3, 'mot_cle', {'id': 'mrode'}, 'supprimer', {'id': 'mrode', 'libelle': 'mrode', 'libelle_cle': 'mrode'}, None)
h('l3', 4, 'page_tag', {'page_id': 'lore/y', 'ordre': 2}, 'modifier', {'tag_id': 'aide'}, {'tag_id': 'guide'})
h('l3', 5, 'mot_cle', {'id': 'aide'}, 'supprimer', {'id': 'aide', 'libelle': 'aide', 'libelle_cle': 'aide'}, None)
h('l4', 6, 'mot_cle', {'id': 'essai'}, 'inserer', None, {'id': 'essai', 'libelle': 'Essai', 'libelle_cle': 'essai'})
h('l4', 7, 'mot_cle', {'id': 'essai'}, 'modifier', {'libelle': 'Essai'}, {'libelle': 'Épreuve'})
h('l5', 8, 'mot_cle', {'id': 'epreuve'}, 'inserer', None, {'id': 'epreuve', 'libelle': 'x', 'libelle_cle': 'x'})
h('l5', 9, 'mot_cle', {'id': 'epreuve'}, 'supprimer', {'id': 'epreuve', 'libelle': 'x', 'libelle_cle': 'x'}, None)
r = {l: T.mot_cle(db, l) for l in ['civilisation', 'Civilisations', 'mrode', 'aide', 'nouveau']}
r['Épreuve (id employé)'] = T.mot_cle(db, 'Épreuve')
r['inconnues'] = T.poser_les_mots_cles(db, 'lore/z', ['civilisation', 'mrode', 'Civilisations', 'aide', 'nouveau', 'guide'])
r['page_tag'] = db.execute("SELECT ordre, tag_id FROM page_tag WHERE page_id = 'lore/z' ORDER BY ordre").fetchall()
r['vocabulaire'] = db.execute("SELECT id FROM mot_cle ORDER BY id").fetchall()
print(json.dumps(r))
`;
  const p = spawnSync('python3', ['-I', '-c', script], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const r = JSON.parse(p.stdout);
  assert.equal(r.civilisation, 'civilisation', 'une écriture quittée mène au mot-clé renommé (pas de « civilisation-2 »)');
  assert.equal(r.Civilisations, 'civilisation');
  assert.equal(r.mrode, null, 'un mot-clé supprimé sur le site ne revient pas');
  assert.equal(r.aide, 'guide', 'un mot-clé fusionné mène au mot-clé qui l’a reçu');
  assert.equal(r.nouveau, null, 'une écriture inconnue du vocabulaire ne crée pas de mot-clé (migration 0056)');
  assert.equal(r['Épreuve (id employé)'], null, 'ni l’écriture d’un mot-clé absent du vocabulaire (créé puis renommé sur le site) : rien n’est recréé');
  assert.deepEqual(r.page_tag, [[0, 'civilisation'], [3, 'guide']], 'ni le supprimé, ni l’inconnu, ni deux fois le même ; l’ordre garde sa place');
  assert.deepEqual(r.inconnues, ['mrode', 'nouveau'], 'les écritures non posées sont rendues, pour être signalées');
  assert.deepEqual(r.vocabulaire, [['civilisation'], ['guide']], 'le vocabulaire n’a pas bougé');
});

// Les mots-clés protégés (lib/mots-cles.mjs#MOTS_CLES_PROTEGES, par id ; décision R195 : le site les reconnaît à leur id) : un importeur les pose par
// leur id, jamais par leur écriture. Il écrit dans `tags:` le libellé courant du mot-clé de cet id (maverick.py#libelle_protege, codex.py
// Vocabulaire.protege), qui ne mène qu'à lui (libelle_cle unique) : un autre mot-clé qui a pris l'écriture d'origine d'un protégé (« codex »,
// « classe », « race »…) ne reçoit pas ses pages. Vocabulaire d'essai : chaque protégé renommé « Essai <id> », et un leurre `leurre-<id>` qui porte
// l'écriture <id> (le cas que la recherche par écriture faisait mal).
const racine = fileURLToPath(new URL('../../', import.meta.url));

function vocabulaireDEssai(t) {
  const fichier = join(dossierTemporaire('mots-cles-proteges-', { t }), 'mot_cle.sql');
  const lignes = [...MOTS_CLES_PROTEGES.keys()].filter((id) => id !== 'race-hybride').flatMap((id) => [
    `INSERT INTO mot_cle (id, libelle, libelle_cle) VALUES ('${id}', 'Essai ${id}', 'essai-${id}');`,
    `INSERT INTO mot_cle (id, libelle, libelle_cle) VALUES ('leurre-${id}', '${id}', '${id}');`,
  ]);
  writeFileSync(fichier, `${lignes.join('\n')}\n`);
  return fichier;
}

/** Lance un script Python (`python3 -I -c`) qui a `maverick as T` et `db` (le vocabulaire `vocabulaire` chargé), et rend son JSON. */
function python(script, vocabulaire) {
  const p = spawnSync('python3', ['-I', '-c', `
import json, os, re, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
VOCABULAIRE = ${JSON.stringify(vocabulaire ?? '')}
db = sqlite3.connect(':memory:')
db.execute(re.search(r'CREATE TABLE mot_cle \\([\\s\\S]*?\\) STRICT;', open(T.SCHEMA, encoding='utf-8').read()).group(0))
if VOCABULAIRE:
    db.executescript(open(VOCABULAIRE, encoding='utf-8').read())
${script}`], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout);
}

/** Les mots-clés que db:sync-pages poserait pour le `tags:` de chaque page .md de `dossier/famille` : { 'famille/slug': [ids] }. */
function posesParPage(dossier, familles, vocabulaire) {
  const pages = {};
  for (const famille of familles) {
    for (const f of readdirSync(join(dossier, famille)).filter((n) => n.endsWith('.md'))) {
      pages[`${famille}/${f.slice(0, -3)}`] = JSON.parse(/^tags: (.*)$/m.exec(readFileSync(join(dossier, famille, f), 'utf8'))[1]);
    }
  }
  return python(`print(json.dumps({p: [i for _, i in T.mots_cles_poses(db, e)[0]] for p, e in ${JSON.stringify(pages)}.items()}))`, vocabulaire);
}

test('maverick.py#MOTS_CLES_PROTEGES recopie les ids de lib/mots-cles.mjs#MOTS_CLES_PROTEGES', { skip: sansPython }, () => {
  assert.deepEqual(python('print(json.dumps(sorted(T.MOTS_CLES_PROTEGES)))'), [...MOTS_CLES_PROTEGES.keys()].sort());
});

test('maverick.py#libelle_protege : le libellé courant de l’id, qui mène à lui et pas au mot-clé qui a pris son écriture d’origine', { skip: sansPython }, (t) => {
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
  assert.equal(r.libelle, 'Essai codex');
  assert.equal(r.pose, 'codex', 'le libellé courant mène au protégé');
  assert.equal(r.ecriture, 'leurre-codex', 'l’écriture d’origine mène au mot-clé qui l’a prise : c’est pourquoi l’importeur pose par id');
  assert.equal(r.absent, null, 'un protégé absent du vocabulaire n’est pas écrit (un import ne crée jamais de mot-clé)');
  assert.equal(r.sans_vocabulaire, null);
  assert.ok(r.refus, 'un id non protégé est refusé');
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
  assert.deepEqual(races, ['race']);
});
