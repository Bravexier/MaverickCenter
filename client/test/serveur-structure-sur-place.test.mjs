// Le changement de structure appliqué sur place (client/serveur/structure-sur-place.mjs ; lot 7 du chantier « la base du site de dev devient la source de
// vérité », R274, R275 ; docs/serveur.md, « Changement de structure appliqué sur place ») : le service sait appliquer les migrations livrées à une base en
// place, mais il n'applique JAMAIS à sa vraie base avant le lot 8 (rien n'est branché au démarrage).
//   - le cœur : une base de la version 128 REMPLIE (fiches, journal de l'édition, historique), la migration 0129 appliquée sur place : schéma identique à
//     data/schema.sql, toutes les autres tables d'empreinte inchangée, une ligne `sur_place` notée, une sauvegarde d'avant ;
//   - les refus, avec retour arrière complet (le bloc entier, jamais une moitié) : PRAGMA, versions qui ne se suivent pas, SQL en échec, clé étrangère rompue,
//     schéma inattendu, schema.sql absent ou d'une autre version ;
//   - l'essai sur une copie : un fil à part, la copie toujours effacée, la vraie base intacte (octets identiques), le bilan (créées, retirées, renommées, lignes
//     ajoutées, retirées et modifiées par clé primaire, tables inchangées) ;
//   - la livraison : les migrations et schema.sql dans _serveur/data/, lus de là par le module livré.
//   node --test test/serveur-structure-sur-place.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { DOSSIER_LIVRE, livrerServeur } from '../serveur/livraison.mjs';
import { empreinteFichier } from '../serveur/base-vivante.mjs';
import { sha256 } from '../serveur/partage.mjs';
import { REFERENCES } from '../src/lib/references-des-migrations.mjs';
import { mixtesSorties } from '../src/lib/sortie-du-contenu.mjs';
import {
  ErreurStructure, appliquerSurPlace, bilanDesTables, comparerLesSchemas, essayerEnArrierePlan, essayerSurUneCopie, lireLesMigrations, migrationInterdite,
  migrationsAAppliquer, normaliserLeSql, purgerLesEssaisDeStructure, sauvegarderAvant, versionDuSchemaSql, versionDuSite, versionLivree,
} from '../serveur/structure-sur-place.mjs';
import { LIVRAISON, NUMERO, RACINE, baseDesRegles, baseRemplie, etatDeLaBase, etatDuFichier, nouveauChemin, nouveauDossier, schemaDuDepot, tablesDeDonnees } from './aide-structure-sur-place.mjs';

/** La livraison des tests (test/aide-structure-sur-place.mjs#LIVRAISON : celle du dépôt, ou au-dessus du plancher quand les migrations mixtes sont sorties). */
const livre = lireLesMigrations(LIVRAISON);
/** La version de la base du dépôt (celle de la dernière migration livrée) : les migrations d'essai portent les numéros qui suivent. */
const V = livre.migrations.at(-1).numero;
const N = (numero) => String(numero).padStart(4, '0');
/**
 * Les tables que les migrations livrées après la 128 changent (la 0129 crée `migration_recue`) : les autres gardent leur empreinte quand elles sont
 * appliquées sur place. Une migration plus récente qui touche une autre table l'ajoute ici.
 */
const TABLES_QUE_LES_MIGRATIONS_CHANGENT = ['migration_recue'];
/** Les tables à qui une migration livrée ajoute une colonne (0131 : mot_cle_id sur page et sur sort) : leur empreinte suit leur forme, leurs lignes ne bougent pas. */
const COLONNES_AJOUTEES = { page: ['mot_cle_id'], sort: ['mot_cle_id'] };
const TABLES_A_COLONNE_AJOUTEE = Object.keys(COLONNES_AJOUTEES);
const lire = (chemin) => new DatabaseSync(chemin, { readOnly: true });
/** Une base ouverte comme celle du service (clés étrangères contrôlées). */
function ouvrir(chemin) {
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}
const fichiers = (dossier) => (existsSync(dossier) ? readdirSync(dossier) : []);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les migrations livrées
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('les migrations livrées : tout data/migrations/*.sql, numérotées, sha256 des octets du .sql, schema.sql à la version de la dernière ou au-dessus (le plancher) ; aucune ne porte BEGIN, COMMIT, ROLLBACK ni PRAGMA', () => {
  const livre = lireLesMigrations(); // celle du dépôt elle-même
  assert.ok(livre, 'le dossier des migrations est lu depuis le dépôt');
  const dossier = join(RACINE, 'data', 'migrations');
  const sql = readdirSync(dossier).filter((f) => /^\d{4}-.*\.sql$/.test(f)).sort();
  assert.deepEqual(livre.migrations.map((m) => m.fichier), sql, 'chaque .sql est livré ; les registres .json ne sont pas des migrations');
  assert.deepEqual(livre.migrations.map((m) => m.numero), [...livre.migrations.map((m) => m.numero)].sort((a, b) => a - b));
  assert.equal(new Set(livre.migrations.map((m) => m.numero)).size, livre.migrations.length);
  for (const m of livre.migrations) {
    assert.equal(m.numero, Number(m.fichier.slice(0, 4)));
    assert.equal(m.empreinte, sha256(readFileSync(join(dossier, m.fichier))), `${m.fichier} : sha256 des octets`);
    assert.equal(migrationInterdite(m.sql), null, `${m.fichier} : une migration publiée ne gère ni ses transactions ni ses PRAGMA`);
  }
  // les numéros se suivent à partir de la dernière migration que le schema.sql porte
  const version = Number(/^PRAGMA user_version\s*=\s*(\d+)/m.exec(livre.schema)[1]);
  assert.equal(versionDuSchemaSql(livre.schema), version);
  assert.equal(versionLivree(livre), version, 'la version livrée est celle du schema.sql');
  if (mixtesSorties()) assert.ok(livre.migrations.at(-1).numero <= version, 'les migrations sorties : schema.sql est le plancher, aucune migration en dessous ne le dépasse');
  else assert.equal(livre.migrations.at(-1).numero, version, 'schema.sql est à la version de la dernière migration');
  assert.ok(lireLesMigrations(LIVRAISON).migrations.some((m) => m.numero === NUMERO));
  // sans le texte : mêmes empreintes, aucune lecture du SQL en mémoire
  const sans = lireLesMigrations({ avecSql: false });
  assert.deepEqual(sans.migrations.map((m) => [m.numero, m.empreinte]), livre.migrations.map((m) => [m.numero, m.empreinte]));
  assert.ok(sans.migrations.every((m) => !('sql' in m)));
  assert.equal(lireLesMigrations({ migrations: null }), null, 'aucun dossier : null, sans erreur');
  assert.equal(lireLesMigrations({ migrations: join(dossier, 'absent') }), null);
});

