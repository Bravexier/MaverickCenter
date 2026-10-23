// Les noms d'affichage des tables et des colonnes de la base, en français : le seul registre (demande du propriétaire du 2026-10-23 sur la section
// « Lignes en conflit » de la page « Mise à jour », où « metier_bonus » et « alias » ressortaient sous leur nom technique : « Un vrai nom serai
// mieux » ; docs/serveur.md, « Conflits du journal »).
//   - Ce qu'il nomme : toute table qu'un lot du journal de l'édition peut porter (modification.table_nom : les tables de lib/edition-modele.mjs#TABLES
//     et celles que le service écrit par dérivation, création ou suppression — tables de détail, pages, étiquettes, relations…), chaque colonne de ces
//     tables, les tables qu'elles citent par une clé étrangère (avec les colonnes de leur clé), et celles qui les citent (une suppression du lot peut
//     y rompre une référence : edition-journal.mjs#rompuesDuLot nomme alors la table qui cite, fiches de personnage comprises, avec les colonnes d'une
//     clé composée) ; test/libelles-de-la-base.test.mjs le prouve contre data/schema.sql et le code de l'édition (serveur/edition*.mjs).
//   - Les noms des tables hors de TABLES sont ceux du registre de l'API REST (lib/ressources/*.mjs, champ `nom`) quand il en a un, sauf les écarts que
//     le test épingle avec leur raison (un nom de l'API dit du côté du parent, « Page du mot-clé », ou trop court hors de sa ressource, « Sort cité »).
//   - D'où viennent les noms : d'abord le libellé de TABLES quand il existe (table ou champ : un seul endroit à changer), puis NOMS_DES_TABLES et
//     NOMS_DES_COLONNES (colonne d'une table), enfin COLONNES_COMMUNES (le même nom dans toutes les tables : identifiant, remarque, clés étrangères…).
//     Le vocabulaire est celui du site (titres des pages, en-têtes des tableaux, commentaires du schéma) ; aucun nom ne tranche une règle.
//   - Ce qui ne s'affiche pas (colonneMasquee) : les clés normalisées tirées d'une autre colonne (`X_cle`, `alias.cle`) et la provenance (`origine`,
//     `source_ref` : retirée à la 1.0, décision du propriétaire). Une raison qui cite une clé normalisée la dit par sa colonne source (colonneSource).
//   - Ce qu'il ne fait JAMAIS : rendre une colonne modifiable. TABLES reste la seule liste de ce que l'édition accepte (serveur/edition.mjs) ; ce
//     module ne fait que nommer, et lib/edition-modele.mjs ne l'importe pas.
// Seuls les NOMS changent : les identifiants et les valeurs restent tels quels. Pur, sans dépendance (sauf lib/edition-modele.mjs, pur) : le service
// l'emploie (serveur/edition-conflits.mjs) ; un script de page ne l'importe pas (il importerait TABLES : skill site-version-portable).
import { TABLES } from './edition-modele.mjs';

