// Décision R320 (refonte du menu, lot 3) : « Copier le prétiré ». POST /api/personnages/<id>/copie/ (client/serveur/api.mjs, fiches.mjs#copierUnPretire) crée,
// au compte de la session, une fiche de joueur PRIVÉE qui est la copie complète du prétiré (ligne, portrait, toutes les parties de la fiche), sous un nouvel
// identifiant. Joueur, MJ et Créateur la font (comme « Mes personnages », R319) ; ni l'Observateur ni le visiteur, ni une clé. Les sessions sont des cookies
// d'essai (test/aide-acces-d-essai.mjs), les comptes de la table `utilisateur` (test/aide-compte-d-essai.mjs) ; les règles sont celles de l'état d'import,
// choisies par id : le test ne lit aucun texte ni aucune valeur de règle modifiable sur le site de dev.
//   node --test test/serveur-copie-du-pretire.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { appelantDe, copierUnPretire, enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { COLONNES_DU_SERVICE, CHAMP_VERSION, ficheVide, PARTIES_DE_FICHE } from '../src/lib/fiche-format.mjs';
import { poserLAcces } from './aide-acces-d-essai.mjs';
import { poserUnCompte } from './aide-compte-d-essai.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const JSON_ = { 'content-type': 'application/json' };
const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));
const ADRESSE = '/api/personnages/';
const REGLES = cheminDImport();
const COMPTES = [['u-createur', 'Créatrice', 'createur'], ['u-mj', 'Maître', 'mj'], ['u-a', 'Alice', 'joueur'], ['u-b', 'Bob', 'joueur'], ['u-obs', 'Visiteuse', 'observateur']];

/** Des ids de règles, lus dans l'état d'import (jamais un nom). */
function idsDesRegles() {
  const regles = new DatabaseSync(REGLES, { readOnly: true });
  try {
    const ids = (table, n) => regles.prepare(`SELECT id FROM "${table}" ORDER BY id LIMIT ?`).all(n).map((r) => r.id);
    return { classes: ids('classe', 2), caracteristiques: ids('caracteristique', 3), competences: ids('competence', 3) };
  } finally {
    regles.close();
  }
}
const R = idsDesRegles();

/** Le prétiré d'essai : des lignes dans plusieurs parties de la fiche, plus un portrait cadré. */
function unPretire(db, nom = 'Prétiré d’essai') {
  const fiche = {
    ...ficheVide(nom),
    classes: [{ rang: 1, classe_id: R.classes[0] }, { rang: 2, classe_id: R.classes[1] }],
    caracteristiques: R.caracteristiques.map((caracteristique_id, i) => ({ caracteristique_id, base: 3 + i, croix: i % 3 })),
    competences: R.competences.map((competence_id, i) => ({ competence_id, naturel: 2 + i })),
    inventaire: [{ rang: 1, nom: 'Corde', quantite: 2 }, { rang: 2, nom: 'Torche', quantite: 1 }],
    ceinture: [{ rang: 1, nom: 'Gourde', quantite: 1 }],
    actions_usage: [{ action_id: 'essai', restants: 1 }],
    entrainements: [{ rang: 1, texte: 'Une ligne d’entraînement' }],
    notes: 'Des notes du prétiré',
  };
  const id = enregistrerFiche(db, fiche).personnage.id;
  db.prepare('UPDATE personnage SET portrait = ?, portrait_x = 0.25, portrait_y = 0.75, portrait_zoom = 1.5 WHERE id = ?').run(IMAGES.webp, id);
  return id;
}

