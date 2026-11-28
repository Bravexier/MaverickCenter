// Le vocabulaire des mots-clés au service du site de dev, depuis les migrations 0113 à 0115 : l'id entier d'un mot-clé créé, sa clé recalculée et
// réécrite dans les textes, ses catégories, ses synonymes et la gestion des catégories (décisions R232, R233). Les opérations du lot qu'il ajoute :
//   { op: 'categories_mot_cle', mot_cle, categories: [ids], avant?: [ids] }   les catégories d'un mot-clé (permis sur un mot-clé verrouillé : R232 (11))
//   { op: 'synonymes_mot_cle', mot_cle, synonymes: [écritures], avant?: [écritures] }   ses synonymes, dans l'ordre (permis sur un verrouillé : seule sa suppression est refusée)
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
import { categoriesDesMotsCles, lireUnMotCle, motsClesDeLaBase, textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { referencesDesMotsCles } from '../src/lib/mentions-des-mots-cles.mjs';
import { estVerrouille } from '../src/lib/mots-cles.mjs';
import { normalize } from '../src/lib/text.mjs';
import { donnerUnNumero, lireLigne } from './edition-journal.mjs';

const tableExiste = (db, nom) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nom));
const q = (c) => (c === 'rowid' ? 'rowid' : `"${c}"`);

/**
 * L'id d'une ligne neuve de `table` (mot_cle, mot_cle_synonyme, categorie_mot_cle : un id entier, migration 0113) : 1 + le plus haut numéro connu
 * (edition-journal.mjs#donnerUnNumero, la règle des lots de changements : le plafond `numero_donne`, le plus grand de la table, de l'historique du site et
 * du journal, et pour mot_cle aussi de mot_cle_ancienne_cle et des `plancher`, le registre de la migration 0113). Le plafond est monté dans la même
 * transaction : un id n'est jamais réutilisé, même après la suppression de la ligne, l'annulation d'un lot ou une base restaurée (décision R232 (1) : « un
 * entier auto-incrémenté », figé ; chantier de la base de dev, garde-fou 11). `monter: false` : le numéro est seulement calculé (traduction d'un ancien
 * journal au rejeu). `table` vient du code, jamais d'un lot (un nom de la liste ci-dessous).
 */
export function idSuivant(db, table, { plancher = 0, monter = true } = {}) {
  if (!['mot_cle', 'mot_cle_synonyme', 'categorie_mot_cle'].includes(table)) throw new Error(`idSuivant : table inattendue « ${table} »`);
  const anciennes = table === 'mot_cle' && tableExiste(db, 'mot_cle_ancienne_cle') ? db.prepare('SELECT max(mot_cle_id) AS m FROM mot_cle_ancienne_cle').get().m ?? 0 : 0;
  return donnerUnNumero(db, table, 'id', { plancher: Math.max(plancher, anciennes), monter });
}

/** Les catégories d'un mot-clé (ids croissants). */
export const categoriesDuMotCle = (db, id) => (tableExiste(db, 'mot_cle_categorie')
  ? db.prepare('SELECT categorie_id FROM mot_cle_categorie WHERE mot_cle_id = ? ORDER BY categorie_id').all(id).map((c) => c.categorie_id) : []);

/** Les synonymes d'un mot-clé, dans l'ordre : [{ id, libelle, libelle_cle, ordre }]. */
export const synonymesDuMotCle = (db, id) => (tableExiste(db, 'mot_cle_synonyme')
  ? db.prepare('SELECT id, libelle, libelle_cle, ordre FROM mot_cle_synonyme WHERE mot_cle_id = ? ORDER BY ordre, id').all(id).map((s) => ({ ...s })) : []);

/**
 * Les tables filles d'un mot-clé (ON DELETE CASCADE vers mot_cle, migrations 0113, 0115 et 0135 : son repère), hors page_tag (ses étiquettes : des mentions,
 * lib/mentions-des-mots-cles.mjs) et sort_mot_cle (sans cascade : un mot-clé qui étiquette un sort ne se supprime pas), avec leur clé primaire.
 * Une suppression ou une fusion les retire en les notant au journal, avant la ligne de mot_cle (retirerLesFillesDuMotCle) : la cascade du schéma n'en
 * retire alors rien hors du journal, que la mise à jour refuserait (fichier hors des tables du lot, scripts/mise-a-jour-github.mjs#tablesDuLot, qui les
 * ajoute pour les lots notés avant).
 */
