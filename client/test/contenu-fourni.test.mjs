// MAVERICK_CONTENU (src/lib/contenu-fourni.mjs ; lot 9 du chantier de la base de dev) : tout ce qui lit la base au build lit une copie du fichier de
// contenu fourni, sans data/rows, sans jamais modifier le fichier ; sans la variable, rien ne change.
//   node --test test/contenu-fourni.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { integrationReference } from '../scripts/db-reference.mjs';
import { preparerLeContenu } from '../scripts/db-preparer-contenu.mjs';
import {
  ErreurContenuFourni, VARIABLE_DU_CONTENU, VARIABLE_DU_CONTENU_DERIVE, VUE_DE_L_EXTRAIT, contenuDejaDerive, contenuFourni, preparerLaCopie, versionDuSchemaSql,
} from '../src/lib/contenu-fourni.mjs';
import { copieDEssai, empreinteDuFichier, listeDuDossier } from './aide-contenu-fourni.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const RACINE = join(CLIENT, '..');
const DONNEES = pathToFileURL(join(CLIENT, 'src', 'lib', 'donnees.mjs')).href;
const MARQUE = 'Zqx marque du contenu fourni';

/** Un faux dépôt SANS data/rows : le schéma (c'est du code) et un lien vers client/. Comme le kit du site de dev. */
function depotSansLignes(t) {
  const depot = dossierTemporaire('contenu-fourni-depot', { t });
  mkdirSync(join(depot, 'data'));
  copyFileSync(join(RACINE, 'data', 'schema.sql'), join(depot, 'data', 'schema.sql'));
  symlinkSync(CLIENT, join(depot, 'client'));
  return depot;
}

/** Une copie de l'extrait où une page porte la marque dans son résumé : une valeur que data/rows n'a pas. Rend { fichier, page: { id, type, slug } }. */
function contenuMarque(t) {
  const dossier = dossierTemporaire('contenu-fourni-fichier', { t });
  let page;
  const fichier = copieDEssai(dossier, (db) => {
    page = db.prepare('SELECT id, type, slug FROM page ORDER BY id LIMIT 1').get();
    db.prepare('UPDATE page SET resume = ? WHERE id = ?').run(MARQUE, page.id);
  });
  return { dossier, fichier, page };
}

/** Lit la base du build dans un processus neuf (la base est ouverte une fois par processus) : { racine, pages, exemples, marque, fts, vue, version, tableDEssai }. */
function lireLaBase(depot, env) {
  const code = `
    const { ouvrirBase, trouverRacine } = await import(process.env.TEST_DONNEES);
    const db = ouvrirBase();
    const un = (sql, ...p) => db.prepare(sql).get(...p);
    console.log(JSON.stringify({
      racine: trouverRacine(),
      pages: un('SELECT count(*) AS n FROM page').n,
      exemples: un("SELECT count(*) AS n FROM page WHERE statut = 'example'").n,
      marque: process.env.TEST_PAGE ? un('SELECT resume FROM page WHERE id = ?', process.env.TEST_PAGE)?.resume ?? null : null,
      fts: un('SELECT count(*) AS n FROM page_fts').n,
      vue: un("SELECT count(*) AS n FROM sqlite_master WHERE name = 'extrait_meta'").n,
      version: un('PRAGMA user_version').user_version,
      tableDEssai: un("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?", process.env.TEST_TABLE ?? '').n,
    }));`;
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', code], {
    cwd: depot, encoding: 'utf8', env: { PATH: process.env.PATH, ...variablesTemporaires(dossierTemporaire('contenu-fourni-tmp')), MAVERICK_ROOT: depot, TEST_DONNEES: DONNEES, ...env },
  });
  return { statut: r.status, erreur: r.stderr, sortie: r.status === 0 ? JSON.parse(r.stdout) : null };
}

