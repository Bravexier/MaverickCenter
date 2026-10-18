// Ressources de l'API REST du module « magie » (format : lib/ressources.mjs) : les magies et leurs sorts (section 3 de data/schema.sql, classeur
// « Magie Maverick V8 »), puis les invocations et leurs créatures invoquées (section 8, classeur « Invocation » ; à part des monstres du Bestiaire 2.0,
// décision R67). Les écritures sont celles que le site de dev sait déjà faire (TABLES de lib/edition-modele.mjs ; serveur/edition.mjs : MAGIE,
// MAGIE_ROLE, SORT) : modifier une magie, un rôle de magie, un sort ; aucune entité de ce module ne se crée ni ne se supprime (rien dans ENTITES). Les
// tables que le service refait quand un sort change (types, modes, bonus de maîtrise, altérations d'état citées) sont des `derivees`, jamais écrites
// par l'API. La section 8 est entièrement en lecture seule : aucune de ses tables n'est dans TABLES (seuls le nom et le libellé d'un effet de créature
// suivent un sort renommé, écrits par le service, serveur/edition.mjs#deriverNomDuSort). Une table dont le parent est lui-même une sous-table (types
// d'une attaque, sorts d'une capacité, magies d'un bloc, résistances d'une capacité commune) fait de ce parent une ressource à part entière.

