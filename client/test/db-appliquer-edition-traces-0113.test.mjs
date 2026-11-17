// Rapatriement d'un lot noté avant la migration 0113 (ids texte des mots-clés, libelle_cle ; R232 (1)) : la trace versée dans historique_modification
// nomme le mot-clé par son id entier (serveur/edition.mjs#traceDAujourdhui, appelée par scripts/db-appliquer-edition.mjs#historiser et par
// scripts/mise-a-jour-regles.mjs), et le mode `--reparer-traces` de l'outil met à l'id entier les traces déjà versées sous l'ancien id.
// Les ids attendus se lisent dans le registre de la 0113 (jamais un libellé) ; le mot-clé d'essai est pris dans l'état courant.
//   node --test test/db-appliquer-edition-traces-0113.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal, reparerLesTracesDeLaBase } from '../scripts/db-appliquer-edition.mjs';
import { traceDAujourdhui } from '../serveur/edition.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const REGISTRE = JSON.parse(readFileSync(join(RACINE, 'data', 'migrations', '0113-mots-cles-id-entier.json'), 'utf8'));
const idDe = (ancien) => REGISTRE.motsCles.find((m) => m.ancienId === ancien).id;
const courante = ouvrirBase({ sansExemples: false });
// un mot-clé d'essai : son ancien id est sa clé d'aujourd'hui, et l'état courant le porte (le site de dev peut en supprimer)
const ESSAI = REGISTRE.motsCles.find((m) => m.ancienId === m.cle && courante.prepare('SELECT 1 FROM mot_cle WHERE id = ? AND cle = ?').get(m.id, m.cle));
const AUTRE = REGISTRE.motsCles.find((m) => m.id !== ESSAI.id);
const tmp = dossierTemporaire('traces-0113');

const trace = (table, cle, avant, apres) => ({ lot_id: 'l', rang: 1, table_nom: table, operation: 'modifier', cle: JSON.stringify(cle), avant: avant && JSON.stringify(avant),
  apres: apres && JSON.stringify(apres) });
const lu = (x) => JSON.parse(x);

test('la trace d’un lot d’avant la 0113 : id entier par le registre, libelle_cle devenu cle, dans mot_cle, page_tag et sort_mot_cle', () => {
  const enTrace = traceDAujourdhui(courante);
  const mc = enTrace(trace('mot_cle', { id: ESSAI.ancienId }, { couleur: null, libelle_cle: 'x' }, { couleur: 'a', libelle_cle: 'y' }));
  assert.deepEqual(lu(mc.cle), { id: ESSAI.id });
  assert.deepEqual(lu(mc.avant), { couleur: null, cle: 'x' });
  assert.deepEqual(lu(mc.apres), { couleur: 'a', cle: 'y' });
  const etiquette = enTrace(trace('page_tag', { page_id: 'p', ordre: 1 }, { tag_id: ESSAI.ancienId }, { tag_id: AUTRE.ancienId }));
  assert.deepEqual(lu(etiquette.cle), { page_id: 'p', ordre: 1 }, 'la clé d’une étiquette est la page et le rang');
  assert.equal(lu(etiquette.avant).tag_id, ESSAI.id);
  assert.equal(lu(etiquette.apres).tag_id, AUTRE.id);
  const sort = enTrace(trace('sort_mot_cle', { sort_id: 's', mot_cle_id: ESSAI.ancienId }, null, null));
  assert.deepEqual(lu(sort.cle), { sort_id: 's', mot_cle_id: ESSAI.id });
});

test('un id inconnu (fondu ou supprimé), un id entier et une autre table passent tels quels ; une clé quittée mène à son mot-clé', () => {
  const enTrace = traceDAujourdhui(courante);
  const inconnu = trace('mot_cle', { id: 'id-inconnu-des-essais' }, null, null);
  assert.equal(enTrace(inconnu), inconnu);
  const entier = trace('mot_cle', { id: ESSAI.id }, { couleur: null }, { couleur: 'a' });
  assert.equal(enTrace(entier), entier);
  const ailleurs = trace('page', { id: ESSAI.ancienId }, null, null);
  assert.equal(enTrace(ailleurs), ailleurs);
  const quittee = courante.prepare('SELECT cle, mot_cle_id FROM mot_cle_ancienne_cle ORDER BY cle LIMIT 1').get();
  if (quittee && !REGISTRE.motsCles.some((m) => m.ancienId === quittee.cle)) {
    assert.equal(lu(enTrace(trace('mot_cle', { id: quittee.cle }, null, null)).cle).id, quittee.mot_cle_id);
  }
});

