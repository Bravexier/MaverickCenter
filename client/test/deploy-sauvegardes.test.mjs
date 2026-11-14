// Sauvegardes automatiques (R274, R275 ; docs/chantier-base-de-dev.md, lot 1 ; docs/serveur.md, « Sauvegardes automatiques ») : les scripts de
// deploy/installateur/sauvegarde/ sont exécutés pour de bon (bash, sqlite3, restic) sur des bases factices dans des dossiers temporaires.
// Temps 1 : copies locales (copie.sh) — cohérentes, contrôlées, jamais d'écriture dans db/, chute de lignes, plafond, rotation.
// Temps 2 : envoi chiffré (envoi.sh, avec un vrai restic et un dépôt local) et essai de restauration (essai.sh, avec un faux « docker »).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  creerBase, creerMonde, fauxDocker, fauxOutil, fixerFiches, lignes, resticEspion, SANS_BASH_SQLITE, SANS_RESTIC, SCRIPTS,
} from './aide-sauvegardes.mjs';

const sha = (fichier) => createHash('sha256').update(readFileSync(fichier)).digest('hex');
/** Les fichiers d'un dossier (récursif) : chemin relatif → [taille, empreinte du contenu], sauf les fichiers que SQLite tient (-shm, -wal). */
function empreintes(dossier, base = dossier, sortie = {}) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) empreintes(chemin, base, sortie);
    else if (!/-(shm|wal)$/.test(nom)) sortie[chemin.slice(base.length)] = sha(chemin);
  }
  return sortie;
}
const noms = (dossier) => {
  const sortie = [];
  const parcourir = (d) => readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? (sortie.push(`${join(d, n).slice(dossier.length)}/`), parcourir(join(d, n))) : sortie.push(join(d, n).slice(dossier.length))));
  parcourir(dossier);
  return sortie.sort();
};

