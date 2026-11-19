// Le registre `.json` d'une migration, lu par un test, que la migration soit encore dans le dépôt ou sortie avec le contenu (jour J du lot 12, R296 ;
// src/lib/sortie-du-contenu.mjs).
//   registreDeMigration(nom)   nom sans extension (« 0114-mots-cles-categories-assignees »). Éteint : data/migrations/<nom>.json, comme avant. Allumé
//                              (contenuSorti() ou mixtesSorties()) : pour un registre gardé, l'entrée de test/fixtures/registres-sortis.json (ce que les
//                              tests d'invariants en lisent encore, recopié tel quel : ids figés, cellules, balises) ; sinon data/migrations/<nom>.json
//                              (registre qui reste), et une erreur claire s'il est sorti sans être gardé. Un registre de migration mixte dont le code qui
//                              tourne lit une partie a sa référence dans data/references/ (lib/references-des-migrations.mjs) : un test la lit là.
//   REGISTRES_GARDES           { nom → ce qui est gardé } (test/fixtures/registres-sortis.json, sans son commentaire).
//   lireLeRegistre(nom)        le fichier data/migrations/<nom>.json lui-même (les tests « registre gardé », retirés le jour J avec lui).
// L'état d'import ne dépend pas des registres : test/aide-base-d-import.mjs défait les traces `saisie` et `decision` de historique_modification ; un
// registre ne dit que ce qu'une migration a fait (quels ids elle a créés, quelles cellules elle a réécrites), que la base ne garde pas.
import { existsSync, readFileSync } from 'node:fs';
import { contenuSorti, mixtesSorties } from '../src/lib/sortie-du-contenu.mjs';

const DOSSIER = new URL('../../data/migrations/', import.meta.url);

export const REGISTRES_GARDES = Object.freeze(Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(new URL('./fixtures/registres-sortis.json', import.meta.url), 'utf8'))).filter(([nom]) => !nom.startsWith('$')),
));

export const lireLeRegistre = (nom) => JSON.parse(readFileSync(new URL(`${nom}.json`, DOSSIER), 'utf8'));

/** Le registre de la migration `nom`, ou ce que test/fixtures/registres-sortis.json en garde quand le contenu est sorti. */
export function registreDeMigration(nom) {
  if (!contenuSorti() && !mixtesSorties()) return lireLeRegistre(nom);
  if (Object.hasOwn(REGISTRES_GARDES, nom)) return REGISTRES_GARDES[nom];
  if (!existsSync(new URL(`${nom}.json`, DOSSIER))) {
    throw new Error(`registre ${nom}.json : sorti avec le contenu ou les migrations mixtes et non gardé dans test/fixtures/registres-sortis.json (test/aide-registres-sortis.mjs)`);
  }
  return lireLeRegistre(nom);
}
