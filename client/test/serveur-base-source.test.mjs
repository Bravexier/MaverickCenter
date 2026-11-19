// La base source (lot 8 du chantier de la base de dev, garde-fous 5 et 6 ; serveur/base-source.mjs ; docs/serveur.md, « Base source (lot 8) ») : avec le fichier
// db/source, la base vivante n'est jamais refaite depuis les règles ; absente, le service ne démarre pas ; ses migrations livrées sont essayées sur une copie
// puis appliquées sur place avant toute écriture, et sa structure comparée au schema.sql livré (un refus laisse la base intacte et arrête le service) ;
// un lot de changements vaut alors pour les tables hors édition. Sans le marqueur, rien ne change.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { traiter } from '../serveur/api.mjs';
import { FICHIER_SOURCE, estUneBaseSource, preparerBaseSource } from '../serveur/base-source.mjs';
import { lireEtat, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { DOSSIER_DES_ESSAIS } from '../serveur/essai-de-structure.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { lireLesMigrations } from '../serveur/structure-sur-place.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { LIVRAISON, NUMERO, baseDesRegles, baseRemplie, etatDuFichier, nouveauDossier, schemaDuDepot } from './aide-structure-sur-place.mjs';

const JSON_ = { 'content-type': 'application/json' };
/**
 * La version livrée (la dernière migration de la livraison des tests, test/aide-structure-sur-place.mjs#LIVRAISON : celle du dépôt, ou au-dessus du plancher
 * quand les migrations mixtes sont sorties) et les migrations que la base d'avant reçoit : celle qui crée `migration_recue` et les suivantes.
 */
const LIVREES = lireLesMigrations({ ...LIVRAISON, schema: false }).migrations;
const V = LIVREES.at(-1).numero;
const APPLIQUEES = LIVREES.filter((m) => m.numero >= NUMERO).map((m) => m.numero);
const marquer = (dossier) => writeFileSync(join(dossier, FICHIER_SOURCE), 'format=maverick-source/1\n');
const fichiers = (dossier) => (existsSync(dossier) ? readdirSync(dossier) : []);
const compter = (chemin, table) => {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
  } finally {
    db.close();
  }
};
const versionDe = (chemin) => {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return db.prepare('PRAGMA user_version').get().user_version;
  } finally {
    db.close();
  }
};

/** Démarre le service du site de dev sur `dossier` (la livraison des tests, sauf `structure`) ; `lignes` reçoit le journal. Rend { service, lignes } ou rejette (le service ne démarre pas). */
async function demarrer(dossier, { regles = baseDesRegles(), intervalle = 0, structure = { ...LIVRAISON }, lignes = [] } = {}) {
  const service = await demarrerService({
    regles, dossier, port: 0, intervalle, edition: true, metriques: false, tipeee: false, atelier: false, attestation: false,
    essaiDeStructure: { intervalle: 0 }, journal: (m) => lignes.push(String(m)), structure,
  });
  return { service, lignes };
}
const etatHttp = async (service) => (await fetch(`${service.url}/api/etat/`)).json();
/** Attend que `condition()` soit vraie (au plus 5 s). */
async function attendre(condition, quoi) {
  for (let i = 0; i < 250; i += 1) {
    if (condition()) return;
    await new Promise((ok) => setTimeout(ok, 20));
  }
  assert.fail(`délai dépassé : ${quoi}`);
}

/** Des migrations livrées d'essai : celles de la livraison des tests, plus `en_plus` ({ nom → SQL }) ; et un schema.sql (celui du dépôt, à la version `version`, plus `ajout`). */
function livraisonDEssai(t, { en_plus = {}, version = V, ajout = '' } = {}) {
  const d = nouveauDossier('livraison', t);
  const migrations = join(d, 'migrations');
  mkdirSync(migrations);
  for (const m of LIVREES) copyFileSync(join(LIVRAISON.migrations, m.fichier), join(migrations, m.fichier));
  for (const [nom, sql] of Object.entries(en_plus)) writeFileSync(join(migrations, nom), sql);
  const schema = join(d, 'schema.sql');
  writeFileSync(schema, `${schemaDuDepot().replace(/^PRAGMA user_version\s*=\s*\d+;/m, `PRAGMA user_version = ${version};`)}${ajout}`);
  return { migrations, schema };
}

