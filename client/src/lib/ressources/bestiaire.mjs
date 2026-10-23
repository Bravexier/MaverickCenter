// Ressources de l'API REST du module « bestiaire » (format : lib/ressources.mjs) : les monstres du Google Doc « Bestiaire 2.0 » (section 8 bis de
// data/schema.sql, famille « monstres » ; docs/bestiaire.md) — cartes, espèces et leur groupe, capacités de monstre communes, glossaire du butin,
// échelles de puissance et règles de l'introduction. Les créatures invoquées (section 8) sont à part, dans le module « magie » (décision R67).
// Les écritures sont celles que le site de dev sait déjà faire (TABLES, ENTITES de lib/edition-modele.mjs ; serveur/edition-bestiaire.mjs :
// MONSTRE_ESPECE, MONSTRE, MONSTRE_RUBRIQUE, MONSTRE_CAPACITE_COMMUNE, MONSTRE_CAPACITE, et l'opération `valeurs_de_capacite` du curseur pour les
// valeurs propres d'une carte) : rien de plus. Ce que le service
// tire du texte (valeurs typées d'une carte, ses caractéristiques, attaques et défenses : suivreLaCarte ; lieux de rencontre d'une espèce :
// suivreLesLieux) est en `derivees`, jamais écrit par l'API. Le glossaire du butin, les échelles de puissance et les règles de l'introduction ne
// sont pas dans TABLES : en lecture seule.

