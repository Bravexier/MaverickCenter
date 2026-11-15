// L'attestation de la production (serveur/attestation.mjs ; lot 5 du chantier de la base de dev, R274) : ce que la production dit d'elle-même sans nom ni
// fiche, écrit au démarrage du service et après chaque reconstruction de la base vivante, et l'état que la page « Mise à jour » du site de dev en tire
// (a-t-elle appliqué sa dernière mise à jour ?).
//   node --test test/serveur-attestation.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import {
  INTERVALLE_DE_L_ATTESTATION_MS, TOLERANCE_DE_LA_MISE_A_JOUR_MS, citationsDesFiches, ecrireAttestation, empreintesDuFichier, etatDeLaProduction, fabriquerAttestation, fichierAttestation, lireAttestation,
} from '../serveur/attestation.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { CLASSES_DE_TABLES, classeDeLaTable } from '../src/lib/tables-de-la-base.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { marquesDesFiches, poserDesFiches } from './aide-fiches-sentinelles.mjs';

const REGLES = cheminBase({ sansExemples: false });
const VERSION = '1.0.0';

/** Une base vivante neuve (sur une copie des règles) avec des fiches sentinelles. */
function nouvelleBase(t) {
  const dossier = dossierTemporaire('attestation', { t });
  const regles = join(dossier, 'regles.db');
  copyFileSync(REGLES, regles);
  preparerBaseVivante({ regles, dossier: join(dossier, 'db') });
  const db = ouvrirBaseVivante(join(dossier, 'db', 'vivante.db'));
  t.after(() => db.close());
  return { dossier, regles, db, poses: poserDesFiches(db) };
}

/** Le site d'une production (donnees/maverick.db, _serveur/version.json), sur le fichier de règles donné. */
function sitePublie(dossier, regles, { version = VERSION, nom = 'production' } = {}) {
  const site = join(dossier, nom);
  mkdirSync(join(site, 'donnees'), { recursive: true });
  mkdirSync(join(site, '_serveur'), { recursive: true });
  copyFileSync(regles, join(site, 'donnees', 'maverick.db'));
  writeFileSync(join(site, '_serveur', 'version.json'), `${JSON.stringify({ version })}\n`);
  return site;
}

const ecrire = (dossierMetriques, db, regles, { version = VERSION, preparation = { appliquee: true, problemes: 0 } } = {}) =>
  ecrireAttestation(dossierMetriques, fabriquerAttestation({ db, regles, version: { version, code: 'abc' }, preparation }));

test('citations : le nombre de fiches DISTINCTES qui citent chaque élément de règle, table et identifiant, jamais une fiche', (t) => {
  const { db, poses } = nouvelleBase(t);
  const autre = enregistrerFiche(db, { ...ficheVide('Une autre fiche'), race_id: poses.race }).personnage.id;
  const citations = citationsDesFiches(db);
  const nombre = (table, id) => citations.find((c) => c.table === table && c.id === id)?.fiches;
  const attendu = (colonne, id) => db.prepare(`SELECT count(*) AS n FROM personnage WHERE ${colonne} = ?`).get(id).n;
  assert.equal(nombre('race', poses.race), attendu('race_id', poses.race));
  assert.equal(nombre('race', poses.race), 3, 'le prétiré, la fiche du joueur et l’autre fiche');
  assert.equal(nombre('metier', poses.metier), 2);
  // une fiche qui cite le même élément par deux colonnes ne compte qu'une fois ; une fiche d'une table de détail aussi
  const magie = db.prepare('SELECT id FROM magie ORDER BY id LIMIT 1').get().id;
  const avant = nombre('magie', magie) ?? 0;
  db.prepare('UPDATE personnage SET magie_innee_id = ?, symbiose_magie_id = ? WHERE id = ?').run(magie, magie, autre);
  assert.equal(citationsDesFiches(db).find((c) => c.table === 'magie' && c.id === magie).fiches, avant + 1);
  const sort = db.prepare('SELECT id FROM sort ORDER BY id LIMIT 1').get().id;
  db.prepare('INSERT INTO personnage_sort (personnage_id, sort_id, rang, niveau_maitrise) VALUES (?, ?, 1, 0)').run(autre, sort);
  db.prepare('INSERT INTO personnage_livre_sort (personnage_id, sort_id, rang) VALUES (?, ?, 1)').run(autre, sort);
  assert.equal(citationsDesFiches(db).find((c) => c.table === 'sort' && c.id === sort).fiches, 1, 'deux tables de détail, une seule fiche');
  // la forme : table, id, fiches — vers une table de contenu seulement ; aucun identifiant de fiche, de compte ou de groupe
  for (const c of citationsDesFiches(db)) {
    assert.deepEqual(Object.keys(c), ['table', 'id', 'fiches']);
    assert.equal(classeDeLaTable(c.table), CLASSES_DE_TABLES.CONTENU, c.table);
    assert.ok(Number.isInteger(c.fiches) && c.fiches >= 1);
  }
  assert.deepEqual(citationsDesFiches(db), [...citationsDesFiches(db)].sort((a, b) => (a.table + a.id < b.table + b.id ? -1 : 1)), 'un ordre stable');
});

