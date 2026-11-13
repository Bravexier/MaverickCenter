---
name: base-sqlite
description: "Base SQLite : data/schema.sql (sections, tables STRICT, vues), data/rows versionné, commandes db:*, colonne remarque, onglet DB /donnees/, identifiants figés. À charger avant de lire, modifier ou relire le schéma, data/rows, les scripts db-* ou tools/db/."
user-invocable: false
---
# Base SQLite (`data/schema.sql`, `data/rows/`)

## Fichiers
- `data/schema.sql` : la structure. 217 tables STRICT, FTS5, 38 vues, rangées en sections numérotées (en-têtes `-- N. …` du fichier) :
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
- `data/rows` s'écrit tel que l'exporteur l'écrit : jamais de résolution de conflit git à la main (relancer l'importeur ou `db:sync-pages`). Sinon une mise à jour est bloquée (skill `zone-mise-a-jour`).
- Un changement de structure passe par une migration, jamais par une retouche de `data/rows`.
- Les 25 tables de la section 13 (fiches, groupes de jeu) et les 3 de la section 14 (journal de l'édition, brouillon de la note de version)
  restent vides dans `data/rows` ; les vraies fiches vivent dans la base vivante (skill `zone-fiches-base`, skill `zone-service`).
- Journal de l'édition (section 14) : un lot en conflit n'est jamais effacé ni réécrit. Sa résolution (`/mise-a-jour/`, migration 0072) remplit `modification_lot.resolu_le`, `resolution` (JSON) et `resolu_par` (le nouveau lot normal) ; ses lignes restent `conflit` (skill `zone-edition-rejeu`).
- Les commentaires de `data/schema.sql` (recopiés par `db:doc`) ne citent que du code qui existe : fichier cité, `fichier.mjs#Nom`, `#Nom.prop` d'un module de `lib/` (`db-schema.test.mjs`). Un renommage dans le code corrige le commentaire dans le même lot, sans migration (`maverick.py#comparer_schemas` ignore les commentaires), sauf dans le corps d'une `CREATE VIEW` ou `CREATE TRIGGER` : SQLite le garde dans `sqlite_master.sql`, que les tests de migration rejouée (`aide-migration-rejouee.mjs#rejouerLaMigration`) comparent à `data/schema.sql` ; il reste identique à celui de la dernière migration qui crée l'objet, et le changer demande une migration qui le recrée.
- Noms d'affichage : une table ou une colonne nouvelle d'une table que l'édition écrit a son nom français dans `client/src/lib/libelles-de-la-base.mjs` (skill `zone-edition`), sinon `test/libelles-de-la-base.test.mjs` échoue ; une clé normalisée `X_cle` et la provenance n'en demandent pas.
- Identifiants figés : un id ne dérive plus du nom depuis la migration 0006 ; un nom corrigé ou renommé garde son id, une page renommée garde son adresse (skill `base-orthographe`).
- Les lignes typées ne se réimportent pas depuis les classeurs : une mise à jour passe par le rapprochement (skill `sources-rapprochement`).
- Colonne `remarque` : chaque table d'entités en a une, texte libre, vide par défaut, qui reprend les notes de cellule des classeurs (réunies, séparées par une ligne vide). `note_cellule` n'est qu'une trace : le site lit la remarque. `db:check` vérifie qu'aucune note n'est absente de la remarque de sa ligne.
- Provenance (`famille`, `origine`, `source_ref`) : retirée à la 1.0 (`CLAUDE.md`) ; n'y rien investir.
- Registre `.json` d'une migration de données : `textes` ou `valeurs` pour ce qui n'est pas une correction d'un classeur ; `corrections` (avant/apres en chaînes) est lu comme de l'orthographe et défait par `tools/sources/rapprocher.mjs` (skill `sources-rapprochement`) ; `evenements` est lu par la chronologie (skill `zone-chronologie`).
- Ce que chaque migration a fixé (mots-clés, plan des Règles, ordre des races, critique, spécialisations, classes, plafonds de NPM, résistances physiques, 0121…) : skill `base-sqlite-migrations`.
- Dérivées (`scripts/db-derive.mjs`) : `lien` (vue `lien_page`) = les `[[…]]` (pages d'exemple), puis chaque balise d'un mot-clé dont l'adresse mène à une page (`adresses-db.mjs#pageDeLAdresse`) ; `page_fts` indexe le texte affiché (`texteSansBalises`), jamais l'id d'un mot-clé.
- Le site de dev est la source de ce qu'il modifie (`CLAUDE.md`) : valeur d'import par `lib/historique-site.mjs` (`valeurDImport`, `lignesDImport`, `effectifDImport`).

## Choix du propriétaire
- Le site tire de la base toutes ses pages et l'onglet **DB** : `/donnees/` (tables et vues) et la base en téléchargement `/donnees/maverick.db` (absente de la version portable).
- Le Potentiel Illimité n'a ni gemme, ni bois, ni bâton magique, ni pièce élémentaire (décision R160) : la base le refuse. `gemme`, `bois`,
  `baton_magique`, `arme_elementaire` et `armure_elementaire` portent la contrainte nommée `<table>_sans_potentiel_illimite`
  (`CHECK (magie_id <> 'magies/potentiel-illimite')`, migration 0078) ; une migration ou une édition qui en ajoute une échoue (`bois_sans_potentiel_illimite`). Une table reconstruite garde cette contrainte.

## Tests
- `client/test/db-donnees.test.mjs` (`data/rows` = les `.md`), `db-schema.test.mjs`, `db-remarque.test.mjs`, `db-appliquer-edition.test.mjs`, `donnees.test.mjs`, `historique-site.test.mjs`, `db-index-retires.test.mjs`, `db-arme-famille-nom-lecture.test.mjs`, `r160-potentiel-illimite-sans-gemme.test.mjs`, `db-derive-recherche.test.mjs` (`page_fts`), `db-pages-du-site.test.mjs`.
- Un test par migration (`db-<NNNN>-…`, `db-r<N>-…`) : skill `base-sqlite-migrations`.
