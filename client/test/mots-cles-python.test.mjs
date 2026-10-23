// Le mot-clé d'un libellé côté importeurs (tools/db/maverick.py#mot_cle, db:sync-pages, Famille.page) : le site de dev est la source du vocabulaire
// (historique_modification) — une écriture qu'un mot-clé a quittée (renommé) mène à lui, celle d'un mot-clé fusionné au mot-clé qui l'a reçu, celle d'un
// mot-clé supprimé ne revient pas ; et un import ne crée jamais de mot-clé (migration 0056 : le vocabulaire, devenu un glossaire, est celui du site de
// dev) : une écriture inconnue n'est pas posée, poser_les_mots_cles la rend pour que db:sync-pages la signale.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

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
