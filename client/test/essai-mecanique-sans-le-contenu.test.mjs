// Passe S de l'essai mécanique (lot 12, R296 ; scripts/essai-mecanique-tests.mjs, docs/essai-mecanique-des-tests.md) : le dépôt SANS ce qui en sortira (les lignes des
// tables, les migrations de données et leurs registres, les exports des sources ; les migrations mixtes en option), l'extrait du site de dev pour contenu, aucune
// rubrique « par nature ». Ces tests éprouvent la construction de la copie et le tri sur un arbre git jetable, sans lancer la suite.
//   node --test test/essai-mecanique-sans-le-contenu.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  archiverLesExports, CONTROLE_RETIRE_EN_S, controlesDeLaPasse, environnementDeLaPasse, LIT_LE_DEPOT_PAR_NATURE, PASSE_SANS_LE_CONTENU, PASSES_DU_SITE,
  retirerLeContenuDeLaCopie, trierLaPasseSansLeContenu, trierLesControlesDUnePasse,
} from '../scripts/essai-mecanique-tests.mjs';
import { cheminsQuiSortent, listerCeQuiSort } from '../scripts/inventaire-sortie-du-contenu-lib.mjs';
import { dossierDesExports } from '../../tools/sources/dossier-des-exports.mjs';
import { contenuSorti, mixtesSorties, VARIABLE_CONTENU_SORTI, VARIABLE_MIXTES_SORTIES } from '../src/lib/sortie-du-contenu.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE_DU_DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STRUCTURE = 'CREATE TABLE t (id INTEGER PRIMARY KEY) STRICT;\n';
const DONNEES = 'UPDATE t SET id = id + 1 WHERE id = 1;\n';
const MIXTE = 'CREATE TABLE u (id INTEGER PRIMARY KEY) STRICT;\nINSERT INTO u (id) VALUES (3);\n';

const ARBRE = {
  'data/rows/une_table.sql': 'INSERT INTO une_table VALUES (1);\n',
  'data/rows/VERSION': '1\n',
  'data/migrations/0001-structure.sql': STRUCTURE,
  'data/migrations/0001-structure.json': '{}\n',
  'data/migrations/0002-donnees.sql': DONNEES,
  'data/migrations/0002-donnees.json': '{"textes": []}\n',
  'data/migrations/0003-mixte.sql': MIXTE,
  'data/migrations/0003-mixte.json': '{}\n',
  'sources/raw/doc.md': '# un export\n',
  'sources/raw/classeurs/feuille.json': '{}\n',
  'sources/sources.json': '{}\n',
  'sources/tipeee/bienvenue.json': '{}\n',
  'client/src/lib/code.mjs': 'export const x = 1;\n',
  'data/schema.sql': 'CREATE TABLE t (id INTEGER);\n',
};
const SORTENT = ['data/rows/une_table.sql', 'data/rows/VERSION', 'data/migrations/0002-donnees.sql', 'data/migrations/0002-donnees.json', 'sources/raw/doc.md', 'sources/raw/classeurs/feuille.json'];
const MIXTES = ['data/migrations/0003-mixte.sql', 'data/migrations/0003-mixte.json'];

function ecrire(dossier, fichiers) {
  for (const [chemin, texte] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(dossier, chemin)), { recursive: true });
    writeFileSync(join(dossier, chemin), texte);
  }
}

/** Un dépôt git jetable (l'arbre d'origine) et sa copie (les mêmes fichiers, sans .git), comme la copie jetable d'une passe. */
function arbreEtCopie(t) {
  const racine = dossierTemporaire('passe-s-racine', { t });
  const copie = dossierTemporaire('passe-s-copie', { t });
  execFileSync('git', ['-C', racine, 'init', '-q']);
  ecrire(racine, ARBRE);
  execFileSync('git', ['-C', racine, 'add', '-A']);
  ecrire(copie, ARBRE);
  return { racine, copie };
}

