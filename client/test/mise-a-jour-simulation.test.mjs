// Lot synthétique de la « Simulation de mise à jour » en CI (scripts/mise-a-jour-simulation.mjs, job simulation-de-mise-a-jour de
// .github/workflows/ci.yml) : le service du site de dev fait de vraies modifications (deux chapitres du guide, un métier, un sort, un don créé et
// gardé, un autre créé puis supprimé) et fige le lot comme la page Mise à jour ; rejoué par scripts/mise-a-jour-regles.mjs comme dans le job
// preparer de mise-a-jour.yml, il ne change que les fichiers de ses tables et de la note. Quand data/rows porte déjà une note en attente de
// livraison, aucun lot n'est écrit (un second lot serait refusé, code 7) ; test/aide-mise-a-jour.mjs en tire une copie sans elle, qui reprend un lot.
// Chaque cas part d'une copie de data/rows sans note en attente : le test tient pendant une mise à jour comme hors mise à jour.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { CONTROLES } from '../scripts/mise-a-jour-github.mjs';
import { appliquerMiseAJour, ErreurMiseAJour, notesEnAttente, TABLES_DE_LA_NOTE, verifierLot } from '../scripts/mise-a-jour-regles.mjs';
import { fabriquerLot, notesEnAttenteDans, PHRASE_DU_GUIDE, TEXTE_DE_LA_SIMULATION } from '../scripts/mise-a-jour-simulation.mjs';
import { trierVersions } from '../src/lib/notes-de-version.mjs';
import { copieSansNoteEnAttente, versionALaRevision, versionLibre } from './aide-mise-a-jour.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/mise-a-jour-simulation.mjs', import.meta.url));
const CI = fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url));
const VERSION_DEV = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const VERSION_HEAD = versionALaRevision('HEAD');
const racine = mkdtempSync(join(tmpdir(), 'maverick-simulation-test-'));
after(() => rmSync(racine, { recursive: true, force: true }));

const copie = (nom) => copieSansNoteEnAttente(join(racine, nom), { versionProduction: VERSION_HEAD }).rows;
/** La base reconstruite depuis des lignes (scripts/db-build.mjs), ouverte en lecture. */
function baseDe(rows, nom) {
  const chemin = join(racine, `${nom}.db`);
  const b = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(new URL('../scripts/db-build.mjs', import.meta.url)), '--out', chemin, '--rows', rows], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  return new DatabaseSync(chemin, { readOnly: true });
}
const lireDossier = (d) => Object.fromEntries(readdirSync(d).map((f) => [f, readFileSync(join(d, f), 'utf8')]));
const differents = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => a[f] !== b[f]).sort();

// le lot complet, fabriqué une fois depuis une copie de data/rows sans note en attente
const rowsDeDepart = copie('depart');
const fabrique = fabriquerLot({ rows: rowsDeDepart });
const { lot } = fabrique;
const modifications = lot.journal.lots.flatMap((l) => l.modifications.map((m) => ({ ...m, lot: l.id })));
const tablesDuLot = new Set(modifications.map((m) => m.table));
// rejoué une fois comme dans le job preparer, sur une autre copie : l'état d'après une mise à jour (sa note attend sa livraison)
const rowsApres = copie('apres');
const fichiersAvant = lireDossier(rowsApres);
const applique = appliquerMiseAJour(lot, { rows: rowsApres, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV });

test('le lot : figé par le service comme la page Mise à jour (simulation, champ libre), un lot du journal par enregistrement, aucune table hors des règles', () => {
  assert.doesNotThrow(() => verifierLot(lot));
  assert.equal(lot.simulation, true);
  assert.equal(lot.texte, TEXTE_DE_LA_SIMULATION);
  assert.equal(lot.version_dev, VERSION_DEV);
  assert.equal(fabrique.octets, `${JSON.stringify(lot)}\n`, 'tel que le service le sert au workflow');
  assert.equal(lot.journal.lots.length, fabrique.enregistrements.length);
  assert.equal(fabrique.enregistrements.length, 7);
  for (const t of ['page', 'metier', 'sort', 'capacite']) assert.ok(tablesDuLot.has(t), t);
  assert.ok(modifications.every((m) => m.apercu === undefined), 'sans l’aperçu HTML des pages du guide');
});

