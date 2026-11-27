// Commande de l'hôte des clés du site de dev (deploy/installateur/acces/acces.sh ; docs/serveur.md, « Accès au site de dev » ; R275, R291, R310) : exécutée pour de bon avec bash, dans une
// instance factice (un faux « docker » qui lance le vrai code du service sur l'hôte). Elle pose, refait ou retire les clés de lecture et de dépôt ; les clés ne passent jamais par un
// argument ni un fichier en clair ; le réglage est écrit en 600 ; la production est refusée ; l'installateur livre la commande sans toucher à secrets/. Le mot de passe est retiré
// (R310) : un fichier d'avant qui en porte encore un reste lisible. Les tests de bash se sautent sans bash ; ceux de l'installateur sans tar ni gzip.
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
import { SEUL_LINUX } from './aide-plateforme.mjs';

const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/acces/acces.sh', import.meta.url));
const SCRIPT_DISCORD = fileURLToPath(new URL('../../deploy/installateur/discord/discord.sh', import.meta.url));
const SERVEUR = fileURLToPath(new URL('../serveur', import.meta.url));
const outil = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const SANS_BASH = !outil('bash') && 'bash indisponible';
const SANS_TAR = !(outil('tar') && outil('gzip')) && 'tar ou gzip indisponible';
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
const cleDeDepotAffichee = (out) => /(mvd_[A-Za-z0-9_-]{43})/.exec(out)?.[1] ?? null;

test('la production est refusée : pas de MAVERICK_EDITION=1 dans le .env, rien n’est créé ni demandé au conteneur', { skip: SANS_BASH }, (t) => {
  const i = instance(t, { edition: false });
  const r = i.lancer(['--cle']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /n'est pas le site de dev/);
  assert.ok(!existsSync(join(i.dossier, 'secrets')), 'aucun dossier secrets/ créé');
  assert.equal(i.appels(), '', 'aucun appel à docker');
  for (const args of [['--retirer'], ['--cle-de-depot'], ['--sans-cle-de-depot'], ['--etat']]) assert.equal(i.lancer(args).code, 1, args.join(' '));
});

test('première pose : la clé de lecture s’affiche une seule fois, le réglage est en 600 sans aucune clé en clair, rien en argument ; le service le lit tel quel : la clé lit, jamais plus', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  const r = i.lancer(['--cle']);
  assert.equal(r.code, 0, r.out);
  assert.equal(mode(i.fichier), 0o600);
  assert.equal(mode(join(i.dossier, 'secrets')), 0o700);
  const cle = i.cleAffichee(r.out);
  assert.ok(cle, r.out);
  assert.equal(r.out.split(cle).length, 2, 'la clé s’affiche une fois');
  const texte = readFileSync(i.fichier, 'utf8');
  assert.ok(!texte.includes(cle), 'pas de clé dans le fichier');
  const reglage = validerReglage(JSON.parse(texte));
  assert.equal(reglage.cle_de_lecture.empreinte, sha(cle));
  assert.equal(reglage.cle_de_depot, null, 'pas de clé de dépôt tant qu’on ne la demande pas : le dépôt reste une proposition');
  assert.deepEqual(Object.keys(JSON.parse(texte)).sort(), ['cle_de_depot', 'cle_de_lecture', 'pose_le', 'version'], 'ni mot de passe ni portée ni secret de session');
  const acces = creerAcces({ fichier: i.fichier });
  assert.equal(acces.droit({ 'x-maverick-cle': cle }).droit, 'lecture');
  assert.equal(acces.controler({ methode: 'POST', chemin: '/api/edition/', entetes: { 'x-maverick-cle': cle } }).statut, 403);
  assert.ok(!i.appels().includes(cle), 'aucun secret en argument ni à l’écran');
  assert.match(i.appels(), /exec -i essai-test-serveur node/);
  assert.match(r.out, /sessions de Claude/);
  assert.doesNotMatch(r.out, /mot de passe/i, 'plus un mot de mot de passe');
});

