// `node scripts/lot-des-reperes.mjs <base.db> [--titre <titre>]` (dans client/) : écrit sur la sortie standard le lot de changements « maverick-lot/1 » (JSON)
// qui pose le repère de chaque mot-clé de la base sans page, sans sort et sans repère (chantier 4 des mots-clés : docs/chantier-retrait-des-colonnes.md, §7 ;
// table `repere`, migration 0135). Nom, adresse, définition, couleur et icône sont recopiés du mot-clé, tels quels. La base est lue, jamais écrite : l'extrait
// du jour du site de dev (`npm run db:extrait`, var/extrait/maverick-dev.db) pour le vrai lot, une base d'essai pour les tests. Le lot se dépose ensuite sur
// le site de dev (`POST /api/edition/lots/`, docs/serveur.md, « Lots de changements (service) ») ; l'outil n'envoie rien.
// Code de sortie : 0 (lot écrit, ou rien à poser : rien sur la sortie standard, un mot sur la sortie d'erreur), 1 (base illisible ou d'avant la migration 0135),
// 2 (usage). La logique : src/lib/lot-des-reperes.mjs.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { lotDesReperes } from '../src/lib/lot-des-reperes.mjs';

/** Le lot des repères de la base `chemin` (ouverte en lecture seule), ou null s'il n'y a rien à poser. */
export function lotDeLaBase(chemin, options = {}) {
  if (!existsSync(chemin)) throw new Error(`base introuvable : ${chemin}`);
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    return lotDesReperes(db, options);
  } finally {
    db.close();
  }
}

function principal(args) {
  const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
  const titre = option('--titre');
  const libres = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--titre');
  if (libres.length !== 1 || (args.includes('--titre') && !titre)) {
    console.error('usage : node scripts/lot-des-reperes.mjs <base.db> [--titre <titre>]');
    return 2;
  }
  let lot;
  try {
    lot = lotDeLaBase(resolve(libres[0]), titre ? { titre } : {});
  } catch (e) {
    console.error(`lot des repères : ${e.message}`);
    return 1;
  }
  if (!lot) {
    console.error('lot des repères : chaque mot-clé a déjà une page, un sort ou un repère, rien à poser');
    return 0;
  }
  process.stdout.write(`${JSON.stringify(lot, null, 2)}\n`);
  console.error(`lot des repères : ${lot.operations.length} repère(s) à poser`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = principal(process.argv.slice(2));
