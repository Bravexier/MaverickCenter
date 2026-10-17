// Ressources de l'API REST du module « artisanat » (format : lib/ressources.mjs) : le catalogue des ressources de la section 9 de data/schema.sql
// (monnaies, matériaux, gemmes, bois, ingrédients d'alchimie, objets de l'onglet « Équipement inventaire », potions, kits d'alchimie, livres et
// parchemins, matériaux de construction, noms cités par une recette), les recettes, les fioles de verre, les familiers et les bâtiments, avec leurs
// vocabulaires (niveaux d'alchimie, affinités) et leurs constantes chiffrées.
// La table `ressource` est un catalogue partagé par genre (et section) : une ressource REST par famille, chacune avec sa `condition` sur `genre`
// (les douze genres de la contrainte CHECK, chacun dans une seule ressource). Les tables de détail 1:1 d'un genre (materiau, materiau_arme,
// materiau_armure, materiau_bouclier, gemme, bois, ingredient_alchimie, potion, kit_alchimie) en sont les extensions.
// Les écritures sont celles que le site de dev sait déjà faire sur la page Composants (TABLES, ENTITES de lib/edition-modele.mjs ;
// serveur/edition-composants.mjs, et serveur/edition-armes.mjs pour les effets d'un matériau sur une arme) : monnaies, objets de l'inventaire,
// matériaux (décision R62), gemmes, bois et ingrédients d'alchimie se créent, se modifient et se suppriment ; le titre et la note des onglets de la page
// se modifient (migration 0057). Le service refuse les autres genres de
// ressource (estUnComposant : potions, kits, livres, parchemins, matériaux de construction, noms cités) : ces ressources sont en lecture seule, comme
// tout ce qui n'est pas dans TABLES (recettes, fioles, familiers, bâtiments, vocabulaires, constantes). Les tables tirées d'un texte de la ligne (états
// cités par l'effet d'une potion, effets d'un petit familier) sont des `derivees`, jamais écrites par l'API.

