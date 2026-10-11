// « Effectuer la mise à jour » côté GitHub : scripts/mise-a-jour-regles.mjs applique un lot figé à une copie de data/rows. Le journal est rejoué
// (un conflit arrête tout), la note de version est écrite (version X.Y de la prochaine livraison, champ libre, notes d'exemple retirées), le journal
// passe dans historique_modification, et seuls les fichiers des tables touchées et des notes de version changent (demande du propriétaire).
// La production est ici HEAD (scripts/db-reference.mjs : git archive), pour ne pas dépendre de origin/master dans un clone de test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerMiseAJour, ErreurMiseAJour, TABLES_DE_LA_NOTE, verifierLot } from '../scripts/mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { versionDeLivraison } from '../src/lib/notes-de-version.mjs';

const ROWS = fileURLToPath(new URL('../../data/rows/', import.meta.url));
// les versions, comme dans le workflow : celle de dev (package.json) et celle de la production (ici HEAD) ; jamais écrites en dur, pour que le test
// reste vrai après les vraies livraisons (une note de version réelle peut déjà être dans data/rows)
const VERSION_DEV = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const VERSION_HEAD = JSON.parse(spawnSync('git', ['show', 'HEAD:client/package.json'], { encoding: 'utf8' }).stdout).version;
const ATTENDUE = versionDeLivraison(VERSION_DEV, VERSION_HEAD);
const racine = mkdtempSync(join(tmpdir(), 'maverick-maj-'));
after(() => rmSync(racine, { recursive: true, force: true }));

// un journal réel : une modification faite par le service du site de dev (un bonus différent de celui en place : le site a pu le changer déjà)
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const BONUS = db.prepare("SELECT bonus_brut FROM metier WHERE id = 'metiers/forgeron'").get().bonus_brut === '+4% Arme lourde' ? '+5% Arme lourde' : '+4% Arme lourde';
const r = traiter({
  methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' },
  corps: JSON.stringify({ page: 'metiers/', operations: [{ op: 'modifier', table: 'metier', cle: { id: 'metiers/forgeron' }, valeurs: { bonus_brut: BONUS } }] }),
}, { base: () => db, etat: () => ({}), edition: true });
assert.equal(r.statut, 200, JSON.stringify(r.corps));
const journal = journalExporte(db);
db.close();
const lot = (texte = 'Le forgeron **gagne** en force.') => ({
  format: 'maverick-mise-a-jour/1', id: '11111111-2222-3333-4444-555555555555', cree_le: '2026-10-11T10:00:00Z', version_dev: '0.1.76',
  version_cible: '0.2', texte, journal,
});
const copie = (nom) => {
  const d = join(racine, nom);
  cpSync(ROWS, d, { recursive: true });
  return d;
};
/** La base reconstruite depuis des lignes : une fonction de lecture. */
function baseDe(rows) {
  const chemin_ = join(racine, 'relue.db');
  rmSync(chemin_, { force: true });
  const b = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(new URL('../scripts/db-build.mjs', import.meta.url)), '--out', chemin_, '--rows', rows], { encoding: 'utf8' });
  assert.equal(b.status, 0, b.stderr);
  return (sql) => {
    const base = new DatabaseSync(chemin_, { readOnly: true });
    try {
      return base.prepare(sql).all().map((l) => ({ ...l }));
    } finally {
      base.close();
    }
  };
}

test('verifierLot : format, identifiant, journal, texte', () => {
  assert.doesNotThrow(() => verifierLot(lot()));
  const touche = (table) => ({ journal: { format: 'maverick-edition/1', lots: [{ id: 'l', fait_le: 'x', resume: 'r', modifications: [{ rang: 1, table, cle: {}, operation: 'modifier', avant: {}, apres: {} }] }] } });
  for (const casse of [{ format: 'x' }, { id: '../x' }, { journal: { format: 'x', lots: [] } }, { texte: 3 }, touche('personnage'), touche('utilisateur_role'),
    touche('note_version'), touche('modification')]) {
    assert.throws(() => verifierLot({ ...lot(), ...casse }), (e) => e instanceof ErreurMiseAJour && e.code === 2, JSON.stringify(casse));
  }
});

