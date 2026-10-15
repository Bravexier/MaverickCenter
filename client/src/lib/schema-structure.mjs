// Structure du schéma de la base pour le cadre « Schéma de la base » de la page Debug (site de dev seulement ; demande du propriétaire du 2026-10-15 :
// « un mappage vectoriel des tables […] Les tables montreraient une liste de toutes les colonnes et des liens pour les FK vers une autre table, ainsi
// que le type de données »). Node seulement : appelée AU BUILD par components/debug/SchemaDeLaBase.astro, jamais dans un build SITE_MODE=prod (le
// composant n'y est pas rendu) ; le JSON est posé dans la page (<script type="application/json" data-debug-schema>) et lu par scripts/debug-schema.mjs.
//
// Sources : la base construite (PRAGMA table_info, foreign_key_list : types tels que déclarés, clés, non nul, défauts, clés étrangères ; nombre de lignes au
// build) et data/schema.sql lu par lib/schema-doc.mjs#lireSchema (sections, ordre des objets, descriptions des tables et des colonnes, marque @derivee).
// Toutes les tables (sections 0 à 15, dérivées comprises) et toutes les vues ; jamais les tables FTS5 (virtuelles) ni leurs tables de shadow (elles ne
// sont pas des `CREATE TABLE` du schéma) ni les tables internes sqlite_….
//
// Forme (contrat avec le script de la page, test/debug-schema.test.mjs) :
//   { sections: [{ numero, titre }],
//     tables: [{ nom, section, description, genre: 'table'|'vue'|'derivee',
//                colonnes: [{ nom, type, pk: 0|n, nonNul, defaut, description, fk: { table, colonne } | null,
//                             fks: [{ table, colonne, colonnes: [..], vers: [..] }] }],
//                cles_etrangeres: [{ colonnes: [..], table, vers: [..], suppression }],
//                lignes }] }
// `section` est le `numero` de sa section (« 5 bis ») ; `type` est le type déclaré (« » pour une colonne de vue sans type) ; `fk` d'une colonne : la
// première clé étrangère qui la contient, et la colonne visée à la même place (`vers` : la clé primaire de la cible quand le schéma ne la nomme pas) ;
// `fks` : TOUTES les clés qui la contiennent, dans l'ordre du schéma, chacune avec ses colonnes et celles qu'elle vise (une clé à plusieurs colonnes,
// une colonne qui sert deux clés : race_don_tableau_cellule.race_id, capacite.classe_id ; l'auto-référence de note_cellule) ; [] sans clé.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lireSchema } from './schema-doc.mjs';
import { ouvrirBase, trouverRacine } from './donnees.mjs';

/** Une description de table au plus de cette longueur dans la page (le reste est dans data/schema.sql et sur /donnees/). */
export const DESCRIPTION_MAX = 600;

const couper = (texte, max) => (texte.length <= max ? texte : `${texte.slice(0, max - 1).trimEnd()}…`);

/** Clé primaire d'une table, dans l'ordre de ses colonnes de clé. */
function clePrimaire(infos) {
  return infos.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name);
}

/**
 * La structure du schéma, depuis une base ouverte (construite depuis data/schema.sql) et le texte du schéma.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} texteSchema le contenu de data/schema.sql
 * @param {{ compter?: boolean }} options `compter: false` : `lignes` à 0 (base vide, tests)
 */
export function structureDuSchema(db, texteSchema, { compter = true } = {}) {
  const lues = lireSchema(texteSchema);
  const sections = [];
  const tables = [];
  const infosDe = new Map();
  const infos = (nom) => infosDe.get(nom) ?? infosDe.set(nom, db.prepare(`PRAGMA table_info("${nom}")`).all()).get(nom);
  for (const s of lues) {
    const objets = s.objets.filter((o) => o.genre === 'table' || o.genre === 'vue');
    if (!objets.length) continue;
    const m = /^(\d+(?: bis)?)\. (.+)$/.exec(s.titre);
    const numero = m ? m[1] : s.titre;
    sections.push({ numero, titre: m ? m[2] : s.titre });
    for (const o of objets) {
      const colonnesInfo = infos(o.nom);
      // clés étrangères (PRAGMA : une ligne par colonne, groupées par `id`, dans l'ordre `seq`)
      const groupes = new Map();
      if (o.genre === 'table') {
        for (const f of db.prepare(`PRAGMA foreign_key_list("${o.nom}")`).all()) (groupes.get(f.id) ?? groupes.set(f.id, []).get(f.id)).push(f);
      }
      const cles = [...groupes.keys()].sort((a, b) => b - a).map((id) => {
        const g = groupes.get(id).sort((a, b) => a.seq - b.seq);
        const cible = g[0].table;
        const pkCible = g.some((f) => f.to === null) ? clePrimaire(infos(cible)) : [];
        return {
          colonnes: g.map((f) => f.from),
          table: cible,
          vers: g.map((f, i) => f.to ?? pkCible[i] ?? null),
          suppression: g[0].on_delete,
        };
      });
      // PRAGMA foreign_key_list rend les clés de la dernière déclarée à la première : remises dans l'ordre du schéma (id décroissant)
      const fksDe = new Map();
      for (const c of cles) {
        c.colonnes.forEach((col, i) => {
          (fksDe.get(col) ?? fksDe.set(col, []).get(col)).push({ table: c.table, colonne: c.vers[i], colonnes: c.colonnes, vers: c.vers });
        });
      }
      tables.push({
        nom: o.nom,
        section: numero,
        description: couper(o.description, DESCRIPTION_MAX),
        genre: o.genre === 'vue' ? 'vue' : o.derivee ? 'derivee' : 'table',
        colonnes: colonnesInfo.map((c) => ({
          nom: c.name,
          type: c.type ?? '',
          pk: Number(c.pk),
          nonNul: Number(c.notnull) === 1,
          defaut: c.dflt_value ?? null,
          description: o.colonnes.get(c.name) ?? '',
          fk: fksDe.has(c.name) ? { table: fksDe.get(c.name)[0].table, colonne: fksDe.get(c.name)[0].colonne } : null,
          fks: fksDe.get(c.name) ?? [],
        })),
        cles_etrangeres: cles,
        lignes: compter ? Number(db.prepare(`SELECT count(*) AS n FROM "${o.nom}"`).get().n) : 0,
      });
    }
  }
  return { sections, tables };
}

/** La structure de la base du build (lib/donnees.mjs#ouvrirBase : la même que l'explorateur /donnees/). */
export function structureDeLaBase() {
  return structureDuSchema(ouvrirBase(), readFileSync(join(trouverRacine(), 'data', 'schema.sql'), 'utf8'));
}

/**
 * Le JSON posé dans un <script type="application/json"> : « < » échappé, ni « </script> » ni « <!-- » ne peuvent fermer l'élément (le script le lit par
 * JSON.parse, qui rend le caractère).
 */
export function jsonPourLaPage(structure) {
  return JSON.stringify(structure).replace(/</g, '\\u003c');
}
