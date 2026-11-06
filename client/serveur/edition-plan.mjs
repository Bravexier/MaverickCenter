// Édition du plan des Règles et de l'ordre des races depuis le site de dev (lot de l'édition des menus et des pages ; demandes du propriétaire : « En
// mode Edition il faut prévoir de pouvoir changer l'ordre des menu latéraux (par un glisser déposer) », « En mode Edition il faut prévoir aussi de
// pouvoir ajouter / supprimer une page » ; réponses « Règles + Races », « Oui, par une liste », entrées « bientôt » déplaçables, ordre des onglets
// fixe, « Pages des Règles », « Titre, onglet, résumé », « Refus si citée, puis 404 », pages protégées sans bouton ; docs/serveur.md, « Pages ») :
//   - l'opération `ordonner` : l'ordre d'un menu d'onglet (la liste exacte de ses entrées, sinon 409) ou d'un groupe de races (pures ou hybrides : la
//     liste exacte du groupe, qui reprend les rangs qu'il occupait) ; seules les lignes dont le rang change sont écrites (et notées au journal) ;
//   - le domaine de regles_onglet_entree (opération `modifier`) : l'onglet d'une page (elle passe en fin du menu de l'autre onglet ; refusé, avant toute
//     écriture, pour une page d'ouverture d'onglet, un lien ou une entrée « bientôt ») et sa place ;
//   - la création d'une page des Règles (ENTITES.page_des_regles) et sa suppression (refusée si une raison la protège, lib/pages-protegees.mjs, ou si une
//     autre page la cite, lib/citations-db.mjs) ;
//   - le plan vivant pour la page (GET /api/edition/plan/ : planVivant).
// Les onglets eux-mêmes (regles_onglet) ne changent jamais ici. Les outils communs du service (refus, ErreurEdition, creerPage, supprimerPage,
// idDejaEmploye, A_COMPLETER) sont donnés par serveur/edition.mjs, sans import en retour. Node seulement (node:sqlite), sans dépendance.
import { citationsBloquantes, citationsDe, citationsDesPages } from '../src/lib/citations-db.mjs';
import { adresseDuGuide, NOMS_RESERVES, PAGES_ABSORBEES, PAGES_RETIREES, PAGES_SUPPRIMEES } from '../src/lib/livres.mjs';
import { raisonsDeProtection } from '../src/lib/pages-protegees.mjs';
import { racesParNature } from '../src/lib/races-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireLigne } from './edition-journal.mjs';

/** Les groupes de races qu'une opération `ordonner` réordonne (lib/races-db.mjs#racesParNature). */
export const GROUPES_DE_RACES = Object.freeze(['pures', 'hybrides']);

const ongletDe = (db, id) => (typeof id === 'string' ? lireLigne(db, 'regles_onglet', { id }) : null);
const entreesDe = (db, onglet) => db.prepare('SELECT * FROM regles_onglet_entree WHERE onglet_id = ? ORDER BY rang, id').all(onglet).map((e) => ({ ...e }));
const rangSuivant = (db, onglet) => (db.prepare('SELECT max(rang) AS m FROM regles_onglet_entree WHERE onglet_id = ?').get(onglet).m ?? 0) + 1;
/** Les trois sortes d'entrée d'un menu (CHECK de regles_onglet_entree) : une page, un lien, une entrée grisée « bientôt ». */
const SORTES = Object.freeze({ page: 'page', lien: 'lien', bientot: 'bientot' });
const sorteDe = (e) => (e.page_id !== null ? SORTES.page : String(e.id).startsWith('bientot:') ? SORTES.bientot : SORTES.lien);

/**
 * Les rangs d'une liste réordonnée : ceux qu'elle occupait (`rangs`, dans l'ordre croissant), rendus strictement croissants (deux rangs égaux, que l'id
 * ou le nom départageait, deviennent consécutifs) ; une place sans rang (NULL : une race pas encore rangée) prend la suite de `apres` (le plus grand
 * rang de la table). Une liste déjà numérotée sans trou ni doublon garde ses rangs : seul ce qui bouge change.
 */
export function rangsReordonnes(rangs, apres = 0) {
  const connus = rangs.filter((r) => r !== null && r !== undefined).sort((a, b) => a - b);
  const sortie = [];
  for (const r of connus) sortie.push(sortie.length && r <= sortie.at(-1) ? sortie.at(-1) + 1 : r);
  let suite = Math.max(apres, sortie.at(-1) ?? 0);
  while (sortie.length < rangs.length) sortie.push((suite += 1));
  return sortie;
}

