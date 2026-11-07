// La base des règles remise dans son état d'import, pour les tests qui épinglent une règle lue dans un texte que le site de dev peut réécrire (demande
// du propriétaire : « Les tests automatiques ne devrai pas porter sur le contenu même des textes mais juste sur le fonctionnement du site, les
// formules et les règles elle même »). Le site de dev est la source de ce qu'il modifie : la base courante peut porter n'importe quel texte. Une règle
// que le moteur lit dans un texte (R110, R122, R163, R177…) s'épingle donc sur le texte que l'import et les migrations ont écrit, jamais sur le texte
// courant ; l'état courant se contrôle par des invariants (chaque texte est lu, ou porte une raison), sans valeur figée.
//
//   baseDImport(options?)    une copie de la base construite (cheminBase, pages d'exemple comprises, comme les tests de la fiche), ouverte en lecture
//                            seule, dont chaque modification rapatriée du site (historique_modification, client/src/lib/historique-site.mjs) est
//                            défaite, de la dernière à la première : une ligne insérée par le site est retirée, une ligne supprimée remise, une
//                            cellule modifiée reprend sa valeur « avant ». Une cellule qu'une migration a réécrite après le site (sa valeur n'est plus
//                            celle que le site a laissée) est gardée telle que la migration l'a écrite : sa valeur d'import n'existe plus. Les lots
//                            défaits quittent l'historique de la copie (historiqueSite y voit l'état d'import comme courant). `base.ecarts` : ce
//                            qui n'a pas pu être défait (vide d'ordinaire). Une copie par processus et par options, supprimée à sa sortie.
//     { garder: lotsAvant('0093') }
//                            l'état d'après une migration : ne défait que les lots rapatriés après elle (liste figée test/fixtures/lots-avant-NNNN.json,
//                            comme lectureDe0090, skill tests-conventions) — pour une phrase qu'une décision a fait écrire par le site de dev.
//   reglesDImport(options?)  chargerReglesDeFiche sur cette base, « tel que la page le reçoit » (passé par JSON), une fois par processus.
//   cheminDImport(options?)  le fichier de cette base : les règles d'une base vivante d'essai (preparerBaseVivante({ regles: cheminDImport() })).
//   texteDImport(table, cle, colonne, options?)
//                            une cellule de cette base (ligne lue par sa clé primaire) ; undefined pour une ligne absente.
//   remettreDepuisLImport(db, table, cle, { enfants? })
//                            remet dans une copie (règles d'une base vivante d'essai, data/rows reconstruit) une ligne que le site a supprimée, avec ce
//                            qu'elle cite et ce qui la compose, telle que l'import l'écrit (patron : serveur-edition-conflits).
//
// Les tables dérivées (lien, lien_candidat, page_fts, entite_fts) sont refaites sur la copie par scripts/db-derive.mjs, comme après `db:build` : un
// lien que portait une balise d'un mot-clé que le site a supprimé (ou une page qu'il a supprimée) y revient avec elle.
// Les noms aussi reviennent à l'import : un test cherche toujours par identifiant (figé), et bâtit un message attendu avec le nom lu par identifiant.
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { cheminBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { cleDeLigne, lireHistorique } from '../src/lib/historique-site.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

/** Colonnes d'une table de la base (null : table absente, renommée ou supprimée par une migration). */
function colonnesDe(db, table) {
  if (!/^[a-z0-9_]+$/.test(table)) return null;
  const lignes = db.prepare(`PRAGMA table_info("${table}")`).all();
  return lignes.length ? new Set(lignes.map((c) => c.name)) : null;
}

const memes = (a, b) => (a === null || a === undefined ? b === null || b === undefined : b !== null && b !== undefined && String(a) === String(b));

/**
 * Défait dans `db` (ouverte en écriture) les modifications du site, de la dernière à la première, sauf celles des lots `garder`, puis retire de
 * l'historique les lots défaits. Rend ce qui n'a pas pu être défait (opération et raison). Exporté pour le test de l'aide.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ garder?: Set<string> }} [options]
 * @returns {string[]}
 */
export function defaireLeSite(db, { garder = new Set() } = {}) {
  const entrees = lireHistorique(db).filter((e) => !garder.has(e.lot));
  const ecarts = [];
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('BEGIN');
  db.exec('PRAGMA defer_foreign_keys = ON'); // l'ordre inverse des opérations d'un lot peut passer par un état transitoire
  try {
    for (let i = entrees.length - 1; i >= 0; i -= 1) {
      const e = entrees[i];
      const colonnes = colonnesDe(db, e.table);
      if (!colonnes) continue;
      const cle = cleDeLigne(db, e.table, e.cle);
      const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
      const actuelle = db.prepare(`SELECT * FROM "${e.table}" WHERE ${ou}`).get(...Object.values(cle));
      try {
        if (e.operation === 'inserer') {
          if (actuelle) db.prepare(`DELETE FROM "${e.table}" WHERE ${ou}`).run(...Object.values(cle));
        } else if (e.operation === 'supprimer') {
          if (actuelle) continue; // remise depuis par une migration : gardée
          const valeurs = Object.entries(e.avant ?? {}).filter(([c]) => colonnes.has(c));
          db.prepare(`INSERT INTO "${e.table}" (${valeurs.map(([c]) => `"${c}"`).join(', ')}) VALUES (${valeurs.map(() => '?').join(', ')})`).run(...valeurs.map(([, v]) => v));
        } else if (actuelle) {
          // seule une cellule qui garde la valeur que ce lot a écrite est défaite : une migration (ou un lot gardé) passée depuis a le dernier mot
          const valeurs = Object.entries(e.avant ?? {}).filter(([c]) => colonnes.has(c) && memes(actuelle[c], e.apres?.[c]));
          if (valeurs.length) db.prepare(`UPDATE "${e.table}" SET ${valeurs.map(([c]) => `"${c}" = ?`).join(', ')} WHERE ${ou}`).run(...valeurs.map(([, v]) => v), ...Object.values(cle));
        }
      } catch (err) {
        ecarts.push(`${e.table} ${e.texte} (${e.operation}, lot ${e.lot}) : ${err.message}`);
      }
    }
    const rompues = db.prepare('PRAGMA foreign_key_check').all().map((f) => `${f.table} (rowid ${f.rowid}) -> ${f.parent}`);
    if (rompues.length) throw new Error(`base d'import : clés étrangères rompues\n${rompues.join('\n')}\n${ecarts.join('\n')}`);
    const retirer = db.prepare('DELETE FROM historique_modification WHERE lot_id = ?');
    for (const lot of new Set(entrees.map((e) => e.lot))) retirer.run(lot);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return ecarts;
}

/** Les lots rapatriés quand la migration `numero` a été écrite (test/fixtures/lots-avant-<numero>.json, liste figée). */
export const lotsAvant = (numero) => new Set(JSON.parse(readFileSync(new URL(`./fixtures/lots-avant-${numero}.json`, import.meta.url), 'utf8')).lots);

const caches = new Map(); // clé des lots gardés -> { db, chemin, regles }

function preparer({ garder = new Set() } = {}) {
  const cle = [...garder].sort().join('\n');
  if (caches.has(cle)) return caches.get(cle);
  const copie = fichierTemporaire('maverick-import.db', 'base-d-import-');
  copyFileSync(cheminBase({ sansExemples: false }), copie);
  const ecriture = new DatabaseSync(copie);
  let ecarts;
  try {
    ecarts = defaireLeSite(ecriture, { garder });
  } finally {
    ecriture.close();
  }
  const derive = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(new URL('../scripts/db-derive.mjs', import.meta.url)), copie], { encoding: 'utf8' });
  if (derive.status !== 0) throw new Error(`tables dérivées de la base d'import : ${derive.stderr || derive.stdout}`);
  const db = new DatabaseSync(copie, { readOnly: true });
  db.exec('PRAGMA foreign_keys = ON');
  Object.defineProperty(db, 'ecarts', { value: ecarts });
  const entree = { db, chemin: copie, regles: null };
  caches.set(cle, entree);
  return entree;
}