test('plancher : la version livrée est la plus haute de la dernière migration et du schema.sql ; une base au plancher, au-dessus de la dernière migration livrée, est à jour, jamais « en avance » ; une base en dessous, sans migration livrée pour y monter, est refusée (étape plancher)', (t) => {
  assert.equal(versionDuSchemaSql('-- en-tête\nPRAGMA user_version = 130;   -- version du schéma'), 130);
  assert.equal(versionDuSchemaSql('CREATE TABLE a (x TEXT);'), null);
  assert.equal(versionLivree({ migrations: [{ numero: 129 }], schema: 'PRAGMA user_version = 130;' }), 130, 'les migrations du dessus sorties : le schema.sql');
  assert.equal(versionLivree({ migrations: [{ numero: 131 }], schema: 'PRAGMA user_version = 131;' }), 131);
  assert.equal(versionLivree({ migrations: [], schema: null }), null);
  // une livraison dont la dernière migration est sous la version du schema.sql (les migrations du dessus retirées), et une base à cette version
  const d = nouveauDossier('plancher', t);
  for (const m of livre.migrations.filter((x) => x.numero < V)) writeFileSync(join(d, m.fichier), m.sql);
  const schema = join(d, 'schema.sql');
  writeFileSync(schema, schemaDuDepot());
  const bilan = essayerSurUneCopie({ source: baseDesRegles(), dossier: nouveauDossier('plancher-essais', t), migrations: d, schema });
  assert.equal(bilan.verdict, 'a_jour');
  assert.deepEqual([bilan.versions.livree, bilan.en_avance], [V, false]);
  // une base SOUS le plancher, sans migration livrée pour y monter : refusée (elle se refait depuis le schéma), jamais « à jour » ; la base n'est pas écrite
  const sous = nouveauChemin('sous-le-plancher');
  const db = new DatabaseSync(baseDesRegles(), { readOnly: true });
  try {
    db.prepare('VACUUM INTO ?').run(sous);
  } finally {
    db.close();
  }
  const ecrite = new DatabaseSync(sous);
  ecrite.exec(`PRAGMA user_version = ${V - 1}`);
  ecrite.close();
  const octets = etatDuFichier(sous);
  const refus = essayerSurUneCopie({ source: sous, dossier: nouveauDossier('plancher-essais-sous', t), migrations: d, schema });
  assert.equal(refus.verdict, 'refuse');
  assert.deepEqual([refus.versions.avant, refus.versions.apres, refus.versions.livree], [V - 1, V - 1, V]);
  assert.deepEqual([refus.refus.etape, refus.refus.migration, refus.migrations], ['plancher', V, []]);
  assert.deepEqual(etatDuFichier(sous), octets, 'la base elle-même est intacte');
});

test('deux fichiers du même numéro, un nom qui n’est pas NNNN-<nom>.sql : l’un est une erreur, l’autre est ignoré', (t) => {
  const d = nouveauDossier('migrations-doublon', t);
  writeFileSync(join(d, '0005-a.sql'), 'SELECT 1;');
  writeFileSync(join(d, '0005-b.sql'), 'SELECT 1;');
  assert.throws(() => lireLesMigrations({ migrations: d, schema: false }), /deux fichiers portent le numéro 0005/);
  const e = nouveauDossier('migrations-ignorees', t);
  writeFileSync(join(e, '0005-a.sql'), 'SELECT 1;');
  writeFileSync(join(e, '0005-a.json'), '{}');
  writeFileSync(join(e, 'notes.sql'), 'SELECT 1;');
  writeFileSync(join(e, '0006-Majuscule.sql'), 'SELECT 1;');
  assert.deepEqual(lireLesMigrations({ migrations: e, schema: false }).migrations.map((m) => m.fichier), ['0005-a.sql']);
});

