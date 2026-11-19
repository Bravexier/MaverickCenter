// Le monde de l'activation d'un kit par la production (lot 11, PR 5a), pour test/deploy-activer.test.mjs : une instance de production (VERSION, site, base vivante avec fiches sentinelles,
// outils de l'installateur, interrupteur), son kit factice (le VRAI code des contrôles, une fabrication factice, le vrai poser-un-site.mjs), un VRAI paquet de mise à jour (fabriquerPaquet),
// le dossier partagé des paquets, et un faux docker qui exécute en local ce que activer.sh lui demande (sans chroot : l'essai de bout en bout sous setpriv est tools/essai-activation/).
// Module sans test propre.
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireReference } from '../serveur/notes-de-version.mjs';
import { fabriquerPaquet } from '../serveur/paquet.mjs';
import { CIBLE, creerMonde, DEV, PROD as VERSION_PROD, sha, STRUCTURE } from './aide-repetition-bascule-2.mjs';
import { variablesTemporaires } from './aide-dossier-temporaire.mjs';

const INSTALLATEUR = fileURLToPath(new URL('../../deploy/installateur', import.meta.url));
const CLIENT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const SCHEMA = fileURLToPath(new URL('../../data/schema.sql', import.meta.url));
const have = (cmd, args = ['--version']) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
export const skipActivation = (!have('bash') && 'bash indisponible') || (!have('flock') && 'flock indisponible') || (!have('timeout') && 'timeout indisponible') || false;
export { CIBLE, DEV, STRUCTURE, sha };
export const LOT = '5a5a5a5a-0000-4000-8000-000000000001';
export const NOM_DU_PAQUET = `${CIBLE}-${LOT}.db`;

/** Le shim de sqlite3 (absent de certaines machines) : seulement `-readonly … ".backup '<destination>'"`, par VACUUM INTO. */
const SQLITE3 = `#!/bin/sh
exec ${JSON.stringify(process.execPath)} --no-warnings -e '
const { DatabaseSync } = require("node:sqlite");
const a = process.argv.slice(1).filter((x, i, t) => x !== "-readonly" && x !== "-cmd" && t[i - 1] !== "-cmd");
const dest = /\\.backup .(.+).$/.exec(a[1])[1];
const db = new DatabaseSync(a[0], { readOnly: true });
db.exec("VACUUM INTO \\x27" + dest.replace(/\\x27/g, "\\x27\\x27") + "\\x27");
' -- "$@"
`;

/**
 * Le faux docker. `run -d … <image> <commande>` exécute la commande en local, les chemins du conteneur remplacés par ceux de l'hôte d'après les montages (`-v`) ; son état (journal, code,
 * « tué par la mémoire ») est gardé pour `inspect`/`logs`. `compose stop|up|start|restart serveur` : un état de service ; `compose exec` : la réponse de /api/etat (la version du `_serveur`
 * posé, le service étant « en marche »). FAUX_SANTE : `muet` (aucune réponse), `autre` (une autre version) ; FAUX_BASE_REFAITE=1 : le service qui démarre sur le NOUVEAU code refait la base
 * (elle change) ; FAUX_ISSUE : `oom` (le conteneur de fabrication est tué par la mémoire), `echec_pose` (la pose des pages échoue, code 86).
 */
