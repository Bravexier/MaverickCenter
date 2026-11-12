// Journal des modifications faites depuis le site de dev (section 14 de data/schema.sql : modification_lot, modification ; docs/serveur.md, « Édition »).
// Une modification = une ligne de table touchée (dérivées comprises), avec ses valeurs avant et après ; elle est écrite dans la même transaction que
// la modification elle-même. Ce module ne sait rien des règles du jeu : client/serveur/edition.mjs décide QUOI écrire, ici on l'écrit, on le rejoue
// et on le relit.
//   - ouvrirLot      : écrit des lignes (insérer, modifier, supprimer) en les notant au journal ;
//   - rejouer        : après une livraison qui refait la base vivante, réapplique les modifications en attente sur les nouvelles règles
//                      (celles que les règles contiennent déjà passent « integree », un texte changé ailleurs par les règles se fusionne à trois
//                      voies, celles que les règles ont changées autrement passent « conflit » : lot annulé, ou gardé avec la valeur du site) ;
//   - lignesEnAttente: l'état net des lignes modifiées (ce que les pages statiques doivent montrer à la place de leur contenu construit) ;
//   - journalExporte : le journal à rapatrier dans data/rows (`npm run db:appliquer-edition`).
// Node seulement (node:sqlite), sans dépendance (le format des fiches, src/lib/fiche-format.mjs, est un module pur) ; partagé par le service et par
// client/scripts/db-appliquer-edition.mjs.
import { randomUUID } from 'node:crypto';
import { fusionner } from '../src/lib/fusion-trois-voies.mjs';
import { TABLES_HORS_REGLES } from '../src/lib/tables-de-la-base.mjs';

/**
 * Tables du journal lui-même (section 14), des notes de version (section 15) et des fiches (section 13) : lib/tables-de-la-base.mjs#TABLES_HORS_REGLES,
 * comparées au schéma par test/tables-de-la-base.test.mjs ; jamais modifiées par l'édition. Les fiches ont leur API ; quand une
 * suppression de règle les touche (décision R42), serveur/fiches-retraits.mjs les écrit en SQL direct : rien d'elles ne va au journal ni dans data/rows.
 */
export const TABLES_INTERDITES = new Set(TABLES_HORS_REGLES);

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
/** Modifie des colonnes d'une ligne sans rien noter au journal (colonnes vérifiées : PRAGMA table_info) : la résolution d'un lot en conflit remet ainsi
 * une ligne telle qu'avant son parcours, avant de la refaire par l'éditeur (serveur/edition-conflits.mjs). */
export function modifierSansNoter(db, table, cle, valeurs) {
  modifierBrut(db, table, cle, valeurs);
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
    if (TABLES_INTERDITES.has(table)) throw new ErreurJournal(`${table} : table du journal ou des fiches, jamais modifiée par l'édition`);
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
    /** `entete` : un texte gardé entier en tête du résumé, hors de sa troncature (le marqueur des suppressions forcées, décision R223 (6)). */
    terminer(resume, { entete = '' } = {}) {
      db.prepare('UPDATE modification_lot SET resume = ? WHERE id = ?').run(`${entete}${String(resume || 'Modification').slice(0, 500)}`, id);
    },
  };
}

const citeesPar = new WeakMap(); // db -> Map(table visée -> tables qui la citent)
/** Les tables dont une clé étrangère vise `table`. */
function tablesQuiCitent(db, table) {
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

const cascadesParBase = new WeakMap(); // db -> Map(table visée -> [{ enfant, de: [colonnes], vers: [colonnes], action }])
/**
 * Les clés étrangères ON DELETE CASCADE ou SET NULL qui visent `table` : la table qui cite, ses colonnes, les colonnes visées (la clé primaire si non
 * dites), `action` : 'CASCADE' ou 'SET NULL' (mot_cle.monnaie_id, migration 0113).
 */
function cascadesVers(db, table) {
  let carte = cascadesParBase.get(db);
  if (!carte) {
    carte = new Map();
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
      let liens = [];
      try {
        liens = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
      } catch {
        continue; // table virtuelle
      }
      const parId = new Map();
      for (const f of liens) {
        const action = String(f.on_delete).toUpperCase();
        if (action !== 'CASCADE' && action !== 'SET NULL') continue;
        if (!parId.has(f.id)) parId.set(f.id, { enfant: name, parent: f.table, colonnes: [], action });
        parId.get(f.id).colonnes.push(f);
      }
      for (const { enfant, parent, colonnes, action } of parId.values()) {
        colonnes.sort((a, b) => a.seq - b.seq);
        const vers = colonnes.every((c) => c.to) ? colonnes.map((c) => c.to) : structure(db, parent).cle;
        if (!carte.has(parent)) carte.set(parent, []);
        carte.get(parent).push({ enfant, de: colonnes.map((c) => c.from), vers, action });
      }
    }
    cascadesParBase.set(db, carte);
  }
  return carte.get(table) ?? [];
}

/**
 * Applique les ON DELETE CASCADE et SET NULL du schéma avant de supprimer `ligne` de `table`, quand les clés étrangères sont coupées (PRAGMA
 * foreign_keys = 0 : base vivante refaite par une livraison, mise à jour des règles) : SQLite ne les applique alors pas. CASCADE : la ligne qui cite
 * est retirée (récursif) ; SET NULL : ses colonnes qui citent passent à NULL, la ligne reste (une monnaie supprimée : mot_cle.monnaie_id, migration
 * 0113). Rien n'est noté, comme les actions de SQLite dans la base vivante (les [[liens]] d'une page : lien, lien_candidat, tables dérivées).
 */
function supprimerLesCascades(db, table, ligne) {
  for (const { enfant, de, vers, action } of cascadesVers(db, table)) {
    const valeurs = vers.map((c) => ligne[c]);
    if (valeurs.some((v) => v === null || v === undefined)) continue;
    const ou = de.map((c) => `${guillemets(c)} = ?`).join(' AND ');
    if (action === 'SET NULL') {
      db.prepare(`UPDATE "${enfant}" SET ${de.map((c) => `${guillemets(c)} = NULL`).join(', ')} WHERE ${ou}`).run(...valeurs);
      continue;
    }
    for (const e of db.prepare(`SELECT * FROM "${enfant}" WHERE ${ou}`).all(...valeurs)) supprimerLesCascades(db, enfant, e);
    db.prepare(`DELETE FROM "${enfant}" WHERE ${ou}`).run(...valeurs);
  }
}
const clesCoupees = (db) => Number(Object.values(db.prepare('PRAGMA foreign_keys').get() ?? {})[0] ?? 0) === 0;

/** Compare une ligne de la base aux valeurs notées (colonnes de l'objet seulement). */
const correspond = (ligne, valeurs) => Object.entries(valeurs).every(([c, v]) => egal(ligne[c], v));

/**
 * La ligne `ligne` de `table` est-elle citée par une autre (une clé étrangère d'une table qui la cite) ?
 */
function estCitee(db, table, ligne) {
  for (const enfant of tablesQuiCitent(db, table)) {
    const parId = new Map();
    for (const f of db.prepare(`PRAGMA foreign_key_list("${enfant}")`).all()) {
      if (f.table !== table) continue;
      if (!parId.has(f.id)) parId.set(f.id, { de: [], vers: [] });
      parId.get(f.id).de.push(f.from);
      parId.get(f.id).vers.push(f.to);
    }
    for (const { de, vers: versBrut } of parId.values()) {
      const vers = versBrut.some((c) => c === null) ? structure(db, table).cle : versBrut;
      if (vers.some((c) => ligne[c] === null || ligne[c] === undefined)) continue;
      if (db.prepare(`SELECT 1 FROM "${enfant}" WHERE ${de.map((c) => `${guillemets(c)} = ?`).join(' AND ')}`).get(...vers.map((c) => ligne[c]))) return true;
    }
  }
  return false;
}

/** Les écritures brutes du rejeu (rien n'est noté) : `ecrire` par défaut d'evaluerUne. */
const ECRITURES_BRUTES = Object.freeze({
  inserer: (db, table, valeurs) => insererBrut(db, table, valeurs),
  modifier: (db, table, cle, valeurs) => modifierBrut(db, table, cle, valeurs),
  supprimer: (db, table, cle) => supprimerBrut(db, table, cle),
});

