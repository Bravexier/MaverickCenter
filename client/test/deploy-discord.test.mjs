// Commande de l'hôte de la connexion par Discord (deploy/installateur/discord/discord.sh ; docs/serveur.md, « Connexion par Discord » ; R310) : exécutée pour de bon avec bash, dans une
// instance factice (un faux « docker » qui lance le vrai code du service sur l'hôte), sur le site de dev comme sur la production. Elle pose l'application Discord (identifiant, secret saisi
// sans écho, adresse de retour proposée d'après le domaine), la correspondance « rôle Discord -> niveau », le serveur, une nouvelle session ; elle montre l'état sans le secret ou retire
// le réglage ; le secret ne passe jamais par un argument, le fichier est écrit en 600, et l'installateur la livre (test deploy-acces).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { creerConnexion, validerReglage } from '../serveur/discord.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';
import { SEUL_LINUX } from './aide-plateforme.mjs';
import { CLIENT_D_ESSAI, ROLE_CREATEUR, ROLE_JOUEUR, ROLE_MJ, SECRET_D_ESSAI } from './aide-acces-d-essai.mjs';

const SCRIPT_DISCORD = fileURLToPath(new URL('../../deploy/installateur/discord/discord.sh', import.meta.url));
const SERVEUR = fileURLToPath(new URL('../serveur', import.meta.url));
const outil = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const SANS_BASH = !outil('bash') && 'bash indisponible';
const RETOUR = '/api/connexion/discord/retour/';
/** La saisie : identifiant, secret, adresse de retour (vide : celle qui est proposée). */
const saisie = (identifiant = CLIENT_D_ESSAI, secret = SECRET_D_ESSAI, adresse = '') => `${identifiant}\n${secret}\n${adresse}\n`;

