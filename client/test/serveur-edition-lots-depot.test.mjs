// Le dépôt appliqué aussitôt (R291, qui remplace R275 (4) : « Direct » ; docs/serveur.md, « Lots de changements (service) » et « Accès au site de dev » ;
// serveur/edition-lots.mjs#deposerEtAppliquer, serveur/acces.mjs#depot) :
//   - tant que la clé de dépôt n'est pas posée (ou sans aucun réglage d'accès), un dépôt reste une proposition qui attend le clic : l'état sûr ;
//   - une fois posée, la clé de lecture (que détient aussi la CI) ne dépose plus ; la clé de dépôt ou une session Créateur déposent, et le lot est appliqué aussitôt,
//     par le même code que le clic (essai à blanc sur une copie, une transaction, contrôles du contenu rejoués) ;
//   - un lot que l'essai ou l'application refuse n'écrit rien : il est enregistré « refuse » avec ses motifs ;
//   - `verrous_ouverts` du dépôt suit la règle du clic (seul ce que le gel lève, R218, R219, s'ouvre) mais est réservé à une session Créateur : la clé de dépôt est refusée ;
//   - le journal et l'historique se tiennent comme avant ; rien ne part en production sans « Effectuer la mise à jour » (les lots ne s'ouvrent pas en production) ;
//   - « tout recalculer » s'aligne ; les propositions déposées avant restent décidées par le clic du propriétaire.
// Aucune valeur de règle figée : les lignes se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/serveur-edition-lots-depot.test.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ENTETE_CLE } from '../serveur/acces.mjs';
import { poserLAcces as poserLAccesCommun } from './aide-acces-d-essai.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { raisonDuGel } from '../serveur/edition.mjs';
import { decisionsCitees } from '../serveur/edition-lots.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-lots-depot');
const JSON_ = { 'content-type': 'application/json' };
let n = 0;

/** Une base vivante neuve (règles de l'import) et le service qui l'écrit ; l'essai tourne dans le fil du service. `edition: false` : la production. */
function nouvelle({ acces = null, edition = true } = {}) {
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin;
  const db = ouvrirBaseVivante(chemin);
  const service = { base: () => db, etat: () => ({}), edition, journal: () => {}, lots: { enArrierePlan: false }, ...(acces ? { acces } : {}) };
  const appel = async (methode, adresse, corps, entetes = {}) =>
    traiter({ methode, chemin: adresse, entetes: { ...JSON_, ...entetes }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const un = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  return { db, chemin, service, appel, un };
}

/** La porte d'essai : session Créateur (`avecCreateur`), clé de lecture, et la clé de dépôt si `depot` ; `poserLaCleDeDepot` la pose après coup (le service relit le fichier). */
function poserLAcces({ depot }) {
  const a = poserLAccesCommun({ prefixe: 'edition-lots-depot', depot });
  return { ...a, avecCreateur: a.createur };
}

const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const refus = (r, statut) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const metiers = (db, k) => db.prepare('SELECT id, description FROM metier ORDER BY id LIMIT ?').all(k).map((m) => ({ ...m }));
const description = (m, id) => m.un('SELECT description FROM metier WHERE id = ?', id).description;
const texteDuTest = (marque) => `Texte posé par le dépôt ${marque} ${process.pid}`;
const modifierUnMetier = (m, texte) => ({ table: 'metier', cle: { id: m.id }, operation: 'modifier', avant: { description: m.description }, apres: { description: texte } });
const unLot = (operations, plus = {}) => ({ format: 'maverick-lot/1', titre: `Lot de dépôt ${(n += 1)}`, nature: 'code', operations, ...plus });
const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;
const LOTS = '/api/edition/lots/';
const comptes = (db) => ({
  lots: db.prepare('SELECT count(*) AS n FROM modification_lot').get().n,
  modifications: db.prepare('SELECT count(*) AS n FROM modification').get().n,
  propositions: db.prepare('SELECT count(*) AS n FROM lot_de_changements').get().n,
  proposes: db.prepare("SELECT count(*) AS n FROM lot_de_changements WHERE etat = 'propose'").get().n,
});

test('tant que la clé de dépôt n’est pas posée : la clé de lecture et une session Créateur déposent une proposition qui attend le clic, comme avant (état sûr)', async () => {
  const a = poserLAcces({ depot: false });
  const m = nouvelle({ acces: a.acces });
  const [metier] = metiers(m.db, 2);
  const [, autre] = metiers(m.db, 2);

  const parLaCle = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(metier, texteDuTest('lecture'))]), a.avecCle), 201);
  assert.equal(parLaCle.etat, 'propose');
  assert.equal(parLaCle.application, null);
  assert.equal(description(m, metier.id), metier.description, 'rien n’est écrit dans le contenu');
  const parUnCreateur = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(autre, texteDuTest('créateur'))]), a.avecCreateur), 201);
  assert.equal(parUnCreateur.etat, 'propose', 'une session Créateur elle-même ne fait rien appliquer tant que la clé de dépôt n’est pas posée');
  assert.equal(description(m, autre.id), autre.description);
  // le clic du propriétaire reste la seule porte d'application
  refus(await m.appel('POST', adresse(parLaCle.id, 'appliquer/'), {}, a.avecCle), 403);
  assert.equal(ok(await m.appel('POST', adresse(parLaCle.id, 'appliquer/'), {}, a.avecCreateur)).etat, 'applique');
  assert.equal(description(m, metier.id), texteDuTest('lecture'));
});

