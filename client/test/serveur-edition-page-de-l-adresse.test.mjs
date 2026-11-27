// Le site de dev avant la refabrication (décision R316, docs/chantier-adresses.md §5) : une page renommée a déjà sa nouvelle adresse en base, mais son fichier
// ne sera refabriqué que plus tard. La page 404 du site de dev demande au service quelle page vit à l'adresse (GET /api/edition/page-de-l-adresse/?adresse=),
// puis renvoie à l'adresse où le site construit sert encore la page (adresseEncoreServie). Petite base de test/aide-ancrage.mjs, noms inventés.
//   node --test test/serveur-edition-page-de-l-adresse.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { classer } from '../serveur/acces-routes.mjs';
import { installerLesAdresses, installerLesAdressesDeLaPage } from '../src/lib/adresses-renommees.mjs';
import { adresseEncoreServie, cheminDePage } from '../src/lib/metiers.mjs';
import { baseDAncrage, poserCapacite, poserClasse, poserPageLisible, poserRace } from './aide-ancrage.mjs';

const source = (chemin) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

/** Une base d'essai : une race renommée deux fois (deux anciennes adresses), une race jamais renommée, une page du guide, une capacité renommée. */
function monde() {
  const db = baseDAncrage();
  poserRace(db, 'races/zephyrion', 'Zephyrion');
  poserRace(db, 'races/quorvane', 'Quorvane');
  poserClasse(db, 'classes/velmorin', 'Velmorin');
  poserCapacite(db, 'capacites/brumeval', { classe: 'classes/velmorin', nom: 'Brumeval' });
  poserPageLisible(db, 'guide/essai-zephyr', 'Essai Zephyr');
  db.prepare("UPDATE page SET slug_adresse = 'zephyrion-nouveau' WHERE id = 'races/zephyrion'").run();
  db.prepare("UPDATE page SET slug_adresse = 'brumeval-renomme' WHERE id = 'capacites/brumeval'").run();
  const ancienne = db.prepare('INSERT INTO page_ancienne_adresse (adresse, page_id) VALUES (?, ?)');
  ancienne.run('races/zephyrion/', 'races/zephyrion');
  ancienne.run('races/zephyrion-milieu/', 'races/zephyrion');
  ancienne.run('capacites/brumeval/', 'capacites/brumeval');
  return db;
}

const service = (db) => ({ base: () => db, etat: () => ({}), edition: true });
const lire = (db, adresse) => traiter({ methode: 'GET', chemin: `/api/edition/page-de-l-adresse/${adresse === undefined ? '' : `?adresse=${encodeURIComponent(adresse)}`}`, entetes: {} }, service(db));

test('la route rend la page vivante de l’adresse d’aujourd’hui, avec ou sans barre finale (R316)', () => {
  const db = monde();
  for (const [adresse, id] of [
    ['races/zephyrion-nouveau/', 'races/zephyrion'], ['races/zephyrion-nouveau', 'races/zephyrion'], ['capacites/brumeval-renomme/', 'capacites/brumeval'],
    ['races/quorvane/', 'races/quorvane'], // une page jamais renommée : son adresse tirée de l'identifiant
  ]) {
    const r = lire(db, adresse);
    assert.equal(r.statut, 200, `${adresse} : ${JSON.stringify(r.corps)}`);
    assert.deepEqual(r.corps, { page: id }, adresse);
  }
});

test('la route rend la page de chacune de ses anciennes adresses (R316)', () => {
  const db = monde();
  for (const adresse of ['races/zephyrion/', 'races/zephyrion-milieu/', 'capacites/brumeval/']) {
    const r = lire(db, adresse);
    assert.equal(r.statut, 200, adresse);
    assert.equal(r.corps.page, adresse.startsWith('races') ? 'races/zephyrion' : 'capacites/brumeval', adresse);
  }
});

test('la route rend { page: null } pour une adresse inconnue, une rubrique, une adresse absente ou mal formée, jamais une erreur', () => {
  const db = monde();
  const longue = `races/${'a'.repeat(400)}/`;
  for (const adresse of ['races/inconnue-zzz/', 'races/', 'fiche/', '', undefined, longue, 'races/zephyrion?x=1', 'races/zephyrion#y', '..\\..\\x', 'races/\u0000x/', '//hote.example/']) {
    const r = lire(db, adresse);
    assert.equal(r.statut, 200, String(adresse));
    assert.deepEqual(r.corps, { page: null }, String(adresse));
  }
});

test('la route ignore l’état installé du site construit : elle lit toujours la base (le service n’installe rien)', () => {
  const db = monde();
  installerLesAdresses([['races/quorvane', 'segment-installe']]);
  try {
    assert.equal(lire(db, 'races/segment-installe/').corps.page, null);
    assert.equal(lire(db, 'races/quorvane/').corps.page, 'races/quorvane');
    assert.equal(lire(db, 'races/zephyrion-nouveau/').corps.page, 'races/zephyrion');
  } finally {
    installerLesAdresses([]);
  }
});

