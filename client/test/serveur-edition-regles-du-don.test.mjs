// Un don qui porte une règle en données (la magie d'un don « Variable », R181 ; le plafond de NPM, R188 ; la condition d'emplacements de sorts, R189)
// se supprime sur le site de dev, et ses règles partent avec lui, notées au journal avant lui (réponse du propriétaire : « Autoriser et journaliser » ;
// serveur/edition.mjs#retirerLesReglesDuDon). Avant, la cascade du schéma les retirait hors du journal, et la mise à jour refusait le lot (code 4 :
// fichier hors des tables du lot). Ici : la liste des tables contre le schéma, le journal du service, la mise à jour (lot noté ainsi, et lot noté
// avant : la cascade est permise), et le diagnostic d'une règle que les règles livrées ont changée depuis : elle n'a pas de choix à elle, elle suit
// celui du don (serveur/edition-conflits.mjs#suiventLeDon ; jamais une règle sans son don ni l'inverse). Dons choisis dans l'état d'import, par id
// (le site de dev change le type d'un don, et quitter « Variable » retire sa ligne de capacite_variable, R192 ; il supprime un don) : la base et la copie
// de data/rows du scénario les reçoivent de l'import si le site les a retirés (patron : serveur-edition-conflits.test.mjs#remettreDepuisLImport).
//   node --test test/serveur-edition-regles-du-don.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerMiseAJour } from '../scripts/mise-a-jour-regles.mjs';
import { TABLES_DES_REGLES_DU_DON as RECOPIE, tablesDuLot } from '../scripts/mise-a-jour-github.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal, TABLES_DES_REGLES_DU_DON } from '../serveur/edition.mjs';
import { examinerLeLot, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { TABLES_DES_SOURCES } from '../serveur/edition-maitrises.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { baseDImport, remettreDepuisLImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { copieSansNoteEnAttente, ROWS, versionALaRevision } from './aide-mise-a-jour.mjs';

const sansOutils = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const dossier = dossierTemporaire('regles-du-don');
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Pour chaque table de règles, le premier don de l'import qui en porte une ligne et qui se supprime d'ici (ni don de spécialité) : choix stable, par id.
 * { table: id }.
 */
const DONS = (() => {
  const dImport = baseDImport();
  return Object.fromEntries(TABLES_DES_REGLES_DU_DON.map((t) => [t, dImport.prepare(`SELECT x.capacite_id AS id FROM "${t}" x JOIN capacite c
    ON c.id = x.capacite_id WHERE c.nature <> 'specialite' ORDER BY x.capacite_id LIMIT 1`).get()?.id]));
})();

/**
 * Remet dans `db` (ouverte en écriture) le don de chaque table et sa ligne de règle, tels qu'à l'import, si le site de dev les a retirés : le don supprimé
 * revient, la ligne de règle aussi, et le don reprend son type d'import (un don « Variable » ⇔ sa ligne de capacite_variable, R192). Rend le nombre de
 * lignes remises ou corrigées.
 */
function remettreLesDonsDImport(db) {
  const dImport = baseDImport();
  let n = 0;
  // la ligne, et ce qu'elle cite (la page du don, sa spécialité…) si le site de dev l'a supprimé avec elle (test/aide-base-d-import.mjs)
  const remettre = (table, cle) => {
    const remises = remettreDepuisLImport(db, table, cle, { enfants: false, dImport });
    n += remises;
    return remises > 0;
  };
  db.exec('PRAGMA foreign_keys = ON');
  for (const [table, id] of Object.entries(DONS)) {
    remettre('capacite', { id });
    for (const ligne of dImport.prepare(`SELECT * FROM "${table}" WHERE capacite_id = ?`).all(id)) {
      const cle = db.prepare(`SELECT name FROM pragma_table_info(?) WHERE pk > 0 ORDER BY pk`).all(table).map((c) => c.name);
      if (!remettre(table, Object.fromEntries(cle.map((c) => [c, ligne[c]])))) continue;
      const type = dImport.prepare('SELECT type FROM capacite WHERE id = ?').get(id).type;
      n += db.prepare('UPDATE capacite SET type = ? WHERE id = ? AND type IS NOT ?').run(type, id, type).changes;
    }
  }
  return n;
}

// les règles du scénario (base vivante) et la copie de data/rows que la mise à jour réécrit : l'état courant, les dons de DONS remis s'il le faut
const REGLES = join(dossier, 'regles.db');
copyFileSync(cheminBase({ sansExemples: false }), REGLES);
const RECUES = (() => {
  const db = new DatabaseSync(REGLES);
  try {
    if (!remettreLesDonsDImport(db)) return ROWS;
  } finally {
    db.close();
  }
  const rows = join(dossier, 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const base = join(dossier, 'rows.db');
  const b = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', base, '--rows', rows], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr || b.stdout);
  const db2 = new DatabaseSync(base);
  try {
    remettreLesDonsDImport(db2);
  } finally {
    db2.close();
  }
  const e = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), base, '--rows', rows], { encoding: 'utf8' });
  assert.equal(e.status, 0, e.stderr || e.stdout);
  return rows;
})();

