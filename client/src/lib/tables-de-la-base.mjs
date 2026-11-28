// Les tables de la base qui ne sont pas des règles, ou pas des textes à lire comme tels, chacune dans une seule liste (data/schema.sql ;
// test/tables-de-la-base.test.mjs les compare au schéma) :
//   - hors des règles (TABLES_HORS_REGLES), sections 13 à 15 : les fiches de personnages et les groupes de jeu (section 13 :
//     lib/fiche-format.mjs#TABLES_FICHES), le journal de l'édition et le brouillon de la note de version (section 14 : TABLES_DU_JOURNAL), les notes de
//     version et l'historique des modifications du site (section 15 : TABLES_DES_NOTES) — jamais modifiées par l'édition
//     (serveur/edition-journal.mjs#TABLES_INTERDITES) ;
//   - dérivées (TABLES_DERIVEES : section 11, `-- @derivee`, hors tables de recherche plein texte) : recalculées par le build depuis les autres ;
//   - les traces gardées telles quelles (TRACES_TELLES_QUELLES) : l'écriture d'une source, jamais corrigée ni réécrite (skill base-orthographe).
// Le repère d'un mot-clé (`repere`, migrations 0135 et 0136) est un texte de règles comme un autre : il porte le nom, l'adresse et la définition du
// mot-clé qui n'a ni page ni sort, et se lit donc (mentions, balises réécrites, note de version).
// Aucune n'est lue comme un texte de règles par les balises du glossaire des mots-clés (lib/mots-cles-db.mjs#textesDeLaBase : ni contrôlée par
// db:check, ni réécrite au rejeu du journal).
// Le classement en trois classes (contenu, propre au site, calculée) est en bas de ce fichier. Sans dépendance (sauf lib/fiche-format.mjs, pur).
import { TABLES_FICHES } from './fiche-format.mjs';

/**
 * Section 14 : le journal des modifications du site de dev, les lots de changements déposés et le plafond des numéros donnés (migration 0128), le
 * brouillon de la note de version, et les migrations que cette base a reçues (migration 0129, propre à chaque base) — dans l'ordre de data/schema.sql
 * (la base vivante les recopie dans cet ordre : serveur/base-vivante.mjs#TABLES_EDITION).
 */
export const TABLES_DU_JOURNAL = Object.freeze([
  'modification_lot', 'modification', 'lot_de_changements', 'numero_donne', 'note_version_brouillon', 'migration_recue',
]);

/** Section 15 : les notes de version et l'historique des modifications faites sur le site de dev (des traces qui citent la production d'avant). */
export const TABLES_DES_NOTES = Object.freeze(['note_version', 'note_version_ligne', 'historique_modification']);

/** Sections 13 à 15 : tout ce qui n'est pas une règle. */
export const TABLES_HORS_REGLES = Object.freeze([...TABLES_FICHES, ...TABLES_DU_JOURNAL, ...TABLES_DES_NOTES]);

/** Section 11 : les tables dérivées (`-- @derivee`), hors tables de recherche plein texte (FTS5). */
export const TABLES_DERIVEES = Object.freeze(['lien', 'lien_candidat']);

/**
 * Les traces de l'import gardées telles qu'écrites : notes de cellule, écarts entre sources, corrections, commentaires orphelins (empreinte de leur
 * texte), alias des pages, dictionnaire des sources.
 */
