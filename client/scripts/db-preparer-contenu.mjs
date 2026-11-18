#!/usr/bin/env node
// Prépare une COPIE de travail d'un contenu fourni (MAVERICK_CONTENU, lib/contenu-fourni.mjs ; lot 10 du chantier « la base du site de dev devient la
// source de vérité », R278) pour qu'elle ait la structure du dépôt : vue `extrait_meta` retirée, migrations du dépôt que le contenu n'a pas encore
// appliquées (une PR qui ajoute une migration lit l'extrait du site de dev, qui ne l'a pas reçue), structure en avance refusée (« rebasez sur dev »).
// Les migrations passent par le code du service (serveur/structure-sur-place.mjs#appliquerSurPlace : un seul bloc, clés étrangères contrôlées,
// schéma obtenu comparé à data/schema.sql) : rien n'est réinventé ici. Puis, si la copie n'a aucune page d'exemple (le site de dev n'en a pas), celles du
// dépôt (data/pages-d-exemple.sql, scripts/db-pages-d-exemple.mjs) y sont insérées ; `--sans-exemples` (HIDE_EXAMPLES=1) : rien à insérer.
//   node scripts/db-preparer-contenu.mjs <copie.db> [--racine <dépôt>] [--sans-exemples]
// Lancé par lib/donnees.mjs#ouvrirBase (dans son propre processus : le build d'Astro n'importe pas le service) quand la copie est en retard ; importé
// par scripts/db-export-pages.mjs. Ne jamais lui donner le fichier fourni lui-même : il l'écrit.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { appliquerSurPlace, lireLesMigrations } from '../serveur/structure-sur-place.mjs';
import { ErreurContenuFourni, FICHIER_DES_PAGES_D_EXEMPLE, preparerLaCopie } from '../src/lib/contenu-fourni.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Applique à `copie` les migrations de `<racine>/data/migrations` de numéro supérieur à sa structure, et vérifie le schéma obtenu contre
 * `<racine>/data/schema.sql`. Rend la liste des fichiers appliqués. Une migration refusée lève l'ErreurStructure du service (la copie est inchangée).
 */
export function migrerLaCopie(copie, { racine = RACINE } = {}) {
  const livrees = lireLesMigrations({ migrations: join(racine, 'data', 'migrations'), schema: join(racine, 'data', 'schema.sql') });
  if (!livrees) throw new Error(`${join(racine, 'data', 'migrations')} est introuvable : les migrations manquantes du contenu fourni ne peuvent pas être appliquées`);
  const db = new DatabaseSync(copie);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    return appliquerSurPlace(db, { migrations: livrees.migrations, schema: livrees.schema, sauvegarde: false }).appliquees.map((m) => m.fichier);
  } finally {
    db.close();
  }
}

/**
 * Insère dans `copie` les pages d'exemple du dépôt (`<racine>/data/pages-d-exemple.sql`) : un seul bloc, clés étrangères contrôlées ; un échec (fichier
 * introuvable, ligne déjà présente, parent manquant) laisse la copie inchangée et lève une ErreurContenuFourni. Rend le nombre de pages d'exemple.
 */
export function injecterLesPagesDExemple(copie, { racine = RACINE } = {}) {
  const chemin = join(racine, ...FICHIER_DES_PAGES_D_EXEMPLE);
  if (!existsSync(chemin)) throw new ErreurContenuFourni(`${chemin} est introuvable : les pages d’exemple ne peuvent pas être ajoutées au contenu fourni`);
  const sql = readFileSync(chemin, 'utf8');
  const db = new DatabaseSync(copie);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      const rompues = db.prepare('PRAGMA foreign_key_check').all();
      if (rompues.length) throw new Error(`clés étrangères rompues (${[...new Set(rompues.map((r) => r.table))].join(', ')})`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new ErreurContenuFourni(`les pages d’exemple du dépôt (${FICHIER_DES_PAGES_D_EXEMPLE.join('/')}) ne s’ajoutent pas au contenu fourni : ${e.message}`);
    }
    return db.prepare("SELECT count(*) AS n FROM page WHERE statut = 'example'").get().n;
  } finally {
    db.close();
  }
}

/**
 * La préparation complète (lib/contenu-fourni.mjs#preparerLaCopie, migrations et pages d'exemple comprises) : { vue_retiree, avant, apres, exemples_ajoutes,
 * appliquees }. `exemples: false` (HIDE_EXAMPLES=1) : aucune page d'exemple ajoutée.
 */
export function preparerLeContenu(copie, { racine = RACINE, exemples = true } = {}) {
  let appliquees = [];
  const r = preparerLaCopie(copie, {
    racine, exemples, migrer: (f) => { appliquees = migrerLaCopie(f, { racine }); }, injecter: (f) => injecterLesPagesDExemple(f, { racine }),
  });
  return { ...r, appliquees };
}

// realpath : lib/donnees.mjs le lance par <racine>/client/scripts, qui peut être un lien (le kit, les tests)
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--racine');
  const racine = i >= 0 ? resolve(args[i + 1]) : RACINE;
  const copie = args.find((a, j) => !a.startsWith('--') && (i < 0 || j !== i + 1));
  if (!copie) {
    console.error('usage : node scripts/db-preparer-contenu.mjs <copie.db> [--racine <dépôt>] [--sans-exemples]');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(preparerLeContenu(resolve(copie), { racine, exemples: !args.includes('--sans-exemples') })));
  } catch (e) {
    console.error(e.message);
    for (const d of e.details ?? []) console.error(`  ${d}`);
    process.exit(1);
  }
}