function monde(t, { edition = false } = {}) {
  const dossier = dossierTemporaire('copie-du-pretire', { t });
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossier, 'db') });
  const db = ouvrirBaseVivante(chemin);
  const a = poserLAcces({ prefixe: 'copie-du-pretire', edition });
  for (const [id, nom, niveau] of COMPTES) poserUnCompte(db, id, nom, undefined, { niveau });
  const journal = [];
  const service = { edition, base: () => db, etat: () => ({ service: 'essai' }), journal: (l) => journal.push(l), dossier, acces: a.acces, connexion: a.connexion };
  const session = (niveau, u) => ({ cookie: a.session(niveau, { u }).cookie });
  const qui = { rien: {}, cle: a.avecCle, obs: session('observateur', 'u-obs'), a: session('joueur', 'u-a'), b: session('joueur', 'u-b'), mj: session('mj', 'u-mj'), createur: session('createur', 'u-createur') };
  const appel = (methode, chemin_, { de = 'rien', corps, entetes = {} } = {}) => traiter({
    methode, chemin: chemin_, entetes: { ...JSON_, ...qui[de], ...entetes }, corps: corps === undefined ? undefined : JSON.stringify(corps),
  }, service);
  const copier = (de, id, options = {}) => appel('POST', `${ADRESSE}${id}/copie/`, { de, corps: {}, ...options });
  const ligne = (id) => ({ ...db.prepare('SELECT nature, proprietaire_id, visibilite, nom FROM personnage WHERE id = ?').get(id) });
  const total = () => db.prepare('SELECT count(*) AS n FROM personnage').get().n;
  const lire = (id) => lireFiche(db, id, appelantDe({ u: 'u-createur', n: 'createur' }));
  return { db, appel, copier, ligne, total, lire, journal, service };
}

/** La fiche sans ce que la copie change (identifiant, nature, propriétaire, visibilité, dates) ni sa version (qui en dépend). */
const sansLeService = (fiche) => {
  const copie = { ...fiche };
  for (const c of [...COLONNES_DU_SERVICE, CHAMP_VERSION]) delete copie[c];
  return copie;
};

test('R320 : Joueur, MJ et Créateur copient un prétiré (201, nouvel identifiant) ; le visiteur, l’Observateur et la clé de lecture sont refusés (403) et rien n’est écrit', (t) => {
  const m = monde(t);
  const pretire = unPretire(m.db);
  const avant = m.total();
  for (const de of ['rien', 'obs']) {
    const r = m.copier(de, pretire);
    assert.equal(r.statut, 403, de);
    assert.equal(m.total(), avant, `${de} : rien n’est écrit`);
  }
  for (const [de, compte] of [['a', 'u-a'], ['mj', 'u-mj'], ['createur', 'u-createur']]) {
    const r = m.copier(de, pretire);
    assert.equal(r.statut, 201, `${de} : ${JSON.stringify(r.corps)}`);
    assert.notEqual(r.corps.id, pretire);
    assert.equal(r.corps.copie_de, pretire);
    assert.equal(r.entetes.Location, `${ADRESSE}${r.corps.id}/`);
    assert.deepEqual([r.corps.nature, r.corps.visibilite, r.corps.proprietaire.id], ['joueur', 'privee', compte], de);
    // la réponse dit ce que la base porte
    assert.deepEqual(m.ligne(r.corps.id), { nature: 'joueur', proprietaire_id: compte, visibilite: 'privee', nom: m.ligne(pretire).nom }, de);
  }
  assert.equal(m.total(), avant + 3);
  // le corps vide et le corps sans objet passent aussi ; une écriture qui n'est pas du JSON est refusée comme les autres (415), sans écrire
  assert.equal(m.appel('POST', `${ADRESSE}${pretire}/copie/`, { de: 'a' }).statut, 201);
  assert.equal(m.copier('a', pretire, { entetes: { 'content-type': 'text/plain' } }).statut, 415);
  assert.equal(m.appel('GET', `${ADRESSE}${pretire}/copie/`, { de: 'a' }).statut, 405);
  assert.equal(m.total(), avant + 4);
});

