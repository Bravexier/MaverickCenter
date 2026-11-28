// Le mot-clé créé d'après la migration 0136 et son repère (chantier 4 des mots-clés, retrait des colonnes) :
//   - au rejeu (serveur/edition.mjs#rejouerLeJournal), l'insertion d'un mot-clé sans nom ni définition (ils vivent sur son repère) n'est pas lue comme une
//     écriture d'avant la 0056 (ancienneEcritureDuGlossaire la sautait : le repère qui suit citait alors un mot-clé absent, « clé étrangère rompue ») ;
//   - dans le lot d'une différence (serveur/epreuve-des-lots.mjs#lotDeLaDifference), le repère d'un mot-clé créé cite le numéro à donner de son mot-clé
//     (sa clé est `mot_cle_id`), jamais un numéro à lui.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { adaptateurDuJournal, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal } from '../serveur/edition-journal.mjs';
import { lotDeLaDifference } from '../serveur/epreuve-des-lots.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('rejeu-reperes');
let n = 0;
const nouvelle = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin);
const idLibre = (db) => db.prepare('SELECT coalesce(max(id), 0) + 1000 AS id FROM mot_cle').get().id;
const cleLibre = (db, base) => {
  let cle = base;
  for (let k = 2; db.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(cle); k += 1) cle = `${base}-${k}`;
  return cle;
};

test('rejeu : un mot-clé créé avec son repère (forme d’après la 0136) est rejoué, le repère trouve son mot-clé', () => {
  const db = nouvelle();
  try {
    const id = idLibre(db);
    const cle = cleLibre(db, 'essai-rejeu-repere');
    const motCle = { id, cle, verrou: 0, monnaie_id: null };
    const repere = { mot_cle_id: id, nom: 'Essai de rejeu', adresse: null, definition: 'essai', couleur: null, icone: null };
    // l'adaptateur ne le saute pas (une insertion sans libellé n'est pas d'avant la 0056)
    const adapte = adaptateurDuJournal(db)({ lot_id: 'l', rang: 1, table_nom: 'mot_cle', operation: 'inserer', cle: JSON.stringify({ id }), avant: null, apres: JSON.stringify(motCle) });
    assert.notEqual(adapte.sansEffet, true);
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, { format: 'maverick-edition/1', lots: [{ id: 'essai-rejeu-repere', fait_le: '2026-11-28T00:00:00Z', resume: 'mot-clé d’essai',
      modifications: [
        { rang: 1, table: 'mot_cle', cle: { id }, operation: 'inserer', avant: null, apres: motCle },
        { rang: 2, table: 'repere', cle: { mot_cle_id: id }, operation: 'inserer', avant: null, apres: repere },
      ] }] });
    rejouerLeJournal(db);
    const conflits = db.prepare("SELECT detail FROM modification WHERE etat = 'conflit'").all().map((x) => x.detail);
    assert.deepEqual(conflits, []);
    assert.equal(db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(id)?.cle, cle);
    assert.equal(db.prepare('SELECT mot_cle_id FROM repere WHERE mot_cle_id = ?').get(id)?.mot_cle_id, id);
    db.exec('ROLLBACK');
  } finally {
    db.close();
  }
});

test('rejeu : un mot-clé libre inséré sans définition par un lot d’avant la 0056 reste sans effet', () => {
  const db = nouvelle();
  try {
    const id = idLibre(db);
    const apres = { id, libelle: 'Essai d’avant la 0056', cle: cleLibre(db, 'essai-avant-0056') };
    const adapte = adaptateurDuJournal(db)({ lot_id: 'l', rang: 1, table_nom: 'mot_cle', operation: 'inserer', cle: JSON.stringify({ id }), avant: null, apres: JSON.stringify(apres) });
    assert.equal(adapte.sansEffet, true);
  } finally {
    db.close();
  }
});

test('lot d’une différence : le repère d’un mot-clé créé reprend le numéro à donner de son mot-clé ; celui d’un mot-clé existant garde son id', () => {
  const db = nouvelle();
  try {
    const id = idLibre(db);
    const existant = db.prepare('SELECT id FROM mot_cle ORDER BY id LIMIT 1').get().id;
    const vide = { inserees: [], modifiees: [], supprimees: [] };
    const repere = (motCle) => ({ mot_cle_id: motCle, nom: 'Essai', adresse: null, definition: null, couleur: null, icone: null });
    const diff = {
      mot_cle: { ...vide, inserees: [{ id, cle: cleLibre(db, 'essai-difference'), verrou: 0, monnaie_id: null }] },
      repere: { ...vide, inserees: [repere(id), repere(existant)] },
    };
    const { lot, complement } = lotDeLaDifference(diff, db, { titre: 'Essai', nature: 'code' });
    const insereDe = (table) => lot.operations.filter((o) => o.table === table && o.operation === 'inserer');
    const [motCle] = insereDe('mot_cle');
    assert.ok(motCle.cle.id?.$numero, 'le mot-clé reçoit un numéro à donner');
    const [cree, garde] = insereDe('repere');
    assert.deepEqual(cree.cle, { mot_cle_id: motCle.cle.id });
    assert.deepEqual(cree.apres.mot_cle_id, motCle.cle.id);
    assert.deepEqual(garde.cle, { mot_cle_id: existant });
    assert.deepEqual(Object.values(complement.numeros), [id], 'un seul numéro à donner : celui du mot-clé');
  } finally {
    db.close();
  }
});
