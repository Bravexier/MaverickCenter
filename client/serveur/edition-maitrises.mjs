// Les sources de maîtrise d'arme et les NM de sorts gagnés, en tables de règles (migration 0073, décisions R148 à R151, R154) : maitrise_arme_part,
// maitrise_arme_part_famille et capacite_nm_gagne, que le lecteur de lib/maitrise-arme.mjs tire des lignes de classe_maitrise_arme (lireLigneDeClasse) et
// du texte des dons (capacite.effet : lireDon, nmGagnesDuDon). Une écriture de l'édition qui change ce que le lecteur lit les refait
// (serveur/edition.mjs : maîtrises d'une classe, effet d'un don, don créé ou supprimé), notées au journal par son rédacteur ; le rejeu refait celles des
// lots notés avant elles (sourcesRefaitesParLeLot, crochet `apresLeLot` de rejouerLeJournal), hors journal ; la résolution d'un lot en conflit refait
// toutes celles qu'il touche, notées dans son nouveau lot (sourcesRefaitesParLaResolution, sourcesAvantLaSuppression).
// test/maitrise-arme-sources.test.mjs rejoue le lecteur sur toute la base : ces tables doivent toujours être les siennes.
import { idDeSourceDeClasse, lireDon, lireLigneDeClasse, nmGagnesDuDon } from '../src/lib/maitrise-arme.mjs';
import { cleDe, ErreurJournal, lireLigne, structure } from './edition-journal.mjs';

/** Les tables que les sources de maîtrise d'arme remplissent (scripts/mise-a-jour-github.mjs#tablesDuLot en recopie la liste). */
export const TABLES_DES_SOURCES = Object.freeze(['maitrise_arme_part', 'maitrise_arme_part_famille', 'capacite_nm_gagne']);

/** Les familles d'armes telles que le lecteur les lit (arme_famille, dans son ordre). */
export const famillesDuLecteur = (db) => db.prepare('SELECT id, nom, maitrisable, categorie FROM arme_famille ORDER BY ordre').all();

/** Ajoute à `voulues` les lignes d'une source lue (`lu` : { parts }, ou null) : une ligne par part, une par option, comme les tables. */
function ajouterLaSource(voulues, sourceId, origine, lu) {
  for (const p of lu?.parts ?? []) {
    voulues.parts.push({ source_id: sourceId, rang: p.rang, ...origine, genre: p.genre, points: p.points, arme_famille_id: p.famille, limite_famille: p.limite });
    for (const id of p.options) voulues.options.push({ source_id: sourceId, rang: p.rang, arme_famille_id: id });
  }
}

/**
 * Les lignes de maitrise_arme_part et maitrise_arme_part_famille que donnent les lignes de classe_maitrise_arme d'une classe (`lignes`, telles qu'elles
 * sont ou seront : rang, brut, forme, nombre, arme, arme_cle, categorie, sauf_cle) : { parts, options }. Une ligne non typée ou qui ne se lit pas n'en
 * donne aucune (le lecteur la rend dans `non_lues`).
 */
export function sourcesDeLaClasse(classeId, lignes, familles) {
  const voulues = { parts: [], options: [] };
  for (const l of lignes) {
    ajouterLaSource(voulues, idDeSourceDeClasse(classeId, l.rang), { capacite_id: null, classe_id: classeId, classe_rang: l.rang }, lireLigneDeClasse(l, familles));
  }
  return voulues;
}

/** Les lignes que donne le texte d'un don (`effet`) : { parts, options, nm } (`nm` : ses NM de sorts gagnés, 0 sans ligne de capacite_nm_gagne). */
export function sourcesDuDon(capaciteId, effet, familles) {
  const voulues = { parts: [], options: [] };
  ajouterLaSource(voulues, capaciteId, { capacite_id: capaciteId, classe_id: null, classe_rang: null }, lireDon(effet, familles));
  return { ...voulues, nm: nmGagnesDuDon(effet) };
}

const cleDePart = (l) => JSON.stringify([l.source_id, l.rang]);
const cleDOption = (l) => JSON.stringify([l.source_id, l.rang, l.arme_famille_id]);

/** Les parts et options en place d'une classe (lignes de classe) ou d'un don : deux requêtes écrites ici, rien d'interpolé. */
function enPlace(db, { classeId, capaciteId }) {
  const [parts, options] = classeId
    ? ['SELECT * FROM maitrise_arme_part WHERE classe_id = ?',
      'SELECT o.* FROM maitrise_arme_part_famille o JOIN maitrise_arme_part m ON m.source_id = o.source_id AND m.rang = o.rang WHERE m.classe_id = ?']
    : ['SELECT * FROM maitrise_arme_part WHERE capacite_id = ?',
      'SELECT o.* FROM maitrise_arme_part_famille o JOIN maitrise_arme_part m ON m.source_id = o.source_id AND m.rang = o.rang WHERE m.capacite_id = ?'];
  const id = classeId ?? capaciteId;
  return { parts: db.prepare(parts).all(id).map((l) => ({ ...l })), options: db.prepare(options).all(id).map((l) => ({ ...l })) };
}

