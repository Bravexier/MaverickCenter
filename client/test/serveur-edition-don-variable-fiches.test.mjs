// Un don « Variable » (décision R181) qui quitte ce type, ou qui change de magie visée (innée ↔ acquise), sur le site de dev : les choix déjà faits sur
// les fiches (personnage_don_obtenu dont il est la source) sont retirés, une ligne datée chacun dans les notes, comme pour un don supprimé (R42).
// Réponses du propriétaire, mot pour mot : « Retirés avec une note », R192 : « Le choix est retiré des fiches avec une note datée, comme pour un don supprimé
// (R42). » (aux deux questions : sortie de « Variable », changement de magie). Un don resté « Variable » sur la même magie ne touche rien.
// Même conduite partout où la règle change : un lot du site de dev (serveur/edition.mjs#enregistrer), la résolution d'un lot en conflit
// (serveur/edition-conflits.mjs#resoudreLeConflit), la reconstruction de la base vivante après une livraison et le rejeu du journal
// (serveur/fiches-retraits.mjs#retirerLesManquants). Code : serveur/fiches-retraits.mjs#retirerLesChoixDesDonsChanges ; texte de la note :
// lib/fiche-format.mjs#ligneDeRetrait (cas « type » et « magie »).
// Règles dans leur état d'import (test/aide-base-d-import.mjs), dons, entrées, classe et magie désignés par leurs ids (figés) ; les noms attendus dans
// les notes se lisent dans la base par id, aucun texte modifiable n'est cité. Prétirés d'essai aux noms absents de la base.
//   node --test test/serveur-edition-don-variable-fiches.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { donneesDeClasse, enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { examinerLeLot, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { descriptionDuRetrait, ficheVide, jourDuRetrait, ligneDeRetrait, ordreDesRetraits, retraitsDesNotes } from '../src/lib/fiche-format.mjs';
import { MAGIES_D_UN_DON_VARIABLE, TYPES_DE_DON_SAISIE } from '../src/lib/edition-modele.mjs';
import { normalize } from '../src/lib/text.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const REGLES = cheminDImport();
const MAGE_BLEU = 'classes/mage-bleu';
const SAPHIR = 'classes/mage-bleu#specialite:mage-saphir';
const FEU = 'magies/magie-du-feu';
const DON = (nom) => `capacites/mage-bleu-${nom}`;
const ENTREE = (magie, nom) => `${MAGE_BLEU}#entree:${magie}:${nom}`;
// deux dons « Variable » de la magie innée (Mimétisme, reçu d'office ; Mime, choisi) et une entrée de la ligne du Feu pour chacun
const CHOIX = Object.freeze([
  Object.freeze({ source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }),
  Object.freeze({ source: DON('mime'), entree_id: ENTREE('feu', 'deflagration') }),
]);
const INSTANT = '2026-11-07T09:00:00Z';
const VARIABLE = TYPES_DE_DON_SAISIE.find((t) => normalize(t.valeur) === 'variable').valeur;
const AUTRE = TYPES_DE_DON_SAISIE.find((t) => normalize(t.valeur) !== 'variable').valeur;
const REGLES_DU_CHOIX = ['don_obtenu_source_perdue', 'don_obtenu_hors_liste'];

let dossierDuCas;
beforeEach((t) => { dossierDuCas = dossierTemporaire('don-variable-fiches', { t }); });
let numero = 0;
const vivante = (regles = REGLES) => ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: join(dossierDuCas, `b${(numero += 1)}`) }).chemin);

