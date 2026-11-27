// L'adresse d'une page suit son titre (décision R316) : lire une adresse dont le dernier segment a été renommé (page.slug_adresse, migration 0133).
// Deux lectures, jamais mêlées : un second argument `undefined` lit l'état installé (lib/adresses-renommees.mjs#installerLesAdresses : le build, la
// chaîne de l'édition du navigateur) ; `null` dit « pas de segment renommé ». Le service lit la base à chaque fois (lib/adresses-db.mjs#…EnBase) et
// n'installe jamais rien. Base d'essai de test/aide-ancrage.mjs, noms inventés ; chaque test qui installe l'état le remet à vide.
//   node --test test/adresses-renommees.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  adresseDeLaPage, adresseDeLaPageEnBase, adresseDuSort, adresseDuSortEnBase, adressesDuSite, anciennesAdresses, indexDesAdresses, pageDeLAdresse,
  pageDeLAncienneAdresse, slugsDAdresse,
} from '../src/lib/adresses-db.mjs';
import { installerLesAdresses, pageAuSlug, slugRenomme } from '../src/lib/adresses-renommees.mjs';
import { adresseDuGuide, DECOUVRIR, GUIDE_DU_MJ, pageDuGuideALAdresse, slugDAdresse } from '../src/lib/livres.mjs';
import {
  adresseDePage, ancreDeMetier, chargerMetiers, cheminDePage, estServieASonId, PAGE_DES_REGLES, pageARouteFixe, renvoisDuGuide, segmentDePage,
} from '../src/lib/metiers.mjs';
import { baseDAncrage, poserMagie, poserPage, poserSort } from './aide-ancrage.mjs';

/** Installe `paires`, lance `f`, puis remet l'état à vide (sinon il fuit dans les tests voisins). */
function avecLesAdresses(paires, f) {
  installerLesAdresses(paires);
  try {
    return f();
  } finally {
    installerLesAdresses([]);
  }
}

const MJ = GUIDE_DU_MJ.pages[0];
const MODE_SUPER = 'guide/liste-des-effets-mode-super'; // R228
const INVENTAIRE = 'guide/fiche-inventaire-sac-a-dos'; // R272

/** Une page de chaque forme et l'adresse qu'elle a sans segment renommé (celle d'avant R316). */
const ADRESSES_D_AVANT = Object.freeze({
  'capacites/anansi-essai': 'capacites/anansi-essai/',
  'races/peuple-essai': 'races/peuple-essai/',
  'guide/regle-essai': 'regles/regle-essai/',
  [MJ]: `mj/${MJ.slice('guide/'.length)}/`,
  [DECOUVRIR.accueil]: 'decouvrir/',
  'metiers/forgeron-essai': 'metiers/#metier-forgeron-essai',
  [PAGE_DES_REGLES]: `${PAGE_DES_REGLES}/`,
  [MODE_SUPER]: 'regles/mode-super/',
  [INVENTAIRE]: 'regles/inventaire-sac-a-dos/',
  'ressources/bouclier': 'ressources/bouclier/',
});

/** Un métier d'essai : sa page et sa ligne de `metier` (les colonnes que chargerMetiers lit). */
function poserMetier(db, id, nom) {
  poserPage(db, id, nom);
  db.prepare(`INSERT INTO metier (id, nom, nom_cle, description, bonus_brut, artisanat_brut, peut_fabriquer, equipement_brut, origine, source_ref)
    VALUES (?, ?, ?, 'Description d’essai', '', 'Rien', 0, 'Rien', 'craft', 'essai')`).run(id, nom, id.slice('metiers/'.length));
  return id;
}

test('R316 : sans segment renommé, chaque page garde l’adresse qu’elle avait (id, guide, métier, R228, R272, route fixe)', () => {
  installerLesAdresses([]);
  const db = baseDAncrage();
  for (const id of Object.keys(ADRESSES_D_AVANT)) poserPage(db, id, `Page ${id}`);
  for (const { id } of db.prepare('SELECT id FROM page ORDER BY id').all()) {
    assert.equal(cheminDePage(id), ADRESSES_D_AVANT[id], `${id} : état installé vide`);
    assert.equal(cheminDePage(id, null), ADRESSES_D_AVANT[id], `${id} : aucun segment`);
    assert.equal(adresseDeLaPageEnBase(db, id), `/${ADRESSES_D_AVANT[id]}`, `${id} : lue en base`);
    assert.equal(adresseDeLaPage(id), `/${ADRESSES_D_AVANT[id]}`, `${id} : un seul argument, comme avant`);
  }
});

