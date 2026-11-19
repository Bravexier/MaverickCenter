// Le kit de l'atelier (deploy/installateur/kit.mjs, fabriquer.mjs --kit, kit-pose.sh dans installateur.sh ; lot 9 du chantier de la base de dev, PR 2 sur 4) :
// ce qu'il porte et refuse (R275, question 6 : aucun contenu), son kit.json, l'élagage des modules natifs d'une autre libc, le refus de --kit en production,
// la pose par l'installateur de test (hors de site/, un seul kit gardé) et la poursuite de l'installation sans kit quand la place manque ou que la pose échoue.
// Un faux dépôt dans un dossier temporaire, jamais le vrai node_modules. Nécessite sh, tar et gzip ; sinon les tests sont ignorés.
//   node --test test/deploy-kit.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import {
  A_EMPORTER, ARCHIVE_DU_KIT, DOSSIER_DU_KIT, ErreurKit, FICHIER_D_IDENTITE, FORMAT_D_IDENTITE, FORMAT_KIT, INDISPENSABLES, META_DU_KIT, compatible, controlerLeKit, fabriquerLeKit, imageDeLAtelier, lireLIdentiteDuPaquet, structureDuKit,
} from '../../deploy/installateur/kit.mjs';
import { validerLeKit } from '../serveur/atelier.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip')) && 'tar ou gzip indisponible';
const racine = dossierTemporaire('deploy-kit');
const FABRIQUER = fileURLToPath(new URL('../../deploy/installateur/fabriquer.mjs', import.meta.url));
const GLIBC = { platform: 'linux', arch: 'x64', libc: 'glibc' };

let n = 0;
function ecrire(base, fichiers) {
  for (const [rel, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), contenu);
  }
}
const paquet = (nom, extra = {}) => JSON.stringify({ name: nom, version: '1.0.0', ...extra });

/** Un faux dépôt : le code du site, des paquets de node_modules (dont des natifs de plusieurs libc et plateformes), et de quoi refuser (wiki fabriqué, dist, test). */
function fauxDepot(extra = {}) {
  const d = join(racine, `depot-${(n += 1)}`);
  ecrire(d, {
    '.nvmrc': '22\n',
    'client/package.json': paquet('maverick-client'),
    'client/astro.config.mjs': 'export default {};',
    'client/scripts/fabriquer-depuis-contenu.mjs': '// script',
    'client/scripts/poser-un-site.mjs': '// script de pose',
    'client/src/pages/index.astro': '<h1>site</h1>',
    'client/src/content/wiki/regles/page.md': '# page fabriquée',
    'client/dist/index.html': 'dist',
    'client/.astro/types.d.ts': 'cache',
    'client/test/essai.test.mjs': '// test',
    'client/var/journal.log': 'journal',
    'client/node_modules/astro/bin/astro.mjs': '// astro',
    'client/node_modules/astro/package.json': paquet('astro'),
    'client/node_modules/@fake/natif-glibc/package.json': paquet('@fake/natif-glibc', { os: ['linux'], cpu: ['x64'], libc: ['glibc'] }),
    'client/node_modules/@fake/natif-glibc/natif.node': 'binaire glibc',
    'client/node_modules/@fake/natif-musl/package.json': paquet('@fake/natif-musl', { os: ['linux'], cpu: ['x64'], libc: ['musl'] }),
    'client/node_modules/@fake/natif-musl/natif.node': 'binaire musl',
    'client/node_modules/natif-mac/package.json': paquet('natif-mac', { os: ['darwin'], cpu: ['arm64'] }),
    'client/node_modules/natif-sans-windows/package.json': paquet('natif-sans-windows', { os: ['!win32'] }),
    'client/node_modules/natif-arm/package.json': paquet('natif-arm', { os: ['linux'], cpu: ['arm64'] }),
    'data/schema.sql': 'PRAGMA user_version = 1;',
    'data/derive.sql': '-- derive',
    'data/migrations/0001-a.sql': '-- m',
    'data/migrations/0001-a.json': '{}',
    'data/rows/page.sql': 'INSERT INTO page VALUES (1);',
    'sources/sources.json': '{}',
    'sources/tipeee/bienvenue.json': '{}',
    'sources/raw/discord/export.json': '[]',
    'docs/serveur.md': '# docs',
    ...extra,
  });
  mkdirSync(join(d, 'client/node_modules/.bin'));
  symlinkSync('../astro/bin/astro.mjs', join(d, 'client/node_modules/.bin/astro'));
  return d;
}

