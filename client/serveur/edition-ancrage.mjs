// L'ancrage des mots-clés par un lot de changements (décision R309, docs/chantier-ancrage-mots-cles.md, §5 à §7) : créer le mot-clé d'un élément (page, sort,
// type de sort) avec son type et son ancre, poser une ancre, aligner un mot-clé sur son élément, recalculer les clés une fois en fin de lot. Le nom et
// l'adresse d'un mot-clé ancré viennent de son élément : aucune valeur reçue ne les remplace.
// Aucun refus d'ici ne cite un numéro de décision : un refus qui en cite un devient un verrou que le mot de passe ouvre (edition-lots.mjs#ecrireLesOperations).
// Ces opérations n'existent que dans un lot (edition.mjs#OPERATIONS_DU_LOT) : le rejeu relit leurs lignes du journal (`ctx.w`) sans repasser par ces refus (R219 (6)).
// Sans import de serveur/edition.mjs : ses outils sont donnés par outilsDeLAncrage (patron de edition-mots-cles.mjs#outilsDesMotsCles).
import { adresseDeLaPage, adresseDuSort } from '../src/lib/adresses-db.mjs';
import { TABLES_ANCRABLES } from '../src/lib/lot-de-changements.mjs';
import { mentionsDesMotsCles, referencesDesMotsCles, texteDesMentions } from '../src/lib/mentions-des-mots-cles.mjs';
import { estAncre, fautesDuVocabulaire, TYPE_DE_RUBRIQUE } from '../src/lib/mots-cles-ancrage.mjs';
import { lireBalises, motCleDeLaRef, synonymesPris, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { categoriesDesMotsCles, motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';
import { retirerLesFillesDuMotCle } from './edition-mots-cles.mjs';

const NOMS = Object.freeze({ page: 'Page', sort: 'Sort', type_sort: 'Type de sort' });
/** La mention d'une décision dans un refus de la règle des clés (« (décision R232 (9)) »). */
const MENTION_D_UNE_DECISION = / ?\(décisions? R[0-9]+(?: \([0-9]+\))?(?:, R[0-9]+(?: \([0-9]+\))?)*\)/g;

/** Ce qu'aucun lot ne fait à un mot-clé ancré, mot de passe compris : écrire son nom, son adresse ou sa clé, le supprimer, le fondre dans un autre. */
const FERME_AUX_LOTS = new Set(['libelle', 'url', 'cle', 'suppression', 'fusion']);
const CITE_UN_NUMERO = /\bR[0-9]+\b/;

/** Le sujet d'un refus du verrou : un libellé qui s'écrit comme un numéro de décision n'y entre pas (voir l'en-tête). */
const motCleDansUnRefus = (libelle) => (libelle && !CITE_UN_NUMERO.test(libelle) ? `Le mot-clé « ${libelle} »` : 'Ce mot-clé');

/** Le refus d'une seconde catégorie : `nombre`, celles qu'il aurait. */
export const refusDeLaSecondeCategorie = (libelle, nombre) => `${motCleDansUnRefus(libelle)} n’a qu’un seul type : il en aurait ${nombre}.`;

/** Le refus d'une fusion dont la cible est ancrée et la source a des synonymes : une cible ancrée ne reçoit que la clé. */
export const refusDesSynonymesTransmis = (source) => `${motCleDansUnRefus(source)} ne se fusionne pas dans un mot-clé relié à un élément : celui-ci ne reçoit que sa clé, pas ses synonymes. Retirez-les d’abord, ou choisissez une autre cible.`;

/**
 * Le verrou s'applique-t-il à cette écriture ? Une route du site et tout lot, oui ; l'annulation d'un lot et le rejeu (`gel` faux : R219 (6)), non. Sur un lot, `gel` faux
 * ne le lève pas : c'est ce qu'ouvre le mot de passe, et il n'ouvre pas ce verrou.
 */
export const sousLeVerrou = (ctx) => !ctx.annulation && (ctx.voie === 'lot' || ctx.gel !== false);

/**
 * Le refus d'un geste sur le mot-clé `id` s'il est ancré, ou null. `colonnes` : les colonnes écrites, ou le geste (`categories`, `synonymes`, `suppression`, `fusion`). Une route
 * ne fait aucun de ces gestes ; un lot corrige le type, la couleur, l'icône, les synonymes et la définition (décision 17), pas le reste. Le texte ne cite jamais de numéro de
 * décision. `ancres` : l'ensemble déjà lu (`motsClesAncres`), pour un appel par mot-clé du vocabulaire.
 */
export function refusDuVerrou(ctx, id, colonnes, { ancres = null } = {}) {
  if (!sousLeVerrou(ctx)) return null;
  const visees = ctx.voie === 'lot' ? colonnes.filter((c) => FERME_AUX_LOTS.has(c)) : colonnes;
  if (!visees.length || !(ancres ? ancres.has(id) : estAncre(ctx.db, id))) return null;
  const sujet = motCleDansUnRefus(ctx.db.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(id)?.libelle);
  if (visees.includes('suppression')) return `${sujet} est relié à un élément : il ne se supprime pas seul, il part avec son élément.`;
  if (visees.includes('fusion')) return `${sujet} est relié à un élément : il ne se fusionne pas dans un autre.`;
  if (ctx.voie === 'lot') return `${sujet} est relié à un élément : son nom, son adresse et sa clé viennent de lui, aucun lot ne les écrit.`;
  return `${sujet} est relié à un élément : il ne se modifie plus à la main.`;
}

/** Les ids des mots-clés ancrés, en un seul passage (`estAncre` relit les tables à chaque appel). */
export function motsClesAncres(db) {
  const motsCles = db.prepare('SELECT * FROM mot_cle').all();
  const sortie = new Set(referencesDesMotsCles(db, motsCles.map((m) => m.id)).map((r) => r.mot_cle_id));
  for (const m of motsCles) if ((m.monnaie_id ?? null) !== null) sortie.add(m.id);
  return sortie;
}

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
 * Lire les balises d'un texte pendant l'annulation d'un lot, sur le vocabulaire `motsCles` du moment. `clesDAvant` : Map(clé d'avant le lot → id), car une clé
 * d'avant peut être devenue le libellé ambigu de deux homonymes, ou la clé d'un autre mot-clé. `clesDeFin` : Map(clé à la fin du lot → id), pour la même raison.
 *   - `reecriturePure(origine, fin, markdown)` : `fin` ne diffère d'`origine` que par la clé des mêmes mots-clés (le recalcul la réécrira lui-même) ;
 *   - `revenu(origine, actuelle, markdown)` : les deux textes citent les mêmes mots-clés aux mêmes endroits, sur le vocabulaire du moment ;
 *   - `commeFin(fin, actuelle, markdown)` : le texte actuel est celui du lot, à la clé réécrite d'une balise près ;
 *   - `enClesDuMoment(texte, markdown)` : le texte d'avant, ses balises écrites avec la clé actuelle de leur mot-clé (le service refuse une ref ambiguë ; le recalcul
 *     la ramènera à la clé finale).
 */
