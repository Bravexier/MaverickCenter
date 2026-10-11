// Journal des modifications faites depuis le site de dev (section 14 de data/schema.sql : modification_lot, modification ; docs/serveur.md, « Édition »).
// Une modification = une ligne de table touchée (dérivées comprises), avec ses valeurs avant et après ; elle est écrite dans la même transaction que
// la modification elle-même. Ce module ne sait rien des règles du jeu : client/serveur/edition.mjs décide QUOI écrire, ici on l'écrit, on le rejoue
// et on le relit.
//   - ouvrirLot      : écrit des lignes (insérer, modifier, supprimer) en les notant au journal ;
//   - rejouer        : après une livraison qui refait la base vivante, réapplique les modifications en attente sur les nouvelles règles
//                      (celles que les règles contiennent déjà passent « integree », celles que les règles ont changées autrement « conflit ») ;
//   - lignesEnAttente: l'état net des lignes modifiées (ce que les pages statiques doivent montrer à la place de leur contenu construit) ;
//   - journalExporte : le journal à rapatrier dans data/rows (`npm run db:appliquer-edition`).
// Node seulement (node:sqlite), sans dépendance ; partagé par le service et par client/scripts/db-appliquer-edition.mjs.
import { randomUUID } from 'node:crypto';

/** Tables du journal lui-même et des fiches : jamais modifiées par l'édition (les fiches ont leur API). */
export const TABLES_INTERDITES = new Set(['modification_lot', 'modification', 'note_version_brouillon', 'note_version', 'note_version_ligne', 'historique_modification']);

export class ErreurJournal extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurJournal';
  }
}

/**
 * Ordre de rejeu (requêtes sur modification m JOIN modification_lot l) : les lots par instant, puis par identifiant, les modifications d'un lot par
 * rang. `fait_le` est à la seconde (CHECK de la table) : deux lots de la même seconde se départagent par leur identifiant, qui s'ordonne comme
 * leur enregistrement (nouveauLot). Le service (rejouer, lignesEnAttente, journalExporte), db:appliquer-edition (par rejouer) et la mise à jour des
 * règles (scripts/mise-a-jour-regles.mjs) trient ainsi.
 */
export const ORDRE_DE_REJEU = 'l.fait_le, l.id, m.rang';

let dernierLot = { ms: -Infinity, n: 0 };
/**
 * Instant (à la seconde, format des colonnes `*_le`) et identifiant d'un nouveau lot. L'identifiant commence par l'instant à la milliseconde, puis
 * un compteur (lots de la même milliseconde), puis un uuid : « 2026-10-11T09:30:12.345Z-000000-<uuid> ». Trier par (fait_le, id) redonne l'ordre
 * d'enregistrement, même dans une seule seconde (une horloge qui recule n'y change rien : l'instant ne redescend pas).
 * @returns {{ instant: string, id: string }}
 */
export function nouveauLot(date = new Date()) {
  const ms = Math.max(date.getTime(), dernierLot.ms);
  dernierLot = ms === dernierLot.ms ? { ms, n: dernierLot.n + 1 } : { ms, n: 0 };
  const iso = new Date(ms).toISOString();
  return { instant: iso.replace(/\.\d{3}Z$/, 'Z'), id: `${iso}-${String(dernierLot.n).padStart(6, '0')}-${randomUUID()}` };
}

const infos = new WeakMap(); // db -> Map(table -> { colonnes, cle })

/** Colonnes et clé primaire d'une table (refuse une table inconnue : les noms viennent de requêtes). */
export function structure(db, table) {
  let parBase = infos.get(db);
  if (!parBase) infos.set(db, (parBase = new Map()));
  if (parBase.has(table)) return parBase.get(table);
  if (!/^[a-z0-9_]+$/.test(table)) throw new ErreurJournal(`table invalide : ${table}`);
  const lignes = db.prepare(`PRAGMA table_info("${table}")`).all();
  if (!lignes.length) throw new ErreurJournal(`table inconnue : ${table}`);
  const cle = lignes.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);
  const s = { colonnes: lignes.map((c) => c.name), types: Object.fromEntries(lignes.map((c) => [c.name, c.type.toUpperCase()])), cle };
  parBase.set(table, s);
  return s;
}

