// Rejeu du journal et liens de règle des métiers (client/serveur/edition.mjs#rejouerLeJournal, completerLesMetiers ; décisions R33 et R35) : un lot
// noté avant la migration 0024-metiers-fiche écrivait les bonus d'un métier sans leur compétence ni l'initiative, et son équipement sans objets de
// départ. Rejoué sur les règles d'aujourd'hui (livraison dans la base vivante, db:appliquer-edition, mise à jour des règles), ces liens sont refaits
// depuis les champs du métier, et la sortie dit quelles tables ont ainsi été complétées.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte, ouvrirLot } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('rejeu-metiers');
let compteur = 0;
const base = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);

test('un lot d’avant la décision R33 : bonus liés à leur compétence et à l’initiative, objets de départ refaits au rejeu', () => {
  const source = base();
  const id = source.prepare("SELECT id FROM metier ORDER BY id = 'metiers/acrobate' DESC, id LIMIT 1").get().id;
  source.exec('BEGIN');
  const w = ouvrirLot(source, { id: 'L-ancien', instant: '2026-10-10T12:00:00Z', pageId: 'metiers/' });
  w.modifier('metier', { id }, { bonus_brut: '+2% Esquive, +1 INI', equipement_brut: 'Corde, Arc OU Fronde' });
  for (const b of source.prepare('SELECT rang, option FROM metier_bonus WHERE metier_id = ?').all(id)) w.supprimer('metier_bonus', { metier_id: id, rang: b.rang, option: b.option });
  // comme l'édition d'avant 0024 : ni competence_id ni attribut, aucune ligne de metier_objet_depart
  const commun = { metier_id: id, option: 1, origine: 'docs_typees', source_ref: 'Site de dev › édition du 2026-10-10 › Essai › Bonus' };
  w.inserer('metier_bonus', { ...commun, rang: 1, texte: '+2% Esquive', valeur: 2, unite: '%', cible: 'Esquive', cible_cle: 'esquive' });
  w.inserer('metier_bonus', { ...commun, rang: 2, texte: '+1 INI', valeur: 1, unite: null, cible: 'INI', cible_cle: 'ini' });
  w.terminer('ancien lot');
  source.exec('COMMIT');
  const journal = journalExporte(source);
  source.close();

  const cible = base();
  cible.exec('PRAGMA foreign_keys = OFF');
  cible.exec('BEGIN');
  chargerJournal(cible, journal);
  const sortie = {};
  const bilan = rejouerLeJournal(cible, sortie);
  cible.exec('COMMIT');
  cible.exec('PRAGMA foreign_keys = ON');
  assert.equal(bilan.conflits, 0);
  assert.deepEqual(cible.prepare('SELECT rang, competence_id, attribut FROM metier_bonus WHERE metier_id = ? ORDER BY rang').all(id).map((l) => ({ ...l })), [
    { rang: 1, competence_id: 'esquive', attribut: null },
    { rang: 2, competence_id: null, attribut: 'initiative' },
  ]);
  assert.deepEqual(cible.prepare('SELECT rang, option, texte FROM metier_objet_depart WHERE metier_id = ? ORDER BY rang, option').all(id).map((o) => [o.rang, o.option, o.texte]),
    [[1, 1, 'Corde'], [2, 1, 'Arc'], [2, 2, 'Fronde']]);
  assert.deepEqual([...sortie.tablesCompletees].sort(), ['metier_bonus', 'metier_objet_depart']);
  assert.deepEqual(cible.prepare('PRAGMA foreign_key_check').all(), []);
  // rejouer un journal déjà complet ne complète plus rien
  const encore = {};
  cible.exec('BEGIN');
  rejouerLeJournal(cible, encore);
  cible.exec('COMMIT');
  assert.deepEqual(encore.tablesCompletees, []);
  cible.close();
});
