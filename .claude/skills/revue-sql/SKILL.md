---
name: revue-sql
description: "Grille d'expert pour juger du SQL et la base SQLite — conventions du projet à ne pas prendre pour des défauts, modélisation, intégrité, vues et index, migrations, sûreté, portabilité, preuve par requête. À charger par tech-db avant une migration ou une requête nouvelle, et par tech-qualite pour relire du SQL."
user-invocable: false
---

# Revue SQL

Périmètre : `data/schema.sql`, `data/derive.sql`, `data/migrations/`, `data/rows/`, et le SQL écrit dans `client/` (`lib/*-db.mjs`, `serveur/`, `scripts/`) et dans `tools/`. On juge la structure et l'intégrité, pas le fond d'une valeur : celui-ci revient à Game Design, par le chef.

## Avant de juger

Lire l'en-tête de `data/schema.sql` (les conventions) et le commentaire de la table. Puis `docs/sql/conception.md` §2 et §10, les choix F1 à F11 de `docs/sql/a-valider.md`, et les décisions R… qui la concernent.

Ces conventions du projet ne sont pas des défauts :
- identifiants TEXT figés ;
- absent = `NULL` (une `remarque` vide aussi) ;
- texte gardé tel que dans la source, fin de ligne de `page.corps_md` comprise ;
- `*_brut` à côté du typé, qui en garde les anomalies ;
- trous de rang voulus (`monstre_capacite.rang` n'est jamais renuméroté) ;
- références génériques `entite_table` / `entite_id` (F6) ;
- `origine` sans index ;
- le site de dev source de ce qu'il modifie (`historique_modification`).

## Grille

- **Modélisation.**
  - Une information à un seul endroit ; sinon une dérivée recalculée ou contrôlée.
  - Clés et cardinalités, nullabilité, types STRICT.
  - `CHECK` des énumérations et des booléens, `ON DELETE` adapté.
  - Clés de nom `*_cle` = `normalize()`.
- **Intégrité et données.**
  - Orphelins (y compris sans clé étrangère), doublons, valeurs hors vocabulaire, rangs.
  - Textes : espaces, Unicode, encodage.
  - Colonnes jamais remplies ou constantes.
- **Vues et requêtes.**
  - Jointures : lignes dupliquées, `LEFT` contre `INNER`.
  - Plans (`EXPLAIN QUERY PLAN`).
  - Index manquants ou redondants au regard des requêtes réelles (grep du SQL du site, du service et des importeurs).
- **Migrations** (`ecrire-une-migration`, `conception.md` §10.1, `tools/db/migrer.py`).
  - Une transaction, sans transaction ni PRAGMA dans le fichier.
  - Le schéma obtenu est exactement `schema.sql` : une colonne ajoutée va en dernier.
  - `user_version` et `data/rows/VERSION` d'accord.
  - La base vivante d'un serveur est reconstruite, pas migrée (`COLONNES_RETIREES`, `TABLES_FICHES`).
  - `docs/sql/structure.md` à jour (`npm run db:doc -- --check`).
- **Sûreté.**
  - Jamais un nom de table ou de colonne interpolé sans vérification (`PRAGMA table_info`).
  - Paramètres liés pour les valeurs.
  - `foreign_keys = ON` à chaque connexion.
  - Base ouverte en lecture seule quand rien n'est écrit.
- **Portabilité.** Rien de propre à SQLite hors de la liste admise par l'en-tête de `schema.sql` (F10).

## Méthode

Chaque constat est prouvé par une requête rejouable et son résultat. On interroge `var/maverick.db` construite, ouverte en lecture seule (`interroger-la-base`), ou une copie dans le scratchpad. Jamais la base vivante d'un serveur, jamais une fiche de joueur. Pour toute la base : `relecture-db`.

Gravités : **bloquant** (donnée fausse, intégrité rompue, perte possible), **à corriger** (incohérence, contrainte ou index manquant, risque à la prochaine écriture), **suggestion** (performance, lisibilité, portabilité, ménage), **question** (au propriétaire). Une valeur à trancher ne se déduit pas : c'est une question (`poser-une-question`).

Chaque constat donne : l'objet (`table.colonne`, vue, `fichier:ligne`), la preuve, la correction proposée, et le membre qui corrige. Si rien ne ressort, le dire.
