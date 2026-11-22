// Le déménagement du serveur (deploy/vps/DEMENAGEMENT.md) : demenagement.sh (emballer, déballer), controle-demenagement.sh (bilan, comparer) et la
// répétition qui joue toute la procédure sur deux serveurs jetables (deploy/vps/repetition-demenagement.sh). Rien n'est joué sur un vrai serveur :
// des dossiers, de faux « docker », « systemctl » et « crontab ». Sans sqlite3 sur la machine, un faux (node:sqlite) en tient lieu : seule l'interface
// utilisée par les scripts (`sqlite3 [-readonly] <base> "<SQL>"`) y est reproduite. Les scripts sont lancés par bash : sans lui, ces cas sont ignorés.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const VPS = fileURLToPath(new URL('../../deploy/vps/', import.meta.url));
const EMPREINTES = fileURLToPath(new URL('../serveur/empreintes.mjs', import.meta.url));
const SCRIPTS = ['demenagement.sh', 'controle-demenagement.sh', 'repetition-demenagement.sh'];
const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !have('bash') && 'bash indisponible';
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

const racine = dossierTemporaire('demenagement');

// Le vrai sqlite3 s'il est là, sinon un faux : une commande par instruction, « SELECT » et « PRAGMA » affichent leurs lignes séparées par « | », et la seule
// commande en point que les scripts appellent (controle-demenagement.sh, copier-db) : « .backup '<fichier>' », copie cohérente de la base (backup de node:sqlite).
function sqlite3() {
  if (have('sqlite3')) return 'sqlite3';
  const dossier = join(racine, 'faux-sqlite3');
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, 'sqlite3.mjs'), `import { backup, DatabaseSync } from 'node:sqlite';
const args = process.argv.slice(2);
if (args[0] === '-readonly') args.shift();
const db = new DatabaseSync(args[0]);
const sauvegarde = /^\\.backup\\s+'([^']*)'$/.exec(args[1].trim());
if (sauvegarde) await backup(db, sauvegarde[1]);
else if (args[1].trim().startsWith('.')) throw new Error('commande en point non reproduite : ' + args[1]);
else for (const instruction of args[1].split(';').map((s) => s.trim()).filter(Boolean)) {
  if (/^(SELECT|PRAGMA)\\b/i.test(instruction)) {
    for (const ligne of db.prepare(instruction).all()) console.log(Object.values(ligne).join('|'));
  } else db.exec(instruction);
}
db.close();
`);
  const commande = join(dossier, 'sqlite3');
  writeFileSync(commande, `#!/bin/sh\nexec node --disable-warning=ExperimentalWarning "${join(dossier, 'sqlite3.mjs')}" "$@"\n`);
  chmodSync(commande, 0o755);
  return commande;
}

function lancer(script, args, extra = {}) {
  const dossier = dossierTemporaire('demenagement-env', { dans: racine });
  return spawnSync('bash', [join(VPS, script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...variablesTemporaires(dossier), MAVERICK_SQLITE3: sqlite3(), MAVERICK_CONTROLE_EMPREINTES: EMPREINTES, ...extra },
  });
}

