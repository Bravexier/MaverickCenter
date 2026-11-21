// Faux docker de l'essai de bout en bout de l'activation (tools/essai-activation/ ; docs/serveur.md, « PR 5a »). Il exécute en local les commandes que activer.sh donne à docker :
//  - `run -d … <image> <commande>` : la commande, dans un espace de noms de montage et de réseau (AUCUN réseau), une racine neuve en lecture seule faite de /usr, /etc et /opt en lecture
//    seule, les volumes montés aux chemins du conteneur (`-v hôte:conteneur[:ro]`, les montages imbriqués dans l'ordre), l'utilisateur de `--user` sans capacité ni nouveau privilège
//    (setpriv --bounding-set=-all --no-new-privs), PATH sans git, l'environnement de `-e` seulement ; son état (journal, code de sortie, pic de mémoire échantillonné) est gardé ;
//  - `compose stop|up|start|restart serveur` : le VRAI service de la production (site/_serveur/serveur/index.mjs de l'instance) sous un petit superviseur qui le relance quand il sort
//    (restart: unless-stopped : le service sort de lui-même quand version.json change) ; FAUX_CASSE_LA_VERSION=<X.Y.Z> : ce code-là ne démarre pas (le contrôle de santé échoue) ;
//  - `compose exec -T serveur node -e …` : le script, en local, contre le port du service.
// Aucune limite de mémoire n'est imposée (pas de cgroup mémoire ici). Variables : ESSAI_ACTIVATION (le monde, défaut /srv/essai-activation).
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const R = process.env.ESSAI_ACTIVATION || '/srv/essai-activation';
const PROD = `${R}/maverick-center`;
const SERVICE = `${R}/service`;
const PORT = '18787';
const a = process.argv.slice(2);

// ------------------------------------------------------------------ le superviseur du service (restart: unless-stopped)
if (a[0] === '--superviseur') {
  const lire = () => { try { return JSON.parse(readFileSync(`${PROD}/site/_serveur/version.json`, 'utf8')).version; } catch { return null; } };
  const journal = openSync(`${SERVICE}/journal`, 'a');
  let echecs = 0;
  while (!existsSync(`${SERVICE}/stop`)) {
    const version = lire();
    if (version && version === process.env.FAUX_CASSE_LA_VERSION) {
      appendFileSync(`${SERVICE}/journal`, `faux docker : le service V${version} ne démarre pas (FAUX_CASSE_LA_VERSION)\n`);
      await new Promise((ok) => setTimeout(ok, 1000));
      echecs += 1;
      if (echecs >= 3) break;
      continue;
    }
    const debut = Date.now();
    const enfant = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', `${PROD}/site/_serveur/serveur/index.mjs`], {
      stdio: ['ignore', journal, journal],
      env: { ...process.env, HOST: '127.0.0.1', PORT, MAVERICK_REGLES: `${PROD}/site/donnees/maverick.db`, MAVERICK_DB: `${PROD}/db`, MAVERICK_MAINTENANCE: `${PROD}/maintenance`,
        MAVERICK_DOSSIER_METRIQUES: `${PROD}/metriques`, MAVERICK_PAQUETS: `${PROD}/paquets`, MAVERICK_INSTANCE: 'prod', MAVERICK_EDITION: '0' },
    });
    writeFileSync(`${SERVICE}/enfant`, String(enfant.pid));
    const code = await new Promise((ok) => enfant.on('exit', (c) => ok(c)));
    if (existsSync(`${SERVICE}/stop`)) break;
    if (Date.now() - debut < 3000) { echecs += 1; if (echecs >= 3) break; } else echecs = 0;
    appendFileSync(`${SERVICE}/journal`, `faux docker : le service est sorti (code ${code}), il est relancé\n`);
  }
  process.exit(0);
}

const journalDeDocker = (ligne) => { mkdirSync(R, { recursive: true }); appendFileSync(`${R}/docker.log`, `${ligne}\n`); };
journalDeDocker(a.join(' '));
const vivant = (pid) => { try { process.kill(Number(pid), 0); return true; } catch { return false; } };
const pidDe = (fichier) => (existsSync(fichier) ? readFileSync(fichier, 'utf8').trim() : '');

