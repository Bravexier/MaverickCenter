// Ce que la migration 0117 (Magie V10, R237) a réécrit dans `sort`, lu dans le SQL de la migration : les tests des migrations antérieures (registres de
// 0063 et 0065 : répartition des coûts) comparent leur registre à la base dans son état d'import, mais un sort que 0117 a supprimé ou dont elle a réécrit
// la colonne n'est plus celui que ce registre décrit (le classeur de Décembre fait foi, R237 (1)) : ils l'écartent par cette aide, sans liste écrite à la main.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trouverRacine } from '../src/lib/donnees.mjs';

const CHEMIN = join(trouverRacine(), 'data', 'migrations', '0117-magies-v10-specialisations.sql');
let texte = null;
const sql = () => (texte ??= readFileSync(CHEMIN, 'utf8'));

/** Les identifiants des sorts que la 0117 supprime. */
export const sortsSupprimesParLa0117 = () => {
  const liste = /^DELETE FROM sort WHERE id IN \((.+)\);$/m.exec(sql())?.[1] ?? '';
  return new Set([...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]));
};

/** Les identifiants des sorts dont la 0117 réécrit au moins une des `colonnes` (UPDATE sort SET … WHERE id = '…'), plus les sorts supprimés. */
export function sortsReecritsParLa0117(colonnes) {
  const ids = sortsSupprimesParLa0117();
  // (une valeur peut tenir sur plusieurs lignes : on lit la migration d'un bloc)
  for (const m of sql().matchAll(/^UPDATE sort SET (?!ordre = ordre )([\s\S]+?) WHERE id = '([^']+)';$/gm)) {
    if (colonnes.some((c) => new RegExp(`(?:^|, )${c} = `).test(m[1]))) ids.add(m[2]);
  }
  return ids;
}

/**
 * Les sorts dont la 0117 écrit le coût tel que le classeur de Décembre le donne, sans le répartir (Projectile arcanique, « *4 / projectile » : MAJ-K7
 * ouverte, registre 0117-magies-v10-specialisations.json, `sorts.couts_non_repartis` ; les autres sont répartis par R244, `sorts.couts_r244`) : leur
 * « Coût » n'a pas la forme d'un coût réparti.
 */
export const coutsNonRepartisDeLa0117 = () => new Set(
  JSON.parse(readFileSync(CHEMIN.replace(/\.sql$/, '.json'), 'utf8')).sorts.couts_non_repartis.map((c) => c.id),
);

/** Les identifiants des 119 sorts que la 0117 crée (registre 0117-magies-v10-specialisations.json, `sorts.nouveaux`) : aucun registre antérieur ne les décrit. */
export const sortsNouveauxDeLa0117 = () => new Set(JSON.parse(readFileSync(CHEMIN.replace(/\.sql$/, '.json'), 'utf8')).sorts.nouveaux);

/**
 * Les identifiants des sorts dont la 0117 réécrit les lignes de `table` (`sort_bonus_maitrise`, `sort_mode`… : DELETE puis INSERT, ou INSERT d'un sort
 * nouveau), plus les sorts supprimés : le registre d'une migration antérieure (0004) ne décrit plus leurs lignes. Une mise à jour de la seule
 * `source_ref` (classeur de Décembre) ne compte pas.
 */
export function sortsDontLa0117ReecritLes(table) {
  const ids = sortsSupprimesParLa0117();
  for (const m of sql().matchAll(new RegExp(`^DELETE FROM ${table} WHERE sort_id (?:= '([^']+)'|IN \\((.+)\\));$`, 'gm'))) {
    if (m[1]) ids.add(m[1]);
    else for (const x of m[2].matchAll(/'([^']+)'/g)) ids.add(x[1]);
  }
  for (const m of sql().matchAll(new RegExp(`^INSERT INTO ${table} \\([^)]*\\) VALUES \\('([^']+)'`, 'gm'))) ids.add(m[1]);
  return ids;
}

/** Les pages dont la 0117 réécrit le corps entier (« UPDATE page SET corps_md = '…' WHERE id = '…'; » : pages de magie, bestiaire, altérations, météo). */
export const pagesReecritesParLa0117 = () =>
  new Set([...sql().matchAll(/^UPDATE page SET corps_md = '(?:[^']|'')*' WHERE id = '([^']+)';$/gm)].map((m) => m[1]));
