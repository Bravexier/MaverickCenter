// Le mot-clé suit son élément (décision R309, docs/chantier-ancrage-mots-cles.md, §6 ; serveur/edition-ancrage.mjs) : créé avec la page, renommé avec elle ou avec
// le sort, sa clé recalculée quand la magie change de nom, retiré avec l'élément s'il n'est ni cité ni tenu par un autre (R289). Noms inventés ; les lignes se
// prennent par ordre d'id, aucune valeur de règle n'est lue. Deux sortes de bases : une copie de la base d'import (le service d'édition sur le vrai contenu) et
// la petite base de test/aide-ancrage.mjs pour ce qui passe par un dépôt (un essai complet sur une copie).
//   node --test test/serveur-edition-ancrage-suivi.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante } from '../serveur/base-vivante.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { motsClesPropres } from '../serveur/edition-ancrage.mjs';
import { appliquerUnLot, ErreurEdition, enregistrer, rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { annuler, annulerUneLigne, deposerEtAppliquer, lire, netsDuLot, previsualiserLAnnulation } from '../serveur/edition-lots.mjs';
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { FORMAT_DU_LOT } from '../src/lib/lot-de-changements.mjs';
import { mentionsDe } from '../src/lib/mentions-des-mots-cles.mjs';
import { clesDesMotsCles } from '../src/lib/mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDAncrage, poserMagie, poserMotCle, poserPage, poserSort, recalculerLesCles } from './aide-ancrage.mjs';
import { copieDeLaBaseLegere } from './aide-base-legere.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('ancrage-suivi');
let n = 0;
const nom = (suffixe) => `Zephyrion ${suffixe} ${process.pid}`;

/** Une copie de la base d'import, prête pour le service (test/aide-base-legere.mjs). */
const reelle = () => ({ db: ouvrirBaseVivante(copieDeLaBaseLegere(racine, `b${(n += 1)}`)) });

/** La petite base d'essai, en fichier : ce qu'un dépôt copie. `poser` y écrit les lignes du test. */
function petite(poser) {
  const memoire = baseDAncrage();
  const monde = poser(memoire);
  recalculerLesCles(memoire);
  const dossier = join(racine, `p${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  memoire.exec(`VACUUM INTO '${chemin.replaceAll("'", "''")}'`);
  memoire.close();
  const db = ouvrirBaseVivante(chemin);
  return { db, base: () => db, dossier: join(racine, `essais${n}`), monde };
}

const lot = (operations) => ({ format: FORMAT_DU_LOT, titre: `Suivi d’essai ${(n += 1)}`, nature: 'decision', decision: 'R309', operations });
const deposerLeLot = (m, operations) => deposerEtAppliquer(m.base, lot(operations), { par: 'cle_de_depot', enArrierePlan: false, dossier: m.dossier, controle: { ouvertHorsEdition: true } });

const ecrire = (m, operations) => enregistrer(m.db, { page: 'essai/', operations });
const creerMetier = (m, libelle) => ecrire(m, [{ op: 'creer', entite: 'metier', valeurs: { nom: libelle } }]).crees[0].id;
const creerPageDesRegles = (m, titre) => ecrire(m, [{ op: 'creer', entite: 'page_des_regles', valeurs: { titre, onglet_id: 'combats', resume: 'Essai.' } }]).crees[0].id;
const supprimerPageDesRegles = (m, id) => ecrire(m, [{ op: 'supprimer', entite: 'page_des_regles', cle: { id } }]);
const categorie = (m, libelle) => m.db.prepare('SELECT id FROM categorie_mot_cle WHERE libelle = ?').get(libelle)?.id;
/** La catégorie `Guide` n'existe qu'après le premier lot d'ancrage : les tests qui créent une page des Règles la posent. */
function poserLaCategorieGuide(m) {
  const id = m.db.prepare('SELECT coalesce(max(id), 0) + 1 AS n FROM categorie_mot_cle').get().n;
  m.db.prepare('INSERT INTO categorie_mot_cle (id, libelle, libelle_cle) VALUES (?, ?, ?)').run(id, 'Guide', normalize('Guide'));
  return id;
}
const ancre = (m, table, id) => m.db.prepare(`SELECT mot_cle_id AS a FROM "${table}" WHERE id = ?`).get(id)?.a ?? null;
const motCle = (m, id) => m.db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id);
const categoriesDe = (m, id) => m.db.prepare('SELECT categorie_id AS c FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY c').all(id).map((l) => l.c);
const nombreDeMotsCles = (m) => m.db.prepare('SELECT count(*) AS n FROM mot_cle').get().n;
const nombreDeLots = (m) => m.db.prepare('SELECT count(*) AS n FROM modification_lot').get().n;
const corpsDe = (m, id) => m.db.prepare('SELECT corps_md FROM page WHERE id = ?').get(id)?.corps_md;
/** Une page du guide où poser une balise (la première, par id). */
const unePageDuGuide = (m) => m.db.prepare("SELECT id FROM page WHERE type = 'guide' AND statut <> 'example' ORDER BY id LIMIT 1").get().id;
const citer = (m, pageId, cle) => m.db.prepare("UPDATE page SET corps_md = corps_md || ? WHERE id = ?").run(`\n\nVoir {{${cle}}}.\n`, pageId);

/** Chaque clé de la base est celle que la règle donne (R232, R309). */
function clesJustes(m) {
  const vocabulaire = motsClesDeLaBase(m.db);
  const attendues = clesDesMotsCles(vocabulaire, new Map(categoriesDesMotsCles(m.db).map((c) => [c.id, c.libelle])));
  for (const x of vocabulaire) assert.equal(x.cle, attendues.get(x.id), `clé du mot-clé ${x.id}`);
}

const refusDe = (faire) => {
  try {
    faire();
  } catch (e) {
    assert.ok(e instanceof ErreurEdition, String(e));
    return e;
  }
  return assert.fail('refus attendu');
};

test('R309 : créer un métier crée son mot-clé, type Métier, ancre posée', () => {
  const m = reelle();
  try {
    const titre = nom('métier');
    const id = creerMetier(m, titre);
    const motCleId = ancre(m, 'page', id);
    assert.notEqual(motCleId, null, 'la page est ancrée');
    const mc = motCle(m, motCleId);
    assert.equal(mc.libelle, titre);
    assert.equal(mc.url, adresseDeLaPage(id));
    assert.equal(mc.verrou, 0, 'jamais verrouillé (R219 (5))');
    assert.equal(mc.description, null, 'aucune définition écrite');
    assert.deepEqual(categoriesDe(m, motCleId), [categorie(m, 'Métier')]);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('un métier homonyme d’une caractéristique : deux clés par type, balises réécrites', () => {
  const m = reelle();
  try {
    const titre = nom('homonyme');
    const fiche = categorie(m, 'Fiche de personnage');
    const existant = ecrire(m, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: titre, categories: [fiche] } }]).crees[0].id;
    const page = unePageDuGuide(m);
    citer(m, page, normalize(titre));
    const id = creerMetier(m, titre);
    const sien = ancre(m, 'page', id);
    assert.notEqual(sien, null);
    assert.equal(motCle(m, sien).cle, `${normalize(titre)}-metier`);
    assert.equal(motCle(m, existant).cle, `${normalize(titre)}-fiche-de-personnage`);
    assert.ok(corpsDe(m, page).includes(`{{${normalize(titre)}-fiche-de-personnage}}`), 'la balise suit la clé');
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('même nom, même type : la page est créée, sans mot-clé', () => {
  const m = reelle();
  try {
    const titre = nom('même type');
    ecrire(m, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: titre, categories: [categorie(m, 'Métier')] } }]);
    const avant = nombreDeMotsCles(m);
    const id = creerMetier(m, titre);
    assert.equal(m.db.prepare('SELECT titre FROM page WHERE id = ?').get(id).titre, titre, 'la page existe');
    assert.equal(ancre(m, 'page', id), null, 'elle attend, à trancher');
    assert.equal(nombreDeMotsCles(m), avant);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('une page sans catégorie à sa rubrique est créée sans mot-clé', () => {
  const m = reelle();
  try {
    assert.equal(categorie(m, 'Guide'), undefined, 'la catégorie Guide n’existe qu’après le premier lot d’ancrage');
    const id = creerPageDesRegles(m, nom('sans type'));
    assert.equal(ancre(m, 'page', id), null);
  } finally {
    m.db.close();
  }
});

test('renommer une page renomme le mot-clé, sa clé et ses balises, l’adresse ne bouge pas', () => {
  const m = reelle();
  try {
    poserLaCategorieGuide(m);
    const titre = nom('avant');
    const id = creerPageDesRegles(m, titre);
    const motCleId = ancre(m, 'page', id);
    const citante = unePageDuGuide(m);
    citer(m, citante, normalize(titre));
    const nouveau = nom('après');
    ecrire(m, [{ op: 'modifier', table: 'page', cle: { id }, valeurs: { titre: nouveau } }]);
    const mc = motCle(m, motCleId);
    assert.equal(mc.libelle, nouveau);
    assert.equal(mc.cle, normalize(nouveau));
    assert.equal(mc.url, adresseDeLaPage(id), 'l’adresse suit l’id de la page, qui ne change pas');
    assert.ok(corpsDe(m, citante).includes(`{{${normalize(nouveau)}`), 'la balise suit la clé');
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('un renommage que la règle refuse laisse le mot-clé tel quel, la page est renommée', () => {
  const m = reelle();
  try {
    poserLaCategorieGuide(m);
    const titre = nom('garde');
    const id = creerPageDesRegles(m, titre);
    const motCleId = ancre(m, 'page', id);
    // un autre mot-clé du même type porte déjà le nom voulu
    const pris = nom('pris');
    ecrire(m, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: pris, categories: [categorie(m, 'Guide')] } }]);
    ecrire(m, [{ op: 'modifier', table: 'page', cle: { id }, valeurs: { titre: pris } }]);
    assert.equal(m.db.prepare('SELECT titre FROM page WHERE id = ?').get(id).titre, pris);
    assert.equal(motCle(m, motCleId).libelle, titre);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('renommer un sort renomme son mot-clé', () => {
  const m = reelle();
  try {
    const sort = m.db.prepare('SELECT id, nom FROM sort WHERE lower(nom) NOT IN (SELECT lower(libelle) FROM mot_cle) ORDER BY id LIMIT 1').get();
    const type = m.db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 1').get().id;
    const motCleId = ecrire(m, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: sort.nom, categories: [type] } }]).crees[0].id;
    m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(motCleId, sort.id);
    const nouveau = nom('sort');
    ecrire(m, [{ op: 'modifier', table: 'sort', cle: { id: sort.id }, valeurs: { nom: nouveau } }]);
    const mc = motCle(m, motCleId);
    assert.equal(mc.libelle, nouveau);
    assert.equal(mc.cle, normalize(nouveau));
    assert.equal(mc.url, adresseDuSort(sort.id));
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('renommer une magie recalcule la clé de ses sorts homonymes, db:check passe', async () => {
  const m = reelle();
  m.base = () => m.db;
  m.dossier = join(racine, `essais${(n += 1)}`);
  try {
    // deux sorts de deux magies, de même nom et de même type : seule leur magie les départage
    const [s1, s2] = m.db.prepare('SELECT min(id) AS id, magie_id FROM sort GROUP BY magie_id ORDER BY magie_id LIMIT 2').all().map((s) => ({ ...s }));
    const titre = nom('sort jumeau');
    for (const s of [s1, s2]) m.db.prepare('UPDATE sort SET nom = ? WHERE id = ?').run(titre, s.id);
    const type = m.db.prepare('SELECT libelle FROM categorie_mot_cle ORDER BY id LIMIT 1').get().libelle;
    // posés en SQL : un seul dépôt, le renommage (un dépôt copie toute la base)
    const [sien, autre] = [s1, s2].map((s) => {
      const id = poserMotCle(m.db, { libelle: titre, url: adresseDuSort(s.id), categories: [type] });
      m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(id, s.id);
      return id;
    });
    recalculerLesCles(m.db);
    const cleDeLAutre = motCle(m, autre).cle;
    const avant = m.db.prepare('SELECT nom, nom_cle FROM magie WHERE id = ?').get(s1.magie_id);
    const nouveau = nom('magie renommée');
    await deposerLeLot(m, [{ table: 'magie', cle: { id: s1.magie_id }, operation: 'modifier', avant: { nom: avant.nom, nom_cle: avant.nom_cle }, apres: { nom: nouveau, nom_cle: normalize(nouveau) } }]);
    assert.ok(motCle(m, sien).cle.includes(normalize(nouveau)), `le parent a bougé : ${motCle(m, sien).cle}`);
    assert.equal(motCle(m, autre).cle, cleDeLAutre);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('une ancre n’est pas une mention : ni colonne Pages, ni texte à retoucher', () => {
  const m = reelle();
  try {
    const id = creerMetier(m, nom('ancre'));
    const motCleId = ancre(m, 'page', id);
    assert.deepEqual(mentionsDe(m.db, motCleId), [], 'la page ancrée ne mentionne pas son mot-clé');
    assert.deepEqual(motsClesPropres(m.db, 'page', [id]).get(id).mentions, []);
    ecrire(m, [{ op: 'supprimer', entite: 'metier', cle: { id } }]);
    assert.equal(motCle(m, motCleId), undefined);
  } finally {
    m.db.close();
  }
});

test('un renommage annulé ne revient pas au lot suivant sur la même page', async () => {
  const m = petite((db) => {
    const id = poserPage(db, 'guide/zephyrion', nom('titre'), { resume: 'Résumé.' });
    db.prepare("UPDATE page SET corps_md = 'Texte.', origine = 'docs' WHERE id = ?").run(id);
    const motCleId = poserMotCle(db, { libelle: nom('titre'), url: adresseDeLaPage(id), categories: ['Règles'] });
    db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = ?').run(motCleId, id);
    return { id, motCleId };
  });
  try {
    const { id, motCleId } = m.monde;
    const nouveau = nom('titre renommé');
    const r = await deposerLeLot(m, [{ table: 'page', cle: { id }, operation: 'modifier', avant: { titre: nom('titre') }, apres: { titre: nouveau } }]);
    assert.equal(motCle(m, motCleId).libelle, nouveau, 'le mot-clé a suivi');
    annuler(m.db, r.id);
    assert.equal(m.db.prepare('SELECT titre FROM page WHERE id = ?').get(id).titre, nom('titre'));
    assert.equal(motCle(m, motCleId).libelle, nom('titre'), 'l’annulation remet le nom');
    // un lot suivant sur la même page, sans toucher au titre : le nom ne revient pas
    await deposerLeLot(m, [{ table: 'page', cle: { id }, operation: 'modifier', avant: { resume: 'Résumé.' }, apres: { resume: 'Autre résumé.' } }]);
    assert.equal(motCle(m, motCleId).libelle, nom('titre'));
  } finally {
    m.db.close();
  }
});

test('rejeu d’un lot qui supprime une page et son mot-clé : aucun conflit', () => {
  const site = reelle();
  let livres;
  let suite;
  let id;
  let motCleId;
  try {
    poserLaCategorieGuide(site);
    id = creerPageDesRegles(site, nom('rejeu'));
    motCleId = ancre(site, 'page', id);
    assert.notEqual(motCleId, null);
    livres = journalExporte(site.db);
    supprimerPageDesRegles(site, id);
    const deja = new Set(livres.lots.map((l) => l.id));
    const tout = journalExporte(site.db);
    suite = { ...tout, lots: tout.lots.filter((l) => !deja.has(l.id)) };
    assert.equal(suite.lots.length, 1);
  } finally {
    site.db.close();
  }
  const { db } = reelle();
  try {
    poserLaCategorieGuide({ db });
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    chargerJournal(db, livres);
    rejouerLeJournal(db);
    db.exec('DELETE FROM modification; DELETE FROM modification_lot');
    db.exec('COMMIT');
    assert.notEqual(db.prepare('SELECT mot_cle_id AS a FROM page WHERE id = ?').get(id)?.a ?? null, null, 'la page et son ancre sont livrées');
    db.exec('BEGIN');
    chargerJournal(db, suite);
    const bilan = rejouerLeJournal(db);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    assert.equal(bilan.conflits, 0, JSON.stringify(bilan));
    assert.equal(db.prepare('SELECT 1 FROM page WHERE id = ?').get(id), undefined);
    assert.equal(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(motCleId), undefined);
  } finally {
    db.close();
  }
});

test('supprimer une page non citée retire son mot-clé dans le même lot', () => {
  const m = reelle();
  try {
    poserLaCategorieGuide(m);
    const id = creerPageDesRegles(m, nom('retirée'));
    const motCleId = ancre(m, 'page', id);
    const { lot: lotId } = supprimerPageDesRegles(m, id);
    assert.equal(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(id), undefined);
    assert.equal(motCle(m, motCleId), undefined);
    const lignes = m.db.prepare("SELECT table_nom AS t FROM modification WHERE lot_id = ? AND operation = 'supprimer'").all(lotId).map((l) => l.t);
    assert.ok(lignes.includes('page') && lignes.includes('mot_cle') && lignes.includes('mot_cle_categorie'), lignes.join(', '));
    assert.ok(lignes.indexOf('page') < lignes.indexOf('mot_cle'), 'le mot-clé part après la page');
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('supprimer une page citée : 409 avec la liste des textes, rien d’écrit', () => {
  const m = reelle();
  try {
    poserLaCategorieGuide(m);
    const titre = nom('citée');
    const id = creerPageDesRegles(m, titre);
    const motCleId = ancre(m, 'page', id);
    const citante = unePageDuGuide(m);
    const titreCitant = m.db.prepare('SELECT titre FROM page WHERE id = ?').get(citante).titre;
    citer(m, citante, normalize(titre));
    const lots = nombreDeLots(m);
    const e = refusDe(() => supprimerPageDesRegles(m, id));
    assert.equal(e.statut, 409);
    assert.ok(e.message.includes(titreCitant), e.message);
    assert.ok(e.details.citations.some((c) => c.page?.id === citante));
    assert.equal(nombreDeLots(m), lots, 'rien d’écrit');
    assert.notEqual(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(id), undefined);
    assert.notEqual(motCle(m, motCleId), undefined);
  } finally {
    m.db.close();
  }
});

test('un métier cité par une balise de son mot-clé : refus avant de toucher aux fiches', () => {
  const m = reelle();
  try {
    const titre = nom('métier cité');
    const id = creerMetier(m, titre);
    const citante = unePageDuGuide(m);
    citer(m, citante, normalize(titre));
    const e = refusDe(() => ecrire(m, [{ op: 'supprimer', entite: 'metier', cle: { id } }]));
    assert.equal(e.statut, 409);
    assert.doesNotMatch(e.message, /\bR[0-9]+\b/, 'aucun numéro de décision : un refus n’est pas un verrou à ouvrir');
    assert.notEqual(m.db.prepare('SELECT 1 FROM metier WHERE id = ?').get(id), undefined);
  } finally {
    m.db.close();
  }
});

test('une page protégée (R221) reste insupprimable', () => {
  const m = reelle();
  try {
    poserLaCategorieGuide(m);
    const titre = nom('protégée');
    const id = creerPageDesRegles(m, titre);
    const motCleId = ancre(m, 'page', id);
    m.db.prepare('UPDATE mot_cle SET verrou = 1 WHERE id = ?').run(motCleId);
    const e = refusDe(() => supprimerPageDesRegles(m, id));
    assert.equal(e.statut, 409);
    assert.match(e.message, /R221/);
    assert.notEqual(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(id), undefined);
    assert.notEqual(motCle(m, motCleId), undefined);
  } finally {
    m.db.close();
  }
});

test('un mot-clé aussi tenu par un type de sort reste après la suppression de la page (R289)', () => {
  const m = reelle();
  try {
    poserLaCategorieGuide(m);
    const id = creerPageDesRegles(m, nom('tenue'));
    const motCleId = ancre(m, 'page', id);
    const type = m.db.prepare('SELECT id FROM type_sort WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1').get().id;
    m.db.prepare('UPDATE type_sort SET mot_cle_id = ? WHERE id = ?').run(motCleId, type);
    supprimerPageDesRegles(m, id);
    assert.equal(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(id), undefined);
    const mc = motCle(m, motCleId);
    assert.notEqual(mc, undefined, 'le type de sort le tient');
    assert.equal(mc.url, null, 'son adresse ne mène plus nulle part');
    assert.equal(ancre(m, 'type_sort', type), motCleId);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('le forçage de R223 ne supprime jamais une page', () => {
  const m = reelle();
  try {
    poserLaCategorieGuide(m);
    const id = creerPageDesRegles(m, nom('forçage'));
    const motCleId = ancre(m, 'page', id);
    const e = refusDe(() => ecrire(m, [{ op: 'supprimer', entite: 'mot_cle', cle: { id: motCleId }, forcer: true }]));
    assert.equal(e.statut, 409);
    assert.notEqual(m.db.prepare('SELECT 1 FROM page WHERE id = ?').get(id), undefined);
    assert.notEqual(motCle(m, motCleId), undefined);
  } finally {
    m.db.close();
  }
});

test('un lot qui supprime un sort retire son mot-clé, sauf s’il est cité', () => {
  const m = petite((db) => {
    const magie = poserMagie(db, 'magies/zephyrion', nom('magie'));
    const [libre, cite] = ['libre', 'cité'].map((s) => poserSort(db, magie, nom(`sort ${s}`)));
    const motsCles = [libre, cite].map((id) => {
      const mc = poserMotCle(db, { libelle: db.prepare('SELECT nom FROM sort WHERE id = ?').get(id).nom, url: adresseDuSort(id), categories: ['Sort'] });
      db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(mc, id);
      return mc;
    });
    db.prepare("UPDATE sort SET effets = ? WHERE id = ?").run(`Voir {{${normalize(nom('sort cité'))}}}.`, libre);
    for (const id of [libre, cite]) db.prepare('DELETE FROM sort_type WHERE sort_id = ?').run(id);
    return { libre, cite, motsCles };
  });
  try {
    const { libre, cite, motsCles: [motCleLibre, motCleCite] } = m.monde;
    // l'opération d'un lot, seule : ces sorts d'essai n'ont pas les colonnes qu'exigent les contrôles du contenu
    const supprimer = (id) => appliquerUnLot(m.db, {
      titre: 'Essai', nature: 'decision', decision: 'R309',
      travail: (hote) => {
        hote.executer({ op: 'ecrire_supprimer', table: 'sort', cle: { id } });
        hote.suivreLesElements();
      },
    });
    const e = refusDe(() => supprimer(cite));
    assert.equal(e.statut, 409);
    assert.doesNotMatch(e.message, /\bR[0-9]+\b/, 'un refus du suivi n’est jamais un verrou à ouvrir');
    assert.ok(e.details.citations.length);
    assert.notEqual(m.db.prepare('SELECT 1 FROM sort WHERE id = ?').get(cite), undefined);
    supprimer(libre);
    assert.equal(m.db.prepare('SELECT 1 FROM sort WHERE id = ?').get(libre), undefined);
    assert.equal(motCle(m, motCleLibre), undefined);
    assert.notEqual(motCle(m, motCleCite), undefined);
  } finally {
    m.db.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Annuler un lot qui a supprimé un élément et son mot-clé (R291) : un seul dépôt, chaque scénario part d'une copie de la base juste après le lot
// ---------------------------------------------------------------------------------------------------------------------------------------------
const FILLES_D_UN_SORT = ['sort_type', 'sort_mode', 'sort_bonus_maitrise', 'sort_etat'];
const cleDeLaLigne = (db, table, ligne) => Object.fromEntries(db.prepare(`PRAGMA table_info("${table}")`).all().filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => [c.name, ligne[c.name]]));

/** Le premier sort que seules ses lignes de détail citent : il se retire par un lot sans toucher à rien d'autre. */
function unSortSansCitation(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE '%VIRTUAL%'").all().map((t) => t.name);
  const citantes = tables.flatMap((t) => db.prepare(`PRAGMA foreign_key_list("${t}")`).all().filter((f) => f.table === 'sort' && !FILLES_D_UN_SORT.includes(t))
    .map((f) => `NOT EXISTS (SELECT 1 FROM "${t}" x WHERE x."${f.from}" = s.id)`));
  const sansNote = "NOT EXISTS (SELECT 1 FROM note_cellule x WHERE x.entite_table = 'sort' AND x.entite_id = s.id)";
  const nomLibre = 'lower(s.nom) NOT IN (SELECT lower(libelle) FROM mot_cle)';
  return db.prepare(`SELECT s.id, s.nom FROM sort s WHERE s.mot_cle_id IS NULL AND ${[...citantes, sansNote, nomLibre].join(' AND ')} ORDER BY s.id LIMIT 1`).get();
}
const entiteDuSort = (db, id) => db.prepare("SELECT * FROM page_entite WHERE entite_table = 'sort' AND entite_id = ?").all(id);
const retraitDe = (db, table, ligne) => ({ table, cle: cleDeLaLigne(db, table, ligne), operation: 'supprimer', avant: { ...ligne } });
const retraitDuMetier = (db, id) => retraitDe(db, 'metier', db.prepare('SELECT * FROM metier WHERE id = ?').get(id));
/** Retirer un sort : ses lignes de détail, puis lui. */
const retraitDuSort = (db, id) => [
  ...FILLES_D_UN_SORT.flatMap((t) => db.prepare(`SELECT * FROM ${t} WHERE sort_id = ?`).all(id).map((l) => retraitDe(db, t, l))),
  ...entiteDuSort(db, id).map((l) => retraitDe(db, 'page_entite', l)),
  retraitDe(db, 'sort', db.prepare('SELECT * FROM sort WHERE id = ?').get(id)),
];

/** Ce que le lot retire, ligne par ligne : ce que l'annulation doit remettre à l'identique. */
function photo(db, s) {
  const toutes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
  return {
    page: toutes('SELECT * FROM page WHERE id = ?', s.metier),
    metier: toutes('SELECT * FROM metier WHERE id = ?', s.metier),
    sort: toutes('SELECT * FROM sort WHERE id = ?', s.sort),
    entiteDuSort: entiteDuSort(db, s.sort).map((l) => ({ ...l })),
    fillesDuSort: FILLES_D_UN_SORT.map((t) => toutes(`SELECT * FROM ${t} WHERE sort_id = ? ORDER BY 1, 2`, s.sort)),
    motsCles: toutes('SELECT * FROM mot_cle WHERE id IN (?, ?) ORDER BY id', s.motCleMetier, s.motCleSort),
    categories: toutes('SELECT * FROM mot_cle_categorie WHERE mot_cle_id IN (?, ?) ORDER BY 1, 2', s.motCleMetier, s.motCleSort),
  };
}

let suppression = null;
/** La base juste après un lot qui a retiré un métier (sa page) et un sort, chacun avec son mot-clé. */
async function supprimesParUnLot() {
  if (suppression) return suppression;
  const m = reelle();
  m.base = () => m.db;
  m.dossier = join(racine, `essais${(n += 1)}`);
  try {
    const metier = creerMetier(m, nom('métier retiré'));
    // son nom reste le sien : le tableau de sa page de magie le cite, un renommage en SQL le perdrait
    const { id: sort, nom: titreDuSort } = unSortSansCitation(m.db);
    const type = m.db.prepare('SELECT libelle FROM categorie_mot_cle ORDER BY id LIMIT 1').get().libelle;
    const motCleSort = poserMotCle(m.db, { libelle: titreDuSort, url: adresseDuSort(sort), categories: [type] });
    m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(motCleSort, sort);
    recalculerLesCles(m.db);
    const ids = { metier, sort, motCleMetier: ancre(m, 'page', metier), motCleSort };
    const avant = photo(m.db, ids);
    const problemes = controlerLeContenu(m.db).problemes;
    const applique = await deposerLeLot(m, [...retraitDuSort(m.db, sort), retraitDuMetier(m.db, metier)]);
    assert.equal(motCle(m, ids.motCleMetier), undefined);
    assert.equal(motCle(m, motCleSort), undefined);
    const copie = join(racine, `apres-le-lot${(n += 1)}.db`);
    m.db.exec(`VACUUM INTO '${copie.replaceAll("'", "''")}'`);
    suppression = { ...ids, avant, problemes, lot: applique.id, copie };
    return suppression;
  } finally {
    m.db.close();
  }
}

function copieApresLeLot(s) {
  const dossier = join(racine, `c${(n += 1)}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'vivante.db');
  copyFileSync(s.copie, chemin);
  return { db: ouvrirBaseVivante(chemin) };
}

/** Ce qu'une annulation partielle ne doit jamais laisser : un élément sans le mot-clé de son ancre, un mot-clé sans son élément ou sans catégorie, une clé étrangère rompue. */
function incoherences(db, s) {
  const fautes = db.prepare('PRAGMA foreign_key_check').all().map((f) => `clé étrangère rompue : ${f.table} → ${f.parent}`);
  for (const [table, id, k] of [['page', s.metier, s.motCleMetier], ['sort', s.sort, s.motCleSort]]) {
    const element = db.prepare(`SELECT mot_cle_id AS a FROM "${table}" WHERE id = ?`).get(id);
    const present = db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(k);
    if (element && !present) fautes.push(`${table} remis sans son mot-clé`);
    if (present && !element) fautes.push(`mot-clé remis sans ${table}`);
    if (element && present && element.a !== k) fautes.push(`${table} : ancre perdue`);
    if (present && !db.prepare('SELECT 1 FROM mot_cle_categorie WHERE mot_cle_id = ?').get(k)) fautes.push(`mot-clé de ${table} sans catégorie`);
  }
  return fautes;
}

test('R291 : annuler un lot qui a supprimé une page, un sort et leurs mots-clés remet tout à l’identique ; le mot-clé suit de nouveau son élément', async () => {
  const s = await supprimesParUnLot();
  const m = copieApresLeLot(s);
  try {
    // l'aperçu dit la même chose que le clic : un problème d'avant le lot qui revient avec sa ligne ne refuse pas l'annulation
    const apercu = await previsualiserLAnnulation(() => m.db, s.lot, { enArrierePlan: false, dossier: join(racine, `essais${(n += 1)}`) });
    assert.equal(apercu.verdict, 'applicable', JSON.stringify(apercu.problemes_nouveaux));
    annuler(m.db, s.lot);
    assert.deepEqual(photo(m.db, s), s.avant);
    // triés : une ligne remise reprend sa place à la fin de sa table, ses problèmes se lisent plus loin
    assert.deepEqual([...controlerLeContenu(m.db).problemes].sort(), [...s.problemes].sort(), 'les contrôles du contenu');
    clesJustes(m);
    const [titrePage, titreSort] = [nom('métier revenu'), nom('sort revenu')];
    ecrire(m, [{ op: 'modifier', table: 'metier', cle: { id: s.metier }, valeurs: { nom: titrePage } }, { op: 'modifier', table: 'sort', cle: { id: s.sort }, valeurs: { nom: titreSort } }]);
    assert.equal(motCle(m, s.motCleMetier).libelle, titrePage);
    assert.equal(motCle(m, s.motCleSort).libelle, titreSort);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('R291 : aucune annulation d’une seule ligne de ce lot ne sépare un élément de son mot-clé', async () => {
  const s = await supprimesParUnLot();
  const lecture = copieApresLeLot(s);
  const lignes = lire(lecture.db, s.lot).lignes;
  lecture.db.close();
  assert.ok(lignes.length > 4, 'le lot a plusieurs lignes');
  const essayees = new Set();
  let remises = 0;
  for (const { n: numero, annulable_seule: seule } of lignes) {
    if (!seule || essayees.has(numero)) continue;
    const m = copieApresLeLot(s);
    try {
      // un refus des contrôles du contenu n'écrit rien : l'état reste celui d'après le lot
      try {
        annulerUneLigne(m.db, s.lot, numero);
        remises += 1;
        const bilan = JSON.parse(m.db.prepare('SELECT bilan FROM lot_de_changements WHERE id = ?').get(s.lot).bilan);
        for (const k of Object.keys(bilan.lignes_annulees)) essayees.add(Number(k));
      } catch (e) {
        assert.ok(e instanceof ErreurEdition, String(e));
      }
      assert.deepEqual(incoherences(m.db, s), [], `après la ligne ${numero}`);
    } finally {
      m.db.close();
    }
  }
  assert.ok(remises >= 1, 'une ligne au moins s’annule');
});

test('R291 : annuler la ligne d’un mot-clé retiré remet son élément, ses catégories et l’ancre', async () => {
  const s = await supprimesParUnLot();
  const m = copieApresLeLot(s);
  try {
    const lignes = lire(m.db, s.lot).lignes;
    const ligne = lignes.find((l) => l.table === 'Mot-clé' && String(l.ligne).includes('métier retiré'));
    assert.ok(ligne, JSON.stringify(lignes.map((l) => [l.n, l.table, l.ligne])));
    assert.equal(ligne.annulable_seule, true, ligne.motif);
    annulerUneLigne(m.db, s.lot, ligne.n);
    assert.equal(ancre(m, 'page', s.metier), s.motCleMetier);
    assert.deepEqual({ ...motCle(m, s.motCleMetier) }, s.avant.motsCles.find((x) => x.id === s.motCleMetier));
    assert.deepEqual(categoriesDe(m, s.motCleMetier), s.avant.categories.filter((c) => c.mot_cle_id === s.motCleMetier).map((c) => c.categorie_id));
    assert.equal(motCle(m, s.motCleSort), undefined, 'l’autre élément du lot reste retiré');
  } finally {
    m.db.close();
  }
});

// Un second lot : une page au mot-clé gardé (R289), un mot-clé tenu par une page et un sort tous deux retirés, et la correction d'un défaut du contenu.
/** Un défaut que le service laisse écrire et que les contrôles voient : un sort rattaché à une autre page que la sienne. Rend l'opération du lot qui le corrige. */
function fausserUneEntite(db, sauf = '') {
  const { entite_id: id, page_id: juste } = db.prepare("SELECT entite_id, page_id FROM page_entite WHERE entite_table = 'sort' AND principale = 0 AND entite_id <> ? ORDER BY entite_id LIMIT 1").get(sauf);
  const fausse = db.prepare('SELECT id FROM page WHERE id <> ? ORDER BY id LIMIT 1').get(juste).id;
  db.prepare("UPDATE page_entite SET page_id = ? WHERE entite_table = 'sort' AND entite_id = ?").run(fausse, id);
  return { id, juste, fausse, correction: { table: 'page_entite', cle: { entite_table: 'sort', entite_id: id }, operation: 'modifier', avant: { page_id: fausse }, apres: { page_id: juste } } };
}
const pageDeLEntite = (m, id) => m.db.prepare("SELECT page_id AS p FROM page_entite WHERE entite_table = 'sort' AND entite_id = ?").get(id).p;
const etatDuLot = (m, id) => m.db.prepare('SELECT etat FROM lot_de_changements WHERE id = ?').get(id).etat;
const apercuDe = (m, lotId, options = {}) => previsualiserLAnnulation(() => m.db, lotId, { enArrierePlan: false, dossier: join(racine, `essais${(n += 1)}`), ...options });

let groupes = null;
async function groupesParUnLot() {
  if (groupes) return groupes;
  const m = reelle();
  m.base = () => m.db;
  m.dossier = join(racine, `essais${(n += 1)}`);
  try {
    const garde = creerMetier(m, nom('métier au mot-clé gardé'));
    const motCleGarde = ancre(m, 'page', garde);
    const typeDeSort = m.db.prepare('SELECT id FROM type_sort WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1').get().id;
    m.db.prepare('UPDATE type_sort SET mot_cle_id = ? WHERE id = ?').run(motCleGarde, typeDeSort);
    const double = creerMetier(m, nom('métier au mot-clé double'));
    const motCleDouble = ancre(m, 'page', double);
    const { id: sortDouble } = unSortSansCitation(m.db);
    m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(motCleDouble, sortDouble);
    const faute = fausserUneEntite(m.db, sortDouble);
    // la page d'abord : son mot-clé reste tenu par le sort (son adresse se vide), puis il part avec le sort
    const applique = await deposerLeLot(m, [faute.correction, retraitDuMetier(m.db, garde), retraitDuMetier(m.db, double), ...retraitDuSort(m.db, sortDouble)]);
    assert.equal(motCle(m, motCleGarde).url, null, 'le type de sort garde le mot-clé, son adresse se vide');
    assert.equal(motCle(m, motCleDouble), undefined);
    const copie = join(racine, `apres-le-lot${(n += 1)}.db`);
    m.db.exec(`VACUUM INTO '${copie.replaceAll("'", "''")}'`);
    const lotDuJournal = m.db.prepare('SELECT lot_id FROM lot_de_changements WHERE id = ?').get(applique.id).lot_id;
    groupes = { garde, motCleGarde, double, motCleDouble, sortDouble, faute, lot: applique.id, lotDuJournal, copie };
    return groupes;
  } finally {
    m.db.close();
  }
}
const rangDe = (m, s, trouver) => netsDuLot(m.db, s.lotDuJournal).find(trouver).rang;

for (const [quoi, trouver] of [
  ['la page', (s) => (x) => x.table === 'page' && x.cle.id === s.garde],
  ['le mot-clé', (s) => (x) => x.table === 'mot_cle' && x.cle.id === s.motCleGarde],
]) {
  test(`R289 : annuler la ligne de ${quoi} remet ensemble la page et l’adresse de son mot-clé gardé`, async () => {
    const s = await groupesParUnLot();
    const m = copieApresLeLot(s);
    try {
      annulerUneLigne(m.db, s.lot, rangDe(m, s, trouver(s)));
      assert.equal(ancre(m, 'page', s.garde), s.motCleGarde);
      assert.equal(motCle(m, s.motCleGarde).url, adresseDeLaPage(s.garde));
    } finally {
      m.db.close();
    }
  });
}

test('un mot-clé tenu par deux éléments retirés : un seul groupe, quelle que soit la ligne annulée', async () => {
  const s = await groupesParUnLot();
  const m = copieApresLeLot(s);
  try {
    const nets = netsDuLot(m.db, s.lotDuJournal);
    const k = s.motCleDouble;
    const duGroupe = (x) => (x.table === 'page' && x.cle.id === s.double) || (x.table === 'sort' && x.cle.id === s.sortDouble) || (x.table === 'mot_cle' && x.cle.id === k)
      || (x.table.startsWith('mot_cle_') && x.origine?.mot_cle_id === k);
    const attendu = nets.filter(duGroupe).map((x) => x.rang).sort((a, b) => a - b);
    // l'aperçu liste ce que la ligne emporte : les contrôles refusent ensuite ce sort sans sa `page_entite`, hors du groupe, sans rien écrire
    for (const table of ['page', 'sort', 'mot_cle']) {
      const numero = nets.find((x) => x.table === table && duGroupe(x)).rang;
      const apercu = await apercuDe(m, s.lot, { ligne: numero });
      assert.deepEqual(apercu.operations.map((o) => o.rang_du_lot).sort((a, b) => a - b), attendu, `la ligne de ${table}`);
    }
  } finally {
    m.db.close();
  }
});

test('R291 : annuler ce lot entier remet les deux éléments, le mot-clé partagé, l’adresse du mot-clé gardé ; le défaut d’avant revient avec eux', async () => {
  const s = await groupesParUnLot();
  const m = copieApresLeLot(s);
  try {
    annuler(m.db, s.lot);
    assert.equal(ancre(m, 'page', s.garde), s.motCleGarde);
    assert.equal(motCle(m, s.motCleGarde).url, adresseDeLaPage(s.garde));
    assert.equal(ancre(m, 'page', s.double), s.motCleDouble);
    assert.equal(ancre(m, 'sort', s.sortDouble), s.motCleDouble);
    assert.ok(categoriesDe(m, s.motCleDouble).length > 0, 'ses catégories reviennent');
    assert.deepEqual(m.db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(pageDeLEntite(m, s.faute.id), s.faute.fausse);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('R291 : dans un lot qui retire un élément, une correction annulée seule reste refusée si elle ramène son défaut', async () => {
  const s = await groupesParUnLot();
  const m = copieApresLeLot(s);
  try {
    const numero = rangDe(m, s, (x) => x.table === 'page_entite' && x.cle.entite_id === s.faute.id);
    const apercu = await apercuDe(m, s.lot, { ligne: numero });
    assert.equal(apercu.verdict, 'refusee');
    assert.ok(apercu.problemes_nouveaux.length > 0, 'refusée par les contrôles du contenu');
    const e = refusDe(() => annulerUneLigne(m.db, s.lot, numero));
    assert.equal(e.statut, 409);
    assert.match(e.message, /contrôles du contenu/);
    assert.equal(pageDeLEntite(m, s.faute.id), s.faute.juste, 'rien n’est écrit');
    assert.equal(etatDuLot(m, s.lot), 'applique');
  } finally {
    m.db.close();
  }
});

test('R291 : un lot sans suppression qui a corrigé un problème du contenu ne s’annule pas', async () => {
  const m = reelle();
  m.base = () => m.db;
  m.dossier = join(racine, `essais${(n += 1)}`);
  try {
    const faute = fausserUneEntite(m.db);
    const applique = await deposerLeLot(m, [faute.correction]);
    const apercu = await apercuDe(m, applique.id);
    assert.equal(apercu.verdict, 'refusee');
    assert.ok(apercu.problemes_nouveaux.length > 0, 'refusée par les contrôles du contenu');
    const e = refusDe(() => annuler(m.db, applique.id));
    assert.equal(e.statut, 409);
    assert.match(e.message, /contrôles du contenu/);
    assert.equal(pageDeLEntite(m, faute.id), faute.juste, 'rien n’est écrit');
    assert.equal(etatDuLot(m, applique.id), 'applique');
  } finally {
    m.db.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les clés en fin de lot : un retrait ne les juge pas entre deux opérations ; un échange de noms n'empêche pas les autres mots-clés de suivre
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('un lot qui reclasse un homonyme et retire un élément entre les deux passe : la règle ne juge que l’état final', async () => {
  const m = reelle();
  m.base = () => m.db;
  m.dossier = join(racine, `essais${(n += 1)}`);
  try {
    const [c1, c2, c3] = m.db.prepare('SELECT id FROM categorie_mot_cle ORDER BY id LIMIT 3').all().map((c) => c.id);
    const titre = nom('homonyme reclassé');
    const [a, b] = [c1, c2].map((c) => ecrire(m, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: titre, categories: [c] } }]).crees[0].id);
    const metier = creerMetier(m, nom('métier entre deux'));
    const motCleDuMetier = ancre(m, 'page', metier);
    const categorieDe = (categorie_id) => ({ mot_cle_id: a, categorie_id });
    await deposerLeLot(m, [
      { table: 'mot_cle_categorie', cle: categorieDe(c1), operation: 'supprimer', avant: categorieDe(c1) },
      retraitDuMetier(m.db, metier),
      { table: 'mot_cle_categorie', cle: categorieDe(c3), operation: 'inserer', apres: categorieDe(c3) },
    ]);
    assert.equal(m.db.prepare('SELECT 1 FROM metier WHERE id = ?').get(metier), undefined);
    assert.equal(motCle(m, motCleDuMetier), undefined);
    assert.deepEqual(categoriesDe(m, a), [c3]);
    assert.deepEqual(categoriesDe(m, b), [c2]);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

/** Trois sorts de magies différentes, de noms différents, chacun ancré à son mot-clé (posés en SQL : le service les renomme ensuite). */
function troisSortsAncres(m) {
  const vus = new Set();
  const sorts = m.db.prepare('SELECT min(id) AS id, nom, nom_cle, magie_id FROM sort WHERE lower(nom) NOT IN (SELECT lower(libelle) FROM mot_cle) GROUP BY magie_id ORDER BY magie_id').all()
    .filter((s) => !vus.has(s.nom_cle) && vus.add(s.nom_cle)).slice(0, 3).map((s) => ({ ...s }));
  assert.equal(sorts.length, 3);
  const type = m.db.prepare('SELECT libelle FROM categorie_mot_cle ORDER BY id LIMIT 1').get().libelle;
  for (const s of sorts) {
    s.motCle = poserMotCle(m.db, { libelle: s.nom, url: adresseDuSort(s.id), categories: [type] });
    m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(s.motCle, s.id);
  }
  recalculerLesCles(m.db);
  return sorts;
}
const nomDuSort = (m, id) => m.db.prepare('SELECT nom FROM sort WHERE id = ?').get(id).nom;

test('un échange de noms : ces deux mots-clés gardent leur nom, les autres renommages suivent', () => {
  const m = reelle();
  try {
    const [a, b, c] = troisSortsAncres(m);
    const neuf = nom('sort neuf');
    ecrire(m, [
      { op: 'modifier', table: 'sort', cle: { id: a.id }, valeurs: { nom: b.nom } },
      { op: 'modifier', table: 'sort', cle: { id: b.id }, valeurs: { nom: a.nom } },
      { op: 'modifier', table: 'sort', cle: { id: c.id }, valeurs: { nom: neuf } },
    ]);
    assert.deepEqual([a, b, c].map((s) => nomDuSort(m, s.id)), [b.nom, a.nom, neuf], 'les sorts sont renommés');
    assert.equal(motCle(m, c.motCle).libelle, neuf, 'le troisième suit');
    assert.equal(motCle(m, c.motCle).cle, normalize(neuf));
    assert.equal(motCle(m, a.motCle).libelle, a.nom, 'le cycle est écarté');
    assert.equal(motCle(m, b.motCle).libelle, b.nom, 'le cycle est écarté');
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('un échange de noms dans un lot qui renomme aussi une magie : le lot passe, les autres mots-clés suivent', async () => {
  const m = reelle();
  m.base = () => m.db;
  m.dossier = join(racine, `essais${(n += 1)}`);
  try {
    const [a, b, c] = troisSortsAncres(m);
    const neuf = nom('sort neuf du lot');
    const magie = { ...m.db.prepare('SELECT id, nom, nom_cle FROM magie WHERE id = ?').get(c.magie_id) };
    const nouvelle = nom('magie du lot');
    const renommer = (s, vers) => ({ table: 'sort', cle: { id: s.id }, operation: 'modifier', avant: { nom: s.nom }, apres: { nom: vers } });
    await deposerLeLot(m, [
      renommer(a, b.nom), renommer(b, a.nom), renommer(c, neuf),
      { table: 'magie', cle: { id: magie.id }, operation: 'modifier', avant: { nom: magie.nom, nom_cle: magie.nom_cle }, apres: { nom: nouvelle, nom_cle: normalize(nouvelle) } },
    ]);
    assert.equal(m.db.prepare('SELECT nom FROM magie WHERE id = ?').get(magie.id).nom, nouvelle);
    assert.equal(motCle(m, c.motCle).libelle, neuf);
    assert.equal(motCle(m, a.motCle).libelle, a.nom);
    assert.equal(motCle(m, b.motCle).libelle, b.nom);
    clesJustes(m);
  } finally {
    m.db.close();
  }
});

test('deux magies qui échangent leur nom croisent les clés de leurs sorts : sans renommage à écarter, le refus remonte, sans numéro de décision', () => {
  const m = reelle();
  try {
    const [s1, s2] = m.db.prepare('SELECT min(id) AS id, magie_id FROM sort GROUP BY magie_id ORDER BY magie_id LIMIT 2').all().map((s) => ({ ...s }));
    const titre = nom('sort des deux magies');
    const type = m.db.prepare('SELECT libelle FROM categorie_mot_cle ORDER BY id LIMIT 1').get().libelle;
    for (const s of [s1, s2]) {
      m.db.prepare('UPDATE sort SET nom = ? WHERE id = ?').run(titre, s.id);
      const k = poserMotCle(m.db, { libelle: titre, url: adresseDuSort(s.id), categories: [type] });
      m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = ?').run(k, s.id);
    }
    recalculerLesCles(m.db);
    const [m1, m2] = [s1, s2].map((s) => ({ ...m.db.prepare('SELECT id, nom, nom_cle FROM magie WHERE id = ?').get(s.magie_id) }));
    const provisoire = nom('magie de passage');
    const poser = (id, valeurs) => ({ op: 'ecrire_modifier', table: 'magie', cle: { id }, valeurs });
    const e = refusDe(() => appliquerUnLot(m.db, {
      titre: 'Essai', nature: 'decision', decision: 'R309',
      travail: (hote) => {
        hote.executer(poser(m1.id, { nom: provisoire, nom_cle: normalize(provisoire) }));
        hote.executer(poser(m2.id, { nom: m1.nom, nom_cle: m1.nom_cle }));
        hote.executer(poser(m1.id, { nom: m2.nom, nom_cle: m2.nom_cle }));
        hote.suivreLesElements();
      },
    }));
    assert.equal(e.statut, 409);
    assert.match(e.message, /s’échangeraient/);
    assert.doesNotMatch(e.message, /\bR[0-9]+\b/, 'un refus du suivi n’est jamais un verrou à ouvrir');
    assert.equal(m.db.prepare('SELECT nom FROM magie WHERE id = ?').get(m1.id).nom, m1.nom, 'rien n’est écrit');
  } finally {
    m.db.close();
  }
});
