// Une page des Règles (guide/…) créée sur le site de dev (lot de l'édition des menus : « En mode Edition il faut prévoir aussi de pouvoir ajouter /
// supprimer une page », réponse « Pages des Règles ») n'a pas de source Google Doc : sa provenance est « Site de dev › édition du AAAA-MM-JJ ».
// tools/db/pages_md.py#FAMILLE_DES_PAGES_DU_SITE la rattache à la famille `docs` (pas de nouvelle famille : la provenance sera retirée à la 1.0) :
// le cycle des pages (db:sync-pages) l'ajoute, puis la retire, au lieu de la refuser. Les écritures se font dans des COPIES de data/rows et des
// pages fabriquées, jamais dans data/rows.
//   node --test test/db-pages-du-site.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const client = fileURLToPath(new URL('../', import.meta.url));
const rows = join(racine, 'data', 'rows');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const pages = (...args) => spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'pages_md.py'), ...args], { encoding: 'utf8' });

/** Une copie de data/rows et les pages fabriquées depuis elle (db:export-pages), dans un dossier supprimé à la fin du test `t`. */
function copies(t) {
  const dir = dossierTemporaire('pages-du-site', { t });
  const copieRows = join(dir, 'rows');
  const copieWiki = join(dir, 'wiki');
  cpSync(rows, copieRows, { recursive: true });
  const r = spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-export-pages.mjs'), '--out', copieWiki],
    { encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(dir) } });
  assert.equal(r.status, 0, r.stderr);
  return { copieRows, copieWiki, args: ['--rows', copieRows, '--wiki', copieWiki] };
}

// l'instruction INSERT de la page (son corps peut tenir sur plusieurs lignes) ; colonnes de page.sql : … statut, origine, source_ref
const ligneDePage = (copieRows, id) => readFileSync(join(copieRows, 'page.sql'), 'utf8').split(/\n(?=INSERT INTO )/).find((l) => l.includes(`VALUES ('${id}', `));
const enTete = (source) => `---\ntitle: "Page créée sur le site"\naliases: []\ntags: []\nsummary: "Un résumé."\nsources: ["${source}"]\nstatus: draft\n---\n\nÀ compléter.\n`;

test('db:sync-pages : une page guide/ de source « Site de dev › » entre en famille docs, puis se retire, data/rows revenu à l’identique', { skip: sansPython }, (t) => {
  const { copieRows, copieWiki, args } = copies(t);
  const nouvelle = join(copieWiki, 'guide', 'page-creee-sur-le-site.md');
  writeFileSync(nouvelle, enTete('Site de dev › édition du 2026-11-06'));

  const ajout = pages('sync', ...args);
  assert.equal(ajout.status, 0, ajout.stdout + ajout.stderr);
  assert.match(ajout.stdout, /1 page\(s\) mise\(s\) à jour/);
  const ligne = ligneDePage(copieRows, 'guide/page-creee-sur-le-site');
  assert.ok(ligne, 'la page est dans data/rows');
  assert.match(ligne, /, 'draft', 'docs', 'Site de dev › édition du 2026-11-06'\);\n?$/, 'statut, origine (famille docs), source_ref');
  assert.match(readFileSync(join(copieRows, 'source.sql'), 'utf8'), /'Site de dev › édition du 2026-11-06'/);
  assert.equal(pages('check', ...args).status, 0, 'à jour après la synchronisation');

  rmSync(nouvelle);
  const retrait = pages('sync', ...args);
  assert.equal(retrait.status, 0, retrait.stdout + retrait.stderr);
  const touches = readdirSync(rows).filter((f) => readFileSync(join(rows, f), 'utf8') !== readFileSync(join(copieRows, f), 'utf8'));
  assert.deepEqual(touches, [], 'ajout puis retrait : la page, sa source et son renvoi sont retirés');
});

test('db:sync-pages : une page guide/ sans source Google Doc ni « Site de dev › » reste refusée', { skip: sansPython }, (t) => {
  const { copieWiki, args } = copies(t);
  writeFileSync(join(copieWiki, 'guide', 'page-sans-provenance.md'), enTete('Une note quelconque'));
  const refus = pages('sync', ...args);
  assert.equal(refus.status, 1, refus.stdout + refus.stderr);
  assert.match(refus.stdout, /refusé : origine inconnue : guide\/page-sans-provenance/);
});
