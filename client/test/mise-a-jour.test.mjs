// deploy/installateur/mise-a-jour.sh, la mise à jour automatique des instances posées par un installateur (le paquet du NAS a la sienne,
// testée par update-site.test.mjs).
// Contre un faux GitHub (API des livraisons, aucun accès réseau réel, aucun NAS) : il choisit la dernière livraison de son mode
// (production : « latest » ; test : la plus récente étiquette de version complète, VX.Y.Z), télécharge son installateur (fabriqué pour de vrai par
// deploy/installateur/fabriquer.mjs) et l'exécute. Nécessite sh, curl, tar et gzip ; sinon ignoré.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SEUL_LINUX } from './aide-plateforme.mjs';

const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/mise-a-jour.sh', import.meta.url));
const have = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
const skip = !(have('curl') && have('tar') && have('gzip')) && 'sh, curl, tar ou gzip indisponible';

const TOKEN = 'github_pat_TESTTOKEN123';
const root = dossierTemporaire('mise-a-jour');
/** Les livraisons publiées, de la plus récente à la plus ancienne : { tag, installateur (octets) ou null }. */
const state = { livraisons: [], token: TOKEN, telechargements: 0, auth: [], latest: null };
/** Mode d'une étiquette, d'après sa forme (tools/flux-git/regles.mjs) : VX.Y.Z… = serveur de test, VX.Y… = production. */
const modeDe = (tag) => (/^[vV]\d+\.\d+\.\d+(-|$)/.test(tag) ? 'test' : 'prod');
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
  const mode = modeDe(tag);
  const [, x, y, z = '0'] = tag.match(/^[vV](\d+)\.(\d+)(?:\.(\d+))?/); // V1.2 : production, version 1.2.0 (tools/flux-git/regles.mjs)
  const version = `${x}.${y}.${z}`;
  let octets = null;
  if (!sansInstallateur) {
    octets = readFileSync(fabriquer({ mode, tag, version, sha: 'c'.repeat(40), site: site(label, pages, extra), sortie: join(root, 'sortie') }).fichier);
    if (abime) octets[octets.length - 50] ^= 0xff;
  }
  return { tag, octets, id: (numero += 1) };
}
function publier(...livraisons) {
  state.livraisons = livraisons;
  state.latest = null;
}

/** Une livraison telle que la renvoie l'API GitHub (indentée, avec les champs « url » qui ne sont pas l'installateur). */
function json(l) {
  return {
    url: `${apiUrl}/repos/o/r/releases/${l.id}`,
    assets_url: `${apiUrl}/repos/o/r/releases/${l.id}/assets`,
    tag_name: l.tag,
    prerelease: modeDe(l.tag) === 'test',
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
      // « latest » : la production la plus récente (les livraisons de test sont des pré-versions) ; state.latest simule un mauvais marquage.
      const l = state.latest ?? state.livraisons.find((x) => modeDe(x.tag) === 'prod');
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
      execFile('sh', [SCRIPT, ...args], { env: { PATH: process.env.PATH, TMPDIR: root, BASE_DIR: base, REPO: 'o/r', GITHUB_API: apiUrl, ...(mode ? { MODE: mode } : {}), ...envInstance, ...env } },
        (error, stdout, stderr) => ok({ code: error ? error.code : 0, out: stdout + stderr }));
    });
  const read = (p) => readFileSync(join(base, p), 'utf8');
  return { base, run, read, has: (p) => existsSync(join(base, p)), log: () => read('mise-a-jour.log'), tag: () => read('VERSION').match(/^tag=(.*)$/m)[1] };
}

test('production : installation initiale, puis « à jour » sans retélécharger, puis --force', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2', { label: 'v1' }), livraison('v1.1'));
  const n = nas('initial');
  const first = await n.run();
  assert.equal(first.code, 0, first.out);
  assert.match(first.out, /Installé : v1\.2\./);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.tag(), 'v1.2');
  assert.ok(!n.log().includes(TOKEN), 'le jeton ne doit jamais figurer dans le journal');

  const avant = state.telechargements;
  const second = await n.run();
  assert.equal(second.code, 0);
  assert.match(second.out, /À jour \(v1\.2\)/);
  assert.equal(state.telechargements, avant, 'aucun téléchargement quand la livraison est déjà installée');

  const forced = await n.run(['--force']);
  assert.match(forced.out, /Installé/);
  assert.equal(state.telechargements, avant + 1);
});