/**
 * Évalue une modification du journal sur la base telle qu'elle est (règles neuves, ou base vivante pour l'examen d'un lot en conflit) et l'écrit si
 * elle passe. Rend { issue, ligne, … } : `ligne` = la ligne trouvée (null si absente), `issue` = 'applique' (réécrite), 'integree' (déjà là), 'derivee'
 * (elle ne note que des colonnes dérivées, voir rejouer), 'fantome' (sa ligne est « fantôme » : créée puis supprimée par le journal, `fantome` vrai,
 * voir rejouer ; rien à écrire, et rien n'est noté : elle est réévaluée à chaque rejeu) ou 'conflit', avec `raison` (le message du rejeu) et `genre` :
 * 'existe_deja' (une insertion dont la ligne existe avec d'autres valeurs), 'suppression' (la ligne a changé depuis sa suppression), 'ligne_supprimee'
 * (une modification d'une ligne qui n'existe plus), 'colonnes' (`colonnes` : celles que les règles ont changées autrement).
 * Les colonnes dérivées (`derivee(table, cle, colonne, m)`) ne sont ni comparées ni écrites. `suivantes` : les modifications en attente plus récentes de la
 * même ligne ({ operation, apres }) ; une colonne qui vaut déjà ce que l'une d'elles y écrit est « déjà là » (règles qui contiennent une partie du
 * journal, ou tout : le site de dev après la livraison de ses propres modifications). `siOrphelines` : tables dont le service ne supprime une ligne que
 * si plus rien ne la cite (le dictionnaire des sources : serveur/edition.mjs#supprimerPage) ; une telle suppression, rejouée alors qu'une ligne la cite
 * encore, n'est pas faite (« integree »).
 * `ecrire` : { inserer(db, table, valeurs, m), modifier(db, table, cle, valeurs, m), supprimer(db, table, cle, m) } (par défaut les écritures brutes du
 * rejeu ; l'examen et la résolution d'un lot en conflit les notent dans un nouveau lot : serveur/edition-conflits.mjs). `partiel` : un conflit de
 * colonnes écrit quand même les autres colonnes à écrire (`ecrites` : leurs noms) — jamais dans le rejeu, où le lot entier est annulé.
 * Fusion à trois voies (lib/fusion-trois-voies.mjs, demande du propriétaire : « je site essaye de faire un merge automatique entre les deux ») : une
 * colonne que les règles ont changée depuis (ni `avant`, ni déjà la valeur voulue) se fusionne — base = `avant`, site = `apres`, code = la valeur en
 * place. `fusionnable(table, colonne)` dit si c'est un texte long (lib/edition-modele.mjs#colonneFusionnable ; aucune par défaut) : sans recouvrement,
 * la valeur fusionnée est écrite (`fusionnees`) ; le site sans changement réel garde la valeur des règles. Une fusion ambiguë (passages qui se
 * recouvrent, valeur courte changée des deux côtés) : avec `garder` (le rejeu de la base vivante du site de dev), la valeur du site est écrite et reste
 * (demande du propriétaire : « la page du site affiche LA MODIFICATION DU SITE ») — pour un texte, la fusion où les passages en conflit prennent le côté
 * du site, les changements du code ailleurs gardés (`siteGagne` ; réponse du propriétaire « Les garder ») —, notée dans `gardees` (colonne → { base,
 * site, code, passages, siteGagne, codeGagne }) ;
 * sans, un conflit « colonnes » comme avant. Une modification écrite rend aussi `valeurs` (ce qui est écrit) et `trouvees` (ce que valait une colonne
 * fusionnée ou gardée : la valeur du code).
 * Lève une erreur SQLite si l'écriture est refusée (contrainte) : l'appelant en fait un conflit.
 */
export function evaluerUne(db, m, derivee, suivantes = [], fantome = false, siOrphelines = new Set(), {
  ecrire = ECRITURES_BRUTES, partiel = false, fusionnable = () => false, garder = false,
} = {}) {
  const cle = JSON.parse(m.cle);
  const avant = m.avant === null ? null : JSON.parse(m.avant);
  const apres = m.apres === null ? null : JSON.parse(m.apres);
  structure(db, m.table_nom); // table disparue : erreur
  const sansDerivees = (valeurs) => Object.fromEntries(Object.entries(valeurs).filter(([c]) => !derivee(m.table_nom, cle, c, m)));
  const ligne = lireLigne(db, m.table_nom, cle);
  const conflit = (genre, raison, autres = {}) => ({ issue: 'conflit', genre, raison, ligne, ...autres });
  /**
   * La colonne vaut déjà `valeur`, ou ce qu'une modification plus récente de la ligne y écrit — sauf si elle vaut encore ce que cette modification a
   * trouvé (`avant`) : elle n'est alors pas faite, et se fait (A → B → A : un lot suivant peut compter sur B, un nom libéré, une date intermédiaire). Les
   * lots déjà livrés ne sont jamais rejoués (historique_modification : base-vivante.mjs, mise-a-jour-regles.mjs, db-appliquer-edition.mjs).
   */
  const encoreAvant = (c) => Boolean(avant && c in avant && egal(ligne[c], avant[c]));
  const deja = (c, valeur) => egal(ligne[c], valeur) || (!encoreAvant(c) && suivantes.some((s) => s.apres && c in s.apres && egal(ligne[c], s.apres[c])));
  // la vie de la ligne finit-elle par une suppression (avant qu'une insertion ne la recrée) ?
  const prochaine = suivantes.find((s) => s.operation === 'inserer' || s.operation === 'supprimer');
  const supprimeePlusTard = prochaine?.operation === 'supprimer';
  if (m.operation === 'inserer') {
    if (!ligne) {
      if (fantome && supprimeePlusTard) return { issue: 'fantome', ligne }; // créée puis supprimée par le journal : rien à rejouer (ses modifications non plus)
      ecrire.inserer(db, m.table_nom, apres, m);
      return { issue: 'applique', ligne };
    }
    return Object.entries(sansDerivees(apres)).every(([c, v]) => deja(c, v)) ? { issue: 'integree', ligne }
      : conflit('existe_deja', 'la ligne existe déjà dans les règles, avec d’autres valeurs');
  }
  if (m.operation === 'supprimer') {
    if (!ligne) return { issue: fantome ? 'fantome' : 'integree', ligne };
    if (!correspond(ligne, sansDerivees(avant))) {
      // supprimée puis recréée par le journal : la ligne des règles est déjà la nouvelle
      const recreee = suivantes.find((s) => s.operation === 'inserer');
      if (recreee && Object.entries(sansDerivees(recreee.apres)).every(([c, v]) => deja(c, v))) return { issue: 'integree', ligne };
      return conflit('suppression', 'la ligne a changé dans les règles depuis sa suppression');
    }
    if (siOrphelines.has(m.table_nom) && estCitee(db, m.table_nom, ligne)) return { issue: 'integree', ligne }; // le service ne l'aurait pas supprimée
    if (clesCoupees(db)) supprimerLesCascades(db, m.table_nom, ligne);
    ecrire.supprimer(db, m.table_nom, cle, m);
    return { issue: 'applique', ligne };
  }
  const voulues = sansDerivees(apres);
  if (!Object.keys(voulues).length) return { issue: 'derivee', ligne };
  if (!ligne) {
    if (!supprimeePlusTard) return conflit('ligne_supprimee', 'la ligne n’existe plus dans les règles');
    return { issue: fantome ? 'fantome' : 'integree', ligne };
  }
  const aEcrire = Object.keys(voulues).filter((c) => !deja(c, voulues[c]));
  if (!aEcrire.length) return { issue: 'integree', ligne };
  const valeurs = {}; // ce qui est écrit, colonne par colonne
  const trouvees = {}; // la valeur des règles d'une colonne fusionnée ou gardée
  const fusionnees = [];
  const gardees = {};
  const changees = [];
  for (const c of aEcrire) {
    if (egal(ligne[c], avant?.[c])) {
      valeurs[c] = voulues[c];
      continue;
    }
    const f = fusionner(avant?.[c], voulues[c], ligne[c], { texte: fusionnable(m.table_nom, c) });
    if (f.issue === 'code' || f.issue === 'identique') continue; // le site n'y change rien de plus : la valeur des règles reste
    if (f.issue === 'site' || f.issue === 'fusionnee') {
      valeurs[c] = f.valeur;
      trouvees[c] = ligne[c];
      if (f.issue === 'fusionnee') fusionnees.push(c);
      continue;
    }
    if (!garder) {
      changees.push(c);
      continue;
    }
    // les passages en conflit côté site, le reste fusionné (les changements du code ailleurs gardés : réponse du propriétaire « Les garder »)
    valeurs[c] = f.siteGagne;
    trouvees[c] = ligne[c];
    gardees[c] = { base: avant?.[c] ?? null, site: voulues[c] ?? null, code: ligne[c] ?? null, passages: f.passages, siteGagne: f.siteGagne, codeGagne: f.codeGagne };
  }
  const ecrites = Object.keys(valeurs);
  if (changees.length) {
    const partielles = partiel ? ecrites : [];
    if (partielles.length) ecrire.modifier(db, m.table_nom, cle, valeurs, m);
    return conflit('colonnes', `les règles ont changé ${changees.join(', ')} autrement`, { colonnes: changees, ecrites: partielles, valeurs, trouvees, fusionnees });
  }
  if (!ecrites.length) return { issue: 'integree', ligne };
  ecrire.modifier(db, m.table_nom, cle, valeurs, m);
  return { issue: 'applique', ligne, ecrites, valeurs, trouvees, fusionnees, ...(Object.keys(gardees).length ? { gardees } : {}) };
}


