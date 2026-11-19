// Remplissage de la base : data/rows (lignes versionnées, une instruction INSERT par ligne) -> var/maverick.db, par un script sans IA.
//   npm run db:build        schéma + lignes + tables dérivées (liens, plein texte)
//   npm run db:check        contrôles d'intégrité que SQLite ne sait pas exprimer
//   npm run db:pages-check  les pages de data/rows sont celles des .md ;  npm run db:sync-pages  les remet à jour
// Ces tests construisent la base dans un dossier temporaire et ne touchent ni data/rows ni var/.
// Lot 12 (R296) : db:build depuis data/rows et db:sync-pages sortent avec data/rows (docs/chantier-base-de-dev.md, « Retire le code de l'ancien circuit ») : leurs
// tests sont déclarés par testRetireAvecLeContenu (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LE_CONTENU), et ne tournent plus quand le contenu est sorti. Ce qui éprouve
// un outil qui reste (db:check, db:export-pages, db:pages-check) lit le contenu fourni (MAVERICK_CONTENU ; sans lui, la base construite de data/rows).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cheminBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { ORDRE_DES_RACES } from '../src/lib/race-kinds.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { horsDeLa0120, RACES_DE_LA_0120 } from './aide-races-0120.mjs';
import { registreDeMigration } from './aide-registres-sortis.mjs';
import { testRetireAvecLeContenu } from './aide-sortie-du-contenu.mjs';

const testDuDepot = testRetireAvecLeContenu(import.meta.url);

const racine = fileURLToPath(new URL('../../', import.meta.url));
const client = fileURLToPath(new URL('../', import.meta.url));
const rows = join(racine, 'data', 'rows');
// numéro de version du schéma, lu dans data/schema.sql (un changement de version ne doit pas obliger à retoucher ce test)
const versionSchema = Number(/PRAGMA user_version = (\d+)/.exec(readFileSync(join(racine, 'data', 'schema.sql'), 'utf8'))[1]);
// Les tests retirés avec data/rows portent sur le dépôt, quel que soit le contenu que lit le reste de la suite : l'environnement des processus lancés n'a pas
// MAVERICK_CONTENU (l'extrait du site de dev, que la CI pose pour tout le job : lib/contenu-fourni.mjs), et le wiki de comparaison est exporté de data/rows
// dans un dossier temporaire, jamais lu dans client/src/content/wiki (fabriqué depuis l'extrait sous la variable : il porte les pages que le site a modifiées).
const envDuDepot = { ...process.env };
delete envDuDepot.MAVERICK_CONTENU;
delete envDuDepot.MAVERICK_CONTENU_DERIVE;
const node = (script, args = [], env = envDuDepot) => spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', script), ...args], { encoding: 'utf8', env });
const pages = (...args) => spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'pages_md.py'), ...args], { encoding: 'utf8', env: envDuDepot });
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const dir = dossierTemporaire('db-donnees');
const unefois = (fabriquer) => { let r; return () => (r ??= fabriquer()); };
const nbFichiersMd = (wiki, type) => readdirSync(join(wiki, type)).filter((f) => f.endsWith('.md')).length;

// Le dépôt (tests retirés avec data/rows) : les .md que data/rows produit (db:export-pages sur data/rows), la référence de db:sync-pages ; la base que
// db:build en construit, puis db:derive. Faits à la première demande : rien n'est construit quand le contenu est sorti.
const surLeDepot = unefois(() => {
  const wiki = join(dir, 'wiki-de-data-rows');
  const exportDesPages = node('db-export-pages.mjs', ['--out', wiki]);
  if (exportDesPages.status !== 0) throw new Error(`db:export-pages sur data/rows a échoué : ${exportDesPages.stderr || exportDesPages.stdout}`);
  const nbPagesMd = readdirSync(wiki).reduce((n, type) => n + nbFichiersMd(wiki, type), 0);
  const base = join(dir, 'maverick.db');
  const build = node('db-build.mjs', ['--out', base]);
  const derive = build.status === 0 ? node('db-derive.mjs', [base]) : build;
  return { wiki, nbPagesMd, base, build, derive };
});

