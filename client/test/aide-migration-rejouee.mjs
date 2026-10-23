// Rejouer une migration publiée (data/migrations/NNNN-<nom>.sql) sur une COPIE de la base construite, pour en épingler la conversion des données
// (test/personnages-armure-elementaire.test.mjs, test/serveur-armure-elementaire.test.mjs : la migration 0080 sur des fiches d'avant). La copie est
// déjà à la version courante : une migration plus ancienne qui recrée une vue la remet dans sa forme d'alors, qui peut lire une colonne qu'une
// migration suivante a retirée (0080 recrée v_personnage_controle, dont la règle amelioration_cible lisait personnage_arme.amelioration_elementaire_id,
// retirée par 0081). Après la migration, chaque vue reprend donc sa définition de data/schema.sql, comme l'auraient fait les migrations suivantes ;
// les tables et les lignes restent celles que la migration a laissées. Une migration publiée ne se modifie jamais (skill ecrire-une-migration).
// Module sans test propre (n'est pas un *.test.mjs) : les deux tests qui s'en servent vérifient la vue rendue (vuesCourantes).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { trouverRacine } from '../src/lib/donnees.mjs';

const racine = trouverRacine();

/** Les vues de data/schema.sql, dans l'ordre de leur création : [{ name, sql }]. */
export function vuesCourantes() {
  const schema = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  try {
    schema.exec(readFileSync(join(racine, 'data', 'schema.sql'), 'utf8'));
    return schema.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'view' ORDER BY rowid").all().map((v) => ({ name: v.name, sql: v.sql }));
  } finally {
    schema.close();
  }
}

/**
 * Exécute la migration `fichier` (nom dans data/migrations/) sur `db`, puis redonne à chaque vue que la migration a changée, retirée ou ajoutée sa
 * définition de data/schema.sql. Rend les noms des vues refaites.
 */
export function rejouerLaMigration(db, fichier) {
  db.exec(readFileSync(join(racine, 'data', 'migrations', fichier), 'utf8'));
  const courantes = vuesCourantes();
  const enPlace = new Map(db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'view'").all().map((v) => [v.name, v.sql]));
  const refaites = [];
  for (const name of enPlace.keys()) {
    if (courantes.some((v) => v.name === name)) continue;
    db.exec(`DROP VIEW "${name}"`);
    refaites.push(name);
  }
  for (const { name, sql } of courantes) {
    if (enPlace.get(name) === sql) continue;
    if (enPlace.has(name)) db.exec(`DROP VIEW "${name}"`);
    db.exec(sql);
    refaites.push(name);
  }
  return refaites;
}