/** La clé d'une ligne pour les fantômes : « table\u0000clé » (clé en JSON, colonnes triées). */
const cleDeLigne = (table, cle) => `${table}\u0000${JSON.stringify(Object.fromEntries(Object.entries(cle).sort(([a], [b]) => a.localeCompare(b))))}`;
const cleDeFantome = (m) => cleDeLigne(m.table_nom, JSON.parse(m.cle));

/**
 * Les références rompues de la table `table` : `rompue` = la première qui ne vise pas une ligne « fantôme » ({ parent }, null s'il n'y en a pas),
 * `cites` = les fantômes visés (« table\u0000clé »), `lignes` = chaque référence rompue hors fantômes, avec la ligne qui cite ({ table, parent,
 * colonnes, vers, valeurs, cle } : l'examen d'un lot en conflit la rattache à l'une de ses modifications, serveur/edition-conflits.mjs). `fantomes` : Map table → Map clé (cleDeLigne) → les valeurs de ses insertions ; une référence
 * qui vise d'autres colonnes que la clé de sa table parente (capacite(specialite_id, classe_id) → specialite(id, classe_id)) vise le fantôme dont une
 * insertion a ces valeurs.
 */
export function referencesRompues(db, table, fantomes = new Map()) {
  const sortie = { rompue: null, cites: [], lignes: [] };
  if (!db.prepare(`PRAGMA foreign_key_check("${table}")`).get()) return sortie;
  // la clé de la ligne qui cite (rowid pour une table sans clé primaire déclarée) : l'examen d'un lot en conflit y rattache la rupture
  const cleDeLaTable = structure(db, table).cle;
  const cleCitante = cleDeLaTable.length ? cleDeLaTable : ['rowid'];
  const colonneDeCle = (c) => (c === 'rowid' ? 'e.rowid AS "cle__rowid"' : `e.${guillemets(c)} AS "cle__${c}"`);
  const parId = new Map();
  for (const f of db.prepare(`PRAGMA foreign_key_list("${table}")`).all()) {
    if (!parId.has(f.id)) parId.set(f.id, { parent: f.table, de: [], vers: [] });
    parId.get(f.id).de.push(f.from);
    parId.get(f.id).vers.push(f.to);
  }
  for (const { parent, de, vers: versBrut } of parId.values()) {
    const cleParent = structure(db, parent).cle;
    const vers = versBrut.some((c) => c === null) ? cleParent : versBrut;
    const parCle = vers.length === cleParent.length && vers.every((c) => cleParent.includes(c));
    const duParent = fantomes.get(parent);
    const non = de.map((c) => `e.${guillemets(c)} IS NOT NULL`).join(' AND ');
    const egalite = de.map((c, i) => `p.${guillemets(vers[i])} = e.${guillemets(c)}`).join(' AND ');
    const rompues = db.prepare(`SELECT ${de.map((c) => `e.${guillemets(c)}`).join(', ')}, ${cleCitante.map(colonneDeCle).join(', ')} FROM "${table}" e WHERE ${non}
      AND NOT EXISTS (SELECT 1 FROM "${parent}" p WHERE ${egalite})`).all();
    for (const r of rompues) {
      let k = null;
      if (parCle) {
        const cle = cleDeLigne(parent, Object.fromEntries(vers.map((c, i) => [c, r[de[i]]])));
        if (duParent?.has(cle)) k = cle;
      } else {
        for (const [cle, valeurs] of duParent ?? []) {
          if (valeurs.some((v) => vers.every((c, i) => egal(v[c], r[de[i]])))) {
            k = cle;
            break;
          }
        }
      }
      if (k) sortie.cites.push(k);
      else {
        sortie.rompue ??= { parent };
        sortie.lignes.push({ table, parent, colonnes: de, vers, valeurs: de.map((c) => r[c]), cle: Object.fromEntries(cleCitante.map((c) => [c, r[`cle__${c}`]])) });
      }
    }
  }
  return sortie;
}

/**
 * Une modification du journal telle que la reçoit `applique` (rejouer) : valeurs décodées. `r` (l'issue d'evaluerUne) : une colonne fusionnée ou
 * gardée y est dite telle qu'elle a été trouvée (`avant` : la valeur des règles) et écrite (`apres`) — les pages refaites partent de là.
 */
const decodee = (m, r = null) => {
  const d = {
    lot: m.lot_id, rang: m.rang, table: m.table_nom, cle: JSON.parse(m.cle), operation: m.operation,
    avant: m.avant === null ? null : JSON.parse(m.avant), apres: m.apres === null ? null : JSON.parse(m.apres),
  };
  if (m.operation === 'modifier' && r?.trouvees && Object.keys(r.trouvees).length) {
    d.avant = { ...d.avant, ...r.trouvees };
    d.apres = { ...d.apres, ...r.valeurs };
  }
  return d;
};

/**
 * Le repère d'un lot gardé dans la trace d'une modification (`modification.detail`) : la phrase du rejeu, puis, après ce saut de ligne, la reprise du
 * lot en JSON (repriseDuRejeu). Seuls les lots gardés en portent une (le rejeu de la base vivante du site de dev, option `garder`).
 */
export const MARQUE_DE_REPRISE = '\n{"reprise":';

/**
 * La trace d'une modification en conflit (`detail`) lue : { texte (la phrase du rejeu, ce que la page lit), reprise (null, ou ce que le rejeu en a
 * écrit pour un lot gardé : { issue, avant, apres, creees?, gardees?, fusionnees? }) }. `avant` et `apres` sont ceux de la modification telle
 * qu'écrite (sa forme d'aujourd'hui, ses colonnes fusionnées ou gardées à partir de la valeur des règles trouvée) ; `gardees` : colonne → { base,
 * site, code, passages, provenance } (`provenance` : { lot, fait_le } du lot plus ancien du même rejeu qui avait écrit la valeur trouvée, ou null).
 */
export function lireLaTrace(detail) {
  if (typeof detail !== 'string') return { texte: detail ?? null, reprise: null };
  const i = detail.indexOf(MARQUE_DE_REPRISE);
  if (i < 0) return { texte: detail, reprise: null };
  try {
    return { texte: detail.slice(0, i), reprise: JSON.parse(detail.slice(i + 1)).reprise ?? null };
  } catch {
    return { texte: detail.slice(0, i), reprise: null };
  }
}
/** Y a-t-il un lot gardé pas encore résolu ? (une requête sur les lignes en conflit : index modification_etat) */
export function lotGardeEnSuspens(db) {
  return Boolean(db.prepare(`SELECT 1 FROM modification m JOIN modification_lot l ON l.id = m.lot_id
    WHERE m.etat = 'conflit' AND l.resolu_le IS NULL AND instr(m.detail, ?) > 0 LIMIT 1`).get(MARQUE_DE_REPRISE));
}
/** La modification appartient-elle à un lot gardé (sa trace porte la reprise du rejeu) ? */
export const estGardee = (detail) => lireLaTrace(detail).reprise !== null;

