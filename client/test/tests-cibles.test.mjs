// Sélection des tests (npm run test:cible ; skill choisir-les-tests) : logique pure de scripts/tests-cibles-lib.mjs sur un dépôt en mémoire (graphe,
// citations, fermeture transitive), un cas par règle de scripts/tests-cibles-regles.mjs (épinglé : une règle ajoutée sans son cas fait échouer
// ce fichier — boucle d'affinage), le recouvrement d'un rebase sur un vrai dépôt Git jetable, et le script lancé sur le dépôt (--liste, --pourquoi).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as regles from '../scripts/tests-cibles-regles.mjs';
import {
  apresRebase, baseDeLaBranche, brancheCourante, construireGraphe, correspond, espacesFautifs, extraireReferences, fichiersDeLArbre, globVersRegex,
  marqueursDeConflit, pourquoi, recouvrement, selectionner,
} from '../scripts/tests-cibles-lib.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../scripts/tests-cibles.mjs', import.meta.url));

/** Un dépôt en mémoire : { chemin: texte }. Les tests sont les client/test/*.test.mjs. */
function depot(fichiers, r = regles) {
  const tests = Object.keys(fichiers).filter((c) => /^client\/test\/[^/]+\.test\.mjs$/.test(c));
  return construireGraphe({ tests, lire: (c) => fichiers[c] ?? null, existe: (c) => c in fichiers, regles: r });
}
const choisir = (graphe, fichiers, r = regles) => selectionner({ fichiers, graphe, regles: r });
const noms = (resultat) => [...resultat.tests.keys()];

describe('briques', () => {
  test('globs : **, *, ?, {a,b}', () => {
    assert.ok(correspond('data/rows/sort.sql', ['data/rows/**']));
    assert.ok(correspond('client/src/pages/a/b.astro', ['client/src/**/*.astro']));
    assert.ok(correspond('client/src/x.astro', ['client/src/**/*.astro']), '**/ vaut aussi zéro dossier');
    assert.ok(!correspond('client/src/x.astro.md', ['client/src/**/*.astro']));
    assert.ok(correspond('CLAUDE.md', ['*.md']) && !correspond('docs/x.md', ['*.md']));
    assert.ok(globVersRegex('a/{b,c}/?.mjs').test('a/c/x.mjs'));
    assert.ok(!globVersRegex('a/{b,c}/?.mjs').test('a/d/x.mjs'));
  });

  test('références : imports statiques, dynamiques littéraux, gabarits, new URL, join', () => {
    const r = extraireReferences(`
      import a from './a.mjs';
      import {
        b, c,
      } from "../lib/b.mjs";
      export { d } from './d.mjs';
      import './effet.mjs';
      import fs from 'node:fs';
      const e = await import('../src/scripts/e.mjs');
      await import(\`../src/scripts/f.mjs?page=\${n}\`);
      const css = await import('../styles/g.css?raw');
      const dist = new URL('../dist/', import.meta.url);
      const h = new URL('./fixtures/h.json', import.meta.url);
      const rows = join(RACINE, 'data', 'rows');
      const claude = join(racine, 'CLAUDE.md');
    `);
    assert.deepEqual(r.imports.sort(), ['../lib/b.mjs', '../src/scripts/e.mjs', '../src/scripts/f.mjs', '../styles/g.css', './a.mjs', './d.mjs', './effet.mjs']);
    assert.deepEqual(r.urls.sort(), ['../dist/', './fixtures/h.json']);
    assert.deepEqual(r.joints.sort(), ['CLAUDE.md', 'data/rows']);
  });

  test('base de la branche : origin/master pour une hotfix, origin/dev sinon', () => {
    assert.equal(baseDeLaBranche('hotfix/lien'), 'origin/master');
    assert.equal(baseDeLaBranche('feature/x'), 'origin/dev');
    assert.equal(baseDeLaBranche('HEAD'), 'origin/dev');
  });
});

