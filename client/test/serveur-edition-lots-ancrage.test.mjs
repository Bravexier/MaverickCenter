// Le format de lot apprend l'ancrage des mots-clés (décision R309, docs/chantier-ancrage-mots-cles.md, §5 à §7 ; serveur/edition-ancrage.mjs,
// serveur/edition-lots.mjs#traduire, lib/lot-de-changements.mjs) : créer un mot-clé ancré, poser une ancre, aligner un mot-clé sur son élément, recalculer
// les clés une seule fois en fin de lot. Noms inventés ; les lignes se prennent par ordre d'id, aucune valeur de règle n'est lue.
//   node --test test/serveur-edition-lots-ancrage.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ErreurEdition, enregistrer } from '../serveur/edition.mjs';
import { annuler, appliquer, decisionsCitees, deposer, lire, traduire } from '../serveur/edition-lots.mjs';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { controlerLeLot, FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('lots-ancrage');
let n = 0;
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin);
  return { db, dossier: join(racine, `essais${n}`) };
}
const lot = (operations) => ({ format: FORMAT_DU_LOT, titre: `Ancrage d’essai ${(n += 1)}`, nature: 'decision', decision: 'R309', operations });
// `mot_cle_categorie` est une table hors édition : le site de dev (base source) ouvre le lot, comme la route (serveur/api.mjs#traiterLots)
const proposer = (m, operations) => deposer(() => m.db, lot(operations), { enArrierePlan: false, dossier: m.dossier, controle: { ouvertHorsEdition: true } });
const nom = (suffixe) => `Zephyrion ${suffixe} ${process.pid}`;
const refusees = (m, p) => lire(m.db, p.id).essai.operations.filter((o) => o.etat === 'refusee');
const motCle = (m, id) => m.db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id);
const categoriesDe = (m, id) => m.db.prepare('SELECT categorie_id AS c FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY c').all(id).map((l) => l.c);
const ancreDe = (m, table, id) => m.db.prepare(`SELECT mot_cle_id AS a FROM "${table}" WHERE id = ?`).get(id).a;
const lesCategories = (m, k = 3) => m.db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT ?').all(k).map((c) => c.id);
const journal = (m, lotId) => m.db.prepare('SELECT table_nom AS t, operation AS o, cle, apres FROM modification WHERE lot_id = ? ORDER BY rang').all(lotId)
  .map((l) => ({ t: l.t, o: l.o, cle: JSON.parse(l.cle), apres: JSON.parse(l.apres ?? 'null') }));

/** Chaque clé de la base est celle que la règle donne (R232, R309). */
function clesJustes(m) {
  const vocabulaire = motsClesDeLaBase(m.db);
  const attendues = clesDesMotsCles(vocabulaire, new Map(categoriesDesMotsCles(m.db).map((c) => [c.id, c.libelle])));
  for (const x of vocabulaire) assert.equal(x.cle, attendues.get(x.id), `clé du mot-clé ${x.id}`);
}

/** Une page sans ancre, au titre inventé : son id, son titre, son adresse. */
function unePage(m, suffixe, rang = 0) {
  const { id } = m.db.prepare("SELECT id FROM page WHERE statut <> 'example' AND mot_cle_id IS NULL AND id LIKE 'capacites/%' ORDER BY id LIMIT 1 OFFSET ?").get(rang);
  const titre = nom(suffixe);
  m.db.prepare('UPDATE page SET titre = ? WHERE id = ?').run(titre, id);
  return { id, titre, url: adresseDeLaPage(id) };
}

/** Deux sorts de deux magies, renommés du même nom inventé. */
function deuxSortsHomonymes(m, suffixe) {
  const sorts = m.db.prepare('SELECT min(id) AS id, magie_id FROM sort GROUP BY magie_id ORDER BY magie_id LIMIT 2').all().map((s) => ({ ...s }));
  const titre = nom(suffixe);
  for (const s of sorts) m.db.prepare('UPDATE sort SET nom = ? WHERE id = ?').run(titre, s.id);
  return { titre, sorts: sorts.map((s) => ({ id: s.id, url: adresseDuSort(s.id) })) };
}

