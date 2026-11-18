// Les pages d'exemple du dépôt (data/pages-d-exemple.sql, fabriqué par scripts/db-pages-d-exemple.mjs ; lot 10 du chantier de la base de dev, R278) : le site
// de dev n'a pas ces fixtures, data/rows les a. Une copie de travail d'un contenu fourni (MAVERICK_CONTENU) qui n'en a aucune les reçoit
// (lib/contenu-fourni.mjs#preparerLaCopie, scripts/db-preparer-contenu.mjs#injecterLesPagesDExemple), jamais le fichier fourni ; HIDE_EXAMPLES=1 n'en veut pas.
// Aucun texte figé : les lignes attendues se lisent dans le fichier des pages d'exemple lui-même.
//   node --test test/pages-d-exemple.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { injecterLesPagesDExemple, preparerLeContenu } from '../scripts/db-preparer-contenu.mjs';
import { depuisLesLignes, instructions } from '../scripts/db-pages-d-exemple.mjs';
import { ErreurContenuFourni, FICHIER_DES_PAGES_D_EXEMPLE, VARIABLE_DU_CONTENU, preparerLaCopie } from '../src/lib/contenu-fourni.mjs';
import { copieDEssai, empreinteDuFichier, listeDuDossier } from './aide-contenu-fourni.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const RACINE = join(CLIENT, '..');
const FICHIER = join(RACINE, ...FICHIER_DES_PAGES_D_EXEMPLE);
const DONNEES = pathToFileURL(join(CLIENT, 'src', 'lib', 'donnees.mjs')).href;
const guillemets = (c) => `"${c.replace(/"/g, '""')}"`;

/** Les lignes du fichier, lues dans une base vide du schéma du dépôt : Map table → { colonnes, lignes }. */
function lignesDuFichier() {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(join(RACINE, 'data', 'schema.sql'), 'utf8'));
    db.exec('PRAGMA foreign_keys = OFF'); // les parents communs (type_page…) ne sont pas dans le fichier
    db.exec(readFileSync(FICHIER, 'utf8'));
    // hors des tables de la recherche plein texte et de leurs tables d'ombre (page_fts_data…), que SQLite remplit seul
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL TABLE%'").all()
      .map((t) => t.name).filter((t) => !/_fts(?:_\w+)?$/.test(t));
    const r = new Map();
    for (const t of tables) {
      const lignes = db.prepare(`SELECT * FROM ${guillemets(t)}`).all();
      if (lignes.length) r.set(t, { colonnes: Object.keys(lignes[0]), lignes });
    }
    return r;
  } finally {
    db.close();
  }
}

/** Combien de lignes du fichier `db` porte à l'identique, table par table : { table → n }. */
function presentes(db, attendu) {
  const r = {};
  for (const [t, { colonnes, lignes }] of attendu) {
    const q = db.prepare(`SELECT count(*) AS n FROM ${guillemets(t)} WHERE ${colonnes.map((c) => `${guillemets(c)} IS ?`).join(' AND ')}`);
    r[t] = lignes.reduce((n, l) => n + q.get(...colonnes.map((c) => l[c])).n, 0);
  }
  return r;
}
const effectifs = (attendu) => Object.fromEntries([...attendu].map(([t, { lignes }]) => [t, lignes.length]));
const compter = (fichier, sql) => {
  const db = new DatabaseSync(fichier, { readOnly: true });
  try {
    return db.prepare(sql).get().n;
  } finally {
    db.close();
  }
};

/** Retire d'une base ce que le site de dev n'a pas : les pages d'exemple (cascade) et les sources que plus rien ne cite (comme db-derive --sans-exemples). */
function sansLesExemples(db) {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec("DELETE FROM page WHERE statut = 'example'");
  db.exec('DELETE FROM source WHERE id NOT IN (SELECT source_id FROM page_source)');
}

/** Un contenu sans pages d'exemple, comme l'extrait du site de dev : { dossier, fichier }. */
function contenuSansExemples(t) {
  const dossier = dossierTemporaire('pages-d-exemple-contenu', { t });
  const fichier = copieDEssai(dossier, sansLesExemples);
  assert.equal(compter(fichier, "SELECT count(*) AS n FROM page WHERE statut = 'example'"), 0);
  return { dossier, fichier };
}

/** Une copie de travail de `fichier` (jamais le fichier lui-même). */
function copieDeTravail(t, fichier) {
  const copie = join(dossierTemporaire('pages-d-exemple-copie', { t }), 'copie.db');
  copyFileSync(fichier, copie);
  return copie;
}

