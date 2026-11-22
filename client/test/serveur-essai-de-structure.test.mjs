// L'essai d'une livraison avant son installation (serveur/essai-de-structure.mjs ; lot 7 du chantier de la base de dev, R274, R275 ; docs/serveur.md, « Essai
// avant installation »). Le service reçoit une DEMANDE de l'installateur dans db/essai-de-structure/, essaie les migrations de la demande sur une copie de sa
// base vivante, répond par resultat.json et garde dernier.json. Les copies sont toujours effacées, la vraie base n'est jamais écrite, un seul essai à la fois.
// L'installateur lui-même est éprouvé par installateur-essai-de-structure.test.mjs.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { classer } from '../serveur/acces-routes.mjs';
import { traiter } from '../serveur/api.mjs';
import { empreinteFichier } from '../serveur/base-vivante.mjs';
import {
  DOSSIER_DES_ESSAIS, FORMAT_DE_L_ETAT, INTERVALLE_DES_DEMANDES_MS, NOM_D_UNE_DEMANDE, VIE_D_UNE_DEMANDE_MS, creerEssaiDeStructure, resumeDuBilan,
} from '../serveur/essai-de-structure.mjs';
import { ROUTE_INCONNUE, routeNormalisee } from '../serveur/metriques.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { lireLesMigrations } from '../serveur/structure-sur-place.mjs';
import { LIVRAISON, NUMERO, baseDesRegles, baseRemplie, nouveauChemin, nouveauDossier, schemaDuDepot } from './aide-structure-sur-place.mjs';

const livre = lireLesMigrations(LIVRAISON); // test/aide-structure-sur-place.mjs#LIVRAISON : au-dessus du plancher quand les mixtes sont sorties
const V = livre.migrations.at(-1).numero;
const N = (numero) => String(numero).padStart(4, '0');
const schemaALaVersion = (version) => schemaDuDepot().replace(/^PRAGMA user_version\s*=\s*\d+;/m, `PRAGMA user_version = ${version};`);

let compteur = 0;
/**
 * Dépose une demande comme l'installateur : un dossier provisoire, puis renommé. `migrations` : les migrations livrées (toutes celles du dépôt, sauf mention),
 * plus `fausses` ([numero, nom, sql]) ; `schema` : celui de la dernière.
 */
function deposer(db, { version = '9.9.9', fausses = [], schema = null, sansMigrations = false, nom = null } = {}) {
  const racine = join(db, DOSSIER_DES_ESSAIS);
  mkdirSync(racine, { recursive: true });
  const provisoire = join(racine, `.depot-${(compteur += 1)}`);
  mkdirSync(join(provisoire, 'migrations'), { recursive: true });
  if (!sansMigrations) {
    for (const m of livre.migrations) writeFileSync(join(provisoire, 'migrations', m.fichier), m.sql);
    for (const [numero, suffixe, sql] of fausses) writeFileSync(join(provisoire, 'migrations', `${N(numero)}-${suffixe}.sql`), sql);
    writeFileSync(join(provisoire, 'schema.sql'), schema ?? schemaALaVersion(Math.max(V, ...fausses.map((f) => f[0]))));
  }
  writeFileSync(join(provisoire, 'demande.json'), `${JSON.stringify({ format: 'maverick-essai-demande/1', version, tag: `v${version}`, deposee_le: '2026-11-15T08:00:00Z' })}\n`);
  const demande = join(racine, nom ?? `demande-${version}-${compteur}`);
  renameSync(provisoire, demande);
  return demande;
}
const lire = (...p) => JSON.parse(readFileSync(join(...p), 'utf8'));
const copies = (racine) => (existsSync(racine) ? readdirSync(racine).filter((n) => n.startsWith('structure-essai-')) : []);

/** Une instance : un db/ avec sa base vivante (la base REMPLIE du dépôt, ramenée une version en arrière si `anterieure`). */
function instance(t, { anterieure = false } = {}) {
  const db = nouveauDossier('db-instance', t);
  const { chemin } = baseRemplie({ anterieure });
  const vivante = join(db, 'vivante.db');
  copyFileSync(chemin, vivante);
  return { db, vivante };
}

