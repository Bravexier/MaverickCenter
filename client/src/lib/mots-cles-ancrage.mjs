// Ce que l'ancrage des mots-clés doit faire (décision R309, docs/chantier-ancrage-mots-cles.md, §2 à §5) : un mot-clé par page, sort et type de sort. Calcul
// pur : il lit la base et rend des lots de changements (`maverick-lot/1`), il n'écrit rien ; l'action « Préparer l'ancrage » les dépose, un par un, et
// recalcule le plan après chacun. Il ne prend que ce qui manque encore (rejouable) et ne devine rien : un élément que la règle ne sait pas nommer ou
// classer est laissé de côté et listé « à trancher ».
//   Lot 1 (`noms`) : les catégories nouvelles, le type unique, les ancres des mots-clés existants. Depuis la migration 0136 (docs/chantier-retrait-des-colonnes.md),
//   le nom et l'adresse d'un mot-clé se lisent sur son élément : rien ne s'aligne ni ne se recopie, l'ancre posée lui donne le nom de sa page.
//   Lots 2 à 4 (`sorts`, `pages`, `capacites`) : les mots-clés créés. Leur `ancrage.type` est un id de catégorie : ils ne sont rendus qu'une fois les quatre
//   catégories nouvelles en base (l'action recalcule le plan après le lot 1) ; `comptes` décrit tout de même l'ancrage entier.
//   Lot 5 (`notions`, docs/chantier-pages-de-notion.md, §3 ; R309 (7)) : la page de notion de chaque mot-clé sans élément, ou dont les éléments ne sont que
//   types de sort, types de dégâts et monnaies, et sans adresse. Rendu seulement quand les quatre autres n'ont plus rien à faire.
// Sans dépendance navigateur ni Astro : la base est passée par l'appelant.
import { adresseDeLaPage, adresseDeLaPageEnBase, adresseDuSort, adresseDuSortEnBase, adressesDuSite, slugsDAdresse } from './adresses-db.mjs';
import { FORMAT_DU_LOT } from './lot-de-changements.mjs';
import { AUTEUR_DE_L_ANCRAGE, DECISION_DE_L_ANCRAGE } from './lots-d-ancrage.mjs';
import { referencesDesMotsCles } from './mentions-des-mots-cles.mjs';
import { synonymesPris, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { clesDesMotsCles, HomonymesRefuses, RAISONS } from './mots-cles-cles.mjs';
import { categoriesDesMotsCles, elementsDesMotsCles, motsClesDeLaBase } from './mots-cles-db.mjs';
import { fauteDeLUrl } from './mots-cles-liens.mjs';
import { normalize } from './text.mjs';

/** Les quatre catégories que l'ancrage crée (conception, §2). */
export const CATEGORIES_NOUVELLES = Object.freeze(['Notion', 'Guide', 'Ressource', 'Type de sort']);

/** Le type d'un mot-clé créé pour une page, selon sa rubrique (conception, §2). */
export const TYPE_DE_RUBRIQUE = Object.freeze({
  capacites: 'Don', classes: 'Classe', races: 'Race', metiers: 'Métier', bestiaire: 'Bestiaire', guide: 'Guide', ressources: 'Ressource',
});

/** Le type unique des 77 mots-clés qui ont plusieurs catégories ou aucune (conception, §3, décision 18). */
export const TYPE_UNIQUE = {
  Alignement: [10, 421, 422, 423, 424, 425, 426, 428, 429], Équipement: [21, 22, 39, 198, 301, 302, 331, 431, 432], Métier: [25, 240, 325],
  'Fiche de personnage': [37, 121, 122, 123, 125, 137, 139, 140, 141, 226, 318, 323, 362, 368, 369, 373], Classe: [43, 68, 260], Bestiaire: [48, 414],
  Notion: [51, 130, 245, 246, 289, 420, 430, 446], Magie: [60, 115, 222, 297, 356, 417, 418, 419],
  Faction: [63, 106, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348], Événement: [190], Guide: [201], Dégâts: [308, 365, 442, 443],
};

/** Les mots-clés existants qui reprennent une page (décision 3) : id du mot-clé → id de la page. */
export const REPRISES = new Map([[31, 'guide/fiche-attributs'], [162, 'guide/initiative'], [56, 'guide/fiche-caracteristiques'], [420, 'guide/le-mode-hyper-100']]);

// le type de sort `meteo` reprend #239, qui garde son nom et son adresse (décision 3) ; `aleatoire` n'a aucun mot-clé tant qu'aucun sort ne l'utilise
const TYPE_REPRIS = Object.freeze({ code: 'meteo', mot_cle: 239 });
const TYPE_D_UN_SORT = 'Sort';
const TYPE_D_UN_TYPE_DE_SORT = 'Type de sort';
const OPERATIONS_MAX = 2000; // le plafond d'un lot (serveur/edition-lots.mjs) : le reste vient au plan suivant
const TITRES = Object.freeze({
  noms: 'Ancrage des mots-clés : catégories, type unique, noms et pages déjà désignées',
  sorts: 'Ancrage des mots-clés : sorts et types de sort',
  pages: 'Ancrage des mots-clés : pages hors capacités',
  capacites: 'Ancrage des mots-clés : capacités de classe',
  notions: 'Ancrage des mots-clés : pages de notion',
});
// les éléments qui laissent un mot-clé candidat à sa page de notion (famille B, conception §3) : ils n'ont ni nom ni adresse à eux
const ELEMENTS_SANS_PAGE = new Set(['type_sort', 'type_degats', 'monnaie']);

const TYPE_DU_MOT_CLE = new Map(Object.entries(TYPE_UNIQUE).flatMap(([type, ids]) => ids.map((id) => [id, type])));

/** Vrai si le mot-clé renvoie à un élément : une référence de la base (page, sort, type de sort, magie, type de dégâts), ou une monnaie. */
export function estAncre(db, id) {
  if (referencesDesMotsCles(db, [id]).length) return true;
  return (db.prepare('SELECT * FROM mot_cle WHERE id = ?').get(id)?.monnaie_id ?? null) !== null;
}

/**
 * Les noms qu'ont quittés les catégories renommées : Map(nom normalisé → ids, du plus ancien renommage au plus récent), lus dans l'historique puis le journal. Une catégorie
 * n'a pas de colonne qui dise son rôle ; son renommage est permis (conception, §7) et sa trace suffit à la retrouver, sans numéro écrit en dur.
 */
function nomsQuittesDesCategories(db) {
  const sortie = new Map();
  const requetes = [
    ['historique_modification', "SELECT cle, avant, apres FROM historique_modification WHERE table_nom = 'categorie_mot_cle' AND operation = 'modifier' ORDER BY fait_le, lot_id, rang"],
    ['modification', `SELECT m.cle, m.avant, m.apres FROM modification m JOIN modification_lot l ON l.id = m.lot_id
      WHERE m.table_nom = 'categorie_mot_cle' AND m.operation = 'modifier' AND m.etat <> 'conflit' ORDER BY l.fait_le, m.lot_id, m.rang`],
  ];
  for (const [table, sql] of requetes) {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) continue;
    for (const l of db.prepare(sql).all()) {
      const quitte = l.avant ? JSON.parse(l.avant).libelle : undefined;
      if (typeof quitte !== 'string' || quitte === (l.apres ? JSON.parse(l.apres).libelle : undefined)) continue;
      const nom = normalize(quitte);
      if (!sortie.has(nom)) sortie.set(nom, []);
      sortie.get(nom).push(JSON.parse(l.cle).id);
    }
  }
  return sortie;
}

