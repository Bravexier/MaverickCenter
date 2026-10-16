// Édition des panneaux de règles depuis le site de dev (serveur/edition-panneaux.mjs, migration 0056 ; demande du propriétaire, 2026-10-16 : « Il faudrait
// que ce champ texte soit modifiable sur son titre, et son contenu. Son contenu peut d'ailleurs inclure des tuiles génériques (toujours insérables /
// modifiables en mode édition) ») : le titre d'un panneau, le texte d'un bloc (Markdown sûr), le titre d'une tuile (jamais d'un bloc de texte), une tuile
// insérée après un bloc (les suivants décalés, au journal), un déplacement (deux ordres échangés), une suppression (pas du dernier bloc), un rang jamais
// redonné (ni par la table, ni par le journal, ni par l'historique), le rejeu du journal. Les tests lisent l'état avant d'écrire (le site de dev a pu
// modifier les panneaux) et créent eux-mêmes les blocs dont ils ont besoin (un bloc de texte, une tuile, trois blocs : garnir) ; chacun écrit dans sa
// propre copie de la base vivante.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from '../scripts/db-appliquer-edition.mjs';
import { appliquerMiseAJour } from '../scripts/mise-a-jour-regles.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rangLibre, rejouerLeJournal } from '../serveur/edition.mjs';
import { ErreurJournal } from '../serveur/edition-journal.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { attributEd, ENTITES, lireAttributEd, TABLES } from '../src/lib/edition-modele.mjs';
import { PAGES_SERVIES_PAR_L_EQUIPEMENT } from '../src/lib/equipement.mjs';
import { chargerPanneau, ordonnerBlocs, ordresApresDeplacement } from '../src/lib/panneaux-regles-db.mjs';
import { copieSansNoteEnAttente, versionALaRevision } from './aide-mise-a-jour.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const ROWS = join(RACINE, 'data', 'rows');
const sansPython = spawnSync('python3', ['--version']).error ? 'python3 absent' : false;

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-panneaux-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
/** Une base vivante neuve et son service d'édition. */
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  const enregistrer = (operations) => appel('POST', '/api/edition/', { page: 'ressources/equipement/', operations });
  return { db, enregistrer };
}
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
/** Le panneau qui a le plus de blocs (celui des armes à l'import) : les essais d'insertion et de déplacement y ont de la place. */
const leMieuxGarni = (db) => PAGES_SERVIES_PAR_L_EQUIPEMENT.map((o) => chargerPanneau(db, o.ancre)).filter(Boolean).sort((a, b) => b.blocs.length - a.blocs.length)[0];
const sequence = (db, id) => chargerPanneau(db, id).blocs.map((b) => b.rang);
/**
 * Le panneau le mieux garni, avec ce dont un essai a besoin, créé à la fin s'il manque (l'état est lu avant d'écrire : le site de dev a pu retirer des
 * blocs ou des tuiles) : `texte` un bloc de texte, `tuile` une tuile, `blocs` au moins tant de blocs. Rend le panneau relu.
 */
function garnir(db, enregistrer, { texte = false, tuile = false, blocs = 1 } = {}) {
  const id = leMieuxGarni(db).id;
  const creer = (valeurs) => ok(enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: id, ...valeurs } }]));
  if (texte && !chargerPanneau(db, id).blocs.some((b) => b.tuile === 0)) creer({ texte: 'Un bloc de texte d’essai.' });
  if (tuile && !chargerPanneau(db, id).blocs.some((b) => b.tuile === 1)) creer({ tuile: '1', titre: 'Tuile d’essai', texte: 'Le texte d’une tuile d’essai.' });
  for (let n = chargerPanneau(db, id).blocs.length; n < blocs; n += 1) creer({ texte: `Bloc d’essai ${n + 1}.` });
  return chargerPanneau(db, id);
}
/**
 * Le plus grand rang qu'un bloc du panneau a jamais eu, lu sans le service : dans la table, le journal (`modification`) et l'historique du site
 * (`historique_modification`) ; le rang d'un nouveau bloc doit le suivre.
 */
function rangLePlusGrand(db, panneauId) {
  const table = db.prepare('SELECT max(rang) AS m FROM panneau_regles_bloc WHERE panneau_id = ?').get(panneauId).m ?? 0;
  const traces = ['modification', 'historique_modification'].map((t) => db.prepare(`SELECT cle FROM "${t}" WHERE table_nom = 'panneau_regles_bloc'`).all()
    .map((l) => JSON.parse(l.cle)).filter((c) => c.panneau_id === panneauId).map((c) => Number(c.rang)));
  return Math.max(table, ...traces.flat());
}

