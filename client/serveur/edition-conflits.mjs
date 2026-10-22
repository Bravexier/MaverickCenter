// Lots du journal de l'édition en conflit, sur la page « Mise à jour » du site de dev (demande du propriétaire du 2026-10-22 : « Après les listes de
// modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le choix entre 1, 2, ou 3 pour saisir
// à la main ce qui remplace les deux. » ; docs/serveur.md, « Mise à jour », « Conflits du journal »).
//
// Un lot passe « conflit » au rejeu du journal (edition-journal.mjs#rejouer, quand une livraison refait la base vivante) : il est annulé en entier, ses
// lignes gardent un seul message (`detail`), et il n'est plus jamais rejoué. Ce module :
//   - examinerLeLot : le diagnostic d'un lot en conflit, recalculé sur la base vivante d'aujourd'hui (règles livrées + lots rejoués depuis), dans un
//     savepoint TOUJOURS annulé : chaque modification est rejouée sans s'arrêter au premier conflit (edition-journal.mjs#parcourirUnLot), les saines
//     sont dites telles quelles, chaque conflit porte la version 1 (ce que le site de dev avait écrit), la version 2 (ce que disent les règles
//     livrées, ou « ligne supprimée ») et les choix permis ;
//   - resoudreLeConflit : les choix faits (1 : la version 1, 2 : rien, la règle livrée reste, 3 : une valeur saisie), écrits dans UN nouveau lot normal
//     du journal (en attente, surcouche, historique, livré par la mise à jour suivante) ; l'ancien lot est marqué résolu (modification_lot.resolu_le,
//     resolu_par, resolution : migration 0072), jamais effacé : ses lignes restent « conflit », avec leur detail, comme trace.
//
// Le chemin d'une modification : les colonnes du modèle (lib/edition-modele.mjs#TABLES) d'une ligne passent par l'opération « modifier » de l'édition
// (serveur/edition.mjs : valeurDuChamp, forme canonique des balises, Markdown sûr, colonnes X_cle et du domaine, dérivations, notées au journal), avec
// leurs valeurs finales : celles du site de dev qui passent encore, et les choix 1 et 3. Le reste (insertions, suppressions, tables et colonnes hors
// du modèle, lignes de détail) est rejoué comme le rejeu (colonnes dérivées non écrites), mais noté dans le nouveau lot ; puis, comme rejouerLeJournal,
// les balises d'un mot-clé retiré, les liens de règle des métiers, les pages typées et leurs colonnes dérivées. Une ligne source gardée au choix 2 est
// re-dérivée (ses lignes de détail suivent la règle livrée ; le corps de sa page, refait par recalculerLesPages, n'est pas touché par cette
// re-dérivation). Les fiches de personnage perdent ce qu'une suppression gardée leur retire (R42, R52, R60), avec une note datée.
//
// Exception assumée à « lecture seule quand rien n'est écrit » : l'examen (GET) écrit dans un savepoint annulé, sur la connexion du service (traiter
// est synchrone : rien d'autre ne s'intercale). Node seulement, sans dépendance.
import { createHash } from 'node:crypto';
import { ErreurJournal, lireLigne, modifierSansNoter, nouveauLot, ouvrirLot, parcourirUnLot, rompuesDuLot, rupturesEnPlace } from './edition-journal.mjs';
import { ErreurEdition, OUTILS_DE_RESOLUTION as OUTILS, adaptateurDuJournal, colonneDerivee, messageSqlite, recalculerLesPages } from './edition.mjs';
import { detacherDesFiches, noterLesRetraits, nouveauxRetraitsDeFiches, retirerDesFiches } from './fiches-retraits.mjs';
import { TABLES, ligneSansImage } from '../src/lib/edition-modele.mjs';
import { instant as maintenant } from './instant.mjs';

/** Les choix d'un conflit : 1 = la version du site de dev, 2 = la règle livrée (rien n'est écrit), 3 = une valeur saisie qui remplace les deux. */
export const CHOIX = Object.freeze([1, 2, 3]);
/** Les lots résolus rendus avec les lots en conflit (les plus récents d'abord). */
export const RESOLUS_MONTRES = 50;
/** Ce que devient une modification saine, pour la page. */
const ISSUES = Object.freeze({ applique: 'reappliquee', integree: 'deja_la', derivee: 'derivee', fantome: 'sans_effet' });

const json = (t) => (t === null || t === undefined ? null : JSON.parse(t));
const duModele = (table, colonne) => Boolean(TABLES[table]?.colonnes[colonne]);
const cleDeLaLigne = (table, cle) => `${table}\u0000${JSON.stringify(cle)}`;

const ecritLeModeleCache = new WeakMap();
/**
 * Une modification d'une ligne du modèle qui écrit au moins une de ses colonnes : ses autres colonnes (X_cle, colonnes du domaine : artisanat d'un
 * métier, rôle d'une magie…) en sont tirées, et l'éditeur les refait (elles ne sont donc ni comparées ni écrites par le parcours).
 */
function ecritLeModele(m) {
  if (!m || m.operation !== 'modifier' || !TABLES[m.table_nom]) return false;
  if (!ecritLeModeleCache.has(m)) ecritLeModeleCache.set(m, Object.keys(json(m.apres) ?? {}).some((c) => duModele(m.table_nom, c)));
  return ecritLeModeleCache.get(m);
}
const deriveeDuLot = (table, cle, colonne, m) => colonneDerivee(table, cle, colonne) || (ecritLeModele(m) && !duModele(table, colonne));

