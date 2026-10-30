// Métiers : pas de page par métier (demande du propriétaire). /metiers/ est un long tableau (Nom, Bonus, Artisanat, Caractéristiques, Équipement
// supplémentaire), une ligne par métier de la table `metier`, à la manière des tableaux de sorts ; la description du métier (et son avantage possible)
// s'ouvre sous sa ligne. Bonus liés aux compétences et à l'initiative, artisanat en texte + deux caractéristiques, objets de départ : décisions R33 à R35.
// Les pages `metiers/<slug>` restent dans la base et dans les `.md` fabriqués (recherche, mots-clés, `[[liens]]`), mais tout lien vers un métier
// mène à sa ligne : /metiers/#metier-forgeron. « Règles des métiers », du même type mais sans ligne dans `metier`, garde sa page.
// Sans dépendance (sauf lib/livres.mjs et lib/equipement.mjs, purs eux aussi) : importé par wikilinks.mjs (au démarrage d'Astro), par wiki.ts et par les tests ; `chargerMetiers` reçoit la base ouverte par lib/donnees.mjs.
import { ADRESSES_DES_PAGES_SERVIES } from './equipement.mjs';
import { ACCUEIL_DU_GUIDE, ADRESSES_DU_PLAN_PRECEDENT, adresseDeLaPageAbsorbee, adresseDuGuide, PAGES_ABSORBEES } from './livres.mjs';

/** La seule page du type `metiers` qui n'est pas un métier (test/metiers.test.mjs vérifie que les autres sont exactement les lignes de `metier`). */
export const PAGE_DES_REGLES = 'metiers/regles-des-metiers';

/** Vrai si la page d'id donné est un métier : une ligne du tableau de /metiers/, sans page à elle. */
export const estUnMetier = (id) => id.startsWith('metiers/') && id !== PAGE_DES_REGLES;

/** Ancre HTML de la ligne d'un métier : « metier-forgeron » pour « metiers/forgeron ». */
export const ancreDeMetier = (id) => `metier-${id.slice(id.indexOf('/') + 1)}`;

/**
 * Pages servies par une page de l'équipement, que la route du wiki ne construit pas : les pages « Armes », « Armures », « Bouclier » et « Accessoires »
 * sont servies, à leur adresse, par leur page de l'équipement (src/pages/ressources/armes.astro…), « Bâton magique » par le sous-onglet Bâtons magiques
 * de la page Ceinture, « Pièces élémentaires » par sa section de la page Armes (demandes du propriétaire, 2026-10-16 et 2026-10-29 ;
 * lib/equipement.mjs#ADRESSES_DES_PAGES_SERVIES). Elles restent dans la base (recherche, [[liens]]).
 */
const PAGES_DANS_UNE_AUTRE = ADRESSES_DES_PAGES_SERVIES;

/** Vrai si la page d'id donné n'est pas construite par la route du wiki : ses liens mènent à la page qui la sert (PAGES_DANS_UNE_AUTRE). */
export const pageSansAdresse = (id) => Object.hasOwn(PAGES_DANS_UNE_AUTRE, id);

/**
 * Adresse d'une page du wiki, relative à la racine du site : { chemin: '<id>/', ancre: '' } ; pour un métier, la ligne du tableau ; pour une page du
 * guide, sa place dans le plan du site (lib/livres.mjs#adresseDuGuide : /decouvrir/…, /regles/…, /regles/avancees/…, /mj/… ; plus aucune sous /guide/) ;
 * pour une page servie par une page de l'équipement, cette page (à l'ancre de son sous-onglet ou de sa section).
 */
export function adresseDePage(id) {
  if (estUnMetier(id)) return { chemin: 'metiers/', ancre: ancreDeMetier(id) };
  if (pageSansAdresse(id)) return { ...PAGES_DANS_UNE_AUTRE[id] };
  if (id.startsWith('guide/')) return { chemin: adresseDuGuide(id), ancre: '' };
  return { chemin: `${id}/`, ancre: '' };
}

/** La même adresse en une chaîne : « races/elfe/ », « metiers/#metier-forgeron ». */
export function cheminDePage(id) {
  const { chemin, ancre } = adresseDePage(id);
  return ancre ? `${chemin}#${ancre}` : chemin;
}

/**
 * Vrai si la page est servie à `<id>/` par la route des pages du wiki (pages/[type]/[slug].astro) : ni un métier, ni une page servie par une autre
 * (pages de l'équipement, même à l'adresse de la page : « ressources/armes » est servie par src/pages/ressources/armes.astro), ni une page du guide
 * (servies par les routes de lib/livres.mjs).
 */
export const estServieASonId = (id) => !pageSansAdresse(id) && cheminDePage(id) === `${id}/`;

/**
 * Les renvois des anciennes adresses du guide vers les nouvelles, relatifs à la racine du site, pour les ids donnés (les pages chargées) :
 *   - avant l'éclatement du guide (2026-10-18) : { 'guide/': <adresse de Découvrir>, 'guide/<slug>/': cheminDePage(id)… } ;
 *   - une page fusionnée dans une autre (lib/livres.mjs#PAGES_ABSORBEES) : 'guide/<slug>/' et 'decouvrir/<slug>/' (son adresse du plan précédent) → la
 *     page qui l'absorbe, à l'ancre où se lit son contenu (lib/livres.mjs#adresseDeLaPageAbsorbee ; l'ancre de l'ancienne adresse l'emporte), si elle est chargée ;
 *   - une autre adresse du plan précédent (lib/livres.mjs#ADRESSES_DU_PLAN_PRECEDENT) → la page qui y était, si elle est chargée.
 * Lus par la page 404 (pages/404.astro les écrit au build, lib/nav.mjs#nouvelleAdresse les reçoit : nav.mjs n'importe rien), qui garde requête et ancre.
 */
export function renvoisDuGuide(ids) {
  const renvois = { 'guide/': ACCUEIL_DU_GUIDE };
  const charges = new Set(ids);
  for (const id of ids) if (id.startsWith('guide/')) renvois[`${id}/`] = cheminDePage(id);
  for (const [ancienne, nouvelle] of Object.entries(PAGES_ABSORBEES)) {
    if (!charges.has(nouvelle) || charges.has(ancienne)) continue;
    const slug = ancienne.slice('guide/'.length);
    renvois[`${ancienne}/`] = adresseDeLaPageAbsorbee(ancienne, cheminDePage);
    renvois[`decouvrir/${slug}/`] = adresseDeLaPageAbsorbee(ancienne, cheminDePage);
  }
  for (const [adresse, id] of Object.entries(ADRESSES_DU_PLAN_PRECEDENT)) if (charges.has(id) && cheminDePage(id) !== adresse) renvois[adresse] = cheminDePage(id);
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
 *   avantage   : null s'il est vide ou réduit à « … » (la source n'y donne aucun exemple).
 * Aucun texte n'est réécrit.
 */
export function chargerMetiers(db) {
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
      ancre: ancreDeMetier(m.id),
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