test('les modifications : deux chapitres du guide, un métier, un sort, un don gardé, un don créé puis supprimé', () => {
  const guide = fabrique.enregistrements.filter((e) => e.operations[0].table === 'page');
  assert.equal(new Set(guide.map((e) => e.operations[0].cle.id)).size, 2);
  for (const { operations: [op] } of guide) {
    assert.ok(op.cle.id.startsWith('guide/'), op.cle.id);
    assert.equal(op.valeurs.corps_md.replace(`\n\n${PHRASE_DU_GUIDE}`, ''), op.avant.corps_md, `${op.cle.id} : une phrase ajoutée, rien d'autre`);
  }
  const dons = modifications.filter((m) => m.table === 'capacite');
  const crees = dons.filter((m) => m.operation === 'inserer').map((m) => m.cle.id);
  const supprimes = dons.filter((m) => m.operation === 'supprimer').map((m) => m.cle.id);
  assert.equal(crees.length, 2);
  assert.deepEqual(supprimes, [crees[1]], 'le second don créé est supprimé, le premier gardé');
  assert.ok(modifications.some((m) => m.table === 'metier' && m.operation === 'modifier' && 'bonus_brut' in m.apres && 'description' in m.apres));
  assert.ok(modifications.some((m) => m.table === 'sort' && m.operation === 'modifier' && 'cout_brut' in m.apres));
});

test('rejoué comme dans le job preparer : seuls les fichiers des tables du journal et de la note changent ; la note et l’historique sont écrits', () => {
  const rows = rowsApres;
  const r = applique;
  const changes = differents(fichiersAvant, lireDossier(rows));
  assert.deepEqual(r.fichiers, changes);
  const permis = new Set([...tablesDuLot, ...TABLES_DE_LA_NOTE].map((t) => `${t}.sql`));
  assert.deepEqual(changes.filter((f) => !permis.has(f)), []);
  for (const f of ['page.sql', 'metier.sql', 'sort.sql', 'capacite.sql', ...TABLES_DE_LA_NOTE.map((t) => `${t}.sql`)]) assert.ok(changes.includes(f), f);
  const db = baseDe(rows, 'rejeu');
  try {
    const guide = fabrique.enregistrements.filter((e) => e.operations[0].table === 'page').map((e) => e.operations[0].cle.id);
    for (const id of guide) assert.ok(db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id).corps_md.includes(PHRASE_DU_GUIDE), id);
    const [garde, ephemere] = modifications.filter((m) => m.table === 'capacite' && m.operation === 'inserer').map((m) => m.cle.id);
    assert.equal(db.prepare('SELECT count(*) AS n FROM capacite WHERE id = ?').get(garde).n, 1, 'le don gardé');
    assert.equal(db.prepare('SELECT count(*) AS n FROM capacite WHERE id = ?').get(ephemere).n, 0, 'le don supprimé');
    assert.deepEqual({ ...db.prepare('SELECT version, texte, lot, exemple FROM note_version WHERE lot = ?').get(lot.id) },
      { version: r.version, texte: TEXTE_DE_LA_SIMULATION, lot: lot.id, exemple: 0 });
    assert.equal(db.prepare('SELECT count(*) AS n FROM historique_modification WHERE version = ?').get(r.version).n, modifications.length);
    const domaines = new Set(db.prepare('SELECT domaine FROM note_version_ligne WHERE version = ?').all(r.version).map((l) => l.domaine));
    for (const d of ['guide', 'metiers', 'sorts', 'classes']) assert.ok(domaines.has(d), d);
  } finally {
    db.close();
  }
});

test('data/rows avec la note du lot en attente : un autre lot est refusé (code 7), la CLI n’écrit aucun lot ; la copie sans note en attente en reprend un', () => {
  const rows = rowsApres;
  const r = applique;
  const attente = notesEnAttenteDans({ rows, reference: 'HEAD' });
  assert.deepEqual(attente.notes, [{ version: r.version, lot: lot.id }]);
  assert.equal(attente.production, VERSION_HEAD);
  const autre = { ...lot, id: '00000000-0000-4000-8000-000000000001' };
  const avant = lireDossier(rows);
  assert.throws(() => appliquerMiseAJour(autre, { rows, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV }),
    (e) => e instanceof ErreurMiseAJour && e.code === 7 && e.details.lot === lot.id);
  assert.deepEqual(differents(avant, lireDossier(rows)), [], 'rien n’est écrit');
  // la CLI du job : aucun lot écrit, un message qui dit pourquoi
  const sortie = join(racine, 'attente-lot.json');
  const cli = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--lot', sortie, '--rows', rows, '--reference', 'HEAD'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, new RegExp(`note V${r.version.replace('.', '\\.')} du lot ${lot.id}.*code 7`));
  assert.equal(existsSync(sortie), false);
  // la copie sans note en attente : la note, ses lignes et son historique retirés, le reste à l'octet près ; un autre lot s'y applique
  const { rows: sans, retirees } = copieSansNoteEnAttente(join(racine, 'sans-attente'), { rows, versionProduction: VERSION_HEAD });
  assert.deepEqual(retirees, [{ version: r.version, lot: lot.id }]);
  assert.deepEqual(differents(lireDossier(rows), lireDossier(sans)), [...TABLES_DE_LA_NOTE].map((t) => `${t}.sql`).sort());
  const relue = baseDe(sans, 'sans-attente');
  try {
    assert.deepEqual(notesEnAttente(relue, { versionProduction: VERSION_HEAD }), []);
  } finally {
    relue.close();
  }
  const reprise = appliquerMiseAJour(autre, { rows: sans, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV });
  assert.equal(reprise.version, r.version);
  assert.deepEqual(reprise.conflits, []);
});

