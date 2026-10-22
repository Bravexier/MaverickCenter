// « Effectuer la mise à jour » côté GitHub : scripts/mise-a-jour-regles.mjs applique un lot figé à une copie de data/rows. Le journal est rejoué
// (un conflit arrête tout), la note de version est écrite (version X.Y de la prochaine livraison, champ libre, notes d'exemple retirées), le journal
// passe dans historique_modification, et seuls les fichiers des tables touchées et des notes de version changent (demande du propriétaire).
// La production est ici HEAD (scripts/db-reference.mjs : git archive), pour ne pas dépendre de origin/master dans un clone de test.
// Les copies de data/rows sont prises sans les notes de version en attente de livraison (test/aide-mise-a-jour.mjs) : pendant une mise à jour
// (job preparer, npm test après l'écriture de la note du lot) ou sur dev avant la livraison, data/rows en porte une, qui ferait refuser le lot de
// ces tests (code 7) ; ce refus a son propre test, sur une note posée par le test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
import { normalize } from '../src/lib/text.mjs';
import { copieSansNoteEnAttente, versionALaRevision } from './aide-mise-a-jour.mjs';

// les versions, comme dans le workflow : celle de dev (package.json) et celle de la production (ici HEAD) ; jamais écrites en dur, pour que le test
// reste vrai après les vraies livraisons (une note de version réelle peut déjà être dans data/rows)
const VERSION_DEV = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const VERSION_HEAD = versionALaRevision('HEAD');
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
/** Une copie de data/rows sans note de version en attente de livraison sur la production (HEAD). */
const copie = (nom) => copieSansNoteEnAttente(join(racine, nom), { versionProduction: VERSION_HEAD }).rows;
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

