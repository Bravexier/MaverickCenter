// `npm run db:check` suit MAVERICK_CONTENU (lot 12 du chantier « la base du site de dev devient la source de vérité », R274, R278) : quelle base est
// contrôlée. Sans base en argument et avec la variable, la COPIE préparée du contenu fourni (jamais le fichier fourni, qui reste intact) ; sans variable,
// var/maverick.db comme avant ; une base donnée en argument l'emporte sur la variable. Le test porte sur le choix de la base, pas sur la valeur du contenu.
// Il reprend aussi, de test/db-donnees.test.mjs (qui lit data/rows par nature), la preuve que db:check voit un défaut injecté.
//   node --test test/db-check-contenu.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { choisirLaBase } from '../scripts/db-check.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { copieDEssai, empreinteDuFichier } from './aide-contenu-fourni.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const RACINE = resolve(CLIENT, '..');

const verifier = (args, env) => {
  const r = spawnSync(process.execPath, ['--no-warnings', 'scripts/db-check.mjs', ...args], {
    cwd: CLIENT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, MAVERICK_CONTENU: '', MAVERICK_CONTENU_DERIVE: '', ...env },
  });
  return { code: r.status, ligne: JSON.parse(r.stdout || '{}'), erreur: r.stderr };
};

test('choisirLaBase : l’argument, puis le contenu fourni, puis var/maverick.db', (t) => {
  const dossier = dossierTemporaire('db-check-choix', { t });
  const contenu = join(dossier, 'contenu.db');
  writeFileSync(contenu, '');
  assert.deepEqual(choisirLaBase([], {}, RACINE), { origine: 'defaut', chemin: join(RACINE, 'var', 'maverick.db') });
  assert.deepEqual(choisirLaBase([], { MAVERICK_CONTENU: '   ' }, RACINE).origine, 'defaut', 'une variable vide ne compte pas');
  assert.deepEqual(choisirLaBase([], { MAVERICK_CONTENU: contenu }, RACINE), { origine: 'contenu', chemin: contenu });
  assert.deepEqual(choisirLaBase(['autre.db'], { MAVERICK_CONTENU: contenu }, RACINE), { origine: 'argument', chemin: resolve('autre.db') });
  assert.equal(choisirLaBase(['--types', 'x.mjs'], { MAVERICK_CONTENU: contenu }, RACINE).origine, 'contenu', 'une option n’est pas une base');
  assert.throws(() => choisirLaBase([], { MAVERICK_CONTENU: join(dossier, 'absent.db') }, RACINE), /introuvable/, 'jamais un repli silencieux sur var/maverick.db');
});

test('avec MAVERICK_CONTENU, db:check contrôle la copie du contenu fourni, et l’argument l’emporte', (t) => {
  const dossier = dossierTemporaire('db-check-contenu', { t });
  const sain = copieDEssai(dossier, () => {}, 'sain.db');
  // une clé étrangère rompue : l'extrait dérivé par la voie du build la garde, le contrôle la voit
  const abime = copieDEssai(dossier, (db) => {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('DELETE FROM type_page WHERE id = (SELECT type FROM page LIMIT 1)');
  }, 'abime.db');
  const empreinte = empreinteDuFichier(abime);

  const deLaVariable = verifier([], { MAVERICK_CONTENU: abime });
  assert.equal(deLaVariable.ligne.base.origine, 'contenu', deLaVariable.erreur);
  assert.equal(deLaVariable.ligne.base.chemin, abime);
  assert.ok(deLaVariable.ligne.nbProblemes > 0, 'la base abîmée de la variable est celle qui est contrôlée');
  assert.equal(deLaVariable.code, 1);
  assert.equal(empreinteDuFichier(abime), empreinte, 'le fichier fourni n’est jamais modifié');

  const propre = verifier([], { MAVERICK_CONTENU: sain });
  assert.equal(propre.ligne.base.origine, 'contenu', propre.erreur);
  assert.equal(propre.ligne.nbProblemes, 0, JSON.stringify(propre.ligne.problemes));
  assert.equal(propre.code, 0);

  // l'argument est contrôlé tel quel, malgré la variable qui désigne le contenu abîmé
  const baseDonnee = cheminDImport();
  const arg = verifier([baseDonnee], { MAVERICK_CONTENU: abime });
  assert.equal(arg.ligne.base.origine, 'argument', arg.erreur);
  assert.equal(arg.ligne.base.chemin, baseDonnee);
  assert.equal(arg.ligne.nbProblemes, verifier([baseDonnee], {}).ligne.nbProblemes, 'même verdict avec ou sans la variable');
});

test('db:check détecte une entité typée qui n’a plus sa ligne page_entite (la ligne est choisie dans l’état courant)', (t) => {
  const dossier = dossierTemporaire('db-check-defaut', { t });
  let perdue;
  const copie = copieDEssai(dossier, (db) => {
    perdue = db.prepare('SELECT entite_table, entite_id FROM page_entite ORDER BY entite_table, entite_id LIMIT 1').get();
    db.prepare('DELETE FROM page_entite WHERE entite_table = ? AND entite_id = ?').run(perdue.entite_table, perdue.entite_id);
  }, 'defaut.db');
  const r = verifier([copie], {});
  assert.equal(r.code, 1);
  assert.ok(r.ligne.problemes.some((p) => p.includes(`page_entite : ${perdue.entite_table}:${perdue.entite_id} manque`)), JSON.stringify(r.ligne.problemes.slice(0, 3)));
});