/** Un prétiré Mage Bleu de magie innée Feu, Mage saphir (Mimétisme et Mime acquis), avec les deux choix ; ses contrôles du don obtenu sont vides. */
function ficheDEssai(db, nom) {
  const cree = enregistrerFiche(db, {
    ...ficheVide(`${nom} ${process.pid}`), magie_innee_id: FEU, xp: 2450,
    classes: [{ rang: 1, classe_id: MAGE_BLEU, specialite_id: SAPHIR }], capacites: [{ capacite_id: DON('mime') }], dons_obtenus: CHOIX.map((c) => ({ ...c })),
  }, { maintenant: new Date('2026-11-01T00:00:00Z') });
  assert.deepEqual(cree.controles.filter((c) => c.regle.startsWith('don_obtenu')), [], 'la fiche d’essai est conforme avant le changement');
  return cree.personnage;
}
const choixDe = (db, personnage) => db.prepare('SELECT source, entree_id FROM personnage_don_obtenu WHERE personnage_id = ? ORDER BY source').all(personnage).map((l) => ({ ...l }));
const notesDe = (db, personnage) => db.prepare('SELECT notes FROM personnage WHERE id = ?').get(personnage).notes;
/** Les contrôles du choix d'un don (« source = entrée ») qui signalent un choix gardé sans effet ou hors de la liste. */
const signalements = (db, personnage, source) => db.prepare(`SELECT regle FROM v_personnage_controle WHERE personnage_id = ? AND detail LIKE ? ESCAPE '\\'
  AND regle IN (${REGLES_DU_CHOIX.map(() => '?').join(', ')}) ORDER BY regle`).all(personnage, `${source.replace(/[\\%_]/g, '\\$&')} = %`, ...REGLES_DU_CHOIX).map((l) => l.regle);

/** Le descripteur attendu du retrait d'un choix (lib/fiche-format.mjs#descriptionDuRetrait), noms lus dans `db` par id. */
function retraitAttendu(db, { source, entree_id }, cas, magieVisee) {
  const e = db.prepare(`SELECT e.nom, c.nom AS classe, m.nom AS magie FROM classe_annexe_entree e JOIN classe c ON c.id = e.classe_id
    JOIN classe_annexe x ON x.classe_id = e.classe_id AND x.rang = e.annexe_rang JOIN magie m ON m.id = x.magie_id WHERE e.id = ?`).get(entree_id);
  const don = db.prepare('SELECT nom FROM capacite WHERE id = ?').get(source).nom;
  return { nature: 'don_obtenu', id: entree_id, nom: e.nom, don, classe: e.classe, magie: e.magie, cas, magie_visee: magieVisee };
}

/**
 * Le retrait d'un choix vérifié : la ligne partie, les autres choix gardés, une ligne datée de plus à la fin des notes (celle du descripteur), rien des
 * fiches au journal, et plus aucun signalement de ce choix ; remis à la main (point de sauvegarde annulé), il serait signalé (`signale`).
 */
function verifierLeRetrait(db, { personnage, notesAvant, retire, garde, attendu, signale }) {
  assert.deepEqual(choixDe(db, personnage), garde.map((c) => ({ ...c })), 'seul le choix du don changé part');
  const notes = notesDe(db, personnage);
  assert.ok(notes.startsWith(notesAvant ?? ''), 'le texte des notes est gardé');
  assert.equal(retraitsDesNotes(notes).length, retraitsDesNotes(notesAvant).length + 1, 'une ligne de retrait de plus');
  assert.equal(notes.split('\n').at(-1), ligneDeRetrait(attendu, INSTANT), 'la ligne datée du choix retiré');
  assert.equal(retraitsDesNotes(notes).at(-1).jour, jourDuRetrait(INSTANT));
  assert.equal(db.prepare("SELECT count(*) AS n FROM modification WHERE table_nom LIKE 'personnage%'").get().n, 0, 'rien des fiches au journal');
  assert.deepEqual(signalements(db, personnage, retire.source), [], 'v_personnage_controle ne signale plus ce choix');
  db.exec('SAVEPOINT remis');
  try {
    db.prepare('INSERT INTO personnage_don_obtenu (personnage_id, source, entree_id) VALUES (?, ?, ?)').run(personnage, retire.source, retire.entree_id);
    assert.deepEqual(signalements(db, personnage, retire.source), [signale], `gardé, le choix serait signalé (${signale})`);
  } finally {
    db.exec('ROLLBACK TO remis');
    db.exec('RELEASE remis');
  }
}

