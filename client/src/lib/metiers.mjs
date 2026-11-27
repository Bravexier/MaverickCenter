// Métiers : pas de page par métier (demande du propriétaire). /metiers/ est un long tableau (Nom, Bonus, Artisanat, Caractéristiques, Équipement
// supplémentaire), une ligne par métier de la table `metier`, à la manière des tableaux de sorts ; la description du métier (et son avantage possible)
// s'ouvre sous sa ligne. Bonus liés aux compétences et à l'initiative, artisanat en texte + deux caractéristiques, objets de départ : décisions R33 à R35.
// Les pages `metiers/<slug>` restent dans la base et dans les `.md` fabriqués (recherche, mots-clés, `[[liens]]`), mais tout lien vers un métier
// mène à sa ligne : /metiers/#metier-forgeron. « Règles des métiers », du même type mais sans ligne dans `metier`, garde sa page.
// Sans dépendance (sauf lib/livres.mjs, lib/equipement.mjs et lib/adresses-renommees.mjs, purs eux aussi) : importé par wikilinks.mjs (au démarrage d'Astro), par wiki.ts et par les tests ; `chargerMetiers` reçoit la base ouverte par lib/donnees.mjs.
// Le dernier segment d'une adresse (R316, « l'adresse d'une page suit son titre ») : le second argument `slug` des fonctions d'adresse (page.slug_adresse
// lu par l'appelant : le service) ; undefined lit l'état installé (lib/adresses-renommees.mjs : le build, le navigateur), null n'en prend aucun.
import { slugRenomme } from './adresses-renommees.mjs';
import { ADRESSES_DES_PAGES_SERVIES } from './equipement.mjs';
import { ACCUEIL_DU_GUIDE, ADRESSES_DU_PLAN_PRECEDENT, adresseDeLaPageAbsorbee, adresseDuGuide, DECOUVRIR, PAGES_ABSORBEES, PAGES_RETIREES } from './livres.mjs';

/** La seule page du type `metiers` qui n'est pas un métier (test/metiers.test.mjs vérifie que les autres sont exactement les lignes de `metier`). */
export const PAGE_DES_REGLES = 'metiers/regles-des-metiers';

/** Vrai si la page d'id donné est un métier : une ligne du tableau de /metiers/, sans page à elle. */
export const estUnMetier = (id) => id.startsWith('metiers/') && id !== PAGE_DES_REGLES;

/** Le dernier segment de l'adresse d'une page ordinaire : son segment renommé (R316 ; `slug`, ou l'état installé s'il est undefined), sinon celui de l'id. */
export const segmentDePage = (id, slug = slugRenomme(id)) => slug ?? id.slice(id.indexOf('/') + 1);

/** Ancre HTML de la ligne d'un métier : « metier-forgeron » pour « metiers/forgeron », « metier-<segment> » s'il est renommé (R316, décision 4). */
export const ancreDeMetier = (id, slug) => `metier-${segmentDePage(id, slug)}`;

/**
 * Pages servies par une page de l'équipement, que la route du wiki ne construit pas : les pages « Armes », « Armures », « Bouclier » et « Accessoires »
 * sont servies, à leur adresse, par leur page de l'équipement (src/pages/ressources/armes.astro…), « Bâton magique » par le sous-onglet Bâtons magiques
 * de la page Ceinture, « Pièces élémentaires » par sa section de la page Armes (demandes du propriétaire, 2026-10-16 et 2026-10-29 ;
 * lib/equipement.mjs#ADRESSES_DES_PAGES_SERVIES). Elles restent dans la base (recherche, [[liens]]).
 */
const PAGES_DANS_UNE_AUTRE = ADRESSES_DES_PAGES_SERVIES;

/** Vrai si la page d'id donné n'est pas construite par la route du wiki : ses liens mènent à la page qui la sert (PAGES_DANS_UNE_AUTRE). */
export const pageSansAdresse = (id) => Object.hasOwn(PAGES_DANS_UNE_AUTRE, id);

