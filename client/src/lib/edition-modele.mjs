// Modèle de l'édition depuis le site de dev (demande du propriétaire ; client/serveur/edition.mjs, docs/serveur.md, « Édition ») : quelles colonnes de
// quelles tables une page peut modifier, avec leur type de champ, et comment une page désigne un champ (attribut `data-ed`). Le service n'accepte
// que ces colonnes ; tout ce qui en dépend dans la base (colonnes typées, tables de détail, page du wiki) est recalculé par le service, jamais saisi.
// Entités créables (ENTITES) : métier, race, classe, peuple, spécialité, don de classe, espèce et carte de monstre, capacité de monstre (commune, et sa place
// sur une carte), arme, composant, gemme, bois, ingrédient, monnaie, événement de la chronologie et bloc de description, catégorie de la chronologie,
// mot-clé, bloc d'un panneau de règles ; supprimables : métier, spécialité, don de classe, arme (retirés des fiches de personnage qui les ont, avec une
// note datée : décisions R42, R52, annonceDesFiches), espèce et carte de monstre, capacité d'une carte, capacité de monstre commune, composant, gemme,
// bois, ingrédient et monnaie (s'ils ne sont cités par aucune autre règle), événement, bloc de description, catégorie (retirée de ses événements),
// mot-clé (retiré de tout ce qui le porte ou le cite), bloc d'un panneau de règles (pas le dernier de son panneau).
// Un texte (CHAMPS_DE_TEXTE : champ ligne, texte ou markdown) peut citer un mot-clé du glossaire par une balise (« {{id}} », « {{id|texte}} », « {{id:}} » :
// lib/mots-cles-balises.mjs) : le service l'enregistre sous sa forme canonique, qui dépend de la colonne (typeDeTexte : « {{id}} » dans un texte mis en
// forme, « {{id|texte}} » toujours dans un texte de case, le mode complet refusé), et refuse une balise qui ne cite aucun mot-clé (serveur/edition.mjs).
// Colonnes modifiables sans création ni suppression : celles des armures, des pièces d'armure, des formes, des poids et des boucliers préfabriqués, et des
// améliorations d'armure et de bouclier (page des armures, serveur/edition-armures.mjs ; l'AP et l'AM d'une armure et d'un bouclier sont deux cases, la
// défense écrite en est refaite : demande du propriétaire, 2026-10-17) ; celles des potions (consommables de l'onglet Ceinture,
// serveur/edition-consommables.mjs).
// Fonctions et constantes pures, sans dépendance (sauf lib/dons-edition.mjs, lib/portrait.mjs, lib/arme-champs.mjs et lib/armure-champs.mjs, purs eux aussi) : partagées par le
// service, les gabarits Astro et le script des pages (src/scripts/edition.mjs).
import { NIVEAUX_DE_DON, TYPES_DE_DON_SAISIE } from './dons-edition.mjs';
import { dimensionsDuPortrait, empreinte, estUnPortrait, PORTRAIT_MAX, resumeDuPortrait } from './portrait.mjs';
import { ECRITURES_DE_COMPETENCE, MAINS } from './arme-champs.mjs';
import { TYPES_D_ARMURE } from './armure-champs.mjs';
import { EPOQUES, PORTEES } from './chronologie.mjs';

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
 *   categories des identifiants de catégories de la chronologie (`categorie_chronologie.id`), sans doublon, dans l'ordre donné : liste JSON, ou texte
 *            « id1, id2 » ; leur existence est contrôlée par le service (formulaire « Nouvel événement ») ;
 *   image    une image en data URL (WebP, JPEG ou PNG, PORTRAIT_MAX caractères au plus, base64 complet et en-tête lisible : lib/portrait.mjs) ;
 *            jamais une saisie de l'éditeur commun (une extension la choisit et la recadre : src/scripts/edition/bestiaire.mjs) ; les réponses de
 *            l'édition (lignes lues, en attente, d'un lot, d'un conflit) n'en donnent que l'empreinte (ligneSansImage), l'image entière passe par
 *            POST /api/edition/portrait/ — le journal exporté et le lot figé de la mise à jour la portent en entier (rejouée sur data/rows).
 * Options : `requis` (vide refusé), `vide` (valeur enregistrée pour un champ vidé quand la colonne n'accepte pas NULL : '' ou 'Rien'),
 * `min` / `max` (entier, réel), `libelleVide` (choix non requis : le libellé de l'option vide, « — » par défaut ; « Non » pour OUI_SEUL).
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

/** L'époque d'un événement de la chronologie (colonne `evenement.epoque` : lib/chronologie.mjs#EPOQUES). */
export const EPOQUES_SAISIE = EPOQUES.map((e) => ({ valeur: e.id, libelle: e.id === 'datee' ? 'Événement daté (une année)' : e.titre }));
/** La portée d'un Impact de la chronologie (colonne `evenement.portee` : lib/chronologie.mjs#PORTEES ; vide : ni l'un ni l'autre). */
export const PORTEES_SAISIE = Object.entries(PORTEES).map(([valeur, libelle]) => ({ valeur, libelle }));

/** Le genre d'un bloc de panneau de règles (colonne `panneau_regles_bloc.tuile`, migration 0056) : du texte qui suit les colonnes, ou une tuile. */
export const GENRES_DE_BLOC = [
  { valeur: '0', libelle: 'Texte' },
  { valeur: '1', libelle: 'Tuile' },
];

/** Une case Oui / Non (colonne entière 0 ou 1 : arme.depart_possible). */
export const OUI_NON = [
  { valeur: '0', libelle: 'Non' },
  { valeur: '1', libelle: 'Oui' },
];

/**
 * Une case Oui / Non dont « Non » est NULL (colonne entière 1 ou NULL : `amelioration_equipement.cout_materiaux` et `bonus_cran` d'une amélioration de
 * bouclier) : « Oui » vaut '1', l'option vide de la liste (`libelleVide` : « Non ») vaut NULL.
 */
export const OUI_SEUL = [{ valeur: '1', libelle: 'Oui' }];

/** Les types d'un matériau (décision R62, table materiau) : ceux de l'armure, et « Autres » pour ce qui n'y entre pas. */
const TYPES_DE_MATERIAU = ['Léger', 'Intermédiaire', 'Lourd', 'Autres'].map((t) => ({ valeur: t, libelle: t }));

/**
 * Les tableaux de la page « Composants » où un objet peut être créé (champ « Tableau » du formulaire) : ceux de l'onglet « Équipement inventaire »
 * (genre:section de la ressource : lib/corps-composants.mjs#SECTIONS_DE_L_INVENTAIRE) ; un matériau, une gemme, un bois, un ingrédient ont leur entité.
 */
const TABLEAUX_DE_COMPOSANTS = [
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

/**
 * Types de champ dont la valeur est un texte où une balise du glossaire des mots-clés peut s'écrire (lib/mots-cles-balises.mjs) : le service les met en
 * forme canonique (serveur/edition.mjs), db:check et le rejeu du journal en lisent les balises. La seule liste : ne pas la recopier.
 */
export const CHAMPS_DE_TEXTE = Object.freeze(['ligne', 'texte', 'markdown']);

/**
 * Le genre d'un texte de la base pour les balises du glossaire : 'markdown' (un texte mis en forme : champ « markdown » de TABLES, et le corps de toute
 * page, même typée : refait depuis ses tables) ou 'texte' (un texte de case : les autres colonnes, de TABLES ou non). Voir lib/mots-cles-balises.mjs.
 */
export function typeDeTexte(table, colonne) {
  if (table === 'page' && colonne === 'corps_md') return 'markdown';
  return TABLES[table]?.colonnes[colonne]?.type === 'markdown' ? 'markdown' : 'texte';
}

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
      // décision R105 : « Coût », la consommation de chakra (un nombre, « 0 », ou « X ») ; « Coût secondaire », le second coût (« 2 âmes », « 3 Sang »)
      cout_brut: { type: 'ligne', libelle: 'Coût', requis: true },
      cout_secondaire: { type: 'ligne', libelle: 'Coût secondaire' },
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
  // le groupe d'espèces (décision R64 : « Ottar ») : son nom (la colonne Espèce de ses espèces) et sa description ; ses espèces ne changent que par migration
  monstre_groupe: {
    libelle: 'Groupe d’espèces',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom de l’espèce (le groupe)', requis: true },
      description: { type: 'texte', libelle: 'Description de l’espèce' },
    },
  },
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
      // décision R65 : après celle de l'espèce, dans l'en-tête de la carte
      description: { type: 'texte', libelle: 'Description de la créature' },
      ...COLONNES_DU_PORTRAIT,
    },
  },
  // la rubrique « Capacité(s) » n'est qu'un repère (texte vide, décision R66) : ses capacités sont les trois tables suivantes
  monstre_rubrique: {
    libelle: 'Rubrique de la carte',
    colonnes: {
      texte: { type: 'texte', libelle: 'Texte de la rubrique', vide: '' },
    },
  },
  // une capacité de monstre commune (décision R66 : « Elle change pour tous ») : son nom et sa description valent pour toutes les cartes qui l'ont ;
  // « {N} » dans la description = un emplacement de valeur commune N, qu'une carte peut changer (décision R69 : monstre_capacite_valeur)
  monstre_capacite_commune: {
    libelle: 'Capacité de monstre',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom de la capacité (sur toutes ses cartes)', requis: true },
      description: { type: 'texte', libelle: 'Description (sur toutes ses cartes ; « {10} » : une valeur que chaque carte peut changer)', requis: true },
    },
  },
  // sa place sur une carte : préfixe (« [EP3] » : à partir de l'EP 3, décision R56 ; ep_min en est recalculé), la capacité commune, la liste de sorts
  // de la carte (« Lanceur de sorts » seulement)
  monstre_capacite: {
    libelle: 'Capacité de la carte',
    colonnes: {
      prefixe: { type: 'ligne', libelle: 'Préfixe (« [EP3] », « [Gauche] »)' },
      capacite_commune_id: { type: 'choix', libelle: 'Capacité', requis: true, liste: 'capacitesDeMonstre' },
      sorts: { type: 'ligne', libelle: 'Sorts de cette carte (séparés par des virgules)' },
    },
  },
  // la valeur d'un emplacement « {N} » pour une carte, quand ce n'est pas la valeur commune (décision R69 ; réglée au curseur : opération
  // valeurs_de_capacite)
  monstre_capacite_valeur: {
    libelle: 'Valeur d’une capacité',
    colonnes: {
      valeur: { type: 'entier', libelle: 'Valeur pour cette carte', requis: true, min: 0 },
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
  // Armes (onglet de /ressources/equipement/, demande du propriétaire : « tout peut être éditable à l'instar des autres pages ») : les cellules de l'onglet « Armes » ;
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
      // la remarque (décision R91 : « pouvoir modifier la présence ou non de la remarque et en modifier le contenu ») : l'étoile ★ à côté du nom, son
      // texte en infobulle ; vide, pas d'étoile
      remarque: { type: 'texte', libelle: 'Remarque' },
    },
  },
  // Composants (/ressources/composants/, demande du propriétaire, 2026-10-14 : « chaque élément est modifiable en édition, supprimable, ajoutable ») :
  // une ressource du catalogue — matériau, bois, ingrédient d'alchimie (son nom est aussi celui des armes, des armures et des boucliers : « comme c'est le même pour armure et
  // bouclier, ça le changera aussi »), gemme (nom, description ; ses prix : table gemme), objet de l'onglet « Équipement inventaire » — et le nom et
  // le prix d'une potion (consommables de l'onglet Ceinture : serveur/edition-consommables.mjs) ; le service refuse les autres ressources (livres…) et
  // recalcule le prix en RF (lib/composants-champs.mjs)
  ressource: {
    libelle: 'Composant',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom (le même partout où il est écrit : armes, armures, boucliers…)', requis: true },
      prix_brut: { type: 'ligne', libelle: 'Prix (« 2 RO », « 100 RF / 1 RO »)' },
      description: { type: 'texte', libelle: 'Description' },
    },
  },
  // le type d'un matériau (décision R62 : d'après l'armure, « Léger, Intermédiaire, Lourd et autres pour tout ce qui ne rentre pas dans ces catégories »)
  materiau: {
    libelle: 'Matériau',
    colonnes: { type: { type: 'choix', libelle: 'Type (d’après l’armure)', requis: true, choix: TYPES_DE_MATERIAU } },
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
  // Consommables (sous-onglet Consommables de l'onglet Ceinture de /ressources/equipement/ ; demande du propriétaire, 2026-10-17 : « Les tableaux des
  // consommables devrai pouvoir aussi être modifiées . (sauf pour les champ calculés) ») : le niveau et l'effet d'une potion (son nom et son prix : sa
  // ressource, colonnes de `ressource`) ; le service en refait les altérations d'état de l'effet (potion_etat) et suit le corps de la page de la potion
  // (serveur/edition-consommables.mjs). Ni création ni suppression.
  potion: {
    libelle: 'Potion',
    colonnes: {
      niveau_id: { type: 'choix', libelle: 'Niveau', requis: true, liste: 'niveauxDAlchimie' },
      effet: { type: 'texte', libelle: 'Effet', requis: true },
    },
  },
  // les monnaies (MONNAIE et CONVERTISSEUR de l'onglet) : le nom et l'abréviation ; la valeur en RF ne se modifie pas (demande du propriétaire, décision
  // R61 : « Les valeurs ne sont effectivement pas modifiables. Elles servent de valeur utile pour les calculs et de potentiel tooltip »), elle se donne à
  // la création
  monnaie: {
    libelle: 'Monnaie',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      abreviation: { type: 'ligne', libelle: 'Abréviation', requis: true },
    },
  },
  // les onglets de la page « Composants » (migration 0057 ; demande du propriétaire, 2026-10-17 : « avoir des onglets pour chaque table. Il faudrait aussi
  // qu'elles soient modifiables et directement liées en base ») : le titre (le nom de l'onglet) et la note au-dessus du tableau ; une note vidée : NULL
  // (sans note). Rien n'en dépend (pas de domaine dans serveur/edition.mjs) ; ni création ni suppression : un onglet par tableau de la page
  // (lib/composants-db.mjs#TABLEAUX_DES_COMPOSANTS)
  composant_onglet: {
    libelle: 'Onglet des composants',
    colonnes: {
      titre: { type: 'ligne', libelle: 'Nom de l’onglet', requis: true },
      note: { type: 'texte', libelle: 'Note (au-dessus du tableau)' },
    },
  },
  // matériaux d'arme (tableau MATERIAUX de l'onglet) : les effets sur une arme, modifiés depuis la page « Composants » (décision R62 : « la seule source de
  // vérité » ; le prix est celui de la ressource, que le service recopie ici)
  materiau_arme: {
    libelle: 'Matériau d’arme',
    colonnes: {
      effet_brut: { type: 'texte', libelle: 'Effets (« Dégâts +N pour l’arme », « ±N cran de solidité », puis les autres effets)', requis: true },
    },
  },
  // améliorations d'arme (+1 à +10) et d'armure (+1 à +5) : coût et effet écrits ; celles de bouclier (+1 à +5) : quatre cases (demande du propriétaire,
  // 2026-10-17 : « Le +1matériaux devrai être dans le cout (une 2e collonne cout matériaux boolean) Les effet séparés en deux autres colones aussi, Valeur
  // d'AP supplémentaire, et Solidité + 1 ou non »), dont le service refait le coût et l'effet écrits (lib/armure-champs.mjs#textesDeBouclierEcrits) ;
  // chaque cible n'accepte que les siennes (serveur/edition-armes.mjs, serveur/edition-armures.mjs). Celles des pièces élémentaires ne se modifient pas ici
  amelioration_equipement: {
    libelle: 'Amélioration',
    colonnes: {
      cout_brut: { type: 'ligne', libelle: 'Coût (arme, armure : « 1 Matériel + 50 RO », « 100 + 1 Matériau »)', requis: true },
      effet_brut: { type: 'ligne', libelle: 'Effet (arme, armure : « +10 dégâts, +1 cran de solidité », « +4 AP/AM »)', requis: true },
      cout_ro: { type: 'entier', libelle: 'Coût en RO (bouclier)', requis: true, min: 0 },
      cout_materiaux: { type: 'choix', libelle: 'Coût en matériaux (bouclier : 1 matériau de sa matière, décision R76)', choix: OUI_SEUL, libelleVide: 'Non' },
      bonus_ap: { type: 'entier', libelle: 'AP supplémentaire (bouclier ; vide : aucun)' },
      bonus_cran: { type: 'choix', libelle: '+1 cran de solidité (bouclier)', choix: OUI_SEUL, libelleVide: 'Non' },
    },
  },
  // Armures et boucliers (onglets de /ressources/equipement/, demande du propriétaire, 2026-10-15 : « Modifiable tout de suite ») : les cases des onglets « Armures » et
  // « Bouclier » ; le service en tire les colonnes typées (prix, AP, AM, coût en RF, Force minimum) et les résistances et faiblesses d'une armure
  // (lib/armure-champs.mjs), et suit le corps des pages (lib/corps-armures.mjs). Ni création ni suppression (les fiches de personnage citent armures,
  // pièces, formes et améliorations) ; les matériaux se modifient sur la page « Composants » (décision R62).
  armure: {
    libelle: 'Armure',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      type: { type: 'choix', libelle: 'Type', requis: true, choix: TYPES_D_ARMURE.map((t) => ({ valeur: t, libelle: t })) },
      // l'armure physique et l'armure magique, deux cases (demande du propriétaire, 2026-10-17 : « C'est en base que les deux devraient être séparées et
      // donc éditable aussi ») ; vide : pas de bonus. La défense écrite (`stats_brut`) en est refaite par le service (lib/armure-champs.mjs#defenseEcrite)
      ap: { type: 'entier', libelle: 'AP (armure physique ; vide : aucune)' },
      am: { type: 'entier', libelle: 'AM (armure magique ; vide : aucune)' },
      solidite: { type: 'entier', libelle: 'Solidité (crans)', requis: true, min: 0 },
      // une combinaison de deux matières seulement (la case de la grille) ; une armure particulière écrit son effet
      resistance_brut: { type: 'ligne', libelle: 'Résistance (« x2 Frappe », « Estoc/Taille »)' },
      faiblesse_brut: { type: 'ligne', libelle: 'Faiblesse (« x2 Estoc », « Taille/Frappe »)' },
      effet: { type: 'texte', libelle: 'Effet (armure particulière)' },
      prix_brut: { type: 'ligne', libelle: 'Prix (RO : « 2 050 », « ???? »)' },
    },
  },
  // une pièce du tableau FABRICATION (Armure Complète, Casque…, Bouclier) : son coût de fabrication ; la page n'affiche plus que celui du bouclier (une
  // armure ne se fabrique plus pièce par pièce : décision R93), les emplacements restent ceux de la fiche de personnage
  armure_emplacement: {
    libelle: 'Pièce d’armure',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Pièce', requis: true },
      cout_brut: { type: 'ligne', libelle: 'Coût de fabrication (« 150 RF / 1,5 RO », « 250 RF / Classe »)', requis: true },
    },
  },
  // une forme (classe) de bouclier : Bocle, Targe, Bouclier Rond, Écu, Pavois (sa classe ne change pas : « classe 4 = 4 matériaux »)
  bouclier_classe: {
    libelle: 'Forme de bouclier',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Forme', requis: true },
      prix_brut: { type: 'ligne', libelle: 'Prix (RO : « 2,5 »)', requis: true },
    },
  },
  // un bouclier préfabriqué (une forme et une matière, décision R78) : son nom, sa défense et son prix tels qu'écrits, et son poids (la couleur de sa
  // case dans l'onglet : décision R92, migration 0054 ; un des poids de la liste, lib/armures-db.mjs#poidsDeBouclier, obligatoire : chaque case de
  // la source a une couleur)
  bouclier: {
    libelle: 'Bouclier',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      // l'AP et l'AM, deux cases comme pour une armure (demande du propriétaire, 2026-10-17) ; la défense écrite (`defense_brut`) en est refaite
      ap: { type: 'entier', libelle: 'AP (armure physique ; vide : aucune)' },
      am: { type: 'entier', libelle: 'AM (armure magique ; vide : aucune)' },
      prix_brut: { type: 'ligne', libelle: 'Prix (RO : « 202,5 »)' },
      poids_id: { type: 'choix', libelle: 'Poids', requis: true, liste: 'poidsDeBouclier' },
    },
  },
  // un poids de bouclier (liste de l'onglet « Bouclier », que la source ne relie pas aux formes : chaque bouclier porte le sien, poids_id) : son nom et
  // sa Force minimum
  bouclier_poids: {
    libelle: 'Poids de bouclier',
    colonnes: {
      nom: { type: 'ligne', libelle: 'Poids', requis: true },
      force_brut: { type: 'ligne', libelle: 'Force (« 1 de Force minimum »)', requis: true },
    },
  },
  // Chronologie (migration 0043, demande du propriétaire : « que la page puisse être modifiée […] supprimer une page, ou en créer une nouvelle, lui attribuant
  // une date ») : la date (époque, année, année de fin), le titre, la portée et le lieu d'un Impact (serveur/edition-chronologie.mjs) ; les blocs de
  // description (« Description » : le texte, « Lien » : la page du wiki) ; les catégories d'un événement ont leur opération (`categories`)
  evenement: {
    libelle: 'Événement',
    colonnes: {
      titre: { type: 'ligne', libelle: 'Titre', requis: true },
      epoque: { type: 'choix', libelle: 'Date : époque', requis: true, choix: EPOQUES_SAISIE },
      annee: { type: 'entier', libelle: 'Année (événement daté)' },
      annee_fin: { type: 'entier', libelle: 'Année de fin (intervalle « An X à Y »)' },
      portee: { type: 'choix', libelle: 'Impact (liste du Codex)', choix: PORTEES_SAISIE },
      lieu: { type: 'ligne', libelle: 'Lieu de l’Impact' },
    },
  },
  evenement_extrait: {
    libelle: 'Description',
    colonnes: {
      texte: { type: 'markdown', libelle: 'Description', requis: true },
      // l'identifiant d'une page du wiki (liste de GET /api/edition/pages/), contrôlé par le service ; vide : aucun lien
      page_id: { type: 'ligne', libelle: 'Lien' },
    },
  },
  // les catégories de la chronologie (bouton « Catégories » en mode modification ; demande du propriétaire : « créer, modifier et supprimer une
  // catégorie ») : renommer une catégorie change son écriture partout (son id, et donc /chronologie/?filtre=<id>, reste) ; deux catégories ne s'écrivent
  // jamais de la même façon
  categorie_chronologie: {
    libelle: 'Catégorie',
    colonnes: { libelle: { type: 'ligne', libelle: 'Catégorie', requis: true } },
  },
  // le vocabulaire des mots-clés, le glossaire (/recherche/ en mode modification ; migration 0056) : renommer un mot-clé ne réécrit aucun texte (son id
  // reste ; une balise d'un texte de case, « {{id|texte}} », garde le texte écrit, une balise d'un texte mis en forme, « {{id}} », montre le nouveau
  // libellé) ; vers l'écriture d'un autre mot-clé : refusé, la page propose de les fusionner
  // (opération `fusionner_mots_cles`) ; les mots-clés dont le site se sert ne se renomment pas (lib/mots-cles.mjs#MOTS_CLES_PROTEGES), mais leur
  // définition se modifie ; une définition vidée : NULL (pas encore décrit)
  mot_cle: {
    libelle: 'Mot-clé',
    colonnes: {
      libelle: { type: 'ligne', libelle: 'Mot-clé', requis: true },
      description: { type: 'texte', libelle: 'Définition' },
    },
  },
  // Panneaux de règles (migration 0056 ; demande du propriétaire, 2026-10-16 : « Il faudrait que ce champ texte soit modifiable sur son titre, et son
  // contenu. Son contenu peut d'ailleurs inclure des tuiles génériques (toujours insérables / modifiables en mode édition) ») : le titre d'un panneau
  // (son `<summary>`) ; le texte d'un bloc (Markdown sûr, modifié en place comme le guide), le titre d'une tuile (refusé sur un bloc de texte) et sa place
  // (`ordre` : « ↑ », « ↓ » ; jamais unique, à égalité le rang départage) : serveur/edition-panneaux.mjs
  panneau_regles: {
    libelle: 'Panneau de règles',
    colonnes: { titre: { type: 'ligne', libelle: 'Titre', requis: true } },
  },
  panneau_regles_bloc: {
    libelle: 'Bloc de règles',
    colonnes: {
      titre: { type: 'ligne', libelle: 'Titre de la tuile' },
      texte: { type: 'markdown', libelle: 'Texte', requis: true },
      ordre: { type: 'entier', libelle: 'Place (ordre de lecture)', requis: true, min: 1 },
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
const SOURCE_DU_CODEX = 'Google Doc « CODEX Maverick »';
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
const NATURES_DE_RACE = [
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
    nouveau: 'Nouvelle race',
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
    nouveau: 'Nouvelle classe',
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
    // son groupe (décision R64 : un nouvel Ottar rejoint « Ottar ») : seulement à la création, l'appartenance ne se modifie pas ensuite
    champs: { ...champsDe('monstre_espece', ['nom', 'ep_brut', 'description', 'lieu_brut']), groupe_id: { type: 'choix', libelle: 'Rangée sous l’espèce (groupe, facultatif)', liste: 'groupesDeMonstres' } },
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
  // une capacité de monstre commune (décision R66) : identifiant tiré du nom une fois, puis figé et jamais réutilisé ; supprimée seulement quand plus
  // aucune carte ne l'a
  monstre_capacite_commune: {
    table: 'monstre_capacite_commune',
    libelle: 'capacité de monstre',
    nouveau: 'Nouvelle capacité de monstre',
    suppression: true,
    champs: champsDe('monstre_capacite_commune', ['nom', 'description']),
  },
  // une capacité placée sur une carte, à la fin de ses capacités : une capacité commune existante, ou celle créée plus haut dans le lot (« @i »)
  monstre_capacite: {
    table: 'monstre_capacite',
    libelle: 'capacité de la carte',
    nouveau: 'Ajouter une capacité',
    suppression: true,
    champs: {
      monstre_id: { type: 'ligne', libelle: 'Monstre', requis: true },
      capacite_commune_id: { type: 'ligne', libelle: 'Capacité (identifiant, ou « @i » : créée plus haut dans le lot)', requis: true },
      ...champsDe('monstre_capacite', ['prefixe', 'sorts']),
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
      ...champsDe('arme', ['nom', 'mains', 'competence_brut', 'type_id', 'cout_brut', 'effet', 'description', 'depart_possible', 'remarque']),
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
  // un matériau (décision R62) : son type et sa ressource ; il n'a pas de fiche d'armure, de bouclier ni d'arme (rien n'en est déduit)
  materiau: {
    table: 'materiau',
    libelle: 'matériau',
    suppression: true,
    champs: {
      nom: { type: 'ligne', libelle: 'Nom', requis: true },
      type: { type: 'choix', libelle: 'Type (d’après l’armure)', requis: true, choix: TYPES_DE_MATERIAU },
      ...champsDe('ressource', ['prix_brut', 'description']),
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
  // un événement de la chronologie (demandes du propriétaire : « Chaque entrée […] a donc les éléments suivants : 1) Date 2) Titre 3) Description 4) Lien »,
  // et ses catégories : « On peut choisir plusieurs catégories pour chaque entrée ») : créé avec un bloc de description ; supprimé avec ses blocs et ses
  // catégories. Identifiant (son adresse /chronologie/<id>/) tiré une fois du titre, figé, jamais réutilisé.
  evenement: {
    table: 'evenement',
    libelle: 'événement',
    nouveau: 'Nouvel événement',
    suppression: true,
    champs: {
      ...champsDe('evenement', ['epoque', 'annee', 'annee_fin', 'titre']),
      description: { type: 'markdown', libelle: 'Description', requis: true },
      lien: { type: 'ligne', libelle: 'Lien (une page du wiki)' },
      categories: { type: 'categories', libelle: 'Catégories' },
    },
  },
  // un bloc de description de plus dans un événement (texte et lien) ; le dernier bloc d'un événement ne se supprime pas
  evenement_extrait: {
    table: 'evenement_extrait',
    libelle: 'bloc de description',
    nouveau: 'Nouveau bloc de description',
    suppression: true,
    champs: {
      evenement_id: { type: 'ligne', libelle: 'Événement', requis: true },
      texte: { type: 'markdown', libelle: 'Description', requis: true },
      lien: { type: 'ligne', libelle: 'Lien (une page du wiki)' },
    },
  },
  // une catégorie de la chronologie ; supprimée, elle est retirée de tous les événements qui la portent
  categorie_chronologie: {
    table: 'categorie_chronologie',
    libelle: 'catégorie',
    nouveau: 'Nouvelle catégorie',
    suppression: true,
    champs: { libelle: { type: 'ligne', libelle: 'Catégorie', requis: true } },
  },
  // un mot-clé du glossaire (/recherche/), son libellé et sa définition ; supprimé, il est retiré de toutes les pages qui le portent et de tous les textes
  // qui le citent (sa balise devient son texte simple ; sauf les mots-clés dont le site se sert : lib/mots-cles.mjs)
  mot_cle: {
    table: 'mot_cle',
    libelle: 'mot-clé',
    nouveau: 'Nouveau mot-clé',
    suppression: true,
    champs: {
      libelle: { type: 'ligne', libelle: 'Mot-clé', requis: true },
      description: { type: 'texte', libelle: 'Définition' },
    },
  },
  // un bloc d'un panneau de règles (« + Texte », « + Tuile » sous un bloc, en mode modification) : inséré après le bloc de rang `apres` (les blocs suivants
  // décalés d'une place), sinon à la fin ; un titre seulement sur une tuile ; rang tiré une fois (le plus grand + 1, journal et historique compris), jamais
  // redonné ; le dernier bloc d'un panneau ne se supprime pas
  panneau_regles_bloc: {
    table: 'panneau_regles_bloc',
    libelle: 'bloc de règles',
    nouveau: 'Nouveau bloc de règles',
    suppression: true,
    champs: {
      panneau_id: { type: 'ligne', libelle: 'Panneau', requis: true },
      tuile: { type: 'choix', libelle: 'Genre (vide : du texte)', choix: GENRES_DE_BLOC },
      titre: { type: 'ligne', libelle: 'Titre (une tuile seulement)' },
      texte: { type: 'markdown', libelle: 'Texte', requis: true },
      apres: { type: 'entier', libelle: 'Après le bloc de rang (vide : à la fin)', min: 1 },
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
  if (champ.type === 'categories') {
    const liste = Array.isArray(brute) ? brute : String(brute ?? '').split(',');
    if (!liste.every((v) => typeof v === 'string')) throw new ErreurValeur(`« ${nom} » : identifiants de catégories attendus`);
    const ids = [...new Set(liste.map((v) => v.trim()).filter(Boolean))];
    if (champ.requis && !ids.length) throw new ErreurValeur(`« ${nom} » : valeur obligatoire`);
    return ids;
  }
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
    // au-delà de 2^53 un nombre n'est plus un entier exact : SQLite le refuserait dans une colonne INTEGER (erreur 500 au lieu d'un refus)
    if (!Number.isSafeInteger(n)) throw new ErreurValeur(`« ${nom} » : nombre entier attendu`);
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

/**
 * Les options de la liste d'un champ « choix » dans le mode modification (src/scripts/edition/editeur.mjs) : l'option vide d'un champ non requis (« — »,
 * ou son `libelleVide` : « Non » d'une case Oui / Non dont « Non » est NULL, OUI_SEUL), les `choix`, puis la valeur de la base (`valeur`) si la liste ne
 * l'a pas — le « 2 » d'un coût en matériaux qu'un ancien lot aurait écrit, une liste du service pas encore à jour —, telle quelle : la saisie la montre,
 * et tant que personne n'y touche elle garde sa valeur et rien n'est envoyé (une liste sans elle la remettrait à vide au premier « Enregistrer »).
 * @returns {{ valeur: string, libelle: string }[]}
 */
export function optionsDuChoix(champ, choix, valeur) {
  const options = [...(champ.requis ? [] : [{ valeur: '', libelle: champ.libelleVide ?? '—' }]), ...choix.map((c) => ({ valeur: String(c.valeur), libelle: c.libelle }))];
  const actuelle = valeur === null || valeur === undefined ? '' : String(valeur);
  if (actuelle !== '' && !options.some((o) => o.valeur === actuelle)) options.push({ valeur: actuelle, libelle: actuelle });
  return options;
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
