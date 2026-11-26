// Le calcul pur de l'ancrage (lib/mots-cles-ancrage.mjs, décision R309) : ce que « Préparer l'ancrage » doit faire, lu dans une base d'essai aux noms
// inventés (test/aide-ancrage.mjs). Rien n'est appliqué par le service ici ; le dépôt des lots est testé avec l'action.
//   node --test test/mots-cles-ancrage.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { lecteurDesMentions, mentionsDe, referencesDesMotsCles } from '../src/lib/mentions-des-mots-cles.mjs';
import { CATEGORIES_NOUVELLES, estAncre, planDeLAncrage, REPRISES, TYPE_DE_RUBRIQUE, TYPE_UNIQUE } from '../src/lib/mots-cles-ancrage.mjs';
import { elementsDesMotsCles } from '../src/lib/mots-cles-db.mjs';
import { appliquerEnSql, baseDAncrage, idDeCategorie, operationsDe, poserLesCategoriesNouvelles, poserMagie, poserMotCle, poserPage, poserSort } from './aide-ancrage.mjs';

/** Une base d'essai dont les quatre catégories existent déjà : le plan rend alors tous ses lots. */
function baseComplete() {
  const db = baseDAncrage();
  poserLesCategoriesNouvelles(db);
  return db;
}
const creationDe = (plan, table, id) => plan.lots.flatMap((l) => l.operations).find((o) => o.operation === 'inserer' && o.table === 'mot_cle' && o.ancrage?.table === table && o.ancrage?.id === id);
const ancreDe = (plan, table, id) => plan.lots.flatMap((l) => l.operations).find((o) => o.operation === 'modifier' && o.table === table && o.cle.id === id);
const alignementDe = (plan, id) => plan.lots.flatMap((l) => l.operations).find((o) => o.operation === 'modifier' && o.table === 'mot_cle' && o.cle.id === id);
const aTrancher = (plan, table, id) => plan.a_trancher.find((x) => x.table === table && x.id === id);

test('une page sans mot-clé reçoit une création portant son type de rubrique (R309)', () => {
  const db = baseComplete();
  const id = poserPage(db, 'capacites/zephyr-frappe', 'Frappe de Zéphyr');
  const plan = planDeLAncrage(db);
  const o = creationDe(plan, 'page', id);
  assert.equal(o.operation, 'inserer');
  assert.equal(o.apres.libelle, 'Frappe de Zéphyr');
  assert.equal(o.apres.url, adresseDeLaPage(id));
  assert.equal(o.ancrage.type, idDeCategorie(db, TYPE_DE_RUBRIQUE.capacites));
  assert.deepEqual(o.cle, { id: o.apres.id });
  assert.equal(plan.comptes.capacites, 1);
  assert.equal(plan.comptes.crees, 1);
  const lot = plan.lots.find((l) => l.famille === 'capacites');
  assert.deepEqual([lot.format, lot.nature, lot.decision, lot.auteur], ['maverick-lot/1', 'decision', 'R309', 'préparer l’ancrage']);
});

test('une page dont un mot-clé a l’adresse exacte est ancrée sans création', () => {
  const db = baseComplete();
  const id = poserPage(db, 'races/zephyrine', 'Zéphyrine');
  const m = poserMotCle(db, { libelle: 'Zéphyrine', url: adresseDeLaPage(id), categories: ['Race'] });
  const plan = planDeLAncrage(db);
  assert.equal(creationDe(plan, 'page', id), undefined);
  assert.deepEqual(ancreDe(plan, 'page', id).apres, { mot_cle_id: m });
  assert.deepEqual(ancreDe(plan, 'page', id).avant, { mot_cle_id: null });
  assert.equal(alignementDe(plan, m), undefined, 'même nom, même adresse : rien à aligner');
  assert.equal(plan.comptes.ancres_existants, 1);
});

test('une adresse de section (#) ne désigne pas la page', () => {
  const db = baseComplete();
  const id = poserPage(db, 'races/zephyrine', 'Zéphyrine');
  poserMotCle(db, { libelle: 'Peuples de Zéphyrine', url: `${adresseDeLaPage(id)}#peuples`, categories: ['Race'] });
  const plan = planDeLAncrage(db);
  assert.ok(creationDe(plan, 'page', id), 'la page reçoit son propre mot-clé');
});