test('la variable : absente ou vide, rien ; posée, le chemin absolu ; un fichier introuvable ou un dossier est une erreur, jamais un repli sur data/rows', (t) => {
  assert.equal(contenuFourni({}), null);
  assert.equal(contenuFourni({ [VARIABLE_DU_CONTENU]: '' }), null);
  assert.equal(contenuFourni({ [VARIABLE_DU_CONTENU]: '   ' }), null);
  const dossier = dossierTemporaire('contenu-fourni-variable', { t });
  const fichier = copieDEssai(dossier);
  assert.equal(contenuFourni({ [VARIABLE_DU_CONTENU]: fichier }), fichier);
  assert.throws(() => contenuFourni({ [VARIABLE_DU_CONTENU]: join(dossier, 'absent.db') }), /introuvable/);
  assert.throws(() => contenuFourni({ [VARIABLE_DU_CONTENU]: dossier }), /pas un fichier/);
});

test('sans la variable, le build par défaut exige toujours data/rows : un dépôt sans lignes est écarté (rien ne change)', (t) => {
  const depot = depotSansLignes(t);
  const r = lireLaBase(depot, {});
  assert.equal(r.statut, 0, r.erreur);
  assert.equal(r.sortie.racine, RACINE, 'MAVERICK_ROOT sans data/rows n’est pas retenu : on remonte au dépôt qui les a');
  assert.equal(r.sortie.marque, null);
});

test('avec la variable, la base du build est une copie du fichier fourni, dans un dépôt sans data/rows ; le fichier n’est pas modifié', (t) => {
  const depot = depotSansLignes(t);
  assert.ok(!existsSync(join(depot, 'data', 'rows')));
  const { dossier, fichier, page } = contenuMarque(t);
  const avant = { empreinte: empreinteDuFichier(fichier), liste: listeDuDossier(dossier) };
  const origine = new DatabaseSync(fichier, { readOnly: true });
  const pages = origine.prepare('SELECT count(*) AS n FROM page').get().n;
  const hors = origine.prepare("SELECT count(*) AS n FROM page WHERE statut <> 'example'").get().n;
  origine.close();

  const complet = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier, TEST_PAGE: page.id });
  assert.equal(complet.statut, 0, complet.erreur);
  assert.equal(complet.sortie.racine, depot);
  assert.equal(complet.sortie.marque, MARQUE, 'la base lue est celle du fichier fourni');
  assert.equal(complet.sortie.pages, pages);
  assert.ok(complet.sortie.fts > 0, 'les tables calculées sont recalculées (db-derive)');

  const sansExemples = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier, HIDE_EXAMPLES: '1', TEST_PAGE: page.id });
  assert.equal(sansExemples.statut, 0, sansExemples.erreur);
  assert.equal(sansExemples.sortie.pages, hors, 'HIDE_EXAMPLES=1 passe db-derive --sans-exemples');
  assert.equal(sansExemples.sortie.exemples, 0);

  assert.equal(empreinteDuFichier(fichier), avant.empreinte, 'le fichier fourni est intact');
  assert.deepEqual(listeDuDossier(dossier), avant.liste, 'et rien ne s’est posé à côté (copie, journal)');
});

