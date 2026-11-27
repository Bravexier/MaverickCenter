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
import { categorieDuType, estAncre } from '../src/lib/mots-cles-ancrage.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { formesNonCanoniques, lireBalises, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase, pagesDesLiens, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { lotHorsRoute } from './aide-mot-cle-nu.mjs';
import { idDEssai, MOTS_CLES_D_ESSAI, reglesAvecDesMotsClesDEssai } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('edition-mots-cles-cles');
const regles = reglesAvecDesMotsClesDEssai(join(racine, 'regles'));
let compteur = 0;
/** Une base vivante neuve (chaque test a la sienne) et ses outils. */
function base() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: regles.base, dossier: join(racine, `b${(compteur += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
  // par la route du Glossaire : tout ce qui n'est pas la création d'un mot-clé d'essai
  const lot = (operations) => appel('POST', '/api/edition/', { page: 'regles/glossaire/', operations });
  // hors route : un mot-clé d'essai y naît nu, comme avant les pages de notion (par une route, il naîtrait avec sa page et ne se modifierait plus au Glossaire :
  // aide-mot-cle-nu.mjs) ; un refus lu ici est celui de la règle des clés du service, pas celui du site
  const nu = (operations) => lotHorsRoute(db, operations, 'regles/glossaire/');
  const ligne = (sql, ...p) => db.prepare(sql).get(...p);
  return { db, appel, lot, nu, ligne, motCle: (id) => ligne('SELECT * FROM mot_cle WHERE id = ?', id) };
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

test('R232 (9), (2), (3) : le service refuse un homonyme créé sans catégorie distinctive (hors route ; par le site : un homonyme avec une catégorie que A n’a pas) ; accepté, il porte ses catégories et la clé de l’autre suit, réécrite partout', () => {
  const { db, lot, nu, motCle, ligne } = base();
  const [c1, c2] = deuxCategories(db);
  // un texte qui cite A par sa clé (la définition de C)
  ok(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: C.id }, valeurs: { description: `Voir {{${A.cle}}}.` } }]));
  assert.match(motCle(C.id).description, new RegExp(`\\{\\{${A.cle}\\|`));
  // un homonyme sans catégorie (la route en donne toujours une : hors route seulement), puis par le site avec une catégorie alors que A n'en a aucune :
  // refusés (409, champ categories), rien d'écrit
  refuse(nu([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle.toUpperCase() } }]), 409, null);
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c2] } }]), 409, 'categories');
  assert.equal(motCle(A.id).cle, A.cle);
  // A reçoit une catégorie, l'homonyme d'essai une autre : accepté dans un même lot
  const r = nu([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [c1] }, { op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c2] } }]);
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
  const r2 = nu([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: `${A.libelle} bis zq` } }]);
  ok(r2);
  assert.ok(r2.corps.crees[0].id > homonyme);
});

test('R232 (9), (10) : le service refuse des catégories incluses (hors route : le site ne donne qu’un type) ; une clé déjà prise est refusée par le site (champ libelle)', () => {
  const { db, lot, nu, motCle } = base();
  const [c1, c2] = deuxCategories(db);
  ok(lot([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [c1] }]));
  refuse(nu([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c1, c2] } }]), 409, 'categories');
  ok(nu([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c2] } }]));
  const prise = motCle(A.id).cle;
  // un libellé dont le slug est la clé d'un homonyme : refusé par le site, à la création comme au renommage ; le premier garde sa clé
  const libelleQuiPrend = prise.split('-').join(' ');
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: libelleQuiPrend, categories: [c1] } }]), 409, 'libelle');
  refuse(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: C.id }, valeurs: { libelle: libelleQuiPrend } }]), 409, 'libelle');
  assert.equal(motCle(A.id).cle, prise);
  verifierLaBase(db);
});

test('R232 (5) : une catégorie renommée recalcule la clé des homonymes qui la portent et réécrit leurs balises ; ajout, doublon, suppression d’une catégorie vide seulement', () => {
  const { db, lot, nu, motCle, ligne } = base();
  const [c1, c2] = deuxCategories(db);
  ok(lot([{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle: 'Essai catégorie zq' } }]));
  const nouvelle = ligne("SELECT id FROM categorie_mot_cle WHERE libelle = 'Essai catégorie zq'").id;
  assert.ok(nouvelle > Math.max(c1, c2));
  refuse(lot([{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle: 'essai categorie ZQ' } }]), 409, 'libelle');
  ok(nu([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [nouvelle] }, { op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [c1] } }]));
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
  const { db, lot, nu, motCle } = base();
  const [c1, c2] = deuxCategories(db);
  // un mot-clé verrouillé sans homonyme, cité par une balise quelque part (choisi dans la base). Le site de dev, source de ce qu'il modifie, a pu poser
  // des catégories à tous les verrouillés (2026-11) : le test retire alors, dans sa copie, celles du premier qui convient (skill tests-conventions :
  // un test remet ce dont il a besoin). Sans élément : le libellé d'un mot-clé relié à un élément suit cet élément (R309)
  const convient = (m) => textesQuiCitent(db, m.cle).length && motsClesDeLaBase(db).filter((x) => normalize(x.libelle) === normalize(m.libelle)).length === 1;
  const verrouilleSansElement = (m) => m.verrou === 1 && !estAncre(db, m.id);
  if (!motsClesDeLaBase(db).some((m) => verrouilleSansElement(m) && !m.categories.length)) {
    const pris = motsClesDeLaBase(db).find((m) => verrouilleSansElement(m) && convient(m)) ?? motsClesDeLaBase(db).find(verrouilleSansElement);
    if (pris) db.prepare('DELETE FROM mot_cle_categorie WHERE mot_cle_id = ?').run(pris.id);
  }
  const verrouilles = motsClesDeLaBase(db).filter((m) => verrouilleSansElement(m) && !m.categories.length);
  const cible = verrouilles.find(convient) ?? verrouilles[0];
  assert.ok(cible, 'un mot-clé verrouillé sans catégorie');
  ok(lot([{ op: 'categories_mot_cle', mot_cle: cible.id, categories: [c1] }]));
  assert.deepEqual(motsClesDeLaBase(db).find((m) => m.id === cible.id).categories, [c1]);
  ok(nu([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: cible.libelle, categories: [c2] } }]));
  assert.notEqual(motCle(cible.id).cle, cible.cle, 'la clé du verrouillé a suivi');
  assert.equal(motCle(cible.id).verrou, 1);
  assert.deepEqual(textesQuiCitent(db, cible.cle), [], 'plus aucune balise ne cite la clé quittée');
  verifierLaBase(db);
  // son libellé et ses synonymes se modifient aussi (demande du propriétaire : seule sa suppression est bloquée), le verrou reste
  ok(lot([{ op: 'modifier', table: 'mot_cle', cle: { id: cible.id }, valeurs: { libelle: `${cible.libelle} zq` } }]));
  ok(lot([{ op: 'synonymes_mot_cle', mot_cle: cible.id, synonymes: ['Essai zq verrou'] }]));
  assert.equal(motCle(cible.id).verrou, 1);
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

test('R233 (4), (6) : un synonyme en conflit est refusé (libellé, synonyme, clé d’un autre mot-clé, son propre libellé) ; ceux d’un verrouillé se modifient (demande du propriétaire : seule sa suppression est bloquée)', () => {
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
  // par le site, un mot-clé créé a un type (sans lui, la catégorie Notion, absente de cette base)
  refuse(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: 'zq-synonyme', categories: [deuxCategories(db)[0]] } }]), 409, 'libelle');
  // ceux d'un mot-clé verrouillé, sans élément (R309) : modifiables, le verrou reste
  const verrouille = db.prepare('SELECT id FROM mot_cle WHERE verrou = 1 ORDER BY id').all().find((m) => !estAncre(db, m.id));
  ok(lot([{ op: 'synonymes_mot_cle', mot_cle: verrouille.id, synonymes: ['Zq synonyme verrouillé'] }]));
  assert.deepEqual(db.prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ?').all(verrouille.id).map((s) => s.libelle), ['Zq synonyme verrouillé']);
  assert.equal(motCle(verrouille.id).verrou, 1);
  verifierLaBase(db);
});

/** La catégorie « Notion » (retrouvée même renommée ; créée par le site si la base ne l'a pas encore) et une autre catégorie de la base, par id. */
function notionEtAutre(db, lot) {
  if (categorieDuType(db, 'Notion') === null) ok(lot([{ op: 'creer', entite: 'categorie_mot_cle', valeurs: { libelle: 'Notion' } }]));
  const notion = categorieDuType(db, 'Notion');
  assert.ok(Number.isInteger(notion), 'la base a la catégorie Notion');
  const autre = categoriesDesMotsCles(db).map((c) => c.id).find((id) => id !== notion);
  assert.ok(Number.isInteger(autre), 'et une autre catégorie');
  return { notion, autre };
}
const compter = (db, table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

test('R309 (8), R232 : par le site, une notion au nom d’un mot-clé existant d’un autre type, sans page de ce nom, est créée ; le type distingue les deux clés', () => {
  const { db, lot, motCle } = base();
  const { notion, autre } = notionEtAutre(db, lot);
  ok(lot([{ op: 'categories_mot_cle', mot_cle: A.id, categories: [autre] }]));
  assert.equal(db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(normalize(A.libelle)), undefined, 'aucune page ne porte ce nom');
  const r = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: A.libelle, categories: [notion] } }]);
  ok(r);
  const cree = r.corps.crees[0].id;
  const libelles = new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle]));
  assert.equal(motCle(A.id).cle, `${A.cle}-${normalize(libelles.get(autre))}`);
  assert.equal(motCle(cree).cle, `${A.cle}-${normalize(libelles.get(notion))}`);
  assert.ok(db.prepare('SELECT 1 FROM page WHERE mot_cle_id = ?').get(cree), 'la notion naît avec sa page');
  assert.equal(db.prepare('SELECT 1 FROM page WHERE mot_cle_id = ?').get(A.id), undefined, 'l’autre mot-clé reste sans page');
  verifierLaBase(db);
});

test('par le site, une notion dont le nom est déjà le titre d’une page est refusée (409) : ni mot-clé ni page', () => {
  const { db, lot } = base();
  const { notion } = notionEtAutre(db, lot);
  // une page dont le titre n'est le nom d'aucun mot-clé : le refus vient du titre, pas des homonymes. Sur un contenu ancré (R309), chaque page a son mot-clé
  // à son nom : une page du Codex d'essai, au nom inventé, posée dans cette copie
  const nomsDesMotsCles = new Set(motsClesDeLaBase(db).map((m) => normalize(m.libelle)));
  let titre = 'Zephyrion, page d’essai';
  for (let i = 2; nomsDesMotsCles.has(normalize(titre)) || db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(normalize(titre)); i += 1) titre = `Zephyrion, page d’essai ${i}`;
  const page = { id: `lore/${normalize(titre)}`, titre };
  db.prepare("INSERT INTO page (id, type, slug, titre, titre_cle, corps_md, statut, origine) VALUES (?, 'lore', ?, ?, ?, 'Texte.\n', 'draft', 'docs')")
    .run(page.id, normalize(titre), titre, normalize(titre));
  assert.ok(db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(normalize(page.titre)), 'une page de la base, trouvée par son titre');
  const [motsCles, pages] = [compter(db, 'mot_cle'), compter(db, 'page')];
  const r = lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: page.titre, categories: [notion] } }]);
  refuse(r, 409, null);
  assert.ok(r.corps.page, JSON.stringify(r.corps));
  assert.deepEqual([compter(db, 'mot_cle'), compter(db, 'page')], [motsCles, pages]);
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
