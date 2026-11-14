// Le geste des sauvegardes automatiques (deploy/installateur/sauvegarde/installer.sh), son lanceur, la clé de chiffrement en 6 mots, la livraison des
// scripts par l'installateur de chaque site (installateur.sh, fabriquer.mjs) et leur décompte dans la jauge du disque (volume.sh).
// Tout est exécuté pour de bon dans des dossiers temporaires, avec de faux « systemctl » et « docker » ; restic est le vrai, sur un dépôt local.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { creerMonde, fauxDocker, fauxOutil, resticEspion, SANS_BASH_SQLITE, SANS_RESTIC, SCRIPTS } from './aide-sauvegardes.mjs';

const MOTS = readFileSync(join(SCRIPTS, 'mots.txt'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const installer = (m, args = [], opts = {}) => m.lancer('installer.sh', args, { interprete: 'sh', ...opts });
const mode = (chemin) => statSync(chemin).mode & 0o777;
const leMonde = (t) => {
  const m = creerMonde(t);
  fauxOutil(m, 'systemctl', `printf '%s\\n' "$*" >> '${m.d('systemctl.log')}'`);
  fauxDocker(m, m.d('docker.log'));
  return m;
};
const idDuDepot = (m, depot) => spawnSync('restic', ['cat', 'config'], { encoding: 'utf8', env: { ...m.env, RESTIC_REPOSITORY: depot, RESTIC_PASSWORD_FILE: m.d('etc', 'cle-depot'), RESTIC_CACHE_DIR: m.d('cache') } }).stdout;

test('mots.txt : 7 776 mots distincts, minuscules, sans espace (la phrase de 6 mots tient 77 bits)', () => {
  assert.equal(MOTS.length, 7776);
  assert.equal(new Set(MOTS.map((x) => x[1])).size, 7776, 'aucun mot en double');
  for (const [de, mot] of MOTS) {
    assert.match(de, /^[1-6]{5}$/);
    assert.match(mot, /^[a-z]+(-[a-z]+)*$/, `« ${mot} » : lettres minuscules ; un tiret admis, mais pas d’espace`);
  }
  assert.ok(6 * Math.log2(MOTS.length) > 77, 'entropie d’une phrase de 6 mots : plus de 77 bits');
  assert.match(readFileSync(join(SCRIPTS, 'installer.sh'), 'utf8'), /^NB_MOTS=6 /m);
});

test('le geste, sans clés du stockage : minuteurs, dossiers fermés, première copie, aucune clé ; relancé, rien ne change', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  const r = installer(m);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Temps 2 passé.*installer\.sh --stockage/s);
  for (const dossier of [m.d('sauv'), m.d('etc'), m.d('sauv', 'prod'), m.d('sauv', 'dev')]) assert.equal(mode(dossier), 0o700, dossier);
  assert.equal(mode(m.d('outils', 'maverick-sauvegarde-lanceur.sh')), 0o755);
  assert.ok(!existsSync(m.d('etc', 'cle-depot')) && !existsSync(m.d('etc', 'stockage.env')), 'ni clé ni accès sans stockage');
  assert.equal(m.copies('prod', 'nuit').length, 1, 'une première copie est faite tout de suite');
  assert.equal(m.etat().exterieur.active, false);
  const lanceur = m.d('outils', 'maverick-sauvegarde-lanceur.sh');
  const horaire = readFileSync(m.d('systemd', 'maverick-sauvegarde-horaire.service'), 'utf8');
  assert.match(horaire, new RegExp(`^ExecStart=/bin/sh ${lanceur} copie horaire$`, 'm'));
  const nuit = readFileSync(m.d('systemd', 'maverick-sauvegarde-nuit.service'), 'utf8');
  assert.match(nuit, new RegExp(`^ExecStart=-/bin/sh ${lanceur} copie nuit\\nExecStart=/bin/sh ${lanceur} envoi$`, 'm'), 'l’envoi part même si la copie de nuit a signalé une alerte');
  assert.match(readFileSync(m.d('systemd', 'maverick-sauvegarde-essai.service'), 'utf8'), new RegExp(`^ExecStart=/bin/sh ${lanceur} essai$`, 'm'));
  for (const nom of ['horaire', 'nuit', 'essai']) {
    const service = readFileSync(m.d('systemd', `maverick-sauvegarde-${nom}.service`), 'utf8');
    for (const durcissement of ['Type=oneshot', 'Nice=19', 'IOSchedulingClass=idle', 'NoNewPrivileges=yes', 'ProtectSystem=full', 'ProtectHome=read-only', 'PrivateTmp=yes']) assert.match(service, new RegExp(`^${durcissement}$`, 'm'), `${nom} : ${durcissement}`);
    assert.match(service, new RegExp(`^Environment=MAVERICK_DIR_NORMAL=${m.d('normal')} `, 'm'));
    assert.match(readFileSync(m.d('systemd', `maverick-sauvegarde-${nom}.timer`), 'utf8'), /^Persistent=true$/m, 'un minuteur manqué (serveur éteint) est rattrapé');
  }
  assert.match(readFileSync(m.d('systemd', 'maverick-sauvegarde-horaire.timer'), 'utf8'), /^OnCalendar=\*-\*-\* \*:07:00$/m);
  assert.match(readFileSync(m.d('systemd', 'maverick-sauvegarde-nuit.timer'), 'utf8'), /^OnCalendar=\*-\*-\* 03:30:00$/m);
  const appels = readFileSync(m.d('systemctl.log'), 'utf8');
  for (const nom of ['horaire', 'nuit', 'essai']) assert.match(appels, new RegExp(`enable --now maverick-sauvegarde-${nom}\\.timer`));
  assert.match(appels, /daemon-reload/);
  assert.ok(existsSync(m.d('etc', 'reglages.env')), 'les réglages se trouvent, commentés, à côté des clés');

  const avant = readFileSync(m.d('systemd', 'maverick-sauvegarde-nuit.service'), 'utf8');
  const encore = installer(m);
  assert.equal(encore.code, 0, encore.out);
  assert.equal(readFileSync(m.d('systemd', 'maverick-sauvegarde-nuit.service'), 'utf8'), avant);
  assert.equal(m.copies('prod', 'nuit').length, 1, 'relancé : pas de copie de plus');
  assert.equal(installer(m, ['--sans-stockage']).code, 0);
  assert.equal(installer(m, ['--stockage', '--sans-stockage']).code, 2);
  assert.equal(installer(m, ['--inconnue']).code, 2);
});

