#!/usr/bin/env node
// Prépare une COPIE de travail d'un contenu fourni (MAVERICK_CONTENU, lib/contenu-fourni.mjs ; lot 10 du chantier « la base du site de dev devient la
// source de vérité », R278) pour qu'elle ait la structure du dépôt : vue `extrait_meta` retirée, migrations du dépôt que le contenu n'a pas encore
// appliquées (une PR qui ajoute une migration lit l'extrait du site de dev, qui ne l'a pas reçue), structure en avance refusée (« rebasez sur dev »).
// Les migrations passent par le code du service (serveur/structure-sur-place.mjs#appliquerSurPlace : un seul bloc, clés étrangères contrôlées,
// schéma obtenu comparé à data/schema.sql) : rien n'est réinventé ici.
//   node scripts/db-preparer-contenu.mjs <copie.db> [--racine <dépôt>]
// Lancé par lib/donnees.mjs#ouvrirBase (dans son propre processus : le build d'Astro n'importe pas le service) quand la copie est en retard ; importé
// par scripts/db-export-pages.mjs. Ne jamais lui donner le fichier fourni lui-même : il l'écrit.
import { realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { appliquerSurPlace, lireLesMigrations } from '../serveur/structure-sur-place.mjs';
import { preparerLaCopie } from '../src/lib/contenu-fourni.mjs';

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

/** La préparation complète (lib/contenu-fourni.mjs#preparerLaCopie, migrations comprises) : { vue_retiree, avant, apres, appliquees }. */
export function preparerLeContenu(copie, { racine = RACINE } = {}) {
  let appliquees = [];
  const r = preparerLaCopie(copie, { racine, migrer: (f) => { appliquees = migrerLaCopie(f, { racine }); } });
  return { ...r, appliquees };
}

// realpath : lib/donnees.mjs le lance par <racine>/client/scripts, qui peut être un lien (le kit, les tests)
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--racine');
  const racine = i >= 0 ? resolve(args[i + 1]) : RACINE;
  const copie = args.find((a, j) => !a.startsWith('--') && (i < 0 || j !== i + 1));
  if (!copie) {
    console.error('usage : node scripts/db-preparer-contenu.mjs <copie.db> [--racine <dépôt>]');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(preparerLeContenu(resolve(copie), { racine })));
  } catch (e) {
    console.error(e.message);
    for (const d of e.details ?? []) console.error(`  ${d}`);
    process.exit(1);
  }
}
