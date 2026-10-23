// Journal des modifications du site de dev (client/serveur/edition-journal.mjs, section 14 de data/schema.sql) : chaque ligne touchée est notée avec
// ses valeurs avant et après ; quand une livraison refait la base vivante, les modifications en attente sont rejouées sur les nouvelles règles, celles
// que les règles contiennent déjà passent « integree », celles que les règles contredisent passent « conflit » (le lot entier est alors annulé).
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ErreurJournal, chargerJournal, journalExporte, lignesEnAttente, ouvrirLot, rejouer } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('journal');
const REGLES = cheminBase({ sansExemples: false });
let compteur = 0;
const nouveau = (prefixe) => join(racine, `${prefixe}-${(compteur += 1)}`);
const INSTANT = '2026-10-10T12:00:00Z';

function regles(sql = '') {
  const f = `${nouveau('regles')}.db`;
  copyFileSync(REGLES, f);
  if (sql) {
    const db = new DatabaseSync(f);
    db.exec(sql);
    db.close();
  }
  return f;
}
/** Une base vivante neuve ; `ecrire(lot)` y fait un lot dans une transaction. */
function vivante(reglesDb = REGLES) {
  const dossier = nouveau('db');
  preparerBaseVivante({ regles: reglesDb, dossier });
  return { dossier, chemin: join(dossier, FICHIER_BASE) };
}
function lot(chemin, id, ecrire, instant = INSTANT) {
  const db = ouvrirBaseVivante(chemin);
  try {
    db.exec('BEGIN');
    const l = ouvrirLot(db, { id, instant, pageId: 'metiers/' });
    ecrire(l);
    l.terminer(`lot ${id}`);
    db.exec('COMMIT');
    return l;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.close();
  }
}
const lire = (chemin, sql, ...p) => {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return db.prepare(sql).all(...p);
  } finally {
    db.close();
  }
};
const FORGERON = { id: 'metiers/forgeron' };

test('un lot note chaque ligne touchée : colonnes changées seulement, ligne entière pour une insertion ou une suppression', () => {
  const { chemin } = vivante();
  const avant = lire(chemin, 'SELECT description, equipement_brut FROM metier WHERE id = ?', FORGERON.id)[0];
  const l = lot(chemin, 'L1', (w) => {
    w.modifier('metier', FORGERON, { description: 'Nouvelle description.', equipement_brut: avant.equipement_brut });
    w.modifier('metier', FORGERON, { description: 'Nouvelle description.' }); // ne change rien : pas noté
    w.supprimer('metier_bonus', { metier_id: FORGERON.id, rang: 1, option: 2 });
    w.inserer('metier_bonus', { metier_id: FORGERON.id, rang: 1, option: 2, texte: 'Arme légère', valeur: null, unite: null, cible: null, cible_cle: null,
      origine: 'docs_typees', source_ref: 'Site de dev' });
  });
  assert.equal(l.nombre, 3);
  const mods = lire(chemin, 'SELECT rang, table_nom, cle, operation, avant, apres, etat FROM modification ORDER BY rang');
  assert.deepEqual(mods.map((m) => [m.table_nom, m.operation, m.etat]), [['metier', 'modifier', 'en_attente'], ['metier_bonus', 'supprimer', 'en_attente'], ['metier_bonus', 'inserer', 'en_attente']]);
  assert.deepEqual(JSON.parse(mods[0].avant), { description: avant.description });
  assert.deepEqual(JSON.parse(mods[0].apres), { description: 'Nouvelle description.' });
  assert.equal(mods[1].cle, '{"metier_id":"metiers/forgeron","rang":1,"option":2}', 'clé dans l’ordre de la clé primaire');
  assert.equal(JSON.parse(mods[1].avant).texte, '+3% Arme lourde OU Arme légère', 'les options d’un rang portent le texte du rang');
  assert.equal(mods[2].avant, null);
  assert.equal(lire(chemin, 'SELECT resume FROM modification_lot WHERE id = ?', 'L1')[0].resume, 'lot L1');
});

