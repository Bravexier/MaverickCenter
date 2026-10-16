// Ressources de l'API REST du module « equipement » (format : lib/ressources.mjs) : l'équipement de la section 9 de data/schema.sql — armes (familles,
// types, pièces élémentaires), armures (emplacements, pièces élémentaires), boucliers (classes, poids, préfabriqués), améliorations, accessoires
// (générateur : emplacements, propriétés, effets, montures), bâtons magiques et machines de guerre. Les matériaux d'arme, d'armure et de bouclier sont
// dans le module « artisanat » (décision R62 : la page Composants en est la seule source).
// Les écritures sont celles que le site de dev sait déjà faire (TABLES, ENTITES de lib/edition-modele.mjs ; serveur/edition-armes.mjs,
// edition-armures.mjs) : une arme se crée, se modifie et se supprime (décision R52) ; une amélioration d'arme, d'armure ou de bouclier, une armure, une
// pièce d'armure, une forme, un poids et un bouclier préfabriqué se modifient ; rien d'autre. Deux tables sont donc partagées par une condition :
// `arme` (les armes de monstres, que le service refuse : décision R45, en lecture seule à part) et `amelioration_equipement` (une ressource par cible
// modifiable ; le service refuse celles des pièces élémentaires : en lecture seule à part). Les tables tirées d'un texte de la ligne (types de dégâts et minimums d'une arme, résistances
// d'une armure, effets d'une armure élémentaire, gemmes et cibles d'un effet d'accessoire, ligne TOTAL des tableaux d'amélioration) sont des
// `derivees`, jamais écrites par l'API ; la ligne TOTAL (`amelioration_total`, une par cible) est la dérivée des deux ressources d'amélioration, chacune
// pour ses cibles.

/** La famille des armes de monstres (arme_famille.maitrisable = 0, décision R45) : ses armes ne se créent, ne se modifient ni ne se suppriment. */
const ARMES_DE_MONSTRES = ['arme-de-monstres'];

