// Le vocabulaire des mots-clés au service du site de dev depuis les migrations 0113 à 0115 (serveur/edition-mots-cles.mjs) : la clé recalculée
// (décision R232 (2)) et réécrite dans les textes (R232 (3)), les homonymes et leurs refus (R232 (9), (10)), la clé d'un verrouillé qui suit et ses
// catégories posées (R232 (11)), les catégories (R232 (5) : ajout, renommage, suppression d'une catégorie vide), les synonymes (R233 : saisie sans
// égard à la casse, écriture de la base, unicité, verrou) et l'id d'un mot-clé créé (le suivant, jamais réutilisé). Sur une base vivante tirée de
// data/rows et des mots-clés d'essai (test/aide-mots-cles.mjs) ; les catégories et les mots-clés réels sont choisis par id ou par requête, jamais par
// leur texte.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { formesNonCanoniques, lireBalises, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase, pagesDesLiens, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { idDEssai, MOTS_CLES_D_ESSAI, reglesAvecDesMotsClesDEssai } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('edition-mots-cles-cles');
const regles = reglesAvecDesMotsClesDEssai(join(racine, 'regles'));
let compteur = 0;
/** Une base vivante neuve (chaque test a la sienne) et ses outils. */
function base() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: regles.base, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/glossaire/', operations });
  const ligne = (sql, ...p) => db.prepare(sql).get(...p);
  return { db, appel, lot, ligne, motCle: (id) => ligne('SELECT * FROM mot_cle WHERE id = ?', id) };
}
const ok = (r) => assert.equal(r.statut, 200, JSON.stringify(r.corps));
/** Le refus attendu : son statut et le champ que le détail nomme. */
function refuse(r, statut, champ) {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  if (champ) assert.equal(r.corps.champ, champ, JSON.stringify(r.corps));
}
/** Deux catégories distinctes de la base (par id). */
const deuxCategories = (db) => categoriesDesMotsCles(db).slice(0, 2).map((c) => c.id);
/** Les clés de la base sont celles de la règle (R232), et aucune balise ne cite autre chose qu'une clé courante (forme canonique). */
function verifierLaBase(db) {
  const motsCles = motsClesDeLaBase(db);
  const cles = clesDesMotsCles(motsCles, new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle])));
  for (const m of motsCles) assert.equal(m.cle, cles.get(m.id), `mot-clé ${m.id}`);
  const vocabulaire = vocabulaireDesMotsCles(motsCles);
  for (const { table, colonne, cle, markdown } of textesDeLaBase(db)) {
    for (const l of db.prepare(`SELECT ${cle.map((c) => (c === 'rowid' ? 'rowid' : `"${c}"`)).join(', ')}, "${colonne}" AS t FROM "${table}" WHERE instr("${colonne}", '{{') > 0`).all()) {
      assert.deepEqual(formesNonCanoniques(l.t, vocabulaire, { markdown }), [], `${table}.${colonne} ${JSON.stringify(l)}`);
    }
  }
}
/** Les textes de la base qui citent la clé `cle` par une balise. */
const textesQuiCitent = (db, cle) => textesDeLaBase(db).flatMap(({ table, colonne, markdown }) => db.prepare(`SELECT "${colonne}" AS t FROM "${table}" WHERE instr("${colonne}", '{{') > 0`).all()
  .filter((l) => lireBalises(l.t, { markdown }).some((b) => b.ref === cle)).map(() => `${table}.${colonne}`));

const A = MOTS_CLES_D_ESSAI['essai-glossaire-a'];
const C = MOTS_CLES_D_ESSAI['essai-glossaire-c'];