test('sans aucun réglage d’accès (tests, local) : « sans réglage, tout est permis » mais le dépôt reste une proposition (le mode direct est un choix du réglage)', async () => {
  const m = nouvelle();
  const [metier] = metiers(m.db, 1);
  const lot = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(metier, texteDuTest('ouvert'))])), 201);
  assert.equal(lot.etat, 'propose');
  assert.equal(description(m, metier.id), metier.description);
  assert.equal(ok(await m.appel('POST', adresse(lot.id, 'appliquer/'), {})).etat, 'applique', 'sans réglage, le clic s’ouvre à tous, comme avant');
});

test('la clé de dépôt posée : la clé de lecture ne dépose plus (403 explicite), sans clé 401, rien n’est enregistré ; la lecture passe toujours', async () => {
  const a = poserLAcces({ depot: true });
  const m = nouvelle({ acces: a.acces });
  const [metier] = metiers(m.db, 1);
  const avant = comptes(m.db);
  const lot = unLot([modifierUnMetier(metier, texteDuTest('refusé'))]);

  const parLaCle = refus(await m.appel('POST', LOTS, lot, a.avecCle), 403);
  assert.equal(parLaCle.acces, 'cle_de_depot');
  assert.match(parLaCle.erreur, /clé de dépôt est nécessaire/);
  const sansRien = refus(await m.appel('POST', LOTS, lot), 401);
  assert.equal(sansRien.acces, 'cle_de_depot');
  refus(await m.appel('POST', LOTS, lot, { [ENTETE_CLE]: `${a.cleDeDepot}x` }), 401);
  refus(await m.appel('POST', LOTS, lot, { 'x-maverick-token': a.cleDeDepot }), 401);
  // refaire un essai et « tout recalculer » sont des dépôts : la clé de lecture n'y touche plus
  refus(await m.appel('POST', adresse('00000000-0000-4000-8000-000000000000', 'essai/'), {}, a.avecCle), 403);
  refus(await m.appel('POST', `${LOTS}recalcul/`, {}, a.avecCle), 403);
  assert.deepEqual(comptes(m.db), avant, 'aucun lot enregistré, rien écrit');
  assert.equal(description(m, metier.id), metier.description);

  // la lecture, elle, reste ouverte à la clé de lecture et à la clé de dépôt
  ok(await m.appel('GET', LOTS, undefined, a.avecCle));
  ok(await m.appel('GET', LOTS, undefined, a.avecDepot()));
  ok(await m.appel('GET', '/api/edition/journal/', undefined, a.avecDepot()));
  // la clé de dépôt n'est pas une clé d'écriture : appliquer, refuser, annuler restent à une session Créateur, comme toute autre écriture
  const inconnu = '00000000-0000-4000-8000-000000000000';
  for (const [methode, chemin] of [['POST', adresse(inconnu, 'appliquer/')], ['POST', adresse(inconnu, 'refuser/')], ['POST', adresse(inconnu, 'annuler/')],
    ['POST', adresse(inconnu, 'lignes/1/annuler/')], ['GET', adresse(inconnu, 'lignes/1/annulation/')], ['POST', '/api/edition/'], ['POST', '/api/mise-a-jour/lancer/']]) {
    const r = refus(await m.appel(methode, chemin, methode === 'POST' ? {} : undefined, a.avecDepot()), 403);
    assert.equal(r.acces, 'cle', `${methode} ${chemin}`);
  }
});

