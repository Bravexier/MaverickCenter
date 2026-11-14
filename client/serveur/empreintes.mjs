// Les empreintes du contenu d'une base : SHA-256 de chaque table de « contenu » (lib/tables-de-la-base.mjs : règles, notes de version, historique),
// puis une empreinte globale. Le même calcul sert l'extrait pour les sessions de Claude (serveur/extrait.mjs), l'attestation de la production
// (serveur/attestation.mjs) et la comparaison que fait le site de dev (lot 5 du chantier de la base de dev, docs/chantier-base-de-dev.md).
//
// Elle ne dépend ni de l'ordre physique des lignes ni de celui des colonnes ni de la manière dont la base a été écrite (une copie VACUUMée, une base
// reconstruite, un extrait : mêmes empreintes pour le même contenu) :
//   - les lignes sont lues triées par clé primaire (puis par toutes les colonnes : une table sans clé, ou deux lignes de clé égale selon un collationnement,
//     restent ordonnées de façon stable), en comparaison binaire ;
//   - les colonnes sont prises par ordre alphabétique de leur nom, avec leur type, leur NOT NULL et leur rang dans la clé : la structure fait partie de
//     l'empreinte, pas le texte du CREATE TABLE ;
//   - chaque valeur porte son type (NULL, entier, réel, texte, binaire) et sa longueur : « 1 » entier, « 1 » texte et « 1.0 » réel diffèrent.
// Les tables « propres au site » (fiches, journal) et « calculées » (liens, recherche plein texte) n'y entrent jamais ; une table que le classement ne
// connaît pas est listée à part (`nonClassees`) et ne compte pas.
//
// Les noms de table et de colonne viennent de la base elle-même (sqlite_master, PRAGMA table_info), vérifiés avant d'être écrits entre guillemets.
import { createHash } from 'node:crypto';
import { CLASSES_DE_TABLES, classeDeLaTable } from '../src/lib/tables-de-la-base.mjs';

const IDENTIFIANT = /^[A-Za-z0-9_]+$/;
const FORMAT = 'maverick-contenu/1';

/** Un identifiant SQL (table, colonne, base attachée) entre guillemets ; refuse tout ce qui n'est pas [A-Za-z0-9_]. */
export function identifiant(nom) {
  if (typeof nom !== 'string' || !IDENTIFIANT.test(nom)) throw new Error(`identifiant SQL refusé : « ${String(nom).slice(0, 40)} »`);
  return `"${nom}"`;
}

/** Les tables d'une base { nom, classe } (classe null : inconnue du classement), dans l'ordre alphabétique ; les tables virtuelles (FTS5) comprises. */
export function tablesDeLaBase(db, schema = 'main') {
  return db.prepare(`SELECT name FROM ${identifiant(schema)}.sqlite_master WHERE type = 'table' ORDER BY name`).all()
    .map((t) => ({ nom: t.name, classe: classeDeLaTable(t.name) }));
}

/** Les colonnes d'une table (hors colonnes cachées) : { nom, type, notnull, pk } dans l'ordre de la table. */
export function colonnesDeLaTable(db, table, schema = 'main') {
  return db.prepare(`PRAGMA ${identifiant(schema)}.table_info(${identifiant(table)})`).all()
    .map((c) => ({ nom: c.name, type: String(c.type ?? '').toUpperCase(), notnull: c.notnull ? 1 : 0, pk: c.pk }));
}

/** L'empreinte (hex) et le nombre de lignes d'une table, indépendantes de l'ordre des lignes et des colonnes. */
export function empreinteDeLaTable(db, table, schema = 'main') {
  const colonnes = colonnesDeLaTable(db, table, schema).sort((a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0));
  const cle = colonnes.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
  const hachage = createHash('sha256');
  hachage.update(`${FORMAT}\n${colonnes.map((c) => `${c.nom}:${c.type}:${c.notnull}:${c.pk}`).join(',')}\n`);
  let lignes = 0;
  if (colonnes.length) {
    const ordre = [...cle, ...colonnes].map((c) => `${identifiant(c.nom)} COLLATE BINARY`).join(', ');
    const instruction = db.prepare(`SELECT ${colonnes.map((c) => identifiant(c.nom)).join(', ')} FROM ${identifiant(schema)}.${identifiant(table)} ORDER BY ${ordre}`);
    instruction.setReadBigInts(true); // un entier de plus de 53 bits ne perd rien
    for (const ligne of instruction.iterate()) {
      lignes += 1;
      let texte = '';
      for (const c of colonnes) {
        const v = ligne[c.nom];
        if (v === null || v === undefined) texte += 'N';
        else if (typeof v === 'bigint') texte += `I${v};`;
        else if (typeof v === 'number') texte += `R${v};`;
        else if (typeof v === 'string') texte += `T${Buffer.byteLength(v)}:${v}`;
        else {
          hachage.update(texte);
          texte = '';
          hachage.update(`B${v.byteLength}:`);
          hachage.update(v);
        }
      }
      hachage.update(`${texte}\n`);
    }
  }
  return { empreinte: hachage.digest('hex'), lignes };
}

/**
 * Les empreintes du contenu d'une base : { global, tables: { <table>: { empreinte, lignes } }, nonClassees }. `tables` : les tables de contenu que la base
 * porte (une table du classement qui lui manque n'y est pas : l'empreinte globale le dit), par ordre alphabétique ; `nonClassees` : les tables que le
 * classement ne connaît pas (jamais lues). L'empreinte globale est celle des noms des tables et de leurs empreintes.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function empreintesDuContenu(db, { schema = 'main' } = {}) {
  const tables = {};
  const nonClassees = [];
  for (const { nom, classe } of tablesDeLaBase(db, schema)) {
    if (classe === null) nonClassees.push(nom);
    else if (classe === CLASSES_DE_TABLES.CONTENU) tables[nom] = empreinteDeLaTable(db, nom, schema);
  }
  return { global: empreinteGlobale(tables), tables, nonClassees };
}

/** L'empreinte globale d'un ensemble { table: { empreinte } } : indépendante de l'ordre des clés. */
export function empreinteGlobale(tables) {
  const hachage = createHash('sha256').update(`${FORMAT}\n`);
  for (const nom of Object.keys(tables).sort()) hachage.update(`${nom}:${tables[nom].empreinte}\n`);
  return hachage.digest('hex');
}