const guillemets = (c) => `"${c}"`;

/** La clé primaire d'une ligne, colonnes dans l'ordre de la clé : la même ligne donne toujours le même texte JSON. */
export function cleDe(db, table, ligne) {
  const { cle } = structure(db, table);
  const objet = {};
  for (const c of cle) {
    if (ligne[c] === undefined) throw new ErreurJournal(`${table} : clé incomplète (${c} manque)`);
    objet[c] = ligne[c];
  }
  return objet;
}
export const texteDeCle = (db, table, ligne) => JSON.stringify(cleDe(db, table, ligne));

function ouDe(db, table) {
  const { cle } = structure(db, table);
  return cle.map((c) => `${guillemets(c)} = ?`).join(' AND ');
}

/** La ligne de clé donnée, ou null. */
export function lireLigne(db, table, cle) {
  const c = cleDe(db, table, cle);
  return db.prepare(`SELECT * FROM "${table}" WHERE ${ouDe(db, table)}`).get(...Object.values(c)) ?? null;
}

function verifierColonnes(db, table, valeurs) {
  const { colonnes } = structure(db, table);
  for (const c of Object.keys(valeurs)) if (!colonnes.includes(c)) throw new ErreurJournal(`${table} : colonne inconnue « ${c} »`);
}

const egal = (a, b) => (a ?? null) === (b ?? null);
const sous = (ligne, colonnes) => Object.fromEntries(colonnes.map((c) => [c, ligne[c] ?? null]));

function insererBrut(db, table, valeurs) {
  verifierColonnes(db, table, valeurs);
  const cols = Object.keys(valeurs);
  db.prepare(`INSERT INTO "${table}" (${cols.map(guillemets).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => valeurs[c] ?? null));
}
function modifierBrut(db, table, cle, valeurs) {
  verifierColonnes(db, table, valeurs);
  const cols = Object.keys(valeurs);
  if (!cols.length) return;
  const c = cleDe(db, table, cle);
  db.prepare(`UPDATE "${table}" SET ${cols.map((k) => `${guillemets(k)} = ?`).join(', ')} WHERE ${ouDe(db, table)}`)
    .run(...cols.map((k) => valeurs[k] ?? null), ...Object.values(c));
}
function supprimerBrut(db, table, cle) {
  const c = cleDe(db, table, cle);
  db.prepare(`DELETE FROM "${table}" WHERE ${ouDe(db, table)}`).run(...Object.values(c));
}

/**
 * Ouvre un lot : rend de quoi écrire des lignes en les notant au journal. À appeler dans une transaction ouverte par l'appelant (qui l'annule si une
 * écriture échoue) ; `terminer(resume)` complète le lot. Une modification qui ne change rien n'est pas notée.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ id: string, instant: string, pageId?: string | null, auteurId?: string | null }} o
 */
export function ouvrirLot(db, { id, instant, pageId = null, auteurId = null }) {
  db.prepare('INSERT INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, ?, ?, ?)').run(id, instant, auteurId, pageId, '…');
  let rang = 0;
  const noter = db.prepare(
    "INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', NULL, ?)",
  );
  const interdire = (table) => {
    if (TABLES_INTERDITES.has(table)) throw new ErreurJournal(`${table} : table du journal, jamais modifiée par l'édition`);
  };
  const lignes = []; // { table, cle, operation } : ce que le lot a touché, dans l'ordre
  const note = (table, cle, operation, avant, apres, apercu = null) => {
    rang += 1;
    noter.run(id, rang, table, JSON.stringify(cle), operation, avant === null ? null : JSON.stringify(avant), apres === null ? null : JSON.stringify(apres),
      apercu === null ? null : JSON.stringify(apercu));
    lignes.push({ table, cle, operation });
  };
  return {
    lire: (table, cle) => lireLigne(db, table, cle),
    /** Insère une ligne complète ; rend la ligne telle qu'enregistrée. */
    inserer(table, valeurs) {
      interdire(table);
      insererBrut(db, table, valeurs);
      const ligne = lireLigne(db, table, valeurs);
      note(table, cleDe(db, table, ligne), 'inserer', null, ligne);
      return ligne;
    },
    /**
     * Modifie les colonnes données (celles qui changent seulement sont notées) ; rend la ligne modifiée. `apercu` : le HTML d'une page du guide tel que
     * l'éditeur l'a laissé (un élément par morceau de texte du corps), noté avec la modification.
     */
    modifier(table, cle, valeurs, { apercu = null } = {}) {
      interdire(table);
      const avant = lireLigne(db, table, cle);
      if (!avant) throw new ErreurJournal(`${table} ${JSON.stringify(cleDe(db, table, cle))} : ligne introuvable`);
      verifierColonnes(db, table, valeurs);
      const changees = Object.keys(valeurs).filter((c) => !egal(avant[c], valeurs[c]));
      if (!changees.length) return avant;
      if (changees.some((c) => structure(db, table).cle.includes(c))) throw new ErreurJournal(`${table} : la clé primaire d'une ligne ne change pas`);
      modifierBrut(db, table, cle, sous(valeurs, changees));
      note(table, cleDe(db, table, avant), 'modifier', sous(avant, changees), sous(valeurs, changees), apercu);
      return lireLigne(db, table, cle);
    },
    /** Supprime une ligne (rien si elle n'existe pas) ; rend la ligne supprimée ou null. */
    supprimer(table, cle) {
      interdire(table);
      const avant = lireLigne(db, table, cle);
      if (!avant) return null;
      supprimerBrut(db, table, cle);
      note(table, cleDe(db, table, avant), 'supprimer', avant, null);
      return avant;
    },
    lignes,
    get nombre() {
      return rang;
    },
    terminer(resume) {
      db.prepare('UPDATE modification_lot SET resume = ? WHERE id = ?').run(String(resume || 'Modification').slice(0, 500), id);
    },
  };
}