const FAUX_DOCKER = `
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2);
const e = process.env;
appendFileSync(e.FAUX_JOURNAL, a.join(' ') + '\\n');
const version = () => { try { return JSON.parse(readFileSync(e.FAUX_PROD + '/site/_serveur/version.json', 'utf8')).version; } catch { return null; } };
if (a[0] === 'compose') {
  const verbe = a.slice(1).find((x) => ['stop', 'up', 'start', 'restart', 'exec'].includes(x));
  if (verbe === 'stop') {
    writeFileSync(e.FAUX_SERVICE, 'arrete');
    try { appendFileSync(e.FAUX_ETAT + '/gels', readFileSync(e.FAUX_PROD + '/db/gel.json', 'utf8')); } catch { /* pas de gel posé */ }
    process.exit(0);
  }
  if (verbe === 'up' || verbe === 'start' || verbe === 'restart') {
    writeFileSync(e.FAUX_SERVICE, 'marche');
    if (e.FAUX_BASE_REFAITE === '1' && version() === e.FAUX_VERSION_NOUVELLE) appendFileSync(e.FAUX_PROD + '/db/vivante.db', Buffer.from('le nouveau service refait la base'));
    process.exit(0);
  }
  if (verbe === 'exec') {
    if (!existsSync(e.FAUX_SERVICE) || readFileSync(e.FAUX_SERVICE, 'utf8') !== 'marche' || (e.FAUX_SANTE === 'muet' && version() === e.FAUX_VERSION_NOUVELLE)) process.exit(1);
    const v = e.FAUX_SANTE === 'autre' && version() === e.FAUX_VERSION_NOUVELLE ? '0.0.1' : version();
    process.stdout.write('etat=' + JSON.stringify({ v, d: true, a: true }) + '\\n');
    process.exit(0);
  }
  process.exit(1);
}
if (a[0] === 'image' && a[1] === 'inspect') process.exit(0);
if (a[0] === 'pull') process.exit(1);
if (a[0] === 'run') {
  const AVEC_VALEUR = new Set(['--name', '--network', '--cap-drop', '--security-opt', '--user', '--pids-limit', '--cpus', '--cpu-shares', '--memory', '--memory-swap', '--oom-score-adj', '--cgroup-parent', '-e', '-v']);
  const m = []; const env = {};
  let i = 1;
  for (; i < a.length; i += 1) {
    if (!a[i].startsWith('-')) break;
    if (AVEC_VALEUR.has(a[i])) {
      if (a[i] === '-v') { const [h, c, o] = a[i + 1].split(':'); m.push({ h, c, ro: o === 'ro' }); }
      else if (a[i] === '-e') { const [k, ...v] = a[i + 1].split('='); env[k] = v.join('='); }
      i += 1;
    }
  }
  const commande = a.slice(i + 1);
  m.sort((x, y) => y.c.length - x.c.length);
  const hote = (x) => { for (const v of m) if (x === v.c || x.startsWith(v.c + '/')) return v.h + x.slice(v.c.length); return x; };
  for (const k of ['HOME', 'TMPDIR']) if (env[k]) env[k] = hote(env[k]);
  const nom = a[a.indexOf('--name') + 1];
  mkdirSync(e.FAUX_ETAT, { recursive: true });
  let r;
  if (e.FAUX_ISSUE === 'oom' && commande.includes('fabrication')) { writeFileSync(e.FAUX_ETAT + '/oom', 'true'); writeFileSync(e.FAUX_ETAT + '/code', '137'); writeFileSync(e.FAUX_ETAT + '/journal', ''); process.stdout.write('faux-conteneur\\n'); process.exit(0); }
  // un conteneur de pose qui ne finit pas (le signal arrive pendant la pose) : « inspect » dit « en marche » jusqu'à « rm -f » ou « kill »
  if (e.FAUX_ISSUE === 'enmarche' && nom.includes('pose-pages')) { writeFileSync(e.FAUX_ETAT + '/enmarche', ''); writeFileSync(e.FAUX_ETAT + '/oom', 'false'); writeFileSync(e.FAUX_ETAT + '/code', '0'); writeFileSync(e.FAUX_ETAT + '/journal', ''); process.stdout.write('faux-conteneur\\n'); process.exit(0); }
  if (e.FAUX_ISSUE === 'echec_pose' && nom.includes('pose-pages')) { writeFileSync(e.FAUX_ETAT + '/oom', 'false'); writeFileSync(e.FAUX_ETAT + '/code', '86'); writeFileSync(e.FAUX_ETAT + '/journal', ''); process.stdout.write('faux-conteneur\\n'); process.exit(0); }
  const chemins = { SERVEUR_KIT: hote('/serveur-kit'), KIT: hote('/kit'), PAQUETS: hote('/paquets'), TRAVAIL: hote('/travail'), RESULTATS: hote('/resultats'), PRODUCTION: hote('/production') };
  if (commande[0] === 'sh' && commande[1] === '/conteneur.sh') {
    r = spawnSync('sh', [hote('/conteneur.sh'), ...commande.slice(2)], { encoding: 'utf8', env: { ...process.env, ...env, ...chemins } });
  } else if (commande[0] === 'sh' && commande[1] === '-c') {
    // la copie du site précédent : « cp -RP … /site/. /precedent/ »
    r = spawnSync('cp', ['-RP', hote('/site') + '/.', hote('/precedent') + '/'], { encoding: 'utf8' });
  } else {
    r = spawnSync(process.execPath, ['--no-warnings', ...commande.slice(1).map(hote)], { encoding: 'utf8', env: { ...process.env, ...env } });
  }
  // un conteneur de fabrication qui laisse un LIEN à la place de son site : root le refuse avant tout montage
  if (e.FAUX_ISSUE === 'lien_site' && commande.includes('fabrication')) { rmSync(hote('/travail') + '/site', { recursive: true, force: true }); symlinkSync(e.FAUX_ETAT, hote('/travail') + '/site'); }
  writeFileSync(e.FAUX_ETAT + '/journal', (r.stdout ?? '') + (r.stderr ?? ''));
  writeFileSync(e.FAUX_ETAT + '/code', String(r.status ?? 1));
  writeFileSync(e.FAUX_ETAT + '/oom', 'false');
  process.stdout.write('faux-conteneur\\n');
  process.exit(0);
}
if (a[0] === 'inspect') {
  const format = a[2];
  if (format.includes('Running')) process.stdout.write(existsSync(e.FAUX_ETAT + '/enmarche') ? 'true\\n' : 'false\\n');
  else if (format.includes('OOMKilled')) process.stdout.write(readFileSync(e.FAUX_ETAT + '/oom', 'utf8') + '\\n');
  else if (format.includes('ExitCode')) process.stdout.write(readFileSync(e.FAUX_ETAT + '/code', 'utf8') + '\\n');
  process.exit(0);
}
if (a[0] === 'stats') { process.stdout.write('812.5MiB / 1.6GiB\\n'); process.exit(0); }
if (a[0] === 'logs') { process.stdout.write(readFileSync(e.FAUX_ETAT + '/journal', 'utf8')); process.exit(0); }
if (a[0] === 'rm' || a[0] === 'kill') { rmSync(e.FAUX_ETAT + '/enmarche', { force: true }); process.exit(0); }
process.exit(1);
`;