test('le fichier des pages d’exemple égale ce que data/rows porte (ce que HIDE_EXAMPLES=1 retire), chaque instruction étant une ligne de data/rows', (t) => {
  if (!existsSync(join(RACINE, 'data', 'rows'))) {
    t.skip('data/rows n’est plus dans le dépôt (lot 12) : le fichier se garde tel quel');
    return;
  }
  const { texte, blocs } = depuisLesLignes({ racine: RACINE });
  assert.equal(readFileSync(FICHIER, 'utf8'), texte, `${FICHIER_DES_PAGES_D_EXEMPLE.join('/')} diffère de data/rows : node scripts/db-pages-d-exemple.mjs`);
  const pages = blocs.find((b) => b.table === 'page');
  assert.ok(pages?.lignes.length, 'des pages d’exemple');
  assert.ok(pages.lignes.every((l) => l.valeurs.statut === 'example'), 'aucune page hors des exemples');
  for (const b of blocs) {
    const lignes = readFileSync(join(RACINE, 'data', 'rows', `${b.table}.sql`), 'utf8');
    for (const i of instructions(b)) assert.ok(lignes.includes(i), `${b.table} : une instruction absente de data/rows (écriture différente de l’exporteur ?)`);
  }
});

test('un contenu sans page d’exemple les reçoit dans sa copie, à l’identique du fichier ; le fichier fourni est intact ; une seconde préparation ne les double pas', (t) => {
  const attendu = lignesDuFichier();
  const { dossier, fichier } = contenuSansExemples(t);
  const avant = { empreinte: empreinteDuFichier(fichier), liste: listeDuDossier(dossier) };
  const copie = copieDeTravail(t, fichier);
  const pages = compter(copie, 'SELECT count(*) AS n FROM page');

  const r = preparerLeContenu(copie, { racine: RACINE });
  assert.equal(r.exemples_ajoutes, attendu.get('page').lignes.length);
  const db = new DatabaseSync(copie, { readOnly: true });
  assert.deepEqual(presentes(db, attendu), effectifs(attendu), 'chaque ligne du fichier est dans la copie');
  assert.equal(db.prepare('SELECT count(*) AS n FROM page').get().n, pages + attendu.get('page').lignes.length);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.close();

  const encore = preparerLeContenu(copie, { racine: RACINE });
  assert.equal(encore.exemples_ajoutes, 0, 'déjà là : rien n’est ajouté');
  const relue = new DatabaseSync(copie, { readOnly: true });
  assert.deepEqual(presentes(relue, attendu), effectifs(attendu), 'pas de doublon');
  relue.close();

  assert.equal(empreinteDuFichier(fichier), avant.empreinte, 'le fichier fourni n’est jamais modifié');
  assert.deepEqual(listeDuDossier(dossier), avant.liste);
});

test('un contenu qui a déjà des pages d’exemple n’en reçoit pas d’autres : l’ajout n’est pas lancé', (t) => {
  const dossier = dossierTemporaire('pages-d-exemple-deja', { t });
  // une seule page d'exemple gardée : le contenu « a ses exemples », le fichier ne s'y ajoute pas en partie
  const fichier = copieDEssai(dossier, (db) => {
    db.exec('PRAGMA foreign_keys = ON');
    const garde = db.prepare("SELECT id FROM page WHERE statut = 'example' ORDER BY id LIMIT 1").get();
    if (garde) db.prepare("DELETE FROM page WHERE statut = 'example' AND id <> ?").run(garde.id);
    else db.exec(readFileSync(FICHIER, 'utf8'));
  });
  const copie = copieDeTravail(t, fichier);
  const exemples = compter(copie, "SELECT count(*) AS n FROM page WHERE statut = 'example'");
  assert.ok(exemples > 0);
  let injecte = false;
  const r = preparerLaCopie(copie, { racine: RACINE, migrer: () => assert.fail('même structure'), injecter: () => { injecte = true; } });
  assert.equal(injecte, false);
  assert.equal(r.exemples_ajoutes, 0);
  assert.equal(preparerLeContenu(copie, { racine: RACINE }).exemples_ajoutes, 0);
  assert.equal(compter(copie, "SELECT count(*) AS n FROM page WHERE statut = 'example'"), exemples);
});

test('HIDE_EXAMPLES=1 (exemples: false) : rien n’est ajouté, ni lancé', (t) => {
  const { fichier } = contenuSansExemples(t);
  const copie = copieDeTravail(t, fichier);
  let injecte = false;
  assert.equal(preparerLaCopie(copie, { racine: RACINE, exemples: false, migrer: () => assert.fail('même structure'), injecter: () => { injecte = true; } }).exemples_ajoutes, 0);
  assert.equal(injecte, false);
  assert.equal(preparerLeContenu(copie, { racine: RACINE, exemples: false }).exemples_ajoutes, 0);
  assert.equal(compter(copie, "SELECT count(*) AS n FROM page WHERE statut = 'example'"), 0);
});

