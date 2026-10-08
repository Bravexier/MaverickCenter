// Installateurs autonomes de la 1.0 (deploy/installateur/fabriquer.mjs + installateur.sh) : fabriqués à partir d'un faux site, puis
// exécutés avec sh dans des dossiers temporaires. Production : site remplacé, base et réglages conservés. Test : base = copie de
// celle de la production à l'instant de l'installation. Nécessite sh, tar et gzip ; sinon les tests sont ignorés.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip')) && 'tar ou gzip indisponible';
const racine = mkdtempSync(join(tmpdir(), 'installateur-test-'));
after(() => rmSync(racine, { recursive: true, force: true }));

let n = 0;
/** Un faux site de `pages` pages (plus l'accueil), marqué `label`. */
function site(label, pages = 5, extra = {}) {
  const d = join(racine, `site-${(n += 1)}`);
  const files = { 'index.html': `<h1>accueil ${label}</h1>`, ...extra };
  for (let i = 0; i < pages; i += 1) files[`wiki/p${i}/index.html`] = `<p>page ${i} ${label}</p>`;
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}
function installateur({ mode = 'prod', label = 'v1', tag, version = '0.2.0', pages, extra } = {}) {
  return fabriquer({ mode, site: site(label, pages, extra), tag: tag ?? (mode === 'prod' ? `v${version}` : `v${version}-test`), version, sha: 'a'.repeat(40), sortie: join(racine, 'sortie') });
}
function lancer(fichier, args = [], env = {}) {
  const r = spawnSync('sh', [fichier, ...args], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}
const dossier = (nom) => join(racine, nom);
const lire = (...p) => readFileSync(join(...p), 'utf8');
const champs = (d) => Object.fromEntries(lire(d, 'VERSION').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));

