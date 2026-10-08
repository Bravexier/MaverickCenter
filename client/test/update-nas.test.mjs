// Teste deploy/update-nas.sh contre un faux GitHub (API des livraisons, aucun accès réseau réel, aucun NAS) : il choisit la dernière
// livraison de son mode (production : « latest » ; test : la plus récente étiquette « -test »), télécharge son installateur
// (fabriqué pour de vrai par deploy/fabriquer-installateur.mjs) et l'exécute. Nécessite sh, curl, tar et gzip ; sinon ignoré.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fabriquer } from '../../deploy/fabriquer-installateur.mjs';

const SCRIPT = process.env.UPDATE_NAS_SCRIPT ?? fileURLToPath(new URL('../../deploy/update-nas.sh', import.meta.url));
const have = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
const skip = !(have('curl') && have('tar') && have('gzip')) && 'sh, curl, tar ou gzip indisponible';

const TOKEN = 'github_pat_TESTTOKEN123';
const root = mkdtempSync(join(tmpdir(), 'update-nas-test-'));
/** Les livraisons publiées, de la plus récente à la plus ancienne : { tag, installateur (octets) ou null }. */
const state = { livraisons: [], token: TOKEN, telechargements: 0, auth: [] };
let server;
let apiUrl;

let numero = 0;
function site(label, pages = 5, extra = {}) {
  const d = join(root, `site-${(numero += 1)}`);
  const files = { 'index.html': `<h1>accueil ${label}</h1>`, ...extra };
  for (let i = 0; i < pages; i += 1) files[`wiki/p${i}/index.html`] = `<p>page ${i} ${label}</p>`;
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}
/** Une livraison avec son installateur ; `abime` corrompt l'archive, `sansInstallateur` simule une construction en cours. */
function livraison(tag, { label = tag, pages, extra, abime = false, sansInstallateur = false } = {}) {
  const mode = tag.includes('-test') ? 'test' : 'prod';
  const version = tag.match(/^v(\d+\.\d+\.\d+)/)[1];
  let octets = null;
  if (!sansInstallateur) {
    octets = readFileSync(fabriquer({ mode, tag, version, sha: 'c'.repeat(40), site: site(label, pages, extra), sortie: join(root, 'sortie') }).fichier);
    if (abime) octets[octets.length - 50] ^= 0xff;
  }
  return { tag, octets, id: (numero += 1) };
}
function publier(...livraisons) {
  state.livraisons = livraisons;
}

/** Une livraison telle que la renvoie l'API GitHub (indentée, avec les champs « url » qui ne sont pas l'installateur). */
function json(l) {
  return {
    url: `${apiUrl}/repos/o/r/releases/${l.id}`,
    assets_url: `${apiUrl}/repos/o/r/releases/${l.id}/assets`,
    tag_name: l.tag,
    prerelease: l.tag.includes('-test'),
    author: { login: 'github-actions[bot]', url: `${apiUrl}/users/github-actions%5Bbot%5D` },
    assets: l.octets ? [{ url: `${apiUrl}/repos/o/r/releases/assets/${l.id}`, id: l.id, name: `maverick-center-${l.tag}-install.sh`, uploader: { url: `${apiUrl}/users/x` } }] : [],
    tarball_url: `${apiUrl}/repos/o/r/tarball/${l.tag}`,
  };
}

before(async () => {
  server = createServer((req, res) => {
    state.auth.push(req.headers.authorization);
    const envoyer = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body, null, 2)); };
    if (req.url.startsWith('/telechargement/')) { // stockage des fichiers : URL signée, sans jeton
      const l = state.livraisons.find((x) => String(x.id) === req.url.split('/')[2]);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      return res.end(l.octets);
    }
    if (req.headers.authorization !== `Bearer ${state.token}`) return envoyer(401, { message: 'Bad credentials' });
    if (req.url === '/repos/o/r/releases/latest') {
      const l = state.livraisons.find((x) => !x.tag.includes('-test'));
      return l ? envoyer(200, json(l)) : envoyer(404, { message: 'Not Found' });
    }
    if (req.url === '/repos/o/r/releases?per_page=30') return envoyer(200, state.livraisons.map(json));
    const parTag = req.url.match(/^\/repos\/o\/r\/releases\/tags\/(.+)$/);
    if (parTag) {
      const l = state.livraisons.find((x) => x.tag === parTag[1]);
      return l ? envoyer(200, json(l)) : envoyer(404, { message: 'Not Found' });
    }
    const fichier = req.url.match(/^\/repos\/o\/r\/releases\/assets\/(\d+)$/);
    if (fichier) {
      assert.equal(req.headers.accept, 'application/octet-stream');
      state.telechargements += 1;
      res.writeHead(302, { Location: `/telechargement/${fichier[1]}` });
      return res.end();
    }
    return envoyer(404, { message: 'Not Found' });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  apiUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
});

/** Dossier d'instance neuf (jeton en place) ; le script s'exécute dans un processus séparé. */
function nas(name, { token = TOKEN, mode = 'prod', env: envInstance = {} } = {}) {
  const base = join(root, name);
  mkdirSync(base, { recursive: true });
  if (token !== null) writeFileSync(join(base, '.github-token'), `${token}\n`);
  const run = (args = [], env = {}) =>
    new Promise((ok) => {
      execFile('sh', [SCRIPT, ...args], { env: { PATH: process.env.PATH, TMPDIR: root, BASE_DIR: base, REPO: 'o/r', GITHUB_API: apiUrl, MODE: mode, ...envInstance, ...env } },
        (error, stdout, stderr) => ok({ code: error ? error.code : 0, out: stdout + stderr }));
    });
  const read = (p) => readFileSync(join(base, p), 'utf8');
  return { base, run, read, has: (p) => existsSync(join(base, p)), log: () => read('update.log'), tag: () => read('VERSION').match(/^tag=(.*)$/m)[1] };
}