test('R316 : un segment donné remplace celui de l’identifiant, à la même forme ; une page à route fixe l’ignore ; null ignore l’état installé', () => {
  assert.equal(cheminDePage('capacites/a-b', 'a-c'), 'capacites/a-c/');
  assert.equal(segmentDePage('capacites/a-b', 'a-c'), 'a-c');
  assert.equal(segmentDePage('capacites/a-b', null), 'a-b');
  assert.equal(cheminDePage('guide/x', 'y'), 'regles/y/');
  assert.equal(adresseDuGuide('guide/x', 'y'), 'regles/y/');
  assert.equal(slugDAdresse('guide/x', 'y'), 'y');
  assert.equal(cheminDePage(MJ, 'y'), 'mj/y/', 'une page du Guide du MJ garde mj/');
  assert.equal(cheminDePage(MODE_SUPER, 'super'), 'regles/super/', 'un segment posé l’emporte sur R228');
  assert.equal(cheminDePage(MODE_SUPER, null), 'regles/mode-super/', 'sans segment : R228');
  // un métier : son ancre suit (décision 4 de R316)
  assert.equal(cheminDePage('metiers/forgeron', 'ferronnier'), 'metiers/#metier-ferronnier');
  assert.deepEqual(adresseDePage('metiers/forgeron', 'ferronnier'), { chemin: 'metiers/', ancre: 'metier-ferronnier' });
  assert.equal(ancreDeMetier('metiers/forgeron', 'ferronnier'), 'metier-ferronnier');
  assert.equal(ancreDeMetier('metiers/forgeron', null), 'metier-forgeron');
  // les pages à route fixe ne bougent pas
  for (const id of ['ressources/bouclier', DECOUVRIR.accueil]) {
    assert.equal(pageARouteFixe(id), true, id);
    assert.equal(cheminDePage(id, 'autre-chose'), ADRESSES_D_AVANT[id], id);
  }
  for (const id of ['capacites/a-b', 'guide/x', 'metiers/forgeron', MODE_SUPER]) assert.equal(pageARouteFixe(id), false, id);
  avecLesAdresses([['capacites/a-b', 'zzz']], () => {
    assert.equal(cheminDePage('capacites/a-b'), 'capacites/zzz/');
    assert.equal(cheminDePage('capacites/a-b', null), 'capacites/a-b/', 'null : jamais l’état installé');
    assert.equal(cheminDePage('capacites/a-b', 'a-c'), 'capacites/a-c/');
  });
});

test('R316 : estServieASonId dit « servie par la route du wiki », quel que soit son segment', () => {
  avecLesAdresses([['capacites/a-b', 'a-c'], ['metiers/forgeron', 'ferronnier'], ['guide/x', 'y']], () => {
    assert.equal(estServieASonId('capacites/a-b'), true, 'renommée, toujours servie par la route du wiki');
    assert.equal(estServieASonId('races/peuple-essai'), true);
    assert.equal(estServieASonId(PAGE_DES_REGLES), true);
    for (const id of ['metiers/forgeron', 'metiers/mineur', 'guide/x', 'guide/autre', DECOUVRIR.accueil, 'ressources/bouclier', 'ressources/armes']) {
      assert.equal(estServieASonId(id), false, id);
    }
  });
});