test('une demande déposée : accusée, essayée sur une copie avec les migrations de la DEMANDE, résultat écrit, dernier gardé ; la vraie base garde ses octets, les copies sont effacées', async (t) => {
  const { db, vivante } = instance(t, { anterieure: true });
  const avant = empreinteFichier(vivante);
  const sortie = [];
  const essai = creerEssaiDeStructure({ dossier: db, source: vivante, instance: 'dev', journal: (m, o) => sortie.push({ m, ...o }) });
  assert.equal(essai.lire().dernier, null, 'rien avant le premier essai');
  assert.equal(essai.lire().format, FORMAT_DE_L_ETAT);

  const demande = deposer(db, { version: '1.2.3' });
  const fin = essai.surveiller();
  assert.ok(existsSync(join(demande, 'accuse.json')), 'accusé de réception aussitôt, avant la fin de l’essai');
  await fin;

  const resultat = lire(demande, 'resultat.json');
  assert.equal(resultat.format, 'maverick-structure/1');
  assert.equal(resultat.verdict, 'accepte');
  assert.deepEqual(resultat.versions, { avant: NUMERO - 1, apres: V });
  assert.deepEqual(resultat.migrations.map((m) => m.numero), livre.migrations.filter((m) => m.numero >= NUMERO).map((m) => m.numero));
  assert.equal(resultat.demande.version, '1.2.3');
  assert.equal(resultat.demande.nom, basename(demande));
  assert.equal(resultat.instance, 'dev');
  assert.equal(typeof resultat.resume, 'string');
  assert.equal(resultat.resume, resumeDuBilan(resultat));
  assert.ok(resultat.tables.creees.some((c) => c.table === 'migration_recue'));
  // le texte est lisible sans JSON par le shell de l'installateur : verdict et resume seuls sur leur ligne, au premier niveau, indentés de deux espaces
  const texte = readFileSync(join(demande, 'resultat.json'), 'utf8');
  assert.match(texte, /^ {2}"verdict": "accepte",$/m);
  assert.match(texte, /^ {2}"resume": ".*"[,]?$/m);
  assert.deepEqual(lire(db, DOSSIER_DES_ESSAIS, 'dernier.json'), resultat);
  assert.deepEqual(essai.lire().dernier, resultat);
  assert.equal(essai.lire().en_cours, null);
  assert.equal(essai.lire().en_attente, 0);

  assert.equal(empreinteFichier(vivante), avant, 'la vraie base : les mêmes octets');
  assert.deepEqual(copies(join(db, DOSSIER_DES_ESSAIS)), [], 'copies effacées');
  assert.ok(!existsSync(`${vivante}-wal`) && !existsSync(`${vivante}-journal`), 'aucun fichier de journal posé à côté de la vraie base');
  const ligne = sortie.find((l) => /essai de la livraison 1\.2\.3/.test(l.m));
  assert.ok(ligne, 'journalisé');
  assert.equal(ligne.categorie, 'base');
  assert.equal(ligne.niveau, 'info');
});

test('une demande déjà répondue (le service redémarre) n’est pas refaite ; une demande vue n’est prise qu’une fois', async (t) => {
  const { db, vivante } = instance(t, { anterieure: true });
  let essais = 0;
  const essayer = async () => {
    essais += 1;
    return { format: 'maverick-structure/1', verdict: 'a_jour', versions: { avant: V, apres: V, livree: V }, migrations: [], duree_ms: 1 };
  };
  const premier = creerEssaiDeStructure({ dossier: db, source: vivante, essayer });
  const demande = deposer(db);
  await Promise.all([premier.surveiller(), premier.surveiller(), premier.surveiller()]);
  await premier.surveiller();
  assert.equal(essais, 1, 'une seule fois, malgré plusieurs passages');
  assert.ok(existsSync(join(demande, 'resultat.json')));
  const apres = creerEssaiDeStructure({ dossier: db, source: vivante, essayer });
  await apres.surveiller();
  assert.equal(essais, 1, 'une demande qui a son résultat n’est pas essayée de nouveau');
});