test('fabrication en deux temps : un fichier déjà dérivé est copié tel quel, db-derive ne tourne pas dans le processus du build ; sans la variable interne, il est dérivé', (t) => {
  assert.equal(contenuDejaDerive({}), null);
  assert.equal(contenuDejaDerive({ [VARIABLE_DU_CONTENU_DERIVE]: 'complete' }), 'complete');
  assert.throws(() => contenuDejaDerive({ [VARIABLE_DU_CONTENU_DERIVE]: 'oui' }), /ni « complete » ni « sans-exemples »/);

  const depot = depotSansLignes(t);
  const { fichier } = contenuMarque(t);
  // un fichier « déjà dérivé » dont la recherche plein texte a été vidée : seule une dérivation la remplirait
  const db = new DatabaseSync(fichier);
  db.exec('DELETE FROM page_fts');
  db.close();
  const derive = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier, [VARIABLE_DU_CONTENU_DERIVE]: 'complete' });
  assert.equal(derive.statut, 0, derive.erreur);
  assert.equal(derive.sortie.fts, 0, 'copié tel quel : pas de nouvelle dérivation');
  const brut = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier });
  assert.equal(brut.statut, 0, brut.erreur);
  assert.ok(brut.sortie.fts > 0, 'sans la variable interne, ouvrirBase dérive');
  const autreVariante = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier, [VARIABLE_DU_CONTENU_DERIVE]: 'sans-exemples' });
  assert.notEqual(autreVariante.statut, 0, 'un fichier dérivé sans exemples ne sert pas la variante complète');
  assert.match(autreVariante.erreur, /déjà dérivé pour la variante/);
});

test('db:export-pages écrit les pages du fichier fourni, et non celles de data/rows ; le fichier n’est pas modifié', (t) => {
  const { dossier, fichier, page } = contenuMarque(t);
  const sortie = dossierTemporaire('contenu-fourni-pages', { t });
  const avant = { empreinte: empreinteDuFichier(fichier), liste: listeDuDossier(dossier) };
  const r = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-export-pages.mjs'), '--out', sortie], {
    encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(dossierTemporaire('contenu-fourni-tmp', { t })), [VARIABLE_DU_CONTENU]: fichier },
  });
  assert.equal(r.status, 0, r.stderr);
  const origine = new DatabaseSync(fichier, { readOnly: true });
  const pages = origine.prepare('SELECT count(*) AS n FROM page').get().n;
  origine.close();
  const ecrites = readdirSync(sortie, { recursive: true }).filter((n) => n.endsWith('.md'));
  assert.equal(ecrites.length, pages);
  assert.ok(readFileSync(join(sortie, page.type, `${page.slug}.md`), 'utf8').includes(MARQUE), 'la page porte la valeur du fichier fourni');
  assert.equal(empreinteDuFichier(fichier), avant.empreinte);
  assert.deepEqual(listeDuDossier(dossier), avant.liste);
});

/** Lance le hook de fin de build de l'intégration de la référence avec le contenu fourni et `ref` ; rend { messages, site }. */
function referenceAvecLeContenu(t, ref) {
  const dossier = dossierTemporaire('contenu-fourni-reference', { t });
  const anciens = { contenu: process.env[VARIABLE_DU_CONTENU], ref: process.env.MAVERICK_REFERENCE_REF };
  t.after(() => {
    for (const [nom, valeur] of [[VARIABLE_DU_CONTENU, anciens.contenu], ['MAVERICK_REFERENCE_REF', anciens.ref]]) {
      if (valeur === undefined) delete process.env[nom]; else process.env[nom] = valeur;
    }
  });
  process.env[VARIABLE_DU_CONTENU] = copieDEssai(dossier);
  process.env.MAVERICK_REFERENCE_REF = ref;
  const messages = [];
  const fin = integrationReference().hooks['astro:build:done'];
  fin({ dir: pathToFileURL(`${join(dossier, 'site')}/`), logger: { info: (m) => messages.push({ niveau: 'info', m }), warn: (m) => messages.push({ niveau: 'warn', m }) } });
  return { messages, site: join(dossier, 'site') };
}

test('contenu fourni et git présent : la base de référence de la production est construite depuis git, comme sans la variable (aucun contrôle ne saute)', (t) => {
  const { messages, site } = referenceAvecLeContenu(t, 'HEAD');
  assert.deepEqual(messages.map((x) => x.niveau), ['info'], messages.map((x) => x.m).join(' | '));
  assert.ok(existsSync(join(site, 'donnees', 'reference.db')), 'référence écrite');
  assert.equal(JSON.parse(readFileSync(join(site, 'donnees', 'reference.json'), 'utf8')).ref, 'HEAD');
});