test('scripts : syntaxe bash valide, et shellcheck sans avertissement quand il est installé', { skip: SANS_BASH_SQLITE }, () => {
  const scripts = readdirSync(SCRIPTS).filter((f) => f.endsWith('.sh'));
  assert.deepEqual(scripts.sort(), ['copie.sh', 'envoi.sh', 'essai.sh', 'installer.sh', 'lanceur.sh', 'lib.sh']);
  for (const f of scripts) {
    const r = spawnSync('bash', ['-n', join(SCRIPTS, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f} : ${r.stderr}`);
  }
  if (spawnSync('shellcheck', ['--version'], { stdio: 'ignore' }).status === 0) {
    for (const f of scripts) {
      const r = spawnSync('shellcheck', ['-x', '-S', 'warning', ...(f === 'lanceur.sh' ? ['-s', 'sh'] : ['-s', 'bash']), join(SCRIPTS, f)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C.UTF-8' } });
      assert.equal(r.status, 0, `shellcheck ${f} : ${r.stdout}`);
    }
  }
});

test('copie : cohérente même pendant une écriture (WAL), contrôlée, rien n’est écrit dans db/, les autres fichiers sont gardés, archives en lien dur', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: [] });
  const db = join(m.dossierDe('prod'), 'db');
  const service = creerBase(join(db, 'vivante.db'), { fiches: 80, wal: true }); // le service tient la base ouverte et y a écrit sans point de contrôle
  t.after(() => service.close());
  service.prepare('INSERT INTO fiche (nom) VALUES (?)').run('écrite dans le WAL');
  writeFileSync(join(db, 'vivante.json'), '{"schema":1}');
  writeFileSync(join(db, 'tipeee.json'), '{"texte":"bienvenue"}');
  mkdirSync(join(db, 'archives'));
  writeFileSync(join(db, 'archives', 'vivante-ancienne.db'), 'une archive déjà figée par le service');
  mkdirSync(join(db, 'metriques'));
  writeFileSync(join(db, 'metriques', 'prod.db'), 'métriques : jamais copiées');
  const avant = empreintes(db);
  const nomsAvant = noms(db);

  const r1 = m.lancer('copie.sh', ['nuit', 'prod']);
  assert.equal(r1.code, 0, r1.out);
  assert.deepEqual(noms(db), nomsAvant, 'aucun fichier créé, retiré ni renommé dans db/ (pas de fichier provisoire)');
  assert.deepEqual(empreintes(db), avant, 'aucun contenu de db/ modifié');

  const [copie] = m.copies('prod', 'nuit');
  const dossier = m.d('sauv', 'prod', 'nuit', copie);
  assert.ok(!readdirSync(join(dossier, 'db')).some((n) => /-(wal|shm|journal)$/.test(n)), 'ni -wal ni -shm : la sauvegarde SQLite les a intégrés');
  assert.equal(lignes(join(dossier, 'db', 'vivante.db')), 81, 'la ligne écrite dans le WAL est dans la copie : copie cohérente');
  assert.equal(readFileSync(join(dossier, 'db', 'tipeee.json'), 'utf8'), '{"texte":"bienvenue"}', 'les autres fichiers sont copiés tels quels');
  assert.ok(existsSync(join(dossier, 'db', 'archives', 'vivante-ancienne.db')));
  assert.ok(!existsSync(join(dossier, 'db', 'metriques')), 'les métriques ne sont pas copiées');
  const comptes = readFileSync(join(dossier, 'comptes.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  assert.deepEqual(comptes, [['vivante.db', 'fiche', '81'], ['vivante.db', 'sort', '30'], ['vivante.db', 'vide', '0']]);
  assert.match(readFileSync(join(dossier, 'copie.meta'), 'utf8'), /^LIGNES=111$/m);
  // la copie n'est lisible que par root (les fiches sont dedans)
  assert.equal(statSync(m.d('sauv')).mode & 0o077, 0, 'dossier des copies fermé aux autres');
  assert.equal(statSync(dossier).mode & 0o077, 0);

  // une deuxième copie : l'archive, identique, est un lien dur (elle ne coûte la place qu'une fois)
  const r2 = m.lancer('copie.sh', ['nuit', 'prod'], { extra: m.a('2026-11-15T10:00:00Z') });
  assert.equal(r2.code, 0, r2.out);
  const [, deuxieme] = m.copies('prod', 'nuit');
  assert.equal(statSync(join(m.d('sauv', 'prod', 'nuit', deuxieme), 'db', 'archives', 'vivante-ancienne.db')).ino, statSync(join(dossier, 'db', 'archives', 'vivante-ancienne.db')).ino);
  assert.deepEqual(empreintes(db), avant, 'toujours rien de changé dans db/');
});

test('copie : une base WAL fermée proprement (sans -wal ni -shm) est copiée sans que SQLite crée ces fichiers dans db/', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: [] });
  const db = join(m.dossierDe('prod'), 'db');
  creerBase(join(db, 'vivante.db'), { fiches: 12, wal: true }).close();
  assert.deepEqual(readdirSync(db), ['vivante.db'], 'point de départ : une base WAL fermée n’a plus de fichiers annexes');
  const r = m.lancer('copie.sh', ['nuit', 'prod']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(readdirSync(db), ['vivante.db'], 'toujours rien dans db/');
  const [copie] = m.copies('prod', 'nuit');
  assert.equal(lignes(join(m.d('sauv', 'prod', 'nuit', copie), 'db', 'vivante.db')), 12);
});

test('copie : si un écrivain apparaît (un -wal) pendant une copie « immutable », la copie est refaite par la voie ordinaire en lecture seule', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: [] });
  const db = join(m.dossierDe('prod'), 'db');
  creerBase(join(db, 'vivante.db'), { fiches: 12, wal: true }).close();
  const reel = spawnSync('sh', ['-c', 'command -v sqlite3'], { encoding: 'utf8' }).stdout.trim();
  const journal = m.d('sqlite3.log');
  // un faux sqlite3 : à la première sauvegarde « immutable », un écrivain arrive (un -wal apparaît), puis le vrai sqlite3 fait la copie
  fauxOutil(m, 'sqlite3', `case "$*" in *immutable=1*) printf 'immutable\\n' >> '${journal}'; : > '${join(db, 'vivante.db-wal')}' ;; *.backup*) printf 'ordinaire\\n' >> '${journal}' ;; esac\nexec '${reel}' "$@"`);
  const r = m.lancer('copie.sh', ['nuit', 'prod']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(readFileSync(journal, 'utf8').trim().split('\n'), ['immutable', 'ordinaire'], 'une copie « immutable », puis la seconde par la voie ordinaire');
  const [copie] = m.copies('prod', 'nuit');
  assert.equal(lignes(join(m.d('sauv', 'prod', 'nuit', copie), 'db', 'vivante.db')), 12);
});

test('copie horaire : sautée si db/ n’a pas changé depuis la dernière copie ; la copie de nuit est toujours faite ; l’état le dit', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: ['prod'] });
  const horaire = (heure) => m.lancer('copie.sh', ['horaire', 'prod'], { extra: m.a(`2026-11-14T${heure}:00:00Z`) });
  assert.equal(horaire('10').code, 0);
  assert.equal(m.copies('prod', 'horaire').length, 1);
  assert.equal(m.etat().instances.prod.derniere_verification.resultat, 'copiee');

  const sautee = horaire('11');
  assert.equal(sautee.code, 0);
  assert.match(sautee.out, /n'a pas changé/);
  assert.equal(m.copies('prod', 'horaire').length, 1, 'aucune copie : db/ n’a pas changé');
  const e = m.etat().instances.prod;
  assert.equal(e.derniere_verification.resultat, 'inchangee');
  assert.equal(e.derniere_verification.le, '2026-11-14T11:00:00Z');
  assert.equal(e.derniere_copie.le, '2026-11-14T10:00:00Z', 'la dernière copie reste celle de 10 h');

  assert.equal(m.lancer('copie.sh', ['nuit', 'prod'], { extra: m.a('2026-11-14T12:00:00Z') }).code, 0);
  assert.equal(m.copies('prod', 'nuit').length, 1, 'la nuit, on copie même sans changement');
  fixerFiches(join(m.dossierDe('prod'), 'db', 'vivante.db'), 101);
  assert.equal(horaire('13').code, 0);
  assert.equal(m.copies('prod', 'horaire').length, 2, 'db/ a changé : l’heure suivante copie');
  assert.equal(m.etat().instances.prod.derniere_copie.lignes, 101 + 30);
});

test('copie : chute anormale de lignes → alerte, copie mise de côté, l’ancienne gardée (jamais remplacée ni tournée) ; une copie saine ou « accepter » lève l’alerte', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: ['prod'] });
  const base = join(m.dossierDe('prod'), 'db', 'vivante.db');
  const copier = (heure, extra = {}) => m.lancer('copie.sh', ['horaire', 'prod'], { extra: { ...m.a(`2026-11-14T${heure}:00:00Z`), MAVERICK_SAUV_HORAIRES_GARDEES: '1', ...extra } });
  assert.equal(copier('10').code, 0);
  const [bonne] = m.copies('prod', 'horaire');

  // moins de 20 % de perte : rien à signaler (seuil réglable, documenté)
  fixerFiches(base, 85);
  assert.equal(copier('11').code, 0);
  assert.equal(m.copies('prod', 'horaire').length, 1, 'HORAIRES_GARDEES=1 : la rotation ne garde que la dernière copie bonne');
  const [reference] = m.copies('prod', 'horaire');
  assert.notEqual(reference, bonne);

  // plus de 20 % : alerte
  fixerFiches(base, 50);
  const alerte = copier('12');
  assert.equal(alerte.code, 3, alerte.out);
  assert.deepEqual(m.copies('prod', 'horaire'), [reference], 'l’ancienne copie est gardée, ni remplacée ni tournée');
  assert.equal(m.copies('prod', 'suspectes').length, 1, 'la nouvelle copie est mise de côté');
  const e = m.etat().instances.prod;
  assert.equal(e.alerte.code, 'chute_de_lignes');
  assert.equal(e.alerte.en_cours, true);
  assert.match(e.alerte.detail, /vivante\.db:fiche 85>50/);
  assert.equal(e.derniere_copie.le, '2026-11-14T11:00:00Z', 'la dernière copie bonne est restée celle d’avant');
  assert.equal(e.derniere_verification.resultat, 'alerte');
  assert.ok(m.etat().instances.prod.derniere_copie.lignes, 'compte des lignes de la copie bonne');

  // la même base à l'heure suivante : pas une nouvelle copie suspecte
  const encore = copier('13');
  assert.equal(encore.code, 0);
  assert.equal(m.copies('prod', 'suspectes').length, 1);
  assert.equal(m.etat().instances.prod.alerte.en_cours, true, 'l’alerte reste tant que rien ne l’a levée');

  // les lignes reviennent : une copie saine lève l'alerte (l'historique de la dernière alerte reste daté)
  fixerFiches(base, 90);
  assert.equal(copier('14').code, 0);
  const leve = m.etat().instances.prod;
  assert.equal(leve.alerte.en_cours, false);
  assert.equal(leve.alerte.code, 'chute_de_lignes');

  // « accepter » : une baisse voulue devient la référence
  fixerFiches(base, 40);
  assert.equal(copier('15').code, 3);
  const refus = m.lancer('copie.sh', ['accepter', 'prod'], { extra: m.a('2026-11-14T16:00:00Z') });
  assert.equal(refus.code, 0, refus.out);
  assert.equal(m.etat().instances.prod.alerte.en_cours, false);
  assert.equal(m.etat().instances.prod.derniere_copie.lignes, 40 + 30);
  assert.equal(m.lancer('copie.sh', ['accepter', 'prod']).code, 1, 'rien à accepter');
  fixerFiches(base, 39);
  assert.equal(copier('17').code, 0, 'la nouvelle référence est la copie acceptée');
});

test('copie : le seuil de chute se règle (variable ou reglages.env) et ne s’applique qu’aux tables d’au moins CHUTE_MIN_LIGNES lignes', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: ['prod'] });
  const base = join(m.dossierDe('prod'), 'db', 'vivante.db');
  const copier = (heure, extra = {}) => m.lancer('copie.sh', ['horaire', 'prod'], { extra: { ...m.a(`2026-11-14T${heure}:00:00Z`), ...extra } });
  assert.equal(copier('10').code, 0);
  // la table `sort` (30 lignes) et `fiche` (100) : 100 → 90 est une baisse de 10 %
  fixerFiches(base, 90);
  assert.equal(copier('11', { MAVERICK_SAUV_CHUTE_POURCENT: '5' }).code, 3, 'seuil à 5 % : alerte');
  writeFileSync(join(m.d('etc'), 'reglages.env'), 'CHUTE_POURCENT=5\nCHUTE_MIN_LIGNES=101\n'); // aucune table n'a 101 lignes : jamais comparée
  fixerFiches(base, 89);
  assert.equal(copier('12').code, 0, 'reglages.env : table sous CHUTE_MIN_LIGNES, aucune alerte');
});

test('copie : une base dont integrity_check échoue est mise de côté, avec son alerte', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: ['prod'] });
  const base = join(m.dossierDe('prod'), 'db', 'vivante.db');
  assert.equal(m.lancer('copie.sh', ['horaire', 'prod']).code, 0);
  const db = new DatabaseSync(base);
  db.exec('CREATE TABLE contrainte (a INTEGER CHECK (a > 0)); PRAGMA ignore_check_constraints = ON; INSERT INTO contrainte VALUES (-1);');
  db.close();
  const r = m.lancer('copie.sh', ['horaire', 'prod'], { extra: m.a('2026-11-14T11:00:00Z') });
  assert.equal(r.code, 3, r.out);
  assert.equal(m.etat().instances.prod.alerte.code, 'integrite');
  assert.equal(m.copies('prod', 'suspectes').length, 1);
  assert.equal(m.copies('prod', 'horaire').length, 1, 'la bonne copie d’avant est gardée');
});

/** Abîme une base : 60 octets à 0xff au début de la page du schéma (sqlite3 sort alors avec le code 11, sans rien écrire). */
function abimer(chemin) {
  const fd = openSync(chemin, 'r+');
  writeSync(fd, Buffer.alloc(60, 0xff), 0, 60, 100);
  closeSync(fd);
}

test('copie : une base vraiment abîmée (sqlite3 sort en code 11) est mise de côté avec son alerte, sans rien laisser derrière ; l’autre instance est copiée quand même', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t);
  assert.equal(m.lancer('copie.sh', ['nuit']).code, 0);
  const sain = m.copies('prod', 'nuit');
  abimer(join(m.dossierDe('prod'), 'db', 'vivante.db'));
  fixerFiches(join(m.dossierDe('dev'), 'db', 'vivante.db'), 101); // dev change aussi : une copie de plus est attendue
  const r = m.lancer('copie.sh', ['nuit'], { extra: m.a('2026-11-15T03:00:00Z') });
  assert.equal(r.code, 3, r.out);
  const e = m.etat().instances;
  assert.equal(e.prod.alerte.code, 'integrite');
  assert.equal(e.prod.alerte.en_cours, true);
  assert.match(e.prod.alerte.detail, /malformed|illisible/);
  assert.equal(m.copies('prod', 'suspectes').length, 1);
  assert.deepEqual(m.copies('prod', 'nuit'), sain, 'la bonne copie d’avant est gardée');
  assert.equal(m.copies('dev', 'nuit').length, 2, 'l’autre instance a sa copie');
  assert.equal(e.dev.alerte, null);
  assert.deepEqual(readdirSync(m.d('sauv', 'prod')).filter((n) => n.startsWith('en-cours')), [], 'aucune copie provisoire laissée');
});

test('copie : un arrêt inattendu d’une instance est noté en alerte, nettoie sa copie provisoire et ne prive pas l’autre de la sienne', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t);
  // sha256sum, qui calcule l'empreinte de db/, échoue seulement pour la production : le traitement de cette instance s'arrête net (set -e)
  fauxOutil(m, 'sha256sum', 'case "$PWD" in */normal/db) mkdir -p "$MAVERICK_DIR_SAUVEGARDES/prod/en-cours.1"; exit 1 ;; esac\nexec /usr/bin/sha256sum "$@"');
  const r = m.lancer('copie.sh', ['nuit']);
  assert.equal(r.code, 3, r.out);
  const e = m.etat().instances;
  assert.equal(e.prod.alerte.code, 'erreur_interne');
  assert.equal(e.prod.alerte.en_cours, true);
  assert.equal(m.copies('dev', 'nuit').length, 1, 'la copie de dev est faite');
  assert.equal(m.copies('prod', 'nuit').length, 0);
  assert.deepEqual(readdirSync(m.d('sauv', 'prod')).filter((n) => n.startsWith('en-cours')), [], 'la copie provisoire est effacée');
});

test('réglages : reglages.env se lit comme annoncé (« retirer le # ») — valeur avec commentaire de fin, guillemets ; un réglage illisible alerte (sortie, état, code 3) et prend le défaut', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: ['prod'] });
  writeFileSync(m.d('etc', 'reglages.env'), 'PLAFOND_MO=2048  # place maximale\nHORAIRES_GARDEES="5"   # entre guillemets\nCHUTE_POURCENT=30\t# une tabulation\n# NUITS_GARDEES=99\n');
  const bon = m.lancer('copie.sh', ['nuit', 'prod']);
  assert.equal(bon.code, 0, bon.out);
  const l = m.etat().locale;
  assert.equal(l.plafond_octets, 2048 * 1048576);
  assert.equal(l.horaires_gardees, 5);
  assert.equal(l.chute_pourcent, 30);
  assert.equal(l.nuits_gardees, 7, 'une ligne encore commentée ne change rien');
  assert.equal(l.reglages_illisibles, '');
  // illisibles : le défaut est pris, et on le sait
  writeFileSync(m.d('etc', 'reglages.env'), 'PLAFOND_MO=beaucoup  # n\'importe quoi\nVERSIONS_DE="prod staging"  # un nom d\'instance inconnu\nHORAIRES_GARDEES=3\n');
  const mauvais = m.lancer('copie.sh', ['nuit', 'prod'], { extra: m.a('2026-11-15T03:00:00Z') });
  assert.equal(mauvais.code, 3, mauvais.out);
  assert.match(mauvais.erreur, /réglage PLAFOND_MO illisible \(« beaucoup »\)/);
  assert.match(mauvais.erreur, /réglage VERSIONS_DE illisible/);
  const l2 = m.etat().locale;
  assert.equal(l2.reglages_illisibles, 'PLAFOND_MO VERSIONS_DE');
  assert.equal(l2.plafond_octets, 4096 * 1048576, 'la valeur par défaut est prise');
  assert.equal(l2.horaires_gardees, 3, 'les autres réglages sont lus');
});

test('copie : rotation par instance (horaires, nuits), jamais en dessous d’une copie ; instance sans base ignorée', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: ['prod'] }); // dev : db/ vide
  const base = join(m.dossierDe('prod'), 'db', 'vivante.db');
  for (let i = 0; i < 4; i += 1) {
    fixerFiches(base, 100 + i);
    assert.equal(m.lancer('copie.sh', ['horaire'], { extra: { ...m.a(`2026-11-14T1${i}:00:00Z`), MAVERICK_SAUV_HORAIRES_GARDEES: '2' } }).code, 0);
  }
  assert.deepEqual(m.copies('prod', 'horaire'), ['20261114-120000', '20261114-130000'], 'les deux plus récentes');
  assert.deepEqual(m.copies('dev', 'horaire'), [], 'db/ vide : rien à copier, pas d’alerte');
  assert.equal(m.etat().instances.dev.alerte, null);
  assert.equal(m.etat().instances.dev.derniere_verification.resultat, 'sans_base');
  assert.equal(m.lancer('copie.sh', ['nuit', 'prod'], { extra: { ...m.a('2026-11-15T03:00:00Z'), MAVERICK_SAUV_NUITS_GARDEES: '0' } }).code, 0);
  assert.equal(m.copies('prod', 'nuit').length, 1, 'une valeur absurde ne vide jamais les copies : au moins une');
});

test('copie : plafond de place — les plus anciennes copies partent d’abord (jamais les deux dernières), puis plus rien n’est écrit et l’alerte le dit', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: [] });
  const base = join(m.dossierDe('prod'), 'db', 'vivante.db');
  creerBaseGrosse(base);
  const copier = (heure, extra = {}) => m.lancer('copie.sh', ['horaire', 'prod'], { extra: { ...m.a(`2026-11-14T${heure}:00:00Z`), MAVERICK_SAUV_HORAIRES_GARDEES: '10', MAVERICK_SAUV_LIBRE_MIN_MO: '1', ...extra } });
  const plafond = { MAVERICK_SAUV_PLAFOND_MO: '7' }; // base d'environ 2 Mo : trois copies tiennent, une quatrième demande de la place
  for (const h of ['10', '11', '12']) {
    modifier(base);
    assert.equal(copier(h, plafond).code, 0, h);
  }
  assert.equal(m.copies('prod', 'horaire').length, 3);
  modifier(base);
  const r = copier('13', plafond);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(m.copies('prod', 'horaire'), ['20261114-110000', '20261114-120000', '20261114-130000'], 'la plus ancienne est retirée pour faire de la place');

  // le plafond ne laisse plus de place même après avoir retiré ce qu'on peut : rien n'est écrit, rien n'est supprimé de plus (deux copies gardées)
  modifier(base);
  const serre = copier('14', { MAVERICK_SAUV_PLAFOND_MO: '2' });
  assert.equal(serre.code, 3, serre.out);
  const e = m.etat().instances.prod;
  assert.equal(e.alerte.code, 'plafond');
  assert.equal(e.derniere_verification.resultat, 'refusee');
  assert.ok(m.copies('prod', 'horaire').length >= 2, 'jamais en dessous des deux dernières copies bonnes');
  assert.ok(m.copies('prod', 'horaire').includes('20261114-130000'), 'la dernière copie bonne est intacte');
  assert.ok(!m.copies('prod', 'horaire').includes('20261114-140000'), 'aucune nouvelle copie écrite');
  assert.deepEqual(readdirSync(m.d('sauv', 'prod')).filter((n) => n.startsWith('en-cours')), [], 'pas de copie provisoire laissée');
  // l'espace libre minimal du disque : même refus, autre code
  const plein = copier('15', { MAVERICK_SAUV_LIBRE_MIN_MO: '999999999' });
  assert.equal(plein.code, 3);
  assert.equal(m.etat().instances.prod.alerte.code, 'disque_plein');
  const locale = m.etat().locale;
  assert.equal(locale.libre_min_octets, 999999999 * 1048576);
  assert.equal(typeof locale.occupe_octets, 'number');
  assert.equal(locale.plafond_octets, 4096 * 1048576, 'le plafond par défaut quand rien n’est réglé');
});

/** Une base d'environ 2 Mo (des portraits). */
function creerBaseGrosse(chemin) {
  creerBase(chemin, { fiches: 20, octets: 2_000_000 });
}
/** Change un peu la base (une copie de plus est nécessaire). */
function modifier(chemin) {
  const db = new DatabaseSync(chemin);
  db.prepare('INSERT INTO sort (nom) VALUES (?)').run(`s${Math.random()}`);
  db.close();
}

// ------------------------------------------------------------------------------------------------------------------------------------------------
// Temps 2 : envoi chiffré (restic, dépôt local), rétention, essai de restauration
// ------------------------------------------------------------------------------------------------------------------------------------------------

const CLE = 'cle-de-chiffrement-d-essai-9f8e7d';
const SECRET = 'SECRET-D-ACCES-AU-STOCKAGE-d-essai';
const IDENT = 'IDENTIFIANT-D-ESSAI-123';

/** Un monde prêt pour l'envoi : deux instances (versions, installateur gardé), un dépôt restic local, ses accès (avec de faux secrets). */
function mondeAvecDepot(t) {
  const m = creerMonde(t);
  const depot = m.d('depot');
  writeFileSync(m.d('etc', 'cle-depot'), CLE, { mode: 0o600 });
  writeFileSync(m.d('etc', 'stockage.env'), `RESTIC_REPOSITORY='${depot}'\nAWS_ACCESS_KEY_ID='${IDENT}'\nAWS_SECRET_ACCESS_KEY='${SECRET}'\n`, { mode: 0o600 });
  const journalRestic = m.d('restic.log');
  resticEspion(m, journalRestic);
  const restic = (...args) => spawnSync('restic', args, { encoding: 'utf8', env: { ...m.env, RESTIC_REPOSITORY: depot, RESTIC_PASSWORD_FILE: m.d('etc', 'cle-depot'), RESTIC_CACHE_DIR: m.d('cache') } });
  assert.equal(restic('init', '-q').status, 0);
  for (const [inst, version] of [['prod', 'V0.2'], ['dev', 'V0.3.1']]) {
    writeFileSync(join(m.dossierDe(inst), 'VERSION'), `tag=${version}\nmode=${inst === 'prod' ? 'prod' : 'test'}\n`);
    mkdirSync(join(m.dossierDe(inst), 'installateur-courant'), { recursive: true });
    writeFileSync(join(m.dossierDe(inst), 'installateur-courant', `maverick-center-${version}-install.sh`), `#!/bin/sh\n# installateur ${version}\n`);
  }
  const snapshots = () => JSON.parse(restic('snapshots', '--json').stdout);
  return { m, depot, restic, snapshots, journalRestic };
}
const nuit = (m, extra = {}) => m.lancer('copie.sh', ['nuit'], { extra });
const envoyer = (m, extra = {}) => m.lancer('envoi.sh', [], { extra });

test('envoi : une copie chiffrée par instance avec son installateur, étiquettes de version, rien de secret ni en argument ni dans l’état', { skip: SANS_RESTIC }, (t) => {
  const { m, snapshots, journalRestic, restic } = mondeAvecDepot(t);
  assert.equal(nuit(m).code, 0);
  const premier = envoyer(m);
  assert.equal(premier.code, 0, premier.out);
  const s = snapshots();
  assert.equal(s.length, 2);
  const prod = s.find((x) => x.tags.includes('inst-prod'));
  const dev = s.find((x) => x.tags.includes('inst-dev'));
  assert.deepEqual([...prod.tags].sort(), ['V0.2', 'inst-prod', 'nuit', 'version']);
  assert.deepEqual([...dev.tags].sort(), ['V0.3.1', 'inst-dev', 'nuit', 'version']);
  assert.equal(prod.hostname, 'maverick', 'un nom fixe : une machine de remplacement retrouve les mêmes copies');
  assert.ok(dev.paths.some((p) => p.endsWith('/installateur-courant')), 'le dernier installateur de chaque site part avec la copie');
  assert.ok(dev.paths.some((p) => /\/sauv\/dev\/nuit\/\d{8}-\d{6}$/.test(p)));
  const liste = restic('ls', dev.id).stdout;
  assert.match(liste, /maverick-center-V0\.3\.1-install\.sh/);
  assert.match(liste, /\/db\/vivante\.db$/m);
  assert.match(liste, /\/comptes\.tsv$/m);

  // le lendemain, même version : une copie, sans l'étiquette « version »
  assert.equal(nuit(m, m.a('2026-11-15T03:30:00Z')).code, 0);
  assert.equal(envoyer(m, m.a('2026-11-15T03:40:00Z')).code, 0);
  const deux = snapshots().filter((x) => x.tags.includes('inst-dev'));
  assert.equal(deux.length, 2);
  assert.equal(deux.filter((x) => x.tags.includes('version')).length, 1, 'une seule copie étiquetée « version » par version');
  // une nouvelle version : la copie suivante porte l'étiquette
  writeFileSync(join(m.dossierDe('dev'), 'VERSION'), 'tag=V0.3.2\nmode=test\n');
  assert.equal(nuit(m, m.a('2026-11-16T03:30:00Z')).code, 0);
  assert.equal(envoyer(m, m.a('2026-11-16T03:40:00Z')).code, 0);
  const trois = snapshots().filter((x) => x.tags.includes('inst-dev'));
  assert.ok(trois.some((x) => x.tags.includes('V0.3.2') && x.tags.includes('version')));
  assert.equal(snapshots().filter((x) => x.tags.includes('inst-prod') && x.tags.includes('version')).length, 1, 'la production n’a pas changé de version');

  // l'état : sans secret
  const e = m.etat();
  assert.equal(e.exterieur.active, true);
  assert.equal(e.exterieur.dernier_envoi.ok, true);
  assert.deepEqual(e.exterieur.dernier_envoi.instances, 'prod dev');
  assert.equal(e.exterieur.dernier_controle.ok, true);
  assert.equal(e.exterieur.dernier_controle.donnees_relues, false, 'un samedi : le contrôle ne relit pas les données');
  const texte = readFileSync(m.d('normal', 'metriques', 'sauvegardes.json'), 'utf8');
  for (const secret of [CLE, SECRET, IDENT, m.d('depot')]) {
    assert.ok(!texte.includes(secret), 'ni clé, ni identifiant, ni adresse du dépôt dans le fichier d’état');
    assert.ok(!premier.out.includes(secret) || secret === m.d('depot'), `rien de secret dans la sortie du script (${secret.slice(0, 6)}…)`);
    assert.ok(!readFileSync(journalRestic, 'utf8').includes(secret), 'aucun secret en argument de restic (visible par ps)');
  }
  assert.doesNotMatch(readFileSync(journalRestic, 'utf8'), /--password/, 'la clé n’est jamais passée en argument');
  assert.equal(statSync(m.d('normal', 'metriques', 'sauvegardes.json')).mode & 0o777, 0o644, 'lisible par les conteneurs, sans secret');
  assert.match(texte, /"format": 1/);
});

test('envoi : VERSIONS_DE de reglages.env (guillemets, commentaire de fin) limite l’étiquette « version » aux instances nommées', { skip: SANS_RESTIC }, (t) => {
  const { m, snapshots } = mondeAvecDepot(t);
  writeFileSync(m.d('etc', 'reglages.env'), 'VERSIONS_DE="prod"   # seulement la production\n');
  assert.equal(nuit(m).code, 0);
  assert.equal(envoyer(m).code, 0);
  const s = snapshots();
  assert.ok(s.find((x) => x.tags.includes('inst-prod')).tags.includes('version'));
  assert.ok(!s.find((x) => x.tags.includes('inst-dev')).tags.includes('version'), 'dev n’est pas dans la liste : pas d’étiquette de version');
});

test('envoi : le dimanche, une part des données est relue ; la rétention garde 30 jours, un mois sur deux sans limite et chaque version, jamais ce qui n’est pas à elle', { skip: SANS_RESTIC }, (t) => {
  const { m, snapshots, journalRestic, restic } = mondeAvecDepot(t);
  const fichier = m.d('un-fichier');
  writeFileSync(fichier, 'contenu');
  const ancien = (date, tags) => assert.equal(restic('backup', '-q', '--host', 'maverick', '--time', `${date} 10:00:00`, '--tag', tags, fichier).status, 0, `${date} ${tags}`);
  ancien('2026-07-01', 'autre');                                    // pas une copie du site : jamais touchée
  ancien('2026-07-15', 'inst-prod,nuit');                           // la plus ancienne d'un groupe : restic la garde toujours
  ancien('2026-08-05', 'inst-prod,nuit');                           // ni dernier du mois ni version : retirée
  ancien('2026-08-10', 'inst-prod,nuit,version,V0.1');              // une version : gardée sans limite
  ancien('2026-08-20', 'inst-prod,nuit');                           // dernière d'août : gardée (un mois)
  ancien('2026-09-01', 'inst-prod,nuit');                           // retirée
  ancien('2026-09-02', 'inst-prod,nuit');                           // dernière de septembre : gardée
  ancien('2026-08-20', 'inst-dev,nuit');                            // l'autre instance a sa propre rétention
  assert.equal(nuit(m, m.a('2026-11-15T03:30:00Z')).code, 0); // un dimanche
  assert.equal(new Date('2026-11-15T03:40:00Z').getUTCDay(), 0);
  const r = envoyer(m, m.a('2026-11-15T03:40:00Z'));
  assert.equal(r.code, 0, r.out);
  const gardes = (tag) => snapshots().filter((x) => x.tags.includes(tag)).map((x) => x.time.slice(0, 10)).sort();
  assert.deepEqual(gardes('inst-prod').filter((j) => j < '2026-10-01'), ['2026-07-15', '2026-08-10', '2026-08-20', '2026-09-02']);
  assert.deepEqual(gardes('autre'), ['2026-07-01']);
  assert.deepEqual(gardes('inst-dev').filter((j) => j < '2026-10-01'), ['2026-08-20']);
  assert.match(readFileSync(journalRestic, 'utf8'), /check -q --read-data-subset=5%/, 'le dimanche : une part des données est relue');
  assert.equal(m.etat().exterieur.dernier_controle.donnees_relues, true);
  const appels = readFileSync(journalRestic, 'utf8');
  assert.match(appels, /forget -q --tag inst-prod --group-by host --keep-within-daily 30d --keep-monthly unlimited --keep-tag version/);
  assert.match(appels, /^prune -q$/m);
});

test('envoi : dépôt absent, clé refusée : échec nommé dans l’état (code de sortie 3), jamais d’initialisation ; sans accès configurés : rien, état « non activé »', { skip: SANS_RESTIC }, (t) => {
  const { m, restic, depot } = mondeAvecDepot(t);
  assert.equal(nuit(m).code, 0);
  // clé refusée
  writeFileSync(m.d('etc', 'cle-depot'), 'une-autre-cle');
  const refusee = envoyer(m);
  assert.equal(refusee.code, 3, refusee.out);
  assert.equal(m.etat().exterieur.dernier_envoi.ok, false);
  assert.equal(m.etat().exterieur.dernier_envoi.code, 'cle_refusee');
  writeFileSync(m.d('etc', 'cle-depot'), CLE);
  // dépôt absent : jamais créé par l'envoi
  writeFileSync(m.d('etc', 'stockage.env'), `RESTIC_REPOSITORY='${m.d('autre-depot')}'\n`);
  const absent = envoyer(m);
  assert.equal(absent.code, 3);
  assert.equal(m.etat().exterieur.dernier_envoi.code, 'depot_absent');
  assert.ok(!existsSync(m.d('autre-depot')), 'le dépôt n’est jamais créé par l’envoi de nuit');
  assert.equal(restic('snapshots', '--json').stdout.trim(), '[]', 'rien n’est parti dans l’autre dépôt');
  // le dépôt revient : l'envoi repart
  writeFileSync(m.d('etc', 'stockage.env'), `RESTIC_REPOSITORY='${depot}'\n`);
  assert.equal(envoyer(m).code, 0);
  assert.equal(m.etat().exterieur.dernier_envoi.ok, true);
});

test('envoi : sans stockage.env ni cle-depot, rien n’est envoyé et l’état dit « non activé »', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t);
  assert.equal(nuit(m).code, 0);
  const r = envoyer(m);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /non activé/);
  assert.equal(m.etat().exterieur.active, false);
  assert.equal(m.etat().exterieur.dernier_envoi, null);
  // essai de restauration : de même, rien à faire
  const e = m.lancer('essai.sh');
  assert.equal(e.code, 0);
  assert.match(e.out, /non activé/);
});

