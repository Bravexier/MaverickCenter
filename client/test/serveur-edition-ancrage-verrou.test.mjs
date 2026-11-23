// Le verrou d'un mot-clé ancré (décision R309, docs/chantier-ancrage-mots-cles.md, §7 ; serveur/edition-ancrage.mjs#refusDuVerrou) : relié à un élément, il ne se modifie
// plus à la main. Une ligne par case du tableau de la tâche 8 : route du site, lot, annulation et rejeu. Aucun refus ne cite de numéro de décision (un refus qui en cite un
// devient un verrou que le mot de passe ouvre : edition-lots.mjs#ecrireLesOperations). Noms inventés, sur la petite base de test/aide-ancrage.mjs.
//   node --test test/serveur-edition-ancrage-verrou.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { ErreurEdition, enregistrer, OUTILS_DE_RESOLUTION, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte, nouveauLot, ouvrirLot } from '../serveur/edition-journal.mjs';
import { annuler, annulerUneLigne, appliquer, decisionsCitees, deposer, deposerEtAppliquer, lire, previsualiserLAnnulation } from '../serveur/edition-lots.mjs';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { ICONES } from '../src/lib/icones.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDAncrage, idDeCategorie, poserMagie, poserMotCle, poserPage, poserSort, recalculerLesCles } from './aide-ancrage.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('ancrage-verrou');
let n = 0;
const nom = (suffixe) => `Zephyrion ${suffixe} ${process.pid}`;
const TOUS_LES_VERROUS = ['R218', 'R219', 'R232', 'R233', 'R309'];

