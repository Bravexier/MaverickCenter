// Fiches de personnage et règles supprimées (décision R42 ; docs/serveur.md, « Fiches de personnage (R42) ») : un don, une spécialité (avec les dons
// choisis qui en dépendent), un sort (avec son livre, décision R169), un métier, une arme (décision R52) ou le don obtenu d'un don « Variable » du Mage
// Bleu (décision R181 : l'entrée du tableau, ou le don « Variable », supprimés) que les règles suppriment est RETIRÉ des fiches qui l'utilisent — la fiche reste, seul l'élément part —
// et une ligne datée par élément s'ajoute à la fin de ses notes (« NOTE », cellule BA53 ; texte : src/lib/fiche-format.mjs#ligneDeRetrait). Deux moments :
//   - le site de dev supprime une ligne de règle (serveur/edition.mjs : métier, spécialité, don) : retirerDesFiches, AVANT la suppression de la règle
//     (clés étrangères contrôlées), noms lus dans la base avant qu'elle ne parte ;
//   - une livraison refait la base vivante (serveur/base-vivante.mjs#transferer) : retirerLesManquants, APRÈS le rejeu du journal (un lot suivant peut
//     créer ce qu'une fiche cite) et avant le contrôle des clés, noms lus dans l'ancienne base attachée (`ancienne`).
// L'armure de la décision R165 (une armure et son « élément » d'avant, une armure « Familier », une armure élémentaire d'une magie absente, une armure
// trop lourde) : retirerLesArmuresHorsRegle, à la reconstruction (après retirerLesManquants) et à l'enregistrement d'une fiche (serveur/fiches.mjs).
// Puis noterLesRetraits écrit les notes, une seule fois par fiche. Un élément seulement modifié (renommé…) ne touche pas les fiches : elles n'en gardent
// que l'identifiant, qui ne change jamais (migration 0006). Une race, une classe ou une magie disparue n'est pas retirée ici (non tranché : la
// reconstruction reste bloquée), ni un don, une spécialité ou un sort dont la classe ou la magie a disparu (un sort d'une magie supprimée chez un
// Potentiel Illimité, un don d'une classe supprimée sur une fiche qui n'a pas la classe) : sa clé reste rompue et bloque la reconstruction.
// Les écritures dans les fiches se font en SQL direct, jamais par le rédacteur du journal (serveur/edition-journal.mjs#ouvrirLot, qui les refuse) : les
// fiches ne vont ni au journal, ni dans data/rows. Elles restent dans la transaction de l'appelant (un lot refusé, une reconstruction bloquée les annulent).
// Node seulement, sans dépendance : n'importe que le format des fiches (ni edition.mjs ni base-vivante.mjs, qui l'importent).
import {
  ajouterAuxNotes, armureTransformee, COLONNES_DE_L_ARMURE_DE_BASE, COLONNES_DE_L_ARMURE_ELEMENTAIRE, descriptionDuRetrait, ligneDeRetrait, ordreDesRetraits,
  partiesEnTexte, POIDS_DES_ARMURES, POIDS_PORTABLE_MAX, TYPE_FAMILIER, valeurDuPoids,
} from '../src/lib/fiche-format.mjs';

/**
 * Les clés étrangères des fiches (section 13) vers les règles qu'un retrait concerne, et ce qu'on fait de la ligne qui cite : `vider` (la colonne passe à
 * NULL : le métier ; la spécialité, dont la ligne de classe reste) ou `supprimer` (la ligne part : un don choisi, un sort). `cle` : de quoi désigner la
 * ligne de fiche. Le test serveur-fiches-retraits les compare au schéma (une clé de plus vers ces tables doit être ajoutée ici).
 */
export const RETRAITS = Object.freeze([
  Object.freeze({ table: 'personnage', colonnes: Object.freeze(['metier_id']), vise: 'metier', action: 'vider', colonne: 'metier_id', cle: Object.freeze(['id']) }),
  Object.freeze({
    table: 'personnage_classe', colonnes: Object.freeze(['specialite_id', 'classe_id']), vise: 'specialite', action: 'vider', colonne: 'specialite_id',
    cle: Object.freeze(['personnage_id', 'rang']),
  }),
  Object.freeze({ table: 'personnage_capacite', colonnes: Object.freeze(['capacite_id']), vise: 'capacite', action: 'supprimer', cle: Object.freeze(['personnage_id', 'capacite_id']) }),
  // le don obtenu d'un don « Variable » (décision R181, migration 0088 ; les deux clés sont sans ON DELETE) : il part avec l'entrée du tableau qu'il
  // obtient, ou avec le don « Variable » qui l'obtient (nommé sur sa ligne à lui : donsObtenusDesDons)
  Object.freeze({
    table: 'personnage_don_obtenu', colonnes: Object.freeze(['entree_id']), vise: 'classe_annexe_entree', action: 'supprimer', cle: Object.freeze(['personnage_id', 'entree_id']),
  }),
  Object.freeze({ table: 'personnage_don_obtenu', colonnes: Object.freeze(['source']), vise: 'capacite', action: 'supprimer', cle: Object.freeze(['personnage_id', 'source']) }),
  Object.freeze({ table: 'personnage_sort', colonnes: Object.freeze(['sort_id']), vise: 'sort', action: 'supprimer', cle: Object.freeze(['personnage_id', 'sort_id']) }),
  // le livre d'un sort (décision R169, migration 0082 : sur un sort de la liste ou non) part avec le sort, nommé sur sa ligne (la clé n'a pas d'ON DELETE)
  Object.freeze({ table: 'personnage_livre_sort', colonnes: Object.freeze(['sort_id']), vise: 'sort', action: 'supprimer', cle: Object.freeze(['personnage_id', 'sort_id']) }),
  // une arme supprimée (décision R52, comme R42) : son emplacement (arme 1 ou 2) part, avec sa composition et son amélioration ; une arme élémentaire
  // (arme_id NULL, décision R167, migration 0081) n'est jamais visée : elle ne se supprime pas sur le site de dev (sa source est la page « Pièces élémentaires »)
  Object.freeze({ table: 'personnage_arme', colonnes: Object.freeze(['arme_id']), vise: 'arme', action: 'supprimer', cle: Object.freeze(['personnage_id', 'rang']) }),
]);