test('un ajout qui échoue laisse la copie inchangée ; un dépôt sans le fichier est une erreur, jamais un contenu sans exemples en silence', (t) => {
  const attendu = lignesDuFichier();
  const { fichier } = contenuSansExemples(t);
  // une ligne du fichier (hors page) déjà présente : l'ajout est refusé en bloc, pages comprises (clés étrangères contrôlées, ordre du fichier : parents d'abord)
  const [table, { colonnes, lignes }] = [...attendu].find(([t2]) => t2 !== 'page');
  const copie = copieDeTravail(t, fichier);
  const db = new DatabaseSync(copie);
  db.exec('PRAGMA foreign_keys = OFF');
  db.prepare(`INSERT OR REPLACE INTO ${guillemets(table)} (${colonnes.map(guillemets).join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...colonnes.map((c) => lignes[0][c]));
  db.close();
  const pages = compter(copie, 'SELECT count(*) AS n FROM page');
  assert.throws(() => injecterLesPagesDExemple(copie, { racine: RACINE }), (e) => e instanceof ErreurContenuFourni && /ne s’ajoutent pas/.test(e.message));
  assert.equal(compter(copie, 'SELECT count(*) AS n FROM page'), pages, 'rien n’est resté de l’essai');

  const depot = dossierTemporaire('pages-d-exemple-depot', { t });
  mkdirSync(join(depot, 'data'));
  copyFileSync(join(RACINE, 'data', 'schema.sql'), join(depot, 'data', 'schema.sql'));
  const autre = copieDeTravail(t, fichier);
  assert.throws(() => preparerLeContenu(autre, { racine: depot }), (e) => e instanceof ErreurContenuFourni && /introuvable/.test(e.message));
  assert.equal(compter(autre, "SELECT count(*) AS n FROM page WHERE statut = 'example'"), 0);
});

/** Lit la base du build (lib/donnees.mjs#ouvrirBase) dans un processus neuf : pages, pages d'exemple, leurs liens et la recherche. */
function lireLaBase(t, env) {
  const code = `
    const { ouvrirBase } = await import(process.env.TEST_DONNEES);
    const db = ouvrirBase();
    const un = (sql) => db.prepare(sql).get().n;
    console.log(JSON.stringify({
      pages: un('SELECT count(*) AS n FROM page'),
      exemples: db.prepare("SELECT id FROM page WHERE statut = 'example' ORDER BY id").all().map((p) => p.id),
      liens: un("SELECT count(*) AS n FROM lien WHERE page_id IN (SELECT id FROM page WHERE statut = 'example')"),
      fts: un('SELECT count(*) AS n FROM page_fts'),
      cassees: db.prepare('PRAGMA foreign_key_check').all().length,
    }));`;
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', code], {
    cwd: RACINE, encoding: 'utf8',
    env: { PATH: process.env.PATH, ...variablesTemporaires(dossierTemporaire('pages-d-exemple-tmp', { t })), MAVERICK_ROOT: RACINE, TEST_DONNEES: DONNEES, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('par le build (ouvrirBase) : la base dérivée a les pages d’exemple du dépôt, leurs liens et leur recherche ; HIDE_EXAMPLES=1 n’en a aucune', (t) => {
  const attendu = lignesDuFichier();
  const ids = attendu.get('page').lignes.map((l) => l.id).sort();
  const { dossier, fichier } = contenuSansExemples(t);
  const avant = { empreinte: empreinteDuFichier(fichier), liste: listeDuDossier(dossier) };
  const pages = compter(fichier, 'SELECT count(*) AS n FROM page');

  const complete = lireLaBase(t, { [VARIABLE_DU_CONTENU]: fichier });
  assert.deepEqual(complete.exemples, ids);
  assert.equal(complete.pages, pages + ids.length);
  assert.equal(complete.fts, complete.pages, 'db-derive indexe aussi les pages d’exemple');
  if (attendu.get('page').lignes.some((l) => l.corps_md.includes('[['))) assert.ok(complete.liens > 0, 'leurs [[…]] deviennent des liens (db-derive)');
  assert.equal(complete.cassees, 0);

  const sans = lireLaBase(t, { [VARIABLE_DU_CONTENU]: fichier, HIDE_EXAMPLES: '1' });
  assert.deepEqual(sans.exemples, []);
  assert.equal(sans.pages, pages);
  assert.equal(sans.cassees, 0);

  assert.equal(empreinteDuFichier(fichier), avant.empreinte, 'le fichier fourni est intact');
  assert.deepEqual(listeDuDossier(dossier), avant.liste);
});

test('db:export-pages écrit les pages d’exemple du dépôt pour un contenu qui n’en a pas ; pas avec HIDE_EXAMPLES=1', (t) => {
  const attendues = lignesDuFichier().get('page').lignes.map((l) => join(l.type, `${l.slug}.md`)).sort();
  const { fichier } = contenuSansExemples(t);
  const exporter = (env) => {
    const sortie = dossierTemporaire('pages-d-exemple-sortie', { t });
    const r = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-export-pages.mjs'), '--out', sortie], {
      encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(dossierTemporaire('pages-d-exemple-tmp', { t })), [VARIABLE_DU_CONTENU]: fichier, HIDE_EXAMPLES: '', ...env },
    });
    assert.equal(r.status, 0, r.stderr);
    return new Set(readdirSync(sortie, { recursive: true }).filter((n) => n.endsWith('.md')));
  };
  const complete = exporter({});
  assert.deepEqual(attendues.filter((p) => complete.has(p)), attendues);
  const sans = exporter({ HIDE_EXAMPLES: '1' });
  assert.deepEqual(attendues.filter((p) => sans.has(p)), []);
  assert.equal(complete.size, sans.size + attendues.length);
});
