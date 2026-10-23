// Structure de la base : data/schema.sql est exécuté sur une base VIERGE, par Node (node:sqlite) et par Python (sqlite3), et ses invariants sont
// vérifiés : tables STRICT, clés étrangères qui visent une clé unique, noms conformes aux conventions, vues interrogeables.
// Le document docs/sql/structure.md est généré depuis le schéma (`npm run db:doc`) et doit rester à jour ; `npm run db:init` crée la base vide.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const client = fileURLToPath(new URL('../', import.meta.url));
const schemaChemin = join(racine, 'data', 'schema.sql');
const schema = readFileSync(schemaChemin, 'utf8');
const versionSchema = Number(/PRAGMA user_version = (\d+)/.exec(schema)[1]);
const node = (script, args = []) => spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', script), ...args], { encoding: 'utf8' });

function baseVierge() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(schema);
  return db;
}
const db = baseVierge();
const liste = db.prepare('PRAGMA table_list').all().filter((t) => !t.name.startsWith('sqlite_'));
const tables = liste.filter((t) => t.type === 'table');       // tables réelles : ni vues, ni tables virtuelles (FTS5), ni tables d'ombre
const vues = liste.filter((t) => t.type === 'view');
const colonnes = (nom) => db.prepare(`PRAGMA table_info("${nom}")`).all();

test('le schéma s’exécute sur une base vierge, avec sa version, ses tables et ses vues', () => {
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, versionSchema, 'version du schéma (data/rows/VERSION porte la même)');
  assert.ok(tables.length >= 136, `au moins 136 tables (trouvé ${tables.length})`);
  assert.ok(vues.length >= 29, `au moins 29 vues (trouvé ${vues.length})`);
  for (const attendu of ['page', 'magie', 'sort', 'classe', 'capacite', 'race', 'creature', 'arme', 'note_cellule', 'ecart_source', 'correction', 'famille']) {
    assert.ok(tables.some((t) => t.name === attendu), `table « ${attendu} » attendue`);
  }
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map((l) => l.integrity_check), ['ok']);
});

test('toute table réelle est STRICT et a une clé primaire', () => {
  const ratees = tables.filter((t) => !t.strict).map((t) => t.name);
  assert.deepEqual(ratees, [], 'tables sans STRICT (le type d’une colonne ne serait pas imposé)');
  const sansCle = tables.filter((t) => !colonnes(t.name).some((c) => c.pk)).map((t) => t.name);
  assert.deepEqual(sansCle, [], 'tables sans clé primaire');
});

test('toute clé étrangère vise une table existante et une clé primaire ou unique (sinon SQLite refuse toute écriture)', () => {
  const problemes = [];
  for (const { name } of tables) {
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${name}")`).all()) {
      const cible = tables.find((t) => t.name === fk.table);
      if (!cible) { problemes.push(`${name}.${fk.from} → table « ${fk.table} » inexistante`); continue; }
      const cols = colonnes(fk.table);
      const pk = cols.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
      const voulues = fk.to ? [fk.to] : pk;
      if (!voulues.every((c) => cols.some((x) => x.name === c))) { problemes.push(`${name}.${fk.from} → ${fk.table}.${voulues.join(',')} : colonne inexistante`); continue; }
      // clé composée : toutes les colonnes de la clé étrangère doivent ensemble être uniques ; on ne contrôle ici que le cas à une colonne et la clé primaire entière
      const groupe = db.prepare(`PRAGMA foreign_key_list("${name}")`).all().filter((f) => f.id === fk.id).map((f) => f.to ?? pk[f.seq]);
      const unique = groupe.length === pk.length && pk.every((c) => groupe.includes(c))
        || db.prepare(`PRAGMA index_list("${fk.table}")`).all().some((i) => {
          if (!i.unique) return false;
          const ic = db.prepare(`PRAGMA index_info("${i.name}")`).all().map((x) => x.name);
          return ic.length === groupe.length && groupe.every((c) => ic.includes(c));
        });
      if (!unique) problemes.push(`${name}.${fk.from} → ${fk.table}.${groupe.join(',')} : pas une clé unique de la table cible`);
    }
  }
  assert.deepEqual(problemes, []);
});