export const TRACES_TELLES_QUELLES = Object.freeze(['note_cellule', 'ecart_source', 'correction', 'commentaire_orphelin', 'alias', 'source']);

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Le classement de TOUTES les tables (lot 5 du chantier « la base du site de dev devient la source de vérité » : docs/chantier-base-de-dev.md, R274,
// garde-fou 9). Chaque table de la base est de l'une de trois classes, et une table que le classement ne connaît pas est refusée par le test
// (test/tables-de-la-base.test.mjs : ses listes sont comparées à data/schema.sql, section par section) — une migration qui ajoute une table l'ajoute
// ici, à la liste de sa classe :
//   - « contenu » : ce que le site de dev est la source de (les règles des sections 0 à 10, les notes de version et l'historique, section 15) ;
//     l'extrait pour les sessions de Claude et l'attestation de la production en recopient ou en comptent l'empreinte (serveur/extrait.mjs) ;
//   - « propre au site » : ce qu'un visiteur ou le service écrit (fiches, comptes, groupes : section 13 ; journal, brouillon de la note et migrations
//     reçues par la base : section 14) ;
//     jamais dans un extrait ni un paquet : une table de cette classe y est vide ;
//   - « calculée » : recalculée par le build depuis le contenu (tables dérivées, recherche plein texte et ses tables d'ombre, tables internes de SQLite) ;
//     hors de toute empreinte.
// ---------------------------------------------------------------------------------------------------------------------------------------------------

/** Les trois classes d'une table. */
export const CLASSES_DE_TABLES = Object.freeze({ CONTENU: 'contenu', PROPRE_AU_SITE: 'propre_au_site', CALCULEE: 'calculee' });

/** Sections 0 à 10 de data/schema.sql : les règles, le lore et leurs traces (la section 11 est calculée ; la 12 est faite de vues). */
export const TABLES_DE_REGLES = Object.freeze([
  'famille', 'type_page', 'page', 'alias', 'mot_cle', 'categorie_mot_cle', 'mot_cle_categorie', 'mot_cle_ancienne_cle', 'mot_cle_synonyme', 'repere',
  'page_ancienne_adresse', 'page_tag', 'source', 'page_source', 'page_entite', 'panneau_regles', 'panneau_regles_bloc', 'composant_onglet', 'annonce', 'regles_onglet',
  'regles_onglet_entree', 'caracteristique', 'competence', 'niveau_global', 'niveau_deblocage', 'seuil_niveau', 'regle_constante',
  'entrainement_palier', 'initiative_agilite', 'type_don', 'posture', 'posture_effet', 'posture_critique', 'magie', 'magie_role', 'magie_resistance',
  'magie_incompatibilite', 'magie_ethnie_secondaire', 'magie_dieu', 'magie_specialisation', 'sort', 'sort_type', 'sort_mode', 'sort_bonus_maitrise',
  'sort_etat', 'sort_mot_cle', 'type_degats', 'type_sort', 'commentaire_orphelin', 'legende_sort', 'regle_magie', 'magie_npm_plafond', 'resistance_palier',
  'etat', 'etat_magie', 'etat_stade', 'etat_palier', 'meteo', 'meteo_effet', 'mode_texte', 'mode_hyper_depassement', 'mode_super_objet',
  'mode_hyper_effet', 'dieu', 'evenement', 'evenement_extrait', 'categorie_chronologie', 'evenement_categorie', 'categorie_classe', 'classe',
  'specialite', 'capacite', 'objet_depart', 'classe_objet_depart', 'classe_maitrise_armure', 'classe_maitrise_arme', 'maitrise_arme_part',
  'maitrise_arme_part_famille', 'capacite_nm_gagne', 'classe_annexe', 'classe_annexe_entree', 'capacite_variable', 'capacite_npm_plafond',
  'capacite_condition_emplacements', 'race', 'race_restriction_carac', 'ethnie', 'ethnie_resistance', 'race_classe', 'race_magie', 'race_onglet',
  'race_don', 'race_don_tableau_colonne', 'race_don_tableau_ligne', 'race_don_tableau_cellule', 'race_magie_onglet', 'echelle_relation', 'peuple',
  'relation_peuple', 'invocation', 'invocation_capacite_commune', 'invocation_resistance', 'invocation_bloc', 'invocation_bloc_magie', 'creature',
  'creature_ressource', 'creature_caracteristique', 'creature_bonus_npm', 'creature_attaque', 'creature_attaque_type', 'creature_capacite',
  'creature_capacite_sort', 'creature_capacite_resistance', 'creature_effet', 'monstre_regle', 'monstre_echelle', 'monstre_butin_objet',
  'monstre_groupe', 'monstre_espece', 'monstre_espece_lieu', 'monstre_espece_bloc', 'monstre_butin', 'monstre', 'monstre_rubrique',
  'monstre_caracteristique', 'monstre_attaque', 'monstre_attaque_type', 'monstre_capacite_commune', 'monstre_capacite', 'monstre_capacite_valeur', 'monstre_defense',
  'monnaie', 'constante_equipement', 'niveau_alchimie', 'affinite', 'arme_famille', 'arme_type', 'ressource', 'materiau_arme', 'materiau_armure',
  'materiau_bouclier', 'materiau', 'gemme', 'bois', 'ingredient_alchimie', 'potion', 'potion_etat', 'kit_alchimie', 'fiole_verre', 'recette',
  'recette_produit', 'recette_ingredient', 'baton_magique', 'metier', 'metier_bonus', 'metier_recette_famille', 'metier_objet_depart', 'arme',
  'arme_degats', 'arme_prerequis', 'arme_elementaire', 'arme_elementaire_type', 'arme_elementaire_type_competence', 'arme_elementaire_type_degats',
  'armure_emplacement', 'armure', 'armure_degats', 'armure_elementaire', 'armure_elementaire_effet', 'bouclier_classe', 'bouclier_poids', 'bouclier',
  'amelioration_equipement', 'amelioration_total', 'accessoire_emplacement', 'accessoire_propriete', 'accessoire_effet', 'accessoire_effet_gemme',
  'accessoire_effet_cible', 'accessoire_monture', 'familier', 'familier_effet', 'batiment', 'machine_guerre', 'maladie', 'maladie_methode',
  'note_cellule', 'ecart_source', 'correction',
]);

/** Classe « contenu » : les règles, plus les notes de version et l'historique des modifications du site (section 15). */
export const TABLES_DE_CONTENU = Object.freeze([...TABLES_DE_REGLES, ...TABLES_DES_NOTES]);

/**
 * Classe « propre au site » : les fiches, les comptes et les groupes (section 13), le journal de l'édition, le brouillon de la note et les migrations
 * reçues par la base (section 14).
 */
export const TABLES_PROPRES_AU_SITE = Object.freeze([...TABLES_FICHES, ...TABLES_DU_JOURNAL]);

/** Les tables de recherche plein texte (FTS5, section 11) : calculées elles aussi, leurs tables d'ombre (OMBRES_DE_RECHERCHE) avec elles. */
export const TABLES_DE_RECHERCHE = Object.freeze(['page_fts', 'entite_fts']);

/** Classe « calculée » : les tables dérivées et la recherche plein texte (leurs ombres et les tables internes de SQLite sont reconnues par le nom). */
export const TABLES_CALCULEES = Object.freeze([...TABLES_DERIVEES, ...TABLES_DE_RECHERCHE]);

/** Les tables d'ombre qu'un FTS5 crée pour lui-même (<table>_data, _idx, _content, _docsize, _config). */
export const OMBRES_DE_RECHERCHE = new RegExp(`^(?:${TABLES_DE_RECHERCHE.join('|')})_(?:data|idx|content|docsize|config)$`);

const CLASSES = new Map([
  ...TABLES_DE_CONTENU.map((t) => [t, CLASSES_DE_TABLES.CONTENU]),
  ...TABLES_PROPRES_AU_SITE.map((t) => [t, CLASSES_DE_TABLES.PROPRE_AU_SITE]),
  ...TABLES_CALCULEES.map((t) => [t, CLASSES_DE_TABLES.CALCULEE]),
]);

/** La classe d'une table (CLASSES_DE_TABLES), ou null pour une table que le classement ne connaît pas : l'extrait n'en recopie jamais le contenu. */
export function classeDeLaTable(nom) {
  const classe = CLASSES.get(nom);
  if (classe) return classe;
  return OMBRES_DE_RECHERCHE.test(nom) || /^sqlite_/.test(nom) ? CLASSES_DE_TABLES.CALCULEE : null;
}

/** Les tables de `noms` que le classement ne connaît pas (triées). */
export function tablesNonClassees(noms) {
  return [...noms].filter((t) => classeDeLaTable(t) === null).sort();
}