test('production : installation initiale, puis « à jour » sans retélécharger, puis --force', { skip }, async () => {
  publier(livraison('v0.2.0', { label: 'v1' }), livraison('v0.1.9'));
  const n = nas('initial');
  const first = await n.run();
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /Installé : v0\.2\.0/);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.tag(), 'v0.2.0');
  assert.ok(!n.log().includes(TOKEN), 'le jeton ne doit jamais figurer dans le journal');

  const avant = state.telechargements;
  const second = await n.run();
  assert.equal(second.code, 0);
  assert.match(second.out, /À jour \(v0\.2\.0\)/);
  assert.equal(state.telechargements, avant, 'aucun téléchargement quand la livraison est déjà installée');

  const forced = await n.run(['--force']);
  assert.match(forced.out, /Installé/);
  assert.equal(state.telechargements, avant + 1);
});

test('production : un hotfix (même version, nouvelle étiquette) est installé ; les pages retirées disparaissent', { skip }, async () => {
  publier(livraison('v0.2.0', { label: 'v1' }));
  const n = nas('hotfix');
  assert.equal((await n.run()).code, 0);
  assert.ok(n.has('site/wiki/p3/index.html'));
  publier(livraison('v0.2.0-hotfix.1', { label: 'v2', pages: 2 }), livraison('v0.3.0-test'), livraison('v0.2.0'));
  const res = await n.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(n.tag(), 'v0.2.0-hotfix.1');
  assert.equal(n.read('site/index.html'), '<h1>accueil v2</h1>');
  assert.ok(!n.has('site/wiki/p3/index.html'));
});

test('test : la livraison « -test » la plus récente, avec copie de la base de la production', { skip }, async () => {
  publier(livraison('v0.2.0', { label: 'prod' }));
  const prod = nas('maverick-center');
  assert.equal((await prod.run()).code, 0);
  writeFileSync(join(prod.base, 'db', 'fiches.json'), '{"fiches": 2}');

  publier(livraison('v0.3.0', { label: 'prod' }), livraison('v0.2.4-test', { label: 'test récent' }), livraison('v0.2.3-test'), livraison('v0.2.0'));
  const t = nas('maverick-center-test', { mode: 'test', env: { DOSSIER_PROD: prod.base } });
  const res = await t.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(t.tag(), 'v0.2.4-test');
  assert.equal(t.read('site/index.html'), '<h1>accueil test récent</h1>');
  assert.equal(t.read('db/fiches.json'), '{"fiches": 2}');
  assert.match(t.read('VERSION'), /^mode=test$/m);
  assert.match(t.read('.env'), /8081/);
});

test('jeton refusé : erreur claire, site inchangé', { skip }, async () => {
  publier(livraison('v0.2.0', { label: 'v1' }));
  const n = nas('jeton-refuse');
  assert.equal((await n.run()).code, 0);
  writeFileSync(join(n.base, '.github-token'), 'github_pat_MAUVAISJETON');
  publier(livraison('v0.3.0', { label: 'v2' }));
  const res = await n.run();
  assert.equal(res.code, 1);
  assert.match(res.out, /impossible de lire la dernière livraison/);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.tag(), 'v0.2.0');
});

test('aucune livraison publiée, ou installateur pas encore joint : erreur claire', { skip }, async () => {
  publier();
  let res = await nas('rien').run();
  assert.equal(res.code, 1);
  assert.match(res.out, /aucune livraison encore publiée/);
  res = await nas('rien-test', { mode: 'test' }).run();
  assert.equal(res.code, 1);
  assert.match(res.out, /aucune livraison de test/);
  publier(livraison('v0.2.0', { sansInstallateur: true }));
  res = await nas('en-construction').run();
  assert.equal(res.code, 1);
  assert.match(res.out, /pas encore d'installateur joint/);
});

test('installateur corrompu : refusé, site inchangé', { skip }, async () => {
  publier(livraison('v0.2.0', { label: 'v1' }));
  const n = nas('corrompu');
  assert.equal((await n.run()).code, 0);
  publier(livraison('v0.3.0', { label: 'v2', abime: true }));
  const res = await n.run();
  assert.equal(res.code, 1);
  assert.match(res.out, /installateur v0\.3\.0 refusé/);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.tag(), 'v0.2.0');
});

test('jeton absent ou mal formé, réglages invalides : refus avant tout appel réseau', { skip }, async () => {
  publier(livraison('v0.2.0'));
  state.auth.length = 0;
  let res = await nas('sans-jeton', { token: null }).run();
  assert.equal(res.code, 1);
  assert.match(res.out, /jeton GitHub introuvable/);
  res = await nas('jeton-mal-forme', { token: 'abc"; rm -rf /' }).run();
  assert.equal(res.code, 1);
  assert.match(res.out, /ne contient pas un jeton GitHub valide/);
  res = await nas('mode', { mode: 'preprod' }).run();
  assert.equal(res.code, 1);
  assert.match(res.out, /MODE doit valoir prod ou test/);
  res = await nas('relatif').run([], { BASE_DIR: 'instance' });
  assert.equal(res.code, 1);
  assert.match(res.out, /chemin absolu/);
  assert.equal(state.auth.length, 0, 'aucune requête ne doit partir');
});

test('verrou : exemplaire déjà en cours = on sort sans rien faire ; verrou périmé = nettoyé', { skip }, async () => {
  publier(livraison('v0.2.0'));
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
