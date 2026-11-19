// Le conteneur de l'atelier (deploy/installateur/atelier/conteneur.sh ; docs/serveur.md, « Atelier du site de dev », « PR 5a ») : le site fabriqué que l'atelier copie vers sa sortie n'emporte JAMAIS le
// `_serveur/` que le build y a livré (le code du kit) : le site servi porte le sien, posé par l'installateur, et poser-un-site.mjs refuse un `_serveur` dans sa source (84). Le vrai script, avec un kit
// factice dont la fabrication livre un `_serveur/` comme le vrai build (integrationServeur) ; la comparaison avec le site livré voit encore ce `_serveur/` (elle a lieu avant).
//   node --test test/deploy-atelier-conteneur.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCRIPT = fileURLToPath(new URL('../../deploy/installateur/atelier/conteneur.sh', import.meta.url));
const skip = spawnSync('sh', ['-c', 'command -v timeout && command -v dd'], { stdio: 'ignore' }).status !== 0 && 'timeout ou dd indisponible';
const ecrire = (chemin, contenu) => { mkdirSync(dirname(chemin), { recursive: true }); writeFileSync(chemin, contenu); };

function monde(t) {
  const r = dossierTemporaire('atelier-conteneur', { t });
  ecrire(join(r, 'kit', 'client', 'scripts', 'fabriquer-depuis-contenu.mjs'), `
import { mkdirSync, writeFileSync } from 'node:fs';
const a = process.argv.slice(2);
const o = (n) => a[a.indexOf(n) + 1];
mkdirSync(o('--sortie') + '/_serveur/serveur', { recursive: true });
writeFileSync(o('--sortie') + '/index.html', '<html></html>');
writeFileSync(o('--sortie') + '/_serveur/serveur/index.mjs', '// le service du kit');
writeFileSync(o('--mesure'), '{}');
`);
  // la comparaison note ce qu'elle voit du site fabriqué
  ecrire(join(r, 'kit', 'client', 'scripts', 'comparer-sites.mjs'), `
import { existsSync, writeFileSync } from 'node:fs';
const a = process.argv.slice(2);
writeFileSync(${JSON.stringify(join(r, 'vu.txt'))}, existsSync(a[1] + '/_serveur/serveur/index.mjs') ? '_serveur vu' : '_serveur absent');
`);
  ecrire(join(r, 'contenu', 'contenu-1.2.3.db'), 'un fichier de contenu');
  for (const d of ['site', 'travail', 'sortie', 'resultats']) mkdirSync(join(r, d), { recursive: true });
  return r;
}
const lancer = (r, env = {}) => spawnSync('sh', [SCRIPT], {
  encoding: 'utf8',
  env: { PATH: process.env.PATH, KIT: join(r, 'kit'), SITE: join(r, 'site'), CONTENU: join(r, 'contenu'), TRAVAIL: join(r, 'travail'), SORTIE: join(r, 'sortie'), RESULTATS: join(r, 'resultats'), VERSION_INSTALLEE: '1.2.3', ...env },
});

test('la sortie de l’atelier ne porte pas le `_serveur/` du build (la comparaison, avant, l’a vu) ; les pages y sont', { skip }, (t) => {
  const r = monde(t);
  const p = lancer(r);
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert.ok(existsSync(join(r, 'sortie', 'site', 'index.html')), 'les pages sont copiées vers la sortie');
  assert.equal(existsSync(join(r, 'sortie', 'site', '_serveur')), false, 'le service du kit n’est pas dans la sortie : poser-un-site.mjs le refuserait (84)');
  assert.equal(readFileSync(join(r, 'vu.txt'), 'utf8'), '_serveur vu', 'la comparaison avec le site livré a lieu avant le retrait');
});

test('la répétition de la bascule 2 (MODE_REPETITION=1) ne copie rien vers la sortie : le site reste dans le travail avec son `_serveur/`, jugé là où il est fait', { skip }, (t) => {
  const r = monde(t);
  const p = lancer(r, { MODE_REPETITION: '1' });
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert.equal(existsSync(join(r, 'sortie', 'site')), false);
  assert.ok(existsSync(join(r, 'travail', 'site', 'index.html')));
  assert.equal(readFileSync(join(r, 'resultats', 'pages.txt'), 'utf8').trim(), '1');
});
