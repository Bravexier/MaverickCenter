// Rapatriement des modifications du site de dev dans data/rows (npm run db:appliquer-edition, scripts/db-appliquer-edition.mjs) : le journal téléchargé
// sur le site de dev, rejoué sur une copie de data/rows, en change exactement les lignes modifiées (même format d'export que les importeurs), verse les
// modifications dans historique_modification (version NULL : rapatriées à la main), laisse vides les tables du journal, ne réécrit rien en cas de
// conflit et ne change plus rien la seconde fois. Les données d'essai ne dépendent d'aucun texte importé : un nom de race absent de la base, un bonus
// différent de celui en place, un conflit fabriqué sur la valeur en place.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { normalize } from '../src/lib/text.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'maverick-rapatriement-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const rows = join(tmp, 'data', 'rows');
cpSync(join(RACINE, 'data', 'rows'), rows, { recursive: true });
const lire = (dossier) => Object.fromEntries(readdirSync(dossier).map((f) => [f, readFileSync(join(dossier, f), 'utf8')]));
const avant = lire(rows);

// des modifications faites sur le site de dev (base vivante), puis le journal tel que /api/edition/journal/ le donne
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(tmp, 'db') });
const vivante = ouvrirBaseVivante(chemin);
const bonusEnPlace = vivante.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut;
const bonus = bonusEnPlace === '+4% Arme lourde' ? '+5% Arme lourde' : '+4% Arme lourde';
// un nom de race que ni une race ni une page n'ont déjà (le site a pu en créer)
const libre = (nom) => !vivante.prepare('SELECT 1 FROM race WHERE nom = ? OR id = ? UNION ALL SELECT 1 FROM page WHERE id = ?').get(nom, `races/${normalize(nom)}`, `races/${normalize(nom)}`);
let nomRace = 'Race d’essai du rapatriement';
// identifiants de lot propres au test (le service tire des UUID) : jamais ceux d'un lot déjà dans historique_modification
const LOT_1 = 'essai-rapatriement-1';
const LOT_2 = 'essai-rapatriement-2';
for (let i = 2; !libre(nomRace); i += 1) nomRace = `Race d’essai du rapatriement ${i}`;
enregistrer(vivante, { page: 'metiers/', operations: [{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' }, valeurs: { bonus_brut: bonus } }] }, { instant: '2026-10-10T10:00:00Z', id: LOT_1 });
const { crees } = enregistrer(vivante, { page: 'races/', operations: [{ op: 'creer', entite: 'race', valeurs: { nom: nomRace, nature: 'hybride' } }] }, { instant: '2026-10-10T10:05:00Z', id: LOT_2 });
const idRace = crees.find((c) => c.entite === 'race').id;
const journal = journalExporte(vivante);
const nbModifications = journal.lots.reduce((n, l) => n + l.modifications.length, 0);
vivante.close();

const construire = (dossier) => {
  const sortie = join(tmp, `verif-${Math.random().toString(36).slice(2)}.db`);
  const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', dossier], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { db: new DatabaseSync(sortie), sortie };
};
const historiqueAvant = (() => {
  const { db } = construire(rows);
  const n = db.prepare('SELECT count(*) AS n FROM historique_modification').get().n;
  db.close();
  return n;
})();

test('le journal rejoué réécrit data/rows : lignes modifiées et créées, historique_modification, tables du journal vides, le reste à l’octet près', () => {
  const r = appliquerJournal(journal, { rows });
  assert.equal(r.ecrit, true);
  assert.deepEqual(r.conflits, []);
  assert.equal(r.bilan.lots, 2);
  assert.equal(r.bilan.conflits, 0);
  assert.equal(r.historisees, nbModifications);
  const apres = lire(rows);
  const changes = Object.keys(avant).filter((f) => avant[f] !== apres[f]).sort();
  for (const f of ['metier.sql', 'metier_bonus.sql', 'race.sql', 'page.sql', 'historique_modification.sql']) assert.ok(changes.includes(f), `${f} : ${changes.join(', ')}`);
  assert.ok(!changes.includes('modification.sql') && !changes.includes('modification_lot.sql') && !changes.includes('VERSION'), changes.join(', '));
  assert.ok(!changes.includes('sort.sql') && !changes.includes('classe.sql'), 'les tables non touchées ne changent pas');
  const { db } = construire(rows);
  assert.equal(db.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut, bonus);
  assert.equal(db.prepare('SELECT nom FROM race WHERE id = ?').get(idRace).nom, nomRace);
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification_lot').get().n, 0);
  // l'historique : chaque modification du journal, dans l'ordre, version NULL ; avant / après tels que le site les a notés
  const historique = db.prepare("SELECT * FROM historique_modification WHERE lot_id IN (?, ?) ORDER BY fait_le, lot_id, rang").all(LOT_1, LOT_2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM historique_modification').get().n, historiqueAvant + nbModifications);
  assert.deepEqual(historique.map((h) => `${h.lot_id}#${h.rang}`), journal.lots.flatMap((l) => l.modifications.map((m) => `${l.id}#${m.rang}`)));
  assert.ok(historique.every((h) => h.version === null));
  const forgeron = historique.find((h) => h.table_nom === 'metier' && h.lot_id === LOT_1);
  assert.deepEqual([forgeron.operation, JSON.parse(forgeron.cle), JSON.parse(forgeron.avant), JSON.parse(forgeron.apres)],
    ['modifier', { id: 'metiers/forgeron' }, { bonus_brut: bonusEnPlace }, { bonus_brut: bonus }]);
  const race = historique.find((h) => h.table_nom === 'race');
  assert.deepEqual([race.lot_id, race.operation, JSON.parse(race.cle), race.avant], [LOT_2, 'inserer', { id: idRace }, null]);
  assert.equal(historique[0].resume, journal.lots[0].resume);
  db.close();
});

test('une seconde fois : tout est déjà présent (« intégré ») et déjà dans l’historique, data/rows ne change plus', () => {
  const une = lire(rows);
  const r = appliquerJournal(journal, { rows });
  assert.equal(r.bilan.appliquees, 0);
  assert.ok(r.bilan.integrees > 0);
  assert.equal(r.historisees, 0, 'un lot déjà dans l’historique n’est pas repris');
  assert.deepEqual(lire(rows), une);
});

test('conflit (data/rows a changé autrement depuis) : rien n’est écrit, sauf --ignorer-conflits qui écrit (et historise) les autres lots', () => {
  const dossier = join(tmp, 'conflit', 'data', 'rows');
  cpSync(join(RACINE, 'data', 'rows'), dossier, { recursive: true });
  // le bonus du Forgeron change dans data/rows (base reconstruite, ligne modifiée, réexportée par l'exporteur des importeurs)
  const { db: copie, sortie } = construire(dossier);
  copie.prepare("UPDATE metier SET bonus_brut = bonus_brut || ' (autre)' WHERE id = 'metiers/forgeron'").run();
  const bonusChange = copie.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut;
  copie.close();
  const exp = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), sortie, '--rows', dossier], { encoding: 'utf8' });
  assert.equal(exp.status, 0, exp.stderr);
  const avantConflit = lire(dossier);
  const r = appliquerJournal(journal, { rows: dossier });
  assert.equal(r.ecrit, false);
  assert.equal(r.conflits.length, 1);
  assert.equal(r.conflits[0].lot, LOT_1);
  assert.match(r.conflits[0].detail, /bonus_brut/);
  assert.deepEqual(lire(dossier), avantConflit);
  const force = appliquerJournal(journal, { rows: dossier, ignorerConflits: true });
  assert.equal(force.ecrit, true);
  const { db } = construire(dossier);
  assert.equal(db.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut, bonusChange, 'le lot en conflit est écarté');
  assert.equal(db.prepare('SELECT count(*) AS n FROM race WHERE id = ?').get(idRace).n, 1, 'les autres lots sont écrits');
  assert.deepEqual(db.prepare("SELECT DISTINCT lot_id FROM historique_modification WHERE lot_id IN (?, ?)").all(LOT_1, LOT_2).map((h) => h.lot_id), [LOT_2],
    'seul le lot écrit est historisé');
  db.close();
});