/** Le nom des tables qui n'ont pas de libellé dans TABLES : les tables écrites par l'édition hors du modèle, puis celles qu'elles citent. */
export const NOMS_DES_TABLES = Object.freeze({
  // pages, mots-clés, sources (section 1)
  alias: 'Autre nom de la page',
  page_entite: 'Entité d’une page',
  page_source: 'Source de la page',
  page_tag: 'Mot-clé de la page',
  source: 'Source',
  // magies et sorts (section 3)
  sort_bonus_maitrise: 'Bonus de maîtrise du sort',
  sort_etat: 'Altération d’état citée par le sort',
  sort_mode: 'Mode du sort',
  sort_type: 'Type du sort',
  // chronologie (section 5 bis)
  evenement_categorie: 'Catégorie de l’événement',
  // classes (section 6)
  classe_annexe: 'Tableau annexe de la classe',
  classe_maitrise_arme: 'Maîtrise d’arme de la classe',
  classe_maitrise_armure: 'Maîtrise d’armure de la classe',
  classe_objet_depart: 'Objet de départ de la classe',
  // sources de maîtrise d'arme (section 6, migration 0076 : R148 à R151, R154), refaites par le lecteur lib/maitrise-arme.mjs (serveur/edition-maitrises.mjs)
  maitrise_arme_part: 'Part de maîtrise d’arme',
  maitrise_arme_part_famille: 'Option de la part de maîtrise d’arme',
  capacite_nm_gagne: 'NM de sorts gagnés par le don',
  // races (section 7)
  peuple: 'Peuple',
  race_classe: 'Accessibilité de classe',
  race_magie: 'Accessibilité de magie',
  race_magie_onglet: 'Magie innée de l’onglet de la race',
  relation_peuple: 'Relation entre deux peuples',
  // bestiaire (sections 8 et 8 bis)
  creature_effet: 'Effet de créature',
  monstre_attaque: 'Attaque de la carte',
  monstre_caracteristique: 'Caractéristique de la carte',
  monstre_defense: 'Défense de la carte',
  monstre_espece_lieu: 'Lieu de rencontre de l’espèce',
  // équipement, composants, métiers (section 9)
  affinite: 'Affinité',
  amelioration_total: 'Total des améliorations',
  arme_degats: 'Type de dégâts de l’arme',
  arme_prerequis: 'Minimum de caractéristique de l’arme',
  armure_degats: 'Résistance ou faiblesse de l’armure',
  bois: 'Bois',
  materiau_armure: 'Matériau d’armure',
  metier_bonus: 'Bonus du métier',
  metier_objet_depart: 'Objet de départ du métier',
  metier_recette_famille: 'Famille de recettes du métier',
  potion_etat: 'Altération d’état de la potion',
  // notes de cellule et écarts (section 10)
  ecart_source: 'Écart entre sources',
  note_cellule: 'Note de cellule',
  // les tables citées par une clé étrangère des tables ci-dessus et de TABLES (jamais écrites par l'édition)
  arme_famille: 'Famille d’armes',
  arme_type: 'Type d’arme',
  caracteristique: 'Caractéristique',
  categorie_classe: 'Catégorie de classe',
  competence: 'Compétence',
  creature: 'Créature invoquée',
  echelle_relation: 'Niveau de relation',
  etat: 'Altération d’état',
  ethnie: 'Ethnie',
  famille: 'Famille d’import',
  niveau_alchimie: 'Niveau d’alchimie',
  objet_depart: 'Objet de départ',
  race_don_tableau_ligne: 'Ligne du tableau des dons',
  type_page: 'Rubrique du wiki',
  // les tables qui citent une table écrite par l'édition (jamais écrites par elle : une suppression du lot peut y rompre une référence)
  accessoire_effet_gemme: 'Gemme de l’effet d’accessoire',
  accessoire_monture: 'Monture d’accessoire',
  amelioration_cadaverique: 'Amélioration cadavérique',
  arme_elementaire: 'Arme élémentaire',
  armure_elementaire: 'Armure élémentaire',
  baton_magique: 'Bâton magique',
  constante_equipement: 'Constante d’équipement',
  creature_attaque_type: 'Type de dégâts d’une attaque de créature',
  creature_capacite_resistance: 'Résistance d’une capacité de créature',
  creature_capacite_sort: 'Sort cité par une capacité de créature',
  etat_magie: 'Magie liée à l’altération d’état',
  ethnie_resistance: 'Résistance d’ethnie',
  invocation: 'Invocation',
  invocation_bloc_magie: 'Magie du bloc d’invocation',
  invocation_resistance: 'Résistance d’une capacité commune',
  kit_alchimie: 'Kit d’alchimie',
  lien: 'Lien entre pages',
  lien_candidat: 'Page candidate d’un lien',
  magie_dieu: 'Dieu de la magie',
  magie_ethnie_secondaire: 'Ethnie à magie secondaire',
  magie_incompatibilite: 'Incompatibilité de magie',
  magie_resistance: 'Résistance ou vulnérabilité de magie',
  materiau_bouclier: 'Matériau de bouclier',
  meteo_effet: 'Effet de météo',
  mode_texte: 'Texte d’explication des modes',
  race_restriction_carac: 'Restriction de caractéristique',
  recette: 'Recette',
  recette_ingredient: 'Élément de recette',
  recette_produit: 'Produit de recette',
  regle_constante: 'Constante de règle',
  sort_mot_cle: 'Étiquette du sort',
  // les fiches de personnage (section 13) qui citent une table écrite : jamais écrites par l'édition des règles
  personnage: 'Fiche de personnage',
  personnage_arme: 'Arme du personnage',
  personnage_armure_partie: 'Partie d’armure du personnage',
  personnage_capacite: 'Don de classe choisi du personnage',
  personnage_ceinture: 'Objet de la ceinture du personnage',
  personnage_classe: 'Classe du personnage',
  personnage_inventaire: 'Objet de l’inventaire du personnage',
  personnage_resistance_choix: 'Résistance choisie du personnage',
  personnage_sort: 'Sort du personnage',
});

