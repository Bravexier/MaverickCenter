---
name: ecrire-une-migration
description: "Changer la structure de la base par une migration data/migrations/NNNN-<nom>.sql (npm run db:migrate) : structure seule, jamais de données, appliquée sur place par le service du site de dev ; doc, contrôles et test. À charger par tech-db avant tout changement de data/schema.sql."
---

# Écrire une migration

Un changement de structure passe par une migration, et une migration ne porte que de la structure. Un contenu (texte, valeur, ligne) se propose en lot de changements sur le site de dev (skills `modifier-une-page-wiki`, `zone-edition-lots`). Le service du site de dev applique la migration sur place au démarrage, après un essai sur une copie (skill `zone-service`) ; la production, sans marqueur, refait sa base depuis les règles. Détail : `docs/sql/remplissage.md` (« Changer le schéma ») et `docs/sql/conception.md` §10.1.

1. **Le schéma.** Modifier `data/schema.sql` : une colonne ajoutée se place **en dernier**, et `PRAGMA user_version` monte d'un cran. Commenter chaque table ou colonne nouvelle comme ses voisines.
2. **La migration.** Écrire `data/migrations/NNNN-<nom>.sql`, numérotée au-dessus du `user_version` de `data/schema.sql` (le plancher de structure, 130 aujourd'hui), puis du dernier fichier. Ce qu'une migration mixte laisse au code qui tourne vit dans `data/references/` (fichiers de référence, sans texte de règle : skill `base-sqlite`). Le fichier ne gère ni transaction ni PRAGMA.
   - Une migration additive se contente d'un `ADD COLUMN` nullable ou d'une nouvelle table.
   - Une migration cassante écrit son SQL explicite (table reconstruite, valeurs recopiées).
   - Une migration qui supprime des lignes retire elle-même leurs dépendants : `tools/db/maverick.py#migrer` suspend les clés étrangères, donc aucune cascade ne joue, et refuse la migration si `PRAGMA foreign_key_check` trouve une ligne orpheline.
3. **L'application.** Depuis `client/`, **avant que le schéma soit commité** par `tech-publication` (la migration part du schéma du dernier commit) : `npm run db:migrate -- ../data/migrations/NNNN-<nom>.sql`. Elle réécrit `data/rows`, ou n'écrit rien si le schéma obtenu n'est pas exactement `schema.sql`. La PR ne garde que les `data/rows/<t>.sql` des tables que ses migrations nomment (règle 6). Une migration renumérotée après un rebase, dont la structure est déjà dans `HEAD:data/schema.sql`, s'applique avec `-- <fichier> --schema-ancien <schéma de origin/dev>` (`git show origin/dev:data/schema.sql` dans un fichier hors dépôt ; sinon `migrer.py` part du schéma du commit).
4. **La doc**, depuis `client/` : `npm run db:doc` (régénère `docs/sql/structure.md` et `apercu.md`), et `db:build` quand un outil l'exige. **Les contrôles** (`db:check`, `db:pages-check`, `db:doc -- --check`, `npm run test:cible`) sont passés par `tech-qualite` en fin de lot (`controles-avant-rendu`) : l'auteur ne lance que le fichier de test qu'il écrit (`node --test test/<fichier>`).
5. **Les suites dans le code.**
   - Une table ajoutée se range dans le registre de l'API (`client/src/lib/ressources/` ou `HORS_RESSOURCE` : `zone-api-rest`).
   - Toute table nouvelle se classe dans `client/src/lib/tables-de-la-base.mjs` (contenu, propre au site ou calculée ; `TABLES_DE_REGLES` pour les règles) : sinon `test/tables-de-la-base.test.mjs` échoue. Une table des sections 13, 14 ou 15 va en plus dans ses listes (`zone-fiches-base`, `zone-edition`).
   - Elle doit passer des deux façons : sur place, sur la base du site de dev (base source), et par reconstruction, sur la production (`COLONNES_RETIREES`, `TABLES_RETIREES`, conversions : `zone-service`). La migration change déjà l'empreinte des règles : `VERSION_DE_LA_RECONSTRUCTION` ne monte que si le CODE de reconstruction change sans les règles (skill `zone-service`, « Reconstruction »).
   - Le compteur de tables, de vues et de clés étrangères suit dans `base-sqlite` et dans les tests qui l'épinglent.
   - Une migration qui change `page`, `alias`, `source` ou `page_source` refait `data/pages-d-exemple.sql` : `node scripts/db-pages-d-exemple.mjs` (depuis `client/`, skill `base-sqlite`). `test/pages-d-exemple.test.mjs` le compare à `data/rows`.
6. **Les règles des jobs `controle-des-migrations` et `controle-du-contenu-ecrit`**, checks requis (R282 ; détail : `docs/flux-git.md`, « Règles des migrations » ; code `client/scripts/controler-les-migrations*.mjs`) :
   - Une migration fusionnée ne se modifie, ne se renomme ni ne se supprime : pour corriger, on en écrit une nouvelle. Ni `BEGIN`, `COMMIT`, `END`, `ROLLBACK` ni `PRAGMA`.
   - À partir de 0130, une migration de structure (avec du DDL) ne porte aucun texte de règle : ses seuls littéraux sont des codes, des nombres et NULL, y compris dans `ADD COLUMN … DEFAULT` et `CREATE TABLE … AS SELECT`. Des données nécessaires : la structure par migration, puis les données par un lot de changements sur le site de dev.
   - Une migration sans DDL est « de données » : refusée (`controle-du-contenu-ecrit`, interrupteur `tools/flux-git/bascule-1.json` allumé, lu sur `origin/dev`). Une PR ne change `data/rows/<t>.sql` que pour les tables que nomment ses migrations de structure (`CREATE`, `ALTER`, `DROP TABLE`, les deux noms d'un renommage, la cible d'un `INSERT … SELECT` ; `docs/flux-git.md`, « Contenu écrit à la main »).
   - Un `RENAME` de table ou de colonne exige, dans la même migration, les `UPDATE` de `modification`, `historique_modification`, `lot_de_changements` et `numero_donne`.
   - Elle doit passer sur la base remplie du merge-base sans perdre de fiche ni de journal. Avant le push : `npm run db:controler-migrations -- --base origin/dev` (depuis `client/`).
7. **Le test.** Un test dans `client/test/` épingle la migration (ce qu'elle change, et la décision R… si elle en applique une). `tech-qualite` le relit avec la grille `revue-sql`.

`data/rows` est une copie du site de dev écrite par le workflow (« Lot : », « Copie : ») et, pour les seules tables qu'elle nomme, par `db:migrate` d'une migration de structure : jamais à la main ni par un outil (`db:sync-pages` écrit un lot `source`, `db:appliquer-edition` exige `--rows <copie>`).