test('la clé de dépôt dépose et le lot est appliqué aussitôt : le contenu change, le lot du journal a la nature et la décision, ses modifications restent en attente, le bilan dit par quoi', async () => {
  const a = poserLAcces({ depot: true });
  const m = nouvelle({ acces: a.acces });
  const [un, deux] = metiers(m.db, 2);
  const avant = comptes(m.db);

  const lot = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(un, texteDuTest('un'))], { nature: 'decision', decision: 'R291', titre: 'Un lot de décision déposé directement' }), a.avecDepot()), 201);
  assert.equal(lot.etat, 'applique');
  assert.equal(description(m, un.id), texteDuTest('un'));
  assert.deepEqual(lot.bilan.application, { directe: true, par: 'cle_de_depot' });
  assert.equal(lot.application.par, 'cle_de_depot');
  assert.equal(lot.bilan.ecrites, 1);
  assert.ok(lot.lot_id && lot.decide_le, 'le lot du journal et l’instant de l’application');
  // le journal : même nature, même décision, ses modifications en attente (comme une saisie : rien ne part sans « Effectuer la mise à jour »)
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', lot.lot_id), { nature: 'decision', decision: 'R291' });
  assert.ok(m.db.prepare("SELECT count(*) AS n FROM modification WHERE lot_id = ? AND etat = 'en_attente'").get(lot.lot_id).n >= 1);
  assert.equal(m.db.prepare("SELECT count(*) AS n FROM modification WHERE lot_id = ? AND etat <> 'en_attente'").get(lot.lot_id).n, 0, 'rien n’est intégré ni livré');
  assert.equal(comptes(m.db).lots, avant.lots + 1);
  assert.equal(comptes(m.db).proposes, 0, 'aucun lot refusé ne reste « propose »');
  // la liste et la lecture disent comment le lot est entré
  const liste = ok(await m.appel('GET', LOTS, undefined, a.avecDepot())).lots.find((l) => l.id === lot.id);
  assert.deepEqual(liste.application, { directe: true, par: 'cle_de_depot' });

  // une session Créateur dépose et applique aussi
  const parUnCreateur = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(deux, texteDuTest('deux'))]), a.avecCreateur), 201);
  assert.equal(parUnCreateur.etat, 'applique');
  assert.deepEqual(parUnCreateur.bilan.application, { directe: true, par: 'createur' });
  assert.equal(description(m, deux.id), texteDuTest('deux'));
  // un lot plus tard annulé par le propriétaire : le journal d'annulation est celui du lot entier, rien de plus à dire ici
  assert.equal(ok(await m.appel('POST', adresse(lot.id, 'annuler/'), {}, a.avecCreateur)).etat, 'annule');
  assert.equal(description(m, un.id), un.description);
});

