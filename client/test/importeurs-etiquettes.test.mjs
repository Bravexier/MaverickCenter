// Décision R183 (11), réponse du propriétaire à Q-J : « Les exclure de l'import ». La migration 0090 a converti le Lexique en mots-clés, dont Bouclier,
// Amélioration, Pièce élémentaire, Tour, Mode Hyper et Mode Super : les importeurs des classeurs écrivaient déjà ces étiquettes sur leurs pages (sans
// mot-clé pour les recevoir, un import n'en crée pas : migration 0056). Elles ne sont plus écrites (tools/db/homonymes.py#ETIQUETTES_NON_POSEES), pour
// que le prochain import ne les pose pas. Rejoue tools/sheets/equipement.py, tools/sheets/divers-craft.py et tools/sheets/annexes-magie.py sur les
// instantanés de sources/raw/classeurs/ et lit le `tags:` des pages écrites.
// R309 (ancrage des mots-clés, docs/chantier-ancrage-mots-cles.md §11) : six étiquettes de plus (« invocation », « chasseur », « gladiateur », « maison »,
// « construction », « malédiction »), car l'ancrage crée un mot-clé de chacune ; le prochain import en poserait 83. Les importeurs des invocations et des
// classes sont rejoués aussi. Le filtre reste dans les importeurs, jamais dans `mots_cles_poses` : une étiquette posée à la main sur le site doit
// survivre à l'aller-retour des pages (le test de `pages-db` le garde).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierDesExports } from '../../tools/sources/dossier-des-exports.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const classeurs = join(dossierDesExports(racine), 'classeurs'); // sources/raw, ou MAVERICK_SOURCES_RAW (archive restaurée, R296)
const sansPython = spawnSync('python3', ['-I', '-c', 'pass']).status !== 0 && 'python3 absent';

// [script, dumps, options en plus] : les classes se rejouent sans le classeur .xlsx (`--sans-liens`), comme sur un poste qui n'a que les dumps
const IMPORTEURS = [
  ['tools/sheets/equipement.py', ['ressources-et-craft.json'], []],
  ['tools/sheets/divers-craft.py', ['ressources-et-craft.json'], []],
  ['tools/sheets/annexes-magie.py', ['magie-maverick-v8.json', 'mode-hyper-et-co.json'], []],
  ['tools/sheets/invocations.py', ['invocation.json'], []],
  ['tools/sheets/classes.py', ['classe-maverick-v7.json'], ['--sans-liens']],
];