/** Une instance factice (site de dev ou production) : son .env, la commande copiée où l'installateur la livre, un faux docker qui note ses arguments. */
function instance(t, { edition = true, adresse = edition ? 'https://dev.exemple.test' : null, domaine = null } = {}) {
  const racine = dossierTemporaire('acces-sh', { t });
  const dossier = join(racine, 'maverick-center-test');
  mkdirSync(join(dossier, 'discord'), { recursive: true });
  mkdirSync(join(racine, 'bin'));
  writeFileSync(join(dossier, '.env'), `MAVERICK_CONTENEUR=essai-test\nMAVERICK_PORT=8081\n${edition ? 'MAVERICK_EDITION=1\n' : ''}${adresse ? `MAVERICK_ADRESSE_PUBLIQUE=${adresse}\n` : ''}`);
  const caddy = join(racine, 'maverick.env');
  if (domaine) writeFileSync(caddy, `MAVERICK_DOMAINE=${domaine}\nMAVERICK_ACCES_TEST=aaaa\n`);
  copyFileSync(SCRIPT_DISCORD, join(dossier, 'discord', 'discord.sh'));
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
  const fichier = join(dossier, 'secrets', 'discord.json');
  const lancer = (args = [], { input = '', env = {} } = {}) => {
    const r = spawnSync('bash', [join(dossier, 'discord', 'discord.sh'), ...args], {
      encoding: 'utf8', input, timeout: 60_000,
      env: { PATH: `${join(racine, 'bin')}:${process.env.PATH}`, HOME: racine, LANG: 'C.UTF-8', ...variablesTemporaires(racine), MAVERICK_ESSAI: '1', MAVERICK_DISCORD_FICHIER: fichier, MAVERICK_DISCORD_CADDY: caddy, ...env },
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}`, sortie: r.stdout, erreur: r.stderr };
  };
  const reglage = () => JSON.parse(readFileSync(fichier, 'utf8'));
  const appels = () => (existsSync(journalDocker) ? readFileSync(journalDocker, 'utf8') : '');
  return { racine, dossier, fichier, lancer, reglage, appels };
}

const mode = (chemin) => statSync(chemin).mode & 0o777;

test('première pose sur le site de dev : identifiant et secret saisis, adresse proposée d’après le domaine ; réglage en 600, secret jamais en argument ni à l’écran ; le service le lit tel quel', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  const r = i.lancer([], { input: saisie() });
  assert.equal(r.code, 0, r.out);
  assert.equal(mode(i.fichier), 0o600);
  assert.equal(mode(join(i.dossier, 'secrets')), 0o700);
  const reglage = validerReglage(i.reglage());
  assert.deepEqual([reglage.client_id, reglage.client_secret, reglage.serveur, reglage.roles], [CLIENT_D_ESSAI, SECRET_D_ESSAI, '374464159254839298', {}]);
  assert.equal(reglage.adresse_de_retour, `https://dev.exemple.test${RETOUR}`, 'proposée d’après MAVERICK_ADRESSE_PUBLIQUE du .env de l’instance');
  assert.match(reglage.secret_de_session, /^[0-9a-f]{64}$/);
  // ce que l'hôte doit faire dans le portail Discord est dit, avec l'adresse exacte
  assert.match(r.out, /portail développeur Discord/);
  assert.ok(r.out.includes(`https://dev.exemple.test${RETOUR}`));
  assert.ok(!r.out.includes(SECRET_D_ESSAI), 'le secret ne s’affiche jamais');
  assert.ok(!i.appels().includes(SECRET_D_ESSAI), 'le secret ne passe jamais en argument');
  assert.match(i.appels(), /exec -i essai-test-serveur node/);
  assert.match(r.out, /Rien à redémarrer/);
  // le service le lit tel quel
  const c = creerConnexion({ fichier: i.fichier, journal: () => {} });
  assert.equal(c.disponible(), true);
  assert.match(c.commencer({}).location, new RegExp(`client_id=${CLIENT_D_ESSAI}`));
  // repose (autre secret) : rôles et sessions gardés
  i.lancer(['--role', ROLE_MJ, 'mj']);
  const avant = i.reglage();
  const repose = i.lancer([], { input: saisie(CLIENT_D_ESSAI, 'un-autre-secret-valable') });
  assert.equal(repose.code, 0, repose.out);
  assert.equal(i.reglage().client_secret, 'un-autre-secret-valable');
  assert.deepEqual(i.reglage().roles, { [ROLE_MJ]: 'mj' });
  assert.equal(i.reglage().secret_de_session, avant.secret_de_session);
});

test('l’adresse de retour : proposée d’après le domaine de l’instance (production : https://<domaine>, site de dev : https://dev.<domaine>), acceptée par Entrée, remplaçable à la saisie ou par --adresse ; sans domaine, demandée', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  // la production : pas d'adresse publique dans son .env, le domaine vient du fichier d'environnement de Caddy
  const prod = instance(t, { edition: false, domaine: 'maverick-jdr.com' });
  const r = prod.lancer([], { input: saisie() });
  assert.equal(r.code, 0, r.out);
  assert.equal(prod.reglage().adresse_de_retour, `https://maverick-jdr.com${RETOUR}`);
  assert.match(r.out, /la production/);
  // le site de dev sans adresse publique dans son .env : https://dev.<domaine>
  const dev = instance(t, { adresse: null, domaine: 'maverick-jdr.com' });
  dev.lancer([], { input: saisie() });
  assert.equal(dev.reglage().adresse_de_retour, `https://dev.maverick-jdr.com${RETOUR}`);
  // une autre adresse tapée à la place de la proposition
  const autre = instance(t);
  autre.lancer([], { input: saisie(CLIENT_D_ESSAI, SECRET_D_ESSAI, `https://autre.exemple.test${RETOUR}`) });
  assert.equal(autre.reglage().adresse_de_retour, `https://autre.exemple.test${RETOUR}`);
  // --adresse : sans question
  const direct = instance(t);
  const d = direct.lancer(['--adresse', `https://direct.exemple.test${RETOUR}`], { input: `${CLIENT_D_ESSAI}\n${SECRET_D_ESSAI}\n` });
  assert.equal(d.code, 0, d.out);
  assert.equal(direct.reglage().adresse_de_retour, `https://direct.exemple.test${RETOUR}`);
  // aucun domaine connu : l'adresse se demande ; une adresse vide ou en http est refusée, rien n'est écrit
  const sans = instance(t, { adresse: null });
  const vide = sans.lancer([], { input: saisie() });
  assert.equal(vide.code, 1, vide.out);
  assert.match(vide.out, /aucune adresse de retour/);
  const http = sans.lancer([], { input: saisie(CLIENT_D_ESSAI, SECRET_D_ESSAI, 'http://exemple.test/retour/') });
  assert.equal(http.code, 1, http.out);
  assert.match(http.out, /adresse de retour/);
  assert.ok(!existsSync(sans.fichier), 'rien n’est écrit');
});