const creer = (jeton, table, id, libelle, url, type) => ({
  table: 'mot_cle', cle: { id: { $numero: jeton } }, operation: 'inserer', apres: { id: { $numero: jeton }, libelle, url }, ancrage: { table, id, type },
});
const ancrer = (table, id, motCleId) => ({ table, cle: { id }, operation: 'modifier', avant: { mot_cle_id: null }, apres: { mot_cle_id: motCleId } });
const retirerCategorie = (id, c) => ({ table: 'mot_cle_categorie', cle: { mot_cle_id: id, categorie_id: c }, operation: 'supprimer', avant: { mot_cle_id: id, categorie_id: c } });
const poserCategorie = (id, c) => ({ table: 'mot_cle_categorie', cle: { mot_cle_id: id, categorie_id: c }, operation: 'inserer', apres: { mot_cle_id: id, categorie_id: c } });
/** Une ancre de départ, posée en SQL : la préparation d'un test (un dépôt coûte un essai complet sur une copie de la base). */
const poserLAncre = (m, table, id, motCleId) => m.db.prepare(`UPDATE "${table}" SET mot_cle_id = ? WHERE id = ?`).run(motCleId, id);
/** Un mot-clé du Glossaire, créé par le service. */
function unMotCle(m, libelle, categories) {
  return enregistrer(m.db, { operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle, categories } }] }).crees[0].id;
}

test('format : `ancrage` refusé hors d’un inserer ou d’un alignement de mot_cle', () => {
  const structure = (table) => ({
    mot_cle: { colonnes: ['id', 'libelle', 'cle', 'url', 'description'], cle: ['id'], types: { id: 'INTEGER' } },
    page: { colonnes: ['id', 'titre', 'mot_cle_id'], cle: ['id'], types: { id: 'TEXT' } },
  })[table] ?? null;
  const fautes = (operation) => controlerLeLot({ titre: 'Essai', nature: 'decision', decision: 'R309', operations: [operation] }, { structure }).erreurs.map((e) => e.message);
  const inserer = (ancrage, apres = {}) => ({ table: 'mot_cle', cle: { id: { $numero: 'a' } }, operation: 'inserer', apres: { id: { $numero: 'a' }, libelle: 'X', url: null, ...apres }, ancrage });
  const aligner = (apres, ancrage = { aligner: true }) => ({ table: 'mot_cle', cle: { id: 1 }, operation: 'modifier', avant: Object.fromEntries(Object.keys(apres).map((c) => [c, 'avant'])), apres, ancrage });

  assert.deepEqual(fautes(inserer({ table: 'page', id: 'races/x', type: 2 })), []);
  assert.deepEqual(fautes(inserer({ table: 'type_sort', id: 'soin', type: 2 })), []);
  assert.deepEqual(fautes(aligner({ libelle: 'Y', url: '/y/' })), []);

  assert.match(fautes({ table: 'page', cle: { id: 'a' }, operation: 'modifier', avant: { titre: 'a' }, apres: { titre: 'b' }, ancrage: { aligner: true } })[0], /ancrage/);
  assert.match(fautes({ table: 'mot_cle', cle: { id: 1 }, operation: 'supprimer', avant: { id: 1, libelle: 'X', cle: 'x', url: null, description: null }, ancrage: { aligner: true } })[0], /ancrage/);
  assert.match(fautes(inserer({ table: 'magie', id: 'x', type: 2 }))[0], /ancrage/, 'une table qu’on n’ancre pas');
  assert.match(fautes(inserer({ table: 'page', id: '', type: 2 }))[0], /ancrage/, 'un id vide');
  assert.match(fautes(inserer({ table: 'page', id: 'x', type: 'Race' }))[0], /ancrage/, 'le type est un id de catégorie, jamais une rubrique');
  assert.match(fautes(inserer({ table: 'page', id: 'x', type: 2, autre: 1 }))[0], /ancrage/);
  assert.match(fautes(inserer({ aligner: true }))[0], /ancrage/);
  assert.match(fautes(inserer({ table: 'page', id: 'x', type: 2 }, { description: 'non' }))[0], /ancrage/, 'ni définition ni verrou à la création');
  assert.match(fautes(aligner({ libelle: 'Y' }, { aligner: false }))[0], /ancrage/);
  assert.match(fautes(aligner({ description: 'non' }))[0], /ancrage/, 'un alignement n’écrit que le nom et l’adresse');
  // `famille` (posée par le plan) n'est pas du format : l'action la retire avant de déposer
  assert.match(controlerLeLot({ titre: 'Essai', nature: 'decision', decision: 'R309', famille: 'noms', operations: [aligner({ libelle: 'Y' })] }, { structure }).erreurs[0].message, /famille/);
});

