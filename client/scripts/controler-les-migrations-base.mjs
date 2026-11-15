// Le passage des migrations nouvelles sur une base REMPLIE (lot 7 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/flux-git.md,
// « Règles des migrations (lot 7) »). La base de la version dont part la PR (le merge-base : son data/schema.sql et son data/rows) est reconstruite, remplie
// (scripts/base-remplie-lib.mjs : fiches, journal, historique, lot déposé, plafond de numéro), puis chaque migration nouvelle lui est appliquée par
// serveur/structure-sur-place.mjs#appliquerSurPlace — le code du service, sur une copie jetable. Sont exigés : le schéma obtenu est celui du data/schema.sql de
// l'arbre, aucune clé étrangère rompue, rien de perdu dans les fiches, le journal, l'historique ni les lots déposés. Le bilan (lignes ajoutées, retirées et
// modifiées par table, tables à l'empreinte inchangée) est rendu par migration. Une base jamais écrite : tout se passe dans `dossier`, effacé par l'appelant.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { ErreurStructure, appliquerSurPlace, bilanDesTables, migrationsAAppliquer } from '../serveur/structure-sur-place.mjs';
import { TABLES_DES_NOTES, TABLES_PROPRES_AU_SITE } from '../src/lib/tables-de-la-base.mjs';
import { remplirUneBase } from './base-remplie-lib.mjs';
import { ErreurDeControle, extraireDuCommit } from './controler-les-migrations-lib.mjs';

const DB_BUILD = fileURLToPath(new URL('./db-build.mjs', import.meta.url));
/** Ce qu'un changement de structure ne doit jamais faire perdre : les fiches, le journal de l'édition, l'historique des modifications, les notes de version. */
export const TABLES_A_NE_PAS_PERDRE = Object.freeze([...TABLES_PROPRES_AU_SITE, ...TABLES_DES_NOTES]);

const versionDe = (db) => db.prepare('PRAGMA user_version').get().user_version;

/**
 * La base de la version `commit` : data/schema.sql et data/rows extraits (git archive) dans `dossier`, db-build (sans la dérivation : les tables calculées
 * n'y comptent pas), puis remplie. Rend { chemin, version, poses }.
 */