test('refus : clé primaire modifiée, ligne absente, colonne inconnue, table du journal ; rien n’est écrit', () => {
  const { chemin } = vivante();
  assert.throws(() => lot(chemin, 'X1', (w) => w.modifier('metier', FORGERON, { id: 'metiers/autre' })), /clé primaire/);
  assert.throws(() => lot(chemin, 'X2', (w) => w.modifier('metier', { id: 'metiers/absent' }, { nom: 'X' })), /introuvable/);
  assert.throws(() => lot(chemin, 'X3', (w) => w.modifier('metier', FORGERON, { inconnue: 1 })), /colonne inconnue/);
  assert.throws(() => lot(chemin, 'X4', (w) => w.inserer('modification_lot', { id: 'z' })), ErreurJournal);
  assert.throws(() => lot(chemin, 'X5', (w) => w.modifier('metier', FORGERON, { nom: '' })), /CHECK/, 'les contraintes de la base valent pour l’édition');
  assert.equal(lire(chemin, 'SELECT count(*) AS n FROM modification_lot')[0].n, 0);
});

test('état net : la ligne telle qu’elle est maintenant, null si supprimée, « creee » si elle n’était pas dans les règles', () => {
  const { chemin } = vivante();
  lot(chemin, 'L1', (w) => {
    w.modifier('metier', FORGERON, { description: 'D1' });
    w.supprimer('metier_bonus', { metier_id: FORGERON.id, rang: 1, option: 2 });
  });
  lot(chemin, 'L2', (w) => {
    w.modifier('metier', FORGERON, { description: 'D2' });
    w.inserer('metier_bonus', { metier_id: FORGERON.id, rang: 1, option: 3, texte: 'Arc', valeur: null, unite: null, cible: null, cible_cle: null, origine: 'docs_typees', source_ref: 'Site de dev' });
  }, '2026-10-10T12:05:00Z');
  const db = new DatabaseSync(chemin, { readOnly: true });
  const net = lignesEnAttente(db);
  db.close();
  assert.equal(net.length, 3, 'une entrée par ligne');
  const metier = net.find((n) => n.table === 'metier');
  assert.equal(metier.ligne.description, 'D2');
  assert.equal(metier.creee, false);
  assert.equal(net.find((n) => n.cle.option === 2).ligne, null);
  assert.equal(net.find((n) => n.cle.option === 3).creee, true);
});

test('livraison sans rapport : la base est refaite et les modifications en attente sont réappliquées', () => {
  const { dossier, chemin } = vivante();
  lot(chemin, 'L1', (w) => {
    w.modifier('metier', FORGERON, { description: 'Réécrite sur le site de dev.' });
    w.supprimer('metier_bonus', { metier_id: FORGERON.id, rang: 1, option: 2 });
  });
  const r = preparerBaseVivante({ regles: regles("UPDATE metier SET description = description || ' (livraison)' WHERE id = 'metiers/acrobate'"), dossier });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.rejeu, { appliquees: 2, integrees: 0, conflits: 0, lots: 1 });
  assert.equal(lire(chemin, 'SELECT description FROM metier WHERE id = ?', FORGERON.id)[0].description, 'Réécrite sur le site de dev.');
  assert.match(lire(chemin, 'SELECT description FROM metier WHERE id = ?', 'metiers/acrobate')[0].description, /\(livraison\)$/);
  assert.equal(lire(chemin, 'SELECT count(*) AS n FROM metier_bonus WHERE metier_id = ? AND rang = 1 AND option = 2', FORGERON.id)[0].n, 0);
  assert.deepEqual(lire(chemin, 'SELECT DISTINCT etat FROM modification').map((m) => m.etat), ['en_attente']);
});

test('livraison qui contient déjà la modification (revenue par git) : « integree », plus rien en attente', () => {
  const { dossier, chemin } = vivante();
  lot(chemin, 'L1', (w) => w.modifier('metier', FORGERON, { description: 'Version du site de dev.' }));
  const r = preparerBaseVivante({ regles: regles("UPDATE metier SET description = 'Version du site de dev.' WHERE id = 'metiers/forgeron'"), dossier });
  assert.deepEqual(r.rejeu, { appliquees: 0, integrees: 1, conflits: 0, lots: 1 });
  assert.equal(lire(chemin, 'SELECT etat FROM modification')[0].etat, 'integree');
  const db = new DatabaseSync(chemin, { readOnly: true });
  assert.deepEqual(lignesEnAttente(db), []);
  db.close();
});

