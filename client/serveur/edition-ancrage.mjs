// L'ancrage des mots-clés par un lot de changements (décision R309, docs/chantier-ancrage-mots-cles.md, §5 à §7) : créer le mot-clé d'un élément (page, sort,
// type de sort) avec son type et son ancre, poser une ancre, aligner un mot-clé sur son élément, recalculer les clés une fois en fin de lot. Le nom et
// l'adresse d'un mot-clé ancré viennent de son élément : aucune valeur reçue ne les remplace.
// Aucun refus d'ici ne cite un numéro de décision : un refus qui en cite un devient un verrou que une session Créateur ouvre (edition-lots.mjs#ecrireLesOperations).
// Ces opérations n'existent que dans un lot (edition.mjs#OPERATIONS_DU_LOT) : le rejeu relit leurs lignes du journal (`ctx.w`) sans repasser par ces refus (R219 (6)).
// Sans import de serveur/edition.mjs : ses outils sont donnés par outilsDeLAncrage (patron de edition-mots-cles.mjs#outilsDesMotsCles).
import { adresseDeLaPage, adresseDeLaPageEnBase, adresseDuSortEnBase } from '../src/lib/adresses-db.mjs';
import { TABLES_ANCRABLES } from '../src/lib/lot-de-changements.mjs';
import { mentionsDesMotsCles, referencesDesMotsCles, texteDesMentions } from '../src/lib/mentions-des-mots-cles.mjs';
import { categorieDuType, estAncre, TYPE_DE_RUBRIQUE } from '../src/lib/mots-cles-ancrage.mjs';
import { lireBalises, motCleDeLaRef, vocabulaireDesMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { elementDuMotCle, lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';
import { creerLeRepere, motCleDansUnRefus, nomSurLElement, reprendreLeRepere, retirerLesFillesDuMotCle } from './edition-mots-cles.mjs';

const NOMS = Object.freeze({ page: 'Page', sort: 'Sort', type_sort: 'Type de sort' });
/** La mention d'une décision dans un refus de la règle des clés (« (décision R232 (9)) »). */
const MENTION_D_UNE_DECISION = / ?\(décisions? R[0-9]+(?: \([0-9]+\))?(?:, R[0-9]+(?: \([0-9]+\))?)*\)/g;

/** Ce qu'aucun lot ne fait à un mot-clé ancré, session Créateur comprise : écrire son nom, son adresse ou sa clé, le supprimer, le fondre dans un autre. */
const FERME_AUX_LOTS = new Set(['libelle', 'url', 'cle', 'suppression', 'fusion']);

/** Le nom du mot-clé `id`, lu sur son élément (lib/mots-cles-db.mjs#lireUnMotCle : la table mot_cle ne le porte plus depuis la migration 0136), ou undefined. */
const nomDuMotCle = (db, id) => lireUnMotCle(db, id)?.libelle;

/** Le refus d'une seconde catégorie : `nombre`, celles qu'il aurait. */
export const refusDeLaSecondeCategorie = (libelle, nombre) => `${motCleDansUnRefus(libelle)} n’a qu’un seul type : il en aurait ${nombre}.`;

/** Le refus d'une fusion dont la cible est ancrée et la source a des synonymes : une cible ancrée ne reçoit que la clé. */
export const refusDesSynonymesTransmis = (source) => `${motCleDansUnRefus(source)} ne se fusionne pas dans un mot-clé relié à un élément : celui-ci ne reçoit que sa clé, pas ses synonymes. Retirez-les d’abord, ou choisissez une autre cible.`;

/**
 * Le verrou s'applique-t-il à cette écriture ? Une route du site et tout lot, oui ; l'annulation d'un lot et le rejeu (`gel` faux : R219 (6)), non. Sur un lot, `gel` faux
 * ne le lève pas : c'est ce qu’ouvre une session Créateur, et elle n’ouvre pas ce verrou.
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
  const sujet = motCleDansUnRefus(nomDuMotCle(ctx.db, id));
  if (visees.includes('suppression')) return `${sujet} est relié à un élément : il ne se supprime pas seul, il part avec son élément.`;
  if (visees.includes('fusion')) return `${sujet} est relié à un élément : il ne se fusionne pas dans un autre.`;
  if (ctx.voie === 'lot') return `${sujet} est relié à un élément : son nom, son adresse et sa clé viennent de lui, aucun lot ne les écrit.`;
  return `${sujet} est relié à un élément : il ne se modifie plus à la main.`;
}

/** Les liens d'un élément à son mot-clé qu'`ancrerElement` ne garde pas, car un lot les écrit par la voie générique : table → colonne. */
const LIENS_DE_LA_VOIE_GENERIQUE = Object.freeze({ magie: 'mot_cle_id', type_degats: 'mot_cle_id', type_sort: 'mot_cle_id', mot_cle: 'monnaie_id' });
const NOM_DE_L_ELEMENT = Object.freeze({ magie: 'Cette magie', type_degats: 'Ce type de dégâts', type_sort: 'Ce type de sort' });

/**
 * Le refus d'un lot qui détacherait un mot-clé de son élément pour pouvoir écrire son nom ensuite, ou null (Ruling T8-detachement). Fermé sous le verrou, session Créateur comprise, sans
 * numéro de décision : retirer ou remplacer une valeur non nulle du lien, supprimer la ligne qui le porte, supprimer une monnaie citée par un mot-clé (`ON DELETE SET NULL` viderait
 * son `monnaie_id`). Poser un lien sur une valeur nulle et créer une ligne ancrée restent permis. `valeurs` : les colonnes écrites ; null : la ligne `avant` est supprimée.
 */
export function refusDuDetachement(ctx, table, avant, valeurs = null) {
  if (ctx.voie !== 'lot' || !sousLeVerrou(ctx) || !avant) return null;
  if (table === 'monnaie') {
    if (valeurs !== null) return null;
    return ctx.db.prepare('SELECT 1 FROM mot_cle WHERE monnaie_id = ? LIMIT 1').get(avant.id) ? 'Cette monnaie a son mot-clé : un lot ne la supprime pas, il perdrait ce lien.' : null;
  }
  const colonne = LIENS_DE_LA_VOIE_GENERIQUE[table];
  if (!colonne || (avant[colonne] ?? null) === null) return null;
  if (valeurs !== null && (!Object.hasOwn(valeurs, colonne) || (valeurs[colonne] ?? null) === avant[colonne])) return null;
  if (table === 'mot_cle') return `${motCleDansUnRefus(nomDuMotCle(ctx.db, avant.id))} est relié à sa monnaie : un lot ne retire ni ne remplace ce lien.`;
  return `${NOM_DE_L_ELEMENT[table]} garde son mot-clé : un lot ne retire ni ne remplace ce lien.`;
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
 * `sort_type` (null si ses sorts n'en ont pas une seule) ; `parent` : le nom de la magie d'un sort, qui départage deux homonymes de même type. `adresse` : celle
 * de la base vivante (le segment renommé de la page, décision R316), jamais celle du build.
 */
function elementDe(db, table, id) {
  if (table === 'page') {
    const p = db.prepare('SELECT titre, mot_cle_id FROM page WHERE id = ?').get(id);
    return p ? { nom: p.titre, adresse: adresseDeLaPageEnBase(db, id), parent: null, mot_cle_id: p.mot_cle_id } : null;
  }
  if (table === 'sort') {
    const s = db.prepare('SELECT s.nom, s.mot_cle_id, m.nom AS parent FROM sort s JOIN magie m ON m.id = s.magie_id WHERE s.id = ?').get(id);
    return s ? { nom: s.nom, adresse: adresseDuSortEnBase(db, id), parent: s.parent, mot_cle_id: s.mot_cle_id } : null;
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
  // le nom se lit sur l'élément (lireUnMotCle) : la table mot_cle ne le porte plus (migration 0136)
  const sien = db.prepare(`SELECT k.id, k.verrou FROM "${table}" e JOIN mot_cle k ON k.id = e.mot_cle_id WHERE e.id = ?`);
  for (const id of ids) {
    const m = sien.get(id);
    if (m) sortie.set(id, { id: m.id, libelle: nomDuMotCle(db, m.id), verrou: m.verrou, mentions: [] });
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
 * retirerLeMotCle, repereApresLAnnulation, sousLeVerrou, refusDuVerrou, secondesCategories }. Les écritures de ce module ne passent jamais sous le verrou : elles vont directement par `w`.
 * @param {{ ErreurEdition: Function, MOTS_CLES: object, creerMotCle: Function, ADRESSES: object }} o la classe d'erreur, les outils du vocabulaire, la création
 *   d'un mot-clé et les outils des adresses (serveur/edition-adresses.mjs)
 */
export function outilsDeLAncrage({ ErreurEdition, MOTS_CLES, creerMotCle, ADRESSES }) {
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
   * l'adresse, quand le lot les donne, doivent être ceux de l'élément (409 sinon) ; absents, rien n'est contrôlé. Rien n'est copié : le nom et l'adresse
   * se lisent sur la page ou le sort (migration 0136) ; le mot-clé d'un type de sort, qui n'a ni page ni sort, reçoit un repère au nom de l'élément
   * (serveur/edition.mjs#creerMotCle). Rend l'id du mot-clé.
   */
  function ancrerNouveau(ctx, { table, id, libelle, url, type }) {
    const e = elementOuRefus(ctx.db, table, id);
    if (e.mot_cle_id !== null) throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : cet élément a déjà son mot-clé (#${e.mot_cle_id}).`);
    const nomVoulu = nomDeLElement(e, table, id);
    if (libelle !== undefined && libelle !== nomVoulu) {
      throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : le nom d’un mot-clé ancré est celui de son élément (« ${nomVoulu} », reçu « ${libelle} »).`);
    }
    if (url !== undefined && (url ?? null) !== e.adresse) {
      throw new ErreurEdition(409, `${NOMS[table]} « ${id} » : l’adresse d’un mot-clé ancré est celle de son élément (${JSON.stringify(e.adresse)}, reçu ${JSON.stringify(url ?? null)}).`);
    }
    return sansNumeroDeDecision(() => creerMotCle(ctx, nomVoulu, null, { url: e.adresse, categories: [type], ancre: { table, id }, parent: e.parent }));
  }

  /**
   * Pose l'ancre d'un élément sur le mot-clé `mot_cle_id`. Retirer une ancre (`null`) ou la remplacer n'est permis qu'à l'annulation d'un lot (`ctx.annulation`) :
   * c'est elle qui remet la valeur d'avant. Un mot-clé a un repère si et seulement s'il n'a ni page ni sort (docs/chantier-retrait-des-colonnes.md, §2) :
   * celui qui reçoit une page ou un sort perd le sien dans la même opération (sa définition, sa couleur et son icône passent sur la page ou le sort,
   * R309 (14)) ; celui que l'annulation laisse sans page ni sort en retrouve un, fait de la page ou du sort quitté
   * (repereDeLElementQuitte), si le lot ne l'a pas déjà remis.
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
    if (table === 'type_sort') return; // un type de sort n'est pas l'élément de son mot-clé : sa page de notion l'est, sinon son repère
    if (mot_cle_id !== null) reprendreLeRepere(db, w, mot_cle_id, { table, id });
    if (ligne.mot_cle_id !== null && ligne.mot_cle_id !== mot_cle_id) repereDeLElementQuitte(ctx, ligne.mot_cle_id, table, id);
  }

  /**
   * L'annulation d'un lot a retiré au mot-clé `motCleId` sa page ou son sort (`table`, `id`) : s'il reste sans page, sans sort et sans repère, il en reçoit un,
   * fait de l'élément quitté (le titre, l'adresse, la définition, la couleur et l'icône de la page, vidées sur elle ; le nom, la définition, la couleur et
   * l'icône d'un sort, vidées sur lui, sans adresse), pour garder un nom.
   */
  function repereDeLElementQuitte(ctx, motCleId, table, id) {
    const { db, w } = ctx;
    if (!nomSurLElement(db) || !lireLigne(db, 'mot_cle', { id: motCleId }) || elementDuMotCle(db, motCleId)) return;
    const p = table === 'sort'
      ? db.prepare('SELECT nom AS titre, definition, couleur, icone FROM sort WHERE id = ?').get(id)
      : db.prepare('SELECT titre, definition, couleur, icone FROM page WHERE id = ?').get(id);
    const adresse = table === 'sort' ? null : adresseDeLaPageEnBase(db, id);
    creerLeRepere(w, motCleId, { nom: p.titre, adresse, definition: p.definition, couleur: p.couleur, icone: p.icone });
    const portes = Object.fromEntries(['definition', 'couleur', 'icone'].filter((c) => p[c] !== null).map((c) => [c, null]));
    if (Object.keys(portes).length) w.modifier(table, { id }, portes);
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
   * L'opération `aligner_mot_cle` d'un lot (gardée pour les lots déjà déposés, rejoués ou repris) : elle recopiait sur le mot-clé `id` le nom et l'adresse de
   * son élément ; depuis la migration 0136 ils se lisent sur lui, elle n'écrit plus rien. Ses refus restent : un mot-clé introuvable (404), qui n'ancre
   * aucun élément (409). La clé n'est pas recalculée ici : `recalculerEnFinDeLot`, une fois, après la dernière opération.
   */
  function alignerMotCle(ctx, id) {
    const { db } = ctx;
    const m = lireUnMotCle(db, id);
    if (!m) throw new ErreurEdition(404, `Mot-clé introuvable : ${JSON.stringify(id)}`);
    if (!ancreDuMotCle(db, id)) throw new ErreurEdition(409, `${motCleDansUnRefus(m.libelle)} n’ancre aucun élément : il ne s’aligne sur rien.`);
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
    const categorie = categorieDuType(db, nom); // même renommée au Glossaire
    if (categorie === null) return null;
    const url = adresseDeLaPage(id, null); // une page neuve n'a pas de segment renommé (R316)
    // seul un repère écrit son adresse (migration 0136) : une page en a une à elle, que rien d'autre ne tient
    const tenue = nomSurLElement(db) ? 'SELECT 1 FROM repere WHERE adresse = ?' : 'SELECT 1 FROM mot_cle WHERE url = ?';
    if (db.prepare(tenue).get(url)) return null;
    ctx.adressesDuLot = null; // la page vient d'être créée : les adresses retenues par le lot ne la connaissent pas
    try {
      return w.isoler(() => ancrerNouveau(ctx, { table: 'page', id, libelle: titre, url, type: categorie }));
    } catch (e) {
      if (e instanceof ErreurEdition) return null;
      throw e;
    }
  }

  /**
   * Fin d'un lot écrit par le service : les clés suivent ce que CE lot a changé (`w.lignes`, jamais l'état de la base : un renommage annulé ne revient pas). Le
   * nom d'un mot-clé se lit sur sa page, son sort ou son repère (migration 0136) : `page.titre`, `sort.nom` ou `repere.nom` changé, il a déjà suivi, et les
   * clés se recalculent. Un renommage n'est jamais refusé à cause du mot-clé (docs/chantier-ancrage-mots-cles.md, choix 7) : celui d'une page ou d'un sort que
   * la règle ne sait pas distinguer garde sa clé, à trancher (serveur/edition-mots-cles.mjs#clesTenues). `magie.nom` : la clé des sorts homonymes dépend de
   * leur parent ; un mot-clé retiré (`ctx.clesDues`) : un homonyme peut retrouver sa clé. Dans ces deux cas le recalcul est dû : s'il est refusé, le refus
   * remonte (sans numéro de décision), car le vocabulaire resterait faux. Jamais en annulation ni au rejeu (qui relit le journal). Rend vrai s'il a recalculé
   * les clés : l'appelant n'a pas à le refaire. D'abord, l'adresse d'une page renommée suit son titre (décision R316, serveur/edition-adresses.mjs).
   */
  function suivreLesElements(ctx) {
    if (ctx.annulation) return false;
    ADRESSES.suivreLesTitres(ctx);
    const { db, w } = ctx;
    const clesDues = ctx.clesDues === true;
    ctx.clesDues = false;
    let renomme = false;
    let parentChange = false;
    for (const { table, cle, colonnes } of w.lignes) {
      if (!colonnes) continue;
      if ((table === 'page' && colonnes.includes('titre')) || (table === 'sort' && colonnes.includes('nom'))) {
        renomme ||= (db.prepare(`SELECT mot_cle_id AS id FROM "${table}" WHERE id = ?`).get(cle.id)?.id ?? null) !== null;
      } else if (table === 'repere' && colonnes.includes('nom')) {
        renomme = true;
      } else if (table === 'magie' && colonnes.includes('nom')) {
        parentChange ||= Boolean(db.prepare('SELECT 1 FROM sort WHERE magie_id = ? AND mot_cle_id IS NOT NULL LIMIT 1').get(cle.id));
      }
    }
    const recalculDu = parentChange || clesDues;
    if (!renomme && !recalculDu) return false;
    try {
      w.isoler(() => MOTS_CLES.recalculerLesCles(ctx));
      return true;
    } catch (e) {
      if (!(e instanceof ErreurEdition)) throw e;
      if (!recalculDu) return false;
      return sansNumeroDeDecision(() => { throw e; });
    }
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
   * dégâts, une monnaie, un sort qui le porte : R289), il reste ; sans autre page ni sort, il reçoit alors un repère au nom de l'élément parti (`element` : la
   * ligne de la page ou du sort supprimé), avec sa définition, sa couleur et son icône, sans adresse : le lecteur voit le même nom et la même
   * infobulle, la balise ne mène plus nulle part. Sur une base d'avant la migration 0136, son adresse se vide s'il menait à l'élément parti (`adresse`).
   */
  function retirerLeMotCle(ctx, id, { adresse = null, element = null } = {}) {
    const { db, w } = ctx;
    const m = lireLigne(db, 'mot_cle', { id });
    if (!m) return;
    const nom = element?.titre ?? element?.nom ?? nomDuMotCle(db, id);
    if (m.verrou) throw new ErreurEdition(409, `${motCleDansUnRefus(nom)} est verrouillé : il ne se retire pas.`);
    if (estAncre(db, id) || db.prepare('SELECT 1 FROM sort_mot_cle WHERE mot_cle_id = ? LIMIT 1').get(id)) {
      if (!nomSurLElement(db)) {
        if (adresse !== null && m.url === adresse) w.modifier('mot_cle', { id }, { url: null });
      } else repereDuSurvivant(ctx, id, nom, element);
      return;
    }
    retirerLesFillesDuMotCle(db, w, id);
    w.supprimer('mot_cle', { id });
    ctx.clesDues = true;
  }

  /**
   * Le mot-clé `id` vient de perdre sa page ou son sort (`element` : la ligne supprimée), par un lot ou par l'annulation d'un lot (R289 ; décisions B3-3 et
   * B3-4 du chantier 4) : s'il existe encore sans page, sans sort ni repère, il reçoit un repère au nom `nom`, avec la définition, la couleur et l'icône
   * de la page ou du sort (R309 (14)), sans adresse (l'élément parti n'en a plus). Jamais un second : un repère déjà là (remis par l'annulation elle-même) reste tel quel.
   */
  function repereDuSurvivant(ctx, id, nom, element) {
    const { db, w } = ctx;
    if (!nomSurLElement(db) || !lireLigne(db, 'mot_cle', { id }) || elementDuMotCle(db, id)) return;
    creerLeRepere(w, id, { nom, definition: element?.definition ?? null, couleur: element?.couleur ?? null, icone: element?.icone ?? null });
  }

  /**
   * L'annulation d'un lot a supprimé la page ou le sort `element` (la ligne retirée) : son mot-clé, qui reste (motCleARetirer : null en annulation), retrouve
   * un repère si le lot ne le lui a pas déjà remis (repereDuSurvivant).
   */
  function repereApresLAnnulation(ctx, element) {
    if (!ctx.annulation || (element?.mot_cle_id ?? null) === null) return;
    repereDuSurvivant(ctx, element.mot_cle_id, element.titre ?? element.nom, element);
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
      if (n > 1) sortie.push({ id, message: refusDeLaSecondeCategorie(nomDuMotCle(db, id), n) });
    }
    return sortie;
  }

  return {
    ancrerNouveau, ancrerElement, alignerMotCle, recalculerEnFinDeLot, ancrerLaPage, suivreLesElements, motCleARetirer, retirerLeMotCle, repereApresLAnnulation, sousLeVerrou,
    refusDuVerrou, secondesCategories,
  };
}