test('le mode est celui de l\'instance (VERSION) ; sans VERSION, refus avant tout appel réseau', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.0', { label: 'un' }), livraison('v1.0.0', { label: 'test' }));
  const prod = join(root, 'serveur-normal');
  writeFileSync(join(root, 'prod.sh'), state.livraisons[0].octets);
  assert.equal(spawnSync('sh', [join(root, 'prod.sh'), '--dossier', prod]).status, 0);
  const n = nas('mode-de-l-instance', { mode: '' }); // pas de MODE : celui de l'instance
  state.auth.length = 0;
  const sans = await n.run();
  assert.equal(sans.code, 1);
  assert.match(sans.out, /VERSION absent/);
  assert.equal(state.auth.length, 0);

  // Instance posée par l'installateur de test : le script suit les livraisons de test, sans réglage.
  writeFileSync(join(root, 'test.sh'), state.livraisons[1].octets);
  const r = spawnSync('sh', [join(root, 'test.sh'), '--dossier', n.base, '--dossier-prod', prod], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  publier(livraison('v1.0.1', { label: 'test suivant' }), livraison('v1.0'));
  const res = await n.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(n.tag(), 'v1.0.1');
  assert.equal(n.read('site/index.html'), '<h1>accueil test suivant</h1>');
});

test('production : un hotfix (même version, nouvelle étiquette) est installé ; les pages retirées disparaissent', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2', { label: 'v1' }));
  const n = nas('hotfix');
  assert.equal((await n.run()).code, 0);
  assert.ok(n.has('site/wiki/p3/index.html'));
  publier(livraison('v1.2-hotfix.1', { label: 'v2', pages: 2 }), livraison('v1.3.0'), livraison('v1.2'));
  const res = await n.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(n.tag(), 'v1.2-hotfix.1');
  assert.equal(n.read('site/index.html'), '<h1>accueil v2</h1>');
  assert.ok(!n.has('site/wiki/p3/index.html'));
});

test('étiquettes du bot (tools/flux-git) : production VX.Y et VX.Y-hotfix.N, test VX.Y.Z', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('V1.2-hotfix.1', { label: 'correctif' }), livraison('V1.2.4', { label: 'test' }), livraison('V1.2'));
  const n = nas('etiquettes-v');
  const prod = await n.run();
  assert.equal(prod.code, 0, prod.out);
  assert.equal(n.tag(), 'V1.2-hotfix.1');
  assert.equal(n.read('site/index.html'), '<h1>accueil correctif</h1>');
  assert.match(n.read('VERSION'), /^version=1\.2\.0$/m);
  const t = nas('etiquettes-v-test', { mode: 'test' });
  const test_ = await t.run();
  assert.equal(test_.code, 0, test_.out);
  assert.equal(t.tag(), 'V1.2.4');
});

test('test : la version complète la plus récente (VX.Y.Z ou sa régénération), jamais une production ; la production refuse une livraison de test', { skip: SEUL_LINUX || skip }, async () => {
  // De la plus récente à la plus ancienne. V1.2.0-test : la forme d'avant (seule la 0.2.0 l'a portée), encore reconnue comme une livraison de test.
  publier(livraison('V1.3', { label: 'production plus récente' }), livraison('V1.2.4-rebuild.1', { label: 'régénérée' }), livraison('V1.2.4'),
    livraison('V1.2.0-test', { label: 'ancienne forme' }), livraison('V1.2'));
  const t = nas('formes-test', { mode: 'test' });
  const res = await t.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(t.tag(), 'V1.2.4-rebuild.1');
  assert.equal(t.read('site/index.html'), '<h1>accueil régénérée</h1>');

  publier(livraison('V1.2.0-test', { label: 'ancienne forme' }), livraison('V1.2'));
  const ancien = nas('forme-ancienne', { mode: 'test' });
  assert.equal((await ancien.run()).code, 0);
  assert.equal(ancien.tag(), 'V1.2.0-test');

  // Garde-fou du serveur normal : une livraison de test marquée « latest » par erreur n'est pas installée.
  publier(livraison('V1.3', { label: 'prod' }));
  const prod = nas('prod-garde');
  assert.equal((await prod.run()).code, 0);
  publier(livraison('V1.3.1', { label: 'dev' }), livraison('V1.3'));
  state.latest = state.livraisons[0];
  const refus = await prod.run();
  assert.equal(refus.code, 1);
  assert.match(refus.out, /V1\.3\.1 est une livraison de test, pas de production/);
  assert.equal(prod.tag(), 'V1.3');
  assert.equal(prod.read('site/index.html'), '<h1>accueil prod</h1>');
});