test('livraison qui contredit une modification : le lot entier passe « conflit » et rien n’en est réappliqué', () => {
  const { dossier, chemin } = vivante();
  lot(chemin, 'L1', (w) => {
    w.modifier('metier', { id: 'metiers/acrobate' }, { equipement_brut: 'Corde' });
    w.modifier('metier', FORGERON, { description: 'Version du site de dev.' });
  });
  lot(chemin, 'L2', (w) => w.modifier('metier', { id: 'metiers/agriculteur' }, { equipement_brut: 'Faux' }), '2026-10-10T12:05:00Z');
  const r = preparerBaseVivante({ regles: regles("UPDATE metier SET description = 'Autre version, venue de git.' WHERE id = 'metiers/forgeron'"), dossier });
  assert.deepEqual(r.rejeu, { appliquees: 1, integrees: 0, conflits: 2, lots: 2 });
  assert.equal(lire(chemin, 'SELECT description FROM metier WHERE id = ?', FORGERON.id)[0].description, 'Autre version, venue de git.');
  assert.notEqual(lire(chemin, 'SELECT equipement_brut FROM metier WHERE id = ?', 'metiers/acrobate')[0].equipement_brut, 'Corde', 'lot annulé en entier');
  assert.equal(lire(chemin, 'SELECT equipement_brut FROM metier WHERE id = ?', 'metiers/agriculteur')[0].equipement_brut, 'Faux', 'l’autre lot passe');
  const conflits = lire(chemin, "SELECT detail FROM modification WHERE etat = 'conflit'");
  assert.equal(conflits.length, 2);
  assert.match(conflits[0].detail, /metiers\/forgeron.*description/);
});

test('journal rejoué sur des règles qui le contiennent déjà : deux lots sur la même colonne, une ligne créée, modifiée puis supprimée, une autre supprimée puis recréée : « intégré »', () => {
  const { chemin } = vivante();
  const BONUS = { metier_id: FORGERON.id, rang: 9, option: 1 };
  lot(chemin, 'L1', (w) => w.modifier('metier', FORGERON, { description: 'D1' }));
  lot(chemin, 'L2', (w) => w.modifier('metier', FORGERON, { description: 'D2', equipement_brut: 'Enclume' }), '2026-10-10T12:01:00Z');
  lot(chemin, 'L3', (w) => w.inserer('metier_bonus', { ...BONUS, texte: 'X', valeur: null, unite: null, cible: null, cible_cle: null, origine: 'docs_typees', source_ref: 'Site de dev' }), '2026-10-10T12:02:00Z');
  lot(chemin, 'L4', (w) => w.modifier('metier_bonus', BONUS, { texte: 'Y' }), '2026-10-10T12:03:00Z');
  lot(chemin, 'L5', (w) => w.modifier('metier_bonus', BONUS, { texte: 'Z' }), '2026-10-10T12:04:00Z');
  lot(chemin, 'L6', (w) => w.supprimer('metier_bonus', BONUS), '2026-10-10T12:05:00Z');
  // une ligne des règles supprimée puis recréée autrement
  const RANG1 = { metier_id: FORGERON.id, rang: 1, option: 2 };
  const ancienne = lot(chemin, 'L7', (w) => w.supprimer('metier_bonus', RANG1), '2026-10-10T12:06:00Z');
  assert.equal(ancienne.nombre, 1);
  lot(chemin, 'L8', (w) => w.inserer('metier_bonus', { ...RANG1, texte: 'Recréée', valeur: null, unite: null, cible: null, cible_cle: null, origine: 'docs_typees', source_ref: 'Site de dev' }), '2026-10-10T12:07:00Z');
  const source = new DatabaseSync(chemin, { readOnly: true });
  const journal = journalExporte(source);
  source.close();
  // les règles livrées : le journal y a été rejoué puis vidé (data/rows après db:appliquer-edition)
  const livree = new DatabaseSync(regles());
  livree.exec('BEGIN');
  chargerJournal(livree, journal);
  // la ligne créée puis supprimée par le journal n'a rien à rejouer : ses quatre modifications sont « intégrées »
  assert.deepEqual(rejouer(livree), { appliquees: 4, integrees: 4, conflits: 0, lots: 8 });
  assert.equal(livree.prepare('SELECT count(*) AS n FROM metier_bonus WHERE metier_id = ? AND rang = 9').get(FORGERON.id).n, 0);
  livree.exec('DELETE FROM modification; DELETE FROM modification_lot');
  livree.exec('COMMIT');
  livree.exec('BEGIN');
  chargerJournal(livree, journal);
  assert.deepEqual(rejouer(livree), { appliquees: 0, integrees: 8, conflits: 0, lots: 8 });
  livree.exec('COMMIT');
  assert.deepEqual({ ...livree.prepare('SELECT description, equipement_brut FROM metier WHERE id = ?').get(FORGERON.id) }, { description: 'D2', equipement_brut: 'Enclume' });
  livree.close();
});

