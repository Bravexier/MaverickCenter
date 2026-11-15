// La répétition, sur une copie, de la dernière mise à jour de la production par l'ancien circuit (lot 8 ; docs/serveur.md, « Répétition de la mise à jour de
// la production ») : scripts/repetition-prod.mjs (le contenu à venir tiré de la base du site de dev, puis preparerBaseVivante en mode production sur la copie)
// et deploy/installateur/repetition-prod.sh (copie de la base de la production, dossier de travail, conteneur du site de dev), lancé pour de bon avec bash
// dans un monde factice et un faux « docker » dont `compose run` exécute le vrai script avec les chemins du conteneur remplacés par ceux du monde.
// Des comptes seulement : les fiches, le compte et le groupe sentinelles (aide-fiches-sentinelles.mjs) ne sortent jamais. La vraie base n'est jamais écrite.
// Le shell nécessite bash et sqlite3 : sans eux, ces cas sont ignorés.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chutesAttendues, repeter, texteDeLaRepetition } from '../scripts/repetition-prod.mjs';
import { FICHIERS_JOINTS, modulesDuServeur, REPETITION_PROD } from '../serveur/livraison.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';
import { marquesDesFiches, poserDesFiches } from './aide-fiches-sentinelles.mjs';

const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/repetition-prod.sh', import.meta.url));
const SAUVEGARDE = fileURLToPath(new URL('../../deploy/installateur/sauvegarde', import.meta.url));
const CLIENT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const have = (cmd, args = ['--version']) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
const skipShell = (!have('bash') && 'bash indisponible') || (!have('sqlite3') && 'sqlite3 indisponible');
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

// une base vivante faite des règles du dépôt (comme celle d'un service), une fois : chaque monde en copie les fichiers
const modele = dossierTemporaire('repetition-modele');
const VIVANTE = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(modele, 'db') }).chemin;

/**
 * Un monde : dev/ (VERSION test, db/vivante.db du site de dev, que `changerDev(db)` modifie) et prod/ (VERSION prod, db/vivante.db avec les fiches sentinelles).
 * Rend { d, poses, marques, prod } ; `prod` : la base de la production (à ne jamais voir changer).
 */
function creerMonde(t, changerDev = () => {}) {
  const r = dossierTemporaire('repetition', { t });
  const d = (...p) => join(r, ...p);
  for (const x of ['dev/db', 'prod/db', 'bin', 'sauv']) mkdirSync(d(x), { recursive: true });
  writeFileSync(d('dev', 'VERSION'), 'tag=V0.4.101\nversion=0.4.101\nmode=test\n');
  writeFileSync(d('prod', 'VERSION'), 'tag=V0.4\nversion=0.4.0\nmode=prod\n');
  copyFileSync(VIVANTE, d('dev', 'db', 'vivante.db'));
  copyFileSync(VIVANTE, d('prod', 'db', 'vivante.db'));
  copyFileSync(join(modele, 'db', 'vivante.json'), d('prod', 'db', 'vivante.json'));
  const p = ouvrirBaseVivante(d('prod', 'db', 'vivante.db'));
  const poses = poserDesFiches(p);
  p.close();
  const dev = new DatabaseSync(d('dev', 'db', 'vivante.db'));
  dev.exec('PRAGMA foreign_keys = OFF');
  changerDev(dev, poses);
  dev.close();
  return { r, d, poses, marques: marquesDesFiches(poses), prod: d('prod', 'db', 'vivante.db') };
}
/** Le site de dev a supprimé le métier que citent les fiches de la production : R42 le retire des fiches, avec une note (nature « metier »). */
const sansLeMetier = (db, poses) => db.prepare('DELETE FROM metier WHERE id = ?').run(poses.metier);
/** Le site de dev a supprimé la race que citent les fiches : ce n'est pas un retrait de R42, les fiches ne passent pas, la production garde sa base. */
const sansLaRace = (db, poses) => db.prepare('DELETE FROM race WHERE id = ?').run(poses.race);
const sansMarque = (texte, marques) => {
  for (const m of marques) assert.equal(String(texte).includes(m), false, `« ${m} » ne doit pas sortir`);
};

test('livré avec le service : le script est joint à _serveur/ et n’importe que des modules livrés', () => {
  assert.ok(FICHIERS_JOINTS.some((f) => f.source === REPETITION_PROD && f.cible === REPETITION_PROD));
  const livres = new Set(modulesDuServeur());
  assert.deepEqual(modulesDuServeur(undefined, REPETITION_PROD).filter((m) => m !== REPETITION_PROD && !livres.has(m)), []);
});