test('choix des migrations à appliquer : numéro > user_version ; migrationInterdite lit le début des instructions, pas les commentaires, les chaînes ni les déclencheurs', () => {
  const liste = [1, 2, 3, 4].map((numero) => ({ numero }));
  assert.deepEqual(migrationsAAppliquer(liste, 2).map((m) => m.numero), [3, 4]);
  assert.deepEqual(migrationsAAppliquer(liste, 4), []);
  for (const mot of ['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'PRAGMA']) {
    assert.equal(migrationInterdite(`-- note\nCREATE TABLE a (x TEXT);\n  ${mot.toLowerCase()} ;`), mot, `${mot} au milieu du fichier`);
    assert.equal(migrationInterdite(`${mot} TRANSACTION`), mot, `${mot} en tête`);
    assert.equal(migrationInterdite(`SELECT 1; ${mot.toLowerCase()}`), mot, `${mot} sans point-virgule final`);
  }
  assert.equal(migrationInterdite("-- PRAGMA foreign_keys = OFF\nINSERT INTO a VALUES ('BEGIN; COMMIT; PRAGMA x');\n/* ; ROLLBACK */"), null);
  assert.equal(migrationInterdite('CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE a SET x = 1; END;'), null, 'le BEGIN d’un déclencheur est le sien');
  assert.equal(migrationInterdite('SELECT * FROM pragma_table_info(\'a\');'), null);
});

test('la version du site notée : X.Y.Z strict, sinon NULL', () => {
  assert.equal(versionDuSite('1.2.3'), '1.2.3');
  assert.equal(versionDuSite('10.20.30'), '10.20.30');
  for (const v of ['1.2.3-dev', '1.2', '1.2.3.4', 'v1.2.3', '', null, undefined, 123]) assert.equal(versionDuSite(v), null, String(v));
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La comparaison des structures (portage de maverick.py#comparer_schemas)
// ---------------------------------------------------------------------------------------------------------------------------------------------
function memoire(sql) {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  db.exec(sql);
  return db;
}

test('comparerLesSchemas : un commentaire « -- » n’est retiré que hors d’une chaîne ; une colonne ajoutée par ALTER TABLE se compare ; un vrai écart se voit', () => {
  const n = normaliserLeSql;
  assert.ok(n("CREATE TABLE t (x TEXT CHECK (x <> 'a--b''c'), y TEXT)").includes("'a--b''c'"), 'une chaîne qui contient « -- » et une apostrophe');
  assert.equal(n("CREATE TABLE t (\n  a TEXT, -- l'écriture d'origine\n  b TEXT CHECK (b <> 'x')\n)"), n("CREATE TABLE t (a TEXT, b TEXT CHECK (b <> 'x'))"));
  assert.equal(n('CREATE TABLE "t" (a  TEXT ,\n b TEXT) ;'), n('create table t (a text, b text)'), 'guillemets, espaces, casse, point-virgule');
  const cle = "CHECK (length(c) > 0 AND c NOT GLOB '*--*' AND c NOT GLOB '-*')";
  const migree = memoire(`CREATE TABLE m (\n  id TEXT NOT NULL PRIMARY KEY,\n  c TEXT NOT NULL UNIQUE ${cle}\n      -- normalize(libelle)\n) STRICT;`);
  migree.exec('ALTER TABLE m ADD COLUMN d TEXT CHECK (d IS NULL OR length(d) > 0)');
  const attendu = memoire(`CREATE TABLE m (\n  id TEXT NOT NULL PRIMARY KEY,\n  c TEXT NOT NULL UNIQUE ${cle},\n      -- normalize(libelle)\n  d TEXT CHECK (d IS NULL OR length(d) > 0)   -- ajoutée en dernier\n) STRICT;`);
  assert.deepEqual(comparerLesSchemas(migree, attendu), []);
  const autre = memoire(`CREATE TABLE m (\n  id TEXT NOT NULL PRIMARY KEY,\n  c TEXT NOT NULL UNIQUE ${cle} COLLATE NOCASE,\n      -- normalize(libelle)\n  d TEXT CHECK (d IS NULL OR length(d) > 0)\n) STRICT;`);
  assert.ok(comparerLesSchemas(attendu, autre).some((e) => e.startsWith('table m : définition différente')), 'un écart après « \'*--*\' » sur la même ligne se voit');
  // table, index, vue absents d'un côté ou de l'autre ; ordre des colonnes
  const a = memoire('CREATE TABLE t (x INTEGER, y TEXT); CREATE INDEX t_y ON t (y); CREATE VIEW v AS SELECT x FROM t;');
  const b = memoire('CREATE TABLE t (y TEXT, x INTEGER); CREATE TABLE u (z TEXT); CREATE VIEW v AS SELECT x FROM t;');
  const ecarts = comparerLesSchemas(a, b);
  assert.ok(ecarts.some((e) => e === 'table u : absent de la base migrée'), ecarts.join('\n'));
  assert.ok(ecarts.some((e) => e === 'index t_y : absent du schéma attendu'), ecarts.join('\n'));
  assert.ok(ecarts.some((e) => /^table t : définition différente/.test(e)));
  assert.ok(ecarts.some((e) => /^table t : colonnes \(ou leur ordre\) différentes/.test(e)));
  assert.equal(ecarts.some((e) => /^view v/.test(e)), false, 'la vue identique ne compte pas');
  // le schema.sql du dépôt se compare à lui-même
  assert.deepEqual(comparerLesSchemas(memoire(schemaDuDepot()), memoire(schemaDuDepot())), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le cœur : la migration 0129 sur une base de la version 128 remplie
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('une base 128 remplie : les migrations livrées (la 0129) appliquées sur place — schéma de schema.sql, fiches et journal intacts, ligne « sur_place » notée, sauvegarde d’avant', (t) => {
  const { chemin, poses } = baseRemplie({ anterieure: true });
  const sauvegardes = nouveauDossier('sauvegardes', t);
  const attendu = memoire(schemaDuDepot());
  const db = ouvrir(chemin);
  try {
    assert.ok(comparerLesSchemas(db, attendu).includes('table migration_recue : absent de la base migrée'), 'la base d’essai est bien celle d’avant la 0129');
    // le prétiré ; pas de fiche de joueur, faute de compte avant la migration 0132 (scripts/base-remplie-lib.mjs, R310)
    assert.ok(db.prepare('SELECT count(*) AS n FROM personnage').get().n >= 1, 'des fiches');
    assert.ok(db.prepare('SELECT count(*) AS n FROM modification_lot').get().n >= 1, 'un lot du journal');
    assert.ok(db.prepare('SELECT count(*) AS n FROM historique_modification').get().n >= 1, 'une ligne de l’historique');
    const fiches = db.prepare('SELECT id FROM personnage ORDER BY id').all().map((p) => p.id);
    const avant = etatDeLaBase(db);
    assert.equal(avant.version, NUMERO - 1);
    const livrees = livre.migrations.filter((m) => m.numero >= NUMERO);

    const r = appliquerSurPlace(db, { ...livre, sauvegarde: { dossier: sauvegardes }, instant: new Date('2026-11-12T10:20:30.456Z'), version: '1.2.3' });

    assert.deepEqual([r.avant, r.apres], [NUMERO - 1, V]);
    assert.deepEqual(r.appliquees.map((m) => m.numero), livrees.map((m) => m.numero));
    assert.equal(r.notees, true);
    assert.equal(db.isTransaction, false);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'les clés étrangères sont rétablies');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, V);
    assert.deepEqual(comparerLesSchemas(db, attendu), [], 'schéma identique à schema.sql');
    // tout le reste est intact : l'empreinte de chaque autre table (fiches, journal, historique, règles) ne bouge pas
    const apres = etatDeLaBase(db);
    for (const nom of Object.keys(avant.tables)) {
      if (TABLES_A_COLONNE_AJOUTEE.includes(nom)) assert.equal(apres.tables[nom].lignes, avant.tables[nom].lignes, `${nom} : les mêmes lignes`);
      else if (!TABLES_QUE_LES_MIGRATIONS_CHANGENT.includes(nom)) assert.deepEqual(apres.tables[nom], avant.tables[nom], `${nom} : empreinte inchangée`);
    }
    assert.deepEqual(db.prepare('SELECT id FROM personnage ORDER BY id').all().map((p) => p.id), fiches);
    assert.ok(db.prepare('SELECT 1 FROM personnage WHERE id = ?').get(poses.pretire), 'la fiche du prétiré');
    // une ligne « sur_place » par migration appliquée, avec l'empreinte du fichier
    assert.deepEqual(db.prepare('SELECT numero, fichier, empreinte, recue_le, mode, version_du_site FROM migration_recue ORDER BY numero').all().map((x) => ({ ...x })),
      livrees.map((m) => ({ numero: m.numero, fichier: m.fichier, empreinte: m.empreinte, recue_le: '2026-11-12T10:20:30Z', mode: 'sur_place', version_du_site: '1.2.3' })));
    // la sauvegarde est celle d'AVANT : version 128, les fiches, pas la table
    assert.equal(fichiers(sauvegardes).length, 1);
    assert.equal(r.sauvegarde, join(sauvegardes, fichiers(sauvegardes)[0]));
    assert.match(fichiers(sauvegardes)[0], new RegExp(`^structure-2026-11-12T10-20-30-456Z-v${NUMERO - 1}\\.db$`));
    assert.deepEqual(etatDuFichier(r.sauvegarde), avant);
  } finally {
    db.close();
    attendu.close();
  }
});

test('une version « -dev » est notée NULL ; une base déjà à jour n’est pas touchée (ni sauvegarde, ni ligne de plus)', (t) => {
  const { chemin } = baseRemplie({ anterieure: true });
  const sauvegardes = nouveauDossier('sauvegardes', t);
  const db = ouvrir(chemin);
  try {
    appliquerSurPlace(db, { ...livre, sauvegarde: { dossier: sauvegardes }, version: '1.2.3-dev' });
    assert.equal(db.prepare('SELECT version_du_site AS v FROM migration_recue').get().v, null);
    const etat = etatDeLaBase(db);
    const encore = appliquerSurPlace(db, { ...livre, sauvegarde: { dossier: sauvegardes } });
    assert.deepEqual([encore.appliquees, encore.sauvegarde, encore.notees], [[], null, false]);
    assert.deepEqual(etatDeLaBase(db), etat);
    assert.equal(fichiers(sauvegardes).length, 1);
  } finally {
    db.close();
  }
});

test('`sauvegarde` est obligatoire : { dossier } ou false ; sans sauvegarde, rien n’est copié', (t) => {
  const { chemin } = baseRemplie({ anterieure: true });
  const db = ouvrir(chemin);
  try {
    assert.throws(() => appliquerSurPlace(db, { ...livre }), /`sauvegarde` est obligatoire/);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, NUMERO - 1, 'rien n’est appliqué sans réponse sur la sauvegarde');
    const r = appliquerSurPlace(db, { ...livre, sauvegarde: false });
    assert.equal(r.sauvegarde, null);
    assert.equal(r.apres, V);
    db.exec('BEGIN');
    assert.throws(() => appliquerSurPlace(db, { ...livre, sauvegarde: false }), /dans une transaction/);
    db.exec('ROLLBACK');
  } finally {
    db.close();
  }
  const copie = nouveauDossier('copie-sauvegarde', t);
  const seule = sauvegarderAvant(new DatabaseSync(chemin, { readOnly: true }), copie, { instant: new Date('2026-11-12T10:00:00Z'), version: V });
  assert.equal(etatDuFichier(seule).version, V);
  assert.notEqual(sauvegarderAvant(new DatabaseSync(chemin, { readOnly: true }), copie, { instant: new Date('2026-11-12T10:00:00Z'), version: V }), seule, 'deux sauvegardes de la même milliseconde ne s’écrasent pas');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les refus : retour arrière complet
// ---------------------------------------------------------------------------------------------------------------------------------------------
const schemaALaVersion = (version) => schemaDuDepot().replace(/^PRAGMA user_version\s*=\s*\d+;/m, `PRAGMA user_version = ${version};`);
const fausse = (numero, nom, sql) => ({ numero, fichier: `${String(numero).padStart(4, '0')}-${nom}.sql`, empreinte: sha256(sql), sql });

/**
 * Applique `suite` (migrations d'essai, numérotées après la dernière livrée) à la base remplie du dépôt et rend le refus : la base est comme avant (empreinte
 * de chaque table, structure, version), hors transaction, clés étrangères rétablies, aucune ligne notée de plus.
 */
function refuser({ suite, schema, migrations = [...livre.migrations, ...suite], sauvegarde = false }) {
  const { chemin } = baseRemplie();
  const db = ouvrir(chemin);
  try {
    const avant = etatDeLaBase(db);
    let refus = null;
    try {
      appliquerSurPlace(db, { migrations, schema, sauvegarde });
    } catch (e) {
      if (!(e instanceof ErreurStructure)) throw e;
      refus = e;
    }
    assert.ok(refus, 'le changement est refusé');
    assert.deepEqual(etatDeLaBase(db), avant, 'retour arrière complet : les migrations d’avant le refus, du même bloc, ne sont pas restées');
    assert.equal(db.isTransaction, false);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    return refus;
  } finally {
    db.close();
  }
}

test('refus : une migration qui porte BEGIN, COMMIT, ROLLBACK ou PRAGMA — avant toute écriture, avant toute sauvegarde', (t) => {
  for (const mot of ['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'PRAGMA foreign_keys = OFF']) {
    const sauvegardes = nouveauDossier('sauvegardes', t);
    const e = refuser({ suite: [fausse(V + 1, 'interdite', `CREATE TABLE essai_interdit (id INTEGER PRIMARY KEY);\n${mot};`)], schema: schemaALaVersion(V + 1), sauvegarde: { dossier: sauvegardes } });
    assert.equal(e.etape, 'interdit', mot);
    assert.equal(e.migration, V + 1);
    assert.match(e.message, new RegExp(`${V + 1}-interdite\\.sql`));
    assert.match(e.message, new RegExp(mot.split(' ')[0]));
    assert.deepEqual(fichiers(sauvegardes), [], 'refusée avant la sauvegarde');
  }
});

test('une ligne migration_recue dont le numéro dépasse user_version est retirée, dans le bloc : refusé, elle reste ; appliqué, elle part', () => {
  const ligne = (db) => db.prepare('INSERT INTO migration_recue (numero, fichier, empreinte, recue_le, mode, version_du_site) VALUES (?, ?, ?, ?, ?, NULL)')
    .run(V + 5, `${N(V + 5)}-future.sql`, sha256('future'), '2026-01-01T00:00:00Z', 'reconstruction');
  const numeros = (db) => db.prepare('SELECT numero FROM migration_recue ORDER BY numero').all().map((r) => r.numero);
  const { chemin } = baseRemplie();
  const db = ouvrir(chemin);
  try {
    ligne(db);
    const avant = numeros(db);
    assert.ok(avant.includes(V + 5));
    // un refus (SQL en échec) : la ligne n'est pas retirée, le retour arrière est complet
    assert.throws(() => appliquerSurPlace(db, { migrations: [...livre.migrations, fausse(V + 1, 'cassee', 'SELECT * FROM table_absente;')], schema: schemaALaVersion(V + 1), sauvegarde: false }), ErreurStructure);
    assert.deepEqual(numeros(db), avant);
    appliquerSurPlace(db, {
      migrations: [...livre.migrations, fausse(V + 1, 'suivante', 'CREATE TABLE essai_suivante (id INTEGER PRIMARY KEY) STRICT;')],
      schema: `${schemaALaVersion(V + 1)}\nCREATE TABLE essai_suivante (id INTEGER PRIMARY KEY) STRICT;`, sauvegarde: false,
    });
    assert.deepEqual(numeros(db), [...avant.filter((n) => n !== V + 5), V + 1].sort((a, b) => a - b), 'la ligne de la version future est retirée, la migration appliquée est notée');
  } finally {
    db.close();
  }
});

test('refus : les versions se suivent une à une', () => {
  const e = refuser({ suite: [fausse(V + 2, 'saut', 'SELECT 1;')], schema: schemaALaVersion(V + 2) });
  assert.equal(e.etape, 'suite');
  assert.equal(e.migration, V + 1, 'la migration qui manque');
  assert.match(e.message, new RegExp(`${N(V + 1)} manque`));
});

test('refus : le SQL d’une migration en échec — celle d’avant, appliquée dans le même bloc, est défaite aussi', () => {
  const premiere = fausse(V + 1, 'premiere', 'CREATE TABLE essai_premiere (id INTEGER PRIMARY KEY) STRICT;\nUPDATE race SET nom = nom || \' (essai)\';');
  const e = refuser({ suite: [premiere, fausse(V + 2, 'cassee', 'INSERT INTO table_qui_n_existe_pas VALUES (1);')], schema: schemaALaVersion(V + 2) });
  assert.equal(e.etape, 'execution');
  assert.equal(e.migration, V + 2, 'dit LAQUELLE : la seconde');
  assert.match(e.message, new RegExp(`${V + 2}-cassee\\.sql`));
  assert.match(e.message, /table_qui_n_existe_pas/, 'et pourquoi');
});

test('refus : une migration qui rompt une clé étrangère (la table et la table visée sont citées)', () => {
  const e = refuser({
    suite: [fausse(V + 1, 'lien-rompu', "UPDATE personnage SET race_id = 'races/n-existe-pas' WHERE id IN (SELECT id FROM personnage LIMIT 1);")],
    schema: schemaALaVersion(V + 1),
  });
  assert.equal(e.etape, 'cles_etrangeres');
  assert.equal(e.migration, V + 1);
  assert.match(e.message, new RegExp(`${V + 1}-lien-rompu\\.sql`));
  assert.ok(e.details.some((d) => /^personnage → race : 1 ligne/.test(d)), e.details.join('\n'));
});

test('refus : la clé étrangère est contrôlée migration par migration (une rupture qu’une suivante réparerait est refusée)', () => {
  const e = refuser({
    suite: [
      fausse(V + 1, 'rompt', "UPDATE personnage SET race_id = 'races/n-existe-pas' WHERE id IN (SELECT id FROM personnage LIMIT 1);"),
      fausse(V + 2, 'repare', "UPDATE personnage SET race_id = (SELECT id FROM race ORDER BY id LIMIT 1) WHERE race_id = 'races/n-existe-pas';"),
    ],
    schema: schemaALaVersion(V + 2),
  });
  assert.equal(e.etape, 'cles_etrangeres');
  assert.equal(e.migration, V + 1);
});

test('refus : le schéma obtenu n’est pas celui de schema.sql (les écarts sont listés)', () => {
  const e = refuser({
    suite: [fausse(V + 1, 'inattendue', 'CREATE TABLE essai_inattendu (id INTEGER PRIMARY KEY) STRICT;')],
    schema: schemaALaVersion(V + 1),
  });
  assert.equal(e.etape, 'schema');
  assert.equal(e.migration, V + 1, 'une seule migration en cause : nommée');
  assert.ok(e.details.includes('table essai_inattendu : absent du schéma attendu'), e.details.join('\n'));
  // plusieurs migrations d'un coup : l'écart se voit sur l'ensemble
  const deux = refuser({
    suite: [fausse(V + 1, 'a', 'CREATE TABLE essai_a (id INTEGER PRIMARY KEY) STRICT;'), fausse(V + 2, 'b', 'CREATE TABLE essai_b (id INTEGER PRIMARY KEY) STRICT;')],
    schema: schemaALaVersion(V + 2),
  });
  assert.equal(deux.etape, 'schema');
  assert.equal(deux.migration, null);
  assert.match(deux.message, new RegExp(`les migrations ${N(V + 1)} à ${N(V + 2)}`));
});

test('refus : le schema.sql attendu est absent, d’une autre version, ou ne se rejoue pas', () => {
  const suite = [fausse(V + 1, 'a', 'SELECT 1;')];
  assert.equal(refuser({ suite, schema: null }).etape, 'schema_attendu');
  const autreVersion = refuser({ suite, schema: schemaDuDepot() });
  assert.equal(autreVersion.etape, 'schema_attendu');
  assert.match(autreVersion.message, new RegExp(`à la version ${V}, la dernière migration livrée est ${String(V + 1).padStart(4, '0')}-a\\.sql`));
  assert.equal(refuser({ suite, schema: 'CREATE TABLE (' }).etape, 'schema_attendu');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'essai sur une copie
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('essai sur une copie, dans un fil à part : vraie base inchangée (octets), copies effacées, bilan exact des migrations livrées', async (t) => {
  const { chemin } = baseRemplie({ anterieure: true });
  const dossier = nouveauDossier('essais', t);
  const avant = empreinteFichier(chemin);
  const etat = etatDuFichier(chemin);

  const livrees = livre.migrations.filter((m) => m.numero >= NUMERO);

  const bilan = await essayerEnArrierePlan({ source: chemin, dossier, ...LIVRAISON, version: '1.2.3', instant: '2026-11-12T10:20:30Z' });

  assert.equal(empreinteFichier(chemin), avant, 'le fichier de la vraie base a les mêmes octets');
  assert.deepEqual(etatDuFichier(chemin), etat);
  assert.deepEqual(fichiers(dossier), [], 'les copies sont effacées');
  assert.equal(bilan.format, 'maverick-structure/1');
  assert.equal(bilan.verdict, 'accepte');
  assert.deepEqual(bilan.versions, { avant: NUMERO - 1, apres: V });
  assert.deepEqual(bilan.migrations, livrees.map(({ numero, fichier, empreinte }) => ({ numero, fichier, empreinte })));
  // (ce bilan est celui de la 0129 : une migration livrée plus tard qui change des lignes ou des tables ajoute son écart ici)
  // les tables créées : `migration_recue` avec la ligne que l'application noterait par migration, et celles que les migrations suivantes créent (vides, sauf les lignes que la migration pose elle-même : les dix types de sort de la 0131)
  const dAvant = lire(chemin);
  const courantes = lire(baseDesRegles());
  let creees;
  try {
    const avantLes = new Set(tablesDeDonnees(dAvant));
    // (une table créée porte les seules lignes que sa migration pose elle-même : la base des règles les a refaites, aide-structure-sur-place.mjs#viderLesAjoutsDesMigrations)
    creees = tablesDeDonnees(courantes).filter((n) => !avantLes.has(n)).sort().map((table) => ({
      table, lignes: table === 'migration_recue' ? livrees.length : courantes.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n,
    }));
  } finally {
    dAvant.close();
    courantes.close();
  }
  assert.ok(creees.some((c) => c.table === 'migration_recue'));
  assert.deepEqual(bilan.tables.creees, creees, 'les tables créées, avec la ligne que l’application noterait par migration');
  assert.deepEqual(bilan.tables.retirees, []);
  assert.deepEqual(bilan.tables.renommees, []);
  assert.deepEqual(bilan.tables.modifiees, Object.fromEntries(Object.entries(COLONNES_AJOUTEES).map(([table, colonnes]) => [table,
    { ajoutees: 0, retirees: 0, modifiees: 0, structure_changee: true, colonnes_ajoutees: colonnes, colonnes_retirees: [] }])), 'aucune ligne de contenu ne bouge : seules page et sort changent de forme (colonne ajoutée)');
  assert.deepEqual(bilan.totaux, { ajoutees: 0, retirees: 0, modifiees: 0 });
  // les trois index d'ancrage de la 0131 (un mot-clé ancre au plus une page, un sort, un type de sort)
  assert.deepEqual(bilan.objets, { crees: ['index page_ancre_mot_cle', 'index sort_ancre_mot_cle', 'index type_sort_ancre_mot_cle'], retires: [], modifies: [] });
  // toutes les autres tables sont listées inchangées : fiches, journal, historique et règles comprises (page et sort, qui gagnent une colonne, sont dites modifiées)
  const db = lire(chemin);
  try {
    assert.deepEqual(bilan.tables.inchangees, tablesDeDonnees(db).filter((n) => !TABLES_A_COLONNE_AJOUTEE.includes(n)));
  } finally {
    db.close();
  }
  for (const nom of ['personnage', 'modification_lot', 'modification', 'historique_modification', 'race', 'alias']) assert.ok(bilan.tables.inchangees.includes(nom), nom);
  assert.deepEqual(bilan.tables.virtuelles_ignorees, ['entite_fts', 'page_fts']);
  assert.ok(bilan.duree_ms >= 0);
  assert.deepEqual(JSON.parse(JSON.stringify(bilan)), bilan, 'un bilan en JSON');
});

test('essai sur une copie, de façon synchrone : le même bilan, et la copie effacée même quand l’essai échoue', (t) => {
  const { chemin } = baseRemplie({ anterieure: true });
  const dossier = nouveauDossier('essais', t);
  const bilan = essayerSurUneCopie({ source: chemin, dossier, ...LIVRAISON });
  assert.equal(bilan.verdict, 'accepte');
  assert.deepEqual(fichiers(dossier), []);
  // une source qui n'est pas une base : l'essai échoue, rien ne reste
  const pasUneBase = nouveauChemin('pas-une-base');
  writeFileSync(pasUneBase, 'ceci n’est pas une base SQLite, mais un texte assez long pour que SQLite le refuse '.repeat(40));
  assert.throws(() => essayerSurUneCopie({ source: pasUneBase, dossier }));
  assert.deepEqual(fichiers(dossier), []);
  // des copies laissées par un service arrêté en plein essai sont purgées, rien d'autre
  writeFileSync(join(dossier, 'structure-essai-123-00000000-0000-0000-0000-000000000000-avant.db'), 'x');
  writeFileSync(join(dossier, 'structure-essai-123-00000000-0000-0000-0000-000000000000-apres.db-journal'), 'x');
  writeFileSync(join(dossier, 'garder.db'), 'x');
  assert.equal(purgerLesEssaisDeStructure(dossier), 2);
  assert.deepEqual(fichiers(dossier), ['garder.db']);
  assert.equal(purgerLesEssaisDeStructure(join(dossier, 'absent')), 0);
});

test('essai refusé : le verdict dit la migration et pourquoi, la copie est effacée, la vraie base intacte', async (t) => {
  const { chemin } = baseRemplie();
  const dossier = nouveauDossier('essais', t);
  const migrations = nouveauDossier('migrations-fausses', t);
  writeFileSync(join(migrations, `${N(V + 1)}-fausse.sql`), 'CREATE TABLE essai_fausse (id INTEGER PRIMARY KEY) STRICT;\nPRAGMA foreign_keys = OFF;\n');
  const schema = join(migrations, 'schema.sql');
  writeFileSync(schema, schemaALaVersion(V + 1));
  const avant = empreinteFichier(chemin);

  const bilan = await essayerEnArrierePlan({ source: chemin, dossier, migrations, schema });

  assert.equal(bilan.verdict, 'refuse');
  assert.equal(bilan.refus.migration, V + 1);
  assert.equal(bilan.refus.etape, 'interdit');
  assert.match(bilan.refus.raison, new RegExp(`${N(V + 1)}-fausse\\.sql`));
  assert.deepEqual(bilan.versions, { avant: V, apres: V });
  assert.deepEqual(bilan.migrations.map((m) => m.numero), [V + 1], 'les migrations essayées');
  assert.equal(bilan.retour_arriere, true);
  assert.equal(bilan.tables, undefined, 'pas de bilan de tables pour un refus');
  assert.equal(empreinteFichier(chemin), avant);
  assert.deepEqual(fichiers(dossier), []);
});

test('essai : base déjà à jour, migrations non livrées, schema.sql non livré', (t) => {
  const { chemin } = baseRemplie({ anterieure: true });
  const dossier = nouveauDossier('essais', t);
  const db = ouvrir(chemin);
  appliquerSurPlace(db, { ...livre, sauvegarde: false });
  db.close();
  const aJour = essayerSurUneCopie({ source: chemin, dossier, ...LIVRAISON });
  assert.equal(aJour.verdict, 'a_jour');
  assert.deepEqual(aJour.versions, { avant: V, apres: V, livree: V });
  assert.equal(aJour.en_avance, false);
  assert.equal(essayerSurUneCopie({ source: chemin, dossier, migrations: null }).verdict, 'indisponible');
  const sansSchema = nouveauDossier('migrations-sans-schema', t);
  assert.equal(essayerSurUneCopie({ source: chemin, dossier, migrations: sansSchema, schema: join(sansSchema, 'absent.sql') }).verdict, 'indisponible');
  assert.deepEqual(fichiers(dossier), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le bilan : lignes ajoutées, retirées, modifiées ; tables créées, retirées, renommées
// ---------------------------------------------------------------------------------------------------------------------------------------------
const SCHEMA_1 = `PRAGMA user_version = 1;
CREATE TABLE a (id INTEGER NOT NULL PRIMARY KEY, nom TEXT NOT NULL, note TEXT);
CREATE TABLE cle_double (x INTEGER NOT NULL, y INTEGER NOT NULL, v TEXT, PRIMARY KEY (x, y));
CREATE TABLE intacte (id INTEGER NOT NULL PRIMARY KEY, v TEXT);
CREATE TABLE ancienne (id INTEGER NOT NULL PRIMARY KEY, contenu TEXT);
CREATE TABLE disparue (id INTEGER NOT NULL PRIMARY KEY);
CREATE TABLE sans_cle (v TEXT, w TEXT);
CREATE INDEX a_nom ON a (nom);`;
const SCHEMA_2 = `PRAGMA user_version = 2;
CREATE TABLE a (id INTEGER NOT NULL PRIMARY KEY, nom TEXT NOT NULL, note TEXT, ajoutee TEXT);
CREATE TABLE cle_double (x INTEGER NOT NULL, y INTEGER NOT NULL, v TEXT, PRIMARY KEY (x, y));
CREATE TABLE intacte (id INTEGER NOT NULL PRIMARY KEY, v TEXT);
CREATE TABLE nouvelle (id INTEGER NOT NULL PRIMARY KEY, contenu TEXT);
CREATE TABLE creee (id INTEGER NOT NULL PRIMARY KEY);
CREATE TABLE sans_cle (v TEXT, w TEXT);
CREATE VIEW v_a AS SELECT id, nom FROM a;`;
const MIGRATION_2 = `
INSERT INTO a (id, nom, note) VALUES (6, 'six', NULL), (7, 'sept', 'n');
DELETE FROM a WHERE id = 1;
UPDATE a SET nom = 'deux (changé)' WHERE id = 2;
ALTER TABLE a ADD COLUMN ajoutee TEXT;
UPDATE cle_double SET v = 'changée' WHERE x = 1 AND y = 2;
DELETE FROM cle_double WHERE x = 2;
ALTER TABLE ancienne RENAME TO nouvelle;
DROP TABLE disparue;
CREATE TABLE creee (id INTEGER NOT NULL PRIMARY KEY);
INSERT INTO creee VALUES (1), (2), (3);
DELETE FROM sans_cle WHERE v = 'b';
INSERT INTO sans_cle VALUES ('z', 'z');
DROP INDEX a_nom;
CREATE VIEW v_a AS SELECT id, nom FROM a;`;

test('le bilan par table : lignes ajoutées, retirées et modifiées (par clé primaire), tables créées, retirées et renommées, tables inchangées, objets', (t) => {
  const d = nouveauDossier('bilan', t);
  const chemin = join(d, 'base.db');
  const db = new DatabaseSync(chemin);
  db.exec(`${SCHEMA_1.replace('PRAGMA user_version = 1;', '')}
    PRAGMA user_version = 1;
    INSERT INTO a (id, nom) VALUES (1, 'un'), (2, 'deux'), (3, 'trois'), (4, 'quatre'), (5, 'cinq');
    INSERT INTO cle_double VALUES (1, 1, 'a'), (1, 2, 'b'), (2, 1, 'c'), (2, 2, 'd');
    INSERT INTO intacte VALUES (1, 'x'), (2, 'y');
    INSERT INTO ancienne VALUES (1, 'contenu'), (2, 'autre');
    INSERT INTO disparue VALUES (1), (2);
    INSERT INTO sans_cle VALUES ('a', 'a'), ('b', 'b');`);
  db.close();
  const dossierMigrations = nouveauDossier('migrations', t);
  writeFileSync(join(dossierMigrations, '0002-deux.sql'), MIGRATION_2);
  const schema = join(dossierMigrations, 'schema.sql');
  writeFileSync(schema, SCHEMA_2);

  const bilan = essayerSurUneCopie({ source: chemin, dossier: join(d, 'essais'), migrations: dossierMigrations, schema });

  assert.equal(bilan.verdict, 'accepte', JSON.stringify(bilan.refus));
  assert.deepEqual(bilan.versions, { avant: 1, apres: 2 });
  assert.deepEqual(bilan.tables.creees, [{ table: 'creee', lignes: 3 }]);
  assert.deepEqual(bilan.tables.retirees, [{ table: 'disparue', lignes: 2 }]);
  assert.deepEqual(bilan.tables.renommees, [{ de: 'ancienne', vers: 'nouvelle' }], 'même contenu, mêmes colonnes : renommée, pas créée et retirée');
  assert.deepEqual(bilan.tables.inchangees, ['intacte']);
  assert.deepEqual(bilan.tables.modifiees.a, {
    ajoutees: 2, retirees: 1, modifiees: 1, colonnes_ajoutees: ['ajoutee'], colonnes_retirees: [], structure_changee: true,
  });
  assert.deepEqual(bilan.tables.modifiees.cle_double, { ajoutees: 0, retirees: 2, modifiees: 1, colonnes_ajoutees: [], colonnes_retirees: [], structure_changee: false }, 'clé composée');
  assert.deepEqual(bilan.tables.modifiees.sans_cle, { ajoutees: 1, retirees: 1, modifiees: 0, colonnes_ajoutees: [], colonnes_retirees: [], structure_changee: false }, 'sans clé : lignes entières');
  assert.deepEqual(Object.keys(bilan.tables.modifiees).sort(), ['a', 'cle_double', 'sans_cle']);
  assert.deepEqual(bilan.totaux, { ajoutees: 3, retirees: 4, modifiees: 2 });
  assert.deepEqual(bilan.objets, { crees: ['view v_a'], retires: ['index a_nom'], modifies: [] });
  assert.deepEqual(bilan.refus, undefined);
  assert.deepEqual(fichiers(join(d, 'essais')), []);
});

test('bilanDesTables sur deux états attachés : l’état d’avant sous « avant », celui d’après dans « main »', (t) => {
  const d = nouveauDossier('bilan-direct', t);
  const avant = join(d, 'avant.db');
  const apres = join(d, 'apres.db');
  for (const [chemin, lignes] of [[avant, "(1, 'a'), (2, 'b')"], [apres, "(1, 'a'), (2, 'B'), (3, 'c')"]]) {
    const db = new DatabaseSync(chemin);
    db.exec(`CREATE TABLE t (id INTEGER NOT NULL PRIMARY KEY, v TEXT); INSERT INTO t VALUES ${lignes};`);
    db.close();
  }
  const db = new DatabaseSync(apres);
  try {
    db.prepare('ATTACH DATABASE ? AS avant').run(avant);
    const bilan = bilanDesTables(db);
    assert.deepEqual(bilan.tables.modifiees, { t: { ajoutees: 1, retirees: 0, modifiees: 1, colonnes_ajoutees: [], colonnes_retirees: [], structure_changee: false } });
    assert.deepEqual(bilan.tables.inchangees, []);
  } finally {
    db.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La livraison
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('livraison : chaque migration .sql et schema.sql dans _serveur/data/, lus de là par le module livré', async (t) => {
  const dist = nouveauDossier('dist', t);
  const info = livrerServeur(dist, { version: '1.2.3' });
  const livree = join(dist, DOSSIER_LIVRE);
  const livre = lireLesMigrations(); // celle du dépôt, que la livraison copie
  for (const m of livre.migrations) {
    assert.ok(info.fichiers.includes(`data/migrations/${m.fichier}`), m.fichier);
    assert.equal(sha256(readFileSync(join(livree, 'data', 'migrations', m.fichier))), m.empreinte, `${m.fichier} : octets identiques`);
  }
  assert.ok(info.fichiers.includes('data/schema.sql'));
  assert.equal(readFileSync(join(livree, 'data', 'schema.sql'), 'utf8'), livre.schema);
  assert.ok(info.modules.includes('serveur/structure-sur-place.mjs'), 'le module est livré avec le service');
  // le module livré lit ses migrations de _serveur/data/, sans paquet ni chemin du dépôt
  const livre2 = await import(pathToFileURL(join(livree, 'serveur', 'structure-sur-place.mjs')).href);
  const lues = livre2.lireLesMigrations();
  assert.equal(lues.dossier, join(livree, 'data', 'migrations'));
  assert.deepEqual(lues.migrations.map((m) => [m.numero, m.empreinte]), livre.migrations.map((m) => [m.numero, m.empreinte]));
  assert.equal(lues.schema, livre.schema);
  // le dossier livré porte aussi les références jointes (data/references/, lib/references-des-migrations.mjs), que ce module ignore
  for (const f of [REFERENCES.liens, REFERENCES.idsDesMotsCles]) assert.ok(existsSync(join(livree, f)), f);
  assert.ok(!lues.migrations.some((m) => m.fichier.endsWith('.json')));
});