/** Fabrique le kit d'un faux dépôt et le décompresse : { meta, kit (dossier décompressé), destination }. */
function kitDe(depot, plateforme = GLIBC) {
  const destination = join(racine, `kit-${(n += 1)}`);
  const meta = fabriquerLeKit({ racine: depot, destination, version: '1.2.3', sha: 'a'.repeat(40), plateforme });
  const kit = join(racine, `kit-decompresse-${(n += 1)}`);
  mkdirSync(kit);
  const r = spawnSync('tar', ['-xzf', join(destination, ARCHIVE_DU_KIT), '-C', kit], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { meta, kit, destination };
}

function lister(dossier, relatif = '') {
  return readdirSync(join(dossier, relatif), { withFileTypes: true }).flatMap((e) => {
    const rel = relatif ? `${relatif}/${e.name}` : e.name;
    return e.isDirectory() ? lister(dossier, rel) : [rel];
  }).sort();
}

test('le kit porte exactement ce qu’il faut : le code, le schéma et ses registres, deux fichiers de sources, .nvmrc ; rien du contenu ni de ce que la fabrication refait', { skip }, () => {
  const { kit } = kitDe(fauxDepot());
  const fichiers = lister(kit);
  for (const attendu of ['.nvmrc', 'client/package.json', 'client/astro.config.mjs', 'client/scripts/fabriquer-depuis-contenu.mjs', 'client/src/pages/index.astro',
    'client/node_modules/astro/bin/astro.mjs', 'data/schema.sql', 'data/derive.sql', 'data/migrations/0001-a.sql', 'data/migrations/0001-a.json',
    'sources/sources.json', 'sources/tipeee/bienvenue.json']) assert.ok(fichiers.includes(attendu), attendu);
  for (const refuse of ['data/rows', 'sources/raw', 'client/dist', 'client/.astro', 'client/src/content', 'client/test', 'client/var', 'docs']) {
    assert.ok(!fichiers.some((f) => f === refuse || f.startsWith(`${refuse}/`)), `${refuse} n’est pas dans le kit`);
  }
  assert.deepEqual(controlerLeKit(kit), []);
  assert.ok(readFileSync(join(kit, 'client/node_modules/.bin/astro')) , 'le lien de .bin est conservé et suit');
});

test('élagage : les modules natifs d’une autre libc, plateforme ou architecture partent, d’après leur package.json ; ceux de la machine restent', { skip }, () => {
  const { kit, meta } = kitDe(fauxDepot());
  const modules = join(kit, 'client/node_modules');
  assert.ok(existsSync(join(modules, '@fake/natif-glibc/natif.node')));
  assert.ok(existsSync(join(modules, 'natif-sans-windows/package.json')), '« !win32 » permet linux');
  assert.ok(existsSync(join(modules, 'astro/package.json')), 'un paquet sans os, cpu ni libc reste');
  for (const retire of ['@fake/natif-musl', 'natif-mac', 'natif-arm']) assert.ok(!existsSync(join(modules, retire)), retire);
  assert.equal(meta.elagage.paquets_retires, 3);
  assert.deepEqual(meta.elagage.exemples.sort(), ['@fake/natif-musl', 'natif-arm', 'natif-mac']);
  assert.ok(meta.elagage.octets_retires > 0);
  // la libc est celle du kit : sous musl, c'est l'inverse
  const { kit: kitMusl, meta: metaMusl } = kitDe(fauxDepot(), { platform: 'linux', arch: 'x64', libc: 'musl' });
  assert.ok(existsSync(join(kitMusl, 'client/node_modules/@fake/natif-musl/natif.node')));
  assert.ok(!existsSync(join(kitMusl, 'client/node_modules/@fake/natif-glibc')));
  assert.equal(metaMusl.image, imageDeLAtelier('22', 'musl'));
});

test('élagage : les node_modules imbriqués suivent la même règle ; un paquet retiré emporte les siens', { skip }, () => {
  const depot = fauxDepot({
    'client/node_modules/hote/package.json': paquet('hote'),
    'client/node_modules/hote/node_modules/natif-musl-imbrique/package.json': paquet('natif-musl-imbrique', { libc: ['musl'] }),
    'client/node_modules/hote/node_modules/@fake/natif-glibc-imbrique/package.json': paquet('@fake/natif-glibc-imbrique', { libc: ['glibc'] }),
    'client/node_modules/hote/node_modules/profond/package.json': paquet('profond'),
    'client/node_modules/hote/node_modules/profond/node_modules/natif-mac-profond/package.json': paquet('natif-mac-profond', { os: ['darwin'] }),
    'client/node_modules/natif-arm/node_modules/enfant/package.json': paquet('enfant'),
  });
  const { kit, meta } = kitDe(depot);
  const modules = join(kit, 'client/node_modules/hote/node_modules');
  assert.ok(existsSync(join(modules, '@fake/natif-glibc-imbrique/package.json')));
  assert.ok(existsSync(join(modules, 'profond/package.json')));
  assert.ok(!existsSync(join(modules, 'natif-musl-imbrique')));
  assert.ok(!existsSync(join(modules, 'profond/node_modules/natif-mac-profond')));
  assert.ok(!existsSync(join(kit, 'client/node_modules/natif-arm')), 'le paquet retiré emporte ses node_modules');
  assert.deepEqual(meta.elagage.exemples.filter((r) => r.includes('node_modules')).sort(),
    ['hote/node_modules/natif-musl-imbrique', 'hote/node_modules/profond/node_modules/natif-mac-profond']);
  assert.equal(meta.elagage.paquets_retires, 3 + 2, 'les trois du premier niveau et les deux imbriqués ; « enfant » est parti avec son parent');
});

test('la règle os, cpu et libc est celle de npm : liste permise, « ! » refusé, absente ou inconnue = tout est permis', () => {
  assert.equal(compatible(undefined, 'linux'), true);
  assert.equal(compatible([], 'linux'), true);
  assert.equal(compatible(['linux'], 'linux'), true);
  assert.equal(compatible(['darwin', 'win32'], 'linux'), false);
  assert.equal(compatible(['!win32'], 'linux'), true);
  assert.equal(compatible(['!linux'], 'linux'), false);
  assert.equal(compatible(['musl'], null), true, 'libc inconnue (hors de Linux) : on ne retire rien');
});

test('kit.json : format, version, commit, Node de .nvmrc, plateforme, image Docker, taille, nombre de fichiers, empreinte, empreinte de l’archive', { skip }, () => {
  const depot = fauxDepot();
  const { meta, kit, destination } = kitDe(depot);
  assert.deepEqual(JSON.parse(readFileSync(join(destination, META_DU_KIT), 'utf8')), meta, 'le fichier dit ce que la fonction rend');
  assert.equal(meta.format, FORMAT_KIT);
  assert.equal(meta.version, '1.2.3');
  assert.equal(meta.commit, 'a'.repeat(40));
  assert.equal(meta.node, '22');
  assert.deepEqual(meta.plateforme, { os: 'linux', arch: 'x64', libc: 'glibc' });
  assert.equal(meta.image, 'node:22-bookworm-slim', 'glibc : Debian, jamais Alpine');
  const fichiers = lister(kit);
  assert.equal(meta.fichiers, fichiers.length, 'les fichiers et les liens du kit décompressé');
  const octets = fichiers.reduce((somme, f) => somme + (lstatSync(join(kit, f)).isSymbolicLink() ? 0 : readFileSync(join(kit, f)).length), 0);
  assert.equal(meta.taille_decompressee_octets, octets);
  assert.equal(meta.archive_sha256, createHash('sha256').update(readFileSync(join(destination, ARCHIVE_DU_KIT))).digest('hex'));
  assert.equal(meta.taille_archive_octets, readFileSync(join(destination, ARCHIVE_DU_KIT)).length);
  assert.match(meta.empreinte, /^[0-9a-f]{64}$/);

  // l'empreinte suit le contenu, pas la fabrication
  assert.equal(kitDe(depot).meta.empreinte, meta.empreinte);
  writeFileSync(join(depot, 'client/src/pages/index.astro'), '<h1>autre</h1>');
  assert.notEqual(kitDe(depot).meta.empreinte, meta.empreinte);
});

test('le kit refuse tout contenu : data/rows, sources/raw, un fichier de base, les pages fabriquées, l’historique git, un lien qui sort du kit, ce qui manque', { skip }, () => {
  const refus = (cree, motif) => {
    const d = join(racine, `refus-${(n += 1)}`);
    ecrire(d, { '.nvmrc': '22', 'client/package.json': '{}', 'client/astro.config.mjs': '', 'client/scripts/fabriquer-depuis-contenu.mjs': '', 'client/scripts/poser-un-site.mjs': '', 'client/node_modules/astro/bin/astro.mjs': '',
      'data/schema.sql': '', 'data/derive.sql': '', 'data/migrations/0001.sql': '', 'sources/sources.json': '', 'sources/tipeee/bienvenue.json': '' });
    assert.deepEqual(controlerLeKit(d), [], 'le dossier de départ est bon');
    cree(d);
    const problemes = controlerLeKit(d);
    assert.match(problemes.join('\n'), motif);
  };
  refus((d) => ecrire(d, { 'data/rows/page.sql': 'x' }), /data\/rows/);
  refus((d) => ecrire(d, { 'sources/raw/x.json': '[]' }), /sources\/raw/);
  refus((d) => ecrire(d, { 'client/src/content/wiki/a.md': 'x' }), /client\/src\/content\/wiki/);
  refus((d) => ecrire(d, { 'client/src/donnees.db': 'x' }), /fichier de base de données/);
  refus((d) => ecrire(d, { 'client/node_modules/paquet/base.sqlite3': 'x' }), /fichier de base de données/);
  refus((d) => ecrire(d, { 'data/migrations/base.db-wal': 'x' }), /fichier de base de données/);
  refus((d) => ecrire(d, { '.git/HEAD': 'ref' }), /git/);
  refus((d) => symlinkSync('/etc', join(d, 'client/node_modules/dehors')), /mène hors du kit/);
  refus((d) => symlinkSync('../../..', join(d, 'client/node_modules/remonte')), /mène hors du kit/);
  refus((d) => rmSync(join(d, 'data/derive.sql')), /il manque data\/derive\.sql/);
});

test('un dépôt dont un fichier de base se glisse dans ce que le kit copie est refusé à la fabrication, et rien n’est écrit', { skip }, () => {
  const depot = fauxDepot({ 'client/src/lib/echantillon.db': 'SQLite format 3' });
  const destination = join(racine, `kit-refuse-${(n += 1)}`);
  assert.throws(() => fabriquerLeKit({ racine: depot, destination, version: '1.0.0', sha: 'b'.repeat(40), plateforme: GLIBC }), (e) => e instanceof ErreurKit && /fichier de base de données/.test(e.message));
  assert.ok(!existsSync(join(destination, ARCHIVE_DU_KIT)));
  assert.throws(() => fabriquerLeKit({ racine: fauxDepot(), destination, version: '1.0.0', sha: 'b'.repeat(40), plateforme: { platform: 'darwin', arch: 'arm64', libc: null } }), /sous Linux/);
  assert.ok(A_EMPORTER.length > 0 && INDISPENSABLES.length > 0 && DOSSIER_DU_KIT === 'atelier-kit');
});

// ---------------------------------------------------------------- fabriquer.mjs et l'installateur

/** Un faux site, et la fabrication d'un installateur (test ou prod), avec ou sans kit. */
function installateur({ mode = 'test', kit, version = '0.2.0', label = 'v1' } = {}) {
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(site, { 'index.html': `<h1>${label}</h1>`, 'wiki/p/index.html': 'page' });
  const tag = mode === 'prod' ? `v${version.replace(/\.\d+$/, '')}` : `v${version}`;
  return fabriquer({ mode, site, tag, version, sha: 'c'.repeat(40), sortie: join(racine, 'sortie'), ...(kit ? { kit } : {}) });
}
/** Ce que le dossier de l'atelier garde de provisoire ou d'ancien (les dossiers .kit-*) : rien, après une installation. */
const rienDeProvisoire = (atelier) => readdirSync(atelier).filter((n) => n.startsWith('.kit-'));
function lancer(fichier, args = [], env = {}) {
  const r = spawnSync('sh', [fichier, ...args], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}

test('fabriquer.mjs refuse --kit en production (module et ligne de commande), et un dépôt sans client/', { skip }, () => {
  const depot = fauxDepot();
  assert.throws(() => installateur({ mode: 'prod', kit: depot }), /--kit est réservé au mode test/);
  assert.throws(() => installateur({ mode: 'test', kit: join(racine, 'pas-un-depot') }), /--kit : pas de client\/package\.json/);
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(site, { 'index.html': 'x' });
  const cli = (mode, tag) => spawnSync('node', [FABRIQUER, '--mode', mode, '--site', site, '--tag', tag, '--version', '0.2.0', '--sha', 'local', '--sortie', join(racine, 'sortie-cli'), '--kit', depot], { encoding: 'utf8' });
  const prod = cli('prod', 'v0.2');
  assert.equal(prod.status, 1);
  assert.match(prod.stderr, /--kit est réservé au mode test/);
  assert.equal(cli('test', 'v0.2.0').status, 0);
});

test('l’installateur de production reste identique à celui d’avant le kit : le modèle sans sa ligne repère, aucune trace du kit', { skip }, () => {
  const i = installateur({ mode: 'prod' });
  assert.equal(i.kit, null);
  const octets = readFileSync(i.fichier);
  const script = octets.subarray(0, octets.indexOf('\n__ARCHIVE__\n') + 1).toString('utf8');
  const modele = readFileSync(new URL('../../deploy/installateur/installateur.sh', import.meta.url), 'utf8');
  // les lignes repères (kit, verrou, kit seul) sont retirées : le reste est le modèle tel qu'il était avant elles
  const attendu = modele.replace('\n@@KIT@@\n', '\n').replace('\n@@VERROU_DEBUT@@\n', '\n').replace('\n@@VERROU_FIN@@\n', '\n')
    .replace(/\n@@SEUL_[A-Z_]+@@\n/g, '\n').replace(/@@([A-Z0-9_]+)@@/g, (tout, cle) => i[cle]);
  assert.ok(script.startsWith(attendu.slice(0, attendu.indexOf('\n__ARCHIVE__\n') + 1)), 'le script de production est le modèle, rempli, sans rien de plus');
  assert.ok(!script.includes('poser_le_kit'));
  assert.ok(!script.includes('atelier-kit'));
  assert.ok(!script.includes('.verrou') && !script.includes('flock'), 'aucun verrou de l’atelier en production');
  assert.ok(!script.includes('KIT_SEUL') && !script.includes('@@'), 'rien du kit seul en production : ni champ, ni section, ni repère');
  const prod = join(racine, `prod-${(n += 1)}`);
  const r = lancer(i.fichier, ['--dossier', prod]);
  assert.equal(r.code, 0, r.out);
  assert.ok(!existsSync(join(prod, 'atelier')), 'rien du kit en production');
});

test('l’installateur de test pose le kit dans atelier/kit/, hors de site/ ; un seul kit est gardé, remplacé par renommage ; rien ne traîne', { skip }, () => {
  const depot = fauxDepot();
  const test1 = installateur({ kit: depot, label: 'v1' });
  assert.equal(test1.kit.format, FORMAT_KIT);
  const instance = join(racine, `test-${(n += 1)}`);
  const r1 = lancer(test1.fichier, ['--dossier', instance]);
  assert.equal(r1.code, 0, r1.out);
  assert.match(r1.out, /Kit de l'atelier posé dans/);
  const kit = join(instance, 'atelier', 'kit');
  assert.ok(existsSync(join(kit, 'client/package.json')) && existsSync(join(kit, 'data/schema.sql')) && existsSync(join(kit, '.nvmrc')));
  assert.deepEqual(JSON.parse(readFileSync(join(kit, 'kit.json'), 'utf8')), test1.kit, 'kit.json accompagne le kit posé');
  assert.deepEqual(controlerLeKit(kit), []);
  assert.ok(!lister(join(instance, 'site')).some((f) => /atelier|kit/.test(f)), 'jamais servi : rien du kit dans site/');
  assert.deepEqual(rienDeProvisoire(join(instance, 'atelier')), []);
  assert.ok(!existsSync(join(instance, '.installation.lock')));

  // une nouvelle livraison remplace le kit : l'ancien ne reste pas
  writeFileSync(join(kit, 'ancien.txt'), 'ancien kit');
  writeFileSync(join(depot, 'client/src/pages/index.astro'), '<h1>version 2</h1>');
  const test2 = installateur({ kit: depot, version: '0.2.1', label: 'v2' });
  const r2 = lancer(test2.fichier, ['--dossier', instance]);
  assert.equal(r2.code, 0, r2.out);
  assert.ok(!existsSync(join(kit, 'ancien.txt')));
  assert.equal(readFileSync(join(kit, 'client/src/pages/index.astro'), 'utf8'), '<h1>version 2</h1>');
  assert.equal(JSON.parse(readFileSync(join(kit, 'kit.json'), 'utf8')).version, '0.2.1');
  assert.deepEqual(rienDeProvisoire(join(instance, 'atelier')), [], 'un seul kit, ni provisoire ni ancien');

  // un installateur sans kit laisse celui qui est posé
  const sans = installateur({ version: '0.2.2', label: 'v3' });
  const r3 = lancer(sans.fichier, ['--dossier', instance]);
  assert.equal(r3.code, 0, r3.out);
  assert.ok(existsSync(join(kit, 'client/package.json')));
  assert.doesNotMatch(r3.out, /Kit de l'atelier/);
});

/** Un faux `df` placé devant le vrai dans le PATH : `libre_ko` kilo-octets disponibles. */
function fauxDf(libreKo) {
  const dossier = dossierTemporaire('deploy-kit-df');
  writeFileSync(join(dossier, 'df'), `#!/bin/sh\necho "Filesystem 1024-blocks Used Available Capacity Mounted on"\necho "/dev/faux 99999999 1 ${libreKo} 1% /"\n`);
  chmodSync(join(dossier, 'df'), 0o755);
  return dossier;
}

test('une installation interrompue entre les deux renommages : l’ancien kit, seul resté, est remis en place et non effacé ; un ancien périmé et un provisoire sont jetés', { skip }, () => {
  const depot = fauxDepot();
  const instance = join(racine, `test-${(n += 1)}`);
  assert.equal(lancer(installateur({ kit: depot }).fichier, ['--dossier', instance]).code, 0);
  const atelier = join(instance, 'atelier');
  // l'interruption : kit/ est parti sous le nom d'ancien, le nouveau n'est pas arrivé
  renameSync(join(atelier, 'kit'), join(atelier, '.kit-ancien.4242'));
  writeFileSync(join(atelier, '.kit-ancien.4242', 'reste.txt'), 'le seul kit');
  mkdirSync(join(atelier, '.kit-provisoire.4242'));
  // une livraison sans kit n'y touche pas ; la suivante avec kit, qui échoue faute de place, doit pourtant avoir remis l'ancien en place
  const manque = lancer(installateur({ kit: depot, version: '0.2.1', label: 'v2' }).fichier, ['--dossier', instance], { PATH: `${fauxDf(100)}:${process.env.PATH}` });
  assert.equal(manque.code, 0, manque.out);
  assert.match(manque.out, /remis en place/);
  assert.equal(readFileSync(join(atelier, 'kit', 'reste.txt'), 'utf8'), 'le seul kit');
  assert.deepEqual(rienDeProvisoire(atelier), [], 'ni provisoire ni ancien');

  // kit/ est là et un ancien périmé traîne : il est jeté
  mkdirSync(join(atelier, '.kit-ancien.1'));
  const r = lancer(installateur({ kit: depot, version: '0.2.2', label: 'v3' }).fichier, ['--dossier', instance]);
  assert.equal(r.code, 0, r.out);
  assert.ok(!existsSync(join(atelier, 'kit', 'reste.txt')), 'le nouveau kit a remplacé l’ancien');
  assert.deepEqual(rienDeProvisoire(atelier), []);
});

test('place insuffisante : l’installation CONTINUE sans kit, le journal le dit, le site est posé, l’ancien kit reste', { skip }, () => {
  const depot = fauxDepot();
  const instance = join(racine, `test-${(n += 1)}`);
  assert.equal(lancer(installateur({ kit: depot }).fichier, ['--dossier', instance]).code, 0);
  writeFileSync(join(instance, 'atelier', 'kit', 'ancien.txt'), 'ancien kit');
  const neuf = installateur({ kit: depot, version: '0.2.1', label: 'v2' });
  const r = lancer(neuf.fichier, ['--dossier', instance], { PATH: `${fauxDf(100)}:${process.env.PATH}` });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Kit de l'atelier : pas assez de place/);
  assert.match(readFileSync(join(instance, 'installation.log'), 'utf8'), /pas assez de place/);
  assert.match(readFileSync(join(instance, 'site', 'index.html'), 'utf8'), /v2/, 'le site est celui de la nouvelle livraison');
  assert.match(readFileSync(join(instance, 'VERSION'), 'utf8'), /version=0\.2\.1/);
  assert.equal(readFileSync(join(instance, 'atelier', 'kit', 'ancien.txt'), 'utf8'), 'ancien kit', 'l’ancien kit n’est pas touché');
  assert.deepEqual(rienDeProvisoire(join(instance, 'atelier')), []);

  // juste assez : le seuil est deux fois la taille décompressée plus une marge
  const besoinKo = Math.ceil((2 * neuf.kit.taille_decompressee_octets) / 1024) + 262144;
  const juste = lancer(neuf.fichier, ['--dossier', instance], { PATH: `${fauxDf(besoinKo)}:${process.env.PATH}` });
  assert.match(juste.out, /Kit de l'atelier posé/);
  const trop = lancer(neuf.fichier, ['--dossier', instance], { PATH: `${fauxDf(besoinKo - 1)}:${process.env.PATH}` });
  assert.match(trop.out, /pas assez de place/);
});

test('une décompression qui échoue ne fait pas échouer l’installation : sans kit, rien de provisoire laissé, l’ancien kit reste', { skip }, () => {
  const depot = fauxDepot();
  const instance = join(racine, `test-${(n += 1)}`);
  assert.equal(lancer(installateur({ kit: depot }).fichier, ['--dossier', instance]).code, 0);
  writeFileSync(join(instance, 'atelier', 'kit', 'ancien.txt'), 'ancien kit');
  // un faux tar qui échoue quand il vise le dossier provisoire du kit, et fait tout le reste comme le vrai
  const vrai = spawnSync('sh', ['-c', 'command -v tar'], { encoding: 'utf8' }).stdout.trim();
  const dossier = dossierTemporaire('deploy-kit-tar');
  writeFileSync(join(dossier, 'tar'), `#!/bin/sh\nfor a in "$@"; do case "$a" in *.kit-provisoire*) exit 1 ;; esac; done\nexec ${vrai} "$@"\n`);
  chmodSync(join(dossier, 'tar'), 0o755);
  const r = lancer(installateur({ kit: depot, version: '0.2.1', label: 'v2' }).fichier, ['--dossier', instance], { PATH: `${dossier}:${process.env.PATH}` });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Kit de l'atelier : décompression impossible/);
  assert.match(readFileSync(join(instance, 'site', 'index.html'), 'utf8'), /v2/);
  assert.equal(readFileSync(join(instance, 'atelier', 'kit', 'ancien.txt'), 'utf8'), 'ancien kit');
  assert.deepEqual(rienDeProvisoire(join(instance, 'atelier')), []);
});

test('livraison.yml : le kit est joint pour le serveur de test seulement ; --kit-seul s’y ajoute sous l’interrupteur de la bascule 2, jamais en production', () => {
  const yml = readFileSync(new URL('../../.github/workflows/livraison.yml', import.meta.url), 'utf8');
  assert.match(yml, /if \[ "\$MODE" = test \]; then kit="--kit \."; fi/);
  assert.equal([...yml.matchAll(/kit="--kit \./g)].length, 1, 'une seule ligne pose l’option --kit');
  assert.equal([...yml.matchAll(/--kit-seul/g)].filter((m) => !/#[^\n]*$/.test(yml.slice(yml.lastIndexOf('\n', m.index), m.index))).length, 1, 'une seule ligne de commande pose --kit-seul (le reste est commenté)');
  assert.match(yml, /fabriquer\.mjs --mode "\$MODE" .* \$kit\)/);
  // --kit-seul : seulement quand la décision du module le dit (test allumé), jamais de soi-même
  assert.match(yml, /if \[ "\$KIT_SEUL" = true \]; then kit="\$kit --kit-seul"; site=""; fi/);
});

test('kit.json annonce son paquet : null sans data/paquet.json (comme avant) ; avec, lot, version, empreinte et structure ; illisible ou d’une autre forme : refus ; le fichier n’entre pas dans le kit', { skip }, () => {
  const depot = fauxDepot();
  const sans = kitDe(depot);
  assert.equal(sans.meta.paquet, null);
  assert.equal(sans.meta.structure, 1, 'la structure du kit : le user_version de son data/schema.sql, avec ou sans paquet');
  const identite = { format: FORMAT_D_IDENTITE, lot: '0f8fad5b-d9cb-469f-a165-70867728950e', version: '0.5', empreinte: 'e'.repeat(64), structure: 131, commit_du_code: 'c'.repeat(40), fabrique_le: '2026-11-19T10:00:00.000Z' };
  writeFileSync(join(depot, FICHIER_D_IDENTITE), `${JSON.stringify(identite, null, 2)}\n`);
  const avec = kitDe(depot);
  assert.deepEqual(avec.meta.paquet, { lot: identite.lot, version: '0.5', empreinte: 'e'.repeat(64), structure: 131 }, 'la structure du paquet est sous paquet');
  assert.equal(avec.meta.structure, 1, 'celle du kit reste celle de son schema.sql : un kit et son paquet peuvent différer, la production le refuse (structure)');
  assert.deepEqual(JSON.parse(readFileSync(join(avec.destination, META_DU_KIT), 'utf8')).paquet, avec.meta.paquet, 'kit.json dit ce que la fonction rend');
  assert.ok(!lister(avec.kit).includes('data/paquet.json'), 'le kit n’emporte pas le fichier : son identité est dans kit.json');
  assert.equal(avec.meta.empreinte, sans.meta.empreinte, 'l’empreinte du kit suit son contenu, pas l’identité du lot');
  assert.deepEqual(lireLIdentiteDuPaquet(depot), avec.meta.paquet);
  assert.equal(structureDuKit(join(depot, 'data/schema.sql')), 1);
  writeFileSync(join(depot, 'data/schema.sql'), 'PRAGMA user_version = 142;\nCREATE TABLE t (a);');
  assert.equal(kitDe(depot).meta.structure, 142);
  writeFileSync(join(depot, 'data/schema.sql'), 'CREATE TABLE t (a);');
  assert.equal(kitDe(depot).meta.structure, null, 'illisible : null, le kit se fabrique');
  writeFileSync(join(depot, 'data/schema.sql'), 'PRAGMA user_version = 1;')
  assert.equal(FORMAT_D_IDENTITE, 'maverick-paquet-identite/1');
  // les lecteurs de kit.json ne sont pas stricts : le service par liste blanche de champs, les scripts par `sed` sur la première occurrence de « version » (celle du kit, avant « paquet »)
  assert.deepEqual(validerLeKit(JSON.parse(readFileSync(join(avec.destination, META_DU_KIT), 'utf8'))).version, '1.2.3');
  const texteDuKit = readFileSync(join(avec.destination, META_DU_KIT), 'utf8');
  assert.equal(texteDuKit.match(/"version": *"([0-9]+\.[0-9]+\.[0-9]+)"/)?.[1], '1.2.3');
  assert.ok(texteDuKit.indexOf('"version"') < texteDuKit.indexOf('"paquet"'), 'la version du kit précède celle du paquet');
  for (const [nom, valeur] of [['version', 'x'], ['empreinte', 'abc'], ['structure', -1], ['structure', '12'], ['format', 'autre'], ['lot', 7]]) {
    writeFileSync(join(depot, FICHIER_D_IDENTITE), JSON.stringify({ ...identite, [nom]: valeur }));
    assert.throws(() => kitDe(depot), (e) => e instanceof ErreurKit && /data\/paquet\.json/.test(e.message), nom);
  }
  writeFileSync(join(depot, FICHIER_D_IDENTITE), 'pas du json');
  assert.throws(() => kitDe(depot), (e) => e instanceof ErreurKit && /illisible/.test(e.message));
});

test('l’installateur de test prend le verrou de l’atelier (le même flock que lancer.sh) pendant la pose de site/, seulement si l’atelier existe ; la production n’en sait rien', { skip: skip || (!have('flock') && 'flock indisponible') }, async () => {
  const test1 = installateur({ mode: 'test', version: '0.2.1' });
  const script = readFileSync(test1.fichier, 'utf8');
  assert.ok(script.includes('flock -w 2700 8') && script.includes('exec 8>&-'), 'le verrou est pris puis rendu');
  assert.ok(script.indexOf('flock -w 2700 8') < script.indexOf('rsync -a --delete') && script.indexOf('rsync -a --delete') < script.indexOf('exec 8>&-'), 'autour de la seule pose de site/');
  // sans atelier (première installation) : rien
  const neuve = join(racine, `pose-neuve-${(n += 1)}`);
  const r0 = lancer(test1.fichier, ['--dossier', neuve]);
  assert.equal(r0.code, 0, r0.out);
  assert.ok(!r0.out.includes('verrou'), 'sans dossier atelier/, aucun verrou');
  // avec l'atelier, verrou libre : pris et rendu
  const libre = join(racine, `pose-libre-${(n += 1)}`);
  mkdirSync(join(libre, 'atelier'), { recursive: true });
  const r1 = lancer(test1.fichier, ['--dossier', libre]);
  assert.equal(r1.code, 0, r1.out);
  assert.match(r1.out, /Atelier : verrou pris pour poser site\//);
  // avec l'atelier, verrou tenu (une fabrication en cours) : la pose de site/ attend, puis passe quand il est rendu
  const tenu = join(racine, `pose-tenue-${(n += 1)}`);
  mkdirSync(join(tenu, 'atelier'), { recursive: true });
  const tient = spawn('flock', [join(tenu, 'atelier', '.verrou'), 'sleep', '60'], { stdio: 'ignore' });
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    let sortie = '';
    const install = spawn('sh', [test1.fichier, '--dossier', tenu], { cwd: racine, env: { PATH: process.env.PATH } });
    install.stdout.on('data', (d) => { sortie += d; });
    install.stderr.on('data', (d) => { sortie += d; });
    const fini = new Promise((resolve) => install.on('close', resolve));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    assert.ok(!existsSync(join(tenu, 'site', 'index.html')), 'site/ n’est pas touché tant que l’atelier tient le verrou');
    assert.ok(install.exitCode === null, 'l’installation attend');
    tient.kill();
    assert.equal(await fini, 0, sortie);
    assert.ok(existsSync(join(tenu, 'site', 'index.html')), 'puis site/ est posé');
    assert.match(sortie, /Atelier : verrou pris pour poser site\//);
  } finally {
    tient.kill();
  }
});