test('PASSERA : base refaite avec le contenu du site de dev, fiches adaptées comptées par nature (R42), aucun nom de fiche ; la vraie base n’est pas lue en écriture', (t) => {
  const m = creerMonde(t, sansLeMetier);
  const travail = dossierTemporaire('travail', { t });
  mkdirSync(join(travail, 'prod'));
  copyFileSync(m.prod, join(travail, 'prod', 'vivante.db'));
  const avant = sha(m.prod);
  const x = repeter({ source: m.d('dev', 'db', 'vivante.db'), travail, version: '0.5.0' });
  assert.equal(x.verdict, 'passera');
  assert.equal(x.base.refaite, true);
  assert.equal(x.base.fiches_avant, 2);
  assert.equal(x.base.fiches_apres, 2, 'aucune fiche perdue');
  assert.deepEqual(x.fiches_adaptees, { fiches: 2, par_nature: { metier: { fiches: 2, elements: 2 } } });
  assert.equal(x.controle.integrite, 'ok');
  assert.equal(x.controle.cles_rompues_fiches, 0, 'les fiches ne citent plus le métier retiré');
  assert.equal(x.controle.cles_rompues_contenu, x.contenu.cles_etrangeres_rompues, 'celles du contenu sont celles de l’extrait (le métier supprimé sans ses renvois)');
  assert.ok(x.base.archive_octets > 0, 'l’ancienne base est archivée, comme en production');
  // le métier supprimé : la table « metier » ne perd qu'une ligne, pas de chute anormale pour les sauvegardes (mêmes seuils que copie.sh)
  assert.equal(x.chutes.some((c) => c.table === 'metier'), false);
  assert.equal(sha(m.prod), avant);
  const texte = texteDeLaRepetition(x);
  assert.match(texte, /^PASSERA : /);
  assert.match(texte, /adaptées \(metier\) : 2 fiche\(s\), 2 élément\(s\)/);
  sansMarque(texte, m.marques);
  sansMarque(JSON.stringify(x), m.marques);
});

test('REFUSEE : une référence que R42 ne retire pas (la race) : la production garderait sa base ; problème dit par table et colonne, sans la valeur', (t) => {
  const m = creerMonde(t, sansLaRace);
  const travail = dossierTemporaire('travail', { t });
  mkdirSync(join(travail, 'prod'));
  copyFileSync(m.prod, join(travail, 'prod', 'vivante.db'));
  const copie = sha(join(travail, 'prod', 'vivante.db'));
  const x = repeter({ source: m.d('dev', 'db', 'vivante.db'), travail, version: '0.5.0' });
  assert.equal(x.verdict, 'refusee');
  assert.equal(sha(join(travail, 'prod', 'vivante.db')), copie, 'la base gardée telle quelle');
  assert.ok(x.refus.problemes.some((p) => /^personnage\.race_id = « … » absent de race \(2 ligne\(s\)\)$/.test(p)), x.refus.problemes.join(' | '));
  const texte = texteDeLaRepetition(x);
  assert.match(texte, /^REFUSEE : la production garderait sa base/);
  assert.equal(texte.includes(m.poses.race), false, 'la valeur citée ne sort pas');
  sansMarque(texte, m.marques);
  sansMarque(JSON.stringify(x), m.marques);
});

/** Le faux docker : `compose run … -v <hôte>:<conteneur> … serveur node <script> …` exécute le vrai script, chemins du conteneur remplacés. */
const FAUX_DOCKER = `
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2);
const e = process.env;
appendFileSync(e.FAUX_JOURNAL, a.join(' ') + '\\n');
if (a[0] !== 'compose' || a[1] !== 'run') process.exit(1);
const reste = a.slice(2);
const montages = {};
let i = 0;
while (i < reste.length && reste[i].startsWith('-')) {
  if (reste[i] === '-v') { const [hote, conteneur] = reste[i + 1].split(':'); montages[conteneur] = hote; i += 2; } else i += 1;
}
const commande = reste.slice(i + 1);
const chemin = (x) => {
  for (const [c, h] of Object.entries(montages)) if (x === c) return h;
  return x.replace(/^\\/site\\/_serveur\\//, e.FAUX_CLIENT + '/').replace(/^\\/db\\//, e.FAUX_DEV + '/db/');
};
if (commande[0] !== 'node') process.exit(1);
const r = spawnSync(process.execPath, ['--no-warnings', ...commande.slice(1).map(chemin)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
`;
function lanceur(m) {
  writeFileSync(m.d('bin', 'faux-docker.mjs'), FAUX_DOCKER);
  writeFileSync(m.d('bin', 'docker'), `#!/bin/sh\nexec "${process.execPath}" "${m.d('bin', 'faux-docker.mjs')}" "$@"\n`);
  chmodSync(m.d('bin', 'docker'), 0o755);
  const env = {
    PATH: `${m.d('bin')}:${process.env.PATH}`, HOME: m.r, LANG: 'C.UTF-8', ...variablesTemporaires(m.r),
    MAVERICK_DIR_TEST: m.d('dev'), MAVERICK_DIR_NORMAL: m.d('prod'), MAVERICK_SAUV_DOCKER: m.d('bin', 'docker'), MAVERICK_REPETITION_SAUVEGARDE: SAUVEGARDE,
    MAVERICK_DIR_SAUVEGARDES: m.d('sauv'), MAVERICK_DIR_ETC_SAUVEGARDES: m.d('etc'), MAVERICK_DIR_METRIQUES: m.d('prod', 'metriques'), MAVERICK_ESSAI: '1',
    FAUX_JOURNAL: m.d('docker.log'), FAUX_DEV: m.d('dev'), FAUX_CLIENT: CLIENT,
  };
  return (...args) => {
    const p = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env, timeout: 300_000 });
    return { code: p.status, out: `${p.stdout}${p.stderr}` };
  };
}
const restes = (m) => (existsSync(m.d('dev', 'var')) ? readdirSync(m.d('dev', 'var')) : []);

