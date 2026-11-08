// Le vocabulaire des mots-clés au service du site de dev, depuis les migrations 0113 à 0115 : l'id entier d'un mot-clé créé, sa clé recalculée et
// réécrite dans les textes, ses catégories, ses synonymes et la gestion des catégories (décisions R232, R233). Les opérations du lot qu'il ajoute :
//   { op: 'categories_mot_cle', mot_cle, categories: [ids], avant?: [ids] }   les catégories d'un mot-clé (permis sur un mot-clé verrouillé : R232 (11))
//   { op: 'synonymes_mot_cle', mot_cle, synonymes: [écritures], avant?: [écritures] }   ses synonymes, dans l'ordre (refusé sur un verrouillé : R233 (6))
// et le domaine de la table categorie_mot_cle (création, renommage, suppression d'une catégorie vide : R232 (5)). serveur/edition.mjs les branche
// (OPERATIONS, DOMAINES) ; serveur/edition-chronologie.mjs (le domaine mot_cle : création, renommage, fusion, suppression) appelle recalculerLesCles.
// Règle de la clé (R232 (2), (9), (10)) : lib/mots-cles-cles.mjs#clesDesMotsCles, la jumelle de tools/db/maverick.py#cles_des_mots_cles. Elle est
// recalculée pour tout le vocabulaire après chaque écriture qui peut la changer (renommage, catégories d'un mot-clé, création, suppression ou fusion :
// un homonyme qui apparaît ou disparaît, catégorie renommée) ; un refus de la règle annule le lot (409, `champ`). Une clé qui change (R232 (3), (11)) :
// écrite dans mot_cle.cle, la clé quittée notée dans mot_cle_ancienne_cle (et retirée de cette table quand elle redevient courante), et chaque balise
// qui la cite réécrite dans tous les textes de la base (lib/mots-cles-db.mjs#textesDeLaBase), définitions verrouillées comprises (le verrou protège ce
// qu'on saisit, pas la clé calculée) — chaque ligne notée au journal (ctx.w), comme toute écriture du lot.
// Sans import de serveur/edition.mjs : ses outils (ErreurEdition, refus) sont donnés par outilsDesMotsCles.
import { clesDesMotsCles, HomonymesRefuses } from '../src/lib/mots-cles-cles.mjs';
import { fautesDuSynonyme, reciblerLaCle, synonymesPris, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { estVerrouille, RAISON_DU_VERROU } from '../src/lib/mots-cles.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
const q = (c) => (c === 'rowid' ? 'rowid' : `"${c}"`);

/**
 * L'id d'une ligne neuve de `table` (mot_cle, mot_cle_synonyme, categorie_mot_cle : un id entier, migration 0113) : le plus grand de la table, de
 * l'historique du site et du journal (`$.id` des lignes de cette table) et, pour mot_cle, de mot_cle_ancienne_cle et des `plancher` (le registre de la
 * migration 0113), plus un — un id n'est jamais réutilisé (décision R232 (1) : « un entier auto-incrémenté », figé). `table` vient du code, jamais d'un
 * lot (un nom de la liste ci-dessous).
 */
export function idSuivant(db, table, { plancher = 0 } = {}) {
  if (!['mot_cle', 'mot_cle_synonyme', 'categorie_mot_cle'].includes(table)) throw new Error(`idSuivant : table inattendue « ${table} »`);
  let plus = Math.max(plancher, db.prepare(`SELECT max(id) AS m FROM "${table}"`).get().m ?? 0);
  for (const t of ['historique_modification', 'modification']) {
    if (!tableExiste(db, t)) continue;
    const m = db.prepare(`SELECT max(CAST(json_extract(cle, '$.id') AS INTEGER)) AS m FROM "${t}" WHERE table_nom = ? AND json_type(cle, '$.id') = 'integer'`).get(table).m;
    if (m > plus) plus = m;
  }
  if (table === 'mot_cle' && tableExiste(db, 'mot_cle_ancienne_cle')) plus = Math.max(plus, db.prepare('SELECT max(mot_cle_id) AS m FROM mot_cle_ancienne_cle').get().m ?? 0);
  return plus + 1;
}

/** Les catégories d'un mot-clé (ids croissants). */
export const categoriesDuMotCle = (db, id) => (tableExiste(db, 'mot_cle_categorie')
  ? db.prepare('SELECT categorie_id FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY categorie_id').all(id).map((c) => c.categorie_id) : []);

/** Les synonymes d'un mot-clé, dans l'ordre : [{ id, libelle, libelle_cle, ordre }]. */
export const synonymesDuMotCle = (db, id) => (tableExiste(db, 'mot_cle_synonyme')
  ? db.prepare('SELECT id, libelle, libelle_cle, ordre FROM mot_cle_synonyme WHERE mot_cle_id = ? ORDER BY ordre, id').all(id).map((s) => ({ ...s })) : []);

/**
 * Les tables filles d'un mot-clé (ON DELETE CASCADE vers mot_cle, migrations 0113 et 0115), hors page_tag (ses étiquettes : des mentions,
 * lib/mentions-des-mots-cles.mjs) et sort_mot_cle (sans cascade : un mot-clé qui étiquette un sort ne se supprime pas), avec leur clé primaire.
 * Une suppression ou une fusion les retire en les notant au journal, avant la ligne de mot_cle (retirerLesFillesDuMotCle) : la cascade du schéma n'en
 * retire alors rien hors du journal, que la mise à jour refuserait (fichier hors des tables du lot, scripts/mise-a-jour-github.mjs#tablesDuLot, qui les
 * ajoute pour les lots notés avant).
 */
export const FILLES_DU_MOT_CLE = Object.freeze({
  mot_cle_categorie: Object.freeze(['mot_cle_id', 'categorie_id']),
  mot_cle_synonyme: Object.freeze(['id']),
  mot_cle_ancienne_cle: Object.freeze(['cle']),
});
export const TABLES_DES_FILLES_DU_MOT_CLE = Object.freeze(Object.keys(FILLES_DU_MOT_CLE));

/**
 * Retire, en les notant au journal par `w`, les lignes filles du mot-clé `id` (FILLES_DU_MOT_CLE), avant sa suppression ou sa fusion. `vers` (une
 * fusion, décision R233 (11) : « tout transmettre ») : ses clés quittées passent au mot-clé conservé (une modification de mot_cle_ancienne_cle) au lieu
 * d'être retirées. Rend ses synonymes, dans l'ordre (leurs écritures), que la fusion transmet ensuite (recevoirLaFusion). Aussi pour la résolution
 * d'un lot en conflit (serveur/edition-conflits.mjs#avantLaSuppression).
 */
export function retirerLesFillesDuMotCle(db, w, id, { vers = null } = {}) {
  const synonymes = synonymesDuMotCle(db, id).map((s) => s.libelle);
  for (const [t, cle] of Object.entries(FILLES_DU_MOT_CLE)) {
    if (!tableExiste(db, t)) continue; // base d'avant la migration de la table
    for (const l of db.prepare(`SELECT ${cle.map(q).join(', ')} FROM "${t}" WHERE mot_cle_id = ? ORDER BY ${cle.map(q).join(', ')}`).all(id)) {
      const k = Object.fromEntries(cle.map((c) => [c, l[c]]));
      if (t === 'mot_cle_ancienne_cle' && vers !== null) w.modifier(t, k, { mot_cle_id: vers });
      else w.supprimer(t, k);
    }
  }
  return synonymes;
}

/**
 * La fin d'une fusion (décision R233 (11) : « Oui, tout transmettre »), après la suppression de la source et le recalcul des clés : la clé de la source
 * (`source.cle`) devient une clé quittée du mot-clé conservé `cibleId` (mot_cle_ancienne_cle : les anciennes adresses et les balises mènent à lui ; pas
 * si un mot-clé la porte désormais) ; ses `synonymes` (retirerLesFillesDuMotCle) s'ajoutent, à la suite, à ceux du conservé, sauf ceux que la règle
 * de R233 (4) refuse (lib/mots-cles-balises.mjs#fautesDuSynonyme : le libellé du conservé, un synonyme qu'il a déjà, le libellé, la clé ou le synonyme
 * d'un autre mot-clé), écartés et rendus avec leur raison, et sauf sur un conservé verrouillé hors rejeu (`gel` vrai : décision R233 (6), ses
 * synonymes ne changent pas sur le site ; le service refuse d'ailleurs avant toute écriture la fusion d'un mot-clé qui a des synonymes dans un
 * verrouillé, serveur/edition-chronologie.mjs#fusionner : ce cas ne reste qu'en garde). Tout est noté au journal par `w`.
 * Rend { repris: [écritures], ecartes: [{ synonyme, raison }] }.
 */
export function recevoirLaFusion(db, w, source, cibleId, synonymes, { gel = true } = {}) {
  if (tableExiste(db, 'mot_cle_ancienne_cle') && source.cle && !db.prepare('SELECT 1 FROM mot_cle WHERE cle = ?').get(source.cle)) {
    const deja = lireLigne(db, 'mot_cle_ancienne_cle', { cle: source.cle });
    if (!deja) w.inserer('mot_cle_ancienne_cle', { cle: source.cle, mot_cle_id: cibleId });
    else if (deja.mot_cle_id !== cibleId) w.modifier('mot_cle_ancienne_cle', { cle: source.cle }, { mot_cle_id: cibleId });
  }
  const sortie = { repris: [], ecartes: [] };
  if (!synonymes.length || !tableExiste(db, 'mot_cle_synonyme')) return sortie;
  const vocabulaire = motsClesDeLaBase(db);
  const cible = vocabulaire.find((m) => m.id === cibleId);
  if (gel && estVerrouille(cible)) {
    sortie.ecartes = synonymes.map((synonyme) => ({ synonyme, raison: 'le mot-clé conservé est verrouillé (décision R233 (6))' }));
    return sortie;
  }
  const actuels = synonymesDuMotCle(db, cibleId);
  let ordre = actuels.reduce((n, s) => Math.max(n, s.ordre + 1), 0);
  for (const synonyme of synonymes) {
    const fautes = fautesDuSynonyme(vocabulaire, cible, synonyme, { autres: [...actuels.map((s) => s.libelle), ...sortie.repris] });
    if (fautes.length) {
      sortie.ecartes.push({ synonyme, raison: fautes.map((f) => f.raison).join(' ; ') });
      continue;
    }
    w.inserer('mot_cle_synonyme', { id: idSuivant(db, 'mot_cle_synonyme'), mot_cle_id: cibleId, libelle: synonyme, libelle_cle: normalize(synonyme), ordre: ordre++ });
    sortie.repris.push(synonyme);
  }
  return sortie;
}

/**
 * Les outils du vocabulaire, liés aux erreurs du service : { recalculerLesCles, refuserLesSynonymes, poserLesCategories, poserLesSynonymes, operations,
 * domaines }. `ErreurEdition` : la classe d'erreur du service (statut HTTP, message, détails).
 */
export function outilsDesMotsCles({ ErreurEdition }) {
  const refus = (message, details) => new ErreurEdition(400, message, details);
  const nom = (m) => `« ${m.libelle} »`;

  /**
   * Le refus d'un état du vocabulaire que la règle des clés n'admet pas (HomonymesRefuses), en clair (409) : un homonyme sans catégorie propre face à
   * chacun des autres, avec la demande d'une catégorie distinctive (R232 (9) ; `champ: 'categories'`) ; une clé déjà prise (R232 (10) ; `champ:
   * 'libelle'`). `details.mots_cles` : les ids en cause ; `details.cle` : la clé prise.
   */
  function refusDesHomonymes(e, motsCles) {
    const parId = new Map(motsCles.map((m) => [m.id, m]));
    const f = e.fautes.find((x) => x.raison !== 'cle-prise') ?? e.fautes[0];
    const noms = f.ids.map((id) => nom(parId.get(id) ?? { libelle: String(id) }));
    if (f.raison === 'cle-prise') {
      return new ErreurEdition(409, `La clé « ${f.cle} » serait celle de ${noms.join(' et de ')} : une clé déjà prise est refusée (décision R232 (10)). `
        + 'Choisissez un autre libellé, ou d’autres catégories.', { champ: 'libelle', cle: f.cle, mots_cles: f.ids });
    }
    const homonymes = motsCles.filter((m) => normalize(m.libelle) === f.base).map(nom);
    const raison = f.raison === 'sans-categorie' ? `${noms[0]} n’a aucune catégorie`
      : `les catégories de ${noms[0]} sont toutes aussi celles de ${noms[1]}`;
    return new ErreurEdition(409, `Les mots-clés ${homonymes.join(', ')} s’écrivent de la même façon : ${raison}. Ajoutez-lui une catégorie qui le `
      + 'distingue de chacun des autres (décision R232 (9)).', { champ: 'categories', mots_cles: f.ids });
  }

  /**
   * Recalcule la clé de tous les mots-clés (décision R232 (2)) et écrit celles qui changent, dans le lot (`ctx.w`) : mot_cle.cle, la clé quittée dans
   * mot_cle_ancienne_cle (sauf si un mot-clé la porte désormais), retirée de cette table quand elle redevient une clé courante, puis chaque balise
   * qui citait une clé quittée, réécrite dans tous les textes de la base (reciblerLaCle ; R232 (3)), le verrou n'y faisant rien (R232 (11)). Refus 409
   * (refusDesHomonymes) si la règle refuse le vocabulaire ; 409 aussi si une clé nouvelle s'écrit comme le synonyme d'un autre mot-clé (R233 (4),
   * `champ: 'libelle'`). Rend Map(id → { avant, apres }) des clés changées.
   */
  function recalculerLesCles(ctx) {
    const { db, w } = ctx;
    if (!tableExiste(db, 'categorie_mot_cle')) return new Map();
    const motsCles = motsClesDeLaBase(db);
    const categories = new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle]));
    let cles;
    try {
      cles = clesDesMotsCles(motsCles, categories);
    } catch (e) {
      if (e instanceof HomonymesRefuses) throw refusDesHomonymes(e, motsCles);
      throw e;
    }
    const changements = new Map();
    for (const m of motsCles) if (cles.get(m.id) !== m.cle) changements.set(m.id, { avant: m.cle, apres: cles.get(m.id) });
    // une clé quittée que porte de nouveau un mot-clé (créé ou renommé vers elle) n'est plus une clé quittée (R232 : la clé courante se cherche d'abord)
    if (tableExiste(db, 'mot_cle_ancienne_cle')) {
      for (const { cle } of db.prepare('SELECT a.cle FROM mot_cle_ancienne_cle a JOIN mot_cle m ON m.cle = a.cle ORDER BY a.cle').all()) w.supprimer('mot_cle_ancienne_cle', { cle });
    }
    if (!changements.size) return changements;
    const avant = vocabulaireDesMotsCles(motsCles);
    for (const [id, { apres }] of changements) {
      const m = avant.parId.get(id);
      const [pris] = synonymesPris(avant, { id, libelle: m.libelle, cle: apres });
      if (pris) {
        throw new ErreurEdition(409, `La clé « ${apres} » de ${nom(m)} s’écrit comme le synonyme « ${pris.synonyme} » du mot-clé ${nom(pris.m)} (décision R233 (4)).`,
          { champ: 'libelle', mot_cle: pris.m.id });
      }
    }
    // les clés, dans un ordre qui ne heurte jamais l'unicité de mot_cle.cle (une clé n'est écrite qu'une fois libérée)
    const courantes = new Map(motsCles.map((m) => [m.cle, m.id]));
    let restants = [...changements];
    while (restants.length) {
      const prets = restants.filter(([id, { apres }]) => !courantes.has(apres) || courantes.get(apres) === id);
      if (!prets.length) throw new ErreurEdition(409, 'Les clés de ces mots-clés s’échangeraient : enregistrez ces modifications en deux fois.', { champ: 'libelle', mots_cles: restants.map(([id]) => id) });
      for (const [id, { avant: ancienne, apres }] of prets) {
        w.modifier('mot_cle', { id }, { cle: apres });
        courantes.delete(ancienne);
        courantes.set(apres, id);
      }
      restants = restants.filter((r) => !prets.includes(r));
    }
    if (tableExiste(db, 'mot_cle_ancienne_cle')) {
      for (const [, { apres }] of changements) if (lireLigne(db, 'mot_cle_ancienne_cle', { cle: apres })) w.supprimer('mot_cle_ancienne_cle', { cle: apres });
      for (const [id, { avant: ancienne }] of changements) {
        if (courantes.has(ancienne)) continue;
        const deja = lireLigne(db, 'mot_cle_ancienne_cle', { cle: ancienne });
        if (!deja) w.inserer('mot_cle_ancienne_cle', { cle: ancienne, mot_cle_id: id });
        else if (deja.mot_cle_id !== id) w.modifier('mot_cle_ancienne_cle', { cle: ancienne }, { mot_cle_id: id });
      }
    }
    reecrireLesCles(ctx, avant, new Map([...changements].map(([id, { apres }]) => [id, apres])));
    return changements;
  }

  /**
   * Les balises qui citent une clé quittée (`changements` : Map(id → nouvelle clé) ; `avant` : le vocabulaire d'avant), réécrites dans tous les textes
   * de la base (textesDeLaBase : règles et pages, colonnes dérivées comprises, que le rejeu refait de toute façon), chaque ligne par une modification
   * notée au journal ; seule la ref change (reciblerLaCle).
   */
  function reecrireLesCles(ctx, avant, changements) {
    const { db, w } = ctx;
    for (const { table, colonne, cle, markdown } of textesDeLaBase(db)) {
      if (table === 'mot_cle' && colonne === 'cle') continue;
      const lignes = db.prepare(`SELECT ${[...new Set([...cle, colonne])].map(q).join(', ')} FROM "${table}" WHERE instr(${q(colonne)}, '{{') > 0`).all();
      for (const l of lignes) {
        const texte = reciblerLaCle(l[colonne], avant, changements, { markdown });
        if (texte === l[colonne]) continue;
        w.modifier(table, Object.fromEntries(cle.map((c) => [c, l[c]])), { [colonne]: texte });
      }
    }
  }

  /** Le mot-clé `id` (un entier) de la base, ou 404. */
  function motCle(db, id, quoi = 'Mot-clé') {
    const m = Number.isInteger(id) ? lireLigne(db, 'mot_cle', { id }) : null;
    if (!m) throw new ErreurEdition(404, `${quoi} introuvable : ${JSON.stringify(id)}`);
    return m;
  }

  /** Les ids de catégories `ids` (entiers), contrôlés : chacun existe (404 sinon) ; sans doublon, croissants. `champ: 'categories'`. */
  function listeDeCategories(db, ids, quoi) {
    if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x) && x >= 1)) throw refus(`${quoi} : liste d’identifiants de catégories (entiers) attendue.`, { champ: 'categories' });
    for (const id of ids) {
      if (!lireLigne(db, 'categorie_mot_cle', { id })) throw new ErreurEdition(404, `${quoi} : catégorie introuvable : ${id}`, { champ: 'categories' });
    }
    return [...new Set(ids)].sort((a, b) => a - b);
  }

  /** Pose les catégories `ids` sur le mot-clé `id` (lignes de mot_cle_categorie ajoutées et retirées, notées au journal), sans recalculer les clés. */
  function poserLesCategories(ctx, id, ids) {
    const { db, w } = ctx;
    const actuelles = categoriesDuMotCle(db, id);
    for (const c of actuelles) if (!ids.includes(c)) w.supprimer('mot_cle_categorie', { mot_cle_id: id, categorie_id: c });
    for (const c of ids) if (!actuelles.includes(c)) w.inserer('mot_cle_categorie', { mot_cle_id: id, categorie_id: c });
  }

  /**
   * Refus de synonymes pour le mot-clé `m` ({ id, libelle }), tels qu'ils seraient enregistrés (décision R233 (4) : lib/mots-cles-balises.mjs#fautesDuSynonyme,
   * la règle de db:check) : 400 pour leur écriture, 409 quand un autre mot-clé la prend (`mot_cle` : cet autre) ; `champ: 'synonymes'`.
   */
  function refuserLesSynonymes(db, m, synonymes) {
    const vocabulaire = motsClesDeLaBase(db);
    synonymes.forEach((s, i) => {
      const fautes = fautesDuSynonyme(vocabulaire, m, s, { autres: synonymes.slice(0, i) });
      if (!fautes.length) return;
      const autre = fautes.find((f) => f.autre)?.autre;
      throw new ErreurEdition(autre ? 409 : 400, `Mot-clé ${nom(m)} : le synonyme « ${s} » ne convient pas (${fautes.map((f) => f.raison).join(' ; ')} ; décision R233).`,
        { champ: 'synonymes', ...(autre ? { mot_cle: autre.id } : {}) });
    });
  }

  /**
   * Écrit les synonymes `synonymes` (écritures, dans l'ordre) du mot-clé `id` : un synonyme gardé (même écriture normalisée) garde sa ligne (son id),
   * son écriture et son rang mis à jour ; un retiré est supprimé ; un nouveau reçoit un id neuf (idSuivant). Notés au journal. Contrôlés avant
   * (refuserLesSynonymes).
   */
  function poserLesSynonymes(ctx, id, synonymes) {
    const { db, w } = ctx;
    const actuels = synonymesDuMotCle(db, id);
    const voulus = synonymes.map((libelle, ordre) => ({ libelle, libelle_cle: normalize(libelle), ordre }));
    for (const s of actuels) if (!voulus.some((v) => v.libelle_cle === s.libelle_cle)) w.supprimer('mot_cle_synonyme', { id: s.id });
    // un rang libéré d'abord, puis les lignes gardées, puis les nouvelles (rangs sans UNIQUE : l'ordre n'y fait rien, l'écriture si : libelle_cle UNIQUE)
    for (const v of voulus) {
      const garde = actuels.find((s) => s.libelle_cle === v.libelle_cle);
      if (!garde) continue;
      const valeurs = {};
      if (garde.libelle !== v.libelle) valeurs.libelle = v.libelle;
      if (garde.ordre !== v.ordre) valeurs.ordre = v.ordre;
      if (Object.keys(valeurs).length) w.modifier('mot_cle_synonyme', { id: garde.id }, valeurs);
    }
    for (const v of voulus) {
      if (actuels.some((s) => s.libelle_cle === v.libelle_cle)) continue;
      w.inserer('mot_cle_synonyme', { id: idSuivant(db, 'mot_cle_synonyme'), mot_cle_id: id, libelle: v.libelle, libelle_cle: v.libelle_cle, ordre: v.ordre });
    }
  }

  /** Une liste reçue (`avant` d'une opération) comparée à la liste en place, sans égard à l'ordre (`ordre` faux) ou avec. */
  const memeListe = (a, b, { ordre = false } = {}) => {
    const x = a.map(String);
    const y = b.map(String);
    return (ordre ? x : [...x].sort()).join('\u0000') === (ordre ? y : [...y].sort()).join('\u0000');
  };

  /**
   * `{ op: 'categories_mot_cle', mot_cle, categories: [ids], avant?: [ids] }` : les catégories d'un mot-clé (décision R232 (5) ; `avant` : celles que la
   * page a lues, 409 si elles ont changé entre-temps). Permis sur un mot-clé verrouillé (R232 (11) : « Les catégories ne sont pas couvertes par le
   * verrou »). Les clés sont recalculées (un homonyme sans catégorie distinctive : 409, `champ: 'categories'`), et les textes réécrits.
   */
  function categoriesMotCle(ctx, op) {
    const { db } = ctx;
    const m = motCle(db, op.mot_cle);
    if (!tableExiste(db, 'mot_cle_categorie')) throw refus('Les catégories des mots-clés n’existent pas dans cette base (migration 0113).');
    const ids = listeDeCategories(db, op.categories, `Mot-clé ${nom(m)}`);
    const actuelles = categoriesDuMotCle(db, m.id);
    if (Array.isArray(op.avant) && !memeListe(op.avant, actuelles)) {
      throw new ErreurEdition(409, `Mot-clé ${nom(m)} : ses catégories ont changé entre-temps. Rechargez la page.`, { champ: 'categories' });
    }
    if (memeListe(ids, actuelles)) return `Mot-clé ${m.libelle} : catégories inchangées`;
    poserLesCategories(ctx, m.id, ids);
    const cles = recalculerLesCles(ctx);
    const noms = ids.map((id) => lireLigne(db, 'categorie_mot_cle', { id }).libelle);
    return `Mot-clé ${m.libelle} : ${noms.length ? `catégories ${noms.join(', ')}` : 'sans catégorie'}${resumeDesCles(cles)}`;
  }

  /**
   * `{ op: 'synonymes_mot_cle', mot_cle, synonymes: [écritures], avant?: [écritures] }` : les synonymes d'un mot-clé, dans l'ordre (décision R233 ;
   * `avant` : ceux que la page a lus, dans l'ordre, 409 s'ils ont changé entre-temps). Refusé sur un mot-clé verrouillé (R233 (6) : 409, sauf au rejeu,
   * `ctx.gel` faux), et pour un synonyme qui ne convient pas (refuserLesSynonymes).
   */
  function synonymesMotCle(ctx, op) {
    const { db } = ctx;
    const m = motCle(db, op.mot_cle);
    if (!tableExiste(db, 'mot_cle_synonyme')) throw refus('Les synonymes des mots-clés n’existent pas dans cette base (migration 0115).');
    if (estVerrouille(m) && ctx.gel !== false) throw new ErreurEdition(409, `Le mot-clé ${nom(m)} est verrouillé : ${RAISON_DU_VERROU}.`, { champ: 'synonymes' });
    if (!Array.isArray(op.synonymes) || !op.synonymes.every((s) => typeof s === 'string')) throw refus(`Mot-clé ${nom(m)} : liste de synonymes attendue.`, { champ: 'synonymes' });
    const synonymes = [];
    for (const s of op.synonymes.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) if (!synonymes.includes(s)) synonymes.push(s);
    const actuels = synonymesDuMotCle(db, m.id).map((s) => s.libelle);
    if (Array.isArray(op.avant) && !memeListe(op.avant, actuels, { ordre: true })) {
      throw new ErreurEdition(409, `Mot-clé ${nom(m)} : ses synonymes ont changé entre-temps. Rechargez la page.`, { champ: 'synonymes' });
    }
    if (memeListe(synonymes, actuels, { ordre: true })) return `Mot-clé ${m.libelle} : synonymes inchangés`;
    refuserLesSynonymes(db, m, synonymes);
    poserLesSynonymes(ctx, m.id, synonymes);
    return `Mot-clé ${m.libelle} : ${synonymes.length ? `synonymes ${synonymes.join(', ')}` : 'sans synonyme'}`;
  }

  /** La phrase du résumé d'un lot pour des clés changées (« ; clés : x → y »), '' sans changement. */
  function resumeDesCles(changements) {
    if (!changements.size) return '';
    return ` ; ${changements.size > 1 ? 'clés' : 'clé'} : ${[...changements.values()].map((c) => `${c.avant} → ${c.apres}`).join(', ')}`;
  }

  /** L'écriture d'une catégorie (normalize) ; refusée (400) si elle est vide, (409) si une autre catégorie (`sauf` : son id) s'écrit déjà ainsi. */
  function cleDeCategorie(db, libelle, sauf = null) {
    const cle = normalize(libelle);
    if (!cle) throw refus(`Catégorie « ${libelle} » : elle doit contenir au moins une lettre ou un chiffre.`, { champ: 'libelle' });
    const autre = db.prepare('SELECT * FROM categorie_mot_cle WHERE libelle_cle = ? AND id IS NOT ?').get(cle, sauf);
    if (autre) throw new ErreurEdition(409, `La catégorie de mots-clés « ${autre.libelle} » existe déjà (décision R232 : le libellé d’une catégorie est unique).`, { champ: 'libelle', categorie: autre.id });
    return cle;
  }

  /**
   * Le domaine de categorie_mot_cle (décision R232 (5) : « une catégorie s'ajoute, se renomme, et se supprime si elle est vide ») : renommer recalcule
   * la clé des mots-clés homonymes qui la portent (et réécrit les textes) ; créer donne l'id suivant ; supprimer une catégorie qui range un mot-clé est
   * refusé (409, `mots_cles` : ceux qui la portent).
   */
  const CATEGORIE_MOT_CLE = {
    colonnes(ctx, ligne, valeurs, avant) {
      if (!('libelle' in valeurs) || ligne.libelle === avant.libelle) return {};
      return { libelle_cle: cleDeCategorie(ctx.db, ligne.libelle, avant.id) };
    },
    deriver(ctx, avant, apres) {
      if (avant.libelle !== apres.libelle) recalculerLesCles(ctx);
    },
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const cle = cleDeCategorie(db, valeurs.libelle);
      const id = idSuivant(db, 'categorie_mot_cle');
      w.inserer('categorie_mot_cle', { id, libelle: valeurs.libelle, libelle_cle: cle });
      return { id, resume: `Catégorie de mots-clés créée : ${valeurs.libelle}` };
    },
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const c = Number.isInteger(cle?.id) ? lireLigne(db, 'categorie_mot_cle', { id: cle.id }) : null;
      if (!c) throw new ErreurEdition(404, `Catégorie de mots-clés introuvable : ${JSON.stringify(cle?.id)}`);
      const portent = db.prepare('SELECT m.id, m.libelle FROM mot_cle_categorie l JOIN mot_cle m ON m.id = l.mot_cle_id WHERE l.categorie_id = ? ORDER BY m.cle')
        .all(c.id).map((m) => ({ ...m }));
      if (portent.length) {
        const noms = portent.slice(0, 5).map(nom).join(', ') + (portent.length > 5 ? '…' : '');
        throw new ErreurEdition(409, `La catégorie « ${c.libelle} » range encore ${portent.length > 1 ? `${portent.length} mots-clés` : 'un mot-clé'} (${noms}) : `
          + 'retirez-la d’abord de ces mots-clés (décision R232 (5) : seule une catégorie vide se supprime).', { mots_cles: portent });
      }
      w.supprimer('categorie_mot_cle', { id: c.id });
      return { id: c.id, resume: `Catégorie de mots-clés supprimée : ${c.libelle}` };
    },
  };

  return {
    recalculerLesCles, refusDesHomonymes, refuserLesSynonymes, poserLesCategories, poserLesSynonymes, listeDeCategories, resumeDesCles,
    operations: { categories_mot_cle: categoriesMotCle, synonymes_mot_cle: synonymesMotCle },
    domaines: { categorie_mot_cle: CATEGORIE_MOT_CLE },
  };
}
