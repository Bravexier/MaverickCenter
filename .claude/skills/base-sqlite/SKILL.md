---
name: base-sqlite
description: "Base SQLite : data/schema.sql (sections, tables STRICT, vues), data/rows versionné, commandes db:*, colonne remarque, onglet DB /donnees/, identifiants figés. À charger avant de lire, modifier ou relire le schéma, data/rows, les scripts db-* ou tools/db/."
user-invocable: false
---
# Base SQLite (`data/schema.sql`, `data/rows/`)

## Fichiers
- `data/schema.sql` : la structure. 203 tables STRICT, FTS5, 38 vues, rangées en sections numérotées (en-têtes `-- N. …` du fichier) :
  0 familles d'import ; 1 pages, liens, mots-clés, sources ; 2 règles de la fiche ; 3 magies et sorts ; 4 annexes des magies ; 5 dieux ;
  5 bis chronologie ; 6 classes, spécialités, capacités ; 7 races ; 8 bestiaire (invocations et créatures) ; 8 bis monstres du Bestiaire 2.0 et leurs
  capacités communes ; 9 équipement, ressources, craft, métiers ; 10 notes de cellule et écarts entre sources ; 11 tables dérivées ; 12 vues ;
  13 fiches de personnages et groupes de jeu ; 14 journal de l'édition et brouillon de la note de version ; 15 notes de version et historique des
  modifications du site.
- `data/rows/` : les lignes versionnées, un fichier par table, une instruction `INSERT` par ligne, triées (1124 pages, dont 116 du Codex, + 7 domaines, au dernier compte). Section 15 : notes de version et historique des
  modifications du site (`historique_modification`).
- `data/migrations/NNNN-<nom>.sql` (+ registre `.json` pour une migration de données) : tout changement de schéma ou de données (skill `ecrire-une-migration`).
- `client/scripts/db-*.mjs` (build, derive, check, doc, init, export-pages, appliquer-edition, reference), `tools/db/` (`maverick.py`, `migrer.py`, `pages_md.py`, `exporter.py`, `races_onglet.py`, `homonymes.py`).
- Onglet DB : `client/src/lib/donnees.mjs`, `client/src/pages/donnees/` (`index.astro`, `[table].astro`, `maverick.db.ts`).

## À lire
- `docs/sql/remplissage.md` : commandes, qui met quoi à jour, pourquoi `data/rows` est commité, onglet DB, pages fabriquées, `db:migrate`, colonne `remarque`.
- `docs/sql/conception.md` : conventions (`nom`, `titre`, `*_cle`, `origine`, `source_ref`, cascades), §10.1 migrations.
- `docs/sql/structure.md`, `docs/sql/apercu.md` : générés par `npm run db:doc`, jamais écrits à la main.
- Procédures voisines : skill `ecrire-une-migration`, skill `interroger-la-base`, skill `rapatrier-l-edition`, skill `modifier-une-page-wiki`, skill `revue-sql`, skill `relecture-db`.

## Commandes (depuis `client/`)
- `npm run db:build` : schéma + lignes + tables dérivées → `var/maverick.db` (ignoré par git).
- `db:check` : contrôles d'intégrité, code 1 au moindre problème.
- `db:pages-check` / `db:sync-pages` : les pages des `.md` fabriqués → `data/rows`.
- `db:export-pages` : fabrique les `.md` de `client/src/content/wiki/` depuis `data/rows` (lancé avant `dev`, `build` et `test`).
- `db:init` : base vide. `db:doc` : régénère `docs/sql/structure.md` et `apercu.md`.
- `db:migrate` : changement de schéma ou de données par `data/migrations/`.
- `db:appliquer-edition -- <journal.json>` : rapatrie les modifications du site de dev (journal rejoué sur `data/rows`, versé dans
  `historique_modification`, réécrit par `tools/db/exporter.py`).

## Invariants
- `var/maverick.db` est une copie reconstruite, jamais commitée. La seule persistance versionnée est `data/rows`.
- `data/rows` s'écrit tel que l'exporteur l'écrit : jamais de résolution de conflit git à la main (relancer l'importeur ou `db:sync-pages`). Un fichier qui
  n'est pas tel que l'exporteur l'écrit bloque une mise à jour (skill `zone-mise-a-jour`).
