---
name: base-sqlite
description: "Base SQLite : data/schema.sql (sections, tables STRICT, vues), data/rows versionné, commandes db:*, colonne remarque, onglet DB /donnees/, identifiants figés. À charger avant de lire, modifier ou relire le schéma, data/rows, les scripts db-* ou tools/db/."
user-invocable: false
---
# Base SQLite (`data/schema.sql`, `data/rows/`)

## Fichiers
- `data/schema.sql` : la structure. 201 tables STRICT, FTS5, 38 vues, rangées en sections numérotées (en-têtes `-- N. …` du fichier) :
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
- Les 21 tables de la section 13 (fiches de personnages, groupes de jeu) et les 3 de la section 14 (journal de l'édition, brouillon de la note de version)
  restent vides dans `data/rows`. Les vraies fiches vivent dans la base vivante du service (skill `zone-fiches-base`, skill `zone-service`).
- Journal de l'édition (section 14) : un lot en conflit n'est jamais effacé ni réécrit. Sa résolution (`/mise-a-jour/`, migration 0072) remplit
  `modification_lot.resolu_le`, `resolution` (les choix, JSON) et `resolu_par` (le nouveau lot normal, jamais lui-même) ; ses lignes restent
  `conflit`, avec leur `detail` (skill `zone-edition`).
- Les commentaires de `data/schema.sql` (recopiés dans `docs/sql` par `db:doc`) ne citent que du code qui existe : un fichier `.mjs`, `.astro`,
  `.css` cité existe, un renvoi `fichier.mjs#Nom` nomme une définition du fichier, et `#Nom.prop` une propriété de l'export d'un module de `lib/`
  (`db-schema.test.mjs`). Un renommage ou une suppression dans le code corrige le commentaire dans le même lot ; une migration appliquée garde le sien.
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
- Améliorations d'arme : un seul tableau pour l'arme du catalogue et l'arme élémentaire (décision R167, migration 0081) : les lignes de cible `arme`
  portent le coût matériel (`cout_brut`…) et le coût élémentaire (`cout_elementaire_brut`, `cout_gemmes`…) ; la cible `arme_elementaire` ne reste que
  dans `amelioration_total` (le total du coût élémentaire). Type élémentaire d'une famille : `arme_famille.type_elementaire_id` (NULL pour ARME DE MONSTRES et pour
  une famille créée sur le site de dev, R159 : elle n'a aucune arme élémentaire, R167 ; le site ne modifie pas cette colonne) ; en-têtes de type :
  `arme_elementaire_type` ; compétence au choix : `arme_elementaire_type_competence` ; type physique (le plus fréquent de la famille, posé par la décision, jamais recalculé depuis
  `arme_degats`) : `arme_elementaire_type_degats`, tous appliqués sauf quand `arme_elementaire_type.type_degats_au_choix` = 1 (la bombe : un seul, choisi
  dans `personnage_arme.type_degats_choisi`, contrôle `arme_type_degats_choisi`) ; sorts « Fer » : l'étiquette « Sort fer » (`sort_mot_cle` `sort-fer`, R164, migration 0079) ;
  solidité de base : `constante_equipement` `piece_elementaire.solidite_base` (migration 0080), plus `bonus_cran` de la ligne d'amélioration de cible `arme`.
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
  cinq tables, et une insertion ou une modification qui en pose une refusée, dans une copie), `db-armes-elementaires.test.mjs` (R167, migration 0081 :
  tableau d'amélioration des armes fondu, prouvé sur l'export du classeur ; type élémentaire des 11 familles maîtrisables de l'import, aucun pour une
  famille créée sur le site de dev ; en-têtes de type ; compétences ; types physiques ; solidité de base ; étiquette des sorts « Fer » ; `personnage_arme` à un seul modèle et type choisi
  de la bombe ; règles `arme_elementaire_hors_magie` et `arme_type_degats_choisi`).