/**
 * Défait, dans la base, les lots qui ne partent pas encore : les lots gardés pas encore résolus (ce que le rejeu a écrit, d'après leur reprise) et les
 * lots retenus derrière eux (lotsRetenus), du plus récent au plus ancien. La base revient à ce que le journal exporté y laisserait (la note de version
 * en préparation, serveur/notes-de-version.mjs : réponse du propriétaire « Les retirer »). À appeler dans un savepoint que l'appelant annule, clés
 * étrangères différées. `retenus` : lotsRetenus, s'il est déjà calculé. Rend le nombre de modifications défaites.
 */
export function defaireLesLotsEnSuspens(db, retenus = lotsRetenus(db)) {
  const lignes = db.prepare(`SELECT m.* FROM modification m JOIN modification_lot l ON l.id = m.lot_id
    WHERE (m.etat = 'conflit' AND l.resolu_le IS NULL AND instr(m.detail, ?) > 0) OR m.etat = 'en_attente' ORDER BY ${ORDRE_DE_REJEU}`).all(MARQUE_DE_REPRISE);
  const aDefaire = [];
  for (const m of lignes) {
    if (m.etat === 'conflit') {
      const { reprise } = lireLaTrace(m.detail);
      if (reprise && reprise.issue !== 'integree' && reprise.issue !== 'fantome') aDefaire.push({ m, avant: reprise.avant, apres: reprise.apres });
    } else if (retenus.has(m.lot_id)) {
      aDefaire.push({ m, avant: m.avant === null ? null : JSON.parse(m.avant), apres: m.apres === null ? null : JSON.parse(m.apres) });
    }
  }
  for (const { m, avant, apres } of aDefaire.reverse()) {
    const cle = JSON.parse(m.cle);
    if (m.operation === 'modifier') {
      if (lireLigne(db, m.table_nom, cle) && avant) modifierBrut(db, m.table_nom, cle, sous(avant, Object.keys(apres ?? avant)));
    } else if (m.operation === 'inserer') supprimerBrut(db, m.table_nom, cle);
    else if (avant && !lireLigne(db, m.table_nom, cle)) insererBrut(db, m.table_nom, avant);
  }
  return aDefaire.length;
}

/**
 * Rejoue toutes les modifications en attente, lot par lot dans l'ordre (ORDRE_DE_REJEU), chaque lot d'un bloc : si l'une de ses modifications est en
 * conflit (ou rompt une clé étrangère des tables touchées), le lot entier est annulé et ses modifications en attente passent « conflit ».
 * À appeler dans une transaction (l'appelant valide) ; les clés étrangères peuvent être suspendues (contrôle explicite par lot).
 * Une colonne qui vaut déjà ce qu'une modification en attente plus récente de la même ligne y écrit est « déjà là » : le journal rejoué sur des
 * règles qui en contiennent une partie ou le tout (deux lots qui modifient la même colonne, une ligne créée puis modifiée) n'est pas en conflit.
 *
 * Point fixe : dans un rejeu, un lot en conflit le reste (ni emporté par le journal exporté, ni rejoué par la mise à jour). Le rejeu se fait donc par
 * passes : chaque lot tombé en conflit est écarté, et la passe recommence sans lui — sans ses modifications parmi les « plus récentes » d'une ligne, ni
 * parmi les lignes fantômes —, jusqu'à ce qu'une passe n'en écarte plus. Le résultat est celui des seuls lots qui passent : le rejeu du journal exporté
 * (mise à jour, db:appliquer-edition) le redonne, sans conflit nouveau.
 *
 * Fusion et lots gardés (demande du propriétaire : « les modification apporté sur le site prime sur celle qui peuvent être faites "sous le radar" par
 * le code ») : `fusionnable` (voir evaluerUne) fusionne à trois voies un texte long que les règles ont changé ailleurs. Avec `garder` (le rejeu de la
 * base vivante du site de dev, base-vivante.mjs#transferer) :
 *   - un lot dont le seul souci est une fusion ambiguë (passages qui se recouvrent, valeur courte changée des deux côtés) n'est pas annulé : la valeur
 *     du site est écrite et reste (un texte : ses passages en conflit côté site, le reste fusionné), le lot passe « conflit » (à résoudre sur la page Mise à jour) et chacune de ses modifications garde dans sa trace
 *     (`detail`, MARQUE_DE_REPRISE, lireLaTrace) ce qui a été écrit et la valeur du code, qui n'est plus dans la base ; les lots suivants du même champ
 *     se rejouent sur la valeur du site (plus de cascade) ;
 *   - les lots en conflit pas encore résolus (`modification_lot.resolu_le` NULL) sont rejoués avec les autres : réévalués avec cette règle à chaque
 *     reconstruction, rien ne reste perdu ; un lot résolu ne l'est jamais (sa résolution est un lot à elle) ;
 *   - le bilan compte les modifications d'un lot gardé dans `conflits`, et aussi dans `gardees` (clé présente seulement s'il y en a).
 * Une modification d'un lot qui passe, dont une colonne a été fusionnée, est réécrite au journal : son `avant` devient la valeur des règles trouvée et
 * son `apres` la valeur fusionnée (le journal exporté se rejoue tel quel sur les règles ; la reconstruction suivante fusionne à partir de là ; l'historique
 * garde la valeur des règles comme `avant`).
 * Les autres conflits (ligne supprimée, insertion qui existe déjà, référence rompue, contrainte, forme ancienne…) annulent leur lot comme avant.
 *
 * Lignes « fantômes » : une ligne que le journal crée puis supprime n'est pas insérée (ses modifications non plus) le temps de cette vie, et une
 * référence vers elle n'est pas rompue tant que la ligne existerait (un bloc de la chronologie lié à la page d'un métier créé puis supprimé : la
 * suppression le détache). Rien n'en est noté (« fantome ») : réévaluées à chaque rejeu. À la fin d'une passe, un fantôme qu'une référence cite encore
 * (le lot qui retirait la citation est en conflit ; une clé étrangère qui ne vise pas la clé primaire, comme capacite(specialite_id, classe_id), est
 * comparée aux valeurs de ses insertions) est écarté : la passe recommence avec sa ligne rejouée comme une autre (créée, modifiée, et supprimée
 * seulement si plus rien ne la cite). Aucune référence ne reste rompue vers une ligne absente.
 *
 * Colonnes dérivées (`derivee(table, cle, colonne)` vrai ; aucune par défaut) : des valeurs que l'édition a calculées depuis d'autres lignes (le corps
 * des pages typées : serveur/edition.mjs#colonneDerivee). Notées comme une valeur figée, elles mettraient en conflit tout lot rejoué sur des règles
 * qui ont changé la page autrement (une autre modification de la même page, une livraison, une création insérée puis modifiée dans le même lot) :
 * elles ne sont ni comparées ni écrites, et l'appelant les refait depuis les lignes rejouées (serveur/edition.mjs#rejouerLeJournal). Une
 * modification qui ne note que des colonnes dérivées suit son lot : « intégrée » quand toutes ses autres modifications le sont, en attente sinon.
 * `applique(m)` est appelée, le rejeu fini, pour chaque modification réappliquée (dérivées comprises), décodée : { lot, rang, table, cle, operation,
 * avant, apres }, et pour chaque ligne créée à la demande d'`adapter` ({ …, operation: 'inserer', synthetique: true }).
 * `horsControleParLot` : des tables dont les clés étrangères ne sont pas contrôlées lot par lot. Ce sont les fiches de personnage (section 13), que la
 * base vivante recopie AVANT le rejeu (base-vivante.mjs#transferer) : une fiche peut citer un don, une spécialité ou une classe qu'un lot SUIVANT crée,
 * et le contrôle d'un lot antérieur qui touche la même table (capacite, specialite, classe) la verrait rompue et mettrait ce lot sans rapport en conflit.
 * L'appelant les contrôle toutes après le rejeu complet.
 * `siOrphelines` : voir evaluerUne (serveur/edition.mjs#rejouerLeJournal : ['source']).
 * `adapter()` : fabrique, appelée au début de chaque passe (base dans l'état des règles), d'une fonction qui lit une modification notée sous une forme
 * ancienne dans la forme des règles : elle rend la modification à rejouer à sa place, modifiée ou non, avec au besoin `aCreer` : des lignes
 * ([{ table, valeurs }]) créées juste avant elle si elles manquent — dans son lot, annulées avec lui, jamais notées ni comptées
 * (serveur/edition.mjs#ancienneEcritureDesMotsCles : page_tag d'avant la migration 0043 et son mot-clé), avec `sansEffet` : une écriture que les
 * règles n'ont plus de raison de faire, « intégrée » sans rien écrire ni rompre son lot (serveur/edition.mjs#ancienneEcritureDuGlossaire : avant la
 * migration 0056, l'étiquette d'une page qui cite un mot-clé que le glossaire n'a plus) — ou avec `conflit` : le message d'une forme ancienne qui n'a
 * pas d'équivalent, qui met tout son lot en conflit sans le rejouer (serveur/edition-bestiaire.mjs#ancienneEcritureDesCapacites : avant la migration 0044 ;
 * serveur/edition-armures.mjs#ancienneEcritureDesArmures : une défense ou une amélioration de bouclier saisie en un texte qui ne se lit pas exactement
 * dans les cases d'aujourd'hui, demande du propriétaire du 2026-10-17).
 * `avantLeLot(modifications)` : appelée avant les modifications de chaque lot, sur la base telle que le lot la trouve, avec ses modifications (telles
 * qu'adaptées) ; une erreur met le lot en conflit, son message pour raison (serveur/edition.mjs#motsClesEncoreMentionnes : décision R196).
 * `apresLeLot(modifications, issues)` : appelée après les modifications de chaque lot qui passe, dans son lot (avant le contrôle de ses clés étrangères, annulée
 * avec lui), avec ses modifications (telles qu'adaptées) et leurs issues (`applique`, `integree`, `derivee`, `fantome`, dans le même ordre) ; elle écrit ce que le lot entraîne au-delà de ce qu'il note et rend ces écritures, décodées
 * ({ lot, rang, table, cle, operation, avant, apres, … }), passées à `applique` après celles du lot (serveur/edition.mjs#balisesRetireesParLeLot : les
 * balises d'un mot-clé supprimé ou fusionné, au moment où sa suppression est rejouée) ; une erreur met le lot en conflit.
 * @param {{ derivee?: (table: string, cle: object, colonne: string) => boolean, applique?: (m: object) => void, horsControleParLot?: Iterable<string>, siOrphelines?: Iterable<string>, adapter?: () => (m: object) => object, avantLeLot?: (modifications: object[]) => void, apresLeLot?: (modifications: object[], issues: string[]) => object[], fusionnable?: (table: string, colonne: string) => boolean, garder?: boolean }} [options]
 * @returns {{ appliquees: number, integrees: number, conflits: number, lots: number, gardees?: number }}
 */
