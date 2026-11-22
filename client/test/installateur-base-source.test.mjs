// L'installateur et la base source (deploy/installateur/installateur.sh ; lot 8 du chantier de la base de dev, garde-fous 6 et 7 ; docs/serveur.md, « Base
// source (lot 8) ») : avec db/source, ni --copier-base-prod ni une publication plus ancienne que celle installée (refus avant toute écriture) ; sans lui, rien ne
// change. L'installateur de test livre bascule.sh à la racine de l'instance, celui de production non. Nécessite sh, tar et gzip ; sinon les tests sont ignorés.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fabriquer } from '../../deploy/installateur/fabriquer.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SEUL_LINUX } from './aide-plateforme.mjs';

const have = (cmd) => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
const skip = !(have('tar') && have('gzip')) && 'tar ou gzip indisponible';
const racine = dossierTemporaire('installateur-source');
// pas de service pour répondre à l'essai de la structure : l'installateur attend une seconde l'accusé, puis continue (ou refuse avant, avec db/source)
const ESSAI = { MAVERICK_ESSAI_ACCUSE_S: '1', MAVERICK_ESSAI_DELAI_S: '3' };

let n = 0;
function site(label) {
  const d = join(racine, `site-${(n += 1)}`);
  for (const [p, c] of Object.entries({ 'index.html': `<h1>accueil ${label}</h1>`, 'wiki/p/index.html': `<p>page ${label}</p>` })) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}
const installateur = ({ mode = 'test', label, version }) => fabriquer({
  mode, site: site(label), tag: mode === 'prod' ? `v${version.replace(/\.\d+$/, '')}` : `v${version}`, version, sha: 'd'.repeat(40), sortie: join(racine, 'sortie'),
}).fichier;
const lancer = (fichier, args = [], env = {}) => {
  const p = spawnSync('sh', [fichier, ...args], { cwd: racine, encoding: 'utf8', env: { PATH: process.env.PATH, ...ESSAI, ...env } });
  return { code: p.status, out: `${p.stdout}${p.stderr}` };
};
/** L'état d'une arborescence : chemin → empreinte ; hors installation.log. */
function etat(dossier) {
  const r = {};
  const parcourir = (d) => {
    for (const nom of readdirSync(d).sort()) {
      const chemin = join(d, nom);
      const rel = relative(dossier, chemin);
      if (rel === 'installation.log') continue;
      if (statSync(chemin).isDirectory()) { r[`${rel}/`] = ''; parcourir(chemin); } else r[rel] = createHash('sha256').update(readFileSync(chemin)).digest('hex');
    }
  };
  parcourir(dossier);
  return r;
}
/** Une instance installée (version `version`), en service (une base vivante), avec ou sans marqueur. */
function enService(nom, { mode = 'test', version = '0.2.2', source = true } = {}) {
  const dossier = join(racine, nom);
  const r = lancer(installateur({ mode, label: 'en place', version }), ['--dossier', dossier]);
  assert.equal(r.code, 0, r.out);
  writeFileSync(join(dossier, 'db', 'vivante.db'), 'la base vivante du site de dev');
  if (source) writeFileSync(join(dossier, 'db', 'source'), 'format=maverick-source/1\n');
  return dossier;
}

test('db/source : --copier-base-prod est refusé avant toute écriture', { skip: SEUL_LINUX || skip }, () => {
  const prod = join(racine, 'maverick-center');
  assert.equal(lancer(installateur({ mode: 'prod', label: 'prod', version: '0.2.0' }), ['--dossier', prod]).code, 0);
  const dev = enService('copie-refusee');
  const avant = etat(dev);
  const r = lancer(installateur({ label: 'v3', version: '0.2.3' }), ['--dossier', dev, '--copier-base-prod', '--dossier-prod', prod]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /--copier-base-prod refusé : .*db\/source existe/);
  assert.deepEqual(etat(dev), avant, 'rien n’a été modifié');
});

test('db/source : une publication plus ancienne que celle installée est refusée, une égale ou plus récente s’installe (garde-fou 7)', { skip: SEUL_LINUX || skip }, () => {
  const dev = enService('plus-ancienne', { version: '0.2.10' });
  const avant = etat(dev);
  const r = lancer(installateur({ label: 'ancienne', version: '0.2.9' }), ['--dossier', dev]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /publication 0\.2\.9 refusée : elle est plus ancienne que la 0\.2\.10 installée/);
  assert.deepEqual(etat(dev), avant, 'site/, VERSION et db/ intacts');
  for (const version of ['0.2.10', '0.3.0']) {
    const ok = lancer(installateur({ label: version, version }), ['--dossier', dev]);
    assert.equal(ok.code, 0, ok.out);
    assert.match(readFileSync(join(dev, 'VERSION'), 'utf8'), new RegExp(`^version=${version.replace(/\./g, '\\.')}$`, 'm'));
  }
  assert.equal(readFileSync(join(dev, 'db', 'vivante.db'), 'utf8'), 'la base vivante du site de dev');
  assert.ok(existsSync(join(dev, 'db', 'source')));
});

test('sans db/source : une publication plus ancienne s’installe comme avant (le contrôle est celui de mise-a-jour.sh)', { skip: SEUL_LINUX || skip }, () => {
  const dev = enService('sans-marqueur', { version: '0.2.10', source: false });
  const r = lancer(installateur({ label: 'ancienne', version: '0.2.9' }), ['--dossier', dev]);
  assert.equal(r.code, 0, r.out);
  assert.match(readFileSync(join(dev, 'VERSION'), 'utf8'), /^version=0\.2\.9$/m);
});

test('bascule.sh, repetition-prod.sh et repetition-bascule-2.sh : livrés par l’installateur de test à la racine de l’instance, exécutables ; jamais par celui de production', { skip: SEUL_LINUX || skip }, () => {
  const dev = enService('livraison-bascule', { source: false });
  const prod = join(racine, 'prod-sans-bascule');
  assert.equal(lancer(installateur({ mode: 'prod', label: 'p', version: '0.2.0' }), ['--dossier', prod]).code, 0);
  for (const nom of ['bascule.sh', 'repetition-prod.sh', 'repetition-bascule-2.sh']) {
    const livre = join(dev, nom);
    assert.equal(readFileSync(livre, 'utf8'), readFileSync(new URL(`../../deploy/installateur/${nom}`, import.meta.url), 'utf8'));
    assert.equal(statSync(livre).mode & 0o755, 0o755);
    assert.equal(existsSync(join(prod, nom)), false);
  }
});