/**
 * Les domaines et l'opération du plan pour serveur/edition.mjs : { entree (DOMAINES.regles_onglet_entree), page: { creer, supprimer } (ENTITES
 * .page_des_regles, sur la table page), ordonner (opération du lot) }.
 * @param {{ refus: Function, ErreurEdition: Function, creerPage: Function, supprimerPage: Function, idDejaEmploye: Function, A_COMPLETER: string }} outils
 */
export function domainesDuPlan({ refus, ErreurEdition, creerPage, supprimerPage, idDejaEmploye, A_COMPLETER }) {
  /** Une liste d'identifiants (chaînes), sans doublon : 400 sinon. */
  function identifiants(liste, quoi) {
    if (!Array.isArray(liste) || !liste.length || !liste.every((x) => typeof x === 'string' && x)) throw refus(`${quoi} : une liste d’identifiants est attendue (« ids »).`);
    if (new Set(liste).size !== liste.length) throw refus(`${quoi} : un identifiant est donné deux fois.`);
    return liste;
  }

  /** La liste reçue est-elle exactement celle de la base (mêmes éléments, ordre libre) ? Sinon 409 : la page montrait un état périmé. */
  function memesElements(recus, attendus, quoi) {
    const a = new Set(attendus);
    if (recus.length !== attendus.length || !recus.every((x) => a.has(x))) {
      throw new ErreurEdition(409, `${quoi} a changé depuis l’affichage de la page (une entrée ajoutée, retirée ou déplacée ailleurs) : rechargez la page.`, { attendus });
    }
  }

  /**
   * `ordonner` : { op: 'ordonner', onglet, ids } (l'ordre du menu latéral d'un onglet des Règles : tous les identifiants de ses entrées, pages, liens
   * et entrées « bientôt ») ou { op: 'ordonner', races: 'pures' | 'hybrides', ids } (l'ordre d'un groupe de la liste des races : tous ses
   * identifiants) ; refus 400 (forme), 404 (onglet inconnu), 409 (la liste n'est pas exactement celle de la base). Les rangs que la liste occupait
   * sont redonnés dans le nouvel ordre (rangsReordonnes) ; seules les lignes dont le rang change sont écrites.
   */
  function ordonner(ctx, op) {
    const { db, w } = ctx;
    const enOnglet = op.onglet !== undefined;
    if (enOnglet === (op.races !== undefined)) throw refus('ordonner : « onglet » (le menu d’un onglet des Règles) ou « races » (pures ou hybrides), l’un des deux.');
    if (enOnglet) {
      const onglet = ongletDe(db, op.onglet);
      if (!onglet) throw new ErreurEdition(404, `Onglet des Règles introuvable : ${op.onglet}`);
      const quoi = `Le menu « ${onglet.titre} »`;
      const ids = identifiants(op.ids, quoi);
      const entrees = entreesDe(db, onglet.id);
      memesElements(ids, entrees.map((e) => e.id), quoi);
      const rangs = rangsReordonnes(entrees.map((e) => e.rang));
      // un rang qui ne change pas n'est ni écrit ni noté (w.modifier)
      ids.forEach((id, i) => w.modifier('regles_onglet_entree', { id }, { rang: rangs[i] }));
      return `Ordre du menu « ${onglet.titre} »`;
    }
    if (!GROUPES_DE_RACES.includes(op.races)) throw refus(`ordonner : « races » vaut ${GROUPES_DE_RACES.map((g) => `« ${g} »`).join(' ou ')}.`);
    const quoi = `La liste des races ${op.races}`;
    const ids = identifiants(op.ids, quoi);
    const groupe = racesParNature(db)[op.races];
    memesElements(ids, groupe.map((r) => r.id), quoi);
    const apres = db.prepare('SELECT max(rang_liste) AS m FROM race').get().m ?? 0;
    const rangs = rangsReordonnes(groupe.map((r) => r.rang_liste), apres);
    ids.forEach((id, i) => w.modifier('race', { id }, { rang_liste: rangs[i] }));
    return `Ordre de la liste des races (${op.races})`;
  }

  /**
   * regles_onglet_entree (opération `modifier`) : changer d'onglet (onglet_id) met l'entrée en fin du menu de l'autre onglet (son rang est recalculé,
   * un rang donné avec elle ignoré) ; refusé pour un lien ou une entrée « bientôt » (400 : ils restent dans leur onglet) et pour la page d'ouverture
   * d'un onglet (409 : l'ouverture des onglets est fixe). Un rang seul se modifie tel quel.
   */
  const entree = {
    colonnes(ctx, ligne, valeurs, avant) {
      if (!('onglet_id' in valeurs) || valeurs.onglet_id === avant.onglet_id) return {};
      const { db } = ctx;
      const cible = ongletDe(db, valeurs.onglet_id);
      if (!cible) throw refus(`Onglet des Règles inconnu : ${valeurs.onglet_id}`);
      const sorte = sorteDe(avant);
      if (sorte !== SORTES.page) throw refus(`« ${avant.libelle} » : ${sorte === SORTES.lien ? 'un lien' : 'une entrée « bientôt »'} ne change pas d’onglet (on ne change que l’onglet d’une page).`);
      const ouvre = db.prepare('SELECT titre FROM regles_onglet WHERE ouverture_page_id = ?').get(avant.page_id);
      if (ouvre) {
        throw new ErreurEdition(409, `${avant.page_id} ouvre l’onglet « ${ouvre.titre} » (sa page d’ouverture, fixe) : elle ne change pas d’onglet.`, { page: avant.page_id });
      }
      return { rang: rangSuivant(db, cible.id) };
    },
  };

  /** L'identifiant d'une page des Règles est-il pris ou réservé (le slug `slug`) ? Voir creer. */
  function idPris(db, slug, onglets) {
    const id = `guide/${slug}`;
    return Boolean(lireLigne(db, 'page', { id }) || idDejaEmploye(db, ['page'], id) || PAGES_SUPPRIMEES.includes(id) || Object.hasOwn(PAGES_ABSORBEES, id)
      || Object.hasOwn(PAGES_RETIREES, id) || NOMS_RESERVES.includes(slug) || onglets.includes(slug)
      || db.prepare('SELECT 1 FROM cle_page WHERE cle = ?').get(slug));
  }

  const page = {
    /**
     * Une page des Règles : { titre, onglet_id, resume, bientot? }. Son adresse vient du titre (normalize), figée : /regles/<slug>/ ; un titre qui est
     * déjà le nom (titre, adresse ou alias) d'une autre page : 409 (les [[liens]] deviendraient ambigus) ; un identifiant déjà employé (une page, une
     * page supprimée par le journal ou l'historique, une page supprimée, absorbée ou retirée par le plan, un nom réservé, un id d'onglet) : suffixé -2,
     * -3… Corps « À compléter. », statut brouillon, provenance « Site de dev › édition du … » (famille docs : creerPage). Son entrée en fin du menu de
     * l'onglet ; `bientot` (l'id d'une entrée « bientôt » de cet onglet, dont le libellé est le titre) : l'entrée « bientôt » est retirée et la page
     * prend sa place, dans le même lot.
     */
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const onglet = ongletDe(db, valeurs.onglet_id);
      if (!onglet) throw refus(`Nouvelle page des Règles : onglet inconnu (${valeurs.onglet_id})`);
      let bientot = null;
      if (valeurs.bientot) {
        bientot = lireLigne(db, 'regles_onglet_entree', { id: valeurs.bientot });
        if (!bientot || sorteDe(bientot) !== 'bientot') throw new ErreurEdition(404, `Entrée « bientôt » introuvable : ${valeurs.bientot}`);
        if (bientot.onglet_id !== onglet.id) throw refus(`L’entrée « ${bientot.libelle} » est dans un autre onglet que « ${onglet.titre} ».`);
        if (valeurs.titre !== bientot.libelle) throw refus(`La page qui remplit l’entrée « ${bientot.libelle} » prend son libellé pour titre.`);
      }
      const cle = normalize(valeurs.titre);
      if (!cle) throw refus(`« ${valeurs.titre} » : le titre doit contenir au moins une lettre ou un chiffre.`);
      const autre = db.prepare('SELECT page_id FROM cle_page WHERE cle = ? ORDER BY page_id LIMIT 1').get(cle);
      if (autre) throw new ErreurEdition(409, `Titre « ${valeurs.titre} » : c’est déjà le nom de la page ${autre.page_id} (les [[liens]] deviendraient ambigus).`, { page: autre.page_id });
      const onglets = db.prepare('SELECT id FROM regles_onglet').all().map((o) => o.id);
      let slug = cle;
      for (let n = 2; idPris(db, slug, onglets); n += 1) slug = `${cle}-${n}`;
      const id = creerPage(ctx, { type: 'guide', slug, titre: valeurs.titre, resume: valeurs.resume, corps: `${A_COMPLETER}\n` });
      let rang;
      if (bientot) {
        rang = bientot.rang;
        w.supprimer('regles_onglet_entree', { id: bientot.id });
      } else {
        rang = rangSuivant(db, onglet.id);
      }
      w.inserer('regles_onglet_entree', { id: `page:${id}`, onglet_id: onglet.id, rang, page_id: id, libelle: null, adresse: null });
      return { id, resume: `Page des Règles créée : ${valeurs.titre} (${onglet.titre}${bientot ? ', à la place de l’entrée « bientôt »' : ''})` };
    },

    /**
     * Une page des Règles retirée : 404 inconnue ; 400 si ce n'est pas une page d'un onglet des Règles ; 409 si une raison la protège (`details.raisons`
     * : lib/pages-protegees.mjs) ; 409 si d'autres pages la citent (`details.citations` : lib/citations-db.mjs, sauf les pages d'exemple). Tout est
     * contrôlé avant la moindre écriture. Son entrée de menu est retirée, puis la page et ce qui la décrit (supprimerPage) ; son adresse donne la 404.
     */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const id = typeof cle?.id === 'string' ? cle.id : null;
      const ligne = id ? lireLigne(db, 'page', { id }) : null;
      if (!ligne) throw new ErreurEdition(404, `Page introuvable : ${cle?.id ?? '?'}`);
      const sienne = db.prepare('SELECT e.id, o.titre FROM regles_onglet_entree e JOIN regles_onglet o ON o.id = e.onglet_id WHERE e.page_id = ?').get(id);
      if (ligne.type !== 'guide' || !sienne) {
        throw refus(`${id} n’est pas une page des Règles (seules les pages des quatre onglets se suppriment ici).`);
      }
      const raisons = raisonsDeProtection(db, id);
      if (raisons.length) {
        throw new ErreurEdition(409, `« ${ligne.titre} » ne se supprime pas : ${raisons.map((r) => r.texte).join(' ; ')}.`, { page: id, raisons });
      }
      const citations = citationsBloquantes(citationsDe(db, id));
      if (citations.length) {
        const noms = [...new Set(citations.map((c) => c.libelle))];
        throw new ErreurEdition(409, `« ${ligne.titre} » est citée par ${noms.length > 1 ? `${noms.length} textes` : 'un texte'} (${noms.slice(0, 5).join(', ')}${noms.length > 5 ? '…' : ''}) : retirez d’abord ces liens.`,
          { page: id, citations });
      }
      w.supprimer('regles_onglet_entree', { id: sienne.id });
      supprimerPage(ctx, id);
      return { id, resume: `Page des Règles supprimée : ${ligne.titre} (${sienne.titre})` };
    },
  };

  return { entree, page, ordonner };
}