function arreterLeService() {
  mkdirSync(SERVICE, { recursive: true });
  writeFileSync(`${SERVICE}/stop`, '');
  for (const f of ['superviseur', 'enfant']) { const p = pidDe(`${SERVICE}/${f}`); if (p && vivant(p)) { try { process.kill(Number(p), 'SIGTERM'); } catch { /* déjà sorti */ } } }
  const limite = Date.now() + 20000;
  const attendre = (ms) => spawnSync('sleep', [String(ms / 1000)]);
  while (Date.now() < limite && ['superviseur', 'enfant'].some((f) => { const p = pidDe(`${SERVICE}/${f}`); return p && vivant(p); })) attendre(200);
}
function lancerLeService() {
  mkdirSync(SERVICE, { recursive: true });
  const p = pidDe(`${SERVICE}/superviseur`);
  if (p && vivant(p) && !existsSync(`${SERVICE}/stop`)) return;
  rmSync(`${SERVICE}/stop`, { force: true });
  const sup = spawn(process.execPath, [new URL(import.meta.url).pathname, '--superviseur'], { detached: true, stdio: 'ignore', env: process.env });
  writeFileSync(`${SERVICE}/superviseur`, String(sup.pid));
  sup.unref();
}

if (a[0] === 'compose') {
  const i = a.indexOf('serveur');
  const verbe = a.slice(1).find((x) => ['stop', 'up', 'start', 'restart', 'exec', 'ps'].includes(x));
  if (verbe === 'stop') { arreterLeService(); process.exit(0); }
  if (verbe === 'up' || verbe === 'start') { lancerLeService(); process.exit(0); }
  if (verbe === 'restart') { arreterLeService(); lancerLeService(); process.exit(0); }
  if (verbe === 'ps') { const p = pidDe(`${SERVICE}/enfant`); if (p && vivant(p)) process.stdout.write('faux-service\n'); process.exit(0); }
  if (verbe === 'exec') {
    // FAUX_SANTE_MUETTE=<X.Y.Z> : ce code-là démarre (il refait la base) mais ne répond pas au contrôle de santé
    try { if (process.env.FAUX_SANTE_MUETTE && JSON.parse(readFileSync(`${PROD}/site/_serveur/version.json`, 'utf8')).version === process.env.FAUX_SANTE_MUETTE) process.exit(1); } catch { /* version illisible : le contrôle se fait */ }
    const n = a.indexOf('node');
    const r = spawnSync(process.execPath, a.slice(n + 1), { stdio: 'inherit', env: { ...process.env, PORT } });
    process.exit(r.status ?? 1);
  }
  void i;
  process.exit(1);
}
if (a[0] === 'image' && a[1] === 'inspect') process.exit(0);
if (a[0] === 'pull') process.exit(1);