export const FILLES_DU_MOT_CLE = Object.freeze({
  mot_cle_categorie: Object.freeze(['mot_cle_id', 'categorie_id']),
  mot_cle_synonyme: Object.freeze(['id']),
  mot_cle_ancienne_cle: Object.freeze(['cle']),
  repere: Object.freeze(['mot_cle_id']),
});
export const TABLES_DES_FILLES_DU_MOT_CLE = Object.freeze(Object.keys(FILLES_DU_MOT_CLE));

/**
 * Les champs LOGIQUES d'un mot-clé (migration 0136, docs/chantier-retrait-des-colonnes.md §1) : la table mot_cle ne les porte plus, ils se lisent
 * (lib/mots-cles-db.mjs#lireUnMotCle, #motsClesDeLaBase) et s'écrivent (ecrireSurLElement) sur son ÉLÉMENT : sa page, sinon son sort, sinon son repère.
 */
export const CHAMPS_DE_L_ELEMENT = Object.freeze(['libelle', 'url', 'description', 'couleur', 'icone']);
/** Champ logique d'un mot-clé → colonne de son repère. */
export const COLONNES_DU_REPERE = Object.freeze({ libelle: 'nom', url: 'adresse', description: 'definition', couleur: 'couleur', icone: 'icone' });
/** Champ logique d'un mot-clé → colonne de sa page (son nom est le titre de la page, son adresse se calcule : ils ne s'écrivent jamais d'ici). */
export const COLONNES_DE_LA_PAGE = Object.freeze({ description: 'definition', couleur: 'couleur', icone: 'icone' });

const CITE_UN_NUMERO = /\bR[0-9]+\b/;
/** Le sujet d'un refus sans numéro de décision : un nom qui s'écrit comme un numéro n'y entre pas (un refus qui en cite un devient un verrou qu'une session Créateur ouvre). */
export const motCleDansUnRefus = (libelle) => (libelle && !CITE_UN_NUMERO.test(libelle) ? `Le mot-clé « ${libelle} »` : 'Ce mot-clé');

/** Vrai si la base lit le nom d'un mot-clé sur son élément (migration 0136 : la table repere, et plus de colonne mot_cle.libelle). */
export const nomSurLElement = (db) => tableExiste(db, 'mot_cle') && tableExiste(db, 'repere') && !db.prepare("SELECT 1 FROM pragma_table_info('mot_cle') WHERE name = 'libelle'").get();