describe('analyse', () => {
  test('fermeture transitive : test → aide → module → module, avec le chemin dit par --pourquoi', () => {
    const g = depot({
      'client/test/a.test.mjs': "import { x } from './aide-a.mjs';",
      'client/test/aide-a.mjs': "export * from '../src/lib/x.mjs';",
      'client/src/lib/x.mjs': "import { y } from './y';\nexport const x = y;",
      'client/src/lib/y.ts': 'export const y = 1;',
      'client/test/b.test.mjs': "import '../src/lib/z.mjs';",
      'client/src/lib/z.mjs': '',
    });
    const r = choisir(g, ['client/src/lib/y.ts']);
    assert.deepEqual(noms(r), ['test/a.test.mjs'], 'import sans extension résolu, b non choisi');
    assert.deepEqual(r.tout, []);
    const [ligne, detail] = pourquoi(r, 'a');
    assert.match(ligne, /test\/a\.test\.mjs est choisi/);
    assert.match(detail, /client\/src\/lib\/y\.ts — graphe : src\/lib\/x\.mjs importe client\/src\/lib\/y\.ts \(via test\/aide-a\.mjs → src\/lib\/x\.mjs\)/);
    assert.match(pourquoi(r, 'test/b.test.mjs')[0], /n'est pas choisi/);
  });

  test('import supprimé : le test qui importe encore le fichier est choisi', () => {
    const g = depot({ 'client/test/a.test.mjs': "import '../src/lib/parti.mjs';" });
    assert.deepEqual(noms(choisir(g, ['client/src/lib/parti.mjs'])), ['test/a.test.mjs']);
  });

  test('new URL : un fichier ou un dossier ouvert (dist/, data/rows/) ; la racine et client/ ne comptent pas', () => {
    const g = depot({
      'client/test/a.test.mjs': "const f = new URL('./fixtures/f.json', import.meta.url);",
      'client/test/b.test.mjs': "const d = new URL('../../data/rows/', import.meta.url);",
      'client/test/c.test.mjs': "const racine = new URL('../../', import.meta.url); const client = new URL('../', import.meta.url);",
      'client/test/fixtures/f.json': '{}',
    });
    assert.deepEqual(noms(choisir(g, ['client/test/fixtures/f.json'])).filter((t) => t !== 'test/dossiers-temporaires.test.mjs'), ['test/a.test.mjs']);
    assert.ok(noms(choisir(g, ['data/rows/sort.sql'])).includes('test/b.test.mjs'));
    assert.ok(!noms(choisir(g, ['client/src/lib/x.mjs'])).includes('test/c.test.mjs'));
  });

  test("join : deux segments valent pour le dossier, un seul seulement pour ce fichier", () => {
    const g = depot({
      'client/test/a.test.mjs': "const rows = join(RACINE, 'data', 'rows');",
      'client/test/b.test.mjs': "const c = join(RACINE, 'client'); const f = join(racine, 'CLAUDE.md');",
    });
    assert.deepEqual(noms(choisir(g, ['data/rows/sort.sql'])).filter((t) => t === 'test/a.test.mjs' || t === 'test/b.test.mjs'), ['test/a.test.mjs']);
    assert.ok(noms(choisir(g, ['CLAUDE.md'])).includes('test/b.test.mjs'));
    assert.ok(!noms(choisir(g, ['client/src/lib/x.mjs'])).includes('test/b.test.mjs'));
  });

  test('citations : chemin, nom d\'un fichier non JS, nom d\'un module entre guillemets ; pas un nom commun', () => {
    const g = depot({
      'client/test/chemin.test.mjs': '// voir scripts/db-build.mjs et docs/serveur.md.',
      'client/test/nom.test.mjs': "const ci = readFileSync(join(racine, '.github', 'workflows', 'ci.yml'));\n// ci.yml lance npm test",
      'client/test/spawn.test.mjs': "spawnSync(process.execPath, [join(SCRIPTS, 'db-check.mjs')]);",
      'client/test/commun.test.mjs': '// chaque SKILL.md et index.mjs',
      'client/test/aide-cite.mjs': '// sources/sources.json',
      'client/test/par-aide.test.mjs': "import './aide-cite.mjs';",
    });
    const sauf = (r) => noms(r).filter((t) => t !== 'test/dossiers-temporaires.test.mjs');
    assert.deepEqual(sauf(choisir(g, ['client/scripts/db-build.mjs'])), ['test/chemin.test.mjs']);
    assert.deepEqual(sauf(choisir(g, ['docs/serveur.md'])), ['test/chemin.test.mjs'], 'point final retiré');
    assert.deepEqual(sauf(choisir(g, ['.github/workflows/ci.yml'])), ['test/nom.test.mjs']);
    assert.deepEqual(sauf(choisir(g, ['client/scripts/db-check.mjs'])), ['test/spawn.test.mjs']);
    assert.deepEqual(sauf(choisir(g, ['client/src/lib/autre/db-check.mjs'])), ['test/spawn.test.mjs'], 'nom de module entre guillemets');
    assert.deepEqual(sauf(choisir(g, ['.claude/skills/x/SKILL.md'])), [], 'SKILL.md est trop commun');
    assert.deepEqual(sauf(choisir(g, ['sources/sources.json'])), ['test/par-aide.test.mjs'], 'citation d\'une aide importée');
    assert.match(pourquoi(choisir(g, ['docs/serveur.md']), 'chemin')[1], /citation : le test cite docs\/serveur\.md/);
  });

  test('fabriqués ignorés, fichier hors de toute règle → suite entière, fichier couvert sans test → « sans test »', () => {
    const g = depot({ 'client/test/a.test.mjs': '' });
    const r = choisir(g, ['client/src/content/wiki/magies/feu.md', 'var/maverick.db', 'client/dist/index.html', 'client/src/lib/seul.mjs']);
    assert.deepEqual(r.ignores, ['client/dist/index.html', 'client/src/content/wiki/magies/feu.md', 'var/maverick.db']);
    assert.deepEqual(r.sansTest, ['client/src/lib/seul.mjs']);
    assert.deepEqual(r.tout, []);
    const inconnu = choisir(g, ['bizarre/fichier.txt']);
    assert.equal(inconnu.tout.length, 1);
    assert.match(inconnu.tout[0].raison, /aucune règle ne couvre ce fichier/);
    assert.match(pourquoi(inconnu, 'a')[0], /suite entière/);
  });

  test('indication du build : un test choisi qui lit dist/ et une source du rendu changée', () => {
    const g = depot({
      'client/test/x-html.test.mjs': "import '../src/lib/x.mjs';\nconst dist = new URL('../dist/', import.meta.url);",
      'client/test/x.test.mjs': "import '../src/lib/x.mjs';",
      'client/src/lib/x.mjs': '',
    });
    const r = choisir(g, ['client/src/lib/x.mjs']);
    assert.deepEqual(r.lisentDist, ['test/x-html.test.mjs']);
    assert.deepEqual(r.rendu, ['client/src/lib/x.mjs']);
    assert.deepEqual(choisir(g, ['client/test/x.test.mjs']).rendu, []);
  });
});

// Un cas par règle du fichier de règles : { nom: [fichier modifié, test attendu (ou SUITE / SANS_TEST), dépôt en mémoire] }.
const SUITE = Symbol('suite entière');
const SANS_TEST = Symbol('sans test');
const TESTS_DU_DEPOT = {
  'client/test/tests-cibles.test.mjs': '',
  'client/test/lit-base.test.mjs': "const rows = readFileSync(join(racine, 'data', 'rows', 'x.sql'));",
  'client/test/lit-schema.test.mjs': "db.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));",
  'client/test/par-donnees.test.mjs': "import { ouvrirBase } from '../src/lib/donnees.mjs';",
  'client/src/lib/donnees.mjs': '',
  'client/test/instructions-claude.test.mjs': '',
  'client/test/decisions-index.test.mjs': '',
  'client/test/cite-doc.test.mjs': '// docs/flux-git.md',
  'client/test/flux-git.test.mjs': '',
  'client/test/deploy-vps.test.mjs': '',
  'client/test/dossiers-temporaires.test.mjs': '',
  'client/test/page-html.test.mjs': "const dist = fileURLToPath(new URL('../dist/', import.meta.url));",
  'client/test/importeur.test.mjs': "// lance tools/sheets/import.py",
  'client/test/gitignore.test.mjs': "// .gitignore ignore var/",
};
const CAS = {
  outillage: [['client/package.json', SUITE], ['.nvmrc', SUITE], ['client/astro.config.mjs', SUITE]],
  'selection-des-tests': [['client/scripts/tests-cibles-regles.mjs', 'test/tests-cibles.test.mjs']],
  base: [['data/rows/sort.sql', 'test/lit-base.test.mjs'], ['data/migrations/0099-x.sql', 'test/lit-schema.test.mjs'], ['data/derive.sql', 'test/par-donnees.test.mjs']],
  'donnees-autres': [['data/LISEZMOI.txt', SANS_TEST]],
  instructions: [['.claude/agents/tech-back.md', 'test/instructions-claude.test.mjs'], ['CLAUDE.md', 'test/instructions-claude.test.mjs']],
  decisions: [['docs/decisions-regles.md', 'test/decisions-index.test.mjs'], ['docs/decisions-index.md', 'test/decisions-index.test.mjs']],
  docs: [['docs/flux-git.md', 'test/cite-doc.test.mjs'], ['docs/autre.md', SANS_TEST]],
  'flux-git-et-hebergement': [['.github/workflows/ci.yml', 'test/flux-git.test.mjs'], ['deploy/vps/x.sh', 'test/deploy-vps.test.mjs'], ['tools/flux-git/cli.mjs', 'test/flux-git.test.mjs']],
  tests: [['client/test/fixtures/x.json', 'test/dossiers-temporaires.test.mjs']],
  rendu: [['client/src/pages/index.astro', 'test/page-html.test.mjs'], ['client/src/styles/global/x.css', 'test/page-html.test.mjs']],
  'outils-et-sources': [['tools/sheets/import.py', 'test/importeur.test.mjs'], ['sources/raw/x.txt', SANS_TEST]],
  git: [['.gitignore', 'test/gitignore.test.mjs']],
};

describe('règles (scripts/tests-cibles-regles.mjs)', () => {
  test('chaque règle a son cas ici', () => {
    assert.deepEqual(Object.keys(CAS).sort(), regles.REGLES.map((r) => r.nom).sort(), 'une règle ajoutée demande son cas dans CAS');
  });

  const g = depot(TESTS_DU_DEPOT);
  for (const [nom, cas] of Object.entries(CAS)) {
    test(`règle « ${nom} »`, () => {
      for (const [fichier, attendu] of cas) {
        const r = choisir(g, [fichier]);
        if (attendu === SUITE) {
          assert.equal(r.tout.length, 1, fichier);
          assert.match(r.tout[0].raison, new RegExp(`règle « ${nom} »`), fichier);
        } else if (attendu === SANS_TEST) {
          assert.deepEqual(r.sansTest, [fichier], fichier);
          assert.deepEqual(r.tout, [], fichier);
        } else {
          assert.deepEqual(r.tout, [], fichier);
          assert.ok(r.tests.has(attendu), `${fichier} → ${attendu} (choisis : ${noms(r).join(', ')})`);
        }
      }
    });
  }

  test('un test nommé par une règle mais absent (à venir) est ignoré sans erreur', () => {
    const r = choisir(depot({ 'client/test/a.test.mjs': '' }), ['CLAUDE.md']);
    assert.deepEqual(r.tests.size, 0);
    assert.deepEqual(r.sansTest, ['CLAUDE.md']);
  });

  test('format : nom, globs, raison, et des sélecteurs connus', () => {
    const connus = new Set(['nom', 'fichiers', 'raison', 'suiteEntiere', 'tests', 'contenant', 'important', 'lisentDist']);
    for (const r of regles.REGLES) {
      assert.ok(r.nom && r.raison && Array.isArray(r.fichiers) && r.fichiers.length, r.nom);
      for (const cle of Object.keys(r)) assert.ok(connus.has(cle), `${r.nom} : champ inconnu ${cle}`);
      for (const t of r.tests ?? []) assert.match(t, /^test\/[^/]+\.test\.mjs$/, `${r.nom} : ${t} (depuis client/)`);
    }
  });
});

describe('recouvrement d\'un rebase', () => {
  test('pur : base ∩ lot, plus les fichiers résolus à la main', () => {
    assert.deepEqual(recouvrement({ arrivees: ['a', 'b', 'c'], lot: ['c', 'a', 'd'] }), { fichiers: ['a', 'c'], communs: ['a', 'c'], resolus: [] });
    assert.deepEqual(recouvrement({ arrivees: ['b'], lot: ['d'], resolus: ['e'] }).fichiers, ['e']);
    assert.deepEqual(recouvrement({ arrivees: [], lot: ['d'] }).fichiers, []);
  });

  test('sur un dépôt Git jetable : arrivées, lot, recouvrement, marqueurs, espaces', (t) => {
    const dossier = dossierTemporaire('tests-cibles', { t });
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: dossier, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.org' };
    const git = (args) => {
      const r = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: dossier, env, encoding: 'utf8' });
      return { code: r.status, stdout: r.stdout, stderr: r.stderr };
    };
    const ok = (...args) => { const r = git(args); assert.equal(r.code, 0, `git ${args.join(' ')} : ${r.stderr}`); return r.stdout; };
    const ecrire = (chemin, texte) => { mkdirSync(dirname(join(dossier, chemin)), { recursive: true }); writeFileSync(join(dossier, chemin), texte); };
    const lignes10 = (marque = {}) => `${Array.from({ length: 10 }, (_, i) => marque[i] ?? `ligne ${i}`).join('\n')}\n`;

    ok('init', '--quiet', '-b', 'dev');
    ecrire('a.txt', lignes10()); ecrire('b.txt', 'b\n'); ecrire('c.txt', 'c\n');
    ok('add', '-A'); ok('commit', '--quiet', '-m', 'base');
    ok('switch', '--quiet', '-c', 'feature/x');
    ecrire('a.txt', lignes10({ 8: 'ligne 8 du lot' })); ecrire('d.txt', 'd\n');
    ok('add', '-A'); ok('commit', '--quiet', '-m', 'lot');
    ok('switch', '--quiet', 'dev');
    ecrire('a.txt', lignes10({ 1: 'ligne 1 de la base' })); ecrire('b.txt', 'b2\n');
    ok('add', '-A'); ok('commit', '--quiet', '-m', 'base bouge');
    ok('switch', '--quiet', 'feature/x');
    ok('rebase', '--quiet', 'dev');

    const r = apresRebase({ git, base: 'dev' });
    assert.equal(r.avertissement, null, 'juste après le rebase, ORIG_HEAD est sûr');
    assert.deepEqual(r.arrivees, ['a.txt', 'b.txt']);
    assert.deepEqual(r.lot, ['a.txt', 'd.txt']);
    assert.deepEqual(r.fichiers, ['a.txt']);
    assert.deepEqual(apresRebase({ git, base: 'dev', resolus: ['d.txt'] }).fichiers, ['a.txt', 'd.txt']);
    assert.deepEqual(marqueursDeConflit(git, r.lot), []);
    assert.equal(espacesFautifs(git, 'dev', r.fichiers), '');

    // Un marqueur laissé et une fin de ligne fautive dans l'arbre de travail.
    ecrire('d.txt', 'd\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> autre\n');
    ecrire('a.txt', lignes10({ 8: 'ligne 8 du lot   ' }));
    assert.deepEqual(marqueursDeConflit(git, ['d.txt']), ['d.txt:2:<<<<<<< HEAD', 'd.txt:6:>>>>>>> autre']);
    assert.match(espacesFautifs(git, 'dev', ['a.txt']), /a\.txt:9: trailing whitespace/);
    assert.deepEqual(fichiersDeLArbre(git).sort(), ['a.txt', 'd.txt']);

    // Recouvrement vide : la base ne touche que ce que le lot ne touche pas.
    ok('checkout', '--quiet', '--', 'a.txt', 'd.txt');
    ok('switch', '--quiet', 'dev');
    ecrire('c.txt', 'c2\n'); ok('add', '-A'); ok('commit', '--quiet', '-m', 'base rebouge');
    ok('switch', '--quiet', 'feature/x');
    ok('rebase', '--quiet', 'dev');
    const vide = apresRebase({ git, base: 'dev' });
    assert.deepEqual(vide.arrivees, ['c.txt']);
    assert.deepEqual(vide.fichiers, []);

    assert.throws(() => apresRebase({ git, base: 'dev', avant: 'inexistant' }), /inexistant introuvable/);
    ok('switch', '--quiet', 'dev'); ok('switch', '--quiet', 'feature/x');
    assert.match(apresRebase({ git, base: 'dev' }).avertissement, /pas un rebase.*--avant/, 'une autre opération depuis : ORIG_HEAD peut dater');
    assert.equal(apresRebase({ git, base: 'dev', avant: 'HEAD' }).avertissement, null);
  });
});

