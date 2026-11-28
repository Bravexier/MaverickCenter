// L'épreuve d'entrée des lots de changements (lot 6 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/serveur.md,
// « Lots de changements (épreuve) » ; plan : « refaire les migrations 0122 à 0124 sous forme de lots, sur une copie, et retrouver la même base »).
//
//   fabriquer   (UNE fois, scripts/epreuve-des-lots.mjs) compare, table de contenu par table de contenu, la base d'avant et la base d'après d'une migration de
//               données, et écrit la différence en lot `maverick-lot/1` : une opération par ligne, avec la valeur attendue avant ;
//   refaire     sur une copie : la base d'avant est refaite (les lots défaits en SQL direct, sans le service), la migration est rejouée en SQL (la base
//               migrée, la référence), puis chaque lot est déposé, essayé, appliqué PAR LE SERVICE (edition-lots.mjs) ; les deux bases se comparent table par table ;
//               enfin chaque lot est annulé, dans l'ordre inverse, et la base d'avant revient.
//
// Le partage dit où en est le service : une opération passe aujourd'hui par un lot (a), ou elle est refusée (b) : table que le service d'édition ne sait
// pas écrire (le lot reste éteint jusqu'au lot 8), entité qu'il ne sait pas créer ou supprimer. La partie (b) ne s'applique que par l'option de test
// `ouvertHorsEdition` de `controlerLeLot` (la route ne la donne qu'à une base source, db/source : lot 8) : elle prouve que le moteur retrouve la même base une fois ouvert, sans rien ouvrir.
// Le module ne dépend que du service d'édition et de node:sqlite ; ni git, ni réseau : les lots et leur complément sont des fichiers du dépôt.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CLASSES_DE_TABLES, classeDeLaTable, TABLES_DES_NOTES } from '../src/lib/tables-de-la-base.mjs';
import { controlerLeLot, FORMAT_DU_LOT, tablesDeLEdition } from '../src/lib/lot-de-changements.mjs';
import { annuler, appliquer, deposer, lire, previsualiserLAnnulation, refuser, traduire } from './edition-lots.mjs';
import { ErreurEdition } from './edition.mjs';
import { structure } from './edition-journal.mjs';

// ---------------------------------------------------------------------------------------------------------------------------------------------
// La base : lire, comparer
// ---------------------------------------------------------------------------------------------------------------------------------------------

const noms = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((t) => t.name);
const cleDe = (cle, ligne) => JSON.stringify(cle.map((c) => ligne[c]));
const copieDe = (ligne) => ({ ...ligne });

/** Les tables de contenu de la base (le classement de `lib/tables-de-la-base.mjs`), dans l'ordre alphabétique. */
export const tablesDeContenu = (db) => noms(db).filter((t) => classeDeLaTable(t) === CLASSES_DE_TABLES.CONTENU).sort();
/** Les tables calculées de la base (liens, recherche) : recalculées par le build, jamais écrites par un lot. */
export const tablesCalculees = (db) => noms(db).filter((t) => classeDeLaTable(t) === CLASSES_DE_TABLES.CALCULEE && !/_(data|idx|content|docsize|config)$/.test(t)).sort();

/** Les clés étrangères d'une table : { colonne, table (citée), vers (colonne citée) }[]. */
export const clesEtrangeres = (db, table) => db.prepare(`PRAGMA foreign_key_list("${table}")`).all().map((f) => ({ colonne: f.from, table: f.table, vers: f.to }));

/** Les tables parents d'abord (clés étrangères), l'ordre alphabétique départageant ; une table dans un cycle suit son ordre alphabétique. */
export function ordreDesTables(db, tables) {
  const ensemble = new Set(tables);
  const parents = new Map(tables.map((t) => [t, new Set(clesEtrangeres(db, t).map((f) => f.table).filter((p) => p !== t && ensemble.has(p)))]));
  const ordre = [];
  const faites = new Set();
  let reste = [...tables].sort();
  while (reste.length) {
    const pretes = reste.filter((t) => [...parents.get(t)].every((p) => faites.has(p)));
    const choisies = pretes.length ? pretes : [reste[0]];
    for (const t of choisies) {
      ordre.push(t);
      faites.add(t);
    }
    reste = reste.filter((t) => !faites.has(t));
  }
  return ordre;
}

/** Les lignes d'une table, par clé primaire : Map(clé JSON → ligne). `null` : une table sans clé primaire. */
function lignesDe(db, table) {
  const { cle } = structure(db, table);
  if (!cle.length) return null;
  const lignes = new Map();
  for (const l of db.prepare(`SELECT * FROM "${table}"`).iterate()) lignes.set(cleDe(cle, l), copieDe(l));
  return lignes;
}