export const RESSOURCES = [
  // ▸ Armes
  {
    cle: 'armes',
    nom: 'Arme',
    noms: 'Armes',
    description:
      'Les armes de l’onglet « Armes » du classeur « Ressources et Craft » (une ligne par arme et par bandeau, hors armes de monstres), rendues sur ' +
      'l’onglet Armes de /ressources/equipement/ : nom, mains, compétence (décision R48), type, coût, effet, description, arme de départ (fond bleu de la source), remarque ' +
      '(l’étoile à côté du nom, R91) ; le service ' +
      'tire de l’effet le dé, le bonus de dégâts, la portée (R50), la solidité et la provenance, ainsi que les types de dégâts et les minimums de ' +
      'caractéristique (dans le détail) ; une arme se crée dans une famille (identifiant tiré du nom puis figé) et se supprime : elle est alors retirée ' +
      'des fiches qui l’ont, avec une note datée (décision R52).',
    table: 'arme',
    condition: { famille_id: { sauf: ARMES_DE_MONSTRES } },
    derivees: [
      { table: 'arme_degats', parent: { arme_id: 'id' } },
      { table: 'arme_prerequis', parent: { arme_id: 'id' } },
    ],
    liste: ['id', 'nom', 'famille_id', 'type_id', 'competence_brut', 'cout_brut', 'depart_possible'],
    recherche: ['nom', 'competence_brut'],
    tri: 'nom',
    ecriture: { creer: 'arme', supprimer: 'arme' },
  },
  {
    cle: 'armes-de-monstres',
    nom: 'Arme de monstre',
    noms: 'Armes de monstres',
    description:
      'Les armes du bandeau « ARME DE MONSTRES » de l’onglet « Armes » (« Se référer à la catégorie d’arme ») : sans coût ni effet, exclusives aux ' +
      'monstres et sans maîtrise d’arme (décision R45), absentes de la page des armes ; le site de dev ne les crée, ne les modifie ni ne les supprime : ' +
      'en lecture seule.',
    table: 'arme',
    condition: { famille_id: ARMES_DE_MONSTRES },
    lectureSeule: true,
    liste: ['id', 'nom', 'type_id', 'competence_brut', 'de'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'familles-d-armes',
    nom: 'Famille d’armes',
    noms: 'Familles d’armes',
    description:
      'Les bandeaux de l’onglet « Armes » (« ÉPÉES - D10 », « PUGILAT », … « ARME DE MONSTRES »), sous lesquels chaque arme est listée : le bandeau tel ' +
      'qu’écrit, son nom, son ou ses dés, sa note (dé du Pugilat selon la Force…), l’en-tête de sa colonne de coût et si une maîtrise d’arme peut s’y ' +
      'mettre (décision R45) ; en lecture seule.',
    table: 'arme_famille',
    liste: ['id', 'nom', 'de_brut', 'note_brut', 'maitrisable', 'ordre'],
    recherche: ['nom', 'libelle_brut'],
    tri: 'ordre',
  },
  {
    cle: 'types-d-armes',
    nom: 'Type d’arme',
    noms: 'Types d’armes',
    description:
      'Les types d’armes de la fiche auto V15.2.2 (table BDD!AD2:AF14) : le dé de dégâts et la portée par défaut (« 1-2 ») ; le Pugilat n’a pas de dé ' +
      'fixe (règle selon la Force) ; le type d’une arme est la 1re ligne de sa case Catégorie ; en lecture seule.',
    table: 'arme_type',
    liste: ['id', 'nom', 'de', 'de_regle', 'portee_brut'],
    recherche: ['nom'],
    tri: 'nom',
  },
  {
    cle: 'armes-elementaires',
    nom: 'Arme élémentaire',
    noms: 'Armes élémentaires',
    description:
      'Les armes élémentaires de l’onglet « Pièces élémentaires » (un type d’arme × un élément) : nom, bonus de dégâts (« +8 Dégâts »), élément tel ' +
      'qu’écrit et capacité (nom, mode actif, passif ou action, texte) ; en lecture seule.',
    table: 'arme_elementaire',
    liste: ['id', 'nom', 'type_id', 'magie_id', 'bonus_degats', 'capacite_nom', 'capacite_mode'],
    recherche: ['nom', 'capacite_nom'],
    tri: 'ordre',
  },

  // ▸ Armures
  {
    cle: 'emplacements-d-armure',
    nom: 'Emplacement d’armure',
    noms: 'Emplacements d’armure',
    description:
      'Les emplacements du tableau FABRICATION de l’onglet « Armures », noms tels qu’écrits (« Armure Complète », « Casque », « Torse », « Bras ' +
      'Gauche », « Bras Droit », « Jambe Gauche », « Jambe Droit », « Bouclier »), et leur coût de fabrication (« 150 RF / 1,5 RO », « 250 RF / ' +
      'Classe ») ; la source ne donne pas d’AP ni d’AM par emplacement ; une pièce coûte sa fabrication et 1 unité de chaque matériau de l’armure ' +
      '(décision R75) ; le nom et le coût se modifient (le service en tire le coût en RF), ni création ni suppression.',
    table: 'armure_emplacement',
    liste: ['id', 'nom', 'cout_brut', 'cout_rf', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'armures',
    nom: 'Armure',
    noms: 'Armures',
    description:
      'Les armures de l’onglet « Armures » : les combinaisons de deux matières (grille matière × matière) et les armures particulières (vêtements, ' +
      'cottes de mailles, armure montagne, armures de familiers) : type, prix (en RO : décision R79), AP et AM, solidité, résistances et faiblesses (une ' +
      'ligne par type de dégâts dans le détail, le multiplicateur « x2 » tel qu’écrit), effet ; le nom d’une combinaison ne suit pas le renommage ' +
      'd’une matière ; les cases se modifient (nom, type, défense, solidité, résistance et faiblesse d’une combinaison, effet d’une armure ' +
      'particulière, prix) et le service en tire le prix, l’AP, l’AM et les résistances ; ni création ni suppression (les fiches les citent).',
    table: 'armure',
    derivees: [{ table: 'armure_degats', parent: { armure_id: 'id' } }],
    liste: ['id', 'nom', 'sorte', 'type', 'ap', 'am', 'solidite', 'prix_brut'],
    recherche: ['nom', 'effet'],
    tri: 'ordre',
  },
  {
    cle: 'armures-elementaires',
    nom: 'Armure élémentaire',
    noms: 'Armures élémentaires',
    description:
      'Les armures élémentaires de l’onglet « Pièces élémentaires » (Vêtement, Léger, Intermédiaire ou Lourd × un élément) : nom, AP, AM et effets ' +
      '(une ligne « - … » de la cellule par effet, dans le détail) ; en lecture seule.',
    table: 'armure_elementaire',
    derivees: [{ table: 'armure_elementaire_effet', parent: { armure_elementaire_id: 'id' } }],
    liste: ['id', 'nom', 'categorie', 'magie_id', 'ap', 'am'],
    recherche: ['nom'],
    tri: 'ordre',
  },

  // ▸ Boucliers
  {
    cle: 'classes-de-bouclier',
    nom: 'Classe de bouclier',
    noms: 'Classes de bouclier',
    description:
      'Les classes de boucliers de l’onglet « Bouclier » (Bocle, Targe, Bouclier Rond, Écu, Pavois) : la classe, de 1 à 5 (un bouclier de classe N ' +
      'demande N matériaux), et le prix (en RO : décision R79) ; un bouclier est une forme et une matière (décision R78) ; le nom et le prix se modifient, ni ' +
      'création ni suppression.',
    table: 'bouclier_classe',
    liste: ['id', 'nom', 'classe', 'prix_brut'],
    recherche: ['nom'],
    tri: 'classe',
  },
  {
    cle: 'poids-de-bouclier',
    nom: 'Poids de bouclier',
    noms: 'Poids de bouclier',
    description:
      'Les poids de boucliers de l’onglet « Bouclier » (Léger, Moyen, Lourd, Très lourd) et la Force minimum de chacun, d’une liste marquée « A ' +
      'refaire » dans la source, qui ne les relie pas aux classes ; le nom et la Force se modifient (le service en tire la Force minimum), ni ' +
      'création ni suppression.',
    table: 'bouclier_poids',
    liste: ['id', 'nom', 'force_min', 'force_brut'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'boucliers',
    nom: 'Bouclier',
    noms: 'Boucliers',
    description:
      'Les boucliers préfabriqués de l’onglet « Bouclier » (une classe × une matière, décision R78) : nom, prix, défense telle qu’écrite (« +20AP ' +
      '+25AM ») et ses AP et AM, poids (la couleur de sa case dans l’onglet : décision R92) ; le nom ne suit pas le renommage d’une matière ; le nom, ' +
      'la défense, le prix et le poids se modifient (le service en tire le prix, l’AP et l’AM), ni création ni suppression.',
    table: 'bouclier',
    liste: ['id', 'nom', 'classe_id', 'materiau_id', 'prix_brut', 'ap', 'am', 'poids_id'],
    recherche: ['nom'],
    tri: 'nom',
  },

  // ▸ Améliorations (+1 à +10)
  {
    cle: 'ameliorations-d-arme',
    nom: 'Amélioration d’arme',
    noms: 'Améliorations d’arme',
    description:
      'Les améliorations d’arme (+1 à +10) du tableau AMÉLIORATION de l’onglet « Armes » : le coût (« 1 Matériel + 50 RO » ; un « Matériel » est une ' +
      'unité du matériau de l’arme : décisions R49, R51) et l’effet (« +10 dégâts, +1 cran de solidité ») se modifient ; le service en tire le coût en ' +
      'RO, le nombre de matériaux, le bonus de dégâts et les crans de solidité, et refait la ligne TOTAL du tableau (dans le détail) ; ni création ni ' +
      'suppression.',
    table: 'amelioration_equipement',
    libelle: 'effet_brut',
    condition: { cible: ['arme'] },
    derivees: [{ table: 'amelioration_total', parent: { cible: 'cible' } }],
    liste: ['id', 'niveau', 'cout_brut', 'effet_brut', 'cout_ro', 'bonus_degats', 'bonus_cran'],
    recherche: ['effet_brut', 'cout_brut'],
    tri: 'niveau',
  },
  {
    cle: 'ameliorations-d-armure',
    nom: 'Amélioration d’armure',
    noms: 'Améliorations d’armure',
    description:
      'Les améliorations d’armure (+1 à +5) du tableau AMÉLIORATION de l’onglet « Armures » : le coût (« 100 + 1 Matériau ») et l’effet (« +4 AP/AM », ' +
      '« +8 AP/AM, +1 cran de solidité » : la ligne écrit le total au niveau choisi, décision R77) se modifient ; le service en tire le coût en RO, le ' +
      'nombre de matériaux, l’AP, l’AM et les crans, et refait la ligne TOTAL du tableau (dans le détail) ; ni création ni suppression.',
    table: 'amelioration_equipement',
    libelle: 'effet_brut',
    condition: { cible: ['armure'] },
    derivees: [{ table: 'amelioration_total', parent: { cible: 'cible' } }],
    liste: ['id', 'niveau', 'cout_brut', 'effet_brut', 'cout_ro', 'cout_materiaux', 'bonus_ap', 'bonus_am', 'bonus_cran'],
    recherche: ['effet_brut', 'cout_brut'],
    tri: 'niveau',
  },
  {
    cle: 'ameliorations-de-bouclier',
    nom: 'Amélioration de bouclier',
    noms: 'Améliorations de bouclier',
    description:
      'Les améliorations de bouclier (+1 à +5) du tableau AMÉLIORATION de l’onglet « Bouclier » : le coût (« 1000 », en RO) et l’effet (« +4 AP + ' +
      'matériaux » : 1 matériau de la matière du bouclier, crans cumulés, décision R76) se modifient ; le service en tire le coût en RO, le nombre de ' +
      'matériaux, l’AP et les crans, et refait la ligne TOTAL du tableau (dans le détail) ; ni création ni suppression.',
    table: 'amelioration_equipement',
    libelle: 'effet_brut',
    condition: { cible: ['bouclier'] },
    derivees: [{ table: 'amelioration_total', parent: { cible: 'cible' } }],
    liste: ['id', 'niveau', 'cout_brut', 'effet_brut', 'cout_ro', 'cout_materiaux', 'bonus_ap', 'bonus_cran'],
    recherche: ['effet_brut', 'cout_brut'],
    tri: 'niveau',
  },
  {
    cle: 'autres-ameliorations',
    nom: 'Amélioration de pièce élémentaire',
    noms: 'Améliorations de pièce élémentaire',
    description:
      'Les améliorations des armes et armures élémentaires (onglet « Pièces élémentaires »), une ligne par niveau : coût (« 2 gemmes communes », « 1 ' +
      'pièce élémentaire ») et effet tels qu’écrits, avec leurs valeurs typées, et la ligne TOTAL du tableau de leur cible (dans le détail) ; le site ' +
      'de dev ne les modifie pas : en lecture seule.',
    table: 'amelioration_equipement',
    libelle: 'effet_brut',
    condition: { cible: { sauf: ['arme', 'armure', 'bouclier'] } },
    lectureSeule: true,
    derivees: [{ table: 'amelioration_total', parent: { cible: 'cible' } }],
    liste: ['id', 'cible', 'niveau', 'cout_brut', 'effet_brut'],
    recherche: ['effet_brut', 'cout_brut'],
    tri: 'cible',
  },

  // ▸ Accessoires (générateur de l'onglet « Accessoires » de /ressources/equipement/, non modifiable sur le site de dev)
  {
    cle: 'emplacements-d-accessoire',
    nom: 'Emplacement d’accessoire',
    noms: 'Emplacements d’accessoire',
    description:
      'Étape 1 du générateur d’accessoire de l’onglet « Accessoires » (1d4) : l’emplacement (Tête, Collier, Anneau, Bracelet) et son résultat au dé ; ' +
      'en lecture seule.',
    table: 'accessoire_emplacement',
    liste: ['id', 'nom', 'jet'],
    recherche: ['nom'],
    tri: 'jet',
  },
  {
    cle: 'proprietes-d-accessoire',
    nom: 'Propriété d’accessoire',
    noms: 'Propriétés d’accessoire',
    description:
      'Étape 2 du générateur d’accessoire (1d100) : les propriétés (Caractéristique, Compétence, Attributs, Attaque, Défense, Jet de dé, Autre, ' +
      'Malédiction) et leur plage au dé ; en lecture seule.',
    table: 'accessoire_propriete',
    liste: ['id', 'nom', 'jet_min', 'jet_max', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'effets-d-accessoire',
    nom: 'Effet d’accessoire',
    noms: 'Effets d’accessoire',
    description:
      'Étape 3 du générateur d’accessoire : les effets possibles de chaque propriété (Caractéristique au 1d6, Compétence par caractéristique et par ' +
      'niveau, les autres au 1d20, dont la ligne « MALÉDICTION »), avec niveau, gemmes, prix, et le rappel « (Action) » ou d’usage compté (décision ' +
      'R54) ; dans le détail, les gemmes par rang et par option, et ce que l’effet change sur la fiche de personnage (R54), tirés du texte ; une ligne ' +
      'vide de la source reste vide ; en lecture seule.',
    table: 'accessoire_effet',
    libelle: 'libelle',
    derivees: [
      { table: 'accessoire_effet_gemme', parent: { effet_id: 'id' } },
      { table: 'accessoire_effet_cible', parent: { effet_id: 'id' } },
    ],
    liste: ['id', 'propriete_id', 'jet', 'libelle', 'caracteristique_id', 'niveau', 'prix_brut', 'malediction'],
    recherche: ['libelle', 'gemmes_brut'],
    tri: 'ordre',
  },
  {
    cle: 'montures-d-accessoire',
    nom: 'Monture d’accessoire',
    noms: 'Montures d’accessoire',
    description:
      'Les montures d’accessoire de l’onglet « Accessoires » (5 niveaux, sans dé) : le matériau (Fer, Argent, Bronze, Or, Mythril), le prix et l’effet ' +
      '(« Petit effet » … « Effet suprême ») ; en lecture seule.',
    table: 'accessoire_monture',
    libelle: 'effet_brut',
    liste: ['niveau', 'materiau_id', 'prix_brut', 'prix_ro', 'effet_brut'],
    recherche: ['effet_brut'],
    tri: 'niveau',
  },

  // ▸ Bâtons magiques, machines de guerre
  {
    cle: 'batons-magiques',
    nom: 'Bâton magique',
    noms: 'Bâtons magiques',
    description:
      'Les bonus passifs des bâtons magiques de l’onglet « Bâton magique » (une magie × un niveau de 1 à 3, sans nom propre dans la source) : le bonus ' +
      'tel qu’écrit (« Dégâts sort +6 ») et la recette du niveau (gemme et bois de la magie) ; en lecture seule.',
    table: 'baton_magique',
    libelle: 'bonus_brut',
    liste: ['id', 'magie_id', 'niveau', 'bonus_brut', 'recette_id'],
    recherche: ['bonus_brut'],
    tri: 'magie_id',
  },
  {
    cle: 'machines-de-guerre',
    nom: 'Machine de guerre',
    noms: 'Machines de guerre',
    description:
      'Les machines de guerre et de siège de l’onglet « Machine de GuerreSiège » (attaque au sol, attaque au mur, défense au sol) : description, effet, ' +
      'les dégâts (quand l’effet n’en cite qu’un) et les points de vie qu’il écrit ; en lecture seule.',
    table: 'machine_guerre',
    liste: ['id', 'nom', 'categorie', 'degats', 'points_de_vie', 'ordre'],
    recherche: ['nom', 'effet'],
    tri: 'categorie',
  },
];

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {};