/** Vrai si la page est servie par une route fixe, dont l'adresse ne suit pas son titre (R316) : les pages de l'équipement (pageSansAdresse) et Bienvenue (/decouvrir/). */
export const pageARouteFixe = (id) => pageSansAdresse(id) || id === DECOUVRIR.accueil;

/**
 * Adresse d'une page du wiki, relative à la racine du site : { chemin: '<type>/<segment>/', ancre: '' } ; pour un métier, la ligne du tableau ; pour
 * une page du guide, son adresse dans le plan du site (lib/livres.mjs#adresseDuGuide : /decouvrir/…, /regles/<slug>/, /mj/… ; plus aucune sous
 * /guide/) ; pour une page servie par une page de l'équipement, cette page (à l'ancre de son sous-onglet ou de sa section). Le segment : `slug`
 * (R316 ; undefined lit l'état installé, null n'en prend aucun), sinon celui de l'id ; une page à route fixe l'ignore.
 */
export function adresseDePage(id, slug) {
  if (estUnMetier(id)) return { chemin: 'metiers/', ancre: ancreDeMetier(id, slug) };
  if (pageSansAdresse(id)) return { ...PAGES_DANS_UNE_AUTRE[id] };
  if (id.startsWith('guide/')) return { chemin: adresseDuGuide(id, slug), ancre: '' };
  return { chemin: `${id.slice(0, id.indexOf('/') + 1)}${segmentDePage(id, slug)}/`, ancre: '' };
}

/** La même adresse en une chaîne : « races/elfe/ », « metiers/#metier-forgeron ». */
export function cheminDePage(id, slug) {
  const { chemin, ancre } = adresseDePage(id, slug);
  return ancre ? `${chemin}#${ancre}` : chemin;
}

/**
 * Sur la page 404 du site de dev, avant la refabrication (R316) : l'adresse où le site construit sert encore la page `page` (l'id de la page vivante à
 * l'adresse demandée, GET /api/edition/page-de-l-adresse/) : son adresse d'après l'état installé (celui du build), sinon null (aucune page, ou le site
 * construit la sert déjà à l'adresse `chemin` demandée : pas de boucle). `chemin` : l'adresse demandée, relative à la racine du site.
 */
export function adresseEncoreServie(page, chemin) {
  if (!page) return null;
  const construite = cheminDePage(page);
  return construite === (String(chemin).endsWith('/') ? chemin : `${chemin}/`) ? null : construite;
}

/**
 * Vrai si la page est servie par la route des pages du wiki (pages/[type]/[slug].astro), quel que soit son segment (R316) : ni un métier, ni une page
 * servie par une autre (pages de l'équipement, même à l'adresse de la page : « ressources/armes » est servie par src/pages/ressources/armes.astro), ni
 * une page du guide (servies par les routes de lib/livres.mjs).
 */
export const estServieASonId = (id) => !estUnMetier(id) && !pageSansAdresse(id) && !id.startsWith('guide/');

