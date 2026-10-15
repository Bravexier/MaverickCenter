// Volume sur le serveur (docs/serveur.md, « Métriques et volume ») : les journaux de chaque conteneur tournent (sinon Docker les garde sans limite),
// les métriques de chaque instance sont montées hors de db/ dans un dossier partagé réglable comme celui de la maintenance, la mesure des pages par
// le navigateur est active par défaut (décision du propriétaire du 2026-10-15), deploy/vps/volume.sh (la répartition du disque vue de l'hôte, pour
// la jauge de la page Debug) compte chaque octet une fois, sous les clés du service, et la documentation dit ce que fait le code.
// Docker n'est pas lancé ici : les fichiers sont lus et comparés ; volume.sh est exécuté pour de bon sur une arborescence factice.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { ARCHIVES_GARDEES } from '../serveur/base-vivante.mjs';
import {
  categorieDuFichierDuSite, CATEGORIES_HOTE, creerMetriques, ORIGINES_PAR_HEURE, PAGES_PAR_HEURE, PLAFOND_METRIQUES_OCTETS, REPARTITION, REPARTITION_HOTE,
} from '../serveur/metriques.mjs';
import { LANCEMENTS_PAR_JOUR } from '../serveur/notes-de-version.mjs';

const lire = (chemin) => readFileSync(fileURLToPath(new URL(`../../${chemin}`, import.meta.url)), 'utf8');
const COMPOSES = ['deploy/docker-compose.yml', 'deploy/installateur/docker-compose.yml'];
/** Rotation des journaux des conteneurs : 5 fichiers de 10 Mo au plus par conteneur. */
const JOURNAUX = { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '5' } };

test('docker-compose.yml : chaque conteneur a des journaux qui tournent (5 × 10 Mo), sans exception', () => {
  for (const fichier of COMPOSES) {
    const compose = YAML.parse(lire(fichier));
    const services = Object.entries(compose.services);
    assert.ok(services.length >= 2, `${fichier} : nginx et le service`);
    for (const [nom, service] of services) assert.deepEqual(service.logging, JOURNAUX, `${fichier}, service « ${nom} »`);
  }
});

