// L'essai dans l'ombre (serveur/essai-dans-l-ombre.mjs ; lot 7 du chantier de la base de dev, R274, R275 ; docs/serveur.md, « Essai dans l'ombre »). À chaque
// installation du site de dev, le service garde la base d'AVANT la reconstruction et la base REFAITE, applique les migrations livrées à la première (« migrée sur
// place ») et la compare à la seconde, table par table : verdict `identique`, `attendu` (le dépôt livre du contenu), `ecart`, `refuse` ou `indisponible`. La vraie
// base n'est jamais écrite, les copies sont toujours effacées, la production n'en fait pas, une simple relance non plus.
//   node --test test/serveur-essai-dans-l-ombre.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { empreinteFichier, lireEtat, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import {
  CATEGORIES_DE_L_OMBRE, FICHIER_DE_L_OMBRE, FORMAT_DE_L_OMBRE, GRAVITE_DES_CATEGORIES, TABLES_IGNOREES, VERDICTS_DE_L_OMBRE, categorieDeLaTable, creerOmbre,
  resumeDeLOmbre, uneInstallation, verdictDeLOmbre,
} from '../serveur/essai-dans-l-ombre.mjs';
import { DOSSIER_DES_ESSAIS, FORMAT_DE_L_ETAT } from '../serveur/essai-de-structure.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { lireLesMigrations } from '../serveur/structure-sur-place.mjs';
import { CLASSES_DE_TABLES, TABLES_DE_CONTENU, classeDeLaTable } from '../src/lib/tables-de-la-base.mjs';
import { baseDesRegles, nouveauChemin, nouveauDossier, schemaDuDepot } from './aide-structure-sur-place.mjs';

const livre = lireLesMigrations();
const V = livre.migrations.at(-1).numero;
const N = (numero) => String(numero).padStart(4, '0');
const schemaALaVersion = (version) => schemaDuDepot().replace(/^PRAGMA user_version\s*=\s*\d+;/m, `PRAGMA user_version = ${version};`);
const copies = (db) => {
  const racine = join(db, DOSSIER_DES_ESSAIS);
  return existsSync(racine) ? readdirSync(racine).filter((n) => n.startsWith('structure-essai-')) : [];
};

/** Une copie des règles du dépôt, modifiée par `sql` (clés étrangères non contrôlées). */
function regles(sql = '') {
  const f = nouveauChemin('regles');
  copyFileSync(baseDesRegles(), f);
  if (sql) {
    const db = new DatabaseSync(f, { enableForeignKeyConstraints: false });
    db.exec(sql);
    db.close();
  }
  return f;
}

/** Un dossier de migrations livrées (celles du dépôt) plus des migrations de plus ou de remplacement, et son schema.sql : { migrations, schema }. */
function migrationsAvec(t, { fausses = [], remplacees = {}, schema = null } = {}) {
  const dossier = nouveauDossier('migrations-livrees', t);
  mkdirSync(join(dossier, 'migrations'));
  for (const m of livre.migrations) writeFileSync(join(dossier, 'migrations', m.fichier), remplacees[m.numero] ?? m.sql);
  for (const [numero, nom, sql] of fausses) writeFileSync(join(dossier, 'migrations', `${N(numero)}-${nom}.sql`), sql);
  writeFileSync(join(dossier, 'schema.sql'), schema ?? schemaALaVersion(Math.max(V, ...fausses.map((f) => f[0]))));
  return { migrations: join(dossier, 'migrations'), schema: join(dossier, 'schema.sql') };
}

/**
 * Un site de dev AVANT son installation : la base vivante d'une version « 1.0.0 » faite des règles du dépôt (`avant` : du SQL de plus pour ces règles), avec un prétiré,
 * une modification de l'édition (journal ET table, comme le service les écrit), ramenée à la version 128 (sans `migration_recue`, migration 0129) ; vivante.json dit
 * que d'autres règles l'ont faite, de sorte que la prochaine préparation la refait. `empreintes: false` : un état d'avant l'essai dans l'ombre (sans `tables_regles`).
 * Rend { db, octets (de la vraie base), poses }.
 */
