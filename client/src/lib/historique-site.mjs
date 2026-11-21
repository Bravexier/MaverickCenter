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
//   valeursDAvant(db, 'sort', 'nom')           les noms qu'une ligne a portés avant l'actuel (Map(texte de clé → [noms])) : une fiche écrite avant un
//                                              renommage se relit (lib/fiche-regles.mjs, `noms_d_avant`)
//
// Nature des traces (R275, migration 0127) : seules les traces de nature `saisie` (faites sur le site de dev) et `decision` (une décision du propriétaire
// appliquée par un lot) sont « le site » que ces fonctions défont pour retrouver l'état d'origine. Les natures `source`, `migration` et `code` sont des
// changements du contenu de référence (réimport d'une source, migration, recalcul après un changement de code) : elles font partie de l'import, jamais
// défaites. Un historique sans colonne `nature` (base d'avant la 0127) se lit comme des saisies. `valeursDAvant` lit toutes les natures (un ancien nom
// reste un ancien nom, d'où qu'il vienne). Une annulation porte la nature du lot annulé ; quand elle réécrit une ligne que ce lot n'avait pas écrite (le
// corps d'une page recalculé depuis sa table), cette trace n'est pas du contenu de référence : elle est défaite comme le site (`effetDAnnulation`).
//
// Clé d'une ligne : l'objet des colonnes de clé primaire, dans l'ordre de la clé (comme cleDe de serveur/edition-journal.mjs, qui écrit le journal,
// et comme `cle` des registres des migrations 0005 et 0006). Ordre de lecture : (fait_le, lot_id, rang).
// Sans dépendance (ni node:, ni Astro) : le module reçoit une base node:sqlite ouverte. Utilisé par les tests, par scripts/db-check.mjs et par lib/fiche-regles.mjs (valeursDAvant).

const structures = new WeakMap(); // db -> Map(table -> { colonnes, cle } | null)

