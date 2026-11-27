// Le contrôle des migrations de la CI (scripts/controler-les-migrations.mjs, -lib.mjs, -base.mjs ; lot 7 du chantier « la base du site de dev devient la source
// de vérité », R274, R275) : une migration fusionnée ne se modifie plus ; une migration de structure ne porte aucun texte de règle ; un renommage réécrit le
// journal et l'historique ; les migrations nouvelles passent sur une base remplie, par le code du service, sans rien perdre ; le bilan est rendu par migration.
// Les règles sont éprouvées sur du SQL (fonctions pures) et sur de petits dépôts git temporaires ; le passage sur une base remplie, sur celle des règles du
// dépôt ramenée à la version 128 (aide-structure-sur-place.mjs).
//   node --test test/scripts-controler-les-migrations.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { controlerLesMigrations } from '../scripts/controler-les-migrations.mjs';
import { TABLES_A_NE_PAS_PERDRE, essayerSurBaseRemplie, pertesDuBilan } from '../scripts/controler-les-migrations-base.mjs';
import {
  AVERTISSEMENT_DONNEES, ErreurDeControle, TABLES_QUI_GARDENT_DES_NOMS, analyserUneMigration, decouperLeSql, rendreLeResume, reglesDUneMigration, reglesDesFichiers,
} from '../scripts/controler-les-migrations-lib.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';
import { LIVRAISON, NUMERO, RACINE, baseRemplie, etatDuFichier, schemaDuDepot } from './aide-structure-sur-place.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'controler-les-migrations.mjs');
const regles = (violations) => violations.map((v) => v.regle);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le SQL : découpage et nature
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('le découpage respecte les chaînes, les commentaires et le corps d’un déclencheur', () => {
  const sql = `-- un commentaire ; avec un point-virgule
    CREATE TABLE t (a TEXT DEFAULT 'x;y'); /* un autre ; commentaire */
    CREATE TRIGGER t_ai AFTER INSERT ON t BEGIN
      UPDATE t SET a = CASE WHEN new.a = 'z' THEN 'un; texte' ELSE a END;
      DELETE FROM t WHERE a IS NULL;
    END;
    UPDATE t SET a = 'l''apostrophe; et ça';`;
  const instructions = decouperLeSql(sql);
  assert.deepEqual(instructions.map((i) => i[0].v.toUpperCase()), ['CREATE', 'CREATE', 'UPDATE']);
  assert.ok(instructions[1].some((j) => j.t === 'w' && j.v === 'DELETE'), 'le corps du déclencheur reste dans son instruction');
  assert.equal(instructions[2].find((j) => j.t === 'str').v, 'l’apostrophe; et ça'.replace('’', "'"));
});