test('R316 : l’état installé (build, navigateur) donne l’adresse sans second argument ; pageDuGuideALAdresse le lit à l’envers ; un second appel remplace le premier', () => {
  try {
    assert.equal(installerLesAdresses([['guide/x', 'y']]), 1);
    assert.equal(slugRenomme('guide/x'), 'y');
    assert.equal(slugRenomme('guide/autre'), null);
    assert.equal(pageAuSlug('guide', 'y'), 'guide/x');
    assert.equal(pageAuSlug('capacites', 'y'), null, 'par type');
    assert.equal(cheminDePage('guide/x'), 'regles/y/');
    assert.equal(slugDAdresse('guide/x'), 'y');
    assert.equal(pageDuGuideALAdresse('regles/y/'), 'guide/x');
    assert.equal(pageDuGuideALAdresse('regles/y/#section'), 'guide/x');
    assert.equal(pageDuGuideALAdresse('regles/x/'), null, 'le segment de l’identifiant ne sert plus la page');
    assert.equal(pageDuGuideALAdresse('regles/autre/'), 'guide/autre', 'les autres pages ne changent pas');
    assert.equal(pageDuGuideALAdresse('regles/mode-super/'), MODE_SUPER, 'R228');
    assert.equal(pageDuGuideALAdresse('regles/liste-des-effets-mode-super/'), null, 'R228');

    assert.equal(installerLesAdresses([['capacites/a-b', 'a-c'], [MODE_SUPER, 'super']]), 2);
    assert.equal(slugRenomme('guide/x'), null, 'remplacé, pas ajouté');
    assert.equal(pageAuSlug('guide', 'y'), null);
    assert.equal(cheminDePage('guide/x'), 'regles/x/');
    assert.equal(pageDuGuideALAdresse('regles/x/'), 'guide/x');
    assert.equal(cheminDePage('capacites/a-b'), 'capacites/a-c/');
    // une page de R228 renommée : son segment posé l'emporte, l'adresse de R228 ne la sert plus
    assert.equal(cheminDePage(MODE_SUPER), 'regles/super/');
    assert.equal(pageDuGuideALAdresse('regles/super/'), MODE_SUPER);
    assert.equal(pageDuGuideALAdresse('regles/mode-super/'), null);
    assert.equal(installerLesAdresses([]), 0);
    assert.equal(cheminDePage('capacites/a-b'), 'capacites/a-b/');
    // un id sans « / » (jamais celui d'une page) ne se range pas sous un type tronqué de sa dernière lettre
    installerLesAdresses([['abc', 'z']]);
    assert.equal(pageAuSlug('ab', 'z'), null);
    assert.equal(pageAuSlug('abc', 'z'), 'abc', 'son type est l’id entier, comme id.split("/")[0]');
  } finally {
    installerLesAdresses([]);
  }
});

test('R316 : la page 404 renvoie chaque ancienne adresse sans ancre d’une page chargée vers son adresse d’aujourd’hui (renvoisDuGuide)', () => {
  avecLesAdresses([['guide/x', 'y'], ['capacites/a-b', 'a-c']], () => {
    const ids = ['guide/x', 'capacites/a-b', 'metiers/forgeron'];
    const renvois = renvoisDuGuide(ids, [
      { adresse: 'regles/x/', page_id: 'guide/x' },
      { adresse: 'capacites/a-b/', page_id: 'capacites/a-b' },
      { adresse: 'metiers/#metier-vieux', page_id: 'metiers/forgeron' },
      { adresse: 'capacites/z/', page_id: 'capacites/absente' },
      { adresse: 'regles/y/', page_id: 'guide/x' },
    ]);
    assert.equal(renvois['regles/x/'], 'regles/y/');
    assert.equal(renvois['capacites/a-b/'], 'capacites/a-c/');
    assert.equal(renvois['guide/x/'], 'regles/y/', 'l’adresse d’avant l’éclatement du guide mène à la nouvelle, sans deux sauts');
    assert.ok(!Object.hasOwn(renvois, 'metiers/#metier-vieux'), 'une adresse à ancre : la ligne du tableau la porte');
    assert.ok(!Object.hasOwn(renvois, 'capacites/z/'), 'une page non chargée');
    assert.ok(!Object.hasOwn(renvois, 'regles/y/'), 'jamais un renvoi sur soi');
    assert.deepEqual(renvoisDuGuide(ids), renvoisDuGuide(ids, []), 'sans anciennes adresses : comme avant');
  });
});