/** Les catégories en base et `idDe(libellé)` : celle qui porte ce nom, sinon la première qui l'a quitté en étant renommée et qui existe encore ; null sinon. */
function categoriesEnPlace(db) {
  const enPlace = categoriesDesMotsCles(db);
  const parNom = new Map(enPlace.map((c) => [normalize(c.libelle), c.id]));
  const ids = new Set(enPlace.map((c) => c.id));
  const quittes = nomsQuittesDesCategories(db);
  return { enPlace, idDe: (libelle) => parNom.get(normalize(libelle)) ?? quittes.get(normalize(libelle))?.find((id) => ids.has(id)) ?? null };
}

/** L'id de la catégorie d'un type (`Guide`, `Sort`, un type de rubrique…), même renommée au Glossaire ; null si elle n'existe pas. */
export const categorieDuType = (db, libelle) => categoriesEnPlace(db).idDe(libelle);

/**
 * Les catégories, celles à créer comprises : `idDe(libellé)` (celle en base, même renommée, ou un id provisoire au-delà des existants, pour que la règle des clés les lise
 * dans le même ordre), `valeur(id)` (ce qu'un lot écrit : l'id, ou le jeton d'une catégorie à créer), `libelles` (Map id → libellé).
 */
function lesCategories(db) {
  const { enPlace, idDe: idEnPlace } = categoriesEnPlace(db);
  const plusHaut = Math.max(0, ...enPlace.map((c) => c.id));
  const nouvelles = CATEGORIES_NOUVELLES.filter((l) => idEnPlace(l) === null).map((libelle, i) => ({ libelle, jeton: `c${i + 1}`, id: plusHaut + i + 1 }));
  const nouvelleDe = new Map(nouvelles.map((c) => [normalize(c.libelle), c.id]));
  const jetons = new Map(nouvelles.map((c) => [c.id, { $numero: c.jeton }]));
  return {
    nouvelles,
    idDe: (libelle) => idEnPlace(libelle) ?? nouvelleDe.get(normalize(libelle)) ?? null,
    valeur: (id) => jetons.get(id) ?? id,
    libelles: new Map([...enPlace, ...nouvelles].map((c) => [c.id, c.libelle])),
  };
}