test('verifierLot : format, identifiant, journal, texte, case « Version majeure »', () => {
  assert.doesNotThrow(() => verifierLot(lot()));
  assert.doesNotThrow(() => verifierLot({ ...lot(), majeure: true }));
  assert.doesNotThrow(() => verifierLot({ ...lot(), majeure: false }));
  const touche = (table) => ({ journal: { format: 'maverick-edition/1', lots: [{ id: 'l', fait_le: 'x', resume: 'r', modifications: [{ rang: 1, table, cle: {}, operation: 'modifier', avant: {}, apres: {} }] }] } });
  for (const casse of [{ format: 'x' }, { id: '../x' }, { journal: { format: 'x', lots: [] } }, { texte: 3 }, { majeure: 'oui' }, { majeure: 1 },
    touche('personnage'), touche('utilisateur_role'),
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

test('un lot « majeure » (case « Version majeure » de la page) : la note est la version X+1.0', () => {
  const rows = copie('rows-majeure');
  const majeure = versionDeLivraison(VERSION_DEV, VERSION_HEAD, { majeure: true });
  assert.match(majeure, /^\d+\.0$/);
  assert.equal(Number(majeure.split('.')[0]), Math.max(...[VERSION_DEV, VERSION_HEAD].map((v) => Number(String(v).split('.')[0]))) + 1);
  const res = appliquerMiseAJour({ ...lot('Ouverture.'), majeure: true, version_cible: majeure }, { rows, reference: 'HEAD', date: '2026-10-22', versionDev: VERSION_DEV });
  assert.equal(res.version, majeure);
  assert.ok(res.markdown.startsWith(`## Version ${majeure}`), res.markdown.slice(0, 80));
  assert.deepEqual(baseDe(rows)(`SELECT version, texte FROM note_version WHERE lot = '${lot().id}'`), [{ version: majeure, texte: 'Ouverture.' }]);
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

/** Une copie de data/rows modifiée par une requête SQL (base reconstruite, requête, réexport par l'exporteur des importeurs). */
function copieModifiee(nom, sql) {
  const rows = copie(nom);
  baseDe(rows);
  const base = new DatabaseSync(join(racine, 'relue.db'));
  base.exec(sql);
  base.close();
  const exp = spawnSync('python3', ['-I', fileURLToPath(new URL('../../tools/db/exporter.py', import.meta.url)), join(racine, 'relue.db'), '--rows', rows], { encoding: 'utf8' });
  assert.equal(exp.status, 0, exp.stderr);
  return rows;
}

test('une note d’un autre lot est dans dev sans être livrée : refus (code 7), jamais écrasée, rien n’est écrit', () => {
  // une version au-delà de la production : sa livraison dev → master n'a pas eu lieu
  const rows = copieModifiee('rows-code-7', "INSERT INTO note_version (version, publiee_le, depuis, texte, lot, exemple) VALUES ('98.0', '2026-10-01', '97.9', 'Texte du lot L1', 'lot-l1', 0)");
  const avant = readFileSync(join(rows, 'note_version.sql'), 'utf8');
  assert.throws(() => appliquerMiseAJour(lot(), { rows, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV }),
    (e) => e instanceof ErreurMiseAJour && e.code === 7 && e.details.lot === 'lot-l1' && /pas encore livrée sur master/.test(e.message));
  assert.equal(readFileSync(join(rows, 'note_version.sql'), 'utf8'), avant);
  assert.doesNotMatch(readFileSync(join(rows, 'metier.sql'), 'utf8'), new RegExp(`'${BONUS.replace(/[+%]/g, '\\$&')}'`));
});

test('les lots du journal déjà livrés (dans historique_modification) sont écartés : leur valeur n’est pas réappliquée', () => {
  const premier = journal.lots[0];
  const rows = copieModifiee('rows-deja-livre', `INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
    VALUES ('${premier.id}', 1, '${premier.fait_le}', 'livré avant', NULL, 'metier', '{"id":"metiers/forgeron"}', 'modifier', '{"bonus_brut":"a"}', '{"bonus_brut":"b"}')`);
  const res = appliquerMiseAJour(lot(), { rows, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV });
  assert.deepEqual(res.deja_livres, [premier.id]);
  assert.ok(!readFileSync(join(rows, 'metier.sql'), 'utf8').includes(`'${BONUS}'`), 'la modification déjà livrée n’est pas rejouée');
  const lire = baseDe(rows);
  assert.equal(lire(`SELECT count(*) AS n FROM historique_modification WHERE lot_id = '${premier.id}'`)[0].n, 1, 'pas doublée');
});

test('un lot de dons (D11 : une option créée, un don à note supprimé) ne change que les fichiers des tables du journal et des notes ; la note les liste en neutre', () => {
  const v = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db-dons') }).chemin);
  const service = { base: () => v, etat: () => ({}), edition: true };
  const appel = (operations) => traiter({ methode: 'POST', chemin: '/api/edition/', entetes: { 'content-type': 'application/json' }, corps: JSON.stringify({ page: 'classes/', operations }) }, service);
  // un don reçu sans choix (« Hyper contact » du Guerrier à l'import), lu dans l'état courant : le site de dev a pu le supprimer (D11)
  const recu = v.prepare("SELECT id, classe_id FROM capacite WHERE nature = 'classe' ORDER BY id = 'capacites/guerrier-hyper-contact' DESC, id LIMIT 1").get();
  const classeDuRecu = v.prepare('SELECT nom FROM classe WHERE id = ?').get(recu.classe_id).nom;
  let nom = 'Contact final d’essai';
  for (let i = 2; v.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(normalize(`${nom} (${classeDuRecu})`)); i += 1) nom = `Contact final d’essai ${i}`;
  const cree = appel([{ op: 'creer', entite: 'capacite', valeurs: { classe_id: recu.classe_id, avec: recu.id, nom, type: 'Passif', effet: 'Un *effet* [entre] crochets.' } }]);
  assert.equal(cree.statut, 200, JSON.stringify(cree.corps));
  // un don à note de cellule dans un choix de deux d'une spécialité (lu avant d'écrire)
  const aNote = v.prepare(`SELECT k.id FROM capacite k JOIN note_cellule n ON n.entite_table = 'capacite' AND n.entite_id = k.id
    WHERE k.nature = 'choix' AND k.specialite_id IS NOT NULL ORDER BY k.id`).all().map((k) => k.id)
    .find((id) => v.prepare('SELECT count(*) AS n FROM capacite a JOIN capacite b ON b.classe_id = a.classe_id AND b.ligne = a.ligne AND b.specialite_id = a.specialite_id AND b.nature = a.nature WHERE a.id = ?').get(id).n === 2);
  assert.equal(appel([{ op: 'supprimer', entite: 'capacite', cle: { id: aNote } }]).statut, 200);
  const journalDons = journalExporte(v);
  v.close();
  const touchees = new Set(journalDons.lots.flatMap((l) => l.modifications.map((m) => m.table)));
  for (const t of touchees) assert.ok(['capacite', 'page', 'page_tag', 'page_source', 'page_entite', 'source', 'note_cellule'].includes(t), t);
  const rows = copie('rows-dons');
  const res = appliquerMiseAJour({ ...lot('Des dons.'), journal: journalDons }, { rows, reference: 'HEAD', date: '2026-10-11', versionDev: VERSION_DEV });
  const permis = new Set([...[...touchees].map((t) => `${t}.sql`), ...TABLES_DE_LA_NOTE.map((t) => `${t}.sql`)]);
  assert.deepEqual(res.fichiers.filter((f) => !permis.has(f)), []);
  for (const f of ['capacite.sql', 'page.sql', 'note_cellule.sql']) assert.ok(res.fichiers.includes(f), f);
  const lire = baseDe(rows);
  const dons = lire(`SELECT entite, nature, sens FROM note_version_ligne WHERE version = '${ATTENDUE}' AND table_nom = 'capacite' AND champ IS NULL ORDER BY rang`);
  assert.ok(dons.some((l) => l.nature === 'ajoute' && l.entite.endsWith(nom) && l.sens === 'neutre'), JSON.stringify(dons));
  assert.ok(dons.some((l) => l.nature === 'retire' && l.sens === 'neutre'), JSON.stringify(dons));
  assert.equal(lire(`SELECT nature FROM capacite WHERE id = '${recu.id}'`)[0].nature, 'choix');
});