test('sans le marqueur : la base est faite depuis les règles comme avant, /api/etat dit source: false', async (t) => {
  const dossier = nouveauDossier('sans-marqueur', t);
  assert.equal(estUneBaseSource(dossier), false);
  const { service } = await demarrer(dossier);
  try {
    const e = await etatHttp(service);
    assert.equal(e.base.disponible, true);
    assert.equal(e.base.source, false);
    assert.equal(e.base.sur_place, null);
    assert.equal(lireEtat(dossier).source, undefined, 'vivante.json ne parle pas de la base source');
    assert.ok(lireEtat(dossier).refaite_le, 'la base a été faite depuis les règles');
  } finally {
    await service.arreter();
  }
});

test('marqueur, base absente : le service ne démarre pas, l’erreur le dit, rien n’est créé depuis les règles (garde-fou 6)', async (t) => {
  const dossier = nouveauDossier('absente', t);
  marquer(dossier);
  const lignes = [];
  await assert.rejects(demarrer(dossier, { lignes }), /base source absente : .*vivante\.db, la restaurer depuis une sauvegarde, jamais depuis le dépôt/);
  assert.ok(lignes.some((l) => /^ATTENTION base source absente/.test(l)), lignes.join('\n'));
  assert.equal(existsSync(join(dossier, 'vivante.db')), false, 'aucune base créée depuis les règles');
  assert.equal(existsSync(join(dossier, 'vivante.json')), false);
});

test('marqueur, base d’une version d’avant et remplie : migrations essayées sur une copie puis appliquées sur place, sauvegarde, fiches intactes ; /api/etat et vivante.json le disent (garde-fou 5)', async (t) => {
  const dossier = nouveauDossier('migree', t);
  const { chemin: remplie } = baseRemplie({ anterieure: true });
  const vivante = join(dossier, 'vivante.db');
  copyFileSync(remplie, vivante);
  marquer(dossier);
  const fiches = compter(vivante, 'personnage');
  assert.ok(fiches > 0, 'la base porte des fiches');
  const lignes = [];
  const { service } = await demarrer(dossier, { lignes });
  try {
    assert.equal(versionDe(vivante), V, 'la base est à la version livrée');
    assert.equal(compter(vivante, 'personnage'), fiches, 'les fiches sont restées');
    const db = new DatabaseSync(vivante, { readOnly: true });
    try {
      assert.deepEqual(db.prepare("SELECT numero, mode FROM migration_recue WHERE numero = ?").all(NUMERO).map((l) => ({ ...l })), [{ numero: NUMERO, mode: 'sur_place' }]);
    } finally {
      db.close();
    }
    const sauvegardes = fichiers(join(dossier, 'archives')).filter((f) => /^structure-.+-v\d+\.db$/.test(f));
    assert.equal(sauvegardes.length, 1, 'une sauvegarde d’avant l’application');
    assert.equal(versionDe(join(dossier, 'archives', sauvegardes[0])), NUMERO - 1, 'la sauvegarde est la base d’avant');
    assert.deepEqual(fichiers(join(dossier, DOSSIER_DES_ESSAIS)).filter((f) => /\.db/.test(f)), [], 'les copies de l’essai sont effacées');
    assert.equal(fichiers(dossier).filter((f) => /^vivante-/.test(f)).length, 0);
    const enregistre = lireEtat(dossier);
    assert.equal(enregistre.source, true);
    assert.deepEqual(enregistre.sur_place.migrations.map((m) => m.numero), APPLIQUEES);
    assert.equal(enregistre.sur_place.sauvegarde, sauvegardes[0]);
    const e = await etatHttp(service);
    assert.equal(e.base.disponible, true);
    assert.equal(e.base.source, true);
    assert.equal(e.base.sur_place.apres, V);
    assert.equal(e.base.refaite_le ?? null, null, 'la base n’a jamais été refaite');
    const debug = await (await fetch(`${service.url}/api/debug/structure/`)).json();
    assert.equal(debug.base_source.source, true);
    assert.deepEqual(debug.base_source.sur_place.migrations.map((m) => m.numero), APPLIQUEES);
    assert.equal(debug.ombre, null, 'pas d’essai dans l’ombre pour une base source');
    assert.ok(lignes.some((l) => l.includes(`structure : base source migrée sur place, version ${NUMERO - 1} → ${V}`)), lignes.join('\n'));
  } finally {
    await service.arreter();
  }
});