/** Les écritures de chaque type de sort dans ses sorts : Map(code → [libellés]) ; un code qu'aucun sort n'utilise n'y est pas. */
function libellesDesTypes(db) {
  const sortie = new Map();
  for (const t of db.prepare('SELECT DISTINCT type, libelle FROM sort_type ORDER BY type, libelle').all()) (sortie.get(t.type) ?? sortie.set(t.type, []).get(t.type)).push(t.libelle);
  return sortie;
}

/**
 * Le vocabulaire tel que le plan le laisserait : noms des mots-clés ancrés (un mot-clé prend le nom de l'élément qu'on lui donne pour ancre : son nom se lit
 * sur lui), types uniques, éléments créés (ids négatifs, provisoires).
 */
function vocabulaireFutur(motsCles, elements, reclasses) {
  const noms = new Map(elements.filter((e) => e.mot_cle !== null && e.ancrer).map((e) => [e.mot_cle, e.nom]));
  const futurs = motsCles.map((m) => ({ ...m, libelle: noms.get(m.id) ?? m.libelle, categories: reclasses.has(m.id) ? [reclasses.get(m.id)] : m.categories }));
  const crees = new Map();
  elements.filter((e) => e.mot_cle === null).forEach((e, i) => {
    crees.set(-(i + 1), e);
    futurs.push({ id: -(i + 1), libelle: e.nom, categories: [e.type], parent: e.parent ?? null, synonymes: [] });
  });
  return { futurs, crees };
}

/** Ce que la règle refuse dans ce vocabulaire : homonymes et clés (R232), écritures prises par un synonyme (R233 (4)) : [{ ids, base, raison }]. */
export function fautesDuVocabulaire(futurs, libelles, parId) {
  let cles;
  try {
    cles = clesDesMotsCles(futurs, libelles);
  } catch (e) {
    if (!(e instanceof HomonymesRefuses)) throw e;
    return e.fautes.map((f) => ({ ids: f.ids, base: f.base, raison: `${RAISONS[f.raison]} (« ${f.cle ?? f.base} »)` }));
  }
  const vocabulaire = vocabulaireDesMotsCles(futurs.map((m) => ({ ...m, cle: cles.get(m.id) })));
  const fautes = [];
  for (const m of vocabulaire.liste) {
    const avant = parId.get(m.id);
    if (avant && avant.libelle === m.libelle && avant.cle === m.cle) continue;
    const base = normalize(m.libelle);
    const propre = avant && avant.libelle !== m.libelle ? m.synonymes.find((s) => normalize(s) === base) : undefined;
    if (propre) fautes.push({ ids: [m.id], base, raison: `son nom s’écrirait comme son propre synonyme « ${propre} »` });
    const [pris] = synonymesPris(vocabulaire, { id: m.id, libelle: m.libelle, cle: m.cle });
    if (pris) fautes.push({ ids: [m.id], base, raison: `s’écrit comme le synonyme « ${pris.synonyme} » du mot-clé « ${pris.m.libelle} »` });
  }
  return fautes;
}

/**
 * Retire du plan ce que la règle refuse, jusqu'à ce qu'elle accepte le vocabulaire : à chaque faute, le plus récent de ceux qu'elle cite (une création,
 * sinon un renommage, sinon un reclassement), puis, si elle n'en cite aucun (un mot-clé en place dont la clé changerait), ses homonymes. Une faute que
 * rien du plan ne cause (une base déjà fautive) est listée et laissée. Rend les éléments gardés.
 */