/**
 * Les renvois des anciennes adresses du guide vers les nouvelles, relatifs à la racine du site, pour les ids donnés (les pages chargées) :
 *   - avant l'éclatement du guide (2026-10-18) : { 'guide/': <adresse de Découvrir>, 'guide/<slug>/': cheminDePage(id)… } ;
 *   - une page fusionnée dans une autre (lib/livres.mjs#PAGES_ABSORBEES) : 'guide/<slug>/' → la page qui l'absorbe, à l'ancre où se lit son contenu
 *     s'il y en a une (lib/livres.mjs#adresseDeLaPageAbsorbee ; l'ancre de l'ancienne adresse l'emporte), si elle est chargée ;
 *   - une adresse des plans précédents (lib/livres.mjs#ADRESSES_DU_PLAN_PRECEDENT : /decouvrir/<étape>/, /regles/avancees/<slug>/…) → la page qui y
 *     était, ou celle qui l'absorbe, si elle est chargée ;
 *   - une page retirée dont le contenu se lit ailleurs (lib/livres.mjs#PAGES_RETIREES : le Lexique, devenu des mots-clés) : chacune de ses anciennes
 *     adresses → sa destination (/recherche/), tant que la page n'est pas chargée (verifierLePlan arrête le build sinon) ;
 *   - une page renommée (R316) : chaque ancienne adresse sans ancre de `anciennes` (lignes de page_ancienne_adresse, lib/adresses-db.mjs#anciennesAdresses)
 *     → l'adresse d'aujourd'hui de sa page, si elle est chargée et si les deux diffèrent ; une ancienne ancre de métier est portée par sa ligne du tableau.
 * Une page supprimée (lib/livres.mjs#PAGES_SUPPRIMEES) n'y est jamais : la page 404 la dit introuvable (R185 (6)). Les pages découpées en plusieurs
 * (/decouvrir/creer-son-personnage/, « Les situations avancées ») ont leurs renvois selon l'ancre (lib/livres.mjs#PAGES_ECLATEES_DU_GUIDE, passés à part).
 * Lus par la page 404 (pages/404.astro les écrit au build, lib/nav.mjs#nouvelleAdresse les reçoit : nav.mjs n'importe rien), qui garde requête et ancre.
 */
export function renvoisDuGuide(ids, anciennes = []) {
  const renvois = { 'guide/': ACCUEIL_DU_GUIDE };
  const charges = new Set(ids);
  /** L'adresse d'une page chargée, ou de celle qui absorbe une page fusionnée ; null si aucune n'est chargée. */
  const vers = (id) => {
    if (charges.has(id)) return cheminDePage(id);
    if (Object.hasOwn(PAGES_ABSORBEES, id) && charges.has(PAGES_ABSORBEES[id])) return adresseDeLaPageAbsorbee(id, cheminDePage);
    return null;
  };
  for (const id of ids) if (id.startsWith('guide/')) renvois[`${id}/`] = cheminDePage(id);
  for (const ancienne of Object.keys(PAGES_ABSORBEES)) {
    const cible = vers(ancienne);
    if (cible !== null && !charges.has(ancienne)) renvois[`${ancienne}/`] = cible;
  }
  for (const [adresse, id] of Object.entries(ADRESSES_DU_PLAN_PRECEDENT)) {
    const cible = vers(id);
    if (cible !== null && cible !== adresse) renvois[adresse] = cible;
  }
  for (const [retiree, { vers: destination, adresses }] of Object.entries(PAGES_RETIREES)) {
    if (charges.has(retiree)) continue;
    for (const adresse of adresses) renvois[adresse] = destination;
  }
  for (const { adresse, page_id: id } of anciennes) {
    if (adresse.includes('#') || !charges.has(id)) continue;
    const cible = cheminDePage(id);
    if (cible !== adresse) renvois[adresse] = cible;
  }
  return renvois;
}

const espaces = (texte) => texte.replace(/\s+/g, ' ').trim();

/**
 * Les métiers de la base, dans l'ordre alphabétique (nom_cle : sans accents ni casse), prêts pour le tableau :
 *   ligne      : la ligne de la table `metier` (les cellules du tableau sont les rendus de lib/edition-rendu.mjs, les mêmes que le mode modification) ;
 *   bonus      : un élément par rang de `metier_bonus` : { texte, valeur, unite, options: [{ competence_id, attribut }] } ; leurs textes joints par « , »
 *                redonnent `bonus_brut` ; un rang est lié quand chaque option vise une compétence ou l'initiative (décision R33) ;
 *   artisanat  : null si rien à fabriquer ; sinon { texte, test, caracteristiques: [id, id] | [] } (test : le crochet de la source, doubles espaces réduits) ;
 *   objets     : les objets de départ (`metier_objet_depart`, décision R35), un élément par rang : [texte des options] ;
 *   avantage   : null s'il est vide ou réduit à « … » (la source n'y donne aucun exemple) ;
 *   ancre, anciennesAncres : l'ancre de sa ligne, tirée du segment lu en base (R316 : page.slug_adresse, jamais l'état installé), et ses anciennes
 *                ancres (« metier-… » de ses lignes « metiers/#metier-… » de page_ancienne_adresse), vides avant la migration 0133.
 * Aucun texte n'est réécrit.
 */
