// Une page des Règles (guide/…) créée sur le site de dev (lot de l'édition des menus : « En mode Edition il faut prévoir aussi de pouvoir ajouter /
// supprimer une page », réponse « Pages des Règles ») n'a pas de source Google Doc : sa provenance est « Site de dev › édition du AAAA-MM-JJ ».
// tools/db/pages_md.py#FAMILLE_DES_PAGES_DU_SITE la rattache à la famille `docs` (pas de nouvelle famille : la provenance sera retirée à la 1.0) :
// le cycle des pages (db:sync-pages) l'ajoute, puis la retire, au lieu de la refuser.
// Lot 12 du chantier « base de dev = source de vérité » (R274, R278) : `pages_md.py sync` n'écrit plus data/rows. Il écrit une BASE DE TRAVAIL (ici la base
// de départ, test/aide-base-de-depart.mjs : le contenu fourni s'il est posé, sinon data/rows), dont scripts/lot-de-source.mjs tire un lot `source` ;
// `npm run db:sync-pages` (scripts/db-sync-pages.mjs) enchaîne les deux. Les pages .md de comparaison sont fabriquées depuis le même contenu (db:export-pages
// dans un dossier temporaire). data/rows n'est jamais écrit : sync et tools/db/exporter.py le refusent.
//   node --test test/db-pages-du-site.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lotDeSource } from '../scripts/lot-de-source.mjs';
import { baseDeDepart } from './aide-base-de-depart.mjs';
import { dossierTemporaire, variablesTemporaires } from './aide-dossier-temporaire.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const client = fileURLToPath(new URL('../', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const pages = (...args) => spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'pages_md.py'), ...args], { encoding: 'utf8' });

// Une base de départ et les pages fabriquées depuis le même contenu, une fois pour le fichier ; chaque test travaille sur une copie.
const commun = dossierTemporaire('pages-du-site');
const depart = baseDeDepart(join(commun, 'depart.db'));
const wikiDeDepart = join(commun, 'wiki');
{
  const r = spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-export-pages.mjs'), '--out', wikiDeDepart],
    { encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(commun) } });
  if (r.status !== 0) throw new Error(`db:export-pages : ${r.stderr || r.stdout}`);
}

/** Une base de travail (copie de la base de départ) et une copie des pages, dans un dossier supprimé à la fin du test `t`. */
function copies(t) {
  const dir = dossierTemporaire('pages-du-site', { t });
  const travail = join(dir, 'travail.db');
  const wiki = join(dir, 'wiki');
  copyFileSync(depart, travail);
  cpSync(wikiDeDepart, wiki, { recursive: true });
  return { dir, travail, wiki, args: ['--base', travail, '--wiki', wiki] };
}

/** Le lot `source` de la différence entre la base de départ et `travail` (null : aucune différence de contenu). */
function lotDe(travail) {
  const a = new DatabaseSync(depart, { readOnly: true });
  const b = new DatabaseSync(travail, { readOnly: true });
  try {
    return lotDeSource(a, b, { titre: 'Essai du cycle des pages' });
  } finally {
    a.close();
    b.close();
  }
}

const enTete = (source) => `---\ntitle: "Page créée sur le site"\naliases: []\ntags: []\nsummary: "Un résumé."\nsources: ["${source}"]\nstatus: draft\n---\n\nÀ compléter.\n`;
const ID = 'guide/page-creee-sur-le-site';

test('db:sync-pages : une page guide/ de source « Site de dev › » entre en famille docs dans la base de travail, puis se retire ; le lot source suit', { skip: sansPython }, (t) => {
  const { travail, wiki, args } = copies(t);
  const nouvelle = join(wiki, 'guide', 'page-creee-sur-le-site.md');
  writeFileSync(nouvelle, enTete('Site de dev › édition du 2026-11-06'));

  const ajout = pages('sync', ...args);
  assert.equal(ajout.status, 0, ajout.stdout + ajout.stderr);
  assert.match(ajout.stdout, /1 page\(s\) mise\(s\) à jour/);
  const db = new DatabaseSync(travail, { readOnly: true });
  try {
    const ligne = db.prepare('SELECT statut, origine, source_ref FROM page WHERE id = ?').get(ID);
    assert.deepEqual({ ...ligne }, { statut: 'draft', origine: 'docs', source_ref: 'Site de dev › édition du 2026-11-06' }, 'statut, origine (famille docs), source_ref');
    assert.ok(db.prepare('SELECT 1 FROM source WHERE texte = ?').get('Site de dev › édition du 2026-11-06'), 'sa source');
  } finally {
    db.close();
  }
  assert.equal(pages('check', ...args).status, 0, 'à jour après la synchronisation');
  const { lot, bilan } = lotDe(travail);
  assert.equal(lot.nature, 'source');
  assert.deepEqual(Object.keys(bilan.tables).sort(), ['page', 'page_source', 'source']);
  assert.ok(lot.operations.some((o) => o.table === 'page' && o.operation === 'inserer' && o.cle.id === ID), 'le lot insère la page');

  rmSync(nouvelle);
  const retrait = pages('sync', ...args);
  assert.equal(retrait.status, 0, retrait.stdout + retrait.stderr);
  assert.equal(lotDe(travail).lot, null, 'ajout puis retrait : la page, sa source et son renvoi sont retirés, aucune différence de contenu');
});