const citeesPar = new WeakMap(); // db -> Map(table visée -> tables qui la citent)
/** Les tables dont une clé étrangère vise `table`. */
export function tablesQuiCitent(db, table) {
  let carte = citeesPar.get(db);
  if (!carte) {
    carte = new Map();
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
      let liens = [];
      try {
        liens = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
      } catch {
        continue; // table virtuelle
      }
      for (const f of liens) {
        if (!carte.has(f.table)) carte.set(f.table, new Set());
        carte.get(f.table).add(name);
      }
    }
    citeesPar.set(db, carte);
  }
  return [...(carte.get(table) ?? [])];
}

/** Compare une ligne de la base aux valeurs notées (colonnes de l'objet seulement). */
const correspond = (ligne, valeurs) => Object.entries(valeurs).every(([c, v]) => egal(ligne[c], v));

/**
 * Rejoue une modification en attente sur la base (règles neuves) : rend 'applique' (réécrite), 'integree' (déjà là), 'derivee' (elle ne note que des
 * colonnes dérivées, voir rejouer) ou un message de conflit. Les colonnes dérivées (`derivee(table, cle, colonne)`) ne sont ni comparées ni écrites.
 * `suivantes` : les modifications en attente plus récentes de la même ligne ({ operation, apres }) ; une colonne qui vaut déjà ce que l'une d'elles y
 * écrit est « déjà là » (règles qui contiennent une partie du journal, ou tout : le site de dev après la livraison de ses propres modifications).
 * Lève une erreur SQLite si l'écriture est refusée (contrainte) : l'appelant en fait un conflit.
 */