/** Le nom d'une colonne qui garde le même sens dans toutes les tables (une clé étrangère : la table citée). */
export const COLONNES_COMMUNES = Object.freeze({
  id: 'Identifiant',
  nom: 'Nom',
  titre: 'Titre',
  libelle: 'Libellé',
  texte: 'Texte',
  description: 'Description',
  remarque: 'Remarque',
  ordre: 'Ordre',
  rang: 'Rang',
  option: 'Option',
  type: 'Type',
  genre: 'Genre',
  nature: 'Nature',
  categorie: 'Catégorie',
  famille: 'Famille',
  section: 'Section',
  champ: 'Champ',
  cible: 'Cible',
  valeur: 'Valeur',
  niveau: 'Niveau',
  prix: 'Prix',
  prix_brut: 'Prix (tel qu’écrit)',
  prix_rf: 'Prix en RF',
  nom_brut: 'Nom (tel qu’écrit)',
  categorie_brut: 'Catégorie (telle qu’écrite)',
  valeur_brut: 'Valeur (telle qu’écrite)',
  stats_brut: 'AP et AM (tels qu’écrits)',
  accessible: 'Accessible',
  sante: 'Santé',
  chakra: 'Chakra',
  barriere: 'Barrière',
  ap: 'AP',
  am: 'AM',
  solidite: 'Solidité',
  vitesse_nage: 'Vitesse de nage',
  ep_min: 'Échelle de puissance minimale',
  ep_max: 'Échelle de puissance maximale',
  bonus_degats: 'Bonus de dégâts',
  type_degats: 'Type de dégâts',
  entite_table: 'Table de l’entité',
  entite_id: 'Entité',
  // clés étrangères : le nom de la table citée
  affinite_id: 'Affinité',
  arme_famille_id: 'Famille d’armes',
  arme_id: 'Arme',
  armure_id: 'Armure',
  caracteristique_id: 'Caractéristique',
  categorie_id: 'Catégorie',
  classe_id: 'Classe',
  competence_id: 'Compétence',
  creature_id: 'Créature',
  espece_id: 'Espèce de monstre',
  etat_id: 'Altération d’état',
  ethnie_id: 'Ethnie',
  evenement_id: 'Événement',
  groupe_id: 'Groupe d’espèces',
  magie_id: 'Magie',
  magie2_id: 'Seconde magie',
  materiau_id: 'Matériau',
  metier_id: 'Métier',
  monstre_id: 'Monstre',
  objet_depart_id: 'Objet de départ',
  page_id: 'Page',
  panneau_id: 'Panneau de règles',
  race_id: 'Race',
  ressource_id: 'Composant',
  sort_id: 'Sort',
  source_id: 'Source',
  specialite_id: 'Spécialité',
  tag_id: 'Mot-clé',
});

/** Un registre à deux niveaux, gelé en entier. */
const geler = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

