// Ce que l'ancrage des mots-clés doit faire (décision R309, docs/chantier-ancrage-mots-cles.md, §2 à §5) : un mot-clé par page, sort et type de sort. Calcul
// pur : il lit la base et rend des lots de changements (`maverick-lot/1`), il n'écrit rien ; l'action « Préparer l'ancrage » les dépose, un par un, et
// recalcule le plan après chacun. Il ne prend que ce qui manque encore (rejouable) et ne devine rien : un élément que la règle ne sait pas nommer ou
// classer est laissé de côté et listé « à trancher ».
//   Lot 1 (`noms`) : les catégories nouvelles, le type unique, les ancres des mots-clés existants, le nom et l'adresse alignés sur la page.
//   Lots 2 à 4 (`sorts`, `pages`, `capacites`) : les mots-clés créés. Leur `ancrage.type` est un id de catégorie : ils ne sont rendus qu'une fois les quatre
//   catégories nouvelles en base (l'action recalcule le plan après le lot 1) ; `comptes` décrit tout de même l'ancrage entier.
// Sans dépendance navigateur ni Astro : la base est passée par l'appelant.
import { adresseDeLaPage, adresseDuSort } from './adresses-db.mjs';
import { FORMAT_DU_LOT } from './lot-de-changements.mjs';
import { referencesDesMotsCles } from './mentions-des-mots-cles.mjs';
import { synonymesPris, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { clesDesMotsCles, HomonymesRefuses, RAISONS } from './mots-cles-cles.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from './mots-cles-db.mjs';
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
const AUTEUR = 'préparer l’ancrage';
const TITRES = Object.freeze({
  noms: 'Ancrage des mots-clés : catégories, type unique, noms et pages déjà désignées',
  sorts: 'Ancrage des mots-clés : sorts et types de sort',
  pages: 'Ancrage des mots-clés : pages hors capacités',
  capacites: 'Ancrage des mots-clés : capacités de classe',
});

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

/** Le vocabulaire tel que le plan le laisserait : noms alignés, types uniques, éléments créés (ids négatifs, provisoires). */
function vocabulaireFutur(motsCles, elements, reclasses) {
  const noms = new Map(elements.filter((e) => e.aligner).map((e) => [e.mot_cle, e.nom]));
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
    const renommes = new Map(gardes.filter((e) => e.aligner && e.nom !== parId.get(e.mot_cle)?.libelle).map((e) => [e.mot_cle, e]));
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

/** La création d'un mot-clé ancré : sans `cle`, que le service calcule. */
function creation(e, jeton) {
  const id = { $numero: jeton() };
  return { table: 'mot_cle', cle: { id }, operation: 'inserer', apres: { id, libelle: e.nom, url: e.adresse ?? null }, ancrage: { table: e.table, id: e.id, type: e.type } };
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

/** L'alignement d'un mot-clé sur sa page : les colonnes qui diffèrent seulement. */
function alignement(e, m) {
  const avant = {};
  const apres = {};
  if (m.libelle !== e.nom) [avant.libelle, apres.libelle] = [m.libelle, e.nom];
  if ((m.url ?? null) !== e.adresse) [avant.url, apres.url] = [m.url ?? null, e.adresse];
  return { table: 'mot_cle', cle: { id: m.id }, operation: 'modifier', avant, apres, ancrage: { aligner: true } };
}

/**
 * Le plan de l'ancrage. `ecartees` : les clés à ne pas refaire (`page:<id>`, `sort:<id>`, `type_sort:<id>`, `nom:<mot_cle_id>`, `type:<mot_cle_id>`), sautées
 * et rendues dans `ecartees` quand elles ont retenu quelque chose.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ ecartees?: Set<string> }} [options]
 * @returns {{ lots: object[], a_trancher: { table: string, id: string | number, nom: string, raison: string }[], ecartees: string[],
 *   comptes: { crees: number, capacites: number, autres_pages: number, sorts: number, types: number, renommes: number, reclasses: number, ancres_existants: number } }}
 */
export function planDeLAncrage(db, { ecartees = new Set() } = {}) {
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

  for (const p of pages) {
    const adresse = adresseDeLaPage(p.id);
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
      const ancree = p.mot_cle_id !== null;
      if (!ancree && pris.has(m.id)) {
        trancher('page', p.id, p.titre, `son mot-clé #${m.id} est déjà l’ancre de « ${pris.get(m.id)} »`);
        continue;
      }
      if (!ancree && sansType.has(m.id)) {
        trancher('page', p.id, p.titre, `son mot-clé #${m.id} n’a pas de type unique`);
        continue;
      }
      const differe = m.libelle !== p.titre || (m.url ?? null) !== adresse;
      if ((ancree && !differe) || !retenu(base.cle)) continue;
      pris.set(m.id, p.id);
      elements.push({ ...base, mot_cle: m.id, ancrer: !ancree, aligner: differe && retenu(`nom:${m.id}`), famille: 'noms' });
    } else {
      const rubrique = TYPE_DE_RUBRIQUE[p.type];
      const type = rubrique ? categories.idDe(rubrique) : null;
      if (type === null) trancher('page', p.id, p.titre, rubrique ? `son type « ${rubrique} » n’existe plus` : `la rubrique « ${p.type} » n’a pas de type`);
      else if (retenu(base.cle)) elements.push({ ...base, mot_cle: null, type, famille: p.type === 'capacites' ? 'capacites' : 'pages' });
    }
  }

  const typeDesSorts = categories.idDe(TYPE_D_UN_SORT);
  for (const s of db.prepare('SELECT s.id, s.nom, s.mot_cle_id, m.nom AS parent FROM sort s JOIN magie m ON m.id = s.magie_id ORDER BY s.id').all()) {
    if (s.mot_cle_id !== null) continue;
    if (typeDesSorts === null || !normalize(s.nom)) trancher('sort', s.id, s.nom, typeDesSorts === null ? `le type « ${TYPE_D_UN_SORT} » n’existe plus` : 'son nom n’a ni lettre ni chiffre');
    else if (retenu(`sort:${s.id}`)) elements.push({ cle: `sort:${s.id}`, table: 'sort', id: s.id, nom: s.nom, adresse: adresseDuSort(s.id), mot_cle: null, type: typeDesSorts, parent: s.parent, famille: 'sorts' });
  }

  const ecritures = libellesDesTypes(db);
  const typeDesTypes = categories.idDe(TYPE_D_UN_TYPE_DE_SORT);
  for (const t of db.prepare('SELECT id, mot_cle_id FROM type_sort ORDER BY id').all()) {
    const noms = ecritures.get(t.id);
    if (t.mot_cle_id !== null || !noms) continue;
    const cle = `type_sort:${t.id}`;
    if (t.id === TYPE_REPRIS.code) {
      const m = parId.get(TYPE_REPRIS.mot_cle);
      if (!m) trancher('type_sort', t.id, noms[0], `le mot-clé repris #${TYPE_REPRIS.mot_cle} a disparu`);
      else if (sansType.has(m.id)) trancher('type_sort', t.id, noms[0], `son mot-clé #${m.id} n’a pas de type unique`);
      else if (retenu(cle)) elements.push({ cle, table: 'type_sort', id: t.id, nom: m.libelle, adresse: m.url ?? null, mot_cle: m.id, ancrer: true, aligner: false, famille: 'noms' });
    } else if (noms.length > 1) trancher('type_sort', t.id, noms[0], `ses sorts l’écrivent de plusieurs façons : ${noms.join(', ')}`);
    else if (retenu(cle)) elements.push({ cle, table: 'type_sort', id: t.id, nom: noms[0], adresse: null, mot_cle: null, type: typeDesTypes, famille: 'sorts' });
  }

  // la règle éprouve le vocabulaire final : ce qu'elle refuse sort du plan
  const gardes = eprouver({ motsCles, parId, libelles: categories.libelles, elements, reclasses, trancher });

  const crees = gardes.filter((e) => e.mot_cle === null);
  const deFamille = (famille) => crees.filter((e) => e.famille === famille);
  const existants = gardes.filter((e) => e.mot_cle !== null);
  const alignes = existants.filter((e) => e.aligner);
  const comptes = {
    crees: crees.length, capacites: deFamille('capacites').length, autres_pages: deFamille('pages').length,
    sorts: crees.filter((e) => e.table === 'sort').length, types: crees.filter((e) => e.table === 'type_sort').length,
    renommes: alignes.filter((e) => e.nom !== parId.get(e.mot_cle).libelle).length, reclasses: reclasses.size, ancres_existants: existants.filter((e) => e.ancrer).length,
  };

  const lot = (famille, operations) => ({
    format: FORMAT_DU_LOT, titre: TITRES[famille], nature: 'decision', decision: 'R309', auteur: AUTEUR, famille, operations: operations.slice(0, OPERATIONS_MAX),
  });
  const premier = [
    ...categories.nouvelles.map((c) => ({ table: 'categorie_mot_cle', cle: { id: { $numero: c.jeton } }, operation: 'inserer', apres: { id: { $numero: c.jeton }, libelle: c.libelle } })),
    ...[...reclasses].sort(([a], [b]) => a - b).flatMap(([id, categorie]) => reclassement(parId.get(id), categorie, categories.valeur)),
    ...existants.filter((e) => e.ancrer).map((e) => ({ table: e.table, cle: { id: e.id }, operation: 'modifier', avant: { mot_cle_id: null }, apres: { mot_cle_id: e.mot_cle } })),
    ...alignes.map((e) => alignement(e, parId.get(e.mot_cle))),
  ];
  const jeton = jetonSuivant();
  const suite = categories.nouvelles.length ? [] : [
    lot('sorts', deFamille('sorts').map((e) => creation(e, jeton))),
    lot('pages', deFamille('pages').map((e) => creation(e, jeton))),
    lot('capacites', deFamille('capacites').map((e) => creation(e, jeton))),
  ];
  return {
    lots: [lot('noms', premier), ...suite].filter((l) => l.operations.length),
    a_trancher: [...aTrancher.values()],
    ecartees: [...sautees].sort(),
    comptes,
  };
}
