// Modèle de l'édition depuis le site de dev (demande du propriétaire ; client/serveur/edition.mjs, docs/serveur.md, « Édition ») : quelles colonnes de
// quelles tables une page peut modifier, avec leur type de champ, et comment une page désigne un champ (attribut `data-ed`). Le service n'accepte
// que ces colonnes ; tout ce qui en dépend dans la base (colonnes typées, tables de détail, page du wiki) est recalculé par le service, jamais saisi.
// Entités créables (ENTITES) : métier, race, classe, peuple, spécialité, don de classe, espèce et carte de monstre, arme, composant, gemme, bois, ingrédient, monnaie ;
// supprimables : métier, spécialité, don de classe, arme (retirés des fiches de personnage qui les ont, avec une note datée : décisions R42, R52,
// annonceDesFiches), espèce et carte de monstre, composant, gemme, bois, ingrédient et monnaie (s'ils ne sont cités par aucune autre règle).
// Fonctions et constantes pures, sans dépendance (sauf lib/dons-edition.mjs, lib/portrait.mjs et lib/arme-champs.mjs, purs eux aussi) : partagées par le
// service, les gabarits Astro et le script des pages (src/scripts/edition.mjs).
import { NIVEAUX_DE_DON, TYPES_DE_DON_SAISIE } from './dons-edition.mjs';
import { dimensionsDuPortrait, empreinte, estUnPortrait, PORTRAIT_MAX, resumeDuPortrait } from './portrait.mjs';
import { ECRITURES_DE_COMPETENCE, MAINS } from './arme-champs.mjs';

export { NIVEAUX_DE_DON, NIVEAU_DES_SPECIALITES, SPECIALITES_MAX, TYPES_DE_DON_SAISIE } from './dons-edition.mjs';

/**
 * Types de champ :
 *   ligne    texte sur une ligne (retours à la ligne remplacés par une espace) ;
 *   texte    texte long : paragraphes séparés par une ligne vide, puces « - », retours à la ligne gardés (lib/sort-format.mjs#blocsDeTexte) ;
 *   markdown corps Markdown d'une page (guide) ;
 *   entier   nombre entier (signe permis) ;
 *   choix    une valeur d'une liste : `choix` ([{ valeur, libelle }], contrôlée ici) ou `liste` (nom d'une liste de GET /api/edition/listes/, lue dans
 *            la base vivante et contrôlée par le service) ;
 *   reel     nombre (décimales permises) ;
 *   image    une image en data URL (WebP, JPEG ou PNG, PORTRAIT_MAX caractères au plus, base64 complet et en-tête lisible : lib/portrait.mjs) ;
 *            jamais une saisie de l'éditeur commun (une extension la choisit et la recadre : src/scripts/edition/bestiaire.mjs) ; les réponses de
 *            l'édition (lignes lues, en attente, d'un lot, d'un conflit) n'en donnent que l'empreinte (ligneSansImage), l'image entière passe par
 *            POST /api/edition/portrait/ — le journal exporté et le lot figé de la mise à jour la portent en entier (rejouée sur data/rows).
 * Options : `requis` (vide refusé), `vide` (valeur enregistrée pour un champ vidé quand la colonne n'accepte pas NULL : '' ou 'Rien'),
 * `min` / `max` (entier, réel).
 */
/** Catégories d'un monstre (colonne `monstre.categorie`) : les libellés de lib/monstre-champs.mjs#CATEGORIES (test/serveur-edition-bestiaire.test.mjs). */
export const CATEGORIES_DE_MONSTRE = [
  { valeur: 'ennemi_simple', libelle: 'Ennemi simple' },
  { valeur: 'mini_boss', libelle: 'Mini-boss' },
  { valeur: 'boss', libelle: 'Boss' },
];
/**
 * Le portrait d'une carte de monstre ou d'une espèce (demande du propriétaire : « enregistrer le portrait de la même manière que dans la feuille de
 * personnage », migration 0033) : l'image et son cadrage, comme personnage.portrait (lib/portrait.mjs).
 */
const COLONNES_DU_PORTRAIT = {
  portrait: { type: 'image', libelle: 'Portrait', max: PORTRAIT_MAX },
  portrait_x: { type: 'reel', libelle: 'Cadrage du portrait (horizontal)', min: 0, max: 1 },
  portrait_y: { type: 'reel', libelle: 'Cadrage du portrait (vertical)', min: 0, max: 1 },
  portrait_zoom: { type: 'reel', libelle: 'Zoom du portrait', min: 1, max: 4 },
};
/** `monstre.variable` : la carte dit « Ses stats varient selon son échelle de puissance. » (1) ou non (0). */
export const STATS_VARIABLES = [
  { valeur: '0', libelle: 'Non' },
  { valeur: '1', libelle: 'Oui : « Ses stats varient selon son échelle de puissance. »' },
];

/** Une case Oui / Non (colonne entière 0 ou 1 : arme.depart_possible). */
export const OUI_NON = [
  { valeur: '0', libelle: 'Non' },
  { valeur: '1', libelle: 'Oui' },
];

