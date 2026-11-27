// Les numéros entiers que le service donne (lot 6 du chantier de la base de dev, garde-fou 11 : « Un numéro n'est jamais redonné, même par un lot ou après
// une restauration » ; serveur/edition-journal.mjs#donnerUnNumero, serveur/edition-mots-cles.mjs#idSuivant) :
//   - l'id d'un mot-clé, d'un synonyme ou d'une catégorie créés par l'édition ordinaire est 1 + le plus haut numéro connu (plafond de `numero_donne`, colonne,
//     journal, historique), et le plafond est monté dans la même transaction ;
//   - une ligne retirée (une annulation de lot, simulée ici par un DELETE), un journal vidé ou une base restaurée sans `numero_donne` ne le font pas redonner ;
//   - la même fonction sert aux lots de changements (jeton `$numero`) : un seul code.
// Aucun texte ni valeur de règle figés : les mots-clés créés portent des libellés d'essai, les ids se lisent dans la base.
//   node --test test/serveur-edition-numeros.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { donnerUnNumero, plusHautNumero } from '../serveur/edition-journal.mjs';
import { idSuivant } from '../serveur/edition-mots-cles.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { lotHorsRoute } from './aide-mot-cle-nu.mjs';

const racine = dossierTemporaire('edition-numeros');
let n = 0;

function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const lot = (operations) => {
    const r = traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'regles/glossaire/', operations }) }, service);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return r.corps;
  };
  const plafond = (table) => db.prepare("SELECT plafond FROM numero_donne WHERE table_nom = ? AND colonne = 'id'").get(table)?.plafond;
  return { db, lot, plafond };
}

/** Efface une ligne comme le ferait une annulation de lot : la ligne et ses lignes filles, sans le plafond ni (selon `traces`) le journal. */
function retirerLeMotCle(db, id, { traces = false } = {}) {
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of ['mot_cle_categorie', 'mot_cle_synonyme', 'mot_cle_ancienne_cle']) db.prepare(`DELETE FROM ${t} WHERE mot_cle_id = ?`).run(id);
  db.prepare('DELETE FROM mot_cle WHERE id = ?').run(id);
  db.exec('PRAGMA foreign_keys = ON');
  if (traces) for (const t of ['modification', 'historique_modification']) db.prepare(`DELETE FROM ${t} WHERE table_nom = 'mot_cle' AND json_extract(cle, '$.id') = ?`).run(id);
}
// nu, hors route (par une route, il naîtrait avec sa page de notion : aide-mot-cle-nu.mjs)
const creerUnMotCle = (m, libelle) => {
  const r = lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle } }], 'regles/glossaire/');
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps.crees[0].id;
};

test('idSuivant : un mot-clé créé prend 1 + le plus haut numéro connu, le plafond monte dans la même transaction', () => {
  const m = nouvelle();
  const avant = plusHautNumero(m.db, 'mot_cle', 'id');
  const id = creerUnMotCle(m, 'Essai numéro zq un');
  assert.equal(id, avant + 1);
  assert.equal(m.plafond('mot_cle'), id, 'le plafond a suivi la création');
  assert.equal(creerUnMotCle(m, 'Essai numéro zq deux'), id + 1);
  assert.equal(m.plafond('mot_cle'), id + 1);
});

test('après la suppression du dernier mot-clé (une annulation de lot simulée), le suivant ne reprend pas son numéro', () => {
  const m = nouvelle();
  const dernier = creerUnMotCle(m, 'Essai numéro zq trois');
  retirerLeMotCle(m.db, dernier);
  assert.equal(m.db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(dernier), undefined);
  assert.equal(idSuivant(m.db, 'mot_cle', { monter: false }), dernier + 1, 'la table ne le porte plus : le plafond garde le numéro donné');
  const suivant = creerUnMotCle(m, 'Essai numéro zq quatre');
  assert.ok(suivant > dernier, `${suivant} après ${dernier}`);

  // sans les traces du journal ni de l'historique, le plafond tient seul
  retirerLeMotCle(m.db, suivant, { traces: true });
  m.db.exec("DELETE FROM modification WHERE table_nom = 'mot_cle'");
  assert.ok(creerUnMotCle(m, 'Essai numéro zq cinq') > suivant, 'le plafond tient sans les traces');
});

