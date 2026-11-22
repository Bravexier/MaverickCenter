// L'installateur « kit seul » de TEST (lot 11, PR 4 ; deploy/installateur/fabriquer.mjs --kit-seul, kit-seul.sh dans installateur.sh ; docs/serveur.md, « Bascule 2 : préparation », « PR 4 ») :
// une archive sans pages (seulement le service, site/_serveur/, et le kit) que l'installateur de TEST pose sans toucher au reste de site/ (l'atelier refait les pages), et qu'il
// refuse sur une instance sans atelier/servir. Celui de production (PR 5b) : deploy-kit-seul-prod.test.mjs ; sans --kit-seul, l'installateur de production a le même comportement qu'avant
// (deploy-kit.test.mjs). Un faux dépôt pour le kit, le vrai service (livrerServeur) pour _serveur/. Nécessite sh, tar et gzip ; sinon les tests sont ignorés.
//   node --test test/deploy-kit-seul.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SEUL_LINUX } from './aide-plateforme.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip')) && 'tar ou gzip indisponible';
const racine = dossierTemporaire('deploy-kit-seul');
const FABRIQUER = fileURLToPath(new URL('../../deploy/installateur/fabriquer.mjs', import.meta.url));
const SHA = 'd'.repeat(40);
let n = 0;