/**
 * Les tableaux de la page « Composants » où un composant peut être créé (champ « Tableau » du formulaire) : les matériaux, puis ceux de l'onglet
 * « Équipement inventaire » (genre:section de la ressource : lib/corps-composants.mjs#SECTIONS_DE_L_INVENTAIRE).
 */
export const TABLEAUX_DE_COMPOSANTS = [
  { valeur: 'materiau', libelle: 'Matériaux' },
  { valeur: 'produit:VÉGÉTAUX', libelle: 'Produits non monétaires › Végétaux' },
  { valeur: 'produit:ANIMAUX', libelle: 'Produits non monétaires › Animaux' },
  { valeur: 'produit:AUTRES', libelle: 'Produits non monétaires › Autres' },
  { valeur: 'materiel:MATOS AVENTURES', libelle: 'Matos aventures' },
  { valeur: 'materiel:MATOS FABRICATION', libelle: 'Matos fabrication' },
  { valeur: 'materiel:MATOS PROJECTILE', libelle: 'Matos projectile' },
];

/** Catégories d'un ingrédient d'alchimie (ingredient_alchimie.categorie), dans l'ordre de la recette (lib/corps-composants.mjs#CATEGORIES_D_INGREDIENTS). */
export const CATEGORIES_D_INGREDIENTS = [
  { valeur: 'solvant', libelle: 'Solvant' },
  { valeur: 'essence', libelle: 'Essence' },
  { valeur: 'amplificateur', libelle: 'Amplificateur' },
  { valeur: 'catalyseur', libelle: 'Catalyseur' },
  { valeur: 'stabilisateur', libelle: 'Stabilisateur' },
];

