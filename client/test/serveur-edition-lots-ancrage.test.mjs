// Le format de lot apprend l'ancrage des mots-clés (décision R309, docs/chantier-ancrage-mots-cles.md, §5 à §7 ; serveur/edition-ancrage.mjs,
// serveur/edition-lots.mjs#traduire, lib/lot-de-changements.mjs) : créer un mot-clé ancré, poser une ancre, aligner un mot-clé sur son élément, recalculer
// les clés une seule fois en fin de lot. Noms inventés ; les lignes se prennent par ordre d'id, aucune valeur de règle n'est lue.
//   node --test test/serveur-edition-lots-ancrage.test.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { ErreurEdition, enregistrer } from '../serveur/edition.mjs';
import { annuler, annulerUneLigne, appliquer, decisionsCitees, deposer, lire, previsualiserLAnnulation, traduire } from '../serveur/edition-lots.mjs';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { controlerLeLot, FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { AUTEUR_DE_L_ANCRAGE, DECISION_DE_L_ANCRAGE } from '../src/lib/lots-d-ancrage.mjs';
import { htmlDeLApercu } from '../src/lib/lots-rendu.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, lireUnMotCle, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { copieDeLaBaseLegere } from './aide-base-legere.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('lots-ancrage');
let n = 0;
function nouvelle() {
  const db = ouvrirBaseVivante(copieDeLaBaseLegere(racine, `b${(n += 1)}`));
  return { db, dossier: join(racine, `essais${n}`) };
}
// le lot de l'action « Préparer l'ancrage » : sa décision et son auteur (lib/lots-d-ancrage.mjs) ; un lot de l'équipe qui cite R309 passe `auteur`
const lot = (operations, plus = {}) => ({ format: FORMAT_DU_LOT, titre: `Ancrage d’essai ${(n += 1)}`, nature: 'decision', decision: DECISION_DE_L_ANCRAGE, auteur: AUTEUR_DE_L_ANCRAGE, operations, ...plus });
// `mot_cle_categorie` est une table hors édition : le site de dev (base source) ouvre le lot, comme la route (serveur/api.mjs#traiterLots)
const proposer = (m, operations, plus) => deposer(() => m.db, lot(operations, plus), { enArrierePlan: false, dossier: m.dossier, controle: { ouvertHorsEdition: true } });
const nom = (suffixe) => `Zephyrion ${suffixe} ${process.pid}`;
const refusees = (m, p) => lire(m.db, p.id).essai.operations.filter((o) => o.etat === 'refusee');
// le mot-clé tel qu'il se lit : nom, adresse, définition, couleur et icône sur son élément (migration 0136 ; lib/mots-cles-db.mjs#lireUnMotCle)
const motCle = (m, id) => lireUnMotCle(m.db, id) ?? undefined;
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
const synonymeDuLot = (jeton, motCle, libelle) => ({
  table: 'mot_cle_synonyme', cle: { id: { $numero: jeton } }, operation: 'inserer', apres: { id: { $numero: jeton }, mot_cle_id: { $numero: motCle }, libelle, libelle_cle: normalize(libelle), ordre: 90 },
});
/** Un synonyme écrit en SQL, sous un id neuf : ce que le site ajoute depuis le lot. */
const poserSynonyme = (m, motCleId, libelle) => m.db.prepare('INSERT INTO mot_cle_synonyme (id, mot_cle_id, libelle, libelle_cle, ordre) VALUES ((SELECT coalesce(max(id), 0) + 1 FROM mot_cle_synonyme), ?, ?, ?, 0)')
  .run(motCleId, libelle, normalize(libelle));
/** Une ancre de départ, posée en SQL : la préparation d'un test (un dépôt coûte un essai complet sur une copie de la base). */
// (un repère ne double jamais une page ni un sort, migration 0136 : celui du mot-clé est retiré, son nom se lit désormais sur l'élément)
const poserLAncre = (m, table, id, motCleId) => {
  m.db.prepare(`UPDATE "${table}" SET mot_cle_id = ? WHERE id = ?`).run(motCleId, id);
  m.db.prepare('DELETE FROM repere WHERE mot_cle_id = ?').run(motCleId);
};
/** Un mot-clé du Glossaire, créé par le service. */
function unMotCle(m, libelle, categories) {
  return enregistrer(m.db, { operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle, categories } }] }).crees[0].id;
}
/** Le numéro d'une ligne du lot : le rang de sa première écriture au journal. */
const rangDe = (m, lotId, table, cle) => m.db.prepare('SELECT rang, cle FROM modification WHERE lot_id = ? AND table_nom = ? ORDER BY rang').all(lotId, table)
  .find((l) => Object.entries(cle).every(([c, v]) => JSON.parse(l.cle)[c] === v))?.rang;