test('un lot que l’essai refuse n’écrit rien : il est enregistré « refuse » avec ses motifs, 409 avec le lot ; le contenu et le journal ne bougent pas', async () => {
  const a = poserLAcces({ depot: true });
  const m = nouvelle({ acces: a.acces });
  const [bon, mauvais] = metiers(m.db, 2);
  const peutFabriquer = m.un('SELECT peut_fabriquer AS v FROM metier WHERE id = ?', mauvais.id).v;
  const lot = unLot([modifierUnMetier(bon, texteDuTest('bon')), { table: 'metier', cle: { id: mauvais.id }, operation: 'modifier', avant: { peut_fabriquer: peutFabriquer }, apres: { peut_fabriquer: 1 - peutFabriquer } }]);
  const avant = comptes(m.db);

  const r = refus(await m.appel('POST', LOTS, lot, a.avecDepot()), 409);
  assert.match(r.erreur, /refusé, rien n’est écrit/);
  assert.ok(r.motifs.some((x) => /opération 2/.test(x)), JSON.stringify(r.motifs));
  assert.equal(r.lot.etat, 'refuse');
  assert.deepEqual(r.lot.refus.motifs, r.motifs);
  assert.equal(r.lot.bilan, null, 'un lot refusé n’a pas de bilan');
  assert.equal(r.lot.essai.verdict, 'a_corriger');
  assert.equal(description(m, bon.id), bon.description, 'la bonne opération n’est pas écrite non plus');
  assert.deepEqual({ ...comptes(m.db), propositions: 0 }, { ...avant, propositions: 0 }, 'ni lot du journal ni modification');
  assert.equal(comptes(m.db).propositions, avant.propositions + 1, 'le lot refusé reste lisible');
  assert.equal(comptes(m.db).proposes, 0);
  assert.equal(ok(await m.appel('GET', adresse(r.lot.id), undefined, a.avecDepot())).etat, 'refuse');
  // un refus n'est pas rejouable : il ne s'applique plus, même au clic
  refus(await m.appel('POST', adresse(r.lot.id, 'appliquer/'), {}, a.avecCreateur), 409);

  // un problème du contenu né du lot (db:check) refuse de même, avec son motif
  const metier = m.un('SELECT id, nom_cle FROM metier ORDER BY id LIMIT 1');
  const fautif = refus(await m.appel('POST', LOTS, unLot([{ table: 'metier', cle: { id: metier.id }, operation: 'modifier', avant: { nom_cle: metier.nom_cle }, apres: { nom_cle: 'une-cle-qui-n-est-pas-celle-du-nom' } }]), a.avecDepot()), 409);
  assert.ok(fautif.motifs.some((x) => x.includes('nom_cle')), JSON.stringify(fautif.motifs));
  assert.equal(m.un('SELECT nom_cle FROM metier WHERE id = ?', metier.id).nom_cle, metier.nom_cle);
  assert.equal(comptes(m.db).proposes, 0);

  // rien à écrire (la valeur est déjà celle du lot) : refusé aussi, pas de lot du journal vide
  const dejaLa = refus(await m.appel('POST', LOTS, unLot([modifierUnMetier({ id: bon.id, description: 'une autre valeur d’avant' }, bon.description)]), a.avecDepot()), 409);
  assert.equal(dejaLa.lot.etat, 'refuse');
  assert.equal(comptes(m.db).lots, avant.lots);
});

test('un lot mal formé est refusé en 400 avant tout enregistrement, avec le rang de l’opération ; une valeur changée depuis (le site prime) n’est pas écrite', async () => {
  const a = poserLAcces({ depot: true });
  const m = nouvelle({ acces: a.acces });
  const [un, deux] = metiers(m.db, 2);
  const avant = comptes(m.db);
  const mal = refus(await m.appel('POST', LOTS, unLot([{ table: 'metier', cle: { id: un.id }, operation: 'modifier', avant: { description: un.description }, apres: { description: 'x' }, inconnue: 1 }]), a.avecDepot()), 400);
  assert.ok(mal.erreurs.length >= 1 && mal.erreurs[0].rang === 1);
  refus(await m.appel('POST', LOTS, { ...unLot([modifierUnMetier(un, 'x')]), verrous_ouverts: 'R218' }, a.avecCreateur), 400);
  assert.deepEqual(comptes(m.db), avant, 'rien d’enregistré');

  // la valeur d'avant du lot n'est plus celle du site : cette opération n'est pas écrite, l'autre l'est ; le bilan la liste
  m.db.prepare('UPDATE metier SET description = ? WHERE id = ?').run(texteDuTest('site'), un.id);
  const lot = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(un, texteDuTest('lot un')), modifierUnMetier(deux, texteDuTest('lot deux'))]), a.avecDepot()), 201);
  assert.equal(lot.etat, 'applique');
  assert.equal(lot.bilan.changees, 1);
  assert.equal(description(m, un.id), texteDuTest('site'), 'le site prime');
  assert.equal(description(m, deux.id), texteDuTest('lot deux'));
});

