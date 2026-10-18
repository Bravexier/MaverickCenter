// Ressources de l'API REST du module « wiki » (format : lib/ressources.mjs) : la couche générique des pages (section 1 de data/schema.sql : rubriques,
// pages, alias, mots-clés, sources, liens page → entité), le registre des familles d'import (section 0), les traces de l'import (section 10 : notes de
// cellule, écarts entre sources, corrections), les liens entre pages (section 11, calculés au build) et, en lecture, les notes de version et
// l'historique des modifications du site (section 15).
//
// La table `page` est partagée par trois ressources, selon ce que le service sait écrire (lib/edition-modele.mjs#texteDePageModifiable,
// serveur/edition.mjs#PAGE) : les pages du guide et celles du Codex (titre et texte modifiables, TABLES.page), puis toutes les autres, produits de leurs
// tables, en lecture seule. La page du Codex se reconnaît à sa provenance (`source_ref`, premier libellé de `sources:`) : la description des relations
// entre les peuples est de type `lore` mais tirée du classeur « Les races », ce n'est pas une page du Codex.
//
// Les écritures sont celles que le site de dev sait déjà faire, rien de plus : le titre et le texte des pages du guide et du Codex (TABLES.page), le texte
// d'une annonce (TABLES.annonce : l'encart « Notre prochaine rencontre IRL » de la page Liens), le vocabulaire des mots-clés (TABLES.mot_cle,
// ENTITES.mot_cle : serveur/edition-chronologie.mjs, MOT_CLE) et leur fusion (l'opération du lot `fusionner_mots_cles`, ni TABLES ni ENTITES : l'action
// « fusion » d'un mot-clé). Aucune opération ne pose ni ne retire un mot-clé sur une page, ni ne
// change ses alias ou ses sources : ces tables sont en lecture seule ici.

/** Première source (et `source_ref`) des pages du Codex : la même que lib/edition-modele.mjs#SOURCE_DU_CODEX (tools/docs/codex.py). */
const SOURCE_DU_CODEX = 'Google Doc « CODEX Maverick »';

