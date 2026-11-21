// L'extraction de la base de référence (scripts/db-reference.mjs) ne donne aucun chemin à tar : le tar GNU (celui de Git sous Windows) lit « \1 », « \t » ou « \n »
// dans le chemin de -C comme des séquences d'échappement. Il s'arrêtait sans lire son entrée, et le build disait « tar absent : spawnSync tar EOF ».
//   node --test test/db-reference-extraction.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const MODULE = pathToFileURL(fileURLToPath(new URL('../scripts/db-reference.mjs', import.meta.url))).href;

/** Un dépôt minimal : ce que la référence lit (schéma d'une table, ses lignes, la version du client). */
function depotMinimal(t) {
  const depot = dossierTemporaire('reference-depot', { t });
  mkdirSync(join(depot, 'data', 'rows'), { recursive: true });
  mkdirSync(join(depot, 'client'));
  writeFileSync(join(depot, 'data', 'schema.sql'), 'PRAGMA user_version = 1;\nCREATE TABLE essai (id INTEGER PRIMARY KEY);\n');
  writeFileSync(join(depot, 'data', 'rows', 'VERSION'), 'schema_version=1\n');
  writeFileSync(join(depot, 'data', 'rows', 'essai.sql'), 'INSERT INTO essai VALUES (1);\n');
  writeFileSync(join(depot, 'client', 'package.json'), '{ "version": "9.9.9" }\n');
  const git = (...args) => execFileSync('git', ['-C', depot, '-c', 'user.name=essai', '-c', 'user.email=essai@example.invalid', ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-q', '-m', 'essai');
  return depot;
}

test('la référence se construit quand le chemin du dossier temporaire contient une séquence d’échappement de tar', (t) => {
  const depot = depotMinimal(t);
  const parent = dossierTemporaire('reference-extraction', { t });
  // Sous Windows, le séparateur forme la séquence (…\1b) ; ailleurs, la barre oblique inverse est dans le nom du dossier.
  const temporaire = join(parent, process.platform === 'win32' ? '1b' : 'a\\1b');
  mkdirSync(temporaire);
  const sortie = join(parent, 'reference.db');
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', `
    import { construireReference } from ${JSON.stringify(MODULE)};
    console.log(JSON.stringify(construireReference({ sortie: ${JSON.stringify(sortie)}, ref: 'HEAD' })));`], {
    encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(temporaire), GIT_DIR: join(depot, '.git') },
  });
  assert.equal(r.status, 0, r.stderr);
  const reference = JSON.parse(r.stdout.trim().split('\n').at(-1));
  assert.equal(reference.raison, undefined);
  assert.equal(reference.chemin, sortie);
  assert.equal(reference.version, '9.9.9');
  assert.ok(existsSync(sortie));
});
