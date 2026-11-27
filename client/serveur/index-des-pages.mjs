// Le service tient l'index de recherche des pages (`page_fts`, table dérivée : data/schema.sql) : une ligne par page, toujours. Une page créée par une route, un
// lot, l'annulation d'un lot ou le rejeu du journal y reçoit sa ligne, une page partie y perd la sienne, dans la transaction de l'écriture et avant les contrôles
// du contenu (serveur/controles-du-contenu.mjs : « page_fts : une ligne par page attendue », que le garde-fou du paquet relit). La ligne est celle de la
// fabrication (lib/index-des-pages.mjs, partagé avec scripts/db-derive.mjs). Une page modifiée garde sa ligne jusqu'à la fabrication suivante, qui refait tout
// l'index. Écriture hors du journal : l'index n'est pas du contenu. Le nom de ce module ne commence pas par `edition` (test/libelles-de-la-base.test.mjs compte
// les tables que l'édition écrit).
import { INSERTION_DANS_L_INDEX, lignesDeLIndex } from '../src/lib/index-des-pages.mjs';

/** Vrai si la base a l'index et les pages (une base de test réduite peut n'avoir ni l'un ni l'autre). */
const aLIndex = (db) => db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('page', 'page_fts')").get().n === 2;

/**
 * Donne sa ligne à chaque page qui n'en a pas et retire celle d'une page qui n'existe plus (ou en double). Rien n'est fait quand l'index compte autant de lignes
 * que de pages et qu'aucune page n'y manque (deux comptes : une ligne par page). Dans la transaction en cours s'il y en a une, dans la sienne sinon.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{ ajoutees: number, retirees: number, absente?: true }} `absente` : la base n'a pas d'index (rien n'est fait)
 */
export function tenirLIndexDesPages(db) {
  if (!aLIndex(db)) return { ajoutees: 0, retirees: 0, absente: true };
  const manquantes = () => db.prepare('SELECT id FROM page WHERE id NOT IN (SELECT page_id FROM page_fts) ORDER BY id').all().map((r) => r.id);
  const pages = db.prepare('SELECT count(*) AS n FROM page').get().n;
  const lignes = db.prepare('SELECT count(*) AS n FROM page_fts').get().n;
  const ids = manquantes();
  if (pages === lignes && !ids.length) return { ajoutees: 0, retirees: 0 };
  const travail = () => {
    let retirees = Number(db.prepare('DELETE FROM page_fts WHERE page_id NOT IN (SELECT id FROM page)').run().changes);
    // une page qui aurait deux lignes n'en garde qu'une
    retirees += Number(db.prepare('DELETE FROM page_fts WHERE rowid NOT IN (SELECT min(rowid) FROM page_fts GROUP BY page_id)').run().changes);
    const inserer = db.prepare(INSERTION_DANS_L_INDEX);
    const nouvelles = ids.length ? lignesDeLIndex(db, { ids }) : [];
    for (const l of nouvelles) inserer.run(...l);
    return { ajoutees: nouvelles.length, retirees };
  };
  if (db.isTransaction) return travail();
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = travail();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // déjà annulée par SQLite
    }
    throw e;
  }
}