test('refaire la clé : l’ancienne ne marche plus, la clé de dépôt posée est gardée ; refus sans rien modifier : sans option, option inconnue, retirée (--portee, mot de passe), conteneur arrêté', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  const premiere = i.lancer(['--cle']);
  const cle = i.cleAffichee(premiere.out);
  const depot = i.lancer(['--cle-de-depot']);
  const cleDeDepot = cleDeDepotAffichee(depot.out);
  const avant = i.reglage();
  const refaite = i.lancer(['--cle']);
  assert.equal(refaite.code, 0, refaite.out);
  const neuve = i.cleAffichee(refaite.out);
  assert.ok(neuve && neuve !== cle);
  assert.equal(i.reglage().cle_de_lecture.empreinte, sha(neuve));
  assert.deepEqual(i.reglage().cle_de_depot, avant.cle_de_depot, 'la clé de dépôt est restée');
  const acces = creerAcces({ fichier: i.fichier });
  assert.equal(acces.droit({ 'x-maverick-cle': cle }).droit, 'aucun', 'l’ancienne clé ne marche plus');
  assert.equal(acces.droit({ 'x-maverick-cle': cleDeDepot }).droit, 'depot');
  // les refus ne modifient rien
  const intact = readFileSync(i.fichier, 'utf8');
  assert.equal(i.lancer([]).code, 2, 'sans option : le mode d’emploi');
  assert.match(i.lancer([]).out, /Usage/);
  for (const args of [['--inconnue'], ['--portee', 'tout'], ['--portee', 'partout'], ['--mot-de-passe']]) assert.equal(i.lancer(args).code, 2, args.join(' '));
  const arrete = i.lancer(['--cle'], { env: { DOCKER_ARRETE: '1' } });
  assert.equal(arrete.code, 1);
  assert.match(arrete.out, /ne tourne pas/);
  assert.equal(readFileSync(i.fichier, 'utf8'), intact);
});

test('--etat dit ce qui est posé sans montrer de secret ; --retirer enlève les clés (le site reste fermé)', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  assert.match(i.lancer(['--etat']).out, /Clés : aucune.*fermé/);
  i.lancer(['--cle']);
  const etat = i.lancer(['--etat']);
  assert.match(etat.out, /clé de lecture : oui\. Clé de dépôt : non/);
  assert.match(etat.out, /fermé/);
  i.lancer(['--cle-de-depot']);
  assert.match(i.lancer(['--etat']).out, /Clé de dépôt : oui/);
  assert.doesNotMatch(i.lancer(['--etat']).out, /mvk_|mvd_|[0-9a-f]{64}/);
  const retire = i.lancer(['--retirer']);
  assert.equal(retire.code, 0, retire.out);
  assert.match(retire.out, /reste fermé/);
  assert.ok(!existsSync(i.fichier));
  assert.equal(creerAcces({ fichier: i.fichier }).droit({}).droit, 'aucun');
  assert.match(i.lancer(['--retirer']).out, /rien à retirer/);
});

test('la clé ne s’affiche que sur un terminal : hors terminal (sans MAVERICK_ESSAI) la commande refuse avant d’écrire', { skip: SANS_BASH }, (t) => {
  const i = instance(t);
  const r = i.lancer(['--cle'], { env: { MAVERICK_ESSAI: '0' } });
  assert.equal(r.code, 1);
  assert.match(r.out, /à lancer en root|terminal/);
  assert.ok(!existsSync(i.fichier));
});

test('R310 : un fichier d’avant (mot de passe, portée, secret de session) reste lisible ; --etat le dit ; la première commande qui réécrit le fichier retire ces champs et garde les clés', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  const cle = 'mvk_une-cle-d-avant-qui-ne-doit-pas-changer-0123456789';
  const ancien = {
    version: 1, portee: 'tout', mot_de_passe: { algo: 'scrypt', n: 16384, r: 8, p: 1, sel: 'a'.repeat(32), empreinte: 'b'.repeat(64) }, cle_de_lecture: { empreinte: sha(cle) },
    cle_de_depot: null, secret_de_session: 'c'.repeat(64), pose_le: '2026-11-01T00:00:00.000Z',
  };
  mkdirSync(join(i.dossier, 'secrets'), { recursive: true });
  writeFileSync(i.fichier, JSON.stringify(ancien), { mode: 0o600 });
  assert.equal(creerAcces({ fichier: i.fichier }).droit({ 'x-maverick-cle': cle }).droit, 'lecture', 'la clé d’avant marche toujours');
  assert.match(i.lancer(['--etat']).out, /clé de lecture : oui/);
  const r = i.lancer(['--cle-de-depot']);
  assert.equal(r.code, 0, r.out);
  const apres = i.reglage();
  assert.deepEqual(Object.keys(apres).sort(), ['cle_de_depot', 'cle_de_lecture', 'pose_le', 'version']);
  assert.deepEqual(apres.cle_de_lecture, ancien.cle_de_lecture);
  assert.equal(creerAcces({ fichier: i.fichier }).droit({ 'x-maverick-cle': cle }).droit, 'lecture');
});

