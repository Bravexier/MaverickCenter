// Dossiers temporaires des tests : chaque dossier qu'un test crée (copie de base, export, faux dépôt…) est supprimé quand il a fini, même en cas
// d'échec — demande du propriétaire (2026-10-23) : « il doivent faire le ménage quand c'est fini ». Seul module de client/test/ à appeler mkdtemp ou
// os.tmpdir() : le garde-fou test/dossiers-temporaires.test.mjs refuse tout autre appel. Module sans test propre (n'est pas un *.test.mjs) : son
// comportement est épinglé par test/dossiers-temporaires.test.mjs.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Préfixe commun des dossiers créés ici : `maverick-test-<prefixe>-XXXXXX`, sous os.tmpdir() (ou sous `dans`). */
export const PREFIXE_COMMUN = 'maverick-test-';

const enCours = new Set();
let surveillance = false;

/** Supprime `dossier` (récursivement, sans erreur s'il n'existe plus) et l'oublie. */
export function supprimerDossierTemporaire(dossier) {
  rmSync(dossier, { recursive: true, force: true });
  enCours.delete(dossier);
}

/** Les dossiers créés par ce processus et pas encore supprimés (pour le garde-fou). */
export const dossiersEnCours = () => [...enCours];

/**
 * Crée un dossier temporaire vide et le fait supprimer à la fin :
 * - `t` (contexte d'un test, ou celui que reçoit beforeEach) : à la fin de ce test, réussi ou non (t.after) ;
 * - sinon : à la sortie du processus du fichier de test (node --test lance un processus par fichier), après tous ses hooks after — les services et
 *   les bases ouverts par le fichier sont alors fermés —, et même après une exception non rattrapée.
 * Dans tous les cas, la sortie du processus supprime ce qui resterait. `dans` : le dossier parent (par défaut os.tmpdir() ; par exemple /dev/shm
 * pour un autre système de fichiers).
 */
export function dossierTemporaire(prefixe, { t, dans = tmpdir() } = {}) {
  const dossier = mkdtempSync(join(dans, `${PREFIXE_COMMUN}${prefixe}-`));
  enCours.add(dossier);
  if (!surveillance) {
    surveillance = true;
    process.on('exit', () => { for (const d of [...enCours]) supprimerDossierTemporaire(d); });
  }
  t?.after(() => supprimerDossierTemporaire(dossier));
  return dossier;
}

/** Le chemin `nom` dans un dossier temporaire neuf (même suppression que dossierTemporaire) : une copie de base, un export, un registre… */
export const fichierTemporaire = (nom, prefixe, options) => join(dossierTemporaire(prefixe, options), nom);

/** Les variables d'environnement qui font écrire les dossiers temporaires d'un processus enfant (script, outil, service) dans `dossier`. */
export const variablesTemporaires = (dossier) => ({ TMPDIR: dossier, TMP: dossier, TEMP: dossier });