test('refus sans rien modifier : identifiant qui n’est pas un nombre, secret vide, conteneur arrêté, option inconnue ou incomplète, rôle ou niveau invalide', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const mauvaisId = i.lancer([], { input: saisie('abc') });
  assert.equal(mauvaisId.code, 1);
  assert.match(mauvaisId.out, /que des chiffres/);
  const vide = i.lancer([], { input: saisie(CLIENT_D_ESSAI, '') });
  assert.equal(vide.code, 1);
  assert.match(vide.out, /secret est vide/);
  const arrete = i.lancer([], { input: saisie(), env: { DOCKER_ARRETE: '1' } });
  assert.equal(arrete.code, 1);
  assert.match(arrete.out, /ne tourne pas/);
  assert.ok(!existsSync(i.fichier), 'rien n’est écrit');
  for (const args of [['--inconnue'], ['--role'], ['--role', ROLE_MJ], ['--role', 'pas-un-id', 'mj'], ['--role', ROLE_MJ, 'dieu'], ['--role', ROLE_MJ, 'observateur'], ['--role', ROLE_MJ, 'x', 'joueur'], ['--role', 'joueur'], ['--sans-role'], ['--serveur', 'x'], ['--adresse']]) {
    assert.equal(i.lancer(args).code, 2, args.join(' '));
  }
  // rien à modifier sans application posée
  for (const args of [['--role', ROLE_MJ, 'mj'], ['--role', ROLE_JOUEUR, ROLE_MJ, 'joueur'], ['--sans-role', ROLE_MJ], ['--serveur', '123456789012345678'], ['--nouvelle-session']]) {
    const r = i.lancer(args);
    assert.equal(r.code, 1, args.join(' '));
    assert.match(r.out, /aucune application/);
  }
  assert.ok(!existsSync(i.fichier));
});

test('R310 (2), R311 : --role pose la correspondance « rôle Discord -> niveau » (joueur, mj, createur ; un ou plusieurs rôles à la fois) dans le réglage de l’instance (jamais dans le code), --sans-role la retire, --serveur change le serveur, --nouvelle-session ferme les sessions', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  const pose = i.lancer([], { input: saisie() });
  assert.doesNotMatch(pose.out, /tout membre du serveur est Joueur/, 'R311 : un membre sans rôle est Observateur');
  assert.match(pose.out, /R311/);
  const base = i.reglage();
  assert.deepEqual(base.roles, {});
  assert.equal(i.lancer(['--role', ROLE_MJ, 'mj']).code, 0);
  const r = i.lancer(['--role', ROLE_CREATEUR, 'createur']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(i.reglage().roles, { [ROLE_MJ]: 'mj', [ROLE_CREATEUR]: 'createur' });
  // plusieurs identifiants d'un coup (les neuf rôles Joueur du propriétaire, R311)
  const neuf = Array.from({ length: 9 }, (_, n) => `70000000000000000${n}`);
  const joueurs = i.lancer(['--role', ...neuf, 'joueur']);
  assert.equal(joueurs.code, 0, joueurs.out);
  for (const id of neuf) assert.equal(i.reglage().roles[id], 'joueur', id);
  assert.equal(Object.keys(i.reglage().roles).length, 11);
  assert.equal(i.reglage().secret_de_session, base.secret_de_session, 'poser un rôle ne ferme aucune session');
  assert.equal(mode(i.fichier), 0o600);
  // un niveau change : le même rôle repasse de joueur à mj
  assert.equal(i.lancer(['--role', neuf[0], 'mj']).code, 0);
  assert.equal(i.reglage().roles[neuf[0]], 'mj');
  assert.equal(i.lancer(['--sans-role', ROLE_MJ]).code, 0);
  assert.equal(i.reglage().roles[ROLE_MJ], undefined);
  assert.match(i.lancer(['--sans-role', ROLE_MJ]).out, /aucun niveau/);
  assert.equal(i.lancer(['--serveur', '123456789012345678']).code, 0);
  assert.equal(i.reglage().serveur, '123456789012345678');
  const session = i.lancer(['--nouvelle-session']);
  assert.equal(session.code, 0, session.out);
  assert.notEqual(i.reglage().secret_de_session, base.secret_de_session);
  assert.equal(i.reglage().roles[ROLE_CREATEUR], 'createur');
  assert.match(session.out, /sessions .* fermées/);
  assert.ok(!i.appels().includes(SECRET_D_ESSAI));
  // un identifiant refusé par le service ne pose aucun des autres (« 12 » n'est pas un identifiant de rôle)
  const avant = JSON.stringify(i.reglage());
  const refuse = i.lancer(['--role', '700000000000000099', '12', 'joueur']);
  assert.equal(refuse.code, 1, refuse.out);
  assert.equal(JSON.stringify(i.reglage()), avant, 'rien n’est posé');
});