test('R320 : la copie est fidèle — toutes les parties de la fiche et la ligne du prétiré (portrait et cadrage compris) sont égales, hors identifiant, nature, propriétaire, visibilité et dates', (t) => {
  const m = monde(t);
  const pretire = unPretire(m.db);
  const avant = m.lire(pretire);
  const id = m.copier('a', pretire).corps.id;
  const copie = m.lire(id);
  assert.deepEqual(sansLeService(copie), sansLeService(avant));
  // chaque partie de la fiche y est, et celles que le prétiré d'essai remplit ne sont pas vides
  for (const cle of Object.keys(PARTIES_DE_FICHE)) assert.deepEqual(copie[cle], avant[cle], cle);
  for (const cle of ['classes', 'caracteristiques', 'competences', 'inventaire', 'ceinture', 'actions_usage', 'entrainements']) assert.ok(copie[cle].length > 0, cle);
  assert.equal(copie.portrait, avant.portrait);
  assert.deepEqual([copie.portrait_x, copie.portrait_y, copie.portrait_zoom], [0.25, 0.75, 1.5]);
  // la fiche rendue au propriétaire : à lui, modifiable, et le portrait se sert pour la copie
  const lue = m.appel('GET', `${ADRESSE}${id}/`, { de: 'a' });
  assert.deepEqual([lue.statut, lue.corps.a_moi, lue.corps.peut_ecrire, lue.corps.proprietaire.id], [200, true, true, 'u-a']);
  assert.equal(m.appel('GET', `${ADRESSE}${id}/portrait/`, { de: 'a' }).statut, 200);
  // les dates sont celles de la copie, et chaque copie est indépendante de la précédente
  assert.ok(copie.cree_le >= avant.cree_le);
  const autre = m.copier('a', pretire).corps.id;
  assert.notEqual(autre, id);
  assert.deepEqual(sansLeService(m.lire(autre)), sansLeService(avant));
  // une modification de la copie ne touche ni le prétiré ni l'autre copie
  const modif = m.appel('PUT', `${ADRESSE}${id}/`, { de: 'a', corps: { version: copie.version, nom: 'Renommée', inventaire: [] } });
  assert.equal(modif.statut, 200, JSON.stringify(modif.corps));
  assert.deepEqual(sansLeService(m.lire(pretire)), sansLeService(avant));
  assert.deepEqual(sansLeService(m.lire(autre)), sansLeService(avant));
});

test('R320 : la copie est privée — visible de son propriétaire et d’un Créateur seulement (404 pour un autre Joueur, un MJ, le visiteur) — et le prétiré reste un prétiré inchangé', (t) => {
  const m = monde(t);
  const pretire = unPretire(m.db);
  const avant = m.lire(pretire);
  const id = m.copier('a', pretire).corps.id;
  for (const de of ['rien', 'obs', 'b', 'mj']) {
    assert.equal(m.appel('GET', `${ADRESSE}${id}/`, { de }).statut, 404, `${de} ne voit pas la copie`);
    assert.equal(m.appel('GET', `${ADRESSE}${id}/portrait/`, { de }).statut, 404, `${de} : portrait`);
    assert.ok(!m.appel('GET', ADRESSE, { de }).corps.personnages.some((p) => p.id === id), `${de} : la liste ne la montre pas`);
  }
  for (const de of ['a', 'createur']) {
    assert.equal(m.appel('GET', `${ADRESSE}${id}/`, { de }).statut, 200, de);
    assert.ok(m.appel('GET', ADRESSE, { de }).corps.personnages.some((p) => p.id === id), `${de} : la liste la montre`);
  }
  // le prétiré : même fiche (version comprise), même nature, toujours visible de tous (visiteur compris) et modifiable
  assert.deepEqual(m.lire(pretire), avant);
  assert.deepEqual([m.ligne(pretire).nature, m.ligne(pretire).proprietaire_id, m.ligne(pretire).visibilite], ['pretire', null, 'tous']);
  assert.equal(m.appel('GET', `${ADRESSE}${pretire}/`, { de: 'rien' }).statut, 200);
  assert.equal(m.appel('PUT', `${ADRESSE}${pretire}/`, { de: 'rien', corps: { version: avant.version, surnom: 'Toujours modifiable' } }).statut, 200);
});