test('le geste, temps 2 : phrase de 6 mots affichée une fois, rangée en 600, dépôt créé une fois, premier envoi et essai de restauration', { skip: SANS_RESTIC }, (t) => {
  const m = leMonde(t);
  const depot = m.d('depot');
  const journalRestic = m.d('restic.log');
  resticEspion(m, journalRestic);
  const extra = { MAVERICK_SAUV_DEPOT: depot };
  const r = installer(m, [], { extra });
  assert.equal(r.code, 0, r.out);
  const phrase = readFileSync(m.d('etc', 'cle-depot'), 'utf8');
  const mots = phrase.split('-');
  assert.equal(mots.length, 6, 'six mots');
  const liste = new Set(MOTS.map((x) => x[1]));
  assert.ok(mots.every((x) => liste.has(x)), 'tirés de mots.txt');
  assert.equal(r.out.split(phrase).length - 1, 1, 'affichée une seule fois par la commande');
  assert.equal(mode(m.d('etc', 'cle-depot')), 0o600);
  assert.equal(mode(m.d('etc', 'stockage.env')), 0o600);
  assert.equal(mode(m.d('etc')), 0o700);
  assert.match(r.out, /Envoi fait/);
  assert.match(r.out, /Essai réussi/);
  assert.equal(m.etat().exterieur.dernier_essai.ok, true);
  // la phrase n'est ni dans l'état, ni dans les unités, ni dans les arguments de restic ou de docker, ni dans les journaux des scripts
  for (const texte of [readFileSync(m.d('normal', 'metriques', 'sauvegardes.json'), 'utf8'), readFileSync(journalRestic, 'utf8'), readFileSync(m.d('docker.log'), 'utf8'),
    readFileSync(m.d('systemctl.log'), 'utf8'), ...readdirSync(m.d('systemd')).map((f) => readFileSync(m.d('systemd', f), 'utf8')), readFileSync(m.d('etc', 'reglages.env'), 'utf8')]) {
    assert.ok(!texte.includes(phrase));
  }
  for (const f of ['envoi.sh', 'essai.sh']) assert.ok(!m.lancer(f).out.includes(phrase), `${f} n’écrit pas la phrase`);

  // relancé : ni clé recréée, ni dépôt réinitialisé, ni phrase réaffichée
  const config = idDuDepot(m, depot);
  const encore = installer(m, ['--stockage'], { extra });
  assert.equal(encore.code, 0, encore.out);
  assert.equal(readFileSync(m.d('etc', 'cle-depot'), 'utf8'), phrase);
  assert.equal(idDuDepot(m, depot), config);
  assert.ok(!encore.out.includes(phrase));
  assert.match(encore.out, /clé de chiffrement de ce serveur est conservée/);
  assert.match(encore.out, /Dépôt chiffré déjà en place/);
  const sans = installer(m);
  assert.match(sans.out, /Envoi extérieur déjà activé/);

  // la phrase se réaffiche, par une option explicite
  const aff = installer(m, ['--afficher-la-cle']);
  assert.equal(aff.code, 0);
  assert.equal(aff.out.split(phrase).length - 1, 1);
});