/**
 * Remplace par `voulues` ({ parts, options }) les parts d'une classe ({ classeId }) ou d'un don ({ capaciteId }), écrites par `ecrivain` (le rédacteur
 * du journal, ou ecrivainHorsJournal) ligne par ligne : une ligne absente supprimée, une nouvelle insérée, une présente modifiée seulement si elle change.
 * En deux temps, à cause des clés étrangères (base de l'édition : foreign_keys = ON ; une cascade ne serait pas notée au journal, et le rejeu, clés
 * coupées, la verrait rompue) : `retirer()` supprime les options puis les parts qui ne sont plus voulues — avant que leur ligne de classe ou leur don ne
 * parte ; `poser()` insère ou modifie les parts, puis insère les options — après que leur ligne de classe ou leur don existe.
 */
export function partsAEcrire(db, ecrivain, source, voulues) {
  const avant = enPlace(db, source);
  const partsVoulues = new Set(voulues.parts.map(cleDePart));
  const optionsVoulues = new Set(voulues.options.map(cleDOption));
  const partsEnPlace = new Map(avant.parts.map((l) => [cleDePart(l), l]));
  const optionsEnPlace = new Set(avant.options.map(cleDOption));
  return {
    retirer() {
      for (const o of avant.options) if (!optionsVoulues.has(cleDOption(o))) ecrivain.supprimer('maitrise_arme_part_famille', cleDe(db, 'maitrise_arme_part_famille', o));
      for (const p of avant.parts) if (!partsVoulues.has(cleDePart(p))) ecrivain.supprimer('maitrise_arme_part', cleDe(db, 'maitrise_arme_part', p));
    },
    poser() {
      for (const p of voulues.parts) {
        const ancienne = partsEnPlace.get(cleDePart(p));
        if (!ancienne) ecrivain.inserer('maitrise_arme_part', p);
        else {
          const { source_id: _s, rang: _r, ...reste } = p;
          ecrivain.modifier('maitrise_arme_part', cleDe(db, 'maitrise_arme_part', ancienne), reste);
        }
      }
      for (const o of voulues.options) if (!optionsEnPlace.has(cleDOption(o))) ecrivain.inserer('maitrise_arme_part_famille', o);
    },
  };
}

/** Écrit par `ecrivain` la ligne de capacite_nm_gagne d'un don : `nm` > 0, insérée ou modifiée ; 0, supprimée (R154). */
export function ecrireLesNmGagnes(db, ecrivain, capaciteId, nm) {
  const ligne = lireLigne(db, 'capacite_nm_gagne', { capacite_id: capaciteId });
  if (nm > 0 && !ligne) ecrivain.inserer('capacite_nm_gagne', { capacite_id: capaciteId, nm });
  else if (nm > 0) ecrivain.modifier('capacite_nm_gagne', { capacite_id: capaciteId }, { nm });
  else if (ligne) ecrivain.supprimer('capacite_nm_gagne', { capacite_id: capaciteId });
}

/**
 * Refait les sources d'un don qui existe (son effet tel qu'il est) : parts, options et NM gagnés. Un don absent (supprimé) perd les siennes. Pour le
 * rejeu ; l'édition écrit les mêmes lignes au fil de ses dérivations (serveur/edition.mjs).
 */
function refaireLeDon(db, ecrivain, capaciteId, familles) {
  const don = lireLigne(db, 'capacite', { id: capaciteId });
  const voulues = don ? sourcesDuDon(capaciteId, don.effet, familles) : { parts: [], options: [], nm: 0 };
  const ecritures = partsAEcrire(db, ecrivain, { capaciteId }, voulues);
  ecritures.retirer();
  ecritures.poser();
  ecrireLesNmGagnes(db, ecrivain, capaciteId, voulues.nm);
}

/** Refait les sources des lignes de classe_maitrise_arme d'une classe, telles qu'elles sont (pour le rejeu). */
function refaireLaClasse(db, ecrivain, classeId, familles) {
  const lignes = db.prepare('SELECT * FROM classe_maitrise_arme WHERE classe_id = ? ORDER BY rang').all(classeId);
  const ecritures = partsAEcrire(db, ecrivain, { classeId }, sourcesDeLaClasse(classeId, lignes, familles));
  ecritures.retirer();
  ecritures.poser();
}

