// Libellés des règles de v_personnage_controle (data/schema.sql, section 13), pour la page /fiche/ : le service rend, avec chaque fiche, la liste
// des règles qu'elle enfreint (`regle`, `detail`) ; la page les dit en français. Chaque clé de la vue a son libellé (test fiche-controles).
// Sans dépendance : importé par le navigateur.

export const LIBELLES_DES_CONTROLES = Object.freeze({
  race_manquante: 'Race à choisir',
  magie_innee_manquante: 'Magie innée à choisir',
  classe_inaccessible: 'Classe que la race ne permet pas',
  classe_reservee: 'Classe réservée à une autre magie innée',
  classe_imposee: 'Classe 1 imposée par la magie innée',
  classe_exclue: 'Classe fermée à la magie innée',
  magie_innee_inaccessible: 'Magie innée que la race ne permet pas',
  magies_incompatibles: 'Magie innée et magie acquise incompatibles',
  mono_magie: 'Magie mono-magie avec une seconde magie',
  race_mono_magie: 'Magie acquise pour une race à une seule magie',
  ethnie_hors_race: 'Ethnie d’une autre race',
  ethnie_manquante: 'Ethnie à choisir',
  ethnie_magie: 'Ethnie liée à une autre magie innée',
  caracteristique_magie: 'Caractéristique de la magie innée (au choix seulement quand la magie la laisse au choix)',
  caracteristique_manquante: 'Caractéristique non renseignée',
  caracteristique_hors_bornes: 'Caractéristique hors des bornes de la race',
  caracteristiques_total: 'Total des caractéristiques différent de celui du niveau',
  competence_naturel_max: 'Points naturels au-dessus du maximum du niveau',
  competences_total: 'Total des points naturels différent de celui du niveau',
  entrainement_competences: 'Plus de 15 compétences entraînées',
  entrainement_valeur: 'Entraînement d’une compétence au-delà de 10 points',
  metier_bonus_hors_choix: 'Bonus de métier choisi qui n’est pas une option du métier',
  metier_bonus_manquant: 'Bonus de métier à choisir',
  gains_niveau: 'Gains de niveau (santé + chakra) hors du total à saisir',
  classe_2_manquante: 'Seconde classe à choisir',
  classe_2_en_trop: 'Seconde classe sans niveau',
  classe_1_manquante: 'Classe à choisir',
  specialite_trop_tot: 'Spécialité avant le niveau de classe 10',
  capacite_hors_classe: 'Don d’une autre classe ou d’une autre spécialité',
  capacites_exclusives: 'Deux dons qui s’excluent',
  sort_hors_magie: 'Sort d’une autre magie',
  sort_puissance: 'Sort au-dessus de la puissance magique',
  sort_nm_plafond: 'Plus de 3 NM sur un sort',
  sort_nm_max: 'NM au-dessus du maximum sur un sort (niveau − 1, plus les NM du MJ ; le NM d’un livre ne compte pas)',
  sorts_nm_total: 'Plus de NM que ceux gagnés par les niveaux et les dons et ceux du MJ (le NM d’un livre ne compte pas)',
  bouclier_manquant: 'Matière, amélioration ou solidité de bouclier sans sa forme',
  bouclier_matiere_manquante: 'Bouclier sans sa matière',
  bouclier_inconnu: 'Forme et matière de bouclier absentes de la liste des boucliers',
  symbiose_magie: 'Magie de la symbiose hors des magies du personnage',
  maitrise_arme_exclue: 'Maîtrise sur des armes de monstres (pas de maîtrise)',
  // maîtrises d'armes (décisions R148 à R151) : messages du cahier des charges de la refonte ; le détail nomme la source, la famille, les points
  maitrise_a_choisir: 'Maîtrise à choisir',
  maitrise_hors_choix: 'Famille de maîtrise que sa source ne propose pas',
  maitrise_meme_famille: 'Plus de points d’une source dans la même famille que sa limite',
  maitrise_plafond: 'Maîtrise au-delà du plafond de 4 points (5 dés) : les points en trop ne comptent pas',
  maitrise_source_perdue: 'Choix de maîtrise d’une source qui n’est plus valable',
  amelioration_cible: 'Amélioration d’un autre genre d’objet',
  armure_double: 'Armure de base et armure élémentaire à la fois',
  armure_manquante: 'Amélioration d’armure sans son armure',
  armure_familier: 'Armure de familier sur une fiche de personnage',
  armure_magie_absente: 'Armure élémentaire d’une magie que le personnage n’a pas',
  // décision R167 : une arme élémentaire d'une magie que le personnage n'a ni en innée ni en acquise (le Potentiel Illimité n'en ouvre aucune) ; le
  // détail nomme l'arme et son rang
  arme_elementaire_hors_magie: 'Arme élémentaire d’une magie que le personnage n’a pas (ni innée ni acquise)',
  // décision R167 (bombe : « Estoc, Frappe ou Taille au choix ») : un type physique choisi sur une arme dont le type ne se choisit pas, ou qu'elle n'offre
  // pas ; le détail : « rang : type »
  arme_type_degats_choisi: 'Type de dégâts physique choisi hors des choix de l’arme (son type ne se choisit pas, ou elle n’offre pas ce type)',
  armure_partie_hors_armure: 'Solidité d’une partie que l’armure n’a pas',
  accessoire_valeur: 'Valeur d’accessoire hors de la fourchette de son effet',
});

/** Libellé d'une règle (la clé elle-même si elle est inconnue : une règle ajoutée à la vue reste visible). */
export const libelleDuControle = (regle) => LIBELLES_DES_CONTROLES[regle] ?? regle;
