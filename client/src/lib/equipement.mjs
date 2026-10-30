// Les cinq pages de l'équipement (rubrique Équipement du menu ; demande du propriétaire du 2026-10-29 : « Entre le nouvellement créé "Personnage" et
// "Espace Joueur" il faudra un nouveau menu : "Equipement" Dedans tu y déplacera les pages "Armes, Armures, Bouclier, Ceinture, Accessoire" en les
// sortant du sous-menu "Equipement" le remettant à nouveau dans un sous-menu dédié » ; à la question du sous-menu dédié : « Cinq pages séparées » ;
// libellés : « Comme les onglets (pluriel) ») : Armes, Armures, Boucliers, Ceinture, Accessoires, chacune une vraie page à son adresse. Avant, les cinq
// onglets d'une seule page « Équipement », /ressources/equipement/ (demandes du propriétaire, 2026-10-16 : « J'aimerai fusionner "Armes" et "Armures"
// dans un seule onglet : "Equipement" » ; « J'aimerai rajouter un 5 onglet pour y déplacer les accessoires » ; puis la page des objets à la ceinture
// devenue l'onglet « Ceinture », avec ses sous-onglets « Consommable / Carquois / Bâton magiques »).
// Identifiants figés : chaque page reprend l'adresse qu'avait sa page avant la page « Équipement » (ressources/armes/, ressources/armures/,
// ressources/bouclier/, ressources/accessoires/, et ressources/objets-a-la-ceinture/ pour la Ceinture). L'ancienne adresse /ressources/equipement/ (et
// ses ancres, sa requête) mène à la bonne page par la page 404 (RENVOIS_DE_L_ANCIENNE_EQUIPEMENT, lib/nav.mjs#adresseEclatee) ; la page « Pièces
// élémentaires », fusionnée dans Armes et Armures (réponse du propriétaire : « Fusionner dans Armes et Armures »), aussi.
// Les pages du wiki que ces pages servent (« Armes », « Armures », « Bouclier », « Accessoires », « Bâton magique » par le sous-onglet Bâtons magiques
// de la Ceinture, « Pièces élémentaires ») ne sont pas construites par la route du wiki (lib/metiers.mjs#pageSansAdresse) : leurs liens mènent à la page
// qui les sert (lib/metiers.mjs#adresseDePage). Elles restent dans la base (recherche, [[liens]], règles affichées par leur page ; les armes et armures
// élémentaires citent la page « Pièces élémentaires »).
// Sans dépendance : importé par lib/metiers.mjs (au démarrage d'Astro), lib/ceinture-db.mjs, lib/notes-de-version.mjs, les composants, les pages et les
// tests ; jamais par un script de page (lib/nav.mjs, que le script de la page 404 importe, n'importe rien : pages/404.astro lui passe les renvois).

/**
 * Les cinq pages, dans l'ordre du menu : `id` (l'id de leur `section.equipement-panneau` et de leur panneau de règles), `nom` (le libellé au menu et le
 * titre de la page), `chemin` (l'adresse de la page, relative à la racine du site) et `page` (la page du wiki qu'elle sert ; null pour la Ceinture,
 * qui n'en sert pas : ses sous-onglets, SOUS_ONGLETS_DE_LA_CEINTURE).
 */
export const PAGES_DE_L_EQUIPEMENT = Object.freeze([
  Object.freeze({ id: 'armes', nom: 'Armes', chemin: 'ressources/armes/', page: 'ressources/armes' }),
  Object.freeze({ id: 'armures', nom: 'Armures', chemin: 'ressources/armures/', page: 'ressources/armures' }),
  Object.freeze({ id: 'boucliers', nom: 'Boucliers', chemin: 'ressources/bouclier/', page: 'ressources/bouclier' }),
  Object.freeze({ id: 'ceinture', nom: 'Ceinture', chemin: 'ressources/objets-a-la-ceinture/', page: null }),
  Object.freeze({ id: 'accessoires', nom: 'Accessoires', chemin: 'ressources/accessoires/', page: 'ressources/accessoires' }),
]);

