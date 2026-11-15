// Contrôle d'un fichier de contenu avant qu'on en fabrique un site (lot 9 du chantier de la base de dev ; docs/serveur.md, « Fabriquer le site depuis un
// fichier de contenu ») : l'extrait du contenu du site de dev (serveur/extrait.mjs) ou tout fichier de même forme. Il réutilise le classement du lot 5
// (lib/tables-de-la-base.mjs, serveur/empreintes.mjs) : aucune classification de plus.
//   - un fichier SQLite lisible ;
//   - chaque table de CONTENU du schéma livré (data/schema.sql) y est, et sa structure est celle du schéma (`user_version`) ;
//   - aucune table « propre au site » (fiches, comptes, groupes, journal, brouillon de la note) ni inconnue du classement ne porte une ligne : l'extrait en
//     garde les tables, vides, c'est leur contenu qui est refusé (jamais un nom ni une valeur dans le message : seulement la table et son nombre de lignes) ;
//   - si le fichier porte la vue `extrait_meta`, son empreinte est celle que les tables donnent.
// Le fichier est ouvert en lecture seule et n'est pas modifié ; l'appelant qui craint un fichier en mode WAL (qui demande un -shm) travaille sur une copie.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, statSync } from 'node:fs';
import { CLASSES_DE_TABLES, TABLES_DE_CONTENU } from '../src/lib/tables-de-la-base.mjs';
import { empreintesDuContenu, identifiant, tablesDeLaBase } from './empreintes.mjs';

export class ErreurContenu extends Error {
  /** @param {string[]} problemes */
  constructor(problemes) {
    super(`Fichier de contenu refusé : ${problemes.join(' ; ')}`);
    this.name = 'ErreurContenu';
    this.problemes = problemes;
  }
}

/** Les tables de contenu du schéma et sa version (`PRAGMA user_version`), lues dans le texte de data/schema.sql (une base en mémoire, rien d'écrit). */
export function structureDuSchema(cheminSchema) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(readFileSync(cheminSchema, 'utf8'));
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name));
    return { version: db.prepare('PRAGMA user_version').get().user_version, contenu: TABLES_DE_CONTENU.filter((t) => tables.has(t)) };
  } finally {
    db.close();
  }
}

/**
 * Contrôle `chemin` contre le schéma `cheminSchema`. Ne lève que pour une erreur du schéma lui-même ; un fichier refusé donne `valide: false` et ses `problemes`.
 * @returns {{ valide: boolean, problemes: string[], meta: object|null }} `meta` : octets, format, date, version du site, schéma, empreinte lue, tables de contenu, pages
 */
export function verifierLeContenu(chemin, { schema: cheminSchema } = {}) {
  const problemes = [];
  let octets;
  try {
    octets = statSync(chemin).size;
  } catch {
    return { valide: false, problemes: ['le fichier est introuvable'], meta: null };
  }
  const attendu = structureDuSchema(cheminSchema);
  let db;
  try {
    db = new DatabaseSync(chemin, { readOnly: true });
    db.prepare('SELECT count(*) AS n FROM sqlite_master').get();
  } catch {
    try { db?.close(); } catch { /* déjà fermé */ }
    return { valide: false, problemes: ['ce n’est pas une base SQLite lisible'], meta: null };
  }
  try {
    const verification = db.prepare('PRAGMA quick_check(1)').get();
    const resultat = Object.values(verification ?? {})[0];
    if (resultat !== 'ok') problemes.push(`la base est abîmée (quick_check : ${String(resultat).slice(0, 80)})`);

    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version !== attendu.version) problemes.push(`la structure est celle de la version ${version}, le code livré attend la ${attendu.version} (un extrait se refait avec le même code)`);

    const tables = tablesDeLaBase(db);
    const presentes = new Set(tables.map((t) => t.nom));
    const manquantes = attendu.contenu.filter((t) => !presentes.has(t));
    if (manquantes.length) problemes.push(`${manquantes.length} table(s) du contenu manque(nt) : ${manquantes.slice(0, 8).join(', ')}${manquantes.length > 8 ? '…' : ''}`);

    for (const t of tables) {
      if (t.classe === CLASSES_DE_TABLES.CONTENU || t.classe === CLASSES_DE_TABLES.CALCULEE) continue;
      const lignes = db.prepare(`SELECT count(*) AS n FROM main.${identifiant(t.nom)}`).get().n;
      if (lignes > 0) {
        problemes.push(t.classe === null
          ? `la table « ${t.nom} » n’est pas classée et porte ${lignes} ligne(s)`
          : `la table « ${t.nom} » (propre au site : fiches, comptes, groupes, journal) porte ${lignes} ligne(s)`);
      }
    }

    let meta = null;
    if (!problemes.length) {
      const empreintes = empreintesDuContenu(db);
      let annonce = null;
      try { annonce = db.prepare('SELECT format, fabrique_le, version_du_site, schema, empreinte FROM extrait_meta').get() ?? null; } catch { /* pas un extrait : pas de méta */ }
      if (annonce && annonce.empreinte !== empreintes.global) problemes.push('l’empreinte annoncée par le fichier (extrait_meta) n’est pas celle de ses tables');
      meta = {
        octets,
        format: annonce?.format ?? null,
        fabrique_le: annonce?.fabrique_le ?? null,
        version_du_site: annonce?.version_du_site || null,
        schema: version,
        empreinte: empreintes.global,
        tables_de_contenu: Object.keys(empreintes.tables).length,
        pages: db.prepare('SELECT count(*) AS n FROM page').get().n,
      };
    }
    return { valide: problemes.length === 0, problemes, meta: problemes.length ? null : meta };
  } finally {
    db.close();
  }
}
