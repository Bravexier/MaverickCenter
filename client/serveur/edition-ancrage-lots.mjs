// « Préparer l'ancrage » (décision R309, docs/chantier-ancrage-mots-cles.md, §5 ; POST et GET /api/edition/lots/ancrage/, en tâche de fond : `lancerLAncrage`) : dépose les lots
// que calcule le plan (lib/mots-cles-ancrage.mjs), un par un, sur le modèle de « tout recalculer » (edition-lots.mjs#recalculerTout).
//   Avec la clé de dépôt, ou le mot de passe une fois cette clé posée (`par`, R291, R306) : chaque lot passe l'essai à blanc et s'applique ; le plan est recalculé
//   après chacun (une catégorie n'a pas d'id avant sa création) ; le premier refus arrête la suite, avec son motif.
//   Sans elle : un seul lot, en proposition ; la suite vient au prochain lancement, une fois la proposition appliquée.
// Une ligne annulée reste écartée (R291 : annuler est une décision du propriétaire), jusqu'au geste « Reprendre les lignes annulées » (`reprendre`).
import { TABLES_ANCRABLES } from '../src/lib/lot-de-changements.mjs';
import { DECISION_DE_L_ANCRAGE, estUnLotDAncrage } from '../src/lib/lots-d-ancrage.mjs';
import { planDeLAncrage } from '../src/lib/mots-cles-ancrage.mjs';
import { ErreurEdition } from './edition.mjs';
import { deposer, deposerEtAppliquer, motifsDeLEssai, netsDuLot } from './edition-lots.mjs';

/** L'ordre chronologique des lots de l'action : la date de dépôt, puis `rowid` à égalité (relecture finale, Fable m2). */
const ORDRE_DES_LOTS = 'ORDER BY depose_le, rowid';

/** La clé du plan qu'écarte l'annulation de cette ligne de l'effet net, ou null : un mot-clé créé part avec son ancre, un texte ou une clé recalculés ne décident de rien. */
function cleDuPlan(net, crees) {
  if (TABLES_ANCRABLES.includes(net.table)) return net.genre === 'modifier' && Object.hasOwn(net.fin, 'mot_cle_id') ? `${net.table}:${net.cle.id}` : null;
  if (net.table === 'mot_cle') return net.genre === 'modifier' && (Object.hasOwn(net.fin, 'libelle') || Object.hasOwn(net.fin, 'url')) ? `nom:${net.cle.id}` : null;
  if (net.table === 'mot_cle_categorie') return crees.has(net.cle.mot_cle_id) ? null : `type:${net.cle.mot_cle_id}`;
  if (net.table === 'categorie_mot_cle' && net.genre === 'inserer') return `categorie:${net.fin.libelle}`;
  return null;
}

/**
 * Les rangs annulés d'un lot : toujours ses lignes notées (`bilan.lignes_annulees`), y compris celles que l'annulation du lot entier a gardées parce que le propriétaire
 * les a changées depuis. S'y ajoutent, si le lot a été annulé en entier (`bilan.annulation`), ses lignes non gardées ; un lot passé « annulé » par ses lignes n'a que les notées.
 */
function rangsAnnules(lot, nets, bilan) {
  const notees = new Set(Object.keys(bilan?.lignes_annulees ?? {}).map(Number));
  if (lot.etat !== 'annule' || !bilan?.annulation) return notees;
  const gardees = new Set((bilan.annulation.operations ?? []).filter((o) => o.etat === 'gardee').map((o) => o.rang_du_lot));
  return new Set([...notees, ...nets.map((n) => n.rang).filter((r) => !gardees.has(r))]);
}

/**
 * Les clés du plan à ne pas refaire : ce que le propriétaire a annulé dans les lots R309 (`page:<id>`, `sort:<id>`, `type_sort:<id>`, `nom:<mot_cle_id>`,
 * `type:<mot_cle_id>`, et `categorie:<libellé>`, que le plan ne connaît pas : voir `prochainLot`). Les lots se lisent du plus ancien au plus récent : une ligne
 * annulée puis reprise par un lot suivant n'est plus écartée.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {Set<string>}
 */