test('test : la plus haute version gagne même si GitHub liste V0.3.99 avant V0.3.100 (trois chiffres)', { skip: SEUL_LINUX || skip }, async () => {
  // L'ordre observé de l'API (releases?per_page=30) : V0.3.99 en tête, puis V0.3.98, V0.3.112, V0.3.100, V0.3.85, et une production au milieu.
  publier(livraison('V0.3.99', { label: 'v99' }), livraison('V0.3.98'), livraison('V0.3.112', { label: 'v112' }), livraison('V0.3.3'),
    livraison('V0.4', { label: 'prod' }), livraison('V0.3.100'), livraison('V0.3.85'));
  const t = nas('ordre-github', { mode: 'test' });
  const res = await t.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(t.tag(), 'V0.3.112');
  assert.equal(t.read('site/index.html'), '<h1>accueil v112</h1>');

  // Déjà à jour : la liste dans le même ordre ne ramène pas en arrière.
  const encore = await t.run();
  assert.match(encore.out, /À jour \(V0\.3\.112\)/);
});

test('test : la livraison de test la plus récente est installée ; la base de la production n\'est jamais copiée, db/ n\'est jamais touché', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2', { label: 'prod' }));
  const prod = nas('maverick-center');
  assert.equal((await prod.run()).code, 0);
  writeFileSync(join(prod.base, 'db', 'fiches.json'), '{"fiches": 2}');

  publier(livraison('v1.3', { label: 'prod' }), livraison('v1.2.4', { label: 'test récent' }), livraison('v1.2.3'), livraison('v1.2'));
  // Les réglages d'avant (DOSSIER_PROD, SANS_BASE_PROD dans mise-a-jour.env, ou MAVERICK_BASE_TEST=conservee) n'ont plus d'effet sur la base.
  const t = nas('maverick-center-test', { mode: 'test', env: { DOSSIER_PROD: prod.base } });
  mkdirSync(join(t.base, 'db', 'pieces'), { recursive: true });
  writeFileSync(join(t.base, 'db', 'saisie-du-site-de-dev.txt'), 'introuvable ailleurs');
  writeFileSync(join(t.base, 'db', 'pieces', 'a.txt'), 'a');
  const res = await t.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(t.tag(), 'v1.2.4');
  assert.equal(t.read('site/index.html'), '<h1>accueil test récent</h1>');
  assert.ok(!t.has('db/fiches.json'), 'la base de la production n\'est pas copiée');
  assert.equal(t.read('db/saisie-du-site-de-dev.txt'), 'introuvable ailleurs');
  assert.equal(t.read('db/pieces/a.txt'), 'a');
  assert.match(t.read('VERSION'), /^mode=test$/m);
  assert.match(t.read('.env'), /8081/);
});