/**
 * Le numéro de chaque fiche de joueur, qui ne dépend pas de la réponse : Map(id de fiche → k), k = son rang parmi TOUTES les fiches de joueur de la base
 * (`main`), par date de création puis identifiant. La même fiche porte donc le même numéro dans l'état de la page d'une classe (infobulle, confirmation),
 * dans la réponse du lot et dans /api/etat ; une fiche créée plus tard prend le numéro suivant, et seule la suppression d'une fiche de joueur plus ancienne
 * décale les suivantes.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function numerosDesFichesDeJoueur(db) {
  return new Map(db.prepare("SELECT id FROM main.personnage WHERE nature = 'joueur' ORDER BY cree_le, id").all().map((r, i) => [r.id, i + 1]));
}

/**
 * Le libellé d'une fiche de personnage que l'édition peut montrer : le nom d'un prétiré (visible par tous), « fiche de joueur n° k » pour une fiche de
 * joueur (son nom n'est montré qu'à ceux qui peuvent la lire : v_personnage_visible ; le service ne la liste ni ne la lit, serveur/fiches.mjs). `numeros` :
 * numerosDesFichesDeJoueur(db), lu dans la base qui contient la fiche.
 */
export function libelleDeFiche(r, numeros) {
  if (r.nature === 'pretire') return r.nom;
  const k = numeros.get(r.personnage);
  if (k === undefined) throw new Error(`fiche de joueur « ${r.personnage} » absente des numéros (numerosDesFichesDeJoueur)`);
  return `fiche de joueur n° ${k}`;
}
const anonymes = (a) => a.startsWith('fiche de joueur n° ');
/** Ordre des libellés : les prétirés dans l'ordre alphabétique, puis les fiches de joueur. */
export const ordreDesLibelles = (a, b) => anonymes(a) - anonymes(b) || a.localeCompare(b, 'fr', { numeric: true });

/** L'accumulateur des retraits d'un lot ou d'une reconstruction : Map(id de fiche → { personnage, nom, nature, retraits: [descripteurs] }). */
export const nouveauxRetraitsDeFiches = () => new Map();

const parNom = (a, b) => a.localeCompare(b, 'fr', { numeric: true });
const aLaTable = (db, table) => !!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type = 'table' AND name = ?").get(table);
const champsDeFiche = 'p.id AS personnage, p.nom AS fiche, p.nature';

/**
 * Les sorts des fiches (`main`) et leurs livres (décision R169, migration 0082 : personnage_livre_sort, un livre sur un sort de la liste ou non), une
 * ligne par (fiche, sort) qui a l'un ou l'autre : personnage_id, sort_id, niveau_maitrise (null sans le sort dans la liste), choisi (0 ou 1), livre
 * (0 ou 1), ordre (le rang dans la liste, après elle le rang du livre). `ou` (« WHERE sort_id = :sort », paramètre nommé : il sert aux deux tables)
 * restreint les deux. Une base d'avant la migration 0082 (le service peut y retomber : serveur/fiches.mjs) n'a pas la table : le livre est alors la
 * colonne nm_livre de la ligne du sort.
 */
function sortsEtLivres(db, ou = '') {
  if (!aLaTable(db, 'personnage_livre_sort')) {
    const livre = db.prepare('PRAGMA main.table_info(personnage_sort)').all().some((c) => c.name === 'nm_livre') ? 'nm_livre = 1' : '0';
    return `SELECT personnage_id, sort_id, niveau_maitrise, 1 AS choisi, ${livre} AS livre, rang AS ordre FROM main.personnage_sort ${ou}`;
  }
  return `SELECT personnage_id, sort_id, max(niveau_maitrise) AS niveau_maitrise, max(choisi) AS choisi, max(livre) AS livre, min(ordre) AS ordre FROM (
      SELECT personnage_id, sort_id, niveau_maitrise, 1 AS choisi, 0 AS livre, rang AS ordre FROM main.personnage_sort ${ou}
      UNION ALL SELECT personnage_id, sort_id, NULL, 0, 1, 1000000 + rang FROM main.personnage_livre_sort ${ou})
    GROUP BY personnage_id, sort_id`;
}

/** Le descripteur du retrait d'un sort (sortsEtLivres, nom, magie, NPM) : ses NM sur la fiche, et son livre, qui part avec lui (décision R169). */
const descripteurDuSort = (s) => ({
  nature: 'sort', id: s.id, nom: s.nom ?? null, magie: s.magie ?? null, npm: s.npm ?? null, nm: s.choisi ? s.niveau_maitrise ?? null : null,
  livre: Boolean(s.livre), choisi: Boolean(s.choisi),
});

/**
 * Le descripteur du retrait d'un don obtenu (décision R181 ; fiche-format.mjs#descriptionDuRetrait, nature « don_obtenu ») : l'entrée (`id`, `nom`), le
 * don « Variable » qui l'obtenait (`don`), la classe et la magie de sa ligne ; `cas` : 'entree' (l'entrée supprimée) ou 'don' (le don supprimé).
 */
const descripteurDuDonObtenu = (o, cas) => ({
  nature: 'don_obtenu', id: o.entree_id, nom: o.nom ?? null, don: o.don ?? null, classe: o.classe ?? null, magie: o.magie ?? null, cas,
});

