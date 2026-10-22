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
  for (const f of ['durcir.sh', 'outils.sh', 'instances.sh', 'volume.sh']) {
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
  // page d'où vient chaque appel /api/ (métriques, docs/serveur.md) : l'adresse n'est donnée qu'au site lui-même, et Caddy dit la même chose que nginx
  assert.match(c, /^\t\tReferrer-Policy "same-origin"$/m);
  assert.match(readFileSync(join(vps, '..', 'nginx.conf'), 'utf8'), /^ {4}add_header Referrer-Policy "same-origin" always;$/m);
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
  assert.match(d, /-f \/var\/run\/reboot-required/, 'un redémarrage demandé par les mises à jour est annoncé');
  assert.doesNotMatch(d, /^\s*(sudo )?(reboot|shutdown|systemctl reboot)\b/m, 'jamais de redémarrage fait par le script');
});

test('README : le pare-feu de l\'hébergeur doit laisser passer 80 et 443 (sinon pas de certificat)', () => {
  const avant = lire('README.md').split(/^## /m).find((s) => s.startsWith('Avant de commencer'));
  assert.match(avant, /Pare-feu de l'hébergeur/);
  assert.match(avant, /TCP pour les ports 80 et 443/);
  assert.match(lire('README.md'), /Timeout during connect \(likely firewall problem\)/, 'le symptôme vu dans le journal de Caddy est cité');
});

test('README, site de dev : instances.sh pose ce que l\'étape dit, et le jeton de la page Mise à jour se colle sans s\'afficher', () => {
  const section = lire('README.md').split(/^## /m).find((s) => s.startsWith('7. Site de dev'));
  assert.ok(section, 'étape « 7. Site de dev : mode modification et page Mise à jour » du README');
  assert.match(section, /Page Mise à jour/i, 'le titre que citent docs/flux-git.md et instances.sh (« Page Mise à jour »)');
  // ce que l'étape dit d'instances.sh est ce qu'il fait (le .env du test est épinglé plus bas, en l'exécutant)
  for (const reglage of ['MAVERICK_EDITION', 'MAVERICK_ADRESSE_PUBLIQUE']) {
    assert.match(section, new RegExp(reglage));
    assert.match(lire('instances.sh'), new RegExp(`poser "\\$TEST/\\.env" ${reglage} `), `instances.sh pose ${reglage} dans le .env du test`);
  }
  assert.match(section, /MISE_A_JOUR_TOKEN/);
  // Forme lancée telle quelle sous cmd.exe et PowerShell : ni « $ », ni « % », ni guillemet double à l'intérieur.
  const jeton = section.match(/^\s*(ssh -t .*github-actions-token.*)$/m)[1];
  assert.match(jeton, /^ssh -t -i \S+ ubuntu@<IP> "sudo sh -c 'umask 077; stty -echo; head -n 1 > \/srv\/maverick-center-test\/secrets\/github-actions-token; stty echo; chmod 600 /,
    'le jeton se colle sans s\'afficher, jamais en argument, dans le dossier secrets/ que monte le service');
  assert.doesNotMatch(jeton.slice(jeton.indexOf('"') + 1, jeton.lastIndexOf('"')), /[$%"]/);
  // le README décrit le fonctionnement tel qu'il est : plus de procédure « avant la 0.2.0 » (branche site)
  assert.doesNotMatch(lire('README.md'), /[Aa]vant la 0\.2\.0|update-site\.sh/);
});

test('docs de l\'hébergement : le fonctionnement tel qu\'il est, sans « à partir de / avant / jusqu\'à la X » (demande du propriétaire du 2026-10-22)', () => {
  const racineDepot = join(vps, '..', '..');
  for (const f of ['deploy/README.md', 'deploy/installateur/README.md', 'deploy/vps/README.md', 'docs/flux-git.md', 'README.md']) {
    const texte = readFileSync(join(racineDepot, f), 'utf8');
    assert.doesNotMatch(texte, /(?:à partir de|avant|jusqu'à|dès)(?: la)? (?:version )?\d+\.\d+(?:\.\d+)?\b/i, f);
  }
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
    // Le journal note aussi si les variables de maverick.env sont dans l'environnement de l'outil (jamais leur valeur).
    writeFileSync(join(bin, nom), `#!/bin/sh\necho "${nom} $* domaine=\${MAVERICK_DOMAINE:-absent} acces=\${MAVERICK_ACCES_TEST:+present}" >> "${journal}"\nexit 0\n`);
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
    MAVERICK_DIR_OUTILS: dossiers.outils,
  };
  const r = spawnSync('bash', [join(vps, 'instances.sh'), ...args], { encoding: 'utf8', env });
  return { code: r.status, out: r.stdout + r.stderr };
}
function dossiers() {
  const d = join(racine, `srv-${(n += 1)}`);
  return { normal: join(d, 'maverick-center'), test: join(d, 'maverick-center-test'), caddy: join(d, 'etc-caddy'), systemd: join(d, 'etc-systemd'),
    outils: join(d, 'usr-local-lib') };
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
  const metriques = join(d.normal, 'metriques');
  assert.deepEqual(normal, { MAVERICK_CONTENEUR: 'maverick-center', MAVERICK_PORT: '127.0.0.1:8080', MAVERICK_INSTANCE: 'prod', MAVERICK_DOSSIER_METRIQUES: metriques });
  const test_ = env(join(d.test, '.env'));
  assert.deepEqual(test_, { MAVERICK_CONTENEUR: 'maverick-center-test', MAVERICK_PORT: '127.0.0.1:8081', MAVERICK_BASE_TEST: 'conservee', MAVERICK_EDITION: '1',
    MAVERICK_ADRESSE_PUBLIQUE: 'https://dev.maverick-jdr.com', MAVERICK_DOSSIER_MAINTENANCE: join(d.normal, 'maintenance'),
    MAVERICK_INSTANCE: 'dev', MAVERICK_DOSSIER_METRIQUES: metriques });
  // métriques (docs/serveur.md, « Métriques et volume ») : un dossier partagé, celui du serveur normal, où chaque instance écrit SA base (prod.db,
  // dev.db : jamais mêlées) ; hors de db/ (l'installateur de test remplace le contenu de db/) ; écrit par le service, root dans son conteneur
  assert.ok(statSync(metriques).isDirectory());
  assert.equal(statSync(metriques).mode & 0o777, 0o755);
  assert.ok(!existsSync(join(d.test, 'metriques')), 'un seul dossier des métriques, celui du serveur normal');
  assert.notEqual(normal.MAVERICK_INSTANCE, test_.MAVERICK_INSTANCE, 'deux jeux de données séparés : un fichier par instance');
  assert.equal(statSync(join(d.test, 'secrets')).mode & 0o777, 0o700, 'dossier du jeton de la page Mise à jour, lisible par root seulement');
  // maintenance pendant une mise à jour : le serveur de test publie l'annonce dans le dossier du serveur normal, que les deux montent
  assert.ok(statSync(join(d.normal, 'maintenance')).isDirectory());
  assert.ok(!existsSync(join(d.test, 'maintenance')), 'un seul dossier d’annonce, celui du serveur normal');
  assert.ok(!existsSync(join(d.normal, 'secrets')), 'pas de jeton sur le serveur normal');
  assert.ok(!existsSync(join(d.normal, 'site')) && !existsSync(join(d.test, 'site')), 'pas de site : un dossier avec site/ compterait comme une production');

  const caddy = env(join(d.caddy, 'maverick.env'));
  assert.equal(caddy.MAVERICK_DOMAINE, 'maverick-jdr.com');
  assert.ok(accordes(d.normal, caddy.MAVERICK_ACCES_NORMAL));
  assert.ok(accordes(d.test, caddy.MAVERICK_ACCES_TEST));
  assert.notEqual(caddy.MAVERICK_ACCES_NORMAL, caddy.MAVERICK_ACCES_TEST, 'un mot de passe par instance');
  assert.equal(statSync(join(d.caddy, 'maverick.env')).mode & 0o777, 0o600, 'mots de passe lisibles par root seulement');
  assert.equal(lireFichier(join(d.caddy, 'Caddyfile')), lire('Caddyfile'));
  const unite = lireFichier(join(d.systemd, 'caddy.service.d', 'maverick.conf'));
  assert.match(unite, /EnvironmentFile=.*maverick\.env/);
  // L'unité des paquets Ubuntu lance « caddy run --environ », qui écrit l'environnement (donc les mots de passe) dans le journal.
  assert.match(unite, /^ExecStart=\nExecStart=\S*caddy run --config \S+Caddyfile$/m, 'ExecStart redéfini');
  assert.doesNotMatch(unite, /--environ/, 'jamais de mot de passe dans journalctl -u caddy');
  // Caddy 2.6 (paquets Ubuntu) n'a pas « validate --envfile » : les variables passent par l'environnement.
  const validation = lireFichier(join(racine, 'appels.log')).trim().split('\n').findLast((l) => l.startsWith('caddy validate'));
  assert.match(validation, /^caddy validate --config \S+Caddyfile --adapter caddyfile domaine=maverick-jdr\.com acces=present$/);
  assert.ok(!r.out.includes(Buffer.from(caddy.MAVERICK_ACCES_NORMAL, 'base64').toString().split(':')[1]), 'aucun mot de passe affiché');

  // Répartition du disque vue de l'hôte (jauge de la page Debug ; docs/serveur.md, « Jauge de l'espace disque ») : volume.sh copié tel quel,
  // lancé par un minuteur toutes les 15 minutes sur les deux instances, à basse priorité, et une première fois tout de suite.
  assert.equal(lireFichier(join(d.outils, 'volume.sh')), lire('volume.sh'));
  assert.equal(statSync(join(d.outils, 'volume.sh')).mode & 0o777, 0o755);
  const service = lireFichier(join(d.systemd, 'maverick-volume.service'));
  assert.ok(service.split('\n').includes(`ExecStart=/bin/bash ${join(d.outils, 'volume.sh')} ${d.normal} ${d.test}`), service);
  assert.match(service, /^Type=oneshot$/m);
  assert.match(service, /^Nice=19$/m);
  assert.match(service, /^IOSchedulingClass=idle$/m);
  assert.match(service, /^ProtectSystem=full$/m);
  const minuteur = lireFichier(join(d.systemd, 'maverick-volume.timer'));
  assert.match(minuteur, /^OnCalendar=\*:0\/15$/m);
  assert.match(minuteur, /^WantedBy=timers\.target$/m);
  const appels = lireFichier(join(racine, 'appels.log'));
  assert.match(appels, /^systemctl enable --now maverick-volume\.timer /m);
  assert.match(appels, /^systemctl start --no-block maverick-volume\.service /m);

  // Relance : les accès sont conservés, le réglage de port est rétabli s'il a été changé, le domaine peut changer ; les métriques écrites restent.
  writeFileSync(join(d.normal, '.env'), 'MAVERICK_CONTENEUR=maverick-center\nMAVERICK_PORT=8080\n');
  writeFileSync(join(metriques, 'prod.db'), 'mesures');
  const r2 = lancerInstances(d, ['--domaine', 'exemple.org']);
  assert.equal(r2.code, 0, r2.out);
  assert.equal(readFileSync(join(metriques, 'prod.db'), 'utf8'), 'mesures');
  assert.deepEqual(env(join(d.normal, '.env')), { MAVERICK_CONTENEUR: 'maverick-center', MAVERICK_PORT: '127.0.0.1:8080', MAVERICK_INSTANCE: 'prod',
    MAVERICK_DOSSIER_METRIQUES: metriques }, 'réglages des métriques reposés sans doublon');
  assert.deepEqual(env(join(d.test, '.env')), { ...test_, MAVERICK_ADRESSE_PUBLIQUE: 'https://dev.exemple.org' }, 'relancé, le .env du test ne change que par le domaine');
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
  const env2 = { PATH: `${sansCaddy.bin}:/usr/bin:/bin`, MAVERICK_ESSAI: '1', MAVERICK_DIR_NORMAL: d.normal, MAVERICK_DIR_TEST: d.test, MAVERICK_DIR_ETC_CADDY: d.caddy,
    MAVERICK_DIR_ETC_SYSTEMD: d.systemd, MAVERICK_DIR_OUTILS: d.outils };
  const r2 = spawnSync('/bin/bash', [join(vps, 'instances.sh')], { encoding: 'utf8', env: env2 });
  if (have('caddy')) return; // Caddy est installé sur cette machine : le refus ne peut pas être provoqué
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /outils\.sh/);
  assert.ok(!existsSync(d.normal));
});

function lireFichier(f) {
  return readFileSync(f, 'utf8');
}