export function reconstruireLaBase({ racine, commit, dossier }) {
  const extraits = extraireDuCommit({ racine, commit, dossier, chemins: ['data/schema.sql', 'data/rows', 'data/heritage.json'] });
  if (!extraits.includes('data/schema.sql') || !extraits.includes('data/rows')) throw new ErreurDeControle(`${commit} : data/schema.sql ou data/rows absent (la base de cette version ne se reconstruit pas)`);
  const chemin = join(dossier, 'base-remplie.db');
  const args = ['--no-warnings', DB_BUILD, '--out', chemin, '--schema', join(dossier, 'data', 'schema.sql'), '--rows', join(dossier, 'data', 'rows')];
  if (extraits.includes('data/heritage.json')) args.push('--heritage', join(dossier, 'data', 'heritage.json'));
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new ErreurDeControle(`db-build sur la version ${commit.slice(0, 10)} a échoué : ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
  const db = new DatabaseSync(chemin);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const poses = remplirUneBase(db);
    return { chemin, version: versionDe(db), poses };
  } finally {
    db.close();
  }
}

/**
 * Ce que le bilan d'une migration fait perdre à ce que la base garde (fiches, journal, historique, notes) : une table retirée sans être renommée, des lignes
 * retirées. Une colonne retirée d'une de ces tables est notée à part (`colonnes`) : ce n'est pas une ligne perdue, mais la donnée qu'elle portait.
 * @returns {{ pertes: string[], colonnes: string[] }}
 */
export function pertesDuBilan(bilan, protegees = TABLES_A_NE_PAS_PERDRE) {
  const pertes = [];
  const colonnes = [];
  for (const t of bilan.tables.retirees) if (protegees.includes(t.table)) pertes.push(`la table ${t.table} est retirée (${t.lignes} ligne(s))`);
  for (const [table, e] of Object.entries(bilan.tables.modifiees)) {
    if (!protegees.includes(table)) continue;
    if (e.retirees > 0) pertes.push(`${e.retirees} ligne(s) retirée(s) de ${table}`);
    if (e.colonnes_retirees?.length) colonnes.push(`${table} : colonne(s) retirée(s) ${e.colonnes_retirees.join(', ')}`);
  }
  return { pertes, colonnes };
}

/**
 * Applique les migrations nouvelles à une COPIE de `base` (la base remplie de la version de départ ; jamais écrite) :
 *   1. toutes d'un bloc par `appliquerSurPlace` (le code du service : suite des numéros, clés étrangères après chacune, schéma comparé à `schema`) : le verdict ;
 *   2. puis une à une sur une seconde copie, pour le bilan de chacune (un instantané avant, `bilanDesTables` après).
 * Verdicts : `accepte` (avec `etapes`, `avertissements`), `refuse` (`refus` : étape, raison, détails), `perte` (`pertes`), `a_jour` (rien à appliquer).
 * @param {{ base: string, migrations: object[], schema: string | null, dossier: string }} o `migrations` : { numero, fichier, empreinte, sql } de l'arbre
 */
export function essayerSurBaseRemplie({ base, migrations, schema, dossier }) {
  const t0 = performance.now();
  const copie = join(dossier, 'essai-verdict.db');
  const rejeu = join(dossier, 'essai-bilans.db');
  const instantane = join(dossier, 'essai-avant.db');
  const fini = (o) => ({ ...o, duree_ms: Math.round(performance.now() - t0) });
  try {
    copyFileSync(base, copie);
    const db = new DatabaseSync(copie);
    let avant;
    try {
      db.exec('PRAGMA foreign_keys = ON');
      avant = versionDe(db);
      if (!migrationsAAppliquer(migrations, avant).length) return fini({ verdict: 'a_jour', avant, etapes: [] });
      try {
        appliquerSurPlace(db, { migrations, schema, sauvegarde: false });
      } catch (e) {
        if (!(e instanceof ErreurStructure)) throw e;
        return fini({ verdict: 'refuse', avant, refus: e.enJson(), etapes: [] });
      }
      const verification = db.prepare('PRAGMA integrity_check').all().map((r) => r.integrity_check);
      if (verification.length !== 1 || verification[0] !== 'ok') return fini({ verdict: 'refuse', avant, refus: { migration: null, fichier: null, etape: 'integrite', raison: 'PRAGMA integrity_check échoue', details: verification.slice(0, 20) }, etapes: [] });
    } finally {
      db.close();
    }

    // le bilan de chaque migration : pas à pas sur une seconde copie (le verdict ci-dessus a déjà dit que tout passe)
    copyFileSync(base, rejeu);
    const pas = new DatabaseSync(rejeu);
    const etapes = [];
    const pertes = [];
    const avertissements = [];
    try {
      pas.exec('PRAGMA foreign_keys = OFF');
      for (const m of migrationsAAppliquer(migrations, avant)) {
        rmSync(instantane, { force: true });
        const de = versionDe(pas);
        pas.prepare('VACUUM INTO ?').run(instantane);
        pas.exec('BEGIN IMMEDIATE');
        try {
          pas.exec(m.sql);
          pas.exec('COMMIT');
        } catch (e) {
          if (pas.isTransaction) pas.exec('ROLLBACK');
          throw e;
        }
        pas.exec(`PRAGMA user_version = ${m.numero}`);
        pas.prepare('ATTACH DATABASE ? AS avant').run(instantane);
        const bilan = bilanDesTables(pas, { avant: 'avant', apres: 'main' });
        pas.exec('DETACH DATABASE avant');
        const { pertes: perdues, colonnes } = pertesDuBilan(bilan);
        pertes.push(...perdues.map((p) => `${m.fichier} : ${p}`));
        avertissements.push(...colonnes.map((c) => `${m.fichier} : ${c}`));
        etapes.push({ numero: m.numero, fichier: m.fichier, avant: de, apres: m.numero, bilan });
      }
    } finally {
      pas.close();
    }
    if (pertes.length) return fini({ verdict: 'perte', avant, pertes, etapes, avertissements });
    return fini({ verdict: 'accepte', avant, etapes, avertissements });
  } finally {
    for (const fichier of [copie, rejeu, instantane]) for (const suffixe of ['', '-wal', '-shm', '-journal']) if (existsSync(`${fichier}${suffixe}`)) rmSync(`${fichier}${suffixe}`, { force: true });
  }
}