/**
 * Site de dev : les dons obtenus (décision R181, personnage_don_obtenu) que les dons « Variable » donnés font obtenir aux fiches, à retirer avec eux :
 * une ligne par fiche et par don, l'entrée nommée (nom, classe, magie de sa ligne) et le don qui l'obtenait. La fiche n'a pas forcément le don dans ses
 * dons choisis (Mimétisme et Ultime raison s'obtiennent d'office ; un choix gardé sans effet, R181) : une ligne de note à elle, cas « don ». Rien sans la
 * table (une base vivante d'avant la migration 0088).
 */
function donsObtenusDesDons(db, capacites) {
  if (!capacites.length || !aLaTable(db, 'personnage_don_obtenu')) return [];
  return db.prepare(`SELECT ${champsDeFiche}, o.source, o.entree_id, e.nom, k.nom AS don, c.nom AS classe, m.nom AS magie
    FROM main.personnage_don_obtenu o JOIN main.personnage p ON p.id = o.personnage_id
    LEFT JOIN main.capacite k ON k.id = o.source
    LEFT JOIN main.classe_annexe_entree e ON e.id = o.entree_id
    LEFT JOIN main.classe c ON c.id = e.classe_id
    LEFT JOIN main.classe_annexe x ON x.classe_id = e.classe_id AND x.rang = e.annexe_rang
    LEFT JOIN main.magie m ON m.id = x.magie_id
    WHERE o.source IN (SELECT value FROM json_each(?)) ORDER BY p.id, o.source`).all(JSON.stringify(capacites))
    .map((o) => ({ ...o, vise: 'classe_annexe_entree', cle: [o.personnage, o.entree_id], descripteur: descripteurDuDonObtenu(o, 'don') }));
}

/**
 * Applique les retraits collectés (SQL direct, dans `main`) et range leurs descripteurs dans `acc`. Une entrée sans descripteur (un don qui part avec sa
 * spécialité, nommé sur la ligne de celle-ci) est retirée sans ligne de note à elle.
 * @param {{ personnage: string, fiche: string, nature: string, vise: string, cle: unknown[], descripteur: object | null }[]} aRetirer
 */
function appliquer(db, aRetirer, acc) {
  for (const l of aRetirer) {
    // chaque table qui cite l'élément (un sort : sa ligne de la liste et son livre, R169) ; une table qu'une base d'avant n'a pas encore est passée
    for (const r of RETRAITS.filter((x) => x.vise === l.vise && aLaTable(db, x.table))) {
      const ou = r.cle.map((c) => `"${c}" = ?`).join(' AND ');
      const sql = r.action === 'vider' ? `UPDATE main."${r.table}" SET "${r.colonne}" = NULL WHERE ${ou}` : `DELETE FROM main."${r.table}" WHERE ${ou}`;
      db.prepare(sql).run(...l.cle);
    }
    // le métier retiré emporte les bonus « A OU B » que la fiche y avait choisis (personnage_metier_bonus : rang dans metier_bonus de SON métier)
    if (l.vise === 'metier' && aLaTable(db, 'personnage_metier_bonus')) db.prepare('DELETE FROM main.personnage_metier_bonus WHERE personnage_id = ?').run(l.personnage);
    if (!l.descripteur) continue;
    let e = acc.get(l.personnage);
    if (!e) acc.set(l.personnage, (e = { personnage: l.personnage, nom: l.fiche, nature: l.nature, retraits: [] }));
    if (!e.retraits.some((d) => d.nature === l.descripteur.nature && d.id === l.descripteur.id)) e.retraits.push(l.descripteur);
  }
  return acc;
}

/**
 * Site de dev : retire des fiches les métiers, spécialités, dons et sorts donnés, qui vont être supprimés des règles (à appeler AVANT leur suppression :
 * leurs noms sont lus ici, et les clés étrangères sont contrôlées). Une spécialité donnée avec ses dons (SPECIALITE.supprimer) : une seule ligne par
 * fiche, qui nomme les dons de la spécialité que la fiche avait ; un de ces dons choisi sans la spécialité (fiche non conforme) a sa ligne à lui.
 * Toutes les fiches comptent, quelle que soit leur nature (requêtes sur personnage, pas serveur/fiches.mjs#lireFiche qui ne lit que les prétirés).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ metiers?: string[], specialites?: string[], capacites?: string[], sorts?: string[] }} cibles
 * @param {Map} acc nouveauxRetraitsDeFiches()
 */