export const RESSOURCES = [
  {
    cle: 'monstres',
    nom: 'Monstre',
    noms: 'Monstres',
    description:
      'Les cartes de monstre du Google Doc « Bestiaire 2.0 » (ennemi simple, mini-boss ou boss ; une ligne du tableau de /bestiaire/ et sa carte) : nom, ' +
      'échelle de puissance (« 2 », « 1-10 »), catégorie, type, alignement, « Ses stats varient selon son échelle de puissance », description de la ' +
      'créature (après celle de son espèce, décision R65) et portrait avec son cadrage se modifient ; échelles min et max et libellé de la catégorie en ' +
      'sont tirés ; santé, chakra, barrière, armures et vitesses sont tirées du texte des rubriques (seulement quand l’écriture est sans ambiguïté), ' +
      'jamais saisies ; identifiant « <espèce>#carte:<nom> » tiré une fois du nom, figé et jamais réutilisé (l’adresse de la page du monstre en vient) ; ' +
      'créée dans une espèce, après ses cartes, avec les rubriques vides de la disposition la plus courante du doc ; supprimée avec ses rubriques, ses ' +
      'capacités et leurs valeurs (aucune fiche de personnage ne cite un monstre).',
    table: 'monstre',
    enfants: [
      {
        cle: 'rubriques',
        nom: 'Rubrique de la carte',
        noms: 'Rubriques de la carte',
        table: 'monstre_rubrique',
        parent: { monstre_id: 'id' },
        tri: 'rang',
        description:
          'Les rubriques de la carte dans l’ordre du doc (attributs, santé, dégâts, défense, vitesse, caractéristiques, compétences, vulnérabilités, ' +
          'résistances, immunités, tactique…), avec tout leur texte : le texte se modifie, le titre non ; une rubrique modifiée refait les valeurs ' +
          'typées de la carte et ses caractéristiques, attaques et défenses ; la rubrique « Capacité(s) » n’est qu’un repère, sans texte (décision ' +
          'R66 : les capacités sont la sous-ressource `capacites`) ; une rubrique vient avec la carte : ni ajout ni suppression.',
      },
      {
        cle: 'capacites',
        nom: 'Capacité de la carte',
        noms: 'Capacités de la carte',
        table: 'monstre_capacite',
        parent: { monstre_id: 'id' },
        tri: 'rang',
        description:
          'Les capacités de la carte, dans l’ordre : la place d’une capacité de monstre commune (décision R66 : son nom et sa description sont ceux de ' +
          'la capacité commune), avec son préfixe (« [EP3] » : gagnée à partir de l’EP 3, décision R56 ; l’échelle en est tirée, jamais saisie) et, ' +
          'pour « Lanceur de sorts » seulement, la liste de sorts de cette carte ; préfixe, capacité et liste se modifient (une autre capacité emporte ' +
          'les valeurs propres de l’ancienne) ; une capacité s’ajoute à la fin, sur un rang jamais employé, et se retire avec ses valeurs propres, ' +
          'sans renuméroter les autres.',
        // la création rend l'id JSON.stringify({ monstre_id, rang }) (serveur/edition-bestiaire.mjs, MONSTRE_CAPACITE.creer) : la clé entière, dont le
        // rang ; la suppression attend { monstre_id, rang } (rang entier), la clé de la ligne
        ecriture: { creer: 'monstre_capacite', supprimer: 'monstre_capacite', parentCreation: { monstre_id: 'id' }, cleCreee: 'rang' },
      },
      {
        cle: 'valeurs-de-capacites',
        nom: 'Valeur d’une capacité',
        noms: 'Valeurs des capacités',
        table: 'monstre_capacite_valeur',
        parent: { monstre_id: 'id' },
        tri: 'rang',
        description:
          'Les valeurs propres de la carte pour les emplacements « {N} » des descriptions de ses capacités (décision R69 : sans ligne, la carte suit ' +
          'la valeur commune N), par capacité (`rang`) et emplacement (`numero`, 1 = le premier « {…} » de la description) ; une valeur s’ajoute ' +
          '(POST), se modifie (PATCH) ou s’efface (DELETE) par l’opération `valeurs_de_capacite` du site de dev (le curseur) : la valeur commune (ou ' +
          'null) n’est jamais écrite, elle efface la valeur propre.',
        operations: { POST: 'valeurs_de_capacite', PATCH: 'valeurs_de_capacite', DELETE: 'valeurs_de_capacite' },
      },
    ],
    derivees: [
      { table: 'monstre_caracteristique', parent: { monstre_id: 'id' } },
      { table: 'monstre_attaque', parent: { monstre_id: 'id' } },
      { table: 'monstre_defense', parent: { monstre_id: 'id' } },
    ],
    liste: ['id', 'nom', 'espece_id', 'type_brut', 'categorie', 'echelle_brut', 'ep_min', 'ep_max'],
    recherche: ['nom', 'type_brut'],
    tri: 'nom_cle',
    ecriture: { creer: 'monstre', supprimer: 'monstre' },
  },
  {
    cle: 'especes-de-monstres',
    nom: 'Espèce de monstre',
    noms: 'Espèces de monstres',
    description:
      'Les espèces du Google Doc « Bestiaire 2.0 » (un titre « Nom (EPx) » du doc, rangé sous sa lettre ; de 0 à 3 cartes, une espèce sans carte a sa ' +
      'propre ligne dans le tableau de /bestiaire/) : nom, échelle(s) de puissance (« EP2 », « EP1 - 10 »), description, lieu de rencontre, complément ' +
      'et portrait avec son cadrage se modifient ; échelles min et max et lieux de rencontre en sont tirés ; son groupe (décision R64) se choisit à la ' +
      'création seulement ; identifiant « monstres/<nom> » tiré une fois du nom, figé et jamais réutilisé ; créée à la fin du doc ; supprimée une fois ' +
      'ses cartes supprimées, avec ses lieux, ses blocs et son butin ; blocs et butin en sous-ressources.',
    table: 'monstre_espece',
    enfants: [
      {
        cle: 'blocs',
        nom: 'Bloc de l’espèce',
        noms: 'Blocs de l’espèce',
        table: 'monstre_espece_bloc',
        parent: { espece_id: 'id' },
        tri: 'rang',
        description:
          'Les blocs qui suivent les cartes de l’espèce, ouverts par un titre en capitales (aujourd’hui : les quinze tableaux du Presque-Ottar, un ' +
          'par magie) : le texte se modifie, le titre non ; ni ajout ni suppression (sauf avec l’espèce).',
      },
      {
        cle: 'cases-de-butin',
        nom: 'Case de butin',
        noms: 'Cases de butin',
        table: 'monstre_butin',
        parent: { espece_id: 'id' },
        tri: 'rang',
        description:
          'Le tableau du butin de l’espèce (« Score (3d100) | Butin possible ») : une case par tranche de score et catégorie (ennemi simple, mini-boss, ' +
          'boss), une case vide n’a pas de ligne ; le texte se modifie (une case cite un objet du glossaire par son nom exact, décision R57), ni la ' +
          'tranche ni la catégorie ; ni ajout ni suppression (sauf avec l’espèce).',
      },
    ],
    derivees: [{ table: 'monstre_espece_lieu', parent: { espece_id: 'id' } }],
    liste: ['id', 'nom', 'ordre', 'lettre', 'ep_brut', 'lieu_brut', 'groupe_id'],
    recherche: ['nom', 'lieu_brut'],
    tri: 'ordre',
    ecriture: { creer: 'monstre_espece', supprimer: 'monstre_espece' },
  },
  {
    cle: 'groupes-d-especes',
    nom: 'Groupe d’espèces',
    noms: 'Groupes d’espèces',
    description:
      'Les groupes d’espèces de monstres (décision R64, migration 0042 : aujourd’hui « Ottar », qui réunit les 22 espèces Ottar, Presque-Ottar compris) : ' +
      'son nom remplit la colonne Espèce de ses espèces, sa description (le texte « Ottar (explication) » du doc) vient en tête de leurs cartes, avant ' +
      'celle de la créature (décision R65) ; nom et description se modifient ; ses espèces ne changent que par migration (une espèce se range sous un ' +
      'groupe à sa création seulement) ; ni création ni suppression.',
    table: 'monstre_groupe',
    liste: ['id', 'nom', 'nom_cle', 'source_ref'],
    recherche: ['nom'],
    tri: 'nom_cle',
  },
  {
    cle: 'capacites-de-monstres',
    nom: 'Capacité de monstre',
    noms: 'Capacités de monstres',
    description:
      'Les capacités de monstre communes (décision R66 : « Elle change pour tous ») : un nom et une description écrits une fois et cités par chaque ' +
      'carte qui l’a ; deux capacités peuvent porter le même nom avec deux textes (décision R68) ; « {N} » dans la description est un emplacement de ' +
      'valeur commune N que chaque carte peut changer (décision R69) ; « Lanceur de sorts » est la seule à liste de sorts par carte ; les capacités des ' +
      'créatures invoquées et du Mage Bleu restent à part (décision R67) ; nom et description se modifient (les valeurs propres des cartes suivent ' +
      'leurs emplacements) ; identifiant tiré une fois du nom (« + » écrit « plus »), figé et jamais réutilisé ; supprimée seulement quand plus aucune ' +
      'carte ne l’a, jamais « Lanceur de sorts ».',
    table: 'monstre_capacite_commune',
    liste: ['id', 'nom', 'nom_cle', 'liste_de_sorts', 'source_ref'],
    recherche: ['nom', 'description'],
    tri: 'nom_cle',
    ecriture: { creer: 'monstre_capacite_commune', supprimer: 'monstre_capacite_commune' },
  },
  {
    cle: 'objets-de-butin',
    nom: 'Objet de butin',
    noms: 'Objets de butin',
    description:
      'Le glossaire du butin (fin du Google Doc « Bestiaire 2.0 », « GLOSSAIRE BUTIN » : « Nom. Définition »), dans l’ordre du doc : une case de butin ' +
      'cite un objet par son nom exact, ou avec son élément (décision R57), et sa définition est l’infobulle de la case ; sans lien avec les objets de ' +
      'l’équipement ; en lecture seule.',
    table: 'monstre_butin_objet',
    liste: ['id', 'rang', 'nom', 'texte'],
    recherche: ['nom', 'texte'],
    tri: 'rang',
  },
  {
    cle: 'echelles-de-puissance',
    nom: 'Échelle de puissance',
    noms: 'Échelles de puissance',
    description:
      'Les échelles de puissance des monstres (EP 1 à 10) : les deux tableaux de l’introduction du Google Doc « Bestiaire 2.0 », cellules telles ' +
      'qu’écrites (règle carac/comp, dégâts moyens, attributs moyens, expérience reçue) et niveaux de personnage, avec les attributs moyens et ' +
      'l’expérience repris par catégorie (ennemi simple, mini-boss, boss) ; affichées repliées en tête de /bestiaire/ ; en lecture seule.',
    table: 'monstre_echelle',
    libelle: 'ep',
    liste: ['ep', 'niveau_min', 'niveau_max', 'attributs_brut', 'xp_brut'],
    recherche: ['regle_brut', 'degats_brut'],
    tri: 'ep',
  },
  {
    cle: 'regles-du-bestiaire',
    nom: 'Règle du bestiaire',
    noms: 'Règles du bestiaire',
    description:
      'Les règles générales de l’introduction du Google Doc « Bestiaire 2.0 » (« Quelques règles qui marchent dans toutes les échelles de ' +
      'puissance »), dans l’ordre de la liste, affichées repliées en tête de /bestiaire/ ; en lecture seule.',
    table: 'monstre_regle',
    libelle: 'texte',
    liste: ['rang', 'texte', 'source_ref'],
    recherche: ['texte'],
    tri: 'rang',
  },
];

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {};