test('test : une livraison plus ancienne que celle installée est refusée (R274), sans téléchargement ni changement de db/', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('V1.2.9', { label: 'v9' }));
  const t = nas('refus-plus-ancienne', { mode: 'test' });
  assert.equal((await t.run()).code, 0);
  writeFileSync(join(t.base, 'db', 'vivante.db'), 'saisies');

  // Plus ancienne : le numéro se compare comme un nombre (V1.2.10 > V1.2.9), jamais comme du texte.
  publier(livraison('V1.2.10', { label: 'v10' }));
  assert.equal((await t.run()).code, 0);
  assert.equal(t.tag(), 'V1.2.10');
  publier(livraison('V1.2.9', { label: 'v9 bis' }), livraison('V1.2.8'));
  const avant = state.telechargements;
  const refus = await t.run();
  assert.equal(refus.code, 1, 'un minuteur le lance : le refus est une erreur visible, pas un succès');
  assert.match(refus.out, /V1\.2\.9 est plus ancienne que V1\.2\.10/);
  assert.match(t.log(), /plus ancienne/);
  assert.equal(state.telechargements, avant, 'refusée avant le téléchargement');
  assert.equal(t.tag(), 'V1.2.10');
  assert.equal(t.read('site/index.html'), '<h1>accueil v10</h1>');
  assert.equal(t.read('db/vivante.db'), 'saisies');

  // Égale : à jour, comme avant.
  publier(livraison('V1.2.10', { label: 'v10' }));
  assert.match((await t.run()).out, /À jour \(V1\.2\.10\)/);

  // La régénération (rebuild) compte : V1.2.10-rebuild.1 est plus récente que V1.2.10 et plus ancienne que V1.2.10-rebuild.2.
  publier(livraison('V1.2.10-rebuild.2', { label: 'rebuild 2' }), livraison('V1.2.10-rebuild.1'));
  assert.equal((await t.run()).code, 0);
  assert.equal(t.tag(), 'V1.2.10-rebuild.2');
  publier(livraison('V1.2.10-rebuild.1', { label: 'rebuild 1' }), livraison('V1.2.10'));
  const rebuild = await t.run();
  assert.equal(rebuild.code, 1);
  assert.match(rebuild.out, /V1\.2\.10-rebuild\.1 est plus ancienne que V1\.2\.10-rebuild\.2/);
  assert.equal(t.tag(), 'V1.2.10-rebuild.2');

  // --force : le retour en arrière voulu, et lui seul.
  const force = await t.run(['--force']);
  assert.equal(force.code, 0, force.out);
  assert.equal(t.tag(), 'V1.2.10-rebuild.1');
  assert.equal(t.read('site/index.html'), '<h1>accueil rebuild 1</h1>');
  assert.equal(t.read('db/vivante.db'), 'saisies');
  assert.match((await t.run()).out, /À jour \(V1\.2\.10-rebuild\.1\)/, 'une fois revenu, l\'instance est à jour');
});

test('test : sans VERSION ni étiquette installée, on installe ; une étiquette installée hors forme de test est refusée (--force installe)', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('V1.2.4', { label: 'v4' }));
  // Première installation : pas de VERSION (MODE donné), db/ déjà rempli : l'installation n'y touche pas.
  const neuf = nas('premiere-installation', { mode: 'test' });
  mkdirSync(join(neuf.base, 'db'), { recursive: true });
  writeFileSync(join(neuf.base, 'db', 'vivante.db'), 'saisies');
  assert.ok(!neuf.has('VERSION'));
  assert.equal((await neuf.run()).code, 0);
  assert.equal(neuf.tag(), 'V1.2.4');
  assert.equal(neuf.read('db/vivante.db'), 'saisies');

  // VERSION sans ligne tag= : comme une première installation.
  const sansTag = nas('version-sans-tag', { mode: 'test' });
  writeFileSync(join(sansTag.base, 'VERSION'), 'mode=test\n');
  const r = await sansTag.run();
  assert.equal(r.code, 0, r.out);
  assert.equal(sansTag.tag(), 'V1.2.4');

  // Étiquette installée qui n'est pas celle d'une livraison de test : refus clair, rien n'est modifié.
  const bizarre = nas('etiquette-bizarre', { mode: 'test' });
  writeFileSync(join(bizarre.base, 'VERSION'), 'tag=essai-local\nmode=test\n');
  const refus = await bizarre.run();
  assert.equal(refus.code, 1);
  assert.match(refus.out, /« essai-local » n'a pas la forme d'une livraison de test/);
  assert.ok(!bizarre.has('site/index.html'));
  assert.equal((await bizarre.run(['--force'])).code, 0);
  assert.equal(bizarre.tag(), 'V1.2.4');
});

