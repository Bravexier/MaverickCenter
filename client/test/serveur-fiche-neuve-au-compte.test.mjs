// Décision R322 (refonte du menu, lot 4) : créer une fiche de joueur NEUVE au compte connecté (le « + » de « Mes personnages »). POST /api/personnages/?nature=joueur
// (client/serveur/api.mjs, fiches.mjs#enregistrerFiche avec `auCompte`) crée une fiche de nature `joueur`, rangée au compte de la session, PRIVÉE ; sans `nature`, un
// prétiré comme avant ; toute autre valeur : 400. Le rattachement au compte (fiches.mjs#rattachementAuCompte) est UN SEUL, partagé avec « Copier le prétiré »
// (R320) : mêmes niveaux, mêmes refus, la même ligne rangée. Les sessions sont des cookies d'essai (test/aide-acces-d-essai.mjs), les comptes de la table `utilisateur`
// (test/aide-compte-d-essai.mjs) ; aucun texte ni valeur de règle modifiable n'est lu.
//   node --test test/serveur-fiche-neuve-au-compte.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { classer } from '../serveur/acces-routes.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { NIVEAUX_QUI_COPIENT, appelantDe, copierUnPretire, enregistrerFiche, peutSeRattacher, rattachementAuCompte } from '../serveur/fiches.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { poserLAcces } from './aide-acces-d-essai.mjs';
import { poserUnCompte } from './aide-compte-d-essai.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const JSON_ = { 'content-type': 'application/json' };
const ADRESSE = '/api/personnages/';
const CREER = `${ADRESSE}?nature=joueur`;
const REGLES = cheminDImport();
const COMPTES = [['u-createur', 'Créatrice', 'createur'], ['u-mj', 'Maître', 'mj'], ['u-a', 'Alice', 'joueur'], ['u-b', 'Bob', 'joueur'], ['u-obs', 'Visiteuse', 'observateur']];
const QUI_PEUT = [['a', 'u-a'], ['mj', 'u-mj'], ['createur', 'u-createur']];

function monde(t, { edition = false } = {}) {
  const dossier = dossierTemporaire('fiche-neuve-au-compte', { t });
  const { chemin } = preparerBaseVivante({ regles: REGLES, dossier: join(dossier, 'db') });
  const db = ouvrirBaseVivante(chemin);
  const a = poserLAcces({ prefixe: 'fiche-neuve-au-compte', edition });
  for (const [id, nom, niveau] of COMPTES) poserUnCompte(db, id, nom, undefined, { niveau });
  const journal = [];
  const evenements = [];
  const service = { edition, base: () => db, etat: () => ({ service: 'essai' }), journal: (l) => journal.push(l), evenement: (nom, c) => evenements.push([nom, c]), dossier, acces: a.acces, connexion: a.connexion };
  const session = (niveau, u) => ({ cookie: a.session(niveau, { u }).cookie });
  const qui = { rien: {}, cle: a.avecCle, obs: session('observateur', 'u-obs'), a: session('joueur', 'u-a'), b: session('joueur', 'u-b'), mj: session('mj', 'u-mj'), createur: session('createur', 'u-createur') };
  const appel = (methode, chemin_, { de = 'rien', corps, entetes = {} } = {}) => traiter({
    methode, chemin: chemin_, entetes: { ...JSON_, ...qui[de], ...entetes }, corps: corps === undefined ? undefined : JSON.stringify(corps),
  }, service);
  const creer = (de, nom = 'Fiche neuve', options = {}) => appel('POST', CREER, { de, corps: ficheVide(nom), ...options });
  const ligne = (id) => ({ ...db.prepare('SELECT nature, proprietaire_id, visibilite FROM personnage WHERE id = ?').get(id) });
  const total = () => db.prepare('SELECT count(*) AS n FROM personnage').get().n;
  return { db, appel, creer, ligne, total, journal, evenements };
}

test('R322 : Joueur, MJ et Créateur créent une fiche de joueur neuve (201) : nature joueur, au compte de la session, privée, à eux et modifiable', (t) => {
  const m = monde(t);
  const avant = m.total();
  for (const [de, compte] of QUI_PEUT) {
    const r = m.creer(de, `Neuve de ${de}`);
    assert.equal(r.statut, 201, `${de} : ${JSON.stringify(r.corps)}`);
    const id = r.corps.personnage.id;
    assert.equal(r.entetes.Location, `${ADRESSE}${id}/`);
    // la même réponse qu'une création de prétiré, avec le propriétaire et les droits
    assert.deepEqual(Object.keys(r.corps).sort(), ['a_moi', 'controles', 'niveau', 'personnage', 'peut_ecrire', 'proprietaire']);
    assert.deepEqual([r.corps.a_moi, r.corps.peut_ecrire, r.corps.proprietaire.id], [true, true, compte], de);
    assert.deepEqual([r.corps.personnage.nature, r.corps.personnage.visibilite], ['joueur', 'privee'], de);
    // la réponse dit ce que la base porte
    assert.deepEqual(m.ligne(id), { nature: 'joueur', proprietaire_id: compte, visibilite: 'privee' }, de);
    // elle se relit, et son propriétaire l'enregistre ensuite sans que la nature, le propriétaire ni la visibilité changent (R318)
    const lue = m.appel('GET', `${ADRESSE}${id}/`, { de });
    assert.deepEqual([lue.statut, lue.corps.a_moi, lue.corps.peut_ecrire], [200, true, true], de);
    const modif = m.appel('PUT', `${ADRESSE}${id}/`, { de, corps: { version: lue.corps.personnage.version, surnom: 'Enregistrée' } });
    assert.equal(modif.statut, 200, JSON.stringify(modif.corps));
    assert.deepEqual(m.ligne(id), { nature: 'joueur', proprietaire_id: compte, visibilite: 'privee' }, `${de} : après un PUT`);
  }
  assert.equal(m.total(), avant + 3);
});

