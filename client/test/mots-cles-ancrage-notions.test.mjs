// La cinquième famille de « Préparer l'ancrage » : les pages de notion (docs/chantier-pages-de-notion.md, §3 ; décision R309 (7)), calculées par
// lib/mots-cles-ancrage.mjs#planDeLAncrage dans une base d'essai aux noms inventés (test/aide-ancrage.mjs). Rien n'est appliqué par le service ici : le dépôt
// est testé avec l'action (test/serveur-edition-ancrage-notions.test.mjs).
//   node --test test/mots-cles-ancrage-notions.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adresseDeLaPage } from '../src/lib/adresses-db.mjs';
import { planDeLAncrage, REPRISES } from '../src/lib/mots-cles-ancrage.mjs';
import { normalize } from '../src/lib/text.mjs';
import {
  ancrerUnMotCle, appliquerEnSql, baseDAncrage, operationsDe, poserLesCategoriesNouvelles, poserMagie, poserMotCle, poserPage, poserPageLisible, poserSort,
} from './aide-ancrage.mjs';

/** Une base d'essai dont les quatre catégories existent déjà : sans autre élément à ancrer, le plan ne rend que les pages de notion. */
function baseComplete() {
  const db = baseDAncrage();
  poserLesCategoriesNouvelles(db);
  return db;
}

/** Un mot-clé du type Notion, sans élément (une seule catégorie : rien à reclasser). */
const poserNotion = (db, libelle, { url = null, categories = ['Notion'] } = {}) => poserMotCle(db, { libelle, url, categories });

const notionDe = (plan, motCle) => operationsDe(plan, 'notions').find((o) => o.apres.mot_cle_id === motCle);
const aTrancher = (plan, motCle) => plan.a_trancher.find((x) => x.table === 'mot_cle' && x.id === motCle);

/** Une monnaie d'essai, que le mot-clé `motCle` désigne (`mot_cle.monnaie_id`). */
function poserMonnaie(db, id, nomDeMonnaie, motCle) {
  db.prepare("INSERT INTO monnaie (id, nom, abreviation, valeur_rf, origine, source_ref) VALUES (?, ?, ?, 1, 'equipement', 'essai')").run(id, nomDeMonnaie, id.toUpperCase());
  db.prepare('UPDATE mot_cle SET monnaie_id = ? WHERE id = ?').run(id, motCle);
}

test('un mot-clé sans élément ni adresse reçoit sa page de notion, à son nom, ancrée sur lui (R309 (7))', () => {
  const db = baseComplete();
  const m = poserNotion(db, 'Zéphyrion souffle');
  const plan = planDeLAncrage(db);
  assert.deepEqual(plan.lots.map((l) => l.famille), ['notions']);
  const id = `guide/${normalize('Zéphyrion souffle')}`;
  assert.deepEqual(notionDe(plan, m), { table: 'page', cle: { id }, operation: 'inserer', apres: { id, titre: 'Zéphyrion souffle', mot_cle_id: m }, ancrage: { notion: true } });
  const [lot] = plan.lots;
  assert.deepEqual([lot.format, lot.nature, lot.decision, lot.auteur], ['maverick-lot/1', 'decision', 'R309', 'préparer l’ancrage']);
  assert.ok(lot.titre);
  assert.equal(plan.comptes.notions, 1);
  assert.deepEqual(plan.a_trancher, []);
});

test('un mot-clé de type de sort, de type de dégâts ou de monnaie, sans page, reçoit la sienne', () => {
  const db = baseComplete();
  const type = poserNotion(db, 'Zéphyrion type', { categories: ['Type de sort'] });
  db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'soin'").run(type);
  const degats = poserNotion(db, 'Zéphyrion dégâts', { categories: ['Dégâts'] });
  db.prepare("INSERT INTO type_degats (id, mot_cle_id) VALUES ('taille', ?)").run(degats);
  const monnaie = poserNotion(db, 'Zéphyrion pièce', { categories: ['Équipement'] });
  poserMonnaie(db, 'zp', 'Zéphyrion pièce', monnaie);
  const plan = planDeLAncrage(db);
  for (const m of [type, degats, monnaie]) assert.ok(notionDe(plan, m), `#${m}`);
  assert.equal(plan.comptes.notions, 3);
});

test('un mot-clé de magie, de sort ou de page n’en reçoit pas', () => {
  const db = baseComplete();
  const libre = poserNotion(db, 'Zéphyrion libre');
  const deMagie = poserNotion(db, 'Zéphyrion magie', { categories: ['Magie'] });
  const magie = poserMagie(db, 'magies/zephyrion', 'Zéphyrion magie', { mot_cle_id: deMagie });
  const deSort = ancrerUnMotCle(db, 'sort', poserSort(db, magie, 'Zéphyrion sort', { types: [] }), { categories: ['Sort'] });
  const dePage = ancrerUnMotCle(db, 'page', poserPage(db, 'guide/zephyrion-page', 'Zéphyrion page'), { categories: ['Guide'] });
  const plan = planDeLAncrage(db);
  assert.deepEqual(operationsDe(plan, 'notions').map((o) => o.apres.mot_cle_id), [libre]);
  for (const m of [deMagie, deSort, dePage]) assert.equal(aTrancher(plan, m), undefined, `#${m}`);
});