test('production : le contrôle d\'ordre ne s\'applique pas (« latest » est choisi par GitHub ; revenir en arrière = publier la version voulue)', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.3', { label: 'v13' }));
  const p = nas('prod-sans-controle-d-ordre');
  assert.equal((await p.run()).code, 0);
  publier(livraison('v1.2', { label: 'v12' }));
  const res = await p.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(p.tag(), 'v1.2');
});

test('jeton refusé : erreur claire, site inchangé', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2', { label: 'v1' }));
  const n = nas('jeton-refuse');
  assert.equal((await n.run()).code, 0);
  writeFileSync(join(n.base, '.github-token'), 'github_pat_MAUVAISJETON');
  publier(livraison('v1.3', { label: 'v2' }));
  const res = await n.run();
  assert.equal(res.code, 1);
  assert.match(res.out, /impossible de lire la dernière livraison/);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.tag(), 'v1.2');
});

test('aucune livraison publiée, ou installateur pas encore joint : erreur claire', { skip: SEUL_LINUX || skip }, async () => {
  publier();
  let res = await nas('rien').run();
  assert.equal(res.code, 1);
  assert.match(res.out, /aucune livraison encore publiée/);
  res = await nas('rien-test', { mode: 'test' }).run();
  assert.equal(res.code, 1);
  assert.match(res.out, /aucune livraison de test/);
  publier(livraison('v1.2', { sansInstallateur: true }));
  res = await nas('en-construction').run();
  assert.equal(res.code, 1);
  assert.match(res.out, /pas encore d'installateur joint/);
});

test('installateur corrompu : refusé, site inchangé', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2', { label: 'v1' }));
  const n = nas('corrompu');
  assert.equal((await n.run()).code, 0);
  publier(livraison('v1.3', { label: 'v2', abime: true }));
  const res = await n.run();
  assert.equal(res.code, 1);
  assert.match(res.out, /installateur v1\.3 refusé/);
  assert.equal(n.read('site/index.html'), '<h1>accueil v1</h1>');
  assert.equal(n.tag(), 'v1.2');
});

test('jeton absent ou mal formé, réglages invalides : refus avant tout appel réseau', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2'));
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

test('verrou : exemplaire déjà en cours = on sort sans rien faire ; verrou périmé = nettoyé', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2'));
  const n = nas('verrou');
  mkdirSync(join(n.base, '.mise-a-jour.lock'));
  writeFileSync(join(n.base, '.mise-a-jour.lock', 'pid'), String(process.pid)); // processus vivant
  let res = await n.run();
  assert.equal(res.code, 0);
  assert.match(res.out, /déjà en cours/);
  assert.ok(!n.has('site/index.html'));

  writeFileSync(join(n.base, '.mise-a-jour.lock', 'pid'), '999999'); // processus mort
  res = await n.run();
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /Verrou périmé/);
  assert.ok(n.has('site/index.html'));
  assert.ok(!n.has('.mise-a-jour.lock'), 'le verrou est retiré en fin de script');
});

test('GELER suspend les mises à jour (retour à une version précédente)', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.3.0', { label: 'test seul' }));
  const t = nas('test-seul', { mode: 'test' });
  const res = await t.run();
  assert.equal(res.code, 0, res.out);
  assert.equal(t.tag(), 'v1.3.0');

  writeFileSync(join(t.base, 'GELER'), '');
  publier(livraison('v1.3.1', { label: 'suivant' }));
  const avant = state.telechargements;
  const gel = await t.run();
  assert.equal(gel.code, 0, gel.out);
  assert.match(gel.out, /suspendues/);
  assert.equal(state.telechargements, avant);
  assert.equal(t.tag(), 'v1.3.0');
  rmSync(join(t.base, 'GELER'));
  assert.equal((await t.run()).code, 0);
  assert.equal(t.tag(), 'v1.3.1');
});