test('la route est de la classe de GET /api/edition/pages/ : « lecture » (session MJ ou clé), le site de dev étant fermé ; en lecture seule (R275, R310)', () => {
  assert.equal(classer('GET', '/api/edition/page-de-l-adresse/').classe, 'lecture', 'jamais ouverte sans session ni clé');
  assert.equal(classer('GET', '/api/edition/page-de-l-adresse/').classe, classer('GET', '/api/edition/pages/').classe);
  assert.equal(classer('GET', '/api/edition/page-de-l-adresse/').connue, true);
  assert.equal(lire(monde(), 'races/quorvane/').statut, 200);
  const ecriture = traiter({ methode: 'POST', chemin: '/api/edition/page-de-l-adresse/', entetes: {}, corps: '{}' }, service(monde()));
  assert.equal(ecriture.statut, 405);
});

test('adresseEncoreServie : l’adresse construite d’une page renommée depuis le build, null quand c’est déjà l’adresse demandée ou sans page (R316)', () => {
  installerLesAdresses([['races/zephyrion', 'zephyrion-construit']]);
  try {
    // la page renommée depuis le build : le fichier est à l'adresse installée, la demande vise la nouvelle
    assert.equal(adresseEncoreServie('races/zephyrion', 'races/zephyrion-nouveau/'), 'races/zephyrion-construit/');
    assert.equal(adresseEncoreServie('races/zephyrion', 'races/zephyrion-construit/'), null, 'pas de boucle');
    assert.equal(adresseEncoreServie('races/quorvane', 'races/quorvane-nouveau/'), 'races/quorvane/', 'jamais renommée au build : le segment de l’identifiant');
    assert.equal(adresseEncoreServie('races/quorvane', 'races/quorvane/'), null);
    assert.equal(adresseEncoreServie(null, 'races/x/'), null);
    assert.equal(adresseEncoreServie(undefined, 'races/x/'), null);
    assert.equal(adresseEncoreServie('races/zephyrion', 'races/zephyrion-construit'), null, 'barre finale facultative');
  } finally {
    installerLesAdresses([]);
  }
});

test('installerLesAdressesDeLaPage : le JSON de #adresses-renommees installe les segments, un contenu absent ou illisible laisse l’état vide (page sans segment renommé)', () => {
  try {
    assert.equal(installerLesAdressesDeLaPage('{"races/zephyrion":"zephyrion-construit","capacites/brumeval":"brumeval-construit"}'), 2);
    assert.equal(cheminDePage('races/zephyrion'), 'races/zephyrion-construit/');
    assert.equal(cheminDePage('capacites/brumeval'), 'capacites/brumeval-construit/');
    for (const mauvais of [undefined, null, '', 'pas du json', '[1,2]', '"texte"', '{"races/x":42}']) {
      installerLesAdresses([['races/zephyrion', 'reste']]);
      assert.equal(installerLesAdressesDeLaPage(mauvais), 0, String(mauvais));
      assert.equal(cheminDePage('races/zephyrion'), 'races/zephyrion/', String(mauvais));
    }
  } finally {
    installerLesAdresses([]);
  }
});

test('la chaîne de l’édition : editeur.mjs installe l’état de la page, nouvelles.mjs renvoie vers l’adresse encore servie, métiers et classes passent par lib/metiers.mjs (R316)', () => {
  const editeur = source('../src/scripts/edition/editeur.mjs');
  assert.match(editeur, /installerLesAdressesDeLaPage\(document\.getElementById\('adresses-renommees'\)\?\.textContent\)/);
  assert.ok(editeur.indexOf('installerLesAdressesDeLaPage(') < editeur.indexOf("appel('GET', 'edition/listes/')"), 'installé avant toute adresse lue');
  const nouvelles = source('../src/scripts/edition/nouvelles.mjs');
  assert.match(nouvelles, /export \{[^}]*adresseEncoreServie[^}]*\}/, 'exportée par nouvelles.mjs');
  assert.match(nouvelles, /edition\/page-de-l-adresse\/\?adresse=/);
  assert.match(nouvelles, /location\.replace\(/);
  const metiers = source('../src/scripts/edition/metiers.mjs');
  assert.match(metiers, /ancreDeMetier\(id\)/);
  assert.doesNotMatch(metiers, /metier-\$\{id\.slice/, 'l’ancre ne se refait plus depuis l’identifiant');
  const classes = source('../src/scripts/edition/classes.mjs');
  assert.match(classes, /cheminDePage\(don\.id\)/);
  assert.doesNotMatch(classes, /capacites\/\$\{don\.slug\}/);
});
