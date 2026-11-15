// Les contrôles du contenu (client/serveur/controles-du-contenu.mjs) : ceux de `npm run db:check` (client/scripts/db-check.mjs, qui n'est plus que la ligne de
// commande) ET ceux que le service lance sur la copie où il essaie un lot de changements (serveur/edition-lots.mjs). Un seul code : le même verdict des deux
// côtés, et les trois fonctions que db-lib.mjs partage avec db-build et db-derive (le service ne lit pas `scripts/`) ne s'écartent pas de leur copie.
//   node --test test/controles-du-contenu.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { controleCles, controleNomCle, controlerLeContenu, proprietaires } from '../serveur/controles-du-contenu.mjs';
import * as dbLib from '../scripts/db-lib.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';

test('les fonctions de clés que db-lib et le service partagent s’écrivent à l’identique', () => {
  for (const [nom, f] of Object.entries({ proprietaires, controleCles, controleNomCle })) assert.equal(String(dbLib[nom]), String(f), nom);
});

test('le service et la ligne de commande rendent le même verdict sur la même base : mêmes problèmes, mêmes comptes', () => {
  const chemin = cheminDImport();
  const db = new DatabaseSync(chemin, { readOnly: true });
  db.exec('PRAGMA foreign_keys = ON');
  const { problemes, bilan } = controlerLeContenu(db);
  db.close();
  const r = spawnSync(process.execPath, ['--no-warnings', 'scripts/db-check.mjs', chemin], { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const ligne = JSON.parse(r.stdout);
  assert.equal(ligne.nbProblemes, problemes.length);
  assert.deepEqual(ligne.problemes, problemes.slice(0, 40));
  assert.deepEqual(ligne.bilan, bilan);
  assert.equal(r.status, problemes.length ? 1 : 0);
});