test('deux mots-clés sur la même adresse : à trancher, rien pour cette page', () => {
  const db = baseComplete();
  const id = poserPage(db, 'races/zephyrine', 'Zéphyrine');
  poserMotCle(db, { libelle: 'Zéphyrine un', url: adresseDeLaPage(id), categories: ['Race'] });
  poserMotCle(db, { libelle: 'Zéphyrine deux', url: adresseDeLaPage(id), categories: ['Race'] });
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'page', id));
  assert.equal(creationDe(plan, 'page', id), undefined);
  assert.equal(ancreDe(plan, 'page', id), undefined);
});

test('une reprise disparue : à trancher', () => {
  const db = baseComplete();
  const [motCleSansPage, pageSansMotCle] = [...REPRISES];
  poserMotCle(db, { id: motCleSansPage[0], libelle: 'Reprise sans page', categories: ['Règles'] });
  const page = poserPage(db, pageSansMotCle[1], 'Page sans sa reprise');
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'mot_cle', motCleSansPage[0]), 'la page de la reprise a disparu');
  assert.ok(aTrancher(plan, 'page', page), 'le mot-clé de la reprise a disparu');
  assert.equal(creationDe(plan, 'page', page), undefined, 'aucun mot-clé de remplacement');
});

test('une reprise libère l’adresse qu’elle quitte : la page reste désignée par l’autre mot-clé', () => {
  const db = baseComplete();
  const quittee = poserPage(db, 'guide/le-mode-hyper', 'Zéphyr hyper');
  const reprise = poserPage(db, REPRISES.get(420), 'Zéphyr hyper cent');
  poserMotCle(db, { id: 245, libelle: 'Zéphyr hyper', url: adresseDeLaPage(quittee), categories: ['Règles'] });
  poserMotCle(db, { id: 420, libelle: 'Zéphyr hyper cent', url: adresseDeLaPage(quittee), categories: ['Règles'] });
  const plan = planDeLAncrage(db);
  assert.equal(aTrancher(plan, 'page', quittee), undefined);
  assert.equal(ancreDe(plan, 'page', quittee).apres.mot_cle_id, 245);
  assert.equal(ancreDe(plan, 'page', reprise).apres.mot_cle_id, 420);
  assert.deepEqual(alignementDe(plan, 420).apres, { url: adresseDeLaPage(reprise) });
  assert.deepEqual(alignementDe(plan, 420).ancrage, { aligner: true });
});

test('un mot-clé à plusieurs catégories absent de TYPE_UNIQUE : à trancher', () => {
  const db = baseComplete();
  const id = poserPage(db, 'races/zephyrine', 'Zéphyrine');
  const m = poserMotCle(db, { libelle: 'Zéphyrine', url: adresseDeLaPage(id), categories: ['Race', 'Classe'] });
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'mot_cle', m));
  assert.ok(aTrancher(plan, 'page', id), 'la page qu’il désigne attend avec lui');
  assert.equal(ancreDe(plan, 'page', id), undefined);
  assert.equal(plan.comptes.reclasses, 0);
});

test('un reclassement que la règle refuse retient l’ancre de son mot-clé : la page attend avec lui (R309)', () => {
  const db = baseComplete();
  const id = TYPE_UNIQUE.Classe[0];
  const page = poserPage(db, 'races/zephyrine', 'Zéphyrine');
  poserMotCle(db, { id, libelle: 'Zéphyrine', url: adresseDeLaPage(page), categories: ['Race', 'Combat'] });
  const homonyme = poserMotCle(db, { libelle: 'Zéphyrine', categories: ['Classe'] }); // reclassé en Classe, le mot-clé aurait le même nom et le même type
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'mot_cle', id));
  assert.match(aTrancher(plan, 'page', page)?.raison ?? '', /type unique/, 'la page est listée, avec le motif');
  assert.equal(ancreDe(plan, 'page', page), undefined, 'un mot-clé à deux catégories ne devient pas ancré');
  assert.equal(aTrancher(plan, 'mot_cle', homonyme), undefined);
  assert.equal(plan.comptes.reclasses, 0);
  assert.equal(plan.comptes.ancres_existants, 0);
  assert.deepEqual(plan.lots, []);
});

