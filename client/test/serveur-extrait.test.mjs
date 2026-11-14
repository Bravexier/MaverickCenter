// L'extrait du contenu du site de dev (serveur/extrait.mjs, serveur/empreintes.mjs ; lot 5 du chantier de la base de dev, R274, R275 (3), garde-fous 9 et
// 10 de docs/chantier-base-de-dev.md) : un fichier neuf, sans fiche, sans compte, sans journal, avec le contenu du site et ses modifications en attente
// versées dans l'historique ; refait une fois par changement.
//   node --test test/serveur-extrait.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { empreinteDeLaTable, empreintesDuContenu } from '../serveur/empreintes.mjs';
import { routeNormalisee, ROUTE_INCONNUE } from '../serveur/metriques.mjs';
import { cleDeChangement, creerExtrait, fabriquerExtrait, lireMeta } from '../serveur/extrait.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { CLASSES_DE_TABLES, TABLES_PROPRES_AU_SITE, classeDeLaTable } from '../src/lib/tables-de-la-base.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { SENTINELLES, marquesDesFiches, poserDesFiches } from './aide-fiches-sentinelles.mjs';

const REGLES = cheminBase({ sansExemples: false });
const sha = (octets) => createHash('sha256').update(octets).digest('hex');

/** Une base vivante neuve, avec ses fiches, son compte et son groupe sentinelles. Rend { dossier, db, poses, regles }. */
function nouvelleBase(t, { fiches = true } = {}) {
  const dossier = dossierTemporaire('extrait', { t });
  const regles = join(dossier, 'regles.db');
  copyFileSync(REGLES, regles);
  const base = join(dossier, 'db');
  preparerBaseVivante({ regles, dossier: base });
  const db = ouvrirBaseVivante(join(base, 'vivante.db'));
  t.after(() => db.close());
  return { dossier, base, db, regles, poses: fiches ? poserDesFiches(db) : null };
}

/** Un lot d'édition qui crée un métier (le contenu change, et le journal garde un lot en attente) ; rend l'identifiant du lot et du métier. */
function creerUnMetier(db, nom, auteurId = null) {
  const r = enregistrer(db, { page: 'metiers/', operations: [{ op: 'creer', entite: 'metier', valeurs: { nom, description: 'Un métier d’essai.', bonus_brut: '+1 INI' } }] }, { auteurId });
  return { lot: r.lot, metier: r.crees[0].id };
}

