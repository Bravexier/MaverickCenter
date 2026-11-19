// Les noms que des migrations ont changés en gardant l'identifiant (R237 (4) et (11), migration 0117 : « Répar'Os » devenu « Répar Os », « Armure d'os »
// devenu « Armure osseuse »…), pour que la fiche retrouve un sort cité sous son ancien nom (lib/fiche-tableur-import.mjs#retrouver, champ `noms_d_avant`
// des règles de la fiche). Le site de dev, lui, laisse la trace de ses renommages dans historique_modification (lib/historique-site.mjs#valeursDAvant) ;
// une migration n'y écrit rien : ses renommages sont lus dans la référence data/references/noms-d-avant-des-migrations.json, tirée des listes
// `renommes…` des registres de migration (lib/references-des-migrations.mjs ; le registre lui-même peut quitter le dépôt avec les migrations mixtes).
// Forme lue : { <table> : { id : [ancien nom, …] } } (les clés `$commentaire` et `migrations` mises à part). Aucun nom n'est écrit ici. Node seulement
// (lit le dépôt) ; jamais importé par un script de page.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trouverRacine } from './donnees.mjs';
import { REFERENCES } from './references-des-migrations.mjs';

/**
 * Map(table → Map(id → [ancien nom, …])) des renommages faits par des migrations, dans l'ordre des migrations (vide sans la référence). Un nom qui est
 * le nom courant de la ligne est retiré par l'appelant (fiche-regles.mjs).
 */
export function nomsDAvantDesMigrations(racine = trouverRacine()) {
  const fichier = join(racine, REFERENCES.nomsDAvant);
  const sortie = new Map([['sort', new Map()]]);
  if (!existsSync(fichier)) return sortie;
  for (const [table, noms] of Object.entries(JSON.parse(readFileSync(fichier, 'utf8')))) {
    if (table.startsWith('$') || table === 'migrations' || !noms || typeof noms !== 'object' || Array.isArray(noms)) continue;
    sortie.set(table, new Map(Object.entries(noms).filter(([, l]) => Array.isArray(l)).map(([id, l]) => [id, [...l]])));
  }
  return sortie;
}
