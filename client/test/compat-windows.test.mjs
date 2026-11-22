// Le site se construit et se teste aussi sous Windows (poste du propriétaire, core.autocrlf=true), sans rien changer sous Linux : adresse des morceaux de
// Markdown, base fermée avant la suppression de son dossier, sources lues en CRLF. Le nettoyage des dossiers de test est épinglé par dossiers-temporaires.test.mjs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { libererLesBases } from '../src/lib/donnees.mjs';
import { urlDuMorceau } from '../src/lib/markdown-fichier.mjs';
import { dossierTemporaire, fichierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';
import { lireSansCrlf, sansCrlf } from './aide-fins-de-ligne.mjs';

test('urlDuMorceau : une adresse convertible en chemin sous Windows, inchangée sous Linux', () => {
  const id = 'chronologie/origine-du-monde';
  assert.equal(fileURLToPath(urlDuMorceau(id, { windows: true }), { windows: true }), 'C:\\chronologie\\origine-du-monde.md');
  assert.equal(urlDuMorceau(id, { windows: false }).href, 'file:///chronologie/origine-du-monde.md');
  assert.doesNotThrow(() => fileURLToPath(urlDuMorceau(id)), 'sur le système qui lance le test');
});

test('libererLesBases : ferme la base avant de supprimer son dossier, et tolère une base déjà fermée', (t) => {
  const dossier = dossierTemporaire('liberer-base', { t });
  const db = new DatabaseSync(join(dossier, 'maverick.db'));
  db.exec('CREATE TABLE t (x)');
  libererLesBases([{ db, dossier }]);
  assert.equal(db.isOpen, false);
  assert.equal(existsSync(dossier), false);
  assert.doesNotThrow(() => libererLesBases([{ db, dossier }]));
});

test('libererLesBases ne lève jamais : une suppression impossible est signalée, et la base suivante est quand même libérée', (t) => {
  const avertir = t.mock.method(console, 'warn', () => {});
  const dossier = dossierTemporaire('liberer-suivante', { t });
  const impossible = { db: new DatabaseSync(':memory:'), dossier: 'chemin\0impossible' }; // refusé par rmSync sur tous les systèmes
  const suivante = { db: new DatabaseSync(join(dossier, 'maverick.db')), dossier };
  assert.doesNotThrow(() => libererLesBases([impossible, suivante]));
  assert.equal(impossible.db.isOpen, false);
  assert.equal(suivante.db.isOpen, false);
  assert.equal(existsSync(dossier), false);
  assert.equal(avertir.mock.callCount(), 1);
  assert.ok(avertir.mock.calls[0].arguments[0].includes(impossible.dossier), 'le dossier resté est nommé');
});

test('un processus qui échoue avec une seconde connexion à sa base : aucune erreur de ménage ne suit sa vraie erreur', (t) => {
  const temporaire = dossierTemporaire('sortie-enfant', { t });
  const contenu = fichierTemporaire('contenu.db', 'sortie-contenu', { t });
  const source = new DatabaseSync(contenu);
  source.exec('CREATE TABLE essai (x)');
  source.close();
  // comme Astro après une erreur : son message, puis process.exit ; sous Windows, la seconde connexion empêche la suppression du dossier (EPERM)
  const script = `import { DatabaseSync } from 'node:sqlite';
import { cheminBase } from ${JSON.stringify(new URL('../src/lib/donnees.mjs', import.meta.url).href)};
globalThis.seconde = new DatabaseSync(cheminBase({ sansExemples: false }), { readOnly: true });
console.error('vraie cause');
process.exit(3);`;
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, ...variablesTemporaires(temporaire), MAVERICK_CONTENU: contenu, MAVERICK_CONTENU_DERIVE: 'complete' },
  });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /vraie cause/);
  assert.doesNotMatch(r.stderr, /^Error: /m);
});

test('lireSansCrlf : un fichier en CRLF se lit avec des « \\n », un fichier en LF est inchangé', (t) => {
  const dossier = dossierTemporaire('fins-de-ligne', { t });
  const crlf = join(dossier, 'crlf.md');
  const lf = join(dossier, 'lf.md');
  writeFileSync(crlf, '# Titre\r\n\r\n## Partie\r\n');
  writeFileSync(lf, '# Titre\n\n## Partie\n');
  assert.equal(lireSansCrlf(crlf), '# Titre\n\n## Partie\n');
  assert.equal(lireSansCrlf(pathToFileURL(crlf)), '# Titre\n\n## Partie\n', 'par une URL');
  assert.equal(lireSansCrlf(lf), '# Titre\n\n## Partie\n');
  assert.equal(sansCrlf('a\rb'), 'a\rb', 'un retour chariot seul n’est pas une fin de ligne');
});