export function rejouer(db, options = {}) {
  const ecartes = new Map(); // lots en conflit d'une passe précédente → leur conflit : la passe suivante les marque sans les rejouer
  const exclus = new Set(); // fantômes écartés (« table\u0000clé ») : rejoués comme des lignes ordinaires
  for (;;) {
    db.exec('SAVEPOINT rejeu_complet');
    const passe = rejouerUneFois(db, options, ecartes, exclus);
    const lots = [...passe.conflits].filter(([lot]) => !ecartes.has(lot));
    const fantomes = passe.aExclure.filter((k) => !exclus.has(k));
    if (!lots.length && !fantomes.length) {
      db.exec('RELEASE rejeu_complet');
      for (const m of passe.appliquees) options.applique?.(m);
      return passe.bilan;
    }
    db.exec('ROLLBACK TO rejeu_complet');
    db.exec('RELEASE rejeu_complet');
    for (const [lot, conflit] of lots) ecartes.set(lot, conflit);
    for (const k of fantomes) exclus.add(k);
  }
}

/**
 * Les lignes fantômes des modifications en attente `modifications` (dans l'ordre), hors `exclus` : Map « table\u0000clé » → { valeurs : celles des
 * insertions dont la vie finit par une suppression } (une ligne créée, supprimée puis recréée est fantôme le temps de sa première vie).
 */
function fantomesDe(modifications, exclus) {
  const parLigne = new Map();
  for (const m of modifications) {
    const k = cleDeFantome(m);
    if (exclus.has(k)) continue;
    if (!parLigne.has(k)) parLigne.set(k, { creation: null, valeurs: [] });
    const l = parLigne.get(k);
    if (m.operation === 'inserer') l.creation = m;
    else if (m.operation === 'supprimer' && l.creation) {
      l.valeurs.push(JSON.parse(l.creation.apres));
      l.creation = null;
    }
  }
  return new Map([...parLigne].filter(([, l]) => l.valeurs.length).map(([k, { valeurs }]) => [k, valeurs]));
}

/**
 * Une passe du rejeu (voir rejouer), sans les lots `ecartes` (marqués « conflit », avec leur conflit) : { bilan, appliquees (décodées, pour
 * `applique`), conflits (Map lot → conflit, ceux d'avant compris), aExclure (fantômes encore cités en fin de passe) }.
 */