export const RESSOURCES = [
  {
    cle: 'pages-du-guide',
    nom: 'Page du guide',
    noms: 'Pages du guide',
    description:
      'Les pages de la rubrique « guide », rangées par le plan du site (lib/livres.mjs) : « Découvrir » (/decouvrir/…, une page par entrée du menu), ' +
      '« Les bases » (/regles/<slug>/, un sommaire à /regles/), le Guide du MJ (/mj/…) et les Règles avancées (/regles/avancees/…), toutes les autres ' +
      'pages de référence (Google Docs « Règle du jeu/Guide pour MJ » et « Créer sa fiche de ' +
      'personnage », et six pages tirées des classeurs : altérations d’état, météo, modes hyper et super, statistiques) ; le titre et le texte (Markdown) ' +
      'se modifient par le service : ni HTML brut ni lien non sûr ajouté, blocs <!-- guide:… --> connus seulement, un titre qui est déjà le nom d’une ' +
      'autre page refusé (409), l’ancien titre devient un alias ; l’identifiant <type>/<slug> et l’adresse ne changent jamais ; le résumé ne se ' +
      'modifie pas ; ni création ni suppression.',
    table: 'page',
    condition: { type: ['guide'] },
    libelle: 'titre',
    liste: ['id', 'titre', 'resume', 'origine', 'statut', 'source_ref'],
    recherche: ['titre', 'resume'],
    tri: 'titre_cle',
  },
  {
    cle: 'pages-du-codex',
    nom: 'Page du Codex',
    noms: 'Pages du Codex',
    description:
      'Les pages du Codex (rubrique « lore » tirée du Google Doc « CODEX Maverick », copie du propriétaire) : une par divinité, temple ou guilde, nation ' +
      'ou région, objet légendaire, plus les sommaires (lore/codex, lore/les-divinites…) ; texte copié du document, jamais réécrit à l’import, sauf les ' +
      'corrections du registre (décision R21 « Eaunoire ») ; le titre et le texte se modifient comme ceux du guide (mêmes refus, l’ancien titre en ' +
      'alias) ; le résumé (première phrase) ne se modifie pas ; ni création ni suppression ; la description des relations entre les peuples (lore, ' +
      'tirée du classeur « Les races ») n’en fait pas partie.',
    table: 'page',
    condition: { type: ['lore'], source_ref: [SOURCE_DU_CODEX] },
    libelle: 'titre',
    liste: ['id', 'titre', 'resume', 'statut'],
    recherche: ['titre', 'resume'],
    tri: 'titre_cle',
  },
  {
    cle: 'pages',
    nom: 'Page du wiki',
    noms: 'Pages du wiki',
    description:
      'Les autres pages du wiki (races, classes, dons de classe, magies, bestiaire, ressources, métiers, description des relations entre les peuples, ' +
      'pages d’exemple hors du guide — celle du guide est dans pages-du-guide, modifiable comme les autres), à l’adresse /<type>/<slug>/ (un métier : ' +
      'sa ligne de /metiers/) : leur texte ne se modifie pas par le service ; le corps et le ' +
      'résumé des pages typées sont produits depuis leurs tables (lib/corps-*.mjs) et refaits quand l’entité change ; une page se crée ou se supprime ' +
      'avec son entité (métier, race, classe, don…), par la ressource de cette entité : en lecture seule ici.',
    table: 'page',
    condition: { type: { sauf: ['guide'] }, source_ref: { sauf: [SOURCE_DU_CODEX] } },
    libelle: 'titre',
    liste: ['id', 'type', 'titre', 'resume', 'origine', 'statut'],
    recherche: ['titre', 'resume'],
    tri: 'titre_cle',
    lectureSeule: true,
  },
  {
    cle: 'annonces',
    nom: 'Annonce',
    noms: 'Annonces',
    description:
      'Les annonces que le site place (migration 0068, demande du propriétaire du 2026-10-18) : aujourd’hui l’encart « Notre prochaine rencontre IRL » ' +
      'de la page Liens (/decouvrir/liens/, ligne « prochaine-rencontre-irl »), dont le titre et le texte d’attente sont fixes ; le texte (Markdown, ' +
      'balises du glossaire comprises) se modifie par le service comme celui d’une page du guide : ni HTML brut ni lien non sûr ajouté ; vidé, NULL ' +
      '(« Aucune rencontre annoncée pour le moment. » s’affiche) ; ni création ni suppression.',
    table: 'annonce',
    libelle: 'id',
    liste: ['id', 'texte'],
    recherche: ['id', 'texte'],
    tri: 'id',
  },
  {
    cle: 'alias-des-pages',
    nom: 'Alias d’une page',
    noms: 'Alias des pages',
    description:
      'Les autres noms d’une page utilisables dans un [[lien]] (frontmatter `aliases`), dans l’ordre de la page : `texte` garde l’écriture, `cle` ' +
      '(normalize du texte) sert à retrouver la page (vue cle_page) ; quand le titre d’une page du guide ou du Codex change, le service ajoute l’ancien ' +
      'titre en alias ; en lecture seule.',
    table: 'alias',
    libelle: 'texte',
    liste: ['page_id', 'ordre', 'texte', 'cle'],
    recherche: ['texte', 'cle'],
    tri: 'page_id',
  },
  {
    cle: 'mots-cles',
    nom: 'Mot-clé',
    noms: 'Mots-clés',
    description:
      'Le glossaire des mots-clés (migrations 0043 et 0056, demandes du propriétaire) : un libellé et une définition (`description`, NULL tant qu’il ' +
      'n’est pas décrit), cités dans les textes par une balise (« {{id}} », « {{id|texte}} », « {{id:}} » : enregistrée sous sa forme canonique, l’id ' +
      'seul dans un texte mis en forme, « {{id|texte}} » toujours dans un texte de case, où le mode complet est refusé ; une balise qui ne cite aucun ' +
      'mot-clé, ou dont la ref est à la fois l’id d’un mot-clé et l’écriture d’un autre, refusée en 400), posés sur quelques pages et listés sur ' +
      '/recherche/ (?mot-cle=<id>) : ' +
      'identifiant tiré une fois du libellé (normalize, suffixé -2… s’il est pris ou a déjà servi), figé et jamais réutilisé ; deux mots-clés ne ' +
      's’écrivent jamais de la même façon (`libelle_cle`) ; renommer ne réécrit aucun texte (une case garde le texte écrit de ses balises, un texte mis ' +
      'en forme montre le nouveau libellé), vers l’écriture d’un autre mot-clé : refusé (409, avec ' +
      'l’action qui fusionne les deux) ; la fusion (action « fusion », opération `fusionner_mots_cles`) verse ses pages dans l’autre mot-clé (une page ' +
      'qui avait les deux perd seulement l’ancien) et y recible ses balises, puis le retire du vocabulaire ; un mot-clé créé n’a pas de page ; supprimé, ' +
      'il est retiré de toutes les pages qui le portent et de tous les textes qui le citent (sa balise devient son texte simple) ; ceux dont le site se sert pour ranger ses pages (catégories de /classes/, « classe », « race », « race hybride », « capacité ' +
      'de classe », « métier », « codex ») et « Sort grenade », dont la fiche se sert (décision R114), ne se renomment, ne se suppriment ni ne se ' +
      'créent seuls (409), leur définition se modifie ; un mot-clé qui étiquette un sort (sous-ressource `mots-cles` des sorts, migration 0067) ne ' +
      'se supprime ni ne se fusionne (409).',
    table: 'mot_cle',
    libelle: 'libelle',
    enfants: [
      {
        cle: 'pages',
        nom: 'Page du mot-clé',
        noms: 'Pages du mot-clé',
        table: 'page_tag',
        parent: { tag_id: 'id' },
        tri: 'page_id',
        description:
          'Les pages qui portent le mot-clé, avec son rang dans leur liste `tags:` (un mot-clé supprimé laisse un trou : l’ordre des autres ne change ' +
          'pas) ; aucune opération du site ne pose ni ne retire un mot-clé sur une page : en lecture seule.',
      },
    ],
    liste: ['id', 'libelle', 'libelle_cle', 'description'],
    recherche: ['libelle', 'description'],
    tri: 'libelle_cle',
    ecriture: { creer: 'mot_cle', supprimer: 'mot_cle' },
    actions: [
      {
        cle: 'fusion',
        nom: 'Fusionner dans un autre mot-clé',
        description:
          'Le mot-clé rejoint `dans` (l’identifiant d’un autre mot-clé) : ses pages passent à `dans` (une page qui avait les deux perd seulement ' +
          'l’ancien), puis il quitte le vocabulaire ; ni l’un ni l’autre ne peut être un mot-clé dont le site se sert ou qui étiquette un sort (409).',
        op: 'fusionner_mots_cles',
      },
    ],
  },
  {
    cle: 'sources',
    nom: 'Source',
    noms: 'Sources',
    description:
      'Les sources citées par les pages (une entrée exacte de `sources:`) : une URL ou un libellé (« Google Sheet « Invocation », onglet « Appel aux ' +
      'golems » ») ; genre, identifiant Google, fichier et onglets ne sont que des extraits mécaniques du texte, jamais une interprétation, et ' +
      'l’appariement libellé ↔ URL n’est pas déduit ; identifiant tiré du texte (google-doc:, google-sheet:, url:, ref:) ; une source qu’aucune page ne ' +
      'cite plus est retirée ; en lecture seule.',
    table: 'source',
    libelle: 'texte',
    enfants: [
      {
        cle: 'pages',
        nom: 'Page qui cite la source',
        noms: 'Pages qui citent la source',
        table: 'page_source',
        parent: { source_id: 'id' },
        tri: 'page_id',
        description:
          'Les pages qui citent la source, avec son rang dans leur liste `sources:` (le rang 0 est la provenance de la page : `source_ref` et famille ' +
          'd’import) ; en lecture seule.',
      },
    ],
    liste: ['id', 'nature', 'texte', 'genre', 'google_id', 'fichier'],
    recherche: ['texte', 'fichier'],
    tri: 'texte',
  },
  {
    cle: 'entites-des-pages',
    nom: 'Entité d’une page',
    noms: 'Entités des pages',
    description:
      'Le lien d’une page à une entité typée (traçabilité, table page_entite) : principale = 1 quand la page est cette entité (même identifiant), 0 ' +
      'quand elle la contient (sous-entité « <page>#<sorte>:<slug> ») ; écrit par les importeurs et par le service à la création d’une entité, contrôlé ' +
      'par db:check ; il suit l’entité et ne se modifie jamais seul : en lecture seule.',
    table: 'page_entite',
    libelle: 'entite_id',
    liste: ['entite_table', 'entite_id', 'page_id', 'principale', 'origine'],
    recherche: ['entite_id', 'page_id'],
    tri: 'page_id',
  },
  {
    cle: 'types-de-page',
    nom: 'Rubrique du wiki',
    noms: 'Rubriques du wiki',
    description:
      'Les rubriques (types) du wiki, miroir de client/src/lib/types.mjs contrôlé par db:check : la clé est le dossier de la page (races, classes, ' +
      'capacites, magies, bestiaire, ressources, metiers, guide, lore, cartes), avec son libellé, son singulier, le salon Discord source et sa phrase ' +
      'd’accueil, dans l’ordre d’affichage ; en ajouter une est un changement de code (routes, menu, migration) : en lecture seule.',
    table: 'type_page',
    libelle: 'libelle',
    liste: ['id', 'libelle', 'singulier', 'salon_discord', 'ordre'],
    recherche: ['libelle', 'singulier'],
    tri: 'ordre',
  },
  {
    cle: 'familles',
    nom: 'Famille d’import',
    noms: 'Familles d’import',
    description:
      'Le registre des importeurs : toute ligne importée porte `origine` = l’identifiant d’une famille (« supprime et réimporte cette famille ») ; ' +
      'le script qui l’écrit (vide pour une saisie directe : docs, exemple), les classeurs ou documents d’origine, et le rang de livraison des ' +
      'importeurs (pas un ordre de dépendance) ; en lecture seule.',
    table: 'famille',
    libelle: 'libelle',
    liste: ['id', 'libelle', 'importeur', 'ordre'],
    recherche: ['libelle', 'id'],
    tri: 'ordre',
  },
  {
    cle: 'notes-de-cellule',
    nom: 'Note de cellule',
    noms: 'Notes de cellule',
    description:
      'Les notes et commentaires de cellule des classeurs, rattachés à l’entité qu’ils commentent (table et identifiant de l’entité, sans clé ' +
      'étrangère : db:check vérifie qu’elle existe) : note héritée, commentaire, résolu ou non, réponse dans un fil, trace de fermeture ; trace de ' +
      'l’import, jamais lue par les pages : la valeur affichée et modifiable est la colonne `remarque` de l’entité ; effacées avec l’entité supprimée ; ' +
      'en lecture seule.',
    table: 'note_cellule',
    libelle: 'texte',
    liste: ['entite_table', 'entite_id', 'rang', 'champ', 'cellule', 'nature', 'source_ref'],
    recherche: ['texte', 'entite_id'],
    tri: 'entite_id',
  },
  {
    cle: 'ecarts-de-sources',
    nom: 'Écart entre sources',
    noms: 'Écarts entre sources',
    description:
      'Les écarts constatés entre deux sources, ou les anomalies d’une source (coquille, prix incohérent, forme non reconnue…), calculés par ' +
      'l’importeur, jamais saisis : aucune correction n’est appliquée, la valeur retenue (source_a) reste dans l’entité, l’autre (source_b) est ici avec ' +
      'sa source ; identifiant = entite_table:entite_id:champ:nature:source_a[:source_b] ; en lecture seule.',
    table: 'ecart_source',
    libelle: 'detail',
    liste: ['id', 'entite_table', 'entite_id', 'champ', 'nature', 'source_a', 'source_b'],
    recherche: ['detail', 'entite_id'],
    tri: 'id',
  },
  {
    cle: 'corrections',
    nom: 'Correction de coquille',
    noms: 'Corrections de coquilles',
    description:
      'Les corrections de coquilles et de fautes appliquées aux classeurs avant leur import : trace miroir du registre versionné ' +
      'tools/sheets/corrections.json (la source), remplie par l’importeur de la famille qui lit le classeur, jamais saisie à la main ; le texte exact de ' +
      'la source (avant), le texte retenu (après), la nature et la raison ; une correction n’est jamais une règle (chiffres, dés et signes identiques) ; ' +
      'en lecture seule.',
    table: 'correction',
    libelle: 'avant',
    liste: ['dump', 'classeur', 'onglet', 'cellule', 'champ', 'avant', 'apres', 'nature'],
    recherche: ['avant', 'apres'],
    tri: 'source_ref',
  },
  {
    cle: 'liens',
    nom: 'Lien entre pages',
    noms: 'Liens entre pages',
    description:
      'Chaque [[lien]] écrit dans le corps d’une page, dans l’ordre du texte : la cible écrite, le texte affiché, son état (résolu, introuvable, ' +
      'ambigu) et la page visée quand il est résolu (les pages candidates d’un lien ambigu en détail) ; table calculée au build (db-derive.mjs), jamais ' +
      'par le service : sur le site de dev, l’état du dernier build ; en lecture seule.',
    table: 'lien',
    libelle: 'cible',
    derivees: [{ table: 'lien_candidat', parent: { page_id: 'page_id', position: 'position' } }],
    liste: ['page_id', 'position', 'cible', 'ancre', 'etat', 'cible_page_id'],
    recherche: ['cible', 'ancre'],
    tri: 'page_id',
  },
  {
    cle: 'notes-de-version',
    nom: 'Note de version',
    noms: 'Notes de version',
    description:
      'Ce que chaque version livrée (dev → master) a changé dans les règles (page /mise-a-jour/) : la version X.Y, sa date, la version de production ' +
      'd’où part la liste, le champ libre des admins et le lot figé qui l’a produite, avec la liste calculée en détail ; écrites par le processus ' +
      '« Effectuer la mise à jour », jamais par l’API : en lecture seule.',
    table: 'note_version',
    libelle: 'version',
    enfants: [
      {
        cle: 'lignes',
        nom: 'Ligne de la note de version',
        noms: 'Lignes de la note de version',
        table: 'note_version_ligne',
        parent: { version: 'version' },
        tri: 'rang',
        description:
          'La liste calculée de la note, dans l’ordre d’affichage : une modification d’un champ d’une entité entre la production et la nouvelle ' +
          'version (domaine, groupe et entité qui la nomment, champ, avant, après), sa couleur d’après les critères du propriétaire (décision R29) et la ' +
          'ligne de la base d’où elle vient ; en lecture seule.',
      },
    ],
    liste: ['version', 'publiee_le', 'depuis', 'lot', 'exemple'],
    recherche: ['version', 'texte'],
    tri: '-publiee_le',
  },
  {
    cle: 'historique',
    nom: 'Modification livrée',
    noms: 'Historique des modifications',
    description:
      'Le journal du site de dev une fois livré : une ligne par ligne de table touchée (table, clé, opération, valeurs avant et après), avec le résumé ' +
      'et l’instant de son lot et la version qui l’a livrée (vide : rapatriée à la main) ; les tests qui vérifient l’import s’en servent pour ne plus ' +
      'contrôler ce que le site a modifié ; écrit par la mise à jour, jamais par l’API : en lecture seule.',
    table: 'historique_modification',
    libelle: 'resume',
    liste: ['lot_id', 'rang', 'fait_le', 'version', 'table_nom', 'operation', 'resume'],
    recherche: ['resume', 'table_nom'],
    tri: '-fait_le',
  },
];

