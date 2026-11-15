// Le script du jour de la bascule 1 (deploy/installateur/bascule.sh ; lot 8 du chantier de la base de dev, garde-fous 3 et 6 ; docs/serveur.md, « Base source
// (lot 8) ») : geler, constat (dans le conteneur du service), sauvegarde nommée, poser le marqueur db/source, retirer. Lancé pour de bon avec bash, dans un monde
// factice (deux instances, l'attestation de la production) et un faux « docker » : `compose run` exécute le vrai constat (scripts/constat-de-bascule.mjs) avec les
// chemins du conteneur remplacés par ceux du monde ; `compose exec` répond comme le service (`source` vrai quand le marqueur est posé). Nécessite bash ; la
// sauvegarde nommée, aussi sqlite3 et flock (outils des sauvegardes) : sinon ces tests sont ignorés.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { empreintesDuContenu } from '../serveur/empreintes.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/bascule.sh', import.meta.url));
const SAUVEGARDE = fileURLToPath(new URL('../../deploy/installateur/sauvegarde', import.meta.url));
const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const have = (cmd, args = ['--version']) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
const skip = !have('bash') && 'bash indisponible';
const skipSauvegarde = skip || (!(have('sqlite3') && have('flock')) && 'sqlite3 ou flock indisponible');
const HORLOGE = '2026-11-15T10:00:00Z';
const epoch = (iso) => String(Math.floor(Date.parse(iso) / 1000));

const SCHEMA = `
CREATE TABLE famille (id TEXT PRIMARY KEY, libelle TEXT NOT NULL) STRICT;
CREATE TABLE page (id TEXT PRIMARY KEY, statut TEXT NOT NULL) STRICT;
CREATE TABLE personnage (id TEXT PRIMARY KEY, nom TEXT) STRICT;
INSERT INTO famille VALUES ('docs', 'Docs');
INSERT INTO page VALUES ('guide/a', 'verified');
INSERT INTO personnage VALUES ('p1', 'Une fiche');
`;
const base = (chemin, sql = '') => {
  const db = new DatabaseSync(chemin);
  db.exec(SCHEMA + sql);
  db.close();
};

/** Le faux docker : un script Node qui note ses appels et joue `compose` (ps, stop, start, up, restart, run, exec) et `inspect` (échec : pas de conteneur). */
const FAUX_DOCKER = `
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2);
const e = process.env;
appendFileSync(e.FAUX_JOURNAL, a.join(' ') + '\\n');
const etat = () => (existsSync(e.FAUX_ETAT) ? readFileSync(e.FAUX_ETAT, 'utf8').trim() : 'running');
if (a[0] !== 'compose') process.exit(1);
const [, sous, ...reste] = a;
if (sous === 'ps') { if (etat() === 'running') console.log('c0ffee'); process.exit(0); }
if (sous === 'stop') { writeFileSync(e.FAUX_ETAT, 'stopped'); process.exit(0); }
if (['start', 'restart', 'up'].includes(sous)) { writeFileSync(e.FAUX_ETAT, 'running'); process.exit(0); }
if (sous === 'exec') { if (etat() !== 'running') process.exit(1); console.log('source=' + existsSync(e.FAUX_DEV + '/db/source')); process.exit(0); }
if (sous === 'run') {
  const montages = {};
  let i = 0;
  while (i < reste.length && reste[i].startsWith('-')) {
    if (reste[i] === '-v') { const [hote, conteneur] = reste[i + 1].split(':'); montages[conteneur] = hote; i += 2; } else i += 1;
  }
  const commande = reste.slice(i + 1);
  const chemin = (x) => {
    for (const [c, h] of Object.entries(montages)) if (x === c) return h;
    return x.replace(/^\\/site\\/_serveur\\//, e.FAUX_CLIENT + '/').replace(/^\\/db\\//, e.FAUX_DEV + '/db/').replace(/^\\/site\\//, e.FAUX_DEV + '/site/').replace(/^\\/production$/, e.FAUX_PROD + '/site');
  };
  if (commande[0] !== 'node') process.exit(1);
  const r = spawnSync(process.execPath, ['--no-warnings', ...commande.slice(1).map(chemin)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
process.exit(1);
`;