test('verrous : seule une session Créateur les ouvre au dépôt (`verrous_ouverts`, enregistrés dans le lot) ; la clé de dépôt est refusée, et un lot qui touche un verrou est « refuse » avec les R… à ouvrir', async () => {
  const a = poserLAcces({ depot: true });
  const m = nouvelle({ acces: a.acces });
  const monnaie = m.un('SELECT id, remarque FROM monnaie ORDER BY id LIMIT 1');
  const citees = decisionsCitees(raisonDuGel('monnaie', monnaie));
  assert.ok(citees.length >= 1);
  const lotDeMonnaie = (texte, plus = {}) => ({ ...unLot([{ table: 'monnaie', cle: { id: monnaie.id }, operation: 'modifier', avant: { remarque: monnaie.remarque }, apres: { remarque: texte } }]), ...plus });
  const intacte = () => assert.equal(m.un('SELECT remarque FROM monnaie WHERE id = ?', monnaie.id).remarque, monnaie.remarque);
  const avant = comptes(m.db);

  // clé de dépôt, sans verrous_ouverts : le lot est refusé et enregistré « refuse », les R… à ouvrir dans `refus`
  const sans = refus(await m.appel('POST', LOTS, lotDeMonnaie(texteDuTest('sans')), a.avecDepot()), 409);
  assert.ok(sans.motifs.some((x) => citees.every((d) => x.includes(d)) && /session Créateur/.test(x)), JSON.stringify(sans.motifs));
  assert.equal(sans.lot.etat, 'refuse');
  assert.deepEqual(sans.lot.refus.verrous, citees);
  intacte();
  // clé de dépôt avec verrous_ouverts : refusé (403), même vide ; rien n'est écrit ni enregistré
  const propositions = comptes(m.db).propositions;
  for (const verrous of [citees, [], ['R1']]) {
    const r = refus(await m.appel('POST', LOTS, lotDeMonnaie(texteDuTest('clé'), { verrous_ouverts: verrous }), a.avecDepot()), 403);
    assert.match(r.erreur, /demande une session Créateur/);
  }
  intacte();
  assert.equal(comptes(m.db).propositions, propositions, 'refusé avant tout enregistrement');
  assert.equal(comptes(m.db).lots, avant.lots);

  // une session Créateur : un autre numéro n'ouvre rien ; le bon numéro écrit, enregistré dans le lot
  refus(await m.appel('POST', LOTS, lotDeMonnaie(texteDuTest('autre'), { verrous_ouverts: ['R1'] }), a.avecCreateur), 409);
  intacte();
  const texte = texteDuTest('avec');
  const avec = ok(await m.appel('POST', LOTS, lotDeMonnaie(texte, { verrous_ouverts: citees }), a.avecCreateur), 201);
  assert.equal(avec.etat, 'applique');
  assert.deepEqual(avec.verrous_ouverts, citees, 'enregistré dans le lot');
  assert.deepEqual(avec.bilan.verrous_ouverts, citees);
  assert.deepEqual(avec.bilan.application, { directe: true, par: 'createur' });
  assert.equal(m.un('SELECT remarque FROM monnaie WHERE id = ?', monnaie.id).remarque, texte);
  assert.equal(avec.contenu.verrous_ouverts, undefined, '`verrous_ouverts` n’est pas dans le lot déposé : il est enregistré à part');
  // l'ouverture ne vaut que pour ce lot : l'édition ordinaire refuse toujours la monnaie
  refus(await m.appel('POST', '/api/edition/', { page: 'essai', operations: [{ op: 'modifier', table: 'monnaie', cle: { id: monnaie.id }, valeurs: { abreviation: 'x' } }] }, a.avecCreateur), 409);
});

