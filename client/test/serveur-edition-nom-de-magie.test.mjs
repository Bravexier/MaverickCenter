// Le nom d'une magie ne change par aucune voie du site de dev (essai mécanique, lot 10 : la variante V5 « magie renommée » est hors des voies du site,
// informative). Le service d'édition (serveur/edition.mjs#enregistrer, que l'API, les lots de changements et l'éditeur en place appellent) refuse :
// la colonne magie.nom (lib/edition-modele.mjs#TABLES.magie ne l'a pas), le titre de la page d'une magie (seules les pages du guide et du Codex ont un
// titre modifiable : texteDePageModifiable) et un alias (ni table du modèle ni entité : le service n'en écrit que pour un titre changé du guide ou du
// Codex) ; aucune entité « magie » ne se crée. Les autres opérations (relations, magies innées, ordre, chronologie, mots-clés, bestiaire) n'écrivent pas magie.nom.
// Les couleurs et les listes qui lisent une magie par son nom (lib/palette-css.mjs#classeDeMagie) peuvent donc le faire (skill tests-conventions).
// Un refus ne laisse rien : ni la ligne, ni le journal.
//   node --test test/serveur-edition-nom-de-magie.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { enregistrer, ErreurEdition } from '../serveur/edition.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES } from '../src/lib/edition-modele.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

/** Une copie de la base, ouverte en écriture, fermée à la fin du test. */
function copie(t) {
  const chemin = join(dossierTemporaire('nom-de-magie', { t }), 'regles.db');
  copyFileSync(cheminBase({ sansExemples: false }), chemin);
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON');
  t.after(() => db.close());
  return db;
}

const compteDuJournal = (db) => db.prepare('SELECT (SELECT count(*) FROM modification) + (SELECT count(*) FROM modification_lot) AS n').get().n;

/** `enregistrer` refuse l'opération (ErreurEdition 400) et rien n'est écrit. */
function refusee(db, page, operation, motif) {
  const journal = compteDuJournal(db);
  assert.throws(() => enregistrer(db, { page, operations: [operation] }), (e) => e instanceof ErreurEdition && e.statut === 400 && motif.test(e.message));
  assert.equal(compteDuJournal(db), journal, 'rien au journal');
}

test('le modèle de l’édition n’a ni le nom d’une magie, ni l’alias, ni une entité « magie »', () => {
  for (const c of ['nom', 'nom_cle']) assert.equal(Object.hasOwn(TABLES.magie.colonnes, c), false, `magie.${c}`);
  assert.equal(Object.hasOwn(TABLES, 'alias'), false);
  assert.equal(Object.hasOwn(ENTITES, 'magie'), false);
});

test('par le service : le nom d’une magie, le titre de sa page et un alias sont refusés ; rien n’est écrit', (t) => {
  const db = copie(t);
  const magies = db.prepare('SELECT m.id, m.nom, p.titre FROM magie m JOIN page p ON p.id = m.id ORDER BY m.id').all();
  assert.ok(magies.length > 0);
  for (const m of magies) {
    refusee(db, m.id, { op: 'modifier', table: 'magie', cle: { id: m.id }, valeurs: { nom: `${m.nom} renommée` } }, /nom/);
    refusee(db, m.id, { op: 'modifier', table: 'page', cle: { id: m.id }, valeurs: { titre: `${m.titre} renommée` } }, /seules les pages du guide et du Codex/);
    refusee(db, m.id, { op: 'modifier', table: 'alias', cle: { page_id: m.id, ordre: 0 }, valeurs: { texte: `${m.nom} bis` } }, /« alias » : pas modifiable/);
    for (const entite of ['alias', 'magie']) refusee(db, m.id, { op: 'creer', entite, valeurs: { nom: `${m.nom} bis`, texte: `${m.nom} bis` } }, new RegExp(entite));
    assert.deepEqual({ ...db.prepare('SELECT m.nom, p.titre FROM magie m JOIN page p ON p.id = m.id WHERE m.id = ?').get(m.id) }, { nom: m.nom, titre: m.titre });
  }
});