function rejouerUne(db, m, derivee, suivantes = []) {
  const cle = JSON.parse(m.cle);
  const avant = m.avant === null ? null : JSON.parse(m.avant);
  const apres = m.apres === null ? null : JSON.parse(m.apres);
  structure(db, m.table_nom); // table disparue : erreur
  const sansDerivees = (valeurs) => Object.fromEntries(Object.entries(valeurs).filter(([c]) => !derivee(m.table_nom, cle, c)));
  const ligne = lireLigne(db, m.table_nom, cle);
  /** La colonne vaut déjà `valeur`, ou ce qu'une modification plus récente de la ligne y écrit. */
  const deja = (c, valeur) => egal(ligne[c], valeur) || suivantes.some((s) => s.apres && c in s.apres && egal(ligne[c], s.apres[c]));
  const supprimeePlusTard = suivantes.some((s) => s.operation === 'supprimer');
  if (m.operation === 'inserer') {
    if (!ligne) {
      if (supprimeePlusTard) return 'integree'; // créée puis supprimée par le journal : rien à rejouer (ses modifications non plus)
      insererBrut(db, m.table_nom, apres);
      return 'applique';
    }
    return Object.entries(sansDerivees(apres)).every(([c, v]) => deja(c, v)) ? 'integree' : 'la ligne existe déjà dans les règles, avec d’autres valeurs';
  }
  if (m.operation === 'supprimer') {
    if (!ligne) return 'integree';
    if (!correspond(ligne, sansDerivees(avant))) return 'la ligne a changé dans les règles depuis sa suppression';
    supprimerBrut(db, m.table_nom, cle);
    return 'applique';
  }
  const voulues = sansDerivees(apres);
  if (!Object.keys(voulues).length) return 'derivee';
  if (!ligne) return supprimeePlusTard ? 'integree' : 'la ligne n’existe plus dans les règles';
  const aEcrire = Object.keys(voulues).filter((c) => !deja(c, voulues[c]));
  if (!aEcrire.length) return 'integree';
  const changees = aEcrire.filter((c) => !egal(ligne[c], avant[c]));
  if (changees.length) return `les règles ont changé ${changees.join(', ')} autrement`;
  modifierBrut(db, m.table_nom, cle, sous(voulues, aEcrire));
  return 'applique';
}

/** Une modification du journal telle que la reçoit `applique` (rejouer) : valeurs décodées. */
const decodee = (m) => ({
  lot: m.lot_id, rang: m.rang, table: m.table_nom, cle: JSON.parse(m.cle), operation: m.operation,
  avant: m.avant === null ? null : JSON.parse(m.avant), apres: m.apres === null ? null : JSON.parse(m.apres),
});

/**
 * Rejoue toutes les modifications en attente, lot par lot dans l'ordre (ORDRE_DE_REJEU), chaque lot d'un bloc : si l'une de ses modifications est en
 * conflit (ou rompt une clé étrangère des tables touchées), le lot entier est annulé et ses modifications en attente passent « conflit ».
 * À appeler dans une transaction (l'appelant valide) ; les clés étrangères peuvent être suspendues (contrôle explicite par lot).
 * Une colonne qui vaut déjà ce qu'une modification en attente plus récente de la même ligne y écrit est « déjà là » : le journal rejoué sur des
 * règles qui en contiennent une partie ou le tout (deux lots qui modifient la même colonne, une ligne créée puis modifiée) n'est pas en conflit.
 *
 * Colonnes dérivées (`derivee(table, cle, colonne)` vrai ; aucune par défaut) : des valeurs que l'édition a calculées depuis d'autres lignes (le corps
 * des pages typées : serveur/edition.mjs#colonneDerivee). Notées comme une valeur figée, elles mettraient en conflit tout lot rejoué sur des règles
 * qui ont changé la page autrement (une autre modification de la même page, une livraison, une création insérée puis modifiée dans le même lot) :
 * elles ne sont ni comparées ni écrites, et l'appelant les refait depuis les lignes rejouées (serveur/edition.mjs#rejouerLeJournal). Une
 * modification qui ne note que des colonnes dérivées suit son lot : « intégrée » quand toutes ses autres modifications le sont, en attente sinon.
 * `applique(m)` est appelée, une fois un lot écrit, pour chacune de ses modifications réappliquées (dérivées comprises), décodée : { lot, rang,
 * table, cle, operation, avant, apres }.
 * @param {{ derivee?: (table: string, cle: object, colonne: string) => boolean, applique?: (m: object) => void }} [options]
 * @returns {{ appliquees: number, integrees: number, conflits: number, lots: number }}
 */