/** La fabrication factice du kit : un site de production (index, pages, `_serveur` de la version du kit, donnees/maverick.db) et sa mesure ; elle lit le paquet qu'on lui donne. */
const FABRICATION_FACTICE = `
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const a = process.argv.slice(2);
const option = (n) => a[a.indexOf(n) + 1];
const db = new DatabaseSync(option('--contenu'), { readOnly: true });
const meta = db.prepare('SELECT mode, version FROM paquet_meta').get();
db.close();
const sortie = option('--sortie');
for (const d of ['ressources', '_serveur/serveur', 'donnees']) mkdirSync(sortie + '/' + d, { recursive: true });
for (const f of ['index.html', 'ressources/index.html', 'ressources/armes.html', 'ressources/magies.html', 'ressources/classes.html']) writeFileSync(sortie + '/' + f, '<html>' + meta.version + '</html>');
writeFileSync(sortie + '/style.css', '');
writeFileSync(sortie + '/_serveur/serveur/index.mjs', '// service FALSIFIÉ : celui de la sortie de la fabrication, que le contenu a pu influencer');
writeFileSync(sortie + '/_serveur/version.json', JSON.stringify({ version: process.env.SITE_VERSION_DU_KIT }, null, 2) + '\\n');
writeFileSync(sortie + '/donnees/maverick.db', 'les regles du paquet ' + meta.version);
writeFileSync(option('--mesure'), JSON.stringify({ statut: 'fait', duree_ms: 4321, sortie: { fichiers: 9, octets: 20 }, memoire: { pic_ko: 1048576 } }, null, 2));
`;

