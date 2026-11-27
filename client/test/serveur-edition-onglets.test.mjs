// Le titre d'un onglet des Règles (regles_onglet.titre) s'ouvre à l'édition du site de dev (R319 (5), réponse « Ouvrir le titre, adresses renommées » du
// propriétaire, 2026-11-27, qui remplace « Non, fixe » pour le titre seul ; serveur/edition-plan.mjs#domainesDuPlan `onglet`, lib/edition-modele.mjs#TABLES) :
//   - un lot d'édition (POST /api/edition/) et l'API (PATCH /api/v1/onglets-des-regles/<onglet>/) modifient le titre : obligatoire, d'une ligne, qui n'est
//     pas celui d'un autre onglet (409) ; le journal le note ; l'identifiant et l'adresse (`regles/<id>/`) ne bougent pas ;
//   - un lot de changements (POST /api/edition/lots/) le modifie aussi, et le propriétaire annule la ligne seule (R291) ;
//   - le reste de l'onglet reste fermé à l'édition : l'ordre, la page d'ouverture (400), ni création ni suppression d'onglet.
// Chaque test a sa copie de la base vivante et lit l'état avant d'écrire (le site de dev a pu renommer un onglet) : les titres écrits sont ceux du test.
//   node --test test/serveur-edition-onglets.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { TABLES } from '../src/lib/edition-modele.mjs';
import { adresseDeLOnglet, lireLeMenu } from '../src/lib/menu-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-onglets');
let compteur = 0;
/** Une base vivante neuve et le service qui l'écrit (sans réglage d'accès : tout est ouvert). */
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan: false } };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/', operations });
  return { db, appel, lot };
}
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const refus = (r, statut) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
/** Les onglets tels que la base les range (l'état avant d'écrire). */
const onglets = (db) => db.prepare('SELECT id, titre, ordre, ouverture_page_id FROM regles_onglet ORDER BY ordre, id').all().map((o) => ({ ...o }));
const un = (db, id) => ({ ...db.prepare('SELECT id, titre, ordre, ouverture_page_id FROM regles_onglet WHERE id = ?').get(id) });
const titreDuTest = (marque) => `Onglet d’essai ${marque} ${process.pid}`;
const renommer = (id, titre) => ({ op: 'modifier', table: 'regles_onglet', cle: { id }, valeurs: { titre } });
const journal = (db, lotId) => db.prepare('SELECT table_nom, cle, avant, apres FROM modification WHERE lot_id = ? ORDER BY rang').all(lotId).map((m) => ({ ...m }));

test('R319 : TABLES n’ouvre que le titre d’un onglet des Règles', () => {
  assert.deepEqual(Object.keys(TABLES.regles_onglet.colonnes), ['titre']);
  assert.equal(TABLES.regles_onglet.colonnes.titre.requis, true);
});

test('R319 : un lot d’édition renomme un onglet : le titre change, noté au journal, l’identifiant et l’adresse ne bougent pas, les listes et le menu suivent', () => {
  const { db, lot, appel } = nouvelle();
  const [premier] = onglets(db);
  const adresseAvant = adresseDeLOnglet(premier);
  const titre = titreDuTest('renommé');
  const r = ok(lot([renommer(premier.id, titre)]));
  assert.equal(r.modifications, 1);
  assert.deepEqual(un(db, premier.id), { ...premier, titre }, 'seul le titre change');
  assert.deepEqual(journal(db, r.lot).map((m) => [m.table_nom, JSON.parse(m.cle), JSON.parse(m.avant), JSON.parse(m.apres)]), [['regles_onglet', { id: premier.id }, { titre: premier.titre }, { titre }]]);
  // l'adresse que le menu lit est celle d'avant : seul le libellé suit le titre (un lot à part fera suivre l'adresse)
  const [entree] = lireLeMenu(db, [{ label: 'Écrit', onglet: premier.id }]);
  assert.equal(entree.libelle, titre);
  assert.equal(entree.href, adresseAvant);
  // la liste « onglets » des formulaires et le plan vivant disent le nouveau titre
  assert.equal(ok(appel('GET', '/api/edition/listes/')).onglets.find((o) => o.valeur === premier.id).libelle, titre);
  assert.equal(ok(appel('GET', '/api/edition/plan/')).onglets.find((o) => o.id === premier.id).titre, titre);
  // un renommage identique à l’actuel n’écrit rien
  assert.equal(ok(lot([renommer(premier.id, titre)])).modifications, 0);
});