test('les noms respectent les conventions : snake_case, ASCII, sans accent (tables, vues, colonnes)', () => {
  const motif = /^[a-z][a-z0-9_]*$/;
  const hors = [];
  for (const { name } of [...tables, ...vues]) {
    if (!motif.test(name)) hors.push(name);
    for (const c of colonnes(name)) if (!motif.test(c.name)) hors.push(`${name}.${c.name}`);
  }
  assert.deepEqual(hors, []);
});

test('chaque vue est interrogeable (sa requête est valide pour le schéma courant)', () => {
  for (const { name } of vues) assert.doesNotThrow(() => db.prepare(`SELECT * FROM "${name}" LIMIT 0`).all(), `vue ${name}`);
});

test('la clé étrangère est bien imposée : une page d’un type inconnu est refusée', () => {
  const d = baseVierge();
  assert.throws(
    () => d.prepare("INSERT INTO page (id, type, slug, titre, titre_cle, corps_md, statut, origine) VALUES ('zzz/x', 'zzz', 'x', 'X', 'x', 'a\n', 'draft', 'zzz')").run(),
    /FOREIGN KEY|CHECK|NOT NULL/i,
  );
});

test('Python (sqlite3) lit le même schéma que Node : mêmes objets, mêmes colonnes (portabilité des deux importeurs)', (t) => {
  const py = `
import json, sqlite3, sys
if sqlite3.sqlite_version_info < (3, 37, 0):
    print(json.dumps({"saute": "SQLite %s sans STRICT" % sqlite3.sqlite_version}))
    sys.exit(0)
db = sqlite3.connect(":memory:")
db.executescript(open(sys.argv[1], encoding="utf-8").read())
objets = db.execute("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('table','view') ORDER BY name").fetchall()
cols = {n: [[c[1], c[2], c[3], c[5]] for c in db.execute('PRAGMA table_info("%s")' % n)] for _, n in objets}
print(json.dumps({"objets": objets, "colonnes": cols}))
`;
  const r = spawnSync('python3', ['-I', '-c', py, schemaChemin], { encoding: 'utf8' });
  if (r.error) return t.skip('python3 absent');
  assert.equal(r.status, 0, r.stderr);
  const vu = JSON.parse(r.stdout);
  if (vu.saute) return t.skip(vu.saute);
  const nodeObjets = db.prepare("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('table','view') ORDER BY name").all().map((o) => [o.type, o.name]);
  assert.deepEqual(vu.objets, nodeObjets);
  for (const [genre, nom] of nodeObjets) {
    // types, obligation et clé comparés pour les tables ; pour une vue, seuls les noms : le type déclaré d'une colonne calculée dépend de la version de SQLite
    const attendu = colonnes(nom).map((c) => (genre === 'table' ? [c.name, c.type, c.notnull, c.pk] : [c.name]));
    assert.deepEqual(vu.colonnes[nom].map((c) => (genre === 'table' ? c : [c[0]])), attendu, `colonnes de ${nom}`);
  }
});