/** La base des règles dans son état d'import (voir l'en-tête) : en lecture seule, une copie par processus et par `garder`, supprimée à sa sortie. */
export const baseDImport = (options) => preparer(options).db;

/** Le fichier de la base d'import (à ne pas modifier : une base vivante d'essai en fait sa propre copie). */
export const cheminDImport = (options) => preparer(options).chemin;

/** Les règles de la fiche lues dans la base d'import, telles que la page les reçoit (passées par JSON). */
export function reglesDImport(options) {
  const entree = preparer(options);
  entree.regles ??= JSON.parse(JSON.stringify(chargerReglesDeFiche(entree.db)));
  return entree.regles;
}

/** La cellule `colonne` de la ligne `cle` dans la base d'import ; undefined pour une ligne absente (créée par le site, ou supprimée par une migration). */
export function texteDImport(table, cle, colonne, options) {
  const db = baseDImport(options);
  const c = cleDeLigne(db, table, cle);
  if (!colonnesDe(db, table)?.has(colonne)) throw new Error(`${table}.${colonne} : colonne absente de la base`);
  const ligne = db.prepare(`SELECT "${colonne}" AS v FROM "${table}" WHERE ${Object.keys(c).map((k) => `"${k}" = ?`).join(' AND ')}`).get(...Object.values(c));
  return ligne ? ligne.v : undefined;
}