test('refus : une migration qui rompt une clé étrangère — verdict, migration et étape dans le résultat, journal en avertissement, vraie base et copies intactes', async (t) => {
  const { db, vivante } = instance(t);
  const avant = empreinteFichier(vivante);
  const sortie = [];
  const essai = creerEssaiDeStructure({ dossier: db, source: vivante, journal: (m, o) => sortie.push({ m, ...o }) });
  const demande = deposer(db, {
    version: '3.0.0',
    fausses: [[V + 1, 'lien-rompu', "UPDATE personnage SET race_id = 'races/n-existe-pas' WHERE id IN (SELECT id FROM personnage LIMIT 1);"]],
  });
  await essai.surveiller();
  const resultat = lire(demande, 'resultat.json');
  assert.equal(resultat.verdict, 'refuse');
  assert.equal(resultat.refus.migration, V + 1);
  assert.equal(resultat.refus.etape, 'cles_etrangeres');
  assert.equal(resultat.retour_arriere, true);
  assert.match(resultat.resume, /^refusé : migration/);
  assert.match(readFileSync(join(demande, 'resultat.json'), 'utf8'), /^ {2}"verdict": "refuse",$/m);
  assert.deepEqual(lire(db, DOSSIER_DES_ESSAIS, 'dernier.json'), resultat);
  assert.equal(empreinteFichier(vivante), avant);
  assert.deepEqual(copies(join(db, DOSSIER_DES_ESSAIS)), []);
  const ligne = sortie.find((l) => /essai de la livraison 3\.0\.0/.test(l.m));
  assert.equal(ligne.niveau, 'avertissement');
  assert.match(ligne.m, /^ATTENTION /);
});

test('indisponible, sans jamais lever : migrations ou schema.sql absents de la demande, demande illisible, base absente, disque trop juste (l’essai n’est pas lancé)', async (t) => {
  const { db, vivante } = instance(t);
  let essais = 0;
  const essayer = async (o) => { essais += 1; return (await import('../serveur/structure-sur-place.mjs')).essayerEnArrierePlan(o); };
  const essai = creerEssaiDeStructure({ dossier: db, source: vivante, essayer });

  const sans = deposer(db, { sansMigrations: true, nom: 'demande-sans-migrations' });
  await essai.surveiller();
  assert.equal(lire(sans, 'resultat.json').verdict, 'indisponible', 'migrations absentes de la demande : dites, pas celles du service');

  const illisible = deposer(db, { nom: 'demande-illisible' });
  writeFileSync(join(illisible, 'demande.json'), '{ pas du JSON');
  await essai.surveiller();
  assert.equal(lire(illisible, 'resultat.json').verdict, 'indisponible');
  assert.equal(essais, 1, 'la demande illisible n’a pas lancé d’essai');

  const serree = creerEssaiDeStructure({ dossier: db, source: vivante, essayer, espaceLibre: () => 1024 });
  const juste = deposer(db, { nom: 'demande-disque-juste' });
  await serree.surveiller();
  assert.equal(lire(juste, 'resultat.json').verdict, 'indisponible');
  assert.match(lire(juste, 'resultat.json').raison, /espace disque/);
  assert.equal(essais, 1, 'pas d’essai sans la place de deux copies');

  const sansBase = creerEssaiDeStructure({ dossier: db, source: join(db, 'absente.db'), essayer });
  const orpheline = deposer(db, { nom: 'demande-sans-base' });
  await sansBase.surveiller();
  assert.equal(lire(orpheline, 'resultat.json').verdict, 'indisponible');
  assert.equal(essais, 1);

  // un fil mort qui laisse ses copies : elles sont effacées aussitôt, sans attendre la prochaine ouverture du service
  const casse = creerEssaiDeStructure({ dossier: db, source: vivante, essayer: async (o) => {
    writeFileSync(join(o.dossier, 'structure-essai-7-00000000-0000-0000-0000-000000000000-avant.db'), 'copie de la base');
    writeFileSync(join(o.dossier, 'structure-essai-7-00000000-0000-0000-0000-000000000000-apres.db'), 'copie de la base');
    throw new Error('le fil s’est arrêté');
  } });
  const tombee = deposer(db, { nom: 'demande-fil-tombe' });
  await casse.surveiller();
  assert.equal(lire(tombee, 'resultat.json').verdict, 'indisponible', 'une panne de l’essai est une réponse, jamais une exception');
  assert.match(lire(tombee, 'resultat.json').raison, /arrêté/);
  assert.deepEqual(copies(join(db, DOSSIER_DES_ESSAIS)), []);
});