export function rejouer(db, { derivee = () => false, applique = null } = {}) {
  const bilan = { appliquees: 0, integrees: 0, conflits: 0, lots: 0 };
  const enAttente = db
    .prepare(
      `SELECT m.* FROM modification m JOIN modification_lot l ON l.id = m.lot_id
       WHERE m.etat = 'en_attente' ORDER BY ${ORDRE_DE_REJEU}`,
    )
    .all();
  const parLot = new Map();
  const parLigne = new Map(); // ligne (table, clé) -> ses modifications en attente, dans l'ordre : { operation, apres }
  const ligneDe = (m) => `${m.table_nom}\u0000${m.cle}`;
  for (const m of enAttente) {
    if (!parLot.has(m.lot_id)) parLot.set(m.lot_id, []);
    parLot.get(m.lot_id).push(m);
    if (!parLigne.has(ligneDe(m))) parLigne.set(ligneDe(m), []);
    parLigne.get(ligneDe(m)).push({ m, operation: m.operation, apres: m.apres === null ? null : JSON.parse(m.apres) });
  }
  const suivantesDe = (m) => {
    const toutes = parLigne.get(ligneDe(m));
    return toutes.slice(toutes.findIndex((s) => s.m === m) + 1);
  };
  const marquer = db.prepare('UPDATE modification SET etat = ?, detail = ? WHERE lot_id = ? AND rang = ?');
  for (const [lot, modifications] of parLot) {
    bilan.lots += 1;
    db.exec('SAVEPOINT rejeu_lot');
    const resultats = [];
    let conflit = null;
    for (const m of modifications) {
      let r;
      try {
        r = rejouerUne(db, m, derivee, suivantesDe(m));
      } catch (e) {
        r = `écriture refusée : ${e.message}`;
      }
      resultats.push(r);
      if (r !== 'applique' && r !== 'integree' && r !== 'derivee') {
        conflit = `${m.table_nom} ${m.cle} : ${r}`;
        break;
      }
    }
    if (!conflit) {
      // clés étrangères des tables touchées ET des tables qui les citent (une suppression peut rompre une référence ailleurs)
      const tables = new Set();
      for (const m of modifications) {
        tables.add(m.table_nom);
        for (const t of tablesQuiCitent(db, m.table_nom)) tables.add(t);
      }
      for (const t of tables) {
        const rompue = db.prepare(`PRAGMA foreign_key_check("${t}")`).get();
        if (rompue) {
          conflit = `${t} : clé étrangère rompue vers ${rompue.parent}`;
          break;
        }
      }
    }
    if (conflit) {
      db.exec('ROLLBACK TO rejeu_lot');
      db.exec('RELEASE rejeu_lot');
      for (const m of modifications) marquer.run('conflit', `lot ${lot} : ${conflit}`, m.lot_id, m.rang);
      bilan.conflits += modifications.length;
      continue;
    }
    db.exec('RELEASE rejeu_lot');
    const autres = resultats.filter((r) => r !== 'derivee');
    const derivees = autres.some((r) => r !== 'integree') ? 'applique' : 'integree';
    modifications.forEach((m, i) => {
      const r = resultats[i] === 'derivee' ? derivees : resultats[i];
      if (r === 'integree') {
        marquer.run('integree', null, m.lot_id, m.rang);
        bilan.integrees += 1;
      } else {
        bilan.appliquees += 1;
        applique?.(decodee(m));
      }
    });
  }
  return bilan;
}

