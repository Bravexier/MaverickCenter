// Édition de la page « Armures » et de son onglet Boucliers depuis le site de dev (serveur/edition-armures.mjs ; demande du propriétaire, 2026-10-15 :
// « Modifiable tout de suite ») : une case modifiée refait ce que la base en tire (prix, AP, AM, résistances et faiblesses d'une armure ; prix, AP, AM
// d'un bouclier ; prix d'une forme ; Force d'un poids ; coût en RF d'une pièce ; coût et effet d'une amélioration, ligne TOTAL) et la ligne du corps
// Markdown de sa page ; le rejeu du journal (livraison) refait le même corps ; les notes de version les rangent sous « Armures et boucliers ». Les tests
// lisent l'état avant d'écrire : les essais du site de dev peuvent avoir modifié ces lignes.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { lireTables } from '../serveur/notes-de-version.mjs';
import { totalDesAmeliorationsDeProtection } from '../src/lib/armure-champs.mjs';
import {
  finDeLigneDArmure, finDeLigneDeBouclier, ligneDAmelioration, ligneDeForme, ligneDePoids, ligneDuTotal, PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS,
} from '../src/lib/corps-armures.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { TABLES } from '../src/lib/edition-modele.mjs';
import { comparerBases } from '../src/lib/notes-de-version.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-armures-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
const db = vivante();
const reference = lireTables(db);
const service = { base: () => db, etat: () => ({}), edition: true };
const enregistrer = (operations) =>
  traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: `${PAGE_DES_ARMURES}/`, operations }) }, service);
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const corps = (id, base = db) => base.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md;
const contient = (id, fin) => corps(id).split('\n').some((l) => l.endsWith(fin));