test('un seul essai à la fois : toutes les demandes sont accusées aussitôt, les essais se suivent un à un, dans l’ordre des noms', async (t) => {
  const { db, vivante } = instance(t);
  let enMeme = 0;
  let max = 0;
  const ordre = [];
  const liberer = [];
  const essayer = (o) => new Promise((ok) => {
    enMeme += 1;
    max = Math.max(max, enMeme);
    ordre.push(o.version);
    liberer.push(() => { enMeme -= 1; ok({ format: 'maverick-structure/1', verdict: 'a_jour', versions: { avant: V, apres: V, livree: V }, migrations: [], duree_ms: 1 }); });
  });
  const essai = creerEssaiDeStructure({ dossier: db, source: vivante, essayer });
  const a = deposer(db, { version: '1.0.1', nom: 'demande-1.0.1-1' });
  const b = deposer(db, { version: '1.0.2', nom: 'demande-1.0.2-2' });
  const fin = essai.surveiller();
  await new Promise((ok) => setImmediate(ok));
  assert.ok(existsSync(join(a, 'accuse.json')) && existsSync(join(b, 'accuse.json')), 'les deux sont accusées');
  assert.equal(lire(b, 'accuse.json').rang, 2, 'la seconde sait qu’elle attend');
  assert.equal(essai.lire().en_cours.version, '1.0.1');
  assert.equal(essai.lire().en_attente, 1);
  while (liberer.length < 1) await new Promise((ok) => setImmediate(ok));
  assert.equal(liberer.length, 1, 'la seconde n’a pas commencé');
  liberer[0]();
  while (liberer.length < 2) await new Promise((ok) => setImmediate(ok));
  liberer[1]();
  await fin;
  assert.equal(max, 1);
  assert.deepEqual(ordre, ['1.0.1', '1.0.2']);
  assert.ok(existsSync(join(a, 'resultat.json')) && existsSync(join(b, 'resultat.json')));
  assert.equal(lire(db, DOSSIER_DES_ESSAIS, 'dernier.json').demande.version, '1.0.2', 'le dernier garde le dernier fini');
});

test('une demande retirée par son installateur pendant l’essai : aucune erreur, le dernier résultat est gardé', async (t) => {
  const { db, vivante } = instance(t);
  const sortie = [];
  let demande;
  const essayer = async () => {
    rmSync(demande, { recursive: true, force: true });
    return { format: 'maverick-structure/1', verdict: 'accepte', versions: { avant: 1, apres: 2 }, migrations: [{ numero: 2 }], totaux: { ajoutees: 0, retirees: 0, modifiees: 0 }, duree_ms: 1 };
  };
  const essai = creerEssaiDeStructure({ dossier: db, source: vivante, essayer, journal: (m) => sortie.push(m) });
  demande = deposer(db);
  await essai.surveiller();
  assert.ok(!existsSync(demande));
  assert.equal(lire(db, DOSSIER_DES_ESSAIS, 'dernier.json').verdict, 'accepte');
  assert.ok(!sortie.some((m) => /^ERREUR/.test(m)), sortie.join('\n'));
});

