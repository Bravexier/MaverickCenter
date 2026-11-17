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
import { UA_SONDE } from '../serveur/metriques.mjs';
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
  ps) [ -z "\${FAKE_MONTAGES_RW:-}" ] || echo conteneur-de-service; exit 0 ;;
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
    # une livraison qui arrive pendant la fabrication : la marque change (une seule fois), comme le fait l'installateur de test
    [ -z "\${FAKE_NOUVELLE_MARQUE:-}" ] || [ -f "$FAKE_DIR/marque-posee" ] || { cp "$FAKE_NOUVELLE_MARQUE" "$FAKE_MARQUE"; touch "$FAKE_DIR/marque-posee"; }
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
      *Mounts*) [ -z "\${FAKE_MONTAGES_RW:-}" ] || printf '%s\\n' $FAKE_MONTAGES_RW; exit 0 ;;
      *State.Running*)
        k=$(cat "$FAKE_DIR/inspections" 2>/dev/null || echo 0); echo $((k + 1)) > "$FAKE_DIR/inspections"
        if [ "\${FAKE_JAMAIS_FINI:-0}" = 1 ] && [ ! -f "$FAKE_DIR/tue" ]; then echo true; elif [ "$k" -lt "\${FAKE_ITERATIONS:-1}" ]; then echo true; else echo false; fi ;;
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
/** Un faux curl : il vérifie le contrat de la sonde (corps jeté vers /dev/null, seuls le code et le temps relevés), note ses appels et sa configuration lue sur l'entrée, et répond ce que le test a prévu pour le port. */
const FAUX_CURL = `#!/bin/sh
echo "$*" >> "$FAKE_DIR/curl.log"
config=''
case "$*" in *"-K -"*) config=$(cat) ;; esac
printf '%s\\n' "$config" >> "$FAKE_DIR/curl-config.log"
case "$*" in *"-o /dev/null"*) ;; *) echo "-o /dev/null manque" >> "$FAKE_DIR/curl-violations" ;; esac
case "$*" in *"%{http_code} %{time_total}"*) ;; *) echo "-w manque" >> "$FAKE_DIR/curl-violations" ;; esac
case "$*" in *--dump-header*|*" -D "*|*" -O "*|*--output\\ *|*" -L "*|*--location*|*--data*|*" -X "*) echo "option interdite : $*" >> "$FAKE_DIR/curl-violations" ;; esac
for dernier in "$@"; do :; done
port=\${dernier#http://127.0.0.1:}; port=\${port%%/*}
fichier="$FAKE_DIR/curl-$port.txt"
if [ -f "$fichier" ]; then
  n=$(cat "$FAKE_DIR/curl-$port.n" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$FAKE_DIR/curl-$port.n"
  total=$(wc -l < "$fichier"); [ "$n" -le "$total" ] || n=$total
  sed -n "\${n}p" "$fichier" | tr -d '\\n'
else
  printf '200 0.010'
fi
`;
const FAUX_SYSTEMCTL = '#!/bin/sh\necho "$*" >> "$FAKE_DIR/systemctl.log"\ncase "$1" in is-enabled) echo enabled ;; is-active) echo active ;; esac\nexit 0\n';

