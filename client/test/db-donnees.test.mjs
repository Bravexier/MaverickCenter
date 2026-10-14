// Remplissage de la base : data/rows (lignes versionnées, une instruction INSERT par ligne) -> var/maverick.db, par un script sans IA.
//   npm run db:build        schéma + lignes + tables dérivées (liens, plein texte)
//   npm run db:check        contrôles d'intégrité que SQLite ne sait pas exprimer
//   npm run db:pages-check  les pages de data/rows sont celles des .md ;  npm run db:sync-pages  les remet à jour
// Ces tests construisent la base dans un dossier temporaire et ne touchent ni data/rows ni var/.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { ORDRE_DES_RACES } from '../src/lib/race-kinds.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const client = fileURLToPath(new URL('../', import.meta.url));
const rows = join(racine, 'data', 'rows');
// numéro de version du schéma, lu dans data/schema.sql (un changement de version ne doit pas obliger à retoucher ce test)
const versionSchema = Number(/PRAGMA user_version = (\d+)/.exec(readFileSync(join(racine, 'data', 'schema.sql'), 'utf8'))[1]);
const wiki = join(client, 'src', 'content', 'wiki');
const node = (script, args = []) => spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', script), ...args], { encoding: 'utf8' });
const pages = (...args) => spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'pages_md.py'), ...args], { encoding: 'utf8' });
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const dir = mkdtempSync(join(tmpdir(), 'db-donnees-'));

const fichiersMd = (type) => readdirSync(join(wiki, type)).filter((f) => f.endsWith('.md')).length;
const nbPagesMd = readdirSync(wiki).reduce((n, type) => n + fichiersMd(type), 0);

const base = join(dir, 'maverick.db');
const build = node('db-build.mjs', ['--out', base]);
const derive = build.status === 0 ? node('db-derive.mjs', [base]) : build;

test('db:build construit la base depuis data/rows (schéma, lignes, clés étrangères) puis db:derive calcule liens et plein texte', () => {
  assert.equal(build.status, 0, build.stderr);
  const bilan = JSON.parse(build.stdout);
  assert.equal(bilan.version, versionSchema);
  assert.ok(bilan.tables >= 133, `tables chargées : ${bilan.tables}`);
  assert.deepEqual(bilan.clesToleres, [], 'aucune clé étrangère tolérée : la base est complète');
  assert.equal(derive.status, 0, derive.stderr);
  const d = JSON.parse(derive.stdout);
  assert.equal(d.pages, nbPagesMd, 'une ligne de page par fichier .md');
  assert.equal(d.pageFts, nbPagesMd, 'une ligne de plein texte par page');
  assert.deepEqual([d.liens.introuvable, d.liens.ambigu], [0, 0], '[[liens]] tous résolus (comme le build du site)');
});

test('la base contient les domaines : pages, magies et sorts, classes et capacités, races, bestiaire, équipement', () => {
  const db = new DatabaseSync(base, { readOnly: true });
  const n = (table) => db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
  const pagesDuType = (type) => db.prepare("SELECT count(*) AS n FROM page WHERE type = ? AND statut <> 'example'").get(type).n;
  assert.equal(n('page'), nbPagesMd);
  assert.equal(n('type_page'), 10);
  // effectifs de l'import : le site de dev, source des données qu'il modifie, peut créer des races, des classes… (lib/historique-site.mjs)
  const historique = historiqueSite(db);
  for (const [table, effectif] of [['magie', 15], ['sort', 322], ['classe', 39], ['capacite', 660], ['race', 27], ['invocation', 3], ['creature', 63]]) {
    assert.equal(historique.effectifDImport(table), effectif, `${table} : effectif de l'import`);
  }
  // cohérence de l'état courant
  assert.equal(n('capacite'), fichiersMd('capacites'), 'une ligne capacite par page capacites/*.md');
  assert.equal(n('classe'), pagesDuType('classes'), 'une ligne classe par page de classe');
  assert.equal(n('race'), pagesDuType('races'), 'une ligne race par page de race');
  assert.equal(n('race_onglet'), n('race'), 'chaque race a son onglet');
  assert.equal(n('magie'), pagesDuType('magies'), 'une ligne magie par page de magie');
  // décision R1 (27 races et non 23) : les 27 races de la liste du propriétaire sont là ; une race créée depuis le site ne la contredit pas
  assert.equal(ORDRE_DES_RACES.length, 27);
  const races = new Set(db.prepare('SELECT id FROM race').all().map((r) => r.id));
  for (const id of ORDRE_DES_RACES) assert.ok(races.has(id), `décision R1 : ${id}`);
  for (const t of ['ressource', 'recette', 'arme', 'armure', 'metier', 'etat', 'peuple', 'note_cellule', 'ecart_source']) assert.ok(n(t) > 0, `${t} est rempli`);
  assert.equal(n('correction'), 1, 'la correction du Mercenaire est tracée');
  // la correction orthographique est bien dans les lignes typées, l'ancien texte n'y est plus (sauf si le site de dev a supprimé le don qui la portait :
  // D11, db:check l'ignore alors)
  if (!historique.supprimee('capacite', { id: 'capacites/mercenaire-chasseur-de-primes' })) assert.ok(db.prepare("SELECT 1 FROM classe WHERE nom LIKE '%Chasseur de primes%' OR id LIKE '%chasseur-de-primes%' LIMIT 1").get() || db.prepare("SELECT 1 FROM capacite WHERE id LIKE '%chasseur-de-primes%' LIMIT 1").get());
  assert.equal(db.prepare("SELECT count(*) AS n FROM capacite WHERE id LIKE '%chasseur-prime%'").get().n, 0);
  db.close();
});