export function retirerDesFiches(db, { metiers = [], specialites = [], capacites = [], sorts = [], armes = [] } = {}, acc = nouveauxRetraitsDeFiches()) {
  const aRetirer = [];
  const capacitesDonnees = new Set(capacites);
  const regroupes = new Set(); // `${fiche}\u0000${don}` : dons nommés sur la ligne de leur spécialité
  for (const id of specialites) {
    const s = db.prepare('SELECT s.id, s.nom, s.classe_id, c.nom AS classe FROM main.specialite s LEFT JOIN main.classe c ON c.id = s.classe_id WHERE s.id = ?').get(id);
    if (!s) continue;
    for (const f of db.prepare(`SELECT ${champsDeFiche}, pc.rang FROM main.personnage_classe pc JOIN main.personnage p ON p.id = pc.personnage_id
      WHERE pc.specialite_id = ? AND pc.classe_id = ?`).all(s.id, s.classe_id)) {
      const dons = db.prepare(`SELECT k.id, k.nom FROM main.personnage_capacite pc JOIN main.capacite k ON k.id = pc.capacite_id
        WHERE pc.personnage_id = ? AND k.specialite_id = ?`).all(f.personnage, s.id).filter((k) => capacitesDonnees.has(k.id));
      for (const k of dons) regroupes.add(`${f.personnage}\u0000${k.id}`);
      aRetirer.push({ ...f, vise: 'specialite', cle: [f.personnage, f.rang],
        descripteur: { nature: 'specialite', id: s.id, nom: s.nom, classe: s.classe ?? null, dons: dons.map((k) => k.nom).sort(parNom) } });
    }
  }
  for (const id of capacites) {
    const k = db.prepare(`SELECT k.id, k.nom, k.niveau, c.nom AS classe, s.nom AS specialite FROM main.capacite k LEFT JOIN main.classe c ON c.id = k.classe_id
      LEFT JOIN main.specialite s ON s.id = k.specialite_id WHERE k.id = ?`).get(id);
    if (!k) continue;
    for (const f of db.prepare(`SELECT ${champsDeFiche} FROM main.personnage_capacite pc JOIN main.personnage p ON p.id = pc.personnage_id WHERE pc.capacite_id = ?`).all(k.id)) {
      aRetirer.push({ ...f, vise: 'capacite', cle: [f.personnage, k.id], descripteur: regroupes.has(`${f.personnage}\u0000${k.id}`) ? null
        : { nature: 'capacite', id: k.id, nom: k.nom, classe: k.classe ?? null, specialite: k.specialite ?? null, niveau: k.niveau ?? null } });
    }
  }
  // le don obtenu par un don « Variable » qui part (décision R181), que la fiche ait le don dans ses choix ou non
  aRetirer.push(...donsObtenusDesDons(db, capacites));
  for (const id of sorts) {
    const s = db.prepare('SELECT s.id, s.nom, s.niveau, m.nom AS magie FROM main.sort s LEFT JOIN main.magie m ON m.id = s.magie_id WHERE s.id = ?').get(id);
    if (!s) continue;
    // les fiches qui ont le sort dans leur liste, ou son livre seul (décision R169)
    for (const f of db.prepare(`SELECT ${champsDeFiche}, x.niveau_maitrise, x.choisi, x.livre FROM (${sortsEtLivres(db, 'WHERE sort_id = :sort')}) x
      JOIN main.personnage p ON p.id = x.personnage_id ORDER BY p.id`).all({ sort: s.id })) {
      aRetirer.push({ ...f, vise: 'sort', cle: [f.personnage, s.id], descripteur: descripteurDuSort({ ...f, id: s.id, nom: s.nom, magie: s.magie, npm: s.niveau }) });
    }
  }
  for (const id of metiers) {
    const m = db.prepare('SELECT id, nom FROM main.metier WHERE id = ?').get(id);
    if (!m) continue;
    for (const f of db.prepare(`SELECT ${champsDeFiche} FROM main.personnage p WHERE p.metier_id = ?`).all(m.id)) {
      aRetirer.push({ ...f, vise: 'metier', cle: [f.personnage], descripteur: { nature: 'metier', id: m.id, nom: m.nom } });
    }
  }
  for (const id of armes) {
    const a = db.prepare('SELECT a.id, a.nom, f.nom AS famille FROM main.arme a LEFT JOIN main.arme_famille f ON f.id = a.famille_id WHERE a.id = ?').get(id);
    if (!a) continue;
    for (const f of db.prepare(`SELECT ${champsDeFiche}, pa.rang FROM main.personnage_arme pa JOIN main.personnage p ON p.id = pa.personnage_id WHERE pa.arme_id = ?`).all(a.id)) {
      aRetirer.push({ ...f, vise: 'arme', cle: [f.personnage, f.rang], descripteur: { nature: 'arme', id: a.id, nom: a.nom, famille: a.famille ?? null, rang: f.rang } });
    }
  }
  return appliquer(db, aRetirer, acc);
}

/**
 * Les tables des fiches dont un objet peut citer une ressource du catalogue (« INVENTAIRE | SAC », la ceinture : `ressource_id` quand l'objet est au
 * catalogue, sinon le nom seul), et le mot qui situe l'objet dans la note. Un composant supprimé des règles (page « Composants ») n'y est pas retiré :
 * l'objet reste dans la fiche, sous son nom, seul son lien au catalogue part (`ressource_id` = NULL), et une ligne datée le dit dans les notes
 * (décision R60 : « objet supprimé de la base, veuillez la mettre à jour » ; lib/fiche-format.mjs#ligneDeRetrait).
 */
export const OBJETS_AU_CATALOGUE = Object.freeze({ personnage_inventaire: 'inventaire', personnage_ceinture: 'ceinture' });

/** Détache les objets trouvés par `sql` (personnage, rang, nom, id de la ressource) et range leur descripteur dans `acc`, une fois par fiche, objet et emplacement. */
function detacher(db, table, lignes, acc) {
  const emplacement = OBJETS_AU_CATALOGUE[table];
  for (const l of lignes) {
    db.prepare(`UPDATE main."${table}" SET ressource_id = NULL WHERE personnage_id = ? AND rang = ?`).run(l.personnage, l.rang);
    let e = acc.get(l.personnage);
    if (!e) acc.set(l.personnage, (e = { personnage: l.personnage, nom: l.fiche, nature: l.nature, retraits: [] }));
    if (!e.retraits.some((d) => d.nature === 'objet' && d.id === l.id && d.emplacement === emplacement)) {
      e.retraits.push({ nature: 'objet', id: l.id, nom: l.objet, emplacement });
    }
  }
  return acc;
}

/** Site de dev : détache des fiches les ressources données, qui vont être supprimées des règles (à appeler AVANT leur suppression), avec une note (R60). */
export function detacherDesFiches(db, ressources = [], acc = nouveauxRetraitsDeFiches()) {
  for (const table of Object.keys(OBJETS_AU_CATALOGUE)) {
    if (!aLaTable(db, table)) continue;
    for (const id of ressources) {
      detacher(db, table, db.prepare(`SELECT ${champsDeFiche}, x.rang, x.nom AS objet, x.ressource_id AS id FROM main."${table}" x
        JOIN main.personnage p ON p.id = x.personnage_id WHERE x.ressource_id = ? ORDER BY p.id, x.rang`).all(id), acc);
    }
  }
  return acc;
}