test('traduire : création ancrée, alignement, ancre, catégorie', () => {
  const cree = traduire({ table: 'mot_cle', cle: { id: 7 }, operation: 'inserer', apres: { id: 7, libelle: 'X', url: '/x/' }, ancrage: { table: 'page', id: 'races/x', type: 3 } });
  assert.deepEqual(cree.ops, [
    { op: 'ancrer_nouveau', table: 'page', id: 'races/x', libelle: 'X', url: '/x/', type: 3 },
    { op: 'verifier_ligne', table: 'mot_cle', cle: { id: 7 }, attendu: { id: 7, libelle: 'X', url: '/x/' } },
  ]);
  const aligne = traduire({ table: 'mot_cle', cle: { id: 7 }, operation: 'modifier', avant: { libelle: 'V' }, apres: { libelle: 'X' }, ancrage: { aligner: true } });
  assert.deepEqual(aligne.ops, [{ op: 'aligner_mot_cle', id: 7 }, { op: 'verifier_ligne', table: 'mot_cle', cle: { id: 7 }, attendu: { libelle: 'X' } }]);
  for (const table of ['page', 'sort', 'type_sort']) {
    const a = traduire({ table, cle: { id: 'e' }, operation: 'modifier', avant: { mot_cle_id: null }, apres: { mot_cle_id: 7 } });
    assert.deepEqual(a.ops, [{ op: 'ancrer_element', table, id: 'e', mot_cle_id: 7 }]);
  }
  const categorie = traduire({ table: 'categorie_mot_cle', cle: { id: 4 }, operation: 'inserer', apres: { id: 4, libelle: 'Y' } });
  assert.deepEqual(categorie.ops, [
    { op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle: 'Y' } },
    { op: 'verifier_ligne', table: 'categorie_mot_cle', cle: { id: 4 }, attendu: { id: 4, libelle: 'Y' } },
  ]);
  assert.match(traduire({ table: 'categorie_mot_cle', cle: { id: 4 }, operation: 'inserer', apres: { id: 4, libelle: 'Y', remarque: 'z' } }).refus, /remarque/);
  // sans `ancrage`, rien ne change : le mot-clé se crée par le service, l'autre référence d'une magie reste une écriture du journal
  assert.equal(traduire({ table: 'mot_cle', cle: { id: 7 }, operation: 'inserer', apres: { id: 7, libelle: 'X' } }).ops[0].op, 'creer');
  assert.equal(traduire({ table: 'magie', cle: { id: 'm' }, operation: 'modifier', avant: { mot_cle_id: null }, apres: { mot_cle_id: 7 } }).ops[0].op, 'ecrire_modifier');
});