test('un mot-clé sans élément qui a déjà une adresse : à trancher, aucune opération', () => {
  const db = baseComplete();
  const m = poserNotion(db, 'Zéphyrion rubrique', { url: '/regles/ailleurs/#zephyrion' });
  const plan = planDeLAncrage(db);
  assert.equal(notionDe(plan, m), undefined);
  assert.ok(aTrancher(plan, m).raison.includes('/regles/ailleurs/#zephyrion'), aTrancher(plan, m).raison);
  assert.equal(plan.comptes.notions, 0);
});

test('nom déjà pris par une page (titre, slug ou alias), deux homonymes : à trancher, aucune page', () => {
  const db = baseComplete();
  const titre = ancrerUnMotCle(db, 'page', poserPageLisible(db, 'guide/zephyrion-a', 'Zéphyrion titre'), { categories: ['Guide'] });
  const parTitre = poserNotion(db, 'Zéphyrion titre');
  ancrerUnMotCle(db, 'page', poserPageLisible(db, 'guide/zephyrion-slug', 'Zéphyrion autre titre'), { categories: ['Guide'] });
  const parSlug = poserNotion(db, 'Zéphyrion slug');
  const avecAlias = poserPageLisible(db, 'guide/zephyrion-b', 'Zéphyrion encore');
  ancrerUnMotCle(db, 'page', avecAlias, { categories: ['Guide'] });
  db.prepare('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?, 0, ?, ?)').run(avecAlias, 'Zéphyrion alias', normalize('Zéphyrion alias'));
  const parAlias = poserNotion(db, 'Zéphyrion alias');
  const homonymes = [poserNotion(db, 'Zéphyrion double'), poserNotion(db, 'Zéphyrion double', { categories: ['Ressource'] })];
  // un nom sans lettre ni chiffre n'entre pas ici : la règle des clés (lib/mots-cles-cles.mjs) refuse déjà une telle base, avant les pages de notion
  const libre = poserNotion(db, 'Zéphyrion libre');
  const plan = planDeLAncrage(db);
  assert.deepEqual(operationsDe(plan, 'notions').map((o) => o.apres.mot_cle_id), [libre]);
  for (const [m, page] of [[parTitre, 'guide/zephyrion-a'], [parSlug, 'guide/zephyrion-slug'], [parAlias, avecAlias]]) {
    assert.ok(aTrancher(plan, m)?.raison.includes(page), `#${m} : ${aTrancher(plan, m)?.raison}`);
  }
  for (const m of homonymes) assert.ok(aTrancher(plan, m), `#${m}`);
  assert.equal(aTrancher(plan, titre), undefined, 'le mot-clé de la page n’est pas en cause');
});

test('l’identifiant suit `idDeNotion` donné ; sans lui, le slug du nom, suffixé tant qu’une page le porte ; deux noms au même slug prennent deux ids', () => {
  const db = baseComplete();
  const [a, b] = [poserNotion(db, 'Zéphyrion un'), poserNotion(db, 'Zéphyrion deux')];
  const appels = [];
  const idDeNotion = (nomDonne, pris) => {
    appels.push([nomDonne, new Set(pris)]);
    let id = 'guide/zephyrion-fixe';
    for (let n = 2; pris.has(id); n += 1) id = `guide/zephyrion-fixe-${n}`;
    return id;
  };
  const plan = planDeLAncrage(db, { idDeNotion });
  assert.deepEqual([notionDe(plan, a).cle.id, notionDe(plan, b).cle.id], ['guide/zephyrion-fixe', 'guide/zephyrion-fixe-2']);
  assert.deepEqual(appels.map(([n]) => n), ['Zéphyrion un', 'Zéphyrion deux']);
  assert.ok(appels[1][1].has('guide/zephyrion-fixe'), 'l’id retenu rejoint `pris`');

  // la version locale : une page porte déjà l'id (son titre est autre, son slug aussi)
  const local = baseComplete();
  ancrerUnMotCle(local, 'page', poserPage(local, 'guide/zephyrion-local', 'Zéphyrion titre autre'), { categories: ['Guide'] });
  const m = poserNotion(local, 'Zéphyrion local');
  assert.equal(notionDe(planDeLAncrage(local), m).cle.id, 'guide/zephyrion-local-2');

  // `idDeNotion` qui ne trouve rien : à trancher
  const rien = planDeLAncrage(db, { idDeNotion: () => null });
  assert.deepEqual(operationsDe(rien, 'notions'), []);
  for (const x of [a, b]) assert.ok(aTrancher(rien, x), `#${x}`);
});