export function lectureDesBalises(motsCles, clesDAvant = new Map(), clesDeFin = new Map()) {
  const v = vocabulaireDesMotsCles(motsCles);
  const cible = (ref) => motCleDeLaRef(v, ref)?.id ?? v.parAncienneCle.get(normalize(ref))?.id ?? null;
  const cibleDAvant = (ref) => clesDAvant.get(normalize(ref)) ?? cible(ref);
  const cibleDeFin = (ref) => clesDeFin.get(normalize(ref)) ?? cible(ref);
  const horsBalises = (texte, balises) => {
    let k = 0;
    const morceaux = balises.map((b) => {
      const morceau = texte.slice(k, b.debut);
      k = b.fin;
      return morceau;
    });
    return [...morceaux, texte.slice(k)];
  };
  const memesMotsCles = (a, b, cibleDeA, markdown) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const [x, y] = [lireBalises(a, { markdown }), lireBalises(b, { markdown })];
    if (!x.length || x.length !== y.length) return false;
    if (horsBalises(a, x).join('\0') !== horsBalises(b, y).join('\0')) return false;
    return x.every((bx, i) => {
      const id = cibleDeA(bx.ref);
      const by = y[i];
      const montre = (l) => l.texte ?? v.parId.get(id)?.libelle ?? null;
      return id !== null && id === cible(by.ref) && bx.complet === by.complet && montre(bx) === montre(by);
    });
  };
  return {
    reecriturePure: (origine, fin, markdown) => memesMotsCles(origine, fin, cibleDAvant, markdown),
    revenu: (origine, actuelle, markdown) => memesMotsCles(origine, actuelle, cible, markdown),
    commeFin: (fin, actuelle, markdown) => memesMotsCles(fin, actuelle, cibleDeFin, markdown),
    enClesDuMoment(texte, markdown) {
      if (typeof texte !== 'string' || !texte.includes('{{')) return texte;
      let sortie = '';
      let k = 0;
      for (const b of lireBalises(texte, { markdown })) {
        const cle = v.parId.get(cibleDAvant(b.ref))?.cle;
        sortie += texte.slice(k, b.debut) + (cle ? b.brut.replace(b.ref, cle) : b.brut);
        k = b.fin;
      }
      return sortie + texte.slice(k);
    },
  };
}

