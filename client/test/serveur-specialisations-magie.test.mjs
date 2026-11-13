// Décision R236 du propriétaire (migration 0118 : personnage_specialisation_magie) : la spécialisation magique choisie sur la fiche. Le service
// (client/serveur/) : la partie `specialisations_magie` d'une fiche ([{ magie_id, specialisation_id }], lib/fiche-format.mjs#PARTIES_DE_FICHE) se relit
// telle quelle et se remplace en bloc (R236 (6) : le choix reste modifiable) ; une ligne = un choix fait, aucune = choix en attente ; une seule par
// magie, de cette magie (clé étrangère composée) ; une base vivante d'avant la migration lit la liste vide et refuse une liste non vide ; les retraits
// de la décision R42 (serveur/fiches-retraits.mjs) : une spécialisation disparue d'une livraison, ou donnée à retirerDesFiches, emporte le choix.
// Tout se passe dans des bases vivantes temporaires, à partir de la base dans son état d'import ; magies et spécialisations se choisissent par id,
// leurs noms se lisent par id (jamais écrits ici : le site de dev peut les changer).
//   node --test test/serveur-specialisations-magie.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { noterLesRetraits, nouveauxRetraitsDeFiches, retirerDesFiches } from '../serveur/fiches-retraits.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { ficheVide, ligneDeRetrait, PARTIES_DE_FICHE, TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const REGLES = cheminDImport();
const INSTANT = '2026-11-12T12:00:00Z';

let dossierDuCas;
beforeEach((t) => { dossierDuCas = dossierTemporaire('specialisations-magie', { t }); });

const lecture = (f) => new DatabaseSync(f, { readOnly: true });
function sur(f, sql, ...p) {
  const db = lecture(f);
  try {
    return db.prepare(sql).all(...p).map((r) => ({ ...r }));
  } finally {
    db.close();
  }
}
// deux magies qui ont leurs deux spécialisations (jamais le Potentiel Illimité), par id ; leurs spécialisations par rang
const [A, B] = sur(REGLES, 'SELECT magie_id FROM magie_specialisation GROUP BY magie_id HAVING count(*) = 2 ORDER BY magie_id LIMIT 2').map((r) => r.magie_id);
const specialisation = (magie, ordre) => sur(REGLES, 'SELECT id FROM magie_specialisation WHERE magie_id = ? AND ordre = ?', magie, ordre)[0].id;
const nomDe = (table, id) => sur(REGLES, `SELECT nom FROM ${table} WHERE id = ?`, id)[0].nom;
const choix = (magie, ordre) => ({ magie_id: magie, specialisation_id: specialisation(magie, ordre) });
/** Une fiche bi-magie d'essai (magie innée A, acquise B) sous un nom absent de la base. */
const bimagie = (nom, specialisations_magie = []) => ({ ...ficheVide(nom), magie_innee_id: A, magie_acquise_id: B, specialisations_magie });
const vivante = () => {
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossierDuCas, 'db') });
  return { chemin, db: ouvrirBaseVivante(chemin) };
};
/** Une nouvelle livraison : une copie des règles modifiée par `sql` (clés non contrôlées : seules celles de la section 13 comptent ici). */
function livraison(sql) {
  const f = join(dossierDuCas, `regles-${Math.random().toString(36).slice(2)}.db`);
  copyFileSync(REGLES, f);
  const db = new DatabaseSync(f, { enableForeignKeyConstraints: false });
  db.exec(sql);
  db.close();
  return f;
}

test('R236 : la table est une partie de la fiche (clé specialisations_magie), enregistrée avec la section 13', () => {
  assert.equal(PARTIES_DE_FICHE.specialisations_magie, 'personnage_specialisation_magie');
  assert.ok(TABLES_FICHES.includes('personnage_specialisation_magie'));
  assert.deepEqual(ficheVide('Essai').specialisations_magie, []);
});

