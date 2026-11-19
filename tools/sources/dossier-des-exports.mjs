// Le dossier des exports des sources Google (docs/sources.md, « Après le lot 12 : où lire les exports »). Un seul endroit pour les outils de tools/ qui le lisent
// ou l'écrivent : import-gdocs.mjs, sources/rapprocher.mjs, bestiaire/extraire.mjs (tools/docs/codex.py fait de même en Python).
// MAVERICK_SOURCES_RAW (chemin absolu, ou relatif au dossier de travail) le remplace ; sans elle, `sources/raw` à la racine du dépôt (comportement d'avant).
import { resolve } from 'node:path';

/** Le dossier des exports : MAVERICK_SOURCES_RAW si elle est posée (non vide), sinon `<racine>/sources/raw`. */
export function dossierDesExports(racine, env = process.env) {
  const choisi = (env.MAVERICK_SOURCES_RAW ?? '').trim();
  return choisi ? resolve(choisi) : resolve(racine, 'sources', 'raw');
}