test('purge : les copies d’un essai laissées, les demandes et dépôts abandonnés (plus d’une heure) ; une demande récente, un dossier étranger et la base ne sont jamais touchés', async (t) => {
  const { db, vivante } = instance(t);
  const racine = join(db, DOSSIER_DES_ESSAIS);
  const essai = creerEssaiDeStructure({ dossier: db, source: vivante });
  assert.equal(essai.purger(), 0, 'dossier absent : rien');
  const vieille = deposer(db, { nom: 'demande-vieille-1' });
  const recente = deposer(db, { nom: 'demande-recente-2' });
  const depot = join(racine, '.depot-4242');
  mkdirSync(depot);
  const etranger = join(racine, 'autre-dossier');
  mkdirSync(etranger);
  writeFileSync(join(racine, 'structure-essai-1-00000000-0000-0000-0000-000000000000-avant.db'), 'copie');
  writeFileSync(join(racine, 'structure-essai-1-00000000-0000-0000-0000-000000000000-apres.db-journal'), 'copie');
  const longtemps = new Date(Date.now() - VIE_D_UNE_DEMANDE_MS - 60_000);
  for (const d of [vieille, depot, etranger]) utimesSync(d, longtemps, longtemps);
  const octets = empreinteFichier(vivante);

  assert.equal(essai.purger(), 4, 'deux copies, une demande, un dépôt');
  assert.ok(!existsSync(vieille) && !existsSync(depot));
  assert.ok(existsSync(recente) && existsSync(etranger) && existsSync(vivante));
  assert.deepEqual(copies(racine), []);
  assert.equal(empreinteFichier(vivante), octets);
  // le passage de la surveillance retire aussi les demandes abandonnées, jamais les copies (celles d'un essai en cours)
  const encore = deposer(db, { nom: 'demande-vieille-3', version: '1.0.0' });
  rmSync(join(encore, 'demande.json'));
  utimesSync(encore, longtemps, longtemps);
  writeFileSync(join(racine, 'structure-essai-2-00000000-0000-0000-0000-000000000000-avant.db'), 'copie en cours');
  await essai.surveiller();
  assert.ok(!existsSync(encore));
  assert.deepEqual(copies(racine), ['structure-essai-2-00000000-0000-0000-0000-000000000000-avant.db']);
  // nom : seul « demande-<version>-<pid> » est une demande
  for (const bon of ['demande-0.4.91-123', 'demande-1.2.3-rebuild.1-9']) assert.match(bon, NOM_D_UNE_DEMANDE);
  for (const mauvais of ['demande-', 'demande-../x', 'demande-a/b', '.depot-1', 'dernier.json']) assert.doesNotMatch(mauvais, NOM_D_UNE_DEMANDE);
});

