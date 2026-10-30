# Aperçu du schéma de la base

> **Document généré** depuis [`data/schema.sql`](../../data/schema.sql) par `npm run db:doc` : ne pas l'éditer. Version compacte de [`structure.md`](structure.md) (qui détaille chaque colonne) pour relire le schéma d'un coup d'œil : 207 tables, 2 tables de recherche, 38 vues.
> Ce qui reste à trancher sur le **contenu** (pas sur la forme) est dans [`a-valider.md`](a-valider.md).

**Lecture des colonnes** : **gras** = clé primaire ; `→table` = clé étrangère vers cette table ; `?` = peut être absente (`NULL`, jamais une valeur inventée) ; `+provenance` = `origine` (famille d'import) et `source_ref` (classeur › onglet › plage). Une colonne `*_brut` garde le texte de la source quand la colonne typée voisine n'a pas pu être déduite sans ambiguïté.

## 0. FAMILLES D'IMPORT

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `famille` |  | **id**, libelle, importeur?, sources?, ordre |

## 1. PAGES, LIENS, MOTS-CLÉS, SOURCES (couche générique)

**Relations dans cette section** : `alias→page`, `page_entite→page`, `page_source→page`, `page_source→source`, `page_tag→mot_cle`, `page_tag→page`, `page→type_page`, `panneau_regles_bloc→panneau_regles`, `panneau_regles→page`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `type_page` | Registre des catégories du wiki : reprend client/src/lib/types.mjs (aujourd'hui une constante JavaScript). | **id**, libelle, singulier, salon_discord, description, ordre |
| `page` | Une page du wiki = un fichier client/src/content/wiki/<type>/<slug>.md d'aujourd'hui. | **id**, type→type_page, slug, titre, titre_cle, resume?, donnees?, corps_md, statut, +provenance |
| `alias` | Alias d'une page (frontmatter `aliases`) : autres noms utilisables dans [[ ]]. | **page_id**→page, **ordre**, texte, cle |
| `mot_cle` | Vocabulaire des mots-clés, devenu un glossaire : un mot-clé = son id, son libellé et sa définition (migrations 0043 et 0056). | **id**, libelle, libelle_cle, description? |
| `page_tag` | Mots-clés d'une page (frontmatter `tags`, dans l'ordre) : l'écriture est celle du vocabulaire (mot_cle.libelle ; jusqu'à la migration 0043, chaque page gardait la sienne). | **page_id**→page, **ordre**, tag_id→mot_cle |
| `source` | Provenance au niveau de la page : une entrée de frontmatter `sources` = une ligne (texte exact). | **id**, nature, texte, url?, genre?, google_id?, fichier?, onglets? |
| `page_source` |  | **page_id**→page, **ordre**, source_id→source |
| `page_entite` | Lien page -> entité typée. | **entite_table**, **entite_id**, page_id→page, principale, origine→famille |
| `panneau_regles` | Panneaux de règles : l'encart replié en tête de chaque page de l'équipement (migration 0056). | **id**, titre, page_id→page |
| `panneau_regles_bloc` | Un bloc d'un panneau, dans l'ordre de lecture : du texte (tuile = 0), qui suit les colonnes du panneau, ou une tuile (tuile = 1 : encadrée, titre facultatif). | **panneau_id**→panneau_regles, **rang**, ordre, tuile, titre?, texte |
| `composant_onglet` | Onglets de la page « Composants » (/ressources/composants/, migration 0057) : un onglet par tableau de la page. | **id**, titre, note?, ordre |
| `annonce` | Annonces placées par le site (migration 0068) : aujourd'hui l'encart « Notre prochaine rencontre IRL » sur l'accueil (/, components/accueil/LiensEtRencontre.astro, depuis le 2026-10-23 ; sur la page L | **id**, texte? |

## 2. RÈGLES DE LA FICHE : caractéristiques, compétences, niveaux, constantes, postures (famille « fiche »)

**Relations dans cette section** : `competence→caracteristique`, `niveau_deblocage→niveau_global`, `posture_critique→competence`, `posture_critique→posture`, `posture_effet→posture`

**Vers d'autres sections** : `regle_constante→page (§1)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `caracteristique` | Les six caractéristiques (Personnage!B18:R19). | **id**, nom, lettre, ordre, remarque?, +provenance |
| `competence` | Les 30 compétences : 5 par caractéristique (Personnage!B22:B36 et O22:O36). | **id**, nom, caracteristique_id→caracteristique, ordre, libelle_fiche, description?, remarque?, +provenance |
| `niveau_global` | Table « Expérience / Niveau global » du guide, une ligne par niveau, recoupée avec BDD!G2:H21 (même 20 paliers). | **niveau**, xp_min, points_competences?, points_attributs?, caracteristiques_a_repartir?, maximum_naturel_bonus?, niveaux_classe?, niveaux_maitrise?, puissance_magique?, puissance_magique_note?, de_attributs_bonus?, dons_brut, de_attributs_min?, de_attributs_max?, +provenance |
| `niveau_deblocage` | Déblocages écrits dans la colonne « Dons » qui ne sont pas des quantités : mode hyper (niveau 2), mode hyper 100 % et récupération par Méditation / Repos (niveau 10). | **niveau**→niveau_global, **rang**, code, texte, +provenance |
| `seuil_niveau` | Valeurs par palier de niveau global lues dans les formules de la fiche (BDD!K28, K36, AK2:AK6) : « à partir du niveau `niveau_min` (inclus), la valeur est `valeur` ». | **regle**, **niveau_min**, valeur, condition?, libelle, formule, remarque?, +provenance |
| `regle_constante` | Constantes chiffrées de règle. | **id**, valeur, unite?, nature, texte, page_id→page?, remarque?, +provenance |
| `entrainement_palier` | Table d'entraînement (guide « Capacités/Don » : un D100 donne un bonus d'Acquis). | **de_min**, de_max, bonus_acquis_pct?, rate, valeur_brut, resultat_brut, +provenance |
| `initiative_agilite` | Bonus d'initiative selon l'Agilité (guide « Attributs » : « D20 + … »). | **agilite**, bonus, note?, bonus_brut, +provenance |
| `type_don` | Les quatre types de don (guide « Capacités/Don »). | **id**, nom, definition, ordre, remarque?, +provenance |
| `posture` | ▸ POSTURES DE COMBAT Six postures. | **id**, nom, ordre, libelle_fiche, description, remarque?, +provenance |
| `posture_effet` |  | **posture_id**→posture, **version**, **rang**, intitule?, texte, inconvenient?, +provenance |
| `posture_critique` | Jets sur lesquels compte un bonus de réussite critique lié à une posture (décision R180, migration 0087). | **posture_id**→posture, **bonus**, **competence_id**→competence |

## 3. MAGIES ET SORTS (famille « magies »)

**Relations dans cette section** : `amelioration_cadaverique→magie`, `magie_dieu→magie`, `magie_ethnie_secondaire→magie`, `magie_incompatibilite→magie`, `magie_resistance→magie`, `magie_role→magie`, `sort_bonus_maitrise→sort`, `sort_etat→sort`, `sort_mode→sort`, `sort_mot_cle→sort`, `sort_type→sort`, `sort→magie`