test('une opération crée le mot-clé, son type et son ancre : journal mot_cle, mot_cle_categorie, page', async () => {
  const m = nouvelle();
  const page = unePage(m, 'page');
  const [type] = lesCategories(m);
  const p = await proposer(m, [creer('a', 'page', page.id, page.titre, page.url, type)]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(refusees(m, p)));
  assert.equal(ancreDe(m, 'page', page.id), null, 'l’essai n’écrit rien dans la base vivante');
  const fait = appliquer(m.db, p.id, {});
  const id = ancreDe(m, 'page', page.id);
  const ligne = motCle(m, id);
  assert.deepEqual([ligne.libelle, ligne.url, ligne.verrou, ligne.description], [page.titre, page.url, 0, null], 'jamais verrouillé, sans définition (R219 (5))');
  assert.deepEqual(categoriesDe(m, id), [type]);
  const lignes = journal(m, fait.lot_id);
  assert.ok(lignes.some((l) => l.t === 'mot_cle' && l.o === 'inserer' && l.cle.id === id));
  assert.ok(lignes.some((l) => l.t === 'mot_cle_categorie' && l.o === 'inserer' && l.cle.mot_cle_id === id && l.cle.categorie_id === type));
  assert.ok(lignes.some((l) => l.t === 'page' && l.o === 'modifier' && l.cle.id === page.id && l.apres.mot_cle_id === id));
  clesJustes(m);
});

test('la création refuse, sans numéro de décision, un nom, une adresse ou un homonyme que la règle n’admet pas (R309)', async () => {
  const m = nouvelle();
  const [p1, p2, p3, p4] = ['nom', 'adresse', 'sans adresse', 'homonyme'].map((s, i) => unePage(m, s, i));
  const [type] = lesCategories(m);
  unMotCle(m, p4.titre, [type]); // même nom, même type, pas de parent : la règle des clés refuse
  // un seul dépôt : à l'essai, chaque opération est jugée à part
  const p = await proposer(m, [
    creer('a', 'page', p1.id, nom('autre'), p1.url, type),
    creer('b', 'page', p2.id, p2.titre, '/races/', type),
    creer('c', 'page', p3.id, p3.titre, null, type),
    creer('d', 'page', p4.id, p4.titre, p4.url, type),
  ]);
  assert.equal(p.verdict, 'a_corriger');
  const refus = refusees(m, p);
  assert.equal(refus.length, 4);
  for (const r of refus) assert.deepEqual(decisionsCitees(r.message), [], `aucun verrou à ouvrir : ${r.message}`);
  assert.deepEqual(lire(m.db, p.id).essai.verrous_a_ouvrir, []);
  assert.throws(() => appliquer(m.db, p.id, { verrous_ouverts: ['R232'] }), (e) => e instanceof ErreurEdition && e.statut === 409);
  for (const x of [p1, p2, p3, p4]) assert.equal(ancreDe(m, 'page', x.id), null);
});

test('le second homonyme de même type reçoit sa clé par le parent (ancre écrite avant le recalcul)', async () => {
  const m = nouvelle();
  const { titre, sorts: [s1, s2] } = deuxSortsHomonymes(m, 'homonyme');
  const [type] = lesCategories(m);
  const p = await proposer(m, [creer('a', 'sort', s1.id, titre, s1.url, type), creer('b', 'sort', s2.id, titre, s2.url, type)]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(refusees(m, p)));
  appliquer(m.db, p.id, {});
  const [a, b] = [ancreDe(m, 'sort', s1.id), ancreDe(m, 'sort', s2.id)];
  assert.ok(a && b && a !== b);
  assert.notEqual(motCle(m, a).cle, motCle(m, b).cle);
  const magie = (s) => m.db.prepare('SELECT m.nom FROM sort s JOIN magie m ON m.id = s.magie_id WHERE s.id = ?').get(s.id).nom;
  const parents = new Map(motsClesDeLaBase(m.db).map((x) => [x.id, x.parent]));
  assert.deepEqual([parents.get(a), parents.get(b)], [magie(s1), magie(s2)]);
  clesJustes(m);
});