test('R319 : un titre obligatoire, d’une ligne, qui n’est pas celui d’un autre onglet (409, même écrit autrement) ; un onglet inconnu : 404 ; rien n’est écrit', () => {
  const { db, lot } = nouvelle();
  const avant = onglets(db);
  const [a, b] = avant;
  const nombre = db.prepare('SELECT count(*) AS n FROM modification').get().n;
  for (const vide of ['', '   ', null]) assert.match(refus(lot([renommer(a.id, vide)]), 400).erreur, /obligatoire/, JSON.stringify(vide));
  refus(lot([renommer(a.id, { x: 1 })]), 400); // pas un texte
  // le titre d'un autre onglet : refusé, quelle que soit la casse ou la ponctuation (la comparaison est celle de `normalize`)
  const doublon = refus(lot([renommer(a.id, b.titre.toUpperCase())]), 409);
  assert.match(doublon.erreur, /déjà le nom de l’onglet/);
  assert.equal(doublon.onglet, b.id);
  assert.match(refus(lot([renommer(a.id, ` ${b.titre} `)]), 409).erreur, /déjà le nom/);
  refus(lot([renommer('onglet-inconnu', titreDuTest('inconnu'))]), 404);
  assert.deepEqual(onglets(db), avant);
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification').get().n, nombre);
  // un titre sur plusieurs lignes devient une ligne
  const r = ok(lot([renommer(a.id, `${titreDuTest('ligne')}\n  suite`)]));
  assert.equal(r.modifications, 1);
  assert.equal(un(db, a.id).titre, `${titreDuTest('ligne')} suite`);
});

test('R319 : échanger deux titres dans un même lot passe (le titre d’un onglet est libre une fois renommé), le reste de l’onglet reste fermé (400) et rien n’est créé ni supprimé', () => {
  const { db, lot } = nouvelle();
  const [a, b] = onglets(db);
  const t = titreDuTest('tampon');
  ok(lot([renommer(a.id, t), renommer(b.id, a.titre)]));
  assert.deepEqual([un(db, a.id).titre, un(db, b.id).titre], [t, a.titre]);
  // l'ordre et la page d'ouverture ne se modifient pas depuis l'édition
  const avant = onglets(db);
  for (const colonne of ['ordre', 'ouverture_page_id', 'id']) {
    const r = refus(lot([{ op: 'modifier', table: 'regles_onglet', cle: { id: a.id }, valeurs: { [colonne]: colonne === 'ordre' ? 9 : 'guide/autre' } }]), 400);
    assert.match(r.erreur, /ne se modifie pas ici/, colonne);
  }
  refus(lot([{ op: 'modifier', table: 'regles_onglet', cle: { id: a.id }, valeurs: { titre: titreDuTest('mêlé'), ordre: 9 } }]), 400);
  assert.deepEqual(onglets(db), avant, 'un lot refusé n’écrit rien, titre compris');
  // ni création ni suppression d'onglet
  refus(lot([{ op: 'creer', entite: 'regles_onglet', valeurs: { titre: titreDuTest('nouveau') } }]), 400);
  refus(lot([{ op: 'supprimer', entite: 'regles_onglet', cle: { id: a.id } }]), 400);
  assert.deepEqual(onglets(db), avant);
});