test('versionLibre : au-dessus de toutes les notes de la base, jamais une version prise', () => {
  const db = baseDe(rowsApres, 'versions');
  try {
    const prises = db.prepare('SELECT version FROM note_version').all().map((n) => n.version);
    const libre = versionLibre(db);
    assert.ok(!prises.includes(libre), `${libre} déjà prise (${prises.join(', ')})`);
    assert.match(libre, /^\d+\.\d+$/);
    assert.equal(trierVersions([...prises, libre])[0], libre, 'au-dessus de toutes');
  } finally {
    db.close();
  }
});

test('CLI --guide : le lot des deux chapitres du guide seulement, écrit tel que le service le sert', () => {
  const sortie = join(racine, 'guide-lot.json');
  const cli = spawnSync(process.execPath, ['--no-warnings', SCRIPT, '--lot', sortie, '--rows', rowsDeDepart, '--reference', 'HEAD', '--guide'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const l = JSON.parse(readFileSync(sortie, 'utf8'));
  assert.doesNotThrow(() => verifierLot(l));
  assert.equal(l.simulation, true);
  const mods = l.journal.lots.flatMap((x) => x.modifications);
  assert.equal(l.journal.lots.length, 2);
  assert.deepEqual([...new Set(mods.map((m) => m.table))], ['page']);
  assert.ok(mods.every((m) => m.cle.id.startsWith('guide/') && m.apres.corps_md.includes(PHRASE_DU_GUIDE)));
  assert.match(cli.stdout, /2 modification\(s\) en 2 lot\(s\) ; tables : page/);
});

test('ci.yml : le job simulation-de-mise-a-jour, parallèle au job client et installé comme lui, rejoue le lot comme le job preparer puis le contrôle', () => {
  const { jobs } = YAML.parse(readFileSync(CI, 'utf8'));
  const job = jobs['simulation-de-mise-a-jour'];
  assert.ok(job, 'job présent');
  assert.equal(job.needs, undefined, 'parallèle : n’attend aucun autre job');
  assert.deepEqual(job.defaults, jobs.client.defaults);
  assert.equal(job['runs-on'], jobs.client['runs-on']);
  const installation = (j) => j.steps.slice(0, j.steps.findIndex((s) => s.run === 'npm ci') + 1);
  assert.deepEqual(installation(job), installation(jobs.client), 'même installation que le job client (master récupéré : la production)');
  const commandes = job.steps.slice(installation(job).length).map((s) => s.run.trim());
  const [fabrication, application, indexation, ...controles] = commandes;
  assert.equal(fabrication, 'node --no-warnings scripts/mise-a-jour-simulation.mjs --lot "$RUNNER_TEMP/lot.json" --reference origin/master');
  assert.match(application, /node --no-warnings scripts\/mise-a-jour-regles\.mjs --lot "\$RUNNER_TEMP\/lot\.json" --reference origin\/master/, 'même script et même production que le job preparer');
  assert.match(application, /^if \[ -f "\$RUNNER_TEMP\/lot\.json" \]; then /, 'sauté quand aucun lot n’est écrit (note déjà en attente)');
  assert.equal(indexation, 'git add --all -- ../data/rows');
  // exactement les contrôles du job preparer (scripts/mise-a-jour-github.mjs#CONTROLES : db:build, db:check, tout le job client), puis : aucun
  // fichier changé par eux
  assert.deepEqual(controles.slice(0, -1), CONTROLES);
  assert.equal(controles.at(-1), 'git diff --exit-code --stat && test -z "$(git ls-files --others --exclude-standard)"');
});
