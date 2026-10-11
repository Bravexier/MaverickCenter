// Décision R31 (docs/decisions-regles.md) : pour les 14 races dont l'onglet cite les magies innées dans la phrase « Inconvénient(s) », la liste
// (race_magie_onglet, cases à cocher du site de dev) fait foi ; la phrase redevient un texte libre. Modifier l'une sans l'autre depuis le site ne doit
// plus faire échouer tools/db/races_onglet.py --verifier (donc la mise à jour) ; une race que le site n'a pas touchée reste contrôlée comme à l'import.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const tmp = mkdtempSync(join(tmpdir(), 'maverick-r31-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const verifier = (rows) => spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'races_onglet.py'), '--verifier', '--rows', rows], { encoding: 'utf8', cwd: RACINE });

test('R31 : liste changée sans la phrase, phrase réécrite sans la liste (même illisible) : races_onglet.py --verifier passe après rapatriement', { skip: sansPython }, () => {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(tmp, 'db') }).chemin);
  const service = { base: () => db, etat: () => ({}), journal: () => {}, edition: true };
  const enregistrer = (operations) => traiter({
    methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'races/', operations }),
  }, service);
  const liste = (race) => db.prepare('SELECT magie_id FROM race_magie_onglet WHERE race_id = ? ORDER BY rang').all(race).map((l) => l.magie_id);
  const phrase = (race) => db.prepare('SELECT inconvenients FROM race_onglet WHERE race_id = ?').get(race).inconvenients;
  // l'Orios perd une magie de sa liste, sa phrase reste (elle cite toujours la magie retirée)
  const orios = liste('races/orios');
  assert.ok(orios.length >= 2, 'l’Orios a une liste d’onglet');
  const oriosPhrase = phrase('races/orios');
  let r = enregistrer([{ op: 'magies_innees', race: 'races/orios', magies: orios.slice(0, -1) }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(phrase('races/orios'), oriosPhrase);
  // l'Anansi garde sa liste, sa phrase ne cite plus aucune magie lisible (« Magie du Bois » n'existe pas)
  const anansi = liste('races/anansi');
  r = enregistrer([{ op: 'modifier', table: 'race_onglet', cle: { race_id: 'races/anansi' }, valeurs: { inconvenients: 'Magie du Bois en innée, et rien d’autre.' } }]);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(liste('races/anansi'), anansi, 'la liste ne suit pas la phrase : elle fait foi');
  const journal = journalExporte(db);
  db.close();

  const rows = join(tmp, 'rows');
  cpSync(join(RACINE, 'data', 'rows'), rows, { recursive: true });
  const a = appliquerJournal(journal, { rows });
  assert.equal(a.ecrit, true, JSON.stringify(a.conflits));
  const v = verifier(rows);
  assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.match(v.stdout, /conformes aux pages/);

  // une race que le site n'a pas touchée reste contrôlée comme à l'import : sa liste modifiée hors du site est un écart
  const fichier = join(rows, 'race_magie_onglet.sql');
  const lignes = readFileSync(fichier, 'utf8').split('\n');
  const kitsune = lignes.findIndex((l) => l.includes("VALUES ('races/kitsune'"));
  assert.ok(kitsune > 0, 'le Kitsune a une liste d’onglet');
  writeFileSync(fichier, lignes.filter((_, i) => i !== kitsune).join('\n'));
  const ecart = verifier(rows);
  assert.equal(ecart.status, 1, ecart.stdout + ecart.stderr);
  assert.match(ecart.stdout, /race_magie_onglet : /);
});