test('R232 (9), (2), (3) : un homonyme sans catégorie distinctive est refusé ; accepté, il porte ses catégories et la clé de l’autre suit, réécrite partout', () => {
  const { db, lot, motCle, ligne } = base();
  const [c1, c2] = deuxCategories(db);
  // un texte qui cite A par sa clé (la définition de C)
  ok(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: C.id }, valeurs: { description: `Voir {{${A.cle}}}.` } }]));
  assert.match(motCle(C.id).description, new RegExp(`\\{\\{${A.cle}\\|`));
  // un homonyme sans catégorie, puis avec une catégorie alors que A n'en a aucune : refusés (409, champ categories), rien d'écrit
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle.toUpperCase() } }]), 409, null);
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c2] } }]), 409, 'categories');
  assert.equal(motCle(A.id).cle, A.cle);
  // A reçoit une catégorie, l'homonyme une autre : accepté dans un même lot
  const r = lot([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [c1] }, { op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c2] } }]);
  ok(r);
  const homonyme = r.corps.crees[0].id;
  assert.ok(Number.isInteger(homonyme) && homonyme > Math.max(...Object.values(MOTS_CLES_D_ESSAI).map((m) => m.id)), 'l’id suivant');
  const libelles = new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle]));
  assert.equal(motCle(A.id).cle, `${A.cle}-${normalize(libelles.get(c1))}`);
  assert.equal(motCle(homonyme).cle, `${A.cle}-${normalize(libelles.get(c2))}`);
  // la clé quittée mène encore à A ; le texte qui citait A cite sa nouvelle clé, son texte écrit gardé
  assert.equal(ligne('SELECT mot_cle_id FROM mot_cle_ancienne_cle WHERE cle = ?', A.cle)?.mot_cle_id, A.id);
  assert.deepEqual(textesQuiCitent(db, A.cle), []);
  assert.ok(motCle(C.id).description.includes(`{{${motCle(A.id).cle}|`));
  // l'homonyme disparu, la clé de A redevient le slug seul, et sort de mot_cle_ancienne_cle
  ok(lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id: homonyme } }]));
  assert.equal(motCle(A.id).cle, A.cle);
  assert.equal(ligne('SELECT 1 FROM mot_cle_ancienne_cle WHERE cle = ?', A.cle), undefined);
  assert.ok(motCle(C.id).description.includes(`{{${A.cle}|`));
  verifierLaBase(db);
  // un id n'est jamais réutilisé
  const r2 = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: `${A.libelle} bis zq` } }]);
  ok(r2);
  assert.ok(r2.corps.crees[0].id > homonyme);
});

test('R232 (9), (10) : catégories incluses refusées ; une clé déjà prise refusée (champ libelle)', () => {
  const { db, lot, motCle } = base();
  const [c1, c2] = deuxCategories(db);
  ok(lot([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [c1] }]));
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c1, c2] } }]), 409, 'categories');
  ok(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c2] } }]));
  const prise = motCle(A.id).cle;
  // un libellé dont le slug est la clé d'un homonyme : refusé, le premier garde sa clé
  const libelleQuiPrend = prise.split('-').join(' ');
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libelleQuiPrend } }]), 409, 'libelle');
  refuse(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: C.id }, valeurs: { libelle: libelleQuiPrend } }]), 409, 'libelle');
  assert.equal(motCle(A.id).cle, prise);
  verifierLaBase(db);
});

test('R232 (5) : une catégorie renommée recalcule la clé des homonymes qui la portent et réécrit leurs balises ; ajout, doublon, suppression d’une catégorie vide seulement', () => {
  const { db, lot, motCle, ligne } = base();
  const [c1, c2] = deuxCategories(db);
  ok(lot([{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle: 'Essai catégorie zq' } }]));
  const nouvelle = ligne("SELECT id FROM categorie_mot_cle WHERE libelle = 'Essai catégorie zq'").id;
  assert.ok(nouvelle > Math.max(c1, c2));
  refuse(lot([{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle: 'essai categorie ZQ' } }]), 409, 'libelle');
  ok(lot([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [nouvelle] }, { op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c1] } }]));
  ok(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: C.id }, valeurs: { description: `Voir {{${motCle(A.id).cle}}}.` } }]));
  const avant = motCle(A.id).cle;
  // la catégorie non vide ne se supprime pas
  const refus = lot([{ op: 'supprimer', entite: 'categorie_mot_cle', cle: { id: nouvelle } }]);
  refuse(refus, 409, null);
  assert.deepEqual(refus.corps.mots_cles.map((m) => m.id), [A.id]);
  ok(lot([{ op: 'modifier', table: 'categorie_mot_cle', cle: { id: nouvelle }, valeurs: { libelle: 'Essai renommée zq' } }]));
  assert.equal(motCle(A.id).cle, `${A.cle}-essai-renommee-zq`);
  assert.deepEqual(textesQuiCitent(db, avant), []);
  assert.ok(motCle(C.id).description.includes(`{{${A.cle}-essai-renommee-zq|`));
  verifierLaBase(db);
  // retirée de A (qui reçoit une autre catégorie distinctive), elle est vide : elle se supprime
  ok(lot([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [c2] }]));
  ok(lot([{ op: 'supprimer', entite: 'categorie_mot_cle', cle: { id: nouvelle } }]));
  assert.equal(ligne('SELECT 1 FROM categorie_mot_cle WHERE id = ?', nouvelle), undefined);
  verifierLaBase(db);
});

