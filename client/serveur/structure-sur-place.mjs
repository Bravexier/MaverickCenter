// Un changement de structure appliqué sur place (lot 7 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/serveur.md,
// « Changement de structure appliqué sur place » ; plan : docs/chantier-base-de-dev.md). Le service sait appliquer les migrations livrées
// (data/migrations/NNNN-<nom>.sql, jointes à la livraison : serveur/livraison.mjs#FICHIERS_JOINTS) à une base en place : sauvegarde, UN SEUL bloc, clés
// étrangères contrôlées, schéma obtenu comparé à data/schema.sql, une ligne `migration_recue` par migration. Les mêmes garde-fous que
// tools/db/maverick.py#migrer. Sans le marqueur db/source, la base vivante est refaite depuis les règles, et ce module sert à l'ESSAI (sur une copie, dans
// un fil à part, copie toujours effacée) et à noter les migrations d'une base refaite ; avec lui (lot 8, serveur/base-source.mjs), le service migre sa vraie
// base sur place au démarrage, après un essai sur une copie.
//
//   lireLesMigrations      les migrations livrées (numéro, fichier, SQL, sha256 des octets) et le schema.sql attendu ;
//   appliquerSurPlace      les migrations de numéro > user_version, d'un bloc ; refus (ErreurStructure) et retour arrière complet au moindre écart ;
//   essayerSurUneCopie     une copie de la base (VACUUM INTO), l'application, le bilan, la copie effacée ; `essayerEnArrierePlan` : dans un fil à part (`executerEnArrierePlan` :
//                          la file commune, un travail à la fois ; l'autre travail est l'essai dans l'ombre, serveur/essai-dans-l-ombre.mjs) ;
//   noterLesMigrationsRecues  à la reconstruction de la base vivante : serveur/base-vivante.mjs#preparerBaseVivante ;
//   ecartsAvecLeSchema     la structure d'une base comparée au schema.sql attendu (la base source, serveur/base-source.mjs : lot 8).
// Le service importe seulement des modules de Node et de serveur/ : ce module sert aussi de fil de travail (comme serveur/edition-lots.mjs).
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { OMBRES_DE_RECHERCHE } from '../src/lib/tables-de-la-base.mjs';
import { colonnesDeLaTable, empreinteDeLaTable, identifiant } from './empreintes.mjs';
import { instant as ecrireInstant } from './instant.mjs';
import { sha256 } from './partage.mjs';

export const TABLE_DES_MIGRATIONS_RECUES = 'migration_recue';
export const FORMAT_DU_BILAN = 'maverick-structure/1';
/** Le nom d'une migration livrée : « NNNN-<nom>.sql » (celui que la table `migration_recue` accepte) ; les registres `.json` ne sont pas des migrations. */
const NOM_DE_MIGRATION = /^(\d{4})-[a-z0-9.-]+\.sql$/;
/** Une version de site que la colonne `version_du_site` accepte : X.Y.Z, trois nombres ; une autre (« 1.2.3-dev ») est notée NULL. */
const VERSION_STRICTE = /^\d+\.\d+\.\d+$/;
const ZEROS = (n) => String(n).padStart(4, '0');

/** Un refus de changement de structure : `migration` (le numéro, null si le refus ne vise pas une migration), `etape`, `details` (lignes de détail). */
export class ErreurStructure extends Error {
  /** @param {string} message @param {{ migration?: number | null, fichier?: string | null, etape: string, details?: string[] }} o */
  constructor(message, { migration = null, fichier = null, etape, details = [] }) {
    super(message);
    this.name = 'ErreurStructure';
    this.migration = migration;
    this.fichier = fichier;
    this.etape = etape;
    this.details = details;
  }

  /** Le refus sous forme de JSON (dans un bilan). */
  enJson() {
    return { migration: this.migration, fichier: this.fichier, etape: this.etape, raison: this.message, details: this.details.slice(0, 20) };
  }
}