const croissant = (liste) => [...liste].sort((x, y) => x - y);
const lignesNotees = (lotPresente) => croissant(Object.keys(lotPresente.bilan.lignes_annulees).map(Number));

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
  const [ancienne] = lesCategories(m);
  const id = unMotCle(m, nom('categorie'), [ancienne]);
  const libelle = nom('Type neuf');
  const jeton = { $numero: 'c1' };
  // un seul type à la fin du lot (R309, qui remplace R232 (5)) : la catégorie neuve prend la place de l'ancienne
  const p = await proposer(m, [
    retirerCategorie(id, ancienne),
    { table: 'categorie_mot_cle', cle: { id: jeton }, operation: 'inserer', apres: { id: jeton, libelle } },
    { table: 'mot_cle_categorie', cle: { mot_cle_id: id, categorie_id: jeton }, operation: 'inserer', apres: { mot_cle_id: id, categorie_id: jeton } },
  ]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(refusees(m, p)));
  appliquer(m.db, p.id, {});
  const c = m.db.prepare('SELECT id FROM categorie_mot_cle WHERE libelle = ?').get(libelle).id;
  assert.deepEqual(categoriesDe(m, id), [c]);
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
  // `avant` : le mot-clé tel qu'il se lit ; depuis la migration 0136, celui d'un mot-clé ancré est déjà le nom et l'adresse de son élément : seules les colonnes
  // que l'opération change s'écrivent
  const aligner = (id, apres) => ({
    table: 'mot_cle', cle: { id }, operation: 'modifier', avant: Object.fromEntries(Object.keys(apres).map((c) => [c, motCle(m, id)[c]])), apres, ancrage: { aligner: true },
  });

  // un autre nom, une autre adresse, un mot-clé sans élément : un seul dépôt, chaque opération jugée à part
  const faux = await proposer(m, [
    aligner(k1, { libelle: nom('fantaisie') }),
    aligner(k2, { url: '/races/' }),
    aligner(libre, { libelle: nom('autre') }),
  ]);
  assert.equal(faux.verdict, 'a_corriger');
  assert.equal(refusees(m, faux).length, 3);
  for (const r of refusees(m, faux)) assert.deepEqual(decisionsCitees(r.message), [], r.message);
  assert.deepEqual(lire(m.db, faux.id).essai.verrous_a_ouvrir, []);
  assert.deepEqual([motCle(m, k1).libelle, motCle(m, k2).url], [p1.titre, p2.url], 'rien n’est écrit : le nom et l’adresse restent ceux de la page');

  // un lot d'avant la migration 0136 (le nom d'avant dans `avant`, l'élément dans `apres`) : il reste un lot valide, mais le mot-clé lit déjà son élément ;
  // l'essai le dit changé depuis, rien n'est à écrire (le plan de l'ancrage n'écrit plus d'alignement : décision B4 (1) du chantier 4)
  const bon = await proposer(m, [{ table: 'mot_cle', cle: { id: k3 }, operation: 'modifier', avant: { libelle: anciens[2], url: null }, apres: { libelle: p3.titre, url: p3.url }, ancrage: { aligner: true } }]);
  assert.equal(bon.verdict, 'rien_a_ecrire', JSON.stringify(lire(m.db, bon.id).essai.operations));
  assert.deepEqual(lire(m.db, bon.id).essai.operations.map((o) => o.etat), ['changee']);
  assert.deepEqual([motCle(m, k3).libelle, motCle(m, k3).url], [p3.titre, p3.url]);
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