/** Un monde : dev/ (site de dev : VERSION, db/vivante.db, site/donnees/maverick.db) et prod/ (site/_serveur/version.json, metriques/attestation-prod.json). */
function creerMonde(t, { devSql = '' } = {}) {
  const r = dossierTemporaire('bascule', { t });
  const d = (...p) => join(r, ...p);
  for (const x of ['dev/db', 'dev/site/donnees', 'prod/db', 'prod/site/_serveur', 'prod/metriques', 'bin', 'sauv', 'etc']) mkdirSync(d(x), { recursive: true });
  writeFileSync(d('dev', 'VERSION'), 'tag=V0.4.98\nversion=0.4.98\nmode=test\n');
  writeFileSync(d('prod', 'VERSION'), 'tag=V0.4\nversion=0.4.0\nmode=prod\n');
  base(d('dev', 'db', 'vivante.db'), devSql);
  base(d('dev', 'site', 'donnees', 'maverick.db'));
  base(d('prod', 'db', 'vivante.db'));
  writeFileSync(d('prod', 'site', '_serveur', 'version.json'), JSON.stringify({ version: '0.4.98' }));
  const db = new DatabaseSync(d('prod', 'db', 'vivante.db'), { readOnly: true });
  const e = empreintesDuContenu(db);
  db.close();
  writeFileSync(d('prod', 'metriques', 'attestation-prod.json'), JSON.stringify({ format: 'maverick-attestation/1', version: { service: '0.4.98' }, base_vivante: { empreinte: e.global, tables: e.tables }, preparation: { appliquee: true } }));
  writeFileSync(d('bin', 'faux-docker.mjs'), FAUX_DOCKER);
  writeFileSync(d('bin', 'docker'), `#!/bin/sh\nexec "${process.execPath}" "${d('bin', 'faux-docker.mjs')}" "$@"\n`);
  chmodSync(d('bin', 'docker'), 0o755);
  const env = {
    PATH: `${d('bin')}:${process.env.PATH}`, HOME: r, LANG: 'C.UTF-8', ...variablesTemporaires(r),
    MAVERICK_DIR_TEST: d('dev'), MAVERICK_DIR_NORMAL: d('prod'), MAVERICK_SAUV_DOCKER: d('bin', 'docker'), MAVERICK_DIR_BASCULE: d('etat-bascule'),
    MAVERICK_BASCULE_SAUVEGARDE: SAUVEGARDE, MAVERICK_DIR_SAUVEGARDES: d('sauv'), MAVERICK_DIR_ETC_SAUVEGARDES: d('etc'), MAVERICK_DIR_METRIQUES: d('prod', 'metriques'),
    MAVERICK_BASCULE_ATTENTE: '2', MAVERICK_SAUV_HORLOGE: HORLOGE, MAVERICK_ESSAI: '1', MAVERICK_SAUV_ATTENTE: '0',
    FAUX_JOURNAL: d('docker.log'), FAUX_ETAT: d('docker.etat'), FAUX_DEV: d('dev'), FAUX_PROD: d('prod'), FAUX_CLIENT: CLIENT.replace(/\/$/, ''),
  };
  const lancer = (etape, extra = {}) => {
    const p = spawnSync('bash', [SCRIPT, etape], { encoding: 'utf8', env: { ...env, ...extra }, timeout: 120_000 });
    return { code: p.status, out: `${p.stdout}${p.stderr}` };
  };
  const etatBascule = () => (existsSync(d('etat-bascule', 'etat')) ? readFileSync(d('etat-bascule', 'etat'), 'utf8') : '');
  return { d, env, lancer, etatBascule, docker: () => readFileSync(d('docker.log'), 'utf8') };
}
/** Une sauvegarde nommée réussie, notée comme `sauvegarder` la note (les outils des sauvegardes ont leur propre test, plus bas). */
const sauvegardeReussie = (m, iso = HORLOGE) => appendFileSync(m.d('etat-bascule', 'etat'), `SAUVEGARDE=ok\nSAUVEGARDE_NOM=bascule-1-essai\nSAUVEGARDE_LE=${epoch(iso)}\n`);

