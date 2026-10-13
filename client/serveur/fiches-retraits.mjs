// Fiches de personnage et règles supprimées (décision R42 ; docs/serveur.md, « Fiches de personnage (R42) ») : un don, une spécialité (avec les dons
// choisis qui en dépendent), un sort, un métier ou une arme (décision R52) que les règles suppriment est RETIRÉ des fiches qui l'utilisent — la fiche reste, seul l'élément part —
// et une ligne datée par élément s'ajoute à la fin de ses notes (« NOTE », cellule BA53 ; texte : src/lib/fiche-format.mjs#ligneDeRetrait). Deux moments :
//   - le site de dev supprime une ligne de règle (serveur/edition.mjs : métier, spécialité, don) : retirerDesFiches, AVANT la suppression de la règle
//     (clés étrangères contrôlées), noms lus dans la base avant qu'elle ne parte ;
//   - une livraison refait la base vivante (serveur/base-vivante.mjs#transferer) : retirerLesManquants, APRÈS le rejeu du journal (un lot suivant peut
//     créer ce qu'une fiche cite) et avant le contrôle des clés, noms lus dans l'ancienne base attachée (`ancienne`).
// Puis noterLesRetraits écrit les notes, une seule fois par fiche. Un élément seulement modifié (renommé…) ne touche pas les fiches : elles n'en gardent
// que l'identifiant, qui ne change jamais (migration 0006). Une race, une classe ou une magie disparue n'est pas retirée ici (non tranché : la
// reconstruction reste bloquée), ni un don, une spécialité ou un sort dont la classe ou la magie a disparu (un sort d'une magie supprimée chez un
// Potentiel Illimité, un don d'une classe supprimée sur une fiche qui n'a pas la classe) : sa clé reste rompue et bloque la reconstruction.
// Les écritures dans les fiches se font en SQL direct, jamais par le rédacteur du journal (serveur/edition-journal.mjs#ouvrirLot, qui les refuse) : les
// fiches ne vont ni au journal, ni dans data/rows. Elles restent dans la transaction de l'appelant (un lot refusé, une reconstruction bloquée les annulent).
// Node seulement, sans dépendance : n'importe que le format des fiches (ni edition.mjs ni base-vivante.mjs, qui l'importent).
import { ajouterAuxNotes, descriptionDuRetrait, ligneDeRetrait, ordreDesRetraits } from '../src/lib/fiche-format.mjs';

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
  Object.freeze({ table: 'personnage_sort', colonnes: Object.freeze(['sort_id']), vise: 'sort', action: 'supprimer', cle: Object.freeze(['personnage_id', 'sort_id']) }),
  // une arme supprimée (décision R52, comme R42) : son emplacement (arme 1 ou 2) part, avec sa composition, son amélioration et son élément
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
 * Applique les retraits collectés (SQL direct, dans `main`) et range leurs descripteurs dans `acc`. Une entrée sans descripteur (un don qui part avec sa
 * spécialité, nommé sur la ligne de celle-ci) est retirée sans ligne de note à elle.
 * @param {{ personnage: string, fiche: string, nature: string, vise: string, cle: unknown[], descripteur: object | null }[]} aRetirer
 */
function appliquer(db, aRetirer, acc) {
  for (const l of aRetirer) {
    const r = RETRAITS.find((x) => x.vise === l.vise);
    const ou = r.cle.map((c) => `"${c}" = ?`).join(' AND ');
    const sql = r.action === 'vider' ? `UPDATE main."${r.table}" SET "${r.colonne}" = NULL WHERE ${ou}` : `DELETE FROM main."${r.table}" WHERE ${ou}`;
    db.prepare(sql).run(...l.cle);
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
  for (const id of sorts) {
    const s = db.prepare('SELECT s.id, s.nom, s.niveau, m.nom AS magie FROM main.sort s LEFT JOIN main.magie m ON m.id = s.magie_id WHERE s.id = ?').get(id);
    if (!s) continue;
    for (const f of db.prepare(`SELECT ${champsDeFiche}, ps.niveau_maitrise, ps.nm_livre, ps.nm_cadeau FROM main.personnage_sort ps
      JOIN main.personnage p ON p.id = ps.personnage_id WHERE ps.sort_id = ?`).all(s.id)) {
      aRetirer.push({ ...f, vise: 'sort', cle: [f.personnage, s.id], descripteur: { nature: 'sort', id: s.id, nom: s.nom, magie: s.magie ?? null, npm: s.niveau ?? null,
        nm: f.niveau_maitrise ?? null, nm_livre: f.nm_livre ?? null, nm_cadeau: f.nm_cadeau ?? null } });
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
  for (const s of db.prepare(`SELECT ${champsDeFiche}, ps.sort_id AS id, ps.niveau_maitrise, ps.nm_livre, ps.nm_cadeau, a.nom AS nom, a.niveau AS npm,
      coalesce(mm.nom, am.nom) AS magie
    FROM main.personnage_sort ps JOIN main.personnage p ON p.id = ps.personnage_id
    LEFT JOIN ancienne.sort a ON a.id = ps.sort_id
    LEFT JOIN main.magie mm ON mm.id = a.magie_id
    LEFT JOIN ancienne.magie am ON am.id = a.magie_id
    WHERE NOT EXISTS (SELECT 1 FROM main.sort x WHERE x.id = ps.sort_id) AND EXISTS (SELECT 1 FROM main.magie m WHERE m.id = a.magie_id)
    ORDER BY p.id, ps.rang`).all()) {
    aRetirer.push({ ...s, vise: 'sort', cle: [s.personnage, s.id], descripteur: { nature: 'sort', id: s.id, nom: s.nom ?? null, magie: s.magie ?? null, npm: s.npm ?? null,
      nm: s.niveau_maitrise ?? null, nm_livre: s.nm_livre ?? null, nm_cadeau: s.nm_cadeau ?? null } });
  }
  // métiers : absents des nouvelles règles
  for (const m of db.prepare(`SELECT ${champsDeFiche}, p.metier_id AS id, a.nom AS nom
    FROM main.personnage p LEFT JOIN ancienne.metier a ON a.id = p.metier_id
    WHERE p.metier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM main.metier x WHERE x.id = p.metier_id)
    ORDER BY p.id`).all()) {
    aRetirer.push({ ...m, vise: 'metier', cle: [m.personnage], descripteur: { nature: 'metier', id: m.id, nom: m.nom ?? null } });
  }
  // armes : absentes des nouvelles règles (décision R52) ; nom et famille lus dans l'ancienne base
  for (const a of db.prepare(`SELECT ${champsDeFiche}, pa.rang, pa.arme_id AS id, x.nom AS nom, f.nom AS famille
    FROM main.personnage_arme pa JOIN main.personnage p ON p.id = pa.personnage_id
    LEFT JOIN ancienne.arme x ON x.id = pa.arme_id
    LEFT JOIN ancienne.arme_famille f ON f.id = x.famille_id
    WHERE NOT EXISTS (SELECT 1 FROM main.arme y WHERE y.id = pa.arme_id)
    ORDER BY p.id, pa.rang`).all()) {
    aRetirer.push({ ...a, vise: 'arme', cle: [a.personnage, a.rang], descripteur: { nature: 'arme', id: a.id, nom: a.nom ?? null, famille: a.famille ?? null, rang: a.rang } });
  }
  return appliquer(db, aRetirer, acc);
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