describe('rebase en pause et lecture seule', () => {
  test('--apres-rebase refusé pendant un rebase en pause ; la branche (une hotfix) lue dans head-name ; status ne réécrit pas l\'index', (t) => {
    const dossier = dossierTemporaire('tests-cibles-pause', { t });
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', HOME: dossier, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.org' };
    const git = (args) => {
      const r = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: dossier, env, encoding: 'utf8' });
      return { code: r.status, stdout: r.stdout, stderr: r.stderr };
    };
    const ok = (...args) => { const r = git(args); assert.equal(r.code, 0, `git ${args.join(' ')} : ${r.stderr}`); return r.stdout; };
    const index = () => readFileSync(join(dossier, '.git', 'index'));

    ok('init', '--quiet', '-b', 'master');
    writeFileSync(join(dossier, 'a.txt'), 'a\n'); ok('add', '-A'); ok('commit', '--quiet', '-m', 'base');
    ok('switch', '--quiet', '-c', 'hotfix/lien');
    writeFileSync(join(dossier, 'a.txt'), 'lot\n'); ok('commit', '--quiet', '-a', '-m', 'lot');

    // Même contenu réécrit : la date du fichier change, un status ordinaire rafraîchirait l'index.
    const avant = index();
    writeFileSync(join(dossier, 'a.txt'), 'lot\n');
    const passe = new Date(Date.now() - 60_000);
    utimesSync(join(dossier, 'a.txt'), passe, passe);
    assert.deepEqual(fichiersDeLArbre(git), []);
    assert.ok(index().equals(avant), '.git/index inchangé (git --no-optional-locks status)');

    ok('switch', '--quiet', 'master');
    writeFileSync(join(dossier, 'a.txt'), 'base bouge\n'); ok('commit', '--quiet', '-a', '-m', 'base bouge');
    ok('switch', '--quiet', 'hotfix/lien');
    assert.equal(brancheCourante({ git }), 'hotfix/lien');
    assert.notEqual(git(['rebase', 'master']).code, 0, 'le rebase s\'arrête sur le conflit');
    assert.equal(git(['symbolic-ref', '-q', 'HEAD']).code, 1, 'HEAD détachée pendant la pause');
    assert.equal(brancheCourante({ git }), 'hotfix/lien', 'lue dans rebase-merge/head-name');
    assert.equal(baseDeLaBranche(brancheCourante({ git })), 'origin/master');
    assert.throws(() => apresRebase({ git, base: 'master' }), /rebase en pause : le finir d'abord/);
    ok('rebase', '--abort');
    assert.equal(apresRebase({ git, base: 'master', avant: 'HEAD' }).fichiers.length >= 0, true, 'hors pause : accepté');
  });
});