export const RESSOURCES = [
  // ▸ Section 3 : magies et sorts (famille « magies »)
  {
    cle: 'magies',
    nom: 'Magie',
    noms: 'Magies',
    description:
      'Les 15 magies (une par onglet du classeur « Magie Maverick V8 », le Potentiel Illimité en premier) : bannière, présentation, description physique, ' +
      'explication, santé et chakra offerts, caractéristique bonus (reconnue d’après la cellule, aucune pour « AU CHOIX ou ALEATOIRE »), 4ème barre ' +
      '(Sang, Nécromancie : maximum et régénération lus dans son texte) et remarque se modifient, le corps de la page de la magie suit ; rôles, ' +
      'résistances et vulnérabilités, incompatibilités, ethnies admises malgré « Mono-magie uniquement » (décision R15) et dieux en sous-ressources ; ' +
      'les relations entre magies ne se modifient pas (demande du propriétaire) ; ni création ni suppression.',
    table: 'magie',
    enfants: [
      {
        cle: 'roles',
        nom: 'Rôle de magie',
        noms: 'Rôles de magie',
        table: 'magie_role',
        parent: { magie_id: 'id' },
        tri: 'rang',
        description:
          'Les trois cellules du bloc « ROLES » de l’onglet, de gauche à droite (la source ne dit pas que le premier est « principal ») : l’écriture se ' +
          'modifie (DÉGATS, RENFORCEMENT, SOIN, ENTRAVE, PLACEMENT ou INVOCATION), le rôle reconnu en est tiré.',
      },
      {
        cle: 'resistances',
        nom: 'Résistance ou vulnérabilité de magie',
        noms: 'Résistances et vulnérabilités de magie',
        table: 'magie_resistance',
        parent: { magie_id: 'id' },
        tri: 'sens',
        description:
          'Les quatre blocs de l’onglet (résistance et vulnérabilité magiques, résistance et vulnérabilité aux altérations d’état), un nom de la liste ' +
          'par ligne dans l’ordre de la source, l’écriture d’origine gardée (« Gelé ») ; en lecture seule (demande du propriétaire).',
      },
      {
        cle: 'incompatibilites',
        nom: 'Incompatibilité de magie',
        noms: 'Incompatibilités de magie',
        table: 'magie_incompatibilite',
        parent: { magie_id: 'id' },
        tri: 'autre_magie_id',
        description:
          'Les magies que cette magie cite comme non combinables, telles que la source les porte (relation dirigée ; la vue v_magie_incompatible la ' +
          'rend symétrique) ; en lecture seule (demande du propriétaire).',
      },
      {
        cle: 'ethnies-secondaires',
        nom: 'Ethnie à magie secondaire',
        noms: 'Ethnies à magie secondaire',
        table: 'magie_ethnie_secondaire',
        parent: { magie_id: 'id' },
        tri: 'rang',
        description:
          'Les ethnies pour lesquelles une magie secondaire reste possible malgré « Mono-magie uniquement » (colonne « Magie secondaire si Race » de la ' +
          'fiche auto V15.2.2 : Elfe Noir Charbon et Felfe Noir pour la Corruption, décision R15) ; en lecture seule.',
      },
      {
        cle: 'dieux',
        nom: 'Dieu de la magie',
        noms: 'Dieux de la magie',
        table: 'magie_dieu',
        parent: { magie_id: 'id' },
        tri: 'rang',
        description: 'Les dieux de la magie dans l’ordre d’écriture de la cellule de la fiche auto V15.2.2 (« Notix & Capse ») ; en lecture seule.',
      },
    ],
    liste: ['id', 'nom', 'ordre', 'sante_offerte', 'chakra_offert', 'caracteristique_id', 'barre4_ressource', 'mono_magie'],
    recherche: ['nom'],
    tri: 'ordre',
  },
  {
    cle: 'sorts',
    nom: 'Sort',
    noms: 'Sorts',
    description:
      'Les sorts des 14 magies (23 par onglet du classeur « Magie Maverick V8 », du NPM 1 au NPM 5 ; le Potentiel Illimité n’a pas de sorts à lui) : ' +
      'nom, type, coût, portée, zone, D/S/B, effets secondaires, remarque et texte du sort de niveau 5 se modifient ; les valeurs typées (IC, imparable, ' +
      'coût en chakra, portée, zone…), les types, les modes, les bonus de niveau de maîtrise et les altérations d’état citées en sont refaits à chaque ' +
      'modification, comme la ligne du sort dans la page de sa magie ; magie, NPM et ordre ne se modifient pas, l’identifiant ne suit pas un renommage ' +
      '(migration 0006) ; ni création ni suppression.',
    table: 'sort',
    derivees: [
      { table: 'sort_type', parent: { sort_id: 'id' } },
      { table: 'sort_mode', parent: { sort_id: 'id' } },
      { table: 'sort_bonus_maitrise', parent: { sort_id: 'id' } },
      { table: 'sort_etat', parent: { sort_id: 'id' } },
    ],
    liste: ['id', 'nom', 'magie_id', 'niveau', 'ordre', 'type_brut', 'cout_brut', 'cout_secondaire', 'portee_brut'],
    recherche: ['nom'],
    tri: 'magie_id',
  },
  {
    cle: 'ameliorations-cadaveriques',
    nom: 'Amélioration cadavérique',
    noms: 'Améliorations cadavériques',
    description:
      'Le tableau « AMELIORATION CADAVERIQUE » de l’onglet de la Nécromancie (nom et effet, colonne de gauche puis de droite, de haut en bas), affiché ' +
      'sous le sort qui invoque les non-morts (le sort « Animation de mort », dont l’invocation s’appelle « Animation des morts ») ; son lien avec les ' +
      'créatures invoquées n’est pas dans la source ; en lecture seule.',
    table: 'amelioration_cadaverique',
    liste: ['id', 'nom', 'magie_id', 'rang', 'effet'],
    recherche: ['nom', 'effet'],
    tri: 'rang',
  },
  {
    cle: 'regles-de-magie',
    nom: 'Règle de magie',
    noms: 'Règles de magie',
    description:
      'Les règles qui valent pour toutes les magies (Sommaire du classeur « Magie Maverick V8 » : « Règle spéciale pour sort niveau 5 »), le texte ' +
      'tel qu’écrit, affichées au-dessus du tableau des sorts du NPM qu’elles nomment ; en lecture seule.',
    table: 'regle_magie',
    liste: ['id', 'titre', 'niveau_sort'],
    recherche: ['titre', 'texte'],
    tri: 'niveau_sort',
  },
  {
    cle: 'codes-de-la-legende-des-sorts',
    nom: 'Code de la légende des sorts',
    noms: 'Codes de la légende des sorts',
    description:
      'La légende commune des 14 tableaux de sorts (identique dans chaque onglet) : « IC = Instant Cast », les trois façons d’obtenir un niveau de ' +
      'maîtrise (N, L, C) et l’abréviation NM ; les pages de magie ne l’affichent pas (demande du propriétaire) ; en lecture seule.',
    table: 'legende_sort',
    liste: ['code', 'libelle', 'groupe'],
    recherche: ['code', 'libelle'],
    tri: 'groupe',
  },

  // ▸ Section 8 : invocations et créatures invoquées (famille « bestiaire »), en lecture seule
  {
    cle: 'invocations',
    nom: 'Invocation',
    noms: 'Invocations',
    description:
      'Les trois types de créatures qu’un sort permet d’invoquer (un onglet du classeur « Invocation » chacun : golems, non-morts, marionnettes de ' +
      'l’ombre), avec le bandeau, le sort qui les invoque (rapprochement de l’importeur, vide s’il n’est pas établi) et le texte général de l’onglet ; ' +
      'leurs capacités communes, leurs blocs et leurs créatures sont des ressources à part ; en lecture seule.',
    table: 'invocation',
    liste: ['id', 'nom', 'ordre', 'genre', 'bandeau', 'sort_id'],
    recherche: ['nom', 'bandeau'],
    tri: 'ordre',
  },
  {
    cle: 'capacites-communes-d-invocation',
    nom: 'Capacité commune d’invocation',
    noms: 'Capacités communes d’invocation',
    description:
      'La liste « Toutes ces créatures ont ceci en capacité commune » du texte général d’une invocation (golems : Inerte, Élémentaire ; non-morts : ' +
      'Non-Mort, Élémentaire), à part des capacités de monstre communes (décision R67) ; les résistances qu’elle écrit en sous-ressource ; en lecture seule.',
    table: 'invocation_capacite_commune',
    enfants: [
      {
        cle: 'resistances',
        nom: 'Résistance d’une capacité commune',
        noms: 'Résistances d’une capacité commune',
        table: 'invocation_resistance',
        parent: { capacite_commune_id: 'id' },
        tri: 'rang',
        description:
          'Les résistances, vulnérabilités, immunités et sensibilités que le texte de la capacité commune écrit en toutes lettres (« Non-Mort » : ' +
          'immunisée à la peur, au poison…), avec la tournure exacte ; elles valent pour chaque créature de l’invocation ; en lecture seule.',
      },
    ],
    liste: ['id', 'nom', 'invocation_id', 'rang'],
    recherche: ['nom'],
    tri: 'invocation_id',
  },
  {
    cle: 'blocs-d-invocation',
    nom: 'Bloc d’invocation',
    noms: 'Blocs d’invocation',
    description:
      'Une ligne de marge d’un onglet du classeur « Invocation » : une combinaison de magies et ses deux créatures (golems et non-morts), ou le NPM ' +
      'd’une marionnette de l’ombre, que le classeur écrit « EP » par erreur (décision R53) ; les magies de la marge, dans l’ordre d’écriture, en ' +
      'sous-ressource ; en lecture seule.',
    table: 'invocation_bloc',
    libelle: 'marge_brut',
    enfants: [
      {
        cle: 'magies',
        nom: 'Magie du bloc',
        noms: 'Magies du bloc',
        table: 'invocation_bloc_magie',
        parent: { bloc_id: 'id' },
        tri: 'rang',
        description:
          'Les magies écrites dans la marge du bloc (« Terre Mono » : une ; « Terre + Feu » : deux, la première étant celle du sort) ; aucune pour une ' +
          'marionnette ; en lecture seule.',
      },
    ],
    liste: ['id', 'marge_brut', 'invocation_id', 'rang', 'npm'],
    recherche: ['marge_brut'],
    tri: 'invocation_id',
  },
  {
    cle: 'creatures-invoquees',
    nom: 'Créature invoquée',
    noms: 'Créatures invoquées',
    description:
      'Les cartes des créatures invoquées (golems et poupées, non-morts, marionnettes de l’ombre ; classeur « Invocation ») : invocation, bloc et ' +
      'place dans le bloc, description, santé, chakra, barrière, défense, vitesse et FPVSIA tels qu’écrits avec leurs valeurs typées quand l’écriture ' +
      'est sans ambiguïté ; ressource supplémentaire, caractéristiques, bonus par niveau magique et panneaux d’effet en sous-ressources, attaques et ' +
      'capacités en ressources à part ; à part des monstres du Bestiaire 2.0 ; en lecture seule.',
    table: 'creature',
    enfants: [
      {
        cle: 'ressources',
        nom: 'Ressource supplémentaire',
        noms: 'Ressources supplémentaires',
        table: 'creature_ressource',
        parent: { creature_id: 'id' },
        tri: 'ressource',
        description: 'La ligne facultative de ressource supplémentaire de la carte (Sang, Corruption, Âme : trois poupées), telle qu’écrite ; en lecture seule.',
      },
      {
        cle: 'caracteristiques',
        nom: 'Caractéristique de créature',
        noms: 'Caractéristiques de créature',
        table: 'creature_caracteristique',
        parent: { creature_id: 'id' },
        tri: 'rang',
        description:
          'Les six nombres de la ligne « FPVSIA », dans l’ordre d’écriture, lus par l’importeur comme Force, Perception, Volonté, Social, Intelligence, ' +
          'Agilité (lecture à confirmer par le propriétaire) ; en lecture seule.',
      },
      {
        cle: 'bonus-par-niveau-magique',
        nom: 'Bonus par niveau magique',
        noms: 'Bonus par niveau magique',
        table: 'creature_bonus_npm',
        parent: { creature_id: 'id' },
        tri: 'rang',
        description:
          'Les bonus écrits entre parenthèses après la ligne « FPVSIA » (« +1 Force au niveau 2 magique »), le fragment tel qu’écrit ; la caractéristique ' +
          'n’est renseignée que si la cible en est une seule ; en lecture seule.',
      },
      {
        cle: 'effets',
        nom: 'Effet de créature',
        noms: 'Effets de créature',
        table: 'creature_effet',
        parent: { creature_id: 'id' },
        tri: 'rang',
        description:
          'Le panneau « Effet "Manteau noir" » des marionnettes de l’ombre : les bonus que procure la créature sacrifiée par ce sort ; le nom et le ' +
          'libellé suivent le sort quand il est renommé ; en lecture seule.',
      },
    ],
    liste: ['id', 'nom', 'invocation_id', 'bloc_id', 'sante_brut', 'chakra_brut', 'barriere_brut', 'vitesse_brut'],
    recherche: ['nom'],
    tri: 'invocation_id',
  },
  {
    cle: 'attaques-de-creatures-invoquees',
    nom: 'Attaque de créature invoquée',
    noms: 'Attaques de créatures invoquées',
    description:
      'Les lignes « Dégâts » de la carte d’une créature invoquée, une par attaque (« Poing - 1d10/NPM dégâts de frappe »), la ligne entière gardée ; ' +
      'formule, dés, bonus, portée et coût en chakra typés seulement pour une écriture sans ambiguïté, les parenthèses gardées telles quelles ; les ' +
      'types de dégâts en sous-ressource ; en lecture seule.',
    table: 'creature_attaque',
    enfants: [
      {
        cle: 'types',
        nom: 'Type de dégâts',
        noms: 'Types de dégâts',
        table: 'creature_attaque_type',
        parent: { attaque_id: 'id' },
        tri: 'rang',
        description:
          'Les types de dégâts de l’attaque (« de taille/estoc » : deux), l’écriture d’origine gardée ; feu, eau et glace citent la magie du même nom ; ' +
          'en lecture seule.',
      },
    ],
    liste: ['id', 'nom', 'creature_id', 'rang', 'formule_brut', 'type_brut', 'portee_min', 'portee_max'],
    recherche: ['nom'],
    tri: 'creature_id',
  },
  {
    cle: 'capacites-de-creatures-invoquees',
    nom: 'Capacité de créature invoquée',
    noms: 'Capacités de créatures invoquées',
    description:
      'Les paragraphes de la cellule « Capacité(s) » de la carte d’une créature invoquée (« (NPM 3) [Non enflammé] Nom. Texte »), à part des capacités ' +
      'de monstre communes, comme les bonus à choisir du Mage Bleu (décision R67) ; les sorts cités et les résistances écrites en sous-ressources ; en ' +
      'lecture seule.',
    table: 'creature_capacite',
    enfants: [
      {
        cle: 'sorts',
        nom: 'Sort cité',
        noms: 'Sorts cités',
        table: 'creature_capacite_sort',
        parent: { capacite_id: 'id' },
        tri: 'rang',
        description:
          'Les sorts nommés par une capacité « Lanceur de sorts » ou « Sort supplémentaire », le nom tel qu’écrit ; le sort n’est cité que s’il porte ce ' +
          'nom parmi les sorts des magies du bloc (rapprocher serait deviner) ; en lecture seule.',
      },
      {
        cle: 'resistances',
        nom: 'Résistance d’une capacité',
        noms: 'Résistances d’une capacité',
        table: 'creature_capacite_resistance',
        parent: { capacite_id: 'id' },
        tri: 'rang',
        description:
          'Les résistances, vulnérabilités, immunités et sensibilités que le texte de la capacité écrit en toutes lettres, avec la tournure exacte (les ' +
          'résistances chiffrées ou dynamiques restent dans le texte) ; en lecture seule.',
      },
    ],
    liste: ['id', 'nom', 'creature_id', 'rang', 'npm_min', 'etiquette'],
    recherche: ['nom', 'etiquette'],
    tri: 'creature_id',
  },
];

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {
  commentaire_orphelin:
    'Trace de l’import : fils de commentaires du Sommaire du classeur « Magie Maverick V8 » ancrés en A1, sans sort identifiable, conservés tels quels ' +
    'sans rattachement ; l’identifiant est tiré de l’empreinte du texte (que db:check recalcule), qui ne peut donc pas changer. Ce n’est pas un élément ' +
    'du jeu : aucune page ne l’affiche, il reste lisible dans l’onglet DB (/donnees/).',
};
