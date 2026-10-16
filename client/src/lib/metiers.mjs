// Métiers : pas de page par métier (demande du propriétaire). /metiers/ est un long tableau (Nom, Bonus, Artisanat, Caractéristiques, Équipement
// supplémentaire), une ligne par métier de la table `metier`, à la manière des tableaux de sorts ; la description du métier (et son avantage possible)
// s'ouvre sous sa ligne. Bonus liés aux compétences et à l'initiative, artisanat en texte + deux caractéristiques, objets de départ : décisions R33 à R35.
// Les pages `metiers/<slug>` restent dans la base et dans les `.md` fabriqués (recherche, mots-clés, `[[liens]]`), mais tout lien vers un métier
// mène à sa ligne : /metiers/#metier-forgeron. « Règles des métiers », du même type mais sans ligne dans `metier`, garde sa page.
// Sans dépendance (sauf lib/guide.mjs et lib/equipement.mjs, purs eux aussi) : importé par wikilinks.mjs (au démarrage d'Astro), par wiki.ts et par les tests ; `chargerMetiers` reçoit la base ouverte par lib/donnees.mjs.
import { CHEMIN_DE_L_EQUIPEMENT, PAGES_SERVIES_PAR_L_EQUIPEMENT } from './equipement.mjs';
import { PREMIER_CHAPITRE } from './guide.mjs';

/** La seule page du type `metiers` qui n'est pas un métier (test/metiers.test.mjs vérifie que les autres sont exactement les lignes de `metier`). */
export const PAGE_DES_REGLES = 'metiers/regles-des-metiers';

/** Vrai si la page d'id donné est un métier : une ligne du tableau de /metiers/, sans page à elle. */
export const estUnMetier = (id) => id.startsWith('metiers/') && id !== PAGE_DES_REGLES;

/** Ancre HTML de la ligne d'un métier : « metier-forgeron » pour « metiers/forgeron ». */
export const ancreDeMetier = (id) => `metier-${id.slice(id.indexOf('/') + 1)}`;

/**
 * Pages servies par une autre, qui n'ont pas d'adresse à elles : les pages « Armes », « Armures », « Bouclier » et « Accessoires » sont les onglets
 * de la page « Équipement », « Bâton magique » le sous-onglet Bâtons magiques de son onglet Ceinture (demandes du propriétaire, 2026-10-16 ;
 * lib/equipement.mjs, components/equipement/EquipementPage.astro). Elles restent dans la base (recherche, [[liens]]).
 */
const PAGES_DANS_UNE_AUTRE = Object.freeze(Object.fromEntries(PAGES_SERVIES_PAR_L_EQUIPEMENT
  .map((o) => [o.page, Object.freeze({ chemin: CHEMIN_DE_L_EQUIPEMENT, ancre: o.ancre })])));

/** Vrai si la page d'id donné n'est pas construite : ses liens mènent à la page qui la sert (PAGES_DANS_UNE_AUTRE). */
export const pageSansAdresse = (id) => Object.hasOwn(PAGES_DANS_UNE_AUTRE, id);

/**
 * Adresse d'une page du wiki, relative à la racine du site : { chemin: '<id>/', ancre: '' } ; pour un métier, la ligne du tableau ; pour le premier
 * chapitre du guide, l'accueil de l'onglet Guide (lib/guide.mjs) ; pour une page servie par un onglet (ou un sous-onglet) de la page « Équipement »,
 * cet onglet.
 */
export function adresseDePage(id) {
  if (estUnMetier(id)) return { chemin: 'metiers/', ancre: ancreDeMetier(id) };
  if (pageSansAdresse(id)) return { ...PAGES_DANS_UNE_AUTRE[id] };
  return { chemin: id === PREMIER_CHAPITRE ? 'guide/' : `${id}/`, ancre: '' };
}

/** La même adresse en une chaîne : « races/elfe/ », « metiers/#metier-forgeron ». */
export function cheminDePage(id) {
  const { chemin, ancre } = adresseDePage(id);
  return ancre ? `${chemin}#${ancre}` : chemin;
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