/** Les ids des mots-clés qui ont une page ou un sort : leur nom suit cet élément, que la règle des clés ne peut pas refuser (clesTenues). */
export function motsClesDePageOuDeSort(db) {
  const sortie = new Set();
  for (const table of ['page', 'sort']) {
    if (!tableExiste(db, table) || !db.prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = 'mot_cle_id'`).get()) continue;
    for (const l of db.prepare(`SELECT mot_cle_id AS id FROM "${table}" WHERE mot_cle_id IS NOT NULL`).all()) sortie.add(l.id);
  }
  return sortie;
}

/** Des clés qui s'échangeraient sans qu'aucune puisse être écrite la première (mot_cle.cle est unique) : `ids`, les mots-clés en cause. */
export class ClesCroisees extends Error {
  constructor(ids) {
    super(`clés croisées : ${ids.join(', ')}`);
    this.name = 'ClesCroisees';
    this.ids = ids;
  }
}

/**
 * Vrai si la clé du mot-clé `m` ({ libelle, cle, categories, parent? }) est faite de son nom : normalize(libellé), puis, chacun précédé d'un tiret et dans
 * l'ordre de la règle (lib/mots-cles-cles.mjs), une part des libellés de ses catégories (par id croissant), puis, s'il a un parent, ce qui reste (le nom
 * de sa magie au calcul de la clé, qui a pu changer depuis). Faux pour un mot-clé dont le
 * nom a changé sans que sa clé suive (un renommage de page ou de sort que la règle ne sait pas distinguer : décision 1 de B3). `categories` : Map(id → libellé).
 */
export function laCleSuitLeNom(m, categories) {
  const base = normalize(m?.libelle ?? '');
  if (!base || typeof m?.cle !== 'string') return false;
  if (m.cle === base) return true;
  if (!m.cle.startsWith(`${base}-`)) return false;
  const parts = [...(m.categories ?? [])].map(Number).sort((a, b) => a - b).map((c) => normalize((categories instanceof Map ? categories.get(c) : categories?.[c]) ?? '')).filter(Boolean);
  // le parent (la magie d'un sort) a pu changer de nom depuis le calcul de la clé : la part qui le suit est libre, pour un mot-clé qui en a un
  const parent = Boolean(m.parent);
  const suite = (reste, i) => (parent && i <= parts.length && reste !== '')
    || parts.slice(i).some((p, j) => reste === p || (reste.startsWith(`${p}-`) && suite(reste.slice(p.length + 1), i + j + 1)));
  return suite(m.cle.slice(base.length + 1), 0);
}

/**
 * La clé de chaque mot-clé quand un nom que la règle ne sait pas distinguer ne bloque jamais (docs/chantier-ancrage-mots-cles.md, choix 7 ; le nom d'un
 * mot-clé se lit sur sa page ou son sort, que le vocabulaire ne peut pas refuser) : la règle stricte (lib/mots-cles-cles.mjs#clesDesMotsCles) d'abord ;
 * si elle refuse, les mots-clés que la faute cite et qui peuvent attendre (`attendent` : ceux d'une page ou d'un sort, motsClesDePageOuDeSort ; ils ont
 * déjà une clé ; ni `exiges`) GARDENT LEUR CLÉ, et la règle juge les autres sans eux. De même ceux dont les clés se croiseraient, s'ils ont été renommés
 * (laCleSuitLeNom faux) : un croisement sans renommage reste un refus (ClesCroisees). Un mot-clé dont la clé
 * calculée serait alors celle d'un mot-clé qui garde la sienne garde aussi la sienne. La même fonction pour le service (recalculerLesCles, creerMotCle) et
 * pour le contrôle du contenu (serveur/controles-du-contenu.mjs, db:check) : ce que l'un tolère, l'autre ne le compte pas en erreur.
 * `motsCles` : [{ id, libelle, cle?, categories, parent? }] ; `gardes` : des ids qui gardent leur clé d'emblée ; `exiges` : des ids jugés par la règle
 * stricte (le mot-clé qu'on crée ou qu'on renomme au Glossaire : son refus reste un refus).
 * Lève HomonymesRefuses (une faute qu'aucun mot-clé en attente n'explique, ou qui cite un mot-clé exigé ou sans clé) ou ClesCroisees.
 * Rend { cles: Map(id → clé), tenus: Set (ceux qui gardent leur clé), aTrancher: [{ ids, base?, raison, cle? }] (les fautes tolérées) }.
 */
export function clesTenues(motsCles, categories, { attendent = new Set(), gardes = [], exiges = [] } = {}) {
  const parId = new Map(motsCles.map((m) => [m.id, m]));
  const exige = new Set(exiges);
  const aUneCle = (id) => typeof parId.get(id)?.cle === 'string' && parId.get(id).cle !== '';
  const ferme = (id) => exige.has(id) || !aUneCle(id);
  const peutAttendre = (id) => attendent.has(id) && !ferme(id);
  const tenus = new Set([...gardes].filter(aUneCle));
  const aTrancher = [];
  // un nom sans lettre ni chiffre (« ¿ ? ! ») n'a pas de clé (la règle lève une Error) : celui d'une page ou d'un sort garde la sienne, à trancher
  // (décision 1 de B3 : un renommage n'est jamais refusé) ; un autre reste l'erreur de la règle
  for (const m of motsCles) {
    if (!normalize(m.libelle ?? '') && peutAttendre(m.id) && !tenus.has(m.id)) {
      tenus.add(m.id);
      aTrancher.push({ ids: [m.id], raison: 'sans-lettre' });
    }
  }
  for (;;) {
    let cles;
    try {
      cles = clesDesMotsCles(motsCles.filter((m) => !tenus.has(m.id)), categories);
    } catch (e) {
      if (!(e instanceof HomonymesRefuses)) throw e;
      // la faute d'un mot-clé exigé ou sans clé reste un refus, dit pour lui seul
      const fermes = e.fautes.filter((f) => f.ids.some(ferme));
      if (fermes.length) throw fermes.length === e.fautes.length ? e : new HomonymesRefuses(fermes);
      const ecartes = [...new Set(e.fautes.flatMap((f) => f.ids))].filter(peutAttendre);
      if (!ecartes.length) throw e;
      for (const f of e.fautes) if (f.ids.some((id) => ecartes.includes(id))) aTrancher.push({ ids: [...f.ids], base: f.base, raison: f.raison, ...(f.cle ? { cle: f.cle } : {}) });
      for (const id of ecartes) tenus.add(id);
      continue;
    }
    // une clé calculée que tient un mot-clé qui garde la sienne
    const gardees = new Map([...tenus].map((id) => [parId.get(id).cle, id]));
    const heurts = [...cles].filter(([, cle]) => gardees.has(cle));
    if (heurts.length) {
      const fermes = heurts.filter(([id]) => ferme(id));
      if (fermes.length) throw new HomonymesRefuses(fermes.map(([id, cle]) => ({ base: normalize(parId.get(id).libelle), ids: [id, gardees.get(cle)], raison: 'cle-prise', cle })));
      for (const [id] of heurts) tenus.add(id);
      continue;
    }
    // des clés qui s'échangeraient : aucune ne s'écrit la première
    const courantes = new Map(motsCles.filter((m) => aUneCle(m.id)).map((m) => [m.cle, m.id]));
    let restants = [...cles].filter(([id, cle]) => parId.get(id).cle !== cle);
    for (;;) {
      const prets = restants.filter(([id, cle]) => !courantes.has(cle) || courantes.get(cle) === id);
      if (!prets.length) break;
      for (const [id, cle] of prets) {
        courantes.delete(parId.get(id).cle);
        courantes.set(cle, id);
      }
      restants = restants.filter((r) => !prets.includes(r));
    }
    if (restants.length) {
      // seul un mot-clé renommé (sa clé n'est plus faite de son nom) attend : des clés qui se croisent sans renommage (deux magies qui échangent leur
      // nom, parents de sorts homonymes) restent un refus, comme avant la migration 0136
      const ecartes = restants.map(([id]) => id).filter((id) => peutAttendre(id) && !laCleSuitLeNom(parId.get(id), categories));
      if (!ecartes.length) throw new ClesCroisees(restants.map(([id]) => id));
      aTrancher.push({ ids: ecartes, raison: 'croisees' });
      for (const id of ecartes) tenus.add(id);
      continue;
    }
    for (const id of tenus) cles.set(id, parId.get(id).cle);
    return { cles, tenus, aTrancher };
  }
}

/** Le repère du mot-clé `id`, noté au journal par `w` : son nom, et ce qui est donné de son adresse, sa définition, sa couleur et son icône. */
export function creerLeRepere(w, id, { nom, adresse = null, definition = null, couleur = null, icone = null }) {
  return w.inserer('repere', { mot_cle_id: id, nom, adresse: adresse || null, definition: definition || null, couleur: couleur || null, icone: icone || null });
}

/**
 * Écrit sur l'élément du mot-clé `m` (lib/mots-cles-db.mjs#lireUnMotCle) ceux de ses champs logiques `valeurs` qui changent, par `w` (notés au journal sur
 * la ligne de l'élément) : son repère les reçoit tous ; sa page, sa définition, sa couleur et son icône ; un sort, aucun (il n'a ni définition, ni
 * couleur, ni icône). Le nom et l'adresse d'un mot-clé de page ou de sort se lisent sur l'élément : les écrire est refusé. `refuser(message, champ)`
 * lève le refus de l'appelant (409). Rend les champs écrits.
 */
export function ecrireSurLElement(w, m, valeurs, refuser) {
  const voulue = (c) => (c === 'libelle' ? valeurs[c] : valeurs[c] || null);
  const changes = CHAMPS_DE_L_ELEMENT.filter((c) => Object.hasOwn(valeurs, c) && voulue(c) !== (m[c] ?? null));
  if (!changes.length) return [];
  const { table, id } = m.element ?? {};
  if (table === 'repere') {
    w.modifier('repere', { mot_cle_id: m.id }, Object.fromEntries(changes.map((c) => [COLONNES_DU_REPERE[c], voulue(c)])));
    return changes;
  }
  const sujet = motCleDansUnRefus(m.libelle);
  if (table !== 'page' && table !== 'sort') refuser(`${sujet} n’a ni page, ni sort, ni repère : rien ne porte ses champs.`, changes[0]);
  const lus = changes.filter((c) => !(c in COLONNES_DE_LA_PAGE));
  if (lus.length) {
    refuser(`${sujet} est celui d’${table === 'page' ? 'une page' : 'un sort'} : son nom et son adresse se lisent sur ${table === 'page' ? 'elle' : 'lui'}, ils ne s’écrivent pas sur le mot-clé.`, lus[0]);
  }
  if (table === 'sort') refuser(`${sujet} est celui d’un sort : il n’a ni définition, ni couleur, ni icône.`, changes[0]);
  w.modifier('page', { id }, Object.fromEntries(changes.map((c) => [COLONNES_DE_LA_PAGE[c], voulue(c)])));
  return changes;
}

/**
 * Le mot-clé `id` vient de recevoir une page ou un sort (`element` : { table, id }) : son repère part dans la même opération (un repère ne double jamais
 * une page ni un sort, docs/chantier-retrait-des-colonnes.md §2). Sa définition, sa couleur et son icône passent sur la page, là où elle n'en a pas ; un
 * sort n'en porte pas : `refuser(message)` si le repère en a une. `w` : le journal, ou les écritures brutes du rejeu (mêmes méthodes `modifier` et
 * `supprimer`). Rend le repère retiré, ou null.
 */
export function reprendreLeRepere(db, w, id, element, refuser) {
  if (!nomSurLElement(db)) return null; // avant la migration 0136, le repère n'est qu'une copie des colonnes du mot-clé : la page n'a pas où les recevoir
  const r = lireLigne(db, 'repere', { mot_cle_id: id });
  if (!r) return null;
  const portes = Object.values(COLONNES_DE_LA_PAGE).filter((c) => (r[c] ?? null) !== null);
  if (element.table === 'page') {
    const page = lireLigne(db, 'page', { id: element.id });
    const reprises = Object.fromEntries(portes.filter((c) => (page?.[c] ?? null) === null).map((c) => [c, r[c]]));
    if (Object.keys(reprises).length) w.modifier('page', { id: element.id }, reprises);
  } else if (portes.length) {
    refuser(`${motCleDansUnRefus(r.nom)} porte une définition, une couleur ou une icône : le mot-clé d’un sort n’en a pas. Retirez-les d’abord de son repère.`);
  }
  w.supprimer('repere', { mot_cle_id: id });
  return r;
}

/**
 * Le refus (409, sans numéro de décision : une session Créateur ne l'ouvre pas) d'un repère qu'un lot de changements insère (table `repere`, migration
 * 0135 ; docs/chantier-retrait-des-colonnes.md, §2), ou null : un repère est l'élément d'un mot-clé qui existe et que ne désigne ni une page ni un sort
 * (`page.mot_cle_id`, `sort.mot_cle_id`). Sa clé ne se modifie pas (lib/lot-de-changements.mjs). `restaurer` : l'annulation d'un lot remet un repère
 * qu'il a retiré ; la page ou le sort qui l'avait remplacé part peut-être juste après (une page de notion et son repère sont groupés : seul l'état final
 * se juge, par la règle `repere_en_double` des contrôles du contenu), seul un mot-clé absent est refusé.
 */
export function refusDuRepere(db, table, valeurs, { restaurer = false } = {}) {
  if (table !== 'repere') return null;
  const id = valeurs?.mot_cle_id;
  if (!Number.isInteger(id) || !db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(id)) return `Repère : le mot-clé ${JSON.stringify(id ?? null)} n’existe pas.`;
  if (restaurer) return null;
  // l'identifiant de la page ou du sort, pas son nom : un refus qui citerait « R… » serait lu comme un verrou (edition-lots.mjs#decisionsCitees)
  const page = db.prepare('SELECT id FROM page WHERE mot_cle_id = ?').get(id);
  if (page) return `Repère : le mot-clé ${id} a déjà une page (${page.id}) ; son nom et son adresse se lisent sur elle, il ne reçoit pas de repère.`;
  const sort = db.prepare('SELECT id FROM sort WHERE mot_cle_id = ?').get(id);
  if (sort) return `Repère : le mot-clé ${id} a déjà un sort (${sort.id}) ; son nom et son adresse se lisent sur lui, il ne reçoit pas de repère.`;
  return null;
}

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
 * Une fusion reporte sur le mot-clé conservé `cibleId` les références de la base au mot-clé `sourceId` (migration 0125 : type_degats.mot_cle_id,
 * magie.mot_cle_id ; lib/mentions-des-mots-cles.mjs#REFERENCES_AUX_MOTS_CLES), chacune par une modification notée au journal par `w`, avant la
 * suppression de la source (clé étrangère sans cascade). Rend les références reportées ([{ table, colonne, id }]). Le service refuse avant d'écrire
 * la fusion de deux mots-clés cités chacun par une magie (un seul mot-clé par magie : serveur/edition-chronologie.mjs#verifierSansReference).
 */
export function reporterLesReferences(db, w, sourceId, cibleId) {
  const reportees = [];
  for (const r of referencesDesMotsCles(db, [sourceId])) {
    w.modifier(r.table, { id: r.id }, { [r.colonne]: cibleId });
    reportees.push({ table: r.table, colonne: r.colonne, id: r.id });
  }
  return reportees;
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
  const vocabulaire = motsClesDeLaBase(db, { elements: false });
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
 * domaines }. `ErreurEdition` : la classe d'erreur du service (statut HTTP, message, détails). `sousLeVerrou`, `refusDuVerrou`, `refusDeLaSecondeCategorie` : le verrou d'un
 * mot-clé ancré (décision R309, serveur/edition-ancrage.mjs, qui importe ce module : donnés par serveur/edition.mjs).
 */
export function outilsDesMotsCles({ ErreurEdition, sousLeVerrou, refusDuVerrou, refusDeLaSecondeCategorie }) {
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
   * `champ: 'libelle'`). Le mot-clé d'une page ou d'un sort n'est jamais la cause d'un refus (son nom se lit sur son élément, qu'on renomme librement :
   * docs/chantier-ancrage-mots-cles.md, choix 7) : il garde sa clé (clesTenues), sauf s'il est dans `exiges` (celui qu'on crée, ou dont on change le
   * type). Rend Map(id → { avant, apres }) des clés changées.
   */
  function recalculerLesCles(ctx, { exiges = [] } = {}) {
    const { db, w } = ctx;
    // l'annulation d'un lot d'ancrage remet ses lignes une à une : seul l'état final se juge, le recalcul vient après (edition-lots.mjs#annulerLeLot)
    if (ctx.clesEnAttente) return new Map();
    if (!tableExiste(db, 'categorie_mot_cle')) return new Map();
    const motsCles = motsClesDeLaBase(db, { elements: false });
    const categories = new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle]));
    const avant = vocabulaireDesMotsCles(motsCles);
    // un mot-clé de page ou de sort dont la règle refuse le nom garde sa clé (clesTenues) : renommer une page ou un sort n'est jamais refusé ; de même
    // quand sa clé s'écrirait comme le synonyme d'un autre mot-clé (R233 (4)). `exiges` : ceux pour qui le refus reste un refus
    const attendent = motsClesDePageOuDeSort(db);
    const gardes = new Set();
    let changements;
    for (;;) {
      let cles;
      try {
        ({ cles } = clesTenues(motsCles, categories, { attendent, gardes, exiges }));
      } catch (e) {
        if (e instanceof HomonymesRefuses) throw refusDesHomonymes(e, motsCles);
        if (e instanceof ClesCroisees) throw new ErreurEdition(409, 'Les clés de ces mots-clés s’échangeraient : enregistrez ces modifications en deux fois.', { champ: 'libelle', mots_cles: e.ids });
        throw e;
      }
      changements = new Map();
      for (const m of motsCles) if (cles.get(m.id) !== m.cle) changements.set(m.id, { avant: m.cle, apres: cles.get(m.id) });
      let repris = false;
      for (const [id, { apres }] of changements) {
        const m = avant.parId.get(id);
        const [pris] = synonymesPris(avant, { id, libelle: m.libelle, cle: apres });
        if (!pris) continue;
        if (attendent.has(id) && !exiges.includes(id) && !gardes.has(id)) {
          gardes.add(id);
          repris = true;
          break;
        }
        throw new ErreurEdition(409, `La clé « ${apres} » de ${nom(m)} s’écrit comme le synonyme « ${pris.synonyme} » du mot-clé ${nom(pris.m)} (décision R233 (4)).`,
          { champ: 'libelle', mot_cle: pris.m.id });
      }
      if (!repris) break;
    }
    // une clé quittée que porte de nouveau un mot-clé (créé ou renommé vers elle) n'est plus une clé quittée (R232 : la clé courante se cherche d'abord)
    if (tableExiste(db, 'mot_cle_ancienne_cle')) {
      for (const { cle } of db.prepare('SELECT a.cle FROM mot_cle_ancienne_cle a JOIN mot_cle m ON m.cle = a.cle ORDER BY a.cle').all()) w.supprimer('mot_cle_ancienne_cle', { cle });
    }
    if (!changements.size) return changements;
    // les clés, dans un ordre qui ne heurte jamais l'unicité de mot_cle.cle (une clé n'est écrite qu'une fois libérée ; clesTenues a écarté les échanges)
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

  /** Le mot-clé `id` (un entier) de la base, son nom lu sur son élément (lib/mots-cles-db.mjs#lireUnMotCle), ou 404. */
  function motCle(db, id, quoi = 'Mot-clé') {
    const m = Number.isInteger(id) ? lireUnMotCle(db, id) : null;
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
    const vocabulaire = motsClesDeLaBase(db, { elements: false });
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
   * verrou »). Les clés sont recalculées (un homonyme sans catégorie distinctive : 409, `champ: 'categories'`), et les textes réécrits. Décision R309, qui remplace R232 (5) :
   * refusée sur un mot-clé ancré, et quand la liste ajoute une catégorie et en laisse plusieurs ; dans un lot, c'est l'état de fin qui se juge (edition-ancrage.mjs#secondesCategories).
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
    const ferme = refusDuVerrou(ctx, m.id, ['categories']);
    if (ferme) throw new ErreurEdition(409, ferme, { champ: 'categories' });
    if (ctx.voie !== 'lot' && sousLeVerrou(ctx) && ids.length > 1 && ids.some((c) => !actuelles.includes(c))) {
      throw new ErreurEdition(409, refusDeLaSecondeCategorie(m.libelle, ids.length), { champ: 'categories' });
    }
    poserLesCategories(ctx, m.id, ids);
    const cles = recalculerLesCles(ctx, { exiges: [m.id] }); // le refus de ses catégories reste un refus, même pour le mot-clé d'une page
    const noms = ids.map((id) => lireLigne(db, 'categorie_mot_cle', { id }).libelle);
    return `Mot-clé ${m.libelle} : ${noms.length ? `catégories ${noms.join(', ')}` : 'sans catégorie'}${resumeDesCles(cles)}`;
  }

  /**
   * `{ op: 'synonymes_mot_cle', mot_cle, synonymes: [écritures], avant?: [écritures] }` : les synonymes d'un mot-clé, dans l'ordre (décision R233 ;
   * `avant` : ceux que la page a lus, dans l'ordre, 409 s'ils ont changé entre-temps). Permis sur un mot-clé verrouillé (demande du propriétaire : seule sa suppression
   * reste refusée, ce qui lève R233 (6) hors fusion) ; refusé pour un synonyme qui ne convient pas (refuserLesSynonymes).
   */
  function synonymesMotCle(ctx, op) {
    const { db } = ctx;
    const m = motCle(db, op.mot_cle);
    if (!tableExiste(db, 'mot_cle_synonyme')) throw refus('Les synonymes des mots-clés n’existent pas dans cette base (migration 0115).');
    if (!Array.isArray(op.synonymes) || !op.synonymes.every((s) => typeof s === 'string')) throw refus(`Mot-clé ${nom(m)} : liste de synonymes attendue.`, { champ: 'synonymes' });
    const synonymes = [];
    for (const s of op.synonymes.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) if (!synonymes.includes(s)) synonymes.push(s);
    const actuels = synonymesDuMotCle(db, m.id).map((s) => s.libelle);
    if (Array.isArray(op.avant) && !memeListe(op.avant, actuels, { ordre: true })) {
      throw new ErreurEdition(409, `Mot-clé ${nom(m)} : ses synonymes ont changé entre-temps. Rechargez la page.`, { champ: 'synonymes' });
    }
    if (memeListe(synonymes, actuels, { ordre: true })) return `Mot-clé ${m.libelle} : synonymes inchangés`;
    const ferme = refusDuVerrou(ctx, m.id, ['synonymes']); // décision R309 : ceux d'un mot-clé ancré se corrigent par un lot
    if (ferme) throw new ErreurEdition(409, ferme, { champ: 'synonymes' });
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
      // le nom d'un mot-clé se lit sur son élément (vue v_mot_cle, migration 0136)
      const portent = db.prepare('SELECT m.id, m.libelle FROM mot_cle_categorie l JOIN v_mot_cle m ON m.id = l.mot_cle_id WHERE l.categorie_id = ? ORDER BY m.cle')
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