test('repetition-prod.sh : copie lue en lecture seule, conteneur du site de dev, PASSERA (code 0), dossier de travail effacé, production intacte', { skip: skipShell }, (t) => {
  const m = creerMonde(t, sansLeMetier);
  const avant = sha(m.prod);
  const r = lanceur(m)();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /repetition : PASSERA : /);
  assert.match(r.out, /repetition : == la production PASSERA/);
  assert.match(readFileSync(m.d('docker.log'), 'utf8'), /^compose run --rm --no-deps -T -v [^ ]*\/dev\/var\/repetition-prod\.[^ :]+:\/repetition serveur node \/site\/_serveur\/scripts\/repetition-prod\.mjs --source \/db\/vivante\.db --travail \/repetition --chute-pourcent 20 --chute-min 20$/m);
  assert.equal(sha(m.prod), avant, 'la base de la production n’a pas changé');
  assert.deepEqual(restes(m), [], 'le dossier de travail est effacé');
  sansMarque(r.out, m.marques);
});

test('repetition-prod.sh : REFUSEE (code 1, la production garderait sa base) ; --garder ; --depuis-la-sauvegarde ; refus d’usage (code 2)', { skip: skipShell }, (t) => {
  const m = creerMonde(t, sansLaRace);
  const lancer = lanceur(m);
  let r = lancer('--garder');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /== la production GARDERAIT SA BASE/);
  assert.match(r.out, /problème : personnage\.race_id = « … » absent de race/);
  sansMarque(r.out, m.marques);
  assert.equal(restes(m).length, 1, '--garder : le dossier de travail reste');
  assert.match(r.out, /dossier de travail gardé : /);

  // la dernière copie locale des sauvegardes au lieu d'une copie prise à l'instant
  const copie = m.d('sauv', 'prod', 'horaire', '20261115-100000');
  mkdirSync(join(copie, 'db'), { recursive: true });
  copyFileSync(m.prod, join(copie, 'db', 'vivante.db'));
  writeFileSync(join(copie, 'copie.meta'), 'INSTANCE=prod\nTYPE=horaire\nINSTANT=1763200800\n');
  r = lancer('--depuis-la-sauvegarde');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /dernière copie locale \(horaire\/20261115-100000/);

  // usage : jamais sur une production prise pour le site de dev, ni sans base de production
  writeFileSync(m.d('dev', 'VERSION'), 'tag=V0.4\nversion=0.4.0\nmode=prod\n');
  r = lancer();
  assert.equal(r.code, 2);
  assert.match(r.out, /n'est pas le site de dev/);
  assert.equal(lancer('--inconnue').code, 2);
});

test('chutes attendues : les seuils de sauvegarde/copie.sh (au moins N lignes avant, plus de P % perdues, une table disparue comprise)', () => {
  const avant = { a: 100, b: 100, c: 19, d: 50, e: 30 };
  const apres = { a: 80, b: 79, c: 0, e: 30 };
  assert.deepEqual(chutesAttendues(avant, apres), [{ table: 'b', avant: 100, apres: 79 }, { table: 'd', avant: 50, apres: null }]);
  assert.deepEqual(chutesAttendues(avant, apres, { pourcent: 10, min: 10 }).map((c) => c.table), ['a', 'b', 'c', 'd']);
});
