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
 * Les sorts dont la 0117 écrit le coût tel que le classeur de Décembre le donne, sans le répartir (« 8xN/tour », « Variable selon le sort bloqué » : question
 * ouverte au propriétaire, registre 0117-magies-v10-specialisations.json, `sorts.couts_non_repartis`) : leur « Coût » n'a pas la forme d'un coût réparti.
 */
export const coutsNonRepartisDeLa0117 = () => new Set(
  JSON.parse(readFileSync(CHEMIN.replace(/\.sql$/, '.json'), 'utf8')).sorts.couts_non_repartis.map((c) => c.id),
);

/** Les identifiants des 119 sorts que la 0117 crée (registre 0117-magies-v10-specialisations.json, `sorts.nouveaux`) : aucun registre antérieur ne les décrit. */
export const sortsNouveauxDeLa0117 = () => new Set(JSON.parse(readFileSync(CHEMIN.replace(/\.sql$/, '.json'), 'utf8')).sorts.nouveaux);