/** Colonnes et clé primaire d'une table (null pour une table absente de la base : une table renommée ou supprimée depuis). */
function structureDe(db, table) {
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

/** Les natures d'une trace que le site « défait » pour retrouver l'état d'origine : une saisie, une décision du propriétaire (R275). */
export const NATURES_DEFAITES = Object.freeze(['saisie', 'decision']);

/** `resume` est le titre d'une annulation du lot de titre `titre` (serveur/edition-lots.mjs, `aAnnuler` et `aAnnulerUneLigne`, ce dernier coupé à 300 signes). */
const estAnnulationDe = (resume, titre) => {
  if (resume === `Annulation de « ${titre} »`) return true;
  const debut = `Annulation d’une ligne de « ${titre} » : `;
  return resume.startsWith(debut) || (resume.length === 300 && debut.startsWith(resume));
};

/** Marque `effetDAnnulation` sur les traces d'une annulation (hors saisie et décision) dont la ligne n'a pas été écrite par le dernier lot annulé de ce titre. */
function marquerLesEffetsDAnnulation(traces) {
  const lots = new Map();
  for (const t of traces) {
    if (!lots.has(t.lot)) lots.set(t.lot, { resume: t.resume ?? '', nature: t.nature, decision: t.decision, traces: [] });
    lots.get(t.lot).traces.push(t);
  }
  const precedents = [];
  for (const lot of lots.values()) {
    if (!NATURES_DEFAITES.includes(lot.nature) && lot.resume.startsWith('Annulation d')) {
      const annule = precedents.findLast((p) => p.nature === lot.nature && p.decision === lot.decision && estAnnulationDe(lot.resume, p.resume));
      if (annule) {
        const ecrites = new Set(annule.traces.map((t) => `${t.table} ${t.texte}`));
        for (const t of lot.traces) if (!ecrites.has(`${t.table} ${t.texte}`)) t.effetDAnnulation = true;
      }
    }
    precedents.push(lot);
  }
}

/**
 * Les modifications de historique_modification dans l'ordre (fait_le, lot_id, rang) ; [] pour une base qui n'a pas la table. Chacune porte sa `nature` (une
 * base d'avant la migration 0127, sans cette colonne : `saisie`) et sa `decision` (R…, ou null) ; `effetDAnnulation` (vrai, sinon absent) : voir l'en-tête.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ natures?: readonly string[] | null }} [options] les natures lues : par défaut `NATURES_DEFAITES` et les effets d'annulation (ce que le site
 *   défait) ; `null` : toutes
 */
export function lireHistorique(db, { natures = NATURES_DEFAITES } = {}) {
  const existe = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'historique_modification'").get();
  if (!existe) return [];
  const avecNature = db.prepare('PRAGMA table_info("historique_modification")').all().some((c) => c.name === 'nature');
  const colonnes = avecNature ? 'nature, decision' : "'saisie' AS nature, NULL AS decision";
  const traces = db
    .prepare(`SELECT lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres, ${colonnes} FROM historique_modification ORDER BY fait_le, lot_id, rang`)
    .all()
    .map((m) => {
      const cle = cleDeLigne(db, m.table_nom, JSON.parse(m.cle));
      return {
        lot: m.lot_id, rang: m.rang, faitLe: m.fait_le, resume: m.resume, version: m.version ?? null, table: m.table_nom, nature: m.nature, decision: m.decision ?? null,
        cle, texte: JSON.stringify(cle), operation: m.operation, avant: lireJson(m.avant), apres: lireJson(m.apres),
      };
    });
  marquerLesEffetsDAnnulation(traces);
  return traces.filter((t) => natures === null || natures.includes(t.nature) || (natures === NATURES_DEFAITES && t.effetDAnnulation));
}

/**
 * Les modifications du journal de la base vivante (table `modification`, section 14 de data/schema.sql) pas encore rapatriées dans data/rows
 * (`etat` 'en_attente' : ni intégrées, donc absentes de historique_modification, ni en conflit, donc appliquées), dans l'ordre (fait_le du lot, lot,
 * rang), sous la forme de lireHistorique ; [] pour une base sans journal (data/rows le garde vide).
 */
function lireJournalEnAttente(db) {
  const existe = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'modification'").get();
  if (!existe) return [];
  return db
    .prepare(`SELECT m.lot_id, m.rang, l.fait_le, m.table_nom, m.cle, m.operation, m.avant, m.apres FROM modification m JOIN modification_lot l ON l.id = m.lot_id
              WHERE m.etat = 'en_attente' ORDER BY l.fait_le, m.lot_id, m.rang`)
    .all()
    .map((m) => {
      const cle = cleDeLigne(db, m.table_nom, JSON.parse(m.cle));
      return { lot: m.lot_id, rang: m.rang, faitLe: m.fait_le, table: m.table_nom, cle, texte: JSON.stringify(cle), operation: m.operation, avant: lireJson(m.avant), apres: lireJson(m.apres) };
    });
}

/**
 * Les valeurs qu'une colonne a portées avant sa valeur actuelle, ligne par ligne, d'après historique_modification puis le journal de la base vivante pas
 * encore rapatrié (lireJournalEnAttente : le site de dev lui-même) : Map(texte de la clé (texteDeCle) → [valeurs, de la plus ancienne à la plus
 * récente]), sans doublon, sans null, sans la dernière valeur écrite (l'actuelle). Une ligne que le site n'a jamais renommée n'y est pas. Pour retrouver
 * une ligne par un nom qu'elle a porté : une fiche écrite avant un renommage sur le site de dev (lib/fiche-regles.mjs, `noms_d_avant` ;
 * lib/fiche-tableur-import.mjs). L'identifiant, figé, ne change jamais ; seul le nom se cherche ainsi.
 */
export function valeursDAvant(db, table, colonne) {
  const suites = new Map(); // texte de clé -> valeurs dans l'ordre
  for (const e of [...lireHistorique(db, { natures: null }), ...lireJournalEnAttente(db)]) {
    if (e.table !== table) continue;
    const valeurs = [];
    if (e.operation === 'inserer' && e.apres && colonne in e.apres) valeurs.push(e.apres[colonne]);
    else if (e.operation === 'modifier' && e.apres && colonne in e.apres) valeurs.push(e.avant?.[colonne], e.apres[colonne]);
    if (!valeurs.length) continue;
    if (!suites.has(e.texte)) suites.set(e.texte, []);
    suites.get(e.texte).push(...valeurs);
  }
  const resultat = new Map();
  for (const [texte, valeurs] of suites) {
    const actuelle = valeurs.at(-1);
    const avant = [...new Set(valeurs.filter((v) => v !== null && v !== undefined && v !== actuelle))];
    if (avant.length) resultat.set(texte, avant);
  }
  return resultat;
}

/**
 * L'historique d'une base, prêt à interroger (voir l'en-tête du module). Lu une fois : à refaire si la base change.
 * Seules les traces que le site défait (`NATURES_DEFAITES`) y comptent : une trace `source`, `migration` ou `code` est le contenu de référence.
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
  // Toutes les traces, de toute nature, dans l'ordre. La valeur d'import d'une cellule est l'`avant` de la première trace défaisable (saisie, décision) qui la touche ;
  // si une trace `source`, `migration` ou `code` l'a écrite APRÈS elle, c'est l'`apres` de la dernière de ces traces (le contenu de référence a le dernier mot,
  // comme `defaireLeSite` de test/aide-base-d-import.mjs, qui ne défait pas une cellule que la trace n'a plus laissée). Sans trace défaisable : rien à défaire.
  const parTableToutes = new Map(); // table -> Map(texte de clé -> traces dans l'ordre)
  for (const e of lireHistorique(db, { natures: null })) {
    if (!parTableToutes.has(e.table)) parTableToutes.set(e.table, new Map());
    const lignes = parTableToutes.get(e.table);
    if (!lignes.has(e.texte)) lignes.set(e.texte, []);
    lignes.get(e.texte).push(e);
  }
  const operationsToutes = (table, cle) => parTableToutes.get(table)?.get(texteDeCle(db, table, cle)) ?? [];
  const defaisable = (o) => NATURES_DEFAITES.includes(o.nature) || o.effetDAnnulation === true;
  const touche = (o, colonne) => o.operation === 'supprimer' || (o.operation === 'modifier' && colonne in o.avant);
  /** La valeur d'import d'une colonne (`ops` : toutes les natures) : { trouvee: false } sans trace défaisable qui la touche. */
  const valeurDeLaColonne = (ops, colonne) => {
    const i = ops.findIndex((o) => defaisable(o) && touche(o, colonne));
    if (i < 0) return { trouvee: false };
    let valeur = ops[i].avant[colonne] ?? null;
    for (const o of ops.slice(i + 1)) if (!defaisable(o) && o.operation !== 'supprimer' && o.apres && colonne in o.apres) valeur = o.apres[colonne] ?? null;
    return { trouvee: true, valeur };
  };
  /** La ligne d'avant toute édition, rejouée à l'envers depuis `actuelle` (null : absente) ; null si elle n'existait pas à l'import. `ops` : toutes les natures. */
  const versLImport = (ops, actuelle) => {
    let ligne = actuelle ? { ...actuelle } : null;
    for (let i = ops.length - 1; i >= 0; i -= 1) {
      const o = ops[i];
      if (!defaisable(o)) continue; // source, migration, code : le contenu de référence
      if (o.operation === 'inserer') ligne = null;
      else if (o.operation === 'supprimer') ligne = { ...o.avant };
      else if (ligne) ligne = { ...ligne, ...o.avant }; // absente alors que modifiée : effacée hors du site, rien à reconstruire
    }
    if (ligne) for (const c of Object.keys(ligne)) {
      const v = valeurDeLaColonne(ops, c);
      if (v.trouvee) ligne[c] = v.valeur;
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
    const v = valeurDeLaColonne(operationsToutes(table, cle), colonne);
    if (v.trouvee) return v.valeur;
    if (actuelle !== undefined) return actuelle;
    const ligne = lireActuelle(table, cle);
    return ligne ? ligne[colonne] : undefined;
  };
  /** La ligne entière telle que l'import l'a laissée ; null si le site l'a créée (ou si elle n'existe pas). */
  const ligneDImport = (table, cle) => versLImport(operationsToutes(table, cle), lireActuelle(table, cle));
  /**
   * Les lignes d'avant toute édition du site : `lignes` (par défaut toute la table, SELECT *) dont l'historique est rejoué à l'envers. Les lignes
   * gardent leur ordre ; une ligne supprimée par le site est remise à la fin.
   */
  const lignesDImport = (table, lignes) => {
    const actuelles = lignes ?? (structureDe(db, table) ? db.prepare(`SELECT * FROM "${table}"`).all() : []);
    const historique = parTableToutes.get(table);
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