test('une catégorie créée par le lot est citée par jeton dans la clé composée', async () => {
  const m = nouvelle();
  const id = unMotCle(m, nom('categorie'), [lesCategories(m)[0]]);
  const libelle = nom('Type neuf');
  const jeton = { $numero: 'c1' };
  const p = await proposer(m, [
    { table: 'categorie_mot_cle', cle: { id: jeton }, operation: 'inserer', apres: { id: jeton, libelle } },
    { table: 'mot_cle_categorie', cle: { mot_cle_id: id, categorie_id: jeton }, operation: 'inserer', apres: { mot_cle_id: id, categorie_id: jeton } },
  ]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(refusees(m, p)));
  appliquer(m.db, p.id, {});
  const c = m.db.prepare('SELECT id FROM categorie_mot_cle WHERE libelle = ?').get(libelle).id;
  assert.deepEqual(categoriesDe(m, id), [lesCategories(m)[0], c]);
  clesJustes(m);
});

test('déplacer les catégories en plusieurs lignes passe par un seul recalcul, clés finales justes', async () => {
  const m = nouvelle();
  const [c1, c2, c3] = lesCategories(m);
  const libelle = nom('deplace');
  const a = unMotCle(m, libelle, [c1]);
  const b = unMotCle(m, libelle, [c2]);
  const cleDeB = motCle(m, b).cle;
  // entre les deux lignes, `a` n'a plus de catégorie : un recalcul à cet endroit serait refusé (R232 (9))
  const p = await proposer(m, [retirerCategorie(a, c1), poserCategorie(a, c3)]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.refus_de_l_application ?? refusees(m, p)));
  const fait = appliquer(m.db, p.id, {});
  assert.deepEqual(categoriesDe(m, a), [c3]);
  assert.equal(motCle(m, b).cle, cleDeB);
  const ecrituresDeLaCle = journal(m, fait.lot_id).filter((l) => l.t === 'mot_cle' && l.cle.id === a && l.apres && 'cle' in l.apres);
  assert.equal(ecrituresDeLaCle.length, 1, 'la clé est écrite une seule fois, en fin de lot');
  clesJustes(m);
});

test('un recalcul refusé : essai a_corriger, application refusée, rien d’écrit', async () => {
  const m = nouvelle();
  const [c1, c2] = lesCategories(m);
  const libelle = nom('refus');
  const a = unMotCle(m, libelle, [c1]);
  const b = unMotCle(m, libelle, [c2]);
  const cleDeA = motCle(m, a).cle;
  const lots = m.db.prepare('SELECT count(*) AS n FROM modification_lot').get().n;
  // `a` prend la catégorie de `b` : deux homonymes de même type, sans parent
  const p = await proposer(m, [retirerCategorie(a, c1), poserCategorie(a, c2)]);
  assert.equal(p.verdict, 'a_corriger');
  assert.ok(lire(m.db, p.id).essai.refus_de_l_application);
  assert.deepEqual(lire(m.db, p.id).essai.verrous_a_ouvrir, []);
  assert.throws(() => appliquer(m.db, p.id, { verrous_ouverts: ['R232'] }), (e) => e instanceof ErreurEdition && e.statut === 409);
  assert.deepEqual(categoriesDe(m, a), [c1]);
  assert.equal(motCle(m, a).cle, cleDeA);
  assert.equal(categoriesDe(m, b)[0], c2);
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM modification_lot').get().n, lots);
});