export function chargerMetiers(db) {
  const segments = new Map();
  if (db.prepare("SELECT 1 FROM pragma_table_info('page') WHERE name = 'slug_adresse'").get()) {
    for (const p of db.prepare("SELECT id, slug_adresse FROM page WHERE type = 'metiers' AND slug_adresse IS NOT NULL").all()) segments.set(p.id, p.slug_adresse);
  }
  const anciennes = new Map();
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'page_ancienne_adresse'").get()) {
    for (const a of db.prepare("SELECT adresse, page_id FROM page_ancienne_adresse WHERE adresse LIKE 'metiers/#metier-%' ORDER BY adresse").all()) {
      (anciennes.get(a.page_id) ?? anciennes.set(a.page_id, []).get(a.page_id)).push(a.adresse.slice('metiers/#'.length));
    }
  }
  const bonus = new Map();
  for (const b of db.prepare('SELECT metier_id, rang, texte, valeur, unite, competence_id, attribut FROM metier_bonus ORDER BY metier_id, rang, option').all()) {
    const rangs = bonus.get(b.metier_id) ?? bonus.set(b.metier_id, []).get(b.metier_id);
    const rang = (rangs[b.rang - 1] ??= { texte: b.texte, valeur: b.valeur, unite: b.unite, options: [] }); // les options d'un rang portent le même texte
    rang.options.push({ competence_id: b.competence_id, attribut: b.attribut });
  }
  const objets = new Map();
  for (const o of db.prepare('SELECT metier_id, rang, texte FROM metier_objet_depart ORDER BY metier_id, rang, option').all()) {
    const rangs = objets.get(o.metier_id) ?? objets.set(o.metier_id, []).get(o.metier_id);
    (rangs[o.rang - 1] ??= []).push(o.texte);
  }
  return db
    .prepare('SELECT * FROM metier ORDER BY nom_cle')
    .all()
    .map((m) => ({
      id: m.id,
      ancre: ancreDeMetier(m.id, segments.get(m.id) ?? null),
      anciennesAncres: anciennes.get(m.id) ?? [],
      nom: m.nom,
      description: m.description,
      ligne: { ...m },
      bonus: (bonus.get(m.id) ?? []).filter(Boolean),
      artisanat: m.peut_fabriquer
        ? { texte: m.artisanat_texte, test: m.test_brut ? espaces(m.test_brut) : null, caracteristiques: m.test_carac_1_id ? [m.test_carac_1_id, m.test_carac_2_id] : [] }
        : null,
      objets: (objets.get(m.id) ?? []).filter(Boolean),
      avantage: m.avantage_brut && m.avantage_brut.trim() !== '…' ? m.avantage_brut : null,
      remarque: m.remarque || null,
    }));
}

/**
 * Ce que les rendus des cellules (lib/edition-rendu.mjs) lisent dans la base, comme les listes du service en mode modification (serveur/edition.mjs#listes) :
 * les compétences (nom, caractéristique : couleur de la pastille), les caractéristiques, le glossaire des objets de départ.
 */
export const contexteDesMetiers = (db) => ({
  competences: db.prepare('SELECT id, nom, caracteristique_id, ordre FROM competence ORDER BY ordre').all().map((c) => ({ ...c })),
  caracteristiques: db.prepare('SELECT id, nom FROM caracteristique ORDER BY ordre').all().map((c) => ({ ...c })),
  objets: db.prepare('SELECT id, nom, nom_cle, description FROM objet_depart ORDER BY id').all().map((o) => ({ ...o })),
});
