// Le plan des Règles et l'ordre des races sur le site de dev (serveur/edition-plan.mjs ; lot de l'édition des menus, demande du propriétaire : « En mode
// Edition il faut prévoir de pouvoir changer l'ordre des menu latéraux (par un glisser déposer) », réponses « Règles + Races », « Oui, par une liste »,
// entrées « bientôt » déplaçables, ordre des onglets fixe) :
//   - `ordonner` un menu d'onglet (la liste exacte de ses entrées, sinon 409 ; seules les entrées qui changent de rang au journal) ou un groupe de races
//     (pures ou hybrides : les rangs qu'il occupait, redonnés) ;
//   - l'onglet d'une page (en fin du menu cible ; refusé avant écriture pour une page d'ouverture, un lien, une entrée « bientôt ») ;
//   - une race créée en fin de liste (rang_liste) ; un échec de COMMIT d'une contrainte différée : 422 ;
//   - GET /api/edition/plan/ (le plan vivant), la liste « onglets », l'action `ordre` de /api/v1/ et l'enfant `entrees` en lecture seule.
// Chaque test a sa copie de la base vivante et lit l'état avant d'écrire (le site de dev a pu réordonner les menus).
//   node --test test/serveur-edition-plan.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rangsReordonnes } from '../serveur/edition-plan.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerRaces, comparerRangsDeListe, racesParNature } from '../src/lib/races-db.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('edition-plan');
let compteur = 0;
/** Une base vivante neuve et le service qui l'écrit. */
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/', operations });
  return { db, appel, lot };
}
const ok = (r) => {
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  return r.corps;
};
const menu = (db, onglet) => db.prepare('SELECT id, rang FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id').all(onglet).map((e) => ({ ...e }));
/** Les modifications notées par le dernier lot. */
const notees = (db, lot) => db.prepare('SELECT table_nom, cle, avant, apres FROM modification WHERE lot_id = ? ORDER BY rang').all(lot).map((m) => ({ ...m }));
/** Un autre onglet que `sauf`. */
const autreOnglet = (db, sauf) => db.prepare('SELECT id FROM regles_onglet WHERE id <> ? ORDER BY ordre').all(sauf)[0].id;

test('rangsReordonnes : les rangs occupés redonnés (sans trou ajouté), un doublon rendu consécutif, une place sans rang après tous', () => {
  assert.deepEqual(rangsReordonnes([3, 1, 2]), [1, 2, 3]);
  assert.deepEqual(rangsReordonnes([1, 2, 4]), [1, 2, 4], 'un trou laissé par une page supprimée reste : rien d’autre ne bouge');
  assert.deepEqual(rangsReordonnes([2, 2, 5]), [2, 3, 5]);
  assert.deepEqual(rangsReordonnes([14, null, 15], 27), [14, 15, 28]);
});

test('ordonner un menu : la liste exacte de ses entrées ; seules celles qui changent de rang au journal ; 409, 404 et 400 avant toute écriture', () => {
  const { db, lot } = nouvelle();
  const onglet = 'combats';
  const avant = menu(db, onglet);
  assert.ok(avant.length >= 3);
  const ids = avant.map((e) => e.id);
  const nouvelOrdre = [ids[1], ids[0], ...ids.slice(2)];
  const r = ok(lot([{ op: 'ordonner', onglet, ids: nouvelOrdre }]));
  assert.equal(r.modifications, 2, 'deux entrées échangées : deux lignes au journal');
  assert.deepEqual(menu(db, onglet).map((e) => e.id), nouvelOrdre);
  assert.deepEqual(menu(db, onglet).map((e) => e.rang), avant.map((e) => e.rang), 'les mêmes rangs, dans le nouvel ordre');
  assert.deepEqual(notees(db, r.lot).map((m) => [m.table_nom, JSON.parse(m.cle).id]), [['regles_onglet_entree', ids[1]], ['regles_onglet_entree', ids[0]]]);
  // le même ordre une seconde fois : rien à écrire
  assert.equal(ok(lot([{ op: 'ordonner', onglet, ids: nouvelOrdre }])).lot, null);
  const nombre = db.prepare('SELECT count(*) AS n FROM modification').get().n;
  const refus = [
    [{ op: 'ordonner', onglet, ids: nouvelOrdre.slice(1) }, 409],
    [{ op: 'ordonner', onglet, ids: [...nouvelOrdre.slice(1), 'page:guide/inconnue'] }, 409],
    [{ op: 'ordonner', onglet: 'inconnu', ids: nouvelOrdre }, 404],
    [{ op: 'ordonner', onglet, ids: [nouvelOrdre[0], ...nouvelOrdre] }, 400],
    [{ op: 'ordonner', onglet, races: 'pures', ids: nouvelOrdre }, 400],
    [{ op: 'ordonner', ids: nouvelOrdre }, 400],
  ];
  for (const [op, statut] of refus) assert.equal(lot([op]).statut, statut, JSON.stringify(op));
  const conflit = lot([refus[0][0]]);
  assert.deepEqual(conflit.corps.attendus, nouvelOrdre, '409 : la liste du menu, pour recharger');
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification').get().n, nombre, 'rien d’écrit');
});