test('R236 (3), (6) : le choix par magie se relit tel quel (trié par magie), une liste envoyée remplace la liste, une liste absente ne change rien, une liste vide = en attente', () => {
  const { db } = vivante();
  try {
    const voulu = [choix(A, 1), choix(B, 2)];
    const cree = enregistrerFiche(db, bimagie('Essai R236 relu', [voulu[1], voulu[0]]), { maintenant: new Date(INSTANT) });
    const attendu = [...voulu].sort((x, y) => x.magie_id.localeCompare(y.magie_id));
    assert.deepEqual(cree.personnage.specialisations_magie, attendu);
    assert.deepEqual(lireFiche(db, cree.personnage.id).specialisations_magie, attendu);
    // le choix reste modifiable (R236 (6)) : on change la spécialisation de A
    const lue = lireFiche(db, cree.personnage.id);
    const change = enregistrerFiche(db, { version: lue.version, specialisations_magie: [choix(A, 2), choix(B, 2)] }, { id: lue.id });
    assert.deepEqual(change.personnage.specialisations_magie, [choix(A, 2), choix(B, 2)].sort((x, y) => x.magie_id.localeCompare(y.magie_id)));
    // une liste absente ne change rien (la version change quand la fiche change, pas sinon)
    const renomme = enregistrerFiche(db, { version: change.personnage.version, nom: 'Essai R236 relu (2)' }, { id: lue.id });
    assert.deepEqual(renomme.personnage.specialisations_magie, change.personnage.specialisations_magie);
    // une liste vide : aucune ligne, le choix de chaque magie est en attente
    const vide = enregistrerFiche(db, { version: renomme.personnage.version, specialisations_magie: [] }, { id: lue.id });
    assert.deepEqual(vide.personnage.specialisations_magie, []);
    assert.equal(db.prepare('SELECT count(*) AS n FROM personnage_specialisation_magie WHERE personnage_id = ?').get(lue.id).n, 0);
  } finally {
    db.close();
  }
});

