// Aide des tests des sauvegardes automatiques (deploy/installateur/sauvegarde/) : un « monde » factice (deux instances, leurs bases SQLite, les dossiers
// des copies, des clés et des métriques, tous dans un dossier temporaire), les scripts lancés pour de bon avec bash, de faux « docker » et « systemctl ».
// Module sans test propre (n'est pas un *.test.mjs) : il est exercé par deploy-sauvegardes*.test.mjs.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

export const SCRIPTS = fileURLToPath(new URL('../../deploy/installateur/sauvegarde/', import.meta.url));
export const aOutil = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
export const SANS_BASH_SQLITE = !(aOutil('bash') && aOutil('sqlite3') && aOutil('flock')) && 'bash, sqlite3 ou flock indisponible';
export const SANS_RESTIC = SANS_BASH_SQLITE || (!aOutil('restic', 'version') && 'restic indisponible');

/** Une base SQLite d'essai : table `fiche` de `fiches` lignes, table `sort` de `sorts` lignes ; `wal` la laisse ouverte en mode WAL (le service écrit). */
export function creerBase(chemin, { fiches = 100, sorts = 30, wal = false, octets = 0 } = {}) {
  mkdirSync(join(chemin, '..'), { recursive: true });
  const db = new DatabaseSync(chemin);
  if (wal) db.exec('PRAGMA journal_mode = WAL');
  db.exec('CREATE TABLE fiche (id INTEGER PRIMARY KEY, nom TEXT, portrait BLOB); CREATE TABLE sort (id INTEGER PRIMARY KEY, nom TEXT); CREATE TABLE vide (a)');
  db.exec('BEGIN');
  for (let i = 0; i < fiches; i += 1) db.prepare('INSERT INTO fiche (nom, portrait) VALUES (?, ?)').run(`fiche ${i}`, octets ? Buffer.alloc(Math.ceil(octets / Math.max(1, fiches)), i % 251) : null);
  for (let i = 0; i < sorts; i += 1) db.prepare('INSERT INTO sort (nom) VALUES (?)').run(`sort ${i}`);
  db.exec('COMMIT');
  if (wal) return db;
  db.close();
  return null;
}
/** Change le nombre de lignes de `fiche` (supprime les plus hautes ou en ajoute) dans la base `chemin`. */
export function fixerFiches(chemin, n) {
  const db = new DatabaseSync(chemin);
  try {
    db.prepare('DELETE FROM fiche WHERE id > ?').run(n);
    const present = db.prepare('SELECT count(*) AS n FROM fiche').get().n;
    for (let i = present; i < n; i += 1) db.prepare('INSERT INTO fiche (nom) VALUES (?)').run(`nouvelle ${i}`);
  } finally {
    db.close();
  }
}
export const lignes = (chemin, table = 'fiche') => {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
  } finally {
    db.close();
  }
};

/**
 * Un monde d'essai : <racine>/normal (prod) et <racine>/test (dev) avec leur db/, sauv/ (copies), etc/ (clés), outils/ et systemd/.
 * `env` : l'environnement donné aux scripts (tous les dossiers sont réglés par variables, comme instances.sh).
 */