const modifierLeDon = (db, id, valeurs, lot) => enregistrer(db, { page: MAGE_BLEU, operations: [{ op: 'modifier', table: 'capacite', cle: { id }, valeurs }] }, { instant: INSTANT, id: lot });

test('R181, R42 : un don qui quitte « Variable » sur le site de dev — le choix des fiches est retiré, une ligne datée ; les autres choix restent', () => {
  const db = vivante();
  try {
    const p = ficheDEssai(db, 'Essai sortie de Variable');
    const notesAvant = notesDe(db, p.id);
    const [retire, garde] = CHOIX;
    const attendu = retraitAttendu(db, retire, 'type', null);
    const r = modifierLeDon(db, retire.source, { type_brut: AUTRE }, 'lot-sortie-variable');
    assert.notEqual(db.prepare('SELECT type FROM capacite WHERE id = ?').get(retire.source).type, 'variable');
    assert.deepEqual(r.fiches, [{ fiche: p.nom, retraits: [descriptionDuRetrait(attendu)] }], 'la réponse du lot nomme la fiche et le choix retiré');
    verifierLeRetrait(db, { personnage: p.id, notesAvant, retire, garde: [garde], attendu, signale: 'don_obtenu_source_perdue' });
  } finally {
    db.close();
  }
});

test('R181, R42 : un don « Variable » qui change de magie visée — le choix des fiches est retiré, une ligne datée qui dit la nouvelle magie', () => {
  const db = vivante();
  try {
    const p = ficheDEssai(db, 'Essai changement de magie');
    const notesAvant = notesDe(db, p.id);
    const [garde, retire] = CHOIX;
    const avant = db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(retire.source).magie;
    const nouvelle = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur).find((m) => m !== avant);
    const attendu = retraitAttendu(db, retire, 'magie', nouvelle);
    const r = modifierLeDon(db, retire.source, { magie: nouvelle }, 'lot-changement-de-magie');
    assert.equal(db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(retire.source).magie, nouvelle);
    assert.deepEqual(r.fiches, [{ fiche: p.nom, retraits: [descriptionDuRetrait(attendu)] }]);
    // remis à la main, l'entrée de la magie innée sort de la liste du don, qui vise maintenant l'autre magie
    verifierLeRetrait(db, { personnage: p.id, notesAvant, retire, garde: [garde], attendu, signale: 'don_obtenu_hors_liste' });
  } finally {
    db.close();
  }
});

test('R181 : une modification qui garde le type « Variable » et la magie ne touche pas les fiches (choix, notes)', () => {
  const db = vivante();
  try {
    const p = ficheDEssai(db, 'Essai modification sans effet');
    const notesAvant = notesDe(db, p.id);
    const versionAvant = db.prepare('SELECT modifie_le FROM personnage WHERE id = ?').get(p.id).modifie_le;
    for (const [i, { source }] of CHOIX.entries()) {
      const don = db.prepare('SELECT k.type_brut, v.magie FROM capacite k JOIN capacite_variable v ON v.capacite_id = k.id WHERE k.id = ?').get(source);
      // le type réécrit (toujours « Variable »), la même magie envoyée, une autre colonne changée
      const r = modifierLeDon(db, source, { type_brut: don.type_brut, magie: don.magie, remarque: `Remarque d’essai ${process.pid} ${i}` }, `lot-sans-effet-${i}`);
      assert.ok(r.lot, 'le lot est écrit');
      assert.deepEqual(r.fiches, []);
    }
    assert.deepEqual(choixDe(db, p.id), CHOIX.map((c) => ({ ...c })).sort((a, b) => (a.source < b.source ? -1 : 1)));
    assert.equal(notesDe(db, p.id), notesAvant);
    assert.equal(db.prepare('SELECT modifie_le FROM personnage WHERE id = ?').get(p.id).modifie_le, versionAvant);
  } finally {
    db.close();
  }
});