test('« tout recalculer » s’aligne : la clé de dépôt applique le lot de nature « code » aussitôt ; sans clé de dépôt posée il reste proposé', async () => {
  const a = poserLAcces({ depot: false });
  const m = nouvelle({ acces: a.acces });
  const premier = await m.appel('POST', `${LOTS}recalcul/`, {}, a.avecCle);
  if (premier.statut === 201) ok(await m.appel('POST', adresse(premier.corps.lot.id, 'appliquer/'), {}, a.avecCreateur)); // la base part de ce que le code dérive
  else ok(premier);
  const page = m.un("SELECT id, corps_md FROM page WHERE id GLOB 'classes/*' AND corps_md IS NOT NULL ORDER BY id LIMIT 1");
  m.db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`Corps périmé du test ${page.id}`, page.id);

  const propose = ok(await m.appel('POST', `${LOTS}recalcul/`, {}, a.avecCle), 201);
  assert.equal(propose.lot.etat, 'propose');
  assert.equal(m.un('SELECT corps_md FROM page WHERE id = ?', page.id).corps_md, `Corps périmé du test ${page.id}`, 'rien n’est écrit');
  ok(await m.appel('POST', adresse(propose.lot.id, 'refuser/'), {}, a.avecCreateur));

  a.poserLaCleDeDepot();
  refus(await m.appel('POST', `${LOTS}recalcul/`, {}, a.avecCle), 403);
  const direct = ok(await m.appel('POST', `${LOTS}recalcul/`, {}, a.avecDepot()), 201);
  assert.equal(direct.lot.etat, 'applique');
  assert.equal(direct.lot.nature, 'code');
  assert.deepEqual(direct.lot.bilan.application, { directe: true, par: 'cle_de_depot' });
  assert.equal(m.un('SELECT corps_md FROM page WHERE id = ?', page.id).corps_md, page.corps_md, 'le corps que le code dérive des tables');
  assert.equal(ok(await m.appel('POST', `${LOTS}recalcul/`, {}, a.avecDepot())).lot, null, 'plus d’écart');
});

test('une proposition déposée avant la clé de dépôt reste « propose » (rien n’est appliqué en douce) : le clic d’un Créateur l’applique ou la refuse', async () => {
  const a = poserLAcces({ depot: false });
  const m = nouvelle({ acces: a.acces });
  const [un, deux] = metiers(m.db, 2);
  const enAttente = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(un, texteDuTest('attend'))]), a.avecCle), 201);
  const aRefuser = ok(await m.appel('POST', LOTS, unLot([modifierUnMetier(deux, texteDuTest('refusée'))]), a.avecCle), 201);

  a.poserLaCleDeDepot();
  const apres = ok(await m.appel('GET', adresse(enAttente.id), undefined, a.avecCle));
  assert.equal(apres.etat, 'propose');
  assert.equal(description(m, un.id), un.description);
  // ni la clé de lecture ni la clé de dépôt n'appliquent : seule une session Créateur
  refus(await m.appel('POST', adresse(enAttente.id, 'appliquer/'), {}, a.avecCle), 403);
  refus(await m.appel('POST', adresse(enAttente.id, 'appliquer/'), {}, a.avecDepot()), 403);
  assert.equal(ok(await m.appel('POST', adresse(enAttente.id, 'appliquer/'), {}, a.avecCreateur)).etat, 'applique');
  assert.equal(description(m, un.id), texteDuTest('attend'));
  assert.equal(ok(await m.appel('POST', adresse(aRefuser.id, 'refuser/'), {}, a.avecCreateur)).etat, 'refuse');
  assert.equal(description(m, deux.id), deux.description);
  // le bilan d'un clic ne dit pas « dépôt direct »
  assert.equal(m.un('SELECT json_extract(bilan, \'$.application\') AS a FROM lot_de_changements WHERE id = ?', enAttente.id).a, null);
});

test('en production (sans édition), les lots répondent 403 avant tout : le dépôt n’écrit rien, même avec les clés', async () => {
  const a = poserLAcces({ depot: true });
  const m = nouvelle({ acces: a.acces, edition: false });
  const [un] = metiers(m.db, 1);
  const avant = comptes(m.db);
  const r = refus(await m.appel('POST', LOTS, unLot([modifierUnMetier(un, texteDuTest('production'))]), a.avecDepot()), 403);
  assert.match(r.erreur, /site de dev/);
  refus(await m.appel('POST', `${LOTS}recalcul/`, {}, a.avecDepot()), 403);
  assert.deepEqual(comptes(m.db), avant);
  assert.equal(description(m, un.id), un.description);
});