test('db:appliquer-edition : un journal d’avant la 0113 entre dans historique_modification avec l’id entier du mot-clé', () => {
  const rows = join(tmp, 'rapatriement', 'rows');
  cpSync(join(RACINE, 'data', 'rows'), rows, { recursive: true });
  const description = courante.prepare('SELECT description FROM mot_cle WHERE id = ?').get(ESSAI.id).description;
  const lot = 'essai-traces-0113-1';
  const journal = { format: 'maverick-edition/1', lots: [{ id: lot, fait_le: '2026-11-08T03:00:00Z', auteur_id: null, page_id: 'regles/glossaire/', resume: 'Mot-clé : Définition',
    resolu_le: null, resolu_par: null, resolution: null, modifications: [{ rang: 1, table: 'mot_cle', cle: { id: ESSAI.ancienId }, operation: 'modifier',
      avant: { description }, apres: { description: `${description ?? ''} (essai)` }, etat: 'en_attente', detail: null, apercu: null }] }] };
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  assert.equal(r.historisees, 1);
  const base = join(tmp, 'rapatriement', 'base.db');
  const b = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', base, '--rows', rows], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  const db = new DatabaseSync(base, { readOnly: true });
  const h = db.prepare('SELECT cle, version FROM historique_modification WHERE lot_id = ?').get(lot);
  assert.deepEqual(lu(h.cle), { id: ESSAI.id }, 'la trace nomme le mot-clé par son id entier');
  assert.equal(h.version, null);
  db.close();
});

test('--reparer-traces : les traces versées sous l’ancien id passent à l’id entier ; une seconde fois, rien ne change', () => {
  const rows = join(tmp, 'reparation', 'rows');
  cpSync(join(RACINE, 'data', 'rows'), rows, { recursive: true });
  const base = join(tmp, 'reparation', 'base.db');
  const construire = () => {
    const b = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', base, '--rows', rows], { encoding: 'utf8' });
    assert.equal(b.status, 0, b.stderr);
    return new DatabaseSync(base);
  };
  // l'état que l'outil laissait avant la correction : des traces d'un lot d'avant la 0113, à l'ancien id texte
  const db = construire();
  const inserer = db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
    VALUES ('essai-traces-0113-2', ?, '2026-11-08T03:00:00Z', 'essai', NULL, 'mot_cle', ?, 'modifier', ?, ?)`);
  inserer.run(1, JSON.stringify({ id: ESSAI.ancienId }), JSON.stringify({ couleur: null }), JSON.stringify({ couleur: 'a' }));
  inserer.run(2, JSON.stringify({ id: AUTRE.ancienId }), JSON.stringify({ couleur: null, libelle_cle: 'x' }), JSON.stringify({ couleur: 'a', libelle_cle: 'x' }));
  db.close();
  const exp = spawnSync('python3', ['-I', join(RACINE, 'tools', 'db', 'exporter.py'), base, '--rows', rows], { encoding: 'utf8' });
  assert.equal(exp.status, 0, exp.stderr);

  assert.deepEqual(reparerLesTracesDeLaBase({ rows }), { reparees: 2, ecrit: true });
  const apres = construire();
  const lignes = apres.prepare("SELECT rang, cle, avant FROM historique_modification WHERE lot_id = 'essai-traces-0113-2' ORDER BY rang").all();
  assert.deepEqual(lignes.map((l) => lu(l.cle).id), [ESSAI.id, AUTRE.id]);
  assert.ok(!lignes[1].avant.includes('libelle_cle'));
  apres.close();
  assert.deepEqual(reparerLesTracesDeLaBase({ rows }), { reparees: 0, ecrit: false });
});
