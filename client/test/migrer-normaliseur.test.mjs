// Le normaliseur de SQL de la migration des lignes (tools/db/maverick.py#_normaliser_sql, comparer_schemas : npm run db:migrate) : un commentaire
// « -- » n'est retiré que hors d'une chaîne. Avant la migration 0056, le « '*--*' » des CHECK de clés était pris pour un commentaire : la fin de sa
// ligne disparaissait (virgule comprise), si bien qu'une colonne ajoutée par ALTER TABLE, dont SQLite écrit la virgule sur la ligne suivante, ne se
// comparait plus au schéma attendu, et qu'un écart réel écrit après « '*--*' » sur la même ligne ne se voyait pas. (Le texte des chaînes est mis en
// minuscules comme le reste : c'était déjà le cas, et les deux côtés comparés le sont de même.)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const outils = fileURLToPath(new URL('../../tools/db/', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;

test('maverick.py#_normaliser_sql : les commentaires hors des chaînes seulement ; comparer_schemas voit une colonne ajoutée après une ligne « \'*--*\' »', { skip: sansPython }, () => {
  const script = `
import json, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(outils)})
import maverick as T
n = T._normaliser_sql
r = {}
# 1. une chaîne qui contient « -- » et une apostrophe doublée
r['chaine'] = n("CREATE TABLE t (x TEXT CHECK (x <> 'a--b''c'), y TEXT)")
# 2. un commentaire qui contient une apostrophe, puis une chaîne : le commentaire part entier, la chaîne reste
r['apostrophe'] = [n("CREATE TABLE t (\\n  a TEXT, -- l'écriture d'origine\\n  b TEXT CHECK (b <> 'x')\\n)"), n("CREATE TABLE t (a TEXT, b TEXT CHECK (b <> 'x'))")]
# 3. un commentaire en fin de ligne, après une chaîne
r['fin'] = [n("CREATE TABLE t (a TEXT CHECK (a <> 'q'), -- la fin\\n  b TEXT)"), n("CREATE TABLE t (a TEXT CHECK (a <> 'q'), b TEXT)")]
# 4. une chaîne sur deux lignes, dont la seconde commence par « -- »
r['deux_lignes'] = n("CREATE TABLE t (a TEXT DEFAULT 'ligne 1\\n-- pas un commentaire', b TEXT)")
# 5. une chaîne vide, suivie d'un commentaire
r['vide'] = [n("CREATE TABLE t (a TEXT NOT NULL DEFAULT '', -- note\\n  b TEXT)"), n("CREATE TABLE t (a TEXT NOT NULL DEFAULT '', b TEXT)")]
# 6. ALTER TABLE ... ADD COLUMN après une ligne « '*--*' » (comme mot_cle.description, migration 0056) : la base migrée et le schéma attendu
#    (la virgule au bout de la ligne « '*--*' », la colonne en dernier) ne diffèrent pas
cle = "CHECK (length(c) > 0 AND c NOT GLOB '*--*' AND c NOT GLOB '-*')"
migree = sqlite3.connect(':memory:')
migree.executescript(f"CREATE TABLE m (\\n  id TEXT NOT NULL PRIMARY KEY,\\n  c TEXT NOT NULL UNIQUE {cle}\\n      -- normalize(libelle)\\n) STRICT;")
migree.execute("ALTER TABLE m ADD COLUMN d TEXT CHECK (d IS NULL OR length(d) > 0)")
attendu = sqlite3.connect(':memory:')
attendu.executescript(f"CREATE TABLE m (\\n  id TEXT NOT NULL PRIMARY KEY,\\n  c TEXT NOT NULL UNIQUE {cle},\\n      -- normalize(libelle)\\n  d TEXT CHECK (d IS NULL OR length(d) > 0)   -- ajoutée en dernier\\n) STRICT;")
r['alter'] = T.comparer_schemas(migree, attendu)
# 7. et un vrai écart écrit après « '*--*' » sur la même ligne se voit (avant 0056, il disparaissait avec la fin de la ligne : les deux textes
#    étaient égaux une fois normalisés, et PRAGMA table_xinfo ne donne pas la collation)
autre = sqlite3.connect(':memory:')
autre.executescript(f"CREATE TABLE m (\\n  id TEXT NOT NULL PRIMARY KEY,\\n  c TEXT NOT NULL UNIQUE {cle} COLLATE NOCASE,\\n      -- normalize(libelle)\\n  d TEXT CHECK (d IS NULL OR length(d) > 0)   -- ajoutée en dernier\\n) STRICT;")
r['ecart'] = T.comparer_schemas(attendu, autre)
print(json.dumps(r, ensure_ascii=False))
`;
  const p = spawnSync('python3', ['-I', '-c', script], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const r = JSON.parse(p.stdout);
  assert.ok(r.chaine.includes("'a--b''c'"), r.chaine);
  assert.ok(r.chaine.endsWith(',y text)'), `la suite de la ligne reste : ${r.chaine}`);
  assert.equal(r.apostrophe[0], r.apostrophe[1], 'un commentaire qui contient une apostrophe n’ouvre pas de chaîne');
  assert.equal(r.fin[0], r.fin[1], 'commentaire après une chaîne : retiré');
  assert.ok(r.deux_lignes.includes("'ligne 1 -- pas un commentaire'"), r.deux_lignes);
  assert.ok(r.deux_lignes.endsWith(',b text)'), r.deux_lignes);
  assert.equal(r.vide[0], r.vide[1], 'chaîne vide puis commentaire');
  assert.ok(r.vide[0].includes("default ''"), r.vide[0]);
  assert.deepEqual(r.alter, [], 'la colonne ajoutée par ALTER TABLE se compare au schéma attendu');
  assert.ok(r.ecart.some((e) => e.startsWith('table m : définition différente')), JSON.stringify(r.ecart));
});