test('aligner recopie l’élément : un `apres` différent de l’élément est refusé', async () => {
  const m = nouvelle();
  const [p1, p2, p3] = ['aligne a', 'aligne b', 'aligne c'].map((s, i) => unePage(m, s, i));
  const [type] = lesCategories(m);
  const anciens = ['ancien a', 'ancien b', 'ancien c'].map(nom);
  const [k1, k2, k3] = anciens.map((a) => unMotCle(m, a, [type]));
  [[p1, k1], [p2, k2], [p3, k3]].forEach(([x, k]) => poserLAncre(m, 'page', x.id, k));
  const libre = unMotCle(m, nom('sans element'), [type]);
  const aligner = (id, ancien, apres) => ({
    table: 'mot_cle', cle: { id }, operation: 'modifier', avant: Object.fromEntries(Object.keys(apres).map((c) => [c, { libelle: ancien, url: null }[c]])), apres, ancrage: { aligner: true },
  });

  // un autre nom, une autre adresse, un mot-clé sans élément : un seul dépôt, chaque opération jugée à part
  const faux = await proposer(m, [
    aligner(k1, anciens[0], { libelle: nom('fantaisie'), url: p1.url }),
    aligner(k2, anciens[1], { libelle: p2.titre, url: '/races/' }),
    aligner(libre, nom('sans element'), { libelle: nom('autre') }),
  ]);
  assert.equal(faux.verdict, 'a_corriger');
  assert.equal(refusees(m, faux).length, 3);
  for (const r of refusees(m, faux)) assert.deepEqual(decisionsCitees(r.message), [], r.message);
  assert.deepEqual(lire(m.db, faux.id).essai.verrous_a_ouvrir, []);
  assert.equal(motCle(m, k1).libelle, anciens[0]);

  const bon = await proposer(m, [aligner(k3, anciens[2], { libelle: p3.titre, url: p3.url })]);
  assert.equal(bon.verdict, 'applicable', JSON.stringify(refusees(m, bon)));
  const fait = appliquer(m.db, bon.id, {});
  assert.deepEqual([motCle(m, k3).libelle, motCle(m, k3).url], [p3.titre, p3.url]);
  clesJustes(m);
  assert.equal(journal(m, fait.lot_id).filter((l) => l.t === 'mot_cle' && l.apres && 'cle' in l.apres).length, 1, 'la clé suit, recalculée une fois');
});

test('retirer une ancre par un lot est refusé, permis à l’annulation', async () => {
  const m = nouvelle();
  const [p1, p2] = ['retirer', 'remplacer'].map((s, i) => unePage(m, s, i));
  const [type] = lesCategories(m);
  const k1 = unMotCle(m, p1.titre, [type]);
  const k2 = unMotCle(m, p2.titre, [type]);
  const autre = unMotCle(m, nom('autre ancre'), [type]);
  poserLAncre(m, 'page', p2.id, k2);
  const pose = await proposer(m, [ancrer('page', p1.id, k1)]);
  appliquer(m.db, pose.id, {});
  assert.equal(ancreDe(m, 'page', p1.id), k1);

  const refus = await proposer(m, [
    { table: 'page', cle: { id: p1.id }, operation: 'modifier', avant: { mot_cle_id: k1 }, apres: { mot_cle_id: null } },
    { table: 'page', cle: { id: p2.id }, operation: 'modifier', avant: { mot_cle_id: k2 }, apres: { mot_cle_id: autre } },
  ]);
  assert.equal(refus.verdict, 'a_corriger');
  assert.equal(refusees(m, refus).length, 2);
  for (const r of refusees(m, refus)) assert.deepEqual(decisionsCitees(r.message), [], r.message);
  assert.deepEqual([ancreDe(m, 'page', p1.id), ancreDe(m, 'page', p2.id)], [k1, k2]);

  assert.equal(annuler(m.db, pose.id, {}).etat, 'annule');
  assert.equal(ancreDe(m, 'page', p1.id), null);
  assert.ok(motCle(m, k1), 'le mot-clé, créé hors du lot, reste');
});