const FICHES = 'servie par /api/personnages/ (serveur/fiches.mjs) ou à venir avec les comptes (connexion Discord, E7), jamais par /api/v1/ : section 13, ' +
  'vide dans data/rows, vit dans la base vivante du service (db/), dans TABLES_INTERDITES du journal';
const JOURNAL = 'journal de l’édition du site de dev (section 14), servi par /api/edition/ : vide dans data/rows, dans TABLES_INTERDITES du journal';

/** Tables de ce module qui ne sont pas des éléments de l'API, avec la raison. */
export const HORS_RESSOURCE = {
  utilisateur: `Compte utilisateur (identifiant Discord, nom affiché) : ${FICHES} ; aucun code ne le remplit encore.`,
  utilisateur_role: `Rôles cumulables d’un compte (mj, editeur, admin), tirés d’une configuration des rôles Discord : ${FICHES}.`,
  personnage: `Fiche de personnage (prétiré ou fiche de joueur, ses choix seulement) : ${FICHES}.`,
  personnage_partage: `Partage d’une fiche de joueur avec des utilisateurs désignés (hors du JSON d’une fiche) : ${FICHES}.`,
  personnage_classe: `Classes d’une fiche (partie de la fiche) : ${FICHES}.`,
  personnage_caracteristique: `Caractéristiques de base et croix d’une fiche (partie de la fiche, R19) : ${FICHES}.`,
  personnage_competence: `Points de compétences d’une fiche, le naturel (partie de la fiche ; l’acquis se calcule, R104) : ${FICHES}.`,
  personnage_entrainement: `Lignes de l’entraînement d’une fiche, une compétence et ses points ou un texte libre (partie de la fiche, R104) : ${FICHES}.`,
  personnage_acquis_choix: `Choix d’acquis des dons d’une fiche, « X ou Y » ou « à répartir au choix » (partie de la fiche, R104) : ${FICHES}.`,
  personnage_metier_bonus: `Choix d’un rang de bonus de métier à plusieurs compétences (partie de la fiche) : ${FICHES}.`,
  personnage_capacite: `Dons à choix d’une fiche (partie de la fiche) : ${FICHES}.`,
  personnage_sort: `Sorts d’une fiche et leurs NM (partie de la fiche, R24, R26) : ${FICHES}.`,
  personnage_maitrise_arme: `Maîtrises d’armes d’une fiche (partie de la fiche) : ${FICHES}.`,
  personnage_arme: `Armes d’une fiche (partie de la fiche) : ${FICHES}.`,
  personnage_armure_partie: `Solidité du moment des parties de l’armure d’une fiche (partie de la fiche ; décision R95) : ${FICHES}.`,
  personnage_accessoire: `Accessoires d’une fiche et leurs choix (partie de la fiche, R54, R97) : ${FICHES}.`,
  personnage_inventaire: `Inventaire d’une fiche (partie de la fiche, R60) : ${FICHES}.`,
  personnage_ceinture: `Ceinture d’une fiche, trois emplacements (partie de la fiche) : ${FICHES}.`,
  groupe: `Groupe de jeu (one-shot, campagne) : ${FICHES} ; dépend des comptes, aucun code ne le remplit encore.`,
  groupe_membre: `Membres d’un groupe de jeu et la fiche que chacun y inscrit : ${FICHES}.`,
  modification_lot: `Un enregistrement fait depuis une page du site de dev (lot atomique) : ${JOURNAL}.`,
  modification: `Une ligne de table touchée par un lot, avec ses valeurs avant et après et son état (en attente, intégrée, conflit) : ${JOURNAL}.`,
  note_version_brouillon:
    'Note de version en préparation (champ libre des admins sur /mise-a-jour/, une seule ligne, section 14) : servie et écrite par /api/mise-a-jour/ ' +
    '(serveur/notes-de-version.mjs), vide dans data/rows, dans TABLES_INTERDITES du journal.',
};
