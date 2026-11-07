---
name: base-sqlite
description: "Base SQLite : data/schema.sql (sections, tables STRICT, vues), data/rows versionné, commandes db:*, colonne remarque, onglet DB /donnees/, identifiants figés. À charger avant de lire, modifier ou relire le schéma, data/rows, les scripts db-* ou tools/db/."
user-invocable: false
---
# Base SQLite (`data/schema.sql`, `data/rows/`)

## Fichiers
- `data/schema.sql` : la structure. 212 tables STRICT, FTS5, 38 vues, rangées en sections numérotées (en-têtes `-- N. …` du fichier) :
  0 familles d'import ; 1 pages, liens, mots-clés, sources ; 2 règles de la fiche ; 3 magies et sorts ; 4 annexes des magies ; 5 dieux ;
  5 bis chronologie ; 6 classes, spécialités, capacités ; 7 races ; 8 bestiaire (invocations et créatures) ; 8 bis monstres du Bestiaire 2.0 et leurs
  capacités communes ; 9 équipement, ressources, craft, métiers ; 10 notes de cellule et écarts entre sources ; 11 tables dérivées ; 12 vues ;
  13 fiches de personnages et groupes de jeu ; 14 journal de l'édition et brouillon de la note de version ; 15 notes de version et historique des
  modifications du site.
- `data/rows/` : les lignes versionnées, un fichier par table, une instruction `INSERT` par ligne, triées.
- `data/migrations/NNNN-<nom>.sql` (+ registre `.json` pour une migration de données) : tout changement de schéma ou de données (skill `ecrire-une-migration`).
- `client/scripts/db-*.mjs` (build, derive, check, doc, init, export-pages, appliquer-edition, reference), `tools/db/` (`maverick.py`, `migrer.py`, `pages_md.py`, `exporter.py`, `races_onglet.py`, `homonymes.py`).
- Onglet DB : `client/src/lib/donnees.mjs`, `client/src/pages/donnees/` (`index.astro`, `[table].astro`, `maverick.db.ts`).

## À lire
- `docs/sql/remplissage.md` : commandes, qui met quoi à jour, pourquoi `data/rows` est commité, onglet DB, pages fabriquées, `db:migrate`, colonne `remarque`.
- `docs/sql/conception.md` : conventions (`nom`, `titre`, `*_cle`, `origine`, `source_ref`, cascades), §10.1 migrations.
- `docs/sql/structure.md`, `docs/sql/apercu.md` : générés par `npm run db:doc`, jamais écrits à la main.
- Procédures voisines : skill `ecrire-une-migration`, skill `interroger-la-base`, skill `rapatrier-l-edition`, skill `modifier-une-page-wiki`, skill `revue-sql`, skill `relecture-db`.

## Commandes (depuis `client/`)
Détail : `docs/sql/remplissage.md`. `npm run db:build` (→ `var/maverick.db`), `db:check` (code 1), `db:pages-check`, `db:sync-pages` (les `.md` fabriqués → `data/rows`), `db:export-pages` (lancé avant `dev`, `build`, `test`), `db:init`, `db:doc` (régénère `structure.md` et `apercu.md`), `db:migrate`, `db:appliquer-edition -- <journal.json>` (rejoue le journal du site de dev sur `data/rows`, versé dans `historique_modification`, réécrit par `tools/db/exporter.py`).

## Invariants
- `var/maverick.db` est une copie reconstruite, jamais commitée. La seule persistance versionnée est `data/rows`.
- `data/rows` s'écrit tel que l'exporteur l'écrit : jamais de résolution de conflit git à la main (relancer l'importeur ou `db:sync-pages`). Un fichier qui
  n'est pas tel que l'exporteur l'écrit bloque une mise à jour (skill `zone-mise-a-jour`).