test('rejouer : une insertion dont le parent a disparu des règles rompt une clé étrangère : conflit', () => {
  const { chemin } = vivante();
  lot(chemin, 'L1', (w) =>
    w.inserer('metier_bonus', { metier_id: FORGERON.id, rang: 9, option: 1, texte: 'X', valeur: null, unite: null, cible: null, cible_cle: null, origine: 'docs_typees', source_ref: 'Site de dev' }));
  const db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  db.exec("DELETE FROM metier_bonus WHERE metier_id = 'metiers/forgeron' AND rang = 9; DELETE FROM metier_bonus WHERE metier_id = 'metiers/forgeron'; DELETE FROM metier_recette_famille WHERE metier_id = 'metiers/forgeron'; DELETE FROM metier WHERE id = 'metiers/forgeron'");
  const bilan = rejouer(db);
  db.exec('COMMIT');
  assert.deepEqual(bilan, { appliquees: 0, integrees: 0, conflits: 1, lots: 1 });
  assert.match(db.prepare('SELECT detail FROM modification').get().detail, /clé étrangère rompue vers metier/);
  db.close();
});

test('rejouer : une ligne créée puis supprimée par le journal mais que les règles ont déjà (livrée) n’est pas « fantôme » : la référence des règles rompue par sa suppression est un conflit', () => {
  const { chemin } = vivante();
  const PAGE = { id: 'lore/essai-journal-livree', type: 'lore', slug: 'essai-journal-livree', titre: 'Essai journal livrée', titre_cle: 'essai-journal-livree', resume: null, donnees: null, corps_md: 'Texte.', statut: 'draft', origine: 'docs', source_ref: null };
  lot(chemin, 'L1', (w) => w.inserer('page', PAGE));
  lot(chemin, 'L2', (w) => w.supprimer('page', { id: PAGE.id }), '2026-10-10T12:01:00Z');
  const source = new DatabaseSync(chemin, { readOnly: true });
  const journal = journalExporte(source);
  source.close();
  // les règles ont la page (livrée avec la création), et un bloc de la chronologie la cite depuis
  const colonnes = Object.keys(PAGE);
  const valeurs = colonnes.map((c) => (PAGE[c] === null ? 'NULL' : `'${PAGE[c]}'`)).join(', ');
  const db = new DatabaseSync(regles(`INSERT INTO page (${colonnes.join(', ')}) VALUES (${valeurs});
    UPDATE evenement_extrait SET page_id = '${PAGE.id}', section = NULL WHERE (evenement_id, rang) = (SELECT evenement_id, rang FROM evenement_extrait ORDER BY evenement_id, rang LIMIT 1);`));
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  chargerJournal(db, journal);
  const bilan = rejouer(db);
  db.exec('COMMIT');
  assert.deepEqual(bilan, { appliquees: 0, integrees: 1, conflits: 1, lots: 2 });
  assert.match(db.prepare("SELECT detail FROM modification WHERE etat = 'conflit'").get().detail, /evenement_extrait : clé étrangère rompue vers page/);
  assert.ok(db.prepare('SELECT 1 FROM page WHERE id = ?').get(PAGE.id), 'la page des règles reste');
  db.close();
});

test('journal exporté puis rechargé ailleurs : mêmes lots, prêts à être rejoués', () => {
  const { chemin } = vivante();
  lot(chemin, 'L1', (w) => w.modifier('metier', FORGERON, { description: 'Exportée.' }));
  const db = new DatabaseSync(chemin, { readOnly: true });
  const journal = journalExporte(db);
  db.close();
  assert.equal(journal.format, 'maverick-edition/1');
  assert.equal(journal.lots.length, 1);
  assert.deepEqual(journal.lots[0].modifications[0].apres, { description: 'Exportée.' });

  const autre = new DatabaseSync(regles());
  autre.exec('BEGIN');
  assert.equal(chargerJournal(autre, journal), 1);
  assert.deepEqual(rejouer(autre), { appliquees: 1, integrees: 0, conflits: 0, lots: 1 });
  autre.exec('COMMIT');
  assert.equal(autre.prepare('SELECT description FROM metier WHERE id = ?').get(FORGERON.id).description, 'Exportée.');
  assert.throws(() => chargerJournal(autre, { format: 'autre' }), /maverick-edition\/1/);
  autre.close();
});