test('le modèle : titre d’un panneau ; titre, texte et place d’un bloc ; un bloc se crée (après un autre) et se supprime ; leurs data-ed se relisent', () => {
  assert.deepEqual(Object.keys(TABLES.panneau_regles.colonnes), ['titre']);
  assert.deepEqual(Object.keys(TABLES.panneau_regles_bloc.colonnes).sort(), ['ordre', 'texte', 'titre']);
  assert.equal(TABLES.panneau_regles_bloc.colonnes.texte.type, 'markdown');
  assert.equal(TABLES.panneau_regles_bloc.colonnes.ordre.min, 1);
  assert.ok(ENTITES.panneau_regles_bloc.suppression);
  assert.deepEqual(Object.keys(ENTITES.panneau_regles_bloc.champs).sort(), ['apres', 'panneau_id', 'texte', 'titre', 'tuile']);
  assert.equal(lireAttributEd(attributEd('panneau_regles', { id: 'armes' }, 'titre'))?.colonne, 'titre');
  assert.equal(lireAttributEd(attributEd('panneau_regles_bloc', { panneau_id: 'armes', rang: 6 }, 'titre'))?.colonne, 'titre');
  assert.equal(lireAttributEd(attributEd('panneau_regles_bloc', { panneau_id: 'armes', rang: 6 }, 'tuile')), null, 'le genre d’un bloc ne change pas');
  assert.equal(lireAttributEd(attributEd('panneau_regles', { id: 'armes' }, 'page_id')), null, 'la page d’un panneau ne se saisit pas');
});

test('le titre d’un panneau : modifié, refusé vide ; changé entre-temps, 409', () => {
  const { db, enregistrer } = nouvelle();
  const avant = chargerPanneau(db, 'accessoires');
  assert.ok(avant, 'le panneau des accessoires');
  const titre = `${avant.titre} (essai)`;
  ok(enregistrer([{ op: 'modifier', table: 'panneau_regles', cle: { id: 'accessoires' }, valeurs: { titre }, avant: { titre: avant.titre } }]));
  assert.equal(chargerPanneau(db, 'accessoires').titre, titre);
  assert.equal(enregistrer([{ op: 'modifier', table: 'panneau_regles', cle: { id: 'accessoires' }, valeurs: { titre: '  ' } }]).statut, 400);
  assert.equal(enregistrer([{ op: 'modifier', table: 'panneau_regles', cle: { id: 'accessoires' }, valeurs: { titre: 'Autre' }, avant: { titre: avant.titre } }]).statut, 409);
  assert.equal(chargerPanneau(db, 'accessoires').page_id, avant.page_id, 'la page ne bouge pas');
});

test('le texte d’un bloc (Markdown sûr) et le titre d’une tuile ; jamais de titre sur un bloc de texte', () => {
  const { db, enregistrer } = nouvelle();
  const p = garnir(db, enregistrer, { texte: true, tuile: true });
  const texte = p.blocs.find((b) => b.tuile === 0);
  const tuile = p.blocs.find((b) => b.tuile === 1);
  assert.ok(texte && tuile, `${p.id} : un bloc de texte et une tuile`);
  const cle = (b) => ({ panneau_id: p.id, rang: b.rang });
  const modifier = (b, valeurs, avant) => enregistrer([{ op: 'modifier', table: 'panneau_regles_bloc', cle: cle(b), valeurs, ...(avant ? { avant } : {}) }]);
  const lire = (b) => db.prepare('SELECT * FROM panneau_regles_bloc WHERE panneau_id = ? AND rang = ?').get(p.id, b.rang);
  ok(modifier(texte, { texte: `${texte.texte}\n\nUne phrase **ajoutée** et un [[ressources/composants|lien]].` }, { texte: texte.texte }));
  assert.match(lire(texte).texte, /Une phrase \*\*ajoutée\*\*/);
  assert.equal(modifier(texte, { texte: 'Du <script>alert(1)</script>' }).statut, 400, 'HTML brut');
  assert.equal(modifier(texte, { texte: '[lien](javascript:alert(1))' }).statut, 400, 'lien non sûr');
  assert.equal(modifier(texte, { texte: '' }).statut, 400, 'texte vide');
  assert.equal(modifier(texte, { texte: 'Autre' }, { texte: texte.texte }).statut, 409, 'changé entre-temps');
  const refus = modifier(texte, { titre: 'Un titre' });
  assert.equal(refus.statut, 400, 'un titre sur un bloc de texte');
  assert.match(refus.corps.erreur, /qu’à une tuile/);
  ok(modifier(tuile, { titre: 'Titre d’essai' }));
  assert.equal(lire(tuile).titre, 'Titre d’essai');
  ok(modifier(tuile, { titre: '' }));
  assert.equal(lire(tuile).titre, null, 'une tuile sans titre');
  assert.equal(modifier(tuile, { ordre: 0 }).statut, 400, 'une place à partir de 1');
});

