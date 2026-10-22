---
name: ecrire-une-migration
description: "Changer le schéma ou corriger des données de la base par une migration data/migrations/NNNN-<nom>.sql (npm run db:migrate), avec doc, contrôles et test. À charger par tech-db avant tout changement de data/schema.sql ou de lignes de data/rows."
---

# Écrire une migration

Un changement de structure, ou une correction de données qu'aucun outil n'écrit, passe par une migration. Détail : `docs/sql/remplissage.md` (« Changer le schéma ») et `docs/sql/conception.md` §10.1.

1. **Le schéma.** Modifier `data/schema.sql` : une colonne ajoutée se place **en dernier**, et `PRAGMA user_version` monte d'un cran, même pour une migration de données seules. Commenter chaque table ou colonne nouvelle comme ses voisines.
2. **La migration.** Écrire `data/migrations/NNNN-<nom>.sql`, le numéro suivant le dernier. Le fichier ne gère ni transaction ni PRAGMA.
   - Une migration additive se contente d'un `ADD COLUMN` nullable ou d'une nouvelle table.
   - Une migration cassante écrit son SQL explicite (table reconstruite, valeurs recopiées).
   - Un lot de corrections a son registre `NNNN-<nom>.json` à côté.
3. **L'application.** Depuis `client/`, **avant que le schéma soit commité** par `tech-publication` (la migration part du schéma du dernier commit) : `npm run db:migrate -- ../data/migrations/NNNN-<nom>.sql`. Elle réécrit `data/rows`, ou n'écrit rien si le schéma obtenu n'est pas exactement `schema.sql`.
4. **La doc et les contrôles**, depuis `client/` : `npm run db:doc` (régénère `docs/sql/structure.md` et `apercu.md`), `db:build`, `db:check`, `db:pages-check`, `npm test`.
5. **Les suites dans le code.**
   - Une table ajoutée se range dans le registre de l'API (`client/src/lib/ressources/` ou `HORS_RESSOURCE` : `zone-api-rest`).
   - Une table des sections 13, 14 ou 15 va dans ses listes (`zone-fiches-base`, `zone-edition`).
   - La base vivante d'un serveur n'est pas migrée mais reconstruite (`COLONNES_RETIREES`, `TABLES_RETIREES`, conversions : `zone-service`).
   - Le compteur de tables, de vues et de clés étrangères suit dans `base-sqlite` et dans les tests qui l'épinglent.
   - Une valeur importée d'un classeur que la migration change de façon voulue (décision R…) a son entrée `voulus` dans le registre `tools/sources/ignorer/<classeur>.json`, avec sa raison (`docs/sources.md`, « Rapprochement d'un classeur ») : `tech-sources` l'écrit. Sans elle, le test de rapprochement d'un classeur `rapproche` est rouge.
   - Une valeur que le site de dev a pu modifier : le rejeu du journal ne doit pas tomber en conflit sur elle (`zone-edition`, adaptateurs des anciennes écritures ; test du rejeu).
6. **Le test.** Un test dans `client/test/` épingle la migration (ce qu'elle change, et la décision R… si elle en applique une). `tech-qualite` le relit avec la grille `revue-sql`.

`data/rows` ne se modifie jamais à la main : par une migration, par `db:sync-pages` (`modifier-une-page-wiki`) ou par `db:appliquer-edition` (`rapatrier-l-edition`).