function rejouerUneFois(db, {
  derivee = () => false, horsControleParLot = [], siOrphelines = [], adapter = null, avantLeLot = null, apresLeLot = null, fusionnable = () => false, garder = false,
} = {}, ecartes = new Map(), exclus = new Set()) {
  const horsControle = new Set(horsControleParLot);
  const orphelines = new Set(siOrphelines);
  const appliquees = [];
  const bilan = { appliquees: 0, integrees: 0, conflits: 0, lots: 0 };
  let gardees = 0;
  const marquer = db.prepare('UPDATE modification SET etat = ?, detail = ? WHERE lot_id = ? AND rang = ?');
  const lireLesValeurs = db.prepare('SELECT avant, apres FROM modification WHERE lot_id = ? AND rang = ?');
  // l'aperçu HTML d'une page du guide décrit le corps que le site avait écrit : une fois ce corps fusionné, il ne décrit plus le texte en place
  const rebaser = db.prepare(`UPDATE modification SET avant = ?, apres = ?, apercu = CASE WHEN ? THEN NULL ELSE apercu END WHERE lot_id = ? AND rang = ?`);
  const conflits = new Map();
  // `garder` : les lots en conflit pas encore résolus sont réévalués avec les autres (la règle de fusion, une livraison qui lève leur conflit)
  const toutes = db
    .prepare(
      `SELECT m.*, l.fait_le AS lot_fait_le FROM modification m JOIN modification_lot l ON l.id = m.lot_id
       WHERE m.etat = 'en_attente'${garder ? " OR (m.etat = 'conflit' AND l.resolu_le IS NULL)" : ''} ORDER BY ${ORDRE_DE_REJEU}`,
    )
    .all();
  const enConflit = new Set(toutes.filter((m) => m.etat === 'conflit').map((m) => `${m.lot_id}\u0000${m.rang}`));
  const lotsEcartes = new Set();
  for (const m of toutes) {
    if (!ecartes.has(m.lot_id)) continue;
    marquer.run('conflit', `lot ${m.lot_id} : ${ecartes.get(m.lot_id)}`, m.lot_id, m.rang);
    bilan.conflits += 1;
    lotsEcartes.add(m.lot_id);
    conflits.set(m.lot_id, ecartes.get(m.lot_id));
  }
  bilan.lots += lotsEcartes.size;
  const adapte = adapter ? adapter() : null;
  const enAttente = toutes.filter((m) => !ecartes.has(m.lot_id)).map((m) => (adapte ? adapte(m) : m));
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
    const lignes = parLigne.get(ligneDe(m));
    return lignes.slice(lignes.findIndex((s) => s.m === m) + 1);
  };
  const fantomes = fantomesDe(enAttente, exclus);
  const fantomesParTable = new Map();
  for (const [k, valeurs] of fantomes) {
    const table = k.slice(0, k.indexOf('\u0000'));
    if (!fantomesParTable.has(table)) fantomesParTable.set(table, new Map());
    fantomesParTable.get(table).set(k, valeurs);
  }
  // le dernier lot de ce rejeu qui a écrit chaque colonne (« table\u0000clé\u0000colonne » → { lot, fait_le }) : la provenance de la valeur qu'un lot
  // gardé trouve (les règles livrées, ou les règles plus un lot plus ancien du site)
  const ecritPar = new Map();
  for (const [lot, modifications] of parLot) {
    bilan.lots += 1;
    db.exec('SAVEPOINT rejeu_lot');
    const resultats = [];
    const creees = []; // lignes créées à la demande de l'adaptateur (`aCreer`)
    const creeesPar = new Map(); // rang → ces lignes, pour la reprise d'un lot gardé
    let entrainees = []; // écritures que le lot entraîne au-delà de ce qu'il note (`apresLeLot`)
    // une forme ancienne sans équivalent (l'adaptateur dit pourquoi) : le lot en conflit avec son explication, avant qu'une autre de ses modifications
    // n'échoue sans rien expliquer
    const signalee = modifications.find((m) => m.conflit);
    let conflit = signalee ? `${signalee.table_nom} ${signalee.cle} : ${signalee.conflit}` : null;
    if (!conflit && avantLeLot) {
      try {
        avantLeLot(modifications);
      } catch (e) {
        conflit = `avant le lot : ${e.message}`;
      }
    }
    for (const m of conflit ? [] : modifications) {
      let r;
      try {
        if (m.sansEffet) r = { issue: 'integree' }; // une écriture que les règles n'ont plus de raison de faire (adaptateur) : rien d'écrit
        else {
          for (const { table, valeurs } of m.aCreer ?? []) {
            const cle = cleDe(db, table, valeurs);
            if (lireLigne(db, table, cle)) continue;
            insererBrut(db, table, valeurs);
            creees.push({ lot: m.lot_id, rang: m.rang, table, cle, operation: 'inserer', avant: null, apres: valeurs, synthetique: true });
            creeesPar.set(m.rang, [...(creeesPar.get(m.rang) ?? []), { table, valeurs }]);
          }
          r = evaluerUne(db, m, derivee, suivantesDe(m), fantomes.has(cleDeFantome(m)), orphelines, { fusionnable, garder });
        }
      } catch (e) {
        r = { issue: 'conflit', raison: `écriture refusée : ${e.message}` };
      }
      resultats.push(r);
      if (r.issue === 'conflit') {
        conflit = `${m.table_nom} ${m.cle} : ${r.raison}`;
        break;
      }
    }
    const issues = resultats.map((r) => r.issue);
    if (!conflit && apresLeLot) {
      try {
        entrainees = apresLeLot(modifications, issues) ?? [];
      } catch (e) {
        conflit = `après le lot : ${e.message}`;
      }
    }
    if (!conflit) {
      // clés étrangères des tables touchées ET des tables qui les citent (une suppression peut rompre une référence ailleurs)
      const tables = new Set();
      for (const m of modifications) {
        if (!horsControle.has(m.table_nom)) tables.add(m.table_nom);
        for (const t of tablesQuiCitent(db, m.table_nom)) if (!horsControle.has(t)) tables.add(t);
      }
      for (const t of tables) {
        const { rompue } = referencesRompues(db, t, fantomesParTable);
        if (rompue) {
          conflit = `${t} : clé étrangère rompue vers ${rompue.parent}`;
          break;
        }
      }
    }
    if (conflit) {
      db.exec('ROLLBACK TO rejeu_lot');
      db.exec('RELEASE rejeu_lot');
      conflits.set(lot, conflit);
      for (const m of modifications) marquer.run('conflit', `lot ${lot} : ${conflit}`, m.lot_id, m.rang);
      bilan.conflits += modifications.length;
      continue;
    }
    db.exec('RELEASE rejeu_lot');
    const autres = issues.filter((r) => r !== 'derivee');
    const derivees = autres.some((r) => r !== 'integree' && r !== 'fantome') ? 'applique' : 'integree';
    appliquees.push(...creees);
    // un lot gardé (une fusion ambiguë, la valeur du site écrite) : appliqué, mais « conflit » jusqu'à sa résolution, sa reprise dans sa trace
    const garde = modifications.findIndex((_m, i) => resultats[i].gardees);
    const phrase = garde < 0 ? null
      : `lot ${lot} : ${modifications[garde].table_nom} ${modifications[garde].cle} : les règles ont changé ${Object.keys(resultats[garde].gardees).join(', ')} autrement, la valeur du site reste en place`;
    modifications.forEach((m, i) => {
      const r = resultats[i];
      const issue = r.issue === 'derivee' ? derivees : r.issue;
      const cle = JSON.parse(m.cle);
      if (r.gardees) {
        for (const [c, g] of Object.entries(r.gardees)) g.provenance = ecritPar.get(`${m.table_nom}\u0000${m.cle}\u0000${c}`) ?? null;
      }
      if (phrase) {
        marquer.run('conflit', `${phrase}${MARQUE_DE_REPRISE.slice(0, 1)}${JSON.stringify({ reprise: repriseDuRejeu(m, r, issue, creeesPar.get(m.rang), derivee) })}`, m.lot_id, m.rang);
        bilan.conflits += 1;
        gardees += 1;
        if (issue !== 'integree' && issue !== 'fantome') appliquees.push(decodee(m, r));
      } else if (issue === 'integree') {
        marquer.run('integree', null, m.lot_id, m.rang);
        bilan.integrees += 1;
      } else {
        // un lot en conflit d'une reconstruction précédente qui passe aujourd'hui : de nouveau en attente
        if (enConflit.has(`${m.lot_id}\u0000${m.rang}`)) marquer.run('en_attente', null, m.lot_id, m.rang);
        // une colonne fusionnée : la modification part désormais de la valeur des règles et écrit la valeur fusionnée (le journal exporté se rejoue
        // sans refaire la fusion, et l'historique garde la valeur des règles comme `avant` : lib/historique-site.mjs)
        if (issue === 'applique' && m.operation === 'modifier' && Object.keys(r.trouvees ?? {}).length) {
          const notee = lireLesValeurs.get(m.lot_id, m.rang);
          const avant = { ...JSON.parse(notee.avant) };
          const apres = { ...JSON.parse(notee.apres) };
          for (const c of Object.keys(r.trouvees)) {
            avant[c] = r.trouvees[c];
            apres[c] = r.valeurs[c];
          }
          rebaser.run(JSON.stringify(avant), JSON.stringify(apres), m.table_nom === 'page' && 'corps_md' in r.trouvees ? 1 : 0, m.lot_id, m.rang);
        }
        if (issue === 'fantome') bilan.integrees += 1; // rien à écrire, rien de noté : réévaluée au prochain rejeu
        else {
          bilan.appliquees += 1;
          appliquees.push(decodee(m, r));
        }
      }
      if (issue === 'applique' && m.operation === 'modifier') {
        for (const c of r.ecrites ?? []) ecritPar.set(`${m.table_nom}\u0000${m.cle}\u0000${c}`, { lot: m.lot_id, fait_le: m.lot_fait_le ?? null });
      } else if (issue === 'applique') {
        const valeurs = m.operation === 'inserer' ? JSON.parse(m.apres) : {};
        for (const k of [...ecritPar.keys()]) if (k.startsWith(`${m.table_nom}\u0000${m.cle}\u0000`)) ecritPar.delete(k);
        for (const c of Object.keys(valeurs)) if (!(c in cle)) ecritPar.set(`${m.table_nom}\u0000${m.cle}\u0000${c}`, { lot: m.lot_id, fait_le: m.lot_fait_le ?? null });
      }
    });
    appliquees.push(...entrainees);
  }
  if (gardees) bilan.gardees = gardees;
  // fin de passe : un fantôme qu'une référence cite encore est écarté (rejoué comme une ligne ordinaire à la passe suivante)
  const aExclure = new Set();
  const aVerifier = new Set();
  for (const t of fantomesParTable.keys()) for (const c of [t, ...tablesQuiCitent(db, t)]) if (!horsControle.has(c)) aVerifier.add(c);
  for (const c of aVerifier) for (const k of referencesRompues(db, c, fantomesParTable).cites) aExclure.add(k);
  return { bilan, appliquees, conflits, aExclure: [...aExclure] };
}

/**
 * Ce que le rejeu a écrit pour une modification d'un lot gardé, gardé dans sa trace (lireLaTrace) : la résolution en refait un lot du journal qui se
 * rejoue à sa place, sur les règles qui portent la valeur du code (serveur/edition-conflits.mjs). `issue` ; `avant`, `apres` : la modification telle
 * qu'adaptée, une colonne fusionnée ou gardée partant de la valeur trouvée (une colonne déjà là n'y est plus, une colonne dérivée y reste telle que
 * notée) ; `creees` : les lignes que l'adaptateur a créées juste avant elle ; `gardees`, `fusionnees` : celles d'evaluerUne.
 */