test('le geste : un serveur neuf reprend le dépôt existant avec la phrase saisie ; une mauvaise phrase ne change rien et ne réinitialise rien', { skip: SANS_RESTIC }, (t) => {
  const ancien = leMonde(t);
  const depot = ancien.d('depot');
  assert.equal(installer(ancien, [], { extra: { MAVERICK_SAUV_DEPOT: depot } }).code, 0);
  const phrase = readFileSync(ancien.d('etc', 'cle-depot'), 'utf8');
  const config = idDuDepot(ancien, depot);

  const neuf = leMonde(t);
  const extra = { MAVERICK_SAUV_DEPOT: depot };
  const faux = installer(neuf, ['--sans-stockage']);
  assert.equal(faux.code, 0);
  const mauvaise = installer(neuf, ['--stockage'], { extra, input: 'une-mauvaise-phrase\n' });
  assert.equal(mauvaise.code, 1, mauvaise.out);
  assert.match(mauvaise.out, /ne rouvre pas le dépôt existant/);
  assert.ok(!existsSync(neuf.d('etc', 'cle-depot')) && !existsSync(neuf.d('etc', 'stockage.env')), 'rien n’est mis en place');
  assert.equal(idDuDepot(ancien, depot), config, 'dépôt intact');
  // la phrase recopiée sur papier : majuscules et espaces au lieu de tirets
  const bonne = installer(neuf, ['--stockage'], { extra, input: `${phrase.replaceAll('-', '  ').toUpperCase()}\n` });
  assert.equal(bonne.code, 0, bonne.out);
  assert.equal(readFileSync(neuf.d('etc', 'cle-depot'), 'utf8'), phrase, 'la même clé de chiffrement');
  assert.ok(!bonne.out.includes(phrase), 'une phrase reprise n’est pas réaffichée');
  assert.match(bonne.out, /Dépôt chiffré déjà en place/);
  assert.equal(idDuDepot(neuf, depot), config);
  assert.equal(neuf.etat().exterieur.dernier_essai.ok, true, 'le premier essai de restauration du nouveau serveur réussit');
  // les copies locales de l'ancien serveur ne sont pas le sujet : chaque serveur garde les siennes
  assert.equal(neuf.copies('prod', 'nuit').length, 1);

  // changer de stockage plus tard : nouveau dépôt, même clé de chiffrement, copies locales gardées
  const copies = neuf.copies('prod', 'nuit');
  const autre = neuf.d('autre-depot');
  const change = installer(neuf, ['--stockage'], { extra: { MAVERICK_SAUV_DEPOT: autre } });
  assert.equal(change.code, 0, change.out);
  assert.match(change.out, /Création du dépôt chiffré/);
  assert.equal(readFileSync(neuf.d('etc', 'cle-depot'), 'utf8'), phrase, 'la clé de chiffrement ne change pas en changeant de stockage');
  assert.match(readFileSync(neuf.d('etc', 'stockage.env'), 'utf8'), new RegExp(`RESTIC_REPOSITORY='${autre}'`));
  assert.deepEqual(neuf.copies('prod', 'nuit').slice(0, copies.length), copies, 'les copies locales sont gardées');
});