test('poser refuse sans gel, sans constat EGALITE ni sauvegarde ; le constat refuse un service en marche ; rien n’est posé', { skip }, (t) => {
  const m = creerMonde(t);
  let r = m.lancer('poser');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /REFUS : aucun gel en cours/);
  r = m.lancer('constat');
  assert.equal(r.code, 1);
  assert.match(r.out, /REFUS : le service du site de dev tourne/);
  assert.equal(m.lancer('geler').code, 0);
  r = m.lancer('poser');
  assert.match(r.out, /REFUS : aucun constat EGALITE/);
  assert.equal(m.lancer('constat').code, 0);
  r = m.lancer('poser');
  assert.match(r.out, /REFUS : aucune sauvegarde nommée réussie depuis le constat/);
  assert.equal(existsSync(m.d('dev', 'db', 'source')), false);
  // la sauvegarde nommée exige l'envoi hors du serveur : refusée sans stockage, avant toute copie
  r = m.lancer('sauvegarder');
  assert.equal(r.code, 1);
  assert.match(r.out, /REFUS : l'envoi hors du serveur n'est pas activé/);
});

test('le jour J : geler, constat EGALITE dans le conteneur, sauvegarde, poser (marqueur, service relancé, source: true), état, puis retirer sans rien effacer', { skip }, (t) => {
  const m = creerMonde(t, { devSql: "UPDATE personnage SET nom = 'Une fiche du site de dev';" });
  let r = m.lancer('geler');
  assert.equal(r.code, 0, r.out);
  assert.ok(existsSync(m.d('dev', 'GELER')), 'plus de mise à jour automatique');
  assert.match(m.docker(), /^compose stop serveur$/m);
  r = m.lancer('constat');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /bascule : EGALITE 2 table/);
  assert.match(m.docker(), /compose run --rm --no-deps -T -v [^ ]*prod\/metriques\/attestation-prod\.json:\/bascule\/attestation-prod\.json:ro serveur node \/site\/_serveur\/scripts\/constat-de-bascule\.mjs/);
  assert.match(m.etatBascule(), /^CONSTAT=EGALITE$/m);
  sauvegardeReussie(m);
  r = m.lancer('poser');
  assert.equal(r.code, 0, r.out);
  const marqueur = readFileSync(m.d('dev', 'db', 'source'), 'utf8');
  assert.match(marqueur, /^format=maverick-source\/1\npose_le=2026-11-15T10:00:00Z\nversion=V0\.4\.98\nempreinte=[0-9a-f]{64}\nsauvegarde=bascule-1-essai\n$/);
  assert.match(r.out, /source: true/);
  assert.ok(!existsSync(m.d('dev', 'GELER')), 'GELER posé par « geler » est retiré');
  assert.match(m.docker(), /^compose exec -T serveur node -e /m);
  assert.deepEqual(readdirSync(m.d('dev', 'db')).sort(), ['source', 'vivante.db'], 'aucun fichier provisoire laissé dans db/');
  r = m.lancer('etat');
  assert.equal(r.code, 0);
  assert.match(r.out, /marqueur : POSÉ/);
  assert.match(r.out, /service du site de dev : en marche/);
  r = m.lancer('poser');
  assert.match(r.out, /REFUS : .*db\/source existe déjà/);
  r = m.lancer('retirer');
  assert.equal(r.code, 0, r.out);
  assert.equal(existsSync(m.d('dev', 'db', 'source')), false);
  const gardes = readdirSync(m.d('dev', 'db')).filter((f) => f.startsWith('source-retire-'));
  assert.equal(gardes.length, 1);
  assert.equal(readFileSync(m.d('dev', 'db', gardes[0]), 'utf8'), marqueur, 'le marqueur est gardé tel quel');
  assert.match(m.docker(), /^compose restart serveur$/m);
});