describe('passe S : la copie sans le contenu qui sort', () => {
  it('retire les lignes, les migrations de données et leurs registres, les exports des sources, et les dossiers que cela vide', (t) => {
    const { racine, copie } = arbreEtCopie(t);
    const bilan = retirerLeContenuDeLaCopie({ racine, copie });
    for (const c of SORTENT) assert.equal(existsSync(join(copie, c)), false, `${c} sort`);
    assert.equal(bilan.retires, SORTENT.length);
    assert.equal(bilan.octets, SORTENT.reduce((s, c) => s + Buffer.byteLength(ARBRE[c]), 0));
    assert.equal(bilan.absents, 0);
    for (const d of ['data/rows', 'sources/raw/classeurs', 'sources/raw']) assert.equal(existsSync(join(copie, d)), false, `${d} : dossier vidé, retiré`);
  });

  it('laisse ce qui reste : structure, migrations mixtes (sans l\'option), manifeste, instantané, schéma, code', (t) => {
    const { racine, copie } = arbreEtCopie(t);
    retirerLeContenuDeLaCopie({ racine, copie });
    for (const c of Object.keys(ARBRE).filter((x) => !SORTENT.includes(x))) assert.equal(readFileSync(join(copie, c), 'utf8'), ARBRE[c], `${c} reste`);
    assert.ok(existsSync(join(copie, 'data/migrations')), 'le dossier des migrations reste : la structure y est');
  });

  it('--avec-mixtes retire aussi les migrations qui mêlent DDL et données, avec leurs registres, et pas les migrations de structure', (t) => {
    const { racine, copie } = arbreEtCopie(t);
    const bilan = retirerLeContenuDeLaCopie({ racine, copie, avecMixtes: true });
    for (const c of [...SORTENT, ...MIXTES]) assert.equal(existsSync(join(copie, c)), false, `${c} sort`);
    assert.equal(bilan.retires, SORTENT.length + MIXTES.length);
    for (const c of ['data/migrations/0001-structure.sql', 'data/migrations/0001-structure.json']) assert.ok(existsSync(join(copie, c)), `${c} reste`);
  });

  it('ne touche jamais l\'arbre d\'origine, et refuse de travailler dedans', (t) => {
    const { racine, copie } = arbreEtCopie(t);
    retirerLeContenuDeLaCopie({ racine, copie, avecMixtes: true });
    for (const c of Object.keys(ARBRE)) assert.equal(readFileSync(join(racine, c), 'utf8'), ARBRE[c], `${c} intact dans l'origine`);
    assert.throws(() => retirerLeContenuDeLaCopie({ racine, copie: racine }), /arbre d'origine/);
    assert.ok(existsSync(join(racine, 'data/rows/VERSION')));
  });

  it('un fichier listé mais absent de la copie est compté, pas une erreur ; un fichier de la copie hors liste n\'est pas retiré', (t) => {
    const { racine, copie } = arbreEtCopie(t);
    execFileSync('rm', [join(copie, 'data/rows/VERSION')]);
    ecrire(copie, { 'data/rows/nouveau-hors-liste.sql': 'x\n' });
    const bilan = retirerLeContenuDeLaCopie({ racine, copie });
    assert.equal(bilan.absents, 1);
    assert.equal(bilan.retires, SORTENT.length - 1);
    assert.ok(existsSync(join(copie, 'data/rows/nouveau-hors-liste.sql')), 'seule la liste de l\'inventaire sort : la passe le laisse voir');
  });

  it('les catégories sont celles de l\'inventaire : les mixtes à part, retirées seulement sur demande', (t) => {
    const { racine } = arbreEtCopie(t);
    const liste = listerCeQuiSort({ racine });
    assert.deepEqual(cheminsQuiSortent(liste), [...SORTENT].sort());
    assert.deepEqual(cheminsQuiSortent(liste, { avecMixtes: true }), [...SORTENT, ...MIXTES].sort());
    assert.deepEqual(liste.migrations_mixtes.map((f) => f.chemin).sort(), [...MIXTES].sort());
  });

  it('sur ce dépôt : ce qui sort tient dans les trois chemins de R296, jamais ailleurs', () => {
    const liste = listerCeQuiSort({ racine: RACINE_DU_DEPOT });
    for (const c of cheminsQuiSortent(liste, { avecMixtes: true })) assert.match(c, /^(data\/rows\/|data\/migrations\/|sources\/raw\/)/, c);
  });
});

describe('passe S : allumée (contenu sorti) et exports archivés', () => {
  it('S pose MAVERICK_CONTENU_SORTI=1 et MAVERICK_SOURCES_RAW ; contenuSorti() et dossierDesExports() la suivent', () => {
    const horsDeLaCopie = resolve('/hors/de/la/copie/sources/raw');
    const env = environnementDeLaPasse(PASSE_SANS_LE_CONTENU, { exports: horsDeLaCopie, base: { PATH: 'x', NODE_TEST_CONTEXT: 'child' } });
    assert.equal(env[VARIABLE_CONTENU_SORTI], '1');
    assert.equal(contenuSorti(env), true);
    assert.equal(env.MAVERICK_SOURCES_RAW, horsDeLaCopie);
    assert.equal(dossierDesExports('/racine', env), horsDeLaCopie);
    assert.ok(env.MAVERICK_CONTENU, 'le contenu de la passe reste posé');
    assert.equal(env.NODE_TEST_CONTEXT, undefined, 'la passe n\'hérite pas du contexte de node --test');
    assert.equal(env.PATH, 'x');
    assert.equal(mixtesSorties(env), false, 'sans --avec-mixtes, les migrations mixtes restent');
  });

  it('S avec --avec-mixtes pose aussi MAVERICK_MIXTES_SORTIES=1 (partout où S pose MAVERICK_CONTENU_SORTI) ; mixtesSorties() la suit', () => {
    const env = environnementDeLaPasse(PASSE_SANS_LE_CONTENU, { avecMixtes: true, base: { PATH: 'x' } });
    assert.equal(env[VARIABLE_CONTENU_SORTI], '1');
    assert.equal(env[VARIABLE_MIXTES_SORTIES], '1');
    assert.equal(mixtesSorties(env), true);
    assert.equal(mixtesSorties(environnementDeLaPasse(PASSE_SANS_LE_CONTENU, { avecMixtes: false, base: { [VARIABLE_MIXTES_SORTIES]: '1' } })), false, 'reçue sans --avec-mixtes : retirée');
  });

  it('les autres passes ne sont jamais allumées, même si l\'environnement reçu l\'est ; S sans archive ne pose pas MAVERICK_SOURCES_RAW', () => {
    const base = { [VARIABLE_CONTENU_SORTI]: '1', [VARIABLE_MIXTES_SORTIES]: '1', MAVERICK_SOURCES_RAW: '/ailleurs' };
    for (const passe of ['A', 'B', 'D', ...PASSES_DU_SITE]) {
      const env = environnementDeLaPasse(passe, { base, avecMixtes: true });
      assert.equal(contenuSorti(env), false, passe);
      assert.equal(mixtesSorties(env), false, passe);
      assert.equal(env.MAVERICK_SOURCES_RAW, undefined, passe);
    }
    assert.equal(environnementDeLaPasse(PASSE_SANS_LE_CONTENU, { base }).MAVERICK_SOURCES_RAW, undefined);
  });

  it('archiverLesExports extrait sources/raw de HEAD (pas de l\'arbre de travail, rien d\'autre) hors du dépôt, et ne touche pas le dépôt', (t) => {
    const depot = dossierTemporaire('passe-s-depot', { t });
    const destination = dossierTemporaire('passe-s-exports', { t });
    execFileSync('git', ['-C', depot, 'init', '-q']);
    execFileSync('git', ['-C', depot, 'config', 'core.autocrlf', 'false']); // l'archive garde les octets du commit sur un poste Windows
    ecrire(depot, { 'sources/raw/doc.md': 'valide\n', 'sources/raw/classeurs/feuille.json': '{}\n', 'sources/sources.json': '{}\n' });
    execFileSync('git', ['-C', depot, '-c', 'user.name=essai', '-c', 'user.email=essai@example.invalid', 'add', '-A']);
    execFileSync('git', ['-C', depot, '-c', 'user.name=essai', '-c', 'user.email=essai@example.invalid', 'commit', '-q', '-m', 'essai']);
    writeFileSync(join(depot, 'sources/raw/doc.md'), 'modifié, non validé\n');
    const exports = archiverLesExports({ racine: depot, destination: join(destination, 'exports') });
    assert.equal(exports, join(destination, 'exports', 'sources', 'raw'));
    assert.equal(readFileSync(join(exports, 'doc.md'), 'utf8'), 'valide\n');
    assert.equal(readFileSync(join(exports, 'classeurs/feuille.json'), 'utf8'), '{}\n');
    assert.equal(existsSync(join(destination, 'exports', 'sources', 'sources.json')), false, 'seul sources/raw est archivé');
    assert.equal(readFileSync(join(depot, 'sources/raw/doc.md'), 'utf8'), 'modifié, non validé\n');
    assert.equal(dossierDesExports(depot, { MAVERICK_SOURCES_RAW: exports }), exports);
  });
});

describe('passe S : les contrôles et le tri', () => {
  const CONTROLES = ['npm run db:build', 'npm run db:check', 'npm test', 'npm run build', 'node --test test/a-html.test.mjs test/b-html.test.mjs'];

  it('sans le contenu : db:build (il lit data/rows) n\'est pas lancé, db:check l\'est et son échec compte comme les autres', () => {
    const s = controlesDeLaPasse(CONTROLES, { sansLeContenu: true });
    assert.equal(CONTROLE_RETIRE_EN_S, 'npm run db:build');
    assert.equal(s.some((c) => c.commande === 'npm run db:build'), false);
    const check = s.find((c) => c.commande === 'npm run db:check');
    assert.ok(check, 'db:check reste');
    assert.equal(check.par_nature, undefined, 'plus de « par nature »');
    assert.deepEqual(s.filter((c) => c.test).map((c) => c.test), ['a-html.test.mjs', 'b-html.test.mjs']);
    const t = trierLesControlesDUnePasse(PASSE_SANS_LE_CONTENU, s.map((c) => ({ ...c, code: c.commande === 'npm run db:check' ? 1 : 0, compteurs: c.test ? { pass: 1, skipped: 0 } : undefined })));
    assert.deepEqual(t.rouges, ['npm run db:check']);
    assert.deepEqual(t.par_nature, []);
  });

  it('les autres passes gardent db:build et db:check « par nature » (inchangé)', () => {
    const c = controlesDeLaPasse(CONTROLES);
    for (const commande of ['npm run db:build', 'npm run db:check']) assert.ok(c.find((x) => x.commande === commande)?.par_nature, commande);
  });

  it('tout échec est rouge, listé par fichier avec sa cause, même un fichier classé « par nature » ailleurs', () => {
    const classe = Object.keys(LIT_LE_DEPOT_PAR_NATURE)[0];
    const resultats = new Map([
      ['a.test.mjs', { fichier: 'a.test.mjs', code: 0 }],
      [classe, { fichier: classe, code: 1 }],
      ['lent.test.mjs', { fichier: 'lent.test.mjs', code: 'delai' }],
    ]);
    const journaux = { [classe]: 'TAP\nnot ok 1 - lit data/rows\n  error: ENOENT: no such file or directory, open \'data/rows/VERSION\'\n' };
    const r = trierLaPasseSansLeContenu(resultats, (passe, fichier) => { assert.equal(passe, PASSE_SANS_LE_CONTENU); return journaux[fichier] ?? ''; });
    assert.deepEqual(r.passes.rouges.map((x) => x.fichier), ['lent.test.mjs', classe].sort());
    assert.equal(r.passes.mesures, 3);
    assert.equal(r.passes.passent, 1);
    assert.equal(r.passes.rouges.find((x) => x.fichier === 'lent.test.mjs').cause, 'délai dépassé');
    assert.ok(r.passes.rouges.find((x) => x.fichier === classe).cause.length > 0, 'la cause est le premier message du journal');
    assert.equal('par_nature' in r.passes, false, 'aucune rubrique « par nature » en S');
    assert.match(r.md.join('\n'), /2 rouge/);
    assert.match(r.md.join('\n'), /\| lent\.test\.mjs \|/);
  });

  it('verte quand tous passent ; sans résultat, rien à trier', () => {
    const r = trierLaPasseSansLeContenu(new Map([['a.test.mjs', { fichier: 'a.test.mjs', code: 0 }]]));
    assert.deepEqual(r.passes.rouges, []);
    assert.equal(r.passes.passent, 1);
    assert.equal(trierLaPasseSansLeContenu(null), null);
  });
});