test('les trois scripts sont de la syntaxe bash valide, relançables (set -euo pipefail) et en LF', { skip }, () => {
  for (const f of SCRIPTS) {
    const r = spawnSync('bash', ['-n', join(VPS, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f} : ${r.stderr}`);
    const texte = readFileSync(join(VPS, f), 'utf8');
    assert.match(texte, /^set -euo pipefail$/m, `${f} : set -euo pipefail`);
    assert.doesNotMatch(texte, /\r/, `${f} : fins de ligne LF`);
  }
});

test('aucune adresse IP, aucun nom d\'hôte ni secret dans les scripts et le document du déménagement (le dépôt est public)', () => {
  for (const f of [...SCRIPTS, 'DEMENAGEMENT.md']) {
    const texte = readFileSync(join(VPS, f), 'utf8');
    const ip = [...texte.matchAll(/\b(\d{1,3}\.){3}\d{1,3}\b/g)].map((m) => m[0]).filter((a) => a !== '127.0.0.1');
    assert.deepEqual(ip, [], `${f} : adresse IP`);
    assert.doesNotMatch(texte, /\bov-[a-z0-9-]+|\bvps-[0-9a-f]{6,}|BEGIN [A-Z ]*PRIVATE KEY/i, `${f} : nom d'hôte ou clé`);
  }
});

test('étape 3 du guide en bascule 2 : production par un installateur complet de la version exacte, interrupteur avant lui, Caddy arrêté jusqu\'au jour J', () => {
  const guide = readFileSync(join(VPS, 'DEMENAGEMENT.md'), 'utf8').replace(/\r\n/g, '\n');
  const etape3 = guide.slice(guide.indexOf('## 3. Préparer'), guide.indexOf('## 4. La veille'));
  assert.match(etape3, /fabriquer\.mjs --mode prod --site \S+ --tag <tag> --version <version> --sha <commit>/, 'installateur complet de la version de l\'ancien');
  assert.doesNotMatch(etape3, /fabriquer\.mjs[^\n]*--kit-seul/, 'jamais un kit seul : il refuse une instance sans site');
  const pose = etape3.indexOf('sudo sh ~/installateurs/maverick-center-<tag>-install.sh --dossier /srv/maverick-center\n');
  assert.ok(pose > 0, 'pose réelle de la production');
  assert.ok(etape3.lastIndexOf('sudo touch /srv/maverick-center/activation-par-paquet\n', pose) > 0, 'activation-par-paquet avant l\'installateur : il crée maverick-site');
  const apresInstances = etape3.slice(etape3.indexOf('sudo bash ~/vps/instances.sh'), etape3.indexOf('**Poser les deux sites**'));
  assert.match(apresInstances, /^sudo systemctl stop caddy$/m, 'Caddy arrêté tant que le DNS pointe sur l\'ancien serveur');
});

test('jour J en bascule 2 : le kit de la version de l\'ancien revient avant l\'atelier, les écarts attendus du contrôle se vérifient sans afficher de valeur', () => {
  const guide = readFileSync(join(VPS, 'DEMENAGEMENT.md'), 'utf8').replace(/\r\n/g, '\n');
  const etape9 = guide.slice(guide.indexOf('### 9. Démarrer'), guide.indexOf('### 10. Changer'));
  const kit = etape9.indexOf('sudo sh /srv/maverick-center-test/installateur-courant/maverick-center-$TAG-install.sh --dossier /srv/maverick-center-test\n');
  assert.ok(kit > 0, 'installateur gardé de l\'ancien : l\'archive n\'emporte jamais atelier/kit/');
  assert.ok(kit > etape9.indexOf('cd /srv/maverick-center-test && sudo docker compose up -d'), 'service démarré : l\'installateur lui fait essayer les migrations');
  assert.ok(kit < etape9.indexOf('installer.sh --sans-fabrication'), 'kit posé avant l\'atelier : --servir lance une fabrication');
  const etape8f = guide.slice(guide.indexOf('**8f. Comparer**'), guide.indexOf('### 9. Démarrer'));
  for (const ecart of ['fichier.copies.nombre', 'secret.normal..env', 'secret.test..env']) assert.ok(etape8f.includes(ecart), `écart attendu expliqué : ${ecart}`);
  const controles = etape8f.match(/^ *comm -\d+ .*$/gm) ?? [];
  assert.equal(controles.length, 2, 'lignes disparues ou changées, puis clés ajoutées');
  for (const c of controles) assert.match(c, /\| sed 's\/=\.\*\/\/'$/, 'jamais une valeur du .env à l\'écran');
});

test('R308 : serveur et sauvegardes chez OVH, plus aucun texte d\'hébergement n\'exige un autre fournisseur que l\'hébergeur', () => {
  const lire = (...chemin) => readFileSync(join(VPS, ...chemin), 'utf8').replace(/\s+/g, ' ');
  const registre = lire('..', '..', 'docs', 'decisions-regles.md');
  assert.match(registre, /\| R308 \| .*?remplace R275 \(1\)/, 'la décision est au registre et dit ce qu\'elle remplace');
  const textes = {
    guide: lire('DEMENAGEMENT.md'), readme: lire('README.md'), fluxGit: lire('..', '..', 'docs', 'flux-git.md'),
    envoi: lire('..', 'installateur', 'sauvegarde', 'envoi.sh'), installer: lire('..', 'installateur', 'sauvegarde', 'installer.sh'),
  };
  for (const [nom, texte] of Object.entries(textes)) assert.doesNotMatch(texte, /autre fournisseur que l'hébergeur/, nom);
  assert.doesNotMatch(textes.guide, /chez deux fournisseurs/, 'guide');
  assert.match(textes.guide, /phrase de chiffrement gardée hors d'OVH/, 'la phrase survit à un problème de compte et se transmet à la passation');
});

test('la répétition joue toute la procédure : gel refusé puis accepté, emballage, archive altérée refusée, base présente jamais écrasée, déballage, EGALITE, DIFFERENCE, retour arrière', { skip }, (t) => {
  const monde = dossierTemporaire('demenagement-repetition', { t });
  const r = lancer('repetition-demenagement.sh', ['--dossier', join(monde, 'repetition')]);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /REPETITION REUSSIE/);
  for (const etape of ['emballer refuse tant que le service tourne', 'archive altérée ou tronquée : refusée', 'une base déjà présente fait refuser', 'contrôle : EGALITE', 'base altérée : DIFFERENCE', 'retour arrière', 'unité de l\'atelier active', 'bascule 2 : paquets']) {
    assert.ok(r.stdout.includes(etape), `étape jouée : ${etape}\n${r.stdout}`);
  }
  assert.equal(existsSync(join(monde, 'repetition')), false, 'la répétition fait son ménage');
});

test('la répétition refuse un dossier qui n\'est pas vide', { skip }, (t) => {
  const monde = dossierTemporaire('demenagement-plein', { t });
  writeFileSync(join(monde, 'present'), 'x');
  const r = lancer('repetition-demenagement.sh', ['--dossier', monde]);
  assert.equal(r.status, 2);
  assert.equal(readFileSync(join(monde, 'present'), 'utf8'), 'x');
});

test('comparer : EGALITE sur deux bilans identiques, DIFFERENCE (code 1) avec la ligne en cause sinon, une valeur indisponible n\'est jamais une égalité', { skip }, (t) => {
  const d = dossierTemporaire('demenagement-comparer', { t });
  const bilan = (lignes) => lignes.join('\n') + '\n';
  const a = join(d, 'a.txt');
  const b = join(d, 'b.txt');
  const base = ['format=maverick-bilan-demenagement/1', 'mode=complet', 'info.date=2026-01-01', 'fiches.test=3', 'logique.test=' + 'a'.repeat(64), 'fichier.test.vivante.db=' + 'b'.repeat(64) + ' 10'];
  writeFileSync(a, bilan(base));
  writeFileSync(b, bilan(base.map((l) => l.replace('2026-01-01', '2027-02-02'))));
  let r = lancer('controle-demenagement.sh', ['comparer', a, b]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^EGALITE/);
  writeFileSync(b, bilan(base.map((l) => l.replace('fiches.test=3', 'fiches.test=4'))));
  r = lancer('controle-demenagement.sh', ['comparer', a, b]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^DIFFERENCE/);
  assert.match(r.stdout, /fiches\.test : ancien : 3 \| nouveau : 4/);
  writeFileSync(b, bilan(base.filter((l) => !l.startsWith('logique.'))));
  r = lancer('controle-demenagement.sh', ['comparer', a, b]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /logique\.test : absente du bilan nouveau/);
  const indispo = base.map((l) => (l.startsWith('logique.') ? 'logique.test=indisponible' : l));
  writeFileSync(a, bilan(indispo));
  writeFileSync(b, bilan(indispo));
  r = lancer('controle-demenagement.sh', ['comparer', a, b]);
  assert.equal(r.status, 1, 'deux « indisponible » ne prouvent rien');
  // --contenu-seulement d'un côté (service démarré) : fichiers, lignes et logique ne se comparent pas, fiches et contenu oui
  writeFileSync(a, bilan([...base, 'lignes.test.session=0', 'contenu.test=' + 'c'.repeat(64)]));
  const demarre = [...base.filter((l) => !/^(fichier|logique)\./.test(l)), 'contenu.test=' + 'c'.repeat(64)].map((l) => l.replace('mode=complet', 'mode=contenu'));
  writeFileSync(b, bilan(demarre));
  r = lancer('controle-demenagement.sh', ['comparer', a, b]);
  assert.equal(r.status, 0, r.stdout);
  writeFileSync(b, bilan(demarre.map((l) => l.replace('fiches.test=3', 'fiches.test=2'))));
  r = lancer('controle-demenagement.sh', ['comparer', a, b]);
  assert.equal(r.status, 1, 'une fiche de moins se voit même après le démarrage');
  writeFileSync(b, bilan(demarre.map((l) => l.replace('c'.repeat(64), 'd'.repeat(64)))));
  r = lancer('controle-demenagement.sh', ['comparer', a, b]);
  assert.equal(r.status, 1, 'le contenu des règles qui change se voit');
  assert.match(r.stdout, /contenu\.test/);
});

test('copier-db replie le journal -wal d\'une base arrêtée dans la copie, sans jamais modifier les fichiers d\'origine', { skip }, (t) => {
  const d = dossierTemporaire('demenagement-wal', { t });
  const source = join(d, 'db');
  mkdirSync(join(source, 'essai-de-structure'), { recursive: true });
  const vivante = join(source, 'vivante.db');
  // une base en mode WAL dont les écritures sont encore dans le -wal : on en prend les fichiers pendant qu'elle est ouverte, comme après un arrêt brutal
  const db = new DatabaseSync(vivante);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0; CREATE TABLE personnage (id INTEGER PRIMARY KEY, nom TEXT)");
  db.exec("INSERT INTO personnage (nom) VALUES ('un'), ('deux'), ('trois')");
  const fige = join(d, 'fige');
  mkdirSync(join(fige, 'essai-de-structure'), { recursive: true });
  for (const f of ['vivante.db', 'vivante.db-wal', 'vivante.db-shm']) if (existsSync(join(source, f))) copyFileSync(join(source, f), join(fige, f));
  db.close();
  assert.ok(existsSync(join(fige, 'vivante.db-wal')), 'le -wal est là (le cas à éprouver)');
  writeFileSync(join(fige, 'essai-de-structure', 'demande'), 'x');
  writeFileSync(join(fige, 'source'), 'version=1\n');
  const avant = Object.fromEntries(readdirSync(fige).filter((f) => f.startsWith('vivante') || f === 'source').map((f) => [f, sha(join(fige, f))]));

  const copie = join(d, 'copie');
  const r = lancer('controle-demenagement.sh', ['copier-db', fige, copie], { MAVERICK_ESSAI: '1' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(readdirSync(copie).sort(), ['source', 'vivante.db'], 'ni -wal, ni -shm, ni dossier d\'essai dans la copie');
  const lue = new DatabaseSync(join(copie, 'vivante.db'), { readOnly: true });
  assert.equal(lue.prepare('SELECT count(*) AS n FROM personnage').get().n, 3, 'les écritures du -wal sont dans la copie');
  lue.close();
  for (const [f, h] of Object.entries(avant)) assert.equal(sha(join(fige, f)), h, `${f} d'origine est intact`);
});

test('emballer refuse des conteneurs en marche et deballer refuse une archive qui n\'est pas une archive de déménagement', { skip }, (t) => {
  const d = dossierTemporaire('demenagement-refus', { t });
  const env = {
    MAVERICK_ESSAI: '1', MAVERICK_DIR_NORMAL: join(d, 'n'), MAVERICK_DIR_TEST: join(d, 't'),
    MAVERICK_DIR_ETC_SAUVEGARDES: join(d, 'etc'), MAVERICK_DIR_SAUVEGARDES: join(d, 'sauv'), MAVERICK_DIR_CADDY_DATA: join(d, 'caddy'),
  };
  for (const i of ['n', 't']) mkdirSync(join(d, i, 'db'), { recursive: true });
  const docker = join(d, 'docker');
  writeFileSync(docker, '#!/bin/sh\necho conteneur-en-marche\n');
  chmodSync(docker, 0o755);
  let r = lancer('demenagement.sh', ['emballer', '--sortie', d], { ...env, MAVERICK_DOCKER: docker });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /service tourne/);
  assert.deepEqual(readdirSync(d).filter((f) => f.endsWith('.tar.gz') || f.startsWith('.demenagement')), [], 'rien n\'est écrit');
  const faux = join(d, 'faux.tar.gz');
  const dossier = join(d, 'rien');
  mkdirSync(dossier);
  writeFileSync(join(dossier, 'a'), 'a');
  assert.equal(spawnSync('tar', ['-czf', '../faux.tar.gz', '.'], { cwd: dossier }).status, 0);
  r = lancer('demenagement.sh', ['deballer', faux], env);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pas une archive de déménagement/);
  r = lancer('demenagement.sh', ['deballer', '--sans', 'Pas Bon', faux], env);
  assert.equal(r.status, 2, 'usage');
});

// Deux serveurs minimaux (instances, une vraie base chacune, faux outils muets) pour les cas de refus et de reprise de demenagement.sh.
function monde(t, { versionDuNouveau = '0.9.1' } = {}) {
  const r = dossierTemporaire('demenagement-monde', { t });
  for (const [nom, corps] of [['docker', ''], ['systemctl', 'exit 1\n'], ['crontab', '']]) {
    mkdirSync(join(r, 'bin'), { recursive: true });
    writeFileSync(join(r, 'bin', nom), `#!/bin/sh\n${corps}`);
    chmodSync(join(r, 'bin', nom), 0o755);
  }
  const env = (c) => ({
    MAVERICK_ESSAI: '1', MAVERICK_DIR_NORMAL: join(r, c, 'n'), MAVERICK_DIR_TEST: join(r, c, 't'),
    MAVERICK_DIR_ETC_SAUVEGARDES: join(r, c, 'etc'), MAVERICK_DIR_SAUVEGARDES: join(r, c, 'sauv'), MAVERICK_DIR_CADDY_DATA: join(r, c, 'caddy'),
    MAVERICK_DOCKER: join(r, 'bin', 'docker'), MAVERICK_SYSTEMCTL: join(r, 'bin', 'systemctl'), MAVERICK_CRONTAB: join(r, 'bin', 'crontab'),
  });
  for (const c of ['ancien', 'nouveau']) {
    for (const i of ['n', 't']) {
      const d = join(r, c, i);
      mkdirSync(join(d, 'db'), { recursive: true });
      const version = c === 'ancien' || i === 'n' ? '0.9.1' : versionDuNouveau;
      writeFileSync(join(d, 'VERSION'), `tag=V${version}\nversion=${version}\nmode=${i === 't' ? 'test' : 'prod'}\n`);
      writeFileSync(join(d, 'docker-compose.yml'), '');
      writeFileSync(join(d, '.env'), `MAVERICK_CONTENEUR=${c}-${i}\n`);
      if (c === 'ancien') {
        writeFileSync(join(d, 'GELER'), '');
        const db = new DatabaseSync(join(d, 'db', 'vivante.db'));
        db.exec(`CREATE TABLE personnage (id INTEGER PRIMARY KEY, nom TEXT); INSERT INTO personnage (nom) VALUES ('${i}1'), ('${i}2')`);
        db.close();
      }
    }
  }
  mkdirSync(join(r, 'ancien', 'home'), { recursive: true });
  const emballer = () => {
    const e = lancer('demenagement.sh', ['emballer', '--sortie', join(r, 'ancien', 'home')], env('ancien'));
    assert.equal(e.status, 0, e.stdout + e.stderr);
    return join(r, 'ancien', 'home', readdirSync(join(r, 'ancien', 'home')).find((f) => f.endsWith('.tar.gz')));
  };
  return { r, env, emballer, d: (...p) => join(r, ...p) };
}

test('une base déjà présente fait refuser le déballage même avec des milliers d\'entrées (jamais « find | grep -q » : le SIGPIPE ferait dire « vide »)', { skip }, (t) => {
  const m = monde(t);
  const archive = m.emballer();
  const db = m.d('nouveau', 't', 'db');
  for (let i = 0; i < 3000; i += 1) writeFileSync(join(db, `entree-qui-a-un-nom-assez-long-pour-remplir-le-tube-${String(i).padStart(5, '0')}`), '');
  const r = lancer('demenagement.sh', ['deballer', '--a-blanc', archive], m.env('nouveau'));
  assert.notEqual(r.status, 0, r.stdout);
  assert.match(r.stderr, /pas vide/);
  assert.equal(readdirSync(db).length, 3000, 'rien n\'a été touché');
});

test('reprise après une panne à mi-chemin : la même commande reprend sans rien écraser, une base modifiée est refusée', { skip }, (t) => {
  const m = monde(t);
  const archive = m.emballer();
  let r = lancer('demenagement.sh', ['deballer', archive], m.env('nouveau'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const base = (i) => m.d('nouveau', i, 'db', 'vivante.db');
  const h = { n: sha(base('n')), t: sha(base('t')) };
  // la panne : le service de test n'a pas eu sa base, un morceau resté à côté, le jeton manque
  renameSync(m.d('nouveau', 't', 'db'), m.d('nouveau', 't', 'db.vide'));
  mkdirSync(m.d('nouveau', 't', 'db'));
  mkdirSync(m.d('nouveau', 't', 'db.nouveau-19990101-000000'));
  writeFileSync(m.d('nouveau', 't', 'db.nouveau-19990101-000000', 'morceau'), 'x');
  r = lancer('demenagement.sh', ['deballer', archive], m.env('nouveau'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /déjà posé, conforme/);
  assert.equal(sha(base('n')), h.n, 'la base déjà posée n\'a pas bougé');
  assert.equal(sha(base('t')), h.t, 'la base manquante est posée entière');
  assert.equal(existsSync(m.d('nouveau', 't', 'db.nouveau-19990101-000000', 'morceau')), true, 'le reste d\'une panne précédente n\'est jamais effacé');
  // une base qui n'est plus celle de l'archive (un service a écrit) : refusée
  writeFileSync(m.d('nouveau', 'n', 'db', 'intrus'), 'x');
  r = lancer('demenagement.sh', ['deballer', archive], m.env('nouveau'));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pas vide/);
});

test('une version installée différente de celle de l\'ancien serveur (plus ancienne OU plus récente) : code 4 avant de rien poser, avec les commandes ; la même : code 0', { skip }, (t) => {
  for (const [version, mot] of [['0.9.0', 'plus ancienne'], ['0.9.2', 'plus récente']]) {
    const m = monde(t, { versionDuNouveau: version });
    const archive = m.emballer();
    const r = lancer('demenagement.sh', ['deballer', archive], m.env('nouveau'));
    assert.equal(r.status, 4, `${mot} : ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, new RegExp(`VERSION test : l'ancien serveur est en V0\\.9\\.1, celui-ci en V${version.replace(/\./g, '\\.')}`));
    assert.match(r.stderr, /installateur-courant/);
    assert.deepEqual(readdirSync(m.d('nouveau', 't', 'db')), [], `${mot} : rien n'est posé`);
    assert.equal(existsSync(m.d('nouveau', 't', '.env.avant-demenagement')), false);
    assert.equal(lancer('demenagement.sh', ['deballer', '--a-blanc', archive], m.env('nouveau')).status, 4, 'à blanc aussi');
  }
  const meme = monde(t);
  const r = lancer('demenagement.sh', ['deballer', meme.emballer()], meme.env('nouveau'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Versions : les mêmes/);
});
