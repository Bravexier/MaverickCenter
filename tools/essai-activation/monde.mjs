// Le monde de l'essai de bout en bout de deploy/installateur/activer.sh (tools/essai-activation/ ; docs/serveur.md, « Bascule 2 : préparation », « PR 5a »). Il fabrique, sous
// ESSAI_ACTIVATION (défaut /srv/essai-activation), de fausses instances de production et de site de dev, avec ce que le jour J aura :
//   - un VRAI kit, fabriqué par deploy/installateur/kit.mjs depuis le dépôt, que kit.json annonce avec son paquet (le seul ajout à la main : `paquet` de kit.json, que GitHub tire de data/paquet.json) ;
//   - un VRAI paquet de mise à jour, fabriqué par serveur/paquet.mjs#fabriquerPaquet depuis l'extrait du jour (var/extrait/maverick-dev.db) ;
//   - une production dont le site est un site fabriqué avant (V0.5.20 : modèle/site-precedent, que l'on copie), sa base vivante refaite par le vrai service avec des fiches sentinelles, et ses
//     outils posés comme l'installateur de production les pose (activer.sh, activation-conteneur.sh, gel.sh à root ; site/ à l'utilisateur maverick-site SAUF _serveur/).
//   node --no-warnings tools/essai-activation/monde.mjs <reussite|refus|retour|retour-base>
// Ne lit ni n'écrit rien d'autre que ce dossier ; ne se sert d'aucun réseau.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { fabriquerLeKit } from '../../deploy/installateur/kit.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../../client/serveur/base-vivante.mjs';
import { lireReference } from '../../client/serveur/notes-de-version.mjs';
import { fabriquerPaquet } from '../../client/serveur/paquet.mjs';
import { versionDeLivraison } from '../../client/src/lib/notes-de-version.mjs';
import { marquesDesFiches, poserDesFiches } from '../../client/test/aide-fiches-sentinelles.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const DEPOT = resolve(ICI, '..', '..');
const R = process.env.ESSAI_ACTIVATION || '/srv/essai-activation';
const MODELE = join(R, 'modele');
const SITE_PRECEDENT = process.env.ESSAI_SITE_PRECEDENT || '/srv/atelier-essai/travail/site';
const EXTRAIT = process.env.ESSAI_EXTRAIT || join(DEPOT, 'var', 'extrait', 'maverick-dev.db');
const cas = process.argv[2];
if (!['reussite', 'refus', 'retour', 'retour-base'].includes(cas)) { console.error('Usage : node monde.mjs <reussite|refus|retour|retour-base>'); process.exit(2); }
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const sh = (commande, options = {}) => { const r = spawnSync('sh', ['-c', commande], { encoding: 'utf8', ...options }); if (r.status !== 0) throw new Error(`${commande} : ${r.stderr}`); return r.stdout; };
const CLIENT_VERSION = JSON.parse(readFileSync(join(DEPOT, 'client', 'package.json'), 'utf8')).version;