test('une entrée « bientôt » se déplace dans son menu comme une page', () => {
  const { db, lot } = nouvelle();
  const onglet = 'exploration';
  // une entrée « bientôt » d'essai, posée dans la copie (aucune aujourd'hui : R184 (1))
  db.prepare("INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id, libelle, adresse) VALUES ('bientot:essai', ?, 900, NULL, 'Bientôt d’essai', NULL)").run(onglet);
  const ids = menu(db, onglet).map((e) => e.id);
  assert.equal(ids.at(-1), 'bientot:essai');
  const nouvelOrdre = ['bientot:essai', ...ids.slice(0, -1)];
  ok(lot([{ op: 'ordonner', onglet, ids: nouvelOrdre }]));
  assert.deepEqual(menu(db, onglet).map((e) => e.id), nouvelOrdre);
});

test('changer l’onglet d’une page : en fin du menu cible ; refusé avant écriture pour une page d’ouverture, un lien, une entrée « bientôt », un onglet inconnu', () => {
  const { db, lot } = nouvelle();
  const ouvertures = new Set(db.prepare('SELECT ouverture_page_id AS id FROM regles_onglet').all().map((o) => o.id));
  const page = db.prepare('SELECT * FROM regles_onglet_entree WHERE page_id IS NOT NULL ORDER BY onglet_id, rang').all().find((e) => !ouvertures.has(e.page_id));
  const cible = autreOnglet(db, page.onglet_id);
  const fin = Math.max(...menu(db, cible).map((e) => e.rang));
  const r = ok(lot([{ op: 'modifier', table: 'regles_onglet_entree', cle: { id: page.id }, valeurs: { onglet_id: cible, rang: 1 } }]));
  const apres = db.prepare('SELECT onglet_id, rang FROM regles_onglet_entree WHERE id = ?').get(page.id);
  assert.deepEqual({ ...apres }, { onglet_id: cible, rang: fin + 1 }, 'en fin du menu cible (un rang donné avec elle est ignoré)');
  assert.deepEqual(notees(db, r.lot).map((m) => [JSON.parse(m.avant), JSON.parse(m.apres)]), [[{ onglet_id: page.onglet_id, rang: page.rang }, { onglet_id: cible, rang: fin + 1 }]]);
  // un rang seul se modifie tel quel
  ok(lot([{ op: 'modifier', table: 'regles_onglet_entree', cle: { id: page.id }, valeurs: { rang: 1 } }]));
  assert.equal(db.prepare('SELECT rang FROM regles_onglet_entree WHERE id = ?').get(page.id).rang, 1);

  db.prepare("INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id, libelle, adresse) VALUES ('bientot:essai', 'combats', 900, NULL, 'Bientôt d’essai', NULL)").run();
  const nombre = db.prepare('SELECT count(*) AS n FROM modification').get().n;
  const ouverture = db.prepare('SELECT id, ouverture_page_id FROM regles_onglet ORDER BY ordre').get();
  const refus = [
    [`page:${ouverture.ouverture_page_id}`, autreOnglet(db, ouverture.id), 409, /ouvre l’onglet/],
    ['lien:regles/artisanat', 'combats', 400, /un lien ne change pas d’onglet/],
    ['bientot:essai', 'exploration', 400, /une entrée « bientôt » ne change pas d’onglet/],
    [page.id, 'inconnu', 400, /Onglet des Règles inconnu/],
  ];
  for (const [id, onglet, statut, message] of refus) {
    const rr = lot([{ op: 'modifier', table: 'regles_onglet_entree', cle: { id }, valeurs: { onglet_id: onglet } }]);
    assert.equal(rr.statut, statut, `${id} : ${JSON.stringify(rr.corps)}`);
    assert.match(rr.corps.erreur, message);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification').get().n, nombre, 'rien d’écrit');
});

test('ordonner un groupe de races : la liste exacte du groupe, les rangs qu’il occupait ; une race créée en fin de liste, dans son groupe', () => {
  const { db, lot } = nouvelle();
  const { pures, hybrides } = racesParNature(db);
  assert.ok(pures.length > 2 && hybrides.length > 2);
  // les groupes et l'ordre de la liste : ceux de lib/races-db.mjs#chargerRaces (la page), `rangListe` compris (fourni à la page : menu, /races/)
  const races = [...chargerRaces(db).races.values()];
  assert.deepEqual(races.filter((x) => x.hybride).sort(comparerRangsDeListe).map((x) => x.id), hybrides.map((x) => x.id));
  assert.deepEqual(races.filter((x) => !x.hybride).sort(comparerRangsDeListe).map((x) => [x.id, x.rangListe]), pures.map((x) => [x.id, x.rang_liste]));
  const rangs = pures.map((r) => r.rang_liste);
  const nouvelOrdre = [...pures.map((r) => r.id)].reverse();
  const r = ok(lot([{ op: 'ordonner', races: 'pures', ids: nouvelOrdre }]));
  const apres = racesParNature(db);
  assert.deepEqual(apres.pures.map((x) => x.id), nouvelOrdre);
  assert.deepEqual(apres.pures.map((x) => x.rang_liste), rangs, 'les rangs du groupe, redonnés dans le nouvel ordre');
  assert.deepEqual(apres.hybrides, hybrides, 'l’autre groupe ne bouge pas');
  assert.equal(r.modifications, nouvelOrdre.filter((id, i) => id !== pures[i].id).length, 'seules les races qui changent de rang au journal');
  assert.equal(lot([{ op: 'ordonner', races: 'hybrides', ids: nouvelOrdre }]).statut, 409, 'les pures données pour les hybrides');
  assert.equal(lot([{ op: 'ordonner', races: 'autres', ids: nouvelOrdre }]).statut, 400);

  // une race créée (hybride) : rang_liste = le plus grand + 1, en fin de son groupe
  const max = db.prepare('SELECT max(rang_liste) AS m FROM race').get().m;
  let nom = 'Race du plan d’essai';
  for (let i = 2; db.prepare('SELECT 1 FROM race WHERE nom = ?').get(nom); i += 1) nom = `Race du plan d’essai ${i}`;
  const id = ok(lot([{ op: 'creer', entite: 'race', valeurs: { nom, nature: 'hybride' } }])).crees[0].id;
  assert.equal(db.prepare('SELECT rang_liste FROM race WHERE id = ?').get(id).rang_liste, max + 1);
  assert.equal(racesParNature(db).hybrides.at(-1).id, id);
  // une race sans rang (NULL : créée par un lot d'avant la 0092) est en fin de son groupe, et en reçoit un quand le groupe est réordonné
  db.prepare('UPDATE race SET rang_liste = NULL WHERE id = ?').run(id);
  const groupe = racesParNature(db).hybrides;
  assert.equal(groupe.at(-1).id, id);
  ok(lot([{ op: 'ordonner', races: 'hybrides', ids: [id, ...groupe.slice(0, -1).map((x) => x.id)] }]));
  assert.equal(racesParNature(db).hybrides[0].id, id);
  assert.ok(db.prepare('SELECT rang_liste FROM race WHERE id = ?').get(id).rang_liste >= 1);
});

test('GET /api/edition/plan/ : onglets dans l’ordre, entrées du menu avec leur sorte, adresse, protection, citations ; races par groupe ; liste « onglets »', () => {
  const { db, appel } = nouvelle();
  const plan = ok(appel('GET', '/api/edition/plan/'));
  const onglets = db.prepare('SELECT id, titre, ouverture_page_id FROM regles_onglet ORDER BY ordre, id').all();
  assert.deepEqual(plan.onglets.map((o) => [o.id, o.titre, o.ouverture]), onglets.map((o) => [o.id, o.titre, o.ouverture_page_id]));
  for (const o of plan.onglets) {
    assert.deepEqual(o.entrees.map((e) => e.id), menu(db, o.id).map((e) => e.id), o.id);
    for (const e of o.entrees) {
      assert.deepEqual(Object.keys(e), ['id', 'sorte', 'rang', 'page_id', 'titre', 'libelle', 'adresse', 'protection', 'citations', 'supprimable'], e.id);
      if (e.sorte === 'page') {
        assert.equal(e.titre, db.prepare('SELECT titre FROM page WHERE id = ?').get(e.page_id).titre);
        assert.equal(e.adresse, `regles/${e.page_id.slice('guide/'.length)}/`);
        assert.ok(Array.isArray(e.protection) && Array.isArray(e.citations));
        assert.equal(e.supprimable, !e.protection.length && !e.citations.some((c) => !c.exemple));
      } else {
        assert.deepEqual([e.titre, e.protection, e.citations, e.supprimable], [null, null, null, false]);
        assert.ok(e.libelle);
      }
    }
    assert.ok(o.entrees.find((e) => e.page_id === o.ouverture).protection.some((r) => r.raison === 'ouverture'), `${o.id} : sa page d’ouverture est protégée`);
  }
  assert.equal(plan.onglets.find((o) => o.id === 'exploration').entrees.find((e) => e.sorte === 'lien').adresse, 'regles/artisanat/');
  assert.deepEqual(plan.races, racesParNature(db));
  assert.deepEqual(JSON.parse(JSON.stringify(ok(appel('GET', '/api/edition/listes/')).onglets)), onglets.map((o) => ({ valeur: o.id, libelle: o.titre })));
  assert.equal(appel('POST', '/api/edition/plan/', {}).statut, 405);
});

test('un échec de COMMIT d’une contrainte vérifiée en fin de transaction (clé différée de regles_onglet) : 422, rien d’écrit', () => {
  const { db, lot } = nouvelle();
  // un déclencheur d'essai (temporaire, dans cette copie) : chaque rang écrit fait ouvrir « Les combats » sur une page hors de son menu ; la clé
  // étrangère composée, différée, ne refuse qu'au COMMIT
  const etrangere = db.prepare("SELECT page_id FROM regles_onglet_entree WHERE onglet_id <> 'combats' AND page_id IS NOT NULL LIMIT 1").get().page_id;
  db.exec(`CREATE TEMP TRIGGER essai_differe AFTER UPDATE OF rang ON regles_onglet_entree BEGIN
    UPDATE regles_onglet SET ouverture_page_id = '${etrangere}' WHERE id = 'combats'; END`);
  const ids = menu(db, 'combats').map((e) => e.id);
  const nombre = db.prepare('SELECT count(*) AS n FROM modification').get().n;
  const r = lot([{ op: 'ordonner', onglet: 'combats', ids: [ids[1], ids[0], ...ids.slice(2)] }]);
  assert.equal(r.statut, 422, JSON.stringify(r.corps));
  assert.match(r.corps.erreur, /clé étrangère/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification').get().n, nombre);
  assert.deepEqual(menu(db, 'combats').map((e) => e.id), ids, 'transaction annulée');
  assert.notEqual(db.prepare("SELECT ouverture_page_id FROM regles_onglet WHERE id = 'combats'").get().ouverture_page_id, etrangere);
  db.exec('DROP TRIGGER essai_differe');
});

test('/api/v1/ : l’action `ordre` d’un onglet des Règles ordonne son menu ; l’enfant `entrees` reste en lecture seule', () => {
  const { db, appel } = nouvelle();
  const ids = menu(db, 'exploration').map((e) => e.id);
  const nouvelOrdre = [...ids].reverse();
  const r = ok(appel('POST', '/api/v1/onglets-des-regles/exploration/ordre/', { ids: nouvelOrdre }));
  assert.equal(r.action, 'ordre');
  assert.deepEqual(menu(db, 'exploration').map((e) => e.id), nouvelOrdre);
  assert.equal(appel('POST', '/api/v1/onglets-des-regles/exploration/ordre/', { ids: nouvelOrdre.slice(1) }).statut, 409);
  const entree = encodeURIComponent(nouvelOrdre[0]);
  for (const [methode, chemin, corps] of [['PATCH', `/api/v1/onglets-des-regles/exploration/entrees/${entree}/`, { rang: 1 }],
    ['DELETE', `/api/v1/onglets-des-regles/exploration/entrees/${entree}/`, undefined], ['POST', '/api/v1/onglets-des-regles/exploration/entrees/', { rang: 1 }]]) {
    const rr = appel(methode, chemin, corps);
    assert.equal(rr.statut, 405, `${methode} ${chemin} : ${JSON.stringify(rr.corps)}`);
    assert.equal(rr.entetes.Allow, 'GET');
  }
});