test('annuler le lot retire le mot-clé, son type et l’ancre, clés recalculées ; un groupe changé depuis le lot reste entier', async () => {
  const m = nouvelle();
  const { titre, sorts: [s1, s2] } = deuxSortsHomonymes(m, 'annule');
  const [type, autreType] = lesCategories(m);
  // un homonyme en place, d'un autre type : sa clé change avec le lot et revient avec l'annulation
  const voisin = unMotCle(m, titre, [autreType]);
  const cleDuVoisin = motCle(m, voisin).cle;
  const [pageDefinition, pageSynonyme, pageRemplacee, pageRetouchee, pageRetiree] = ['garde definition', 'garde synonyme', 'garde remplacee', 'garde retouchee', 'fille retiree'].map((s, i) => unePage(m, s, i));
  const reclasse = unMotCle(m, nom('reclasse garde'), [type]);
  const jeton = { $numero: 'c' };
  const typeNeuf = nom('Type garde');
  const p = await proposer(m, [
    { table: 'categorie_mot_cle', cle: { id: jeton }, operation: 'inserer', apres: { id: jeton, libelle: typeNeuf } },
    creer('a', 'sort', s1.id, titre, s1.url, type),
    creer('b', 'sort', s2.id, titre, s2.url, type),
    creer('d', 'page', pageDefinition.id, pageDefinition.titre, pageDefinition.url, type),
    creer('s', 'page', pageSynonyme.id, pageSynonyme.titre, pageSynonyme.url, type),
    creer('r', 'page', pageRemplacee.id, pageRemplacee.titre, pageRemplacee.url, type), synonymeDuLot('yr', 'r', nom('syn du lot remplace')),
    creer('t', 'page', pageRetouchee.id, pageRetouchee.titre, pageRetouchee.url, type), synonymeDuLot('yt', 't', nom('syn du lot retouche')),
    creer('x', 'page', pageRetiree.id, pageRetiree.titre, pageRetiree.url, type), synonymeDuLot('yx', 'x', nom('syn du lot retire')),
    retirerCategorie(reclasse, type), poserCategorie(reclasse, jeton),
  ]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.refus_de_l_application ?? refusees(m, p)));
  const fait = appliquer(m.db, p.id, {});
  const [a, b] = [ancreDe(m, 'sort', s1.id), ancreDe(m, 'sort', s2.id)];
  assert.notEqual(motCle(m, voisin).cle, cleDuVoisin, 'l’homonyme prend son type dans sa clé');
  clesJustes(m);

  // depuis le lot : une définition, un synonyme, une catégorie de plus sur le mot-clé reclassé
  const [kd, ks] = [ancreDe(m, 'page', pageDefinition.id), ancreDe(m, 'page', pageSynonyme.id)];
  const neuve = m.db.prepare('SELECT id FROM categorie_mot_cle WHERE libelle = ?').get(typeNeuf).id;
  // la définition s'écrit sur l'élément du mot-clé (sa page, ancrée par le lot ; migration 0136)
  m.db.prepare('UPDATE page SET definition = ? WHERE mot_cle_id = ?').run(`Définition posée ${process.pid}`, kd);
  const synonyme = nom('synonyme ajoute');
  poserSynonyme(m, ks, synonyme);
  m.db.prepare('INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (?, ?)').run(reclasse, type);
  // les synonymes du lot : l'un remplacé par un autre, l'un retouché, l'un retiré sans remplaçant
  const [kr, kt, kx] = [pageRemplacee, pageRetouchee, pageRetiree].map((page) => ancreDe(m, 'page', page.id));
  const [sr, st, sx] = [kr, kt, kx].map((k) => m.db.prepare('SELECT id FROM mot_cle_synonyme WHERE mot_cle_id = ?').get(k).id);
  const [remplacant, retouche] = [nom('syn remplacant'), nom('syn retouche')];
  poserSynonyme(m, kr, remplacant);
  m.db.prepare('DELETE FROM mot_cle_synonyme WHERE id IN (?, ?)').run(sr, sx);
  m.db.prepare('UPDATE mot_cle_synonyme SET libelle = ?, libelle_cle = ? WHERE id = ?').run(retouche, normalize(retouche), st);
  const synonymesDe = (k) => m.db.prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ?').all(k).map((l) => l.libelle);
  const rang = (table, cle) => rangDe(m, fait.lot_id, table, cle);
  const enPlace = () => {
    for (const [k, page] of [[kd, pageDefinition], [ks, pageSynonyme], [kr, pageRemplacee], [kt, pageRetouchee]]) {
      assert.ok(motCle(m, k));
      assert.deepEqual(categoriesDe(m, k), [type]);
      assert.equal(ancreDe(m, 'page', page.id), k);
    }
    assert.deepEqual(synonymesDe(kr), [remplacant], 'le synonyme ajouté depuis le lot reste');
    assert.deepEqual(synonymesDe(kt), [retouche], 'le libellé retouché depuis le lot reste');
    assert.deepEqual(categoriesDe(m, reclasse), [type, neuve]);
  };

  // annuler une de leurs lignes : l'aperçu dit pourquoi, le clic ne remet rien
  const vu = await previsualiserLAnnulation(() => m.db, p.id, { enArrierePlan: false, dossier: m.dossier, ligne: rang('mot_cle_categorie', { mot_cle_id: kd, categorie_id: type }) });
  assert.equal(vu.verdict, 'rien_a_remettre', JSON.stringify(vu.operations.map((o) => [o.table, o.etat])));
  assert.ok(vu.operations.length >= 3);
  for (const o of vu.operations) {
    assert.equal(o.etat, 'gardee');
    assert.match(o.message, /a changé depuis le lot/);
  }
  assert.match(htmlDeLApercu(vu.operations, { contexte: 'annulation', toutes: true }), /a changé depuis le lot/, 'la page dit pourquoi');
  assert.equal(lire(m.db, p.id).lignes.find((l) => l.n === rang('page', { id: pageSynonyme.id })).annulable_seule, false);
  for (const numero of [rang('mot_cle', { id: kd }), rang('page', { id: pageSynonyme.id }), rang('mot_cle', { id: kr }), rang('page', { id: pageRetouchee.id }), rang('mot_cle_categorie', { mot_cle_id: reclasse, categorie_id: neuve })]) {
    assert.throws(() => annulerUneLigne(m.db, p.id, numero), (e) => e instanceof ErreurEdition && e.statut === 409 && /Rien à remettre pour cette ligne/.test(e.message));
  }
  enPlace();

  // le lot entier : ces groupes restent, les autres partent
  const retour = annuler(m.db, p.id, {});
  assert.equal(retour.etat, 'annule');
  assert.deepEqual(retour.verrous_ouverts ?? null, null);
  for (const [s, x] of [[s1, a], [s2, b]]) {
    assert.equal(ancreDe(m, 'sort', s.id), null);
    assert.equal(motCle(m, x), undefined);
    assert.deepEqual(categoriesDe(m, x), []);
  }
  enPlace();
  assert.equal(motCle(m, kx), undefined, 'une fille du lot retirée depuis, sans rien d’ajouté, ne garde rien');
  assert.equal(ancreDe(m, 'page', pageRetiree.id), null);
  assert.ok(m.db.prepare('SELECT 1 FROM categorie_mot_cle WHERE id = ?').get(neuve), 'le type neuf range encore le mot-clé gardé');
  const gardees = retour.bilan.annulation.operations.filter((o) => o.table === 'mot_cle_categorie' && [kd, ks, kr, kt].includes(o.cle.mot_cle_id));
  assert.equal(gardees.length, 4);
  for (const o of gardees) {
    assert.equal(o.etat, 'gardee');
    assert.match(o.message, /a changé depuis le lot/);
    assert.match(lire(m.db, p.id).lignes.find((l) => l.n === o.rang_du_lot).motif, /a changé depuis le lot/, 'la raison reste lisible après l’annulation');
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
  // l'ancre posée en SQL ne recalcule pas la clé : elle prend celle que le site donne au nom lu sur la page
  const attendues = clesDesMotsCles(motsClesDeLaBase(m.db), new Map(categoriesDesMotsCles(m.db).map((x) => [x.id, x.libelle])));
  m.db.prepare('UPDATE mot_cle SET cle = ? WHERE id = ?').run(attendues.get(c), c);
  clesJustes(m);
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
  // depuis la migration 0136, le mot-clé ancré lit son nom et son adresse sur sa page, avant comme après l'annulation (l'alignement n'écrit plus rien)
  assert.deepEqual([motCle(m, c).libelle, motCle(m, c).url], [page.titre, page.url]);
  assert.deepEqual([a, b, c].map((id) => motCle(m, id).cle), cles);
  clesJustes(m);
});