test('le geste : saisies refusées avant tout accès au stockage, rien de secret écrit ni affiché', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  const invalide = installer(m, ['--stockage'], { input: 'http://pas-https.example.org\n' });
  assert.equal(invalide.code, 1);
  assert.match(invalide.out, /L'adresse invalide/);
  const bucket = installer(m, ['--stockage', '--adresse', 'https://s3.exemple.invalid', '--bucket', 'Mauvais Nom'], { input: '' });
  assert.equal(bucket.code, 1);
  assert.match(bucket.out, /Le bucket invalide/);
  const differentes = installer(m, ['--stockage', '--adresse', 'https://s3.exemple.invalid', '--region', 'region-exemple', '--bucket', 'bucket-exemple'],
    { input: 'IDENTIFIANT-SECRET-1\nSECRET-UN\nSECRET-DEUX\n' });
  assert.equal(differentes.code, 1);
  assert.match(differentes.out, /pas identiques.*rien n'a été enregistré/s);
  for (const secret of ['IDENTIFIANT-SECRET-1', 'SECRET-UN', 'SECRET-DEUX']) assert.ok(!differentes.out.includes(secret), 'jamais affichés');
  assert.ok(!existsSync(m.d('etc', 'stockage.env')) && !existsSync(m.d('etc', 'cle-depot')));
});

test('le geste : une clé ou un identifiant au format refusé n’est jamais affiché (le message nomme le champ)', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  const args = ['--stockage', '--adresse', 'https://s3.exemple.invalid', '--bucket', 'bucket-exemple'];
  const cle = installer(m, args, { input: 'IDENT-BON\nsecret avec espace;et"guillemet\nsecret avec espace;et"guillemet\n' });
  assert.equal(cle.code, 1);
  assert.match(cle.out, /La clé secrète refusé\(e\)/);
  for (const morceau of ['secret avec', 'guillemet', 'espace']) assert.ok(!cle.out.includes(morceau), `« ${morceau} » n’est pas affiché`);
  const ident = installer(m, args, { input: 'ID@ENT-MAUVAIS\nSECRET-BON\nSECRET-BON\n' });
  assert.equal(ident.code, 1);
  assert.match(ident.out, /L'identifiant de clé refusé\(e\)/);
  assert.ok(!ident.out.includes('ID@ENT') && !ident.out.includes('SECRET-BON'));
  assert.ok(!existsSync(m.d('etc', 'stockage.env')));
});

/** Un faux restic : `cat config` et `init` répondent par `erreur` (ou réussissent si elle est vide) ; tout le reste réussit. */
const resticFaux = (m, { cat = '', init = '' } = {}) => fauxOutil(m, 'restic', `
case "$1" in
  cat) [ -z "$CAT" ] || { printf '%s\\n' "$CAT" >&2; exit 1; } ;;
  init) [ -z "$INIT" ] || { printf '%s\\n' "$INIT" >&2; exit 1; } ;;
esac
exit 0`);

test('le geste : le stockage est essayé tout de suite ; un refus donne la cause en français, sans secret, un code non nul, et n’enregistre rien (le stockage précédent est gardé)', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  resticFaux(m);
  const saisie = 'IDENT-DE-TEST\nSECRET-DE-TEST\nSECRET-DE-TEST\n';
  const args = ['--stockage', '--adresse', 'https://s3.exemple.invalid', '--bucket', 'bucket-exemple'];
  const cas = [
    ['dial tcp: lookup s3.exemple.invalid: no such host', /adresse injoignable/],
    ['Fatal: x509: certificate signed by unknown authority', /certificat HTTPS refusé/],
    ['The specified bucket does not exist NoSuchBucket', /bucket introuvable/],
    ['AccessDenied: Access Denied. status code: 403', /clés refusées ou droits insuffisants/],
    ['AuthorizationHeaderMalformed: the region is wrong', /région refusée/],
    ['boom SECRET-DE-TEST IDENT-DE-TEST', /réponse inattendue du stockage \(boom \*\*\* \*\*\*\)/],
  ];
  // un stockage déjà en place : un refus ne le remplace pas
  mkdirSync(m.d('etc'), { recursive: true });
  writeFileSync(m.d('etc', 'stockage.env'), "RESTIC_REPOSITORY='ancien'\n", { mode: 0o600 });
  writeFileSync(m.d('etc', 'cle-depot'), 'mot-mot-mot-mot-mot-mot', { mode: 0o600 });
  for (const [erreur, attendu] of cas) {
    const r = installer(m, args, { input: saisie, extra: { CAT: erreur } });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, attendu);
    assert.match(r.out, /Rien n'a été enregistré/);
    assert.ok(!r.out.includes('SECRET-DE-TEST') && !r.out.includes('IDENT-DE-TEST'), 'aucun secret dans le message');
    assert.equal(readFileSync(m.d('etc', 'stockage.env'), 'utf8'), "RESTIC_REPOSITORY='ancien'\n", 'le stockage précédent est gardé');
    assert.equal(readFileSync(m.d('etc', 'cle-depot'), 'utf8'), 'mot-mot-mot-mot-mot-mot');
    assert.deepEqual(readdirSync(m.d('etc')).filter((f) => f.startsWith('.')), [], 'aucun fichier provisoire laissé');
  }
  // dépôt absent, mais la création est refusée par le stockage (droits d'écriture)
  const refuse = installer(m, args, { input: saisie, extra: { CAT: 'unable to open config file: Is there a repository at the following location?', INIT: 'AccessDenied: Access Denied' } });
  assert.equal(refuse.code, 1);
  assert.match(refuse.out, /refuse la création du dépôt : clés refusées/);
  assert.equal(readFileSync(m.d('etc', 'stockage.env'), 'utf8'), "RESTIC_REPOSITORY='ancien'\n");
  assert.ok(!refuse.out.includes('SECRET-DE-TEST'));
});