// Le contenu fourni (l'extrait du site de dev en CI ; sans MAVERICK_CONTENU, la base construite de data/rows) : sa base et ses pages exportées par db:export-pages.
const surLeContenu = unefois(() => {
  const wiki = join(dir, 'wiki-du-contenu');
  const exportDesPages = node('db-export-pages.mjs', ['--out', wiki], process.env);
  if (exportDesPages.status !== 0) throw new Error(`db:export-pages sur le contenu fourni a échoué : ${exportDesPages.stderr || exportDesPages.stdout}`);
  const nbPagesMd = readdirSync(wiki).reduce((n, type) => n + nbFichiersMd(wiki, type), 0);
  return { wiki, nbPagesMd, base: cheminBase({ sansExemples: false }) };
});

testDuDepot('db:build construit la base depuis data/rows (schéma, lignes, clés étrangères) puis db:derive calcule liens et plein texte', () => {
  const { build, derive, nbPagesMd } = surLeDepot();
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
  const { base, wiki, nbPagesMd } = surLeContenu();
  const fichiersMd = (type) => nbFichiersMd(wiki, type);
  const db = new DatabaseSync(base, { readOnly: true });
  const n = (table) => db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
  const pagesDuType = (type) => db.prepare("SELECT count(*) AS n FROM page WHERE type = ? AND statut <> 'example'").get(type).n;
  assert.equal(n('page'), nbPagesMd);
  assert.equal(n('type_page'), 10);
  // effectifs de l'import : le site de dev, source des données qu'il modifie, peut créer des races, des classes… (lib/historique-site.mjs)
  const historique = historiqueSite(db);
  // classes et dons : les comptes du registre de la migration 0119 (R238 : Boxeur et Porte-étendard, Cuirassé V2), qui les a écrits
  const comptes0119 = registreDeMigration('0119-classes-materiaux-d12').comptes;
  for (const [table, effectif] of [['magie', 15], ['sort', 420], ['magie_specialisation', 28], ['classe', comptes0119.classe], ['capacite', comptes0119.capacite],
    ['race', 27 + RACES_DE_LA_0120.size], ['invocation', 3], ['creature', 63]]) {
    assert.equal(historique.effectifDImport(table), effectif, `${table} : effectif de l'import`);
  }
  // cohérence de l'état courant
  assert.equal(n('capacite'), fichiersMd('capacites'), 'une ligne capacite par page capacites/*.md');
  assert.equal(n('classe'), pagesDuType('classes'), 'une ligne classe par page de classe');
  assert.equal(n('race'), pagesDuType('races'), 'une ligne race par page de race');
  assert.equal(n('race_onglet'), n('race'), 'chaque race a son onglet');
  assert.equal(n('magie'), pagesDuType('magies'), 'une ligne magie par page de magie');
  // décision R1 (27 races et non 23) : les 27 races de la liste du propriétaire sont là, plus Fongoïde et Gémidien (décision R239, migration 0120) ; une
  // race créée depuis le site ne la contredit pas
  assert.equal(historique.lignesDImport('race').filter((r) => horsDeLa0120(r.id)).length, 27, 'décision R1 : 27 races à l’import du classeur');
  assert.equal(historique.effectifDImport('race'), 29, 'décision R239 : 29 races');
  const races = new Set(db.prepare('SELECT id FROM race').all().map((r) => r.id));
  for (const id of ORDRE_DES_RACES) assert.ok(races.has(id), `décision R1 : ${id}`);
  for (const t of ['ressource', 'recette', 'arme', 'armure', 'metier', 'etat', 'peuple', 'note_cellule', 'ecart_source']) assert.ok(n(t) > 0, `${t} est rempli`);
  // la correction du Mercenaire est tracée (classeur de classes) ; les corrections du classeur de Décembre (dump `magie-v10`, R10, migration 0117) ont la leur
  assert.equal(db.prepare("SELECT count(*) AS n FROM correction WHERE dump = 'classes-v7'").get().n, 1, 'la correction du Mercenaire est tracée');
  assert.ok(db.prepare("SELECT count(*) AS n FROM correction WHERE dump = 'magie-v10'").get().n > 0, 'les corrections du classeur de Décembre sont tracées');
  assert.equal(n('correction'), db.prepare("SELECT count(*) AS n FROM correction WHERE dump IN ('classes-v7', 'magie-v10')").get().n, 'aucune autre source de correction');
  // la correction orthographique est bien dans les lignes typées, l'ancien texte n'y est plus (sauf si le site de dev a supprimé le don qui la portait :
  // D11, db:check l'ignore alors)
  if (!historique.supprimee('capacite', { id: 'capacites/mercenaire-chasseur-de-primes' })) assert.ok(db.prepare("SELECT 1 FROM classe WHERE nom LIKE '%Chasseur de primes%' OR id LIKE '%chasseur-de-primes%' LIMIT 1").get() || db.prepare("SELECT 1 FROM capacite WHERE id LIKE '%chasseur-de-primes%' LIMIT 1").get());
  assert.equal(db.prepare("SELECT count(*) AS n FROM capacite WHERE id LIKE '%chasseur-prime%'").get().n, 0);
  db.close();
});

