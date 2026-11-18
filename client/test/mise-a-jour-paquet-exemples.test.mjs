// Les pages d'exemple dans le chemin « paquet » du workflow de mise à jour (scripts/mise-a-jour-paquet.mjs, scripts/mise-a-jour-github.mjs ; docs/serveur.md,
// « Mise à jour depuis la base source (lot 8) ») : le site de dev n'a pas ces fixtures (des pages `statut = 'example'`, pas du lore), data/rows les a. Un
// paquet sans aucune page d'exemple les reçoit de data/pages-d-exemple.sql dans une COPIE de travail (paquetAvecLesExemples), au job preparer comme au job
// livrer : « Copier vers le dépôt » depuis un site sans exemples passe et les garde, aucun fichier ne change pour elles. Elles n'excusent rien : une vraie
// page changée sans trace reste refusée (code 4), et le paquet fourni n'est jamais modifié.
//   node --test test/mise-a-jour-paquet-exemples.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { appliquerPaquet, ErreurPaquet } from '../scripts/mise-a-jour-paquet.mjs';
import { enveloppeGit, FICHIER_DES_PAGES_D_EXEMPLE, gitLocal, paquetAvecLesExemples, verifierContrePaquet } from '../scripts/mise-a-jour-github.mjs';
import { preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { fabriquerPaquet } from '../serveur/paquet.mjs';
import { FICHIER_DES_PAGES_D_EXEMPLE as FICHIER_DU_MODULE } from '../src/lib/contenu-fourni.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { copieDesRowsDeDepart } from './aide-base-de-depart.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('paquet-exemples');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const exemplesDe = (chemin) => {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return db.prepare("SELECT id FROM page WHERE statut = 'example' ORDER BY id").all().map((p) => p.id);
  } finally {
    db.close();
  }
};
const empreinte = (chemin) => createHash('sha256').update(readFileSync(chemin)).digest('hex');
const lire = (rows) => Object.fromEntries(readdirSync(rows).map((f) => [f, readFileSync(join(rows, f), 'utf8')]));

// le site de dev : une base vivante tirée des règles SANS pages d'exemple (HIDE_EXAMPLES=1), comme celle du site
const regles = cheminBase({ sansExemples: true });
const { chemin: source } = preparerBaseVivante({ regles, dossier: join(racine, 'db') });
const COPIE = '6f8fad5b-d9cb-469f-a165-70867728950e';
const PAQUET = join(racine, 'copie.db');
fabriquerPaquet({ source, destination: PAQUET, id: COPIE, mode: 'copie' });
const ATTENDUES = exemplesDe(cheminBase({ sansExemples: false }));

test('la constante recopiée dans le script du workflow (il n’importe que node:) est celle du module', () => {
  assert.deepEqual(FICHIER_DES_PAGES_D_EXEMPLE, FICHIER_DU_MODULE);
});

test('paquetAvecLesExemples : une copie avec les pages d’exemple du dépôt quand le paquet n’en a aucune ; le paquet fourni n’est jamais modifié', () => {
  assert.deepEqual(exemplesDe(PAQUET), [], 'le site de dev n’a pas de page d’exemple');
  assert.ok(ATTENDUES.length > 0);
  const avant = empreinte(PAQUET);
  const travail = join(dossierTemporaire('travail', { dans: racine }), 'paquet.db');
  assert.equal(paquetAvecLesExemples(PAQUET, travail), ATTENDUES.length);
  assert.deepEqual(exemplesDe(travail), ATTENDUES);
  assert.equal(empreinte(PAQUET), avant, 'le paquet fourni est intact');
  // un paquet qui en a déjà n'est pas touché
  const encore = join(dossierTemporaire('travail', { dans: racine }), 'paquet.db');
  assert.equal(paquetAvecLesExemples(travail, encore), 0);
  assert.equal(empreinte(encore), empreinte(travail));
});

test('copie vers le dépôt depuis un site sans exemples : elle passe, les pages d’exemple restent dans data/rows, et livrer réexporte le même commit', { skip: sansPython }, (t) => {
  const rows = copieDesRowsDeDepart(join(dossierTemporaire('rows', { dans: racine }), 'rows'));
  const r = appliquerPaquet(PAQUET, { lot: COPIE, mode: 'copie', rows });
  for (const id of ATTENDUES) assert.ok(lire(rows)['page.sql'].includes(`VALUES ('${id}', `), `${id} reste dans data/rows`);
  assert.ok(!r.fichiers.includes('page.sql'), 'aucune page ne change pour les exemples');

  // le job livrer : le commit qui porte ces lignes est celui que donne le paquet réexporté (avec les mêmes exemples)
  if (spawnSync('git', ['--version']).status !== 0) {
    t.skip('git absent : la vérification du job livrer (verifierContrePaquet) ne peut pas tourner');
    return;
  }
  const depot = dossierTemporaire('depot', { dans: racine });
  const g = enveloppeGit(gitLocal(depot));
  g(['init', '--quiet', '-b', 'dev']);
  for (const [k, v] of [['user.name', 'test'], ['user.email', 'test@example.com'], ['commit.gpgsign', 'false']]) g(['config', k, v]);
  mkdirSync(join(depot, 'data'), { recursive: true });
  cpSync(rows, join(depot, 'data', 'rows'), { recursive: true });
  g(['add', '-A']);
  g(['commit', '--quiet', '-m', 'Copie : essai']);
  const commit = g(['rev-parse', 'HEAD']).sortie.trim();
  assert.equal(verifierContrePaquet(g, { commit, paquet: PAQUET }), readdirSync(rows).filter((f) => f.endsWith('.sql')).length);
});

test('une page d’exemple n’excuse rien : une vraie page changée sans trace est toujours refusée (code 4), et elle seule est nommée', { skip: sansPython }, () => {
  const falsifie = join(dossierTemporaire('falsifie', { dans: racine }), 'paquet.db');
  copyFileSync(PAQUET, falsifie);
  const db = new DatabaseSync(falsifie);
  let page;
  try {
    page = db.prepare("SELECT id FROM page WHERE type = 'guide' AND statut <> 'example' ORDER BY id LIMIT 1").get().id;
    db.prepare("UPDATE page SET corps_md = corps_md || '\nUne phrase ajoutée sans trace.\n' WHERE id = ?").run(page);
  } finally {
    db.close();
  }
  const rows = copieDesRowsDeDepart(join(dossierTemporaire('rows', { dans: racine }), 'rows'));
  const avant = lire(rows);
  assert.throws(() => appliquerPaquet(falsifie, { lot: COPIE, mode: 'copie', rows }),
    (e) => e instanceof ErreurPaquet && e.code === 4 && e.details.pages.includes(page) && !e.details.pages.some((p) => ATTENDUES.includes(p)));
  assert.deepEqual(lire(rows), avant, 'data/rows intact');
});