/** Erreur de la résolution : statut HTTP, message en français, détails (le diagnostic à jour pour un 409). */
const erreur = (statut, message, details) => new ErreurEdition(statut, message, details);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les lots en conflit pas encore résolus, dans l'ordre du rejeu (edition-journal.mjs#ORDRE_DE_REJEU). */
export function lotsEnConflit(db) {
  return db.prepare(`SELECT l.id, l.fait_le, l.page_id, l.resume FROM modification_lot l
    WHERE l.resolu_le IS NULL AND EXISTS (SELECT 1 FROM modification m WHERE m.lot_id = l.id AND m.etat = 'conflit')
    ORDER BY l.fait_le, l.id`).all();
}

/** Les lots déjà résolus (les RESOLUS_MONTRES plus récents) : { lot, fait_le, resume, resolu_le, resolu_par, resolution }. */
export function lotsResolus(db) {
  return db.prepare(`SELECT id AS lot, fait_le, resume, resolu_le, resolu_par, resolution FROM modification_lot WHERE resolu_le IS NOT NULL
    ORDER BY resolu_le DESC, id DESC LIMIT ?`).all(RESOLUS_MONTRES).map((l) => ({ ...l, resolution: json(l.resolution) }));
}

/** Le nombre de lots et de modifications en conflit à résoudre (/api/etat, note en préparation). */
export function compterLesConflits(db) {
  const r = db.prepare(`SELECT count(DISTINCT m.lot_id) AS lots, count(*) AS modifications FROM modification m JOIN modification_lot l ON l.id = m.lot_id
    WHERE m.etat = 'conflit' AND l.resolu_le IS NULL`).get();
  return { lots: r.lots, modifications: r.modifications };
}

const lireLot = (db, id) => (typeof id === 'string' && id ? db.prepare('SELECT * FROM modification_lot WHERE id = ?').get(id) ?? null : null);
const lignesEnConflit = (db, id) => db.prepare("SELECT * FROM modification WHERE lot_id = ? AND etat = 'conflit' ORDER BY rang").all(id);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le parcours d'un lot (examen et résolution)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Ce que les fiches perdent quand une ligne de règle part (R42, R52 ; une ressource : R60), avant sa suppression : comme les domaines de l'édition. */
const RETRAITS_PAR_TABLE = Object.freeze({ metier: 'metiers', specialite: 'specialites', capacite: 'capacites', sort: 'sorts', arme: 'armes' });
function avantLaSuppression(ctx, table, cle) {
  if (typeof cle?.id !== 'string') return;
  if (RETRAITS_PAR_TABLE[table]) retirerDesFiches(ctx.db, { [RETRAITS_PAR_TABLE[table]]: [cle.id] }, ctx.retraits);
  if (table === 'ressource') detacherDesFiches(ctx.db, [cle.id], ctx.retraits);
}

/** Le contexte d'un lot de l'édition (serveur/edition.mjs#enregistrer) : le nouveau lot ouvert dans la transaction de l'appelant. */
function contexte(db, { id, instant, pageId }) {
  return { db, w: ouvrirLot(db, { id, instant, pageId }), instant, crees: [], retraits: nouveauxRetraitsDeFiches(), operation: 0 };
}

/**
 * Parcourt les modifications en conflit du lot (edition-journal.mjs#parcourirUnLot), chacune notée dans le nouveau lot (ctx.w) quand elle passe. Les
 * colonnes du modèle d'une ligne du modèle sont écrites sans être notées (la suite du parcours voit la ligne telle que le site de dev l'avait), et
 * retenues (`differees` : clé de ligne → { table, cle, original, final, apercu, rangs }) : refaireParLEditeur les remet, puis les refait par l'éditeur.
 */
function parcourir(ctx, lignes, sauter = new Set()) {
  const { db } = ctx;
  const differees = new Map();
  const ecrire = {
    inserer: (_db, table, valeurs) => ctx.w.inserer(table, valeurs),
    modifier(_db, table, cle, valeurs, m) {
      if (!ecritLeModele(m)) {
        ctx.w.modifier(table, cle, valeurs, { apercu: table === 'page' && 'corps_md' in valeurs ? json(m.apercu) : null });
        return;
      }
      const k = cleDeLaLigne(table, cle);
      if (!differees.has(k)) differees.set(k, { table, cle, original: {}, final: {}, apercu: null, rangs: new Set() });
      const d = differees.get(k);
      const avant = lireLigne(db, table, cle);
      for (const [c, v] of Object.entries(valeurs)) {
        if (!(c in d.original)) d.original[c] = avant[c];
        d.final[c] = v;
        if (c === 'corps_md') d.apercu = json(m.apercu);
      }
      d.rangs.add(m.rang);
      modifierSansNoter(db, table, cle, valeurs);
    },
    supprimer(_db, table, cle) {
      avantLaSuppression(ctx, table, cle);
      ctx.w.supprimer(table, cle);
    },
  };
  const entrees = parcourirUnLot(db, lignes, {
    derivee: deriveeDuLot, siOrphelines: ['source'], adapte: adaptateurDuJournal(db), ecrire, sauter,
    creer: (table, valeurs) => ctx.w.inserer(table, valeurs),
  });
  return { entrees, differees };
}

/** Une modification décodée pour recalculerLesPages : ses colonnes réellement écrites seulement (`colonnes`), toutes sinon. */
function decodeePour(e, colonnes = null) {
  const garder = (v) => (v && colonnes ? Object.fromEntries(colonnes.map((c) => [c, v[c] ?? null])) : v);
  return { lot: e.m.lot_id, rang: e.rang, table: e.table, cle: e.cle, operation: e.operation, avant: garder(e.avant), apres: garder(e.apres) };
}