- Un changement de structure passe par une migration, jamais par une retouche de `data/rows`.
- Les 24 tables de la section 13 (fiches de personnages, groupes de jeu) et les 3 de la section 14 (journal de l'édition, brouillon de la note de version)
  restent vides dans `data/rows`. Les vraies fiches vivent dans la base vivante du service (skill `zone-fiches-base`, skill `zone-service`).
- Journal de l'édition (section 14) : un lot en conflit n'est jamais effacé ni réécrit. Sa résolution (`/mise-a-jour/`, migration 0072) remplit
  `modification_lot.resolu_le`, `resolution` (les choix, JSON) et `resolu_par` (le nouveau lot normal, jamais lui-même) ; ses lignes restent
  `conflit`, avec leur `detail` (skill `zone-edition`).
- Les commentaires de `data/schema.sql` (recopiés par `db:doc`) ne citent que du code qui existe : un fichier `.mjs`, `.astro`,
  `.css` cité existe, un renvoi `fichier.mjs#Nom` nomme une définition du fichier, et `#Nom.prop` une propriété de l'export d'un module de `lib/`
  (`db-schema.test.mjs`). Un renommage ou une suppression dans le code corrige le commentaire dans le même lot, sans migration (`tools/db/maverick.py#comparer_schemas` ignore les commentaires), sauf dans le corps d'une `CREATE VIEW` ou d'une `CREATE TRIGGER` : SQLite garde dans `sqlite_master.sql` le texte entier du corps, commentaires compris, et les tests de migration rejouée (`client/test/aide-migration-rejouee.mjs#rejouerLaMigration`, par exemple `personnages-livre-de-sort.test.mjs`) le comparent à celui de `data/schema.sql`. Un commentaire dans ce corps reste identique, au caractère près, à celui de la dernière migration qui crée l'objet ; le changer demande une migration qui recrée l'objet. Une migration appliquée garde le sien.
- Noms d'affichage : une table ou une colonne nouvelle d'une table que l'édition écrit a son nom français dans `client/src/lib/libelles-de-la-base.mjs` (skill `zone-edition`), sinon `test/libelles-de-la-base.test.mjs` échoue ; une clé normalisée `X_cle` et la provenance n'en demandent pas.
- Identifiants figés : un id ne dérive plus du nom depuis la migration 0006 ; un nom corrigé ou renommé garde son id, une page renommée garde son adresse
  (skill `base-orthographe`).
- Les lignes typées ne se réimportent pas encore depuis les classeurs : réimporter un classeur modifié demande de porter l'importeur de sa famille ; une mise à jour passe par le rapprochement (skill `sources-rapprochement`).
- Colonne `remarque` : chaque table d'entités en a une, texte libre, vide par défaut. Elle reprend les notes de cellule des classeurs (plusieurs notes réunies,
  séparées par une ligne vide). `note_cellule` n'est qu'une trace : le site lit la remarque, jamais `note_cellule`. `db:check` vérifie qu'aucune note n'est
  absente de la remarque de sa ligne.
