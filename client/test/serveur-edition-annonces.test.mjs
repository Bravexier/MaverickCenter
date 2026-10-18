// L'annonce de l'encart « Notre prochaine rencontre IRL » de la page Liens (table annonce, migration 0068 ; demande du propriétaire du 2026-10-18 : titre
// fixe, « annonce modifiable sur le site de dev (mode modification), partie en production avec la mise à jour », « Aucune rencontre annoncée pour le
// moment. » quand elle est vide) : le modèle de l'édition, le service (serveur/edition.mjs#ANNONCE : Markdown sûr, balises du glossaire en forme canonique,
// vidée = NULL, 409 si elle a changé), le rejeu du journal, puis le rapatriement et la mise à jour sur data/rows (la note de version la range sous
// « Guide › Découvrir » ; un lot qui y ajoute du HTML brut est refusé). Chaque essai écrit dans sa propre copie de la base vivante et lit l'état avant
// d'écrire (le site de dev a pu écrire une annonce).
//   node --test test/serveur-edition-annonces.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { appliquerMiseAJour, TEXTES_EN_MARKDOWN, verifierLot } from '../scripts/mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { lireTables } from '../serveur/notes-de-version.mjs';
import { comparerBases } from '../src/lib/notes-de-version.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { chargerAnnonce, contenuDeLAnnonce, empreinteDeLAnnonce } from '../src/lib/annonces.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ENTITES, TABLES, typeDeTexte } from '../src/lib/edition-modele.mjs';
import { LIENS } from '../src/lib/livres.mjs';
import { copieSansNoteEnAttente, versionALaRevision } from './aide-mise-a-jour.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(RACINE, 'data', 'rows');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;
const ID = LIENS.rencontre.annonce;

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-annonces-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
/** Une base vivante neuve et son service d'édition. */
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  const enregistrer = (operations) => appel('POST', '/api/edition/', { page: LIENS.chemin, operations });
  appel.db = db;
  const lire = () => chargerAnnonce(db, ID);
  const modifier = (valeurs, avant) => enregistrer([{ op: 'modifier', table: 'annonce', cle: { id: ID }, valeurs, ...(avant ? { avant } : {}) }]);
  return { db, appel, enregistrer, lire, modifier };
}
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};

test('le modèle et la base : une annonce par encart placé par le site, son texte en Markdown ; ni création ni suppression', () => {
  assert.deepEqual(Object.keys(TABLES.annonce.colonnes), ['texte']);
  assert.equal(TABLES.annonce.colonnes.texte.type, 'markdown');
  assert.notEqual(TABLES.annonce.colonnes.texte.requis, true, 'une annonce se vide');
  assert.equal(typeDeTexte('annonce', 'texte'), 'markdown', 'un texte mis en forme pour les balises du glossaire');
  assert.equal(Object.values(ENTITES).some((e) => e.table === 'annonce'), false);
  const db = ouvrirBase({ sansExemples: false });
  assert.deepEqual(db.prepare('SELECT id FROM annonce ORDER BY id').all().map((l) => l.id), [ID], 'la seule annonce : celle de l’encart de la page Liens');
  assert.ok(chargerAnnonce(db, ID));
  assert.equal(chargerAnnonce(db, 'inconnue'), null);
  // le contenu de la zone : le texte rendu, sinon le texte d'attente (échappé)
  assert.equal(contenuDeLAnnonce(null, '', LIENS.rencontre.vide), '<p class="annonce__vide">Aucune rencontre annoncée pour le moment.</p>');
  assert.equal(contenuDeLAnnonce('Un **texte**', '<p>Un <strong>texte</strong></p>', 'x'), '<p>Un <strong>texte</strong></p>');
  assert.equal(contenuDeLAnnonce(null, '', '<b>'), '<p class="annonce__vide">&lt;b&gt;</p>');
  assert.equal(empreinteDeLAnnonce(null), empreinteDeLAnnonce(''));
  assert.notEqual(empreinteDeLAnnonce('a'), empreinteDeLAnnonce('b'));
});