test('le geste : adresse, région et bucket par arguments ou variables d’environnement (seules les clés sont saisies, masquées) ; la région est facultative', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  resticFaux(m);
  const saisie = 'IDENT-DE-TEST\nSECRET/DE+TEST=\nSECRET/DE+TEST=\n';
  const sans = installer(m, ['--stockage', '--adresse', 'https://s3.exemple.invalid/', '--bucket', 'bucket-exemple'], { input: saisie });
  assert.ok(!sans.out.includes('SECRET/DE+TEST='));
  const env = readFileSync(m.d('etc', 'stockage.env'), 'utf8');
  assert.equal(env, "RESTIC_REPOSITORY='s3:https://s3.exemple.invalid/bucket-exemple'\nAWS_ACCESS_KEY_ID='IDENT-DE-TEST'\nAWS_SECRET_ACCESS_KEY='SECRET/DE+TEST='\n", 'sans région : AWS_DEFAULT_REGION n’est pas écrite');
  assert.equal(mode(m.d('etc', 'stockage.env')), 0o600);
  assert.doesNotMatch(sans.out, /Adresse du stockage|Nom du bucket|Région/, 'aucune invite pour ce qui est donné');
  // par variables d'environnement, avec une région
  const m2 = leMonde(t);
  resticFaux(m2);
  installer(m2, ['--stockage'], { input: saisie, extra: { MAVERICK_SAUV_ADRESSE: 'https://s3.exemple.invalid', MAVERICK_SAUV_BUCKET: 'bucket-exemple', MAVERICK_SAUV_REGION: 'region-exemple' } });
  assert.match(readFileSync(m2.d('etc', 'stockage.env'), 'utf8'), /^AWS_DEFAULT_REGION='region-exemple'$/m);
  assert.match(readFileSync(m2.d('etc', 'stockage.env'), 'utf8'), /^RESTIC_REPOSITORY='s3:https:\/\/s3\.exemple\.invalid\/bucket-exemple'$/m);
  // dépôt à créer : création faite avant d'enregistrer, la phrase est alors affichée une fois
  const m3 = leMonde(t);
  resticFaux(m3);
  const neuf = installer(m3, ['--stockage', '--adresse', 'https://s3.exemple.invalid', '--bucket', 'bucket-exemple'], { input: saisie, extra: { CAT: 'unable to open config file: Is there a repository' } });
  assert.match(neuf.out, /Création du dépôt chiffré/);
  const phrase = readFileSync(m3.d('etc', 'cle-depot'), 'utf8');
  assert.equal(neuf.out.split(phrase).length - 1, 1);
});

