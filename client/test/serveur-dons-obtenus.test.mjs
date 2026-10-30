// Décision R181 du propriétaire : les dons « Variable » du Mage Bleu obtiennent une entrée du tableau du bas de l'onglet de la classe (migration 0088 :
// classe_annexe_entree, capacite_variable, personnage_don_obtenu). Le service (client/serveur/) : la partie `dons_obtenus` d'une fiche
// ([{ source, entree_id }], lib/fiche-format.mjs#PARTIES_DE_FICHE), relue telle quelle ; « chaque entrée ne se prend qu'une fois » et un choix par don
// refusés en 400 avec un message qui dit la règle ; une base vivante d'avant la migration lit la liste vide et refuse une liste non vide ; les retraits
// de la décision R42 (serveur/fiches-retraits.mjs) : un don « Variable » supprimé sur le site de dev, une entrée ou un don disparus d'une livraison.
// Tout se passe dans des bases vivantes temporaires, à partir de la base construite ; les prétirés d'essai portent des noms absents de la base.
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { donneesDeClasse, enregistrer } from '../serveur/edition.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ficheVide, jourDuRetrait } from '../src/lib/fiche-format.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const REGLES = cheminBase({ sansExemples: false });
const MAGE_BLEU = 'classes/mage-bleu';
const SAPHIR = 'classes/mage-bleu#specialite:mage-saphir';
const DON = (nom) => `capacites/mage-bleu-${nom}`;
const ENTREE = (magie, nom) => `${MAGE_BLEU}#entree:${magie}:${nom}`;
const INSTANT = '2026-10-30T12:00:00Z';

let dossierDuCas;
beforeEach((t) => { dossierDuCas = dossierTemporaire('dons-obtenus', { t }); });
const lecture = (f) => new DatabaseSync(f, { readOnly: true });
function valeur(f, sql, ...p) {
  const db = lecture(f);
  try {
    return db.prepare(sql).get(...p);
  } finally {
    db.close();
  }
}
/** Une nouvelle livraison : une copie des règles modifiée par `sql` (clés non contrôlées : seules celles de la section 13 comptent ici). */
function regles(sql) {
  const f = join(dossierDuCas, `regles-${Math.random().toString(36).slice(2)}.db`);
  copyFileSync(REGLES, f);
  const db = new DatabaseSync(f, { enableForeignKeyConstraints: false });
  db.exec(sql);
  db.close();
  return f;
}
/** Un prétiré Mage Bleu de magie innée Feu, Mage saphir (niveau global 6, niveau de classe 12 : Mimétisme et Mime acquis). */
const mageBleu = (nom, dons_obtenus = []) => ({
  ...ficheVide(nom), magie_innee_id: 'magies/magie-du-feu', xp: 2450,
  classes: [{ rang: 1, classe_id: MAGE_BLEU, specialite_id: SAPHIR }], capacites: [{ capacite_id: DON('mime') }], dons_obtenus,
});
const nomDe = (table, id) => valeur(REGLES, `SELECT nom FROM ${table} WHERE id = ?`, id).nom;

