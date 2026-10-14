// Livraison du service avec le site (client/serveur/livraison.mjs, docs/serveur.md) : ses modules sont copiés dans dist/_serveur/ (Node seul, sans
// paquet npm), le point d'entrée livré démarre tel quel, et les fichiers d'hébergement (deploy/nginx.conf, les deux docker-compose.yml) disent
// tous la même chose : le conteneur « serveur » exécute _serveur/serveur/index.mjs sur le port 8787, nginx lui transmet /api/ et refuse /_serveur/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { CLIENT, DOSSIER_LIVRE, ENTREE, livrerServeur, modulesDuServeur } from '../serveur/livraison.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-livraison-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const depot = fileURLToPath(new URL('../../', import.meta.url));
const lire = (chemin) => readFileSync(join(depot, chemin), 'utf8');
const ENTREE_LIVREE = `/site/${DOSSIER_LIVRE}/${ENTREE}`;

test('modules livrés : l’entrée, le service, le format des fiches et l’édition (modèle, découpages et rendus du bestiaire, des armes et des composants partagés avec les pages) ; ni le lanceur de développement, ni cette livraison, ni un paquet npm', () => {
  assert.deepEqual(modulesDuServeur(), [
    'serveur/api.mjs', 'serveur/base-vivante.mjs', 'serveur/edition-armes.mjs', 'serveur/edition-bestiaire.mjs', 'serveur/edition-chronologie.mjs',
    'serveur/edition-composants.mjs', 'serveur/edition-journal.mjs', 'serveur/edition.mjs', 'serveur/fiches-retraits.mjs', 'serveur/fiches.mjs', 'serveur/index.mjs',
    'serveur/maintenance.mjs', 'serveur/notes-de-version.mjs', 'serveur/service.mjs', 'src/lib/arme-champs.mjs', 'src/lib/armes-db.mjs', 'src/lib/armes-rendu.mjs',
    'src/lib/bestiaire-db.mjs', 'src/lib/bestiaire-rendu.mjs', 'src/lib/caracteristiques-postures.mjs', 'src/lib/chronologie.mjs', 'src/lib/class-groups.mjs',
    'src/lib/classe-champs.mjs', 'src/lib/composants-champs.mjs', 'src/lib/composants-db.mjs', 'src/lib/corps-armes.mjs', 'src/lib/corps-classes.mjs',
    'src/lib/corps-composants.mjs', 'src/lib/corps-magies.mjs', 'src/lib/corps-metiers.mjs', 'src/lib/corps-races.mjs', 'src/lib/dons-edition.mjs',
    'src/lib/edition-modele.mjs', 'src/lib/fiche-format.mjs', 'src/lib/guide.mjs', 'src/lib/json-python.mjs', 'src/lib/markdown-edition.mjs', 'src/lib/markdown-sur.mjs',
    'src/lib/materiaux-couleurs.mjs', 'src/lib/metier-champs.mjs', 'src/lib/monnaies.mjs', 'src/lib/monstre-champs.mjs', 'src/lib/monstre-rendu.mjs',
    'src/lib/mots-cles.mjs', 'src/lib/notes-de-version-sens.mjs',
    'src/lib/notes-de-version.mjs', 'src/lib/portrait.mjs', 'src/lib/race-kinds.mjs', 'src/lib/sort-analyse.mjs', 'src/lib/sort-etats.mjs', 'src/lib/sort-format.mjs', 'src/lib/sort-maitrise.mjs', 'src/lib/text.mjs',
  ]);
  const faux = join(racine, 'faux-client');
  mkdirSync(join(faux, 'serveur'), { recursive: true });
  writeFileSync(join(faux, 'serveur', 'index.mjs'), "import { a } from './a.mjs';\nexport { b } from \"./b.mjs\";\nconst c = await import('./c.mjs');\n");
  writeFileSync(join(faux, 'serveur', 'a.mjs'), "import {\n  x,\n} from 'node:fs';\nexport const a = 1;\n");
  writeFileSync(join(faux, 'serveur', 'b.mjs'), "import YAML from 'yaml';\n");
  writeFileSync(join(faux, 'serveur', 'c.mjs'), 'export default 1;\n');
  assert.throws(() => modulesDuServeur(faux), /serveur\/b\.mjs importe « yaml » : le service n'utilise que Node/);
  writeFileSync(join(faux, 'serveur', 'b.mjs'), 'export const b = 2;\n');
  assert.deepEqual(modulesDuServeur(faux), ['serveur/a.mjs', 'serveur/b.mjs', 'serveur/c.mjs', 'serveur/index.mjs']);
  writeFileSync(join(faux, 'serveur', 'c.mjs'), "import '../../ailleurs.mjs';\n");
  assert.throws(() => modulesDuServeur(faux), /que des modules de client\//);
});

test('le service livré démarre tel quel depuis dist/_serveur/ (variables d’environnement du conteneur), répond, puis s’arrête sur SIGTERM', async () => {
  const dist = join(racine, 'dist');
  const info = livrerServeur(dist, { version: '1.2.3' });
  assert.deepEqual(info.modules, modulesDuServeur());
  assert.equal(info.entree, `${DOSSIER_LIVRE}/${ENTREE}`);
  assert.match(info.empreinte, /^[0-9a-f]{16}$/);
  assert.deepEqual(JSON.parse(readFileSync(join(dist, DOSSIER_LIVRE, 'version.json'), 'utf8')), info);
  for (const m of info.modules) assert.equal(readFileSync(join(dist, DOSSIER_LIVRE, m), 'utf8'), readFileSync(join(CLIENT, m), 'utf8'), m);
  assert.equal(livrerServeur(dist, { version: '1.2.3' }).empreinte, info.empreinte, 'même code, même empreinte');

  const regles = join(racine, 'maverick.db');
  copyFileSync(cheminBase({ sansExemples: false }), regles);
  const enfant = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', join(dist, DOSSIER_LIVRE, ENTREE)], {
    env: { PATH: process.env.PATH, HOST: '127.0.0.1', PORT: '0', MAVERICK_REGLES: regles, MAVERICK_DB: join(racine, 'db'), MAVERICK_INTERVALLE: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let sortie = '';
  enfant.stdout.on('data', (d) => { sortie += d; });
  enfant.stderr.on('data', (d) => { sortie += d; });
  try {
    for (let i = 0; i < 200 && !/http:\/\/127\.0\.0\.1:\d+\/api\//.test(sortie); i += 1) await new Promise((ok) => setTimeout(ok, 50));
    const url = /http:\/\/127\.0\.0\.1:(\d+)\/api\//.exec(sortie)?.[0];
    assert.ok(url, sortie);
    const etat = await (await fetch(`${url}etat`)).json();
    assert.deepEqual({ version: etat.version, code: etat.code, disponible: etat.base.disponible }, { version: '1.2.3', code: info.empreinte, disponible: true });
    assert.ok(existsSync(join(racine, 'db', 'vivante.db')));
  } finally {
    const fin = new Promise((ok) => enfant.once('exit', (code) => ok(code)));
    enfant.kill('SIGTERM');
    assert.equal(await fin, 0, sortie);
  }
});

test('docker-compose.yml du NAS et des installateurs : un conteneur « serveur » qui exécute le service livré, sans port publié', () => {
  for (const fichier of ['deploy/docker-compose.yml', 'deploy/installateur/docker-compose.yml']) {
    const compose = YAML.parse(lire(fichier));
    const serveur = compose.services.serveur;
    assert.ok(serveur, `${fichier} : service « serveur »`);
    assert.equal(serveur.image, 'node:22-alpine', fichier);
    assert.equal(serveur.restart, 'unless-stopped', `${fichier} : relancé après l’arrêt qui suit une nouvelle version`);
    assert.ok(!serveur.ports, `${fichier} : seul nginx atteint le service`);
    assert.match(serveur.command.join(' '), new RegExp(`exec node --disable-warning=ExperimentalWarning ${ENTREE_LIVREE.replaceAll('.', '\\.')}$`), fichier);
    assert.match(serveur.command.join(' '), new RegExp(`until \\[ -f ${ENTREE_LIVREE.replaceAll('.', '\\.')} \\]`), `${fichier} : attend le site`);
    // édition des règles (docs/serveur.md, « Édition ») : réglée par le .env de l'instance (1 sur le serveur de test), jamais sur le NAS
    // page « Mise à jour » (docs/serveur.md) : adresse publique et jeton GitHub du serveur de test, dans un dossier secrets/ en lecture seule
    const installateur = fichier.includes('installateur');
    // maintenance pendant une mise à jour (docs/serveur.md) : un dossier d'annonce monté, celui de l'instance sauf réglage (serveur de test : celui du
    // serveur normal) ; le NAS d'avant la 0.2.0 n'a qu'un site, sans mise à jour depuis la page
    const edition = installateur
      ? { MAVERICK_EDITION: '${MAVERICK_EDITION:-0}', MAVERICK_ADRESSE_PUBLIQUE: '${MAVERICK_ADRESSE_PUBLIQUE:-}', MAVERICK_GITHUB_JETON_FICHIER: '/secrets/github-actions-token',
        MAVERICK_MAINTENANCE: '/maintenance' }
      : {};
    assert.deepEqual(serveur.environment, { HOST: '0.0.0.0', PORT: '8787', MAVERICK_REGLES: '/site/donnees/maverick.db', MAVERICK_DB: '/db', ...edition }, fichier);
    assert.deepEqual(serveur.volumes, ['./site:/site:ro', './db:/db',
      ...(installateur ? ['./secrets:/secrets:ro', '${MAVERICK_DOSSIER_MAINTENANCE:-./maintenance}:/maintenance'] : [])], fichier);
    assert.ok(compose.services['maverick-center'].volumes.includes('./site:/usr/share/nginx/html:ro'), fichier);
  }
  assert.match(YAML.parse(lire('deploy/installateur/docker-compose.yml')).services.serveur.container_name, /^\$\{MAVERICK_CONTENEUR:-maverick-center\}-serveur$/,
    'serveur normal et serveur de test côte à côte : noms distincts');
});

test('nginx.conf : /api/ transmis au service (même port, résolu à chaque requête, sans le mot de passe), /_serveur/ jamais servi', () => {
  const conf = lire('deploy/nginx.conf');
  const bloc = (debut) => conf.slice(conf.indexOf(debut), conf.indexOf('}', conf.indexOf(debut)) + 1);
  const api = bloc('location /api/ {');
  assert.match(api, /resolver 127\.0\.0\.11 /);
  assert.match(api, /set \$service http:\/\/serveur:8787;/);
  assert.match(api, /proxy_pass \$service;/);
  assert.match(api, /proxy_connect_timeout 5s;/, 'service arrêté : erreur en quelques secondes, pas en une minute');
  assert.match(api, /proxy_set_header Host \$http_host;/);
  assert.match(api, /proxy_set_header Authorization "";/);
  assert.match(api, /client_max_body_size 1m;/);
  assert.match(bloc('location ^~ /_serveur/ {'), /return 404;/);
  assert.ok(conf.indexOf('auth_basic "Maverick Center";') < conf.indexOf('location /api/'), 'le mot de passe du site protège aussi /api/');
  const compose = YAML.parse(lire('deploy/docker-compose.yml'));
  assert.equal(`http://serveur:${compose.services.serveur.environment.PORT}`, /set \$service (\S+);/.exec(api)[1]);
});

test('développement et version portable : `npm run serveur`, /api/ transmis par `npm run dev`, intégration au build, _serveur/ hors de la version portable', () => {
  const paquet = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8'));
  assert.equal(paquet.scripts.serveur, 'node --disable-warning=ExperimentalWarning serveur/dev.mjs');
  const config = readFileSync(join(CLIENT, 'astro.config.mjs'), 'utf8');
  // le service livré avec le site, et la base de la production (page « Mise à jour » : scripts/db-reference.mjs) à côté de celle du site
  assert.match(config, /integrations: \[integrationServeur\(\), integrationReference\(\)\]/);
  assert.match(config, /proxy: \{ \[`\$\{base\}api\/`\]: \{ target: service,/);
  assert.match(lire('tools/build-artifact.mjs'), /if \(rel\.startsWith\('_serveur\/'\)\) continue;/);
});