test('installateurs : métriques montées hors de db/, dans un dossier partagé réglable comme celui de la maintenance', () => {
  const serveur = YAML.parse(lire('deploy/installateur/docker-compose.yml')).services.serveur;
  const env = serveur.environment;
  assert.equal(env.MAVERICK_DOSSIER_METRIQUES, '/metriques');
  assert.ok(serveur.volumes.includes('${MAVERICK_DOSSIER_METRIQUES:-./metriques}:/metriques'), 'dossier de l’instance par défaut, partagé sur le VPS');
  assert.ok(serveur.volumes.includes('${MAVERICK_DOSSIER_MAINTENANCE:-./maintenance}:/maintenance'), 'même modèle que la maintenance');
  const sources = serveur.volumes.filter((v) => v.endsWith(':/metriques')).map((v) => v.slice(0, -':/metriques'.length));
  assert.equal(sources.length, 1);
  assert.doesNotMatch(sources[0], /\bdb\b/, 'jamais dans db/, que l’installateur de test remplace');
  // une base par instance (prod.db, dev.db) : le nom vient du .env (instances.sh), sinon le service le déduit de MAVERICK_EDITION
  assert.equal(env.MAVERICK_INSTANCE, '${MAVERICK_INSTANCE:-}');
  // « Active-le aussi en prod dans un premier temps » : acceptée par défaut, MAVERICK_METRIQUES_PAGES=0 la ferme ; requêtes brutes sur disque : non par défaut
  assert.equal(env.MAVERICK_METRIQUES_PAGES, '${MAVERICK_METRIQUES_PAGES:-1}');
  assert.equal(env.MAVERICK_METRIQUES_BRUTES, '${MAVERICK_METRIQUES_BRUTES:-0}');
  // NAS : une seule instance, le service range ses métriques dans db/metriques/ (son défaut) ; rien à monter de plus
  const nas = YAML.parse(lire('deploy/docker-compose.yml')).services.serveur;
  assert.ok(!Object.keys(nas.environment).some((cle) => cle.startsWith('MAVERICK_METRIQUES') || cle === 'MAVERICK_DOSSIER_METRIQUES'));
  assert.match(lire('deploy/docker-compose.yml'), /db\/metriques\//, 'le NAS dit où sont ses métriques');
});

test('instances.sh pose les réglages que lit docker-compose.yml (même nom, dossier du serveur normal pour les deux instances)', () => {
  const instances = lire('deploy/vps/instances.sh');
  const compose = lire('deploy/installateur/docker-compose.yml');
  const poses = new Set([...instances.matchAll(/^poser "\$(?:NORMAL|TEST)\/\.env" (MAVERICK_[A-Z_]+) /gm)].map((m) => m[1]));
  for (const cle of ['MAVERICK_INSTANCE', 'MAVERICK_DOSSIER_METRIQUES', 'MAVERICK_DOSSIER_MAINTENANCE']) {
    assert.ok(poses.has(cle), `instances.sh pose ${cle}`);
    assert.match(compose, new RegExp(`\\$\\{${cle}:-`), `docker-compose.yml lit ${cle}`);
  }
  assert.match(instances, /^poser "\$NORMAL\/\.env" MAVERICK_INSTANCE prod$/m);
  assert.match(instances, /^poser "\$TEST\/\.env" MAVERICK_INSTANCE dev$/m);
  assert.match(instances, /^poser "\$NORMAL\/\.env" MAVERICK_DOSSIER_METRIQUES "\$NORMAL\/metriques"$/m);
  assert.match(instances, /^poser "\$TEST\/\.env" MAVERICK_DOSSIER_METRIQUES "\$NORMAL\/metriques"$/m);
});

test('docs/serveur.md, « Métriques et volume » : fidèle au code (archives, lancements, journaux, réglages) et donne les commandes de l’espace libre', () => {
  const doc = lire('docs/serveur.md');
  const section = doc.slice(doc.indexOf('## Métriques et volume'), doc.indexOf('## Développement'));
  assert.ok(section.length > 1000, 'section présente, avant « Développement »');
  for (const titre of ['### Où sont les métriques', '### Volume estimé des métriques', '### Jauge de l\'espace disque', '### Tout ce qui grossit sur le serveur']) {
    assert.ok(section.includes(titre), titre);
  }
  assert.match(section, new RegExp(`\`ARCHIVES_GARDEES\` = ${ARCHIVES_GARDEES} copies`));
  assert.match(section, new RegExp(`${LANCEMENTS_PAR_JOUR} au plus par 24 h`));
  assert.match(section, /4 conteneurs × 5 × 10 Mo = 200 Mo/);
  assert.equal(JOURNAUX.options['max-file'], '5');
  assert.equal(JOURNAUX.options['max-size'], '10m');
  for (const variable of ['MAVERICK_DOSSIER_METRIQUES', 'MAVERICK_INSTANCE', 'MAVERICK_METRIQUES_PAGES=0', 'MAVERICK_METRIQUES_BRUTES=1']) {
    assert.ok(section.includes(variable), variable);
  }
  for (const commande of ['df -h', 'du -sh /srv/maverick-center', 'docker system df', 'json.log', 'journalctl --disk-usage', '.installation.']) {
    assert.ok(section.includes(commande), `commande : ${commande}`);
  }
  // la rétention de chaque donnée (contrat du service : agrégats et évènements 400 jours, échantillons par minute 14 jours, brutes 30 jours)
  assert.match(section, /\| 14 jours, puis un résumé par heure 400 jours \|/);
  assert.match(section, /Jamais sur disque ; 30 jours avec `MAVERICK_METRIQUES_BRUTES=1`/);
  assert.doesNotMatch(doc, /log Docker n'a\s+pas de rotation/, 'plus de phrase périmée sur les journaux Docker');
  // les métriques sont bornées par un plafond dur, pas seulement par la rétention (une page fabriquée par heure suffisait à les faire grossir)
  const ligne = section.split('\n').find((l) => l.startsWith('| Métriques |'));
  assert.ok(ligne, 'la ligne des métriques dans « Tout ce qui grossit »');
  assert.match(ligne, /`PLAFOND_METRIQUES_OCTETS`/);
  assert.ok(ligne.includes(`${PLAFOND_METRIQUES_OCTETS / 1024 ** 2} Mio`), `plafond écrit : ${PLAFOND_METRIQUES_OCTETS / 1024 ** 2} Mio`);
  assert.doesNotMatch(ligne, /\| Oui \(rétention\) \|$/, 'jamais « borné par la rétention » seulement');
  assert.match(section, new RegExp(`\`PAGES_PAR_HEURE\` = ${PAGES_PAR_HEURE} pages`));
  assert.match(section, new RegExp(`\`ORIGINES_PAR_HEURE\` = ${ORIGINES_PAR_HEURE.toLocaleString('fr-FR').replace(/\s/g, ' ')} couples`));
});

test('docs/serveur.md, « Jauge de l\'espace disque » : chaque clé de la répartition, dans l\'ordre, avec son libellé ; le minuteur tel que le pose instances.sh', () => {
  const doc = lire('docs/serveur.md');
  const jauge = doc.slice(doc.indexOf('### Jauge de l\'espace disque'), doc.indexOf('### Tout ce qui grossit sur le serveur'));
  const lignes = [...jauge.matchAll(/^\| `([a-z-]+)` \| ([^|]+) \|/gm)].map((m) => [m[1], m[2].trim()]);
  const attendues = REPARTITION.map((c) => [c.cle, c.libelle]);
  attendues.splice(attendues.findIndex(([cle]) => cle === 'autres'), 0, ...REPARTITION_HOTE.map((c) => [c.cle, c.libelle]));
  assert.deepEqual(lignes, attendues);
  const instances = lire('deploy/vps/instances.sh');
  assert.match(instances, /^OnCalendar=\*:0\/15$/m);
  assert.match(jauge, /toutes les 15 minutes/);
  for (const texte of ['maverick-volume.timer', '/usr/local/lib/maverick-center/', '/metriques/volume-hote.json', '`Nice=19`']) assert.ok(jauge.includes(texte), texte);
  assert.match(instances, /^OUTILS=\$\{MAVERICK_DIR_OUTILS:-\/usr\/local\/lib\/maverick-center\}$/m);
  assert.match(instances, /^Nice=19$/m);
  const readme = lire('deploy/vps/README.md');
  assert.match(readme, /^\| `volume\.sh` \|/m, 'le README du VPS liste volume.sh');
  assert.match(readme, /systemctl list-timers maverick-volume\.timer/);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// deploy/vps/volume.sh : la répartition du disque vue de l'hôte (docs/serveur.md, « Jauge de l'espace disque »)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const VOLUME = fileURLToPath(new URL('../../deploy/vps/volume.sh', import.meta.url));
const sait = (cmd, args) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
// GNU du (-B1), find (-printf), df (-B1) et stat (-c) : ceux d'Ubuntu, que le script attend
const skipVolume = !(sait('bash', ['--version']) && sait('du', ['-s', '-B1', '.']) && sait('find', ['.', '-maxdepth', '0', '-printf', '']) && sait('df', ['-P', '-B1', '.'])
  && sait('stat', ['-c', '%d', '.'])) && 'bash, du, find, df ou stat GNU indisponible';
/** Clés que seul l'hôte voit : entre les catégories comptées par le service et « Système et autres » (serveur/metriques.mjs#REPARTITION_HOTE). */
const CLES_DE_L_HOTE = CATEGORIES_HOTE;

const racine = mkdtempSync(join(tmpdir(), 'deploy-volume-test-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let n = 0;

/** Un fichier de `octets` octets non nuls (alloués pour de bon, comme un vrai fichier). */
function fichier(chemin, octets = 5_000) {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, Buffer.alloc(octets, 7));
}
/** Octets alloués à un fichier (blocs de 512 octets, comme du et le service). */
const alloues = (chemin) => lstatSync(chemin).blocks * 512;
/** du -s -B1 -x : octets alloués à un dossier (dossiers compris). */
function du(chemin) {
  const r = spawnSync('du', ['-s', '-x', '-B1', '--', chemin], { encoding: 'utf8' });
  return Number(r.stdout.split('\t')[0]);
}
/** Les fichiers d'un dossier, par clé de la répartition, avec la règle du service (categorieDuFichierDuSite) ; les dossiers eux-mêmes (le site
 * compris) avec les autres fichiers du site, comme le service. */
function siteSelonLeService(site) {
  const comptes = {};
  const parcourir = (dossier) => {
    comptes['site-autres'] = (comptes['site-autres'] ?? 0) + alloues(dossier);
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const c = join(dossier, e.name);
      if (e.isDirectory()) parcourir(c);
      else if (e.isFile()) {
        const cle = categorieDuFichierDuSite(relative(site, c).split('\\').join('/'));
        comptes[cle] = (comptes[cle] ?? 0) + alloues(c);
      }
    }
  };
  parcourir(site);
  return comptes;
}

/** Fichiers d'un site construit qui passent par chaque règle de classement du service. */
const FICHIERS_DU_SITE = {
  'index.html': 9_000, '_astro/page.Ab12.js': 30_000, '_astro/style.css': 7_000, '_astro/page.js.map': 3_000, 'modules/x.mjs': 2_000,
  '_serveur/serveur/index.mjs': 12_000, '_serveur/version.json': 300, '_serveur/serveur/notes.txt': 500,
  'donnees/maverick.db': 60_000, 'donnees/reference.db': 40_000, 'donnees/reference.json': 4_000, 'donnees/metier/index.html': 6_000,
  'search-index.json': 20_000, 'fiche/regles.json': 15_000, 'fiche/index.html': 8_000, 'autre/copie.db': 4_500,
  'logo.webp': 11_000, 'favicon.png': 1_500, 'galerie/IMAGE.JPG': 25_000, 'icone.svg': 900, 'apple-touch-icon.ico': 700, 'photo.avif': 2_200,
  'bestiaire/portraits/0123abcd.webp': 18_000, 'portraits/x.png': 3_000, 'polices/titre.woff2': 22_000, 'robots.txt': 50, '.htaccess': 80,
  'LISEZMOI': 120, 'page.': 60,
};

/** Une arborescence de VPS : deux instances, le dossier des métriques partagé, Docker, les journaux et des restes d'installation. */
function arborescence() {
  const d = join(racine, `vps-${(n += 1)}`);
  const normal = join(d, 'srv', 'maverick-center');
  const essai = join(d, 'srv', 'maverick-center-test');
  const metriques = join(normal, 'metriques');
  for (const [rel, octets] of Object.entries(FICHIERS_DU_SITE)) fichier(join(normal, 'site', rel), octets);
  fichier(join(essai, 'site', 'index.html'), 9_000);
  fichier(join(essai, 'site', 'donnees', 'maverick.db'), 61_000);
  fichier(join(essai, 'site', 'bestiaire', 'portraits', 'ff.webp'), 7_000);
  writeFileSync(join(normal, '.env'), `MAVERICK_CONTENEUR=maverick-center\nMAVERICK_INSTANCE=prod\nMAVERICK_DOSSIER_METRIQUES=${metriques}\n`);
  writeFileSync(join(essai, '.env'), `MAVERICK_INSTANCE=dev\nMAVERICK_DOSSIER_METRIQUES=${metriques}\n`);
  for (const r of [normal, essai]) {
    fichier(join(r, 'docker-compose.yml'), 3_000);
    fichier(join(r, 'nginx.conf'), 2_000);
    fichier(join(r, 'db', 'vivante.db'), 80_000);
    fichier(join(r, 'db', 'etat.json'), 200);
    fichier(join(r, 'mise-a-jour.log'), 1_000);
  }
  fichier(join(normal, 'db', 'vivante.db-wal'), 9_000);
  fichier(join(normal, 'db', 'archives', 'vivante-2026-10-01.db'), 70_000);
  fichier(join(essai, 'db', 'mise-a-jour', 'lot-1.json'), 6_000);
  fichier(join(normal, 'installation.log'), 400);
  fichier(join(normal, '.installation.4242', 'site', 'index.html'), 9_000);
  fichier(join(essai, '.db.copie.4343', 'vivante.db'), 80_000);
  fichier(join(metriques, 'prod.db'), 50_000);
  fichier(join(metriques, 'dev.db'), 30_000);
  const docker = join(d, 'var-lib-docker');
  fichier(join(docker, 'overlay2', 'aaa', 'diff', 'usr', 'bin', 'node'), 120_000);
  fichier(join(docker, 'image', 'overlay2', 'repositories.json'), 700);
  fichier(join(docker, 'containers', 'c1', 'c1-json.log'), 40_000);
  fichier(join(docker, 'containers', 'c1', 'c1-json.log.1'), 50_000);
  fichier(join(docker, 'containers', 'c1', 'config.v2.json'), 3_000);
  const varlog = join(d, 'var-log');
  fichier(join(varlog, 'journal', 'abc', 'system.journal'), 16_000);
  const tmp = join(d, 'tmp');
  fichier(join(tmp, 'maverick-mise-a-jour.Xy12', 'maverick-center-V0.3-install.sh'), 20_000);
  fichier(join(tmp, 'maverick-update.Zz', 'site.tar'), 8_000);
  fichier(join(tmp, 'autre-chose', 'f'), 8_000);
  const root = join(d, 'root');
  fichier(join(root, 'vivante-2026-10-15.db'), 80_000);
  fichier(join(root, 'maverick-center-V0.3-install.sh'), 20_000);
  fichier(join(root, 'notes.txt'), 1_000);
  const home = join(d, 'home');
  fichier(join(home, 'ubuntu', 'maverick-center-V0.3.1-install.sh'), 20_000);
  return { d, normal, essai, metriques, docker, varlog, tmp, root, home };
}
function lancerVolume(a, args = [a.normal, a.essai], env = {}) {
  const r = spawnSync('bash', [VOLUME, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, MAVERICK_DIR_DOCKER: a.docker, MAVERICK_DIR_VARLOG: a.varlog, MAVERICK_DIR_TMP: a.tmp, MAVERICK_DIR_ROOT: a.root, MAVERICK_DIR_HOME: a.home, ...env },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}
const somme = (liste) => liste.reduce((t, e) => t + e.octets, 0);
const elements = (j, filtre) => j.elements.filter((e) => Object.entries(filtre).every(([k, v]) => e[k] === v));

test('volume.sh : les clés et libellés de la répartition du service, puis docker, journaux, installations ; la somme fait le disque', { skip: skipVolume }, () => {
  const a = arborescence();
  const r = lancerVolume(a);
  assert.equal(r.code, 0, r.out);
  const sortie = join(a.metriques, 'volume-hote.json');
  const j = JSON.parse(readFileSync(sortie, 'utf8'));
  assert.equal(statSync(sortie).mode & 0o777, 0o644, 'lisible par le service des deux instances');
  assert.deepEqual(readdirSync(a.metriques).filter((f) => f.endsWith('.tmp')), [], 'aucun fichier provisoire laissé');
  assert.equal(j.format, 1);
  assert.match(j.instant, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.ok(Number.isInteger(j.duree_ms) && j.duree_ms >= 0);
  // mêmes clés, même ordre et mêmes libellés que REPARTITION (serveur/metriques.mjs) ; les clés de l'hôte juste avant « Système et autres »
  const attendues = REPARTITION.map((c) => c.cle);
  attendues.splice(attendues.indexOf('autres'), 0, ...CLES_DE_L_HOTE);
  assert.deepEqual(j.repartition.map((c) => c.cle), attendues);
  for (const c of [...REPARTITION, ...REPARTITION_HOTE]) assert.equal(j.repartition.find((x) => x.cle === c.cle).libelle, c.libelle, `libellé de « ${c.cle} »`);
  // le disque : la somme fait exactement sa taille ; « libre » = disque.libre ; « autres » = le reste, jamais négatif
  const disque = spawnSync('df', ['-P', '-B1', a.normal], { encoding: 'utf8' }).stdout.trim().split('\n')[1].split(/\s+/);
  assert.equal(j.disque.total, Number(disque[1]));
  assert.equal(j.disque.dossier, a.normal);
  assert.equal(j.disque.reserve, j.disque.total - j.disque.utilise - j.disque.libre);
  assert.equal(j.depasse, null);
  assert.equal(somme(j.repartition), j.disque.total);
  assert.equal(j.repartition.at(-1).octets, j.disque.libre);
  // chaque clé comptée = la somme de ses éléments
  for (const c of j.repartition.slice(0, -3)) assert.equal(c.octets, somme(elements(j, { cle: c.cle })), `clé « ${c.cle} »`);
  // la réserve de root à part (df ne la compte ni dans Used ni dans Avail) : « occupé » = Used de df
  assert.equal(j.repartition.at(-2).cle, 'reserve');
  assert.equal(j.repartition.at(-2).octets, j.disque.reserve);
  assert.equal(somme(j.repartition.slice(0, -2)), j.disque.utilise, 'la place prise de df');
  assert.deepEqual(j.hors_disque, []);
});

test('volume.sh : chaque fichier compté une fois, sous la clé que lui donne le service (categorieDuFichierDuSite)', { skip: skipVolume }, () => {
  const a = arborescence();
  assert.equal(lancerVolume(a).code, 0);
  const j = JSON.parse(readFileSync(join(a.metriques, 'volume-hote.json'), 'utf8'));
  for (const [instance, dossier] of [['prod', a.normal], ['dev', a.essai]]) {
    // le site : la règle du service, fichier par fichier (les portraits publiés vont aux images importées)
    const service = siteSelonLeService(join(dossier, 'site'));
    const site = (cle) => somme(elements(j, { instance, cle, chemin: join(dossier, 'site') }));
    for (const cle of ['site-code', 'site-donnees', 'site-images', 'site-autres', 'images']) assert.equal(site(cle), service[cle] ?? 0, `${instance} : ${cle}`);
    // rien de perdu, rien de compté deux fois : les éléments d'une instance font tout son dossier (moins les métriques partagées, comptées à part)
    const metriques = dossier === a.normal ? du(a.metriques) : 0;
    assert.equal(somme(elements(j, { instance })), du(dossier) - metriques, `${instance} : tout le dossier`);
  }
  // les règles du service sur l'exemple : une base du site va aux données, un portrait aux images importées, une police aux autres fichiers
  assert.equal(categorieDuFichierDuSite('donnees/maverick.db'), 'site-donnees');
  assert.equal(categorieDuFichierDuSite('bestiaire/portraits/0123abcd.webp'), 'images');
  assert.equal(categorieDuFichierDuSite('polices/titre.woff2'), 'site-autres');
  // base : la base vivante (+ -wal) et ses archives ; les lots à part ; les sauvegardes faites à la main, sans instance
  const nom = (instance, texte) => elements(j, { instance, nom: texte })[0]?.octets ?? 0;
  assert.equal(nom('prod', 'base vivante'), alloues(join(a.normal, 'db', 'vivante.db')) + alloues(join(a.normal, 'db', 'vivante.db-wal')));
  assert.equal(nom('prod', 'archives de la base vivante'), du(join(a.normal, 'db', 'archives')));
  assert.equal(nom('dev', 'lots figés de la mise à jour'), du(join(a.essai, 'db', 'mise-a-jour')));
  assert.equal(elements(j, { cle: 'mises-a-jour' }).length, 1);
  assert.equal(nom(null, 'sauvegardes à la main (vivante-*.db)'), alloues(join(a.root, 'vivante-2026-10-15.db')));
  assert.equal(elements(j, { cle: 'base', instance: null }).length, 1);
  // métriques : le dossier partagé, une seule fois, sans instance (le service le compte aussi de son côté), mesuré avant que ce relevé n'y soit écrit
  const releve = alloues(join(a.metriques, 'volume-hote.json'));
  assert.deepEqual(elements(j, { cle: 'metriques' }).map((e) => [e.instance, e.chemin, e.octets]), [[null, a.metriques, du(a.metriques) - releve]]);
  // Docker : son dossier, journaux des conteneurs à part
  const journauxDocker = alloues(join(a.docker, 'containers', 'c1', 'c1-json.log')) + alloues(join(a.docker, 'containers', 'c1', 'c1-json.log.1'));
  assert.equal(nom(null, 'images, conteneurs et volumes'), du(a.docker) - journauxDocker);
  assert.equal(nom(null, 'journaux des conteneurs (docker logs)'), journauxDocker);
  assert.equal(nom(null, 'journaux du système'), du(a.varlog));
  assert.equal(nom('prod', 'journaux des scripts (*.log)'), alloues(join(a.normal, 'mise-a-jour.log')) + alloues(join(a.normal, 'installation.log')));
  // installations : restes d'une installation, téléchargements des mises à jour automatiques, installateurs copiés à la main (rien d'autre)
  assert.equal(nom('prod', 'installation en cours ou interrompue'), du(join(a.normal, '.installation.4242')));
  assert.equal(nom('dev', 'installation en cours ou interrompue'), du(join(a.essai, '.db.copie.4343')));
  assert.equal(nom(null, 'téléchargements de mise-a-jour.sh et update-site.sh'), du(join(a.tmp, 'maverick-mise-a-jour.Xy12')) + du(join(a.tmp, 'maverick-update.Zz')));
  assert.equal(nom(null, 'installateurs copiés à la main'),
    alloues(join(a.root, 'maverick-center-V0.3-install.sh')) + alloues(join(a.home, 'ubuntu', 'maverick-center-V0.3.1-install.sh')));
});

test('volume.sh : sans dossier partagé (NAS, une instance), les métriques de db/metriques/ ne sont comptées qu’une fois ; db/ en lien suivi', { skip: skipVolume }, () => {
  const a = arborescence();
  const seule = join(a.d, 'nas', 'maverick-center');
  fichier(join(seule, 'site', 'index.html'), 9_000);
  fichier(join(seule, 'db', 'vivante.db'), 80_000);
  fichier(join(seule, 'db', 'metriques', 'prod.db'), 40_000);
  const r = lancerVolume(a, [seule]);
  assert.equal(r.code, 0, r.out);
  const j = JSON.parse(readFileSync(join(seule, 'db', 'metriques', 'volume-hote.json'), 'utf8'));
  assert.equal(elements(j, { cle: 'metriques' })[0].chemin, join(seule, 'db', 'metriques'));
  const releve = alloues(join(seule, 'db', 'metriques', 'volume-hote.json'));
  assert.equal(somme(elements(j, { instance: 'maverick-center' })) + elements(j, { cle: 'metriques' })[0].octets, du(seule) - releve, 'nom du dossier sans MAVERICK_INSTANCE');
  // db/ peut être un lien vers un autre dossier (installateur.sh l'accepte) : suivi pour la base, sans être compté deux fois
  const lien = join(a.d, 'lien', 'maverick-center');
  fichier(join(lien, 'site', 'index.html'), 9_000);
  fichier(join(a.d, 'ailleurs', 'db', 'vivante.db'), 80_000);
  mkdirSync(join(lien, 'metriques'));
  symlinkSync(join(a.d, 'ailleurs', 'db'), join(lien, 'db'));
  assert.equal(lancerVolume(a, [lien]).code, 0);
  const k = JSON.parse(readFileSync(join(lien, 'metriques', 'volume-hote.json'), 'utf8'));
  assert.equal(elements(k, { nom: 'base vivante' })[0].octets, alloues(join(a.d, 'ailleurs', 'db', 'vivante.db')));
  assert.equal(somme(elements(k, { instance: 'maverick-center' })), du(lien) - du(join(lien, 'metriques')) + du(join(a.d, 'ailleurs', 'db') + '/'));
});

test('volume.sh : une mesure sur un autre disque va dans hors_disque, jamais dans la jauge ; sortie introuvable refusée sans rien écrire', { skip: skipVolume }, () => {
  const a = arborescence();
  // /dev/shm (tmpfs) : un autre disque que le dossier temporaire, quand la machine en a un
  let ailleurs = null;
  try {
    if (statSync('/dev/shm').dev !== statSync(a.d).dev) ailleurs = mkdtempSync('/dev/shm/deploy-volume-');
  } catch {
    ailleurs = null;
  }
  if (ailleurs) {
    try {
      fichier(join(ailleurs, 'journal', 'system.journal'), 16_000);
      assert.equal(lancerVolume(a, undefined, { MAVERICK_DIR_VARLOG: ailleurs }).code, 0);
      const j = JSON.parse(readFileSync(join(a.metriques, 'volume-hote.json'), 'utf8'));
      assert.deepEqual(j.hors_disque.map((e) => [e.cle, e.nom, e.chemin, e.octets]), [['journaux', 'journaux du système', ailleurs, du(ailleurs)]]);
      assert.equal(elements(j, { nom: 'journaux du système' }).length, 0);
      assert.equal(somme(j.repartition), j.disque.total);
    } finally {
      rmSync(ailleurs, { recursive: true, force: true });
    }
  }
  // dossier de sortie absent (instances.sh pas encore lancé) : code 1, rien d'écrit ; argument inconnu : code 2
  const b = arborescence();
  rmSync(b.metriques, { recursive: true });
  const r = lancerVolume(b);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /instances\.sh/);
  assert.ok(!existsSync(b.metriques));
  assert.equal(lancerVolume(b, ['--inconnu']).code, 2);
  assert.equal(lancerVolume(b, [join(b.d, 'absent')]).code, 1);
});

test('le service de chaque instance lit volume-hote.json : sa jauge = celle de l’hôte, ses propres mesures à la place des siennes (images de sa base à part)', { skip: skipVolume }, () => {
  const a = arborescence();
  assert.equal(lancerVolume(a).code, 0);
  const j = JSON.parse(readFileSync(join(a.metriques, 'volume-hote.json'), 'utf8'));
  const parCle = (repartition) => Object.fromEntries(repartition.map((c) => [c.cle, c.octets]));
  const hote = parCle(j.repartition);
  for (const [instance, dossier] of [['dev', a.essai], ['prod', a.normal]]) {
    const db = join(dossier, 'db');
    const m = creerMetriques({
      dossier: a.metriques, instance, intervalle: 0, horloge: () => Date.parse(j.instant) + 60_000,
      fichiers: { vivante: join(db, 'vivante.db'), archives: join(db, 'archives'), miseAJour: join(db, 'mise-a-jour'), disque: db, site: join(dossier, 'site') },
      imagesDeLaBase: () => 1_000,
    });
    try {
      const d = m.systeme({}).disque;
      assert.deepEqual(d.repartition_hote, { releve_le: j.instant, utilise: true, raison: null }, instance);
      assert.deepEqual(d.repartition.map((c) => c.cle), j.repartition.map((c) => c.cle), `${instance} : les 13 clés, dans l’ordre de l’hôte`);
      assert.equal(d.repartition.reduce((n, c) => n + c.octets, 0), d.total, `${instance} : la somme fait le disque`);
      const service = parCle(d.repartition);
      // chaque octet une fois : l'hôte et le service disent la même chose, clé par clé, sauf les images de la base (que seul le service voit, prises à
      // la base) et le dossier des métriques (compté par le service, fichiers seuls, relevé de l'hôte compris)
      for (const cle of [...CLES_DE_L_HOTE, 'site-code', 'site-donnees', 'site-images', 'site-autres', 'mises-a-jour']) assert.equal(service[cle], hote[cle], `${instance} : ${cle}`);
      assert.equal(service.base + service.images, hote.base + hote.images, `${instance} : base et images`);
      assert.equal(service.images, hote.images + 1_000, `${instance} : les images de sa base passent de la base aux images importées`);
      assert.ok(service.metriques > 0 && Math.abs(service.metriques - hote.metriques) < 64 * 1024, `${instance} : métriques ${service.metriques} / ${hote.metriques}`);
    } finally {
      m.arreter();
    }
  }
});

test('volume.sh : un lien posé à l’avance dans le dossier partagé (que les conteneurs modifient) n’est jamais suivi — le fichier provisoire a un nom imprévisible, créé en exclusivité', { skip: skipVolume }, () => {
  const a = arborescence();
  const victime = join(a.normal, 'db', 'vivante.db');
  writeFileSync(victime, 'SQLite format 3\u0000CONTENU-PRECIEUX', { mode: 0o600 });
  chmodSync(victime, 0o600);
  const sortie = join(a.metriques, 'volume-hote.json');
  // l'attaque du constat : le lien porte le nom que le script prenait (« <sortie>.<pid>.tmp ») ; exec garde le PID du shell qui le pose
  const enveloppe = `ln -s "$1" "$2.$$.tmp" && exec bash "$3" "$4" "$5"`;
  const r = spawnSync('bash', ['-c', enveloppe, 'enveloppe', victime, sortie, VOLUME, a.normal, a.essai], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, MAVERICK_DIR_DOCKER: a.docker, MAVERICK_DIR_VARLOG: a.varlog, MAVERICK_DIR_TMP: a.tmp, MAVERICK_DIR_ROOT: a.root, MAVERICK_DIR_HOME: a.home },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(victime, 'utf8'), 'SQLite format 3\u0000CONTENU-PRECIEUX', 'la base vivante n’est ni tronquée ni remplacée');
  assert.equal(statSync(victime).mode & 0o777, 0o600, 'ni ses droits changés');
  assert.equal(JSON.parse(readFileSync(sortie, 'utf8')).format, 1, 'le relevé est écrit à sa place');
  assert.ok(!lstatSync(sortie).isSymbolicLink());
  assert.equal(statSync(sortie).mode & 0o777, 0o644);
  const restes = readdirSync(a.metriques).filter((f) => f.endsWith('.tmp'));
  assert.equal(restes.length, 1, `seul le lien posé reste : ${restes}`);
  assert.ok(lstatSync(join(a.metriques, restes[0])).isSymbolicLink());
  // le code : un nom imprévisible (mktemp -u), ouvert en création exclusive (noclobber) une seule fois, jamais un nom fait du PID ni un chmod
  const code = lire('deploy/vps/volume.sh');
  assert.doesNotMatch(code, /provisoire="\$SORTIE\.\$\$/);
  assert.match(code, /provisoire=\$\(mktemp -u /);
  assert.match(code, /set -o noclobber\nexec 3> "\$provisoire"/);
  assert.doesNotMatch(code, /chmod [0-7]+ "\$provisoire"/);
});