test('marqueur : ni le fichier des règles changé ni la base retirée ne la font refaire ; une base retirée n’est pas recréée', async (t) => {
  const dossier = nouveauDossier('jamais-refaite', t);
  const { chemin: remplie } = baseRemplie();
  const vivante = join(dossier, 'vivante.db');
  copyFileSync(remplie, vivante);
  marquer(dossier);
  const regles = join(nouveauDossier('regles', t), 'maverick.db');
  copyFileSync(baseDesRegles(), regles);
  const lignes = [];
  const { service } = await demarrer(dossier, { regles, intervalle: 20, lignes });
  try {
    const avant = etatDuFichier(vivante);
    // d'autres règles : une ligne de contenu de plus, que la base source ne doit jamais recevoir
    const db = new DatabaseSync(regles);
    db.exec("UPDATE famille SET libelle = libelle || ' (règles changées)' WHERE id = (SELECT min(id) FROM famille)");
    db.close();
    await attendre(() => lignes.some((l) => /base des règles changée : la base est la source/.test(l)), 'la surveillance voit les règles changées');
    assert.deepEqual(etatDuFichier(vivante), avant, 'la base n’a pas été refaite');
    assert.equal(lireEtat(dossier).refaite_le ?? null, null);
    rmSync(vivante);
    await attendre(() => lignes.some((l) => /^ATTENTION base source absente/.test(l)), 'la base retirée est signalée');
    await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(existsSync(vivante), false, 'elle n’est pas recréée depuis les règles');
    const e = await etatHttp(service);
    assert.equal(e.base.disponible, false);
    assert.equal(e.base.source, true);
  } finally {
    await service.arreter();
  }
});

test('marqueur : une migration que l’essai refuse arrête le service avant toute écriture ; base intacte, aucune copie ni sauvegarde laissée', async (t) => {
  const dossier = nouveauDossier('refusee', t);
  const { chemin: remplie } = baseRemplie({ anterieure: true });
  const vivante = join(dossier, 'vivante.db');
  copyFileSync(remplie, vivante);
  marquer(dossier);
  const avant = etatDuFichier(vivante);
  const structure = livraisonDEssai(t, { en_plus: { [`${String(V + 1).padStart(4, '0')}-cassee.sql`]: 'INSERT INTO table_qui_n_existe_pas VALUES (1);\n' }, version: V + 1 });
  const lignes = [];
  await assert.rejects(demarrer(dossier, { structure, lignes }), (e) => e.name === 'ErreurBaseSource' && e.etape === 'essai');
  assert.deepEqual(etatDuFichier(vivante), avant, 'la base est intacte');
  assert.deepEqual(fichiers(join(dossier, DOSSIER_DES_ESSAIS)).filter((f) => /\.db/.test(f)), [], 'les copies de l’essai sont effacées');
  assert.deepEqual(fichiers(join(dossier, 'archives')), [], 'aucune sauvegarde : rien n’a été appliqué');
  assert.ok(lignes.some((l) => /^ATTENTION base source : l’essai des migrations sur une copie est « refuse »/.test(l)), lignes.join('\n'));
});