test('une tuile insérée après un bloc : les blocs suivants décalés d’une place (au journal), son rang jamais employé ; à la fin sans `apres` ; refus', () => {
  const { db, enregistrer } = nouvelle();
  const p = garnir(db, enregistrer, { blocs: 3 });
  assert.ok(p.blocs.length >= 3, `${p.id} : au moins trois blocs`);
  const apres = p.blocs[1];
  const suivants = p.blocs.slice(2);
  // un bloc d'un rang plus grand que tous, supprimé et livré (historique du site) : son rang ne resert pas
  const livre = rangLePlusGrand(db, p.id) + 7;
  db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres)
    VALUES ('essai-panneaux-historique', 1, '2026-10-16T08:00:00Z', 'Bloc retiré (essai)', NULL, 'panneau_regles_bloc', ?, 'supprimer', ?, NULL)`)
    .run(JSON.stringify({ panneau_id: p.id, rang: livre }), JSON.stringify({ panneau_id: p.id, rang: livre, ordre: 99, tuile: 0, titre: null, texte: 'Livré puis retiré.' }));
  const plusGrand = rangLePlusGrand(db, p.id);
  assert.equal(plusGrand, livre, 'le plus grand rang est celui de l’historique');
  const r = ok(enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, tuile: '1', titre: 'Tuile d’essai', texte: 'Texte de la tuile.', apres: apres.rang } }]));
  const rang = plusGrand + 1;
  assert.deepEqual(r.crees.map((c) => c.id), [`${p.id}#${rang}`]);
  const apresLot = chargerPanneau(db, p.id);
  assert.deepEqual(apresLot.blocs.map((b) => b.rang), [...p.blocs.slice(0, 2).map((b) => b.rang), rang, ...suivants.map((b) => b.rang)], 'à sa place de lecture');
  const nouveau = apresLot.blocs.find((b) => b.rang === rang);
  assert.deepEqual({ ordre: nouveau.ordre, tuile: nouveau.tuile, titre: nouveau.titre, texte: nouveau.texte }, { ordre: apres.ordre + 1, tuile: 1, titre: 'Tuile d’essai', texte: 'Texte de la tuile.' });
  for (const b of suivants) {
    assert.ok(apresLot.blocs.find((x) => x.rang === b.rang).ordre > nouveau.ordre, `bloc ${b.rang} repoussé`);
  }
  // chaque décalage est une modification du journal (rejouée à la livraison)
  const notes = db.prepare("SELECT operation, cle FROM modification WHERE table_nom = 'panneau_regles_bloc' AND lot_id = ? ORDER BY rang").all(r.lot).map((m) => ({ ...m }));
  const decales = suivants.filter((b) => apresLot.blocs.find((x) => x.rang === b.rang).ordre !== b.ordre).length;
  assert.equal(notes.filter((m) => m.operation === 'modifier').length, decales);
  assert.equal(notes.filter((m) => m.operation === 'inserer').length, 1);
  assert.ok(r.lignes.some((l) => l.table === 'panneau_regles_bloc' && l.cle.rang === rang), 'la ligne créée dans la réponse');
  // à la fin, un bloc de texte ; son rang suit celui que le journal vient de noter
  const fin = ok(enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, texte: 'À la fin.' } }]));
  assert.equal(Number(fin.crees[0].id.split('#')[1]), rang + 1);
  assert.equal(chargerPanneau(db, p.id).blocs.at(-1).rang, Number(fin.crees[0].id.split('#')[1]));
  assert.equal(chargerPanneau(db, p.id).blocs.at(-1).tuile, 0);
  // refus
  const creer = (valeurs) => enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, texte: 'Texte.', ...valeurs } }]);
  assert.equal(creer({ titre: 'Un titre' }).statut, 400, 'un titre sur un bloc de texte');
  assert.equal(creer({ texte: '<b>gras</b>' }).statut, 400, 'HTML brut');
  assert.equal(creer({ texte: '' }).statut, 400, 'texte obligatoire');
  assert.equal(creer({ apres: 99999 }).statut, 404, 'après un bloc inconnu');
  assert.equal(creer({ panneau_id: 'aucun-panneau' }).statut, 404, 'panneau inconnu');
  assert.equal(creer({ tuile: '2' }).statut, 400, 'genre hors de la liste');
});

