// Libellés des règles de v_personnage_controle (data/schema.sql, section 13), pour la page /fiche/ : le service rend, avec chaque fiche, la liste
// des règles qu'elle enfreint (`regle`, `detail`) ; la page les dit en français. Chaque clé de la vue a son libellé (test fiche-controles).
// Sans dépendance : importé par le navigateur.

export const LIBELLES_DES_CONTROLES = Object.freeze({
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
  competence_acquis_max: 'Points acquis au-dessus de 5 par point de caractéristique',
  progression_niveau_non_atteint: 'Gain d’un niveau pas encore atteint',
  progression_manquante: 'Gain de niveau manquant',
  progression_points: 'Points d’attributs du niveau (santé + chakra) différents du gain du niveau',
  progression_de: 'Dé bonus noté à un niveau qui n’en donne pas, ou manquant',
  classe_2_manquante: 'Seconde classe à choisir',
  classe_2_en_trop: 'Seconde classe sans niveau',
  classe_1_manquante: 'Classe à choisir',
  specialite_trop_tot: 'Spécialité avant le niveau de classe 10',
  capacite_hors_classe: 'Don d’une autre classe ou d’une autre spécialité',
  capacites_exclusives: 'Deux dons qui s’excluent',
  sort_hors_magie: 'Sort d’une autre magie',
  sort_puissance: 'Sort au-dessus de la puissance magique',
  sort_nm_plafond: 'Plus de 3 NM sur un sort',
  sort_nm_max: 'NM de niveau au-dessus du maximum (niveau − 1)',
  sorts_nm_total: 'Plus de NM de niveau que ceux gagnés (les autres viennent d’un livre ou du MJ)',
  bouclier_quantite: 'Matériaux du bouclier au-delà de sa classe',
  amelioration_cible: 'Amélioration d’un autre genre d’objet',
  accessoire_valeur: 'Valeur d’accessoire hors de la fourchette de son effet',
});

/** Libellé d'une règle (la clé elle-même si elle est inconnue : une règle ajoutée à la vue reste visible). */
export const libelleDuControle = (regle) => LIBELLES_DES_CONTROLES[regle] ?? regle;
