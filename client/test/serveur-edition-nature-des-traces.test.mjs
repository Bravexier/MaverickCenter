// Nature de chaque trace (migration 0127, lot 6 du chantier de la base de dev, R274, R275 ; docs/serveur.md, « Nature de chaque trace ») : le journal
// écrit `saisie` pour une saisie du site, la nature du LOT suit chaque ligne de l'historique (historiser), le journal exporté porte `nature` et
// `decision`, un journal téléchargé avant la 0127 (sans eux) vaut `saisie`, et la résolution d'un conflit garde la nature du lot qu'elle reprend.
//   node --test test/serveur-edition-nature-des-traces.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { conflitsDuJournal, lotsEnConflit, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { ErreurJournal, chargerJournal, journalExporte, ouvrirLot } from '../serveur/edition-journal.mjs';
import { historiser } from '../serveur/historique.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const racine = dossierTemporaire('nature-des-traces');
const ouvertes = [];
after(() => {
  for (const b of ouvertes) if (b.isOpen) b.close();
});
let compteur = 0;
const chemin = (nom) => join(racine, `${nom}-${(compteur += 1)}`);

/** Une base neuve (data/schema.sql, vide). */
function baseNeuve() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  ouvertes.push(db);
  return db;
}
const INSTANT = '2026-11-14T10:00:00Z';
/** Un lot du site (par `ouvrirLot`) qui crée une catégorie de mot-clé ; ces tables n'ont aucune valeur de règle en jeu. */
function saisie(db, id, categorie) {
  db.exec('BEGIN');
  const lot = ouvrirLot(db, { id, instant: INSTANT });
  lot.inserer('categorie_mot_cle', { id: categorie, libelle: `Essai ${categorie}`, libelle_cle: `essai-${categorie}` });
  lot.terminer(`lot ${id}`);
  db.exec('COMMIT');
}
let compteurDeCategories = 0;
/** Un lot d'une autre nature, posé comme le ferait le service d'un lot de changements (la suite du chantier) : deux modifications. */
function autreLot(db, id, nature, decision, instant) {
  db.prepare('INSERT INTO modification_lot (id, fait_le, resume, nature, decision) VALUES (?, ?, ?, ?, ?)').run(id, instant, `lot ${id}`, nature, decision);
  const noter = db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, ?, 'categorie_mot_cle', ?, 'inserer', NULL, ?, 'en_attente')");
  for (const rang of [1, 2]) {
    const n = 100 + (compteurDeCategories += 1);
    noter.run(id, rang, JSON.stringify({ id: n }), JSON.stringify({ id: n, libelle: `Autre ${n}`, libelle_cle: `autre-${n}` }));
  }
}
const lots = (db) => db.prepare('SELECT id, nature, decision FROM modification_lot ORDER BY id').all().map((l) => ({ ...l }));
const historique = (db) => db.prepare('SELECT lot_id, rang, nature, decision FROM historique_modification ORDER BY lot_id, rang').all().map((h) => ({ ...h }));

test('une saisie du site : le lot est écrit « saisie », sans numéro de décision', () => {
  const db = baseNeuve();
  saisie(db, 'L1', 1);
  assert.deepEqual(lots(db), [{ id: 'L1', nature: 'saisie', decision: null }]);
});

test('historiser : chaque ligne de l’historique reprend la nature et le numéro de décision de son lot', () => {
  const db = baseNeuve();
  saisie(db, 'A-saisie', 1);
  autreLot(db, 'B-decision', 'decision', 'R275', '2026-11-14T10:01:00Z');
  autreLot(db, 'C-migration', 'migration', null, '2026-11-14T10:02:00Z');
  autreLot(db, 'D-code', 'code', null, '2026-11-14T10:03:00Z');
  autreLot(db, 'E-source', 'source', null, '2026-11-14T10:04:00Z');
  const n = historiser(db);
  assert.equal(n, 1 + 2 * 4);
  const parLot = Object.groupBy(historique(db), (h) => h.lot_id);
  const attendu = { 'A-saisie': ['saisie', null], 'B-decision': ['decision', 'R275'], 'C-migration': ['migration', null], 'D-code': ['code', null], 'E-source': ['source', null] };
  assert.deepEqual(Object.keys(parLot).sort(), Object.keys(attendu).sort());
  for (const [lot, [nature, decision]] of Object.entries(attendu)) {
    assert.ok(parLot[lot].length >= 1, lot);
    for (const h of parLot[lot]) assert.deepEqual([h.nature, h.decision], [nature, decision], `${lot} rang ${h.rang}`);
  }
});