test('base restaurée sans `numero_donne` : les traces du journal tiennent, et une base d’avant la 0128 (sans la table) donne encore un numéro', () => {
  const m = nouvelle();
  const dernier = creerUnMotCle(m, 'Essai numéro zq six');
  retirerLeMotCle(m.db, dernier);
  m.db.exec('DELETE FROM numero_donne');
  assert.ok(creerUnMotCle(m, 'Essai numéro zq sept') > dernier, 'le journal se souvient du numéro donné');
  // la table elle-même absente (base d'avant la migration 0128)
  m.db.exec('DROP TABLE numero_donne');
  const id = idSuivant(m.db, 'mot_cle');
  assert.equal(id, plusHautNumero(m.db, 'mot_cle', 'id') + 1);
  assert.doesNotThrow(() => donnerUnNumero(m.db, 'mot_cle', 'id'));
});

test('le plafond monte dans la transaction de l’appelant : un lot refusé (annulé) emporte le numéro réservé', () => {
  const m = nouvelle();
  const avant = m.plafond('mot_cle') ?? 0;
  m.db.exec('BEGIN IMMEDIATE');
  const id = idSuivant(m.db, 'mot_cle');
  assert.equal(m.plafond('mot_cle'), id);
  m.db.exec('ROLLBACK');
  assert.equal(m.plafond('mot_cle') ?? 0, avant, 'rien ne reste de la transaction annulée');
  // un numéro seulement calculé (traduction d'un ancien journal au rejeu) n'écrit rien
  idSuivant(m.db, 'mot_cle', { monter: false });
  assert.equal(m.plafond('mot_cle') ?? 0, avant);
});

test('un synonyme et une catégorie créés suivent la même règle ; seuls ces trois noms sont permis', () => {
  const m = nouvelle();
  const motCle = creerUnMotCle(m, 'Essai numéro zq huit');
  m.lot([{ op: 'synonymes_mot_cle', mot_cle: motCle, synonymes: ['Essai synonyme zq neuf'] }]);
  const synonyme = m.db.prepare('SELECT id FROM mot_cle_synonyme WHERE mot_cle_id = ?').get(motCle).id;
  assert.equal(m.plafond('mot_cle_synonyme'), synonyme);
  m.db.prepare('DELETE FROM mot_cle_synonyme WHERE id = ?').run(synonyme);
  m.lot([{ op: 'synonymes_mot_cle', mot_cle: motCle, synonymes: ['Essai synonyme zq dix'] }]);
  assert.ok(m.db.prepare('SELECT id FROM mot_cle_synonyme WHERE mot_cle_id = ?').get(motCle).id > synonyme, 'un synonyme retiré ne redonne pas son numéro');

  const categorie = (libelle) => m.lot([{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle } }]).crees[0].id;
  const c1 = categorie('Essai catégorie zq onze');
  m.lot([{ op: 'supprimer', entite: 'categorie_mot_cle', cle: { id: c1 } }]);
  assert.ok(categorie('Essai catégorie zq douze') > c1, 'une catégorie supprimée ne redonne pas son numéro');

  assert.throws(() => idSuivant(m.db, 'metier'), /table inattendue/);
});

test('plusHautNumero : une colonne inconnue est refusée, une trace à clé non entière n’y compte pas', () => {
  const m = nouvelle();
  assert.throws(() => plusHautNumero(m.db, 'mot_cle', 'colonne_inconnue'), /colonne inconnue/);
  assert.throws(() => plusHautNumero(m.db, 'table_inconnue', 'id'), /table inconnue/);
  const avant = plusHautNumero(m.db, 'mot_cle', 'id');
  // une trace d'un ancien identifiant texte (avant la 0113) ne fait pas monter le numéro
  m.db.prepare("INSERT INTO modification_lot (id, fait_le, resume) VALUES ('lot-texte', '2026-01-01T00:00:00Z', 'essai')").run();
  m.db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES ('lot-texte', 1, 'mot_cle', '{\"id\":\"99999-ancien\"}', 'supprimer', '{\"id\":\"x\"}', NULL, 'en_attente')").run();
  assert.equal(plusHautNumero(m.db, 'mot_cle', 'id'), avant);
});
