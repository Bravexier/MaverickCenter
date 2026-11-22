// Les scripts ne donnent aucun chemin absolu à tar : le tar GNU (celui de Git sous Windows) prend « C:\… » pour un hôte distant (-f) et lit « \1 », « \t » ou « \n »
// d'un chemin comme des séquences d'échappement (-C). tar travaille dans son dossier (cwd) et passe par ses flux. Sous Linux, le dossier piégé porte la barre
// oblique inverse dans son nom : le tar GNU y lit la même séquence, et le test attrape le défaut en CI.
//   node --test test/tar-sans-chemin-absolu.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { ARCHIVE_DU_KIT, INDISPENSABLES } from '../../deploy/installateur/kit.mjs';
import { extraireDuCommit } from '../scripts/controler-les-migrations-lib.mjs';
import { archiverLesExports } from '../scripts/essai-mecanique-tests.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip') && have('git')) && 'tar, gzip ou git indisponible';
const KIT = new URL('../../deploy/installateur/kit.mjs', import.meta.url).href;
const FABRIQUER = new URL('../../deploy/installateur/fabriquer.mjs', import.meta.url).href;

function ecrire(base, fichiers) {
  for (const [rel, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), contenu);
  }
}

/** Un dossier dont le chemin contient « \1b » : sous Windows, le séparateur forme la séquence ; ailleurs, la barre oblique inverse est dans le nom. */
function dossierPiege(t) {
  const dossier = join(dossierTemporaire('tar-piege', { t }), process.platform === 'win32' ? '1b' : 'a\\1b');
  mkdirSync(dossier);
  return dossier;
}

/** Un dépôt git d'un commit, sans conversion des fins de ligne. */
function depotGit(t, fichiers) {
  const depot = dossierTemporaire('tar-depot', { t });
  ecrire(depot, fichiers);
  const git = (...args) => execFileSync('git', ['-C', depot, '-c', 'user.name=essai', '-c', 'user.email=essai@example.invalid', ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('add', '-A');
  git('commit', '-q', '-m', 'essai');
  return depot;
}

/** Exécute le module `code` dans un processus dont le dossier temporaire est `dossier` ; rend le JSON de sa dernière ligne. */
function dansLeDossierTemporaire(dossier, code) {
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', code], {
    encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(dossier) },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').at(-1));
}

test('extraireDuCommit écrit dans un dossier dont le chemin contient une séquence d’échappement de tar', { skip }, (t) => {
  const depot = depotGit(t, { 'data/migrations/0001-a.sql': '-- a\n' });
  const dossier = join(dossierPiege(t), 'base');
  assert.deepEqual(extraireDuCommit({ racine: depot, commit: 'HEAD', dossier, chemins: ['data/migrations'] }), ['data/migrations']);
  assert.equal(readFileSync(join(dossier, 'data', 'migrations', '0001-a.sql'), 'utf8'), '-- a\n');
});

test('archiverLesExports écrit dans un dossier dont le chemin contient une séquence d’échappement de tar', { skip }, (t) => {
  const depot = depotGit(t, { 'sources/raw/discord/export.json': '[]\n' });
  const destination = join(dossierPiege(t), 'exports');
  const exports_ = archiverLesExports({ racine: depot, destination });
  assert.equal(exports_, join(destination, 'sources', 'raw'));
  assert.equal(readFileSync(join(exports_, 'discord', 'export.json'), 'utf8'), '[]\n');
});

test('l’épreuve des lots extrait les données d’un commit par extraireDuCommit, sans lancer tar elle-même', () => {
  const source = readFileSync(new URL('../scripts/epreuve-des-lots.mjs', import.meta.url), 'utf8');
  assert.match(source, /extraireDuCommit\(\{ racine: RACINE, commit: ref, dossier, chemins: \['data'\] \}\)/);
  assert.doesNotMatch(source, /\btar\b/);
});

test('le kit se fabrique quand son dossier temporaire et sa destination contiennent une séquence d’échappement de tar', { skip }, (t) => {
  const depot = dossierTemporaire('tar-kit', { t });
  ecrire(depot, {
    '.nvmrc': '22\n',
    'client/package.json': '{ "name": "essai", "version": "1.0.0" }',
    'client/astro.config.mjs': 'export default {};',
    'client/scripts/fabriquer-depuis-contenu.mjs': '// script',
    'client/scripts/poser-un-site.mjs': '// script',
    'client/node_modules/astro/bin/astro.mjs': '// astro',
    'client/node_modules/astro/package.json': '{ "name": "astro", "version": "1.0.0" }',
    'data/schema.sql': 'PRAGMA user_version = 1;',
    'data/derive.sql': '-- derive',
    'data/migrations/0001-a.sql': '-- m',
    'data/references/a.json': '{}',
    'sources/sources.json': '{}',
    'sources/copies-drive.json': '{}',
    'sources/tipeee/bienvenue.json': '{}',
  });
  const piege = dossierPiege(t);
  const destination = join(piege, 'sortie');
  const options = { racine: depot, destination, version: '1.2.3', sha: 'a'.repeat(40), plateforme: { platform: 'linux', arch: 'x64', libc: 'glibc' } };
  const meta = dansLeDossierTemporaire(piege, `
    import { fabriquerLeKit } from ${JSON.stringify(KIT)};
    console.log(JSON.stringify(fabriquerLeKit(${JSON.stringify(options)})));`);
  assert.equal(meta.fichiers, 14);
  const liste = spawnSync('tar', ['-tzf', ARCHIVE_DU_KIT], { cwd: destination, encoding: 'utf8' });
  assert.equal(liste.status, 0, liste.stderr);
  const membres = liste.stdout.split('\n').map((m) => m.trim());
  for (const rel of INDISPENSABLES) assert.ok(membres.includes(`./${rel}`) || membres.includes(`./${rel}/`), `${rel} manque dans l’archive`);
});

test('l’installateur se fabrique quand son dossier temporaire contient une séquence d’échappement de tar', { skip }, (t) => {
  const piege = dossierPiege(t);
  const site = join(piege, 'site');
  ecrire(site, { 'index.html': '<h1>accueil</h1>' });
  const sortie = join(piege, 'sortie');
  mkdirSync(sortie);
  const options = { mode: 'test', site, tag: 'v0.2.0', version: '0.2.0', sha: 'a'.repeat(40), sortie };
  const { fichier } = dansLeDossierTemporaire(piege, `
    import { fabriquer } from ${JSON.stringify(FABRIQUER)};
    console.log(JSON.stringify(fabriquer(${JSON.stringify(options)})));`);
  const octets = readFileSync(fichier);
  const repere = '\n__ARCHIVE__\n';
  const liste = spawnSync('tar', ['-tzf', '-'], { input: octets.subarray(octets.indexOf(repere) + repere.length), encoding: 'utf8' });
  assert.equal(liste.status, 0, liste.stderr);
  assert.ok(liste.stdout.split('\n').map((m) => m.trim()).includes('./site/index.html'));
});