/** Reconstruction de la base vivante : détache des fiches les ressources absentes des nouvelles règles, avec une note (R60, OBJETS_AU_CATALOGUE). */
function detacherLesManquantes(db, acc) {
  for (const table of Object.keys(OBJETS_AU_CATALOGUE)) {
    if (!aLaTable(db, table)) continue;
    detacher(db, table, db.prepare(`SELECT ${champsDeFiche}, x.rang, x.nom AS objet, x.ressource_id AS id FROM main."${table}" x
      JOIN main.personnage p ON p.id = x.personnage_id
      WHERE x.ressource_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM main.ressource r WHERE r.id = x.ressource_id) ORDER BY p.id, x.rang`).all(), acc);
  }
}

/**
 * Reconstruction de la base vivante (base-vivante.mjs#transferer, l'ancienne base attachée sous `ancienne`, clés étrangères coupées) : retire de `main`
 * les lignes de fiche dont le métier, la spécialité (couple spécialité, classe), le don ou le sort manque dans les nouvelles règles. Une spécialité ou un
 * don dont la classe a disparu, un sort dont la magie a disparu (classe et magie lues dans l'ancienne base) ne sont pas touchés : la classe ou la magie
 * disparue bloque la reconstruction (hors R42), par la clé de la fiche restée rompue. Les noms se lisent dans l'ancienne base (celui de la classe,
 * de la spécialité d'un don et de la magie d'un sort dans les nouvelles règles quand elles l'ont encore : un renommage livré en même temps l'emporte) ;
 * à défaut, l'identifiant. Les colonnes lues dans l'ancienne base (nom, classe_id, specialite_id, niveau, magie_id) existent dans toute base vivante
 * (schéma de la migration 0011, qui crée les fiches). Un don choisi qui dépendait d'une spécialité retirée à la même fiche est nommé sur la ligne de
 * celle-ci.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Map} acc nouveauxRetraitsDeFiches()
 */
export function retirerLesManquants(db, acc = nouveauxRetraitsDeFiches()) {
  const aRetirer = [];
  // spécialités : la classe existe encore, le couple (spécialité, classe) n'existe plus
  const specialites = db.prepare(`SELECT ${champsDeFiche}, pc.rang, pc.specialite_id AS id, pc.classe_id, a.nom AS nom, coalesce(mc.nom, ac.nom) AS classe
    FROM main.personnage_classe pc JOIN main.personnage p ON p.id = pc.personnage_id
    LEFT JOIN ancienne.specialite a ON a.id = pc.specialite_id
    LEFT JOIN main.classe mc ON mc.id = pc.classe_id
    LEFT JOIN ancienne.classe ac ON ac.id = pc.classe_id
    WHERE pc.specialite_id IS NOT NULL AND EXISTS (SELECT 1 FROM main.classe c WHERE c.id = pc.classe_id)
      AND NOT EXISTS (SELECT 1 FROM main.specialite s WHERE s.id = pc.specialite_id AND s.classe_id = pc.classe_id)
    ORDER BY p.id, pc.rang`).all();
  // dons : absents des nouvelles règles, leur classe présente
  const dons = db.prepare(`SELECT ${champsDeFiche}, pc.capacite_id AS id, a.nom AS nom, a.niveau AS niveau, a.specialite_id AS specialite_id, coalesce(mc.nom, ac.nom) AS classe,
      coalesce(ms.nom, asp.nom) AS specialite
    FROM main.personnage_capacite pc JOIN main.personnage p ON p.id = pc.personnage_id
    LEFT JOIN ancienne.capacite a ON a.id = pc.capacite_id
    LEFT JOIN main.classe mc ON mc.id = a.classe_id
    LEFT JOIN ancienne.classe ac ON ac.id = a.classe_id
    LEFT JOIN main.specialite ms ON ms.id = a.specialite_id
    LEFT JOIN ancienne.specialite asp ON asp.id = a.specialite_id
    WHERE NOT EXISTS (SELECT 1 FROM main.capacite k WHERE k.id = pc.capacite_id) AND EXISTS (SELECT 1 FROM main.classe c WHERE c.id = a.classe_id)
    ORDER BY p.id, pc.capacite_id`).all();
  const regroupes = new Set();
  for (const s of specialites) {
    const siens = dons.filter((k) => k.personnage === s.personnage && k.specialite_id === s.id);
    for (const k of siens) regroupes.add(`${k.personnage}\u0000${k.id}`);
    aRetirer.push({ ...s, vise: 'specialite', cle: [s.personnage, s.rang],
      descripteur: { nature: 'specialite', id: s.id, nom: s.nom ?? null, classe: s.classe ?? null, dons: siens.map((k) => k.nom ?? k.id).sort(parNom) } });
  }
  for (const k of dons) {
    aRetirer.push({ ...k, vise: 'capacite', cle: [k.personnage, k.id], descripteur: regroupes.has(`${k.personnage}\u0000${k.id}`) ? null
      : { nature: 'capacite', id: k.id, nom: k.nom ?? null, classe: k.classe ?? null, specialite: k.specialite ?? null, niveau: k.niveau ?? null } });
  }
  // sorts : absents des nouvelles règles, leur magie présente
  // (un sort de la liste ou le livre seul d'un sort, décision R169 : le livre part avec le sort)
  for (const s of db.prepare(`SELECT ${champsDeFiche}, ps.sort_id AS id, ps.niveau_maitrise, ps.choisi, ps.livre, a.nom AS nom, a.niveau AS npm,
      coalesce(mm.nom, am.nom) AS magie
    FROM (${sortsEtLivres(db)}) ps JOIN main.personnage p ON p.id = ps.personnage_id
    LEFT JOIN ancienne.sort a ON a.id = ps.sort_id
    LEFT JOIN main.magie mm ON mm.id = a.magie_id
    LEFT JOIN ancienne.magie am ON am.id = a.magie_id
    WHERE NOT EXISTS (SELECT 1 FROM main.sort x WHERE x.id = ps.sort_id) AND EXISTS (SELECT 1 FROM main.magie m WHERE m.id = a.magie_id)
    ORDER BY p.id, ps.ordre, ps.sort_id`).all()) {
    aRetirer.push({ ...s, vise: 'sort', cle: [s.personnage, s.id], descripteur: descripteurDuSort(s) });
  }
  // métiers : absents des nouvelles règles
  for (const m of db.prepare(`SELECT ${champsDeFiche}, p.metier_id AS id, a.nom AS nom
    FROM main.personnage p LEFT JOIN ancienne.metier a ON a.id = p.metier_id
    WHERE p.metier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM main.metier x WHERE x.id = p.metier_id)
    ORDER BY p.id`).all()) {
    aRetirer.push({ ...m, vise: 'metier', cle: [m.personnage], descripteur: { nature: 'metier', id: m.id, nom: m.nom ?? null } });
  }
  // armes : absentes des nouvelles règles (décision R52) ; nom et famille lus dans l'ancienne base ; une arme élémentaire (arme_id NULL, décision R167)
  // n'est pas une arme du catalogue : une arme élémentaire disparue reste une clé rompue, qui bloque (comme une magie)
  for (const a of db.prepare(`SELECT ${champsDeFiche}, pa.rang, pa.arme_id AS id, x.nom AS nom, f.nom AS famille
    FROM main.personnage_arme pa JOIN main.personnage p ON p.id = pa.personnage_id
    LEFT JOIN ancienne.arme x ON x.id = pa.arme_id
    LEFT JOIN ancienne.arme_famille f ON f.id = x.famille_id
    WHERE pa.arme_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM main.arme y WHERE y.id = pa.arme_id)
    ORDER BY p.id, pa.rang`).all()) {
    aRetirer.push({ ...a, vise: 'arme', cle: [a.personnage, a.rang], descripteur: { nature: 'arme', id: a.id, nom: a.nom ?? null, famille: a.famille ?? null, rang: a.rang } });
  }
  aRetirer.push(...donsObtenusManquants(db));
  // composants : l'objet reste sous son nom, sans lien au catalogue, avec une note (R60, OBJETS_AU_CATALOGUE)
  detacherLesManquantes(db, acc);
  return appliquer(db, aRetirer, acc);
}