test('l’attestation : version, empreintes, préparation, citations — sans nom ni identifiant de fiche, de compte ou de groupe', (t) => {
  const { dossier, regles, db, poses } = nouvelleBase(t);
  const a = fabriquerAttestation({ db, regles, version: { version: VERSION, code: 'abc123' }, preparation: { appliquee: true, problemes: 0, refaite_le: '2026-11-01T00:00:00Z', regles: 'abcdef012345' } });
  const texte = JSON.stringify(a);
  for (const marque of marquesDesFiches(poses)) assert.ok(!texte.includes(marque), `« ${marque} » ne doit pas figurer dans l’attestation`);
  assert.equal(a.format, 'maverick-attestation/1');
  assert.deepEqual(a.version, { service: VERSION, code: 'abc123' });
  assert.equal(a.schema, db.prepare('PRAGMA user_version').get().user_version);
  assert.match(a.ecrite_le, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(a.base_vivante.empreinte, a.regles_publiees.empreinte, 'une base vivante qui a les règles publiées : la même empreinte');
  assert.ok(Object.keys(a.base_vivante.tables).length > 150);
  assert.ok(!('personnage' in a.base_vivante.tables) && !('utilisateur' in a.base_vivante.tables));
  assert.deepEqual(a.preparation, { appliquee: true, problemes: 0, refaite_le: '2026-11-01T00:00:00Z', regles: 'abcdef012345' });
  assert.ok(a.citations.length >= 2);
  assert.ok(a.duree_ms >= 0);
  // les problèmes d'une préparation ratée : un nombre, jamais leur texte (il cite des noms de fiches)
  const ratee = fabriquerAttestation({ db, regles, version: { version: VERSION }, preparation: { appliquee: false, problemes: 3, texte: `La fiche ${poses.pretire} ne passe pas` } });
  assert.deepEqual(ratee.preparation, { appliquee: false, problemes: 3, refaite_le: null, regles: null });
  assert.ok(!JSON.stringify(ratee).includes(poses.pretire));
  // sans base vivante : l'attestation le dit, rien ne casse
  const sans = fabriquerAttestation({ db: null, regles, version: { version: VERSION }, preparation: { appliquee: false, problemes: 1 } });
  assert.equal(sans.base_vivante, null);
  assert.deepEqual(sans.citations, []);
  // écrite par rename : un fichier complet, aucun provisoire, relu tel quel
  const metriques = join(dossier, 'metriques');
  const chemin = ecrireAttestation(metriques, a);
  assert.equal(chemin, join(metriques, fichierAttestation('prod')));
  assert.deepEqual(readdirSync(metriques), [fichierAttestation('prod')]);
  assert.deepEqual(JSON.parse(readFileSync(chemin, 'utf8')), a);
  assert.deepEqual(lireAttestation(metriques).attestation, a);
});

test('lecture : absente, illisible ; et gardée tant que le fichier ne change pas', (t) => {
  const dossier = dossierTemporaire('attestation-lecture', { t });
  assert.deepEqual(lireAttestation(dossier), { raison: 'absente' });
  writeFileSync(join(dossier, fichierAttestation('prod')), 'pas du JSON');
  assert.deepEqual(lireAttestation(dossier), { raison: 'illisible' });
  writeFileSync(join(dossier, fichierAttestation('prod')), JSON.stringify({ format: 'autre' }));
  assert.deepEqual(lireAttestation(dossier), { raison: 'illisible' }, 'une autre forme est illisible aussi');
});

test('les empreintes d’un fichier de règles ne se recalculent pas à chaque appel : gardées par signature, recalculées quand le fichier change', (t) => {
  const dossier = dossierTemporaire('attestation-cache', { t });
  const regles = join(dossier, 'regles.db');
  copyFileSync(REGLES, regles);
  const premier = empreintesDuFichier(regles);
  assert.equal(empreintesDuFichier(regles), premier, 'le même objet : rien n’est relu');
  const base = new DatabaseSync(regles);
  base.exec("UPDATE metier SET description = description || ' (changée)' WHERE id = (SELECT min(id) FROM metier)");
  base.close();
  utimesSync(regles, new Date(), new Date(Date.now() + 5000));
  const apres = empreintesDuFichier(regles);
  assert.notEqual(apres, premier);
  assert.notEqual(apres.global, premier.global);
});

test('état de la production : à jour, pas appliquée (version, contenu, préparation), inconnue (sans alerte)', (t) => {
  const { dossier, regles, db } = nouvelleBase(t);
  const metriques = join(dossier, 'metriques');
  const production = sitePublie(dossier, regles);
  // l'instant : une heure plus tard (la livraison n'est pas « en cours » : la tolérance est éprouvée à part)
  const etat = (autre = {}) => etatDeLaProduction({ dossier: metriques, production, propre: join(dossier, 'db', 'vivante.db'), instant: new Date(Date.now() + 3600_000), ...autre });

  // pas d'attestation : inconnue, jamais « pas appliquée » (la production ne l'écrit qu'après sa prochaine livraison)
  let e = etat();
  assert.deepEqual([e.etat, e.raison], ['inconnue', 'absente']);
  assert.equal(e.version_publiee, VERSION);
  assert.ok(e.message.length > 10);
  mkdirSync(metriques, { recursive: true });
  writeFileSync(join(metriques, fichierAttestation('prod')), '{');
  assert.deepEqual([etat().etat, etat().raison], ['inconnue', 'illisible']);

  // à jour : même version, même contenu, préparation réussie
  ecrire(metriques, db, regles);
  e = etat();
  assert.deepEqual([e.etat, e.raison, e.version_publiee, e.version_attestee, e.problemes], ['a_jour', null, VERSION, VERSION, 0]);
  assert.deepEqual(e.tables_differentes, []);
  assert.match(e.attestee_le, /^\d{4}-/);

  // la production tourne encore sur l'ancienne version
  ecrire(metriques, db, regles, { version: '0.9.0' });
  e = etat();
  assert.deepEqual([e.etat, e.raison, e.version_attestee, e.version_publiee], ['pas_appliquee', 'version', '0.9.0', VERSION]);
  assert.match(e.message, /0\.9\.0/);

  // la préparation de sa base a échoué : le nombre de problèmes, pas leur texte
  ecrire(metriques, db, regles, { preparation: { appliquee: false, problemes: 2 } });
  e = etat();
  assert.deepEqual([e.etat, e.raison, e.problemes], ['pas_appliquee', 'preparation', 2]);

  // une livraison a changé le contenu publié, la base vivante n'a pas suivi : le contenu diffère, et les tables qui diffèrent sont nommées
  ecrire(metriques, db, regles);
  const livree = new DatabaseSync(join(production, 'donnees', 'maverick.db'));
  livree.exec("UPDATE metier SET description = description || ' (livrée)' WHERE id = (SELECT min(id) FROM metier)");
  livree.close();
  utimesSync(join(production, 'donnees', 'maverick.db'), new Date(), new Date(Date.now() + 9000));
  e = etat();
  assert.deepEqual([e.etat, e.raison, e.tables_differentes], ['pas_appliquee', 'contenu', ['metier']]);

  // une production qu'on ne lit pas, un site qui ne la lit pas, le même fichier que le sien : inconnue, sans alerte
  assert.deepEqual([etat({ production: join(dossier, 'absente') }).etat, etat({ production: join(dossier, 'absente') }).raison], ['inconnue', 'production_illisible']);
  assert.deepEqual([etat({ production: null }).etat, etat({ production: null }).raison], ['inconnue', 'non_configuree']);
  assert.equal(etat({ propre: join(production, 'donnees', 'maverick.db') }).etat, 'inconnue');
  assert.equal(etat({ dossier: join(dossier, 'sans-attestation') }).etat, 'inconnue');
});

test('tolérance après une livraison : version ou contenu qui diffère, fichier publié de moins de 10 minutes et plus neuf que l’attestation → `inconnue` / `en_cours` ; au-delà, ou attestation plus neuve, `pas_appliquee`', (t) => {
  const { dossier, regles, db } = nouvelleBase(t);
  const metriques = join(dossier, 'metriques');
  const production = sitePublie(dossier, regles);
  const publie = join(production, 'donnees', 'maverick.db');
  assert.equal(TOLERANCE_DE_LA_MISE_A_JOUR_MS, 10 * 60 * 1000);
  const chemin = ecrire(metriques, db, regles, { version: '0.9.0' }); // la production tourne encore sur l'ancienne version
  const ecriteLe = Date.parse(JSON.parse(readFileSync(chemin, 'utf8')).ecrite_le);
  const livree = ecriteLe + 60_000; // le fichier publié change une minute après l'attestation
  utimesSync(publie, new Date(livree), new Date(livree));
  const etat = (instant) => etatDeLaProduction({ dossier: metriques, production, propre: null, instant: new Date(instant) });
  for (const [instant, attendu] of [[livree, 'en_cours'], [livree + TOLERANCE_DE_LA_MISE_A_JOUR_MS - 1, 'en_cours'], [livree + TOLERANCE_DE_LA_MISE_A_JOUR_MS, 'version'], [livree + TOLERANCE_DE_LA_MISE_A_JOUR_MS + 1, 'version']]) {
    const e = etat(instant);
    assert.deepEqual([e.etat, e.raison], attendu === 'en_cours' ? ['inconnue', 'en_cours'] : ['pas_appliquee', 'version'], `à ${instant - livree} ms`);
  }
  assert.match(etat(livree).message, /applique sa mise à jour/);
  // le contenu qui diffère se tolère de même (même version)
  ecrire(metriques, db, regles, { version: VERSION });
  const chemin2 = join(metriques, fichierAttestation('prod'));
  const ecrite2 = Date.parse(JSON.parse(readFileSync(chemin2, 'utf8')).ecrite_le);
  const base = new DatabaseSync(publie);
  base.exec("UPDATE metier SET description = description || ' (livrée)' WHERE id = (SELECT min(id) FROM metier)");
  base.close();
  const livree2 = ecrite2 + 60_000;
  utimesSync(publie, new Date(livree2), new Date(livree2));
  assert.deepEqual([etat(livree2 + 1000).etat, etat(livree2 + 1000).raison], ['inconnue', 'en_cours']);
  assert.deepEqual([etat(livree2 + TOLERANCE_DE_LA_MISE_A_JOUR_MS).etat, etat(livree2 + TOLERANCE_DE_LA_MISE_A_JOUR_MS).raison], ['pas_appliquee', 'contenu']);
  // une attestation plus neuve que le fichier publié : la production a eu le temps, la tolérance ne joue pas
  utimesSync(publie, new Date(ecrite2 - 60_000), new Date(ecrite2 - 60_000));
  assert.deepEqual([etat(ecrite2).etat, etat(ecrite2).raison], ['pas_appliquee', 'contenu']);
  // une préparation échouée n'est jamais tolérée
  ecrire(metriques, db, regles, { preparation: { appliquee: false, problemes: 1 } });
  utimesSync(publie, new Date(Date.now() + 60_000), new Date(Date.now() + 60_000));
  assert.deepEqual([etat(Date.now()).etat, etat(Date.now()).raison], ['pas_appliquee', 'preparation']);
});

test('GET /api/mise-a-jour/ porte `etat_production` : l’état de la production, de la forme que la page affiche', async (t) => {
  const { dossier, regles, db } = nouvelleBase(t);
  const metriques = join(dossier, 'metriques');
  const production = sitePublie(dossier, regles);
  const service = {
    base: () => db, etat: () => ({ version: '1.1.0' }), edition: true, dossier: join(dossier, 'db'), reference: { production, depot: null, propre: join(dossier, 'db', 'vivante.db') },
    attestations: metriques,
  };
  const lire = () => traiter({ methode: 'GET', chemin: '/api/mise-a-jour/', entetes: {} }, service);
  let r = lire();
  assert.equal(r.statut, 200);
  assert.deepEqual(Object.keys(r.corps.etat_production).sort(), ['attestee_le', 'etat', 'message', 'problemes', 'raison', 'tables_differentes', 'version_attestee', 'version_publiee']);
  assert.deepEqual([r.corps.etat_production.etat, r.corps.etat_production.raison], ['inconnue', 'absente']);
  ecrire(metriques, db, regles);
  r = lire();
  assert.deepEqual([r.corps.etat_production.etat, r.corps.etat_production.raison], ['a_jour', null]);
  ecrire(metriques, db, regles, { preparation: { appliquee: false, problemes: 1 } });
  assert.equal(lire().corps.etat_production.etat, 'pas_appliquee');
  // production : la page n'existe pas
  assert.equal(traiter({ methode: 'GET', chemin: '/api/mise-a-jour/', entetes: {} }, { ...service, edition: false }).statut, 403);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Le service : écrit l'attestation après la préparation de la base vivante, et après chaque reconstruction ; un échec n'empêche rien
// ---------------------------------------------------------------------------------------------------------------------------------------------------

const attendre = async (condition, message) => {
  for (let i = 0; i < 300 && !condition(); i += 1) await new Promise((ok) => setTimeout(ok, 25));
  assert.ok(condition(), message);
};

test('le service de production écrit son attestation au démarrage et après chaque reconstruction, une préparation ratée comprise ; le site de dev n’en écrit pas', async (t) => {
  const racine = dossierTemporaire('attestation-service', { t });
  const regles = join(racine, 'regles.db');
  copyFileSync(REGLES, regles);
  const version = join(racine, 'version.json');
  writeFileSync(version, JSON.stringify({ version: '3.2.1', empreinte: 'cafe0123' }));
  const metriques = join(racine, 'partage');
  const lignes = [];
  const reglages = { regles, port: 0, intervalle: 40, fichierVersion: version, journal: (l) => lignes.push(l), tipeee: false, metriques: { dossier: metriques } };
  const s = await demarrerService({ ...reglages, dossier: join(racine, 'prod') });
  const fichier = join(metriques, fichierAttestation('prod'));
  try {
    assert.ok(existsSync(fichier), 'écrite avant que le service ne réponde');
    const a = JSON.parse(readFileSync(fichier, 'utf8'));
    assert.deepEqual([a.instance, a.version.service, a.version.code, a.preparation.appliquee, a.preparation.problemes], ['prod', '3.2.1', 'cafe0123', true, 0]);
    assert.equal(a.base_vivante.empreinte, a.regles_publiees.empreinte);
    assert.match(a.preparation.refaite_le, /^\d{4}-/);
    // une fiche de plus : l'attestation n'est pas touchée (elle se refait avec la base, pas avec les fiches)
    const creee = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: 'ZqxServiceSentinelle' }) });
    assert.equal(creee.status, 201);
    assert.equal(readFileSync(fichier, 'utf8'), `${JSON.stringify(a)}\n`);

    // de nouvelles règles : la base est refaite, l'attestation aussi
    const neuves = join(racine, 'regles-neuves.db');
    copyFileSync(REGLES, neuves);
    const base = new DatabaseSync(neuves);
    base.exec("UPDATE metier SET description = description || ' (nouvelle livraison)' WHERE id = (SELECT min(id) FROM metier)");
    base.close();
    copyFileSync(neuves, regles);
    await attendre(() => JSON.parse(readFileSync(fichier, 'utf8')).base_vivante.empreinte !== a.base_vivante.empreinte, 'attestation refaite après la reconstruction');
    const b = JSON.parse(readFileSync(fichier, 'utf8'));
    assert.equal(b.base_vivante.empreinte, b.regles_publiees.empreinte);
    assert.equal(b.preparation.appliquee, true);
    assert.ok(!readFileSync(fichier, 'utf8').includes('ZqxServiceSentinelle'), 'le nom d’une fiche n’y est pas');

    // une préparation qui échoue : « pas appliquée », le nombre de problèmes, pas de texte ; la base en place reste servie
    writeFileSync(regles, 'ceci n’est pas une base SQLite');
    await attendre(() => JSON.parse(readFileSync(fichier, 'utf8')).preparation.appliquee === false, 'attestation « non appliquée »');
    const c = JSON.parse(readFileSync(fichier, 'utf8'));
    assert.ok(Number.isInteger(c.preparation.problemes) && c.preparation.problemes >= 1);
    assert.ok(!JSON.stringify(c.preparation).includes('SQLite'), 'jamais le texte de l’erreur');
    assert.equal(c.base_vivante.empreinte, b.base_vivante.empreinte, 'la base en place est celle d’avant');
    assert.equal(c.regles_publiees, null, 'le fichier publié est illisible');
    const etat = await (await fetch(`${s.url}/api/etat`)).json();
    assert.equal(etat.base.disponible, true);
  } finally {
    await s.arreter();
  }
  // le site de dev (édition) n'écrit rien : la production seule publie
  const regles2 = join(racine, 'regles2.db');
  copyFileSync(REGLES, regles2);
  const metriquesDev = join(racine, 'partage-dev');
  const dev = await demarrerService({ ...reglages, regles: regles2, dossier: join(racine, 'dev'), edition: true, intervalle: 0, metriques: { dossier: metriquesDev } });
  try {
    assert.ok(!existsSync(join(metriquesDev, fichierAttestation('prod'))) && !existsSync(join(metriquesDev, fichierAttestation('dev'))));
  } finally {
    await dev.arreter();
  }
});

