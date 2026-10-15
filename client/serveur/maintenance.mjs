// « Maintenance en cours » pendant une vraie mise à jour (demande du propriétaire ; docs/serveur.md, « Maintenance pendant une mise à jour ») :
// dès que « Effectuer la mise à jour » est lancé (pas la simulation), le site de dev ET la production renvoient leurs pages vers /maintenance/
// (menus grisés, « En travaux, merci de revenir dans quelques minutes ») ; chacun rouvre DÈS QUE la nouvelle version y tourne, indépendamment de
// l'autre (l'un peut s'installer plus vite que l'autre).
//
// Qui sait quoi :
//   - le service du site de dev (MAVERICK_EDITION=1) tient le lancement (db/mise-a-jour/etat.json, notes-de-version.mjs) : il en tire une ANNONCE
//     (lot, version cible X.Y, début, étape) et la publie dans le dossier partagé (MAVERICK_MAINTENANCE, monté dans les deux instances : le dossier
//     maintenance/ du serveur normal, deploy/vps/instances.sh) ; un lancement fini sans livraison (échec, annulé…) retire l'annonce ;
//   - chaque service (dev et production) compare l'annonce à SA version, celle qui tourne (version.json lu au démarrage) : la maintenance dure tant
//     que cette version est plus ancienne que la version cible. La nouvelle version installée, le service redémarre (service.mjs) et refait sa
//     base vivante avant de répondre : la maintenance de ce serveur est finie, celle de l'autre continue tant qu'il n'a pas la sienne.
// Garde-fous : une annonce mal formée ne compte pas ; au-delà de DUREE_MAX_MAINTENANCE après le lancement, plus rien n'est en maintenance (un
// installateur qui n'arrive jamais ne ferme pas le site pour toujours) ; « Lever la maintenance » (page de maintenance du site de dev) la retire.
// Node seulement (node:…), sans dépendance.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { auMoins, DUREE_MAX_RUN } from './notes-de-version.mjs';

/** Le fichier de l'annonce, dans le dossier partagé. */
export const FICHIER_ANNONCE = 'annonce.json';
export const FORMAT_ANNONCE = 'maverick-maintenance/1';
/** États d'une VRAIE mise à jour pendant lesquels les sites sont en maintenance (« termine » : livrée sur master, installateurs en route). */
const ETATS_DE_MAINTENANCE = ['envoi', 'lance', 'en_cours', 'fusionne', 'termine'];
/** Au plus, depuis le lancement : un run dure au plus DUREE_MAX_RUN, puis les installateurs ont une heure pour arriver (≈ 20 min d'habitude). */
export const DUREE_MAX_MAINTENANCE = DUREE_MAX_RUN + 3_600_000;
/** L'étape montrée par la page de maintenance, d'après l'état du lancement. */
const ETAPES = { envoi: 'preparation', lance: 'preparation', en_cours: 'preparation', fusionne: 'livraison', termine: 'installation' };

const ID_LOT = /^[0-9a-f-]{36}$/;
const VERSION_CIBLE = /^\d+\.\d+$/;
const ecoule = (depuis, instant) => Date.parse(instant) - Date.parse(depuis);

/**
 * L'annonce que porte le lancement `l` à l'instant `instant` : un objet pendant une vraie mise à jour, `null` quand ce lancement ne met (plus)
 * rien en maintenance (simulation, échec, annulé, maintenance levée, plafond dépassé), `undefined` sans lancement connu (rien n'est su : une
 * annonce déjà publiée reste, et s'éteint d'elle-même au plafond).
 */
export function annonceDuLancement(l, { instant }) {
  if (!l?.lot) return undefined;
  if (l.simulation || !ETATS_DE_MAINTENANCE.includes(l.etat) || l.maintenance_levee_le) return null;
  if (!ID_LOT.test(l.lot) || !VERSION_CIBLE.test(String(l.version_cible ?? '')) || Number.isNaN(Date.parse(l.lance_le))) return null;
  if (ecoule(l.lance_le, instant) > DUREE_MAX_MAINTENANCE) return null;
  return { format: FORMAT_ANNONCE, lot: l.lot, version_cible: l.version_cible, depuis: l.lance_le, etat: l.etat };
}

/** L'annonce est-elle bien formée (écrite par un service de cette version) ? Une annonce douteuse ne met rien en maintenance. */
function annonceValable(a) {
  return Boolean(a) && typeof a === 'object' && a.format === FORMAT_ANNONCE && ID_LOT.test(String(a.lot)) && VERSION_CIBLE.test(String(a.version_cible))
    && !Number.isNaN(Date.parse(a.depuis)) && ETATS_DE_MAINTENANCE.includes(a.etat);
}

/** L'annonce publiée dans le dossier partagé, ou null (absente, illisible ou mal formée). */
export function lireAnnonce(dossier) {
  if (!dossier) return null;
  try {
    const a = JSON.parse(readFileSync(join(dossier, FICHIER_ANNONCE), 'utf8'));
    return annonceValable(a) ? a : null;
  } catch {
    return null;
  }
}

/**
 * Publie l'annonce dans le dossier partagé (écriture atomique, seulement si elle change) ; `null` la retire, `undefined` ne touche à rien.
 * Rend true si le fichier a changé.
 */
export function publierAnnonce(dossier, annonce) {
  if (!dossier || annonce === undefined) return false;
  const chemin = join(dossier, FICHIER_ANNONCE);
  let actuel = null;
  try {
    actuel = readFileSync(chemin, 'utf8');
  } catch {
    // pas encore d'annonce
  }
  if (annonce === null) {
    if (actuel === null) return false;
    rmSync(chemin, { force: true });
    return true;
  }
  const texte = `${JSON.stringify(annonce, null, 2)}\n`;
  if (texte === actuel) return false;
  mkdirSync(dossier, { recursive: true });
  writeFileSync(`${chemin}.tmp`, texte);
  renameSync(`${chemin}.tmp`, chemin);
  return true;
}

/**
 * L'état de maintenance d'un serveur dont la version qui tourne est `version` : { active, version_cible, depuis, etape }. Actif tant qu'une
 * annonce valable vise une version plus récente que `version`, et jamais au-delà de DUREE_MAX_MAINTENANCE.
 */
export function etatDeMaintenance({ annonce, version, instant }) {
  if (!annonceValable(annonce)) return { active: false };
  if (auMoins(version, annonce.version_cible)) return { active: false }; // la nouvelle version tourne ici : ce serveur a fini
  if (ecoule(annonce.depuis, instant) > DUREE_MAX_MAINTENANCE) return { active: false };
  return { active: true, version_cible: annonce.version_cible, depuis: annonce.depuis, etape: ETAPES[annonce.etat] };
}