/**
 * Ce que deux bases (même schéma) ne portent pas pareil, table de contenu par table de contenu : { table: { cle: [colonnes], inserees: [ligne],
 * supprimees: [ligne], modifiees: [{ cle, avant, apres }] } }. `avant` et `apres` d'une modification : les colonnes qui diffèrent seulement. Une table
 * sans clé primaire qui diffère est rendue sous `sans_cle` (un lot ne saurait pas la désigner).
 */
export function differences(avant, apres, { tables = tablesDeContenu(avant) } = {}) {
  const sortie = {};
  const sansCle = [];
  for (const table of tables) {
    const a = lignesDe(avant, table);
    const b = lignesDe(apres, table);
    if (a === null || b === null) {
      const taille = (db) => db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
      const meme = taille(avant) === taille(apres) && JSON.stringify(avant.prepare(`SELECT * FROM "${table}" ORDER BY 1, 2`).all()) === JSON.stringify(apres.prepare(`SELECT * FROM "${table}" ORDER BY 1, 2`).all());
      if (!meme) sansCle.push(table);
      continue;
    }
    const { cle } = structure(avant, table);
    const d = { cle, inserees: [], supprimees: [], modifiees: [] };
    for (const [k, l] of a) {
      const m = b.get(k);
      if (!m) {
        d.supprimees.push(l);
        continue;
      }
      const colonnes = Object.keys(l).filter((c) => !Object.is(l[c], m[c]) && !(l[c] instanceof Uint8Array && Buffer.compare(l[c], m[c]) === 0));
      if (colonnes.length) {
        d.modifiees.push({ cle: Object.fromEntries(cle.map((c) => [c, l[c]])), avant: Object.fromEntries(colonnes.map((c) => [c, l[c]])), apres: Object.fromEntries(colonnes.map((c) => [c, m[c]])) });
      }
    }
    for (const [k, l] of b) if (!a.has(k)) d.inserees.push(l);
    if (d.inserees.length || d.supprimees.length || d.modifiees.length) sortie[table] = d;
  }
  if (sansCle.length) sortie.sans_cle = sansCle;
  return sortie;
}

/**
 * Compare deux bases table de contenu par table de contenu, en entier. `renumeroter` : { table: Map(numéro de la base `b` → numéro de la base `a`) } pour
 * les clés entières que le service a données à l'application (`$numero`) : elles se comparent modulo ce numéro, dans la clé de la table et dans les
 * colonnes qui la citent (clés étrangères). Rend { tables: [{ table, etat: 'egale' | 'differe', ecarts }], egales, differentes }.
 */