test('annuler d’un bloc : le texte qui cite le mot-clé créé et celui d’un homonyme reclassé reviennent ; hors R309, une ligne de catégorie reste seule', async () => {
  const m = nouvelle();
  const [c1, c2, c3] = lesCategories(m);
  const libelle = nom('texte');
  const a = unMotCle(m, libelle, [c1]);
  unMotCle(m, libelle, [c2]);
  const seule = unMotCle(m, nom('ligne seule'), [c1]);
  const [t1, t2] = m.db.prepare('SELECT id FROM metier ORDER BY id LIMIT 2').all().map((t) => t.id);
  const texte = (id) => m.db.prepare('SELECT description FROM metier WHERE id = ?').get(id).description;
  enregistrer(m.db, { operations: [{ op: 'modifier', table: 'metier', cle: { id: t2 }, valeurs: { description: `Ancien texte {{${motCle(m, a).cle}}} ${process.pid}.` } }] });
  const [avant1, avant2] = [texte(t1), texte(t2)];
  const cles = motsClesDeLaBase(m.db).map((x) => [x.id, x.cle]);
  const cree = nom('cree');
  const jeton = { $numero: 'k' };
  const p = await proposer(m, [
    { table: 'mot_cle', cle: { id: jeton }, operation: 'inserer', apres: { id: jeton, libelle: cree } },
    poserCategorie(jeton, c3),
    { table: 'metier', cle: { id: t1 }, operation: 'modifier', avant: { description: avant1 }, apres: { description: `Il cite {{${normalize(cree)}}} ${process.pid}.` } },
    retirerCategorie(a, c1), poserCategorie(a, c3),
    { table: 'metier', cle: { id: t2 }, operation: 'modifier', avant: { description: avant2 }, apres: { description: `Nouveau texte {{${motCle(m, a).cle}}} ${process.pid}.` } },
    retirerCategorie(seule, c1), poserCategorie(seule, c2),
  ], { nature: 'code', decision: null });
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.refus_de_l_application ?? refusees(m, p)));
  const fait = appliquer(m.db, p.id, {});
  assert.notEqual(texte(t2), avant2);

  const n1 = rangDe(m, fait.lot_id, 'mot_cle_categorie', { mot_cle_id: seule, categorie_id: c1 });
  assert.deepEqual(lignesNotees(annulerUneLigne(m.db, p.id, n1)), [n1], 'hors R309, la ligne n’emporte pas sa voisine');
  assert.deepEqual(categoriesDe(m, seule), [c1, c2]);

  const vu = await previsualiserLAnnulation(() => m.db, p.id, { enArrierePlan: false, dossier: m.dossier });
  assert.equal(vu.verdict, 'applicable', JSON.stringify(vu.refus_de_l_annulation ?? vu.operations.filter((o) => o.etat === 'refusee')));
  assert.equal(annuler(m.db, p.id, {}).etat, 'annule');
  assert.equal(m.db.prepare('SELECT id FROM v_mot_cle WHERE libelle = ?').get(cree), undefined);
  assert.equal(texte(t1), avant1, 'le texte qui citait le mot-clé créé');
  assert.equal(texte(t2), avant2, 'le texte du lot ne reste pas, sa balise cite l’ancienne clé');
  assert.deepEqual(categoriesDe(m, a), [c1]);
  assert.deepEqual(categoriesDe(m, seule), [c1]);
  assert.deepEqual(motsClesDeLaBase(m.db).map((x) => [x.id, x.cle]), cles);
  clesJustes(m);
});