test('un échec d’écriture de l’attestation n’empêche pas le service de démarrer et ne touche pas aux fiches', async (t) => {
  const racine = dossierTemporaire('attestation-echec', { t });
  const regles = join(racine, 'regles.db');
  copyFileSync(REGLES, regles);
  // le « dossier » des attestations est un fichier : aucune écriture n'y est possible
  const bouche = join(racine, 'bouche');
  writeFileSync(bouche, 'un fichier');
  const lignes = [];
  const s = await demarrerService({ regles, dossier: join(racine, 'prod'), port: 0, intervalle: 0, journal: (l) => lignes.push(l), tipeee: false, metriques: false, attestation: { dossier: bouche } });
  try {
    const etat = await (await fetch(`${s.url}/api/etat`)).json();
    assert.equal(etat.base.disponible, true);
    assert.equal(etat.base.a_jour, true);
    assert.ok(lignes.some((l) => /ERREUR attestation/.test(l)), 'l’échec est noté');
    assert.equal(readFileSync(bouche, 'utf8'), 'un fichier');
    const creee = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: 'Toujours là' }) });
    assert.equal(creee.status, 201);
    assert.equal((await (await fetch(`${s.url}/api/personnages`)).json()).personnages.length, 1);
  } finally {
    await s.arreter();
  }
  // attestation: false : ni écriture ni lecture
  const racine2 = dossierTemporaire('attestation-fermee', { t });
  const inactive = await demarrerService({ regles, dossier: join(racine2, 'prod'), port: 0, intervalle: 0, journal: () => {}, tipeee: false, metriques: { dossier: join(racine2, 'm') }, attestation: false });
  try {
    assert.ok(!existsSync(join(racine2, 'm', fichierAttestation('prod'))));
  } finally {
    await inactive.arreter();
  }
});