test('un constat de plus d’une heure, ou fait avant le gel en cours, ne permet pas de poser', { skip }, (t) => {
  const m = creerMonde(t);
  m.lancer('geler');
  assert.equal(m.lancer('constat').code, 0);
  sauvegardeReussie(m);
  const tard = '2026-11-15T11:05:00Z';
  let r = m.lancer('poser', { MAVERICK_SAUV_HORLOGE: tard });
  assert.equal(r.code, 1);
  assert.match(r.out, /REFUS : le constat EGALITE date de plus d'une heure/);
  // dégel puis regel : le constat d'avant ne vaut plus
  assert.equal(m.lancer('degeler', { MAVERICK_SAUV_HORLOGE: tard }).code, 0);
  assert.equal(m.lancer('geler', { MAVERICK_SAUV_HORLOGE: tard }).code, 0);
  r = m.lancer('poser', { MAVERICK_SAUV_HORLOGE: tard });
  assert.match(r.out, /REFUS : le constat précède le gel en cours/);
  assert.equal(existsSync(m.d('dev', 'db', 'source')), false);
});

test('un constat qui trouve un écart : code 1, la table nommée, rien ne peut être posé', { skip }, (t) => {
  const m = creerMonde(t, { devSql: "UPDATE famille SET libelle = 'Changée sur le site de dev';" });
  m.lancer('geler');
  const r = m.lancer('constat');
  assert.equal(r.code, 1);
  assert.match(r.out, /table famille : le site de dev diffère/);
  assert.ok(!r.out.includes('Changée sur le site de dev'), 'aucun contenu dans la sortie');
  assert.match(m.etatBascule(), /^CONSTAT=DIFFERENCES$/m);
  sauvegardeReussie(m);
  assert.match(m.lancer('poser').out, /REFUS : aucun constat EGALITE/);
});

test('refuse une instance qui n’est pas le site de dev', { skip }, (t) => {
  const m = creerMonde(t);
  const r = m.lancer('etat', { MAVERICK_DIR_TEST: m.d('prod') });
  assert.equal(r.code, 1);
  assert.match(r.out, /n'est pas le site de dev/);
  assert.equal(spawnSync('bash', [SCRIPT, 'inconnue'], { encoding: 'utf8', env: m.env }).status, 2);
});

test('sauvegarder : une copie nommée bascule-1-<date> des deux bases (copie locale par copie.sh, envoi par envoi.sh avec son étiquette, gardée sans limite)', { skip: skipSauvegarde }, (t) => {
  const m = creerMonde(t);
  writeFileSync(m.d('etc', 'stockage.env'), 'RESTIC_REPOSITORY=s3:https://s3.exemple.invalid/bucket-exemple\n');
  writeFileSync(m.d('etc', 'cle-depot'), 'phrase d essai\n');
  writeFileSync(m.d('bin', 'restic'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${m.d('restic.log')}'\nexit 0\n`);
  chmodSync(m.d('bin', 'restic'), 0o755);
  const r = m.lancer('sauvegarder');
  assert.equal(r.code, 0, r.out);
  const nom = 'bascule-1-20261115-100000';
  for (const inst of ['prod', 'dev']) assert.ok(existsSync(m.d('sauv', inst, 'nommees', nom)), `${inst} : copie nommée`);
  const appels = readFileSync(m.d('restic.log'), 'utf8');
  assert.match(appels, new RegExp(`backup -q --host maverick --tag inst-prod,nommees,${nom}`));
  assert.match(appels, new RegExp(`backup -q --host maverick --tag inst-dev,nommees,${nom}`));
  assert.match(appels, /--keep-tag version --keep-tag nommees/);
  assert.match(m.etatBascule(), /^SAUVEGARDE=ok$/m);
  assert.match(m.etatBascule(), new RegExp(`^SAUVEGARDE_NOM=${nom}$`, 'm'));
});
