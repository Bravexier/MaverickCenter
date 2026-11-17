// Les lignes filles d'un mot-clé (mot_cle_categorie, mot_cle_synonyme, mot_cle_ancienne_cle : migrations 0113, 0115) quand il est supprimé ou
// fusionné sur le site de dev (serveur/edition-mots-cles.mjs#retirerLesFillesDuMotCle, #recevoirLaFusion) :
//   - notées au journal avant la ligne de mot_cle (la cascade du schéma n'en retire alors rien hors du journal), si bien que la mise à jour des règles
//     (scripts/mise-a-jour-regles.mjs) accepte le lot : aucun fichier hors des tables du lot ;
//   - la fusion transmet tout (décision R233 (11) : « Oui, tout transmettre ») : les synonymes de l'absorbé passent au conservé, à la suite des siens,
//     sa clé et ses clés quittées deviennent des clés quittées du conservé ; un mot-clé créé ensuite sous l'une d'elles la reprend (R233 (11),
//     « Le nouveau la prend ») ; un conservé verrouillé ne prend pas les synonymes (R233 (6), comme son lien et sa couleur, R219 (4)).
// Mots-clés d'essai (test/aide-mots-cles.mjs) sur une copie de data/rows sans note de version en attente ; synonymes et libellés d'essai inventés par
// le test, absents de la base.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerMiseAJour } from '../scripts/mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { TABLES_DES_FILLES_DU_MOT_CLE } from '../serveur/edition-mots-cles.mjs';
import { motCleDeLaRef } from '../src/lib/mots-cles-balises.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { copieSansNoteEnAttente, versionALaRevision } from './aide-mise-a-jour.mjs';
import { ajouterLesMotsClesDEssai, MOTS_CLES_D_ESSAI } from './aide-mots-cles.mjs';

const SCRIPTS = fileURLToPath(new URL('../scripts/', import.meta.url));
const VERSION_DEV = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const racine = dossierTemporaire('mots-cles-fusion');
const A = MOTS_CLES_D_ESSAI['essai-glossaire-a'];
const C = MOTS_CLES_D_ESSAI['essai-glossaire-c'];
const D = MOTS_CLES_D_ESSAI['essai-glossaire-d'];

/** Construit `base` depuis `rows` (db-build, puis db-derive si `deriver`). */
function construire(rows, base, { deriver = true } = {}) {
  for (const [script, args] of [['db-build.mjs', ['--out', base, '--rows', rows]], ...(deriver ? [['db-derive.mjs', [base]]] : [])]) {
    const r = spawnSync(process.execPath, ['--no-warnings', join(SCRIPTS, script), ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  }
}
// une copie de data/rows sans note en attente, avec les mots-clés d'essai, et ses règles
const ROWS = copieSansNoteEnAttente(join(racine, 'rows'), { versionProduction: versionALaRevision('HEAD') }).rows;
ajouterLesMotsClesDEssai(ROWS);
const REGLES = join(racine, 'regles.db');
construire(ROWS, REGLES);

let compteur = 0;
/** Une base vivante neuve tirée de REGLES, et ses outils. */
function base() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: REGLES, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const brut = (operations) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'regles/glossaire/', operations }) }, service);
  const lot = (operations) => {
    const r = brut(operations);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return r.corps;
  };
  const synonymes = (id) => db.prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ? ORDER BY ordre, id').all(id).map((s) => s.libelle);
  const anciennes = (id) => db.prepare('SELECT cle FROM mot_cle_ancienne_cle WHERE mot_cle_id = ? ORDER BY cle').all(id).map((a) => a.cle);
  const filles = (id) => TABLES_DES_FILLES_DU_MOT_CLE.filter((t) => db.prepare(`SELECT 1 FROM "${t}" WHERE mot_cle_id = ?`).get(id));
  return { db, brut, lot, synonymes, anciennes, filles };
}
/**
 * La mise à jour des règles (scripts/mise-a-jour-regles.mjs) de ROWS par `journal`, toujours sous le même identifiant de lot (une relance : sa note de
 * version est refaite, les lots déjà livrés sont écartés).
 */