/** La petite base, en fichier : une page, son mot-clé ancré, deux mots-clés sans élément. `plus` y pose ce que le test demande. */
function monde(plus = () => ({})) {
  const memoire = baseDAncrage();
  const page = poserPage(memoire, 'guide/zephyrion-page', nom('page'));
  const ancre = poserMotCle(memoire, { libelle: nom('page'), url: adresseDeLaPage(page), categories: ['Don'] });
  memoire.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(ancre, page);
  const libre = poserMotCle(memoire, { libelle: nom('libre'), categories: ['Règles'] });
  const autre = poserMotCle(memoire, { libelle: nom('autre'), categories: ['Combat'] });
  const ajout = plus(memoire, { page, ancre, libre, autre });
  recalculerLesCles(memoire);
  const c = { don: idDeCategorie(memoire, 'Don'), regles: idDeCategorie(memoire, 'Règles'), combat: idDeCategorie(memoire, 'Combat'), race: idDeCategorie(memoire, 'Race') };
  const dossier = join(racine, `b${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  memoire.exec(`VACUUM INTO '${chemin.replaceAll("'", "''")}'`);
  memoire.close();
  const db = ouvrirBaseVivante(chemin);
  return { db, base: () => db, dossier: join(racine, `essais${n}`), page, ancre, libre, autre, c, ...ajout };
}

let modele = null;
/** Une copie de la base d'import, prête pour le service (préparée une fois : la copier coûte moins que la refaire). */
function reelle() {
  modele ??= preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, 'modele') }).chemin;
  const dossier = join(racine, `r${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  copyFileSync(modele, chemin);
  return { db: ouvrirBaseVivante(chemin) };
}

const lot = (operations) => ({ format: FORMAT_DU_LOT, titre: `Verrou d’essai ${(n += 1)}`, nature: 'decision', decision: 'R309', operations });
const proposer = (m, operations) => deposer(m.base, lot(operations), { enArrierePlan: false, dossier: m.dossier, controle: { ouvertHorsEdition: true } });
const deposerDirect = (m, operations, plus = {}, par = 'cle_de_depot') => deposerEtAppliquer(m.base, { ...lot(operations), ...plus }, { par, enArrierePlan: false, dossier: m.dossier, controle: { ouvertHorsEdition: true } });
const route = (m, operations) => enregistrer(m.db, { page: 'essai/', operations });
const motCle = (m, id) => ({ ...m.db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id) });
const categoriesDe = (m, id) => m.db.prepare('SELECT categorie_id AS c FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY c').all(id).map((l) => l.c);
const synonymesDe = (m, id) => m.db.prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ? ORDER BY ordre').all(id).map((l) => l.libelle);
const refusees = (m, p) => lire(m.db, p.id).essai.operations.filter((o) => o.etat === 'refusee');

const modifier = (m, id, apres) => {
  const ligne = motCle(m, id);
  return { table: 'mot_cle', cle: { id }, operation: 'modifier', avant: Object.fromEntries(Object.keys(apres).map((c) => [c, ligne[c] ?? null])), apres };
};
const retirerCategorie = (id, c) => ({ table: 'mot_cle_categorie', cle: { mot_cle_id: id, categorie_id: c }, operation: 'supprimer', avant: { mot_cle_id: id, categorie_id: c } });
const poserCategorie = (id, c) => ({ table: 'mot_cle_categorie', cle: { mot_cle_id: id, categorie_id: c }, operation: 'inserer', apres: { mot_cle_id: id, categorie_id: c } });
const supprimerLeMotCle = (m, id) => ({ table: 'mot_cle', cle: { id }, operation: 'supprimer', avant: motCle(m, id) });
const synonymeDuLot = (id, libelle) => ({
  table: 'mot_cle_synonyme', cle: { id: { $numero: 's' } }, operation: 'inserer', apres: { id: { $numero: 's' }, mot_cle_id: id, libelle, libelle_cle: normalize(libelle), ordre: 0 },
});

const refusDe = (faire) => {
  try {
    faire();
  } catch (e) {
    assert.ok(e instanceof ErreurEdition, String(e));
    return e;
  }
  return assert.fail('refus attendu');
};
/** Un refus 409 qui ne cite aucun numéro de décision. */
const refusSansNumero = (faire) => {
  const e = refusDe(faire);
  assert.equal(e.statut, 409, e.message);
  assert.deepEqual(decisionsCitees(e.message), [], e.message);
  return e;
};

/** Chaque clé de la base est celle que la règle donne (R232). */
function clesJustes(m) {
  const vocabulaire = motsClesDeLaBase(m.db);
  const attendues = clesDesMotsCles(vocabulaire, new Map(categoriesDesMotsCles(m.db).map((c) => [c.id, c.libelle])));
  for (const x of vocabulaire) assert.equal(x.cle, attendues.get(x.id), `clé du mot-clé ${x.id}`);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La route du site
// ---------------------------------------------------------------------------------------------------------------------------------------------

for (const [colonne, valeur] of [['libelle', nom('renommé')], ['url', '/races/'], ['description', 'Une définition.'], ['couleur', '#112233'], ['icone', ICONES[0].valeur]]) {
  test(`R309, route : « ${colonne} » d’un mot-clé ancré est refusé, sans écriture`, () => {
    const m = monde();
    const avant = motCle(m, m.ancre);
    refusSansNumero(() => route(m, [{ op: 'modifier', table: 'mot_cle', cle: { id: m.ancre }, valeurs: { [colonne]: valeur } }]));
    assert.deepEqual(motCle(m, m.ancre), avant);
    m.db.close();
  });
}

test('R309, route : le type et les synonymes d’un mot-clé ancré sont refusés', () => {
  const m = monde();
  refusSansNumero(() => route(m, [{ op: 'categories_mot_cle', mot_cle: m.ancre, categories: [m.c.race] }]));
  refusSansNumero(() => route(m, [{ op: 'synonymes_mot_cle', mot_cle: m.ancre, synonymes: [nom('synonyme')] }]));
  assert.deepEqual(categoriesDe(m, m.ancre), [m.c.don]);
  assert.deepEqual(synonymesDe(m, m.ancre), []);
  m.db.close();
});

test('R309, route : renvoyer les valeurs en place n’est pas un geste, rien n’est refusé', () => {
  const m = monde();
  const { libelle, url } = motCle(m, m.ancre);
  route(m, [{ op: 'modifier', table: 'mot_cle', cle: { id: m.ancre }, valeurs: { libelle, url } }, { op: 'modifier', table: 'mot_cle', cle: { id: m.libre }, valeurs: { description: 'Essai.' } }]);
  assert.equal(motCle(m, m.ancre).libelle, libelle);
  m.db.close();
});

test('R309, route : un mot-clé ancré ne se supprime pas, même en forçant', () => {
  const m = monde();
  refusSansNumero(() => route(m, [{ op: 'supprimer', entite: 'mot_cle', cle: { id: m.ancre } }]));
  refusSansNumero(() => route(m, [{ op: 'supprimer', entite: 'mot_cle', cle: { id: m.ancre }, forcer: true }]));
  assert.equal(motCle(m, m.ancre).id, m.ancre);
  m.db.close();
});

test('R309, route : un mot-clé ancré ne se fond pas dans un autre, le refus passe avant le report de son ancre', () => {
  const m = monde();
  refusSansNumero(() => route(m, [{ op: 'fusionner_mots_cles', mot_cle: m.ancre, dans: m.libre }]));
  assert.equal(m.db.prepare('SELECT mot_cle_id AS a FROM page WHERE id = ?').get(m.page).a, m.ancre, 'l’ancre reste');
  assert.equal(motCle(m, m.ancre).id, m.ancre);
  m.db.close();
});

test('R309, route : une cible ancrée reçoit la clé de la source et rien d’autre (R219 (4))', () => {
  const m = monde();
  const avant = motCle(m, m.ancre);
  const source = motCle(m, m.libre);
  m.db.prepare('UPDATE mot_cle SET couleur = ?, icone = ? WHERE id = ?').run('#445566', ICONES[0].valeur, m.libre);
  route(m, [{ op: 'fusionner_mots_cles', mot_cle: m.libre, dans: m.ancre }]);
  assert.deepEqual(motCle(m, m.ancre), avant, 'ni couleur, ni icône, ni adresse');
  assert.equal(m.db.prepare('SELECT mot_cle_id AS id FROM mot_cle_ancienne_cle WHERE cle = ?').get(source.cle)?.id, m.ancre, 'la clé de la source mène à la cible');
  assert.equal(m.db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(m.libre), undefined);
  m.db.close();
});

test('R309, route : une source à synonymes ne se fond pas dans une cible ancrée, sans numéro de décision', () => {
  const m = monde();
  route(m, [{ op: 'synonymes_mot_cle', mot_cle: m.libre, synonymes: [nom('à transmettre')] }]);
  const e = refusSansNumero(() => route(m, [{ op: 'fusionner_mots_cles', mot_cle: m.libre, dans: m.ancre }]));
  assert.equal(e.details?.champ, 'synonymes');
  assert.equal(motCle(m, m.libre).id, m.libre);
  m.db.close();
});

test('R309, route : une seconde catégorie est refusée, ancré ou non ; changer de catégorie reste permis', () => {
  const m = monde();
  const e = refusSansNumero(() => route(m, [{ op: 'categories_mot_cle', mot_cle: m.libre, categories: [m.c.regles, m.c.combat] }]));
  assert.equal(e.details?.champ, 'categories');
  assert.deepEqual(categoriesDe(m, m.libre), [m.c.regles]);
  route(m, [{ op: 'categories_mot_cle', mot_cle: m.libre, categories: [m.c.combat] }]);
  assert.deepEqual(categoriesDe(m, m.libre), [m.c.combat]);
  m.db.close();
});

test('R309, route : retirer une catégorie à un ancien mot-clé qui en garde plusieurs reste permis', () => {
  const m = monde((db) => ({ ancien: poserMotCle(db, { libelle: nom('ancien'), categories: ['Règles', 'Combat', 'Race'] }) }));
  route(m, [{ op: 'categories_mot_cle', mot_cle: m.ancien, categories: [m.c.regles, m.c.combat] }]);
  assert.deepEqual(categoriesDe(m, m.ancien), [m.c.regles, m.c.combat].sort((a, b) => a - b));
  const e = refusSansNumero(() => route(m, [{ op: 'categories_mot_cle', mot_cle: m.ancien, categories: [m.c.regles, m.c.race] }]));
  assert.equal(e.details?.champ, 'categories', 'il en ajoute une et en laisse plusieurs');
  m.db.close();
});

test('R309, route : une création à deux catégories est refusée', () => {
  const m = monde();
  const e = refusSansNumero(() => route(m, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: nom('neuf'), categories: [m.c.regles, m.c.combat] } }]));
  assert.equal(e.details?.champ, 'categories');
  m.db.close();
});

test('un mot-clé sans élément garde tous ses gestes', () => {
  const m = monde();
  const libelle = nom('renommé');
  route(m, [{ op: 'modifier', table: 'mot_cle', cle: { id: m.libre }, valeurs: { libelle, description: 'Écrite.', couleur: '#112233', icone: ICONES[0].valeur } }]);
  route(m, [{ op: 'categories_mot_cle', mot_cle: m.libre, categories: [m.c.combat] }]);
  route(m, [{ op: 'synonymes_mot_cle', mot_cle: m.libre, synonymes: [nom('synonyme')] }]);
  assert.equal(motCle(m, m.libre).libelle, libelle);
  route(m, [{ op: 'fusionner_mots_cles', mot_cle: m.libre, dans: m.autre }]);
  assert.equal(m.db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(m.libre), undefined);
  route(m, [{ op: 'supprimer', entite: 'mot_cle', cle: { id: m.autre } }]);
  assert.equal(m.db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(m.autre), undefined);
  m.db.close();
});

test('R309 : forcer la suppression d’un mot-clé sans élément réécrit la définition d’un ancré qui le cite', () => {
  const m = monde();
  const { cle } = motCle(m, m.libre);
  m.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(`Voir {{${cle}}}.`, m.ancre);
  route(m, [{ op: 'supprimer', entite: 'mot_cle', cle: { id: m.libre }, forcer: true }]);
  assert.equal(m.db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(m.libre), undefined);
  assert.ok(!motCle(m, m.ancre).description.includes('{{'), 'sa balise est devenue du texte');
  m.db.close();
});

test('R309 : fusionner un mot-clé sans élément recible la balise de la définition d’un ancré', () => {
  const m = monde();
  const { cle } = motCle(m, m.libre);
  m.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(`Voir {{${cle}}}.`, m.ancre);
  route(m, [{ op: 'fusionner_mots_cles', mot_cle: m.libre, dans: m.autre }]);
  assert.ok(motCle(m, m.ancre).description.includes(motCle(m, m.autre).cle));
  m.db.close();
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Par un lot
// ---------------------------------------------------------------------------------------------------------------------------------------------

for (const [colonne, valeur] of [['libelle', nom('renommé')], ['url', '/races/'], ['cle', 'zephyrion-autre-cle']]) {
  test(`R309, lot : « ${colonne} » d’un mot-clé ancré est refusé`, async () => {
    const m = monde();
    const p = await proposer(m, [modifier(m, m.ancre, { [colonne]: valeur })]);
    assert.equal(p.verdict, 'a_corriger');
    const [r] = refusees(m, p);
    assert.deepEqual(decisionsCitees(r.message), [], r.message);
    assert.deepEqual(lire(m.db, p.id).essai.verrous_a_ouvrir, []);
    m.db.close();
  });
}

test('le refus d’un lot sur le nom ne cite aucun numéro de décision', async () => {
  const m = monde();
  const e = await deposerDirect(m, [modifier(m, m.ancre, { libelle: nom('renommé') })]).then(() => assert.fail('refus attendu'), (x) => x);
  assert.ok(e instanceof ErreurEdition);
  assert.equal(e.statut, 409);
  assert.deepEqual(decisionsCitees(e.message), []);
  m.db.close();
});

test('un libellé qui s’écrit comme un numéro de décision n’ouvre pas le refus', async () => {
  const m = monde();
  m.db.prepare('UPDATE mot_cle SET libelle = ? WHERE id = ?').run('R218', m.ancre);
  const p = await proposer(m, [modifier(m, m.ancre, { url: '/races/' })]);
  const [r] = refusees(m, p);
  assert.deepEqual(decisionsCitees(r.message), [], r.message);
  m.db.close();
});

test('le mot de passe n’ouvre pas ce refus (verrous_ouverts sans effet)', async () => {
  const m = monde();
  const avant = motCle(m, m.ancre);
  for (const apres of [{ libelle: nom('renommé') }, { url: '/races/' }, { cle: 'zephyrion-autre-cle' }]) {
    const p = await proposer(m, [modifier(m, m.ancre, apres)]);
    assert.throws(() => appliquer(m.db, p.id, { verrous_ouverts: TOUS_LES_VERROUS }), (e) => e instanceof ErreurEdition && e.statut === 409);
    await assert.rejects(deposerDirect(m, [modifier(m, m.ancre, apres)], { verrous_ouverts: TOUS_LES_VERROUS }, 'mot_de_passe'), (e) => e instanceof ErreurEdition && e.statut === 409);
  }
  assert.deepEqual(motCle(m, m.ancre), avant);
  m.db.close();
});

test('R309, lot : un mot-clé ancré ne se supprime pas, mot de passe compris', async () => {
  const m = monde();
  const p = await proposer(m, [supprimerLeMotCle(m, m.ancre)]);
  assert.equal(p.verdict, 'a_corriger');
  assert.deepEqual(decisionsCitees(refusees(m, p)[0].message), []);
  assert.throws(() => appliquer(m.db, p.id, { verrous_ouverts: TOUS_LES_VERROUS }), (e) => e instanceof ErreurEdition && e.statut === 409);
  assert.equal(motCle(m, m.ancre).id, m.ancre);
  m.db.close();
});

test('R309, lot : couleur, icône et définition d’un mot-clé ancré se corrigent (décision 17)', async () => {
  const m = monde();
  await deposerDirect(m, [modifier(m, m.ancre, { couleur: '#112233', icone: ICONES[0].valeur, description: 'Corrigée.' })]);
  const l = motCle(m, m.ancre);
  assert.deepEqual([l.couleur, l.icone, l.description], ['#112233', ICONES[0].valeur, 'Corrigée.']);
  m.db.close();
});

test('R309, lot : le synonyme d’un mot-clé ancré se corrige (décision 17)', async () => {
  const m = monde();
  const libelle = nom('synonyme');
  await deposerDirect(m, [synonymeDuLot(m.ancre, libelle)]);
  assert.deepEqual(synonymesDe(m, m.ancre), [libelle]);
  m.db.close();
});

test('R309, lot : le type d’un mot-clé ancré se corrige (retirer A, poser B)', async () => {
  const m = monde();
  await deposerDirect(m, [poserCategorie(m.ancre, m.c.race), retirerCategorie(m.ancre, m.c.don)]);
  assert.deepEqual(categoriesDe(m, m.ancre), [m.c.race]);
  clesJustes(m);
  m.db.close();
});

test('R309, lot : une seconde catégorie est refusée, ancré ou non, mot de passe compris', async () => {
  const m = monde();
  for (const id of [m.ancre, m.libre]) {
    const c = categoriesDe(m, id)[0] === m.c.race ? m.c.combat : m.c.race;
    const p = await proposer(m, [poserCategorie(id, c)]);
    assert.equal(p.verdict, 'a_corriger', `mot-clé ${id}`);
    assert.deepEqual(decisionsCitees(refusees(m, p)[0].message), []);
    assert.throws(() => appliquer(m.db, p.id, { verrous_ouverts: TOUS_LES_VERROUS }), (e) => e instanceof ErreurEdition && e.statut === 409);
    assert.equal(categoriesDe(m, id).length, 1);
  }
  m.db.close();
});

test('R309, lot : seul l’état de fin compte (« ajouter B » puis « retirer A », dans les deux ordres)', async () => {
  const m = monde();
  await deposerDirect(m, [poserCategorie(m.libre, m.c.race), retirerCategorie(m.libre, m.c.regles)]);
  assert.deepEqual(categoriesDe(m, m.libre), [m.c.race]);
  await deposerDirect(m, [retirerCategorie(m.autre, m.c.combat), poserCategorie(m.autre, m.c.race)]);
  assert.deepEqual(categoriesDe(m, m.autre), [m.c.race]);
  m.db.close();
});

test('R309, lot : retirer une catégorie à un ancien mot-clé qui en garde plusieurs passe ; en ajouter une sans revenir à une seule est refusé', async () => {
  const m = monde((db) => ({ ancien: poserMotCle(db, { libelle: nom('ancien'), categories: ['Règles', 'Combat', 'Race'] }) }));
  await deposerDirect(m, [retirerCategorie(m.ancien, m.c.race)]);
  assert.equal(categoriesDe(m, m.ancien).length, 2);
  const p = await proposer(m, [poserCategorie(m.ancien, m.c.don), retirerCategorie(m.ancien, m.c.regles)]);
  assert.equal(p.verdict, 'a_corriger');
  assert.equal(categoriesDe(m, m.ancien).length, 2);
  m.db.close();
});

test('R309, lot : ramener à un seul type un mot-clé qui en avait plusieurs passe (le reclassement des lots d’ancrage)', async () => {
  const m = monde((db) => ({ ancien: poserMotCle(db, { libelle: nom('ancien'), categories: ['Règles', 'Combat'] }) }));
  await deposerDirect(m, [poserCategorie(m.ancien, m.c.race), retirerCategorie(m.ancien, m.c.regles), retirerCategorie(m.ancien, m.c.combat)]);
  assert.deepEqual(categoriesDe(m, m.ancien), [m.c.race]);
  m.db.close();
});

test('un lot `ancrage: { aligner: true }` dont `apres` porte un autre nom n’écrit jamais ce nom', async () => {
  const m = monde();
  const pris = nom('titre de la page');
  m.db.prepare('UPDATE page SET titre = ? WHERE id = ?').run(pris, m.page);
  const autreNom = nom('un autre nom');
  const p = await proposer(m, [{ ...modifier(m, m.ancre, { libelle: autreNom }), ancrage: { aligner: true } }]);
  assert.equal(p.verdict, 'a_corriger', 'l’alignement écrit le nom de l’élément, la ligne attendue diffère');
  assert.throws(() => appliquer(m.db, p.id, { verrous_ouverts: TOUS_LES_VERROUS }), (e) => e instanceof ErreurEdition && e.statut === 409);
  assert.notEqual(motCle(m, m.ancre).libelle, autreNom);
  // l'alignement reste la voie du nom : celui de l'élément passe
  await deposerDirect(m, [{ ...modifier(m, m.ancre, { libelle: pris }), ancrage: { aligner: true } }]);
  assert.equal(motCle(m, m.ancre).libelle, pris);
  clesJustes(m);
  m.db.close();
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Annulation, rejeu, résolution
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('R309, annulation : un lot qui a corrigé un mot-clé ancré s’annule (type, couleur, synonyme)', async () => {
  const m = monde();
  const avant = motCle(m, m.ancre);
  const fait = await deposerDirect(m, [modifier(m, m.ancre, { couleur: '#112233' }), poserCategorie(m.ancre, m.c.race), retirerCategorie(m.ancre, m.c.don), synonymeDuLot(m.ancre, nom('synonyme'))]);
  annuler(m.db, fait.id);
  assert.deepEqual(motCle(m, m.ancre), avant);
  assert.deepEqual(categoriesDe(m, m.ancre), [m.c.don]);
  assert.deepEqual(synonymesDe(m, m.ancre), []);
  clesJustes(m);
  m.db.close();
});

test('R309, annulation : le nom suivi d’une page renommée revient avec elle', async () => {
  const m = monde();
  const avant = motCle(m, m.ancre);
  const fait = await deposerDirect(m, [{ table: 'page', cle: { id: m.page }, operation: 'modifier', avant: { titre: avant.libelle }, apres: { titre: nom('titre neuf') } }]);
  assert.equal(motCle(m, m.ancre).libelle, nom('titre neuf'));
  annuler(m.db, fait.id);
  assert.equal(motCle(m, m.ancre).libelle, avant.libelle);
  clesJustes(m);
  m.db.close();
});

test('un ancien lot repasse au rejeu (R219 (6))', () => {
  // sur la base d'import : le rejeu contrôle toutes les clés étrangères, que la petite base ne remplit pas
  const site = reelle();
  const [c1, c2] = site.db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 2').all().map((c) => c.id);
  const id = route(site, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: nom('ancien'), categories: [c1] } }]).crees[0].id;
  const livres = journalExporte(site.db);
  const deja = new Set(livres.lots.map((l) => l.id));
  const libelle = nom('renommé autrefois');
  route(site, [{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle, couleur: '#112233' } }]);
  route(site, [{ op: 'categories_mot_cle', mot_cle: id, categories: [c2] }]);
  const tout = journalExporte(site.db);
  const suite = { ...tout, lots: tout.lots.filter((l) => !deja.has(l.id)) };
  site.db.close();

  const m = reelle();
  m.db.exec('PRAGMA foreign_keys = OFF');
  m.db.exec('BEGIN');
  chargerJournal(m.db, livres);
  rejouerLeJournal(m.db);
  m.db.exec('DELETE FROM modification; DELETE FROM modification_lot');
  m.db.exec('COMMIT');
  // ici, le même mot-clé est désormais ancré : les lots d'avant l'ancrage se rejouent tels quels
  const page = m.db.prepare("SELECT id FROM page WHERE statut <> 'example' AND mot_cle_id IS NULL AND id LIKE 'capacites/%' ORDER BY id LIMIT 1").get().id;
  m.db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(id, page);
  m.db.exec('BEGIN');
  chargerJournal(m.db, suite);
  const bilan = rejouerLeJournal(m.db);
  m.db.exec('COMMIT');
  m.db.exec('PRAGMA foreign_keys = ON');
  assert.equal(bilan.conflits, 0, JSON.stringify(bilan));
  assert.equal(motCle(m, id).libelle, libelle);
  assert.equal(motCle(m, id).couleur, '#112233');
  assert.deepEqual(categoriesDe(m, id), [c2]);
  m.db.close();
});

test('un ancien lot à deux catégories repasse (`gel` faux)', () => {
  const m = monde();
  enregistrer(m.db, { page: 'essai/', operations: [{ op: 'categories_mot_cle', mot_cle: m.libre, categories: [m.c.regles, m.c.combat] }] }, { gel: false });
  assert.equal(categoriesDe(m, m.libre).length, 2);
  const id = enregistrer(m.db, { page: 'essai/', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: nom('ancien'), categories: [m.c.regles, m.c.combat] } }] }, { gel: false }).crees[0].id;
  assert.equal(categoriesDe(m, id).length, 2);
  m.db.close();
});

test('R309 : la résolution d’un lot ancien (`gel: false`) n’est pas sous le verrou', () => {
  const m = monde();
  const libelle = nom('résolu');
  const { id, instant } = nouveauLot();
  m.db.exec('BEGIN IMMEDIATE');
  try {
    const w = ouvrirLot(m.db, { id, instant });
    OUTILS_DE_RESOLUTION.modifier({ db: m.db, w, instant, crees: [], forcees: [], fusions: [] }, { op: 'modifier', table: 'mot_cle', cle: { id: m.ancre }, valeurs: { libelle } });
    assert.equal(motCle(m, m.ancre).libelle, libelle);
  } finally {
    m.db.exec('ROLLBACK');
  }
  m.db.close();
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La clé d'un voisin (décision 2 : une clé se calcule, elle ne s'écrit pas)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Deux homonymes : un mot-clé ancré, et un mot-clé sans élément qu'un lot retire ; la clé de l'ancré change alors seule. */
function mondeAHomonymes() {
  const m = monde((db, { ancre }) => {
    const { libelle } = db.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(ancre);
    return { homonyme: poserMotCle(db, { libelle, categories: ['Combat'] }) };
  });
  return m;
}
const ligneDuVoisin = (m, p, id) => lire(m.db, p.id).lignes.find((l) => l.table === 'Mot-clé' && l.genre === 'modifier' && l.colonnes.every((c) => c.colonne === 'cle') && l.colonnes.length === 1 && l.ligne !== undefined && numeroDe(m, p, id) === l.n);
const numeroDe = (m, p, id) => m.db.prepare('SELECT rang, cle FROM modification WHERE lot_id = ? AND table_nom = ? ORDER BY rang').all(lire(m.db, p.id).lot_id, 'mot_cle').find((l) => JSON.parse(l.cle).id === id)?.rang;

test('R309 : la clé recalculée d’un voisin n’est pas annulable seule, avec un motif et sans verrou ouvrable', async () => {
  const m = mondeAHomonymes();
  const cleAvant = motCle(m, m.ancre).cle;
  const fait = await deposerDirect(m, [supprimerLeMotCle(m, m.homonyme)]);
  assert.notEqual(motCle(m, m.ancre).cle, cleAvant, 'le départ de l’homonyme change sa clé');
  const ligne = ligneDuVoisin(m, fait, m.ancre);
  assert.ok(ligne, 'la ligne de la clé du voisin');
  assert.equal(ligne.annulable_seule, false);
  assert.ok(ligne.motif);
  assert.deepEqual(decisionsCitees(ligne.motif), []);
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier, ligne: ligne.n });
  assert.deepEqual(apercu.verrous_a_ouvrir, [], 'rien à ouvrir au mot de passe');
  assert.equal(apercu.verdict, 'refusee');
  const e = refusSansNumero(() => annulerUneLigne(m.db, fait.id, ligne.n, { verrous_ouverts: TOUS_LES_VERROUS }));
  assert.match(e.message, /clé/);
  assert.notEqual(motCle(m, m.ancre).cle, cleAvant, 'rien n’est écrit');
  m.db.close();
});

test('R309 : la clé d’un voisin revient avec la ligne qui l’a causée', async () => {
  const m = mondeAHomonymes();
  const cleAvant = motCle(m, m.ancre).cle;
  // l'homonyme change de nom : sa ligne porte le nom, celle du voisin sa seule clé
  const fait = await deposerDirect(m, [modifier(m, m.homonyme, { libelle: nom('parti') })]);
  assert.notEqual(motCle(m, m.ancre).cle, cleAvant);
  assert.equal(ligneDuVoisin(m, fait, m.ancre).annulable_seule, false);
  const cause = lire(m.db, fait.id).lignes.find((l) => l.n === numeroDe(m, fait, m.homonyme));
  assert.equal(cause.annulable_seule, true, cause.motif);
  annulerUneLigne(m.db, fait.id, cause.n);
  assert.equal(motCle(m, m.ancre).cle, cleAvant);
  clesJustes(m);
  m.db.close();
});

test('R309 : la clé d’un voisin revient avec l’annulation du lot, sans mot de passe', async () => {
  const m = mondeAHomonymes();
  const cleAvant = motCle(m, m.ancre).cle;
  const fait = await deposerDirect(m, [supprimerLeMotCle(m, m.homonyme)]);
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(apercu.verrous_a_ouvrir, []);
  assert.equal(apercu.verdict, 'applicable');
  annuler(m.db, fait.id);
  assert.equal(motCle(m, m.ancre).cle, cleAvant);
  assert.equal(motCle(m, m.homonyme).id, m.homonyme);
  clesJustes(m);
  m.db.close();
});

test('R309 : l’annulation d’un lot qui renomme l’homonyme rend la clé du voisin, sans mot de passe', async () => {
  const m = mondeAHomonymes();
  const cleAvant = motCle(m, m.ancre).cle;
  const libelleAvant = motCle(m, m.homonyme).libelle;
  const fait = await deposerDirect(m, [modifier(m, m.homonyme, { libelle: nom('parti') })]);
  assert.notEqual(motCle(m, m.ancre).cle, cleAvant);
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(apercu.verrous_a_ouvrir, []);
  assert.equal(apercu.verdict, 'applicable');
  annuler(m.db, fait.id);
  assert.equal(motCle(m, m.ancre).cle, cleAvant);
  assert.equal(motCle(m, m.homonyme).libelle, libelleAvant);
  clesJustes(m);
  m.db.close();
});

// Une ligne { libelle, cle } dont le nom a changé depuis, sans changer de clé : la clé du lot est encore en place, mais elle n'est pas à remettre (une clé se calcule)

test('R309 : un renommage dont le nom a changé depuis ne propose aucun verrou sur la clé', async () => {
  const m = monde();
  const neuf = nom('renommé');
  const cleDAvant = motCle(m, m.libre).cle;
  const fait = await deposerDirect(m, [modifier(m, m.libre, { libelle: neuf })]);
  const cleDuLot = motCle(m, m.libre).cle;
  route(m, [{ op: 'modifier', table: 'mot_cle', cle: { id: m.libre }, valeurs: { libelle: neuf.toUpperCase() } }]);
  assert.equal(motCle(m, m.libre).cle, cleDuLot, 'la nouvelle écriture a la même clé');
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(apercu.verrous_a_ouvrir, [], JSON.stringify(apercu.operations));
  const ligne = lire(m.db, fait.id).lignes.find((l) => l.n === numeroDe(m, fait, m.libre));
  assert.equal(ligne.annulable_seule, false, 'il ne reste que la clé : rien à remettre sur cette ligne');
  assert.ok(ligne.motif);
  assert.deepEqual(decisionsCitees(ligne.motif), []);
  // le mot-clé n'a pas retrouvé sa clé d'avant : le renvoi depuis celle-ci reste, et il n'y a rien à remettre, même avec tous les verrous ouverts
  assert.equal(apercu.verdict, 'rien_a_remettre', JSON.stringify(apercu.operations));
  const renvoi = lire(m.db, fait.id).lignes.find((l) => l.n === m.db.prepare("SELECT rang FROM modification WHERE lot_id = ? AND table_nom = 'mot_cle_ancienne_cle'").get(lire(m.db, fait.id).lot_id).rang);
  assert.equal(renvoi.annulable_seule, false, renvoi.motif);
  assert.throws(() => annuler(m.db, fait.id, { verrous_ouverts: TOUS_LES_VERROUS }), (e) => e instanceof ErreurEdition && e.statut === 409);
  assert.ok(m.db.prepare('SELECT 1 AS x FROM mot_cle_ancienne_cle WHERE cle = ? AND mot_cle_id = ?').get(cleDAvant, m.libre), 'le renvoi de l’ancienne clé reste');
  assert.equal(motCle(m, m.libre).libelle, neuf.toUpperCase());
  assert.equal(motCle(m, m.libre).cle, cleDuLot);
  clesJustes(m);
  m.db.close();
});

test('R309 : le nom suivi d’une page renommée puis réécrite ne propose aucun verrou sur la clé', async () => {
  const m = monde();
  const neuf = nom('titre neuf');
  const fait = await deposerDirect(m, [{ table: 'page', cle: { id: m.page }, operation: 'modifier', avant: { titre: motCle(m, m.ancre).libelle }, apres: { titre: neuf } }]);
  const cleDuLot = motCle(m, m.ancre).cle;
  await deposerDirect(m, [{ table: 'page', cle: { id: m.page }, operation: 'modifier', avant: { titre: neuf }, apres: { titre: neuf.toUpperCase() } }]);
  assert.equal(motCle(m, m.ancre).libelle, neuf.toUpperCase());
  assert.equal(motCle(m, m.ancre).cle, cleDuLot, 'la nouvelle écriture a la même clé');
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(apercu.verrous_a_ouvrir, [], JSON.stringify(apercu.operations));
  assert.equal(motCle(m, m.ancre).cle, cleDuLot);
  m.db.close();
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Détacher pour renommer (Ruling T8-detachement) : magie, type de dégâts, monnaie
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** La petite base, avec une magie, un type de dégâts, un type de sort et une monnaie ancrés chacun à son mot-clé. Les lignes respectent les CHECK : un lot les réécrit. */
function mondeAuxAncres() {
  return monde((db) => {
    const idMagie = poserPage(db, 'magies/zephyrion-magie', nom('magie'));
    const motDeMagie = poserMotCle(db, { libelle: nom('mot de magie'), categories: ['Magie'] });
    poserMagie(db, idMagie, nom('magie'), { mot_cle_id: motDeMagie });
    db.prepare("UPDATE magie SET origine = 'magies', mono_magie = 0 WHERE id = ?").run(idMagie);
    const degats = poserMotCle(db, { libelle: nom('mot de dégâts'), categories: ['Dégâts'] });
    db.prepare("INSERT INTO type_degats (id, mot_cle_id, magie_id) VALUES ('taille', ?, NULL)").run(degats);
    const motDeType = poserMotCle(db, { libelle: nom('mot de type'), categories: ['Sort'] });
    db.prepare("UPDATE type_sort SET mot_cle_id = ? WHERE id = 'soin'").run(motDeType);
    const motDeMonnaie = poserMotCle(db, { libelle: nom('mot de monnaie'), categories: ['Équipement'] });
    db.prepare("INSERT INTO monnaie (id, nom, abreviation, valeur_rf, origine, source_ref) VALUES ('zq', ?, 'ZQ', 1, 'equipement', 'essai')").run(nom('monnaie'));
    db.prepare("UPDATE mot_cle SET monnaie_id = 'zq' WHERE id = ?").run(motDeMonnaie);
    return { magie: { id: idMagie, mot_cle_id: motDeMagie }, monnaie: { id: motDeMonnaie, monnaie_id: 'zq' }, type: 'taille', degats, typeSort: 'soin', motDeType };
  });
}

const ancreDe = (m, table, id) => m.db.prepare(`SELECT mot_cle_id AS k FROM "${table}" WHERE id = ?`).get(id)?.k ?? null;
const changerLAncre = (table, id, avant, apres) => ({ table, cle: { id }, operation: 'modifier', avant: { mot_cle_id: avant }, apres: { mot_cle_id: apres } });
const retirerLaLigne = (m, table, id) => ({ table, cle: { id }, operation: 'supprimer', avant: { ...m.db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id) } });
const renommer = (m, id) => modifier(m, id, { libelle: nom('écrit par le lot'), url: '/races/' });

/** Le lot est refusé à la clé de dépôt comme au mot de passe, sans numéro de décision, et rien n'est écrit. */
async function refuseSansNumero(m, operations, id) {
  const avant = motCle(m, id);
  for (const [plus, par] of [[{}, 'cle_de_depot'], [{ verrous_ouverts: TOUS_LES_VERROUS }, 'mot_de_passe']]) {
    const e = await deposerDirect(m, operations, plus, par).then(() => assert.fail('refus attendu'), (x) => x);
    assert.ok(e instanceof ErreurEdition, String(e));
    assert.equal(e.statut, 409, e.message);
    assert.deepEqual(decisionsCitees(e.message), [], e.message);
  }
  assert.deepEqual(motCle(m, id), avant, 'rien n’est écrit');
}

for (const [quoi, faire] of [
  ['retirer l’ancre d’une magie', (m) => ({ id: m.magie.mot_cle_id, table: 'magie', element: m.magie.id, ops: [changerLAncre('magie', m.magie.id, m.magie.mot_cle_id, null), renommer(m, m.magie.mot_cle_id)] })],
  ['remplacer l’ancre d’une magie', (m) => ({ id: m.magie.mot_cle_id, table: 'magie', element: m.magie.id, ops: [changerLAncre('magie', m.magie.id, m.magie.mot_cle_id, m.libre), renommer(m, m.magie.mot_cle_id)] })],
  ['supprimer une magie ancrée', (m) => ({ id: m.magie.mot_cle_id, table: 'magie', element: m.magie.id, ops: [retirerLaLigne(m, 'magie', m.magie.id), renommer(m, m.magie.mot_cle_id)] })],
  ['retirer l’ancre d’un type de dégâts', (m) => ({ id: m.degats, table: 'type_degats', element: m.type, ops: [changerLAncre('type_degats', m.type, m.degats, null), renommer(m, m.degats)] })],
  ['remplacer l’ancre d’un type de dégâts', (m) => ({ id: m.degats, table: 'type_degats', element: m.type, ops: [changerLAncre('type_degats', m.type, m.degats, m.libre), renommer(m, m.degats)] })],
  ['supprimer un type de dégâts ancré', (m) => ({ id: m.degats, table: 'type_degats', element: m.type, ops: [retirerLaLigne(m, 'type_degats', m.type), renommer(m, m.degats)] })],
]) {
  test(`T8-detachement : un lot ne peut pas ${quoi}, mot de passe compris`, async () => {
    const m = mondeAuxAncres();
    const { id, table, element, ops } = faire(m);
    await refuseSansNumero(m, ops, id);
    assert.equal(ancreDe(m, table, element), id);
    m.db.close();
  });
}

test('T8-detachement : un lot ne peut pas supprimer un type de sort ancré, mot de passe compris', async () => {
  const m = mondeAuxAncres();
  await refuseSansNumero(m, [retirerLaLigne(m, 'type_sort', m.typeSort), renommer(m, m.motDeType)], m.motDeType);
  assert.equal(ancreDe(m, 'type_sort', m.typeSort), m.motDeType);
  m.db.close();
});

test('T8-detachement : un lot ne retire pas `monnaie_id`, mot de passe compris', async () => {
  const m = mondeAuxAncres();
  const { id, monnaie_id: monnaie } = m.monnaie;
  await refuseSansNumero(m, [modifier(m, id, { monnaie_id: null }), renommer(m, id)], id);
  assert.equal(motCle(m, id).monnaie_id, monnaie);
  m.db.close();
});

test('T8-detachement : un lot ne supprime pas la monnaie d’un mot-clé (`ON DELETE SET NULL` le détacherait), mot de passe compris', async () => {
  const m = mondeAuxAncres();
  const { id, monnaie_id: monnaie } = m.monnaie;
  const e = await deposerDirect(m, [retirerLaLigne(m, 'monnaie', monnaie), renommer(m, id)], { verrous_ouverts: TOUS_LES_VERROUS }, 'mot_de_passe').then(() => assert.fail('refus attendu'), (x) => x);
  assert.ok(e instanceof ErreurEdition, String(e));
  assert.equal(e.statut, 409, e.message);
  assert.deepEqual(decisionsCitees(e.message), [], e.message);
  assert.equal(motCle(m, id).monnaie_id, monnaie);
  m.db.close();
});

test('T8-detachement : poser une ancre sur une valeur nulle reste permis, et son lot s’annule', async () => {
  const m = mondeAuxAncres();
  const { id: magie, mot_cle_id: k } = m.magie;
  m.db.prepare('UPDATE magie SET mot_cle_id = NULL WHERE id = ?').run(magie);
  const fait = await deposerDirect(m, [changerLAncre('magie', magie, null, k)]);
  assert.equal(ancreDe(m, 'magie', magie), k);
  annuler(m.db, fait.id);
  assert.equal(ancreDe(m, 'magie', magie), null);
  m.db.close();
});

test('T8-detachement : créer une ligne ancrée reste permis, et son lot s’annule', async () => {
  const m = mondeAuxAncres();
  const type = 'estoc'; // absent de la petite base ; le CHECK de la table n'accepte que ses codes
  const fait = await deposerDirect(m, [{ table: 'type_degats', cle: { id: type }, operation: 'inserer', apres: { id: type, mot_cle_id: m.libre, magie_id: null } }]);
  assert.equal(ancreDe(m, 'type_degats', type), m.libre);
  annuler(m.db, fait.id);
  assert.equal(m.db.prepare('SELECT 1 AS x FROM type_degats WHERE id = ?').get(type), undefined);
  m.db.close();
});

test('T8-detachement : les autres colonnes d’une magie ancrée restent permises', async () => {
  const m = mondeAuxAncres();
  const { id: magie, mot_cle_id: k } = m.magie;
  const { remarque } = m.db.prepare('SELECT remarque FROM magie WHERE id = ?').get(magie);
  await deposerDirect(m, [{ table: 'magie', cle: { id: magie }, operation: 'modifier', avant: { remarque }, apres: { remarque: nom('remarque') } }]);
  assert.equal(m.db.prepare('SELECT remarque FROM magie WHERE id = ?').get(magie).remarque, nom('remarque'));
  assert.equal(ancreDe(m, 'magie', magie), k);
  m.db.close();
});

test('T8-detachement : annuler un ancien lot qui avait retiré l’ancre d’une magie la remet', async () => {
  const m = mondeAuxAncres();
  const { id: magie, mot_cle_id: k } = m.magie;
  m.db.prepare('UPDATE magie SET mot_cle_id = NULL WHERE id = ?').run(magie);
  const fait = await deposerDirect(m, [changerLAncre('magie', magie, null, k)]);
  // au journal, ce lot devient un lot d'avant le verrou, qui retirait l'ancre
  const { lot_id: lot } = lire(m.db, fait.id);
  m.db.prepare("UPDATE modification SET avant = apres, apres = avant WHERE lot_id = ? AND table_nom = 'magie'").run(lot);
  m.db.prepare('UPDATE magie SET mot_cle_id = NULL WHERE id = ?').run(magie);
  annuler(m.db, fait.id);
  assert.equal(ancreDe(m, 'magie', magie), k);
  m.db.close();
});

test('T8-detachement : annuler un ancien lot qui avait retiré `monnaie_id` la remet, le mot de passe ouvrant la colonne tenue', async () => {
  const m = mondeAuxAncres();
  const { id, monnaie_id: monnaie } = m.monnaie;
  m.db.prepare('UPDATE mot_cle SET monnaie_id = NULL WHERE id = ?').run(id);
  const fait = await deposerDirect(m, [modifier(m, id, { monnaie_id: monnaie })], { verrous_ouverts: TOUS_LES_VERROUS }, 'mot_de_passe');
  assert.equal(motCle(m, id).monnaie_id, monnaie);
  const { lot_id: lot } = lire(m.db, fait.id);
  m.db.prepare("UPDATE modification SET avant = apres, apres = avant WHERE lot_id = ? AND table_nom = 'mot_cle'").run(lot);
  m.db.prepare('UPDATE mot_cle SET monnaie_id = NULL WHERE id = ?').run(id);
  annuler(m.db, fait.id, { verrous_ouverts: TOUS_LES_VERROUS });
  assert.equal(motCle(m, id).monnaie_id, monnaie);
  m.db.close();
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'annulation ne recalcule pas d'elle-même : le nom d'une magie, une ligne { colonne, cle } (Ruling T8-annulation-recalcul)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une magie de la petite base, aux CHECK respectés (un lot la réécrit). */
function poserUneMagie(db, suffixe) {
  const libelle = nom(`magie ${suffixe}`);
  const id = poserPage(db, `magies/zephyrion-${suffixe}`, libelle);
  poserMagie(db, id, libelle);
  db.prepare("UPDATE magie SET origine = 'magies', mono_magie = 0, nom_cle = ? WHERE id = ?").run(normalize(libelle), id);
  return id;
}

/** Deux sorts homonymes ancrés, chacun dans sa magie : leur clé dépend du nom de la magie. */
function mondeAuxSortsJumeaux() {
  return monde((db) => {
    const [magie, autreMagie] = ['ma', 'mb'].map((s) => poserUneMagie(db, s));
    const titre = nom('sort jumeau');
    const [sien, jumeau] = [magie, autreMagie].map((g) => {
      const sort = poserSort(db, g, titre);
      const k = poserMotCle(db, { libelle: titre, url: adresseDuSort(sort), categories: ['Sort'] });
      db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(k, sort);
      return k;
    });
    return { magie, sien, jumeau };
  });
}

const renommerLaMagie = (m, id) => {
  const { nom: avant, nom_cle: cleAvant } = m.db.prepare('SELECT nom, nom_cle FROM magie WHERE id = ?').get(id);
  const neuf = nom('magie renommée');
  return { table: 'magie', cle: { id }, operation: 'modifier', avant: { nom: avant, nom_cle: cleAvant }, apres: { nom: neuf, nom_cle: normalize(neuf) } };
};
const nomDeLaMagie = (m, id) => m.db.prepare('SELECT nom FROM magie WHERE id = ?').get(id).nom;
const premiereLigne = (m, p, table) => m.db.prepare('SELECT min(rang) AS n FROM modification WHERE lot_id = ? AND table_nom = ?').get(lire(m.db, p.id).lot_id, table).n;

/** Le lot de la relecture : une colonne du mot-clé et le nom de sa magie ; la clé du mot-clé suit la magie. */
async function lotCouleurEtMagie(m) {
  const avant = { magie: nomDeLaMagie(m, m.magie), ...motCle(m, m.sien) };
  const fait = await deposerDirect(m, [modifier(m, m.sien, { couleur: '#112233' }), renommerLaMagie(m, m.magie)]);
  assert.notEqual(motCle(m, m.sien).cle, avant.cle, 'la clé a suivi le nom de la magie');
  return { fait, avant, cleDuLot: motCle(m, m.sien).cle };
}

test('T8-annulation-recalcul : annuler le lot entier rend le nom de la magie, la colonne et la clé, sans verrou', async () => {
  const m = mondeAuxSortsJumeaux();
  const { fait, avant } = await lotCouleurEtMagie(m);
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(apercu.verrous_a_ouvrir, [], JSON.stringify(apercu.operations));
  assert.equal(apercu.verdict, 'applicable', JSON.stringify(apercu.operations));
  annuler(m.db, fait.id);
  assert.equal(nomDeLaMagie(m, m.magie), avant.magie);
  assert.equal(motCle(m, m.sien).couleur, avant.couleur);
  assert.equal(motCle(m, m.sien).cle, avant.cle);
  assert.equal(m.db.prepare('SELECT 1 AS x FROM mot_cle_ancienne_cle WHERE cle = ?').get(avant.cle), undefined, 'la clé revenue n’est plus une clé quittée');
  clesJustes(m);
  m.db.close();
});

test('T8-annulation-recalcul : annuler la seule ligne de la magie rend son nom et la clé ; la colonne reste celle du lot', async () => {
  const m = mondeAuxSortsJumeaux();
  const { fait, avant } = await lotCouleurEtMagie(m);
  annulerUneLigne(m.db, fait.id, premiereLigne(m, fait, 'magie'));
  assert.equal(nomDeLaMagie(m, m.magie), avant.magie);
  assert.equal(motCle(m, m.sien).cle, avant.cle);
  assert.equal(motCle(m, m.sien).couleur, '#112233');
  clesJustes(m);
  m.db.close();
});

test('T8-annulation-recalcul : annuler la seule ligne { couleur, cle } rend la couleur ; la clé reste celle de la règle, sans verrou', async () => {
  const m = mondeAuxSortsJumeaux();
  const { fait, avant, cleDuLot } = await lotCouleurEtMagie(m);
  const n = numeroDe(m, fait, m.sien);
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier, ligne: n });
  assert.deepEqual(apercu.verrous_a_ouvrir, [], JSON.stringify(apercu.operations));
  annulerUneLigne(m.db, fait.id, n);
  assert.equal(motCle(m, m.sien).couleur, avant.couleur);
  assert.equal(motCle(m, m.sien).cle, cleDuLot);
  assert.notEqual(nomDeLaMagie(m, m.magie), avant.magie);
  assert.ok(m.db.prepare('SELECT 1 AS x FROM mot_cle_ancienne_cle WHERE cle = ? AND mot_cle_id = ?').get(avant.cle, m.sien), 'le renvoi de l’ancienne clé reste');
  clesJustes(m);
  m.db.close();
});

test('T8-annulation-recalcul : le renvoi d’une clé quittée ne s’annule pas seul, il suit la clé', async () => {
  const m = mondeAuxSortsJumeaux();
  const { fait, avant } = await lotCouleurEtMagie(m);
  const renvoi = lire(m.db, fait.id).lignes.find((l) => l.n === premiereLigne(m, fait, 'mot_cle_ancienne_cle'));
  assert.equal(renvoi.annulable_seule, false, renvoi.motif);
  assert.ok(renvoi.motif);
  assert.doesNotMatch(renvoi.motif, /garde sa clé/);
  assert.ok(m.db.prepare('SELECT 1 AS x FROM mot_cle_ancienne_cle WHERE cle = ?').get(avant.cle));
  m.db.close();
});

test('T8-annulation-recalcul : un ancien lot sans ancre qui a renommé une magie s’annule comme avant', async () => {
  const m = monde((db) => ({ magie: poserUneMagie(db, 'ma') }));
  const avant = nomDeLaMagie(m, m.magie);
  const fait = await deposerDirect(m, [renommerLaMagie(m, m.magie)]);
  assert.notEqual(nomDeLaMagie(m, m.magie), avant);
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
  assert.deepEqual(apercu.verrous_a_ouvrir, []);
  assert.equal(apercu.verdict, 'applicable', JSON.stringify(apercu.operations));
  annuler(m.db, fait.id);
  assert.equal(nomDeLaMagie(m, m.magie), avant);
  clesJustes(m);
  m.db.close();
});

test('T8-annulation-recalcul : la clé qu’un autre renommage du lot ramène n’est pas annoncée gardée', async () => {
  const m = monde();
  const avant = motCle(m, m.libre);
  const fait = await deposerDirect(m, [modifier(m, m.libre, { couleur: '#112233' }), modifier(m, m.autre, { libelle: avant.libelle })]);
  assert.notEqual(motCle(m, m.libre).cle, avant.cle, 'l’homonyme a changé sa clé');
  const apercu = await previsualiserLAnnulation(m.base, fait.id, { enArrierePlan: false, dossier: m.dossier });
  const ligne = apercu.operations.find((o) => o.table === 'mot_cle' && o.cle.id === m.libre);
  assert.deepEqual(ligne.ecarts ?? [], [], JSON.stringify(ligne));
  annuler(m.db, fait.id);
  assert.equal(motCle(m, m.libre).cle, avant.cle);
  clesJustes(m);
  m.db.close();
});