export function lignesAnnuleesDeLAncrage(db) {
  const ecartees = new Set();
  // l'ordre de dépôt : `depose_le`, `rowid` pour départager (il dépend de la façon dont la table a été copiée)
  const sql = `SELECT etat, lot_id, bilan, decision, auteur FROM lot_de_changements WHERE decision = ? AND etat IN ('applique', 'annule') AND lot_id IS NOT NULL ${ORDRE_DES_LOTS}`;
  for (const lot of db.prepare(sql).all(DECISION_DE_L_ANCRAGE).filter(estUnLotDAncrage)) {
    const nets = netsDuLot(db, lot.lot_id);
    const annules = rangsAnnules(lot, nets, lot.bilan ? JSON.parse(lot.bilan) : null);
    const crees = new Set(nets.filter((n) => n.table === 'mot_cle' && n.genre === 'inserer').map((n) => n.cle.id));
    for (const n of nets) if (!annules.has(n.rang)) ecartees.delete(cleDuPlan(n, crees));
    for (const n of nets) {
      const cle = annules.has(n.rang) ? cleDuPlan(n, crees) : null;
      if (cle) ecartees.add(cle);
    }
  }
  return ecartees;
}

/**
 * Le prochain lot du plan, sans les catégories annulées. Le plan ne connaît pas cette clé : une catégorie qui manque, il la recrée. Elle reste donc retirée ici, sauf si
 * une ligne retenue du lot la cite. Tant qu'elle manque, le plan ne rend pas les créations (`categories` reçoit ce qui est retiré, pour le dire). Null : plus rien à déposer.
 */
function prochainLot(plan, ecartees, categories) {
  const [lot] = plan.lots;
  if (!lot) return null;
  const citees = new Set(lot.operations.map((o) => o.apres?.categorie_id?.$numero).filter(Boolean));
  const operations = lot.operations.filter((o) => {
    if (o.table !== 'categorie_mot_cle' || !ecartees.has(`categorie:${o.apres.libelle}`) || citees.has(o.cle.id.$numero)) return true;
    categories.add(`categorie:${o.apres.libelle}`);
    return false;
  });
  return operations.length ? { ...lot, operations } : null;
}

const resume = (lot) => ({ id: lot.id, titre: lot.titre, etat: lot.etat, operations: lot.operations, ecrites: lot.bilan?.ecrites ?? 0, verdict: lot.verdict ?? null });
/** Le motif d'un arrêt, lu sur la page Mise à jour : « opération N » (le format du lot, edition-lots.mjs#motifsDeLEssai) y devient « ligne N du lot », comme ses autres messages. */
const motifLisible = (motif) => String(motif).replace(/\bopération (\d+) : /g, 'ligne $1 du lot : ');
const VERDICTS_SANS_APPLICATION = new Set(['a_corriger', 'en_echec', 'rien_a_ecrire']);

let enCours = false; // deux enchaînements à la fois calculeraient le même plan

/** L'arrêt d'un enchaînement quand le gel des écritures (serveur/gel.mjs) est posé pendant qu'il tourne. */
export const MOTIF_DU_GEL = 'les écritures sont gelées : relancez une fois le gel levé.';

/**
 * L'action « Préparer l'ancrage ». `comptes` : ce que le plan avait à faire à ce lancement ; `a_trancher` et `ecartees` : l'état du dernier plan calculé.
 * `gelee` (donnée par la route) se relit avant chaque lot : posé en cours de route, le gel arrête la suite ; le lot déjà parti va au bout, il est atomique.
 * @param {() => import('node:sqlite').DatabaseSync | null} base
 * @param {{ par?: 'cle_de_depot' | 'mot_de_passe' | null, reprendre?: boolean, enArrierePlan?: boolean, dossier?: string | null, controle?: object, gelee?: (() => boolean) | null }} [options]
 * @returns {Promise<{ lots: object[], arret: { titre: string, motif: string } | null, suite: boolean, a_trancher: object[], ecartees: string[], comptes: object }>}
 */