const mettreAJour = (journal) => appliquerMiseAJour({
  format: 'maverick-mise-a-jour/1', id: '11111111-2222-3333-4444-555555555555', cree_le: '2026-11-08T10:00:00Z', version_dev: '0.1.76',
  version_cible: '0.2', texte: null, journal,
}, { rows: ROWS, reference: 'HEAD', date: '2026-11-08', versionDev: VERSION_DEV });
/** Les modifications notées au journal du service, par table et opération (« table:operation »). */
const notees = (db) => new Set(db.prepare('SELECT table_nom, operation FROM modification').all().map((m) => `${m.table_nom}:${m.operation}`));

test('B1 : un mot-clé catégorisé, avec synonyme et clé quittée, supprimé en forçant puis un autre fusionné : tout est noté, et la mise à jour des règles passe', () => {
  const { db, lot, filles } = base();
  const [c1] = categoriesDesMotsCles(db).map((c) => c.id);
  // A : une catégorie, un synonyme, un renommage (sa clé quittée) ; puis supprimé en forçant (il est sur des pages)
  lot([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [c1] }, { op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: ['Zq essai alpha'] }]);
  lot([{ op: 'modifier', table: 'mot_cle', cle: { id: A.id }, valeurs: { libelle: `${A.libelle} zq` } }]);
  assert.deepEqual(filles(A.id), TABLES_DES_FILLES_DU_MOT_CLE, 'A a des lignes dans chaque table fille');
  // D : un synonyme
  lot([{ op: 'synonymes_mot_cle', mot_cle: D.id, synonymes: ['Zq essai delta'] }]);
  // ces lignes livrées d'abord dans les règles (une première mise à jour), pour que leur retrait change les fichiers de data/rows
  mettreAJour(journalExporte(db));
  lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: A.id }, forcer: true }]);
  lot([{ op: 'fusionner_mots_cles', mot_cle: D.id, dans: C.id }]);
  // les retraits de chaque table fille, notés au journal (la cascade ne retire rien hors du journal)
  for (const t of TABLES_DES_FILLES_DU_MOT_CLE) assert.ok(notees(db).has(`${t}:supprimer`), `${t} : retrait noté`);
  const journal = journalExporte(db);
  db.close();
  // la mise à jour des règles : ni conflit, ni fichier hors des tables du lot (code 4 avant la correction : mot_cle_categorie.sql)
  const maj = mettreAJour(journal);
  for (const t of TABLES_DES_FILLES_DU_MOT_CLE) assert.ok(maj.fichiers.includes(`${t}.sql`), `${t} : ${JSON.stringify(maj.fichiers)}`);
  // les règles reconstruites : plus rien de A ni de D ; C a le synonyme et la clé de D
  const relue = join(racine, 'relue.db');
  construire(ROWS, relue, { deriver: false });
  const r = new DatabaseSync(relue, { readOnly: true });
  try {
    for (const id of [A.id, D.id]) {
      assert.equal(r.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(id), undefined);
      for (const t of TABLES_DES_FILLES_DU_MOT_CLE) assert.equal(r.prepare(`SELECT 1 FROM "${t}" WHERE mot_cle_id = ?`).get(id), undefined, `${t} ${id}`);
    }
    assert.ok(r.prepare('SELECT 1 FROM mot_cle_synonyme WHERE mot_cle_id = ? AND libelle = ?').get(C.id, 'Zq essai delta'));
    assert.equal(r.prepare('SELECT mot_cle_id FROM mot_cle_ancienne_cle WHERE cle = ?').get(D.cle)?.mot_cle_id, C.id);
  } finally {
    r.close();
  }
});