// ------------------------------------------------------------------ le modèle (une fois) : le kit, le site précédent, le paquet
if (!existsSync(join(MODELE, 'pret'))) {
  if (!existsSync(join(SITE_PRECEDENT, 'index.html'))) throw new Error(`le site précédent de l'essai manque (${SITE_PRECEDENT}) : ESSAI_SITE_PRECEDENT`);
  if (!existsSync(EXTRAIT)) throw new Error(`l'extrait du jour manque (${EXTRAIT}) : npm run db:extrait (NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt MAVERICK_EXTRAIT_CLE=x)`);
  rmSync(MODELE, { recursive: true, force: true });
  mkdirSync(MODELE, { recursive: true });
  console.log('modèle : le site précédent…');
  sh(`cp -a "${SITE_PRECEDENT}" "${MODELE}/site-precedent"`);
  // le service précédent tourne dans le monde : un seul numéro de version, celui du site
  console.log('modèle : le kit (kit.mjs, depuis le dépôt)…');
  const kitSortie = join(MODELE, 'kit-sortie');
  const meta = fabriquerLeKit({ racine: DEPOT, destination: kitSortie, version: CLIENT_VERSION, sha: 'local' });
  mkdirSync(join(MODELE, 'kit'));
  sh(`gzip -dc "${kitSortie}/atelier-kit.tar.gz" | tar -xof - -C "${MODELE}/kit"`);
  writeFileSync(join(MODELE, 'kit-meta.json'), JSON.stringify(meta));
  // le dev : sa base vivante est celle des règles de l'extrait du jour
  console.log('modèle : la base du site de dev (préparée depuis l\'extrait) et le paquet de la mise à jour…');
  mkdirSync(join(MODELE, 'dev', 'db'), { recursive: true });
  const { chemin } = preparerBaseVivante({ regles: EXTRAIT, dossier: join(MODELE, 'dev', 'db') });
  const dev = new DatabaseSync(chemin);
  dev.exec('DROP VIEW IF EXISTS extrait_meta');
  dev.close();
  const reference = lireReference({ production: join(MODELE, 'site-precedent'), propre: null });
  const versionDuSitePrecedent = JSON.parse(readFileSync(join(MODELE, 'site-precedent', '_serveur', 'version.json'), 'utf8')).version;
  const cible = versionDeLivraison(CLIENT_VERSION, versionDuSitePrecedent);
  const lot = '5a5a5a5a-0000-4000-8000-000000000001';
  mkdirSync(join(MODELE, 'paquets'));
  const paquet = join(MODELE, 'paquets', `${cible}-${lot}.db`);
  const m = fabriquerPaquet({ source: chemin, destination: paquet, production: reference.chemin, id: lot, mode: 'mise-a-jour', version: cible, depuis: reference.version.split('.').slice(0, 2).join('.'),
    versionDuSite: CLIENT_VERSION, instant: new Date() });
  // un autre paquet, de même nom, d'une autre empreinte : celui du cas « refus »
  const autre = join(MODELE, 'paquets', 'autre.db');
  copyFileSync(paquet, autre);
  const modif = new DatabaseSync(autre);
  modif.exec("UPDATE note_version SET texte = coalesce(texte, '') || ' (autre paquet)' WHERE exemple = 0");
  modif.close();
  const identite = { lot, version: cible, empreinte: sha(paquet), structure: m.schema };
  const kitJson = { ...meta, paquet: identite };
  writeFileSync(join(MODELE, 'kit', 'kit.json'), `${JSON.stringify(kitJson, null, 2)}\n`);
  writeFileSync(join(MODELE, 'identite.json'), JSON.stringify({ ...identite, nom: `${cible}-${lot}.db`, version_du_kit: CLIENT_VERSION, version_precedente: versionDuSitePrecedent }));
  writeFileSync(join(MODELE, 'pret'), '');
}
const identite = JSON.parse(readFileSync(join(MODELE, 'identite.json'), 'utf8'));