test('le lot appliqué : la note écrite, le journal historisé, seuls les fichiers permis changent', () => {
  const rows = copie('rows-ok');
  const notesAvant = baseDe(rows)(`SELECT version, publiee_le, texte, lot, exemple FROM note_version WHERE exemple = 0 AND version <> '${ATTENDUE}' ORDER BY version`);
  const res = appliquerMiseAJour(lot(), { rows, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV });
  assert.equal(res.version, ATTENDUE);
  assert.ok(res.fichiers.includes('metier.sql'), res.fichiers.join(', '));
  for (const f of ['note_version.sql', 'note_version_ligne.sql', 'historique_modification.sql']) assert.ok(res.fichiers.includes(f), f);
  const touchees = new Set(journal.lots.flatMap((l) => l.modifications.map((m) => `${m.table}.sql`)));
  const permis = new Set([...touchees, ...TABLES_DE_LA_NOTE.map((t) => `${t}.sql`)]);
  assert.deepEqual(res.fichiers.filter((f) => !permis.has(f)), []);
  assert.ok(res.markdown.startsWith(`## Version ${ATTENDUE}`), res.markdown.slice(0, 80));
  assert.match(res.markdown, /Le forgeron \*\*gagne\*\* en force\./);
  assert.ok(readFileSync(join(rows, 'metier.sql'), 'utf8').includes(`'${BONUS}'`));
  // la base reconstruite depuis les lignes écrites
  const lire = baseDe(rows);
  const notes = lire('SELECT version, publiee_le, texte, lot, exemple FROM note_version ORDER BY version');
  const nouvelle = { version: ATTENDUE, publiee_le: '2026-10-11', texte: 'Le forgeron **gagne** en force.', lot: lot().id, exemple: 0 };
  assert.deepEqual(notes.filter((n) => n.version === ATTENDUE), [nouvelle]);
  assert.ok(notes.every((n) => n.exemple === 0), 'les notes d’exemple (lorem ipsum) sont retirées');
  assert.deepEqual(notes.filter((n) => n.version !== ATTENDUE), notesAvant, 'les vraies notes déjà livrées restent');
  const forgeron = lire("SELECT champ, avant, apres FROM note_version_ligne WHERE table_nom = 'metier' AND entite = 'Forgeron'");
  assert.ok(forgeron.some((l) => l.champ === 'Bonus' && l.apres === BONUS), JSON.stringify(forgeron));
  // les lignes du journal du lot (l'historique peut déjà contenir des modifications livrées ou rapatriées avant)
  const lots = journal.lots.map((l) => `'${l.id}'`).join(', ');
  const historique = lire(`SELECT lot_id, table_nom, version FROM historique_modification WHERE lot_id IN (${lots})`);
  assert.equal(historique.length, journal.lots.reduce((n, l) => n + l.modifications.length, 0));
  assert.ok(historique.every((h) => h.version === ATTENDUE));
  assert.deepEqual(lire('SELECT count(*) AS n FROM modification UNION ALL SELECT count(*) FROM modification_lot UNION ALL SELECT count(*) FROM note_version_brouillon').map((x) => x.n), [0, 0, 0]);
  // relancé pour la même version : la note est refaite, pas doublée
  const encore = appliquerMiseAJour({ ...lot('Texte corrigé.'), journal: { format: 'maverick-edition/1', lots: [] } }, { rows, reference: 'HEAD', date: '2026-10-12', versionDev: VERSION_DEV });
  assert.equal(encore.version, ATTENDUE);
  assert.match(readFileSync(join(rows, 'note_version.sql'), 'utf8'), /Texte corrigé\./);
  assert.doesNotMatch(readFileSync(join(rows, 'note_version.sql'), 'utf8'), /gagne/);
});

test('conflit avec dev : rien n’est écrit (code 3)', () => {
  const rows = copie('rows-conflit');
  // dev a changé le même champ autrement depuis que le site l'a modifié (base reconstruite, ligne modifiée, réexportée par l'exporteur des importeurs :
  // sans dépendre du texte en place)
  const fichier = join(rows, 'metier.sql');
  const avant = readFileSync(fichier, 'utf8');
  baseDe(rows);
  const base = new DatabaseSync(join(racine, 'relue.db'));
  base.prepare("UPDATE metier SET bonus_brut = bonus_brut || ' (autre)' WHERE id = 'metiers/forgeron'").run();
  base.close();
  const exp = spawnSync('python3', ['-I', fileURLToPath(new URL('../../tools/db/exporter.py', import.meta.url)), join(racine, 'relue.db'), '--rows', rows], { encoding: 'utf8' });
  assert.equal(exp.status, 0, exp.stderr);
  assert.notEqual(readFileSync(fichier, 'utf8'), avant, 'le bonus du forgeron a changé dans metier.sql');
  const instantane = readFileSync(fichier, 'utf8');
  const notes = readFileSync(join(rows, 'note_version.sql'), 'utf8');
  assert.throws(() => appliquerMiseAJour(lot(), { rows, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV }),
    (e) => e instanceof ErreurMiseAJour && e.code === 3 && e.details.conflits.length >= 1);
  assert.equal(readFileSync(fichier, 'utf8'), instantane);
  assert.equal(readFileSync(join(rows, 'note_version.sql'), 'utf8'), notes, 'aucune note écrite');
});

test('une autre table changerait : rien n’est écrit (code 4)', () => {
  const rows = copie('rows-hors-liste');
  // une table que le lot ne touche pas, écrite autrement que l'exporteur : l'export la réécrirait
  const fichier = join(rows, 'competence.sql');
  appendFileSync(fichier, '\n\n');
  const avant = readFileSync(fichier, 'utf8');
  const metiers = readFileSync(join(rows, 'metier.sql'), 'utf8');
  assert.throws(() => appliquerMiseAJour(lot(), { rows, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV }),
    (e) => e instanceof ErreurMiseAJour && e.code === 4 && e.details.horsListe.includes('competence.sql'));
  assert.equal(readFileSync(fichier, 'utf8'), avant);
  assert.equal(readFileSync(join(rows, 'metier.sql'), 'utf8'), metiers);
  assert.ok(!metiers.includes(`'${BONUS}'`));
});