export async function preparerLAncrage(base, { par = null, reprendre = false, enArrierePlan = true, dossier = null, gelee = null, ...options } = {}) {
  if (!base()) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
  if (enCours) throw new ErreurEdition(409, 'La préparation de l’ancrage tourne déjà : attendez sa fin.');
  enCours = true;
  try {
    const db = base();
    const ecartees = reprendre ? new Set() : lignesAnnuleesDeLAncrage(db);
    const categories = new Set();
    let plan = planDeLAncrage(db, { ecartees });
    const { comptes } = plan;
    const fin = (lots, arret, suite) => ({ lots, arret, suite, a_trancher: plan.a_trancher, ecartees: [...plan.ecartees, ...categories].sort(), comptes });

    const [enAttente] = db.prepare(`SELECT titre, decision, auteur FROM lot_de_changements WHERE decision = ? AND etat = 'propose' ${ORDRE_DES_LOTS}`)
      .all(DECISION_DE_L_ANCRAGE).filter(estUnLotDAncrage);
    if (enAttente) return fin([], { titre: enAttente.titre, motif: 'cette proposition attend encore votre décision : appliquez-la ou refusez-la, puis relancez.' }, true);

    const lots = [];
    let precedent = null;
    for (;;) {
      const prochain = prochainLot(plan, ecartees, categories);
      if (!prochain) return fin(lots, null, false);
      const { famille, ...lot } = prochain; // `famille` sert au plan : elle n'est pas du format `maverick-lot/1`
      if (gelee?.()) return fin(lots, { titre: lot.titre, motif: MOTIF_DU_GEL }, true);
      const empreinte = JSON.stringify(lot.operations);
      if (empreinte === precedent) return fin(lots, { titre: lot.titre, motif: 'ce lot revient à l’identique après son application : il n’a rien changé.' }, true);
      precedent = empreinte;
      if (!par) {
        const propose = await deposer(base, lot, { enArrierePlan, dossier, ...options });
        const arret = VERDICTS_SANS_APPLICATION.has(propose.verdict) ? { titre: lot.titre, motif: motifLisible(motifsDeLEssai(propose.essai)[0] ?? 'l’essai à blanc le refuse.') } : null;
        return fin([...lots, resume(propose)], arret, true);
      }
      try {
        lots.push(resume(await deposerEtAppliquer(base, lot, { par, enArrierePlan, dossier, ...options })));
      } catch (e) {
        if (!(e instanceof ErreurEdition) || ![400, 409].includes(e.statut)) throw e;
        // à l'essai, un refus décale les ids et les créations suivantes sont refusées en cascade : seul le premier motif dit la cause
        return fin(lots, { titre: lot.titre, motif: motifLisible(e.details?.motifs?.[0] ?? e.message) }, true);
      }
      const vivante = base();
      if (!vivante) throw new ErreurEdition(503, 'La base n’est pas disponible pour le moment.');
      plan = planDeLAncrage(vivante, { ecartees });
    }
  } finally {
    enCours = false;
  }
}

// --- La tâche de fond : l'enchaînement dure plusieurs minutes, nginx coupe une requête à 60 s ------------------------------------------------------------------

const AU_REPOS = { en_cours: false, resultat: null, erreur: null };
let suiviDeLAncrage = AU_REPOS; // en mémoire : un service redémarré ne connaît aucun état, et le plan rejoué reprend là où l'action s'est arrêtée

/** L'état du dernier lancement : `resultat` (ce que rend `preparerLAncrage`) ou `erreur` `{ statut, message }`, gardés jusqu'au lancement suivant. */
export const etatDeLAncrage = () => ({ ...suiviDeLAncrage });

/**
 * Lance `preparerLAncrage` sans l'attendre. Sa fin, réussie ou non, se lit dans `etatDeLAncrage` : aucune erreur ne devient un rejet non traité.
 * @param {() => import('node:sqlite').DatabaseSync | null} base
 * @param {Parameters<typeof preparerLAncrage>[1]} [options]
 * @param {((fin: { resultat: object | null, erreur: { statut: number, message: string } | null, cause: unknown }) => void) | null} [surFin] pour le journal
 * @throws {ErreurEdition} 409 si un lancement tourne déjà
 */
export function lancerLAncrage(base, options = {}, surFin = null) {
  if (suiviDeLAncrage.en_cours) throw new ErreurEdition(409, 'La préparation de l’ancrage tourne déjà : attendez sa fin.');
  suiviDeLAncrage = { en_cours: true, resultat: null, erreur: null };
  const finir = (resultat, erreur, cause = null) => {
    suiviDeLAncrage = { en_cours: false, resultat, erreur };
    try {
      surFin?.({ resultat, erreur, cause });
    } catch {
      // le journal en panne ne change pas le résultat, déjà lisible
    }
  };
  // au tour suivant : le calcul du plan est synchrone, la réponse 202 part avant lui
  setImmediate(() => {
    preparerLAncrage(base, options).then(
      (resultat) => finir(resultat, null),
      (e) => finir(null, e instanceof ErreurEdition ? { statut: e.statut, message: e.message } : { statut: 500, message: 'La préparation de l’ancrage a échoué : le détail est dans le journal du service.' }, e),
    );
  });
  return etatDeLAncrage();
}