// ------------------------------------------------------------------ l'échantillonneur du pic de mémoire (somme des RSS de l'arbre du conteneur)
if (a[0] === '--sampler') {
  const [, pid, etat] = a;
  let pic = 0;
  const arbre = () => {
    const ps = spawnSync('ps', ['-eo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).stdout.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
    const enfants = new Map();
    for (const [p, pp] of ps) { if (!enfants.has(pp)) enfants.set(pp, []); enfants.get(pp).push(p); }
    const rss = new Map(ps.map(([p, , r]) => [p, r]));
    let somme = 0;
    const pile = [Number(pid)];
    while (pile.length) { const p = pile.pop(); somme += rss.get(p) ?? 0; for (const e of enfants.get(p) ?? []) pile.push(e); }
    return somme;
  };
  while (!existsSync(`${etat}/exit`)) { pic = Math.max(pic, arbre()); writeFileSync(`${etat}/pic_ko`, String(pic)); await new Promise((ok) => setTimeout(ok, 300)); }
  process.exit(0);
}

if (a[0] === 'run') {
  const AVEC_VALEUR = new Set(['--name', '--network', '--cap-drop', '--security-opt', '--user', '--pids-limit', '--cpus', '--cpu-shares', '--memory', '--memory-swap', '--oom-score-adj', '--cgroup-parent', '-e', '-v']);
  const montages = [];
  const env = [];
  let utilisateur = '65534:65534';
  let i = 1;
  for (; i < a.length; i += 1) {
    if (!a[i].startsWith('-')) break;
    if (AVEC_VALEUR.has(a[i])) {
      const v = a[i + 1];
      if (a[i] === '-v') { const [h, c, o] = v.split(':'); montages.push({ h, c, ro: o === 'ro' }); }
      else if (a[i] === '-e') env.push(v);
      else if (a[i] === '--user') utilisateur = v;
      i += 1;
    }
  }
  const commande = a.slice(i + 1);
  const [uid, gid] = utilisateur.split(':');
  const cid = `faux${Math.random().toString(16).slice(2, 14)}`;
  const etat = `${R}/etat/${cid}`;
  mkdirSync(etat, { recursive: true });
  const racine = `${R}/racine-${cid}`;
  mkdirSync(racine, { recursive: true });
  montages.sort((x, y) => x.c.split('/').length - y.c.split('/').length);
  const lignes = [
    'set -e',
    'umask 022',
    `mount -t tmpfs tmpfs ${racine}`,
    `mkdir ${racine}/usr ${racine}/etc ${racine}/opt ${racine}/proc ${racine}/dev ${racine}/tmp ${racine}/bin-sans-git`,
    `for d in usr etc opt; do mount --bind -o ro /$d ${racine}/$d; done`,
    `ln -s usr/bin ${racine}/bin; ln -s usr/sbin ${racine}/sbin; ln -s usr/lib ${racine}/lib; [ ! -e /lib64 ] || ln -s usr/lib64 ${racine}/lib64`,
    `mount -t proc proc ${racine}/proc`,
    `mount --rbind /dev ${racine}/dev`,
    `mount -t tmpfs -o ro tmpfs ${racine}/tmp`,
    `mount --bind -o ro ${R}/bin-conteneur ${racine}/bin-sans-git`,
    ...montages.flatMap((v) => [statSync(v.h).isFile() ? `mkdir -p $(dirname ${racine}${v.c}); : > ${racine}${v.c}` : `mkdir -p ${racine}${v.c}`, `mount --bind ${v.ro ? '-o ro ' : ''}${v.h} ${racine}${v.c}`]),
    `mount -o remount,ro,bind ${racine} ${racine}`,
    `exec chroot ${racine} /usr/bin/setpriv --reuid ${uid} --regid ${gid} --clear-groups --no-new-privs --bounding-set=-all --inh-caps=-all /usr/bin/env -i PATH=/bin-sans-git ${env.map((e) => `'${e}'`).join(' ')} ${commande.map((c) => `'${c}'`).join(' ')}`,
  ];
  writeFileSync(`${etat}/lancement.sh`, `${lignes.join('\n')}\n`);
  const journal = openSync(`${etat}/journal`, 'w');
  const enfant = spawn('sh', ['-c', `unshare -m -n sh ${etat}/lancement.sh; echo $? > ${etat}/exit.tmp; mv ${etat}/exit.tmp ${etat}/exit; rmdir ${racine} 2>/dev/null; true`], { detached: true, stdio: ['ignore', journal, journal] });
  writeFileSync(`${etat}/pid`, String(enfant.pid));
  enfant.unref();
  spawn(process.execPath, [new URL(import.meta.url).pathname, '--sampler', String(enfant.pid), etat], { detached: true, stdio: 'ignore' }).unref();
  process.stdout.write(`${cid}\n`);
  process.exit(0);
}

const cid = a.at(-1);
const etat = `${R}/etat/${cid}`;
if (a[0] === 'inspect') {
  const format = a[2];
  if (format.includes('Running')) process.stdout.write(`${existsSync(`${etat}/exit`) ? 'false' : 'true'}\n`);
  else if (format.includes('OOMKilled')) process.stdout.write('false\n');
  else if (format.includes('ExitCode')) process.stdout.write(`${existsSync(`${etat}/exit`) ? readFileSync(`${etat}/exit`, 'utf8').trim() : ''}\n`);
  process.exit(0);
}
if (a[0] === 'stats') {
  const pic = existsSync(`${etat}/pic_ko`) ? Number(readFileSync(`${etat}/pic_ko`, 'utf8')) : 0;
  process.stdout.write(`${(pic / 1024).toFixed(1)}MiB / 2.5GiB\n`);
  process.exit(0);
}
if (a[0] === 'logs') { if (existsSync(`${etat}/journal`)) process.stdout.write(readFileSync(`${etat}/journal`)); process.exit(0); }
if (a[0] === 'kill' || a[0] === 'rm') {
  const pid = existsSync(`${etat}/pid`) ? readFileSync(`${etat}/pid`, 'utf8').trim() : '';
  if (pid && !existsSync(`${etat}/exit`)) spawnSync('pkill', ['-KILL', '-P', pid]);
  if (a[0] === 'rm') rmSync(etat, { recursive: true, force: true });
  process.exit(0);
}
process.exit(1);
