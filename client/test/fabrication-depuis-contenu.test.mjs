// Le contrôle d'un fichier de contenu (serveur/fichier-de-contenu.mjs) et les briques de la fabrication (serveur/fabrication-depuis-contenu.mjs,
// scripts/fabriquer-depuis-contenu.mjs ; lot 9 du chantier de la base de dev) : refus d'un fichier qui porte une ligne de fiche, de compte ou de journal,
// une table du contenu absente, une autre structure ; mesure de la mémoire ; dossier de sortie sûr ; échec clair, sans toucher au fichier fourni.
// Aucun build complet ici : le build lui-même est celui d'Astro (CI : `npm run build`).
//   node --test test/fabrication-depuis-contenu.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ErreurFabrication, FORMAT_MESURE, lireLesMesures, messageDEchec, resumerLaMemoire, sousPasDuBuild, verifierLaSortie } from '../serveur/fabrication-depuis-contenu.mjs';
import { verifierLeContenu } from '../serveur/fichier-de-contenu.mjs';
import { TABLES_DE_CONTENU, TABLES_PROPRES_AU_SITE } from '../src/lib/tables-de-la-base.mjs';
import { copieDEssai, empreinteDuFichier, listeDuDossier } from './aide-contenu-fourni.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';
import { poserUnCompte } from './aide-compte-d-essai.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const SCHEMA = join(CLIENT, '..', 'data', 'schema.sql');
const SONDE = pathToFileURL(join(CLIENT, 'scripts', 'mesure-memoire.mjs')).href;
const SCRIPT = join(CLIENT, 'scripts', 'fabriquer-depuis-contenu.mjs');
const SENTINELLE = 'ZqxCompteSentinelleDuContenu';

const verifier = (fichier) => verifierLeContenu(fichier, { schema: SCHEMA });

/** Une copie de l'extrait dans un dossier du test, modifiée par `modifier(db)` (écriture). */
const copie = (t, modifier) => copieDEssai(dossierTemporaire('fabrication-fichier', { t }), modifier);

/** Des tables de contenu que plus aucune clé étrangère ne vise : on peut en retirer une sans casser le schéma. */
function tablesDeContenuLibres(db) {
  const visees = new Set();
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
    for (const f of db.prepare(`PRAGMA foreign_key_list("${name.replace(/"/g, '')}")`).all()) visees.add(f.table);
  }
  const presentes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name));
  return TABLES_DE_CONTENU.filter((t) => presentes.has(t) && !visees.has(t));
}

test('un extrait du site est accepté : sa structure est celle du schéma, ses tables de fiches, de comptes et de journal sont vides', (t) => {
  const fichier = copie(t);
  const r = verifier(fichier);
  assert.deepEqual(r.problemes, []);
  assert.equal(r.valide, true);
  assert.equal(r.meta.octets > 0, true);
  assert.match(r.meta.empreinte, /^[0-9a-f]{64}$/);
  assert.equal(r.meta.format, 'maverick-extrait/1');
  const db = new DatabaseSync(fichier, { readOnly: true });
  assert.equal(r.meta.pages, db.prepare('SELECT count(*) AS n FROM page').get().n);
  for (const table of TABLES_PROPRES_AU_SITE) {
    if (db.prepare('SELECT 1 FROM sqlite_master WHERE name = ?').get(table)) assert.equal(db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, 0, table);
  }
  db.close();
});