test('journal exporté : chaque lot porte nature et decision ; un journal rechargé les rend à l’identique (format du téléchargement, JSON)', () => {
  const db = baseNeuve();
  saisie(db, 'A-saisie', 1);
  autreLot(db, 'B-decision', 'decision', 'R275', '2026-11-14T10:01:00Z');
  autreLot(db, 'C-code', 'code', null, '2026-11-14T10:02:00Z');
  const exporte = JSON.parse(JSON.stringify(journalExporte(db)));
  for (const l of exporte.lots) assert.ok('nature' in l && 'decision' in l, l.id);
  assert.deepEqual(exporte.lots.map((l) => [l.id, l.nature, l.decision]), [['A-saisie', 'saisie', null], ['B-decision', 'decision', 'R275'], ['C-code', 'code', null]]);
  const autre = baseNeuve();
  chargerJournal(autre, exporte);
  assert.deepEqual(lots(autre), lots(db));
});

test('un journal téléchargé avant la 0127, sans nature ni decision, vaut « saisie » (compatibilité)', () => {
  const db = baseNeuve();
  saisie(db, 'A', 1);
  const ancien = JSON.parse(JSON.stringify(journalExporte(db)));
  for (const l of ancien.lots) {
    delete l.nature;
    delete l.decision;
  }
  const autre = baseNeuve();
  chargerJournal(autre, ancien);
  assert.deepEqual(lots(autre), [{ id: 'A', nature: 'saisie', decision: null }]);
  historiser(autre);
  assert.deepEqual(historique(autre).map((h) => [h.nature, h.decision]), [['saisie', null]]);
});

test('un journal dont la nature est inconnue, ou le numéro de décision mal placé, est refusé en nommant le lot', () => {
  const db = baseNeuve();
  saisie(db, 'A', 1);
  const base = JSON.parse(JSON.stringify(journalExporte(db)));
  const avec = (champs) => ({ ...base, lots: base.lots.map((l) => ({ ...l, ...champs })) });
  const cas = [
    { nature: 'import' },
    { nature: 'decision' },
    { nature: 'decision', decision: 'R27x' },
    { nature: 'decision', decision: 'r275' },
    { nature: 'saisie', decision: 'R275' },
    { nature: 'code', decision: 'R275' },
  ];
  for (const champs of cas) {
    const autre = baseNeuve();
    assert.throws(() => chargerJournal(autre, avec(champs)), (e) => e instanceof ErreurJournal && e.message.includes('lot A'), JSON.stringify(champs));
    assert.deepEqual(lots(autre), [], 'rien n’est écrit');
  }
});

// ---- la résolution d'un conflit (une base vivante : les règles d'import, puis une livraison qui change le même passage) ----

const METIER = 'metiers/forgeron'; // par son id (état d'import) ; les textes sont ceux du test
const PARAGRAPHES = ['Premier paragraphe (essai).', 'Deuxième paragraphe (essai).', 'Troisième paragraphe (essai).'];
const texte = (p) => p.join('\n\n');
const DU_SITE = texte(['Premier paragraphe du site (essai).', ...PARAGRAPHES.slice(1)]);
const DU_CODE = texte(['Premier paragraphe du code (essai).', ...PARAGRAPHES.slice(1)]);