test('R232 (11) : les catégories d’un mot-clé verrouillé se posent ; sa clé suit l’homonyme créé et les textes qui le citent sont réécrits', () => {
  const { db, lot, motCle } = base();
  const [c1, c2] = deuxCategories(db);
  // un mot-clé verrouillé sans homonyme, cité par une balise quelque part (choisi dans la base)
  const verrouilles = motsClesDeLaBase(db).filter((m) => m.verrou === 1 && !m.categories.length);
  const cible = verrouilles.find((m) => textesQuiCitent(db, m.cle).length && motsClesDeLaBase(db).filter((x) => normalize(x.libelle) === normalize(m.libelle)).length === 1)
    ?? verrouilles[0];
  assert.ok(cible, 'un mot-clé verrouillé sans catégorie');
  ok(lot([{ op: 'categories_mot_cle', mot_cle: cible.id, categories: [c1] }]));
  assert.deepEqual(motsClesDeLaBase(db).find((m) => m.id === cible.id).categories, [c1]);
  ok(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: cible.libelle, categories: [c2] } }]));
  assert.notEqual(motCle(cible.id).cle, cible.cle, 'la clé du verrouillé a suivi');
  assert.equal(motCle(cible.id).verrou, 1);
  assert.deepEqual(textesQuiCitent(db, cible.cle), [], 'plus aucune balise ne cite la clé quittée');
  verifierLaBase(db);
  // ce que le verrou protège reste refusé : son libellé, ses synonymes
  refuse(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: cible.id }, valeurs: { libelle: `${cible.libelle} zq` } }]), 409, null);
  refuse(lot([{ op: 'synonymes_mot_cle', mot_cle: cible.id, synonymes: ['Essai zq verrou'] }]), 409, 'synonymes');
});

test('R233 (10) : un synonyme ou un libellé se saisit sans égard à la casse, et le texte tapé est gardé tel quel (« Garder la casse tapée ») ; la clé montre le libellé', () => {
  const { db, lot, motCle } = base();
  ok(lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: ['Zq Essai', 'ZQE'] }]));
  ok(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: C.id }, valeurs: { description: `Un {{zq essai}}, un {{zqe}}, un {{ESSAI GLOSSAIRE A}}, un {{${A.cle}}}.` } }]));
  assert.equal(motCle(C.id).description, `Un {{${A.cle}|zq essai}}, un {{${A.cle}|zqe}}, un {{${A.cle}|ESSAI GLOSSAIRE A}}, un {{${A.cle}|${A.libelle}}}.`);
  // dans un texte mis en forme, la clé seule ou le libellé écrit à l'identique suivent le libellé ; un synonyme tapé garde sa casse
  const bloc = db.prepare('SELECT evenement_id, rang, texte FROM evenement_extrait ORDER BY evenement_id, rang LIMIT 1').get();
  ok(lot([{ op: 'modifier', table: 'evenement_extrait', cle: { evenement_id: bloc.evenement_id, rang: bloc.rang },
    valeurs: { texte: `${bloc.texte}\n\nEssai : {{${A.libelle}}}, {{${A.cle}}}, {{zQe}}.` } }]));
  const texte = db.prepare('SELECT texte FROM evenement_extrait WHERE evenement_id = ? AND rang = ?').get(bloc.evenement_id, bloc.rang).texte;
  assert.ok(texte.endsWith(`Essai : {{${A.cle}}}, {{${A.cle}}}, {{${A.cle}|zQe}}.`), texte.slice(-120));
});