test('db:sync-pages : une page guide/ sans source Google Doc ni « Site de dev › » reste refusée', { skip: sansPython }, (t) => {
  const { wiki, args } = copies(t);
  writeFileSync(join(wiki, 'guide', 'page-sans-provenance.md'), enTete('Une note quelconque'));
  const refus = pages('sync', ...args);
  assert.equal(refus.status, 1, refus.stdout + refus.stderr);
  assert.match(refus.stdout, /refusé : origine inconnue : guide\/page-sans-provenance/);
});

test('npm run db:sync-pages (scripts/db-sync-pages.mjs) : une copie préparée de l’extrait reçoit les .md, le lot source est écrit ; sans changement, aucun fichier', { skip: sansPython }, (t) => {
  const { dir, wiki } = copies(t);
  const sortie = join(dir, 'lot.json');
  const syncPages = () => spawnSync(process.execPath, ['--no-warnings', join(client, 'scripts', 'db-sync-pages.mjs'), '--avant', depart, '--wiki', wiki, '--lot', sortie, '--titre', 'Essai'],
    { encoding: 'utf8', env: { ...process.env, ...variablesTemporaires(dir) } });
  const rien = syncPages();
  assert.equal(rien.status, 0, rien.stdout + rien.stderr);
  assert.match(rien.stdout, /aucune différence/);
  assert.equal(existsSync(sortie), false, 'aucun lot sans différence');

  writeFileSync(join(wiki, 'guide', 'page-creee-sur-le-site.md'), enTete('Site de dev › édition du 2026-11-06'));
  const r = syncPages();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lot = JSON.parse(readFileSync(sortie, 'utf8'));
  assert.equal(lot.format, 'maverick-lot/1');
  assert.equal(lot.nature, 'source');
  assert.ok(lot.operations.some((o) => o.table === 'page' && o.operation === 'inserer' && o.cle.id === ID));
  const avant = new DatabaseSync(depart, { readOnly: true });
  try {
    assert.equal(avant.prepare('SELECT 1 FROM page WHERE id = ?').get(ID), undefined, 'l’« avant » n’est jamais écrit');
  } finally {
    avant.close();
  }
});

test('data/rows n’est jamais écrit : pages_md.py sync et tools/db/exporter.py le refusent (seule une copie de travail s’écrit)', { skip: sansPython }, (t) => {
  const { travail } = copies(t);
  const rowsDuDepot = join(racine, 'data', 'rows');
  for (const args of [['sync'], ['sync', '--rows', rowsDuDepot], ['sync', '--rows', join(client, '..', 'data', 'rows')]]) {
    const r = pages(...args);
    assert.equal(r.status, 1, `${args.join(' ')} : ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /refusé : sync n'écrit plus data\/rows/);
  }
  const exporter = (...args) => spawnSync('python3', ['-I', join(racine, 'tools', 'db', 'exporter.py'), travail, ...args], { encoding: 'utf8' });
  for (const args of [[], ['--rows', rowsDuDepot]]) {
    const r = exporter(...args);
    assert.notEqual(r.status, 0, `exporter.py ${args.join(' ')}`);
    assert.match(r.stderr, /data\/rows/);
  }
  // une copie de lignes s'écrit : le chemin des tests et des copies de travail du workflow
  const dossier = join(dossierTemporaire('pages-du-site-export', { t }), 'rows');
  const ok = exporter('--rows', dossier);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(existsSync(join(dossier, 'page.sql')));
});
