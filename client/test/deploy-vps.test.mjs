// deploy/vps/ : l'hébergement du serveur normal et du serveur de test derrière Caddy (README.md de ce dossier).
// On ne peut pas lancer Caddy ni Docker ici : le Caddyfile et les scripts sont contrôlés par leur texte, et instances.sh est exécuté pour de
// bon dans des dossiers temporaires, avec de faux « caddy » et « systemctl ». Le premier vrai lancement est celui du serveur.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const vps = fileURLToPath(new URL('../../deploy/vps/', import.meta.url));
const installateur = readFileSync(fileURLToPath(new URL('../../deploy/installateur/installateur.sh', import.meta.url)), 'utf8');
const lire = (f) => readFileSync(join(vps, f), 'utf8');
const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skipBash = !have('bash') && 'bash indisponible';
const skipExec = (!(have('bash') && have('openssl', 'version')) && 'bash ou openssl indisponible') || false;

const racine = mkdtempSync(join(tmpdir(), 'deploy-vps-test-'));
after(() => rmSync(racine, { recursive: true, force: true }));

test('les scripts sont de la syntaxe bash valide', { skip: skipBash }, () => {
  for (const f of ['durcir.sh', 'outils.sh', 'instances.sh']) {
    const r = spawnSync('bash', ['-n', join(vps, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f} : ${r.stderr}`);
  }
});

test('Caddyfile : normal sur 8080, test sur 8081 (les ports des installateurs), www redirigé, rien d\'indexé', () => {
  const c = lire('Caddyfile');
  assert.match(c, /^\{\$MAVERICK_DOMAINE:maverick-jdr\.com\} \{/m, 'le domaine principal est le serveur normal');
  assert.match(c, /^dev\.\{\$MAVERICK_DOMAINE:maverick-jdr\.com\} \{/m, 'dev.<domaine> est le serveur de test');
  assert.match(c, /^www\.\{\$MAVERICK_DOMAINE:maverick-jdr\.com\} \{\n\tredir https:\/\/\{\$MAVERICK_DOMAINE:maverick-jdr\.com\}\{uri\} permanent/m);
  // Les ports par défaut de l'installateur (.env créé à la première installation) sont ceux que Caddy utilise.
  assert.match(installateur, /CONTENEUR=\$NOM_PROD; PORT=8080; else CONTENEUR=\$NOM_PROD-test; PORT=8081/);
  const normal = c.match(/^\{\$MAVERICK_DOMAINE[^\n]*\{\n([\s\S]*?)\n\}/m)[1];
  const test_ = c.match(/^dev\.\{\$MAVERICK_DOMAINE[^\n]*\{\n([\s\S]*?)\n\}/m)[1];
  assert.match(normal, /reverse_proxy 127\.0\.0\.1:8080/);
  assert.match(test_, /reverse_proxy 127\.0\.0\.1:8081/);
  assert.match(normal, /\{\$MAVERICK_ACCES_NORMAL\}/);
  assert.match(test_, /\{\$MAVERICK_ACCES_TEST\}/);
  assert.match(test_, /header Cache-Control "no-store"/, 'le test ne garde aucune copie dans le navigateur');
  assert.doesNotMatch(normal, /no-store/, 'la production garde le cache normal');
  assert.match(c, /X-Robots-Tag "noindex, nofollow"/);
  assert.match(c, /handle \/robots\.txt/);
  assert.doesNotMatch(c, /0\.0\.0\.0|^:808[01]\s*\{/m, 'jamais d\'accès direct aux ports des instances');
});

test('durcir.sh : seuls 22, 80 et 443 sont ouverts, SSH par clé, jamais de coupure sans clé installée', () => {
  const d = lire('durcir.sh');
  const ouverts = [...d.matchAll(/^ufw (?:allow|limit) (\S+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(ouverts, ['22/tcp', '443/tcp', '443/udp', '80/tcp']);
  assert.match(d, /PasswordAuthentication no/);
  assert.match(d, /PermitRootLogin no/);
  assert.ok(d.indexOf('authorized_keys') < d.indexOf('PasswordAuthentication no'), 'la clé est vérifiée avant de désactiver le mot de passe');
  assert.match(d, /sshd -t/, 'configuration SSH validée avant rechargement');
});

test('avant la 0.2.0 : le README pose le serveur de test depuis la branche « site », avec des fichiers qui existent', () => {
  const deploy = join(vps, '..');
  const section = lire('README.md').split(/^## /m).find((s) => s.startsWith('Avant la 0.2.0'));
  assert.ok(section, 'section « Avant la 0.2.0 » du README');
  // Les fichiers copiés dans l'instance portent ce nom dans deploy/ : un renommage doit suivre ici.
  const copies = section.match(/sudo cp (.+) \.\r?\n/)[1].split(' ').map((f) => f.replace('~/deploy/', ''));
  assert.deepEqual(copies, ['installateur/docker-compose.yml', 'nginx.conf', 'update-site.sh']);
  for (const f of copies) assert.ok(existsSync(join(deploy, f)), `deploy/${f} existe`);
  // « mode=test » : ce que l'installateur lit pour reconnaître une instance de test (sinon il la prendrait pour une production).
  assert.match(section, /echo "mode=test" \| sudo tee VERSION/);
  assert.match(installateur, /sed -n 's\/\^mode=\/\/p' "\$1\/VERSION"/);
  assert.match(section, /\*\/2 \* \* \* \* sh \/srv\/maverick-center-test\/update-site\.sh/);
  assert.match(section, /grep -v maverick-center-test\/update-site\.sh/, 'cron posé sans doublon');
  assert.match(section, /stty -echo; read -r t; stty echo/, 'le jeton se colle sans s\'afficher, jamais en argument');
  assert.match(section, /bandeau « Serveur de test »/);
  assert.match(section, /répond 502/);
});

test('.gitattributes : les scripts et deploy/ restent en LF (un clone Windows les envoie tels quels par scp)', () => {
  const attributs = readFileSync(fileURLToPath(new URL('../../.gitattributes', import.meta.url)), 'utf8');
  assert.match(attributs, /^\*\.sh text eol=lf\r?$/m);
  assert.match(attributs, /^deploy\/\*\* text eol=lf\r?$/m);
});

function fauxOutils() {
  const bin = join(racine, 'bin');
  mkdirSync(bin, { recursive: true });
  const journal = join(racine, 'appels.log');
  for (const nom of ['caddy', 'systemctl']) {
    writeFileSync(join(bin, nom), `#!/bin/sh\necho "${nom} $*" >> "${journal}"\nexit 0\n`);
    chmodSync(join(bin, nom), 0o755);
  }
  return { bin, journal };
}
let n = 0;
function lancerInstances(dossiers, args = [], outils = fauxOutils()) {
  const env = {
    PATH: `${outils.bin}:${process.env.PATH}`,
    MAVERICK_ESSAI: '1',
    MAVERICK_DIR_NORMAL: dossiers.normal,
    MAVERICK_DIR_TEST: dossiers.test,
    MAVERICK_DIR_ETC_CADDY: dossiers.caddy,
    MAVERICK_DIR_ETC_SYSTEMD: dossiers.systemd,
  };
  const r = spawnSync('bash', [join(vps, 'instances.sh'), ...args], { encoding: 'utf8', env });
  return { code: r.status, out: r.stdout + r.stderr };
}
function dossiers() {
  const d = join(racine, `srv-${(n += 1)}`);
  return { normal: join(d, 'maverick-center'), test: join(d, 'maverick-center-test'), caddy: join(d, 'etc-caddy'), systemd: join(d, 'etc-systemd') };
}
const env = (fichier) => Object.fromEntries(readFileSync(fichier, 'utf8').trim().split('\n').map((l) => l.split(/=(.*)/s).slice(0, 2)));
/** Le mot de passe interne de nginx (.htpasswd) correspond-il à celui que Caddy présentera ? */
function accordes(dossier, acces) {
  const [id, empreinte] = readFileSync(join(dossier, '.htpasswd'), 'utf8').trim().split(/:(.*)/s);
  const [, , sel] = empreinte.split('$');
  const [identifiant, mdp] = Buffer.from(acces, 'base64').toString().split(/:(.*)/s);
  const r = spawnSync('openssl', ['passwd', '-apr1', '-salt', sel, mdp], { encoding: 'utf8' });
  return id === 'invite' && identifiant === 'invite' && r.stdout.trim() === empreinte;
}

test('instances.sh : deux instances sur 127.0.0.1, base de test conservée, mots de passe internes accordés avec Caddy', { skip: skipExec }, () => {
  const d = dossiers();
  const r = lancerInstances(d);
  assert.equal(r.code, 0, r.out);

  const normal = env(join(d.normal, '.env'));
  assert.deepEqual(normal, { MAVERICK_CONTENEUR: 'maverick-center', MAVERICK_PORT: '127.0.0.1:8080' });
  const test_ = env(join(d.test, '.env'));
  assert.deepEqual(test_, { MAVERICK_CONTENEUR: 'maverick-center-test', MAVERICK_PORT: '127.0.0.1:8081', MAVERICK_BASE_TEST: 'conservee' });
  assert.ok(!existsSync(join(d.normal, 'site')) && !existsSync(join(d.test, 'site')), 'pas de site : un dossier avec site/ compterait comme une production');

  const caddy = env(join(d.caddy, 'maverick.env'));
  assert.equal(caddy.MAVERICK_DOMAINE, 'maverick-jdr.com');
  assert.ok(accordes(d.normal, caddy.MAVERICK_ACCES_NORMAL));
  assert.ok(accordes(d.test, caddy.MAVERICK_ACCES_TEST));
  assert.notEqual(caddy.MAVERICK_ACCES_NORMAL, caddy.MAVERICK_ACCES_TEST, 'un mot de passe par instance');
  assert.equal(statSync(join(d.caddy, 'maverick.env')).mode & 0o777, 0o600, 'mots de passe lisibles par root seulement');
  assert.equal(lireFichier(join(d.caddy, 'Caddyfile')), lire('Caddyfile'));
  assert.match(lireFichier(join(d.systemd, 'caddy.service.d', 'maverick.conf')), /EnvironmentFile=.*maverick\.env/);
  assert.ok(!r.out.includes(Buffer.from(caddy.MAVERICK_ACCES_NORMAL, 'base64').toString().split(':')[1]), 'aucun mot de passe affiché');

  // Relance : les accès sont conservés, le réglage de port est rétabli s'il a été changé, le domaine peut changer.
  writeFileSync(join(d.normal, '.env'), 'MAVERICK_CONTENEUR=maverick-center\nMAVERICK_PORT=8080\n');
  const r2 = lancerInstances(d, ['--domaine', 'exemple.org']);
  assert.equal(r2.code, 0, r2.out);
  const caddy2 = env(join(d.caddy, 'maverick.env'));
  assert.equal(caddy2.MAVERICK_ACCES_NORMAL, caddy.MAVERICK_ACCES_NORMAL);
  assert.equal(caddy2.MAVERICK_DOMAINE, 'exemple.org');
  assert.equal(env(join(d.normal, '.env')).MAVERICK_PORT, '127.0.0.1:8080', 'un port publié à tout le monde est refermé');

  // --regenerer-acces : de nouveaux mots de passe, toujours accordés entre nginx et Caddy.
  const r3 = lancerInstances(d, ['--regenerer-acces']);
  assert.equal(r3.code, 0, r3.out);
  const caddy3 = env(join(d.caddy, 'maverick.env'));
  assert.notEqual(caddy3.MAVERICK_ACCES_NORMAL, caddy.MAVERICK_ACCES_NORMAL);
  assert.ok(accordes(d.normal, caddy3.MAVERICK_ACCES_NORMAL) && accordes(d.test, caddy3.MAVERICK_ACCES_TEST));
});

test('instances.sh : domaine invalide ou Caddy absent refusés sans rien écrire', { skip: skipExec }, () => {
  const d = dossiers();
  const r = lancerInstances(d, ['--domaine', 'a b;rm']);
  assert.equal(r.code, 2, r.out);
  assert.ok(!existsSync(d.normal) && !existsSync(d.caddy));
  const sansCaddy = { bin: join(racine, 'bin-vide'), journal: join(racine, 'x.log') };
  mkdirSync(sansCaddy.bin, { recursive: true });
  const env2 = { PATH: `${sansCaddy.bin}:/usr/bin:/bin`, MAVERICK_ESSAI: '1', MAVERICK_DIR_NORMAL: d.normal, MAVERICK_DIR_TEST: d.test, MAVERICK_DIR_ETC_CADDY: d.caddy, MAVERICK_DIR_ETC_SYSTEMD: d.systemd };
  const r2 = spawnSync('/bin/bash', [join(vps, 'instances.sh')], { encoding: 'utf8', env: env2 });
  if (have('caddy')) return; // Caddy est installé sur cette machine : le refus ne peut pas être provoqué
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /outils\.sh/);
  assert.ok(!existsSync(d.normal));
});

function lireFichier(f) {
  return readFileSync(f, 'utf8');
}
