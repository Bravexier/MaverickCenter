// Pages du wiki fabriquées depuis la base : les fichiers `.md` de src/content/wiki/ ne sont plus dans git, `scripts/db-export-pages.mjs` les écrit à partir de data/rows
// (lancé avant dev, build et test). Ici : le format écrit est celui que lit le site (analyse YAML réelle), sans perte, et le script d'export se vérifie lui-même.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { emettrePage, lirePages } from '../src/lib/pages-db.mjs';

const client = fileURLToPath(new URL('../', import.meta.url));
const wiki = join(client, 'src', 'content', 'wiki');
const exporter = (args) => spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-export-pages.mjs'), ...args], { encoding: 'utf8' });
const pages = lirePages(ouvrirBase({ sansExemples: false }));

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

test('aller-retour sans perte pour les 991 pages : l’analyse YAML du site redonne exactement les champs de la base', () => {
  assert.equal(pages.length, 991);
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
  const dir = mkdtempSync(join(tmpdir(), 'pages-db-'));
  const sortie = join(dir, 'wiki');
  const ecrit = exporter(['--out', sortie]);
  assert.equal(ecrit.status, 0, ecrit.stderr);
  assert.match(ecrit.stdout, /991 pages écrites/);
  const fichiers = readdirSync(sortie).flatMap((t) => readdirSync(join(sortie, t)).map((f) => `${t}/${f}`));
  assert.equal(fichiers.length, 991);
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