test('R322 : la fiche neuve est privée — visible de son propriétaire et d’un Créateur seulement (404 pour un autre Joueur, un MJ, un Observateur, le visiteur)', (t) => {
  const m = monde(t);
  const id = m.creer('a').corps.personnage.id;
  for (const de of ['rien', 'obs', 'b', 'mj']) {
    assert.equal(m.appel('GET', `${ADRESSE}${id}/`, { de }).statut, 404, `${de} ne la voit pas`);
    assert.ok(!m.appel('GET', ADRESSE, { de }).corps.personnages.some((p) => p.id === id), `${de} : la liste ne la montre pas`);
  }
  for (const de of ['a', 'createur']) {
    assert.equal(m.appel('GET', `${ADRESSE}${id}/`, { de }).statut, 200, de);
    assert.ok(m.appel('GET', ADRESSE, { de }).corps.personnages.some((p) => p.id === id), `${de} : la liste la montre`);
  }
});

test('R322 : sans session de niveau Joueur ou plus (visiteur, clé de lecture, Observateur) ou sans compte : 403 avant toute lecture du corps, et rien n’est écrit', (t) => {
  const m = monde(t);
  const avant = m.total();
  for (const de of ['rien', 'cle', 'obs']) {
    assert.equal(m.creer(de).statut, 403, de);
    // le niveau passe avant la forme : ni 415 (autre type de contenu), ni 400 (corps vide ou sans objet)
    assert.equal(m.creer(de, 'x', { entetes: { 'content-type': 'text/plain' } }).statut, 403, `${de} : type de contenu`);
    assert.equal(m.appel('POST', CREER, { de }).statut, 403, `${de} : sans corps`);
  }
  assert.equal(m.total(), avant);
  // un compte que la base ne connaît plus (session restée ouverte) n'écrit rien ; la fiche n'est pas créée en prétiré non plus
  m.db.exec('PRAGMA foreign_keys = OFF');
  m.db.prepare("DELETE FROM utilisateur WHERE id = 'u-b'").run();
  m.db.exec('PRAGMA foreign_keys = ON');
  assert.equal(m.creer('b').statut, 403);
  assert.equal(m.total(), avant);
  // une session valide qui n'envoie pas du JSON : la forme est refusée comme pour toute écriture (415), sans écrire
  assert.equal(m.creer('a', 'x', { entetes: { 'content-type': 'text/plain' } }).statut, 415);
  assert.equal(m.total(), avant);
});

test('R322 : une `nature` autre que « joueur » est refusée (400) — « pretire », une valeur inconnue, vide — et rien n’est écrit ; seule la création est concernée', (t) => {
  const m = monde(t);
  const avant = m.total();
  for (const chaine of ['pretire', 'autre', 'Joueur', '', 'joueur&nature=pretire']) {
    for (const de of ['createur', 'a', 'rien']) {
      const r = m.appel('POST', `${ADRESSE}?nature=${chaine}`, { de, corps: ficheVide('x') });
      assert.equal(r.statut, 400, `nature=${chaine} (${de})`);
    }
  }
  assert.equal(m.total(), avant);
  // la lecture et la modification d'une fiche ignorent la chaîne de requête
  const id = m.creer('a').corps.personnage.id;
  assert.equal(m.appel('GET', `${ADRESSE}${id}/?nature=autre`, { de: 'a' }).statut, 200);
});

test('R322 : sans `nature`, la création reste celle d’un prétiré (à personne, visible de tous) ; une autre chaîne de requête est ignorée', (t) => {
  const m = monde(t);
  for (const adresse of [ADRESSE, `${ADRESSE}?autre=1`]) {
    // un visiteur comme un compte : le comportement d'avant, la nature ne dépend pas de la session
    for (const de of ['rien', 'a']) {
      const r = m.appel('POST', adresse, { de, corps: ficheVide('Prétiré d’essai') });
      assert.equal(r.statut, 201, `${adresse} (${de}) : ${JSON.stringify(r.corps)}`);
      assert.deepEqual(m.ligne(r.corps.personnage.id), { nature: 'pretire', proprietaire_id: null, visibilite: 'tous' }, `${adresse} (${de})`);
      assert.equal(r.corps.proprietaire, null);
    }
  }
});