/**
 * Remet dans `db` (une copie de la base, ouverte en écriture, clés étrangères contrôlées) la ligne `cle` de `table` telle que la base d'import l'écrit,
 * si le site de dev l'a supprimée : d'abord les lignes qu'elle cite (clés étrangères, de proche en proche : l'espèce avant la carte, la page avant le
 * métier ou le don), puis elle, puis (`enfants`, vrai par défaut) les lignes de l'import qui la composent (une table dont la clé étrangère vers elle fait
 * partie de sa clé primaire : les bonus d'un métier, les rubriques d'une carte). Rend le nombre de lignes remises (0 : elle était là).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} table
 * @param {object} cle les colonnes de sa clé primaire
 * @param {{ enfants?: boolean, dImport?: import('node:sqlite').DatabaseSync }} [options]
 */
export function remettreDepuisLImport(db, table, cle, { enfants = true, dImport = baseDImport() } = {}) {
  const colonnes = colonnesDe(db, table);
  if (!colonnes || !Object.keys(cle).every((k) => colonnes.has(k))) throw new Error(`${table} : table ou clé inconnue (${Object.keys(cle).join(', ')})`);
  const ou = Object.keys(cle).map((k) => `"${k}" = ?`).join(' AND ');
  if (db.prepare(`SELECT 1 FROM "${table}" WHERE ${ou}`).get(...Object.values(cle))) return 0;
  const ligne = dImport.prepare(`SELECT * FROM "${table}" WHERE ${ou}`).get(...Object.values(cle));
  if (!ligne) throw new Error(`${table} ${JSON.stringify(cle)} : absente de la base d'import`);
  let n = 0;
  const parents = new Map();
  for (const f of db.prepare(`PRAGMA foreign_key_list("${table}")`).all()) parents.set(f.id, [...(parents.get(f.id) ?? []), f]);
  for (const fk of parents.values()) {
    const cleParent = Object.fromEntries(fk.map((f) => [f.to, ligne[f.from]]));
    if (Object.values(cleParent).some((v) => v === null || v === undefined)) continue;
    n += remettreDepuisLImport(db, fk[0].table, cleParent, { enfants: false, dImport });
  }
  const valeurs = Object.entries(ligne).filter(([c]) => colonnes.has(c));
  db.prepare(`INSERT INTO "${table}" (${valeurs.map(([c]) => `"${c}"`).join(', ')}) VALUES (${valeurs.map(() => '?').join(', ')})`).run(...valeurs.map(([, v]) => v));
  n += 1;
  if (!enfants) return n;
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    const cleDeLEnfant = db.prepare(`PRAGMA table_info("${name}")`).all().filter((c) => c.pk).map((c) => c.name);
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${name}")`).all().filter((f) => f.table === table && cleDeLEnfant.includes(f.from) && f.to in ligne)) {
      if (!colonnesDe(dImport, name)) continue;
      for (const enfant of dImport.prepare(`SELECT * FROM "${name}" WHERE "${fk.from}" = ?`).all(ligne[fk.to])) {
        n += remettreDepuisLImport(db, name, Object.fromEntries(cleDeLEnfant.map((c) => [c, enfant[c]])), { enfants: false, dImport });
      }
    }
  }
  return n;
}