/**
 * Reconstruction de la base vivante (retirerLesManquants) : les dons obtenus (décision R181, personnage_don_obtenu) dont l'entrée du tableau (cas
 * « entree ») ou le don « Variable » (cas « don ») manque dans les nouvelles règles, leur classe présente ; une classe disparue bloque la reconstruction
 * (hors R42), comme pour un don. Une ligne par fiche et par entrée : l'entrée disparue l'emporte sur le don disparu. Noms lus dans les nouvelles règles,
 * sinon dans l'ancienne base. Rien quand l'ancienne base n'a pas la table (avant la migration 0088 : aucune ligne n'a été recopiée).
 */
function donsObtenusManquants(db) {
  const ancienne = (t) => !!db.prepare("SELECT 1 FROM ancienne.sqlite_master WHERE type = 'table' AND name = ?").get(t);
  if (!aLaTable(db, 'personnage_don_obtenu') || !['personnage_don_obtenu', 'classe_annexe_entree', 'classe_annexe'].every(ancienne)) return [];
  return db.prepare(`SELECT ${champsDeFiche}, o.source, o.entree_id, coalesce(me.nom, ae.nom) AS nom, coalesce(mk.nom, ak.nom) AS don,
      coalesce(mc.nom, ac.nom) AS classe, coalesce(mm.nom, am.nom) AS magie,
      CASE WHEN me.id IS NULL THEN 'entree' ELSE 'don' END AS cas
    FROM main.personnage_don_obtenu o JOIN main.personnage p ON p.id = o.personnage_id
    LEFT JOIN main.classe_annexe_entree me ON me.id = o.entree_id
    LEFT JOIN ancienne.classe_annexe_entree ae ON ae.id = o.entree_id
    LEFT JOIN main.capacite mk ON mk.id = o.source
    LEFT JOIN ancienne.capacite ak ON ak.id = o.source
    LEFT JOIN main.classe mc ON mc.id = coalesce(me.classe_id, ae.classe_id)
    LEFT JOIN ancienne.classe ac ON ac.id = coalesce(me.classe_id, ae.classe_id)
    LEFT JOIN ancienne.classe_annexe ax ON ax.classe_id = ae.classe_id AND ax.rang = ae.annexe_rang
    LEFT JOIN main.classe_annexe mx ON mx.classe_id = me.classe_id AND mx.rang = me.annexe_rang
    LEFT JOIN main.magie mm ON mm.id = coalesce(mx.magie_id, ax.magie_id)
    LEFT JOIN ancienne.magie am ON am.id = coalesce(mx.magie_id, ax.magie_id)
    WHERE (me.id IS NULL AND EXISTS (SELECT 1 FROM main.classe c WHERE c.id = ae.classe_id))
       OR (me.id IS NOT NULL AND mk.id IS NULL AND EXISTS (SELECT 1 FROM main.classe c WHERE c.id = ak.classe_id))
    ORDER BY p.id, o.source`).all()
    .map((o) => ({ ...o, vise: 'classe_annexe_entree', cle: [o.personnage, o.entree_id], descripteur: descripteurDuDonObtenu(o, o.cas) }));
}