- Un changement de structure passe par une migration, jamais par une retouche de `data/rows`.
- Les 23 tables de la section 13 (fiches de personnages, groupes de jeu) et les 3 de la section 14 (journal de l'édition, brouillon de la note de version)
  restent vides dans `data/rows`. Les vraies fiches vivent dans la base vivante du service (skill `zone-fiches-base`, skill `zone-service`).
- Journal de l'édition (section 14) : un lot en conflit n'est jamais effacé ni réécrit. Sa résolution (`/mise-a-jour/`, migration 0072) remplit
  `modification_lot.resolu_le`, `resolution` (les choix, JSON) et `resolu_par` (le nouveau lot normal, jamais lui-même) ; ses lignes restent
  `conflit`, avec leur `detail` (skill `zone-edition`).
- Les commentaires de `data/schema.sql` (recopiés dans `docs/sql` par `db:doc`) ne citent que du code qui existe : un fichier `.mjs`, `.astro`,
  `.css` cité existe, un renvoi `fichier.mjs#Nom` nomme une définition du fichier, et `#Nom.prop` une propriété de l'export d'un module de `lib/`
  (`db-schema.test.mjs`). Un renommage ou une suppression dans le code corrige le commentaire dans le même lot, sans migration (`tools/db/maverick.py#comparer_schemas` ignore les commentaires), sauf dans le corps d'une `CREATE VIEW` ou d'une `CREATE TRIGGER` : SQLite garde dans `sqlite_master.sql` le texte entier du corps, commentaires compris, et les tests de migration rejouée (`client/test/aide-migration-rejouee.mjs#rejouerLaMigration`, par exemple `personnages-livre-de-sort.test.mjs`) le comparent à celui de `data/schema.sql`. Un commentaire dans ce corps reste identique, au caractère près, à celui de la dernière migration qui crée l'objet ; le changer demande une migration qui recrée l'objet. Une migration appliquée garde le sien.
- Noms d'affichage : une table ou une colonne nouvelle d'une table que l'édition écrit a son nom français dans `client/src/lib/libelles-de-la-base.mjs` (skill `zone-edition`), sinon `test/libelles-de-la-base.test.mjs` échoue ; une clé normalisée `X_cle` et la provenance n'en demandent pas.
- Identifiants figés : un id ne dérive plus du nom depuis la migration 0006 ; un nom corrigé ou renommé garde son id, une page renommée garde son adresse
  (skill `base-orthographe`).
- Les lignes typées ne se réimportent pas encore depuis les classeurs : réimporter un classeur modifié demande de porter l'importeur de sa famille. Une mise à
  jour d'un classeur passe par le rapprochement (skill `sources-rapprochement`).
- Colonne `remarque` : chaque table d'entités en a une, texte libre, vide par défaut. Elle reprend les notes de cellule des classeurs (plusieurs notes réunies,
  séparées par une ligne vide). `note_cellule` n'est qu'une trace : le site lit la remarque, jamais `note_cellule`. `db:check` vérifie qu'aucune note n'est
  absente de la remarque de sa ligne.
- Provenance (`famille`, `origine`, `source_ref`) : ne sert que jusqu'à la 1.0, puis retirée (décision du propriétaire, `docs/feuille-de-route.md`). N'y rien
  investir, ne pas réparer les références incomplètes.
