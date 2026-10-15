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
  assert.deepEqual(r.conflits, [], 'la race créée (page insérée puis réécrite dans le même lot) n’est pas un conflit');
  assert.equal(r.bilan.appliquees, 0);
  assert.equal(r.bilan.integrees, journal.lots.reduce((n, l) => n + l.modifications.length, 0));
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

test('un journal rapatrié une seconde fois ne remet jamais une valeur annulée (lots déjà dans l’historique : intégrés, pas rejoués)', () => {
  // K1 : Forgeron A → B ; K2 (un seul enregistrement) : Forgeron B → A et Acrobate X → Y ; K3 : Acrobate Y → Z
  const { chemin: c2 } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(tmp, 'db-k') });
  const v = ouvrirBaseVivante(c2);
  const valeur = (id) => v.prepare('SELECT bonus_brut FROM metier WHERE id = ?').get(id).bonus_brut;
  const a = valeur('metiers/forgeron');
  const modifier = (id, bonus_brut) => ({ op: 'modifier', table: 'metier', cle: { id }, valeurs: { bonus_brut } });
  enregistrer(v, { page: 'metiers/', operations: [modifier('metiers/forgeron', '+7% Essai')] }, { instant: '2026-10-12T09:00:00Z', id: 'essai-k1' });
  enregistrer(v, { page: 'metiers/', operations: [modifier('metiers/forgeron', a), modifier('metiers/acrobate', '+1% Y')] }, { instant: '2026-10-12T09:00:01Z', id: 'essai-k2' });
  enregistrer(v, { page: 'metiers/', operations: [modifier('metiers/acrobate', '+2% Z')] }, { instant: '2026-10-12T09:00:02Z', id: 'essai-k3' });
  const j = journalExporte(v);
  v.close();
  const rowsK = join(tmp, 'rows-k');
  cpSync(join(RACINE, 'data', 'rows'), rowsK, { recursive: true }); // les lignes d'origine (celles de `rows` ont reçu le journal des tests précédents)
  const premier = appliquerJournal(j, { rows: rowsK });
  assert.equal(premier.ecrit, true, JSON.stringify(premier));
  const apres = lire(rowsK);
  const second = appliquerJournal(j, { rows: rowsK });
  assert.deepEqual(lire(rowsK), apres, 'data/rows ne change plus');
  assert.equal(second.conflits?.length ?? 0, 0, JSON.stringify(second.conflits));
  assert.ok(apres['metier.sql'].includes(`'${a.replace(/'/g, "''")}'`), 'le Forgeron garde sa valeur A');
  assert.ok(!apres['metier.sql'].includes("'+7% Essai'"), 'la valeur annulée (B) ne revient pas');
});

test('un don créé puis supprimé avant que la base vivante soit refaite (lignes « fantômes », toujours en attente) entre dans l’historique : son identifiant n’est pas repris', () => {
  const dossier = join(tmp, 'db-f');
  const { chemin: cf } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier });
  let v = ouvrirBaseVivante(cf);
  // un nom de don dont le titre « Nom (Guerrier) » est libre (le site a pu en créer)
  let nom = 'Fugace d’essai';
  for (let i = 2; v.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(normalize(`${nom} (Guerrier)`)); i += 1) nom = `Fugace d’essai ${i}`;
  const creer = (o) => enregistrer(o, { page: 'classes/guerrier', operations: [{ op: 'creer', entite: 'capacite', valeurs: { classe_id: 'classes/guerrier', niveau: '20', nom, type: 'Passif' } }] });
  const id = creer(v).crees[0].id;
  enregistrer(v, { page: 'classes/guerrier', operations: [{ op: 'supprimer', entite: 'capacite', cle: { id } }] });
  v.close();
  // une livraison sans rapport : la base vivante est refaite, la paire créer / supprimer n'a rien à rejouer ; rien n'en est noté (lignes « fantômes »,
  // serveur/edition-journal.mjs#rejouer : réévaluées à chaque rejeu, elles restent en attente jusqu'à leur livraison)
  const regles = join(tmp, 'regles-f.db');
  cpSync(cheminBase({ sansExemples: false }), regles);
  const r = new DatabaseSync(regles);
  r.exec("UPDATE metier SET remarque = 'livraison sans rapport' WHERE id = 'metiers/forgeron'");
  r.close();
  assert.equal(preparerBaseVivante({ regles, dossier }).refaite, true);
  v = ouvrirBaseVivante(cf);
  const lots = v.prepare("SELECT DISTINCT lot_id FROM modification WHERE json_extract(cle, '$.id') = ?").all(id).map((m) => m.lot_id);
  assert.equal(lots.length, 2);
  assert.deepEqual(v.prepare(`SELECT DISTINCT etat FROM modification WHERE lot_id IN (${lots.map(() => '?').join(', ')})`).all(...lots).map((m) => m.etat), ['en_attente']);
  assert.equal(v.prepare('SELECT 1 FROM capacite WHERE id = ?').get(id), undefined, 'le don n’est pas dans la base vivante');
  const j = journalExporte(v);
  v.close();
  assert.deepEqual(lots.filter((l) => j.lots.some((x) => x.id === l)), lots, 'les deux lots sont dans le journal exporté');
  const rowsF = join(tmp, 'rows-f');
  cpSync(join(RACINE, 'data', 'rows'), rowsF, { recursive: true });
  const res = appliquerJournal(j, { rows: rowsF });
  assert.equal(res.ecrit, true, JSON.stringify(res));
  assert.equal(res.conflits.length, 0);
  const { db, sortie } = construire(rowsF);
  assert.ok(db.prepare("SELECT count(*) AS n FROM historique_modification WHERE table_nom = 'capacite' AND json_extract(cle, '$.id') = ?").get(id).n > 0, 'le don est dans l’historique');
  db.close();
  // une base neuve tirée de ces règles : le même nom donne un autre identifiant
  const neuve = ouvrirBaseVivante(preparerBaseVivante({ regles: sortie, dossier: join(tmp, 'db-f2') }).chemin);
  const autre = creer(neuve).crees[0].id;
  neuve.close();
  assert.notEqual(autre, id, 'l’identifiant d’un don supprimé n’est jamais repris');
});