- Provenance (`famille`, `origine`, `source_ref`) : retirée à la 1.0 (décision du propriétaire, `CLAUDE.md`) ; n'y rien investir.
- Page retirée, identifiants figés (migrations 0094, 0095 ; registre `0005-orthographe-base.json`) : les ids `guide/postures#posture:…` gardent leur préfixe, leurs lignes `page_entite` sont rattachées à `guide/les-postures` ; les 3 textes du Mode Hyper de `mode_texte` gardent `guide/liste-des-effets-mode-hyper#texte:…` et sont rattachés à `guide/le-mode-hyper`, comme les 12 constantes `regle_constante` `mode_hyper.*` et `mode_hyper_100.*`. Le CHECK de `mode_texte` n'admet que cette exception d'id. `db:check` ne contrôle plus la page de ces ids : pour une sous-entité dont la page d'origine est retirée, il prend la colonne `page_id` de la table.
- Améliorations d'arme (R167, migration 0081) : un seul tableau pour l'arme du catalogue et l'arme élémentaire. Les lignes de cible `arme` portent le coût matériel (`cout_brut`…) et le coût élémentaire (`cout_elementaire_brut`, `cout_gemmes`…) ; la cible `arme_elementaire` ne reste que dans `amelioration_total`. Type d'une famille : `arme_famille.type_elementaire_id` (NULL pour ARME DE MONSTRES et pour une famille créée sur le site de dev, R159 : aucune arme élémentaire ; le site ne le modifie pas) ; `arme_elementaire_type` et ses `_competence` et `_degats` (types physiques posés par la décision, jamais recalculés depuis `arme_degats` ; tous appliqués sauf `type_degats_au_choix` = 1, la bombe, dont le choix est `personnage_arme.type_degats_choisi`). Solidité de base : `constante_equipement` `piece_elementaire.solidite_base` (migration 0080) + `bonus_cran` de la ligne d'amélioration.
- Mots-clés (R183, migration 0090) : `mot_cle.abreviation`, au plus une par mot-clé, NULL sinon ; `db:check` en contrôle l'unicité et l'absence d'ambiguïté (`fautesDeLAbreviation` : skill `zone-mots-cles`). L'id `cr` n'existe plus (CR est l'abréviation de `corruption`) ; la page `guide/lexique` est retirée. `couleur` et `url` (0098) : skill `zone-mots-cles-liens`.
- Dérivées (`scripts/db-derive.mjs`) : `lien` (vue `lien_page`) = les `[[…]]` (pages d'exemple), puis chaque balise d'un mot-clé dont l'adresse mène à une page (`adresses-db.mjs#pageDeLAdresse`) ; `page_fts` indexe le texte affiché (`texteSansBalises`), jamais l'id d'un mot-clé.
- Plan des Règles (R184, R185, migration 0091), section 1 : `regles_onglet` (id, titre, `ordre`, `ouverture_page_id`) et `regles_onglet_entree` (le menu latéral). L'ouverture d'un onglet est une clé étrangère composée différée vers une entrée de cet onglet : onglet et entrées s'écrivent dans une même transaction. `rang` (et `ordre`) sans UNIQUE, pour échanger deux places dans un même lot : à égalité, l'id départage. Ids `page:<id>`, `lien:<adresse>`, `bientot:<clé>` ; `page_id` UNIQUE ON DELETE CASCADE. Lu par `lib/plan-des-regles-db.mjs` (skill `zone-guide`), hors des listes de `lib/tables-de-la-base.mjs`. L'édition modifie les entrées, jamais `regles_onglet` (ordre, titre, ouverture fixes : skill `zone-edition-menus`).
- Ordre des races (migration 0092) : `race.rang_liste` donne l'ordre du menu latéral des races, de `/races/` et du tableau des magies innées. Nullable (NULL en fin de liste, par nom), sans UNIQUE (un réordonnancement renumérote plusieurs races d'un lot), distinct de `race.ordre`, l'ordre de l'onglet « Race » et de la fiche (skill `zone-races`). Une race créée prend le rang suivant.
- Compteurs d'usage (R173, 0085) : `personnage_action_usage`, ligne absente = au maximum (skill `zone-fiches-base`).
- Réussite critique (R180, 0087 ; R182, 0089) : `regle_constante` `critique.*` ; `posture_critique.bonus` n'admet que `'posture'` (Sci du Crit : mentionné, jamais compté). `personnage_sort.prepare_critique` (plage figée du sort préparé) : CHECK écrit de 1 (bas de « 1 à N » : un accessoire maudit descend sous `critique.base`, R180, R54) à 15 (le test le compare à `critique.plafond`).
- Tableau libre du Mage Bleu (R181, migration 0088) : `classe_annexe_entree`, une ligne par « (Type) Nom. Effet » d'une ligne de `classe_annexe` (54 entrées), id figé `classes/mage-bleu#entree:<magie>:<nom>`, texte cité tel quel (`type_brut || ' ' || nom || '. ' || effet`, joint dans l'ordre de `rang` = le texte de la ligne). `capacite_variable` : la magie (`innee` ou `acquise`) que vise un don « Variable », une donnée, jamais lue par le nom du don ; le site de dev l'écrit (création, changement de type ou de magie : skill `zone-edition`). Les règles d'un don partent avec lui (skill `zone-edition`). Choix des fiches : skill `zone-fiches-base`.
- Plafonds de NPM (R188, migration 0097) : `magie_npm_plafond` (`magies/potentiel-illimite` → 3) et `capacite_npm_plafond` (`capacites/archimage-semi-complet` → 4). Effet seulement si la magie innée a un plafond ; effectif = max(magie, dons acquis), au plus la table des niveaux (R16) ; ne borne que le choix des sorts. `capacite_condition_emplacements` (R189, `capacites/archimage-grimoire`) : lue par le moteur seul, aucune règle SQL. Valeurs jamais lues dans un texte ; le site ne les crée pas.
- Migration 0099 : `v_arme.solidite_sans_composition` applique le plancher de R51 (au moins 1) ; `invocation.tableau_sort_id` (clé étrangère vers `sort`, nullable) désigne le sort dont le tableau est celui de l'invocation (skill `zone-bestiaire`). Migration 0100 : ancres figées `{#ancre}` des 20 états de `guide/liste-des-alterations-d-etat` et des 2 sections de la ceinture (skills `zone-magies`, `zone-ceinture`).
- Résistances physiques (R174, migration 0083) : `magie_resistance.cible_type` admet `'physique'`, avec `cible_physique` (`estoc`, `taille`, `frappe`) ; la contrainte nommée `magie_resistance_une_cible` veut exactement une cible renseignée, celle de `cible_type`. Seules lignes physiques : les trois vulnérabilités du Potentiel Illimité (« Surtension corporelle », citée dans `cible_brut`). Leur annulation en Mode Hyper (R172) n'est pas une donnée de la table.
- Le site de dev est la source de ce qu'il modifie : une valeur de l'import se lit par `client/src/lib/historique-site.mjs` (`valeurDImport`, `lignesDImport`,
  `effectifDImport`, table `historique_modification`).

