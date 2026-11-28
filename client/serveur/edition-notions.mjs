// Les pages de notion (docs/chantier-pages-de-notion.md, §1, §3, §4 ; R309 (7)) : la page `guide/<nom>` d'un mot-clé, hors de tout menu, servie à
// /regles/<nom>/, dont le texte n'est que le bloc calculé `notion` (lib/guide.mjs#CORPS_D_UNE_PAGE_DE_NOTION) et qui n'a pas de résumé. Le mot-clé l'ancre
// (`page.mot_cle_id`) : son nom et son adresse viennent d'elle, il ne se modifie plus à la main (serveur/edition-ancrage.mjs#refusDuVerrou).
//   - creerLaPageDeNotion : la page d'un mot-clé EXISTANT (l'opération `creer_page_de_notion` d'un lot de changements) ; le mot-clé garde son numéro, sa clé,
//     son type et ses synonymes ; son nom et son adresse se lisent sur la page, où passent la définition, la couleur et l'icône de son repère, qui part ;
//   - creerLaNotion : la notion NOUVELLE, sa page puis son mot-clé, ancré, dans la même opération (le Glossaire, tâche suivante du chantier) ;
//   - estUnePageDeNotion, idDeNotion, refusDeLaNotion : ce que le service, le plan et l'annulation d'un lot en lisent.
// Aucune entrée de menu (`regles_onglet_entree`) n'est écrite ici. Aucun refus d'ici ne cite un numéro de décision : un refus qui en cite un devient un verrou
// que une session Créateur ouvre (edition-lots.mjs#ecrireLesOperations) ; un nom qui s'écrit comme un numéro n'entre pas dans le message.
// Sans import de serveur/edition.mjs : ses outils sont donnés par outilsDesNotions (patron de edition-ancrage.mjs#outilsDeLAncrage). Node seulement.
import { adresseDeLaPage, indexDesAdresses } from '../src/lib/adresses-db.mjs';
import { CORPS_D_UNE_PAGE_DE_NOTION } from '../src/lib/guide.mjs';
import { estDansDecouvrir, estDuGuideDuMj } from '../src/lib/livres.mjs';
import { lireUnMotCle } from '../src/lib/mots-cles-db.mjs';
import { normalize } from '../src/lib/text.mjs';
import { nomSurLElement, reprendreLeRepere } from './edition-mots-cles.mjs';

/** La mention d'une décision dans un refus repris d'ailleurs (« (décision R233 (4)) ») : retirée, ce refus n'est pas un verrou. */
const MENTION_D_UNE_DECISION = / ?\(décisions? R[0-9]+(?: \([0-9]+\))?(?:, R[0-9]+(?: \([0-9]+\))?)*\)/g;
const CITE_UN_NUMERO = /\bR[0-9]+\b/;

/** Le sujet d'un refus : le nom, sauf s'il s'écrit comme un numéro de décision. */
const leNom = (libelle) => (libelle && !CITE_UN_NUMERO.test(libelle) ? `« ${libelle} »` : 'Ce nom');

/**
 * Vrai si la page `pageId` est une page de notion : du type `guide`, pas d'exemple, sans entrée dans un onglet des Règles, ni dans Découvrir ni dans le Guide
 * du MJ (listes fixes de lib/livres.mjs : le plan installé n'est pas demandé).
 */
export function estUnePageDeNotion(db, pageId) {
  if (typeof pageId !== 'string') return false;
  const p = db.prepare('SELECT type, statut FROM page WHERE id = ?').get(pageId);
  if (!p || p.type !== 'guide' || p.statut === 'example') return false;
  if (db.prepare('SELECT 1 FROM regles_onglet_entree WHERE page_id = ? LIMIT 1').get(pageId)) return false;
  return !estDansDecouvrir(pageId) && !estDuGuideDuMj(pageId);
}

/**
 * Les outils des pages de notion, liés au service d'édition (serveur/edition.mjs les donne : `idPris` vient de edition-plan.mjs#domainesDuPlan).
 * @param {{ ErreurEdition: Function, refus: Function, creerPage: Function, creerMotCle: Function, idPris: Function }} outils
 */