function siteAvantInstallation(t, { avant = '', empreintes = true } = {}) {
  const db = nouveauDossier('db-ombre', t);
  const premiere = preparerBaseVivante({ regles: regles(avant), dossier: db, version: '1.0.0', ombre: { preparer: () => null } });
  const vivante = ouvrirBaseVivante(premiere.chemin);
  let poses;
  try {
    const classe = vivante.prepare('SELECT id FROM classe ORDER BY id LIMIT 1').get().id;
    vivante.prepare(`INSERT INTO personnage (id, nature, nom, visibilite, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon, alignement_mauvais,
        bourse_pp, bourse_ro, bourse_rf, ambidextrie, cree_le, modifie_le) VALUES (?, 'pretire', ?, 'tous', 'mono', 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)`)
      .run('pretire-ombre', 'Prétiré de l’ombre', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z');
    vivante.prepare('INSERT INTO personnage_classe (personnage_id, rang, classe_id, specialite_id) VALUES (?, 1, ?, NULL)').run('pretire-ombre', classe);
    // une modification faite sur le site : une ligne du journal, et la table modifiée comme le service le fait (un don d'une autre classe que le Guerrier)
    const don = vivante.prepare("SELECT id, effet FROM capacite WHERE classe_id <> 'classes/guerrier' AND nature = 'classe' ORDER BY id LIMIT 1").get();
    enregistrer(vivante, { page: 'classes/x', operations: [{ op: 'modifier', table: 'capacite', cle: { id: don.id }, valeurs: { effet: `${don.effet ?? ''} (essai de l’ombre)`.trim() } }] });
    poses = { classe, don: don.id };
    vivante.exec('DROP TABLE migration_recue');
    vivante.exec(`PRAGMA user_version = ${V - 1}`);
  } finally {
    vivante.close();
  }
  const etat = lireEtat(db);
  assert.ok(etat.tables_regles && Object.keys(etat.tables_regles).length > 100, 'la première préparation garde les empreintes des règles (option ombre)');
  const { tables_regles: gardees, ...sans } = etat;
  writeFileSync(join(db, 'vivante.json'), `${JSON.stringify({ ...sans, ...(empreintes ? { tables_regles: gardees } : {}), regles: 'x', logique: 'x', schema: V - 1 }, null, 2)}\n`);
  return { db, octets: empreinteFichier(join(db, 'vivante.db')), poses };
}

/** L'installation : la base est refaite par `regles2`, l'essai dans l'ombre part (la promesse de `demarrer`), et rend { r, rapport, ombre }. */
async function installer(db, regles2, { version = '1.1.0', reglages = {}, avantDemarrage = null } = {}) {
  const evenements = [];
  const sortie = [];
  const ombre = creerOmbre({ dossier: db, instance: 'dev', journal: (m, o) => sortie.push({ m, ...o }), evenement: (type, o) => evenements.push({ type, ...o }), ...reglages });
  const r = preparerBaseVivante({ regles: regles2, dossier: db, version, ombre });
  avantDemarrage?.(r, ombre);
  await ombre.demarrer();
  return { r, ombre, rapport: ombre.lire().dernier, evenements, sortie };
}

let octetsApresReconstruction = null; // la vraie base, juste après la reconstruction
const entree = (rapport, table) => rapport.tables.find((e) => e.table === table);

test('installation sans rien de livré hors migration : la base migrée sur place est celle que le circuit refait (verdict identique) ; vraie base aux mêmes octets, copies effacées', async (t) => {
  const { db, octets } = siteAvantInstallation(t);
  const { r, rapport, evenements, sortie } = await installer(db, regles(), {
    avantDemarrage: (res) => {
      assert.equal(res.refaite, true);
      assert.equal(res.ombre.programme, true);
      assert.equal(copies(db).length, 2, 'deux copies : la base d’avant et la base refaite');
      octetsApresReconstruction = empreinteFichier(join(db, 'vivante.db'));
    },
  });
  assert.notEqual(octetsApresReconstruction, octets, 'la reconstruction a bien remplacé la base');
  assert.equal(r.refaite, true);
  assert.equal(rapport.format, FORMAT_DE_L_OMBRE);
  assert.equal(rapport.verdict, 'identique', JSON.stringify(rapport.tables.filter((e) => e.gravite !== 'ignore')));
  assert.deepEqual(rapport.structure, { identique: true, ecarts: [] });
  assert.deepEqual(rapport.versions, { avant: V - 1, migree: V, refaite: V });
  assert.deepEqual(rapport.migrations.map((m) => m.numero), livre.migrations.filter((m) => m.numero >= V).map((m) => m.numero));
  assert.equal(rapport.regles_d_avant, 'connues');
  assert.deepEqual(rapport.version, { avant: '1.0.0', apres: '1.1.0' });
  assert.equal(rapport.instance, 'dev');
  assert.equal(rapport.resume, resumeDeLOmbre(rapport));
  // seule `migration_recue` diffère (le mode des lignes) : ignorée, dite telle ; les fiches, le journal : identiques
  assert.deepEqual(rapport.tables.map((e) => e.table), ['migration_recue']);
  assert.equal(entree(rapport, 'migration_recue').categorie, CATEGORIES_DE_L_OMBRE.IGNOREE);
  assert.equal(entree(rapport, 'migration_recue').raison, TABLES_IGNOREES.migration_recue);
  assert.equal(rapport.chiffres.tables_differentes, 1);
  assert.ok(rapport.chiffres.tables_identiques > 100 && rapport.chiffres.tables_comparees === rapport.chiffres.tables_identiques + 1);
  // rien n'est écrit dans la vraie base, rien ne reste
  assert.equal(empreinteFichier(join(db, 'vivante.db')), octetsApresReconstruction, 'la vraie base : les mêmes octets pendant l’essai');
  assert.deepEqual(copies(db), [], 'copies effacées');
  assert.ok(existsSync(join(db, DOSSIER_DES_ESSAIS, FICHIER_DE_L_OMBRE)));
  assert.deepEqual(JSON.parse(readFileSync(join(db, DOSSIER_DES_ESSAIS, FICHIER_DE_L_OMBRE), 'utf8')), rapport, 'le rapport est celui du fichier');
  // journal et métriques : un compte, jamais un nom de fiche ni une valeur
  const ligne = sortie.find((l) => /essai dans l’ombre de la livraison 1\.1\.0/.test(l.m));
  assert.equal(ligne.categorie, 'base');
  assert.equal(ligne.niveau, 'info');
  assert.match(ligne.m, /^structure : /);
  assert.ok(!JSON.stringify([ligne, evenements]).includes('Prétiré de l’ombre'));
  const ev = evenements.find((e) => e.type === 'structure_ombre');
  assert.equal(ev.detail.verdict, 'identique');
  assert.equal(ev.detail.graves, 0);
  assert.equal(typeof ev.duree_ms, 'number');
});

test('une table de contenu que les règles de la livraison changent hors migration : verdict attendu, livrée par le dépôt ; sans empreintes d’avant : inconnu', async (t) => {
  const changement = "UPDATE metier SET remarque = 'livraison de l’essai' WHERE id = (SELECT id FROM metier ORDER BY id LIMIT 1)";
  const avec = siteAvantInstallation(t);
  const { rapport } = await installer(avec.db, regles(changement));
  assert.equal(rapport.verdict, 'attendu', JSON.stringify(rapport.tables));
  const metier = entree(rapport, 'metier');
  assert.equal(metier.categorie, CATEGORIES_DE_L_OMBRE.LIVRE_PAR_LE_DEPOT);
  assert.equal(metier.gravite, 'attendu');
  assert.equal(metier.classe, CLASSES_DE_TABLES.CONTENU);
  assert.deepEqual([metier.ajoutees, metier.retirees, metier.modifiees], [0, 0, 1], 'une ligne modifiée, comptée par clé primaire');
  assert.equal(rapport.chiffres.par_categorie.livre_par_le_depot.tables, 1);
  assert.deepEqual(rapport.tables.filter((e) => e.gravite === 'grave'), [], 'les fiches et le journal restent identiques');
  assert.equal(rapport.regles_d_avant, 'connues');
  assert.match(rapport.resume, /^attendu : /);

  // première installation avec cet essai : vivante.json n'a pas les empreintes des règles d'avant → `inconnu`, dit comme tel, verdict attendu
  const sans = siteAvantInstallation(t, { empreintes: false });
  const inconnu = await installer(sans.db, regles(changement));
  assert.equal(inconnu.rapport.verdict, 'attendu');
  assert.equal(inconnu.rapport.regles_d_avant, 'inconnues');
  assert.equal(entree(inconnu.rapport, 'metier').categorie, CATEGORIES_DE_L_OMBRE.INCONNU);
  assert.match(entree(inconnu.rapport, 'metier').raison, /première installation/);
  assert.ok(lireEtat(sans.db).tables_regles, 'la préparation garde désormais les empreintes des règles pour la livraison suivante');
});

test('une migration qui perd des lignes de fiches : écart grave, la table propre au site est nommée ; la vraie base reste intacte', async (t) => {
  const { db } = siteAvantInstallation(t);
  const sql = livre.migrations.find((m) => m.numero === V).sql;
  const perdante = migrationsAvec(t, { remplacees: { [V]: `${sql}\nDELETE FROM personnage_classe;\n` } });
  const { rapport } = await installer(db, regles(), { reglages: perdante });
  assert.equal(rapport.verdict, 'ecart');
  const e = entree(rapport, 'personnage_classe');
  assert.equal(e.categorie, CATEGORIES_DE_L_OMBRE.PROPRE_AU_SITE);
  assert.equal(e.gravite, 'grave');
  assert.ok(e.ajoutees >= 1, 'la base refaite a la ligne que la migrée a perdue');
  assert.equal(rapport.chiffres.par_categorie.propre_au_site.tables, 1);
  assert.match(rapport.resume, /^écart : /);
  assert.deepEqual(copies(db), []);
  const vraie = new DatabaseSync(join(db, 'vivante.db'), { readOnly: true });
  try {
    assert.ok(vraie.prepare('SELECT count(*) AS n FROM personnage_classe').get().n >= 1, 'la vraie base garde ses fiches');
  } finally {
    vraie.close();
  }
});

test('une migration qui donne un autre schéma que la base refaite : écart de structure, dit', async (t) => {
  const { db } = siteAvantInstallation(t);
  const table = 'CREATE TABLE essai_dans_l_ombre (id INTEGER PRIMARY KEY) STRICT;\n';
  const autre = migrationsAvec(t, { fausses: [[V + 1, 'table-d-essai', table]], schema: `${schemaALaVersion(V + 1)}\n${table}` });
  const { rapport } = await installer(db, regles(), { reglages: autre });
  assert.equal(rapport.verdict, 'ecart');
  assert.equal(rapport.structure.identique, false);
  assert.ok(rapport.structure.ecarts.length >= 1);
  const e = entree(rapport, 'essai_dans_l_ombre');
  assert.equal(e.categorie, CATEGORIES_DE_L_OMBRE.STRUCTURE);
  assert.equal(e.gravite, 'grave');
  assert.deepEqual(rapport.versions, { avant: V - 1, migree: V + 1, refaite: V });
});

test('une migration refusée : verdict refuse, migration et étape dites, retour arrière ; ni la vraie base ni les copies ne gardent rien', async (t) => {
  const { db } = siteAvantInstallation(t);
  const fausse = [V + 1, 'lien-rompu', "UPDATE personnage SET race_id = 'races/n-existe-pas' WHERE id = 'pretire-ombre';"];
  const { rapport, sortie, evenements } = await installer(db, regles(), { reglages: migrationsAvec(t, { fausses: [fausse] }) });
  assert.equal(rapport.verdict, 'refuse');
  assert.equal(rapport.refus.migration, V + 1);
  assert.equal(rapport.refus.etape, 'cles_etrangeres');
  assert.equal(rapport.retour_arriere, true);
  assert.match(rapport.resume, /^refusé : migration/);
  assert.deepEqual(copies(db), []);
  const ligne = sortie.find((l) => /essai dans l’ombre/.test(l.m));
  assert.equal(ligne.niveau, 'avertissement');
  assert.match(ligne.m, /^ATTENTION structure : /);
  assert.equal(evenements.find((e) => e.type === 'structure_ombre').detail.etape, 'cles_etrangeres');
});

test('indisponible, sans jamais lever : migrations non livrées, disque trop juste (aucune copie, aucun fil), fil mort (copies effacées)', async (t) => {
  // migrations non livrées avec le service
  const a = siteAvantInstallation(t);
  const sansMigrations = await installer(a.db, regles(), { reglages: { migrations: join(a.db, 'absentes'), schema: false } });
  assert.equal(sansMigrations.rapport.verdict, 'indisponible');
  assert.match(sansMigrations.rapport.raison, /migrations/);
  assert.deepEqual(copies(a.db), []);

  // le schema.sql attendu n'est pas livré
  const b = siteAvantInstallation(t);
  const sansSchema = await installer(b.db, regles(), { reglages: { migrations: migrationsAvec(t).migrations, schema: join(b.db, 'absent.sql') } });
  assert.equal(sansSchema.rapport.verdict, 'indisponible');
  assert.match(sansSchema.rapport.raison, /schema\.sql/);

  // disque trop juste : rien n'est copié et le fil n'est pas lancé
  const c = siteAvantInstallation(t);
  let lances = 0;
  const trop = await installer(c.db, regles(), {
    reglages: { espaceLibre: () => 1024, executer: async () => { lances += 1; } },
    avantDemarrage: () => assert.deepEqual(copies(c.db), [], 'aucune copie sans la place'),
  });
  assert.equal(trop.rapport.verdict, 'indisponible');
  assert.match(trop.rapport.raison, /espace disque/);
  assert.equal(lances, 0);

  // le fil s'arrête avant d'avoir effacé ses copies : le service les efface, dit « indisponible »
  const d = siteAvantInstallation(t);
  const mort = await installer(d.db, regles(), { reglages: { executer: async () => { throw new Error('le fil s’est arrêté (code 1)'); } } });
  assert.equal(mort.rapport.verdict, 'indisponible');
  assert.match(mort.rapport.raison, /n’a pas pu se faire/);
  assert.deepEqual(copies(d.db), []);
  assert.equal(mort.sortie.find((l) => /essai dans l’ombre/.test(l.m)).niveau, 'avertissement');
});

test('pas d’essai sur une simple relance (mêmes versions), ni sans base d’avant ; vivante.json ne garde les empreintes des règles qu’avec l’essai', async (t) => {
  const { db } = siteAvantInstallation(t);
  // même version du site et même version de la base : les règles ont changé, c'est une relance
  writeFileSync(join(db, 'vivante.json'), `${JSON.stringify({ ...lireEtat(db), version: '1.1.0', schema: V }, null, 2)}\n`);
  const relance = await installer(db, regles("UPDATE metier SET remarque = 'relance' WHERE id = (SELECT id FROM metier ORDER BY id LIMIT 1)"), { version: '1.1.0' });
  assert.equal(relance.r.refaite, true);
  assert.deepEqual(relance.r.ombre, { programme: false, raison: 'relance' });
  assert.equal(relance.ombre.lire().dernier, null);
  assert.deepEqual(copies(db), []);

  // une première création (pas de base d'avant) : rien à comparer
  const neuf = nouveauDossier('db-neuf', t);
  const premiere = await installer(neuf, regles());
  assert.equal(premiere.r.refaite, true);
  assert.equal(premiere.r.ombre, undefined);
  assert.equal(premiere.ombre.lire().dernier, null);
  assert.ok(lireEtat(neuf).tables_regles, 'les empreintes des règles sont gardées dès la première création');

  // sans l'essai (la production) : vivante.json est tel qu'avant ce changement
  const prod = nouveauDossier('db-prod', t);
  preparerBaseVivante({ regles: regles(), dossier: prod, version: '1.0.0' });
  assert.equal('tables_regles' in lireEtat(prod), false);
  assert.equal(uneInstallation({ versionAvant: '1.0.0', versionApres: '1.0.0', schemaAvant: V, schemaApres: V }), false);
  assert.equal(uneInstallation({ versionAvant: '1.0.0', versionApres: '1.0.1', schemaAvant: V, schemaApres: V }), true);
  assert.equal(uneInstallation({ versionAvant: '1.0.0', versionApres: '1.0.0', schemaAvant: V - 1, schemaApres: V }), true);
  assert.equal(uneInstallation({ versionAvant: 'inconnue', versionApres: '1.0.0', schemaAvant: V, schemaApres: V }), false, 'une version inconnue ne permet pas de conclure');
});

test('le service : le site de dev fait l’essai après son ouverture, le rapport est servi par /api/debug/structure/ (ombre) et survit à un redémarrage ; la production n’en fait pas', async (t) => {
  const { db } = siteAvantInstallation(t);
  const fichierVersion = join(db, 'version-du-service.json');
  writeFileSync(fichierVersion, JSON.stringify({ version: '1.2.0', empreinte: null }));
  const livrees = regles();
  const sortie = [];
  const s = await demarrerService({ regles: livrees, dossier: db, port: 0, intervalle: 0, edition: true, metriques: false, fichierVersion, journal: (m, o) => sortie.push({ m, ...o }), essaiDeStructure: { intervalle: 0 } });
  try {
    assert.ok(s.ombre, 'le site de dev a son essai dans l’ombre');
    await s.ombre.demarrer(); // le service l'a lancé après son ouverture (setImmediate) : la promesse est celle de la file
    for (let i = 0; i < 400 && !s.ombre.lire().dernier; i += 1) await new Promise((ok) => setTimeout(ok, 50));
    const r = await fetch(`${s.url}/api/debug/structure/`);
    assert.equal(r.status, 200);
    const corps = await r.json();
    assert.equal(corps.format, FORMAT_DE_L_ETAT);
    assert.equal(corps.dernier, null, 'aucun essai avant installation : le champ d’avant est inchangé');
    assert.deepEqual(Object.keys(corps.ombre).sort(), ['dernier', 'en_cours']);
    assert.equal(corps.ombre.en_cours, null);
    assert.equal(corps.ombre.dernier.format, FORMAT_DE_L_OMBRE);
    assert.ok(VERDICTS_DE_L_OMBRE.includes(corps.ombre.dernier.verdict));
    assert.equal(corps.ombre.dernier.verdict, 'identique');
    assert.deepEqual(corps.ombre.dernier.version, { avant: '1.0.0', apres: '1.2.0' });
    assert.ok(sortie.some((l) => l.categorie === 'base' && /^structure : essai dans l’ombre/.test(l.m)));
  } finally {
    await s.arreter();
  }
  assert.deepEqual(copies(db), []);
  // redémarré (même version : une relance) : le rapport est relu du disque, aucun nouvel essai
  const s2 = await demarrerService({ regles: livrees, dossier: db, port: 0, intervalle: 0, edition: true, metriques: false, fichierVersion, journal: () => {}, essaiDeStructure: { intervalle: 0 } });
  try {
    const corps = await (await fetch(`${s2.url}/api/debug/structure/`)).json();
    assert.equal(corps.ombre.dernier.version.apres, '1.2.0');
    assert.equal(corps.ombre.en_cours, null);
  } finally {
    await s2.arreter();
  }
  // la production : ni essai dans l'ombre, ni empreintes gardées, ni route
  const prod = nouveauDossier('prod', t);
  const p = await demarrerService({ regles: livrees, dossier: prod, port: 0, intervalle: 0, edition: false, metriques: false, journal: () => {}, essaiDeStructure: { intervalle: 0 } });
  try {
    assert.equal(p.ombre, null);
    assert.ok(!('tables_regles' in lireEtat(prod)));
    assert.equal((await fetch(`${p.url}/api/debug/structure/`)).status, 403);
  } finally {
    await p.arreter();
  }
});

test('traiter : sans l’essai dans l’ombre, `ombre` vaut null (le champ existe toujours) ; avec, son état', () => {
  const sans = { edition: true, base: () => null, etat: () => ({}), journal: () => {}, essaiDeStructure: { lire: () => ({ format: FORMAT_DE_L_ETAT, en_cours: null, en_attente: 0, dernier: null, ombre: null }) } };
  const r = traiter({ methode: 'GET', chemin: '/api/debug/structure/', recherche: '', entetes: {}, corps: '' }, sans);
  assert.equal(r.statut, 200);
  assert.equal(r.corps.ombre, null);
});

test('le jugement d’une table : structure, ignorée, livrée par le dépôt, inconnue, inattendue, propre au site, calculée ; le verdict en découle', () => {
  const contenu = TABLES_DE_CONTENU.find((t) => classeDeLaTable(t) === CLASSES_DE_TABLES.CONTENU);
  const propre = 'personnage';
  assert.equal(classeDeLaTable(propre), CLASSES_DE_TABLES.PROPRE_AU_SITE);
  const calculee = 'lien';
  assert.equal(classeDeLaTable(calculee), CLASSES_DE_TABLES.CALCULEE);
  const memes = { [contenu]: 'aaaa' };
  const autres = { [contenu]: 'bbbb' };
  const c = (table, o) => categorieDeLaTable(table, o).categorie;
  assert.equal(c(contenu, { structure: true, reglesAvant: memes, reglesApres: autres }), 'structure');
  assert.equal(c('migration_recue'), 'ignoree');
  assert.equal(c(contenu, { reglesAvant: memes, reglesApres: autres }), 'livre_par_le_depot');
  assert.equal(c(contenu, { reglesAvant: memes, reglesApres: memes }), 'inattendu', 'les règles n’ont pas changé : la migration ne donne pas ce que donne le circuit');
  assert.equal(c(contenu, { reglesAvant: null, reglesApres: autres }), 'inconnu');
  assert.equal(c(contenu, { reglesAvant: memes, reglesApres: null }), 'inconnu');
  assert.equal(c(propre, { reglesAvant: memes, reglesApres: autres }), 'propre_au_site');
  assert.equal(c(calculee), 'calculee');
  assert.equal(c('table_inconnue_du_classement'), 'inattendu');
  // chaque catégorie a sa gravité, et le verdict suit la plus grave
  assert.deepEqual(Object.keys(GRAVITE_DES_CATEGORIES).sort(), Object.values(CATEGORIES_DE_L_OMBRE).sort());
  const e = (categorie) => ({ categorie, gravite: GRAVITE_DES_CATEGORIES[categorie] });
  assert.equal(verdictDeLOmbre([], []), 'identique');
  assert.equal(verdictDeLOmbre([e('ignoree')], []), 'identique', 'une table ignorée ne compte pas');
  assert.equal(verdictDeLOmbre([e('livre_par_le_depot'), e('ignoree')], []), 'attendu');
  assert.equal(verdictDeLOmbre([e('inconnu')], []), 'attendu');
  assert.equal(verdictDeLOmbre([e('calculee')], []), 'attendu');
  for (const grave of ['structure', 'propre_au_site', 'inattendu']) assert.equal(verdictDeLOmbre([e('livre_par_le_depot'), e(grave)], []), 'ecart', grave);
  assert.equal(verdictDeLOmbre([], ['table x : absente']), 'ecart');
});

test('les copies de l’essai dans l’ombre survivent à la purge d’un essai d’avant installation raté ; l’ouverture du service les retire toutes', async (t) => {
  const { purgerLesEssaisDeStructure } = await import('../serveur/structure-sur-place.mjs');
  const dossier = nouveauDossier('purge', t);
  const nom = (suffixe) => `structure-essai-1-00000000-0000-0000-0000-000000000000-${suffixe}.db`;
  for (const n of ['avant', 'apres', 'ombre-avant', 'ombre-apres']) writeFileSync(join(dossier, nom(n)), 'copie');
  assert.equal(purgerLesEssaisDeStructure(dossier, { ombre: false }), 2, 'un essai d’avant installation raté ne retire pas les copies de l’ombre');
  assert.deepEqual(readdirSync(dossier).sort(), [nom('ombre-apres'), nom('ombre-avant')].sort());
  assert.equal(purgerLesEssaisDeStructure(dossier), 2, 'à l’ouverture du service, toutes sont retirées');
  assert.deepEqual(readdirSync(dossier), []);
});

test('le crochet de l’essai : une erreur de `preparer` n’arrête pas la reconstruction (dite dans `ombre.erreur`) ; une reconstruction qui échoue après lui appelle `annuler`', (t) => {
  const { db } = siteAvantInstallation(t);
  const regles2 = regles();
  const appels = [];
  const faux = (preparer) => ({ preparer, annuler: () => appels.push('annuler') });
  const r = preparerBaseVivante({ regles: regles2, dossier: db, version: '1.1.0', ombre: faux(() => { throw new Error('copie impossible'); }) });
  assert.equal(r.refaite, true, 'la base est refaite malgré l’erreur du crochet');
  assert.equal(r.ombre.programme, false);
  assert.match(r.ombre.erreur, /copie impossible/);
  assert.deepEqual(appels, [], 'rien à annuler : la reconstruction a abouti');

  // une reconstruction qui échoue APRÈS le crochet (vivante.json ne peut pas être écrit : c'est un dossier) : les copies gardées sont annulées, l'erreur remonte
  const autre = siteAvantInstallation(t);
  rmSync(join(autre.db, 'vivante.json'));
  mkdirSync(join(autre.db, 'vivante.json'));
  let preparations = 0;
  assert.throws(() => preparerBaseVivante({ regles: regles2, dossier: autre.db, version: '1.1.0', ombre: { preparer: () => { preparations += 1; return { programme: true }; }, annuler: () => appels.push('annuler') } }));
  assert.equal(preparations, 1, 'le crochet a bien été appelé avant l’échec');
  assert.deepEqual(appels, ['annuler']);
});