test('le texte de l’annonce : Markdown sûr (ni HTML brut ni lien non sûr), balises du glossaire en forme canonique, vidé = NULL, 409 s’il a changé', () => {
  const { lire, modifier, db } = nouvelle();
  const avant = lire().texte;
  const texte = 'Retrouvez-nous **à la convention** ; voir [[guide/rejoindre-une-partie|Rejoindre une partie]].';
  ok(modifier({ texte }, { texte: avant }));
  assert.equal(lire().texte, texte);
  assert.equal(modifier({ texte: 'Du <script>alert(1)</script>' }).statut, 400, 'HTML brut');
  assert.equal(modifier({ texte: '[lien](javascript:alert(1))' }).statut, 400, 'lien non sûr');
  assert.equal(modifier({ texte: 'Autre' }, { texte: avant }).statut, 409, 'changé entre-temps');
  assert.equal(lire().texte, texte, 'rien n’a changé après les refus');
  // une balise du glossaire, écrite par son libellé : l'id seul dans la base (un texte mis en forme)
  const motCle = db.prepare('SELECT id, libelle FROM mot_cle WHERE id = ?').get('chakra') ?? db.prepare('SELECT id, libelle FROM mot_cle ORDER BY id LIMIT 1').get();
  ok(modifier({ texte: `Une balise : {{${motCle.libelle}}}.` }));
  assert.equal(lire().texte, `Une balise : {{${motCle.id}}}.`);
  assert.equal(modifier({ texte: 'Une balise : {{mot-cle-qui-n-existe-pas}}.' }).statut, 400, 'une balise qui ne cite aucun mot-clé');
  // vidée : NULL, le texte d'attente revient
  ok(modifier({ texte: '' }));
  assert.equal(lire().texte, null);
  ok(modifier({ texte: '   \n\n' }));
  assert.equal(lire().texte, null);
  // ni création ni suppression
  assert.equal(nouvelle().enregistrer([{ op: 'creer', entite: 'annonce', valeurs: { texte: 'x' } }]).statut, 400);
  assert.equal(nouvelle().enregistrer([{ op: 'modifier', table: 'annonce', cle: { id: 'inconnue' }, valeurs: { texte: 'x' } }]).statut, 404);
});

test('la note de version : une annonce restée vide n’annonce rien, contre une production sans la table comme avec elle ; écrite, son texte', () => {
  const { db, lire, modifier } = nouvelle();
  if (lire().texte !== null) ok(modifier({ texte: '' }));
  assert.equal(lire().texte, null);
  const lignes = (production) => comparerBases(production, lireTables(db)).filter((l) => l.table_nom === 'annonce');
  assert.deepEqual(lignes({ tables: {} }), [], 'production sans la table annonce');
  assert.deepEqual(lignes({ tables: { annonce: [{ id: ID, texte: null }] } }), [], 'production avec l’annonce vide');
  ok(modifier({ texte: 'Rendez-vous à la convention.' }));
  assert.deepEqual(lignes({ tables: { annonce: [{ id: ID, texte: null }] } }).map((l) => [l.groupe, l.nature, l.apres]), [['Découvrir', 'ajoute', 'Rendez-vous à la convention.']]);
});

test('l’API REST (/api/v1/annonces/) : lecture et modification par le service d’édition (If-Match), jamais de création', () => {
  const { appel, lire } = nouvelle();
  const liste = appel('GET', '/api/v1/annonces/');
  assert.equal(liste.statut, 200, JSON.stringify(liste.corps));
  assert.ok(JSON.stringify(liste.corps).includes(ID));
  const detail = appel('GET', `/api/v1/annonces/${ID}/`);
  assert.equal(detail.statut, 200, JSON.stringify(detail.corps));
  assert.equal(detail.corps.element.id, ID);
  const patch = (corps, etag) => traiter({
    methode: 'PATCH', chemin: `/api/v1/annonces/${ID}/`, entetes: { 'content-type': 'application/json', ...(etag ? { 'if-match': etag } : {}) }, corps: JSON.stringify(corps),
  }, { base: () => appel.db, etat: () => ({}), edition: true });
  const r = patch({ texte: 'Par l’API.' }, detail.entetes.ETag);
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(lire().texte, 'Par l’API.');
  assert.equal(patch({ texte: 'Encore.' }, detail.entetes.ETag).statut, 409, 'version périmée (If-Match)');
  assert.equal(patch({ texte: 'Du <script>alert(1)</script>' }, appel('GET', `/api/v1/annonces/${ID}/`).entetes.ETag).statut, 400, 'HTML brut, par l’API aussi');
  assert.equal(appel('POST', '/api/v1/annonces/', { texte: 'x' }).statut, 405);
  assert.equal(appel('DELETE', `/api/v1/annonces/${ID}/`).statut, 405);
});