test('db:check : aucun problème sur la base du contenu fourni', () => {
  const r = node('db-check.mjs', [surLeContenu().base]);
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.deepEqual(v.problemes, []);
  assert.ok(v.bilan.page_entite_cibles > 3000);
});

test('db:check détecte un défaut injecté (une entité typée qui n’a plus sa ligne page_entite)', () => {
  const copie = join(dir, 'defaut.db');
  cpSync(surLeContenu().base, copie);
  const db = new DatabaseSync(copie);
  // une ligne choisie dans l'état courant, pas un id supposé
  const ligne = db.prepare("SELECT entite_table, entite_id FROM page_entite WHERE entite_table = 'invocation' ORDER BY entite_id LIMIT 1").get();
  assert.ok(ligne, 'une invocation a sa ligne page_entite');
  db.prepare('DELETE FROM page_entite WHERE entite_table = ? AND entite_id = ?').run(ligne.entite_table, ligne.entite_id);
  db.close();
  const r = node('db-check.mjs', [copie]);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes(`page_entite : ${ligne.entite_table}:${ligne.entite_id} manque`), r.stdout);
});

testDuDepot('db:build refuse un jeu de lignes incomplet ou d’une autre version', () => {
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

testDuDepot('Python reconstruit la même base : lignes -> base -> export = data/rows octet pour octet', { skip: sansPython }, () => {
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

test('db:pages-check : les pages de la base du contenu fourni sont celles des .md que db:export-pages en produit (l’export relu par pages_md.py rend les mêmes pages)', { skip: sansPython }, () => {
  const { base, wiki } = surLeContenu();
  const r = pages('check', '--base', base, '--wiki', wiki);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /est à jour/);
});

testDuDepot('db:sync-pages : une page modifiée est détectée puis remise à jour sans toucher aux lignes typées ; une page ajoutée est refusée', { skip: sansPython }, () => {
  const { wiki } = surLeDepot();
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

testDuDepot('db:sync-pages : une page « docs » ajoutée à la main entre dans la base, et son retrait remet data/rows exactement comme avant ; un sort ou une capacité ne se crée pas ainsi', { skip: sansPython }, () => {
  const { wiki } = surLeDepot();
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
  // le mot-clé « test » n'est pas dans le vocabulaire : il n'est pas posé, et la synchronisation le signale (un import n'en crée pas : migration 0056)
  assert.match(ajout.stdout, /1 mot\(s\)-clé\(s\) non posé\(s\)[^\n]*\n {4}'test'$/m);
  assert.doesNotMatch(readFileSync(join(copieRows, 'mot_cle.sql'), 'utf8'), /VALUES \('test'/);
  assert.doesNotMatch(readFileSync(join(copieRows, 'page_tag.sql'), 'utf8'), /page-ajoutee-a-la-main/);
  assert.equal(pages('check', ...args).status, 0, 'à jour : une écriture inconnue ne compte pas');
  assert.match(readFileSync(join(copieRows, 'page.sql'), 'utf8'), /guide\/page-ajoutee-a-la-main/);
  assert.match(readFileSync(join(copieRows, 'alias.sql'), 'utf8'), /Alias de test/);

  rmSync(nouvelle);
  const retrait = pages('sync', ...args);
  assert.equal(retrait.status, 0, retrait.stdout + retrait.stderr);
  const touches = readdirSync(rows).filter((f) => readFileSync(join(rows, f), 'utf8') !== readFileSync(join(copieRows, f), 'utf8'));
  assert.deepEqual(touches, [], 'ajout puis retrait : data/rows est revenu à l’identique (alias et source de la page retirés avec elle ; aucun mot-clé créé)');

  // une page de la famille « classes » (importeur typé) ne se crée pas à la main
  const capacite = readdirSync(join(copieWiki, 'capacites'))[0];
  cpSync(join(copieWiki, 'capacites', capacite), join(copieWiki, 'capacites', 'capacite-fantome.md'));
  const refus = pages('sync', ...args);
  assert.equal(refus.status, 1);
  assert.match(refus.stdout, /importeur de leur famille/);
});
