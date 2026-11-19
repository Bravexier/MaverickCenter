// Le monde de la répétition complète du jour J de la bascule 2 (lot 11, PR 3a), pour test/repetition-bascule-2.test.mjs (le module scripts/repetition-bascule-2.mjs) et
// test/deploy-repetition-bascule-2.test.mjs (le script deploy/installateur/repetition-bascule-2.sh) : la base de la production (copie, fiches sentinelles), la base du site de dev,
// le site publié de la production, et, pour le shell, une instance de dev avec son atelier installé, son kit factice, ses outils (ceux du dépôt) et un faux docker.
// Aucune valeur du site de dev n'est figée : le contenu vient de la base d'import (cheminBase) et les lignes d'essai sont posées par le test. Module sans test propre.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { repeterLaBascule2 } from '../scripts/repetition-bascule-2.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';
import { marquesDesFiches, poserDesFiches } from './aide-fiches-sentinelles.mjs';

export const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/repetition-bascule-2.sh', import.meta.url));
const ATELIER = fileURLToPath(new URL('../../deploy/installateur/atelier', import.meta.url));
const SAUVEGARDE = fileURLToPath(new URL('../../deploy/installateur/sauvegarde', import.meta.url));
const CLIENT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const have = (cmd, args = ['--version']) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
export const skipShell = (!have('bash') && 'bash indisponible') || (!have('flock') && 'flock indisponible');
export const skipSqlite3 = skipShell || (!have('sqlite3') && 'sqlite3 indisponible');
export const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

// une base vivante faite des règles du dépôt (comme celle d'un service), une fois : chaque monde en copie les fichiers
const modele = dossierTemporaire('bascule-2-modele');
export const REGLES = cheminBase({ sansExemples: false });
export const VIVANTE = preparerBaseVivante({ regles: REGLES, dossier: join(modele, 'db') }).chemin;
export const STRUCTURE = (() => {
  const db = new DatabaseSync(VIVANTE, { readOnly: true });
  try {
    return db.prepare('PRAGMA user_version').get().user_version;
  } finally {
    db.close();
  }
})();
// les versions de l'essai : le site de dev à X.Y.Z, la production à une version plus ancienne : la prochaine livraison est la X.(Y+1) (versionDeLivraison)
export const DEV = '9.1.4';
export const PROD = '9.0.0';
export const CIBLE = '9.2';
// la version que publie la production du shell (--prod) ; celle du leurre `production/` est PROD
export const PRODUCTION_PUBLIEE = '9.1.9';

/**
 * Un monde : travail/prod/vivante.db (la copie de la production, avec les fiches sentinelles), dev/db/vivante.db (la base du site de dev, que `changerDev(db, poses)` modifie)
 * et production/ (le site publié de la production : donnees/maverick.db et _serveur/version.json). Rend { r, d, poses, marques, copie, dev, production, travail }.
 */
export function creerMonde(t, changerDev = () => {}, changerCopie = () => {}) {
  const r = dossierTemporaire('bascule-2', { t });
  const d = (...p) => join(r, ...p);
  for (const x of ['dev/db', 'travail/prod', 'production/donnees', 'production/_serveur']) mkdirSync(d(x), { recursive: true });
  copyFileSync(REGLES, d('production', 'donnees', 'maverick.db'));
  writeFileSync(d('production', '_serveur', 'version.json'), `${JSON.stringify({ version: PROD })}\n`);
  copyFileSync(VIVANTE, d('dev', 'db', 'vivante.db'));
  copyFileSync(VIVANTE, d('travail', 'prod', 'vivante.db'));
  const p = ouvrirBaseVivante(d('travail', 'prod', 'vivante.db'));
  const poses = poserDesFiches(p);
  p.close();
  const copie = new DatabaseSync(d('travail', 'prod', 'vivante.db'));
  copie.exec('PRAGMA foreign_keys = OFF');
  changerCopie(copie, poses);
  copie.close();
  const dev = new DatabaseSync(d('dev', 'db', 'vivante.db'));
  dev.exec('PRAGMA foreign_keys = OFF');
  // une base de règles qui est un extrait (la CI, MAVERICK_CONTENU) porte sa vue extrait_meta ; la base d'un site de dev bâtie depuis data/rows n'en a pas, et le paquet la refuse
  dev.exec('DROP VIEW IF EXISTS extrait_meta');
  changerDev(dev, poses);
  dev.close();
  return { r, d, poses, marques: marquesDesFiches(poses), copie: d('travail', 'prod', 'vivante.db'), dev: d('dev', 'db', 'vivante.db'), production: d('production'), travail: d('travail') };
}
/**
 * Le métier que citent les fiches de la production n'est plus dans le contenu à livrer (la copie des fiches cite un identifiant absent) : R42 le retire des fiches,
 * avec une note (nature « metier »). Le contenu du site de dev reste cohérent : un paquet refuse des clés étrangères rompues.
 */