let n = 0;
const vivante = () => ouvrirBaseVivante(preparerBaseVivante({ regles: REGLES, dossier: join(dossier, `b${(n += 1)}`) }).chemin);
const enregistrer = (base, operations) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
  corps: JSON.stringify({ page: 'classes/', operations }) }, { base: () => base, etat: () => ({}), edition: true });

/** Pour chaque table de règles, son don (DONS), présent dans `db` avec sa ligne de règle. */
const donsAvecRegle = (db) => Object.entries(DONS).filter(([t, id]) => id && db.prepare(`SELECT 1 FROM "${t}" WHERE capacite_id = ?`).get(id)).map(([, id]) => id);

test('TABLES_DES_REGLES_DU_DON : les tables qui citent un don en ON DELETE CASCADE, hors des sources de maîtrise d’arme ; la mise à jour GitHub en a la copie', () => {
  const db = vivante();
  try {
    const cascades = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((t) => t.name)
      .filter((t) => db.prepare('SELECT * FROM pragma_foreign_key_list(?)').all(t).some((f) => f.table === 'capacite' && f.on_delete === 'CASCADE'));
    assert.deepEqual([...TABLES_DES_REGLES_DU_DON].sort(), cascades.filter((t) => !TABLES_DES_SOURCES.includes(t)));
    for (const t of TABLES_DES_REGLES_DU_DON) assert.ok(db.prepare('SELECT 1 FROM pragma_table_info(?) WHERE name = ?').get(t, 'capacite_id'), t);
  } finally {
    db.close();
  }
  assert.deepEqual(RECOPIE, TABLES_DES_REGLES_DU_DON);
  const lot = (operation) => ({ journal: { lots: [{ modifications: [{ table: 'capacite', operation, cle: { id: 'x' } }] }] } });
  for (const t of TABLES_DES_REGLES_DU_DON) assert.ok(tablesDuLot(lot('supprimer')).includes(t), t);
  assert.ok(!tablesDuLot(lot('modifier')).includes('capacite_variable'));
});

test('don supprimé : ses règles en données partent, notées au journal avant lui ; la mise à jour passe (lot noté ainsi, et lot noté avant ce choix)', { skip: sansOutils }, () => {
  const db = vivante();
  let journal;
  try {
    const dons = donsAvecRegle(db);
    assert.equal(dons.length, TABLES_DES_REGLES_DU_DON.length, 'un don par table de règles');
    const regles = (id) => TABLES_DES_REGLES_DU_DON.filter((t) => db.prepare(`SELECT 1 FROM "${t}" WHERE capacite_id = ?`).get(id));
    const avant = new Map(dons.map((id) => [id, regles(id)]));
    const r = enregistrer(db, dons.map((id) => ({ op: 'supprimer', entite: 'capacite', cle: { id } })));
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    for (const id of dons) {
      assert.deepEqual(regles(id), [], id);
      const notes = db.prepare('SELECT rang, table_nom FROM modification WHERE cle = ? AND operation = ? ORDER BY rang')
        .all(JSON.stringify({ capacite_id: id }), 'supprimer').map((m) => ({ ...m }));
      assert.deepEqual(notes.map((m) => m.table_nom).sort(), [...avant.get(id)].sort(), `${id} : chaque règle notée`);
      const don = db.prepare("SELECT rang FROM modification WHERE table_nom = 'capacite' AND operation = 'supprimer' AND cle = ?").get(JSON.stringify({ id }));
      assert.ok(notes.every((m) => m.rang < don.rang), `${id} : avant le don`);
    }
    journal = journalExporte(db);
  } finally {
    db.close();
  }
  // la version de dev, comme le workflow (package.json, tenue par le bot : jamais écrite ici)
  const versionDev = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const appliquer = (nom, j) => {
    const rows = copieSansNoteEnAttente(join(dossier, nom), { rows: RECUES, versionProduction: versionALaRevision('HEAD') }).rows;
    return appliquerMiseAJour({ format: 'maverick-mise-a-jour/1', id: '11111111-2222-3333-4444-555555555555', cree_le: '2026-11-07T10:00:00Z', version_dev: versionDev,
      version_cible: '0.2', texte: 'Dons retirés.', journal: j }, { rows, reference: 'HEAD', date: '2026-11-07', versionDev });
  };
  const res = appliquer('rows-note', journal);
  for (const t of ['capacite', ...TABLES_DES_REGLES_DU_DON]) assert.ok(res.fichiers.includes(`${t}.sql`), t);
  // un lot noté avant ce choix : la suppression du don seule, ses règles retirées par la cascade du schéma au rejeu (permise, comme page_tag)
  const ancien = { ...journal, lots: journal.lots.map((l) => ({ ...l, modifications: l.modifications.filter((m) => !TABLES_DES_REGLES_DU_DON.includes(m.table)) })) };
  const res2 = appliquer('rows-ancien', ancien);
  for (const t of TABLES_DES_REGLES_DU_DON) assert.ok(res2.fichiers.includes(`${t}.sql`), t);
});

/**
 * Le site de dev supprime un don « Variable » (sa règle, capacite_variable, notée avant lui) ; les règles livrées changent la magie qu'il vise (et
 * son effet si `donChange`) : le lot rejoué est en conflit. La base vivante rejouée, le don et le lot.
 */