function regles(description) {
  const f = `${chemin('regles')}.db`;
  copyFileSync(cheminDImport(), f);
  const db = new DatabaseSync(f);
  db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(description, METIER);
  db.close();
  return f;
}
const ouvrir = (dossier) => {
  const db = ouvrirBaseVivante(join(dossier, FICHIER_BASE));
  ouvertes.push(db);
  return db;
};
/** Une base vivante où le site a changé la description du métier, puis une livraison du code qui change le même passage : un lot gardé, en conflit. */
function leLotGarde(natureDuLot, decision) {
  const dossier = chemin('vivante');
  preparerBaseVivante({ regles: regles(texte(PARAGRAPHES)), dossier });
  const db = ouvrir(dossier);
  const { lot } = enregistrer(db, { page: METIER, operations: [{ op: 'modifier', table: 'metier', cle: { id: METIER }, valeurs: { description: DU_SITE } }] });
  if (natureDuLot !== 'saisie') db.prepare('UPDATE modification_lot SET nature = ?, decision = ? WHERE id = ?').run(natureDuLot, decision, lot);
  db.close();
  preparerBaseVivante({ regles: regles(DU_CODE), dossier });
  return { dossier, lot };
}
const natureDe = (db, id) => ({ ...db.prepare('SELECT nature, decision FROM modification_lot WHERE id = ?').get(id) });

test('la reconstruction de la base vivante garde la nature et le numéro de décision des lots', () => {
  const { dossier, lot } = leLotGarde('decision', 'R275');
  const db = ouvrir(dossier);
  assert.deepEqual(natureDe(db, lot), { nature: 'decision', decision: 'R275' });
  assert.deepEqual(lotsEnConflit(db).map((l) => l.id), [lot], 'le lot est bien gardé en conflit');
});

test('résolution d’un conflit : la reprise et le nouveau lot d’une saisie restent des « saisie »', () => {
  for (const choix of [1, 3]) {
    const { dossier, lot } = leLotGarde('saisie', null);
    const db = ouvrir(dossier);
    const d = conflitsDuJournal(db).lots.find((l) => l.lot === lot);
    const [c] = d.conflits;
    const r = resoudreLeConflit(db, { lot, empreinte: d.empreinte, choix: { [c.id]: { choix, ...(choix === 3 ? { valeur: 'Valeur saisie (essai).' } : {}) } } });
    assert.deepEqual(natureDe(db, r.reprise), { nature: 'saisie', decision: null }, `choix ${choix} : reprise`);
    if (choix === 3) assert.deepEqual(natureDe(db, r.nouveau_lot), { nature: 'saisie', decision: null }, 'le lot de la valeur saisie');
  }
});

test('résolution d’un conflit : le choix 2 d’un lot gardé, et le choix 3 sur un lot « decision », écrivent un nouveau lot « saisie » (la reprise garde la nature du lot repris)', () => {
  for (const [choix, nature, decision] of [[2, 'saisie', null], [2, 'decision', 'R275'], [3, 'decision', 'R275']]) {
    const { dossier, lot } = leLotGarde(nature, decision);
    const db = ouvrir(dossier);
    const d = conflitsDuJournal(db).lots.find((l) => l.lot === lot);
    const r = resoudreLeConflit(db, { lot, empreinte: d.empreinte, choix: { [d.conflits[0].id]: { choix, ...(choix === 3 ? { valeur: 'Valeur saisie (essai).' } : {}) } } });
    const cas = `choix ${choix}, lot ${nature}`;
    assert.ok(r.nouveau_lot, `${cas} : un lot à eux`);
    assert.deepEqual(natureDe(db, r.nouveau_lot), { nature: 'saisie', decision: null }, `${cas} : le nouveau lot`);
    assert.deepEqual(natureDe(db, r.reprise), { nature, decision }, `${cas} : la reprise`);
  }
});

test('résolution d’un conflit : la reprise garde la nature et le numéro de décision du lot qu’elle reprend', () => {
  const { dossier, lot } = leLotGarde('decision', 'R275');
  const db = ouvrir(dossier);
  const d = conflitsDuJournal(db).lots.find((l) => l.lot === lot);
  const r = resoudreLeConflit(db, { lot, empreinte: d.empreinte, choix: { [d.conflits[0].id]: { choix: 1 } } });
  assert.deepEqual(natureDe(db, r.reprise), { nature: 'decision', decision: 'R275' });
  const exporte = journalExporte(db).lots.find((l) => l.id === r.reprise);
  assert.deepEqual([exporte.nature, exporte.decision], ['decision', 'R275']);
});
