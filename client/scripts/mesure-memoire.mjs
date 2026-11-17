// Sonde de mémoire : chargée dans chaque processus Node d'une fabrication par NODE_OPTIONS=--import=<ce fichier> (serveur/fabrication-depuis-contenu.mjs).
// À sa sortie, un processus ajoute une ligne JSON au fichier MAVERICK_MESURE_MEMOIRE : son pic de mémoire résidente (`process.resourceUsage().maxRSS`, en
// kilo-octets), l'étape en cours (MAVERICK_MESURE_ETAPE) et le programme lancé. Les processus que ce processus lance à leur tour (variable héritée) sont mesurés
// de même. Sans la variable, ce module ne fait rien. Aucune dépendance.
import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import { isMainThread } from 'node:worker_threads';

const fichier = process.env.MAVERICK_MESURE_MEMOIRE;
if (fichier && isMainThread) {
  process.on('exit', () => {
    try {
      const ligne = { pid: process.pid, etape: process.env.MAVERICK_MESURE_ETAPE ?? null, programme: basename(process.argv[1] ?? ''), max_rss_ko: process.resourceUsage().maxRSS };
      appendFileSync(fichier, `${JSON.stringify(ligne)}\n`);
    } catch {
      // une mesure perdue ne fait jamais échouer une fabrication
    }
  });
}