test('déplacer : deux blocs voisins échangent leurs ordres dans un lot (« ↑ », « ↓ ») ; l’ordre de lecture suit', () => {
  const { db, enregistrer } = nouvelle();
  const p = garnir(db, enregistrer, { blocs: 3 });
  const avant = sequence(db, p.id);
  const voulue = [...avant];
  [voulue[1], voulue[2]] = [voulue[2], voulue[1]];
  const changes = ordresApresDeplacement(p.blocs, voulue);
  assert.equal(changes.size, 2, 'deux ordres échangés');
  ok(enregistrer([...changes].map(([rang, ordre]) => ({
    op: 'modifier', table: 'panneau_regles_bloc', cle: { panneau_id: p.id, rang }, valeurs: { ordre }, avant: { ordre: p.blocs.find((b) => b.rang === rang).ordre },
  }))));
  assert.deepEqual(sequence(db, p.id), voulue);
  // la même séquence : rien à changer
  assert.equal(ordresApresDeplacement(chargerPanneau(db, p.id).blocs, voulue).size, 0);
});

test('supprimer un bloc ; son rang ne resert pas ; le dernier bloc d’un panneau reste (409)', () => {
  const { db, enregistrer } = nouvelle();
  const p = leMieuxGarni(db);
  const attendu = rangLePlusGrand(db, p.id) + 1;
  const cree = ok(enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, texte: 'Éphémère.' } }])).crees[0].id;
  const rang = Number(cree.split('#')[1]);
  assert.equal(rang, attendu, 'après tout rang de la table, du journal et de l’historique');
  ok(enregistrer([{ op: 'supprimer', entite: 'panneau_regles_bloc', cle: { panneau_id: p.id, rang } }]));
  assert.ok(!sequence(db, p.id).includes(rang));
  const recree = ok(enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, texte: 'Encore.' } }])).crees[0].id;
  assert.equal(Number(recree.split('#')[1]), rang + 1, 'un rang du journal ne resert pas');
  assert.equal(enregistrer([{ op: 'supprimer', entite: 'panneau_regles_bloc', cle: { panneau_id: p.id, rang } }]).statut, 404, 'déjà supprimé');
  // un panneau réduit à un bloc : ce bloc ne se supprime pas
  const [premier, ...autres] = sequence(db, p.id);
  ok(enregistrer(autres.map((r) => ({ op: 'supprimer', entite: 'panneau_regles_bloc', cle: { panneau_id: p.id, rang: r } }))));
  const dernier = enregistrer([{ op: 'supprimer', entite: 'panneau_regles_bloc', cle: { panneau_id: p.id, rang: premier } }]);
  assert.equal(dernier.statut, 409);
  assert.match(dernier.corps.erreur, /seul bloc/);
  assert.deepEqual(sequence(db, p.id), [premier]);
});

test('rejeu du journal (livraison) : les panneaux reviennent à l’identique, sans conflit', () => {
  const { db, enregistrer } = nouvelle();
  const p = garnir(db, enregistrer, { blocs: 2 });
  ok(enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, tuile: '1', texte: 'Tuile rejouée.', apres: p.blocs[0].rang } }]));
  ok(enregistrer([{ op: 'modifier', table: 'panneau_regles', cle: { id: p.id }, valeurs: { titre: `${p.titre} (rejoué)` } }]));
  ok(enregistrer([{ op: 'supprimer', entite: 'panneau_regles_bloc', cle: { panneau_id: p.id, rang: p.blocs.at(-1).rang } }]));
  const journal = journalExporte(db);
  const neuve = nouvelle().db;
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  const bilan = rejouerLeJournal(neuve, {});
  neuve.exec('COMMIT');
  assert.equal(bilan.conflits, 0);
  for (const t of ['panneau_regles', 'panneau_regles_bloc']) {
    const lire = (base) => base.prepare(`SELECT * FROM "${t}"`).all().map((l) => JSON.stringify(l)).sort();
    assert.deepEqual(lire(neuve), lire(db), t);
  }
  assert.deepEqual(ordonnerBlocs(chargerPanneau(neuve, p.id).blocs).map((b) => b.rang), sequence(db, p.id));
  neuve.close();
});