- Améliorations d'arme (R167, migration 0081) : un seul tableau pour l'arme du catalogue et l'arme élémentaire. Les lignes de cible `arme` portent le coût matériel (`cout_brut`…) et le coût élémentaire (`cout_elementaire_brut`, `cout_gemmes`…) ; la cible `arme_elementaire` ne reste que dans `amelioration_total`. Type d'une famille : `arme_famille.type_elementaire_id` (NULL pour ARME DE MONSTRES et pour une famille créée sur le site de dev, R159 : aucune arme élémentaire ; le site ne le modifie pas) ; `arme_elementaire_type` et ses `_competence` et `_degats` (types physiques posés par la décision, jamais recalculés depuis `arme_degats` ; tous appliqués sauf `type_degats_au_choix` = 1, la bombe, dont le choix est `personnage_arme.type_degats_choisi`). Solidité de base : `constante_equipement` `piece_elementaire.solidite_base` (migration 0080) + `bonus_cran` de la ligne d'amélioration.
- Compteurs d'usage des actions (R173, migration 0085) : `personnage_action_usage`, ligne absente = au maximum, maximum jamais stocké (skill `zone-fiches-base`).
- Résistances physiques (R174, migration 0083) : `magie_resistance.cible_type` admet `'physique'`, avec `cible_physique` (`estoc`, `taille`, `frappe`) ; la contrainte nommée `magie_resistance_une_cible` veut exactement une cible renseignée, celle de `cible_type`. Seules lignes physiques : les trois vulnérabilités du Potentiel Illimité (« Surtension corporelle », texte de la magie cité tel quel dans `cible_brut`). Leur annulation en Mode Hyper (R172) n'est pas une donnée de la table.
- Le site de dev est la source de ce qu'il modifie : une valeur de l'import se lit par `client/src/lib/historique-site.mjs` (`valeurDImport`, `lignesDImport`,
  `effectifDImport`, table `historique_modification`).

## Choix du propriétaire
- Le site tire de la base toutes ses pages (`.md` fabriqués au build) et l'onglet **DB** : `/donnees/` (toutes les tables et vues) et la base en
  téléchargement `/donnees/maverick.db` (absente de la version portable).
- Le Potentiel Illimité n'a ni gemme, ni bois, ni bâton magique, ni pièce élémentaire (décision R160) : la base elle-même le refuse. `gemme`, `bois`,
  `baton_magique`, `arme_elementaire` et `armure_elementaire` portent la contrainte nommée `<table>_sans_potentiel_illimite`
  (`CHECK (magie_id <> 'magies/potentiel-illimite')`, migration 0078) ; une migration ou une édition qui en ajoute une échoue
  (« CHECK constraint failed: <nom> »). `bois` est couvert par R160 (« Oui, aucun bois du PI ») : contrainte `bois_sans_potentiel_illimite`.
  Une table reconstruite garde cette contrainte.

## Tests
- `client/test/db-donnees.test.mjs` (`data/rows` = les `.md`), `db-schema.test.mjs`, `db-remarque.test.mjs`, `db-appliquer-edition.test.mjs`,
  `donnees.test.mjs` (ancres, liens de clés étrangères de l'onglet DB), `historique-site.test.mjs`, `db-index-retires.test.mjs` (migration 0073 : six
  index qu'aucun plan ne choisissait, retirés ; les lectures par clé restent des recherches par index), `db-arme-famille-nom-lecture.test.mjs` (migration 0077, R159 : `arme_famille.nom_lecture`, figé, jamais NULL ni vide,
  le nom d'import ou de création), `r160-potentiel-illimite-sans-gemme.test.mjs` (migration 0078, R160 : aucune ligne du Potentiel Illimité dans les
  cinq tables, et une insertion ou une modification qui en pose une refusée, dans une copie), `db-armes-elementaires.test.mjs` (R167, migration 0081 : tableau fondu prouvé sur l'export du classeur, type, compétences et types physiques des 11 familles maîtrisables, aucun pour une famille créée, solidité de base, `personnage_arme` à un seul modèle, règles des armes élémentaires), `db-r174-resistances-physiques.test.mjs` (R174, migration 0083 : les trois lignes citées, aucune autre cible physique, contrainte `magie_resistance_une_cible` refusant une ligne à cible multiple ou sans cible, dans une copie), `db-r172-mode-hyper-activable.test.mjs` (R172, migration 0084 : colonnes du Mode Hyper de `personnage`, contrainte du 100 %, fiche d'avant ; skill `zone-fiches-base`), `db-r173-compteurs-d-actions.test.mjs` (R173, migration 0085), `db-r172-sort-prepare-en-mode-hyper.test.mjs` (R172, migration 0086 : `prepare_hyper`, `prepare_cent` ; skill `zone-fiches-base`).
