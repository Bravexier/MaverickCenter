# Structure de la base de données

> **Document généré** depuis [`data/schema.sql`](../../data/schema.sql) par `npm run db:doc` (dans `client/`) : ne pas l'éditer à la main, la CI vérifie qu'il est à jour (`npm run db:doc -- --check`).
> Schéma version 23 : 166 tables, 2 tables de recherche plein texte (FTS5) et 34 vues. Les conventions de nommage et de typage sont en tête du schéma ; le raisonnement est dans [`conception.md`](conception.md) (les commentaires du schéma l'appellent `design.md`).

« Obligatoire » = `NOT NULL` ou clé primaire. Une colonne `*_brut` garde le texte de la source quand la colonne typée voisine n'a pas pu être déduite sans ambiguïté. Une table **dérivée** est recalculée par `npm run db:build` : elle n'est jamais exportée ni éditée.

## Sommaire

- [0. FAMILLES D'IMPORT](#0-familles-dimport) : `famille`
- [1. PAGES, LIENS, MOTS-CLÉS, SOURCES (couche générique)](#1-pages-liens-mots-clés-sources-couche-générique) : `type_page`, `page`, `alias`, `page_tag`, `source`, `page_source`, `page_entite`
- [2. RÈGLES DE LA FICHE : caractéristiques, compétences, niveaux, constantes, postures (famille « fiche »)](#2-règles-de-la-fiche--caractéristiques-compétences-niveaux-constantes-postures-famille--fiche) : `caracteristique`, `competence`, `niveau_global`, `niveau_deblocage`, `seuil_niveau`, `regle_constante`, `entrainement_palier`, `initiative_agilite`, `type_don`, `posture`, `posture_effet`
- [3. MAGIES ET SORTS (famille « magies »)](#3-magies-et-sorts-famille--magies) : `magie`, `magie_role`, `magie_resistance`, `magie_incompatibilite`, `magie_ethnie_secondaire`, `magie_dieu`, `amelioration_cadaverique`, `sort`, `sort_type`, `sort_mode`, `sort_bonus_maitrise`, `sort_etat`, `commentaire_orphelin`, `legende_sort`, `regle_magie`
- [4. ANNEXES DES MAGIES : états, résistances, météo, modes hyper et super (famille « annexes »)](#4-annexes-des-magies--états-résistances-météo-modes-hyper-et-super-famille--annexes) : `resistance_palier`, `resistance_magie`, `resistance_duo`, `resistance_combinaison`, `etat`, `etat_magie`, `etat_stade`, `etat_palier`, `meteo`, `meteo_effet`, `mode_texte`, `mode_hyper_depassement`, `mode_super_objet`, `mode_hyper_effet`
- [5. DIEUX](#5-dieux) : `dieu`
- [6. CLASSES, SPÉCIALITÉS, CAPACITÉS (famille « classes »)](#6-classes-spécialités-capacités-famille--classes) : `categorie_classe`, `classe`, `specialite`, `capacite`, `objet_depart`, `classe_objet_depart`, `classe_maitrise_armure`, `classe_maitrise_arme`, `classe_annexe`
- [7. RACES, ETHNIES, ACCESSIBILITÉS (famille « races »)](#7-races-ethnies-accessibilités-famille--races) : `race`, `race_restriction_carac`, `ethnie`, `ethnie_resistance`, `race_classe`, `race_magie`, `race_onglet`, `race_don`, `race_don_tableau_colonne`, `race_don_tableau_ligne`, `race_don_tableau_cellule`, `race_magie_onglet`, `echelle_relation`, `peuple`, `relation_peuple`
- [8. BESTIAIRE : invocations et créatures (famille « bestiaire »)](#8-bestiaire--invocations-et-créatures-famille--bestiaire) : `invocation`, `invocation_capacite_commune`, `invocation_resistance`, `invocation_bloc`, `invocation_bloc_magie`, `creature`, `creature_ressource`, `creature_caracteristique`, `creature_bonus_npm`, `creature_attaque`, `creature_attaque_type`, `creature_capacite`, `creature_capacite_sort`, `creature_capacite_resistance`, `creature_effet`
- [9. ÉQUIPEMENT, RESSOURCES, CRAFT, MÉTIERS (familles « equipement », « craft », « docs_typees »)](#9-équipement-ressources-craft-métiers-familles--equipement---craft---docstypees) : `monnaie`, `constante_equipement`, `niveau_alchimie`, `affinite`, `arme_famille`, `arme_type`, `ressource`, `materiau_arme`, `materiau_armure`, `materiau_bouclier`, `gemme`, `bois`, `ingredient_alchimie`, `potion`, `potion_etat`, `kit_alchimie`, `fiole_verre`, `recette`, `recette_produit`, `recette_ingredient`, `baton_magique`, `metier`, `metier_bonus`, `metier_recette_famille`, `arme`, `arme_degats`, `arme_prerequis`, `arme_elementaire`, `armure_emplacement`, `armure`, `armure_degats`, `armure_elementaire`, `armure_elementaire_effet`, `bouclier_classe`, `bouclier_poids`, `bouclier`, `amelioration_equipement`, `amelioration_total`, `accessoire_emplacement`, `accessoire_propriete`, `accessoire_effet`, `accessoire_effet_gemme`, `accessoire_monture`, `familier`, `familier_effet`, `batiment`, `machine_guerre`, `maladie`, `maladie_methode`
- [10. TRANSVERSAL : notes de cellule et écarts entre sources](#10-transversal--notes-de-cellule-et-écarts-entre-sources) : `note_cellule`, `ecart_source`, `correction`
- [11. TABLES DÉRIVÉES (jamais exportées dans data/rows/, recalculées par `npm run db:build`)](#11-tables-dérivées-jamais-exportées-dans-datarows-recalculées-par-npm-run-dbbuild) : `lien`, `lien_candidat`, `page_fts`, `entite_fts`
- [12. VUES (toujours à jour : rien à recalculer)](#12-vues-toujours-à-jour--rien-à-recalculer) : `cle_page`, `lien_page`, `lien_a_creer`, `tag`, `v_magie_incompatible`, `v_sort_bonus_au_nm`, `v_race_carac_borne`, `v_race_classe_accessible`, `v_race_magie_accessible`, `v_regard_peuple`, `v_creature_magie`, `v_creature_resistance`, `v_creature_sort`, `v_creature_cout_invocation`, `v_creature_meme_bloc`, `v_arme`, `v_ingredient_possible`, `v_ressource_recette`, `v_metier_recette`, `v_potion`, `v_arme_composee`, `v_armure_piece`, `v_niveau`, `v_competence`, `v_resistance_magie_lectures`, `v_resistance_ecart`, `v_mode_hyper_lectures`, `v_classe_capacite`, `v_capacite_exclusive`, `v_capacite_partagee`
- [13. PERSONNAGES : les vraies fiches (joueurs et prétirés), les groupes de jeu et la visibilité (saisie, jamais importée ; migration 0011)](#13-personnages--les-vraies-fiches-joueurs-et-prétirés-les-groupes-de-jeu-et-la-visibilité-saisie-jamais-importée--migration-0011) : `utilisateur`, `utilisateur_role`, `personnage`, `personnage_partage`, `personnage_classe`, `personnage_caracteristique`, `personnage_competence`, `personnage_progression`, `personnage_capacite`, `personnage_sort`, `personnage_maitrise_arme`, `personnage_arme`, `personnage_armure`, `personnage_bouclier_materiau`, `personnage_accessoire`, `personnage_inventaire`, `groupe`, `groupe_membre`, `v_personnage_niveau`, `v_personnage_visible`, `v_groupe_controle`, `v_personnage_controle`
- [14. ÉDITION : le journal des modifications faites depuis le site de dev (saisie, jamais importée ; migration 0017)](#14-édition--le-journal-des-modifications-faites-depuis-le-site-de-dev-saisie-jamais-importée--migration-0017) : `modification_lot`, `modification`, `note_version_brouillon`
- [15. NOTES DE VERSION : ce que chaque version a changé dans les règles (page /mise-a-jour/), et l'historique des modifications faites sur le](#15-notes-de-version--ce-que-chaque-version-a-changé-dans-les-règles-page-mise-a-jour-et-lhistorique-des-modifications-faites-sur-le) : `note_version`, `note_version_ligne`, `historique_modification`

## 0. FAMILLES D'IMPORT

### `famille`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'magies', 'classes', 'docs', 'docs_typees'… |
| `libelle` | TEXT | oui | unique |  |
| `importeur` | TEXT | non |  | script qui écrit la famille (tools/…) ; NULL = saisie directe (docs, exemple) |
| `sources` | TEXT | non |  | classeurs / Docs d'origine, en clair |
| `ordre` | INTEGER | oui | unique | rang de livraison des importeurs (design.md §11). PAS un ordre de dépendance : fiche, annexes, magies, classes et races se citent mutuellement (noyau des règles) et se réimportent ENSEMBLE (design.md §4.2) |

## 1. PAGES, LIENS, MOTS-CLÉS, SOURCES (couche générique)

### `type_page`

Registre des catégories du wiki : reprend client/src/lib/types.mjs (aujourd'hui une constante JavaScript). Les 10 clés existent même quand aucune page n'y est encore rangée (cartes).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | clé = nom de dossier : 'races', 'guide', 'metiers'… |
| `libelle` | TEXT | oui |  | 'Races', 'Ressources & craft'     (types.mjs : label) |
| `singulier` | TEXT | oui |  | 'Race', 'Ressource'                (types.mjs : singular) |
| `salon_discord` | TEXT | oui |  | salon source dans « L'univers de Maverick » (types.mjs : discord) |
| `description` | TEXT | oui |  | phrase d'accueil                   (types.mjs : blurb) |
| `ordre` | INTEGER | oui | unique | rang d'affichage (ordre de déclaration dans types.mjs) |

### `page`

Une page du wiki = un fichier client/src/content/wiki/<type>/<slug>.md d'aujourd'hui.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<type>/<slug>' ; identique à l'id de la collection Astro |
| `type` | TEXT | oui | → type_page.id |  |
| `slug` | TEXT | oui |  |  |
| `titre` | TEXT | oui |  | frontmatter `title` |
| `titre_cle` | TEXT | oui |  | normalize(titre) (text.mjs) : clé de tri et de comparaison. Calculée par l'importeur ; client/scripts/db-derive.mjs refuse la base si elle diffère. |
| `resume` | TEXT | non |  | frontmatter `summary` ; NULL = absent de la source |
| `donnees` | TEXT | non |  |  |
| `corps_md` | TEXT | oui |  | corps Markdown, octet pour octet. Le fichier .md ajoute seulement la ligne vide qui suit l'en-tête (présente dans les 330 pages). |
| `statut` | TEXT | oui |  | frontmatter `status` (valeurs de zod) |
| `origine` | TEXT | oui | → famille.id | clé de l'importeur : docs, magies, classes, races, bestiaire, equipement, craft, annexes ; 'exemple' pour les fixtures de démo |
| `source_ref` | TEXT | non |  | provenance fine, lisible : « Google Sheet « Magie Maverick V8 », onglet « Feu » ». NULL quand la source n'en cite aucune (pages d'exemple). |

### `alias`

Alias d'une page (frontmatter `aliases`) : autres noms utilisables dans [[ ]]. `texte` garde l'écriture d'origine ; `cle` est sa forme normalisée (casse, accents, apostrophes ignorés), celle qui sert à retrouver la page (vue cle_page).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `page_id` | TEXT | oui | PK 1, → page.id |  |
| `ordre` | INTEGER | oui | PK 2 | rang dans la liste `aliases:` (0 = premier) : l'ordre est conservé |
| `texte` | TEXT | oui |  |  |
| `cle` | TEXT | oui |  | normalize(texte), calculé par l'importeur ; client/scripts/db-derive.mjs le vérifie |

### `page_tag`

Mots-clés d'une page (frontmatter `tags`). tag_id = normalize(libelle) : c'est la clé de l'URL /tags/<tag_id>/ (les écritures « espace/temps », « espace temps » et « espace-temps » sont UN seul mot-clé). Il n'y a pas de table `tag` : les mots-clés n'ont aucun attribut dans les sources, ils se déduisent de page_tag (voir la vue `tag` plus bas), donc ni orphelin à nettoyer après une réimportation, ni règle d'écriture à maintenir.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `page_id` | TEXT | oui | PK 1, → page.id |  |
| `ordre` | INTEGER | oui | PK 2 | rang dans la liste `tags:` |
| `tag_id` | TEXT | oui |  | normalize(libelle), calculé par l'importeur ; client/scripts/db-derive.mjs le vérifie |
| `libelle` | TEXT | oui |  | écriture sur CETTE page (conserve la source sans perte) |

### `source`

Provenance au niveau de la page : une entrée de frontmatter `sources` = une ligne (texte exact). Deux natures : une URL (https://docs.google.com/…) ou un libellé (« Google Sheet « Invocation », onglet « Appel aux golems » »). L'appariement libellé <-> URL n'est PAS dans la source (un libellé peut précéder plusieurs URL) : il n'est pas déduit. Les colonnes genre, google_id, fichier et onglets ne sont que des extraits mécaniques du texte, jamais une interprétation.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'google-doc:<id>' \| 'google-sheet:<id>' \| 'url:<url>' \| 'ref:<normalize(texte)>' |
| `nature` | TEXT | oui |  |  |
| `texte` | TEXT | oui | unique | entrée exacte de `sources:` |
| `url` | TEXT | non |  | = texte pour une URL, NULL sinon |
| `genre` | TEXT | non |  | « Google Doc » / « Google Sheet », ou /document/d/ / /spreadsheets/d/ |
| `google_id` | TEXT | non |  | identifiant du fichier Google extrait de l'URL (clé `id` de sources/sources.json) |
| `fichier` | TEXT | non |  | titre du fichier cité par « Google Doc\|Sheet « … » », sinon NULL |
| `onglets` | TEXT | non |  | liste JSON des onglets cités (« onglet(s) « … » »), sinon NULL |

### `page_source`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `page_id` | TEXT | oui | PK 1, → page.id |  |
| `ordre` | INTEGER | oui | PK 2 | rang dans la liste `sources:` |
| `source_id` | TEXT | oui | → source.id |  |

### `page_entite`

Lien page -> entité typée. Chaque importeur de domaine écrit ses lignes (test de complétude : db:check). Convention d'id : l'entité qui a SA page réutilise l'id de la page (principale = 1) ; une sous-entité a l'id '<id de la page qui la contient>#<sorte>:<slug>' (principale = 0). `entite_table` n'est pas une clé étrangère (SQLite ne vise pas une table variable) : db:check vérifie que (entite_table, entite_id) existe.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `entite_table` | TEXT | oui | PK 1 | 'magie', 'sort', 'classe', 'race'… |
| `entite_id` | TEXT | oui | PK 2 |  |
| `page_id` | TEXT | oui | → page.id, unique | sans CASCADE : les lignes se balaient par `origine` (design.md §4.2) |
| `principale` | INTEGER | oui |  | 1 = la page EST cette entité ; 0 = la page la contient |
| `origine` | TEXT | oui | → famille.id |  |

## 2. RÈGLES DE LA FICHE : caractéristiques, compétences, niveaux, constantes, postures (famille « fiche »)

### `caracteristique`

Les six caractéristiques (Personnage!B18:R19). Valeurs de base, bornes et bonus : voir regle_constante, seuil_niveau et, pour les restrictions par race, race_restriction_carac / v_race_carac_borne (domaine races).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui | unique | « Force » (étiquette de la fiche) |
| `lettre` | TEXT | oui | unique | suffixe des compétences : « Arc (F) » : F V I P S A |
| `ordre` | INTEGER | oui | unique | ordre de la fiche : Force, Volonté, Intelligence, Perception, Social, Agilité |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `competence`

Les 30 compétences : 5 par caractéristique (Personnage!B22:B36 et O22:O36). « Nat. » et « Acquis » sont saisis par le joueur : ils ne sont pas des données de règle (plafonds : seuil_niveau 'competence_naturel_max' et regle_constante 'competence.acquis_max_par_point_caracteristique').

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | normalize(nom) : 'arme-lourde' |
| `nom` | TEXT | oui | unique | libellé de la fiche sans le suffixe : « Arme Lourde » |
| `caracteristique_id` | TEXT | oui | → caracteristique.id |  |
| `ordre` | INTEGER | oui | unique | ordre de la fiche (blocs de 5 par caractéristique) |
| `libelle_fiche` | TEXT | oui | unique | « Arme Lourde (F) » tel qu'écrit dans la cellule |
| `description` | TEXT | non |  | phrase du guide « Compétences » (italiques retirés, [[liens]] conservés) ; NULL quand le guide ne décrit pas cette compétence (Calme : le guide écrit « Prouesse », voir ecart_source) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `niveau_global`

Table « Expérience / Niveau global » du guide, une ligne par niveau, recoupée avec BDD!G2:H21 (même 20 paliers). Les colonnes typées sont les « Dons » du guide ; NULL = le guide n'écrit pas ce don à ce niveau (pas « 0 »). Pour les cumuls et les valeurs de la fiche à un niveau donné : vue v_niveau.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `niveau` | INTEGER | oui | PK |  |
| `xp_min` | INTEGER | oui | unique | « Xp nécessaire » = BDD!G « Palier XP » ; niveau = dernier palier <= XP (VLOOKUP approché) |
| `points_competences` | INTEGER | non |  | « 100 points de compétences » (niveau 1), 20, ou 40 aux niveaux 5, 10, 15, 20 |
| `points_attributs` | INTEGER | non |  | « 15 points d'attributs à répartir » |
| `caracteristiques_a_repartir` | INTEGER | non |  |  |
| `maximum_naturel_bonus` | INTEGER | non |  | « +10 maximum naturel » (niveaux 5 et 10) |
| `niveaux_classe` | INTEGER | non |  | « +2 Niveaux de classe » |
| `niveaux_maitrise` | INTEGER | non |  | « 1 Niveau de maîtrise pour un sort » |
| `puissance_magique` | INTEGER | non |  | « Puissance magique niveau N » obtenue à ce niveau (version du GUIDE : 5 au niveau 16) |
| `puissance_magique_note` | TEXT | non |  | parenthèse du guide : « non disponible pour les personnages avec une magie acquise » |
| `de_attributs_bonus` | TEXT | non |  | « 1d8 santé OU 1d8 chakra OU 1d4 pour les deux » (niveaux 5, 10, 15, 20), texte du guide |
| `dons_brut` | TEXT | oui |  | cellule « Dons » telle qu'écrite (les <br> sont conservés) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `niveau_deblocage`

Déblocages écrits dans la colonne « Dons » qui ne sont pas des quantités : mode hyper (niveau 2), mode hyper 100 % et récupération par Méditation / Repos (niveau 10). `code` est un vocabulaire fermé : le chargeur s'arrête devant une ligne inconnue.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `niveau` | INTEGER | oui | PK 1, → niveau_global.niveau |  |
| `rang` | INTEGER | oui | PK 2 | rang du don dans la cellule |
| `code` | TEXT | oui |  |  |
| `texte` | TEXT | oui |  | ligne du guide, sans le tiret : « Mode Hyper débloqué ! » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `seuil_niveau`

Valeurs par palier de niveau global lues dans les formules de la fiche (BDD!K28, K36, AK2:AK6) : « à partir du niveau `niveau_min` (inclus), la valeur est `valeur` ». Le chargeur lit la FORMULE (IF imbriqués) ; elle est recopiée dans `formule`. valeur au niveau N = valeur de la ligne de plus grand niveau_min <= N (voir v_niveau). regle 'caracteristiques_total' : total des 6 bases à répartir (BDD!K36, « Caractéristiques Max ») : 14, 15, 16, 17 regle 'competence_naturel_max' : plafond de la colonne « Nat. » de chaque compétence (BDD!K28, « Maximum naturel ») : 20, 30, 40 regle 'puissance_magique_max' : niveau de puissance magique maximal de la FEUILLE (BDD!AK2:AK6) : 1, 2, 3, 4, 5. Le guide dit 16 pour le niveau 5 de puissance, la feuille 17 (voir ecart_source).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `regle` | TEXT | oui | PK 1 |  |
| `niveau_min` | INTEGER | oui | PK 2 |  |
| `valeur` | INTEGER | oui |  |  |
| `condition` | TEXT | non |  | puissance 5 : « AND(W8>16, S3="") » : refusée avec une magie acquise |
| `libelle` | TEXT | oui |  | étiquette de la cellule dans la fiche : « Caractéristiques Max » |
| `formule` | TEXT | oui |  | cellule et formule d'origine |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `regle_constante`

Constantes chiffrées de règle. Une ligne = une phrase d'un texte de règle (nature 'texte' : page du guide ou cellule de texte d'un classeur, `texte` = la phrase telle qu'écrite) ou un facteur écrit dans une formule de la fiche (nature 'formule', `texte` = le fragment de formule). Le chargeur vérifie que `texte` figure bien dans la cellule ou la page citée. Les règles qui restent du texte sont dans les pages (corps_md).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'caracteristique.base_min', 'competence.acquis_max_par_point_caracteristique'… |
| `valeur` | INTEGER | oui |  |  |
| `unite` | TEXT | non |  | 'points', '%', 'tours'… ; NULL si le nombre n'a pas d'unité propre |
| `nature` | TEXT | oui |  |  |
| `texte` | TEXT | oui |  | la phrase, ou le fragment de formule, tels qu'écrits |
| `page_id` | TEXT | non | → page.id | page qui présente la phrase (nature 'texte') ; NULL pour une formule |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `entrainement_palier`

Table d'entraînement (guide « Capacités/Don » : un D100 donne un bonus d'Acquis). Une ligne = une plage de dé.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `de_min` | INTEGER | oui | PK |  |
| `de_max` | INTEGER | oui |  |  |
| `bonus_acquis_pct` | INTEGER | non |  | « 5% d'acquis » -> 5 ; NULL quand l'entraînement est raté |
| `rate` | INTEGER | oui |  | 1 = « Entraînement raté ! » |
| `valeur_brut` | TEXT | oui |  | « 1-20 » |
| `resultat_brut` | TEXT | oui |  | « 5% d'acquis » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `initiative_agilite`

Bonus d'initiative selon l'Agilité (guide « Attributs » : « D20 + … »). L'Agilité 5 n'est atteignable qu'avec une magie précise.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `agilite` | INTEGER | oui | PK |  |
| `bonus` | INTEGER | oui |  | « -2 initiative » -> -2 ; « +0 initiative » -> 0 |
| `note` | TEXT | non |  | parenthèse de l'en-tête : « Atteignable uniquement avec la magie du Vent ou de la Foudre/Vent » |
| `bonus_brut` | TEXT | oui |  | « -2 initiative » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `type_don`

Les quatre types de don (guide « Capacités/Don »). Le domaine classes écrit capacite.type avec les mêmes clés (+ 'variable', qui n'est pas dans le guide) ; une clé étrangère pourra les relier.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui | unique | « Réaction » |
| `definition` | TEXT | oui |  | phrase du guide après les deux-points |
| `ordre` | INTEGER | oui | unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `posture`

▸ POSTURES DE COMBAT Six postures. Trois textes coexistent : le tableau de la fiche (Personnage!BA16:BR25, versions courtes), la page « Tableau Posture » du Google Doc de la fiche et la page « Postures » du guide MJ. Ils diffèrent par endroits (voir ecart_source).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui | unique | « Offensif » (titre de la page « Postures ») |
| `ordre` | INTEGER | oui | unique | ordre de la page « Postures » |
| `libelle_fiche` | TEXT | oui | unique | libellé du tableau de la fiche : « OFFENSIF », « DEFENSIF » |
| `description` | TEXT | oui |  | paragraphe de présentation de la page « Postures » (avant « Ses effets sont : ») |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `posture_effet`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `posture_id` | TEXT | oui | PK 1, → posture.id |  |
| `version` | TEXT | oui | PK 2 |  |
| `rang` | INTEGER | oui | PK 3 |  |
| `intitule` | TEXT | non |  | partie en gras du guide : « +5% à la réussite critique » ; NULL pour la version 'fiche' (une ligne de texte) |
| `texte` | TEXT | oui |  | version 'fiche' : la ligne sans le tiret ; versions guide : l'explication après « : » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

## 3. MAGIES ET SORTS (famille « magies »)

### `magie`

MAGIE : une ligne par onglet de magie (15 : Potentiel Illimité + 14 magies)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK, → page.id | = id de la page (entité typée qui a SA page) |
| `nom` | TEXT | oui | unique | nom court tel qu'écrit dans les listes de résistances et d'incompatibilités : 'Sang', 'Espace/Temps', 'Potentiel Illimité' (onglet « Magie » de la fiche) |
| `nom_cle` | TEXT | oui | unique | normalize(nom) comme text.mjs : 'sang', 'espace-temps', 'potentiel-illimite' |
| `onglet` | TEXT | oui |  | nom exact de l'onglet du classeur V8 (le dump tronque 'Potentiel illimité (magie diffi') |
| `ordre` | INTEGER | oui | unique | rang de l'onglet dans le classeur (1 = Potentiel illimité) |
| `banniere` | TEXT | non |  | texte d'avertissement de la bannière d'en-tête (Potentiel : « MAGIE DIFFICILE A JOUER !! ») |
| `description` | TEXT | non |  | texte d'introduction (A4), paragraphes séparés par des lignes vides |
| `description_physique` | TEXT | non |  | bloc « Description physique » |
| `explication` | TEXT | non |  | bloc « Explication » (Arcane, Corruption, Potentiel Illimité seulement) |
| `sante_offerte` | INTEGER | non |  | « Santé offert » (valeurs entières dans la source) |
| `chakra_offert` | INTEGER | non |  | « Chakra offert » |
| `caracteristique_id` | TEXT | non | → caracteristique.id | « Caractéritiques bonus » reconnue ; NULL pour « AU CHOIX ou ALEATOIRE » |
| `caracteristique_brut` | TEXT | non |  | cellule telle qu'écrite (« FORCE », « AU CHOIX ou ALEATOIRE ») |
| `barre4_ressource` | TEXT | non |  | ressource de la « 4ème barre » (Sang, Nécromancie) ; NULL = pas de 4ème barre |
| `barre4_texte` | TEXT | non |  | cellule « 4ème barre » telle qu'écrite |
| `barre4_max` | INTEGER | non |  | « maximum de 10 Sang » : extrait du texte ci-dessus (NULL si la forme ne correspond pas) |
| `barre4_regen` | INTEGER | non |  | « la régénère de 1 par tour » : idem |
| `incompatibilite_note` | TEXT | non |  | bloc « Magie non compatible » quand ce n'est PAS une liste de noms de magies (Corruption : phrase de la source, gardée comme trace : la page affiche « Mono-magie uniquement », voir mono_magie) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |
| `mono_magie` | INTEGER | oui |  | 1 = « Mono-magie uniquement » : ne se combine avec aucune autre magie, sauf pour les ethnies de magie_ethnie_secondaire (décision R15 du propriétaire : Potentiel Illimité et Corruption ; migration 0010) |

### `magie_role`

Rôles de la magie (bloc « ROLES » : trois cellules, de gauche à droite). `rang` = position dans l'onglet ; la source ne dit pas que le premier rôle est « principal » : ne pas l'interpréter.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | oui | PK 1, → magie.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `role` | TEXT | oui |  |  |
| `role_brut` | TEXT | oui |  | écriture de la source (« DÉGATS ») |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `magie_resistance`

Résistances et vulnérabilités de la magie (4 blocs de l'onglet : « Résistance magique », « Vulnérabilité magique », « Résistance altération d'état », « Vulnérabilité altération d'état » ; « Aucune » = aucune ligne). Une ligne = un nom de la liste, dans l'ordre de la source (rang). cible_type = 'magie' : cible_magie_id renseigné (liste de noms de magies). cible_type = 'etat' : cible_etat_id renseigné. La source écrit « Gelé » et « Pétrification » là où la liste des altérations dit « Gel » et « Pétrifié » : le rapprochement est fait par l'importeur (table d'alias explicite) ; cible_brut garde l'écriture d'origine. Les lignes 'etat' sont, d'après la fiche (spécification resist.total-etat), l'image des lignes 'magie' par la colonne « Magie Liée » de la liste des altérations ; elles sont conservées parce que la source les écrit.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | oui | PK 1, → magie.id |  |
| `sens` | TEXT | oui | PK 2 |  |
| `cible_type` | TEXT | oui | PK 3 |  |
| `rang` | INTEGER | oui | PK 4 |  |
| `cible_magie_id` | TEXT | non | → magie.id |  |
| `cible_etat_id` | TEXT | non | → etat.id |  |
| `cible_brut` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `magie_incompatibilite`

Magies qu'on ne peut pas combiner. Une ligne = « magie_id cite autre_magie_id » dans sa liste d'incompatibilités, telle que la source la porte (donc dirigée) : la liste structurée de l'onglet V8 quand il y en a une (Sang, Arcane, Espace/Temps, Vide, Nécromancie), sinon la colonne « Incompatible » de la fiche (`Magie!T`) : Corruption (l'onglet V8 n'a qu'une phrase, voir magie.incompatibilite_note), Potentiel Illimité (pas de bloc) et les 8 magies élémentaires/lumière/ombre (pas de bloc : elles ne citent que Potentiel Illimité). Les 15 listes de la fiche sont symétriques (22 paires) : la vue v_magie_incompatible donne la relation symétrique, c'est elle qu'il faut interroger (une paire citée d'un seul côté compte dans les deux sens).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | oui | PK 1, → magie.id |  |
| `autre_magie_id` | TEXT | oui | PK 2, → magie.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `magie_ethnie_secondaire`

Ethnies pour lesquelles une magie secondaire reste possible malgré les incompatibilités (fiche `Magie!U5`, colonne « Magie secondaire si Race » : « Elfe Noir Charbon, Elfe Noir Salé, Felfe Noir » pour Corruption). `ethnie_brut` est le nom écrit ; `ethnie_id` l'ethnie rapprochée (les noms de la source se résolvent exactement : « Felfe Noir » = races/felfe#ethnie:felfe-noir). L'Elfe Noir Salé de la cellule est une erreur (décision R15 du propriétaire, comme le dit la phrase de l'onglet : « Seuls les Elfes noirs (Charbon) et les Felfes noirs ») : sa ligne est retirée par la migration 0010.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | oui | PK 1, → magie.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `ethnie_id` | TEXT | oui | → ethnie.id | ethnie de la table `ethnie` (domaine races) |
| `ethnie_brut` | TEXT | oui |  | nom écrit dans la cellule |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `magie_dieu`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | oui | PK 1, → magie.id |  |
| `dieu_id` | TEXT | oui | PK 2, → dieu.id |  |
| `rang` | INTEGER | oui |  | ordre d'écriture dans la cellule (« Notix & Capse » : 1 et 2) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `amelioration_cadaverique`

Tableau « AMELIORATION CADAVERIQUE » de la Nécromancie (13 lignes : nom, effet). Le nom est celui d'une amélioration d'invocation ; le lien avec le bestiaire (invocations « Zombi », « Momie »…) n'est pas dans la source : non modélisé.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<magie.id>#amelioration:<slug du nom>' |
| `magie_id` | TEXT | oui | → magie.id |  |
| `rang` | INTEGER | oui |  | ordre du tableau : colonne de gauche (D) puis de droite (T), de haut en bas |
| `nom` | TEXT | oui |  |  |
| `effet` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `sort`

SORT : une ligne par sort de la table des sorts (14 magies x 23 sorts = 322 ; Potentiel Illimité n'a pas de table propre : il pioche dans les 14 autres, règle de la fiche, hors de ce domaine)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<magie.id>#sort:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006) |
| `magie_id` | TEXT | oui | → magie.id |  |
| `nom` | TEXT | oui |  | espaces insécables remplacés par des espaces (identifiant) |
| `nom_cle` | TEXT | oui |  | normalize(nom) comme text.mjs : 'boule-de-sang' ; recherche d'un sort par son nom |
| `niveau` | INTEGER | oui |  | colonne « Niveau » : niveau de PUISSANCE du sort (palier 1 à 5), à ne pas confondre avec le niveau de maîtrise (NM, 0 à 3) |
| `ordre` | INTEGER | oui |  | rang dans la table de l'onglet (1 à 23) ; l'ordre de lecture |
| `type_brut` | TEXT | oui |  | « Amplification (IC pour 3 NM) », « Attaque\n(Imparable) »… tel qu'écrit |
| `ic_direct` | INTEGER | oui |  | 1 = le type contient « (IC) » (Instant Cast, voir legende_sort) |
| `ic_nm_min` | INTEGER | non |  | N de « IC pour N NM » : niveau de maîtrise qui rend le sort IC |
| `imparable` | INTEGER | oui |  | le type contient « imparable » (insensible à la casse) |
| `inesquivable` | INTEGER | oui |  | le type contient « inesquivable » |
| `cout_brut` | TEXT | oui |  | « 3 + 1 Sang », « 55 (-5/NM) », « X Sang », « Variable »… |
| `cout_chakra` | INTEGER | non |  | partie chakra quand la forme est « N », « N (-k/NM) », « N + … Sang/âme(s) » ; sinon NULL |
| `cout_ressource` | TEXT | non |  | ressource de la 4ème barre citée dans le coût |
| `cout_ressource_valeur` | INTEGER | non |  | sa quantité ; NULL si « X » ou absente |
| `portee_brut` | TEXT | oui |  | « 6 », « Soi même », « 5 (+1/NM) », « Vue »… |
| `portee_nature` | TEXT | oui |  |  |
| `portee_valeur` | INTEGER | non |  | valeur de base quand portee_nature = 'nombre' (unité non écrite dans la cellule : des cases, cf. guide/vitesse-et-portee pour les armes) |
| `zone_brut` | TEXT | oui |  | « 1 », « Cercle de 5 », « 3x1 », « Carré 4x4 », « Cône »… |
| `zone_forme` | TEXT | oui |  |  |
| `zone_taille` | INTEGER | non |  | premier nombre de « Cercle de N », « Ligne de N », « Carré … N », « Croix de N », « N cibles » |
| `dsb_brut` | TEXT | non |  | NULL quand la cellule vaut « / » (la fiche la traite comme vide) |
| `effets` | TEXT | non |  | colonne « Effets secondaires » (jamais vide dans les 322 sorts) |
| `texte_niveau5` | TEXT | non |  | texte du pied d'onglet (« Textes des sorts de niveau 5 ») titré du nom de ce sort ; NULL quand l'onglet n'en porte pas (ou quand le titre est sans texte) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Magie Maverick V8 › Sang › AL4:BR6 » |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |
| `mode_brut` | TEXT | non |  | le MODE du sort : ce qui est entre parenthèses dans la colonne « Type » (« IC pour 3 NM », « Imparable », « IC » puis « IC x 2 si 3NM » à la ligne) ; NULL quand le type n'a pas de parenthèses. Le TYPE (attaque, entrave…) est dans sort_type, le mode dans sort_mode (valeur de base) et sort_bonus_maitrise (condition de NM) |
| `bonus_maitrise` | TEXT | non |  | les bonus de NM du sort, une ligne par bonus, « <Colonne> : <passage de la cellule> » (« Coût : -5/NM », « Effets : Dure 2 tours (+1/NM) »), dans l'ordre de lecture ; NULL quand le sort n'écrit aucun NM. Recopie lisible de sort_bonus_maitrise (db:check et les tests contrôlent l'accord) |

### `sort_type`

Types d'un sort : « Attaque/ Entrave (Imparable) » = deux types. Les parenthèses sont retirées avant de couper sur « / ». `libelle` garde l'écriture d'origine (« Entave » pour deux sorts : faute de frappe de la source, rapprochée de 'entrave').

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `sort_id` | TEXT | oui | PK 1, → sort.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `type` | TEXT | oui |  |  |
| `libelle` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `sort_mode`

Mode d'un sort : ce que la colonne « Type » écrit entre parenthèses (« Amplification (IC) », « Attaque\n(Imparable) »), séparé du TYPE (sort_type : attaque, entrave…). Valeur de BASE seulement : « IC », « Imparable », « Inesquivable », « IC x 2 », « IC x 3 ». Un mode qui dépend d'un niveau de maîtrise (« IC pour 3 NM », « IC x 2 si 3NM », « IC x 1/NM ») est un bonus de maîtrise : voir sort_bonus_maitrise (champ 'type'). `libelle` garde l'écriture d'origine ; `fois` = N de « IC x N » (NULL sinon). Rien n'est déduit : « IC x 2 » n'est pas expliqué par la source, sa valeur est seulement typée.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `sort_id` | TEXT | oui | PK 1, → sort.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `mode` | TEXT | oui |  |  |
| `libelle` | TEXT | oui |  |  |
| `fois` | INTEGER | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `sort_bonus_maitrise`

Bonus de niveau de maîtrise (NM) d'un sort : chaque renforcement que les cellules du classeur écrivent, quelle que soit la colonne. Un sort cumule 3 NM au plus ; il est renforcé à chaque NM ou quand il atteint un palier (en général 3 NM) : devenir IC, coût en chakra qui baisse, portée, zone, dégâts / soins / barrière, effet secondaire en plus. Trois natures : 'par_nm' : « (+1d6/NM) », « (-5/NM) », « (+1d/3NM) », « 1%/NM », « IC x 1/NM » : increment_brut = ce qui précède la barre (« +1d6 », « -5 »), pas_nm = 1 (« /NM ») ou 3 (« /3NM »), increment_entier = l'entier signé quand l'incrément en est un (-5, +2 ; « –1 » avec tiret demi-cadratin = -1) ; 'palier' : « 3NM = Sur un coup critique… », « IC pour 3 NM », « … à 3NM », « … au niveau 3 de maîtrise » : seuil_nm = N, l'effet vaut à partir de N NM ; 'texte' : une mention de NM qui n'est ni l'un ni l'autre (« Les NM sont utiles pour le sort aléatoire ») : rien de typé. Rien n'est calculé : `texte_brut` est l'expression recopiée de la cellule, `contexte` le passage de la cellule qui dit ce qu'elle modifie (« Dure 2 tours (+1/NM) » ; identique à texte_brut quand la colonne le dit déjà : « -5/NM » dans un coût). Les valeurs typées ne sont posées que quand l'écriture est sans ambiguïté. Les sorts sans NM écrit n'ont aucune ligne. v_sort_bonus_au_nm donne ce qui s'applique à un niveau de maîtrise donné (0 à 3). Remplace sort_progression_nm (migration 0004) : même contenu, désormais exhaustif (champs type et remarque, natures complétées).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `sort_id` | TEXT | oui | PK 1, → sort.id |  |
| `champ` | TEXT | oui | PK 2 | colonne de la source où l'expression est écrite |
| `rang` | INTEGER | oui | PK 3 | ordre d'apparition dans la cellule |
| `nature` | TEXT | oui |  |  |
| `texte_brut` | TEXT | oui |  | l'expression de NM, exacte : « +1d6/NM », « 3NM = Croix 1x1 », « IC pour 3 NM » |
| `contexte` | TEXT | oui |  | le passage de la cellule qui la contient et dit ce qu'elle modifie |
| `increment_brut` | TEXT | non |  |  |
| `increment_entier` | INTEGER | non |  |  |
| `pas_nm` | INTEGER | non |  |  |
| `seuil_nm` | INTEGER | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `sort_etat`

Sort <-> altération d'état. INDEX DÉRIVÉ DU TEXTE (la source n'a pas de colonne « états ») : l'importeur ne retient que les tournures explicites, et `relation` redit la tournure, pas une règle : 'inflige' : « Inflige / infliger / Rend la cible / État « … » <état> [n] » ; 'prend' : « pour ne pas prendre / ne pas être <état> [n] » (état subi en cas d'échec du jet ; qui le subit — la cible ou le lanceur — se lit dans l'extrait) ; 'soigne' : « soigner [un état de] <état>, <état>… ». `extrait` donne la phrase d'où la ligne est tirée, `forme_trouvee` le mot rapproché de l'état (table d'alias de l'importeur). Non exhaustif : une mention libre (« Coma. », « lien de gel », « Peur 3 pour la cible ») n'est pas retenue.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `sort_id` | TEXT | oui | PK 1, → sort.id |  |
| `etat_id` | TEXT | oui | PK 2, → etat.id |  |
| `relation` | TEXT | oui | PK 3 |  |
| `rang` | INTEGER | oui | PK 4 | occurrence dans le sort (un même état peut revenir : stade 1 puis stade 2) |
| `stade` | INTEGER | non |  | nombre qui suit le nom (« brûlure 2 », « gel 1 »), sinon NULL |
| `champ` | TEXT | oui |  |  |
| `forme_trouvee` | TEXT | oui |  |  |
| `extrait` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `commentaire_orphelin`

Fils de commentaires du Sommaire ancrés en A1 : commentaires de cellules supprimées, sans sort identifiable (certains portent des textes de règle). Conservés tels quels, sans rattachement inventé.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'magies#commentaire-orphelin:<empreinte>' ; '…~2' si le même texte figure dans deux fils (6 cas) (le rang du fil dans le .xlsx n'entre pas dans l'identifiant) |
| `empreinte` | TEXT | oui |  |  |
| `occurrence` | INTEGER | oui |  | n° d'apparition de ce texte parmi les fils : 1, sauf texte répété |
| `onglet` | TEXT | oui |  |  |
| `cellule` | TEXT | oui |  |  |
| `resolu` | INTEGER | oui |  |  |
| `texte` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `legende_sort`

Légende commune des 14 tables de sorts (identique dans chaque onglet) : « IC = Instant Cast » et les trois modes d'obtention d'un niveau de maîtrise (N, L, C).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `code` | TEXT | oui | PK | 'IC', 'N', 'L', 'C', 'NM' |
| `groupe` | TEXT | oui |  |  |
| `libelle` | TEXT | oui |  | « Instant Cast », « Par Niveau »… |
| `description` | TEXT | non |  | complément de la source (IC : « Le sort ne consomme pas le Tour du joueur… ») |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `regle_magie`

Règles de magie qui valent pour toutes les magies (Sommaire!A31 : « Règle spéciale pour sort niveau 5 »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'magies#regle:<slug du titre>' ('magies#regle:regle-speciale-pour-sort-niveau-5') |
| `titre` | TEXT | oui |  | début du texte jusqu'à « : » |
| `niveau_sort` | INTEGER | non |  | niveau de sort concerné quand le titre le dit |
| `texte` | TEXT | oui |  | cellule entière, telle qu'écrite |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

## 4. ANNEXES DES MAGIES : états, résistances, météo, modes hyper et super (famille « annexes »)

### `resistance_palier`

Les 6 paliers de la fiche (Personnage!BA2:BA12) : une valeur de résistance V (somme des crans) donne un palier. V >= 3 immunité, 2 grande résistance, 1 résistance, -1 vulnérabilité, -2 grande vulnérabilité, V <= -3 sensibilité ; V = 0 : neutre (aucune ligne). Les bornes sont lues dans les formules BI2:BI12 (BDD!V > 2, = 2, = 1, = -1, = -2, < -2).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `libelle` | TEXT | oui | unique | « Grande résistance » |
| `valeur_min` | INTEGER | non |  | V >= valeur_min ; NULL = pas de borne basse |
| `valeur_max` | INTEGER | non |  | V <= valeur_max ; NULL = pas de borne haute |
| `multiplicateur` | REAL | oui |  | « dégâts subits ÷4 » -> 0.25 ; « =0 » -> 0 ; « x8 » -> 8 |
| `effet_brut` | TEXT | oui |  | « dégâts subits ÷4 » |
| `ordre` | INTEGER | oui | unique | ordre d'affichage de la fiche (immunité en premier) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `resistance_magie`

Matrice de résistance de la FICHE (Magie!F2:S16) : 15 magies du personnage (lignes) x 14 magies qui attaquent (colonnes). valeur = +1 résistance d'un cran, -1 vulnérabilité d'un cran, 0 neutre (la source écrit 0 : conservé). Ces valeurs alimentent BDD!S (magie innée) et BDD!T (magie acquise), qui s'additionnent (règle déduite par la spécification : l'export du classeur ne contient pas la formule). Le domaine magies porte les listes du classeur V8 (magie_resistance) : elles diffèrent pour Arcane et Corruption (voir v_resistance_ecart et ecart_source).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | oui | PK 1, → magie.id | magie du personnage : celle qui résiste ou est vulnérable |
| `attaque_magie_id` | TEXT | oui | PK 2, → magie.id | magie de l'attaque subie (en-tête de colonne F1:S1) |
| `valeur` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `resistance_duo`

Tableau « Résistance Faiblesse » de l'onglet Statistiques du classeur V8 : les 73 couples de magies qu'il traite (ordre de l'onglet, magie A puis magie B telles que la source les écrit : « Sang + Vide » et non « Vide + Sang »). Un couple peut n'avoir aucune ligne dans resistance_combinaison (Lumière + Ombre : « AUCUNE » aux quatre paliers) : d'où cette table.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_a_id` | TEXT | oui | PK 1, → magie.id |  |
| `magie_b_id` | TEXT | oui | PK 2, → magie.id |  |
| `ordre` | INTEGER | oui | unique | rang du couple dans le tableau (1 = Sang + Vide) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `resistance_combinaison`

Les magies de chaque palier pour un couple. « AUCUNE » n'a pas de ligne. « D.Résistance » / « D.Faiblesse » (« D. » n'est pas développé par la source) sont rattachés aux paliers « grande résistance » / « grande vulnérabilité » : le chargeur vérifie cette lecture en recalculant les 73 couples depuis resistance_magie (V = somme des deux lignes) ; les écarts sont dans ecart_source.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_a_id` | TEXT | oui | PK 1, → resistance_duo.magie_a_id |  |
| `magie_b_id` | TEXT | oui | PK 2, → resistance_duo.magie_b_id |  |
| `palier_id` | TEXT | oui | PK 3, → resistance_palier.id |  |
| `rang` | INTEGER | oui | PK 4 | position dans la ligne du palier (colonnes T, Y, AD, AI) |
| `cible_magie_id` | TEXT | oui | → magie.id |  |
| `palier_brut` | TEXT | oui |  |  |
| `cible_brut` | TEXT | oui |  | « Temps/Espace » : écriture de la source |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `etat`

▸ ALTÉRATIONS D'ÉTAT (classeur V8, onglet « Altération détats » : 20 blocs de 5 lignes)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui | unique | « Pétrifié », « Surcharge Magique » (retours à la ligne de la cellule remplacés par une espace) |
| `ordre` | INTEGER | oui | unique | ordre de l'onglet |
| `type` | TEXT | oui |  |  |
| `type_brut` | TEXT | oui |  | « Physique », « Mental » |
| `magie_liee_brut` | TEXT | non |  | cellule « Magie Liée » sur une ligne : « Temps/ Espace », « Arcane/ Corruption » ; NULL pour « / » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `etat_magie`

Magie(s) liée(s) d'une altération : 13 altérations sur 20 en ont (Surcharge Magique : deux, Arcane et Corruption). Les 7 autres ont « / » dans la source et aucune ligne ici.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `etat_id` | TEXT | oui | PK 1, → etat.id |  |
| `magie_id` | TEXT | oui | PK 2, → magie.id |  |
| `rang` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `etat_stade`

Effet d'une altération par stade (colonnes « Stade 1 », « Stade 2 », « Stade 3 »). Pour 6 altérations la source fusionne les trois colonnes en une seule cellule : une ligne, stade NULL (la source ne distingue pas de stade). Texte tel que dans la cellule.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `etat_id` | TEXT | oui | PK 1, → etat.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `stade` | INTEGER | non |  | NULL = cellule fusionnée sur les trois stades |
| `effet` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `etat_palier`

Effet d'une altération selon la résistance ou la vulnérabilité de la cible (colonnes AQ / AV : une paire « libellé / effet » par ligne du bloc). Les paliers sont ceux de resistance_palier (« Résistances » de la source = 'resistance'). Une paire dont l'effet est vide dans la source n'a pas de ligne.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `etat_id` | TEXT | oui | PK 1, → etat.id |  |
| `palier_id` | TEXT | oui | PK 2, → resistance_palier.id |  |
| `libelle_brut` | TEXT | oui |  | « Résistances », « Grande vulnérabilité » |
| `effet` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `meteo`

▸ MÉTÉO (classeur V8, onglet « Météo » : une entrée de 7 lignes par météo)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui | unique | « Pluie diluvienne » |
| `ordre` | INTEGER | oui | unique |  |
| `description` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `meteo_effet`

Effets d'une météo : une ligne « - … » de la cellule « Effet(s) » = une ligne. Pour la forme « Élément X = +N dégâts, +M Soin » (ou « Magie X = … ») les colonnes typées sont renseignées (élément = magie, bonus signés) ; la forme « (TOUR PAIR) +10 dégâts | (TOUR IMPAIR) -10 dégâts » (Éclipse) remplit les deux colonnes par tour. Toute autre ligne reste du texte (type 'autre'), y compris « Toutes les autres magies = -3 dégâts ».

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `meteo_id` | TEXT | oui | PK 1, → meteo.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `type` | TEXT | oui |  |  |
| `texte` | TEXT | oui |  | la ligne, sans le tiret : « Élément Lumière = +6 dégâts, +6 Soin » |
| `element_magie_id` | TEXT | non | → magie.id | type 'element' : la magie visée |
| `element_brut` | TEXT | non |  | « Espace/Temps » tel qu'écrit après « Élément » ou « Magie » |
| `degats` | INTEGER | non |  | « +6 dégâts » -> 6 ; « -5 dégâts » -> -5 ; NULL si la ligne n'en dit pas |
| `soin` | INTEGER | non |  | « +6 Soin » -> 6 |
| `degats_tour_pair` | INTEGER | non |  | « (TOUR PAIR) +10 dégâts » -> 10 (Éclipse) |
| `degats_tour_impair` | INTEGER | non |  | « (TOUR IMPAIR) -10 dégâts » -> -10 |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `mode_texte`

Textes d'explication du classeur « Mode hyper et co » (Mode Hyper!AA1, AA14, AA30 ; Mode Super!AI1) : cellule entière, telle quelle. Les chiffres qu'ils contiennent (niveau 2, 10 %, durée = niveau ÷ 2…) sont aussi dans regle_constante.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<page>#texte:<normalize(intitule)>' (db:check recalcule la fin) |
| `mode` | TEXT | oui |  |  |
| `rang` | INTEGER | oui |  |  |
| `intitule` | TEXT | oui |  | première ligne de la cellule : « Au delà des limites » |
| `texte` | TEXT | oui |  | cellule entière |
| `page_id` | TEXT | oui | → page.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `mode_hyper_depassement`

« Au delà des limites » (Mode Hyper!AA14) : conséquences d'un mode hyper maintenu N tours de plus, une fois relâché.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `tours` | INTEGER | oui | PK | « 3 tours supplémentaires » -> 3 |
| `tours_brut` | TEXT | oui |  | « 3 tours supplémentaires » |
| `effet` | TEXT | oui |  | « 3 croix caractéristiques aléatoires pendant 24h. » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `mode_super_objet`

Mode super : objets légendaires ou enchantés (Mode Super!A3:T59). Cellule « Effets mode super » = « Effet passif = … / Effet actif = … » ; la partie après le « = » est NULL quand elle est vide dans la source (10 objets sur 15 n'ont encore aucun effet écrit).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui | unique | colonne « Objet » : « Excalibur/ Joyeuse » ; le premier est la cellule numérique 400.0, conservée telle quelle |
| `ordre` | INTEGER | oui | unique |  |
| `effet_passif` | TEXT | non |  |  |
| `effet_actif` | TEXT | non |  |  |
| `effets_brut` | TEXT | oui |  | cellule « Effets mode super » entière |
| `description` | TEXT | non |  | colonne « Description/apparence » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `mode_hyper_effet`

Effets du mode hyper. Plusieurs lectures du même sujet coexistent et ne disent pas toujours la même chose ; elles sont TOUTES conservées, une ligne par (version, cible), et la requête choisit sa version (aucune source ne dit laquelle prévaut, voir ecart_source) : version 'classeur_modes' : classeur « Mode hyper et co », onglet Mode Hyper (général, 15 magies mono / bi, 27 races) ; version 'magie_masque' : classeur V8, onglet masqué « Mode Hyper (Magie) » (14 magies seules + 73 couples + « Avantages de base ») ; version 'onglet_magie' : classeur V8, bloc « Capacité Mode Hyper » de chaque onglet de magie (15 magies : mono, bi ou forme complète) ; version 'fiche' : fiche auto V15.2.2 : Magie!V2:W16 (15 magies mono / bi), Personnage!BI32 (« Effets de base »), Race!W (races) ; version 'onglet_race' : classeur « Les races », bloc « Capacité Mode Hyper » de l'onglet de chaque race (décision du propriétaire : PRIME sur 'fiche' pour les races ; migration 0007, `nom` = nom de la capacité, `libelle` = nom de l'onglet). portee 'general' : effet commun (libelle = « Général » ou le titre de l'encadré) ; 'magie' : une magie ; 'duo' : un couple de magies (version 'magie_masque') ; 'race' : une race (variante NULL : la source n'en distingue pas). variante 'mono' / 'bi' : colonnes « Mono magie » / « Bi magie » ; 'mono_et_bi' : cellule fusionnée sur les deux ; 'forme_complete' : Potentiel Illimité (« Forme Complète ») ; le couple d'une version 'magie_masque' est une variante 'bi'. `variante_brut` : libellé de colonne écrit.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | general : 'classeur_modes:general:2:mono' ; magie : 'classeur_modes:magies/magie-du-sang:mono' ; duo : 'magie_masque:duo:magies/magie-du-sang+magies/magie-du-feu' ; race : 'fiche:races/humain' |
| `version` | TEXT | oui |  |  |
| `portee` | TEXT | oui |  |  |
| `rang` | INTEGER | oui |  | rang de la cible dans la source au sein de (version, portee) : mono et bi d'une même magie ont le même rang |
| `libelle` | TEXT | oui |  | cible telle qu'écrite : « Général », « Temps/Espace », « Sang + Vide », « Namazus » |
| `magie_id` | TEXT | non | → magie.id |  |
| `magie2_id` | TEXT | non | → magie.id | portee 'duo' : seconde magie du couple (ordre de la source) |
| `race_id` | TEXT | non | → race.id |  |
| `variante` | TEXT | non |  |  |
| `variante_brut` | TEXT | non |  | libellé de colonne : « Mono-Magie », « Bi-magie », « Forme Complète » ; NULL si la source n'en écrit pas |
| `effet` | TEXT | oui |  | cellule telle quelle |
| `commentaire` | TEXT | non |  | commentaire de cellule du .xlsx (absent du dump JSON) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |
| `nom` | TEXT | non |  | nom de la capacité quand la source en écrit un (version 'onglet_race' : « Sang du condamné ») ; NULL sinon |

## 5. DIEUX

### `dieu`

Noms de la liste déroulante « Dieu choisi » (Personnage!S5, 26 valeurs) et de la colonne « Dieux » de la feuille Magie (X2:X29). Les sources ne disent pas quelles entrées sont des divinités (« Pas de Dieu choisi », « Agnostique »… figurent dans les deux listes) : aucune classification n'est ajoutée. Le dieu inné d'une magie est dans magie_dieu (domaine magies).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui | unique |  |
| `ordre_choix` | INTEGER | non | unique | rang dans la liste S5 ; NULL = absent de cette liste (Eirnn, Onir) |
| `dans_liste_magie` | INTEGER | oui |  | 1 = figure dans Magie!X2:X29 (« Notix & Capse » compte pour deux) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

## 6. CLASSES, SPÉCIALITÉS, CAPACITÉS (famille « classes »)

### `categorie_classe`

CATÉGORIES DU SOMMAIRE Les six en-têtes de colonne du Sommaire (A1, C1, E1, G1, I1, K1) : « Classe Physique Corps à Corps », « Classe Physique Distance », « Classe Magique », « Classe Hybride », « Classe Hybride Animal », « Classe spéciale ».

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | normalize(libelle) |
| `libelle` | TEXT | oui | unique | en-tête du Sommaire, tel quel |
| `ordre` | INTEGER | oui | unique | rang de la colonne dans le Sommaire (1 = la plus à gauche) |
| `note` | TEXT | non |  | texte posé sous la liste des classes de la catégorie (Sommaire!E10 pour « Classe Magique ») |
| `am_base` | INTEGER | non |  | « Octroie 4 AM de base par classe magique » -> 4 ; NULL = la note n'en dit rien. Extrait du texte de `note` uniquement ; la fiche auto applique une liste de classes écrite en dur (BDD!H40) qui diffère : voir design.md §12, points ouverts. |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `classe`

CLASSE : une ligne par onglet de classe (39)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK, → page.id | = id de la page (entité typée qui a SA page) |
| `nom` | TEXT | oui | unique | nom de l'onglet = nom dans le Sommaire (« Cuirassé », « Orios ») = titre de la page. Les 13 classes « Hybride Animal » portent le nom de leur race, sans suffixe (migration 0009). |
| `nom_cle` | TEXT | oui | unique | normalize(nom) : 'cuirasse', 'mage-bleu' ; sert aux jointures par nom avec les autres domaines |
| `categorie_id` | TEXT | oui | → categorie_classe.id | colonne du Sommaire où la classe est listée |
| `ordre` | INTEGER | oui | unique | rang dans le Sommaire : catégories de gauche à droite, puis de haut en bas |
| `sante_depart` | INTEGER | oui |  |  |
| `chakra_depart` | INTEGER | oui |  |  |
| `barriere_depart` | INTEGER | oui |  |  |
| `maitrise_arme` | TEXT | non |  | « Maîtrise Arme » : A7 (bloc A7:F9), liste à tirets telle qu'écrite (décomposée dans classe_maitrise_arme) |
| `maitrise_armure` | TEXT | non |  | « Maîtrise Armures » : A11 (bloc A11:F13) telle qu'écrite (« - Légère à Intermédiaire\n- Bouclier classe 1 à 5 », « Aucun »…) ; décomposée dans classe_maitrise_armure |
| `bouclier_classe_max` | INTEGER | non |  | = max(classe_maitrise_armure.classe_max) (db:check le contrôle) ; dernier nombre de la ligne « Bouclier [de] classe N [à M] » ; NULL = pas de ligne bouclier (la source n'y accorde alors aucune classe de bouclier) |
| `inventaire_depart` | TEXT | non |  | « Inventaire de départ » : G3, cinq objets séparés par des virgules (détail : classe_objet_depart) |
| `arme_depart` | TEXT | non |  | « Arme de départ » : G7 (« Arme en acier selon la maîtrise ») |
| `armure_depart` | TEXT | non |  | « Armure de départ » : G11 |
| `chose_a_savoir` | TEXT | non |  | bloc « CHOSE A SAVOIR » (colonne Z) : note libre de règle ; NULL = bloc absent OU intitulé sans texte (Bimane) |
| `chose_a_savoir_lien` | TEXT | non |  | hyperlien externe attaché à la cellule du texte ; NULL = aucun (le seul, Mage Bleu!Z3 vers le classeur des familiers, est retiré par la migration 0019 : demande du propriétaire) |
| `description_titre` | TEXT | non |  | titre du texte de présentation de la classe (AM1) : « Description Guerrier » |
| `description` | TEXT | non |  | texte de présentation (AM2). NULL : Anansi, Goleois (titre sans texte), Grenadier (pas de zone de description) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | onglet + zones lues (départ, à savoir, description) + cellule du Sommaire |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |
| `magie_innee_id` | TEXT | non | → magie.id, unique | magie innée qui RÉSERVE et IMPOSE la classe : sans elle on ne prend pas la classe, avec elle la classe est la classe 1. Archimage : Potentiel Illimité (« CHOSE A SAVOIR » de son onglet, décision R23, migration 0015) ; NULL pour les autres classes. Contrôlé par v_personnage_controle (classe_reservee, classe_imposee) |
| `magie_innee_exclue_id` | TEXT | non | → magie.id | magie innée qui FERME la classe, à tous les rangs. Mage Bleu : Potentiel Illimité (« CHOSE A SAVOIR » de son onglet : « Un potentiel illimité ne peut pas avoir cette classe. », décision R25, migration 0020) ; NULL pour les autres. Contrôlé par v_personnage_controle (classe_exclue) |

### `specialite`

SPÉCIALITÉ : deux par classe, choisies au niveau de classe 10 Onglet normal : bannières en majuscules de la ligne 17 (A17 = rang 1, X17 = rang 2) ; description = titre + texte dans la zone AM. Archimage (pas de bannières) : les deux cartouches « Lvl 10 » J18 (Élémentaliste) et U18 (Occultiste), que la fiche auto lit comme spécialités (BDD!I2, I3 : Archimage!L18, W18) ; pas de description.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `classe_id` | TEXT | oui | → classe.id |  |
| `rang` | INTEGER | oui |  | 1 = bannière de gauche (A17), 2 = bannière de droite (X17) |
| `nom` | TEXT | oui |  | telle qu'écrite dans la bannière (« ÉPÉISTE », « MAÎTRE D'ARME ») ; Archimage : nom du cartouche |
| `nom_cle` | TEXT | oui |  | normalize(nom) |
| `description_titre` | TEXT | non |  | « Description Épéiste » |
| `description` | TEXT | non |  | NULL : titre sans texte (Tueur, Archer/Grand Archer, Mage Bleu, Anansi, Goleois) ou pas de zone |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `capacite`

CAPACITÉ (aptitude) : une ligne par page `capacites/<slug>` (660). Une aptitude du classeur = cellule « Lvl N » + nom + bloc d'effet + cellule de type. Les choix « l'un OU l'autre » ne sont pas un attribut : ils se lisent dans la mise en page (view v_capacite_exclusive) : nature = 'classe' : colonne P de l'onglet (Lvl 1, Lvl 5, Lvl 20) ; specialite_id NULL ; reçue sans choix. nature = 'specialite' : le cartouche « Lvl 10 » qui porte le nom de la spécialité ; les DEUX cartouches sont sur la même ligne et s'excluent. nature = 'choix' : les colonnes d'aptitudes (Lvl 10, 15, 20). Onglet normal : deux colonnes sous chaque bannière (specialite_id renseignée), côte à côte sur la même ligne : l'une OU l'autre. Archimage : groupes de 2 ou 3 colonnes sans spécialité (specialite_id NULL), y compris les deux cartouches « Lvl 10 » (Élémentaliste, Occultiste : règle du site, capacites.mjs ; la fiche V15.2.2 les lit comme des spécialités, d'où les deux lignes `specialite` de l'Archimage, sans capacité rattachée). ligne = ligne de la cellule « Lvl N » dans l'onglet (ordre de haut en bas) ; rang = position de gauche à droite sur la ligne, parmi les capacités du même groupe (même specialite_id ; NULL = sans spécialité). « Niveau de classe >= N » est la lecture de la fiche, le classeur ne l'écrit pas. Cinq capacités sont écrites mot pour mot dans deux classes (Contre-attaque, Rage, Gigantisme, Glissade, Sang contrôlé) : deux lignes, deux pages ; la vue v_capacite_partagee les retrouve.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK, → page.id | 'capacites/anansi-anti-corps' |
| `classe_id` | TEXT | oui | → classe.id |  |
| `specialite_id` | TEXT | non | → specialite.id |  |
| `niveau` | INTEGER | oui |  | N de « Lvl N » |
| `nature` | TEXT | oui |  |  |
| `ligne` | INTEGER | oui |  |  |
| `rang` | INTEGER | oui |  |  |
| `nom` | TEXT | oui |  | tel qu'écrit : « Contact », « Puni-moi ... », « ... plus fort ! » |
| `nom_cle` | TEXT | oui |  | normalize(nom) ; NON unique (noms portés par des effets différents) ; '' si aucun caractère ASCII |
| `type` | TEXT | non |  |  |
| `type_brut` | TEXT | non |  | cellule de type telle qu'écrite : « Actif (2 fois/combat) », « Réaction (1/combat) » |
| `limite_nombre` | INTEGER | non |  | N de « (N fois/période) » ou « (N/période) » ; NULL pour toute autre forme |
| `limite_periode` | TEXT | non |  | période de cette limite, minuscules (« combat », « 24h », « jour », « tour »…) ; NULL avec limite_nombre |
| `effet` | TEXT | non |  | bloc d'effet, texte libre (retours à la ligne et listes « - » conservés) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | plage de l'aptitude dans l'onglet : « Classe Maverick V7 › Guerrier › P4:U9 » |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `objet_depart`

OBJETS DE DÉPART Glossaire « OBJETS DES INVENTAIRES DE DEPART » (Sommaire!A21, une grande cellule : un objet par paragraphe, « nom : description »). Rangé aussi dans la page ressources/objets-de-depart-des-classes (dont les objets sont les sous-entités).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui |  | « P fiole rouge », « KDR Arme », « Corde (5-10m) » |
| `nom_cle` | TEXT | oui | unique | normalize(nom) |
| `description` | TEXT | oui |  |  |
| `ordre` | INTEGER | oui | unique | rang dans la cellule du glossaire |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `classe_objet_depart`

Inventaire de départ : une ligne par objet de la cellule « Inventaire de départ » (G3), dans l'ordre. Le texte de chaque objet est conservé tel qu'écrit (« P fiole rouge », « corde (5m) », « Bandage (x3) ») : les noms ne sont pas normalisés dans le classeur. « A OU B » (« KDR Arme OU carquois N ») est écrit par la source : une ligne par option (option 1, 2). objet_depart_id n'est renseigné que si le texte de l'option, sans un éventuel suffixe « (xN) », est le nom d'un objet du glossaire (casse, accents et tirets ignorés) ; sinon NULL (« corde (5m) » : le glossaire dit « Corde (5-10m) »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `classe_id` | TEXT | oui | PK 1, → classe.id |  |
| `rang` | INTEGER | oui | PK 2 | position dans la liste de la cellule (1 à 5) |
| `option` | INTEGER | oui | PK 3 | 1 sauf pour « A OU B » (A = 1, B = 2) |
| `texte` | TEXT | oui |  |  |
| `objet_depart_id` | TEXT | non | → objet_depart.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `classe_maitrise_armure`

MAÎTRISES DE DÉPART : cellules « Maîtrise Arme » (A7:F9) et « Maîtrise Armures » (A11:F13) de l'onglet de la classe. `classe.maitrise_arme` / `classe.maitrise_armure` gardent la cellule TELLE QU'ÉCRITE (liste à tirets) ; chaque ligne de la liste est une ligne de ces deux tables. Règle d'or : une colonne typée n'est remplie que pour une forme SANS AMBIGUÏTÉ (même analyseur à l'import et dans db:check : tools/db/classes_maitrise.py) ; une ligne qui ne ressemble à aucune forme reconnue garde son texte (`brut`) et le reste est NULL. Aucun ordre « Légère < Intermédiaire < Lourde » n'est écrit ici : seules les bornes écrites sont stockées (« Légère à Lourde »). `arme_depart`, `armure_depart` (« Arme en acier selon la maîtrise », « Armure de Peau, Bocle cuir ») restent du texte : ce sont des phrases de règle qui dépendent d'autres cellules, pas des listes (design.md §12).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `classe_id` | TEXT | oui | PK 1, → classe.id |  |
| `rang` | INTEGER | oui | PK 2 | position dans la liste (1 = première ligne) |
| `brut` | TEXT | oui |  | la ligne sans son tiret de liste : « Légère à Intermédiaire », « Bouclier classe 1 à 5 » |
| `objet` | TEXT | non |  | NULL = forme non reconnue (« Aucun », « Comment ça une armure ? ») |
| `poids_min` | TEXT | non |  | armure : bornes écrites ; « Légère » seul = min et max |
| `poids_max` | TEXT | non |  |  |
| `classe_min` | INTEGER | non |  | bouclier : « Bouclier classe 1 à 3 » ; « Bouclier de classe 1 » = 1 à 1 |
| `classe_max` | INTEGER | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Classe Maverick V7 › Guerrier › A11:F13 » |

### `classe_maitrise_arme`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `classe_id` | TEXT | oui | PK 1, → classe.id |  |
| `rang` | INTEGER | oui | PK 2 | position dans la liste (1 = première ligne) |
| `brut` | TEXT | oui |  | la ligne sans son tiret de liste : « 1 maîtrise Épée », « 1 maîtrise au choix (sauf Épée) » |
| `forme` | TEXT | non |  |  |
| `nombre` | INTEGER | non |  | N de « N maîtrise(s) » |
| `arme` | TEXT | non |  | forme nommee : l'arme telle qu'écrite (« Épée », « Hast », « Arme Jet ») ; NULL sinon |
| `arme_cle` | TEXT | non |  |  |
| `categorie` | TEXT | non |  | forme au_choix : « arme contact au choix », « arme à distance au choix » |
| `sauf` | TEXT | non |  | forme au_choix : « (sauf épée) » -> « épée » (tel qu'écrit) |
| `sauf_cle` | TEXT | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Classe Maverick V7 › Guerrier › A7:F9 » |

### `classe_annexe`

TABLEAU LIBRE D'UN ONGLET Tableau sans titre sous les aptitudes de Mage Bleu (A58:AR127, 14 lignes de 5 rangées : libellé en A, texte en G). Chaque libellé est un nom de magie en majuscules (SANG, ESPACE/TEMPS, NÉCROMANCIE…) et chaque texte une ou plusieurs lignes « (Passif) Nom. Effet. ». Le classeur ne donne pas de titre à ce tableau : rien n'est déduit de son rôle. `magie_id` est le rapprochement par nom (les 14 se résolvent).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `classe_id` | TEXT | oui | PK 1, → classe.id |  |
| `rang` | INTEGER | oui | PK 2 | ligne du tableau, de haut en bas |
| `libelle` | TEXT | oui |  |  |
| `libelle_cle` | TEXT | oui |  |  |
| `magie_id` | TEXT | non | → magie.id | magie dont le nom est le libellé (normalize) ; NULL si aucune |
| `texte` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

## 7. RACES, ETHNIES, ACCESSIBILITÉS (famille « races »)

### `race`

RACE : une ligne par race (27 dans les cinq onglets du classeur ; le guide dit « 23 disponibles », voir design.md §12)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK, → page.id | = id de la page 'races/<slug>' |
| `nom` | TEXT | oui | unique | « Race » col. A, identique dans les 5 onglets, l'index et le titre de la page : 'Elfe noir', « Drassah'thac » |
| `ordre` | INTEGER | oui | unique | rang dans l'onglet « Race » (1 = Humain) : c'est l'ordre d'affichage de la fiche |
| `presentation` | TEXT | non |  | phrase de présentation du classeur « Les races » (première feuille, col. B) ; NULL si absente |
| `sante` | INTEGER | non |  | « Santé » : PV de départ apportés par la race |
| `chakra_depart` | INTEGER | non |  | « Chakra départ » |
| `barriere_bonus` | INTEGER | non |  | « Barrière bonus » (s'ajoute à la moitié du chakra : règle de la fiche, hors de cette table) |
| `vitesse_terre` | INTEGER | non |  | « Vitesse sur terre » (unité non écrite dans la cellule) |
| `vitesse_nage` | INTEGER | non |  | « Vitesse de Nage » ; 0 pour Olwman et Rokh (leur « Divers » dit « ne peut pas nager ») |
| `ap` | INTEGER | non |  | « AP » : armure physique naturelle de la race (0 partout sauf Namazu) |
| `am` | INTEGER | non |  | « AM » : armure magique naturelle de la race (0 partout) |
| `divers` | TEXT | non |  | « Divers » (col. G) : texte libre d'information, jamais lu par une formule de la fiche. 13 races. Non typé : « Peut voler » et « Ne peut pas voler » y cohabitent, aucune recherche par LIKE n'est fiable. |
| `don_base_brut` | TEXT | non |  | cellule entière, telle qu'écrite |
| `don_base_nom` | TEXT | non |  | 1re partie : 'Méditation' ou 'Repos' |
| `don_base_type` | TEXT | non |  | 2e partie : 'Action' |
| `don_base_effets` | TEXT | non |  | 3e partie : 'Permet de récupérer 2d6 chakra (jet de calme en stress).' (texte, non analysé) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Fiche auto V15.2.2 › Race › A3:W3 ; Les races › première feuille › A2:B2 » |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |
| `mono_magie` | INTEGER | oui |  | 1 = « Une seule magie autorisé » (inconvénients de l'onglet de la race) : pas de magie acquise, quelle que soit l'innée (décision R28 du propriétaire : la Lamia ; migration 0022) |

### `race_restriction_carac`

RACE_RESTRICTION_CARAC : restrictions de caractéristique d'une race (onglet « Race », 6 paires de colonnes « < ou > » / « Restrictions <caractéristique> »). Une ligne par restriction RENSEIGNÉE : 17 lignes pour 13 races (les 14 autres races n'ont rien : pas de ligne, donc aucune restriction). Remplace 12 colonnes presque toujours vides.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK 1, → race.id |  |
| `caracteristique_id` | TEXT | oui | PK 2, → caracteristique.id |  |
| `operateur` | TEXT | oui |  | cellule « < ou > » : les trois textes de la source |
| `valeur` | INTEGER | oui |  | cellule « Restrictions <caractéristique> » (4.0 -> 4) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Fiche auto V15.2.2 › Race › J3:K3 » |

### `ethnie`

ETHNIE : une ligne par ligne de l'onglet « Bonus Race » (96) : sous-race, origine ou variété d'une race (« Elfe Noir Charbon », « Drakos Rouge », « Mort-Vivant Eau », « Orios de Terre »…). La clé de la source est le nom (col. B).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<race.id>#ethnie:<slug>' |
| `race_id` | TEXT | oui | → race.id | race de rattachement, déduite de la col. A (« Race ») après rapprochement des noms |
| `slug` | TEXT | oui |  |  |
| `nom` | TEXT | oui | unique | col. B (sans en-tête dans la source) : valeur que le joueur choisit dans la fiche |
| `ordre` | INTEGER | oui | unique | rang de la ligne dans l'onglet (ligne 2 = 1) ; ordre d'affichage |
| `libelle` | TEXT | non |  | col. C « Nom », telle qu'écrite ('Adaptation humaine', 'Sang corrompu', 'Terre ' avec son espace final) ; NULL pour Elfe Doré, Majin, Hujin, Lamia (cellule vide). Pour 14 races c'est le nom de la magie innée liée. |
| `magie_id` | TEXT | non | → magie.id | magie dont le nom est `libelle` (comparaison sans casse, sans accent, sans espace parasite) ; NULL sinon. La fiche s'en sert pour imposer l'ethnie par la magie innée choisie (BDD!X2). |
| `descriptif` | TEXT | non |  | col. D « Descriptif », texte multiligne tel qu'écrit (puces « - » comprises) ; seule description de l'effet |
| `race_brut` | TEXT | oui |  | col. A « Race » telle qu'écrite : 'Felfle' (coquille), 'Satyre ' (espace final), 'Elfe Forestier' (casse). Conservée pour que les anomalies de la source restent visibles (voir design.md §12, points ouverts). |
| `bonus_pv` | INTEGER | non |  |  |
| `bonus_chakra` | INTEGER | non |  |  |
| `bonus_barriere` | INTEGER | non |  |  |
| `bonus_ap` | INTEGER | non |  |  |
| `bonus_am` | INTEGER | non |  |  |
| `bonus_vitesse` | INTEGER | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Fiche auto V15.2.2 › Bonus Race › A6:N6 » |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `ethnie_resistance`

Résistances d'une ethnie (col. E/F = résistance 1, G/H = résistance 2 : un nom et une valeur). Le nom est soit une magie (« Sang », « Espace/Temps »), soit une altération d'état (« Brûlure », « Surcharge magique », « Pétrification ») : `cible_type` le dit, et la clé étrangère correspondante est renseignée. `valeur` est le nombre de crans écrit dans la cellule (+1 = un cran de résistance, -1 = un cran de vulnérabilité : les Mort-Vivant ont +1 à une magie et -1 à la magie opposée). 78 lignes : 65 ethnies ont au moins une résistance, dont 13 en ont deux (12 Mort-Vivant et Drassah'thac Nord). Drakos Orange (« résistance à l'altération choisie parmi toutes ») et Anansi d'Arcane (« sur une magie aléatoire ») n'ont rien de codé : pas de ligne, le choix reste dans le descriptif.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ethnie_id` | TEXT | oui | PK 1, → ethnie.id |  |
| `rang` | INTEGER | oui | PK 2 | 1 = colonnes E/F, 2 = colonnes G/H |
| `cible_type` | TEXT | oui |  |  |
| `cible_magie_id` | TEXT | non | → magie.id |  |
| `cible_etat_id` | TEXT | non | → etat.id | rapprochement explicite fait par l'importeur : « Pétrification » = l'état « Pétrifié » |
| `cible_brut` | TEXT | oui |  | nom tel qu'écrit dans la cellule |
| `valeur` | INTEGER | oui |  | 1.0 -> 1, -1.0 -> -1 |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Fiche auto V15.2.2 › Bonus Race › E27:F27 » |

### `race_classe`

RACE_CLASSE : matrice « Accessibilité de Classe » : 27 races x 39 classes = 1 053 lignes (712 à 1, 341 à 0). 26 classes générales (colonnes B à AA) + 13 classes raciales (AB à AN). La légende 0/1 n'est pas écrite dans le classeur : 1 = accessible est la lecture de la source (le « 1 » d'Orios sur la classe Orios et le « Classe possible : Orios » de Race!G14 la confirment). AUCUNE formule du classeur ne lit cet onglet (donnée d'information) ; voir design.md §12 pour ses contradictions avec la fiche.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK 1, → race.id |  |
| `classe_id` | TEXT | oui | PK 2, → classe.id | classe de la colonne, rapprochée par son nom d'en-tête (normalize(« Mage Bleu ») = 'mage-bleu') |
| `ordre` | INTEGER | oui |  | rang de la colonne dans la matrice (B = 1 ... AN = 39) : ordre des classes de la fiche |
| `accessible` | INTEGER | oui |  |  |
| `valeur_brut` | TEXT | oui |  | valeur de la cellule telle qu'écrite : '1' ou '0' (le dump la porte en 1.0 / 0.0) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Fiche auto V15.2.2 › Accessibilité de Classe › AB2 » |

### `race_magie`

RACE_MAGIE : matrice « Accessibilité Magie » : 27 races x 15 magies = 405 lignes (245 à 1, 160 à 0). Une case corrigée par le propriétaire : Lamia × Corruption, à 0 dans la fiche (E24), vaut 1 (décision R22, migration 0013 ; source_ref le dit). Selon les formules de la fiche, elle ne restreint que la magie INNÉE (BDD!D2 -> liste de Personnage!S2) ; la liste des magies acquises ne la lit pas. Elle remplace le champ de frontmatter `magies_innees` des pages de race.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK 1, → race.id |  |
| `magie_id` | TEXT | oui | PK 2, → magie.id | magie de la colonne, rapprochée par son nom d'en-tête (« Espace/Temps », « Potentiel Illimité ») |
| `ordre` | INTEGER | oui |  | rang de la colonne dans la matrice (B = 1 ... P = 15) : la fiche liste les magies dans cet ordre |
| `accessible` | INTEGER | oui |  |  |
| `valeur_brut` | TEXT | oui |  | '1' ou '0' (le dump : 1.0 / 0.0) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Fiche auto V15.2.2 › Accessibilité Magie › C2 » |

### `race_onglet`

▸ CONTENU DE L'ONGLET DE LA RACE : classeur « Les races », un onglet par race (migration 0007). Décision R13 du propriétaire : l'onglet est la SOURCE ; la fiche V15.2.2 (tables race, ethnie, race_restriction_carac…) en est un dérivé fait à la main, pas toujours à jour, dont les écarts ne sont plus affichés. Les pages de race du site sont rendues depuis ces tables (lib/races-db.mjs). Textes tels qu'écrits : paragraphes séparés par une ligne vide, retours à la ligne et puces « - » conservés ; un nombre n'est typé que s'il est écrit en chiffres. Lignes tirées des pages races/<slug> par tools/db/races_onglet.py (preuve : chaque section se réécrit à l'identique avec le code de tools/sheets/races.py, l'importeur qui a lu les onglets). RACE_ONGLET : une ligne par race.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK, → race.id |  |
| `onglet` | TEXT | oui | unique | nom de l'onglet : « Elfe Noir », « Namazus » |
| `description_generale` | TEXT | oui |  | description générale (A4) |
| `histoire` | TEXT | oui |  | « HISTOIRE » (AK3) |
| `description` | TEXT | non |  | « DESCRIPTION » (AK30) : physique et culture, un bloc pour toute la race |
| `sante_depart` | INTEGER | oui |  | « Santé de départ » |
| `chakra_depart` | INTEGER | oui |  | « Chakra de départ » |
| `barriere_bonus` | INTEGER | oui |  | « Barrière bonus » |
| `vitesse_sol` | INTEGER | oui |  | « Vitesse Sol/Nage » : première valeur |
| `vitesse_nage` | INTEGER | oui |  | « Vitesse Sol/Nage » : seconde valeur |
| `avantages` | TEXT | oui |  | « Avantage(s) » |
| `inconvenients` | TEXT | oui |  | « Inconvénient(s) » |
| `don_base` | TEXT | oui |  | « Don B (Base) » |
| `dons_rubrique` | TEXT | non |  | 1re colonne : ce qui distingue l'ethnie |
| `dons_rubrique_nom` | TEXT | non |  | colonne du nom du don (« Nom ») ; NULL si absente |
| `dons_rubrique_don` | TEXT | non |  | colonne du don (« Don ») |
| `dons_tableau_titre` | TEXT | non |  | nom écrit sur le tableau en panneaux (Drakos : « Écaille draconique ») |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `race_don`

RACE_DON : dons raciaux de l'onglet, dans son ordre. forme 'ethnie' = une ligne du tableau des ethnies (étiquette = 1re colonne : « Elfe Charbon », « Londolor Est », « Eau en innée ») ; 'unique' = le don de toute la race, sans tableau (Elfe doré, Majin, Hujin, Lamia, et « Trompe-mort » du Mort-vivant). Les ethnies de l'onglet ne portent pas le nom des sous-races de la fiche : `ethnie_id` est la correspondance explicite de l'importeur (ETHNIE_FICHE).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<race_id>#don:<slug>' |
| `race_id` | TEXT | oui | → race_onglet.race_id |  |
| `slug` | TEXT | oui |  | normalize(etiquette) ou, pour un don unique, normalize(nom) |
| `rang` | INTEGER | oui |  | ordre de l'onglet |
| `forme` | TEXT | oui |  |  |
| `etiquette` | TEXT | non |  | 1re colonne du tableau des ethnies (retours à la ligne réduits à une espace) ; NULL pour un don unique |
| `nom` | TEXT | non |  | nom du don (« Sang corrompu ») ; NULL quand l'onglet n'en écrit pas |
| `texte` | TEXT | oui |  | le don, tel qu'écrit |
| `ethnie_id` | TEXT | non | → ethnie.id | sous-race de la fiche qui lui correspond ; NULL = aucune (Trompe-mort) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `race_don_tableau_colonne`

RACE_DON_TABLEAU_* : le tableau en panneaux du bloc « Don R (Race) » (Drakos : magie innée -> AP/AM, bonus de compétence, cran de résistance ; Mort-vivant : lieu de résurrection / raison de la mort -> don), cellule par cellule. Une race en a au plus un ; son titre est race_onglet.dons_tableau_titre.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK 1, → race_onglet.race_id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `libelle` | TEXT | oui |  | en-tête tel qu'écrit (« Lieu de résurrection\nRaison de la mort ») |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `race_don_tableau_ligne`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK 1, → race_onglet.race_id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `ethnie_id` | TEXT | non | → ethnie.id | sous-race de la fiche qui correspond à la ligne (« Drakos Rouge » pour Feu) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `race_don_tableau_cellule`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK 1, → race_don_tableau_ligne.race_id |  |
| `ligne` | INTEGER | oui | PK 2, → race_don_tableau_ligne.rang |  |
| `colonne` | INTEGER | oui | PK 3, → race_don_tableau_colonne.rang |  |
| `valeur` | TEXT | oui |  | texte de la cellule tel qu'écrit (puces « - » et retours à la ligne conservés) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `race_magie_onglet`

RACE_MAGIE_ONGLET : magies innées que l'onglet de la race limite explicitement (ligne « Inconvénient(s) » : « Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné uniquement »), dans l'ordre où il les cite. Quand une race en a, cette liste PRIME sur la matrice race_magie (décision R11 : le Nain) ; sinon la matrice fait foi (décision R8). Les 13 races hybrides citent les trois mêmes magies que la matrice.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | oui | PK 1, → race_onglet.race_id |  |
| `magie_id` | TEXT | oui | PK 2, → magie.id |  |
| `rang` | INTEGER | oui |  |  |
| `nom_brut` | TEXT | oui |  | nom de la magie dans la liste de l'importeur (« Potentiel Illimité ») |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `echelle_relation`

▸ RELATIONS ENTRE PEUPLES : classeur « Les races », onglet « Relation entre les races » (page lore/relations-entre-les-races). Matrice carrée de 69 peuples en lignes et en colonnes ; chaque case porte un niveau de l'échelle (de « Même peuple » à « Ennemie »). La matrice n'est PAS symétrique. SENS (décision R12 du propriétaire) : la case (ligne A, colonne B) dit comment A voit B ; la légende de l'onglet (« Verticale = Comment le peuple voit les autres », « Horizontale = Comment le peuple est vu par les autres ») vise les étiquettes. Les colonnes gardent les noms de l'axe (ligne = étiquette de gauche, colonne = étiquette du haut) ; la vue v_regard_peuple les nomme « qui voit qui ».

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | normalize(libelle) : 'meme-peuple', 'alliee', 'appreciee', 'acceptee', 'neutre', 'evitee', 'haine', 'ennemie' |
| `libelle` | TEXT | oui | unique | « Même peuple », « Alliée »… tel qu'écrit |
| `ordre` | INTEGER | oui | unique | ordre de l'onglet, de gauche à droite : du plus favorable au plus défavorable |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `peuple`

Un peuple = une étiquette de l'onglet (« Elfe Forestier Forêt », « Humain Central »…) : recopiée telle qu'écrite (coquilles comprises : « Supprémaciste »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'lore/relations-entre-les-races#peuple:elfe-noir-charbon' |
| `nom` | TEXT | oui | unique |  |
| `nom_cle` | TEXT | oui | unique | normalize(nom) |
| `ordre` | INTEGER | oui | unique | rang de l'étiquette dans l'onglet (1 à 69) |
| `race_id` | TEXT | non | → race.id | rapprochement INFORMATIF : l'unique race dont le titre commence le nom ; NULL sinon |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `relation_peuple`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ligne_peuple_id` | TEXT | oui | PK 1, → peuple.id | étiquette de GAUCHE de la case : le peuple qui voit (R12) |
| `colonne_peuple_id` | TEXT | oui | PK 2, → peuple.id | étiquette du HAUT de la case : le peuple vu (R12) |
| `echelle_id` | TEXT | oui | → echelle_relation.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Les races › Relation entre les races › E23:H26 » |

## 8. BESTIAIRE : invocations et créatures (famille « bestiaire »)

### `invocation`

INVOCATION : une ligne par onglet du classeur (3) Une « invocation » est un TYPE de créatures qu'un sort permet d'invoquer : golems (Appel aux golems), non-morts (Animation des morts), marionettes d'ombre (Marionette de lombre).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK, → page.id | = id de la page d'introduction de l'onglet |
| `nom` | TEXT | oui | unique | nom de l'onglet = titre de la page : 'Appel aux golems', « Marionnette de l'ombre » (onglet « Marionette de lombre », nom corrigé par 0006) |
| `nom_cle` | TEXT | oui | unique | normalize(nom) |
| `ordre` | INTEGER | oui | unique | rang de l'onglet dans le classeur |
| `bandeau` | TEXT | oui |  | bandeau de l'onglet (AJ1, AP1, Z1) : 'INVOCATION GOLEM', 'INVOCATION NON-MORT' |
| `genre` | TEXT | oui |  |  |
| `sort_id` | TEXT | non | → sort.id |  |
| `texte_general` | TEXT | non |  | texte général de l'onglet (AJ3, AP3, Z3), tel qu'écrit, paragraphes séparés par une ligne vide |
| `tableau_titre` | TEXT | non |  | titre du tableau posé à droite des cartes (AP40 de « Animation des morts » : « TABLEAU "AMELIORATION CADAVERIQUE" »), NULL = aucun. Le CONTENU de ce tableau (13 lignes) est la table amelioration_cadaverique du domaine magies : le même tableau figure dans les deux classeurs (identité vérifiée à l'import) ; une seule copie, pas de doublon ici. |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `invocation_capacite_commune`

Capacités communes d'une invocation : la liste « ▸ Toutes ces créatures ont ceci en capacité commune » du texte général (golems : Inerte, Élémentaire ; non-morts : Non-Mort, Élémentaire). Une ligne = un élément de la liste « - Nom. Texte ». Reconstruction : '- ' || nom || '. ' || texte = l'élément de liste de texte_general.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<invocation.id>#commune:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006) |
| `invocation_id` | TEXT | oui | → invocation.id |  |
| `rang` | INTEGER | oui |  | ordre dans la liste |
| `nom` | TEXT | oui |  | « Inerte », « Non-Mort », « Élémentaire » : jusqu'au premier « . » |
| `nom_cle` | TEXT | oui |  | normalize(nom) : 'inerte', 'non-mort', 'elementaire' |
| `texte` | TEXT | oui |  | le reste de l'élément |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `invocation_resistance`

Résistances / vulnérabilités / immunités écrites dans une capacité COMMUNE (aujourd'hui : « Non-Mort » : immunisée à la peur, à la couardise, à la fatigue, au poison, à la maladie). INDEX DÉRIVÉ DU TEXTE par une table explicite de l'importeur (RESISTANCES_COMMUNES) : `extrait` est la tournure exacte de la capacité (contrôlée à l'import : elle doit figurer dans `texte`). La règle « Élémentaire » n'est PAS ici : elle se déduit de la magie de la créature (vue v_creature_resistance). Les lignes s'appliquent à CHAQUE créature de l'invocation (vue v_creature_resistance).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `capacite_commune_id` | TEXT | oui | PK 1, → invocation_capacite_commune.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `sens` | TEXT | oui |  |  |
| `sens_brut` | TEXT | oui |  | mot de la source : « immunisée », « résistante », « faiblesse », « sensibilité »… |
| `cible_type` | TEXT | oui |  |  |
| `cible_magie_id` | TEXT | non | → magie.id | 'magie' : « résistante contre le Feu » |
| `cible_etat_id` | TEXT | non | → etat.id | 'etat'  : « faiblesse contre la paralysie » |
| `cible_degat` | TEXT | non |  | 'degat' : « aux attaques d'estoc » |
| `cible_brut` | TEXT | oui |  | la cible comme écrite (« la peur », « Acide », « maladie ») |
| `extrait` | TEXT | oui |  | tournure exacte de la capacité d'où la ligne est tirée |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `invocation_bloc`

BLOC : une ligne de marge du classeur (A13:C16, A42:C45…) = une combinaison de magies avec ses deux créatures Onglets « Appel aux golems » (15 blocs) et « Animation des morts » (14) : la marge dit la ou les magies (« Terre Mono », « Terre + Sang », « Nécromancie + Espace/Temps »), la carte de gauche et celle de droite sont les deux créatures du bloc. Onglet « Marionette de lombre » (5 blocs) : la marge est un palier « EP1 » à « EP5 », UNE créature par bloc.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<invocation.id>#bloc:<cle>' |
| `invocation_id` | TEXT | oui | → invocation.id |  |
| `rang` | INTEGER | oui |  | ordre des blocs dans l'onglet (de haut en bas) |
| `cle` | TEXT | oui |  | normalize(marge_brut) : 'terre-feu', 'terre-mono', 'ep3' |
| `marge_brut` | TEXT | oui |  | libellé de marge, espaces compactés : 'Terre + Sang', 'Terre Mono', 'EP1' |
| `ep` | INTEGER | non |  | N de « EPN » (onglet Marionette seulement). Le sigle EP n'est défini nulle part dans le classeur : conservé tel quel, sans traduction. |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `invocation_bloc_magie`

Magies de la marge d'un bloc, dans l'ordre d'écriture. « Terre Mono » = une ligne ; « Terre + Feu » = deux lignes ; « Terre + Terre » = deux lignes identiques (double magie de la même magie : pas d'UNIQUE sur magie_id). Le classeur dit que l'utilisateur de la Terre (resp. de la Nécromancie) lance le sort et que la seconde magie vient de lui ou d'un allié : la première magie de la marge est donc celle du sort (vérifié à l'import contre invocation.sort_id). Aucune ligne pour l'onglet Marionette (marge « EPN »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `bloc_id` | TEXT | oui | PK 1, → invocation_bloc.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `magie_id` | TEXT | oui | → magie.id |  |
| `magie_brut` | TEXT | oui |  | écriture dans la marge : 'Terre', 'Espace/Temps' (sans « Mono ») |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `creature`

CREATURE : une ligne par carte (63 = 30 golems/poupées + 28 non-morts + 5 marionettes)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK, → page.id | = id de la page (entité typée qui a SA page) |
| `nom` | TEXT | oui | unique | nom de la carte (D1 / T1) = titre de la page ; orthographe corrigée par 0006 (l'id garde la clé d'origine) |
| `nom_cle` | TEXT | oui | unique | normalize(nom) : 'golem-de-magma' ; jointures par nom avec les autres domaines |
| `invocation_id` | TEXT | oui | → invocation.id |  |
| `bloc_id` | TEXT | oui | → invocation_bloc.id | bloc de marge (combinaison de magies ou palier EP) ; FK composite plus bas |
| `rang` | INTEGER | oui |  | 1 = carte de gauche, 2 = carte de droite du bloc (2 seulement en onglets « duo ») |
| `description` | TEXT | non |  | cellule de description (D3 / T3) ; NULL = absente |
| `sante_brut` | TEXT | oui |  |  |
| `sante_forme` | TEXT | oui |  |  |
| `sante_valeur` | INTEGER | oui |  |  |
| `chakra_brut` | TEXT | non |  | NULL : pas de ligne « Chakra » (onglet Marionette) |
| `chakra_forme` | TEXT | non |  |  |
| `chakra_valeur` | INTEGER | non |  |  |
| `barriere_brut` | TEXT | non |  |  |
| `barriere_forme` | TEXT | non |  |  |
| `barriere_valeur` | INTEGER | non |  |  |
| `defense_brut` | TEXT | non |  |  |
| `defense_forme` | TEXT | non |  |  |
| `armure_physique` | INTEGER | non |  |  |
| `armure_physique_par_npm` | INTEGER | non |  |  |
| `armure_magique` | INTEGER | non |  |  |
| `armure_magique_par_npm` | INTEGER | non |  |  |
| `vitesse_brut` | TEXT | non |  |  |
| `vitesse_sol` | INTEGER | non |  |  |
| `vitesse_nage` | INTEGER | non |  |  |
| `fpvsia_brut` | TEXT | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Invocation › Appel aux golems › D1:R28 » (la carte entière) |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `creature_ressource`

Ligne facultative « ressource supplémentaire » de la carte (D9 + ligne suivante : Sang, Corruption, Âme) : 3 poupées seulement.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | oui | PK 1, → creature.id |  |
| `ressource` | TEXT | oui | PK 2 | normalize(libelle) |
| `libelle` | TEXT | oui |  | « Sang », « Corruption », « Âme » tel qu'écrit |
| `brut` | TEXT | oui |  | « 10 » ou « 10/NPM » |
| `forme` | TEXT | oui |  |  |
| `valeur` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `creature_caracteristique`

Les six nombres de la cellule FPVSIA, dans l'ordre d'écriture (rang 1 à 6). Le classeur n'explicite pas le sigle : l'importeur lit F, P, V, S, I, A comme Force, Perception, Volonté, Social, Intelligence, Agilité (constante FPVSIA_ORDRE). Indices dans la source : l'ordre « 1 Force, 2 Perception, 3 Volonté, 4 Social, 5 Intelligence, 6 Agilité » de la table des accessoires, la capacité commune des golems « Inerte. Boost la volonté à 10 » (3e nombre = 10 pour les 30 golems/poupées), et les bonus « +1 Force au niveau 2 magique » toujours posés sur une caractéristique de valeur supérieure à 1 (contrôle à l'import). À confirmer par le propriétaire (design.md §12, points ouverts) : en cas d'erreur, seule la constante de l'importeur change, pas le schéma.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | oui | PK 1, → creature.id |  |
| `caracteristique_id` | TEXT | oui | PK 2, → caracteristique.id | domaine fiche : 'force', 'perception', 'volonte', 'social', 'intelligence', 'agilite' |
| `rang` | INTEGER | oui |  | position dans la cellule |
| `valeur` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `creature_bonus_npm`

Bonus écrits entre parenthèses après les six nombres : « (+1 Force au niveau 2 magique, +1 Force au niveau 4 magique) ». Une ligne par « +N <caractéristique(s)> au niveau M magique ». `niveau_magique` est le M écrit (la capacité écrit « NPM M » : même échelle probable, non dite). `caracteristique_id` n'est renseigné que si la cible est UNE caractéristique ; « Force/Agilité » (Zombinox, Embrasé) reste dans cible_brut avec caracteristique_id NULL : le classeur ne dit pas « l'une ou l'autre » ou « les deux ».

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | oui | PK 1, → creature.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `niveau_magique` | INTEGER | oui |  |  |
| `increment` | INTEGER | oui |  | « +1 » -> 1 |
| `cible_brut` | TEXT | oui |  | « Force », « Force/Agilité » |
| `caracteristique_id` | TEXT | non | → caracteristique.id |  |
| `texte_brut` | TEXT | oui |  | fragment exact : « +1 Force au niveau 2 magique » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `creature_attaque`

ATTAQUES : ligne « Dégâts » de la carte, une ligne de texte par attaque « Poing - 1d10/NPM dégâts de frappe », « Canon magma - 1d10/NPM dégâts de frappe/feu (portée 4-18|zone 2x2|Coûte 10% de santé) ». `brut` = la ligne entière (reconstruction : nom || ' - ' || reste ; contrôlée à l'import). Les colonnes typées ne sont remplies que pour les formes sans ambiguïté ; `precisions` garde TOUTES les parenthèses (zone, cône, coût en santé, « 2Po-Cône »…).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<creature.id>#attaque:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006) ; '…~2' pour une attaque écrite deux fois à l'identique (Golem d'ombre) |
| `creature_id` | TEXT | oui | → creature.id |  |
| `rang` | INTEGER | oui |  | ligne dans la cellule « Dégâts » (position : n'entre pas dans l'identifiant) |
| `nom` | TEXT | oui |  | avant le premier « - » : « Poing », « Arbalécho », « L'arme du lanceur » |
| `nom_cle` | TEXT | oui |  | normalize(nom) |
| `occurrence` | INTEGER | oui |  | n° d'apparition de ce nom dans la cellule : 1, sauf attaque écrite deux fois |
| `brut` | TEXT | oui |  |  |
| `formule_brut` | TEXT | oui |  | avant « dégâts » : « 1d10/NPM », « 1d10+2/NPM », « (1d4/NPM)x1d4 », « 6d6 » |
| `des_nombre` | INTEGER | non |  | « 1d10+2/NPM » -> 1 ; NULL si la formule n'est pas « NdM[+K][/NPM] » |
| `des_faces` | INTEGER | non |  | 10 |
| `bonus_fixe` | INTEGER | non |  | 2 (NULL si pas de « +K ») |
| `par_npm` | INTEGER | oui |  | 1 si « /NPM » est écrit dans la formule OU juste après le type (« 1d6 dégâts d'eau/NPM ») |
| `type_brut` | TEXT | non |  | ce qui suit « dégâts » hors parenthèses, sans « /NPM » final : « de taille/estoc » ; NULL = aucun |
| `precisions` | TEXT | non |  | parenthèses telles qu'écrites : « (portée 1-8) », « (4Po-Cône) (5 chakra) », « (sans type) » |
| `portee_min` | INTEGER | non |  | « portée 4-18 », « Portée 1 - 6 », « Po = 1 - 8 » ; NULL pour « 2Po-Cône » (ambigu) |
| `portee_max` | INTEGER | non |  |  |
| `cout_chakra` | INTEGER | non |  | « (5 chakra) » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | plage de la cellule « Dégâts » (G11:R12) |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `creature_attaque_type`

Types de dégâts d'une attaque : « de taille/estoc » = deux lignes ; « de frappe/feu » = frappe + feu. Aucune ligne si la ligne n'a pas de type (« 6d6 dégâts », « (sans type) »). Les vocabulaires physique (frappe, taille, estoc) et élémentaire (feu, eau, glace : lié à la magie du même nom) sont ceux du classeur ; « sonore » n'est ni l'un ni l'autre.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `attaque_id` | TEXT | oui | PK 1, → creature_attaque.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `type` | TEXT | oui |  |  |
| `libelle` | TEXT | oui |  | écriture d'origine du mot |
| `magie_id` | TEXT | non | → magie.id | magie du même nom pour feu / eau / glace |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `creature_capacite`

CAPACITÉS : cellule « Capacité(s) », un paragraphe (séparé par une ligne vide) = une capacité Forme du paragraphe : « [(NPM n) ][[étiquette] ]Nom. Texte ». Reconstruction exacte : ['(NPM ' || npm_min || ') '] || ['[' || etiquette || '] '] || nom || '. ' || texte (contrôlée à l'import)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<creature.id>#capacite:<clé du nom à l'import>' ; gelé : un renommage change nom et nom_cle, jamais l'id (0006) ; '…#capacite:sort-supplementaire:npm3' quand le nom se répète à un autre NPM |
| `creature_id` | TEXT | oui | → creature.id |  |
| `rang` | INTEGER | oui |  | ordre des paragraphes |
| `npm_min` | INTEGER | non |  | préfixe « (NPM 3) » : niveau de puissance magique à partir duquel la capacité s'ajoute ; NULL = capacité de base |
| `etiquette` | TEXT | non |  | « [Non enflammé] » (Golem de pétrole, NPM 3) : sans les crochets ; NULL = aucune |
| `nom` | TEXT | oui |  | jusqu'au premier « . » : « Bouclier de feu », « Lanceur de sorts », « Annule 12 » |
| `nom_cle` | TEXT | oui |  | normalize(nom) |
| `texte` | TEXT | oui |  | le reste du paragraphe, retours à la ligne conservés |
| `donnees` | TEXT | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | plage de la cellule « Capacité(s) » (G19:R28) |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `creature_capacite_sort`

Sorts cités par une capacité « Lanceur de sorts » (« avec les niveaux de maîtrises maximum : Boule de feu, Cautérisation ») ou « Sort supplémentaire » (« obtient de nouveaux sorts en plus des autres : … »). Une ligne par nom de la liste. sort_id = le sort de la table `sort` (domaine magies) de même nom (normalize) parmi les sorts des magies du bloc ; NULL (et sort_nom_brut seul) quand aucun ne porte ce nom : 6 cas sur 105 (« Boule de foudre » pour « Boules de foudre », « Veilliessement »…) sont laissés NULL : rapprocher serait deviner (voir design.md §12). Le niveau de maîtrise « maximum » n'est pas stocké : il est dans le texte de la capacité.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `capacite_id` | TEXT | oui | PK 1, → creature_capacite.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `sort_nom_brut` | TEXT | oui |  | nom écrit dans la liste |
| `sort_id` | TEXT | non | → sort.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `creature_capacite_resistance`

Résistances / vulnérabilités / immunités déclarées par le texte d'une capacité de la créature (« Fait de verre. Cette créature est résisantante contre le Feu, Terre… », « Gluant… faiblesse contre la paralysie », « Squelettique. … immunisée aux attaques d'estoc »). INDEX DÉRIVÉ DU TEXTE par une table explicite de l'importeur (RESISTANCES_CAPACITES) : `extrait` est la tournure exacte, contrôlée à l'import (elle doit figurer dans le texte de la capacité). NON exhaustif : les résistances chiffrées (« la moitié des dégâts… », « 4 fois moins de dégâts de foudre ») et dynamiques (« une résistance à l'élément du dernier sort subi ») restent dans le texte. `sens` : 'sensibilite' est gardé distinct de 'vulnerabilite' (le classeur des états distingue « Sensibilité » et « Vulnérabilité »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `capacite_id` | TEXT | oui | PK 1, → creature_capacite.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `sens` | TEXT | oui |  |  |
| `sens_brut` | TEXT | oui |  | « résisantante » (coquille conservée), « immunisée », « faiblesse », « sensibilité »… |
| `cible_type` | TEXT | oui |  |  |
| `cible_magie_id` | TEXT | non | → magie.id |  |
| `cible_etat_id` | TEXT | non | → etat.id |  |
| `cible_degat` | TEXT | non |  |  |
| `cible_brut` | TEXT | oui |  |  |
| `extrait` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `creature_effet`

AUTRES BLOCS DE LA CARTE Panneau « Effet "Manteau noir" » de la carte des marionettes (S12 / S13 : libellé puis texte) : les bonus que procure la créature quand on la sacrifie avec le sort « Manteau noir » (domaine magies : « Permet de sacrifier l'invocation de l'ombre pour avoir des bonus pendant 3 tours (voir invocation) »). sort_id = le sort de la magie de l'invocation dont le nom est celui des guillemets.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | oui | PK 1, → creature.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `libelle` | TEXT | oui |  | « Effet "Manteau noir" » tel qu'écrit |
| `nom` | TEXT | oui |  | ce qui est entre guillemets : « Manteau noir » |
| `sort_id` | TEXT | non | → sort.id | le sort de ce nom dans la magie du sort d'invocation ; NULL si introuvable |
| `texte` | TEXT | oui |  | « - +2 dégâts\n- Chaque attaque qui touche… » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

## 9. ÉQUIPEMENT, RESSOURCES, CRAFT, MÉTIERS (familles « equipement », « craft », « docs_typees »)

### `monnaie`

Monnaies de l'onglet « Équipement inventaire » (MONNAIE A3:D7 et CONVERTISSEUR A12:D16).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | abréviation en minuscules : 'rf', 'ro', 'pp' |
| `nom` | TEXT | oui | unique | « Ricken de fer », « Ricken d'or », « Pierre précieuse » |
| `abreviation` | TEXT | oui | unique | « RF », « RO », « PP » |
| `valeur_rf` | INTEGER | oui |  | valeur en RF : 1 / 100 / 100 000. Le RF est l'unité du CONVERTISSEUR (valeur 1 par définition) |
| `convertisseur_brut` | TEXT | non |  | ligne du CONVERTISSEUR telle qu'écrite (« 1 RO : 100 RF ») ; NULL pour le RF (aucune ligne) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `constante_equipement`

Constantes chiffrées que la source écrit dans ses textes de règles et dont le modèle a besoin (« Toutes les armes ont de base 2 cran de solidité », « Chaque ingrédient indiqué dans une recette représente deux unités »…). Une ligne = une phrase de la source ; `valeur` est le nombre de cette phrase (le chargeur vérifie que la phrase est bien dans la cellule ou la page). Les autres règles restent du texte (corps_md des pages).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'arme.solidite_base', 'alchimie.unites_par_ingredient'… |
| `valeur` | INTEGER | oui |  |  |
| `unite` | TEXT | non |  | 'crans', '%', 'unites', 'materiaux' ; NULL si le nombre n'a pas d'unité propre |
| `texte` | TEXT | oui |  | la phrase de la source, telle qu'écrite |
| `page_id` | TEXT | oui | → page.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `niveau_alchimie`

Niveaux de difficulté des recettes d'alchimie : Novice < Apprenti < Avancé < Expert < Maître (colonne « Niveau » des potions et table des kits : « Faire les recettes novice / apprentis ou moins / avancées ou moins… »). L'ordre est celui de la table des kits.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'novice', 'apprenti', 'avance', 'expert', 'maitre' |
| `nom` | TEXT | oui | unique | « Novice », « Apprenti », « Avancé », « Expert », « Maître » |
| `rang` | INTEGER | oui | unique | 1 = Novice |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `affinite`

Affinités alchimiques (colonne « Affinité » des listes d'ingrédients et cellules des tables « Recette »). Une affinité composée (« Santé + Chakra ») est UNE affinité : elle a sa propre ligne, dont la clé est l'ensemble de ses composantes, triées (« Barrière + Chakra » des ingrédients et « Chakra + Barrière » d'une recette désignent donc la même ligne).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | composantes normalisées, triées, jointes par '+' : 'sante', 'chakra+sante', 'regeneration-chakra', '4eme-barre', 'espace-temps' |
| `libelle` | TEXT | oui |  | première écriture rencontrée (ordre des listes d'ingrédients) : « Santé + Chakra » |
| `nb_composantes` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `arme_famille`

Familles d'armes = bandeaux de l'onglet « Armes » (12 : ÉPÉES - D10, DAGUES - D6, … ARME DE MONSTRES). Une arme est listée sous UN bandeau ; les armes à deux catégories (Crochet grappin, Étendard de guerre…) apparaissent sous deux bandeaux, avec deux lignes distinctes.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | slug du nom du bandeau : 'epees', 'masse-marteau', 'lance-arme-dhast', 'arme-de-monstres' |
| `libelle_brut` | TEXT | oui |  | bandeau complet tel qu'écrit : « ARME DE JET - D6 [Un matériau permet d'en faire 10 sauf pour la fronde qui elle est unique] » |
| `nom` | TEXT | oui |  | partie avant « - » : « ARME DE JET » |
| `de_brut` | TEXT | non |  | dé(s) écrit(s) après « - » : « D10 », « D6/D8/D10 » ; NULL pour ARME DE MONSTRES (renvoi à la catégorie d'arme) |
| `note_brut` | TEXT | non |  | le reste du bandeau sans ses parenthèses ni crochets : « D6 1-2 Force, D8 3-4 Force, D10 5 Force », « Disponible en l'an 150 » ; NULL sinon |
| `cout_libelle` | TEXT | oui |  | en-tête de la colonne de coût du bandeau : « Coût » (Épées) ou « Coût en plus/moins » ; « … (unité) » : coût d'une pièce de munition ou de bombe |
| `ordre` | INTEGER | oui | unique | rang du bandeau de gauche à droite |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `arme_type`

Types d'armes = table BDD!AD2:AF14 de la fiche automatique (13 types) : dé de dégâts et portée par défaut. C'est le « type » que la fiche lit (première ligne de la cellule Catégorie : « Épée / Arme Lourde » -> Épée). Dé du Pugilat : il dépend de la Force (D6 jusqu'à 2, D8 à 3-4, D10 à 5 : bandeau PUGILAT de l'onglet Armes) : `de` est NULL et la règle est dans `de_regle`.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | slug : 'epee', 'arme-dhast', 'arme-dhast-baton', 'masse-hache', 'baton-de-combat' |
| `nom` | TEXT | oui | unique | écriture de la fiche : « Épée », « Bâton de Combat », « Arme d'Hast/Baton » |
| `de` | TEXT | non |  | « D10 » ; NULL pour le Pugilat |
| `de_faces` | INTEGER | non |  | 10 |
| `de_regle` | TEXT | non |  | règle du dé quand il n'est pas fixe (Pugilat), recopiée du bandeau |
| `portee_min` | INTEGER | oui |  | portée par défaut (« 1-2 » -> 1) |
| `portee_max` | INTEGER | oui |  |  |
| `portee_brut` | TEXT | oui |  | « 1-2 » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `ressource`

▸ CATALOGUE : RESSOURCES Tout ce qui porte un nom et un prix dans les listes de la source et peut entrer dans une recette ou en sortir : matériaux, gemmes, bois, ingrédients d'alchimie, potions, matériel, produits non monétaires, parchemins, livres, kits, matériaux de construction. Genre 'mentionne' : nom rencontré UNIQUEMENT dans le texte d'une recette (« minerais de fer », « Bas Fourneau ») : la source n'en dit rien d'autre ; la ligne existe pour que « les recettes qui utilisent X » se joigne par clé et non par LIKE.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<page>#<sorte>:<slug>', sorte ∈ materiau, gemme, bois, ingredient, potion, produit, materiel, parchemin, livre, kit, materiau-construction, mentionne ; ingrédients : '<page>#ingredient:<catégorie>:<slug>' (« Gelée orange » existe en Essence ET en Stabilisateur) ; un matériau a l'id de la page Armures (ou Armes pour « Os ») |
| `genre` | TEXT | oui |  |  |
| `section` | TEXT | non |  | rubrique de la source : 'VEGETAUX', 'MATOS AVENTURES', 'Essence', 'PARCHEMIN'… ; NULL si la liste n'en a pas |
| `nom` | TEXT | oui |  | tel qu'écrit (espaces de bord retirés) |
| `nom_cle` | TEXT | oui |  | normalize(nom) : clé de jointure par nom |
| `description` | TEXT | non |  | colonne « Description » quand la liste en a une ; NULL sinon |
| `prix_brut` | TEXT | non |  | « 100 RF / 1 RO », « 2 Ro », « 0,6 Ro » ; NULL si la source n'en donne pas |
| `prix_rf` | INTEGER | non |  | voir règles communes ; 0,6 Ro = 60 |
| `page_id` | TEXT | oui | → page.id | page du wiki où la ressource est définie |
| `ordre` | INTEGER | non |  | rang dans sa liste (de haut en bas) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `materiau_arme`

Matériau d'arme : onglet Armes › MATERIAUX (14 matières ; effet = « Dégâts +N pour l'arme » puis lignes d'effets secondaires).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `prix_brut` | TEXT | oui |  | colonne « Prix matériaux » de CET onglet (peut différer de ressource.prix_brut : « 100 RF / 10 RO » ici, « 1 000 RF / 10 RO » dans Armures) |
| `prix_rf` | INTEGER | non |  |  |
| `effet_brut` | TEXT | oui |  | cellule « Effets » entière |
| `bonus_degats` | INTEGER | non |  | N de « Dégâts +N pour l'arme » ; NULL pour « rien de particulier » (Fer) |
| `cran_solidite` | INTEGER | non |  | ±N de « ±N cran de solidité » ; NULL si la ligne est absente |
| `effet_secondaire` | TEXT | non |  | lignes de l'effet autres que le bonus et le cran (« 1d4 de corruption a chaque coup qui touche ») ; NULL si aucune |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `materiau_armure`

Matériau d'armure : « Fiches des matières de la grille » (en-têtes de colonne de l'onglet Armures, 21 matières).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `type` | TEXT | oui |  |  |
| `prix` | REAL | non |  | « Prix : 1,5 » -> 1.5 ; l'unité n'est pas écrite dans la fiche (RO d'après le recoupement avec « Prix matériaux », à confirmer) |
| `prix_brut` | TEXT | non |  |  |
| `stats_brut` | TEXT | oui |  | « +2AP +4AM » |
| `ap` | INTEGER | non |  | N de « +NAP » ; NULL si « AP » n'est pas écrit (la fiche compte 0) |
| `am` | INTEGER | non |  |  |
| `solidite` | INTEGER | oui |  |  |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `materiau_bouclier`

Matériau de bouclier : « Fiches des matières pour boucliers » (20 matières : pas de Peau). « Les matériaux n'ont pas les mêmes stats pour les boucliers par rapport aux armures. »

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `prix` | REAL | non |  |  |
| `prix_brut` | TEXT | non |  |  |
| `stats_brut` | TEXT | oui |  |  |
| `ap` | INTEGER | non |  |  |
| `am` | INTEGER | non |  |  |
| `solidite` | INTEGER | oui |  |  |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `gemme`

Gemmes précieuses (14, une par magie) : onglet Bâton magique (prix de la gemme entière) et onglet Accessoires (prix d'un QUART de gemme, « Chaque accessoire possède des morceaux de gemmes, ce sont des quarts de gemmes »). Qualités : commune (= « normal » / « classique »), raffinée, parfaite (= « Prix (Parfait) » / « parfaite »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `magie_id` | TEXT | oui | → magie.id, unique | gemme « liée à une magie » |
| `prix_commune_brut` | TEXT | non |  | Bâton magique : gemme entière |
| `prix_commune_rf` | INTEGER | non |  |  |
| `prix_raffinee_brut` | TEXT | non |  |  |
| `prix_raffinee_rf` | INTEGER | non |  |  |
| `prix_parfaite_brut` | TEXT | non |  |  |
| `prix_parfaite_rf` | INTEGER | non |  |  |
| `quart_commune_brut` | TEXT | non |  | Accessoires : quart de gemme |
| `quart_commune_rf` | INTEGER | non |  |  |
| `quart_raffinee_brut` | TEXT | non |  |  |
| `quart_raffinee_rf` | INTEGER | non |  |  |
| `quart_parfaite_brut` | TEXT | non |  |  |
| `quart_parfaite_rf` | INTEGER | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `bois`

Bois pour bâton magique (14, un par magie) : onglet Bâton magique › MATERIAUX NECESSAIRE PAR MAGIE (Bois : Matière, Description, Prix).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `magie_id` | TEXT | oui | → magie.id, unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `ingredient_alchimie`

Ingrédients d'alchimie (Google Doc « Alchimie » › Liste d'ingrédient : 5 tables Solvant, Essence, Amplificateur, Catalyseur, Stabilisateur).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `categorie` | TEXT | oui |  |  |
| `type_brut` | TEXT | oui |  | colonne « Type » : « Fruit (majeur) », « Minerai/Organe (majeur) », « Liquide » |
| `type` | TEXT | oui |  | sans la mention « (majeur) » : « Fruit » |
| `majeur` | INTEGER | oui |  | 1 si « (majeur) » : « utiles pour faire les potions ultimes » (sixième emplacement « Amplificateur majeur ») |
| `affinite_brut` | TEXT | oui |  | colonne « Affinité » : « Santé + Chakra » |
| `affinite_id` | TEXT | oui | → affinite.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `potion`

Potions (une ligne par palier : « Petite fiole rouge », « Grande huile givrante »…). Le prix est dans ressource.prix_*.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `famille` | TEXT | oui |  | famille de la recette (solvant : Fiole, Huile, Philtre, Remède ; sans solvant : alchimie primitive) |
| `rang` | INTEGER | oui |  | rang du palier dans la page (1 = premier tableau Prix/Niveau/Effet) |
| `niveau_id` | TEXT | oui | → niveau_alchimie.id | colonne « Niveau » |
| `effet` | TEXT | oui |  | colonne « Effet », lignes séparées par des retours à la ligne |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `potion_etat`

État d'altération cité par l'effet d'une potion : « Inflige gel 1 » (huiles) ou « Réduit d'un cran la brûlure » (remèdes).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK 1, → ressource.id |  |
| `etat_id` | TEXT | oui | PK 2, → etat.id |  |
| `action` | TEXT | oui | PK 3 | « Inflige … », « Réduit … cran(s) », « Soigne totalement … » |
| `valeur` | INTEGER | non |  | niveau infligé (« gel 1 » -> 1) ou nombre de crans retirés (« deux crans » -> 2) ; NULL pour « Soigne totalement » |
| `texte` | TEXT | oui |  | fragment de l'effet analysé |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `kit_alchimie`

Kits d'alchimie du Doc (table « Kit d'alchimie | Prix | Permet … »). Les kits de l'onglet « Équipement inventaire » (MATOS FABRICATION) ont d'autres noms et d'autres prix : ce sont d'autres ressources (genre 'materiel').

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | oui | PK, → ressource.id |  |
| `niveau_id` | TEXT | oui | → niveau_alchimie.id | niveau cité par « Permet … » : « Faire les recettes avancées ou moins » -> avance |
| `permet_brut` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `fiole_verre`

Types de fioles de verre du Doc (table « Type de fiole en verre | Niveau | Nombre d'ingrédient »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/alchimie#fiole-verre:petite-fiole' |
| `nom` | TEXT | oui | unique | « Petite fiole » |
| `niveau_brut` | TEXT | oui |  | « Novice », « Expert, Maître » |
| `nb_ingredients_brut` | TEXT | oui |  | « 2 ingrédients », « 5 ou plus ingrédients » |
| `nb_ingredients_min` | INTEGER | oui |  | premier nombre du texte |
| `nb_ingredients_ou_plus` | INTEGER | oui |  | 1 si « ou plus » |
| `ordre` | INTEGER | oui | unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `recette`

Une recette = une façon d'obtenir un ou plusieurs produits. genre 'materiau' : « Fabrication (Pour obtenir une matière) » de l'onglet Armures (la table de l'onglet Bouclier est identique mot pour mot : pas de seconde ligne) ; genre 'alchimie' : table « Recette » d'une page de potions (une ligne de la table = une variante) ; `famille` obligatoire ; genre 'baton_magique' : « 1 Gemme <qualité> + 1 bois [magie] » d'un niveau de bâton (onglet Bâton magique).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | alchimie : '<page>#recette:<slug nom>:<variante>' ; matériaux : '…#recette:materiau:<matière>' ; bâtons : '…#recette:<magie>:<niveau>' |
| `genre` | TEXT | oui |  |  |
| `famille` | TEXT | non |  |  |
| `nom` | TEXT | oui |  | libellé de la source (titre de page ou de section, matière, « Sang › Niveau 1 ») |
| `variante` | INTEGER | non |  | alchimie : numéro de la ligne de la table « Recette » (1 s'il n'y en a qu'une) ; NULL pour les autres genres |
| `page_id` | TEXT | oui | → page.id |  |
| `texte_brut` | TEXT | non |  | recette telle qu'écrite quand c'est une phrase (« 10 minerais de fer + 1 charbon + Bas Fourneau ») |
| `produit_brut` | TEXT | non |  | produit tel qu'écrit quand il n'a pas de ligne ressource (« Bâton élémentaire vierge ») |
| `test_brut` | TEXT | non |  | test d'artisanat écrit pour CETTE recette : « Test de Volonté + Intelligence » ; NULL si la source le rattache au métier |
| `test_carac_1_id` | TEXT | non | → caracteristique.id |  |
| `test_carac_2_id` | TEXT | non | → caracteristique.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `recette_produit`

Produits d'une recette (une page de potions : tous les paliers Petite … Ultime ; un matériau : lui-même).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `recette_id` | TEXT | oui | PK 1, → recette.id |  |
| `ressource_id` | TEXT | oui | PK 2, → ressource.id |  |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `recette_ingredient`

Éléments d'une recette. `rang` = position (emplacement d'alchimie, ou terme séparé par « + » d'une phrase) ; `option` = alternative (« A ou B » : une ligne par option, comme classe_objet_depart). Deux formes, exclusives : * ressource_id : un élément nommé (« 10 minerais de fer », « Herbe rouge (Ingrédient précis) », « 1 gemme commune ») ; * affinite_id : exigence d'un emplacement d'alchimie (« Essence : Santé ») : n'importe quel ingrédient de la catégorie et de l'affinité (vue v_ingredient_possible). Alchimie : « Chaque ingrédient indiqué dans une recette représente deux unités de cet ingrédient » (règle du Doc, non recopiée dans chaque ligne : quantite NULL).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `recette_id` | TEXT | oui | PK 1, → recette.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `option` | INTEGER | oui | PK 3 |  |
| `texte` | TEXT | oui |  | fragment exact de la source |
| `role` | TEXT | non |  |  |
| `emplacement` | TEXT | non |  | en-tête de colonne tel qu'écrit (« Amplificateur 1 », « Amplificateur majeur ») ; alchimie seulement |
| `quantite` | INTEGER | non |  | « 10 » de « 10 minerais de fer » ; NULL si aucun nombre n'est écrit (« Bas Fourneau ») |
| `unite` | TEXT | non |  | « 2L acide » -> 2, 'L' |
| `qualite` | TEXT | non |  | gemmes des bâtons |
| `ressource_id` | TEXT | non | → ressource.id |  |
| `affinite_id` | TEXT | non | → affinite.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `baton_magique`

Bâtons magiques (onglet Bâton magique › « Bonus passifs » : 14 magies x 3 niveaux). La source ne leur donne pas de nom propre.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/baton-magique#baton:feu:2' |
| `magie_id` | TEXT | oui | → magie.id |  |
| `niveau` | INTEGER | oui |  |  |
| `bonus_brut` | TEXT | oui |  | « Dégâts sort +6 », « ampli am = +2 am donné⏎protection = +5 dégâts bloqué » |
| `recette_id` | TEXT | oui | → recette.id, unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `metier`

Métiers (Google Doc « MÉTIER » : une page par métier, 72). `bonus_brut`, `artisanat_brut`, `equipement_brut`, `avantage_brut` sont les quatre champs de la page, tels qu'écrits (liens [[…]] et échappements Markdown retirés).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK, → page.id | id de la page : 'metiers/forgeron' |
| `nom` | TEXT | oui | unique | titre de la page : « Éleveur (choix animal) » |
| `nom_cle` | TEXT | oui | unique | normalize(nom) |
| `description` | TEXT | oui |  | « Description du métier » |
| `bonus_brut` | TEXT | oui |  | « Bonus » : « +3% Arme lourde OU Arme légère » |
| `artisanat_brut` | TEXT | oui |  | « Artisanat possible » entier : « Peut faire des armes métalliques [FORCE  + VOLONTÉ] » |
| `peut_fabriquer` | INTEGER | oui |  | 0 si « Artisanat possible : Rien » |
| `artisanat_texte` | TEXT | non |  | partie avant le crochet : « Peut faire des armes métalliques » ; NULL si « Rien » |
| `test_brut` | TEXT | non |  | contenu du crochet : « FORCE  + VOLONTÉ », « PERCEPTION x2 », « Artisanat SOCIAL + INTELLIGENCE » ; NULL si aucun |
| `test_carac_1_id` | TEXT | non | → caracteristique.id | renseignées seulement pour la forme exacte « CARAC + CARAC » |
| `test_carac_2_id` | TEXT | non | → caracteristique.id |  |
| `equipement_brut` | TEXT | oui |  | « Équipement supplémentaire possible » : « Kit de réparation d'arme, Maillet en fer » ; « Rien » |
| `avantage_brut` | TEXT | non |  | « Avantage possible » ; NULL si vide (Artisan) |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `metier_bonus`

Bonus d'un métier : le champ « Bonus » découpé sur les virgules suivies d'un signe (« +3% Esquive, +3% Réflexe » -> 2 rangs ; « Diplomatie OU Intimidation » -> 2 options du même rang). `valeur`/`unite`/`cible` ne sont renseignés que pour la forme « +N% Cible » ou « +N Cible » ; tout autre fragment garde son texte et valeur NULL. `cible_cle` = normalize(cible) : se joint aux compétences et attributs du domaine fiche par nom, sans clé étrangère entre domaines.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `metier_id` | TEXT | oui | PK 1, → metier.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `option` | INTEGER | oui | PK 3 |  |
| `texte` | TEXT | oui |  | fragment exact |
| `valeur` | INTEGER | non |  | 3 de « +3% Esquive » |
| `unite` | TEXT | non |  | '%' si le nombre est suivi de « % » ; NULL sinon (« +1 INI ») |
| `cible` | TEXT | non |  | « Esquive », « Arme lourde », « INI » |
| `cible_cle` | TEXT | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `metier_recette_famille`

Familles de recettes qu'un métier dit pouvoir fabriquer : le champ « Artisanat possible » cite « fioles », « philtres », « remèdes », « huiles », « alchimie primitive ». Seuls ces cinq mots désignent une famille de recettes de la base ; les autres artisanats (« armes métalliques », « lingots »…) restent dans metier.artisanat_texte.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `metier_id` | TEXT | oui | PK 1, → metier.id |  |
| `famille` | TEXT | oui | PK 2 |  |
| `mot_source` | TEXT | oui |  | mot repéré dans le champ : « fioles », « alchimie primitive » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `arme`

Une ligne par arme listée (161 : 147 + 14 armes de monstres). Les colonnes typées sont extraites des clauses du texte d'effet (séparées par des virgules ou des retours à la ligne) ; une clause qui n'a pas exactement la forme attendue n'est pas interprétée (« +4 dégâts estoc » n'est PAS un bonus de dégâts : il ne vaut que pour l'estoc). Effet à plusieurs modes (« Ouvert = … » / « Fermé = … », « Une main = … » / « Deux main = … ») : une valeur n'est retenue que si TOUS les modes la donnent (Éventail : NULL, écart consigné). L'effet complet reste dans `effet`.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/armes#arme:<famille>:<slug du nom>' |
| `famille_id` | TEXT | oui | → arme_famille.id | bandeau sous lequel la ligne est écrite |
| `type_id` | TEXT | oui | → arme_type.id | 1re ligne de la cellule Catégorie (« Épée ») |
| `nom` | TEXT | oui |  | cellule Nom sans la mention de mains : « Flamberge » |
| `nom_cle` | TEXT | oui |  |  |
| `nom_brut` | TEXT | oui |  | cellule Nom entière : « Flamberge⏎(deux mains) » |
| `mains` | TEXT | non |  | « (une main) », « (deux mains) », « (une ou deux mains) » ; NULL si non écrit |
| `categorie_brut` | TEXT | oui |  | cellule Catégorie entière : « Épée⏎Arme Lourde » |
| `competence_brut` | TEXT | non |  | 2e ligne de la Catégorie : « Arme Lourde », « Arme Lourde/Légère », « Arc », « Arc / Arme Légère » |
| `cout_brut` | TEXT | non |  | colonne « Coût » / « Coût en plus/moins » : « 10 Ro » ; NULL pour les armes de monstres |
| `cout_ro` | INTEGER | non |  | N de « N Ro » |
| `effet` | TEXT | non |  | colonne « Effet » entière ; NULL pour les armes de monstres |
| `description` | TEXT | non |  | colonne « Description » |
| `de` | TEXT | non |  | dé de l'arme : « D8 au lieu du D10 » / « tape dans le D6 » de l'effet, sinon dé du type ; NULL pour le Pugilat (selon la Force) |
| `de_faces` | INTEGER | non |  |  |
| `de_source` | TEXT | non |  |  |
| `portee_min` | INTEGER | non |  | portée ÉCRITE dans l'effet (« 1 - 7 portée », « portée 1-2 », « la portée est de 2-3 ») ; NULL = non écrite : voir v_arme |
| `portee_max` | INTEGER | non |  |  |
| `bonus_degats` | INTEGER | non |  | clause « +N dégâts » / « -N dégâts » ; NULL si absente (la fiche compte 0) |
| `ignore_ap` | INTEGER | non |  | clause « ignore N AP » (« ignore N PA » dans la source) ; NULL si absente ou conditionnelle |
| `recharge` | TEXT | non |  |  |
| `solidite_fixee` | INTEGER | non |  | « 1 seul cran / point de solidité » -> 1 (les armes ont 2 crans de base, règle générale de l'onglet) |
| `solidite_delta` | INTEGER | non |  | « -1 cran de solidité » / « +1 cran de solidité » |
| `provenance_mot` | TEXT | non |  | « Origine Majin » / « Facture Fenrir » |
| `provenance` | TEXT | non |  | « Majin », « Temple du Sang », « inconnue » |
| `depart_possible` | INTEGER | oui |  | 1 : nom sur fond bleu dans la source (« Les armes en bleu sont les armes possible en arme de départ ») |
| `ordre` | INTEGER | oui |  | rang dans le bandeau |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `arme_degats`

Types de dégâts de l'arme : première clause « Dégâts taille/estoc » (ou « dégâts de frappe » des bombes) -> 1 ligne par type. Les armes dont la clause n'a pas la forme attendue ou dont les modes divergent (Éventail : taille ouvert, estoc fermé) n'ont pas de ligne.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `arme_id` | TEXT | oui | PK 1, → arme.id |  |
| `type_degats` | TEXT | oui | PK 2 |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `arme_prerequis`

Minimums de caractéristique cités par l'effet : « 4 de Force minimum », « 3 de Force et Agilité minimum », « 5 d'Agilité obligatoire ». Pas de ligne = aucun minimum écrit (la fiche compte 1). Pour 5 armes la fiche lit 1 en Agilité alors que le texte dit 2 à 5 : la valeur du texte est conservée, l'écart est dans ecart_source.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `arme_id` | TEXT | oui | PK 1, → arme.id |  |
| `caracteristique_id` | TEXT | oui | PK 2, → caracteristique.id |  |
| `minimum` | INTEGER | oui |  |  |
| `exigence` | TEXT | non |  | mot écrit après la caractéristique ; NULL si aucun |
| `texte` | TEXT | oui |  | clause exacte |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `arme_elementaire`

Armes élémentaires (onglet Pièces élémentaires : 11 types d'armes x 14 éléments). La cellule contient 4 lignes : nom / « +8 Dégâts » / « Élément X » / capacité « Nom (mode) : texte ».

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/pieces-elementaires#arme-elementaire:epee:sang' |
| `type_id` | TEXT | oui | → arme_type.id |  |
| `magie_id` | TEXT | oui | → magie.id | élément (en-tête de colonne SANG, ARCANE, … LUMIERE) |
| `colonne_brut` | TEXT | oui |  | en-tête de colonne tel qu'écrit : « LUMIERE », « NÉCROMANCIE » |
| `nom` | TEXT | oui |  | « Épée de Sang » |
| `bonus_degats` | INTEGER | oui |  | 8 de « +8 Dégâts » |
| `element_brut` | TEXT | oui |  | « Élément Sang », « Élément Nécomancie » (coquille conservée) |
| `capacite_nom` | TEXT | non |  | « Sang explosif » |
| `capacite_mode` | TEXT | non |  | mot entre parenthèses |
| `capacite_texte` | TEXT | non |  |  |
| `capacite_brut` | TEXT | oui |  | 4e ligne entière |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `armure_emplacement`

Emplacements d'armure = onglet Armures › FABRICATION (« Armure | Coût ») : Armure Complète, Casque, Torse, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droit (coquille de la source), Bouclier. La source ne donne pas d'AP/AM par emplacement : une armure a UNE valeur (la fiche la recopie sur les six pièces) ; seul le coût de fabrication varie par pièce.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'armure-complete', 'casque', 'torse', 'bras-gauche', 'bras-droit', 'jambe-gauche', 'jambe-droit', 'bouclier' |
| `nom` | TEXT | oui | unique | tel qu'écrit : « Jambe Droit » |
| `cout_brut` | TEXT | oui |  | « 150 RF / 1,5 RO », « 250 RF / Classe » |
| `cout_rf` | INTEGER | non |  | NULL pour « 250 RF / Classe » (dépend de la classe) |
| `ordre` | INTEGER | oui | unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `armure`

Armures : 231 combinaisons de deux matières (grille matière x matière de l'onglet Armures) + 11 armures particulières (vêtements, cottes de mailles, armure montagne, armures de familiers).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/armures#armure:peau-peau', '…#armure:cuir-peau', '…#armure:tenue-du-flagelleur' |
| `sorte` | TEXT | oui |  |  |
| `nom` | TEXT | oui |  | « Armure Cuir/Peau », « Cotte de maille (Fer) » |
| `nom_cle` | TEXT | oui |  |  |
| `materiau_ligne_id` | TEXT | non | → ressource.id | combinaison : matière en tête de ligne de la grille |
| `materiau_colonne_id` | TEXT | non | → ressource.id | combinaison : matière en tête de colonne |
| `type` | TEXT | oui |  |  |
| `prix` | REAL | non |  | « Prix : 2 050 » -> 2050.0 ; « ???? » -> NULL ; unité non écrite |
| `prix_brut` | TEXT | non |  |  |
| `stats_brut` | TEXT | oui |  | « +10AP +14AM », « Aucune » |
| `ap` | INTEGER | non |  | N de « +NAP » ; NULL si AP n'est pas écrit (« Aucune » aussi) : la fiche compte 0 |
| `am` | INTEGER | non |  |  |
| `solidite` | INTEGER | oui |  |  |
| `solidite_uni` | INTEGER | non |  | 1 pour « Solidité uni : N » (« Si un cran de solidité est perdu, c'est TOUTE l'armure qui est abîmée ») ; NULL pour « Solidité : N » |
| `resistance_brut` | TEXT | non |  | « x2 Frappe », « Taille » ; NULL pour les armures particulières |
| `faiblesse_brut` | TEXT | non |  |  |
| `effet` | TEXT | non |  | « Effet : … » des armures particulières (« Aucun », « Rien » conservés) |
| `ordre` | INTEGER | oui | unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `armure_degats`

Résistances et faiblesses d'une armure : « Résistance : x2 Frappe », « Faiblesse : Estoc/Frappe » -> une ligne par type de dégâts. Le sens de « x2 » n'est pas défini par la source : le multiplicateur est conservé tel quel.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `armure_id` | TEXT | oui | PK 1, → armure.id |  |
| `sens` | TEXT | oui | PK 2 | même vocabulaire que magie_resistance |
| `sens_brut` | TEXT | oui |  | « Résistance » / « Faiblesse » tel qu'écrit dans la fiche d'armure |
| `type_degats` | TEXT | oui | PK 3 |  |
| `multiplicateur` | INTEGER | non |  | 2 de « x2 » ; NULL si non écrit |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `armure_elementaire`

Armures élémentaires (onglet Pièces élémentaires : 4 catégories x 14 éléments = 56) : vêtement, armure légère, intermédiaire, lourde.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/pieces-elementaires#armure-elementaire:leger:sang' |
| `categorie` | TEXT | oui |  |  |
| `magie_id` | TEXT | oui | → magie.id |  |
| `colonne_brut` | TEXT | oui |  |  |
| `nom` | TEXT | oui |  | « Garde coeur », « Tissu du saigneur » |
| `ap` | INTEGER | non |  | « 7.0 » -> 7 |
| `am` | INTEGER | non |  |  |
| `effets_brut` | TEXT | oui |  | cellule « Effet(s) » entière (lignes « - … ») |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `armure_elementaire_effet`

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `armure_elementaire_id` | TEXT | oui | PK 1, → armure_elementaire.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `texte` | TEXT | oui |  | une ligne « - … » sans le tiret |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `bouclier_classe`

Classes de boucliers (onglet Bouclier › « Classes de boucliers » : Bocle, Targe, Bouclier Rond, Écu, Pavoi).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'bocle', 'targe', 'bouclier-rond', 'ecu', 'pavoi' |
| `nom` | TEXT | oui | unique |  |
| `classe` | INTEGER | oui | unique | « Catégorie : Classe 4 » : un bouclier de classe 4 demande 4 matériaux |
| `prix` | REAL | oui |  | « Prix : 2,5 » (unité non écrite ; « Coût (RO) : 2,5 / Classe » dans FABRICATION) |
| `prix_brut` | TEXT | oui |  |  |
| `categorie_brut` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `bouclier_poids`

Poids de boucliers (onglet Bouclier, liste « Léger / Moyen / Lourd / Très lourd » sous la mention « A refaire » : « il est necessaire d'avoir le score de Force ou plus »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'leger', 'moyen', 'lourd', 'tres-lourd' |
| `nom` | TEXT | oui | unique |  |
| `force_min` | INTEGER | oui |  |  |
| `force_brut` | TEXT | oui |  | « 1 de Force minimum » |
| `ordre` | INTEGER | oui | unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `bouclier`

Boucliers préfabriqués (100 : 5 classes x 20 matériaux). La source ne relie pas les poids aux classes : aucun lien n'est déduit.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/bouclier#bouclier:ecu:fer-noir' |
| `classe_id` | TEXT | oui | → bouclier_classe.id |  |
| `materiau_id` | TEXT | oui | → ressource.id |  |
| `nom` | TEXT | oui |  | « Bocle Corne » (sic : la matière s'écrit Corne/Os ailleurs) |
| `prix` | REAL | non |  | NULL si « Prix : » est vide (Bouclier Rond Argent) |
| `prix_brut` | TEXT | non |  |  |
| `defense_brut` | TEXT | oui |  | « +20AP +25AM » |
| `ap` | INTEGER | non |  |  |
| `am` | INTEGER | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `amelioration_equipement`

Améliorations (+1 à +10) : armes (Armes), armures (Armures), boucliers (Bouclier), armes et armures élémentaires (Pièces élémentaires). Les coûts sont écrits « 20 RO », « 1 Matériel + 50 RO », « 100 + 1 Matériau », « 100.0 », « 2 gemmes communes », « 1 pièce élémentaire », les effets « +2 dégâts », « +10 dégâts, +1 cran de solidité », « +4 AP/AM », « +2 AP, +1 cran de solidité ».

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | '<page>#amelioration:<cible>:<niveau>' |
| `cible` | TEXT | oui |  |  |
| `niveau` | INTEGER | oui |  |  |
| `cout_brut` | TEXT | oui |  |  |
| `cout_ro` | INTEGER | non |  | montant en RO écrit dans le coût ; NULL si le coût n'en contient pas |
| `cout_materiaux` | INTEGER | non |  | nombre de « Matériel(s) » / « Matériau(x) » |
| `cout_gemmes` | INTEGER | non |  |  |
| `cout_gemmes_qualite` | TEXT | non |  |  |
| `cout_pieces_elementaires` | INTEGER | non |  |  |
| `effet_brut` | TEXT | oui |  |  |
| `bonus_degats` | INTEGER | non |  |  |
| `bonus_ap` | INTEGER | non |  |  |
| `bonus_am` | INTEGER | non |  |  |
| `bonus_cran` | INTEGER | non |  | crans de solidité gagnés (« +2 cran de solidité » -> 2) |
| `page_id` | TEXT | oui | → page.id |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `amelioration_total`

Ligne « TOTAL » de chaque tableau d'améliorations, telle qu'écrite (« 5 matériaux + 1520 RO ») ; celui des armures élémentaires est vide dans la source.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `cible` | TEXT | oui | PK |  |
| `total_brut` | TEXT | non |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `accessoire_emplacement`

Étape 1 de la création (1d4) : emplacement de l'accessoire.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'tete', 'collier', 'anneau', 'bracelet' |
| `nom` | TEXT | oui | unique | « Tête », « Collier », « Anneau », « Bracelet » |
| `jet` | INTEGER | oui | unique | résultat du 1d4 |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `accessoire_propriete`

Étape 2 (1d100) : propriété de l'accessoire. 8 plages : 1-5 Caractéristique, 6-20 Compétence, 21-35 Attributs, 36-50 Attaque, 51-66 Défense, 67-80 Jet de dé, 81-95 Autre, 96-100 Malédiction.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'caracteristique', 'competence', 'attributs', 'attaque', 'defense', 'jet-de-de', 'autre', 'malediction' |
| `nom` | TEXT | oui | unique | « Caractéristique », « Jet de dé » |
| `jet_min` | INTEGER | oui |  |  |
| `jet_max` | INTEGER | oui |  |  |
| `ordre` | INTEGER | oui | unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `accessoire_effet`

Étape 3 : effets possibles, par propriété (« SI CARACTERISTIQUE / COMPETENCE / ATTRIBUTS / ATTAQUE / DÉFENSE / JET DE DÉS / AUTRE »). Caractéristique : 6 lignes (1d6). Compétence : 6 caractéristiques x 4 niveaux (1d6 puis 1d20 « bonus d'acquis » 1-5 %, 6-10 %…). Autres : 20 lignes (1d20), dont la ligne « MALÉDICTION » (jet 10) et quelques lignes vides.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/accessoires#effet:attributs:5', '…#effet:caracteristique:force', '…#effet:competence:force:2' |
| `propriete_id` | TEXT | oui | → accessoire_propriete.id |  |
| `jet` | INTEGER | oui |  | résultat du dé de la table (1d6 ou 1d20) |
| `libelle` | TEXT | non |  | cellule « Effet » : « +25 Santé », « Force », « Compétence F » ; NULL si la ligne est vide dans la source |
| `caracteristique_id` | TEXT | non | → caracteristique.id | propriétés Caractéristique et Compétence : caractéristique tirée au 1d6 |
| `niveau` | INTEGER | non |  | « Niveau 4 » -> 4 ; NULL si « Niveau ? » ou vide |
| `niveau_brut` | TEXT | non |  |  |
| `bonus_min` | INTEGER | non |  | compétence : « 6% -10% » -> 6 |
| `bonus_max` | INTEGER | non |  | compétence : -> 10 |
| `gemmes_brut` | TEXT | non |  | « Grenat + Malachite », « Onix + Grenat/Malachite » ; NULL si vide |
| `prix_brut` | TEXT | non |  | « 189 Ro », « A calculer », « ? » |
| `prix_ro` | INTEGER | non |  | N de « N Ro » ; NULL pour « A calculer » / « ? » |
| `malediction` | INTEGER | oui |  | 1 pour la ligne « MALÉDICTION » |
| `bonus_valeur` | INTEGER | non |  | Attributs : N de « +N Santé / Barrière / Chakra / Initiative / Vitesse » |
| `bonus_cible` | TEXT | non |  |  |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `accessoire_effet_gemme`

Gemmes d'un effet d'accessoire (« Grenat + Malachite » : 2 rangs ; « Grenat/Malachite » ou « Turquoise ou + Perle ou … » : options d'un même rang). `nom_source` = écriture de la source ; les coquilles (Gyspe, Emmeraude, Diament rose, Onyx) sont rapprochées du nom de gemme (liste fermée du chargeur, chaque rapprochement est dans ecart_source).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `effet_id` | TEXT | oui | PK 1, → accessoire_effet.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `option` | INTEGER | oui | PK 3 |  |
| `gemme_id` | TEXT | oui | → ressource.id |  |
| `nom_source` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `accessoire_monture`

Montures d'accessoires (onglet Accessoires › Monture : 5 niveaux ; « Un lingot permet de faire 2 montures d'anneau, 2 de collier… »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `niveau` | INTEGER | oui | PK |  |
| `materiau_id` | TEXT | oui | → ressource.id | « Fer », « Argent », « Bronze », « Or », « Mythril » |
| `prix_brut` | TEXT | oui |  | « 5 Ro » |
| `prix_ro` | INTEGER | non |  |  |
| `effet_brut` | TEXT | oui |  | « Petit effet » … « Effet suprème » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `familier`

Familiers (onglet Familiers : petits familiers, gros familiers, montures).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/familiers#familier:petit:chat' |
| `categorie` | TEXT | oui |  |  |
| `nom` | TEXT | oui |  |  |
| `nom_cle` | TEXT | oui |  |  |
| `effet_brut` | TEXT | non |  | colonne « Effet » (petits familiers seulement) entière |
| `description` | TEXT | oui |  |  |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `familier_effet`

Effets d'un petit familier : une ligne « - … » de la cellule « Effet » = une ligne.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `familier_id` | TEXT | oui | PK 1, → familier.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `texte` | TEXT | oui |  | sans le tiret : « +5% Vie en nature » |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `batiment`

Bâtiments standard (onglet Maison › BATIMENT STANDARD). Les matériaux de construction (Bois, Pierre, Brique) sont des ressources (genre 'materiau_construction').

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/maison#batiment:manoir' |
| `nom` | TEXT | oui | unique |  |
| `surface_brut` | TEXT | oui |  | « 600 mètres² » |
| `surface_m2` | INTEGER | non |  |  |
| `materiaux_brut` | TEXT | oui |  | « 80 000 kg » |
| `materiaux_kg` | INTEGER | non |  |  |
| `prix_brut` | TEXT | oui |  | « 40 000 - 50 000 Ro » |
| `prix_min_ro` | INTEGER | non |  |  |
| `prix_max_ro` | INTEGER | non |  |  |
| `description` | TEXT | oui |  |  |
| `ordre` | INTEGER | oui | unique |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `machine_guerre`

Machines de guerre et de siège (onglet « Machine de GuerreSiège » : ATTAQUE AU SOL, ATTAQUE AU MUR, DEFENSE AU SOL).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/machine-de-guerresiege#machine:attaque-au-sol:belier' |
| `categorie` | TEXT | oui |  |  |
| `nom` | TEXT | oui |  |  |
| `description` | TEXT | oui |  |  |
| `effet` | TEXT | oui |  |  |
| `degats` | INTEGER | non |  | N de « N dégâts » / « N points de dégâts » quand l'effet n'en cite qu'un seul |
| `points_de_vie` | INTEGER | non |  | N de « Possède N points de vie » |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `maladie`

Maladies : onglet « Maladie » (une ligne par maladie) et gabarit « Maladie V2 » (une seule maladie, Fièvre des marais, avec des champs en plus).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | 'ressources/maladie#maladie:botulisme-bleu', 'ressources/fievre-des-marais#maladie:fievre-des-marais' |
| `version` | TEXT | oui |  |  |
| `nom` | TEXT | oui |  |  |
| `nom_cle` | TEXT | oui |  |  |
| `effets` | TEXT | non |  | champ « Effets » entier (retours à la ligne conservés) |
| `nature` | TEXT | non |  |  |
| `lieu_contraction` | TEXT | non |  | « Où le contracter ? » |
| `incubation_brut` | TEXT | non |  | « 24h à 72h », « 72 heures » |
| `incubation_h_min` | INTEGER | non |  | heures, seulement pour « Nh » / « N heures » / « Nh à Mh » |
| `incubation_h_max` | INTEGER | non |  |  |
| `soin_methode_brut` | TEXT | non |  | champ « Méthode de soin » entier |
| `temps_soin_brut` | TEXT | non |  | champ « Temps de soin » entier |
| `conseil` | TEXT | non |  | gabarit V2 : champ « Conseil » |
| `description` | TEXT | non |  | gabarit V2 : cellule A5 entière (description, symptômes, puis les trois lignes « Race … : ») |
| `race_plus_sensible` | TEXT | non |  | gabarit V2 : ligne « Race plus sensible : X » de A5 (X tel qu'écrit : « Aucune ») ; NULL hors V2 |
| `race_resistante` | TEXT | non |  |  |
| `race_immunisee` | TEXT | non |  |  |
| `ordre` | INTEGER | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |
| `remarque` | TEXT | non |  | remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne |

### `maladie_methode`

Listes du champ « Méthode de contraction » et « Méthode de soin » (lignes « - … » ou texte unique).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `maladie_id` | TEXT | oui | PK 1, → maladie.id |  |
| `sorte` | TEXT | oui | PK 2 |  |
| `rang` | INTEGER | oui | PK 3 |  |
| `texte` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

## 10. TRANSVERSAL : notes de cellule et écarts entre sources

### `note_cellule`

Notes et commentaires de cellule du classeur (lus dans le .xlsx : le dump JSON les porte dans `note` et `threads`) rattachés à l'entité qu'ils commentent. nature : 'note' = note héritée (xl/comments) ; 'commentaire' / 'commentaire_resolu' = fil de commentaires (non résolu / résolu) ; 'reponse' = réponse dans un fil (`repond_a` = rang du commentaire qui ouvre le fil, dans la même entité) ; 'evenement' = « Marquée comme fermée » / « Rouverte » (trace du fil, pas du contenu) ; NULL = la source ne le dit pas. `rang` = ordre dans l'entité (notes d'abord, puis fils, une réponse suit son commentaire) ; `champ` = colonne de la source qui porte la note (sort : 'effets', 'cout'…) ; `cellule` = adresse A1 de la cellule commentée quand elle est connue. Les noms d'auteurs et les dates ne sont pas lus. entite_table / entite_id : comme page_entite, sans clé étrangère (db:check).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `entite_table` | TEXT | oui | PK 1, → note_cellule.entite_table |  |
| `entite_id` | TEXT | oui | PK 2, → note_cellule.entite_id |  |
| `rang` | INTEGER | oui | PK 3 |  |
| `champ` | TEXT | non |  |  |
| `cellule` | TEXT | non |  |  |
| `nature` | TEXT | non |  |  |
| `repond_a` | INTEGER | non | → note_cellule.rang | rang du commentaire parent (nature = 'reponse' / 'evenement') |
| `texte` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  | « Magie Maverick V8 › Sang › BJ13 » |

### `ecart_source`

Écarts constatés entre deux sources, ou anomalies d'une source (coquille, prix incohérent, forme non reconnue). AUCUNE correction n'est appliquée : la valeur retenue reste dans la colonne typée de l'entité, l'autre est ici avec sa source. Calculés par l'importeur, jamais saisis. source_a = la source dont la valeur est dans la table typée ; source_b = l'autre source, NULL pour une anomalie interne à source_a. `id` est la clé naturelle écrite en clair (CHECK) : entite_table:entite_id:champ:nature:source_a[:source_b].

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `entite_table` | TEXT | oui |  |  |
| `entite_id` | TEXT | oui |  |  |
| `champ` | TEXT | oui |  | colonne ou notion concernée |
| `nature` | TEXT | oui |  |  |
| `source_a` | TEXT | oui |  | 'fiche', 'guide', 'v8', 'modes', 'statistiques', 'ressources_craft'… |
| `valeur_a` | TEXT | non |  |  |
| `source_b` | TEXT | non |  |  |
| `valeur_b` | TEXT | non |  |  |
| `detail` | TEXT | oui |  |  |
| `origine` | TEXT | oui | → famille.id |  |
| `source_ref` | TEXT | oui |  |  |

### `correction`

Corrections de coquilles et de fautes d'orthographe : TRACE MIROIR du registre versionné `tools/sheets/corrections.json` (décision du propriétaire : le registre est la source, il est appliqué au dump AVANT les extracteurs par `tools/sheets/corriger-dump.py` ; les colonnes typées, les *_brut et les index plein texte portent donc déjà le texte corrigé). La table n'est jamais saisie à la main : l'importeur de la famille qui lit le dump la remplit (`Famille.corrections(registre)`, `origine` = cette famille) et elle est effacée / recréée avec elle. Elle permet de répondre « qu'a-t-on corrigé, où, pourquoi, et quel était le texte d'origine ? » sans rouvrir le classeur. Colonnes alignées sur le registre. dump = section du registre (classes-v7, magie-v8, les-races, les-races-annexes, fiche-auto-v15, ressources-craft, invocation, mode-hyper, races-index) champ = 'v' (valeur de la cellule) ou 'note' (note de la cellule) ; occurrences = nombre de remplacements attendus dans la cellule. Garde-fous (db:check) : `avant` ne figure plus dans une table typée dont la `source_ref` couvre la cellule ; les chiffres, dés et signes de `avant` et `apres` sont identiques (une correction n'est jamais une règle).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `dump` | TEXT | oui | PK 1 |  |
| `classeur` | TEXT | oui |  | libellé du classeur : « Classe Maverick V7 » |
| `onglet` | TEXT | oui | PK 2 |  |
| `cellule` | TEXT | oui | PK 3 |  |
| `champ` | TEXT | oui | PK 4 |  |
| `avant` | TEXT | oui | PK 5 | extrait EXACT de la source |
| `apres` | TEXT | oui |  |  |
| `occurrences` | INTEGER | oui |  |  |
| `nature` | TEXT | oui |  |  |
| `note` | TEXT | oui |  | pourquoi (le propriétaire confirme / la bannière dit…) |
| `origine` | TEXT | oui | → famille.id | famille dont l'importeur lit le dump corrigé |
| `source_ref` | TEXT | oui |  | « Classe Maverick V7 › Mercenaire › AC22 » (même forme que les autres source_ref) |

## 11. TABLES DÉRIVÉES (jamais exportées dans data/rows/, recalculées par `npm run db:build`)

### `lien`

*table dérivée : client/scripts/db-derive.mjs*

Chaque occurrence de [[cible|ancre]] du corps (hors blocs ``` et `code`), dans l'ordre du texte.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `page_id` | TEXT | oui | PK 1, → page.id | page qui contient le lien |
| `position` | INTEGER | oui | PK 2 | rang de l'occurrence dans le corps (0 = première) |
| `cible` | TEXT | oui |  | texte avant « \| » (ou tout le contenu), rogné : 'Jet de dés', 'races/elfe' |
| `ancre` | TEXT | oui |  | texte affiché : après « \| », sinon la cible |
| `etat` | TEXT | oui |  |  |
| `cible_page_id` | TEXT | non | → page.id | renseigné seulement si etat = 'resolu' |

### `lien_candidat`

*table dérivée : client/scripts/db-derive.mjs*

Pages candidates d'un lien ambigu (les pages qui portent la même clé).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `page_id` | TEXT | oui | PK 1, → lien.page_id |  |
| `position` | INTEGER | oui | PK 2, → lien.position |  |
| `candidat_page_id` | TEXT | oui | PK 3, → page.id |  |

### `page_fts`

*table de recherche (FTS5)* · *table dérivée : client/scripts/db-derive.mjs*

Recherche plein texte. Accents et casse ignorés ; l'apostrophe sépare deux mots (« l'alchimiste » = « l » + « alchimiste »). Colonnes : titre, alias (écritures séparées par des retours à la ligne), tag (libellés), resume, texte (corps sans Markdown : [[a|b]] -> b, caractères # > * _ ` | retirés — même nettoyage que search-index.json.ts, sans la coupe à 4000). Pondération conseillée (reprend search.mjs : titre 6, alias 5, mots-clés 4, résumé 2, texte 1) : ORDER BY bm25(page_fts, 0, 6, 5, 4, 2, 1) -- le 0 = page_id (colonne non indexée)

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `page_id` | — | non |  |  |
| `titre` | — | non |  |  |
| `alias` | — | non |  |  |
| `tag` | — | non |  |  |
| `resume` | — | non |  |  |
| `texte` | — | non |  |  |

### `entite_fts`

*table de recherche (FTS5)* · *table dérivée : data/derive.sql*

Recherche plein texte de TOUTES les entités typées (sorts, capacités, ethnies, créatures, armes, états…) : une seule table, un seul MATCH. Colonnes : nom, contexte (parent ou rubrique : magie d'un sort, classe d'une capacité, race d'une ethnie…), texte (le reste). Accents et casse ignorés ; l'apostrophe sépare deux mots. Pondération conseillée : ORDER BY bm25(entite_fts, 0, 0, 6, 2, 1).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `entite_table` | — | non |  |  |
| `entite_id` | — | non |  |  |
| `nom` | — | non |  |  |
| `contexte` | — | non |  |  |
| `texte` | — | non |  |  |

## 12. VUES (toujours à jour : rien à recalculer)

### `cle_page`

*vue*

Index de résolution des [[liens]] = buildIndex() de wikilinks.mjs : toute clé normalisée -> pages qui la portent (slug, titre ou alias). Une clé qui mène à plusieurs pages = nom ambigu. Les clés vides sont écartées comme dans le site. Retrouver une page à partir d'un nom saisi : WHERE cle = normalize(saisie) (normalize = text.mjs, côté application).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `cle` | TEXT | non |  |  |
| `page_id` | TEXT | non |  |  |
| `nature` | — | non |  |  |

### `lien_page`

*vue*

Graphe de pages tel que le calcule wiki.ts : paires (depuis, vers) distinctes, liens résolus, sans lien d'une page vers elle-même. liens sortants d'une page P : WHERE depuis_page_id = P ; rétroliens (« Mentionnée par ») : WHERE vers_page_id = P

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `depuis_page_id` | TEXT | non |  |  |
| `vers_page_id` | TEXT | non |  |  |

### `lien_a_creer`

*vue*

« Pages à créer » : [[liens]] sans page (introuvables) ou ambigus. wiki.ts les compte tous les deux comme non résolus.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `page_id` | TEXT | non |  |  |
| `position` | INTEGER | non |  |  |
| `cible` | TEXT | non |  |  |
| `ancre` | TEXT | non |  |  |
| `etat` | TEXT | non |  |  |

### `tag`

*vue*

Dictionnaire des mots-clés, déduit de page_tag. Libellé d'affichage = écriture de la page de plus petit (titre_cle, id) qui porte le mot-clé : une règle fixe, reproductible par n'importe quel importeur ou client.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | non |  |  |
| `libelle` | — | non |  |  |
| `nb_pages` | — | non |  |  |

### `v_magie_incompatible`

*vue*

Relation d'incompatibilité symétrique : (a, b) est présent dans les deux sens dès que l'un des deux cite l'autre.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `a` | TEXT | non |  |  |
| `b` | TEXT | non |  |  |

### `v_sort_bonus_au_nm`

*vue*

Les bonus de maîtrise d'un sort À UN NIVEAU DE MAÎTRISE DONNÉ (nm = 0, 1, 2, 3) : une ligne par (bonus, nm). `applications` = combien de fois le bonus s'applique : par_nm : nm / pas_nm (arrondi vers le bas : « (+1/NM) » vaut 0, 1, 2, 3 fois ; « (+1d/3NM) » vaut 0 puis 1 à 3 NM), à multiplier par increment_brut ; palier : 1 si nm atteint seuil_nm, sinon 0 ; texte : NULL (rien de typé). C'est la lecture littérale de l'écriture « /NM », « /3NM », « 3NM = » : rien d'autre n'est calculé. « Quel est ce sort à N NM ? » : SELECT * FROM v_sort_bonus_au_nm WHERE sort_id = ? AND nm = ? AND applications <> 0.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `sort_id` | TEXT | non |  |  |
| `nm` | — | non |  |  |
| `champ` | TEXT | non |  |  |
| `rang` | INTEGER | non |  |  |
| `nature` | TEXT | non |  |  |
| `texte_brut` | TEXT | non |  |  |
| `contexte` | TEXT | non |  |  |
| `increment_brut` | TEXT | non |  |  |
| `increment_entier` | INTEGER | non |  |  |
| `applications` | — | non |  |  |

### `v_race_carac_borne`

*vue*

Bornes de saisie d'une caractéristique selon la race, telles que la fiche les calcule (BDD!K2:K24) : '>' est strict (« > 2 » = au moins 3), '<' est strict (« < 4 » = au plus 3), '=' fixe la valeur ; le minimum ne descend jamais sous 1 et le maximum ne monte jamais au-dessus de 4 (« minimum de 1 et maximum de 4 de manière générale », guide/fiche-caracteristiques) ; sans restriction : 1 à 4. La vue produit une ligne par (race, caracteristique) : 27 x 6 = 162. Les bornes portent sur la BASE saisie, avant le bonus de la magie innée (règle de la fiche, hors de ce domaine). operateur/valeur sont NULL quand la race n'a pas de restriction.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | non |  |  |
| `caracteristique_id` | TEXT | non |  |  |
| `operateur` | TEXT | non |  |  |
| `valeur` | INTEGER | non |  |  |
| `minimum` | — | non |  |  |
| `maximum` | — | non |  |  |

### `v_race_classe_accessible`

*vue*

Vues « seulement les 1 » : évitent l'erreur classique d'oublier `accessible = 1` (les lignes à 0 existent aussi).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | non |  |  |
| `classe_id` | TEXT | non |  |  |
| `ordre` | INTEGER | non |  |  |

### `v_race_magie_accessible`

*vue*

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `race_id` | TEXT | non |  |  |
| `magie_id` | TEXT | non |  |  |
| `ordre` | INTEGER | non |  |  |

### `v_regard_peuple`

*vue*

Regard d'un peuple sur un autre (décision R12 : la case (ligne A, colonne B) de « Relation entre les races » dit comment A voit B). « Comment les Elfes Noirs Charbon voient-ils les autres ? » : WHERE peuple_id = ? ; « Comment sont-ils vus ? » : WHERE vu_peuple_id = ?. echelle_ordre : 1 = Même peuple, 2 = Alliée … 8 = Ennemie (du plus favorable au plus défavorable).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `peuple_id` | TEXT | non |  |  |
| `vu_peuple_id` | TEXT | non |  |  |
| `echelle_id` | TEXT | non |  |  |
| `echelle_ordre` | INTEGER | non |  |  |

### `v_creature_magie`

*vue*

Magies d'une créature : celles de la marge de son bloc (« Terre + Feu » -> Terre et Feu) ET celle du sort qui invoque son invocation (Terre pour tous les golems, Nécromancie pour les non-morts, Ombre pour les marionettes, dont la marge « EPN » ne nomme aucune magie). Une ligne par (créature, magie) ; dans_marge / par_sort disent d'où vient le lien.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | non |  |  |
| `magie_id` | TEXT | non |  |  |
| `dans_marge` | — | non |  |  |
| `par_sort` | — | non |  |  |

### `v_creature_resistance`

*vue*

Résistances, vulnérabilités, immunités et sensibilités d'une créature, toutes provenances confondues (une ligne par fait) : provenance 'capacite' : écrit dans une capacité de la créature (creature_capacite_resistance) ; source_id = capacite.id provenance 'commune' : écrit dans une capacité commune de son invocation (invocation_resistance) ; source_id = capacité commune provenance 'element' : règle « Élémentaire » des capacités communes (« Chaque créature possède la/les résistances magiques ainsi que la/les vulnérabilités magiques de son élément ») appliquée à CHAQUE magie de la marge du bloc, avec les listes de la table magie_resistance (cible_type 'magie' seulement) ; via_magie_id = la magie d'où vient la ligne. NE FAIT PAS la synthèse de deux magies : pour « Terre + Feu » on a les lignes de Terre ET celles de Feu, éventuellement contradictoires (Terre vulnérable au Feu, Feu résistante au Feu) ; le classeur ne dit pas comment on les combine (design.md §12, points ouverts). Seules les invocations dont les capacités communes nomment « Élémentaire » sont concernées (pas les marionettes). PRIORITÉ : la source n'en donne une que pour les non-morts (« Élémentaire … (sauf capacité lui donnant autre chose) »). Une capacité peut contredire la règle (Golem de verre : « résisantante contre le Feu » alors que la Terre est vulnérable au Feu) : les lignes de provenance 'capacite' sont plus précises que celles de provenance 'element' ; le consommateur choisit (design.md §12, points ouverts).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | non |  |  |
| `sens` | TEXT | non |  |  |
| `sens_brut` | TEXT | non |  |  |
| `cible_type` | TEXT | non |  |  |
| `cible_magie_id` | TEXT | non |  |  |
| `cible_etat_id` | TEXT | non |  |  |
| `cible_degat` | TEXT | non |  |  |
| `cible_brut` | TEXT | non |  |  |
| `provenance` | — | non |  |  |
| `source_id` | TEXT | non |  |  |
| `npm_min` | INTEGER | non |  |  |
| `via_magie_id` | TEXT | non |  |  |

### `v_creature_sort`

*vue*

Sorts que peut lancer une créature (capacités « Lanceur de sorts » et « Sort supplémentaire »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | non |  |  |
| `capacite_id` | TEXT | non |  |  |
| `capacite` | TEXT | non |  |  |
| `npm_min` | INTEGER | non |  |  |
| `rang` | INTEGER | non |  |  |
| `sort_nom_brut` | TEXT | non |  |  |
| `sort_id` | TEXT | non |  |  |

### `v_creature_cout_invocation`

*vue*

Coût d'invocation : il n'est PAS sur la carte, il est écrit sur le SORT qui invoque (colonne « Coût » : « 6 (xNP de créature) », « 5 + 1 âme (xNPM de créature) », « 5 + 10% BA (xNPM de créature) »). Les commentaires du sort (table note_cellule, entité sort)) précisent que « chaque niveau de puissance de la créature invoqué double de le coût précédent ».

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | non |  |  |
| `invocation_id` | TEXT | non |  |  |
| `sort_id` | TEXT | non |  |  |
| `sort_nom` | TEXT | non |  |  |
| `cout_brut` | TEXT | non |  |  |
| `cout_chakra` | INTEGER | non |  |  |
| `cout_ressource` | TEXT | non |  |  |
| `cout_ressource_valeur` | INTEGER | non |  |  |
| `ep` | INTEGER | non |  |  |

### `v_creature_meme_bloc`

*vue*

« Autre créature du bloc » (ligne de la page actuelle) : la ou les autres cartes du même bloc.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `creature_id` | TEXT | non |  |  |
| `autre_creature_id` | TEXT | non |  |  |

### `v_arme`

*vue*

Arme avec les valeurs « effectives » : portée écrite dans l'effet, sinon portée par défaut du type (BDD!AF de la fiche) ; solidité de l'arme nue (2 crans de base, règle de l'onglet, corrigée par « 1 seul cran » / « ±1 cran » de l'effet : sans matériau ni amélioration) ; libellés de famille et de type.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | non |  |  |
| `nom` | TEXT | non |  |  |
| `famille` | TEXT | non |  |  |
| `type` | TEXT | non |  |  |
| `competence_brut` | TEXT | non |  |  |
| `mains` | TEXT | non |  |  |
| `cout_ro` | INTEGER | non |  |  |
| `de` | TEXT | non |  |  |
| `de_faces` | INTEGER | non |  |  |
| `bonus_degats_ou_0` | — | non |  |  |
| `bonus_degats` | INTEGER | non |  |  |
| `portee_min_effective` | — | non |  |  |
| `portee_max_effective` | — | non |  |  |
| `portee_source` | — | non |  |  |
| `solidite_sans_composition` | — | non |  |  |
| `ignore_ap` | INTEGER | non |  |  |
| `recharge` | TEXT | non |  |  |
| `provenance` | TEXT | non |  |  |
| `depart_possible` | INTEGER | non |  |  |
| `effet` | TEXT | non |  |  |

### `v_ingredient_possible`

*vue*

Ingrédients qui conviennent à un emplacement d'alchimie : même catégorie et même affinité ; l'emplacement « Amplificateur majeur » n'accepte que les ingrédients marqués « (majeur) », les autres emplacements « Amplificateur » que les non-majeurs (règle du Doc : « Certains ingrédients possèdent la mention (majeur), ils sont utiles pour faire les potions ultimes »). C'est une LECTURE de la source, pas une donnée : la vue peut être supprimée sans perte.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `recette_id` | TEXT | non |  |  |
| `rang` | INTEGER | non |  |  |
| `option` | INTEGER | non |  |  |
| `role` | TEXT | non |  |  |
| `affinite_id` | TEXT | non |  |  |
| `ressource_id` | TEXT | non |  |  |

### `v_ressource_recette`

*vue*

« Recettes qui utilisent la ressource X » : ressource citée par son nom dans la recette (via = 'nommee') ou ingrédient d'alchimie qui répond à l'exigence d'un emplacement (via = 'affinite').

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | non |  |  |
| `recette_id` | TEXT | non |  |  |
| `via` | — | non |  |  |

### `v_metier_recette`

*vue*

Recettes d'un métier : par famille citée dans « Artisanat possible » (alchimie seulement, voir metier_recette_famille).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `metier_id` | TEXT | non |  |  |
| `metier` | TEXT | non |  |  |
| `recette_id` | TEXT | non |  |  |
| `recette` | TEXT | non |  |  |
| `famille` | TEXT | non |  |  |
| `variante` | INTEGER | non |  |  |
| `test_brut` | TEXT | non |  |  |

### `v_potion`

*vue*

Potions avec leur niveau, leur prix et leurs recettes (une ligne par potion et variante de recette de sa page).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `ressource_id` | TEXT | non |  |  |
| `nom` | TEXT | non |  |  |
| `famille` | TEXT | non |  |  |
| `rang` | INTEGER | non |  |  |
| `niveau` | TEXT | non |  |  |
| `niveau_rang` | INTEGER | non |  |  |
| `prix_brut` | TEXT | non |  |  |
| `prix_rf` | INTEGER | non |  |  |
| `effet` | TEXT | non |  |  |

### `v_arme_composee`

*vue*

Arme forgée dans un matériau : « tous les bonus se cumulent une fois l'arme forgée (exemple : une claymore en cuivre donne un bonus aux dégâts de +10 car le cuivre donne +5 aux dégâts et la claymore donne aussi +5) » (Armes!A1). Une ligne par couple (arme, matériau). Seuls les bonus de dégâts s'additionnent ici : la source ne dit pas comment se combinent les crans de solidité d'une arme à effet de solidité et d'un matériau.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `arme_id` | TEXT | non |  |  |
| `arme` | TEXT | non |  |  |
| `materiau_id` | TEXT | non |  |  |
| `materiau` | TEXT | non |  |  |
| `bonus_degats_total` | — | non |  |  |
| `effet_materiau` | TEXT | non |  |  |

### `v_armure_piece`

*vue*

Une armure sur chacune de ses six pièces (Casque, Torse, Bras Gauche, Bras Droit, Jambe Gauche, Jambe Droit) : lecture de la fiche, qui recopie l'AP, l'AM et la solidité de l'armure choisie sur les six pièces. La source ne donne PAS de valeur propre à une pièce : cette vue ne stocke rien et n'invente rien ; elle disparaîtra le jour où la source en donnera.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `armure_id` | TEXT | non |  |  |
| `armure` | TEXT | non |  |  |
| `emplacement_id` | TEXT | non |  |  |
| `emplacement` | TEXT | non |  |  |
| `ap` | INTEGER | non |  |  |
| `am` | INTEGER | non |  |  |
| `solidite` | INTEGER | non |  |  |

### `v_niveau`

*vue*

Le moteur de la fiche, niveau par niveau : cumuls des dons du guide et valeurs par palier de la fiche. *_cumul : somme des dons des niveaux <= niveau (un don NULL compte 0 dans la SOMME : c'est un calcul, pas une donnée) caracteristiques_total / competence_naturel_max / puissance_magique_max_feuille : seuil_niveau (formules de la fiche) puissance_magique_max_guide : plus haute puissance écrite par le guide aux niveaux <= niveau

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `niveau` | INTEGER | non |  |  |
| `xp_min` | INTEGER | non |  |  |
| `xp_max` | — | non |  |  |
| `points_competences_cumul` | — | non |  |  |
| `points_attributs_cumul` | — | non |  |  |
| `caracteristiques_a_repartir_cumul` | — | non |  |  |
| `maximum_naturel_bonus_cumul` | — | non |  |  |
| `niveaux_classe_cumul` | — | non |  |  |
| `niveaux_maitrise_cumul` | — | non |  |  |
| `des_attributs_cumul` | — | non |  |  |
| `caracteristiques_total` | INTEGER | non |  |  |
| `competence_naturel_max` | INTEGER | non |  |  |
| `puissance_magique_max_feuille` | INTEGER | non |  |  |
| `puissance_magique_max_guide` | — | non |  |  |

### `v_competence`

*vue*

Compétences avec leur caractéristique : le moteur n'a pas à joindre.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | non |  |  |
| `nom` | TEXT | non |  |  |
| `ordre` | INTEGER | non |  |  |
| `libelle_fiche` | TEXT | non |  |  |
| `description` | TEXT | non |  |  |
| `caracteristique_id` | TEXT | non |  |  |
| `caracteristique` | TEXT | non |  |  |
| `lettre` | TEXT | non |  |  |

### `v_resistance_magie_lectures`

*vue*

Les deux LECTURES de la matrice « magie A résiste à magie B » côte à côte (le propriétaire n'a pas tranché laquelle fait foi, design.md §12.2) : valeur_fiche = resistance_magie (matrice de la fiche, 14 x 14, utilisée par rules.json) ; valeur_v8 = magie_resistance (listes « résiste à / vulnérable à » du classeur V8, affichées par les pages des magies). Une paire absente d'une lecture vaut 0 (neutre) : les listes V8 ne citent que les magies qui résistent ou qui sont vulnérables. Une seule requête répond à « que disent les deux lectures ? » ; `concordant = 0` donne les écarts (v_resistance_ecart).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | non |  |  |
| `attaque_magie_id` | TEXT | non |  |  |
| `valeur_fiche` | — | non |  |  |
| `valeur_v8` | — | non |  |  |
| `concordant` | — | non |  |  |

### `v_resistance_ecart`

*vue*

Lignes où la matrice de la fiche et les listes du classeur V8 ne disent pas la même chose. Vide quand les deux lectures concordent.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `magie_id` | TEXT | non |  |  |
| `attaque_magie_id` | TEXT | non |  |  |
| `valeur_fiche` | — | non |  |  |
| `valeur_v8` | — | non |  |  |

### `v_mode_hyper_lectures`

*vue*

Les cinq LECTURES du mode hyper (mode_hyper_effet.version) sur une même ligne : une ligne par cible (magie, couple de magies ou race) et variante. Chaque colonne est le texte de la source, NULL quand cette source ne dit rien de cette cible ; `nb_textes` = nombre de textes distincts (1 = les sources concordent). Les effets « généraux » n'ont pas de clé commune entre les sources : ils restent dans mode_hyper_effet.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `portee` | TEXT | non |  |  |
| `cible_id` | — | non |  |  |
| `magie2_id` | TEXT | non |  |  |
| `variante` | TEXT | non |  |  |
| `classeur_modes` | — | non |  |  |
| `magie_masque` | — | non |  |  |
| `onglet_magie` | — | non |  |  |
| `fiche` | — | non |  |  |
| `onglet_race` | — | non |  |  |
| `nb_lectures` | — | non |  |  |
| `nb_textes` | — | non |  |  |

### `v_classe_capacite`

*vue*

Une capacité par ligne avec sa classe et sa spécialité à plat : la vue à interroger pour « toutes les capacités d'une classe au niveau N ». specialite / specialite_rang sont NULL pour les capacités de classe (nature 'classe') et pour les choix de l'Archimage.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `classe_id` | TEXT | non |  |  |
| `classe` | TEXT | non |  |  |
| `specialite_id` | TEXT | non |  |  |
| `specialite_rang` | INTEGER | non |  |  |
| `specialite` | TEXT | non |  |  |
| `niveau` | INTEGER | non |  |  |
| `nature` | TEXT | non |  |  |
| `ligne` | INTEGER | non |  |  |
| `rang` | INTEGER | non |  |  |
| `capacite_id` | TEXT | non |  |  |
| `nom` | TEXT | non |  |  |
| `type` | TEXT | non |  |  |
| `type_brut` | TEXT | non |  |  |
| `limite_nombre` | INTEGER | non |  |  |
| `limite_periode` | TEXT | non |  |  |
| `effet` | TEXT | non |  |  |

### `v_capacite_exclusive`

*vue*

Choix exclusifs, lus dans la mise en page (règle du propriétaire, client/src/lib/capacites.mjs) : deux capacités sont des alternatives quand elles sont côte à côte sur la même ligne de l'onglet : deux colonnes sous la même bannière (nature 'choix'), les deux cartouches de spécialité (nature 'specialite'), les trois colonnes de l'Archimage (specialite_id NULL). La relation est symétrique : une ligne par sens.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `capacite_id` | TEXT | non |  |  |
| `autre_id` | TEXT | non |  |  |

### `v_capacite_partagee`

*vue*

Capacités écrites à l'identique (nom, type, effet, note de cellule) à plusieurs endroits : une ligne par contenu.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `nom` | TEXT | non |  |  |
| `type_brut` | — | non |  |  |
| `effet` | — | non |  |  |
| `nb_emplacements` | — | non |  |  |
| `premiere_id` | — | non |  |  |

## 13. PERSONNAGES : les vraies fiches (joueurs et prétirés), les groupes de jeu et la visibilité (saisie, jamais importée ; migration 0011)

### `utilisateur`

Personne qui se connecte au site. Connexion par Discord à la 1.0 (docs/feuille-de-route.md, « Authentification ») : on ne garde que l'identifiant Discord (immuable) et le nom d'affichage, jamais de mot de passe ni de jeton. Un compte local de secours (administrateur) n'a pas d'identifiant Discord. Tout utilisateur connecté est lecteur ; les autres rôles sont dans utilisateur_role.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | identifiant stable du site, jamais réutilisé |
| `discord_id` | TEXT | non | unique | « snowflake » Discord ; NULL = compte local de secours |
| `nom_affichage` | TEXT | oui |  |  |
| `cree_le` | TEXT | oui |  |  |

### `utilisateur_role`

Rôles d'un utilisateur, cumulables (la correspondance rôle Discord -> rôle du site est une configuration, pas une donnée) : 'mj' = maître du jeu (le « groupe MJ » : cible de la visibilité 'mj' d'une fiche), 'editeur' = modifie les règles (phase 2), 'admin' = voit et gère tout.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `utilisateur_id` | TEXT | oui | PK 1, → utilisateur.id |  |
| `role` | TEXT | oui | PK 2 |  |

### `personnage`

Une fiche de personnage : le haut de l'onglet Personnage (identité, magies, alignement, bourse, expérience) et les choix uniques. Deux natures (demande du propriétaire) : la fiche d'un JOUEUR, qu'il crée pour son personnage (visible de lui seul et des administrateurs, sauf ce qu'il ouvre : visibilité, partage, inscription dans un groupe), et le PRÉTIRÉ, qui n'appartient à personne et que tout le monde voit.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | identifiant stable, jamais réutilisé (un personnage renommé le garde) |
| `nature` | TEXT | oui |  |  |
| `proprietaire_id` | TEXT | non | → utilisateur.id | joueur qui l'a créée ; NULL exactement pour un prétiré |
| `visibilite` | TEXT | oui |  |  |
| `statut` | TEXT | oui |  | 'valide' : v_personnage_controle doit être vide pour elle |
| `nom` | TEXT | oui |  | « NOM » (F1) |
| `surnom` | TEXT | non |  | « Surnom » (P1) |
| `lieu_origine` | TEXT | non |  | « Lieu origine » (F3) |
| `race_id` | TEXT | non | → race.id | « RACE » (I2) ; NULL tant que le brouillon ne l'a pas choisie |
| `ethnie_id` | TEXT | non | → ethnie.id | don racial de la ligne « R » (C40, onglet « Bonus Race ») : l'ethnie, de la race choisie |
| `magie_innee_id` | TEXT | non | → magie.id | « Magie inn » (S2) |
| `magie_acquise_id` | TEXT | non | → magie.id | « Magie acq » (S3) ; NULL = pas de magie acquise (facultative, guide « Personnage ») |
| `caracteristique_magie_id` | TEXT | non | → caracteristique.id | point de caractéristique de la magie innée quand elle ne le fixe pas (magie.caracteristique_id NULL : Potentiel Illimité, « AU CHOIX ou ALEATOIRE ») ; NULL sinon |
| `dieu_choisi_id` | TEXT | non | → dieu.id | « Dieu choisi » (S5) ; le dieu inné se déduit de la magie innée (magie_dieu), il n'est pas stocké |
| `metier_id` | TEXT | non | → metier.id | don de la ligne « M » (C41, « Métier ? ») ; NULL = sans métier |
| `mode_classe` | TEXT | oui |  | « Mono classe » / « Bi classe » (BDD!K26) : figé à la création (la fiche le fige dès 201 XP) ; règle de progression : décision R2 |
| `xp` | INTEGER | oui |  | « TOTAL XP » (S11) ; le niveau global s'en déduit (v_personnage_niveau) |
| `alignement_loyal` | INTEGER | oui |  | scores L, C, B, M (L5:O5, guide « Alignement ») ; |
| `alignement_chaotique` | INTEGER | oui |  | le libellé (« Neutre Pur »…, I4) se calcule |
| `alignement_bon` | INTEGER | oui |  |  |
| `alignement_mauvais` | INTEGER | oui |  |  |
| `bourse_pp` | INTEGER | oui |  | « Bourse » : Précieuse (I6), Or (N6), Fer (T6) = monnaie 'pp', 'ro', 'rf' |
| `bourse_ro` | INTEGER | oui |  |  |
| `bourse_rf` | INTEGER | oui |  |  |
| `ambidextrie` | INTEGER | oui |  | case « Ambidextrie » (AU8) |
| `bouclier_classe_id` | TEXT | non | → bouclier_classe.id | « Nom Bouclier » (AA26) ; ses matériaux : personnage_bouclier_materiau |
| `sante_actuelle` | INTEGER | non |  |  |
| `chakra_actuel` | INTEGER | non |  |  |
| `barriere_actuelle` | INTEGER | non |  |  |
| `corruption` | INTEGER | non |  | « Corruption » (K15), guide « Attributs » |
| `barre4_actuelle` | INTEGER | non |  | Sang / Âme, la « 4ème barre » (A15:F15) |
| `notes` | TEXT | non |  | « NOTE » (BA53) |
| `evenements` | TEXT | non |  | « ÉVÉNEMENTS » (B71) |
| `cree_le` | TEXT | oui |  |  |
| `modifie_le` | TEXT | oui |  |  |

### `personnage_partage`

Utilisateurs à qui le propriétaire montre sa fiche en plus de sa visibilité (« un utilisateur spécifique », plusieurs possibles).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `utilisateur_id` | TEXT | oui | PK 2, → utilisateur.id |  |

### `personnage_classe`

Classes du personnage : « CLASSE » 1 (A9) et 2 (A11), chacune avec sa spécialité (I9, I11 : choisie au niveau de classe 10). Les niveaux de classe se déduisent de l'XP et du mode (v_personnage_niveau), ils ne sont pas stockés.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `classe_id` | TEXT | oui | → classe.id |  |
| `specialite_id` | TEXT | non | → specialite.id | NULL tant qu'elle n'est pas choisie |

### `personnage_caracteristique`

Valeur de base de chaque caractéristique (E18, M18, U18, E19, M19, U19), choisie dans les bornes de la race (v_race_carac_borne) ; le total suit seuil_niveau 'caracteristiques_total' (décision R3 : exactement). Le point de la magie innée (G18…) et les bonus d'accessoires se calculent.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `caracteristique_id` | TEXT | oui | PK 2, → caracteristique.id |  |
| `base` | INTEGER | oui |  |  |
| `croix` | INTEGER | oui |  | croix sous la caractéristique (cases H18, I18…), décision R19 : handicap ou malus (blessure grave, trauma, maladie, mauvaise nuit) ; 1 = −20 % à tout test de la caractéristique, 2 = ses compétences ne sont plus utilisables (regle_constante 'competence.croix_1_malus', 'competence.croix_2_malus') |

### `personnage_competence`

Points de compétence : « Nat. » (naturel, budget de niveau_global, plafond seuil_niveau 'competence_naturel_max') et « Acquis » (bonus de race, classe, don, équipement, entraînement : au plus 5 par point de caractéristique de base, guide « Compétences »). Le total (K22…) se calcule. Compétence absente = 0 et 0.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `competence_id` | TEXT | oui | PK 2, → competence.id |  |
| `naturel` | INTEGER | oui |  |  |
| `acquis` | INTEGER | oui |  |  |

### `personnage_progression`

Gains d'attributs à chaque niveau global à partir du 2 : les points d'attributs (niveau_global.points_attributs, 15) répartis entre santé et chakra (la fiche compte F14 + M14 : BDD!K40), et le dé bonus des niveaux qui en donnent un (niveau_global.de_attributs_bonus : « 1d8 santé OU 1d8 chakra OU 1d4 pour les deux »). La fiche ajoute tout à la main dans la formule de F14/M14 (« +0 ») : ici chaque gain est daté par son niveau.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `niveau` | INTEGER | oui | PK 2, → niveau_global.niveau |  |
| `points_sante` | INTEGER | oui |  |  |
| `points_chakra` | INTEGER | oui |  |  |
| `de_choix` | TEXT | non |  | NULL = pas de dé à ce niveau |
| `de_resultat` | INTEGER | non |  | résultat du dé, ajouté à la santé, au chakra, ou aux deux (« 1d4 pour les deux ») |

### `personnage_capacite`

Dons de classe choisis (lignes « CLASSE 1 » / « CLASSE 2 », C43:L67) : seulement ceux qui demandent un CHOIX (v_capacite_exclusive : options d'une même ligne, une spécialité contre l'autre, paliers de l'Archimage). Les dons sans alternative se déduisent de la classe, du niveau et de la spécialité.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `capacite_id` | TEXT | oui | PK 2, → capacite.id |  |

### `personnage_sort`

« LISTE DE SORTS » (AA55:AY74) : sorts de la magie innée ou acquise, avec leur niveau de maîtrise (« NM », AY). Un NM vient d'un niveau (au plus niveau global − 1 sur un sort, BDD!BB6, et au plus les NM gagnés en tout), d'un livre de sort (un seul par sort, lié à ce sort : page « Livre / Parchemin ») ou d'un cadeau du MJ ; un sort a au plus 3 NM en tout (regle_constante 'sort.nm_max', décision R26). Type, coût, portée, zone et effets se lisent dans `sort`.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `sort_id` | TEXT | oui | PK 2, → sort.id |  |
| `rang` | INTEGER | oui |  | ligne de la liste sur la fiche |
| `niveau_maitrise` | INTEGER | oui |  | NM du sort, toutes origines comprises |
| `nm_livre` | INTEGER | oui |  | dont le NM d'un livre de sort (un par sort au plus ; migration 0021) |
| `nm_cadeau` | INTEGER | oui |  | dont les NM donnés par le MJ |

### `personnage_maitrise_arme`

« Maîtrise d'armes » (AA2:AV7) : nombre de dés (1d à 5d) par famille d'armes. Famille absente = pas de maîtrise (1d). Chaque point de maîtrise ajoute un dé : 4 points au plus (regle_constante 'maitrise_arme.des_sans_maitrise' et 'maitrise_arme.des_max', migration 0016).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `arme_famille_id` | TEXT | oui | PK 2, → arme_famille.id |  |
| `des` | INTEGER | oui |  |  |

### `personnage_arme`

« ARMES » (AA9:AY18) : deux emplacements, chacun une arme du catalogue, sa composition (matériau), ses améliorations et son élément.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `rang` | INTEGER | oui | PK 2 | arme 1 (AA10) ou 2 (AN10) |
| `arme_id` | TEXT | oui | → arme.id |  |
| `materiau_id` | TEXT | non | → materiau_arme.ressource_id | « Composition » (AE10) |
| `amelioration_id` | TEXT | non | → amelioration_equipement.id | « Amélioration » (AI13) : cible 'arme' |
| `arme_elementaire_id` | TEXT | non | → arme_elementaire.id | « Elément » (AI16) |
| `amelioration_elementaire_id` | TEXT | non | → amelioration_equipement.id | amélioration de la pièce élémentaire (AI18) : cible 'arme_elementaire' |
| `effet_en_plus` | TEXT | non |  | « Effet en plus » (AA12), texte libre |

### `personnage_armure`

« ARMURE / DÉFENSE » (AA19:AX23) : une pièce par emplacement (armure complète, ou casque, torse, bras, jambes).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `emplacement_id` | TEXT | oui | PK 2, → armure_emplacement.id |  |
| `armure_id` | TEXT | oui | → armure.id | « Nom Armure » (AD21) |
| `amelioration_id` | TEXT | non | → amelioration_equipement.id | cible 'armure' |
| `armure_elementaire_id` | TEXT | non | → armure_elementaire.id | « Elément » (AQ21) |
| `amelioration_elementaire_id` | TEXT | non | → amelioration_equipement.id | cible 'armure_elementaire' |

### `personnage_bouclier_materiau`

Matériaux du bouclier (AF26, AJ26, AN26 et leurs quantités AH27, AL27, AP27) : au plus trois, la somme des quantités ne dépasse pas la classe du bouclier (validation de AL27 : « La somme des quantités de matériaux ne doit pas dépasser la… »).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `materiau_id` | TEXT | oui | → materiau_bouclier.ressource_id |  |
| `quantite` | INTEGER | oui |  |  |

### `personnage_accessoire`

« ACCESSOIRES » (AA28:AY37) : Chef, Collier, Bracelet 1 et 2, Bague 1 et 2, Ceinture, Autre. Chacun porte un effet de la table des accessoires (propriété en AD29…, effet en AA30…), sa valeur tirée quand l'effet est une fourchette, et la case « Malédiction » (AD31…).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `emplacement` | TEXT | oui | PK 2 |  |
| `nom` | TEXT | non |  | nom donné à l'objet |
| `accessoire_effet_id` | TEXT | non | → accessoire_effet.id | NULL = effet hors table (texte libre ci-dessous) |
| `valeur` | INTEGER | non |  | valeur tirée dans [bonus_min, bonus_max] de l'effet ; NULL si l'effet n'a pas de fourchette |
| `texte` | TEXT | non |  | effet tel qu'écrit sur la fiche quand il n'est pas dans la table |
| `maudit` | INTEGER | oui |  |  |

### `personnage_inventaire`

« INVENTAIRE | SAC » (AA39:AY…) : une ligne par objet ; `ressource_id` quand l'objet est au catalogue, sinon le nom seul.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | oui | PK 1, → personnage.id |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `nom` | TEXT | oui |  |  |
| `quantite` | INTEGER | oui |  |  |
| `ressource_id` | TEXT | non | → ressource.id |  |

### `groupe`

Groupe de jeu : la table d'un one-shot (« OS ») ou d'une campagne. Ses membres voient les fiches qui y sont inscrites.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK |  |
| `nom` | TEXT | oui |  |  |
| `nature` | TEXT | oui |  |  |
| `cree_le` | TEXT | oui |  |  |

### `groupe_membre`

Membres d'un groupe et fiche inscrite (demande du propriétaire) : un joueur peut être dans plusieurs groupes et avoir plusieurs fiches, mais n'inscrit qu'UNE fiche par groupe : une ligne par (groupe, membre), et inscrire une autre fiche remplace `personnage_id` (la précédente est désinscrite). La fiche inscrite devient visible de tous les membres du groupe, et d'eux seuls : ses autres fiches restent cachées (v_personnage_visible). On inscrit sa propre fiche ou un prétiré (v_groupe_controle).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `groupe_id` | TEXT | oui | PK 1, → groupe.id |  |
| `utilisateur_id` | TEXT | oui | PK 2, → utilisateur.id |  |
| `role` | TEXT | oui |  | MJ de la table ou joueur |
| `personnage_id` | TEXT | non | → personnage.id | fiche inscrite ; NULL = aucune (membre qui n'a pas encore inscrit de fiche, MJ) |
| `rejoint_le` | TEXT | oui |  |  |

### `v_personnage_niveau`

*vue*

Niveau global et niveaux de classe d'un personnage. Niveau global = plus haut niveau dont l'XP minimale est atteinte (Personnage!W8 : VLOOKUP(S11; BDD!G2:H21; 2; 1)). Niveaux de classe : décision R2 (« un "monoclasse" choisit automatiquement sa 2e classe au niveau 11 ») : mono-classe : classe 1 = min(20, 2 × niveau global), classe 2 = 2 × niveau global − classe 1 ; bi-classe : chacune = niveau global (G9, G11).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | non |  |  |
| `niveau_global` | INTEGER | non |  |  |
| `niveau_classe_1` | — | non |  |  |
| `niveau_classe_2` | — | non |  |  |

### `v_personnage_visible`

*vue*

Qui voit quelle fiche (demande du propriétaire) : une ligne par (fiche, utilisateur, motif) ; un utilisateur voit une fiche s'il a au moins une ligne. Motifs : 'proprietaire' ; 'admin' (toutes les fiches) ; 'tous' (visibilité 'tous', donc tout prétiré) ; 'mj' (visibilité 'mj' : utilisateurs de rôle 'mj') ; 'groupe' (membres du groupe `groupe_id` où la fiche est inscrite) ; 'partage' (utilisateur désigné par le propriétaire).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | non |  |  |
| `utilisateur_id` | TEXT | non |  |  |
| `motif` | — | non |  |  |
| `groupe_id` | TEXT | non |  |  |

### `v_groupe_controle`

*vue*

Contrôle des inscriptions dans les groupes : une ligne par anomalie (vide = conforme). Un membre inscrit sa propre fiche ou un prétiré.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `groupe_id` | TEXT | non |  |  |
| `utilisateur_id` | TEXT | non |  |  |
| `regle` | — | non |  |  |
| `detail` | TEXT | non |  |  |

### `v_personnage_controle`

*vue*

Contrôle d'une fiche : une ligne par règle enfreinte (vide = fiche conforme pour ces règles). `regle` est une clé stable ; `detail` dit quoi. Seules des règles écrites dans la base sont vérifiées (matrices de la fiche, onglets, guide, décisions R2, R3, R8, R11, R15, R16, R20, R23, R24, R25, R26) ; ce qui demande le moteur (bonus de classe, d'équipement, nombre de sorts, plafond de NPM du Potentiel Illimité) n'est pas ici. Une fiche 'brouillon' peut avoir des lignes, une fiche 'valide' non (test).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `personnage_id` | TEXT | non |  |  |
| `regle` | — | non |  |  |
| `detail` | BLOB | non |  |  |

## 14. ÉDITION : le journal des modifications faites depuis le site de dev (saisie, jamais importée ; migration 0017)

### `modification_lot`

Un enregistrement fait depuis une page (le bouton de confirmation) : toutes ses modifications passent ou aucune.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | TEXT | oui | PK | UUID tiré par le service |
| `fait_le` | TEXT | oui |  |  |
| `auteur_id` | TEXT | non | → utilisateur.id | NULL avant la connexion Discord (1.0) : quiconque ouvre le site de dev |
| `page_id` | TEXT | non |  | page d'où l'enregistrement est fait (« races/elfe-noir ») ; sans clé étrangère : une page créée par l'édition peut ne pas encore être dans les règles livrées |
| `resume` | TEXT | oui |  | « Métier Forgeron : bonus_brut » : ce que le service a fait, lisible |

### `modification`

Une ligne de table touchée par un lot. `cle` = la clé primaire de la ligne ({"id": "metiers/forgeron"}) ; `avant` / `apres` = les colonnes modifiées (toute la ligne pour une insertion ou une suppression). État : 'en_attente' (dans la base vivante, pas encore dans data/rows), 'integree' (les règles livrées la contiennent déjà : elle est revenue par git), 'conflit' (les règles livrées ont changé la ligne autrement : elle n'est pas rejouée, `detail` dit pourquoi).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `lot_id` | TEXT | oui | PK 1, → modification_lot.id |  |
| `rang` | INTEGER | oui | PK 2 | ordre d'application dans le lot |
| `table_nom` | TEXT | oui |  |  |
| `cle` | TEXT | oui |  |  |
| `operation` | TEXT | oui |  |  |
| `avant` | TEXT | non |  |  |
| `apres` | TEXT | non |  |  |
| `etat` | TEXT | oui |  |  |
| `detail` | TEXT | non |  | raison d'un conflit ; NULL sinon |
| `apercu` | TEXT | non |  |  |

### `note_version_brouillon`

La note de version en préparation sur le site de dev (page /mise-a-jour/ : le champ libre que les admins remplissent, en plus de la liste calculée ; migration 0023). Une seule ligne. `lot` : le lot figé quand « Effectuer la mise à jour » est lancé (son texte part avec lui) ; la ligne est vidée quand une livraison apporte la note de version de ce lot (client/serveur/base-vivante.mjs).

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | oui | PK |  |
| `texte` | TEXT | non |  | Markdown ; NULL : rien d'écrit |
| `modifie_le` | TEXT | non |  |  |
| `lot` | TEXT | non |  |  |

## 15. NOTES DE VERSION : ce que chaque version a changé dans les règles (page /mise-a-jour/), et l'historique des modifications faites sur le

### `note_version`

Une version livrée (dev → master) : « 0.2 » (X.Y : la production ne porte que deux chiffres), sa date, le champ libre des admins.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `version` | TEXT | oui | PK |  |
| `publiee_le` | TEXT | oui |  |  |
| `depuis` | TEXT | non |  |  |
| `texte` | TEXT | non |  | champ libre des admins (Markdown) ; NULL : rien d'écrit |
| `lot` | TEXT | non |  | lot figé sur le site de dev qui l'a produite |
| `exemple` | INTEGER | oui |  | 1 : donnée de démonstration (lorem ipsum, demande du propriétaire tant qu'aucune version n'a été livrée), retirée par la première vraie mise à jour |

### `note_version_ligne`

Une ligne de la liste calculée : une modification d'un champ d'une entité entre la production et la nouvelle version. `domaine` range la ligne (sorts, magies, classes et leurs dons, races, métiers, guide), `groupe` et `entite` la nomment (« Lumière » › « Flash »), au nom qu'elle porte dans la nouvelle version (l'ancien pour une entité retirée). `sens` : la couleur (vert, rouge, gris) d'après les critères du propriétaire (client/src/lib/notes-de-version.mjs) ; `parties` : le détail quand une case se lit en morceaux (valeur de base, expression de NM), chacun avec son sens. `table_nom`, `cle`, `colonne` : la trace de la ligne de la base d'où elle vient.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `version` | TEXT | oui | PK 1, → note_version.version |  |
| `rang` | INTEGER | oui | PK 2 | ordre d'affichage |
| `domaine` | TEXT | oui |  |  |
| `groupe` | TEXT | non |  |  |
| `entite` | TEXT | oui |  |  |
| `champ` | TEXT | non |  | libellé de la colonne (« Coût ») ; NULL : l'entité entière (ajoutée, retirée) |
| `nature` | TEXT | oui |  |  |
| `avant` | TEXT | non |  |  |
| `apres` | TEXT | non |  |  |
| `sens` | TEXT | oui |  |  |
| `parties` | TEXT | non |  |  |
| `table_nom` | TEXT | non |  |  |
| `cle` | TEXT | non |  |  |
| `colonne` | TEXT | non |  |  |

### `historique_modification`

Le journal du site de dev une fois livré (une ligne par ligne de table touchée, comme `modification`) : qui a changé quoi, quand, avant et après (docs/feuille-de-route.md : modifications historisées). Les tests qui vérifient l'import (effectifs, textes cités, fidélité d'une page à son onglet) s'en servent pour ne plus contrôler ce que le site a modifié : le propriétaire a fait du site la source des règles.

| Colonne | Type | Obligatoire | Clé | Description |
| --- | --- | --- | --- | --- |
| `lot_id` | TEXT | oui | PK 1 |  |
| `rang` | INTEGER | oui | PK 2 |  |
| `fait_le` | TEXT | oui |  |  |
| `resume` | TEXT | oui |  | résumé du lot (modification_lot.resume) |
| `version` | TEXT | non | → note_version.version | version qui l'a livrée ; NULL : rapatriée à la main (npm run db:appliquer-edition) |
| `table_nom` | TEXT | oui |  |  |
| `cle` | TEXT | oui |  |  |
| `operation` | TEXT | oui |  |  |
| `avant` | TEXT | non |  |  |
| `apres` | TEXT | non |  |  |