function eprouver({ motsCles, parId, libelles, elements, reclasses, trancher }) {
  let gardes = elements;
  const faits = new Set();
  for (;;) {
    const { futurs, crees } = vocabulaireFutur(motsCles, gardes, reclasses);
    const fautes = fautesDuVocabulaire(futurs, libelles, parId).filter((f) => !faits.has(f.raison));
    if (!fautes.length) return gardes;
    const [faute] = fautes;
    const renommes = new Map(gardes.filter((e) => e.mot_cle !== null && e.ancrer && e.nom !== parId.get(e.mot_cle)?.libelle).map((e) => [e.mot_cle, e]));
    const homonymes = futurs.filter((m) => normalize(m.libelle) === faute.base).map((m) => m.id);
    const retires = new Set();
    let reclassesRetires = [];
    for (const groupe of [faute.ids, homonymes]) {
      const nouveaux = groupe.filter((id) => crees.has(id)).map((id) => crees.get(id));
      const renommesCites = groupe.filter((id) => renommes.has(id)).map((id) => renommes.get(id));
      const reclassesCites = groupe.filter((id) => reclasses.has(id));
      if (nouveaux.length) nouveaux.forEach((e) => retires.add(e));
      else if (renommesCites.length) {
        renommesCites.forEach((e) => retires.add(e));
        reclassesRetires = renommesCites.map((e) => e.mot_cle).filter((id) => reclasses.has(id));
      } else reclassesRetires = reclassesCites;
      if (retires.size || reclassesRetires.length) break;
    }
    if (!retires.size && !reclassesRetires.length) {
      for (const id of faute.ids) if (parId.has(id)) trancher('mot_cle', id, parId.get(id).libelle, faute.raison);
      faits.add(faute.raison);
      continue;
    }
    for (const e of retires) trancher(e.table, e.id, e.nom, faute.raison);
    for (const id of reclassesRetires) {
      if (![...retires].some((e) => e.mot_cle === id)) trancher('mot_cle', id, parId.get(id).libelle, faute.raison);
      reclasses.delete(id);
      // il garde ses catégories : ce qu'il devait ancrer attend avec lui
      for (const e of gardes) {
        if (e.mot_cle !== id || !e.ancrer || retires.has(e)) continue;
        retires.add(e);
        trancher(e.table, e.id, e.nom, `son mot-clé #${id} n’a pas de type unique`);
      }
    }
    gardes = gardes.filter((e) => !retires.has(e));
  }
}

const jetonSuivant = () => {
  let n = 0;
  return () => `m${(n += 1)}`;
};

/**
 * La création d'un mot-clé ancré, sans `cle`, que le service calcule. Celui d'une page ou d'un sort : son id seul (son nom et son adresse se lisent sur
 * l'élément, migration 0136). Celui d'un type de sort, qui n'a pas de nom à lui : son id et son nom, que son repère porte (docs/chantier-retrait-des-colonnes.md, §2).
 */
function creation(e, jeton) {
  const id = { $numero: jeton() };
  const apres = e.table === 'type_sort' ? { id, libelle: e.nom } : { id };
  return { table: 'mot_cle', cle: { id }, operation: 'inserer', apres, ancrage: { table: e.table, id: e.id, type: e.type } };
}

/**
 * Le refus de la création ancrée sur la page ou le sort `id` (`table`), ou null : le lien que son mot-clé lirait sur l'élément (lib/adresses-db.mjs) doit mener à
 * une page du site, comme le lien qu'un lot d'avant la migration 0136 donnait au mot-clé créé (serveur/edition.mjs#refuserLeLien, même motif). Le lot ne
 * donne plus ce lien, que le service ne contrôle donc plus : le lot le refuse à sa ligne, avant les contrôles du contenu de la fin. Null aussi pour un type de
 * sort (pas d'adresse) ou un élément absent (le service le refuse). `adresses` : adressesDuSite(db), lu une fois par l'appelant.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ table: string, id: string }} element
 */
export function refusDuLienDeLAncre(db, { table, id }, adresses = null) {
  const ligne = table === 'page' ? db.prepare('SELECT titre AS nom FROM page WHERE id = ?').get(id)
    : table === 'sort' ? db.prepare('SELECT nom FROM sort WHERE id = ?').get(id) : null;
  if (!ligne) return null;
  const url = table === 'page' ? adresseDeLaPageEnBase(db, id) : adresseDuSortEnBase(db, id);
  const faute = fauteDeLUrl(url, adresses ?? adressesDuSite(db));
  return faute ? `Mot-clé « ${ligne.nom} » : le lien « ${url} » ne convient pas (${faute}).` : null;
}