export function comparerLesBases(a, b, { renumeroter = {}, tables = tablesDeContenu(a) } = {}) {
  const citeurs = new Map(); // table → colonnes (table de b) qui citent une table renumérotée : [{ colonne, cible }]
  for (const t of tables) {
    const liste = clesEtrangeres(b, t).filter((f) => renumeroter[f.table]);
    for (const [cible, carte] of Object.entries(renumeroter)) {
      if (t === cible && carte) liste.push(...structure(b, t).cle.map((c) => ({ colonne: c, table: cible })));
    }
    if (liste.length) citeurs.set(t, liste);
  }
  const resultat = [];
  for (const table of tables) {
    const la = lignesDe(a, table);
    const lb = lignesDe(b, table);
    if (la === null || lb === null) continue;
    const liste = citeurs.get(table) ?? [];
    const lbRenumerotee = new Map();
    for (const l of lb.values()) {
      const c = copieDe(l);
      for (const f of liste) if (c[f.colonne] !== null && renumeroter[f.table]?.has(c[f.colonne])) c[f.colonne] = renumeroter[f.table].get(c[f.colonne]);
      lbRenumerotee.set(cleDe(structure(b, table).cle, c), c);
    }
    const ecarts = [];
    for (const [k, l] of la) {
      const m = lbRenumerotee.get(k);
      if (!m) ecarts.push({ cle: k, genre: 'absente de la seconde base' });
      else {
        const colonnes = Object.keys(l).filter((c) => !Object.is(l[c], m[c]) && !(l[c] instanceof Uint8Array && Buffer.compare(l[c], m[c]) === 0));
        if (colonnes.length) ecarts.push({ cle: k, genre: 'valeur différente', colonnes });
      }
    }
    for (const k of lbRenumerotee.keys()) if (!la.has(k)) ecarts.push({ cle: k, genre: 'absente de la première base' });
    resultat.push({ table, etat: ecarts.length ? 'differe' : 'egale', ecarts, total: ecarts.length });
  }
  return { tables: resultat, egales: resultat.filter((t) => t.etat === 'egale').length, differentes: resultat.filter((t) => t.etat === 'differe') };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Fabriquer un lot depuis une différence
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Ce que le service retire LUI-MÊME avec une entité qu'il supprime : une page des Règles (edition-plan.mjs#page.supprimer, edition.mjs#supprimerPage) emporte
 * son entrée de menu, ses alias, ses étiquettes, ses sources de page et d'entité, puis la source que plus aucune page ne cite ; un mot-clé
 * (edition-chronologie.mjs#mot_cle.supprimer, edition-mots-cles.mjs#retirerLesFillesDuMotCle) emporte ses catégories, ses synonymes, ses clés quittées et son repère.
 * Une opération de lot qui retire une de ces lignes DOUBLERAIT l'écriture du service (la ligne est déjà partie : 404) : le lot ne la porte pas, elle est
 * rendue à part (`couvertes`, le complément du lot) et l'épreuve vérifie que la base obtenue est la même. table de l'entité → [table, colonne vers l'entité].
 */
export const COUVERT_PAR_L_ENTITE = Object.freeze({
  page: Object.freeze([['regles_onglet_entree', 'page_id'], ['alias', 'page_id'], ['page_tag', 'page_id'], ['page_source', 'page_id'], ['page_entite', 'page_id'],
    ['page_ancienne_adresse', 'page_id']]),
  mot_cle: Object.freeze([['mot_cle_categorie', 'mot_cle_id'], ['mot_cle_synonyme', 'mot_cle_id'], ['mot_cle_ancienne_cle', 'mot_cle_id'],
    ['repere', 'mot_cle_id']]),
});

const estEntiere = (type) => /INT/.test(type ?? '');

/**
 * Le lot (`maverick-lot/1`) d'une différence, et son complément. Ordre des opérations : d'abord les modifications, puis les insertions (parents d'abord),
 * enfin les suppressions (enfants d'abord) : ce que le service refuse ou recalcule à une suppression (une page citée, un mot-clé mentionné) trouve déjà les
 * textes reciblés. Une insertion dont la clé est un entier simple porte un numéro à donner `{ "$numero": "<table>_<numéro de la migration>" }`, repris dans
 * les clés étrangères des insertions qui la citent (le service donne le numéro à l'application : jamais celui de la migration).
 * @param {object} diff `differences(avant, apres)`
 * @param {import('node:sqlite').DatabaseSync} db une base du même schéma (clés, types, clés étrangères)
 * @param {{ titre: string, nature: string, decision?: string, auteur?: string, sansLignes?: object }} meta
 * @returns {{ lot: object, complement: { couvertes: object[], numeros: Record<string, number>, calculees: object } }}
 */
export function lotDeLaDifference(diff, db, { titre, nature, decision, auteur }) {
  const tables = ordreDesTables(db, Object.keys(diff).filter((t) => t !== 'sans_cle'));
  const operations = [];
  const couvertes = [];
  const numeros = {};
  const jetons = new Map(); // table → Map(valeur de la migration → jeton)
  // les lignes que l'entité supprimée emporte avec elle
  const emportees = new Set();
  for (const [entite, filles] of Object.entries(COUVERT_PAR_L_ENTITE)) {
    const supprimees = diff[entite]?.supprimees ?? [];
    if (!supprimees.length) continue;
    const { cle } = structure(db, entite);
    const ids = new Set(supprimees.map((l) => l[cle[0]]));
    const pages = new Set();
    for (const [table, colonne] of filles) {
      for (const l of diff[table]?.supprimees ?? []) {
        if (!ids.has(l[colonne])) continue;
        emportees.add(`${table}\u0000${JSON.stringify(structure(db, table).cle.map((c) => l[c]))}`);
        if (table === 'page_source') pages.add(l.source_id);
      }
    }
    // la source que plus aucune page ne cite part avec ses sources de page
    for (const l of diff.source?.supprimees ?? []) if (pages.has(l.id)) emportees.add(`source\u0000${JSON.stringify([l.id])}`);
  }
  const emportee = (table, ligne) => emportees.has(`${table}\u0000${JSON.stringify(structure(db, table).cle.map((c) => ligne[c]))}`);
  const jetonDe = (table, colonne, valeur) => {
    const cible = clesEtrangeres(db, table).find((f) => f.colonne === colonne);
    return cible && valeur !== null && jetons.get(cible.table)?.get(valeur) ? { $numero: jetons.get(cible.table).get(valeur) } : valeur;
  };
  const cleDe_ = (table, ligne) => Object.fromEntries(structure(db, table).cle.map((c) => [c, ligne[c]]));
  const dansLeLot = (table, ligne, op) => (emportee(table, ligne) ? (couvertes.push({ table, cle: cleDe_(table, ligne), operation: 'supprimer', avant: copieDe(ligne) }), null) : op);

  for (const table of tables) {
    for (const m of diff[table].modifiees) operations.push({ table, cle: m.cle, operation: 'modifier', avant: m.avant, apres: m.apres });
  }
  for (const table of tables) {
    const { cle, types } = structure(db, table);
    for (const l of diff[table].inserees) {
      let k = cleDe_(table, l);
      let ligne = copieDe(l);
      // une clé qui est aussi une clé étrangère (repere.mot_cle_id) n'a pas de numéro à elle : c'est celui de la ligne citée (boucle ci-dessous)
      const cleEtrangere = clesEtrangeres(db, table).some((f) => f.colonne === cle[0]);
      if (cle.length === 1 && estEntiere(types[cle[0]]) && !cleEtrangere) {
        const jeton = `${table}_${l[cle[0]]}`;
        if (!jetons.has(table)) jetons.set(table, new Map());
        jetons.get(table).set(l[cle[0]], jeton);
        numeros[jeton] = l[cle[0]];
        k = { [cle[0]]: { $numero: jeton } };
        ligne[cle[0]] = { $numero: jeton };
      }
      for (const f of clesEtrangeres(db, table)) {
        if (k[f.colonne] !== undefined && typeof k[f.colonne] !== 'object') k[f.colonne] = jetonDe(table, f.colonne, k[f.colonne]);
        if (typeof ligne[f.colonne] !== 'object') ligne[f.colonne] = jetonDe(table, f.colonne, ligne[f.colonne]);
      }
      operations.push({ table, cle: k, operation: 'inserer', apres: ligne });
    }
  }
  // les suppressions : les enfants d'abord ; un mot-clé verrouillé qui mène à une page est retiré AVANT elle (le service refuse de supprimer la page tant qu'il y
  // mène, R221)
  const aSupprimer = [...tables].reverse();
  if (aSupprimer.includes('mot_cle') && aSupprimer.includes('page')) {
    aSupprimer.splice(aSupprimer.indexOf('mot_cle'), 1);
    aSupprimer.splice(aSupprimer.indexOf('page'), 0, 'mot_cle');
  }
  for (const table of aSupprimer) {
    for (const l of diff[table].supprimees) {
      const op = dansLeLot(table, l, { table, cle: cleDe_(table, l), operation: 'supprimer', avant: copieDe(l) });
      if (op) operations.push(op);
    }
  }
  const calculees = {};
  for (const t of tablesCalculees(db)) if (diff[t]) calculees[t] = { inserees: diff[t].inserees.length, supprimees: diff[t].supprimees.length, modifiees: diff[t].modifiees.length };
  return {
    lot: { format: FORMAT_DU_LOT, titre, nature, ...(decision ? { decision } : {}), ...(auteur ? { auteur } : {}), operations },
    complement: { couvertes, numeros, calculees },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le partage : ce qui passe aujourd'hui par un lot, ce qui est refusé
// ---------------------------------------------------------------------------------------------------------------------------------------------

export const RAISONS = Object.freeze({
  HORS_EDITION: 'hors_edition',
  ENTITE_SANS_CREATION: 'entite_sans_creation',
  ENTITE_SANS_SUPPRESSION: 'entite_sans_suppression',
  CLE_COMPOSEE: 'numero_dans_une_cle_composee',
});

/** Le texte de chaque raison, pour le bilan de l'épreuve. */
export const TEXTE_DES_RAISONS = Object.freeze({
  [RAISONS.HORS_EDITION]: 'table que le service d’édition ne sait pas écrire : le lot reste éteint jusqu’au lot 8',
  [RAISONS.ENTITE_SANS_CREATION]: 'entité que le service crée lui-même (identifiant, page, clés recalculées) : un lot ne l’insère pas',
  [RAISONS.ENTITE_SANS_SUPPRESSION]: 'entité que le service ne supprime pas (R159)',
  [RAISONS.CLE_COMPOSEE]: 'numéro à donner dans une clé composée',
});

/**
 * Où en est une opération : `{ passe: true }` (le service l'écrit aujourd'hui) ou `{ passe: false, raison, message }` (refusée). Même jugement que le
 * dépôt (`controlerLeLot`, tables de l'édition) puis que l'essai (`traduire`).
 */
export function jugerUneOperation(o, tablesEdition = tablesDeLEdition()) {
  if (!tablesEdition.has(o.table)) return { passe: false, raison: RAISONS.HORS_EDITION, message: TEXTE_DES_RAISONS[RAISONS.HORS_EDITION] };
  const { refus } = traduire(o);
  if (refus) {
    return { passe: false, raison: o.operation === 'inserer' ? RAISONS.ENTITE_SANS_CREATION : RAISONS.ENTITE_SANS_SUPPRESSION, message: refus };
  }
  return { passe: true };
}

/** Le partage d'un lot : { passent: op[], refusees: { op, raison, message }[], parTable: { table: { passent, refusees: { raison: n } } } }. */
export function partagerLeLot(lot) {
  const edition = tablesDeLEdition();
  const passent = [];
  const refusees = [];
  const parTable = {};
  for (const op of lot.operations) {
    const j = jugerUneOperation(op, edition);
    parTable[op.table] ??= { passent: 0, refusees: {} };
    if (j.passe) {
      passent.push(op);
      parTable[op.table].passent += 1;
    } else {
      refusees.push({ op, raison: j.raison, message: j.message });
      parTable[op.table].refusees[j.raison] = (parTable[op.table].refusees[j.raison] ?? 0) + 1;
    }
  }
  return { passent, refusees, parTable };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Refaire la base d'avant, en SQL direct (jamais par le service)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const guillemets = (c) => `"${c}"`;

/** Les opérations (lot et complément) d'une migration, avec les numéros de la migration à la place des jetons : { table, cle, operation, avant?, apres? }[]. */
export function operationsDeLaMigration(lot, complement) {
  const numero = (v) => (v !== null && typeof v === 'object' && '$numero' in v ? complement.numeros[v.$numero] : v);
  const resoudre = (valeurs) => (valeurs === undefined ? undefined : Object.fromEntries(Object.entries(valeurs).map(([c, v]) => [c, numero(v)])));
  return [...lot.operations, ...complement.couvertes].map((o) => ({ table: o.table, cle: resoudre(o.cle), operation: o.operation, avant: resoudre(o.avant), apres: resoudre(o.apres) }));
}

/**
 * Retire d'une base (clés étrangères suspendues) les lignes qui citent la ligne `cle` de `table`, de proche en proche : ce que des changements POSTÉRIEURS à la
 * migration (une migration suivante, une édition) ont posé sur une ligne que la migration a créée. Rend le nombre de lignes retirées par table.
 */
function retirerLesDependants(db, table, valeurs, retirees) {
  for (const { name: enfant } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    for (const f of clesEtrangeres(db, enfant).filter((x) => x.table === table)) {
      const cible = valeurs[f.vers ?? structure(db, table).cle[0]];
      if (cible === undefined) continue;
      const { cle } = structure(db, enfant);
      for (const l of db.prepare(`SELECT * FROM ${guillemets(enfant)} WHERE ${guillemets(f.colonne)} = ?`).all(cible)) {
        retirerLesDependants(db, enfant, l, retirees);
        if (cle.length) db.prepare(`DELETE FROM ${guillemets(enfant)} WHERE ${cle.map((c) => `${guillemets(c)} = ?`).join(' AND ')}`).run(...cle.map((c) => l[c]));
        else db.prepare(`DELETE FROM ${guillemets(enfant)} WHERE ${guillemets(f.colonne)} = ?`).run(cible);
        retirees[enfant] = (retirees[enfant] ?? 0) + 1;
      }
    }
  }
}

/**
 * Défait une migration dans `db` (écriture directe, clés étrangères suspendues puis contrôlées) : les lignes qu'elle a créées sont retirées (avec ce qu'un
 * changement postérieur a posé sur elles, une saisie du site ou une migration : `retirees`), celles qu'elle a retirées sont remises telles qu'elles étaient, les colonnes qu'elle a changées
 * reprennent leur valeur d'avant. À l'envers de l'ordre des opérations. Rend ce qui a été retiré en plus, par table.
 */
export function defaireLaMigration(db, operations) {
  const retirees = {};
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    for (const o of [...operations].reverse()) {
      const { cle } = structure(db, o.table);
      const ou = cle.map((c) => `${guillemets(c)} = ?`).join(' AND ');
      const valeursDeLaCle = cle.map((c) => o.cle[c]);
      if (o.operation === 'inserer') {
        const ligne = db.prepare(`SELECT * FROM ${guillemets(o.table)} WHERE ${ou}`).get(...valeursDeLaCle);
        if (ligne) retirerLesDependants(db, o.table, ligne, retirees);
        db.prepare(`DELETE FROM ${guillemets(o.table)} WHERE ${ou}`).run(...valeursDeLaCle);
      } else if (o.operation === 'supprimer') {
        const colonnes = Object.keys(o.avant);
        db.prepare(`INSERT INTO ${guillemets(o.table)} (${colonnes.map(guillemets).join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...colonnes.map((c) => o.avant[c]));
      } else {
        const colonnes = Object.keys(o.avant);
        db.prepare(`UPDATE ${guillemets(o.table)} SET ${colonnes.map((c) => `${guillemets(c)} = ?`).join(', ')} WHERE ${ou}`).run(...colonnes.map((c) => o.avant[c]), ...valeursDeLaCle);
      }
    }
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length) throw new Error(`la base d'avant a des clés étrangères rompues (${violations.length}) : ${JSON.stringify(violations.slice(0, 3))}`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  return retirees;
}

/** Rejoue une migration de données (son SQL) dans `db`, comme `db:migrate` : une transaction, clés étrangères suspendues puis contrôlées. */
export function rejouerLaMigration(db, sql) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`BEGIN;\n${sql}`);
  try {
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length) throw new Error(`la migration rompt des clés étrangères (${violations.length}) : ${JSON.stringify(violations.slice(0, 3))}`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

/** Une copie d'une base (VACUUM INTO) dans `chemin`, ouverte avec les clés étrangères contrôlées. */
export function copierLaBase(db, chemin) {
  rmSync(chemin, { force: true });
  db.prepare('VACUUM INTO ?').run(chemin);
  const copie = new DatabaseSync(chemin);
  copie.exec('PRAGMA foreign_keys = ON');
  return copie;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// L'épreuve
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Lit les lots d'un dossier de fixtures : { migrations: [{ numero, lot, complement }] } (`0122.json`… et `complement.json`). */
export function lireLesLots(dossier, numeros) {
  const complement = JSON.parse(readFileSync(join(dossier, 'complement.json'), 'utf8'));
  return numeros.map((numero) => ({ numero, lot: JSON.parse(readFileSync(join(dossier, `${numero}.json`), 'utf8')), complement: complement[numero] }));
}


/** Les verrous de décision que l'essai demande d'ouvrir (le propriétaire les ouvre au clic) : ceux de `verrous_a_ouvrir`. */
const verrousDe = (essai) => essai?.verrous_a_ouvrir ?? [];

/** Ce que l'essai d'une proposition dit, en peu de lignes : verdict, comptes, verrous, refus. */
const bilanDeLEssai = (p) => ({
  verdict: p.verdict,
  comptes: p.essai?.comptes ?? null,
  verrous: verrousDe(p.essai),
  refus: (p.essai?.operations ?? []).filter((o) => o.etat === 'refusee').map((o) => ({ rang: o.rang, table: o.table, message: o.message })),
  refus_de_l_application: p.essai?.refus_de_l_application ?? null,
  problemes_nouveaux: p.essai?.problemes_nouveaux ?? [],
});

/** Les lignes du complément que le service aurait emportées avec l'entité écartée `e` (et elle seule) : ses lignes filles, puis la source que plus aucune page ne cite. */
function couvertesDe(e, couvertes, db) {
  const filles = COUVERT_PAR_L_ENTITE[e.table];
  if (!filles) return [];
  const id = e.cle[structure(db, e.table).cle[0]];
  const siennes = couvertes.filter((c) => filles.some(([table, colonne]) => c.table === table && c.avant[colonne] === id));
  const sources = new Set(siennes.filter((c) => c.table === 'page_source').map((c) => c.avant.source_id));
  return [...siennes, ...couvertes.filter((c) => c.table === 'source' && sources.has(c.avant.id))];
}

const cleTexte = (db, table, cle) => JSON.stringify(structure(db, table).cle.map((c) => cle[c]));

/**
 * Dépose un lot, l'essaie ; ce que le SERVICE refuse (une règle à lui : page protégée, mot-clé qui mène à une page, entité qu'il ne crée pas) est écarté du lot
 * et listé, puis le reste est redéposé, jusqu'à un essai sans refus (au plus quatre tours). Rend { proposition, retenu, ecartees } : `ecartees` = les opérations
 * refusées { table, cle, operation, message }.
 */
async function deposerEnEcartant(db, lot, { dossier, controle = {} }) {
  let retenu = lot;
  const ecartees = [];
  let p = await deposer(() => db, retenu, { enArrierePlan: false, dossier, controle });
  let complet = lire(db, p.id);
  for (let tour = 0; tour < 4 && complet.verdict === 'a_corriger' && (complet.essai?.operations ?? []).some((o) => o.etat === 'refusee'); tour += 1) {
    const refusees = complet.essai.operations.filter((o) => o.etat === 'refusee');
    ecartees.push(...refusees.map((o) => ({ table: o.table, cle: o.cle, operation: o.operation, message: o.message })));
    const rangs = new Set(refusees.map((o) => o.rang));
    refuser(db, p.id);
    retenu = { ...retenu, operations: retenu.operations.filter((_, i) => !rangs.has(i + 1)) };
    p = await deposer(() => db, retenu, { enArrierePlan: false, dossier, controle });
    complet = lire(db, p.id);
  }
  return { proposition: complet, retenu, ecartees };
}

/** Applique une proposition essayée, en ouvrant les verrous que l'essai demande (le clic du propriétaire). */
function appliquerLaProposition(db, p) {
  if (p.verdict !== 'applicable' && p.verdict !== 'verrous') throw new Error(`le lot « ${p.titre} » n’est pas applicable : ${JSON.stringify(bilanDeLEssai(p))}`);
  const verrous = verrousDe(p.essai);
  return { applique: appliquer(db, p.id, { verrous_ouverts: verrous }), verrous };
}

const resumeDeLaComparaison = (c) => ({ tables: c.tables.length, egales: c.egales, differentes: c.differentes.map((d) => ({ table: d.table, total: d.total, ecarts: d.ecarts.slice(0, 5) })) });

/**
 * Refait l'épreuve sur des copies de `chemin` (une base vivante du service : schéma et règles) dans `dossier`.
 *   1. la base d'AVANT : celle de départ, les migrations défaites (en SQL direct, de la dernière à la première) ;
 *   2. la RÉFÉRENCE : cette base, les migrations rejouées en SQL, l'une après l'autre ;
 *   3. le SERVICE : cette base, chaque lot déposé, essayé et appliqué par le service (le lot ouvert aux tables hors édition : `ouvertHorsEdition`) ;
 *      ce que le service refuse malgré cela est écarté et listé (c) ; les deux bases se comparent table par table, modulo les numéros donnés ;
 *   4. la PARTIE (a) : ce que le service accepte aujourd'hui sans rien ouvrir, sur la base migrée jusqu'à la migration précédente ;
 *   5. l'ANNULATION de chaque lot (dans l'ordre inverse), sur une copie de la base juste après lui : la base d'avant lui doit revenir.
 * @param {object} o
 * @param {string} o.chemin la base vivante de départ (jamais modifiée : copiée)
 * @param {string} o.dossier un dossier de travail (copies et essais ; l'appelant le supprime)
 * @param {{ numero: string, lot: object, complement: object }[]} o.migrations dans l'ordre d'application
 * @param {(numero: string) => string} o.sqlDe le SQL de la migration
 * @returns {Promise<object>} le bilan
 */
export async function refaireLEpreuve({ chemin, dossier, migrations, sqlDe }) {
  mkdirSync(dossier, { recursive: true });
  const t0 = performance.now();
  const bilan = { migrations: [], duree_ms: 0 };
  copyFileSync(chemin, join(dossier, 'depart.db'));
  const ouvert = new DatabaseSync(join(dossier, 'depart.db'));
  ouvert.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  bilan.avant = { posterieur_retire: {} };
  for (const m of [...migrations].reverse()) {
    const retirees = defaireLaMigration(ouvert, operationsDeLaMigration(m.lot, m.complement));
    for (const [t, n] of Object.entries(retirees)) bilan.avant.posterieur_retire[t] = (bilan.avant.posterieur_retire[t] ?? 0) + n;
  }
  const tables = tablesDeContenu(ouvert).filter((t) => !TABLES_DES_NOTES.includes(t));
  const avant = copierLaBase(ouvert, join(dossier, 'avant.db'));
  ouvert.close();
  const reference = copierLaBase(avant, join(dossier, 'reference.db'));
  const service = copierLaBase(avant, join(dossier, 'service.db'));
  const essais = join(dossier, 'essais');
  const numerotation = {}; // table → Map(numéro du service → numéro de la migration)
  const attendus = new Set(); // lignes que le service refuse d'écrire (c), et ce qu'il aurait écrit avec elles : table + clé
  const aFermer = [avant, reference, service];
  try {
    for (const m of migrations) {
      const sortie = { migration: m.numero, titre: m.lot.titre, operations: m.lot.operations.length, couvertes: m.complement.couvertes.length };
      const avantLeLot = copierLaBase(service, join(dossier, `service-avant-${m.numero}.db`)); // le point de départ de l'annulation
      const refAvant = copierLaBase(reference, join(dossier, `reference-avant-${m.numero}.db`)); // celui de la partie (a)
      rejouerLaMigration(reference, sqlDe(m.numero));
      const partage = partagerLeLot(m.lot);
      sortie.partage = { passent: partage.passent.length, refusees: partage.refusees.length, par_table: partage.parTable };
      const refusAuDepot = controlerLeLot(m.lot, { structure: (t) => { try { return structure(service, t); } catch { return null; } } });
      sortie.depot_refuse = { valide: refusAuDepot.valide, erreurs: refusAuDepot.erreurs.length };

      // (a) aujourd'hui : ce que le service accepte sans rien ouvrir, sur la base migrée jusqu'à la migration précédente
      try {
        const seule = await deposerEnEcartant(refAvant, { ...m.lot, operations: partage.passent }, { dossier: essais });
        sortie.partie_a = { operations: partage.passent.length, ecartees: seule.ecartees, essai: bilanDeLEssai(seule.proposition) };
        if (seule.retenu.operations.length) {
          const { applique: ecrite } = appliquerLaProposition(refAvant, seule.proposition);
          const touchees = [...new Set([...m.lot.operations, ...m.complement.couvertes].map((o) => o.table))].filter((t) => tables.includes(t));
          const siens = {};
          for (const n of ecrite.bilan?.numeros ?? []) (siens[n.table] ??= new Map()).set(n.numero, m.complement.numeros[n.jeton]);
          const versLaReference = comparerLesBases(reference, refAvant, { tables: touchees, renumeroter: siens });
          sortie.partie_a.tables = Object.fromEntries(touchees.map((t) => [t, versLaReference.tables.find((x) => x.table === t).etat === 'egale' ? 'migrée' : 'différente']));
        }
      } finally {
        refAvant.close();
      }

      // la partie (b) ouverte pour l'épreuve (`ouvertHorsEdition`, jamais par une route) : le lot entier ; ce que le service refuse alors est écarté (c)
      const ouvrirLesTables = { ouvertHorsEdition: true };
      const complet = await deposerEnEcartant(service, m.lot, { dossier: essais, controle: ouvrirLesTables });
      sortie.refusees_une_fois_ouvert = complet.ecartees;
      sortie.lot_ouvert = { operations: complet.retenu.operations.length, essai: bilanDeLEssai(complet.proposition) };
      const { applique, verrous } = appliquerLaProposition(service, complet.proposition);
      sortie.verrous_ouverts = verrous;
      sortie.ecrites = applique.bilan?.ecrites ?? null;
      sortie.changees = applique.bilan?.changees ?? null;
      // les numéros donnés : le service donne le suivant, la migration écrivait les siens ; les deux bases se comparent modulo ces numéros
      const numeros = applique.bilan?.numeros ?? [];
      for (const n of numeros) (numerotation[n.table] ??= new Map()).set(n.numero, m.complement.numeros[n.jeton]);
      sortie.numeros = numeros.map((n) => ({ jeton: n.jeton, table: n.table, migration: m.complement.numeros[n.jeton], service: n.numero }));
      sortie.memes_numeros = sortie.numeros.every((n) => n.migration === n.service);
      // ce que le service n'a pas écrit : les lignes écartées, et ce que son entité aurait emporté avec elles
      for (const e of complet.ecartees) attendus.add(`${e.table}\u0000${cleTexte(service, e.table, e.cle)}`);
      for (const e of complet.ecartees) {
        for (const c of couvertesDe(e, m.complement.couvertes, service)) attendus.add(`${c.table}\u0000${cleTexte(service, c.table, c.cle)}`);
      }
      // le partage, opération par opération : (c) refusée par le service même ouvert, (b) refusée aujourd'hui (table hors édition, entité), (a) le reste
      const enC = new Set(complet.ecartees.map((e) => `${e.table}\u0000${cleTexte(service, e.table, e.cle)}`));
      const repartition = { a: {}, b: {}, c: complet.ecartees.map((e) => ({ table: e.table, cle: e.cle, operation: e.operation, message: e.message })) };
      for (const o of m.lot.operations) {
        const cle = Object.fromEntries(Object.entries(o.cle).map(([k, v]) => [k, v !== null && typeof v === 'object' ? null : v]));
        if (enC.has(`${o.table}\u0000${cleTexte(service, o.table, cle)}`)) continue;
        const j = jugerUneOperation(o);
        if (j.passe) repartition.a[o.table] = (repartition.a[o.table] ?? 0) + 1;
        else (repartition.b[o.table] ??= {})[j.raison] = (repartition.b[o.table][j.raison] ?? 0) + 1;
      }
      sortie.repartition = repartition;
      // 3. la même base ?
      const comparaison = comparerLesBases(reference, service, { renumeroter: numerotation, tables });
      const expliquee = (d, e) => attendus.has(`${d.table}\u0000${e.cle}`);
      const sansExplication = comparaison.differentes.map((d) => ({ ...d, ecarts: d.ecarts.filter((e) => !expliquee(d, e)) })).filter((d) => d.ecarts.length);
      sortie.comparaison = {
        ...resumeDeLaComparaison(comparaison),
        non_expliquees: sansExplication.map((d) => ({ table: d.table, total: d.ecarts.length, ecarts: d.ecarts.slice(0, 5) })),
        expliquees_par_les_refus: comparaison.differentes.map((d) => ({ table: d.table, lignes: d.ecarts.filter((e) => expliquee(d, e)).length })).filter((d) => d.lignes),
      };

      // 5. annuler ce lot, sur la base d'avant lui + ce lot (la base du service juste après lui)
      const apres = copierLaBase(service, join(dossier, `service-apres-${m.numero}.db`));
      try {
        const id = complet.proposition.id;
        try {
          const apercu = await previsualiserLAnnulation(() => apres, id, { enArrierePlan: false, dossier: essais });
          const resultat = annuler(apres, id, { verrous_ouverts: apercu.verrous_a_ouvrir ?? [] });
          const annulation = resultat.bilan?.annulation ?? {};
          const retour = comparerLesBases(avantLeLot, apres, { tables });
          sortie.annulation = { annulee: true, remises: annulation.remises ?? null, gardees: annulation.gardees ?? null, deja: annulation.deja ?? null, verrous: annulation.verrous_ouverts ?? [], base_d_avant: resumeDeLaComparaison(retour) };
        } catch (e) {
          if (!(e instanceof ErreurEdition)) throw e;
          // le service refuse de remettre (une ancre figée qui ne se retire pas, une adresse qui n'existe plus) : le lot reste appliqué
          sortie.annulation = { annulee: false, refus: e.message };
        }
      } finally {
        apres.close();
        avantLeLot.close();
      }
      bilan.migrations.push(sortie);
    }
  } finally {
    for (const db of aFermer) db.close();
    bilan.duree_ms = Math.round(performance.now() - t0);
  }
  return bilan;
}