test('R181 : la page d’une classe donne la magie de chacun de ses dons « Variable » (`variables`), spécialités comprises, et d’eux seuls', () => {
  const db = vivante();
  try {
    const { variables, dons } = donneesDeClasse(db, MAGE_BLEU);
    const attendues = db.prepare('SELECT v.capacite_id, v.magie FROM capacite_variable v JOIN capacite k ON k.id = v.capacite_id WHERE k.classe_id = ?').all(MAGE_BLEU);
    assert.ok(attendues.length > 0, 'la classe a des dons « Variable »');
    assert.deepEqual(variables, Object.fromEntries(attendues.map((l) => [l.capacite_id, l.magie])));
    const parId = new Map(dons.map((d) => [d.id, d]));
    for (const [id, magie] of Object.entries(variables)) {
      assert.equal(parId.get(id)?.type, 'variable', `${id} : un don de la classe, « Variable »`);
      assert.ok(MAGIES_D_UN_DON_VARIABLE.some((m) => m.valeur === magie), id);
    }
    assert.ok(Object.keys(variables).some((id) => parId.get(id).specialite_id), 'un don de spécialité compris');
    // une classe sans don « Variable » : un objet vide
    const autre = db.prepare('SELECT id FROM classe WHERE id NOT IN (SELECT k.classe_id FROM capacite_variable v JOIN capacite k ON k.id = v.capacite_id) ORDER BY id LIMIT 1').get().id;
    assert.deepEqual(donneesDeClasse(db, autre).variables, {});
    // la magie changée sur le site de dev se relit aussitôt
    const [{ source }] = CHOIX;
    const nouvelle = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur).find((m) => m !== variables[source]);
    assert.ok(modifierLeDon(db, source, { magie: nouvelle }, 'lot-variables').lot);
    assert.equal(donneesDeClasse(db, MAGE_BLEU).variables[source], nouvelle);
  } finally {
    db.close();
  }
});

test('R181, R42 : une livraison (ou le rejeu du journal) qui sort un don de « Variable » ou change sa magie retire le choix à la reconstruction ; idempotent', () => {
  const dossier = join(dossierDuCas, 'vivante');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  const db = ouvrirBaseVivante(chemin);
  const p = ficheDEssai(db, 'Essai livraison');
  const notesAvant = notesDe(db, p.id);
  db.close();
  const [sortie, changee] = CHOIX;
  const lecture = new DatabaseSync(REGLES, { readOnly: true });
  let nouvelle;
  let attendus;
  try {
    nouvelle = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur).find((m) => m !== lecture.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(changee.source).magie);
    // dans l'ordre des notes (lib/fiche-format.mjs#ordreDesRetraits : par nom)
    attendus = [retraitAttendu(lecture, sortie, 'type', null), retraitAttendu(lecture, changee, 'magie', nouvelle)].sort(ordreDesRetraits);
  } finally {
    lecture.close();
  }
  // les règles livrées : le premier don n'est plus « Variable » (sa ligne capacite_variable retirée, son type changé), le second vise l'autre magie
  const livraison = join(dossierDuCas, 'livraison.db');
  copyFileSync(REGLES, livraison);
  const regles = new DatabaseSync(livraison);
  try {
    regles.prepare('DELETE FROM capacite_variable WHERE capacite_id = ?').run(sortie.source);
    regles.prepare("UPDATE capacite SET type = 'passif' WHERE id = ?").run(sortie.source);
    regles.prepare('UPDATE capacite_variable SET magie = ? WHERE capacite_id = ?').run(nouvelle, changee.source);
  } finally {
    regles.close();
  }
  const r = preparerBaseVivante({ regles: livraison, dossier, instant: new Date(INSTANT) });
  assert.equal(r.refaite, true);
  assert.deepEqual(r.fiches, [{ fiche: p.nom, retraits: attendus.map(descriptionDuRetrait) }]);
  const apres = ouvrirBaseVivante(chemin);
  try {
    assert.deepEqual(choixDe(apres, p.id), []);
    const notes = notesDe(apres, p.id);
    assert.ok(notes.startsWith(notesAvant ?? ''));
    assert.deepEqual(notes.split('\n').slice(-2), attendus.map((d) => ligneDeRetrait(d, INSTANT)));
    for (const { source } of CHOIX) assert.deepEqual(signalements(apres, p.id, source), [], `${source} : plus signalé`);
  } finally {
    apres.close();
  }
  // une livraison suivante, qui ne touche pas aux dons « Variable » : la base est refaite, rien de plus n'est retiré (l'ancienne base a déjà ces règles)
  const suivante = join(dossierDuCas, 'suivante.db');
  copyFileSync(livraison, suivante);
  const autre = new DatabaseSync(suivante);
  try {
    autre.prepare("UPDATE capacite SET remarque = coalesce(remarque, '') || ' (livraison suivante)' WHERE id = ?").run(sortie.source);
  } finally {
    autre.close();
  }
  const encore = preparerBaseVivante({ regles: suivante, dossier, instant: new Date(INSTANT) });
  assert.equal(encore.refaite, true);
  assert.deepEqual(encore.fiches, []);
});