test('les trois derniers installateurs installés sont gardés dans installateur-courant/ (garde-fou 19), pour la copie extérieure des sauvegardes ; une livraison déjà installée le reçoit une fois', { skip: SEUL_LINUX || skip }, async () => {
  publier(livraison('v1.2', { label: 'v1' }));
  const n = nas('installateur-garde');
  assert.equal((await n.run()).code, 0);
  const garde = 'installateur-courant/maverick-center-v1.2-install.sh';
  const de = (tag) => `installateur-courant/maverick-center-${tag}-install.sh`;
  assert.ok(n.has(garde), 'l’installateur de la livraison installée est gardé');
  assert.equal(spawnSync('sh', [join(n.base, garde), '--verifier'], { encoding: 'utf8' }).status, 0, 'gardé entier : son archive se contrôle');
  assert.ok(!readFileSync(join(n.base, garde), 'latin1').includes(TOKEN));

  publier(livraison('v1.3', { label: 'v2' }), livraison('v1.2'));
  assert.equal((await n.run()).code, 0);
  assert.ok(n.has(de('v1.3')));
  assert.ok(n.has(garde), 'l’ancien reste : trois installateurs sont gardés');
  publier(livraison('v1.4', { label: 'v3' }), livraison('v1.3'), livraison('v1.2'));
  assert.equal((await n.run()).code, 0);
  assert.deepEqual(['v1.2', 'v1.3', 'v1.4'].filter((t) => n.has(de(t))), ['v1.2', 'v1.3', 'v1.4']);
  publier(livraison('v1.5', { label: 'v4' }), livraison('v1.4'), livraison('v1.3'), livraison('v1.2'));
  assert.equal((await n.run()).code, 0);
  assert.ok(n.has(de('v1.5')), 'le dernier posé est toujours gardé');
  assert.deepEqual(['v1.2', 'v1.3', 'v1.4', 'v1.5'].filter((t) => n.has(de(t))), ['v1.3', 'v1.4', 'v1.5'], 'au-delà de trois, le plus ancien est retiré');
  assert.equal(readdirSync(join(n.base, 'installateur-courant')).filter((f) => f.startsWith('.')).length, 0, 'aucun fichier provisoire laissé');

  // une instance à jour qui n'a rien gardé (installation à la main) : téléchargé une fois, sans rien réinstaller
  rmSync(join(n.base, 'installateur-courant'), { recursive: true });
  const avant = state.telechargements;
  const res = await n.run();
  assert.equal(res.code, 0, res.out);
  assert.match(res.out, /Installateur v1\.5 gardé/);
  assert.match(res.out, /À jour \(v1\.5\)/);
  assert.equal(state.telechargements, avant + 1);
  assert.ok(n.has('installateur-courant/maverick-center-v1.5-install.sh'));
  assert.equal((await n.run()).code, 0);
  assert.equal(state.telechargements, avant + 1, 'ensuite, plus aucun téléchargement');
});

/** Un faux dépôt, juste de quoi faire un kit (comme deploy-kit-seul-prod.test.mjs). */
function depotDeKit() {
  const d = join(root, `depot-${(numero += 1)}`);
  for (const [rel, contenu] of Object.entries({
    '.nvmrc': '22\n', 'client/package.json': '{"name":"c","version":"1.0.0"}', 'client/astro.config.mjs': 'export default {};',
    'client/scripts/fabriquer-depuis-contenu.mjs': '//', 'client/scripts/poser-un-site.mjs': '//',
    'client/node_modules/astro/bin/astro.mjs': '//', 'client/node_modules/astro/package.json': '{"name":"astro","version":"1.0.0"}',
    'data/schema.sql': 'PRAGMA user_version = 1;', 'data/derive.sql': '--', 'data/migrations/0001-a.sql': '--', 'data/references/a.json': '{}',
    'sources/sources.json': '{}', 'sources/copies-drive.json': '{}', 'sources/tipeee/bienvenue.json': '{}',
  })) { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), contenu); }
  return d;
}