test('`meteo` attend avec #239 quand il n’a pas de type unique ; #239 est hors de TYPE_UNIQUE, aucun reclassement ne le vise', () => {
  assert.equal(Object.values(TYPE_UNIQUE).flat().includes(239), false);
  const db = baseComplete();
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  poserSort(db, magie, 'Souffle', { types: ['meteo'] });
  poserMotCle(db, { id: 239, libelle: 'Zéphyr météo', categories: ['Règles', 'Combat'] });
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'mot_cle', 239));
  assert.match(aTrancher(plan, 'type_sort', 'meteo')?.raison ?? '', /type unique/);
  assert.equal(ancreDe(plan, 'type_sort', 'meteo'), undefined);
  assert.equal(creationDe(plan, 'type_sort', 'meteo'), undefined);
});

test('un mot-clé de TYPE_UNIQUE perd ses autres catégories et prend son type, même nouveau', () => {
  const db = baseDAncrage();
  const notion = TYPE_UNIQUE.Notion[0];
  poserMotCle(db, { id: notion, libelle: 'Zéphyr notion', categories: ['Règles', 'Combat'] });
  const garde = TYPE_UNIQUE.Magie[0];
  poserMotCle(db, { id: garde, libelle: 'Zéphyr magie', categories: ['Magie', 'Règles'] });
  const sans = TYPE_UNIQUE.Faction[0];
  poserMotCle(db, { id: sans, libelle: 'Zéphyr faction' });
  const plan = planDeLAncrage(db);
  const ops = operationsDe(plan, 'noms').filter((o) => o.table === 'mot_cle_categorie');
  const deNotion = ops.filter((o) => o.cle.mot_cle_id === notion);
  assert.deepEqual(deNotion.map((o) => o.operation), ['supprimer', 'supprimer', 'inserer']);
  const jeton = operationsDe(plan, 'noms').find((o) => o.table === 'categorie_mot_cle' && o.apres.libelle === 'Notion').cle.id;
  assert.deepEqual(deNotion[2].apres.categorie_id, jeton, 'une catégorie à créer se cite par son jeton');
  assert.deepEqual(ops.filter((o) => o.cle.mot_cle_id === garde).map((o) => [o.operation, o.cle.categorie_id]), [['supprimer', idDeCategorie(db, 'Règles')]]);
  assert.deepEqual(ops.filter((o) => o.cle.mot_cle_id === sans).map((o) => [o.operation, o.cle.categorie_id]), [['inserer', idDeCategorie(db, 'Faction')]]);
  assert.equal(plan.comptes.reclasses, 3);
});

test('une ancre n’est pas une mention (R196) ; une magie reste une référence mentionnée', () => {
  const db = baseComplete();
  const m = poserMotCle(db, { libelle: 'Zéphyr', categories: ['Magie'] });
  assert.equal(estAncre(db, m), false);
  const id = poserPage(db, 'guide/zephyr', 'Zéphyr');
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(m, id);
  assert.equal(estAncre(db, m), true);
  assert.deepEqual(referencesDesMotsCles(db, [m]).map((r) => r.table), ['page']);
  assert.deepEqual(mentionsDe(db, m), [], 'la page ancrée ne bloque pas par une mention');
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Magie de Zéphyr', { mot_cle_id: m });
  assert.deepEqual(mentionsDe(db, m).map((x) => [x.table, x.comment, x.cle.id]), [['magie', 'reference', magie]]);
  const monnaie = poserMotCle(db, { libelle: 'Zéphyr de fer' });
  assert.equal(estAncre(db, monnaie), false);
  db.prepare("INSERT INTO monnaie (id, nom, abreviation, valeur_rf, origine, source_ref) VALUES ('zf', 'Zéphyr de fer', 'ZF', 1, 'equipement', 'essai')").run();
  db.prepare("UPDATE mot_cle SET monnaie_id = 'zf' WHERE id = ?").run(monnaie);
  assert.equal(estAncre(db, monnaie), true);
});

