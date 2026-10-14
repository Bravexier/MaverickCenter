// Le vocabulaire des mots-clés lu dans la base construite (table mot_cle, migration 0043) : la liste de la page Recherche et l'adresse des pastilles des
// pages du wiki (/recherche/?mot-cle=<id>). Les pages portent les LIBELLÉS de leurs mots-clés (front matter `tags`, fabriqué par db:export-pages) : l'id
// d'un libellé est celui du mot-clé qui s'écrit pareil (normalize = mot_cle.libelle_cle). Sans dépendance Astro ni navigateur : la base est passée par
// l'appelant (pages, tests).
import { parLibelle } from './mots-cles.mjs';
import { normalize } from './text.mjs';

const caches = new WeakMap(); // base -> { vocabulaire, ids }

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));

function lire(db) {
  if (caches.has(db)) return caches.get(db);
  const vocabulaire = tableExiste(db, 'mot_cle')
    ? db.prepare('SELECT id, libelle, libelle_cle FROM mot_cle').all().map((m) => ({ ...m })).sort(parLibelle)
    : [];
  const lu = { vocabulaire, ids: new Map(vocabulaire.map((m) => [m.libelle_cle, m.id])) };
  caches.set(db, lu);
  return lu;
}

/** Le vocabulaire : [{ id, libelle, libelle_cle }], trié par libellé ; vide pour une base sans table mot_cle (antérieure à la migration 0043). */
export const chargerVocabulaire = (db) => lire(db).vocabulaire;

/**
 * L'id du mot-clé qui s'écrit `libelle` ; à défaut (une page écrite à la main et pas encore versée dans la base), son écriture même : les ids de la
 * migration 0043 sont les anciennes clés des adresses /tags/<clé>/.
 */
export function idDuMotCle(db, libelle) {
  const cle = normalize(libelle);
  return lire(db).ids.get(cle) ?? cle;
}