/** La base d'essai d'une capacité, d'une magie et d'un sort, d'un métier et d'une page des Règles renommés. */
function baseRenommee() {
  const db = baseDAncrage();
  poserPage(db, 'capacites/a-b', 'A b');
  poserPage(db, 'capacites/c-d', 'C d');
  poserPage(db, 'magies/feu-essai', 'Feu d’essai');
  poserMagie(db, 'magies/feu-essai', 'Feu d’essai');
  const sort = poserSort(db, 'magies/feu-essai', 'Boule essai');
  poserMetier(db, 'metiers/forgeron-essai', 'Forgeron d’essai');
  poserMetier(db, 'metiers/mineur-essai', 'Mineur d’essai');
  poserPage(db, 'guide/regle-essai', 'Règle d’essai');
  const renommer = db.prepare('UPDATE page SET slug_adresse = ? WHERE id = ?');
  const ancienne = db.prepare('INSERT INTO page_ancienne_adresse (adresse, page_id) VALUES (?, ?)');
  renommer.run('a-c', 'capacites/a-b');
  ancienne.run('capacites/a-b/', 'capacites/a-b');
  renommer.run('brasier-essai', 'magies/feu-essai');
  ancienne.run('magies/feu-essai/', 'magies/feu-essai');
  renommer.run('ferronnier-essai', 'metiers/forgeron-essai');
  ancienne.run('metiers/#metier-forgeron-essai', 'metiers/forgeron-essai');
  ancienne.run('metiers/#metier-tres-vieux-essai', 'metiers/forgeron-essai');
  renommer.run('regle-nouvelle', 'guide/regle-essai');
  ancienne.run('regles/regle-essai/', 'guide/regle-essai');
  return { db, sort };
}

test('R316 : le service lit le segment en base, jamais l’état installé (adresses-db.mjs)', () => {
  const { db, sort } = baseRenommee();
  // un état installé contraire : la lecture en base l'ignore
  avecLesAdresses([['capacites/a-b', 'installe'], ['capacites/c-d', 'installe-aussi']], () => {
    assert.equal(adresseDeLaPageEnBase(db, 'capacites/a-b'), '/capacites/a-c/');
    assert.equal(adresseDeLaPageEnBase(db, 'capacites/c-d'), '/capacites/c-d/', 'aucun segment en base : celui de l’identifiant');
    assert.equal(adresseDeLaPageEnBase(db, 'capacites/absente'), '/capacites/absente/');
    assert.equal(adresseDeLaPageEnBase(db, 'guide/regle-essai'), '/regles/regle-nouvelle/');
    assert.equal(adresseDeLaPageEnBase(db, 'metiers/forgeron-essai'), '/metiers/#metier-ferronnier-essai');
    assert.equal(adresseDeLaPage('capacites/a-b', 'a-c'), '/capacites/a-c/');
    assert.equal(adresseDeLaPage('capacites/a-b', null), '/capacites/a-b/');
    // le sort suit sa magie renommée
    const slug = sort.split('#sort:')[1];
    assert.equal(adresseDuSortEnBase(db, sort), `/magies/brasier-essai/#sort-${slug}`);
    assert.equal(adresseDuSort(sort, 'x'), `/magies/x/#sort-${slug}`);
    assert.equal(adresseDuSort(sort, null), `/magies/feu-essai/#sort-${slug}`);

    const adresses = adressesDuSite(db);
    for (const a of ['/capacites/a-c/', '/magies/brasier-essai/', '/regles/regle-nouvelle/', '/capacites/c-d/', '/metiers/']) assert.ok(adresses.has(a), a);
    for (const a of ['/capacites/a-b/', '/magies/feu-essai/', '/regles/regle-essai/', '/capacites/installe/', '/capacites/installe-aussi/']) assert.ok(!adresses.has(a), a);

    const index = indexDesAdresses(db);
    assert.equal(pageDeLAdresse(index, '/capacites/a-c/'), 'capacites/a-b');
    assert.equal(pageDeLAdresse(index, '/capacites/a-b/'), null);
    assert.equal(pageDeLAdresse(index, '/capacites/c-d/'), 'capacites/c-d');
    assert.equal(pageDeLAdresse(index, '/regles/regle-nouvelle/#section'), 'guide/regle-essai');
    assert.equal(pageDeLAdresse(index, '/metiers/#metier-ferronnier-essai'), 'metiers/forgeron-essai');
    assert.equal(pageDeLAdresse(index, '/metiers/#metier-forgeron-essai'), null);
    assert.equal(pageDeLAdresse(index, '/metiers/#metier-mineur-essai'), 'metiers/mineur-essai');
    const avecAbsente = indexDesAdresses(db, { enPlus: ['capacites/supprimee'] });
    assert.equal(pageDeLAdresse(avecAbsente, '/capacites/supprimee/'), 'capacites/supprimee', 'une page absente : le segment de son identifiant');
  });
});

