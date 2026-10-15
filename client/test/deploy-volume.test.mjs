// Volume sur le serveur (docs/serveur.md, « Métriques et volume ») : les journaux de chaque conteneur tournent (sinon Docker les garde sans limite),
// les métriques de chaque instance sont montées hors de db/ dans un dossier partagé réglable comme celui de la maintenance, la mesure des pages par
// le navigateur est active par défaut (décision du propriétaire du 2026-10-15), et la documentation dit ce que fait le code.
// Docker n'est pas lancé ici : les fichiers sont lus et comparés.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { ARCHIVES_GARDEES } from '../serveur/base-vivante.mjs';
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
  for (const titre of ['### Où sont les métriques', '### Volume estimé des métriques', '### Tout ce qui grossit sur le serveur']) assert.ok(section.includes(titre), titre);
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
});
