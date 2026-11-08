// Pages du wiki fabriquées depuis la base : les fichiers `.md` de src/content/wiki/ ne sont plus dans git, `scripts/db-export-pages.mjs` les écrit à partir de data/rows
// (lancé avant dev, build et test). Ici : le format écrit est celui que lit le site (analyse YAML réelle), sans perte, et le script d'export se vérifie lui-même.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { emettrePage, lirePages } from '../src/lib/pages-db.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const client = fileURLToPath(new URL('../', import.meta.url));
const wiki = join(client, 'src', 'content', 'wiki');
const exporter = (args, env = process.env) => spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-export-pages.mjs'), ...args], { encoding: 'utf8', env });
const db = ouvrirBase({ sansExemples: false });
const pages = lirePages(db);
// toutes les pages de la base (1015 à l'import ; le site de dev, source des données qu'il modifie, peut en créer ou en supprimer)
const nbPages = db.prepare('SELECT count(*) AS n FROM page').get().n;

/** Ce que fait le site pour lire une page : l'en-tête YAML et le corps (voir content.config.ts : glob + schéma). */
function lire(texte) {
  const m = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(texte);
  assert.ok(m, 'en-tête ---');
  return { data: parse(m[1]), corps: m[2] };
}

const page = (extra = {}) => ({ id: 'magies/x', type: 'magies', slug: 'x', titre: 'Magie "X"', resume: 'Un « résumé ».', donnees: null, corps_md: 'Texte.\n', statut: 'draft', origine: 'docs', aliases: [], tags: ['a', 'b'], sources: ['Source 1', 'https://exemple.org/x'], ...extra });

test('emettrePage : sous-ensemble YAML strict, ordre des clés, corps après une ligne vide', () => {
  assert.equal(
    emettrePage(page()),
    '---\ntitle: "Magie \\"X\\""\naliases: []\ntags: ["a", "b"]\nsummary: "Un « résumé »."\nsources: ["Source 1", "https://exemple.org/x"]\nstatus: draft\n---\n\nTexte.\n',
  );
  assert.ok(!emettrePage(page({ resume: null })).includes('summary:'), 'pas de résumé : pas de ligne summary');
});

test('emettrePage : champs structurés (chaîne, liste, entier) ; ceux des pages de magies avant le résumé, comme les importeurs', () => {
  const donnees = { nom_court: 'Sang', resiste_a: ['Feu', 'Terre'], niveau: 20 };
  const autre = emettrePage(page({ donnees })).split('\n');
  assert.deepEqual(autre.slice(4, 8), ['summary: "Un « résumé »."', 'nom_court: "Sang"', 'resiste_a: ["Feu", "Terre"]', 'niveau: 20']);
  const magie = emettrePage(page({ donnees, origine: 'magies' })).split('\n');
  assert.deepEqual(magie.slice(4, 8), ['nom_court: "Sang"', 'resiste_a: ["Feu", "Terre"]', 'niveau: 20', 'summary: "Un « résumé »."']);
});

test('aller-retour sans perte pour toutes les pages : l’analyse YAML du site redonne exactement les champs de la base', () => {
  assert.equal(pages.length, nbPages);
  for (const p of pages) {
    const { data, corps } = lire(emettrePage(p));
    assert.equal(data.title, p.titre, p.id);
    assert.deepEqual(data.aliases, p.aliases, p.id);
    assert.deepEqual(data.tags, p.tags, p.id);
    assert.equal(data.summary ?? null, p.resume, p.id);
    assert.deepEqual(data.sources, p.sources, p.id);
    assert.equal(data.status, p.statut, p.id);
    const { title, aliases, tags, summary, sources, status, ...extras } = data;
    assert.deepEqual(extras, p.donnees ?? {}, `${p.id} : champs structurés`);
    assert.equal(corps, p.corps_md, `${p.id} : corps conservé octet pour octet`);
  }
});

test('db-export-pages : fabrique un fichier par page, --verifier dit ce qui diffère, ne touche ni data/rows ni le dépôt', () => {
  const dir = dossierTemporaire('pages-db');
  const sortie = join(dir, 'wiki');
  const ecrit = exporter(['--out', sortie]);
  assert.equal(ecrit.status, 0, ecrit.stderr);
  assert.match(ecrit.stdout, new RegExp(`\\b${nbPages} pages écrites`));
  const fichiers = readdirSync(sortie).flatMap((t) => readdirSync(join(sortie, t)).map((f) => `${t}/${f}`));
  assert.equal(fichiers.length, nbPages);
  assert.ok(existsSync(join(sortie, 'cartes')), 'chaque type de page a son dossier, même sans page');

  const ok = exporter(['--verifier', sortie]);
  assert.equal(ok.status, 0, ok.stdout);
  writeFileSync(join(sortie, 'magies', 'magie-de-la-terre.md'), 'modifié\n');
  rmSync(join(sortie, 'races', readdirSync(join(sortie, 'races'))[0]));
  writeFileSync(join(sortie, 'races', 'en-trop.md'), '---\n---\n');
  const ko = exporter(['--verifier', sortie]);
  assert.equal(ko.status, 1);
  const { ecarts, exemples } = JSON.parse(ko.stdout);
  assert.equal(ecarts, 3);
  assert.ok(exemples.includes('différent : magies/magie-de-la-terre.md'));
  assert.ok(exemples.includes('en trop : races/en-trop.md'));
  assert.ok(exemples.some((e) => e.startsWith('manquant : races/')));
  rmSync(dir, { recursive: true, force: true });
});

