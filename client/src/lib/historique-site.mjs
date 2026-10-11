// Ce que le site de dev a changé dans les règles (table historique_modification, section 15 de data/schema.sql ; docs/serveur.md, « Mise à jour »).
// Le propriétaire a fait du site la source des données qu'il modifie : une modification rapatriée dans data/rows (bouton « Effectuer la mise à jour »,
// scripts/mise-a-jour-regles.mjs, ou à la main, scripts/db-appliquer-edition.mjs) y est gardée, ligne par ligne, avec ses valeurs avant et après.
// Les tests et contrôles qui vérifient l'IMPORT (effectif d'une table, texte cité d'une cellule, fidélité d'une page à son onglet) lisent ici l'état
// d'avant toute édition du site (« pin d'import ») ; l'état courant, libre, se contrôle par des invariants de cohérence.
//
//   const h = historiqueSite(db);
//   h.creee('race', { id })                    ligne insérée par le site (et pas supprimée ensuite)
//   h.supprimee('metier', { id })              ligne importée que le site a supprimée
//   h.modifiee('sort', { id }, 'cout_brut')    colonne réécrite par le site (toute colonne d'une ligne que le site a insérée)
//   h.touchee('race_magie', cle, col?)         créée, supprimée ou modifiée (sur cette colonne)
//   h.valeurDImport('sort', { id }, 'remarque', actuelle?)
//                                              la cellule telle que l'import et les migrations l'ont laissée ; undefined pour une ligne créée par
//                                              le site ; sans historique, la valeur actuelle (lue dans la base si elle n'est pas donnée)
//   h.lignesDImport('classe', lignes?)         les lignes d'avant toute édition : insérées retirées, supprimées remises, valeurs « avant » rétablies
//   h.effectifDImport('capacite')              le nombre de ces lignes
//   h.lignesRemaniees('capacite', ['nature'])  les lignes créées ou supprimées par le site, ou dont il a réécrit ces colonnes
//
// Clé d'une ligne : l'objet des colonnes de clé primaire, dans l'ordre de la clé (comme cleDe de serveur/edition-journal.mjs, qui écrit le journal,
// et comme `cle` des registres des migrations 0005 et 0006). Ordre de lecture : (fait_le, lot_id, rang).
// Sans dépendance (ni node:, ni Astro) : le module reçoit une base node:sqlite ouverte. Utilisé par les tests et par scripts/db-check.mjs.

const structures = new WeakMap(); // db -> Map(table -> { colonnes, cle } | null)

/** Colonnes et clé primaire d'une table (null pour une table absente de la base : une table renommée ou supprimée depuis). */
export function structureDe(db, table) {
  let parBase = structures.get(db);
  if (!parBase) structures.set(db, (parBase = new Map()));
  if (parBase.has(table)) return parBase.get(table);
  let s = null;
  if (/^[a-z0-9_]+$/.test(table)) {
    const lignes = db.prepare(`PRAGMA table_info("${table}")`).all();
    if (lignes.length) {
      const cle = lignes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
      s = { colonnes: lignes.map((c) => c.name), cle: cle.length ? cle : lignes.map((c) => c.name) };
    }
  }
  parBase.set(table, s);
  return s;
}

/** La clé d'une ligne (ou d'un objet qui contient au moins ses colonnes de clé), colonnes dans l'ordre de la clé primaire. */
export function cleDeLigne(db, table, ligne) {
  const s = structureDe(db, table);
  if (!s) return Object.fromEntries(Object.keys(ligne).sort().map((c) => [c, ligne[c]]));
  const objet = {};
  for (const c of s.cle) {
    if (ligne[c] === undefined) throw new Error(`${table} : clé incomplète (${c} manque)`);
    objet[c] = ligne[c];
  }
  return objet;
}

/** Le texte JSON de la clé : la même ligne donne toujours le même texte. */
export const texteDeCle = (db, table, ligne) => JSON.stringify(cleDeLigne(db, table, ligne));