export const RESSOURCES = [
  // ▸ Monnaies et constantes
  {
    cle: 'monnaies',
    nom: 'Monnaie',
    noms: 'Monnaies',
    description:
      'Les monnaies de l’onglet « Équipement inventaire » (MONNAIE et CONVERTISSEUR) : nom, abréviation, valeur en RF (le Ricken de fer est l’unité, ' +
      'valeur 1) et ligne du convertisseur telle qu’écrite (recalculée par le service) ; le nom et l’abréviation se modifient, sauf l’abréviation du ' +
      'RF, du RO et de la PP (celle des prix écrits) ; la valeur se donne à la création et ne se modifie pas (décision R61) ; une monnaie se crée ' +
      '(identifiant tiré de l’abréviation) et se supprime, sauf l’unité.',
    table: 'monnaie',
    liste: ['id', 'nom', 'abreviation', 'valeur_rf', 'convertisseur_brut'],
    recherche: ['nom', 'abreviation'],
    tri: 'valeur_rf',
    ecriture: { creer: 'monnaie', supprimer: 'monnaie' },
  },
  // ▸ Onglets de la page Composants (migration 0057)
  {
    cle: 'onglets-des-composants',
    nom: 'Onglet des composants',
    noms: 'Onglets des composants',
    description:
      'Les onglets de /ressources/composants/, un par tableau (monnaie, matériaux, gemmes, bois, fruits, une catégorie d’ingrédients d’alchimie ou une ' +
      'section de l’onglet « Équipement inventaire » chacun) : son identifiant est l’ancre de l’onglet et désigne son tableau ; le titre (le nom de ' +
      'l’onglet) et la note au-dessus du tableau se modifient (une note vide : sans note) ; la place dans la barre (`ordre`) en lecture ; ni création ' +
      'ni suppression (un onglet par tableau de la page).',
    table: 'composant_onglet',
    libelle: 'titre',
    liste: ['id', 'titre', 'ordre'],
    recherche: ['titre', 'note'],
    tri: 'ordre',
  },
  {
    cle: 'constantes-d-equipement',
    nom: 'Constante d’équipement',
    noms: 'Constantes d’équipement',
    description:
      'Les constantes chiffrées que la source écrit dans ses textes de règles d’équipement et de fabrication (« Toutes les armes ont de base 2 crans ' +
      'de solidité », « Chaque ingrédient indiqué dans une recette représente deux unités de cet ingrédient »…) : une ligne par phrase, avec la ' +
      'valeur, son unité, la phrase telle qu’écrite et la page qui la porte ; le code les lit par leur identifiant ; en lecture seule.',
    table: 'constante_equipement',
    libelle: 'id',
    liste: ['id', 'valeur', 'unite', 'page_id'],
    recherche: ['id', 'texte'],
    tri: 'id',
  },

  // ▸ Catalogue des ressources (table `ressource`, partagée par genre)
  {
    cle: 'objets',
    nom: 'Objet',
    noms: 'Objets',
    description:
      'Les objets des tableaux de l’onglet « Équipement inventaire » rendus sur /ressources/composants/ : le matériel (Matos aventures, Matos ' +
      'fabrication, Matos projectile) et les produits non monétaires (végétaux, animaux, autres) : nom, prix tel qu’écrit et en RF (recalculé), ' +
      'description (le matériel seulement : celle d’un produit n’est écrite nulle part, l’API la refuse) ; les kits de « Matos fabrication » ne sont ' +
      'pas les kits d’alchimie ; un objet se crée dans un tableau (identifiant tiré du nom puis figé) et ne se supprime que si aucune autre règle ne le ' +
      'cite, une fiche de personnage qui l’a le gardant sous son nom avec une note datée (décision R60).',
    table: 'ressource',
    condition: { genre: ['materiel', 'produit'] },
    liste: ['id', 'nom', 'genre', 'section', 'prix_brut', 'prix_rf'],
    recherche: ['nom', 'description'],
    tri: 'nom',
    // la page Composants n'écrit la description que pour le matériel (lib/composants-rendu.mjs#htmlDeLigneDObjet, avecDescription ; le corps
    // Markdown, lib/corps-composants.mjs, non plus pour un produit) : le service l'accepterait sans qu'elle se voie
    colonnesFigees: { description: { raison: 'un produit non monétaire n’a pas de description sur la page Composants (seul le matériel en a une)', si: { genre: ['produit'] } } },
    ecriture: {
      creer: 'composant',
      supprimer: 'composant',
      champsFiges: {
        description: {
          raison: 'un produit non monétaire n’a pas de description sur la page Composants (seul le matériel en a une)',
          si: { tableau: ['produit:VÉGÉTAUX', 'produit:ANIMAUX', 'produit:AUTRES'] },
        },
      },
    },
  },
  {
    cle: 'materiaux',
    nom: 'Matériau',
    noms: 'Matériaux',
    description:
      'Les matériaux, dont la page Composants est la seule source (décision R62) : nom, prix et description, type d’après l’armure (Léger, ' +
      'Intermédiaire, Lourd, ou Autres pour ce qui n’entre pas dans ces catégories), effets sur une arme (onglet Armes › MATÉRIAUX : le service en ' +
      'tire le bonus de dégâts, le cran de solidité et l’effet secondaire, et y recopie le prix) et, en lecture, les fiches des matières des onglets ' +
      'Armures et Bouclier (prix, AP, AM, solidité) ; renommé, un matériau change aussi dans les pages des armes, des armures et des boucliers (pas ' +
      'dans les noms d’armures composés) ; un matériau se crée sans fiche d’arme, d’armure ni de bouclier (rien n’en est déduit) et ne se supprime ' +
      'que si aucune autre règle ne le cite.',
    table: 'ressource',
    condition: { genre: ['materiau'] },
    extensions: [
      { table: 'materiau', parent: { ressource_id: 'id' } },
      { table: 'materiau_arme', parent: { ressource_id: 'id' } },
      { table: 'materiau_armure', parent: { ressource_id: 'id' } },
      { table: 'materiau_bouclier', parent: { ressource_id: 'id' } },
    ],
    liste: ['id', 'nom', 'prix_brut', 'prix_rf', 'ordre'],
    recherche: ['nom', 'description'],
    tri: 'ordre',
    ecriture: { creer: 'materiau', supprimer: 'materiau', cleSuppression: { id: 'id' } },
  },
  {
    cle: 'gemmes',
    nom: 'Gemme',
    noms: 'Gemmes',
    description:
      'Les gemmes précieuses, une par magie : nom et description, prix de la gemme entière (onglet Bâton magique) et du quart de gemme (onglet ' +
      'Accessoires, « ce sont des quarts de gemmes ») pour chaque qualité (commune, raffinée, parfaite), tels qu’écrits et en RF (recalculés) ; ' +
      'une gemme se crée pour une magie qui n’en a pas et ne se supprime que si aucune autre règle ne la cite (effets d’accessoire, recettes des ' +
      'bâtons magiques).',
    table: 'ressource',
    condition: { genre: ['gemme'] },
    extensions: [{ table: 'gemme', parent: { ressource_id: 'id' } }],
    // le service refuse le prix de la ressource d'une gemme (serveur/edition-composants.mjs) : ses prix sont dans l'extension `gemme`
    colonnesFigees: { prix_brut: 'les prix d’une gemme sont ceux de la gemme entière et du quart de gemme, par qualité (extension gemme)' },
    liste: ['id', 'nom', 'ordre'],
    recherche: ['nom', 'description'],
    tri: 'ordre',
    ecriture: { creer: 'gemme', supprimer: 'gemme', cleSuppression: { id: 'id' } },
  },
  {
    cle: 'bois',
    nom: 'Bois',
    noms: 'Bois',
    description:
      'Les bois de bâton magique, un par magie (onglet Bâton magique › MATÉRIAUX NÉCESSAIRES PAR MAGIE) : nom, description et prix, tel qu’écrit et ' +
      'en RF (recalculé) ; un bois se crée pour une magie qui n’en a pas et ne se supprime que si aucune autre règle ne le cite (recettes des bâtons ' +
      'magiques).',
    table: 'ressource',
    condition: { genre: ['bois'] },
    extensions: [{ table: 'bois', parent: { ressource_id: 'id' } }],
    liste: ['id', 'nom', 'prix_brut', 'prix_rf', 'ordre'],
    recherche: ['nom', 'description'],
    tri: 'ordre',
    ecriture: { creer: 'bois', supprimer: 'bois', cleSuppression: { id: 'id' } },
  },
  {
    cle: 'ingredients-d-alchimie',
    nom: 'Ingrédient d’alchimie',
    noms: 'Ingrédients d’alchimie',
    description:
      'Les ingrédients d’alchimie du Google Doc « Alchimie » (Liste d’ingrédients : Solvant, Essence, Amplificateur, Catalyseur, Stabilisateur) : ' +
      'nom, catégorie, type tel qu’écrit (« Fruit (majeur) » : un amplificateur majeur) et affinité (« Santé + Chakra »), dont le service tire le ' +
      'type, la marque majeur et l’affinité ; ni prix ni description (la page Composants n’en montre pas pour un ingrédient) ; un ingrédient se crée ' +
      'dans le tableau de sa catégorie et ne se supprime que si aucune recette ne le cite.',
    table: 'ressource',
    condition: { genre: ['ingredient_alchimie'] },
    extensions: [{ table: 'ingredient_alchimie', parent: { ressource_id: 'id' } }],
    // la page Composants ne montre ni le prix ni la description d'un ingrédient (lib/composants-rendu.mjs#htmlDeLigneDIngredient) : le service les
    // accepterait sans qu'ils se voient
    colonnesFigees: {
      prix_brut: 'la page Composants ne montre pas le prix d’un ingrédient d’alchimie',
      description: 'la page Composants ne montre pas la description d’un ingrédient d’alchimie',
    },
    liste: ['id', 'nom', 'section', 'ordre'],
    recherche: ['nom'],
    tri: 'nom',
    ecriture: { creer: 'ingredient', supprimer: 'ingredient', cleSuppression: { id: 'id' } },
  },
  {
    cle: 'potions',
    nom: 'Potion',
    noms: 'Potions',
    description:
      'Les potions du Google Doc « Alchimie », une ligne par palier (« Petite fiole rouge », « Grande huile givrante »…) : fioles, huiles, philtres, ' +
      'remèdes et alchimie primitive, avec leur prix, leur rang dans la page, leur niveau d’alchimie et leur effet ; dans le détail, les états ' +
      'd’altération que l’effet inflige, réduit ou soigne, tirés de son texte ; le nom, le prix, le niveau et l’effet se modifient comme dans les ' +
      'tableaux des consommables de l’onglet Ceinture (le service en refait le prix en RF, les états et le tableau de la page de la potion) ; ni ' +
      'création ni suppression.',
    table: 'ressource',
    condition: { genre: ['potion'] },
    extensions: [{ table: 'potion', parent: { ressource_id: 'id' } }],
    derivees: [{ table: 'potion_etat', parent: { ressource_id: 'id' } }],
    // l'onglet Ceinture ne montre pas la description d'une potion (lib/ceinture-rendu.mjs#htmlDeLigneDePotion) : le service la refuse
    colonnesFigees: { description: 'l’onglet Ceinture ne montre pas de description de potion' },
    liste: ['id', 'nom', 'prix_brut', 'prix_rf', 'page_id'],
    recherche: ['nom'],
    tri: 'nom',
  },
  {
    cle: 'kits-d-alchimie',
    nom: 'Kit d’alchimie',
    noms: 'Kits d’alchimie',
    description:
      'Les kits d’alchimie du Google Doc « Alchimie » (table « Kit d’alchimie | Prix | Permet … ») : nom, prix, ce que le kit permet tel qu’écrit ' +
      '(« Faire les recettes avancées ou moins ») et le niveau d’alchimie cité ; ce ne sont pas les kits de « Matos fabrication » (des objets) ; en ' +
      'lecture seule.',
    table: 'ressource',
    condition: { genre: ['kit_alchimie'] },
    lectureSeule: true,
    extensions: [{ table: 'kit_alchimie', parent: { ressource_id: 'id' } }],
    liste: ['id', 'nom', 'prix_brut', 'prix_rf', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'livres-et-parchemins',
    nom: 'Livre ou parchemin',
    noms: 'Livres et parchemins',
    description:
      'Les livres et les parchemins de l’onglet « Livre/Parchemin » (sections LIVRE et PARCHEMIN) : nom et prix, tel qu’écrit et en RF ; rendus par ' +
      'le Markdown de leur page ; en lecture seule.',
    table: 'ressource',
    condition: { genre: ['livre', 'parchemin'] },
    lectureSeule: true,
    liste: ['id', 'nom', 'genre', 'prix_brut', 'prix_rf'],
    recherche: ['nom'],
    tri: 'nom',
  },
  {
    cle: 'materiaux-de-construction',
    nom: 'Matériau de construction',
    noms: 'Matériaux de construction',
    description:
      'Les matériaux de construction de l’onglet « Maison » (Bois, Brique, Pierre) : nom et prix, tel qu’écrit et en RF ; rendus par le Markdown de ' +
      'leur page ; en lecture seule.',
    table: 'ressource',
    condition: { genre: ['materiau_construction'] },
    lectureSeule: true,
    liste: ['id', 'nom', 'prix_brut', 'prix_rf', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'ressources-mentionnees',
    nom: 'Ressource mentionnée',
    noms: 'Ressources mentionnées',
    description:
      'Les noms rencontrés seulement dans le texte d’une recette (« minerais de fer », « Bas Fourneau ») : la source n’en dit rien d’autre, la ligne ' +
      'existe pour que les recettes qui les utilisent se joignent par clé ; en lecture seule.',
    table: 'ressource',
    condition: { genre: ['mentionne'] },
    lectureSeule: true,
    liste: ['id', 'nom', 'page_id'],
    recherche: ['nom'],
    tri: 'nom',
  },

  // ▸ Alchimie et fabrication
  {
    cle: 'niveaux-d-alchimie',
    nom: 'Niveau d’alchimie',
    noms: 'Niveaux d’alchimie',
    description:
      'Les niveaux de difficulté des recettes d’alchimie, Novice < Apprenti < Avancé < Expert < Maître, dans l’ordre de la table des kits du Google ' +
      'Doc « Alchimie » : la colonne « Niveau » des potions et le niveau qu’un kit permet ; en lecture seule.',
    table: 'niveau_alchimie',
    liste: ['id', 'nom', 'rang'],
    recherche: ['nom'],
    tri: 'rang',
  },
  {
    cle: 'affinites',
    nom: 'Affinité',
    noms: 'Affinités',
    description:
      'Les affinités alchimiques (colonne « Affinité » des listes d’ingrédients et cellules des tables « Recette » du Google Doc « Alchimie ») : une ' +
      'affinité composée (« Santé + Chakra ») est une seule affinité, identifiée par ses composantes triées, avec sa première écriture rencontrée ; ' +
      'le service en ajoute une quand un ingrédient écrit une combinaison nouvelle et n’en retire jamais ; en lecture seule.',
    table: 'affinite',
    liste: ['id', 'libelle', 'nb_composantes'],
    recherche: ['libelle'],
    tri: 'libelle',
  },
  {
    cle: 'fioles-de-verre',
    nom: 'Fiole de verre',
    noms: 'Fioles de verre',
    description:
      'Les types de fioles de verre du Google Doc « Alchimie » (table « Type de fiole en verre | Niveau | Nombre d’ingrédient ») : nom, niveau tel ' +
      'qu’écrit (« Expert, Maître ») et nombre d’ingrédients (« 5 ou plus ingrédients »), avec le minimum et la marque « ou plus » qui en sont ' +
      'tirés ; en lecture seule.',
    table: 'fiole_verre',
    liste: ['id', 'nom', 'niveau_brut', 'nb_ingredients_brut', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'recettes',
    nom: 'Recette',
    noms: 'Recettes',
    description:
      'Les recettes, une façon d’obtenir un ou plusieurs produits : alchimie (table « Recette » d’une page de potions, une ligne par variante), ' +
      'fabrication d’un matériau (onglet Armures, « Fabrication ») et bâton magique (« 1 Gemme <qualité> + 1 bois [magie] » d’un niveau) : nom, ' +
      'page, recette et produit tels qu’écrits, test d’artisanat et ses deux caractéristiques ; dans le détail, les produits et les éléments (un ' +
      'élément nommé, ou l’affinité exigée par un emplacement d’alchimie) ; en lecture seule.',
    table: 'recette',
    enfants: [
      {
        cle: 'ingredients',
        nom: 'Élément de recette',
        noms: 'Éléments de recette',
        description:
          'Les éléments d’une recette, par rang (emplacement d’alchimie, ou terme séparé par « + ») et par option (« A ou B ») : fragment exact de la ' +
          'source, rôle, emplacement, quantité, unité, qualité, et la ressource nommée ou l’affinité exigée.',
        table: 'recette_ingredient',
        parent: { recette_id: 'id' },
        tri: 'rang',
      },
      {
        cle: 'produits',
        nom: 'Produit de recette',
        noms: 'Produits de recette',
        description: 'Les produits d’une recette (une page de potions : tous ses paliers ; un matériau : lui-même), dans l’ordre.',
        table: 'recette_produit',
        parent: { recette_id: 'id' },
        tri: 'ordre',
      },
    ],
    liste: ['id', 'nom', 'genre', 'famille', 'variante', 'page_id'],
    recherche: ['nom', 'texte_brut'],
    tri: 'nom',
  },

  // ▸ Familiers et maison
  {
    cle: 'familiers',
    nom: 'Familier',
    noms: 'Familiers',
    description:
      'Les familiers de l’onglet « Familiers » : petits familiers, gros familiers et montures, avec leur nom, leur description et, pour un petit ' +
      'familier, son effet tel qu’écrit ; dans le détail, une ligne par effet « - … » de la cellule ; en lecture seule.',
    table: 'familier',
    derivees: [{ table: 'familier_effet', parent: { familier_id: 'id' } }],
    liste: ['id', 'nom', 'categorie', 'ordre'],
    recherche: ['nom', 'description'],
    tri: 'nom',
  },
  {
    cle: 'batiments',
    nom: 'Bâtiment',
    noms: 'Bâtiments',
    description:
      'Les bâtiments standard de l’onglet « Maison » (BATIMENT STANDARD) : nom, description, surface, matériaux et prix tels qu’écrits (« 40 000 - ' +
      '50 000 Ro »), et les nombres qui en sont tirés (m², kg, prix minimum et maximum en RO) ; en lecture seule.',
    table: 'batiment',
    liste: ['id', 'nom', 'surface_m2', 'materiaux_kg', 'prix_brut', 'ordre'],
    recherche: ['nom', 'description'],
    tri: 'ordre',
  },
];

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {};
