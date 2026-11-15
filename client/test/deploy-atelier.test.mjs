// L'atelier du site de dev, côté hôte (deploy/installateur/atelier/ : lancer.sh, installer.sh, lib.sh ; kit-pose.sh) : lot 9 du chantier de la base de dev, PR 3.
// Les scripts tournent pour de bon dans un monde factice (un faux docker, un faux /proc/meminfo, un faux df, un faux systemctl, un faux cgroup) : refus de mémoire et de
// disque, OOMKilled, délai, verrou, lien symbolique sur le dossier de l'extrait, production sans atelier, --retirer, livraison des outils par l'installateur.
// Garde-fou 20 du plan : rien de ce que le site de dev écrit ne commande un programme root, root n'écrit jamais dans db/ et n'interprète aucun fichier du service ni du conteneur.
// Nécessite sh, flock, dd, df, tar et gzip ; sinon les tests sont ignorés.
//   node --test test/deploy-atelier.test.mjs
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const have = (cmd, arg = '--version') => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const skip = !(have('flock') && have('dd') && have('tar') && have('gzip') && have('df')) && 'flock, dd, df, tar ou gzip indisponible';
const SOURCES = fileURLToPath(new URL('../../deploy/installateur/atelier/', import.meta.url));
const IMAGE = 'node:22-bookworm-slim';
const racine = dossierTemporaire('deploy-atelier');
let n = 0;

const ecrire = (chemin, contenu) => { mkdirSync(dirname(chemin), { recursive: true }); writeFileSync(chemin, contenu); };
const meminfo = (total, dispo) => `MemTotal:       ${total} kB\nMemFree:         100000 kB\nMemAvailable:   ${dispo} kB\nBuffers: 1 kB\n`;

const FAUX_DOCKER = `#!/bin/sh
echo "$*" >> "$FAKE_DIR/docker.log"
cmd=$1; shift
case "$cmd" in
  info) exit 0 ;;
  compose) exit 0 ;;
  image) if [ "\${FAKE_IMAGE_ABSENTE:-0}" = 1 ] && [ ! -f "$FAKE_DIR/image-tiree" ]; then exit 1; fi; exit 0 ;;
  pull) if [ "\${FAKE_PULL_ECHEC:-0}" = 1 ]; then exit 1; fi; touch "$FAKE_DIR/image-tiree"; exit 0 ;;
  run)
    if [ "\${FAKE_RUN_ECHEC:-0}" = 1 ]; then exit 125; fi
    prev=''; resultats=''; contenu=''
    for a in "$@"; do
      if [ "$prev" = -v ]; then
        case "$a" in *:/resultats) resultats=\${a%%:*} ;; *:/contenu:ro) contenu=\${a%%:*} ;; esac
      fi
      prev=$a
    done
    cid=fakecid$$
    [ -z "$contenu" ] || cp "$contenu"/contenu-*.db "$FAKE_DIR/contenu-vu.db"
    if [ -n "$resultats" ]; then
      [ -z "\${FAKE_FABRICATION:-}" ] || cp "$FAKE_FABRICATION" "$resultats/fabrication.json"
      [ -z "\${FAKE_COMPARAISON:-}" ] || cp "$FAKE_COMPARAISON" "$resultats/comparaison.json"
      [ -z "\${FAKE_GROS:-}" ] || head -c 400000 /dev/zero | tr '\\0' 'x' > "$resultats/fabrication.json"
      [ -z "\${FAKE_LIEN:-}" ] || ln -sf "$FAKE_LIEN" "$resultats/comparaison.json"
      [ -z "\${FAKE_FIFO:-}" ] || { rm -f "$resultats/fabrication.json"; mkfifo "$resultats/fabrication.json"; }
      [ -z "\${FAKE_PERIPHERIQUE:-}" ] || { rm -f "$resultats/comparaison.json"; mknod "$resultats/comparaison.json" c 1 5 2>/dev/null || ln -sf /dev/zero "$resultats/comparaison.json"; }
      sortie=$(dirname "$resultats")/sortie; mkdir -p "$sortie/site"; echo "site témoin" > "$sortie/site/index.html"
      mkdir -p "$(dirname "$resultats")/travail/kit"; echo copie > "$(dirname "$resultats")/travail/kit/x"
    fi
    parent=system.slice
    case "$*" in *--cgroup-parent*maverick-atelier.slice*) parent=maverick-atelier.slice ;; esac
    mkdir -p "$FAKE_CGROUP/$parent/docker-$cid.scope"
    echo "\${FAKE_PIC_OCTETS:-1468006400}" > "$FAKE_CGROUP/$parent/docker-$cid.scope/memory.peak"
    printf 'usage_usec 40000000\\nuser_usec 1\\n' > "$FAKE_CGROUP/$parent/docker-$cid.scope/cpu.stat"
    echo "$cid"; exit 0 ;;
  inspect)
    case "$*" in
      *State.Running*)
        k=$(cat "$FAKE_DIR/inspections" 2>/dev/null || echo 0); echo $((k + 1)) > "$FAKE_DIR/inspections"
        if [ "\${FAKE_JAMAIS_FINI:-0}" = 1 ] && [ ! -f "$FAKE_DIR/tue" ]; then echo true; elif [ "$k" -lt 1 ]; then echo true; else echo false; fi ;;
      *OOMKilled*) echo "\${FAKE_OOM:-false}" ;;
      *ExitCode*) echo "\${FAKE_CODE:-0}" ;;
    esac; exit 0 ;;
  kill) touch "$FAKE_DIR/tue"; exit 0 ;;
  rm)
    # le conteneur doit être supprimé AVANT que root ne copie quoi que ce soit de ce qu'il a laissé : à cet instant, le dossier du rapport n'existe pas encore
    if [ -n "\${FAKE_RAPPORTS:-}" ] && ls "$FAKE_RAPPORTS" 2>/dev/null | grep -Eq '^[0-9]{8}-[0-9]{6}$'; then touch "$FAKE_DIR/rm-trop-tard"; fi
    touch "$FAKE_DIR/rm-fait"; exit 0 ;;
  stats) echo "1.2GiB / 2.5GiB"; exit 0 ;;
esac
exit 0
`;
const FAUX_SYSTEMCTL = '#!/bin/sh\necho "$*" >> "$FAKE_DIR/systemctl.log"\ncase "$1" in is-enabled) echo enabled ;; is-active) echo active ;; esac\nexit 0\n';