/** La version du site telle que `migration_recue.version_du_site` la note : X.Y.Z, sinon null. */
export const versionDuSite = (version) => (typeof version === 'string' && VERSION_STRICTE.test(version) ? version : null);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les migrations livrées
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Où lire `data/<sous-chemin>` : dans le service livré, sous _serveur/data/ (serveur/livraison.mjs#FICHIERS_JOINTS) ; dans le dépôt, sous data/ à la
 * racine (comme serveur/edition.mjs#registreDes0113). null s'il est absent.
 */
function emplacementDesDonnees(sousChemin) {
  const fichier = [new URL(`../data/${sousChemin}`, import.meta.url), new URL(`../../data/${sousChemin}`, import.meta.url)].find((u) => existsSync(u));
  return fichier ? fileURLToPath(fichier) : null;
}

/**
 * Les migrations livrées et le schema.sql attendu : { dossier, migrations: [{ numero, fichier, empreinte, sql? }] (par numéro), schema (le SQL, null s'il
 * est absent) } ; null quand le dossier des migrations est absent (le service dit alors qu'il ne les a pas). `empreinte` : le sha256 des octets du `.sql`
 * (jamais le `.json` de son registre). Un fichier qui n'est pas « NNNN-<nom>.sql » est ignoré ; deux fichiers du même numéro sont une erreur.
 * @param {{ migrations?: string | null, schema?: string | null | false, avecSql?: boolean }} [o] `migrations` : dossier (undefined : celui de la livraison ;
 *   null : aucun) ; `schema` : chemin du schema.sql attendu (undefined : celui de la livraison ; false : pas lu) ; `avecSql` faux : sans le texte des migrations
 */
export function lireLesMigrations({ migrations, schema, avecSql = true } = {}) {
  const dossier = migrations === undefined ? emplacementDesDonnees('migrations') : migrations;
  if (!dossier || !existsSync(dossier)) return null;
  const liste = [];
  for (const nom of readdirSync(dossier).sort()) {
    const m = NOM_DE_MIGRATION.exec(nom);
    if (!m || Number(m[1]) < 1) continue;
    const octets = readFileSync(join(dossier, nom));
    if (liste.some((x) => x.numero === Number(m[1]))) throw new Error(`migrations livrées : deux fichiers portent le numéro ${m[1]} (${liste.find((x) => x.numero === Number(m[1])).fichier}, ${nom})`);
    liste.push({ numero: Number(m[1]), fichier: nom, empreinte: sha256(octets), ...(avecSql ? { sql: octets.toString('utf8') } : {}) });
  }
  const fichierSchema = schema === false ? null : (schema === undefined ? emplacementDesDonnees('schema.sql') : schema);
  return { dossier, migrations: liste, schema: fichierSchema && existsSync(fichierSchema) ? readFileSync(fichierSchema, 'utf8') : null };
}

/** La version que porte un schema.sql (son `PRAGMA user_version = N;`), null s'il n'en porte pas. */
export function versionDuSchemaSql(sql) {
  const m = /^\s*PRAGMA\s+user_version\s*=\s*(\d+)\s*;/im.exec(String(sql ?? ''));
  return m ? Number(m[1]) : null;
}

/**
 * La version qu'apporte une livraison (`lireLesMigrations`) : la plus haute de sa dernière migration et de son schema.sql ; null sans l'une ni l'autre.
 * Le schema.sql est le PLANCHER de la structure : quand des migrations quittent le dépôt (les migrations mixtes, R296 ; docs/chantier-base-de-dev.md,
 * « Les lecteurs des migrations mixtes »), il garde leur version et seules les migrations de numéro supérieur s'appliquent ; une base en dessous est
 * refusée (une migration manque) et se refait depuis le schéma. Tant que la dernière migration est dans le dépôt, les deux sont égales.
 */
export function versionLivree(livre) {
  const versions = [livre?.migrations?.at(-1)?.numero, versionDuSchemaSql(livre?.schema)].filter((v) => Number.isInteger(v));
  return versions.length ? Math.max(...versions) : null;
}

/**
 * Le refus d'une base sous le plancher (`versionLivree`) sans migration livrée pour y monter : les migrations qui y mènent ont quitté le dépôt. Rend une
 * ErreurStructure (étape `plancher`, `migration` : la première qui manque), ou null quand la base est au plancher ou au-dessus, ou quand une migration est à
 * appliquer (c'est alors `appliquerSurPlace` qui juge la suite des versions). Partagé par l'essai sur une copie et la préparation de la base source.
 */
export function refusSousLePlancher(livre, avant) {
  if (migrationsAAppliquer(livre?.migrations ?? [], avant).length) return null;
  const derniere = versionLivree(livre);
  if (derniere === null || avant >= derniere) return null;
  return new ErreurStructure(`la base est à la version ${avant}, sous le plancher de la structure (schema.sql, version ${derniere}) : les migrations ${ZEROS(avant + 1)} à ${ZEROS(derniere)} ne sont pas livrées (une migration manque)`,
    { migration: avant + 1, etape: 'plancher' });
}

/** Les migrations de numéro > `version` (celle de la base, PRAGMA user_version), par numéro. */
export const migrationsAAppliquer = (migrations, version) => migrations.filter((m) => m.numero > version).sort((a, b) => a.numero - b.numero);

/**
 * Ce qu'une migration ne doit pas porter : BEGIN, COMMIT, END (synonyme de COMMIT), ROLLBACK, PRAGMA en tête d'une instruction (le service ouvre la transaction et contrôle les clés
 * étrangères ; un PRAGMA foreign_keys est sans effet dans un bloc). Les commentaires et le texte des chaînes ne comptent pas. Rend le mot trouvé, ou null.
 */
export function migrationInterdite(sql) {
  const sansLitteraux = String(sql).replace(/('(?:[^']|'')*')|--[^\n]*|\/\*[\s\S]*?\*\//g, (m, litteral) => (litteral ? "''" : ' '));
  // le BEGIN … END d'un déclencheur est le sien : son corps ne compte pas
  const sansTexte = sansLitteraux.replace(/\bCREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b[\s\S]*?;\s*END\b/gi, ' ');
  const trouve = /(?:^|;)\s*(BEGIN|COMMIT|END|ROLLBACK|PRAGMA)\b/i.exec(sansTexte);
  return trouve ? trouve[1].toUpperCase() : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La comparaison des structures (portage de tools/db/maverick.py#_normaliser_sql et comparer_schemas)
// ---------------------------------------------------------------------------------------------------------------------------------------------
const LITTERAL_OU_COMMENTAIRE = /('(?:[^']|'')*')|--[^\n]*/g;

/**
 * Le SQL d'un objet comparable : un commentaire « -- » hors d'une chaîne seulement (le « '*--*' » des CHECK de clés n'en est pas un), guillemets
 * d'identifiants, espaces et casse ignorés.
 */
export function normaliserLeSql(sql) {
  let s = String(sql ?? '').replace(LITTERAL_OU_COMMENTAIRE, (m, litteral) => litteral ?? '');
  s = s.replace(/"([A-Za-z_][A-Za-z_0-9]*)"/g, '$1');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s.replace(/ ?([,()]) ?/g, '$1').replace(/;+$/, '');
}

const ombreDeRecherche = (nom) => /_(data|idx|content|docsize|config)$/.test(nom); // tables d'ombre de FTS5 (même règle que comparer_schemas)

function objetsComparables(db) {
  const objets = new Map();
  for (const o of db.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL").all()) {
    if (o.type === 'table' && ombreDeRecherche(o.name)) continue;
    objets.set(JSON.stringify([o.type, o.name]), { type: o.type, nom: o.name, sql: normaliserLeSql(o.sql) });
  }
  return objets;
}

/**
 * Les écarts entre deux bases : tables, colonnes (dans l'ordre), index, vues, déclencheurs. `migree` est la base obtenue, `attendu` celle que décrit
 * schema.sql. Vide : mêmes structures. Une colonne ajoutée doit se placer EN DERNIER dans schema.sql (l'ordre des colonnes compte).
 * @returns {string[]}
 */
export function comparerLesSchemas(migree, attendu) {
  const a = objetsComparables(migree);
  const b = objetsComparables(attendu);
  const tri = (cles) => [...cles].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  const ecarts = [];
  for (const cle of tri([...b.keys()].filter((k) => !a.has(k)))) ecarts.push(`${b.get(cle).type} ${b.get(cle).nom} : absent de la base migrée`);
  for (const cle of tri([...a.keys()].filter((k) => !b.has(k)))) ecarts.push(`${a.get(cle).type} ${a.get(cle).nom} : absent du schéma attendu`);
  const communs = tri([...a.keys()].filter((k) => b.has(k)));
  for (const cle of communs) {
    if (a.get(cle).sql !== b.get(cle).sql) {
      const { type, nom } = a.get(cle);
      ecarts.push(`${type} ${nom} : définition différente\n      migrée  : ${a.get(cle).sql.slice(0, 160)}\n      attendu : ${b.get(cle).sql.slice(0, 160)}`);
    }
  }
  for (const cle of communs) {
    const { type, nom } = a.get(cle);
    if (type !== 'table') continue;
    const lire = (db) => db.prepare(`PRAGMA table_xinfo(${identifiant(nom)})`).all().map((r) => [r.name, r.type, r.notnull, r.dflt_value, r.pk, r.hidden]);
    const ca = lire(migree);
    const cb = lire(attendu);
    if (JSON.stringify(ca) !== JSON.stringify(cb)) ecarts.push(`table ${nom} : colonnes (ou leur ordre) différentes : ${JSON.stringify(ca.map((c) => c[0]))} / ${JSON.stringify(cb.map((c) => c[0]))}`);
  }
  return ecarts;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'application, d'un seul bloc
// ---------------------------------------------------------------------------------------------------------------------------------------------
const versionDeLaBase = (db) => db.prepare('PRAGMA user_version').get().user_version;
const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
const plage = (migrations) => (migrations.length === 1 ? `la migration ${ZEROS(migrations[0].numero)}` : `les migrations ${ZEROS(migrations[0].numero)} à ${ZEROS(migrations.at(-1).numero)}`);

/** Le nom d'une sauvegarde d'avant les migrations : `structure-<instant>-v<version d'avant>.db` (l'ordre alphabétique est l'ordre chronologique). */
const nomDeLaSauvegarde = (instant, avant) => `structure-${instant.toISOString().replace(/[:.]/g, '-')}-v${avant}.db`;

/**
 * Une copie cohérente de la base en place (VACUUM INTO : jamais une copie de fichier à moitié écrit) dans `dossier`, AVANT toute écriture. Rend son chemin.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function sauvegarderAvant(db, dossier, { instant = new Date(), version = versionDeLaBase(db) } = {}) {
  mkdirSync(dossier, { recursive: true });
  let fichier = join(dossier, nomDeLaSauvegarde(instant, version));
  if (existsSync(fichier)) fichier = join(dossier, nomDeLaSauvegarde(instant, version).replace(/\.db$/, `-${randomUUID().slice(0, 8)}.db`));
  try {
    db.prepare('VACUUM INTO ?').run(fichier);
  } catch (e) {
    rmSync(fichier, { force: true });
    throw new ErreurStructure(`sauvegarde impossible avant les migrations : ${e.message}`, { etape: 'sauvegarde' });
  }
  if (!existsSync(fichier) || statSync(fichier).size === 0) throw new ErreurStructure('sauvegarde vide avant les migrations', { etape: 'sauvegarde' });
  return fichier;
}

/** Le schema.sql attendu, rejoué dans une base en mémoire (sans clés étrangères : c'est une structure, pas des lignes). */
function schemaAttendu(sql) {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  try {
    db.exec(sql);
  } catch (e) {
    db.close();
    throw new ErreurStructure(`le schema.sql attendu ne se rejoue pas : ${e.message}`, { etape: 'schema_attendu' });
  }
  return db;
}

/**
 * Les écarts entre la structure d'une base et le schema.sql attendu (`sql`), `user_version` comprise : vide quand la base est exactement celle que décrit
 * schema.sql. Sert à la base source (serveur/base-source.mjs) : sans migration à appliquer, sa structure doit déjà être celle de la livraison. Lève une
 * ErreurStructure (`schema_attendu`) si `sql` ne se rejoue pas.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} sql
 * @returns {string[]}
 */
export function ecartsAvecLeSchema(db, sql) {
  const attendu = schemaAttendu(sql);
  try {
    const ecarts = [];
    if (versionDeLaBase(db) !== versionDeLaBase(attendu)) ecarts.push(`user_version : ${versionDeLaBase(db)} dans la base, ${versionDeLaBase(attendu)} dans le schema.sql attendu`);
    return [...ecarts, ...comparerLesSchemas(db, attendu)];
  } finally {
    attendu.close();
  }
}

const resumeDesCles = (violations) => {
  const par = new Map();
  for (const v of violations) par.set(`${v.table} → ${v.parent}`, (par.get(`${v.table} → ${v.parent}`) ?? 0) + 1);
  return [...par].map(([cle, n]) => `${cle} : ${n} ligne(s)`);
};

/**
 * Applique les migrations de numéro > user_version à `db` (la base en place, ouverte en écriture), d'UN SEUL bloc (les mêmes garde-fous que
 * tools/db/maverick.py#migrer) :
 *   - une migration qui porte BEGIN, COMMIT, END, ROLLBACK ou PRAGMA est refusée ; les numéros se suivent un à un à partir de user_version + 1 ;
 *   - la sauvegarde d'abord (`sauvegarde: { dossier }`), jamais après ; `sauvegarde: false` : aucune (l'essai sur une copie) ; l'option est obligatoire ;
 *   - `foreign_keys` coupées pendant le bloc (rétablies ensuite), PRAGMA foreign_key_check vide après CHAQUE migration ;
 *   - user_version posé, puis le schéma obtenu comparé à `schema` (le schema.sql attendu, à la version de la dernière migration) ;
 *   - les lignes `migration_recue` de numéro > user_version d'avant sont retirées (dans le bloc), puis une ligne (mode « sur_place ») par migration, si la base a la table ;
 *   - ROLLBACK complet au moindre écart : ErreurStructure dit quelle migration et pourquoi, la base est comme avant.
 * @param {import('node:sqlite').DatabaseSync} db hors transaction
 * @param {{ migrations: { numero: number, fichier: string, empreinte: string, sql: string }[], schema: string | null,
 *   sauvegarde: { dossier: string } | false, instant?: Date, version?: string | null }} o `version` : celle du site qui applique (notée si X.Y.Z)
 * @returns {{ avant: number, apres: number, appliquees: { numero: number, fichier: string, empreinte: string }[], sauvegarde: string | null, notees: boolean, duree_ms: number }}
 */
export function appliquerSurPlace(db, { migrations, schema, sauvegarde, instant = new Date(), version = null }) {
  if (sauvegarde === undefined) throw new Error('appliquerSurPlace : `sauvegarde` est obligatoire ({ dossier } ou false)');
  if (db.isTransaction) throw new Error('appliquerSurPlace : la base ne doit pas être dans une transaction');
  const t0 = performance.now();
  const avant = versionDeLaBase(db);
  const choisies = migrationsAAppliquer(migrations, avant);
  if (!choisies.length) return { avant, apres: avant, appliquees: [], sauvegarde: null, notees: false, duree_ms: 0 };

  // 1. ce qu'on ne laisse pas passer, avant d'écrire quoi que ce soit
  choisies.forEach((m, i) => {
    if (m.numero !== avant + 1 + i) {
      throw new ErreurStructure(`la migration ${ZEROS(avant + 1 + i)} manque : les versions se suivent une à une (la base est à la version ${avant}, la suivante livrée est ${m.fichier})`,
        { migration: avant + 1 + i, etape: 'suite' });
    }
    const mot = migrationInterdite(m.sql);
    if (mot) {
      throw new ErreurStructure(`la migration ${m.fichier} porte ${mot} : elle ne gère ni ses transactions ni ses PRAGMA (le service ouvre la transaction et contrôle les clés étrangères)`,
        { migration: m.numero, fichier: m.fichier, etape: 'interdit' });
    }
  });
  if (schema === null || schema === undefined) throw new ErreurStructure('le schema.sql attendu n’est pas livré : le schéma obtenu ne pourrait pas être comparé', { etape: 'schema_attendu' });
  const attendu = schemaAttendu(schema);
  try {
    const derniere = choisies.at(-1);
    if (versionDeLaBase(attendu) !== derniere.numero) {
      throw new ErreurStructure(`le schema.sql attendu est à la version ${versionDeLaBase(attendu)}, la dernière migration livrée est ${derniere.fichier}`,
        { migration: derniere.numero, fichier: derniere.fichier, etape: 'schema_attendu' });
    }

    // 2. la sauvegarde, avant toute écriture
    const copie = sauvegarde ? sauvegarderAvant(db, sauvegarde.dossier, { instant, version: avant }) : null;

    // 3. le bloc : clés étrangères suspendues (un PRAGMA n'a d'effet qu'hors transaction), puis une seule transaction
    const cles = db.prepare('PRAGMA foreign_keys').get().foreign_keys;
    db.exec('PRAGMA foreign_keys = OFF');
    let courante = null;
    let notees = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        // d'abord, les lignes d'une migration que cette base n'a pas reçue (numéro > user_version : retour à une version plus ancienne), comme à la reconstruction
        if (tableExiste(db, TABLE_DES_MIGRATIONS_RECUES)) db.prepare(`DELETE FROM ${TABLE_DES_MIGRATIONS_RECUES} WHERE numero > ?`).run(avant);
        for (const m of choisies) {
          courante = m;
          try {
            db.exec(m.sql);
          } catch (e) {
            throw new ErreurStructure(`la migration ${m.fichier} échoue : ${e.message}`, { migration: m.numero, fichier: m.fichier, etape: 'execution' });
          }
          const violations = db.prepare('PRAGMA foreign_key_check').all();
          if (violations.length) {
            throw new ErreurStructure(`la migration ${m.fichier} rompt des liens entre tables : ${violations.length} clé(s) étrangère(s) violée(s)`,
              { migration: m.numero, fichier: m.fichier, etape: 'cles_etrangeres', details: resumeDesCles(violations) });
          }
        }
        courante = derniere;
        db.exec(`PRAGMA user_version = ${derniere.numero}`);
        const ecarts = comparerLesSchemas(db, attendu);
        if (ecarts.length) {
          throw new ErreurStructure(`${plage(choisies)} : le schéma obtenu n’est pas celui de schema.sql (${ecarts.length} écart(s))`,
            { migration: choisies.length === 1 ? derniere.numero : null, fichier: choisies.length === 1 ? derniere.fichier : null, etape: 'schema', details: ecarts });
        }
        if (tableExiste(db, TABLE_DES_MIGRATIONS_RECUES)) {
          const iso = ecrireInstant(instant);
          const noter = db.prepare(`INSERT INTO ${TABLE_DES_MIGRATIONS_RECUES} (numero, fichier, empreinte, recue_le, mode, version_du_site) VALUES (?, ?, ?, ?, 'sur_place', ?)`);
          for (const m of choisies) {
            courante = m;
            try {
              noter.run(m.numero, m.fichier, m.empreinte, iso, versionDuSite(version));
            } catch (e) {
              throw new ErreurStructure(`la migration ${m.fichier} ne peut pas être notée comme reçue : ${e.message}`, { migration: m.numero, fichier: m.fichier, etape: 'notes' });
            }
          }
          notees = true;
        }
        db.exec('COMMIT');
      } catch (e) {
        if (db.isTransaction) db.exec('ROLLBACK');
        if (e instanceof ErreurStructure) throw e;
        throw new ErreurStructure(`${courante ? `la migration ${courante.fichier}` : 'le changement de structure'} est refusé : ${e.message}`,
          { migration: courante?.numero ?? null, fichier: courante?.fichier ?? null, etape: 'execution' });
      }
    } finally {
      db.exec(`PRAGMA foreign_keys = ${cles ? 'ON' : 'OFF'}`);
    }
    return {
      avant,
      apres: derniere.numero,
      appliquees: choisies.map(({ numero, fichier, empreinte }) => ({ numero, fichier, empreinte })),
      sauvegarde: copie,
      notees,
      duree_ms: Math.round(performance.now() - t0),
    };
  } finally {
    attendu.close();
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le bilan : ce que le changement a fait aux tables
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les tables d'un schéma attaché, hors tables internes, d'ombre du plein texte et virtuelles (la recherche plein texte se recalcule) : { nom → { lignes } }. */
function tablesDuBilan(db, schema) {
  const tables = new Map();
  const virtuelles = [];
  for (const t of db.prepare(`SELECT name, sql FROM ${identifiant(schema)}.sqlite_master WHERE type = 'table' ORDER BY name`).all()) {
    if (/^sqlite_/.test(t.name) || OMBRES_DE_RECHERCHE.test(t.name)) continue;
    if (/^\s*CREATE\s+VIRTUAL\s/i.test(t.sql ?? '')) {
      virtuelles.push(t.name);
      continue;
    }
    tables.set(t.name, { lignes: db.prepare(`SELECT count(*) AS n FROM ${identifiant(schema)}.${identifiant(t.name)}`).get().n });
  }
  return { tables, virtuelles };
}

const signatureDesColonnes = (colonnes) => colonnes.map((c) => `${c.nom}:${c.type}:${c.notnull}:${c.pk}`).sort().join(',');

/** Les lignes ajoutées, retirées et modifiées d'une table dont l'empreinte a changé : comparées par clé primaire (sur les colonnes que les deux états ont). */
function ecartDeLaTable(db, table, avant, apres) {
  const ca = colonnesDeLaTable(db, table, avant);
  const cb = colonnesDeLaTable(db, table, apres);
  const nomsA = new Set(ca.map((c) => c.nom));
  const nomsB = new Set(cb.map((c) => c.nom));
  const communes = cb.filter((c) => nomsA.has(c.nom));
  const cle = communes.filter((c) => c.pk > 0).sort((x, y) => x.pk - y.pk);
  const t = identifiant(table);
  const A = `${identifiant(avant)}.${t}`;
  const B = `${identifiant(apres)}.${t}`;
  const liste = (cols, p = '') => cols.map((c) => `${p}${identifiant(c.nom)}`).join(', ');
  const nombre = (sql) => Number(db.prepare(sql).get().n);
  const sortie = {
    ajoutees: 0, retirees: 0, modifiees: 0,
    colonnes_ajoutees: cb.filter((c) => !nomsA.has(c.nom)).map((c) => c.nom),
    colonnes_retirees: ca.filter((c) => !nomsB.has(c.nom)).map((c) => c.nom),
    structure_changee: signatureDesColonnes(ca) !== signatureDesColonnes(cb),
  };
  if (cle.length && cle.length === cb.filter((c) => c.pk > 0).length && cle.length === ca.filter((c) => c.pk > 0).length) {
    const memeCle = cle.map((c) => `x.${identifiant(c.nom)} IS y.${identifiant(c.nom)}`).join(' AND ');
    sortie.ajoutees = nombre(`SELECT count(*) AS n FROM ${B} x WHERE NOT EXISTS (SELECT 1 FROM ${A} y WHERE ${memeCle})`);
    sortie.retirees = nombre(`SELECT count(*) AS n FROM ${A} y WHERE NOT EXISTS (SELECT 1 FROM ${B} x WHERE ${memeCle})`);
    const autres = communes.filter((c) => !(c.pk > 0));
    if (autres.length) {
      sortie.modifiees = nombre(`SELECT count(*) AS n FROM ${B} x JOIN ${A} y ON ${memeCle} WHERE ${autres.map((c) => `x.${identifiant(c.nom)} IS NOT y.${identifiant(c.nom)}`).join(' OR ')}`);
    }
  } else if (communes.length) {
    // pas de clé primaire commune : lignes entières, sans « modifiée » (une ligne changée compte une retirée et une ajoutée)
    sortie.ajoutees = nombre(`SELECT count(*) AS n FROM (SELECT ${liste(communes)} FROM ${B} EXCEPT SELECT ${liste(communes)} FROM ${A})`);
    sortie.retirees = nombre(`SELECT count(*) AS n FROM (SELECT ${liste(communes)} FROM ${A} EXCEPT SELECT ${liste(communes)} FROM ${B})`);
  }
  return sortie;
}

/**
 * Le bilan d'un changement de structure : `db` porte l'état d'AVANT attaché sous `avant` et l'état d'APRÈS dans `main`. Par table, les lignes ajoutées,
 * retirées et modifiées (comparées par clé primaire) ; les tables créées, retirées ou renommées (« renommée » : même contenu et mêmes colonnes sous un autre
 * nom, deviné) ; les tables dont l'empreinte est inchangée (serveur/empreintes.mjs#empreinteDeLaTable : le même calcul que l'extrait et l'attestation, pour
 * TOUTES les tables, fiches et journal compris) ; les index, vues et déclencheurs créés, retirés ou modifiés. Les tables virtuelles (plein texte) en sont
 * exclues : elles se recalculent.
 */
export function bilanDesTables(db, { avant = 'avant', apres = 'main' } = {}) {
  const A = tablesDuBilan(db, avant);
  const B = tablesDuBilan(db, apres);
  const empreintes = new Map();
  const empreinte = (schema, table) => {
    const cle = `${schema}\u0000${table}`;
    if (!empreintes.has(cle)) empreintes.set(cle, empreinteDeLaTable(db, table, schema).empreinte);
    return empreintes.get(cle);
  };
  const retirees = [...A.tables.keys()].filter((t) => !B.tables.has(t));
  const creees = [...B.tables.keys()].filter((t) => !A.tables.has(t));
  const renommees = [];
  for (const de of [...retirees]) {
    const vers = creees.find((c) => !renommees.some((r) => r.vers === c) && empreinte(avant, de) === empreinte(apres, c));
    if (vers) renommees.push({ de, vers });
  }
  const modifiees = {};
  const inchangees = [];
  for (const table of B.tables.keys()) {
    if (!A.tables.has(table)) continue;
    if (empreinte(avant, table) === empreinte(apres, table)) inchangees.push(table);
    else modifiees[table] = ecartDeLaTable(db, table, avant, apres);
  }
  const objets = (schema) => new Map(db.prepare(`SELECT type, name, sql FROM ${identifiant(schema)}.sqlite_master WHERE type <> 'table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`).all()
    .map((o) => [`${o.type} ${o.name}`, normaliserLeSql(o.sql)]));
  const oa = objets(avant);
  const ob = objets(apres);
  const totaux = Object.values(modifiees).reduce((s, t) => ({ ajoutees: s.ajoutees + t.ajoutees, retirees: s.retirees + t.retirees, modifiees: s.modifiees + t.modifiees }), { ajoutees: 0, retirees: 0, modifiees: 0 });
  return {
    tables: {
      creees: creees.filter((t) => !renommees.some((r) => r.vers === t)).map((t) => ({ table: t, lignes: B.tables.get(t).lignes })),
      retirees: retirees.filter((t) => !renommees.some((r) => r.de === t)).map((t) => ({ table: t, lignes: A.tables.get(t).lignes })),
      renommees,
      modifiees,
      inchangees,
      virtuelles_ignorees: B.virtuelles,
    },
    objets: {
      crees: [...ob.keys()].filter((k) => !oa.has(k)),
      retires: [...oa.keys()].filter((k) => !ob.has(k)),
      modifies: [...ob.keys()].filter((k) => oa.has(k) && oa.get(k) !== ob.get(k)),
    },
    totaux,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'essai sur une copie
// ---------------------------------------------------------------------------------------------------------------------------------------------
const EFFACER = ['', '-wal', '-shm', '-journal'];
const NOM_D_UN_ESSAI = /^structure-essai-[0-9]+-[0-9a-f-]{36}-(?:ombre-)?(?:avant|apres)\.db/;
/** Les copies de l'essai dans l'ombre (serveur/essai-dans-l-ombre.mjs) : `…-ombre-avant.db` et `…-ombre-apres.db`. */
const NOM_D_UNE_OMBRE = /^structure-essai-[0-9]+-[0-9a-f-]{36}-ombre-(?:avant|apres)\.db/;

/**
 * Essaie les migrations livrées sur une COPIE de la base `source` (jamais la base elle-même : elle n'est ouverte qu'en lecture seule, pour une copie VACUUM
 * INTO) : l'état d'avant et sa copie dans `dossier`, les migrations appliquées à celle-ci par `appliquerSurPlace` (sans sauvegarde : la base elle-même
 * n'est pas touchée), puis le bilan des deux états. Les copies sont TOUJOURS effacées, même en cas d'échec. Synchrone (un fil à part dans le service :
 * `essayerEnArrierePlan`).
 * Verdicts : `accepte` (le bilan est joint), `refuse` (`refus` : la migration, l'étape, la raison ; étape `plancher` : une base sous la version du schema.sql
 * sans migration livrée pour y monter), `a_jour` (rien à appliquer, la base au plancher ou au-dessus), `indisponible` (migrations ou
 * schema.sql non livrés). La base elle-même n'est jamais écrite.
 * @param {{ source: string, dossier: string, migrations?: string | null, schema?: string | null, instant?: string, version?: string | null }} o `migrations`
 *   et `schema` : chemins (undefined : ceux de la livraison) ; `instant` (ISO) et `version` : ce que noterait la vraie application
 * @returns {object} le bilan, en JSON (`format`, `verdict`, `versions`, `migrations`, `tables`, `objets`, `totaux`, `duree_ms`)
 */
export function essayerSurUneCopie({ source, dossier, migrations, schema, instant = ecrireInstant(), version = null }) {
  const t0 = performance.now();
  const base = { format: FORMAT_DU_BILAN };
  const livre = lireLesMigrations({ migrations, schema });
  if (!livre) return { ...base, verdict: 'indisponible', raison: 'les migrations ne sont pas livrées avec le service', duree_ms: 0 };
  if (livre.schema === null) return { ...base, verdict: 'indisponible', raison: 'le schema.sql attendu n’est pas livré avec le service', duree_ms: 0 };
  mkdirSync(dossier, { recursive: true });
  const racine = join(dossier, `structure-essai-${process.pid}-${randomUUID()}`);
  const copieAvant = `${racine}-avant.db`;
  const copieApres = `${racine}-apres.db`;
  let db = null;
  try {
    const lecture = new DatabaseSync(source, { readOnly: true });
    try {
      lecture.prepare('VACUUM INTO ?').run(copieAvant);
    } finally {
      lecture.close();
    }
    copyFileSync(copieAvant, copieApres);
    db = new DatabaseSync(copieApres);
    db.exec('PRAGMA foreign_keys = ON');
    const avant = versionDeLaBase(db);
    const aFaire = migrationsAAppliquer(livre.migrations, avant);
    const migrationsEssayees = aFaire.map(({ numero, fichier, empreinte }) => ({ numero, fichier, empreinte }));
    if (!aFaire.length) {
      const derniere = versionLivree(livre); // le schema.sql est le plancher quand des migrations sont sorties du dépôt
      const refus = refusSousLePlancher(livre, avant);
      if (refus) {
        return { ...base, verdict: 'refuse', versions: { avant, apres: avant, livree: derniere }, migrations: [], refus: refus.enJson(), retour_arriere: true, duree_ms: Math.round(performance.now() - t0) };
      }
      return { ...base, verdict: 'a_jour', versions: { avant, apres: avant, livree: derniere }, en_avance: derniere !== null && avant > derniere, migrations: [], duree_ms: Math.round(performance.now() - t0) };
    }
    try {
      appliquerSurPlace(db, { migrations: livre.migrations, schema: livre.schema, sauvegarde: false, instant: new Date(instant), version });
    } catch (e) {
      if (!(e instanceof ErreurStructure)) throw e;
      const intacte = versionDeLaBase(db) === avant;
      return { ...base, verdict: 'refuse', versions: { avant, apres: avant }, migrations: migrationsEssayees, refus: e.enJson(), retour_arriere: intacte, duree_ms: Math.round(performance.now() - t0) };
    }
    db.prepare('ATTACH DATABASE ? AS avant').run(copieAvant);
    const bilan = bilanDesTables(db, { avant: 'avant', apres: 'main' });
    return { ...base, verdict: 'accepte', versions: { avant, apres: versionDeLaBase(db) }, migrations: migrationsEssayees, ...bilan, duree_ms: Math.round(performance.now() - t0) };
  } finally {
    try {
      db?.close();
    } catch {
      // déjà fermée
    }
    for (const chemin of [copieAvant, copieApres]) for (const suffixe of EFFACER) rmSync(`${chemin}${suffixe}`, { force: true });
  }
}

/**
 * Supprime les copies d'essai de structure restées dans `dossier` (un service arrêté en plein essai : `essayerSurUneCopie` les supprime sinon). À
 * l'ouverture du service, avant tout essai. Rend le nombre de fichiers retirés. `ombre: false` laisse les copies de l'essai dans l'ombre (elles attendent leur
 * fil : serveur/essai-dans-l-ombre.mjs) ; l'ouverture du service les retire avec les autres.
 */
export function purgerLesEssaisDeStructure(dossier, { ombre = true } = {}) {
  if (!existsSync(dossier)) return 0;
  let n = 0;
  for (const nom of readdirSync(dossier)) {
    if (!NOM_D_UN_ESSAI.test(nom)) continue;
    if (!ombre && NOM_D_UNE_OMBRE.test(nom)) continue;
    rmSync(join(dossier, nom), { force: true });
    n += 1;
  }
  return n;
}

/** L'essai dans un fil à part (le service ne s'arrête pas ; la charge reste faible : il porte aussi la production) : une promesse du bilan. */
export const essayerEnArrierePlan = (options) => executerEnArrierePlan('maverickEssaiDeStructure', options);

/**
 * Un travail de ce module dans un fil à part, UN SEUL à la fois pour tout le service (l'essai avant installation et l'essai dans l'ombre se mettent en file :
 * deux copies de la base et deux calculs complets d'empreintes chacun). `cle` : un nom de TRAVAUX (`maverickEssaiDeStructure`, `maverickEssaiDansLOmbre`).
 */
export function executerEnArrierePlan(cle, options) {
  return enFile(() => new Promise((ok, ko) => {
    const fil = new Worker(fileURLToPath(import.meta.url), { workerData: { [cle]: options } });
    let reponse = null;
    fil.once('message', (m) => { reponse = m; });
    fil.once('error', ko);
    fil.once('exit', (code) => {
      if (reponse?.essai) ok(reponse.essai);
      else ko(new Error(reponse?.erreur ?? `le fil de l’essai de structure s’est arrêté (code ${code})`));
    });
  }));
}

let file = Promise.resolve(); // un essai à la fois : deux copies de la base et deux calculs complets d'empreintes chacun
function enFile(travail) {
  const suite = file.then(travail, travail);
  file = suite.catch(() => {});
  return suite;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les migrations d'une base refaite
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * À la reconstruction de la base vivante (serveur/base-vivante.mjs#preparerBaseVivante), sur la base refaite `db` : chaque migration livrée de numéro
 * <= user_version que la table ne note pas encore y entre, en mode « reconstruction » ; une ligne déjà notée (« sur_place » comprise) n'est jamais réécrite
 * (un `empreinte` qui diffère du fichier livré est rendu dans `ecarts`) ; une ligne dont le numéro dépasse la version de la base (retour à une version plus
 * ancienne) est retirée, que les migrations soient livrées ou non. Migrations non livrées : rien n'est noté, sans erreur (`livrees: false`).
 * @param {import('node:sqlite').DatabaseSync} db la base refaite, hors transaction
 * @param {{ migrations?: string | null, version?: string | null, instant?: Date | string }} [o] `migrations` : dossier (undefined : celui de la livraison) ;
 *   `version` : celle du site livré (notée si X.Y.Z, sinon NULL)
 * @returns {{ table: boolean, livrees: boolean, notees: number, retirees: number, ecarts: number[] }}
 */
export function noterLesMigrationsRecues(db, { migrations, version = null, instant = new Date() } = {}) {
  if (!tableExiste(db, TABLE_DES_MIGRATIONS_RECUES)) return { table: false, livrees: false, notees: 0, retirees: 0, ecarts: [] };
  const iso = typeof instant === 'string' ? instant : ecrireInstant(instant);
  const livre = lireLesMigrations({ migrations, schema: false, avecSql: false });
  const courante = versionDeLaBase(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    const retirees = Number(db.prepare(`DELETE FROM ${TABLE_DES_MIGRATIONS_RECUES} WHERE numero > ?`).run(courante).changes);
    let notees = 0;
    const ecarts = [];
    if (livre) {
      const connues = new Map(db.prepare(`SELECT numero, empreinte FROM ${TABLE_DES_MIGRATIONS_RECUES}`).all().map((r) => [r.numero, r.empreinte]));
      const noter = db.prepare(`INSERT INTO ${TABLE_DES_MIGRATIONS_RECUES} (numero, fichier, empreinte, recue_le, mode, version_du_site) VALUES (?, ?, ?, ?, 'reconstruction', ?)`);
      for (const m of livre.migrations) {
        if (m.numero > courante) continue;
        if (connues.has(m.numero)) {
          if (connues.get(m.numero) !== m.empreinte) ecarts.push(m.numero);
          continue;
        }
        noter.run(m.numero, m.fichier, m.empreinte, iso, versionDuSite(version));
        notees += 1;
      }
    }
    db.exec('COMMIT');
    return { table: true, livrees: Boolean(livre), notees, retirees, ecarts };
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw e;
  }
}

// Le même module sert de fil de travail : l'essai d'un changement de structure y tourne sans bloquer le service (comme serveur/edition-lots.mjs)
// (en fin de module : le fil exécute le travail dès qu'il charge le module, après les constantes dont celui-ci se sert)
// (l'essai dans l'ombre est chargé à la demande : son module importe celui-ci)
const TRAVAUX = {
  maverickEssaiDeStructure: (o) => essayerSurUneCopie(o),
  maverickEssaiDansLOmbre: (o) => import('./essai-dans-l-ombre.mjs').then((m) => m.comparerDansLOmbre(o)),
};
if (!isMainThread) {
  const cle = Object.keys(TRAVAUX).find((c) => workerData?.[c]);
  if (cle) {
    Promise.resolve()
      .then(() => TRAVAUX[cle](workerData[cle]))
      .then((essai) => parentPort.postMessage({ essai }), (e) => parentPort.postMessage({ erreur: String(e?.message ?? e) }));
  }
}