function ecrire(base, fichiers) {
  for (const [rel, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), contenu);
  }
}
/** Un faux dépôt, juste de quoi faire un kit (le service livré est le vrai). */
function fauxDepot() {
  const d = join(racine, `depot-${(n += 1)}`);
  ecrire(d, {
    '.nvmrc': '22\n',
    'client/package.json': JSON.stringify({ name: 'maverick-client', version: '1.0.0' }),
    'client/astro.config.mjs': 'export default {};',
    'client/scripts/fabriquer-depuis-contenu.mjs': '// script',
    'client/scripts/poser-un-site.mjs': '// script de pose',
    'client/node_modules/astro/bin/astro.mjs': '// astro',
    'client/node_modules/astro/package.json': JSON.stringify({ name: 'astro', version: '1.0.0' }),
    'data/schema.sql': 'PRAGMA user_version = 1;',
    'data/derive.sql': '-- derive',
    'data/references/a.json': '{}',
    'data/migrations/0001-a.sql': '-- m',
    'sources/sources.json': '{}',
    'sources/copies-drive.json': '{}',
    'sources/tipeee/bienvenue.json': '{}',
  });
  return d;
}
const lister = (dossier, relatif = '') => readdirSync(join(dossier, relatif), { withFileTypes: true }).flatMap((e) => {
  const rel = relatif ? `${relatif}/${e.name}` : e.name;
  return e.isDirectory() ? lister(dossier, rel) : [rel];
}).sort();
function lancer(fichier, args = [], env = {}) {
  const r = spawnSync('sh', [fichier, ...args], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
  return { code: r.status, out: r.stdout + r.stderr };
}
/** Un installateur de test : complet (avec un faux site) ou « kit seul ». */
function installateur({ kitSeul = false, version = '0.2.0', label = 'v1', depot = null, sha = SHA } = {}) {
  const options = { mode: 'test', tag: `v${version}`, version, sha, sortie: join(racine, 'sortie'), ...(depot ? { kit: depot } : {}) };
  if (kitSeul) return fabriquer({ ...options, kitSeul: true });
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(site, { 'index.html': `<h1>${label}</h1>`, 'wiki/p/index.html': 'page' });
  return fabriquer({ ...options, site });
}
const contenuDe = (fichier) => {
  const octets = readFileSync(fichier);
  return octets.subarray(0, octets.indexOf('\n__ARCHIVE__\n') + 1).toString('utf8');
};
const archiveDe = (fichier, dossier) => {
  const octets = readFileSync(fichier);
  const archive = join(dossier, 'archive.tar.gz');
  mkdirSync(dossier, { recursive: true });
  writeFileSync(archive, octets.subarray(octets.indexOf('\n__ARCHIVE__\n') + '\n__ARCHIVE__\n'.length));
  const r = spawnSync('tar', ['-xzf', archive, '-C', dossier], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return dossier;
};

test('fabriquer --kit-seul : l’archive n’a aucune page, seulement le service (version.json avec le commit) et le kit ; le script porte KIT_SEUL=1', { skip: SEUL_LINUX || skip }, () => {
  const depot = fauxDepot();
  const i = installateur({ kitSeul: true, depot });
  assert.equal(i.KIT_SEUL, '1');
  assert.equal(i.PAGES, '0');
  assert.equal(i.kit.format, 'maverick-kit/1');
  const script = contenuDe(i.fichier);
  assert.match(script, /^KIT_SEUL=1$/m);
  assert.doesNotMatch(script, /@@/);
  const contenu = archiveDe(i.fichier, join(racine, `contenu-${(n += 1)}`));
  const fichiers = lister(contenu);
  assert.ok(fichiers.includes('site/_serveur/version.json') && fichiers.includes('site/_serveur/serveur/index.mjs'), 'le service');
  assert.ok(fichiers.includes('atelier-kit/kit.json') && fichiers.includes('atelier-kit/atelier-kit.tar.gz'), 'le kit');
  assert.ok(!fichiers.some((f) => f.endsWith('index.html')) && !fichiers.some((f) => f.startsWith('site/donnees')), 'aucune page, aucun donnees/');
  assert.deepEqual(readdirSync(join(contenu, 'site')), ['_serveur'], 'site/ ne porte que le service');
  const info = JSON.parse(readFileSync(join(contenu, 'site/_serveur/version.json'), 'utf8'));
  assert.equal(info.version, '0.2.0');
  assert.equal(info.commit, SHA, 'le commit entier de la livraison');
  assert.match(info.empreinte, /^[0-9a-f]{16}$/);
  // les fichiers d'hébergement sont livrés comme toujours
  assert.ok(['docker-compose.yml', 'nginx.conf', 'mise-a-jour.sh', 'gel.sh', 'atelier-scripts/installer.sh'].every((f) => fichiers.includes(f)));
  assert.equal(lancer(i.fichier, ['--verifier']).code, 0, 'l’archive intègre se vérifie');
  // un commit court ou « local » n'entre pas dans version.json (le service ne lit un commit que complet)
  const court = installateur({ kitSeul: true, depot, sha: 'local', version: '0.2.1' });
  const infoCourt = JSON.parse(readFileSync(join(archiveDe(court.fichier, join(racine, `contenu-${(n += 1)}`)), 'site/_serveur/version.json'), 'utf8'));
  assert.ok(!('commit' in infoCourt));
});

test('fabriquer --kit-seul : demande --kit, refuse --site ; sans lui, KIT_SEUL=0 et le site complet', { skip: SEUL_LINUX || skip }, () => {
  const depot = fauxDepot();
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(site, { 'index.html': 'x' });
  const base = { tag: 'v0.2.0', version: '0.2.0', sha: 'local', sortie: join(racine, 'sortie') };
  assert.throws(() => fabriquer({ ...base, mode: 'prod', tag: 'v0.2', kitSeul: true }), /--kit-seul demande --kit/, 'la production aussi : sans kit, activer.sh n’aurait rien pour fabriquer');
  assert.throws(() => fabriquer({ ...base, mode: 'prod', tag: 'v0.2', kit: depot, kitSeul: true, site }), /--kit-seul n’emporte aucune page/);
  assert.throws(() => fabriquer({ ...base, mode: 'test', kitSeul: true }), /--kit-seul demande --kit/);
  assert.throws(() => fabriquer({ ...base, mode: 'test', kit: depot, kitSeul: true, site }), /--kit-seul n’emporte aucune page/);
  assert.throws(() => fabriquer({ ...base, mode: 'test' }), /--site/, 'sans kit seul, le site reste exigé');
  const complet = fabriquer({ ...base, mode: 'test', site, kit: depot });
  assert.equal(complet.KIT_SEUL, '0');
  assert.match(contenuDe(complet.fichier), /^KIT_SEUL=0$/m);
  // la ligne de commande : l'option sans valeur, avant ou après les autres
  const cli = (...args) => spawnSync('node', [FABRIQUER, '--mode', 'test', '--tag', 'v0.2.0', '--version', '0.2.0', '--sha', 'local', '--sortie', join(racine, 'sortie-cli'), ...args], { encoding: 'utf8' });
  assert.equal(cli('--kit', depot, '--kit-seul').status, 0);
  assert.equal(cli('--kit-seul', '--kit', depot).status, 0);
  assert.equal(cli('--kit-seul').status, 1);
  assert.equal(cli('--kit', depot).status, 1, 'sans --site ni --kit-seul');
});

test('l’installateur de test sans kit seul : le modèle et les sections du kit seul, sans effet (KIT_SEUL=0)', { skip: SEUL_LINUX || skip }, () => {
  const i = installateur({ depot: fauxDepot() });
  const script = contenuDe(i.fichier);
  assert.match(script, /^KIT_SEUL=0$/m);
  assert.doesNotMatch(script, /^# >>> /m);
  assert.match(script, /if \[ "\$KIT_SEUL" = 1 \]; then/);
});

test('installer un kit seul : refusé sans atelier/servir (aucune écriture, le geste exact) ; avec, seul site/_serveur/ est posé, les pages restent, le kit et la marque suivent', { skip: SEUL_LINUX || skip }, () => {
  const depot = fauxDepot();
  const instance = join(racine, `test-${(n += 1)}`);
  const complet = installateur({ depot, label: 'complet' });
  assert.equal(lancer(complet.fichier, ['--dossier', instance]).code, 0);
  assert.equal(readFileSync(join(instance, 'site/index.html'), 'utf8'), '<h1>complet</h1>');
  const avant = lister(instance).filter((f) => !f.startsWith('atelier/kit/') && f !== 'installation.log');
  const seul = installateur({ kitSeul: true, depot, version: '0.2.1' });

  // sans l'interrupteur : refusé, rien n'est écrit, le geste est dit
  const refus = lancer(seul.fichier, ['--dossier', instance]);
  assert.equal(refus.code, 1);
  assert.match(refus.out, /kit seul.*refusé/);
  assert.match(refus.out, new RegExp(`sudo sh ${instance.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/atelier/installer\\.sh --servir`));
  assert.deepEqual(lister(instance).filter((f) => !f.startsWith('atelier/kit/') && f !== 'installation.log'), avant, 'rien n’a été modifié');
  assert.match(readFileSync(join(instance, 'VERSION'), 'utf8'), /^version=0\.2\.0$/m);
  assert.ok(!existsSync(join(instance, '.installation.lock')), 'le verrou est rendu');

  // avec l'interrupteur : le service et le kit, pas les pages
  writeFileSync(join(instance, 'atelier/servir'), 'SERVIR_DEPUIS=2026-11-19\n');
  ecrire(join(instance, 'site'), { 'wiki/p/fabrique-par-l-atelier/index.html': 'page fabriquée', 'donnees/maverick.db': 'base fabriquée', '_serveur/ancien.mjs': 'ancien service' });
  const r = lancer(seul.fichier, ['--dossier', instance]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Installateur « kit seul »/);
  assert.equal(readFileSync(join(instance, 'site/index.html'), 'utf8'), '<h1>complet</h1>', 'les pages ne sont pas touchées');
  assert.equal(readFileSync(join(instance, 'site/wiki/p/fabrique-par-l-atelier/index.html'), 'utf8'), 'page fabriquée');
  assert.equal(readFileSync(join(instance, 'site/donnees/maverick.db'), 'utf8'), 'base fabriquée');
  assert.ok(!existsSync(join(instance, 'site/_serveur/ancien.mjs')), 'le service est remplacé tel que livré');
  assert.equal(JSON.parse(readFileSync(join(instance, 'site/_serveur/version.json'), 'utf8')).version, '0.2.1');
  assert.match(readFileSync(join(instance, 'VERSION'), 'utf8'), /^version=0\.2\.1$/m, 'la marque de l’installation est posée comme toujours');
  assert.equal(JSON.parse(readFileSync(join(instance, 'atelier/kit/kit.json'), 'utf8')).version, '0.2.1', 'le kit est posé');
  assert.equal(readFileSync(join(instance, 'atelier/declencheur/marque'), 'utf8').split('\n')[0], 'version=0.2.1', 'la marque de l’atelier : il refabrique les pages');
  assert.ok(readFileSync(join(instance, 'atelier/servir'), 'utf8').includes('SERVIR_DEPUIS'), 'l’interrupteur est intact');

  // sans rsync : le même résultat
  ecrire(join(instance, 'site'), { '_serveur/reste.mjs': 'reste' });
  const sansRsync = lancer(seul.fichier, ['--dossier', instance], { USE_RSYNC: '0' });
  assert.equal(sansRsync.code, 0, sansRsync.out);
  assert.ok(!existsSync(join(instance, 'site/_serveur/reste.mjs')));
  assert.equal(readFileSync(join(instance, 'site/index.html'), 'utf8'), '<h1>complet</h1>');
  assert.equal(readFileSync(join(instance, 'site/donnees/maverick.db'), 'utf8'), 'base fabriquée');
});

test('un installateur de test complet reste celui d’avant sur une instance qui a atelier/servir : il pose le site entier', { skip: SEUL_LINUX || skip }, () => {
  const depot = fauxDepot();
  const instance = join(racine, `test-${(n += 1)}`);
  assert.equal(lancer(installateur({ depot, label: 'a' }).fichier, ['--dossier', instance]).code, 0);
  writeFileSync(join(instance, 'atelier/servir'), 'x\n');
  ecrire(join(instance, 'site'), { 'reste.html': 'reste' });
  assert.equal(lancer(installateur({ depot, label: 'b', version: '0.2.1' }).fichier, ['--dossier', instance]).code, 0);
  assert.equal(readFileSync(join(instance, 'site/index.html'), 'utf8'), '<h1>b</h1>');
  assert.ok(!existsSync(join(instance, 'site/reste.html')), 'comme avant : le site est remplacé en entier');
});