/**
 * L'état net des lignes que le journal a en attente : une entrée par ligne (table, clé), avec la ligne telle qu'elle est maintenant dans la base
 * (null si elle a été supprimée) et `creee` si elle n'existait pas dans les règles livrées (sa première modification en attente est une insertion).
 * C'est ce que les pages statiques doivent montrer à la place de leur contenu construit. Une page dont le corps a changé a aussi `apercu` : celui de
 * la dernière modification de son corps (null si elle n'en a pas noté : la page ne peut pas montrer son nouveau texte avant la prochaine livraison).
 * @param {{ tables?: string[] }} [filtre]
 */
export function lignesEnAttente(db, { tables } = {}) {
  const vues = new Map();
  const toutes = db
    .prepare(
      `SELECT m.table_nom, m.cle, m.operation, m.apres, m.apercu FROM modification m JOIN modification_lot l ON l.id = m.lot_id
       WHERE m.etat = 'en_attente' ORDER BY ${ORDRE_DE_REJEU}`,
    )
    .all();
  for (const m of toutes) {
    if (tables && !tables.includes(m.table_nom)) continue;
    const k = `${m.table_nom}\u0000${m.cle}`;
    if (!vues.has(k)) vues.set(k, { table: m.table_nom, cle: JSON.parse(m.cle), creee: m.operation === 'inserer' });
    if (m.table_nom === 'page' && m.apres && 'corps_md' in JSON.parse(m.apres)) vues.get(k).apercu = m.apercu === null ? null : JSON.parse(m.apercu);
  }
  return [...vues.values()].map((v) => ({ ...v, ligne: lireLigne(db, v.table, v.cle) }));
}

/** Le journal, lots et modifications, pour le rapatrier dans data/rows (format « maverick-edition/1 »). */
export function journalExporte(db, { etats = ['en_attente'] } = {}) {
  const lots = db.prepare('SELECT * FROM modification_lot l ORDER BY l.fait_le, l.id').all();
  const mods = db.prepare('SELECT * FROM modification ORDER BY lot_id, rang').all();
  const parLot = new Map(lots.map((l) => [l.id, { ...l, modifications: [] }]));
  for (const m of mods) {
    if (!etats.includes(m.etat)) continue;
    parLot.get(m.lot_id).modifications.push({
      rang: m.rang,
      table: m.table_nom,
      cle: JSON.parse(m.cle),
      operation: m.operation,
      avant: m.avant === null ? null : JSON.parse(m.avant),
      apres: m.apres === null ? null : JSON.parse(m.apres),
      etat: m.etat,
      detail: m.detail,
      apercu: m.apercu === null ? null : JSON.parse(m.apercu),
    });
  }
  return { format: 'maverick-edition/1', lots: [...parLot.values()].filter((l) => l.modifications.length) };
}

/**
 * Charge un journal exporté dans une base (outil de rapatriement) : chaque lot et ses modifications, état « en_attente », prêts pour `rejouer`.
 * Un lot déjà présent est ignoré.
 */
export function chargerJournal(db, journal) {
  if (journal?.format !== 'maverick-edition/1') throw new ErreurJournal('journal illisible (format « maverick-edition/1 » attendu)');
  const lot = db.prepare('INSERT OR IGNORE INTO modification_lot (id, fait_le, auteur_id, page_id, resume) VALUES (?, ?, NULL, ?, ?)');
  const mod = db.prepare(
    "INSERT OR IGNORE INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat, detail, apercu) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', NULL, ?)",
  );
  let n = 0;
  for (const l of journal.lots ?? []) {
    lot.run(l.id, l.fait_le, l.page_id ?? null, l.resume);
    for (const m of l.modifications ?? []) {
      mod.run(l.id, m.rang, m.table, JSON.stringify(m.cle), m.operation, m.avant === null ? null : JSON.stringify(m.avant), m.apres === null ? null : JSON.stringify(m.apres),
        m.apercu ? JSON.stringify(m.apercu) : null);
      n += 1;
    }
  }
  return n;
}
