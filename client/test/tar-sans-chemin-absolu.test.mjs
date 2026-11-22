// Les scripts ne donnent aucun chemin absolu à tar. Le tar GNU de Git sous Windows prend un « -f C:\… » pour un hôte distant et, à l'extraction, lit « \1 », « \t » ou
// « \n » du chemin de -C comme des séquences d'échappement : tar travaille donc dans son dossier (cwd) et passe par ses flux. Sous Windows, le vrai tar échoue sur le
// dossier piégé ; ailleurs, où ces chemins ne le gênent pas, un faux tar en tête du PATH refuse tout chemin absolu : le retour du défaut se voit en CI.
//   node --test test/tar-sans-chemin-absolu.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { test } from 'node:test';
import { ARCHIVE_DU_KIT, INDISPENSABLES } from '../../deploy/installateur/kit.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip') && have('git')) && 'tar, gzip ou git indisponible';
const module_ = (chemin) => JSON.stringify(new URL(chemin, import.meta.url).href);
const MIGRATIONS = module_('../scripts/controler-les-migrations-lib.mjs');
const ESSAI = module_('../scripts/essai-mecanique-tests.mjs');
const KIT = module_('../../deploy/installateur/kit.mjs');
const FABRIQUER = module_('../../deploy/installateur/fabriquer.mjs');

function ecrire(base, fichiers) {
  for (const [rel, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), contenu);
  }
}

/** Un dossier dont le chemin contient « \1b » sous Windows, où le séparateur forme la séquence. */
function dossierPiege(t) {
  const dossier = join(dossierTemporaire('tar-piege', { t }), '1b');
  mkdirSync(dossier);
  return dossier;
}

/** Hors de Windows, le PATH d'un faux tar qui refuse tout chemin absolu puis lance le vrai. Sous Windows, spawnSync ne lancerait pas ce script : le vrai tar fait l'épreuve. */
function fauxTar(t) {
  if (process.platform === 'win32') return {};
  const dossier = dossierTemporaire('tar-faux', { t });
  const vrai = spawnSync('sh', ['-c', 'command -v tar'], { encoding: 'utf8' }).stdout.trim();
  writeFileSync(join(dossier, 'tar'), `#!/bin/sh\nfor a in "$@"; do case "$a" in /*) echo "tar a reçu un chemin absolu : $a" >&2; exit 64 ;; esac; done\nexec ${vrai} "$@"\n`);
  chmodSync(join(dossier, 'tar'), 0o755);
  return { PATH: `${dossier}${delimiter}${process.env.PATH}` };
}

/** Exécute le module `code` dans un processus dont le dossier temporaire est `piege`, avec le faux tar ; rend le JSON de sa dernière ligne. */
function lancer(t, piege, code) {
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', code], {
    encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(piege), ...fauxTar(t) },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').at(-1));
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

test('extraireDuCommit extrait sans donner de chemin absolu à tar', { skip }, (t) => {
  const depot = depotGit(t, { 'data/migrations/0001-a.sql': '-- a\n' });
  const piege = dossierPiege(t);
  const dossier = join(piege, 'base');
  const options = { racine: depot, commit: 'HEAD', dossier, chemins: ['data/migrations'] };
  const extraits = lancer(t, piege, `
    import { extraireDuCommit } from ${MIGRATIONS};
    console.log(JSON.stringify(extraireDuCommit(${JSON.stringify(options)})));`);
  assert.deepEqual(extraits, ['data/migrations']);
  assert.equal(readFileSync(join(dossier, 'data', 'migrations', '0001-a.sql'), 'utf8'), '-- a\n');
});

test('archiverLesExports extrait sans donner de chemin absolu à tar', { skip }, (t) => {
  const depot = depotGit(t, { 'sources/raw/discord/export.json': '[]\n' });
  const piege = dossierPiege(t);
  const destination = join(piege, 'exports');
  const options = { racine: depot, destination };
  const exportsArchives = lancer(t, piege, `
    import { archiverLesExports } from ${ESSAI};
    console.log(JSON.stringify(archiverLesExports(${JSON.stringify(options)})));`);
  assert.equal(exportsArchives, join(destination, 'sources', 'raw'));
  assert.equal(readFileSync(join(exportsArchives, 'discord', 'export.json'), 'utf8'), '[]\n');
});

test('l’épreuve des lots extrait les données d’un commit par extraireDuCommit, sans lancer tar elle-même', () => {
  const source = readFileSync(new URL('../scripts/epreuve-des-lots.mjs', import.meta.url), 'utf8');
  assert.match(source, /extraireDuCommit\(\{ racine: RACINE, commit: ref, dossier, chemins: \['data'\] \}\)/);
  assert.doesNotMatch(source, /['"`]tar['"`]|\btar -/);
});

test('le kit s’archive sans donner de chemin absolu à tar', { skip }, (t) => {
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
  const meta = lancer(t, piege, `
    import { fabriquerLeKit } from ${KIT};
    console.log(JSON.stringify(fabriquerLeKit(${JSON.stringify(options)})));`);
  assert.equal(meta.fichiers, 14);
  const liste = spawnSync('tar', ['-tzf', ARCHIVE_DU_KIT], { cwd: destination, encoding: 'utf8' });
  assert.equal(liste.status, 0, liste.stderr);
  const membres = liste.stdout.split('\n').map((m) => m.trim());
  for (const rel of INDISPENSABLES) assert.ok(membres.includes(`./${rel}`) || membres.includes(`./${rel}/`), `${rel} manque dans l’archive`);
});

test('l’installateur s’archive sans donner de chemin absolu à tar', { skip }, (t) => {
  const piege = dossierPiege(t);
  const site = join(piege, 'site');
  ecrire(site, { 'index.html': '<h1>accueil</h1>' });
  const sortie = join(piege, 'sortie');
  mkdirSync(sortie);
  const options = { mode: 'test', site, tag: 'v0.2.0', version: '0.2.0', sha: 'a'.repeat(40), sortie };
  const { fichier } = lancer(t, piege, `
    import { fabriquer } from ${FABRIQUER};
    console.log(JSON.stringify(fabriquer(${JSON.stringify(options)})));`);
  const octets = readFileSync(fichier);
  const repere = '\n__ARCHIVE__\n';
  const liste = spawnSync('tar', ['-tzf', '-'], { input: octets.subarray(octets.indexOf(repere) + repere.length), encoding: 'utf8' });
  assert.equal(liste.status, 0, liste.stderr);
  assert.ok(liste.stdout.split('\n').map((m) => m.trim()).includes('./site/index.html'));
});