test('le geste : --verifier-le-stockage essaie le stockage configuré sans rien ressaisir ni rien changer', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  const sans = installer(m, ['--verifier-le-stockage']);
  assert.equal(sans.code, 1);
  assert.match(sans.out, /n'est pas configuré/);
  writeFileSync(m.d('etc', 'stockage.env'), "RESTIC_REPOSITORY='s3:https://s3.exemple.invalid/bucket-exemple'\nAWS_SECRET_ACCESS_KEY='SECRET-DE-TEST'\n", { mode: 0o600 });
  writeFileSync(m.d('etc', 'cle-depot'), 'mot-mot-mot-mot-mot-mot', { mode: 0o600 });
  resticFaux(m);
  const avant = [readFileSync(m.d('etc', 'stockage.env'), 'utf8'), readdirSync(m.d('systemd')).length];
  const bon = installer(m, ['--verifier-le-stockage']);
  assert.equal(bon.code, 0, bon.out);
  assert.match(bon.out, /Stockage vérifié/);
  assert.deepEqual([readFileSync(m.d('etc', 'stockage.env'), 'utf8'), readdirSync(m.d('systemd')).length], avant, 'rien n’est modifié, aucun minuteur posé');
  const mauvais = installer(m, ['--verifier-le-stockage'], { extra: { CAT: 'AccessDenied: Access Denied for SECRET-DE-TEST' } });
  assert.equal(mauvais.code, 1);
  assert.match(mauvais.out, /clés refusées/);
  assert.ok(!mauvais.out.includes('SECRET-DE-TEST'));
  const phraseFausse = installer(m, ['--verifier-le-stockage'], { extra: { CAT: 'Fatal: wrong password or no key found' } });
  assert.equal(phraseFausse.code, 1);
  assert.match(phraseFausse.out, /phrase de chiffrement ne rouvre pas/);
});

test('le geste : --retirer arrête les minuteurs et garde copies, clés et réglages', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  assert.equal(installer(m).code, 0);
  const r = installer(m, ['--retirer']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(readdirSync(m.d('systemd')), []);
  assert.ok(!existsSync(m.d('outils', 'maverick-sauvegarde-lanceur.sh')));
  assert.match(readFileSync(m.d('systemctl.log'), 'utf8'), /disable --now maverick-sauvegarde-nuit\.timer/);
  assert.equal(m.copies('prod', 'nuit').length, 1, 'les copies restent');
  assert.ok(existsSync(m.d('etc', 'reglages.env')));
});

test('lanceur : prend les scripts du site de dev, sinon du serveur normal, et refuse ceux qu’un autre que root pourrait modifier', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = leMonde(t);
  const lanceur = join(SCRIPTS, 'lanceur.sh');
  const lancer = (args, extra = {}) => spawnSync('sh', [lanceur, ...args], { encoding: 'utf8', env: { ...m.env, ...extra } });
  const copier = (dossier) => {
    mkdirSync(dossier, { recursive: true });
    for (const f of readdirSync(SCRIPTS)) writeFileSync(join(dossier, f), readFileSync(join(SCRIPTS, f)), { mode: 0o755 });
  };
  assert.equal(lancer(['copie', 'etat']).status, 1, 'aucun script posé : refus nommé');
  assert.match(lancer(['copie', 'etat']).stderr, /scripts introuvables/);
  copier(m.d('normal', 'sauvegarde'));
  const normal = lancer(['copie', 'etat']);
  assert.equal(normal.status, 0, normal.stderr);
  assert.ok(existsSync(m.d('normal', 'metriques', 'sauvegardes.json')), 'les scripts du serveur normal servent quand le site de dev n’a pas les siens');
  copier(m.d('test', 'sauvegarde'));
  writeFileSync(m.d('test', 'sauvegarde', 'copie.sh'), '#!/bin/bash\necho "ceux du site de dev"\n');
  assert.match(lancer(['copie', 'etat']).stdout, /ceux du site de dev/, 'le site de dev passe en premier');
  assert.equal(lancer(['inconnu']).status, 2);
  // un dossier modifiable par d'autres que root : refusé, sauf pour les essais
  chmodSync(m.d('test', 'sauvegarde'), 0o777);
  const refuse = lancer(['copie', 'etat'], { MAVERICK_ESSAI: '0' });
  assert.equal(refuse.status, 1);
  assert.match(refuse.stderr, /refus de lancer .* pas à root seul/);
  assert.doesNotMatch(refuse.stdout, /ceux du site de dev/);
});