test('production : un installateur COMPLET qui sortirait en 3 par accident ne pose jamais de marque (le code 3 ne vaut que pour un « kit seul », ligne KIT_SEUL=1) (PR 5b)', { skip: SEUL_LINUX || skip }, async () => {
  const complete = livraison('v1.1', { label: 'complet' });
  const accident = livraison('v1.2', { label: 'accident' });
  // la partie script est modifiée (sortie en 3 à l'installation), l'archive ne l'est pas : --verifier passe toujours
  const texte = accident.octets.toString('latin1');
  const fin = texte.indexOf('\n') + 1;
  accident.octets = Buffer.from(`${texte.slice(0, fin)}case "\${1:-}" in --dossier) exit 3 ;; esac\n${texte.slice(fin)}`, 'latin1');
  assert.ok(!/^KIT_SEUL=1$/m.test(texte.slice(0, texte.indexOf('\n__ARCHIVE__\n'))), 'un installateur complet ne porte pas KIT_SEUL=1');
  publier(complete);
  const n = nas('complet-en-3');
  assert.equal((await n.run()).code, 0);
  publier(accident, complete);
  const r = await n.run();
  assert.equal(r.code, 1, r.out);
  assert.ok(!n.has('.refus-v1.2'), 'aucune marque : la livraison sera retentée au passage suivant');
  assert.doesNotMatch(n.log(), /Il ne sera pas retenté/);
});

test('production : un installateur « kit seul » refusé faute d’activation-par-paquet n’est pas retéléchargé toutes les 5 minutes ; le fichier posé, ou --force, le relance (PR 5b)', { skip: SEUL_LINUX || skip }, async () => {
  const complete = livraison('v1.1', { label: 'complet' });
  const kitSeul = { tag: 'v1.2', octets: readFileSync(fabriquer({ mode: 'prod', tag: 'v1.2', version: '1.2.0', sha: 'c'.repeat(40), kit: depotDeKit(), kitSeul: true, sortie: join(root, 'sortie') }).fichier), id: (numero += 1) };
  publier(complete);
  const n = nas('kit-seul-refuse');
  assert.equal((await n.run()).code, 0, 'la production est installée comme avant');
  publier(kitSeul, complete);
  const avant = state.telechargements;
  const refus = await n.run();
  assert.equal(refus.code, 1, refus.out);
  assert.match(n.log(), /l'installateur v1\.2 a été refusé : .*activation-par-paquet n'existe pas.*Il ne sera pas retenté/);
  assert.ok(n.has('.refus-v1.2'), 'la marque de l’étiquette refusée');
  assert.equal(n.tag(), 'v1.1', 'rien n’est installé');
  assert.equal(state.telechargements, avant + 1);
  // les passages suivants du minuteur : rien, ni téléchargement ni ligne de journal
  const journal = n.log();
  for (let i = 0; i < 3; i += 1) assert.equal((await n.run()).code, 0);
  assert.equal(state.telechargements, avant + 1, 'aucun téléchargement tant que l’interrupteur manque');
  assert.equal(n.log(), journal, 'aucune ligne de plus : le journal ne grossit pas');
  // le fichier posé : l'installation est retentée (seul compte ici : elle a lieu ; hors root elle s'arrête sur son autre refus)
  writeFileSync(join(n.base, 'activation-par-paquet'), '');
  await n.run();
  assert.equal(state.telechargements, avant + 2, 'activation-par-paquet posé : retenté');
  // --force passe outre la marque, sans le fichier
  rmSync(join(n.base, 'activation-par-paquet'));
  await n.run(['--force']);
  assert.equal(state.telechargements, avant + 3);
  // une autre étiquette n'est pas marquée
  publier(livraison('v1.3', { label: 'complet 1.3' }), kitSeul, complete);
  assert.match((await n.run()).out, /Installé : v1\.3/);
  assert.ok(!n.has('.refus-v1.2'), 'une installation réussie efface les marques');
});