/** Le changement de catégories d'un reclassé : retirer celles qu'il perd, poser son type s'il ne l'a pas. */
function reclassement(m, categorie, valeur) {
  const ops = [];
  for (const c of m.categories) {
    if (c !== categorie) ops.push({ table: 'mot_cle_categorie', cle: { mot_cle_id: m.id, categorie_id: c }, operation: 'supprimer', avant: { mot_cle_id: m.id, categorie_id: c } });
  }
  if (!m.categories.includes(categorie)) {
    const ligne = { mot_cle_id: m.id, categorie_id: valeur(categorie) };
    ops.push({ table: 'mot_cle_categorie', cle: ligne, operation: 'inserer', apres: { ...ligne } });
  }
  return ops;
}

/**
 * L'identifiant d'une page de notion sans le service (un calcul pur, les tests) : guide/<normalize(nom)>, suffixé -2, -3… tant qu'une page porte cet id ou que
 * `pris` le contient ; null si le nom n'a ni lettre ni chiffre. Le service donne le sien (serveur/edition-notions.mjs#idDeNotion), qui connaît aussi le journal,
 * les noms réservés et les onglets.
 */
function idDeNotionLocal(db, nom, pris) {
  const cle = normalize(String(nom ?? ''));
  if (!cle) return null;
  const existe = db.prepare('SELECT 1 FROM page WHERE id = ?');
  let id = `guide/${cle}`;
  for (let n = 2; pris.has(id) || existe.get(id); n += 1) id = `guide/${cle}-${n}`;
  return id;
}

/**
 * Les pages de notion (lot 5, conception §3) : une opération par mot-clé candidat, par id croissant. Candidat : un mot-clé sans élément, ou dont les éléments
 * sont tous des types de sort, de dégâts ou des monnaies (lib/mots-cles-db.mjs#elementsDesMotsCles), et que le plan n'ancre pas sur une page dans ce même
 * calcul (`ancres`). Il ne devine rien : un candidat qui a une adresse, un nom sans lettre ni chiffre, un nom déjà titre, slug ou alias d'une page (`cle_page`),
 * deux candidats de même nom, un id introuvable sont « à trancher », sans opération. `notion:<mot_cle_id>` écartée : sautée. Jamais candidats (« Choix de l'équipe », 12) : un
 * mot-clé sans type unique après ce plan (`sansTypeUnique` : déjà « à trancher » pour son type, ou dont le reclassement `type:<id>` est écarté), et les mots-clés
 * repris (REPRISES, TYPE_REPRIS), même quand la ligne de leur reprise a été annulée.
 */
function pagesDeNotion(db, { motsCles, ancres, sansTypeUnique, idDeNotion, retenu, trancher }) {
  const elements = elementsDesMotsCles(db);
  const exclus = (m) => ancres.has(m.id) || sansTypeUnique.has(m.id) || REPRISES.has(m.id) || m.id === TYPE_REPRIS.mot_cle;
  const candidats = motsCles.filter((m) => !exclus(m) && (elements.get(m.id) ?? []).every((e) => ELEMENTS_SANS_PAGE.has(e.table))).sort((a, b) => a.id - b.id);
  const homonymes = new Map();
  for (const m of candidats) homonymes.set(normalize(m.libelle), (homonymes.get(normalize(m.libelle)) ?? 0) + 1);
  const pageDuNom = db.prepare('SELECT page_id FROM cle_page WHERE cle = ? ORDER BY page_id LIMIT 1');
  const pris = new Set();
  const operations = [];
  for (const m of candidats) {
    const cle = normalize(m.libelle);
    const page = cle ? pageDuNom.get(cle)?.page_id : undefined;
    let raison = null;
    if (m.url) raison = `il mène déjà à ${m.url}`;
    else if (!cle) raison = 'son nom n’a ni lettre ni chiffre';
    else if (page) raison = `c’est déjà le nom de la page « ${page} »`;
    else if (homonymes.get(cle) > 1) raison = 'un autre mot-clé sans page porte le même nom';
    if (raison) {
      trancher('mot_cle', m.id, m.libelle, raison);
      continue;
    }
    if (!retenu(`notion:${m.id}`)) continue;
    const id = idDeNotion(m.libelle, pris);
    if (!id) {
      trancher('mot_cle', m.id, m.libelle, 'aucun identifiant libre pour sa page');
      continue;
    }
    pris.add(id);
    operations.push({ table: 'page', cle: { id }, operation: 'inserer', apres: { id, titre: m.libelle, mot_cle_id: m.id }, ancrage: { notion: true } });
  }
  return operations;
}