/**
 * Le plan vivant des Règles et de la liste des races, pour la page en mode modification (GET /api/edition/plan/) :
 *   { onglets: [{ id, titre, ordre, ouverture, entrees: [{ id, sorte, rang, page_id, titre, libelle, adresse, protection, citations, supprimable }] }],
 *     races: { pures: [{ id, nom, rang_liste }], hybrides: [...] } }
 * Les onglets dans l'ordre (`ordre`, puis l'id), leurs entrées dans l'ordre du menu (`rang`, puis l'id). `sorte` : `page`, `lien` ou `bientot` (SORTES) ;
 * `titre` : celui de la page (null sinon) ; `libelle` : celui d'un lien ou d'une entrée « bientôt » (null pour une page) ; `adresse` : relative à la
 * racine du site (une page : /regles/<slug>/, lib/livres.mjs#adresseDuGuide). Pour une page : `protection` (lib/pages-protegees.mjs#raisonsDeProtection),
 * `citations` (lib/citations-db.mjs, celles des pages d'exemple comprises, marquées `exemple`) et `supprimable` (ni protection, ni citation qui bloque) ;
 * `null`, `null` et `false` pour un lien ou une entrée « bientôt ». Les races par groupe, dans l'ordre de la liste (lib/races-db.mjs#racesParNature).
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function planVivant(db) {
  const onglets = db.prepare('SELECT id, titre, ordre, ouverture_page_id FROM regles_onglet ORDER BY ordre, id').all();
  const toutes = db.prepare(`SELECT e.*, p.titre AS page_titre FROM regles_onglet_entree e LEFT JOIN page p ON p.id = e.page_id ORDER BY e.onglet_id, e.rang, e.id`).all();
  const citations = citationsDesPages(db, toutes.filter((e) => e.page_id !== null).map((e) => e.page_id));
  return {
    onglets: onglets.map((o) => ({
      id: o.id,
      titre: o.titre,
      ordre: o.ordre,
      ouverture: o.ouverture_page_id,
      entrees: toutes.filter((e) => e.onglet_id === o.id).map((e) => {
        const sorte = sorteDe(e);
        const estPage = sorte === 'page';
        const protection = estPage ? raisonsDeProtection(db, e.page_id) : null;
        const cites = estPage ? citations.get(e.page_id) : null;
        return {
          id: e.id,
          sorte,
          rang: e.rang,
          page_id: e.page_id,
          titre: estPage ? e.page_titre : null,
          libelle: e.libelle,
          adresse: estPage ? adresseDuGuide(e.page_id) : e.adresse,
          protection,
          citations: cites,
          supprimable: estPage && !protection.length && !citationsBloquantes(cites).length,
        };
      }),
    })),
    races: racesParNature(db),
  };
}