test('rejeu du journal (livraison) : l’annonce revient à l’identique, sans conflit', () => {
  const { db, modifier } = nouvelle();
  ok(modifier({ texte: 'Annonce rejouée.' }));
  ok(modifier({ texte: 'Annonce rejouée, puis reprise.' }));
  const journal = journalExporte(db);
  const neuve = nouvelle().db;
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  assert.equal(bilan.conflits, 0);
  assert.deepEqual(chargerAnnonce(neuve, ID), chargerAnnonce(db, ID));
  neuve.close();
});

test('rapatriement et mise à jour sur data/rows : l’annonce part telle que sur le site de dev ; la note de version la range sous « Guide › Découvrir »', { skip: sansPython }, () => {
  const { db, modifier } = nouvelle();
  ok(modifier({ texte: 'Annonce **livrée** par la mise à jour.' }));
  const journal = journalExporte(db);
  const construire = (rows, nom) => {
    const sortie = join(racine, `${nom}.db`);
    const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', rows], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return new DatabaseSync(sortie, { readOnly: true });
  };
  // db:appliquer-edition
  const rows = join(racine, 'rapatriement', 'rows');
  cpSync(ROWS, rows, { recursive: true });
  assert.deepEqual(appliquerJournal(journal, { rows }).conflits, []);
  const appliquee = construire(rows, 'rapatriement');
  assert.deepEqual(chargerAnnonce(appliquee, ID), chargerAnnonce(db, ID));
  appliquee.close();
  // « Effectuer la mise à jour »
  const rowsMaj = copieSansNoteEnAttente(join(racine, 'mise-a-jour', 'rows'), { versionProduction: versionALaRevision('HEAD') }).rows;
  const lot = { format: 'maverick-mise-a-jour/1', id: '44444444-5555-6666-7777-888888888888', cree_le: '2026-10-18T08:00:00Z', version_dev: '0.3.59', version_cible: '0.4', texte: null, journal };
  const maj = appliquerMiseAJour(lot, { rows: rowsMaj, reference: 'HEAD', date: '2026-10-18', versionDev: '0.3.59' });
  assert.ok(maj.fichiers.includes('annonce.sql'), maj.fichiers.join(', '));
  const majee = construire(rowsMaj, 'mise-a-jour');
  assert.equal(chargerAnnonce(majee, ID).texte, 'Annonce **livrée** par la mise à jour.');
  const note = majee.prepare("SELECT groupe, entite, champ FROM note_version_ligne WHERE domaine = 'guide' AND entite LIKE '%rencontre%'").all().map((l) => ({ ...l }));
  assert.deepEqual(note, [{ groupe: 'Découvrir', entite: `${LIENS.titre} › ${LIENS.rencontre.titre}`, champ: 'Annonce' }]);
  majee.close();
  // un lot figé qui ajoute du HTML brut à l'annonce : refusé avant tout rejeu
  assert.deepEqual(TEXTES_EN_MARKDOWN.annonce.colonne, 'texte');
  const sale = structuredClone(lot);
  const m = sale.journal.lots.flatMap((l) => l.modifications).find((x) => x.table === 'annonce');
  m.apres = { ...m.apres, texte: 'Du <script>alert(1)</script>' };
  assert.throws(() => verifierLot(sale), /annonce prochaine-rencontre-irl/);
});