test('contenu fourni sans la référence dans git (le kit, sans git) : rien n’est écrit, une information et non un avertissement', (t) => {
  const { messages, site } = referenceAvecLeContenu(t, 'refs/heads/branche-absente-de-l-essai');
  assert.deepEqual(messages.map((x) => x.niveau), ['info']);
  assert.match(messages[0].m, /MAVERICK_CONTENU/);
  assert.ok(!existsSync(site), 'aucune référence n’est écrite');
});

// ───── préparation de la copie (lot 10, R278) : vue de l'extrait, migrations manquantes, structure en avance ─────

const VERSION_DU_DEPOT = versionDuSchemaSql(readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8'));
const TABLE_D_ESSAI = 'essai_contenu_fourni';
const SQL_D_ESSAI = `CREATE TABLE ${TABLE_D_ESSAI} (\n  id INTEGER NOT NULL PRIMARY KEY\n) STRICT;`;

/**
 * Un faux dépôt sans data/rows dont la structure a UNE migration de plus que le contenu (comme une PR qui ajoute une migration) : les migrations du
 * dépôt, plus NNNN-essai-contenu-fourni.sql qui crée une table, et le schema.sql qui en tient compte (une table et le numéro suivant).
 */
function depotAvecUneMigrationDePlus(t) {
  const depot = depotSansLignes(t);
  const suivante = VERSION_DU_DEPOT + 1;
  const schema = readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8').replace(/^PRAGMA user_version\s*=\s*\d+/m, `PRAGMA user_version = ${suivante}`);
  writeFileSync(join(depot, 'data', 'schema.sql'), `${schema}\n${SQL_D_ESSAI}\n`);
  const migrations = join(depot, 'data', 'migrations');
  mkdirSync(migrations);
  for (const f of readdirSync(join(RACINE, 'data', 'migrations'))) copyFileSync(join(RACINE, 'data', 'migrations', f), join(migrations, f));
  writeFileSync(join(migrations, `${String(suivante).padStart(4, '0')}-essai-contenu-fourni.sql`), `${SQL_D_ESSAI}\n`);
  return { depot, suivante };
}

test('un extrait garde sa vue extrait_meta : la base lue ne l’a plus, le fichier fourni la garde, intact', (t) => {
  const depot = depotSansLignes(t);
  const { dossier, fichier } = contenuMarque(t);
  const origine = new DatabaseSync(fichier, { readOnly: true });
  assert.equal(origine.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'view' AND name = ?").get(VUE_DE_L_EXTRAIT).n, 1, 'un extrait porte la vue');
  origine.close();
  const avant = { empreinte: empreinteDuFichier(fichier), liste: listeDuDossier(dossier) };
  const r = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier });
  assert.equal(r.statut, 0, r.erreur);
  assert.equal(r.sortie.vue, 0, 'retirée de la copie de travail');
  assert.equal(r.sortie.version, VERSION_DU_DEPOT);
  assert.equal(empreinteDuFichier(fichier), avant.empreinte, 'le fichier fourni est intact (vue comprise)');
  assert.deepEqual(listeDuDossier(dossier), avant.liste);
});

