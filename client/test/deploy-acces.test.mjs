// Commande de l'hôte du mot de passe du site de dev (deploy/installateur/acces/acces.sh ; docs/serveur.md, « Accès au site de dev » ; R275) : exécutée pour de bon
// avec bash, dans une instance factice (un faux « docker » qui lance le vrai code du service sur l'hôte). Elle pose, change ou retire l'accès ; le mot de
// passe et la clé ne passent jamais par un argument ni un fichier ; le réglage est écrit en 600 ; la production est refusée ; l'installateur livre la commande
// sans toucher à secrets/. Les tests de bash se sautent sans bash ; ceux de l'installateur sans tar ni gzip.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { creerAcces, validerReglage } from '../serveur/acces.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/acces/acces.sh', import.meta.url));
const SERVEUR = fileURLToPath(new URL('../serveur', import.meta.url));
const outil = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const SANS_BASH = !outil('bash') && 'bash indisponible';
const SANS_TAR = !(outil('tar') && outil('gzip')) && 'tar ou gzip indisponible';
const MOT = 'un mot de passe d’essai';
const AUTRE = 'un autre mot de passe d’essai';
const sha = (x) => createHash('sha256').update(x).digest('hex');

/** Une instance de site de dev factice : son .env, la commande copiée où l'installateur la livre, un faux docker qui note ses arguments. */
function instance(t, { edition = true } = {}) {
  const racine = dossierTemporaire('acces-sh', { t });
  const dossier = join(racine, 'maverick-center-test');
  mkdirSync(join(dossier, 'acces'), { recursive: true });
  mkdirSync(join(racine, 'bin'));
  writeFileSync(join(dossier, '.env'), `MAVERICK_CONTENEUR=essai-test\nMAVERICK_PORT=8081\n${edition ? 'MAVERICK_EDITION=1\n' : ''}`);
  copyFileSync(SCRIPT, join(dossier, 'acces', 'acces.sh'));
  const journalDocker = join(racine, 'docker.log');
  writeFileSync(join(racine, 'bin', 'docker'), `#!/bin/sh
printf '%s\\n' "$*" >> '${journalDocker}'
case "$1" in
  inspect) [ "\${DOCKER_ARRETE:-0}" = 1 ] && echo false || echo true; exit 0 ;;
  exec)
    shift
    [ "$1" = -i ] && shift
    shift
    [ "$1" = test ] && exit 0
    [ "$1" = node ] || exit 1
    shift; shift
    [ "$1" = -e ] || exit 1
    script=$(printf '%s' "$2" | sed "s#/site/_serveur/serveur/#${SERVEUR}/#")
    shift 2
    exec node --disable-warning=ExperimentalWarning -e "$script" "$@" ;;
esac
exit 1
`);
  chmodSync(join(racine, 'bin', 'docker'), 0o755);
  const fichier = join(dossier, 'secrets', 'acces.json');
  const lancer = (args = [], { input = '', env = {} } = {}) => {
    const r = spawnSync('bash', [join(dossier, 'acces', 'acces.sh'), ...args], {
      encoding: 'utf8', input, timeout: 60_000,
      env: { PATH: `${join(racine, 'bin')}:${process.env.PATH}`, HOME: racine, LANG: 'C.UTF-8', ...variablesTemporaires(racine), MAVERICK_ESSAI: '1', MAVERICK_ACCES_FICHIER: fichier, ...env },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}`, sortie: r.stdout, erreur: r.stderr };
  };
  const reglage = () => JSON.parse(readFileSync(fichier, 'utf8'));
  const appels = () => (existsSync(journalDocker) ? readFileSync(journalDocker, 'utf8') : '');
  const cleAffichee = (out) => /(mvk_[A-Za-z0-9_-]{43})/.exec(out)?.[1] ?? null;
  return { racine, dossier, fichier, lancer, reglage, appels, cleAffichee };
}
const mode = (chemin) => statSync(chemin).mode & 0o777;
const saisie = (mot, confirmation = mot) => `${mot}\n${confirmation}\n`;

test('la production est refusée : pas de MAVERICK_EDITION=1 dans le .env, rien n’est créé ni demandé au conteneur', { skip: SANS_BASH }, (t) => {
  const i = instance(t, { edition: false });
  const r = i.lancer([], { input: saisie(MOT) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /n'est pas le site de dev/);
  assert.ok(!existsSync(join(i.dossier, 'secrets')), 'aucun dossier secrets/ créé');
  assert.equal(i.appels(), '', 'aucun appel à docker');
  for (const args of [['--retirer'], ['--cle'], ['--portee', 'tout'], ['--etat']]) assert.equal(i.lancer(args).code, 1, args.join(' '));
});

test('première pose : mot de passe deux fois, réglage en 600 sans aucun secret en clair, clé de lecture affichée une seule fois, mot de passe jamais en argument', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const r = i.lancer([], { input: saisie(MOT) });
  assert.equal(r.code, 0, r.out);
  assert.equal(mode(i.fichier), 0o600);
  assert.equal(mode(join(i.dossier, 'secrets')), 0o700);
  const cle = i.cleAffichee(r.out);
  assert.ok(cle, r.out);
  assert.equal(r.out.split(cle).length, 2, 'la clé s’affiche une fois');
  const texte = readFileSync(i.fichier, 'utf8');
  assert.ok(!texte.includes(MOT) && !texte.includes(cle), 'ni le mot de passe ni la clé dans le fichier');
  const reglage = validerReglage(JSON.parse(texte));
  assert.equal(reglage.cle_de_lecture.empreinte, sha(cle));
  assert.equal(reglage.portee, 'ecriture', 'option b par défaut');
  // le service le lit tel quel : le mot de passe ouvre une session, la clé ne donne que la lecture
  const acces = creerAcces({ fichier: i.fichier });
  assert.equal(acces.protege(), true);
  assert.equal(acces.connecter(MOT, {}).ok, true);
  assert.equal(acces.droit({ 'x-maverick-cle': cle }).droit, 'lecture');
  // rien de secret dans ce que docker a reçu (arguments), ni à l'écran
  assert.ok(!i.appels().includes(MOT) && !i.appels().includes(cle) && !r.out.includes(MOT), 'aucun secret en argument ni à l’écran');
  assert.match(i.appels(), /exec -i essai-test-serveur node/);
  assert.match(r.out, /Rien à redémarrer/);
});

test('changer le mot de passe : l’ancien ne passe plus, les sessions tombent, la clé de lecture est gardée et n’est pas réaffichée ; --cle en fait une autre', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const premiere = i.lancer([], { input: saisie(MOT) });
  const avant = i.reglage();
  const cle = i.cleAffichee(premiere.out);
  const session = creerAcces({ fichier: i.fichier }).connecter(MOT, {});

  const r = i.lancer([], { input: saisie(AUTRE) });
  assert.equal(r.code, 0, r.out);
  assert.equal(i.cleAffichee(r.out), null, 'pas de nouvelle clé');
  assert.match(r.out, /clé de lecture est inchangée/);
  const apres = i.reglage();
  assert.deepEqual(apres.cle_de_lecture, avant.cle_de_lecture);
  assert.notEqual(apres.secret_de_session, avant.secret_de_session);
  const acces = creerAcces({ fichier: i.fichier });
  assert.equal(acces.connecter(MOT, {}).ok, false);
  assert.equal(acces.connecter(AUTRE, {}).ok, true);
  assert.equal(acces.droit({ cookie: `maverick_acces=${session.jeton}` }).droit, 'aucun', 'la session d’avant est fermée');
  assert.equal(acces.droit({ 'x-maverick-cle': cle }).droit, 'lecture');

  const refaite = i.lancer(['--cle']);
  assert.equal(refaite.code, 0, refaite.out);
  const neuve = i.cleAffichee(refaite.out);
  assert.ok(neuve && neuve !== cle);
  assert.equal(i.reglage().cle_de_lecture.empreinte, sha(neuve));
  assert.deepEqual(i.reglage().mot_de_passe, apres.mot_de_passe, 'le mot de passe est resté');
  assert.equal(creerAcces({ fichier: i.fichier }).droit({ 'x-maverick-cle': cle }).droit, 'aucun', 'l’ancienne clé ne marche plus');
});

test('les espaces d’un mot de passe sont gardés tels quels (début, fin, doubles) : la saisie n’est pas rognée par le shell', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const mot = '  un mot  de passe avec espaces  ';
  const r = i.lancer([], { input: saisie(mot) });
  assert.equal(r.code, 0, r.out);
  const acces = creerAcces({ fichier: i.fichier });
  assert.equal(acces.connecter(mot.trim(), {}).ok, false);
  assert.equal(acces.connecter(mot, {}).ok, true);
});

test('refus sans rien modifier : deux saisies différentes, mot de passe trop court, conteneur arrêté, portée inconnue, option inconnue', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const diff = i.lancer([], { input: saisie(MOT, AUTRE) });
  assert.equal(diff.code, 1);
  assert.match(diff.out, /diffèrent/);
  const court = i.lancer([], { input: saisie('court') });
  assert.equal(court.code, 1);
  assert.match(court.out, /trop court/);
  assert.ok(!court.out.includes('court\n'), 'le message ne répète pas la saisie');
  assert.ok(!existsSync(i.fichier), 'rien n’est écrit');
  const arrete = i.lancer([], { input: saisie(MOT), env: { DOCKER_ARRETE: '1' } });
  assert.equal(arrete.code, 1);
  assert.match(arrete.out, /ne tourne pas/);
  assert.ok(!existsSync(i.fichier));
  assert.equal(i.lancer(['--portee', 'partout']).code, 2);
  assert.equal(i.lancer(['--inconnue']).code, 2);
  assert.equal(i.lancer(['--cle']).code, 1, 'refaire la clé suppose un mot de passe posé');
  assert.ok(!existsSync(i.fichier));
});

test('--portee tout est le même réglage (même mot de passe, une seule saisie) ; les sessions sont refaites ; --etat le dit sans montrer de secret ; --retirer rouvre le site', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  assert.match(i.lancer(['--etat']).out, /non protégé/);
  i.lancer([], { input: saisie(MOT) });
  const avant = i.reglage();
  assert.match(i.lancer(['--etat']).out, /protégé\. Portée : ecriture.*Clé de lecture : oui/);

  const r = i.lancer(['--portee', 'tout']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\/api\/acces\/verifier\//, 'la commande dit ce que Caddy doit faire pour fermer les pages');
  const apres = i.reglage();
  assert.equal(apres.portee, 'tout');
  assert.deepEqual(apres.mot_de_passe, avant.mot_de_passe);
  assert.deepEqual(apres.cle_de_lecture, avant.cle_de_lecture);
  assert.notEqual(apres.secret_de_session, avant.secret_de_session);
  assert.equal(creerAcces({ fichier: i.fichier }).connecter(MOT, {}).ok, true);
  assert.match(i.lancer(['--etat']).out, /Portée : tout/);
  assert.equal(mode(i.fichier), 0o600);

  const retire = i.lancer(['--retirer']);
  assert.equal(retire.code, 0, retire.out);
  assert.ok(!existsSync(i.fichier));
  assert.equal(creerAcces({ fichier: i.fichier }).protege(), false, 'le site est de nouveau ouvert, comme avant');
  assert.match(i.lancer(['--retirer']).out, /déjà ouvert/);
  // pas d'enfermement dehors : un mot de passe perdu se remplace sans connaître l'ancien
  i.lancer([], { input: saisie(MOT) });
  assert.equal(i.lancer([], { input: saisie(AUTRE) }).code, 0);
});

test('la clé de lecture ne s’affiche que sur un terminal : hors terminal (sans MAVERICK_ESSAI) la commande refuse avant d’écrire', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const r = i.lancer([], { input: saisie(MOT), env: { MAVERICK_ESSAI: '0' } });
  assert.equal(r.code, 1);
  assert.match(r.out, /à lancer en root|terminal/);
  assert.ok(!existsSync(i.fichier));
});

test('l’installateur livre acces/acces.sh (exécutable, remplacé à chaque installation) sans jamais toucher à secrets/', { skip: SANS_TAR }, (t) => {
  const racine = dossierTemporaire('acces-installateur', { t });
  const site = join(racine, 'site');
  mkdirSync(site);
  writeFileSync(join(site, 'index.html'), '<h1>essai</h1>');
  const livraison = fabriquer({ mode: 'test', site, tag: 'v0.2.1', version: '0.2.1', sha: 'a'.repeat(40), sortie: join(racine, 'sortie') });
  const dossier = join(racine, 'instance');
  const installer = () => spawnSync('sh', [livraison.fichier, '--dossier', dossier], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(installer().status, 0);
  const livre = join(dossier, 'acces', 'acces.sh');
  assert.equal(readFileSync(livre, 'utf8'), readFileSync(SCRIPT, 'utf8'));
  assert.equal(mode(livre), 0o755);
  // une installation suivante : le réglage posé entre-temps reste intact, la commande est remplacée
  mkdirSync(join(dossier, 'secrets'), { recursive: true });
  writeFileSync(join(dossier, 'secrets', 'acces.json'), '{"essai":true}\n', { mode: 0o600 });
  writeFileSync(livre, '# ancienne version\n');
  assert.equal(installer().status, 0);
  assert.equal(readFileSync(join(dossier, 'secrets', 'acces.json'), 'utf8'), '{"essai":true}\n');
  assert.equal(readFileSync(livre, 'utf8'), readFileSync(SCRIPT, 'utf8'));
});