test('db:check : aucun problème sur la base construite', () => {
  const r = node('db-check.mjs', [base]);
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.deepEqual(v.problemes, []);
  assert.ok(v.bilan.page_entite_cibles > 3000);
});

test('db:check détecte un défaut injecté (une entité typée qui n’a plus sa ligne page_entite)', () => {
  const copie = join(dir, 'defaut.db');
  cpSync(base, copie);
  const db = new DatabaseSync(copie);
  db.exec("DELETE FROM page_entite WHERE entite_table = 'invocation' AND entite_id = 'bestiaire/animation-des-morts'");
  db.close();
  const r = node('db-check.mjs', [copie]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /page_entite : invocation:bestiaire\/animation-des-morts manque/);
});

test('db:build refuse un jeu de lignes incomplet ou d’une autre version', () => {
  const copie = join(dir, 'rows-casse');
  cpSync(rows, copie, { recursive: true });
  writeFileSync(join(copie, 'VERSION'), `schema_version=${versionSchema + 1}\n`);
  const autreVersion = node('db-build.mjs', ['--out', join(dir, 'x.db'), '--rows', copie]);
  assert.equal(autreVersion.status, 1);
  assert.match(autreVersion.stderr, /version/);
  writeFileSync(join(copie, 'VERSION'), `schema_version=${versionSchema}\n`);
  writeFileSync(join(copie, 'zzz.sql'), '-- en trop\n');
  const enTrop = node('db-build.mjs', ['--out', join(dir, 'y.db'), '--rows', copie]);
  assert.equal(enTrop.status, 1);
  assert.match(enTrop.stderr, /ne correspond pas au schéma/);
});

test('Python reconstruit la même base : lignes -> base -> export = data/rows octet pour octet', { skip: sansPython }, () => {
  const sortie = join(dir, 'export');
  mkdirSync(sortie);
  const py = `
import os, sys
sys.path.insert(0, sys.argv[1])
import maverick as T
db = T.reconstruire(':memory:', sys.argv[2])
T.exporter(db, sys.argv[3])
`;
  const r = spawnSync('python3', ['-I', '-c', py, join(racine, 'tools', 'db'), rows, sortie], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const noms = readdirSync(rows).sort();
  assert.deepEqual(readdirSync(sortie).sort(), noms, 'mêmes fichiers');
  const differents = noms.filter((f) => readFileSync(join(rows, f), 'utf8') !== readFileSync(join(sortie, f), 'utf8'));
  assert.deepEqual(differents, [], 'export déterministe : relire et réécrire ne change aucun octet');
});

test('db:pages-check : les pages de data/rows sont celles des .md (sinon : npm run db:sync-pages)', { skip: sansPython }, () => {
  const r = pages('check');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /est à jour/);
});