test('les éléments d’un mot-clé : page, sort, type, magie, dégâts, monnaie, avec leur texte', () => {
  const db = baseComplete();
  const m = poserMotCle(db, { libelle: 'Zéphyr', categories: ['Magie'] });
  const page = poserPage(db, 'guide/zephyr', 'Zéphyr écrit', { resume: 'Résumé du Zéphyr.' });
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Magie de Zéphyr', { mot_cle_id: m });
  const sort = poserSort(db, magie, 'Souffle', { effets: 'Effet du souffle.' });
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(m, page);
  db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(m, sort);
  db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'soin'").run(m);
  db.prepare("INSERT INTO type_degats (id, mot_cle_id) VALUES ('sonore', ?)").run(m);
  db.prepare("INSERT INTO monnaie (id, nom, abreviation, valeur_rf, origine, source_ref) VALUES ('zf', 'Zéphyr de fer', 'ZF', 1, 'equipement', 'essai')").run();
  db.prepare("UPDATE mot_cle SET monnaie_id = 'zf' WHERE id = ?").run(m);
  assert.deepEqual(elementsDesMotsCles(db).get(m), [
    { table: 'page', id: page, nom: 'Zéphyr écrit', adresse: adresseDeLaPage(page), texte: 'Résumé du Zéphyr.' },
    { table: 'sort', id: sort, nom: 'Souffle', adresse: adresseDuSort(sort), texte: 'Effet du souffle.' },
    { table: 'type_sort', id: 'soin', nom: 'Zéphyr', adresse: null, texte: null },
    { table: 'magie', id: magie, nom: 'Magie de Zéphyr', adresse: adresseDeLaPage(magie), texte: null },
    { table: 'type_degats', id: 'sonore', nom: 'Zéphyr', adresse: null, texte: null },
    { table: 'monnaie', id: 'zf', nom: 'Zéphyr de fer', adresse: null, texte: null },
  ]);
  assert.equal(elementsDesMotsCles(db).has(m + 1), false);
});

test('sort : adresse <magie>#sort-<slug>, type Sort ; deux sorts homonymes de magies différentes passent', () => {
  const db = baseComplete();
  const a = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  const b = poserMagie(db, 'magies/magie-boree', 'Borée');
  const s1 = poserSort(db, a, 'Souffle commun');
  const s2 = poserSort(db, b, 'Souffle commun');
  assert.equal(adresseDuSort(s1), '/magies/magie-zephyr/#sort-souffle-commun');
  const plan = planDeLAncrage(db);
  assert.deepEqual(plan.a_trancher, []);
  for (const s of [s1, s2]) {
    const o = creationDe(plan, 'sort', s);
    assert.equal(o.apres.url, adresseDuSort(s));
    assert.equal(o.ancrage.type, idDeCategorie(db, 'Sort'));
  }
  assert.equal(plan.comptes.sorts, 2);
});

test('types : un par code utilisé, `meteo` reprend #239 sans changer son nom ni son adresse, `aleatoire` absent', () => {
  const db = baseComplete();
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  poserSort(db, magie, 'Souffle', { types: ['attaque', 'meteo'] });
  poserSort(db, magie, 'Brise', { types: ['attaque'] });
  poserMotCle(db, { id: 239, libelle: 'Zéphyr météo', url: '/regles/zephyr-meteo/', categories: ['Règles'] });
  const plan = planDeLAncrage(db);
  const attaque = creationDe(plan, 'type_sort', 'attaque');
  assert.equal(attaque.apres.libelle, 'Attaque');
  assert.equal(attaque.apres.url, null);
  assert.equal(attaque.ancrage.type, idDeCategorie(db, 'Type de sort'));
  assert.equal(creationDe(plan, 'type_sort', 'meteo'), undefined);
  assert.equal(ancreDe(plan, 'type_sort', 'meteo').apres.mot_cle_id, 239);
  assert.equal(alignementDe(plan, 239), undefined);
  assert.equal(creationDe(plan, 'type_sort', 'aleatoire'), undefined);
  assert.equal(ancreDe(plan, 'type_sort', 'aleatoire'), undefined);
  assert.equal(plan.comptes.types, 1);
});