function donSupprimeEtRegleChangee({ donChange = false } = {}) {
  const site = vivante();
  let journal;
  let id;
  try {
    id = DONS.capacite_variable;
    assert.ok(site.prepare('SELECT 1 FROM capacite_variable WHERE capacite_id = ?').get(id), `${id} : un don « Variable » et sa ligne`);
    const r = enregistrer(site, [{ op: 'supprimer', entite: 'capacite', cle: { id } }]);
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    journal = journalExporte(site);
  } finally {
    site.close();
  }
  const db = vivante();
  const magie = db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(id).magie;
  db.prepare('UPDATE capacite_variable SET magie = ? WHERE capacite_id = ?').run(magie === 'innee' ? 'acquise' : 'innee', id);
  if (donChange) db.prepare("UPDATE capacite SET effet = effet || ' (règle livrée)' WHERE id = ?").run(id);
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  chargerJournal(db, journal);
  const bilan = rejouerLeJournal(db);
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
  assert.ok(bilan.conflits > 0);
  return { db, id, lot: journal.lots[0].id };
}
const existe = (db, table, cle, v) => db.prepare(`SELECT 1 FROM "${table}" WHERE "${cle}" = ?`).get(v) !== undefined;

test('rejeu et conflits : la règle du don que les règles livrées ont changée n’a pas de choix à elle, elle suit le don ; don supprimé sans conflit, elle part avec lui, notée', () => {
  const { db, id, lot } = donSupprimeEtRegleChangee();
  try {
    assert.ok(existe(db, 'capacite', 'id', id), 'le don reste tant que le lot est en conflit');
    const diag = examinerLeLot(db, lot);
    assert.equal(diag.conflits.find((c) => c.table === 'capacite_variable'), undefined, 'pas de choix pour la règle');
    const suit = diag.saines.find((s) => s.table === 'capacite_variable');
    assert.equal(suit?.issue, 'suit_le_don');
    // nommée par le nom de son don (lu par id dans le journal), jamais par son id
    const nom = JSON.parse(db.prepare("SELECT avant FROM modification WHERE lot_id = ? AND table_nom = 'capacite' AND operation = 'supprimer'").get(lot).avant).nom;
    assert.ok(suit.libelle.endsWith(`« ${nom} »`) && suit.don.endsWith(`« ${nom} »`), JSON.stringify(suit));
    assert.ok(diag.saines.some((s) => s.table === 'capacite' && s.operation === 'supprimer' && s.issue === 'reappliquee'), 'le don part sans conflit');
    const choix = Object.fromEntries(diag.conflits.map((c) => [c.id, { choix: c.choix_possibles.includes(1) ? 1 : 2 }]));
    const res = resoudreLeConflit(db, { lot, empreinte: diag.empreinte, choix });
    assert.ok(res.nouveau_lot);
    assert.ok(!existe(db, 'capacite', 'id', id) && !existe(db, 'capacite_variable', 'capacite_id', id), 'le don et sa règle partis');
    assert.ok(db.prepare("SELECT 1 FROM modification WHERE lot_id = ? AND table_nom = 'capacite_variable' AND operation = 'supprimer'").get(res.nouveau_lot), 'notée');
  } finally {
    db.close();
  }
});

test('rejeu et conflits : don et règle changés par les règles livrées — un seul choix, celui du don ; 1 retire les deux, 2 garde les deux (jamais l’un sans l’autre)', () => {
  for (const n of [1, 2]) {
    const { db, id, lot } = donSupprimeEtRegleChangee({ donChange: true });
    try {
      const diag = examinerLeLot(db, lot);
      const don = diag.conflits.find((c) => c.table === 'capacite' && c.genre === 'suppression');
      assert.ok(don, 'le don en conflit (suppression)');
      assert.deepEqual(don.choix_possibles, [1, 2]);
      assert.equal(diag.conflits.find((c) => c.table === 'capacite_variable'), undefined, 'pas de choix pour la règle');
      const suit = diag.saines.find((s) => s.table === 'capacite_variable');
      assert.equal(suit?.issue, 'suit_le_don');
      // un choix pour la règle est refusé (elle n'est pas un conflit du lot)
      const tous = Object.fromEntries(diag.conflits.map((c) => [c.id, { choix: c.choix_possibles[0] }]));
      assert.throws(() => resoudreLeConflit(db, { lot, empreinte: diag.empreinte, choix: { ...tous, [String(suit.rang)]: { choix: 2 } } }), (e) => e.statut === 400);
      const choix = Object.fromEntries(diag.conflits.map((c) => [c.id, { choix: c === don ? n : (c.choix_possibles.includes(n) ? n : c.choix_possibles[0]) }]));
      resoudreLeConflit(db, { lot, empreinte: diag.empreinte, choix });
      assert.deepEqual([existe(db, 'capacite', 'id', id), existe(db, 'capacite_variable', 'capacite_id', id)], n === 1 ? [false, false] : [true, true], `choix ${n}`);
    } finally {
      db.close();
    }
  }
});