/** Les modifications que le parcours a écrites sans l'éditeur (et les dérivées : leurs pages sont refaites), pour recalculerLesPages. */
function ecritesSansLEditeur(entrees, differees) {
  const differes = new Set([...differees.values()].flatMap((d) => [...d.rangs]));
  const sortie = [];
  for (const e of entrees) {
    if (e.issue === 'derivee') sortie.push(decodeePour(e));
    else if (differes.has(e.rang) && e.operation === 'modifier') continue;
    else if (e.issue === 'applique') sortie.push(decodeePour(e, e.operation === 'modifier' ? e.ecrites ?? null : null));
    else if (e.issue === 'conflit' && e.genre === 'colonnes' && e.ecrites?.length) sortie.push(decodeePour(e, e.ecrites));
  }
  return sortie;
}

/** Une erreur de l'éditeur, de la base ou du journal : { statut, message } ; une autre erreur remonte. */
function refusDe(e) {
  if (e instanceof ErreurEdition) return { statut: e.statut, message: e.message };
  if (e instanceof ErreurJournal) return { statut: 400, message: e.message };
  if (OUTILS.refuseeParLaBase(e)) return { statut: 422, message: messageSqlite(e) };
  return null;
}

/** Exécute `agir` dans un savepoint : annulé (et le refus rendu) si l'éditeur, la base ou le journal refuse ; gardé sinon (rend null). */
function essayer(db, nom, agir, { garder = true } = {}) {
  db.exec(`SAVEPOINT ${nom}`);
  try {
    agir();
  } catch (e) {
    db.exec(`ROLLBACK TO ${nom}`);
    db.exec(`RELEASE ${nom}`);
    const r = refusDe(e);
    if (!r) throw e;
    return r;
  }
  if (!garder) db.exec(`ROLLBACK TO ${nom}`);
  db.exec(`RELEASE ${nom}`);
  return null;
}

/** L'opération « modifier » de l'éditeur sur une ligne (ctx.operation : sa place, pour les messages). */
const modifierParLEditeur = (ctx, { table, cle, valeurs, apercu = null }) => OUTILS.modifier(ctx, { op: 'modifier', table, cle, valeurs, ...(apercu ? { apercu } : {}) });

/**
 * Une vue de la base où aucune page n'existe pour les dérivations (lireLigne de `page` : null) : la re-dérivation d'une ligne gardée au choix 2 ne
 * réécrit que ses lignes de détail (le corps de sa page, transition par transition, ne saurait pas repartir de la version 1 qu'il n'a jamais eue).
 */
function vueSansPages(db) {
  const aucune = Object.freeze({ get: () => undefined, all: () => [] });
  return new Proxy(db, {
    get(cible, nom) {
      if (nom === 'prepare') return (sql) => (/^SELECT \* FROM "page" WHERE /.test(sql) ? aucune : cible.prepare(sql));
      const v = Reflect.get(cible, nom);
      return typeof v === 'function' ? v.bind(cible) : v;
    },
  });
}