test('même nom et même type sans parent : à trancher, jamais une erreur', () => {
  const db = baseComplete();
  const a = poserPage(db, 'capacites/zephyr-un', 'Frappe double');
  const b = poserPage(db, 'capacites/zephyr-deux', 'Frappe double');
  const c = poserPage(db, 'capacites/zephyr-trois', 'Frappe seule');
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'page', a));
  assert.ok(aTrancher(plan, 'page', b));
  assert.equal(creationDe(plan, 'page', a), undefined);
  assert.equal(creationDe(plan, 'page', b), undefined);
  assert.ok(creationDe(plan, 'page', c), 'les autres éléments restent au plan');
  assert.equal(plan.comptes.capacites, 1);
});

test('un élément nouveau face à un mot-clé en place de même nom et même type : seul le nouveau attend', () => {
  const db = baseComplete();
  const m = poserMotCle(db, { libelle: 'Frappe double', categories: ['Don'] });
  const page = poserPage(db, 'capacites/zephyr-un', 'Frappe double');
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'page', page));
  assert.equal(aTrancher(plan, 'mot_cle', m), undefined);
});

test('un titre qui s’écrit comme le synonyme d’un autre mot-clé : à trancher', () => {
  const db = baseComplete();
  poserMotCle(db, { libelle: 'Zéphyr ancien', categories: ['Règles'], synonymes: ['Frappe voisine'] });
  const nouvelle = poserPage(db, 'capacites/zephyr-un', 'Frappe voisine');
  const renommee = poserPage(db, 'races/zephyrine', 'Frappe voisine bis');
  poserMotCle(db, { libelle: 'Zéphyrine', url: adresseDeLaPage(renommee), categories: ['Race'], synonymes: ['Autre écriture'] });
  poserMotCle(db, { libelle: 'Zéphyr tiers', categories: ['Règles'], synonymes: ['Frappe voisine bis'] });
  const plan = planDeLAncrage(db);
  assert.ok(aTrancher(plan, 'page', nouvelle));
  assert.equal(creationDe(plan, 'page', nouvelle), undefined);
  assert.ok(aTrancher(plan, 'page', renommee), 'un renommage que la règle refuse sort du plan');
  assert.equal(ancreDe(plan, 'page', renommee), undefined);
  assert.equal(plan.comptes.renommes, 0);
});

test('tant qu’une catégorie nouvelle manque, seul le lot 1 est rendu ; les comptes décrivent tout l’ancrage', () => {
  const db = baseDAncrage();
  poserPage(db, 'capacites/zephyr-un', 'Frappe de Zéphyr');
  poserPage(db, 'guide/zephyr', 'Guide de Zéphyr');
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  poserSort(db, magie, 'Souffle');
  const plan = planDeLAncrage(db);
  assert.deepEqual(plan.lots.map((l) => l.famille), ['noms']);
  assert.deepEqual(plan.lots[0].operations.map((o) => o.apres.libelle), [...CATEGORIES_NOUVELLES]);
  assert.deepEqual(plan.lots[0].operations.map((o) => o.cle.id.$numero), ['c1', 'c2', 'c3', 'c4']);
  assert.deepEqual(plan.comptes, { crees: 4, capacites: 1, autres_pages: 1, sorts: 1, types: 1, renommes: 0, reclasses: 0, ancres_existants: 0 });
});

test('ordre du lot 1 : catégories, reclassements, ancres, alignements', () => {
  const db = baseDAncrage();
  const page = poserPage(db, 'races/zephyrine', 'Zéphyrine écrite');
  const m = poserMotCle(db, { libelle: 'Zéphyrine', url: adresseDeLaPage(page), categories: ['Race'] });
  poserMotCle(db, { id: TYPE_UNIQUE.Notion[0], libelle: 'Zéphyr notion', categories: ['Règles', 'Combat'] });
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  poserSort(db, magie, 'Souffle', { types: ['meteo'] });
  poserMotCle(db, { id: 239, libelle: 'Zéphyr météo', categories: ['Règles'] });
  const plan = planDeLAncrage(db);
  const genres = plan.lots[0].operations.map((o) => o.table);
  const rangs = ['categorie_mot_cle', 'mot_cle_categorie', 'page', 'type_sort', 'mot_cle'];
  assert.deepEqual([...new Set(genres)], rangs);
  assert.deepEqual(genres, [...genres].sort((x, y) => rangs.indexOf(x) - rangs.indexOf(y)));
  assert.deepEqual(alignementDe(plan, m).avant, { libelle: 'Zéphyrine' });
  assert.deepEqual(alignementDe(plan, m).apres, { libelle: 'Zéphyrine écrite' });
  assert.deepEqual(alignementDe(plan, m).ancrage, { aligner: true });
  assert.equal(plan.comptes.renommes, 1);
});

