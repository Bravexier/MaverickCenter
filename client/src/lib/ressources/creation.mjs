// Ressources de l'API REST du module « creation » (format : lib/ressources.mjs) : ce qu'on choisit en créant un personnage — race et ethnie (section 7 de
// data/schema.sql, sauf les relations entre peuples), classe, spécialité et dons de classe (section 6), métier (section 9). Les écritures sont celles que le
// site de dev sait déjà faire (TABLES, ENTITES de lib/edition-modele.mjs ; serveur/edition.mjs : RACE, RACE_ONGLET, RACE_DON, CLASSE, SPECIALITE, CAPACITE,
// METIER, et l'opération `magies_innees` pour les magies innées d'une race) : rien de plus. Les tables que le service refait quand une ligne change
// (découpages des maîtrises, de l'inventaire, des bonus de métier…) sont des `derivees`, jamais écrites par l'API.
import { SPECIALITES_MAX } from '../dons-edition.mjs';

export const RESSOURCES = [
  {
    cle: 'races',
    nom: 'Race',
    noms: 'Races',
    description:
      'Les races jouables (une par onglet du classeur « Les races ») : la phrase de présentation et l’onglet de la race, qui fait foi (décision R13) — textes, ' +
      'valeurs de départ, avantages, inconvénients, don de base ; ses dons raciaux, son tableau de dons, ses bornes de caractéristiques et ses matrices ' +
      'd’accès de la fiche en sous-ressources ; une race créée reçoit « À compléter. » et 0, rien n’est déduit (ni magie innée, ni classe accessible : ses ' +
      'magies innées se posent ensuite par la matrice, sous-ressource acces-aux-magies), et le service lui crée aussi son peuple du même nom dans la ' +
      'matrice « Relation entre les races », avec sa case « Même peuple » face à lui-même ; une race ne se supprime pas.',
    table: 'race',
    extensions: [{ table: 'race_onglet', parent: { race_id: 'id' } }],
    enfants: [
      {
        cle: 'dons',
        nom: 'Don racial',
        noms: 'Dons raciaux',
        table: 'race_don',
        parent: { race_id: 'id' },
        tri: 'rang',
        description:
          'Les dons raciaux de l’onglet, dans son ordre : une ligne du tableau des ethnies (forme « ethnie », étiquette de la 1re colonne) ou le don de toute ' +
          'la race (forme « unique ») ; étiquette, nom et texte se modifient, l’identifiant est tiré de l’étiquette ou du nom (renommage qui le change ' +
          'refusé) ; la remarque ne se modifie que sur un don dont l’onglet porte une note de cellule (les trois dons d’ethnie du Médusain) : ailleurs la ' +
          'page de la race n’a pas de place pour elle et le service la refuse (422).',
      },
      {
        cle: 'colonnes-du-tableau-de-dons',
        nom: 'En-tête du tableau des dons',
        noms: 'En-têtes du tableau des dons',
        table: 'race_don_tableau_colonne',
        parent: { race_id: 'id' },
        tri: 'rang',
        description: 'Les en-têtes du tableau en panneaux du bloc « Don R (Race) » (Drakos, Mort-vivant), tels qu’écrits ; son titre est celui de l’onglet de la race.',
      },
      {
        cle: 'lignes-du-tableau-de-dons',
        nom: 'Ligne du tableau des dons',
        noms: 'Lignes du tableau des dons',
        table: 'race_don_tableau_ligne',
        parent: { race_id: 'id' },
        tri: 'rang',
        description: 'Les lignes du tableau en panneaux, chacune avec l’ethnie de la fiche qui lui correspond ; en lecture seule.',
      },
      {
        cle: 'cases-du-tableau-de-dons',
        nom: 'Case du tableau des dons',
        noms: 'Cases du tableau des dons',
        table: 'race_don_tableau_cellule',
        parent: { race_id: 'id' },
        tri: 'ligne',
        description: 'Les cases du tableau en panneaux (ligne, colonne), texte tel qu’écrit, puces et retours à la ligne conservés.',
      },
      {
        cle: 'restrictions-de-caracteristique',
        nom: 'Restriction de caractéristique',
        noms: 'Restrictions de caractéristique',
        table: 'race_restriction_carac',
        parent: { race_id: 'id' },
        tri: 'caracteristique_id',
        description: 'Les bornes de caractéristique de la race (onglet « Race » de la fiche auto V15.2.2 : « < », « > » ou « = » et une valeur) ; en lecture seule.',
      },
      {
        cle: 'magies-innees-de-l-onglet',
        nom: 'Magie innée de l’onglet',
        noms: 'Magies innées de l’onglet',
        table: 'race_magie_onglet',
        parent: { race_id: 'id' },
        tri: 'rang',
        description:
          'Les magies innées que l’onglet de la race limite (le Nain et les races hybrides à classe raciale), dans l’ordre où il les cite ; la liste prime sur ' +
          'la matrice de la fiche (décisions R11, R31) ; une magie s’y ajoute à la fin (POST) ou s’en retire (DELETE) par l’opération `magies_innees` du ' +
          'site de dev, seulement pour une race dont l’onglet limite déjà ses magies (sinon : la matrice, acces-aux-magies) ; retirer la dernière rend la ' +
          'main à la matrice.',
        operations: { POST: 'magies_innees', DELETE: 'magies_innees' },
      },
      {
        cle: 'acces-aux-magies',
        nom: 'Accès à une magie innée',
        noms: 'Accès aux magies innées',
        table: 'race_magie',
        parent: { race_id: 'id' },
        tri: 'ordre',
        description:
          'La ligne de la race dans la matrice « Accessibilité Magie » de la fiche auto (une case par magie, 1 = accessible en magie innée), qui fait foi quand ' +
          'l’onglet ne limite pas (décision R8) : une case se modifie (PATCH { accessible: 0 | 1 }) par l’opération `magies_innees` du site de dev, ' +
          'seulement pour une race dont l’onglet ne limite pas ses magies (sinon : magies-innees-de-l-onglet) — c’est ainsi qu’une race créée reçoit ses ' +
          'magies innées.',
        operations: { PATCH: 'magies_innees' },
      },
      {
        cle: 'acces-aux-classes',
        nom: 'Accès à une classe',
        noms: 'Accès aux classes',
        table: 'race_classe',
        parent: { race_id: 'id' },
        tri: 'ordre',
        description: 'La ligne de la race dans la matrice « Accessibilité de Classe » de la fiche auto (une case par classe, 1 = accessible, décision R8) ; en lecture seule.',
      },
    ],
    liste: ['id', 'nom', 'ordre', 'mono_magie'],
    recherche: ['nom'],
    tri: 'ordre',
    ecriture: { creer: 'race' },
  },
  {
    cle: 'ethnies',
    nom: 'Ethnie',
    noms: 'Ethnies',
    description:
      'Les ethnies (sous-race, origine ou variété d’une race) de l’onglet « Bonus Race » de la fiche auto V15.2.2 : le nom choisi dans la fiche, la magie innée ' +
      'liée, le descriptif et ses bonus chiffrés (valeurs des formules du classeur) ; leurs résistances en sous-ressource ; en lecture seule.',
    table: 'ethnie',
    enfants: [
      {
        cle: 'resistances',
        nom: 'Résistance d’ethnie',
        noms: 'Résistances d’ethnie',
        table: 'ethnie_resistance',
        parent: { ethnie_id: 'id' },
        tri: 'rang',
        description:
          'Les résistances écrites pour l’ethnie (une magie ou une altération d’état, et un nombre de crans : +1 résistance, −1 vulnérabilité), telles que la ' +
          'fiche auto les écrit.',
      },
    ],
    liste: ['id', 'nom', 'race_id', 'libelle', 'magie_id', 'bonus_pv', 'bonus_chakra', 'bonus_barriere'],
    recherche: ['nom', 'libelle'],
    tri: 'ordre',
  },
  {
    cle: 'categories-de-classe',
    nom: 'Catégorie de classe',
    noms: 'Catégories de classe',
    description:
      'Les six catégories du Sommaire du classeur des classes (en-têtes de colonne, « Classe Physique Corps à Corps » … « Classe spéciale »), avec la note ' +
      'posée sous la liste et les AM de base qu’elle écrit (« Classe Magique ») ; en lecture seule.',
    table: 'categorie_classe',
    libelle: 'libelle',
    liste: ['id', 'libelle', 'ordre', 'am_base'],
    recherche: ['libelle'],
    tri: 'ordre',
  },
  {
    cle: 'classes',
    nom: 'Classe',
    noms: 'Classes',
    description:
      'Les classes (une par onglet du classeur « Classe Maverick V7 », rangées par catégorie du Sommaire ; une classe raciale porte le nom de sa race) : don de ' +
      'départ (santé, chakra, barrière), maîtrises d’armes et d’armures, arme, armure et inventaire de départ, chose à savoir, présentation ; les maîtrises et ' +
      'l’inventaire découpés sont refaits à chaque modification ; ni renommage ni suppression ; une classe créée l’est dans une catégorie, avec un nom ' +
      '(une classe raciale prend celui de sa race hybride).',
    table: 'classe',
    enfants: [
      {
        cle: 'tableau-annexe',
        nom: 'Ligne du tableau de l’onglet',
        noms: 'Lignes du tableau de l’onglet',
        table: 'classe_annexe',
        parent: { classe_id: 'id' },
        tri: 'rang',
        description: 'Le tableau sans titre sous les dons de l’onglet du Mage Bleu (une ligne par magie, son libellé et son texte) ; en lecture seule.',
      },
    ],
    derivees: [
      { table: 'classe_maitrise_arme', parent: { classe_id: 'id' } },
      { table: 'classe_maitrise_armure', parent: { classe_id: 'id' } },
      { table: 'classe_objet_depart', parent: { classe_id: 'id' } },
    ],
    liste: ['id', 'nom', 'categorie_id', 'ordre', 'sante_depart', 'chakra_depart', 'barriere_depart'],
    recherche: ['nom'],
    tri: 'ordre',
    // le nom : exigé par le service hors classe raciale (serveur/edition.mjs, CLASSE.creer), qu'ENTITES ne dit pas requis
    ecriture: { creer: 'classe', exiges: { nom: 'sauf pour une classe raciale (race_id), qui prend le nom de sa race' } },
  },
  {
    cle: 'specialites',
    nom: 'Spécialité',
    noms: 'Spécialités',
    description:
      'Les spécialités d’une classe, choisies au niveau de classe 10 (deux au plus : décision R43) ; une spécialité se crée avec son don de spécialité et se ' +
      'supprime avec tous ses dons, retirés des fiches qui les ont avec une note datée (R42) ; celles de l’Archimage ne se créent ni ne se suppriment.',
    table: 'specialite',
    liste: ['id', 'nom', 'classe_id', 'rang'],
    recherche: ['nom'],
    tri: 'classe_id',
    // deux spécialités au plus par classe (décision R43 : SPECIALITES_MAX, refus 409 de SPECIALITE.creer)
    ecriture: { creer: 'specialite', supprimer: 'specialite', limite: { champ: 'classe_id', table: 'classe', nombre: SPECIALITES_MAX, regle: 'R43' } },
  },
  {
    cle: 'dons-de-classe',
    nom: 'Don de classe',
    noms: 'Dons de classe',
    description:
      'Les dons de classe (« capacités » du classeur, une page chacun) : niveau, type, effet et remarque ; les choix « l’un OU l’autre » se lisent dans leur ' +
      'place sur l’onglet (ligne, rang, nature), qui ne se modifie pas ; un don créé se place à la fin de son niveau ou en option d’un choix (niveaux 1, 5, 10, ' +
      '15, 20 : R44), un don supprimé est retiré des fiches avec une note datée (R42).',
    table: 'capacite',
    // les NM de sorts gagnés que le texte du don écrit (« Gagne 4 niveaux de maîtrise (NM). », décision R154), lus par lib/maitrise-arme.mjs
    derivees: [{ table: 'capacite_nm_gagne', parent: { capacite_id: 'id' } }],
    liste: ['id', 'nom', 'classe_id', 'specialite_id', 'niveau', 'nature', 'type_brut'],
    recherche: ['nom'],
    tri: 'classe_id',
    // le niveau : exigé par le service sauf pour une option d'un choix (serveur/edition.mjs, CAPACITE.creer), qu'ENTITES ne dit pas requis
    ecriture: { creer: 'capacite', supprimer: 'capacite', exiges: { niveau: 'sauf pour une option d’un choix (avec)' } },
  },
  {
    cle: 'objets-de-depart',
    nom: 'Objet de départ',
    noms: 'Objets de départ',
    description:
      'Le glossaire « Objets des inventaires de départ » du Sommaire du classeur des classes (nom et description), auquel se relient l’inventaire de départ ' +
      'des classes et l’équipement des métiers (décision R35) ; en lecture seule.',
    table: 'objet_depart',
    liste: ['id', 'nom', 'ordre'],
    recherche: ['nom', 'description'],
    tri: 'ordre',
  },
  {
    cle: 'metiers',
    nom: 'Métier',
    noms: 'Métiers',
    description:
      'Les métiers (Google Doc « MÉTIER ») : description, bonus (Acquis d’une compétence ou attribut : R33, R37), artisanat en texte et deux caractéristiques ' +
      '(R34), équipement supplémentaire en objets de départ (R35), avantage possible ; bonus, familles de recettes et objets de départ découpés sont refaits ' +
      'à chaque modification ; un métier supprimé est retiré des fiches avec une note datée (R42).',
    table: 'metier',
    derivees: [
      { table: 'metier_bonus', parent: { metier_id: 'id' } },
      { table: 'metier_recette_famille', parent: { metier_id: 'id' } },
      { table: 'metier_objet_depart', parent: { metier_id: 'id' } },
    ],
    liste: ['id', 'nom', 'bonus_brut', 'peut_fabriquer', 'test_carac_1_id', 'test_carac_2_id'],
    recherche: ['nom'],
    tri: 'nom',
    ecriture: { creer: 'metier', supprimer: 'metier' },
  },
];

const PARTS_DE_MAITRISE = 'découpée par le lecteur lib/maitrise-arme.mjs dans le texte des lignes de maîtrise d’armes des classes (classe_maitrise_arme, ' +
  'dérivée de la ressource classes) et des dons (capacite, ressource dons-de-classe) : une source est l’une ou l’autre, deux parents qu’une dérivée ne ' +
  'sait pas porter ; refaite par le service d’édition, jamais écrite par l’API (décisions R148 à R151, migration 0072) ; lue par les vues ' +
  'v_personnage_maitrise_part et v_personnage_maitrise_arme, lisible dans l’onglet DB (/donnees/)';

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {
  maitrise_arme_part: `Ce que donne chaque source de points de maîtrise d’armes (une part imposée, à choisir ou qui suit la maîtrise au choix de la classe) : ${PARTS_DE_MAITRISE}.`,
  maitrise_arme_part_famille: `Les familles d’armes proposées par chaque part à choisir d’une source de maîtrise d’armes : ${PARTS_DE_MAITRISE}.`,
};
