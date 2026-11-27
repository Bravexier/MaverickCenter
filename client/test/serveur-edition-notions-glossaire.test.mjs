// Au Glossaire, « Nouveau mot-clé » crée la notion et sa page (docs/chantier-pages-de-notion.md, §4 ; R309 (7), (9)) : par une route du site
// (`enregistrer(db, corps, { voie: 'route' })`, que seules donnent serveur/api.mjs et serveur/ressources.mjs), créer un mot-clé crée, dans un seul lot du journal, le
// mot-clé, son type, la page de notion et l'ancre, ou est refusé en entier (409) : jamais de mot-clé nu. Sans `voie` (tests, rejeu) et par un lot de changements,
// la création reste celle d'un mot-clé nu (Review Focus 5 du plan). Petite base de test/aide-ancrage.mjs en fichier, noms inventés.
//   node --test test/serveur-edition-notions-glossaire.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enregistrer, ErreurEdition } from '../serveur/edition.mjs';
import { decisionsCitees } from '../serveur/edition-lots.mjs';
import { ENTITES } from '../src/lib/edition-modele.mjs';
import { CORPS_D_UNE_PAGE_DE_NOTION } from '../src/lib/guide.mjs';
import { CHAMPS_D_UNE_NOTION } from '../src/lib/mots-cles-edition.mjs';
import { normalize } from '../src/lib/text.mjs';
import { adresseDesRegles, idDesRegles, nom, outilsDesCas } from './aide-adresses-lots.mjs';
import { idDeCategorie, poserLesCategoriesNouvelles, poserPageLisible } from './aide-ancrage.mjs';

const { cas, deposerDirect } = outilsDesCas('edition-notions-glossaire');

/** Les catégories nouvelles (« Notion » comprise) et une page des Règles d'essai, dont le titre ne peut pas devenir une notion. */
function poserLeMonde(db, { categories = true } = {}) {
  if (categories) poserLesCategoriesNouvelles(db);
  return { page: poserPageLisible(db, idDesRegles(nom('Rivage')), nom('Rivage')) };
}

const parLaRoute = (m, operations) => enregistrer(m.db, { page: 'regles/glossaire/', operations }, { voie: 'route' });
const sansVoie = (m, operations) => enregistrer(m.db, { page: 'regles/glossaire/', operations });
const creation = (valeurs) => ({ op: 'creer', entite: 'mot_cle', valeurs });

const journal = (m) => m.db.prepare('SELECT count(*) AS n FROM modification').get().n;
const motCleNomme = (m, libelle) => m.db.prepare('SELECT * FROM mot_cle WHERE libelle = ?').get(libelle);
const pageDuMotCle = (m, id) => m.db.prepare('SELECT * FROM page WHERE mot_cle_id = ?').get(id);
const categories = (m, id) => m.db.prepare('SELECT categorie_id AS c FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY c').all(id).map((l) => l.c);

/** Le refus (ErreurEdition) de `faire` : 409, sans numéro de décision, rien d'écrit au journal. */
function refus409(m, faire) {
  const avant = journal(m);
  let e = null;
  try {
    faire();
  } catch (x) {
    e = x;
  }
  assert.ok(e instanceof ErreurEdition, `refus attendu : ${e}`);
  assert.equal(e.statut, 409, e.message);
  assert.deepEqual(decisionsCitees(e.message), [], e.message);
  assert.equal(journal(m), avant, `rien d’écrit (${e.message})`);
  return e;
}

test('par une route : le mot-clé, son type, sa page de notion et l’ancre dans un seul lot du journal ; « Notion » sans type donné ; la définition sur le mot-clé, la page sans résumé', () => cas(
  (db) => poserLeMonde(db),
  (m) => {
    const notion = idDeCategorie(m.db, 'Notion');
    const lots = () => m.db.prepare('SELECT count(DISTINCT lot_id) AS n FROM modification').get().n;
    const avant = lots();
    const r = parLaRoute(m, [creation({ libelle: nom('Embrun'), description: 'Définition d’essai.' })]);
    assert.equal(lots(), avant + 1, 'un seul lot du journal');
    const k = motCleNomme(m, nom('Embrun'));
    assert.ok(k, 'le mot-clé est créé');
    assert.deepEqual(r.crees.map((c) => [c.entite, c.id]), [['mot_cle', k.id]], 'la route rend l’id du mot-clé, comme avant');
    assert.deepEqual(categories(m, k.id), [notion], 'sans type donné : « Notion » (R309)');
    assert.equal(k.description, 'Définition d’essai.', 'la définition est celle du mot-clé');
    const p = pageDuMotCle(m, k.id);
    assert.ok(p, 'sa page de notion l’ancre (R309 (7))');
    assert.deepEqual([p.id, p.titre, p.resume, p.corps_md], [idDesRegles(nom('Embrun')), nom('Embrun'), null, CORPS_D_UNE_PAGE_DE_NOTION]);
    assert.equal(k.url, adresseDesRegles(nom('Embrun')), 'son adresse est celle de sa page');
    // le mot-clé, sa catégorie, la page et l'ancre : écrits par le même lot
    const tables = new Set(m.db.prepare('SELECT table_nom FROM modification WHERE lot_id = ?').all(r.lot).map((l) => l.table_nom));
    for (const t of ['mot_cle', 'mot_cle_categorie', 'page']) assert.ok(tables.has(t), `${t} dans le lot ${r.lot}`);

    // un type donné : celui-là
    const regles = idDeCategorie(m.db, 'Règles');
    parLaRoute(m, [creation({ libelle: nom('Houle'), categories: [regles] })]);
    const houle = motCleNomme(m, nom('Houle'));
    assert.deepEqual(categories(m, houle.id), [regles]);
    assert.ok(pageDuMotCle(m, houle.id));
    assert.equal(pageDuMotCle(m, houle.id).resume, null, 'sans définition : la page n’a pas de résumé non plus');

    // ancré : son nom ne se modifie plus par une route (R309 (9))
    refus409(m, () => parLaRoute(m, [{ op: 'modifier', table: 'mot_cle', cle: { id: k.id }, valeurs: { libelle: nom('Autre') } }]));
    assert.equal(motCleNomme(m, nom('Embrun')).id, k.id);
  },
));

