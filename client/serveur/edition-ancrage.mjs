// L'ancrage des mots-clés par un lot de changements (décision R309, docs/chantier-ancrage-mots-cles.md, §5 à §7) : créer le mot-clé d'un élément (page, sort,
// type de sort) avec son type et son ancre, poser une ancre, aligner un mot-clé sur son élément, recalculer les clés une fois en fin de lot. Le nom et
// l'adresse d'un mot-clé ancré viennent de son élément : aucune valeur reçue ne les remplace.
// Aucun refus d'ici ne cite un numéro de décision : un refus qui en cite un devient un verrou que le mot de passe ouvre (edition-lots.mjs#ecrireLesOperations).
// Ces opérations n'existent que dans un lot (edition.mjs#OPERATIONS_DU_LOT) : le rejeu relit leurs lignes du journal (`ctx.w`) sans repasser par ces refus (R219 (6)).
// Sans import de serveur/edition.mjs : ses outils sont donnés par outilsDeLAncrage (patron de edition-mots-cles.mjs#outilsDesMotsCles).
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { TABLES_ANCRABLES } from '../src/lib/lot-de-changements.mjs';
import { synonymesPris } from '../src/lib/mots-cles-balises.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';

const NOMS = Object.freeze({ page: 'Page', sort: 'Sort', type_sort: 'Type de sort' });
/** La mention d'une décision dans un refus de la règle des clés (« (décision R232 (9)) »). */
const MENTION_D_UNE_DECISION = / ?\(décisions? R[0-9]+(?: \([0-9]+\))?(?:, R[0-9]+(?: \([0-9]+\))?)*\)/g;

/**
 * L'élément `id` de `table` : { nom, adresse, parent, mot_cle_id }, ou null. `nom` : le titre d'une page, le nom d'un sort, l'écriture d'un type de sort dans
 * `sort_type` (null si ses sorts n'en ont pas une seule) ; `parent` : le nom de la magie d'un sort, qui départage deux homonymes de même type.
 */
function elementDe(db, table, id) {
  if (table === 'page') {
    const p = db.prepare('SELECT titre, mot_cle_id FROM page WHERE id = ?').get(id);
    return p ? { nom: p.titre, adresse: adresseDeLaPage(id), parent: null, mot_cle_id: p.mot_cle_id } : null;
  }
  if (table === 'sort') {
    const s = db.prepare('SELECT s.nom, s.mot_cle_id, m.nom AS parent FROM sort s JOIN magie m ON m.id = s.magie_id WHERE s.id = ?').get(id);
    return s ? { nom: s.nom, adresse: adresseDuSort(id), parent: s.parent, mot_cle_id: s.mot_cle_id } : null;
  }
  if (table === 'type_sort') {
    const t = db.prepare('SELECT mot_cle_id FROM type_sort WHERE id = ?').get(id);
    if (!t) return null;
    const noms = db.prepare('SELECT DISTINCT libelle FROM sort_type WHERE type = ?').all(id).map((l) => l.libelle);
    return { nom: noms.length === 1 ? noms[0] : null, adresse: null, parent: null, mot_cle_id: t.mot_cle_id };
  }
  return null;
}

/**
 * Les outils de l'ancrage, liés au service : { ancrerNouveau, ancrerElement, alignerMotCle, recalculerEnFinDeLot }.
 * @param {{ ErreurEdition: Function, MOTS_CLES: object, creerMotCle: Function }} o la classe d'erreur, les outils du vocabulaire et la création d'un mot-clé
 */