test('essai de restauration : conteneur vide sans accès aux copies ni à db/, contrôle de l’intégrité et des nombres de lignes, résultat dans l’état', { skip: SANS_RESTIC }, (t) => {
  const { m } = mondeAvecDepot(t);
  const journalDocker = m.d('docker.log');
  fauxDocker(m, journalDocker);
  assert.equal(nuit(m).code, 0);
  assert.equal(envoyer(m).code, 0);

  const r = m.lancer('essai.sh');
  assert.equal(r.code, 0, r.out);
  const e = m.etat().exterieur.dernier_essai;
  assert.equal(e.ok, true);
  assert.equal(e.code, null);
  assert.equal(e.instances, 'prod:ok dev:ok');
  assert.equal(typeof e.duree_s, 'number');
  assert.deepEqual(readdirSync(m.d('sauv')).filter((n) => n.startsWith('.essai')), [], 'le dossier de restauration est effacé');

  const args = readFileSync(journalDocker, 'utf8');
  assert.match(args, /run --rm --pull never --cap-drop ALL/);
  assert.match(args, /--read-only/);
  assert.match(args, /--security-opt no-new-privileges/);
  assert.doesNotMatch(args, /--network|--privileged|--volumes-from|-v \/:/);
  for (const secret of [CLE, SECRET, IDENT]) assert.ok(!args.includes(secret), 'aucun secret en argument de docker (visible par ps et docker inspect)');
  // ce que le conteneur voit : le binaire restic, les deux fichiers d'accès (lecture seule) et un dossier de sortie vide — ni db/, ni les copies locales
  const montages = readFileSync(`${journalDocker}.montages`, 'utf8').trim().split('\n');
  assert.ok(montages.some((x) => /:\/usr\/local\/bin\/restic:ro$/.test(x)));
  assert.ok(montages.includes(`${m.d('etc', 'stockage.env')}:/cles/stockage.env:ro`));
  assert.ok(montages.includes(`${m.d('etc', 'cle-depot')}:/cles/cle-depot:ro`));
  for (const mont of montages) {
    const hote = mont.split(':')[0];
    for (const interdit of [m.d('normal'), m.d('test'), m.d('sauv', 'prod'), m.d('sauv', 'dev'), m.d('sauv', 'etat')]) {
      assert.ok(!hote.startsWith(interdit), `le conteneur ne voit pas ${interdit} (montage ${mont})`);
    }
  }
  assert.ok(montages.filter((x) => x.endsWith(':/sortie')).every((x) => x.split(':')[0].includes('/sauv/.essai.')), 'seul un dossier de sortie neuf est en écriture');

  // une base restaurée abîmée est vue
  const abimee = m.lancer('essai.sh', [], { extra: { CORROMPRE: '1' } });
  assert.equal(abimee.code, 3, abimee.out);
  const e2 = m.etat().exterieur.dernier_essai;
  assert.equal(e2.ok, false);
  assert.equal(e2.code, 'integrite');
  // la clé ne rouvre plus le dépôt : la restauration échoue, nommée
  writeFileSync(m.d('etc', 'cle-depot'), 'autre-cle');
  assert.equal(m.lancer('essai.sh').code, 3);
  assert.equal(m.etat().exterieur.dernier_essai.code, 'restauration_echouee');
  // pas de docker : nommé
  writeFileSync(m.d('etc', 'cle-depot'), CLE);
  const sansDocker = m.lancer('essai.sh', [], { extra: { MAVERICK_SAUV_DOCKER: 'docker-introuvable' } });
  assert.equal(sansDocker.code, 3);
  assert.equal(m.etat().exterieur.dernier_essai.code, 'docker_absent');
});