/**
 * Décision R165 (pièce élémentaire posée sur une armure) : l'armure d'une fiche qui ne suit pas les règles en est retirée, une ligne datée dans ses notes
 * (descripteurs rangés dans `acc`, écrits par noterLesRetraits ; SQL direct dans `main`, comme les retraits de R42), dans cet ordre (celui de la migration
 * 0080) :
 *   1. une armure ET une armure élémentaire (une fiche d'avant : l'« élément » posé sur l'armure, R95) : « l'élément devient l'armure, avec l'amélioration
 *      de l'élément » (R165 (8)) ; l'armure d'origine, son amélioration et la solidité de ses parties abîmées sont notées (armureTransformee), ses parties
 *      supprimées : l'armure élémentaire repart à son maximum ;
 *   2. une armure « Familier » (R165 (1) : « à mettre à part », jamais sur une fiche de personnage) ;
 *   3. une armure élémentaire d'une magie que le personnage n'a pas, ni en innée ni en acquise (« il est nécessaire de posséder la magie », R165 (5) ;
 *      une fiche sans magie innée ne l'a pas) ;
 *   4. avec `poidsPortable` seulement, une armure trop lourde (R165 (7)) : son poids (POIDS_DES_ARMURES : armure.type, armure_elementaire.categorie)
 *      dépasse le poids portable du personnage. `poidsPortable(db, id)` rend ce poids (0 à POIDS_PORTABLE_MAX ; au-delà, POIDS_PORTABLE_MAX) ou null
 *      quand on ne sait pas le dire (rien n'est retiré). La reconstruction (serveur/base-vivante.mjs) et l'enregistrement (serveur/fiches.mjs) y passent
 *      le calcul du moteur de la fiche lu dans la base (lib/poids-portable-db.mjs#poidsPortableDeLaBase) ; sans lui, l'étape n'est pas faite.
 * Une armure retirée emporte son amélioration et ses parties. `personnage` : une seule fiche (l'enregistrement, serveur/fiches.mjs), sinon toutes (la
 * reconstruction de la base vivante, après le rejeu : les règles sont alors celles d'aujourd'hui). Les noms se lisent dans `main`, puis dans l'ancienne
 * base quand elle est attachée (`ancienne` : une armure d'origine que les nouvelles règles n'ont plus) ; à défaut, l'identifiant. Idempotente : une
 * fiche conforme n'est pas touchée.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Map} acc nouveauxRetraitsDeFiches()
 * @param {{ personnage?: string | null, poidsPortable?: ((db: import('node:sqlite').DatabaseSync, id: string) => number | null) | null }} [options]
 */