test('db:sync-pages : une page modifiée est détectée puis remise à jour sans toucher aux lignes typées ; une page ajoutée est refusée', { skip: sansPython }, () => {
  const copieWiki = join(dir, 'wiki');
  const copieRows = join(dir, 'rows-sync');
  cpSync(wiki, copieWiki, { recursive: true });
  cpSync(rows, copieRows, { recursive: true });
  const args = ['--rows', copieRows, '--wiki', copieWiki];

  const page = join(copieWiki, 'magies', 'magie-de-la-lumiere.md');
  writeFileSync(page, readFileSync(page, 'utf8').replace(/\n$/, '\n\nUne ligne ajoutée pour le test.\n'));
  const perime = pages('check', ...args);
  assert.equal(perime.status, 1);
  assert.match(perime.stdout, /1 page\(s\) différente\(s\)/);
  assert.match(perime.stdout, /magies\/magie-de-la-lumiere/);

  const sync = pages('sync', ...args);
  assert.equal(sync.status, 0, sync.stdout + sync.stderr);
  assert.match(sync.stdout, /1 page\(s\) mise\(s\) à jour/);
  assert.equal(pages('check', ...args).status, 0, 'à jour après la synchronisation');
  const touches = readdirSync(rows).filter((f) => readFileSync(join(rows, f), 'utf8') !== readFileSync(join(copieRows, f), 'utf8'));
  assert.deepEqual(touches, ['page.sql'], 'seul le contenu de la page change : ni les magies, ni les sorts, ni page_entite');
  assert.match(readFileSync(join(copieRows, 'page.sql'), 'utf8'), /Une ligne ajoutée pour le test\./);
  assert.equal(pages('sync', ...args).stdout.includes('déjà à jour'), true, 'idempotent : rien à faire la seconde fois');

  cpSync(page, join(copieWiki, 'magies', 'magie-fantome.md'));
  const ajout = pages('sync', ...args);
  assert.equal(ajout.status, 1);
  assert.match(ajout.stdout, /importeur de leur famille/);
  assert.ok(existsSync(join(copieWiki, 'magies', 'magie-fantome.md')));
});

test('db:sync-pages : une page « docs » ajoutée à la main entre dans la base, et son retrait remet data/rows exactement comme avant ; un sort ou une capacité ne se crée pas ainsi', { skip: sansPython }, () => {
  const copieWiki = join(dir, 'wiki-ajout');
  const copieRows = join(dir, 'rows-ajout');
  cpSync(wiki, copieWiki, { recursive: true });
  cpSync(rows, copieRows, { recursive: true });
  const args = ['--rows', copieRows, '--wiki', copieWiki];
  const nouvelle = join(copieWiki, 'guide', 'page-ajoutee-a-la-main.md');
  writeFileSync(nouvelle, '---\ntitle: "Page ajoutée à la main"\naliases: ["Alias de test"]\ntags: ["test"]\nsummary: "Un résumé."\nsources: ["Google Doc « Test »"]\nstatus: draft\n---\n\nCorps de la page.\n');

  const ajout = pages('sync', ...args);
  assert.equal(ajout.status, 0, ajout.stdout + ajout.stderr);
  assert.match(ajout.stdout, /1 page\(s\) mise\(s\) à jour/);
  assert.equal(pages('check', ...args).status, 0);
  assert.match(readFileSync(join(copieRows, 'page.sql'), 'utf8'), /guide\/page-ajoutee-a-la-main/);
  assert.match(readFileSync(join(copieRows, 'alias.sql'), 'utf8'), /Alias de test/);

  rmSync(nouvelle);
  const retrait = pages('sync', ...args);
  assert.equal(retrait.status, 0, retrait.stdout + retrait.stderr);
  const touches = readdirSync(rows).filter((f) => readFileSync(join(rows, f), 'utf8') !== readFileSync(join(copieRows, f), 'utf8'));
  // seul le vocabulaire garde une trace : le mot-clé « test », créé avec la page, y reste (aucun import ne supprime un mot-clé : migration 0043)
  assert.deepEqual(touches, ['mot_cle.sql'], 'ajout puis retrait : data/rows est revenu à l’identique (alias, mot-clé posé et source de la page retirés avec elle)');
  assert.match(readFileSync(join(copieRows, 'mot_cle.sql'), 'utf8'), /VALUES \('test', 'test', 'test'\);/);

  // une page de la famille « classes » (importeur typé) ne se crée pas à la main
  const capacite = readdirSync(join(copieWiki, 'capacites'))[0];
  cpSync(join(copieWiki, 'capacites', capacite), join(copieWiki, 'capacites', 'capacite-fantome.md'));
  const refus = pages('sync', ...args);
  assert.equal(refus.status, 1);
  assert.match(refus.stdout, /importeur de leur famille/);
});
