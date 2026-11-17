// L'état des sauvegardes (sauvegardes.json) écrit là où le service de chaque instance le lit (deploy/installateur/sauvegarde/lib.sh#ecrire_json,
// #metriques_de_l_instance ; docs/serveur.md, « Sauvegardes automatiques »). Le dossier des métriques réglé (MAVERICK_DIR_METRIQUES, <normal>/metriques) n'existe
// pas sur un serveur où instances.sh n'a pas été relancé depuis les métriques : l'état va alors dans le dossier que le conteneur de chaque instance monte sur son
// dossier des métriques (docker inspect), sinon dans celui que son .env désigne. Monde factice (aide-sauvegardes.mjs), lib.sh exécuté pour de bon par bash, faux docker.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SCRIPTS, aOutil, creerMonde } from './aide-sauvegardes.mjs';

const skip = !aOutil('bash') && 'bash indisponible';

/**
 * Un faux docker qui note ses appels et répond à `inspect -f <format> <conteneur>` d'après des fichiers du monde : `<conteneur>.montages` (lignes
 * « destination|source ») et `<conteneur>.env` (lignes VAR=valeur) ; un conteneur sans fichier n'existe pas (code 1).
 */
function fauxDockerInspect(monde) {
  const d = monde.d('docker');
  mkdirSync(d, { recursive: true });
  const chemin = monde.d('bin', 'docker-inspect');
  writeFileSync(chemin, `#!/bin/sh
printf '%s\\n' "$*" >> '${d}/appels'
[ "$1" = inspect ] || exit 1
case "$3" in
  *Mounts*) f='${d}/'"$4"'.montages' ;;
  *Env*) f='${d}/'"$4"'.env' ;;
  *) exit 1 ;;
esac
[ -f "$f" ] || exit 1
cat "$f"
`);
  chmodSync(chemin, 0o755);
  const conteneur = (nom, { montages, env }) => {
    writeFileSync(join(d, `${nom}.montages`), `${montages.map(([dest, src]) => `${dest}|${src}`).join('\n')}\n`);
    writeFileSync(join(d, `${nom}.env`), `${env.join('\n')}\n`);
  };
  const appels = () => (existsSync(join(d, 'appels')) ? readFileSync(join(d, 'appels'), 'utf8') : '');
  return { chemin, conteneur, appels };
}
/** Exécute ecrire_json de lib.sh dans le monde, le dossier des métriques réglé absent sauf `garder`. */
function ecrireLEtat(monde, docker, { garder = false } = {}) {
  if (!garder) rmSync(monde.d('normal', 'metriques'), { recursive: true, force: true });
  const r = spawnSync('bash', ['-c', '. "$1/lib.sh"; ecrire_json', '_', SCRIPTS], { encoding: 'utf8', env: { ...monde.env, MAVERICK_SAUV_DOCKER: docker.chemin } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}
const lireJson = (chemin) => JSON.parse(readFileSync(chemin, 'utf8'));

test('dossier des métriques réglé absent : l’état va là où chaque conteneur lit ses métriques (montage vu par docker inspect), créé s’il manque', { skip }, (t) => {
  const m = creerMonde(t);
  const docker = fauxDockerInspect(m);
  // le site de dev : un docker-compose.yml d'avant les métriques (pas de MAVERICK_DOSSIER_METRIQUES) : son service les range dans <MAVERICK_DB>/metriques
  docker.conteneur('maverick-center-test-serveur', { montages: [['/site', m.d('test', 'site')], ['/db', m.d('test', 'db')]], env: ['PATH=/usr/bin', 'MAVERICK_DB=/db'] });
  // la production : un dossier des métriques monté ailleurs
  docker.conteneur('maverick-center-serveur', { montages: [['/db', m.d('normal', 'db')], ['/metriques', m.d('normal', 'autres-metriques')]], env: ['MAVERICK_DB=/db', 'MAVERICK_DOSSIER_METRIQUES=/metriques'] });
  const r = ecrireLEtat(m, docker);
  assert.equal(r.code, 0, r.out);
  for (const chemin of [m.d('test', 'db', 'metriques', 'sauvegardes.json'), m.d('normal', 'autres-metriques', 'sauvegardes.json')]) {
    assert.equal(lireJson(chemin).format, 1, chemin);
    assert.equal(statSync(chemin).mode & 0o777, 0o644, 'lisible par les conteneurs');
  }
  assert.equal(existsSync(m.d('normal', 'metriques')), false, 'le dossier réglé n’est pas créé : aucun conteneur ne le lit');
  assert.match(r.out, /dossier des métriques réglé absent/);
  assert.match(docker.appels(), /inspect -f .* maverick-center-test-serveur/);
});

test('dossier réglé absent, sans conteneur : le dossier que le .env de l’instance désigne s’il existe ; un dossier seulement déduit n’est jamais créé', { skip }, (t) => {
  const m = creerMonde(t);
  const docker = fauxDockerInspect(m);
  mkdirSync(m.d('partage'));
  writeFileSync(m.d('test', '.env'), `MAVERICK_CONTENEUR=maverick-center-test\nMAVERICK_DOSSIER_METRIQUES=${m.d('partage')}\n`);
  const r = ecrireLEtat(m, docker);
  assert.equal(r.code, 0, r.out);
  assert.equal(lireJson(m.d('partage', 'sauvegardes.json')).format, 1);
  assert.equal(existsSync(m.d('normal', 'metriques')), false, '<normal>/metriques, déduit pour la production, n’est pas créé');
  // plus rien de lisible : rien n'est écrit, et le message le dit
  rmSync(m.d('partage'), { recursive: true });
  const rien = ecrireLEtat(m, docker);
  assert.equal(rien.code, 0);
  assert.match(rien.out, /dossier des métriques introuvable .* : état non écrit/);
});

test('dossier réglé présent : l’état y va seul, comme avant, sans interroger docker', { skip }, (t) => {
  const m = creerMonde(t);
  const docker = fauxDockerInspect(m);
  docker.conteneur('maverick-center-test-serveur', { montages: [['/db', m.d('test', 'db')]], env: ['MAVERICK_DB=/db'] });
  const r = ecrireLEtat(m, docker, { garder: true });
  assert.equal(r.code, 0, r.out);
  assert.equal(lireJson(m.d('normal', 'metriques', 'sauvegardes.json')).format, 1);
  assert.equal(existsSync(m.d('test', 'db', 'metriques')), false);
  assert.equal(docker.appels(), '');
});