test('rapatriement et mise à jour sur data/rows : les panneaux reviennent tels que sur le site de dev ; la note de version les range sous « Équipement »', { skip: sansPython }, () => {
  const { db, enregistrer } = nouvelle();
  const p = garnir(db, enregistrer, { blocs: 2 });
  ok(enregistrer([{ op: 'creer', entite: 'panneau_regles_bloc', valeurs: { panneau_id: p.id, tuile: '1', titre: 'Tuile rapatriée', texte: 'Un texte\n\n- une liste', apres: p.blocs[1].rang } }]));
  ok(enregistrer([{ op: 'modifier', table: 'panneau_regles_bloc', cle: { panneau_id: p.id, rang: p.blocs[0].rang }, valeurs: { texte: `${p.blocs[0].texte}\n\nAjout rapatrié.` } }]));
  ok(enregistrer([{ op: 'modifier', table: 'panneau_regles', cle: { id: p.id }, valeurs: { titre: `${p.titre} (rapatrié)` } }]));
  const journal = journalExporte(db);
  const lire = (base, t) => base.prepare(`SELECT * FROM "${t}"`).all().map((l) => JSON.stringify(l)).sort();
  const construire = (rows, nom) => {
    const sortie = join(racine, `${nom}.db`);
    const r = spawnSync(process.execPath, ['--no-warnings', join(RACINE, 'client', 'scripts', 'db-build.mjs'), '--out', sortie, '--rows', rows], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return new DatabaseSync(sortie, { readOnly: true });
  };
  // db:appliquer-edition
  const rows = join(racine, 'rapatriement', 'rows');
  cpSync(ROWS, rows, { recursive: true });
  const r = appliquerJournal(journal, { rows });
  assert.deepEqual(r.conflits, []);
  const appliquee = construire(rows, 'rapatriement');
  for (const t of ['panneau_regles', 'panneau_regles_bloc']) assert.deepEqual(lire(appliquee, t), lire(db, t), t);
  appliquee.close();
  // « Effectuer la mise à jour » : la note de version (domaine « equipement », admis par la contrainte depuis la migration 0056)
  const rowsMaj = copieSansNoteEnAttente(join(racine, 'mise-a-jour', 'rows'), { versionProduction: versionALaRevision('HEAD') }).rows;
  const maj = appliquerMiseAJour({ format: 'maverick-mise-a-jour/1', id: '33333333-4444-5555-6666-777777777777', cree_le: '2026-10-16T08:00:00Z', version_dev: '0.3.40', version_cible: '0.4', texte: null, journal },
    { rows: rowsMaj, reference: 'HEAD', date: '2026-10-16', versionDev: '0.3.40' });
  assert.ok(maj.fichiers.includes('panneau_regles_bloc.sql') && maj.fichiers.includes('panneau_regles.sql'), maj.fichiers.join(', '));
  const majee = construire(rowsMaj, 'mise-a-jour');
  for (const t of ['panneau_regles', 'panneau_regles_bloc']) assert.deepEqual(lire(majee, t), lire(db, t), t);
  const note = majee.prepare("SELECT entite, champ, nature FROM note_version_ligne WHERE domaine = 'equipement' ORDER BY rang").all().map((l) => ({ ...l }));
  assert.ok(note.some((l) => l.champ === 'Titre' && l.nature === 'modifie'), JSON.stringify(note));
  assert.ok(note.some((l) => l.entite === 'Panneau de règles › Tuile rapatriée' && l.nature === 'ajoute'), JSON.stringify(note));
  majee.close();
});

test('rangLibre (relecture SQL) : après le plus grand rang de la table, du journal et de l’historique ; table et colonne vérifiées avant d’entrer dans le SQL', () => {
  const { db } = nouvelle();
  const id = leMieuxGarni(db).id;
  const max = db.prepare('SELECT max(rang) AS m FROM panneau_regles_bloc WHERE panneau_id = ?').get(id).m;
  assert.ok(rangLibre(db, 'panneau_regles_bloc', 'panneau_id', id) > max);
  for (const [table, colonne] of [['panneau_regles_bloc" --', 'panneau_id'], ['table_inconnue', 'panneau_id'], ['panneau_regles_bloc', 'panneau_id" OR 1 = 1 --'],
    ['panneau_regles_bloc', 'colonne_inconnue'], ['mot_cle', 'id']]) {
    assert.throws(() => rangLibre(db, table, colonne, id), ErreurJournal, `${table}.${colonne}`);
  }
  db.close();
});