test('db-export-pages : la base temporaire est supprimée quelle que soit la sortie (écriture, --verifier propre, --verifier avec écarts)', () => {
  // un dossier temporaire propre au test (TMPDIR de l'export) : les autres suites, lancées en parallèle, écrivent dans le dossier temporaire commun
  const dir = dossierTemporaire('pages-db');
  const temporaire = join(dir, 'tmp');
  mkdirSync(temporaire);
  const env = { ...process.env, ...variablesTemporaires(temporaire) };
  const restes = () => readdirSync(temporaire).filter((f) => f.startsWith('maverick-pages-'));
  try {
    const sortie = join(dir, 'wiki');
    assert.equal(exporter(['--out', sortie], env).status, 0);
    assert.equal(exporter(['--verifier', sortie], env).status, 0, 'verifier : aucun écart');
    assert.equal(exporter(['--verifier', join(dir, 'absent')], env).status, 1, 'verifier : tout manque');
    assert.deepEqual(restes(), [], 'aucun dossier maverick-pages-* laissé dans le dossier temporaire');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Migration 0113 (décision R232 (4)) : le libellé d'un homonyme est ambigu ; le `tags:` écrit alors sa clé, que tools/db/maverick.py#trouver_mot_cle (db:sync-pages)
// cherche d'abord : l'aller-retour repose chaque étiquette sur son mot-clé. Un vocabulaire d'essai (libellés et clés de la règle, pas ceux de la base).
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
test('tags : le libellé d’un mot-clé, la clé d’un homonyme ; db:sync-pages (maverick.py#trouver_mot_cle) relit chacun sur son mot-clé', { skip: sansPython }, (t) => {
  const fichier = join(dossierTemporaire('tags-homonymes', { t }), 'essai.db');
  const base = new DatabaseSync(fichier);
  base.exec(`
    CREATE TABLE mot_cle (id INTEGER PRIMARY KEY, libelle TEXT NOT NULL, cle TEXT NOT NULL UNIQUE);
    CREATE TABLE page (id TEXT PRIMARY KEY, type TEXT, slug TEXT, titre TEXT, resume TEXT, donnees TEXT, corps_md TEXT, statut TEXT, origine TEXT);
    CREATE TABLE page_tag (page_id TEXT, ordre INTEGER, tag_id INTEGER, PRIMARY KEY (page_id, ordre));
    CREATE TABLE alias (page_id TEXT, ordre INTEGER, texte TEXT);
    CREATE TABLE source (id TEXT PRIMARY KEY, texte TEXT);
    CREATE TABLE page_source (page_id TEXT, ordre INTEGER, source_id TEXT);
    INSERT INTO mot_cle VALUES (1, 'Essai zq', 'essai-zq-race'), (2, 'Essai zq', 'essai-zq-classe'), (3, 'Autre zq', 'autre-zq');
    INSERT INTO page VALUES ('lore/essai', 'lore', 'essai', 'Essai', NULL, NULL, 'x', 'canon', 'docs');
    INSERT INTO page_tag VALUES ('lore/essai', 0, 2), ('lore/essai', 1, 3), ('lore/essai', 2, 1);
  `);
  const [page] = lirePages(base);
  base.close();
  assert.deepEqual(page.tags, ['essai-zq-classe', 'Autre zq', 'essai-zq-race'], 'la clé des homonymes, le libellé sinon');
  const p = spawnSync('python3', ['-I', '-c', `
import json, sqlite3, sys
sys.path.insert(0, ${JSON.stringify(join(client, '..', 'tools', 'db'))})
import maverick as T
db = sqlite3.connect(${JSON.stringify(fichier)})
print(json.dumps([T.trouver_mot_cle(db, e) for e in ${JSON.stringify(page.tags)}] + [T.trouver_mot_cle(db, 'Essai zq')]))`], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  assert.deepEqual(JSON.parse(p.stdout), [[2, []], [3, []], [1, []], [null, ['essai-zq-race', 'essai-zq-classe']]], 'chacun relu sur son mot-clé ; le libellé seul serait ambigu');
});