test('un lot de l’équipe qui cite R309 (décision 17) est ordinaire : une ligne de reclassement reste seule, comme hors R309', async () => {
  const m = nouvelle();
  const [c1, c2] = lesCategories(m);
  const reclasse = unMotCle(m, nom('equipe'), [c1]);
  const p = await proposer(m, [retirerCategorie(reclasse, c1), poserCategorie(reclasse, c2)], { auteur: 'équipe' });
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.refus_de_l_application ?? refusees(m, p)));
  const fait = appliquer(m.db, p.id, {});
  assert.equal(lire(m.db, p.id).decision, 'R309');
  const n1 = rangDe(m, fait.lot_id, 'mot_cle_categorie', { mot_cle_id: reclasse, categorie_id: c1 });
  assert.deepEqual(lignesNotees(annulerUneLigne(m.db, p.id, n1)), [n1], 'le lot de l’équipe n’emporte pas la ligne voisine');
  assert.deepEqual(categoriesDe(m, reclasse), [c1, c2]);
  clesJustes(m);
});

test('annuler d’un bloc : un mot-clé du lot cité par le texte qu’une autre ligne remet part avec lui ; cité depuis le lot par un texte hors du lot, il refuse l’annulation et rien n’est écrit', async () => {
  const m = nouvelle();
  const [c1] = lesCategories(m);
  const [t1, t2] = m.db.prepare('SELECT id FROM metier ORDER BY id LIMIT 2').all().map((t) => t.id);
  const texte = (id) => m.db.prepare('SELECT description FROM metier WHERE id = ?').get(id).description;
  const avant1 = texte(t1);
  const cree = nom('lecteur');
  const jeton = { $numero: 'k' };
  const p = await proposer(m, [
    { table: 'mot_cle', cle: { id: jeton }, operation: 'inserer', apres: { id: jeton, libelle: cree } },
    poserCategorie(jeton, c1),
    { table: 'metier', cle: { id: t1 }, operation: 'modifier', avant: { description: avant1 }, apres: { description: `Il cite {{${normalize(cree)}}} ${process.pid}.` } },
  ]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.refus_de_l_application ?? refusees(m, p)));
  appliquer(m.db, p.id, {});
  const motCleCree = m.db.prepare('SELECT id, cle FROM v_mot_cle WHERE libelle = ?').get(cree);
  // cité depuis le lot par un texte que le lot ne remet pas : la suppression est refusée, avec le motif de R196, le lot reste appliqué
  const avant2 = texte(t2);
  enregistrer(m.db, { operations: [{ op: 'modifier', table: 'metier', cle: { id: t2 }, valeurs: { description: `Cité ensuite {{${motCleCree.cle}}} ${process.pid}.` } }] });
  const ecrit = texte(t2);
  const refus = (() => {
    try {
      annuler(m.db, p.id, {});
    } catch (e) {
      return e;
    }
    return null;
  })();
  assert.ok(refus instanceof ErreurEdition, 'refus attendu');
  assert.equal(refus.statut, 409);
  assert.match(refus.message, /mentionné/);
  assert.equal(lire(m.db, p.id).etat, 'applique');
  assert.equal(texte(t2), ecrit);
  // la citation retirée, l'annulation passe : le mot-clé part et le texte du lot revient
  enregistrer(m.db, { operations: [{ op: 'modifier', table: 'metier', cle: { id: t2 }, valeurs: { description: avant2 } }] });
  assert.equal(annuler(m.db, p.id, {}).etat, 'annule');
  assert.equal(motCle(m, motCleCree.id), undefined);
  assert.equal(texte(t1), avant1);
  clesJustes(m);
});

