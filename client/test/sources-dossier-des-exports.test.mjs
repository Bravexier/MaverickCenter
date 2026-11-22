// R296 : le dossier des exports des sources Google (sources/raw tant qu'il est dans le dépôt) se désigne par MAVERICK_SOURCES_RAW, lue par
// tools/sources/dossier-des-exports.mjs (import-gdocs, rapprocher, extraire) et tools/docs/codex.py (même règle en Python). Sans la variable : sources/raw.
// Même règle pour les registres d'orthographe des migrations de données que lit rapprocher.mjs : MAVERICK_MIGRATIONS_ARCHIVEES, sans elle data/migrations.
// Aucune valeur du contenu : seulement le choix du dossier.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { dossierDesExports, dossiersDesMigrations } from '../../tools/sources/dossier-des-exports.mjs';
import { registresDOrthographe } from '../../tools/sources/rapprocher.mjs';
import { environnementDeLaPasse, PASSE_SANS_LE_CONTENU } from '../scripts/essai-mecanique-tests.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { sansCrlf } from './aide-fins-de-ligne.mjs';

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
    return sansCrlf(execFileSync('python3', ['-X', 'utf8', '-I', '-c', 'import sys; sys.path.insert(0, "tools/docs"); import codex; print(codex.EXPORTS); print(codex.SOURCE)'],
      { cwd: RACINE, env, encoding: 'utf8' })).trim().split('\n');
  };
  const [exports, source] = lire(dossier);
  assert.equal(exports, dossier);
  assert.equal(source, join(dossier, basename(source)));
  assert.match(source, /\.md$/);
  assert.equal(lire(undefined)[0], PAR_DEFAUT);
  assert.equal(lire('')[0], PAR_DEFAUT);
});

test('dossiersDesMigrations : data/migrations, puis le dossier de MAVERICK_MIGRATIONS_ARCHIVEES s\'il est posé (les deux se lisent ensemble)', () => {
  const RESTE = join(RACINE, 'data', 'migrations');
  assert.deepEqual(dossiersDesMigrations(RACINE, {}), [RESTE]);
  assert.deepEqual(dossiersDesMigrations(RACINE, { MAVERICK_MIGRATIONS_ARCHIVEES: '  ' }), [RESTE]);
  assert.deepEqual(dossiersDesMigrations(RACINE, { MAVERICK_MIGRATIONS_ARCHIVEES: '/archive/data/migrations' }), [RESTE, resolve('/archive/data/migrations')]);
  assert.deepEqual(dossiersDesMigrations(RACINE, { MAVERICK_MIGRATIONS_ARCHIVEES: 'var/migrations' }), [RESTE, resolve('var/migrations')]);
});

test('registresDOrthographe : lit ensemble ce qui reste et l\'archive, sans doublon (même nom = même registre, le premier), triés par nom, hors registres', (t) => {
  const reste = dossierTemporaire('migrations-restantes', { t });
  const archive = dossierTemporaire('migrations-archivees', { t });
  const registre = (marque) => JSON.stringify({ corrections: [{ table: 't', col: 'c', id: marque, avant: 'a', apres: 'b' }] });
  writeFileSync(join(reste, '0006-reste.json'), registre('reste-0006'));
  writeFileSync(join(reste, '0003-meme-nom.json'), registre('reste-0003'));
  writeFileSync(join(reste, '0007-pas-un-registre.json'), JSON.stringify({ textes: [{ avant: 'a', apres: 'b' }] }));
  writeFileSync(join(reste, '0008.sql'), 'SELECT 1;');
  writeFileSync(join(archive, '0003-meme-nom.json'), registre('archive-0003'));
  writeFileSync(join(archive, '0005-archive.json'), registre('archive-0005'));
  const ids = (dossiers) => registresDOrthographe(dossiers).map((cs) => cs[0].id);
  assert.deepEqual(ids([reste]), ['reste-0003', 'reste-0006']);
  assert.deepEqual(ids([reste, archive]), ['reste-0003', 'archive-0005', 'reste-0006']);
  assert.deepEqual(ids([join(reste, 'absent'), archive]), ['archive-0003', 'archive-0005'], 'un dossier absent (data/migrations le jour J) est ignoré');
});

test('passe S : MAVERICK_MIGRATIONS_ARCHIVEES posée avec l\'archive des migrations, jamais dans les autres passes ni sans archive', () => {
  const base = { MAVERICK_MIGRATIONS_ARCHIVEES: '/ailleurs' };
  assert.equal(environnementDeLaPasse(PASSE_SANS_LE_CONTENU, { migrations: '/hors/copie/data/migrations', base }).MAVERICK_MIGRATIONS_ARCHIVEES, '/hors/copie/data/migrations');
  assert.equal(environnementDeLaPasse(PASSE_SANS_LE_CONTENU, { base }).MAVERICK_MIGRATIONS_ARCHIVEES, undefined);
  assert.equal(environnementDeLaPasse('C', { migrations: '/hors/copie/data/migrations', base }).MAVERICK_MIGRATIONS_ARCHIVEES, undefined);
});