test('le modèle : armure, pièce, forme, bouclier, poids et amélioration se modifient ; ni création ni suppression', () => {
  for (const t of ['armure', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement']) assert.ok(TABLES[t], t);
  for (const c of ['ap', 'am', 'prix', 'nom_cle']) assert.ok(!(c in TABLES.armure.colonnes), `${c} : tirée, jamais saisie`);
});

test('armure de la grille : défense, résistance, faiblesse et prix refont AP, AM, prix et résistances, et sa ligne du corps', () => {
  const avant = ligne("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre LIMIT 1");
  const valeurs = { stats_brut: '+7AP +3AM', resistance_brut: 'x2 Taille', faiblesse_brut: 'Estoc/Frappe', prix_brut: '1 234' };
  const r = enregistrer([{ op: 'modifier', table: 'armure', cle: { id: avant.id }, valeurs, avant: { stats_brut: avant.stats_brut } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM armure WHERE id = ?', avant.id);
  assert.deepEqual([apres.ap, apres.am, apres.prix], [7, 3, 1234]);
  assert.deepEqual(lignes('SELECT sens, type_degats, multiplicateur FROM armure_degats WHERE armure_id = ? ORDER BY sens, type_degats', avant.id), [
    { sens: 'resistance', type_degats: 'taille', multiplicateur: 2 },
    { sens: 'vulnerabilite', type_degats: 'estoc', multiplicateur: null },
    { sens: 'vulnerabilite', type_degats: 'frappe', multiplicateur: null },
  ]);
  assert.ok(contient(PAGE_DES_ARMURES, finDeLigneDArmure(apres)), 'la ligne du corps suit');
  assert.ok(!contient(PAGE_DES_ARMURES, finDeLigneDArmure(avant)));
});

test('armure : un nom renommé change sa clé ; « ???? » donne un prix inconnu ; type hors liste, résistance d’une armure particulière, effet d’une combinaison, nom sans lettre ni chiffre, prix illisible : refusés', () => {
  const particuliere = ligne("SELECT * FROM armure WHERE sorte = 'particuliere' ORDER BY ordre LIMIT 1");
  const r = enregistrer([{ op: 'modifier', table: 'armure', cle: { id: particuliere.id }, valeurs: { nom: `${particuliere.nom} renommée`, prix_brut: '????', effet: '+1 INI' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const apres = ligne('SELECT * FROM armure WHERE id = ?', particuliere.id);
  assert.equal(apres.prix, null);
  assert.ok(apres.nom_cle.endsWith('-renommee'));
  assert.ok(contient(PAGE_DES_ARMURES, finDeLigneDArmure(apres)));
  const combinaison = ligne("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre DESC LIMIT 1");
  for (const [cle, valeurs] of [
    [particuliere.id, { resistance_brut: 'Taille' }],
    [combinaison.id, { effet: 'Un effet' }],
    [combinaison.id, { type: 'Inconnu' }],
    [combinaison.id, { nom: '—' }],
    [combinaison.id, { prix_brut: '2050 RO' }],
  ]) assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: cle }, valeurs }]).statut, 400, JSON.stringify(valeurs));
  // une case vide : la source ne donne pas le prix
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure', cle: { id: combinaison.id }, valeurs: { prix_brut: '' } }]).statut, 200);
  assert.equal(ligne('SELECT prix FROM armure WHERE id = ?', combinaison.id).prix, null);
});

test('bouclier, forme, poids et pièce : colonnes tirées et lignes du corps ; un prix de bouclier ou de forme, une Force, un coût de pièce illisibles sont refusés', () => {
  const b = ligne('SELECT * FROM bouclier ORDER BY id LIMIT 1');
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs: { prix_brut: '99 RO' } }]).statut, 400);
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier', cle: { id: b.id }, valeurs: { defense_brut: '+9AP +4AM', prix_brut: '99,5' } }]).statut, 200);
  const bApres = ligne('SELECT * FROM bouclier WHERE id = ?', b.id);
  assert.deepEqual([bApres.ap, bApres.am, bApres.prix], [9, 4, 99.5]);
  assert.ok(contient(PAGE_DES_BOUCLIERS, finDeLigneDeBouclier(bApres)));

  const f = ligne('SELECT * FROM bouclier_classe WHERE classe = 2');
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_classe', cle: { id: f.id }, valeurs: { nom: `${f.nom} bis`, prix_brut: '6,5' } }]).statut, 200);
  const fApres = ligne('SELECT * FROM bouclier_classe WHERE id = ?', f.id);
  assert.equal(fApres.prix, 6.5);
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(ligneDeForme(fApres)));
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(`### ${fApres.nom}`), 'le titre du tableau de la forme suit');
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_classe', cle: { id: f.id }, valeurs: { prix_brut: 'cher' } }]).statut, 400);

  const p = ligne('SELECT * FROM bouclier_poids ORDER BY ordre LIMIT 1');
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_poids', cle: { id: p.id }, valeurs: { force_brut: '2 de Force minimum' } }]).statut, 200);
  const pApres = ligne('SELECT * FROM bouclier_poids WHERE id = ?', p.id);
  assert.equal(pApres.force_min, 2);
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(ligneDePoids(pApres)));
  assert.equal(enregistrer([{ op: 'modifier', table: 'bouclier_poids', cle: { id: p.id }, valeurs: { force_brut: 'beaucoup' } }]).statut, 400);

  const piece = ligne("SELECT * FROM armure_emplacement WHERE id = 'casque'");
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure_emplacement', cle: { id: piece.id }, valeurs: { cout_brut: '200 RF / 2 RO' } }]).statut, 200);
  assert.equal(ligne("SELECT cout_rf FROM armure_emplacement WHERE id = 'casque'").cout_rf, 200);
  assert.ok(corps(PAGE_DES_ARMURES).split('\n').includes('| Casque | 200 RF / 2 RO |'));
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure_emplacement', cle: { id: piece.id }, valeurs: { cout_brut: '2 RO' } }]).statut, 400);
  // la ligne du bouclier : « 250 RF / Classe », sans montant fixe
  const ligneDuBouclier = ligne("SELECT * FROM armure_emplacement WHERE id = 'bouclier'");
  assert.equal(enregistrer([{ op: 'modifier', table: 'armure_emplacement', cle: { id: 'bouclier' }, valeurs: { cout_brut: ligneDuBouclier.cout_brut.replace(/^\d+/, '300') } }]).statut, 200);
  assert.equal(ligne("SELECT cout_rf FROM armure_emplacement WHERE id = 'bouclier'").cout_rf, null);
});

