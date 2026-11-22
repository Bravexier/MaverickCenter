// L'installateur de PRODUCTION et l'activation par paquet (lot 11, PR 5a ; deploy/installateur/activation-pose.sh inséré par fabriquer.mjs ; docs/serveur.md, « Bascule 2 : préparation »,
// « PR 5a ») : ÉTEINT par défaut — sans le fichier activation-par-paquet de l'instance, l'installation est celle d'avant (rien de créé, aucun propriétaire changé, aucune ligne de journal) ;
// avec lui : l'utilisateur maverick-site, site/ à lui SAUF _serveur/ (root), le chown de root sans jamais suivre un lien, et activer.sh lancé quand le kit est posé. L'installateur de test n'en
// porte rien. Le vrai script, avec des commandes système factices (id, useradd, chown) : le test ne crée aucun utilisateur et ne change aucun propriétaire.
//   node --test test/installateur-activation.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SEUL_LINUX } from './aide-plateforme.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip') && have('find')) && 'tar, gzip ou find indisponible';
const racine = dossierTemporaire('installateur-activation');
let n = 0;
const ecrire = (chemin, contenu) => { mkdirSync(dirname(chemin), { recursive: true }); writeFileSync(chemin, contenu); };

/** Des commandes système factices : `id` (root, maverick-site absent tant que `useradd` ne l'a pas « créé »), `useradd`, `adduser`, `chown`, qui notent leurs appels. */
function faux(journal, { root = true } = {}) {
  const bin = join(racine, `bin-${(n += 1)}`);
  mkdirSync(bin);
  const ajouter = (nom, corps) => { writeFileSync(join(bin, nom), `#!/bin/sh\n${corps}\n`); chmodSync(join(bin, nom), 0o755); };
  ajouter('id', `case "$1" in -u) echo ${root ? 0 : 1000} ;; maverick-site) [ -e "${journal}.cree" ] && echo 'uid=998(maverick-site)' || exit 1 ;; *) echo 'uid=0(root)' ;; esac`);
  ajouter('useradd', `echo "useradd $*" >> "${journal}"; : > "${journal}.cree"`);
  ajouter('adduser', `echo "adduser $*" >> "${journal}"; : > "${journal}.cree"`);
  ajouter('chown', `echo "chown $*" >> "${journal}"`);
  return bin;
}
function prod({ label = 'v1' } = {}) {
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(join(site, 'index.html'), `<h1>${label}</h1>`);
  ecrire(join(site, '_serveur', 'version.json'), '{"version":"0.2.0"}');
  return fabriquer({ mode: 'prod', tag: 'v0.2', version: '0.2.0', sha: 'local', site, sortie: join(racine, 'sortie') });
}
function instance() {
  const dossier = join(racine, `prod-${(n += 1)}`);
  mkdirSync(dossier);
  return dossier;
}
function lancer(fichier, dossier, bin, env = {}) {
  const r = spawnSync('sh', [fichier, '--dossier', dossier], { cwd: racine, encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, ...env } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test('éteint par défaut : sans activation-par-paquet, l’installation de production ne crée rien, ne change aucun propriétaire et ne dit rien de l’activation', { skip: SEUL_LINUX || skip }, () => {
  const i = prod();
  const dossier = instance();
  const journal = join(racine, `appels-${(n += 1)}`);
  const r = lancer(i.fichier, dossier, faux(journal));
  assert.equal(r.code, 0, r.out);
  assert.equal(existsSync(journal), false, 'ni useradd ni chown');
  assert.doesNotMatch(r.out, /Activation par paquet/);
  assert.equal(existsSync(join(dossier, 'activation')), false);
  // les deux scripts sont livrés (remplacés à chaque installation) ; activer.sh refuse tant que l'interrupteur manque
  for (const f of ['activer.sh', 'activation-conteneur.sh', 'gel.sh']) assert.ok(existsSync(join(dossier, f)), f);
  const a = spawnSync('bash', [join(dossier, 'activer.sh'), '--prod', dossier], { encoding: 'utf8', env: { ...process.env, MAVERICK_ESSAI: '1' } });
  assert.equal(a.status, 2, a.stdout + a.stderr);
  assert.match(a.stderr, /== IMPOSSIBLE : l'activation par paquet est éteinte \(.*activation-par-paquet n'existe pas\) : rien n'a changé/);
});

test('avec activation-par-paquet, root : maverick-site créé s’il manque, site/ à lui SAUF _serveur/ (à root), chown -h par find -P ; sans kit, activer.sh n’est pas lancé et le dit', { skip: SEUL_LINUX || skip }, () => {
  const i = prod();
  const dossier = instance();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const journal = join(racine, `appels-${(n += 1)}`);
  const r = lancer(i.fichier, dossier, faux(journal));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Activation par paquet : .*activation-par-paquet existe/);
  assert.match(r.out, /utilisateur système maverick-site créé/);
  assert.match(r.out, /site\/ appartient à maverick-site, site\/_serveur reste à root/);
  assert.match(r.out, /pas de kit dans .*activation\/kit : activer\.sh n'est pas lancé/);
  assert.match(r.out, /installateur « kit seul » de production.*sudo sh .*mise-a-jour\.sh --force/, 'le geste : la dernière livraison de production pose le kit');
  const appels = readFileSync(journal, 'utf8').split('\n').filter(Boolean);
  assert.deepEqual(appels.filter((a) => a.startsWith('useradd')), ['useradd --system --user-group --no-create-home --shell /usr/sbin/nologin maverick-site']);
  const chowns = appels.filter((a) => a.startsWith('chown'));
  assert.ok(chowns.length >= 2 && chowns.every((c) => c.startsWith('chown -h ')), 'toujours -h : jamais un lien suivi');
  // site/ et ses fichiers à maverick-site, jamais _serveur ; _serveur et ses fichiers à root
  const site = join(dossier, 'site');
  assert.ok(chowns.some((c) => c.includes('maverick-site:maverick-site') && c.includes(join(site, 'index.html'))));
  assert.ok(!chowns.some((c) => c.includes('maverick-site:maverick-site') && c.includes(join(site, '_serveur'))), '_serveur n’est jamais donné à maverick-site');
  assert.ok(chowns.some((c) => c.includes('root:root') && c.includes(join(site, '_serveur', 'version.json'))));
  // une seconde installation : l'utilisateur existe déjà, il n'est pas recréé
  const journal2 = join(racine, `appels-${(n += 1)}`);
  writeFileSync(`${journal2}.cree`, '');
  const r2 = lancer(i.fichier, dossier, faux(journal2));
  assert.equal(r2.code, 0, r2.out);
  assert.doesNotMatch(readFileSync(journal2, 'utf8'), /useradd/);
});

test('avec activation-par-paquet sans être root : rien n’est créé ni changé, et l’installation continue avec le geste', { skip: SEUL_LINUX || skip }, () => {
  const i = prod();
  const dossier = instance();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  const journal = join(racine, `appels-${(n += 1)}`);
  const r = lancer(i.fichier, dossier, faux(journal, { root: false }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Activation par paquet : pas root : l'utilisateur maverick-site et les droits de site\/ ne sont pas posés/);
  assert.equal(existsSync(journal), false);
});

test('avec le kit posé, activer.sh est lancé ; son refus ne fait jamais échouer l’installation (code 0, ATTENTION, le geste, sa sortie au journal)', { skip: SEUL_LINUX || skip }, () => {
  const i = prod();
  const dossier = instance();
  writeFileSync(join(dossier, 'activation-par-paquet'), '');
  ecrire(join(dossier, 'activation', 'kit', 'kit.json'), '{\n  "version": "0.2.0"\n}\n'); // la version de l'installation (prod() : 0.2.0) : un autre kit est périmé
  const journal = join(racine, `appels-${(n += 1)}`);
  const r = lancer(i.fichier, dossier, faux(journal));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /le kit est posé, activer\.sh est lancé/);
  assert.match(r.out, /== IMPOSSIBLE : /, 'la sortie d’activer.sh est reprise telle quelle');
  assert.match(r.out, /ATTENTION activation par paquet : code 2 .*Pour rejouer : sudo bash .*activer\.sh --reprendre/);
  assert.match(readFileSync(join(dossier, 'installation.log'), 'utf8'), /IMPOSSIBLE/, 'et au journal de l’installation');
});

test('l’installateur de test ne porte rien de l’activation : ni fragment, ni activer.sh dans l’archive', { skip: SEUL_LINUX || skip }, () => {
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(join(site, 'index.html'), 'x');
  const t = fabriquer({ mode: 'test', tag: 'v0.2.0', version: '0.2.0', sha: 'local', site, sortie: join(racine, 'sortie-test') });
  const octets = readFileSync(t.fichier);
  const script = octets.subarray(0, octets.indexOf('\n__ARCHIVE__\n') + 1).toString('utf8');
  assert.ok(!script.includes('activation_par_paquet()') && !script.includes('useradd') && !script.includes('@@'), 'ni le fragment ni un repère');
  const contenu = join(racine, `archive-${(n += 1)}`);
  mkdirSync(contenu);
  const archive = join(contenu, 'a.tar.gz');
  writeFileSync(archive, octets.subarray(octets.indexOf('\n__ARCHIVE__\n') + '\n__ARCHIVE__\n'.length));
  const l = spawnSync('tar', ['-tzf', 'a.tar.gz'], { cwd: contenu, encoding: 'utf8' }).stdout;
  assert.ok(!/activer\.sh|activation-conteneur\.sh/.test(l), 'ni activer.sh ni son conteneur dans l’archive de test');
  assert.ok(/gel\.sh/.test(l));
});
