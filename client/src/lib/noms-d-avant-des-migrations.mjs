// Les noms que des migrations ont changés en gardant l'identifiant (R237 (4) et (11), migration 0117 : « Répar'Os » devenu « Répar Os », « Armure d'os »
// devenu « Armure osseuse »…), lus dans leur registre `data/migrations/<migration>.json`, pour que la fiche retrouve un sort cité sous son ancien nom
// (lib/fiche-tableur-import.mjs#retrouver, champ `noms_d_avant` des règles de la fiche). Le site de dev, lui, laisse la trace de ses renommages dans
// historique_modification (lib/historique-site.mjs#valeursDAvant) ; une migration n'y écrit rien, son registre est la source.
// Forme lue : un registre dont la clé `sorts` (la table, au pluriel) porte des listes nommées `renommes…` d'éléments { id, avant, apres } (ancien nom,
// nouveau nom). Aucun nom n'est écrit ici. Node seulement (lit le dépôt) ; jamais importé par un script de page.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trouverRacine } from './donnees.mjs';

const TABLES = { sorts: 'sort' };

/**
 * Map(table → Map(id → [ancien nom, …])) des renommages des registres de migration, dans l'ordre des migrations. Un nom qui est le nom courant de
 * la ligne est retiré par l'appelant (fiche-regles.mjs).
 */
export function nomsDAvantDesMigrations(racine = trouverRacine()) {
  const dossier = join(racine, 'data', 'migrations');
  const sortie = new Map(Object.values(TABLES).map((t) => [t, new Map()]));
  if (!existsSync(dossier)) return sortie;
  for (const fichier of readdirSync(dossier).filter((f) => f.endsWith('.json')).sort()) {
    let registre;
    try { registre = JSON.parse(readFileSync(join(dossier, fichier), 'utf8')); } catch { continue; }
    for (const [cle, table] of Object.entries(TABLES)) {
      const bloc = registre?.[cle];
      if (!bloc || typeof bloc !== 'object' || Array.isArray(bloc)) continue;
      for (const [nom, liste] of Object.entries(bloc)) {
        if (!nom.startsWith('renommes') || !Array.isArray(liste)) continue;
        for (const r of liste) {
          if (typeof r?.id !== 'string' || typeof r?.avant !== 'string') continue;
          const noms = sortie.get(table);
          noms.set(r.id, [...(noms.get(r.id) ?? []), r.avant]);
        }
      }
    }
  }
  return sortie;
}
