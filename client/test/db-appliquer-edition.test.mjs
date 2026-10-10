// Rapatriement des modifications du site de dev dans data/rows (npm run db:appliquer-edition, scripts/db-appliquer-edition.mjs) : le journal téléchargé
// sur le site de dev, rejoué sur une copie de data/rows, en change exactement les lignes modifiées (même format d'export que les importeurs), laisse
// vides les tables du journal, ne réécrit rien en cas de conflit et ne change plus rien la seconde fois.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
enregistrer(vivante, { page: 'metiers/', operations: [{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' }, valeurs: { bonus_brut: '+4% Arme lourde' } }] }, { instant: '2026-10-10T10:00:00Z', id: 'lot-1' });
enregistrer(vivante, { page: 'races/', operations: [{ op: 'creer', entite: 'race', valeurs: { nom: 'Lycan', nature: 'hybride' } }] }, { instant: '2026-10-10T10:05:00Z', id: 'lot-2' });
const journal = journalExporte(vivante);
vivante.close();

const construire = (dossier) => {
  const sortie = join(tmp, `verif-${Math.random().toString(36).slice(2)}.db`);
  const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', dossier], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return new DatabaseSync(sortie);
};

test('le journal rejoué réécrit data/rows : lignes modifiées et créées, tables du journal vides, le reste à l’octet près', () => {
  const r = appliquerJournal(journal, { rows });
  assert.equal(r.ecrit, true);
  assert.deepEqual(r.conflits, []);
  assert.equal(r.bilan.lots, 2);
  assert.equal(r.bilan.conflits, 0);
  const apres = lire(rows);
  const changes = Object.keys(avant).filter((f) => avant[f] !== apres[f]).sort();
  assert.ok(changes.includes('metier.sql') && changes.includes('metier_bonus.sql') && changes.includes('race.sql') && changes.includes('page.sql'), changes.join(', '));
  assert.ok(!changes.includes('modification.sql') && !changes.includes('modification_lot.sql') && !changes.includes('VERSION'), changes.join(', '));
  assert.ok(!changes.includes('sort.sql') && !changes.includes('classe.sql'), 'les tables non touchées ne changent pas');
  const db = construire(rows);
  assert.equal(db.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut, '+4% Arme lourde');
  assert.equal(db.prepare("SELECT nom FROM race WHERE id = 'races/lycan'").get().nom, 'Lycan');
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification').get().n, 0);
  db.close();
});

test('une seconde fois : tout est déjà présent (« intégré »), data/rows ne change plus', () => {
  const une = lire(rows);
  const r = appliquerJournal(journal, { rows });
  assert.equal(r.bilan.appliquees, 0);
  assert.ok(r.bilan.integrees > 0);
  assert.deepEqual(lire(rows), une);
});

test('conflit (data/rows a changé autrement depuis) : rien n’est écrit, sauf --ignorer-conflits qui écrit les autres lots', () => {
  const dossier = join(tmp, 'conflit', 'data', 'rows');
  cpSync(join(RACINE, 'data', 'rows'), dossier, { recursive: true });
  const fichier = join(dossier, 'metier.sql');
  writeFileSync(fichier, readFileSync(fichier, 'utf8').replace("'+3% Arme lourde OU Arme légère'", "'+5% Arme lourde'"));
  const avantConflit = lire(dossier);
  const r = appliquerJournal(journal, { rows: dossier });
  assert.equal(r.ecrit, false);
  assert.equal(r.conflits.length, 1);
  assert.equal(r.conflits[0].lot, 'lot-1');
  assert.match(r.conflits[0].detail, /bonus_brut/);
  assert.deepEqual(lire(dossier), avantConflit);
  const force = appliquerJournal(journal, { rows: dossier, ignorerConflits: true });
  assert.equal(force.ecrit, true);
  const db = construire(dossier);
  assert.equal(db.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut, '+5% Arme lourde', 'le lot en conflit est écarté');
  assert.equal(db.prepare("SELECT count(*) AS n FROM race WHERE id = 'races/lycan'").get().n, 1, 'les autres lots sont écrits');
  db.close();
});