function repriseDuRejeu(m, r, issue, creees, derivee) {
  const d = decodee(m);
  const reprise = { issue, avant: d.avant, apres: d.apres };
  if (m.operation === 'modifier' && issue === 'applique') {
    const derivees = Object.keys(d.apres ?? {}).filter((c) => !(c in (r.valeurs ?? {})) && derivee(m.table_nom, d.cle, c, m));
    const colonnes = [...Object.keys(r.valeurs ?? {}), ...derivees];
    reprise.avant = Object.fromEntries(colonnes.map((c) => [c, c in (r.trouvees ?? {}) ? r.trouvees[c] : d.avant?.[c] ?? null]));
    reprise.apres = Object.fromEntries(colonnes.map((c) => [c, c in (r.valeurs ?? {}) ? r.valeurs[c] : d.apres[c]]));
  }
  if (creees?.length) reprise.creees = creees;
  if (r.gardees) reprise.gardees = r.gardees;
  if (r.fusionnees?.length) reprise.fusionnees = r.fusionnees;
  return reprise;
}

/**
 * Parcourt les modifications d'UN lot (examen et résolution d'un lot en conflit : serveur/edition-conflits.mjs), dans l'ordre de leur rang, sans
 * s'arrêter au premier conflit : chaque modification est adaptée (`adapte` : la fonction que rend l'`adapter` de rejouer), évaluée (evaluerUne,
 * `partiel` : les colonnes d'une modification qui ne sont pas en conflit sont écrites) et écrite par `ecrire` si elle passe ; `creer(table, valeurs, m)`
 * crée les lignes `aCreer` de l'adaptateur qui manquent. Les modifications plus récentes de la même ligne et les lignes fantômes sont celles du lot.
 * `sauter` : les rangs à laisser de côté (une modification abandonnée). `fusionnable` : celle d'evaluerUne (un texte long fusionné à trois voies ; une
 * fusion ambiguë reste un conflit « colonnes », jamais gardée). À appeler dans une transaction ou un savepoint (l'appelant valide ou annule).
 * Rend, par modification : { m (adaptée), rang, table, cle, operation, avant, apres, apercu, issue, ligne, genre?, raison?, colonnes?, ecrites? } —
 * issue 'saute', 'applique', 'integree', 'derivee', 'fantome' ou 'conflit' (genre : ceux d'evaluerUne, ou 'sans_valeur' : une forme ancienne sans
 * équivalent, `raison` de l'adaptateur, ou une écriture refusée).
 * @param {{ derivee?: Function, siOrphelines?: Iterable<string>, adapte?: ((m: object) => object) | null, ecrire: object, creer: Function, sauter?: Set<number> }} o
 */
export function parcourirUnLot(db, modifications, { derivee = () => false, siOrphelines = [], adapte = null, ecrire, creer, sauter = new Set(), fusionnable = () => false }) {
  const orphelines = new Set(siOrphelines);
  const adaptees = modifications.map((m) => (adapte ? adapte(m) : m));
  const parLigne = new Map();
  const ligneDe = (m) => `${m.table_nom}\u0000${m.cle}`;
  for (const m of adaptees) {
    if (!parLigne.has(ligneDe(m))) parLigne.set(ligneDe(m), []);
    parLigne.get(ligneDe(m)).push({ m, operation: m.operation, apres: m.apres === null ? null : JSON.parse(m.apres) });
  }
  const suivantesDe = (m) => {
    const lignes = parLigne.get(ligneDe(m));
    return lignes.slice(lignes.findIndex((x) => x.m === m) + 1);
  };
  const fantomes = fantomesDe(adaptees, new Set());
  return adaptees.map((m) => {
    const entree = { ...decodee(m), m, apercu: m.apercu ? JSON.parse(m.apercu) : null };
    if (sauter.has(m.rang)) return { ...entree, issue: 'saute', ligne: null };
    if (m.conflit) return { ...entree, issue: 'conflit', genre: 'sans_valeur', raison: m.conflit, ligne: lireLigneOuNull(db, m) };
    if (m.sansEffet) return { ...entree, issue: 'integree', ligne: lireLigneOuNull(db, m) };
    try {
      for (const { table, valeurs } of m.aCreer ?? []) if (!lireLigne(db, table, cleDe(db, table, valeurs))) creer(table, valeurs, m);
      return { ...entree, ...evaluerUne(db, m, derivee, suivantesDe(m), fantomes.has(cleDeFantome(m)), orphelines, { ecrire, partiel: true, fusionnable }) };
    } catch (e) {
      return { ...entree, issue: 'conflit', genre: 'sans_valeur', raison: `écriture refusée : ${e.message}`, ligne: lireLigneOuNull(db, m) };
    }
  });
}

function lireLigneOuNull(db, m) {
  try {
    return lireLigne(db, m.table_nom, JSON.parse(m.cle));
  } catch {
    return null; // table disparue
  }
}

/**
 * Les références rompues après le parcours d'un lot (parcourirUnLot) : celles des tables qu'il touche ET des tables qui les citent (une suppression peut
 * rompre une référence ailleurs), hors `horsControle`, chacune rattachée à une modification du lot : celle qui écrit la ligne qui cite, sinon celle qui
 * supprime la ligne visée, sinon la première du lot qui touche l'une des deux tables, sinon la première du lot. `tables` : d'autres tables écrites (et
 * celles qui les citent : les dérivations d'une résolution). `deja` : les ruptures en place avant le parcours (rupturesEnPlace), écartées.
 * Rend [{ rang, table, parent, raison }].
 */
/** La clé d'une référence rompue (referencesRompues : `lignes`) : pour écarter celles qui l'étaient déjà avant le parcours d'un lot (rompuesDuLot : `deja`). */
export const cleDeRupture = (r) => JSON.stringify([r.table, r.parent, r.colonnes, r.valeurs, r.cle]);

/** Les références déjà rompues des tables `tables` et de celles qui les citent (cleDeRupture), avant le parcours d'un lot. */
export function rupturesEnPlace(db, tables) {
  const toutes = new Set();
  for (const t of tables) {
    toutes.add(t);
    for (const c of tablesQuiCitent(db, t)) toutes.add(c);
  }
  const sortie = new Set();
  for (const t of toutes) {
    try {
      for (const r of referencesRompues(db, t).lignes) sortie.add(cleDeRupture(r));
    } catch {
      // table virtuelle ou disparue
    }
  }
  return sortie;
}

export function rompuesDuLot(db, entrees, { horsControle = [], tables: autres = [], deja = new Set() } = {}) {
  const hors = new Set(horsControle);
  const tables = new Set();
  for (const t of autres) {
    if (!hors.has(t)) tables.add(t);
    for (const c of tablesQuiCitent(db, t)) if (!hors.has(c)) tables.add(c);
  }
  for (const e of entrees) {
    if (e.issue === 'saute') continue;
    if (!hors.has(e.table)) tables.add(e.table);
    for (const t of tablesQuiCitent(db, e.table)) if (!hors.has(t)) tables.add(t);
  }
  const sortie = [];
  const memeCle = (a, b) => Object.keys(b).length > 0 && Object.entries(b).every(([c, v]) => egal(a?.[c], v));
  for (const t of tables) {
    let lignes = [];
    try {
      lignes = referencesRompues(db, t).lignes;
    } catch {
      continue; // table virtuelle
    }
    for (const r of lignes) {
      if (deja.has(cleDeRupture(r))) continue; // rompue avant le lot : pas de son fait
      const vise = Object.fromEntries(r.vers.map((c, i) => [c, r.valeurs[i]]));
      const e = entrees.find((x) => x.issue !== 'saute' && x.table === t && x.operation !== 'supprimer' && memeCle(x.cle, r.cle))
        ?? entrees.find((x) => x.issue !== 'saute' && x.table === r.parent && x.operation === 'supprimer' && memeCle(x.avant, vise))
        ?? entrees.find((x) => x.issue !== 'saute' && (x.table === t || x.table === r.parent))
        ?? entrees.find((x) => x.issue !== 'saute');
      if (!e) continue;
      sortie.push({ rang: e.rang, table: t, parent: r.parent, raison: `${t} : clé étrangère rompue vers ${r.parent} (${r.colonnes.join(', ')} = ${r.valeurs.map((v) => JSON.stringify(v)).join(', ')})` });
    }
  }
  return sortie;
}