export const metierRetire = (db) => db.prepare("UPDATE personnage SET metier_id = 'zz-metier-retire'").run();
/** Les fiches citent une race absente du contenu : ce n'est pas un retrait de R42, les fiches ne passent pas, la production garde sa base. */
export const raceAbsente = (db) => db.prepare("UPDATE personnage SET race_id = 'zz-race-absente'").run();
/** Une ligne qui vise une entité absente : le contrôle du contenu (garde-fou 18) la nomme par table, identifiant et règle. */
export const ligneOrpheline = (db) => db.prepare(`INSERT INTO ecart_source (id, entite_table, entite_id, champ, nature, source_a, detail, origine, source_ref)
  VALUES ('metier:zz-absent:nom:valeur_absente:fiche', 'metier', 'zz-absent', 'nom', 'valeur_absente', 'fiche', 'essai', (SELECT id FROM famille ORDER BY id LIMIT 1), 'essai')`).run();
export const sansMarque = (texte, marques) => {
  for (const m of marques) assert.equal(String(texte).includes(m), false, `« ${m} » ne doit pas sortir`);
};
export const KIT = { version: DEV, structure: STRUCTURE };
export const lancerLaRepetition = (m, o = {}) => repeterLaBascule2({
  source: m.dev, travail: m.travail, production: m.production, kit: KIT, versionDev: DEV, instant: new Date('2026-11-18T10:00:00Z'), ...o,
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le script de shell, dans un monde factice : instance de dev (atelier, kit factice, outils de l'atelier du dépôt), production, faux docker
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Le faux docker. `compose run … -v <hôte>:<conteneur> … serveur node <script> …` exécute le vrai script (chemins du conteneur remplacés) ; `run -d … <image> sh /conteneur.sh` exécute le
 * vrai conteneur.sh de l'atelier, sans attendre (son état est gardé dans FAUX_ETAT), avec les montages traduits en variables que conteneur.sh admet (KIT, CONTENU, TRAVAIL, RESULTATS).
 * FAUX_ISSUE : « oom » (le conteneur est tué par la mémoire), « echec » (la fabrication échoue), « docker_refuse » (docker run refuse).
 */
export const FAUX_DOCKER = `
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2);
const e = process.env;
appendFileSync(e.FAUX_JOURNAL, a.join(' ') + '\\n');
const montages = (liste) => { const m = {}; for (let i = 0; i < liste.length; i += 1) if (liste[i] === '-v') { const [h, c] = liste[i + 1].split(':'); m[c] = h; } return m; };
if (a[0] === 'compose' && a[1] === 'run') {
  const m = montages(a);
  const i = a.indexOf('serveur');
  const chemin = (x) => m[x] ?? x.replace(/^\\/site\\/_serveur\\//, e.FAUX_CLIENT + '/').replace(/^\\/db\\//, e.FAUX_DEV + '/db/');
  const r = spawnSync(process.execPath, ['--no-warnings', ...a.slice(i + 2).map(chemin), '--version-du-code', e.FAUX_VERSION_DU_CODE], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
if (a[0] === 'image' && a[1] === 'inspect') process.exit(0);
if (a[0] === 'pull') process.exit(1);
if (a[0] === 'run') {
  if (e.FAUX_ISSUE === 'docker_refuse') process.exit(125);
  const m = montages(a);
  const env = { ...process.env, KIT: m['/kit'], CONTENU: m['/contenu'], TRAVAIL: m['/travail'], RESULTATS: m['/resultats'], SORTIE: m['/sortie'] ?? m['/resultats'] + '/sortie' };
  for (let i = 0; i < a.length; i += 1) if (a[i] === '-e') { const [k, ...v] = a[i + 1].split('='); env[k] = v.join('='); }
  env.CONTENU_FICHIER = env.CONTENU_FICHIER.replace(/^\\/contenu/, m['/contenu']);
  const sh = m['/conteneur.sh'];
  const r = spawnSync('sh', [sh], { env, encoding: 'utf8' });
  mkdirSync(e.FAUX_ETAT, { recursive: true });
  writeFileSync(e.FAUX_ETAT + '/journal', (r.stdout ?? '') + (r.stderr ?? ''));
  writeFileSync(e.FAUX_ETAT + '/code', String(e.FAUX_ISSUE === 'oom' ? 137 : r.status ?? 1));
  writeFileSync(e.FAUX_ETAT + '/oom', e.FAUX_ISSUE === 'oom' ? 'true' : 'false');
  process.stdout.write('faux-conteneur-1\\n');
  process.exit(0);
}
if (a[0] === 'inspect') {
  const format = a[2];
  if (format.includes('Running')) process.stdout.write('false\\n');
  else if (format.includes('OOMKilled')) process.stdout.write(readFileSync(e.FAUX_ETAT + '/oom', 'utf8') + '\\n');
  else if (format.includes('ExitCode')) process.stdout.write(readFileSync(e.FAUX_ETAT + '/code', 'utf8') + '\\n');
  process.exit(0);
}
if (a[0] === 'stats') { process.stdout.write('812.5MiB / 1.6GiB\\n'); process.exit(0); }
if (a[0] === 'logs') { process.stdout.write(readFileSync(e.FAUX_ETAT + '/journal', 'utf8')); process.exit(0); }
if (a[0] === 'rm' || a[0] === 'kill') process.exit(0);
process.exit(1);
`;

/** Le bouchon de fabriquer-depuis-contenu.mjs du kit factice : contrôle ce que le conteneur lui donne (paquet, SITE_MODE=prod…), écrit un site et une mesure comme le vrai. */
export const FABRICATION_FACTICE = `
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const a = process.argv.slice(2);
const option = (n) => a[a.indexOf(n) + 1];
const db = new DatabaseSync(option('--contenu'), { readOnly: true });
const meta = db.prepare('SELECT mode, version FROM paquet_meta').get();
db.close();
const e = process.env;
appendFileSync(option('--mesure').replace(/fabrication.json$/, 'environnement.txt'), [e.SITE_MODE, e.HIDE_EXAMPLES, e.SITE_TAG, e.HOME, meta.mode, meta.version].join(' ') + '\\n');
if (e.FAUX_ISSUE === 'echec') { console.error('Fabrication en échec (étape astro) : essai'); process.exit(1); }
mkdirSync(option('--sortie') + '/ressources', { recursive: true });
for (const f of ['index.html', 'ressources/index.html', 'ressources/armes.html']) writeFileSync(option('--sortie') + '/' + f, '<html></html>');
writeFileSync(option('--sortie') + '/style.css', '');
writeFileSync(option('--mesure'), JSON.stringify({ statut: 'fait', duree_ms: 4321, sortie: { fichiers: 4, octets: 20 }, memoire: { pic_ko: 1048576 } }, null, 2));
`;

/** Un monde complet : creerMonde plus l'instance de dev (VERSION, atelier installé avec son kit factice), la production (VERSION, site) et le faux docker. */
export function creerLInstance(t, { changerDev, changerCopie, versionKit = DEV, structureKit = STRUCTURE, kit = true, atelier = true, memoire = [4_000_000, 3_300_000] } = {}) {
  const m = creerMonde(t, changerDev, changerCopie);
  const d = m.d;
  for (const x of ['dev/sauv', 'dev/atelier/outils', 'dev/atelier/rapports', 'dev/atelier/declencheur', 'bin', 'proc', 'sauv/prod/horaire/20261115-100000/db']) mkdirSync(d(x), { recursive: true });
  writeFileSync(d('dev', 'VERSION'), `tag=v${DEV}\nversion=${DEV}\ncommit=local\nmode=test\n`);
  writeFileSync(d('production', 'VERSION'), 'tag=v9.0\nversion=9.0.0\nmode=prod\n');
  mkdirSync(d('prod'), { recursive: true });
  copyFileSync(d('production', 'VERSION'), d('prod', 'VERSION'));
  // le site publié de la production du monde est celui de --prod (monté sur /production par le script) ; `production/` (V9.0) n'est qu'un leurre : une référence lue ailleurs se verrait à la version
  for (const x of ['donnees', '_serveur']) mkdirSync(d('prod', 'site', x), { recursive: true });
  copyFileSync(d('production', 'donnees', 'maverick.db'), d('prod', 'site', 'donnees', 'maverick.db'));
  writeFileSync(d('prod', 'site', '_serveur', 'version.json'), `${JSON.stringify({ version: PRODUCTION_PUBLIEE })}\n`);
  copyFileSync(m.copie, d('sauv', 'prod', 'horaire', '20261115-100000', 'db', 'vivante.db'));
  writeFileSync(d('sauv', 'prod', 'horaire', '20261115-100000', 'copie.meta'), 'INSTANCE=prod\nTYPE=horaire\nINSTANT=1794736800\n');
  if (atelier) {
    writeFileSync(d('dev', 'atelier', 'reglages.env'), 'MEMOIRE_MAX_KO=2621440\nBESOIN_KO=1153433\nDISQUE_MIN_KO=1024\nCPUS=1\n');
    for (const f of ['lib.sh', 'conteneur.sh']) copyFileSync(join(ATELIER, f), d('dev', 'atelier', 'outils', f));
    writeFileSync(d('dev', 'atelier', 'declencheur', 'marque'), `tag=v${DEV}\nversion=${DEV}\n`);
  }
  if (kit) {
    mkdirSync(d('dev', 'atelier', 'kit', 'client', 'scripts'), { recursive: true });
    mkdirSync(d('dev', 'atelier', 'kit', 'data'), { recursive: true });
    writeFileSync(d('dev', 'atelier', 'kit', 'kit.json'), `${JSON.stringify({ format: 'maverick-kit/1', version: versionKit, image: 'node:22-bookworm-slim' }, null, 2)}\n`);
    writeFileSync(d('dev', 'atelier', 'kit', 'client', 'package.json'), '{}\n');
    writeFileSync(d('dev', 'atelier', 'kit', 'client', 'scripts', 'fabriquer-depuis-contenu.mjs'), FABRICATION_FACTICE);
    writeFileSync(d('dev', 'atelier', 'kit', 'data', 'schema.sql'), `-- schéma factice du kit\nPRAGMA user_version = ${structureKit};   -- version\n`);
  }
  writeFileSync(d('proc', 'meminfo'), `MemTotal:       ${memoire[0]} kB\nMemFree:         100000 kB\nMemAvailable:   ${memoire[1]} kB\n`);
  writeFileSync(d('bin', 'faux-docker.mjs'), FAUX_DOCKER);
  writeFileSync(d('bin', 'docker'), `#!/bin/sh\nexec "${process.execPath}" "${d('bin', 'faux-docker.mjs')}" "$@"\n`);
  chmodSync(d('bin', 'docker'), 0o755);
  m.lancer = (args = ['--depuis-la-sauvegarde'], env = {}) => {
    const p = spawnSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8', timeout: 600_000,
      env: {
        PATH: `${d('bin')}:${process.env.PATH}`, HOME: m.r, LANG: 'C.UTF-8', ...variablesTemporaires(m.r),
        MAVERICK_DIR_TEST: d('dev'), MAVERICK_DIR_NORMAL: d('prod'), MAVERICK_SAUV_DOCKER: d('bin', 'docker'), MAVERICK_REPETITION_SAUVEGARDE: SAUVEGARDE,
        MAVERICK_DIR_SAUVEGARDES: d('sauv'), MAVERICK_DIR_ETC_SAUVEGARDES: d('etc'), MAVERICK_DIR_METRIQUES: d('prod', 'metriques'), MAVERICK_ESSAI: '1',
        MAVERICK_ATELIER_PROC: d('proc'), MAVERICK_ATELIER_CGROUP: d('cgroup'), MAVERICK_DIR_ETC_SYSTEMD: d('etc-systemd'), MAVERICK_ATELIER_INTERVALLE: '0',
        FAUX_JOURNAL: d('docker.log'), FAUX_ETAT: d('faux-etat'), FAUX_DEV: d('dev'), FAUX_CLIENT: CLIENT, FAUX_VERSION_DU_CODE: DEV, ...env,
      },
    });
    return { code: p.status, out: `${p.stdout}${p.stderr}` };
  };
  // le site de la production du monde : sa base vivante est celle de la copie (la vraie reste intacte)
  mkdirSync(d('prod', 'db'), { recursive: true });
  copyFileSync(m.copie, d('prod', 'db', 'vivante.db'));
  m.prodDb = d('prod', 'db', 'vivante.db');
  m.docker = () => (existsSync(d('docker.log')) ? readFileSync(d('docker.log'), 'utf8') : '');
  m.restes = () => (existsSync(d('dev', 'var')) ? readdirSync(d('dev', 'var')) : []);
  return m;
}