test('installateur : le dossier sauvegarde/ est livré avec le site, remplacé à chaque installation sans garder d’ancienne version, copies et clés hors de lui', { skip: SANS_BASH_SQLITE }, (t) => {
  const racine = dossierTemporaire('sauvegardes-installateur', { t });
  const site = join(racine, 'site');
  mkdirSync(join(site, 'wiki', 'p'), { recursive: true });
  writeFileSync(join(site, 'index.html'), '<h1>accueil</h1>');
  writeFileSync(join(site, 'wiki', 'p', 'index.html'), '<p>page</p>');
  const i = fabriquer({ mode: 'test', site, tag: 'v0.3.9', version: '0.3.9', sha: 'a'.repeat(40), sortie: join(racine, 'sortie') });
  const dossier = join(racine, 'instance');
  const lancer = () => spawnSync('sh', [i.fichier, '--dossier', dossier], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(lancer().status, 0);
  const livres = readdirSync(join(dossier, 'sauvegarde')).sort();
  assert.deepEqual(livres, ['copie.sh', 'envoi.sh', 'essai.sh', 'installer.sh', 'lanceur.sh', 'lib.sh', 'mots.txt']);
  for (const f of livres) {
    assert.equal(readFileSync(join(dossier, 'sauvegarde', f), 'utf8'), readFileSync(join(SCRIPTS, f), 'utf8'), `${f} livré tel quel`);
    assert.equal(mode(join(dossier, 'sauvegarde', f)), 0o755);
  }
  // un fichier qui n'est plus livré disparaît ; installateur-courant/ (posé par mise-a-jour.sh) n'est jamais touché ; pas de reste caché
  writeFileSync(join(dossier, 'sauvegarde', 'ancien.sh'), '# une ancienne version');
  mkdirSync(join(dossier, 'installateur-courant'));
  writeFileSync(join(dossier, 'installateur-courant', 'maverick-center-v0.3.8-install.sh'), 'x');
  writeFileSync(join(dossier, 'sauvegarde', 'lib.sh'), '# modifiée sur place');
  assert.equal(lancer().status, 0);
  assert.deepEqual(readdirSync(join(dossier, 'sauvegarde'), { withFileTypes: false }).sort(), livres, 'un seul exemplaire de chaque, aucun reste');
  assert.equal(readFileSync(join(dossier, 'sauvegarde', 'lib.sh'), 'utf8'), readFileSync(join(SCRIPTS, 'lib.sh'), 'utf8'), 'remplacé à chaque installation');
  assert.ok(existsSync(join(dossier, 'installateur-courant', 'maverick-center-v0.3.8-install.sh')));
  assert.ok(!readdirSync(dossier).some((n) => /sauvegardes?$/.test(n) && n !== 'sauvegarde'), 'les copies ne sont pas dans le dossier de l’instance');
});

test('volume.sh : les copies locales des sauvegardes comptent dans « installations et copies » de la jauge', { skip: SANS_BASH_SQLITE }, (t) => {
  const racine = dossierTemporaire('sauvegardes-volume', { t });
  const normal = join(racine, 'normal');
  mkdirSync(join(normal, 'metriques'), { recursive: true });
  const sauv = join(racine, 'sauv');
  mkdirSync(join(sauv, 'prod'), { recursive: true });
  writeFileSync(join(sauv, 'prod', 'copie.db'), Buffer.alloc(300_000, 1));
  const sortie = join(normal, 'metriques', 'volume-hote.json');
  const r = spawnSync('bash', [fileURLToPath(new URL('../../deploy/vps/volume.sh', import.meta.url)), '--sortie', sortie, normal], {
    encoding: 'utf8', env: { PATH: process.env.PATH, MAVERICK_DIR_SAUVEGARDES: sauv, MAVERICK_DIR_VARLOG: join(racine, 'log'), MAVERICK_DIR_TMP: join(racine, 'tmp'), MAVERICK_DIR_ROOT: join(racine, 'root'), MAVERICK_DIR_HOME: join(racine, 'home'), MAVERICK_DIR_DOCKER: join(racine, 'docker') },
  });
  assert.equal(r.status, 0, r.stderr);
  const elements = JSON.parse(readFileSync(sortie, 'utf8')).elements.filter((e) => e.chemin === sauv);
  assert.equal(elements.length, 1);
  assert.equal(elements[0].cle, 'installations');
  assert.ok(elements[0].octets >= 300_000);
  assert.equal(dirname(sortie), join(normal, 'metriques'));
});