test('marqueur : une structure qui n’est pas celle du schema.sql livré arrête le service, base intacte', async (t) => {
  const dossier = nouveauDossier('autre-structure', t);
  const { chemin: remplie } = baseRemplie();
  const vivante = join(dossier, 'vivante.db');
  copyFileSync(remplie, vivante);
  marquer(dossier);
  const avant = etatDuFichier(vivante);
  const structure = livraisonDEssai(t, { ajout: '\nCREATE TABLE essai_en_trop (id INTEGER PRIMARY KEY) STRICT;\n' });
  await assert.rejects(demarrer(dossier, { structure }), (e) => e.etape === 'schema' && e.details.some((d) => /essai_en_trop/.test(d)));
  assert.deepEqual(etatDuFichier(vivante), avant);
  // et une base plus récente que la livraison (une publication plus ancienne installée) : refusée de même
  const ancienne = livraisonDEssai(t, { version: V });
  rmSync(join(ancienne.migrations, readdirSync(ancienne.migrations).sort().at(-1)));
  writeFileSync(ancienne.schema, schemaDuDepot().replace(/^PRAGMA user_version\s*=\s*\d+;/m, `PRAGMA user_version = ${V - 1};`));
  assert.throws(() => preparerBaseSource({ dossier, migrations: ancienne.migrations, schema: ancienne.schema }), (e) => e.etape === 'schema' && e.details.some((d) => /user_version/.test(d)));
  assert.deepEqual(etatDuFichier(vivante), avant);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les lots de changements d'une base source : toutes les tables de contenu (la voie générique du journal)
// ---------------------------------------------------------------------------------------------------------------------------------------------
test('base source : un lot vaut pour une table hors édition (voie générique du journal) ; sans le marqueur il est refusé au dépôt', async (t) => {
  const dossier = nouveauDossier('lots', t);
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier }).chemin;
  const db = ouvrirBaseVivante(chemin);
  t.after(() => db.close());
  let source = false;
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan: false }, source: () => source };
  const appel = (methode, adresse, corps) => traiter({ methode, chemin: adresse, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  // `dieu` : une table de contenu que le service d'édition ne sait pas écrire ; la ligne d'essai se choisit dans l'état courant
  const dieu = { ...db.prepare('SELECT id, remarque FROM dieu ORDER BY id LIMIT 1').get() };
  const texte = `Remarque posée par l’essai de la base source ${process.pid}`;
  const lot = { format: 'maverick-lot/1', titre: 'Lot hors édition', nature: 'code', operations: [{ table: 'dieu', cle: { id: dieu.id }, operation: 'modifier', avant: { remarque: dieu.remarque }, apres: { remarque: texte } }] };

  const refuse = await appel('POST', '/api/edition/lots/', lot);
  assert.equal(refuse.statut, 400, JSON.stringify(refuse.corps));
  assert.match(JSON.stringify(refuse.corps), /hors édition|ne sait pas encore l'écrire/);

  source = true;
  const depose = await appel('POST', '/api/edition/lots/', lot);
  assert.equal(depose.statut, 201, JSON.stringify(depose.corps));
  assert.equal(depose.corps.verdict, 'applicable');
  const applique = await appel('POST', `/api/edition/lots/${depose.corps.id}/appliquer/`, {});
  assert.equal(applique.statut, 200, JSON.stringify(applique.corps));
  assert.equal(db.prepare('SELECT remarque FROM dieu WHERE id = ?').get(dieu.id).remarque, texte, 'la valeur est écrite dans la base');
  const trace = db.prepare("SELECT operation, etat FROM modification WHERE table_nom = 'dieu' AND cle = ?").all(JSON.stringify({ id: dieu.id })).map((l) => ({ ...l }));
  assert.deepEqual(trace, [{ operation: 'modifier', etat: 'en_attente' }], 'l’écriture passe par le journal de l’édition');
});
