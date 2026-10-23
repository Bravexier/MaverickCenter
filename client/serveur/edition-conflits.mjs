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
// les balises d'un mot-clé retiré, les liens de règle des métiers, les pages typées et leurs colonnes dérivées. Les sources de maîtrise d'arme
// (maitrise_arme_part, ses options, capacite_nm_gagne) ne sont jamais rejouées : le parcours saute leurs lignes, et celles des classes et des dons que
// le lot touche sont refaites par le lecteur après les choix (edition-maitrises.mjs#sourcesRefaitesParLaResolution). Une ligne source gardée au choix 2 est
// re-dérivée (ses lignes de détail suivent la règle livrée ; le corps de sa page, refait par recalculerLesPages, n'est pas touché par cette
// re-dérivation). Les fiches de personnage perdent ce qu'une suppression gardée leur retire (R42, R52, R60), avec une note datée.
//
// Exception assumée à « lecture seule quand rien n'est écrit » : l'examen (GET) écrit dans un savepoint annulé, sur la connexion du service (traiter
// est synchrone : rien d'autre ne s'intercale). Node seulement, sans dépendance.
import { createHash } from 'node:crypto';
import { ErreurJournal, lireLigne, modifierSansNoter, nouveauLot, ouvrirLot, parcourirUnLot, rompuesDuLot, rupturesEnPlace, structure } from './edition-journal.mjs';
import { ErreurEdition, OUTILS_DE_RESOLUTION as OUTILS, adaptateurDuJournal, colonneDerivee, messageSqlite, recalculerLesPages } from './edition.mjs';
import { TABLES_DES_SOURCES, sourcesAvantLaSuppression, sourcesRefaitesParLaResolution } from './edition-maitrises.mjs';
import { detacherDesFiches, noterLesRetraits, nouveauxRetraitsDeFiches, retirerDesFiches } from './fiches-retraits.mjs';
import { TABLES, ligneSansImage } from '../src/lib/edition-modele.mjs';
import { colonneMasquee, colonneSource, nomDeColonne, nomDeTable } from '../src/lib/libelles-de-la-base.mjs';
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

/**
 * Ce que les fiches perdent quand une ligne de règle part (R42, R52 ; une ressource : R60), avant sa suppression : comme les domaines de l'édition ; et
 * les sources de maîtrise d'arme d'un don ou d'une ligne de classe_maitrise_arme, notées avant elle (pas par la cascade du schéma).
 */
const RETRAITS_PAR_TABLE = Object.freeze({ metier: 'metiers', specialite: 'specialites', capacite: 'capacites', sort: 'sorts', arme: 'armes' });
function avantLaSuppression(ctx, table, cle) {
  sourcesAvantLaSuppression(ctx.db, ctx.w, table, cle);
  if (typeof cle?.id !== 'string') return;
  if (RETRAITS_PAR_TABLE[table]) retirerDesFiches(ctx.db, { [RETRAITS_PAR_TABLE[table]]: [cle.id] }, ctx.retraits);
  if (table === 'ressource') detacherDesFiches(ctx.db, [cle.id], ctx.retraits);
}

/** Le contexte d'un lot de l'édition (serveur/edition.mjs#enregistrer) : le nouveau lot ouvert dans la transaction de l'appelant. */
function contexte(db, { id, instant, pageId }) {
  return { db, w: ouvrirLot(db, { id, instant, pageId }), instant, crees: [], retraits: nouveauxRetraitsDeFiches(), operation: 0 };
}

/**
 * Parcourt les modifications en conflit du lot (edition-journal.mjs#parcourirUnLot), chacune notée dans le nouveau lot (ctx.w) quand elle passe, sauf
 * celles des sources de maîtrise d'arme (TABLES_DES_SOURCES), sautées : commeLeRejeu les refait par le lecteur. Les
 * colonnes du modèle d'une ligne du modèle sont écrites sans être notées (la suite du parcours voit la ligne telle que le site de dev l'avait), et
 * retenues (`differees` : clé de ligne → { table, cle, original, final, apercu, rangs }) : refaireParLEditeur les remet, puis les refait par l'éditeur.
 */