/** La page d'id donné (« armes », « ceinture »…). */
export const pageDeLEquipement = (id) => PAGES_DE_L_EQUIPEMENT.find((p) => p.id === id) ?? null;

/**
 * Les sous-onglets de la page Ceinture, dans l'ordre voulu (« Consommable / Carquois / Bâton magiques ») : `id` (l'ancre du sous-onglet et l'id
 * de son panneau, unique sur la page), `nom` et `page` (la page du wiki qu'il sert, ou null). Le sous-onglet des bâtons garde l'ancre de l'ancien
 * onglet « Bâtons magiques » (#batons-magiques).
 */
export const SOUS_ONGLETS_DE_LA_CEINTURE = Object.freeze([
  Object.freeze({ id: 'ceinture-consommables', nom: 'Consommables', page: null }),
  Object.freeze({ id: 'ceinture-carquois', nom: 'Carquois', page: null }),
  Object.freeze({ id: 'batons-magiques', nom: 'Bâtons magiques', page: 'ressources/baton-magique' }),
]);

/**
 * Les pages du wiki servies, chacune avec son panneau de règles : [{ page, ancre, chemin }] — `ancre` est l'id du panneau de règles (celui de la page,
 * ou du sous-onglet Bâtons magiques), `chemin` l'adresse de la page qui la sert. La page « Pièces élémentaires » n'en est pas (pas de panneau de
 * règles : PAGE_DES_PIECES_ELEMENTAIRES).
 */
export const PAGES_SERVIES_PAR_L_EQUIPEMENT = Object.freeze([
  ...PAGES_DE_L_EQUIPEMENT.filter((p) => p.page).map((p) => Object.freeze({ page: p.page, ancre: p.id, chemin: p.chemin })),
  ...SOUS_ONGLETS_DE_LA_CEINTURE.filter((o) => o.page)
    .map((o) => Object.freeze({ page: o.page, ancre: o.id, chemin: pageDeLEquipement('ceinture').chemin })),
]);

/**
 * La page « Pièces élémentaires » (onglet « Pièces élémentaires » du classeur « Ressources et Craft ») : fusionnée dans les pages Armes et Armures
 * (réponse du propriétaire du 2026-10-29 : « Fusionner dans Armes et Armures ») ; elle reste dans la base (les armes et armures élémentaires la citent,
 * la fiche s'en sert). Ses liens mènent à la section `ANCRE_DES_PIECES_ELEMENTAIRES` de la page Armes (lib/pieces-elementaires.mjs).
 */
export const PAGE_DES_PIECES_ELEMENTAIRES = 'ressources/pieces-elementaires';
export const ANCRE_DES_PIECES_ELEMENTAIRES = 'pieces-elementaires';

/**
 * L'adresse de chaque page du wiki servie par une page de l'équipement : { <id de page> : { chemin, ancre } } ; ancre vide pour une page servie
 * entière (« ressources/armes » → ressources/armes/), celle de son sous-onglet ou de sa section sinon (« ressources/baton-magique » →
 * ressources/objets-a-la-ceinture/#batons-magiques ; « ressources/pieces-elementaires » → ressources/armes/#pieces-elementaires).
 */
export const ADRESSES_DES_PAGES_SERVIES = Object.freeze(Object.fromEntries([
  ...PAGES_SERVIES_PAR_L_EQUIPEMENT.map((o) => [o.page, Object.freeze({ chemin: o.chemin, ancre: pageDeLEquipement(o.ancre) ? '' : o.ancre })]),
  [PAGE_DES_PIECES_ELEMENTAIRES, Object.freeze({ chemin: pageDeLEquipement('armes').chemin, ancre: ANCRE_DES_PIECES_ELEMENTAIRES })],
]));

/** L'ancienne page « Équipement » à cinq onglets (2026-10-16 au 2026-10-29) : plus construite, son adresse mène à l'une des cinq pages. */
export const ANCIENNE_PAGE_DE_L_EQUIPEMENT = 'ressources/equipement/';

