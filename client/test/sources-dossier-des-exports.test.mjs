// R296 : le dossier des exports des sources Google (sources/raw tant qu'il est dans le dépôt) se désigne par MAVERICK_SOURCES_RAW, lue par
// tools/sources/dossier-des-exports.mjs (import-gdocs, rapprocher, extraire) et tools/docs/codex.py (même règle en Python). Sans la variable : sources/raw.
// Aucune valeur du contenu : seulement le choix du dossier.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { dossierDesExports } from '../../tools/sources/dossier-des-exports.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const PAR_DEFAUT = join(RACINE, 'sources', 'raw');

test('dossierDesExports : sans variable, ou vide, le dossier d\'avant (sources/raw à la racine)', () => {
  assert.equal(dossierDesExports(RACINE, {}), PAR_DEFAUT);
  assert.equal(dossierDesExports(RACINE, { MAVERICK_SOURCES_RAW: '' }), PAR_DEFAUT);
  assert.equal(dossierDesExports(RACINE, { MAVERICK_SOURCES_RAW: '   ' }), PAR_DEFAUT);
});

test('dossierDesExports : la variable désigne le dossier, absolu ou relatif au dossier de travail', () => {
  assert.equal(dossierDesExports(RACINE, { MAVERICK_SOURCES_RAW: '/une/archive/exports' }), resolve('/une/archive/exports'));
  assert.equal(dossierDesExports(RACINE, { MAVERICK_SOURCES_RAW: 'var/sources-raw' }), resolve('var/sources-raw'));
  assert.equal(dossierDesExports(RACINE, { MAVERICK_SOURCES_RAW: ' var/sources-raw ' }), resolve('var/sources-raw'));
});

test('dossierDesExports : lit process.env par défaut', (t) => {
  const avant = process.env.MAVERICK_SOURCES_RAW;
  t.after(() => { if (avant === undefined) delete process.env.MAVERICK_SOURCES_RAW; else process.env.MAVERICK_SOURCES_RAW = avant; });
  process.env.MAVERICK_SOURCES_RAW = '/via/process-env';
  assert.equal(dossierDesExports(RACINE), resolve('/via/process-env'));
  delete process.env.MAVERICK_SOURCES_RAW;
  assert.equal(dossierDesExports(RACINE), PAR_DEFAUT);
});

test('tools/docs/codex.py lit le dossier de la variable (SOURCE y est rangé), sinon sources/raw', (t) => {
  const dossier = dossierTemporaire('exports', { t });
  const lire = (variable) => {
    const env = { ...process.env };
    delete env.MAVERICK_SOURCES_RAW;
    if (variable !== undefined) env.MAVERICK_SOURCES_RAW = variable;
    return execFileSync('python3', ['-I', '-c', 'import sys; sys.path.insert(0, "tools/docs"); import codex; print(codex.EXPORTS); print(codex.SOURCE)'],
      { cwd: RACINE, env, encoding: 'utf8' }).trim().split('\n');
  };
  const [exports, source] = lire(dossier);
  assert.equal(exports, dossier);
  assert.equal(source, join(dossier, basename(source)));
  assert.match(source, /\.md$/);
  assert.equal(lire(undefined)[0], PAR_DEFAUT);
  assert.equal(lire('')[0], PAR_DEFAUT);
});