function parcourir(ctx, lignes, abandons = new Set()) {
  const { db } = ctx;
  const sauter = new Set([...abandons, ...lignes.filter((m) => TABLES_DES_SOURCES.includes(m.table_nom)).map((m) => m.rang)]);
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

/**
 * Comme rejouerLeJournal après le rejeu : balises d'un mot-clé retiré, liens de règle des métiers, sources de maîtrise d'arme des classes et des dons que
 * le lot touche (refaites par le lecteur, notées dans le nouveau lot), pages typées, puis leurs colonnes dérivées.
 */
function commeLeRejeu(ctx, entrees, brutes) {
  const { db } = ctx;
  const balises = OUTILS.balisesRetireesParLeLot(db, entrees.filter((e) => e.issue !== 'saute').map((e) => e.m));
  OUTILS.completerLesMetiers(db, new Set(brutes.filter((m) => m.table === 'metier' || m.table === 'metier_bonus').map((m) => m.cle?.metier_id ?? m.cle?.id)));
  sourcesRefaitesParLaResolution(db, entrees.map((e) => e.m), ctx.w);
  recalculerLesPages(db, [...brutes, ...balises]);
  OUTILS.balisesDesColonnesDerivees(db);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Le nom d'une table (lib/libelles-de-la-base.mjs : le libellé de TABLES, sinon celui du registre), ou son nom technique s'il n'en a aucun. */
const tableLisible = (table) => nomDeTable(table) ?? table;
/** Le nom d'une colonne (lib/libelles-de-la-base.mjs : le libellé du champ de TABLES, sinon celui du registre), ou son nom technique sinon. */
const libelleDeColonne = (table, c) => nomDeColonne(table, c) ?? c;

const valeurVue = (table, colonne, v) => ({ genre: 'valeur', valeur: v === undefined || v === null ? null : ligneSansImage(table, { [colonne]: v })[colonne] });
/** Une ligne pour la page : sans image entière, sans ses colonnes masquées (clés normalisées X_cle, provenance : colonneMasquee). */
function ligneVue(table, l) {
  if (!l) return null;
  return Object.fromEntries(Object.entries(ligneSansImage(table, { ...l })).filter(([c]) => !colonneMasquee(table, c)));
}
/** Une version faite d'une ligne (entière, ses valeurs écrites, ou supprimée) : ses colonnes nommées pour la page (`libelles` : colonne → nom). */
function versionDeLigne(genre, table, l) {
  const valeur = ligneVue(table, l);
  return { genre, valeur, libelles: Object.fromEntries(Object.keys(valeur ?? {}).map((c) => [c, libelleDeColonne(table, c)])) };
}
const versionDesRegles = (e) => (e.ligne ? versionDeLigne('ligne', e.table, e.ligne) : { genre: 'absente', valeur: null });
function versionDuSite(e) {
  if (e.operation === 'supprimer') return versionDeLigne('suppression', e.table, e.avant);
  return versionDeLigne(e.operation === 'inserer' ? 'ligne' : 'valeurs', e.table, e.apres);
}
/** Le nom (ou titre, libellé) d'une ligne, s'il en a un non vide. */
const nomDe = (ligne) => [ligne?.nom, ligne?.titre, ligne?.libelle].find((v) => typeof v === 'string' && v) ?? null;

/**
 * Les clés étrangères d'une table dont toutes les colonnes sont dans la clé `cle` : [{ parent, colonnes (de la table), cle (de la ligne citée) }],
 * dans l'ordre du schéma (PRAGMA foreign_key_list, table vérifiée par edition-journal.mjs#structure ; sans `to`, la clé primaire de la ligne citée).
 */
function liensDeLaCle(db, table, cle) {
  let fks;
  try {
    structure(db, table);
    fks = db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
  } catch {
    return [];
  }
  const groupes = new Map();
  for (const f of [...fks].sort((a, b) => a.id - b.id || a.seq - b.seq)) {
    if (!groupes.has(f.id)) groupes.set(f.id, { parent: f.table, de: [], vers: [] });
    groupes.get(f.id).de.push(f.from);
    groupes.get(f.id).vers.push(f.to);
  }
  const liens = [];
  for (const { parent, de, vers } of groupes.values()) {
    if (!de.every((c) => c in cle)) continue;
    let colonnes = vers;
    if (colonnes.some((c) => c === null || c === undefined)) {
      try {
        colonnes = structure(db, parent).cle;
      } catch {
        continue;
      }
    }
    if (colonnes.length !== de.length) continue;
    liens.push({ parent, colonnes: de, cle: Object.fromEntries(colonnes.map((c, i) => [c, cle[de[i]]])) });
  }
  return liens;
}

/** Un nom dans le cours d'une phrase : sa première lettre en minuscule, sauf un sigle (« AP », « IC »). */
const dansLaPhrase = (nom) => (/^\p{Lu}\p{Ll}/u.test(nom) ? `${nom[0].toLowerCase()}${nom.slice(1)}` : nom);
/** Une colonne de clé sans ligne citée : « n° N » pour un rang, sinon son nom (« ordre 900 », « option 2 ») et sa valeur, jamais du JSON. */
const colonneDeCle = (table, c, v) => (c === 'rang' ? `n° ${v}` : `${dansLaPhrase(libelleDeColonne(table, c))} ${v === null || v === undefined ? 'vide' : String(v)}`);

/**
 * Une clé composée sans `id`, dite par ce qu'elle désigne : la ligne qu'elle cite par une clé étrangère (son nom si elle existe encore — « « Amblypyge
 * de brai » », précédé de sa table entre parenthèses pour une table hors du modèle —, sinon son propre libellé, l'id de sa clé), puis ses autres
 * colonnes (« n° 1 », « option 2 ») ; sans `db`, ses colonnes seules. Jamais un nom inventé.
 */
function cleLisible(table, cle, db, profondeur) {
  const colonnes = Object.keys(cle ?? {});
  const parties = [];
  const couvertes = new Set();
  for (const lien of db && profondeur < 2 ? liensDeLaCle(db, table, cle) : []) {
    if (lien.colonnes.every((c) => couvertes.has(c))) continue;
    for (const c of lien.colonnes) couvertes.add(c);
    let ligne = null;
    try {
      ligne = lireLigne(db, lien.parent, lien.cle);
    } catch {
      ligne = null;
    }
    const nom = nomDe(ligne);
    const texte = nom && TABLES[table] ? `« ${nom} »` : `(${libelleDeLigne(lien.parent, ligne, lien.cle, db, profondeur + 1)})`;
    parties.push({ place: Math.min(...lien.colonnes.map((c) => colonnes.indexOf(c))), texte });
  }
  for (const c of colonnes) if (!couvertes.has(c)) parties.push({ place: colonnes.indexOf(c), texte: colonneDeCle(table, c, cle[c]) });
  return parties.sort((a, b) => a.place - b.place).map((p) => p.texte).join(', ');
}

/**
 * Le libellé d'une ligne pour la page : la table et le nom (ou titre, libellé) de la ligne ; une ligne qui n'en a plus (une page supprimée, dont seule
 * la version du site de dev reste) est dite par l'id de sa clé (« Page guide/le-jeu-de-role ») ; une clé composée sans `id`, par ce qu'elle désigne
 * (cleLisible, avec `db` : « Capacité de la carte « Amblypyge de brai », n° 1 », « Bonus du métier (Métier « Forgeron »), n° 1, option 2 »). Jamais
 * de JSON. La table par son nom (lib/libelles-de-la-base.mjs : le libellé de TABLES, sinon celui du registre).
 */
export function libelleDeLigne(table, ligne, cle, db = null, profondeur = 0) {
  const nom = nomDe(ligne);
  if (nom) return `${tableLisible(table)} « ${nom} »`;
  const id = cle?.id;
  if ((typeof id === 'string' && id) || typeof id === 'number') return `${tableLisible(table)} ${id}`;
  const reste = cleLisible(table, cle, db, profondeur);
  return reste ? `${tableLisible(table)} ${reste}` : tableLisible(table);
}
/** Une clé en JSON, ses colonnes triées (deux écritures de la même clé se comparent). */
const cleCanonique = (cle) => JSON.stringify(Object.fromEntries(Object.entries(cle ?? {}).sort(([a], [b]) => a.localeCompare(b))));
/**
 * Le nom d'une colonne entre guillemets (lib/libelles-de-la-base.mjs) ; une clé normalisée, par le nom de sa colonne source (« UNIQUE constraint
 * failed: metier.nom_cle » : « Nom ») ; son nom technique quand le registre ne la connaît pas.
 */
const colonneLisible = (table, c) => {
  const source = colonneMasquee(table, c) ? colonneSource(table, c) : null;
  const nom = nomDeColonne(table, c) ?? (source === null ? null : nomDeColonne(table, source));
  return nom ? `« ${nom} »` : c;
};

/** « table.colonne, table.colonne » d'un message de la base, par leurs libellés (« Sort : « Nom » »). */
const colonnesQualifiees = (texte) => {
  const parTable = new Map();
  for (const q of texte.split(', ')) {
    const m = /^([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)$/.exec(q.trim());
    if (!m) return texte;
    const nom = colonneLisible(m[1], m[2]);
    if (!(parTable.get(m[1]) ?? []).includes(nom)) parTable.set(m[1], [...(parTable.get(m[1]) ?? []), nom]);
  }
  return [...parTable].map(([t, cs]) => `${tableLisible(t)} : ${cs.join(', ')}`).join(' ; ');
};
const TYPES_LISIBLES = Object.freeze({ INTEGER: 'nombre entier', INT: 'nombre entier', REAL: 'nombre', TEXT: 'texte', BLOB: 'donnée binaire', ANY: 'valeur' });
/**
 * Un message d'écriture refusée (de la base, déjà traduit ou non par edition.mjs#messageSqlite) sans nom de table ni de colonne qualifié : « valeur
 * déjà utilisée ailleurs (Sort : « Nom ») », « valeur obligatoire (…) », « valeur refusée par une règle de la base » (sans l'expression SQL),
 * « valeur d’un type que la colonne refuse (… : nombre entier attendu) ». Un autre message est rendu tel quel.
 */
function messageLisible(message) {
  const m = messageSqlite(message);
  let r;
  if ((r = /^(valeur déjà utilisée ailleurs|valeur obligatoire) \((.+)\)$/.exec(m))) return `${r[1]} (${colonnesQualifiees(r[2])})`;
  if (/^valeur refusée par une règle de la base \(/.test(m)) return 'valeur refusée par une règle de la base';
  if ((r = /^valeur d’un type que la colonne refuse \((.+) : (\S+) attendu\)$/.exec(m))) {
    return `valeur d’un type que la colonne refuse (${colonnesQualifiees(r[1])} : ${TYPES_LISIBLES[r[2].toUpperCase()] ?? r[2]} attendu)`;
  }
  return m;
}

/** « table : clé étrangère rompue vers parent (colonnes = valeurs JSON) » (edition-journal.mjs#rompuesDuLot), lisible. */
function ruptureLisible(table, parent, colonnes, valeurs) {
  let vals;
  try {
    vals = JSON.parse(`[${valeurs}]`);
  } catch {
    return null;
  }
  const cols = colonnes.split(', ');
  if (cols.length !== vals.length) return null;
  const vers = cols.length === 1 ? `${tableLisible(parent)} ${String(vals[0])}`
    : `${tableLisible(parent)} (${cols.map((c, i) => colonneDeCle(table, c, vals[i])).join(', ')})`;
  return `${tableLisible(table)} : clé étrangère rompue vers ${vers}`;
}

/**
 * Les colonnes d'une raison « les règles ont changé … autrement », par leur nom : une colonne masquée (colonneMasquee) n'y est jamais dite ; une clé
 * normalisée l'est par sa colonne source (« nom, nom_cle » → « Nom » ; « nom_cle » seule → « Nom »), la provenance pas du tout. Le rejeu les compare
 * toutes (edition.mjs#colonneDerivee ne couvre que les colonnes refaites des pages) : la trace `raison` les garde.
 */
function colonnesChangees(table, liste) {
  const colonnes = [];
  for (const c of liste.split(', ')) {
    const dite = colonneMasquee(table, c) ? colonneSource(table, c) : c;
    if (dite !== null && !colonnes.includes(dite)) colonnes.push(dite);
  }
  return colonnes.length ? colonnes.map((c) => colonneLisible(table, c)).join(', ') : 'cette ligne';
}

/** Une partie de la raison d'un conflit (les raisons d'un abandon sont jointes par « ; »), lisible ; une forme inconnue telle quelle. */
function partieLisible(table, p) {
  let r;
  if ((r = /^les règles ont changé (.+) autrement$/.exec(p))) return `les règles ont changé ${colonnesChangees(table, r[1])} autrement`;
  if ((r = /^([a-z_][a-z0-9_]*) : clé étrangère rompue vers ([a-z_][a-z0-9_]*) \((.+?) = (.+)\)$/.exec(p))) return ruptureLisible(r[1], r[2], r[3], r[4]) ?? p;
  if ((r = /^([a-z_][a-z0-9_]*) : clé étrangère rompue vers ([a-z_][a-z0-9_]*)$/.exec(p))) return `${tableLisible(r[1])} : clé étrangère rompue vers ${tableLisible(r[2])}`;
  if ((r = /^(écriture refusée|l’édition refuse aujourd’hui cette valeur|après le lot) : (.+)$/.exec(p))) return `${r[1]} : ${messageLisible(r[2])}`;
  return p;
}

/**
 * La raison d'un conflit telle que la page la lit (`raison_lisible`) : les colonnes et les tables par leur nom (lib/libelles-de-la-base.mjs : « les
 * règles ont changé « Texte » autrement »), une clé étrangère rompue par la ligne citée (« Autre nom de la page : clé étrangère rompue vers Page
 * guide/le-mode-hyper »), un refus de la base sans nom qualifié ni expression SQL ; une forme inconnue telle quelle. `raison` reste la trace.
 */
export function raisonLisible(table, raison) {
  if (typeof raison !== 'string' || !raison) return raison ?? null;
  return raison.split(' ; ').map((p) => partieLisible(table, p)).join(' ; ');
}

/**
 * La raison du rejeu d'un lot (`detail` de ses lignes, une trace écrite par edition-journal.mjs#rejouerUneFois : « lot <id> : <table> <clé JSON> :
 * <raison> », « lot <id> : <table> : clé étrangère rompue vers <table> », « lot <id> : après le lot : … ») telle que la page la lit : sans l'id du
 * lot, la ligne dite par la légende de son conflit (ou de sa modification saine) quand le lot en a une de même table et même clé, sinon par
 * libelleDeLigne (avec `db` : ce que désigne une clé composée), la raison par raisonLisible, les tables par leur nom (lib/libelles-de-la-base.mjs).
 * `libelles` : [{ table, cle, libelle }] (les conflits puis les saines du diagnostic). Une forme inconnue est rendue telle quelle, sans l'id du
 * lot. Rien n'est écrit en base : la colonne `detail` reste la trace.
 */
export function detailLisible(detail, libelles = [], db = null) {
  if (typeof detail !== 'string' || !detail) return null;
  const texte = detail.replace(/^lot \S+ : /, '');
  const rompue = texte.match(/^([a-z_][a-z0-9_]*) : clé étrangère rompue vers ([a-z_][a-z0-9_]*)$/);
  if (rompue) return `${tableLisible(rompue[1])} : clé étrangère rompue vers ${tableLisible(rompue[2])}`;
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
    return `${connue?.libelle ?? libelleDeLigne(table, null, cle, db)} : ${raisonLisible(table, texte.slice(i + 4))}`;
  }
  return texte;
}

/** Le champ de TABLES, tel que la page le saisit (type, libellé, requis, min, max, choix ou liste de GET /api/edition/listes/, vide). */
const saisieDe = (champ) => JSON.parse(JSON.stringify(champ));

/**
 * Les conflits d'une modification du parcours, sous la forme de la page (sans `refus_1` ni les rattachements des clés étrangères) : `libelle` et
 * `raison_lisible` (raisonLisible) pour la page, `raison` comme trace.
 */
function conflitsDeLEntree(e, db) {
  const base = {
    rang: e.rang, table: e.table, cle: e.cle, operation: e.operation, libelle: libelleDeLigne(e.table, e.ligne ?? e.apres ?? e.avant, e.cle, db), raison: e.raison,
    raison_lisible: raisonLisible(e.table, e.raison),
  };
  const ligneEntiere = { colonne: null, colonne_libelle: null, avant: null, apercu: null, saisie: null };
  if (e.genre === 'colonnes') {
    return e.colonnes.map((c) => {
      const champ = TABLES[e.table]?.colonnes[c];
      const image = champ?.type === 'image';
      return {
        ...base, id: `${e.rang}:${c}`, colonne: c, colonne_libelle: libelleDeColonne(e.table, c), genre: champ ? 'champ' : 'hors_modele',
        version_1: valeurVue(e.table, c, e.apres[c]), version_2: valeurVue(e.table, c, e.ligne?.[c]), avant: valeurVue(e.table, c, e.avant?.[c]),
        apercu: e.table === 'page' && c === 'corps_md' ? e.apercu : null,
        choix_possibles: champ && !image ? [1, 2, 3] : [1, 2], saisie: champ && !image ? saisieDe(champ) : null,
      };
    });
  }
  if (e.genre === 'existe_deja') {
    return [{ ...base, ...ligneEntiere, id: `${e.rang}`, genre: 'insertion', version_1: versionDeLigne('ligne', e.table, e.apres), version_2: versionDesRegles(e), choix_possibles: [1, 2] }];
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
const abandon = (e, raison, db) => ({
  rang: e.rang, table: e.table, cle: e.cle, operation: e.operation, libelle: libelleDeLigne(e.table, e.ligne ?? e.apres ?? e.avant, e.cle, db), raison,
  raison_lisible: raisonLisible(e.table, raison),
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
  const duParcours = entrees.filter((e) => e.issue === 'conflit').flatMap((e) => conflitsDeLEntree(e, db));
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
      const texte = `l’édition refuse aujourd’hui cette valeur : ${raison}`;
      conflits.push({
        rang, table: d.table, cle: d.cle, operation: 'modifier', libelle: libelleDeLigne(d.table, e.ligne, d.cle, db), raison: texte, raison_lisible: raisonLisible(d.table, texte),
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
  for (const [rang, rs] of raisons) sortants.set(rang, abandon(entrees.find((x) => x.rang === rang), [...new Set(rs)].join(' ; '), db));
  conflits = [...conflits.filter((c) => !sortants.has(c.rang)), ...sortants.values()];
  conflits.sort((a, b) => a.rang - b.rang || String(a.colonne ?? '').localeCompare(String(b.colonne ?? '')));
  const saines = entrees.filter((e) => e.issue !== 'saute' && !sortants.has(e.rang) && (e.issue !== 'conflit' || (e.genre === 'colonnes' && e.ecrites?.length)))
    .map((e) => ({
      rang: e.rang, table: e.table, cle: e.cle, operation: e.operation, libelle: libelleDeLigne(e.table, e.ligne ?? e.apres ?? e.avant, e.cle, db),
      issue: e.issue === 'conflit' ? 'reappliquee' : ISSUES[e.issue],
      ...(e.issue === 'conflit' ? { colonnes: e.ecrites, colonnes_libelles: e.ecrites.map((c) => libelleDeColonne(e.table, c)) } : {}),
    }));
  const empreinte = createHash('sha256').update(JSON.stringify({
    lot: lot.id, saines: saines.map((s) => [s.rang, s.issue, s.colonnes ?? null]), conflits: conflits.map((c) => [c.id, c.genre, c.version_1, c.version_2, c.choix_possibles]),
  })).digest('hex').slice(0, 32);
  return {
    public: {
      lot: lot.id, fait_le: lot.fait_le, page_id: lot.page_id, resume: lot.resume, detail: lignes[0]?.detail ?? null,
      detail_lisible: detailLisible(lignes[0]?.detail ?? null, [...conflits, ...saines], db), empreinte, saines, conflits,
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
    const ids = entrees.filter((e) => e.issue === 'conflit').flatMap((e) => conflitsDeLEntree(e, db)).map((c) => c.id);
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