test('améliorations d’armure et de bouclier : coût et effet refont RO, matériaux (R76), AP, AM, crans, et la ligne TOTAL de leur tableau', () => {
  const armure = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'armure' AND niveau = 3");
  let r = enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: armure.id }, valeurs: { cout_brut: '350 + 1 Matériau', effet_brut: '+7 AP/AM, +1 cran de solidité' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const aApres = ligne('SELECT * FROM amelioration_equipement WHERE id = ?', armure.id);
  assert.deepEqual([aApres.cout_ro, aApres.cout_materiaux, aApres.bonus_ap, aApres.bonus_am, aApres.bonus_cran], [350, 1, 7, 7, 1]);
  const totalA = totalDesAmeliorationsDeProtection('armure', lignes("SELECT * FROM amelioration_equipement WHERE cible = 'armure'"));
  assert.equal(ligne("SELECT total_brut FROM amelioration_total WHERE cible = 'armure'").total_brut, totalA);
  assert.ok(corps(PAGE_DES_ARMURES).split('\n').includes(ligneDAmelioration(aApres)));
  assert.ok(corps(PAGE_DES_ARMURES).split('\n').includes(ligneDuTotal(totalA)));

  const bouclier = ligne("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' AND niveau = 3");
  r = enregistrer([{ op: 'modifier', table: 'amelioration_equipement', cle: { id: bouclier.id }, valeurs: { effet_brut: '+6 AP + matériaux' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const bApres = ligne('SELECT * FROM amelioration_equipement WHERE id = ?', bouclier.id);
  assert.deepEqual([bApres.cout_materiaux, bApres.bonus_ap, bApres.bonus_am], [1, 6, null], '« + matériaux » : 1 matériau (R76)');
  const totalB = totalDesAmeliorationsDeProtection('bouclier', lignes("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier'"));
  assert.match(totalB, /^\d+$/, 'les RO seuls, comme l’onglet (« 15500 ») : les matériaux sont comptés par la page');
  assert.equal(ligne("SELECT total_brut FROM amelioration_total WHERE cible = 'bouclier'").total_brut, totalB);
  assert.ok(corps(PAGE_DES_BOUCLIERS).split('\n').includes(ligneDuTotal(totalB)));
});

test('notes de version : les modifications des armures et des boucliers sont rangées sous « Armures et boucliers »', () => {
  const lignesDeNote = comparerBases(reference, lireTables(db)).filter((l) => l.domaine === 'armures');
  const tables = new Set(lignesDeNote.map((l) => l.table_nom));
  for (const t of ['armure', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement']) assert.ok(tables.has(t), t);
  assert.ok(lignesDeNote.some((l) => l.groupe === 'Améliorations de bouclier'));
  assert.ok(!comparerBases(reference, lireTables(db)).some((l) => l.domaine === 'armes' && l.table_nom === 'amelioration_equipement'), 'pas sous les armes');
});

test('rejeu du journal (livraison) : les mêmes lignes et les mêmes corps de pages sur des règles neuves', () => {
  const journal = journalExporte(db);
  const neuve = vivante();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const sortie = {};
  rejouerLeJournal(neuve, sortie);
  neuve.exec('COMMIT');
  assert.deepEqual(sortie.illisibles, []);
  for (const id of [PAGE_DES_ARMURES, PAGE_DES_BOUCLIERS]) {
    assert.ok(sortie.pages.includes(id), `${id} refaite`);
    assert.equal(corps(id, neuve), corps(id), id);
  }
  for (const t of ['armure', 'armure_degats', 'armure_emplacement', 'bouclier_classe', 'bouclier', 'bouclier_poids', 'amelioration_equipement', 'amelioration_total']) {
    assert.deepEqual(neuve.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), db.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(), t);
  }
  neuve.close();
});
