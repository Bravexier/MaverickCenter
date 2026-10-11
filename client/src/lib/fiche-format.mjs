// Format d'échange d'une fiche de personnage entre les pages du site et le service (client/serveur/, docs/serveur.md) : un objet JSON qui reprend
// les colonnes de la section 13 de data/schema.sql sous leur nom. Les colonnes de `personnage` sont à la racine ; chaque table de détail est une
// liste d'objets (ses colonnes, sans `personnage_id`) rangée sous sa clé de PARTIES_DE_FICHE. Rien de ce qui se calcule n'y figure (niveaux,
// santé, totaux…) : une fiche, ce sont les choix du joueur (docs/character-generator.md, « Fiches dans la base »).
// Sans dépendance : importé par le service et par le navigateur.

/** Clé du JSON → table de détail. Toute table de la section 13 qui cite `personnage` en fait partie, sauf HORS_FICHE (test serveur-fiches). */
export const PARTIES_DE_FICHE = Object.freeze({
  classes: 'personnage_classe',
  caracteristiques: 'personnage_caracteristique',
  competences: 'personnage_competence',
  metier_bonus: 'personnage_metier_bonus',
  progression: 'personnage_progression',
  capacites: 'personnage_capacite',
  sorts: 'personnage_sort',
  maitrises_armes: 'personnage_maitrise_arme',
  armes: 'personnage_arme',
  armures: 'personnage_armure',
  bouclier_materiaux: 'personnage_bouclier_materiau',
  accessoires: 'personnage_accessoire',
  inventaire: 'personnage_inventaire',
});

/** Tables qui citent une fiche sans en faire partie : le partage d'une fiche de joueur et les inscriptions dans les groupes de jeu. */
export const HORS_FICHE = Object.freeze(['personnage_partage', 'groupe_membre']);

/** Colonnes de `personnage` que fixe le service, jamais la page : identifiant, nature, propriétaire, visibilité (un prétiré : à personne, visible de tous), instants. */
export const COLONNES_DU_SERVICE = Object.freeze(['id', 'nature', 'proprietaire_id', 'visibilite', 'cree_le', 'modifie_le']);

/** Champ du JSON qui n'est pas une colonne : la version de la fiche lue, rendue à l'enregistrement (deux modifications simultanées ne s'écrasent pas). */
export const CHAMP_VERSION = 'version';

/**
 * Une fiche neuve : feuille blanche, pas une règle. Les colonnes obligatoires de `personnage` reçoivent leur valeur de départ (brouillon,
 * mono-classe, 0 XP, alignement, bourse et ambidextrie à zéro), les listes sont vides ; le reste (race, magies…) est à choisir.
 */
export function ficheVide(nom = '') {
  return {
    nom,
    statut: 'brouillon',
    mode_classe: 'mono',
    xp: 0,
    alignement_loyal: 0,
    alignement_chaotique: 0,
    alignement_bon: 0,
    alignement_mauvais: 0,
    bourse_pp: 0,
    bourse_ro: 0,
    bourse_rf: 0,
    ambidextrie: 0,
    ...Object.fromEntries(Object.keys(PARTIES_DE_FICHE).map((cle) => [cle, []])),
  };
}