// ------------------------------------------------------------------ le monde vivant de ce cas
// le service d'un essai précédent (ses pid sont dans service/) : arrêté avant que le monde soit refait
rmSync(join(R, 'docker.log'), { force: true });
for (const f of ['superviseur', 'enfant']) {
  try { process.kill(Number(readFileSync(join(R, 'service', f), 'utf8').trim()), 'SIGKILL'); } catch { /* déjà sorti */ }
}
// (l'ordre compte : on tue d'abord, on efface ensuite)
const PROD = join(R, 'maverick-center');
const DEV = join(R, 'maverick-center-test');
for (const d of ['maverick-center', 'maverick-center-test', 'service', 'etat']) sh(`rm -rf ${R}/${d}`);
sh(`rm -rf ${R}/racine-*`);
mkdirSync(join(PROD, 'activation'), { recursive: true });
for (const d of ['paquets', 'maintenance', 'metriques', 'secrets']) mkdirSync(join(PROD, d));
mkdirSync(join(DEV, 'atelier'), { recursive: true });
console.log('monde : le site précédent de la production…');
sh(`cp -a "${MODELE}/site-precedent" "${PROD}/site"`);
// le dossier du site est celui de GitHub : ni le site de dev (reference.db), ni de journal
console.log('monde : le kit de la production (activation/kit/)…');
sh(`cp -a "${MODELE}/kit" "${PROD}/activation/kit"`);
sh(`chown -R root:root "${PROD}/activation/kit"`);
for (const f of ['activer.sh', 'activation-conteneur.sh', 'gel.sh']) { copyFileSync(join(DEPOT, 'deploy', 'installateur', f), join(PROD, f)); chmodSync(join(PROD, f), 0o755); }
copyFileSync(join(DEPOT, 'deploy', 'installateur', 'docker-compose.yml'), join(PROD, 'docker-compose.yml'));
writeFileSync(join(PROD, 'VERSION'), `tag=v${identite.version_precedente.split('.').slice(0, 2).join('.')}\nversion=${identite.version_precedente}\ncommit=local\nmode=prod\ninstalle_le=2026-11-19 10:00:00\n`);
writeFileSync(join(PROD, '.env'), 'MAVERICK_CONTENEUR=maverick-center\nMAVERICK_PORT=8080\n');
writeFileSync(join(PROD, 'activation', 'reglages.env'), 'DISQUE_MIN_KO=1048576\n');
writeFileSync(join(DEV, 'VERSION'), `tag=v${CLIENT_VERSION}\nversion=${CLIENT_VERSION}\ncommit=local\nmode=test\n`);
// la base de la production : celle que le vrai service fait des règles de son site, avec des fiches sentinelles
const { chemin } = preparerBaseVivante({ regles: join(PROD, 'site', 'donnees', 'maverick.db'), dossier: join(PROD, 'db') });
const base = ouvrirBaseVivante(chemin);
const poses = poserDesFiches(base);
base.close();
writeFileSync(join(R, 'marques-des-fiches.json'), JSON.stringify(marquesDesFiches(poses)));
// l'utilisateur maverick-site (que l'installateur de production crée) : site/ à lui SAUF _serveur/, qui reste à root
if (spawnSync('id', ['maverick-site']).status !== 0) sh('useradd --system --no-create-home --shell /usr/sbin/nologin maverick-site');
sh(`find -P "${PROD}/site" -path "${PROD}/site/_serveur" -prune -o -exec chown -h maverick-site:maverick-site {} +`);
sh(`find -P "${PROD}/site/_serveur" -exec chown -h root:root {} +`);
sh(`chown root:root "${PROD}" "${PROD}/activation" "${PROD}/activer.sh" "${PROD}/activation-conteneur.sh" "${PROD}/gel.sh" "${PROD}/docker-compose.yml"; chmod 755 "${PROD}" "${PROD}/paquets"`);
// l'interrupteur
writeFileSync(join(PROD, 'activation-par-paquet'), '');
// le paquet que le site de dev a déposé (cas « refus » : un autre fichier sous le nom que le kit annonce)
copyFileSync(join(MODELE, 'paquets', cas === 'refus' ? 'autre.db' : identite.nom), join(PROD, 'paquets', identite.nom));
// les outils de la machine d'essai
sh(`rm -rf "${R}/bin" "${R}/bin-conteneur"; mkdir -p "${R}/bin"; cp -a /srv/atelier-essai/bin "${R}/bin-conteneur"`);
copyFileSync(join(ICI, 'docker'), join(R, 'bin', 'docker'));
copyFileSync(join(ICI, 'docker.mjs'), join(R, 'bin', 'docker.mjs'));
copyFileSync(join(ICI, 'sqlite3'), join(R, 'bin', 'sqlite3'));
chmodSync(join(R, 'bin', 'docker'), 0o755);
chmodSync(join(R, 'bin', 'sqlite3'), 0o755);
console.log(`monde prêt (${cas}) : ${PROD}`);
console.log(`  kit V${identite.version_du_kit}, paquet ${identite.nom} (empreinte ${identite.empreinte.slice(0, 12)}…), production à la V${identite.version_precedente}, ${readdirSync(join(PROD, 'site')).length} entrées dans site/`);
