// La base de référence de la page « Mise à jour » (scripts/db-reference.mjs) ne lève jamais : sans git (l'image node:22-bookworm-slim du conteneur de l'atelier n'en a pas),
// elle rend « absente, avec sa raison », et le crochet Astro n'en fait pas échouer le build quand le contenu est fourni.
//   node --test test/db-reference-sans-git.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const MODULE = pathToFileURL(fileURLToPath(new URL('../scripts/db-reference.mjs', import.meta.url))).href;

/** Un processus Node à l'environnement réduit : un PATH sans aucun programme (donc sans git ni tar), le contenu fourni ou non. */
function dansUnProcessus(t, code, env = {}) {
  const dossier = dossierTemporaire('reference-sans-git', { t });
  const vide = join(dossier, 'bin');
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', code], {
    encoding: 'utf8', env: { PATH: vide, HOME: dossier, TMPDIR: dossier, ...env },
  });
  assert.equal(r.status, 0, `le processus ne doit pas échouer : ${r.stderr}`);
  return { dossier, sortie: JSON.parse(r.stdout.trim().split('\n').at(-1)) };
}

test('sans git dans le PATH, construireReference rend chemin null et une raison, sans lever, et n’écrit rien', (t) => {
  const dossier = dossierTemporaire('reference-sortie', { t });
  const sortie = join(dossier, 'donnees', 'reference.db');
  const { sortie: r } = dansUnProcessus(t, `
    import { construireReference } from ${JSON.stringify(MODULE)};
    console.log(JSON.stringify(construireReference({ sortie: ${JSON.stringify(sortie)} })));`);
  assert.equal(r.chemin, null);
  assert.match(r.raison, /^git absent : /);
  assert.equal(existsSync(sortie), false);
});

test('le crochet de l’intégration, sans git et avec le contenu fourni, ne lève pas et l’annonce comme attendue (information) ; sans contenu fourni, il l’avertit', (t) => {
  const dossier = dossierTemporaire('reference-crochet', { t });
  writeFileSync(join(dossier, 'contenu.db'), '');
  const dir = pathToFileURL(`${join(dossier, 'dist')}/`).href;
  for (const fourni of [true, false]) {
    const { sortie } = dansUnProcessus(t, `
      import { integrationReference } from ${JSON.stringify(MODULE)};
      const messages = [];
      const logger = { info: (m) => messages.push(['info', m]), warn: (m) => messages.push(['warn', m]) };
      integrationReference().hooks['astro:build:done']({ dir: new URL(${JSON.stringify(dir)}), logger });
      console.log(JSON.stringify(messages));`, fourni ? { MAVERICK_CONTENU: join(dossier, 'contenu.db') } : {});
    assert.equal(sortie.length, 1, 'un seul message');
    assert.match(sortie[0][1], /git absent/);
    assert.equal(sortie[0][0], fourni ? 'info' : 'warn', 'information avec le contenu fourni (attendu), avertissement sans');
  }
});