/** Un monde : une instance de test avec son atelier (scripts du dépôt, kit, marque, extrait du service), des faux outils et de la mémoire à volonté. */
function monde({ mode = 'test', total = 8388608, dispo = 6291456, version = '0.4.95', reglages = true, extrait = true, kitVersion = version, image = IMAGE, sonde = false, depuis = 0 } = {}) {
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
  if (reglages) ecrire(join(atelier, 'reglages.env'), `MEMOIRE_MAX_KO=2621440\nBESOIN_KO=1572864\nCPUS=1\nDISQUE_MIN_KO=2097152\nDELAI_S=1800\nGOOGLE_CLIENT_ID=\nJOURS_DE_MESURE=1\nMAX_PAR_JOUR=12\nMESURE_DEPUIS=${depuis}\n`);
  // la sonde : le port de chaque instance, dans son .env (celui de la production dans le dossier voisin « maverick-center »)
  if (sonde) {
    ecrire(join(instance, '.env'), 'MAVERICK_CONTENEUR=maverick-center-test\nMAVERICK_PORT=8081\nMAVERICK_EDITION=1\n');
    ecrire(join(dossier, 'maverick-center', '.env'), 'MAVERICK_CONTENEUR=maverick-center\nMAVERICK_PORT=8080\n');
  }
  // les faux outils
  const bin = join(dossier, 'bin');
  const faux = join(dossier, 'faux');
  mkdirSync(bin);
  mkdirSync(faux);
  ecrire(join(bin, 'docker'), FAUX_DOCKER);
  ecrire(join(bin, 'systemctl'), FAUX_SYSTEMCTL);
  ecrire(join(bin, 'curl'), FAUX_CURL);
  chmodSync(join(bin, 'curl'), 0o755);
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
      MAVERICK_ATELIER_INTERVALLE: '0', MAVERICK_ATELIER_ATTENTE: '1', MAVERICK_ATELIER_SONDE_REFERENCE: '1', MAVERICK_ATELIER_SONDE_APRES: '1', MAVERICK_ATELIER_ACCES: join(dossier, 'acces-caddy.env'), MAVERICK_DIR_ETC_SYSTEMD: join(dossier, 'systemd'), FAKE_DIR: faux, FAKE_CGROUP: join(dossier, 'cgroup'), FAKE_RAPPORTS: join(atelier, 'rapports'), ...plus,
    }),
  };
}
const lancer = (m, plus = {}, args = []) => { const r = spawnSync('sh', [join(m.atelier, 'outils', 'lancer.sh'), ...args], { encoding: 'utf8', env: m.env(plus), timeout: 120000 }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };
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

test('seuls les derniers rapports sont gardés (40 : de quoi couvrir une journée pleine), et seuls des dossiers de la forme des rapports sont jamais effacés', { skip }, () => {
  const m = monde();
  for (let i = 0; i < 44; i += 1) json(join(m.rapports, `2026010${(i % 9) + 1}-${String(1000000 + i).slice(1)}`, 'rapport.json'), {});
  mkdirSync(join(m.rapports, 'a-garder'));
  ecrire(join(m.rapports, 'kit.json'), '{}');
  assert.equal(rapportsDe(m).length, 44);
  lancer(m);
  const apres = rapportsDe(m);
  assert.equal(apres.length, 40);
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
  // Docker muet : un faux docker qui échoue, placé en tête du PATH (la machine de la CI a un vrai Docker : on ne compte jamais sur son absence)
  const muet = monde({ reglages: false });
  const binMuet = join(muet.dossier, 'docker-muet');
  mkdirSync(binMuet);
  ecrire(join(binMuet, 'docker'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(binMuet, 'docker'), 0o755);
  const r = installer(muet, [], { PATH: `${binMuet}:${muet.bin}:${process.env.PATH}` });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Docker ne répond pas/);
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

// ---------------------------------------------------------------- la journée type : la sonde, les minuteurs, le plafond du jour

const MAINTENANT = Date.UTC(2026, 10, 15, 12, 0, 0) / 1000; // 15 novembre 2026, 12:00 UTC
const idDe = (epoch) => new Date(epoch * 1000).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
/** Pose des rapports factices : [{ il_y_a (secondes), origine, motif, issue }]. */
function poserDesRapports(m, liste) {
  for (const { il_y_a: ilYA, origine = 'livraison', motif = null, issue = 'fait' } of liste) {
    const id = idDe(MAINTENANT - ilYA);
    json(join(m.rapports, id, 'rapport.json'), { format: 'maverick-atelier/1', id, origine, issue, motif });
  }
}
const horloge = (epoch = MAINTENANT) => ({ MAVERICK_ATELIER_MAINTENANT: String(epoch) });
const appelsDeCurl = (m) => (existsSync(join(m.faux, 'curl.log')) ? readFileSync(join(m.faux, 'curl.log'), 'utf8').split('\n').filter(Boolean) : []);
const reponses = (m, port, lignes) => ecrire(join(m.faux, `curl-${port}.txt`), `${lignes.join('\n')}\n`);

test('les centiles de la sonde (le rang le plus proche) : le script de root donne les nombres du bilan du service', { skip }, async () => {
  const { centile } = await import('../src/lib/atelier-bilan.mjs');
  const dossier = join(racine, `stats-${(n += 1)}`);
  mkdirSync(dossier);
  const lib = join(SOURCES, 'lib.sh');
  const stats = (ms, erreurs = []) => {
    ecrire(join(dossier, 'mesures'), ms.map((v, i) => `phase prod ${erreurs.includes(i) ? 500 : 200} ${v} ${erreurs.includes(i) ? 1 : 0}`).join('\n') + '\n');
    return JSON.parse(spawnSync('sh', ['-c', `. "${lib}"; SONDE_DIR="${dossier}"; sonde_stats phase prod`], { encoding: 'utf8' }).stdout);
  };
  const vingt = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.deepEqual(stats(vingt), { n: 20, mediane_ms: 10, p95_ms: 19, max_ms: 20, erreurs: 0 });
  assert.deepEqual(stats([42]), { n: 1, mediane_ms: 42, p95_ms: 42, max_ms: 42, erreurs: 0 });
  assert.deepEqual(stats([30, 10]), { n: 2, mediane_ms: 10, p95_ms: 30, max_ms: 30, erreurs: 0 });
  assert.deepEqual(stats([5, 9, 7, 3, 1], [0, 3]), { n: 5, mediane_ms: 5, p95_ms: 9, max_ms: 9, erreurs: 2 });
  ecrire(join(dossier, 'mesures'), '');
  assert.deepEqual(JSON.parse(spawnSync('sh', ['-c', `. "${lib}"; SONDE_DIR="${dossier}"; sonde_stats phase prod`], { encoding: 'utf8' }).stdout), { n: 0, mediane_ms: null, p95_ms: null, max_ms: null, erreurs: 0 });
  // le même calcul que le bilan du service, sur des séries au hasard (mêmes rangs)
  for (const taille of [1, 2, 3, 7, 19, 20, 21, 40, 101]) {
    const serie = Array.from({ length: taille }, (_, i) => ((i * 7919) % 997) + 1);
    const r = stats(serie);
    assert.equal(r.mediane_ms, centile(serie, 50), `médiane de ${taille}`);
    assert.equal(r.p95_ms, centile(serie, 95), `95e centile de ${taille}`);
    assert.equal(r.max_ms, Math.max(...serie));
  }
});

test('la sonde : une référence, la fabrication, un après ; les deux instances, deux cibles publiques en lecture seule, jamais un corps de réponse', { skip }, () => {
  const m = monde({ sonde: true });
  reponses(m, 8080, ['200 0.010', '200 0.030', '200 0.020', '200 0.025', '200 0.015', '200 0.040', '200 0.012', '200 0.011']);
  reponses(m, 8081, ['200 0.100', '200 0.120', '200 0.110', '200 0.130', '200 0.140', '200 0.150', '200 0.160', '200 0.170']);
  const r = lancer(m, { FAKE_ITERATIONS: '3', MAVERICK_ATELIER_INTERVALLE: '1', MAVERICK_ATELIER_SONDE_REFERENCE: '2', MAVERICK_ATELIER_SONDE_APRES: '2' });
  assert.equal(r.code, 0, r.out);
  const rapport = dernierRapport(m);
  assert.equal(rapport.issue, 'fait', r.out);
  const sonde = rapport.sonde;
  assert.equal(sonde.format, 'maverick-sonde/1');
  assert.equal(sonde.disponible, true);
  assert.deepEqual(sonde.cibles, ['/', '/api/personnages/']);
  assert.equal(sonde.delai_s, 5);
  assert.equal(sonde.arretee, null);
  for (const instance of ['prod', 'dev']) {
    const i = sonde.instances[instance];
    assert.equal(i.disponible, true, instance);
    assert.equal(i.authentifie, false, 'sans mot de passe interne lu, le 401 de nginx est la réponse');
    assert.equal(i.phases.reference.n, 2, `${instance} : une requête par seconde pendant la référence`);
    assert.equal(i.phases.apres.n, 2);
    assert.ok(i.phases.fabrication.n >= 1, `${instance} : des mesures pendant la fabrication`);
    assert.equal(i.phases.reference.erreurs, 0);
    for (const phase of Object.values(i.phases)) assert.ok(phase.mediane_ms <= phase.p95_ms && phase.p95_ms <= phase.max_ms);
  }
  assert.equal(sonde.instances.prod.phases.reference.max_ms, 30, 'les deux premières réponses de la production : 10 ms et 30 ms');
  assert.equal(sonde.instances.dev.phases.reference.max_ms, 120);
  // les appels : le bon hôte, les ports lus dans les .env, les deux cibles, jamais plus que prévu
  const appels = appelsDeCurl(m);
  assert.ok(appels.length >= 8);
  const urls = new Set(appels.map((a) => a.split(' ').at(-1)));
  assert.deepEqual([...urls].sort(), ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080/api/personnages/', 'http://127.0.0.1:8081/', 'http://127.0.0.1:8081/api/personnages/']);
  for (const appel of appels) {
    assert.match(appel, /--max-time 5 /);
    assert.match(appel, /-s -A maverick-atelier-sonde\/1 -o \/dev\/null -w %\{http_code\} %\{time_total\}/);
    assert.ok(appel.includes(`-A ${UA_SONDE} `), 'le User-Agent de la sonde est celui que le service n’enregistre pas dans ses métriques');
  }
  assert.ok(!existsSync(join(m.faux, 'curl-violations')), existsSync(join(m.faux, 'curl-violations')) ? readFileSync(join(m.faux, 'curl-violations'), 'utf8') : '');
  // rien d'une réponse n'est gardé : ni dans le rapport, ni dans l'atelier ; le dossier de travail de la sonde est effacé
  assert.deepEqual(readdirSync(m.atelier).filter((x) => x.startsWith('.sonde')), []);
  assert.deepEqual(readdirSync(join(m.rapports, rapport.id)), ['rapport.json']);
});

test('la sonde ne garde que le code et le temps : root n’interprète jamais le corps (le code de lancer.sh, et un corps sentinelle jeté)', { skip }, () => {
  const lignes = readFileSync(join(SOURCES, 'lancer.sh'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const curl = lignes.filter((l) => /\bcurl\b/.test(l) && !l.startsWith('if ! command'));
  assert.ok(curl.length >= 1);
  for (const l of curl) {
    assert.match(l, /-o \/dev\/null/);
    assert.match(l, /-w '%\{http_code\} %\{time_total\}'/);
    assert.doesNotMatch(l, /--dump-header|\s-D\s|\s-O\s|\s-L\s|--data|\s-X\s|--output /);
  }
  // un faux curl qui « reçoit » un corps : il n'arrive nulle part dans ce que root écrit
  const m = monde({ sonde: true });
  const sentinelle = 'CORPS-SENTINELLE-NE-DOIT-PAS-SE-RETROUVER';
  ecrire(join(m.bin, 'curl'), `#!/bin/sh\\necho "${sentinelle}" > /dev/null\\nprintf '200 0.010'\\n`.replace(/\\\\n/g, '\\n'));
  chmodSync(join(m.bin, 'curl'), 0o755);
  lancer(m);
  assert.equal(spawnSync('grep', ['-r', sentinelle, m.atelier, m.faux], { encoding: 'utf8' }).stdout, '', 'rien d’une réponse n’est gardé, nulle part');
  assert.ok(dernierRapport(m).duree_ms < 1500, 'la durée est celle du conteneur : la référence et l’après (une seconde chacune ici) n’y comptent pas');
});

test('la sonde s’arrête aussitôt quand la production répond mal (trois mauvaises réponses de suite), sans insister ; la fabrication continue', { skip }, () => {
  const m = monde({ sonde: true });
  reponses(m, 8080, ['500 0.010', '503 0.010', '200 5.000', '200 0.010', '200 0.010']);
  const r = lancer(m, { MAVERICK_ATELIER_SONDE_REFERENCE: '6', MAVERICK_ATELIER_SONDE_APRES: '2' });
  assert.equal(r.code, 0, r.out);
  const rapport = dernierRapport(m);
  assert.equal(rapport.issue, 'fait', 'la fabrication, elle, continue');
  assert.deepEqual(rapport.sonde.arretee, { instance: 'prod', motif: 'reponses_mauvaises' });
  assert.equal(rapport.sonde.instances.prod.phases.reference.n, 3, 'trois mesures, puis plus rien : un 500, un 503 et un délai dépassé');
  assert.equal(rapport.sonde.instances.prod.phases.reference.erreurs, 3);
  assert.equal(rapport.sonde.instances.prod.phases.fabrication.n, 0);
  assert.equal(rapport.sonde.instances.prod.phases.apres.n, 0);
  assert.equal(appelsDeCurl(m).filter((a) => a.includes(':8080')).length, 3, 'la production n’est plus interrogée une fois la sonde arrêtée');
  assert.equal(appelsDeCurl(m).filter((a) => a.includes(':8081')).length, 2, 'et la sonde est arrêtée tout entière : le site de dev n’a plus reçu de requête après le troisième tour');
  assert.match(r.out, /sonde arrêtée/);
});

test('le .env d’une instance dans un dossier monté en écriture dans un conteneur n’est pas lu : « sonde impossible » pour cette instance', { skip }, () => {
  const m = monde({ sonde: true });
  const prod = join(m.dossier, 'maverick-center');
  // le dossier de la production est monté en écriture dans un conteneur (le service pourrait avoir changé son .env)
  lancer(m, { FAKE_MONTAGES_RW: `${prod} ${join(m.instance, 'db')}` });
  const sonde = dernierRapport(m).sonde;
  assert.deepEqual([sonde.instances.prod.disponible, sonde.instances.prod.motif], [false, 'env_monte']);
  assert.equal(sonde.instances.prod.phases, null);
  assert.equal(sonde.instances.dev.disponible, true, 'db/ de l’instance de test est monté, pas son .env');
  assert.ok(!appelsDeCurl(m).some((a) => a.includes(':8080')), 'aucune requête vers une instance dont le port n’est pas fiable');
  // un parent monté en écriture : refusé aussi ; un dossier voisin : sans effet
  const parent = monde({ sonde: true });
  lancer(parent, { FAKE_MONTAGES_RW: parent.instance });
  assert.equal(dernierRapport(parent).sonde.instances.dev.motif, 'env_monte');
  const voisin = monde({ sonde: true });
  lancer(voisin, { FAKE_MONTAGES_RW: `${voisin.instance}/db ${voisin.instance}/metriques ${voisin.dossier}/autre` });
  assert.equal(dernierRapport(voisin).sonde.instances.dev.disponible, true);
  assert.equal(dernierRapport(voisin).sonde.instances.prod.disponible, true);
  // ni .env, ni sonde : « sonde impossible » (aucune requête)
  const sans = monde();
  lancer(sans);
  assert.deepEqual([dernierRapport(sans).sonde.disponible, dernierRapport(sans).sonde.motif], [false, 'sonde_impossible']);
  assert.equal(appelsDeCurl(sans).length, 0);
  // un lien à la place du .env : refusé
  const lien = monde({ sonde: true });
  rmDossier(join(lien.instance, '.env'));
  symlinkSync(join(lien.dossier, 'maverick-center', '.env'), join(lien.instance, '.env'));
  lancer(lien);
  assert.equal(dernierRapport(lien).sonde.instances.dev.motif, 'env_absent');
});

test('le mot de passe interne (celui que Caddy présente) : lu chez root, passé à curl par l’entrée standard (jamais dans la ligne de commande), jamais dans un rapport', { skip }, () => {
  const m = monde({ sonde: true });
  const secretProd = Buffer.from('invite:secret-prod-123').toString('base64');
  const secretTest = Buffer.from('invite:secret-test-456').toString('base64');
  ecrire(join(m.dossier, 'acces-caddy.env'), `MAVERICK_DOMAINE=exemple.invalid\nMAVERICK_ACCES_NORMAL=${secretProd}\nMAVERICK_ACCES_TEST=${secretTest}\n`);
  lancer(m);
  const sonde = dernierRapport(m).sonde;
  assert.equal(sonde.instances.prod.authentifie, true);
  assert.equal(sonde.instances.dev.authentifie, true);
  const config = readFileSync(join(m.faux, 'curl-config.log'), 'utf8');
  assert.ok(config.includes(`header = "Authorization: Basic ${secretProd}"`) && config.includes(`header = "Authorization: Basic ${secretTest}"`));
  assert.ok(!appelsDeCurl(m).join('\\n').includes(secretProd) && !appelsDeCurl(m).join('\\n').includes(secretTest), 'jamais dans les arguments (visibles par ps)');
  const [id] = rapportsDe(m);
  assert.ok(!readFileSync(join(m.rapports, id, 'rapport.json'), 'utf8').includes('secret') && !readFileSync(join(m.rapports, id, 'rapport.json'), 'utf8').includes(secretProd));
  // avec un mot de passe lu, un 401 est une erreur
  const m2 = monde({ sonde: true });
  ecrire(join(m2.dossier, 'acces-caddy.env'), `MAVERICK_ACCES_NORMAL=${secretProd}\nMAVERICK_ACCES_TEST=${secretTest}\n`);
  reponses(m2, 8081, ['401 0.010', '401 0.010', '200 0.010']);
  lancer(m2, { MAVERICK_ATELIER_SONDE_REFERENCE: '3' });
  assert.equal(dernierRapport(m2).sonde.instances.dev.phases.reference.erreurs, 2);
});

test('le plafond du jour compte toutes les origines, livraisons comprises : au-delà, plus aucune fabrication ce jour-là, un seul rapport court le dit', { skip }, () => {
  const m = monde({ depuis: MAINTENANT - 3600 });
  poserDesRapports(m, [
    ...Array.from({ length: 4 }, (_, i) => ({ il_y_a: 3600 * 5 + i * 60, origine: 'livraison' })),
    ...Array.from({ length: 4 }, (_, i) => ({ il_y_a: 3600 * 4 + i * 60, origine: 'journee_type' })),
    ...Array.from({ length: 3 }, (_, i) => ({ il_y_a: 3600 * 3 + i * 60, origine: 'nuit', issue: 'refus', motif: 'memoire_insuffisante' })),
    { il_y_a: 3600 * 36, origine: 'livraison' }, // la veille : ne compte pas
  ]);
  writeFileSync(join(m.atelier, 'reglages.env'), readFileSync(join(m.atelier, 'reglages.env'), 'utf8').replace('MAX_PAR_JOUR=12', 'MAX_PAR_JOUR=12'));
  // 11 fabrications ce jour-là : la 12e est permise (livraison), puis plus aucune
  const douzieme = lancer(m, horloge());
  assert.equal(douzieme.code, 0, douzieme.out);
  assert.equal(dernierRapport(m).issue, 'fait');
  assert.equal(dernierRapport(m).origine, 'livraison');
  const treizieme = lancer(m, horloge(MAINTENANT + 60));
  assert.equal(treizieme.code, 0, treizieme.out);
  const dernier = dernierRapport(m);
  assert.equal(dernier.issue, 'refus');
  assert.equal(dernier.motif, 'plafond_du_jour');
  assert.equal(lancements(m).length, 1, 'aucune autre fabrication');
  const avant = rapportsDe(m).length;
  const encore = lancer(m, horloge(MAINTENANT + 120));
  assert.match(encore.out, /plafond du jour atteint/);
  assert.equal(rapportsDe(m).length, avant, 'un seul rapport court par jour');
  assert.equal(lancements(m).length, 1);
  // le lendemain : de nouveau permis
  const lendemain = lancer(m, horloge(MAINTENANT + 86400));
  assert.equal(lendemain.code, 0, lendemain.out);
  assert.equal(dernierRapport(m).issue, 'fait');
  // le plafond se règle
  const petit = monde({ depuis: MAINTENANT - 60 });
  writeFileSync(join(petit.atelier, 'reglages.env'), `${readFileSync(join(petit.atelier, 'reglages.env'), 'utf8').replace('MAX_PAR_JOUR=12', 'MAX_PAR_JOUR=2')}`);
  poserDesRapports(petit, [{ il_y_a: 7200 }, { il_y_a: 3600, origine: 'nuit' }]);
  lancer(petit, horloge());
  assert.equal(dernierRapport(petit).motif, 'plafond_du_jour');
});

test('le minuteur du jour n’ajoute une fabrication que si la fenêtre est ouverte, que la journée en compte moins de 10 et que la dernière date de plus de 40 minutes', { skip }, () => {
  const ARGS = ['--origine', 'journee_type'];
  const sans = (m, plus = horloge()) => { const r = lancer(m, plus, ARGS); assert.equal(r.code, 0, r.out); if (process.env.DEBUG_ATELIER) console.error(r.out); return r; };
  // fenêtre fermée : le geste date de plus d'un jour (1 jour par défaut) ; ou jamais posée
  const fermee = monde({ depuis: MAINTENANT - 86400 - 10 });
  assert.match(sans(fermee).out, /fenêtre de mesure est fermée/);
  assert.equal(rapportsDe(fermee).length, 0);
  assert.equal(lancements(fermee).length, 0);
  const jamais = monde({ depuis: 0 });
  assert.match(sans(jamais).out, /fenêtre de mesure est fermée/);
  // fenêtre ouverte, rien d'autre aujourd'hui : fabrique, origine journee_type
  const ouverte = monde({ depuis: MAINTENANT - 3600 });
  sans(ouverte);
  assert.equal(dernierRapport(ouverte).origine, 'journee_type');
  assert.equal(dernierRapport(ouverte).issue, 'fait');
  assert.equal(lancements(ouverte).length, 1);
  // trop tôt : la dernière date de moins de 40 minutes
  const tot = monde({ depuis: MAINTENANT - 3600 });
  poserDesRapports(tot, [{ il_y_a: 39 * 60 }]);
  assert.match(sans(tot).out, /la dernière fabrication date de 39 min/);
  assert.equal(lancements(tot).length, 0);
  assert.equal(rapportsDe(tot).length, 1);
  // pile 40 minutes : permis
  const pile = monde({ depuis: MAINTENANT - 3600 });
  poserDesRapports(pile, [{ il_y_a: 40 * 60 }]);
  sans(pile);
  assert.equal(lancements(pile).length, 1);
  // la journée est pleine : 10 fabrications aujourd'hui (celles de la veille ne comptent pas)
  const pleine = monde({ depuis: MAINTENANT - 3600 });
  poserDesRapports(pleine, [...Array.from({ length: 10 }, (_, i) => ({ il_y_a: 3600 * 3 + i * 600 })), { il_y_a: 3600 * 30 }]);
  assert.match(sans(pleine).out, /la journée est pleine/);
  assert.equal(lancements(pleine).length, 0);
  const neuf = monde({ depuis: MAINTENANT - 3600 });
  poserDesRapports(neuf, [...Array.from({ length: 9 }, (_, i) => ({ il_y_a: 3600 * 3 + i * 600 })), { il_y_a: 3600 * 30 }]);
  sans(neuf);
  assert.equal(lancements(neuf).length, 1, 'neuf aujourd’hui : une de plus est permise');
  // les rapports « plafond du jour » ne sont pas des fabrications
  const plafond = monde({ depuis: MAINTENANT - 3600 });
  poserDesRapports(plafond, [...Array.from({ length: 9 }, (_, i) => ({ il_y_a: 3600 * 3 + i * 600 })), { il_y_a: 3600 * 2, issue: 'refus', motif: 'plafond_du_jour' }]);
  sans(plafond);
  assert.equal(lancements(plafond).length, 1);
  // une fenêtre de plusieurs jours reste ouverte
  const troisJours = monde({ depuis: MAINTENANT - 2 * 86400 });
  writeFileSync(join(troisJours.atelier, 'reglages.env'), readFileSync(join(troisJours.atelier, 'reglages.env'), 'utf8').replace('JOURS_DE_MESURE=1', 'JOURS_DE_MESURE=3'));
  sans(troisJours);
  assert.equal(lancements(troisJours).length, 1);
  // origine inconnue : refusée
  assert.equal(lancer(monde(), {}, ['--origine', 'pirate']).code, 2);
  assert.equal(lancer(monde(), {}, ['--autre']).code, 2);
});

test('la fabrication de nuit : toujours permise (sans fenêtre ni écart), marquée « nuit », sous les mêmes règles de mémoire et de plafond', { skip }, () => {
  const m = monde({ depuis: 0 });
  poserDesRapports(m, [{ il_y_a: 60 }]);
  const r = lancer(m, horloge(), ['--origine', 'nuit']);
  assert.equal(r.code, 0, r.out);
  assert.equal(dernierRapport(m).origine, 'nuit');
  assert.equal(dernierRapport(m).issue, 'fait');
  const sansMemoire = monde({ dispo: 2000000 });
  lancer(sansMemoire, {}, ['--origine', 'nuit']);
  assert.equal(dernierRapport(sansMemoire).motif, 'memoire_insuffisante');
  assert.equal(dernierRapport(sansMemoire).origine, 'nuit');
  // une livraison garde l'origine « livraison » ; la nuit ne relit pas la marque en boucle
  const livraison = monde();
  lancer(livraison);
  assert.equal(dernierRapport(livraison).origine, 'livraison');
});

test('le geste pose la nuit (04:30) et la journée type (toutes les 20 minutes entre 8 h et 20 h), à l’horloge ; --retirer les retire ; les options se valident et se reprennent', { skip }, () => {
  const m = monde({ reglages: false });
  const r = installer(m, ['--jours-de-mesure', '3', '--max-par-jour', '8', '--sans-fabrication'], horloge());
  assert.equal(r.code, 0, r.out);
  const unites = join(m.dossier, 'systemd');
  const nuit = readFileSync(join(unites, 'maverick-atelier-nuit.timer'), 'utf8');
  const jour = readFileSync(join(unites, 'maverick-atelier-jour.timer'), 'utf8');
  assert.match(nuit, /OnCalendar=\*-\*-\* 04:30:00/);
  assert.match(jour, /OnCalendar=\*-\*-\* 08\.\.19:00\/20:00/);
  assert.match(readFileSync(join(unites, 'maverick-atelier-nuit.service'), 'utf8'), new RegExp(`ExecStart=/bin/sh ${m.atelier}/outils/lancer\\.sh --origine nuit\\n`));
  assert.match(readFileSync(join(unites, 'maverick-atelier-jour.service'), 'utf8'), new RegExp(`ExecStart=/bin/sh ${m.atelier}/outils/lancer\\.sh --origine journee_type\\n`));
  for (const nom of ['nuit', 'jour']) assert.match(readFileSync(join(unites, `maverick-atelier-${nom}.service`), 'utf8'), /Nice=19\n[\s\S]*IOSchedulingClass=idle/);
  assert.match(readFileSync(join(m.faux, 'systemctl.log'), 'utf8'), /enable --now maverick-atelier\.path maverick-atelier-nuit\.timer maverick-atelier-jour\.timer/);
  const reglages = readFileSync(join(m.atelier, 'reglages.env'), 'utf8');
  assert.ok(reglages.includes('JOURS_DE_MESURE=3') && reglages.includes('MAX_PAR_JOUR=8') && reglages.includes(`MESURE_DEPUIS=${MAINTENANT}`));
  assert.ok(reglages.includes(`DOSSIER_PROD=${m.dossier}/maverick-center`), 'la production voisine par défaut');
  const installe = JSON.parse(readFileSync(join(m.rapports, 'installe.json'), 'utf8'));
  assert.equal(installe.reglages.jours_de_mesure, 3);
  assert.equal(installe.reglages.max_par_jour, 8);
  // relancé : la fenêtre se rouvre à la date de la relance, les autres réglages sont repris
  const relance = installer(m, ['--sans-fabrication'], horloge(MAINTENANT + 86400));
  assert.equal(relance.code, 0, relance.out);
  const apres = readFileSync(join(m.atelier, 'reglages.env'), 'utf8');
  assert.ok(apres.includes(`MESURE_DEPUIS=${MAINTENANT + 86400}`) && apres.includes('JOURS_DE_MESURE=3') && apres.includes('MAX_PAR_JOUR=8'));
  // --etat dit la fenêtre
  const etat = installer(m, ['--etat'], horloge(MAINTENANT + 86400 + 60));
  assert.match(etat.out, /fenêtre de mesure de 3 jour\(s\).*\(ouverte\)/);
  assert.match(etat.out, /au plus 8 fabrications par jour/);
  assert.match(etat.out, /minuteur de nuit/);
  // --retirer : les quatre unités de plus partent
  assert.equal(installer(m, ['--retirer']).code, 0);
  assert.deepEqual(readdirSync(unites), []);
  assert.match(readFileSync(join(m.faux, 'systemctl.log'), 'utf8'), /disable --now maverick-atelier\.path maverick-atelier-nuit\.timer maverick-atelier-jour\.timer/);
  // des valeurs refusées, sans rien écrire
  const refus = monde({ reglages: false });
  for (const args of [['--jours-de-mesure', '0'], ['--jours-de-mesure', '31'], ['--jours-de-mesure', 'x'], ['--max-par-jour', '0'], ['--max-par-jour', '49'], ['--dossier-prod', 'relatif'], ['--dossier-prod', '/a b'], ['--dossier-prod', '/x;y']]) {
    assert.equal(installer(refus, args).code, 2, args.join(' '));
  }
  assert.ok(!existsSync(join(refus.atelier, 'reglages.env')));
  // le dossier de la production se règle
  const prod = monde({ reglages: false });
  assert.equal(installer(prod, ['--dossier-prod', '/srv/maverick-center', '--sans-fabrication']).code, 0);
  assert.ok(readFileSync(join(prod.atelier, 'reglages.env'), 'utf8').includes('DOSSIER_PROD=/srv/maverick-center\n'));
});

test('garde-fou 20, sonde : lancer.sh ne lit que le .env des instances (jamais un fichier du service), n’écrit rien de la sonde ailleurs que dans son dossier de travail à root', () => {
  const lignes = readFileSync(join(SOURCES, 'lancer.sh'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  assert.ok(lignes.some((l) => /mktemp -d "\$ATELIER\/\.sonde/.test(l)), 'dossier de travail à root, dans l’atelier');
  assert.ok(!lignes.some((l) => /curl.*\$SONDE_ACCES|curl.* -u |curl.*--user/.test(l)), 'le mot de passe ne passe jamais en argument');
  assert.ok(lignes.some((l) => /curl .*-K -/.test(l)), 'il passe par l’entrée standard');
});

/** Pose la marque d'une livraison « qui arrive pendant la fabrication » : le faux docker la copie sur la marque à l'instant du lancement du conteneur. */
function livraisonEnCours(m) {
  const nouvelle = join(m.dossier, 'marque-nouvelle');
  ecrire(nouvelle, `version=0.4.95\ntag=v0.4.95\ncommit=${'b'.repeat(40)}\n`);
  return { FAKE_NOUVELLE_MARQUE: nouvelle, FAKE_MARQUE: join(m.atelier, 'declencheur', 'marque') };
}

test('une livraison arrivée pendant une fabrication de nuit ou de la journée type n’est pas perdue : la marque est relue en sortant, et elle est fabriquée à la suite sous l’origine « livraison »', { skip }, () => {
  for (const origine of ['nuit', 'journee_type']) {
    const m = monde({ depuis: MAINTENANT - 3600 });
    const r = lancer(m, { ...horloge(), ...livraisonEnCours(m) }, ['--origine', origine]);
    assert.equal(r.code, 0, r.out);
    const rapports = rapportsDe(m).map((id) => JSON.parse(readFileSync(join(m.rapports, id, 'rapport.json'), 'utf8')));
    assert.deepEqual(rapports.map((x) => x.origine), [origine, 'livraison'], `${origine} : deux fabrications, la livraison en dernier`);
    assert.deepEqual(rapports.map((x) => x.issue), ['fait', 'fait']);
    assert.equal(lancements(m).length, 2);
    assert.match(readFileSync(join(m.atelier, 'declencheur', 'derniere-marque'), 'utf8'), /commit=b{40}/, 'la marque de la livraison est mémorisée comme celle des livraisons');
  }
  // sans livraison entre-temps : une seule fabrication, la marque n'est pas relue en boucle
  const seule = monde();
  lancer(seule, horloge(), ['--origine', 'nuit']);
  assert.equal(rapportsDe(seule).length, 1);
  assert.equal(lancements(seule).length, 1);
  assert.ok(!existsSync(join(seule.atelier, 'declencheur', 'derniere-marque')));
});

test('la livraison arrivée pendant une fabrication de nuit reste sous le plafond du jour : au-delà, un rapport court le dit, sans fabrication', { skip }, () => {
  const m = monde({ depuis: MAINTENANT - 3600 });
  poserDesRapports(m, Array.from({ length: 11 }, (_, i) => ({ il_y_a: 3600 * 2 + i * 60, origine: i % 2 ? 'journee_type' : 'livraison' })));
  const r = lancer(m, { ...horloge(), ...livraisonEnCours(m) }, ['--origine', 'nuit']);
  assert.equal(r.code, 0, r.out);
  const dernier = dernierRapport(m);
  assert.equal(dernier.origine, 'livraison');
  assert.equal(dernier.motif, 'plafond_du_jour');
  assert.equal(lancements(m).length, 1, 'seule la fabrication de nuit (la douzième) a tourné');
});