test('R319 : /api/v1/ modifie le titre d’un onglet (PATCH) et lui seul ; ni création ni suppression ; l’enfant `entrees` reste en lecture seule', () => {
  const { db, appel } = nouvelle();
  const [a, b] = onglets(db);
  const titre = titreDuTest('api');
  const r = ok(appel('PATCH', `/api/v1/onglets-des-regles/${a.id}/`, { titre }));
  assert.equal(r.element.titre, titre);
  assert.deepEqual(un(db, a.id), { ...a, titre });
  assert.equal(ok(appel('GET', `/api/v1/onglets-des-regles/${a.id}/`)).element.titre, titre);
  // les refus : un titre pris (409), vide (400), une autre colonne (400)
  refus(appel('PATCH', `/api/v1/onglets-des-regles/${a.id}/`, { titre: b.titre }), 409);
  refus(appel('PATCH', `/api/v1/onglets-des-regles/${a.id}/`, { titre: '' }), 400);
  for (const corps of [{ ordre: 9 }, { ouverture_page_id: 'guide/autre' }, { titre: titreDuTest('mêlé'), ordre: 9 }]) refus(appel('PATCH', `/api/v1/onglets-des-regles/${a.id}/`, corps), 400);
  assert.deepEqual(un(db, a.id), { ...a, titre });
  // ni création ni suppression (la ressource n'en donne pas)
  assert.equal(appel('POST', '/api/v1/onglets-des-regles/', { id: 'nouveau', titre: titreDuTest('nouveau') }).statut, 405);
  assert.equal(appel('DELETE', `/api/v1/onglets-des-regles/${a.id}/`).statut, 405);
  assert.deepEqual(onglets(db).map((o) => o.id), [a.id, ...onglets(db).slice(1).map((o) => o.id)]);
  assert.equal(appel('PATCH', `/api/v1/onglets-des-regles/${a.id}/entrees/x/`, { rang: 1 }).statut, 405);
});

test('R319, R291 : un lot de changements renomme un onglet ; refusé si le titre est vide ou pris ; le propriétaire annule la ligne seule et le titre revient', async () => {
  const { db, appel } = nouvelle();
  const [a, b] = onglets(db);
  const titre = titreDuTest('lot');
  const unLot = (operations) => ({ format: 'maverick-lot/1', titre: `Lot d’onglet ${(compteur += 1)}`, nature: 'code', operations });
  const modif = (o, apres) => ({ table: 'regles_onglet', cle: { id: o.id }, operation: 'modifier', avant: { titre: o.titre }, apres: { titre: apres } });
  const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;
  const nombre = () => db.prepare('SELECT count(*) AS n FROM modification').get().n;

  // un titre pris ou vide : le lot n'entre pas, rien n'est écrit
  const avant = nombre();
  for (const mauvais of [b.titre, '']) {
    const proposition = (await appel('POST', '/api/edition/lots/', unLot([modif(a, mauvais)]))).corps;
    const tentative = await appel('POST', adresse(proposition.id, 'appliquer/'), {});
    assert.ok(tentative.statut >= 400, `${JSON.stringify(mauvais)} : ${tentative.statut} ${JSON.stringify(tentative.corps)}`);
    assert.equal(un(db, a.id).titre, a.titre);
  }
  assert.equal(nombre(), avant);

  // un titre libre : appliqué, noté, et la ligne s'annule seule
  const proposition = ok(await appel('POST', '/api/edition/lots/', unLot([modif(a, titre)])), 201);
  const applique = ok(await appel('POST', adresse(proposition.id, 'appliquer/'), {}));
  assert.equal(applique.etat, 'applique');
  assert.equal(un(db, a.id).titre, titre);
  const lignes = ok(await appel('GET', adresse(applique.id))).lignes;
  assert.equal(lignes.length, 1);
  const annule = ok(await appel('POST', adresse(applique.id, `lignes/${lignes[0].n}/annuler/`), {}));
  assert.equal(annule.etat, 'annule');
  assert.equal(un(db, a.id).titre, a.titre, 'le titre d’avant est remis');
  assert.deepEqual(un(db, a.id), a, 'rien d’autre n’a bougé');
});