test('aucune trace d’une fiche : un fichier neuf, les tables propres au site vides, et ni nom de fiche, de compte ou de groupe dans un seul octet', (t) => {
  const { base, db, poses } = nouvelleBase(t);
  // le journal garde l'auteur d'un lot : l'extrait ne doit pas le porter
  creerUnMetier(db, 'Essai de l’auteur', SENTINELLES.idCompte);
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification_lot WHERE auteur_id IS NOT NULL').get().n, 1);
  assert.ok(db.prepare('SELECT count(*) AS n FROM personnage').get().n >= poses.fiches, 'la base vivante porte bien les fiches');

  const sortie = join(base, 'sortie.db');
  const meta = fabriquerExtrait({ source: join(base, 'vivante.db'), destination: sortie, version: '1.2.3' });
  const octets = readFileSync(sortie);
  for (const marque of marquesDesFiches(poses)) assert.ok(!octets.includes(Buffer.from(marque)), `« ${marque} » ne doit figurer dans aucun octet de l’extrait`);

  const extrait = new DatabaseSync(sortie, { readOnly: true });
  try {
    for (const t of TABLES_PROPRES_AU_SITE) assert.equal(extrait.prepare(`SELECT count(*) AS n FROM "${t}"`).get().n, 0, `${t} est vide`);
    const tables = extrait.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((x) => x.name);
    for (const nom of tables) {
      if (classeDeLaTable(nom) === null) assert.fail(`${nom} : une table que le classement ne connaît pas`);
      if (classeDeLaTable(nom) === CLASSES_DE_TABLES.PROPRE_AU_SITE) assert.equal(extrait.prepare(`SELECT count(*) AS n FROM "${nom}"`).get().n, 0, nom);
    }
    assert.equal(extrait.prepare('PRAGMA freelist_count').get().freelist_count, 0, 'un fichier neuf : aucune page libre héritée');
    assert.deepEqual(extrait.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(extrait.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    // la vue de méta dit d'où vient le fichier ; ce n'est pas une table
    const vue = extrait.prepare('SELECT * FROM extrait_meta').get();
    assert.deepEqual({ format: vue.format, fabrique_le: vue.fabrique_le, version: vue.version_du_site, empreinte: vue.empreinte },
      { format: meta.format, fabrique_le: meta.fabrique_le, version: '1.2.3', empreinte: meta.empreinte });
    assert.match(meta.fabrique_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, 'une date UTC à la seconde');
    assert.equal(extrait.prepare("SELECT type FROM sqlite_master WHERE name = 'extrait_meta'").get().type, 'view');
  } finally {
    extrait.close();
  }
  assert.equal(meta.propres_au_site, TABLES_PROPRES_AU_SITE.length);
  assert.deepEqual(meta.non_classees, []);
  assert.equal(meta.cles_etrangeres_rompues, 0);
});

test('le contenu est recopié depuis la base vivante, modifications du site comprises ; les calculées en sont une copie, la recherche plein texte marche', (t) => {
  const { base, db } = nouvelleBase(t, { fiches: false });
  const { metier } = creerUnMetier(db, 'Essai du contenu');
  const sortie = join(base, 'sortie.db');
  const meta = fabriquerExtrait({ source: join(base, 'vivante.db'), destination: sortie });
  const extrait = new DatabaseSync(sortie, { readOnly: true });
  try {
    assert.equal(extrait.prepare('SELECT nom FROM metier WHERE id = ?').get(metier).nom, 'Essai du contenu', 'la création faite sur le site y est');
    for (const table of ['page', 'metier', 'mot_cle']) {
      assert.equal(extrait.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, table);
    }
    for (const [table, lignes] of Object.entries(meta.calculees)) {
      assert.equal(extrait.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, lignes, table);
      assert.equal(lignes, db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, `${table} : la copie de la base vivante`);
    }
    assert.deepEqual(Object.keys(meta.calculees).sort(), ['entite_fts', 'lien', 'lien_candidat', 'page_fts']);
    const n = extrait.prepare('SELECT count(*) AS n FROM page_fts').get().n;
    assert.ok(n > 0);
    const visee = extrait.prepare('SELECT page_id, titre FROM page_fts LIMIT 1').get();
    const mot = String(visee.titre).split(/\s+/).find((m) => /^[a-zà-ÿ]{4,}$/i.test(m));
    if (mot) assert.ok(extrait.prepare('SELECT count(*) AS n FROM page_fts WHERE page_fts MATCH ?').get(`"${mot}"`).n >= 1, 'la recherche plein texte de l’extrait répond');
    // vues et index du schéma sont là
    for (const type of ['index', 'view']) {
      assert.ok(extrait.prepare('SELECT count(*) AS n FROM sqlite_master WHERE type = ?').get(type).n >= db.prepare('SELECT count(*) AS n FROM sqlite_master WHERE type = ?').get(type).n);
    }
    assert.equal(extrait.prepare('PRAGMA user_version').get().user_version, db.prepare('PRAGMA user_version').get().user_version);
  } finally {
    extrait.close();
  }
});

test('garde-fou 10 : les modifications en attente sont versées dans l’historique, sans leur auteur, version NULL ; un lot en conflit ne l’est pas ; le journal reste vide', (t) => {
  const { base, db } = nouvelleBase(t); // le compte de l'auteur du lot existe
  const { lot, metier } = creerUnMetier(db, 'Essai de l’historique', SENTINELLES.idCompte);
  // un lot en conflit : il ne se verse pas (même règle que db:appliquer-edition)
  db.prepare("INSERT INTO modification_lot (id, fait_le, page_id, resume) VALUES ('lot-en-conflit', '2026-11-01T00:00:00Z', 'metiers/', 'Un lot en conflit')").run();
  db.prepare(`INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail)
    VALUES ('lot-en-conflit', 1, 'metier', '{"id":"metiers/ailleurs"}', 'modifier', '{"bonus_brut":"a"}', '{"bonus_brut":"b"}', 'conflit', 'les règles ont changé')`).run();
  const avant = db.prepare('SELECT count(*) AS n FROM historique_modification').get().n;
  const enAttente = db.prepare("SELECT count(*) AS n FROM modification WHERE lot_id = ?").get(lot).n;
  assert.ok(enAttente >= 1);

  const sortie = join(base, 'sortie.db');
  const meta = fabriquerExtrait({ source: join(base, 'vivante.db'), destination: sortie });
  const extrait = new DatabaseSync(sortie, { readOnly: true });
  try {
    const versees = extrait.prepare('SELECT * FROM historique_modification WHERE lot_id = ? ORDER BY rang').all(lot);
    assert.equal(versees.length, enAttente);
    assert.ok(versees.every((h) => h.version === null), 'rapatriées à la main : aucune version ne les a livrées');
    assert.ok(versees.some((h) => h.table_nom === 'metier' && JSON.parse(h.cle).id === metier && h.operation === 'inserer'));
    assert.equal(extrait.prepare('SELECT count(*) AS n FROM historique_modification').get().n, avant + enAttente);
    assert.equal(extrait.prepare("SELECT count(*) AS n FROM historique_modification WHERE lot_id = 'lot-en-conflit'").get().n, 0);
    assert.equal(meta.modifications_versees, enAttente);
    // sans auteur : historique_modification n'en a pas, le journal est vide, et l'identifiant du compte n'est nulle part
    assert.ok(!extrait.prepare('PRAGMA table_info(historique_modification)').all().some((c) => /auteur/.test(c.name)));
    for (const table of ['modification_lot', 'modification', 'note_version_brouillon']) assert.equal(extrait.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n, 0, table);
  } finally {
    extrait.close();
  }
  assert.ok(!readFileSync(sortie).includes(Buffer.from(SENTINELLES.idCompte)));
  // la base vivante n'a rien perdu : son journal est intact
  assert.equal(db.prepare('SELECT count(*) AS n FROM modification WHERE lot_id = ?').get(lot).n, enAttente);
  assert.equal(db.prepare('SELECT auteur_id FROM modification_lot WHERE id = ?').get(lot).auteur_id, SENTINELLES.idCompte);
});

test('empreintes : stables malgré l’ordre des lignes et des colonnes et les octets du fichier ; sensibles au type et à la valeur', (t) => {
  const a = new DatabaseSync(':memory:');
  const b = new DatabaseSync(':memory:');
  t.after(() => { a.close(); b.close(); });
  a.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, nom TEXT, val REAL, bin BLOB, rien TEXT); INSERT INTO t VALUES (1, \'un\', 1.5, x\'0102\', NULL), (2, \'deux\', NULL, NULL, \'é\'), (3, \'trois\', 3, x\'\', \'\')');
  // mêmes lignes, autre ordre d'insertion, autre ordre des colonnes, base remplie autrement
  b.exec('CREATE TABLE t (rien TEXT, bin BLOB, id INTEGER PRIMARY KEY, val REAL, nom TEXT); INSERT INTO t (id, nom, val, bin, rien) VALUES (3, \'trois\', 3, x\'\', \'\'), (1, \'un\', 1.5, x\'0102\', NULL), (2, \'deux\', NULL, NULL, \'é\')');
  assert.deepEqual(empreinteDeLaTable(a, 't'), empreinteDeLaTable(b, 't'));
  assert.equal(empreinteDeLaTable(a, 't').lignes, 3);
  b.exec("UPDATE t SET nom = 'trois ' WHERE id = 3");
  assert.notEqual(empreinteDeLaTable(a, 't').empreinte, empreinteDeLaTable(b, 't').empreinte, 'une valeur change');
  // un texte, un entier et un réel ne se confondent pas ; NULL et texte vide non plus
  const types = new DatabaseSync(':memory:');
  t.after(() => types.close());
  const hachage = (valeur) => {
    types.exec('DROP TABLE IF EXISTS u; CREATE TABLE u (v)');
    types.prepare('INSERT INTO u VALUES (?)').run(valeur);
    return empreinteDeLaTable(types, 'u').empreinte;
  };
  assert.equal(new Set([hachage(1), hachage('1'), hachage(1.5), hachage(null), hachage('')]).size, 5);
  // un entier de plus de 53 bits ne perd rien
  assert.notEqual(hachage(9007199254740993n), hachage(9007199254740992n));
  // une table sans clé : l'ordre de saisie ne compte pas
  a.exec('CREATE TABLE sans_cle (x TEXT, y INTEGER); INSERT INTO sans_cle VALUES (\'a\', 2), (\'b\', 1), (\'a\', 1)');
  b.exec('CREATE TABLE sans_cle (y INTEGER, x TEXT); INSERT INTO sans_cle (x, y) VALUES (\'a\', 1), (\'a\', 2), (\'b\', 1)');
  assert.deepEqual(empreinteDeLaTable(a, 'sans_cle'), empreinteDeLaTable(b, 'sans_cle'));
  // un nom de table n'est jamais interpolé sans vérification
  assert.throws(() => empreinteDeLaTable(a, 't"; DROP TABLE t; --'), /identifiant SQL refusé/);
});

test('deux bases au même contenu, octets différents : mêmes empreintes, table par table et globale ; l’extrait a celles de la base vivante', (t) => {
  const { base, db } = nouvelleBase(t, { fiches: false });
  const source = join(base, 'vivante.db');
  // une copie réécrite page par page (VACUUM INTO) : autre fichier, autres octets, même contenu
  const copie = join(base, 'copie.db');
  db.exec(`VACUUM INTO '${copie.replace(/'/g, "''")}'`);
  const sortie = join(base, 'sortie.db');
  const meta = fabriquerExtrait({ source, destination: sortie });
  assert.notEqual(sha(readFileSync(copie)), sha(readFileSync(sortie)));
  const lire = (chemin) => {
    const ouverte = new DatabaseSync(chemin, { readOnly: true });
    try {
      return empreintesDuContenu(ouverte);
    } finally {
      ouverte.close();
    }
  };
  const [vivante, copiee, extrait] = [lire(source), lire(copie), lire(sortie)];
  assert.deepEqual(copiee, vivante);
  assert.equal(extrait.global, vivante.global, 'sans modification en attente, l’extrait a le contenu de la base vivante');
  assert.deepEqual(extrait.tables, vivante.tables);
  assert.equal(meta.empreinte, extrait.global);
  assert.deepEqual(meta.tables, extrait.tables);
  assert.ok(Object.keys(extrait.tables).length > 150);
  assert.ok(!('personnage' in extrait.tables) && !('page_fts' in extrait.tables) && !('lien' in extrait.tables), 'ni fiches, ni calculées dans les empreintes');
  // une modification de contenu change l'empreinte globale et celle de sa table seule
  const { metier } = creerUnMetier(db, 'Essai des empreintes');
  const apres = lire(source);
  assert.notEqual(apres.global, vivante.global);
  const changees = Object.keys(apres.tables).filter((n) => apres.tables[n].empreinte !== vivante.tables[n]?.empreinte);
  assert.ok(changees.includes('metier') && changees.includes('page'), changees.join(', '));
  assert.ok(!changees.includes('race') && !changees.includes('arme'));
  assert.ok(metier);
});

test('clé de changement : bouge avec un lot d’édition, un état de modification et une reconstruction ; jamais avec une fiche', (t) => {
  const { base, db, regles } = nouvelleBase(t, { fiches: false });
  const cle = () => cleDeChangement(db, base);
  const depart = cle();
  assert.equal(cle(), depart, 'stable sans écriture');
  // une fiche (création, modification, suppression) : aucun effet sur le contenu
  const f = enregistrerFiche(db, ficheVide('Une fiche d’essai'));
  assert.equal(cle(), depart);
  enregistrerFiche(db, { ...f.personnage, nom: 'Une fiche modifiée', xp: 500 }, { id: f.personnage.id });
  db.prepare("INSERT INTO utilisateur (id, nom_affichage, cree_le) VALUES ('c', 'C', '2026-10-10T00:00:00Z')").run();
  assert.equal(cle(), depart, 'un compte non plus');
  // un lot d'édition
  const { lot } = creerUnMetier(db, 'Essai de la clé');
  const apresLot = cle();
  assert.notEqual(apresLot, depart);
  // un lot dont une modification change d'état (conflit, intégrée) ou qui est résolu
  db.prepare("UPDATE modification SET etat = 'integree' WHERE lot_id = ?").run(lot);
  const apresEtat = cle();
  assert.notEqual(apresEtat, apresLot);
  db.prepare("UPDATE modification_lot SET resolu_le = '2026-11-02T00:00:00Z', resolu_par = NULL, resolution = '[]' WHERE id = ?").run(lot);
  const apresResolution = cle();
  assert.notEqual(apresResolution, apresEtat);
  // un lot retiré du journal (abandon)
  db.exec('PRAGMA foreign_keys = OFF');
  db.prepare('DELETE FROM modification WHERE lot_id = ?').run(lot);
  db.prepare('DELETE FROM modification_lot WHERE id = ?').run(lot);
  db.exec('PRAGMA foreign_keys = ON');
  assert.notEqual(cle(), apresResolution);
  // une base vivante refaite (de nouvelles règles) : la clé bouge
  const avant = cle();
  const nouvelles = new DatabaseSync(regles);
  nouvelles.exec("UPDATE metier SET description = description || ' (changée)' WHERE id = (SELECT min(id) FROM metier)");
  nouvelles.close();
  const r = preparerBaseVivante({ regles, dossier: base, instant: new Date(Date.now() + 5000) });
  assert.equal(r.refaite, true);
  const rouverte = ouvrirBaseVivante(join(base, 'vivante.db'));
  t.after(() => rouverte.close());
  assert.notEqual(cleDeChangement(rouverte, base), avant);
});

test('le gestionnaire : fabriqué au premier appel, réutilisé tant que rien ne change (même fichier, même date), refait après une modification, pas après une fiche', async (t) => {
  const { base, db } = nouvelleBase(t, { fiches: false });
  const evenements = [];
  const extrait = creerExtrait({ dossier: base, base: () => db, version: () => '4.5.6', enArrierePlan: false, evenement: (type, o) => evenements.push([type, o]) });
  assert.equal(lireMeta(base), null, 'rien de fabriqué avant la demande');
  const premier = await extrait.meta();
  const fabriques = () => evenements.filter(([type, o]) => type === 'extrait' && !o.detail?.erreur).length;
  assert.equal(fabriques(), 1);
  assert.equal(premier.version_du_site, '4.5.6');
  const fichier = statSync(extrait.chemin);
  // des téléchargements sans changement : le même fichier, jamais refabriqué
  const [b, c] = await Promise.all([extrait.meta(), extrait.meta()]);
  assert.deepEqual([b.fabrique_le, c.fabrique_le, b.cle], [premier.fabrique_le, premier.fabrique_le, premier.cle]);
  assert.equal(statSync(extrait.chemin).mtimeMs, fichier.mtimeMs);
  assert.equal(fabriques(), 1);
  // une fiche enregistrée : l'extrait reste celui d'avant
  poserDesFiches(db);
  enregistrerFiche(db, ficheVide('Une autre fiche'));
  assert.equal((await extrait.meta()).cle, premier.cle);
  assert.equal(fabriques(), 1);
  // une modification du site : refait, avec elle
  const { metier } = creerUnMetier(db, 'Essai du gestionnaire');
  const refait = await extrait.meta();
  assert.notEqual(refait.cle, premier.cle);
  assert.equal(fabriques(), 2);
  assert.equal(refait.modifications_versees >= 1, true);
  const { octets } = await extrait.lire();
  assert.equal(sha(octets), refait.fichier.sha256);
  const lu = new DatabaseSync(extrait.chemin, { readOnly: true });
  try {
    assert.ok(lu.prepare('SELECT 1 FROM metier WHERE id = ?').get(metier));
  } finally {
    lu.close();
  }
  // demandes simultanées après un changement : une seule fabrication
  creerUnMetier(db, 'Essai du gestionnaire 2');
  await Promise.all([extrait.meta(), extrait.meta(), extrait.meta()]);
  assert.equal(fabriques(), 3);
});

test('le gestionnaire fabrique dans un fil à part (le service reste libre) et le fichier est le même que celui d’une fabrication directe', async (t) => {
  const { base, db } = nouvelleBase(t, { fiches: false });
  const extrait = creerExtrait({ dossier: base, base: () => db, version: () => '1.0.0' });
  const meta = await extrait.meta();
  assert.equal(meta.fichier.octets, statSync(extrait.chemin).size);
  assert.equal(sha(readFileSync(extrait.chemin)), meta.fichier.sha256);
  const direct = fabriquerExtrait({ source: join(base, 'vivante.db'), destination: join(base, 'direct.db'), version: '1.0.0' });
  assert.equal(direct.empreinte, meta.empreinte);
  assert.deepEqual(direct.tables, meta.tables);
  // sans base disponible : 503 ; le fichier abîmé est refabriqué plutôt que servi
  const sansBase = creerExtrait({ dossier: base, base: () => null });
  await assert.rejects(() => sansBase.meta(), (e) => e.statut === 503);
});

test('GET /api/edition/extrait/ : le fichier, son ETag (304) ; …/meta/ : le méta ; 403 en production, 405 hors GET, 404 ailleurs', async (t) => {
  const { base, db, poses } = nouvelleBase(t);
  const service = {
    base: () => db, etat: () => ({ version: '7.7.7' }), edition: true, dossier: base,
    extrait: creerExtrait({ dossier: base, base: () => db, version: () => '7.7.7', enArrierePlan: false }),
  };
  const appel = (methode, chemin, entetes = {}, s = service) => traiter({ methode, chemin, entetes }, s);
  const m = await appel('GET', '/api/edition/extrait/meta/');
  assert.equal(m.statut, 200);
  assert.equal(m.corps.version_du_site, '7.7.7');
  assert.ok(m.corps.fichier.sha256 && m.corps.empreinte && Object.keys(m.corps.tables).length > 150);
  const f = await appel('GET', '/api/edition/extrait/');
  assert.equal(f.statut, 200);
  assert.equal(sha(f.brut), m.corps.fichier.sha256);
  assert.equal(f.entetes.ETag, `"${m.corps.fichier.sha256}"`);
  assert.equal(f.entetes['X-Extrait-Fabrique-Le'], m.corps.fabrique_le);
  assert.match(f.entetes['Content-Type'], /sqlite/);
  assert.match(f.entetes['Content-Disposition'], /^attachment/);
  for (const marque of marquesDesFiches(poses)) assert.ok(!f.brut.includes(Buffer.from(marque)), marque);
  const meme = await appel('GET', '/api/edition/extrait/', { 'if-none-match': f.entetes.ETag });
  assert.deepEqual([meme.statut, meme.brut], [304, '']);
  assert.equal((await appel('GET', '/api/edition/extrait/', { 'if-none-match': '"autre"' })).statut, 200);
  // production : fermé, avant tout autre refus
  const production = { ...service, edition: false, extrait: null };
  for (const chemin of ['/api/edition/extrait/', '/api/edition/extrait/meta/']) assert.equal((await appel('GET', chemin, {}, production)).statut, 403, chemin);
  const refus = await appel('POST', '/api/edition/extrait/');
  assert.deepEqual([refus.statut, refus.entetes.Allow], [405, 'GET']);
  assert.equal((await appel('GET', '/api/edition/extrait/autre/')).statut, 404);
  assert.equal((await appel('GET', '/api/edition/extrait/meta/x/')).statut, 404);
  assert.equal((await appel('GET', '/api/edition/extrait/', {}, { ...service, extrait: null })).statut, 503);
  assert.equal((await appel('GET', '/api/edition/extrait/', {}, { ...service, extrait: creerExtrait({ dossier: base, base: () => null }) })).statut, 503);
});

test('les routes de l’extrait sont connues des métriques (route normalisée, cardinalité bornée) et décrites par OpenAPI', (t) => {
  for (const chemin of ['/api/edition/extrait/', '/api/edition/extrait/meta/']) assert.equal(routeNormalisee(chemin), chemin);
  assert.equal(routeNormalisee('/api/edition/extrait/autre/'), ROUTE_INCONNUE);
  assert.equal(routeNormalisee('/api/edition/extrait/meta/x/'), ROUTE_INCONNUE);
  const { db } = nouvelleBase(t, { fiches: false });
  const r = traiter({ methode: 'GET', chemin: '/api/v1/openapi.json', entetes: {} }, { base: () => db, etat: () => ({}), edition: true });
  assert.equal(r.statut, 200);
  assert.ok(r.corps.paths['/edition/extrait/']?.get && r.corps.paths['/edition/extrait/meta/']?.get, 'les deux routes sont décrites');
});
