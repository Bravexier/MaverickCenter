// Les tests qui sortent avec le contenu le jour J du lot 12 (src/lib/sortie-du-contenu.mjs#RETIRES_AVEC_LE_CONTENU) : ils éprouvent une migration de
// données elle-même (son SQL, son registre), qui quitte le dépôt ce jour-là. De même pour les migrations mixtes (RETIRES_AVEC_LES_MIXTES,
// interrupteur mixtesSorties()).
//   const testDeLaMigration = testRetireAvecLeContenu(import.meta.url);      (ou testRetireAvecLesMixtes(import.meta.url))
//   testDeLaMigration('titre exact déclaré dans RETIRES_AVEC_LE_CONTENU', () => { … });
// Éteint (le dépôt d'aujourd'hui, la CI) : `test` de node:test, rien ne change, aucun saut. Allumé (la passe S, puis le jour J) : le test n'est pas
// déclaré, comme la PR du jour J le supprimera. Un titre absent de la liste est une erreur au chargement : la liste dit tout ce qui sort.
import { relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { contenuSorti, mixtesSorties, RETIRES_AVEC_LE_CONTENU, RETIRES_AVEC_LES_MIXTES } from '../src/lib/sortie-du-contenu.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** La fonction `test` d'un fichier d'une liste (`url` : son import.meta.url), pour ses seuls tests déclarés ; `sorti()` vrai : ils ne sont pas déclarés. */
function testRetire(url, liste, nomDeLaListe, sorti) {
  const fichier = relative(RACINE, fileURLToPath(url)).split('\\').join('/');
  const declares = liste[fichier]?.tests ?? [];
  return (titre, ...reste) => {
    if (!declares.includes(titre)) throw new Error(`${fichier} : « ${titre} » n'est pas déclaré dans ${nomDeLaListe} (src/lib/sortie-du-contenu.mjs)`);
    if (sorti()) return undefined; // sorti avec la migration qu'il éprouve
    return test(titre, ...reste);
  };
}

/** La fonction `test` d'un fichier de RETIRES_AVEC_LE_CONTENU (`url` : son import.meta.url), pour ses seuls tests déclarés. */
export const testRetireAvecLeContenu = (url) => testRetire(url, RETIRES_AVEC_LE_CONTENU, 'RETIRES_AVEC_LE_CONTENU', () => contenuSorti());

/** La fonction `test` d'un fichier de RETIRES_AVEC_LES_MIXTES (`url` : son import.meta.url), pour ses seuls tests déclarés. */
export const testRetireAvecLesMixtes = (url) => testRetire(url, RETIRES_AVEC_LES_MIXTES, 'RETIRES_AVEC_LES_MIXTES', () => mixtesSorties());