**Vers d'autres sections** : `magie_dieu→dieu (§5)`, `magie_ethnie_secondaire→ethnie (§7)`, `magie_resistance→etat (§4)`, `magie→caracteristique (§2)`, `magie→page (§1)`, `sort_etat→etat (§4)`, `sort_mot_cle→mot_cle (§1)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `magie` | MAGIE : une ligne par onglet de magie (15 : Potentiel Illimité + 14 magies) | **id**→page, nom, nom_cle, onglet, ordre, banniere?, description?, description_physique?, explication?, sante_offerte?, chakra_offert?, caracteristique_id→caracteristique?, caracteristique_brut?, barre4_ressource?, barre4_texte?, barre4_max?, barre4_regen?, incompatibilite_note?, remarque?, mono_magie, +provenance |
| `magie_role` | Rôles de la magie (bloc « ROLES » : trois cellules, de gauche à droite). | **magie_id**→magie, **rang**, role, role_brut, +provenance |
| `magie_resistance` | Résistances et vulnérabilités de la magie (4 blocs de l'onglet : « Résistance magique », « Vulnérabilité magique », « Résistance altération d'état », « Vulnérabilité altération d'état » ; « Aucune » = aucune ligne). | **magie_id**→magie, **sens**, **cible_type**, **rang**, cible_magie_id→magie?, cible_etat_id→etat?, cible_brut, cible_physique?, +provenance |
| `magie_incompatibilite` | Magies qu'on ne peut pas combiner. | **magie_id**→magie, **autre_magie_id**→magie, +provenance |
| `magie_ethnie_secondaire` | Ethnies pour lesquelles une magie secondaire reste possible malgré les incompatibilités (fiche `Magie!U5`, colonne « Magie secondaire si Race » : « Elfe Noir Charbon, Elfe Noir Salé, Felfe Noir » pour Corruption). | **magie_id**→magie, **rang**, ethnie_id→ethnie, ethnie_brut, +provenance |
| `magie_dieu` |  | **magie_id**→magie, **dieu_id**→dieu, rang, +provenance |
| `amelioration_cadaverique` | Tableau « AMELIORATION CADAVERIQUE » de la Nécromancie (13 lignes : nom, effet). | **id**, magie_id→magie, rang, nom, effet, remarque?, +provenance |
| `sort` | SORT : une ligne par sort de la table des sorts (14 magies x 23 sorts = 322 ; Potentiel Illimité n'a pas de table propre : il pioche dans les 14 autres, règle de la fiche, hors de ce domaine) | **id**, magie_id→magie, nom, nom_cle, niveau, ordre, type_brut, ic_direct, ic_nm_min?, imparable, inesquivable, cout_brut, cout_chakra?, cout_ressource?, cout_ressource_valeur?, portee_brut, portee_nature, portee_valeur?, zone_brut, zone_forme, zone_taille?, dsb_brut?, effets?, texte_niveau5?, remarque?, mode_brut?, bonus_maitrise?, cout_secondaire?, +provenance |
| `sort_type` | Types d'un sort : « Attaque/ Entrave (Imparable) » = deux types. | **sort_id**→sort, **rang**, type, libelle, +provenance |
| `sort_mode` | Mode d'un sort : ce que la colonne « Type » écrit entre parenthèses (« Amplification (IC) », « Attaque\n(Imparable) »), séparé du TYPE (sort_type : attaque, entrave…). | **sort_id**→sort, **rang**, mode, libelle, fois?, +provenance |
| `sort_bonus_maitrise` | Bonus de niveau de maîtrise (NM) d'un sort : chaque renforcement que les cellules du classeur écrivent, quelle que soit la colonne. | **sort_id**→sort, **champ**, **rang**, nature, texte_brut, contexte, increment_brut?, increment_entier?, pas_nm?, seuil_nm?, +provenance |
| `sort_etat` | Sort <-> altération d'état. | **sort_id**→sort, **etat_id**→etat, **relation**, **rang**, stade?, champ, forme_trouvee, extrait, +provenance |
| `sort_mot_cle` | Étiquettes d'un sort : un mot-clé du glossaire (mot_cle) posé sur un sort (décision R114 du propriétaire, migration 0067 : « Il faudra d'ailleurs redéfinir ce qu'est un sort "grenade" autrement que pa | **sort_id**→sort, **mot_cle_id**→mot_cle |
| `commentaire_orphelin` | Fils de commentaires du Sommaire ancrés en A1 : commentaires de cellules supprimées, sans sort identifiable (certains portent des textes de règle). | **id**, empreinte, occurrence, onglet, cellule, resolu, texte, +provenance |
| `legende_sort` | Légende commune des 14 tables de sorts (identique dans chaque onglet) : « IC = Instant Cast » et les trois modes d'obtention d'un niveau de maîtrise (N, L, C). | **code**, groupe, libelle, description?, +provenance |
| `regle_magie` | Règles de magie qui valent pour toutes les magies (Sommaire!A31 : « Règle spéciale pour sort niveau 5 »). | **id**, titre, niveau_sort?, texte, +provenance |

## 4. ANNEXES DES MAGIES : états, résistances, météo, modes hyper et super (famille « annexes »)

**Relations dans cette section** : `etat_magie→etat`, `etat_palier→etat`, `etat_palier→resistance_palier`, `etat_stade→etat`, `meteo_effet→meteo`

**Vers d'autres sections** : `etat_magie→magie (§3)`, `meteo_effet→magie (§3)`, `mode_hyper_effet→magie (§3)`, `mode_hyper_effet→race (§7)`, `mode_texte→page (§1)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `resistance_palier` | Les 6 paliers de la fiche (Personnage!BA2:BA12) : une valeur de résistance V (somme des crans) donne un palier. | **id**, libelle, valeur_min?, valeur_max?, multiplicateur, effet_brut, ordre, +provenance |
| `etat` | ▸ ALTÉRATIONS D'ÉTAT (classeur V8, onglet « Altération détats » : 20 blocs de 5 lignes) | **id**, nom, ordre, type, type_brut, magie_liee_brut?, remarque?, +provenance |
| `etat_magie` | Magie(s) liée(s) d'une altération : 13 altérations sur 20 en ont (Surcharge Magique : deux, Arcane et Corruption). | **etat_id**→etat, **magie_id**→magie, rang, +provenance |
| `etat_stade` | Effet d'une altération par stade (colonnes « Stade 1 », « Stade 2 », « Stade 3 »). | **etat_id**→etat, **rang**, stade?, effet, +provenance |
| `etat_palier` | Effet d'une altération selon la résistance ou la vulnérabilité de la cible (colonnes AQ / AV : une paire « libellé / effet » par ligne du bloc). | **etat_id**→etat, **palier_id**→resistance_palier, libelle_brut, effet, +provenance |
| `meteo` | ▸ MÉTÉO (classeur V8, onglet « Météo » : une entrée de 7 lignes par météo) | **id**, nom, ordre, description, remarque?, +provenance |
| `meteo_effet` | Effets d'une météo : une ligne « - … » de la cellule « Effet(s) » = une ligne. | **meteo_id**→meteo, **rang**, type, texte, element_magie_id→magie?, element_brut?, degats?, soin?, degats_tour_pair?, degats_tour_impair?, +provenance |
| `mode_texte` | Textes d'explication du classeur « Mode hyper et co » (Mode Hyper!AA1, AA14, AA30 ; Mode Super!AI1) : cellule entière, telle quelle. | **id**, mode, rang, intitule, texte, page_id→page, remarque?, +provenance |
| `mode_hyper_depassement` | « Au delà des limites » (Mode Hyper!AA14) : conséquences d'un mode hyper maintenu N tours de plus, une fois relâché. | **tours**, tours_brut, effet, +provenance |
| `mode_super_objet` | Mode super : objets légendaires ou enchantés (Mode Super!A3:T59). | **id**, nom, ordre, effet_passif?, effet_actif?, effets_brut, description?, remarque?, +provenance |
| `mode_hyper_effet` | Effets du mode hyper. | **id**, version, portee, rang, libelle, magie_id→magie?, magie2_id→magie?, race_id→race?, variante?, variante_brut?, effet, commentaire?, remarque?, nom?, +provenance |

## 5. DIEUX

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `dieu` | Noms de la liste déroulante « Dieu choisi » (Personnage!S5, 26 valeurs) et de la colonne « Dieux » de la feuille Magie (X2:X29). | **id**, nom, ordre_choix?, dans_liste_magie, remarque?, +provenance |

## 5 bis. CHRONOLOGIE : les événements datés du Codex et des races (famille « chronologie » ; migration 0035, docs/chronologie.md)

**Relations dans cette section** : `evenement_categorie→categorie_chronologie`, `evenement_categorie→evenement`, `evenement_extrait→evenement`

**Vers d'autres sections** : `evenement_extrait→page (§1)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `evenement` | Un événement, dans l'ordre de lecture (`rang`) : un fait que le Codex ou une page de race date, plus l'ouverture « Au début » (Origine du monde, les trois premières races), les « Date inconnue » de la | **id**, rang, titre, titre_cle, epoque, annee?, annee_fin?, portee?, lieu?, +provenance |
| `evenement_extrait` | Les blocs de description d'un événement, dans l'ordre (la « Description » et le « Lien » de la demande du propriétaire : le texte d'un bloc et sa page). | **evenement_id**→evenement, **rang**, page_id→page?, section?, texte, date_brut?, +provenance |
| `categorie_chronologie` | Les catégories de la chronologie (migration 0043, demande du propriétaire : « Les mots clés sont trop nombreux et trop libres pour faire de vraies catégories stables. | **id**, libelle, libelle_cle |
| `evenement_categorie` | Les catégories d'un événement (plusieurs au choix). | **evenement_id**→evenement, **categorie_id**→categorie_chronologie |

## 6. CLASSES, SPÉCIALITÉS, CAPACITÉS (famille « classes »)

**Relations dans cette section** : `capacite_nm_gagne→capacite`, `capacite_variable→capacite`, `capacite→classe`, `capacite→specialite`, `classe_annexe_entree→classe_annexe`, `classe_annexe→classe`, `classe_maitrise_arme→classe`, `classe_maitrise_armure→classe`, `classe_objet_depart→classe`, `classe_objet_depart→objet_depart`, `classe→categorie_classe`, `maitrise_arme_part_famille→maitrise_arme_part`, `maitrise_arme_part→capacite`, `maitrise_arme_part→classe_maitrise_arme`, `specialite→classe`

**Vers d'autres sections** : `capacite→page (§1)`, `classe_annexe→magie (§3)`, `classe→magie (§3)`, `classe→page (§1)`, `maitrise_arme_part_famille→arme_famille (§9)`, `maitrise_arme_part→arme_famille (§9)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `categorie_classe` | CATÉGORIES DU SOMMAIRE Les six en-têtes de colonne du Sommaire (A1, C1, E1, G1, I1, K1) : « Classe Physique Corps à Corps », « Classe Physique Distance », « Classe Magique », « Classe Hybride », « Cla | **id**, libelle, ordre, note?, am_base?, +provenance |
| `classe` | CLASSE : une ligne par onglet de classe (39) | **id**→page, nom, nom_cle, categorie_id→categorie_classe, ordre, sante_depart, chakra_depart, barriere_depart, maitrise_arme?, maitrise_armure?, bouclier_classe_max?, inventaire_depart?, arme_depart?, armure_depart?, chose_a_savoir?, chose_a_savoir_lien?, description_titre?, description?, remarque?, magie_innee_id→magie?, magie_innee_exclue_id→magie?, +provenance |
| `specialite` | SPÉCIALITÉ : deux par classe, choisies au niveau de classe 10 Onglet normal : bannières en majuscules de la ligne 17 (A17 = rang 1, X17 = rang 2) ; description = titre + texte dans la zone AM. | **id**, classe_id→classe, rang, nom, nom_cle, description_titre?, description?, remarque?, +provenance |
| `capacite` | CAPACITÉ (aptitude) : une ligne par page `capacites/<slug>` (660). | **id**→page, classe_id→classe, specialite_id→specialite?, niveau, nature, ligne, rang, nom, nom_cle, type?, type_brut?, limite_nombre?, limite_periode?, effet?, remarque?, +provenance |
| `objet_depart` | OBJETS DE DÉPART Glossaire « OBJETS DES INVENTAIRES DE DEPART » (Sommaire!A21, une grande cellule : un objet par paragraphe, « nom : description »). | **id**, nom, nom_cle, description, ordre, remarque?, +provenance |
| `classe_objet_depart` | Inventaire de départ : une ligne par objet de la cellule « Inventaire de départ » (G3), dans l'ordre. | **classe_id**→classe, **rang**, **option**, texte, objet_depart_id→objet_depart?, +provenance |
| `classe_maitrise_armure` | MAÎTRISES DE DÉPART : cellules « Maîtrise Arme » (A7:F9) et « Maîtrise Armures » (A11:F13) de l'onglet de la classe. | **classe_id**→classe, **rang**, brut, objet?, poids_min?, poids_max?, classe_min?, classe_max?, +provenance |
| `classe_maitrise_arme` |  | **classe_id**→classe, **rang**, brut, forme?, nombre?, arme?, arme_cle?, categorie?, sauf?, sauf_cle?, +provenance |
| `maitrise_arme_part` | SOURCES DE MAÎTRISE D'ARME (décisions R148 à R151, migration 0076) : ce que donne chaque ligne de classe_maitrise_arme et chaque don (capacite.effet), en parts, telles que les lit client/src/lib/maitr | **source_id**, **rang**, capacite_id→capacite?, classe_id→classe_maitrise_arme?, classe_rang→classe_maitrise_arme?, genre, points, arme_famille_id→arme_famille?, limite_famille? |
| `maitrise_arme_part_famille` | Les familles proposées à chaque point d'une part 'choix' (R148 à R151), explicites : la catégorie de la ligne (« contact », « à distance » ; « corps à corps » = contact : R127, R151), la liste qu'elle | **source_id**→maitrise_arme_part, **rang**→maitrise_arme_part, **arme_famille_id**→arme_famille |
| `capacite_nm_gagne` | NM de sorts gagnés qu'écrit un don (décision R154, migration 0076) : le N de « Gagne N niveaux de maîtrise (NM) » (lib/maitrise-arme.mjs#nmGagnesDuDon, rejoué sur toute la base par test/maitrise-arme- | **capacite_id**→capacite, nm |
| `classe_annexe` | TABLEAU LIBRE D'UN ONGLET Tableau sans titre sous les aptitudes de Mage Bleu (A58:AR127, 14 lignes de 5 rangées : libellé en A, texte en G). | **classe_id**→classe, **rang**, libelle, libelle_cle, magie_id→magie?, texte, +provenance |
| `classe_annexe_entree` | Les entrées du tableau libre, une par ligne « (Type) Nom. | **id**, classe_id→classe_annexe, annexe_rang→classe_annexe, rang, nom, nom_cle, type, type_brut, limite_brute?, limite_nombre?, limite_periode?, effet, remarque?, +provenance |
| `capacite_variable` | La liste d'un don « Variable » (capacite.type = 'variable' ; décision R181, migration 0088) : le don obtient une entrée du tableau libre de sa classe (classe_annexe_entree), sur la ligne de la magie que son texte vise. | **capacite_id**→capacite, magie |

## 7. RACES, ETHNIES, ACCESSIBILITÉS (famille « races »)

**Relations dans cette section** : `ethnie_resistance→ethnie`, `ethnie→race`, `peuple→race`, `race_classe→race`, `race_don_tableau_cellule→race_don_tableau_colonne`, `race_don_tableau_cellule→race_don_tableau_ligne`, `race_don_tableau_colonne→race_onglet`, `race_don_tableau_ligne→ethnie`, `race_don_tableau_ligne→race_onglet`, `race_don→ethnie`, `race_don→race_onglet`, `race_magie_onglet→race_onglet`, `race_magie→race`, `race_onglet→race`, `race_restriction_carac→race`, `relation_peuple→echelle_relation`, `relation_peuple→peuple`

**Vers d'autres sections** : `ethnie_resistance→etat (§4)`, `ethnie_resistance→magie (§3)`, `ethnie→magie (§3)`, `race_classe→classe (§6)`, `race_magie_onglet→magie (§3)`, `race_magie→magie (§3)`, `race_restriction_carac→caracteristique (§2)`, `race→page (§1)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `race` | RACE : une ligne par race (27 dans les cinq onglets du classeur ; le guide dit « 23 disponibles », voir design.md §12) | **id**→page, nom, ordre, presentation?, sante?, chakra_depart?, barriere_bonus?, vitesse_terre?, vitesse_nage?, ap?, am?, divers?, don_base_brut?, don_base_nom?, don_base_type?, don_base_effets?, remarque?, mono_magie, +provenance |
| `race_restriction_carac` | RACE_RESTRICTION_CARAC : restrictions de caractéristique d'une race (onglet « Race », 6 paires de colonnes « < ou > » / « Restrictions <caractéristique> »). | **race_id**→race, **caracteristique_id**→caracteristique, operateur, valeur, +provenance |
| `ethnie` | ETHNIE : une ligne par ligne de l'onglet « Bonus Race » (96) : sous-race, origine ou variété d'une race (« Elfe Noir Charbon », « Drakos Rouge », « Mort-Vivant Eau », « Orios de Terre »…). | **id**, race_id→race, slug, nom, ordre, libelle?, magie_id→magie?, descriptif?, race_brut, bonus_pv?, bonus_chakra?, bonus_barriere?, bonus_ap?, bonus_am?, bonus_vitesse?, remarque?, +provenance |
| `ethnie_resistance` | Résistances d'une ethnie (col. | **ethnie_id**→ethnie, **rang**, cible_type, cible_magie_id→magie?, cible_etat_id→etat?, cible_brut, valeur, +provenance |
| `race_classe` | RACE_CLASSE : matrice « Accessibilité de Classe » : 27 races x 39 classes = 1 053 lignes (712 à 1, 341 à 0). | **race_id**→race, **classe_id**→classe, ordre, accessible, valeur_brut, +provenance |
| `race_magie` | RACE_MAGIE : matrice « Accessibilité Magie » : 27 races x 15 magies = 405 lignes (245 à 1, 160 à 0). | **race_id**→race, **magie_id**→magie, ordre, accessible, valeur_brut, +provenance |
| `race_onglet` | ▸ CONTENU DE L'ONGLET DE LA RACE : classeur « Les races », un onglet par race (migration 0007). | **race_id**→race, onglet, description_generale, histoire, description?, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique?, dons_rubrique_nom?, dons_rubrique_don?, dons_tableau_titre?, +provenance |
| `race_don` | RACE_DON : dons raciaux de l'onglet, dans son ordre. | **id**, race_id→race_onglet, slug, rang, forme, etiquette?, nom?, texte, ethnie_id→ethnie?, remarque?, +provenance |
| `race_don_tableau_colonne` | RACE_DON_TABLEAU_* : le tableau en panneaux du bloc « Don R (Race) » (Drakos : magie innée -> AP/AM, bonus de compétence, cran de résistance ; Mort-vivant : lieu de résurrection / raison de la mort -> | **race_id**→race_onglet, **rang**, libelle, +provenance |
| `race_don_tableau_ligne` |  | **race_id**→race_onglet, **rang**, ethnie_id→ethnie?, +provenance |
| `race_don_tableau_cellule` |  | **race_id**→race_don_tableau_ligne, **ligne**→race_don_tableau_ligne, **colonne**→race_don_tableau_colonne, valeur, +provenance |
| `race_magie_onglet` | RACE_MAGIE_ONGLET : magies innées que l'onglet de la race limite explicitement (ligne « Inconvénient(s) » : « Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné uniquement »), dans l'ordre où il les cite. | **race_id**→race_onglet, **magie_id**→magie, rang, nom_brut, +provenance |
| `echelle_relation` | ▸ RELATIONS ENTRE PEUPLES : classeur « Les races », onglet « Relation entre les races » (page lore/relations-entre-les-races). | **id**, libelle, ordre, remarque?, +provenance |
| `peuple` | Un peuple = une étiquette de l'onglet (« Elfe Forestier Forêt », « Humain Central »…) : recopiée telle qu'écrite (coquilles comprises : « Supprémaciste »). | **id**, nom, nom_cle, ordre, race_id→race?, remarque?, +provenance |
| `relation_peuple` |  | **ligne_peuple_id**→peuple, **colonne_peuple_id**→peuple, echelle_id→echelle_relation, +provenance |

## 8. BESTIAIRE : invocations et créatures (famille « bestiaire »)

**Relations dans cette section** : `creature_attaque_type→creature_attaque`, `creature_attaque→creature`, `creature_bonus_npm→creature`, `creature_capacite_resistance→creature_capacite`, `creature_capacite_sort→creature_capacite`, `creature_capacite→creature`, `creature_caracteristique→creature`, `creature_effet→creature`, `creature_ressource→creature`, `creature→invocation`, `creature→invocation_bloc`, `invocation_bloc_magie→invocation_bloc`, `invocation_bloc→invocation`, `invocation_capacite_commune→invocation`, `invocation_resistance→invocation_capacite_commune`

**Vers d'autres sections** : `creature_attaque_type→magie (§3)`, `creature_bonus_npm→caracteristique (§2)`, `creature_capacite_resistance→etat (§4)`, `creature_capacite_resistance→magie (§3)`, `creature_capacite_sort→sort (§3)`, `creature_caracteristique→caracteristique (§2)`, `creature_effet→sort (§3)`, `creature→page (§1)`, `invocation_bloc_magie→magie (§3)`, `invocation_resistance→etat (§4)`, `invocation_resistance→magie (§3)`, `invocation→page (§1)`, `invocation→sort (§3)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `invocation` | INVOCATION : une ligne par onglet du classeur (3) Une « invocation » est un TYPE de créatures qu'un sort permet d'invoquer : golems (Appel aux golems), non-morts (Animation des morts), marionettes d'o | **id**→page, nom, nom_cle, ordre, bandeau, genre, sort_id→sort?, texte_general?, tableau_titre?, remarque?, +provenance |
| `invocation_capacite_commune` | Capacités communes d'une invocation : la liste « ▸ Toutes ces créatures ont ceci en capacité commune » du texte général (golems : Inerte, Élémentaire ; non-morts : Non-Mort, Élémentaire). | **id**, invocation_id→invocation, rang, nom, nom_cle, texte, remarque?, +provenance |
| `invocation_resistance` | Résistances / vulnérabilités / immunités écrites dans une capacité COMMUNE (aujourd'hui : « Non-Mort » : immunisée à la peur, à la couardise, à la fatigue, au poison, à la maladie). | **capacite_commune_id**→invocation_capacite_commune, **rang**, sens, sens_brut, cible_type, cible_magie_id→magie?, cible_etat_id→etat?, cible_degat?, cible_brut, extrait, +provenance |
| `invocation_bloc` | BLOC : une ligne de marge du classeur (A13:C16, A42:C45…) = une combinaison de magies avec ses deux créatures Onglets « Appel aux golems » (15 blocs) et « Animation des morts » (14) : la marge dit la | **id**, invocation_id→invocation, rang, cle, marge_brut, npm?, remarque?, +provenance |
| `invocation_bloc_magie` | Magies de la marge d'un bloc, dans l'ordre d'écriture. | **bloc_id**→invocation_bloc, **rang**, magie_id→magie, magie_brut, +provenance |
| `creature` | CREATURE : une ligne par carte (63 = 30 golems/poupées + 28 non-morts + 5 marionettes) | **id**→page, nom, nom_cle, invocation_id→invocation, bloc_id→invocation_bloc, rang, description?, sante_brut, sante_forme, sante_valeur, chakra_brut?, chakra_forme?, chakra_valeur?, barriere_brut?, barriere_forme?, barriere_valeur?, defense_brut?, defense_forme?, armure_physique?, armure_physique_par_npm?, armure_magique?, armure_magique_par_npm?, vitesse_brut?, vitesse_sol?, vitesse_nage?, fpvsia_brut?, remarque?, +provenance |
| `creature_ressource` | Ligne facultative « ressource supplémentaire » de la carte (D9 + ligne suivante : Sang, Corruption, Âme) : 3 poupées seulement. | **creature_id**→creature, **ressource**, libelle, brut, forme, valeur, +provenance |
| `creature_caracteristique` | Les six nombres de la cellule FPVSIA, dans l'ordre d'écriture (rang 1 à 6). | **creature_id**→creature, **caracteristique_id**→caracteristique, rang, valeur, +provenance |
| `creature_bonus_npm` | Bonus écrits entre parenthèses après les six nombres : « (+1 Force au niveau 2 magique, +1 Force au niveau 4 magique) ». | **creature_id**→creature, **rang**, niveau_magique, increment, cible_brut, caracteristique_id→caracteristique?, texte_brut, +provenance |
| `creature_attaque` | ATTAQUES : ligne « Dégâts » de la carte, une ligne de texte par attaque « Poing - 1d10/NPM dégâts de frappe », « Canon magma - 1d10/NPM dégâts de frappe/feu (portée 4-18\|zone 2x2\|Coûte 10% de santé) ». | **id**, creature_id→creature, rang, nom, nom_cle, occurrence, brut, formule_brut, des_nombre?, des_faces?, bonus_fixe?, par_npm, type_brut?, precisions?, portee_min?, portee_max?, cout_chakra?, remarque?, +provenance |
| `creature_attaque_type` | Types de dégâts d'une attaque : « de taille/estoc » = deux lignes ; « de frappe/feu » = frappe + feu. | **attaque_id**→creature_attaque, **rang**, type, libelle, magie_id→magie?, +provenance |
| `creature_capacite` | CAPACITÉS : cellule « Capacité(s) », un paragraphe (séparé par une ligne vide) = une capacité Forme du paragraphe : « [(NPM n) ][[étiquette] ]Nom. | **id**, creature_id→creature, rang, npm_min?, etiquette?, nom, nom_cle, texte, donnees?, remarque?, +provenance |
| `creature_capacite_sort` | Sorts cités par une capacité « Lanceur de sorts » (« avec les niveaux de maîtrises maximum : Boule de feu, Cautérisation ») ou « Sort supplémentaire » (« obtient de nouveaux sorts en plus des autres : … »). | **capacite_id**→creature_capacite, **rang**, sort_nom_brut, sort_id→sort?, +provenance |
| `creature_capacite_resistance` | Résistances / vulnérabilités / immunités déclarées par le texte d'une capacité de la créature (« Fait de verre. | **capacite_id**→creature_capacite, **rang**, sens, sens_brut, cible_type, cible_magie_id→magie?, cible_etat_id→etat?, cible_degat?, cible_brut, extrait, +provenance |
| `creature_effet` | AUTRES BLOCS DE LA CARTE Panneau « Effet "Manteau noir" » de la carte des marionettes (S12 / S13 : libellé puis texte) : les bonus que procure la créature quand on la sacrifie avec le sort « Manteau n | **creature_id**→creature, **rang**, libelle, nom, sort_id→sort?, texte, +provenance |

## 8 bis. BESTIAIRE 2.0 : monstres, butin, échelles de puissance (famille « monstres »)

**Relations dans cette section** : `monstre_attaque→monstre`, `monstre_butin→monstre_espece`, `monstre_capacite_valeur→monstre_capacite`, `monstre_capacite→monstre`, `monstre_capacite→monstre_capacite_commune`, `monstre_caracteristique→monstre`, `monstre_defense→monstre`, `monstre_espece_bloc→monstre_espece`, `monstre_espece_lieu→monstre_espece`, `monstre_espece→monstre_groupe`, `monstre_rubrique→monstre`, `monstre→monstre_espece`

**Vers d'autres sections** : `monstre_caracteristique→caracteristique (§2)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `monstre_regle` | Règles générales de l'introduction (« Quelques règles qui marchent dans toutes les échelles de puissance »), dans l'ordre de la liste. | **rang**, texte, +provenance |
| `monstre_echelle` | Échelles de puissance (EP 1 à 10) : les deux tableaux de l'introduction. | **ep**, regle_brut, degats_brut, niveau_min, niveau_max, attributs_brut, xp_brut, attributs_ennemi_simple?, attributs_mini_boss?, attributs_boss?, xp_ennemi_simple?, xp_mini_boss?, xp_boss?, +provenance |
| `monstre_butin_objet` | Glossaire du butin (fin du doc, « GLOSSAIRE BUTIN ») : « Nom. | **id**, rang, nom, texte, +provenance |
| `monstre_groupe` | GROUPE D'ESPÈCES (décision R64, migration 0042) : des espèces du doc qui n'en font qu'une pour le propriétaire (« regrouper tous les Ottar (et le presqu'Ottar) sous la même espèce d'Ottar, dont la des | **id**, nom, nom_cle, description?, +provenance |
| `monstre_espece` | ESPÈCE : un titre « Nom (EPx) » du doc, rangé sous sa lettre ; sa description, son lieu de rencontre, puis ses cartes (de 0 à 3 : ennemi simple, mini-boss, boss), les blocs qui suivent les cartes et l | **id**, nom, nom_cle, ordre, lettre, ep_brut, ep_min?, ep_max?, description?, lieu_brut?, complement?, portrait?, portrait_x?, portrait_y?, portrait_zoom?, groupe_id→monstre_groupe?, +provenance |
| `monstre_espece_lieu` | Lieux de rencontre : `lieu_brut` découpé aux virgules, tel qu'écrit (« Ruines », « ruines » et « Ruines brûlées » restent distincts). | **espece_id**→monstre_espece, **rang**, lieu, lieu_cle, +provenance |
| `monstre_espece_bloc` | Blocs qui suivent les cartes d'une espèce, ouverts par un titre en capitales (aujourd'hui : les quinze tableaux du Presque-Ottar, un par magie). | **espece_id**→monstre_espece, **rang**, titre, texte, +provenance |
| `monstre_butin` | Butin d'une espèce : le tableau « Score (3d100) \| Butin possible », une ligne par (tranche de score, catégorie) ; une cellule vide n'a pas de ligne. | **espece_id**→monstre_espece, **rang**, **categorie**, score_min, score_max, score_brut, texte, +provenance |
| `monstre` | MONSTRE : une carte « NOM Créature échelle N » ; « Type \| Alignement \| Catégorie » sur la ligne suivante. | **id**, espece_id→monstre_espece, rang, nom, nom_brut, nom_cle, echelle_brut, ep_min?, ep_max?, type_brut?, alignement_brut?, categorie_brut, categorie, variable, sante?, chakra?, barriere?, armure_physique?, armure_magique?, vitesse_sol?, vitesse_nage?, portrait?, portrait_x?, portrait_y?, portrait_zoom?, description?, +provenance |
| `monstre_rubrique` | Rubriques d'une carte, dans l'ordre du doc, TOUT leur texte (rien de la carte n'est perdu) : 'attributs' = la ligne « Santé : … Chakra : … Barrière : … » (ou « [EP3] Santé : 330 … ») ; 'sante' / 'chak | **monstre_id**→monstre, **rang**, rubrique, titre?, texte, +provenance |
| `monstre_caracteristique` | F.P.V.S.I.A. d'une carte quand la rubrique est UNE ligne « F : 6 / P : 4 / V : 6 / S : 2 / I : 3 / A : 6 » (le sigle est écrit en clair sur la carte ; même ordre que creature_caracteristique). | **monstre_id**→monstre, **caracteristique_id**→caracteristique, rang, valeur, +provenance |
| `monstre_attaque` | Attaques : les lignes « Nom - texte » (ou « Nom: texte ») de la rubrique Dégâts dont le texte porte un nombre (« Pince - 2d10 + 2 dégâts d’estoc »). | **monstre_id**→monstre, **rang**, nom, texte, +provenance |
| `monstre_capacite_commune` | Capacités de monstre communes (décision R66 : « notées dans des tables à part (pour l'instant juste Nom et Description) histoire de mutualiser les capacités communes », « Elle change pour tous ») : le | **id**, nom, nom_cle, description, liste_de_sorts, +provenance |
| `monstre_capacite` | Capacités d'une carte : la place d'une capacité commune sur la carte (ordre du doc, préfixe « [EP2] Nom. | **monstre_id**→monstre, **rang**, prefixe?, ep_min?, capacite_commune_id→monstre_capacite_commune, sorts?, +provenance |
| `monstre_capacite_valeur` | Valeur d'un emplacement « {N} » de la description pour une carte qui n'a pas la valeur commune (R69 : « Minus » à 15 % pour le Gobelin demi-vie, la description écrivant {10}) ; sans ligne, la carte a la valeur commune. | **monstre_id**→monstre_capacite, **rang**→monstre_capacite, **numero**, valeur, +provenance |
| `monstre_defense` | Cibles des vulnérabilités, résistances, immunités et réflexions : la rubrique quand elle est UNE liste « Brûlure, Paralysie » de noms courts (« Varie selon la magie », un tableau ou plusieurs lignes : | **monstre_id**→monstre, **sens**, **rang**, cible, cible_cle, +provenance |

## 9. ÉQUIPEMENT, RESSOURCES, CRAFT, MÉTIERS (familles « equipement », « craft », « docs_typees »)

**Relations dans cette section** : `accessoire_effet_cible→accessoire_effet`, `accessoire_effet_gemme→accessoire_effet`, `accessoire_effet_gemme→ressource`, `accessoire_effet→accessoire_propriete`, `accessoire_monture→ressource`, `arme_degats→arme`, `arme_elementaire_type_competence→arme_elementaire_type`, `arme_elementaire_type_degats→arme_elementaire_type`, `arme_elementaire_type→arme_type`, `arme_elementaire→arme_type`, `arme_famille→arme_elementaire_type`, `arme_prerequis→arme`, `arme→arme_famille`, `arme→arme_type`, `armure_degats→armure`, `armure_elementaire_effet→armure_elementaire`, `armure→ressource`, `baton_magique→recette`, `bois→ressource`, `bouclier→bouclier_classe`, `bouclier→bouclier_poids`, `bouclier→ressource`, `familier_effet→familier`, `gemme→ressource`, `ingredient_alchimie→affinite`, `ingredient_alchimie→ressource`, `kit_alchimie→niveau_alchimie`, `kit_alchimie→ressource`, `maladie_methode→maladie`, `materiau_arme→ressource`, `materiau_armure→ressource`, `materiau_bouclier→ressource`, `materiau→ressource`, `metier_bonus→metier`, `metier_objet_depart→metier`, `metier_recette_famille→metier`, `potion_etat→ressource`, `potion→niveau_alchimie`, `potion→ressource`, `recette_ingredient→affinite`, `recette_ingredient→recette`, `recette_ingredient→ressource`, `recette_produit→recette`, `recette_produit→ressource`

**Vers d'autres sections** : `accessoire_effet→caracteristique (§2)`, `amelioration_equipement→page (§1)`, `arme_elementaire_type_competence→competence (§2)`, `arme_elementaire→magie (§3)`, `arme_prerequis→caracteristique (§2)`, `armure_elementaire→magie (§3)`, `baton_magique→magie (§3)`, `bois→magie (§3)`, `constante_equipement→page (§1)`, `gemme→magie (§3)`, `metier_bonus→competence (§2)`, `metier_objet_depart→objet_depart (§6)`, `metier→caracteristique (§2)`, `metier→page (§1)`, `potion_etat→etat (§4)`, `recette→caracteristique (§2)`, `recette→page (§1)`, `ressource→page (§1)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `monnaie` | Monnaies de l'onglet « Équipement inventaire » (MONNAIE A3:D7 et CONVERTISSEUR A12:D16). | **id**, nom, abreviation, valeur_rf, convertisseur_brut?, remarque?, +provenance |
| `constante_equipement` | Constantes chiffrées que la source écrit dans ses textes de règles et dont le modèle a besoin (« Toutes les armes ont de base 2 cran de solidité », « Chaque ingrédient indiqué dans une recette représente deux unités »…). | **id**, valeur, unite?, texte, page_id→page, remarque?, +provenance |
| `niveau_alchimie` | Niveaux de difficulté des recettes d'alchimie : Novice < Apprenti < Avancé < Expert < Maître (colonne « Niveau » des potions et table des kits : « Faire les recettes novice / apprentis ou moins / avancées ou moins… »). | **id**, nom, rang, remarque?, +provenance |
| `affinite` | Affinités alchimiques (colonne « Affinité » des listes d'ingrédients et cellules des tables « Recette »). | **id**, libelle, nb_composantes, remarque?, +provenance |
| `arme_famille` | Familles d'armes = bandeaux de l'onglet « Armes » (12 : ÉPÉES - D10, DAGUES - D6, … ARME DE MONSTRES). | **id**, libelle_brut, nom, de_brut?, note_brut?, cout_libelle, ordre, remarque?, maitrisable, categorie?, nom_lecture?, type_elementaire_id→arme_elementaire_type?, +provenance |
| `arme_type` | Types d'armes = table BDD!AD2:AF14 de la fiche automatique (13 types) : dé de dégâts et portée par défaut. | **id**, nom, de?, de_faces?, de_regle?, portee_min, portee_max, portee_brut, remarque?, +provenance |
| `ressource` | ▸ CATALOGUE : RESSOURCES Tout ce qui porte un nom et un prix dans les listes de la source et peut entrer dans une recette ou en sortir : matériaux, gemmes, bois, ingrédients d'alchimie, potions, matér | **id**, genre, section?, nom, nom_cle, description?, prix_brut?, prix_rf?, page_id→page, ordre?, remarque?, +provenance |
| `materiau_arme` | Matériau d'arme : onglet Armes › MATERIAUX (14 matières ; effet = « Dégâts +N pour l'arme » puis lignes d'effets secondaires). | **ressource_id**→ressource, prix_brut, prix_rf?, effet_brut, bonus_degats?, cran_solidite?, effet_secondaire?, ordre, remarque?, +provenance |
| `materiau_armure` | Matériau d'armure : « Fiches des matières de la grille » (en-têtes de colonne de l'onglet Armures, 21 matières). | **ressource_id**→ressource, type, prix?, prix_brut?, stats_brut, ap?, am?, solidite, ordre, remarque?, +provenance |
| `materiau_bouclier` | Matériau de bouclier : « Fiches des matières pour boucliers » (20 matières : pas de Peau). | **ressource_id**→ressource, prix?, prix_brut?, stats_brut, ap?, am?, solidite, ordre, +provenance |
| `materiau` | La fiche d'un matériau sur la page « Composants » (décision R62, migration 0041 : « La table des matériaux de l'onglet Composants devient désormais la seule source de vérité ») : son type, d'après l'a | **ressource_id**→ressource, type, +provenance |
| `gemme` | Gemmes précieuses (14, une par magie sauf le Potentiel Illimité : décision R160, « Il n'existe aucune gemme ni aucune piece élémentaire du PI » ; la contrainte gemme_sans_potentiel_illimite le refuse, | **ressource_id**→ressource, magie_id→magie, prix_commune_brut?, prix_commune_rf?, prix_raffinee_brut?, prix_raffinee_rf?, prix_parfaite_brut?, prix_parfaite_rf?, quart_commune_brut?, quart_commune_rf?, quart_raffinee_brut?, quart_raffinee_rf?, quart_parfaite_brut?, quart_parfaite_rf?, +provenance |
| `bois` | Bois pour bâton magique (14, un par magie) : onglet Bâton magique › MATERIAUX NECESSAIRE PAR MAGIE (Bois : Matière, Description, Prix). | **ressource_id**→ressource, magie_id→magie, +provenance |
| `ingredient_alchimie` | Ingrédients d'alchimie (Google Doc « Alchimie » › Liste d'ingrédient : 5 tables Solvant, Essence, Amplificateur, Catalyseur, Stabilisateur). | **ressource_id**→ressource, categorie, type_brut, type, majeur, affinite_brut, affinite_id→affinite, +provenance |
| `potion` | Potions (une ligne par palier : « Petite fiole rouge », « Grande huile givrante »…). | **ressource_id**→ressource, famille, rang, niveau_id→niveau_alchimie, effet, +provenance |
| `potion_etat` | État d'altération cité par l'effet d'une potion : « Inflige gel 1 » (huiles) ou « Réduit d'un cran la brûlure » (remèdes). | **ressource_id**→ressource, **etat_id**→etat, **action**, valeur?, texte, +provenance |
| `kit_alchimie` | Kits d'alchimie du Doc (table « Kit d'alchimie \| Prix \| Permet … »). | **ressource_id**→ressource, niveau_id→niveau_alchimie, permet_brut, +provenance |
| `fiole_verre` | Types de fioles de verre du Doc (table « Type de fiole en verre \| Niveau \| Nombre d'ingrédient »). | **id**, nom, niveau_brut, nb_ingredients_brut, nb_ingredients_min, nb_ingredients_ou_plus, ordre, remarque?, +provenance |
| `recette` | Une recette = une façon d'obtenir un ou plusieurs produits. | **id**, genre, famille?, nom, variante?, page_id→page, texte_brut?, produit_brut?, test_brut?, test_carac_1_id→caracteristique?, test_carac_2_id→caracteristique?, remarque?, +provenance |
| `recette_produit` | Produits d'une recette (une page de potions : tous les paliers Petite … Ultime ; un matériau : lui-même). | **recette_id**→recette, **ressource_id**→ressource, ordre, +provenance |
| `recette_ingredient` | Éléments d'une recette. | **recette_id**→recette, **rang**, **option**, texte, role?, emplacement?, quantite?, unite?, qualite?, ressource_id→ressource?, affinite_id→affinite?, +provenance |
| `baton_magique` | Bâtons magiques (onglet Bâton magique › « Bonus passifs » : 14 magies x 3 niveaux). | **id**, magie_id→magie, niveau, bonus_brut, recette_id→recette, remarque?, +provenance |
| `metier` | Métiers (Google Doc « MÉTIER » : une page par métier, 72). | **id**→page, nom, nom_cle, description, bonus_brut, artisanat_brut, peut_fabriquer, artisanat_texte?, test_brut?, test_carac_1_id→caracteristique?, test_carac_2_id→caracteristique?, equipement_brut, avantage_brut?, remarque?, +provenance |
| `metier_bonus` | Bonus d'un métier : le champ « Bonus » découpé sur les virgules suivies d'un signe (« +3% Esquive, +3% Réflexe » -> 2 rangs ; « Diplomatie OU Intimidation » -> 2 options du même rang). | **metier_id**→metier, **rang**, **option**, texte, valeur?, unite?, cible?, cible_cle?, competence_id→competence?, attribut?, +provenance |
| `metier_recette_famille` | Familles de recettes qu'un métier dit pouvoir fabriquer : le champ « Artisanat possible » cite « fioles », « philtres », « remèdes », « huiles », « alchimie primitive ». | **metier_id**→metier, **famille**, mot_source, +provenance |
| `metier_objet_depart` | Objets de départ d'un métier (décision R35 : l'« Équipement supplémentaire possible » s'ajoute à l'inventaire à la création du personnage) : le champ découpé comme l'inventaire de départ d'une classe | **metier_id**→metier, **rang**, **option**, texte, objet_depart_id→objet_depart?, +provenance |
| `arme` | Une ligne par arme listée (161 : 147 + 14 armes de monstres). | **id**, famille_id→arme_famille, type_id→arme_type, nom, nom_cle, nom_brut, mains?, categorie_brut, competence_brut?, cout_brut?, cout_ro?, effet?, description?, de?, de_faces?, de_source?, portee_min?, portee_max?, bonus_degats?, ignore_ap?, recharge?, solidite_fixee?, solidite_delta?, provenance_mot?, provenance?, depart_possible, ordre, remarque?, +provenance |
| `arme_degats` | Types de dégâts de l'arme : première clause « Dégâts taille/estoc » (ou « dégâts de frappe » des bombes) -> 1 ligne par type. | **arme_id**→arme, **type_degats**, +provenance |
| `arme_prerequis` | Minimums de caractéristique cités par l'effet : « 4 de Force minimum », « 3 de Force et Agilité minimum », « 5 d'Agilité obligatoire ». | **arme_id**→arme, **caracteristique_id**→caracteristique, minimum, exigence?, texte, +provenance |
| `arme_elementaire` | Armes élémentaires (onglet Pièces élémentaires : 11 types d'armes x 14 éléments). | **id**, type_id→arme_type, magie_id→magie, colonne_brut, nom, bonus_degats, element_brut, capacite_nom?, capacite_mode?, capacite_texte?, capacite_brut, ordre, remarque?, +provenance |
| `arme_elementaire_type` | Types élémentaires (décision R167, migration 0081) : les 11 types d'arme qui ont des armes élémentaires, un par en-tête de l'onglet Pièces élémentaires (colonne Q, lignes 8 à 78 : « ÉPÉE », « ARBALETE | **type_id**→arme_type, entete_brut, ignore_ap?, exemplaire_unique, mention?, ordre, type_degats_au_choix, +provenance |
| `arme_elementaire_type_competence` | Compétence d'une arme élémentaire, au choix du porteur parmi celles de son type (décision R167 : « l'arme s'adapte au porteur » ; réponse du propriétaire, migration 0081 : « Mêlée / arme de jets / bom | **type_id**→arme_elementaire_type, **competence_id**→competence |
| `arme_elementaire_type_degats` | Type physique d'une arme élémentaire (décision R167 : « Les deux. | **type_id**→arme_elementaire_type, **type_degats**, +provenance |
| `armure_emplacement` | Emplacements d'armure = onglet Armures › FABRICATION (« Armure \| Coût ») : Armure Complète, Casque, Torse, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droit (coquille de la source), Bouclier. | **id**, nom, cout_brut, cout_rf?, ordre, remarque?, +provenance |
| `armure` | Armures : 231 combinaisons de deux matières (grille matière x matière de l'onglet Armures) + 11 armures particulières (vêtements, cottes de mailles, armure montagne, armures de familiers). | **id**, sorte, nom, nom_cle, materiau_ligne_id→ressource?, materiau_colonne_id→ressource?, type, prix?, prix_brut?, stats_brut, ap?, am?, solidite, solidite_uni?, resistance_brut?, faiblesse_brut?, effet?, ordre, remarque?, +provenance |
| `armure_degats` | Résistances et faiblesses d'une armure : « Résistance : x2 Frappe », « Faiblesse : Estoc/Frappe » -> une ligne par type de dégâts. | **armure_id**→armure, **sens**, sens_brut, **type_degats**, multiplicateur?, +provenance |
| `armure_elementaire` | Armures élémentaires (onglet Pièces élémentaires : 4 catégories x 14 éléments = 56) : vêtement, armure légère, intermédiaire, lourde. | **id**, categorie, magie_id→magie, colonne_brut, nom, ap?, am?, effets_brut, ordre, remarque?, +provenance |
| `armure_elementaire_effet` |  | **armure_elementaire_id**→armure_elementaire, **rang**, texte, +provenance |
| `bouclier_classe` | Classes de boucliers (onglet Bouclier › « Classes de boucliers » : Bocle, Targe, Bouclier Rond, Écu, Pavoi). | **id**, nom, classe, prix, prix_brut, categorie_brut, remarque?, +provenance |
| `bouclier_poids` | Poids de boucliers (onglet Bouclier, liste « Léger / Moyen / Lourd / Très lourd » sous la mention « A refaire » : « il est necessaire d'avoir le score de Force ou plus »). | **id**, nom, force_min, force_brut, ordre, remarque?, +provenance |
| `bouclier` | Boucliers préfabriqués (100 : 5 classes x 20 matériaux). | **id**, classe_id→bouclier_classe, materiau_id→ressource, nom, prix?, prix_brut?, defense_brut, ap?, am?, remarque?, poids_id→bouclier_poids?, +provenance |
| `amelioration_equipement` | Améliorations (+1 à +10) : armes (Armes et Pièces élémentaires), armures (Armures), boucliers (Bouclier), armures élémentaires (Pièces élémentaires). | **id**, cible, niveau, cout_brut, cout_ro?, cout_materiaux?, cout_gemmes?, cout_gemmes_qualite?, cout_pieces_elementaires?, effet_brut, bonus_degats?, bonus_ap?, bonus_am?, bonus_cran?, page_id→page, remarque?, cout_elementaire_brut?, +provenance |
| `amelioration_total` | Ligne « TOTAL » de chaque tableau d'améliorations, telle qu'écrite (« 5 matériaux + 1520 RO ») ; celui des armures élémentaires est vide dans la source. | **cible**, total_brut?, +provenance |
| `accessoire_emplacement` | Étape 1 de la création (1d4) : emplacement de l'accessoire. | **id**, nom, jet, remarque?, +provenance |
| `accessoire_propriete` | Étape 2 (1d100) : propriété de l'accessoire. | **id**, nom, jet_min, jet_max, ordre, remarque?, +provenance |
| `accessoire_effet` | Étape 3 : effets possibles, par propriété (« SI CARACTERISTIQUE / COMPETENCE / ATTRIBUTS / ATTAQUE / DÉFENSE / JET DE DÉS / AUTRE »). | **id**, propriete_id→accessoire_propriete, jet, libelle?, caracteristique_id→caracteristique?, niveau?, niveau_brut?, bonus_min?, bonus_max?, gemmes_brut?, prix_brut?, prix_ro?, malediction, bonus_valeur?, bonus_cible?, ordre, remarque?, usage?, +provenance |
| `accessoire_effet_gemme` | Gemmes d'un effet d'accessoire (« Grenat + Malachite » : 2 rangs ; « Grenat/Malachite » ou « Turquoise ou + Perle ou … » : options d'un même rang). | **effet_id**→accessoire_effet, **rang**, **option**, gemme_id→ressource, nom_source, +provenance |
| `accessoire_effet_cible` | Ce que l'effet d'un accessoire change sur la fiche de personnage (demande du propriétaire, migration 0037 ; « une table adaptée, à l'instar des armes » : comme arme_degats, tirée de l'effet écrit par | **effet_id**→accessoire_effet, **rang**, cible, cible_id?, valeur?, choix, +provenance |
| `accessoire_monture` | Montures d'accessoires (onglet Accessoires › Monture : 5 niveaux ; « Un lingot permet de faire 2 montures d'anneau, 2 de collier… »). | **niveau**, materiau_id→ressource, prix_brut, prix_ro?, effet_brut, +provenance |
| `familier` | Familiers (onglet Familiers : petits familiers, gros familiers, montures). | **id**, categorie, nom, nom_cle, effet_brut?, description, ordre, remarque?, +provenance |
| `familier_effet` | Effets d'un petit familier : une ligne « - … » de la cellule « Effet » = une ligne. | **familier_id**→familier, **rang**, texte, +provenance |
| `batiment` | Bâtiments standard (onglet Maison › BATIMENT STANDARD). | **id**, nom, surface_brut, surface_m2?, materiaux_brut, materiaux_kg?, prix_brut, prix_min_ro?, prix_max_ro?, description, ordre, remarque?, +provenance |
| `machine_guerre` | Machines de guerre et de siège (onglet « Machine de GuerreSiège » : ATTAQUE AU SOL, ATTAQUE AU MUR, DEFENSE AU SOL). | **id**, categorie, nom, description, effet, degats?, points_de_vie?, ordre, remarque?, +provenance |
| `maladie` | Maladies : onglet « Maladie » (une ligne par maladie) et gabarit « Maladie V2 » (une seule maladie, Fièvre des marais, avec des champs en plus). | **id**, version, nom, nom_cle, effets?, nature?, lieu_contraction?, incubation_brut?, incubation_h_min?, incubation_h_max?, soin_methode_brut?, temps_soin_brut?, conseil?, description?, race_plus_sensible?, race_resistante?, race_immunisee?, ordre, remarque?, +provenance |
| `maladie_methode` | Listes du champ « Méthode de contraction » et « Méthode de soin » (lignes « - … » ou texte unique). | **maladie_id**→maladie, **sorte**, **rang**, texte, +provenance |

## 10. TRANSVERSAL : notes de cellule et écarts entre sources

**Relations dans cette section** : `note_cellule→note_cellule`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `note_cellule` | Notes et commentaires de cellule du classeur (lus dans le .xlsx : le dump JSON les porte dans `note` et `threads`) rattachés à l'entité qu'ils commentent. | **entite_table**→note_cellule, **entite_id**→note_cellule, **rang**, champ?, cellule?, nature?, repond_a→note_cellule?, texte, +provenance |
| `ecart_source` | Écarts constatés entre deux sources, ou anomalies d'une source (coquille, prix incohérent, forme non reconnue). | **id**, entite_table, entite_id, champ, nature, source_a, valeur_a?, source_b?, valeur_b?, detail, +provenance |
| `correction` | Corrections de coquilles et de fautes d'orthographe : TRACE MIROIR du registre versionné `tools/sheets/corrections.json` (décision du propriétaire : le registre est la source, il est appliqué au dump | **dump**, classeur, **onglet**, **cellule**, **champ**, **avant**, apres, occurrences, nature, note, +provenance |

## 11. TABLES DÉRIVÉES (jamais exportées dans data/rows/, recalculées par `npm run db:build`)

**Relations dans cette section** : `lien_candidat→lien`

**Vers d'autres sections** : `lien_candidat→page (§1)`, `lien→page (§1)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `lien` | *dérivée.* Chaque occurrence de [[cible\|ancre]] du corps (hors blocs ``` et `code`), dans l'ordre du texte. | **page_id**→page, **position**, cible, ancre, etat, cible_page_id→page? |
| `lien_candidat` | *dérivée.* Pages candidates d'un lien ambigu (les pages qui portent la même clé). | **page_id**→lien, **position**→lien, **candidat_page_id**→page |
| `page_fts` *(recherche)* | *dérivée.* Recherche plein texte. | page_id?, titre?, alias?, tag?, resume?, texte? |
| `entite_fts` *(recherche)* | *dérivée.* Recherche plein texte de TOUTES les entités typées (sorts, capacités, ethnies, créatures, armes, états…) : une seule table, un seul MATCH. | entite_table?, entite_id?, nom?, contexte?, texte? |

## 12. VUES (toujours à jour : rien à recalculer)

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `cle_page` *(vue)* | Index de résolution des [[liens]] = buildIndex() de wikilinks.mjs : toute clé normalisée -> pages qui la portent (slug, titre ou alias). |  |
| `lien_page` *(vue)* | Graphe de pages tel que le calcule wiki.ts : paires (depuis, vers) distinctes, liens résolus, sans lien d'une page vers elle-même. |  |
| `lien_a_creer` *(vue)* | « Pages à créer » : [[liens]] sans page (introuvables) ou ambigus. |  |
| `v_mot_cle` *(vue)* | Le vocabulaire des mots-clés et les pages qui les portent (page /recherche/ du site de dev : un mot-clé supprimé est retiré de nb_pages pages), avec sa définition (glossaire, migration 0056). |  |
| `v_magie_incompatible` *(vue)* | Relation d'incompatibilité symétrique : (a, b) est présent dans les deux sens dès que l'un des deux cite l'autre. |  |
| `v_sort_bonus_au_nm` *(vue)* | Les bonus de maîtrise d'un sort À UN NIVEAU DE MAÎTRISE DONNÉ (nm = 0, 1, 2, 3) : une ligne par (bonus, nm). |  |
| `v_race_carac_borne` *(vue)* | Bornes de saisie d'une caractéristique selon la race, telles que la fiche les calcule (BDD!K2:K24) : '>' est strict (« > 2 » = au moins 3), '<' est strict (« < 4 » = au plus 3), '=' fixe la valeur ; l |  |
| `v_race_classe_accessible` *(vue)* | Vues « seulement les 1 » : évitent l'erreur classique d'oublier `accessible = 1` (les lignes à 0 existent aussi). |  |
| `v_race_magie_accessible` *(vue)* |  |  |
| `v_regard_peuple` *(vue)* | Regard d'un peuple sur un autre (décision R12 : la case (ligne A, colonne B) de « Relation entre les races » dit comment A voit B). |  |
| `v_creature_magie` *(vue)* | Magies d'une créature : celles de la marge de son bloc (« Terre + Feu » -> Terre et Feu) ET celle du sort qui invoque son invocation (Terre pour tous les golems, Nécromancie pour les non-morts, Ombre |  |
| `v_creature_resistance` *(vue)* | Résistances, vulnérabilités, immunités et sensibilités d'une créature, toutes provenances confondues (une ligne par fait) : provenance 'capacite' : écrit dans une capacité de la créature (creature_cap |  |
| `v_creature_sort` *(vue)* | Sorts que peut lancer une créature (capacités « Lanceur de sorts » et « Sort supplémentaire »). |  |
| `v_creature_cout_invocation` *(vue)* | Coût d'invocation : il n'est PAS sur la carte, il est écrit sur le SORT qui invoque (colonnes « Coût » et « Coût secondaire », décisions R105 et R106 : « 6 » et « Par NPM de la créature invoquée », « |  |
| `v_creature_meme_bloc` *(vue)* | « Autre créature du bloc » (ligne de la page actuelle) : la ou les autres cartes du même bloc. |  |
| `v_arme` *(vue)* | Arme avec les valeurs « effectives » : portée écrite dans l'effet, sinon portée par défaut du type (BDD!AF de la fiche) ; solidité de l'arme nue (2 crans de base, règle de l'onglet, corrigée par « 1 s |  |
| `v_ingredient_possible` *(vue)* | Ingrédients qui conviennent à un emplacement d'alchimie : même catégorie et même affinité ; l'emplacement « Amplificateur majeur » n'accepte que les ingrédients marqués « (majeur) », les autres emplac |  |
| `v_ressource_recette` *(vue)* | « Recettes qui utilisent la ressource X » : ressource citée par son nom dans la recette (via = 'nommee') ou ingrédient d'alchimie qui répond à l'exigence d'un emplacement (via = 'affinite'). |  |
| `v_metier_recette` *(vue)* | Recettes d'un métier : par famille citée dans « Artisanat possible » (alchimie seulement, voir metier_recette_famille). |  |
| `v_potion` *(vue)* | Potions avec leur niveau, leur prix et leurs recettes (une ligne par potion et variante de recette de sa page). |  |
| `v_objet_ceinture` *(vue)* | Objets à la ceinture (décision R81 ; page « Ceinture » /ressources/objets-a-la-ceinture/, onglet « Ceinture » de /ressources/equipement/ jusqu'au 2026-10-29) : les objets du catalogue que la page list |  |
| `v_arme_composee` *(vue)* | Arme forgée dans un matériau : « tous les bonus se cumulent une fois l'arme forgée (exemple : une claymore en cuivre donne un bonus aux dégâts de +10 car le cuivre donne +5 aux dégâts et la claymore d |  |
| `v_armure_piece` *(vue)* | Une armure sur chacune de ses six pièces (Casque, Torse, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droit) : lecture de la fiche, qui recopie l'AP, l'AM et la solidité de l'armure choisie sur les six pièces. |  |
| `v_niveau` *(vue)* | Le moteur de la fiche, niveau par niveau : cumuls des dons du guide et valeurs par palier de la fiche. |  |
| `v_competence` *(vue)* | Compétences avec leur caractéristique : le moteur n'a pas à joindre. |  |
| `v_resistance_combinaison` *(vue)* | Résistances et faiblesses d'une combinaison de deux magies (bi-magie ; décision R85 : « Les résistance/ faiblesses des deux magies se cumulent (ou s'annulent si opposées) », « Il en faut une liste ») |  |
| `v_mode_hyper_lectures` *(vue)* | Les cinq LECTURES du mode hyper (mode_hyper_effet.version) sur une même ligne : une ligne par cible (magie, couple de magies ou race) et variante. |  |
| `v_classe_capacite` *(vue)* | Une capacité par ligne avec sa classe et sa spécialité à plat : la vue à interroger pour « toutes les capacités d'une classe au niveau N ». |  |
| `v_capacite_exclusive` *(vue)* | Choix exclusifs, lus dans la mise en page (règle du propriétaire, client/src/lib/capacites.mjs) : deux capacités sont des alternatives quand elles sont côte à côte sur la même ligne de l'onglet : deux |  |
| `v_capacite_partagee` *(vue)* | Capacités écrites à l'identique (nom, type, effet, note de cellule) à plusieurs endroits : une ligne par contenu. |  |

## 13. PERSONNAGES : les vraies fiches (joueurs et prétirés), les groupes de jeu et la visibilité (saisie, jamais importée ; migration 0011)

**Relations dans cette section** : `groupe_membre→groupe`, `groupe_membre→personnage`, `groupe_membre→utilisateur`, `personnage_accessoire→personnage`, `personnage_acquis_choix→personnage`, `personnage_action_usage→personnage`, `personnage_arme→personnage`, `personnage_armure_partie→personnage`, `personnage_capacite→personnage`, `personnage_caracteristique→personnage`, `personnage_ceinture→personnage`, `personnage_classe→personnage`, `personnage_competence→personnage`, `personnage_don_obtenu→personnage`, `personnage_entrainement→personnage`, `personnage_inventaire→personnage`, `personnage_livre_sort→personnage`, `personnage_maitrise_choix→personnage`, `personnage_metier_bonus→personnage`, `personnage_partage→personnage`, `personnage_partage→utilisateur`, `personnage_resistance_choix→personnage`, `personnage_sort→personnage`, `personnage→utilisateur`, `utilisateur_role→utilisateur`

**Vers d'autres sections** : `personnage_accessoire→accessoire_effet (§9)`, `personnage_accessoire→arme_famille (§9)`, `personnage_accessoire→competence (§2)`, `personnage_acquis_choix→competence (§2)`, `personnage_arme→amelioration_equipement (§9)`, `personnage_arme→arme (§9)`, `personnage_arme→arme_elementaire (§9)`, `personnage_arme→materiau_arme (§9)`, `personnage_armure_partie→armure_emplacement (§9)`, `personnage_capacite→capacite (§6)`, `personnage_caracteristique→caracteristique (§2)`, `personnage_ceinture→ressource (§9)`, `personnage_classe→classe (§6)`, `personnage_classe→specialite (§6)`, `personnage_competence→competence (§2)`, `personnage_don_obtenu→capacite (§6)`, `personnage_don_obtenu→classe_annexe_entree (§6)`, `personnage_entrainement→competence (§2)`, `personnage_inventaire→ressource (§9)`, `personnage_livre_sort→sort (§3)`, `personnage_maitrise_choix→arme_famille (§9)`, `personnage_metier_bonus→competence (§2)`, `personnage_resistance_choix→etat (§4)`, `personnage_resistance_choix→magie (§3)`, `personnage_sort→posture (§2)`, `personnage_sort→sort (§3)`, `personnage→amelioration_equipement (§9)`, `personnage→armure (§9)`, `personnage→armure_elementaire (§9)`, `personnage→bouclier_classe (§9)`, `personnage→caracteristique (§2)`, `personnage→dieu (§5)`, `personnage→ethnie (§7)`, `personnage→magie (§3)`, `personnage→materiau_bouclier (§9)`, `personnage→metier (§9)`, `personnage→posture (§2)`, `personnage→race (§7)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `utilisateur` | Personne qui se connecte au site. | **id**, discord_id?, nom_affichage, cree_le |
| `utilisateur_role` | Rôles d'un utilisateur, cumulables (la correspondance rôle Discord -> rôle du site est une configuration, pas une donnée) : 'mj' = maître du jeu (le « groupe MJ » : cible de la visibilité 'mj' d'une f | **utilisateur_id**→utilisateur, **role** |
| `personnage` | Une fiche de personnage : le haut de l'onglet Personnage (identité, magies, alignement, bourse, expérience) et les choix uniques. | **id**, nature, proprietaire_id→utilisateur?, visibilite, nom, surnom?, lieu_origine?, race_id→race?, ethnie_id→ethnie?, magie_innee_id→magie?, magie_acquise_id→magie?, caracteristique_magie_id→caracteristique?, dieu_choisi_id→dieu?, metier_id→metier?, mode_classe, xp, alignement_loyal, alignement_chaotique, alignement_bon, alignement_mauvais, bourse_pp, bourse_ro, bourse_rf, ambidextrie, bouclier_classe_id→bouclier_classe?, sante_actuelle?, chakra_actuel?, barriere_actuelle?, corruption?, barre4_actuelle?, notes?, evenements?, cree_le, modifie_le, posture_id→posture?, portrait?, portrait_x?, portrait_y?, portrait_zoom?, gains_sante, gains_chakra, armure_id→armure?, armure_amelioration_id→amelioration_equipement?, armure_elementaire_id→armure_elementaire?, armure_amelioration_elementaire_id→amelioration_equipement?, bouclier_materiau_id→materiau_bouclier?, bouclier_amelioration_id→amelioration_equipement?, bouclier_solidite?, symbiose_magie_id→magie?, nm_mj, mode_hyper, mode_hyper_100, mode_hyper_semaine? |
| `personnage_partage` | Utilisateurs à qui le propriétaire montre sa fiche en plus de sa visibilité (« un utilisateur spécifique », plusieurs possibles). | **personnage_id**→personnage, **utilisateur_id**→utilisateur |
| `personnage_classe` | Classes du personnage : « CLASSE » 1 (A9) et 2 (A11), chacune avec sa spécialité (I9, I11 : choisie au niveau de classe 10). | **personnage_id**→personnage, **rang**, classe_id→classe, specialite_id→specialite? |
| `personnage_caracteristique` | Valeur de base de chaque caractéristique (E18, M18, U18, E19, M19, U19), choisie dans les bornes de la race (v_race_carac_borne) ; le total suit seuil_niveau 'caracteristiques_total' (décision R3 : exactement). | **personnage_id**→personnage, **caracteristique_id**→caracteristique, base, croix |
| `personnage_competence` | Points de compétence : « Nat. | **personnage_id**→personnage, **competence_id**→competence, naturel |
| `personnage_entrainement` | « Entraînement » (L42 du modèle ordinateur ; décision R104, migration 0062, qui remplace personnage.entrainement, un texte libre : décision R71) : des lignes qu'on ajoute, chacune un entraînement de c | **personnage_id**→personnage, **rang**, competence_id→competence?, valeur?, texte? |
| `personnage_acquis_choix` | Acquis à choisir (décision R104 : « Armes légères ou lourdes » dans le texte d'un don devient un choix du tiroir) : pour un don débloqué de la fiche (capacite.id ou race_don.id, `source` : pas de clé | **personnage_id**→personnage, **source**, **rang**, **competence_id**→competence, valeur? |
| `personnage_resistance_choix` | Résistance à choisir (décision R124, migration 0069) : Drakos orange, tableau « Écaille draconique » de l'onglet de la race, colonne « +1 cran de résistance » : « Au choix parmi les autres » = « au ch | **personnage_id**→personnage, **source**, **rang**, etat_id→etat?, magie_id→magie? |
| `personnage_metier_bonus` | Bonus de métier choisis (décision R33 : « En cas de choix c'est à saisir dans la fiche de personnage ») : pour chaque rang de metier_bonus du métier de la fiche qui propose plusieurs compétences (« +3 | **personnage_id**→personnage, **rang**, competence_id→competence |
| `personnage_capacite` | Dons de classe choisis (lignes « CLASSE 1 » / « CLASSE 2 », C43:L67) : seulement ceux qui demandent un CHOIX (v_capacite_exclusive : options d'une même ligne, une spécialité contre l'autre, paliers de l'Archimage). | **personnage_id**→personnage, **capacite_id**→capacite |
| `personnage_don_obtenu` | Don obtenu par un don « Variable » du Mage Bleu (décision R181, migration 0088 ; pas de case dans la fiche auto V15.2.2) : une ligne par don « Variable » (capacite_variable) qui a son choix : `source` | **personnage_id**→personnage, **source**→capacite, entree_id→classe_annexe_entree |
| `personnage_sort` | « LISTE DE SORTS » (AA55:AY74) : sorts de la magie innée ou acquise, avec leur niveau de maîtrise (« NM », AY). | **personnage_id**→personnage, **sort_id**→sort, rang, niveau_maitrise, prepare, prepare_jet?, prepare_posture_id→posture?, prepare_hyper, prepare_cent, prepare_critique? |
| `personnage_livre_sort` | Livres de sort lus (ligne « Livre de sort » de l'entraînement, décision R104 ; décision R169, migration 0082 : « on peux apprendre n'importe quel "entainement" livre de sort pour n'importe quel sort d | **personnage_id**→personnage, **sort_id**→sort, rang |
| `personnage_maitrise_choix` | « Maîtrise d'armes » (AA2:AV7 de la fiche auto : des dés saisis par famille, jusqu'à la migration 0076, table personnage_maitrise_arme) : depuis la décision R148 (« la valeur ne sera plus des sliders | **personnage_id**→personnage, **source**, **rang**, arme_famille_id→arme_famille |
| `personnage_arme` | « ARMES » (AA9:AY18) : deux emplacements. | **personnage_id**→personnage, **rang**, arme_id→arme?, materiau_id→materiau_arme?, amelioration_id→amelioration_equipement?, arme_elementaire_id→arme_elementaire?, effet_en_plus?, durabilite?, type_degats_choisi? |
| `personnage_armure_partie` | « ARMURE / DÉFENSE » (AA19:AX23) : la solidité du moment des parties de l'armure portée, de base (personnage.armure_id) ou élémentaire (personnage.armure_elementaire_id, décision R165) ; décision R95, | **personnage_id**→personnage, **emplacement_id**→armure_emplacement, solidite |
| `personnage_accessoire` | « ACCESSOIRES » (AA28:AY37) : Chef, Collier, Bracelet 1 et 2, Bague 1 et 2 (décision R97, migration 0060 : plus de Ceinture ni d'Autre, ni de nom donné à l'objet, ni d'effet hors table). | **personnage_id**→personnage, **emplacement**, accessoire_effet_id→accessoire_effet, valeur?, maudit, competence_id→competence?, arme_famille_id→arme_famille? |
| `personnage_inventaire` | « INVENTAIRE \| SAC » (AA39:AY…) : une ligne par objet ; `ressource_id` quand l'objet est au catalogue, sinon le nom seul. | **personnage_id**→personnage, **rang**, nom, quantite, ressource_id→ressource? |
| `personnage_ceinture` | La ceinture (demande du propriétaire, migration 0031) : ses 3 emplacements d'objets rapides, utilisables en IC (guide « Fiche de personnage : Accessoires et Ceinture » : « La ceinture […] possède 3 em | **personnage_id**→personnage, **rang**, nom, quantite, ressource_id→ressource? |
| `personnage_action_usage` | Compteurs d'usage des actions (décision R173, migration 0085 : « Il faudrait lister toutes les actions utilisables […]. | **personnage_id**→personnage, **action_id**, restants |
| `groupe` | Groupe de jeu : la table d'un one-shot (« OS ») ou d'une campagne. | **id**, nom, nature, cree_le |
| `groupe_membre` | Membres d'un groupe et fiche inscrite (demande du propriétaire) : un joueur peut être dans plusieurs groupes et avoir plusieurs fiches, mais n'inscrit qu'UNE fiche par groupe : une ligne par (groupe, | **groupe_id**→groupe, **utilisateur_id**→utilisateur, role, personnage_id→personnage?, rejoint_le |
| `v_personnage_niveau` *(vue)* | Niveau global et niveaux de classe d'un personnage. |  |
| `v_personnage_metier_bonus` *(vue)* | Bonus que le métier d'une fiche apporte (décision R33) : une ligne par rang lié de metier_bonus (compétence ou attribut) — l'option seule du rang, ou, quand le rang en propose plusieurs, celle que la |  |
| `v_personnage_don_acquis` *(vue)* | Dons acquis d'une fiche (décision R32, migration 0076) : le miroir de lib/fiche-moteur.mjs#donsAcquis. |  |
| `v_personnage_maitrise_part` *(vue)* | Sources de maîtrise d'arme acquises par une fiche (décisions R32, R148) : les parts (maitrise_arme_part) des lignes de classe_maitrise_arme des classes prises, dès le niveau de classe 1, et des dons a |  |
| `v_personnage_maitrise_arme` *(vue)* | Points de maîtrise d'arme d'une fiche, par famille (décisions R148, R149, R151, R54, migration 0076) : le pendant SQL du calcul de la page /fiche/. |  |
| `v_personnage_visible` *(vue)* | Qui voit quelle fiche (demande du propriétaire) : une ligne par (fiche, utilisateur, motif) ; un utilisateur voit une fiche s'il a au moins une ligne. |  |
| `v_groupe_controle` *(vue)* | Contrôle des inscriptions dans les groupes : une ligne par anomalie (vide = conforme). |  |
| `v_personnage_controle` *(vue)* | Contrôle d'une fiche : une ligne par règle enfreinte (vide = fiche conforme pour ces règles). |  |

## 14. ÉDITION : le journal des modifications faites depuis le site de dev (saisie, jamais importée ; migration 0017)

**Relations dans cette section** : `modification_lot→modification_lot`, `modification→modification_lot`

**Vers d'autres sections** : `modification_lot→utilisateur (§13)`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `modification_lot` | Un enregistrement fait depuis une page (le bouton de confirmation) : toutes ses modifications passent ou aucune. | **id**, fait_le, auteur_id→utilisateur?, page_id?, resume, resolu_le?, resolu_par→modification_lot?, resolution? |
| `modification` | Une ligne de table touchée par un lot. | **lot_id**→modification_lot, **rang**, table_nom, cle, operation, avant?, apres?, etat, detail?, apercu? |
| `note_version_brouillon` | La note de version en préparation sur le site de dev (page /mise-a-jour/ : le champ libre que les admins remplissent, en plus de la liste calculée ; migration 0023). | **id**, texte?, modifie_le?, lot?, majeure? |

## 15. NOTES DE VERSION : ce que chaque version a changé dans les règles, et l'historique des modifications faites sur le site de dev

**Relations dans cette section** : `historique_modification→note_version`, `note_version_ligne→note_version`

| Table | Rôle | Colonnes |
| --- | --- | --- |
| `note_version` | Une version livrée (dev → master) : « 0.2 » (X.Y : la production ne porte que deux chiffres), sa date, le champ libre des admins. | **version**, publiee_le, depuis?, texte?, lot?, exemple |
| `note_version_ligne` | Une ligne de la liste calculée : une modification d'un champ d'une entité entre la production et la nouvelle version. | **version**→note_version, **rang**, domaine, groupe?, entite, champ?, nature, avant?, apres?, sens, parties?, table_nom?, cle?, colonne? |
| `historique_modification` | Le journal du site de dev une fois livré (une ligne par ligne de table touchée, comme `modification`) : qui a changé quoi, quand, avant et après (docs/feuille-de-route.md : modifications historisées). | **lot_id**, **rang**, fait_le, resume, version→note_version?, table_nom, cle, operation, avant?, apres? |