test('R181 : une fiche enregistrée avec dons_obtenus se relit telle quelle ({ source, entree_id }, triée par don) ; une liste envoyée remplace la liste', () => {
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossierDuCas, 'db') });
  const db = ouvrirBaseVivante(chemin);
  try {
    const obtenus = [{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }, { source: DON('mime'), entree_id: ENTREE('feu', 'deflagration') }];
    const cree = enregistrerFiche(db, mageBleu('Essai R181 relu', obtenus), { maintenant: new Date(INSTANT) });
    const attendus = [...obtenus].sort((a, b) => a.source.localeCompare(b.source));
    assert.deepEqual(cree.personnage.dons_obtenus, attendus);
    assert.deepEqual(lireFiche(db, cree.personnage.id).dons_obtenus, attendus);
    assert.deepEqual(cree.controles.filter((c) => c.regle.startsWith('don_obtenu')), [], 'deux entrées de sa magie innée, ses deux dons acquis');
    // une liste envoyée remplace toute la liste ; une liste absente ne change rien
    const lue = lireFiche(db, cree.personnage.id);
    const r = enregistrerFiche(db, { version: lue.version, dons_obtenus: [{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'sang-de-feu') }] }, { id: lue.id });
    assert.deepEqual(r.personnage.dons_obtenus, [{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'sang-de-feu') }]);
    assert.deepEqual(r.controles.filter((c) => c.regle.startsWith('don_obtenu')), [{ regle: 'don_obtenu_a_choisir', detail: DON('mime') }]);
    const s = enregistrerFiche(db, { version: r.personnage.version, nom: 'Essai R181 relu (2)' }, { id: lue.id });
    assert.deepEqual(s.personnage.dons_obtenus, r.personnage.dons_obtenus);
  } finally {
    db.close();
  }
});

test('R181 : une entrée prise par deux dons, deux entrées pour un don, une entrée inconnue — 400 qui dit la règle, rien d’écrit', () => {
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossierDuCas, 'db') });
  const db = ouvrirBaseVivante(chemin);
  try {
    const fiches = () => db.prepare('SELECT count(*) AS n FROM personnage').get().n;
    const avant = fiches();
    const refus = (obtenus, problemes) => assert.throws(() => enregistrerFiche(db, mageBleu('Essai R181 refusé', obtenus)), (e) => {
      assert.deepEqual([e.statut, e.message, e.details.problemes], [400, 'La fiche n’a pas été enregistrée.', problemes]);
      return true;
    });
    refus([{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }, { source: DON('mime'), entree_id: ENTREE('feu', 'moteur-thermique') }],
      ['dons_obtenus[1] : cette entrée du tableau du Mage Bleu est déjà obtenue par un autre don « Variable » de la fiche : chaque entrée ne se prend qu’une fois (décision R181)']);
    refus([{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }, { source: DON('mimetisme'), entree_id: ENTREE('feu', 'deflagration') }],
      ['dons_obtenus[1] : un don « Variable » n’obtient qu’une entrée (décision R181)']);
    refus([{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'inconnue') }],
      [`dons_obtenus : « entree_id » = « ${ENTREE('feu', 'inconnue')} » n’existe pas dans les règles (classe_annexe_entree)`]);
    refus([{ source: DON('mimetisme') }], ['dons_obtenus[0] : « entree_id » est obligatoire']);
    assert.equal(fiches(), avant, 'aucune fiche créée');
    // la même entrée sur deux fiches : permis (une entrée par fiche)
    for (const nom of ['Essai R181 un', 'Essai R181 deux']) enregistrerFiche(db, mageBleu(nom, [{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }]));
  } finally {
    db.close();
  }
});

test('R181 : base vivante d’avant la migration 0088 (repli du service) — dons_obtenus lue vide, une liste non vide refusée plutôt que perdue', () => {
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossierDuCas, 'db') });
  const ancienne = new DatabaseSync(chemin);
  // la vue d'avant : sans les quatre règles de la décision R181 (les autres sont celles de 0082, inchangées : migration 0088)
  const vue = ancienne.prepare("SELECT sql FROM sqlite_master WHERE name = 'v_personnage_controle'").get().sql;
  const debut = vue.indexOf('  -- Dons « Variable » du Mage Bleu (décision R181)');
  const fin = vue.indexOf('  -- Équipement : chaque amélioration', debut);
  assert.ok(debut > 0 && fin > debut, 'le bloc des règles de R181 dans la vue');
  const vueDAvant = vue.slice(0, debut) + vue.slice(fin);
  assert.ok(!vueDAvant.includes('personnage_don_obtenu'));
  ancienne.exec(`DROP VIEW v_personnage_controle; DROP TABLE personnage_don_obtenu; ${vueDAvant};`);
  ancienne.close();
  const db = ouvrirBaseVivante(chemin);
  try {
    const cree = enregistrerFiche(db, mageBleu('Essai R181 repli'));
    assert.deepEqual(cree.personnage.dons_obtenus, [], 'la table n’est pas dans cette base : lue vide');
    const lue = lireFiche(db, cree.personnage.id);
    assert.throws(() => enregistrerFiche(db, { version: lue.version, dons_obtenus: [{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'deflagration') }] }, { id: lue.id }), (e) => {
      assert.deepEqual([e.statut, e.details.problemes], [400, ['dons_obtenus : pas encore dans cette base, ses lignes seraient perdues']]);
      return true;
    });
    assert.deepEqual(lireFiche(db, lue.id), lue, 'rien n’est écrit');
    // la page d'une classe en mode modification se lit sans la table
    assert.deepEqual(donneesDeClasse(db, MAGE_BLEU).fiches[DON('mimetisme')], undefined);
  } finally {
    db.close();
  }
});