/**
 * Le plan de l'ancrage. `ecartees` : les clés à ne pas refaire (`page:<id>`, `sort:<id>`, `type_sort:<id>`, `nom:<mot_cle_id>`, `type:<mot_cle_id>`,
 * `notion:<mot_cle_id>`), sautées et rendues dans `ecartees` quand elles ont retenu quelque chose. `idDeNotion(nom, pris)` : l'id de la page de notion de `nom`,
 * hors de `pris` (les ids déjà retenus par ce lot), ou null ; le service donne le sien, sinon une version locale (idDeNotionLocal). Le lot `notions` n'est rendu
 * que quand les quatre autres n'ont plus d'opération ; `comptes.notions` le compte dans tous les cas.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ ecartees?: Set<string>, idDeNotion?: ((nom: string, pris: Set<string>) => string | null) | null }} [options]
 * @returns {{ lots: object[], a_trancher: { table: string, id: string | number, nom: string, raison: string }[], ecartees: string[],
 *   comptes: { crees: number, capacites: number, autres_pages: number, sorts: number, types: number, renommes: number, reclasses: number, ancres_existants: number,
 *   notions: number } }}
 */
export function planDeLAncrage(db, { ecartees = new Set(), idDeNotion = null } = {}) {
  const motsCles = motsClesDeLaBase(db, { elements: false });
  const parId = new Map(motsCles.map((m) => [m.id, m]));
  const categories = lesCategories(db);
  const aTrancher = new Map();
  const trancher = (table, id, nom, raison) => {
    const k = `${table}:${id}`;
    if (!aTrancher.has(k)) aTrancher.set(k, { table, id, nom, raison });
  };
  const sautees = new Set();
  const retenu = (cle) => {
    if (!ecartees.has(cle)) return true;
    sautees.add(cle);
    return false;
  };

  // le type de chaque mot-clé existant : le sien s'il en a exactement un, sinon la liste du §3
  const reclasses = new Map();
  const sansType = new Set();
  for (const m of motsCles) {
    if (m.categories.length === 1) continue;
    const type = TYPE_DU_MOT_CLE.get(m.id);
    const categorie = type ? categories.idDe(type) : null;
    if (categorie === null) {
      sansType.add(m.id);
      trancher('mot_cle', m.id, m.libelle, type ? `son type « ${type} » n’existe plus` : 'plusieurs catégories ou aucune, et absent de la liste des types uniques');
    } else if (retenu(`type:${m.id}`)) reclasses.set(m.id, categorie);
  }

  const elements = [];
  const pages = db.prepare("SELECT id, type, titre, mot_cle_id FROM page WHERE statut <> 'example' ORDER BY id").all();
  const idsDesPages = new Set(pages.map((p) => p.id));
  for (const [id, page] of REPRISES) {
    if (parId.has(id) && !idsDesPages.has(page)) trancher('mot_cle', id, parId.get(id).libelle, `la page reprise « ${page} » a disparu`);
  }
  const repriseDe = new Map([...REPRISES].map(([id, page]) => [page, id]));
  const parAdresse = new Map();
  for (const m of motsCles) if (m.url && !REPRISES.has(m.id)) (parAdresse.get(m.url) ?? parAdresse.set(m.url, []).get(m.url)).push(m);
  const pris = new Map(pages.filter((p) => p.mot_cle_id !== null).map((p) => [p.mot_cle_id, p.id]));
  // l'adresse d'aujourd'hui d'une page, et d'un sort par celle de sa magie : son segment renommé lu en base (R316)
  const segments = slugsDAdresse(db);
  const adresseDe = (id) => adresseDeLaPage(id, segments.get(id) ?? null);
  const adresseDuSortDe = (sortId) => adresseDuSort(sortId, segments.get(String(sortId).split('#sort:')[0]) ?? null);

  for (const p of pages) {
    const adresse = adresseDe(p.id);
    const base = { cle: `page:${p.id}`, table: 'page', id: p.id, nom: p.titre, adresse };
    if (!normalize(p.titre)) {
      if (p.mot_cle_id === null) trancher('page', p.id, p.titre, 'son titre n’a ni lettre ni chiffre');
      continue;
    }
    let m = null;
    if (p.mot_cle_id !== null) m = parId.get(p.mot_cle_id);
    else if (repriseDe.has(p.id)) {
      m = parId.get(repriseDe.get(p.id));
      if (!m) {
        trancher('page', p.id, p.titre, `le mot-clé repris #${repriseDe.get(p.id)} a disparu`);
        continue;
      }
    } else {
      const designes = parAdresse.get(adresse) ?? [];
      if (designes.length > 1) {
        trancher('page', p.id, p.titre, `plusieurs mots-clés ont son adresse : ${designes.map((x) => `#${x.id}`).join(', ')}`);
        continue;
      }
      m = designes[0] ?? null;
    }
    if (m) {
      // une page ancrée : son mot-clé lit son nom et son adresse sur elle, rien à faire
      if (p.mot_cle_id !== null) continue;
      if (pris.has(m.id)) {
        trancher('page', p.id, p.titre, `son mot-clé #${m.id} est déjà l’ancre de « ${pris.get(m.id)} »`);
        continue;
      }
      if (sansType.has(m.id)) {
        trancher('page', p.id, p.titre, `son mot-clé #${m.id} n’a pas de type unique`);
        continue;
      }
      if (!retenu(base.cle)) continue;
      // l'ancre lui donne le nom de la page : un renommage que le propriétaire a écarté (`nom:<id>`, l'annulation d'un alignement d'avant la migration 0136)
      // laisse la page sans ancre
      if (m.libelle !== p.titre && !retenu(`nom:${m.id}`)) continue;
      pris.set(m.id, p.id);
      elements.push({ ...base, mot_cle: m.id, ancrer: true, famille: 'noms' });
    } else {
      const rubrique = TYPE_DE_RUBRIQUE[p.type];
      const type = rubrique ? categories.idDe(rubrique) : null;
      if (type === null) trancher('page', p.id, p.titre, rubrique ? `son type « ${rubrique} » n’existe plus` : `la rubrique « ${p.type} » n’a pas de type`);
      else if (retenu(base.cle)) elements.push({ ...base, mot_cle: null, type, famille: p.type === 'capacites' ? 'capacites' : 'pages' });
    }
  }

  const typeDesSorts = categories.idDe(TYPE_D_UN_SORT);
  for (const s of db.prepare('SELECT s.id, s.nom, s.mot_cle_id, m.nom AS parent FROM sort s JOIN magie m ON m.id = s.magie_id ORDER BY s.id').all()) {
    // un sort ancré : son mot-clé lit son nom et son adresse sur lui, rien à faire
    if (s.mot_cle_id !== null) continue;
    if (typeDesSorts === null || !normalize(s.nom)) trancher('sort', s.id, s.nom, typeDesSorts === null ? `le type « ${TYPE_D_UN_SORT} » n’existe plus` : 'son nom n’a ni lettre ni chiffre');
    else if (retenu(`sort:${s.id}`)) elements.push({ cle: `sort:${s.id}`, table: 'sort', id: s.id, nom: s.nom, adresse: adresseDuSortDe(s.id), mot_cle: null, type: typeDesSorts, parent: s.parent, famille: 'sorts' });
  }

  const ecritures = libellesDesTypes(db);
  const typeDesTypes = categories.idDe(TYPE_D_UN_TYPE_DE_SORT);
  for (const t of db.prepare('SELECT id, mot_cle_id FROM type_sort ORDER BY id').all()) {
    const noms = ecritures.get(t.id);
    if (!noms) continue;
    const cle = `type_sort:${t.id}`;
    if (t.mot_cle_id !== null) {
      // un type ancré, sauf celui qui reprend un mot-clé (il garde son nom, décision 3) : un type de sort n'est pas l'élément de son mot-clé, dont le nom se lit
      // sur sa page de notion ou son repère (migration 0136) ; quand ses sorts l'écrivent autrement, rien n'est renommé, les deux noms sont à trancher
      const m = parId.get(t.mot_cle_id);
      if (!m || t.id === TYPE_REPRIS.code || pris.has(m.id)) continue;
      if (noms.length > 1) trancher('type_sort', t.id, m.libelle, `ses sorts l’écrivent de plusieurs façons : ${noms.join(', ')}`);
      else if (m.libelle !== noms[0] && normalize(noms[0])) trancher('type_sort', t.id, m.libelle, `ses sorts l’écrivent « ${noms[0]} », son mot-clé s’appelle « ${m.libelle} »`);
      continue;
    }
    if (t.id === TYPE_REPRIS.code) {
      const m = parId.get(TYPE_REPRIS.mot_cle);
      if (!m) trancher('type_sort', t.id, noms[0], `le mot-clé repris #${TYPE_REPRIS.mot_cle} a disparu`);
      else if (sansType.has(m.id)) trancher('type_sort', t.id, noms[0], `son mot-clé #${m.id} n’a pas de type unique`);
      else if (retenu(cle)) elements.push({ cle, table: 'type_sort', id: t.id, nom: m.libelle, adresse: m.url ?? null, mot_cle: m.id, ancrer: true, famille: 'noms' });
    } else if (noms.length > 1) trancher('type_sort', t.id, noms[0], `ses sorts l’écrivent de plusieurs façons : ${noms.join(', ')}`);
    else if (retenu(cle)) elements.push({ cle, table: 'type_sort', id: t.id, nom: noms[0], adresse: null, mot_cle: null, type: typeDesTypes, famille: 'sorts' });
  }

  // la règle éprouve le vocabulaire final : ce qu'elle refuse sort du plan
  const gardes = eprouver({ motsCles, parId, libelles: categories.libelles, elements, reclasses, trancher });
  // les pages de notion : tout mot-clé que le plan ancre ici sur une page (`pris`) a déjà la sienne
  const notions = pagesDeNotion(db, {
    motsCles, ancres: new Set(pris.keys()), sansTypeUnique: new Set(motsCles.filter((m) => m.categories.length !== 1 && !reclasses.has(m.id)).map((m) => m.id)), idDeNotion: idDeNotion ?? ((nom, idsPris) => idDeNotionLocal(db, nom, idsPris)), retenu, trancher,
  });

  const crees = gardes.filter((e) => e.mot_cle === null);
  const deFamille = (famille) => crees.filter((e) => e.famille === famille);
  const existants = gardes.filter((e) => e.mot_cle !== null);
  const comptes = {
    crees: crees.length, capacites: deFamille('capacites').length, autres_pages: deFamille('pages').length,
    sorts: crees.filter((e) => e.table === 'sort').length, types: crees.filter((e) => e.table === 'type_sort').length,
    // les ancres qui changent le nom d'un mot-clé (il prend celui de sa page)
    renommes: existants.filter((e) => e.ancrer && e.nom !== parId.get(e.mot_cle).libelle).length, reclasses: reclasses.size, ancres_existants: existants.filter((e) => e.ancrer).length,
    notions: notions.length,
  };

  const lot = (famille, operations) => ({
    format: FORMAT_DU_LOT, titre: TITRES[famille], nature: 'decision', decision: DECISION_DE_L_ANCRAGE, auteur: AUTEUR_DE_L_ANCRAGE, famille, operations: operations.slice(0, OPERATIONS_MAX),
  });
  const premier = [
    ...categories.nouvelles.map((c) => ({ table: 'categorie_mot_cle', cle: { id: { $numero: c.jeton } }, operation: 'inserer', apres: { id: { $numero: c.jeton }, libelle: c.libelle } })),
    ...[...reclasses].sort(([a], [b]) => a - b).flatMap(([id, categorie]) => reclassement(parId.get(id), categorie, categories.valeur)),
    ...existants.filter((e) => e.ancrer).map((e) => ({ table: e.table, cle: { id: e.id }, operation: 'modifier', avant: { mot_cle_id: null }, apres: { mot_cle_id: e.mot_cle } })),
  ];
  const jeton = jetonSuivant();
  const suite = categories.nouvelles.length ? [] : [
    lot('sorts', deFamille('sorts').map((e) => creation(e, jeton))),
    lot('pages', deFamille('pages').map((e) => creation(e, jeton))),
    lot('capacites', deFamille('capacites').map((e) => creation(e, jeton))),
  ];
  // les pages de notion viennent après tout le reste : un mot-clé que les quatre autres lots ancrent n'en est plus candidat
  const quatre = [lot('noms', premier), ...suite].filter((l) => l.operations.length);
  return {
    lots: quatre.length ? quatre : [lot('notions', notions)].filter((l) => l.operations.length),
    a_trancher: [...aTrancher.values()],
    ecartees: [...sautees].sort(),
    comptes,
  };
}
