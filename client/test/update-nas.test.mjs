// Teste deploy/update-nas.sh contre un faux serveur GitHub (aucun accès réseau réel, aucun NAS).
// Nécessite sh, curl et tar ; sinon les tests sont ignorés.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = process.env.UPDATE_NAS_SCRIPT ?? fileURLToPath(new URL('../../deploy/update-nas.sh', import.meta.url));
const have = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
const skip = !(have('curl') && have('tar')) && 'sh, curl ou tar indisponible';

const TOKEN = 'github_pat_TESTTOKEN123';
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const root = mkdtempSync(join(tmpdir(), 'update-nas-test-'));
const state = { sha: SHA_A, tarball: null, token: TOKEN, tarballRequests: 0, auth: [] };
let server;
let apiUrl;

/** Archive au format GitHub : un unique dossier racine « owner-repo-<sha7> ». */
function tarball(files, sha) {
  const dir = mkdtempSync(join(root, 'tar-'));
  const top = `o-r-${sha.slice(0, 7)}`;
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, top, path)), { recursive: true });
    writeFileSync(join(dir, top, path), content);
  }
  const out = join(dir, 'out.tgz');
  assert.equal(spawnSync('tar', ['-czf', out, '-C', dir, top]).status, 0);
  return readFileSync(out);
}

/** Un site de `n` pages ; `label` permet de distinguer les versions. */
function site(n, label, skipPage) {
  const files = { 'index.html': `<h1>accueil ${label}</h1>` };
  for (let i = 0; i < n; i += 1) if (i !== skipPage) files[`wiki/p${i}/index.html`] = `<p>page ${i} ${label}</p>`;
  return files;
}

before(async () => {
  server = createServer((req, res) => {
    state.auth.push(req.headers.authorization);
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.headers.authorization !== `Bearer ${state.token}`) return json(401, { message: 'Bad credentials' });
    if (req.url === '/repos/o/r/commits/site') {
      if (!state.sha) return json(404, { message: 'Not Found' });
      assert.match(req.headers.accept, /vnd\.github\.sha/);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(state.sha);
    }
    if (req.url === `/repos/o/r/tarball/${state.sha}`) {
      state.tarballRequests += 1;
      res.writeHead(302, { Location: `/codeload/${state.sha}` });
      return res.end();
    }
    if (req.url === `/codeload/${state.sha}`) {
      res.writeHead(200, { 'Content-Type': 'application/gzip' });
      return res.end(state.tarball);
    }
    return json(404, { message: 'Not Found' });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  apiUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
});

/** Dossier de travail neuf (jeton en place) ; le script s'exécute dans un processus séparé. */
function nas(name, { token = TOKEN } = {}) {
  const base = join(root, name);
  mkdirSync(base, { recursive: true });
  if (token !== null) writeFileSync(join(base, '.github-token'), `${token}\n`);
  const run = (args = [], env = {}) =>
    new Promise((ok) => {
      execFile('sh', [SCRIPT, ...args], { env: { PATH: process.env.PATH, TMPDIR: root, BASE_DIR: base, REPO: 'o/r', GITHUB_API: apiUrl, ...env } },
        (error, stdout, stderr) => ok({ code: error ? error.code : 0, out: stdout + stderr }));
    });
  const read = (p) => readFileSync(join(base, p), 'utf8');
  return { base, run, read, has: (p) => existsSync(join(base, p)), log: () => read('update.log') };
}

function serve(sha, files) {
  state.sha = sha;
  state.tarball = files ? tarball(files, sha) : null;
}

test('installation initiale, puis « à jour » sans retélécharger', { skip }, async () => {
  serve(SHA_A, site(25, 'v1'));
  const n = nas('initial');
  const first = await n.run();
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /Installé : version aaaaaaa, 26 pages/);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.read('.installed-sha').trim(), SHA_A);
  assert.ok(!n.log().includes(TOKEN), 'le jeton ne doit jamais figurer dans le journal');

  const before = state.tarballRequests;
  const second = await n.run();
  assert.equal(second.code, 0);
  assert.match(second.out, /À jour/);
  assert.equal(state.tarballRequests, before, 'aucun téléchargement quand la version est déjà installée');

  const forced = await n.run(['--force']);
  assert.match(forced.out, /Installé/);
  assert.equal(state.tarballRequests, before + 1);
});