/**
 * Un rédacteur qui écrit sans noter au journal (l'interface de celui d'edition-journal.mjs#ouvrirLot, pour les seules TABLES_DES_SOURCES, colonnes
 * vérifiées par structure) ; `ecrites` : chaque écriture, décodée comme une modification rejouée ({ lot, rang, table, cle, operation, avant, apres,
 * sources: true }).
 */
function ecrivainHorsJournal(db, { lot, rang }) {
  const ecrites = [];
  const colonnes = (table, valeurs) => {
    if (!TABLES_DES_SOURCES.includes(table)) throw new ErreurJournal(`${table} : pas une table des sources de maîtrise`);
    const { colonnes: connues } = structure(db, table);
    const cols = Object.keys(valeurs);
    for (const c of cols) if (!connues.includes(c)) throw new ErreurJournal(`${table} : colonne inconnue « ${c} »`);
    return cols;
  };
  const ou = (table) => structure(db, table).cle.map((c) => `"${c}" = ?`).join(' AND ');
  const noter = (table, cle, operation, avant, apres) => ecrites.push({ lot, rang, table, cle, operation, avant, apres, sources: true });
  return {
    ecrites,
    inserer(table, valeurs) {
      const cols = colonnes(table, valeurs);
      db.prepare(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => valeurs[c] ?? null));
      noter(table, cleDe(db, table, valeurs), 'inserer', null, lireLigne(db, table, valeurs));
    },
    modifier(table, cle, valeurs) {
      const avant = lireLigne(db, table, cle);
      const changees = colonnes(table, valeurs).filter((c) => (avant[c] ?? null) !== (valeurs[c] ?? null));
      if (!changees.length) return;
      const c = cleDe(db, table, cle);
      db.prepare(`UPDATE "${table}" SET ${changees.map((k) => `"${k}" = ?`).join(', ')} WHERE ${ou(table)}`).run(...changees.map((k) => valeurs[k] ?? null), ...Object.values(c));
      noter(table, c, 'modifier', Object.fromEntries(changees.map((k) => [k, avant[k]])), Object.fromEntries(changees.map((k) => [k, valeurs[k] ?? null])));
    },
    supprimer(table, cle) {
      colonnes(table, cle);
      const avant = lireLigne(db, table, cle);
      if (!avant) return;
      const c = cleDe(db, table, cle);
      db.prepare(`DELETE FROM "${table}" WHERE ${ou(table)}`).run(...Object.values(c));
      noter(table, c, 'supprimer', avant, null);
    },
  };
}

/**
 * Les sources de maîtrise d'arme qu'un lot touche (`lot` : ses modifications, telles qu'adaptées) : `classes` (dont il écrit classe.maitrise_arme ou une
 * ligne de classe_maitrise_arme), `dons` (dont il écrit la ligne capacite), `notees` (les sources dont il note des lignes de TABLES_DES_SOURCES : source_id,
 * ou capacite_id de capacite_nm_gagne). Une écriture sans effet (ancienneEcritureDuGlossaire) n'en touche aucune.
 */
function sourcesTouchees(lot) {
  const classes = new Set();
  const dons = new Set();
  const notees = new Set();
  for (const m of lot) {
    if (m.sansEffet) continue;
    let cle;
    try {
      cle = JSON.parse(m.cle);
    } catch {
      continue;
    }
    if (TABLES_DES_SOURCES.includes(m.table_nom)) notees.add(String(cle?.source_id ?? cle?.capacite_id));
    if (m.table_nom === 'classe_maitrise_arme' && typeof cle?.classe_id === 'string') classes.add(cle.classe_id);
    if (m.table_nom === 'classe' && typeof cle?.id === 'string' && m.operation === 'modifier' && 'maitrise_arme' in (JSON.parse(m.apres ?? '{}') ?? {})) classes.add(cle.id);
    if (m.table_nom === 'capacite' && typeof cle?.id === 'string') dons.add(cle.id);
  }
  return { classes, dons, notees };
}

/** Refait par `ecrivain` les sources des classes (qui existent) et des dons (qui existent ou non) donnés, lues telles qu'elles sont. */
function refaire(db, ecrivain, { classes, dons }) {
  const familles = famillesDuLecteur(db);
  for (const id of classes) if (lireLigne(db, 'classe', { id })) refaireLaClasse(db, ecrivain, id, familles);
  for (const id of dons) refaireLeDon(db, ecrivain, id, familles);
}