test('contenu d’une structure plus ancienne que le dépôt : les migrations manquantes du dépôt sont appliquées à la copie, par le code du service', (t) => {
  const { depot, suivante } = depotAvecUneMigrationDePlus(t);
  const { fichier } = contenuMarque(t);
  const avant = empreinteDuFichier(fichier);

  // directement : la copie reçoit la migration, notée dans migration_recue ; le schéma obtenu est celui du schema.sql du dépôt
  const dossier = dossierTemporaire('contenu-fourni-migre', { t });
  const copie = join(dossier, 'copie.db');
  copyFileSync(fichier, copie);
  const r = preparerLeContenu(copie, { racine: depot });
  assert.deepEqual({ ...r, appliquees: r.appliquees.length }, { vue_retiree: true, avant: VERSION_DU_DEPOT, apres: suivante, appliquees: 1 });
  const db = new DatabaseSync(copie, { readOnly: true });
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, suivante);
  assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?").get(TABLE_D_ESSAI).n, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM migration_recue WHERE numero = ?').get(suivante).n, 1);
  db.close();

  // par le build (lib/donnees.mjs#ouvrirBase) : la base lue a la structure du dépôt
  const lue = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier, TEST_TABLE: TABLE_D_ESSAI });
  assert.equal(lue.statut, 0, lue.erreur);
  assert.equal(lue.sortie.version, suivante);
  assert.equal(lue.sortie.tableDEssai, 1);
  assert.equal(lue.sortie.marque, null, 'TEST_PAGE absent : rien à lire');
  assert.equal(empreinteDuFichier(fichier), avant, 'le fichier fourni n’est jamais migré');
});

test('contenu d’une structure plus récente que le dépôt (le site de dev a reçu une migration que la branche n’a pas) : refusé, « rebasez sur dev »', (t) => {
  const depot = depotSansLignes(t);
  const dossier = dossierTemporaire('contenu-fourni-en-avance', { t });
  const fichier = copieDEssai(dossier, (db) => db.exec(`PRAGMA user_version = ${VERSION_DU_DEPOT + 1}`));
  let migre = false;
  const copie = join(dossier, 'copie.db');
  copyFileSync(fichier, copie);
  assert.throws(() => preparerLaCopie(copie, { racine: depot, migrer: () => { migre = true; } }), (e) => e instanceof ErreurContenuFourni && /Rebasez/.test(e.message));
  assert.equal(migre, false);
  const r = lireLaBase(depot, { [VARIABLE_DU_CONTENU]: fichier });
  assert.notEqual(r.statut, 0, 'le build s’arrête');
  assert.match(r.erreur, /Rebasez la branche sur dev/);
});

test('même structure : aucune migration lancée, seule la vue est retirée', (t) => {
  const dossier = dossierTemporaire('contenu-fourni-egal', { t });
  const copie = copieDEssai(dossier);
  let migre = false;
  assert.deepEqual(preparerLaCopie(copie, { racine: RACINE, migrer: () => { migre = true; } }), { vue_retiree: true, avant: VERSION_DU_DEPOT, apres: VERSION_DU_DEPOT });
  assert.equal(migre, false);
  assert.deepEqual(preparerLaCopie(copie, { racine: RACINE, migrer: () => { migre = true; } }).vue_retiree, false, 'une seconde fois : plus de vue');
});

test('db:export-pages lit un fichier déjà dérivé tel quel, comme ouvrirBase : il n’est pas préparé (la fabrication l’a déjà contrôlé)', (t) => {
  const dossier = dossierTemporaire('contenu-fourni-pages-derive', { t });
  // une structure en avance : préparé, le fichier serait refusé (« Rebasez ») ; déjà dérivé, il se lit tel quel
  const fichier = copieDEssai(dossier, (db) => db.exec(`PRAGMA user_version = ${VERSION_DU_DEPOT + 1}`));
  const exporter = (env) => spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-export-pages.mjs'), '--out', dossierTemporaire('contenu-fourni-pages-sortie', { t })], {
    encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(dossierTemporaire('contenu-fourni-tmp', { t })), [VARIABLE_DU_CONTENU]: fichier, ...env },
  });
  const derive = exporter({ [VARIABLE_DU_CONTENU_DERIVE]: 'complete' });
  assert.equal(derive.status, 0, derive.stderr);
  const brut = exporter({ [VARIABLE_DU_CONTENU_DERIVE]: '' });
  assert.notEqual(brut.status, 0, 'sans la variable interne, la copie est préparée et la structure en avance refusée');
  assert.match(brut.stderr, /Rebasez/);
});