test('la production réécrit son attestation à intervalle régulier (une heure par défaut) : une fiche enregistrée depuis le démarrage y compte', async (t) => {
  assert.equal(INTERVALLE_DE_L_ATTESTATION_MS, 60 * 60 * 1000);
  const racine = dossierTemporaire('attestation-periodique', { t });
  const regles = join(racine, 'regles.db');
  copyFileSync(REGLES, regles);
  const metriques = join(racine, 'metriques');
  const s = await demarrerService({ regles, dossier: join(racine, 'prod'), port: 0, intervalle: 0, journal: () => {}, tipeee: false, metriques: false,
    attestation: { dossier: metriques, intervalle: 40 } });
  try {
    const lire = () => JSON.parse(readFileSync(join(metriques, fichierAttestation('prod')), 'utf8'));
    const lecture = new DatabaseSync(regles, { readOnly: true });
    const race = lecture.prepare('SELECT id FROM race ORDER BY id LIMIT 1').get().id;
    lecture.close();
    const citee = (a) => a.citations.find((c) => c.table === 'race' && c.id === race)?.fiches ?? 0;
    assert.equal(citee(lire()), 0, 'aucune fiche au démarrage');
    const creee = await fetch(`${s.url}/api/personnages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: 'Zqx périodique', race_id: race }) });
    assert.equal(creee.status, 201);
    let a = lire();
    for (let i = 0; i < 100 && citee(a) === 0; i += 1) {
      await new Promise((ok) => { setTimeout(ok, 20); });
      a = lire();
    }
    assert.equal(citee(a), 1, 'la fiche enregistrée après le démarrage est comptée par la réécriture');
    assert.equal(a.preparation.appliquee, true, 'la dernière préparation, redite telle quelle');
  } finally {
    await s.arreter();
  }
});