export function creerMonde(t, { instances = ['prod', 'dev'] } = {}) {
  const racine = dossierTemporaire('sauvegardes', { t });
  const d = (...p) => join(racine, ...p);
  for (const dossier of ['normal/db', 'normal/metriques', 'test/db', 'etc', 'bin', 'outils', 'systemd']) mkdirSync(d(dossier), { recursive: true });
  const env = {
    PATH: `${d('bin')}:${process.env.PATH}`, HOME: racine, ...variablesTemporaires(racine), LANG: 'C.UTF-8',
    MAVERICK_DIR_NORMAL: d('normal'), MAVERICK_DIR_TEST: d('test'), MAVERICK_DIR_SAUVEGARDES: d('sauv'), MAVERICK_DIR_ETC_SAUVEGARDES: d('etc'),
    MAVERICK_DIR_METRIQUES: d('normal', 'metriques'), MAVERICK_DIR_OUTILS: d('outils'), MAVERICK_DIR_ETC_SYSTEMD: d('systemd'),
    MAVERICK_SAUV_ATTENTE: '0', MAVERICK_ESSAI: '1', MAVERICK_SAUV_HORLOGE: '2026-11-14T10:00:00Z',
  };
  const dossierDe = (inst) => (inst === 'prod' ? d('normal') : d('test'));
  for (const inst of instances) creerBase(join(dossierDe(inst), 'db', 'vivante.db'));
  const lancer = (script, args = [], { extra = {}, input = '', interprete = 'bash' } = {}) => {
    const r = spawnSync(interprete, [join(SCRIPTS, script), ...args], { encoding: 'utf8', env: { ...env, ...extra }, input, timeout: 120_000 });
    return { code: r.status, out: `${r.stdout}${r.stderr}`, sortie: r.stdout, erreur: r.stderr };
  };
  /** Horloge des scripts : la date ISO d'un instant (chaque copie a son nom, à la seconde). */
  const a = (iso) => ({ MAVERICK_SAUV_HORLOGE: iso });
  const copies = (inst, type) => {
    const dir = d('sauv', inst, type);
    return existsSync(dir) ? readdirSync(dir).filter((n) => !n.startsWith('en-cours')).sort() : [];
  };
  const etat = () => JSON.parse(readFileSync(d('normal', 'metriques', 'sauvegardes.json'), 'utf8'));
  return { racine, d, env, dossierDe, lancer, a, copies, etat };
}

/** Un faux exécutable `nom` dans le dossier bin/ du monde (texte d'un script sh). */
export function fauxOutil(monde, nom, script) {
  const chemin = monde.d('bin', nom);
  writeFileSync(chemin, `#!/bin/sh\n${script}\n`);
  chmodSync(chemin, 0o755);
  return chemin;
}
/** Un « restic » de bin/ qui note chaque appel (les arguments seulement) dans `journal`, puis lance le vrai. */
export function resticEspion(monde, journal) {
  const reel = spawnSync('sh', ['-c', 'command -v restic'], { encoding: 'utf8' }).stdout.trim();
  fauxOutil(monde, 'restic', `printf '%s\\n' "$*" >> '${journal}'\nexec '${reel}' "$@"`);
}
/**
 * Un « docker » de bin/ : note ses arguments (`journal`) et ses montages (`journal`.montages), répond oui à `image` et `pull`, et pour `run` exécute
 * sur l'hôte la commande donnée à `sh -c`, les chemins du conteneur remplacés par ceux des montages (restic est celui de l'hôte).
 * `CORROMPRE=1` (variable de l'environnement) abîme ensuite la base restaurée, pour essayer le contrôle.
 */
export function fauxDocker(monde, journal) {
  fauxOutil(monde, 'docker', `
printf '%s\\n' "$*" >> '${journal}'
case "$1" in image|pull) exit 0 ;; esac
[ "$1" = run ] || exit 1
shift
: > '${journal}.montages'
while [ $# -gt 0 ]; do
  case "$1" in
    -v) printf '%s\\n' "$2" >> '${journal}.montages'; shift 2 ;;
    --pull|--cap-drop|--cap-add|--security-opt|--tmpfs|-e) shift 2 ;;
    --rm|--read-only) shift ;;
    *) break ;;
  esac
done
shift
[ "$1" = sh ] && [ "$2" = -c ] || exit 1
commande=$3
while IFS=: read -r hote conteneur reste; do
  case "$conteneur" in /cles/*|/sortie) commande=$(printf '%s' "$commande" | sed "s#$conteneur#$hote#g") ;; esac
done < '${journal}.montages'
sh -c "$commande" || exit $?
if [ "\${CORROMPRE:-0}" = 1 ]; then find "$(printf '%s' "$commande" | sed 's/.*--target //')" -name vivante.db -exec sh -c 'printf "pas une base" > "$1"' _ {} \\; ; fi
`);
}