test('R320 : refus — fiche inconnue 404 ; fiche de joueur 400 (vue) ou 404 (non vue, sans dire qu’elle existe) ; sans niveau suffisant 403 avant tout ; rien n’est écrit', (t) => {
  const m = monde(t);
  const pretire = unPretire(m.db);
  const copiePrivee = m.copier('a', pretire).corps.id; // privée d'Alice
  const copieDeBob = m.copier('b', pretire).corps.id;
  m.db.prepare("UPDATE personnage SET visibilite = 'tous' WHERE id = ?").run(copieDeBob);
  const avant = m.total();

  const inconnue = m.copier('a', 'fiche-inconnue');
  assert.equal(inconnue.statut, 404);
  assert.equal(m.copier('a', copieDeBob).statut, 400, 'la fiche d’un joueur, vue, n’est pas un prétiré');
  assert.equal(m.copier('a', copiePrivee).statut, 400, 'même la sienne');
  assert.equal(m.copier('createur', copiePrivee).statut, 400);
  const nonVue = m.copier('b', copiePrivee);
  assert.deepEqual([nonVue.statut, nonVue.corps], [404, inconnue.corps], 'une fiche de joueur non vue répond comme une fiche inconnue');
  // le niveau passe avant : un visiteur ou un Observateur n'apprend ni qu'une fiche existe ni qu'elle n'existe pas
  for (const de of ['rien', 'obs']) {
    for (const id of ['fiche-inconnue', copiePrivee, pretire]) assert.equal(m.copier(de, id).statut, 403, `${de} ${id}`);
  }
  assert.equal(m.total(), avant);
  // un compte que la base ne connaît plus (session restée ouverte) n'écrit rien
  m.db.exec('PRAGMA foreign_keys = OFF');
  m.db.prepare("DELETE FROM utilisateur WHERE id = 'u-b'").run();
  m.db.exec('PRAGMA foreign_keys = ON');
  assert.equal(m.copier('b', pretire).statut, 403);
  assert.equal(m.total(), avant);
});

test('R320 : la copie est une seule transaction — une partie qui échoue n’écrit rien (ni la ligne, ni les parties déjà copiées)', (t) => {
  const m = monde(t);
  const pretire = unPretire(m.db);
  const avant = m.total();
  const lignesDeParties = () => Object.values(PARTIES_DE_FICHE).map((table) => m.db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n);
  const comptes = lignesDeParties();
  // la dernière partie lue échoue : les précédentes ont déjà été copiées
  m.db.exec("CREATE TEMP TRIGGER essai_copie BEFORE INSERT ON personnage_inventaire WHEN NEW.nom = 'Corde' AND NEW.personnage_id <> (SELECT id FROM personnage WHERE nature = 'pretire') BEGIN SELECT RAISE(ABORT, 'refus d’essai'); END");
  assert.throws(() => copierUnPretire(m.db, pretire, appelantDe({ u: 'u-a', n: 'joueur' })), /refus d’essai/);
  m.db.exec('DROP TRIGGER essai_copie');
  assert.equal(m.total(), avant);
  assert.deepEqual(lignesDeParties(), comptes);
  // une fois le blocage levé, la même copie réussit : la base n'est pas restée en transaction
  assert.equal(copierUnPretire(m.db, pretire, appelantDe({ u: 'u-a', n: 'joueur' })).visibilite, 'privee');
});

test('R320 : le journal dit la copie par identifiants, jamais un nom ; la copie se compte dans les métriques sans identifiant', (t) => {
  const m = monde(t);
  const evenements = [];
  m.service.evenement = (nom, corps) => evenements.push([nom, corps]);
  const pretire = unPretire(m.db, 'Nom sentinelle du prétiré');
  const id = m.copier('a', pretire).corps.id;
  assert.ok(m.journal.some((l) => l.includes(pretire) && l.includes(id)), m.journal.join('\n'));
  assert.ok(!m.journal.some((l) => /Alice|Sentinelle|sentinelle/.test(l)));
  assert.deepEqual(evenements.map(([nom, c]) => [nom, c.detail]), [['fiche', { action: 'copie' }]]);
});

test('R320 et R310 (3) : sur le site de dev, seul le Créateur copie (201) ; le MJ, le Joueur, l’Observateur et le visiteur sont arrêtés par la porte (classe écriture) ; la clé de lecture est refusée', (t) => {
  const m = monde(t, { edition: true });
  const pretire = unPretire(m.db);
  const avant = m.total();
  assert.equal(m.copier('createur', pretire).statut, 201);
  // la porte du site de dev : un niveau trop bas est refusé avec le niveau requis, et rien n'est écrit
  for (const de of ['mj', 'a', 'obs']) {
    const r = m.copier(de, pretire);
    assert.deepEqual([r.statut, r.corps.acces, r.corps.niveau_requis], [403, 'niveau', 'createur'], de);
  }
  assert.equal(m.copier('rien', pretire).corps.acces, 'connexion');
  assert.equal(m.copier('rien', pretire).statut, 401);
  // une clé de lecture n'écrit pas : refusée par la porte
  const cle = m.copier('cle', pretire);
  assert.equal(cle.statut, 403);
  assert.equal(m.total(), avant + 1);
});