test('tant qu’un des quatre autres lots a une opération, les notions attendent ; `comptes.notions` les compte', () => {
  const db = baseComplete();
  poserNotion(db, 'Zéphyrion attend');
  poserPage(db, 'capacites/zephyrion-frappe', 'Zéphyrion frappe');
  const plan = planDeLAncrage(db);
  assert.deepEqual(plan.lots.map((l) => l.famille), ['capacites']);
  assert.equal(plan.comptes.notions, 1);
  // sans les catégories nouvelles, le lot 1 seul
  const sans = baseDAncrage();
  poserMotCle(sans, { libelle: 'Zéphyrion attend', categories: ['Règles'] });
  const premier = planDeLAncrage(sans);
  assert.deepEqual(premier.lots.map((l) => l.famille), ['noms']);
  assert.equal(premier.comptes.notions, 1);
});

test('rejouable : une fois les pages posées, le plan est vide', () => {
  const db = baseComplete();
  poserNotion(db, 'Zéphyrion un');
  poserNotion(db, 'Zéphyrion deux');
  const plan = planDeLAncrage(db);
  appliquerEnSql(db, plan.lots[0]);
  for (const o of plan.lots[0].operations) assert.equal(db.prepare('SELECT url FROM mot_cle WHERE id = ?').get(o.apres.mot_cle_id).url, adresseDeLaPage(o.apres.id, null));
  const ensuite = planDeLAncrage(db);
  assert.deepEqual(ensuite.lots, []);
  assert.deepEqual(ensuite.a_trancher, []);
  assert.equal(ensuite.comptes.notions, 0);
});

test('`notion:<id>` écartée : sautée et listée', () => {
  const db = baseComplete();
  const [a, b] = [poserNotion(db, 'Zéphyrion un'), poserNotion(db, 'Zéphyrion deux')];
  const plan = planDeLAncrage(db, { ecartees: new Set([`notion:${a}`]) });
  assert.equal(notionDe(plan, a), undefined);
  assert.ok(notionDe(plan, b));
  assert.deepEqual(plan.ecartees, [`notion:${a}`]);
  assert.equal(plan.comptes.notions, 1);
});

test('un mot-clé sans type unique (aucune catégorie, deux catégories) ne reçoit pas de page : il reste à trancher pour son type, une seule fois', () => {
  const db = baseComplete();
  const aucune = poserNotion(db, 'Zéphyrion sans type', { categories: [] });
  const deux = poserNotion(db, 'Zéphyrion deux types', { categories: ['Notion', 'Règles'] });
  const libre = poserNotion(db, 'Zéphyrion libre');
  const plan = planDeLAncrage(db);
  assert.deepEqual(operationsDe(plan, 'notions').map((o) => o.apres.mot_cle_id), [libre]);
  assert.equal(plan.comptes.notions, 1);
  for (const m of [aucune, deux]) assert.equal(plan.a_trancher.filter((x) => x.table === 'mot_cle' && x.id === m).length, 1, `#${m}`);
});

test('un mot-clé dont le reclassement `type:<id>` est écarté ne reçoit pas de page ; reclassé par ce plan, il est compté', () => {
  const db = baseComplete();
  // #51 a un type unique dans la liste du plan : à deux catégories, le lot 1 le reclasse
  const m = poserMotCle(db, { id: 51, libelle: 'Zéphyrion reclassé', categories: ['Notion', 'Règles'] });
  const reclasse = planDeLAncrage(db);
  assert.deepEqual(reclasse.lots.map((l) => l.famille), ['noms']);
  assert.equal(reclasse.comptes.notions, 1);
  const ecarte = planDeLAncrage(db, { ecartees: new Set([`type:${m}`]) });
  assert.equal(notionDe(ecarte, m), undefined);
  assert.equal(ecarte.comptes.notions, 0);
  assert.deepEqual(ecarte.ecartees, [`type:${m}`]);
});

test('les mots-clés repris ne sont jamais candidats, même quand la ligne de leur reprise est annulée', () => {
  const db = baseComplete();
  const [repris, page] = [...REPRISES][0];
  poserPage(db, page, 'Zéphyrion page reprise');
  poserMotCle(db, { id: repris, libelle: 'Zéphyrion repris', categories: ['Guide'] });
  const typeRepris = poserMotCle(db, { id: 239, libelle: 'Zéphyrion type repris', categories: ['Type de sort'] });
  const libre = poserNotion(db, 'Zéphyrion libre');
  const plan = planDeLAncrage(db, { ecartees: new Set([`page:${page}`]) });
  assert.deepEqual(operationsDe(plan, 'notions').map((o) => o.apres.mot_cle_id), [libre]);
  assert.equal(plan.comptes.notions, 1);
  assert.ok(plan.ecartees.includes(`page:${page}`), plan.ecartees.join(', '));
  for (const id of [repris, typeRepris]) assert.equal(notionDe(plan, id), undefined, `#${id}`);
});

test('aucune opération du lot n’écrit de résumé, de texte ni de clé : le service les écrit', () => {
  const db = baseComplete();
  for (let i = 0; i < 3; i += 1) poserNotion(db, `Zéphyrion ${i}`);
  const operations = operationsDe(planDeLAncrage(db), 'notions');
  assert.equal(operations.length, 3);
  for (const o of operations) {
    assert.deepEqual(Object.keys(o.apres).sort(), ['id', 'mot_cle_id', 'titre']);
    for (const c of ['resume', 'corps_md', 'cle']) assert.equal(c in o.apres, false, c);
  }
});
