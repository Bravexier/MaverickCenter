// Garde-fou des dossiers temporaires des tests (demande du propriétaire, 2026-10-23 : « il doivent faire le ménage quand c'est fini ») : chaque
// dossier temporaire d'un test passe par test/aide-dossier-temporaire.mjs, qui le supprime à la fin du test (t.after) ou du fichier, même après un
// échec. Ce fichier épingle l'aide (rien ne reste, dans aucun des cas) et refuse, dans client/test/, tout mkdtemp, os.tmpdir(), chemin /tmp,
// /var/tmp ou /dev/shm, lecture de TMPDIR, tempfile (Python) ou mktemp (shell) hors de l'aide (sauf exception justifiée ci-dessous).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PREFIXE_COMMUN, dossierTemporaire, dossiersEnCours, fichierTemporaire, supprimerDossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const AIDE = join(ICI, 'aide-dossier-temporaire.mjs');

/** Ce qu'un test ne fait jamais lui-même : il demande son dossier à l'aide. */
const INTERDITS = [
  { motif: /\bmkdtemp(Sync)?\b/, quoi: 'mkdtemp' },
  { motif: /\btmpdir\b/, quoi: 'os.tmpdir()' },
  { motif: /['"`]\/tmp\b|['"`]\/['"`]\s*,\s*['"`]tmp['"`]/, quoi: 'chemin /tmp' },
  { motif: /['"`]\/var\/tmp\b/, quoi: 'chemin /var/tmp' },
  { motif: /\/dev\/shm\b/, quoi: 'chemin /dev/shm' },
  {
    motif: /process\.env\.(TMPDIR|TMP|TEMP)\b|process\.env\[['"](TMPDIR|TMP|TEMP)['"]\]|\{[^}]*\b(TMPDIR|TMP|TEMP)\b[^}]*\}\s*=\s*process\.env\b/,
    quoi: 'lecture de TMPDIR',
  },
  // le Python et le shell ont leurs propres créateurs de dossiers temporaires (dans un .mjs, « mktemp » peut être le texte d'un script contrôlé)
  { motif: /\btempfile\b/, quoi: 'tempfile (Python)', extensions: ['.py'] },
  { motif: /\bmktemp\b/, quoi: 'mktemp (shell)', extensions: ['.sh'] },
];

/** Exceptions justifiées : fichier, ce qu'il garde, et pourquoi. */
const EXCEPTIONS = [
  { fichier: 'deploy-volume.test.mjs', quoi: 'chemin /dev/shm', raison: 'un autre système de fichiers (tmpfs) pour une mesure « hors disque » ; le dossier y est créé par l’aide (option dans) et supprimé à la fin du test' },
];

/** Les appels interdits d'un source d'extension `extension` (lignes de commentaire ignorées) : [{ ligne, quoi }]. */
function appelsInterdits(source, extension = '.mjs') {
  const trouves = [];
  const interdits = INTERDITS.filter((i) => !i.extensions || i.extensions.includes(extension));
  source.split('\n').forEach((texte, i) => {
    const l = texte.trim();
    if (l.startsWith('//') || l.startsWith('*') || l.startsWith('/*') || (['.py', '.sh'].includes(extension) && l.startsWith('#'))) return;
    for (const { motif, quoi } of interdits) if (motif.test(texte)) trouves.push({ ligne: i + 1, quoi });
  });
  return trouves;
}

/** Les fichiers de code de client/test/ (sous-dossiers compris, hors __pycache__). */
function fichiersDesTests(dossier = ICI) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return e.name === '__pycache__' ? [] : fichiersDesTests(chemin);
    return /\.(mjs|cjs|js|py|sh)$/.test(e.name) ? [chemin] : [];
  });
}

test('appelsInterdits : mkdtemp, os.tmpdir(), /tmp, /var/tmp, /dev/shm, TMPDIR lu, tempfile (.py) et mktemp (.sh) sont vus ; l’aide, un commentaire et TMPDIR donné à un enfant ne le sont pas', () => {
  const vus = (s) => appelsInterdits(s).map((x) => x.quoi);
  assert.deepEqual(vus("const d = mkdtempSync(join(tmpdir(), 'x-'));"), ['mkdtemp', 'os.tmpdir()']);
  assert.deepEqual(vus("const d = await fs.promises.mkdtemp('x');"), ['mkdtemp']);
  assert.deepEqual(vus('const d = os.tmpdir();'), ['os.tmpdir()']);
  assert.deepEqual(vus("writeFileSync('/tmp/essai.json', '{}');"), ['chemin /tmp']);
  assert.deepEqual(vus('const p = `/tmp/${nom}`;'), ['chemin /tmp']);
  assert.deepEqual(vus("const d = '/dev/shm/x';"), ['chemin /dev/shm']);
  assert.deepEqual(vus('const d = process.env.TMPDIR ?? x;'), ['lecture de TMPDIR']);
  assert.deepEqual(vus("const d = process.env['TEMP'];"), ['lecture de TMPDIR']);
  assert.deepEqual(vus('const { TMPDIR } = process.env;'), ['lecture de TMPDIR']);
  assert.deepEqual(vus('const { PATH, TEMP: t } = process.env;'), ['lecture de TMPDIR']);
  assert.deepEqual(vus("const d = join('/', 'tmp', 'x');"), ['chemin /tmp']);
  assert.deepEqual(vus("const d = '/var/tmp/x';"), ['chemin /var/tmp']);
  assert.deepEqual(appelsInterdits('import tempfile\nd = tempfile.mkdtemp()', '.py').map((x) => `${x.ligne} ${x.quoi}`), ['1 tempfile (Python)', '2 mkdtemp', '2 tempfile (Python)']);
  assert.deepEqual(appelsInterdits('d=$(mktemp -d)', '.sh').map((x) => x.quoi), ['mktemp (shell)']);
  assert.deepEqual(appelsInterdits('# tempfile ou mktemp en commentaire', '.py'), []);
  assert.deepEqual(vus("assert.match(code, /provisoire=\\$\\(mktemp -u /); // tempfile"), [], 'mktemp et tempfile : seulement dans un .sh ou un .py');
  assert.deepEqual(vus('const { NODE_TEST_CONTEXT, ...env } = process.env;'), []);
  assert.deepEqual(vus("const d = dossierTemporaire('x', { t });\nconst env = { TMPDIR: d };\n// mkdtemp et tmpdir() en commentaire\n * /tmp dans un bloc"), []);
  assert.deepEqual(appelsInterdits("ok();\nconst d = mkdtempSync('x');").map((x) => x.ligne), [2]);
});

test('aucun mkdtemp, os.tmpdir(), chemin /tmp ou /dev/shm, ni TMPDIR lu dans client/test/ hors de l’aide (sauf exception justifiée)', () => {
  const fichiers = fichiersDesTests();
  assert.ok(fichiers.length > 200, `${fichiers.length} fichiers lus`);
  const fautes = [];
  const exceptionsServies = new Set();
  for (const f of fichiers) {
    if (f === AIDE || f === fileURLToPath(import.meta.url)) continue;
    const nom = relative(ICI, f);
    for (const { ligne, quoi } of appelsInterdits(readFileSync(f, 'utf8'), extname(f))) {
      const exception = EXCEPTIONS.find((e) => e.fichier === nom && e.quoi === quoi);
      if (exception) exceptionsServies.add(exception);
      else fautes.push(`${nom}:${ligne} : ${quoi} — passer par test/aide-dossier-temporaire.mjs (dossierTemporaire, fichierTemporaire, variablesTemporaires)`);
    }
  }
  assert.deepEqual(fautes, []);
  for (const e of EXCEPTIONS) {
    assert.ok(e.raison.length > 20, `${e.fichier} : une exception se justifie`);
    assert.ok(exceptionsServies.has(e), `${e.fichier} (${e.quoi}) : exception qui ne sert plus, à retirer`);
  }
});

test('dossierTemporaire : sous os.tmpdir() (ou sous « dans »), au préfixe commun ; supprimé à la fin du test qui le demande', async (t) => {
  let dossier;
  let dedans;
  await t.test('le test qui l’utilise', (st) => {
    dossier = dossierTemporaire('garde-fou', { t: st });
    dedans = dossierTemporaire('dedans', { t: st, dans: dossier });
    writeFileSync(join(dedans, 'f.txt'), 'x');
    assert.equal(dirname(dossier), tmpdir());
    assert.ok(basename(dossier).startsWith(`${PREFIXE_COMMUN}garde-fou-`), dossier);
    assert.equal(dirname(dedans), dossier);
    assert.ok(dossiersEnCours().includes(dossier));
  });
  assert.ok(!existsSync(dossier), 'supprimé à la fin de son test');
  assert.ok(!dossiersEnCours().includes(dossier), 'oublié');
  const fichier = fichierTemporaire('base.db', 'garde-fou-fichier', { t });
  assert.equal(basename(fichier), 'base.db');
  assert.ok(existsSync(dirname(fichier)) && !existsSync(fichier), 'le dossier existe, le fichier reste à écrire');
  supprimerDossierTemporaire(dirname(fichier));
  supprimerDossierTemporaire(dirname(fichier)); // sans erreur s'il n'existe plus
  assert.deepEqual(variablesTemporaires('/x'), { TMPDIR: '/x', TMP: '/x', TEMP: '/x' });
});

test('un fichier de test qui crée ses dossiers (au chargement, dans un test réussi, dans un test qui échoue, dans un test interrompu par process.exit) ne laisse rien dans le dossier temporaire', (t) => {
  // un processus node --test à part, dont le dossier temporaire est un dossier neuf : tout ce que l'aide y crée doit en avoir disparu
  const temporaire = dossierTemporaire('garde-fou-enfant', { t });
  const essais = dossierTemporaire('garde-fou-essai', { t });
  const essai = join(essais, 'essai.test.mjs');
  const journal = join(essais, 'crees.txt'); // chaque dossier créé, noté avant la suite du cas
  writeFileSync(essai, `import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dossierTemporaire } from ${JSON.stringify(pathToFileURL(AIDE).href)};
const cree = (prefixe, options) => { const d = dossierTemporaire(prefixe, options); writeFileSync(join(d, 'f'), 'x'); appendFileSync(${JSON.stringify(journal)}, d + '\\n'); return d; };
cree('fichier');
test('réussi', (t) => { cree('reussi', { t }); });
test('échoue', (t) => { cree('echoue', { t }); cree('echoue-sans-t'); throw new Error('échec voulu'); });
// ni t.after ni after : seule la sortie du processus nettoie
test('interrompu', (t) => { cree('interrompu', { t }); process.exit(7); });
`);
  const { NODE_TEST_CONTEXT, ...env } = process.env; // un node --test à part entière, pas un enfant du lanceur en cours
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', essai], { encoding: 'utf8', env: { ...env, ...variablesTemporaires(temporaire) } });
  assert.match(r.stdout, /exitCode: 7/, 'le fichier d’essai est allé jusqu’au test interrompu');
  const crees = readFileSync(journal, 'utf8').trim().split('\n');
  assert.deepEqual(crees.map((d) => basename(d).replace(/-[^-]+$/, '')), ['fichier', 'reussi', 'echoue', 'echoue-sans-t', 'interrompu'].map((p) => `${PREFIXE_COMMUN}${p}`));
  for (const d of crees) assert.equal(dirname(d), temporaire, `${d} : dans le dossier temporaire donné à l’enfant`);
  assert.deepEqual(crees.filter((d) => existsSync(d)), [], 'aucun ne reste');
  assert.deepEqual(readdirSync(temporaire), [], 'rien ne reste');
});
