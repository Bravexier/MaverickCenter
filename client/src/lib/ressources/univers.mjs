// Ressources de l'API REST du module « univers » (format : lib/ressources.mjs) : les dieux (section 5 de data/schema.sql), la chronologie (section 5 bis :
// événements, blocs de description, catégories) et les relations entre peuples (section 7 : l'onglet « Relation entre les races » du classeur « Les
// races », son échelle et ses peuples). Les écritures sont celles que le site de dev sait déjà faire (TABLES, ENTITES de lib/edition-modele.mjs ;
// serveur/edition-chronologie.mjs : EVENEMENT, EVENEMENT_EXTRAIT, CATEGORIE ; serveur/edition.mjs : PEUPLE) : rien de plus. Les catégories d'un
// événement et les cases de la matrice des relations ne s'écrivent que par leurs opérations du lot (`categories`, `relations`), ni TABLES ni ENTITES :
// leurs ressources les nomment (`operations`).

export const RESSOURCES = [
  {
    cle: 'dieux',
    nom: 'Dieu',
    noms: 'Dieux',
    description:
      'Les noms de la liste déroulante « Dieu choisi » de la fiche auto (Personnage!S5) et de la colonne « Dieux » de la feuille Magie (X2:X29) ; les ' +
      'sources ne disent pas quelles entrées sont des divinités (« Pas de Dieu choisi », « Agnostique »… figurent dans les deux listes) : aucune ' +
      'classification n’est ajoutée ; le dieu inné d’une magie est dans les magies ; en lecture seule.',
    table: 'dieu',
    liste: ['id', 'nom', 'ordre_choix', 'dans_liste_magie'],
    recherche: ['nom'],
    tri: 'nom',
  },
  {
    cle: 'evenements',
    nom: 'Événement de la chronologie',
    noms: 'Événements de la chronologie',
    description:
      'Les événements de la chronologie (/chronologie/<id>/) : un fait que le Codex ou une page de race date, plus l’ouverture « Au début », les « Date ' +
      'inconnue » de la liste des Impacts et « Aujourd’hui » ; date (époque, année, année de fin d’un intervalle), titre, portée et lieu d’un Impact de la ' +
      'liste du Codex (un lieu va avec une portée) ; la frise lit par époque, année puis rang (l’ordre à date égale, posé à la création, jamais saisi) ; ' +
      'identifiant tiré une fois du titre, figé et jamais réutilisé ; créé avec un bloc de description (portée et lieu se donnent ensuite), supprimé avec ' +
      'ses blocs et ses catégories.',
    table: 'evenement',
    libelle: 'titre',
    enfants: [
      {
        cle: 'descriptions',
        nom: 'Bloc de description',
        noms: 'Blocs de description',
        table: 'evenement_extrait',
        parent: { evenement_id: 'id' },
        tri: 'rang',
        description:
          'Les blocs de description de l’événement, dans l’ordre : un texte Markdown (à l’import, un passage copié d’une page du Codex ou d’une race, ' +
          'jamais réécrit) et son lien vers une page du wiki (ou aucun) ; la date surlignée et la section de la page suivent le texte et le lien, jamais ' +
          'saisies ; un bloc ajouté prend un rang jamais employé ; le dernier bloc d’un événement ne se supprime pas.',
        // la création rend l'id « <evenement_id>#<rang> » (serveur/edition-chronologie.mjs, EVENEMENT_EXTRAIT.creer) : le rang est ce qui suit le « # »
        ecriture: { creer: 'evenement_extrait', supprimer: 'evenement_extrait', parentCreation: { evenement_id: 'id' }, cleCreee: 'rang' },
      },
      {
        cle: 'categories',
        nom: 'Catégorie de l’événement',
        noms: 'Catégories de l’événement',
        table: 'evenement_categorie',
        parent: { evenement_id: 'id' },
        tri: 'categorie_id',
        description:
          'Les catégories que porte l’événement (plusieurs au choix ; aucune : « Sans catégorie (à trier) ») ; une catégorie se pose (POST) ou se retire ' +
          '(DELETE) par l’opération `categories` du site de dev, qui réécrit la liste de l’événement.',
        operations: { POST: 'categories', DELETE: 'categories' },
      },
    ],
    liste: ['id', 'titre', 'epoque', 'annee', 'annee_fin', 'portee', 'lieu', 'rang'],
    recherche: ['titre', 'lieu'],
    tri: 'rang',
    ecriture: { creer: 'evenement', supprimer: 'evenement' },
  },
  {
    cle: 'categories-de-chronologie',
    nom: 'Catégorie de la chronologie',
    noms: 'Catégories de la chronologie',
    description:
      'Les catégories du filtre de la frise (migration 0043, demande du propriétaire) : un vocabulaire à part des mots-clés, créé sur le site de dev (aucune ' +
      'à l’import) ; identifiant tiré une fois du libellé puis figé (/chronologie/?filtre=<id>), jamais « sans-categorie » ni réutilisé ; deux catégories ' +
      'ne s’écrivent jamais de la même façon ; une catégorie supprimée est retirée de ses événements.',
    table: 'categorie_chronologie',
    libelle: 'libelle',
    liste: ['id', 'libelle', 'libelle_cle'],
    recherche: ['libelle'],
    tri: 'libelle_cle',
    ecriture: { creer: 'categorie_chronologie', supprimer: 'categorie_chronologie' },
  },
  {
    cle: 'niveaux-de-relation',
    nom: 'Niveau de relation',
    noms: 'Niveaux de relation',
    description:
      'L’échelle des cases de l’onglet « Relation entre les races » (classeur « Les races ») : de « Même peuple » à « Ennemie », dans l’ordre de l’onglet, ' +
      'du plus favorable au plus défavorable ; en lecture seule.',
    table: 'echelle_relation',
    libelle: 'libelle',
    liste: ['id', 'libelle', 'ordre'],
    recherche: ['libelle'],
    tri: 'ordre',
  },
  {
    cle: 'peuples',
    nom: 'Peuple',
    noms: 'Peuples',
    description:
      'Les peuples de l’onglet « Relation entre les races » (classeur « Les races ») : une étiquette de la matrice, recopiée telle qu’écrite (coquilles ' +
      'comprises), dans l’ordre de l’onglet, avec la race qui lui correspond (rapprochement informatif) ; un peuple créé reçoit sa case « Même peuple » face ' +
      'à lui-même, ses autres relations restent à poser ; ni modification ni suppression.',
    table: 'peuple',
    liste: ['id', 'nom', 'ordre', 'race_id'],
    recherche: ['nom'],
    tri: 'ordre',
    ecriture: { creer: 'peuple' },
  },
  {
    cle: 'relations-entre-peuples',
    nom: 'Relation entre deux peuples',
    noms: 'Relations entre peuples',
    description:
      'Les cases de la matrice « Relation entre les races » : la case (ligne A, colonne B) dit comment le peuple A voit le peuple B (décision R12 ; la ' +
      'matrice n’est pas symétrique), avec son niveau de l’échelle ; une case se pose (POST), change de niveau (PATCH) ou se retire (DELETE) par ' +
      'l’opération `relations` du site de dev ; la case d’un peuple face à lui-même (« Même peuple ») vient avec le peuple et ne change pas.',
    table: 'relation_peuple',
    libelle: 'ligne_peuple_id',
    liste: ['ligne_peuple_id', 'colonne_peuple_id', 'echelle_id'],
    recherche: ['ligne_peuple_id', 'colonne_peuple_id'],
    tri: 'ligne_peuple_id',
    operations: { POST: 'relations', PATCH: 'relations', DELETE: 'relations' },
  },
];

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {};