test('chaque lot porte au plus 2 000 opérations ; aucun `cle` dans un apres de création', () => {
  const db = baseComplete();
  for (let i = 0; i < 2003; i += 1) poserPage(db, `capacites/zephyr-${i}`, `Frappe numéro ${i}`);
  const plan = planDeLAncrage(db);
  assert.equal(plan.comptes.capacites, 2003);
  assert.equal(operationsDe(plan, 'capacites').length, 2000);
  for (const l of plan.lots) {
    assert.ok(l.operations.length <= 2000);
    for (const o of l.operations) if (o.operation === 'inserer' && o.table === 'mot_cle') assert.equal('cle' in o.apres, false);
  }
  appliquerEnSql(db, plan.lots[0]);
  assert.equal(operationsDe(planDeLAncrage(db), 'capacites').length, 3, 'le reste vient au plan suivant');
});

test('rejouable : une fois appliqué, le plan est vide', () => {
  const db = baseDAncrage();
  const designee = poserPage(db, 'races/zephyrine', 'Zéphyrine écrite');
  poserMotCle(db, { libelle: 'Zéphyrine', url: adresseDeLaPage(designee), categories: ['Race'] });
  poserMotCle(db, { id: TYPE_UNIQUE.Notion[0], libelle: 'Zéphyr notion', categories: ['Règles', 'Combat'] });
  poserPage(db, 'capacites/zephyr-un', 'Frappe double');
  poserPage(db, 'guide/zephyr', 'Guide de Zéphyr');
  const magieA = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  const magieB = poserMagie(db, 'magies/magie-boree', 'Borée');
  poserSort(db, magieA, 'Souffle commun', { types: ['attaque', 'meteo'] });
  poserSort(db, magieB, 'Souffle commun', { types: ['soin'] });
  poserMotCle(db, { id: 239, libelle: 'Zéphyr météo', url: '/regles/zephyr-meteo/', categories: ['Règles'] });
  let plan = planDeLAncrage(db);
  for (let tour = 0; plan.lots.length && tour < 6; tour += 1) {
    appliquerEnSql(db, plan.lots[0]);
    plan = planDeLAncrage(db);
  }
  assert.deepEqual(plan.lots, []);
  assert.deepEqual(plan.a_trancher, []);
  assert.deepEqual(plan.comptes, { crees: 0, capacites: 0, autres_pages: 0, sorts: 0, types: 0, renommes: 0, reclasses: 0, ancres_existants: 0 });
  assert.equal(db.prepare('SELECT count(*) AS n FROM page WHERE mot_cle_id IS NULL').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sort WHERE mot_cle_id IS NULL').get().n, 0);
  assert.equal(db.prepare("SELECT mot_cle_id FROM type_sort WHERE id = 'meteo'").get().mot_cle_id, 239);
  assert.equal(db.prepare("SELECT mot_cle_id FROM type_sort WHERE id = 'aleatoire'").get().mot_cle_id, null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM (SELECT mot_cle_id FROM mot_cle_categorie GROUP BY mot_cle_id HAVING count(*) > 1)').get().n, 0);
  const cles = db.prepare("SELECT cle FROM mot_cle WHERE libelle = 'Souffle commun' ORDER BY cle").all().map((x) => x.cle);
  assert.deepEqual(cles, ['souffle-commun-boree', 'souffle-commun-zephyr'], 'le parent distingue les deux sorts');
});

test('un renommage annulé revient au plan d’une page déjà ancrée, sauf si sa clé est écartée', () => {
  const db = baseComplete();
  const page = poserPage(db, 'races/zephyrine', 'Zéphyrine écrite');
  const m = poserMotCle(db, { libelle: 'Zéphyrine', url: adresseDeLaPage(page), categories: ['Race'] });
  db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(m, page);
  const plan = planDeLAncrage(db);
  assert.equal(ancreDe(plan, 'page', page), undefined, 'déjà ancrée');
  assert.deepEqual(alignementDe(plan, m).apres, { libelle: 'Zéphyrine écrite' });
  const ecarte = planDeLAncrage(db, { ecartees: new Set([`nom:${m}`]) });
  assert.deepEqual(ecarte.lots, []);
  assert.deepEqual(ecarte.ecartees, [`nom:${m}`]);
});

test('un sort ancré dont le nom a quitté son mot-clé (retiré, renommé, remis) : l’alignement est proposé, puis plus rien', () => {
  const db = baseComplete();
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  const sort = poserSort(db, magie, 'Souffle nouveau', { types: ['soin'] });
  const m = poserMotCle(db, { libelle: 'Souffle ancien', url: adresseDuSort(sort), categories: ['Sort'] });
  const t = poserMotCle(db, { libelle: 'Soin', categories: ['Type de sort'] });
  db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(m, sort);
  db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'soin'").run(t);
  const plan = planDeLAncrage(db);
  assert.deepEqual(alignementDe(plan, m).apres, { libelle: 'Souffle nouveau' });
  assert.equal(ancreDe(plan, 'sort', sort), undefined, 'déjà ancré');
  assert.equal(plan.comptes.renommes, 1);
  appliquerEnSql(db, plan.lots[0]);
  assert.deepEqual(planDeLAncrage(db).lots, []);
  const ecarte = planDeLAncrage(db, { ecartees: new Set([`sort:${sort}`]) });
  assert.deepEqual(ecarte.lots, [], 'aligné : plus rien à écarter');
  db.prepare('UPDATE sort SET nom = ? WHERE id = ?').run('Souffle encore', sort);
  const ecarteApres = planDeLAncrage(db, { ecartees: new Set([`sort:${sort}`]) });
  assert.deepEqual([ecarteApres.lots, ecarteApres.ecartees], [[], [`sort:${sort}`]], 'une ligne annulée reste écartée');
});

test('un sort ancré dont le nom est le synonyme d’un autre mot-clé : à trancher, son mot-clé ne bouge pas', () => {
  const db = baseComplete();
  poserMotCle(db, { libelle: 'Zéphyr règle', categories: ['Règles'], synonymes: ['Souffle pris'] });
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  const sort = poserSort(db, magie, 'Souffle pris', { types: ['soin'] });
  const m = poserMotCle(db, { libelle: 'Souffle ancien', url: adresseDuSort(sort), categories: ['Sort'] });
  const t = poserMotCle(db, { libelle: 'Soin', categories: ['Type de sort'] });
  db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(m, sort);
  db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'soin'").run(t);
  const plan = planDeLAncrage(db);
  assert.equal(alignementDe(plan, m), undefined);
  assert.ok(aTrancher(plan, 'sort', sort), JSON.stringify(plan.a_trancher));
  assert.deepEqual(plan.lots, []);
});

test('un type de sort ancré suit l’écriture unique de ses sorts ; écrit de deux façons : à trancher ; celui qui reprend un mot-clé garde son nom', () => {
  const db = baseComplete();
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  const s1 = poserSort(db, magie, 'Souffle un', { types: ['soin', 'attaque', 'meteo'] });
  const s2 = poserSort(db, magie, 'Souffle deux', { types: ['attaque'] });
  for (const s of [s1, s2]) {
    const n = db.prepare('SELECT nom FROM sort WHERE id = ?').get(s).nom;
    db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(poserMotCle(db, { libelle: n, url: adresseDuSort(s), categories: ['Sort'] }), s);
  }
  const soin = poserMotCle(db, { libelle: 'Soin ancien', categories: ['Type de sort'] });
  const attaque = poserMotCle(db, { libelle: 'Attaque', categories: ['Type de sort'] });
  const meteo = poserMotCle(db, { id: 239, libelle: 'Zéphyr météo', url: '/regles/zephyr-meteo/', categories: ['Type de sort'] });
  for (const [code, id] of [['soin', soin], ['attaque', attaque], ['meteo', meteo]]) db.prepare('UPDATE type_sort SET mot_cle_id = ? WHERE id = ?').run(id, code);
  db.prepare("UPDATE sort_type SET libelle = 'Attaques' WHERE sort_id = ? AND type = 'attaque'").run(s2);
  const plan = planDeLAncrage(db);
  assert.deepEqual(alignementDe(plan, soin).apres, { libelle: 'Soin' });
  assert.equal(alignementDe(plan, attaque), undefined);
  assert.match(aTrancher(plan, 'type_sort', 'attaque').raison, /Attaque, Attaques|Attaques, Attaque/);
  assert.equal(alignementDe(plan, meteo), undefined, 'il reprend un mot-clé : son nom ne suit pas');
});

test('le lecteur des mentions dit comme `mentionsDe` : sans la définition d’un mot-clé retiré depuis, et relit après `oublier`', () => {
  const db = baseComplete();
  const cite = poserMotCle(db, { libelle: 'Zéphyr cité', categories: ['Règles'] });
  const citant = poserMotCle(db, { libelle: 'Zéphyr citant', categories: ['Règles'] });
  const { cle } = db.prepare('SELECT cle FROM mot_cle WHERE id = ?').get(cite);
  db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(`Voir {{${cle}}}.`, citant);
  const page = poserPage(db, 'guide/zephyr', 'Guide de Zéphyr');
  const lecteur = lecteurDesMentions(db);
  assert.deepEqual(lecteur.de(cite), mentionsDe(db, cite));
  assert.deepEqual(lecteur.de(cite).map((x) => x.cle.id), [citant]);
  db.prepare('DELETE FROM mot_cle_categorie WHERE mot_cle_id = ?').run(citant); // clés étrangères coupées sur cette base : rien ne cascade
  db.prepare('DELETE FROM mot_cle WHERE id = ?').run(citant);
  assert.deepEqual(lecteur.de(cite), [], 'la définition retirée ne compte plus, sans relire');
  db.prepare('UPDATE page SET corps_md = ? WHERE id = ?').run(`Voir {{${cle}}}.`, page);
  assert.deepEqual(lecteur.de(cite), [], 'lu une fois : c’est à l’appelant d’oublier');
  lecteur.oublier();
  assert.deepEqual(lecteur.de(cite), mentionsDe(db, cite));
  assert.deepEqual(lecteur.de(cite).map((x) => x.cle.id), [page]);
  const apres = poserMotCle(db, { libelle: 'Zéphyr créé ensuite', categories: ['Règles'] });
  assert.deepEqual(lecteur.de(apres), [], 'un mot-clé créé depuis la lecture se lit directement');
});

test('une clé écartée est sautée et listée', () => {
  const db = baseComplete();
  const page = poserPage(db, 'capacites/zephyr-un', 'Frappe de Zéphyr');
  const designee = poserPage(db, 'races/zephyrine', 'Zéphyrine écrite');
  const m = poserMotCle(db, { libelle: 'Zéphyrine', url: adresseDeLaPage(designee), categories: ['Race'] });
  const magie = poserMagie(db, 'magies/magie-zephyr', 'Zéphyr');
  const sort = poserSort(db, magie, 'Souffle', { types: ['soin'] });
  const reclasse = poserMotCle(db, { id: TYPE_UNIQUE.Notion[0], libelle: 'Zéphyr notion', categories: ['Règles', 'Combat'] });
  const ecartees = new Set([`page:${page}`, `sort:${sort}`, 'type_sort:soin', `nom:${m}`, `type:${reclasse}`, 'page:capacites/absente']);
  const plan = planDeLAncrage(db, { ecartees });
  assert.equal(creationDe(plan, 'page', page), undefined);
  assert.equal(creationDe(plan, 'sort', sort), undefined);
  assert.equal(creationDe(plan, 'type_sort', 'soin'), undefined);
  assert.equal(alignementDe(plan, m), undefined);
  assert.ok(ancreDe(plan, 'page', designee), 'écarter le nom ne retire pas l’ancre');
  assert.equal(plan.lots.flatMap((l) => l.operations).filter((o) => o.table === 'mot_cle_categorie').length, 0);
  assert.deepEqual(plan.ecartees, [`nom:${m}`, `page:${page}`, `sort:${sort}`, `type:${reclasse}`, 'type_sort:soin'].sort());
  assert.deepEqual(plan.a_trancher, []);
});