test('essai de restauration : des nombres de lignes qui ne sont plus ceux de la copie sont refusés', { skip: SANS_RESTIC }, (t) => {
  const { m } = mondeAvecDepot(t);
  fauxDocker(m, m.d('docker.log'));
  assert.equal(nuit(m).code, 0);
  // comptes.tsv, écrit au moment de la copie, ment : la copie envoyée dit 999 fiches
  const [copie] = m.copies('prod', 'nuit');
  const fichier = m.d('sauv', 'prod', 'nuit', copie, 'comptes.tsv');
  writeFileSync(fichier, readFileSync(fichier, 'utf8').replace(/\t100\n/, '\t999\n'));
  assert.equal(envoyer(m).code, 0);
  assert.equal(m.lancer('essai.sh').code, 3);
  const e = m.etat().exterieur.dernier_essai;
  assert.equal(e.code, 'comptes_differents');
  assert.match(e.instances, /prod:comptes_differents/);
});

test('envoi et copie : fichier d’état écrit d’un coup, jamais à travers un lien posé à l’avance dans le dossier partagé des métriques', { skip: SANS_BASH_SQLITE }, (t) => {
  const m = creerMonde(t, { instances: ['prod'] });
  const victime = m.d('victime');
  writeFileSync(victime, 'à ne pas toucher');
  spawnSync('ln', ['-s', victime, m.d('normal', 'metriques', 'sauvegardes.json')]);
  assert.equal(m.lancer('copie.sh', ['nuit', 'prod']).code, 0);
  assert.equal(readFileSync(victime, 'utf8'), 'à ne pas toucher');
  assert.equal(JSON.parse(readFileSync(m.d('normal', 'metriques', 'sauvegardes.json'), 'utf8')).format, 1);
});
