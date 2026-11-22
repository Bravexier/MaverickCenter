// Le site se construit et se teste aussi sous Windows (poste du propriétaire, core.autocrlf=true), sans rien changer sous Linux : adresse des morceaux de
// Markdown, base fermée avant la suppression de son dossier, sources lues en CRLF. Le nettoyage des dossiers de test est épinglé par dossiers-temporaires.test.mjs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { libererLesBases } from '../src/lib/donnees.mjs';
import { urlDuMorceau } from '../src/lib/markdown-fichier.mjs';
import { lireSchema } from '../src/lib/schema-doc.mjs';
import { dossierTemporaire, fichierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';
import { lireSansCrlf, sansCrlf } from './aide-fins-de-ligne.mjs';
import { reserveALinux } from './aide-plateforme.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const sansPython = spawnSync('python3', ['-I', '-c', 'pass']).status !== 0 && 'python3 absent';

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

test('réserve Linux : un test réservé tourne sous Linux (la CI), et se saute ailleurs avec sa raison', () => {
  assert.equal(reserveALinux('linux'), false);
  for (const plateforme of ['win32', 'darwin']) assert.match(reserveALinux(plateforme), /réservé à Linux/);
});

test('lireSchema : un schéma en CRLF se lit comme en LF', () => {
  const schema = '-- ====\n-- 1. PREMIÈRE\n-- ====\n-- Une table\nCREATE TABLE a (\n  x INTEGER -- une colonne\n);\n-- ====\n-- 2. SECONDE\n-- ====\n';
  const enLf = lireSchema(schema);
  assert.deepEqual(enLf.map((s) => s.titre), ['Hors section', '1. PREMIÈRE', '2. SECONDE']);
  assert.deepEqual(lireSchema(schema.replaceAll('\n', '\r\n')), enLf);
});

test('.gitattributes : le texte du dépôt reste en LF sur tous les clones', { skip: !existsSync(join(RACINE, '.gitattributes')) && 'hors du dépôt' }, () => {
  assert.match(lireSansCrlf(join(RACINE, '.gitattributes')), /^\* text=auto eol=lf$/m);
});

test('scripts Python à point d’entrée : sortie en UTF-8 et en « \\n » sous Windows (-I ignore PYTHONUTF8), rien de changé ailleurs', { skip: sansPython }, () => {
  const scripts = readdirSync(join(RACINE, 'tools'), { recursive: true }).filter((f) => f.endsWith('.py')).map((f) => join(RACINE, 'tools', f))
    .filter((f) => /^if __name__ == ["']__main__["']:/m.test(readFileSync(f, 'utf8')));
  assert.ok(scripts.length > 10, 'les scripts sont trouvés');
  const garde = /^if __name__ == ["']__main__["']:\n {4}if sys\.platform == "win32":.*\n {8}for flux in \(sys\.stdout, sys\.stderr\):\n {12}flux\.reconfigure\(encoding="utf-8", newline="\\n"\)\n/m;
  for (const f of scripts) assert.match(lireSansCrlf(f), garde, f);
  const aide = spawnSync('python3', ['-I', join(RACINE, 'tools', 'docs', 'codex.py'), '--help']);
  assert.equal(aide.status, 0, String(aide.stderr));
  assert.equal(aide.stdout.includes(13), false, 'aucun retour chariot');
  assert.match(new TextDecoder('utf-8', { fatal: true }).decode(aide.stdout), /[éèàêç]/, 'des accents en UTF-8');
});