/** Comme rejouerLeJournal après le rejeu : balises d'un mot-clé retiré, liens de règle des métiers, pages typées, puis leurs colonnes dérivées. */
function commeLeRejeu(ctx, entrees, brutes) {
  const { db } = ctx;
  const balises = OUTILS.balisesRetireesParLeLot(db, entrees.filter((e) => e.issue !== 'saute').map((e) => e.m));
  OUTILS.completerLesMetiers(db, new Set(brutes.filter((m) => m.table === 'metier' || m.table === 'metier_bonus').map((m) => m.cle?.metier_id ?? m.cle?.id)));
  recalculerLesPages(db, [...brutes, ...balises]);
  OUTILS.balisesDesColonnesDerivees(db);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------------------------------------------------------------------------

const valeurVue = (table, colonne, v) => ({ genre: 'valeur', valeur: v === undefined || v === null ? null : ligneSansImage(table, { [colonne]: v })[colonne] });
const ligneVue = (table, l) => (l ? ligneSansImage(table, { ...l }) : null);
const versionDesRegles = (e) => (e.ligne ? { genre: 'ligne', valeur: ligneVue(e.table, e.ligne) } : { genre: 'absente', valeur: null });
function versionDuSite(e) {
  if (e.operation === 'supprimer') return { genre: 'suppression', valeur: ligneVue(e.table, e.avant) };
  return { genre: e.operation === 'inserer' ? 'ligne' : 'valeurs', valeur: ligneVue(e.table, e.apres) };
}
/**
 * Le libellé d'une ligne pour la page : la table et le nom (ou titre, libellé) de la ligne ; une ligne qui n'en a plus (une page supprimée, dont seule
 * la version du site de dev reste) est dite par l'id de sa clé (« Page guide/le-jeu-de-role »), jamais par du JSON brut ; une clé composée sans `id`
 * reste écrite en entier (aucune de ses colonnes ne nomme la ligne seule).
 */
export function libelleDeLigne(table, ligne, cle) {
  const nom = ligne?.nom ?? ligne?.titre ?? ligne?.libelle ?? null;
  const id = cle?.id;
  const sansNom = (typeof id === 'string' && id) || typeof id === 'number' ? String(id) : JSON.stringify(cle);
  return `${TABLES[table]?.libelle ?? table} ${typeof nom === 'string' && nom ? `« ${nom} »` : sansNom}`;
}
/** Une clé en JSON, ses colonnes triées (deux écritures de la même clé se comparent). */
const cleCanonique = (cle) => JSON.stringify(Object.fromEntries(Object.entries(cle ?? {}).sort(([a], [b]) => a.localeCompare(b))));
/** Le libellé d'une colonne (celui du champ de TABLES) entre guillemets, ou son nom quand le modèle n'en a pas. */
const colonneLisible = (table, c) => {
  const libelle = TABLES[table]?.colonnes[c]?.libelle;
  return libelle ? `« ${libelle} »` : c;
};
/** La raison d'un conflit, ses noms de colonnes dits par leur libellé (« les règles ont changé « Bonus » autrement »). */
const raisonLisible = (table, raison) => raison.replace(/^les règles ont changé (.+) autrement$/,
  (_t, colonnes) => `les règles ont changé ${colonnes.split(', ').map((c) => colonneLisible(table, c)).join(', ')} autrement`);

/**
 * La raison du rejeu d'un lot (`detail` de ses lignes, une trace écrite par edition-journal.mjs#rejouerUneFois : « lot <id> : <table> <clé JSON> :
 * <raison> », « lot <id> : <table> : clé étrangère rompue vers <table> », « lot <id> : après le lot : … ») telle que la page la lit : sans l'id du
 * lot, la ligne dite par la légende de son conflit (ou de sa modification saine) quand le lot en a une de même table et même clé, sinon par
 * libelleDeLigne (l'id de la clé), les colonnes et les tables par leur libellé (TABLES) quand le modèle en a un. `libelles` : [{ table, cle,
 * libelle }] (les conflits puis les saines du diagnostic). Une forme inconnue est rendue telle quelle, sans l'id du lot. Rien n'est écrit en base :
 * la colonne `detail` reste la trace.
 */
export function detailLisible(detail, libelles = []) {
  if (typeof detail !== 'string' || !detail) return null;
  const texte = detail.replace(/^lot \S+ : /, '');
  const rompue = texte.match(/^([a-z_][a-z0-9_]*) : clé étrangère rompue vers ([a-z_][a-z0-9_]*)$/);
  if (rompue) return `${TABLES[rompue[1]]?.libelle ?? rompue[1]} : clé étrangère rompue vers ${TABLES[rompue[2]]?.libelle ?? rompue[2]}`;
  const table = texte.match(/^([a-z_][a-z0-9_]*) \{/)?.[1];
  if (!table) return texte;
  // la clé JSON finit au premier « } : » après lequel le JSON se lit (une valeur de clé pourrait contenir « } : »)
  for (let i = texte.indexOf('} : '); i !== -1; i = texte.indexOf('} : ', i + 1)) {
    let cle;
    try {
      cle = JSON.parse(texte.slice(table.length + 1, i + 1));
    } catch {
      continue;
    }
    if (cle === null || typeof cle !== 'object' || Array.isArray(cle)) break;
    const connue = libelles.find((l) => l.table === table && cleCanonique(l.cle) === cleCanonique(cle));
    return `${connue?.libelle ?? libelleDeLigne(table, null, cle)} : ${raisonLisible(table, texte.slice(i + 4))}`;
  }
  return texte;
}

/** Le champ de TABLES, tel que la page le saisit (type, libellé, requis, min, max, choix ou liste de GET /api/edition/listes/, vide). */
const saisieDe = (champ) => JSON.parse(JSON.stringify(champ));

/** Les conflits d'une modification du parcours, sous la forme de la page (sans `refus_1` ni les rattachements des clés étrangères). */
function conflitsDeLEntree(e) {
  const base = { rang: e.rang, table: e.table, cle: e.cle, operation: e.operation, libelle: libelleDeLigne(e.table, e.ligne ?? e.apres ?? e.avant, e.cle), raison: e.raison };
  const ligneEntiere = { colonne: null, colonne_libelle: null, avant: null, apercu: null, saisie: null };
  if (e.genre === 'colonnes') {
    return e.colonnes.map((c) => {
      const champ = TABLES[e.table]?.colonnes[c];
      const image = champ?.type === 'image';
      return {
        ...base, id: `${e.rang}:${c}`, colonne: c, colonne_libelle: champ?.libelle ?? c, genre: champ ? 'champ' : 'hors_modele',
        version_1: valeurVue(e.table, c, e.apres[c]), version_2: valeurVue(e.table, c, e.ligne?.[c]), avant: valeurVue(e.table, c, e.avant?.[c]),
        apercu: e.table === 'page' && c === 'corps_md' ? e.apercu : null,
        choix_possibles: champ && !image ? [1, 2, 3] : [1, 2], saisie: champ && !image ? saisieDe(champ) : null,
      };
    });
  }
  if (e.genre === 'existe_deja') {
    return [{ ...base, ...ligneEntiere, id: `${e.rang}`, genre: 'insertion', version_1: { genre: 'ligne', valeur: ligneVue(e.table, e.apres) }, version_2: versionDesRegles(e), choix_possibles: [1, 2] }];
  }
  if (e.genre === 'suppression') {
    return [{ ...base, ...ligneEntiere, id: `${e.rang}`, genre: 'suppression', version_1: versionDuSite(e), version_2: versionDesRegles(e), choix_possibles: [1, 2] }];
  }
  if (e.genre === 'ligne_supprimee') {
    return [{
      ...base, ...ligneEntiere, id: `${e.rang}`, genre: 'ligne_supprimee', version_1: versionDuSite(e), version_2: { genre: 'absente', valeur: null },
      apercu: e.table === 'page' && e.apres && 'corps_md' in e.apres ? e.apercu : null, choix_possibles: [2],
    }];
  }
  return [{ ...base, ...ligneEntiere, id: `${e.rang}`, genre: 'sans_valeur', version_1: versionDuSite(e), version_2: versionDesRegles(e), choix_possibles: [2] }];
}

/** Le conflit d'une modification abandonnée faute de pouvoir l'écrire (clé étrangère rompue, refus) : sa raison, et le seul choix 2. */
const abandon = (e, raison) => ({
  rang: e.rang, table: e.table, cle: e.cle, operation: e.operation, libelle: libelleDeLigne(e.table, e.ligne ?? e.apres ?? e.avant, e.cle), raison,
  colonne: null, colonne_libelle: null, avant: null, apercu: null, saisie: null, id: `${e.rang}`, genre: 'sans_valeur',
  version_1: versionDuSite(e), version_2: versionDesRegles(e), choix_possibles: [2],
});

/**
 * Remet chaque ligne retenue telle qu'avant le parcours, puis la refait par l'éditeur avec ses valeurs finales (`valeursDe(d)` : { valeurs, apercu },
 * rien si vide). Examen (`refus` donné) : une ligne refusée est réessayée colonne par colonne, chaque colonne refusée est rangée dans `refus`
 * (clé de ligne → [{ colonne, raison }]) et le reste est écrit ; résolution : le refus remonte.
 */
function refaireParLEditeur(ctx, operations, valeursDe, refus = null) {
  const { db } = ctx;
  const ordre = [...operations.values()].sort((a, b) => Math.min(...a.rangs) - Math.min(...b.rangs));
  for (const d of ordre) {
    if (Object.keys(d.original).length) modifierSansNoter(db, d.table, d.cle, d.original);
    if (!lireLigne(db, d.table, d.cle)) continue;
    const { valeurs, apercu } = valeursDe(d);
    if (!Object.keys(valeurs).length) continue;
    ctx.operation = Math.min(...d.rangs);
    if (!refus) {
      modifierParLEditeur(ctx, { table: d.table, cle: d.cle, valeurs, apercu });
      continue;
    }
    if (!essayer(db, 'conflit_ligne', () => modifierParLEditeur(ctx, { table: d.table, cle: d.cle, valeurs, apercu }))) continue;
    const gardees = {};
    for (const [c, v] of Object.entries(valeurs)) {
      const r = essayer(db, 'conflit_colonne', () => modifierParLEditeur(ctx, { table: d.table, cle: d.cle, valeurs: { [c]: v }, apercu: c === 'corps_md' ? apercu : null }), { garder: false });
      if (r) refus.set(cleDeLaLigne(d.table, d.cle), [...(refus.get(cleDeLaLigne(d.table, d.cle)) ?? []), { colonne: c, raison: r.message }]);
      else gardees[c] = v;
    }
    if (Object.keys(gardees).length) {
      essayer(db, 'conflit_ligne', () => modifierParLEditeur(ctx, { table: d.table, cle: d.cle, valeurs: gardees, apercu: 'corps_md' in gardees ? apercu : null }));
    }
  }
}

/**
 * Une passe de l'examen d'un lot (dans un savepoint que l'appelant annule) : { public (la forme de GET /api/mise-a-jour/conflits/), interne:
 * { idsDuParcours, abandons } }. `abandons` (Map rang → conflit) : les modifications abandonnées d'office (forme ancienne sans équivalent, écriture
 * refusée, clé étrangère rompue, erreur après le lot), que la passe laisse de côté ; elle rend les siennes en plus. `idsDuParcours` : les conflits nés
 * du parcours lui-même (la résolution, avec les mêmes abandons, les retrouve ; sinon les règles ont bougé : 409).
 */
function examiner(db, lot, lignes, instant, abandons, deja) {
  const ctx = contexte(db, { id: nouveauLot().id, instant, pageId: lot.page_id });
  const { entrees, differees } = parcourir(ctx, lignes, new Set(abandons.keys()));
  const duParcours = entrees.filter((e) => e.issue === 'conflit').flatMap(conflitsDeLEntree);
  const idsDuParcours = duParcours.map((c) => c.id);
  const sortants = new Map(abandons);
  for (const c of duParcours) if (c.genre === 'sans_valeur') sortants.set(c.rang, c);
  let conflits = duParcours.filter((c) => !sortants.has(c.rang));
  // les colonnes du modèle que le site de dev avait écrites et que l'éditeur refuse aujourd'hui (Markdown sûr, bloc inconnu, balise d'un mot-clé
  // disparu, titre déjà pris…) : des conflits à elles, sans choix 1
  const refus = new Map();
  refaireParLEditeur(ctx, differees, (d) => ({ valeurs: { ...d.final }, apercu: d.apercu }), refus);
  for (const [k, colonnes] of refus) {
    const d = differees.get(k);
    for (const { colonne, raison } of colonnes) {
      const rang = Math.max(...[...d.rangs].filter((r) => colonne in (entrees.find((e) => e.rang === r)?.apres ?? {})));
      const e = entrees.find((x) => x.rang === rang);
      const champ = TABLES[d.table].colonnes[colonne];
      const image = champ.type === 'image';
      conflits.push({
        rang, table: d.table, cle: d.cle, operation: 'modifier', libelle: libelleDeLigne(d.table, e.ligne, d.cle), raison: `l’édition refuse aujourd’hui cette valeur : ${raison}`,
        id: `${rang}:${colonne}`, colonne, colonne_libelle: champ.libelle, genre: 'champ', version_1: valeurVue(d.table, colonne, d.final[colonne]),
        version_2: valeurVue(d.table, colonne, d.original[colonne]), avant: valeurVue(d.table, colonne, d.original[colonne]),
        apercu: colonne === 'corps_md' ? d.apercu : null, choix_possibles: image ? [2] : [2, 3], refus_1: raison, saisie: image ? null : saisieDe(champ),
      });
    }
  }
  // la version 1 d'un champ en conflit passe-t-elle encore par l'éditeur ? sinon, pas de choix 1 (sa raison est rendue)
  for (const c of conflits) {
    if (c.genre !== 'champ' || !c.choix_possibles.includes(1)) continue;
    const e = entrees.find((x) => x.rang === c.rang);
    const r = essayer(db, 'conflit_choix', () => modifierParLEditeur(ctx, { table: c.table, cle: c.cle, valeurs: { [c.colonne]: e.apres[c.colonne] }, apercu: c.colonne === 'corps_md' ? e.apercu : null }), { garder: false });
    if (r) Object.assign(c, { choix_possibles: c.choix_possibles.filter((x) => x !== 1), refus_1: r.message });
  }
  // choix 2 par défaut : la re-dérivation des lignes sources gardées (une qui échoue n'offre pas le choix 2 : `refus_2`)
  for (const c of conflits) {
    if (c.genre !== 'champ' || !OUTILS.aUneDerivation(c.table)) continue;
    const ligne = lireLigne(db, c.table, c.cle);
    if (!ligne) continue;
    const d = differees.get(cleDeLaLigne(c.table, c.cle));
    const v1 = d && c.colonne in d.final ? d.final[c.colonne] : entrees.find((x) => x.rang === c.rang).apres[c.colonne];
    const r = essayer(db, 'conflit_derive', () => OUTILS.deriver({ ...ctx, db: vueSansPages(db) }, c.table, { ...ligne, [c.colonne]: v1 }, ligne));
    if (r) Object.assign(c, { choix_possibles: c.choix_possibles.filter((x) => x !== 2), refus_2: r.message });
  }
  // les clés étrangères, choix 2 partout : une rupture abandonne la modification qui l'écrit (ou la suppression qui la cause)
  const parcourues = entrees.filter((e) => e.issue !== 'saute' && !sortants.has(e.rang));
  let rompues = [];
  const apres = essayer(db, 'conflit_apres', () => {
    commeLeRejeu(ctx, entrees, ecritesSansLEditeur(entrees, differees));
    rompues = rompuesDuLot(db, parcourues, { tables: [...new Set(ctx.w.lignes.map((l) => l.table))], deja });
  });
  const raisons = new Map();
  for (const r of rompues) raisons.set(r.rang, [...(raisons.get(r.rang) ?? []), r.raison]);
  if (apres) {
    // après le lot (balises d'un mot-clé retiré, pages refaites) : rattaché aux suppressions de mot-clé, sinon à la première modification
    const rangs = parcourues.filter((e) => e.table === 'mot_cle' && e.operation === 'supprimer').map((e) => e.rang);
    for (const rang of rangs.length ? rangs : parcourues.slice(0, 1).map((e) => e.rang)) raisons.set(rang, [...(raisons.get(rang) ?? []), `après le lot : ${apres.message}`]);
  }
  for (const [rang, rs] of raisons) sortants.set(rang, abandon(entrees.find((x) => x.rang === rang), [...new Set(rs)].join(' ; ')));
  conflits = [...conflits.filter((c) => !sortants.has(c.rang)), ...sortants.values()];
  conflits.sort((a, b) => a.rang - b.rang || String(a.colonne ?? '').localeCompare(String(b.colonne ?? '')));
  const saines = entrees.filter((e) => e.issue !== 'saute' && !sortants.has(e.rang) && (e.issue !== 'conflit' || (e.genre === 'colonnes' && e.ecrites?.length)))
    .map((e) => ({
      rang: e.rang, table: e.table, cle: e.cle, operation: e.operation, libelle: libelleDeLigne(e.table, e.ligne ?? e.apres ?? e.avant, e.cle),
      issue: e.issue === 'conflit' ? 'reappliquee' : ISSUES[e.issue], ...(e.issue === 'conflit' ? { colonnes: e.ecrites } : {}),
    }));
  const empreinte = createHash('sha256').update(JSON.stringify({
    lot: lot.id, saines: saines.map((s) => [s.rang, s.issue, s.colonnes ?? null]), conflits: conflits.map((c) => [c.id, c.genre, c.version_1, c.version_2, c.choix_possibles]),
  })).digest('hex').slice(0, 32);
  return {
    public: {
      lot: lot.id, fait_le: lot.fait_le, page_id: lot.page_id, resume: lot.resume, detail: lignes[0]?.detail ?? null,
      detail_lisible: detailLisible(lignes[0]?.detail ?? null, [...conflits, ...saines]), empreinte, saines, conflits,
    },
    interne: { idsDuParcours, abandons: sortants },
  };
}

/**
 * L'examen d'un lot, dans un savepoint toujours annulé (clés étrangères différées : contrôlées à la fin, rattachées) : passe après passe, chaque
 * modification abandonnée d'office est laissée de côté à la passe suivante, jusqu'à ce qu'une passe n'en abandonne plus (comme les passes du rejeu) —
 * la résolution, qui les laisse de côté aussi, voit donc le même lot. Rend le résultat de la dernière passe, ou null sans modification en conflit.
 */
function examen(db, lot, instant) {
  const lignes = lignesEnConflit(db, lot.id);
  if (!lignes.length) return null;
  // les références déjà rompues avant le lot (jamais dans une base vivante saine : règles contrôlées, lots rejoués contrôlés) ne sont pas de son fait
  const deja = rupturesEnPlace(db, [...new Set(lignes.map((m) => m.table_nom))]);
  let abandons = new Map();
  for (let passe = 0; passe <= lignes.length; passe += 1) {
    db.exec('SAVEPOINT examen_du_conflit');
    let r;
    try {
      db.exec('PRAGMA defer_foreign_keys = ON');
      r = examiner(db, lot, lignes, instant, abandons, deja);
    } finally {
      db.exec('ROLLBACK TO examen_du_conflit');
      db.exec('RELEASE examen_du_conflit');
    }
    if ([...r.interne.abandons.keys()].every((rang) => abandons.has(rang))) return { ...r, interne: { ...r.interne, deja } };
    abandons = r.interne.abandons;
  }
  throw new Error(`examen du lot ${lot.id} : les abandons ne se stabilisent pas`);
}


/** Le diagnostic d'un lot en conflit pas encore résolu (GET /api/mise-a-jour/conflits/) ; null si le lot est inconnu, résolu ou sans conflit. */
export function examinerLeLot(db, id, { instant = maintenant() } = {}) {
  const lot = lireLot(db, id);
  if (!lot || lot.resolu_le) return null;
  return examen(db, lot, instant)?.public ?? null;
}

/** GET /api/mise-a-jour/conflits/ : { lots: [diagnostic de chaque lot à résoudre], resolus: lotsResolus }. */
export function conflitsDuJournal(db, { instant = maintenant() } = {}) {
  return { lots: lotsEnConflit(db).map((l) => examinerLeLot(db, l.id, { instant })).filter(Boolean), resolus: lotsResolus(db) };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Résolution
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Les choix reçus, contrôlés contre le diagnostic : Map id → { choix, valeur }. Refus 400. */
function choixControles(diag, choix) {
  if (!choix || typeof choix !== 'object' || Array.isArray(choix)) throw erreur(400, 'Choix attendus : { "<conflit>": { choix: 1 | 2 | 3, valeur? } }.');
  const ids = new Set(diag.conflits.map((c) => c.id));
  const inconnus = Object.keys(choix).filter((id) => !ids.has(id));
  if (inconnus.length) throw erreur(400, `Conflit inconnu dans ce lot : ${inconnus.join(', ')}.`);
  const sortie = new Map();
  for (const c of diag.conflits) {
    const r = choix[c.id];
    const n = typeof r === 'number' ? r : r?.choix;
    if (n === undefined || n === null) throw erreur(400, `${c.libelle}${c.colonne_libelle ? ` (${c.colonne_libelle})` : ''} : choisissez 1, 2 ou 3.`);
    if (!CHOIX.includes(n) || !c.choix_possibles.includes(n)) throw erreur(400, `${c.libelle}${c.colonne_libelle ? ` (${c.colonne_libelle})` : ''} : choix ${JSON.stringify(n)} impossible ici (${c.choix_possibles.join(', ')}).`);
    if (n === 3 && (r === null || typeof r !== 'object' || !('valeur' in r))) throw erreur(400, `${c.libelle} (${c.colonne_libelle}) : la valeur saisie manque (choix 3).`);
    sortie.set(c.id, { choix: n, valeur: n === 3 ? r.valeur : undefined });
  }
  return sortie;
}

/**
 * Résout un lot en conflit (POST /api/mise-a-jour/conflits/ { lot, empreinte, choix }) : une seule transaction (BEGIN IMMEDIATE, clés étrangères
 * différées puis contrôlées), le nouveau lot du journal (`nouveau_lot` : null si tout est au choix 2 et rien de sain n'est à réécrire), l'ancien
 * marqué résolu. Refus (ErreurEdition) : 404 lot inconnu ou sans conflit, 409 déjà résolu, diagnostic changé (empreinte) ou une ligne qui ne passe plus
 * avec ces choix (`details.lot` : le diagnostic à jour), 400 choix manquant ou impossible, valeur refusée par l'éditeur, 422 contrainte de la base.
 * @returns {{ lot: string, nouveau_lot: string | null, modifications: number, lignes: object[], fiches: object[], resolution: object[] }}
 */
export function resoudreLeConflit(db, corps, { instant, id } = {}) {
  if (instant === undefined || id === undefined) {
    const n = nouveauLot();
    instant ??= n.instant;
    id ??= n.id;
  }
  if (!corps || typeof corps !== 'object' || typeof corps.lot !== 'string') throw erreur(400, 'Corps attendu : { lot, empreinte, choix }.');
  const lot = lireLot(db, corps.lot);
  if (!lot) throw erreur(404, `Lot introuvable : ${corps.lot}`);
  if (lot.resolu_le) throw erreur(409, `Ce lot est déjà résolu (le ${lot.resolu_le}${lot.resolu_par ? `, par le lot ${lot.resolu_par}` : ''}).`, { resolu_par: lot.resolu_par });
  const diag = examen(db, lot, instant);
  if (!diag) throw erreur(404, `Ce lot n’a aucune modification en conflit : ${lot.id}`);
  if (corps.empreinte !== diag.public.empreinte) throw erreur(409, 'Les conflits de ce lot ont changé depuis leur affichage : relisez-les.', { lot: diag.public });
  const choix = choixControles(diag.public, corps.choix);
  const resolution = diag.public.conflits.map((c) => ({ rang: c.rang, colonne: c.colonne, choix: choix.get(c.id).choix }));

  db.exec('BEGIN IMMEDIATE');
  let ouverte = true;
  try {
    db.exec('PRAGMA defer_foreign_keys = ON');
    const ctx = contexte(db, { id, instant, pageId: lot.page_id });
    const lignes = lignesEnConflit(db, lot.id);
    const { entrees, differees } = parcourir(ctx, lignes, new Set(diag.interne.abandons.keys()));
    const ids = entrees.filter((e) => e.issue === 'conflit').flatMap(conflitsDeLEntree).map((c) => c.id);
    if (JSON.stringify(ids) !== JSON.stringify(diag.interne.idsDuParcours)) throw erreur(409, 'Une modification de ce lot ne passe plus avec ces choix : relisez les conflits.', { lot: diag.public });
    const parRang = new Map(entrees.map((e) => [e.rang, e]));
    const brutes = ecritesSansLEditeur(entrees, differees);
    // les choix, dans l'ordre du lot : sans l'éditeur (insertion, suppression, hors du modèle), puis les lignes du modèle par l'éditeur
    const operations = differees;
    const aRederiver = new Map(); // clé de ligne → { table, cle, v1: { colonne: valeur } }
    for (const c of diag.public.conflits) {
      const { choix: n, valeur } = choix.get(c.id);
      const e = parRang.get(c.rang);
      if (c.genre === 'champ') {
        const k = cleDeLaLigne(c.table, c.cle);
        if (!operations.has(k)) operations.set(k, { table: c.table, cle: c.cle, original: {}, final: {}, apercu: null, rangs: new Set() });
        const d = operations.get(k);
        d.rangs.add(c.rang);
        const v1 = c.colonne in d.final ? d.final[c.colonne] : e.apres[c.colonne];
        d.choix ??= {};
        d.choix[c.colonne] = { n, valeur, v1, apercu: c.colonne === 'corps_md' ? (d.apercu ?? e.apercu) : null };
        if (n === 2 && OUTILS.aUneDerivation(c.table)) {
          if (!aRederiver.has(k)) aRederiver.set(k, { table: c.table, cle: c.cle, v1: {} });
          aRederiver.get(k).v1[c.colonne] = v1;
        }
        continue;
      }
      if (n !== 1) continue;
      if (c.genre === 'hors_modele') {
        ctx.w.modifier(c.table, c.cle, { [c.colonne]: e.apres[c.colonne] });
        brutes.push(decodeePour(e, [c.colonne]));
      } else if (c.genre === 'insertion') {
        const ligne = lireLigne(db, c.table, c.cle);
        const colonnes = Object.keys(e.apres).filter((col) => !(col in c.cle) && !deriveeDuLot(c.table, c.cle, col, e.m) && (ligne?.[col] ?? null) !== (e.apres[col] ?? null));
        if (ligne && colonnes.length) {
          ctx.w.modifier(c.table, c.cle, Object.fromEntries(colonnes.map((col) => [col, e.apres[col]])));
          brutes.push({ ...decodeePour(e, colonnes), operation: 'modifier', avant: Object.fromEntries(colonnes.map((col) => [col, ligne[col]])) });
        }
      } else if (c.genre === 'suppression') {
        avantLaSuppression(ctx, c.table, c.cle);
        ctx.w.supprimer(c.table, c.cle);
        brutes.push(decodeePour(e));
      }
    }
    refaireParLEditeur(ctx, operations, (d) => {
      const valeurs = {};
      let apercu = null;
      for (const [col, v] of Object.entries(d.final)) {
        // une colonne en conflit (refusée aujourd'hui par l'éditeur) suit son choix ; les autres, la version du site de dev
        if (d.choix?.[col]) continue;
        valeurs[col] = v;
        if (col === 'corps_md') apercu = d.apercu;
      }
      for (const [col, { n, valeur, v1, apercu: a }] of Object.entries(d.choix ?? {})) {
        if (n === 1) {
          valeurs[col] = v1;
          if (col === 'corps_md') apercu = a;
        } else if (n === 3) valeurs[col] = valeur;
      }
      if (!('corps_md' in valeurs)) apercu = null;
      return { valeurs, apercu };
    });
    for (const { table, cle, v1 } of aRederiver.values()) {
      const ligne = lireLigne(db, table, cle);
      if (ligne) OUTILS.deriver({ ...ctx, db: vueSansPages(db) }, table, { ...ligne, ...v1 }, ligne);
    }
    commeLeRejeu(ctx, entrees, brutes);
    const fiches = noterLesRetraits(db, ctx.retraits, instant);
    const rompues = rompuesDuLot(db, entrees.filter((e) => e.issue !== 'saute'), { tables: [...new Set(ctx.w.lignes.map((l) => l.table))], deja: diag.interne.deja });
    if (rompues.length) {
      throw erreur(409, `Ces choix rompraient une référence : ${[...new Set(rompues.map((r) => r.raison))].slice(0, 5).join(' ; ')}.`, { lot: diag.public });
    }
    const ecrit = ctx.w.nombre > 0;
    if (ecrit) ctx.w.terminer(`Résolution du conflit du lot ${lot.id} : ${lot.resume}`);
    else db.prepare('DELETE FROM modification_lot WHERE id = ?').run(id);
    const marque = db.prepare('UPDATE modification_lot SET resolu_le = ?, resolu_par = ?, resolution = ? WHERE id = ? AND resolu_le IS NULL')
      .run(instant, ecrit ? id : null, JSON.stringify(resolution), lot.id);
    if (!marque.changes) throw erreur(409, 'Ce lot vient d’être résolu.');
    db.exec('COMMIT');
    ouverte = false;
    const vues = new Map(ctx.w.lignes.map((l) => [cleDeLaLigne(l.table, l.cle), l]));
    return {
      lot: lot.id, nouveau_lot: ecrit ? id : null, modifications: ctx.w.nombre, resolution,
      lignes: [...vues.values()].map((l) => ({ table: l.table, cle: l.cle, ligne: ligneSansImage(l.table, lireLigne(db, l.table, l.cle)) })),
      fiches,
    };
  } catch (e) {
    if (ouverte) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // déjà annulée par SQLite
      }
    }
    if (e instanceof ErreurEdition) throw e;
    const r = refusDe(e);
    if (r) throw erreur(r.statut, r.message);
    throw e;
  }
}