test('par une route : une adresse donnée, le nom d’une page, deux types : refusés en entier (409), ni mot-clé ni page', () => cas(
  (db) => poserLeMonde(db),
  (m) => {
    const pages = () => m.db.prepare('SELECT count(*) AS n FROM page').get().n;
    const avant = pages();
    const e = refus409(m, () => parLaRoute(m, [creation({ libelle: nom('Ressac'), url: adresseDesRegles(nom('Rivage')) })]));
    assert.equal(e.details?.champ, 'url');
    refus409(m, () => parLaRoute(m, [creation({ libelle: nom('Rivage') })]));
    refus409(m, () => parLaRoute(m, [creation({ libelle: nom('Ressac'), categories: [idDeCategorie(m.db, 'Règles'), idDeCategorie(m.db, 'Notion')] })]));
    assert.equal(motCleNomme(m, nom('Ressac')), undefined);
    assert.equal(m.db.prepare('SELECT count(*) AS n FROM mot_cle WHERE libelle = ?').get(nom('Rivage')).n, 0);
    assert.equal(pages(), avant, 'aucune page créée');
  },
));

test('par une route, sans la catégorie « Notion » et sans type donné : la notion et sa page, sans type (« Préparer l’ancrage » le tranchera)', () => cas(
  (db) => poserLeMonde(db, { categories: false }),
  (m) => {
    assert.equal(idDeCategorie(m.db, 'Notion'), undefined);
    const r = parLaRoute(m, [creation({ libelle: nom('Ecume') })]);
    const k = motCleNomme(m, nom('Ecume'));
    assert.ok(k, 'le mot-clé est créé');
    assert.equal(r.crees[0].id, k.id);
    assert.deepEqual(categories(m, k.id), [], 'aucun type');
    const p = pageDuMotCle(m, k.id);
    assert.ok(p, 'sa page de notion l’ancre');
    assert.equal(p.corps_md, CORPS_D_UNE_PAGE_DE_NOTION);
    assert.equal(k.url, adresseDesRegles(nom('Ecume')), 'son adresse est celle de sa page');
  },
));

test('Review Focus 5 : sans voie (tests, rejeu) et par un lot de changements déposé, un mot-clé se crée nu, sans page', () => cas(
  (db) => poserLeMonde(db),
  async (m) => {
    const r = sansVoie(m, [creation({ libelle: nom('Embrun') })]);
    const k = motCleNomme(m, nom('Embrun'));
    assert.equal(r.crees[0].id, k.id);
    assert.equal(pageDuMotCle(m, k.id), undefined, 'sans voie : aucune page');
    assert.equal(k.url, null);
    // un lot de changements qui insère un mot-clé : nu aussi
    const libelle = nom('Houle');
    await deposerDirect(m, [{ table: 'mot_cle', cle: { id: { $numero: 'a' } }, operation: 'inserer', apres: { id: { $numero: 'a' }, libelle, cle: normalize(libelle) } }]);
    const houle = motCleNomme(m, libelle);
    assert.ok(houle, 'le lot a créé le mot-clé');
    assert.equal(pageDuMotCle(m, houle.id), undefined, 'par un lot : aucune page');
  },
));

test('CHAMPS_D_UNE_NOTION : le nom, le type et la définition, des champs de la création d’un mot-clé', () => {
  assert.deepEqual([...CHAMPS_D_UNE_NOTION], ['libelle', 'categories', 'description']);
  for (const c of CHAMPS_D_UNE_NOTION) assert.ok(Object.hasOwn(ENTITES.mot_cle.champs, c), c);
  assert.ok(Object.isFrozen(CHAMPS_D_UNE_NOTION));
});
