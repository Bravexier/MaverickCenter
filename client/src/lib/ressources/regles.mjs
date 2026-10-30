// Ressources de l'API REST du module « regles » (format : lib/ressources.mjs) : les règles de la fiche (section 2 de data/schema.sql : caractéristiques,
// compétences, niveaux et seuils, constantes, entraînement, initiative, types de don, postures), les annexes des magies (section 4 : paliers et tables
// de résistance, altérations d'état, météo, modes Hyper et Super) et les maladies (section 9). Les écritures sont celles que le site de dev sait déjà
// faire (TABLES, ENTITES de lib/edition-modele.mjs ; serveur/edition.mjs) : la seule table modifiable ici est mode_hyper_effet, et seulement ses
// versions « onglet_magie » et « onglet_race » (MODE_HYPER_EFFET : le corps de la page de la magie ou de la race suit) ; aucune entité de ce module
// ne se crée ni ne se supprime. Tout le reste est en lecture seule : ces tables ne sont dans ni TABLES ni ENTITES.

/** Les deux versions de mode_hyper_effet que le site de dev modifie (pages de magie et de race) ; les trois autres sont des lectures gardées en trace. */
const VERSIONS_MODE_HYPER_MODIFIABLES = ['onglet_magie', 'onglet_race'];

export const RESSOURCES = [
  // ▸ Section 2 : règles de la fiche (famille « fiche »)
  {
    cle: 'caracteristiques',
    nom: 'Caractéristique',
    noms: 'Caractéristiques',
    description:
      'Les six caractéristiques de la fiche auto V15.2.2 (Force, Volonté, Intelligence, Perception, Social, Agilité, dans l’ordre de la fiche) et la ' +
      'lettre qui suffixe leurs compétences (« Arc (F) ») ; en lecture seule.',
    table: 'caracteristique',
    liste: ['id', 'nom', 'lettre', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'competences',
    nom: 'Compétence',
    noms: 'Compétences',
    description:
      'Les 30 compétences de la fiche auto V15.2.2, cinq par caractéristique, avec leur libellé de la fiche (« Arme Lourde (F) ») et la phrase du guide ' +
      '« Compétences » qui les décrit (absente pour Calme : décision R4) ; en lecture seule.',
    table: 'competence',
    liste: ['id', 'nom', 'caracteristique_id', 'ordre', 'libelle_fiche'],
    recherche: ['nom', 'libelle_fiche'],
    tri: 'ordre',
  },
  {
    cle: 'niveaux',
    nom: 'Niveau global',
    noms: 'Niveaux globaux',
    description:
      'Les 20 paliers de la table « Expérience / Niveau global » du guide : XP nécessaire et « Dons » du niveau (points de compétences et d’attributs, ' +
      'caractéristiques à répartir, niveaux de classe et de maîtrise, puissance magique : 5 au niveau 16, décision R16), la cellule telle qu’écrite ' +
      'gardée à côté ; les déblocages (Mode Hyper, Mode Hyper 100 %, Méditation / Repos) en sous-ressource ; en lecture seule.',
    table: 'niveau_global',
    libelle: 'niveau',
    enfants: [
      {
        cle: 'deblocages',
        nom: 'Déblocage',
        noms: 'Déblocages',
        table: 'niveau_deblocage',
        parent: { niveau: 'niveau' },
        tri: 'rang',
        description:
          'Les lignes de la colonne « Dons » du niveau qui ne sont pas des quantités (« Mode Hyper débloqué ! »), avec leur code (mode_hyper, ' +
          'mode_hyper_100, meditation_repos).',
      },
    ],
    liste: ['niveau', 'xp_min', 'points_competences', 'points_attributs', 'niveaux_classe', 'niveaux_maitrise', 'puissance_magique'],
    recherche: ['dons_brut'],
    tri: 'niveau',
  },
  {
    cle: 'seuils-de-niveau',
    nom: 'Seuil par niveau',
    noms: 'Seuils par niveau',
    description:
      'Les valeurs par palier de niveau global lues dans les formules de la fiche auto (total des caractéristiques, maximum naturel d’une compétence, ' +
      'puissance magique maximale de la feuille) : la valeur vaut à partir de `niveau_min` ; la formule d’origine est gardée en trace (la feuille dit ' +
      '17 pour la puissance 5, le site suit le guide : décision R16) ; en lecture seule.',
    table: 'seuil_niveau',
    liste: ['regle', 'niveau_min', 'valeur', 'condition', 'libelle'],
    recherche: ['libelle', 'regle'],
    tri: 'regle',
  },
  {
    cle: 'constantes-de-regle',
    nom: 'Constante de règle',
    noms: 'Constantes de règle',
    description:
      'Les constantes chiffrées de règle (« sort.nm_max », « competence.croix_1_malus »…) : une phrase d’un texte de règle (page du guide citée) ou un ' +
      'facteur d’une formule de la fiche, avec le texte tel qu’écrit dont la valeur est tirée ; en lecture seule.',
    table: 'regle_constante',
    libelle: 'id',
    liste: ['id', 'valeur', 'unite', 'nature', 'page_id'],
    recherche: ['id', 'texte'],
    tri: 'id',
  },
  {
    cle: 'paliers-d-entrainement',
    nom: 'Palier d’entraînement',
    noms: 'Paliers d’entraînement',
    description:
      'La table d’entraînement du guide « Capacités/Don » : une plage du D100 et le bonus d’Acquis qu’elle donne (« 5% d’acquis »), ou l’entraînement ' +
      'raté ; en lecture seule.',
    table: 'entrainement_palier',
    libelle: 'valeur_brut',
    liste: ['de_min', 'de_max', 'valeur_brut', 'resultat_brut', 'bonus_acquis_pct', 'rate'],
    recherche: ['valeur_brut', 'resultat_brut'],
    tri: 'de_min',
  },
  {
    cle: 'bonus-d-initiative',
    nom: 'Bonus d’initiative',
    noms: 'Bonus d’initiative',
    description:
      'Le bonus d’initiative selon l’Agilité (1 à 5), de la table d’initiative du guide « Attributs » (« D20 + … »), avec la note de l’en-tête ' +
      '(l’Agilité 5 n’est atteignable qu’avec une magie précise) ; en lecture seule.',
    table: 'initiative_agilite',
    libelle: 'bonus_brut',
    liste: ['agilite', 'bonus', 'bonus_brut', 'note'],
    recherche: ['bonus_brut', 'note'],
    tri: 'agilite',
  },
  {
    cle: 'types-de-don',
    nom: 'Type de don',
    noms: 'Types de don',
    description:
      'Les quatre types de don du guide « Capacités/Don » (passif, actif, action, réaction) et leur définition, reprise en infobulle du type d’un don ' +
      'sur les pages de classe ; en lecture seule.',
    table: 'type_don',
    liste: ['id', 'nom', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'postures',
    nom: 'Posture',
    noms: 'Postures',
    description:
      'Les six postures de combat (page « Postures » du guide), leur libellé dans le tableau de la fiche et leur présentation ; leurs effets et les ' +
      'compétences de leur réussite critique (R180) en sous-ressources ; en lecture seule.',
    table: 'posture',
    enfants: [
      {
        cle: 'effets',
        nom: 'Effet de posture',
        noms: 'Effets de posture',
        table: 'posture_effet',
        parent: { posture_id: 'id' },
        tri: 'version',
        description:
          'Les effets d’une posture dans les trois textes qui coexistent (version « fiche » : tableau de la fiche auto, chaque ligne marquée avantage ' +
          'ou inconvénient, décision R47 ; « guide_fiche » : page « Tableau Posture » du Google Doc de la fiche ; « guide_mj » : page « Postures » du ' +
          'guide MJ).',
      },
      {
        cle: 'competences-du-critique',
        nom: 'Compétence du critique',
        noms: 'Compétences du critique',
        table: 'posture_critique',
        parent: { posture_id: 'id' },
        tri: 'bonus',
        description:
          'Les compétences sur lesquelles compte le bonus de réussite critique de la posture (« posture » : l’Offensif sur ses six jets d’attaque, ' +
          'le Défensif sur Esquive et Parade) ou d’un don « (Posture …) » (« don_de_posture », choix provisoire Q90), décision R180.',
      },
    ],
    liste: ['id', 'nom', 'ordre', 'libelle_fiche'],
    recherche: ['nom', 'libelle_fiche'],
    tri: 'ordre',
  },

  // ▸ Section 4 : annexes des magies (famille « annexes »)
  {
    cle: 'paliers-de-resistance',
    nom: 'Palier de résistance',
    noms: 'Paliers de résistance',
    description:
      'Les six paliers de la fiche auto (immunité, grande résistance, résistance, vulnérabilité, grande vulnérabilité, sensibilité) : les bornes de la ' +
      'somme des crans de résistance qui y mènent et l’effet sur les dégâts subis (« dégâts subis ÷3 ») ; en lecture seule.',
    table: 'resistance_palier',
    liste: ['id', 'libelle', 'valeur_min', 'valeur_max', 'multiplicateur', 'effet_brut', 'ordre'],
    recherche: ['libelle'],
    tri: 'ordre',
  },
  {
    cle: 'alterations-d-etat',
    nom: 'Altération d’état',
    noms: 'Altérations d’état',
    description:
      'Les altérations d’état de l’onglet des altérations du classeur V8 (« Pétrifié », « Surcharge Magique »…) : type physique ou mental ' +
      'et magie liée telle qu’écrite ; magies liées, effets par stade et effets selon le palier de résistance de la cible en sous-ressources ; elles ' +
      'sont citées par les sorts, les résistances des magies, des ethnies et des créatures, et les potions ; en lecture seule (l’identifiant garde la ' +
      'graphie d’origine du nom).',
    table: 'etat',
    enfants: [
      {
        cle: 'magies-liees',
        nom: 'Magie liée',
        noms: 'Magies liées',
        table: 'etat_magie',
        parent: { etat_id: 'id' },
        tri: 'rang',
        description: 'La ou les magies liées à l’altération (Surcharge Magique : Arcane et Corruption) ; une altération écrite « / » n’en a pas.',
      },
      {
        cle: 'stades',
        nom: 'Stade',
        noms: 'Stades',
        table: 'etat_stade',
        parent: { etat_id: 'id' },
        tri: 'rang',
        description: 'L’effet de l’altération à chaque stade (1 à 3), tel qu’écrit ; une ligne sans stade quand la source fusionne les trois colonnes.',
      },
      {
        cle: 'effets-par-palier',
        nom: 'Effet selon la résistance',
        noms: 'Effets selon la résistance',
        table: 'etat_palier',
        parent: { etat_id: 'id' },
        tri: 'palier_id',
        description:
          'L’effet de l’altération selon la résistance ou la vulnérabilité de la cible (paliers de résistance, libellé de la source gardé) ; une paire ' +
          'dont l’effet est vide dans la source n’a pas de ligne.',
      },
    ],
    liste: ['id', 'nom', 'ordre', 'type', 'magie_liee_brut'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'meteos',
    nom: 'Météo',
    noms: 'Météos',
    description:
      'Les météos de l’onglet « Météo » du classeur V8 (« Pluie diluvienne »…) et leur description ; leurs effets en sous-ressource ; en lecture seule.',
    table: 'meteo',
    enfants: [
      {
        cle: 'effets',
        nom: 'Effet de météo',
        noms: 'Effets de météo',
        table: 'meteo_effet',
        parent: { meteo_id: 'id' },
        tri: 'rang',
        description:
          'Une ligne de la cellule « Effet(s) » de la météo, telle qu’écrite ; pour « Élément X = +N dégâts, +M Soin » (et la forme par tour pair et ' +
          'impair de l’Éclipse), la magie visée et les bonus sont aussi typés.',
      },
    ],
    liste: ['id', 'nom', 'ordre'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'textes-des-modes',
    nom: 'Texte d’explication des modes',
    noms: 'Textes d’explication des modes',
    description:
      'Les textes d’explication du classeur « Mode hyper et co » (onglets Mode Hyper et Mode Super), cellule entière telle quelle, avec la page du guide ' +
      'qui les présente ; en lecture seule (ces pages du guide se modifient comme pages, et leur identifiant suit l’intitulé).',
    table: 'mode_texte',
    libelle: 'intitule',
    liste: ['id', 'mode', 'rang', 'intitule', 'page_id'],
    recherche: ['intitule'],
    tri: 'mode',
  },
  {
    cle: 'depassements-du-mode-hyper',
    nom: 'Dépassement du Mode Hyper',
    noms: 'Dépassements du Mode Hyper',
    description:
      'Le tableau « Au-delà des limites » du classeur « Mode hyper et co » : les conséquences d’un Mode Hyper maintenu de 1 à 5 tours de plus, une fois ' +
      'relâché ; en lecture seule.',
    table: 'mode_hyper_depassement',
    libelle: 'tours_brut',
    liste: ['tours', 'tours_brut', 'effet'],
    recherche: ['tours_brut', 'effet'],
    tri: 'tours',
  },
  {
    cle: 'objets-mode-super',
    nom: 'Objet du Mode Super',
    noms: 'Objets du Mode Super',
    description:
      'Les objets légendaires ou enchantés de l’onglet Mode Super du classeur « Mode hyper et co » : effets passif et actif (vides quand la source n’en ' +
      'écrit pas encore), cellule des effets entière et description / apparence ; en lecture seule.',
    table: 'mode_super_objet',
    liste: ['id', 'nom', 'ordre', 'effet_passif', 'effet_actif'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'effets-mode-hyper',
    nom: 'Capacité Mode Hyper',
    noms: 'Capacités Mode Hyper',
    description:
      'Les capacités Mode Hyper écrites dans l’onglet d’une magie (classeur V8 : mono, bi ou forme complète) ou d’une race (classeur « Les races », ' +
      'qui prime sur la fiche : décision R13), affichées sur la page de la magie ou de la race ; le nom (obligatoire pour une race) et l’effet se ' +
      'modifient, et le corps de la page suit ; ni création ni suppression.',
    table: 'mode_hyper_effet',
    libelle: 'libelle',
    condition: { version: VERSIONS_MODE_HYPER_MODIFIABLES },
    liste: ['id', 'version', 'libelle', 'magie_id', 'race_id', 'variante', 'nom'],
    recherche: ['libelle', 'nom'],
    tri: 'version',
  },
  {
    cle: 'effets-mode-hyper-autres-lectures',
    nom: 'Effet du Mode Hyper (autre lecture)',
    noms: 'Effets du Mode Hyper (autres lectures)',
    description:
      'Les autres lectures des effets du Mode Hyper, toutes conservées : classeur « Mode hyper et co » (général, magies, races), onglet masqué « Mode ' +
      'Hyper (Magie) » du classeur V8 (magies seules, couples, avantages de base) et fiche auto V15.2.2 (effets de base, magies, races ; valeurs ' +
      'retenues : décision R5) ; en lecture seule.',
    table: 'mode_hyper_effet',
    libelle: 'libelle',
    condition: { version: { sauf: VERSIONS_MODE_HYPER_MODIFIABLES } },
    lectureSeule: true,
    liste: ['id', 'version', 'portee', 'libelle', 'magie_id', 'magie2_id', 'race_id', 'variante'],
    recherche: ['libelle', 'nom'],
    tri: 'version',
  },

  // ▸ Section 9 : maladies
  {
    cle: 'maladies',
    nom: 'Maladie',
    noms: 'Maladies',
    description:
      'Les maladies de l’onglet « Maladie » (version « liste », une ligne par maladie) et du gabarit « Maladie V2 » (version « v2 », la Fièvre des ' +
      'marais seule, avec conseil, description et races sensibles, résistantes ou immunisées : elle a donc deux lignes) : effets, nature, lieu de ' +
      'contraction, incubation, soin ; méthodes de contraction et de soin en sous-ressource ; en lecture seule.',
    table: 'maladie',
    enfants: [
      {
        cle: 'methodes',
        nom: 'Méthode de contraction ou de soin',
        noms: 'Méthodes de contraction et de soin',
        table: 'maladie_methode',
        parent: { maladie_id: 'id' },
        tri: 'sorte',
        description: 'Les lignes des champs « Méthode de contraction » et « Méthode de soin » de la maladie (une ligne « - … » ou un texte unique).',
      },
    ],
    liste: ['id', 'nom', 'version', 'nature', 'incubation_brut', 'ordre'],
    recherche: ['nom', 'nature'],
    tri: 'ordre',
  },
];

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {};