// Les commentaires du schéma (recopiés dans docs/sql par db:doc) citent du code du site : `chemin.mjs#Nom(.propriété)`, un fichier .mjs, .astro, .css
// (les outils Python cités, tools/…/*.py, ne sont pas contrôlés ici : tools/db/classes_maitrise.py, cité par les maîtrises de départ depuis le premier schéma, n'a jamais existé).
// Un renvoi périmé (la page Liens supprimée, livres.mjs#LIENS.rencontre devenu SOUS_BIENVENUE.rencontre, puis LIENS_ET_RENCONTRE.rencontre) passerait
// db:doc --check : la doc suit le schéma.
test('les commentaires du schéma ne citent que du code qui existe : fichiers, noms et propriétés (`fichier.mjs#Nom.prop`)', async () => {
  const commentaires = schema.split('\n').map((l) => (l.includes('--') ? l.slice(l.indexOf('--') + 2) : '')).join('\n');
  const trouver = (chemin) => ['', 'client/', 'client/src/', 'client/src/lib/'].map((b) => join(racine, b, chemin)).find((f) => existsSync(f));
  const fichiers = [...commentaires.matchAll(/(?:client|tools|lib|serveur|components|scripts|pages)\/[\w./[\]-]*\.(?:mjs|astro|css)\b/g)].map((m) => m[0]);
  assert.ok(fichiers.length > 10, 'le schéma cite des fichiers');
  for (const f of fichiers) assert.ok(trouver(f), `${f} : fichier cité introuvable`);
  const renvois = [...commentaires.matchAll(/([\w./-]+\.mjs)#([A-Za-z_]\w*)((?:\.\w+)*)/g)];
  assert.ok(renvois.length >= 9, 'le schéma cite des noms du code');
  for (const [cite, chemin, nom, proprietes] of renvois) {
    const fichier = trouver(chemin);
    assert.ok(fichier, `${cite} : fichier introuvable`);
    const texte = readFileSync(fichier, 'utf8');
    assert.match(texte, new RegExp(`(?:function\\*? |const |let |class )${nom}\\b|export \\{[^}]*\\b${nom}\\b`), `${cite} : ${nom} n’est pas défini dans le fichier`);
    if (proprietes) {
      assert.ok(fichier.includes(join('client', 'src', 'lib')), `${cite} : une propriété ne se vérifie que dans un module pur de lib/`);
      let valeur = (await import(fichier))[nom];
      for (const p of proprietes.slice(1).split('.')) {
        assert.ok(valeur != null && p in Object(valeur), `${cite} : ${p} absent`);
        valeur = valeur[p];
      }
    }
  }
});

test('docs/sql/structure.md et docs/sql/apercu.md sont ceux que le schéma produit (npm run db:doc)', () => {
  const r = node('db-doc.mjs', ['--check']);
  assert.equal(r.status, 0, r.stderr);
});

test('npm run db:init crée une base vide, refuse d’écraser sans --force, et ne laisse rien si le schéma est refusé', (t) => {
  const dir = dossierTemporaire('db-init', { t });
  const fichier = join(dir, 'maverick.db');
  const cree = node('db-init.mjs', ['--out', fichier]);
  assert.equal(cree.status, 0, cree.stderr);
  assert.match(cree.stdout, new RegExp(`schéma version ${versionSchema}, \\d+ tables`));
  const base = new DatabaseSync(fichier, { readOnly: true });
  assert.equal(base.prepare('SELECT count(*) AS n FROM page').get().n, 0, 'base vide');
  assert.equal(base.prepare('PRAGMA user_version').get().user_version, versionSchema);
  base.close();

  const refus = node('db-init.mjs', ['--out', fichier]);
  assert.equal(refus.status, 1);
  assert.match(refus.stderr, /--force/);
  assert.equal(node('db-init.mjs', ['--out', fichier, '--force']).status, 0);

  const casse = join(dir, 'casse.sql');
  writeFileSync(casse, 'CREATE TABLE a (id TEXT PRIMARY KEY) STRICT;\nCREATE TABLE b (x TEXT REFERENCES zzz(id)) STRICT;\nINSERT INTO a VALUES (1);\nCREATE TABLE ;');
  const sortieCassee = join(dir, 'casse.db');
  const echec = node('db-init.mjs', ['--out', sortieCassee, '--schema', casse]);
  assert.equal(echec.status, 1);
  assert.match(echec.stderr, /schéma refusé/);
  assert.equal(existsSync(sortieCassee), false, 'aucune base à moitié construite');
});