/**
 * Après chaque lot rejoué (serveur/edition.mjs#rejouerLeJournal, crochet `apresLeLot` d'edition-journal.mjs#rejouer, dans le lot et annulé avec lui) :
 * les sources des classes dont le lot touche les maîtrises (classe.maitrise_arme, classe_maitrise_arme) et des dons qu'il crée, modifie ou supprime
 * (capacite), refaites par le lecteur depuis les lignes rejouées. Un lot noté avant la migration 0073 (ses lignes de classe ou l'effet d'un don, sans
 * leurs parts) les reçoit ici, avant le contrôle de ses clés étrangères, et le lot suivant les trouve justes. Une source dont le lot note déjà des
 * lignes de TABLES_DES_SOURCES (un lot noté depuis 0073) suit son journal, sans rien de plus : ses lignes créées puis supprimées par un lot suivant ne
 * sont pas écrites (les « fantômes » du rejeu) ; une source qu'il touche sans en noter (un effet changé qui ne change pas les parts) ne change pas.
 * Rend ces écritures, décodées ({ …, sources: true }) : leurs tables vont dans `tablesCompletees`.
 * @param {object[]} lot les modifications du lot (lignes de `modification`, telles qu'adaptées)
 */
export function sourcesRefaitesParLeLot(db, lot) {
  const { classes, dons, notees } = sourcesTouchees(lot);
  const deLaClasse = (id) => [...notees].some((s) => s.startsWith(`${id}#maitrise-arme:`));
  const aRefaire = { classes: [...classes].filter((id) => !deLaClasse(id)).sort(), dons: [...dons].filter((id) => !notees.has(id)).sort() };
  if (!aRefaire.classes.length && !aRefaire.dons.length) return [];
  const { lot_id: lotId, rang } = lot.at(-1);
  const ecrivain = ecrivainHorsJournal(db, { lot: lotId, rang });
  refaire(db, ecrivain, aRefaire);
  return ecrivain.ecrites;
}

/**
 * Résolution d'un lot en conflit (serveur/edition-conflits.mjs, page « Mise à jour ») : ses lignes de TABLES_DES_SOURCES ne sont jamais rejouées telles
 * quelles (le parcours les saute : elles suivent leur source, comme une ligne de détail, et ne sont pas des conflits à elles), et, une fois les choix
 * écrits, toutes les sources que le lot touche — ses classes, ses dons, et celles dont il notait des lignes — sont refaites par le lecteur depuis les
 * lignes résolues, notées par `ecrivain` (le rédacteur du nouveau lot, ctx.w) : un lot noté avant 0073 (un don créé sans ses parts), une ligne gardée
 * au choix 1 sans l'éditeur (un don créé que les règles ont aussi), une source restée celle des règles, tout finit tel que le lecteur le lit.
 * @param {object[]} lot les modifications du lot en conflit (telles qu'adaptées)
 */
export function sourcesRefaitesParLaResolution(db, lot, ecrivain) {
  const { classes, dons, notees } = sourcesTouchees(lot);
  for (const s of notees) {
    const i = s.indexOf('#maitrise-arme:');
    if (i > 0) classes.add(s.slice(0, i));
    else dons.add(s);
  }
  refaire(db, ecrivain, { classes: [...classes].sort(), dons: [...dons].sort() });
}

/**
 * Avant que la résolution d'un lot en conflit ne supprime un don (capacite) ou une ligne de classe_maitrise_arme : leurs parts, options et NM gagnés,
 * retirés par `ecrivain` (notés au journal, comme serveur/edition.mjs#retirerDon et CLASSE.deriver) plutôt que par la cascade du schéma, qui ne serait
 * pas notée. Rien pour une autre table.
 */
export function sourcesAvantLaSuppression(db, ecrivain, table, cle) {
  let sourceId = null;
  if (table === 'capacite' && typeof cle?.id === 'string') sourceId = cle.id;
  else if (table === 'classe_maitrise_arme' && typeof cle?.classe_id === 'string' && Number.isInteger(cle?.rang)) sourceId = idDeSourceDeClasse(cle.classe_id, cle.rang);
  if (!sourceId) return;
  for (const o of db.prepare('SELECT * FROM maitrise_arme_part_famille WHERE source_id = ?').all(sourceId)) {
    ecrivain.supprimer('maitrise_arme_part_famille', cleDe(db, 'maitrise_arme_part_famille', o));
  }
  for (const p of db.prepare('SELECT * FROM maitrise_arme_part WHERE source_id = ?').all(sourceId)) ecrivain.supprimer('maitrise_arme_part', cleDe(db, 'maitrise_arme_part', p));
  if (table === 'capacite') ecrireLesNmGagnes(db, ecrivain, sourceId, 0);
}