/**
 * Un monde d'activation. `options` : `versionDuKit` (DEV), `structureDuKit`, `paquet` (false : le kit n'annonce aucun paquet), `interrupteur` (true), `changerDev`/`changerCopie` (comme creerMonde).
 * Rend { r, d, prod, paquets, activation, kit, identite, lancer(args, env), docker(), sha de la base, arbre(dossier), … }.
 */
export function creerLActivation(t, options = {}) {
  const { versionDuKit = DEV, structureDuKit = STRUCTURE, paquet = true, interrupteur = true, changerDev, changerCopie, memoire = [16_000_000, 15_000_000] } = options;
  const m = creerMonde(t, changerDev, changerCopie);
  const d = m.d;
  const prod = d('maverick-center');
  for (const x of ['site/_serveur', 'site/donnees', 'db', 'paquets', 'activation/kit/client/scripts', 'activation/kit/data']) mkdirSync(join(prod, x), { recursive: true });
  for (const x of ['bin', 'proc', 'faux-etat']) mkdirSync(d(x), { recursive: true });
  // la production d'avant : son site (V9.0.0), sa base vivante avec les fiches sentinelles
  writeFileSync(join(prod, 'VERSION'), 'tag=v9.0\nversion=9.0.0\ncommit=local\nmode=prod\n');
  writeFileSync(join(prod, 'docker-compose.yml'), 'services: {}\n');
  writeFileSync(join(prod, 'site', 'index.html'), '<html>9.0</html>');
  for (const f of ['ressources/index.html', 'ressources/armes.html', 'ressources/magies.html', 'ressources/vieille-page.html']) { mkdirSync(join(prod, 'site', 'ressources'), { recursive: true }); writeFileSync(join(prod, 'site', f), '<html>9.0</html>'); }
  copyFileSync(m.d('production', 'donnees', 'maverick.db'), join(prod, 'site', 'donnees', 'maverick.db'));
  writeFileSync(join(prod, 'site', '_serveur', 'version.json'), `${JSON.stringify({ version: VERSION_PROD })}\n`);
  mkdirSync(join(prod, 'site', '_serveur', 'serveur'), { recursive: true });
  writeFileSync(join(prod, 'site', '_serveur', 'serveur', 'index.mjs'), '// le service précédent');
  writeFileSync(join(prod, 'site', '_serveur', 'ancien.mjs'), '// le service précédent');
  copyFileSync(m.copie, join(prod, 'db', 'vivante.db'));
  // les outils que l'installateur de production pose à la racine
  for (const f of ['activer.sh', 'activation-conteneur.sh', 'gel.sh']) { copyFileSync(join(INSTALLATEUR, f), join(prod, f)); chmodSync(join(prod, f), 0o755); }
  if (interrupteur) writeFileSync(join(prod, 'activation-par-paquet'), '');
  writeFileSync(join(prod, 'activation', 'reglages.env'), 'DISQUE_MIN_KO=1024\n');
  // le paquet de la mise à jour (un VRAI paquet), déposé comme le fait le site de dev, et le kit qui l'annonce
  const reference = lireReference({ production: join(prod, 'site'), propre: null });
  const travailPaquet = d('paquet-fabrique');
  mkdirSync(travailPaquet);
  const fichier = join(travailPaquet, 'paquet.db');
  fabriquerPaquet({ source: m.dev, destination: fichier, production: reference.chemin, id: LOT, mode: 'mise-a-jour', version: CIBLE, depuis: '9.0', versionDuSite: DEV, instant: new Date('2026-11-20T10:00:00Z') });
  copyFileSync(fichier, join(prod, 'paquets', NOM_DU_PAQUET));
  const identite = { lot: LOT, version: CIBLE, empreinte: sha(fichier), structure: STRUCTURE };
  const kit = join(prod, 'activation', 'kit');
  writeFileSync(join(kit, 'kit.json'), `${JSON.stringify({ format: 'maverick-kit/1', version: versionDuKit, image: 'node:22-bookworm-slim', structure: structureDuKit, paquet: paquet ? identite : null }, null, 2)}\n`);
  writeFileSync(join(kit, 'client', 'package.json'), '{}\n');
  copyFileSync(SCHEMA, join(kit, 'data', 'schema.sql'));
  // le code du kit : les contrôles et la pose du dépôt (le vrai), la fabrication factice ; `serveur/` et `src/` sont ceux du dépôt, que les modules du kit atteignent par leur chemin relatif
  for (const f of ['activation-controles.mjs', 'repetition-prod.mjs', 'poser-un-site.mjs']) copyFileSync(join(CLIENT, 'scripts', f), join(kit, 'client', 'scripts', f));
  symlinkSync(join(CLIENT, 'serveur'), join(kit, 'client', 'serveur'));
  symlinkSync(join(CLIENT, 'src'), join(kit, 'client', 'src'));
  writeFileSync(join(kit, 'client', 'scripts', 'fabriquer-depuis-contenu.mjs'), FABRICATION_FACTICE);
  // la mémoire et les outils de la machine
  writeFileSync(d('proc', 'meminfo'), `MemTotal:       ${memoire[0]} kB\nMemFree:         100000 kB\nMemAvailable:   ${memoire[1]} kB\n`);
  writeFileSync(d('bin', 'faux-docker.mjs'), FAUX_DOCKER);
  writeFileSync(d('bin', 'docker'), `#!/bin/sh\nexec "${process.execPath}" "${d('bin', 'faux-docker.mjs')}" "$@"\n`);
  writeFileSync(d('bin', 'sqlite3'), SQLITE3);
  chmodSync(d('bin', 'docker'), 0o755);
  chmodSync(d('bin', 'sqlite3'), 0o755);
  const lancer = (args = [], env = {}) => {
    const p = spawnSync('bash', [join(prod, 'activer.sh'), ...args], {
      encoding: 'utf8', timeout: 300_000,
      env: {
        PATH: `${d('bin')}:${process.env.PATH}`, HOME: m.r, LANG: 'C.UTF-8', ...variablesTemporaires(m.r),
        MAVERICK_DIR_NORMAL: prod, MAVERICK_DIR_TEST: d('maverick-center-test'), MAVERICK_SAUV_DOCKER: d('bin', 'docker'), MAVERICK_ESSAI: '1', MAVERICK_ACTIVATION_UTILISATEUR: '65000:65000',
        MAVERICK_ACTIVATION_PROC: d('proc'), MAVERICK_ACTIVATION_CGROUP: d('cgroup'), MAVERICK_DIR_ETC_SYSTEMD: d('etc-systemd'), MAVERICK_ACTIVATION_INTERVALLE: '0', MAVERICK_ACTIVATION_SANTE: '2',
        FAUX_JOURNAL: d('docker.log'), FAUX_ETAT: d('faux-etat'), FAUX_SERVICE: d('service.etat'), FAUX_PROD: prod, FAUX_VERSION_NOUVELLE: versionDuKit, SITE_VERSION_DU_KIT: versionDuKit, ...env,
      },
    });
    return { code: p.status, out: `${p.stdout}${p.stderr}` };
  };
  /** Le sha256 de tous les fichiers d'un dossier (noms et octets), pour dire « rien n'a changé ». */
  const arbre = (dossier) => {
    const lister = (rel = '') => readdirSync(join(dossier, rel), { withFileTypes: true }).flatMap((e) => { const c = rel ? `${rel}/${e.name}` : e.name; return e.isDirectory() ? lister(c) : [c]; }).sort();
    return lister().map((f) => `${f}:${sha(join(dossier, f))}`).join('\n');
  };
  writeFileSync(d('service.etat'), 'marche');
  return {
    ...m, prod, paquets: join(prod, 'paquets'), activation: join(prod, 'activation'), kit, identite, lancer, arbre,
    docker: () => (existsSync(d('docker.log')) ? readFileSync(d('docker.log'), 'utf8') : ''),
    base: () => sha(join(prod, 'db', 'vivante.db')),
    rapport: () => JSON.parse(readFileSync(join(prod, 'activation', 'rapport.json'), 'utf8')),
    rapportPartage: () => (existsSync(join(prod, 'paquets', 'activation.json')) ? readFileSync(join(prod, 'paquets', 'activation.json'), 'utf8') : null),
  };
}