test('R316 : les anciennes adresses et les segments lus en base ; la page d’une ancienne adresse', () => {
  const { db } = baseRenommee();
  assert.deepEqual(slugsDAdresse(db), new Map([
    ['capacites/a-b', 'a-c'], ['guide/regle-essai', 'regle-nouvelle'], ['magies/feu-essai', 'brasier-essai'], ['metiers/forgeron-essai', 'ferronnier-essai'],
  ]));
  assert.deepEqual(anciennesAdresses(db), [
    { adresse: 'capacites/a-b/', page_id: 'capacites/a-b' },
    { adresse: 'magies/feu-essai/', page_id: 'magies/feu-essai' },
    { adresse: 'metiers/#metier-forgeron-essai', page_id: 'metiers/forgeron-essai' },
    { adresse: 'metiers/#metier-tres-vieux-essai', page_id: 'metiers/forgeron-essai' },
    { adresse: 'regles/regle-essai/', page_id: 'guide/regle-essai' },
  ]);
  for (const a of ['capacites/a-b/', '/capacites/a-b/', 'capacites/a-b', 'capacites/a-b/#section', 'capacites/a-b/?x=1']) {
    assert.equal(pageDeLAncienneAdresse(db, a), 'capacites/a-b', a);
  }
  assert.equal(pageDeLAncienneAdresse(db, 'metiers/#metier-forgeron-essai'), 'metiers/forgeron-essai');
  assert.equal(pageDeLAncienneAdresse(db, '/metiers/#metier-tres-vieux-essai'), 'metiers/forgeron-essai');
  for (const a of ['metiers/#metier-inconnu', 'metiers/', 'capacites/a-c/', '', null]) assert.equal(pageDeLAncienneAdresse(db, a), null, String(a));
});

test('R316 : chargerMetiers rend l’ancre d’aujourd’hui et les anciennes ancres de chaque métier', () => {
  const { db } = baseRenommee();
  avecLesAdresses([['metiers/mineur-essai', 'installe']], () => {
    const metiers = new Map(chargerMetiers(db).map((m) => [m.id, m]));
    assert.equal(metiers.get('metiers/forgeron-essai').ancre, 'metier-ferronnier-essai');
    assert.deepEqual(metiers.get('metiers/forgeron-essai').anciennesAncres, ['metier-forgeron-essai', 'metier-tres-vieux-essai']);
    assert.equal(metiers.get('metiers/mineur-essai').ancre, 'metier-mineur-essai', 'le segment lu en base, jamais l’état installé');
    assert.deepEqual(metiers.get('metiers/mineur-essai').anciennesAncres, []);
  });
});

test('R316 : une base sans la colonne ni la table (avant la migration 0133) se lit comme avant', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE page (id TEXT PRIMARY KEY, statut TEXT); INSERT INTO page VALUES ('capacites/a-b', 'draft');");
  assert.deepEqual(slugsDAdresse(db), new Map());
  assert.deepEqual(anciennesAdresses(db), []);
  assert.equal(adresseDeLaPageEnBase(db, 'capacites/a-b'), '/capacites/a-b/');
  assert.equal(pageDeLAncienneAdresse(db, 'capacites/a-b/'), null);
  assert.ok(adressesDuSite(db).has('/capacites/a-b/'));
  assert.equal(pageDeLAdresse(indexDesAdresses(db), '/capacites/a-b/'), 'capacites/a-b');
});
