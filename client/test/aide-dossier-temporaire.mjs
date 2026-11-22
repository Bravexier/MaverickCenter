// Dossiers temporaires des tests : chaque dossier qu'un test crée (copie de base, export, faux dépôt…) est supprimé quand il a fini, même en cas
// d'échec — demande du propriétaire (2026-10-23) : « il doivent faire le ménage quand c'est fini ». Seul module de client/test/ à appeler mkdtemp ou
// os.tmpdir() : le garde-fou test/dossiers-temporaires.test.mjs refuse tout autre appel. Module sans test propre (n'est pas un *.test.mjs) : son
// comportement est épinglé par test/dossiers-temporaires.test.mjs.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Préfixe commun des dossiers créés ici : `maverick-test-<prefixe>-XXXXXX`, sous os.tmpdir() (ou sous `dans`). */
export const PREFIXE_COMMUN = 'maverick-test-';

const enCours = new Set();
const aReprendre = new Set(); // Windows : ceux dont la suppression a buté sur un fichier encore ouvert
let surveillance = false;

/** Windows refuse de supprimer un fichier encore ouvert (base SQLite d'un test) : EPERM, EBUSY ou ENOTEMPTY. Sur un autre système, ces erreurs restent des erreurs. */
export const estVerrouille = (erreur, plateforme = process.platform) => plateforme === 'win32' && ['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(erreur?.code);

/** Supprime `dossier` (récursivement, sans erreur s'il n'existe plus) et l'oublie ; verrouillé sous Windows, il est repris à la création du dossier suivant, puis à la sortie du processus. */
export function supprimerDossierTemporaire(dossier) {
  try {
    rmSync(dossier, { recursive: true, force: true });
  } catch (erreur) {
    if (!estVerrouille(erreur)) throw erreur;
    aReprendre.add(dossier);
    return;
  }
  aReprendre.delete(dossier);
  enCours.delete(dossier);
}

/**
 * Les verrous de Windows tombent avec le processus : un processus détaché finit la suppression juste après lui, en réessayant dix secondes au plus. La boucle
 * est ici car les reprises de rmSync (maxRetries) rendent la main aussitôt sur un fichier encore ouvert.
 */
function confierLaSuppression(dossiers) {
  const script = `const { rmSync } = require('node:fs');
const pause = new Int32Array(new SharedArrayBuffer(4));
let restants = process.argv.slice(1);
for (let essai = 0; essai < 100 && restants.length > 0; essai++) {
  if (essai > 0) Atomics.wait(pause, 0, 0, 100);
  restants = restants.filter((d) => { try { rmSync(d, { recursive: true, force: true }); return false; } catch { return true; } });
}`;
  spawn(process.execPath, ['-e', script, ...dossiers], { detached: true, stdio: 'ignore', windowsHide: true, cwd: dirname(process.execPath) }).unref();
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
  for (const d of [...aReprendre]) supprimerDossierTemporaire(d);
  const dossier = mkdtempSync(join(dans, `${PREFIXE_COMMUN}${prefixe}-`));
  enCours.add(dossier);
  if (!surveillance) {
    surveillance = true;
    process.on('exit', () => {
      for (const d of [...enCours]) supprimerDossierTemporaire(d);
      if (enCours.size > 0) confierLaSuppression([...enCours]);
    });
  }
  t?.after(() => supprimerDossierTemporaire(dossier));
  return dossier;
}

/** Le chemin `nom` dans un dossier temporaire neuf (même suppression que dossierTemporaire) : une copie de base, un export, un registre… */
export const fichierTemporaire = (nom, prefixe, options) => join(dossierTemporaire(prefixe, options), nom);

/** Les variables d'environnement qui font écrire les dossiers temporaires d'un processus enfant (script, outil, service) dans `dossier`. */
export const variablesTemporaires = (dossier) => ({ TMPDIR: dossier, TMP: dossier, TEMP: dossier });