/**
 * Les renvois des pages éclatées, lus par la page 404 (pages/404.astro les passe au script, lib/nav.mjs#adresseEclatee) et par le rendu des liens
 * Markdown écrits vers elles (lib/guide-rendu.ts) : { <ancienne adresse> : { ancres, anciennesAncres, parametres, defaut } }.
 *   - ancres : [début d'ancre, chemin] — l'ancre de l'adresse (un onglet, un élément d'un onglet) mène à la page dont un début est le plus long début
 *     de l'ancre ; l'ancre est gardée (« #famille-bombes » → ressources/armes/#famille-bombes) ;
 *   - anciennesAncres : { ancre : 'chemin#ancre' } — une ancre de l'ancienne page qui n'existe plus : remplacée ;
 *   - parametres : [nom, chemin] — sans ancre reconnue, le premier paramètre de la requête qui en est un (l'état d'une page : ?arme=, ?forme=…) ;
 *   - defaut : la page de tout le reste (l'ancien onglet ouvert au départ, Armes).
 * La requête est toujours gardée. Les débuts d'ancre sont ceux des ids des cinq pages construites (test/equipement-html.test.mjs : chaque id d'une page
 * mène à elle).
 */
const ARMES = pageDeLEquipement('armes').chemin;
const ARMURES = pageDeLEquipement('armures').chemin;
const BOUCLIERS = pageDeLEquipement('boucliers').chemin;
const CEINTURE = pageDeLEquipement('ceinture').chemin;
const ACCESSOIRES = pageDeLEquipement('accessoires').chemin;
export const RENVOIS_DES_PAGES_ECLATEES = Object.freeze({
  [ANCIENNE_PAGE_DE_L_EQUIPEMENT]: Object.freeze({
    ancres: Object.freeze([
      // Armes : le panneau, ses deux menus, les familles, les armes, les matériaux, les améliorations
      ['armes', ARMES], ['titre-armes', ARMES], ['regles-armes', ARMES], ['famille-', ARMES], ['onglet-famille-', ARMES], ['arme-', ARMES],
      ['materiau-', ARMES], ['materiaux-armes', ARMES], ['ameliorations-arme', ARMES], ['amelioration-', ARMES],
      // Armures : les matériaux, les armures, la liste, les améliorations (élémentaires comprises)
      ['armures', ARMURES], ['titre-armures', ARMURES], ['regles-armures', ARMURES], ['premier-materiau', ARMURES], ['second-materiau', ARMURES],
      ['armure-', ARMURES], ['liste-des-armures', ARMURES], ['ameliorations-armure', ARMURES],
      // Boucliers
      ['boucliers', BOUCLIERS], ['titre-boucliers', BOUCLIERS], ['regles-boucliers', BOUCLIERS], ['bouclier-', BOUCLIERS], ['formes-de-bouclier', BOUCLIERS],
      ['matieres-de-bouclier', BOUCLIERS], ['liste-des-boucliers', BOUCLIERS], ['poids-de-bouclier', BOUCLIERS], ['ameliorations-bouclier', BOUCLIERS],
      // Ceinture : ses sous-onglets, les familles des consommables, les potions, les carquois, les bâtons magiques
      ['ceinture', CEINTURE], ['titre-ceinture', CEINTURE], ['onglet-ceinture-', CEINTURE], ['onglet-batons-magiques', CEINTURE], ['onglet-objets-', CEINTURE],
      ['objets-', CEINTURE], ['titre-objets-', CEINTURE], ['potions-', CEINTURE], ['objet-', CEINTURE], ['batons-magiques', CEINTURE],
      ['titre-batons-magiques', CEINTURE], ['regles-batons-magiques', CEINTURE], ['baton-', CEINTURE], ['bulle-baton-', CEINTURE],
      // Accessoires : les étapes, les onglets d'effets, la monture
      ['accessoires', ACCESSOIRES], ['titre-accessoires', ACCESSOIRES], ['regles-accessoires', ACCESSOIRES], ['acc-', ACCESSOIRES], ['effets-', ACCESSOIRES],
      ['onglet-effets-', ACCESSOIRES], ['bulle-gemme-', ACCESSOIRES], ['bulle-remarque-', ACCESSOIRES],
    ].map((r) => Object.freeze(r))),
    // les anciens onglets de la page (« #armes », son lien « #onglet-armes ») : la page, sans ancre
    anciennesAncres: Object.freeze(Object.fromEntries(PAGES_DE_L_EQUIPEMENT.flatMap((p) => [[p.id, p.chemin], [`onglet-${p.id}`, p.chemin]]))),
    // l'état de chaque page dans l'adresse (src/scripts/armes.mjs, armures.mjs, accessoires.mjs : aucun paramètre en commun)
    parametres: Object.freeze([
      ['arme', ARMES], ['materiau', ARMES], ['amelioration', ARMES], ['competence', ARMES], ['depart', ARMES],
      ['armure', ARMURES], ['materiau1', ARMURES], ['materiau2', ARMURES], ['amelioration-armure', ARMURES], ['element-armure', ARMURES],
      ['poids-armure', ARMURES], ['amelioration-elementaire', ARMURES],
      ['forme', BOUCLIERS], ['matiere', BOUCLIERS], ['amelioration-bouclier', BOUCLIERS],
      ['emplacement', ACCESSOIRES], ['propriete', ACCESSOIRES], ['effet', ACCESSOIRES], ['acquis', ACCESSOIRES], ['monture', ACCESSOIRES],
      ['gemmes', ACCESSOIRES], ['maudit', ACCESSOIRES], ['detruit', ACCESSOIRES],
    ].map((r) => Object.freeze(r))),
    defaut: ARMES,
  }),
  // la page « Pièces élémentaires » (rendue depuis son Markdown jusqu'au 2026-10-29) : ses ancres étaient celles de ses titres ; ce qui touche les
  // armures mène à la page Armures, le reste à la section « Pièces élémentaires » de la page Armes
  [`${PAGE_DES_PIECES_ELEMENTAIRES}/`]: Object.freeze({
    ancres: Object.freeze([]),
    anciennesAncres: Object.freeze({
      // « ## Armes élémentaires » et ses tableaux par type d'arme : les armes élémentaires sont dans chaque tableau de la page Armes
      'armes-élémentaires': ARMES, 'épée': `${ARMES}#famille-epees`, 'dague': `${ARMES}#famille-dagues`, 'masse': `${ARMES}#famille-masse-marteau`,
      'hache': `${ARMES}#famille-hache`, 'arme-dhast': `${ARMES}#famille-lance-arme-dhast`, 'pugilat': `${ARMES}#famille-pugilat`,
      'bâton-de-combat': `${ARMES}#famille-baton-de-combat`, 'arc': `${ARMES}#famille-arc`, 'arbalète': `${ARMES}#famille-arbalete`,
      'arme-de-jet': `${ARMES}#famille-arme-de-jet`, 'bombe': `${ARMES}#famille-bombes`,
      // « ## AMÉLIORATION » : « ### Armes » (fondu dans les améliorations des armes, décision R167) et « ### Armure »
      'amélioration': `${ARMES}#ameliorations-arme`, 'armes': `${ARMES}#ameliorations-arme`, 'armure': `${ARMURES}#ameliorations-armure-elementaire`,
      // « ## Vêtement et armures élémentaires » : le choix « Armure élémentaire » de la page Armures (décision R165)
      'vêtement-et-armures-élémentaires': `${ARMURES}#${ANCRE_DES_PIECES_ELEMENTAIRES}`, 'vêtement': `${ARMURES}#${ANCRE_DES_PIECES_ELEMENTAIRES}`,
      'armure-légère': `${ARMURES}#${ANCRE_DES_PIECES_ELEMENTAIRES}`, 'armure-intermédiaire': `${ARMURES}#${ANCRE_DES_PIECES_ELEMENTAIRES}`,
      'armure-lourde': `${ARMURES}#${ANCRE_DES_PIECES_ELEMENTAIRES}`,
    }),
    parametres: Object.freeze([]),
    defaut: `${ARMES}#${ANCRE_DES_PIECES_ELEMENTAIRES}`,
  }),
});