/** Le nom des colonnes propres à une table (sans libellé dans TABLES, ou dont le nom commun ne dit pas assez). */
export const NOMS_DES_COLONNES = geler({
  affinite: { libelle: 'Affinité', nb_composantes: 'Nombre de composantes' },
  alias: { texte: 'Autre nom' },
  amelioration_equipement: {
    cible: 'Équipement', niveau: 'Niveau d’amélioration', cout_gemmes: 'Coût en gemmes', cout_gemmes_qualite: 'Qualité des gemmes',
    cout_pieces_elementaires: 'Coût en pièces élémentaires', bonus_am: 'AM supplémentaire',
  },
  amelioration_total: { cible: 'Équipement', total_brut: 'Total (tel qu’écrit)' },
  arme: {
    famille_id: 'Famille d’armes', cout_ro: 'Coût en RO', de: 'Dé', de_faces: 'Faces du dé', de_source: 'Source du dé', portee_min: 'Portée minimale',
    portee_max: 'Portée maximale', ignore_ap: 'AP ignorée', recharge: 'Recharge', solidite_fixee: 'Solidité fixée (crans)',
    solidite_delta: 'Crans de solidité en plus ou en moins', provenance_mot: 'Provenance (telle qu’écrite)', provenance: 'Provenance',
  },
  arme_prerequis: { minimum: 'Minimum', exigence: 'Exigence' },
  armure: { sorte: 'Sorte d’armure', materiau_ligne_id: 'Matière de la ligne', materiau_colonne_id: 'Matière de la colonne', solidite_uni: 'Solidité uni' },
  armure_degats: { sens: 'Résistance ou faiblesse', sens_brut: 'Résistance ou faiblesse (telle qu’écrite)', multiplicateur: 'Multiplicateur' },
  armure_emplacement: { cout_rf: 'Coût en RF' },
  bouclier: { classe_id: 'Forme de bouclier', defense_brut: 'Défense (telle qu’écrite)' },
  bouclier_classe: { classe: 'Classe de bouclier' },
  bouclier_poids: { force_min: 'Force minimale' },
  capacite: { ligne: 'Ligne', limite_nombre: 'Nombre d’utilisations', limite_periode: 'Période des utilisations' },
  capacite_nm_gagne: { capacite_id: 'Don de classe', nm: 'NM de sorts gagnés' },
  classe: {
    categorie_id: 'Catégorie de classe', bouclier_classe_max: 'Classe de bouclier maximale', chose_a_savoir_lien: 'Lien de la chose à savoir',
    description_titre: 'Titre de la présentation', magie_innee_id: 'Magie innée qui réserve la classe', magie_innee_exclue_id: 'Magie innée qui ferme la classe',
  },
  classe_maitrise_arme: { brut: 'Maîtrise (telle qu’écrite)', forme: 'Forme', nombre: 'Nombre de maîtrises', arme: 'Arme', sauf: 'Sauf' },
  classe_maitrise_armure: {
    brut: 'Maîtrise (telle qu’écrite)', objet: 'Objet', poids_min: 'Poids minimal', poids_max: 'Poids maximal', classe_min: 'Classe de bouclier minimale',
    classe_max: 'Classe de bouclier maximale',
  },
  classe_objet_depart: { texte: 'Objet (tel qu’écrit)' },
  ecart_source: { source_a: 'Source A', valeur_a: 'Valeur A', source_b: 'Source B', valeur_b: 'Valeur B', detail: 'Détail' },
  evenement_extrait: { section: 'Section de la page', date_brut: 'Date (telle qu’écrite)' },
  gemme: {
    prix_commune_rf: 'Prix de la gemme commune en RF', prix_raffinee_rf: 'Prix de la gemme raffinée en RF', prix_parfaite_rf: 'Prix de la gemme parfaite en RF',
    quart_commune_rf: 'Prix du quart de gemme commune en RF', quart_raffinee_rf: 'Prix du quart de gemme raffinée en RF',
    quart_parfaite_rf: 'Prix du quart de gemme parfaite en RF',
  },
  ingredient_alchimie: { majeur: 'Majeur' },
  magie: {
    onglet: 'Onglet', caracteristique_id: 'Caractéristique bonus (reconnue)', barre4_ressource: 'Ressource de la 4ème barre', barre4_max: 'Maximum de la 4ème barre',
    barre4_regen: 'Régénération de la 4ème barre', incompatibilite_note: 'Note de magie non compatible', mono_magie: 'Mono-magie',
  },
  magie_role: { role: 'Rôle (reconnu)' },
  maitrise_arme_part: {
    source_id: 'Source de maîtrise d’arme', capacite_id: 'Don de classe', classe_rang: 'Numéro de la ligne de la classe', points: 'Points de maîtrise',
    limite_famille: 'Limite de points par famille',
  },
  maitrise_arme_part_famille: { source_id: 'Source de maîtrise d’arme', rang: 'Rang de la part' },
  materiau_arme: { cran_solidite: 'Cran de solidité', effet_secondaire: 'Effet secondaire' },
  metier: { artisanat_brut: 'Artisanat possible (tel qu’écrit)', peut_fabriquer: 'Peut fabriquer', test_brut: 'Test d’artisanat (tel qu’écrit)' },
  metier_bonus: { texte: 'Bonus (tel qu’écrit)', unite: 'Unité', attribut: 'Attribut' },
  metier_objet_depart: { texte: 'Objet (tel qu’écrit)' },
  metier_recette_famille: { famille: 'Famille de recettes', mot_source: 'Mot repéré' },
  mode_hyper_effet: {
    version: 'Version', portee: 'Portée', libelle: 'Cible (telle qu’écrite)', variante: 'Variante', variante_brut: 'Variante (telle qu’écrite)',
    commentaire: 'Commentaire',
  },
  monnaie: { valeur_rf: 'Valeur en RF', convertisseur_brut: 'Convertisseur (tel qu’écrit)' },
  monstre: { armure_physique: 'Armure physique', armure_magique: 'Armure magique', vitesse_sol: 'Vitesse au sol' },
  monstre_butin: { score_min: 'Score minimal', score_max: 'Score maximal', score_brut: 'Score (tel qu’écrit)' },
  monstre_capacite_commune: { liste_de_sorts: 'Liste de sorts par carte' },
  monstre_capacite_valeur: { numero: 'Numéro de l’emplacement' },
  monstre_defense: { sens: 'Rubrique' },
  monstre_espece: { lettre: 'Lettre de l’index' },
  monstre_espece_bloc: { titre: 'Titre du bloc' },
  monstre_espece_lieu: { lieu: 'Lieu' },
  monstre_rubrique: { rubrique: 'Rubrique' },
  note_cellule: { cellule: 'Cellule', repond_a: 'Répond à' },
  page: { type: 'Rubrique du wiki', slug: 'Adresse', resume: 'Résumé', donnees: 'Données', statut: 'Statut' },
  page_entite: { principale: 'Page principale' },
  panneau_regles_bloc: { tuile: 'Genre du bloc' },
  potion_etat: { action: 'Action' },
  race: {
    chakra_depart: 'Chakra de départ', barriere_bonus: 'Barrière bonus', vitesse_terre: 'Vitesse sur terre', divers: 'Divers',
    don_base_brut: 'Don de base (tel qu’écrit)', don_base_nom: 'Nom du don de base', don_base_type: 'Type du don de base',
    don_base_effets: 'Effets du don de base', mono_magie: 'Une seule magie',
  },
  race_don: { slug: 'Identifiant court', forme: 'Forme', ethnie_id: 'Ethnie de la fiche' },
  race_don_tableau_cellule: { ligne: 'Ligne', colonne: 'Colonne' },
  race_onglet: { onglet: 'Onglet', dons_rubrique: 'Rubrique des dons', dons_rubrique_nom: 'Colonne du nom du don', dons_rubrique_don: 'Colonne du don' },
  relation_peuple: { ligne_peuple_id: 'Peuple qui voit', colonne_peuple_id: 'Peuple vu', echelle_id: 'Niveau de relation' },
  sort: {
    ic_direct: 'IC', ic_nm_min: 'IC à partir du NM', imparable: 'Imparable', inesquivable: 'Inesquivable', cout_chakra: 'Coût en chakra',
    cout_ressource: 'Ressource du coût secondaire', cout_ressource_valeur: 'Quantité du coût secondaire', portee_nature: 'Nature de la portée',
    portee_valeur: 'Portée (nombre)', zone_forme: 'Forme de la zone', zone_taille: 'Taille de la zone', mode_brut: 'Mode (tel qu’écrit)',
    bonus_maitrise: 'Bonus de maîtrise',
  },
  sort_bonus_maitrise: {
    champ: 'Colonne de la source', texte_brut: 'Expression (telle qu’écrite)', contexte: 'Contexte', increment_brut: 'Incrément (tel qu’écrit)',
    increment_entier: 'Incrément', pas_nm: 'Pas de NM', seuil_nm: 'Seuil de NM',
  },
  sort_etat: { relation: 'Relation', stade: 'Stade', champ: 'Colonne de la source', forme_trouvee: 'Forme trouvée', extrait: 'Extrait' },
  sort_mode: { mode: 'Mode', fois: 'Nombre de fois' },
  source: { url: 'Adresse web', google_id: 'Identifiant Google', fichier: 'Fichier', onglets: 'Onglets' },
  specialite: { description_titre: 'Titre de la description' },
});