for (const mode of ['auto', '0']) {
  test(`nouvelle version : remplace tout et supprime les anciens fichiers (USE_RSYNC=${mode})`, { skip }, async () => {
    serve(SHA_A, site(25, 'v1'));
    const n = nas(`maj-${mode}`);
    assert.equal((await n.run([], { USE_RSYNC: mode })).code, 0);
    assert.ok(n.has('site/wiki/p3/index.html'));

    const v2 = site(25, 'v2', 3); // la page p3 disparaît
    v2['wiki/nouvelle/index.html'] = '<p>nouvelle</p>';
    serve(SHA_B, v2);
    const res = await n.run([], { USE_RSYNC: mode });
    assert.equal(res.code, 0, res.out);
    assert.equal(n.read('site/index.html'), '<h1>accueil v2</h1>');
    assert.ok(n.has('site/wiki/nouvelle/index.html'));
    assert.ok(!n.has('site/wiki/p3/index.html'), 'une page retirée de la version doit disparaître du NAS');
    assert.equal(n.read('.installed-sha').trim(), SHA_B);
  });
}

test('jeton refusé : erreur claire, site inchangé', { skip }, async () => {
  serve(SHA_A, site(25, 'v1'));
  const n = nas('jeton-refuse');
  assert.equal((await n.run()).code, 0);
  writeFileSync(join(n.base, '.github-token'), 'github_pat_MAUVAISJETON');
  serve(SHA_B, site(25, 'v2'));
  const res = await n.run();
  assert.equal(res.code, 1);
  assert.match(res.out, /impossible de lire la dernière version/);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.read('.installed-sha').trim(), SHA_A);
});

test('branche pas encore créée (404) : erreur claire', { skip }, async () => {
  serve(null, null);
  const res = await nas('sans-branche').run();
  assert.equal(res.code, 1);
  assert.match(res.out, /pas encore créée/);
});

test('archive sans index.html ou trop petite : refusée, site inchangé', { skip }, async () => {
  serve(SHA_A, site(25, 'v1'));
  const n = nas('archive-invalide');
  assert.equal((await n.run()).code, 0);

  const sansIndex = site(25, 'v2');
  delete sansIndex['index.html'];
  serve(SHA_B, sansIndex);
  let res = await n.run();
  assert.equal(res.code, 1);
  assert.match(res.out, /pas de index\.html/);

  serve(SHA_B, site(3, 'v2'));
  res = await n.run();
  assert.equal(res.code, 1);
  assert.match(res.out, /4 page\(s\) seulement/);

  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.ok(n.has('site/wiki/p24/index.html'), 'le site en place est intact');
  assert.equal(n.read('.installed-sha').trim(), SHA_A);
});

test('jeton absent ou mal formé : refus avant tout appel réseau', { skip }, async () => {
  serve(SHA_A, site(25, 'v1'));
  state.auth.length = 0;
  let res = await nas('sans-jeton', { token: null }).run();
  assert.equal(res.code, 1);
  assert.match(res.out, /jeton GitHub introuvable/);
  res = await nas('jeton-mal-forme', { token: 'abc"; rm -rf /' }).run();
  assert.equal(res.code, 1);
  assert.match(res.out, /ne contient pas un jeton GitHub valide/);
  assert.equal(state.auth.length, 0, 'aucune requête ne doit partir');
});

test('verrou : exemplaire déjà en cours = on sort sans rien faire ; verrou périmé = nettoyé', { skip }, async () => {
  serve(SHA_A, site(25, 'v1'));
  const n = nas('verrou');
  mkdirSync(join(n.base, '.update.lock'));
  writeFileSync(join(n.base, '.update.lock', 'pid'), String(process.pid)); // processus vivant
  let res = await n.run();
  assert.equal(res.code, 0);
  assert.match(res.out, /déjà en cours/);
  assert.ok(!n.has('site/index.html'));

  writeFileSync(join(n.base, '.update.lock', 'pid'), '999999'); // processus mort
  res = await n.run();
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /Verrou périmé/);
  assert.ok(n.has('site/index.html'));
  assert.ok(!n.has('.update.lock'), 'le verrou est retiré en fin de script');
});

test('SITE_DIR dangereux ou relatif : refusé', { skip }, async () => {
  serve(SHA_A, site(25, 'v1'));
  const n = nas('chemins');
  const protege = join(root, 'donnees-importantes');
  mkdirSync(protege);
  writeFileSync(join(protege, 'precieux.txt'), 'à conserver');
  let res = await n.run([], { SITE_DIR: protege });
  assert.equal(res.code, 1);
  assert.match(res.out, /refus par prudence/);
  assert.equal(readFileSync(join(protege, 'precieux.txt'), 'utf8'), 'à conserver');
  res = await n.run([], { SITE_DIR: 'site' });
  assert.equal(res.code, 1);
  assert.match(res.out, /chemin absolu/);
});