test('R233 (4), (6) : un synonyme en conflit est refusé (libellé, synonyme, clé d’un autre mot-clé, son propre libellé) ; ceux d’un verrouillé ne se modifient pas', () => {
  const { db, lot, motCle } = base();
  const autreSynonyme = db.prepare('SELECT s.libelle, s.mot_cle_id FROM mot_cle_synonyme s ORDER BY s.id LIMIT 1').get();
  refuse(lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: [C.libelle.toLowerCase()] }]), 409, 'synonymes');
  refuse(lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: [autreSynonyme.libelle] }]), 409, 'synonymes');
  refuse(lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: [motCle(autreSynonyme.mot_cle_id).cle] }]), 409, 'synonymes');
  refuse(lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: [A.libelle.toUpperCase()] }]), 400, 'synonymes');
  refuse(lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: ['a|b'] }]), 400, 'synonymes');
  // un libellé renommé ou créé ne prend pas le synonyme d'un autre
  ok(lot([{ op: 'synonymes_mot_cle', mot_cle: A.id, synonymes: ['Zq synonyme'] }]));
  refuse(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: C.id }, valeurs: { libelle: 'ZQ Synonyme' } }]), 409, 'libelle');
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'zq-synonyme' } }]), 409, 'libelle');
  // ceux d'un mot-clé verrouillé (R233 (6))
  const verrouille = db.prepare('SELECT m.id FROM mot_cle m JOIN mot_cle_synonyme s ON s.mot_cle_id = m.id WHERE m.verrou = 1 LIMIT 1').get()
    ?? db.prepare('SELECT id FROM mot_cle WHERE verrou = 1 LIMIT 1').get();
  refuse(lot([{ op: 'synonymes_mot_cle', mot_cle: verrouille.id, synonymes: [] }]), 409, 'synonymes');
  verifierLaBase(db);
});

test('GET /api/edition/mots-cles/ : clé, synonymes, catégories, verrou et mentions de chaque mot-clé, et la liste des catégories', () => {
  const { db, appel } = base();
  const r = appel('GET', '/api/edition/mots-cles/');
  ok(r);
  assert.deepEqual(r.corps.categories.map((c) => c.id), categoriesDesMotsCles(db).map((c) => c.id));
  const parId = new Map(motsClesDeLaBase(db).map((m) => [m.id, m]));
  assert.equal(r.corps.motsCles.length, parId.size);
  for (const m of r.corps.motsCles) {
    const enBase = parId.get(m.id);
    assert.ok(Number.isInteger(m.id));
    assert.equal(m.cle, enBase.cle);
    assert.deepEqual(m.synonymes, enBase.synonymes);
    assert.deepEqual(m.categories, enBase.categories);
    assert.equal(m.verrou, enBase.verrou);
    assert.ok(Array.isArray(m.mentions));
    assert.ok(!('abreviation' in m) && !('libelle_cle' in m));
    // la page où mène son adresse (lib/mots-cles-db.mjs#pagesDesLiens) : null sans adresse
    const lien = pagesDesLiens(db, [enBase]).get(m.id) ?? null;
    assert.deepEqual([m.page_du_lien, m.titre_du_lien], [lien?.page ?? null, lien?.titre ?? null], String(m.id));
  }
  assert.ok(r.corps.motsCles.some((m) => m.page_du_lien && m.titre_du_lien), 'un mot-clé mène à une page de la base');
  // une mention dans la définition d'un autre mot-clé : nommée par le libellé de ce mot-clé (son id est un entier)
  const cite = r.corps.motsCles.flatMap((m) => m.mentions).find((x) => x.table === 'mot_cle');
  if (cite) assert.equal(cite.libelle, `Mot-clé « ${parId.get(cite.cle.id).libelle} »`);
});
