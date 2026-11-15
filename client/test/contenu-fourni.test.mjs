// MAVERICK_CONTENU (src/lib/contenu-fourni.mjs ; lot 9 du chantier de la base de dev) : tout ce qui lit la base au build lit une copie du fichier de
// contenu fourni, sans data/rows, sans jamais modifier le fichier ; sans la variable, rien ne change.
//   node --test test/contenu-fourni.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { integrationReference } from '../scripts/db-reference.mjs';
import { VARIABLE_DU_CONTENU, VARIABLE_DU_CONTENU_DERIVE, contenuDejaDerive, contenuFourni } from '../src/lib/contenu-fourni.mjs';
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

/** Lit la base du build dans un processus neuf (la base est ouverte une fois par processus) : { racine, pages, hors_exemples, marque, fts }. */
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

test('la base de référence de la production (lue dans git) n’est pas construite quand le contenu est fourni', (t) => {
  const dossier = dossierTemporaire('contenu-fourni-reference', { t });
  const ancien = process.env[VARIABLE_DU_CONTENU];
  t.after(() => { if (ancien === undefined) delete process.env[VARIABLE_DU_CONTENU]; else process.env[VARIABLE_DU_CONTENU] = ancien; });
  process.env[VARIABLE_DU_CONTENU] = copieDEssai(dossier);
  const messages = [];
  const fin = integrationReference().hooks['astro:build:done'];
  fin({ dir: pathToFileURL(`${join(dossier, 'site')}/`), logger: { info: (m) => messages.push(m), warn: (m) => messages.push(m) } });
  assert.equal(messages.length, 1);
  assert.ok(!existsSync(join(dossier, 'site')), 'aucune référence n’est écrite');
});