test('annuler le lot retire le mot-clé, son type et l’ancre, clés recalculées', async () => {
  const m = nouvelle();
  const { titre, sorts: [s1, s2] } = deuxSortsHomonymes(m, 'annule');
  const [type, autreType] = lesCategories(m);
  // un homonyme en place, d'un autre type : sa clé change avec le lot et revient avec l'annulation
  const voisin = unMotCle(m, titre, [autreType]);
  const cleDuVoisin = motCle(m, voisin).cle;
  const p = await proposer(m, [creer('a', 'sort', s1.id, titre, s1.url, type), creer('b', 'sort', s2.id, titre, s2.url, type)]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(refusees(m, p)));
  appliquer(m.db, p.id, {});
  const [a, b] = [ancreDe(m, 'sort', s1.id), ancreDe(m, 'sort', s2.id)];
  assert.notEqual(motCle(m, voisin).cle, cleDuVoisin, 'l’homonyme prend son type dans sa clé');
  clesJustes(m);

  const retour = annuler(m.db, p.id, {});
  assert.equal(retour.etat, 'annule');
  assert.deepEqual(retour.verrous_ouverts ?? null, null);
  for (const [s, x] of [[s1, a], [s2, b]]) {
    assert.equal(ancreDe(m, 'sort', s.id), null);
    assert.equal(motCle(m, x), undefined);
    assert.deepEqual(categoriesDe(m, x), []);
  }
  assert.equal(motCle(m, voisin).cle, cleDuVoisin, 'la clé du voisin est revenue');
  clesJustes(m);
});

test('à l’annulation, une clé que la règle maintient est gardée, sans verrou à ouvrir', async () => {
  const m = nouvelle();
  const page = unePage(m, 'maintenue');
  const [c1, c2, c3] = lesCategories(m);
  const voisin = unMotCle(m, page.titre, [c2]);
  const p = await proposer(m, [creer('a', 'page', page.id, page.titre, page.url, c1)]);
  appliquer(m.db, p.id, {});
  const clePosee = motCle(m, voisin).cle;
  // depuis le lot, un autre homonyme apparaît : le voisin garde sa clé à catégorie quand le mot-clé du lot repart
  unMotCle(m, page.titre, [c3]);
  assert.equal(motCle(m, voisin).cle, clePosee);
  const retour = annuler(m.db, p.id, {});
  assert.equal(retour.etat, 'annule');
  assert.equal(motCle(m, voisin).cle, clePosee);
  const ligne = retour.bilan.annulation.operations.find((o) => o.table === 'mot_cle' && o.cle.id === voisin);
  assert.equal(ligne.etat, 'gardee');
  assert.deepEqual(ligne.ecarts.map((e) => e.colonne), ['cle']);
  assert.deepEqual(retour.bilan.annulation.verrous_ouverts, []);
  clesJustes(m);
});

test('annuler un lot de catégories et d’alignement remet tout d’un bloc, sans état intermédiaire refusé', async () => {
  const m = nouvelle();
  const [c1, c2, c3] = lesCategories(m);
  const libelle = nom('aller retour');
  const a = unMotCle(m, libelle, [c1]);
  const b = unMotCle(m, libelle, [c2]);
  const page = unePage(m, 'aller retour page');
  const ancien = nom('nom d’avant');
  const c = unMotCle(m, ancien, [c3]);
  poserLAncre(m, 'page', page.id, c);
  const cles = [a, b, c].map((id) => motCle(m, id).cle);
  const p = await proposer(m, [
    retirerCategorie(a, c1), poserCategorie(a, c3),
    { table: 'mot_cle', cle: { id: c }, operation: 'modifier', avant: { libelle: ancien, url: null }, apres: { libelle: page.titre, url: page.url }, ancrage: { aligner: true } },
  ]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.refus_de_l_application ?? refusees(m, p)));
  appliquer(m.db, p.id, {});
  assert.deepEqual(categoriesDe(m, a), [c3]);
  assert.equal(motCle(m, c).libelle, page.titre);

  assert.equal(annuler(m.db, p.id, {}).etat, 'annule');
  assert.deepEqual(categoriesDe(m, a), [c1]);
  assert.deepEqual([motCle(m, c).libelle, motCle(m, c).url], [ancien, null]);
  assert.deepEqual([a, b, c].map((id) => motCle(m, id).cle), cles);
  clesJustes(m);
});