test('R42, R181 : un don « Variable » supprimé sur le site de dev emporte le don obtenu (choisi ou reçu d’office), une ligne datée chacun ; la page de la classe l’annonce', () => {
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossierDuCas, 'db') });
  const db = ouvrirBaseVivante(chemin);
  try {
    const { personnage } = enregistrerFiche(db, mageBleu('Essai R181 site de dev', [
      { source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }, { source: DON('mime'), entree_id: ENTREE('feu', 'deflagration') },
    ]));
    const classe = donneesDeClasse(db, MAGE_BLEU);
    assert.deepEqual(classe.fiches[DON('mimetisme')], ['Essai R181 site de dev'], 'Mimétisme (reçu d’office) : la fiche le perd');
    assert.deepEqual(classe.fiches[DON('mime')], ['Essai R181 site de dev'], 'une seule fois, choisi et obtenu');
    const journal = db.prepare('SELECT count(*) AS n FROM modification WHERE table_nom = ?');
    const r = enregistrer(db, { page: MAGE_BLEU, operations: [{ op: 'supprimer', entite: 'capacite', cle: { id: DON('mime') } }] }, { instant: INSTANT, id: 'lot-r181-mime' });
    const mime = valeur(REGLES, 'SELECT k.nom, k.niveau, s.nom AS specialite FROM capacite k JOIN specialite s ON s.id = k.specialite_id WHERE k.id = ?', DON('mime'));
    const deflagration = `le don obtenu « ${nomDe('classe_annexe_entree', ENTREE('feu', 'deflagration'))} » (par le don « Mime », classe Mage Bleu, magie ${nomDe('magie', 'magies/magie-du-feu')})`;
    assert.deepEqual(r.fiches, [{ fiche: 'Essai R181 site de dev', retraits: [`le don « Mime » (classe Mage Bleu, spécialité ${mime.specialite}, niveau ${mime.niveau})`, deflagration] }]);
    assert.deepEqual(db.prepare('SELECT source, entree_id FROM personnage_don_obtenu WHERE personnage_id = ?').all(personnage.id).map((l) => ({ ...l })),
      [{ source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }], 'Mimétisme garde son entrée');
    const notes = db.prepare('SELECT notes FROM personnage WHERE id = ?').get(personnage.id).notes.split('\n');
    assert.equal(notes.at(-1), `[${jourDuRetrait(INSTANT)}] Retrait (règles modifiées) : ${deflagration} n’est plus obtenu : le don qui le donnait n’existe plus dans les règles. Adaptez la fiche à la nouvelle règle.`);
    assert.equal(journal.get('personnage_don_obtenu').n, 0, 'rien des fiches au journal');
    // Mimétisme, que la fiche reçoit d'office (pas dans ses dons choisis) : seul le don obtenu est noté
    const s = enregistrer(db, { page: MAGE_BLEU, operations: [{ op: 'supprimer', entite: 'capacite', cle: { id: DON('mimetisme') } }] }, { instant: INSTANT, id: 'lot-r181-mimetisme' });
    assert.deepEqual(s.fiches, [{ fiche: 'Essai R181 site de dev', retraits: [`le don obtenu « ${nomDe('classe_annexe_entree', ENTREE('feu', 'moteur-thermique'))} » (par le don « Mimétisme », classe Mage Bleu, magie Feu)`] }]);
    assert.equal(db.prepare('SELECT count(*) AS n FROM personnage_don_obtenu WHERE personnage_id = ?').get(personnage.id).n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM capacite_variable WHERE capacite_id IN (?, ?)').get(DON('mime'), DON('mimetisme')).n, 0, 'capacite_variable suit le don (ON DELETE CASCADE)');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('R42, R181 : une livraison sans une entrée du tableau, ou sans un don « Variable », retire le don obtenu à la reconstruction (une ligne datée) ; idempotent', () => {
  const dossier = join(dossierDuCas, 'db');
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier });
  const db = ouvrirBaseVivante(chemin);
  const { personnage } = enregistrerFiche(db, mageBleu('Essai R181 livraison', [
    { source: DON('mimetisme'), entree_id: ENTREE('feu', 'moteur-thermique') }, { source: DON('mime'), entree_id: ENTREE('feu', 'deflagration') },
  ]));
  db.close();
  const entree = ENTREE('feu', 'moteur-thermique');
  const livraison = regles(`DELETE FROM classe_annexe_entree WHERE id = '${entree}'; DELETE FROM page_entite WHERE entite_table = 'classe_annexe_entree' AND entite_id = '${entree}';
    DELETE FROM capacite_variable WHERE capacite_id = '${DON('mime')}'; DELETE FROM capacite WHERE id = '${DON('mime')}'`);
  const r = preparerBaseVivante({ regles: livraison, dossier, instant: new Date(INSTANT) });
  assert.equal(r.refaite, true);
  const mime = valeur(REGLES, 'SELECT k.nom, k.niveau, s.nom AS specialite FROM capacite k JOIN specialite s ON s.id = k.specialite_id WHERE k.id = ?', DON('mime'));
  const obtenu = (id, don) => `le don obtenu « ${nomDe('classe_annexe_entree', id)} » (par le don « ${don} », classe Mage Bleu, magie Feu)`;
  assert.deepEqual(r.fiches, [{ fiche: 'Essai R181 livraison', retraits: [
    `le don « Mime » (classe Mage Bleu, spécialité ${mime.specialite}, niveau ${mime.niveau})`, obtenu(ENTREE('feu', 'deflagration'), 'Mime'), obtenu(entree, 'Mimétisme'),
  ] }]);
  const notes = valeur(chemin, 'SELECT notes FROM personnage WHERE id = ?', personnage.id).notes.split('\n');
  const jour = jourDuRetrait(INSTANT);
  assert.deepEqual(notes.slice(-2), [
    `[${jour}] Retrait (règles modifiées) : ${obtenu(ENTREE('feu', 'deflagration'), 'Mime')} n’est plus obtenu : le don qui le donnait n’existe plus dans les règles. Adaptez la fiche à la nouvelle règle.`,
    `[${jour}] Retrait (règles modifiées) : ${obtenu(entree, 'Mimétisme')} n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.`,
  ]);
  assert.equal(valeur(chemin, 'SELECT count(*) AS n FROM personnage_don_obtenu WHERE personnage_id = ?', personnage.id).n, 0);
  // une livraison suivante sans rapport : rien de plus
  const suivante = preparerBaseVivante({ regles: regles("UPDATE race SET nom = 'Humain (suite R181)' WHERE id = 'races/humain'"), dossier });
  assert.equal(suivante.refaite, true);
  assert.deepEqual(suivante.fiches, []);
  assert.equal(valeur(chemin, 'SELECT notes FROM personnage WHERE id = ?', personnage.id).notes.split('\n').length, notes.length);
});