test('R322 : la copie du prétiré et la création partagent le même rattachement — mêmes niveaux, mêmes refus, la même ligne rangée', (t) => {
  const m = monde(t);
  const pretire = m.appel('POST', ADRESSE, { de: 'rien', corps: ficheVide('Prétiré') }).corps.personnage.id;
  assert.deepEqual([...NIVEAUX_QUI_COPIENT], ['joueur', 'mj', 'createur']);
  for (const de of ['rien', 'cle', 'obs', 'a', 'mj', 'createur']) {
    const copie = m.appel('POST', `${ADRESSE}${pretire}/copie/`, { de, corps: {} });
    const creation = m.creer(de);
    assert.equal(creation.statut, copie.statut, `${de} : mêmes droits`);
    if (copie.statut !== 201) continue;
    const rangee = m.ligne(copie.corps.id);
    assert.deepEqual(m.ligne(creation.corps.personnage.id), rangee, `${de} : la même ligne rangée`);
    assert.deepEqual([rangee.nature, rangee.visibilite], ['joueur', 'privee']);
  }
  // la fonction elle-même : la même décision pour tout appelant, la copie par son 403 propre, la création par le sien
  for (const [u, n, attendu] of [['u-a', 'joueur', true], ['u-mj', 'mj', true], ['u-createur', 'createur', true], ['u-obs', 'observateur', false], [null, null, false], ['u-a', null, false]]) {
    const appelant = u ? { utilisateur: u, niveau: n } : appelantDe(null);
    assert.equal(peutSeRattacher(appelant), attendu, `${u} ${n}`);
    if (attendu) assert.deepEqual(rattachementAuCompte(m.db, appelant, 'refus'), { nature: 'joueur', proprietaire_id: u, visibilite: 'privee' });
    else assert.throws(() => rattachementAuCompte(m.db, appelant, 'refus d’essai'), { statut: 403, message: 'refus d’essai' });
  }
  // un compte absent est refusé à l'écriture, dans la transaction : ni la copie ni la création n'écrivent, et la base n'est pas restée en transaction
  const absent = { utilisateur: 'u-inconnu', niveau: 'joueur' };
  const avant = m.total();
  assert.throws(() => rattachementAuCompte(m.db, absent, 'refus'), { statut: 403 });
  assert.throws(() => copierUnPretire(m.db, pretire, absent), { statut: 403 });
  assert.throws(() => enregistrerFiche(m.db, ficheVide('x'), { appelant: absent, auCompte: true }), { statut: 403 });
  assert.equal(m.total(), avant);
  assert.equal(enregistrerFiche(m.db, ficheVide('x'), { appelant: appelantDe({ u: 'u-a', n: 'joueur' }), auCompte: true }).personnage.visibilite, 'privee');
});

test('R322 : `auCompte` ne vaut que pour une création — une modification garde la nature, le propriétaire et la visibilité de la fiche', (t) => {
  const m = monde(t);
  const prive = appelantDe({ u: 'u-a', n: 'joueur' });
  const neuve = enregistrerFiche(m.db, ficheVide('Neuve'), { appelant: prive, auCompte: true }).personnage;
  const apres = enregistrerFiche(m.db, { ...neuve, surnom: 'Modifiée' }, { id: neuve.id, appelant: prive, auCompte: true }).personnage;
  assert.deepEqual(m.ligne(apres.id), { nature: 'joueur', proprietaire_id: 'u-a', visibilite: 'privee' });
});

test('R322 : le journal dit la création par identifiant, jamais un nom ; la création se compte dans les métriques sans identifiant', (t) => {
  const m = monde(t);
  const id = m.creer('a', 'Nom sentinelle de la fiche neuve').corps.personnage.id;
  assert.ok(m.journal.some((l) => l.includes('fiches :') && l.includes('création') && l.includes('fiche de joueur') && l.includes(id)), m.journal.join('\n'));
  assert.ok(!m.journal.some((l) => /Alice|sentinelle/i.test(l)));
  assert.deepEqual(m.evenements.map(([nom, c]) => [nom, c.detail]), [['fiche', { action: 'creation' }]]);
});

test('R322 et R310 (3) : sur le site de dev, seul le Créateur crée (201) ; le MJ, le Joueur et l’Observateur sont arrêtés par la porte (classe écriture) ; le visiteur et la clé de lecture aussi', (t) => {
  assert.deepEqual(classer('POST', CREER), { classe: 'ecriture', connue: true });
  const m = monde(t, { edition: true });
  const avant = m.total();
  const r = m.creer('createur');
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  assert.deepEqual(m.ligne(r.corps.personnage.id), { nature: 'joueur', proprietaire_id: 'u-createur', visibilite: 'privee' });
  for (const de of ['mj', 'a', 'obs']) {
    const refus = m.creer(de);
    assert.deepEqual([refus.statut, refus.corps.acces, refus.corps.niveau_requis], [403, 'niveau', 'createur'], de);
  }
  assert.equal(m.creer('rien').statut, 401);
  assert.equal(m.creer('cle').statut, 403);
  assert.equal(m.total(), avant + 1);
});