const lireJson = (t) => (t === null || t === undefined ? null : JSON.parse(t));

/** Les modifications de historique_modification dans l'ordre (fait_le, lot_id, rang) ; [] pour une base qui n'a pas la table. */
export function lireHistorique(db) {
  const existe = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'historique_modification'").get();
  if (!existe) return [];
  return db
    .prepare('SELECT lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres FROM historique_modification ORDER BY fait_le, lot_id, rang')
    .all()
    .map((m) => {
      const cle = cleDeLigne(db, m.table_nom, JSON.parse(m.cle));
      return {
        lot: m.lot_id, rang: m.rang, faitLe: m.fait_le, resume: m.resume, version: m.version ?? null, table: m.table_nom,
        cle, texte: JSON.stringify(cle), operation: m.operation, avant: lireJson(m.avant), apres: lireJson(m.apres),
      };
    });
}

/**
 * L'historique d'une base, prêt à interroger (voir l'en-tête du module). Lu une fois : à refaire si la base change.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function historiqueSite(db) {
  const entrees = lireHistorique(db);
  const parTable = new Map(); // table -> Map(texte de clé -> modifications dans l'ordre)
  for (const e of entrees) {
    if (!parTable.has(e.table)) parTable.set(e.table, new Map());
    const lignes = parTable.get(e.table);
    if (!lignes.has(e.texte)) lignes.set(e.texte, []);
    lignes.get(e.texte).push(e);
  }

  /** Les modifications d'une ligne, dans l'ordre. */
  const operations = (table, cle) => parTable.get(table)?.get(texteDeCle(db, table, cle)) ?? [];
  const lireActuelle = (table, cle) => {
    const s = structureDe(db, table);
    if (!s) return null;
    const c = cleDeLigne(db, table, cle);
    return db.prepare(`SELECT * FROM "${table}" WHERE ${s.cle.map((k) => `"${k}" = ?`).join(' AND ')}`).get(...Object.values(c)) ?? null;
  };
  /** La ligne d'avant toute édition, rejouée à l'envers depuis `actuelle` (null : absente) ; null si elle n'existait pas à l'import. */
  const versLImport = (ops, actuelle) => {
    let ligne = actuelle ? { ...actuelle } : null;
    for (let i = ops.length - 1; i >= 0; i -= 1) {
      const o = ops[i];
      if (o.operation === 'inserer') ligne = null;
      else if (o.operation === 'supprimer') ligne = { ...o.avant };
      else if (ligne) ligne = { ...ligne, ...o.avant }; // absente alors que modifiée : effacée hors du site, rien à reconstruire
    }
    return ligne;
  };

  /** Ligne insérée par le site et pas supprimée ensuite. */
  const creee = (table, cle) => {
    const ops = operations(table, cle);
    return ops.length > 0 && ops[0].operation === 'inserer' && ops.at(-1).operation !== 'supprimer';
  };
  /** Ligne importée que le site a supprimée (et pas recréée). */
  const supprimee = (table, cle) => {
    const ops = operations(table, cle);
    return ops.length > 0 && ops[0].operation !== 'inserer' && ops.at(-1).operation === 'supprimer';
  };
  /** La ligne existe et le site a écrit cette colonne (n'importe laquelle sans `colonne`) : modifiée, ou insérée par le site. */
  const modifiee = (table, cle, colonne) => {
    const ops = operations(table, cle);
    if (!ops.length || ops.at(-1).operation === 'supprimer') return false;
    return ops.some((o) => o.operation === 'inserer' || (o.operation === 'modifier' && (colonne === undefined || colonne in o.apres)));
  };
  /** Le site a touché la ligne (insertion, suppression, ou modification de cette colonne). */
  const touchee = (table, cle, colonne) => {
    const ops = operations(table, cle);
    if (colonne === undefined) return ops.length > 0;
    return ops.some((o) => o.operation !== 'modifier' || colonne in o.apres);
  };
  /**
   * La valeur de la cellule telle que l'import (et les migrations) l'ont laissée : `avant` de la première modification qui la touche, sinon la valeur
   * actuelle (`actuelle`, lue dans la base si elle n'est pas donnée) ; undefined pour une ligne que le site a créée.
   */
  const valeurDImport = (table, cle, colonne, actuelle) => {
    const ops = operations(table, cle);
    if (ops.length && ops[0].operation === 'inserer') return undefined;
    const premiere = ops.find((o) => o.operation === 'supprimer' || (o.operation === 'modifier' && colonne in o.avant));
    if (premiere) return premiere.avant[colonne] ?? null;
    if (actuelle !== undefined) return actuelle;
    const ligne = lireActuelle(table, cle);
    return ligne ? ligne[colonne] : undefined;
  };
  /** La ligne entière telle que l'import l'a laissée ; null si le site l'a créée (ou si elle n'existe pas). */
  const ligneDImport = (table, cle) => versLImport(operations(table, cle), lireActuelle(table, cle));
  /**
   * Les lignes d'avant toute édition du site : `lignes` (par défaut toute la table, SELECT *) dont l'historique est rejoué à l'envers. Les lignes
   * gardent leur ordre ; une ligne supprimée par le site est remise à la fin.
   */
  const lignesDImport = (table, lignes) => {
    const actuelles = lignes ?? (structureDe(db, table) ? db.prepare(`SELECT * FROM "${table}"`).all() : []);
    const historique = parTable.get(table);
    if (!historique) return actuelles.map((l) => ({ ...l }));
    const vues = new Set();
    const resultat = [];
    for (const l of actuelles) {
      const texte = texteDeCle(db, table, l);
      vues.add(texte);
      const ops = historique.get(texte);
      if (!ops) {
        resultat.push({ ...l });
        continue;
      }
      const avant = versLImport(ops, l);
      if (avant) resultat.push(avant);
    }
    for (const [texte, ops] of historique) {
      if (vues.has(texte)) continue;
      const avant = versLImport(ops, null);
      if (avant) resultat.push(avant);
    }
    return resultat;
  };
  /** Le nombre de lignes de la table à l'import (count − lignes créées par le site + lignes importées qu'il a supprimées). */
  const effectifDImport = (table) => lignesDImport(table).length;
  /**
   * Les lignes que le site a créées ou supprimées, ou dont il a réécrit l'une de ces `colonnes` (aucune par défaut) : chacune telle que le site l'a
   * vue en dernier (sa clé, puis les valeurs après une insertion ou une modification, avant une suppression). Sert à reconnaître les entités remaniées par le site
   * (une classe dont un don a été ajouté ou retiré), dont les formes de l'import ne valent plus.
   */
  const lignesRemaniees = (table, colonnes = []) =>
    [...(parTable.get(table)?.values() ?? [])]
      .filter((ops) => ops.some((o) => o.operation !== 'modifier' || colonnes.some((c) => c in o.apres)))
      .map((ops) => ops.reduce((l, o) => ({ ...l, ...(o.avant ?? {}), ...(o.apres ?? {}) }), { ...ops[0].cle }));

  return {
    /** Toutes les modifications, dans l'ordre. */
    entrees,
    /** Aucune modification rapatriée. */
    vide: entrees.length === 0,
    operations,
    /** Les tables que le site a touchées. */
    tables: () => [...parTable.keys()],
    /** Les clés des lignes touchées d'une table. */
    lignesTouchees: (table) => [...(parTable.get(table)?.values() ?? [])].map((ops) => ops[0].cle),
    creee,
    supprimee,
    modifiee,
    touchee,
    valeurDImport,
    ligneDImport,
    lignesDImport,
    effectifDImport,
    lignesRemaniees,
  };
}