export function outilsDeLAncrage({ ErreurEdition, MOTS_CLES, creerMotCle }) {
  function elementOuRefus(db, table, id) {
    if (!TABLES_ANCRABLES.includes(table)) throw new ErreurEdition(400, `Ancrage : la table « ${table} » n’ancre pas de mot-clé.`);
    const e = elementDe(db, table, id);
    if (!e) throw new ErreurEdition(404, `${NOMS[table]} introuvable : ${JSON.stringify(id)}`);
    return e;
  }

  /** Le nom d'un élément, refusé (409) s'il ne peut pas nommer un mot-clé. */
  function nomDeLElement(e, table, id) {
    if (e.nom === null) throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : ses sorts ne l’écrivent pas d’une seule façon, son mot-clé n’a pas de nom.`);
    if (!normalize(e.nom)) throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : son nom n’a ni lettre ni chiffre.`);
    return e.nom;
  }

  /** `faire`, dont le refus ne cite plus de décision : un refus de la règle des clés reste un refus, jamais un verrou à ouvrir. */
  function sansNumeroDeDecision(faire) {
    try {
      return faire();
    } catch (e) {
      if (e instanceof ErreurEdition) throw new ErreurEdition(e.statut, e.message.replace(MENTION_D_UNE_DECISION, ''), e.details);
      throw e;
    }
  }

  /**
   * Crée le mot-clé de l'élément, avec son type (`type` : un id de catégorie) et son ancre : jamais verrouillé, sans définition (R219 (5)). Le nom et
   * l'adresse donnés doivent être ceux de l'élément (409 sinon). Rend l'id du mot-clé.
   */
  function ancrerNouveau(ctx, { table, id, libelle, url = null, type }) {
    const e = elementOuRefus(ctx.db, table, id);
    if (e.mot_cle_id !== null) throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : cet élément a déjà son mot-clé (#${e.mot_cle_id}).`);
    const nomVoulu = nomDeLElement(e, table, id);
    if (libelle !== nomVoulu) throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : le nom d’un mot-clé ancré est celui de son élément (« ${nomVoulu} », reçu « ${libelle} »).`);
    if ((url ?? null) !== e.adresse) {
      throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : l’adresse d’un mot-clé ancré est celle de son élément (${JSON.stringify(e.adresse)}, reçu ${JSON.stringify(url ?? null)}).`);
    }
    return sansNumeroDeDecision(() => creerMotCle(ctx, libelle, null, { url: e.adresse, categories: [type], ancre: { table, id }, parent: e.parent }));
  }

  /**
   * Pose l'ancre d'un élément sur le mot-clé `mot_cle_id`. Retirer une ancre (`null`) ou la remplacer n'est permis qu'à l'annulation d'un lot (`ctx.annulation`) :
   * c'est elle qui remet la valeur d'avant.
   */
  function ancrerElement(ctx, { table, id, mot_cle_id }) {
    const { db, w } = ctx;
    if (!TABLES_ANCRABLES.includes(table)) throw new ErreurEdition(400, `Ancrage : la table « ${table} » n’ancre pas de mot-clé.`);
    const ligne = lireLigne(db, table, { id });
    if (!ligne) throw new ErreurEdition(404, `${NOMS[table]} introuvable : ${JSON.stringify(id)}`);
    if (!ctx.annulation) {
      if (mot_cle_id === null) throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : son ancre ne se retire pas par un lot.`);
      if (ligne.mot_cle_id !== null) throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : cet élément a déjà son mot-clé (#${ligne.mot_cle_id}), il n’en change pas par un lot.`);
    }
    if (mot_cle_id !== null && !lireLigne(db, 'mot_cle', { id: mot_cle_id })) throw new ErreurEdition(404, `Mot-clé introuvable : ${JSON.stringify(mot_cle_id)}`);
    w.modifier(table, { id }, { mot_cle_id });
  }

  /**
   * Recopie sur le mot-clé `id` le nom et l'adresse de son élément (la page, sinon le sort, sinon le type de sort : un mot-clé peut ancrer une page et un type).
   * Un type de sort n'a pas d'adresse : celle du mot-clé reste. La clé n'est pas recalculée ici : `recalculerEnFinDeLot`, une fois, après la dernière opération.
   */
  function alignerMotCle(ctx, id) {
    const { db, w } = ctx;
    const m = lireLigne(db, 'mot_cle', { id });
    if (!m) throw new ErreurEdition(404, `Mot-clé introuvable : ${JSON.stringify(id)}`);
    const ancre = TABLES_ANCRABLES.map((table) => ({ table, ligne: db.prepare(`SELECT id FROM "${table}" WHERE mot_cle_id = ?`).get(id) })).find((a) => a.ligne);
    if (!ancre) throw new ErreurEdition(409, `Mot-clé « ${m.libelle} » : il n’ancre aucun élément, il ne s’aligne sur rien.`);
    const { table, ligne: { id: elementId } } = ancre;
    const e = elementDe(db, table, elementId);
    const libelle = nomDeLElement(e, table, elementId);
    const valeurs = {};
    if (m.libelle !== libelle) {
      const [pris] = synonymesPris(motsClesDeLaBase(db), { id, libelle });
      if (pris) throw new ErreurEdition(409, `Mot-clé « ${m.libelle} » : le nom « ${libelle} » s’écrit comme le synonyme « ${pris.synonyme} » du mot-clé « ${pris.m.libelle} ».`, { champ: 'libelle', mot_cle: pris.m.id });
      valeurs.libelle = libelle;
    }
    if (table !== 'type_sort' && (m.url ?? null) !== e.adresse) valeurs.url = e.adresse;
    if (Object.keys(valeurs).length) w.modifier('mot_cle', { id }, valeurs);
  }

  /** Le recalcul différé des clés, une fois après la dernière opération d'un lot : la règle ne juge que l'état final. Rend le résumé. */
  function recalculerEnFinDeLot(ctx) {
    ctx.clesEnAttente = false;
    return `Clés recalculées${MOTS_CLES.resumeDesCles(MOTS_CLES.recalculerLesCles(ctx))}`;
  }

  return { ancrerNouveau, ancrerElement, alignerMotCle, recalculerEnFinDeLot };
}