describe('le script sur le dépôt', () => {
  const lancer = (...args) => spawnSync(process.execPath, ['--no-warnings', SCRIPT, ...args], { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, INIT_CWD: CLIENT } });

  test('graphe du dépôt en moins de 3 s, ce test choisi par la sélection elle-même', () => {
    const tests = readdirSync(join(CLIENT, 'test')).filter((f) => f.endsWith('.test.mjs')).map((f) => `client/test/${f}`);
    const racine = join(CLIENT, '..');
    const debut = Date.now();
    const g = construireGraphe({
      tests, regles,
      lire: (c) => { try { return readFileSync(join(racine, c), 'utf8'); } catch { return null; } },
      existe: (c) => { try { return statSync(join(racine, c)).isFile(); } catch { return false; } },
    });
    const r = choisir(g, ['client/scripts/tests-cibles-lib.mjs', 'tools/flux-git/regles.mjs']);
    assert.ok(Date.now() - debut < 3000, `${Date.now() - debut} ms`);
    assert.ok(r.tests.has('test/tests-cibles.test.mjs'));
    assert.ok(r.tests.has('test/flux-git.test.mjs'), 'flux-git.test.mjs importe tools/flux-git/regles.mjs');
  });

  test('--liste, --pourquoi, suite entière, --aide (sans rien lancer)', () => {
    const liste = lancer('--liste', '--fichiers', 'scripts/tests-cibles-lib.mjs');
    assert.equal(liste.status, 0, liste.stderr);
    assert.match(liste.stdout, /client\/scripts\/tests-cibles-lib\.mjs/);
    assert.match(liste.stdout, /test\/tests-cibles\.test\.mjs/);
    const raison = lancer('--pourquoi', 'tests-cibles', '--fichiers', '../client/scripts/tests-cibles-lib.mjs');
    assert.match(raison.stdout, /test\/tests-cibles\.test\.mjs est choisi/);
    const tout = lancer('--liste', '--fichiers', 'package.json');
    assert.equal(tout.status, 0);
    assert.match(tout.stdout, /Suite entière :\n {2}client\/package\.json — règle « outillage »/);
    const aide = lancer('--aide');
    assert.match(aide.stdout, /La CI lance toujours la suite entière/);
    assert.equal(lancer('--inconnue').status, 2);
  });
});