export function outilsDesNotions({ ErreurEdition, refus, creerPage, creerMotCle, idPris }) {
  const ongletsDe = (db) => db.prepare('SELECT id FROM regles_onglet').all().map((o) => o.id);

  /** Le premier identifiant libre tiré de `cle` : guide/<cle>, puis -2, -3… */
  function premierIdLibre(db, cle, { pris = new Set(), onglets = ongletsDe(db), index = indexDesAdresses(db, { exemples: true }) } = {}) {
    let slug = cle;
    for (let n = 2; pris.has(`guide/${slug}`) || idPris(db, slug, onglets, index); n += 1) slug = `${cle}-${n}`;
    return `guide/${slug}`;
  }

  /**
   * L'identifiant de la page de notion de `nom` : guide/<normalize(nom)>, suffixé -2, -3… tant qu'il est pris (une page, une page supprimée du journal ou du plan,
   * un nom réservé, un onglet, une adresse tenue : edition-plan.mjs#idPris) ou dans `pris` (les pages d'un même lot). null si le nom n'a ni lettre ni chiffre.
   */
  function idDeNotion(db, nom, { pris = new Set() } = {}) {
    const cle = normalize(String(nom ?? ''));
    return cle ? premierIdLibre(db, cle, { pris }) : null;
  }

  /**
   * Pourquoi le mot-clé `motCle` ({ id?, libelle }) ne peut pas avoir de page de notion, ou null : un nom sans lettre ni chiffre ; un mot-clé EXISTANT (`id`
   * donné) qui désigne déjà une page, qui mène déjà quelque part (`url` non nulle : sa page en changerait la destination de ses mentions), ou qui est celui
   * d'un sort ou d'une magie (son adresse reste la leur) ; un nom qui est déjà le titre, l'adresse ou un alias d'une page (`cle_page` : le message la nomme).
   * Le mot-clé d'un type de sort, d'un type de dégâts ou d'une monnaie, sans adresse, est admis. { statut, message, details? }.
   */
  function refusDeLaNotion(db, motCle) {
    const libelle = String(motCle?.libelle ?? '');
    const cle = normalize(libelle);
    if (!cle) return { statut: 409, message: `${leNom(libelle)} : le nom d’une notion doit contenir au moins une lettre ou un chiffre.` };
    if (motCle.id !== undefined && motCle.id !== null) {
      const designee = db.prepare('SELECT id FROM page WHERE mot_cle_id = ?').get(motCle.id);
      if (designee) return { statut: 409, message: `${leNom(libelle)} : ce mot-clé désigne déjà la page ${designee.id}.`, details: { page: designee.id } };
      const sort = db.prepare('SELECT id FROM sort WHERE mot_cle_id = ? ORDER BY id LIMIT 1').get(motCle.id);
      if (sort) return { statut: 409, message: `${leNom(libelle)} : c’est le mot-clé d’un sort, il mène à sa fiche et ne reçoit pas de page de notion.`, details: { sort: sort.id } };
      const magie = db.prepare('SELECT id FROM magie WHERE mot_cle_id = ? ORDER BY id LIMIT 1').get(motCle.id);
      if (magie) return { statut: 409, message: `${leNom(libelle)} : c’est le mot-clé d’une magie, il mène à sa page et ne reçoit pas de page de notion.`, details: { magie: magie.id } };
      // seul un repère écrit son adresse depuis la migration 0136 (celle d'une page ou d'un sort se lit sur eux, refusés plus haut)
      const url = (nomSurLElement(db) ? db.prepare('SELECT adresse AS url FROM repere WHERE mot_cle_id = ?') : db.prepare('SELECT url FROM mot_cle WHERE id = ?')).get(motCle.id)?.url ?? null;
      if (url !== null) {
        return { statut: 409, message: `${leNom(libelle)} : ce mot-clé mène déjà à une adresse ; une page de notion changerait la destination de ses mentions.`, details: { url } };
      }
    }
    const autre = db.prepare('SELECT page_id FROM cle_page WHERE cle = ? ORDER BY page_id LIMIT 1').get(cle);
    if (autre) {
      return { statut: 409, message: `${leNom(libelle)} : c’est déjà le nom de la page ${autre.page_id} (les [[liens]] deviendraient ambigus).`, details: { page: autre.page_id } };
    }
    return null;
  }

  const leverLeRefus = (r) => {
    if (r) throw new ErreurEdition(r.statut, r.message, r.details);
  };

  /**
   * La page de notion du mot-clé EXISTANT `mot_cle_id` : son nom pour titre (caractère pour caractère), ni résumé ni entrée de menu, le bloc `notion` pour texte,
   * la provenance de toute page créée (creerPage), ancrée sur le mot-clé. Son repère part dans la même opération (un mot-clé a un repère si et seulement s'il
   * n'a ni page ni sort : docs/chantier-retrait-des-colonnes.md, §2) : sa définition, sa couleur et son icône passent sur la page, par le journal, hors du
   * verrou ; rien n'est copié sur le mot-clé, dont le nom et l'adresse se lisent désormais sur la page.
   * `titre`, s'il est donné (un lot de changements l'écrit), est son nom tel qu'il s'écrit. `id`, s'il est donné, est guide/<nom> ou guide/<nom>-<n> (n ≥ 2,
   * sans zéro en tête), encore libre ; pas forcément le premier libre : un identifiant que le journal garde (une page annulée puis reprise) n'est jamais
   * réutilisé, et le lot repris en donne un suivant. Refus : 404 (mot-clé inconnu), 409 (refusDeLaNotion, titre autre que son nom, identifiant d'une autre
   * forme, ou déjà pris). Rend l'id de la page.
   */
  function creerLaPageDeNotion(ctx, { mot_cle_id, id = undefined, titre = undefined }) {
    const { db, w } = ctx;
    const m = Number.isInteger(mot_cle_id) ? lireUnMotCle(db, mot_cle_id) : null;
    if (!m) throw new ErreurEdition(404, `Mot-clé introuvable : ${JSON.stringify(mot_cle_id ?? null)}`);
    leverLeRefus(refusDeLaNotion(db, m));
    if (titre !== undefined && titre !== m.libelle) throw new ErreurEdition(409, `${leNom(m.libelle)} : sa page de notion prend son nom pour titre, tel qu’il s’écrit.`);
    const cle = normalize(m.libelle);
    const onglets = ongletsDe(db);
    const index = indexDesAdresses(db, { exemples: true });
    let pageId;
    if (id === undefined) pageId = premierIdLibre(db, cle, { onglets, index });
    else {
      const slug = typeof id === 'string' && id.startsWith('guide/') ? id.slice('guide/'.length) : null;
      if (slug === null || !new RegExp(`^${cle}(?:-(?:[2-9]|[1-9][0-9]+))?$`).test(slug)) {
        throw new ErreurEdition(409, `${leNom(m.libelle)} : l’identifiant donné n’est pas celui de sa page de notion (guide/${cle}, suivi ou non de -2, -3…).`);
      }
      if (idPris(db, slug, onglets, index)) throw new ErreurEdition(409, `L’identifiant ${id} est déjà employé (une page, une page supprimée, un nom réservé ou un onglet) : prenez le suivant.`);
      pageId = id;
    }
    creerPage(ctx, { type: 'guide', slug: pageId.slice('guide/'.length), titre: m.libelle, resume: null, corps: CORPS_D_UNE_PAGE_DE_NOTION, index, motCle: m.id });
    reprendreLeRepere(db, w, m.id, { table: 'page', id: pageId });
    return pageId;
  }

  /**
   * La notion NOUVELLE : sa page (comme creerLaPageDeNotion, sans ancre), puis son mot-clé (creerMotCle : type `categorie`, définition, synonymes, couleur,
   * icône), qui la prend pour ancre et pour adresse. `categorie` absente ou nulle : la notion est créée sans type (une base qui n'a pas encore la catégorie
   * « Notion » ; « Préparer l'ancrage » la liste ensuite « à trancher »). Contrôlée d'abord par refusDeLaNotion ; tout refus de creerMotCle remonte sans mention
   * de décision, et rien n'est écrit : jamais de page sans mot-clé, ni de mot-clé sans page. Rend { id (du mot-clé), page }.
   */
  function creerLaNotion(ctx, { libelle, categorie = null, description = null, synonymes = [], couleur = null, icone = null }) {
    const { db, w } = ctx;
    if (typeof libelle !== 'string') throw refus('Notion : son nom est attendu (un texte).');
    leverLeRefus(refusDeLaNotion(db, { libelle }));
    return w.isoler(() => {
      try {
        const onglets = ongletsDe(db);
        const index = indexDesAdresses(db, { exemples: true });
        const page = premierIdLibre(db, normalize(libelle), { onglets, index });
        creerPage(ctx, { type: 'guide', slug: page.slice('guide/'.length), titre: libelle, resume: null, corps: CORPS_D_UNE_PAGE_DE_NOTION, index, motCle: null });
        const id = creerMotCle(ctx, libelle, description, { url: adresseDeLaPage(page, null), categories: categorie === null ? [] : [categorie], synonymes, couleur, icone, ancre: { table: 'page', id: page } });
        return { id, page };
      } catch (e) {
        if (!(e instanceof ErreurEdition)) throw e;
        const message = e.message.replace(MENTION_D_UNE_DECISION, '');
        throw new ErreurEdition(e.statut, CITE_UN_NUMERO.test(message) ? 'Ce nom ne peut pas devenir une notion : la règle des mots-clés le refuse.' : message, e.details);
      }
    });
  }

  return { estUnePageDeNotion, idDeNotion, refusDeLaNotion, creerLaPageDeNotion, creerLaNotion };
}