test('R236 : une seule spécialisation par magie, et de cette magie (clé étrangère composée) ; rien n’est écrit sur un refus', () => {
  const { db } = vivante();
  try {
    const avant = db.prepare('SELECT count(*) AS n FROM personnage').get().n;
    const refus = (liste, motif) => assert.throws(() => enregistrerFiche(db, bimagie('Essai R236 refusé', liste)), (e) => {
      assert.equal(e.statut, 400);
      assert.equal(e.message, 'La fiche n’a pas été enregistrée.');
      assert.equal(e.details.problemes.length, 1);
      assert.match(e.details.problemes[0], motif);
      return true;
    });
    refus([choix(A, 1), choix(A, 2)], /^specialisations_magie\[1\] : une seule spécialisation par magie/);
    // la spécialisation d'une autre magie ne passe pas pour celle-ci
    refus([{ magie_id: A, specialisation_id: specialisation(B, 1) }], /^specialisations_magie : « specialisation_id, magie_id » = /);
    refus([{ magie_id: A }], /^specialisations_magie\[0\] : « specialisation_id » est obligatoire/);
    refus([{ magie_id: A, specialisation_id: specialisation(A, 1), autre: 1 }], /champ inconnu « autre »/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM personnage').get().n, avant, 'aucune fiche créée');
    // la même spécialisation sur deux fiches : permis (un choix par fiche et par magie)
    for (const nom of ['Essai R236 un', 'Essai R236 deux']) enregistrerFiche(db, bimagie(nom, [choix(A, 1)]));
    // le choix d'un mono-magie est gardé, sans effet (R236 (2)) : la fiche s'enregistre
    const mono = enregistrerFiche(db, { ...ficheVide('Essai R236 mono'), magie_innee_id: A, specialisations_magie: [choix(A, 1)] });
    assert.deepEqual(mono.personnage.specialisations_magie, [choix(A, 1)]);
  } finally {
    db.close();
  }
});

test('R236 : une base vivante d’avant la migration lit la liste vide et refuse une liste non vide (« pas encore dans cette base »)', () => {
  const { db } = vivante();
  try {
    const { personnage } = enregistrerFiche(db, bimagie('Essai R236 avant'));
    // une base d'avant : sans la table, et sans les deux règles qui la lisent (la vue d'avant, ici réduite à ses trois colonnes, vide)
    db.exec(`DROP VIEW v_personnage_controle; DROP TABLE personnage_specialisation_magie;
      CREATE VIEW v_personnage_controle (personnage_id, regle, detail) AS SELECT NULL, NULL, NULL WHERE 0`);
    const lue = lireFiche(db, personnage.id);
    assert.deepEqual(lue.specialisations_magie, []);
    // une liste vide ne porte rien : acceptée
    enregistrerFiche(db, { version: lue.version, specialisations_magie: [] }, { id: lue.id });
    assert.throws(() => enregistrerFiche(db, { version: lireFiche(db, personnage.id).version, specialisations_magie: [choix(A, 1)] }, { id: lue.id }), (e) => {
      assert.equal(e.statut, 400);
      assert.match(e.details.problemes[0], /^specialisations_magie : pas encore dans cette base/);
      return true;
    });
  } finally {
    db.close();
  }
});

test('R42, R236 : une spécialisation donnée à retirerDesFiches emporte le choix des fiches qui l’ont, avec une ligne datée ; les autres choix restent', () => {
  const { db } = vivante();
  try {
    const { personnage } = enregistrerFiche(db, bimagie('Essai R236 retrait', [choix(A, 1), choix(B, 2)]));
    const autre = enregistrerFiche(db, bimagie('Essai R236 intacte', [choix(A, 2)])).personnage;
    const acc = retirerDesFiches(db, { specialisations: [specialisation(A, 1)] }, nouveauxRetraitsDeFiches());
    const descripteur = { nature: 'specialisation_magie', id: specialisation(A, 1), nom: nomDe('magie_specialisation', specialisation(A, 1)), magie: nomDe('magie', A) };
    assert.deepEqual([...acc.values()].map((e) => [e.personnage, e.retraits]), [[personnage.id, [descripteur]]], 'seule la fiche qui a le choix est touchée');
    assert.deepEqual(lireFiche(db, personnage.id).specialisations_magie, [choix(B, 2)]);
    assert.deepEqual(lireFiche(db, autre.id).specialisations_magie, [choix(A, 2)]);
    noterLesRetraits(db, acc, INSTANT);
    const notes = db.prepare('SELECT notes FROM personnage WHERE id = ?').get(personnage.id).notes.split('\n');
    assert.equal(notes.at(-1), ligneDeRetrait(descripteur, INSTANT));
    assert.ok(notes.at(-1).includes(descripteur.nom) && notes.at(-1).includes(descripteur.magie));
    // une spécialisation inconnue, ou que personne n'a choisie : rien
    assert.equal(retirerDesFiches(db, { specialisations: ['magies/inconnue#specialisation:aucune', specialisation(B, 1)] }, nouveauxRetraitsDeFiches()).size, 0);
  } finally {
    db.close();
  }
});

test('R42, R236 : une livraison sans une spécialisation retire le choix à la reconstruction (une ligne datée, les autres choix gardés) ; idempotent', () => {
  const dossier = join(dossierDuCas, 'db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  const db = ouvrirBaseVivante(chemin);
  const { personnage } = enregistrerFiche(db, bimagie('Essai R236 livraison', [choix(A, 1), choix(B, 2)]));
  db.close();
  const disparue = specialisation(A, 1);
  const r = preparerBaseVivante({ regles: livraison(`DELETE FROM magie_specialisation WHERE id = '${disparue}'`), dossier, instant: new Date(INSTANT) });
  assert.equal(r.refaite, true);
  const descripteur = { nature: 'specialisation_magie', id: disparue, nom: nomDe('magie_specialisation', disparue), magie: nomDe('magie', A) };
  assert.equal(r.fiches.length, 1);
  assert.equal(r.fiches[0].fiche, 'Essai R236 livraison');
  assert.equal(r.fiches[0].retraits.length, 1);
  assert.ok(r.fiches[0].retraits[0].includes(descripteur.nom) && r.fiches[0].retraits[0].includes(descripteur.magie));
  assert.deepEqual(sur(chemin, 'SELECT magie_id, specialisation_id FROM personnage_specialisation_magie WHERE personnage_id = ?', personnage.id), [choix(B, 2)]);
  const notes = sur(chemin, 'SELECT notes FROM personnage WHERE id = ?', personnage.id)[0].notes.split('\n');
  assert.equal(notes.at(-1), ligneDeRetrait(descripteur, INSTANT));
  // une livraison suivante sans rapport : rien de plus
  const suivante = preparerBaseVivante({ regles: livraison(`DELETE FROM magie_specialisation WHERE id = '${disparue}'; UPDATE race SET nom = 'Humain (suite R236)' WHERE id = 'races/humain'`), dossier });
  assert.equal(suivante.refaite, true);
  assert.deepEqual(suivante.fiches, []);
  assert.equal(sur(chemin, 'SELECT notes FROM personnage WHERE id = ?', personnage.id)[0].notes.split('\n').length, notes.length);
});