/** Vrai si la table porte l'ancre d'un élément (une base d'avant la migration R309 ne l'a pas). */
const aDesAncres = (db, table) => Boolean(db.prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = 'mot_cle_id'`).get());
/** Vrai si la ligne d'un texte (sa clé) appartient à l'un des éléments `ids` : elle part avec eux. */
const partAvec = (cle, ids) => [cle.id, cle.page_id, cle.capacite_id, cle.metier_id, cle.sort_id, cle.entite_id].some((v) => ids.has(v));

/**
 * Le mot-clé que chacun des éléments `ids` de `table` ancre : Map(id de l'élément → { id, libelle, verrou, mentions }), sans ceux qui n'en ont pas. `mentions` : les balises et
 * étiquettes qui le citent (R196), hors textes de l'élément et de ceux qui partent avec lui (`avec`) ; une référence de la base n'est pas un texte à retoucher.
 */
export function motsClesPropres(db, table, ids, { avec = [] } = {}) {
  const sortie = new Map();
  if (!aDesAncres(db, table)) return sortie;
  const sien = db.prepare(`SELECT k.id, k.libelle, k.verrou FROM "${table}" e JOIN mot_cle k ON k.id = e.mot_cle_id WHERE e.id = ?`);
  for (const id of ids) {
    const m = sien.get(id);
    if (m) sortie.set(id, { id: m.id, libelle: m.libelle, verrou: m.verrou, mentions: [] });
  }
  if (!sortie.size) return sortie;
  const mentions = mentionsDesMotsCles(db, [...sortie.values()].map((m) => m.id));
  for (const [id, m] of sortie) {
    const partent = new Set([id, ...avec]);
    // verrouillé : citationsDesPages le cite déjà (R221), ses mentions ne se comptent pas deux fois
    m.mentions = m.verrou ? [] : (mentions.get(m.id) ?? []).filter((c) => c.comment !== 'reference' && !partAvec(c.cle, partent));
  }
  return sortie;
}

/**
 * Les outils de l'ancrage, liés au service : { ancrerNouveau, ancrerElement, alignerMotCle, recalculerEnFinDeLot, ancrerLaPage, suivreLesElements, motCleARetirer,
 * retirerLeMotCle, sousLeVerrou, refusDuVerrou, secondesCategories }. Les écritures de ce module ne passent jamais sous le verrou : elles vont directement par `w`.
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

  /** L'élément que le mot-clé `id` ancre : { table, elementId } (la page, sinon le sort, sinon le type de sort), ou null. */
  function ancreDuMotCle(db, id) {
    for (const table of TABLES_ANCRABLES) {
      const ligne = db.prepare(`SELECT id FROM "${table}" WHERE mot_cle_id = ?`).get(id);
      if (ligne) return { table, elementId: ligne.id };
    }
    return null;
  }

  /**
   * Recopie sur le mot-clé `id` le nom et l'adresse de son élément (la page, sinon le sort, sinon le type de sort : un mot-clé peut ancrer une page et un type).
   * Un type de sort n'a pas d'adresse : celle du mot-clé reste. La clé n'est pas recalculée ici : `recalculerEnFinDeLot`, une fois, après la dernière opération.
   */
  function alignerMotCle(ctx, id) {
    const { db, w } = ctx;
    const m = lireLigne(db, 'mot_cle', { id });
    if (!m) throw new ErreurEdition(404, `Mot-clé introuvable : ${JSON.stringify(id)}`);
    const ancre = ancreDuMotCle(db, id);
    if (!ancre) throw new ErreurEdition(409, `Mot-clé « ${m.libelle} » : il n’ancre aucun élément, il ne s’aligne sur rien.`);
    const { table, elementId } = ancre;
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

  /**
   * Le mot-clé d'une page qu'on vient de créer, type de sa rubrique, ancre posée. Une création de page n'échoue jamais à cause de lui : rubrique sans type,
   * catégorie pas encore créée, adresse déjà tenue par un mot-clé ou nom que la règle refuse rendent null, et la prochaine « Préparer l'ancrage » l'ancre ou le
   * liste à trancher. Rend l'id du mot-clé, ou null.
   */
  function ancrerLaPage(ctx, { id, type, titre }) {
    const { db, w } = ctx;
    const nom = TYPE_DE_RUBRIQUE[type];
    if (!nom || !aDesAncres(db, 'page')) return null;
    const categorie = categoriesDesMotsCles(db).find((c) => normalize(c.libelle) === normalize(nom))?.id;
    if (categorie === undefined) return null;
    const url = adresseDeLaPage(id);
    if (db.prepare('SELECT 1 FROM mot_cle WHERE url = ?').get(url)) return null;
    ctx.adressesDuLot = null; // la page vient d'être créée : les adresses retenues par le lot ne la connaissent pas
    try {
      return w.isoler(() => ancrerNouveau(ctx, { table: 'page', id, libelle: titre, url, type: categorie }));
    } catch (e) {
      if (e instanceof ErreurEdition) return null;
      throw e;
    }
  }

  /**
   * Parmi les mots-clés `ids`, ceux qui peuvent prendre le nom de leur élément sans que la règle refuse le vocabulaire (essayés jusqu'au point fixe). Ne juge pas l'écriture
   * des clés : deux homonymes qui échangent leur nom passent ici, puis `recalculerLesCles` refuse leurs clés croisées (`suivreLesElements` les écarte alors).
   */
  function nomsQuiPassent(db, ids) {
    const motsCles = motsClesDeLaBase(db);
    const parId = new Map(motsCles.map((m) => [m.id, m]));
    const libelles = new Map(categoriesDesMotsCles(db).map((c) => [c.id, c.libelle]));
    const voulus = new Map();
    for (const id of ids) {
      const ancre = ancreDuMotCle(db, id);
      const nom = ancre ? elementDe(db, ancre.table, ancre.elementId)?.nom : null;
      if (nom && normalize(nom) && nom !== parId.get(id)?.libelle) voulus.set(id, nom);
    }
    let futurs = motsCles;
    const passent = [];
    for (let avance = true; avance && voulus.size;) {
      avance = false;
      for (const [id, nom] of voulus) {
        const essai = futurs.map((m) => (m.id === id ? { ...m, libelle: nom } : m));
        if (fautesDuVocabulaire(essai, libelles, parId).length) continue;
        futurs = essai;
        passent.push(id);
        voulus.delete(id);
        avance = true;
      }
    }
    return passent;
  }

  /**
   * Fin d'un lot écrit par le service : le mot-clé suit ce que CE lot a changé (`w.lignes`, jamais l'état de la base : un renommage annulé ne revient pas). `page.titre`
   * et `sort.nom` : nom suivi, clés recalculées ; un nom que la règle refuse laisse le mot-clé tel quel, comme ceux dont les clés se croiseraient (un échange de noms : le
   * refus les cite, `details.mots_cles`), et les autres suivent. `magie.nom` : la clé des sorts homonymes dépend de leur parent ; un mot-clé retiré (`ctx.clesDues`) : un
   * homonyme peut retrouver sa clé. Dans ces deux cas le recalcul est dû : s'il est refusé sans renommage à écarter, le refus remonte (sans numéro de décision), car le
   * vocabulaire resterait faux. Jamais en annulation ni au rejeu (qui relit le journal). Rend vrai s'il a recalculé les clés : l'appelant n'a pas à le refaire.
   */
  function suivreLesElements(ctx) {
    if (ctx.annulation) return false;
    const { db, w } = ctx;
    const clesDues = ctx.clesDues === true;
    ctx.clesDues = false;
    const aSuivre = new Set();
    let parentChange = false;
    for (const { table, cle, colonnes } of w.lignes) {
      if (!colonnes) continue;
      if ((table === 'page' && colonnes.includes('titre')) || (table === 'sort' && colonnes.includes('nom'))) {
        const motCle = db.prepare(`SELECT mot_cle_id AS id FROM "${table}" WHERE id = ?`).get(cle.id)?.id ?? null;
        if (motCle !== null) aSuivre.add(motCle);
      } else if (table === 'magie' && colonnes.includes('nom')) {
        parentChange ||= Boolean(db.prepare('SELECT 1 FROM sort WHERE magie_id = ? AND mot_cle_id IS NOT NULL LIMIT 1').get(cle.id));
      }
    }
    const recalculDu = parentChange || clesDues;
    let renommes = aSuivre.size ? nomsQuiPassent(db, aSuivre) : [];
    while (renommes.length || recalculDu) {
      try {
        w.isoler(() => {
          for (const id of renommes) alignerMotCle(ctx, id);
          MOTS_CLES.recalculerLesCles(ctx);
        });
        return true;
      } catch (e) {
        if (!(e instanceof ErreurEdition)) throw e;
        const cites = new Set(e.details?.mots_cles ?? []);
        const restants = renommes.filter((id) => !cites.has(id));
        if (restants.length < renommes.length) renommes = restants; // les mots-clés que le refus cite gardent leur nom, les autres suivent
        else if (!recalculDu) return false;
        else if (renommes.length) renommes = []; // un autre refus d'un nom : le recalcul dû se tente sans aucun renommage
        else return sansNumeroDeDecision(() => { throw e; });
      }
    }
    return false;
  }

  /**
   * Avant de supprimer l'élément : l'id du mot-clé qui part avec lui, ou null (pas de mot-clé, annulation d'un lot). Refus 409 s'il est verrouillé, ou si une balise ou une
   * étiquette le cite encore (`details.citations` : les textes à retoucher). Sans numéro de décision (voir l'en-tête).
   */
  function motCleARetirer(ctx, { table, id }) {
    if (ctx.annulation) return null;
    const m = motsClesPropres(ctx.db, table, [id]).get(id);
    if (!m) return null;
    const nom = elementDe(ctx.db, table, id)?.nom ?? id;
    if (m.verrou) throw new ErreurEdition(409, `« ${nom} » ne se supprime pas : son mot-clé « ${m.libelle} » est verrouillé.`, { mots_cles_verrouilles: [m.id] });
    if (m.mentions.length) {
      throw new ErreurEdition(409, `« ${nom} » ne se supprime pas : son mot-clé est cité à ${texteDesMentions(m.mentions)} ; retirez d’abord ces mentions.`, { citations: m.mentions });
    }
    return m.id;
  }

  /**
   * Après l'élément : retire le mot-clé `id`, ses catégories, synonymes et clés quittées. Le recalcul des clés (un homonyme peut retrouver la sienne) est noté dû, et fait une
   * fois en fin de lot par `suivreLesElements` : un état entre deux opérations n'a pas à satisfaire la règle. Tenu par un autre élément (une ancre, une magie, un type de
   * dégâts, une monnaie, un sort qui le porte : R289), il reste ; s'il menait à l'élément parti (`adresse`), son adresse se vide.
   */
  function retirerLeMotCle(ctx, id, { adresse = null } = {}) {
    const { db, w } = ctx;
    const m = lireLigne(db, 'mot_cle', { id });
    if (!m) return;
    if (m.verrou) throw new ErreurEdition(409, `Mot-clé « ${m.libelle} » : il est verrouillé, il ne se retire pas.`);
    if (estAncre(db, id) || db.prepare('SELECT 1 FROM sort_mot_cle WHERE mot_cle_id = ? LIMIT 1').get(id)) {
      if (adresse !== null && m.url === adresse) w.modifier('mot_cle', { id }, { url: null });
      return;
    }
    retirerLesFillesDuMotCle(db, w, id);
    w.supprimer('mot_cle', { id });
    ctx.clesDues = true;
  }

  /**
   * Fin d'un lot : les mots-clés auxquels CE lot a ajouté une catégorie et qui en ont plusieurs à la fin, [{ id, message }]. Seul l'état final se juge : un lot peut écrire
   * « ajouter B » puis « retirer A », ou retirer une catégorie à un ancien mot-clé qui en garde plusieurs. Ni en annulation ni au rejeu.
   */
  function secondesCategories(ctx) {
    if (!sousLeVerrou(ctx)) return [];
    const { db, w } = ctx;
    const ajoutees = new Set(w.lignes.filter((l) => l.table === 'mot_cle_categorie' && l.operation === 'inserer').map((l) => l.cle.mot_cle_id));
    const sortie = [];
    for (const id of ajoutees) {
      const { n } = db.prepare('SELECT count(*) AS n FROM mot_cle_categorie WHERE mot_cle_id = ?').get(id);
      if (n > 1) sortie.push({ id, message: refusDeLaSecondeCategorie(db.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(id)?.libelle, n) });
    }
    return sortie;
  }

  return {
    ancrerNouveau, ancrerElement, alignerMotCle, recalculerEnFinDeLot, ancrerLaPage, suivreLesElements, motCleARetirer, retirerLeMotCle, sousLeVerrou, refusDuVerrou, secondesCategories,
  };
}