/** Un monde : une instance de test avec son atelier (scripts du dépôt, kit, marque, extrait du service), des faux outils et de la mémoire à volonté. */
function monde({ mode = 'test', total = 8388608, dispo = 6291456, version = '0.4.95', reglages = true, extrait = true, kitVersion = version, image = IMAGE } = {}) {
  const dossier = join(racine, `monde-${(n += 1)}`);
  const instance = join(dossier, 'instance');
  const atelier = join(instance, 'atelier');
  ecrire(join(instance, 'VERSION'), `tag=v${version}\nversion=${version}\ncommit=${'a'.repeat(40)}\nmode=${mode}\n`);
  ecrire(join(instance, 'site', 'index.html'), '<h1>site livré</h1>');
  ecrire(join(instance, 'docker-compose.yml'), 'services: {}\n');
  // le dépôt de l'atelier : créé par root au geste, monté dans le service qui y fabrique l'extrait
  mkdirSync(join(atelier, 'depot'), { recursive: true });
  if (extrait) ecrire(join(atelier, 'depot', `contenu-${version}.db`), 'extrait du contenu du site de dev');
  for (const nom of ['lib.sh', 'lancer.sh', 'conteneur.sh']) { mkdirSync(join(atelier, 'outils'), { recursive: true }); copyFileSync(join(SOURCES, nom), join(atelier, 'outils', nom)); chmodSync(join(atelier, 'outils', nom), 0o755); }
  copyFileSync(join(SOURCES, 'installer.sh'), join(atelier, 'installer.sh'));
  ecrire(join(atelier, 'kit', 'kit.json'), JSON.stringify({ format: 'maverick-kit/1', version: kitVersion, image }, null, 2));
  ecrire(join(atelier, 'kit', 'client', 'package.json'), '{}');
  ecrire(join(atelier, 'declencheur', 'marque'), `version=${version}\ntag=v${version}\ncommit=${'a'.repeat(40)}\n`);
  mkdirSync(join(atelier, 'rapports'), { recursive: true });
  if (reglages) ecrire(join(atelier, 'reglages.env'), 'MEMOIRE_MAX_KO=2621440\nBESOIN_KO=1572864\nCPUS=1\nDISQUE_MIN_KO=2097152\nDELAI_S=1800\nGOOGLE_CLIENT_ID=\n');
  // les faux outils
  const bin = join(dossier, 'bin');
  const faux = join(dossier, 'faux');
  mkdirSync(bin);
  mkdirSync(faux);
  ecrire(join(bin, 'docker'), FAUX_DOCKER);
  ecrire(join(bin, 'systemctl'), FAUX_SYSTEMCTL);
  chmodSync(join(bin, 'docker'), 0o755);
  chmodSync(join(bin, 'systemctl'), 0o755);
  ecrire(join(dossier, 'proc', 'meminfo'), meminfo(total, dispo));
  ecrire(join(dossier, 'proc', 'loadavg'), '0.52 0.40 0.30 1/200 12345\n');
  ecrire(join(dossier, 'cgroup', 'cgroup.controllers'), 'cpu memory io\n');
  mkdirSync(join(dossier, 'systemd'));
  return {
    dossier, instance, atelier, bin, faux, rapports: join(atelier, 'rapports'),
    env: (plus = {}) => ({
      PATH: `${bin}:${process.env.PATH}`, MAVERICK_ATELIER_ESSAI: '1', MAVERICK_ATELIER_PROC: join(dossier, 'proc'), MAVERICK_ATELIER_CGROUP: join(dossier, 'cgroup'),
      MAVERICK_ATELIER_INTERVALLE: '0', MAVERICK_ATELIER_ATTENTE: '1', MAVERICK_DIR_ETC_SYSTEMD: join(dossier, 'systemd'), FAKE_DIR: faux, FAKE_CGROUP: join(dossier, 'cgroup'), FAKE_RAPPORTS: join(atelier, 'rapports'), ...plus,
    }),
  };
}
const lancer = (m, plus = {}) => { const r = spawnSync('sh', [join(m.atelier, 'outils', 'lancer.sh')], { encoding: 'utf8', env: m.env(plus), timeout: 60000 }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };
const installer = (m, args = [], plus = {}) => { const r = spawnSync('sh', [join(m.atelier, 'installer.sh'), ...args], { encoding: 'utf8', env: m.env(plus), timeout: 60000 }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };
const rapportsDe = (m) => readdirSync(m.rapports).filter((x) => /^\d{8}-\d{6}$/.test(x)).sort();
const dernierRapport = (m) => { const ids = rapportsDe(m); return ids.length ? JSON.parse(readFileSync(join(m.rapports, ids.at(-1), 'rapport.json'), 'utf8')) : null; };
const journalDocker = (m) => (existsSync(join(m.faux, 'docker.log')) ? readFileSync(join(m.faux, 'docker.log'), 'utf8').split('\n').filter(Boolean) : []);
const lancements = (m) => journalDocker(m).filter((l) => l.startsWith('run '));
const json = (chemin, valeur) => ecrire(chemin, `${JSON.stringify(valeur)}\n`);
const FABRICATION = { format: 'maverick-fabrication/1', statut: 'ok', duree_ms: 20000, etapes: [] };
const COMPARAISON = { format: 'maverick-comparaison/1', equivalents: true, identiques: 2106 };

test('une fabrication : le conteneur est durci et plafonné, l’extrait est copié sans être ouvert, les JSON du conteneur sont joints tels quels, le rapport dit tout', { skip }, (t) => {
  const m = monde();
  json(join(m.faux, 'fab.json'), FABRICATION);
  json(join(m.faux, 'cmp.json'), COMPARAISON);
  const r = lancer(m, { FAKE_FABRICATION: join(m.faux, 'fab.json'), FAKE_COMPARAISON: join(m.faux, 'cmp.json') });
  assert.equal(r.code, 0, r.out);
  const [id] = rapportsDe(m);
  assert.ok(id, 'un rapport');
  const rapport = dernierRapport(m);
  assert.equal(rapport.format, 'maverick-atelier/1');
  assert.equal(rapport.id, id);
  assert.equal(rapport.issue, 'fait', r.out);
  assert.equal(rapport.version_installee, '0.4.95');
  assert.equal(rapport.version_du_kit, '0.4.95');
  assert.equal(rapport.plafond_ko, 2621440, 'min(2,5 Go réglé, la moitié des 6 Go disponibles)');
  assert.equal(rapport.marge_ko, 6291456 - 2621440);
  assert.equal(rapport.serveur.memoire_totale_ko, 8388608);
  assert.equal(rapport.serveur.memoire_disponible_ko, 6291456);
  assert.deepEqual(rapport.serveur.charge, [0.52, 0.4, 0.3]);
  assert.ok(rapport.serveur.processeurs >= 1 && rapport.serveur.disque_total_ko > 0 && rapport.serveur.disque_libre_ko > 0);
  assert.deepEqual(rapport.memoire, { pic_ko: 1433600, source: 'cgroup' }, 'memory.peak du cgroup v2, en ko');
  assert.equal(rapport.cpu_ms, 40000);
  assert.equal(rapport.code_sortie, 0);
  assert.equal(rapport.fabrication, true);
  assert.equal(rapport.comparaison, true);
  assert.ok(rapport.place.kit_ko >= 0 && rapport.place.sortie_ko >= 0);
  assert.ok(rapport.duree_ms >= 0);
  // les JSON du conteneur : copiés octet pour octet, jamais réécrits
  assert.equal(readFileSync(join(m.rapports, id, 'fabrication.json'), 'utf8'), readFileSync(join(m.faux, 'fab.json'), 'utf8'));
  assert.equal(readFileSync(join(m.rapports, id, 'comparaison.json'), 'utf8'), readFileSync(join(m.faux, 'cmp.json'), 'utf8'));
  // l'extrait du service : root ne l'ouvre pas, il monte son dossier en lecture seule dans le conteneur, qui le copie ; rien ne s'est posé dans atelier/
  assert.equal(readFileSync(join(m.faux, 'contenu-vu.db'), 'utf8'), 'extrait du contenu du site de dev');
  assert.ok(!existsSync(join(m.atelier, 'contenu')), 'aucune copie faite par root');
  // la dernière sortie reste, le travail part, rien ne traîne
  assert.ok(existsSync(join(m.atelier, 'sortie', 'site', 'index.html')));
  assert.deepEqual(readdirSync(join(m.atelier, 'travail')), []);
  assert.ok(!existsSync(join(m.rapports, 'en-cours.json')));
  assert.ok(!readdirSync(join(m.rapports, id)).some((x) => x.startsWith('.')));
  // le conteneur : tout ce que le brief exige
  const [ligne, ...autres] = lancements(m);
  assert.equal(autres.length, 0, 'une seule fabrication');
  for (const drapeau of ['--network none', '--read-only', '--cap-drop ALL', '--security-opt no-new-privileges', '--user 65534:65534', '--pids-limit 1024', '--cpus 1', '--cpu-shares 128',
    '--memory 2621440k', '--memory-swap 2621440k', '--oom-score-adj 500', '-e VERSION_INSTALLEE=0.4.95']) assert.ok(ligne.includes(drapeau), drapeau);
  assert.ok(ligne.includes(`${m.atelier}/kit:/kit:ro`) && ligne.includes(`${m.instance}/site:/site:ro`) && ligne.includes(`${m.atelier}/depot:/contenu:ro`), 'kit, site et dépôt de l’extrait en lecture seule');
  assert.ok(ligne.includes(`${m.atelier}/outils/conteneur.sh:/conteneur.sh:ro`) && ligne.includes(`${IMAGE} sh /conteneur.sh`), 'le script du conteneur, monté en lecture seule');
  assert.ok(!ligne.includes('--cgroup-parent'), 'sans tranche posée par le geste, pas de tranche');
  assert.ok(ligne.includes(`${m.atelier}/travail:/travail`) && ligne.includes(`${m.atelier}/sortie:/sortie`), 'travail et sortie dans atelier/, hors de site/');
  assert.ok(!ligne.includes(`${m.instance}/db`), 'jamais db/ ni rien de ce que le service peut changer en lien (des copies de la base, fiches comprises)');
  for (const interdit of [`${m.instance}/db:`, '/metriques', '/maintenance', '/secrets', '/var/run/docker.sock', '--privileged', '--network host']) assert.ok(!ligne.includes(interdit), `jamais ${interdit}`);
  assert.match(ligne, /-e SITE_MODE=test/);
  assert.match(ligne, /-e HIDE_EXAMPLES=1/);
  assert.match(ligne, /-e SITE_TAG=v0\.4\.95/);
  assert.match(r.out, /rapport .* : fait/);
});

test('mémoire : un plafond sous le besoin est refusé avec les chiffres relevés, sans lancer de conteneur', { skip }, () => {
  const m = monde({ dispo: 2000000 });
  const r = lancer(m);
  assert.equal(r.code, 0, r.out);
  const rapport = dernierRapport(m);
  assert.equal(rapport.issue, 'refus');
  assert.equal(rapport.motif, 'memoire_insuffisante');
  assert.equal(rapport.plafond_ko, 1000000, 'la moitié de la mémoire disponible');
  assert.equal(rapport.serveur.memoire_disponible_ko, 2000000);
  assert.equal(rapport.reglages.besoin_ko, 1572864);
  assert.equal(rapport.memoire.pic_ko, null);
  assert.equal(lancements(m).length, 0);
  assert.equal(rapport.fabrication, false);
});

test('mémoire : une marge laissée à la production trop petite (moins de max(1 Go, 25 % de la mémoire totale)) est refusée', { skip }, () => {
  const m = monde({ total: 16777216, dispo: 6291456 });
  lancer(m);
  const rapport = dernierRapport(m);
  assert.equal(rapport.motif, 'marge_insuffisante');
  assert.equal(rapport.plafond_ko, 2621440);
  assert.equal(rapport.marge_ko, 3670016);
  assert.equal(lancements(m).length, 0);
  // et le même serveur avec moins de mémoire totale démarre : la marge minimale est de 1 Go
  const petit = monde({ total: 4194304, dispo: 4000000 });
  lancer(petit);
  assert.equal(dernierRapport(petit).issue, 'fait');
});

test('disque : sous le minimum d’espace libre, la fabrication est refusée (et mesurée) ; le minimum se règle', { skip }, () => {
  const m = monde();
  const dossier = join(m.dossier, 'df');
  ecrire(join(dossier, 'df'), '#!/bin/sh\necho "Filesystem 1024-blocks Used Available Capacity Mounted on"\necho "/dev/faux 50000000 49999000 1000 99% /"\n');
  chmodSync(join(dossier, 'df'), 0o755);
  lancer(m, { PATH: `${dossier}:${m.bin}:${process.env.PATH}` });
  const rapport = dernierRapport(m);
  assert.equal(rapport.issue, 'refus');
  assert.equal(rapport.motif, 'disque_insuffisant');
  assert.equal(rapport.serveur.disque_libre_ko, 1000);
  assert.equal(rapport.serveur.disque_total_ko, 50000000);
  assert.equal(rapport.reglages.disque_min_ko, 2097152);
  assert.equal(lancements(m).length, 0);
});

test('un conteneur arrêté par manque de mémoire (OOMKilled) est une mesure : issue « oom », code 137, jamais de relance', { skip }, () => {
  const m = monde();
  lancer(m, { FAKE_OOM: 'true', FAKE_CODE: '137' });
  const rapport = dernierRapport(m);
  assert.equal(rapport.issue, 'oom');
  assert.equal(rapport.code_sortie, 137);
  assert.equal(rapport.plafond_ko, 2621440);
  assert.equal(rapport.memoire.pic_ko, 1433600, 'le pic mesuré avant l’arrêt');
  assert.equal(lancements(m).length, 1, 'jamais de relance silencieuse');
  assert.equal(rapportsDe(m).length, 1);
  assert.ok(!existsSync(join(m.rapports, 'en-cours.json')));
});

test('un échec de la fabrication, le délai dépassé (le conteneur est tué), et un conteneur que Docker refuse : chacun est une mesure', { skip }, () => {
  const echec = monde();
  lancer(echec, { FAKE_CODE: '1' });
  assert.equal(dernierRapport(echec).issue, 'echec');
  assert.equal(dernierRapport(echec).code_sortie, 1);

  const lent = monde();
  writeFileSync(join(lent.atelier, 'reglages.env'), 'MEMOIRE_MAX_KO=2621440\nBESOIN_KO=1572864\nCPUS=1\nDISQUE_MIN_KO=2097152\nDELAI_S=1\n');
  lancer(lent, { FAKE_JAMAIS_FINI: '1', FAKE_CODE: '137' });
  assert.equal(dernierRapport(lent).issue, 'delai');
  assert.ok(journalDocker(lent).some((l) => l.startsWith('kill ')), 'le conteneur est arrêté au délai');

  const refuse = monde();
  lancer(refuse, { FAKE_RUN_ECHEC: '1' });
  assert.equal(dernierRapport(refuse).motif, 'docker_refuse');
});

test('l’image : téléchargée seulement si elle manque ; une image qui ne se télécharge pas est un refus mesuré ; une image hors motif n’est jamais lancée', { skip }, () => {
  const presente = monde();
  lancer(presente);
  assert.ok(!journalDocker(presente).some((l) => l.startsWith('pull ')));
  const absente = monde();
  lancer(absente, { FAKE_IMAGE_ABSENTE: '1' });
  assert.deepEqual(journalDocker(absente).filter((l) => l.startsWith('pull ')), [`pull ${IMAGE}`]);
  assert.equal(dernierRapport(absente).issue, 'fait');
  const impossible = monde();
  lancer(impossible, { FAKE_IMAGE_ABSENTE: '1', FAKE_PULL_ECHEC: '1' });
  assert.equal(dernierRapport(impossible).motif, 'image_absente');
  assert.equal(lancements(impossible).length, 0);
  for (const hostile of ['node:22; rm -rf /', 'alpine', 'node:22-bookworm-slim --privileged', '$(id)']) {
    const m = monde({ image: hostile });
    lancer(m);
    assert.equal(dernierRapport(m).motif, 'kit_absent', hostile);
    assert.equal(lancements(m).length, 0, hostile);
  }
});

test('le kit doit être celui de la marque : un kit d’une autre version, ou sans client/, est refusé et mesuré', { skip }, () => {
  const perime = monde({ kitVersion: '0.4.90' });
  lancer(perime);
  assert.equal(dernierRapport(perime).motif, 'kit_perime');
  assert.equal(dernierRapport(perime).version_du_kit, '0.4.90');
  assert.equal(lancements(perime).length, 0);
});

test('une seule fabrication à la fois : un verrou tenu, la seconde ne fait rien et ne lance aucun conteneur', { skip }, async () => {
  const m = monde();
  const tenu = spawn('flock', ['-x', join(m.atelier, '.verrou'), 'sleep', '3'], { stdio: 'ignore' });
  await new Promise((ok) => setTimeout(ok, 400));
  const r = lancer(m);
  tenu.kill();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /déjà en cours/);
  assert.equal(rapportsDe(m).length, 0);
  assert.equal(lancements(m).length, 0);
});

test('l’extrait : jamais un lien (dépôt ou fichier), jamais un fichier irrégulier ; absent, la fabrication attend puis est refusée et mesurée', { skip }, () => {
  const depot = (m) => join(m.atelier, 'depot');
  // le dépôt est un lien vers un autre dossier (le service ne peut pas le faire, il est monté ; root le refuse quand même)
  const lienDossier = monde();
  const ailleurs = join(lienDossier.dossier, 'ailleurs');
  ecrire(join(ailleurs, 'contenu-0.4.95.db'), 'un fichier ailleurs');
  rmDossier(depot(lienDossier));
  symlinkSync(ailleurs, depot(lienDossier));
  lancer(lienDossier);
  assert.equal(dernierRapport(lienDossier).motif, 'extrait_refuse');
  assert.equal(lancements(lienDossier).length, 0);
  // le fichier est un lien
  const lienFichier = monde({ extrait: false });
  ecrire(join(lienFichier.dossier, 'secret.txt'), 'quelque chose que root ne doit pas copier');
  symlinkSync(join(lienFichier.dossier, 'secret.txt'), join(depot(lienFichier), 'contenu-0.4.95.db'));
  lancer(lienFichier);
  assert.equal(dernierRapport(lienFichier).motif, 'extrait_refuse');
  assert.equal(lancements(lienFichier).length, 0);
  // le fichier est un dossier
  const dossierAuLieu = monde({ extrait: false });
  mkdirSync(join(depot(dossierAuLieu), 'contenu-0.4.95.db'), { recursive: true });
  lancer(dossierAuLieu);
  assert.equal(dernierRapport(dossierAuLieu).motif, 'extrait_refuse');
  // vide : refusé aussi
  const vide = monde({ extrait: false });
  ecrire(join(depot(vide), 'contenu-0.4.95.db'), '');
  lancer(vide);
  assert.equal(dernierRapport(vide).motif, 'extrait_refuse');
  // pas encore là
  const absent = monde({ extrait: false });
  lancer(absent);
  assert.equal(dernierRapport(absent).motif, 'extrait_absent');
  assert.equal(lancements(absent).length, 0);
  // le dépôt n'existe pas (le geste ne l'a pas créé) : même attente, jamais un montage de db/
  const sansDepot = monde({ extrait: false });
  rmDossier(depot(sansDepot));
  lancer(sansDepot);
  assert.equal(dernierRapport(sansDepot).motif, 'extrait_absent');
  assert.equal(lancements(sansDepot).length, 0);
});
function rmDossier(chemin) { spawnSync('rm', ['-rf', chemin]); }

/** Le temps que prend un lancement (en ms) : une FIFO ou un périphérique ne doit jamais bloquer root. */
function lancerChronometre(m, plus = {}) {
  const t0 = Date.now();
  const r = lancer(m, plus);
  return { ...r, ms: Date.now() - t0 };
}
function fabriquerUneFifo(chemin) {
  const r = spawnSync('mkfifo', [chemin]);
  assert.equal(r.status, 0, 'mkfifo');
}

test('garde-fou 20 : root n’ouvre jamais ce que le service a pu changer — une FIFO, un périphérique ou un lien à la place de l’extrait ne le bloque ni ne lui fait rien lire', { skip }, () => {
  const cible = (m) => join(m.atelier, 'depot', 'contenu-0.4.95.db');
  // une FIFO : refusée sans attente, sans ouverture (une ouverture bloquerait root)
  const fifo = monde({ extrait: false });
  mkdirSync(dirname(cible(fifo)), { recursive: true });
  fabriquerUneFifo(cible(fifo));
  const f = lancerChronometre(fifo);
  assert.equal(f.code, 0, f.out);
  assert.ok(f.ms < 15000, `root n'est pas resté bloqué (${f.ms} ms)`);
  assert.equal(dernierRapport(fifo).motif, 'extrait_refuse');
  assert.equal(lancements(fifo).length, 0);
  assert.ok(!existsSync(join(fifo.atelier, 'contenu')), 'rien n’est copié par root');
  // un périphérique (un nœud que le service, root de conteneur avec CAP_MKNOD, pourrait créer) ; sans droit de mknod, un lien vers un périphérique
  const peripherique = monde({ extrait: false });
  mkdirSync(dirname(cible(peripherique)), { recursive: true });
  if (spawnSync('mknod', [cible(peripherique), 'c', '1', '5']).status !== 0) symlinkSync('/dev/zero', cible(peripherique));
  const p = lancerChronometre(peripherique);
  assert.equal(p.code, 0, p.out);
  assert.ok(p.ms < 15000);
  assert.equal(dernierRapport(peripherique).motif, 'extrait_refuse');
  assert.equal(lancements(peripherique).length, 0);
  // un lien sur le dossier de l'extrait, et un lien sur le fichier : refusés, rien lu
  const lienDossier = monde();
  rmDossier(dirname(cible(lienDossier)));
  mkdirSync(join(lienDossier.dossier, 'hors'), { recursive: true });
  ecrire(join(lienDossier.dossier, 'hors', 'contenu-0.4.95.db'), 'hors du périmètre');
  symlinkSync(join(lienDossier.dossier, 'hors'), dirname(cible(lienDossier)));
  lancer(lienDossier);
  assert.equal(dernierRapport(lienDossier).motif, 'extrait_refuse');
  assert.ok(!existsSync(join(lienDossier.faux, 'contenu-vu.db')));
  // le code de root : aucune ouverture du fichier de l'extrait (ni dd, ni cp, ni cat, ni lecture par redirection) ; seulement des stat et des tests de type
  const source = readFileSync(join(SOURCES, 'lancer.sh'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(source.filter((l) => /\$source|\$EXTRAIT_DIR|contenu-\$/.test(l) && /\b(dd|cp|cat|head|tail|sed|awk|grep|tee|mv)\b|<\s*"?\$source/.test(l) && !l.startsWith('-v ') && !l.includes('[ -')), [], 'root ne lit jamais l’extrait');
});

test('ce que le conteneur a laissé n’est copié qu’une fois le conteneur supprimé, et seulement un fichier régulier : ni FIFO, ni périphérique, ni lien ; jamais de blocage', { skip }, () => {
  const m = monde();
  const r = lancerChronometre(m, { FAKE_FIFO: '1', FAKE_PERIPHERIQUE: '1' });
  assert.equal(r.code, 0, r.out);
  assert.ok(r.ms < 15000, `aucun blocage (${r.ms} ms)`);
  const rapport = dernierRapport(m);
  assert.equal(rapport.issue, 'fait');
  assert.equal(rapport.fabrication, false, 'une FIFO n’est pas copiée');
  assert.equal(rapport.comparaison, false, 'un périphérique n’est pas copié');
  const [id] = rapportsDe(m);
  assert.deepEqual(readdirSync(join(m.rapports, id)), ['rapport.json']);
  assert.ok(existsSync(join(m.faux, 'rm-fait')), 'le conteneur est supprimé');
  assert.ok(!existsSync(join(m.faux, 'rm-trop-tard')), 'avant tout ce que root fait des résultats');
  // un lien est refusé aussi (voir le test des plafonds), y compris vers un périphérique
  const lien = monde();
  lancer(lien, { FAKE_LIEN: '/dev/zero' });
  assert.equal(dernierRapport(lien).comparaison, false);
});

test('conteneur.sh, sans privilège : copie l’extrait sous délai, refuse un lien, une FIFO, un fichier trop gros ou vide ; puis fabrique et compare', { skip: skip || (!have('timeout') && 'timeout indisponible') }, () => {
  const dossier = join(racine, `conteneur-${(n += 1)}`);
  const lieux = Object.fromEntries(['kit', 'site', 'contenu', 'travail', 'sortie', 'resultats', 'bin'].map((x) => [x, join(dossier, x)]));
  for (const d of Object.values(lieux)) mkdirSync(d, { recursive: true });
  ecrire(join(lieux.kit, 'client', 'scripts', 'fabriquer-depuis-contenu.mjs'), '// faux');
  ecrire(join(lieux.contenu, 'contenu-0.4.95.db'), 'un extrait');
  // un faux node : enregistre ses arguments et écrit les résultats que le conteneur doit laisser
  ecrire(join(lieux.bin, 'node'), '#!/bin/sh\necho "$*" >> "$FAKE_NODE_LOG"\ncase "$*" in *fabriquer-depuis-contenu*) echo \'{ "format": "maverick-fabrication/1" }\' > "$RESULTATS/fabrication.json"; exit "${FAKE_NODE_CODE:-0}" ;; *comparer-sites*) echo \'{ "format": "maverick-comparaison/1" }\' > "$RESULTATS/comparaison.json"; exit 1 ;; esac\n');
  chmodSync(join(lieux.bin, 'node'), 0o755);
  const lancerLe = (plus = {}) => {
    const t0 = Date.now();
    const r = spawnSync('sh', [join(SOURCES, 'conteneur.sh')], {
      encoding: 'utf8', timeout: 30000,
      env: { PATH: `${lieux.bin}:${process.env.PATH}`, KIT: lieux.kit, SITE: lieux.site, CONTENU: lieux.contenu, TRAVAIL: lieux.travail, SORTIE: lieux.sortie, RESULTATS: lieux.resultats,
        VERSION_INSTALLEE: '0.4.95', FAKE_NODE_LOG: join(dossier, 'node.log'), ...plus },
    });
    return { code: r.status, ms: Date.now() - t0, out: r.stdout + r.stderr };
  };
  const ok = lancerLe();
  assert.equal(ok.code, 0, ok.out);
  assert.equal(readFileSync(join(lieux.travail, 'contenu.db'), 'utf8'), 'un extrait', 'l’extrait est copié par le conteneur');
  const appels = readFileSync(join(dossier, 'node.log'), 'utf8');
  assert.match(appels, /fabriquer-depuis-contenu\.mjs --contenu .*\/travail\/contenu\.db --sortie .*\/sortie\/site --mesure .*\/resultats\/fabrication\.json/);
  assert.match(appels, /comparer-sites\.mjs .*\/site .*\/sortie\/site --json .*\/resultats\/comparaison\.json/);
  assert.ok(existsSync(join(lieux.travail, 'kit', 'client', 'scripts', 'fabriquer-depuis-contenu.mjs')), 'le kit est copié dans le travail');
  assert.ok(existsSync(join(lieux.resultats, 'comparaison.json')));
  // un échec de la fabrication : sa sortie, et pas de comparaison
  rmDossier(join(lieux.resultats, 'comparaison.json'));
  assert.equal(lancerLe({ FAKE_NODE_CODE: '3' }).code, 3);
  assert.ok(!existsSync(join(lieux.resultats, 'comparaison.json')));
  // un lien à la place du fichier, une FIFO, un fichier vide, un fichier trop gros : 73 ou 74, jamais de blocage
  const fichier = join(lieux.contenu, 'contenu-0.4.95.db');
  rmDossier(fichier);
  symlinkSync('/etc/hostname', fichier);
  assert.equal(lancerLe().code, 73);
  rmDossier(fichier);
  fabriquerUneFifo(fichier);
  const sur = lancerLe();
  assert.equal(sur.code, 73);
  assert.ok(sur.ms < 10000, 'une FIFO ne bloque pas');
  rmDossier(fichier);
  writeFileSync(fichier, '');
  assert.equal(lancerLe().code, 74);
  writeFileSync(fichier, 'x'.repeat(200));
  assert.equal(lancerLe({ PLAFOND_EXTRAIT: '100' }).code, 74);
  // la copie qui se bloque (un fichier devenu FIFO entre le contrôle et la lecture) est coupée par `timeout` : un faux dd qui ne rend jamais la main
  ecrire(join(lieux.bin, 'dd'), '#!/bin/sh\nexec sleep 30\n');
  chmodSync(join(lieux.bin, 'dd'), 0o755);
  const bloque = lancerLe({ DELAI_DE_LA_COPIE: '1' });
  assert.equal(bloque.code, 75, bloque.out);
  assert.ok(bloque.ms < 10000, `coupée par le délai (${bloque.ms} ms)`);
});

test('disque : un conteneur dont l’espace libre passe sous le minimum PENDANT la fabrication est arrêté, et c’est une mesure', { skip }, () => {
  const m = monde();
  const dossier = join(m.dossier, 'df');
  ecrire(join(dossier, 'df'), `#!/bin/sh
n=$(cat "$FAKE_DIR/df-appels" 2>/dev/null || echo 0); echo $((n + 1)) > "$FAKE_DIR/df-appels"
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
if [ "$n" -lt 1 ]; then echo "/dev/faux 50000000 1000 40000000 1% /"; else echo "/dev/faux 50000000 49999000 1000 99% /"; fi
`);
  chmodSync(join(dossier, 'df'), 0o755);
  lancer(m, { PATH: `${dossier}:${m.bin}:${process.env.PATH}`, FAKE_JAMAIS_FINI: '1', FAKE_CODE: '137' });
  const rapport = dernierRapport(m);
  assert.equal(rapport.issue, 'echec');
  assert.equal(rapport.motif, 'disque_insuffisant');
  assert.equal(rapport.serveur.disque_libre_ko, 1000, 'l’espace relevé à l’arrêt');
  assert.ok(journalDocker(m).some((l) => l.startsWith('kill ')));
  assert.equal(lancements(m).length, 1);
});

test('basse priorité : le geste pose la tranche systemd (poids du processeur et des disques bas), le conteneur y est rangé, et son cgroup y est relevé', { skip }, () => {
  const m = monde({ reglages: false });
  assert.equal(installer(m, ['--sans-fabrication']).code, 0);
  const tranche = readFileSync(join(m.dossier, 'systemd', 'maverick-atelier.slice'), 'utf8');
  assert.match(tranche, /CPUWeight=20/);
  assert.match(tranche, /IOWeight=20/);
  const r = lancer(m);
  assert.equal(r.code, 0, r.out);
  assert.ok(lancements(m)[0].includes('--cgroup-parent maverick-atelier.slice'));
  assert.equal(dernierRapport(m).memoire.source, 'cgroup', 'memory.peak lu sous la tranche');
  assert.equal(dernierRapport(m).memoire.pic_ko, 1433600);
  // --retirer l'enlève avec les autres unités
  assert.equal(installer(m, ['--retirer']).code, 0);
  assert.ok(!existsSync(join(m.dossier, 'systemd', 'maverick-atelier.slice')));
});

test('le conteneur ne peut pas faire lire ce qu’il n’a pas écrit : un résultat trop gros ou un lien n’est jamais copié', { skip }, () => {
  const m = monde();
  json(join(m.faux, 'cmp.json'), COMPARAISON);
  ecrire(join(m.faux, 'secret.json'), '{ "format": "maverick-comparaison/1", "secret": "x" }');
  lancer(m, { FAKE_GROS: '1', FAKE_LIEN: join(m.faux, 'secret.json') });
  const rapport = dernierRapport(m);
  assert.equal(rapport.fabrication, false, 'plus de 256 Ko : refusé');
  assert.equal(rapport.comparaison, false, 'un lien : refusé');
  const [id] = rapportsDe(m);
  assert.deepEqual(readdirSync(join(m.rapports, id)), ['rapport.json']);
});

test('production, atelier non installé, ou rien à faire : aucun conteneur, aucun rapport ; l’installateur du geste refuse la production', { skip }, () => {
  const prod = monde({ mode: 'prod', reglages: false });
  const r = lancer(prod);
  assert.equal(r.code, 0);
  assert.match(r.out, /pas d'atelier/);
  assert.equal(rapportsDe(prod).length, 0);
  assert.equal(lancements(prod).length, 0);
  const refus = installer(prod);
  assert.equal(refus.code, 1);
  assert.match(refus.out, /pas une instance de test/);
  assert.ok(!existsSync(join(prod.atelier, 'reglages.env')));

  const nonInstalle = monde({ reglages: false });
  const n1 = lancer(nonInstalle);
  assert.equal(n1.code, 0);
  assert.match(n1.out, /atelier non installé/);
  assert.equal(rapportsDe(nonInstalle).length, 0);
  assert.equal(lancements(nonInstalle).length, 0);

  const sansMarque = monde();
  rmDossier(join(sansMarque.atelier, 'declencheur'));
  assert.match(lancer(sansMarque).out, /aucune marque/);
  assert.equal(lancements(sansMarque).length, 0);
});

test('les marques en attente se fondent : une marque changée pendant la fabrication relance une fois, avec la dernière version', { skip }, () => {
  const m = monde();
  // un faux docker qui, à son lancement, pose la marque d'une version plus récente (et son kit, son extrait)
  const original = readFileSync(join(m.bin, 'docker'), 'utf8');
  ecrire(join(m.bin, 'docker'), original.replace('    cid=fakecid$$', `    if [ ! -f "$FAKE_DIR/deja" ]; then touch "$FAKE_DIR/deja"; printf 'version=0.4.96\\ntag=v0.4.96\\ncommit=local\\n' > "${m.atelier}/declencheur/marque"; sed -i 's/0.4.95/0.4.96/' "${m.atelier}/kit/kit.json"; cp "${m.atelier}/depot/contenu-0.4.95.db" "${m.atelier}/depot/contenu-0.4.96.db"; fi\n    cid=fakecid$$`));
  const r = lancer(m);
  assert.equal(r.code, 0, r.out);
  assert.equal(lancements(m).length, 2);
  const versions = rapportsDe(m).map((id) => JSON.parse(readFileSync(join(m.rapports, id, 'rapport.json'), 'utf8')).version_installee);
  assert.equal(versions.length, 2, 'le premier rapport est écrit ; le second suit sans attendre un autre déclencheur');
  assert.deepEqual(versions.sort(), ['0.4.95', '0.4.96']);
});

test('seuls les derniers rapports sont gardés, et seuls des dossiers de la forme des rapports sont jamais effacés', { skip }, () => {
  const m = monde();
  for (let i = 0; i < 24; i += 1) json(join(m.rapports, `2026010${(i % 9) + 1}-${String(1000000 + i).slice(1)}`, 'rapport.json'), {});
  mkdirSync(join(m.rapports, 'a-garder'));
  ecrire(join(m.rapports, 'kit.json'), '{}');
  const avant = rapportsDe(m).length;
  assert.ok(avant >= 20);
  lancer(m);
  const apres = rapportsDe(m);
  assert.equal(apres.length, 20);
  assert.ok(apres.includes(dernierRapport(m).id), 'le nouveau rapport est gardé');
  assert.ok(existsSync(join(m.rapports, 'a-garder')) && existsSync(join(m.rapports, 'kit.json')));
});

test('le geste du propriétaire : réglages, unités systemd, image, installe.json, docker compose up -d, première fabrication ; relançable ; --etat ne change rien', { skip }, () => {
  const m = monde({ reglages: false });
  const r = installer(m, ['--memoire-max', '2g', '--besoin', '1.2g', '--cpus', '0.5', '--disque-min', '3g', '--delai', '900']);
  assert.equal(r.code, 0, r.out);
  const reglages = readFileSync(join(m.atelier, 'reglages.env'), 'utf8');
  for (const ligne of ['MEMOIRE_MAX_KO=2097152', 'BESOIN_KO=1258291', 'CPUS=0.5', 'DISQUE_MIN_KO=3145728', 'DELAI_S=900']) assert.ok(reglages.includes(ligne), ligne);
  const service = readFileSync(join(m.dossier, 'systemd', 'maverick-atelier.service'), 'utf8');
  const chemin = readFileSync(join(m.dossier, 'systemd', 'maverick-atelier.path'), 'utf8');
  assert.match(service, new RegExp(`ExecStart=/bin/sh ${m.atelier}/outils/lancer\\.sh`));
  assert.match(service, /Nice=19/);
  assert.match(service, /IOSchedulingClass=idle/);
  assert.match(service, /Type=oneshot/);
  assert.match(chemin, new RegExp(`PathChanged=${m.atelier}/declencheur/marque`));
  assert.match(chemin, /Unit=maverick-atelier\.service/);
  const installe = JSON.parse(readFileSync(join(m.rapports, 'installe.json'), 'utf8'));
  assert.equal(installe.format, 'maverick-atelier-installe/1');
  assert.equal(installe.reglages.memoire_max_ko, 2097152);
  assert.equal(installe.reglages.cpus, 0.5);
  const systemctl = readFileSync(join(m.faux, 'systemctl.log'), 'utf8');
  assert.match(systemctl, /enable --now maverick-atelier\.path/);
  assert.match(systemctl, /start --no-block maverick-atelier\.service/);
  assert.ok(journalDocker(m).includes('compose up -d'), 'docker compose up -d : le montage des rapports');
  assert.match(r.out, /relance|redémarre/i);
  // le montage vient d'un docker-compose.override.yml écrit dans l'instance de test seulement ; le docker-compose.yml livré n'est pas touché
  const surcharge = readFileSync(join(m.instance, 'docker-compose.override.yml'), 'utf8');
  assert.equal(surcharge.split('\n')[0], '# maverick-atelier : fichier écrit par atelier/installer.sh');
  assert.match(surcharge, /MAVERICK_ATELIER: \/atelier/);
  assert.match(surcharge, /- \.\/atelier\/rapports:\/atelier:ro/);
  assert.match(surcharge, /MAVERICK_ATELIER_DEPOT: \/atelier-depot/);
  assert.match(surcharge, /- \.\/atelier\/depot:\/atelier-depot\n/, 'le dépôt, en lecture-écriture : le service y fabrique l’extrait');
  assert.ok(lstatSync(join(m.atelier, 'depot')).isDirectory() && !lstatSync(join(m.atelier, 'depot')).isSymbolicLink(), 'le dépôt est créé par le geste (root)');
  assert.equal(readFileSync(join(m.instance, 'docker-compose.yml'), 'utf8'), 'services: {}\n');
  assert.ok(!existsSync(join(m.instance, 'docker-compose.override.yml.neuf')));
  assert.match(r.out, /journalctl -u maverick-atelier/);

  // relancée avec une seule option : les autres réglages sont repris, rien n'est doublé
  const encore = installer(m, ['--cpus', '2', '--sans-fabrication']);
  assert.equal(encore.code, 0, encore.out);
  const apres = readFileSync(join(m.atelier, 'reglages.env'), 'utf8');
  assert.ok(apres.includes('CPUS=2') && apres.includes('MEMOIRE_MAX_KO=2097152') && apres.includes('DELAI_S=900'));
  assert.equal(readFileSync(join(m.faux, 'systemctl.log'), 'utf8').match(/start --no-block/g).length, 1, '--sans-fabrication : pas de seconde fabrication');
  assert.equal(readFileSync(join(m.instance, 'docker-compose.override.yml'), 'utf8'), surcharge, 'le fichier est refait à l’identique');

  // --etat : rien n'est écrit
  const avant = readFileSync(join(m.atelier, 'reglages.env'), 'utf8');
  const etat = installer(m, ['--etat']);
  assert.equal(etat.code, 0, etat.out);
  assert.match(etat.out, /Kit : version 0\.4\.95/);
  assert.match(etat.out, /Mémoire maintenant/);
  assert.equal(readFileSync(join(m.atelier, 'reglages.env'), 'utf8'), avant);
});

test('le geste refuse sans rien écrire : valeur invalide, mémoire maximale sous le besoin, kit absent, cgroup v2 absent, Docker muet', { skip }, () => {
  const m = monde({ reglages: false });
  for (const args of [['--memoire-max', 'beaucoup'], ['--memoire-max', '2.5'], ['--cpus', '0'], ['--cpus', '$(id)'], ['--delai', '0'], ['--delai', 'x'], ['--disque-min', '-1g'], ['--client-google', 'a;b'], ['--memoire-max', '1g', '--besoin', '2g'], ['--inconnue'], ['--etat', '--retirer']]) {
    const r = installer(m, args);
    assert.equal(r.code, 2, `${args.join(' ')} : ${r.out}`);
  }
  assert.ok(!existsSync(join(m.atelier, 'reglages.env')) && !existsSync(join(m.rapports, 'installe.json')));
  assert.equal(readdirSync(join(m.dossier, 'systemd')).length, 0);

  const sansKit = monde({ reglages: false });
  rmDossier(join(sansKit.atelier, 'kit'));
  const k = installer(sansKit);
  assert.equal(k.code, 1);
  assert.match(k.out, /kit est absent/);
  assert.ok(!existsSync(join(sansKit.atelier, 'reglages.env')));

  const sansCgroup = monde({ reglages: false });
  rmDossier(join(sansCgroup.dossier, 'cgroup', 'cgroup.controllers'));
  assert.match(installer(sansCgroup).out, /cgroup v2 absent/);
  const muet = monde({ reglages: false });
  const r = installer(muet, [], { PATH: `${join(muet.dossier, 'rien')}:/usr/bin:/bin`.replace(/:\/usr\/bin:\/bin$/, `:${dirname(process.execPath)}:/usr/bin:/bin`) });
  assert.equal(r.code, 1);
  assert.ok(!existsSync(join(muet.atelier, 'reglages.env')));
});

test('--retirer défait tout sauf le kit : unités, réglages, installe.json, dossiers de travail, rapports ; le service et le site ne sont pas touchés', { skip }, () => {
  const m = monde({ reglages: false });
  assert.equal(installer(m, ['--sans-fabrication']).code, 0);
  json(join(m.rapports, '20261115-101500', 'rapport.json'), { id: 'x' });
  ecrire(join(m.atelier, 'sortie', 'site', 'index.html'), 'x');
  ecrire(join(m.atelier, 'depot', 'contenu-0.4.95.db'), 'extrait');
  symlinkSync('/etc', join(m.atelier, 'depot', 'un-lien-pose-par-le-service'));
  ecrire(join(m.rapports, 'kit.json'), '{}');
  const avant = journalDocker(m).length;
  const r = installer(m, ['--retirer']);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(readdirSync(join(m.dossier, 'systemd')), []);
  assert.ok(!existsSync(join(m.atelier, 'reglages.env')) && !existsSync(join(m.rapports, 'installe.json')));
  assert.deepEqual(rapportsDe(m), []);
  assert.ok(!existsSync(join(m.atelier, 'sortie')) && !existsSync(join(m.atelier, 'travail')));
  assert.ok(existsSync(join(m.atelier, 'kit', 'kit.json')) && existsSync(join(m.atelier, 'kit', 'client', 'package.json')), 'le kit reste');
  assert.ok(existsSync(join(m.rapports, 'kit.json')));
  assert.ok(!existsSync(join(m.instance, 'docker-compose.override.yml')), 'le montage des rapports est retiré avec lui');
  assert.ok(!existsSync(join(m.atelier, 'depot')), 'le dépôt est défait aussi, après la relance du service sans son montage');
  assert.deepEqual(journalDocker(m).slice(avant), ['compose up -d'], 'le service est relancé une fois, sans le montage');
  assert.ok(existsSync(join(m.instance, 'docker-compose.yml')));
  const systemctl = readFileSync(join(m.faux, 'systemctl.log'), 'utf8');
  assert.match(systemctl, /disable --now maverick-atelier\.path/);
  const rejoue = journalDocker(m).length;
  assert.equal(installer(m, ['--retirer']).code, 0, 'sûr à relancer');
  assert.equal(journalDocker(m).length, rejoue, 'rien à retirer : le service n’est pas relancé pour rien');
  // et l'atelier se réinstalle ensuite
  assert.equal(installer(m, ['--sans-fabrication']).code, 0);
  assert.ok(existsSync(join(m.atelier, 'reglages.env')));
});

test('un docker-compose.override.yml qui n’est pas celui de l’atelier est respecté : le geste s’arrête sans rien écrire et dit quoi faire ; --retirer ne le touche pas ; --sans-montage', { skip }, () => {
  const m = monde({ reglages: false });
  const etranger = '# le mien\nservices:\n  serveur:\n    environment:\n      AUTRE: 1\n';
  ecrire(join(m.instance, 'docker-compose.override.yml'), etranger);
  const r = installer(m);
  assert.equal(r.code, 1);
  assert.match(r.out, /n'est pas celui de l'atelier/);
  assert.match(r.out, /--sans-montage/);
  assert.match(r.out, /Rien n'a été écrit/);
  assert.ok(!existsSync(join(m.atelier, 'reglages.env')) && !existsSync(join(m.rapports, 'installe.json')));
  assert.equal(readdirSync(join(m.dossier, 'systemd')).length, 0);
  assert.equal(journalDocker(m).length, 0);
  assert.equal(readFileSync(join(m.instance, 'docker-compose.override.yml'), 'utf8'), etranger);
  // le propriétaire y a ajouté le montage à la main : --sans-montage installe le reste et relance le service
  const sans = installer(m, ['--sans-montage', '--sans-fabrication']);
  assert.equal(sans.code, 0, sans.out);
  assert.equal(readFileSync(join(m.instance, 'docker-compose.override.yml'), 'utf8'), etranger, 'jamais écrasé');
  assert.ok(existsSync(join(m.atelier, 'reglages.env')));
  // --retirer le laisse tel quel et le dit
  const retire = installer(m, ['--retirer']);
  assert.equal(retire.code, 0, retire.out);
  assert.match(retire.out, /laissé tel quel/);
  assert.equal(readFileSync(join(m.instance, 'docker-compose.override.yml'), 'utf8'), etranger);
});

test('ce que le service voit de <instance>/atelier/ : le dépôt et les rapports, rien d’autre ; kit, site, travail et sortie lui sont inaccessibles ou en lecture seule', { skip }, () => {
  const m = monde({ reglages: false });
  assert.equal(installer(m, ['--sans-fabrication']).code, 0);
  const compose = YAML.parse(readFileSync(fileURLToPath(new URL('../../deploy/installateur/docker-compose.yml', import.meta.url)), 'utf8'));
  const surcharge = YAML.parse(readFileSync(join(m.instance, 'docker-compose.override.yml'), 'utf8'));
  const volumes = [...compose.services.serveur.volumes, ...surcharge.services.serveur.volumes];
  const montages = volumes.map((v) => { const [source, cible, mode] = v.split(':'); return { source, cible, mode: mode ?? 'rw' }; });
  const absolu = (source) => join(m.instance, source.replace(/^\$\{[A-Z_]+:-(.*)\}$/, '$1'));
  const atelier = join(m.instance, 'atelier');
  const montesDeLAtelier = montages.filter((x) => { const a = absolu(x.source); return a === atelier || a.startsWith(`${atelier}/`) || atelier.startsWith(`${a}/`) || a === m.instance; });
  assert.deepEqual(montesDeLAtelier.map((x) => [x.source, x.cible, x.mode]).sort(), [['./atelier/depot', '/atelier-depot', 'rw'], ['./atelier/rapports', '/atelier', 'ro']],
    'aucun parent de l’atelier (jamais « . » ni « ./atelier »), aucun autre de ses composants : seuls le dépôt et les rapports');
  for (const interdit of ['kit', 'outils', 'declencheur', 'travail', 'sortie', 'resultats', 'reglages.env']) {
    assert.ok(!montages.some((x) => absolu(x.source) === join(atelier, interdit) || absolu(x.source).startsWith(`${join(atelier, interdit)}/`)), `${interdit} n'est pas monté dans le service`);
  }
  // le site est monté en lecture seule (le service ne peut pas le changer : le conteneur de l'atelier le monte aussi en lecture seule)
  assert.equal(montages.find((x) => x.cible === '/site').mode, 'ro');
  // le conteneur de l'atelier, lui : kit, site, dépôt, script en lecture seule ; travail, sortie, résultats en écriture mais jamais montés dans le service
  const ligne = (() => { const e = monde(); lancer(e); return lancements(e)[0]; })();
  assert.ok(/-v [^ ]*\/kit:\/kit:ro/.test(ligne) && /-v [^ ]*\/site:\/site:ro/.test(ligne) && /-v [^ ]*\/depot:\/contenu:ro/.test(ligne));
});

test('la production et le docker-compose.yml livré ne changent pas : aucun montage ni variable de l’atelier dans le compose commun, jamais de fichier de surcharge posé par un installateur', { skip }, () => {
  const compose = readFileSync(fileURLToPath(new URL('../../deploy/installateur/docker-compose.yml', import.meta.url)), 'utf8');
  assert.ok(!/atelier/i.test(compose), 'le compose livré, commun à la production, ne parle pas de l’atelier');
  for (const rel of ['installateur.sh', 'fabriquer.mjs', 'kit-pose.sh', 'mise-a-jour.sh']) {
    const lignes = readFileSync(fileURLToPath(new URL(`../../deploy/installateur/${rel}`, import.meta.url)), 'utf8').split('\n').filter((l) => !l.trim().startsWith('#') && !l.trim().startsWith('//'));
    assert.ok(!lignes.some((l) => /docker-compose\.override/.test(l)), `${rel} ne pose ni n'efface docker-compose.override.yml`);
  }
});

test('un docker-compose.override.yml de l’atelier survit à une nouvelle livraison de l’installateur de test', { skip }, () => {
  const depot = fauxKitDepot();
  const instance = join(racine, `instance-${(n += 1)}`);
  assert.equal(lancerInstallateur(installateur({ kit: depot }).fichier, instance).code, 0);
  ecrire(join(instance, 'docker-compose.override.yml'), '# maverick-atelier : fichier écrit par atelier/installer.sh\nservices: {}\n');
  assert.equal(lancerInstallateur(installateur({ kit: depot, version: '0.2.1' }).fichier, instance).code, 0);
  assert.equal(readFileSync(join(instance, 'docker-compose.override.yml'), 'utf8'), '# maverick-atelier : fichier écrit par atelier/installer.sh\nservices: {}\n');
});

test('garde-fou 20 : ni lancer.sh ni installer.sh n’écrivent dans db/, metriques/ ou maintenance/, ni ne montent un dossier que le service contrôle', () => {
  for (const nom of ['lancer.sh', 'installer.sh', 'lib.sh']) {
    const lignes = readFileSync(join(SOURCES, nom), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const ecritures = lignes.filter((l) => /\b(rm|rmdir|mkdir|chown|chmod|mv|cp|touch|ln|tee)\b|[^>]>[^>&]|>>|-delete/.test(l) && /(\/db\b|\bdb\/|\$base\/db|metriques|maintenance|secrets)/.test(l));
    assert.deepEqual(ecritures, [], `${nom} : aucune écriture vers un dossier du service`);
    assert.ok(!lignes.some((l) => /(-v|--volume|--mount)[ =].*(\/db\b|metriques|maintenance|secrets|docker\.sock)/.test(l)), `${nom} : aucun montage d'un dossier du service`);
    assert.ok(!lignes.some((l) => /(^|\s)(\.|source)\s+["$]?[^"\s]*(db|rapports|resultats|sortie|travail)\b/.test(l)), `${nom} : rien produit par le service ou le conteneur n'est sourcé`);
    assert.ok(!lignes.some((l) => /\bjq\b|\bsqlite3\b|(^|[|;&(]\s*)node\s/.test(l) && !l.includes('scripts/')), `${nom} : root n'interprète ni JSON ni base (le seul « node » est dans le script du conteneur)`);
  }
});

// ---------------------------------------------------------------- la livraison par l'installateur de test

function fauxKitDepot() {
  const d = join(racine, `depot-${(n += 1)}`);
  for (const [rel, contenu] of Object.entries({
    '.nvmrc': '22\n', 'client/package.json': '{}', 'client/astro.config.mjs': '', 'client/scripts/fabriquer-depuis-contenu.mjs': '', 'client/node_modules/astro/bin/astro.mjs': '',
    'data/schema.sql': '', 'data/derive.sql': '', 'data/migrations/0001.sql': '', 'sources/sources.json': '{}', 'sources/tipeee/bienvenue.json': '{}',
  })) ecrire(join(d, rel), contenu);
  return d;
}
function installateur({ mode = 'test', kit, version = '0.2.0', label = 'v1' } = {}) {
  const site = join(racine, `site-${(n += 1)}`);
  ecrire(join(site, 'index.html'), `<h1>${label}</h1>`);
  const tag = mode === 'prod' ? `v${version.replace(/\.\d+$/, '')}` : `v${version}`;
  return fabriquer({ mode, site, tag, version, sha: 'c'.repeat(40), sortie: join(racine, 'sortie'), ...(kit ? { kit } : {}) });
}
const lancerInstallateur = (fichier, dossier) => { const r = spawnSync('sh', [fichier, '--dossier', dossier], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH } }); return { code: r.status, out: r.stdout + r.stderr }; };

test('l’installateur de test livre les outils : installer.sh à la racine de l’atelier, le reste dans outils/ ; il ne touche jamais au kit, aux rapports, au travail ni à la sortie', { skip }, () => {
  const depot = fauxKitDepot();
  const instance = join(racine, `instance-${(n += 1)}`);
  const r1 = lancerInstallateur(installateur({ kit: depot }).fichier, instance);
  assert.equal(r1.code, 0, r1.out);
  const atelier = join(instance, 'atelier');
  for (const rel of ['installer.sh', 'outils/lancer.sh', 'outils/lib.sh']) {
    assert.ok(existsSync(join(atelier, rel)), rel);
    assert.equal(lstatSync(join(atelier, rel)).mode & 0o777, 0o755, `${rel} : à root, exécutable, jamais modifiable par un autre`);
    assert.equal(readFileSync(join(atelier, rel), 'utf8'), readFileSync(join(SOURCES, rel.split('/').pop()), 'utf8'), rel);
  }
  assert.ok(existsSync(join(atelier, 'kit', 'kit.json')));
  assert.equal(readFileSync(join(atelier, 'rapports', 'kit.json'), 'utf8'), readFileSync(join(atelier, 'kit', 'kit.json'), 'utf8'), 'le service lit la copie de kit.json');
  assert.equal(readFileSync(join(atelier, 'declencheur', 'marque'), 'utf8'), `version=0.2.0\ntag=v0.2.0\ncommit=${'c'.repeat(40)}\n`);
  assert.match(r1.out, /Atelier : marque posée pour la version 0\.2\.0/);
  assert.ok(!existsSync(join(atelier, 'reglages.env')), 'avant le geste du propriétaire, rien ne consomme la marque');

  // ce que l'atelier a produit depuis, et un outil qui n'est plus livré
  for (const rel of ['rapports/20261115-101500/rapport.json', 'rapports/installe.json', 'sortie/site/index.html', 'travail/x', 'contenu/contenu.db', 'reglages.env', 'declencheur/derniere-marque']) ecrire(join(atelier, rel), 'à garder');
  ecrire(join(atelier, 'outils', 'ancien.sh'), '#!/bin/sh\n');
  const r2 = lancerInstallateur(installateur({ kit: depot, version: '0.2.1', label: 'v2' }).fichier, instance);
  assert.equal(r2.code, 0, r2.out);
  for (const rel of ['rapports/20261115-101500/rapport.json', 'rapports/installe.json', 'sortie/site/index.html', 'travail/x', 'contenu/contenu.db', 'reglages.env', 'kit/kit.json']) assert.ok(existsSync(join(atelier, rel)), `${rel} reste`);
  assert.ok(!existsSync(join(atelier, 'outils', 'ancien.sh')), 'un outil qui n’est plus livré est retiré d’outils/ seulement');
  assert.match(readFileSync(join(atelier, 'declencheur', 'marque'), 'utf8'), /version=0\.2\.1/);
});

test('sans kit (ou avec un kit d’une autre version) : pas de marque ; kit.json n’est plus recopié pour le service ; la production ne reçoit rien de l’atelier', { skip }, () => {
  const sans = join(racine, `instance-${(n += 1)}`);
  const r = lancerInstallateur(installateur({}).fichier, sans);
  assert.equal(r.code, 0, r.out);
  assert.ok(existsSync(join(sans, 'atelier', 'installer.sh')), 'les outils sont livrés même sans kit');
  assert.ok(!existsSync(join(sans, 'atelier', 'declencheur', 'marque')));
  assert.ok(!existsSync(join(sans, 'atelier', 'rapports', 'kit.json')));

  // un kit posé d'une version, puis une livraison qui ne peut pas le remplacer : pas de marque pour la nouvelle version
  const depot = fauxKitDepot();
  const instance = join(racine, `instance-${(n += 1)}`);
  assert.equal(lancerInstallateur(installateur({ kit: depot }).fichier, instance).code, 0);
  const marque = readFileSync(join(instance, 'atelier', 'declencheur', 'marque'), 'utf8');
  const dfPetit = join(racine, `df-${(n += 1)}`);
  ecrire(join(dfPetit, 'df'), '#!/bin/sh\necho "Filesystem 1024-blocks Used Available Capacity Mounted on"\necho "/dev/faux 99999999 1 100 1% /"\n');
  chmodSync(join(dfPetit, 'df'), 0o755);
  const suite = spawnSync('sh', [installateur({ kit: depot, version: '0.2.1' }).fichier, '--dossier', instance], { cwd: racine, encoding: 'utf8', env: { PATH: `${dfPetit}:${process.env.PATH}` } });
  assert.equal(suite.status, 0, suite.stdout + suite.stderr);
  assert.match(suite.stdout, /pas de marque/);
  assert.equal(readFileSync(join(instance, 'atelier', 'declencheur', 'marque'), 'utf8'), marque, 'la marque d’avant n’est pas remplacée par une version sans kit');

  const prod = join(racine, `prod-${(n += 1)}`);
  assert.equal(lancerInstallateur(installateur({ mode: 'prod' }).fichier, prod).code, 0);
  assert.ok(!existsSync(join(prod, 'atelier')), 'la production ne reçoit ni outils ni marque');
});