/** Les colonnes de provenance (retirées à la 1.0 : décision du propriétaire) : jamais affichées. */
export const COLONNES_DE_PROVENANCE = Object.freeze(['origine', 'source_ref']);
/** Les clés normalisées qui ne finissent pas par `_cle` (normalize d'une autre colonne), avec leur colonne source : jamais affichées. */
export const CLES_NORMALISEES = geler({ alias: { cle: 'texte' } });

/** Le nom d'une table (le libellé de TABLES, sinon celui du registre) ; null pour une table que le registre ne connaît pas. */
export function nomDeTable(table) {
  return TABLES[table]?.libelle ?? (Object.hasOwn(NOMS_DES_TABLES, table) ? NOMS_DES_TABLES[table] : null);
}

/**
 * Le nom d'une colonne (le libellé du champ de TABLES, sinon celui de la table dans le registre, sinon le nom commun) ; null pour une colonne que le
 * registre ne connaît pas. Une colonne masquée a quand même un nom quand le registre en donne un, mais ne s'affiche pas (colonneMasquee).
 */
export function nomDeColonne(table, colonne) {
  const champ = TABLES[table]?.colonnes[colonne];
  if (champ?.libelle) return champ.libelle;
  const propres = Object.hasOwn(NOMS_DES_COLONNES, table) ? NOMS_DES_COLONNES[table] : null;
  if (propres && Object.hasOwn(propres, colonne)) return propres[colonne];
  return Object.hasOwn(COLONNES_COMMUNES, colonne) ? COLONNES_COMMUNES[colonne] : null;
}

/** Une colonne qui ne s'affiche pas dans une ligne : une clé normalisée tirée d'une autre colonne (`X_cle`, `alias.cle`) ou la provenance. */
export function colonneMasquee(table, colonne) {
  return typeof colonne === 'string' && (/_cle$/.test(colonne) || COLONNES_DE_PROVENANCE.includes(colonne) || Object.hasOwn(CLES_NORMALISEES[table] ?? {}, colonne));
}

/**
 * La colonne dont une clé normalisée est tirée (`nom_cle` → `nom`, `alias.cle` → `texte`) : une raison qui la cite (« les règles ont changé nom,
 * nom_cle autrement ») la dit par sa source ; null pour une autre colonne (la provenance n'a pas de source : elle ne se dit pas).
 */
export function colonneSource(table, colonne) {
  if (typeof colonne !== 'string') return null;
  if (Object.hasOwn(CLES_NORMALISEES[table] ?? {}, colonne)) return CLES_NORMALISEES[table][colonne];
  return /^[a-z0-9_]+_cle$/.test(colonne) ? colonne.slice(0, -'_cle'.length) : null;
}