export function retirerLesArmuresHorsRegle(db, acc = nouveauxRetraitsDeFiches(), { personnage = null, poidsPortable = null } = {}) {
  const bases = db.prepare('PRAGMA database_list').all().map((b) => b.name).filter((b) => b === 'main' || b === 'ancienne');
  const premier = (sql) => {
    const requetes = bases.map((b) => db.prepare(sql.replaceAll('<base>', b)));
    return (id) => {
      for (const r of requetes) {
        const l = r.get(id);
        if (l) return Object.values(l)[0];
      }
      return null;
    };
  };
  const noms = {
    armure: premier('SELECT nom FROM <base>.armure WHERE id = ?'),
    armureElementaire: premier('SELECT nom FROM <base>.armure_elementaire WHERE id = ?'),
    emplacement: premier('SELECT nom FROM <base>.armure_emplacement WHERE id = ?'),
    amelioration: premier('SELECT niveau FROM <base>.amelioration_equipement WHERE id = ?'),
  };
  // une base vivante d'avant (le service y retombe si la reconstruction échoue : serveur/fiches.mjs) peut ne pas avoir l'armure de la fiche (migration
  // 0055) : rien à faire sans ses colonnes ; sans la table des parties, aucune partie
  const colonnesDeLaFiche = db.prepare('PRAGMA main.table_info(personnage)').all().map((c) => c.name);
  if (![...COLONNES_DE_L_ARMURE_DE_BASE, ...COLONNES_DE_L_ARMURE_ELEMENTAIRE].every((c) => colonnesDeLaFiche.includes(c))) return acc;
  const avecParties = aLaTable(db, 'personnage_armure_partie');
  const lireParties = avecParties ? db.prepare('SELECT emplacement_id, solidite FROM main.personnage_armure_partie WHERE personnage_id = ?') : null;
  const parties = (id) => (lireParties ? lireParties.all(id).map((l) => ({ ...l })) : []);
  const ou = personnage === null ? '' : ' AND p.id = ?';
  const choisies = personnage === null ? [] : [personnage];
  const retirer = (f, colonnes, descripteur) => {
    db.prepare(`UPDATE main.personnage SET ${colonnes.map((c) => `"${c}" = NULL`).join(', ')} WHERE id = ?`).run(f.personnage);
    if (avecParties) db.prepare('DELETE FROM main.personnage_armure_partie WHERE personnage_id = ?').run(f.personnage);
    let e = acc.get(f.personnage);
    if (!e) acc.set(f.personnage, (e = { personnage: f.personnage, nom: f.fiche, nature: f.nature, retraits: [] }));
    e.retraits.push(descripteur);
  };
  // 1. l'armure et son « élément » : l'élément devient l'armure (les parties lues avant d'être supprimées)
  for (const f of db.prepare(`SELECT ${champsDeFiche}, p.armure_id, p.armure_amelioration_id, p.armure_elementaire_id, p.armure_amelioration_elementaire_id
    FROM main.personnage p WHERE p.armure_id IS NOT NULL AND p.armure_elementaire_id IS NOT NULL${ou} ORDER BY p.id`).all(...choisies)) {
    retirer(f, COLONNES_DE_L_ARMURE_DE_BASE, armureTransformee({ ...f, armure_parties: parties(f.personnage) }, noms).retrait);
  }
  // 2. une armure « Familier »
  for (const f of db.prepare(`SELECT ${champsDeFiche}, p.armure_id, p.armure_amelioration_id, a.nom AS armure FROM main.personnage p
    JOIN main.armure a ON a.id = p.armure_id WHERE a.type = ?${ou} ORDER BY p.id`).all(TYPE_FAMILIER, ...choisies)) {
    const d = { nature: 'armure_familier', id: f.armure_id, nom: f.armure, amelioration: noms.amelioration(f.armure_amelioration_id), parties: partiesEnTexte(parties(f.personnage), noms) };
    retirer(f, COLONNES_DE_L_ARMURE_DE_BASE, d);
  }
  // 3. une armure élémentaire d'une magie que le personnage n'a pas (ni innée ni acquise)
  for (const f of db.prepare(`SELECT ${champsDeFiche}, p.armure_elementaire_id AS id, p.armure_amelioration_elementaire_id AS amelioration_id, e.nom AS armure,
      coalesce(m.nom, e.magie_id) AS magie
    FROM main.personnage p JOIN main.armure_elementaire e ON e.id = p.armure_elementaire_id LEFT JOIN main.magie m ON m.id = e.magie_id
    WHERE e.magie_id IS NOT p.magie_innee_id AND e.magie_id IS NOT p.magie_acquise_id${ou} ORDER BY p.id`).all(...choisies)) {
    const d = { nature: 'armure_magie_absente', id: f.id, nom: f.armure, amelioration: noms.amelioration(f.amelioration_id), parties: partiesEnTexte(parties(f.personnage), noms), magie: f.magie };
    retirer(f, COLONNES_DE_L_ARMURE_ELEMENTAIRE, d);
  }
  // 4. une armure trop lourde pour le poids portable (le calcul du moteur de la fiche, quand il est branché)
  if (typeof poidsPortable === 'function') {
    for (const f of db.prepare(`SELECT ${champsDeFiche}, p.armure_id, p.armure_amelioration_id, a.nom AS armure, a.type, p.armure_elementaire_id,
        p.armure_amelioration_elementaire_id, e.nom AS elementaire, e.categorie
      FROM main.personnage p LEFT JOIN main.armure a ON a.id = p.armure_id LEFT JOIN main.armure_elementaire e ON e.id = p.armure_elementaire_id
      WHERE (p.armure_id IS NOT NULL OR p.armure_elementaire_id IS NOT NULL)${ou} ORDER BY p.id`).all(...choisies)) {
      const lu = poidsPortable(db, f.personnage);
      if (!Number.isInteger(lu)) continue;
      const portable = Math.max(0, Math.min(POIDS_PORTABLE_MAX, lu));
      const elementaire = f.armure_elementaire_id !== null;
      const poids = valeurDuPoids(elementaire ? f.categorie : f.type);
      if (poids === null || poids <= portable) continue;
      const d = {
        nature: 'armure_trop_lourde', id: elementaire ? f.armure_elementaire_id : f.armure_id, nom: elementaire ? f.elementaire : f.armure, elementaire,
        amelioration: noms.amelioration(elementaire ? f.armure_amelioration_elementaire_id : f.armure_amelioration_id), parties: partiesEnTexte(parties(f.personnage), noms),
        poids: POIDS_DES_ARMURES[poids], portable: POIDS_DES_ARMURES[portable],
      };
      retirer(f, elementaire ? COLONNES_DE_L_ARMURE_ELEMENTAIRE : COLONNES_DE_L_ARMURE_DE_BASE, d);
    }
  }
  return acc;
}

/**
 * Écrit, pour chaque fiche de `acc`, une ligne datée par élément retiré à la fin de ses notes (ordreDesRetraits, puis ligneDeRetrait) et modifie_le =
 * l'instant (cree_le si elle est plus récente : CHECK de la table) : une seule écriture par fiche, dont la version (empreinte du contenu,
 * serveur/fiches.mjs) change donc. Rend les fiches touchées, pour la réponse : [{ fiche: libellé (libelleDeFiche, numéros de numerosDesFichesDeJoueur),
 * retraits: [descriptions] }], dans l'ordre des libellés (prétirés, puis fiches de joueur).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Map} acc
 * @param {string} instant ISO 8601 UTC à la seconde (format des colonnes `*_le`)
 */
export function noterLesRetraits(db, acc, instant) {
  if (!acc.size) return [];
  const ecrire = db.prepare('UPDATE main.personnage SET notes = ?, modifie_le = ? WHERE id = ?');
  const numeros = numerosDesFichesDeJoueur(db); // ceux de la page d'une classe (donneesDeClasse) : une fiche garde son numéro d'une réponse à l'autre
  const fiches = [];
  for (const p of db.prepare(`SELECT id AS personnage, nom, nature, notes, cree_le FROM main.personnage WHERE id IN (SELECT value FROM json_each(?))
    ORDER BY nature = 'pretire' DESC, nom COLLATE NOCASE, id`).all(JSON.stringify([...acc.keys()]))) {
    const retraits = [...acc.get(p.personnage).retraits].sort(ordreDesRetraits);
    if (!retraits.length) continue;
    ecrire.run(ajouterAuxNotes(p.notes, retraits.map((d) => ligneDeRetrait(d, instant))), instant > p.cree_le ? instant : p.cree_le, p.personnage);
    fiches.push({ fiche: libelleDeFiche(p, numeros), retraits: retraits.map(descriptionDuRetrait) });
  }
  return fiches.sort((a, b) => ordreDesLibelles(a.fiche, b.fiche));
}