test('fabrication : un seul fichier, paramètres remplis, archive contrôlée par --verifier', { skip }, () => {
  const i = installateur({ pages: 7 });
  assert.match(i.fichier, /maverick-center-v0\.2\.0-install\.sh$/);
  assert.equal(i.PAGES, '8');
  const texte = readFileSync(i.fichier, 'latin1');
  const script = texte.slice(0, texte.indexOf('\n__ARCHIVE__\n')); // l'archive compressée peut contenir n'importe quels octets
  assert.ok(!script.includes('@@'), 'aucun paramètre non rempli');
  assert.match(texte, /^TAG='v0\.2\.0'$/m);
  const v = lancer(i.fichier, ['--verifier']);
  assert.equal(v.code, 0, v.out);
  assert.match(v.out, /archive intègre, 8 pages/);

  // Un octet modifié dans l'archive : refus, rien d'installé.
  const octets = readFileSync(i.fichier);
  octets[octets.length - 100] ^= 0xff;
  const abime = join(racine, 'abime.sh');
  writeFileSync(abime, octets);
  const r = lancer(abime, ['--dossier', dossier('jamais')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /archive (corrompue|illisible)/);
  assert.ok(!existsSync(join(dossier('jamais'), 'site')));
});

test('paramètres refusés : étiquette de test en production et inversement, version invalide', () => {
  const s = site('x');
  const base = { site: s, version: '0.2.0', sha: 'b'.repeat(40), sortie: join(racine, 'sortie') };
  assert.throws(() => fabriquer({ ...base, mode: 'prod', tag: 'v0.2.0-test' }), /étiquette de production/);
  assert.throws(() => fabriquer({ ...base, mode: 'test', tag: 'v0.2.0-test', sha: '$(id)' }), /--sha invalide/);
  const cli = (args) => spawnSync('node', [new URL('../../deploy/installateur/fabriquer.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8' });
  const ok = ['--mode', 'test', '--site', s, '--tag', 'v0.2.0-test', '--version', '0.2.0', '--sha', 'local', '--sortie', join(racine, 'sortie')];
  assert.equal(cli(ok).status, 0);
  assert.match(cli(['--mode', 'prod', ...ok.slice(2)]).stderr, /étiquette de production/);
  assert.match(cli(ok.map((a) => (a === 'v0.2.0-test' ? 'v0.2.0' : a))).stderr, /étiquette de test/);
  assert.match(cli(ok.map((a) => (a === '0.2.0' ? '0.2' : a))).stderr, /--version invalide/);
  assert.match(cli(ok.map((a) => (a === 'v0.2.0-test' ? 'v0.2.0-test;rm' : a))).stderr, /--tag invalide/);
});

for (const rsync of ['auto', '0']) {
  test(`production : première installation puis mise à jour (USE_RSYNC=${rsync})`, { skip }, () => {
    const prod = dossier(`prod-${rsync}`);
    const r1 = lancer(installateur({ label: 'v1' }).fichier, ['--dossier', prod], { USE_RSYNC: rsync });
    assert.equal(r1.code, 0, r1.out);
    assert.equal(lire(prod, 'site/index.html'), '<h1>accueil v1</h1>');
    assert.deepEqual({ tag: champs(prod).tag, mode: champs(prod).mode, version: champs(prod).version }, { tag: 'v0.2.0', mode: 'prod', version: '0.2.0' });
    assert.match(lire(prod, '.env'), /MAVERICK_PORT=8080/);
    assert.match(lire(prod, '.env'), /MAVERICK_CONTENEUR=maverick-center$/m);
    assert.ok(existsSync(join(prod, 'db')), 'dossier de la base vivante créé');
    assert.ok(existsSync(join(prod, 'docker-compose.yml')) && existsSync(join(prod, 'nginx.conf')) && existsSync(join(prod, 'mise-a-jour.sh')) && !existsSync(join(prod, 'update-nas.sh')));
    assert.match(r1.out, /Première installation/);

    // Ce que l'administrateur et l'usage réel ont posé : jamais touché par une mise à jour.
    writeFileSync(join(prod, 'db', 'vivante.db'), 'données réelles');
    writeFileSync(join(prod, '.htpasswd'), 'invite:xyz\n');
    writeFileSync(join(prod, '.env'), 'MAVERICK_PORT=9000\n');
    writeFileSync(join(prod, 'docker-compose.yml'), 'services: {} # personnalisé\n');

    const r2 = lancer(installateur({ label: 'v2', tag: 'v0.2.0-hotfix.1', pages: 3, extra: { 'nouvelle/index.html': 'n' } }).fichier, ['--dossier', prod], { USE_RSYNC: rsync });
    assert.equal(r2.code, 0, r2.out);
    assert.equal(lire(prod, 'site/index.html'), '<h1>accueil v2</h1>');
    assert.ok(existsSync(join(prod, 'site/nouvelle/index.html')));
    assert.ok(!existsSync(join(prod, 'site/wiki/p4/index.html')), 'une page retirée disparaît');
    assert.equal(champs(prod).tag, 'v0.2.0-hotfix.1');
    assert.equal(lire(prod, 'db', 'vivante.db'), 'données réelles');
    assert.equal(lire(prod, '.htpasswd'), 'invite:xyz\n');
    assert.equal(lire(prod, '.env'), 'MAVERICK_PORT=9000\n');
    assert.equal(lire(prod, 'docker-compose.yml'), 'services: {} # personnalisé\n');
    assert.match(lire(prod, 'docker-compose.yml.nouveau'), /MAVERICK_PORT/);
    assert.match(r2.out, /docker-compose\.yml a été modifié sur place/);
    assert.doesNotMatch(r2.out, /Première installation/);
    assert.match(lire(prod, 'installation.log'), /Installé : v0\.2\.0-hotfix\.1/);
    assert.ok(!readdirSync(prod).some((f) => f.startsWith('.installation')), 'ni dossier de travail ni verrou restants');
  });
}

test('test : la base est une copie de celle de la production à l\'instant de l\'installation', { skip }, () => {
  const parent = dossier('nas');
  const prod = join(parent, 'maverick-center');
  const test_ = join(parent, 'maverick-center-test');
  assert.equal(lancer(installateur({ label: 'prod' }).fichier, ['--dossier', prod]).code, 0);
  const base = new DatabaseSync(join(prod, 'db', 'maverick.db'));
  base.exec("CREATE TABLE fiche (nom TEXT); INSERT INTO fiche VALUES ('Aldric'), ('Brune');");
  base.close();
  mkdirSync(join(prod, 'db', 'pieces'));
  writeFileSync(join(prod, 'db', 'pieces', 'carte.txt'), 'carte');

  const i = installateur({ mode: 'test', label: 'dev', version: '0.2.3' });
  const r = lancer(i.fichier, ['--dossier', test_]); // dossier de la production : le voisin « maverick-center »
  assert.equal(r.code, 0, r.out);
  assert.equal(lire(test_, 'site/index.html'), '<h1>accueil dev</h1>');
  assert.equal(champs(test_).mode, 'test');
  assert.match(lire(test_, '.env'), /MAVERICK_PORT=8081/);
  assert.match(lire(test_, '.env'), /MAVERICK_CONTENEUR=maverick-center-test/);
  const copie = new DatabaseSync(join(test_, 'db', 'maverick.db'));
  assert.deepEqual(copie.prepare('SELECT nom FROM fiche ORDER BY nom').all().map((l) => l.nom), ['Aldric', 'Brune']);
  copie.exec("INSERT INTO fiche VALUES ('Essai')"); // ce qu'on fait en test…
  copie.close();
  assert.equal(lire(test_, 'db', 'pieces', 'carte.txt'), 'carte');
  const trace = lire(test_, 'db', '.copie-de-la-production');
  assert.match(trace, new RegExp(`source=${join(prod, 'db').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(trace, /version_prod=v0\.2\.0/);

  const verifierProd = new DatabaseSync(join(prod, 'db', 'maverick.db'));
  assert.equal(verifierProd.prepare('SELECT count(*) AS n FROM fiche').get().n, 2, '…ne revient jamais en production');
  verifierProd.exec("INSERT INTO fiche VALUES ('Cyrielle')");
  verifierProd.close();

  // Nouvelle installation de test : nouvelle copie, les essais précédents disparaissent.
  const r2 = lancer(installateur({ mode: 'test', label: 'dev2', version: '0.2.4' }).fichier, ['--dossier', test_, '--dossier-prod', prod]);
  assert.equal(r2.code, 0, r2.out);
  const copie2 = new DatabaseSync(join(test_, 'db', 'maverick.db'));
  assert.deepEqual(copie2.prepare('SELECT nom FROM fiche ORDER BY nom').all().map((l) => l.nom), ['Aldric', 'Brune', 'Cyrielle']);
  copie2.close();
});

test('refus : mauvais mode d\'instance, production introuvable ou confondue avec le test', { skip }, () => {
  const parent = dossier('refus');
  const prod = join(parent, 'maverick-center');
  const test_ = join(parent, 'maverick-center-test');
  const iTest = installateur({ mode: 'test', label: 't' }).fichier;

  let r = lancer(iTest, ['--dossier', test_]);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance de production introuvable/);
  assert.ok(!existsSync(join(test_, 'site')));

  r = lancer(iTest, ['--dossier', '/', '--sans-base-prod']);
  assert.equal(r.code, 1);
  assert.match(r.out, /racine du système/);

  r = lancer(iTest, ['--dossier', test_, '--sans-base-prod']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(readdirSync(join(test_, 'db')), ['.copie-de-la-production'], 'base de test vide');

  const iProd = installateur({ label: 'p' }).fichier;
  r = lancer(iProd, ['--dossier', test_]);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance « test » : un installateur « prod » refuse/);
  assert.equal(champs(test_).mode, 'test');

  assert.equal(lancer(iProd, ['--dossier', prod]).code, 0);
  r = lancer(iTest, ['--dossier', prod]);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance « prod »/);
  assert.equal(champs(prod).mode, 'prod');

  // Un dossier qui a déjà un site sans fichier VERSION (installé autrement, par exemple le paquet du NAS) compte comme une production.
  const ancienne = join(parent, 'ancienne');
  mkdirSync(join(ancienne, 'site'), { recursive: true });
  writeFileSync(join(ancienne, 'site', 'index.html'), 'ancien');
  r = lancer(iTest, ['--dossier', ancienne]);
  assert.equal(r.code, 1);
  assert.match(r.out, /instance « prod »/);
  r = lancer(iTest, ['--dossier', join(parent, 'autre-test'), '--dossier-prod', ancienne]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /pas de base vivante/);
  assert.equal(lancer(iProd, ['--dossier', ancienne]).code, 0, 'un installateur de production peut la reprendre');
});

test('verrou : une installation en cours bloque la suivante ; un verrou périmé est nettoyé', { skip }, () => {
  const prod = dossier('verrou');
  mkdirSync(join(prod, '.installation.lock'), { recursive: true });
  writeFileSync(join(prod, '.installation.lock', 'pid'), String(process.pid));
  const i = installateur().fichier;
  let r = lancer(i, ['--dossier', prod]);
  assert.equal(r.code, 1);
  assert.match(r.out, /déjà en cours/);
  writeFileSync(join(prod, '.installation.lock', 'pid'), '999999');
  r = lancer(i, ['--dossier', prod]);
  assert.equal(r.code, 0, r.out);
  assert.ok(!existsSync(join(prod, '.installation.lock')));
});

test('test : base de production en cours d\'écriture (WAL non reporté) copiée complète', { skip }, () => {
  const parent = dossier('wal');
  const prod = join(parent, 'maverick-center');
  assert.equal(lancer(installateur({ label: 'prod' }).fichier, ['--dossier', prod]).code, 0);
  const ecrivain = new DatabaseSync(join(prod, 'db', 'maverick.db'));
  ecrivain.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1), (2), (3);");
  assert.ok(existsSync(join(prod, 'db', 'maverick.db-wal')), 'les écritures sont encore dans le journal WAL');
  try {
    const r = lancer(installateur({ mode: 'test', label: 't' }).fichier, ['--dossier', join(parent, 'maverick-center-test')]);
    assert.equal(r.code, 0, r.out);
  } finally {
    ecrivain.close();
  }
  const copie = new DatabaseSync(join(parent, 'maverick-center-test', 'db', 'maverick.db'));
  assert.equal(copie.prepare('SELECT count(*) AS n FROM t').get().n, 3);
  copie.close();
});

test('test : liens symboliques dans la base du serveur normal refusés ; db/ lui-même peut être un lien ; droits des fichiers conservés', { skip }, () => {
  const parent = dossier('liens');
  const prod = join(parent, 'maverick-center');
  const iTest = installateur({ mode: 'test', label: 't' }).fichier;
  assert.equal(lancer(installateur({ label: 'p' }).fichier, ['--dossier', prod]).code, 0);

  // Un lien vers un fichier du serveur normal : le test y écrirait. Refus, rien d'installé.
  writeFileSync(join(prod, 'db', 'vraie.db'), 'x');
  symlinkSync(join(prod, 'db', 'vraie.db'), join(prod, 'db', 'lien.db'));
  let r = lancer(iTest, ['--dossier', join(parent, 'maverick-center-test')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /liens symboliques : copie refusée/);
  assert.ok(!existsSync(join(parent, 'maverick-center-test', 'site')));
  rmSync(join(prod, 'db', 'lien.db'));
  rmSync(join(prod, 'db', 'vraie.db'));

  // db/ du serveur normal rangé ailleurs, derrière un lien : copié quand même, base SQLite comprise, droits conservés.
  const ailleurs = join(parent, 'disque', 'db');
  mkdirSync(ailleurs, { recursive: true });
  const base = new DatabaseSync(join(ailleurs, 'maverick.db'));
  base.exec("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (42);");
  base.close();
  chmodSync(join(ailleurs, 'maverick.db'), 0o640);
  rmSync(join(prod, 'db'), { recursive: true });
  symlinkSync(ailleurs, join(prod, 'db'));
  r = lancer(iTest, ['--dossier', join(parent, 'maverick-center-test')]);
  assert.equal(r.code, 0, r.out);
  const copie = new DatabaseSync(join(parent, 'maverick-center-test', 'db', 'maverick.db'));
  assert.equal(copie.prepare('SELECT x FROM t').get().x, 42);
  copie.close();
  assert.equal(statSync(join(parent, 'maverick-center-test', 'db', 'maverick.db')).mode & 0o777, 0o640);
});

test('racine du système refusée, y compris « // » sous bash', { skip }, () => {
  const i = installateur().fichier;
  for (const shell of ['sh', 'bash']) {
    const r = spawnSync(shell, [i, '--dossier', '//'], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(r.status, 1, `${shell} : ${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /racine du système/);
  }
});

test('configuration : une version livrée non modifiée sur place est remplacée ; mise-a-jour.sh est remplacé par renommage', { skip }, () => {
  const prod = dossier('configuration');
  const i = installateur().fichier;
  assert.equal(lancer(i, ['--dossier', prod]).code, 0);
  assert.equal(lire(prod, '.livre', 'nginx.conf'), lire(prod, 'nginx.conf'));
  // Simule une livraison précédente dont nginx.conf était différent, jamais touché sur place.
  writeFileSync(join(prod, 'nginx.conf'), 'ancienne version livrée\n');
  writeFileSync(join(prod, '.livre', 'nginx.conf'), 'ancienne version livrée\n');
  const inode = statSync(join(prod, 'mise-a-jour.sh')).ino;
  const r = lancer(i, ['--dossier', prod]);
  assert.equal(r.code, 0, r.out);
  assert.match(lire(prod, 'nginx.conf'), /server/, 'la nouvelle version est posée');
  assert.ok(!existsSync(join(prod, 'nginx.conf.nouveau')));
  assert.match(r.out, /nginx\.conf mis à jour par cette livraison : relancez « docker compose up -d »/);
  assert.notEqual(statSync(join(prod, 'mise-a-jour.sh')).ino, inode, 'nouveau fichier : un mise-a-jour.sh en cours garde l\'ancien');
});