test('une ligne dans une table de compte ou de fiche refuse le fichier : le message nomme la table, jamais la valeur', (t) => {
  const fichier = copie(t, (db) => {
    poserUnCompte(db, 'zqx-compte', SENTINELLE, '2026-10-10T00:00:00Z');
  });
  const r = verifier(fichier);
  assert.equal(r.valide, false);
  assert.equal(r.meta, null);
  assert.match(r.problemes.join('\n'), /« utilisateur » \(propre au site/);
  assert.ok(!r.problemes.join('\n').includes(SENTINELLE), 'aucune donnée de joueur dans le message');
});

test('une table que le classement ne connaît pas, si elle porte une ligne, refuse le fichier ; vide, elle est tolérée', (t) => {
  const vide = verifier(copie(t, (db) => db.exec('CREATE TABLE zqx_inconnue (a TEXT)')));
  assert.equal(vide.valide, true, vide.problemes.join(' ; '));
  const pleine = verifier(copie(t, (db) => { db.exec('CREATE TABLE zqx_inconnue (a TEXT)'); db.exec("INSERT INTO zqx_inconnue VALUES ('x')"); }));
  assert.equal(pleine.valide, false);
  assert.match(pleine.problemes.join('\n'), /zqx_inconnue.*pas classée/);
});

test('une table du contenu qui manque, une autre structure (user_version), une empreinte annoncée qui ne correspond pas : refusés', (t) => {
  let retiree;
  const sansTable = verifier(copie(t, (db) => { [retiree] = tablesDeContenuLibres(db); db.exec(`DROP TABLE "${retiree}"`); }));
  assert.equal(sansTable.valide, false);
  assert.match(sansTable.problemes.join('\n'), new RegExp(`manque.*${retiree}`));

  const autreVersion = verifier(copie(t, (db) => {
    const v = db.prepare('PRAGMA user_version').get().user_version;
    db.exec(`PRAGMA user_version = ${v + 1}`);
  }));
  assert.equal(autreVersion.valide, false);
  assert.match(autreVersion.problemes.join('\n'), /structure/);

  const falsifiee = verifier(copie(t, (db) => {
    db.exec("DROP VIEW extrait_meta; CREATE VIEW extrait_meta AS SELECT 'maverick-extrait/1' AS format, 'x' AS fabrique_le, NULL AS version_du_site, 0 AS schema, 'faux' AS empreinte");
  }));
  assert.equal(falsifiee.valide, false);
  assert.match(falsifiee.problemes.join('\n'), /empreinte annoncée/);
});

test('un fichier qui n’est pas une base SQLite, ou qui manque, est refusé sans lever', (t) => {
  const dossier = dossierTemporaire('fabrication-pas-sqlite', { t });
  const texte = join(dossier, 'texte.db');
  writeFileSync(texte, 'ceci n’est pas une base de données SQLite, juste du texte '.repeat(40));
  const r = verifier(texte);
  assert.equal(r.valide, false);
  assert.match(r.problemes.join('\n'), /pas une base SQLite/);
  assert.equal(verifier(join(dossier, 'absent.db')).valide, false);
});

test('le contrôle ne modifie pas le fichier', (t) => {
  const dossier = dossierTemporaire('fabrication-intact', { t });
  const fichier = copieDEssai(dossier);
  const avant = { empreinte: empreinteDuFichier(fichier), liste: listeDuDossier(dossier) };
  verifier(fichier);
  assert.equal(empreinteDuFichier(fichier), avant.empreinte);
  assert.deepEqual(listeDuDossier(dossier), avant.liste);
});

test('le message d’un échec : la fin de stderr d’abord, puis la fin de stdout, étiquetées ; le sous-pas du build se lit dans la sortie d’Astro, sinon il n’est pas inventé', () => {
  const pages = Array.from({ length: 500 }, (_, i) => `12:00:00   ├─ /p${i}/index.html (+2ms)`).join('\n');
  const m = messageDEchec('build', { status: 1, stdout: pages, stderr: `${'x'.repeat(5000)}\nTypeError: la cause` });
  assert.match(m, /^build a échoué \(code 1\), pendant la génération des pages : fin de stderr : …x+\nTypeError: la cause ; fin de stdout : …/);
  assert.ok(m.indexOf('stderr') < m.indexOf('stdout'));
  assert.ok(m.length < 3200, 'sous le plafond du rapport (atelier.mjs#messageDErreur)');
  assert.match(m, /p499\/index\.html/, 'la fin de stdout, pas son début');
  // l'ordre réel des lignes d'Astro (noms de pages inventés) : les préliminaires portent déjà un « [build] ✓ Completed »
  const preliminaires = '12:00:00 [build] Collecting build info...\n12:00:01 [build] ✓ Completed in 1.87s.\n12:00:01 [build] Building static entrypoints...\n12:00:03 [build] Rearranging server assets...\n12:00:03 [build] ✓ Completed in 2.1s.\n';
  const routes = '12:00:03 generating static routes\n';
  const termine = '12:00:09 ✓ Completed in 17.06s.\n\n12:00:09 [build] ✓ Completed in 18.41s.\n';
  assert.equal(sousPasDuBuild(`${preliminaires}`), null, 'échec avant les pages : rien n’est dit');
  assert.equal(sousPasDuBuild(`${preliminaires}${routes}`), 'pendant la génération des pages', 'routes annoncées, aucune page');
  assert.equal(sousPasDuBuild(`${preliminaires}${routes}${pages}\n`), 'pendant la génération des pages');
  assert.equal(sousPasDuBuild(`${preliminaires}${routes}${pages}\n12:00:09 ✓ Completed in 17.06s.\n`), null, 'pages finies, build non terminé : pas d’invention');
  assert.match(sousPasDuBuild(`${preliminaires}${routes}${pages}\n${termine}[mon-integration] suite\n`), /^après le build/);
  assert.equal(sousPasDuBuild('rien de connu'), null);
  assert.equal(sousPasDuBuild(undefined), null);
  // une autre étape n'a pas de sous-pas ; sans sortie, ni étiquette ni deux-points ; le lancement raté dit son erreur
  assert.equal(messageDEchec('derive', { status: 2, stdout: `${pages}\n✓ Completed in 1s.`, stderr: '' }).includes('pages générées'), false);
  assert.equal(messageDEchec('pages', { status: 3, stdout: '', stderr: '' }), 'pages a échoué (code 3)');
  assert.equal(messageDEchec('build', { status: null, error: new Error('spawn ENOENT'), stdout: null, stderr: null }), 'build a échoué (code spawn ENOENT)');
});

test('la mémoire : pic d’un processus, cumul et détail par étape', () => {
  const r = resumerLaMemoire([
    { etape: 'pages', programme: 'db-export-pages.mjs', max_rss_ko: 100 },
    { etape: 'build', programme: 'astro.mjs', max_rss_ko: 900 },
    { etape: 'build', programme: 'db-derive.mjs', max_rss_ko: 300 },
  ]);
  assert.equal(r.pic_ko, 900);
  assert.equal(r.cumul_ko, 1300);
  assert.equal(r.processus, 3);
  assert.deepEqual(r.par_etape.build, { pic_ko: 900, cumul_ko: 1200, processus: 2 });
  assert.deepEqual(r.par_etape.pages, { pic_ko: 100, cumul_ko: 100, processus: 1 });
  assert.equal(r.processus_les_plus_gros[0].programme, 'astro.mjs');
  assert.deepEqual(resumerLaMemoire([]).par_etape, {});
});

test('la sonde écrit le pic de mémoire de chaque processus Node, enfants compris, et de rien sans sa variable', (t) => {
  const dossier = dossierTemporaire('fabrication-sonde', { t });
  const memoire = join(dossier, 'memoire.jsonl');
  const enfant = "const { spawnSync } = require('node:child_process'); spawnSync(process.execPath, ['-e', '0'], { stdio: 'ignore' });";
  const r = spawnSync(process.execPath, ['-e', enfant], {
    env: { ...process.env, NODE_OPTIONS: `--import=${SONDE}`, MAVERICK_MESURE_MEMOIRE: memoire, MAVERICK_MESURE_ETAPE: 'essai' },
  });
  assert.equal(r.status, 0, String(r.stderr));
  const lignes = lireLesMesures(memoire);
  assert.equal(lignes.length, 2, 'le processus et son enfant');
  for (const l of lignes) {
    assert.equal(l.etape, 'essai');
    assert.ok(l.max_rss_ko > 1000, 'en kilo-octets, plus que quelques Mo pour un processus Node');
  }
  const sans = spawnSync(process.execPath, ['-e', '0'], { env: { ...process.env, MAVERICK_MESURE_MEMOIRE: '', NODE_OPTIONS: `--import=${SONDE}` } });
  assert.equal(sans.status, 0);
  assert.equal(lireLesMesures(memoire).length, 2, 'sans sa variable, la sonde n’écrit rien');
  assert.deepEqual(lireLesMesures(join(dossier, 'absent.jsonl')), []);
});

test('le dossier de sortie : jamais le code, jamais un dossier étranger non vide (Astro le viderait) ; absent, vide ou site déjà fabriqué, accepté', (t) => {
  const dossier = dossierTemporaire('fabrication-sortie', { t });
  const refus = (sortie) => assert.throws(() => verifierLaSortie(sortie), (e) => e instanceof ErreurFabrication && e.etape === 'controle');
  refus(CLIENT);
  refus(join(CLIENT, '..'));
  refus(join(CLIENT, '..', '..'));
  refus('/');
  const etranger = join(dossier, 'etranger');
  mkdirSync(etranger);
  writeFileSync(join(etranger, 'notes.txt'), 'à garder');
  refus(etranger);
  verifierLaSortie(join(dossier, 'nouveau'));
  const vide = join(dossier, 'vide');
  mkdirSync(vide);
  verifierLaSortie(vide);
  // un site fabriqué, même interrompu : `_astro` et une page (ou le dossier du service)
  for (const pages of ['index.html', '404.html', '_serveur']) {
    const site = join(dossier, `site-${pages}`);
    mkdirSync(join(site, '_astro'), { recursive: true });
    if (pages.includes('.')) writeFileSync(join(site, pages), '');
    else mkdirSync(join(site, pages));
    writeFileSync(join(site, 'autre.txt'), '');
    verifierLaSortie(site);
  }
  // une seule trace au milieu de fichiers étrangers ne suffit pas : Astro viderait le dossier
  for (const trace of ['index.html', '404.html', '_astro', '_serveur']) {
    const mele = join(dossier, `mele-${trace}`);
    mkdirSync(mele);
    if (trace.startsWith('_')) mkdirSync(join(mele, trace)); else writeFileSync(join(mele, trace), '');
    writeFileSync(join(mele, 'notes.txt'), 'à garder');
    refus(mele);
  }
  assert.equal(readFileSync(join(etranger, 'notes.txt'), 'utf8'), 'à garder');
});

test('le script refuse un fichier qui porte des données de compte : code 1, message clair, mesure d’échec écrite, fichier intact, aucun dossier de travail laissé', (t) => {
  const dossier = dossierTemporaire('fabrication-script', { t });
  const tmp = dossierTemporaire('fabrication-script-tmp', { t });
  const fichier = copieDEssai(dossier, (db) => {
    poserUnCompte(db, 'zqx-compte', SENTINELLE, '2026-10-10T00:00:00Z');
  });
  const avant = empreinteDuFichier(fichier);
  const mesure = join(dossier, 'mesure.json');
  const sortie = join(dossier, 'site');
  const r = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--contenu', fichier, '--sortie', sortie, '--mesure', mesure], {
    encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(tmp) },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /étape controle/);
  assert.match(r.stderr, /utilisateur/);
  assert.ok(!r.stderr.includes(SENTINELLE) && !r.stdout.includes(SENTINELLE), 'aucune donnée de joueur dans les messages');
  const m = JSON.parse(readFileSync(mesure, 'utf8'));
  assert.equal(m.format, FORMAT_MESURE);
  assert.equal(m.statut, 'echec');
  assert.equal(m.mode, 'deux-temps', 'le mode par défaut');
  assert.equal(m.erreur.etape, 'controle');
  assert.deepEqual(m.etapes.map((e) => [e.nom, e.statut]), [['controle', 'echec']]);
  assert.ok(!existsSync(sortie), 'rien n’est fabriqué');
  assert.equal(empreinteDuFichier(fichier), avant);
  assert.deepEqual(listeDuDossier(tmp), [], 'le dossier de travail est supprimé');
});

test('le script : usage faux (code 2) et fichier introuvable (code 1)', (t) => {
  const dossier = dossierTemporaire('fabrication-usage', { t });
  const lancer = (...args) => spawnSync(process.execPath, ['--no-warnings', SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(dossier) } });
  assert.equal(lancer().status, 2);
  assert.equal(lancer('--contenu').status, 2);
  assert.equal(lancer('--contenu', join(dossier, 'x.db'), '--inconnue').status, 2);
  const r = lancer('--contenu', join(dossier, 'absent.db'), '--sortie', join(dossier, 'site'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /introuvable/);
});