## Choix du propriétaire
- Le site tire de la base toutes ses pages (`.md` fabriqués au build) et l'onglet **DB** : `/donnees/` (toutes les tables et vues) et la base en
  téléchargement `/donnees/maverick.db` (absente de la version portable).
- Le Potentiel Illimité n'a ni gemme, ni bois, ni bâton magique, ni pièce élémentaire (décision R160) : la base le refuse. `gemme`, `bois`,
  `baton_magique`, `arme_elementaire` et `armure_elementaire` portent la contrainte nommée `<table>_sans_potentiel_illimite`
  (`CHECK (magie_id <> 'magies/potentiel-illimite')`, migration 0078) ; une migration ou une édition qui en ajoute une échoue (`bois` : `bois_sans_potentiel_illimite`). Une table reconstruite
  garde cette contrainte.

## Tests
- `client/test/db-donnees.test.mjs` (`data/rows` = les `.md`), `db-schema.test.mjs`, `db-remarque.test.mjs`, `db-appliquer-edition.test.mjs`, `donnees.test.mjs`, `historique-site.test.mjs`, `db-index-retires.test.mjs` (0073), `db-arme-famille-nom-lecture.test.mjs` (0077, R159 : `arme_famille.nom_lecture`), `r160-potentiel-illimite-sans-gemme.test.mjs` (0078), `db-armes-elementaires.test.mjs` (R167), `db-r174-resistances-physiques.test.mjs`, `db-r172-mode-hyper-activable.test.mjs` et `db-r172-sort-prepare-en-mode-hyper.test.mjs` (skill `zone-fiches-base`), `db-r173-compteurs-d-actions.test.mjs`, `db-r180-reussite-critique.test.mjs`, `db-r182-critique-du-sort-prepare.test.mjs`, `db-r181-dons-variables.test.mjs` (sur l'état courant, l'invariant « type Variable ⇔ ligne `capacite_variable` », que le site écrit, R192 ; le reste à l'import), `db-0099-solidite-et-tableau-du-sort.test.mjs`, `db-0100-ancres-figees-des-intertitres.test.mjs`, `r188-npm-potentiel-illimite-base.test.mjs` (0097), `db-lexique-en-mots-cles.test.mjs` (R183), `db-liens-en-mots-cles.test.mjs` (0098), `db-derive-recherche.test.mjs` (`page_fts`), `db-r184-plan-des-regles.test.mjs` (ouverture contrainte, ids, cascade), `db-rang-des-races.test.mjs`, `db-pages-du-site.test.mjs` (une page des Règles créée sur le site passe `db:sync-pages`), `db-retrait-pages-doublons-des-combats.test.mjs`, `db-retrait-liste-des-effets-mode-hyper.test.mjs` et `db-retrait-alterations-d-etats-et-mode-hyper.test.mjs` (0094 à 0096 ; le test de la 0096 accepte le lien ou la balise de la 0098 ; ils lisent les textes et l'onglet dans l'état de leur migration, `baseDImport({ garder: lotsAvant('NNNN') })`, fixtures `test/fixtures/lots-avant-NNNN.json`, car un texte écrit par une migration se lit sur l'état de la migration). Les tests de `personnage_*` : skill `zone-fiches-base`.