test('R233 (11) : la fusion transmet les synonymes, la clé et les clés quittées de l’absorbé ; un mot-clé créé ensuite sous une de ces clés la reprend', () => {
  const { db, lot, synonymes, anciennes, filles } = base();
  lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: ['Zq essai alpha', 'Zq essai beta'] }, { op: 'synonymes_mot_cle', mot_cle: C.id, synonymes: ['Zq essai gamma'] }]);
  const renomme = `${A.libelle} zq`;
  lot([{ op: 'modifier', table: 'mot_cle', cle: { id: A.id }, valeurs: { libelle: renomme } }]);
  const cleRenommee = db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(A.id).cle;
  assert.notEqual(cleRenommee, A.cle);
  lot([{ op: 'fusionner_mots_cles', mot_cle: A.id, dans: C.id }]);
  // les synonymes de A, à la suite de ceux de C, dans leur ordre ; ses deux clés mènent à C ; plus rien de A
  assert.deepEqual(synonymes(C.id), ['Zq essai gamma', 'Zq essai alpha', 'Zq essai beta']);
  assert.deepEqual(anciennes(C.id), [A.cle, cleRenommee].sort());
  assert.deepEqual(filles(A.id), []);
  const vocabulaire = motsClesDeLaBase(db);
  for (const ref of [A.cle, cleRenommee, 'zq essai ALPHA']) assert.equal(motCleDeLaRef(vocabulaire, ref)?.id, C.id, ref);
  // R233 (11), « Le nouveau la prend » : un mot-clé créé sous le libellé renommé de A prend sa clé ; la redirection vers C disparaît, l'autre reste
  const neuf = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: renomme } }]).crees[0].id;
  assert.equal(db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(neuf).cle, cleRenommee);
  assert.deepEqual(anciennes(C.id), [A.cle]);
  assert.equal(motCleDeLaRef(motsClesDeLaBase(db), cleRenommee)?.id, neuf);
  db.close();
});

test('R233 (11), (6) : la fusion d’un mot-clé qui a des synonymes dans un verrouillé est refusée (« Refuser la fusion ») ; sans synonyme, elle lui transmet ses clés', () => {
  const { db, brut, lot, synonymes, anciennes, filles } = base();
  // un mot-clé verrouillé qui n'étiquette aucun sort (verifierSansSort) et dont aucune définition verrouillée ne cite D
  const cible = db.prepare('SELECT id FROM mot_cle m WHERE verrou = 1 AND NOT EXISTS (SELECT 1 FROM sort_mot_cle s WHERE s.mot_cle_id = m.id) ORDER BY id').get().id;
  const avant = synonymes(cible);
  const anciennesAvant = anciennes(cible);
  // D a un synonyme : 409, champ synonymes, rien d'écrit
  lot([{ op: 'synonymes_mot_cle', mot_cle: D.id, synonymes: ['Zq essai delta'] }]);
  const refus = brut([{ op: 'fusionner_mots_cles', mot_cle: D.id, dans: cible }]);
  assert.equal(refus.statut, 409, JSON.stringify(refus.corps));
  assert.equal(refus.corps.champ, 'synonymes');
  assert.ok(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(D.id), 'D est toujours là');
  assert.deepEqual(synonymes(D.id), ['Zq essai delta']);
  assert.deepEqual([synonymes(cible), anciennes(cible)], [avant, anciennesAvant]);
  // D sans synonyme (R219 (4) : un verrouillé reçoit la fusion) : la fusion passe, la cible reçoit sa clé, et rien d'autre
  lot([{ op: 'synonymes_mot_cle', mot_cle: D.id, synonymes: [] }]);
  lot([{ op: 'fusionner_mots_cles', mot_cle: D.id, dans: cible }]);
  assert.equal(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(D.id), undefined);
  assert.deepEqual(filles(D.id), []);
  assert.deepEqual(synonymes(cible), avant);
  assert.deepEqual(anciennes(cible), [...anciennesAvant, D.cle].sort());
  db.close();
});