test('l’installateur livre acces/acces.sh et discord/discord.sh (exécutables, remplacés à chaque installation) sans jamais toucher à secrets/', { skip: SEUL_LINUX || SANS_TAR }, (t) => {
  const racine = dossierTemporaire('acces-installateur', { t });
  const site = join(racine, 'site');
  mkdirSync(site);
  writeFileSync(join(site, 'index.html'), '<h1>essai</h1>');
  const livraison = fabriquer({ mode: 'test', site, tag: 'v0.2.1', version: '0.2.1', sha: 'a'.repeat(40), sortie: join(racine, 'sortie') });
  const dossier = join(racine, 'instance');
  const installer = () => spawnSync('sh', [livraison.fichier, '--dossier', dossier], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(installer().status, 0);
  for (const [chemin, source] of [['acces/acces.sh', SCRIPT], ['discord/discord.sh', SCRIPT_DISCORD]]) {
    const livre = join(dossier, chemin);
    assert.equal(readFileSync(livre, 'utf8'), readFileSync(source, 'utf8'), chemin);
    assert.equal(mode(livre), 0o755, chemin);
  }
  // une installation suivante : les réglages posés entre-temps restent intacts, les commandes sont remplacées
  mkdirSync(join(dossier, 'secrets'), { recursive: true });
  for (const nom of ['acces.json', 'discord.json']) writeFileSync(join(dossier, 'secrets', nom), '{"essai":true}\n', { mode: 0o600 });
  for (const chemin of ['acces/acces.sh', 'discord/discord.sh']) writeFileSync(join(dossier, chemin), '# ancienne version\n');
  assert.equal(installer().status, 0);
  for (const nom of ['acces.json', 'discord.json']) assert.equal(readFileSync(join(dossier, 'secrets', nom), 'utf8'), '{"essai":true}\n', nom);
  assert.equal(readFileSync(join(dossier, 'acces', 'acces.sh'), 'utf8'), readFileSync(SCRIPT, 'utf8'));
  assert.equal(readFileSync(join(dossier, 'discord', 'discord.sh'), 'utf8'), readFileSync(SCRIPT_DISCORD, 'utf8'));
});

test('R291 : --cle-de-depot pose la clé de dépôt (affichée une seule fois, jamais en clair dans le fichier ni en argument), garde la clé de lecture ; --etat la dit ; --sans-cle-de-depot revient à l’état sûr', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  const premiere = i.lancer(['--cle']);
  const cleDeLecture = i.cleAffichee(premiere.out);
  const avant = i.reglage();
  assert.equal(avant.cle_de_depot, null);
  assert.match(i.lancer(['--etat']).out, /Clé de dépôt : non/);

  const r = i.lancer(['--cle-de-depot']);
  assert.equal(r.code, 0, r.out);
  const cleDeDepot = cleDeDepotAffichee(r.out);
  assert.ok(cleDeDepot, r.out);
  assert.equal(r.out.split(cleDeDepot).length, 2, 'la clé de dépôt s’affiche une fois');
  assert.ok(!r.out.includes(cleDeLecture), 'la clé de lecture n’est pas réaffichée');
  assert.match(r.out, /APPLIQUE AUSSITÔT/);
  assert.match(r.out, /ni à la CI ni à GitHub/);
  const apres = i.reglage();
  assert.equal(mode(i.fichier), 0o600);
  assert.ok(!readFileSync(i.fichier, 'utf8').includes(cleDeDepot), 'jamais en clair');
  assert.equal(apres.cle_de_depot.empreinte, sha(cleDeDepot));
  assert.deepEqual(apres.cle_de_lecture, avant.cle_de_lecture);
  assert.ok(!i.appels().includes(cleDeDepot), 'aucun secret en argument');
  assert.match(i.lancer(['--etat']).out, /Clé de dépôt : oui/);
  const acces = creerAcces({ fichier: i.fichier });
  assert.equal(acces.droit({ 'x-maverick-cle': cleDeDepot }).droit, 'depot');
  assert.equal(acces.droit({ 'x-maverick-key': cleDeLecture }).droit, 'lecture');

  // la refaire invalide l'ancienne
  const refaite = i.lancer(['--cle-de-depot']);
  const neuve = cleDeDepotAffichee(refaite.out);
  assert.ok(neuve && neuve !== cleDeDepot);
  assert.equal(creerAcces({ fichier: i.fichier }).droit({ 'x-maverick-cle': cleDeDepot }).droit, 'aucun');

  const retiree = i.lancer(['--sans-cle-de-depot']);
  assert.equal(retiree.code, 0, retiree.out);
  assert.match(retiree.out, /clic d'un Créateur/);
  assert.equal(i.reglage().cle_de_depot, null);
  assert.match(i.lancer(['--etat']).out, /Clé de dépôt : non/);
});

test('R291 : --sans-cle-de-depot sans clé de dépôt posée est refusé (rien n’est écrit) ; la clé de dépôt peut être posée seule', { skip: SEUL_LINUX || SANS_BASH }, (t) => {
  const i = instance(t);
  const r = i.lancer(['--sans-cle-de-depot']);
  assert.equal(r.code, 1, r.out);
  assert.ok(!existsSync(i.fichier), 'aucun réglage écrit');
  assert.match(r.out, /aucune clé de dépôt/);
  const seule = i.lancer(['--cle-de-depot']);
  assert.equal(seule.code, 0, seule.out);
  assert.equal(i.reglage().cle_de_lecture, null);
  assert.ok(i.reglage().cle_de_depot);
});