test('--etat dit ce qui est réglé sans jamais montrer le secret ni celui des sessions ; --retirer retire le réglage (connexion indisponible) ; sur la production comme sur le site de dev', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  for (const edition of [true, false]) {
    const i = instance(t, { edition, domaine: 'maverick-jdr.com' });
    const vide = i.lancer(['--etat']);
    assert.match(vide.out, /non réglée/);
    assert.match(vide.out, edition ? /fermé à tous/ : /reste ouvert/);
    i.lancer([], { input: saisie() });
    i.lancer(['--role', ROLE_MJ, 'mj']);
    const etat = i.lancer(['--etat']);
    assert.equal(etat.code, 0);
    assert.ok(etat.out.includes(`Application : ${CLIENT_D_ESSAI}`), etat.out);
    assert.ok(etat.out.includes('374464159254839298') && etat.out.includes(RETOUR), etat.out);
    assert.ok(etat.out.includes(`MJ : ${ROLE_MJ} (1)`), etat.out);
    assert.ok(etat.out.includes('Joueur : aucun (0)') && etat.out.includes('Créateur : aucun (0)'), etat.out);
    assert.match(etat.out, /sans aucun de ces rôles est Observateur \(R311\)/);
    i.lancer(['--role', ROLE_JOUEUR, '700000000000000001', 'joueur']);
    assert.ok(i.lancer(['--etat']).out.includes(`Joueur : ${ROLE_JOUEUR} 700000000000000001 (2)`), i.lancer(['--etat']).out);
    assert.ok(!etat.out.includes(SECRET_D_ESSAI) && !etat.out.includes(i.reglage().secret_de_session), 'aucun secret dans l’état');
    assert.match(etat.out, edition ? /le site de dev/ : /la production/);
    const retire = i.lancer(['--retirer']);
    assert.equal(retire.code, 0, retire.out);
    assert.ok(!existsSync(i.fichier));
    assert.equal(creerConnexion({ fichier: i.fichier, journal: () => {} }).disponible(), false);
    assert.match(i.lancer(['--retirer']).out, /rien à retirer/);
  }
});

test('le secret se saisit sur un terminal : hors terminal (sans MAVERICK_ESSAI) la commande refuse avant d’écrire', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const r = i.lancer([], { input: saisie(), env: { MAVERICK_ESSAI: '0' } });
  assert.equal(r.code, 1);
  assert.match(r.out, /à lancer en root|terminal/);
  assert.ok(!existsSync(i.fichier));
});

test('R314 : --bot pose le jeton du bot saisi sur l’entrée (jamais à l’écran ni en argument) dans le réglage, et montre l’adresse d’invitation avec le vrai identifiant de l’application ; --etat dit « posé » sans le montrer ; --sans-bot le retire ; un jeton vide ou invalide ne change rien', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const JETON = 'jeton-du-bot-d-essai-pour-discord-sh-0123456789';
  const i = instance(t);
  // sans application posée, rien à faire
  const sans = i.lancer(['--bot'], { input: `${JETON}\n` });
  assert.equal(sans.code, 1, sans.out);
  assert.ok(!existsSync(i.fichier), 'rien n’est écrit');
  i.lancer([], { input: saisie() });
  const avant = i.reglage();
  assert.equal(avant.jeton_du_bot, undefined);
  assert.match(i.lancer(['--etat']).out, /Bot de revérification : non posé/);
  // jeton vide ou invalide : refus, réglage identique
  for (const entree of ['\n', 'trop court\n', `${JETON} avec espace\n`]) {
    const r = i.lancer(['--bot'], { input: entree });
    assert.equal(r.code, 1, r.out);
    assert.deepEqual(i.reglage(), avant, 'rien n’est modifié');
  }
  // pose
  const r = i.lancer(['--bot'], { input: `${JETON}\n` });
  assert.equal(r.code, 0, r.out);
  assert.equal(i.reglage().jeton_du_bot, JETON);
  assert.equal(mode(i.fichier), 0o600);
  assert.equal(i.reglage().secret_de_session, avant.secret_de_session, 'poser le bot ne ferme aucune session');
  assert.equal(i.reglage().client_secret, SECRET_D_ESSAI, 'le reste du réglage est gardé');
  assert.ok(!r.out.includes(JETON), 'le jeton ne s’affiche jamais');
  assert.ok(!i.appels().includes(JETON), 'le jeton ne passe jamais en argument');
  assert.ok(r.out.includes(`https://discord.com/oauth2/authorize?client_id=${CLIENT_D_ESSAI}&scope=bot&permissions=0`), r.out);
  assert.match(r.out, /Rien à redémarrer/);
  assert.equal(validerReglage(i.reglage()).jeton_du_bot, JETON, 'le service le lit tel quel');
  // état : posé, jamais montré
  const etat = i.lancer(['--etat']);
  assert.equal(etat.code, 0);
  assert.match(etat.out, /Bot de revérification : posé/);
  assert.ok(!etat.out.includes(JETON) && !etat.out.includes(SECRET_D_ESSAI), 'aucun secret dans l’état');
  // une repose de l'application et un rôle gardent le jeton
  i.lancer(['--role', ROLE_MJ, 'mj']);
  assert.equal(i.reglage().jeton_du_bot, JETON);
  // retrait
  const retire = i.lancer(['--sans-bot']);
  assert.equal(retire.code, 0, retire.out);
  assert.equal(i.reglage().jeton_du_bot, undefined);
  assert.equal(i.reglage().client_id, CLIENT_D_ESSAI);
  assert.match(i.lancer(['--etat']).out, /Bot de revérification : non posé/);
  assert.notEqual(i.lancer(['--sans-bot']).code, 0, 'rien à retirer');
});