/**
 * L'état net des lignes que le journal a en attente : une entrée par ligne (table, clé), avec la ligne telle qu'elle est maintenant dans la base
 * (null si elle a été supprimée) et `creee` si elle n'existait pas dans les règles livrées (sa première modification en attente est une insertion).
 * C'est ce que les pages statiques doivent montrer à la place de leur contenu construit. Une page dont le corps a changé a aussi `apercu` : celui de
 * la dernière modification de son corps (null si elle n'en a pas noté, ou s'il ne décrit plus le corps en place — un corps fusionné au rejeu, ou celui
 * d'un lot gardé où le site ne gagne que sur les passages en conflit — : la page ne peut pas montrer son nouveau texte avant la prochaine livraison).
 * Les lignes d'un lot gardé (en conflit, la valeur du site en place : rejouer, `garder`) y sont, comme celles d'un lot en attente.
 * @param {{ tables?: string[] }} [filtre]
 */
export function lignesEnAttente(db, { tables } = {}) {
  const vues = new Map();
  // les lots gardés (la valeur du site écrite, en conflit jusqu'à leur résolution : rejouer) sont dans la base comme les autres
  const toutes = db
    .prepare(
      `SELECT m.table_nom, m.cle, m.operation, m.apres, m.apercu, m.etat, m.detail FROM modification m JOIN modification_lot l ON l.id = m.lot_id
       WHERE m.etat = 'en_attente' OR (m.etat = 'conflit' AND l.resolu_le IS NULL AND instr(m.detail, ?) > 0) ORDER BY ${ORDRE_DE_REJEU}`,
    )
    .all(MARQUE_DE_REPRISE);
  for (const m of toutes) {
    if (tables && !tables.includes(m.table_nom)) continue;
    const k = `${m.table_nom}\u0000${m.cle}`;
    if (!vues.has(k)) vues.set(k, { table: m.table_nom, cle: JSON.parse(m.cle), creee: m.operation === 'inserer' });
    if (m.table_nom === 'page' && m.apres && 'corps_md' in JSON.parse(m.apres)) {
      // un lot gardé : l'aperçu ne vaut que si le rejeu a écrit le corps du site tel quel (pas la fusion où le site gagne sur les passages en conflit)
      const reprise = m.etat === 'conflit' ? lireLaTrace(m.detail).reprise : null;
      const perime = reprise && reprise.apres?.corps_md !== JSON.parse(m.apres).corps_md;
      vues.get(k).apercu = m.apercu === null || perime ? null : JSON.parse(m.apercu);
    }
  }
  return [...vues.values()].map((v) => ({ ...v, ligne: lireLigne(db, v.table, v.cle) }));
}

/**
 * Le journal, lots et modifications, pour le rapatrier dans data/rows (format « maverick-edition/1 » : GET /api/edition/journal/, lot figé de « Effectuer
 * la mise à jour »). Par défaut : les modifications en attente, et les « intégrées » des lots que les règles n'ont pas encore reçus (absents de
 * historique_modification). Une ligne créée puis supprimée par le journal passe « intégrée » quand la base vivante est refaite (rien à rejouer) : sans
 * elles, son lot n'entrerait jamais dans l'historique des règles, et l'identifiant de la ligne pourrait être repris (règle de la migration 0006) ; le
 * rapatriement les rejoue (encore « intégrées ») et les verse dans l'historique avec leur lot. Un lot qui suit un lot gardé sur l'un de ses champs
 * n'y est pas encore (lotsRetenus) : `retenus` ([{ id, derriere }], clé présente seulement s'il y en a).
 */
export function journalExporte(db, { etats = ['en_attente', 'integree'] } = {}) {
  const lots = db.prepare('SELECT * FROM modification_lot l ORDER BY l.fait_le, l.id').all();
  const mods = db.prepare('SELECT * FROM modification ORDER BY lot_id, rang').all();
  const historique = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'historique_modification'").get();
  const livres = new Set(historique ? db.prepare('SELECT DISTINCT lot_id FROM historique_modification').all().map((h) => h.lot_id) : []);
  const parLot = new Map(lots.map((l) => [l.id, { ...l, modifications: [] }]));
  const retenus = lotsRetenus(db, lots, mods);
  for (const m of mods) {
    if (!etats.includes(m.etat)) continue;
    if (m.etat === 'integree' && livres.has(m.lot_id)) continue; // lot déjà dans les règles
    if (retenus.has(m.lot_id)) continue; // derrière un lot gardé du même champ : part après sa résolution
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
  const sortie = { format: 'maverick-edition/1', lots: [...parLot.values()].filter((l) => l.modifications.length) };
  if (retenus.size) sortie.retenus = [...retenus].map(([id, derriere]) => ({ id, derriere }));
  return sortie;
}

/** Les clés d'une modification pour lotsRetenus : sa ligne (« table\u0000clé ») et, pour « modifier », ses colonnes (null : la ligne entière). */
function clesTouchees(m) {
  const ligne = `${m.table_nom}\u0000${cleCanonique(m.cle)}`;
  if (m.operation !== 'modifier') return { ligne, colonnes: null };
  return { ligne, colonnes: Object.keys(m.apres === null ? {} : JSON.parse(m.apres)) };
}
const cleCanonique = (texte) => {
  try {
    const cle = JSON.parse(texte);
    return JSON.stringify(Object.fromEntries(Object.entries(cle ?? {}).sort(([a], [b]) => a.localeCompare(b))));
  } catch {
    return String(texte);
  }
};

/**
 * Les lots qui ne partent pas encore parce qu'ils suivent un lot gardé (en conflit, la valeur du site en place : rejouer, `garder`) sur un champ qu'il
 * touche : ils ont été écrits sur la valeur du site, et le journal rejoué sur les règles ne l'aura qu'après la résolution du lot gardé. De proche en
 * proche (un lot retenu retient ceux qui le suivent sur ses champs). Map lot → le lot gardé (ou retenu) qu'il suit. `lots` et `mods` : toutes les
 * lignes de modification_lot et de modification.
 */
export function lotsRetenus(db, lots = null, mods = null) {
  // sortie rapide (la note en préparation est relue toutes les 15 s) : sans lot gardé en suspens, rien n'est retenu
  if (!lotGardeEnSuspens(db)) return new Map();
  lots ??= db.prepare('SELECT * FROM modification_lot l ORDER BY l.fait_le, l.id').all();
  mods ??= db.prepare('SELECT * FROM modification ORDER BY lot_id, rang').all();
  const parLot = new Map();
  for (const m of mods) {
    if (!parLot.has(m.lot_id)) parLot.set(m.lot_id, []);
    parLot.get(m.lot_id).push(m);
  }
  const lignes = new Map(); // ligne → le lot qui la bloque en entier
  const colonnes = new Map(); // « ligne\u0000colonne » → le lot qui la bloque
  const retenus = new Map();
  const touche = (m) => {
    const { ligne, colonnes: cols } = clesTouchees(m);
    if (lignes.has(ligne)) return lignes.get(ligne);
    if (cols === null) {
      for (const [k, lot] of colonnes) if (k.startsWith(`${ligne}\u0000`)) return lot;
      return null;
    }
    for (const c of cols) if (colonnes.has(`${ligne}\u0000${c}`)) return colonnes.get(`${ligne}\u0000${c}`);
    return null;
  };
  const bloquer = (m, lot) => {
    const { ligne, colonnes: cols } = clesTouchees(m);
    if (cols === null) lignes.set(ligne, lot);
    else for (const c of cols) colonnes.set(`${ligne}\u0000${c}`, lot);
  };
  for (const l of lots) {
    const ms = parLot.get(l.id) ?? [];
    const garde = l.resolu_le === null && ms.some((m) => m.etat === 'conflit' && estGardee(m.detail));
    if (garde) {
      for (const m of ms) bloquer(m, l.id);
      continue;
    }
    const enAttente = ms.filter((m) => m.etat === 'en_attente' || m.etat === 'integree');
    const derriere = enAttente.map(touche).find((x) => x) ?? null;
    if (!derriere) continue;
    retenus.set(l.id, derriere);
    for (const m of enAttente) bloquer(m, l.id);
  }
  return retenus;
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