test('production : un installateur « kit seul » dont l’activation n’a pas passé (code 4) laisse VERSION à l’étiquette d’avant ; la marque .activation-refusee-<étiquette> évite de la rejouer toutes les 5 minutes ; --force la relance ; une installation réussie efface les marques', { skip: SEUL_LINUX || skip }, async () => {
  const complete = livraison('v1.1', { label: 'complet' });
  const kitSeul = { tag: 'v1.2', octets: readFileSync(fabriquer({ mode: 'prod', tag: 'v1.2', version: '1.2.0', sha: 'c'.repeat(40), kit: depotDeKit(), kitSeul: true, sortie: join(root, 'sortie') }).fichier), id: (numero += 1) };
  // la partie script est modifiée comme le fait le vrai installateur (kit-seul.sh, activation-fin-prod) : marque, ligne ERREUR, code 4 ; l'archive ne l'est pas
  const texte = kitSeul.octets.toString('latin1');
  const fin = texte.indexOf('\n') + 1;
  const refus = 'case "${1:-}" in --dossier) echo "[v1.2] ERREUR : v1.2 est installé mais son activation n\'a pas passé"; echo "activation : == REFUSEE : x" > "$2/.activation-refusee-v1.2"; exit 4 ;; esac\n';
  kitSeul.octets = Buffer.from(`${texte.slice(0, fin)}${refus}${texte.slice(fin)}`, 'latin1');
  assert.ok(/^KIT_SEUL=1$/m.test(texte.slice(0, texte.indexOf('\n__ARCHIVE__\n'))));
  publier(complete);
  const n = nas('kit-seul-activation-refusee');
  assert.equal((await n.run()).code, 0, 'la production est installée comme avant');
  publier(kitSeul, complete);
  const avant = state.telechargements;
  const r = await n.run();
  assert.equal(r.code, 1, r.out);
  assert.match(n.log(), /L'installateur v1\.2 a posé son kit mais l'activation n'a pas passé : VERSION reste v1\.1, marque \.activation-refusee-v1\.2/);
  assert.equal(n.log().split('\n').filter((l) => l.includes('ERREUR')).length, 1, 'une seule ligne ERREUR : celle de l’installateur ; mise-a-jour.sh n’en ajoute pas');
  assert.doesNotMatch(n.log(), /Installé : v1\.2/);
  assert.equal(n.tag(), 'v1.1', 'VERSION garde l’étiquette d’avant : la production n’est pas « à jour »');
  assert.ok(n.has('.activation-refusee-v1.2'));
  assert.ok(!n.has('.refus-v1.2'), 'ce n’est pas le refus de l’interrupteur');
  assert.equal(state.telechargements, avant + 1);
  // les passages suivants du minuteur : rien, ni téléchargement ni ligne de journal
  const journal = n.log();
  for (let i = 0; i < 3; i += 1) assert.equal((await n.run()).code, 0);
  assert.equal(state.telechargements, avant + 1, 'aucun téléchargement, aucune activation rejouée');
  assert.equal(n.log(), journal);
  // --force passe outre la marque
  assert.equal((await n.run(['--force'])).code, 1);
  assert.equal(state.telechargements, avant + 2);
  // une autre étiquette n'est pas marquée ; son installation réussie efface les marques
  publier(livraison('v1.3', { label: 'complet 1.3' }), kitSeul, complete);
  assert.match((await n.run()).out, /Installé : v1\.3/);
  assert.ok(!n.has('.activation-refusee-v1.2'), 'une installation réussie efface les marques');
  assert.equal(n.tag(), 'v1.3');
});

test('production : un installateur COMPLET qui sortirait en 4 par accident ne pose jamais de marque (le code 4 ne vaut que pour un « kit seul »)', { skip: SEUL_LINUX || skip }, async () => {
  const complete = livraison('v1.1', { label: 'complet' });
  const accident = livraison('v1.2', { label: 'accident' });
  const texte = accident.octets.toString('latin1');
  const fin = texte.indexOf('\n') + 1;
  accident.octets = Buffer.from(`${texte.slice(0, fin)}case "\${1:-}" in --dossier) exit 4 ;; esac\n${texte.slice(fin)}`, 'latin1');
  publier(complete);
  const n = nas('complet-en-4');
  assert.equal((await n.run()).code, 0);
  publier(accident, complete);
  const r = await n.run();
  assert.equal(r.code, 1, r.out);
  assert.ok(!n.has('.activation-refusee-v1.2'), 'aucune marque : la livraison sera retentée au passage suivant');
  assert.match(n.log(), /ERREUR : l'installateur v1\.2 a échoué/);
});