test('serveur : une demande déposée dans db/ est essayée, répondue et journalisée ; GET /api/debug/structure/ rend le dernier résultat (site de dev), 403 en production ; l’arrêt n’oublie rien', async (t) => {
  const regles = nouveauChemin('regles-service');
  copyFileSync(baseDesRegles(), regles);
  const db = nouveauDossier('service', t);
  const sortie = [];
  const s = await demarrerService({
    regles, dossier: db, port: 0, intervalle: 0, edition: true, metriques: false, journal: (m, o) => sortie.push({ m, ...o }), essaiDeStructure: { intervalle: 40 },
  });
  try {
    const vivante = join(db, 'vivante.db');
    const octets = empreinteFichier(vivante);
    let r = await fetch(`${s.url}/api/debug/structure/`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await r.json(), { format: FORMAT_DE_L_ETAT, en_cours: null, en_attente: 0, dernier: null, ombre: { en_cours: null, dernier: null }, base_source: { source: false, sur_place: null } }, 'le site de dev a aussi son essai dans l’ombre (rien à dire : aucune installation)');

    const table = 'CREATE TABLE essai_de_structure_du_service (id INTEGER PRIMARY KEY) STRICT;\n';
    const demande = deposer(db, { version: '7.7.7', fausses: [[V + 1, 'table-d-essai', table]], schema: `${schemaALaVersion(V + 1)}\n${table}` });
    for (let i = 0; i < 300 && !existsSync(join(demande, 'resultat.json')); i += 1) await new Promise((ok) => setTimeout(ok, 50));
    assert.ok(existsSync(join(demande, 'accuse.json')));
    const resultat = lire(demande, 'resultat.json');
    assert.equal(resultat.verdict, 'accepte', JSON.stringify(resultat.refus ?? resultat.raison));
    assert.equal(resultat.instance, 'dev');
    assert.ok(resultat.tables.creees.some((c) => c.table === 'essai_de_structure_du_service'));
    assert.equal(empreinteFichier(vivante), octets, 'le fichier de la vraie base : les mêmes octets');
    const verifie = new (await import('node:sqlite')).DatabaseSync(vivante, { readOnly: true });
    try {
      assert.equal(verifie.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'essai_de_structure_du_service'").get().n, 0, 'rien n’a été migré sur la vraie base');
    } finally {
      verifie.close();
    }
    assert.deepEqual(copies(join(db, DOSSIER_DES_ESSAIS)), []);
    assert.ok(sortie.some((l) => l.categorie === 'base' && /essai de la livraison 7\.7\.7/.test(l.m)), 'journalisé (catégorie base)');

    r = await fetch(`${s.url}/api/debug/structure/`);
    const corps = await r.json();
    assert.equal(corps.dernier.verdict, 'accepte');
    assert.equal(corps.dernier.demande.version, '7.7.7');
    assert.equal(corps.en_cours, null);
    assert.equal((await fetch(`${s.url}/api/debug/structure/x/`)).status, 404);
    assert.equal((await fetch(`${s.url}/api/debug/structure/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 405);
  } finally {
    await s.arreter();
  }
  // redémarré : le dernier résultat est relu du disque, et les copies d'un essai interrompu sont retirées à l'ouverture
  writeFileSync(join(db, DOSSIER_DES_ESSAIS, 'structure-essai-9-00000000-0000-0000-0000-000000000000-apres.db'), 'copie laissée');
  const s2 = await demarrerService({ regles, dossier: db, port: 0, intervalle: 0, edition: true, metriques: false, journal: () => {}, essaiDeStructure: { intervalle: 0 } });
  try {
    assert.deepEqual(copies(join(db, DOSSIER_DES_ESSAIS)), [], 'copie laissée retirée à l’ouverture');
    assert.equal((await (await fetch(`${s2.url}/api/debug/structure/`)).json()).dernier.demande.version, '7.7.7');
  } finally {
    await s2.arreter();
  }
  const prod = await demarrerService({ regles, dossier: nouveauDossier('prod', t), port: 0, intervalle: 0, edition: false, metriques: false, journal: () => {}, essaiDeStructure: { intervalle: 0 } });
  try {
    assert.equal((await fetch(`${prod.url}/api/debug/structure/`)).status, 403, 'la page Debug n’existe pas en production');
    assert.ok(prod.essaiDeStructure, 'mais la production répond aux demandes de l’installateur comme le site de dev');
  } finally {
    await prod.arreter();
  }
});

test('traiter : sans suivi (essaiDeStructure absent) → 503 ; la route est classée (lecture) et mesurée sous son gabarit', () => {
  const service = { edition: true, base: () => null, etat: () => ({}), journal: () => {} };
  const r = traiter({ methode: 'GET', chemin: '/api/debug/structure/', recherche: '', entetes: {}, corps: '' }, service);
  assert.equal(r.statut, 503);
  assert.equal(traiter({ methode: 'GET', chemin: '/api/debug/structure/', recherche: '', entetes: {}, corps: '' }, { ...service, edition: false }).statut, 403);
  assert.deepEqual(classer('GET', '/api/debug/structure/'), { classe: 'lecture', connue: true, essentielle: false });
  assert.notEqual(routeNormalisee('/api/debug/structure/'), ROUTE_INCONNUE);
  assert.equal(routeNormalisee('/api/debug/structure?x=1'), routeNormalisee('/api/debug/structure/'));
  assert.ok(INTERVALLE_DES_DEMANDES_MS >= 1000 && INTERVALLE_DES_DEMANDES_MS <= 10_000, 'un passage toutes les quelques secondes : la charge reste faible');
});