test('annuler une ligne d’un mot-clé créé et ancré emporte ses lignes, un reclassement R309 aussi ; deux homonymes l’un après l’autre ; l’ancre d’un mot-clé existant reste seule', async () => {
  const m = nouvelle();
  const { titre, sorts: [s1, s2] } = deuxSortsHomonymes(m, 'groupes');
  const [c1, c2, c3] = lesCategories(m);
  const reclasse = unMotCle(m, nom('reclasse'), [c1]);
  const existant = unMotCle(m, nom('existant'), [c2]);
  // un homonyme d'un autre type, hors du lot : sa clé prend son type avec le lot et revient quand le dernier mot-clé du lot repart
  const voisin = unMotCle(m, titre, [c2]);
  const cleDuVoisin = motCle(m, voisin).cle;
  const page = unePage(m, 'ancre existante');
  // des textes du lot : deux citent le voisin (annulés avant et après ses groupes), un cite un mot-clé reclassé, un est retouché par le site
  const libelleCite = nom('reclasse cite');
  const cite = unMotCle(m, libelleCite, [c1]);
  unMotCle(m, libelleCite, [c2]);
  const [tAvant, tApres, tCite, tSite, tPur] = m.db.prepare('SELECT id FROM metier ORDER BY id LIMIT 5').all().map((t) => t.id);
  const texte = (id) => m.db.prepare('SELECT description FROM metier WHERE id = ?').get(id).description;
  const cites = new Map([[tAvant, voisin], [tApres, voisin], [tCite, cite], [tSite, voisin]]);
  const textesDAvant = new Map();
  for (const [t, k] of cites) {
    enregistrer(m.db, { operations: [{ op: 'modifier', table: 'metier', cle: { id: t }, valeurs: { description: `Ancien texte {{${motCle(m, k).cle}}} ${process.pid}.` } }] });
    textesDAvant.set(t, texte(t));
  }
  // un texte hors des opérations du lot : seul le recalcul y réécrit la clé du voisin
  enregistrer(m.db, { operations: [{ op: 'modifier', table: 'metier', cle: { id: tPur }, valeurs: { description: `Cité seulement {{${cleDuVoisin}}} ${process.pid}.` } }] });
  const textePur = texte(tPur);
  const p = await proposer(m, [
    ...[...cites].map(([t, k]) => ({ table: 'metier', cle: { id: t }, operation: 'modifier', avant: { description: textesDAvant.get(t) }, apres: { description: `Nouveau texte {{${motCle(m, k).cle}}} ${process.pid}.` } })),
    creer('a', 'sort', s1.id, titre, s1.url, c1),
    creer('b', 'sort', s2.id, titre, s2.url, c1),
    retirerCategorie(reclasse, c1), poserCategorie(reclasse, c2),
    retirerCategorie(cite, c1), poserCategorie(cite, c3),
    ancrer('page', page.id, existant),
  ]);
  assert.equal(p.verdict, 'applicable', JSON.stringify(lire(m.db, p.id).essai.refus_de_l_application ?? refusees(m, p)));
  const fait = appliquer(m.db, p.id, {});
  enregistrer(m.db, { operations: [{ op: 'modifier', table: 'metier', cle: { id: tSite }, valeurs: { description: `Retouché par le site {{${motCle(m, voisin).cle}}} ${process.pid}.` } }] });
  const [a, b] = [ancreDe(m, 'sort', s1.id), ancreDe(m, 'sort', s2.id)];
  const cleDeB = motCle(m, b).cle;
  const rang = (table, cle) => rangDe(m, fait.lot_id, table, cle);
  const quittees = (k) => m.db.prepare("SELECT rang, apres FROM modification WHERE lot_id = ? AND table_nom = 'mot_cle_ancienne_cle' AND operation = 'inserer' ORDER BY rang").all(fait.lot_id)
    .filter((l) => JSON.parse(l.apres).mot_cle_id === k).map((l) => l.rang);
  const groupeDe = (k, s) => croissant([rang('mot_cle', { id: k }), rang('mot_cle_categorie', { mot_cle_id: k, categorie_id: c1 }), rang('sort', { id: s }), ...quittees(k)]);
  const [groupeA, groupeB] = [groupeDe(a, s1.id), groupeDe(b, s2.id)];
  const ligne = (numero) => lire(m.db, p.id).lignes.find((l) => l.n === numero);
  for (const numero of [...groupeA, ...groupeB]) assert.equal(ligne(numero).annulable_seule, true, `ligne ${numero} : ${ligne(numero).motif}`);
  let notees = [];
  const annulerEtNoter = (numero, emportees) => {
    notees = croissant([...notees, ...emportees]);
    const lotPresente = annulerUneLigne(m.db, p.id, numero);
    assert.deepEqual(lignesNotees(lotPresente), notees);
    return lotPresente;
  };

  // une ligne que le recalcul seul a réécrite n'a rien à remettre : la page ne propose pas de l'annuler
  const nPur = rang('metier', { id: tPur });
  assert.notEqual(texte(tPur), textePur);
  assert.equal(ligne(nPur).etat, 'en_place', ligne(nPur).motif);
  assert.equal(ligne(nPur).annulable_seule, false);
  assert.match(ligne(nPur).motif, /Seule la clé/);

  // un texte du lot, avant ses groupes : la clé d'avant du voisin est devenue ambiguë, il s'écrit avec sa clé du moment
  const nAvant = rang('metier', { id: tAvant });
  assert.equal(ligne(nAvant).annulable_seule, true, ligne(nAvant).motif);
  annulerEtNoter(nAvant, [nAvant]);
  assert.equal(texte(tAvant), textesDAvant.get(tAvant).replace(cleDuVoisin, motCle(m, voisin).cle));

  // l'aperçu, depuis la catégorie : toutes les lignes emportées, rien d'écrit
  const clic = rang('mot_cle_categorie', { mot_cle_id: a, categorie_id: c1 });
  const vu = await previsualiserLAnnulation(() => m.db, p.id, { enArrierePlan: false, dossier: m.dossier, ligne: clic });
  assert.equal(vu.verdict, 'applicable', JSON.stringify(vu.refus_de_l_annulation ?? vu.operations.filter((o) => o.etat === 'refusee')));
  assert.equal(vu.ligne, clic);
  assert.deepEqual(croissant(vu.operations.map((o) => o.rang_du_lot)), groupeA);
  assert.equal(ancreDe(m, 'sort', s1.id), a);

  // le groupe du premier : le second reste, sa clé recalculée ne le fait pas passer pour « changé depuis »
  annulerEtNoter(rang('sort', { id: s1.id }), groupeA);
  assert.equal(motCle(m, a), undefined);
  assert.equal(ancreDe(m, 'sort', s1.id), null);
  assert.notEqual(motCle(m, b).cle, cleDeB, 'sans son homonyme de même type, il perd le parent de sa clé');
  clesJustes(m);
  assert.equal(ligne(rang('mot_cle', { id: b })).etat, 'en_place');
  assert.equal(ligne(rang('mot_cle', { id: b })).annulable_seule, true, ligne(rang('mot_cle', { id: b })).motif);

  // le groupe du second, depuis sa ligne de mot-clé
  annulerEtNoter(rang('mot_cle', { id: b }), groupeB);
  assert.equal(motCle(m, b), undefined);
  assert.equal(ancreDe(m, 'sort', s2.id), null);
  assert.deepEqual(categoriesDe(m, b), []);
  assert.equal(motCle(m, voisin).cle, cleDuVoisin, 'la clé du voisin est revenue');
  clesJustes(m);

  // l'autre ordre : après ses groupes, le texte du lot reste en place, sa balise réécrite n'est pas un changement du site ; les deux ordres donnent le même texte
  assert.equal(texte(tAvant), textesDAvant.get(tAvant));
  assert.equal(texte(tPur), textePur, 'le recalcul a ramené le texte qu’il avait réécrit');
  assert.equal(ligne(nPur).etat, 'comme_avant', 'la clé revenue, la ligne vaut son texte d’avant');
  const nApres = rang('metier', { id: tApres });
  assert.equal(ligne(nApres).etat, 'en_place', ligne(nApres).motif);
  assert.equal(ligne(nApres).annulable_seule, true, ligne(nApres).motif);
  annulerEtNoter(nApres, [nApres]);
  assert.equal(texte(tApres), textesDAvant.get(tApres));

  // le reclassement R309 : ses deux lignes ensemble
  const reclassement = croissant([rang('mot_cle_categorie', { mot_cle_id: reclasse, categorie_id: c1 }), rang('mot_cle_categorie', { mot_cle_id: reclasse, categorie_id: c2 })]);
  annulerEtNoter(reclassement[1], reclassement);
  assert.deepEqual(categoriesDe(m, reclasse), [c1]);
  clesJustes(m);

  // le reclassement d'un mot-clé qu'un texte du lot cite : le texte reste en place et le lot appliqué, puis sa ligne remet le texte d'origine
  const reclassementCite = croissant([rang('mot_cle_categorie', { mot_cle_id: cite, categorie_id: c1 }), rang('mot_cle_categorie', { mot_cle_id: cite, categorie_id: c3 })]);
  assert.equal(annulerEtNoter(reclassementCite[0], reclassementCite).etat, 'applique');
  assert.deepEqual(categoriesDe(m, cite), [c1]);
  const nCite = rang('metier', { id: tCite });
  assert.match(texte(tCite), /^Nouveau texte/);
  assert.equal(ligne(nCite).etat, 'en_place', ligne(nCite).motif);
  assert.equal(ligne(nCite).annulable_seule, true, ligne(nCite).motif);
  annulerEtNoter(nCite, [nCite]);
  assert.equal(texte(tCite), textesDAvant.get(tCite));
  clesJustes(m);

  // un texte vraiment changé par le site reste gardé
  const nSite = rang('metier', { id: tSite });
  assert.equal(ligne(nSite).etat, 'modifiee_depuis');
  assert.equal(ligne(nSite).annulable_seule, false);

  // l'ancre d'un mot-clé existant : seule, et le lot n'a plus rien en place
  const fin = annulerEtNoter(rang('page', { id: page.id }), [rang('page', { id: page.id })]);  assert.equal(ancreDe(m, 'page', page.id), null);
  assert.ok(motCle(m, existant));
  // le repère que l'ancre lui avait pris revient tel qu'il était, sous son nom d'avant (pas refait du titre de la page : décision B3-4)
  assert.equal(motCle(m, existant).element.table, 'repere');
  assert.equal(motCle(m, existant).libelle, nom('existant'));
  assert.equal(fin.etat, 'annule');
  assert.match(texte(tSite), /^Retouché par le site/);
  clesJustes(m);
});