test('R181, R42 : la résolution d’un lot en conflit qui change la magie d’un don « Variable » retire le choix des fiches, une ligne datée', () => {
  // le site de dev change la magie du don et sa remarque ; les règles livrées changent la même remarque : le lot rejoué est en conflit, non appliqué
  const [garde, retire] = CHOIX;
  const site = vivante();
  let journal;
  let nouvelle;
  try {
    nouvelle = MAGIES_D_UN_DON_VARIABLE.map((m) => m.valeur).find((m) => m !== site.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(retire.source).magie);
    const r = modifierLeDon(site, retire.source, { magie: nouvelle, remarque: `Remarque du site ${process.pid}` }, 'lot-conflit-magie');
    assert.ok(r.lot);
    journal = journalExporte(site);
  } finally {
    site.close();
  }
  const db = vivante();
  try {
    db.prepare('UPDATE capacite SET remarque = ? WHERE id = ?').run(`Remarque livrée ${process.pid}`, retire.source);
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, journal);
    const bilan = rejouerLeJournal(db);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    assert.ok(bilan.conflits > 0, 'le lot est en conflit');
    assert.notEqual(db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(retire.source).magie, nouvelle, 'pas encore appliqué');
    // une fiche fait ses choix pendant que le lot attend
    const p = ficheDEssai(db, 'Essai résolution');
    const notesAvant = notesDe(db, p.id);
    const attendu = retraitAttendu(db, retire, 'magie', nouvelle);
    const lot = journal.lots.at(-1).id;
    const diag = examinerLeLot(db, lot);
    assert.ok(diag.conflits.length > 0);
    const choix = Object.fromEntries(diag.conflits.map((c) => [c.id, { choix: c.choix_possibles.includes(1) ? 1 : c.choix_possibles[0] }]));
    const res = resoudreLeConflit(db, { lot, empreinte: diag.empreinte, choix }, { instant: INSTANT, id: 'lot-resolution-magie' });
    assert.equal(db.prepare('SELECT magie FROM capacite_variable WHERE capacite_id = ?').get(retire.source).magie, nouvelle, 'la magie du lot appliquée');
    assert.deepEqual(res.fiches, [{ fiche: p.nom, retraits: [descriptionDuRetrait(attendu)] }]);
    verifierLeRetrait(db, { personnage: p.id, notesAvant, retire, garde: [garde], attendu, signale: 'don_obtenu_hors_liste' });
  } finally {
    db.close();
  }
});