test('une migration avec du DDL est « de structure », sans DDL « de données »', () => {
  assert.equal(analyserUneMigration('CREATE TABLE t (a TEXT) STRICT; INSERT INTO t SELECT 1;').nature, 'structure');
  assert.equal(analyserUneMigration('ALTER TABLE t ADD COLUMN b TEXT;').nature, 'structure');
  assert.equal(analyserUneMigration('DROP INDEX i;').nature, 'structure');
  assert.equal(analyserUneMigration("UPDATE t SET a = 'x'; DELETE FROM t WHERE a IS NULL;").nature, 'donnees');
  assert.equal(analyserUneMigration('-- seulement un commentaire').nature, 'donnees');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// « Figées une fois fusionnées » et les numéros
// ---------------------------------------------------------------------------------------------------------------------------------------------
const lot = (objet) => new Map(Object.entries(objet));

test('figee : une migration fusionnée modifiée, supprimée ou renommée est refusée, son registre .json aussi ; seul le nouveau passe', () => {
  const base = lot({ '0001-a.sql': 'CREATE TABLE a (x TEXT);\n', '0002-b.sql': 'CREATE TABLE b (x TEXT);\n', '0002-b.json': '{"v":1}\n' });
  const intact = reglesDesFichiers(base, lot({ ...Object.fromEntries(base), '0003-c.sql': 'CREATE TABLE c (x TEXT);\n' }));
  assert.deepEqual(intact.violations, []);
  assert.deepEqual(intact.nouvelles, ['0003-c.sql']);

  const modifiee = reglesDesFichiers(base, lot({ '0001-a.sql': 'CREATE TABLE a (x TEXT, y TEXT);\n', '0002-b.sql': base.get('0002-b.sql'), '0002-b.json': base.get('0002-b.json') }));
  assert.deepEqual(modifiee.violations.map((v) => [v.fichier, v.regle]), [['0001-a.sql', 'figee']]);

  const registre = reglesDesFichiers(base, lot({ '0001-a.sql': base.get('0001-a.sql'), '0002-b.sql': base.get('0002-b.sql'), '0002-b.json': '{"v":2}\n' }));
  assert.deepEqual(registre.violations.map((v) => [v.fichier, v.regle]), [['0002-b.json', 'figee']]);

  const supprimee = reglesDesFichiers(base, lot({ '0002-b.sql': base.get('0002-b.sql'), '0002-b.json': base.get('0002-b.json') }));
  assert.deepEqual(supprimee.violations.map((v) => [v.fichier, v.regle]), [['0001-a.sql', 'figee']], 'une migration ne s’annule pas : on en écrit une autre');

  const renommee = reglesDesFichiers(base, lot({ '0001-autre.sql': base.get('0001-a.sql'), '0002-b.sql': base.get('0002-b.sql'), '0002-b.json': base.get('0002-b.json') }));
  assert.ok(renommee.violations.some((v) => v.fichier === '0001-a.sql' && v.regle === 'figee'), 'le fichier d’avant a disparu');
});

test('figee : un simple changement de fins de ligne n’est pas une modification', () => {
  const base = lot({ '0001-a.sql': 'CREATE TABLE a (x TEXT);\nSELECT 1;\n' });
  assert.deepEqual(reglesDesFichiers(base, lot({ '0001-a.sql': 'CREATE TABLE a (x TEXT);\r\nSELECT 1;\r\n' })).violations, []);
});

test('numero : un numéro déjà pris à la base, ou deux fichiers pour un numéro, sont refusés', () => {
  const base = lot({ '0001-a.sql': 'x', '0002-b.sql': 'x' });
  const arriere = reglesDesFichiers(base, lot({ ...Object.fromEntries(base), '0002-autre.sql': 'x' }));
  assert.deepEqual(arriere.violations.map((v) => [v.fichier, v.regle]), [['0002-autre.sql', 'numero']]);
  const double = reglesDesFichiers(base, lot({ ...Object.fromEntries(base), '0003-c.sql': 'x', '0003-d.sql': 'x' }));
  assert.deepEqual(double.violations.map((v) => [v.fichier, v.regle]).sort(), [['0003-c.sql', 'numero'], ['0003-d.sql', 'numero']]);
});

test('numero : le schema.sql de la base est le plancher — des migrations sorties du dépôt (les mixtes, R296) laissent leur numéro pris', () => {
  const base = lot({ '0001-a.sql': 'x', '0002-b.sql': 'x' });
  const sous = reglesDesFichiers(base, lot({ ...Object.fromEntries(base), '0004-c.sql': 'x' }), { plancher: 4 });
  assert.deepEqual(sous.violations.map((v) => [v.fichier, v.regle]), [['0004-c.sql', 'numero']], 'le schema.sql de la base est déjà à la version 4');
  assert.deepEqual(reglesDesFichiers(base, lot({ ...Object.fromEntries(base), '0005-c.sql': 'x' }), { plancher: 4 }).violations, [], 'au-dessus du plancher');
  assert.deepEqual(reglesDesFichiers(base, lot({ ...Object.fromEntries(base), '0003-c.sql': 'x' })).violations, [], 'sans plancher, comme avant');
  assert.deepEqual(reglesDesFichiers(base, lot({ ...Object.fromEntries(base), '0003-c.sql': 'x' }), { plancher: 2 }).violations, [], 'plancher égal à la dernière : rien ne change');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// « La structure sans texte de règle »
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('structure : du DDL avec un INSERT … VALUES d’un texte de règle est refusé, avec la consigne de le scinder en deux', () => {
  const { violations } = reglesDUneMigration('0130-essai.sql', "CREATE TABLE neuve (id INTEGER PRIMARY KEY, texte TEXT) STRICT;\nINSERT INTO neuve (id, texte) VALUES (1, 'Un texte de règle, avec des espaces.');\n");
  assert.deepEqual(regles(violations), ['structure']);
  assert.match(violations[0].message, /0130-essai\.sql/, 'le fichier est dit');
  assert.match(violations[0].message, /scinder en deux/);
});

test('structure : un code, un nombre, NULL et une chaîne vide sont admis ; recopier ou déplacer des colonnes aussi', () => {
  const admis = [
    "ALTER TABLE t ADD COLUMN nature TEXT; UPDATE t SET nature = 'migration';",
    "ALTER TABLE t ADD COLUMN mode TEXT; UPDATE t SET mode = 'sur_place' WHERE id = 3 AND code = 'a-b.c1';",
    'ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = a;',
    'CREATE TABLE n (a TEXT, b INTEGER) STRICT; INSERT INTO n (a, b) SELECT a, 1 FROM t;',
    "CREATE TABLE n (a TEXT, b INTEGER, c TEXT) STRICT; INSERT INTO n VALUES ('un_code', -4, NULL), ('', 0.5, 'x');",
  ];
  for (const sql of admis) assert.deepEqual(reglesDUneMigration('0130-essai.sql', sql).violations, [], sql);
});

test('structure : un texte avec des espaces, une majuscule, un blob ou plus de 80 caractères est refusé, même caché dans un WHERE ou un CASE', () => {
  const refuses = [
    "ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = 'Texte';",
    "ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = 'deux mots';",
    "ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = a WHERE nom = 'Épée longue';",
    "ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = CASE WHEN a = 1 THEN 'oui puis non' ELSE a END;",
    `ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = '${'a'.repeat(81)}';`,
    "ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = x'4142';",
    "ALTER TABLE t ADD COLUMN b TEXT; UPDATE t SET b = 'a; -- b';",
  ];
  for (const sql of refuses) assert.deepEqual(regles(reglesDUneMigration('0130-essai.sql', sql).violations), ['structure'], sql);
});

test('structure : un DEFAULT ajouté par ALTER TABLE ou un CREATE TABLE … AS SELECT remplit des lignes : leurs littéraux suivent la règle du DML', () => {
  const refuses = [
    "ALTER TABLE t ADD COLUMN b TEXT NOT NULL DEFAULT 'Un texte de règle';",
    "ALTER TABLE t ADD COLUMN b TEXT DEFAULT ('Un texte' || 'x');",
    "CREATE TABLE n AS SELECT a, 'Un texte de règle' AS b FROM t;",
  ];
  for (const sql of refuses) assert.deepEqual(regles(reglesDUneMigration('0130-essai.sql', sql).violations), ['structure'], sql);
  const admis = [
    "ALTER TABLE t ADD COLUMN b TEXT NOT NULL DEFAULT 'migration';",
    'ALTER TABLE t ADD COLUMN b INTEGER NOT NULL DEFAULT 0;',
    "ALTER TABLE t ADD COLUMN b TEXT CHECK (b IN ('Un libellé', 'Un autre'));",
    "CREATE TABLE n AS SELECT a, 'un_code' AS b FROM t;",
    "CREATE TABLE n (a TEXT NOT NULL DEFAULT 'Une valeur par défaut') STRICT;",
  ];
  for (const sql of admis) assert.deepEqual(reglesDUneMigration('0130-essai.sql', sql).violations, [], sql);
});

test('structure : un chemin JSON, un format de strftime et un identifiant à « / » sont admis dans un DML de recopie, un texte avec espaces non', () => {
  const entete = 'ALTER TABLE t ADD COLUMN b TEXT; ';
  const admis = [
    "UPDATE t SET b = json_extract(a, '$.nom');",
    "UPDATE t SET b = json_extract(a, '$[0].x');",
    "UPDATE t SET b = strftime('%Y-%m-%dT%H:%M:%SZ', a);",
    "UPDATE t SET b = 'races/elfe-noir' WHERE a = 'metiers/forgeron';",
  ];
  for (const sql of admis) assert.deepEqual(reglesDUneMigration('0130-essai.sql', entete + sql).violations, [], sql);
  const refuses = ["UPDATE t SET b = json_extract(a, '$.un nom');", "UPDATE t SET b = strftime('%Y %m', a);", "UPDATE t SET b = 'races/Elfe noir';", `UPDATE t SET b = '${'a/'.repeat(41)}';`];
  for (const sql of refuses) assert.deepEqual(regles(reglesDUneMigration('0130-essai.sql', entete + sql).violations), ['structure'], sql);
});

test('structure : les littéraux des définitions (CHECK, DEFAULT, vue, déclencheur) ne sont pas du DML et ne comptent pas', () => {
  const sql = `CREATE TABLE n (a TEXT NOT NULL DEFAULT 'une valeur par défaut' CHECK (a IN ('Un libellé', 'Un autre'))) STRICT;
    CREATE VIEW v_n AS SELECT a, 'Un texte de vue' AS note FROM n;
    CREATE TRIGGER n_ai AFTER INSERT ON n BEGIN UPDATE n SET a = 'Un texte de déclencheur' WHERE rowid = new.rowid; END;`;
  assert.deepEqual(reglesDUneMigration('0130-essai.sql', sql).violations, []);
});

test('structure : la règle vaut à partir de la 0130 ; la 0129 (sa structure seule) et les migrations de données y échappent', () => {
  const melange = "CREATE TABLE neuve (a TEXT) STRICT; INSERT INTO neuve VALUES ('Un texte de règle');";
  assert.deepEqual(reglesDUneMigration('0129-essai.sql', melange).violations, []);
  assert.deepEqual(regles(reglesDUneMigration('0130-essai.sql', melange).violations), ['structure']);
  const donnees = reglesDUneMigration('0131-corrections.sql', "UPDATE page SET corps_md = 'Un texte de règle corrigé.' WHERE id = 'x';");
  assert.deepEqual(donnees.violations, [], 'une migration de données reste permise jusqu’à la bascule du lot 8');
  assert.equal(donnees.analyse.nature, 'donnees');
});

test('interdit : BEGIN, COMMIT, ROLLBACK et PRAGMA sont refusés (le service ouvre la transaction)', () => {
  for (const sql of ['BEGIN; CREATE TABLE t (a TEXT); COMMIT;', 'CREATE TABLE t (a TEXT); PRAGMA user_version = 130;', 'CREATE TABLE t (a TEXT); ROLLBACK;']) {
    assert.ok(regles(reglesDUneMigration('0130-essai.sql', sql).violations).includes('interdit'), sql);
  }
  assert.deepEqual(reglesDUneMigration('0130-essai.sql', "CREATE TABLE t (a TEXT); CREATE TRIGGER g AFTER INSERT ON t BEGIN UPDATE t SET a = 'x'; END;").violations, [], 'le BEGIN … END d’un déclencheur est le sien');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// « Les renommages »
// ---------------------------------------------------------------------------------------------------------------------------------------------
const reecritures = (de, vers) => [
  `UPDATE modification SET table_nom = '${vers}' WHERE table_nom = '${de}';`,
  `UPDATE historique_modification SET table_nom = '${vers}' WHERE table_nom = '${de}';`,
  `UPDATE lot_de_changements SET contenu = replace(contenu, '"table":"${de}"', '"table":"${vers}"');`,
  `UPDATE numero_donne SET table_nom = '${vers}' WHERE table_nom = '${de}';`,
].join('\n');

test('renommage : une table renommée sans réécrire le journal, l’historique, les lots et les numéros est refusée, puis admise avec', () => {
  const nu = reglesDUneMigration('0130-essai.sql', 'ALTER TABLE ancienne RENAME TO nouvelle;');
  assert.deepEqual(regles(nu.violations), ['renommage']);
  for (const table of TABLES_QUI_GARDENT_DES_NOMS) assert.ok(nu.violations[0].message.includes(table), `${table} est exigée`);
  const complet = reglesDUneMigration('0130-essai.sql', `ALTER TABLE ancienne RENAME TO nouvelle;\n${reecritures('ancienne', 'nouvelle')}`);
  assert.deepEqual(complet.violations, [], 'les chemins JSON et les noms des tables sont des littéraux admis dans un renommage');
});

test('renommage : il manque une table à réécrire, ou un UPDATE qui ne cite pas les deux noms : refusé, avec la table dite', () => {
  const sansHistorique = reecritures('ancienne', 'nouvelle').split('\n').filter((l) => !l.includes('historique_modification')).join('\n');
  const a = reglesDUneMigration('0130-essai.sql', `ALTER TABLE ancienne RENAME TO nouvelle;\n${sansHistorique}`);
  assert.deepEqual(regles(a.violations), ['renommage']);
  assert.ok(a.violations[0].message.includes('historique_modification'));
  assert.ok(!a.violations[0].message.includes('`modification`'), 'celle qui est réécrite n’est pas reprochée');
  const sansNouveau = reglesDUneMigration('0130-essai.sql', `ALTER TABLE ancienne RENAME TO nouvelle;\n${reecritures('ancienne', 'nouvelle').replaceAll("'nouvelle'", "'autre'").replaceAll('"nouvelle"', '"autre"')}`);
  assert.ok(regles(sansNouveau.violations).includes('renommage'), 'un UPDATE qui ne cite pas le nouveau nom ne réécrit rien');
});

test('renommage : une colonne renommée exige les mêmes réécritures', () => {
  const sql = 'ALTER TABLE race RENAME COLUMN ancien_nom TO nouveau_nom;';
  assert.deepEqual(regles(reglesDUneMigration('0130-essai.sql', sql).violations), ['renommage']);
  const reecrit = ['modification', 'historique_modification'].map((t) => `UPDATE ${t} SET apres = replace(apres, '"ancien_nom":', '"nouveau_nom":') WHERE table_nom = 'race';`).join('\n')
    + "\nUPDATE lot_de_changements SET contenu = replace(contenu, '\"ancien_nom\":', '\"nouveau_nom\":');\nUPDATE numero_donne SET colonne = 'nouveau_nom' WHERE colonne = 'ancien_nom' AND table_nom = 'race';";
  assert.deepEqual(reglesDUneMigration('0130-essai.sql', `${sql}\n${reecrit}`).violations, []);
});

test('renommage : la table recopiée sous un nom provisoire puis renommée, et l’ancienne mise de côté puis supprimée, ne sont pas des renommages', () => {
  const recopie = `CREATE TABLE t__0130 (a TEXT, b TEXT) STRICT; INSERT INTO t__0130 (a) SELECT a FROM t; DROP TABLE t; ALTER TABLE t__0130 RENAME TO t;`;
  const recopiee = reglesDUneMigration('0130-essai.sql', recopie);
  assert.deepEqual(recopiee.violations, []);
  assert.deepEqual(recopiee.analyse.renommages, []);
  const decalee = reglesDUneMigration('0130-essai.sql', 'ALTER TABLE t RENAME TO t__ancienne; CREATE TABLE t (a TEXT, b TEXT) STRICT; INSERT INTO t (a) SELECT a FROM t__ancienne; DROP TABLE t__ancienne;');
  assert.deepEqual(decalee.violations, []);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Un petit dépôt git : la comparaison au merge-base, l'arbre tel qu'il est sur le disque
// ---------------------------------------------------------------------------------------------------------------------------------------------
const git = (racine, ...args) => {
  const r = spawnSync('git', ['-C', racine, '-c', 'user.name=essai', '-c', 'user.email=essai@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};

/** Écrit (ou, pour `null`, supprime) des fichiers sous `racine`. */
function ecrire(racine, fichiers) {
  for (const [chemin, texte] of Object.entries(fichiers)) {
    const complet = join(racine, chemin);
    if (texte === null) { rmSync(complet, { force: true }); continue; }
    mkdirSync(dirname(complet), { recursive: true });
    writeFileSync(complet, texte);
  }
}

const HISTORIQUE = `historique_modification (lot_id TEXT NOT NULL, rang INTEGER NOT NULL, fait_le TEXT NOT NULL, resume TEXT NOT NULL, version TEXT, table_nom TEXT NOT NULL,
  cle TEXT NOT NULL, operation TEXT NOT NULL, avant TEXT, apres TEXT, PRIMARY KEY (lot_id, rang))`;
/** Un schéma minimal à la version `version` (une race, un métier, l'historique), plus `extra`. */
const schemaMini = (version, extra = '') => `PRAGMA user_version = ${version};
CREATE TABLE race (id TEXT NOT NULL PRIMARY KEY, nom TEXT NOT NULL) STRICT;
CREATE TABLE metier (id TEXT NOT NULL PRIMARY KEY, nom TEXT NOT NULL) STRICT;
CREATE TABLE ${HISTORIQUE} STRICT;
${extra}`;
const LIGNES = { 'data/rows/VERSION': 'schema_version=129\n', 'data/rows/race.sql': "INSERT INTO race (id, nom) VALUES ('r1', 'Race 1');\n", 'data/rows/metier.sql': "INSERT INTO metier (id, nom) VALUES ('m1', 'Métier 1');\n", 'data/rows/historique_modification.sql': '-- vide\n' };

/** Un dépôt dont HEAD est la version 129 (une migration 0129, un schéma, ses lignes) ; `arbre` (fichiers écrits ensuite, non commités) fait la PR. */
function depot(t, arbre = {}, { depart = {} } = {}) {
  const racine = dossierTemporaire('migrations-depot', { t });
  git(racine, 'init', '-q');
  ecrire(racine, { 'data/schema.sql': schemaMini(129), ...LIGNES, 'data/migrations/0129-depart.sql': '-- le départ\n', ...depart });
  git(racine, 'add', '-A');
  git(racine, 'commit', '-q', '-m', 'base');
  ecrire(racine, arbre);
  return racine;
}

const NOUVELLE_TABLE = 'CREATE TABLE neuve (id INTEGER NOT NULL PRIMARY KEY, code TEXT) STRICT;\n';
const SCHEMA_130 = schemaMini(130, NOUVELLE_TABLE.trim());

test('git : une migration fusionnée modifiée ou supprimée dans l’arbre est refusée, une migration nouvelle bien formée passe', (t) => {
  const racine = depot(t, { 'data/migrations/0129-depart.sql': '-- le départ, retouché\n' });
  const modifiee = controlerLesMigrations({ racine, base: 'HEAD', essai: false });
  assert.deepEqual(modifiee.violations.map((v) => [v.fichier, v.regle]), [['0129-depart.sql', 'figee']]);
  ecrire(racine, { 'data/migrations/0129-depart.sql': null });
  assert.deepEqual(controlerLesMigrations({ racine, base: 'HEAD', essai: false }).violations.map((v) => [v.fichier, v.regle]), [['0129-depart.sql', 'figee']]);

  const bonne = depot(t, { 'data/migrations/0130-neuve.sql': NOUVELLE_TABLE, 'data/schema.sql': SCHEMA_130 });
  const r = controlerLesMigrations({ racine: bonne, base: 'HEAD', essai: false });
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.nouvelles, [{ fichier: '0130-neuve.sql', numero: 130, nature: 'structure' }]);
  assert.equal(r.version, 129);
});

test('git : le schema.sql de la base est le plancher — une base dont il dépasse la dernière migration (mixtes sorties) refuse une migration sous lui', (t) => {
  const depart = { 'data/schema.sql': schemaMini(131) };
  const sous = depot(t, { 'data/migrations/0130-neuve.sql': NOUVELLE_TABLE }, { depart });
  const r = controlerLesMigrations({ racine: sous, base: 'HEAD', essai: false });
  assert.deepEqual(r.violations.map((v) => [v.fichier, v.regle]), [['0130-neuve.sql', 'numero']]);
  assert.equal(r.version, 131, 'la version de la base est celle de son schema.sql');
  const dessus = depot(t, { 'data/migrations/0132-neuve.sql': NOUVELLE_TABLE, 'data/schema.sql': schemaMini(132, NOUVELLE_TABLE.trim()) }, { depart });
  assert.deepEqual(controlerLesMigrations({ racine: dessus, base: 'HEAD', essai: false }).violations, []);
});

test('git : la base est le merge-base, pas la pointe de la branche de comparaison (une migration fusionnée depuis n’est pas « supprimée »)', (t) => {
  const racine = depot(t);
  git(racine, 'branch', 'fourche');
  ecrire(racine, { 'data/migrations/0130-ailleurs.sql': NOUVELLE_TABLE });
  git(racine, 'add', '-A');
  git(racine, 'commit', '-q', '-m', 'une autre PR fusionnée après la fourche');
  const base = git(racine, 'rev-parse', '--abbrev-ref', 'HEAD');
  git(racine, 'checkout', '-q', 'fourche');
  const r = controlerLesMigrations({ racine, base, essai: false });
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.nouvelles, []);
  assert.equal(r.mergeBase, git(racine, 'rev-parse', 'fourche'));
});

test('git : une migration de données est signalée mais admise ; sans migration nouvelle, rien à dire', (t) => {
  const racine = depot(t, { 'data/migrations/0130-corrections.sql': "UPDATE race SET nom = 'Une race corrigée' WHERE id = 'r1';\n" });
  const r = controlerLesMigrations({ racine, base: 'HEAD', essai: false });
  assert.deepEqual(r.violations, []);
  assert.equal(r.nouvelles[0].nature, 'donnees');
  assert.ok(r.avertissements.some((a) => a.includes('0130-corrections.sql') && a.includes(AVERTISSEMENT_DONNEES)));
  const rien = controlerLesMigrations({ racine: depot(t), base: 'HEAD' });
  assert.deepEqual([rien.nouvelles, rien.violations, rien.essai], [[], [], null], 'sans migration nouvelle, la base n’est même pas reconstruite');
  assert.match(rendreLeResume(rien), /Aucune migration nouvelle/);
});

test('git : une base introuvable est une erreur de dépôt, pas une règle violée', (t) => {
  assert.throws(() => controlerLesMigrations({ racine: depot(t), base: 'origine/absente', essai: false }), ErreurDeControle);
});

test('git : sur une base remplie, une migration de structure bien formée est acceptée avec son bilan ; une qui donne un schéma faux est refusée', (t) => {
  const bonne = depot(t, { 'data/migrations/0130-neuve.sql': NOUVELLE_TABLE, 'data/schema.sql': SCHEMA_130 });
  const r = controlerLesMigrations({ racine: bonne, base: 'HEAD', dossier: dossierTemporaire('migrations-travail', { t }) });
  assert.deepEqual(r.violations, []);
  assert.equal(r.essai.verdict, 'accepte');
  assert.deepEqual(r.essai.etapes.map((e) => [e.fichier, e.nature, e.avant, e.apres]), [['0130-neuve.sql', 'structure', 129, 130]]);
  assert.deepEqual(r.essai.etapes[0].bilan.tables.creees, [{ table: 'neuve', lignes: 0 }]);
  assert.ok(r.essai.etapes[0].bilan.tables.inchangees.includes('historique_modification'), 'l’historique rempli est inchangé');

  // le schéma de l'arbre n'est pas celui que la migration donne
  const fausse = depot(t, { 'data/migrations/0130-neuve.sql': NOUVELLE_TABLE, 'data/schema.sql': schemaMini(130, 'CREATE TABLE neuve (id INTEGER NOT NULL PRIMARY KEY) STRICT;') });
  const f = controlerLesMigrations({ racine: fausse, base: 'HEAD', dossier: dossierTemporaire('migrations-travail', { t }) });
  assert.deepEqual(regles(f.violations), ['base-remplie']);
  assert.equal(f.essai.refus.etape, 'schema');
  assert.equal(f.violations[0].fichier, '0130-neuve.sql');
});

test('script : le code de sortie dit la règle violée (1), la réussite (0) ou une base introuvable (2) ; le bilan est ajouté au fichier du résumé ; aucun dossier ne reste', (t) => {
  const travail = dossierTemporaire('migrations-script', { t });
  const lancer = (racine, ...args) => spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--racine', racine, ...args], { encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(travail) } });
  const resume = join(travail, 'resume.md');
  writeFileSync(resume, 'avant\n');

  const bonne = lancer(depot(t, { 'data/migrations/0130-neuve.sql': NOUVELLE_TABLE, 'data/schema.sql': SCHEMA_130 }), '--base', 'HEAD', '--resume', resume);
  assert.equal(bonne.status, 0, bonne.stderr);
  assert.match(bonne.stdout, /0130-neuve\.sql/);
  assert.match(bonne.stdout, /<details>/, 'les tables à l’empreinte inchangée sont repliées');
  const ecrit = readFileSync(resume, 'utf8');
  assert.ok(ecrit.startsWith('avant\n') && ecrit.includes('0130-neuve.sql'), 'le bilan est AJOUTÉ (le résumé d’une CI est partagé entre les étapes)');

  const mauvaise = lancer(depot(t, { 'data/migrations/0129-depart.sql': '-- retouchée\n' }), '--base', 'HEAD', '--sans-essai');
  assert.equal(mauvaise.status, 1);
  assert.match(mauvaise.stderr, /0129-depart\.sql/);
  assert.match(mauvaise.stderr, /figee/);

  assert.equal(lancer(depot(t), '--base', 'origine/absente').status, 2);
  // une erreur qui n'est pas une règle violée (ici, le résumé ne peut pas s'écrire) sort en 2, jamais en 1
  const inattendue = lancer(depot(t), '--base', 'HEAD', '--sans-essai', '--resume', join(travail, 'absent', 'resume.md'));
  assert.equal(inattendue.status, 2, inattendue.stderr);
  assert.match(inattendue.stderr, /impossible/);
  const tmp = readdirSync(travail).filter((n) => n.startsWith('maverick-migrations-'));
  assert.deepEqual(tmp, [], 'les dossiers de travail du script sont effacés');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le passage sur la base remplie des règles (la version d'avant `NUMERO`, avec ses fiches, son journal et son historique)
// ---------------------------------------------------------------------------------------------------------------------------------------------
const migration = (numero, sql) => ({ numero, fichier: `${String(numero).padStart(4, '0')}-essai.sql`, empreinte: 'a'.repeat(64), sql });
// Les migrations réelles à appliquer sur la base d'avant : celle qui crée `migration_recue` (NUMERO, calculé) et celles qui la suivent (la base d'avant n'a ni leur
// structure ni la sienne : test/aide-structure-sur-place.mjs#annulerLesMigrations) ; la dernière livrée fixe la version du schema.sql. Lues dans la livraison des
// tests (test/aide-structure-sur-place.mjs#LIVRAISON : celle du dépôt, ou au-dessus du plancher quand les migrations mixtes sont sorties).
const REELLES = readdirSync(LIVRAISON.migrations).filter((f) => /^\d{4}-.*\.sql$/.test(f) && Number(f.slice(0, 4)) >= NUMERO).sort()
  .map((fichier) => ({ numero: Number(fichier.slice(0, 4)), fichier, empreinte: 'a'.repeat(64), sql: readFileSync(join(LIVRAISON.migrations, fichier), 'utf8') }));
const FICHIER_0129 = REELLES[0].fichier;
const DERNIERE = REELLES.at(-1).numero;
/** Les migrations réelles, `extra` (du SQL) ajouté à la première (celle qui crée `migration_recue`). */
const reellesAvec = (extra) => [{ ...REELLES[0], sql: `${REELLES[0].sql}\n${extra}` }, ...REELLES.slice(1)];
const schemaA = (version, extra = '') => `${schemaDuDepot().replace(/PRAGMA user_version\s*=\s*\d+;/, `PRAGMA user_version = ${version};`)}\n${extra}\n`;

function essai(t, migrations, schema = schemaDuDepot()) {
  const { chemin } = baseRemplie({ anterieure: true });
  const avant = etatDuFichier(chemin);
  const resultat = essayerSurBaseRemplie({ base: chemin, migrations, schema, dossier: dossierTemporaire('migrations-essai', { t }) });
  assert.deepEqual(etatDuFichier(chemin), avant, 'la base de départ n’est jamais écrite : l’essai se fait sur une copie');
  return resultat;
}

test('base remplie : les migrations livrées depuis la 0129 (qui crée migration_recue) sur la base d’avant sont admises, leur bilan crée migration_recue et laisse le reste intact (fiches, journal, historique)', (t) => {
  const r = essai(t, REELLES);
  assert.equal(r.verdict, 'accepte');
  assert.equal(r.avant, NUMERO - 1);
  assert.equal(r.etapes.length, REELLES.length);
  const { bilan } = r.etapes[0];
  assert.deepEqual(bilan.tables.creees, [{ table: 'migration_recue', lignes: 0 }]);
  for (const etape of r.etapes) {
    // une migration qui ajoute une colonne (0131 : page.mot_cle_id et sort.mot_cle_id) change la forme de sa table, jamais ses lignes ; aucune autre table ne change
    const sql = REELLES.find((m) => m.fichier === etape.fichier).sql;
    const alterees = [...new Set([...sql.matchAll(/ALTER\s+TABLE\s+(\w+)\s+ADD\b/gi)].map((m) => m[1]))].sort();
    const { modifiees } = etape.bilan.tables;
    assert.deepEqual(Object.keys(modifiees).sort(), alterees, `${etape.fichier} : aucune autre table ne change`);
    for (const [table, e] of Object.entries(modifiees)) assert.deepEqual([e.ajoutees, e.retirees, e.modifiees], [0, 0, 0], `${etape.fichier} : ${table} garde toutes ses lignes`);
  }
  for (const table of ['personnage', 'groupe', 'utilisateur', 'modification_lot', 'modification', 'historique_modification', 'lot_de_changements', 'numero_donne', 'race']) {
    assert.ok(bilan.tables.inchangees.includes(table), `${table} : empreinte inchangée`);
  }
  const resume = rendreLeResume({ base: 'origin/dev', mergeBase: 'a'.repeat(40), version: NUMERO - 1, nouvelles: [{ fichier: FICHIER_0129, numero: NUMERO, nature: 'structure' }], violations: [], avertissements: [], essai: { ...r, etapes: [{ ...r.etapes[0], nature: 'structure' }] } });
  assert.ok(resume.includes('migration_recue') && resume.includes('table créée'));
  assert.ok(/<details><summary>\d+ tables? à l’empreinte inchangée<\/summary>/.test(resume));
});

test('base remplie : une migration qui rompt une clé étrangère est refusée, et la base n’a pas bougé', (t) => {
  const r = essai(t, reellesAvec("DELETE FROM race WHERE id = (SELECT race_id FROM personnage WHERE id = 'essai-structure-pretire');"));
  assert.equal(r.verdict, 'refuse');
  assert.equal(r.refus.etape, 'cles_etrangeres');
  assert.ok(r.refus.details.some((d) => d.startsWith('personnage → race')), 'la table fautive est dite');
});

test('base remplie : une migration qui donne un autre schéma que data/schema.sql est refusée', (t) => {
  const r = essai(t, [migration(NUMERO, 'CREATE TABLE essai_faux (id INTEGER NOT NULL PRIMARY KEY) STRICT;'), ...REELLES.slice(1)]);
  assert.equal(r.verdict, 'refuse');
  assert.equal(r.refus.etape, 'schema');
  assert.ok(r.refus.details.length > 0);
});

test('base remplie : une migration qui retire des fiches, du journal ou de l’historique est refusée même si le schéma est le bon', (t) => {
  for (const [retrait, table] of [['DELETE FROM historique_modification;', 'historique_modification'], ["DELETE FROM personnage WHERE nature = 'pretire';", 'personnage'], ['DELETE FROM modification;', 'modification']]) {
    const r = essai(t, reellesAvec(retrait));
    assert.equal(r.verdict, 'perte', retrait);
    assert.ok(r.pertes.some((p) => p.includes(table)), `${table} est dite perdue`);
  }
});

test('base remplie : plusieurs migrations nouvelles : un bilan par migration, dans l’ordre, de la version d’avant à la version d’après', (t) => {
  const suite = 'CREATE TABLE essai_suite (id INTEGER NOT NULL PRIMARY KEY) STRICT;';
  const r = essai(t, [...REELLES, migration(DERNIERE + 1, suite)], schemaA(DERNIERE + 1, suite));
  assert.equal(r.verdict, 'accepte');
  assert.deepEqual(r.etapes.map((e) => [e.numero, e.avant, e.apres]), [...REELLES, { numero: DERNIERE + 1 }].map((m) => [m.numero, m.numero - 1, m.numero]));
  assert.deepEqual(r.etapes[0].bilan.tables.creees.map((x) => x.table), ['migration_recue']);
  assert.deepEqual(r.etapes.at(-1).bilan.tables.creees.map((x) => x.table), ['essai_suite'], 'la dernière ne montre que ce qu’elle a changé');
});

test('base remplie : une migration de données (UPDATE) montre les lignes modifiées de sa table et rien d’autre', (t) => {
  const r = essai(t, reellesAvec("UPDATE race SET nom = nom || ' ' WHERE id = (SELECT min(id) FROM race);"));
  assert.equal(r.verdict, 'accepte');
  assert.deepEqual(r.etapes[0].bilan.tables.modifiees.race, { ajoutees: 0, retirees: 0, modifiees: 1, colonnes_ajoutees: [], colonnes_retirees: [], structure_changee: false });
});

test('base remplie : rien à appliquer sur une base à jour', (t) => {
  const { chemin } = baseRemplie();
  const r = essayerSurBaseRemplie({ base: chemin, migrations: REELLES, schema: schemaDuDepot(), dossier: dossierTemporaire('migrations-essai', { t }) });
  assert.equal(r.verdict, 'a_jour');
});

test('la base remplie porte de quoi perdre : des lignes dans chaque table que le contrôle protège', () => {
  // le compte (et la fiche de joueur, inscrite au groupe) n'est posé qu'à partir de la version de la migration 0132 (connexion Discord, R310) : la
  // base d'avant (version NUMERO - 1) n'en a pas, la base courante si
  const anterieure = new DatabaseSync(baseRemplie({ anterieure: true }).chemin, { readOnly: true });
  const courante = new DatabaseSync(baseRemplie().chemin, { readOnly: true });
  try {
    const compte = ['groupe_membre', 'utilisateur'];
    for (const table of ['personnage', ...compte, 'modification_lot', 'modification', 'historique_modification', 'lot_de_changements', 'numero_donne']) {
      assert.ok(TABLES_A_NE_PAS_PERDRE.includes(table), `${table} est protégée`);
      const db = compte.includes(table) ? courante : anterieure;
      assert.ok(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n >= 1, `${table} est remplie`);
    }
    for (const table of compte) assert.equal(anterieure.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, `${table} : aucun compte avant 0132`);
  } finally {
    anterieure.close();
    courante.close();
  }
});

test('pertesDuBilan : une table protégée retirée, des lignes retirées ou une colonne retirée sont dites ; une autre table ne compte pas', () => {
  const bilan = {
    tables: {
      retirees: [{ table: 'modification', lignes: 3 }, { table: 'sort', lignes: 9 }],
      modifiees: {
        personnage: { ajoutees: 0, retirees: 2, modifiees: 0, colonnes_retirees: ['notes'] },
        historique_modification: { ajoutees: 5, retirees: 0, modifiees: 4, colonnes_retirees: [] },
        sort: { ajoutees: 0, retirees: 7, modifiees: 0, colonnes_retirees: [] },
      },
    },
  };
  const { pertes, colonnes } = pertesDuBilan(bilan);
  assert.equal(pertes.length, 2);
  assert.ok(pertes.some((p) => p.includes('modification')) && pertes.some((p) => p.includes('personnage')));
  assert.ok(colonnes.some((c) => c.includes('notes')));
  assert.ok(!pertes.concat(colonnes).some((p) => p.includes('sort')));
});

test('le résumé : refus, signalés et tables repliées', () => {
  const resume = rendreLeResume({
    base: 'origin/dev', mergeBase: 'b'.repeat(40), version: 129,
    nouvelles: [{ fichier: '0130-x.sql', numero: 130, nature: 'donnees' }],
    violations: [{ fichier: '0129-depart.sql', regle: 'figee', message: 'modifiée' }],
    avertissements: ['0130-x.sql — signalée'],
    essai: null,
  });
  assert.ok(resume.includes('0129-depart.sql') && resume.includes('figee'));
  assert.ok(resume.includes('signalée'));
});