const EXCLUES = ['bouclier', 'pièce élémentaire', 'amélioration', 'tour', 'mode hyper', 'mode super', 'invocation', 'chasseur', 'gladiateur', 'maison', 'construction', 'malédiction'];

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
  for (const [script, dumps, options] of IMPORTEURS) {
    const r = spawnSync('python3', ['-I', join(racine, script), ...dumps.flatMap((d) => ['--dump', join(classeurs, d)]), ...options, '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${script} : ${r.stderr || r.stdout}`);
  }
  return etiquettes(out);
}

test('R183 (11) : la liste commune des étiquettes non posées est celle des six mots-clés de la 0090 que nomme la décision et des six que l’ancrage ajoute (R309)', { skip: sansPython }, () => {
  const r = spawnSync('python3', ['-X', 'utf8', '-I', '-c', `
import importlib.util, json
spec = importlib.util.spec_from_file_location('homonymes', ${JSON.stringify(join(racine, 'tools/db/homonymes.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps(sorted(m.ETIQUETTES_NON_POSEES)))`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [...EXCLUES].sort());
  assert.deepEqual(EXCLUES.map(normalize).sort(), ['amelioration', 'bouclier', 'chasseur', 'construction', 'gladiateur', 'invocation', 'maison', 'malediction', 'mode-hyper', 'mode-super', 'piece-elementaire', 'tour']);
});

test('R183 (11), R309 : les importeurs des classeurs n’écrivent plus Bouclier, Amélioration, Pièce élémentaire, Tour, Mode Hyper, Mode Super, Invocation, Chasseur, Gladiateur, Maison, Construction ni Malédiction, et gardent leurs autres étiquettes', { skip: sansPython }, (t) => {
  const tags = importer(t);
  const exclues = new Set(EXCLUES.map(normalize));
  const ecrites = Object.entries(tags).flatMap(([page, liste]) => liste.filter((e) => exclues.has(normalize(e))).map((e) => `${page} : ${e}`));
  assert.deepEqual(ecrites, []);
  // les pages qui les portaient : le reste de leur `tags:` est intact, dans son ordre
  assert.deepEqual(tags['ressources/bouclier'], ['matériaux', 'fabrication']);
  assert.deepEqual(tags['ressources/pieces-elementaires'], ['armes', 'armures']);
  assert.deepEqual(tags['ressources/fiche-de-tour'], []);
  assert.equal(tags['guide/mode-hyper-magie'], undefined, 'page supprimée, plus produite par annexes-magie.py (décision R184 (9))');
  assert.equal(tags['guide/liste-des-effets-mode-hyper'], undefined, 'page supprimée, plus produite par annexes-magie.py (décision R187) : « mode hyper » n’y est plus écrite nulle part');
  assert.deepEqual(tags['guide/liste-des-effets-mode-super'], []);
  // R309 : le reste du `tags:` des invocations (le mot du bandeau de l'onglet, puis les magies) et des capacités de l'Olwman et du Minotaure est intact
  const creatures = Object.entries(tags).filter(([page]) => page.startsWith('bestiaire/'));
  assert.ok(creatures.length > 60, 'les créatures invoquées sont écrites');
  assert.ok(creatures.every(([, liste]) => liste.length > 0), 'chaque créature garde le mot de son onglet, « invocation » en moins');
  assert.ok(creatures.some(([, liste]) => liste[0] === 'golem'), 'le mot du bandeau (« golem ») passe en premier');
  const deLaClasse = (classe) => Object.entries(tags).filter(([page, liste]) => page.startsWith('capacites/') && liste.includes(classe));
  for (const [classe, gardee] of [['olwman', 'pape'], ['minotaure', 'médium']]) {
    assert.ok(deLaClasse(classe).some(([, liste]) => liste.includes(gardee)), `${classe} : la spécialité « ${gardee} » reste écrite`);
  }
});

// R309 : le filtre est dans les importeurs. `mots_cles_poses` (db:sync-pages) pose toujours ces écritures quand le site de dev les porte sur une page : une
// étiquette posée à la main sur le site doit survivre à l'aller-retour des pages. Mots-clés d'essai : des ids loin de la base, les libellés de la liste.
test('R309 : mots_cles_poses ne filtre rien : une étiquette qu’un import n’écrit pas, posée à la main, reste posée à la relecture des pages', { skip: sansPython }, () => {
  const p = spawnSync('python3', ['-I', '-c', `
import json, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(join(racine, 'tools/db'))})
import maverick as T
db = sqlite3.connect(':memory:')
db.executescript("""
CREATE TABLE mot_cle (id INTEGER PRIMARY KEY, libelle TEXT, cle TEXT UNIQUE);
CREATE TABLE mot_cle_ancienne_cle (cle TEXT PRIMARY KEY, mot_cle_id INTEGER);
CREATE TABLE historique_modification (lot_id TEXT, rang INTEGER, fait_le TEXT, table_nom TEXT, cle TEXT, operation TEXT, avant TEXT, apres TEXT);
""")
ecritures = ${JSON.stringify(EXCLUES)}
db.executemany('INSERT INTO mot_cle VALUES (?, ?, ?)', [(9000 + i, e, e) for i, e in enumerate(ecritures)])
poses, inconnues, ambigues = T.mots_cles_poses(db, ecritures)
print(json.dumps({'poses': [i for _, i in poses], 'inconnues': inconnues, 'ambigues': ambigues}))`], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const r = JSON.parse(p.stdout);
  assert.deepEqual(r.poses, EXCLUES.map((_, i) => 9000 + i), 'chacune des douze est posée sur son mot-clé');
  assert.deepEqual(r.inconnues, []);
  assert.deepEqual(r.ambigues, []);
});
