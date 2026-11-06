// Décision R183 (11), réponse du propriétaire à Q-J : « Les exclure de l'import ». La migration 0090 a converti le Lexique en mots-clés, dont Bouclier,
// Amélioration, Pièce élémentaire, Tour, Mode Hyper et Mode Super : les importeurs des classeurs écrivaient déjà ces étiquettes sur leurs pages (sans
// mot-clé pour les recevoir, un import n'en crée pas : migration 0056). Elles ne sont plus écrites (tools/db/homonymes.py#ETIQUETTES_NON_POSEES), pour
// que le prochain import ne les pose pas. Rejoue tools/sheets/equipement.py, tools/sheets/divers-craft.py et tools/sheets/annexes-magie.py sur les
// instantanés de sources/raw/classeurs/ et lit le `tags:` des pages écrites.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const classeurs = join(racine, 'sources/raw/classeurs');
const sansPython = spawnSync('python3', ['-I', '-c', 'pass']).status !== 0 && 'python3 absent';

const IMPORTEURS = [
  ['tools/sheets/equipement.py', ['ressources-et-craft.json']],
  ['tools/sheets/divers-craft.py', ['ressources-et-craft.json']],
  ['tools/sheets/annexes-magie.py', ['magie-maverick-v8.json', 'mode-hyper-et-co.json']],
];

const EXCLUES = ['bouclier', 'pièce élémentaire', 'amélioration', 'tour', 'mode hyper', 'mode super'];

/** { 'ressources/bouclier': ['matériaux', …] } : le `tags:` de chaque page écrite sous `dossier`. */
function etiquettes(dossier) {
  const sortie = {};
  for (const famille of readdirSync(dossier)) {
    for (const fichier of readdirSync(join(dossier, famille)).filter((f) => f.endsWith('.md'))) {
      const ligne = /^tags: (.*)$/m.exec(readFileSync(join(dossier, famille, fichier), 'utf8'));
      sortie[`${famille}/${fichier.slice(0, -3)}`] = JSON.parse(ligne[1]);
    }
  }
  return sortie;
}

function importer(t) {
  const out = dossierTemporaire('importeurs-etiquettes-', { t });
  for (const [script, dumps] of IMPORTEURS) {
    const r = spawnSync('python3', ['-I', join(racine, script), ...dumps.flatMap((d) => ['--dump', join(classeurs, d)]), '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${script} : ${r.stderr || r.stdout}`);
  }
  return etiquettes(out);
}

test('R183 (11) : la liste commune des étiquettes non posées est celle des six mots-clés de la 0090 que nomme la décision', { skip: sansPython }, () => {
  const r = spawnSync('python3', ['-I', '-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location('homonymes', ${JSON.stringify(join(racine, 'tools/db/homonymes.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps(sorted(m.ETIQUETTES_NON_POSEES)))`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [...EXCLUES].sort());
  assert.deepEqual(EXCLUES.map(normalize).sort(), ['amelioration', 'bouclier', 'mode-hyper', 'mode-super', 'piece-elementaire', 'tour']);
});

test('R183 (11) : les importeurs des classeurs n’écrivent plus Bouclier, Amélioration, Pièce élémentaire, Tour, Mode Hyper ni Mode Super, et gardent leurs autres étiquettes', { skip: sansPython }, (t) => {
  const tags = importer(t);
  const exclues = new Set(EXCLUES.map(normalize));
  const ecrites = Object.entries(tags).flatMap(([page, liste]) => liste.filter((e) => exclues.has(normalize(e))).map((e) => `${page} : ${e}`));
  assert.deepEqual(ecrites, []);
  // les pages qui les portaient : le reste de leur `tags:` est intact, dans son ordre
  assert.deepEqual(tags['ressources/bouclier'], ['matériaux', 'fabrication']);
  assert.deepEqual(tags['ressources/pieces-elementaires'], ['armes', 'armures']);
  assert.deepEqual(tags['ressources/fiche-de-tour'], []);
  assert.equal(tags['guide/mode-hyper-magie'], undefined, 'page supprimée, plus produite par annexes-magie.py (décision R184 (9))');
  assert.deepEqual(tags['guide/liste-des-effets-mode-hyper'], []);
  assert.deepEqual(tags['guide/liste-des-effets-mode-super'], []);
});