export const TABLES = {
  metier: {
    libelle: 'Métier',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      description: { type: 'texte', libelle: 'Description', vide: '' },
      // bonus : « +3% Esquive, +2% Parade OU Esquive » ; un nom de compétence la lie (son Acquis), « +N INI » l'initiative (décision R33)
      bonus_brut: { type: 'ligne', libelle: 'Bonus', vide: '' },
      // artisanat (décision R34) : un texte libre et deux caractéristiques (vide : rien à fabriquer) ; « Artisanat possible » en est recalculé
      artisanat_texte: { type: 'ligne', libelle: 'Artisanat' },
      test_carac_1_id: { type: 'choix', libelle: 'Caractéristique d’artisanat 1', liste: 'caracteristiquesDArtisanat' },
      test_carac_2_id: { type: 'choix', libelle: 'Caractéristique d’artisanat 2', liste: 'caracteristiquesDArtisanat' },
      // objets de départ (décision R35) : « , » entre deux objets, « OU » entre les options d'un choix
      equipement_brut: { type: 'ligne', libelle: 'Équipement supplémentaire', vide: 'Rien' },
      avantage_brut: { type: 'texte', libelle: 'Avantage possible' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  // Magies : présentation, description, explication (la table des relations entre magies ne se modifie pas : demande du propriétaire)
  magie: {
    libelle: 'Magie',
    colonnes: {
      banniere: { type: 'texte', libelle: 'Bannière' },
      description: { type: 'texte', libelle: 'Présentation' },
      description_physique: { type: 'texte', libelle: 'Description physique' },
      explication: { type: 'texte', libelle: 'Explication' },
      sante_offerte: { type: 'entier', libelle: 'Santé offerte', min: 0 },
      chakra_offert: { type: 'entier', libelle: 'Chakra offert', min: 0 },
      caracteristique_brut: { type: 'ligne', libelle: 'Caractéristique bonus' },
      barre4_texte: { type: 'texte', libelle: '4ème barre' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  magie_role: {
    libelle: 'Rôle de magie',
    colonnes: { role_brut: { type: 'ligne', libelle: 'Rôle', requis: true } },
  },
  mode_hyper_effet: {
    libelle: 'Capacité Mode Hyper',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom de la capacité' },
      effet: { type: 'texte', libelle: 'Effet', requis: true },
    },
  },
  // Races : la phrase de présentation, tout l'onglet de la race (textes, valeurs de départ, dons, tableau en panneaux, mode Hyper) ;
  // les magies innées et les relations entre peuples ont leurs opérations (`magies_innees`, `relations`)
  race: {
    libelle: 'Race',
    colonnes: { presentation: { type: 'texte', libelle: 'Présentation' } },
  },
  race_onglet: {
    libelle: 'Onglet de la race',
    colonnes: {
      description_generale: { type: 'texte', libelle: 'Présentation générale', requis: true },
      histoire: { type: 'texte', libelle: 'Histoire', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      sante_depart: { type: 'entier', libelle: 'Santé de départ', requis: true },
      chakra_depart: { type: 'entier', libelle: 'Chakra de départ', requis: true },
      barriere_bonus: { type: 'entier', libelle: 'Barrière bonus', requis: true },
      vitesse_sol: { type: 'entier', libelle: 'Vitesse au sol', requis: true },
      vitesse_nage: { type: 'entier', libelle: 'Vitesse de nage', requis: true },
      avantages: { type: 'texte', libelle: 'Avantages', requis: true },
      inconvenients: { type: 'texte', libelle: 'Inconvénients', requis: true },
      don_base: { type: 'texte', libelle: 'Don de base', requis: true },
      dons_tableau_titre: { type: 'ligne', libelle: 'Titre du tableau des dons' },
    },
  },
  race_don: {
    libelle: 'Don racial',
    colonnes: {
      etiquette: { type: 'ligne', libelle: 'Ethnie' },
      nom: { type: 'ligne', libelle: 'Nom du don' },
      texte: { type: 'texte', libelle: 'Don', requis: true },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  race_don_tableau_colonne: {
    libelle: 'En-tête du tableau des dons',
    colonnes: { libelle: { type: 'ligne', libelle: 'En-tête', requis: true } },
  },
  race_don_tableau_cellule: {
    libelle: 'Case du tableau des dons',
    colonnes: { valeur: { type: 'texte', libelle: 'Case', requis: true } },
  },
  // Classes : bandeau (don de départ), présentation, chose à savoir, équipement de départ ; spécialités ; dons (« capacités »)
  classe: {
    libelle: 'Classe',
    colonnes: {
      sante_depart: { type: 'entier', libelle: 'Santé de départ', requis: true, min: 0 },
      chakra_depart: { type: 'entier', libelle: 'Chakra de départ', requis: true, min: 0 },
      barriere_depart: { type: 'entier', libelle: 'Barrière de départ', requis: true, min: 0 },
      description: { type: 'texte', libelle: 'Présentation' },
      chose_a_savoir: { type: 'texte', libelle: 'Chose à savoir' },
      maitrise_arme: { type: 'texte', libelle: 'Maîtrise des armes (une ligne « - » par maîtrise)' },
      maitrise_armure: { type: 'texte', libelle: 'Maîtrise des armures (une ligne « - » par maîtrise)' },
      arme_depart: { type: 'ligne', libelle: 'Arme de départ' },
      armure_depart: { type: 'ligne', libelle: 'Armure de départ' },
      inventaire_depart: { type: 'ligne', libelle: 'Inventaire de départ (objets séparés par « , », « A OU B »)' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  specialite: {
    libelle: 'Spécialité',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  capacite: {
    libelle: 'Don de classe',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      type_brut: { type: 'ligne', libelle: 'Type (« Actif (1 fois/combat) »)' },
      effet: { type: 'texte', libelle: 'Effet' },
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  // Sorts : chaque case du tableau et du détail (une ligne peut avoir un effet dû aux NM dans plusieurs colonnes)
  sort: {
    libelle: 'Sort',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      type_brut: { type: 'ligne', libelle: 'Type', requis: true },
      cout_brut: { type: 'ligne', libelle: 'Coût', requis: true },
      portee_brut: { type: 'ligne', libelle: 'Portée', requis: true },
      zone_brut: { type: 'ligne', libelle: 'Zone', requis: true },
      dsb_brut: { type: 'ligne', libelle: 'D/S/B' },
      effets: { type: 'texte', libelle: 'Effets secondaires' },
      remarque: { type: 'texte', libelle: 'Remarque' },
      texte_niveau5: { type: 'texte', libelle: 'Texte du sort (niveau 5)' },
    },
  },
  // Bestiaire (/bestiaire/, components/bestiaire/ ; demande du propriétaire : créer, modifier, supprimer un monstre) : une espèce, une carte de monstre,
  // le texte de chaque rubrique d'une carte (les valeurs typées en sont tirées par le service : lib/monstre-champs.mjs#valeursDeLaCarte), les blocs et le
  // butin d'une espèce. Les échelles s'écrivent comme dans le doc (« EP2 », « EP1 - 10 » pour une espèce, « 2 », « 1-10 » pour une carte).
  monstre_espece: {
    libelle: 'Espèce de monstre',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom de l’espèce', requis: true },
      ep_brut: { type: 'ligne', libelle: 'Échelle(s) de puissance de l’espèce (« EP2 », « EP1 - 10 »)', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      lieu_brut: { type: 'ligne', libelle: 'Lieu de rencontre (lieux séparés par des virgules)' },
      complement: { type: 'texte', libelle: 'Complément (après le lieu de rencontre)' },
      ...COLONNES_DU_PORTRAIT,
    },
  },
  monstre: {
    libelle: 'Monstre',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom du monstre', requis: true },
      echelle_brut: { type: 'ligne', libelle: 'Échelle de puissance (« 2 », « 1-10 »)', requis: true },
      categorie: { type: 'choix', libelle: 'Catégorie', requis: true, choix: CATEGORIES_DE_MONSTRE },
      type_brut: { type: 'ligne', libelle: 'Type (« Vermine », « Non-mort »)' },
      alignement_brut: { type: 'ligne', libelle: 'Alignement' },
      variable: { type: 'choix', libelle: 'Stats selon l’échelle de puissance', requis: true, choix: STATS_VARIABLES },
      ...COLONNES_DU_PORTRAIT,
    },
  },
  monstre_rubrique: {
    libelle: 'Rubrique de la carte',
    colonnes: {
      texte: { type: 'texte', libelle: 'Texte de la rubrique', vide: '' },
    },
  },
  monstre_espece_bloc: {
    libelle: 'Bloc de l’espèce',
    colonnes: {
      texte: { type: 'texte', libelle: 'Texte du bloc', vide: '' },
    },
  },
  monstre_butin: {
    libelle: 'Butin',
    colonnes: {
      texte: { type: 'ligne', libelle: 'Butin possible', requis: true },
    },
  },
  // Armes (/ressources/armes/, demande du propriétaire : « tout peut être éditable à l'instar des autres pages ») : les cellules de l'onglet « Armes » ;
  // le service en tire les colonnes typées (dé, bonus, portée, solidité, provenance…), les types de dégâts et les minimums de caractéristique
  // (lib/arme-champs.mjs), et suit le corps de la page (lib/corps-armes.mjs). Pas les armes de monstres (absentes de la page).
  arme: {
    libelle: 'Arme',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      mains: { type: 'choix', libelle: 'Mains', choix: MAINS },
      competence_brut: { type: 'choix', libelle: 'Compétence', requis: true, choix: ECRITURES_DE_COMPETENCE.map((c) => ({ valeur: c, libelle: c })) },
      type_id: { type: 'choix', libelle: 'Type d’arme', requis: true, liste: 'typesDArmes' },
      cout_brut: { type: 'ligne', libelle: 'Coût (« 10 Ro »)' },
      effet: { type: 'texte', libelle: 'Effet (dégâts, portée, solidité, origine… : les colonnes en sont tirées)' },
      description: { type: 'texte', libelle: 'Description' },
      depart_possible: { type: 'choix', libelle: 'Arme de départ', requis: true, choix: OUI_NON },
    },
  },
  // Composants (/ressources/composants/, demande du propriétaire, 2026-10-14 : « chaque élément est modifiable en édition, supprimable, ajoutable ») :
  // une ressource du catalogue — matériau, bois, ingrédient d'alchimie (son nom est aussi celui des armes, des armures et des boucliers : « comme c'est le même pour armure et
  // bouclier, ça le changera aussi »), gemme (nom, description ; ses prix : table gemme), objet de l'onglet « Équipement inventaire » ; le service
  // refuse les autres ressources (alchimie, livres…) et recalcule le prix en RF (lib/composants-champs.mjs)
  ressource: {
    libelle: 'Composant',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom (le même partout où il est écrit : armes, armures, boucliers…)', requis: true },
      prix_brut: { type: 'ligne', libelle: 'Prix (« 2 RO », « 100 RF / 1 RO »)' },
      description: { type: 'texte', libelle: 'Description' },
    },
  },
  // les prix d'une gemme : la gemme entière (onglet Bâton magique) et le quart de gemme (onglet Accessoires), par qualité
  gemme: {
    libelle: 'Gemme',
    colonnes: {
      prix_commune_brut: { type: 'ligne', libelle: 'Prix de la gemme commune (« 50 RO »)' },
      prix_raffinee_brut: { type: 'ligne', libelle: 'Prix de la gemme raffinée' },
      prix_parfaite_brut: { type: 'ligne', libelle: 'Prix de la gemme parfaite' },
      quart_commune_brut: { type: 'ligne', libelle: 'Prix du quart de gemme commune (« 12 Ro »)' },
      quart_raffinee_brut: { type: 'ligne', libelle: 'Prix du quart de gemme raffinée' },
      quart_parfaite_brut: { type: 'ligne', libelle: 'Prix du quart de gemme parfaite' },
    },
  },
  // un ingrédient d'alchimie (Google Doc « Alchimie » › Liste d'ingrédients) : son type (« Fruit (majeur) » : un amplificateur majeur) et son affinité
  // (« Santé + Chakra ») ; le service en tire le type sans « (majeur) », la marque majeur et l'affinité (créée si elle est nouvelle)
  ingredient_alchimie: {
    libelle: 'Ingrédient d’alchimie',
    colonnes: {
      type_brut: { type: 'ligne', libelle: 'Type (« Fruit », « Fruit (majeur) » pour un amplificateur majeur)', requis: true },
      affinite_brut: { type: 'ligne', libelle: 'Affinité (« Santé », « Santé + Chakra »)', requis: true },
    },
  },
  // les monnaies (MONNAIE et CONVERTISSEUR de l'onglet) : la ligne du convertisseur est tirée de la valeur en RF ; l'unité (le RF) vaut 1
  monnaie: {
    libelle: 'Monnaie',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      abreviation: { type: 'ligne', libelle: 'Abréviation', requis: true },
      valeur_rf: { type: 'entier', libelle: 'Valeur en RF', requis: true, min: 1 },
    },
  },
  // matériaux d'arme (tableau MATERIAUX de l'onglet) : prix et effets
  materiau_arme: {
    libelle: 'Matériau d’arme',
    colonnes: {
      prix_brut: { type: 'ligne', libelle: 'Prix (« 200 RO »)', requis: true },
      effet_brut: { type: 'texte', libelle: 'Effets (« Dégâts +N pour l’arme », « ±N cran de solidité », puis les autres effets)', requis: true },
    },
  },
  // améliorations d'arme (+1 à +10) : coût et effet ; les améliorations d'armure, de bouclier et des pièces élémentaires ne se modifient pas ici
  amelioration_equipement: {
    libelle: 'Amélioration d’arme',
    colonnes: {
      cout_brut: { type: 'ligne', libelle: 'Coût (« 1 Matériel + 50 RO »)', requis: true },
      effet_brut: { type: 'ligne', libelle: 'Effet (« +10 dégâts, +1 cran de solidité »)', requis: true },
    },
  },
  // Pages du guide et du Codex (texteDePageModifiable) : titre et texte (Markdown réécrit par l'éditeur visuel, lib/markdown-edition.mjs) ; le service
  // refuse toute autre page (celles des races, magies, classes et métiers suivent leurs tables)
  page: {
    libelle: 'Page',
    colonnes: {
      titre: { type: 'ligne', libelle: 'Titre', requis: true },
      corps_md: { type: 'markdown', libelle: 'Texte', requis: true },
    },
  },
};

/** Première source des pages du Codex (tools/docs/codex.py, docs/codex.md). */
export const SOURCE_DU_CODEX = 'Google Doc « CODEX Maverick »';
/**
 * Une page dont le titre et le texte se modifient (lignes `page` de TABLES) : une page du guide, ou une page du Codex (demande du propriétaire :
 * « Exactement comme pour les pages des règles les pages du codex doivent pouvoir être modifiées aussi ») = type `lore` tiré du Google Doc « CODEX
 * Maverick » (première source) ; pas la description des relations entre les peuples (lore aussi, mais tirée du classeur des races). Les autres pages
 * suivent leurs tables.
 */
export const texteDePageModifiable = (type, premiereSource) => type === 'guide' || (type === 'lore' && premiereSource === SOURCE_DU_CODEX);

/**
 * Entités qu'une page peut créer ou supprimer (`suppression`), avec les champs demandés à la création (`champs`, même format que les colonnes de
 * TABLES ; ce qui n'est pas demandé prend sa valeur « vide » ou une valeur de départ visible, « À compléter. ») ; `nouveau` : le titre du formulaire
 * et des messages (« Nouvelle spécialité »), par défaut « Nouveau <libellé> ».
 */
const champsDe = (table, colonnes) => Object.fromEntries(colonnes.map((c) => [c, TABLES[table].colonnes[c]]));
/** Nature d'une race (demande du propriétaire : une race hybride peut être créée avant sa classe raciale ; lib/race-kinds.mjs). */
export const NATURES_DE_RACE = [
  { valeur: 'pure', libelle: 'Race pure' },
  { valeur: 'hybride', libelle: 'Race hybride (elle aura sa classe raciale)' },
];
/** Le mot-clé d'une race hybride créée depuis le site : il la range parmi les hybrides tant qu'elle n'a pas sa classe raciale. */
export const MOT_CLE_RACE_HYBRIDE = 'race hybride';

export const ENTITES = {
  metier: {
    table: 'metier',
    libelle: 'métier',
    champs: champsDe('metier', ['nom', 'description', 'bonus_brut', 'artisanat_texte', 'test_carac_1_id', 'test_carac_2_id', 'equipement_brut', 'avantage_brut']),
    suppression: true,
  },
  race: {
    table: 'race',
    libelle: 'race',
    champs: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      nature: { type: 'choix', libelle: 'Nature', requis: true, choix: NATURES_DE_RACE },
      presentation: { type: 'texte', libelle: 'Présentation (une phrase)' },
    },
  },
  // une classe parmi les catégories du Sommaire ; une classe raciale (« Classe Hybride Animal ») porte le nom de sa race, une race hybride qui n'en a pas
  classe: {
    table: 'classe',
    libelle: 'classe',
    champs: {
      categorie_id: { type: 'choix', libelle: 'Catégorie', requis: true, liste: 'categories' },
      nom: { type: 'ligne', libelle: 'Nom (une classe raciale prend celui de sa race)' },
      race_id: { type: 'choix', libelle: 'Race hybride (classe raciale seulement)', liste: 'racesSansClasse' },
      sante_depart: { type: 'entier', libelle: 'Santé de départ', min: 0 },
      chakra_depart: { type: 'entier', libelle: 'Chakra de départ', min: 0 },
      barriere_depart: { type: 'entier', libelle: 'Barrière de départ', min: 0 },
    },
  },
  // un peuple de la matrice « Relation entre les races » (une race sans peuple n'a pas de relations : Anansi, Farfadet, Goleois)
  peuple: {
    table: 'peuple',
    libelle: 'peuple',
    champs: {
      nom: { type: 'ligne', libelle: 'Nom du peuple', requis: true },
      race_id: { type: 'ligne', libelle: 'Race', requis: true },
    },
  },
  // Bestiaire : une espèce (une ligne du tableau tant qu'elle n'a pas de carte), une carte de monstre dans une espèce, créée avec les rubriques vides de
  // la disposition la plus courante du doc (lib/monstre-champs.mjs#GABARIT_DE_CARTE). Identifiants tirés du nom une fois, puis figés et jamais
  // réutilisés ; une espèce ne se supprime qu'une fois ses cartes supprimées. Aucune fiche de personnage ne cite un monstre (pas de R42).
  monstre_espece: {
    table: 'monstre_espece',
    libelle: 'espèce',
    nouveau: 'Nouvelle espèce',
    suppression: true,
    champs: champsDe('monstre_espece', ['nom', 'ep_brut', 'description', 'lieu_brut']),
  },
  monstre: {
    table: 'monstre',
    libelle: 'monstre',
    suppression: true,
    champs: {
      espece_id: { type: 'choix', libelle: 'Espèce', requis: true, liste: 'especesDeMonstres' },
      ...champsDe('monstre', ['nom', 'echelle_brut', 'categorie', 'type_brut', 'alignement_brut']),
    },
  },
  // une arme dans une famille de la page des armes (demande du propriétaire : « Fais donc la possibilité de créer / supprimer des armes ») ; supprimée,
  // elle est retirée des fiches de personnage qui l'ont, avec une note datée (décision R52, comme R42)
  arme: {
    table: 'arme',
    libelle: 'arme',
    nouveau: 'Nouvelle arme',
    suppression: true,
    champs: {
      famille_id: { type: 'choix', libelle: 'Famille (le tableau où l’arme s’ajoute)', requis: true, liste: 'famillesDArmes' },
      ...champsDe('arme', ['nom', 'mains', 'competence_brut', 'type_id', 'cout_brut', 'effet', 'description', 'depart_possible']),
    },
  },
  // Composants : un composant dans un tableau de la page (les matériaux, ou un tableau de l'onglet « Équipement inventaire »), une gemme ou un bois liés à
  // une magie qui n'en a pas, un ingrédient d'alchimie, une monnaie ; supprimés seulement s'ils ne sont cités par aucune autre règle (le service le dit : armure, recette, accessoire…), un
  // objet d'une fiche de personnage restant dans la fiche sous son nom (serveur/fiches-retraits.mjs#OBJETS_AU_CATALOGUE)
  composant: {
    table: 'ressource',
    libelle: 'composant',
    suppression: true,
    champs: {
      tableau: { type: 'choix', libelle: 'Tableau (où le composant s’ajoute)', requis: true, choix: TABLEAUX_DE_COMPOSANTS },
      ...champsDe('ressource', ['nom', 'prix_brut', 'description']),
    },
  },
  gemme: {
    table: 'gemme',
    libelle: 'gemme',
    nouveau: 'Nouvelle gemme',
    suppression: true,
    champs: {
      magie_id: { type: 'choix', libelle: 'Magie (une gemme par magie)', requis: true, liste: 'magiesSansGemme' },
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      ...champsDe('gemme', ['prix_commune_brut', 'prix_raffinee_brut', 'prix_parfaite_brut', 'quart_commune_brut', 'quart_raffinee_brut', 'quart_parfaite_brut']),
    },
  },
  // un ingrédient d'alchimie dans le tableau de sa catégorie (un fruit va dans le tableau des fruits par son type)
  ingredient: {
    table: 'ingredient_alchimie',
    libelle: 'ingrédient',
    nouveau: 'Nouvel ingrédient',
    suppression: true,
    champs: {
      categorie: { type: 'choix', libelle: 'Catégorie', requis: true, choix: CATEGORIES_D_INGREDIENTS },
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      ...champsDe('ingredient_alchimie', ['type_brut', 'affinite_brut']),
    },
  },
  // un bois de bâton magique, lié à une magie qui n'en a pas (« un par magie »)
  bois: {
    table: 'bois',
    libelle: 'bois',
    suppression: true,
    champs: {
      magie_id: { type: 'choix', libelle: 'Magie (un bois par magie)', requis: true, liste: 'magiesSansBois' },
      ...champsDe('ressource', ['nom', 'prix_brut', 'description']),
    },
  },
  monnaie: {
    table: 'monnaie',
    libelle: 'monnaie',
    nouveau: 'Nouvelle monnaie',
    suppression: true,
    champs: {
      ...champsDe('monnaie', ['nom', 'abreviation']),
      valeur_rf: { type: 'entier', libelle: 'Valeur en RF', requis: true, min: 2 },
    },
  },
  // une spécialité d'une classe (D11) : créée avec son don de spécialité du niveau 10 (sans lui elle n'aurait ni colonne ni bannière) ; supprimée avec tous
  // ses dons. `classe_id` est donné par le bouton de la page, contrôlé par le service.
  specialite: {
    table: 'specialite',
    libelle: 'spécialité',
    nouveau: 'Nouvelle spécialité',
    suppression: true,
    champs: {
      classe_id: { type: 'ligne', libelle: 'Classe', requis: true },
      nom: { type: 'ligne', libelle: 'Nom de la spécialité', requis: true },
      description: { type: 'texte', libelle: 'Description' },
      don_nom: { type: 'ligne', libelle: 'Nom du don de spécialité (niveau 10)', requis: true },
      don_type: { type: 'choix', libelle: 'Type du don de spécialité', requis: true, choix: TYPES_DE_DON_SAISIE },
      don_precision: { type: 'ligne', libelle: 'Précision du type (« 2 fois/combat »)' },
      don_effet: { type: 'texte', libelle: 'Effet du don de spécialité', aide: 's’il dit « considérer comme classe magique », la spécialité donne +4 AM (R7)' },
    },
  },
  // un don de classe (« capacité », D11) : sa place vient du bouton (classe, spécialité, ou le don `avec` dont il devient une option : même ligne, même
  // niveau, même spécialité) ; sans `avec`, une nouvelle ligne à la fin de son niveau (lib/dons-edition.mjs#placeNouvelleLigne). `specialite_id` et
  // `avec` acceptent « @i » : la spécialité ou le don créé par l'opération i du même lot.
  capacite: {
    table: 'capacite',
    libelle: 'don',
    nouveau: 'Nouveau don',
    suppression: true,
    champs: {
      classe_id: { type: 'ligne', libelle: 'Classe', requis: true },
      specialite_id: { type: 'ligne', libelle: 'Spécialité (vide : hors spécialité)' },
      avec: { type: 'ligne', libelle: 'Au choix avec (vide : une nouvelle ligne)' },
      niveau: { type: 'choix', libelle: 'Niveau de classe', choix: NIVEAUX_DE_DON.map((n) => ({ valeur: String(n), libelle: `Niveau ${n}` })) },
      nom: { type: 'ligne', libelle: 'Nom du don', requis: true },
      type: { type: 'choix', libelle: 'Type', requis: true, choix: TYPES_DE_DON_SAISIE },
      precision: { type: 'ligne', libelle: 'Précision du type (« 2 fois/combat »)' },
      effet: { type: 'texte', libelle: 'Effet' },
    },
  },
};

export class ErreurValeur extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurValeur';
  }
}

/**
 * Valeur saisie → valeur enregistrée, d'après le type du champ ; lève ErreurValeur (message en français) si elle est refusée.
 * Texte : fins de ligne unifiées, espaces de bord retirées ; un champ vidé vaut `vide` s'il est défini, sinon NULL (absent = NULL).
 */
export function valeurDuChamp(champ, brute, nom = champ.libelle) {
  if (champ.type === 'image') {
    if (brute === null || brute === undefined || brute === '') {
      if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
      return null;
    }
    if (typeof brute !== 'string' || brute.length > (champ.max ?? PORTRAIT_MAX)) throw new ErreurValeur(`« ${nom} » : image trop lourde (${champ.max ?? PORTRAIT_MAX} caractères au plus)`);
    // une image que la page écrit : un base64 complet, et un en-tête dont on lit les dimensions (le cadrage et le build en ont besoin)
    if (!estUnPortrait(brute) || !dimensionsDuPortrait(brute)) throw new ErreurValeur(`« ${nom} » : image attendue (data URL WebP, JPEG ou PNG)`);
    return brute;
  }
  if (champ.type === 'reel') {
    if (brute === null || brute === undefined || String(brute).trim() === '') {
      if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
      return null;
    }
    const n = typeof brute === 'number' ? brute : Number(String(brute).trim().replace(',', '.'));
    if (!Number.isFinite(n)) throw new ErreurValeur(`« ${nom} » : nombre attendu`);
    if (champ.min !== undefined && n < champ.min) throw new ErreurValeur(`« ${nom} » : au moins ${champ.min}`);
    if (champ.max !== undefined && n > champ.max) throw new ErreurValeur(`« ${nom} » : au plus ${champ.max}`);
    return n;
  }
  if (champ.type === 'entier') {
    if (brute === null || brute === undefined || String(brute).trim() === '') {
      if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
      return champ.vide ?? null;
    }
    const n = typeof brute === 'number' ? brute : Number(String(brute).trim().replace(/^\+/, ''));
    if (!Number.isInteger(n)) throw new ErreurValeur(`« ${nom} » : nombre entier attendu`);
    if (champ.min !== undefined && n < champ.min) throw new ErreurValeur(`« ${nom} » : au moins ${champ.min}`);
    if (champ.max !== undefined && n > champ.max) throw new ErreurValeur(`« ${nom} » : au plus ${champ.max}`);
    return n;
  }
  if (brute !== null && brute !== undefined && typeof brute !== 'string' && typeof brute !== 'number') throw new ErreurValeur(`« ${nom} » : texte attendu`);
  let texte = String(brute ?? '').replace(/\r\n?/g, '\n');
  if (champ.type === 'ligne' || champ.type === 'choix') texte = texte.replace(/\s*\n\s*/g, ' ');
  texte = champ.type === 'markdown' ? texte.replace(/\s+$/, '') : texte.trim();
  if (champ.type === 'choix' && champ.choix && texte !== '' && !champ.choix.some((c) => c.valeur === texte)) throw new ErreurValeur(`« ${nom} » : valeur hors de la liste`);
  if (texte === '') {
    if (champ.requis) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
    return champ.vide ?? null;
  }
  return texte;
}

/** Les colonnes d'image d'une table du modèle (portrait). */
export const colonnesImage = (table) => Object.entries(TABLES[table]?.colonnes ?? {}).filter(([, c]) => c.type === 'image').map(([nom]) => nom);

/**
 * Une ligne renvoyée par le service sans ses images (lignes en attente, lignes lues, réponse d'un lot, conflit) : une image y devient
 * { image: true, empreinte, resume } (lib/portrait.mjs : l'empreinte nomme aussi le fichier publié au build), pour ne pas renvoyer 700 000 caractères à
 * chaque page ; l'image entière se demande à part (POST /api/edition/portrait/).
 */
export function ligneSansImage(table, ligne) {
  const colonnes = colonnesImage(table);
  if (!ligne || !colonnes.length) return ligne;
  const sortie = { ...ligne };
  for (const c of colonnes) {
    if (typeof sortie[c] === 'string') sortie[c] = { image: true, empreinte: empreinte(sortie[c]), resume: resumeDuPortrait(sortie[c]) };
  }
  return sortie;
}

/**
 * `avant` / `apres` d'une modification du journal (JSON) versés dans historique_modification (scripts/db-appliquer-edition.mjs, mise-a-jour-regles.mjs) :
 * une image y devient son résumé (« image 3f2a9c01 (84 Ko) », lib/portrait.mjs#resumeDuPortrait) — l'historique dit qu'elle a changé sans la recopier
 * dans data/rows (la ligne de la table garde l'image elle-même).
 */
export function journalSansImage(table, json) {
  const colonnes = colonnesImage(table);
  if (json === null || json === undefined || !colonnes.length) return json;
  const valeurs = JSON.parse(json);
  if (!valeurs || !colonnes.some((c) => typeof valeurs[c] === 'string')) return json;
  for (const c of colonnes) if (typeof valeurs[c] === 'string') valeurs[c] = resumeDuPortrait(valeurs[c]);
  return JSON.stringify(valeurs);
}

/** L'attribut `data-ed` d'un élément qui affiche un champ : ["table", {clé primaire}, "colonne"] en JSON. */
export const attributEd = (table, cle, colonne) => JSON.stringify([table, cle, colonne]);

/** Lit un attribut `data-ed` ; null s'il est illisible ou vise un champ hors du modèle. */
export function lireAttributEd(texte) {
  try {
    const [table, cle, colonne] = JSON.parse(texte);
    if (!TABLES[table]?.colonnes[colonne] || !cle || typeof cle !== 'object') return null;
    return { table, cle, colonne, champ: TABLES[table].colonnes[colonne] };
  } catch {
    return null;
  }
}

/** Clé de regroupement d'une ligne (table + clé primaire), indépendante de l'ordre des colonnes de la clé. */
export const cleDeLigne = (table, cle) =>
  `${table}\u0000${JSON.stringify(Object.entries(cle ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))}`;

/** Fiches nommées une à une dans l'annonce d'un lot, au plus (les autres sont comptées). */
const FICHES_ANNONCEES = 5;

/**
 * L'annonce, après un lot, des fiches de personnage dont il a retiré un élément supprimé (décision R42 ; réponse `fiches` de POST /api/edition/, au
 * format de serveur/fiches-retraits.mjs#noterLesRetraits : [{ fiche, retraits }]) : '' s'il n'y en a pas ; sinon
 * « Retiré de 2 fiches de personnage (une note datée le rappelle dans chacune) — Aldric : le don « X » (…) ; fiche de joueur n° 1 : le métier « Y ». »
 */
export function annonceDesFiches(fiches) {
  if (!Array.isArray(fiches) || !fiches.length) return '';
  const n = fiches.length;
  const tete = n === 1 ? 'Retiré de 1 fiche de personnage (une note datée le rappelle)' : `Retiré de ${n} fiches de personnage (une note datée le rappelle dans chacune)`;
  const detail = fiches.slice(0, FICHES_ANNONCEES).map((f) => `${f.fiche} : ${(f.retraits ?? []).join(', ')}`).join(' ; ');
  return `${tete} — ${detail}${n > FICHES_ANNONCEES ? ` et ${n - FICHES_ANNONCEES} autre(s)` : ''}.`;
}
