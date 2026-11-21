// Adresse de fichier virtuelle d'un morceau de Markdown rendu depuis la base (lib/guide-rendu.ts) : le processeur Markdown la convertit en chemin (vfile),
// et Windows refuse un chemin sans lettre de lecteur (ERR_INVALID_FILE_URL_PATH). Node seulement, jamais importé côté navigateur.
import { pathToFileURL } from 'node:url';

/** `file:///guide/le-combat.md` (Linux, inchangé) ou `file:///C:/guide/le-combat.md` (Windows) ; aucun fichier n'est lu à cette adresse. */
export function urlDuMorceau(id, { windows = process.platform === 'win32' } = {}) {
  return pathToFileURL(`${windows ? 'C:' : ''}/${id}.md`, { windows });
}
